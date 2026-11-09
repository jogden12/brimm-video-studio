// S1's checks (spike only; see README.md), run by build-ffmpeg.sh with the Mac Studio's own node, and Studio's own code from tool/.
//   check: asks the new ffmpeg for everything Studio's code uses of it. The filters and the hardware decoder are asked with Studio's
//          own hasFilters and hasHwaccel (workcopy.js), as the working copy asks them; the encoders, formats and decoders one at a time
//          with ffmpeg's own help (-h encoder=…); the protocols from its list. Then a two-second test video is made with Studio's own
//          settings (cuts.js encodeArgs) and read back with Studio's own probe (probeArgs, factsOf), and its sound is made into the
//          transcriber's .wav (lib.js ffmpegArgs) and listened to for pauses (cuts.js pauseArgs), as the import does.
//   hdr:   makes the working copy of the spike clip twice with Studio's own job (workcopy.js makeWorkCopy), once with Homebrew's ffmpeg
//          and once with the new one, each in a home of its own, and compares the two: their facts, whether the files are the same,
//          and how alike their pictures are (ffmpeg's ssim and psnr).
// It ends 0 when everything is there or alike, 1 when something is missing or differs, and 2 when it cannot run.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { colourOf, encodeArgs, factsOf, pauseArgs, probeArgs } from "../../tool/cuts.js";
import { ffmpegArgs } from "../../tool/lib.js";
import { runProgram } from "../../tool/run.js";
import { hasFilters, hasHwaccel, isHdr, makeWorkCopy } from "../../tool/workcopy.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    ffmpeg: { type: "string" }, ffprobe: { type: "string" }, out: { type: "string" }, clip: { type: "string" },
    "homebrew-ffmpeg": { type: "string" }, "homebrew-ffprobe": { type: "string" }
  }
});
const say = (line = "") => console.log(line);
const cannot = (line) => {
  say(line);
  process.exit(2);
};
for (const key of ["ffmpeg", "ffprobe", "out"]) if (!values[key]) cannot(`s1-check.mjs needs --${key}.`);
const { ffmpeg, ffprobe, out } = values;

// --- What Studio's code uses of ffmpeg, and where (grep -vf, -af, -filter_complex, -c:v, -c:a and -f in tool/*.js, 9 November) ---

const FILTERS = [
  ["fps", "workcopy.js workCopyArgs and hdrChain, cuts.js roughCutArgs, reframe.js stillsArgs"],
  ["scale", "workcopy.js workCopyArgs, cuts.js roughCutArgs, reframe.js stillsArgs and verticalArgs"],
  ["scale_vt", "workcopy.js hdrChain"],
  ["hwdownload", "workcopy.js hdrChain"],
  ["format", "workcopy.js workCopyArgs and hdrChain, cuts.js roughCutArgs"],
  ["transpose", "workcopy.js turnFilters"],
  ["hflip", "workcopy.js turnFilters"],
  ["vflip", "workcopy.js turnFilters"],
  ["rotate", "workcopy.js turnFilters"],
  ["lutyuv", "workcopy.js hdrLook"],
  ["limiter", "workcopy.js HDR_LOOK_LIMITS"],
  ["select", "cuts.js roughCutArgs"],
  ["setpts", "cuts.js roughCutArgs, reframe.js verticalArgs"],
  ["aresample", "workcopy.js workCopyArgs and voiceCopyArgs, cuts.js roughCutArgs"],
  ["asetnsamples", "cuts.js roughCutArgs"],
  ["aselect", "cuts.js roughCutArgs"],
  ["asetpts", "cuts.js roughCutArgs, reframe.js verticalArgs"],
  ["silencedetect", "lib.js silenceArgs, cuts.js pauseArgs, final-transcript.js shortSilenceArgs"],
  ["apad", "cuts.js pauseArgs"],
  ["segment", "reframe.js verticalArgs"],
  ["asegment", "reframe.js verticalArgs"],
  ["nullsink", "reframe.js verticalArgs"],
  ["anullsink", "reframe.js verticalArgs"],
  ["crop", "reframe.js verticalArgs"],
  ["concat", "reframe.js verticalArgs"],
  ["setsar", "reframe.js verticalArgs"]
];
const HWACCEL = ["videotoolbox", "workcopy.js HDR_INPUT (an HDR video is decoded on the Mac's hardware)"];
const OTHERS = [
  ["encoder", "libx264", "cuts.js encodeArgs"],
  ["encoder", "aac", "cuts.js encodeArgs, workcopy.js voiceCopyArgs"],
  ["encoder", "pcm_s16le", "lib.js ffmpegArgs (the transcriber's .wav)"],
  ["encoder", "mjpeg", "reframe.js stillsArgs (the stills, as .jpg)"],
  ["muxer", "mp4", "-f mp4 in workcopy.js, cuts.js and reframe.js"],
  ["muxer", "mov", "join.js joinArgs (a .mov)"],
  ["muxer", "wav", "lib.js ffmpegArgs"],
  ["muxer", "image2", "reframe.js stillsArgs"],
  ["muxer", "null", "-f null in lib.js silenceArgs, cuts.js pauseArgs"],
  ["demuxer", "mov", "every recording: an iPhone's, Zoom's, the OBSBOT's, an editor's export, HyperFrames' exports"],
  ["demuxer", "concat", "join.js joinArgs"],
  ["demuxer", "wav", "the transcriber's .wav, listened to for pauses"],
  ["decoder", "h264", "most recordings and exports"],
  ["decoder", "hevc", "an iPhone's recordings"],
  ["decoder", "prores", "an editor's export, or a .mov export"],
  ["decoder", "aac", "the sound of nearly every recording"],
  ["decoder", "pcm_s16le", "the transcriber's .wav"]
];
const PROTOCOLS = [["file", "every input and output, and -progress (progress.js)"], ["pipe", "-f null - (lib.js silenceArgs, cuts.js pauseArgs)"]];

/** What ffmpeg prints for its own arguments, on standard output. */
const ask = (program, args) => runProgram(program, ["-nostdin", "-hide_banner", ...args], { out: 2000000, keep: 20000 });
const Kind = (kind) => kind[0].toUpperCase() + kind.slice(1);

async function check() {
  mkdirSync(out, { recursive: true });
  let missing = 0;
  const filters = await ask(ffmpeg, ["-filters"]);
  if (filters.code !== 0) cannot(`ffmpeg -filters ended with ${filters.code}: ${filters.stderr.trim()}`);
  const lacking = FILTERS.filter(([name]) => !hasFilters(filters.stdout, [name]));
  if (lacking.length) {
    missing += lacking.length;
    for (const [name, where] of lacking) say(`Missing filter: ${name} (${where}).`);
  } else {
    say(`Filters: all ${FILTERS.length} that Studio's code uses are there, by Studio's own hasFilters.`);
  }
  const methods = await ask(ffmpeg, ["-hwaccels"]);
  if (hasHwaccel(methods.stdout, HWACCEL[0])) say(`Hardware decoding: ${HWACCEL[0]} is there, by Studio's own hasHwaccel.`);
  else {
    missing += 1;
    say(`Missing hardware decoder: ${HWACCEL[0]} (${HWACCEL[1]}).`);
  }
  const counts = {};
  for (const [kind, name, where] of OTHERS) {
    const told = await ask(ffmpeg, ["-h", `${kind}=${name}`]);
    const there = told.code === 0 && new RegExp(`^${Kind(kind)} ${name}\\b`, "m").test(told.stdout);
    counts[kind] = (counts[kind] || 0) + (there ? 1 : 0);
    if (!there) {
      missing += 1;
      say(`Missing ${kind}: ${name} (${where}).`);
    }
  }
  const wanted = (kind) => OTHERS.filter(([k]) => k === kind).map(([, name]) => name);
  for (const kind of ["encoder", "muxer", "demuxer", "decoder"]) {
    if (counts[kind] === wanted(kind).length) say(`${Kind(kind)}s: all ${wanted(kind).length} there (${wanted(kind).join(", ")}).`);
  }
  const protocols = await ask(ffmpeg, ["-protocols"]);
  const listed = new Set(String(protocols.stdout).split("\n").map((line) => line.trim()));
  const noProtocol = PROTOCOLS.filter(([name]) => !listed.has(name));
  if (noProtocol.length) {
    missing += noProtocol.length;
    for (const [name, where] of noProtocol) say(`Missing protocol: ${name} (${where}).`);
  } else {
    say(`Protocols: ${PROTOCOLS.map(([name]) => name).join(" and ")} are there.`);
  }

  // A two-second video made with Studio's own settings, read back with Studio's own probe, and its sound made into the transcriber's
  // .wav and listened to for pauses.
  const video = join(out, "test.mp4");
  const wav = join(out, "test.wav");
  const made = await runProgram(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=duration=2:size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", ...encodeArgs(18, "veryfast"), "-f", "mp4", video]);
  const probed = join(out, "test.json");
  const read = made.code === 0 ? await runProgram(ffprobe, probeArgs(video, probed)) : { code: 1 };
  const facts = read.code === 0 && existsSync(probed) ? factsOf(readFileSync(probed, "utf8")) : null;
  const sound = facts ? await runProgram(ffmpeg, ffmpegArgs(video, wav)) : { code: 1 };
  const heard = sound.code === 0 ? await runProgram(ffmpeg, pauseArgs(wav, 2), { keep: 100000 }) : { code: 1 };
  if (facts && heard.code === 0) {
    say(`A test video made with Studio's settings (libx264 at 18, veryfast; AAC at 48 kHz) reads back as ${facts.duration} s, ${facts.width}×${facts.height}, with sound; its sound was made into the transcriber's .wav and listened to for pauses.`);
  } else {
    missing += 1;
    say(`The test video failed: ${[made, read, sound, heard].map((r) => (r.stderr || "").trim()).filter(Boolean).pop() || "no reason given"}.`);
  }
  say();
  say(missing ? `S1 check: ${missing} thing${missing === 1 ? " is" : "s are"} missing.` : "S1 check: everything Studio's code uses of ffmpeg is there.");
  process.exit(missing ? 1 : 0);
}

/** What ffprobe printed of a file, as JSON text, or "". */
async function probe(program, file, dir) {
  const printed = join(dir, `probe-${Date.now()}.json`);
  const asked = await runProgram(program, probeArgs(file, printed));
  return asked.code === 0 && existsSync(printed) ? readFileSync(printed, "utf8") : "";
}

/** The number after `label` in what ffmpeg printed for ssim or psnr, as "1.000000" or "inf", or "". */
function measured(stderr, label) {
  const found = new RegExp(`${label}:\\s*([0-9.]+|inf)`).exec(String(stderr));
  return found ? found[1] : "";
}

async function hdr() {
  const clip = values.clip;
  const others = { ffmpeg: values["homebrew-ffmpeg"], ffprobe: values["homebrew-ffprobe"] };
  if (!clip || !existsSync(clip)) cannot(`The spike clip is not there: ${clip}`);
  if (!others.ffmpeg || !others.ffprobe) cannot("s1-check.mjs hdr needs --homebrew-ffmpeg and --homebrew-ffprobe.");
  mkdirSync(out, { recursive: true });
  const colour = colourOf(await probe(ffprobe, clip, out));
  if (!isHdr(colour)) {
    say(`The spike clip is not HDR: its colour is ${colour ? `${colour.primaries || "?"} with ${colour.transfer || "?"}` : "not said"}, and an iPhone's HDR is bt2020 with arib-std-b67. Pick a clip recorded with HDR on.`);
    process.exit(2);
  }
  say(`The spike clip is HDR (${colour.primaries}, ${colour.transfer}).`);
  const made = [];
  for (const [who, tools, folder] of [["Homebrew's ffmpeg", others, "homebrew"], ["The new ffmpeg", { ffmpeg, ffprobe }, "static"]]) {
    const home = join(out, folder);
    rmSync(home, { recursive: true, force: true });
    mkdirSync(home, { recursive: true });
    const lines = [];
    const began = Date.now();
    const r = await makeWorkCopy({ home, folder: "S1 HDR", video: clip, name: "Spike clip.mov" }, { tools, log: (line) => lines.push(line) });
    const seconds = Math.round((Date.now() - began) / 100) / 10;
    say(`${who} (${tools.ffmpeg}): ${r.words} in ${seconds} s.`);
    if (!r.ok) {
      for (const line of lines) say(`  ${line}`);
      say("S1 HDR: the working copy could not be made, so the two cannot be compared.");
      process.exit(1);
    }
    say(`  ${r.paths.video}`);
    made.push({ who, video: r.paths.video, facts: JSON.parse(readFileSync(r.paths.facts, "utf8")) });
  }
  const [a, b] = made;
  const plain = (facts) => JSON.stringify({ ...facts, bytes: undefined });
  let differs = 0;
  if (plain(a.facts) === plain(b.facts)) say(`Their facts are the same: ${plain(a.facts)}`);
  else {
    differs += 1;
    say(`Their facts differ: Homebrew's ${plain(a.facts)}, the new one's ${plain(b.facts)}.`);
  }
  say(`Their sizes: Homebrew's ${a.facts.bytes} bytes, the new one's ${b.facts.bytes} bytes.`);
  const same = readFileSync(a.video).equals(readFileSync(b.video));
  if (same) say("The two files are the same, byte for byte.");
  else say("The two files are not the same byte for byte (x264 writes its own version into each, and the new one's x264, built from an archive with no git, has no revision number in it), so their pictures are compared:");
  if (!same) {
    const ssim = await runProgram(ffmpeg, ["-nostdin", "-hide_banner", "-i", a.video, "-i", b.video, "-lavfi", "[0:v][1:v]ssim", "-f", "null", "-"], { keep: 20000 });
    const psnr = await runProgram(ffmpeg, ["-nostdin", "-hide_banner", "-i", a.video, "-i", b.video, "-lavfi", "[0:v][1:v]psnr", "-f", "null", "-"], { keep: 20000 });
    const all = measured(ssim.stderr, "All");
    const average = measured(psnr.stderr, "average");
    say(`  SSIM All: ${all || "not measured"} (1.000000 is the same pictures)`);
    say(`  PSNR average: ${average || "not measured"} dB (inf is the same pictures)`);
    if (!(all === "1.000000" || Number(all) >= 0.999)) differs += 1;
  }
  say();
  say(differs ? "S1 HDR: the new ffmpeg's working copy differs from Homebrew's." : "S1 HDR: the new ffmpeg makes the same working copy as Homebrew's.");
  process.exit(differs ? 1 : 0);
}

if (positionals[0] === "check") await check();
else if (positionals[0] === "hdr") await hdr();
else cannot("s1-check.mjs: say check or hdr.");
