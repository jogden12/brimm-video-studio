// The guide (spec 2026-10-25): its one next step for each video under way, in her words. Each test has a root and a home of its own;
// openApp and run are stand-ins, and nothing opens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain, HELP } from "../edit.js";
import { readGuideNotes, writeGuideNotes, guideFile } from "../guide-note.js";
import { NOT_SET_UP, OPS_PAGE } from "../guide.js";
import { localStamp } from "../episode.js";
import { writeStatus } from "../importing.js";
import { progressFolder } from "../progress.js";
import { setup, episodeAs, otherMac } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}
/** This Mac on the light import, its drop folder switched to Drop, handing off version 2; `over` lays other deps on it. */
const light = (t, over = {}) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, ...over });
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: "2026-10-20T08:00:00-05:00", private: "no" };
const READ = (kind) => ({ kind, model: "m", at: "2026-10-20T08:05:00-05:00", on: "Mac Studio", account: "a", outcome: "read" });
const OFFERS = { spellings: [], answered: { reading: "2026-10-20T08:05:00-05:00", at: "2026-10-20T08:06:00-05:00", on: "Mac Studio", applied: [], left: [] } };
const imported = (time) => ({ imported: { on: "Mac Studio", at: `2026-10-20T${time}:00-05:00` } });
const MAIN = (pushed) => ({ preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed });
const MARK = { marked: "2026-10-20T08:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
const VIDEOS = {
  waiting: { id: "e-20261020-aaaaaa", name: "2026-10-20 Coaching call Jane Doe (Mac Studio)", record: { kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00", came: "camera", match: null }, label: "Video of 20 Oct, 09:00 (Mac Studio)", ...imported("09:00") } },
  read: { id: "e-20261020-bbbbbb", name: "2026-10-20 Pricing talk (Mac Studio)", record: { kind: "finished", answer: ANSWERED, reading: READ("finished"), name: { text: "Pricing talk", placeholder: false }, ...imported("12:00") } },
  raw: { id: "e-20261020-cccccc", name: "2026-10-20 Morning talk (Mac Studio)", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Morning talk", placeholder: false }, main: MAIN([{ v: 0, at: "2026-10-20T08:05:00-05:00", on: "Mac Studio", file: "edit/main.v0.fcpxml", how: "render" }]), ...imported("11:00") } },
  session: { id: "e-20261020-dddddd", name: "2026-10-20 Group call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: MARK, ...imported("10:00") } },
  old1: { id: "e-20261014-eeeeee", name: "2026-10-14 Old talk (Mac Studio)" },
  old2: { id: "e-20261015-ffffff", name: "2026-10-15 Older talk (Mac Studio)" },
  archived: { id: "e-20261016-0a0a0a", name: "2026-10-16 Archived (Mac Studio)", record: { archived: { at: "2026-10-17T09:00:00-05:00" } } },
  left: { id: "e-20261020-0b0b0b", name: "2026-10-20 Left (Mac Studio)", record: { kind: null, answer: { state: "not for brimm-video", guess: null, seen: "", came: null, match: null }, label: "Video of 20 Oct, 07:00 (Mac Studio)" } },
  transcript: { id: "e-20261019-0c0c0c", name: "2026-10-19 Team call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 19 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-19", placeholder: false }, session: { ...MARK, teachings: "transcript only" }, ...imported("07:30") } }
};
/** A finished video handed off: its record, and its hand-off (version 2) in final/. */
function handedOff(t, { id = "e-20261020-a1a1a1", name = "2026-10-20 Launch talk (Mac Studio)", text = "Launch talk", kind = "finished", revision = 1, under = id, at = "2026-10-20T13:00:00-05:00", over = {} } = {}) {
  const handoff = `final/${text}.brimm-ops.json`;
  const found = episodeAs(t, { id, name, record: { kind, answer: ANSWERED, reading: READ(kind), offers: OFFERS, name: { text, placeholder: false }, finished: { revision, at, on: "Mac Studio", handoff, parts: {} }, ...imported("12:30"), ...over } });
  mkdirSync(join(found.folder, "final"), { recursive: true });
  writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision, video: { id: under, kind, name: text }, main: { file: `${text}.mov` } }));
  return found;
}
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const TAKE = '  Launch talk (a1a1a1): On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
const NO_FIT = 'No video under way fits that. Say "what\'s next?" to see the ones that are.';

describe("guide on a Mac not on the light import", () => {
  it("says only to ask Jason, for every form, ends with 1, and opens, runs and waits for nothing", async () => {
    const t = setup();
    for (const words of [[], ["drop"], ["drop", "zoom"], ["page"], ["wait"], ["X"], ["X", "done", "taken"], ["X", "finished"], ["X", "show"]]) {
      assert.deepEqual(await on(t.ctx.deps, "guide", ...words), { code: 1, said: [NOT_SET_UP] }, words.join(" "));
    }
    assert.deepEqual([t.opened, t.calls, t.waits], [[], [], []]);
    t.done();
  });
});

describe("guide, from the records", () => {
  it("says the drop folder in Finder words, and that nothing is under way", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."] });
    const laptop = setup({ machine: "Sallie's laptop" });
    const r = await on({ ...laptop.ctx.deps, settings: { ...laptop.ctx.settings, import: "light" } }, "guide");
    assert.equal(r.said[0], "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Unedited Video › Sallie's laptop");
    t.done();
    laptop.done();
  });
  it("lists each video under way, waiting for her answer first, then newest first, a gated one by its label, and counts the old ones", async () => {
    const t = setup();
    for (const v of Object.values(VIDEOS)) episodeAs(t, v);
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [
      DROP_LINE, "Under way:",
      '  Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.',
      '  Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.',
      '  Morning talk (cccccc): Ask for any changes in your own words, then say "show it in Final Cut".',
      "  Session, 2026-10-20 (dddddd): Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.",
      "2 videos from before the switch are not guided."
    ] });
    t.done();
  });
  it("gives one video's step by its label, name or short id, says a done one is done, and never repeats words that fit none", async () => {
    const t = setup();
    for (const v of Object.values(VIDEOS)) episodeAs(t, v);
    assert.deepEqual(await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)"), { code: 0, said: ['Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.'] });
    assert.equal((await on(light(t), "guide", "Pricing talk")).said[0], 'Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.');
    assert.equal((await on(light(t), "guide", "cccccc")).said[0].split(":")[0], "Morning talk (cccccc)");
    assert.deepEqual(await on(light(t), "guide", "Session, 2026-10-19"), { code: 0, said: ["Session, 2026-10-19 (0c0c0c) is done: nothing is left to do for it."] });
    for (const said of ["Coaching call Jane Doe", "2026-10-20 Coaching call Jane Doe (Mac Studio)", "eeeeee"]) assert.deepEqual(await on(light(t), "guide", said), { code: 1, said: [NO_FIT] }, said);
    t.done();
  });
  it("gives a handed-off video's BRIMM Ops step from her note, the one after it, and drops it after 60 days", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Under way:", TAKE]);
    assert.deepEqual((await on(light(t), "guide", "Launch talk")).said, [TAKE.trim(), 'Then: Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.', "Step: taken"]);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.equal((await on(light(t), "guide")).said[2], '  Launch talk (a1a1a1): On the BRIMM Ops page: Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".');
    const later = light(t, { now: () => Date.parse("2026-12-20T15:00:00-05:00") });
    assert.deepEqual((await on(later, "guide")).said, [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."]);
    t.done();
  });
  it("lists two versions under one hand-off id once, by the newest hand-off: drop the new one on the same episode", async () => {
    const t = setup();
    const first = handedOff(t);
    handedOff(t, { id: "e-20261021-a2a2a2", name: "2026-10-21 Launch talk again (Mac Studio)", text: "Launch talk again", revision: 2, under: first.record.id, at: "2026-10-21T13:00:00-05:00", over: { versionOf: first.record.id } });
    writeGuideNotes(t.home, { version: 1, handoffs: { [first.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Under way:", '  Launch talk again (a2a2a2): On the BRIMM Ops page: Drag the new hand-off onto the same episode, then press "Take the hand-off".']);
    t.done();
  });
  it("still lists an older version held as a session when the newer one's hand-off goes out under its id, by its label, and finds it only by its label or id", async () => {
    const t = setup();
    const label = "Video of 20 Oct, 12:30 (Mac Studio)";
    const older = handedOff(t, { over: { label } });
    // Its newer version, a session after all: the empty revision goes out under the older one's id, which is held as a session.
    const rel = "final/Session, 2026-10-20.brimm-ops.json";
    const newer = episodeAs(t, { id: "e-20261020-a2a2a2", name: "2026-10-20 Launch talk again (Mac Studio)", record: { ...VIDEOS.session.record, versionOf: older.record.id, session: { ...MARK, emptyRevision: 2 }, finished: { revision: 2, at: "2026-10-20T14:00:00-05:00", on: "Mac Studio", handoff: rel, parts: {} }, ...imported("13:30") } });
    mkdirSync(join(newer.folder, "final"), { recursive: true });
    writeFileSync(join(newer.folder, rel), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 2, video: { id: older.record.id, kind: "session", name: "Session, 2026-10-20" } }));
    const held = `${label} (a1a1a1): One of its other versions is a client or group session. Say "it was a session after all" for this one too.`;
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [
      DROP_LINE, "Under way:",
      '  Session, 2026-10-20 (a2a2a2): On the BRIMM Ops page: Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.',
      `  ${held}`
    ] });
    for (const said of [label, "a1a1a1"]) assert.deepEqual(await on(light(t), "guide", said), { code: 0, said: [held] }, said);
    // Never by its name or its folder's, which may be its file's.
    for (const said of ["Launch talk", older.name]) assert.deepEqual(await on(light(t), "guide", said), { code: 1, said: [NO_FIT] }, said);
    t.done();
  });
  it("reads a hand-off of a kind brimm-video never writes from the record, and does not stop at it", async () => {
    const t = setup();
    const h = handedOff(t);
    writeFileSync(join(h.folder, "final/Launch talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: h.record.id, kind: "film", name: "Launch talk" } }));
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [DROP_LINE, "Under way:", TAKE] });
    t.done();
  });
  it("says a video open, or being answered, on the other Mac is on that Mac; and her note on this Mac does not follow a video there", async () => {
    const t = setup();
    const away = { by: "Sallie's laptop", since: "2026-10-20T12:05:00-05:00" };
    episodeAs(t, { ...VIDEOS.read, record: { ...VIDEOS.read.record, editing: away } });
    episodeAs(t, { ...VIDEOS.waiting, record: { ...VIDEOS.waiting.record, editing: away } });
    assert.equal((await on(light(t), "guide", "Pricing talk")).said[0], "Pricing talk (bbbbbb): It is open on Sallie's laptop. Carry on there, or open it here and take it over.");
    assert.equal((await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)")).said[0], "Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is being answered on Sallie's laptop. Carry on there.");
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.equal((await on(light(t), "guide", "Launch talk")).said.at(-1), "Step: posted");
    // Her laptop: the same root, a home of its own (otherMac), on the light import. The Mac Studio's note is not read there.
    const laptop = otherMac(t);
    const there = { ...laptop.deps, settings: { ...laptop.settings, import: "light", drop: "Drop", handoffVersion: 2 } };
    assert.equal((await on(there, "guide", "Launch talk")).said.at(-1), "Step: taken");
    t.done();
  });
  it("gives a video that was a session after all its withdrawal on Principles first, whatever her note says, and then the session's own step", async () => {
    const t = setup();
    const rel = "final/Session, 2026-10-20.brimm-ops.json";
    const found = episodeAs(t, { ...VIDEOS.session, record: { ...VIDEOS.session.record, session: { ...MARK, emptyRevision: 2 }, finished: { revision: 2, at: "2026-10-20T13:30:00-05:00", on: "Mac Studio", handoff: rel, parts: {} } } });
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, rel), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 2, video: { id: found.record.id, kind: "session", name: "Session, 2026-10-20" } }));
    writeGuideNotes(t.home, { version: 1, handoffs: { [found.record.id]: { kind: "episode", step: "cascade", revision: 1, at: "2026-10-19T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual((await on(light(t), "guide", "Session, 2026-10-20")).said, [
      'Session, 2026-10-20 (dddddd): On the BRIMM Ops page: Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.',
      "Then: Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.",
      "Step: withdrawn"
    ]);
    t.done();
  });
});

const writeText = (to, text) => writeFileSync(to, text);
const dropIn = (t, mac, name, text = "video") => {
  const dir = join(t.root, "Drop", mac);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text);
};
const statusOf = (t, over) => writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, bytes: 5, seconds: null, step: "Reading the sound", at: "2026-10-20T14:58:00-05:00", ...over }, writeText);

describe("guide, from the drop folders", () => {
  it("names each video waiting there by its label or what it is, says its step, and leaves out one an episode holds", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    dropIn(t, "Mac Studio", "Second.mov");
    statusOf(t, { import: "a1", video: "Second.mov", step: "Writing the transcript", label: "Video of 20 Oct, 14:58 (Mac Studio)", pid: 4242 });
    mkdirSync(progressFolder(t.home), { recursive: true });
    writeFileSync(join(progressFolder(t.home), "4242.json"), JSON.stringify({ version: 1, pid: 4242, video: "Video of 20 Oct, 14:58 (Mac Studio)", step: "Writing the transcript", n: 2, of: 4, percent: 40, left: 180, total: 360, detail: "", started: 0, updated: 0 }));
    dropIn(t, "Mac Studio", "Third.mov");
    statusOf(t, { import: "a2", video: "Third.mov", label: "Video of 20 Oct, 14:00 (Mac Studio)", at: "2026-10-20T14:00:00-05:00", failed: "the sound could not be read" });
    dropIn(t, "Mac Studio", "GMT20261020-140000_Recording.mp4");
    statusOf(t, { import: "a3", video: "GMT20261020-140000_Recording.mp4", label: "GMT20261020-140000_Recording", step: "Held", held: "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer." });
    dropIn(t, "Sallie's laptop", "Other.mov", "other video");
    dropIn(t, "Mac Studio", "Filed.mov");
    statusOf(t, { import: "a4", video: "Filed.mov", step: "Waiting for its late check" });
    episodeAs(t, { ...VIDEOS.waiting, record: { ...VIDEOS.waiting.record, video: { file: "Filed.mov", bytes: 5, seconds: 120, recorded: "2026-10-20", recordedFrom: "import" } } });
    const r = await on(light(t, { alive: (pid) => pid === 4242 }), "guide");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(0, 3), [DROP_LINE, "Under way:", '  Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.']);
    assert.deepEqual(r.said.slice(3).sort(), [
      '  A video of 11 bytes: It is in the drop folder of Sallie\'s laptop. Wait for the "Ready" notice on that Mac.',
      '  A video of 5 bytes: It is coming into your drop folder. Wait for the "Ready" notice.',
      "  GMT20261020-140000_Recording: It is a Zoom download, and those go in Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer. Move it there in Finder.",
      '  Video of 20 Oct, 14:00 (Mac Studio): Its import did not finish. Say "try it again".',
      '  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'
    ]);
    assert.doesNotMatch(r.said.join("\n"), /Jane|Client|Second|Third|Other|Filed|\.mov|\.mp4/);
    t.done();
  });
  it("says a video being imported, or whose import did not finish, on the other Mac is on that Mac, with no time left from this Mac's panel", async () => {
    const t = setup();
    dropIn(t, "Sallie's laptop", "Other.mov", "other video");
    statusOf(t, { import: "c1", machine: "Sallie's laptop", video: "Other.mov", bytes: 11, step: "Writing the transcript", label: "Video of 20 Oct, 14:50 (Sallie's laptop)", pid: 4343 });
    // A run in this Mac's panel under the same label, alive: its time is this Mac's, never the other Mac's video's.
    mkdirSync(progressFolder(t.home), { recursive: true });
    writeFileSync(join(progressFolder(t.home), "4343.json"), JSON.stringify({ version: 1, pid: 4343, video: "Video of 20 Oct, 14:50 (Sallie's laptop)", step: "Writing the transcript", n: 2, of: 4, percent: 40, left: 180, total: 360, detail: "", started: 0, updated: 0 }));
    dropIn(t, "Sallie's laptop", "Another.mov", "other video");
    statusOf(t, { import: "c2", machine: "Sallie's laptop", video: "Another.mov", bytes: 11, label: "Video of 20 Oct, 14:40 (Sallie's laptop)", at: "2026-10-20T14:40:00-05:00", failed: "the sound could not be read" });
    const r = await on(light(t, { alive: (pid) => pid === 4343 }), "guide");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(2).sort(), [
      "  Video of 20 Oct, 14:40 (Sallie's laptop): Its import did not finish on Sallie's laptop. Say \"try it again\" on that Mac.",
      "  Video of 20 Oct, 14:50 (Sallie's laptop): It is being imported on Sallie's laptop, at writing the transcript. Wait for the \"Ready\" notice on that Mac."
    ]);
    assert.doesNotMatch(r.said.join("\n"), /Other|Another|\.mov|minute/);
    t.done();
  });
  // Not in the plan's tests: the other ways an import does not finish, and the size a running import or a hold is taken at.
  it("says an import that stopped, or whose late check found a problem, did not finish, and takes a running import or a hold of another size for another recording", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Stopped.mov");
    statusOf(t, { import: "b1", video: "Stopped.mov", label: "Video of 20 Oct, 13:00 (Mac Studio)", at: "2026-10-20T13:00:00-05:00" });
    dropIn(t, "Mac Studio", "Checked.mov");
    statusOf(t, { import: "b2", video: "Checked.mov", label: "Video of 20 Oct, 12:00 (Mac Studio)", step: "Waiting for its late check", problem: "a copy did not match" });
    // Dropped again under the same name, longer: the import and the hold were of the first, and give it no label.
    dropIn(t, "Mac Studio", "Again.mov", "a longer video");
    statusOf(t, { import: "b3", video: "Again.mov", label: "Video of 20 Oct, 14:30 (Mac Studio)", step: "Writing the transcript" });
    dropIn(t, "Mac Studio", "GMT20261020-150000_Recording.mp4", "a longer video");
    statusOf(t, { import: "b4", video: "GMT20261020-150000_Recording.mp4", label: "GMT20261020-150000_Recording", step: "Held", held: "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer." });
    const r = await on(light(t), "guide");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(2).sort(), [
      '  A Zoom download of 14 bytes: It is coming into your drop folder. Wait for the "Ready" notice.',
      '  A video of 14 bytes: It is coming into your drop folder. Wait for the "Ready" notice.',
      '  Video of 20 Oct, 12:00 (Mac Studio): Its import did not finish. Say "try it again".',
      '  Video of 20 Oct, 13:00 (Mac Studio): Its import did not finish. Say "try it again".'
    ]);
    t.done();
  });
});

describe("guide opens a folder, the page, or a file's place in Finder", () => {
  it("opens this Mac's drop folder in Finder and says its Finder words, or why not", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "drop"), { code: 1, said: ["Your drop folder is not there: ask Jason."] });
    mkdirSync(join(t.root, "Drop", "Mac Studio"), { recursive: true });
    assert.deepEqual(await on(light(t), "guide", "drop"), { code: 0, said: ["Opened your drop folder in Finder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio."] });
    assert.deepEqual(t.opened, [["Finder", join(t.root, "Drop", "Mac Studio")]]);
    const broken = light(t, { openApp: () => { throw new Error("Finder could not be opened (/x/y)"); } });
    assert.deepEqual(await on(broken, "guide", "drop"), { code: 1, said: ["Finder could not open your drop folder: ask Jason."] });
    t.done();
  });
  it("opens Zoom Video Transfer, beside BRIMM Video, or says to ask Jason", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "drop", "zoom"), { code: 1, said: ["Zoom Video Transfer is not on this Mac: ask Jason."] });
    const zoom = join(dirname(t.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer");
    mkdirSync(zoom, { recursive: true });
    assert.deepEqual(await on(light(t), "guide", "drop", "zoom"), { code: 0, said: ["Opened Zoom Video Transfer in Finder: Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer."] });
    assert.deepEqual(t.opened, [["Finder", zoom]]);
    t.done();
  });
  it("opens the BRIMM Ops page, a constant, in the default browser, or says to ask Jason", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "page"), { code: 0, said: ["Opened the BRIMM Ops page in your browser."] });
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: [OPS_PAGE] }]);
    assert.deepEqual(await on(light(t, { run: async () => ({ code: 1, stderr: "no" }) }), "guide", "page"), { code: 1, said: ["The BRIMM Ops page could not be opened: ask Jason."] });
    t.done();
  });
  it("shows in Finder what the step needs: the hand-off, then the video to post; and nothing for a step of brimm-video's", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "show"), { code: 0, said: ["Shown in Finder: the hand-off of Launch talk (a1a1a1)."] });
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    writeFileSync(join(h.folder, "Talk.mp4"), "the video she dropped");
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "show"), { code: 0, said: ["Shown in Finder: the video of Launch talk (a1a1a1), to post."] });
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(h.folder, "final", "Launch talk.brimm-ops.json")] }, { cmd: "/usr/bin/open", args: ["-R", join(h.folder, "Talk.mp4")] }]);
    const raw = handedOff(t, { id: "e-20261020-a3a3a3", name: "2026-10-20 Raw talk (Mac Studio)", text: "Raw talk", kind: "raw" });
    writeGuideNotes(t.home, { version: 1, handoffs: { [raw.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual(await on(light(t), "guide", "Raw talk", "show"), { code: 1, said: ["The video of Raw talk (a3a3a3) is not on this Mac: ask Jason."] });
    writeFileSync(join(raw.folder, "final", "Raw talk.mov"), "its Share");
    assert.equal((await on(light(t), "guide", "Raw talk", "show")).code, 0);
    assert.deepEqual(t.calls.at(-1), { cmd: "/usr/bin/open", args: ["-R", join(raw.folder, "final", "Raw talk.mov")] });
    episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "show"), { code: 1, said: ["There is nothing to show in Finder for Pricing talk (bbbbbb) now."] });
    t.done();
  });
  // Not in the plan's tests: a raw hand-off read from the record names no Share, and final/ itself is never shown in its place.
  it("says the video to post is not on this Mac when its hand-off names none", async () => {
    const t = setup();
    const raw = handedOff(t, { id: "e-20261020-a3a3a3", name: "2026-10-20 Raw talk (Mac Studio)", text: "Raw talk", kind: "raw" });
    writeFileSync(join(raw.folder, "final/Raw talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: raw.record.id, kind: "film", name: "Raw talk" } }));
    writeGuideNotes(t.home, { version: 1, handoffs: { [raw.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual(await on(light(t), "guide", "Raw talk", "show"), { code: 1, said: ["The video of Raw talk (a3a3a3) is not on this Mac: ask Jason."] });
    assert.deepEqual(t.calls, []);
    t.done();
  });
});

describe("guide wait", () => {
  /** Have the clock's wait stand-in do `then` once, on the `n`th wait. */
  const onWait = (t, n, then) => {
    let count = 0;
    const wait = t.ctx.deps.wait;
    return async (ms) => {
      await wait(ms);
      if (++count === n) then();
    };
  };
  it("waits in steps of 5 seconds until what the guide says changes, then says it", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    const wait = onWait(t, 2, () => statusOf(t, { import: "b1", video: "Client Jane.mov", label: "Video of 20 Oct, 15:00 (Mac Studio)", at: "2026-10-20T15:00:10-05:00" }));
    const r = await on(light(t, { wait }), "guide", "wait");
    assert.deepEqual(r, { code: 0, said: [DROP_LINE, "Under way:", '  Video of 20 Oct, 15:00 (Mac Studio): It is being imported, at reading the sound. Wait for the "Ready" notice.'] });
    assert.deepEqual(t.waits, [5000, 5000]);
    t.done();
  });
  it("gives up after 90 seconds, says nothing changed, and says the guide's lines; the time left or a growing file is no change", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    const wait = onWait(t, 3, () => writeFileSync(join(t.root, "Drop", "Mac Studio", "Client Jane.mov"), "a video, still copying in"));
    const r = await on(light(t, { wait }), "guide", "wait");
    assert.equal(r.code, 0);
    assert.equal(r.said[0], "Nothing has changed in 90 seconds.");
    assert.deepEqual(r.said.slice(1, 3), [DROP_LINE, "Under way:"]);
    assert.deepEqual(t.waits, Array(18).fill(5000));
    t.done();
  });
});

const TAKE_TEXT = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
describe("guide notes her word", () => {
  it("notes only the step that comes next, then says the next one", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "done", "posted"), { code: 1, said: [`Not noted: the next step for Launch talk (a1a1a1) is taken. ${TAKE_TEXT}`] });
    assert.ok(!existsSync(guideFile(t.home)));
    const r = await on(light(t), "guide", "Launch talk", "done", "taken");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(0, 2), ["Noted: Launch talk (a1a1a1), taken.", 'Launch talk (a1a1a1): On the BRIMM Ops page: Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.']);
    assert.equal(r.said.at(-1), "Step: kit");
    assert.deepEqual(readGuideNotes(t.home).handoffs, { [h.record.id]: { kind: "episode", step: "taken", revision: 1, at: localStamp(new Date(t.now())) } });
    // Said again, it is not noted twice.
    assert.equal((await on(light(t), "guide", "Launch talk", "done", "taken")).said[0].startsWith("Not noted: the next step for Launch talk (a1a1a1) is kit."), true);
    t.done();
  });
  it("says a video with the last step noted is done, and the overview leaves it out", async () => {
    const t = setup();
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "live", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "done", "cascade"), { code: 0, said: ["Noted: Launch talk (a1a1a1), cascade.", "Launch talk (a1a1a1) is done: nothing is left to do for it."] });
    assert.equal((await on(light(t), "guide")).said[1], "Nothing is under way. To start, put the video in your drop folder.");
    t.done();
  });
  it("refuses a step for a video whose next step is brimm-video's, and a note that cannot be written", async () => {
    const t = setup();
    episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "done", "taken"), { code: 1, said: ['Not noted: Pricing talk (bbbbbb) has no step on the BRIMM Ops page now. Claude has read it. Say "what did Claude find?", then answer the spellings card.'] });
    handedOff(t);
    mkdirSync(guideFile(t.home), { recursive: true });
    writeFileSync(join(guideFile(t.home), "x"), "");
    const r = await on(light(t), "guide", "Launch talk", "done", "taken");
    assert.equal(r.code, 1);
    assert.match(r.said.join("\n"), /^Not noted: this Mac's note could not be written \([A-Z]+\)\. Ask Jason\.$/);
    t.done();
  });
  it("takes her word that she is done with a video: it is no longer under way", async () => {
    const t = setup();
    const found = episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "finished"), { code: 0, said: ["Pricing talk (bbbbbb) is no longer under way."] });
    assert.deepEqual(readGuideNotes(t.home).finished, { [found.record.id]: localStamp(new Date(t.now())) });
    assert.deepEqual((await on(light(t), "guide", "Pricing talk")).said, ["Pricing talk (bbbbbb) is done: nothing is left to do for it."]);
    dropIn(t, "Mac Studio", "Client Jane.mov");
    assert.deepEqual(await on(light(t), "guide", "A video of 5 bytes", "finished"), { code: 1, said: ["A video of 5 bytes is not imported yet: there is nothing to set aside."] });
    t.done();
  });
  it("refuses her word that she is done with a session after all before its withdrawal, and a word noted before does not hide it", async () => {
    const t = setup();
    const rel = "final/Session, 2026-10-20.brimm-ops.json";
    const found = episodeAs(t, { ...VIDEOS.session, record: { ...VIDEOS.session.record, session: { ...MARK, emptyRevision: 2 }, finished: { revision: 2, at: "2026-10-20T13:30:00-05:00", on: "Mac Studio", handoff: rel, parts: {} } } });
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, rel), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 2, video: { id: found.record.id, kind: "session", name: "Session, 2026-10-20" } }));
    writeGuideNotes(t.home, { version: 1, handoffs: { [found.record.id]: { kind: "episode", step: "cascade", revision: 1, at: "2026-10-19T14:00:00-05:00" } }, finished: {} });
    const before = readFileSync(guideFile(t.home), "utf8");
    const WITHDRAW = 'On the BRIMM Ops page: Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.';
    assert.deepEqual(await on(light(t), "guide", "Video of 20 Oct, 10:00 (Mac Studio)", "finished"), { code: 1, said: [`Not noted: Session, 2026-10-20 (dddddd) cannot be set aside until this is done. ${WITHDRAW}`] });
    assert.equal(readFileSync(guideFile(t.home), "utf8"), before);
    // Her word noted before it was a session after all: the withdrawal is still under way, and its step still said.
    writeGuideNotes(t.home, { ...readGuideNotes(t.home), finished: { [found.record.id]: "2026-10-20T12:00:00-05:00" } });
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Under way:", `  Session, 2026-10-20 (dddddd): ${WITHDRAW}`]);
    assert.equal((await on(light(t), "guide", "Session, 2026-10-20")).said.at(-1), "Step: withdrawn");
    // Once the withdrawal is noted, her word holds again.
    assert.equal((await on(light(t), "guide", "Session, 2026-10-20", "done", "withdrawn")).code, 0);
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."]);
    t.done();
  });
  it("refuses her word that she is done with a video waiting for her answer, and notes nothing", async () => {
    const t = setup();
    episodeAs(t, VIDEOS.waiting);
    assert.deepEqual(await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)", "finished"), { code: 1, said: ['Not noted: Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa) cannot be set aside until this is done. It is waiting for your answer. Say "what\'s waiting?" to see its card.'] });
    assert.ok(!existsSync(guideFile(t.home)));
    t.done();
  });
  // Not in the plan's tests: a step is needed after "done", and nothing more after it or after "finished".
  it("gives the help, and notes nothing, for done with no step, or more words than a form has", async () => {
    const t = setup();
    handedOff(t);
    for (const words of [["done"], ["done", "taken", "kit"], ["finished", "now"], ["taken"]]) {
      assert.deepEqual(await on(light(t), "guide", "Launch talk", ...words), { code: 2, said: [HELP] }, words.join(" "));
    }
    assert.ok(!existsSync(guideFile(t.home)));
    t.done();
  });
});
