// finish from HyperFrames' exports and the Reel suggestions (plan PR 8, groups F1 to F4; architecture 2026-10-27, section 8.6): a raw video's
// hand-off holds the suggestions of reels.json that nobody has made into a Reel, placed in the exported main video by `inMain`, on the export's
// clock; the ones that do not fall in it are left out, and the result says so. It runs in the made-up world of exports-world.js, with stand-ins
// for ffprobe, ffmpeg and the transcriber; nothing here runs a program or touches Dropbox, the app or the real Downloads folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finishEpisode } from "../edit.js";
import { recordFile, recordText } from "../episode.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { EDITED, PROJECT, reread } from "./episodes.js";
import { CANDIDATES, FOUR, MAIN_WORDS, ONE, THREE, TWO, exportOf, fw, suggestion as candidate } from "./exports-world.js";

const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const RAW_FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-raw.json", import.meta.url), "utf8"));
const handoffOf = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
/** The record's Reels as the made-up episode has them (1 a candidate, 2 picked), 3 and 4 with no entry, or with these statuses. */
const reelsWith = (statuses) => statuses.map(([n, status]) => ({ n, status, from: 0, to: 1, title: `Reel ${n}`, why: "", files: [], pushed: [] }));

/** The made-up world with both exports in Downloads and these suggestions. */
function ready(options = {}) {
  const w = fw({ candidates: CANDIDATES, ...options });
  exportOf(w, "main");
  exportOf(w, "reel 2");
  return w;
}
async function asked(w, answers = {}) {
  assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true, ...answers }), 0, w.t.said());
  return { ...w.found, record: reread(w.found) };
}
async function finished(w, answers = {}) {
  const found = await asked(w, answers);
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { found, result };
}
const numbers = (handoff) => (handoff.suggestions || []).map((s) => s.n);

describe("F1. the suggestions in the hand-off", () => {
  it("holds the unmade suggestions that fall in the main video, on its clock, and the Reel by its fromSuggestion, and passes the contract's check", async () => {
    const w = ready();
    const { found, result } = await finished(w);
    const handoff = handoffOf(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(numbers(handoff), [1, 3], "2 is picked, and finished by this finish; 4 is not in the main video");
    assert.deepEqual(handoff.suggestions[0], { n: 1, start: 0, end: 3.9, stretches: [{ start: 0, end: 3.9 }], first: "Welcome to the show", last: "talk about pricing", why: "It says what the talk is about.", point: "Pricing is the subject." });
    assert.deepEqual(handoff.reels.map((r) => [r.n, r.fromSuggestion]), [[2, 2]]);
    assert.deepEqual(result.next.includes("Suggestion 4 is left out of the hand-off: its words are not said together in the main video."), true, result.next);
    assert.equal(result.next.includes("Suggestion 1 "), false);
    w.t.done();
  });
  it("has the raw fixture's keys, in order, and each suggestion exactly the fixture's", async () => {
    const w = ready();
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.deepEqual(Object.keys(handoff), Object.keys(RAW_FIXTURE));
    for (const s of handoff.suggestions) {
      assert.deepEqual(Object.keys(s), Object.keys(RAW_FIXTURE.suggestions[0]));
      assert.deepEqual(Object.keys(s.stretches[0]), Object.keys(RAW_FIXTURE.suggestions[0].stretches[0]));
    }
    assert.deepEqual(handoff.main.onPicture, MAIN_WORDS);
    w.t.done();
  });
  it("places a suggestion of two stretches in the main video as one stretch", async () => {
    const w = ready({ over: { reels: reelsWith([[1, "dropped"], [2, "candidate"], [3, "dropped"]]) } });
    const { found } = await finished(w, { without: ["reel 2"] });
    const [two] = handoffOf(found).suggestions;
    assert.equal(two.n, 2);
    assert.equal(two.stretches.length, 1);
    assert.deepEqual([two.start, two.end], [two.stretches[0].start, two.stretches[0].end]);
    assert.ok(two.start >= 4 && two.end <= 11.878, JSON.stringify(two));
    w.t.done();
  });
  it("spells its opening and closing with the episode's spellings", async () => {
    const w = ready({ over: { spellings: [["Welcome", "Hello"]] } });
    const { found } = await finished(w);
    const [one] = handoffOf(found).suggestions;
    assert.deepEqual([one.n, one.first], [1, "Hello to the show"]);
    w.t.done();
  });
});

describe("F2. which are listed", () => {
  it("leaves out one she dropped, one picked and one finished, and lists one the record does not know", async () => {
    const dropped = ready({ over: { reels: reelsWith([[1, "dropped"], [2, "picked"]]) } });
    assert.deepEqual(numbers(handoffOf((await finished(dropped)).found)), [3]);
    dropped.t.done();
    const finishedBefore = ready({ over: { reels: reelsWith([[1, "candidate"], [2, "picked"], [3, "finished"]]) } });
    assert.deepEqual(numbers(handoffOf((await finished(finishedBefore)).found)), [1]);
    finishedBefore.t.done();
    const unknown = ready({ over: { reels: reelsWith([[2, "picked"]]) } });
    assert.deepEqual(numbers(handoffOf((await finished(unknown)).found)), [1, 3]);
    unknown.t.done();
  });
  it("does not list a suggestion she is making a Reel of, though that Reel is left out of this hand-off: it is picked, and no suggestion", async () => {
    const w = fw({ candidates: CANDIDATES });
    exportOf(w, "main");
    const { found } = await finished(w, { without: ["reel 2"] });
    assert.deepEqual(numbers(handoffOf(found)), [1, 3], "2 is picked: it is a Reel being made, not a suggestion");
    w.t.done();
  });
  it("lists none when none is left to list, and writes the hand-off all the same", async () => {
    const w = ready({ over: { reels: reelsWith([[1, "dropped"], [2, "picked"], [3, "dropped"], [4, "dropped"]]) } });
    const { found, result } = await finished(w);
    assert.equal("suggestions" in handoffOf(found), false);
    assert.equal(handoffFaultV2(handoffOf(found)), "");
    assert.equal(result.next.includes("Suggestion"), false);
    w.t.done();
    // With nothing to place, the recording's words are not needed, and their absence is not said.
    const none = ready({ over: { reels: reelsWith([[1, "dropped"], [2, "picked"], [3, "dropped"], [4, "dropped"]]) } });
    const there = await asked(none);
    rmSync(join(there.folder, "Pricing talk.words.json"));
    const second = await finishNow(none.t.ctx, there);
    assert.equal(second.ok, true, second.failed.join(" "));
    assert.equal(second.next.includes("No Reel suggestions"), false);
    none.t.done();
  });
});

describe("F3. what is said in the result", () => {
  it("names a suggestion with a text missing, and lists the others", async () => {
    const w = fw({ candidates: [ONE, { ...THREE, point: "" }] });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found, result } = await finished(w);
    assert.deepEqual(numbers(handoffOf(found)), [1]);
    assert.ok(result.next.includes("Suggestion 3 is left out of the hand-off: it has no point."), result.next);
    w.t.done();
  });
  it("says a list that cannot be used, and the recording's words not being on this Mac, and writes the hand-off without suggestions", async () => {
    const list = ready();
    const found = await asked(list);
    writeFileSync(join(found.folder, "reels.json"), "not json");
    const a = await finishNow(list.t.ctx, found);
    assert.equal(a.ok, true, a.failed.join(" "));
    assert.ok(a.next.includes("No Reel suggestions are in the hand-off: their list cannot be used: it is not JSON."), a.next);
    assert.equal("suggestions" in handoffOf(found), false);
    list.t.done();
    const words = ready();
    const there = await asked(words);
    rmSync(join(there.folder, "Pricing talk.words.json"));
    const b = await finishNow(words.t.ctx, there);
    assert.equal(b.ok, true, b.failed.join(" "));
    assert.ok(b.next.includes("No Reel suggestions are in the hand-off: the recording's words are not on this Mac."), b.next);
    assert.equal("suggestions" in handoffOf(there), false);
    words.t.done();
  });
  it("says a list that cannot be read at all, as one that is no file", async () => {
    const w = ready();
    const found = await asked(w);
    rmSync(join(found.folder, "reels.json"));
    mkdirSync(join(found.folder, "reels.json"));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(result.next.includes("No Reel suggestions are in the hand-off: their list cannot be read."), result.next);
    w.t.done();
  });
  it("says nothing when the episode has no list of suggestions", async () => {
    const w = ready();
    const found = await asked(w);
    rmSync(join(found.folder, "reels.json"));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(result.next.includes("Suggestion"), false);
    assert.equal(result.next.includes("No Reel suggestions"), false);
    assert.equal("suggestions" in handoffOf(found), false);
    w.t.done();
  });
  it("holds no path, no flag and no command name in what it says", async () => {
    const w = fw({ candidates: [ONE, FOUR, { ...THREE, point: "" }, candidate(5, [{ start: 40, end: 44 }], { reason: "r", point: "p", first: "f", last: "l" })] });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { result } = await finished(w);
    const lines = result.next.split(/(?<=\.) (?=[A-Z])/).filter((line) => /uggestion/.test(line));
    assert.ok(lines.length >= 3, result.next);
    for (const line of lines) assert.doesNotMatch(line, /\/|--|~|\bedit\.js\b|\bnode\b|\bnpx\b/, line);
    w.t.done();
  });
});

describe("F4. where there are none", () => {
  it("lists none for an iPhone clip, whose contract has none", async () => {
    const w = fw({ kind: "short video", projects: ["main"], candidates: CANDIDATES, over: { reels: [] } });
    exportOf(w, "main");
    const { found, result } = await finished(w);
    const handoff = handoffOf(found);
    assert.equal("suggestions" in handoff, false);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(handoff.main.onPicture, MAIN_WORDS);
    assert.equal(result.next.includes("uggestion"), false, "and says nothing of the ones it did not look for");
    w.t.done();
  });
  it("lists none on a Mac that hands off version 1", async () => {
    const w = ready({ handoffVersion: 1, over: { title: { text: "Price like you mean it", from: "person", approved: true } } });
    const { found, result } = await finished(w);
    assert.doesNotMatch(readFileSync(join(found.folder, "final", HANDOFF), "utf8"), /suggestions/);
    assert.equal(result.next.includes("uggestion"), false);
    w.t.done();
  });
  it("lists none for a main video that went the Final Cut way, as a Final Cut finish never did", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = fw({ projects: ["reel 2"], candidates: CANDIDATES, over: { main: { ...EDITED.main, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    const { found, result } = await finished(w);
    assert.equal("suggestions" in handoffOf(found), false);
    assert.equal(result.next.includes("uggestion"), false);
    w.t.done();
  });
  it("places them again on a second finish that keeps the main video, from the word times the last finish kept, in the next revision", async () => {
    const w = ready();
    const { found } = await finished(w);
    const first = handoffOf(found);
    const again = () => ({ ...found, record: reread(found) });
    assert.equal(await finishEpisode(w.t.ctx, again(), { yes: true }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, again());
    assert.equal(result.ok, true, result.failed.join(" "));
    const second = handoffOf(found);
    assert.deepEqual([second.revision, second.suggestions], [2, first.suggestions]);
    assert.equal(handoffFaultV2(second), "");
    w.t.done();
  });
  it("changes the suggestions of the next revision when the list changes: one dropped since is gone, and the numbers of the rest are the same", async () => {
    const w = ready();
    const { found } = await finished(w);
    const base = reread(found);
    const dropped = base.reels.some((r) => r.n === 1) ? base.reels.map((r) => (r.n === 1 ? { ...r, status: "dropped" } : r)) : [...base.reels, ...reelsWith([[1, "dropped"]])];
    writeFileSync(recordFile(found.folder, base.rev + 1), recordText({ ...base, rev: base.rev + 1, reels: dropped }));
    assert.equal(await finishEpisode(w.t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(numbers(handoffOf(found)), [3]);
    w.t.done();
  });
});
