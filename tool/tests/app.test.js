// Opening an episode in HyperFrames (plan PR 4; architecture 2026-10-27, sections 4.1, 5.3 and 5.6). No test runs the command line,
// the app or HeyGen: the stand-in (tests/stand-ins/hyperframes.mjs) answers as the pinned version does, from PR 1's fixtures, and
// writes down how it was run, so a test can check the arguments and the environment `app` gives it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { childEnv, PIN, readOpen } from "../hyperframes.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";

/** A home folder for the stand-in, which reads how to answer `open` from a file there (`hyperframes-stand-in.json`) and writes each
    run it makes to another (`hyperframes-stand-in.log`): it is run in PR 1's environment, which carries no variable of a test's. */
function standIn(c, { open = "opened" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-stand-in-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open }));
  const env = (more = {}) => childEnv({ base: { HOME: home, LANG: "en_US.UTF-8" }, node: process.execPath, ...more });
  const run = (args, more) => spawnSync(process.execPath, [STAND_IN, ...args], { env: env(more), encoding: "utf8" });
  const runs = () => (existsSync(join(home, "hyperframes-stand-in.log")) ? readFileSync(join(home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  return { home, project: join(home, "BRIMM Video Work", "Pricing talk", "Pricing talk main 3fa9c1"), run, runs };
}

describe("the HyperFrames stand-in", () => {
  it("says the pinned version", (c) => {
    const s = standIn(c);
    const r = s.run(["--version"]);
    assert.deepEqual([r.status, r.stdout], [0, `${PIN.version}\n`]);
  });
  it("opens a project as the test tells it to, and says so as the pinned open --json does", (c) => {
    for (const [open, code, words] of [
      ["opened", 0, "It's open in HyperFrames."],
      ["not-installed", 1, "HyperFrames isn't installed on this Mac: ask Jason."],
      ["open-failed", 1, "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]
    ]) {
      const s = standIn(c, { open });
      const r = s.run(["open", s.project, "--json"]);
      assert.equal(r.status, code, open);
      assert.equal(JSON.parse(r.stdout).project, s.project, open);
      assert.equal(readOpen(r.stdout, r.status).words, words, open);
    }
  });
  it("takes the chat over only when its environment carries a chat's id", (c) => {
    const s = standIn(c);
    assert.equal(JSON.parse(s.run(["open", s.project, "--json"]).stdout).handedOver, null);
    const handed = JSON.parse(s.run(["open", s.project, "--json"], { handover: true, sessionId: CHAT }).stdout);
    assert.deepEqual(handed.handedOver, { engine: "claude", sessionId: CHAT });
    assert.equal(readOpen(JSON.stringify(handed), 0).words, "It's open in HyperFrames, and it picks up this conversation.");
  });
  it("answers catch-up and history as an untouched project's", (c) => {
    const s = standIn(c);
    const caught = s.run(["catch-up", s.project, "--json"]);
    assert.deepEqual([caught.status, JSON.parse(caught.stdout)], [0, { project: s.project, turns: [], files: [] }]);
    const history = s.run(["history", "--dir", s.project, "--json"]);
    assert.deepEqual([history.status, JSON.parse(history.stdout).entries], [0, []]);
  });
  it("writes down each run: its arguments and the names of its environment", (c) => {
    const s = standIn(c);
    s.run(["--version"]);
    s.run(["open", s.project, "--json"], { handover: true, sessionId: CHAT });
    assert.deepEqual(s.runs(), [
      { args: ["--version"], env: ["HOME", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"] },
      { args: ["open", s.project, "--json"], env: ["CLAUDE_CODE_SESSION_ID", "HOME", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"] }
    ]);
  });
  it("answers nothing else, and ends with 2", (c) => {
    const s = standIn(c);
    for (const args of [["publish"], ["open"], ["render", s.project]]) {
      const r = s.run(args);
      assert.deepEqual([r.status, r.stdout], [2, ""], args.join(" "));
    }
  });
});
