// `behind` says what the import's note (access.json) and her drop folder show, last, whatever git answered (access-notice design, part 3,
// item 1): one finding's line, and for a new node a kick of the launch agent. The launch agent's pid and node, launchctl and plutil are
// stand-ins: no test reaches the real ones. Every Mac here is made up in a temp home; nothing is written in Dropbox or a watched folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { ASKING_MS, DOWNLOADS_SAY_MS, UNSEEN_MS, accessLine, writeAccess } from "../access.js";
import { dropWords } from "../guide.js";
import { writeStatusIn } from "../importing.js";
import { seenFile, dropFolderOf, downloadsFolder, importingFolderOf, runsFolder, writeSettings, readSettings } from "../settings.js";
import { lockFile } from "../run.js";
import { seenKey } from "../filing.js";
import { setup } from "./episodes.js";

const NEWEST = "This Mac has the newest BRIMM Video Studio.";
const upToDate = async () => ({ code: 0, stderr: "", stdout: "0\n" });
const unreachable = async () => ({ code: 128, stderr: "fatal" });
const NODE = "/opt/homebrew/Cellar/node/25.0.0/bin/node";
const NEW_NODE = "/opt/homebrew/Cellar/node/25.1.0/bin/node";
const NEW_NODE_LINE = "node was updated on this Mac, so macOS may ask whether node may look in your drop folder or in Dropbox. If a box asks, choose Allow.";

/** Run `behind` on the made-up Mac `t` with deps `more` over its own, git being `run`: { code, said, text, kicks }. */
async function on(t, more = {}, run = upToDate) {
  const said = [];
  const kicks = [];
  const deps = { ...t.ctx.deps, agentPid: () => null, agentNode: () => "", kickstart: () => kicks.push("kick"), ...more };
  const code = await editMain(["behind"], { ...deps, run, say: (text) => said.push(text) });
  return { code, said, text: said.join("\n"), kicks };
}

const settingsOf = (t) => readSettings(t.home).settings;
const dropOf = (t) => dropFolderOf(settingsOf(t), t.home);
const place = (t, state, extra = {}) => ({ state, code: state === "refused" ? "EPERM" : state === "locked" ? "EACCES" : "", at: t.now(), since: t.now(), folder: dropOf(t), node: NODE, ...(state === "ok" ? { okNode: NODE } : {}), ...extra });
const note = (t, places = {}, more = {}) => writeAccess(t.home, { version: 1, places, looking: null, told: {}, ...more });
const dropWordsOf = (t) => `your drop folder, ${dropWords(settingsOf(t), "Mac Studio", t.home)}`;
/** A video of 5 bytes in the drop folder, and the clock set `minutes` after its ctime. */
function video(t, name = "talk.mp4", minutes = 4) {
  const file = join(dropOf(t), name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "12345");
  return { file, clock: () => statSync(file).ctimeMs + minutes * 60000 };
}

describe("behind: says each finding's line last, whatever git answered", () => {
  for (const git of [upToDate, unreachable]) {
    it(`asking, refused, locked, error (git ${git === upToDate ? "up to date" : "unreachable"})`, async () => {
      const t = setup();
      const words = dropWordsOf(t);
      const sw = "its switches";
      const cases = [
        [{ looking: { place: "drop", pid: 4242, at: t.now() - ASKING_MS - 1000 }, places: {} }, { agentPid: () => 4242 }, accessLine({ kind: "asking", place: "drop" }, { placeWords: words })],
        [{ places: { drop: place(t, "refused") } }, {}, accessLine({ kind: "refused", place: "drop" }, { placeWords: words, switchName: sw })],
        [{ places: { drop: place(t, "locked") } }, {}, accessLine({ kind: "locked", place: "drop" }, { placeWords: words })],
        [{ places: { drop: place(t, "error", { code: "EIO" }) } }, {}, accessLine({ kind: "error", place: "drop", code: "EIO" }, { placeWords: words })]
      ];
      for (const [fields, more, line] of cases) {
        note(t, fields.places, fields.looking ? { looking: fields.looking } : {});
        const r = await on(t, more, git);
        assert.equal(r.said.at(-1), line);
        assert.equal(r.code, 0);
      }
      t.done();
    });
  }

  it("missing on a Mac with a drop folder of its own; a Dropbox Mac's missing drop folder says nothing", async () => {
    const t = setup();
    assert.ok(!(await on(t)).text.includes("is not there now"));
    writeSettings(t.home, { dropPath: join(t.dir, "elsewhere", "Drop") });
    const r = await on(t);
    assert.equal(r.said.at(-1), accessLine({ kind: "missing", place: "drop" }, { placeWords: dropWordsOf(t) }));
    t.done();
  });

  it("says nothing when the lock refuses first", async () => {
    const t = setup();
    note(t, { drop: place(t, "refused") });
    mkdirSync(join(t.dir, "managed"), { recursive: true });
    writeFileSync(join(t.dir, "managed", "managed-settings.json"), JSON.stringify({ disableAllHooks: true }));
    const r = await on(t);
    assert.equal(r.code, 1);
    assert.ok(!r.text.includes("does not let the import look"), r.text);
    t.done();
  });

  it("says nothing for a world with no finding", async () => {
    const t = setup();
    assert.deepEqual((await on(t)).said, [NEWEST]);
    note(t, { drop: place(t, "ok"), episodes: place(t, "ok", { folder: t.ctx.episodes }) });
    assert.deepEqual((await on(t)).said, [NEWEST]);
    t.done();
  });

  it("passes over a note whose folder is not where its place is now, and one whose folder is not text", async () => {
    const t = setup();
    note(t, { drop: place(t, "refused", { folder: join(t.dir, "old drop") }) });
    assert.deepEqual((await on(t)).said, [NEWEST]);
    note(t, { drop: place(t, "refused", { folder: 7 }) });
    assert.deepEqual((await on(t)).said, [NEWEST]);
    t.done();
  });

  it("a local Mac refused only Dropbox says the Dropbox line", async () => {
    const t = setup();
    writeSettings(t.home, { dropPath: join(t.dir, "local", "Drop") });
    mkdirSync(dropOf(t), { recursive: true });
    note(t, { drop: place(t, "ok"), episodes: place(t, "refused", { folder: t.ctx.episodes }) });
    const r = await on(t);
    assert.equal(r.said.at(-1), accessLine({ kind: "refused", place: "episodes", code: "EPERM" }, { placeWords: "BRIMM Video in Dropbox", switchName: "its switches" }));
    t.done();
  });

  it("says a Downloads refusal only while its note is within a day", async () => {
    const t = setup();
    const dl = downloadsFolder(t.home);
    note(t, { downloads: place(t, "refused", { folder: dl, at: t.now() - DOWNLOADS_SAY_MS + 60000 }) });
    const r = await on(t);
    assert.equal(r.said.at(-1), accessLine({ kind: "refused", place: "downloads", code: "EPERM" }, { placeWords: "the Downloads folder", switchName: "Downloads Folder" }));
    note(t, { downloads: place(t, "refused", { folder: dl, at: t.now() - DOWNLOADS_SAY_MS - 60000 }) });
    assert.deepEqual((await on(t)).said, [NEWEST]);
    t.done();
  });

  it("says the Downloads line in behind within a day, and nothing for an ok note (episodes is pinned in edit-guide-access)", async () => {
    const t = setup();
    const dl = downloadsFolder(t.home);
    const line = accessLine({ kind: "refused", place: "downloads", code: "EPERM" }, { placeWords: "the Downloads folder", switchName: "Downloads Folder" });
    note(t, { downloads: place(t, "refused", { folder: dl }) });
    assert.equal((await on(t)).said.at(-1), line);
    note(t, { downloads: place(t, "ok", { folder: dl }) });
    assert.deepEqual((await on(t)).said, [NEWEST]);
    t.done();
  });

  it("names the switch for Dropbox when Downloads is a link into Dropbox", async () => {
    const t = setup();
    const dl = downloadsFolder(t.home);
    const target = join(t.home, "Library", "CloudStorage", "Dropbox-x", "Downloads");
    mkdirSync(target, { recursive: true });
    rmSync(dl, { recursive: true, force: true });
    symlinkSync(target, dl);
    note(t, { downloads: place(t, "refused", { folder: dl }) });
    const r = await on(t);
    assert.equal(r.said.at(-1), accessLine({ kind: "refused", place: "downloads", code: "EPERM" }, { placeWords: "the Downloads folder", switchName: "the switch for Dropbox" }));
    t.done();
  });
});

describe("behind: asking only for the agent's own pid", () => {
  it("says asking only when the agent's pid is the one looking.pid noted", async () => {
    const t = setup();
    const asking = { place: "drop", pid: 4242, at: t.now() - ASKING_MS - 1000 };
    note(t, {}, { looking: asking });
    const line = accessLine({ kind: "asking", place: "drop" }, { placeWords: dropWordsOf(t) });
    assert.deepEqual((await on(t, { agentPid: () => null })).said, [NEWEST]);
    assert.deepEqual((await on(t, { agentPid: () => 5151 })).said, [NEWEST]);
    assert.equal((await on(t, { agentPid: () => 4242 })).said.at(-1), line);
    t.done();
  });
});

describe("behind: a new node", () => {
  const worldOf = (t) => {
    writeSettings(t.home, { dropPath: join(t.home, "Desktop", "Drop") });
    mkdirSync(dropOf(t), { recursive: true });
    note(t, { drop: place(t, "ok", { okNode: NODE }) });
  };

  it("asks the agent to look when no run is at work, and says the line", async () => {
    const t = setup();
    worldOf(t);
    const r = await on(t, { agentPid: () => null, agentNode: () => NEW_NODE });
    assert.equal(r.said.at(-1), NEW_NODE_LINE);
    assert.deepEqual(r.kicks, ["kick"]);
    t.done();
  });

  it("does not ask when a run is at work, or for any other kind, or with no node known", async () => {
    const t = setup();
    worldOf(t);
    let r = await on(t, { agentPid: () => 4242, agentNode: () => NEW_NODE });
    assert.equal(r.said.at(-1), NEW_NODE_LINE);
    assert.deepEqual(r.kicks, []);
    r = await on(t, { agentNode: () => "" });
    assert.deepEqual([r.said, r.kicks], [[NEWEST], []]);
    note(t, { drop: place(t, "refused") });
    r = await on(t, { agentNode: () => NEW_NODE });
    assert.deepEqual(r.kicks, []);
    t.done();
  });

  it("does not ask when the lock holds a live pid", async () => {
    const t = setup();
    worldOf(t);
    const lock = lockFile(dropOf(t), runsFolder(t.home));
    mkdirSync(dirname(lock), { recursive: true });
    writeFileSync(lock, String(process.pid));
    const r = await on(t, { agentPid: () => null, agentNode: () => NEW_NODE, alive: (pid) => pid === process.pid });
    assert.equal(r.said.at(-1), NEW_NODE_LINE);
    assert.deepEqual(r.kicks, []);
    t.done();
  });

  it("says the line though the kick throws", async () => {
    const t = setup();
    worldOf(t);
    const r = await on(t, { agentNode: () => NEW_NODE, kickstart: () => { throw new Error("no"); } });
    assert.equal(r.said.at(-1), NEW_NODE_LINE);
    t.done();
  });

  it("works out no node (no plutil) when another finding is to be said", async () => {
    const t = setup();
    worldOf(t);
    note(t, { drop: place(t, "refused", { okNode: NODE }), episodes: place(t, "ok", { okNode: NODE, folder: t.ctx.episodes }) });
    let asked = 0;
    const r = await on(t, { agentNode: () => { asked++; return NEW_NODE; } });
    assert.equal(asked, 0);
    assert.match(r.said.at(-1), /does not let the import look/);
    t.done();
  });

  it("asks nothing of a Mac whose places need no Files and Folders access", async () => {
    const t = setup();
    note(t, { drop: place(t, "ok", { okNode: NODE }) });
    let asked = 0;
    const r = await on(t, { agentNode: () => { asked++; return NEW_NODE; } });
    assert.equal(asked, 0);
    assert.deepEqual(r.said, [NEWEST]);
    t.done();
  });
});

describe("behind: a video the import never took", () => {
  const UNSEEN = (n) => accessLine({ kind: "unseen", videos: Array(n).fill("v") }, {});

  it("is counted when no run is at work", async () => {
    const t = setup();
    const a = video(t, "a.mp4");
    let r = await on(t, { now: a.clock, agentPid: () => null });
    assert.equal(r.said.at(-1), UNSEEN(1));
    const b = video(t, "b.mov");
    r = await on(t, { now: () => Math.max(a.clock(), b.clock()), agentPid: () => null });
    assert.equal(r.said.at(-1), UNSEEN(2));
    assert.ok(!r.text.includes("a.mp4") && !r.text.includes("b.mov"));
    t.done();
  });

  it("says nothing of a video that is too young, noted, held, failed or looked at", async () => {
    const t = setup();
    const v = video(t);
    const none = async (more) => (await on(t, { now: v.clock, agentPid: () => null, ...more })).said;
    assert.deepEqual(await none({ now: () => statSync(v.file).ctimeMs + UNSEEN_MS - 60000 }), [NEWEST]);
    // seen.json
    const id = statSync(v.file);
    mkdirSync(dirname(seenFile(t.home)), { recursive: true });
    writeFileSync(seenFile(t.home), JSON.stringify({ [seenKey("talk.mp4", id)]: { path: v.file, at: 1 } }));
    assert.deepEqual(await none(), [NEWEST]);
    writeFileSync(seenFile(t.home), "{}");
    assert.equal((await none()).at(-1), UNSEEN(1));
    // a status of this Mac, held or failed
    for (const more of [{ failed: "it failed" }, { held: "it is held" }]) {
      writeStatusIn(importingFolderOf(settingsOf(t), t.home), { version: 1, machine: "Mac Studio", pid: 99, video: "talk.mp4", bytes: 5, seconds: null, step: "Waiting", at: new Date(v.clock()).toISOString(), ...more }, (to, text) => writeFileSync(to, text));
      assert.deepEqual(await none(), [NEWEST]);
      const folder = importingFolderOf(settingsOf(t), t.home);
      for (const f of readdirSync(folder)) rmSync(join(folder, f));
    }
    // an ok drop look after its ctime
    note(t, { drop: place(t, "ok", { at: v.clock() - 1000 }) });
    assert.deepEqual(await none(), [NEWEST]);
    note(t, { drop: place(t, "ok", { at: statSync(v.file).ctimeMs - 1000 }) });
    assert.equal((await none()).at(-1), UNSEEN(1));
    t.done();
  });

  it("a Downloads refusal within 24 hours does not hide an unseen video", async () => {
    const t = setup();
    const v = video(t);
    note(t, { downloads: place(t, "refused", { folder: downloadsFolder(t.home), at: v.clock() - 3600000 }) });
    const r = await on(t, { now: v.clock, agentPid: () => null });
    assert.equal(r.said.at(-1), UNSEEN(1));
    t.done();
  });

  it("says nothing of a video while a run is at work", async () => {
    const t = setup();
    const v = video(t, "talk.mp4", 10);
    assert.deepEqual((await on(t, { now: v.clock, agentPid: () => 4242 })).said, [NEWEST]);
    const lock = lockFile(dropOf(t), runsFolder(t.home));
    mkdirSync(dirname(lock), { recursive: true });
    writeFileSync(lock, String(process.pid));
    assert.deepEqual((await on(t, { now: v.clock, agentPid: () => null, alive: (pid) => pid === process.pid })).said, [NEWEST]);
    assert.equal((await on(t, { now: v.clock, agentPid: () => null, alive: () => false })).said.at(-1), UNSEEN(1));
    t.done();
  });

  it("an ok look at an old drop folder does not hide an unseen video in the new one", async () => {
    const t = setup();
    const v = video(t);
    note(t, { drop: place(t, "ok", { at: v.clock() - 1000, folder: join(t.dir, "old drop") }) });
    assert.equal((await on(t, { now: v.clock, agentPid: () => null })).said.at(-1), UNSEEN(1));
    note(t, { drop: place(t, "ok", { at: v.clock() - 1000 }) });
    assert.deepEqual((await on(t, { now: v.clock, agentPid: () => null })).said, [NEWEST]);
    t.done();
  });

  it("a drop folder it cannot stat into, or a looping link named like a video, ends as with no finding", async () => {
    const t = setup();
    const v = video(t);
    const clock = v.clock();
    chmodSync(dropOf(t), 0o444);
    try {
      const r = await on(t, { now: () => clock, agentPid: () => null });
      assert.equal(r.code, 0);
      assert.equal(r.said.at(-1), NEWEST);
    } finally {
      chmodSync(dropOf(t), 0o755);
    }
    rmSync(v.file);
    symlinkSync("loop.mp4", join(dropOf(t), "loop.mp4"));
    const r = await on(t, { now: () => Date.now() + 10 * 60000, agentPid: () => null });
    assert.equal(r.code, 0);
    assert.equal(r.said.at(-1), NEWEST);
    t.done();
  });

  it("never looks in another Mac's drop folder", async () => {
    const t = setup();
    const other = join(t.root, "Unedited Video", "Sallie's laptop");
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, "theirs.mp4"), "12345");
    const clock = () => statSync(join(other, "theirs.mp4")).ctimeMs + 600000;
    assert.deepEqual((await on(t, { now: clock, agentPid: () => null })).said, [NEWEST]);
    t.done();
  });

  it("asks for the agent's pid only when it could matter", async () => {
    const t = setup();
    let asked = 0;
    const agentPid = () => { asked++; return null; };
    await on(t, { agentPid });
    assert.equal(asked, 0);
    video(t);
    await on(t, { agentPid, now: video(t).clock });
    assert.equal(asked, 1);
    t.done();
  });

  it("an unreadable drop folder says nothing of unseen", async () => {
    const t = setup();
    const v = video(t);
    const clock = v.clock();
    chmodSync(dropOf(t), 0o000);
    try {
      assert.deepEqual((await on(t, { now: () => clock, agentPid: () => null })).said, [NEWEST]);
    } finally {
      chmodSync(dropOf(t), 0o755);
    }
    t.done();
  });
});

describe("behind: no real launchctl or plutil", () => {
  it("a Mac with neither stand-in, given agentRunning, reaches neither", async () => {
    const t = setup();
    writeSettings(t.home, { dropPath: join(t.dir, "local", "Drop") });
    mkdirSync(dropOf(t), { recursive: true });
    note(t, { drop: place(t, "ok", { okNode: NODE }) }, { looking: { place: "drop", pid: -1, at: t.now() - ASKING_MS - 1000 } });
    const said = [];
    const { agentPid, agentNode, ...deps } = t.ctx.deps;
    const code = await editMain(["behind"], { ...deps, agentRunning: () => true, run: upToDate, say: (x) => said.push(x) });
    assert.equal(code, 0);
    // agentRunning stood in for the pid (-1 while it runs), so the asking finding was reached without launchctl.
    assert.equal(said.at(-1), accessLine({ kind: "asking", place: "drop" }, { placeWords: dropWordsOf(t) }));
    t.done();
  });

  it("a Mac whose drop folder needs access, with a real plist in its home, does not reach the real plutil", async () => {
    const t = setup();
    writeSettings(t.home, { dropPath: join(t.home, "Desktop", "Drop") });
    mkdirSync(dropOf(t), { recursive: true });
    note(t, { drop: place(t, "ok", { okNode: NODE }) });
    const agents = join(t.home, "Library", "LaunchAgents");
    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, "com.thebrimm.unedited.plist"), `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>ProgramArguments</key><array><string>${process.execPath}</string></array></dict></plist>\n`);
    const said = [];
    const { agentPid, agentNode, ...deps } = t.ctx.deps;
    const code = await editMain(["behind"], { ...deps, agentRunning: () => false, run: upToDate, say: (x) => said.push(x) });
    assert.equal(code, 0);
    assert.deepEqual(said, [NEWEST]);
    t.done();
  });
});
