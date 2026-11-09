// S2's comparison (spike only; see README.md): one or more whisper-cli programs on the same clip, with the same model and Studio's own
// arguments, and what differs between what they write. Run by build-whisper.sh --compare on the Mac Studio (Homebrew's whisper-cli and
// the new one), and by in-test-account.zsh whisper in the spare account (the app's whisper-cli alone, against the Mac Studio's .srt).
//   node s2-compare.mjs --clip <video> --ffmpeg <ffmpeg> --ffprobe <ffprobe> --model <model> [--model-sha <sha256>]
//                       --whisper "<name>=<whisper-cli>" [--whisper …] [--expect "<name>=<.srt>"] --out <folder> [--tool <tool folder>]
// What it does, with Studio's own code from the tool folder (this checkout's tool/ unless --tool names another):
//   - the clip's sound is made into the transcriber's .wav as the import makes it: ffprobe finds the sound stream it can read
//     (cuts.js probeArgs, streamsOf), and ffmpeg is given lib.js ffmpegArgs with that stream;
//   - each whisper-cli is run twice on it: with the import's arguments (cuts.js wordArgs: an .srt and the word times in a .json) and with
//     the final transcript's (lib.js whisperArgs: an .srt), each timed;
//   - the second whisper-cli's .srt files are diffed with the first's, and its word times compared; an --expect file is diffed with the
//     first whisper-cli's import .srt;
//   - each whisper-cli is run once more on the first ten seconds without -np, so that it says which of the Mac's backends it used.
// It ends 0 when everything compared is the same, 1 when something differs or failed, and 2 when it cannot run.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    clip: { type: "string" }, ffmpeg: { type: "string" }, ffprobe: { type: "string" }, model: { type: "string" }, "model-sha": { type: "string" },
    whisper: { type: "string", multiple: true }, expect: { type: "string" }, out: { type: "string" }, tool: { type: "string" }
  }
});
const say = (line = "") => console.log(line);
const cannot = (line) => {
  say(line);
  process.exit(2);
};
for (const key of ["clip", "ffmpeg", "ffprobe", "model", "out"]) if (!values[key]) cannot(`s2-compare.mjs needs --${key}.`);
if (!values.whisper || !values.whisper.length) cannot("s2-compare.mjs needs at least one --whisper \"<name>=<whisper-cli>\".");
const named = (text) => {
  const at = text.indexOf("=");
  if (at < 1) cannot(`"${text}" is not "<name>=<path>".`);
  return { name: text.slice(0, at), path: text.slice(at + 1) };
};
const whispers = values.whisper.map(named);
const expected = values.expect ? named(values.expect) : null;
const toolDir = resolve(values.tool || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "tool"));
const from = (file) => import(pathToFileURL(join(toolDir, file)).href);
const { probeArgs, streamsOf, wordArgs } = await from("cuts.js");
const { ffmpegArgs, whisperArgs } = await from("lib.js");
const { runProgram } = await from("run.js");

for (const file of [values.clip, values.ffmpeg, values.ffprobe, values.model, ...whispers.map((w) => w.path), ...(expected ? [expected.path] : [])]) {
  if (!existsSync(file)) cannot(`Not there: ${file}`);
}

/** The SHA-256 of a file, read as a stream: the model is 1.5 GB. */
const sha256Of = (file) => new Promise((done, failed) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (d) => hash.update(d)).on("error", failed).on("end", () => done(hash.digest("hex")));
});

const out = values.out;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (values["model-sha"]) {
  const have = await sha256Of(values.model);
  if (have !== values["model-sha"]) cannot(`The model's SHA-256 is ${have}, and it should be ${values["model-sha"]}: it is not the model Studio uses.`);
  say("The model is the one Studio uses (its SHA-256 matches).");
}

// The transcriber's .wav, as the import makes it.
const probed = join(out, "clip.json");
const asked = await runProgram(values.ffprobe, probeArgs(values.clip, probed));
if (asked.code !== 0) cannot(`ffprobe could not read the clip: ${asked.stderr.trim()}`);
const streams = streamsOf(readFileSync(probed, "utf8"));
if (streams.audio === null) cannot("The clip has no sound this Mac's ffmpeg can read.");
const wav = join(out, "clip.wav");
const made = await runProgram(values.ffmpeg, ffmpegArgs(values.clip, wav, streams.audio));
if (made.code !== 0) cannot(`ffmpeg could not make the .wav: ${made.stderr.trim()}`);
say(`The clip's sound (stream ${streams.audio}) is made into the transcriber's .wav with Studio's ffmpegArgs, by ${values.ffmpeg}.`);

const MODES = [["import", wordArgs, "the import's wordArgs"], ["final", whisperArgs, "the final transcript's whisperArgs"]];
let failed = 0;
const written = {};
for (const w of whispers) {
  for (const [mode, args, said] of MODES) {
    const outBase = join(out, `${w.name.replace(/[^A-Za-z0-9]+/g, "-")}-${mode}`, "captions");
    mkdirSync(dirname(outBase), { recursive: true });
    const began = Date.now();
    const ran = await runProgram(w.path, args({ model: values.model, wav, outBase }), { keep: 20000 });
    const seconds = Math.round((Date.now() - began) / 100) / 10;
    const srt = `${outBase}.srt`;
    if (ran.code !== 0 || !existsSync(srt)) {
      failed += 1;
      say(`${w.name}, ${said}: failed (${ran.code}): ${ran.stderr.trim().split("\n").slice(-3).join(" ")}`);
      continue;
    }
    written[`${w.name}/${mode}`] = { srt, json: `${outBase}.json` };
    say(`${w.name}, ${said}: ${seconds} s, ${srt}`);
  }
}

/** The lines of a unified diff of two files, at most `most` of them, or [] when they are the same. */
async function diffOf(a, b, most = 60) {
  const ran = await runProgram("/usr/bin/diff", ["-u", a, b], { out: 1000000 });
  if (ran.code === 0) return [];
  return String(ran.stdout || ran.stderr).split("\n").slice(0, most);
}

/** What differs in the word times of two of whisper's full .json files: their segments, their words, and the largest difference in a
    word's start (offsets.from) and in its DTW time (t_dtw), in milliseconds. */
function timesOf(aFile, bFile) {
  const read = (file) => {
    try {
      return JSON.parse(readFileSync(file, "utf8")).transcription || [];
    } catch (e) {
      return null;
    }
  };
  const a = read(aFile);
  const b = read(bFile);
  if (!a || !b) return "the word times could not both be read";
  const tokens = (segments) => segments.flatMap((s) => s.tokens || []);
  const [ta, tb] = [tokens(a), tokens(b)];
  const texts = a.length === b.length && a.every((s, i) => s.text === b[i].text);
  let start = 0;
  let dtw = 0;
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    start = Math.max(start, Math.abs((ta[i].offsets?.from ?? 0) - (tb[i].offsets?.from ?? 0)));
    dtw = Math.max(dtw, Math.abs(((ta[i].t_dtw ?? 0) - (tb[i].t_dtw ?? 0)) * 10));
  }
  return `${a.length} and ${b.length} segments, ${texts ? "the same words" : "NOT the same words"}, ${ta.length} and ${tb.length} tokens; the largest difference in a token's start is ${start} ms, and in its DTW time ${dtw} ms`;
}

let differs = 0;
say();
if (whispers.length >= 2) {
  const [first, second] = whispers;
  for (const [mode, , said] of MODES) {
    const a = written[`${first.name}/${mode}`];
    const b = written[`${second.name}/${mode}`];
    if (!a || !b) continue;
    const lines = await diffOf(a.srt, b.srt);
    if (!lines.length) say(`${said}: the two .srt files are the same.`);
    else {
      differs += 1;
      say(`${said}: the two .srt files differ. The diff (${first.name}'s first):`);
      for (const line of lines) say(`  ${line}`);
    }
    if (mode === "import") say(`  Word times: ${timesOf(a.json, b.json)}.`);
  }
}
if (expected) {
  const a = written[`${whispers[0].name}/import`];
  if (a) {
    const lines = await diffOf(expected.path, a.srt);
    if (!lines.length) say(`The import's .srt is the same as ${expected.name}'s.`);
    else {
      differs += 1;
      say(`The import's .srt differs from ${expected.name}'s. The diff (${expected.name}'s first):`);
      for (const line of lines) say(`  ${line}`);
    }
  }
}

// Which of the Mac's backends each whisper-cli used: its own words, from a run of the first ten seconds without -np.
say();
for (const w of whispers) {
  const outBase = join(out, `${w.name.replace(/[^A-Za-z0-9]+/g, "-")}-backends`, "captions");
  mkdirSync(dirname(outBase), { recursive: true });
  const args = whisperArgs({ model: values.model, wav, outBase }).filter((a) => a !== "-np");
  const ran = await runProgram(w.path, [...args, "-d", "10000"], { keep: 200000 });
  const lines = String(ran.stderr).split("\n").filter((line) => /metal|gpu|blas|accelerate|backend/i.test(line)).slice(0, 12);
  say(`${w.name}'s backends (its own words, first ten seconds):`);
  for (const line of lines.length ? lines : ["(it said nothing about them)"]) say(`  ${line.trim()}`);
}

say();
if (failed) say(`${failed} run${failed === 1 ? "" : "s"} failed.`);
else if (differs) say("What they wrote differs (the diff is above).");
else say("What they wrote is the same.");
process.exit(failed || differs ? 1 : 0);
