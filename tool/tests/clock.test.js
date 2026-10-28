// Times and words a person gives on a timeline, mapped back to seconds of the raw video.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf } from "../cuts.js";
import { secondsOf, clockText, clockOf, clockOfRanges, rawAt, timelineAt, lengthOf, wordsAt, momentOf, heardWords, insideTheirTime, cutsOn, cutNear } from "../clock.js";
import { fcpxml } from "../fcpxml.js";
import { TOLD, PAUSES } from "./fixtures.js";

const RAW = wordsOf(TOLD);
/** The words from when they are said, as a push gives them (heardWords). */
const WORDS = heardWords(RAW, phrasesOf(RAW, pausesOf(PAUSES)));
/** The main video's kept pieces in the made-up recording, as its cut plan gives them. */
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const FACTS = { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 };

describe("a time as a person gives it", () => {
  it("is minutes and seconds, hours too, or seconds alone", () => {
    assert.deepEqual(["0:03", "12:30", "1:02:03", "45", "3.5", " 0:07 "].map(secondsOf), [3, 750, 3723, 45, 3.5, 7]);
    assert.deepEqual(["", "noon", "1:75", "-3", "0:03:"].map(secondsOf), [null, null, null, null, null]);
  });
  it("is shown to the second", () => {
    assert.deepEqual([5.885, 750, 3723.4, 59.6].map(clockText), ["0:06", "12:30", "1:02:03", "1:00"]);
  });
});

describe("the clock of a timeline", () => {
  it("is read off a Final Cut file brimm-video wrote, each clip's place on the timeline and its stretch of the video", () => {
    const clock = clockOf(fcpxml({ video: "/v/a.mp4", facts: FACTS, ranges: MAIN }));
    assert.equal(clock.length, 3);
    assert.ok(Math.abs(clock[1].at - 3.971) < 0.001 && Math.abs(clock[1].from - 13.38) < 0.001, JSON.stringify(clock));
    // Each clip is whole frames of the video: 119, 94 and 62 at 29.97 a second.
    assert.ok(Math.abs(lengthOf(clock) - 275 / (30000 / 1001)) < 0.0001, String(lengthOf(clock)));
  });
  it("is the kept pieces end to end, for a timeline never pushed", () => {
    assert.deepEqual(clockOfRanges(MAIN).map((p) => Math.round(p.at * 1000) / 1000), [0, 3.968, 7.115]);
  });
  it("maps a time on it to the raw video, and back", () => {
    const clock = clockOfRanges(MAIN);
    assert.equal(Math.round(rawAt(clock, 5.885) * 1000) / 1000, 15.3);
    assert.equal(Math.round(timelineAt(clock, 15.3) * 1000) / 1000, 5.885);
    assert.equal(timelineAt(clock, 11), null);
    assert.equal(rawAt(clock, 30), null);
  });
});

describe("the words, from when they are said", () => {
  it("start after the pause before them, where the transcriber starts them where the word before ended", () => {
    const moved = WORDS.filter((w, i) => w.start !== RAW[i].start).map((w) => [w.w, w.start]);
    assert.deepEqual(moved, [["Welcome", 1.111], ["Let", 3.695], ["Welcome", 6.07], ["So", 12.459], ["So", 13.583], ["It", 17.246], ["Thank", 19.414]]);
  });
});

describe("the words, from inside the time the transcriber gave them", () => {
  it("start halfway into it: the transcriber starts a word where the word before it ended, so its time holds the pause before it", () => {
    const given = [{ w: "Hello", start: 0, end: 0.4 }, { w: "there", start: 0.4, end: 1.6 }, { w: "friend.", start: 1.6, end: 2 }];
    assert.deepEqual(insideTheirTime(given), [{ w: "Hello", start: 0.2, end: 0.4 }, { w: "there", start: 1, end: 1.6 }, { w: "friend.", start: 1.8, end: 2 }]);
    assert.deepEqual(given[1], { w: "there", start: 0.4, end: 1.6 }, "the words it is given are as they were");
  });
  it("leave a word with no length where it is, and keep their times to the millisecond", () => {
    assert.deepEqual(insideTheirTime([{ w: "uh,", start: 1.5, end: 1.5 }, { w: "so", start: 2, end: 2.0123 }]), [{ w: "uh,", start: 1.5, end: 1.5 }, { w: "so", start: 2.006, end: 2.0123 }]);
  });
  it("are none when there are none", () => {
    assert.deepEqual(insideTheirTime([]), []);
  });
});

describe("words a person quotes", () => {
  it("are found among the timeline's kept words, without case or punctuation", () => {
    assert.deepEqual(wordsAt(WORDS, MAIN, "Know your COSTS"), [{ start: 15.3, end: 16.2 }]);
    assert.deepEqual(wordsAt(WORDS, MAIN, "very important"), []);
  });
  it("are found in a word the episode spells as several words, by those words", () => {
    // The one word the transcriber wrote, spelled as three: "costs." read as "costs, Alex Hormozi." on every timeline.
    const spelled = WORDS.map((w) => (w.w === "costs." ? { ...w, w: "costs, Alex Hormozi." } : w));
    assert.deepEqual(wordsAt(spelled, MAIN, "know your costs Alex Hormozi"), [{ start: 15.3, end: 16.2 }]);
  });
  it("are found across a mark the transcriber wrote as a word of its own, which counts for nothing", () => {
    const words = [{ w: "It", start: 1, end: 1.2 }, { w: "is", start: 1.2, end: 1.4 }, { w: "—", start: 1.4, end: 1.5 }, { w: "really", start: 1.5, end: 1.9 }, { w: "good.", start: 1.9, end: 2.3 }];
    assert.deepEqual(wordsAt(words, [{ start: 0, end: 3 }], "is really good"), [{ start: 1.2, end: 2.3 }]);
  });
  it("start when they are said, and never before their piece", () => {
    assert.deepEqual(wordsAt(WORDS, MAIN, "welcome to"), [{ start: 6.07, end: 6.58 }]);
    // Were they taken as the transcriber times them, they would start at the piece's start, in the pause.
    assert.deepEqual(wordsAt(RAW, MAIN, "welcome to"), [{ start: 5.87, end: 6.58 }]);
  });
});

describe("a moment a person gives", () => {
  const given = { on: "main v3", clock: clockOfRanges(MAIN), ranges: MAIN, words: WORDS };
  it("is a time on the clock she watched, in seconds of the raw video", () => {
    assert.deepEqual(momentOf({ ...given, time: "0:05" }), { at: 14.415 });
  });
  it("is quoted words, with where they end and how long they take", () => {
    assert.deepEqual(momentOf({ ...given, quoted: "know your costs" }), { at: 15.3, to: 16.2, for: 0.9 });
  });
  it("is quoted words across a join, taking as long as they show on the timeline, never what was cut between", () => {
    // "talk about pricing" ends the first piece at 9.838 s, and "So the first thing" starts the next at 13.383 s.
    assert.deepEqual(momentOf({ ...given, quoted: "talk about pricing so the first thing" }), { at: 8.46, to: 14.42, for: 2.415 });
  });
  it("is a time on a clip's first frame of a pushed file, though the frame starts a little before its kept piece", () => {
    // A kept piece from 5.88 s: the push starts its clip on frame 176 at 29.97 a second, 5.8725 s, half a frame before it.
    const pieces = [{ start: 5.88, end: 9.838 }, ...MAIN.slice(1)];
    const pushed = clockOf(fcpxml({ video: "/v/a.mp4", facts: FACTS, ranges: pieces }));
    assert.deepEqual(momentOf({ ...given, on: "main v1", clock: pushed, ranges: pieces, time: "0:00" }), { at: 5.88 });
    // A time a tenth of a second and more into what is cut now is still refused.
    const watched = clockOfRanges([{ start: 5.75, end: 9.838 }, ...MAIN.slice(1)]);
    assert.match(momentOf({ ...given, on: "main v1", clock: watched, time: "0:00" }).why, /^0:00 on main v1 is in what is cut now\./);
  });
  it("refuses a time past the end, a time in what is cut now, and words not kept or said twice", () => {
    assert.deepEqual(momentOf({ ...given, time: "0:45" }), { why: "0:45 is after the end of main v3, which is 0:09 long." });
    // She watched v3, which kept the opening; it is cut now.
    const watched = clockOfRanges([{ start: 0, end: 4 }, ...MAIN]);
    assert.deepEqual(momentOf({ ...given, clock: watched, time: "0:02" }), { why: '0:02 on main v3 is in what is cut now. The nearest kept words are after it, "Welcome to the show." at 0:04.' });
    assert.deepEqual(momentOf({ ...given, quoted: "very important" }), { why: '"very important" is not said in what main v3 keeps. Say the words as they are said, or give the time.' });
    const twice = [...WORDS, { w: "know", start: 21.0, end: 21.05 }, { w: "your", start: 21.05, end: 21.1 }, { w: "costs.", start: 21.1, end: 21.2 }];
    assert.deepEqual(momentOf({ ...given, words: twice, quoted: "know your costs" }), { why: '"know your costs" is said 2 times on main v3: at 0:06, at 0:09. Say the time instead.' });
    assert.deepEqual(momentOf({ ...given, time: "noon" }), { why: '"noon" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.' });
  });
  it("is, as the end of a stretch, the timeline's own end, read off its clock to the second, up to a second past it", () => {
    assert.deepEqual(momentOf({ ...given, time: "9.198", end: true }), { at: 21.297 });
    assert.deepEqual(momentOf({ ...given, time: "0:10", end: true }), { at: 21.297 });
    assert.deepEqual(momentOf({ ...given, time: "0:09", end: true }), { at: 21.099 });
    assert.deepEqual(momentOf({ ...given, time: "0:11", end: true }), { why: "0:11 is after the end of main v3, which is 0:09 long." });
  });
});

describe("a cut on a timeline", () => {
  const round = (cuts) => cuts.map((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 1000) / 1000])));
  it("is each place its clips' seconds of the raw video do not meet, and before its first and after its last within its edges", () => {
    assert.deepEqual(round(cutsOn(clockOfRanges(MAIN), { from: 0, to: 23.423 })), [{ at: 0, from: 0, to: 5.87 }, { at: 3.968, from: 9.838, to: 13.383 }, { at: 7.115, from: 16.53, to: 19.214 }, { at: 9.198, from: 21.297, to: 23.423 }]);
    // A Reel's edges are its stretch: what a cut took from its start is a cut at 0:00.
    assert.deepEqual(round(cutsOn(clockOfRanges([{ start: 19.214, end: 21.287 }]), { from: 13.38, to: 21.287 })), [{ at: 0, from: 13.38, to: 19.214 }]);
    assert.deepEqual(round(cutsOn(clockOfRanges(MAIN))), [{ at: 3.968, from: 9.838, to: 13.383 }, { at: 7.115, from: 16.53, to: 19.214 }]);
  });
  /** A clock of pieces of the raw video, and what is said in each cut between them: the words cut there now, and those kept
      there again since. */
  const joined = (pieces, said) => ({ on: "main v3", clock: clockOfRanges(pieces.map(([start, end]) => ({ start, end }))), said: (c) => said[c.from] || { cut: "", kept: "" } });
  const IMPORTANT = { cut: "It is very, very important to know this.", kept: "" };
  const AGAIN = { cut: "Let me do that again.", kept: "" };
  // Words cut at 1:00, only a pause cut at 1:02, and words at 1:08.
  const A = joined([[0, 60], [70, 72], [75, 81], [90, 130]], { 60: IMPORTANT, 81: AGAIN });
  it("is the one where words were cut nearest a time she gives, a pause alone never counting", () => {
    assert.deepEqual(cutNear({ ...A, time: "1:02" }), { cut: { at: 60, from: 60, to: 70, ...IMPORTANT } });
  });
  it("is within five seconds of the time, and refused further off, naming the nearest place where words were cut", () => {
    assert.equal(cutNear({ ...A, time: "1:13" }).cut.at, 68);
    assert.deepEqual(cutNear({ ...A, time: "1:13.1" }), { why: 'There is no cut with words near 1:13 on main v3: the nearest is at 1:08, "Let me do that again." Say that time, or the words that were cut (--words).' });
  });
  it("is refused when two places where words were cut are near, naming each, and is never guessed", () => {
    assert.deepEqual(cutNear({ ...A, time: "1:04" }), { why: 'There are 2 places near 1:04 on main v3 where words were cut: at 1:00, "It is very, very important…", and at 1:08, "Let me do that again." Say the words that were cut (--words), or a time nearer one of them.' });
    // Within a second of one, and the next more than 2 seconds off, it is that one; otherwise it is refused.
    const B = joined([[0, 60], [70, 74], [80, 130]], { 60: IMPORTANT, 74: AGAIN });
    assert.equal(cutNear({ ...B, time: "1:03.5" }).cut.at, 64);
    assert.match(cutNear({ ...B, time: "1:02.5" }).why, /^There are 2 places near 1:03/);
  });
  it("says what is kept already, and refuses a time past the end, or where nothing with words is cut", () => {
    const C = joined([[0, 60], [70, 130]], { 60: { cut: "", kept: "Know your costs." } });
    assert.deepEqual(cutNear({ ...C, time: "1:00.5" }), { why: '"Know your costs." is kept on main v3 already.' });
    assert.deepEqual(cutNear({ ...C, time: "0:30" }), { why: "Nothing with words is cut from main v3, so there is nothing there to keep." });
    assert.deepEqual(cutNear({ ...C, time: "5:00" }), { why: "5:00 is after the end of main v3, which is 2:00 long." });
  });
});
