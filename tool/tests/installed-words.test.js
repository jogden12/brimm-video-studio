// The words an installed Mac is told (Phase 3, Task 5): choose Repair, or say "update Studio", with the support contact, in place of
// "Jason runs install.sh" and "Jason has a newer BRIMM Video Studio". A dev checkout keeps today's words. Every Mac here is made up in a
// temp home, and no program is real.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMAND_NAMES, contextFor, editMain } from "../edit.js";
import { UNSCOPED } from "../gate.js";
import { NEWEST_VERSION, recordFile } from "../episode.js";
import { notWritten } from "../plan.js";
import { setup, episodeFor, FOLDER, ID } from "./episodes.js";

const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

/** What each command is given to name the made-up episode, as Claude runs it. */
const ASKED = {
  kind: [FOLDER, "finished", "--private", "no"], leave: [FOLDER], which: [FOLDER], read: ["--now", FOLDER, "--kind", "finished", "--rev", "1"],
  workcopy: ["--now", FOLDER], open: [FOLDER], app: [FOLDER], bring: ["--now", FOLDER], name: [FOLDER, "A new name"], title: [FOLDER], reel: ["drop", FOLDER, "1"], reels: [FOLDER, "--no-play"],
  ask: [FOLDER], finish: [FOLDER], show: [FOLDER, "transcript"], resolve: [FOLDER], spell: [FOLDER],
  graphic: [FOLDER, "ideas"],
  teachings: [FOLDER], principles: [FOLDER], ideas: [FOLDER], free: [FOLDER],

  refs: ["use", FOLDER, "blue carousel"],
  plan: [FOLDER],
  footage: [FOLDER, "Too many SKUs", "talking", "--client", "no"],
  join: ["--now", FOLDER, "--parts", "e-20261104-a11111"]
};
/** The commands that name an episode, each of COMMAND_NAMES but those that name none. */
const SCOPED = COMMAND_NAMES.filter((name) => !UNSCOPED.includes(name));

describe("an installed Mac's words", () => {
  it("says a Mac that is not set up to choose Repair", () => {
    const home = mkdtempSync(join(tmpdir(), "installed-words-"));
    assert.equal(contextFor({ home, build: INSTALLED }).why, "This Mac is not set up for episodes yet. Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid.");
    assert.equal(contextFor({ home, build: { ...INSTALLED, support: "" } }).why, "This Mac is not set up for episodes yet. Open BRIMM Video Studio and choose Repair.");
    assert.equal(contextFor({ home, build: { mode: "dev" } }).why, "This Mac is not set up for episodes yet. Jason runs install.sh --machine on it.");
  });

  it("says an episode a newer Studio wrote is for an update, for every command that names an episode", async () => {
    for (const name of SCOPED.filter((n) => n !== "show")) {
      const t = setup();
      const found = episodeFor(t);
      writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
      const r = await on({ ...t.ctx.deps, build: INSTALLED }, name, ...ASKED[name]);
      assert.equal(r.code, 1, name);
      const lines = r.said.filter((l) => l.includes("a newer BRIMM Video Studio wrote"));
      assert.ok(lines.length > 0, name);
      for (const l of lines) assert.ok(l.endsWith('Say "update Studio" to update this Mac.'), `${name}: ${l}`);
      assert.ok(!r.said.some((l) => l.includes("Jason has a newer")), name);
      t.done();
    }
  });

  it("says the agent that could not be asked to choose Repair", async () => {
    const t = setup();
    const said = [];
    const deps = { ...t.ctx.deps, build: INSTALLED, agentPid: () => null, agentNode: () => "", kickstart: () => { throw new Error("no such service."); } };
    const code = await editMain(["look"], { ...deps, say: (text) => said.push(text) });
    assert.equal(code, 1);
    assert.deepEqual(said, ["The launch agent com.thebrimm.unedited could not be asked to look (no such service). Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid."]);
    t.done();
  });

  it("says a plan a newer Studio wrote is for an update", () => {
    assert.equal(notWritten({ code: "NEWER" }, INSTALLED), 'a newer BRIMM Video Studio wrote it: say "update Studio" to update this Mac');
    assert.equal(notWritten({ code: "NEWER" }), "Jason has a newer BRIMM Video Studio. Ask him to update this Mac");
    assert.equal(notWritten({ code: "CHANGED" }, INSTALLED), "this plan changed on the other Mac: say it again");
  });
});
