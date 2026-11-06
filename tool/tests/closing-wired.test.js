// The closing words, through the import's and the hand-off's cleaning: the live recording of 6 November (84.167 s, ended on
// "...make it this week?" at 77.0 s, then a quiet that is above -45 dB). Stand-ins for ffprobe, ffmpeg and the transcriber
// say what the real ones said of it; no test calls the real ones.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uneditedFile } from "../unedited.js";
import { finalTranscript } from "../final-transcript.js";
import { probed, told } from "./fixtures.js";

const SRT = `1
00:00:00,000 --> 00:00:04,000
 Hello there.

2
00:01:14,610 --> 00:01:17,000
 would it take to make it this week?

3
00:01:17,000 --> 00:01:19,000
 See you next week.

4
00:01:19,000 --> 00:01:20,000
 See you next week.

`;
const SEE = [[" See", 7730], [" you", 7730], [" next", 7730], [" week", 7730], [".", 7730]];
const TOLD = told([
  [0, 4000, [[" Hello", 100], [" there", 200], [".", 300]]],
  [74610, 77000, [[" would", 7500], [" it", 7560], [" take", 7600], [" this", 7676], [" week", 7698], ["?", 7698]]],
  [77000, 79000, SEE],
  [79000, 80000, [[" See", 7968], [" you", 7976], [" next", 7984], [" week", 7984], [".", 7984]]]
]);
/** What ffmpeg prints of the live recording's pauses (quieter than -35 dB for 0.3 s): the whole ending is silent. */
const PAUSES = "[silencedetect @ 0x1] silence_start: 4.5\n[silencedetect @ 0x1] silence_end: 74.5 | silence_duration: 70\n[silencedetect @ 0x1] silence_start: 77.298\n[silencedetect @ 0x1] silence_end: 84.167 | silence_duration: 6.869\n";
const after = (args, flag) => args[args.indexOf(flag) + 1];

/** The stand-ins. `pauses` is what ffmpeg prints for the -35 dB run, or "throw"; `calls` are the runs. */
function stand({ pauses = PAUSES, said = TOLD, srt = SRT } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-closing-wired-"));
  const calls = [];
  const logs = [];
  const run = async (cmd, args, { keep = 4000 } = {}) => {
    calls.push({ cmd, args });
    if (cmd === "FFPROBE") {
      writeFileSync(after(args, "-o"), probed({ duration: "84.167000", picture: { width: 720, height: 1280 } }));
      return { code: 0, stderr: "" };
    }
    if (cmd === "FFMPEG") {
      const filter = args.includes("-af") ? after(args, "-af") : "";
      if (filter.includes("silencedetect=noise=-45dB")) return { code: 0, stderr: "" };
      if (filter.includes("silencedetect=noise=-35dB")) {
        if (pauses === "throw") throw new Error("spawn EAGAIN");
        return { code: 0, stderr: pauses };
      }
      // The sound, as long as the recording: 16 kHz, mono, 16 bits, and a 44-byte header.
      writeFileSync(args[args.length - 1], args.includes("pcm_s16le") ? Buffer.alloc(44 + 32000 * 84) : "RIFF");
      return { code: 0, stderr: "" };
    }
    writeFileSync(after(args, "-of") + ".srt", srt);
    if (args.includes("-ojf")) writeFileSync(after(args, "-of") + ".json", JSON.stringify(said));
    return { code: 0, stderr: "" };
  };
  for (const d of ["work", "locks"]) mkdirSync(join(dir, d));
  const deps = { run, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "SWIFT", claude: "" }, model: "/models/model.bin", tmpDir: join(dir, "work"), lockDir: join(dir, "locks"), home: join(dir, "home"), today: () => "2026-11-06", rulesOnly: true, wait: async () => {}, notify: () => {}, log: (line) => logs.push(line) };
  return { dir, calls, logs, deps, read: (name) => readFileSync(join(dir, name), "utf8"), done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the import's cleaning", () => {
  it("leaves out the captions and the words the transcriber invented after the last thing said, and says so", async () => {
    const t = stand();
    writeFileSync(join(t.dir, "talk.mov"), "video");
    const r = await uneditedFile(join(t.dir, "talk.mov"), t.deps);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.doesNotMatch(t.read("talk.srt"), /See you next week/);
    assert.match(t.read("talk.srt"), /make it this week\?/);
    assert.equal(r.captions, 2);
    assert.deepEqual(JSON.parse(t.read("talk.words.json")).words.map((w) => w.w).slice(-3), ["take", "this", "week?"]);
    assert.ok(t.logs.some((line) => line.includes("left out 2 captions written where nobody speaks.")), t.logs.join("\n"));
    t.done();
  });
  it("changes nothing when the recording has no closing pause", async () => {
    const t = stand({ pauses: "[silencedetect @ 0x1] silence_start: 4.5\n[silencedetect @ 0x1] silence_end: 74.5 | silence_duration: 70\n" });
    writeFileSync(join(t.dir, "talk.mov"), "video");
    await uneditedFile(join(t.dir, "talk.mov"), t.deps);
    assert.match(t.read("talk.srt"), /See you next week/);
    t.done();
  });
  it("changes nothing when ffmpeg cannot say where the pauses are", async () => {
    const t = stand({ pauses: "throw" });
    writeFileSync(join(t.dir, "talk.mov"), "video");
    await uneditedFile(join(t.dir, "talk.mov"), t.deps);
    assert.match(t.read("talk.srt"), /See you next week/);
    t.done();
  });
});

describe("the hand-off's cleaning", () => {
  it("leaves out the captions and the words the transcriber invented after the last thing said", async () => {
    const t = stand();
    const made = await finalTranscript("/v/main.mp4", join(t.dir, "work"), t.deps);
    assert.doesNotMatch(made.srt, /See you next week/);
    assert.match(made.srt, /make it this week\?/);
    assert.deepEqual(made.words.map((w) => w.w).slice(-3), ["take", "this", "week?"]);
    assert.doesNotMatch(made.txt, /See you next week/);
    t.done();
  });
  it("changes nothing when the recording has no closing pause", async () => {
    const t = stand({ pauses: "[silencedetect @ 0x1] silence_start: 4.5\n[silencedetect @ 0x1] silence_end: 74.5 | silence_duration: 70\n" });
    const made = await finalTranscript("/v/main.mp4", join(t.dir, "work"), t.deps);
    assert.match(made.srt, /See you next week/);
    assert.equal(made.words.filter((w) => w.w === "week.").length, 2);
    t.done();
  });
});
