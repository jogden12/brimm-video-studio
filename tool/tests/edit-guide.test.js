// The guide (spec 2026-10-25): its one next step for each video under way, in her words. Each test has a root and a home of its own;
// openApp and run are stand-ins, and nothing opens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { writeGuideNotes } from "../guide-note.js";
import { NOT_SET_UP } from "../guide.js";
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
