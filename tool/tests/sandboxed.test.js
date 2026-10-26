// edit.js's own check that it is not inside Claude Code's sandbox (design 2026-10-26, section 1, "brimm-video's own command, outside
// the sandbox", item 3; section 10; C24, C40), and the app's environment, which edit.js keeps and never says (section 1, "The app's
// environment"). `ps` is always a stand-in here: no test runs the real one, and no test takes the runner's own environment.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SANDBOXED, sandboxedWhy } from "../sandboxed.js";
import { editMain } from "../edit.js";
import { ENVIRONMENT } from "../studio.js";
import { setup, episodeFor, FOLDER } from "./episodes.js";
import { openWorld, openDeps } from "./open-world.js";

/** A stand-in for spawnSync that answers `answer` and keeps each call it is given. */
function spawnOf(answer) {
  const calls = [];
  const spawn = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    return typeof answer === "function" ? answer(cmd, args) : answer;
  };
  return { spawn, calls };
}

const PRINTED = { status: 0, stdout: "  321\n", stderr: "" };

describe("edit.js inside Claude Code's sandbox", () => {
  it("says it was run inside the sandbox in the design's words", () => {
    assert.equal(SANDBOXED, "brimm-video was run inside Claude Code's sandbox: ask Jason.");
  });

  it("refuses under SANDBOX_RUNTIME=1 without asking ps", () => {
    const { spawn, calls } = spawnOf(PRINTED);
    assert.equal(sandboxedWhy({ env: { SANDBOX_RUNTIME: "1" }, pid: 4242, spawn }), SANDBOXED);
    assert.equal(calls.length, 0);
  });

  it("refuses with the variable unset when ps cannot be started (EPERM), exits non-zero, or prints nothing", () => {
    const eperm = Object.assign(new Error("spawnSync /bin/ps EPERM"), { code: "EPERM" });
    const enoent = Object.assign(new Error("spawnSync /bin/ps ENOENT"), { code: "ENOENT" });
    for (const [what, answer] of [
      ["EPERM", { error: eperm, status: null, stdout: "" }],
      ["another spawn error", { error: enoent, status: null, stdout: "" }],
      ["a thrown spawn", () => { throw eperm; }],
      ["a non-zero exit", { status: 1, stdout: "" }],
      ["a non-zero exit with a pid", { status: 1, stdout: "321\n" }],
      ["killed", { status: null, signal: "SIGTERM", stdout: "" }],
      ["nothing printed", { status: 0, stdout: "" }],
      ["no stdout", { status: 0 }],
      ["not a pid", { status: 0, stdout: "PPID\n" }],
      ["two lines", { status: 0, stdout: "321\n322\n" }]]) {
      const { spawn } = spawnOf(answer);
      assert.equal(sandboxedWhy({ env: {}, pid: 4242, spawn }), SANDBOXED, what);
    }
  });

  it("goes on when ps prints a process id and the variable is unset", () => {
    for (const env of [{}, { SANDBOX_RUNTIME: "0" }, { SANDBOX_RUNTIME: "" }, { CLAUDECODE: "1" }]) {
      const { spawn, calls } = spawnOf(PRINTED);
      assert.equal(sandboxedWhy({ env, pid: 4242, spawn }), "", JSON.stringify(env));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].cmd, "/bin/ps");
      assert.deepEqual(calls[0].args, ["-o", "ppid=", "-p", "4242"]);
      assert.equal(calls[0].options.encoding, "utf8");
      assert.equal(calls[0].options.timeout, 5000);
    }
  });

  it("asks ps about edit.js's own process, never its parent, which a detached run outlives", () => {
    const { spawn, calls } = spawnOf((cmd, args) => (args.at(-1) === "4242" ? PRINTED : { status: 1, stdout: "" }));
    assert.equal(sandboxedWhy({ env: {}, pid: 4242, spawn }), "");
    assert.equal(calls[0].args.at(-1), "4242");
  });

  it("is checked at edit.js's entry before anything else runs", () => {
    const entry = readFileSync(new URL("../edit.js", import.meta.url), "utf8").split("if (process.argv[1]").at(-1);
    assert.ok(entry.indexOf("sandboxedWhy(") >= 0 && entry.indexOf("sandboxedWhy(") < entry.indexOf("editMain("));
    assert.ok(entry.includes("pid: process.pid") && !entry.includes("process.ppid"));
  });

  it("prints and logs no value of a listed variable of the app's environment", async () => {
    const env = Object.fromEntries(ENVIRONMENT.deny.map((name) => [name, `VALUE-${name}`]));
    const said = [];
    const on = async (deps, ...argv) => {
      const code = await editMain(argv, { ...deps, env: { ...env, ...(deps.env || {}) }, say: (line) => said.push(line) });
      return code;
    };
    // A strict Mac with a video waiting for her answer: episodes, show and kind's refusals.
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: null, label: "Video of 20 Oct, 15:00 (Mac Studio)", answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null } } });
    await on(t.ctx.deps, "episodes");
    assert.equal(await on(t.ctx.deps, "show", FOLDER, "transcript"), 1);
    assert.notEqual(await on(t.ctx.deps, "kind", "Video of 20 Oct, 15:00 (Mac Studio)", "finished"), 0);
    assert.notEqual(await on(t.ctx.deps, "kind", "Video of 20 Oct, 15:00 (Mac Studio)", "session", "--private", "no"), 0);
    // behind on an open-lock Mac, under Claude Code and in Terminal, with stand-ins for git, ps and lsof.
    const w = openWorld();
    const run = async () => ({ code: 0, stderr: "", stdout: "0\n" });
    for (const more of [{}, { env: { CLAUDECODE: "1" } }]) await on({ ...openDeps(w), run, ...more }, "behind");
    assert.ok(said.length > 0);
    for (const line of said) assert.ok(!line.includes("VALUE-"), line);
    for (const home of [t.home, w.home]) {
      const log = join(home, "Library", "Logs", "brimm-video.log");
      if (existsSync(log)) assert.ok(!readFileSync(log, "utf8").includes("VALUE-"));
    }
    w.done();
  });
});
