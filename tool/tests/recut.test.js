// Cuts a person asks for: whole phrases, at pauses, the ranges made again by the import's own rules.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf as heardPauses, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions } from "../notes.js";
import { pausesOf, cutSpan, cutPhrases, keptRanges, rangesWith, croppedLike } from "../recut.js";
import { TOLD, PAUSES } from "./fixtures.js";

/** The made-up recording's plan, as phase 3's tests make it: Claude cut "It is very, very important." (p8). */
const HEARD = heardPauses(PAUSES);
const DECIDED = applyDecisions(cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: 23.423, pauses: HEARD }), readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [] })).decisions, HEARD).plan;
const PLAN = { ...DECIDED, facts: { duration: 23.423 } };
/** The same recording, as ffmpeg heard it with no silence after its last words: its tail is a sound with no words to it, which
    the plan keeps, and which the gaps between phrases cannot show. */
const TAILED = (() => {
  const heard = HEARD.slice(0, -1);
  return { ...applyDecisions(cutPlan(phrasesOf(wordsOf(TOLD), heard), { duration: 23.423, pauses: heard }), readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [] })).decisions, heard).plan, facts: { duration: 23.423 } };
})();
/** A recording as ffmpeg heard it with sound before its first words (a lead-in), and a laugh between two pauses after them:
    the plan keeps both, and the gaps between phrases cannot show either (the lead's re-check of the plan). */
const LAUGHED = (() => {
  const words = [["Welcome", 1.0, 1.3], ["to", 1.3, 1.5], ["the", 1.5, 1.7], ["show.", 1.7, 2.0], ["Today", 4.6, 4.9], ["we", 4.9, 5.1], ["talk", 5.1, 5.4], ["pricing.", 5.4, 6.0], ["Then", 8.0, 8.3], ["we", 8.3, 8.5], ["stop.", 8.5, 9.0]].map(([w, start, end]) => ({ w, start, end }));
  const heard = [[2.1, 2.6], [3.4, 4.5], [6.1, 7.9], [9.1, 12]];
  return { ...cutPlan(phrasesOf(words, heard), { duration: 12, pauses: heard }), facts: { duration: 12 } };
})();
const pairs = (ranges) => ranges.map((r) => [r.start, r.end]);

describe("the pauses a plan's phrases show", () => {
  it("are the gaps between them, and before the first and after the last: here, every pause ffmpeg heard", () => {
    assert.deepEqual(pausesOf(PLAN.phrases, 23.423), HEARD);
  });
});

describe("a cut asked for", () => {
  it("is made whole: the phrases it touches, with every one they touch without a pause", () => {
    assert.deepEqual(cutSpan(PLAN.phrases, 17.5, 18.0), { from: 17.246, to: 19.022, phrases: ["p8"] });
    // p4 and p5 touch: "Welcome to the show." runs into "Today we are...", so they go together.
    assert.deepEqual(cutSpan(PLAN.phrases, 8.5, 9.0), { from: 6.07, to: 9.638, phrases: ["p4", "p5"] });
    assert.deepEqual(cutSpan(PLAN.phrases, 10, 11), { why: "No words are said there, so there is nothing to cut or keep." });
  });
  it("keeps or takes out each phrase in it, in the order asked, and says a person took it out", () => {
    const now = cutPhrases(PLAN.phrases, [{ keep: false, from: 13.583, to: 16.33 }, { keep: true, from: 17.246, to: 19.022 }]);
    assert.deepEqual(now.filter((p) => ["p7", "p8"].includes(p.id)).map((p) => [p.id, p.keep, p.kind, p.why]), [["p7", false, "cut", "taken out by a person"], ["p8", true, "keep", ""]]);
    assert.equal(PLAN.phrases.find((p) => p.id === "p8").keep, false);
  });
});

describe("the kept pieces", () => {
  it("are the plan's own, untouched, with no cut asked for", () => {
    assert.equal(rangesWith({ plan: TAILED }), TAILED.ranges);
    assert.deepEqual(pairs(keptRanges({ plan: PLAN })), pairs(PLAN.ranges.filter((r) => r.keep)));
  });
  it("keep a sound the plan kept that the gaps between phrases cannot show, the tail, when a cut is made elsewhere", () => {
    assert.deepEqual(pairs(keptRanges({ plan: TAILED })).slice(-1), [[19.214, 23.423]]);
    assert.deepEqual(pairs(keptRanges({ plan: TAILED, cuts: [{ keep: false, from: 6.07, to: 9.638 }] })), [[13.383, 16.53], [19.214, 23.423]]);
    // Made again from the gaps alone, the tail would be cut as silence after the last words.
    assert.deepEqual(pausesOf(TAILED.phrases, 23.423).slice(-1), [[20.94, 23.423]]);
  });
  it("keep a lead-in and a laugh the plan kept, with no cut and with a cut away from them", () => {
    assert.equal(rangesWith({ plan: LAUGHED }), LAUGHED.ranges);
    assert.deepEqual(pairs(keptRanges({ plan: LAUGHED })), [[0, 6.3], [7.7, 9.3]]);
    assert.deepEqual(pairs(keptRanges({ plan: LAUGHED, cuts: [{ keep: false, from: 7.9, to: 9.1 }] })), [[0, 6.3]]);
  });
  it("name only the phrases each range holds now, where what a cut made again meets the plan's own ranges", () => {
    // The laugh beside the phrase taken out is made again from the gaps between phrases, so it goes with the pause (ruling 3).
    const ranges = rangesWith({ plan: LAUGHED, cuts: [{ keep: false, from: 4.5, to: 6.1 }] });
    assert.deepEqual(ranges.map((r) => [r.start, r.end, r.keep, r.phrases, r.text]), [
      [0, 2.3, true, ["p1"], "Welcome to the show."],
      [2.3, 7.7, false, ["p2"], "Today we talk pricing."],
      [7.7, 9.3, true, ["p3"], "Then we stop."],
      [9.3, 12, false, [], ""]
    ]);
  });
  it("join over a phrase kept again, with no breath lost", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: true, from: 17.246, to: 19.022 }] })), [[5.87, 9.838], [13.383, 21.297]]);
  });
  it("lose a phrase taken out, and the pause beside it", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: false, from: 6.07, to: 9.638 }] })), [[13.383, 16.53], [19.214, 21.297]]);
  });
  it("lie within a Reel's stretch, cut at its edges", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: true, from: 17.246, to: 19.022 }], span: { from: 13.38, to: 21.287 } })), [[13.383, 21.287]]);
  });
});

describe("a Reel's pieces after a cut", () => {
  it("take the crop of the Reel's own stretch they lie most in", () => {
    const stretches = [{ start: 13.38, end: 16.516, crop: { x: 118, w: 404 } }, { start: 19.219, end: 21.287, crop: { x: 200, w: 404 } }];
    assert.deepEqual(croppedLike([{ start: 13.383, end: 16.53 }, { start: 19.6, end: 21.287 }, { start: 17, end: 18 }], stretches).map((p) => p.crop.x), [118, 200, 118]);
  });
  it("are split where one runs over two of the Reel's stretches, each part with its own stretch's crop and note", () => {
    // A cut kept again what lay between the stretches: one piece now runs from the first into the second, whose face was
    // not found. It is split at the middle of what lay between them, 17.868 s.
    const stretches = [{ start: 13.38, end: 16.516, crop: { x: 118, w: 404 } }, { start: 19.219, end: 21.287, crop: { x: 418, w: 404 }, guessed: true }];
    assert.deepEqual(croppedLike([{ start: 13.383, end: 21.287 }], stretches), [
      { start: 13.383, end: 17.868, crop: { x: 118, w: 404 } },
      { start: 17.868, end: 21.287, crop: { x: 418, w: 404 }, guessed: true }
    ]);
  });
});
