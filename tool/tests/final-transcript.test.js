// A finished video's transcript, made again as the transcript tool makes one: its own pass for the captions, with its silence
// filter and the show's and the episode's spellings, and the word pass for the times. Stand-ins for ffmpeg and the
// transcriber write what the real ones wrote of the made-up recording in fixtures.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalTranscript, shortSilenceArgs, spelled, startedAfterSilence, wordsStartedAfterSilence } from "../final-transcript.js";
import { silenceArgs, stampedText } from "../lib.js";
import { wordsOf } from "../cuts.js";
import { SRT, TOLD, told } from "./fixtures.js";

const TOOLS = { ffmpeg: "FFMPEG", whisper: "WHISPER" };
/** Stand-ins: ffmpeg writes the sound and prints `silence`, and, as silencedetect does, each silence of `quiet` ([start, end] in
    seconds) that is as long as the run asked for (its d=, in seconds); the transcriber writes SRT, and with -ojf `said` (TOLD) too,
    unless told the word pass dies. */
function stand({ silence = "", quiet = [], wordPass = "ok", plain = "ok", srt = SRT, said = TOLD, sound = "ok" } = {}) {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "FFMPEG" && args.includes("pcm_s16le")) {
      if (sound !== "ok") return { code: 1, stderr: "Invalid data found when processing input\n" };
      writeFileSync(args[args.length - 1], "RIFF");
      return { code: 0, stderr: "" };
    }
    if (cmd === "FFMPEG") {
      const least = Number(/:d=([\d.]+)/.exec(args[args.indexOf("-af") + 1])[1]);
      const printed = quiet.filter(([a, b]) => b - a >= least).map(([a, b]) => `[silencedetect @ 0x1] silence_start: ${a}\n[silencedetect @ 0x1] silence_end: ${b} | silence_duration: ${b - a}\n`);
      return { code: 0, stderr: silence + printed.join("") };
    }
    const base = args[args.indexOf("-of") + 1];
    if (args.includes("-ojf")) {
      if (wordPass === "dies") return { code: 134, stderr: "", signal: "SIGABRT" };
      writeFileSync(base + ".json", JSON.stringify(said));
      writeFileSync(base + ".srt", srt);
      return { code: 0, stderr: "" };
    }
    if (plain !== "ok") return { code: 1, stderr: "whisper_init: failed to load model\n" };
    writeFileSync(base + ".srt", srt);
    return { code: 0, stderr: "" };
  };
  return { calls, deps: { run, tools: TOOLS, model: "MODEL" } };
}
const work = () => mkdtempSync(join(tmpdir(), "brimm-final-"));

describe("finalTranscript", () => {
  it("writes the captions with the transcript tool's own pass, and the word times with the word pass", async () => {
    const s = stand();
    const made = await finalTranscript("/v/main.mp4", work(), s.deps);
    const passes = s.calls.filter((c) => c.cmd === "WHISPER");
    assert.equal(passes.length, 2);
    assert.ok(passes[0].args.includes("-osrt") && !passes[0].args.includes("-ojf"));
    assert.ok(passes[1].args.includes("-ojf"));
    assert.equal(made.srt, SRT.replace("Sally", "Sallie"));
    assert.equal(made.txt, stampedText(made.srt));
    assert.deepEqual(made.words, wordsOf(TOLD));
    assert.equal(made.untimed, "");
  });
  it("leaves out a caption written over a long silence, as the transcript tool does", async () => {
    const silence = "[silencedetect @ 0x1] silence_start: 11\n[silencedetect @ 0x1] silence_end: 15 | silence_duration: 4\n";
    const made = await finalTranscript("/v/main.mp4", work(), stand({ silence }).deps);
    assert.doesNotMatch(made.srt, /So the\.\.\./);
    assert.match(made.srt, /^1\n/);
  });
  it("spells the episode's own words as the episode says, after the show's", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), { ...stand().deps, spellings: [["pricing", "Pricing"], ["Sallie", "Sallie Ogden"]] });
    assert.match(made.srt, / Pricing\./);
    assert.match(made.srt, /Thank you so much, Sallie Ogden\./);
    assert.ok(made.words.some((w) => w.w === "Pricing."));
  });
  it("spells only the words of the captions, never their numbers or their times", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `${i + 1}\n00:00:${String(i + 1).padStart(2, "0")},000 --> 00:00:${String(i + 2).padStart(2, "0")},000\n Rule 10 of ${i + 1}.\n`).join("\n") + "\n";
    const made = await finalTranscript("/v/main.mp4", work(), { ...stand({ srt: ten }).deps, spellings: [["10", "ten"]] });
    assert.match(made.srt, /^10\n00:00:10,000 --> 00:00:11,000\n Rule ten of ten\.$/m);
    assert.match(made.srt, /^9\n00:00:09,000 --> 00:00:10,000\n Rule ten of 9\.$/m);
  });
  it("uses the plain pass alone when the word pass dies, and says the word times are missing", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), stand({ wordPass: "dies" }).deps);
    assert.equal(made.words, null);
    assert.equal(made.untimed, "the transcriber could not time the words (it was killed by SIGABRT)");
    assert.equal(made.srt, SRT.replace("Sally", "Sallie"));
  });
  it("says why there is no transcript, in plain words", async () => {
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ sound: "bad" }).deps), { why: "the sound could not be read from it (Invalid data found when processing input)" });
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ plain: "bad" }).deps), { why: "the transcriber stopped (whisper_init: failed to load model)" });
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ srt: "" }).deps), { why: "the transcriber found no speech in it" });
  });
});

// Jason's by-hand check of 30 October: his fbb80c's export opens on a silent 3 second title card, and the final .srt began
// `00:00:00,000 --> 00:00:07,590` with "Hi, I'm Jason Ogden...", and its .words.json had "Hi," from 0 to 3.8 s: the transcriber starts the first
// caption and the first word at 0, in the silence. lib.js's silenceArgs sees only silences of five seconds or more (they drop the captions
// that lie in them), so a lead-in of three was not seen. The hand-off's captions and word times now start where the sound does.
describe("finalTranscript: a caption or a word does not start in a silence of a second or more", () => {
  const LEAD_SRT = "1\n00:00:00,000 --> 00:00:07,590\n Hi, I'm Jason Ogden. If you make video for your business, a\n\n2\n00:00:07,590 --> 00:00:10,200\n you need to say so.\n\n";
  /** What the word pass writes of it: the first word, "Hi,", is timed at 3.8 seconds, and its segment starts at 0. The second segment
      starts at `second` milliseconds. */
  const leadTold = (second = 7590) => told([
    [0, 7590, [["[_BEG_]", -1, 0], [" Hi", 380], [",", 380], [" I'm", 440], [" Jason", 480], [" Ogden", 520], [".", 530], [" If", 560], [" you", 580], [" make", 610], [" video", 640], [" for", 660], [" your", 680], [" business", 720], [",", 730], [" a", 750]]],
    [second, second + 2610, [[" you", 830], [" need", 860], [" to", 880], [" say", 900], [" so", 940], [".", 960]]]
  ]);
  const LEAD_TOLD = leadTold();
  /** The title card: ffmpeg hears the sound start 3.004 seconds in. */
  const LEAD = [[0, 3.004]];
  const lead = (more = {}) => stand({ srt: LEAD_SRT, said: LEAD_TOLD, quiet: LEAD, ...more });

  it("starts the first caption and the first word where a 3 second lead-in ends, and nothing else", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), lead().deps);
    assert.equal(made.srt, LEAD_SRT.replace("00:00:00,000 --> ", "00:00:03,004 --> "));
    assert.deepEqual(made.words[0], { w: "Hi,", start: 3.004, end: 3.8 });
    // Every other word is the word pass's own, and so is the end of the first.
    assert.deepEqual(made.words.slice(1), wordsOf(LEAD_TOLD).slice(1));
    assert.equal(made.untimed, "");
  });
  it("writes the stamped text from those captions", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), lead().deps);
    assert.equal(made.txt, stampedText(made.srt));
    assert.equal(made.txt.split("\n")[0], "[0:03] Hi, I'm Jason Ogden. If you make video for your business, a");
    assert.equal(made.txt.split("\n")[1], "[0:07] you need to say so.");
  });
  it("leaves a caption that starts in speech as it is: its start, its end, its number and its words", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), lead().deps);
    assert.match(made.srt, /\n\n2\n00:00:07,590 --> 00:00:10,200\n you need to say so\.\n\n$/);
    assert.deepEqual(made.words.filter((w) => w.start >= 3.8).map((w) => [w.w, w.start, w.end]), wordsOf(LEAD_TOLD).filter((w) => w.start >= 3.8).map((w) => [w.w, w.start, w.end]));
  });
  it("leaves a caption alone that starts in a pause of 0.8 seconds, which ffmpeg does not report at a second", async () => {
    const srt = LEAD_SRT.replace("00:00:07,590 --> 00:00:10,200", "00:00:08,200 --> 00:00:10,810");
    const made = await finalTranscript("/v/main.mp4", work(), lead({ srt, quiet: [...LEAD, [8, 8.8]], said: leadTold(8200) }).deps);
    assert.match(made.srt, /\n\n2\n00:00:08,200 --> 00:00:10,810\n/);
    assert.equal(made.words.find((w) => w.w === "you" && w.start > 8).start, 8.2);
    assert.match(made.srt, /^1\n00:00:03,004 --> /);
  });
  it("still leaves out a caption that lies wholly in a silence of five seconds or more, and moves the one that starts in it", async () => {
    // The fixture's fourth caption, 12.16 to 14.75 s, lies in it; the fifth starts at 14.75 and runs on to 20.96 s.
    const made = await finalTranscript("/v/main.mp4", work(), stand({ quiet: [[11, 16.2]] }).deps);
    assert.doesNotMatch(made.srt, /So the first thing/);
    assert.match(made.srt, /^4\n00:00:16,200 --> 00:00:20,960\n costs\. It is very, very important\./m);
    assert.deepEqual(made.srt.match(/^\d+$/gm), ["1", "2", "3", "4"]);
  });
  it("does not leave out a caption wholly in a silence of less than five seconds, and does not move it either", async () => {
    // The third caption, "pricing.", is 8.9 to 9.5 s, in a silence of 2.5 seconds that ends after it: it is the transcript tool's to keep.
    const made = await finalTranscript("/v/main.mp4", work(), stand({ quiet: [[8.5, 11]] }).deps);
    assert.equal(made.srt, SRT.replace("Sally", "Sallie"));
    assert.deepEqual(made.words, wordsOf(TOLD));
  });
  it("asks ffmpeg for the silences of five seconds as it always did, and for those of a second beside them", async () => {
    const s = lead();
    await finalTranscript("/v/main.mp4", work(), s.deps);
    const filters = s.calls.filter((c) => c.cmd === "FFMPEG" && c.args.includes("-af")).map((c) => c.args);
    assert.equal(filters.length, 2);
    assert.deepEqual(filters[0], silenceArgs(filters[0][4]));
    assert.deepEqual(filters[1], shortSilenceArgs(filters[1][4]));
    assert.equal(filters[0][4], filters[1][4], "both look at the same sound");
    assert.equal(filters[0][6], "silencedetect=noise=-45dB:d=5");
    assert.equal(filters[1][6], "silencedetect=noise=-45dB:d=1");
  });
  it("asks for neither when the transcriber wrote no captions", async () => {
    const s = stand({ srt: "" });
    await finalTranscript("/v/main.mp4", work(), s.deps);
    assert.equal(s.calls.filter((c) => c.cmd === "FFMPEG" && c.args.includes("-af")).length, 0);
  });
  it("goes on without the second look when it fails, as it does without the first", async () => {
    const s = lead();
    const asked = s.deps.run;
    const made = await finalTranscript("/v/main.mp4", work(), { ...s.deps, run: async (cmd, args, ...more) => (args.includes("silencedetect=noise=-45dB:d=1") ? { code: 1, stderr: "Error" } : asked(cmd, args, ...more)) });
    assert.equal(made.srt, LEAD_SRT);
    assert.deepEqual(made.words, wordsOf(LEAD_TOLD));
  });
  it("moves the captions when the word pass died, and says the word times are missing", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), lead({ wordPass: "dies" }).deps);
    assert.equal(made.words, null);
    assert.equal(made.untimed, "the transcriber could not time the words (it was killed by SIGABRT)");
    assert.equal(made.srt, LEAD_SRT.replace("00:00:00,000 --> ", "00:00:03,004 --> "));
    assert.equal(made.txt, stampedText(made.srt));
  });
  it("moves a caption before the episode's spellings are applied, and keeps the spellings", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), { ...lead().deps, spellings: [["Jason", "Jason Q."]] });
    assert.match(made.srt, /^1\n00:00:03,004 --> 00:00:07,590\n Hi, I'm Jason Q\. Ogden\./);
    assert.equal(made.words[0].start, 3.004);
    assert.ok(made.words.some((w) => w.w === "Jason Q."));
  });
});

describe("shortSilenceArgs, startedAfterSilence and wordsStartedAfterSilence", () => {
  const ONE = "1\n00:00:01,000 --> 00:00:09,000\n Hello there.\n\n2\n00:00:12,000 --> 00:00:14,000\n Again.\n\n";
  it("asks ffmpeg for the silences of a second or more at -45 dB, and writes no file", () => {
    assert.deepEqual(shortSilenceArgs("/w/sound.wav"), ["-nostdin", "-hide_banner", "-nostats", "-i", "/w/sound.wav", "-af", "silencedetect=noise=-45dB:d=1", "-f", "null", "-"]);
    // The transcript tool's own, five seconds, stays as brimm-operations has it.
    assert.deepEqual(silenceArgs("/w/sound.wav"), ["-nostdin", "-hide_banner", "-nostats", "-i", "/w/sound.wav", "-af", "silencedetect=noise=-45dB:d=5", "-f", "null", "-"]);
  });
  it("starts a caption whose start lies in a silence at the silence's end, when that is before the caption's end", () => {
    assert.equal(startedAfterSilence(ONE, [[0, 4]]), ONE.replace("00:00:01,000 -->", "00:00:04,000 -->"));
    assert.equal(startedAfterSilence(ONE, [[1, 4]]), ONE.replace("00:00:01,000 -->", "00:00:04,000 -->"), "a silence that starts where the caption does");
    assert.equal(startedAfterSilence(ONE, [[0, 4], [11, 13]]), ONE.replace("00:00:01,000 -->", "00:00:04,000 -->").replace("00:00:12,000 -->", "00:00:13,000 -->"));
  });
  it("leaves a caption alone whose start is not in a silence: before it, at its end, or after it", () => {
    for (const spans of [[[2, 5]], [[0, 1]], [[20, 30]], [[9, 11]], []]) assert.equal(startedAfterSilence(ONE, spans), ONE, JSON.stringify(spans));
  });
  it("leaves a caption alone when the silence goes on to its end or past it, or never ends", () => {
    for (const spans of [[[0, 9]], [[0, 9.0004]], [[0, 20]], [[0, Infinity]]]) assert.equal(startedAfterSilence(ONE, spans), ONE, JSON.stringify(spans));
  });
  it("tells the new start to the millisecond, in the separator the file uses, and changes nothing else in the file", () => {
    assert.equal(startedAfterSilence(ONE, [[0, 3.0004]]), ONE.replace("00:00:01,000 -->", "00:00:03,000 -->"));
    assert.equal(startedAfterSilence(ONE, [[0, 3.0006]]), ONE.replace("00:00:01,000 -->", "00:00:03,001 -->"));
    const dotted = ONE.replace(/,(\d{3})/g, ".$1");
    assert.equal(startedAfterSilence(dotted, [[0, 4]]), dotted.replace("00:00:01.000 -->", "00:00:04.000 -->"));
    const crlf = ONE.replace(/\n/g, "\r\n");
    assert.equal(startedAfterSilence(crlf, [[0, 4]]), crlf.replace("00:00:01,000 -->", "00:00:04,000 -->"));
  });
  it("counts the hours in a start", () => {
    const late = "1\n01:00:00,500 --> 01:00:09,000\n Late.\n\n";
    assert.equal(startedAfterSilence(late, [[3599, 3603]]), late.replace("01:00:00,500 -->", "01:00:03,000 -->"));
  });
  it("is what it is given when it is no captions or no silences", () => {
    assert.equal(startedAfterSilence("", [[0, 4]]), "");
    assert.equal(startedAfterSilence("not captions", [[0, 4]]), "not captions");
    assert.equal(startedAfterSilence(ONE, []), ONE);
  });
  it("starts a word whose start lies in a silence at the silence's end, when that is before the word's end, and leaves its end alone", () => {
    const words = [{ w: "Hi,", start: 0, end: 3.8 }, { w: "I'm", start: 3.8, end: 4.4 }, { w: "ok", start: 1, end: 2 }];
    assert.deepEqual(wordsStartedAfterSilence(words, [[0, 3.004]]), [{ w: "Hi,", start: 3.004, end: 3.8 }, { w: "I'm", start: 3.8, end: 4.4 }, { w: "ok", start: 1, end: 2 }]);
    assert.deepEqual(wordsStartedAfterSilence(words, [[0, Infinity]]), words);
    assert.deepEqual(wordsStartedAfterSilence(words, []), words);
  });
  it("does not change what it is given", () => {
    const words = Object.freeze([Object.freeze({ w: "Hi,", start: 0, end: 3.8 })]);
    assert.deepEqual(wordsStartedAfterSilence(words, [[0, 3.004]]), [{ w: "Hi,", start: 3.004, end: 3.8 }]);
    assert.deepEqual(words, [{ w: "Hi,", start: 0, end: 3.8 }]);
  });
});

describe("spelled", () => {
  it("changes whole words only, as they are written", () => {
    assert.equal(spelled("Sally and Sallyanne", []), "Sallie and Sallyanne");
    assert.equal(spelled("the BRIM and the brim", [["BRIM", "BRIMM"]]), "the BRIMM and the brim");
    assert.equal(spelled("a (b)", [["(b)", "c"], ["", "x"]]), "a (b)");
  });
});
