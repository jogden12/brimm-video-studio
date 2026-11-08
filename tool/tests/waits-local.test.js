// What waits for Dropbox, on an episode kept on this Mac (Phase 3, the local working folder; L4; design D4). Its files are in its video/ folder here, so the import's
// late check holds none of them: a raw answer starts the reading and the copy and says the reading's own words; the HyperFrames project is held only while a read
// run is at work and the record holds no reading yet ("reading"), never to "verify" a check; no time of Dropbox's is named. An episode from before the switch is
// held as it was. Nothing here runs a real program or touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { episodeFilesFolder, episodeWork, writeSettings } from "../settings.js";
import { READ_LOOK_MS } from "../reading.js";
import { noWords } from "../app.js";
import { RAW, world } from "./workcopy-world.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { writePending } from "../filing.js";
import { lateCheckAt, lateWaitFor, projectWaits, readingWaitsUntil, waitFacts } from "../late-wait.js";
import { setup, episodeFor, listAll, ID, FOLDER } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const AT = "2026-10-20T15:00:00-05:00";
const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
const WAITING = { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null }, label: LABEL };
const LOCAL = { version: 6, local: { on: "Mac Studio" } };
const STILL = (name) => `Claude is still reading ${name}. A notice will come on this Mac when it is done: then say "what did Claude find?"`;

/** The import's late check, owed by this Mac, of the made-up episode: as L5 keeps one for the first record of a local episode, or the import for an old one. */
function owe(t, ago = 5 * 60 * 1000) {
  writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: join(t.root, "Episodes", FOLDER), video: "Pricing talk.mp4", bytes: 1, seconds: 120, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - ago, root: t.root, machine: "Mac Studio", planTxt: "x.txt", ...{} });
}
/** A read run at work on the made-up episode now, as a live process holds it. */
function readAtWork(t) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER), "read", () => true).taken, true);
  t.ctx.alive = (pid) => pid === process.pid;
}

describe("the waits of an episode kept on this Mac", () => {
  it("the HyperFrames project is held while a read run is at work and the record holds no reading, and is never to 'verify' a check", () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...WAITING, ...LOCAL, answer: { ...WAITING.answer, state: "answered", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" }, kind: "raw" } });
    owe(t);
    // No run at work: a check owed holds nothing of a local episode.
    assert.equal(projectWaits(t.ctx, { name: FOLDER, record: found.record }), "");
    readAtWork(t);
    assert.equal(projectWaits(t.ctx, { name: FOLDER, record: found.record }), "reading");
    const read = { ...found.record, reading: { kind: "raw", model: "m", at: "2026-10-20T15:05:00-05:00", on: "Mac Studio", account: "a", outcome: "read" } };
    assert.equal(projectWaits(t.ctx, { name: FOLDER, record: read }), "");
    t.done();
  });
  it("an episode from before the switch is held as it was: 'verify' while the check is owed", () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...WAITING, answer: { ...WAITING.answer, state: "answered" }, kind: "raw" } });
    owe(t);
    assert.equal(projectWaits(t.ctx, { name: FOLDER, record: found.record }), "verify");
    t.done();
  });
  it("names no time of Dropbox's: no wait for the copy, none for the reading, none for the check", () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...WAITING, ...LOCAL, kind: "raw" } });
    owe(t);
    assert.equal(waitFacts(t.ctx, found.record, 60), null);
    assert.equal(lateWaitFor(t.ctx, found.record), null);
    assert.equal(readingWaitsUntil(t.ctx, found.record), null);
    assert.equal(lateCheckAt(t.ctx, found.record), null);
    const old = episodeFor(setup(), { record: { ...WAITING, kind: "raw" } });
    t.done();
    assert.ok(old);
  });
});

describe("noWords, for an episode kept on this Mac", () => {
  it("does not blame Dropbox: its words are not whole on this Mac, and Jason is to be asked", () => {
    assert.equal(noWords("Pricing talk", true), "Pricing talk's words are not whole on this Mac. Ask Jason.");
    assert.match(noWords("Pricing talk"), /Dropbox may still be bringing them/);
  });
});

describe("workcopy, of a video kept on this Mac", () => {
  it("reads video/<file> and waits for nothing, with no wait step in the panel, though a check of Dropbox's is owed", async () => {
    const { t, found, raw, paths, guarded, events } = world({ record: { ...RAW, version: 6, local: { on: "Mac Studio" } } });
    // Its files are in its video/ folder on this Mac, as the import of a Mac with a drop folder of its own leaves them.
    const own = episodeFilesFolder(t.home, FOLDER);
    mkdirSync(own, { recursive: true });
    for (const rel of listAll(found.folder).filter((r) => !r.startsWith("record/"))) renameSync(join(found.folder, rel), join(own, rel));
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: "Pricing talk.mp4", bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "x.txt" });
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.waits.filter((ms) => ms === READ_LOOK_MS), []);
    assert.deepEqual(events.filter((e) => e[0] === "step" && /Waiting/.test(e[1])), []);
    assert.equal(guarded.length, 1);
    assert.equal(guarded[0].args[guarded[0].args.indexOf("-i") + 1], join(own, "Pricing talk.mp4"));
    assert.equal(existsSync(paths.video), true);
    assert.ok(raw);
    t.done();
  });
});

describe("kind, a raw answer of a video kept on this Mac", () => {
  it("starts the reading and the copy at once and says the reading's own words, with no time of Dropbox's, while a check is owed", async () => {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    const found = episodeFor(t, { record: { ...WAITING, ...LOCAL } });
    // Its recording is in video/ on this Mac (B1-F12: an answer is refused when it is in neither place).
    mkdirSync(episodeFilesFolder(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeFilesFolder(t.home, FOLDER), found.record.video.file), "the recording");
    owe(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [STILL(LABEL)]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER, "--kind", "raw", "--rev", "2"], ["workcopy", "--now", FOLDER]]);
    t.done();
  });
});
