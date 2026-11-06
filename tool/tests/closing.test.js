// The words the transcriber invents after the last thing said (Jason's recording of 6 November: "See you next week." twice,
// after he had stopped, in a quiet that was above the five-second guard's -45 dB). The closing pause is looked for by the cut
// plan's own measure; the captions that lie in it are left out, and so are the words that come after the last caption kept.
// Stand-ins for ffmpeg only: no test calls the real one.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closingPause, dropClosing, withoutClosingWords, closingCleaned, wavSeconds } from "../closing.js";
import { captionsOf } from "../lib.js";
import { pauseArgs } from "../cuts.js";

const cap = (n, a, b, text) => `${n}\n${a} --> ${b}\n ${text}\n`;
/** Captions 20 to 23 of the live recording. */
const LIVE = [
  cap(20, "00:01:10,000", "00:01:14,610", "and then what."),
  cap(21, "00:01:14,610", "00:01:17,000", "would it take to make it this week?"),
  cap(22, "00:01:17,000", "00:01:19,000", "See you next week."),
  cap(23, "00:01:19,000", "00:01:20,000", "See you next week.")
].join("\n");
const LIVE_PAUSES = [[10, 11], [60, 61.5], [74.439, 74.766], [77.298, 84.167]];
const w = (text, start, end) => ({ w: text, start, end });
const LIVE_WORDS = [w("it", 76.3, 76.5), w("this", 76.76, 76.98), w("week?", 76.98, 76.98), w("See", 77, 77.3), w("you", 77.3, 77.3), w("next", 77.3, 77.3), w("week.", 77.3, 77.3), w("See", 79, 79.68), w("you", 79.68, 79.76), w("next", 79.76, 79.84), w("week.", 79.84, 79.84)];

describe("closingPause", () => {
  it("is the pause that runs to the end of the recording, when it is a second or longer", () => {
    assert.deepEqual(closingPause(LIVE_PAUSES, 84.167), [77.298, 84.167]);
    assert.deepEqual(closingPause([[10, 11], [80, 81.1]], 81.13), [80, 81.1]);
  });
  it("is a pause that never ends, as ffmpeg prints one", () => {
    assert.deepEqual(closingPause([[77.298, Infinity]], 84.167), [77.298, Infinity]);
    assert.deepEqual(closingPause([[77.298, Infinity]], 0), [77.298, Infinity]);
  });
  it("is none when the last pause ends before the end, or the closing pause is shorter than a second", () => {
    assert.equal(closingPause([[10, 11], [60, 61.5]], 84.167), null);
    assert.equal(closingPause([[83.5, 84.167]], 84.167), null);
    assert.equal(closingPause([], 84.167), null);
  });
  it("is none for a pause that ends more than 0.05 s before the length", () => {
    assert.equal(closingPause([[70, 84.1]], 84.167), null);
    assert.deepEqual(closingPause([[70, 84.12]], 84.167), [70, 84.12]);
  });
});

describe("dropClosing", () => {
  it("keeps caption 21 and leaves out 22 and 23 of the live recording", () => {
    const r = dropClosing(LIVE, [77.298, 84.167], LIVE_PAUSES);
    assert.equal(r.dropped, 2);
    assert.deepEqual(captionsOf(r.srt).map((c) => c.text), ["and then what.", "would it take to make it this week?"]);
    assert.match(r.srt, /^1\n/);
    assert.equal(r.edge, 77);
  });
  it("keeps a real short last caption that only begins in the pause", () => {
    const srt = [cap(1, "00:01:14,610", "00:01:17,000", "this week?"), cap(2, "00:01:17,000", "00:01:17,600", "Bye.")].join("\n");
    const r = dropClosing(srt, [77.298, 84.167], LIVE_PAUSES);
    assert.equal(r.dropped, 0);
    assert.equal(r.srt, srt);
    assert.equal(r.edge, null);
  });
  it("takes a caption with 75% of its time in the pause and keeps one with less", () => {
    const srt = [cap(1, "00:00:50,000", "00:00:60,000", "talk"), cap(2, "00:01:00,000", "00:01:04,000", "three quarters")].join("\n");
    assert.deepEqual(captionsOf(dropClosing(srt, [61, 80]).srt).map((c) => c.text), ["talk"]);
    assert.deepEqual(captionsOf(dropClosing(srt, [62, 80]).srt).map((c) => c.text), ["talk", "three quarters"]);
  });
  it("leaves out a caption with no length when its moment lies in the pause, and keeps one before it", () => {
    const srt = [cap(1, "00:01:00,000", "00:01:05,000", "kept"), cap(2, "00:01:20,000", "00:01:20,000", "Thank you.")].join("\n");
    const r = dropClosing(srt, [77, 84]);
    assert.deepEqual(captionsOf(r.srt).map((c) => c.text), ["kept"]);
    assert.equal(r.dropped, 1);
  });
  it("gives no edge when no caption was left out, so a real last word after the last caption is kept", () => {
    const srt = cap(1, "00:01:14,610", "00:01:17,000", "this week?");
    const r = dropClosing(srt, [77.298, 84.167], LIVE_PAUSES);
    assert.equal(r.edge, null);
    const words = [w("week?", 76.5, 76.9), w("Bye.", 77.1, 77.4)];
    assert.deepEqual(withoutClosingWords(words, r.edge), words);
  });
  it("changes nothing without a closing pause, or without captions", () => {
    assert.deepEqual(dropClosing(LIVE, null), { srt: LIVE, dropped: 0, edge: null });
    assert.deepEqual(dropClosing("", [77, 84]), { srt: "", dropped: 0, edge: null });
  });
  it("leaves captions elsewhere in the recording to today's rule", () => {
    const srt = [cap(1, "00:00:10,000", "00:00:12,000", "Thank you."), cap(2, "00:01:00,000", "00:01:05,000", "end")].join("\n");
    assert.equal(dropClosing(srt, [80, 84]).dropped, 0);
  });
});

describe("dropClosing, by the sound", () => {
  it("keeps a real short caption whose end the transcriber padded into the silence, when a sound starts for it", () => {
    const srt = [cap(1, "00:01:10,000", "00:01:15,000", "talk"), cap(2, "00:01:17,000", "00:01:19,000", "Thanks.")].join("\n");
    const r = dropClosing(srt, [77.2, 84.167], [[76, 76.9], [77.2, 84.167]]);
    assert.equal(r.dropped, 0);
    assert.equal(r.srt, srt);
  });
  it("takes a caption padded into the silence when an earlier caption owns the last stretch of sound, and one wholly in the pause either way", () => {
    const srt = [cap(1, "00:01:14,000", "00:01:16,500", "talk"), cap(2, "00:01:17,000", "00:01:19,000", "Thanks."), cap(3, "00:01:19,000", "00:01:20,000", "Thanks.")].join("\n");
    assert.equal(dropClosing(srt, [77.2, 84.167], [[70, 71], [77.2, 84.167]]).dropped, 2);
    const owned = [cap(1, "00:01:10,000", "00:01:15,000", "talk"), cap(2, "00:01:17,000", "00:01:19,000", "Thanks."), cap(3, "00:01:19,000", "00:01:20,000", "Thanks.")].join("\n");
    assert.equal(dropClosing(owned, [77.2, 84.167], [[76, 76.9], [77.2, 84.167]]).dropped, 1);
  });
  it("keeps a short real phrase said after a breath and drops the invented caption after it, which a sound near its start does not save", () => {
    const srt = [cap(1, "00:01:10,000", "00:01:15,000", "talk"), cap(2, "00:01:16,600", "00:01:17,000", "Bye."), cap(3, "00:01:17,000", "00:01:19,000", "See you next week.")].join("\n");
    const r = dropClosing(srt, [77.298, 84.167], [[76.3, 76.6], [77.298, 84.167]]);
    assert.deepEqual(captionsOf(r.srt).map((c) => c.text), ["talk", "Bye."]);
    assert.equal(r.dropped, 1);
  });
  it("lets only the first caption own the stretch when no pause comes before the closing one", () => {
    const srt = [cap(1, "00:00:00,000", "00:00:02,000", "Hello."), cap(2, "00:00:03,000", "00:00:05,000", "Padded.")].join("\n");
    const r = dropClosing(srt, [3.5, 84.167], [[3.5, 84.167]]);
    assert.deepEqual(captionsOf(r.srt).map((c) => c.text), ["Hello."]);
    const kept = dropClosing(cap(1, "00:00:03,000", "00:00:05,000", "Padded."), [3.5, 84.167], [[3.5, 84.167]]);
    assert.equal(kept.dropped, 0);
  });
});

describe("withoutClosingWords", () => {
  it("drops both copies of the invented words and keeps 'this week?'", () => {
    assert.deepEqual(withoutClosingWords(LIVE_WORDS, 77).map((x) => x.w), ["it", "this", "week?"]);
  });
  it("moves the edge by the shift, for a file whose sound starts after its picture", () => {
    const shifted = LIVE_WORDS.map((x) => ({ ...x, start: x.start + 0.5, end: x.end + 0.5 }));
    assert.deepEqual(withoutClosingWords(shifted, 77, 0.5).map((x) => x.w), ["it", "this", "week?"]);
  });
  it("changes nothing without an edge", () => {
    assert.equal(withoutClosingWords(LIVE_WORDS, null), LIVE_WORDS);
  });
});

const wavOf = (bytes) => {
  const file = join(mkdtempSync(join(tmpdir(), "brimm-closing-")), "sound.wav");
  writeFileSync(file, Buffer.alloc(bytes));
  return file;
};

describe("wavSeconds", () => {
  it("is the length of a 16 kHz mono 16-bit sound, less its 44-byte header", () => {
    assert.equal(wavSeconds(wavOf(44 + 32000 * 84)), 84);
  });
  it("is 0 for a file with no sound in it, or none at all", () => {
    assert.equal(wavSeconds(wavOf(4)), 0);
    assert.equal(wavSeconds("/nowhere/sound.wav"), 0);
  });
});

describe("closingCleaned", () => {
  const stand = (printed, code = 0) => {
    const calls = [];
    return { calls, run: async (cmd, args) => { calls.push({ cmd, args }); return { code, stderr: printed }; }, tools: { ffmpeg: "FFMPEG" } };
  };
  const heard = "[silencedetect @ 0x1] silence_start: 77.298\n[silencedetect @ 0x1] silence_end: 84.167 | silence_duration: 6.869\n";
  it("asks ffmpeg for the cut plan's pauses, to the length, and cleans the captions", async () => {
    const s = stand(heard);
    const r = await closingCleaned(LIVE, "/w/sound.wav", s, 84.167);
    assert.deepEqual(s.calls.map((c) => c.args), [pauseArgs("/w/sound.wav", 84.167)]);
    assert.equal(r.dropped, 2);
    assert.equal(r.edge, 77);
  });
  it("leaves everything as it was when ffmpeg cannot say, or says no closing pause", async () => {
    assert.deepEqual(await closingCleaned(LIVE, "/w/sound.wav", stand("", 1), 84.167), { srt: LIVE, dropped: 0, edge: null });
    const early = "[silencedetect @ 0x1] silence_start: 10\n[silencedetect @ 0x1] silence_end: 11 | silence_duration: 1\n";
    assert.deepEqual(await closingCleaned(LIVE, "/w/sound.wav", stand(early), 84.167), { srt: LIVE, dropped: 0, edge: null });
  });
  it("leaves everything as it was when ffmpeg throws", async () => {
    const r = await closingCleaned(LIVE, "/w/sound.wav", { run: async () => { throw new Error("spawn EAGAIN"); }, tools: { ffmpeg: "FFMPEG" } }, 84.167);
    assert.deepEqual(r, { srt: LIVE, dropped: 0, edge: null });
  });
  it("does not ask ffmpeg when there are no captions", async () => {
    const s = stand(heard);
    assert.deepEqual(await closingCleaned("", "/w/sound.wav", s, 84.167), { srt: "", dropped: 0, edge: null });
    assert.equal(s.calls.length, 0);
  });
  it("takes the length from the sound when it is given none", async () => {
    const s = stand(heard);
    await closingCleaned(LIVE, wavOf(44 + 32000 * 84), s);
    assert.ok(s.calls[0].args[s.calls[0].args.indexOf("-af") + 1].startsWith("apad=whole_dur=84.000,"));
  });
});
