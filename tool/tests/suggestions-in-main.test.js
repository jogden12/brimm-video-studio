// The Reel suggestions of a raw video, placed in the main video HyperFrames exported (plan PR 8, groups E1 to E4; architecture 2026-10-27, section
// 8.6): each unmade suggestion's words are looked for in the export's words by `inMain`, and a suggestion that is found becomes the one the
// hand-off holds, on the export's clock. Plain words and times: nothing here reads a disk or runs a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHandoffV2, handoffFaultV2 } from "../handoff-v2.js";
import { suggestionsInMain } from "../suggestions-in-main.js";

/** Words from a sentence, each `each` seconds long, the first starting at `from`: the way a transcriber times them. */
const say = (sentence, from, each = 0.4) => sentence.split(" ").map((w, i) => ({ w, start: Math.round((from + i * each) * 1000) / 1000, end: Math.round((from + (i + 1) * each) * 1000) / 1000 }));
const A = "Welcome to the show today we are going to talk about pricing";
const B = "so the first thing you need to do is know your costs";
const C = "it is very very important";
const D = "thank you so much for watching";
/** The recording: A at 0, B at 6, C after it, D at 14. */
const RECORDING = [...say(A, 0), ...say(B, 6), ...say(C, 10.8), ...say(D, 14)];
/** The export: the recording with C cut, A starting at 1 second (the lead-in is another), and 14 seconds long. */
const EXPORT = [...say(A, 1), ...say(B, 5.8), ...say(D, 10.6)];
const MAIN = { words: EXPORT, seconds: 14, timed: true };
const candidate = (n, ranges, over = {}) => ({ n, start: ranges[0]?.start ?? 0, end: ranges[ranges.length - 1]?.end ?? 0, ranges, reason: `Why ${n}.`, point: `Point ${n}.`, first: "first words", last: "last words", ...over });
const ONE = candidate(1, [{ start: 0, end: 4.8 }], { first: "Welcome to the show", last: "talk about pricing", reason: "It sets out the talk.", point: "Pricing is the subject." });
const TWO = candidate(2, [{ start: 6, end: 10.8 }, { start: 14, end: 16.4 }], { first: "so the first thing", last: "thank you so much for watching", reason: "It makes one point.", point: "Know your costs." });
const place = (candidates, over = {}) => suggestionsInMain({ candidates, words: RECORDING, spellings: [], main: MAIN, ...over });

describe("E1. placing a suggestion in the export", () => {
  it("becomes the one the hand-off holds: its number, times on the export's clock, one stretch, its own opening and closing, its reason and point", () => {
    const { list, left } = place([ONE]);
    assert.deepEqual(list, [{ n: 1, start: 1, end: 5.8, stretches: [{ start: 1, end: 5.8 }], first: "Welcome to the show", last: "talk about pricing", why: "It sets out the talk.", point: "Pricing is the subject." }]);
    assert.deepEqual(left, []);
    assert.deepEqual(Object.keys(list[0]), ["n", "start", "end", "stretches", "first", "last", "why", "point"], "in the contract's order");
  });
  it("finds a suggestion of two stretches as one stretch, whether the export keeps what lay between them or cuts it", () => {
    const cut = place([TWO]);
    assert.deepEqual(cut.list.map((s) => [s.n, s.start, s.end, s.stretches]), [[2, 5.8, 13, [{ start: 5.8, end: 13 }]]]);
    const kept = [...say(A, 1), ...say("um so right then", 5.8), ...say(B, 7.4), ...say(D, 12.2)];
    const spanning = place([candidate(3, [{ start: 0, end: 4.8 }, { start: 6, end: 10.8 }])], { main: { words: kept, seconds: 16, timed: true } });
    assert.deepEqual(spanning.list.map((s) => [s.n, s.start, s.end, s.stretches]), [[3, 1, 12.2, [{ start: 1, end: 12.2 }]]]);
  });
  it("lists them in the order the candidates are in, each with the number it has, and changes nothing it is given", () => {
    const candidates = [TWO, ONE];
    const given = structuredClone({ candidates, words: RECORDING, main: MAIN });
    const { list } = place(candidates);
    assert.deepEqual(list.map((s) => s.n), [2, 1]);
    assert.deepEqual({ candidates, words: RECORDING, main: MAIN }, given);
  });
  it("spells its opening and closing with the episode's spellings, and its words, so that a name it spells another way is found", () => {
    const named = candidate(4, [{ start: 0, end: 1.6 }], { first: "Hormozy says", last: "pricing matters" });
    const recording = say("Hormozy says pricing matters", 0);
    const main = { words: say("Hormozi says pricing matters", 2), seconds: 6, timed: true };
    assert.deepEqual(suggestionsInMain({ candidates: [named], words: recording, spellings: [], main }).list, [], "heard another way, 3 of its 4 words are the export's");
    const { list } = suggestionsInMain({ candidates: [named], words: recording, spellings: [["Hormozy", "Hormozi"]], main });
    assert.deepEqual(list.map((s) => [s.n, s.first, s.last, s.start, s.end]), [[4, "Hormozi says", "pricing matters", 2, 3.6]]);
  });
  it("gives times to the hundredth, kept within the export", () => {
    const main = { words: say(A, 0.123456, 0.4166667), seconds: 5.0001, timed: true };
    const { list } = place([ONE], { main });
    assert.equal(list.length, 1);
    for (const s of list) {
      assert.ok(s.start >= 0 && s.end > s.start && s.end <= main.seconds + 0.01, JSON.stringify(s));
      assert.equal(s.start, Math.round(s.start * 100) / 100);
      assert.equal(s.end, Math.round(s.end * 100) / 100);
    }
    const short = place([ONE], { main: { words: say(A, 1), seconds: 3, timed: true } });
    assert.ok(short.list.every((s) => s.end <= 3), "a word timed past the end of the file is held to it");
  });
  it("finds a suggestion by its words when the export has only its captions' times, spread over each caption", () => {
    const spread = EXPORT.map((word, i) => ({ ...word, start: i * 0.5, end: (i + 1) * 0.5 }));
    const { list } = place([ONE], { main: { words: spread, seconds: 14, timed: false } });
    assert.deepEqual(list.map((s) => s.n), [1]);
  });
});

describe("E2. a suggestion that is left out", () => {
  const OUT = (n) => `Suggestion ${n} is left out of the hand-off: its words are not said together in the main video.`;
  it("is left out, and said, when its words are not in the export", () => {
    const other = candidate(5, [{ start: 17, end: 19 }]);
    const recording = [...RECORDING, ...say("this part never makes it into the main video at all", 17)];
    const { list, left } = suggestionsInMain({ candidates: [ONE, other], words: recording, spellings: [], main: MAIN });
    assert.deepEqual([list.map((s) => s.n), left], [[1], [OUT(5)]]);
  });
  it("keeps a suggestion that has 9 of its 10 words in the export in order, and leaves out one that has 8", () => {
    const ten = "one two three four five six seven eight nine ten";
    const recording = say(ten, 0);
    const c = candidate(6, [{ start: 0, end: 4 }]);
    const main = (text) => ({ words: say(text, 3), seconds: 10, timed: true });
    assert.deepEqual(suggestionsInMain({ candidates: [c], words: recording, spellings: [], main: main(ten) }).list.map((s) => s.n), [6]);
    assert.deepEqual(suggestionsInMain({ candidates: [c], words: recording, spellings: [], main: main("one two three four fiver six seven eight nine ten") }).list.map((s) => s.n), [6], "9 of 10");
    const eight = suggestionsInMain({ candidates: [c], words: recording, spellings: [], main: main("one two three four fiver sixer seven eight nine ten") });
    assert.deepEqual([eight.list, eight.left], [[], [OUT(6)]]);
  });
  it("leaves out a suggestion whose words are spread over more than one and a half times its length", () => {
    const ten = "one two three four five six seven eight nine ten";
    const c = candidate(7, [{ start: 0, end: 4 }]);
    const spread = { words: say(ten, 2, 1.2), seconds: 20, timed: true };
    assert.deepEqual(suggestionsInMain({ candidates: [c], words: say(ten, 0), spellings: [], main: spread }).list, []);
    const near = { words: say(ten, 2, 0.55), seconds: 20, timed: true };
    assert.deepEqual(suggestionsInMain({ candidates: [c], words: say(ten, 0), spellings: [], main: near }).list.map((s) => s.n), [7]);
  });
  it("reads the export's word times as real only when they are: with captions' times alone, the last words are looked for in a narrower stretch", () => {
    // Twenty words in eight seconds; the export has the first seventeen from 1 s, and the last three 4 s later, where only the spacing of real
    // times looks (inMain: with spacing, as far as one and a half times the suggestion from the first word; without, as far as the last word and 3 s).
    const twenty = "w01 w02 w03 w04 w05 w06 w07 w08 w09 w10 w11 w12 w13 w14 w15 w16 w17 w18 w19 w20";
    const c = candidate(11, [{ start: 0, end: 8 }]);
    const late = [...say(twenty.split(" ").slice(0, 17).join(" "), 1), { w: "w18", start: 11.8, end: 12.2 }, { w: "w19", start: 12.2, end: 12.5 }, { w: "w20", start: 12.5, end: 12.8 }];
    const real = suggestionsInMain({ candidates: [c], words: say(twenty, 0), spellings: [], main: { words: late, seconds: 20, timed: true } });
    assert.deepEqual(real.list.map((s) => [s.n, s.start, s.end]), [[11, 1, 12.8]]);
    const spread = suggestionsInMain({ candidates: [c], words: say(twenty, 0), spellings: [], main: { words: late, seconds: 20, timed: false } });
    assert.deepEqual([spread.list, spread.left], [[], ["Suggestion 11 is left out of the hand-off: its words are not said together in the main video."]]);
  });
  it("says nothing of a suggestion with no stretch, which is passed over, and reads no number twice", () => {
    const none = candidate(8, []);
    const bad = candidate(9, [{ start: 3, end: 2 }, { start: NaN, end: 4 }, null]);
    const { list, left } = place([none, bad, ONE]);
    assert.deepEqual([list.map((s) => s.n), left], [[1], []]);
  });
  it("leaves out everything, saying why, when the export has no words", () => {
    const { list, left } = place([ONE, TWO], { main: { words: [], seconds: 14, timed: true } });
    assert.deepEqual([list, left], [[], [OUT(1), OUT(2)]]);
  });
});

describe("E3. a suggestion with words missing", () => {
  it("is left out, and says which: its first words, last words, reason or point, in that order", () => {
    const cases = [[{ first: "" }, "first words"], [{ last: "   " }, "last words"], [{ reason: undefined }, "reason"], [{ point: null }, "point"], [{ first: undefined, last: "", reason: "", point: "" }, "first words"], [{ last: "", point: "" }, "last words"], [{ reason: 3 }, "reason"]];
    for (const [over, which] of cases) {
      const { list, left } = place([{ ...ONE, ...over }]);
      assert.deepEqual([list, left], [[], [`Suggestion 1 is left out of the hand-off: it has no ${which}.`]], which);
    }
  });
  it("takes a first and a last that the spellings leave with words", () => {
    const { list } = place([{ ...ONE, first: " Welcome ", last: "pricing" }], { spellings: [["pricing", "Pricing"]] });
    assert.deepEqual(list.map((s) => [s.first, s.last]), [["Welcome", "Pricing"]]);
  });
  it("is left out, and says so, when the recording has no word in its stretches", () => {
    const nothing = candidate(10, [{ start: 40, end: 44 }]);
    const { list, left } = place([nothing, ONE]);
    assert.deepEqual([list.map((s) => s.n), left], [[1], ["Suggestion 10 is left out of the hand-off: it has no words in the recording."]]);
    assert.deepEqual(place([nothing], { words: [] }).left, ["Suggestion 10 is left out of the hand-off: it has no words in the recording."]);
  });
  it("says nothing she reads holds a path, a flag or a command name", () => {
    const lines = [...place([{ ...ONE, first: "" }, candidate(2, [{ start: 40, end: 44 }]), candidate(3, [{ start: 17, end: 19 }])], { words: [...RECORDING, ...say("never in it", 17)] }).left];
    assert.ok(lines.length === 3);
    for (const line of lines) assert.doesNotMatch(line, /\/|--|~|\bedit\.js\b|\bnode\b|\bnpx\b/, line);
  });
});

describe("E4. what the page checks", () => {
  const record = { kind: "raw", name: { text: "Pricing talk" }, video: { recorded: "2026-10-20", recordedFrom: "video" } };
  const handoff = (kind, suggestions) => buildHandoffV2({
    record: { ...record, kind }, id: "e-20261014-3fa9c1", revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57",
    main: { file: "Pricing talk.mp4", seconds: 14, srt: "1\n00:00:00,000 --> 00:00:02,000\n Welcome to the show.\n\n" }, suggestions, reels: []
  });
  it("passes handoffFaultV2 once put into a raw video's hand-off, each with exactly the contract's keys", () => {
    const { list } = place([ONE, TWO]);
    assert.equal(list.length, 2);
    const made = handoff("raw", list);
    assert.equal(handoffFaultV2(made), "");
    assert.deepEqual(made.suggestions, list);
    for (const s of made.suggestions) assert.deepEqual(Object.keys(s), ["n", "start", "end", "stretches", "first", "last", "why", "point"]);
  });
  it("is not written into the hand-off of a short video, whose contract has none", () => {
    const { list } = place([ONE]);
    assert.equal("suggestions" in handoff("short video", list), false);
    assert.equal(handoffFaultV2(handoff("short video", list)), "");
  });
});
