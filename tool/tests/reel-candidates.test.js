// The Reel candidates of an episode: the candidates made of Claude's clips, reels.json, and the listing. None of it needs a
// video, and no program is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf, cutPlan } from "../cuts.js";
import { fitReel } from "../reframe.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { TOLD, PAUSES } from "./fixtures.js";
import { previewPath, reelCandidates, REELS_FILE, reelsFile, readReels, reelEntries, reelsText, mergeCandidates, notMadeWords } from "../reel-candidates.js";

/** A crop of a 1920x1080 picture, 606 wide, that starts `x` pixels in. */
const crop = (x, found = true) => ({ x, y: 0, w: 606, h: 1080, found });

/** The made-up recording of fixtures.js, as the rules plan it, with Claude cutting "It is very, very important." (p8) and
    picking one clip, from p7 to p9. The clip is two stretches: 13.383 to 16.53, and 19.214 to 21.297. */
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
const HEARD = pausesOf(PAUSES);
const RULES = cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: FACTS.duration, pauses: HEARD });
const READ = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphicCues: [], clips: [{ from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
const PLAN = applyDecisions(RULES, READ.decisions, HEARD).plan;
const CLIPS = clipRanges(PLAN, READ.clips, HEARD).clips;
/** The face finder's stills of the made-up recording: eleven, each with one face whose middle is `centre` of the way across,
    or with none. */
const stillsWith = (centre) => Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: centre == null ? [] : [{ x: centre - 0.05, y: 0.2, w: 0.1, h: 0.2 }] }));
/** A crop of the made-up recording's 1280x720 picture, 404 wide, that starts `x` pixels in. */
const crop720 = (x, found = true) => ({ x, y: 0, w: 404, h: 720, found });

describe("what BRIMM Video Studio says of a Reel it cannot make on a Mac that is not set up for HyperFrames", () => {
  // Reels are made in HyperFrames, so a Mac that is not set up for it cannot make one. OpusClip is no longer used (Jason, 2 November 2026).
  it("is said of no number, of one, of several joined with the last after \"and\", with the words written out", () => {
    assert.equal(notMadeWords(), "BRIMM Video Studio cannot make Reels on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
    assert.equal(notMadeWords([]), "BRIMM Video Studio cannot make Reels on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
    assert.equal(notMadeWords(2), "BRIMM Video Studio cannot make Reel 2 on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
    assert.equal(notMadeWords([2]), "BRIMM Video Studio cannot make Reel 2 on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
    assert.equal(notMadeWords([1, 2]), "BRIMM Video Studio cannot make Reels 1 and 2 on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
    assert.equal(notMadeWords([1, 2, 3]), "BRIMM Video Studio cannot make Reels 1, 2 and 3 on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.");
  });
  it("sends her to OpusClip nowhere, and says nothing of cutting a Reel for now or of BRIMM Ops writing its post text", () => {
    for (const n of [undefined, 3, [1, 2], [1, 2, 3]]) assert.doesNotMatch(notMadeWords(n), /OpusClip|for now|cut |post text|New short video/i, String(n));
  });
});

describe("the Reel candidates made of Claude's clips", () => {
  it("hold each clip's stretches as the preview and the project take them, each with its crop, its title, why, and its words", () => {
    assert.deepEqual(reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }), [{
      n: 1, start: 13.38, end: 21.287,
      ranges: [{ start: 13.38, end: 16.516, crop: crop720(118) }, { start: 19.219, end: 21.287, crop: crop720(118) }],
      seconds: 5.204, fits: { fits: false, why: "It is 5.204 seconds long, and a Reel clip is at least 15 seconds." },
      title: "Know your costs", reason: "It makes one point and stands alone.",
      words: "So the first thing you need to do is know your costs. Thank you so much, Sallie.", phrases: ["p7", "p9"],
      preview: null
    }]);
  });
  it("keep the clip's own number, and its word to check the first or the last word", () => {
    const [one] = reelCandidates({ clips: [{ ...CLIPS[0], n: 4, check: "It starts with no pause before it: check the first word." }], plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual([one.n, one.check], [4, "It starts with no pause before it: check the first word."]);
  });
  it("still get a crop where no face was found, the middle of the picture, and say it is a guess", () => {
    for (const stills of [stillsWith(null), []]) {
      const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills });
      assert.deepEqual(one.ranges.map((r) => r.crop), [crop720(438, false), crop720(438, false)]);
    }
  });
  it("still get a crop when the faces were not looked for at all, the middle of the picture, as a guess", () => {
    for (const stills of [undefined, null]) {
      const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills });
      assert.deepEqual(one.ranges.map((r) => r.crop), [crop720(438, false), crop720(438, false)]);
    }
  });
  it("say so, and have no stretch, for a clip that comes to less than one picture", () => {
    const tiny = { ...CLIPS[0], ranges: [{ start: 13.3801, end: 13.3802 }], start: 13.3801, end: 13.3802, length: 0 };
    const [one] = reelCandidates({ clips: [tiny], plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual([one.ranges, one.seconds, one.failed], [[], 0, "it is shorter than one picture"]);
  });
});

describe("reels.json", () => {
  const made = "2026-10-14T09:12:00-05:00";
  it("is named reels.json, with each preview in previews/, beside it in the episode folder", () => {
    assert.deepEqual([REELS_FILE, previewPath(3)], ["reels.json", "previews/reel-3.mp4"]);
  });
  it("holds the candidates, who made them and when, of which video, and the highest number given", () => {
    const candidates = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual(reelsFile({ video: "talk.mov", by: "import", made, candidates }), { format: "brimm-video reels", version: 1, video: "talk.mov", by: "import", made, highest: 1, candidates });
  });
  it("keeps a higher number given before, so none is given twice", () => {
    assert.equal(reelsFile({ video: "talk.mov", by: "ask", made, candidates: [], highest: 7 }).highest, 7);
  });
  it("says why there are none, when there are none", () => {
    assert.deepEqual(reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude could not be asked (it timed out)" }), { format: "brimm-video reels", version: 1, video: "talk.mov", by: "import", made, highest: 0, none: "Claude could not be asked (it timed out)", candidates: [] });
  });
  it("is read back as it was written", () => {
    const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }) });
    assert.deepEqual(readReels(JSON.stringify(reels, null, 2)), { reels });
  });
  it("is refused, with the reason, when it is not one this tool wrote or a candidate in it cannot be read", () => {
    assert.deepEqual(readReels("not json"), { why: "it is not JSON" });
    assert.deepEqual(readReels(JSON.stringify({ format: "something else", version: 1 })), { why: "it is not a list of Reel candidates this tool wrote" });
    // Version 2 is the reading's (a candidate with no crops yet): the next one up is a newer brimm-video's.
    assert.deepEqual(readReels(JSON.stringify({ format: "brimm-video reels", version: 3, video: "a.mov", candidates: [] })), { why: "it was written by a newer BRIMM Video Studio. Ask Jason to update this Mac." });
    assert.deepEqual(readReels(JSON.stringify({ format: "brimm-video reels", version: 1, video: "a.mov", candidates: [{ n: 1, ranges: [{ start: 1 }] }] })), { why: "candidate 1 in it cannot be read" });
    assert.deepEqual(readReels(JSON.stringify({ format: "brimm-video reels", version: 1, video: "a.mov", highest: "three", candidates: [] })), { why: "it is not a list of Reel candidates this tool wrote" });
  });
  it("says how to update, not to ask Jason, when a newer BRIMM Video Studio wrote it and this Mac has BRIMM Video Studio installed (review finding 2)", () => {
    const newer = JSON.stringify({ format: "brimm-video reels", version: 3, video: "a.mov", candidates: [] });
    assert.deepEqual(readReels(newer, { build: { mode: "installed" } }), { why: 'it was written by a newer BRIMM Video Studio. Say "update Studio" to update this Mac.' });
    // A checkout, and a caller that knows no build, hear today's words.
    for (const build of [undefined, null, { mode: "dev" }]) assert.deepEqual(readReels(newer, { build }), { why: "it was written by a newer BRIMM Video Studio. Ask Jason to update this Mac." });
    // The build changes no other answer.
    assert.deepEqual(readReels("not json", { build: { mode: "installed" } }), { why: "it is not JSON" });
  });
  it("is refused when a candidate's preview is anywhere but its own place in previews/, since it is opened and brought", () => {
    const one = (preview) => readReels(JSON.stringify({ format: "brimm-video reels", version: 1, video: "a.mov", candidates: [{ n: 1, ranges: [{ start: 1, end: 2, crop: { x: 0, y: 0, w: 10, h: 10 } }], preview }] }));
    for (const preview of ["../../Library/x.mp4", "/Users/x/a.mp4", "previews/reel-2.mp4", "previews/reel-1.mov", 3]) assert.deepEqual(one(preview), { why: "candidate 1 in it cannot be read" }, String(preview));
    for (const preview of ["previews/reel-1.mp4", null, undefined]) assert.ok(one(preview).reels, String(preview));
  });
});

describe("the record's Reels, made of the candidates", () => {
  it("are one entry each, a candidate still, with its times, title, why and preview, in the record's own words", () => {
    const [candidate] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual(reelEntries([{ ...candidate, preview: "previews/reel-1.mp4" }, { ...candidate, n: 2, preview: null }]), [
      { n: 1, status: "candidate", from: 13.38, to: 21.287, title: "Know your costs", why: "It makes one point and stands alone.", files: ["previews/reel-1.mp4"], pushed: [] },
      { n: 2, status: "candidate", from: 13.38, to: 21.287, title: "Know your costs", why: "It makes one point and stands alone.", files: [], pushed: [] }
    ]);
  });
});

describe("the list of the Reel candidates", () => {
  const made = "2026-10-14T09:12:00-05:00";
  const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
  const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: [{ ...one, preview: "previews/reel-1.mp4" }, { ...one, n: 3, title: "Thank you", seconds: 32, fits: { fits: true, why: "" }, preview: null, failed: "ffmpeg stopped (Cannot allocate memory)", check: "It ends with no pause after it: check the last word." }] });
  const record = { reels: [{ n: 1, status: "picked" }, { n: 3, status: "candidate" }] };

  it("prints the why of a candidate as why it holds attention, and nothing for a candidate with no why", () => {
    const bare = { ...one, n: 2, reason: "" };
    const text = reelsText(reelsFile({ video: "talk.mov", by: "import", made, candidates: [one, bare] }), { reels: [] });
    assert.equal(text.match(/Why it holds attention: .*/g).length, 1);
    assert.match(text, /\n1\. [^\n]*\n(   [^\n]*\n)*?   Why it holds attention: It makes one point and stands alone\./);
    assert.doesNotMatch(text, /\n   Why: /);
    assert.equal(text.split("\n\n")[2].includes("Why it holds attention"), false);
  });
  it("prints the why of a Reel read before it was asked for in this sense (any old reason) under the same heading", () => {
    const old = { ...one, reason: "It stands alone." };
    assert.match(reelsText(reelsFile({ video: "talk.mov", by: "import", made, candidates: [old] }), { reels: [] }), /\n   Why it holds attention: It stands alone\.\n/);
  });
  it("gives each candidate's number, times, length, title, why, what it is now and its preview", () => {
    assert.equal(reelsText(reels, record), [
      "Reel candidates of talk.mov: 2.",
      "",
      "1. 0:13 to 0:21, 5 seconds. Picked.",
      "   On screen: Know your costs",
      "   Why it holds attention: It makes one point and stands alone.",
      "   It does not fit a Reel. It is 5.204 seconds long, and a Reel clip is at least 15 seconds.",
      "   Preview: previews/reel-1.mp4",
      "",
      "3. 0:13 to 0:21, 32 seconds. A candidate.",
      "   On screen: Thank you",
      "   Why it holds attention: It makes one point and stands alone.",
      "   No preview: ffmpeg stopped (Cannot allocate memory).",
      "   It ends with no pause after it: check the last word.",
      ""
    ].join("\n"));
  });
  it("says a candidate the record does not know of yet is a candidate", () => {
    assert.match(reelsText(reels, { reels: [] }), /^1\. 0:13 to 0:21, 5 seconds\. A candidate\.$/m);
  });
  it("says a short video gets no Reels, and does not offer to ask again", () => {
    assert.equal(reelsText(reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "it is a short video" }), { kind: "short video", reels: [] }), "talk.mov is a short video, and a short video gets no Reels.\n");
  });
  it("says why Claude cannot be asked again, in place of offering it, as the Mac it is shown on finds", () => {
    const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude was not asked" });
    assert.equal(reelsText(reels, { kind: "episode", reels: [] }, "Claude Code is not installed on this Mac, so Claude cannot be asked."), "There are no Reel candidates of talk.mov: Claude was not asked.\nClaude Code is not installed on this Mac, so Claude cannot be asked.\n");
  });
  it("offers to ask again when the Mac it is shown on can, whatever the importing Mac wrote of its own (PR 19's review)", () => {
    const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude was not asked", cannotAsk: "Claude Code is not installed on this Mac" });
    assert.equal(reelsText(reels, { kind: "episode", reels: [] }, ""), "There are no Reel candidates of talk.mov: Claude was not asked.\nSay \"ask Claude again for Reels\" to ask again.\n");
  });
  it("does not call a Reel of the record that reels.json does not hold yet a clip the import cut, when it has no clip (PR 19's re-review, N9)", () => {
    const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }) });
    const top = Math.max(...reels.candidates.map((c) => c.n));
    const record = { kind: "episode", reels: [...reels.candidates.map((c) => ({ n: c.n, status: "candidate", files: [c.preview] })), { n: top + 1, status: "candidate", files: [`previews/reel-${top + 1}.mp4`] }] };
    const text = reelsText(reels, record);
    assert.ok(!text.includes("cut as clips"), text);
    assert.match(text, new RegExp(`\\nReels the record lists that reels\\.json does not hold yet: Reel ${top + 1}, a candidate\\.\\n$`));
  });
  it("names the Reels the import cut as clips, of an episode imported before phase 3, after its candidates", () => {
    const reels = reelsFile({ video: "talk.mov", by: "ask", made, candidates: reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }).map((c) => ({ ...c, n: c.n + 1 })) });
    const record = { kind: "episode", reels: [{ n: 1, status: "picked", files: ["talk.reel-1.mp4", "talk.reel-1.srt"] }, ...reels.candidates.map((c) => ({ n: c.n, status: "candidate", files: [] }))] };
    assert.match(reelsText(reels, record), /\nReels the import cut as clips: Reel 1, picked\.\n$/);
  });
  it("says why there are none, and how to ask again", () => {
    assert.equal(reelsText(reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude could not be asked (it timed out)" }), { reels: [] }), "There are no Reel candidates of talk.mov: Claude could not be asked (it timed out).\nSay \"ask Claude again for Reels\" to ask again.\n");
  });
});

describe("the list of the Reel suggestions of a video of the switch (layout 3)", () => {
  const made = "2026-10-22T09:00:00-05:00";
  const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: made, private: "no" };
  const RAW = { id: "e-20261022-4a7c10", kind: "raw", answer: ANSWERED, name: { text: "Pricing: what to charge?", placeholder: false }, reels: [] };
  const NAME = "Pricing: what to charge?";
  /** A minute of speech, a word every half second: "w0" ends at 0.5, "w1" at 1, and so on. */
  const WORDS = Array.from({ length: 120 }, (_, i) => ({ w: `w${i}`, start: i / 2, end: (i + 1) / 2 }));
  /** The first words of a stretch from `a` to `b`, and its last, as a suggestion holds them: four of each. */
  const opens = (a) => Array.from({ length: 4 }, (_, i) => `w${a * 2 + i}`).join(" ");
  const closes = (b) => Array.from({ length: 4 }, (_, i) => `w${b * 2 - 4 + i}`).join(" ");
  /** A suggestion a reading made: its stretches have no crop, and it has no preview and no title. */
  const suggestion = (n, ranges, over = {}) => {
    const [start, end] = [ranges[0].start, ranges[ranges.length - 1].end];
    const seconds = ranges.reduce((sum, r) => sum + r.end - r.start, 0);
    return { n, start, end, ranges, seconds, fits: fitReel({ start: 0, end: seconds }), title: "", reason: `Reason ${n}.`, point: `Point ${n}.`, first: opens(start), last: closes(end), words: "", phrases: [], preview: null, ...over };
  };
  /** One kept on the clock (10 to 20), one cut (32 to 38), one with half its words cut (25 to 35), and one with 16 of its 18
      words kept (22 to 31). */
  const KEPT = suggestion(1, [{ start: 10, end: 20 }], { check: "It starts with no pause before it: check the first word." });
  const CUT = suggestion(2, [{ start: 32, end: 38 }]);
  const HALF = suggestion(3, [{ start: 25, end: 35 }]);
  const MOST = suggestion(4, [{ start: 22, end: 31 }], { preview: "previews/reel-4.mp4" });
  const reels = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [KEPT, CUT, HALF, MOST] });
  /** The clock of a rough cut that begins at 5 s and leaves out 30 s to 40 s: the first piece is cut at its start. */
  const CLOCK = [{ at: 0, from: 5, to: 30 }, { at: 25, from: 40, to: 60 }];
  const NOW = { clock: CLOCK, words: WORDS, on: "main v1" };
  const record = { ...RAW, reels: [{ n: 4, status: "picked" }] };

  it("places each suggestion on the clock she is reading, in her video's name, with its first and last words as they are said there", () => {
    assert.equal(reelsText(reels, record, "", NOW), [
      `Reel suggestions of ${NAME}: 4, with times on main v1.`,
      "",
      "1. 0:05 to 0:15, 10 seconds. A candidate.",
      "   Opens with: w20 w21 w22 w23",
      "   Closes with: w36 w37 w38 w39",
      "   Why it holds attention: Reason 1.",
      "   It does not fit a Reel. It is 10 seconds long, and a Reel clip is at least 15 seconds.",
      "   It starts with no pause before it: check the first word.",
      "",
      "2. Cut now: its words were cut from main v1. A candidate.",
      "   Opens with: w64 w65 w66 w67",
      "   Closes with: w72 w73 w74 w75",
      "   Why it holds attention: Reason 2.",
      "",
      "3. Cut now: its words were cut from main v1. A candidate.",
      "   Opens with: w50 w51 w52 w53",
      "   Closes with: w66 w67 w68 w69",
      "   Why it holds attention: Reason 3.",
      "",
      "4. 0:17 to 0:25, 8 seconds. Picked.",
      "   Opens with: w44 w45 w46 w47",
      "   Closes with: w56 w57 w58 w59",
      "   Why it holds attention: Reason 4.",
      "   It does not fit a Reel. It is 9 seconds long, and a Reel clip is at least 15 seconds.",
      "   Preview: previews/reel-4.mp4",
      ""
    ].join("\n"));
  });
  it("never names the video's file, says no preview was made, or offers to ask Claude again", () => {
    const text = reelsText(reels, record, "", NOW);
    assert.ok(!text.includes("IMG_4821"), text);
    assert.ok(!text.includes("No preview"), text);
    assert.ok(!text.includes("ask Claude again"), text);
    for (const now of [null, { ...NOW, words: [] }]) {
      const other = reelsText(reels, record, "", now);
      assert.ok(!other.includes("IMG_4821") && !other.includes("No preview"), other);
    }
  });
  it("names a session not yet cleared by its label, never by its file's name, as everything edit.js prints does", () => {
    const session = { id: "e-20261022-4a7c10", kind: "session", answer: { ...ANSWERED, private: "yes" }, session: { marked: made, on: "Mac Studio", teachings: null, cleared: null }, label: "Video of 22 Oct, 09:00 (Mac Studio)", name: { text: "IMG_4821", placeholder: true }, reels: [] };
    const text = reelsText(reels, session, "", NOW);
    assert.match(text, /^Reel suggestions of Video of 22 Oct, 09:00 \(Mac Studio\): 4, with times on main v1\.\n/);
    assert.ok(!text.includes("IMG_4821"), text);
  });
  it("never names the video's file for a video that is not answered, or a session not cleared, whatever its answer says", () => {
    const FILE = "SECRET_FILE_0042.MOV";
    const waiting = { id: "e-20261022-4a7c10", kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide", came: "camera" }, label: "Video of 22 Oct, 09:00 (Mac Studio)", reels: [] };
    const left = { ...waiting, answer: { ...waiting.answer, state: "not for brimm-video" } };
    const mark = { marked: made, on: "Mac Studio", teachings: null, cleared: null };
    const session = { id: "e-20261022-4a7c10", kind: "session", session: mark, label: "Video of 22 Oct, 09:00 (Mac Studio)", name: { text: "SECRET_FILE_0042", placeholder: true }, reels: [] };
    const records = [waiting, left, { ...waiting, answer: { ...waiting.answer, state: "answered" } }, session, { ...session, answer: { ...ANSWERED, state: "needs your answer" } }, { ...session, kind: "short video" }, { ...session, kind: "raw", answer: ANSWERED }];
    const lists = [
      reelsFile({ video: FILE, by: "read", made, candidates: [KEPT, CUT] }),
      reelsFile({ video: FILE, by: "read", made, candidates: [], none: "Claude suggested no stretch that stands alone" }),
      reelsFile({ video: FILE, by: "read", made, candidates: [] })
    ];
    for (const record of records) {
      for (const list of lists) {
        for (const [whyNot, now] of [["", null], ["Claude cannot be asked.", NOW], ["", { ...NOW, words: [] }]]) {
          const text = reelsText(list, record, whyNot, now);
          assert.ok(!text.includes("SECRET_FILE"), `${JSON.stringify([record.kind, record.answer && record.answer.state])}: ${text}`);
          assert.ok(!text.includes("ask Claude again") && !text.includes("No preview"), text);
        }
      }
    }
    assert.match(reelsText(lists[0], waiting, "", null), /^Reel suggestions of Video of 22 Oct, 09:00 \(Mac Studio\): 2, with times on the recording's own clock\.\n/);
  });
  it("counts the seconds of a suggestion's own stretches that the clock keeps, not the gap between them that it keeps too", () => {
    const apart = suggestion(6, [{ start: 10, end: 15 }, { start: 20, end: 25 }]);
    const list = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [apart] });
    const whole = [{ at: 0, from: 0, to: 60 }];
    for (const words of [WORDS, []]) {
      const text = reelsText(list, RAW, "", { clock: whole, words, on: "the video" });
      assert.match(text, /\n6\. 0:10 to 0:25, 10 seconds\. A candidate\.\n/, JSON.stringify(words.length));
    }
    // And of one the clock leaves a gap in: the seconds are those it keeps of the stretches.
    const gap = [{ at: 0, from: 0, to: 12 }, { at: 12, from: 14, to: 60 }];
    assert.match(reelsText(list, RAW, "", { clock: gap, words: WORDS, on: "main v2" }), /\n6\. 0:10 to 0:23, 8 seconds\. A candidate\.\n/);
  });
  it("spells the words a suggestion opens and closes with that the clock does not give, as the episode spells them", () => {
    const said = suggestion(7, [{ start: 32, end: 38 }], { first: "so much, Sally", last: "thank you, Sally" });
    const list = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [said] });
    const spelt = { ...RAW, spellings: [["Sally", "Sallie"]] };
    for (const now of [NOW, null]) {
      const text = reelsText(list, spelt, "", now);
      assert.ok(text.includes("   Opens with: so much, Sallie\n") && text.includes("   Closes with: thank you, Sallie\n"), text);
    }
    // By its time alone too, when there are no words.
    const timed = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [suggestion(8, [{ start: 10, end: 20 }], { first: "Sally says", last: "Sally ends" })] });
    assert.match(reelsText(timed, spelt, "", { clock: CLOCK, words: [], on: "main v1" }), /Opens with: Sallie says\n   Closes with: Sallie ends\n/);
  });
  it("places each by the time of its stretches when there are no words, kept when 70 in 100 of their seconds are on the clock", () => {
    const both = suggestion(5, [{ start: 28, end: 31 }, { start: 50, end: 52 }]);
    const list = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [KEPT, CUT, HALF, both] });
    assert.equal(reelsText(list, RAW, "", { clock: CLOCK, words: [], on: "main v1" }), [
      `Reel suggestions of ${NAME}: 4, with times on main v1.`,
      "",
      "1. 0:05 to 0:15, 10 seconds. A candidate.",
      "   Opens with: w20 w21 w22 w23",
      "   Closes with: w36 w37 w38 w39",
      "   Why it holds attention: Reason 1.",
      "   It does not fit a Reel. It is 10 seconds long, and a Reel clip is at least 15 seconds.",
      "   It starts with no pause before it: check the first word.",
      "",
      "2. Cut now: its words were cut from main v1. A candidate.",
      "   Opens with: w64 w65 w66 w67",
      "   Closes with: w72 w73 w74 w75",
      "   Why it holds attention: Reason 2.",
      "",
      "3. Cut now: its words were cut from main v1. A candidate.",
      "   Opens with: w50 w51 w52 w53",
      "   Closes with: w66 w67 w68 w69",
      "   Why it holds attention: Reason 3.",
      "",
      "5. 0:23 to 0:37, 4 seconds. A candidate.",
      "   Opens with: w56 w57 w58 w59",
      "   Closes with: w100 w101 w102 w103",
      "   Why it holds attention: Reason 5.",
      "   It does not fit a Reel. It is 5 seconds long, and a Reel clip is at least 15 seconds.",
      ""
    ].join("\n"));
  });
  it("gives the recording's own times when there is no clock to place them on, whether it is not read or it could not be", () => {
    const own = [
      `Reel suggestions of ${NAME}: 4, with times on the recording's own clock.`,
      "",
      "1. 0:10 to 0:20, 10 seconds. A candidate.",
      "   Opens with: w20 w21 w22 w23",
      "   Closes with: w36 w37 w38 w39",
      "   Why it holds attention: Reason 1.",
      "   It does not fit a Reel. It is 10 seconds long, and a Reel clip is at least 15 seconds.",
      "   It starts with no pause before it: check the first word.",
      "",
      "2. 0:32 to 0:38, 6 seconds. A candidate.",
      "   Opens with: w64 w65 w66 w67",
      "   Closes with: w72 w73 w74 w75",
      "   Why it holds attention: Reason 2.",
      "   It does not fit a Reel. It is 6 seconds long, and a Reel clip is at least 15 seconds.",
      "",
      "3. 0:25 to 0:35, 10 seconds. A candidate.",
      "   Opens with: w50 w51 w52 w53",
      "   Closes with: w66 w67 w68 w69",
      "   Why it holds attention: Reason 3.",
      "   It does not fit a Reel. It is 10 seconds long, and a Reel clip is at least 15 seconds.",
      "",
      "4. 0:22 to 0:31, 9 seconds. Picked.",
      "   Opens with: w44 w45 w46 w47",
      "   Closes with: w58 w59 w60 w61",
      "   Why it holds attention: Reason 4.",
      "   It does not fit a Reel. It is 9 seconds long, and a Reel clip is at least 15 seconds.",
      "   Preview: previews/reel-4.mp4",
      ""
    ].join("\n");
    for (const now of [null, { why: "edit/main.v2.fcpxml is not in the episode's folder." }, { coming: "edit/main.v2.fcpxml", bring: ["edit/main.v2.fcpxml"] }]) assert.equal(reelsText(reels, record, "", now), own, JSON.stringify(now));
    assert.equal(reelsText(reels, record), own);
  });
  it("names a Reel of the record that reels.json does not hold, after the suggestions, as it always has", () => {
    const text = reelsText(reels, { ...record, reels: [{ n: 1, status: "picked", files: ["talk.reel-1.mp4"] }, { n: 9, status: "candidate", files: [] }].map((r) => ({ ...r })) }, "", NOW);
    assert.match(text, /\n3\. Cut now: .*\n/s);
    assert.match(text, /\nReels the record lists that reels\.json does not hold yet: Reel 9, a candidate\.\n$/);
    assert.ok(!text.includes("cut as clips"), text);
  });
  it("says a short video gets no Reels, in its name", () => {
    const clip = { ...RAW, kind: "short video", name: { text: "Quick tip", placeholder: false } };
    assert.equal(reelsText(reelsFile({ video: "IMG_4822.MOV", by: "read", made, candidates: [] }), clip, "", NOW), "Quick tip is a short video, and a short video gets no Reels.\n");
    assert.equal(reelsText(reels, clip), "Quick tip is a short video, and a short video gets no Reels.\n");
  });
  it("says why there are none, in the video's name, and does not offer to ask Claude again or say why it cannot be asked", () => {
    const none = reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [], none: "Claude suggested no stretch that stands alone" });
    assert.equal(reelsText(none, RAW, "Claude Code is not installed on this Mac, so Claude cannot be asked.", NOW), `There are no Reel suggestions of ${NAME}: Claude suggested no stretch that stands alone.\n`);
    assert.equal(reelsText(none, RAW), `There are no Reel suggestions of ${NAME}: Claude suggested no stretch that stands alone.\n`);
    assert.equal(reelsText(reelsFile({ video: "IMG_4821.MOV", by: "read", made, candidates: [] }), RAW, "", NOW), `There are no Reel suggestions of ${NAME}.\n`);
  });
  it("leaves the list of a video from before the switch (layout 1 or 2) as it always was, whatever clock it is given", () => {
    const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    const old = reelsFile({ video: "talk.mov", by: "import", made, candidates: [{ ...one, preview: "previews/reel-1.mp4" }, { ...one, n: 3, preview: null, failed: "ffmpeg stopped (Cannot allocate memory)" }] });
    const none = reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude was not asked" });
    const clock = { clock: CLOCK, words: WORDS, on: "main v1" };
    // layoutOf turns 3 for a record with a version that has a `how`; she has not answered the card of a video from before the switch.
    const rendered = { v: 2, how: "render", at: made, on: "Mac Studio", file: "edit/main.v2.fcpxml", opened: made };
    const main = { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: [{ v: 1, at: made, on: "Mac Studio", file: "edit/main.v1.fcpxml", project: "p1" }, rendered] };
    const records = [{ reels: [{ n: 1, status: "picked" }] }, { kind: "episode", reels: [] }, { id: "e-20261014-3fa9c1", kind: "episode", spellings: [["Sally", "Sallie"]], reels: [] }, { id: "e-20261014-3fa9c1", kind: "episode", main, reels: [] }, { id: "e-20261014-3fa9c1", kind: "episode", main: { ...main, pushed: [main.pushed[0], { ...rendered, how: "push" }] }, reels: [] }];
    for (const r of records) {
      for (const list of [old, none]) assert.equal(reelsText(list, r, "", clock), reelsText(list, r, ""), JSON.stringify(r));
      assert.match(reelsText(old, r, "", clock), /^Reel candidates of talk\.mov: 2\.\n\n1\. 0:13 to 0:21, 5 seconds\. /, JSON.stringify(r));
      assert.equal(reelsText(none, r, "", clock), 'There are no Reel candidates of talk.mov: Claude was not asked.\nSay "ask Claude again for Reels" to ask again.\n');
    }
    const none_ = reelsFile({ video: "talk.mov", by: "import", made, candidates: [] });
    for (const clip of [{ id: "e-20261014-3fa9c1", kind: "short video", reels: [] }, { id: "e-20261014-3fa9c1", kind: "short video", main, reels: [] }]) assert.equal(reelsText(none_, clip, "", clock), "talk.mov is a short video, and a short video gets no Reels.\n");
  });
});

describe("new candidates from asking Claude again", () => {
  const at = (n, start, end) => ({ n, start, end, ranges: [{ start, end, crop: crop720(118) }], seconds: end - start, fits: { fits: true, why: "" }, title: `Reel at ${start}`, reason: "", words: "", preview: `previews/reel-${n}.mp4` });
  const old = { candidates: [at(1, 10, 40), at(2, 100, 130), at(3, 200, 230)] };
  const record = { reels: [{ n: 1, status: "picked", pushed: [{ v: 1 }] }, { n: 2, status: "dropped" }, { n: 3, status: "candidate" }] };

  it("keep every candidate and every Reel as they are, and add the new ones numbered on from the highest number used", () => {
    // reels.json only ever grows: a candidate a Reel, a project or a person's notes may name is never taken out of it.
    const fresh = [{ ...at(1, 300, 330), preview: null }, { ...at(2, 400, 430), preview: null }];
    const merged = mergeCandidates({ old, fresh, record });
    assert.deepEqual(merged.candidates.map((c) => [c.n, c.start]), [[1, 10], [2, 100], [3, 200], [4, 300], [5, 400]]);
    assert.deepEqual(merged.entries.map((e) => [e.n, e.status]), [[1, "picked"], [2, "dropped"], [3, "candidate"], [4, "candidate"], [5, "candidate"]]);
    assert.deepEqual(merged.entries.slice(0, 3), record.reels);
    assert.deepEqual(merged.added.map((c) => c.n), [4, 5]);
  });
  it("keep a finished Reel and a dropped one, and never reuse a number", () => {
    const merged = mergeCandidates({ old: { candidates: [at(1, 10, 40), at(6, 100, 130)] }, fresh: [{ ...at(1, 300, 330), preview: null }], record: { reels: [{ n: 1, status: "finished" }, { n: 6, status: "dropped" }] } });
    assert.deepEqual(merged.candidates.map((c) => c.n), [1, 6, 7]);
  });
  it("leave out a new clip over any candidate's words, a dropped one or one never picked too, so none is offered twice", () => {
    const merged = mergeCandidates({ old, fresh: [{ ...at(1, 105, 125), preview: null }, { ...at(2, 205, 225), preview: null }], record });
    assert.deepEqual(merged.added, []);
    assert.deepEqual(merged.ignored, ["A new clip from 1:45 to 2:05 was left out: it has words of Reel 2, which is dropped.", "A new clip from 3:25 to 3:45 was left out: it has words of Reel 3, which is a candidate."]);
  });
  it("leave out a new candidate over a picked Reel's stretch", () => {
    const merged = mergeCandidates({ old, fresh: [{ ...at(1, 20, 50), preview: null }], record });
    assert.deepEqual([merged.candidates.map((c) => c.n), merged.added], [[1, 2, 3], []]);
  });
  it("never give a number twice, across two asks in a row", () => {
    const made = "2026-10-14T09:12:00-05:00";
    const first = mergeCandidates({ old, fresh: [{ ...at(1, 300, 330), preview: null }], record });
    const written = reelsFile({ video: "talk.mov", by: "ask", made, candidates: first.candidates, highest: first.highest });
    const second = mergeCandidates({ old: readReels(JSON.stringify(written)).reels, fresh: [{ ...at(1, 400, 430), preview: null }], record: { reels: first.entries } });
    assert.deepEqual(second.candidates.map((c) => c.n), [1, 2, 3, 4, 5]);
  });
  it("keep a new candidate off a picked Reel's words even when reels.json has no candidate for it", () => {
    const merged = mergeCandidates({ old: null, fresh: [{ ...at(1, 105, 125), preview: null }, { ...at(2, 300, 330), preview: null }], record: { reels: [{ n: 2, status: "picked", from: 100, to: 130 }] } });
    assert.deepEqual(merged.added.map((c) => [c.n, c.start]), [[3, 300]]);
  });
  it("keep a new clip that shares only the pause beside it with a picked Reel, as neighbouring sentences do", () => {
    // Each clip takes up to 0.2 s of the pause beside its words. Across a pause of 0.31 s between "It is very, very important."
    // (p8) and "Thank you so much, Sallie." (p9), a Reel that ends on p8 and a clip that starts on p9 share 0.09 s of silence.
    const picked = { ...at(1, 13.38, 19.312), phrases: ["p7", "p8"] };
    const next = { ...at(1, 19.222, 21.287), phrases: ["p9"], preview: null };
    const merged = mergeCandidates({ old: { highest: 1, candidates: [picked] }, fresh: [next], record: { reels: [{ n: 1, status: "picked" }] } });
    assert.deepEqual(merged.candidates.map((c) => [c.n, c.phrases]), [[1, ["p7", "p8"]], [2, ["p9"]]]);
    assert.deepEqual(merged.ignored, []);
  });
  it("leave out a new clip that has words of a kept Reel, and say why", () => {
    const picked = { ...at(1, 13.38, 19.312), phrases: ["p7", "p8"] };
    const over = { ...at(1, 17.046, 21.287), phrases: ["p8", "p9"], preview: null };
    const merged = mergeCandidates({ old: { highest: 1, candidates: [picked] }, fresh: [over], record: { reels: [{ n: 1, status: "picked" }] } });
    assert.deepEqual(merged.candidates.map((c) => c.n), [1]);
    assert.deepEqual(merged.ignored, ["A new clip from 0:17 to 0:21 was left out: it has words of Reel 1, which is picked."]);
  });
  it("count only words, not the pause at its edges, for a kept Reel known only by its record's times", () => {
    const record = { reels: [{ n: 2, status: "picked", from: 100, to: 130 }] };
    const merged = mergeCandidates({ old: null, fresh: [{ ...at(1, 129.9, 150), preview: null }, { ...at(2, 70, 100.1), preview: null }], record });
    assert.deepEqual(merged.added.map((c) => c.n), [3, 4]);
  });
  it("number from 1 when there were none before", () => {
    const merged = mergeCandidates({ old: null, fresh: [{ ...at(1, 300, 330), preview: null }], record: { reels: [] } });
    assert.deepEqual(merged.candidates.map((c) => c.n), [1]);
  });
});
