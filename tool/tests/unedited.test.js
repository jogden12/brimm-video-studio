// The unedited-video workflow end to end, in a folder made for the test, with stand-ins for ffprobe, ffmpeg, the transcriber,
// the face finder and Claude Code. The stand-ins write the files and print the lines the real programs do, for the made-up
// recording in fixtures.js. None of the real programs is run here, and neither is Final Cut Pro. Claude is never asked
// anything from here: what it would say is written down in each test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync, rmSync, statSync, utimesSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { uneditedFile, uneditedFolder, uneditedFolders, videosFromPlan, doAsked, findPrograms, depsFor, parseArgs, CLAUDE_MODEL } from "../unedited.js";
import { lockFile, runProgram } from "../run.js";
import { stampedText, whisperArgs } from "../lib.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, keptSpans, roughCutArgs, roughCaptions } from "../cuts.js";
import { notesRequest, readNotes, applyDecisions, clipRanges, notesText } from "../notes.js";
import { fcpxml, checkFcpxml } from "../fcpxml.js";
import { stillsArgs, cropsFor, verticalArgs } from "../reframe.js";
import { probed, told, TOLD, SRT, PAUSES } from "./fixtures.js";
import { progressFolder, noProgress } from "../progress.js";
import { writeSettings } from "../settings.js";
import { readEpisode } from "../episode.js";

const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
/** Where ffmpeg heard silence in the made-up recording. */
const HEARD = pausesOf(PAUSES);
/** What the rules make of the made-up recording. The rules have tests of their own: here it is what the files must hold. */
const PLAN = cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: FACTS.duration, pauses: HEARD });
const SPELLED = SRT.replace("Sally", "Sallie");
const ALL = ["cut-plan.json", "cut-plan.txt", "fcpxml", "mov", "rough-cut.mp4", "rough-cut.srt", "rough-cut.transcript.txt", "rough-cut.vertical.mp4", "srt", "transcript.txt", "words.json"];
const after = (args, flag) => args[args.indexOf(flag) + 1];
/** The calls that asked ffmpeg for a rough cut, and the one that asked it for the upright version. The stills are asked for
    with -vf too, so a rough cut is known by what it selects. */
const roughCalls = (t) => t.calls.filter((c) => c.args.includes("-vf") && after(c.args, "-vf").includes("select="));
const uprightCall = (t) => t.calls.find((c) => c.args.includes("-filter_complex"));
/** A face box whose middle is `centre` of the way across the picture, as the face finder prints one. */
const face = (centre) => ({ x: centre - 0.05, y: 0.2, w: 0.1, h: 0.2 });
/** The crop of the made-up recording's picture, 1280 by 720, that starts `x` pixels in. */
const crop = (x, found = true) => ({ x, y: 0, w: 404, h: 720, found });
/** The kept stretches of the made-up recording as the rough cut takes them, each on a whole picture, with each time written
    to the thousandth of a second below it. */
const STRETCHES = [{ start: 5.872, end: 9.843 }, { start: 13.38, end: 21.287 }];
/** The attributes of every tag of one name in a Final Cut file, in the order they come. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))]
  .map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
/** Where a file is, as a Final Cut file names it. */
const address = (path) => "file://" + path.split("/").map(encodeURIComponent).join("/");

/** A reply as Claude is asked to write it, for the made-up recording: a phrase to cut that the rules kept, its notes, an idea
    for a graphic, and one clip. */
const REPLY = {
  decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }],
  notes: "A short talk about pricing.\nThe opening is said twice, and the second telling is the one to use.",
  graphics: [{ id: "p7", idea: 'The words "Know your costs" on screen.' }],
  clips: [{ from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }]
};
/** Two clips of the made-up recording: its opening, and from "So the first thing" to the end. */
const TWO = { ...REPLY, clips: [{ from: "p4", to: "p5", hook: "The opening", why: "It says what the talk is about." }, REPLY.clips[0]] };
/** What Claude Code prints when it is run with --output-format json: one JSON object, with Claude's own text as `result`. */
const printed = (result, more = {}) => JSON.stringify({ type: "result", subtype: "success", is_error: false, duration_ms: 19000, num_turns: 1, result, session_id: "0d9d7f8e", ...more });
/** What Claude Code ends with when Claude has answered: with a text as it is, or with a reply written as JSON. */
const answers = (reply) => ({ code: 0, stderr: "", stdout: printed(typeof reply === "string" ? reply : JSON.stringify(reply)) });
/** What the tool is to make of a reply, by the pieces in notes.js, which have tests of their own: the reply as it is read, the
    plan with its decisions applied, the clips that can be cut from that plan, and everything that was left out on the way. */
const used = (reply, plan = PLAN, pauses = HEARD) => {
  const read = readNotes(JSON.stringify(reply));
  const applied = applyDecisions(plan, read.decisions, pauses);
  const picked = clipRanges(applied.plan, read.clips, pauses);
  return { read, plan: applied.plan, clips: picked.clips, ignored: [...read.problems, ...applied.ignored, ...picked.ignored] };
};
/** The made-up recording once REPLY is used: "It is very, very important." is cut, from 16.53 to 19.214 seconds. */
const USED = used(REPLY);
/** Stretches of a video as ffmpeg is given them for an upright version or a clip: each edge moved to the nearest whole picture,
    and written to the thousandth of a second below it. */
const stretches = (ranges, fps = FACTS.fps) => keptSpans(ranges.map((r) => ({ ...r, keep: true })), fps).map((s) => ({ start: Math.floor(s.start * 1000) / 1000, end: Math.floor(s.end * 1000) / 1000 }));
/** What the face finder's stand-in prints: the eleven stills of the made-up recording, each with the faces `faces` gives it. */
const stillsOf = (faces = () => [face(0.25)]) => Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: faces(i + 1) }));
/** The calls that asked ffmpeg for a short clip or a part of its Story, each known by the name it is written under. */
const reelCalls = (t) => t.calls.filter((c) => /\.reel-\d+(\.story-\d+)?\.mp4$/.test(c.args[c.args.length - 1]));
/** Where a run writes the file `name` before it puts it where it belongs: in the folder "made" in the run's own folder. That
    folder is named for the moment it was made, and ffprobe, the first program a run asks, writes a file in it. */
const inRun = (t, name) => join(dirname(after(t.calls.find((c) => c.cmd === "FFPROBE").args, "-o")), "made", name);
/** Have something else be where a run writes the file `name` in its own folder: a folder of that name, made there when the run
    asks its first program. The file then cannot be written. */
const taken = (t, name) => {
  const run = t.deps.run;
  t.deps.run = async (cmd, args, asked) => {
    if (cmd === "FFPROBE") mkdirSync(join(dirname(after(args, "-o")), "made", name), { recursive: true });
    return run(cmd, args, asked);
  };
};
/** Have every file a run moves be moved as it would be, and written down as [from, to]. */
const movesOf = (t) => {
  const moves = [];
  t.deps.move = (from, to) => {
    moves.push([from, to]);
    renameSync(from, to);
  };
  return moves;
};
/** What is in the test's folder before and after each program a run asks. */
const namesWhileWorking = (t) => {
  const seen = [];
  const run = t.deps.run;
  t.deps.run = async (cmd, args, asked) => {
    seen.push(t.names());
    const r = await run(cmd, args, asked);
    seen.push(t.names());
    return r;
  };
  return seen;
};
/** A move that cannot be made because the two folders are on different disks, as rename says it. */
const otherDisk = () => Object.assign(new Error("cross-device link not permitted"), { code: "EXDEV" });
/** The files a video has when Claude was asked: the rules' own, and the notes. The clips come on top of these. */
const WITH_NOTES = [...ALL, "edit-notes.txt"].sort();

/** A folder for one test, and the things the tool is given: stand-ins for the programs, a clock that does not wait, the day
    it is, and a home folder of its own. `script` says what the programs find, or which of them fails.
    Claude is asked only in a test that says what Claude Code does: `script.claude` lists what it ends with each time it is
    run, and the last of them is what it ends with every time after. Without that the run is told not to ask, as --rules-only
    tells it, and makes what the rules alone make. */
function setup(script = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-unedited-"));
  const work = join(dir, "work");
  mkdirSync(work);
  const calls = [];
  const notes = [];
  const waits = [];
  const asks = [];
  const ran = (cmd, args, asked) => {
    if (cmd === "CLAUDE") {
      // What Claude Code was given each time, and what was in the folder it was run in.
      asks.push({ args, input: asked.input, cwd: asked.cwd, limit: asked.limit, out: asked.out, there: readdirSync(asked.cwd), waits: waits.length });
      const ends = script.claude[Math.min(asks.length, script.claude.length) - 1];
      // Something nobody foresaw, which the real way of running a program never does: it throws.
      if (ends === "throw") throw new Error("spawn EAGAIN");
      return ends;
    }
    if (cmd === "FFPROBE") {
      if (script.probe === "fail") return { code: 1, stderr: "moov atom not found\n" };
      writeFileSync(after(args, "-o"), script.probed === undefined ? probed() : script.probed);
      return { code: 0, stderr: "" };
    }
    if (cmd === "SWIFT") {
      if (script.swift === "fail") return { code: 1, stderr: "The folder of stills could not be read: /stills\n" };
      if (script.swift === "killed") return { code: 1, stderr: "", signal: "SIGKILL" };
      // The face finder prints one JSON document and nothing else: every still in the folder by name, with the faces in it.
      // Unless a test says otherwise, one face a quarter of the way across every still.
      const faces = script.faces || (() => [face(0.25)]);
      const stills = readdirSync(args[1]).sort().map((file) => ({ file, faces: faces(parseInt(file, 10)) }));
      return { code: 0, stderr: "", stdout: script.printed === undefined ? JSON.stringify(stills) : script.printed };
    }
    if (cmd === "FFMPEG") {
      const filter = args.includes("-af") ? after(args, "-af") : "";
      // Asked where the sound is silent, ffmpeg writes no file and prints what it heard: the long silences, or the pauses.
      if (filter.includes("silencedetect=noise=-45dB")) return { code: 0, stderr: script.heard || "" };
      if (filter.includes("silencedetect=noise=-35dB")) {
        // Something nobody foresaw, which the real way of running a program never does: it throws.
        if (script.pauses === "throw") throw new Error("spawn EAGAIN");
        return script.pauses === "fail" ? { code: 1, stderr: "Error while filtering\n" } : { code: 0, stderr: script.pauses === undefined ? PAUSES : script.pauses };
      }
      // A short clip, or a part of its Story, is known by the name it is written under. `script.reels` says which of them
      // ffmpeg cannot make, by the clip's number, or by that and the part's: { 2: "fail", "1.2": "throw" }.
      const reel = /\.reel-(\d+)(?:\.story-(\d+))?\.mp4$/.exec(args[args.length - 1]);
      if (reel) {
        const how = (script.reels || {})[reel[2] ? `${reel[1]}.${reel[2]}` : reel[1]];
        if (how === "fail" || how === "throw") {
          writeFileSync(args[args.length - 1], "half a clip");
          if (how === "throw") throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
          return { code: 1, stderr: "Error while filtering: Cannot allocate memory\n" };
        }
        if (how !== "nothing") writeFileSync(args[args.length - 1], reel[2] ? `part ${reel[2]} of the Story of clip ${reel[1]}` : `clip ${reel[1]}`);
        return { code: 0, stderr: "" };
      }
      // The upright version is given a whole graph of filters, as a clip is.
      if (args.includes("-filter_complex")) {
        if (script.vertical === "fail" || script.vertical === "throw") {
          writeFileSync(args[args.length - 1], "half an upright version");
          if (script.vertical === "throw") throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
          return { code: 1, stderr: "Error initializing complex filters\n" };
        }
        if (script.vertical !== "nothing") writeFileSync(args[args.length - 1], "the upright version");
        return { code: 0, stderr: "" };
      }
      // The stills the faces are looked for in: one for every two seconds of the made-up recording, which makes eleven.
      if (args[args.length - 1].endsWith("%04d.jpg")) {
        if (script.stills === "fail") return { code: 1, stderr: "Invalid data found when processing input\n" };
        for (let n = 1; n <= 11; n++) writeFileSync(args[args.length - 1].replace("%04d", String(n).padStart(4, "0")), "a still");
        return { code: 0, stderr: "" };
      }
      if (args.includes("-vf")) {
        // When ffmpeg stops part-way it leaves the part it had written.
        if (script.rough === "fail" || script.rough === "throw") {
          writeFileSync(args[args.length - 1], "half a rough cut");
          if (script.rough === "throw") throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
          return { code: 1, stderr: "Unknown encoder 'h264_videotoolbox'\n" };
        }
        if (script.rough !== "nothing") writeFileSync(args[args.length - 1], "the rough cut");
        return { code: 0, stderr: "" };
      }
      if (script.ffmpeg === "fail") return { code: 1, stderr: "moov atom not found\n" };
      writeFileSync(args[args.length - 1], "RIFF");
      return { code: 0, stderr: "" };
    }
    if (script.whisper === "fail") return { code: 3, stderr: "error: failed to initialize whisper context\n" };
    if (script.whisper === "killed") return { code: 1, stderr: "", signal: "SIGKILL" };
    // On some recordings the transcriber dies while it times the words, and reads the same sound when it is not asked to.
    // What it printed last then says nothing of why.
    if (args.includes("-dtw") && script.timing === "killed") return { code: 1, stderr: "read_audio_data: trying to decode with miniaudio\n", signal: "SIGABRT" };
    if (args.includes("-dtw") && script.timing === "fail") return { code: 2, stderr: "error: failed to compute token-level timestamps\n" };
    writeFileSync(after(args, "-of") + ".srt", script.srt === undefined ? SRT : script.srt);
    if (args.includes("-ojf") && script.told !== null) writeFileSync(after(args, "-of") + ".json", typeof script.told === "string" ? script.told : JSON.stringify(script.told || TOLD));
    return { code: 0, stderr: "" };
  };
  // Only the end of what a program prints comes back, as much of it as is asked for: so it is with the real way of running one.
  // And its answer, what it prints on standard output, comes back only when it is asked for.
  const run = async (cmd, args, { keep = 4000, out = 0, ...more } = {}) => {
    calls.push({ cmd, args, out });
    const { stdout = "", ...r } = ran(cmd, args, { out, ...more });
    return { ...r, stderr: r.stderr.slice(-keep), ...(out ? { stdout: stdout.slice(0, out) } : {}) };
  };
  const logs = [];
  const locks = join(dir, "locks");
  mkdirSync(locks);
  // The home folder is not made here: the tool makes what it needs in it.
  const home = join(dir, "home");
  const deps = {
    run, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "SWIFT", claude: script.claude ? "CLAUDE" : "" }, model: "/models/model.bin", tmpDir: work, lockDir: locks, home, today: () => "2026-10-13",
    rulesOnly: !script.claude, wait: async (ms) => { waits.push(ms); }, notify: (text) => notes.push(text), log: (line) => logs.push(line),
    ...(script.sizes ? { sizeOf: () => script.sizes.shift() } : {})
  };
  const video = (name, bytes = "video") => {
    writeFileSync(join(dir, name), bytes);
    return join(dir, name);
  };
  const names = () => readdirSync(dir).filter((n) => n !== "work" && n !== "locks" && n !== "home").sort();
  const inside = (...folders) => readdirSync(join(dir, ...folders)).sort();
  const read = (...path) => readFileSync(join(dir, ...path), "utf8");
  return { dir, work, locks, home, logs, calls, notes, waits, asks, deps, video, names, inside, read, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** A made-up talk of `count` sentences, for a clip of more than a minute: what ffprobe, the transcriber and ffmpeg would say
    of it. Each sentence is 25 words of its own, said in five seconds, with half a second of silence after it. So sentence
    k is phrase pk, from (k - 1) * 5.5 seconds to five seconds after that, and the rules keep all of it.
    A test may ask for another talk, in milliseconds: `lead` is the silence before the first words, `gap` the silence after
    each sentence but the last, and `tail` the silence after the last. With no gap every sentence runs straight on from
    the one before it, and there is no pause in the talk. */
const longTalk = (count, { lead = 0, gap = 500, tail = 0 } = {}) => {
  const stamp = (ms) => `00:${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  const sentences = Array.from({ length: count }, (_, k) => ({ from: lead + k * (5000 + gap), words: Array.from({ length: 25 }, (_, j) => `s${k + 1}w${j + 1}${j === 24 ? "." : ""}`) }));
  const end = lead + count * (5000 + gap) - gap;
  const silence = (a, b) => `[silencedetect @ 0x1] silence_start: ${a / 1000}\n[silencedetect @ 0x1] silence_end: ${b / 1000} | silence_duration: ${(b - a) / 1000}\n`;
  return {
    probed: probed({ duration: `${((end + tail) / 1000).toFixed(6)}` }),
    told: told(sentences.map(({ from, words }) => [from, from + 5000, words.map((w, j) => [" " + w, (from + (j + 1) * 200) / 10])])),
    srt: sentences.map(({ from, words }, k) => `${k + 1}\n${stamp(from)} --> ${stamp(from + 5000)}\n ${words.join(" ")}\n\n`).join(""),
    pauses: [...(lead ? [silence(0, lead)] : []), ...(gap ? sentences.slice(1).map(({ from }) => silence(from - gap, from)) : []), ...(tail ? [silence(end, end + tail)] : [])].join("")
  };
};
/** The same talk as the rules plan it. */
const planned = (talk, duration) => {
  const pauses = pausesOf(talk.pauses);
  return { pauses, plan: cutPlan(phrasesOf(wordsOf(talk.told), pauses), { duration, pauses }) };
};

describe("one unedited video", () => {
  it("gets a transcript, its words, a cut plan, a rough cut with its captions, an upright version and a Final Cut file beside it, and nothing is left behind", async () => {
    const t = setup();
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 11.882, cut: 11.541, folder: "", message: "" });
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    assert.equal(t.read("talk.mov"), "video");
    assert.deepEqual(readdirSync(t.work), []);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("gets the captions and the plain-text transcript the transcript tool writes, on the recording's own timing", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(t.read("talk.srt"), SPELLED);
    assert.equal(t.read("talk.transcript.txt"), stampedText(SPELLED));
    assert.match(t.read("talk.transcript.txt"), /^\[0:00\] Welcome to the show\. Today we are\.\.\. Let me do that again\.\n\[0:04\] /);
    assert.match(t.read("talk.transcript.txt"), /Thank you so much, Sallie\.\n$/);
    t.done();
  });
  it("gets every word with its times, in seconds of the video", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    const file = JSON.parse(t.read("talk.words.json"));
    assert.deepEqual(Object.keys(file), ["video", "duration", "words"]);
    assert.deepEqual([file.video, file.duration, file.words.length], ["talk.mov", 23.423, 48]);
    assert.deepEqual([file.words[0], file.words[47]], [{ w: "Welcome", start: 0, end: 1.4 }, { w: "Sallie.", start: 20.36, end: 20.94 }]);
    t.done();
  });
  it("gets the cut plan twice: to work from, and to read", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), { version: 1, video: "talk.mov", facts: FACTS, phrases: PLAN.phrases, ranges: PLAN.ranges, kept: 11.882, cut: 11.541, by: "rules" });
    assert.deepEqual(Object.keys(JSON.parse(t.read("talk.cut-plan.json"))), ["version", "video", "facts", "phrases", "ranges", "kept", "cut", "by"]);
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN));
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(0, 2), ["Kept 0:12 of 0:23. Cut 0:11.", "0:00 to 0:03  CUT  retake: said again at 0:06, the later one is kept  |  Welcome to the show. Today we are..."]);
    t.done();
  });
  it("gets the captions of the kept phrases on the rough cut's timing, and the same as plain text", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(t.read("talk.rough-cut.srt"), roughCaptions(PLAN.phrases, keptSpans(PLAN.ranges, FACTS.fps)));
    assert.match(t.read("talk.rough-cut.srt"), /^1\n00:00:00,197 --> 00:00:01,167\nWelcome to the show\.\n\n2\n/);
    assert.equal(t.read("talk.rough-cut.transcript.txt"), "[0:00] Welcome to the show.\n[0:01] Today we are going to talk about pricing.\n[0:04] So the first thing you need to do is know your costs.\n[0:07] It is very, very important.\n[0:10] Thank you so much, Sallie.\n");
    t.done();
  });
  it("has its rough cut's captions placed by the pictures the rough cut is made of, when the file gives no frame rate and 30 a second is used", async () => {
    const t = setup({ probed: probed({ picture: { r_frame_rate: "1000/1", avg_frame_rate: "0/0" } }) });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).facts.fps, "");
    assert.match(after(t.calls[5].args, "-vf"), /^fps=30:start_time=0,select='gte\(t,5\.850000\)/);
    // The rough cut starts at 5.866667, the nearest whole picture to 5.87, and its first words 0.203 seconds later.
    assert.equal(t.read("talk.rough-cut.srt"), roughCaptions(PLAN.phrases, keptSpans(PLAN.ranges, "30")));
    assert.match(t.read("talk.rough-cut.srt"), /^1\n00:00:00,203 --> 00:00:01,173\nWelcome to the show\.\n/);
    t.done();
  });
  it("has each program do its part once, in order, and all of them work from the same sound", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const [probe, sound, words, silence, pauses, rough, stills, faces, upright] = t.calls;
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "FFMPEG", "FFMPEG", "SWIFT", "FFMPEG"]);
    assert.deepEqual([probe.args[probe.args.length - 1], after(probe.args, "-print_format")], [file, "json"]);
    assert.ok(after(probe.args, "-o").startsWith(t.work));
    assert.equal(after(sound.args, "-i"), file);
    const wav = sound.args[sound.args.length - 1];
    assert.deepEqual([after(words.args, "-f"), after(words.args, "-m"), after(words.args, "-dtw")], [wav, "/models/model.bin", "large.v3.turbo"]);
    assert.ok(words.args.includes("-osrt") && words.args.includes("-ojf") && words.args.includes("-nfa"));
    assert.deepEqual([after(silence.args, "-i"), after(silence.args, "-af")], [wav, "silencedetect=noise=-45dB:d=5"]);
    // The pauses are looked for to the end of the recording, which is 23.423 seconds long.
    assert.deepEqual([after(pauses.args, "-i"), after(pauses.args, "-af")], [wav, "apad=whole_dur=23.423,silencedetect=noise=-35dB:d=0.3"]);
    assert.equal(after(rough.args, "-i"), file);
    assert.match(after(rough.args, "-vf"), /^fps=30000\/1001:start_time=0,select='gte\(t,5\.855850\)\*lt\(t,9\.826483\)\+gte\(t,13\.363350\)\*lt\(t,21\.271250\)',/);
    assert.equal(after(rough.args, "-c:v"), "libx264");
    // Then the upright version: stills of the video, the faces in them, and one pass over the video itself.
    assert.equal(after(stills.args, "-i"), file);
    assert.equal(faces.args[1], dirname(stills.args[stills.args.length - 1]));
    assert.equal(after(upright.args, "-i"), file);
    t.done();
  });
  it("has the rough cut written whole in the run's own folder before it is put beside the video under its own name", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    let during = null;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      const r = await run(cmd, args, asked);
      if (args.includes("-vf") && after(args, "-vf").includes("select=")) during = t.names();
      return r;
    };
    await uneditedFile(file, t.deps);
    assert.equal(t.calls[5].args[t.calls[5].args.length - 1], inRun(t, "talk.rough-cut.mp4"));
    assert.ok(inRun(t, "talk.rough-cut.mp4").startsWith(t.work + "/"));
    assert.ok(!during.includes("talk.rough-cut.mp4") && !during.includes("talk.cut-plan.json"), during.join(" "));
    assert.equal(t.read("talk.rough-cut.mp4"), "the rough cut");
    t.done();
  });
  it("has its times put on the video's clock when its sound starts after its picture", async () => {
    const t = setup({ probed: probed({ sound: { start_time: "0.500000" } }) });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    assert.equal(plan.facts.soundStart, 0.5);
    assert.deepEqual(JSON.parse(t.read("talk.words.json")).words[0], { w: "Welcome", start: 0.5, end: 1.9 });
    assert.deepEqual(plan.ranges.map((r) => r.start), [0, 4.195, 6.37, 10.338, 13.883, 21.797]);
    // The sound is half a second shorter than the recording is long, and the pauses are looked for to the end of the recording.
    assert.equal(after(t.calls[4].args, "-af"), "apad=whole_dur=22.923,silencedetect=noise=-35dB:d=0.3");
    // The captions are the transcript tool's own, and keep the timing of the sound.
    assert.equal(t.read("talk.srt"), SPELLED);
    t.done();
    // A file's clock starts with whichever comes first. Sound that starts before the picture is already on it.
    const early = setup({ probed: probed({ picture: { start_time: "0.500000" } }) });
    await uneditedFile(early.video("talk.mov"), early.deps);
    assert.equal(JSON.parse(early.read("talk.cut-plan.json")).facts.soundStart, -0.5);
    assert.deepEqual(JSON.parse(early.read("talk.cut-plan.json")).ranges, PLAN.ranges);
    early.done();
  });
  it("leaves out the words the transcriber wrote over a long silence, as it leaves out the caption", async () => {
    const t = setup({
      probed: probed({ duration: "110.000000" }),
      srt: "1\n00:00:00,000 --> 00:00:29,980\n Thank you.\n\n2\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n\n",
      told: told([[0, 29980, [[" Thank", 1200], [" you", 1400], [".", 1500]]], [105000, 106740, [[" Hey", 10530], [",", 10540], [" Charlie", 10580], [",", 10585], [" how", 10610], [" are", 10630], [" you", 10660], ["?", 10670]]]]),
      heard: "[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 104.286812 | silence_duration: 104.286812\n",
      pauses: "[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 104.9 | silence_duration: 104.9\n[silencedetect @ 0x1] silence_start: 106.7\n"
    });
    const r = await uneditedFile(t.video("call.mp4"), t.deps);
    assert.deepEqual([r.ok, r.captions], [true, 1]);
    assert.equal(t.read("call.srt"), "1\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n");
    assert.deepEqual(JSON.parse(t.read("call.words.json")).words.map((w) => w.w), ["Hey,", "Charlie,", "how", "are", "you?"]);
    assert.deepEqual(JSON.parse(t.read("call.cut-plan.json")).ranges.map((x) => [x.start, x.end, x.keep]), [[0, 104.7, false], [104.7, 106.9, true], [106.9, 110, false]]);
    assert.ok(t.logs.includes("call.mp4: left out 1 caption written where nobody speaks."), t.logs.join(" | "));
    t.done();
  });
  it("has every pause ffmpeg found read, and every long silence, though a long recording has more of them than the last lines a program prints", async () => {
    // Sixty pauses after the made-up recording's own: over 8000 characters, where 4000 are kept unless more are asked for.
    const line = (what) => `[Parsed_silencedetect_1 @ 0x7969040900] ${what}\n`;
    const later = Array.from({ length: 60 }, (_, i) => line(`silence_start: ${30 + i * 2}`) + line(`silence_end: ${31 + i * 2} | silence_duration: 1`)).join("");
    const t = setup({ probed: probed({ duration: "150.000000" }), pauses: PAUSES + later });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.ok(later.length > 8000);
    // The first cuts are placed by the first pauses.
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).ranges.slice(0, 5), PLAN.ranges.slice(0, 5));
    t.done();
    // The same for the long silences: the caption the transcriber made up lies in the first of sixty-one.
    const silences = line("silence_start: 0") + line("silence_end: 104.286812 | silence_duration: 104.286812")
      + Array.from({ length: 60 }, (_, i) => line(`silence_start: ${200 + i * 20}`) + line(`silence_end: ${206 + i * 20} | silence_duration: 6`)).join("");
    const u = setup({
      probed: probed({ duration: "1500.000000" }),
      srt: "1\n00:00:00,000 --> 00:00:29,980\n Thank you.\n\n2\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n\n",
      told: told([[0, 29980, [[" Thank", 1200], [" you", 1400], [".", 1500]]], [105000, 106740, [[" Hey", 10530], [",", 10540], [" Charlie", 10580], [",", 10585], [" how", 10610], [" are", 10630], [" you", 10660], ["?", 10670]]]]),
      heard: silences,
      pauses: line("silence_start: 0") + line("silence_end: 104.9 | silence_duration: 104.9") + line("silence_start: 106.7")
    });
    assert.ok(silences.length > 4000);
    assert.equal((await uneditedFile(u.video("call.mp4"), u.deps)).captions, 1);
    assert.equal(u.read("call.srt"), "1\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n");
    assert.deepEqual(JSON.parse(u.read("call.words.json")).words.map((w) => w.w), ["Hey,", "Charlie,", "how", "are", "you?"]);
    u.done();
  });
  it("says in its log what it is doing and what it made", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(t.logs, [
      "talk.mov: reading the sound.",
      "talk.mov: writing the transcript, with a time for every word.",
      "talk.mov: the transcript is written, 5 captions.",
      "talk.mov: the cut plan keeps 0:12 of 0:23 and suggests 4 cuts.",
      "talk.mov: making the rough cut.",
      "talk.mov: making the upright version.",
      "talk.mov: done."
    ]);
    t.done();
  });
  it("writes into another folder when it is asked to, and leaves the video where it is", async () => {
    const t = setup();
    const out = join(t.dir, "out");
    mkdirSync(out);
    await uneditedFile(t.video("talk.mov"), { ...t.deps, outDir: out });
    assert.deepEqual(t.names(), ["out", "talk.mov"]);
    assert.deepEqual(t.inside("out"), ALL.filter((ending) => ending !== "mov").map((ending) => "talk." + ending));
    t.done();
  });
  it("waits until the file has finished arriving before it starts, and leaves one that is still arriving for the next time", async () => {
    const t = setup({ sizes: [10, 20, 20] });
    assert.equal((await uneditedFile(t.video("big.mov"), t.deps)).ok, true);
    assert.equal(t.waits.length, 2);
    t.done();
    const u = setup({ sizes: Array.from({ length: 500 }, (_, i) => i + 1) });
    const r = await uneditedFile(u.video("huge.mov"), u.deps);
    assert.deepEqual([r.ok, r.arriving], [false, true]);
    assert.deepEqual(u.names(), ["huge.mov"]);
    assert.deepEqual(u.calls, []);
    assert.deepEqual(u.logs, ["huge.mov: still arriving. It is taken the next time the folder changes."]);
    u.done();
  });
  it("waits for a video Dropbox shows at its full size with no data yet, and takes it once it is whole", async () => {
    // The size is looked at four times: it has settled at the second look, and the file is whole at the fourth.
    const t = setup({ sizes: [7, 7, 7, 7] });
    const looks = [false, false, true];
    const r = await uneditedFile(t.video("talk.mov"), { ...t.deps, isWhole: () => looks.shift() });
    assert.equal(r.ok, true);
    assert.deepEqual([t.waits.slice(0, 3), looks], [[5000, 5000, 5000], []]);
    t.done();
  });
  it("leaves a placeholder for the next time after as many looks as a growing file, and makes nothing", async () => {
    const t = setup({ sizes: Array.from({ length: 500 }, () => 7) });
    const r = await uneditedFile(t.video("huge.mov"), { ...t.deps, isWhole: () => false });
    assert.deepEqual([r.ok, r.arriving], [false, true]);
    assert.deepEqual([t.names(), t.calls], [["huge.mov"], []]);
    assert.deepEqual(t.logs, ["huge.mov: still arriving. It is taken the next time the folder changes."]);
    t.done();
  });
  it("is done again when it is asked for by name, though it has a plan already", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    writeFileSync(join(t.dir, "talk.cut-plan.json"), "old");
    assert.equal((await uneditedFile(file, t.deps)).ok, true);
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).by, "rules");
    t.done();
  });
});

describe("the Final Cut file of an unedited video", () => {
  /** What the Final Cut writer is given for the made-up recording: what ffprobe said of it, its kept ranges, the captions of the
      whole recording on its own timing, and a note for each place something was taken out. */
  const SAID_OF_IT = { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720, hasAudio: true, audioRate: 22050 };
  const PIECES = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 21.297 }];
  const CAPTIONS = [
    { start: 0, end: 4.78, text: "Welcome to the show. Today we are... Let me do that again." },
    { start: 4.78, end: 8.9, text: "Welcome to the show. Today we are going to talk about" },
    { start: 8.9, end: 9.5, text: "pricing." },
    { start: 12.16, end: 14.75, text: "So the... So the first thing you need to do is know your" },
    { start: 14.75, end: 20.96, text: "costs. It is very, very important. Thank you so much, Sallie." }
  ];
  const NOTES = [
    { at: 0, text: "Taken out, 5.9 seconds. Retake: said again at 0:06, the later one is kept. Cue: a spoken cue to start over" },
    { at: 9.838, text: "Taken out, 3.5 seconds. False start: begun again at 0:13" },
    { at: 21.297, text: "Taken out, 2.1 seconds. Pause: silence after the last words" }
  ];
  const library = (t) => join(t.home, "BRIMM Video Work", "BRIMM rough cuts.fcpbundle");
  const written = (t, video, over = {}) => fcpxml({ video, facts: SAID_OF_IT, ranges: PIECES, captions: CAPTIONS, markers: NOTES, library: library(t), ...over });
  /** Where each caption of a file starts, with its words. */
  const captions = (xml) => tags(xml, "caption").map((c) => `${c.offset} ${c.name}`);

  it("holds the kept ranges as its pieces, the captions on the recording's own timing, and a note at each join saying what was taken out there and why", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const xml = t.read("talk.fcpxml");
    assert.equal(xml, written(t, file));
    assert.deepEqual(tags(xml, "asset-clip").map((c) => `${c.offset} ${c.start} ${c.duration}`), ["0s 176176/30000s 119119/30000s", "119119/30000s 401401/30000s 237237/30000s"]);
    // The caption of what was cut out is not in it, and a caption that begins in a cut begins with the piece after the cut.
    assert.deepEqual(captions(xml), [
      "176176/30000s Welcome to the show. Today we are going to talk about",
      "267267/30000s pricing.",
      "401401/30000s So the... So the first thing you need to do is know your",
      "442442/30000s costs. It is very, very important. Thank you so much, Sallie."
    ]);
    // Each note is on the first picture after its join. The last has nothing kept after it, and is on the last picture kept.
    assert.deepEqual(tags(xml, "marker").map((m) => `${m.start} ${m.value}`), [
      "176176/30000s Taken out, 5.9 seconds. Retake: said again at 0:06, the later one is kept. Cue: a spoken cue to start over",
      "401401/30000s Taken out, 3.5 seconds. False start: begun again at 0:13",
      "637637/30000s Taken out, 2.1 seconds. Pause: silence after the last words"
    ]);
    assert.deepEqual(checkFcpxml(xml, SAID_OF_IT), []);
    t.done();
  });
  it("names the video where it is, and a library in the home folder, where it makes the folder for the library and not the library", async () => {
    const t = setup();
    const file = t.video("My Talk #2.mov");
    await uneditedFile(file, t.deps);
    const xml = t.read("My Talk #2.fcpxml");
    assert.equal(tags(xml, "media-rep")[0].src, address(file));
    assert.deepEqual(tags(xml, "option"), [{ key: "library location", value: address(library(t)) }]);
    assert.match(tags(xml, "option")[0].value, /\/home\/BRIMM%20Video%20Work\/BRIMM%20rough%20cuts\.fcpbundle$/);
    assert.deepEqual([tags(xml, "project")[0].name, tags(xml, "event")[0].name], ["My Talk #2 rough cut", "Rough cuts"]);
    // Final Cut Pro makes the library when the file is opened. The tool never opens Final Cut Pro.
    assert.deepEqual(readdirSync(t.home), ["BRIMM Video Work"]);
    assert.deepEqual(readdirSync(join(t.home, "BRIMM Video Work")), []);
    assert.deepEqual(t.calls.map((c) => c.cmd).filter((cmd) => !["FFPROBE", "FFMPEG", "WHISPER", "SWIFT"].includes(cmd)), []);
    t.done();
  });
  it("leaves the folder for the library as it is when it is there already", async () => {
    const t = setup();
    mkdirSync(join(t.home, "BRIMM Video Work", "BRIMM rough cuts.fcpbundle"), { recursive: true });
    writeFileSync(join(t.home, "BRIMM Video Work", "BRIMM rough cuts.fcpbundle", "CurrentVersion.flexolibrary"), "the library");
    assert.equal((await uneditedFile(t.video("talk.mov"), t.deps)).ok, true);
    assert.deepEqual(readdirSync(join(t.home, "BRIMM Video Work", "BRIMM rough cuts.fcpbundle")), ["CurrentVersion.flexolibrary"]);
    t.done();
  });
  it("is written into the folder asked for, and still names the video where it is", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    const out = join(t.dir, "out");
    mkdirSync(out);
    await uneditedFile(file, { ...t.deps, outDir: out });
    assert.equal(t.read("out", "talk.fcpxml"), written(t, file));
    t.done();
  });
  it("names the video by its whole path, though the tool was given its path from the folder it was started in", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    assert.equal((await uneditedFile(relative(process.cwd(), file), t.deps)).ok, true);
    assert.equal(t.read("talk.fcpxml"), written(t, file));
    t.done();
  });
  it("names no library, and makes no folder, when it is told no home folder", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    const { home, ...deps } = t.deps;
    assert.equal((await uneditedFile(file, deps)).ok, true);
    assert.equal(t.read("talk.fcpxml"), written(t, file, { library: undefined }));
    assert.doesNotMatch(t.read("talk.fcpxml"), /import-options/);
    assert.ok(!existsSync(home));
    t.done();
  });
  it("says of the sound what ffprobe says of it, and of the pictures the rate the rough cut is made at", async () => {
    const t = setup({ probed: probed({ sound: { sample_rate: "48000", channels: 2 } }) });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const asset = tags(t.read("talk.fcpxml"), "asset")[0];
    assert.deepEqual([asset.hasAudio, asset.audioChannels, asset.audioRate, asset.duration], ["1", "2", "48000", "701701/30000s"]);
    assert.equal(tags(t.read("talk.fcpxml"), "format")[0].name, "FFVideoFormat720p2997");
    t.done();
    // A picture that gives no rate that can be used has its rough cut made at 30 pictures a second, and so has its project.
    const u = setup({ probed: probed({ picture: { r_frame_rate: "1000/1", avg_frame_rate: "0/0" } }) });
    await uneditedFile(u.video("talk.mov"), u.deps);
    assert.deepEqual(tags(u.read("talk.fcpxml"), "format")[0], { id: "r1", name: "FFVideoFormat720p30", frameDuration: "1/30s", width: "1280", height: "720" });
    assert.deepEqual(tags(u.read("talk.fcpxml"), "asset-clip").map((c) => `${c.offset} ${c.start} ${c.duration}`), ["0s 176/30s 119/30s", "119/30s 401/30s 238/30s"]);
    u.done();
  });
  it("has its captions put on the video's clock when the sound starts after the picture, as the cuts are", async () => {
    const t = setup({ probed: probed({ sound: { start_time: "0.500000" } }) });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const xml = t.read("talk.fcpxml");
    // The captions file keeps the timing of the sound, where "pricing." starts at 8.9 seconds. In the video that is 9.4.
    assert.match(t.read("talk.srt"), /\n00:00:08,900 --> 00:00:09,500\n pricing\.\n/);
    assert.equal(captions(xml)[1], "282282/30000s pricing.");
    const later = (list, keys) => list.map((item) => ({ ...item, ...Object.fromEntries(keys.map((key) => [key, item[key] + 0.5])) }));
    assert.deepEqual(captions(xml), captions(written(t, file, { ranges: later(PIECES, ["start", "end"]), captions: later(CAPTIONS, ["start", "end"]) })));
    t.done();
  });
  it("is not written when it does not pass its own check: the log and the first line of the plan say what is wrong, and everything else is kept", async () => {
    const t = setup();
    // A writer that leaves a gap of one picture before the second piece, which the real one never does.
    let asked = 0;
    t.deps.finalCut = (given) => {
      asked += 1;
      return fcpxml(given).replace('offset="119119/30000s"', 'offset="120120/30000s"');
    };
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "the Final Cut file could not be made: it did not pass its own check (There is a gap of 1 frame before clip 2)";
    assert.equal(asked, 1);
    assert.deepEqual([r.ok, r.captions, r.kept, r.message], [false, 5, 11.882, why]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "fcpxml").map((ending) => "talk." + ending));
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "The Final Cut file could not be made: it did not pass its own check (There is a gap of 1 frame before clip 2)."));
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).kept, 11.882);
    assert.equal(t.logs[t.logs.length - 1], `talk.mov: ${why}.`);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its Final Cut file could not be made."]);
    t.done();
  });
  it("is not made of a file with no picture, or of a plan that keeps nothing, and the plan says so of each file that is missing", async () => {
    const a = setup({ probed: probed({ picture: null }) });
    const voice = await uneditedFile(a.video("voice.m4a"), a.deps);
    assert.deepEqual(a.read("voice.cut-plan.txt").split("\n").slice(0, 3), [
      "The rough cut could not be made: there is no picture in the file.",
      "The Final Cut file could not be made: there is no picture in the file.",
      "Kept 0:12 of 0:23. Cut 0:11."
    ]);
    assert.equal(voice.message, "the rough cut could not be made: there is no picture in the file; the Final Cut file could not be made: there is no picture in the file");
    assert.deepEqual(a.logs.slice(-2), ["voice.m4a: the rough cut could not be made: there is no picture in the file.", "voice.m4a: the Final Cut file could not be made: there is no picture in the file."]);
    assert.deepEqual(a.notes, ["The cut plan for voice.m4a is ready, but its rough cut and its Final Cut file could not be made."]);
    assert.ok(!existsSync(join(a.dir, "voice.fcpxml")) && !existsSync(a.home));
    a.done();
    const b = setup({ srt: "1\n00:00:00,000 --> 00:00:01,000\n Take two.\n", told: told([[0, 1000, [[" Take", 40], [" two", 80], [".", 90]]]]), pauses: "" });
    await uneditedFile(b.video("slate.mov"), b.deps);
    assert.deepEqual(b.read("slate.cut-plan.txt").split("\n").slice(0, 3), [
      "The rough cut could not be made: the plan keeps nothing.",
      "The upright version could not be made: the plan keeps nothing.",
      "The Final Cut file could not be made: the plan keeps nothing."
    ]);
    assert.deepEqual(b.notes, ["The cut plan for slate.mov is ready, but its rough cut, its upright version and its Final Cut file could not be made."]);
    assert.deepEqual(b.names(), ["slate.cut-plan.json", "slate.cut-plan.txt", "slate.mov", "slate.rough-cut.srt", "slate.rough-cut.transcript.txt", "slate.srt", "slate.transcript.txt", "slate.words.json"]);
    b.done();
  });
  it("is the one file missing when the folder for its library cannot be made, or the file itself cannot be written", async () => {
    const t = setup();
    writeFileSync(t.home, "a file where the home folder would be");
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "the Final Cut file could not be made: the folder for its library could not be made (ENOTDIR)";
    assert.deepEqual([r.ok, r.message], [false, why]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "fcpxml").map((ending) => "talk." + ending));
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[0], "The Final Cut file could not be made: the folder for its library could not be made (ENOTDIR).");
    assert.equal(t.logs[t.logs.length - 1], `talk.mov: ${why}.`);
    t.done();
    const u = setup();
    const file = u.video("talk.mov");
    // Something else is where the file is written to.
    taken(u, "talk.fcpxml");
    assert.equal((await uneditedFile(file, u.deps)).message, "the Final Cut file could not be made: the work stopped (EISDIR)");
    assert.ok(!existsSync(join(u.dir, "talk.fcpxml")) && existsSync(join(u.dir, "talk.cut-plan.json")) && existsSync(join(u.dir, "talk.rough-cut.vertical.mp4")));
    u.done();
  });
  it("is written, as the upright version is, before the plan that says the video is done: a run cut short before then does the video again", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    // The plan cannot be written: something else is where it is written to.
    taken(t, "talk.cut-plan.json");
    assert.deepEqual(await uneditedFile(file, t.deps), { ok: false, name: "talk.mov", message: "EISDIR" });
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "cut-plan.json").map((ending) => "talk." + ending));
    t.done();
  });
});

describe("the upright version of an unedited video", () => {
  it("is made of the same kept stretches as the rough cut: stills of the video, the faces in them, a crop for each stretch, and one pass", async () => {
    // The speaker sits to the left in the first kept stretch and to the right in the second.
    const t = setup({ faces: (still) => [face(still <= 4 ? 0.25 : 0.75)] });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const [stills, finder, upright] = t.calls.slice(6);
    const folder = dirname(stills.args[stills.args.length - 1]);
    assert.ok(folder.startsWith(t.work + "/"), folder);
    assert.deepEqual(stills.args, stillsArgs(file, folder));
    // The face finder is the one in the tool's own folder. What it prints is its answer, so that is asked for.
    assert.deepEqual([finder.cmd, basename(finder.args[0]), finder.args[1], finder.args.length], ["SWIFT", "faces.swift", folder, 2]);
    assert.ok(existsSync(finder.args[0]) && finder.out >= 1000000, String(finder.out));
    assert.deepEqual(upright.args, verticalArgs({ video: file, ranges: STRETCHES, crops: [crop(118), crop(758)], out: inRun(t, "talk.rough-cut.vertical.mp4") }));
    // The stills at 6 and 8 seconds are in the first stretch, and those at 14, 16, 18 and 20 in the second. The video is split
    // on the thousandth of a second below each edge, which keeps the pictures the rough cut keeps: 21.288 would take one more.
    const graph = after(upright.args, "-filter_complex").split(";");
    assert.equal(graph[0], "[0:v]segment=timestamps=5.872|9.843|13.38|21.287[pv0][pv1][pv2][pv3][pv4]");
    assert.deepEqual(graph.filter((part) => part.includes("crop=")), ["[pv1]setpts=PTS-STARTPTS,crop=404:720:118:0[v0]", "[pv3]setpts=PTS-STARTPTS,crop=404:720:758:0[v1]"]);
    assert.equal(graph[graph.length - 1], "[j]scale=1080:1920,setsar=1[v]");
    assert.equal(t.read("talk.rough-cut.vertical.mp4"), "the upright version");
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN));
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("is written whole in the run's own folder before it is put beside the video, and before the plan that says the video is done", async () => {
    const t = setup();
    let during = null;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      const r = await run(cmd, args, asked);
      if (args.includes("-filter_complex")) during = t.names();
      return r;
    };
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(uprightCall(t).args[uprightCall(t).args.length - 1], inRun(t, "talk.rough-cut.vertical.mp4"));
    assert.ok(!during.includes("talk.rough-cut.vertical.mp4") && !during.includes("talk.cut-plan.json"), during.join(" "));
    assert.equal(t.read("talk.rough-cut.vertical.mp4"), "the upright version");
    t.done();
  });
  it("takes the crop of the whole video for a stretch no face was found in, and the log says how many such stretches there are", async () => {
    const t = setup({ faces: (still) => (still >= 7 && still <= 10 ? [face(0.75)] : []) });
    const file = t.video("talk.mov");
    assert.equal((await uneditedFile(file, t.deps)).ok, true);
    assert.deepEqual(uprightCall(t).args, verticalArgs({ video: file, ranges: STRETCHES, crops: [crop(758), crop(758)], out: inRun(t, "talk.rough-cut.vertical.mp4") }));
    assert.deepEqual(t.logs.slice(-2), ["talk.mov: no face was found in 1 of the 2 kept stretches, so the crop of the whole video is used there.", "talk.mov: done."]);
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN));
    t.done();
    // With no face anywhere the whole video is cropped at the centre, and so is every stretch.
    const none = setup({ faces: () => [] });
    const blank = none.video("talk.mov");
    await uneditedFile(blank, none.deps);
    assert.deepEqual(uprightCall(none).args, verticalArgs({ video: blank, ranges: STRETCHES, crops: [crop(438), crop(438)], out: inRun(none, "talk.rough-cut.vertical.mp4") }));
    assert.equal(none.logs[none.logs.length - 2], "talk.mov: no face was found in the video, so the upright version is cropped at the centre of the picture.");
    none.done();
  });
  it("is cropped at the centre when the faces cannot be looked for: swift is missing, it fails, or what it prints cannot be read. The log and the plan say so", async () => {
    const centred = async (script, why, tools = {}) => {
      const t = setup(script);
      t.deps.tools = { ...t.deps.tools, ...tools };
      const file = t.video("talk.mov");
      const r = await uneditedFile(file, t.deps);
      assert.deepEqual([r.ok, r.message], [true, ""], why);
      assert.deepEqual(uprightCall(t).args, verticalArgs({ video: file, ranges: STRETCHES, crops: [crop(438), crop(438)], out: inRun(t, "talk.rough-cut.vertical.mp4") }), why);
      assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending), why);
      assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, `The upright version is cropped at the centre of the picture, and not on the speaker: ${why}.`));
      assert.deepEqual(t.logs.slice(-2), [`talk.mov: the faces could not be looked for (${why}), so the upright version is cropped at the centre of the picture.`, "talk.mov: done."]);
      assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
      const asked = t.calls.slice(6).map((c) => c.cmd);
      t.done();
      return asked;
    };
    // With no swift there is nothing to look with, so no stills are made.
    assert.deepEqual(await centred({}, "swift, which finds the faces, is not installed", { swift: "" }), ["FFMPEG"]);
    assert.deepEqual(await centred({ swift: "fail" }, "the face finder stopped (The folder of stills could not be read: /stills)"), ["FFMPEG", "SWIFT", "FFMPEG"]);
    await centred({ swift: "killed" }, "the face finder stopped (it was killed by SIGKILL)");
    for (const printed of ["", "{ not json", '{"file":"0001.jpg","faces":[]}', '[{"file":"0001.jpg"}]', '[{"file":"0001.jpg","faces":[{"x":"left","y":0.2,"w":0.1,"h":0.2}]}]', "[null]"]) {
      await centred({ printed }, "what the face finder printed could not be read");
    }
    assert.deepEqual(await centred({ stills: "fail" }, "the stills to look in could not be made (Invalid data found when processing input)"), ["FFMPEG", "FFMPEG"]);
  });
  it("is not made of a video that is already upright or square, and the log says it needs none", async () => {
    // The last is a phone's video: stored on its side, with a note to turn it.
    for (const picture of [{ width: 1080, height: 1920 }, { width: 720, height: 720 }, { width: 1920, height: 1080, side_data_list: [{ rotation: -90 }] }]) {
      const t = setup({ probed: probed({ picture }) });
      const r = await uneditedFile(t.video("talk.mov"), t.deps);
      assert.deepEqual([r.ok, r.message], [true, ""]);
      assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "rough-cut.vertical.mp4").map((ending) => "talk." + ending));
      assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "FFMPEG"]);
      assert.deepEqual(t.logs.slice(-3), ["talk.mov: making the rough cut.", "talk.mov: its picture is not wider than it is tall, so it needs no upright version.", "talk.mov: done."]);
      assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN));
      t.done();
    }
  });
  it("is the one file missing when ffmpeg cannot make it, and the plan says so in its first line", async () => {
    const t = setup({ vertical: "fail" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "the upright version could not be made: ffmpeg stopped (Error initializing complex filters)";
    assert.deepEqual([r.ok, r.captions, r.kept, r.message], [false, 5, 11.882, why]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "rough-cut.vertical.mp4").map((ending) => "talk." + ending));
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "The upright version could not be made: ffmpeg stopped (Error initializing complex filters)."));
    assert.equal(t.read("talk.rough-cut.mp4"), "the rough cut");
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).kept, 11.882);
    assert.equal(t.logs[t.logs.length - 1], `talk.mov: ${why}.`);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its upright version could not be made."]);
    t.done();
    // The same when ffmpeg says all went well and has written nothing, and when the work stops in a way nobody foresaw.
    const none = setup({ vertical: "nothing" });
    assert.equal((await uneditedFile(none.video("talk.mov"), none.deps)).message, "the upright version could not be made: ffmpeg stopped (no reason given)");
    none.done();
    const stopped = setup({ vertical: "throw" });
    assert.equal((await uneditedFile(stopped.video("talk.mov"), stopped.deps)).message, "the upright version could not be made: the work stopped (ENOSPC)");
    assert.deepEqual(stopped.names(), ALL.filter((ending) => ending !== "rough-cut.vertical.mp4").map((ending) => "talk." + ending));
    stopped.done();
  });
  it("is named with the rough cut when neither could be made: each has its line in the plan and in the log, and the Final Cut file is made all the same", async () => {
    const t = setup({ rough: "fail", vertical: "fail" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const whys = ["the rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox')", "the upright version could not be made: ffmpeg stopped (Error initializing complex filters)"];
    assert.deepEqual([r.ok, r.message], [false, whys.join("; ")]);
    assert.deepEqual(t.names(), ALL.filter((ending) => !ending.endsWith(".mp4")).map((ending) => "talk." + ending));
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(0, 3), [
      "The rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox').",
      "The upright version could not be made: ffmpeg stopped (Error initializing complex filters).",
      "Kept 0:12 of 0:23. Cut 0:11."
    ]);
    assert.deepEqual(t.logs.slice(-2), whys.map((why) => `talk.mov: ${why}.`));
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its rough cut and its upright version could not be made."]);
    t.done();
  });
});

describe("a video no transcript can be made from", () => {
  it("gets the note the transcript tool leaves, and nothing else", async () => {
    const t = setup({ ffmpeg: "fail" });
    const r = await uneditedFile(t.video("broken.mov"), t.deps);
    assert.deepEqual(r, { ok: false, name: "broken.mov", message: "the sound could not be read from the file (moov atom not found)" });
    assert.deepEqual(t.names(), ["broken.failed.txt", "broken.mov"]);
    assert.match(t.read("broken.failed.txt"), /^No transcript could be made from broken\.mov\.\n\nWhy: the sound could not be read from the file \(moov atom not found\)\.\n\nTo try again, delete this note\./);
    assert.deepEqual(readdirSync(t.work), []);
    assert.deepEqual(t.notes, ["No transcript could be made from broken.mov. See the note beside it."]);
    assert.equal(t.logs[t.logs.length - 1], "broken.mov: failed. the sound could not be read from the file (moov atom not found).");
    t.done();
  });
  it("gets it when the transcriber stops, and when it finds no speech", async () => {
    const a = setup({ whisper: "fail" });
    assert.equal((await uneditedFile(a.video("a.mov"), a.deps)).ok, false);
    assert.match(a.read("a.failed.txt"), /Why: the transcriber stopped \(error: failed to initialize whisper context\)\./);
    assert.deepEqual(a.names(), ["a.failed.txt", "a.mov"]);
    a.done();
    const b = setup({ srt: "" });
    assert.equal((await uneditedFile(b.video("b.mov"), b.deps)).ok, false);
    assert.match(b.read("b.failed.txt"), /Why: the transcriber found no speech in it\./);
    assert.deepEqual(b.names(), ["b.failed.txt", "b.mov"]);
    b.done();
  });
  it("gets it only after the transcriber has stopped twice: with the word times, and then as the transcript tool runs it", async () => {
    const t = setup({ whisper: "fail" });
    await uneditedFile(t.video("a.mov"), t.deps);
    assert.deepEqual(t.calls.map((c) => [c.cmd, c.args.includes("-dtw")]), [["FFPROBE", false], ["FFMPEG", false], ["WHISPER", true], ["WHISPER", false]]);
    t.done();
    // A transcriber that was killed printed no reason, and the note says that it was killed.
    const killed = setup({ whisper: "killed" });
    assert.equal((await uneditedFile(killed.video("a.mov"), killed.deps)).message, "the transcriber stopped (it was killed by SIGKILL)");
    assert.match(killed.read("a.failed.txt"), /Why: the transcriber stopped \(it was killed by SIGKILL\)\./);
    killed.done();
  });
  it("gets it at once, in plain words, when the file has no sound", async () => {
    const t = setup({ probed: probed({ sound: null }) });
    assert.equal((await uneditedFile(t.video("mute.mov"), t.deps)).ok, false);
    assert.match(t.read("mute.failed.txt"), /Why: there is no sound in the file\./);
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE"]);
    t.done();
  });
  it("loses the note again once a transcript can be made", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    writeFileSync(join(t.dir, "talk.failed.txt"), "an earlier try");
    await uneditedFile(file, t.deps);
    assert.ok(!existsSync(join(t.dir, "talk.failed.txt")));
    t.done();
  });
});

describe("a video whose transcript is made but not all of the rest", () => {
  it("keeps everything but the rough cut when ffmpeg cannot make it, and the plan says so in its first line", async () => {
    const t = setup({ rough: "fail" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.captions, r.kept, r.message], [false, 5, 11.882, "the rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox')"]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "talk." + ending));
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "The rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox')."));
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[1], "Kept 0:12 of 0:23. Cut 0:11.");
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).kept, 11.882);
    assert.equal(t.logs[t.logs.length - 1], "talk.mov: the rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox').");
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its rough cut could not be made."]);
    t.done();
    // The same when ffmpeg says all went well and has written nothing.
    const none = setup({ rough: "nothing" });
    assert.equal((await uneditedFile(none.video("talk.mov"), none.deps)).message, "the rough cut could not be made: ffmpeg stopped (no reason given)");
    assert.deepEqual(none.names(), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "talk." + ending));
    none.done();
  });
  it("does not ask for a rough cut of a file with no picture, or of a plan that keeps nothing", async () => {
    const a = setup({ probed: probed({ picture: null }) });
    await uneditedFile(a.video("voice.m4a"), a.deps);
    assert.equal(a.read("voice.cut-plan.txt").split("\n")[0], "The rough cut could not be made: there is no picture in the file.");
    assert.ok(!a.calls.some((c) => c.args.includes("-vf") || c.args.includes("-filter_complex") || c.cmd === "SWIFT"));
    assert.ok(existsSync(join(a.dir, "voice.cut-plan.json")) && existsSync(join(a.dir, "voice.rough-cut.srt")) && !existsSync(join(a.dir, "voice.rough-cut.mp4")));
    a.done();
    const b = setup({ srt: "1\n00:00:00,000 --> 00:00:01,000\n Take two.\n", told: told([[0, 1000, [[" Take", 40], [" two", 80], [".", 90]]]]), pauses: "" });
    await uneditedFile(b.video("slate.mov"), b.deps);
    assert.equal(b.read("slate.cut-plan.txt").split("\n")[0], "The rough cut could not be made: the plan keeps nothing.");
    assert.ok(!b.calls.some((c) => c.args.includes("-vf") || c.args.includes("-filter_complex") || c.cmd === "SWIFT"));
    b.done();
  });
  it("still gets its transcript when the transcriber dies timing the words: the transcript tool's own pass writes it, and a note says why there is no plan", async () => {
    const t = setup({ timing: "killed" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "the transcriber could not time the words (it was killed by SIGABRT)";
    assert.deepEqual(r, { ok: false, name: "talk.mov", captions: 5, folder: "", message: `no cut plan could be made: ${why}` });
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    assert.equal(t.read("talk.srt"), SPELLED);
    assert.equal(t.read("talk.transcript.txt"), stampedText(SPELLED));
    assert.equal(t.read("talk.cut-plan.txt"), `No cut plan could be made for talk.mov.\n\nWhy: ${why}.\n\nIts transcript was made, and is beside this note.\n`);
    // The second pass is the transcript tool's own, on the same sound. The pauses are not looked for: there are no words to cut by.
    const [, sound, timed, plain] = t.calls;
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "WHISPER", "FFMPEG"]);
    assert.ok(timed.args.includes("-dtw"));
    assert.deepEqual(plain.args, whisperArgs({ model: "/models/model.bin", wav: sound.args[sound.args.length - 1], outBase: after(timed.args, "-of") }));
    assert.equal(after(t.calls[4].args, "-af"), "silencedetect=noise=-45dB:d=5");
    assert.deepEqual(t.logs, [
      "talk.mov: reading the sound.",
      "talk.mov: writing the transcript, with a time for every word.",
      `talk.mov: ${why}. Writing the transcript without them.`,
      "talk.mov: the transcript is written, 5 captions.",
      `talk.mov: no cut plan could be made: ${why}.`
    ]);
    assert.deepEqual(t.notes, ["The transcript of talk.mov is ready, but no cut plan could be made. See talk.cut-plan.txt."]);
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("quotes the transcriber's last line as the reason when it stopped by itself while timing the words", async () => {
    const t = setup({ timing: "fail" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(r.message, "no cut plan could be made: the transcriber could not time the words (error: failed to compute token-level timestamps)");
    assert.equal(t.read("talk.srt"), SPELLED);
    t.done();
  });
  it("keeps the transcript when the transcriber wrote no time for the words, and a note where the plan would be says why there is none", async () => {
    const t = setup({ told: null });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.captions, r.message], [false, 5, "no cut plan could be made: the transcriber wrote no times for the words"]);
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    assert.equal(t.read("talk.srt"), SPELLED);
    assert.equal(t.read("talk.cut-plan.txt"), "No cut plan could be made for talk.mov.\n\nWhy: the transcriber wrote no times for the words.\n\nIts transcript was made, and is beside this note.\n");
    assert.equal(t.logs[t.logs.length - 1], "talk.mov: no cut plan could be made: the transcriber wrote no times for the words.");
    assert.deepEqual(t.notes, ["The transcript of talk.mov is ready, but no cut plan could be made. See talk.cut-plan.txt."]);
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG"]);
    t.done();
  });
  it("says why in the same way when the times cannot be read, when there are none, and when the pauses or the file's facts cannot be found", async () => {
    const why = async (script) => {
      const t = setup(script);
      await uneditedFile(t.video("talk.mov"), t.deps);
      const note = t.read("talk.cut-plan.txt");
      assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
      t.done();
      return note.split("\n")[2];
    };
    assert.equal(await why({ told: "{ not json" }), "Why: the transcriber wrote no times for the words.");
    assert.equal(await why({ told: { transcription: [] } }), "Why: the transcriber wrote no times for the words.");
    assert.equal(await why({ pauses: "fail" }), "Why: the pauses could not be found (Error while filtering).");
    assert.equal(await why({ probe: "fail" }), "Why: the file's length and picture could not be read (moov atom not found).");
    assert.equal(await why({ probed: "{}" }), "Why: the file's length and picture could not be read (no reason given).");
  });
  it("keeps the transcript, and says why there is no plan, when the work on the plan stops in a way nobody foresaw", async () => {
    const t = setup({ pauses: "throw" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [false, "no cut plan could be made: the work on the plan stopped (spawn EAGAIN)"]);
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[2], "Why: the work on the plan stopped (spawn EAGAIN).");
    t.done();
  });
  it("keeps the plan when the work on the rough cut stops in a way nobody foresaw: its first line says what is missing, and nothing half made is left", async () => {
    const t = setup({ rough: "throw" });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.captions, r.kept, r.message], [false, 5, 11.882, "the rough cut could not be made: the work stopped (ENOSPC)"]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "talk." + ending));
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "The rough cut could not be made: the work stopped (ENOSPC)."));
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).kept, 11.882);
    assert.equal(t.logs[t.logs.length - 1], "talk.mov: the rough cut could not be made: the work stopped (ENOSPC).");
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its rough cut could not be made."]);
    t.done();
  });
  it("names every file that is missing when the work stopped before the rough cut", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    // The rough cut's captions cannot be written: something else is where they are written to.
    taken(t, "talk.rough-cut.srt");
    const r = await uneditedFile(file, t.deps);
    assert.equal(r.message, "the rough cut could not be made: the work stopped (EISDIR)");
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[0], "The rough cut could not be made: the work stopped (EISDIR). Not made either: talk.rough-cut.srt.");
    assert.deepEqual(t.names(), ["talk.cut-plan.json", "talk.cut-plan.txt", "talk.fcpxml", "talk.mov", "talk.rough-cut.transcript.txt", "talk.rough-cut.vertical.mp4", "talk.srt", "talk.transcript.txt", "talk.words.json"]);
    assert.deepEqual(roughCalls(t), []);
    t.done();
  });
  it("does not keep a plan or a rough cut that an earlier run made, when this run could not make them", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const again = setup({ rough: "fail" });
    await uneditedFile(file, { ...again.deps, tmpDir: t.work });
    assert.ok(!existsSync(join(t.dir, "talk.rough-cut.mp4")));
    const third = setup({ told: null });
    await uneditedFile(file, { ...third.deps, tmpDir: t.work });
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    for (const made of [t, again, third]) made.done();
  });
  it("never throws out of the run: when nothing can be written, the log says the work stopped", async () => {
    const t = setup();
    const out = join(t.dir, "out");
    mkdirSync(out);
    chmodSync(out, 0o555);
    let r;
    try {
      r = await uneditedFile(t.video("talk.mov"), { ...t.deps, outDir: out });
    } finally {
      chmodSync(out, 0o755);
    }
    assert.deepEqual(r, { ok: false, name: "talk.mov", message: "EACCES" });
    assert.equal(t.logs[t.logs.length - 1], "talk.mov: the work stopped (EACCES).");
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
});

describe("a video whose cut plan Claude is asked to read", () => {
  it("has Claude asked once, through Claude Code, after the rules have made the plan and before the rough cut is made", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    // The rules' plan needs the pauses, which is the fifth thing asked for. The rough cut is the first thing made from a plan.
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "CLAUDE", "FFMPEG", "FFMPEG", "SWIFT", "FFMPEG", "FFMPEG"]);
    assert.ok(after(t.calls[6].args, "-vf").includes("select="));
    assert.equal(t.asks.length, 1);
    // The one wait of the run is the look at the file's size before anything starts, to see that it has arrived.
    assert.deepEqual(t.waits, [5000]);
    t.done();
  });
  it("names its model, so that both Macs read a plan with the same one", () => {
    assert.equal(CLAUDE_MODEL, "claude-opus-5-5");
  });
  it("gives Claude Code these arguments and no others, and the request on its standard input, never as an argument", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const [ask] = t.asks;
    assert.deepEqual(ask.args, ["-p", "--model", CLAUDE_MODEL, "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--setting-sources", "", "--output-format", "json"]);
    assert.equal(ask.input, notesRequest(PLAN, { video: "talk.mov", duration: 23.423 }));
    // What is sent: the file's name and its length, and each phrase with its time, what the rules decided, and its words.
    assert.match(ask.input, /\nFile: talk\.mov\nLength: 0:23\nThe rules keep 0:12 of it and cut 0:11\.\n/);
    assert.ok(ask.input.includes("p8 | 0:17 | KEEP | It is very, very important."));
    // The folder the video is in is not sent: the file is named without it.
    assert.ok(!ask.input.includes(t.dir) && !ask.args.some((arg) => arg.includes(t.dir)));
    t.done();
  });
  it("runs Claude Code in a new, empty folder inside the run's own, so that it picks up no file of a project, and takes the folder away again", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const [ask] = t.asks;
    assert.equal(dirname(dirname(ask.cwd)), t.work);
    assert.deepEqual(ask.there, []);
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("gives Claude ten minutes to answer, and asks for all of what Claude Code prints, which is its answer", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(t.asks[0].limit, 10 * 60 * 1000);
    assert.ok(t.asks[0].out >= 1000000, String(t.asks[0].out));
    t.done();
  });
  it("uses the plan Claude's decisions give for everything made after it: the rough cut and its captions, the upright version, the Final Cut file and the plan's own two files", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 9.198, cut: 14.225, folder: "", message: "" });
    const plan = USED.plan;
    assert.deepEqual(plan.ranges.map((x) => [x.start, x.end, x.kind]).slice(4), [[13.383, 16.53, "keep"], [16.53, 19.214, "claude"], [19.214, 21.297, "keep"], [21.297, 23.423, "pause"]]);
    // The rough cut is three stretches now, and its captions are without the line Claude cut.
    assert.deepEqual(roughCalls(t).map((c) => c.args), [roughCutArgs(file, inRun(t, "talk.rough-cut.mp4"), { ranges: plan.ranges, fps: FACTS.fps })]);
    assert.equal(after(roughCalls(t)[0].args, "-vf").split("gte(t,").length - 1, 3);
    assert.equal(t.read("talk.rough-cut.srt"), roughCaptions(plan.phrases, keptSpans(plan.ranges, FACTS.fps)));
    assert.equal(t.read("talk.rough-cut.transcript.txt"), "[0:00] Welcome to the show.\n[0:01] Today we are going to talk about pricing.\n[0:04] So the first thing you need to do is know your costs.\n[0:07] Thank you so much, Sallie.\n");
    // The upright version is the same three stretches.
    const kept = stretches(plan.ranges.filter((x) => x.keep));
    assert.deepEqual(kept, [{ start: 5.872, end: 9.843 }, { start: 13.38, end: 16.516 }, { start: 19.219, end: 21.287 }]);
    assert.deepEqual(uprightCall(t).args, verticalArgs({ video: file, ranges: kept, crops: [crop(118), crop(118), crop(118)], out: inRun(t, "talk.rough-cut.vertical.mp4") }));
    // So are the pieces of the Final Cut file, each end on a whole picture.
    assert.deepEqual(tags(t.read("talk.fcpxml"), "asset-clip").map((c) => `${c.start} ${c.duration}`), ["176176/30000s 119119/30000s", "401401/30000s 94094/30000s", "576576/30000s 62062/30000s"]);
    assert.deepEqual(checkFcpxml(t.read("talk.fcpxml"), { duration: 23.423, frameRate: "30000/1001" }), []);
    // The plan to read says first that Claude read it, and names Claude's cut as Claude's.
    assert.equal(t.read("talk.cut-plan.txt"), planText(plan, "Claude read this plan and changed it in 1 place. Its notes are in talk.edit-notes.txt."));
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(0, 2), ["Claude read this plan and changed it in 1 place. Its notes are in talk.edit-notes.txt.", "Kept 0:09 of 0:23. Cut 0:14."]);
    assert.ok(t.read("talk.cut-plan.txt").includes("\n0:16 to 0:19  CUT  Claude: It adds nothing to the line before it.  |  It is very, very important.\n"));
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).ranges, plan.ranges);
    // The transcript of the whole recording is as the transcriber wrote it, and so are the words.
    assert.equal(t.read("talk.srt"), SPELLED);
    assert.equal(JSON.parse(t.read("talk.words.json")).words.length, 48);
    t.done();
  });
  it("says in the plan's JSON who made the plan, and keeps what Claude decided, what was left out and why, and the clips with the names of their files", async () => {
    // Claude names a phrase the plan does not have, and a second clip that takes a phrase of the first.
    const reply = { ...REPLY, decisions: [...REPLY.decisions, { id: "p99", keep: false, why: "Said twice." }], clips: [...REPLY.clips, { from: "p9", to: "p9", hook: "Thank you" }] };
    const t = setup({ claude: [answers(reply)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const made = used(reply);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    assert.deepEqual(plan, {
      version: 1, video: "talk.mov", facts: FACTS, phrases: made.plan.phrases, ranges: made.plan.ranges, kept: 9.198, cut: 14.225, by: "rules and Claude",
      changes: [{ ids: ["p8"], was: "keep", now: "cut", why: "It adds nothing to the line before it." }],
      claude: {
        decisions: reply.decisions,
        graphics: REPLY.graphics,
        ignored: ['Claude\'s decision for "p99" was left out: the plan has no phrase with that id.', "Clip 2 was left out: it overlaps clip 1."],
        clips: [{ ...made.clips[0], files: ["talk.reel-1.mp4", "talk.reel-1.srt"] }]
      }
    });
    assert.deepEqual(Object.keys(plan), ["version", "video", "facts", "phrases", "ranges", "kept", "cut", "by", "changes", "claude"]);
    assert.deepEqual(Object.keys(plan.claude), ["decisions", "graphics", "ignored", "clips"]);
    assert.deepEqual([plan.claude.clips[0].n, plan.claude.clips[0].ranges], [1, [{ start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }]]);
    t.done();
  });
  it("hands the pauses ffmpeg heard on with Claude's decisions, so that the silence beside a phrase Claude keeps is cut as the rules cut it", async () => {
    // Claude keeps the first telling of the opening. There is silence before it, to 1.111 seconds, which only the pauses show.
    const reply = { ...REPLY, decisions: [{ id: "p2", keep: true, why: "She trails off on purpose." }], graphics: [], clips: [] };
    const t = setup({ claude: [answers(reply)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    assert.deepEqual(plan.ranges, applyDecisions(PLAN, reply.decisions, HEARD).plan.ranges);
    assert.deepEqual(plan.ranges.slice(0, 2).map((x) => [x.start, x.end, x.kind]), [[0, 0.911, "pause"], [0.911, 2.988, "keep"]]);
    // Without the pauses that silence would be kept whole, and the change would say to check it by eye.
    assert.deepEqual(applyDecisions(PLAN, reply.decisions).plan.ranges[0], { ...plan.ranges[1], start: 0 });
    assert.deepEqual(plan.changes, [{ ids: ["p1", "p2"], was: "cut", now: "keep", why: "She trails off on purpose." }]);
    t.done();
  });
  it("writes Claude's notes for the editor beside the plan: its notes, what it changed, its ideas for graphics and its clips", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(t.names(), [...WITH_NOTES, "reel-1.mp4", "reel-1.srt"].sort().map((ending) => "talk." + ending));
    assert.equal(t.read("talk.edit-notes.txt"), notesText(USED.read, USED.plan, USED.clips));
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n"), [
      "Claude wrote this from the words of the recording and their times only. It could not see or hear the video, so check what it says against the video.",
      "",
      "Its notes",
      "A short talk about pricing.",
      "The opening is said twice, and the second telling is the one to use.",
      "",
      "What it changed in the cut plan",
      "0:17  CUT, was kept  |  It is very, very important.  |  It adds nothing to the line before it.",
      "",
      "Its ideas for graphics",
      '0:13  So the first thing you need to do is know your costs.  |  The words "Know your costs" on screen.',
      "",
      "Its clips",
      "1. 0:13 to 0:21, 5 seconds, without what is cut in between  |  On screen: Know your costs  |  It makes one point and stands alone.",
      "   It does not fit a Reel. It is 5.23 seconds long, and a Reel clip is at least 15 seconds.",
      ""
    ]);
    t.done();
  });
  it("says in the notes what could not be used: what could not be read in the reply, and each decision and each clip that was left out", async () => {
    const reply = { ...REPLY, decisions: [{ id: "p2", keep: "yes" }, ...REPLY.decisions, { id: "p99", keep: false, why: "Said twice." }], clips: [...REPLY.clips, { from: "p9", to: "p9" }] };
    const t = setup({ claude: [answers(reply)] });
    assert.equal((await uneditedFile(t.video("talk.mov"), t.deps)).ok, true);
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(-5), [
      "What could not be used from its reply",
      'Decision 1 could not be read: it needs an "id", "keep" as true or false, and a "why".',
      'Claude\'s decision for "p99" was left out: the plan has no phrase with that id.',
      "Clip 2 was left out: it overlaps clip 1.",
      ""
    ]);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).claude.ignored, t.read("talk.edit-notes.txt").split("\n").slice(-4, -1));
    t.done();
  });
  it("reads Claude's reply out of the words or the code fence around it", async () => {
    const t = setup({ claude: [answers("Here is what I found.\n\n```json\n" + JSON.stringify(REPLY, null, 2) + "\n```\n")] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(t.read("talk.edit-notes.txt"), notesText(USED.read, USED.plan, USED.clips));
    assert.equal(JSON.parse(t.read("talk.cut-plan.json")).by, "rules and Claude");
    t.done();
  });
  it("leaves the rules' plan as it is when Claude changes nothing in it, says that Claude read it, and writes the notes all the same", async () => {
    const reply = { decisions: [], notes: "A short talk about pricing. Nothing to change.", graphics: [], clips: [] };
    const t = setup({ claude: [answers(reply)] });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 11.882, cut: 11.541, folder: "", message: "" });
    assert.deepEqual(t.names(), WITH_NOTES.map((ending) => "talk." + ending));
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), { version: 1, video: "talk.mov", facts: FACTS, phrases: PLAN.phrases, ranges: PLAN.ranges, kept: 11.882, cut: 11.541, by: "rules", claude: { decisions: [], graphics: [], ignored: [], clips: [] } });
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "Claude read this plan and changed nothing in it. Its notes are in talk.edit-notes.txt."));
    assert.equal(t.read("talk.edit-notes.txt").split("\n").slice(2).join("\n"), "Its notes\nA short talk about pricing. Nothing to change.\n");
    assert.deepEqual(t.logs.slice(4, 7), ["talk.mov: asking Claude to read the cut plan.", "talk.mov: Claude changed nothing in the cut plan.", "talk.mov: making the rough cut."]);
    assert.deepEqual(reelCalls(t), []);
    t.done();
  });
  it("says in its log that Claude is asked, what Claude changed, and how many clips are cut", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(t.logs, [
      "talk.mov: reading the sound.",
      "talk.mov: writing the transcript, with a time for every word.",
      "talk.mov: the transcript is written, 5 captions.",
      "talk.mov: the cut plan keeps 0:12 of 0:23 and suggests 4 cuts.",
      "talk.mov: asking Claude to read the cut plan.",
      "talk.mov: Claude changed the cut plan in 1 place: it now keeps 0:09 of 0:23 and suggests 5 cuts.",
      "talk.mov: making the rough cut.",
      "talk.mov: making the upright version.",
      "talk.mov: cutting 1 short clip.",
      "talk.mov: done."
    ]);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("keeps Claude's plan when its notes cannot be written: the plan's first line says they are missing, and sends nobody to them", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    // Something else is where the notes are written to.
    taken(t, "talk.edit-notes.txt");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.kept, r.message], [false, 9.198, "the notes for the editor could not be made: the work stopped (EISDIR)"]);
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(0, 3), ["The notes for the editor could not be made: the work stopped (EISDIR).", "Claude read this plan and changed it in 1 place.", "Kept 0:09 of 0:23. Cut 0:14."]);
    assert.ok(!existsSync(join(t.dir, "talk.edit-notes.txt")) && existsSync(join(t.dir, "talk.reel-1.mp4")) && existsSync(join(t.dir, "talk.cut-plan.json")));
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, but its notes for the editor could not be made."]);
    t.done();
  });
  it("asks Claude about a plan that keeps nothing, and makes the rough cut of what Claude keeps", async () => {
    // The one thing said is a cue to start over, which the rules cut. Claude says it is the line itself.
    const said = { srt: "1\n00:00:00,000 --> 00:00:01,000\n Take two.\n", told: told([[0, 1000, [[" Take", 40], [" two", 80], [".", 90]]]]), pauses: "" };
    const t = setup({ ...said, claude: [answers({ decisions: [{ id: "p1", keep: true, why: "It is the name of the talk." }], notes: "", graphics: [], clips: [] })] });
    const r = await uneditedFile(t.video("slate.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    assert.equal(roughCalls(t).length, 1);
    assert.equal(JSON.parse(t.read("slate.cut-plan.json")).by, "rules and Claude");
    assert.equal(t.read("slate.rough-cut.transcript.txt"), "[0:00] Take two.\n");
    t.done();
  });
});

describe("a video Claude could not be asked about", () => {
  /** What the video's files hold when the plan is the rules' alone, as it is today. */
  const RULES = { version: 1, video: "talk.mov", facts: FACTS, phrases: PLAN.phrases, ranges: PLAN.ranges, kept: 11.882, cut: 11.541, by: "rules" };
  const EXPIRED = "Failed to authenticate: OAuth session expired and could not be refreshed";
  /** Each way the asking can fail: what Claude Code ends with, and the reason the tool gives. */
  const FAILS = [
    ["Claude Code ends badly", { code: 1, stderr: "node:internal\nError: connect ECONNREFUSED 160.79.104.10:443\n", stdout: "" }, "Claude Code stopped (Error: connect ECONNREFUSED 160.79.104.10:443)"],
    ["Claude Code is killed", { code: 1, stderr: "", signal: "SIGTERM", stdout: "" }, "Claude Code stopped (it was killed by SIGTERM)"],
    ["Claude Code is not a program that can be run", { code: 127, stderr: "spawn CLAUDE ENOENT", stdout: "" }, "Claude Code stopped (spawn CLAUDE ENOENT)"],
    ["Claude does not answer in time", { code: 1, stderr: "", signal: "SIGKILL", outOfTime: true, stdout: "" }, "it gave no answer in 10 minutes"],
    ["Claude Code prints something that is not JSON", { code: 0, stderr: "", stdout: "Welcome to Claude Code!\n" }, "what Claude Code printed could not be read"],
    ["Claude Code prints nothing", { code: 0, stderr: "", stdout: "" }, "what Claude Code printed could not be read"],
    ["Claude Code prints JSON that is not its answer", { code: 0, stderr: "", stdout: '["result"]' }, "what Claude Code printed could not be read"],
    ["Claude Code prints an answer with no text in it", { code: 0, stderr: "", stdout: printed(undefined) }, "what Claude Code printed could not be read"],
    ["Claude Code does not say whether it worked", { code: 0, stderr: "", stdout: printed(JSON.stringify(REPLY), { is_error: undefined }) }, "what Claude Code printed could not be read"],
    ["Claude Code says is_error, and ends badly", { code: 1, stderr: "", stdout: printed(EXPIRED, { is_error: true }) }, `Claude Code gave an error (${EXPIRED})`],
    ["Claude Code says is_error, and ends well", { code: 0, stderr: "", stdout: printed(EXPIRED, { is_error: true }) }, `Claude Code gave an error (${EXPIRED})`],
    ["Claude Code says is_error and no more", { code: 1, stderr: "", stdout: printed(undefined, { is_error: true }) }, "Claude Code gave an error (no reason given)"],
    ["Claude's reply has nothing in it that was asked for", answers("I cannot judge a video I have not seen."), "its reply could not be read: there is no JSON object in it"],
    ["Claude's reply is empty", answers(""), "Claude sent nothing back"],
    ["Claude's reply has nothing in it that can be read", answers({ decisions: "none", notes: 7 }), '"decisions" in its reply is not a list, so nothing was read from it; "notes" in its reply is not text, so it was left out; its reply has no "graphics"; its reply has no "clips"'],
    ["the asking stops in a way nobody foresaw", "throw", "the work stopped (spawn EAGAIN)"]
  ];
  for (const [when, ends, why] of FAILS) {
    it(`is asked about once more after a short wait when ${when}, and then gets the rules' plan just as today, with the reason in the plan's first line`, async () => {
      const t = setup({ claude: [ends] });
      const r = await uneditedFile(t.video("talk.mov"), t.deps);
      // This is not a failed run.
      assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 11.882, cut: 11.541, folder: "", message: "" });
      // Two tries, with one short wait between them: the wait before it is the look at the file's size, before anything starts.
      // The second try is given the same request, in a new empty folder of its own.
      assert.equal(t.asks.length, 2);
      assert.deepEqual([t.waits, t.asks.map((ask) => ask.waits)], [[5000, 3000], [1, 2]]);
      assert.equal(t.asks[1].input, t.asks[0].input);
      assert.deepEqual([t.asks[1].there, t.asks[1].cwd === t.asks[0].cwd, dirname(dirname(t.asks[1].cwd)) === t.work], [[], false, true]);
      // No notes and no clips, and everything else as the rules alone make it.
      assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
      assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), RULES);
      assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, `Claude could not be asked (${why}), so this plan is the rules' alone.`));
      assert.equal(t.read("talk.rough-cut.srt"), roughCaptions(PLAN.phrases, keptSpans(PLAN.ranges, FACTS.fps)));
      assert.deepEqual(t.logs.slice(4, 8), [
        "talk.mov: asking Claude to read the cut plan.",
        `talk.mov: Claude could not be asked (${why}). It is asked once more.`,
        `talk.mov: Claude could not be asked (${why}), so the cut plan is the rules' alone.`,
        "talk.mov: making the rough cut."
      ]);
      assert.equal(t.logs[t.logs.length - 1], "talk.mov: done.");
      assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready. Claude could not be asked, so the plan is the rules' alone."]);
      assert.deepEqual(readdirSync(t.work), []);
      t.done();
    });
  }
  it("gets Claude's read all the same when the second try works, as it did when the sign-in had run out", async () => {
    const t = setup({ claude: [{ code: 1, stderr: "", stdout: printed(EXPIRED, { is_error: true }) }, answers(REPLY)] });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.kept, r.message], [true, 9.198, ""]);
    assert.equal(t.asks.length, 2);
    assert.deepEqual(t.waits, [5000, 3000]);
    assert.deepEqual(t.logs.slice(4, 8), [
      "talk.mov: asking Claude to read the cut plan.",
      `talk.mov: Claude could not be asked (Claude Code gave an error (${EXPIRED})). It is asked once more.`,
      "talk.mov: Claude changed the cut plan in 1 place: it now keeps 0:09 of 0:23 and suggests 5 cuts.",
      "talk.mov: making the rough cut."
    ]);
    assert.equal(t.read("talk.edit-notes.txt"), notesText(USED.read, USED.plan, USED.clips));
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[0], "Claude read this plan and changed it in 1 place. Its notes are in talk.edit-notes.txt.");
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("is told of Claude in the banner after what could not be made, and where the video was filed", async () => {
    const t = setup({ claude: [{ code: 1, stderr: "offline\n", stdout: "" }], rough: "fail" });
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(t.notes, ["The cut plan for a.mov is ready, in the folder 2026-10-13, but its rough cut could not be made. Claude could not be asked, so the plan is the rules' alone."]);
    assert.deepEqual(t.read("2026-10-13", "a.cut-plan.txt").split("\n").slice(0, 3), [
      "The rough cut could not be made: ffmpeg stopped (Unknown encoder 'h264_videotoolbox').",
      "Claude could not be asked (Claude Code stopped (offline)), so this plan is the rules' alone.",
      "Kept 0:12 of 0:23. Cut 0:11."
    ]);
    t.done();
  });
  it("is never asked about when the run is told to go by the rules alone: everything is as the rules make it, and nothing is said of Claude", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.deps.rulesOnly = true;
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 11.882, cut: 11.541, folder: "", message: "" });
    assert.deepEqual([t.asks, t.calls.filter((c) => c.cmd === "CLAUDE")], [[], []]);
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), RULES);
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN));
    assert.deepEqual(t.logs.filter((line) => line.includes("Claude")), []);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("is not asked about when Claude Code is not on this Mac, and the plan's first line says that it is not installed", async () => {
    const t = setup();
    t.deps.rulesOnly = false;
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", captions: 5, kept: 11.882, cut: 11.541, folder: "", message: "" });
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "FFMPEG", "FFMPEG", "SWIFT", "FFMPEG"]);
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), RULES);
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "Claude Code is not installed, so this plan is the rules' alone."));
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("is not asked about when no plan could be made: there is nothing for Claude to read", async () => {
    const t = setup({ claude: [answers(REPLY)], told: null });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(t.asks, []);
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    t.done();
  });
});

describe("the short clips Claude picked", () => {
  it("are each cut whole from the video, without what the plan cuts inside them, as <name>.reel-<n>.mp4", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    // "It is very, very important." lies in the clip and is cut, so the clip is two stretches, each end on a whole picture.
    const [clip] = USED.clips;
    assert.deepEqual(clip.ranges, [{ start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }]);
    assert.deepEqual(stretches(clip.ranges), [{ start: 13.38, end: 16.516 }, { start: 19.219, end: 21.287 }]);
    assert.deepEqual(reelCalls(t).map((c) => c.args), [verticalArgs({ video: file, ranges: stretches(clip.ranges), crops: [crop(118), crop(118)], out: inRun(t, "talk.reel-1.mp4") })]);
    assert.equal(t.read("talk.reel-1.mp4"), "clip 1");
    t.done();
  });
  it("come with their captions on the clip's own clock, as <name>.reel-<n>.srt: the kept phrases of the clip and no others", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    // The clip starts a fifth of a second before its first words. Its second stretch starts 3.136 seconds into it.
    assert.equal(t.read("talk.reel-1.srt"), "1\n00:00:00,203 --> 00:00:02,950\nSo the first thing you need to do is know your costs.\n\n2\n00:00:03,331 --> 00:00:05,014\nThank you so much, Sallie.\n");
    t.done();
  });
  it("have in their captions a last phrase that the transcriber timed past the end of the file, where the clip itself ends", async () => {
    // The made-up recording, cut off at 20.9 seconds with no pause after its last words. The transcriber ends them at 20.94.
    const cutOff = { probed: probed({ duration: "20.900000" }), pauses: PAUSES.split("\n").slice(0, -3).join("\n") + "\n" };
    const heard = pausesOf(cutOff.pauses);
    const plan = cutPlan(phrasesOf(wordsOf(TOLD), heard), { duration: 20.9, pauses: heard });
    const reply = { decisions: [], notes: "", graphics: [], clips: REPLY.clips };
    const [clip] = used(reply, plan, heard).clips;
    assert.deepEqual([heard[heard.length - 1], plan.phrases[8].id, plan.phrases[8].end, clip.ranges], [[19.022, 19.414], "p9", 20.94, [{ start: 13.383, end: 20.9 }]]);
    const t = setup({ ...cutOff, claude: [answers(reply)] });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    // The clip is cut to the end of the file with the line spoken in it, so its captions hold the line, to the clip's end.
    assert.equal(t.read("talk.reel-1.srt"), "1\n00:00:00,203 --> 00:00:02,950\nSo the first thing you need to do is know your costs.\n\n2\n00:00:03,866 --> 00:00:05,642\nIt is very, very important.\n\n3\n00:00:06,034 --> 00:00:07,508\nThank you so much, Sallie.\n");
    // The rough cut's captions have it too.
    assert.match(t.read("talk.rough-cut.srt"), /\nThank you so much, Sallie\.\n$/);
    t.done();
  });
  it("are upright, 1080 by 1920, each stretch cropped on the speaker, by the stills and the faces that were found once for the upright version", async () => {
    // The speaker sits to the left until 16 seconds, and to the right after that.
    const faces = (still) => [face(still <= 8 ? 0.25 : 0.75)];
    const t = setup({ claude: [answers(TWO)], faces });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const made = used(TWO);
    assert.deepEqual(made.clips.map((c) => [c.n, c.ranges.length]), [[1, 1], [2, 2]]);
    // The stills are made once and the faces looked for once, though three videos are cropped by them.
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "CLAUDE", "FFMPEG", "FFMPEG", "SWIFT", "FFMPEG", "FFMPEG", "FFMPEG"]);
    assert.equal(t.calls.filter((c) => c.args[c.args.length - 1].endsWith("%04d.jpg")).length, 1);
    const crops = (clip) => cropsFor(FACTS, stretches(clip.ranges), stillsOf(faces));
    assert.deepEqual(reelCalls(t).map((c) => c.args), made.clips.map((clip) => verticalArgs({ video: file, ranges: stretches(clip.ranges), crops: crops(clip), out: inRun(t, `talk.reel-${clip.n}.mp4`) })));
    assert.deepEqual(made.clips.map((clip) => crops(clip).map((c) => c.x)), [[118], [118, 758]]);
    const graph = after(reelCalls(t)[1].args, "-filter_complex").split(";");
    assert.deepEqual(graph.filter((part) => part.includes("crop=")), ["[pv1]setpts=PTS-STARTPTS,crop=404:720:118:0[v0]", "[pv3]setpts=PTS-STARTPTS,crop=404:720:758:0[v1]"]);
    assert.equal(graph[graph.length - 1], "[j]scale=1080:1920,setsar=1[v]");
    assert.deepEqual(t.names(), [...WITH_NOTES, "reel-1.mp4", "reel-1.srt", "reel-2.mp4", "reel-2.srt"].sort().map((ending) => "talk." + ending));
    t.done();
  });
  it("are cropped at the centre of the picture, as the upright version is, when the faces could not be looked for, and the plan says so of both", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.deps.tools = { ...t.deps.tools, swift: "" };
    const file = t.video("talk.mov");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    assert.deepEqual(reelCalls(t).map((c) => c.args), [verticalArgs({ video: file, ranges: stretches(USED.clips[0].ranges), crops: [crop(438), crop(438)], out: inRun(t, "talk.reel-1.mp4") })]);
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(0, 2), [
      "Claude read this plan and changed it in 1 place. Its notes are in talk.edit-notes.txt.",
      "The upright version and the short clips are cropped at the centre of the picture, and not on the speaker: swift, which finds the faces, is not installed."
    ]);
    assert.ok(!t.calls.some((c) => c.cmd === "SWIFT" || c.args[c.args.length - 1].endsWith("%04d.jpg")));
    t.done();
  });
  it("keep the shape of a video that is upright or square already: nothing is cropped, and no face is looked for", async () => {
    for (const picture of [{ width: 1080, height: 1920 }, { width: 720, height: 720 }]) {
      const t = setup({ claude: [answers(REPLY)], probed: probed({ picture }) });
      const file = t.video("talk.mov");
      const r = await uneditedFile(file, t.deps);
      assert.deepEqual([r.ok, r.message], [true, ""]);
      assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG", "CLAUDE", "FFMPEG", "FFMPEG"]);
      assert.deepEqual(reelCalls(t).map((c) => c.args), [verticalArgs({ video: file, ranges: stretches(USED.clips[0].ranges), crops: null, out: inRun(t, "talk.reel-1.mp4") })]);
      const graph = after(reelCalls(t)[0].args, "-filter_complex").split(";");
      assert.ok(!graph.some((part) => part.includes("crop=")));
      assert.equal(graph[graph.length - 1], "[j]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[v]");
      assert.deepEqual(t.names(), [...WITH_NOTES, "reel-1.mp4", "reel-1.srt"].filter((ending) => ending !== "rough-cut.vertical.mp4").sort().map((ending) => "talk." + ending));
      t.done();
    }
  });
  it("are each written whole in the run's own folder before they are put beside the video, and before the plan that says the video is done", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    let during = null;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      const r = await run(cmd, args, asked);
      if (args[args.length - 1].endsWith(".reel-1.mp4")) during = t.names();
      return r;
    };
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(reelCalls(t)[0].args[reelCalls(t)[0].args.length - 1], inRun(t, "talk.reel-1.mp4"));
    assert.ok(!during.includes("talk.reel-1.mp4") && !during.includes("talk.reel-1.srt") && !during.includes("talk.cut-plan.json") && !during.includes("talk.edit-notes.txt"), during.join(" "));
    assert.ok(!t.names().some((n) => n.endsWith(".writing")));
    t.done();
  });
  it("of more than a minute come with each part of their Story as well, as <name>.reel-<n>.story-<k>.mp4", async () => {
    const talk = longTalk(16);
    const { plan, pauses } = planned(talk, 87.5);
    const reply = { decisions: [], notes: "", graphics: [], clips: [{ from: "p2", to: "p15", hook: "Fourteen points", why: "It stands alone." }] };
    const made = used(reply, plan, pauses);
    // From the second sentence to the fifteenth is 76.9 seconds. Its Story is cut on the last pause before the 60 second mark.
    assert.deepEqual(made.clips.map((c) => [c.n, c.length, c.fits.fits, c.story.map((part) => part.ranges)]), [[1, 76.9, true, [[{ start: 5.3, end: 60.5 }], [{ start: 60.5, end: 82.2 }]]]]);
    const t = setup({ ...talk, claude: [answers(reply)] });
    const file = t.video("talk.mov");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message, r.kept], [true, "", 87.5]);
    const facts = { ...FACTS, duration: 87.5 };
    const cut = (ranges, ending) => verticalArgs({ video: file, ranges: stretches(ranges), crops: cropsFor(facts, stretches(ranges), stillsOf()), out: inRun(t, `talk.reel-1${ending}.mp4`) });
    const [clip] = made.clips;
    assert.deepEqual(reelCalls(t).map((c) => c.args), [cut(clip.ranges, ""), cut(clip.story[0].ranges, ".story-1"), cut(clip.story[1].ranges, ".story-2")]);
    assert.deepEqual(t.names().filter((n) => n.includes(".reel-")), ["talk.reel-1.mp4", "talk.reel-1.srt", "talk.reel-1.story-1.mp4", "talk.reel-1.story-2.mp4"]);
    assert.deepEqual([t.read("talk.reel-1.mp4"), t.read("talk.reel-1.story-2.mp4")], ["clip 1", "part 2 of the Story of clip 1"]);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).claude.clips, [{ ...clip, files: ["talk.reel-1.mp4", "talk.reel-1.srt", "talk.reel-1.story-1.mp4", "talk.reel-1.story-2.mp4"] }]);
    // A clip that fits a Reel has no line about that in the notes.
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(2), ["Its clips", "1. 0:05 to 1:22, 77 seconds  |  On screen: Fourteen points  |  It stands alone.", ""]);
    t.done();
  });
  it("never have a part of their Story come out longer than 60 seconds, though each end of a part is moved to a whole picture", async () => {
    // 80 seconds of talk with no pause in it, after 5.519 seconds of silence. Claude picks all of it as one clip.
    const talk = longTalk(16, { lead: 5519, gap: 0, tail: 4481 });
    const { plan, pauses } = planned(talk, 90);
    const reply = { decisions: [], notes: "", graphics: [], clips: [{ from: "p1", to: "p16", hook: "Sixteen points", why: "It stands alone." }] };
    const [clip] = used(reply, plan, pauses).clips;
    // Nobody pauses in the 15 seconds before the 60 second mark, so the Story is cut at the mark: its first part is 60 seconds.
    assert.deepEqual([clip.ranges, clip.story.map((part) => [part.ranges, part.length])], [[{ start: 5.319, end: 85.719 }], [[[{ start: 5.319, end: 65.319 }], 60], [[{ start: 65.319, end: 85.719 }], 20.4]]]);
    // The nearest whole pictures to the first part's two ends are 159 and 1958: 1799 pictures, which is 60.027 seconds.
    assert.deepEqual(stretches(clip.story[0].ranges), [{ start: 5.305, end: 65.331 }]);
    const t = setup({ ...talk, claude: [answers(reply)] });
    const file = t.video("talk.mov");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    const cut = (ranges, ending) => verticalArgs({ video: file, ranges, crops: cropsFor(FACTS, ranges, stillsOf()), out: inRun(t, `talk.reel-1${ending}.mp4`) });
    // A minute holds 1798 pictures of this video, so the first part ends a picture sooner, on picture 1957. The clip itself
    // and the last part are as they were.
    const first = [{ start: 5.305, end: 65.298 }];
    assert.ok(first[0].end - first[0].start <= 60);
    assert.deepEqual(reelCalls(t).map((c) => c.args), [cut(stretches(clip.ranges), ""), cut(first, ".story-1"), cut(stretches(clip.story[1].ranges), ".story-2")]);
    t.done();
  });
  it("of a minute or less are their own Story, and get no file for one", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(USED.clips[0].story.length, 1);
    assert.deepEqual(t.names().filter((n) => n.includes(".story-")), []);
    assert.equal(reelCalls(t).length, 1);
    t.done();
  });
  it("are cut though they do not fit a Reel, and the notes say why they do not fit", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(USED.clips[0].fits, { fits: false, why: "It is 5.23 seconds long, and a Reel clip is at least 15 seconds." });
    assert.equal(t.read("talk.reel-1.mp4"), "clip 1");
    assert.ok(t.read("talk.edit-notes.txt").includes("\n   It does not fit a Reel. It is 5.23 seconds long, and a Reel clip is at least 15 seconds.\n"));
    t.done();
  });
  it("are cut one by one: a clip ffmpeg cannot make is said in the log and in the notes, and the others are cut all the same", async () => {
    const t = setup({ claude: [answers(TWO)], reels: { 1: "fail" } });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory)";
    assert.deepEqual([r.ok, r.captions, r.kept, r.message], [false, 5, 9.198, why]);
    assert.equal(reelCalls(t).length, 2);
    // Nothing of the clip that failed is left, and it has no captions.
    assert.deepEqual(t.names(), [...WITH_NOTES, "reel-2.mp4", "reel-2.srt"].sort().map((ending) => "talk." + ending));
    assert.equal(t.read("talk.reel-2.mp4"), "clip 2");
    assert.deepEqual(t.logs.slice(-2), ["talk.mov: cutting 2 short clips.", `talk.mov: ${why}.`]);
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(-3), ["What could not be used from its reply", "Clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory).", ""]);
    // Claude still picked it, so it is still in the list, with its times, for a person to cut by hand.
    assert.ok(t.read("talk.edit-notes.txt").includes("\n1. 0:05 to 0:09, 4 seconds  |  On screen: The opening  |  It says what the talk is about.\n"));
    const clips = JSON.parse(t.read("talk.cut-plan.json")).claude.clips;
    assert.deepEqual(clips.map((c) => [c.n, c.files, c.failed]), [[1, [], ["Clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory)."]], [2, ["talk.reel-2.mp4", "talk.reel-2.srt"], undefined]]);
    // The plan is whole, and the banner is the plan's.
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[1], "Kept 0:09 of 0:23. Cut 0:14.");
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready."]);
    t.done();
  });
  it("are cut one by one when ffmpeg writes nothing for one, or the work on one stops in a way nobody foresaw", async () => {
    const none = setup({ claude: [answers(TWO)], reels: { 2: "nothing" } });
    assert.equal((await uneditedFile(none.video("talk.mov"), none.deps)).message, "clip 2 could not be cut: ffmpeg stopped (no reason given)");
    assert.deepEqual(none.names().filter((n) => n.includes(".reel-")), ["talk.reel-1.mp4", "talk.reel-1.srt"]);
    none.done();
    const stopped = setup({ claude: [answers(TWO)], reels: { 1: "throw" } });
    assert.equal((await uneditedFile(stopped.video("talk.mov"), stopped.deps)).message, "clip 1 could not be cut: the work stopped (ENOSPC)");
    assert.deepEqual(stopped.names().filter((n) => n.includes(".reel-")), ["talk.reel-2.mp4", "talk.reel-2.srt"]);
    stopped.done();
  });
  it("keep the clip itself when its captions cannot be written, and the log and the notes say so", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    // Something else comes to be where the captions are written to, in the run's own folder, while the clip itself is being
    // cut.
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (args[args.length - 1].endsWith("talk.reel-1.mp4")) mkdirSync(join(dirname(args[args.length - 1]), "talk.reel-1.srt"));
      return run(cmd, args, asked);
    };
    const r = await uneditedFile(file, t.deps);
    const why = "the captions of clip 1 could not be written: the work stopped (EISDIR)";
    assert.deepEqual([r.ok, r.message], [false, why]);
    assert.equal(t.read("talk.reel-1.mp4"), "clip 1");
    assert.ok(!existsSync(join(t.dir, "talk.reel-1.srt")));
    assert.equal(t.logs[t.logs.length - 1], `talk.mov: ${why}.`);
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(-3), ["What could not be used from its reply", "The captions of clip 1 could not be written: the work stopped (EISDIR).", ""]);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).claude.clips[0].files, ["talk.reel-1.mp4"]);
    t.done();
  });
  it("keep what was made of them when a part of a Story cannot be cut, and the log and the notes say which part", async () => {
    const talk = longTalk(16);
    const reply = { decisions: [], notes: "", graphics: [], clips: [{ from: "p2", to: "p15", hook: "Fourteen points", why: "It stands alone." }] };
    const t = setup({ ...talk, claude: [answers(reply)], reels: { "1.2": "fail" } });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    const why = "part 2 of the Story of clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory)";
    assert.deepEqual([r.ok, r.message], [false, why]);
    assert.deepEqual(t.names().filter((n) => n.includes(".reel-")), ["talk.reel-1.mp4", "talk.reel-1.srt", "talk.reel-1.story-1.mp4"]);
    assert.equal(t.logs[t.logs.length - 1], `talk.mov: ${why}.`);
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(-3), ["What could not be used from its reply", "Part 2 of the Story of clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory).", ""]);
    const [clip] = JSON.parse(t.read("talk.cut-plan.json")).claude.clips;
    assert.deepEqual([clip.files, clip.failed], [["talk.reel-1.mp4", "talk.reel-1.srt", "talk.reel-1.story-1.mp4"], ["Part 2 of the Story of clip 1 could not be cut: ffmpeg stopped (Error while filtering: Cannot allocate memory)."]]);
    t.done();
  });
  it("are not cut from a file with no picture: the notes say so of each, and Claude's read is kept", async () => {
    const t = setup({ claude: [answers(REPLY)], probed: probed({ picture: null }) });
    const r = await uneditedFile(t.video("voice.m4a"), t.deps);
    assert.equal(r.message, "the rough cut could not be made: there is no picture in the file; the Final Cut file could not be made: there is no picture in the file; clip 1 could not be cut: there is no picture in the file");
    assert.deepEqual(reelCalls(t), []);
    assert.deepEqual(t.read("voice.edit-notes.txt").split("\n").slice(-3), ["What could not be used from its reply", "Clip 1 could not be cut: there is no picture in the file.", ""]);
    assert.equal(JSON.parse(t.read("voice.cut-plan.json")).by, "rules and Claude");
    assert.deepEqual(t.names().filter((n) => n.includes(".reel-")), []);
    t.done();
  });
  it("are taken away with the notes when the video is done again, before anything of the new run is made: the clips, their captions and the parts of a Story", async () => {
    const t = setup({ claude: [answers(TWO)] });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    // What an earlier run of more clips would have left, and a clip of another video, which is no business of this run.
    for (const name of ["talk.reel-5.mp4", "talk.reel-5.srt", "talk.reel-5.story-1.mp4", "talk.reel-5.story-2.mp4", "talk.old.reel-1.mp4"]) writeFileSync(join(t.dir, name), "old");
    const again = setup();
    let before = null;
    const run = again.deps.run;
    again.deps.run = async (cmd, args, asked) => {
      if (args.includes("-vf") && after(args, "-vf").includes("select=")) before = t.names();
      return run(cmd, args, asked);
    };
    await uneditedFile(file, { ...again.deps, tmpDir: t.work });
    assert.deepEqual(before.filter((n) => n.includes(".reel-") || n.includes("edit-notes")), ["talk.old.reel-1.mp4"]);
    assert.deepEqual(t.names(), [...ALL.map((ending) => "talk." + ending), "talk.old.reel-1.mp4"].sort());
    for (const made of [t, again]) made.done();
  });
  it("are taken away half written too, when a run that was killed left one under the name it was being written under", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("talk.mov");
    // What a run of an earlier version of the tool left, which wrote each clip beside the video under its name with .writing
    // after it, when it was killed while ffmpeg wrote its third clip, before any plan was written: the video still waits.
    // This run cuts one clip. The last is of another video, and is no business of this run.
    for (const name of ["talk.reel-3.mp4.writing", "talk.reel-3.srt.writing", "talk.reel-3.story-1.mp4.writing", "other.reel-1.mp4.writing"]) writeFileSync(join(t.dir, name), "half a clip");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    // Nothing of the video is left in the watched folder, which may be one that syncs to other people.
    assert.deepEqual(t.names(), ["2026-10-13", "other.reel-1.mp4.writing"]);
    assert.deepEqual(t.inside("2026-10-13").filter((n) => n.includes(".reel-")), ["talk.reel-1.mp4", "talk.reel-1.srt"]);
    t.done();
  });
});

describe("Claude's ideas for graphics in the Final Cut file", () => {
  it("are each a marker at the start of the phrase the idea sits on, beside the markers at the joins, and are worded as ideas", async () => {
    // Ideas for two kept phrases, for one that Claude itself cut, for one the rules cut, and for a phrase the plan does not have.
    const graphics = [REPLY.graphics[0], { id: "p8", idea: "The word IMPORTANT." }, { id: "p6", idea: "A slow zoom." }, { id: "p99", idea: "A title card." }, { id: "p4", idea: "The show's name." }];
    const t = setup({ claude: [answers({ ...REPLY, graphics })] });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    const xml = t.read("talk.fcpxml");
    // "Welcome to the show." starts at 6.07 seconds, which is picture 182, and "So the first thing" at 13.583, picture 407.
    assert.deepEqual(tags(xml, "marker").map((m) => `${m.start} ${m.value}`), [
      "176176/30000s Taken out, 5.9 seconds. Retake: said again at 0:06, the later one is kept. Cue: a spoken cue to start over",
      "182182/30000s Graphic idea: The show's name.",
      "401401/30000s Taken out, 3.5 seconds. False start: begun again at 0:13",
      "407407/30000s Graphic idea: The words &quot;Know your costs&quot; on screen.",
      "576576/30000s Taken out, 2.7 seconds. Claude: It adds nothing to the line before it.",
      "637637/30000s Taken out, 2.1 seconds. Pause: silence after the last words"
    ]);
    // An idea whose time is cut gets no marker. The notes say what became of it.
    assert.doesNotMatch(xml, /IMPORTANT|slow zoom|title card/);
    assert.deepEqual(t.read("talk.edit-notes.txt").split("\n").slice(-5), [
      "What could not be used from its reply",
      "An idea for a graphic sits on words that are cut, at 0:17: The word IMPORTANT.",
      "An idea for a graphic sits on words that are cut, at 0:12: A slow zoom.",
      'An idea for a graphic names "p99", which is not a phrase of the plan: A title card.',
      ""
    ]);
    assert.deepEqual(checkFcpxml(xml, { duration: 23.423, frameRate: "30000/1001" }), []);
    t.done();
  });
  it("are still there when the file is written again to name the video where it stayed", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const video = t.video("a.mov");
    t.deps.move = (from, to) => {
      if (from === video) throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
      renameSync(from, to);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.equal(tags(t.read("a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "a.mov")));
    assert.deepEqual(tags(t.read("a.fcpxml"), "marker").map((m) => m.value).filter((value) => value.startsWith("Graphic idea")), ["Graphic idea: The words &quot;Know your costs&quot; on screen."]);
    t.done();
  });
  it("are none when Claude was not asked: the markers are the joins' alone", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(tags(t.read("talk.fcpxml"), "marker").length, 3);
    assert.doesNotMatch(t.read("talk.fcpxml"), /Graphic idea/);
    t.done();
  });
});

describe("the videos of a video, made again from its cut plan (--from-plan)", () => {
  /** The moment every file of the run before is given, so that a test can tell which files a later run wrote. */
  const BEFORE = new Date("2026-10-14T08:00:00Z");
  /** Do a video as a run does it, and then mark what that run made: each video it made holds "made before", and every file
      in the folder has the moment BEFORE. What the run called, said and showed is then forgotten here, and what it called is
      given back as `first`. */
  const doneOnce = async (t, name = "talk.mov") => {
    const file = t.video(name);
    await uneditedFile(file, t.deps);
    const first = t.calls.slice();
    for (const n of t.names()) {
      if (n.endsWith(".mp4")) writeFileSync(join(t.dir, n), "made before");
      utimesSync(join(t.dir, n), BEFORE, BEFORE);
    }
    for (const said of [t.calls, t.logs, t.notes]) said.length = 0;
    return { file, first };
  };
  /** The files in the folder that were written since doneOnce. */
  const written = (t) => t.names().filter((n) => statSync(join(t.dir, n)).mtimeMs !== BEFORE.getTime());
  /** A call as it was made, with the run's own folder given one name: that folder is named for the moment it was made. */
  const same = (c) => ({ cmd: c.cmd, args: c.args.map((a) => a.replace(/brimm-unedited-\d+-\d+/, "the run's folder")) });
  /** The calls a run with Claude made after Claude answered: the ones that made its videos. */
  const making = (calls) => calls.slice(calls.findIndex((c) => c.cmd === "CLAUDE") + 1);
  /** Where the plan of the made-up recording is, and that plan written again by a test, as it is or as `change` changes it. */
  const at = (t) => join(t.dir, "talk.cut-plan.json");
  const rewrite = (t, text) => {
    writeFileSync(at(t), text);
    utimesSync(at(t), BEFORE, BEFORE);
  };
  /** What a run that stopped before it made anything gives back. */
  const stopped = (why) => ({ ok: false, name: "talk.mov", made: [], stopped: true, message: why });

  it("makes the rough cut, the upright version and the clips again, by the very calls the run that wrote the plan made, the faces found again, with no transcript and no Claude", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file, first } = await doneOnce(t);
    const r = await videosFromPlan(file, t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", made: ["talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4", "talk.reel-1.mp4"], message: "" });
    // ffprobe comes first, to see that the video is the one the plan was made of. Then, as before, the rough cut, the stills,
    // the faces in them, the upright version and the clip. The transcriber and Claude Code are not run.
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "FFMPEG", "SWIFT", "FFMPEG", "FFMPEG"]);
    assert.deepEqual(t.calls.slice(1).map(same), making(first).map(same));
    assert.equal(t.asks.length, 1);
    // They are written as the tool writes videos now.
    assert.equal(after(roughCalls(t)[0].args, "-c:v"), "libx264");
    assert.deepEqual([t.read("talk.rough-cut.mp4"), t.read("talk.rough-cut.vertical.mp4"), t.read("talk.reel-1.mp4")], ["the rough cut", "the upright version", "clip 1"]);
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("leaves every other file as it was: the transcripts, the words, the plan's two files, the notes, the captions and the Final Cut file, and moves nothing", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file } = await doneOnce(t);
    const names = t.names();
    const others = names.filter((n) => !n.endsWith(".mp4"));
    assert.deepEqual(others, ["talk.cut-plan.json", "talk.cut-plan.txt", "talk.edit-notes.txt", "talk.fcpxml", "talk.mov", "talk.reel-1.srt", "talk.rough-cut.srt", "talk.rough-cut.transcript.txt", "talk.srt", "talk.transcript.txt", "talk.words.json"]);
    const held = others.map((n) => t.read(n));
    await videosFromPlan(file, t.deps);
    assert.deepEqual(t.names(), names);
    assert.deepEqual(written(t), ["talk.reel-1.mp4", "talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4"]);
    assert.deepEqual(others.map((n) => t.read(n)), held);
    t.done();
  });
  it("makes each part of a clip's Story again, from the ranges the plan keeps for it", async () => {
    const talk = longTalk(16);
    const reply = { decisions: [], notes: "", graphics: [], clips: [{ from: "p2", to: "p15", hook: "Fourteen points", why: "It stands alone." }] };
    const t = setup({ ...talk, claude: [answers(reply)] });
    const { file, first } = await doneOnce(t);
    const r = await videosFromPlan(file, t.deps);
    const reels = ["talk.reel-1.mp4", "talk.reel-1.story-1.mp4", "talk.reel-1.story-2.mp4"];
    assert.deepEqual([r.ok, r.made], [true, ["talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4", ...reels]]);
    assert.equal(reelCalls(t).length, 3);
    assert.deepEqual(reelCalls(t).map(same), reelCalls({ calls: first }).map(same));
    assert.deepEqual(reels.map((n) => t.read(n)), ["clip 1", "part 1 of the Story of clip 1", "part 2 of the Story of clip 1"]);
    t.done();
  });
  it("writes each video whole in the run's own folder, and only then puts it beside the video over the one made before, with one move: until then that one is there as it was", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file } = await doneOnce(t);
    const seen = [];
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      const r = await run(cmd, args, asked);
      const to = args[args.length - 1];
      if (to.endsWith(".mp4")) seen.push([to.startsWith(t.work + "/"), basename(to), readFileSync(to, "utf8"), t.read(basename(to))]);
      return r;
    };
    const moves = movesOf(t);
    await videosFromPlan(file, t.deps);
    assert.deepEqual(seen, [[true, "talk.rough-cut.mp4", "the rough cut", "made before"], [true, "talk.rough-cut.vertical.mp4", "the upright version", "made before"], [true, "talk.reel-1.mp4", "clip 1", "made before"]]);
    assert.deepEqual(moves.map(([from, to]) => [from.startsWith(t.work + "/"), basename(from), to]), seen.map(([, n]) => [true, n, join(t.dir, n)]));
    assert.ok(!t.names().some((n) => n.endsWith(".writing")));
    t.done();
  });
  it("keeps the one made before when a video cannot be made again, says so in the log, and makes the others all the same", async () => {
    const script = { claude: [answers(TWO)] };
    const t = setup(script);
    const { file } = await doneOnce(t);
    // ffmpeg cannot make the rough cut or the upright version, and the work on the first clip stops. The upright version
    // that was made before has been deleted since.
    Object.assign(script, { rough: "fail", vertical: "fail", reels: { 1: "throw" } });
    rmSync(join(t.dir, "talk.rough-cut.vertical.mp4"));
    const r = await videosFromPlan(file, t.deps);
    const why = [
      "the rough cut could not be made again: ffmpeg stopped (Unknown encoder 'h264_videotoolbox')",
      "the upright version could not be made again: ffmpeg stopped (Error initializing complex filters)",
      "clip 1 could not be cut again: the work stopped (ENOSPC)"
    ];
    assert.deepEqual(r, { ok: false, name: "talk.mov", made: ["talk.reel-2.mp4"], message: why.join("; ") });
    assert.deepEqual(t.logs.filter((line) => line.includes("could not")), [`talk.mov: ${why[0]}. The one made before is kept.`, `talk.mov: ${why[1]}.`, `talk.mov: ${why[2]}. The one made before is kept.`]);
    assert.equal(t.logs[t.logs.length - 1], "talk.mov: made again: talk.reel-2.mp4.");
    assert.deepEqual([t.read("talk.rough-cut.mp4"), t.read("talk.reel-1.mp4"), t.read("talk.reel-2.mp4")], ["made before", "made before", "clip 2"]);
    assert.deepEqual(written(t), ["talk.reel-2.mp4"]);
    assert.ok(!t.names().some((n) => n.endsWith(".writing") || n === "talk.rough-cut.vertical.mp4"));
    t.done();
  });
  it("makes again only the clips and the parts of a Story the plan names as made: one the run before could not cut is not cut now, and the log says so", async () => {
    const script = { claude: [answers(TWO)], reels: { 1: "fail" } };
    const t = setup(script);
    const { file } = await doneOnce(t);
    delete script.reels;
    const r = await videosFromPlan(file, t.deps);
    assert.deepEqual([r.ok, r.made], [true, ["talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4", "talk.reel-2.mp4"]]);
    assert.deepEqual(t.logs.slice(-3), ["talk.mov: clip 1 was not cut by the run that wrote the plan, so it is not cut now.", "talk.mov: cutting 1 short clip.", "talk.mov: done. Made again: talk.rough-cut.mp4, talk.rough-cut.vertical.mp4 and talk.reel-2.mp4."]);
    assert.ok(!t.names().includes("talk.reel-1.mp4"));
    t.done();
    // The second part of a Story that could not be cut.
    const talk = longTalk(16);
    const reply = { decisions: [], notes: "", graphics: [], clips: [{ from: "p2", to: "p15", hook: "Fourteen points", why: "It stands alone." }] };
    const story = { ...talk, claude: [answers(reply)], reels: { "1.2": "fail" } };
    const s = setup(story);
    const done = await doneOnce(s);
    delete story.reels;
    const again = await videosFromPlan(done.file, s.deps);
    assert.deepEqual([again.ok, again.made], [true, ["talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4", "talk.reel-1.mp4", "talk.reel-1.story-1.mp4"]]);
    assert.ok(s.logs.includes("talk.mov: part 2 of the Story of clip 1 was not cut by the run that wrote the plan, so it is not cut now."));
    s.done();
  });
  it("makes no upright version of a video that is upright already, and looks for no face", async () => {
    const t = setup({ claude: [answers(REPLY)], probed: probed({ picture: { width: 1080, height: 1920 } }) });
    const { file, first } = await doneOnce(t);
    const r = await videosFromPlan(file, t.deps);
    assert.deepEqual([r.ok, r.made], [true, ["talk.rough-cut.mp4", "talk.reel-1.mp4"]]);
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "FFMPEG"]);
    assert.deepEqual(t.calls.slice(1).map(same), making(first).map(same));
    t.done();
  });
  it("makes the rough cut and the upright version of a plan the rules alone made, with no clips", async () => {
    const t = setup();
    const { file } = await doneOnce(t);
    const r = await videosFromPlan(file, t.deps);
    assert.deepEqual(r, { ok: true, name: "talk.mov", made: ["talk.rough-cut.mp4", "talk.rough-cut.vertical.mp4"], message: "" });
    t.done();
  });
  it("says in its log what it is doing and what it made again", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file } = await doneOnce(t);
    await videosFromPlan(file, t.deps);
    assert.deepEqual(t.logs, [
      "talk.mov: making its videos again from talk.cut-plan.json.",
      "talk.mov: making the rough cut.",
      "talk.mov: making the upright version.",
      "talk.mov: cutting 1 short clip.",
      "talk.mov: done. Made again: talk.rough-cut.mp4, talk.rough-cut.vertical.mp4 and talk.reel-1.mp4."
    ]);
    t.done();
  });
  it("stops with a plain line, and changes nothing, when there is no video or no cut plan beside it", async () => {
    const t = setup();
    const gone = join(t.dir, "talk.mov");
    assert.deepEqual(await videosFromPlan(gone, t.deps), stopped(`there is no video at ${gone}`));
    const file = t.video("talk.mov");
    assert.deepEqual(await videosFromPlan(file, t.deps), stopped(`there is no cut plan at ${at(t)}`));
    assert.deepEqual(t.logs, [`talk.mov: there is no video at ${gone}. Nothing was made.`, `talk.mov: there is no cut plan at ${at(t)}. Nothing was made.`]);
    assert.deepEqual([t.calls, t.names(), readdirSync(t.work)], [[], ["talk.mov"], []]);
    t.done();
  });
  it("stops with a plain line, and changes nothing, when the plan cannot be read or is not one this tool wrote", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file } = await doneOnce(t);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    const [clip] = plan.claude.clips;
    const cases = [
      ["{ not a plan", "it is not JSON"],
      ["[]", "it is not a cut plan this tool wrote"],
      [JSON.stringify({ ...plan, version: 2 }), "it is not a cut plan this tool wrote"],
      [JSON.stringify({ ...plan, facts: { ...plan.facts, width: "wide" } }), "the facts of its video cannot be read"],
      [JSON.stringify({ ...plan, ranges: [] }), "its ranges cannot be read"],
      [JSON.stringify({ ...plan, ranges: plan.ranges.map((r, i) => (i === 2 ? { ...r, end: "later" } : r)) }), "its ranges cannot be read"],
      [JSON.stringify({ ...plan, claude: { ...plan.claude, clips: [{ ...clip, ranges: undefined }] } }), "clip 1 in it cannot be read"],
      [JSON.stringify({ ...plan, claude: { ...plan.claude, clips: [{ ...clip, story: [{ start: 1 }] }] } }), "clip 1 in it cannot be read"],
      [JSON.stringify({ ...plan, claude: { ...plan.claude, clips: [{ ...clip, files: "all" }] } }), "clip 1 in it cannot be read"],
      [JSON.stringify({ ...plan, claude: { ...plan.claude, clips: "five" } }), "its clips cannot be read"]
    ];
    for (const [text, problem] of cases) {
      rewrite(t, text);
      t.logs.length = 0;
      const why = `the cut plan at ${at(t)} could not be read (${problem})`;
      assert.deepEqual(await videosFromPlan(file, t.deps), stopped(why), problem);
      assert.deepEqual(t.logs, [`talk.mov: ${why}. Nothing was made.`]);
      assert.deepEqual([t.calls, written(t)], [[], []]);
    }
    // A folder where the plan would be.
    rmSync(at(t));
    mkdirSync(at(t));
    assert.deepEqual(await videosFromPlan(file, t.deps), stopped(`the cut plan at ${at(t)} could not be read (EISDIR)`));
    assert.deepEqual([t.calls, readdirSync(t.work)], [[], []]);
    t.done();
  });
  it("stops with a plain line, and changes nothing, when the plan is of another video: by its name, or by what ffprobe says of the video now", async () => {
    const script = { claude: [answers(REPLY)] };
    const t = setup(script);
    const { file } = await doneOnce(t);
    const plan = t.read("talk.cut-plan.json");
    rewrite(t, plan.replace('"video": "talk.mov"', '"video": "talk.mp4"'));
    assert.deepEqual(await videosFromPlan(file, t.deps), stopped(`the cut plan at ${at(t)} is the plan of talk.mp4, and not of talk.mov`));
    assert.deepEqual(t.calls, []);
    rewrite(t, plan);
    // The same name, and a video of 45 seconds where the plan's was 23.
    script.probed = probed({ duration: "45.000000" });
    assert.deepEqual(await videosFromPlan(file, t.deps), stopped(`the cut plan at ${at(t)} was made of another video: one of 23.423 seconds, 1280 by 720 at 30000/1001, and talk.mov is 45 seconds, 1280 by 720 at 30000/1001`));
    script.probed = probed({ picture: { width: 640, height: 360 } });
    assert.deepEqual((await videosFromPlan(file, t.deps)).message, `the cut plan at ${at(t)} was made of another video: one of 23.423 seconds, 1280 by 720 at 30000/1001, and talk.mov is 23.423 seconds, 640 by 360 at 30000/1001`);
    script.probed = probed({ picture: { r_frame_rate: "25/1", avg_frame_rate: "25/1" } });
    assert.deepEqual((await videosFromPlan(file, t.deps)).message, `the cut plan at ${at(t)} was made of another video: one of 23.423 seconds, 1280 by 720 at 30000/1001, and talk.mov is 23.423 seconds, 1280 by 720 at 25/1`);
    // ffprobe cannot read the video at all.
    script.probed = undefined;
    script.probe = "fail";
    assert.deepEqual(await videosFromPlan(file, t.deps), stopped("the video could not be read (moov atom not found)"));
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFPROBE", "FFPROBE", "FFPROBE"]);
    assert.deepEqual([written(t), readdirSync(t.work)], [[], []]);
    // A length a few hundredths of a second off is the same video, read by another ffprobe.
    delete script.probe;
    script.probed = probed({ duration: "23.480000" });
    assert.equal((await videosFromPlan(file, t.deps)).ok, true);
    t.done();
  });
  it("stops with a plain line, and changes nothing, when the plan's video has no picture, or the plan keeps nothing", async () => {
    const sound = setup({ probed: probed({ picture: null }) });
    const { file } = await doneOnce(sound, "talk.m4a");
    const r = await videosFromPlan(file, sound.deps);
    assert.deepEqual(r, { ...stopped("its cut plan says it has no picture, so it has no videos to make"), name: "talk.m4a" });
    assert.deepEqual(sound.calls.map((c) => c.cmd), ["FFPROBE"]);
    sound.done();
    const t = setup();
    const done = await doneOnce(t);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    rewrite(t, JSON.stringify({ ...plan, ranges: plan.ranges.map((r) => ({ ...r, keep: false })) }));
    assert.deepEqual(await videosFromPlan(done.file, t.deps), stopped("its cut plan keeps nothing, so it has no videos to make"));
    assert.deepEqual([t.calls.map((c) => c.cmd), written(t)], [["FFPROBE"], []]);
    t.done();
  });
  it("never moves the video, and never takes a lock on its folder", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const { file } = await doneOnce(t);
    await videosFromPlan(file, { ...t.deps, watched: t.dir });
    assert.ok(t.names().includes("talk.mov"));
    assert.deepEqual(readdirSync(t.locks), []);
    assert.ok(!t.names().some((n) => /^\d{4}-\d{2}-\d{2}/.test(n)));
    t.done();
  });
});

describe("a folder of unedited videos", () => {
  const notAllowed = () => Object.assign(new Error("operation not permitted"), { code: "EPERM" });
  /** Have the video `name` be one that cannot be moved, and every other file be moved as it would be. */
  const stuck = (t, name) => {
    t.deps.move = (from, to) => {
      if (resolve(from) === join(t.dir, name)) throw notAllowed();
      renameSync(from, to);
    };
  };
  /** Have the files moved as they would be, until three have gone into the folder for the day: then no more can go there. */
  const fullAfterThree = (t) => {
    let moved = 0;
    t.deps.move = (from, to) => {
      if (dirname(to) === join(t.dir, "2026-10-13")) {
        if (moved === 3) throw notAllowed();
        moved += 1;
      }
      renameSync(from, to);
    };
  };
  it("has the notes and the clips of each video filed with the rest of its files, and the video is not taken again", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.deepEqual(t.inside("2026-10-13"), [...WITH_NOTES, "reel-1.mp4", "reel-1.srt"].sort().map((ending) => "a." + ending));
    assert.equal(t.read("2026-10-13", "a.reel-1.mp4"), "clip 1");
    assert.deepEqual(JSON.parse(t.read("2026-10-13", "a.cut-plan.json")).claude.clips[0].files, ["a.reel-1.mp4", "a.reel-1.srt"]);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.equal(t.asks.length, 1);
    t.done();
  });
  it("has the video moved first, then the files the rules make, then the notes and the clips, and the plan last", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    const order = [];
    t.deps.move = (from, to) => {
      order.push(basename(from));
      renameSync(from, to);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.equal(order[0], "a.mov");
    assert.deepEqual(order.slice(-5), ["a.fcpxml", "a.edit-notes.txt", "a.reel-1.mp4", "a.reel-1.srt", "a.cut-plan.json"]);
    t.done();
  });
  it("never takes a short clip, or a part of its Story, as a video that is waiting, though it was left in the folder", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    for (const name of ["talk.reel-1.mp4", "talk.reel-2.story-1.mp4", "talk.reel-2.story-2.mp4"]) t.video(name);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.deepEqual([t.calls, t.logs], [[], ["Looked in the folder: nothing is waiting."]]);
    t.done();
  });
  it("has each video that has no cut plan yet done once, and filed with all of its files in a new folder named for the day", async () => {
    const t = setup();
    t.video("b.mp4");
    t.video("a.mov", "the video itself");
    writeFileSync(join(t.dir, "notes.txt"), "not a video");
    const first = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(first.map((r) => [r.name, r.ok, r.folder]), [["a.mov", true, "2026-10-13"], ["b.mp4", true, "2026-10-13-2"]]);
    assert.deepEqual(t.names(), ["2026-10-13", "2026-10-13-2", "notes.txt"]);
    assert.deepEqual(t.inside("2026-10-13"), ALL.map((ending) => "a." + ending));
    assert.deepEqual(t.inside("2026-10-13-2"), ALL.map((ending) => "b." + (ending === "mov" ? "mp4" : ending)));
    assert.equal(t.read("2026-10-13", "a.mov"), "the video itself");
    assert.equal(JSON.parse(t.read("2026-10-13", "a.cut-plan.json")).video, "a.mov");
    assert.deepEqual(t.notes, ["The cut plan for a.mov is ready, in the folder 2026-10-13.", "The cut plan for b.mp4 is ready, in the folder 2026-10-13-2."]);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.equal(t.calls.length, 18);
    assert.deepEqual(readdirSync(t.locks), []);
    t.done();
  });
  it("says in its log that it looked, what was waiting, and where each video went", async () => {
    const t = setup();
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(t.logs, ["Looked in the folder: nothing is waiting."]);
    t.video("a.mov");
    t.video("b.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.equal(t.logs[1], "Looked in the folder: 2 waiting (a.mov, b.mov).");
    assert.equal(t.logs[t.logs.length - 1], 'b.mov: moved with its files into "2026-10-13-2".');
    t.done();
  });
  it("leaves alone a video that has its cut plan beside it, one with a note that it failed, and a rough cut", async () => {
    const t = setup();
    for (const name of ["done.mov", "bad.mov", "talk.rough-cut.mp4"]) t.video(name);
    writeFileSync(join(t.dir, "done.cut-plan.json"), "kept");
    writeFileSync(join(t.dir, "bad.failed.txt"), "kept");
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.deepEqual(t.calls, []);
    assert.equal(t.read("done.cut-plan.json"), "kept");
    t.done();
  });
  it("moves the video first, so a run cut short never leaves it in the folder to be done a second time", async () => {
    const t = setup();
    t.video("a.mov");
    const order = [];
    t.deps.move = (from, to) => {
      order.push([basename(from), to]);
      renameSync(from, to);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(order[0], ["a.mov", join(t.dir, "2026-10-13", "a.mov")]);
    assert.deepEqual(order.map((o) => o[0]).sort(), ALL.map((ending) => "a." + ending));
    assert.ok(order.every(([name, to]) => to === join(t.dir, "2026-10-13", name)));
    t.done();
  });
  it("works under the transcript tool's own lock, so the two never work on one folder at the same time", async () => {
    const t = setup();
    t.video("a.mov");
    let held = null;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      held = held || readdirSync(t.locks);
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(held, [basename(lockFile(t.dir, t.locks))]);
    assert.deepEqual(readdirSync(t.locks), []);
    t.video("b.mov");
    writeFileSync(lockFile(t.dir, t.locks), "4242");
    assert.deepEqual(await uneditedFolder(t.dir, { ...t.deps, alive: (pid) => pid === 4242 }), []);
    assert.equal(t.logs[t.logs.length - 1], "Another run (process 4242) is at work on this folder. Nothing was started.");
    assert.equal(t.calls.length, 9);
    assert.ok(existsSync(lockFile(t.dir, t.locks)));
    t.done();
  });
  it("leaves a video where it is, and puts its files beside it, when it cannot be moved. It still counts as done, and no empty folder is left", async () => {
    const t = setup();
    t.video("a.mov");
    stuck(t, "a.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, ""]);
    assert.deepEqual(t.names(), ALL.map((ending) => "a." + ending));
    assert.equal(t.logs[t.logs.length - 1], "a.mov: could not be moved into a folder for the day (EPERM), so it stays in the watched folder, and its files are put beside it there.");
    assert.deepEqual(t.notes, ["The cut plan for a.mov is ready."]);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.equal(t.calls.length, 9);
    t.done();
  });
  it("puts in the watched folder the files that could not be put in the folder for the day, and says which they are", async () => {
    const t = setup();
    t.video("a.mov");
    fullAfterThree(t);
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, ""]);
    assert.deepEqual(t.inside("2026-10-13"), ["a.mov", "a.srt", "a.transcript.txt"]);
    const rest = ["a.words.json", "a.cut-plan.txt", "a.rough-cut.mp4", "a.rough-cut.srt", "a.rough-cut.transcript.txt", "a.rough-cut.vertical.mp4", "a.fcpxml", "a.cut-plan.json"];
    assert.deepEqual(t.names(), ["2026-10-13", ...rest].sort());
    assert.equal(t.logs[t.logs.length - 1], `a.mov: moved into "2026-10-13", but not all of its files could be put there (EPERM). Put in the watched folder instead: ${rest.join(", ")}.`);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    t.done();
  });
  it("has each video's Final Cut file name the video in the folder for the day it is filed into", async () => {
    const t = setup();
    t.video("b.mp4");
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.equal(tags(t.read("2026-10-13", "a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "2026-10-13", "a.mov")));
    assert.equal(tags(t.read("2026-10-13-2", "b.fcpxml"), "media-rep")[0].src, address(join(t.dir, "2026-10-13-2", "b.mp4")));
    t.done();
  });
  it("has the Final Cut file name that folder before anything is moved, so the file put there after the video is right", async () => {
    const t = setup();
    t.video("a.mov");
    let named = "";
    t.deps.move = (from, to) => {
      named = named || tags(readFileSync(inRun(t, "a.fcpxml"), "utf8"), "media-rep")[0].src;
      renameSync(from, to);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.equal(named, address(join(t.dir, "2026-10-13", "a.mov")));
    t.done();
  });
  it("files a video in the very folder its Final Cut file names, though the day turns between the two", async () => {
    const t = setup();
    t.video("a.mov");
    // The folder is named once, before the Final Cut file is written. Asked again at the move, the day would be the next one.
    const days = ["2026-10-13"];
    t.deps.today = () => days.shift() || "2026-10-14";
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.equal(tags(t.read("2026-10-13", "a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "2026-10-13", "a.mov")));
    t.done();
  });
  it("has the Final Cut file name the video where it stayed, when the video could not be moved", async () => {
    const t = setup();
    t.video("a.mov");
    stuck(t, "a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.equal(tags(t.read("a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "a.mov")));
    assert.deepEqual(checkFcpxml(t.read("a.fcpxml"), { duration: 23.423, frameRate: "30000/1001" }), []);
    assert.ok(!t.names().includes("a.fcpxml.writing"));
    t.done();
  });
  it("leaves nothing but the video in the watched folder when the run stops before the video is moved, and does the video again the next time", async () => {
    // The plan cannot be written, as text or as the JSON that says the video is done: something else is where it is written to.
    for (const name of ["a.cut-plan.txt", "a.cut-plan.json"]) {
      const t = setup();
      t.video("a.mov");
      const run = t.deps.run;
      taken(t, name);
      assert.deepEqual(await uneditedFolder(t.dir, t.deps), [{ ok: false, name: "a.mov", message: "EISDIR" }], name);
      assert.deepEqual(t.names(), ["a.mov"], name);
      assert.deepEqual(readdirSync(t.work), []);
      t.deps.run = run;
      const [again] = await uneditedFolder(t.dir, t.deps);
      assert.deepEqual([again.ok, again.folder], [true, "2026-10-13"], name);
      t.done();
    }
  });
  it("has the Final Cut file name the video by its whole path, though the folder was given by its path from the folder the tool was started in", async () => {
    const t = setup();
    t.video("a.mov");
    const [r] = await uneditedFolder(relative(process.cwd(), t.dir), t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    assert.equal(tags(t.read("2026-10-13", "a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "2026-10-13", "a.mov")));
    t.done();
    // The same when the video could not be moved, and its file is written again to name it where it stayed.
    const left = setup();
    left.video("a.mov");
    stuck(left, "a.mov");
    await uneditedFolder(relative(process.cwd(), left.dir), left.deps);
    assert.equal(tags(left.read("a.fcpxml"), "media-rep")[0].src, address(join(left.dir, "a.mov")));
    left.done();
  });
  it("has the Final Cut file name the video in the folder for the day when the video went there and the file itself did not", async () => {
    const t = setup();
    t.video("a.mov");
    fullAfterThree(t);
    await uneditedFolder(t.dir, t.deps);
    assert.ok(t.inside("2026-10-13").includes("a.mov") && t.names().includes("a.fcpxml"));
    assert.equal(tags(t.read("a.fcpxml"), "media-rep")[0].src, address(join(t.dir, "2026-10-13", "a.mov")));
    t.done();
  });
  it("leaves a video no transcript could be made from where it is, with its note, and does not try it again until the note is deleted", async () => {
    const t = setup({ ffmpeg: "fail" });
    t.video("bad.mov");
    assert.equal((await uneditedFolder(t.dir, t.deps))[0].ok, false);
    assert.deepEqual(t.names(), ["bad.failed.txt", "bad.mov"]);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    rmSync(join(t.dir, "bad.failed.txt"));
    assert.equal((await uneditedFolder(t.dir, t.deps)).length, 1);
    assert.deepEqual(readdirSync(t.locks), []);
    t.done();
  });
  it("files what was made when the rough cut could not be, and the banner says where", async () => {
    const t = setup({ rough: "fail" });
    t.video("a.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [false, "2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.deepEqual(t.inside("2026-10-13"), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "a." + ending));
    assert.deepEqual(t.notes, ["The cut plan for a.mov is ready, in the folder 2026-10-13, but its rough cut could not be made."]);
    t.done();
  });
  it("files what was made when the work on the rough cut stops in a way nobody foresaw, and does not take the video again", async () => {
    const t = setup({ rough: "throw" });
    t.video("a.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder, r.message], [false, "2026-10-13", "the rough cut could not be made: the work stopped (ENOSPC)"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.deepEqual(t.inside("2026-10-13"), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "a." + ending));
    assert.equal(t.read("2026-10-13", "a.cut-plan.txt").split("\n")[0], "The rough cut could not be made: the work stopped (ENOSPC).");
    assert.deepEqual(t.notes, ["The cut plan for a.mov is ready, in the folder 2026-10-13, but its rough cut could not be made."]);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.equal(t.calls.length, 9);
    t.done();
  });
  it("files what was made when no plan could be, and does not take the video again even if it could not be moved", async () => {
    const t = setup({ told: null });
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(t.inside("2026-10-13"), ["a.cut-plan.txt", "a.mov", "a.srt", "a.transcript.txt"]);
    assert.deepEqual(t.notes, ["The transcript of a.mov is ready, in the folder 2026-10-13, but no cut plan could be made. See a.cut-plan.txt."]);
    t.done();
    const left = setup({ told: null });
    left.video("b.mov");
    stuck(left, "b.mov");
    await uneditedFolder(left.dir, left.deps);
    assert.deepEqual(left.names(), ["b.cut-plan.txt", "b.mov", "b.srt", "b.transcript.txt"]);
    assert.deepEqual(await uneditedFolder(left.dir, left.deps), []);
    assert.equal(left.calls.length, 4);
    left.done();
  });
  it("says so in plain words when the folder cannot be read, and frees the folder for the next try", async () => {
    const t = setup();
    assert.deepEqual(await uneditedFolder(join(t.dir, "not there"), t.deps), []);
    assert.match(t.logs[0], /^The folder could not be read \(ENOENT\)\. If it is in Dropbox or another cloud drive, allow node to read it in System Settings, Privacy & Security, Files and Folders\.$/);
    assert.deepEqual(readdirSync(t.locks), []);
    t.done();
  });
});

describe("what the progress panel is told", () => {
  /** A stand-in for the progress reporter: it keeps what it is told, in order, and gives ffmpeg one more option, as the real
      one does, so that a test can see where it goes. */
  const watching = (t) => {
    const told = [];
    t.deps.progress = {
      begin: (video) => told.push(["begin", video]),
      length: (seconds) => told.push(["length", seconds]),
      steps: (names) => told.push(["steps", names]),
      step: (name, shown = name) => told.push(["step", shown]),
      fraction: () => {},
      encoding: (seconds) => {
        told.push(["encoding", Math.round(seconds * 1000) / 1000]);
        return { args: ["-progress", "/progress/ffmpeg.txt"], stop: () => told.push(["stopped"]) };
      },
      end: (finished) => told.push(["end", finished])
    };
    return told;
  };
  const steps = (told) => told.filter(([what]) => what === "step").map(([, shown]) => shown);
  const ALL_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Asking Claude", "Making the rough cut", "Finding the faces", "Making the upright version", "Cutting the short clips"];
  it("is told each step of a video as it begins, the steps to come, the video's length, and the end", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(told[0], ["begin", "talk.mov"]);
    assert.deepEqual(told[told.length - 1], ["end", true]);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript", "Making the cut plan", "Asking Claude", "Making the rough cut", "Finding the faces", "Making the upright version", "Cutting short clip 1 of 1"]);
    assert.deepEqual(told.find(([what]) => what === "length"), ["length", 23.423]);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [ALL_STEPS, ALL_STEPS, ALL_STEPS]);
    t.done();
  });
  it("has ffmpeg say how far it has got with each video it writes, and stops reading it when ffmpeg has ended", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const told = watching(t);
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    // Each encode is followed at once by the end of the watching: the rough cut, the upright version and the clip.
    const at = told.map(([what], i) => (what === "encoding" ? i : -1)).filter((i) => i >= 0);
    assert.equal(at.length, 3);
    for (const i of at) assert.deepEqual(told[i + 1], ["stopped"]);
    // The rough cut's encode is as long as the stretches it is made of, each end on a whole picture, and ffmpeg is given
    // -progress before everything else.
    const kept = keptSpans(USED.plan.ranges, FACTS.fps).reduce((sum, span) => sum + (span.end - span.start), 0);
    assert.deepEqual(told[at[0]], ["encoding", Math.round(kept * 1000) / 1000]);
    assert.deepEqual(roughCalls(t)[0].args, ["-progress", "/progress/ffmpeg.txt", ...roughCutArgs(file, inRun(t, "talk.rough-cut.mp4"), { ranges: USED.plan.ranges, fps: FACTS.fps })]);
    assert.deepEqual(uprightCall(t).args.slice(0, 2), ["-progress", "/progress/ffmpeg.txt"]);
    t.done();
  });
  it("is told less to come when the video is upright already, Claude is not asked or picks no clip, and of filing in a folder", async () => {
    const t = setup({ probed: probed({ picture: { width: 1080, height: 1920 } }) });
    const told = watching(t);
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names).slice(-1), [["Reading the sound", "Writing the transcript", "Making the cut plan", "Making the rough cut", "Filing"]]);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript", "Making the cut plan", "Making the rough cut", "Filing"]);
    t.done();
  });
  it("is told of a video that cannot be done what was begun, and the end, so that its bar goes", async () => {
    const t = setup({ whisper: "fail" });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript"]);
    // The work did not finish, so what its steps took is not kept as a measure.
    assert.deepEqual(told[told.length - 1], ["end", false]);
    t.done();
  });
  it("is told the videos made again from a plan (--from-plan): the rough cut, the faces, the upright version and each clip", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const told = watching(t);
    await videosFromPlan(file, t.deps);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [["Making the rough cut", "Finding the faces", "Making the upright version", "Cutting the short clips"]]);
    assert.deepEqual(steps(told), ["Making the rough cut", "Finding the faces", "Making the upright version", "Cutting clip 1"]);
    assert.deepEqual([told[0], told[told.length - 1]], [["begin", "talk.mov"], ["end", true]]);
    t.done();
  });
  it("is told at the end that the work did not finish when a file could not be made, so its steps are not measured", async () => {
    const t = setup({ rough: "fail" });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(told[told.length - 1], ["end", false]);
    t.done();
  });
  it("is the real reporter in a run from the command line, writing in Application Support in the home folder, with this Mac's swift", () => {
    const deps = depsFor({ ffmpeg: "/f", ffprobe: "/p", whisper: "/w", swift: "", claude: "", model: "/m", missing: [] }, () => {}, { HOME: "/Users/sallie" });
    assert.equal(typeof deps.progress.begin, "function");
    assert.equal(progressFolder("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/progress");
  });
});

describe("several folders of unedited videos", () => {
  it("are each worked in the order given and named in the log, and the run ends with 0", async () => {
    const t = setup();
    const second = join(t.dir, "second");
    mkdirSync(second);
    t.video("a.mov");
    writeFileSync(join(second, "b.mov"), "video");
    assert.equal(await uneditedFolders([second, t.dir], t.deps), 0);
    assert.deepEqual(t.calls.filter((c) => c.args.includes("-vn")).map((c) => after(c.args, "-i")), [join(second, "b.mov"), join(t.dir, "a.mov")]);
    assert.deepEqual(t.logs.slice(0, 2), [`Folder: ${second}`, "Looked in the folder: 1 waiting (b.mov)."]);
    assert.deepEqual(t.inside("second"), ["2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13", "second"]);
    t.done();
  });
  it("go on without a folder that is not there: it is named in the log, the others are worked, and the run ends with 2", async () => {
    const t = setup();
    t.video("a.mov");
    const gone = join(t.dir, "not there");
    assert.equal(await uneditedFolders([gone, t.dir], t.deps), 2);
    assert.equal(t.logs[0], `There is no folder at ${gone}.`);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    t.done();
  });
  it("end the run with 1 when a video failed or something of it could not be made, and with 0 when one is only still arriving", async () => {
    const a = setup({ ffmpeg: "fail" });
    a.video("bad.mov");
    assert.equal(await uneditedFolders([a.dir], a.deps), 1);
    a.done();
    const b = setup({ rough: "fail" });
    b.video("a.mov");
    assert.equal(await uneditedFolders([b.dir], b.deps), 1);
    b.done();
    const c = setup({ sizes: Array.from({ length: 500 }, (_, i) => i + 1) });
    c.video("huge.mov");
    assert.equal(await uneditedFolders([c.dir], c.deps), 0);
    c.done();
  });
});

describe("before it starts", () => {
  const HOME = "/Users/someone";
  const MODEL = HOME + "/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin";
  /** What is found on a Mac that holds the files `there`. `xcodeTools` says whether Xcode's command line tools are on it. */
  const found = (there, PATH, xcodeTools = () => true) => findPrograms({ exists: (p) => there.includes(p), env: { HOME, PATH }, xcodeTools });
  it("finds ffprobe with the transcript tool's own programs, where Homebrew puts them", () => {
    const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL];
    assert.deepEqual(found(there, "/usr/bin:/bin"), { ffmpeg: "/opt/homebrew/bin/ffmpeg", whisper: "/opt/homebrew/bin/whisper-cli", model: MODEL, ffprobe: "/opt/homebrew/bin/ffprobe", swift: "", claude: "", missing: [] });
  });
  it("finds Claude Code on the PATH, then where Homebrew puts programs, then in the home folder's own .local/bin, and goes on without it", () => {
    const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL];
    const all = ["/tools/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude", HOME + "/.local/bin/claude"];
    // Each place is looked in when the ones before it hold no claude. The launch agent's PATH has no home folder in it.
    assert.deepEqual(all.map((_, i) => found([...there, ...all.slice(i)], "/tools:/usr/bin").claude), all);
    assert.equal(found([...there, HOME + "/.local/bin/claude"], "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin").claude, HOME + "/.local/bin/claude");
    // Without it the work goes on by the rules alone, so it is never among what is missing.
    const none = found(there, "/tools:/usr/bin");
    assert.deepEqual([none.claude, none.missing], ["", []]);
    // Another user's .local/bin is not looked in.
    assert.equal(found([...there, "/Users/other/.local/bin/claude"], "/usr/bin").claude, "");
  });
  it("takes the ffprobe that is beside ffmpeg before any other, and another when there is none beside it", () => {
    const there = ["/a/ffprobe", "/b/ffmpeg", "/b/ffprobe", "/b/whisper-cli", MODEL];
    assert.equal(found(there, "/a:/b").ffprobe, "/b/ffprobe");
    assert.equal(found(there.filter((p) => p !== "/b/ffprobe"), "/a:/b").ffprobe, "/a/ffprobe");
  });
  it("says in plain words when ffprobe is missing, after anything else that is", () => {
    const some = found(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/whisper-cli", MODEL], "/usr/bin");
    assert.deepEqual([some.ffprobe, some.missing], ["", ["ffprobe is not installed. It comes with ffmpeg."]]);
    assert.deepEqual(found([], "/usr/bin").missing, ["ffmpeg is not installed.", "The transcriber (whisper-cpp) is not installed.", `The transcriber's model is not at ${MODEL}.`, "ffprobe is not installed. It comes with ffmpeg."]);
  });
  it("finds swift, which finds the faces, on the PATH or where the Mac keeps it, and goes on without it", () => {
    const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL, "/usr/bin/swift"];
    assert.equal(found(there, "/opt/homebrew/bin").swift, "/usr/bin/swift");
    assert.equal(found([...there, "/toolchain/bin/swift"], "/toolchain/bin:/usr/bin").swift, "/toolchain/bin/swift");
    const none = found(there.filter((p) => p !== "/usr/bin/swift"), "/usr/bin:/bin");
    assert.deepEqual([none.swift, none.missing], ["", []]);
  });
  it("does not take the swift that is on every Mac for the real one: without Xcode's command line tools it is as if swift were not there", () => {
    // /usr/bin/swift is macOS's own stand-in until the tools are installed. Run, it finds no face, and puts up a window.
    const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL, "/usr/bin/swift"];
    const without = found(there, "/opt/homebrew/bin:/usr/bin", () => false);
    assert.deepEqual([without.swift, without.missing], ["", []]);
    assert.equal(found(there, "/opt/homebrew/bin:/usr/bin", () => true).swift, "/usr/bin/swift");
    // Nobody is asked about the tools when there is no swift to ask about.
    let asked = 0;
    found(there.filter((p) => p !== "/usr/bin/swift"), "/usr/bin", () => { asked += 1; return true; });
    assert.equal(asked, 0);
  });
  it("gives a run from the command line the home folder HOME names, where the Final Cut file's library is kept, and the Mac's own when HOME names none", () => {
    const programs = found(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL, "/usr/bin/swift"], "/usr/bin");
    const log = () => {};
    const deps = depsFor(programs, log, { HOME });
    assert.deepEqual(Object.keys(deps).sort(), ["home", "log", "model", "notify", "progress", "rulesOnly", "run", "settings", "tools", "wait"]);
    assert.deepEqual([deps.home, deps.tools, deps.model, deps.log, deps.run, deps.settings], [HOME, programs, MODEL, log, runProgram, null]);
    assert.equal(depsFor(programs, log, {}).home, homedir());
  });
  it("gives a run from the command line this Mac's settings for episodes, from the home folder HOME names, when it has them", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-home-"));
    const programs = found(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL], "/usr/bin");
    writeSettings(home, { machine: "Mac Studio", root: "/Dropbox/BRIMM Video", checkout: "/checkout" });
    assert.deepEqual(depsFor(programs, () => {}, { HOME: home }).settings, { version: 1, machine: "Mac Studio", root: "/Dropbox/BRIMM Video", checkout: "/checkout" });
    rmSync(home, { recursive: true, force: true });
  });
  it("gives a run from the command line the word that Claude is not to be asked, only when --rules-only was given", () => {
    const programs = found(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL], "/usr/bin");
    assert.equal(depsFor(programs, () => {}, { HOME }).rulesOnly, false);
    assert.equal(depsFor(programs, () => {}, { HOME }, parseArgs(["/in/a.mov"])).rulesOnly, false);
    assert.equal(depsFor(programs, () => {}, { HOME }, parseArgs(["--rules-only", "/in/a.mov"])).rulesOnly, true);
  });
  it("reads what it is asked to do", () => {
    assert.deepEqual(parseArgs(["/in/a.mov"]), { file: "/in/a.mov", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false });
    assert.deepEqual(parseArgs(["/in/a.mov", "--out", "/out"]), { file: "/in/a.mov", folders: [], out: "/out", rulesOnly: false, fromPlan: false, help: false });
    assert.deepEqual(parseArgs(["--watch", "/in"]), { file: "", folders: ["/in"], out: "", rulesOnly: false, fromPlan: false, help: false });
    assert.deepEqual(parseArgs(["--watch", "/b", "--watch", "/a"]).folders, ["/b", "/a"]);
    assert.equal(parseArgs([]).help, true);
    assert.equal(parseArgs(["--help"]).help, true);
    assert.equal(parseArgs(["--watch"]).help, true);
  });
  it("reads --rules-only wherever in the line it comes, as the word not to ask Claude, and never as the name of a file", () => {
    assert.deepEqual(parseArgs(["--rules-only", "--watch", "/in"]), { file: "", folders: ["/in"], out: "", rulesOnly: true, fromPlan: false, help: false });
    assert.deepEqual(parseArgs(["--watch", "/in", "--rules-only"]), { file: "", folders: ["/in"], out: "", rulesOnly: true, fromPlan: false, help: false });
    assert.deepEqual(parseArgs(["/in/a.mov", "--rules-only", "--out", "/out"]), { file: "/in/a.mov", folders: [], out: "/out", rulesOnly: true, fromPlan: false, help: false });
    // By itself it names nothing to work on.
    assert.deepEqual(parseArgs(["--rules-only"]), { file: "", folders: [], out: "", rulesOnly: true, fromPlan: false, help: true });
  });
  it("reads --from-plan wherever in the line it comes, and never as the name of a file", () => {
    assert.deepEqual(parseArgs(["--from-plan", "/in/a.mov"]), { file: "/in/a.mov", folders: [], out: "", rulesOnly: false, fromPlan: true, help: false });
    assert.deepEqual(parseArgs(["/in/a.mov", "--from-plan", "--out", "/out"]), { file: "/in/a.mov", folders: [], out: "/out", rulesOnly: false, fromPlan: true, help: false });
    // By itself it names nothing to work on.
    assert.deepEqual(parseArgs(["--from-plan"]), { file: "", folders: [], out: "", rulesOnly: false, fromPlan: true, help: true });
  });
});

describe("a run, once it knows what it was asked and what is on this Mac", () => {
  const NOT_ASKED = "Claude is not asked in this run (--rules-only): each cut plan is the rules' alone.";
  const NOT_THERE = "Claude Code is not installed, so Claude is not asked in this run: each cut plan is the rules' alone.";
  const FROM_PLAN = "Claude is not asked in this run (--from-plan), and no transcript is made: the videos are made again from the cut plan an earlier run wrote, as it is.";
  const asked = (over) => ({ file: "", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false, ...over });
  /** The lines of a log that say something of Claude. The line that names the folder is not one of them: the folder is made
      under the system's temp folder, and that folder's own path may have the word in it. */
  const ofClaude = (logs) => logs.filter((line) => !line.startsWith("Folder: ") && line.includes("Claude"));
  it("says once in the log that Claude is not asked, before anything else, however many videos it works on", async () => {
    const t = setup();
    t.video("a.mov");
    t.video("b.mov");
    assert.equal(await doAsked(asked({ folders: [t.dir], rulesOnly: true }), t.deps), 0);
    assert.equal(t.logs[0], NOT_ASKED);
    assert.deepEqual(ofClaude(t.logs), [NOT_ASKED]);
    assert.deepEqual(t.names(), ["2026-10-13", "2026-10-13-2"]);
    t.done();
  });
  it("says once in the log that Claude Code is not installed, when it is not and Claude would have been asked", async () => {
    const t = setup();
    t.deps.rulesOnly = false;
    t.video("a.mov");
    t.video("b.mov");
    assert.equal(await doAsked(asked({ folders: [t.dir] }), t.deps), 0);
    assert.equal(t.logs[0], NOT_THERE);
    assert.deepEqual(ofClaude(t.logs), [NOT_THERE]);
    // Each plan says so too, for the person who reads the plan and not the log.
    assert.equal(t.read("2026-10-13", "a.cut-plan.txt").split("\n")[0], "Claude Code is not installed, so this plan is the rules' alone.");
    assert.equal(t.read("2026-10-13-2", "b.cut-plan.txt").split("\n")[0], "Claude Code is not installed, so this plan is the rules' alone.");
    t.done();
    // Told to go by the rules alone, it says that, whether Claude Code is here or not.
    const both = setup();
    await doAsked(asked({ folders: [both.dir], rulesOnly: true }), { ...both.deps, rulesOnly: true });
    assert.deepEqual(ofClaude(both.logs), [NOT_ASKED]);
    both.done();
  });
  it("says nothing of the kind when Claude is asked", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    assert.equal(await doAsked(asked({ folders: [t.dir] }), t.deps), 0);
    assert.deepEqual(t.logs.filter((line) => line.includes("not asked") || line.includes("not installed")), []);
    assert.equal(t.asks.length, 1);
    t.done();
  });
  it("does one video where it is, or into the folder asked for, which it makes, and ends with 0 when everything was made", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    assert.equal(await doAsked(asked({ file }), t.deps), 0);
    assert.deepEqual(t.names(), [...WITH_NOTES, "reel-1.mp4", "reel-1.srt"].sort().map((ending) => "talk." + ending));
    const out = join(t.dir, "made", "here");
    assert.equal(await doAsked(asked({ file, out, rulesOnly: true }), { ...t.deps, rulesOnly: true }), 0);
    assert.deepEqual(readdirSync(out).sort(), ALL.filter((ending) => ending !== "mov").map((ending) => "talk." + ending));
    assert.equal(t.asks.length, 1);
    t.done();
  });
  it("makes the videos of one video again with --from-plan, where it is or in the folder asked for, asks Claude nothing, says so once, and ends with 0 when every one was made", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    assert.equal(await doAsked(asked({ file }), t.deps), 0);
    writeFileSync(join(t.dir, "talk.rough-cut.mp4"), "made before");
    t.logs.length = 0;
    assert.equal(await doAsked(asked({ file, fromPlan: true }), t.deps), 0);
    assert.equal(t.read("talk.rough-cut.mp4"), "the rough cut");
    assert.equal(t.asks.length, 1);
    assert.equal(t.logs[0], FROM_PLAN);
    assert.deepEqual(ofClaude(t.logs), [FROM_PLAN]);
    // With --out, the plan is read from that folder, where a run with --out wrote it, and the videos are written there.
    const out = join(t.dir, "made");
    assert.equal(await doAsked(asked({ file, out, rulesOnly: true }), { ...t.deps, rulesOnly: true }), 0);
    writeFileSync(join(out, "talk.rough-cut.mp4"), "made before");
    assert.equal(await doAsked(asked({ file, out, fromPlan: true }), t.deps), 0);
    assert.equal(readFileSync(join(out, "talk.rough-cut.mp4"), "utf8"), "the rough cut");
    t.done();
  });
  it("ends --from-plan with 1 when a video could not be made again, and with 2, having made nothing, when there is no such file or no plan", async () => {
    const t = setup({ rough: "fail" });
    const file = t.video("talk.mov");
    assert.equal(await doAsked(asked({ file, fromPlan: true }), t.deps), 2);
    assert.deepEqual(t.names(), ["talk.mov"]);
    // Nor is the folder asked for made, when the plan is not there.
    assert.equal(await doAsked(asked({ file, out: join(t.dir, "made"), fromPlan: true }), t.deps), 2);
    assert.deepEqual(t.names(), ["talk.mov"]);
    assert.equal(await doAsked(asked({ file, rulesOnly: true }), t.deps), 1);
    assert.equal(await doAsked(asked({ file, fromPlan: true }), t.deps), 1);
    const gone = join(t.dir, "not there.mov");
    assert.equal(await doAsked(asked({ file: gone, fromPlan: true }), t.deps), 2);
    assert.equal(t.logs[t.logs.length - 1], `There is no file at ${gone}.`);
    t.done();
  });
  it("never does --from-plan on a watched folder: it says so, ends with 2, and moves and makes nothing", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    for (const given of [asked({ folders: [t.dir], fromPlan: true }), asked({ file, folders: [t.dir], fromPlan: true })]) {
      t.logs.length = 0;
      assert.equal(await doAsked(given, t.deps), 2);
      assert.deepEqual(t.logs, ["--from-plan is for one video, named by its file, and never for a watched folder. Nothing was made."]);
      assert.deepEqual([t.calls, t.names()], [[], ["talk.mov"]]);
    }
    t.done();
  });
  it("ends with 1 when something of the one video could not be made, and with 2 when there is no such file", async () => {
    const t = setup({ rough: "fail" });
    assert.equal(await doAsked(asked({ file: t.video("talk.mov"), rulesOnly: true }), t.deps), 1);
    const gone = join(t.dir, "not there.mov");
    assert.equal(await doAsked(asked({ file: gone, rulesOnly: true }), t.deps), 2);
    assert.equal(t.logs[t.logs.length - 1], `There is no file at ${gone}.`);
    t.done();
  });
});

// On 2026-10-14 the tool wrote each file beside the video under its name with .writing after it, and renamed it when it was
// whole. In a folder in Dropbox, Dropbox undid two of those renames, of large videos it was still uploading: they stayed under
// their .writing names. So a file is now written in the run's own folder, which is on the same disk, and is moved into the
// folder it belongs in, under its own name, only once it is whole.
describe("where a run writes its files", () => {
  it("writes each file of one video in the run's own folder, and puts it beside the video only when it is whole, with one move under its own name, the plan last: nothing is renamed beside the video", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    const moves = movesOf(t);
    const seen = namesWhileWorking(t);
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    const placed = t.names().filter((n) => n !== "talk.mov");
    assert.deepEqual(placed, [...WITH_NOTES, "reel-1.mp4", "reel-1.srt"].filter((ending) => ending !== "mov").sort().map((ending) => "talk." + ending));
    assert.deepEqual(moves.map(([, to]) => basename(to)).sort(), placed);
    for (const [from, to] of moves) {
      assert.ok(from.startsWith(t.work + "/"), from);
      assert.deepEqual([dirname(to), basename(to)], [t.dir, basename(from)]);
    }
    assert.equal(moves[moves.length - 1][1], join(t.dir, "talk.cut-plan.json"));
    // While the programs work, nothing is beside the video under a name it does not keep.
    assert.deepEqual(seen.flat().filter((n) => !placed.includes(n) && n !== "talk.mov"), []);
    // ffmpeg writes every video in the run's own folder.
    const videos = t.calls.filter((c) => c.cmd === "FFMPEG" && c.args[c.args.length - 1].endsWith(".mp4")).map((c) => c.args[c.args.length - 1]);
    assert.deepEqual(videos.map((to) => [to.startsWith(t.work + "/"), basename(to)]), [[true, "talk.rough-cut.mp4"], [true, "talk.rough-cut.vertical.mp4"], [true, "talk.reel-1.mp4"]]);
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("writes its note that no transcript could be made in the run's own folder too, and puts it beside the video whole", async () => {
    const t = setup({ ffmpeg: "fail" });
    const moves = movesOf(t);
    await uneditedFile(t.video("bad.mov"), t.deps);
    assert.deepEqual(moves.map(([from, to]) => [from.startsWith(t.work + "/"), to]), [[true, join(t.dir, "bad.failed.txt")]]);
    assert.match(t.read("bad.failed.txt"), /^No transcript could be made from bad\.mov\./);
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("for a watched folder, keeps every file in the run's own folder until the video is filed, then moves the video and puts each file straight into the folder for the day: the video is the one file renamed in the watched folder", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    const moves = movesOf(t);
    const seen = namesWhileWorking(t);
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    // While the run works, nothing but the video is in the watched folder. A run cut short leaves nothing there.
    assert.deepEqual([...new Set(seen.map((names) => names.join(" ")))], ["a.mov"]);
    const day = join(t.dir, "2026-10-13");
    assert.deepEqual(moves[0], [join(t.dir, "a.mov"), join(day, "a.mov")]);
    for (const [from, to] of moves.slice(1)) {
      assert.ok(from.startsWith(t.work + "/"), from);
      assert.deepEqual([dirname(to), basename(to)], [day, basename(from)]);
    }
    assert.deepEqual(moves.map(([, to]) => basename(to)).sort(), t.inside("2026-10-13"));
    assert.deepEqual(t.names(), ["2026-10-13"]);
    t.done();
  });
  it("copies a file into place, under its own name, and deletes it from the run's own folder, when the two folders are on different disks, and the log says so", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    const copies = [];
    t.deps.move = (from, to) => {
      if (from.startsWith(t.work + "/")) throw otherDisk();
      renameSync(from, to);
    };
    t.deps.copy = (from, to) => {
      copies.push([from, to]);
      copyFileSync(from, to);
    };
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    assert.equal(t.read("talk.rough-cut.mp4"), "the rough cut");
    assert.deepEqual(copies.map(([, to]) => to).sort(), t.names().filter((n) => n !== "talk.mov").map((n) => join(t.dir, n)));
    assert.ok(copies.every(([from]) => from.startsWith(t.work + "/")));
    const said = t.logs.filter((line) => line.includes("another disk"));
    assert.equal(said.length, ALL.length - 1);
    assert.ok(said.includes(`talk.mov: talk.rough-cut.mp4 could not be moved from the run's own folder into ${t.dir}, which is on another disk, so it was copied there, and deleted from the run's folder.`), said.join("\n"));
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
    // The same for a watched folder: the video is moved into the folder for the day, and its files are copied in after it.
    const w = setup();
    w.video("a.mov");
    w.deps.move = (from, to) => {
      if (from.startsWith(w.work + "/")) throw otherDisk();
      renameSync(from, to);
    };
    const [filed] = await uneditedFolder(w.dir, w.deps);
    assert.deepEqual([filed.ok, filed.folder], [true, "2026-10-13"]);
    assert.deepEqual(w.inside("2026-10-13"), ALL.map((ending) => "a." + ending));
    assert.ok(w.logs.includes(`a.mov: a.cut-plan.json could not be moved from the run's own folder into ${join(w.dir, "2026-10-13")}, which is on another disk, so it was copied there, and deleted from the run's folder.`));
    w.done();
  });
  it("leaves nothing half copied under its name when a copy into place fails, and that file is not made", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    t.deps.move = (from, to) => {
      if (from.startsWith(t.work + "/")) throw otherDisk();
      renameSync(from, to);
    };
    t.deps.copy = (from, to) => {
      if (basename(to) !== "talk.rough-cut.mp4") return copyFileSync(from, to);
      writeFileSync(to, "half a copy");
      throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
    };
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [false, "the rough cut could not be made: the work stopped (ENOSPC)"]);
    assert.deepEqual(t.names(), ALL.filter((ending) => ending !== "rough-cut.mp4").map((ending) => "talk." + ending));
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("says plainly in the log when a file is not under its own name after it was moved into place, and that file is not made", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    // Something takes the rough cut away as soon as it is moved in.
    t.deps.move = (from, to) => {
      renameSync(from, to);
      if (basename(to) === "talk.rough-cut.mp4") rmSync(to);
    };
    const r = await uneditedFile(file, t.deps);
    const gone = "no file is there under its name after the move";
    assert.deepEqual([r.ok, r.message], [false, `the rough cut could not be made: the work stopped (${gone})`]);
    assert.ok(t.logs.includes(`talk.mov: talk.rough-cut.mp4 was moved into ${t.dir}, but there is no file of that name there now.`), t.logs.join("\n"));
    assert.equal(t.read("talk.cut-plan.txt").split("\n")[0], `The rough cut could not be made: the work stopped (${gone}).`);
    t.done();
    // The same for a video made again from its plan: the log says so, and that the one made before is gone.
    const p = setup();
    const video = p.video("talk.mov");
    await uneditedFile(video, p.deps);
    p.deps.move = (from, to) => {
      renameSync(from, to);
      if (basename(to) === "talk.rough-cut.mp4") rmSync(to);
    };
    const again = await videosFromPlan(video, p.deps);
    assert.deepEqual([again.ok, again.made, again.message], [false, ["talk.rough-cut.vertical.mp4"], `the rough cut could not be made again: the work stopped (${gone})`]);
    assert.ok(p.logs.includes(`talk.mov: talk.rough-cut.mp4 was moved into ${p.dir}, but there is no file of that name there now.`));
    assert.ok(p.logs.includes(`talk.mov: the rough cut could not be made again: the work stopped (${gone}).`));
    p.done();
  });
});

describe("what the tool says of itself", () => {
  const text = readFileSync(new URL("../unedited.js", import.meta.url), "utf8");
  /** The comment the file opens with, and its help, each as one line: where a line breaks is not what is said. */
  const first = text.slice(0, text.indexOf("\nimport ")).replace(/\n\/\/ */g, " ");
  const help = /\nconst HELP = `([\s\S]*?)`;/.exec(text)[1].replace(/\s+/g, " ");
  const LEAVES = "The video and its sound never leave this Mac. When Claude is asked, the words of the transcript with their times and the rules' plan are sent to Claude through Claude Code, on the Claude account signed in on this Mac. The video's file name and its length go with them.";
  it("says in its first lines what leaves this Mac and what never does, and no longer that nothing leaves it", () => {
    assert.doesNotMatch(text, /Nothing leaves the machine/);
    assert.ok(first.includes(LEAVES), first);
    assert.ok(first.includes(" --rules-only keeps everything on the Mac."), first);
  });
  it("says the same in its help, and names the option that keeps everything on the Mac", () => {
    assert.ok(help.includes(LEAVES), help);
    assert.ok(help.includes(" --rules-only never ask Claude: the plan is the rules' alone, there are no notes and no clips, and nothing leaves this Mac "), help);
  });
  it("names --from-plan in its first lines and in its help, as the way to make one video's videos again from its plan", () => {
    assert.ok(first.replace(/\s+/g, " ").includes(" --from-plan make the videos of one video again from the cut plan an earlier run wrote beside it: "), first);
    assert.ok(help.includes(" --from-plan make the videos of one video again from the cut plan an earlier run wrote beside it: "), help);
  });
  /** The whole file as one line, for what a comment further down says. */
  const whole = text.replace(/\s+/g, " ");
  it("says of what Claude Code is run with what that makes sure of: none of its own tools, and no tool server set up for the user", () => {
    assert.doesNotMatch(whole, /has no tools/);
    assert.ok(whole.includes(" has none of its own tools and no skills, saves no session, and reads no settings file, this user's or a project's. "));
    assert.ok(whole.includes(" --strict-mcp-config keeps out every tool server (MCP) that is set up for this user in Claude Code: "));
    assert.doesNotMatch(whole, /it is not among them/);
  });
  it("says what each call to Claude leaves in the home folder, and that nothing there is taken away from here", () => {
    assert.ok(whole.includes(" Claude Code keeps a folder of its own for every folder it is run in, under .claude/projects in the home folder, named after that folder's path. So each try leaves one there, "));
    assert.ok(whole.includes(" nothing under .claude is ever deleted from here. "));
  });
});

/** A test of the episode import: setup's folder and stand-ins, with this Mac's settings, BRIMM Video in the test's folder and
    this Mac's drop folder in it, a recording of two minutes, so that it makes an episode and not a short video, and a clone
    that copies and is listed in `clones`. `drop(name)` puts a video in the drop folder. Nothing is moved in an episode's
    import, so the stand-in for a move fails the test. */
function episodic(script = {}) {
  const t = setup({ probed: probed({ duration: "120.000000" }), ...script });
  const root = join(t.dir, "BRIMM Video");
  const drop = join(root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  const clones = [];
  t.deps.settings = { version: 1, machine: "Mac Studio", root, checkout: "/checkout" };
  // A status file is deleted by the next one, so what each held is kept as it was cloned in.
  t.deps.clone = (from, to) => {
    clones.push(to.includes("/.importing/") ? [from, to, readFileSync(from, "utf8")] : [from, to]);
    copyFileSync(from, to);
  };
  t.deps.commit = "abc1234";
  t.deps.now = () => new Date("2026-10-13T10:00:00");
  // A clock of the test's own, which each wait moves on, so that the wait for a late check takes no time; and a Mac kept
  // awake by nothing.
  let clock = Date.parse("2026-10-13T10:00:00");
  t.deps.clock = () => clock;
  t.deps.wait = async (ms) => {
    t.waits.push(ms);
    clock += ms;
  };
  t.deps.keepAwake = () => {};
  t.deps.move = (from) => assert.fail(`nothing is moved in an episode's import, and ${from} was`);
  const episodes = join(root, "Episodes");
  const put = (name, bytes = "video") => {
    writeFileSync(join(drop, name), bytes);
    return join(drop, name);
  };
  const within = (folder, ...path) => readdirSync(join(episodes, folder, ...path)).sort();
  /** The episodes' folders, without the folder of the import status files. */
  const folders = () => readdirSync(episodes).filter((n) => n !== ".importing").sort();
  /** The clones of the files of episodes, without those of the status files. */
  const filed = () => clones.filter(([, to]) => !to.includes("/.importing/"));
  return { ...t, root, drop, episodes, clones, put, within, folders, filed };
}

describe("an episode imported from this Mac's drop folder", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  /** The files an episode's folder holds at its top, of the rules' own: today's files of a video, less the Final Cut file,
      which is in edit/, and with the folders edit/ and record/. */
  const TOP = [...ALL.filter((ending) => ending !== "fcpxml").map((ending) => `Talk.${ending}`), "edit", "record"].sort();
  it("files the video and everything made of it into a new folder in Episodes, named for the day, the video and this Mac", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, FOLDER]);
    assert.deepEqual(t.folders(), [FOLDER]);
    assert.deepEqual(t.within(FOLDER), TOP);
    assert.deepEqual([t.within(FOLDER, "edit"), t.within(FOLDER, "record")], [["main.v0.fcpxml"], ["0001.json"]]);
    t.done();
  });
  it("puts every file into Dropbox by a clone, the raw video from the drop folder, the rest from the run's own folder, and the record last", async () => {
    const t = episodic();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const runs = join(t.home, "BRIMM Video Work", ".runs");
    const filed = t.filed();
    assert.deepEqual(filed[0], [join(t.drop, "Talk.mov"), join(t.episodes, FOLDER, "Talk.mov")]);
    assert.ok(filed.slice(1, -1).every(([from]) => from.startsWith(runs + "/")), "each made file comes from the run's own folder in BRIMM Video Work");
    assert.equal(filed[filed.length - 1][1], join(t.episodes, FOLDER, "record", "0001.json"));
    assert.equal(filed.length, TOP.length - 2 + 2);
    t.done();
  });
  it("writes a first record that lists every file with its size", async () => {
    const t = episodic();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const folder = join(t.episodes, FOLDER);
    const { record } = readEpisode(folder);
    assert.match(record.id, /^e-20261013-[0-9a-f]{6}$/);
    assert.deepEqual([record.rev, record.kind, record.writer, record.name, record.title, record.reels], [1, "episode", { commit: "abc1234", on: "Mac Studio" }, { text: "Talk", placeholder: true }, null, []]);
    assert.deepEqual(record.video, { file: "Talk.mov", bytes: 5, seconds: 120, recorded: "2026-10-13", recordedFrom: "import" });
    const sizes = Object.fromEntries([...TOP.filter((n) => n !== "edit" && n !== "record").map((n) => [n, statSync(join(folder, n)).size]), ["edit/main.v0.fcpxml", statSync(join(folder, "edit", "main.v0.fcpxml")).size]]);
    assert.deepEqual(record.files, sizes);
    t.done();
  });
  it("names the video in edit/main.v0.fcpxml by a path from the file, and names no library", async () => {
    const t = episodic();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const xml = readFileSync(join(t.episodes, FOLDER, "edit", "main.v0.fcpxml"), "utf8");
    assert.deepEqual(tags(xml, "media-rep").map((m) => m.src), ["../Talk.mov"]);
    assert.doesNotMatch(xml, /import-options/);
    t.done();
  });
  it("leaves the raw video in the drop folder, and the run's own folder in BRIMM Video Work/.runs, for the late check", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const seen = [];
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && !seen.length) {
        const runs = readdirSync(join(t.home, "BRIMM Video Work", ".runs"));
        seen.push(readdirSync(t.drop), runs.length, readdirSync(join(t.home, "BRIMM Video Work", ".runs", runs[0], "made")).includes("Talk.rough-cut.mp4"));
      }
      return wait(ms);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(seen, [["Talk.mov"], 1, true]);
    t.done();
  });
  it("takes the day the file says it was recorded when it says one", async () => {
    const t = episodic({ probed: JSON.stringify({ ...JSON.parse(probed({ duration: "120.000000" })), format: { format_name: "mov", start_time: "0.000000", duration: "120.000000", tags: { creation_time: "2026-10-01T15:00:00.000000Z" } } }) });
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const { video } = readEpisode(join(t.episodes, FOLDER)).record;
    assert.deepEqual([video.recorded, video.recordedFrom], [new Date("2026-10-01T15:00:00.000000Z").toLocaleDateString("en-CA"), "video"]);
    t.done();
  });
  it("makes a short or upright recording a short video: no upright version and no clips, and Claude's notes kept", async () => {
    for (const probedAs of [probed(), probed({ picture: { width: 1080, height: 1920 }, duration: "120.000000" })]) {
      const t = episodic({ probed: probedAs, claude: [answers(REPLY)] });
      t.put("Talk.mov");
      await uneditedFolder(t.drop, t.deps);
      const names = t.within(FOLDER);
      assert.ok(!names.includes("Talk.rough-cut.vertical.mp4") && !names.some((n) => n.includes(".reel-")), names.join(", "));
      assert.ok(names.includes("Talk.edit-notes.txt"));
      const { record } = readEpisode(join(t.episodes, FOLDER));
      assert.deepEqual([record.kind, record.reels], ["short video", []]);
      t.done();
    }
  });
  it("puts the clips Claude picked into the record as Reel candidates", async () => {
    const t = episodic({ claude: [answers(REPLY)] });
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const { record } = readEpisode(join(t.episodes, FOLDER));
    const plan = JSON.parse(readFileSync(join(t.episodes, FOLDER, "Talk.cut-plan.json"), "utf8"));
    const clip = plan.claude.clips[0];
    assert.deepEqual(record.reels, [{ n: 1, status: "candidate", from: clip.start, to: clip.end, title: clip.hook, why: clip.why, files: ["Talk.reel-1.mp4", "Talk.reel-1.srt"], pushed: [] }]);
    t.done();
  });
  it("says in the banner what to say to Claude next", async () => {
    const t = episodic();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.notes, ['Ready: Talk. In Claude, say "open Talk".']);
    t.done();
  });
  it("uses again the folder of an import that stopped before its record, and writes each file again", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const stopped = join(t.episodes, "2026-10-12 Talk (Mac Studio)");
    mkdirSync(join(stopped, "record"), { recursive: true });
    writeFileSync(join(stopped, "Talk.mov"), "video");
    writeFileSync(join(stopped, "Talk.srt"), "half of the captions");
    writeFileSync(join(stopped, "record", "0001.json"), "{");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder, t.folders()], [true, "2026-10-12 Talk (Mac Studio)", ["2026-10-12 Talk (Mac Studio)"]]);
    assert.equal(readFileSync(join(stopped, "Talk.srt"), "utf8"), SPELLED);
    assert.equal(readEpisode(stopped).record.rev, 1);
    t.done();
  });
  it("files into a dated folder as today when this Mac has no settings, or the folder is not its drop folder", async () => {
    for (const settings of [null, "another"]) {
      const t = setup();
      t.deps.settings = settings && { version: 1, machine: "Mac Studio", root: join(t.dir, "BRIMM Video"), checkout: "/checkout" };
      t.video("a.mov");
      const [r] = await uneditedFolder(t.dir, t.deps);
      assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
      assert.deepEqual(t.inside("2026-10-13"), ALL.map((ending) => "a." + ending));
      assert.ok(!existsSync(join(t.dir, "BRIMM Video")));
      t.done();
    }
  });
  it("says why, keeps the video in the drop folder, and writes no record, when a file cannot be put into Episodes", async () => {
    const t = episodic();
    t.put("Talk.mov");
    t.deps.clone = (from, to) => {
      if (to.endsWith(".rough-cut.mp4")) throw new Error("cloning is not possible there");
      copyFileSync(from, to);
    };
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.equal(r.ok, false);
    assert.match(r.message, /^it could not be filed into Episodes: Talk\.rough-cut\.mp4 could not be put into .*: cloning is not possible there\. Nothing was copied$/);
    assert.deepEqual([readdirSync(t.drop), readEpisode(join(t.episodes, FOLDER)).code], [["Talk.mov"], "NONE"]);
    assert.deepEqual(t.notes, ["Talk.mov could not be put into Episodes. It stays in the drop folder; see the log."]);
    assert.ok(!existsSync(join(t.home, "BRIMM Video Work", ".runs")) || readdirSync(join(t.home, "BRIMM Video Work", ".runs")).length === 0);
    t.done();
  });
});

describe("the status of an episode's import, and a video never imported twice", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  /** The status files the run wrote, in order, as they were when each was put into Dropbox. */
  const statuses = (t) => t.clones.filter(([, to]) => to.includes("/.importing/")).map(([, to, text]) => ({ name: basename(to), ...JSON.parse(text) }));
  /** A status as another run would have left it, put in by hand. */
  const leave = (t, status, n = 1) => {
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${status.video} (${status.machine}) ${n}.json`), JSON.stringify({ version: 1, pid: 99999999, bytes: 5, seconds: 120, step: "Making the rough cut", at: new Date().toISOString(), ...status }));
  };
  it("writes a status file at the start, at each step, and once a minute while a step runs", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const ticks = [];
    t.deps.every = (fn) => ticks.push(fn);
    t.deps.cancel = () => {};
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") ticks[0]();
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.drop, t.deps);
    const written = statuses(t);
    assert.deepEqual(written.slice(0, 3).map((s) => s.step), ["Waiting to start", "Reading the sound", "Reading the sound"]);
    const filing = written.findIndex((s) => s.step === "Filing");
    assert.ok(filing > 2 && written.slice(filing + 1).every((s) => s.step === "Waiting for its late check"), written.map((s) => s.step).join(", "));
    assert.ok(written.every((s, i) => s.name === `Talk.mov (Mac Studio) ${i + 1}.json` && s.machine === "Mac Studio" && s.pid === process.pid && s.bytes === 5));
    assert.equal(written[filing].seconds, 120);
    // Once the late check has passed, the status is taken away.
    assert.deepEqual(readdirSync(join(t.episodes, ".importing")), []);
    t.done();
  });
  it("writes why the import failed into its status, and leaves it, and the video in the drop folder", async () => {
    const t = episodic({ whisper: "fail" });
    t.put("Talk.mov");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.equal(r.ok, false);
    const [last] = statuses(t).slice(-1);
    assert.equal(last.failed, "the transcriber stopped (error: failed to initialize whisper context)");
    assert.deepEqual([readdirSync(t.drop), readdirSync(t.episodes)], [["Talk.mov"], [".importing"]]);
    t.done();
  });
  it("does not import a video an episode already holds, and leaves it in the drop folder", async () => {
    const t = episodic();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const calls = t.calls.length;
    t.logs.length = 0;
    // The same video dropped again, after its late check took the first one away.
    t.put("Talk.mov");
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([results.map((r) => r.ok), t.calls.length], [[true], calls]);
    assert.ok(t.logs.includes(`Talk.mov: already imported as ${FOLDER}. It stays in the drop folder until its late check passes, or for a person to delete.`), t.logs.join("\n"));
    assert.deepEqual(t.folders(), [FOLDER]);
    t.done();
  });
  it("does not import a video another Mac's fresh status file holds", async () => {
    const t = episodic();
    t.put("Talk.mov");
    leave(t, { machine: "Sallie's laptop", video: "Talk.mov" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.calls, []);
    assert.ok(t.logs.includes("Talk.mov: it is being imported on Sallie's laptop."), t.logs.join("\n"));
    t.done();
  });
  it("does not import a video whose import failed until someone says to try it again", async () => {
    const t = episodic();
    t.put("Talk.mov");
    leave(t, { machine: "Mac Studio", video: "Talk.mov", failed: "the transcriber stopped" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.calls, []);
    assert.ok(t.logs.includes(`Talk.mov: its import failed on Mac Studio: the transcriber stopped. Say "try it again" to import it again.`), t.logs.join("\n"));
    rmSync(join(t.episodes, ".importing"), { recursive: true, force: true });
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, FOLDER]);
    t.done();
  });
  it("removes the status a stopped run of this Mac left, and imports the video again into the folder it made", async () => {
    const t = episodic();
    t.put("Talk.mov");
    leave(t, { machine: "Mac Studio", video: "Talk.mov", pid: 99999999, at: new Date(Date.now() - 60000).toISOString() });
    mkdirSync(join(t.episodes, "2026-10-12 Talk (Mac Studio)"));
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-12 Talk (Mac Studio)"]);
    assert.ok(t.logs.includes("Talk.mov: an import of it on this Mac stopped before it was done, so it is imported again."), t.logs.join("\n"));
    assert.deepEqual(readdirSync(join(t.episodes, ".importing")), []);
    t.done();
  });
});

describe("the late check of an episode's import", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const runs = (t) => join(t.home, "BRIMM Video Work", ".runs");
  const pendings = (t) => {
    const folder = join(t.home, "Library", "Application Support", "BRIMM Video", "pending");
    return existsSync(folder) ? readdirSync(folder).map((n) => JSON.parse(readFileSync(join(folder, n), "utf8"))) : [];
  };
  /** An episode's import on a clock of its own, which a wait moves on. `hooks` is called at each wait with how long it is and
      the time since the run began, before the clock moves. `awake` lists each process the Mac is kept awake for. */
  function timed(script = {}) {
    const t = episodic(script);
    const start = Date.parse("2026-10-13T10:00:00");
    let now = start;
    t.awake = [];
    t.hooks = [];
    t.deps.clock = () => now;
    t.deps.wait = async (ms) => {
      for (const hook of t.hooks) await hook(ms, now - start);
      t.waits.push(ms);
      now += ms;
    };
    t.deps.keepAwake = (pid) => t.awake.push(pid);
    t.later = (ms) => {
      now += ms;
    };
    t.waited = () => t.waits.filter((ms) => ms > 5000).reduce((sum, ms) => sum + ms, 0);
    return t;
  }
  it("waits 15 minutes after the last copy, then checks, and only then deletes the raw video and the run's own folder", async () => {
    const t = timed();
    t.put("Talk.mov");
    t.hooks.push(() => assert.ok(existsSync(join(t.drop, "Talk.mov")), "the raw video stays until the late check"));
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.equal(r.ok, true);
    assert.ok(t.waited() >= 900000 && t.waited() < 900000 + 60000, String(t.waited()));
    assert.deepEqual([readdirSync(t.drop), readdirSync(runs(t)), pendings(t), readdirSync(join(t.episodes, ".importing"))], [[], [], [], []]);
    assert.deepEqual(t.awake, [process.pid]);
    assert.ok(t.logs.includes(`Talk.mov: the late check passed: every file of "${FOLDER}" is whole in Dropbox. The video is taken out of the drop folder.`), t.logs.join("\n"));
    t.done();
  });
  it("copies a file in again when Dropbox has taken it away before the late check", async () => {
    const t = timed();
    t.put("Talk.mov");
    const rough = join(t.episodes, FOLDER, "Talk.rough-cut.mp4");
    t.hooks.push((ms) => {
      if (ms === 60000 && existsSync(rough)) rmSync(rough);
    });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([readFileSync(rough, "utf8"), readdirSync(t.drop)], ["the rough cut", []]);
    assert.ok(t.logs.some((line) => line.startsWith("Talk.rough-cut.mp4 is not whole in ") && line.endsWith("at the late check (it is not there), so it is copied in again from its work copy.")), t.logs.join("\n"));
    t.done();
  });
  it("keeps the raw video, says so in the status file, the cut plan's first lines and a banner, and never imports it twice, when a file is still wrong", async () => {
    const t = timed();
    t.put("Talk.mov");
    const rough = join(t.episodes, FOLDER, "Talk.rough-cut.mp4");
    let filed = false;
    const clone = t.deps.clone;
    t.deps.clone = (from, to) => {
      if (filed && to === rough) return writeFileSync(to, "the rou");
      return clone(from, to);
    };
    t.hooks.push((ms) => {
      if (ms === 60000 && !filed) {
        filed = true;
        writeFileSync(rough, "the rou");
      }
    });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(readdirSync(t.drop), ["Talk.mov"]);
    const [status] = readdirSync(join(t.episodes, ".importing")).map((n) => JSON.parse(readFileSync(join(t.episodes, ".importing", n), "utf8")));
    assert.match(status.problem, /^Talk\.rough-cut\.mp4 could not be put into .*: it is 7 bytes there, not 13\. Nothing was copied\.$/);
    const plan = readFileSync(join(t.episodes, FOLDER, "Talk.cut-plan.txt"), "utf8");
    assert.ok(plan.startsWith(`Dropbox lost a file of this episode after it was copied in, and it could not be put back: ${status.problem}\n`), plan.slice(0, 200));
    const { record } = readEpisode(join(t.episodes, FOLDER));
    assert.deepEqual([record.rev, record.files["Talk.cut-plan.txt"]], [2, Buffer.byteLength(plan)]);
    assert.deepEqual(t.notes, ['Ready: Talk. In Claude, say "open Talk".', "Dropbox lost a file of Talk. The video stays in the drop folder; see the log."]);
    const calls = t.calls.length;
    t.logs.length = 0;
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.calls.length, calls);
    assert.ok(t.logs.some((line) => line.startsWith("Talk.mov: copied in, but the late check found a problem: ")), t.logs.join("\n"));
    t.done();
  });
  it("imports a video that arrives while it waits for a late check, and checks both", async () => {
    const t = timed();
    t.put("Talk.mov");
    let waits = 0;
    t.hooks.push((ms) => {
      if (ms === 60000 && ++waits === 3) t.put("Other.mov", "other");
    });
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(results.map((r) => [r.ok, r.folder]), [[true, FOLDER], [true, "2026-10-13 Other (Mac Studio)"]]);
    assert.deepEqual([t.folders(), readdirSync(t.drop), pendings(t)], [["2026-10-13 Other (Mac Studio)", FOLDER], [], []]);
    t.done();
  });
  it("leaves a stopped run's late check, with its work copies in BRIMM Video Work/.runs, for this Mac's next run, which does it first", async () => {
    const t = timed();
    t.put("Talk.mov");
    t.hooks.push((ms) => {
      if (ms === 60000) throw new Error("the run was stopped");
    });
    await uneditedFolders([t.drop], t.deps);
    const [pending] = pendings(t);
    assert.ok(pending.work.startsWith(runs(t) + "/") && existsSync(join(pending.work, "made", "Talk.rough-cut.mp4")), pending.work);
    assert.deepEqual(readdirSync(t.drop), ["Talk.mov"]);
    t.hooks.length = 0;
    t.later(20 * 60000);
    t.waits.length = 0;
    t.logs.length = 0;
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.waited(), 0);
    assert.ok(t.logs[0].endsWith("The video is taken out of the drop folder."), t.logs.join("\n"));
    assert.deepEqual([readdirSync(t.drop), pendings(t), readdirSync(runs(t))], [[], [], []]);
    t.done();
  });
  it("waits for a stopped run's late check that is not yet due, and then makes it", async () => {
    const t = timed();
    t.put("Talk.mov");
    t.hooks.push((ms) => {
      if (ms === 60000) throw new Error("the run was stopped");
    });
    await uneditedFolders([t.drop], t.deps);
    t.hooks.length = 0;
    t.later(5 * 60000);
    t.waits.length = 0;
    await uneditedFolder(t.drop, t.deps);
    assert.ok(t.waited() >= 600000 - 60000 && t.waited() <= 600000, String(t.waited()));
    assert.deepEqual([readdirSync(t.drop), pendings(t)], [[], []]);
    t.done();
  });
  it("shows the Ready banner and ends the panel's bar at filing, waits quietly, and says in the log when the check is due", async () => {
    const t = timed();
    t.put("Talk.mov");
    const told = [];
    t.deps.progress = { ...noProgress, end: () => told.push("end"), begin: () => told.push("begin") };
    t.hooks.push((ms) => {
      if (ms === 60000) told.push(`wait, with ${t.notes.length} banner`);
    });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(told.slice(0, 3), ["begin", "end", "wait, with 1 banner"]);
    assert.ok(told.slice(2).every((x) => x === "wait, with 1 banner"));
    assert.deepEqual(t.notes, ['Ready: Talk. In Claude, say "open Talk".']);
    assert.ok(t.logs.includes("Talk.mov: copied into Dropbox. Its late check is due at 10:15."), t.logs.join("\n"));
    t.done();
  });
  it("tells the other Mac it is waiting for the late check, in the status file, once a minute", async () => {
    const t = timed();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    const steps = t.clones.filter(([, to]) => to.includes("/.importing/")).map(([, , text]) => JSON.parse(text).step);
    assert.ok(steps.filter((s) => s === "Waiting for its late check").length >= 14, steps.join(", "));
    t.done();
  });
});
