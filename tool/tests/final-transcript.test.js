// A finished video's transcript, made again as the transcript tool makes one: its own pass for the captions, with its silence
// filter and the show's and the episode's spellings, and the word pass for the times. Stand-ins for ffmpeg and the
// transcriber write what the real ones wrote of the made-up recording in fixtures.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalTranscript, spelled } from "../final-transcript.js";
import { stampedText } from "../lib.js";
import { wordsOf } from "../cuts.js";
import { SRT, TOLD } from "./fixtures.js";

const TOOLS = { ffmpeg: "FFMPEG", whisper: "WHISPER" };
/** Stand-ins: ffmpeg writes the sound and prints `silence`; the transcriber writes SRT, and with -ojf TOLD too, unless told
    the word pass dies. */
function stand({ silence = "", wordPass = "ok", plain = "ok", srt = SRT, sound = "ok" } = {}) {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "FFMPEG" && args.includes("pcm_s16le")) {
      if (sound !== "ok") return { code: 1, stderr: "Invalid data found when processing input\n" };
      writeFileSync(args[args.length - 1], "RIFF");
      return { code: 0, stderr: "" };
    }
    if (cmd === "FFMPEG") return { code: 0, stderr: silence };
    const base = args[args.indexOf("-of") + 1];
    if (args.includes("-ojf")) {
      if (wordPass === "dies") return { code: 134, stderr: "", signal: "SIGABRT" };
      writeFileSync(base + ".json", JSON.stringify(TOLD));
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

describe("spelled", () => {
  it("changes whole words only, as they are written", () => {
    assert.equal(spelled("Sally and Sallyanne", []), "Sallie and Sallyanne");
    assert.equal(spelled("the BRIM and the brim", [["BRIM", "BRIMM"]]), "the BRIMM and the brim");
    assert.equal(spelled("a (b)", [["(b)", "c"], ["", "x"]]), "a (b)");
  });
});
