// `look`, her chat's "look again" (access-notice design, part 4): ask the import to look in the drop folder now. An `asking` finding
// says its line; a run at work says it looks again within a minute; otherwise the launch agent is kicked once. The launch agent's pid,
// node and kickstart are stand-ins: no test reaches launchctl. Every Mac here is made up in a temp home.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { editMain } from "../edit.js";
import { ASKING_MS, LOOK_ASKED, LOOK_AT_WORK, accessLine, writeAccess } from "../access.js";
import { dropWords } from "../guide.js";
import { dropFolderOf, readSettings, runsFolder } from "../settings.js";
import { lockFile } from "../run.js";
import { setup } from "./episodes.js";

async function on(t, more = {}) {
  const said = [];
  const kicks = [];
  const deps = { ...t.ctx.deps, agentPid: () => null, agentNode: () => "", kickstart: () => kicks.push("kick"), ...more };
  const code = await editMain(["look"], { ...deps, say: (text) => said.push(text) });
  return { code, said, kicks };
}
const dropOf = (t) => dropFolderOf(readSettings(t.home).settings, t.home);

describe("look", () => {
  it("an asking finding says its line, kicks nothing, ends 0", async () => {
    const t = setup();
    writeAccess(t.home, { version: 1, places: {}, looking: { place: "drop", pid: 4242, at: t.now() - ASKING_MS - 1000 }, told: {} });
    const r = await on(t, { agentPid: () => 4242 });
    const words = `your drop folder, ${dropWords(readSettings(t.home).settings, "Mac Studio", t.home)}`;
    assert.deepEqual(r.said, [accessLine({ kind: "asking", place: "drop" }, { placeWords: words })]);
    assert.equal(r.kicks.length, 0);
    assert.equal(r.code, 0);
    t.done();
  });

  it("a run at work (the agent has a pid) says so, kicks nothing, ends 0", async () => {
    const t = setup();
    const r = await on(t, { agentPid: () => 777 });
    assert.deepEqual(r.said, [LOOK_AT_WORK]);
    assert.equal(r.kicks.length, 0);
    assert.equal(r.code, 0);
    t.done();
  });

  it("a live pid in the lock is a run at work too", async () => {
    const t = setup();
    const lock = lockFile(dropOf(t), runsFolder(t.home));
    mkdirSync(dirname(lock), { recursive: true });
    writeFileSync(lock, "31337");
    const r = await on(t, { alive: (pid) => pid === 31337 });
    assert.deepEqual(r.said, [LOOK_AT_WORK]);
    assert.equal(r.kicks.length, 0);
    assert.equal(r.code, 0);
    t.done();
  });

  it("a refused drop folder still kicks once (she has just allowed node), and says it asked, ends 0", async () => {
    const t = setup();
    writeAccess(t.home, { version: 1, places: { drop: { state: "refused", code: "EPERM", at: t.now(), since: t.now(), folder: dropOf(t), node: "/opt/homebrew/Cellar/node/25.0.0/bin/node" } }, looking: null, told: {} });
    const r = await on(t);
    assert.deepEqual(r.said, [LOOK_ASKED]);
    assert.equal(r.kicks.length, 1);
    assert.equal(r.code, 0);
    t.done();
  });

  it("no run at work: kicks once, says it asked, ends 0", async () => {
    const t = setup();
    const r = await on(t);
    assert.deepEqual(r.said, [LOOK_ASKED]);
    assert.equal(r.kicks.length, 1);
    assert.equal(r.code, 0);
    t.done();
  });

  it("a kickstart that throws says retry's could-not line for the agent, ends 1", async () => {
    const t = setup();
    const r = await on(t, { kickstart: () => { throw new Error("no such service."); } });
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, ["The launch agent com.thebrimm.unedited could not be asked to look (no such service). Jason runs install.sh --machine on this Mac."]);
    t.done();
  });

  it("is a command, and its help line follows retry's", async () => {
    const { HELP, COMMAND_NAMES } = await import("../edit.js");
    assert.ok(COMMAND_NAMES.includes("look"));
    const lines = HELP.split("\n");
    const retry = lines.findIndex((l) => l.startsWith('  node edit.js retry "<video>"'));
    assert.ok(retry >= 0 && lines[retry + 1].startsWith("  node edit.js look "), lines[retry + 1]);
  });
});
