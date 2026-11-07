// The unedited-video workflow end to end, in a folder made for the test, with stand-ins for ffprobe, ffmpeg, the transcriber,
// the face finder and Claude Code. The stand-ins write the files and print the lines the real programs do, for the made-up
// recording in fixtures.js. None of the real programs is run here, and neither is Final Cut Pro. Claude is never asked
// anything from here: what it would say is written down in each test.
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { uneditedFile, uneditedFolder, uneditedFolders, doAsked, findPrograms, depsFor, parseArgs, CLAUDE_MODEL, checkClaude, importHold, importHolds, clockAt, askOnce } from "../unedited.js";
import { lockFile, runProgram } from "../run.js";
import { stampedText, whisperArgs } from "../lib.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, keptSpans, roughCaptions, roughRate } from "../cuts.js";
import { readNotes, applyDecisions, clipRanges, pausesOfPlan } from "../notes.js";
import { probed, told, TOLD, SRT, PAUSES } from "./fixtures.js";
import { progressFolder, noProgress } from "../progress.js";
import { seenFile, writeSettings, pendingFolder, importingFolderOf, statusFoldersOf, episodeFilesFolder } from "../settings.js";
import { readEpisode, writeEpisode } from "../episode.js";
import { dropIdOf, fileId, importIdOf, noteSeen, writePending } from "../filing.js";
import { readStatusesIn, removeStatusIn, writeStatusIn } from "../importing.js";
import { importingFolder } from "../settings.js";
import { fingerprintOf } from "../versions.js";
import { zoomTimeOf } from "../kinds.js";

const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0, device: { make: "", model: "" } };
/** Where ffmpeg heard silence in the made-up recording. */
const HEARD = pausesOf(PAUSES);
/** What the rules make of the made-up recording. The rules have tests of their own: here it is what the files must hold. */
const PLAN = cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: FACTS.duration, pauses: HEARD });
const SPELLED = SRT.replace("Sally", "Sallie");
const ALL = ["cut-plan.json", "cut-plan.txt", "mov", "rough-cut.srt", "rough-cut.transcript.txt", "srt", "transcript.txt", "words.json"];
const after = (args, flag) => args[args.indexOf(flag) + 1];
/** A face box whose middle is `centre` of the way across the picture, as the face finder prints one. */
const face = (centre) => ({ x: centre - 0.05, y: 0.2, w: 0.1, h: 0.2 });
/** A reply as Claude is asked to write it, for the made-up recording: a phrase to cut that the rules kept, its notes, a graphic
    cue (words on screen over "know your costs"), and one clip. */
const REPLY = {
  decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }],
  notes: "A short talk about pricing.\nThe opening is said twice, and the second telling is the one to use.",
  graphicCues: [{ id: "p7", words: "know your costs", kind: "words", show: 'The words "Know your costs" on screen.', seconds: 3 }],
  clips: [{ from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }]
};
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
      // A part of a Reel candidate's preview, or the preview the parts are joined into, is known by the name it is written under
      // in the run's folder: "reel-1.part-1.mov", "reel-1.mp4". `script.previews` says which preview ffmpeg cannot make, by the
      // candidate's number: { 2: "fail" }, or "stopped" for one the watchdog stops (see runGuarded below).
      const preview = /\/reel-(\d+)(?:\.part-\d+\.mov|\.mp4)$/.exec(args[args.length - 1]);
      if (preview) {
        if ((script.previews || {})[preview[1]] === "fail") {
          writeFileSync(args[args.length - 1], "half a preview");
          return { code: 1, stderr: "Error while filtering: Cannot allocate memory\n" };
        }
        writeFileSync(args[args.length - 1], `preview ${preview[1]}`);
        return { code: 0, stderr: "" };
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
  // What runs under the watchdog (guard.js), as the real runGuarded resolves it: each call is kept with the limits it was given.
  // A preview `script.previews` says is "stopped" is stopped by the watchdog, as for its memory.
  const guarded = [];
  const runGuarded = async (cmd, args, limits) => {
    // As the watchdog itself does (guard.js): it never runs a program without both a memory cap and a time limit.
    if (!(limits && limits.most > 0 && limits.limit > 0)) throw new Error("A guarded program needs a memory cap and a time limit.");
    guarded.push({ cmd, args, limits });
    const preview = /\/reel-(\d+)(?:\.part-\d+\.mov|\.mp4)$/.exec(args[args.length - 1]);
    if (preview && (script.previews || {})[preview[1]] === "stopped") return { code: null, signal: "SIGKILL", stderr: "", overMemory: true, outOfTime: false, peak: 2200 * 1024 * 1024, stopped: "it took more than 2 GB of memory, so it was stopped" };
    const r = await run(cmd, args);
    return { ...r, overMemory: false, outOfTime: false, peak: 0, stopped: "" };
  };
  const logs = [];
  const locks = join(dir, "locks");
  mkdirSync(locks);
  // The home folder is not made here: the tool makes what it needs in it.
  const home = join(dir, "home");
  const deps = {
    run, runGuarded, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "SWIFT", claude: script.claude ? "CLAUDE" : "" }, model: "/models/model.bin", tmpDir: work, lockDir: locks, home, today: () => "2026-10-13",
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
  return { dir, work, locks, home, logs, calls, guarded, notes, waits, asks, deps, video, names, inside, read, done: () => rmSync(dir, { recursive: true, force: true }) };
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
  it("gets a transcript, its words, a cut plan and the rough cut's captions beside it, and nothing is left behind", async () => {
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
  it("keeps the pauses ffmpeg heard in the cut plan, as the rules were given them, for a reading made later", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    const plan = JSON.parse(t.read("talk.cut-plan.json"));
    assert.deepEqual(plan.pauses, [[0, 1.111], [2.788, 3.695], [4.843, 6.07], [9.638, 12.459], [13.06, 13.583], [16.33, 17.246], [19.022, 19.414], [21.097, 23.423]]);
    assert.deepEqual(pausesOfPlan(plan), HEARD);
    // The plan is the rules' plan, whichever way it is changed after.
    assert.deepEqual(Object.keys(plan).filter((key) => !["pauses", "by"].includes(key)), ["version", "video", "facts", "phrases", "ranges", "kept", "cut"]);
    t.done();
  });
  it("keeps no pause for a recording ffmpeg heard none in", async () => {
    const t = setup({ pauses: "" });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).pauses, []);
    t.done();
  });
  it("ends a pause that never ends where the video ends, since a time with no end cannot be written in the plan's JSON", async () => {
    const t = setup({
      probed: probed({ duration: "110.000000" }),
      srt: "1\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n\n",
      told: told([[105000, 106740, [[" Hey", 10530], [",", 10540], [" Charlie", 10580], [",", 10585], [" how", 10610], [" are", 10630], [" you", 10660], ["?", 10670]]]]),
      pauses: "[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 104.9 | silence_duration: 104.9\n[silencedetect @ 0x1] silence_start: 106.7\n"
    });
    await uneditedFile(t.video("call.mp4"), t.deps);
    const plan = JSON.parse(t.read("call.cut-plan.json"));
    assert.deepEqual(plan.pauses, [[0, 104.9], [106.7, 110]]);
    // The plan's ranges are what the end of that pause is: the silence after the last words, to the end of the video.
    assert.deepEqual(plan.ranges.map((x) => [x.start, x.end, x.keep]), [[0, 104.7, false], [104.7, 106.9, true], [106.9, 110, false]]);
    t.done();
  });
  it("gives a reading made later, on the plan as it is read back from its file, the pauses the import used: Claude keeping what the rules cut gets the same ranges", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    const back = JSON.parse(t.read("talk.cut-plan.json"));
    // Claude keeps every phrase the rules cut: the silence beside each is then kept or cut by where ffmpeg heard it.
    const decisions = PLAN.phrases.filter((p) => !p.keep).map((p) => ({ id: p.id, keep: true, why: "She means it." }));
    const at = applyDecisions(PLAN, decisions, HEARD);
    const later = applyDecisions(back, decisions, pausesOfPlan(back));
    assert.deepEqual(later.plan.ranges, at.plan.ranges);
    assert.deepEqual(later.plan.changes, at.plan.changes);
    assert.deepEqual([later.plan.kept, later.plan.cut], [at.plan.kept, at.plan.cut]);
    // With none given, whole silences are kept beside the phrases Claude keeps.
    assert.notDeepEqual(applyDecisions(back, decisions, []).plan.ranges, at.plan.ranges);
    t.done();
  });
  it("gets the cut plan twice: to work from, and to read", async () => {
    const t = setup();
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")), { version: 1, video: "talk.mov", facts: FACTS, phrases: PLAN.phrases, ranges: PLAN.ranges, kept: 11.882, cut: 11.541, pauses: HEARD, by: "rules" });
    assert.deepEqual(Object.keys(JSON.parse(t.read("talk.cut-plan.json"))), ["version", "video", "facts", "phrases", "ranges", "kept", "cut", "pauses", "by"]);
    assert.equal(t.read("talk.cut-plan.txt"), planText(PLAN, "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it."));
    assert.deepEqual(t.read("talk.cut-plan.txt").split("\n").slice(2, 4), ["Kept 0:12 of 0:23. Cut 0:11.", "0:00 to 0:03  CUT  retake: said again at 0:06, the later one is kept  |  Welcome to the show. Today we are..."]);
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
    // The rough cut starts at 5.866667, the nearest whole picture to 5.87, and its first words 0.203 seconds later.
    assert.equal(t.read("talk.rough-cut.srt"), roughCaptions(PLAN.phrases, keptSpans(PLAN.ranges, "30")));
    assert.match(t.read("talk.rough-cut.srt"), /^1\n00:00:00,203 --> 00:00:01,173\nWelcome to the show\.\n/);
    t.done();
  });
  it("has each program do its part once, in order, and all of them work from the same sound", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const [probe, sound, words, silence, pauses] = t.calls;
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE", "FFMPEG", "WHISPER", "FFMPEG", "FFMPEG"]);
    assert.deepEqual([probe.args[probe.args.length - 1], after(probe.args, "-print_format")], [file, "json"]);
    assert.ok(after(probe.args, "-o").startsWith(t.work));
    assert.equal(after(sound.args, "-i"), file);
    const wav = sound.args[sound.args.length - 1];
    assert.deepEqual([after(words.args, "-f"), after(words.args, "-m"), after(words.args, "-dtw")], [wav, "/models/model.bin", "large.v3.turbo"]);
    assert.ok(words.args.includes("-osrt") && words.args.includes("-ojf") && words.args.includes("-nfa"));
    assert.deepEqual([after(silence.args, "-i"), after(silence.args, "-af")], [wav, "silencedetect=noise=-45dB:d=5"]);
    // The pauses are looked for to the end of the recording, which is 23.423 seconds long.
    assert.deepEqual([after(pauses.args, "-i"), after(pauses.args, "-af")], [wav, "apad=whole_dur=23.423,silencedetect=noise=-35dB:d=0.3"]);
    // And no more: no rough cut, no faces, no upright version.
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
    const r = await uneditedFile(t.video("talk.mov"), { ...t.deps, isWhole: () => looks.shift(), bringDown: async () => {} });
    assert.equal(r.ok, true);
    assert.deepEqual([t.waits.slice(0, 3), looks], [[5000, 5000, 5000], []]);
    t.done();
  });
  it("leaves a placeholder for the next time after as many looks as a growing file, and makes nothing", async () => {
    const t = setup({ sizes: Array.from({ length: 500 }, () => 7) });
    const brought = [];
    const r = await uneditedFile(t.video("huge.mov"), { ...t.deps, isWhole: () => false, bringDown: async (path) => brought.push(path) });
    assert.deepEqual([r.ok, r.arriving], [false, true]);
    assert.deepEqual([t.names(), t.calls, brought.length], [["huge.mov"], [], 1]);
    assert.deepEqual(t.logs, ["huge.mov: Dropbox has not brought it down to this Mac yet, so it is asked for.", "huge.mov: still arriving. It is taken the next time the folder changes."]);
    t.done();
  });
  it("imports a sound file with no picture lightly: its transcript, words, plan and the rough cut's captions, and no video", async () => {
    const t = setup({ probed: probed({ picture: null }) });
    const r = await uneditedFile(t.video("voice.m4a"), t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    assert.deepEqual(t.names(), ["voice.cut-plan.json", "voice.cut-plan.txt", "voice.m4a", "voice.rough-cut.srt", "voice.rough-cut.transcript.txt", "voice.srt", "voice.transcript.txt", "voice.words.json"]);
    assert.ok(!t.calls.some((c) => c.args.includes("-vf") || c.args.includes("-filter_complex") || c.cmd === "SWIFT"));
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
  it("stops the run with the error, and writes no plan, when a file the import writes cannot be written: the video is done again the next time", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    // The rough cut's captions cannot be written: something else is where they are written to.
    taken(t, "talk.rough-cut.srt");
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [false, "EISDIR"]);
    assert.ok(!existsSync(join(t.dir, "talk.failed.txt")));
    assert.ok(!existsSync(join(t.dir, "talk.cut-plan.json")));
    t.done();
  });
  it("does not keep a plan or the files an earlier run made, when this run could not make a plan", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    for (const ending of ["rough-cut.mp4", "rough-cut.vertical.mp4", "fcpxml", "edit-notes.txt", "reel-1.mp4"]) writeFileSync(join(t.dir, "talk." + ending), "an earlier run");
    await uneditedFile(file, t.deps);
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    const third = setup({ told: null });
    await uneditedFile(file, { ...third.deps, tmpDir: t.work });
    assert.deepEqual(t.names(), ["talk.cut-plan.txt", "talk.mov", "talk.srt", "talk.transcript.txt"]);
    for (const made of [t, third]) made.done();
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
  it("has the files of each video filed with it, and the video is not taken again", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.deepEqual(t.inside("2026-10-13"), ALL.map((ending) => "a." + ending));
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
    assert.equal(t.asks.length, 0);
    t.done();
  });
  it("has the video moved first, then the files the rules make, and the plan last", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.video("a.mov");
    const order = [];
    t.deps.move = (from, to) => {
      order.push(basename(from));
      renameSync(from, to);
    };
    await uneditedFolder(t.dir, t.deps);
    assert.equal(order[0], "a.mov");
    assert.deepEqual(order.slice(-3), ["a.rough-cut.srt", "a.rough-cut.transcript.txt", "a.cut-plan.json"]);
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
    assert.equal(t.calls.length, 10);
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
    assert.equal(t.calls.length, 5);
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
    assert.equal(t.calls.length, 5);
    t.done();
  });
  it("puts in the watched folder the files that could not be put in the folder for the day, and says which they are", async () => {
    const t = setup();
    t.video("a.mov");
    fullAfterThree(t);
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, ""]);
    assert.deepEqual(t.inside("2026-10-13"), ["a.mov", "a.srt", "a.transcript.txt"]);
    const rest = ["a.words.json", "a.cut-plan.txt", "a.rough-cut.srt", "a.rough-cut.transcript.txt", "a.cut-plan.json"];
    assert.deepEqual(t.names(), ["2026-10-13", ...rest].sort());
    assert.equal(t.logs[t.logs.length - 1], `a.mov: moved into "2026-10-13", but not all of its files could be put there (EPERM). Put in the watched folder instead: ${rest.join(", ")}.`);
    assert.deepEqual(await uneditedFolder(t.dir, t.deps), []);
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
  const LIGHT_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Filing"];
  const ALONE = LIGHT_STEPS.slice(0, -1);
  it("is told each step of a video as it begins, the steps to come, the video's length, and the end", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(told[0], ["begin", "talk.mov"]);
    assert.deepEqual(told[told.length - 1], ["end", true]);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript", "Making the cut plan"]);
    assert.deepEqual(told.find(([what]) => what === "length"), ["length", 23.423]);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [ALONE, ALONE]);
    t.done();
  });
  it("is told the same steps of a video upright already, and of filing it in a folder", async () => {
    const t = setup({ probed: probed({ picture: { width: 1080, height: 1920 } }) });
    const told = watching(t);
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [LIGHT_STEPS, LIGHT_STEPS]);
    assert.deepEqual(steps(told), LIGHT_STEPS);
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
  it("is told at the end that the work did not finish when no plan could be made, so its steps are not measured", async () => {
    const t = setup({ told: null });
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
    const b = setup({ told: null });
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
  it("gives a run from the command line the home folder HOME names, and the Mac's own when HOME names none; and the word that the import is light, whatever the settings say", () => {
    const programs = found(["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL, "/usr/bin/swift"], "/usr/bin");
    const log = () => {};
    const deps = depsFor(programs, log, { HOME });
    assert.deepEqual(Object.keys(deps).sort(), ["home", "log", "model", "notify", "progress", "run", "settings", "tools", "wait"]);
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
  it("still reads --from-plan wherever in the line it comes, and never as the name of a file, so that the run can say it is gone", () => {
    assert.deepEqual(parseArgs(["--from-plan", "/in/a.mov"]), { file: "/in/a.mov", folders: [], out: "", rulesOnly: false, fromPlan: true, help: false });
    assert.deepEqual(parseArgs(["/in/a.mov", "--from-plan", "--out", "/out"]), { file: "/in/a.mov", folders: [], out: "/out", rulesOnly: false, fromPlan: true, help: false });
    // By itself it is not the help: the run says that it is gone.
    assert.deepEqual(parseArgs(["--from-plan"]), { file: "", folders: [], out: "", rulesOnly: false, fromPlan: true, help: false });
  });
});

describe("a run, once it knows what it was asked and what is on this Mac", () => {
  const asked = (over) => ({ file: "", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false, ...over });
  /** The lines of a log that say something of Claude. The line that names the folder is not one of them: the folder is made
      under the system's temp folder, and that folder's own path may have the word in it. */
  const ofClaude = (logs) => logs.filter((line) => !line.startsWith("Folder: ") && line.includes("Claude"));
  it("says nothing of Claude in its log, whether it was told to go by the rules alone or Claude Code is on this Mac or not: Claude is never asked", async () => {
    for (const [script, rulesOnly] of [[{}, true], [{}, false], [{ claude: [answers(REPLY)] }, false]]) {
      const t = setup(script);
      t.deps.rulesOnly = rulesOnly;
      t.video("a.mov");
      t.video("b.mov");
      assert.equal(await doAsked(asked({ folders: [t.dir], rulesOnly }), t.deps), 0);
      assert.deepEqual(ofClaude(t.logs), []);
      assert.deepEqual(t.names(), ["2026-10-13", "2026-10-13-2"]);
      assert.deepEqual(t.asks, []);
      t.done();
    }
  });
  it("does one video where it is, or into the folder asked for, and ends with 0 when everything was made", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    assert.equal(await doAsked(asked({ file }), t.deps), 0);
    assert.deepEqual(t.names(), ALL.map((ending) => "talk." + ending));
    const out = join(t.dir, "made", "here");
    assert.equal(await doAsked(asked({ file, out, rulesOnly: true }), { ...t.deps, rulesOnly: true }), 0);
    assert.deepEqual(readdirSync(out).sort(), ALL.filter((ending) => ending !== "mov").map((ending) => "talk." + ending));
    assert.equal(t.asks.length, 0);
    t.done();
  });
  it("ends with 1 when something of the one video could not be made, and with 2 when there is no such file", async () => {
    const t = setup({ told: null });
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
    const t = setup();
    const file = t.video("talk.mov");
    const moves = movesOf(t);
    const seen = namesWhileWorking(t);
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [true, ""]);
    const placed = t.names().filter((n) => n !== "talk.mov");
    assert.deepEqual(placed, ALL.filter((ending) => ending !== "mov").map((ending) => "talk." + ending));
    assert.deepEqual(moves.map(([, to]) => basename(to)).sort(), placed);
    for (const [from, to] of moves) {
      assert.ok(from.startsWith(t.work + "/"), from);
      assert.deepEqual([dirname(to), basename(to)], [t.dir, basename(from)]);
    }
    assert.equal(moves[moves.length - 1][1], join(t.dir, "talk.cut-plan.json"));
    // While the programs work, nothing is beside the video under a name it does not keep.
    assert.deepEqual(seen.flat().filter((n) => !placed.includes(n) && n !== "talk.mov"), []);
    // And ffmpeg writes no video.
    assert.deepEqual(t.calls.filter((c) => c.cmd === "FFMPEG" && c.args[c.args.length - 1].endsWith(".mp4")), []);
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
    const t = setup();
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
    assert.deepEqual(copies.map(([, to]) => to).sort(), t.names().filter((n) => n !== "talk.mov").map((n) => join(t.dir, n)));
    assert.ok(copies.every(([from]) => from.startsWith(t.work + "/")));
    const said = t.logs.filter((line) => line.includes("another disk"));
    assert.equal(said.length, ALL.length - 1);
    assert.ok(said.includes(`talk.mov: talk.rough-cut.srt could not be moved from the run's own folder into ${t.dir}, which is on another disk, so it was copied there, and deleted from the run's folder.`), said.join("\n"));
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
      if (basename(to) !== "talk.rough-cut.srt") return copyFileSync(from, to);
      writeFileSync(to, "half a copy");
      throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
    };
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [false, "ENOSPC"]);
    assert.ok(!existsSync(join(t.dir, "talk.rough-cut.srt")));
    assert.deepEqual(readdirSync(t.work), []);
    t.done();
  });
  it("says plainly in the log when a file is not under its own name after it was moved into place, and the run stops with that", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    // Something takes the rough cut's captions away as soon as they are moved in.
    t.deps.move = (from, to) => {
      renameSync(from, to);
      if (basename(to) === "talk.rough-cut.srt") rmSync(to);
    };
    const r = await uneditedFile(file, t.deps);
    assert.deepEqual([r.ok, r.message], [false, "no file is there under its name after the move"]);
    assert.ok(t.logs.includes(`talk.mov: talk.rough-cut.srt was moved into ${t.dir}, but there is no file of that name there now.`), t.logs.join("\n"));
    assert.ok(!existsSync(join(t.dir, "talk.cut-plan.json")));
    t.done();
  });
});

describe("what the tool says of itself", () => {
  const text = readFileSync(new URL("../unedited.js", import.meta.url), "utf8");
  /** The comment the file opens with, and its help, each as one line: where a line breaks is not what is said. */
  const first = text.slice(0, text.indexOf("\nimport ")).replace(/\n\/\/ */g, " ");
  const help = /\nconst HELP = `([\s\S]*?)`;/.exec(text)[1].replace(/\s+/g, " ");
  const LEAVES = "The video and its sound never leave this Mac, and nothing of them goes to Claude when a video is imported.";
  it("says in its first lines and its help that nothing goes to Claude when a video is imported, and that the import is always the light one", () => {
    assert.doesNotMatch(text, /Nothing leaves the machine/);
    assert.ok(first.includes(LEAVES), first);
    assert.ok(help.includes(LEAVES), help);
    assert.ok(first.includes("it is the only import"), first);
    assert.ok(help.includes("the import is always the light import"), help);
  });
  it("says --rules-only means nothing now and that --from-plan is gone, in its first lines and in its help", () => {
    const lines = first.replace(/\s+/g, " ");
    assert.ok(lines.includes(" --rules-only accepted, and means nothing now: the import never asks Claude "), first);
    assert.ok(help.includes(" --rules-only accepted, and means nothing now: the import never asks Claude "), help);
    assert.ok(lines.includes(" --from-plan gone: the import makes no videos now. It says so and ends with 2 "), first);
    assert.ok(help.includes(" --from-plan gone: the import makes no videos now. It says so and ends with 2 "), help);
    assert.doesNotMatch(help, /upright|Final Cut|Reel candidates|short clips/);
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
    import, so the stand-in for a move fails the test. The time is `start`, 10:00 on 13 Oct unless a test gives another. */
function episodic({ start = "2026-10-13T10:00:00", local = false, ...script } = {}) {
  const t = setup({ probed: probed({ duration: "120.000000" }), ...script });
  const root = join(t.dir, "BRIMM Video");
  // A Mac with a drop folder of its own (Phase 3, L3) watches Drop in its work folder, and its settings hold that dropPath.
  const drop = local ? join(t.home, "BRIMM Video Work", "Drop") : join(root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  const clones = [];
  t.deps.settings = { version: 1, machine: "Mac Studio", root, checkout: "/checkout", ...(local ? { drop: "Drop", dropPath: drop } : {}) };
  // A status file is deleted by the next one, so what each held is kept as it was cloned in.
  t.deps.clone = (from, to) => {
    clones.push(/\/\.?importing\//.test(to) ? [from, to, readFileSync(from, "utf8")] : [from, to]);
    copyFileSync(from, to);
  };
  t.deps.commit = "abc1234";
  t.deps.now = () => new Date(start);
  // A clock of the test's own, which each wait moves on, so that the wait for a late check takes no time; and a Mac kept
  // awake by nothing.
  let clock = Date.parse(start);
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
  const filed = () => clones.filter(([, to]) => !/\/\.?importing\//.test(to));
  return { ...t, root, drop, episodes, clones, put, within, folders, filed };
}

describe("an episode imported from this Mac's drop folder", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  /** The files an episode's folder holds at its top: the files of the import, and the folder record/. */
  const TOP = [...ALL.map((ending) => `Talk.${ending}`), "record"].sort();
  it("files the video and everything made of it into a new folder in Episodes, named for the day, the video and this Mac", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, FOLDER]);
    assert.deepEqual(t.folders(), [FOLDER]);
    assert.deepEqual(t.within(FOLDER), TOP);
    assert.deepEqual(t.within(FOLDER, "record"), ["0001.json"]);
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
  it("leaves the raw video in the drop folder, and the run's own folder in BRIMM Video Work/.runs, for the late check", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const seen = [];
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && !seen.length) {
        const runs = readdirSync(join(t.home, "BRIMM Video Work", ".runs"));
        seen.push(readdirSync(t.drop), runs.length, readdirSync(join(t.home, "BRIMM Video Work", ".runs", runs[0], "made")).includes("Talk.rough-cut.srt"));
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
      if (to.endsWith(".rough-cut.srt")) throw new Error("cloning is not possible there");
      copyFileSync(from, to);
    };
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.equal(r.ok, false);
    assert.match(r.message, /^it could not be filed into Episodes: the video\.rough-cut\.srt could not be put into .*: cloning is not possible there\. Nothing was copied$/);
    assert.deepEqual([readdirSync(t.drop), readEpisode(join(t.episodes, FOLDER)).code], [["Talk.mov"], "NONE"]);
    assert.deepEqual(t.notes, ["Video of 13 Oct, 10:00 (Mac Studio) could not be put into Episodes. It stays in the drop folder; see the log."]);
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
    // The import's own timer is the one its status reporter started; the run's timer for the videos waiting for their late
    // checks has none to write yet.
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") for (const tick of ticks) tick();
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.drop, t.deps);
    const written = statuses(t);
    assert.deepEqual(written.slice(0, 3).map((s) => s.step), ["Waiting to start", "Reading the sound", "Reading the sound"]);
    const filing = written.findIndex((s) => s.step === "Filing");
    assert.ok(filing > 2 && written.slice(filing + 1).every((s) => s.step === "Waiting for its late check"), written.map((s) => s.step).join(", "));
    // Each status is named for the video, the Mac, this import's own id and the next number.
    assert.ok(written.every((s, i) => s.name === `Talk.mov (Mac Studio) ${s.import} ${i + 1}.json` && /^[0-9a-z]+$/.test(s.import) && s.import === written[0].import && s.machine === "Mac Studio" && s.pid === process.pid && s.bytes === 5), written.map((s) => s.name).join(", "));
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
    assert.ok(t.logs.some((line) => line.startsWith("A video in the drop folder: already imported as Video of 13 Oct, 10:00 (Mac Studio) (") && line.endsWith("). It stays in the drop folder until Dropbox's check of its copies passes, or for a person to delete.")), t.logs.join("\n"));
    assert.deepEqual(t.folders(), [FOLDER]);
    t.done();
  });
  it("does not import a video another Mac's fresh status file holds", async () => {
    const t = episodic();
    t.put("Talk.mov");
    leave(t, { machine: "Sallie's laptop", video: "Talk.mov" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.calls, []);
    assert.ok(t.logs.includes("A video in the drop folder: it is being imported on Sallie's laptop."), t.logs.join("\n"));
    t.done();
  });
  it("does not import a video whose import failed until someone says to try it again", async () => {
    const t = episodic();
    t.put("Talk.mov");
    leave(t, { machine: "Mac Studio", video: "Talk.mov", failed: "the transcriber stopped" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.calls, []);
    assert.ok(t.logs.includes(`A video in the drop folder: its import failed on Mac Studio: the transcriber stopped. Say "try it again" to import it again.`), t.logs.join("\n"));
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
    assert.ok(t.logs.includes("A video in the drop folder: an import of it on this Mac stopped before it was done, so it is imported again."), t.logs.join("\n"));
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
    assert.ok(t.logs.some((line) => line.startsWith(`Video of 13 Oct, 10:00 (Mac Studio): the late check passed: every file of its episode, e-20261013-`) && line.endsWith(", is whole in Dropbox. The video is taken out of the drop folder.")), t.logs.join("\n"));
    t.done();
  });
  it("copies a file in again when Dropbox has taken it away before the late check", async () => {
    const t = timed();
    t.put("Talk.mov");
    const rough = join(t.episodes, FOLDER, "Talk.rough-cut.srt");
    t.hooks.push((ms) => {
      if (ms === 60000 && existsSync(rough)) rmSync(rough);
    });
    await uneditedFolder(t.drop, t.deps);
    assert.match(readFileSync(rough, "utf8"), /^1\n00:/);
    assert.deepEqual(readdirSync(t.drop), []);
    assert.ok(t.logs.some((line) => line.startsWith("the video.rough-cut.srt is not whole in ") && line.endsWith("at the late check (it is not there), so it is copied in again from its work copy.")), t.logs.join("\n"));
    t.done();
  });
  it("keeps the raw video, says so in the status file, the cut plan's first lines and a banner, and never imports it twice, when a file is still wrong", async () => {
    const t = timed();
    t.put("Talk.mov");
    const rough = join(t.episodes, FOLDER, "Talk.rough-cut.srt");
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
    assert.match(status.problem, /^the video\.rough-cut\.srt could not be put into .*: it is 7 bytes there, not \d+\. Nothing was copied\.$/);
    const plan = readFileSync(join(t.episodes, FOLDER, "Talk.cut-plan.txt"), "utf8");
    assert.ok(plan.startsWith(`Dropbox lost a file of this episode after it was copied in, and it could not be put back: ${status.problem}\n`), plan.slice(0, 200));
    const { record } = readEpisode(join(t.episodes, FOLDER));
    assert.deepEqual([record.rev, record.files["Talk.cut-plan.txt"]], [2, Buffer.byteLength(plan)]);
    assert.deepEqual(t.notes, [`Ready: Video of 13 Oct, 10:00 (Mac Studio). In Claude, say "what's waiting?"`, "Dropbox lost a file of Video of 13 Oct, 10:00 (Mac Studio). The video stays in the drop folder; see the log."]);
    const calls = t.calls.length;
    t.logs.length = 0;
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.calls.length, calls);
    assert.ok(t.logs.some((line) => line.startsWith("Video of 13 Oct, 10:00 (Mac Studio): copied in, but Dropbox found a problem with a copy of it: ")), t.logs.join("\n"));
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
    assert.ok(pending.work.startsWith(runs(t) + "/") && existsSync(join(pending.work, "made", "Talk.rough-cut.srt")), pending.work);
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
    assert.deepEqual(t.notes, [`Ready: Video of 13 Oct, 10:00 (Mac Studio). In Claude, say "what's waiting?"`]);
    assert.ok(t.logs.includes("Video of 13 Oct, 10:00 (Mac Studio): copied into Dropbox. Its late check is due at 10:15."), t.logs.join("\n"));
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

describe("what the final review found in the episode import", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  it("imports a recording dropped again under the same name during the wait as an episode of its own, and the first late check leaves it alone", async () => {
    const t = episodic();
    t.put("Talk.mov");
    let waits = 0;
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && ++waits === 2) {
        rmSync(join(t.drop, "Talk.mov"));
        t.put("Talk.mov", "a longer video");
      }
      return wait(ms);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), [FOLDER, `${FOLDER}-2`]);
    assert.deepEqual([readFileSync(join(t.episodes, FOLDER, "Talk.mov"), "utf8"), readFileSync(join(t.episodes, `${FOLDER}-2`, "Talk.mov"), "utf8")], ["video", "a longer video"]);
    assert.ok(t.logs.some((line) => line.startsWith("Video of 13 Oct, 10:00 (Mac Studio): the late check passed: every file of its episode, e-") && line.includes("another file of that name")), t.logs.join("\n"));
    t.done();
  });
  it("looks again each minute at a video it held at first, so one whose status was taken away meanwhile is imported", async () => {
    const t = episodic();
    t.put("Talk.mov");
    t.put("Other.mov", "other");
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "Other.mov (Mac Studio) 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 99999999, video: "Other.mov", bytes: 5, seconds: 120, step: "Reading the sound", at: new Date().toISOString(), failed: "the transcriber stopped" }));
    let waits = 0;
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && ++waits === 2) rmSync(join(folder, "Other.mov (Mac Studio) 1.json"), { force: true });
      return wait(ms);
    };
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), ["2026-10-13 Other (Mac Studio)", FOLDER]);
    assert.equal(t.logs.filter((line) => line.startsWith("A video in the drop folder: its import failed")).length, 1, t.logs.join("\n"));
    assert.ok(results.some((r) => r.folder === "2026-10-13 Other (Mac Studio)"));
    t.done();
  });
  it("keeps the lock of this Mac's drop folder in BRIMM Video Work, so a run started by hand and the launch agent's share it, whatever their temp folders", async () => {
    const t = episodic();
    t.put("Talk.mov");
    delete t.deps.lockDir;
    const runs = join(t.home, "BRIMM Video Work", ".runs");
    mkdirSync(runs, { recursive: true });
    writeFileSync(lockFile(t.drop, runs), "4242");
    t.deps.alive = (pid) => pid === 4242;
    assert.deepEqual(await uneditedFolder(t.drop, t.deps), []);
    assert.deepEqual([t.calls, t.logs], [[], ["Another run (process 4242) is at work on this folder. Nothing was started."]]);
    t.done();
  });
  it("refuses to work a drop folder for episodes the old way when this Mac's settings cannot be used, and says why", async () => {
    const t = episodic();
    t.put("Talk.mov");
    writeFileSync(join(t.drop, ".brimm-watched-by"), "Mac Studio\n");
    t.deps.settings = null;
    assert.deepEqual(await uneditedFolder(t.drop, t.deps), []);
    assert.deepEqual([readdirSync(t.drop).sort(), t.calls], [[".brimm-watched-by", "Talk.mov"], []]);
    assert.deepEqual(t.logs, [`This is a drop folder for episodes (${join(t.drop, ".brimm-watched-by")} names Mac Studio), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac.`]);
    t.done();
  });
  // The switch names Drop: a folder directly in BRIMM Video/Drop/ is a drop folder as one in BRIMM Video/Unedited Video/ is, and
  // the log names the folder it is in.
  it("takes a folder directly in BRIMM Video/Drop for a drop folder too, even with no marker in it, and the log names the folder it is in", async () => {
    const t = episodic();
    const drop = join(t.root, "Drop", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mov"), "video");
    t.deps.settings = null;
    assert.deepEqual(await uneditedFolder(drop, t.deps), []);
    assert.deepEqual([readdirSync(drop), t.calls], [["Talk.mov"], []]);
    assert.deepEqual(t.logs, ["This is a drop folder for episodes (it is in BRIMM Video/Drop), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac."]);
    // The old one says where it is, too.
    t.logs.length = 0;
    assert.deepEqual(await uneditedFolder(t.drop, t.deps), []);
    assert.deepEqual(t.logs, ["This is a drop folder for episodes (it is in BRIMM Video/Unedited Video), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac."]);
    t.done();
  });
  it("does not work the old drop folder the old way either once this Mac's settings name Drop, and imports Drop/<this Mac> as episodes", async () => {
    const t = episodic();
    const drop = join(t.root, "Drop", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mov"), "video");
    writeFileSync(join(t.drop, "Old.mov"), "video");
    t.deps.settings = { ...t.deps.settings, drop: "Drop" };
    assert.deepEqual(await uneditedFolder(t.drop, t.deps), []);
    assert.deepEqual([readdirSync(t.drop), t.calls], [["Old.mov"], []]);
    t.logs.length = 0;
    const [r] = await uneditedFolder(drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13 Talk (Mac Studio)"]);
    assert.deepEqual(t.folders(), ["2026-10-13 Talk (Mac Studio)"]);
    // Nothing in Dropbox is renamed or moved into a folder for the day, as the old way does: the late check, which this run
    // waited for, took the video out, and nothing else is in the drop folder.
    assert.deepEqual(readdirSync(drop), []);
    t.done();
  });
  it("imports a drop folder this Mac picked as episodes, and still does nothing in Drop/<this Mac> that no settings name (Phase 3, L1)", async () => {
    const t = episodic();
    const picked = join(t.home, "Desktop", "Drop");
    const old = join(t.root, "Drop", "Mac Studio");
    mkdirSync(picked, { recursive: true });
    mkdirSync(old, { recursive: true });
    writeFileSync(join(picked, "Talk.mov"), "video");
    writeFileSync(join(old, "Old.mov"), "video");
    t.deps.settings = { ...t.deps.settings, import: "light", drop: "Drop", dropPath: picked };
    assert.deepEqual(await uneditedFolder(old, t.deps), []);
    assert.deepEqual([readdirSync(old), t.calls], [["Old.mov"], []]);
    assert.deepEqual(t.logs, ["This is a drop folder for episodes (it is in BRIMM Video/Drop), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac."]);
    t.logs.length = 0;
    const [r] = await uneditedFolder(picked, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13 Talk (Mac Studio)"]);
    assert.deepEqual(t.folders(), ["2026-10-13 Talk (Mac Studio)"]);
    assert.deepEqual(readdirSync(picked), []);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in the import", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  /** Each wait of a minute calls `hook` with its count, from 1. */
  const atWait = (t, hook) => {
    let n = 0;
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000) await hook(++n);
      return wait(ms);
    };
  };
  /** The status files written, as they were when each was cloned in, from `since` on. */
  const statusesSince = (t, since = 0) => t.clones.slice(since).filter(([, to]) => to.includes("/.importing/")).map(([, to, text]) => ({ name: basename(to), ...JSON.parse(text) }));
  it("3. stops an import whose video was replaced in the drop folder while it was worked on, and imports the new one on its own", async () => {
    const t = episodic();
    t.put("Talk.mov");
    let swapped = false;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE" && !swapped) {
        swapped = true;
        rmSync(join(t.drop, "Talk.mov"));
        t.put("Talk.mov", "a corrected export");
      }
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), [FOLDER]);
    assert.equal(readFileSync(join(t.episodes, FOLDER, "Talk.mov"), "utf8"), "a corrected export");
    assert.ok(t.logs.includes("Video of 13 Oct, 10:00 (Mac Studio): it changed in the drop folder while it was imported, so this import is stopped, and the new file is imported on its own."), t.logs.join("\n"));
    assert.deepEqual(readdirSync(t.drop), []);
    t.done();
  });
  it("7. asks Dropbox to bring down a video that is there only as a placeholder, and imports it once it is whole", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const brought = [];
    t.deps.isWhole = () => brought.length > 0;
    t.deps.bringDown = async (path) => brought.push(path);
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, brought], [true, [join(t.drop, "Talk.mov")]]);
    t.done();
  });
  it("7. asks for a placeholder to be brought down in today's watched folder too, as ffprobe's reading of it did before", async () => {
    const t = setup();
    t.video("a.mov");
    const brought = [];
    t.deps.isWhole = () => brought.length > 0;
    t.deps.bringDown = async (path) => brought.push(path);
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder, brought], [true, "2026-10-13", [join(t.dir, "a.mov")]]);
    t.done();
  });
  it("13. leaves in the drop folder a file of the same name and size dropped during the wait, at the first late check", async () => {
    const t = episodic();
    t.put("Talk.mov");
    atWait(t, (n) => {
      if (n === 2) {
        rmSync(join(t.drop, "Talk.mov"));
        t.put("Talk.mov", "VIDEO");
      }
    });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([t.folders(), readFileSync(join(t.drop, "Talk.mov"), "utf8")], [[FOLDER], "VIDEO"]);
    assert.equal(readFileSync(join(t.episodes, FOLDER, "Talk.mov"), "utf8"), "video");
    t.done();
  });
  it("14. puts the record back from its work copy when Dropbox took it away before the late check, with its folder", async () => {
    const t = episodic();
    t.put("Talk.mov");
    atWait(t, (n) => {
      if (n === 1) rmSync(join(t.episodes, FOLDER, "record"), { recursive: true });
    });
    await uneditedFolder(t.drop, t.deps);
    assert.equal(readEpisode(join(t.episodes, FOLDER)).record.rev, 1);
    assert.deepEqual(readdirSync(t.drop), []);
    t.done();
  });
  it("15. leaves a person's own files of the video's name in the drop folder", async () => {
    const t = episodic();
    t.put("Talk.mov");
    writeFileSync(join(t.drop, "Talk.srt"), "a person's own captions");
    writeFileSync(join(t.drop, "Talk.transcript.txt"), "a person's own words");
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(readdirSync(t.drop).sort(), ["Talk.srt", "Talk.transcript.txt"]);
    assert.equal(readFileSync(join(t.drop, "Talk.srt"), "utf8"), "a person's own captions");
    t.done();
  });
  it("17. keeps writing a filed video's waiting status while another video is imported", async () => {
    const t = episodic();
    t.put("Other.mov", "other");
    t.put("Talk.mov");
    // The timers of the run, each until it is cancelled.
    const ticks = [];
    t.deps.every = (fn) => ticks.push(fn) - 1;
    t.deps.cancel = (i) => {
      ticks[i] = null;
    };
    let during = null;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE" && args[args.length - 1].endsWith("Talk.mov") && !during) {
        const start = t.clones.length;
        for (const tick of ticks) if (tick) tick();
        during = statusesSince(t, start).filter((s) => s.video === "Other.mov");
      }
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.ok(during.some((s) => s.step === "Waiting for its late check"), JSON.stringify(during));
    t.done();
  });
  it("18. never lets the first import's status or late check take away a failed status of the same name dropped again", async () => {
    const t = episodic();
    t.put("Talk.mov");
    let filed = false;
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "WHISPER" && filed) return { code: 3, stderr: "error: failed to initialize whisper context\n" };
      return run(cmd, args, asked);
    };
    atWait(t, (n) => {
      if (n === 2) {
        filed = true;
        rmSync(join(t.drop, "Talk.mov"));
        t.put("Talk.mov", "a corrected export");
      }
    });
    await uneditedFolder(t.drop, t.deps);
    const left = readdirSync(join(t.episodes, ".importing")).map((n) => JSON.parse(readFileSync(join(t.episodes, ".importing", n), "utf8")));
    assert.deepEqual(left.map((s) => [s.video, s.bytes, Boolean(s.failed)]), [["Talk.mov", 18, true]]);
    assert.equal(readFileSync(join(t.drop, "Talk.mov"), "utf8"), "a corrected export");
    t.done();
  });
});

describe("a failed import taken again by a run that is still at work (retry with a busy agent)", () => {
  /** Have the transcriber fail for `video` until `ok()` is called. The transcriber is not told the video's name, so the video
      the run is on is the one ffprobe was last asked about. */
  const failing = (t, video) => {
    let fails = true;
    let on = "";
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") on = basename(args[args.length - 1]);
      if (cmd === "WHISPER" && fails && on === video) return { code: 3, stderr: "error: failed to initialize whisper context\n" };
      return run(cmd, args, asked);
    };
    return () => {
      fails = false;
    };
  };
  const lift = (t, video) => {
    const folder = join(t.episodes, ".importing");
    for (const n of readdirSync(folder)) if (n.startsWith(`${video} (`)) rmSync(join(folder, n));
  };
  it("imports again, while it waits for a late check, a video whose failed status was taken away", async () => {
    const t = episodic();
    t.put("Other.mov", "other");
    t.put("Talk.mov");
    const ok = failing(t, "Other.mov");
    let n = 0;
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && ++n === 2) {
        ok();
        lift(t, "Other.mov");
      }
      return wait(ms);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), ["2026-10-13 Other (Mac Studio)", "2026-10-13 Talk (Mac Studio)"]);
    t.done();
  });
  it("looks once more before it ends, so a failed status taken away while it worked is acted on", async () => {
    const t = episodic();
    t.put("Other.mov", "other");
    const ok = failing(t, "Other.mov");
    // As retry would, once the run has seen the failed status: it is taken away at the run's next look at its clock, which is
    // its last look in the drop folder.
    let failedNow = false;
    t.deps.notify = (text) => {
      t.notes.push(text);
      if (text.startsWith("No transcript could be made from Video of 13 Oct")) failedNow = true;
    };
    const clock = t.deps.clock;
    t.deps.clock = () => {
      if (failedNow) {
        failedNow = false;
        ok();
        lift(t, "Other.mov");
      }
      return clock();
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), ["2026-10-13 Other (Mac Studio)"]);
    t.done();
  });
});

describe("the lead's re-check of PR 11", () => {
  it("1. reads a placeholder that stays a placeholder through once in a run, however often it is looked at", async () => {
    const t = episodic();
    t.put("Talk.mov");
    t.put("Ghost.mov", "ghost");
    const reads = [];
    t.deps.isWhole = (path) => !path.endsWith("Ghost.mov");
    t.deps.bringDown = async (path) => reads.push(path);
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(reads, [join(t.drop, "Ghost.mov")]);
    t.done();
  });
  it("2. waits for the late check of a video it imports at its last look, and ends only when none is still to make", async () => {
    const t = episodic();
    t.put("Talk.mov");
    let dropped = false;
    t.deps.log = (line) => {
      t.logs.push(line);
      if (!dropped && line.startsWith("Video of 13 Oct, 10:00 (Mac Studio): the late check passed")) {
        dropped = true;
        t.put("Other.mov", "other");
      }
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.folders(), ["2026-10-13 Other (Mac Studio)", "2026-10-13 Talk (Mac Studio)"]);
    assert.deepEqual(readdirSync(t.drop), []);
    assert.equal(t.logs.filter((line) => line.includes(": the late check passed")).length, 2, t.logs.join("\n"));
    t.done();
  });
  it("5. counts an import that filed its episode with a piece missing as filed, not failed, and does not look at it again", async () => {
    const t = episodic({ told: null });
    t.put("Talk.mov");
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(results.map((r) => [r.name, r.ok, Boolean(r.held)]), [["Talk.mov", false, false]]);
    t.done();
  });
});

describe("the lead's last check of PR 11", () => {
  /** How many times the run asked ffprobe about `video`: once for each try at importing it. */
  const tries = (t, video) => t.calls.filter((c) => c.cmd === "FFPROBE" && c.args[c.args.length - 1].endsWith(video)).length;
  it("1. tries a failed import once in a run when its failed status cannot be written, and says why", async () => {
    const t = episodic({ whisper: "fail" });
    t.put("Talk.mov");
    const importing = join(t.episodes, ".importing");
    mkdirSync(importing, { recursive: true });
    chmodSync(importing, 0o555);
    try {
      await uneditedFolder(t.drop, t.deps);
    } finally {
      chmodSync(importing, 0o755);
    }
    assert.equal(tries(t, "Talk.mov"), 1);
    assert.ok(t.logs.includes("A video in the drop folder: its import failed, and its status, which would say so, could not be written, so it is not tried again in this run."), t.logs.join("\n"));
    t.done();
  });
  it("1. tries a video with a name of 240 bytes once, with a status file name cut to fit, and says why it failed", async () => {
    const t = episodic();
    const name = `${"a".repeat(236)}.mov`;
    t.put(name);
    await uneditedFolder(t.drop, t.deps);
    assert.equal(tries(t, name), 1);
    const statuses = readdirSync(join(t.episodes, ".importing"));
    assert.equal(statuses.length, 1);
    assert.ok(Buffer.byteLength(statuses[0]) <= 255, statuses[0]);
    assert.ok(JSON.parse(readFileSync(join(t.episodes, ".importing", statuses[0]), "utf8")).failed, t.logs.join("\n"));
    assert.ok(t.logs.some((line) => line.startsWith(`${name}: it could not be filed into Episodes`) || line.includes("ENAMETOOLONG")), t.logs.join("\n"));
    t.done();
  });
  it("3. records when this Mac first saw each video in its drop folder, and forgets it once the video is gone", async () => {
    const t = episodic();
    t.put("Talk.mov");
    const seenFile = join(t.home, "Library", "Application Support", "BRIMM Video", "seen.json");
    let during = null;
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && !during) during = JSON.parse(readFileSync(seenFile, "utf8"));
      return wait(ms);
    };
    await uneditedFolder(t.drop, t.deps);
    const id = statSync(join(t.episodes, "2026-10-13 Talk (Mac Studio)", "Talk.mov")) && Object.keys(during)[0];
    assert.match(id, /^Talk\.mov:\d+:5$/);
    assert.equal(during[id].path, join(t.drop, "Talk.mov"));
    assert.ok(Number.isFinite(during[id].at));
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(JSON.parse(readFileSync(seenFile, "utf8")), {});
    t.done();
  });
});

describe("the end of a run from the command line", () => {
  it("2. ends the process with its code once what it printed is out, whatever is still open", () => {
    const code = `import("${fileURLToPath(new URL("../unedited.js", import.meta.url))}").then(({ finish }) => { setInterval(() => {}, 1000); process.stdout.write("done\\n"); finish(3); });`;
    const ran = spawnSync(process.execPath, ["-e", code], { encoding: "utf8", timeout: 10000 });
    assert.deepEqual([ran.status, ran.stdout], [3, "done\n"]);
  });
  it("says --from-plan is gone and ends with 2 before it looks for a program or a home folder", () => {
    const ran = spawnSync(process.execPath, [fileURLToPath(new URL("../unedited.js", import.meta.url)), "--from-plan", "/in/a.mov"], { encoding: "utf8", timeout: 10000, env: { ...process.env, PATH: "/nonexistent" } });
    assert.equal(ran.status, 2);
    assert.match(ran.stdout, /^\S+ --from-plan is gone: the import makes no videos now\.\n$/);
  });
  it("2. is how the command line ends", () => {
    const text = readFileSync(fileURLToPath(new URL("../unedited.js", import.meta.url)), "utf8");
    assert.match(text, /main\(process\.argv\.slice\(2\)\)\.then\(\(code\) => finish\(code\)\);/);
  });
});

describe("a video with a sound this Mac's ffmpeg cannot read beside one it can, as an iPhone's", () => {
  /** What ffprobe writes of the made-up recording when it has, after its picture, the sound streams given, in that order. */
  const withSounds = (...codecs) => {
    const told = JSON.parse(probed());
    const [picture, sound] = told.streams;
    told.streams = [{ ...picture, index: 0 }, ...codecs.map((codec, i) => ({ ...sound, index: i + 1, codec_name: codec, channels: codec === "apple_apac" ? 4 : 1 }))];
    return JSON.stringify(told);
  };
  const after = (args, flag) => args[args.indexOf(flag) + 1];
  it("takes the sound it can read, by an explicit map, though APAC is listed first", async () => {
    const t = setup({ probed: withSounds("apple_apac", "aac") });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.equal(r.ok, true, r.message);
    const ffmpeg = t.calls.filter((c) => c.cmd === "FFMPEG");
    const sound = ffmpeg.find((c) => c.args.includes("pcm_s16le") && c.args.includes("16000"));
    assert.equal(after(sound.args, "-map"), "0:2");
    t.done();
  });
  it("says plainly that its sound cannot be read when its only sound is APAC, and makes nothing", async () => {
    const t = setup({ probed: withSounds("apple_apac") });
    const r = await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual([r.ok, r.message], [false, "its sound is in a form this Mac's ffmpeg cannot read (apple_apac)"]);
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE"]);
    t.done();
  });
});

describe("the streams a run takes, by their numbers, when they are not their places in ffprobe's list", () => {
  /** What ffprobe writes of a recording, as `printed` says, when it has a timecode track first, its picture as stream 2, Apple's
      APAC as stream 3 with four channels, starting 0.479 seconds after the picture, and then two sounds this Mac's ffmpeg can
      read: AAC in stereo at 44.1 kHz as stream 5, and a mono AAC as stream 6. No stream's number is its place in the list,
      and ffmpeg on its own would take the APAC, which has the most channels. */
  const numbered = (printed) => {
    const told = JSON.parse(printed);
    const [picture, sound] = told.streams;
    told.streams = [
      { index: 0, codec_type: "data", codec_tag_string: "tmcd" },
      { ...picture, index: 2 },
      { ...sound, index: 3, codec_name: "apple_apac", channels: 4, sample_rate: "48000", start_time: "0.479000" },
      { ...sound, index: 5, codec_name: "aac", channels: 2, sample_rate: "44100" },
      { ...sound, index: 6, codec_name: "aac", channels: 1, sample_rate: "22050" }
    ];
    return JSON.stringify(told);
  };
  const talk = longTalk(16);
  /** The streams of the video an ffmpeg call names: by -map, and in its graph of filters. A graph's own outputs, mapped as [v]
      and [a], are not streams of the video. */
  const named = (args) => [...args.filter((a, i) => args[i - 1] === "-map" && a.startsWith("0:")), ...(args.includes("-filter_complex") ? [...after(args, "-filter_complex").matchAll(/\[(0:[^\]]+)\]/g)].map((m) => m[1]) : [])];
  /** Each ffmpeg call that reads the video `file`, but for the stills the faces are looked for in, which take its picture
      alone: the name of the file it writes, and the streams it names, each once. */
  const reads = (calls, file) => calls.filter((c) => c.cmd === "FFMPEG" && after(c.args, "-i") === file && !c.args.includes("-an"))
    .map((c) => [basename(c.args[c.args.length - 1]), [...new Set(named(c.args))].sort()]);
  it("takes the first sound it can read by its number in the one ffmpeg of the import that reads the video: the sound", async () => {
    const t = setup({ ...talk, probed: numbered(talk.probed) });
    const file = t.video("talk.mov");
    const r = await uneditedFile(file, t.deps);
    assert.equal(r.ok, true, r.message);
    assert.deepEqual(reads(t.calls, file), [["sound.wav", ["0:5"]]]);
    t.done();
  });
  it("times the words, the pauses and the captions by the sound it takes", async () => {
    const plain = setup({ ...talk });
    await uneditedFile(plain.video("talk.mov"), plain.deps);
    const t = setup({ ...talk, probed: numbered(talk.probed) });
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(JSON.parse(t.read("talk.words.json")).words, JSON.parse(plain.read("talk.words.json")).words);
    assert.deepEqual(JSON.parse(t.read("talk.cut-plan.json")).ranges, JSON.parse(plain.read("talk.cut-plan.json")).ranges);
    assert.equal(t.read("talk.rough-cut.srt"), plain.read("talk.rough-cut.srt"));
    plain.done();
    t.done();
  });
});

describe("the check that Claude can be asked from here (--check-claude)", () => {
  /** A stand-in for Claude Code that ends as `ends` says, and what it was given. */
  const claude = (ends) => {
    const asked = [];
    const run = async (cmd, args, given = {}) => {
      asked.push({ cmd, args, given, there: readdirSync(given.cwd) });
      return ends;
    };
    return { asked, run };
  };
  it("asks Claude once, locked down as the import asks it, from an empty folder, and says it answered", async () => {
    const c = claude(answers("OK"));
    const said = [];
    assert.equal(await checkClaude({ run: c.run, tools: { claude: "CLAUDE" }, say: (line) => said.push(line) }), 0);
    assert.deepEqual(said, ["Claude answered from here."]);
    assert.equal(c.asked.length, 1);
    const { cmd, args, given, there } = c.asked[0];
    assert.equal(cmd, "CLAUDE");
    assert.deepEqual(args.slice(0, 3), ["-p", "--model", CLAUDE_MODEL]);
    for (const locked of [["--tools", ""], ["--setting-sources", ""]]) assert.ok(args.some((a, i) => a === locked[0] && args[i + 1] === locked[1]), locked[0]);
    assert.ok(args.includes("--strict-mcp-config") && args.includes("--no-session-persistence"));
    assert.equal(given.input, "Reply with the one word OK.");
    assert.ok(given.limit > 0 && given.out > 0);
    assert.deepEqual(there, []);
  });
  it("says why when Claude could not be asked from here, and ends with 1", async () => {
    for (const [ends, why] of [
      [{ code: 1, stderr: "", stdout: printed("Not logged in · Please run /login", { is_error: true }) }, "Claude Code gave an error (Not logged in · Please run /login)"],
      [{ code: 1, stderr: "", outOfTime: true }, "it gave no answer in 2 minutes"],
      [{ code: 0, stderr: "", stdout: "not JSON" }, "what Claude Code printed could not be read"]
    ]) {
      const said = [];
      assert.equal(await checkClaude({ run: claude(ends).run, tools: { claude: "CLAUDE" }, say: (line) => said.push(line) }), 1, why);
      assert.deepEqual(said, [`Claude could not be asked from here: ${why}.`]);
    }
    const said = [];
    assert.equal(await checkClaude({ run: claude(answers("OK")).run, tools: { claude: "" }, say: (line) => said.push(line) }), 1);
    assert.deepEqual(said, ["Claude could not be asked from here: Claude Code is not on this Mac."]);
  });
  it("is asked for on its own, with no video", () => {
    assert.deepEqual(parseArgs(["--check-claude"]), { file: "", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false, checkClaude: true });
    assert.deepEqual(parseArgs(["--check-claude", "--until", "1800000180"]), { file: "", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false, checkClaude: true, until: 1800000180 });
  });
  // The installer's check agent is given the time it is for. One that a setup cut short by a kill -9 or a power cut left
  // behind is run by launchd at every login: past that time it asks Claude nothing, and says so in its log. The log says how
  // to take that one agent away alone, as the setup guide does, and not by install.sh --remove, which would also stop the
  // import's own agent and leave the drop folder unwatched.
  it("asks Claude nothing once the time it was given has passed, or when that time cannot be read, and says so", async () => {
    const ALONE = "launchctl bootout gui/$(id -u)/com.thebrimm.claude-check; rm ~/Library/LaunchAgents/com.thebrimm.claude-check.plist";
    const OVER = `This check of Claude was for a setup that is over, so Claude was not asked. That setup was cut short and left its launch agent, com.thebrimm.claude-check, behind. To take that one agent away alone, in Terminal: ${ALONE}. Not install.sh --remove, which also stops the import's own agent, com.thebrimm.unedited.`;
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    assert.ok(guide.includes(`\`${ALONE}\``), "the setup guide takes that one agent away by the same command");
    for (const [how, until] of [["a second late", 1800000180], ["a time that cannot be read", Number.NaN]]) {
      const c = claude(answers("OK"));
      const said = [];
      assert.equal(await checkClaude({ run: c.run, tools: { claude: "CLAUDE" }, say: (line) => said.push(line), until, now: 1800000181 * 1000 }), 0, how);
      assert.deepEqual([said, c.asked.length], [[OVER], 0], how);
    }
    // An agent an older setup left (main's installer gave it no time) is known by its label, which launchd puts in
    // XPC_SERVICE_NAME: it asks Claude nothing either, so it cannot use her account at every login (the fold's check of #26-1).
    {
      const c = claude(answers("OK"));
      const said = [];
      assert.equal(await checkClaude({ run: c.run, tools: { claude: "CLAUDE" }, say: (line) => said.push(line), job: "com.thebrimm.claude-check", now: 1800000181 * 1000 }), 0);
      assert.deepEqual([said, c.asked.length], [[`This check of Claude was run by the launch agent an older setup left behind, com.thebrimm.claude-check, so Claude was not asked. To take that one agent away alone, in Terminal: ${ALONE}. Not install.sh --remove, which also stops the import's own agent, com.thebrimm.unedited.`], 0]);
    }
    // Until then, and with no time given, run by hand (or by any other job), it asks as before.
    for (const until of [1800000180, undefined]) {
      const c = claude(answers("OK"));
      const said = [];
      assert.equal(await checkClaude({ run: c.run, tools: { claude: "CLAUDE" }, say: (line) => said.push(line), until, job: until === undefined ? "0" : "com.thebrimm.claude-check", now: 1800000180 * 1000 }), 0);
      assert.deepEqual([said, c.asked.length], [["Claude answered from here."], 1]);
    }
  });
  it("is given that time when it is run for --check-claude", () => {
    const text = readFileSync(new URL("../unedited.js", import.meta.url), "utf8");
    assert.match(text, /\n {2}if \(args\.checkClaude\) return checkClaude\(\{ [^\n]*until: args\.until, job: process\.env\.XPC_SERVICE_NAME[^\n]*\}\);\n/);
    const help = /\nconst HELP = `([\s\S]*?)`;/.exec(text)[1].replace(/\s+/g, " ");
    assert.ok(help.includes(" --until <time> with --check-claude: ask Claude nothing once this time, in seconds since 1970, has passed. "), help);
  });
});

/** Every file in a folder and the folders in it, each by its path from the folder, with "/", sorted. */
const listAll = (folder, under = "") => readdirSync(join(folder, under), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? listAll(folder, join(under, entry.name)) : [join(under, entry.name)])).sort();

/** A test of the light import (spec 2026-10-22, section 1): the episode import's test (episodic), with this Mac's settings saying
    `import: "light"`. Claude Code is on the Mac and would answer, so that a test sees
    it is not asked. The clock says 15:00 on 20 Oct, the progress panel's stand-in keeps what it is told (`told`), and `video` is
    put in the drop folder of `machine`. */
function episodeImport({ video = "Talk.mov", machine = "Mac Studio", ...script } = {}) {
  const t = episodic({ claude: [answers(REPLY)], start: "2026-10-20T15:00:00", ...script });
  const drop = join(t.root, "Unedited Video", machine);
  mkdirSync(drop, { recursive: true });
  t.deps.settings = { ...t.deps.settings, machine, import: "light" };
  t.deps.today = () => "2026-10-20";
  const told = [];
  t.deps.progress = {
    begin: (name) => told.push(["begin", name]),
    length: (seconds) => told.push(["length", seconds]),
    steps: (names) => told.push(["steps", names]),
    step: (name, shown = name) => told.push(["step", shown]),
    fraction: () => {},
    encoding: () => ({ args: [], stop: () => {} }),
    end: (finished) => told.push(["end", finished])
  };
  const put = (name, bytes = "video") => {
    writeFileSync(join(drop, name), bytes);
    return join(drop, name);
  };
  put(video);
  const folderOf = (name) => join(t.episodes, `2026-10-20 ${basename(name, extname(name))} (${machine})`);
  return { ...t, drop, put, told, folderOf, episodeFolder: () => folderOf(video), record: (name = video) => readEpisode(folderOf(name)).record };
}

describe("the light import", () => {
  /** What a light import files of Talk.mov: the video, its transcript, words, cut plan and cut log, the rough cut's captions,
      and the record. */
  const LIGHT = ["Talk.cut-plan.json", "Talk.cut-plan.txt", "Talk.mov", "Talk.rough-cut.srt", "Talk.rough-cut.transcript.txt", "Talk.srt", "Talk.transcript.txt", "Talk.words.json", "record/0001.json"];
  const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
  const READY = `Ready: ${LABEL}. In Claude, say "what's waiting?"`;
  const LIGHT_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Filing"];
  /** The record of an episode written again as she would have answered it: a finished video. */
  const answered = (t, name) => {
    const { record } = readEpisode(t.folderOf(name));
    writeEpisode(t.folderOf(name), { ...record, kind: "finished", answer: { ...record.answer, state: "answered", by: "Sallie", on: "Mac Studio", at: "2026-10-20T15:30:00-04:00" } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.deps.home });
  };

  it("asks Claude nothing, renders nothing, and writes no Final Cut file, reels.json, notes or previews", async () => {
    const t = episodeImport();
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-20 Talk (Mac Studio)"]);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "CLAUDE" || c.cmd === "SWIFT"), []);
    assert.deepEqual([t.calls.filter((c) => c.args.includes("-vf") || c.args.includes("-filter_complex")), t.guarded], [[], []]);
    // ffmpeg is asked for the sound, where the long silences are, and the pauses, and for nothing else.
    assert.equal(t.calls.filter((c) => c.cmd === "FFMPEG").length, 3);
    assert.deepEqual(listAll(t.episodeFolder()), LIGHT);
    t.done();
  });
  it("files the record as needing her answer, with the guess, what was seen, how it came, its label and its fingerprint", async () => {
    const t = episodeImport();
    await uneditedFolder(t.drop, t.deps);
    const r = t.record();
    assert.deepEqual([r.version, r.kind, r.answer, r.label], [3, null, { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null }, LABEL]);
    const { words } = JSON.parse(readFileSync(join(t.episodeFolder(), "Talk.words.json"), "utf8"));
    assert.ok(r.fingerprint.length > 0);
    assert.equal(r.fingerprint, fingerprintOf(words));
    assert.equal("versionOf" in r, false);
    assert.deepEqual([r.title, r.reels, r.video.file], [null, [], "Talk.mov"]);
    assert.deepEqual(r.files, Object.fromEntries(LIGHT.filter((n) => !n.startsWith("record/")).map((n) => [n, statSync(join(t.episodeFolder(), n)).size])));
    t.done();
  });
  it("names the video by its label in the notice and on the progress panel, never by its file", async () => {
    const t = episodeImport({ video: "Coaching call Jane Doe.mov" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.notes, [READY]);
    assert.deepEqual(t.told.filter(([what]) => what === "begin"), [["begin", LABEL]]);
    assert.ok(!JSON.stringify([t.notes, t.told]).includes("Jane"), JSON.stringify(t.told));
    assert.equal(t.record().label, LABEL);
    t.done();
  });
  it("puts its label in every status file of its import, from its start to its late check", async () => {
    /** Every status the import wrote into Episodes/.importing, as each was cloned in. */
    const statusesOf = (t) => t.clones.filter(([, to]) => to.includes("/.importing/")).map(([, , text]) => JSON.parse(text));
    const t = episodeImport({ video: "Coaching call Jane Doe.mov" });
    await uneditedFolder(t.drop, t.deps);
    const light = statusesOf(t);
    assert.ok(light.some((s) => s.step === "Reading the sound") && light.some((s) => /late check/.test(s.step)), light.map((s) => s.step).join(", "));
    assert.deepEqual([...new Set(light.map((s) => s.label))], [LABEL]);
    t.done();
    // A late check that found a problem leaves its status for a person: it keeps the label.
    const u = episodeImport({ video: "Coaching call Jane Doe.mov" });
    const srt = join(u.episodeFolder(), "Coaching call Jane Doe.rough-cut.srt");
    let filed = false;
    const clone = u.deps.clone;
    u.deps.clone = (from, to) => (filed && to === srt ? writeFileSync(to, "1\n") : clone(from, to));
    const wait = u.deps.wait;
    u.deps.wait = async (ms) => {
      if (ms === 60000 && !filed) {
        filed = true;
        writeFileSync(srt, "1\n");
      }
      return wait(ms);
    };
    await uneditedFolder(u.drop, u.deps);
    const left = readStatusesIn([importingFolder(u.root)]).map((s) => s.status);
    assert.deepEqual(left.map((s) => [Boolean(s.problem), s.label]), [[true, LABEL]]);
    u.done();
  });
  it("names each video by the moment this Mac first saw it in the drop folder, so a queue of drops keeps their own times", async () => {
    // This Mac saw Talk.mov at 14:52 and Talk two.mov at 14:57, as the import notes each video it finds, and imports both at 15:00.
    const t = episodeImport();
    noteSeen(t.home, t.drop, Date.parse("2026-10-20T14:52:00"));
    t.put("Talk two.mov");
    noteSeen(t.home, t.drop, Date.parse("2026-10-20T14:57:00"));
    await uneditedFolder(t.drop, t.deps);
    const labels = ["Video of 20 Oct, 14:52 (Mac Studio)", "Video of 20 Oct, 14:57 (Mac Studio)"];
    assert.deepEqual([t.record("Talk.mov").label, t.record("Talk two.mov").label], labels);
    assert.deepEqual([...t.notes].sort(), labels.map((label) => `Ready: ${label}. In Claude, say "what's waiting?"`));
    t.done();
    // When this Mac could not note when it saw the video, it is named by the moment its import began.
    const u = episodeImport();
    mkdirSync(seenFile(u.home), { recursive: true });
    let clock = Date.parse("2026-10-20T14:40:00");
    u.deps.clock = () => clock;
    u.deps.wait = async (ms) => {
      clock += ms;
    };
    await uneditedFolder(u.drop, u.deps);
    assert.equal(u.record().label, LABEL);
    u.done();
  });
  it("gives each video a label of its own on this Mac, numbered when two were first seen at one look of the drop folder", async () => {
    // This Mac saw Talk.mov and Talk two.mov at one look, at 14:52, and imports both at 15:00: Talk two.mov first, as the
    // import takes them in order of their names.
    const t = episodeImport();
    t.put("Talk two.mov");
    noteSeen(t.home, t.drop, Date.parse("2026-10-20T14:52:00"));
    await uneditedFolder(t.drop, t.deps);
    const labels = ["Video of 20 Oct, 14:52 (Mac Studio)", "Video of 20 Oct, 14:52 (Mac Studio) (2)"];
    assert.deepEqual([t.record("Talk two.mov").label, t.record("Talk.mov").label], labels);
    assert.deepEqual(t.notes, labels.map((label) => `Ready: ${label}. In Claude, say "what's waiting?"`));
    assert.deepEqual(t.told.filter(([what]) => what === "begin"), labels.map((label) => ["begin", label]));
    // Every status of each import carries its own label, from its start to its late check.
    const statuses = t.clones.filter(([, to]) => to.includes("/.importing/")).map(([, , text]) => JSON.parse(text));
    assert.deepEqual(["Talk two.mov", "Talk.mov"].map((video) => [...new Set(statuses.filter((s) => s.video === video).map((s) => s.label))]), labels.map((label) => [label]));
    // Once their late checks have passed, their statuses are gone, and their records still hold the labels: a third video
    // seen at that look is numbered after them.
    assert.deepEqual(readStatusesIn([importingFolder(t.root)]), []);
    t.put("Talk three.mov");
    noteSeen(t.home, t.drop, Date.parse("2026-10-20T14:52:00"));
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.record("Talk three.mov").label, "Video of 20 Oct, 14:52 (Mac Studio) (3)");
    t.done();
  });
  it("keeps the label of an import tried again, though its own status is still there, and numbers one another status of this Mac holds", async () => {
    const LABEL_AT = "Video of 20 Oct, 14:52 (Mac Studio)";
    const writeText = (to, text) => writeFileSync(to, text);
    /** A status this Mac left of an import that failed, of `video`, the import `id`, with `label`. */
    const failedStatus = (t, video, id, label) => writeStatusIn(importingFolder(t.root), { version: 1, machine: "Mac Studio", pid: 1, import: id, video, bytes: 5, seconds: null, step: "Writing the transcript", at: "2026-10-20T14:53:00-04:00", failed: "the transcriber stopped", label }, writeText);
    // Talk.mov was seen at 14:52, and its import failed: its status, with its label, is still there when it is imported
    // again, as an import is given its video once nothing holds it.
    const t = episodeImport();
    noteSeen(t.home, t.drop, Date.parse("2026-10-20T14:52:00"));
    const file = join(t.drop, "Talk.mov");
    failedStatus(t, "Talk.mov", importIdOf(fileId(file)), LABEL_AT);
    const episode = { root: t.root, machine: "Mac Studio", checkout: "/checkout", home: t.home };
    const r = await uneditedFile(file, { ...t.deps, episode, outDir: "", watched: t.drop });
    assert.equal(r.ok, true, r.message);
    assert.equal(t.record().label, LABEL_AT);
    assert.deepEqual(t.notes, [`Ready: ${LABEL_AT}. In Claude, say "what's waiting?"`]);
    assert.deepEqual(readStatusesIn([importingFolder(t.root)]).map(({ status }) => [status.video, status.label]), [["Talk.mov", LABEL_AT]]);
    t.done();
    // Another video's import on this Mac failed with that label, and nothing else holds it: the new one is numbered.
    const u = episodeImport();
    noteSeen(u.home, u.drop, Date.parse("2026-10-20T14:52:00"));
    failedStatus(u, "Old talk.mov", "k3j9x", LABEL_AT);
    await uneditedFolder(u.drop, u.deps);
    assert.equal(u.record().label, `${LABEL_AT} (2)`);
    u.done();
  });
  it("names the Mac in the notice once, by the label, which holds it", async () => {
    const t = episodeImport({ machine: "Sallie's laptop" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.notes, [`Ready: Video of 20 Oct, 15:00 (Sallie's laptop). In Claude, say "what's waiting?"`]);
    t.done();
  });
  it("tells the progress panel the light import's four steps, and no others", async () => {
    const t = episodeImport();
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.told.filter(([what]) => what === "steps").map(([, names]) => names), [LIGHT_STEPS, LIGHT_STEPS]);
    assert.deepEqual(t.told.filter(([what]) => what === "step").map(([, name]) => name), LIGHT_STEPS);
    assert.deepEqual(t.told[t.told.length - 1], ["end", true]);
    t.done();
  });
  it("writes the cut log with its times said to be the recording's, the plan with its pauses and no Claude, and the rough cut's captions by arithmetic", async () => {
    const t = episodeImport();
    await uneditedFolder(t.drop, t.deps);
    const plan = JSON.parse(readFileSync(join(t.episodeFolder(), "Talk.cut-plan.json"), "utf8"));
    assert.deepEqual([plan.by, plan.claude, plan.pauses], ["rules", undefined, HEARD.map(([start, end]) => [start, Math.min(end, 120)])]);
    const log = readFileSync(join(t.episodeFolder(), "Talk.cut-plan.txt"), "utf8");
    assert.equal(log, planText(plan, "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it."));
    const captions = roughCaptions(plan.phrases, keptSpans(plan.ranges, roughRate(plan.facts)));
    assert.equal(readFileSync(join(t.episodeFolder(), "Talk.rough-cut.srt"), "utf8"), captions);
    assert.equal(readFileSync(join(t.episodeFolder(), "Talk.rough-cut.transcript.txt"), "utf8"), stampedText(captions));
    t.done();
  });
  it("files a new drop of an answered video's words with that episode as its match, and one of a video not yet answered with none", async () => {
    const t = episodeImport();
    await uneditedFolder(t.drop, t.deps);
    t.put("Talk again.mov");
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.record("Talk again.mov").answer.match, null);
    answered(t, "Talk.mov");
    t.put("Talk v2.mov");
    await uneditedFolder(t.drop, t.deps);
    const r = t.record("Talk v2.mov");
    // The match is only what her card offers first: the record is a version of the other only once she says so.
    assert.deepEqual([r.answer.match, r.kind, r.answer.state, "versionOf" in r], [t.record().id, null, "needs your answer", false]);
    // Nothing is written into the old episode's folder.
    assert.equal(t.record().rev, 2);
    t.done();
  });
  it("compares no episode whose words are not whole on this Mac, or cannot be read, and says so in the log", async () => {
    for (const how of ["not whole", "unreadable"]) {
      const t = episodeImport();
      await uneditedFolder(t.drop, t.deps);
      answered(t, "Talk.mov");
      const words = join(t.episodeFolder(), "Talk.words.json");
      if (how === "not whole") t.deps.isWhole = (path) => path !== words;
      else writeFileSync(words, "{");
      t.put("Talk v2.mov");
      await uneditedFolder(t.drop, t.deps);
      assert.equal(t.record("Talk v2.mov").answer.match, null, how);
      const said = how === "not whole" ? `${LABEL}: its words are not on this Mac, so it was not compared.` : `${LABEL}: its words could not be read, so it was not compared.`;
      assert.ok(t.logs.includes(said), t.logs.join("\n"));
      t.done();
    }
  });
  it("files a video whose words could not be timed as needing her answer, with no fingerprint and no rough cut's captions", async () => {
    const t = episodeImport({ timing: "killed" });
    await uneditedFolder(t.drop, t.deps);
    const r = t.record();
    assert.deepEqual([r.kind, r.answer.state, r.label, r.fingerprint], [null, "needs your answer", LABEL, undefined]);
    // The rules made no plan, so they counted no retakes: there is no guess, and the line of what was seen says no count.
    assert.deepEqual(r.answer, { state: "needs your answer", guess: null, seen: "wide, 2:00", came: "camera", match: null });
    assert.deepEqual(listAll(t.episodeFolder()), ["Talk.cut-plan.txt", "Talk.mov", "Talk.srt", "Talk.transcript.txt", "record/0001.json"]);
    assert.deepEqual(t.notes, [READY]);
    t.done();
  });
  it("says nothing of how a video came or what was seen when ffprobe could not read it, and makes no guess", async () => {
    const t = episodeImport({ probe: "fail" });
    await uneditedFolder(t.drop, t.deps);
    const r = t.record();
    assert.deepEqual([r.kind, r.answer, r.label], [null, { state: "needs your answer", guess: null, seen: "", came: null, match: null }, LABEL]);
    assert.deepEqual(t.notes, [READY]);
    t.done();
  });
  // A video with a picture and no sound can only be footage for a planned video (PR H5a): the light import files it alone.
  /** What ffprobe prints of an upright phone video of 8 seconds, with no sound stream. */
  const SILENT = probed({ picture: { width: 1080, height: 1920 }, sound: null, duration: "8.000000" });
  it("files a video with a picture and no sound alone: no transcript, plan or words, its two steps, and Ready (PR H5a)", async () => {
    const t = episodeImport({ probed: SILENT });
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder, r.message], [true, "2026-10-20 Talk (Mac Studio)", ""]);
    // Its folder holds the video and its record: nothing was said, so there is no transcript, cut plan, words or rough cut's captions.
    assert.deepEqual(listAll(t.episodeFolder()), ["Talk.mov", "record/0001.json"]);
    // The one program asked is ffprobe: no sound is read, no transcriber is run, and nothing is made.
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE"]);
    assert.deepEqual(t.guarded, []);
    assert.deepEqual(t.notes, [READY]);
    assert.deepEqual(t.told.filter(([what]) => what === "step").map(([, name]) => name), ["Reading the sound", "Filing"]);
    assert.deepEqual(t.told.filter(([what]) => what === "steps").map(([, names]) => names).at(-1), ["Reading the sound", "Filing"]);
    assert.deepEqual(t.told[t.told.length - 1], ["end", true]);
    t.done();
  });
  it("files its record as needing her answer: what was seen says it has no sound, how it came, no guess and no match, and video.sound false (PR H5a)", async () => {
    const t = episodeImport({ probed: SILENT });
    await uneditedFolder(t.drop, t.deps);
    const r = t.record();
    assert.deepEqual([r.version, r.kind, r.label], [3, null, LABEL]);
    assert.deepEqual(r.answer, { state: "needs your answer", guess: null, seen: "upright, 0:08, no sound", came: "phone", match: null });
    assert.deepEqual(r.video, { file: "Talk.mov", bytes: 5, seconds: 8, recorded: "2026-10-20", recordedFrom: "import", sound: false });
    assert.deepEqual([r.files, r.fingerprint, r.title, r.reels, "versionOf" in r], [{ "Talk.mov": 5 }, undefined, null, [], false]);
    t.done();
    // A wide picture says so, and so does a short one: wide, with no sound, from a camera.
    const wide = episodeImport({ probed: probed({ sound: null, duration: "8.000000" }) });
    await uneditedFolder(wide.drop, wide.deps);
    assert.deepEqual([wide.record().answer.seen, wide.record().answer.came, wide.record().video.sound], ["wide, 0:08, no sound", "camera", false]);
    wide.done();
  });
  it("names it by its label in every status of its import and in its notice, and takes the video out of the drop folder at its late check (PR H5a)", async () => {
    const t = episodeImport({ video: "Coaching call Jane Doe.mov", probed: SILENT });
    await uneditedFolder(t.drop, t.deps);
    const statuses = t.clones.filter(([, to]) => to.includes("/.importing/")).map(([, , text]) => JSON.parse(text));
    assert.ok(statuses.some((s) => s.step === "Reading the sound") && statuses.some((s) => /late check/.test(s.step)), statuses.map((s) => s.step).join(", "));
    assert.deepEqual([...new Set(statuses.map((s) => s.label))], [LABEL]);
    assert.ok(!JSON.stringify([t.notes, t.told, t.logs]).includes("Jane"), JSON.stringify([t.notes, t.told, t.logs]));
    assert.deepEqual([readdirSync(t.drop), readStatusesIn([importingFolder(t.root)])], [[], []]);
    t.done();
  });
  it("fails a file with no picture and no sound as it always did, in plain words, and files nothing (PR H5a)", async () => {
    const t = episodeImport({ probed: probed({ picture: null, sound: null, duration: "8.000000" }) });
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.message], [false, "there is no sound in the file"]);
    assert.deepEqual(readdirSync(t.episodes).filter((n) => n !== ".importing"), []);
    assert.deepEqual(t.calls.map((c) => c.cmd), ["FFPROBE"]);
    assert.deepEqual(readStatusesIn([importingFolder(t.root)]).map(({ status }) => status.failed), ["there is no sound in the file"]);
    assert.deepEqual(t.notes, [`No transcript could be made from ${LABEL}. It stays in the drop folder; see the log.`]);
    t.done();
  });
  it("fails a video with no sound given alone, or in a folder that is not this Mac's drop folder, as it always did: only an episode's import files one (PR H5a)", async () => {
    const u = setup({ probed: SILENT });
    u.deps.settings = { version: 1, machine: "Mac Studio", root: join(u.dir, "BRIMM Video"), checkout: "/checkout", import: "light" };
    const one = await uneditedFile(u.video("mute.mov"), u.deps);
    assert.deepEqual([one.ok, one.message], [false, "there is no sound in the file"]);
    assert.match(u.read("mute.failed.txt"), /Why: there is no sound in the file\./);
    assert.ok(!existsSync(join(u.dir, "BRIMM Video")), "no episode was filed");
    u.done();
  });
  it("names the video by its label in the notices of an import that fails, or cannot be filed", async () => {
    const t = episodeImport({ video: "Coaching call Jane Doe.mov", whisper: "fail" });
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.notes, [`No transcript could be made from ${LABEL}. It stays in the drop folder; see the log.`]);
    t.done();
    const u = episodeImport({ video: "Coaching call Jane Doe.mov" });
    u.deps.clone = (from, to) => {
      if (to.endsWith(".rough-cut.srt")) throw new Error("cloning is not possible there");
      copyFileSync(from, to);
    };
    await uneditedFolder(u.drop, u.deps);
    assert.deepEqual(u.notes, [`${LABEL} could not be put into Episodes. It stays in the drop folder; see the log.`]);
    u.done();
  });
  it("names the video by its label in the banner of a late check that found a file still wrong", async () => {
    const t = episodeImport({ video: "Coaching call Jane Doe.mov" });
    const srt = join(t.episodeFolder(), "Coaching call Jane Doe.rough-cut.srt");
    let filed = false;
    const clone = t.deps.clone;
    t.deps.clone = (from, to) => (filed && to === srt ? writeFileSync(to, "1\n") : clone(from, to));
    const wait = t.deps.wait;
    t.deps.wait = async (ms) => {
      if (ms === 60000 && !filed) {
        filed = true;
        writeFileSync(srt, "1\n");
      }
      return wait(ms);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(t.notes, [READY, `Dropbox lost a file of ${LABEL}. The video stays in the drop folder; see the log.`]);
    t.done();
  });
  /** A recording as Zoom names it, and what the import says of it, until phase Z teaches it Zoom's downloads. */
  const ZOOM = "GMT20261013-142933_Recording_gvo_1280x720.mp4";
  const ZOOM_HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";
  it("holds a Zoom download in the drop folder until phase Z: not imported, where it is, its status and the log say why, and the other videos are imported", async () => {
    const t = episodeImport({ video: ZOOM });
    t.put("audio1449382767.m4a");
    t.put("Talk.mov");
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(results.filter((r) => r.held).map((r) => [r.ok, r.name, r.held]).sort(), [[true, ZOOM, ZOOM_HELD], [true, "audio1449382767.m4a", ZOOM_HELD]]);
    // Talk.mov is imported lightly, and its raw video taken out of the drop folder by its late check; the held ones stay.
    assert.deepEqual(readdirSync(t.episodes).filter((n) => n !== ".importing"), ["2026-10-20 Talk (Mac Studio)"]);
    assert.deepEqual(listAll(t.drop), [ZOOM, "audio1449382767.m4a"]);
    assert.equal(t.calls.filter((c) => c.cmd === "FFPROBE").length, 1);
    const importing = join(t.episodes, ".importing");
    const statuses = readdirSync(importing).map((n) => JSON.parse(readFileSync(join(importing, n), "utf8")));
    assert.deepEqual(statuses.map((s) => [s.video, s.machine, s.held]).sort(), [[ZOOM, "Mac Studio", ZOOM_HELD], ["audio1449382767.m4a", "Mac Studio", ZOOM_HELD]]);
    // The Mac looked in the folder each minute of the late check's wait, and said it once.
    assert.ok(t.waits.length > 3, t.waits.join(", "));
    // Each is named by its Zoom time alone (final fix 19).
    for (const name of [zoomTimeOf(ZOOM), "audio1449382767.m4a"]) assert.equal(t.logs.filter((line) => line === `${name}: ${ZOOM_HELD}`).length, 1, t.logs.join("\n"));
    assert.deepEqual(t.notes, [READY]);
    t.done();
  });
  it("imports a Zoom download given alone, or in a folder that is not this Mac's drop folder, lightly as any video, whatever the setting", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.deps.settings = { version: 1, machine: "Mac Studio", root: join(t.dir, "BRIMM Video"), checkout: "/checkout", import: "light" };
    const one = await uneditedFile(t.video(ZOOM), t.deps);
    t.video("audio1449382767.m4a");
    const [folder] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([one.ok, folder.ok, folder.held, folder.folder], [true, true, undefined, "2026-10-13"]);
    assert.equal(t.asks.length, 0);
    assert.ok(t.names().includes(`${basename(ZOOM, ".mp4")}.cut-plan.json`) && t.inside("2026-10-13").includes("audio1449382767.cut-plan.json"), t.names().join(", "));
    assert.ok(!existsSync(join(t.dir, "BRIMM Video")), "no status was written");
    assert.ok(!t.logs.some((line) => line.includes(ZOOM_HELD)));
    t.done();
  });
});

describe("importHold's state", () => {
  const NOW = Date.parse("2026-10-27T10:00:00Z");
  const MIN = 60 * 1000;
  const VIDEO = "Pricing talk.mp4";
  const ID = "k3x9";
  const record = { id: ID, video: { file: VIDEO, bytes: 13 } };
  const writeText = (to, text) => writeFileSync(to, text);
  /** A root and a home for one test, each its own folder. */
  const folders = () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-hold-"));
    return { dir, root: join(dir, "BRIMM Video"), home: join(dir, "home") };
  };
  /** The status of an import of the video, written `ago` before NOW, on `machine`, with `over` set. */
  const statusOf = (f, over = {}, ago = 0, machine = "Mac Studio") =>
    writeStatusIn(importingFolder(f.root), { version: 1, machine, pid: 4242, import: ID, video: VIDEO, bytes: 13, seconds: 23.4, step: "Waiting for its late check", at: new Date(NOW - ago).toISOString(), ...over }, writeText);
  /** This Mac's late check of the video, whose last copy was `ago` before NOW, so that it is due at 15 minutes after that. */
  const pendingOf = (f, ago, over = {}) =>
    writePending(f.home, { version: 1, id: ID, name: "2026-10-27 Pricing talk (Mac Studio)", folder: join(f.root, "Episodes", "2026-10-27 Pricing talk (Mac Studio)"), video: VIDEO, bytes: 13, seconds: 23.4, drop: "/drop", work: "/work", entries: [], lastCopy: NOW - ago, root: f.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt", ...over });
  const holdOf = (f, importing = false) => importHold({ root: f.root, home: f.home, machine: "Mac Studio", record, now: NOW, importing });
  const check = (f, importing, want) => {
    const hold = holdOf(f, importing);
    assert.deepEqual(hold, want);
    rmSync(f.dir, { recursive: true, force: true });
  };
  const RUNNING = (on) => `The import of this episode has not finished on ${on} yet: it is at "Waiting for Dropbox's check of its copies". Say it again when it has.`;
  const NOT_YET = (at) => `This Mac has still to make the check of this episode's copies, due at ${clockAt(at)}. Say "try it again" for ${VIDEO} to have it made then, then say this again.`;
  const OWED = `This Mac has still to make the check of this episode's copies. Say "try it again" for ${VIDEO} to have it made now, then say this again.`;
  const PROBLEM = (on) => `Dropbox found a problem with a copy of this episode: x.srt is not whole in Dropbox. Once it is put right, say "try it again" for ${VIDEO} on ${on}, then say this again.`;

  it("is running while the import of the video is at work on the Mac Studio", () => {
    const f = folders();
    statusOf(f);
    check(f, false, { why: RUNNING("Mac Studio"), waits: true, state: "running" });
  });
  it("is running while the import of the video is at work on Sallie's laptop", () => {
    const f = folders();
    statusOf(f, {}, 0, "Sallie's laptop");
    check(f, false, { why: RUNNING("Sallie's laptop"), waits: true, state: "running" });
  });
  it("is due while this Mac's late check is ahead and its import is at work", () => {
    const f = folders();
    pendingOf(f, 10 * MIN);
    check(f, true, { why: NOT_YET(NOW + 5 * MIN), waits: true, state: "due" });
  });
  it("is due while this Mac's late check is past its time and its import is at work, and does not wait", () => {
    const f = folders();
    pendingOf(f, 35 * MIN);
    check(f, true, { why: OWED, waits: false, state: "due" });
  });
  it("is owed while this Mac's late check is ahead and no import is at work", () => {
    const f = folders();
    pendingOf(f, 10 * MIN);
    check(f, false, { why: NOT_YET(NOW + 5 * MIN), waits: true, state: "owed" });
  });
  it("is owed while this Mac's late check is past its time and no import is at work, and does not wait", () => {
    const f = folders();
    pendingOf(f, 35 * MIN);
    check(f, false, { why: OWED, waits: false, state: "owed" });
  });
  it("is stopped when the status of the import was written 11 minutes ago", () => {
    const f = folders();
    statusOf(f, {}, 11 * MIN);
    check(f, false, { why: `The import of this episode stopped on Mac Studio before the check of its copies was made. On Mac Studio, say "try it again" for ${VIDEO}, then say this again.`, waits: false, state: "stopped" });
  });
  it("is failed when the status of the import says why it failed", () => {
    const f = folders();
    statusOf(f, { failed: "ffmpeg stopped" });
    check(f, false, { why: 'The import of this episode failed on Mac Studio: ffmpeg stopped. Say "try it again" to import it again.', waits: false, state: "failed" });
  });
  it("is a problem when the status of the import says the late check found one", () => {
    const f = folders();
    statusOf(f, { problem: "x.srt is not whole in Dropbox." });
    check(f, false, { why: PROBLEM("Mac Studio"), waits: false, state: "problem" });
  });
  it("is a problem when this Mac's pending late check says it found one", () => {
    const f = folders();
    pendingOf(f, 10 * MIN, { problem: "x.srt is not whole in Dropbox." });
    check(f, false, { why: PROBLEM("Mac Studio"), waits: false, state: "problem" });
  });
  it("is nothing when nothing holds the video", () => {
    const f = folders();
    check(f, false, { why: "", waits: false, state: "" });
  });
  it("says the same whether or not this Mac's import is at work, over a hold that is not this Mac's owed check", () => {
    const rows = [
      [(f) => statusOf(f), { why: RUNNING("Mac Studio"), waits: true, state: "running" }],
      [(f) => statusOf(f, { failed: "ffmpeg stopped" }), { why: 'The import of this episode failed on Mac Studio: ffmpeg stopped. Say "try it again" to import it again.', waits: false, state: "failed" }],
      [(f) => statusOf(f, { problem: "x.srt is not whole in Dropbox." }), { why: PROBLEM("Mac Studio"), waits: false, state: "problem" }],
      [(f) => statusOf(f, {}, 11 * MIN), { why: `The import of this episode stopped on Mac Studio before the check of its copies was made. On Mac Studio, say "try it again" for ${VIDEO}, then say this again.`, waits: false, state: "stopped" }]
    ];
    for (const [set, want] of rows) {
      for (const importing of [false, true]) {
        const f = folders();
        set(f);
        check(f, importing, want);
      }
    }
  });
  it("gives importHolds the same words for a late check this Mac owes", () => {
    const f = folders();
    pendingOf(f, 35 * MIN);
    assert.equal(importHolds({ root: f.root, home: f.home, machine: "Mac Studio", record, now: NOW }), OWED);
    rmSync(f.dir, { recursive: true, force: true });
  });
});

describe("askOnce: how long Claude may take (PR H2)", () => {
  const PRINTED = { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", is_error: false, result: '{"graphicCues": []}' }) };
  /** Claude Code as a stand-in that notes the options it is run with and ends as `ended` says. */
  const asking = (ended = PRINTED) => {
    const seen = [];
    return { seen, deps: { run: async (cmd, args, options) => (seen.push({ cmd, args, options }), ended), tools: { claude: "CLAUDE" } } };
  };
  const folder = () => join(mkdtempSync(join(tmpdir(), "brimm-ask-once-")), "claude-1");
  it("runs Claude Code for ten minutes at most when it is given no limit, as it always did, and says so when it is out of time", async () => {
    const { seen, deps } = asking({ code: 1, stderr: "", signal: "SIGKILL", outOfTime: true, stdout: "" });
    assert.deepEqual(await askOnce("the request", folder(), deps), { why: "it gave no answer in 10 minutes" });
    assert.equal(seen[0].options.limit, 10 * 60 * 1000);
  });
  it("runs it for the limit it is given instead, and says that time when it is out of it: three minutes", async () => {
    const { seen, deps } = asking({ code: 1, stderr: "", signal: "SIGKILL", outOfTime: true, stdout: "" });
    assert.deepEqual(await askOnce("the request", folder(), deps, { limit: 3 * 60 * 1000 }), { why: "it gave no answer in 3 minutes" });
    assert.equal(seen[0].options.limit, 3 * 60 * 1000);
  });
  it("says a limit that is not whole minutes in seconds, and one minute as one minute", async () => {
    const out = { code: 1, stderr: "", signal: "SIGKILL", outOfTime: true, stdout: "" };
    assert.deepEqual(await askOnce("the request", folder(), asking(out).deps, { limit: 90 * 1000 }), { why: "it gave no answer in 90 seconds" });
    assert.deepEqual(await askOnce("the request", folder(), asking(out).deps, { limit: 60 * 1000 }), { why: "it gave no answer in 1 minute" });
  });
  it("runs Claude Code exactly as it is run without a limit but for that: the same arguments, the request on standard input, a folder of its own", async () => {
    const plain = asking();
    const limited = asking();
    const where = folder();
    await askOnce("the request", where, plain.deps);
    await askOnce("the request", where, limited.deps, { limit: 3 * 60 * 1000 });
    assert.deepEqual(limited.seen[0].args, plain.seen[0].args);
    assert.deepEqual({ ...limited.seen[0].options, limit: 0 }, { ...plain.seen[0].options, limit: 0 });
    assert.deepEqual([limited.seen[0].options.input, limited.seen[0].options.cwd], ["the request", where]);
    assert.equal(limited.seen[0].args[limited.seen[0].args.indexOf("--model") + 1], CLAUDE_MODEL);
  });
  it("is given a limit that is none as no limit: the ten minutes stand", async () => {
    for (const limit of [undefined, 0, -1, NaN, "3", null]) {
      const { seen, deps } = asking();
      await askOnce("the request", folder(), deps, { limit });
      assert.equal(seen[0].options.limit, 10 * 60 * 1000, String(limit));
    }
  });
});

// Phase 2, F4: the full import is gone. Every run of the import is the light import: the drop folder's, any watched folder's and a single file's.
describe("the import is always the light import (Phase 2, F4)", () => {
  /** What the light import writes beside a video, each named after it. */
  const LIGHT_ENDINGS = ["cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt", "srt", "transcript.txt", "words.json"];
  it("a single file is imported lightly: its transcript, words, cut plan and the rough cut's captions beside it, and no video, no Final Cut file, no notes and no Reel file", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.deps.rulesOnly = false;
    const file = t.video("talk.mov");
    assert.equal(await doAsked({ file, folders: [], out: "", rulesOnly: false, fromPlan: false, help: false }, t.deps), 0);
    assert.deepEqual(t.names(), ["talk.mov", ...LIGHT_ENDINGS.map((e) => "talk." + e)].sort());
    assert.deepEqual(t.names().filter((n) => /\.(mp4|fcpxml)$|edit-notes|\.reel-/.test(n)), []);
    assert.deepEqual(t.asks, []);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "CLAUDE" || c.cmd === "SWIFT"), []);
    assert.deepEqual(t.guarded, []);
    t.done();
  });
  it("a watched folder that is not the drop folder is imported lightly: the same files, filed away with the video in the folder for the day, and Claude is never asked", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    t.deps.rulesOnly = false;
    t.video("talk.mov");
    const [r] = await uneditedFolder(t.dir, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, "2026-10-13"]);
    assert.deepEqual(t.names(), ["2026-10-13"]);
    assert.deepEqual(t.inside("2026-10-13"), ["talk.mov", ...LIGHT_ENDINGS.map((e) => "talk." + e)].sort());
    assert.deepEqual(t.asks, []);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "CLAUDE" || c.cmd === "SWIFT"), []);
    assert.deepEqual(t.notes, ["The cut plan for talk.mov is ready, in the folder 2026-10-13."]);
    t.done();
  });
  it("--from-plan is gone: it prints that the import makes no videos now, makes and moves nothing, and ends 2, with a file or a folder", async () => {
    const t = setup();
    const file = t.video("talk.mov");
    for (const given of [{ file }, { folders: [t.dir] }, { file, folders: [t.dir] }]) {
      t.logs.length = 0;
      assert.equal(await doAsked({ file: "", folders: [], out: "", rulesOnly: false, help: false, ...given, fromPlan: true }, t.deps), 2);
      assert.deepEqual(t.logs, ["--from-plan is gone: the import makes no videos now."]);
      assert.deepEqual([t.calls, t.names()], [[], ["talk.mov"]]);
    }
    assert.deepEqual(parseArgs(["--from-plan", file]).fromPlan, true);
    assert.equal(parseArgs(["--from-plan", file]).file, file);
    t.done();
  });
});

// --- Phase 3, L3: the import files a video on this Mac ---

describe("an episode filed on a Mac with a drop folder of its own (Phase 3, L3)", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const READY = `Ready: Video of 13 Oct, 10:00 (Mac Studio). In Claude, say "what's waiting?"`;
  const ENDINGS = ALL.map((ending) => `Talk.${ending}`);
  /** The names in a folder, none when it is not there. */
  const namesOf = (folder) => {
    try {
      return readdirSync(folder).sort();
    } catch (e) {
      return [];
    }
  };
  const local = (script = {}) => {
    const t = episodic({ local: true, ...script });
    const statuses = importingFolderOf(t.deps.settings, t.home);
    const video = (folder = FOLDER) => episodeFilesFolder(t.home, folder);
    const sizes = (folder = FOLDER) => namesOf(video(folder)).map((n) => [n, statSync(join(video(folder), n)).size]);
    return { ...t, statuses, video, sizes, record: (folder = FOLDER) => readEpisode(join(t.episodes, folder)).record };
  };

  it("files the recording and everything made of it in video/ on this Mac, at the sizes the record lists, and only the first record in Dropbox", async () => {
    const t = local();
    t.put("Talk.mov");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, FOLDER]);
    assert.deepEqual(namesOf(t.video()), [".import.json", ...ENDINGS].sort());
    const record = t.record();
    assert.deepEqual(record.files, Object.fromEntries(ENDINGS.map((n) => [n, statSync(join(t.video(), n)).size])));
    assert.deepEqual(namesOf(join(t.episodes, FOLDER)), ["record"]);
    assert.deepEqual(namesOf(join(t.episodes, FOLDER, "record")), ["0001.json"]);
    assert.deepEqual([record.version, record.local, record.editing, record.released], [6, { on: "Mac Studio" }, null, null]);
    assert.deepEqual(namesOf(t.drop), []);
    t.done();
  });
  it("posts the Ready banner and takes the drop file away before any wait, and writes no import pending", async () => {
    const t = local();
    t.put("Talk.mov");
    const seen = [];
    const notify = t.deps.notify;
    t.deps.notify = (text) => {
      seen.push([text, t.waits.length, existsSync(join(t.drop, "Talk.mov"))]);
      notify(text);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(seen.map(([text, , there]) => [text, there]), [[READY, false]]);
    assert.equal(seen[0][1], t.waits.length, "no wait comes after the banner");
    assert.deepEqual(t.waits.filter((ms) => ms >= 60000), []);
    assert.deepEqual(namesOf(pendingFolder(t.home)).filter((n) => n.endsWith(".json")), []);
    t.done();
  });
  it("writes its status files in the local importing folder while it runs, none in Episodes/.importing, and takes them away", async () => {
    const t = local();
    t.put("Talk.mov");
    const during = [];
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") during.push([namesOf(t.statuses), existsSync(join(t.episodes, ".importing"))]);
      return run(cmd, args, asked);
    };
    await uneditedFolder(t.drop, t.deps);
    assert.equal(during.length, 1);
    assert.match(during[0][0][0], /^Talk\.mov \(Mac Studio\) \w+ \d+\.json$/);
    assert.equal(during[0][1], false);
    assert.deepEqual(namesOf(t.statuses), []);
    assert.equal(existsSync(join(t.episodes, ".importing")), false);
    assert.ok(t.clones.every(([, to]) => !to.includes("/.importing/")));
    t.done();
  });
  it("calls the record's hook once its work copy is written whole and before it is cloned in, with the files already in video/", async () => {
    const t = local();
    t.put("Talk.mov");
    const calls = [];
    t.deps.onRecordCopy = (entry) => calls.push({ ...entry, there: existsSync(entry.from), cloned: existsSync(entry.to), size: statSync(entry.from).size, video: namesOf(t.video()), drop: existsSync(join(t.drop, "Talk.mov")) });
    await uneditedFolder(t.drop, t.deps);
    assert.equal(calls.length, 1);
    const [call] = calls;
    assert.deepEqual([call.to, call.there, call.cloned, call.bytes === call.size, call.drop], [join(t.episodes, FOLDER, "record", "0001.json"), true, false, true, true]);
    assert.ok(call.from.startsWith(join(t.home, "BRIMM Video Work", ".runs") + "/"), call.from);
    assert.deepEqual(call.video, [".import.json", ...ENDINGS].sort());
    assert.equal(existsSync(call.to), true);
    t.done();
  });
  it("a record that cannot be written leaves the video in the drop folder, nothing in video/, a failed status, and the next run imports it", async () => {
    const t = local();
    t.put("Talk.mov", "the whole video");
    const clone = t.deps.clone;
    t.deps.clone = (from, to) => {
      if (to.endsWith("0001.json")) throw new Error("Dropbox is not there");
      clone(from, to);
    };
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.equal(r.ok, false);
    assert.deepEqual([namesOf(t.drop), statSync(join(t.drop, "Talk.mov")).size], [["Talk.mov"], "the whole video".length]);
    assert.equal(existsSync(t.video()), false, "nothing this run wrote is left in video/, nor the marker");
    const failed = readStatusesIn([t.statuses]).map(({ status }) => status);
    assert.match(failed[0].failed, /^it could not be filed into Episodes: /);
    // retry takes the failed status away, and the next run imports the video.
    removeStatusIn(t.statuses, "Talk.mov", "Mac Studio");
    t.deps.clone = clone;
    const [again] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([again.ok, namesOf(t.drop)], [true, []], t.logs.join("\n"));
    assert.match(again.folder, /^2026-10-13 Talk \(Mac Studio\)(-2)?$/);
    assert.deepEqual(namesOf(episodeFilesFolder(t.home, again.folder)), [".import.json", ...ENDINGS].sort());
    t.done();
  });
  it("two drops of one stem on one day, Episodes unreadable for the second: no work, no status, the drop file stays, and the first video/ is untouched", async () => {
    const t = local();
    t.put("Talk.mov", "the first video");
    await uneditedFolder(t.drop, t.deps);
    const before = t.sizes();
    t.put("Talk.mov", "a second video, longer");
    const calls = t.calls.length;
    chmodSync(t.episodes, 0o000);
    let results;
    try {
      results = await uneditedFolder(t.drop, t.deps);
    } finally {
      chmodSync(t.episodes, 0o755);
    }
    assert.ok(results.length > 0 && results.every((r) => r.ok === false && r.arriving === true), JSON.stringify(results));
    assert.equal(t.calls.length, calls);
    assert.deepEqual(namesOf(t.statuses), []);
    assert.deepEqual(namesOf(t.drop), ["Talk.mov"]);
    assert.deepEqual(t.sizes(), before);
    assert.equal(t.logs.filter((line) => /Episodes could not be read/.test(line)).length >= 1, true, t.logs.join("\n"));
    t.done();
  });
  it("with Episodes unreadable only at the filing step, the import fails with its status, and the first video/ is untouched", async () => {
    const t = local();
    t.put("Talk.mov", "the first video");
    await uneditedFolder(t.drop, t.deps);
    const before = t.sizes();
    t.put("Talk.mov", "a second video, longer");
    const run = t.deps.run;
    t.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") chmodSync(t.episodes, 0o000);
      return run(cmd, args, asked);
    };
    let results;
    try {
      results = await uneditedFolder(t.drop, t.deps);
    } finally {
      chmodSync(t.episodes, 0o755);
    }
    assert.equal(results[0].ok, false);
    const failed = readStatusesIn([t.statuses]).map(({ status }) => status);
    assert.match(failed[0].failed, /^it could not be filed into Episodes: /);
    assert.deepEqual(namesOf(t.drop), ["Talk.mov"]);
    assert.deepEqual(t.sizes(), before);
    assert.equal(existsSync(t.video(`${FOLDER}-2`)), false);
    t.done();
  });
  it("a first record lost, then a drop of the same stem: the new import takes a new name, and the first video/ is untouched", async () => {
    const t = local();
    t.put("Talk.mov", "the first video");
    await uneditedFolder(t.drop, t.deps);
    const before = t.sizes();
    rmSync(join(t.episodes, FOLDER, "record"), { recursive: true });
    t.put("Talk.mov", "a second video, longer");
    const [r] = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual([r.ok, r.folder], [true, `${FOLDER}-2`]);
    assert.deepEqual(t.sizes(), before);
    assert.deepEqual(namesOf(t.drop), []);
    t.done();
  });
  it("a run stopped after the copy and before the record: the next run finds its folder by the marker, on the same day and on a later one", async () => {
    for (const day of ["2026-10-13", "2026-10-20"]) {
      const t = local();
      const file = t.put("Talk.mov");
      t.deps.today = () => day;
      const id = fileId(file);
      const folder = "2026-10-12 Talk (Mac Studio)";
      mkdirSync(t.video(folder), { recursive: true });
      writeFileSync(join(t.video(folder), ".import.json"), JSON.stringify({ import: importIdOf(id), drop: dropIdOf(id) }));
      writeFileSync(join(t.video(folder), "Talk.mov"), "video");
      writeFileSync(join(t.video(folder), "Talk.srt"), "half of the captions");
      const [r] = await uneditedFolder(t.drop, t.deps);
      assert.deepEqual([r.ok, r.folder], [true, folder], day);
      assert.equal(readFileSync(join(t.video(folder), "Talk.srt"), "utf8"), SPELLED);
      assert.deepEqual(namesOf(t.drop), [], day);
      t.done();
    }
  });
  it("a drop file that cannot be deleted stays, held by its episode, in the words the import gives, and is not imported again", async () => {
    const t = local();
    t.put("Talk.mov");
    chmodSync(t.drop, 0o500);
    let first;
    try {
      [first] = await uneditedFolder(t.drop, t.deps);
    } finally {
      chmodSync(t.drop, 0o755);
    }
    assert.equal(first.ok, true);
    assert.deepEqual(namesOf(t.drop), ["Talk.mov"]);
    assert.ok(t.logs.some((line) => /could not be taken out of the drop folder \(EACCES\)\. Delete it there by hand\.$/.test(line)), t.logs.join("\n"));
    const calls = t.calls.length;
    const again = await uneditedFolder(t.drop, t.deps);
    assert.equal(t.calls.length, calls);
    assert.deepEqual(again.map((r) => r.ok), [true]);
    assert.match(again[0].held, /^already imported as Video of 13 Oct, 10:00 \(Mac Studio\) \(.{6}\)\. It stays in the drop folder for you to delete\.$/);
    assert.deepEqual(namesOf(t.episodes).filter((n) => !n.startsWith(".")), [FOLDER]);
    t.done();
  });
  it("a video dropped again under the same name and size is held by its episode, as today", async () => {
    const t = local();
    t.put("Talk.mov");
    await uneditedFolder(t.drop, t.deps);
    t.put("Talk.mov");
    const calls = t.calls.length;
    const again = await uneditedFolder(t.drop, t.deps);
    assert.equal(t.calls.length, calls);
    assert.match(again[0].held, /^already imported as Video of 13 Oct, 10:00 \(Mac Studio\) \(.{6}\)\. It stays in the drop folder for you to delete\.$/);
    assert.deepEqual(namesOf(t.drop), ["Talk.mov"]);
    t.done();
  });
  it("a drop folder in Dropbox: the video is copied out, never renamed, and deleted only after the record is written; a placeholder is read through first", async () => {
    const t = local();
    const dropbox = join(t.root, "Picked");
    mkdirSync(dropbox, { recursive: true });
    t.deps.settings = { ...t.deps.settings, dropPath: dropbox };
    writeFileSync(join(dropbox, "Talk.mov"), "video");
    const at = [];
    const clone = t.deps.clone;
    t.deps.clone = (from, to) => {
      if (to.endsWith("0001.json")) at.push(existsSync(join(dropbox, "Talk.mov")));
      clone(from, to);
    };
    const brought = [];
    t.deps.isWhole = () => brought.length > 0;
    t.deps.bringDown = async (path) => brought.push(path);
    const [r] = await uneditedFolder(dropbox, t.deps);
    assert.deepEqual([r.ok, at, brought, existsSync(join(dropbox, "Talk.mov"))], [true, [true], [join(dropbox, "Talk.mov")], false]);
    assert.equal(statSync(join(t.video(), "Talk.mov")).size, "video".length);
    t.done();
  });
  it("holds a Zoom download as today, with its status in the local folder", async () => {
    const ZOOM = "GMT20261013-142933_Recording_gvo_1280x720.mp4";
    const HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";
    const t = local();
    t.put(ZOOM);
    const results = await uneditedFolder(t.drop, t.deps);
    assert.deepEqual(results.map((r) => [r.ok, r.name, r.held]), [[true, ZOOM, HELD]]);
    assert.deepEqual(namesOf(t.drop), [ZOOM]);
    assert.deepEqual(readStatusesIn([t.statuses]).map(({ status }) => [status.video, status.held]), [[ZOOM, HELD]]);
    assert.equal(existsSync(join(t.episodes, ".importing")), false);
    assert.equal(t.calls.length, 0);
    t.done();
  });
  it("another Mac's import still holds a reading here: its status in Episodes/.importing is read beside the local folder", () => {
    const t = local();
    const NOW = Date.parse("2026-10-13T10:00:00");
    const text = (to, body) => {
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, body);
    };
    writeStatusIn(join(t.episodes, ".importing"), { version: 1, machine: "Jason's MacBook", pid: 9, import: "zz", video: "Talk.mov", bytes: 5, seconds: 2, step: "Reading the sound", at: new Date(NOW).toISOString() }, text);
    const record = { id: "e-20261013-3fa9c1", video: { file: "Talk.mov", bytes: 5 } };
    const hold = (folders) => importHold({ root: t.root, statusFolders: folders, home: t.home, machine: "Mac Studio", record, now: NOW }).state;
    assert.equal(hold(statusFoldersOf(t.deps.settings, t.home)), "running");
    assert.equal(hold([t.statuses]), "");
    t.done();
  });
});
