#!/usr/bin/env node
// For an unedited video: writes a transcript with a time for every word, and a cut plan that suggests what to take out
// (retakes, false starts, spoken cues to start over, long pauses). Claude is then asked to read the plan: it may change what
// is cut, it writes notes for the person who edits the video, and it picks short clips. From the plan come a rough cut to
// watch, captions that match the rough cut, an upright version of the rough cut for Instagram, when the video is wider than
// it is tall, a Final Cut Pro project file with the same cuts made on its timeline, and the short clips.
//
// The video and its sound never leave this Mac. When Claude is asked, the words of the transcript with their times and the
// rules' plan are sent to Claude through Claude Code, on the Claude account signed in on this Mac. The video's file name and
// its length go with them. --rules-only keeps everything on the Mac.
//
//   node unedited.js <file>             one video: its files appear beside it, and nothing is moved
//   node unedited.js --watch <folder>   every video in the folder that has no cut plan yet, then stop. Each one is then moved,
//                                       with its files, into a new folder there named for the day
//   options:  --watch <folder>   again, to work more than one folder
//             --out <folder>     where to write, for one file
//             --rules-only       never ask Claude: the plan is the rules' alone, and there are no notes and no clips
//             --from-plan        make the videos of one video again from the cut plan an earlier run wrote beside it: the
//                                rough cut, its upright version and the clips Claude picked, as the tool writes videos now.
//                                No transcript is made, Claude is not asked, and no other file is touched
//
// The files, each named after the video: <name>.srt and <name>.transcript.txt as the transcript tool writes them,
// <name>.words.json, <name>.cut-plan.json and <name>.cut-plan.txt, <name>.rough-cut.mp4, <name>.rough-cut.srt and
// <name>.rough-cut.transcript.txt, <name>.rough-cut.vertical.mp4, and <name>.fcpxml. And when Claude has read the plan:
// <name>.edit-notes.txt, and for each clip it picked <name>.reel-<n>.mp4 with its captions, <name>.reel-<n>.srt, and
// <name>.reel-<n>.story-<k>.mp4 for each part of a Story of more than a minute. The cuts are suggested by rules (cuts.js)
// and by Claude (notes.js), which reads the words and never sees the picture. All of them are for a person to check.
// Each file is written whole in the run's own folder, among the Mac's temporary files, and only then moved where it belongs,
// under its own name. So a folder that syncs to a cloud drive never sees a file half written, and never sees one renamed.
//
// ffprobe reads the file's facts. ffmpeg takes the sound out, finds the pauses, and makes the rough cut, the upright version
// and the clips. whisper.cpp writes the captions and the time of every word. They are the transcript tool's programs, and
// install.sh sets them up. swift, which comes with Xcode's command line tools, runs faces.swift to find the speaker's face for
// the upright version and the clips: without it they are cropped at the centre of the picture. claude is Claude Code:
// without it, or when Claude cannot be reached, the plan is the rules' alone. Final Cut Pro is never opened from here.
// While it works, it says how far it has got in a small file on this Mac's own disk (progress.js), and swift runs
// progress.swift to show that in a small window: closing the window, or its failing to open, changes nothing about the work.
// "install.sh <folder>" has the Mac run the --watch form whenever something lands in that folder.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay, stamp } from "./shared/text.js";
import { dayFolder, ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount, captionsOf, settled } from "./lib.js";
import { runProgram, findTools, lockFile, takeLock, isRunning, lastLine, sizeOnDisk } from "./run.js";
import { probeArgs, factsOf, framesASecond, wordArgs, pauseArgs, wordsOf, pausesOf, phrasesOf, cutPlan, cutReason, planText, keptSpans, roughRate, roughCutArgs, roughCaptions, cutOutputs, clipOutputs, clipFiles, waitingToCut } from "./cuts.js";
import { notesRequest, readNotes, applyDecisions, clipRanges, notesText } from "./notes.js";
import { stillsArgs, needsReframe, cropsFor, verticalArgs, STORY_MAX } from "./reframe.js";
import { fcpxml, checkFcpxml, relativeUrl } from "./fcpxml.js";
import { reporter, progressFolder, noProgress } from "./progress.js";
import { isWhole, readThrough, textWriter } from "./dropbox.js";
import { episodeMode, episodeKind, fileEpisode, statusReporter, importEpisodes, writePending, dueAt, fileId, importIdOf } from "./filing.js";
import { readSettings, runsFolder } from "./settings.js";

/** How often a file's size is looked at while it arrives, and how many looks before it is left for the next time. They are the
    transcript tool's own numbers. */
const LOOK_MS = 5000;
const MAX_LOOKS = 120;

/** Final Cut Pro cannot keep a library in a folder that syncs to a cloud drive, and on this Mac the Movies folder does. So
    the Final Cut file names a library in the home folder itself: this folder there, and this library in it. Final Cut Pro
    makes the library the first time such a file is opened. */
const LIBRARY = join("BRIMM Video Work", "BRIMM rough cuts.fcpbundle");

/** The face finder, which swift runs, and how much of what it prints is read. It prints a line for each still, and there is a
    still for every two seconds, so a whole day of video is well within this. */
const FACES = fileURLToPath(new URL("./faces.swift", import.meta.url));
const FACES_PRINTED = 20000000;

/** The Claude model a plan is read with. It is named, and not left to the account's default, so that both Macs pick the same
    clips and Reels for the same plan, and a change of the account's default does not change what is picked. */
export const CLAUDE_MODEL = "claude-opus-5-5";

/** What Claude Code is run with, so that it answers once, with the model named above, and does nothing else: it prints and stops, has none of its own
    tools and no skills, saves no session, and reads no settings file, this user's or a project's. It then prints one JSON
    object, in which `result` holds Claude's text and `is_error` is false when it worked. The request is never among
    these: it goes in on standard input. Tried by hand on this Mac on 2026-10-13, from a shell and from a launch agent, on
    the Claude account signed in here, with no key.
    --strict-mcp-config keeps out every tool server (MCP) that is set up for this user in Claude Code: by Claude Code's own
    help it uses only the servers named with --mcp-config, and none is named here. The words of a recording are a
    stranger's text as far as Claude is concerned, so it is given nothing it could act with. Asked on this Mac on
    2026-10-13, with these arguments, which tools it had, Claude answered none. */
const CLAUDE_ARGS = ["-p", "--model", CLAUDE_MODEL, "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--setting-sources", "", "--output-format", "json"];
/** How long Claude may take over one plan before Claude Code is stopped: ten minutes. On 2026-10-13 the plan of a recording
    of 58 seconds took 19 seconds. */
const CLAUDE_MS = 10 * 60 * 1000;
/** How many times Claude is asked before the plan is left as the rules made it, and how long is waited between two tries. On
    2026-10-13 one call failed because the sign-in had run out and could not be refreshed, and the next one worked. */
const CLAUDE_TRIES = 2;
const AGAIN_MS = 3000;
/** How much of what Claude Code prints is read. It prints its answer and nothing else, and a reply is a few thousand
    characters, so this is all of it. */
const CLAUDE_PRINTED = 2000000;

/** Are Xcode's command line tools on this Mac? xcode-select says where they are, and ends badly when they are nowhere. The
    installer asks it the same. */
const hasXcodeTools = () => spawnSync("/usr/bin/xcode-select", ["-p"], { stdio: "ignore" }).status === 0;

/** Where the programs are on this Mac: the transcript tool's own, ffprobe, swift and claude. ffprobe is installed with ffmpeg,
    so it is looked for beside ffmpeg first, and then where ffmpeg itself is looked for. swift comes with Xcode's command
    line tools, in /usr/bin. A file of that name is there on every Mac: until the tools are installed it is macOS's own
    stand-in, which finds no face and puts up a window offering to install them. So swift counts as found only when
    `xcodeTools` says the tools are here. claude is Claude Code, which Claude is asked through. It is looked for where the
    other programs are, and then in .local/bin in the home folder, where its own installer puts it: the launch agent's PATH
    has no home folder in it. `missing` says what is not there, in plain words. swift and claude are never among it: without
    swift the work goes on, and the upright version is cropped at the centre of the picture, and without claude the cut
    plan is the rules' alone. */
export function findPrograms(given = {}) {
  const { exists = existsSync, env = process.env, xcodeTools = hasXcodeTools } = given;
  const found = findTools(given);
  const path = String(env.PATH || "").split(":").filter(Boolean);
  const dirs = [...(found.ffmpeg ? [dirname(found.ffmpeg)] : []), ...path, "/opt/homebrew/bin", "/usr/local/bin"];
  const ffprobe = dirs.map((dir) => join(dir, "ffprobe")).find((file) => exists(file)) || "";
  const named = [...path, "/usr/bin"].map((dir) => join(dir, "swift")).find((file) => exists(file)) || "";
  const swift = named && xcodeTools() ? named : "";
  const claude = [...path, "/opt/homebrew/bin", "/usr/local/bin", join(env.HOME || homedir(), ".local", "bin")].map((dir) => join(dir, "claude")).find((file) => exists(file)) || "";
  return { ...found, ffprobe, swift, claude, missing: ffprobe ? found.missing : [...found.missing, "ffprobe is not installed. It comes with ffmpeg."] };
}

/** The name of the folder a video in a watched folder would be filed in now: the first one free for the day. "" when the
    folder cannot be read. The move then finds the same, and says so. */
function dayFor(dir, { today = () => localDay() }) {
  try {
    return dayFolder(readdirSync(dir), today());
  } catch (e) {
    return "";
  }
}

/** Put a file that is whole, at `from` in the run's own folder, where it belongs, at `to`: one move, so that it appears there
    whole, under its own name, and is never renamed there. A file of that name there already is replaced by it. A folder that
    syncs to a cloud drive may still be sending a file when it is renamed there, and on 2026-10-14 Dropbox undid two such
    renames, of large videos: they stayed under the names they had been written under. When the two folders are on different
    disks the file cannot be moved, and it is copied there under its own name, and deleted from the run's folder: `say`, the
    log, says so. A copy that fails leaves nothing under that name. Then the file is looked for under its name, and `say`
    says so plainly when it is not there. Throws when the file is not where it belongs. `move` and `copy` are how a file is
    moved and copied, for a test to give others. */
function put(from, to, { say, move = renameSync, copy = copyFileSync }) {
  try {
    move(from, to);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    try {
      copy(from, to);
    } catch (failed) {
      try {
        rmSync(to, { force: true });
      } catch (stays) {
        // What is there is not a file, and nothing was copied into it.
      }
      throw failed;
    }
    rmSync(from, { force: true });
    say(`${basename(to)} could not be moved from the run's own folder into ${dirname(to)}, which is on another disk, so it was copied there, and deleted from the run's folder.`);
  }
  if (!existsSync(to)) {
    say(`${basename(to)} was moved into ${dirname(to)}, but there is no file of that name there now.`);
    throw new Error("no file is there under its name after the move");
  }
}

/** The files one run makes of the video `name`. Each is written whole in the folder "made" in the run's own folder, `work`,
    under its own name, and only then put where it belongs (see put). `at` says where the file that belongs at `to` is
    written. `done` is said of it when it is whole: it is put in place then, or, with `hold`, it is held in the run's folder,
    for the run to file it away with the video (see fileAway). `text` writes a text file whole there, and has it done. `put`
    puts a file in place now: where it belongs, or at `where`. `has` says whether a file was made, where it belongs or held. */
function filesOf(work, { name, hold = false, log = () => {}, move, copy }) {
  const folder = join(work, "made");
  mkdirSync(folder, { recursive: true });
  const at = (to) => join(folder, basename(to));
  const now = (to, where = to) => put(at(to), where, { say: (line) => log(`${name}: ${line}`), move, copy });
  const done = (to) => {
    if (!hold) now(to);
  };
  const text = (to, written) => {
    writeFileSync(at(to), written);
    done(to);
  };
  return { at, done, text, put: now, has: (to) => existsSync(hold ? at(to) : to) };
}

/** File a finished video away, with the files made of it, in a new folder in the watched folder named for the day, as the
    transcript tool files a video. The video is moved first: a run cut short part-way then never leaves it in the watched
    folder to be done a second time. It is the one file renamed in the watched folder, and it has been whole there since
    before the run began. The files `made` of it were held in the run's own folder (see filesOf), and each is put straight
    into the new folder after it, so that it appears there whole. `day` is the folder's name when it was worked out already,
    as it is for a video whose Final Cut file names it there. When the video cannot be moved it stays where it is, `stayed`
    is called, and its files are put beside it. When a file cannot be put in the new folder, it and the ones after it are
    put in the watched folder instead. The log says which, and says so of a file that could not be put there either.
    Returns the new folder's name when every file is in it, and "" otherwise. */
function fileAway(dir, file, made, deps, day, stayed) {
  const { log = () => {}, today = () => localDay(), move = renameSync, files } = deps;
  const name = basename(file);
  /** Put files in the watched folder, beside where the video was. */
  const beside = (list) => {
    for (const to of list) {
      try {
        files.put(to, join(dir, basename(to)));
      } catch (e) {
        log(`${name}: ${basename(to)} could not be put in the watched folder (${e.code || e.message}), and was not kept.`);
      }
    }
  };
  let into = "";
  try {
    const folder = day || dayFolder(readdirSync(dir), today());
    mkdirSync(join(dir, folder));
    into = join(dir, folder);
    move(file, join(into, name));
  } catch (e) {
    // The folder made for it is empty, and is not left behind in a folder that may sync to other people.
    try {
      if (into) rmdirSync(into);
    } catch (stays) {
      // Something is in it by now, so it is left.
    }
    log(`${name}: could not be moved into a folder for the day (${e.code || e.message}), so it stays in the watched folder, and its files are put beside it there.`);
    stayed();
    beside(made);
    return "";
  }
  for (const [k, to] of made.entries()) {
    try {
      files.put(to, join(into, basename(to)));
    } catch (e) {
      log(`${name}: moved into "${basename(into)}", but not all of its files could be put there (${e.code || e.message}). Put in the watched folder instead: ${made.slice(k).map((f) => basename(f)).join(", ")}.`);
      beside(made.slice(k));
      return "";
    }
  }
  log(`${name}: moved with its files into "${basename(into)}".`);
  return basename(into);
}

/** The files of the short clips that an earlier run cut of a video, where this run writes its own, and the ones a run that
    was killed left half written there. None when the folder cannot be read: then nothing can be written there either, and
    the run says so soon enough. */
function oldClips(out) {
  const folder = dirname(out.plan);
  try {
    return clipFiles(readdirSync(folder), out.base).map((n) => join(folder, n));
  } catch (e) {
    return [];
  }
}

/** Why a program ended badly, in plain words. One that was killed gave no reason, and the last thing it printed is about
    something else. */
const reasonOf = (ended) => (ended.signal ? `it was killed by ${ended.signal}` : lastLine(ended.stderr));

/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

/** A text with a capital for its first letter. */
const capital = (text) => text[0].toUpperCase() + text.slice(1);
/** A sentence as a part of another: without its full stop, and without its capital, unless it opens with Claude's name or
    with a quoted word. And a part made a sentence of its own. */
const clause = (whole) => {
  const said = String(whole).replace(/\.$/, "");
  return !said || /^(Claude|")/.test(said) ? said : said[0].toLowerCase() + said.slice(1);
};
const sentence = (part) => `${capital(part)}.`;

/** The steps of the work on one video, as the progress panel counts them: Claude is asked (`claude`), there is an upright
    version to make (`wide`), there are clips to cut (`clips`), and the video is filed away after (`watched`). */
const stepsFor = ({ claude, wide, clips, watched }) => [
  "Reading the sound", "Writing the transcript", "Making the cut plan", ...(claude ? ["Asking Claude"] : []), "Making the rough cut",
  ...(wide ? ["Finding the faces", "Making the upright version"] : []), ...(clips ? ["Cutting the short clips"] : []), ...(watched ? ["Filing"] : [])
];

/** The seconds that stretches of a video come to. */
const secondsIn = (stretches) => stretches.reduce((sum, s) => sum + (s.end - s.start), 0);

/** The words with their times, the pauses ffmpeg heard and the cut plan the rules make, or `why` there is none. `probe` is what
    ffprobe ended with, `told` is the file the transcriber wrote its times into, `untimed` says why it wrote none, and `silent`
    is the long silences. */
async function planFor({ facts, probe, told, untimed, silent, wav }, { run, tools }) {
  if (!facts) return { why: `the file's length and picture could not be read (${lastLine(probe.stderr)})` };
  if (untimed) return { why: untimed };
  // A file's clock starts with whichever of its picture and its sound comes first. The transcriber and ffmpeg count from the
  // start of the sound, so their times are moved on by as much as the sound starts after the picture.
  const shift = Math.max(0, facts.soundStart);
  let words = [];
  try {
    words = wordsOf(JSON.parse(readFileSync(told, "utf8")), { silent, shift });
  } catch (e) {
    // The file is not there or cannot be read, and that leaves no words.
  }
  if (!words.length) return { why: "the transcriber wrote no times for the words" };
  // Every line of what ffmpeg prints is needed here too. The pauses are looked for to the end of the recording, which may
  // go on after its sound has ended.
  const heard = await run(tools.ffmpeg, pauseArgs(wav, facts.duration - shift), { keep: 1000000 });
  if (heard.code !== 0) return { why: `the pauses could not be found (${lastLine(heard.stderr)})` };
  const pauses = pausesOf(heard.stderr, shift);
  return { words, pauses, plan: cutPlan(phrasesOf(words, pauses), { duration: facts.duration, pauses }) };
}

/** Did Claude's reply, as readNotes read it, give nothing at all: no decision, no notes, no idea, no clip, and something
    wrong with it? A reply that finds the rules right and has nothing to add is whole, and is not one of these. */
const nothingIn = (read) => !read.decisions.length && !read.notes && !read.graphics.length && !read.clips.length && read.problems.length > 0;

/** Ask Claude once, through Claude Code, run in `folder`: {read}, its reply as readNotes read it, or {why} there is none. It
    counts as no reply when Claude Code ran out of time, said it could not get an answer, ended badly, or printed something
    that is not its answer, and when nothing could be read from what Claude wrote. */
async function askOnce(request, folder, { run, tools }) {
  mkdirSync(folder, { recursive: true });
  const ended = await run(tools.claude, CLAUDE_ARGS, { input: request, cwd: folder, limit: CLAUDE_MS, out: CLAUDE_PRINTED });
  if (ended.outOfTime) return { why: `it gave no answer in ${CLAUDE_MS / 60000} minutes` };
  let told = null;
  try {
    told = JSON.parse(ended.stdout);
  } catch (e) {
    // It is not JSON, and the lines below say so.
  }
  // When Claude Code could not get an answer it says so in what it prints, and says why there, whatever it ends with.
  if (told && told.is_error === true) return { why: `Claude Code gave an error (${lastLine(typeof told.result === "string" ? told.result : "")})` };
  if (ended.code !== 0) return { why: `Claude Code stopped (${reasonOf(ended)})` };
  if (!told || told.is_error !== false || typeof told.result !== "string") return { why: "what Claude Code printed could not be read" };
  const read = readNotes(told.result);
  return nothingIn(read) ? { why: read.problems.map(clause).join("; ") } : { read };
}

/** Have Claude read the rules' plan of a video: {read}, its reply as readNotes read it, or {why} it could not be asked. Claude
    is sent what notesRequest writes and nothing else: the words with their times and what the rules decided, and never the
    video or its sound. A try that fails, however it fails, is followed by one more after a short wait, and the log says why
    each of them failed. Each try runs in a new, empty folder in the run's own, so that Claude Code finds no file of a
    project there. Claude Code keeps a folder of its own for every folder it is run in, under .claude/projects in the home
    folder, named after that folder's path. So each try leaves one there, with an empty folder named memory in it and
    nothing of the request or the reply: the one run with the real Claude, on 2026-10-13, left one. The run's own folder
    is taken away when the run ends, and that one stays: nothing under .claude is ever deleted from here.
    Nothing is thrown from here: whatever goes wrong costs Claude's read and nothing else. */
async function askClaude(name, plan, facts, work, deps) {
  const { log = () => {}, wait } = deps;
  const request = notesRequest(plan, { video: name, duration: facts.duration });
  log(`${name}: asking Claude to read the cut plan.`);
  let why = "";
  for (let n = 1; n <= CLAUDE_TRIES; n++) {
    if (n > 1) await wait(AGAIN_MS);
    const got = await askOnce(request, join(work, `claude-${n}`), deps).catch((e) => ({ why: `the work stopped (${e.code || e.message})` }));
    if (got.read) return got;
    why = got.why;
    log(`${name}: Claude could not be asked (${why})${n < CLAUDE_TRIES ? ". It is asked once more." : ", so the cut plan is the rules' alone."}`);
  }
  return { why };
}

/** Make the rough cut of a video from the kept ranges of its plan. Resolves "" when it is made, or why it is not. It is
    written whole in the run's own folder and then put where it belongs, as every other file is. */
async function roughCut(file, to, { plan, facts, spans }, { run, tools, files, log = () => {}, progress = noProgress }) {
  if (!facts.height) return "there is no picture in the file";
  if (!spans.length) return "the plan keeps nothing";
  log(`${basename(file)}: making the rough cut.`);
  progress.step("Making the rough cut");
  const writing = files.at(to);
  // ffmpeg says how far it has got, for the progress panel. Without a panel it is given nothing more.
  const watch = progress.encoding(secondsIn(spans));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...roughCutArgs(file, writing, { ranges: plan.ranges, fps: roughRate(facts) })]);
  } finally {
    watch.stop();
  }
  if (made.code !== 0 || !existsSync(writing)) {
    rmSync(writing, { force: true });
    return `ffmpeg stopped (${lastLine(made.stderr)})`;
  }
  files.done(to);
  return "";
}

/** Is this what the face finder prints: a list of stills, each with its file's name and a box for each face in it? */
const isStills = (told) => Array.isArray(told) && told.every((still) => still && typeof still.file === "string" && Array.isArray(still.faces)
  && still.faces.every((box) => box && [box.x, box.y, box.w, box.h].every((n) => Number.isFinite(n))));

/** Where the faces are in a video: {stills}, what the face finder printed for stills of it, or {why} they could not be looked
    for. The stills go into the run's own folder `work`, which is taken away when the run ends. */
async function facesIn(file, work, { run, tools }) {
  if (!tools.swift) return { why: "swift, which finds the faces, is not installed" };
  const folder = join(work, "stills");
  mkdirSync(folder, { recursive: true });
  const cut = await run(tools.ffmpeg, stillsArgs(file, folder));
  if (cut.code !== 0) return { why: `the stills to look in could not be made (${lastLine(cut.stderr)})` };
  // What the face finder prints is its answer, so that is kept, whole.
  const found = await run(tools.swift, [FACES, folder], { out: FACES_PRINTED });
  if (found.code !== 0) return { why: `the face finder stopped (${reasonOf(found)})` };
  try {
    const stills = JSON.parse(found.stdout);
    if (isStills(stills)) return { stills };
  } catch (e) {
    // It is not JSON, and the line below says so.
  }
  return { why: "what the face finder printed could not be read" };
}

/** A time written to the thousandth of a second below it. */
const below = (t) => Math.floor(t * 1000) / 1000;

/** Stretches of a video as ffmpeg is given them, when the stretches are the rough cut's own, each end on a whole picture.
    ffmpeg gives a picture to the stretch whose start it comes at or after. A stretch starts and ends on a picture's own
    time, which has more decimals than ffmpeg is given. Written to the thousandth of a second above it, a start would lose
    the stretch its first picture and an end would give it one more. Written to the one below, each stretch holds the
    pictures the rough cut holds, and captions timed as the rough cut's are fit it too. That is so of a video whose pictures
    come at an even rate and whose sound starts with its picture. The rough cut puts every picture on an even grid and the
    sound on the file's clock, and what is made of these stretches keeps the video's own. So of any other video it comes
    out a little longer than the rough cut, and the captions run ahead of it by the end. Tried on ffmpeg 9 with made-up
    videos and 40 cuts: 0.43 seconds longer with two pictures in every nine missing, and 0.2 with sound that starts half a
    second late. */
const stretches = (spans) => spans.map((span) => ({ start: below(span.start), end: below(span.end) }));

/** Have ffmpeg write stretches of a video, joined, as one file at `to`: each with its crop, and the whole made 1080 by 1920,
    or with no crops for a video that keeps its shape. Resolves "" when the file is made, or why it is not. It is written
    whole in the run's own folder and then put where it belongs, as every other file is. */
async function joined(file, to, { ranges, crops }, { run, tools, files, progress = noProgress }) {
  const writing = files.at(to);
  const watch = progress.encoding(secondsIn(ranges));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...verticalArgs({ video: file, ranges, crops, out: writing })]);
  } finally {
    watch.stop();
  }
  if (made.code !== 0 || !existsSync(writing)) {
    rmSync(writing, { force: true });
    return `ffmpeg stopped (${lastLine(made.stderr)})`;
  }
  files.done(to);
  return "";
}

/** Make the upright version of a video for Instagram: its kept stretches as the rough cut takes them, each with one fixed crop
    placed on the speaker's face, and the whole made 1080 by 1920. Resolves `why` it could not be made, which is "" when it
    was. When the faces could not be looked for, every stretch is cropped at the centre of the picture, the log says so, and
    `centred` is the reason. `stills` is what the face finder said of the video, for the short clips to be cropped by: the
    faces are looked for once. Nothing is thrown from here, so a failure costs this file and no other. */
async function upright(file, to, { facts, spans }, work, deps) {
  const { log = () => {}, progress = noProgress } = deps;
  const name = basename(file);
  let seen = {};
  try {
    log(`${name}: making the upright version.`);
    progress.step("Finding the faces");
    seen = await facesIn(file, work, deps).catch((e) => ({ why: `the work stopped (${e.code || e.message})` }));
    if (seen.why) log(`${name}: the faces could not be looked for (${seen.why}), so the upright version is cropped at the centre of the picture.`);
    const ranges = stretches(spans);
    const crops = cropsFor(facts, ranges, seen.stills || []);
    const guessed = crops.filter((crop) => !crop.found).length;
    if (seen.stills && guessed) {
      log(seen.stills.some((still) => still.faces.length) ? `${name}: no face was found in ${guessed} of the ${crops.length} kept stretches, so the crop of the whole video is used there.`
        : `${name}: no face was found in the video, so the upright version is cropped at the centre of the picture.`);
    }
    progress.step("Making the upright version");
    return { why: await joined(file, to, { ranges, crops }, deps), centred: seen.why || "", stills: seen.stills || [] };
  } catch (e) {
    rmSync(deps.files.at(to), { force: true });
    return { why: `the work stopped (${e.code || e.message})`, centred: seen.why || "", stills: seen.stills || [] };
  }
}

/** Stretches as keptSpans gives them, cut down to hold `most` seconds at most. Each end of a stretch was moved to the nearest
    whole picture, and that can leave the stretches a picture or two longer than they were given: 60 seconds of a video
    of 29.97 pictures a second can come out as 1799 pictures, which is 60.027 seconds. What they hold over `most`, in
    whole pictures, is taken off their end. */
function noLonger(spans, most, fps) {
  const rate = framesASecond(fps);
  const pictures = (span) => Math.round((span.end - span.start) * rate);
  let over = spans.reduce((sum, span) => sum + pictures(span), 0) - Math.floor(most * rate);
  const held = spans.slice();
  while (over > 0 && held.length) {
    const last = held.pop();
    const left = pictures(last) - over;
    if (left > 0) held.push({ ...last, end: (Math.round(last.start * rate) + left) / rate });
    over -= pictures(last);
  }
  return held;
}

/** One file made of stretches of a video, each a {start, end} in seconds: a short clip, or a part of its Story. Each edge is
    moved to the nearest whole picture, as the rough cut's are, and the file is made as the upright version is. Of a video
    that is wider than it is tall, each stretch is cropped on the speaker by `stills`, what the face finder said of the
    video, and the whole is made 1080 by 1920. With no stills that is the centre of the picture. A video that is upright or
    square already keeps its shape. `most` is how many seconds the file may hold, for a part of a Story: the whole
    pictures over that are left off its end, and are in no part. Resolves {spans}, the stretches as they were taken, each
    with the moment it starts in the file, or {why} the file could not be made. Nothing is thrown from here, so a failure
    costs this file and no other. */
async function cutPiece(file, to, given, { facts, stills, most = 0 }, deps) {
  try {
    if (!facts.height) return { why: "there is no picture in the file" };
    const whole = keptSpans(given.map((range) => ({ ...range, keep: true })), roughRate(facts));
    const spans = most ? noLonger(whole, most, roughRate(facts)) : whole;
    if (!spans.length) return { why: "it is shorter than one picture" };
    const ranges = stretches(spans);
    const why = await joined(file, to, { ranges, crops: needsReframe(facts) ? cropsFor(facts, ranges, stills) : null }, deps);
    return why ? { why } : { spans };
  } catch (e) {
    rmSync(deps.files.at(to), { force: true });
    return { why: `the work stopped (${e.code || e.message})` };
  }
}

/** Cut the short clips Claude picked, each as clipRanges gives it. For each clip, in turn: the whole clip, which is its
    ranges with what the plan cuts between them left out, then its captions on the clip's own clock, and then each part of
    its Story, when the Story has more than one. Resolves, for each clip, {clip, files, failed}: the files that were made,
    and what could not be made and why, each as the log says it. A clip that could not be cut has no captions and no Story,
    and the clips after it are cut all the same. A clip is cut whether or not it fits a Reel: the notes say when it does
    not. Nothing is burned into the picture: this Mac's ffmpeg has no filter for captions, so they come as a file. */
async function cutClips(file, clips, { plan, facts, stills }, deps) {
  const { progress = noProgress } = deps;
  const cut = [];
  for (const [i, clip] of clips.entries()) {
    progress.step("Cutting the short clips", `Cutting short clip ${i + 1} of ${clips.length}`);
    const out = clipOutputs(file, clip.n, clip.story.length, deps.outDir || undefined);
    const files = [];
    const failed = [];
    const whole = await cutPiece(file, out.video, clip.ranges, { facts, stills }, deps);
    if (whole.why) failed.push(`clip ${clip.n} could not be cut: ${whole.why}`);
    else {
      files.push(out.video);
      try {
        // The captions are the kept phrases of the clip, placed as the rough cut's captions are placed in the rough cut. A
        // phrase is the clip's when some of it lies in the clip. The transcriber may time the last words past the end of the
        // file, which is where the clip ends: such a time is placed at the clip's end.
        deps.files.text(out.srt, roughCaptions(plan.phrases.filter((p) => p.keep && p.start < clip.end && p.end > clip.start), whole.spans));
        files.push(out.srt);
      } catch (e) {
        failed.push(`the captions of clip ${clip.n} could not be written: the work stopped (${e.code || e.message})`);
      }
      for (const [k, to] of out.story.entries()) {
        const part = await cutPiece(file, to, clip.story[k].ranges, { facts, stills, most: STORY_MAX }, deps);
        if (part.why) failed.push(`part ${k + 1} of the Story of clip ${clip.n} could not be cut: ${part.why}`);
        else files.push(to);
      }
    }
    cut.push({ clip, files, failed });
  }
  return cut;
}

/** What ffprobe wrote of the file's sound, as the Final Cut file says it: how many channels it has, and its samples a second.
    Either is left out when ffprobe does not say. */
function soundOf(printed) {
  try {
    const sound = JSON.parse(printed).streams.find((stream) => stream.codec_type === "audio") || {};
    return { audioChannels: Number(sound.channels) || undefined, audioRate: Number(sound.sample_rate) || undefined };
  } catch (e) {
    return {};
  }
}

/** The notes for the editor, one for each join: how much was taken out there and why, in the plan's own words. What is cut
    with nothing kept in between is one join, and has one note. A note is given the moment its cut starts, and the Final Cut
    writer puts it on the first picture after the join. */
function joinNotes(ranges) {
  const notes = [];
  let open = null;
  for (const range of ranges) {
    if (range.keep) open = null;
    else {
      if (!open) notes.push(open = { at: range.start, gone: 0, why: [] });
      open.gone += range.end - range.start;
      open.why.push(capital(cutReason(range)));
    }
  }
  return notes.map((note) => ({ at: note.at, text: `Taken out, ${note.gone.toFixed(1)} seconds. ${note.why.join(". ")}` }));
}

/** Claude's ideas for graphics as notes for the Final Cut file: one for each idea that sits on a kept phrase of the plan, at
    the moment that phrase starts, worded so that nobody takes it for more than an idea. An idea whose phrase is cut, or is
    not in the plan, gets none: the Final Cut writer would put it on the join after it, as if it belonged there. The notes
    for the editor say what became of such an idea. */
function ideaNotes(plan, graphics) {
  const phrases = new Map(plan.phrases.map((p) => [p.id, p]));
  return graphics.map((idea) => ({ on: phrases.get(idea.id), idea: idea.idea })).filter(({ on }) => on && on.keep).map(({ on, idea }) => ({ at: on.start, text: `Graphic idea: ${idea}` }));
}

/** The Final Cut file of a plan, for the video at `video`: {text}, or {why} there is none. The kept ranges are its pieces, the
    captions are those of the whole recording on its own timing, and there is a note at each join. `ideas` are more notes,
    Claude's ideas for graphics, each at a moment that is kept. The captions keep the timing of the sound, so when the sound
    starts after the picture they are moved on as the words are. `library` is where Final Cut Pro is to keep the project,
    and `writer` is what writes the file's text. The text is checked before it is given back, and one with something wrong
    in it is not: `why` then says what. */
function finalCut(video, { plan, facts, spans, srt, printed, ideas = [] }, { library, src, writer = fcpxml }) {
  if (!facts.height) return { why: "there is no picture in the file" };
  if (!spans.length) return { why: "the plan keeps nothing" };
  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...soundOf(printed) };
  const shift = Math.max(0, facts.soundStart);
  try {
    const captions = captionsOf(srt).map((caption) => ({ ...caption, start: caption.start + shift, end: caption.end + shift }));
    const text = writer({ video, facts: said, ranges: plan.ranges.filter((range) => range.keep), captions, markers: [...joinNotes(plan.ranges), ...ideas], library: library || undefined, ...(src ? { src } : {}) });
    const wrong = checkFcpxml(text, said);
    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
  } catch (e) {
    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
  }
}

async function workOn(file, deps) {
  const { run, tools, model, log = () => {}, notify = () => {}, wait, sizeOf = sizeOnDisk } = deps;
  let progress = deps.progress || noProgress;
  const name = basename(file);
  const out = cutOutputs(file, deps.outDir || undefined);
  // A file has arrived when its size has settled and it is whole on this Mac: Dropbox can show a file at its full size before
  // it has brought any of it over, and ffprobe could then hang on it or fail.
  const whole = deps.isWhole || isWhole;
  // A file Dropbox shows only as a placeholder, as one dropped from another device, is not brought down until something reads
  // it: once its size has settled, it is asked for, read through once, and then looked at again.
  const bringDown = deps.bringDown || readThrough;
  let broughtDown = false;
  const sizes = [sizeOf(file)];
  while (!settled(sizes) || !whole(file)) {
    if (settled(sizes) && !broughtDown) {
      broughtDown = true;
      log(`${name}: Dropbox has not brought it down to this Mac yet, so it is asked for.`);
      await bringDown(file).catch((e) => log(`${name}: it could not be read through (${e.code || e.message}).`));
    }
    if (sizes.length > MAX_LOOKS) {
      log(`${name}: still arriving. It is taken the next time the folder changes.`);
      return { ok: false, name, arriving: true, message: "still arriving" };
    }
    await wait(LOOK_MS);
    sizes.push(sizeOf(file));
  }
  // An episode's import keeps its own folder in BRIMM Video Work, on the same disk as Dropbox, until the late check: macOS
  // may clear the temp folder before a late check that a restart left is made.
  const { episode } = deps;
  // What the video in the drop folder is when its import begins, so that one put in its place meanwhile is told apart.
  const arrived = episode ? fileId(file) : null;
  const work = episode ? join(runsFolder(episode.home), `${process.pid}-${Date.now()}`) : join(deps.tmpDir || tmpdir(), `brimm-unedited-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  // Whether the run's folder stays when the run ends: it does once an episode's files are in Dropbox, for the late check.
  let keepWork = false;
  // What the run writes goes through `files`. For a watched folder each file is held in the run's own folder until the video
  // is filed away with them, and otherwise each is put beside the video, or in --out, as soon as it is whole.
  const files = filesOf(work, { name, hold: Boolean(deps.watched), log, move: deps.move, copy: deps.copy });
  // An episode's import also says how far it has got in a status file in Episodes/.importing/, for both Macs to see.
  if (episode) {
    const writeText = textWriter({ work: join(work, "status"), ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}) });
    progress = statusReporter(progress, { root: episode.root, machine: episode.machine, video: name, bytes: sizeOf(file), importId: importIdOf(arrived), writeText, log, ...(deps.every ? { every: deps.every } : {}), ...(deps.cancel ? { cancel: deps.cancel } : {}) });
  }
  deps = { ...deps, files, progress };
  const fail = (why) => {
    // An episode's import writes nothing into the drop folder: its status file says why (importing.js).
    if (episode) progress.fail(why);
    else {
      writeFileSync(files.at(out.failed), `No transcript could be made from ${name}.\n\nWhy: ${why}.\n\nTo try again, delete this note. The video is taken again the next time something changes in this folder.\n`);
      files.put(out.failed);
    }
    log(`${name}: failed. ${why}.`);
    notify(episode ? `No transcript could be made from ${name}. It stays in the drop folder; see the log.` : `No transcript could be made from ${name}. See the note beside it.`);
    return { ok: false, name, message: why };
  };
  // The progress panel is told each step as it begins. It is told the steps to come as far as they are known, and again as
  // more is known: whether there is an upright version to make, once the video has been read, and whether there are clips.
  // `asking` and not `claude`: the plan's own record of Claude's reply is called claude further down, in the same scope.
  const asking = !deps.rulesOnly && Boolean(tools.claude);
  const watched = Boolean(deps.watched);
  progress.begin(name);
  progress.steps(stepsFor({ claude: asking, wide: true, clips: asking, watched }));
  // Whether the work on the video finished with every file made: only then is what its steps took kept as a measure.
  let finished = false;
  try {
    progress.step("Reading the sound");
    log(`${name}: reading the sound.`);
    const probed = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(file, probed));
    const printed = probe.code === 0 && existsSync(probed) ? readFileSync(probed, "utf8") : "";
    const facts = printed ? factsOf(printed) : null;
    if (facts && !facts.sound) return fail("there is no sound in the file");
    // An episode of a recording that is upright, square or short is a short video: it gets no upright version and no clips.
    const kind = episode && facts ? episodeKind(facts) : "";
    const wide = (f) => needsReframe(f) && kind !== "short video";
    if (facts) {
      progress.length(facts.duration);
      progress.steps(stepsFor({ claude: asking, wide: wide(facts), clips: asking && kind !== "short video", watched }));
    }
    const wav = join(work, "sound.wav");
    const a = await run(tools.ffmpeg, ffmpegArgs(file, wav));
    if (a.code !== 0 || !existsSync(wav)) return fail(`the sound could not be read from the file (${lastLine(a.stderr)})`);
    progress.step("Writing the transcript");
    log(`${name}: writing the transcript, with a time for every word.`);
    const outBase = join(work, "captions");
    let b = await run(tools.whisper, wordArgs({ model, wav, outBase }));
    // On some recordings the transcriber dies inside its word timing, every time it is tried, and reads the same sound
    // without trouble when it is not asked for the times. The transcript is then written by the transcript tool's own pass,
    // and there is no cut plan.
    let untimed = "";
    if (b.code !== 0) {
      untimed = `the transcriber could not time the words (${reasonOf(b)})`;
      log(`${name}: ${untimed}. Writing the transcript without them.`);
      b = await run(tools.whisper, whisperArgs({ model, wav, outBase }));
    }
    if (b.code !== 0) return fail(`the transcriber stopped (${reasonOf(b)})`);
    const written = existsSync(outBase + ".srt") ? readFileSync(outBase + ".srt", "utf8") : "";
    // The captions are made as the transcript tool makes them: without the ones written over a long silence, and with the
    // show's names spelled right. When ffmpeg cannot say where the silences are, they are written whole.
    const heard = captionCount(written) ? await run(tools.ffmpeg, silenceArgs(wav), { keep: 1000000 }) : null;
    const silent = heard && heard.code === 0 ? silences(heard.stderr) : [];
    const quiet = dropSilent(written, silent);
    if (quiet.dropped) log(`${name}: left out ${quiet.dropped} caption${quiet.dropped === 1 ? "" : "s"} written where nobody speaks.`);
    const srt = spellNames(quiet.srt);
    const captions = captionCount(srt);
    if (!captions) return fail("the transcriber found no speech in it");
    // What an earlier run made of this video goes first, so that nothing stays beside a plan it does not belong to, and
    // nothing of it stays in a watched folder when the video is filed away.
    // An episode's import writes nothing beside the video in the drop folder, and a file there of the video's name is a
    // person's own.
    if (!episode) for (const old of [out.srt, out.txt, out.words, out.plan, out.planTxt, out.rough, out.roughSrt, out.roughTxt, out.vertical, out.fcpxml, out.notes, ...oldClips(out)]) rmSync(old, { force: true });
    files.text(out.txt, stampedText(srt));
    files.text(out.srt, srt);
    if (!episode) rmSync(out.failed, { force: true });
    log(`${name}: the transcript is written, ${captions} captions.`);

    // From here on a step that fails costs the plan or a file made from it, and never the transcript: what was made is kept
    // and filed, and the plan's own text says what is missing. A short clip that could not be cut is the one thing it does
    // not name: the log and the notes for the editor do.
    progress.step("Making the cut plan");
    const planned = await planFor({ facts, probe, told: outBase + ".json", untimed, silent, wav }, deps).catch((e) => ({ why: `the work on the plan stopped (${e.message})` }));
    // The plan the rules made. Claude's decisions may change it below, and the plan they give is the plan for all that follows.
    let { plan } = planned;
    // What could not be made, each as the log says it. And of the files made from the plan, the ones that are missing, each
    // {what, why}.
    const missing = [];
    const lacks = [];
    // What came of asking Claude: {read} or {why}, and nothing when it was not asked. And the short clips as they were cut.
    let asked = null;
    let cut = [];
    // The folder for the day the video is to be filed in, and the Final Cut file that names it there.
    let day = "";
    let project = null;
    // Have the Final Cut file name the video at `video`, where the video is, when it names it anywhere else. A video is named
    // by its whole path, whatever path the tool was given.
    const nameAgain = (video) => {
      if (!project || resolve(video) === project.named) return;
      try {
        files.text(out.fcpxml, project.textFor(resolve(video)).text);
      } catch (e) {
        log(`${name}: its Final Cut file names it in a folder it is not in, and could not be written again (${e.code || e.message}).`);
      }
    };
    if (!plan) {
      missing.push(`no cut plan could be made: ${planned.why}`);
      files.text(out.planTxt, `No cut plan could be made for ${name}.\n\nWhy: ${planned.why}.\n\nIts transcript was made, and is beside this note.\n`);
    } else {
      /** What a plan comes to, as the log says it. */
      const sums = (made) => {
        const cuts = made.ranges.filter((r) => !r.keep).length;
        return `keeps ${stamp(Math.round(made.kept))} of ${stamp(Math.round(facts.duration))} and suggests ${cuts} cut${cuts === 1 ? "" : "s"}`;
      };
      log(`${name}: the cut plan ${sums(plan)}.`);

      // Claude reads the rules' plan before anything is made from it. Its decisions are applied with the pauses ffmpeg heard,
      // so a cut of its own falls where the rules' cuts fall, and the clips it picked are taken from the plan as it then is.
      // Without a reply, the plan stays the rules' alone, and there are no notes and no clips.
      if (asking) progress.step("Asking Claude");
      asked = deps.rulesOnly || !tools.claude ? null : await askClaude(name, plan, facts, work, deps);
      // What Claude wrote, as it was read, and what of it was left out on the way, each with its reason. And its clips, as
      // they can be cut.
      const read = asked && asked.read;
      let ignored = [];
      let clips = [];
      let changes = 0;
      if (read) {
        const applied = applyDecisions(plan, read.decisions, planned.pauses);
        const picked = clipRanges(applied.plan, read.clips, planned.pauses);
        plan = applied.plan;
        ignored = [...read.problems, ...applied.ignored, ...picked.ignored];
        clips = picked.clips;
        if (kind === "short video" && clips.length) {
          log(`${name}: it is a short video, so the clips Claude picked are not cut.`);
          clips = [];
        }
        changes = (plan.changes || []).length;
        log(changes ? `${name}: Claude changed the cut plan in ${changes} place${changes === 1 ? "" : "s"}: it now ${sums(plan)}.` : `${name}: Claude changed nothing in the cut plan.`);
      }

      progress.steps(stepsFor({ claude: asking, wide: wide(facts), clips: clips.length > 0, watched }));
      const spans = keptSpans(plan.ranges, roughRate(facts));
      let why = "";
      let note = "";
      try {
        files.text(out.words, JSON.stringify({ video: name, duration: facts.duration, words: planned.words }, null, 2) + "\n");
        const roughSrt = roughCaptions(plan.phrases, spans);
        files.text(out.roughTxt, stampedText(roughSrt));
        files.text(out.roughSrt, roughSrt);
        why = await roughCut(file, out.rough, { plan, facts, spans }, deps);
      } catch (e) {
        // Something nobody foresaw, such as a file that cannot be written. What was made is kept, and the plan names the rest.
        why = `the work stopped (${e.code || e.message})`;
        rmSync(files.at(out.rough), { force: true });
        const gone = [out.words, out.roughTxt, out.roughSrt].filter((f) => !files.has(f)).map((f) => basename(f));
        if (gone.length) note = ` Not made either: ${gone.join(", ")}.`;
      }
      if (why) lacks.push({ what: "rough cut", why, note });

      // The upright version is for a picture that is wider than it is tall. One that is upright or square already needs none.
      // The faces are looked for once, for it, and what was found is kept for the clips, which are cropped by the same
      // stills. `centred` says why the faces could not be looked for, when they could not: what is made of the video is
      // then cropped at the centre of the picture, and `atCentre` names what was.
      let stills = [];
      let centred = "";
      const atCentre = [];
      if (!needsReframe(facts)) {
        if (facts.height) log(`${name}: its picture is not wider than it is tall, so it needs no upright version.`);
      } else if (kind === "short video") {
        log(`${name}: it is a short video, so it gets no upright version.`);
      } else if (!spans.length) lacks.push({ what: "upright version", why: "the plan keeps nothing" });
      else {
        const made = await upright(file, out.vertical, { facts, spans }, work, deps);
        ({ stills, centred } = made);
        if (made.why) lacks.push({ what: "upright version", why: made.why });
        else atCentre.push("the upright version");
      }

      // The short clips Claude picked, each cut whole from the video. One that cannot be cut does not stop the others.
      if (clips.length) {
        log(`${name}: cutting ${clips.length} short clip${clips.length === 1 ? "" : "s"}.`);
        cut = await cutClips(file, clips, { plan, facts, stills }, deps);
        if (wide(facts) && cut.some((made) => made.files.length)) atCentre.push("the short clips");
      }

      // The Final Cut file names the video where it ends up. For a video in a watched folder that is in the folder for the
      // day, so the folder's name is settled here, as late as can be, and the move below is given it. The library is in the
      // home folder, and the folder it is kept in is made when it is not there.
      // An episode's Final Cut file is kept in its edit/ folder, and names the video by a path from there and no library, so it
      // reads the same on either Mac: each Mac is handed a copy of its own when the timeline is shown in Final Cut (edit.js).
      day = deps.watched && !episode ? dayFor(deps.watched, deps) : "";
      const named = resolve(day ? join(deps.watched, day) : dirname(file), name);
      const library = deps.home && !episode ? join(deps.home, LIBRARY) : "";
      const ideas = read ? ideaNotes(plan, read.graphics) : [];
      const src = episode ? relativeUrl(`../${name}`) : "";
      const textFor = (video) => finalCut(video, { plan, facts, spans, srt, printed, ideas }, { library, src, writer: deps.finalCut });
      const first = textFor(named);
      let wrong = first.why || "";
      try {
        if (!wrong && library) mkdirSync(dirname(library), { recursive: true });
      } catch (e) {
        wrong = `the folder for its library could not be made (${e.code || e.message})`;
      }
      try {
        if (!wrong) files.text(out.fcpxml, first.text);
      } catch (e) {
        wrong = `the work stopped (${e.code || e.message})`;
      }
      if (wrong) lacks.push({ what: "Final Cut file", why: wrong });
      else project = { named, textFor };

      // What could not be cut of the clips, each as the log says it.
      const uncut = cut.flatMap((made) => made.failed);
      // The notes Claude wrote for the editor. With them goes everything of its reply that could not be used, and why:
      // what could not be read, each decision and each clip that was left out, and each clip that could not be cut.
      if (read) {
        try {
          files.text(out.notes, notesText({ ...read, problems: [...ignored, ...uncut.map(sentence)] }, plan, clips));
        } catch (e) {
          lacks.push({ what: "notes for the editor", why: `the work stopped (${e.code || e.message})` });
        }
      }

      // What the plan's text says first, after the files that are missing: who made the plan, and what was cropped at the
      // centre of the picture and not on the speaker.
      const said = [];
      if (read) said.push(`Claude read this plan and ${changes ? `changed it in ${changes} place${changes === 1 ? "" : "s"}` : "changed nothing in it"}.${files.has(out.notes) ? ` Its notes are in ${basename(out.notes)}.` : ""}`);
      else if (asked) said.push(`Claude could not be asked (${asked.why}), so this plan is the rules' alone.`);
      else if (!deps.rulesOnly) said.push("Claude Code is not installed, so this plan is the rules' alone.");
      if (centred && atCentre.length) said.push(`${capital(listed(atCentre))} ${atCentre.includes("the short clips") ? "are" : "is"} cropped at the centre of the picture, and not on the speaker: ${centred}.`);

      missing.push(...lacks.map((lack) => `the ${lack.what} could not be made: ${lack.why}`), ...uncut);
      files.text(out.planTxt, planText(plan, [...lacks.map((lack) => `The ${lack.what} could not be made: ${lack.why}.${lack.note || ""}`), ...said].join("\n")));
      // The plan is written after everything made from it. It is what says this video is done, so a run cut short while the
      // rough cut, the upright version or a clip is being made does the video again. When it cannot be written the run
      // stops here, and the video is done again the next time: for a watched folder nothing has been put anywhere, and what
      // was held in the run's own folder goes with it. It says who made the plan. When Claude read it, it keeps what Claude
      // decided, its ideas for graphics as they were read, what was left out of its reply and why, and each clip with the
      // names of the files that were made of it, so that a person can see what changed. Nothing reads the ideas back yet:
      // they are there for what is made of the plan later.
      const claude = read ? { decisions: read.decisions, graphics: read.graphics, ignored, clips: cut.map((made) => ({ ...made.clip, files: made.files.map((f) => basename(f)), ...(made.failed.length ? { failed: made.failed.map(sentence) } : {}) })) } : null;
      files.text(out.plan, JSON.stringify({ version: 1, video: name, facts, phrases: plan.phrases, ranges: plan.ranges, kept: plan.kept, cut: plan.cut, by: plan.by || "rules", ...(plan.changes ? { changes: plan.changes } : {}), ...(claude ? { claude } : {}) }, null, 2) + "\n");
    }
    for (const what of missing) log(`${name}: ${what}.`);
    if (!missing.length) log(`${name}: done.`);
    // For a watched folder, the video is filed away with the files the run held for it, the plan last. Its Final Cut file
    // names it in the folder it is filed in: when it cannot be moved there, the file is first written again to name the
    // video where it stays.
    const held = [out.srt, out.txt, out.words, out.planTxt, out.rough, out.roughSrt, out.roughTxt, out.vertical, out.fcpxml, out.notes, ...cut.flatMap((made) => made.files), out.plan];
    if (deps.watched) progress.step("Filing");
    const unasked = asked && !asked.read ? " Claude could not be asked, so the plan is the rules' alone." : "";
    if (episode) {
      // An episode is filed into its own folder in Episodes, by clones, and the raw video stays in the drop folder until the
      // late check. When it cannot be filed, no record is written, and the next run files it again.
      const stem = basename(name, extname(name));
      let filed = null;
      try {
        filed = fileEpisode({ file, made: held.filter((f) => files.has(f)), at: files.at, fcpxml: out.fcpxml, facts: facts || { duration: 0, width: 0, height: 0 }, printed, kind: kind || "episode", read: asked && asked.read, cut, work, dropFile: arrived }, deps);
        keepWork = true;
        // The late check is kept on this Mac's own disk, so a run stopped before it leaves it for the next run.
        const pending = { version: 1, id: filed.record.id, name: filed.name, folder: filed.path, video: name, bytes: filed.record.video.bytes, seconds: filed.record.video.seconds, drop: file, dropFile: arrived, importId: importIdOf(arrived), work, entries: filed.entries, lastCopy: (deps.clock || Date.now)(), root: episode.root, machine: episode.machine, planTxt: basename(out.planTxt) };
        try {
          writePending(episode.home, pending);
          log(`${name}: copied into Dropbox. Its late check is due at ${new Date(dueAt(pending)).toTimeString().slice(0, 5)}.`);
        } catch (e) {
          log(`${name}: copied into Dropbox, but its late check could not be kept (${e.code || e.message}), so it is not made, and the video stays in the drop folder.`);
        }
      } catch (e) {
        if (e.code === "DROP_CHANGED") {
          // Nothing of it was put into Dropbox. The new file is imported on its own, as another recording.
          log(`${name}: it changed in the drop folder while it was imported, so this import is stopped, and the new file is imported on its own.`);
          progress.drop();
          return { ok: false, name, arriving: true, changed: true, message: "it changed in the drop folder while it was imported" };
        }
        const why = `it could not be filed into Episodes: ${String(e.message).replace(/\.$/, "")}`;
        missing.push(why);
        progress.fail(why);
        log(`${name}: ${why}. It stays in the drop folder, and is done again the next time.`);
      }
      if (filed) notify(`Ready: ${stem}${lacks.length ? `, but ${listed(lacks.map((lack) => `its ${lack.what}`))} could not be made` : ""}. In Claude, say "open ${stem}".${unasked}`);
      else notify(`${name} could not be put into Episodes. It stays in the drop folder; see the log.`);
      finished = !missing.length;
      return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder: filed ? filed.name : "", ...(filed ? { filed } : {}), message: missing.join("; ") };
    }
    const folder = deps.watched ? fileAway(deps.watched, file, held.filter((f) => files.has(f)), deps, day, () => nameAgain(file)) : "";
    const where = folder ? `, in the folder ${folder}` : "";
    if (plan) notify(`The cut plan for ${name} is ready${where}${lacks.length ? `, but ${listed(lacks.map((lack) => `its ${lack.what}`))} could not be made` : ""}.${unasked}`);
    else notify(`The transcript of ${name} is ready${where}, but no cut plan could be made. See ${basename(out.planTxt)}.`);
    finished = !missing.length;
    return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder, message: missing.join("; ") };
  } finally {
    progress.end(finished);
    if (!keepWork) rmSync(work, { recursive: true, force: true });
  }
}

/** Do everything for one unedited video. Resolves {ok, name, captions, kept, cut, folder, message}. `ok` is true when every
    file was made, and `message` says what was not. When no transcript could be made there is a note beside the video, as the
    transcript tool leaves one, and {ok: false, name, message}. A file that is still arriving gets {ok: false, arriving: true}
    and no note. For a video in a watched folder (`deps.watched`) what was made is then filed away with the video, and `folder`
    is the folder it went into. `deps.home` is the home folder, where the Final Cut file's library is kept: told none, the
    file names no library, and Final Cut Pro asks where the project goes. `deps.finalCut` is the writer of that file, for a
    test to give another. Nothing is thrown from here: when something nobody foresaw stops the work, the log says so.
    Claude is asked to read the rules' plan when `deps.tools.claude` is there and `deps.rulesOnly` is not set. `kept` and
    `cut` are then the plan's with Claude's decisions applied. When Claude could not be asked, the plan is the rules'
    alone, there are no notes and no clips, and that is no failure: `ok` is still true. A short clip that could not be
    cut is one, as any other file that could not be made is. */
export async function uneditedFile(file, deps) {
  try {
    return await workOn(file, deps);
  } catch (e) {
    const why = String(e.code || e.message);
    (deps.log || (() => {}))(`${basename(file)}: the work stopped (${why}).`);
    return { ok: false, name: basename(file), message: why };
  }
}

/** How far apart, in seconds, the length of a video now and the length its plan was made with may be, for the plan to be of
    that video. ffprobe gives the same length for the same file, but another version of ffprobe may read it a little
    differently. */
const SAME_LENGTH = 0.1;

/** What is wrong with a cut plan, as it was read from its JSON, for its videos to be made again: "" when nothing is. Only what
    the videos are made of is looked at: the facts of the video, the ranges, and each clip's ranges, the ranges of each part
    of its Story and the names of the files that were made of it. */
function planFault(plan) {
  const isRange = (r) => Boolean(r) && Number.isFinite(r.start) && Number.isFinite(r.end);
  const ranges = (v) => Array.isArray(v) && v.length > 0 && v.every(isRange);
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || plan.version !== 1 || typeof plan.video !== "string") return "it is not a cut plan this tool wrote";
  const facts = plan.facts || {};
  if (![facts.duration, facts.width, facts.height].every(Number.isFinite) || typeof facts.fps !== "string") return "the facts of its video cannot be read";
  if (!ranges(plan.ranges) || !plan.ranges.every((r) => typeof r.keep === "boolean")) return "its ranges cannot be read";
  if (!plan.claude) return "";
  if (!Array.isArray(plan.claude.clips)) return "its clips cannot be read";
  const bad = plan.claude.clips.findIndex((clip) => !clip || !Number.isInteger(clip.n) || clip.n < 1 || !ranges(clip.ranges) || !Array.isArray(clip.story)
    || !clip.story.every((part) => part && ranges(part.ranges)) || !Array.isArray(clip.files) || !clip.files.every((f) => typeof f === "string"));
  return bad === -1 ? "" : `clip ${bad + 1} in it cannot be read`;
}

/** A video's facts as they tell one video from another, in plain words, and whether two such are of one video. */
const described = (facts) => `${facts.duration} seconds, ${facts.width} by ${facts.height}${facts.fps ? ` at ${facts.fps}` : ""}`;
const sameVideo = (a, b) => a.width === b.width && a.height === b.height && a.fps === b.fps && Math.abs(a.duration - b.duration) <= SAME_LENGTH;

/** Make the videos of one video again from the cut plan an earlier run wrote for it (--from-plan): its rough cut, its upright
    version when it is wider than it is tall, and each of Claude's clips and each part of a clip's Story that the plan names
    as made. They are made as a run makes them today, from the plan's facts, its ranges and each clip's ranges as they are,
    and the faces are looked for again. So the cuts and the clips are the ones that run made, and only how the videos are
    written can differ. No transcript is made, Claude is not asked, and no other file is touched: the transcripts, the words,
    the plan's two files, the notes, the captions and the Final Cut file stay as that run wrote them. The Final Cut file names
    the video and none of the videos made here, so it needs nothing new. The plan is read where that run wrote it: beside
    the video, or in `deps.outDir`. The video is never moved.
    Each video is written whole in the run's own folder and then put in place over the one made before, so until then that
    one is there as it was. One that cannot be made leaves the one made before as it is, the log says so, and the others are
    made all the same.
    Resolves {ok, name, made, message}: `made` names the videos made again, and `message` says what could not be. When there
    is no video, no plan, a plan that cannot be read or one of another video, or the plan's video has no picture or the plan
    keeps nothing, it stops before anything is made, the log says why, and it resolves {ok: false, stopped: true} with
    `message` saying why. */
export async function videosFromPlan(file, deps) {
  const { run, tools, log = () => {}, progress = noProgress } = deps;
  const name = basename(file);
  const out = cutOutputs(file, deps.outDir || undefined);
  const stop = (why) => {
    log(`${name}: ${why}. Nothing was made.`);
    return { ok: false, name, made: [], stopped: true, message: why };
  };
  if (!existsSync(file)) return stop(`there is no video at ${file}`);
  if (!existsSync(out.plan)) return stop(`there is no cut plan at ${out.plan}`);
  let plan;
  try {
    plan = JSON.parse(readFileSync(out.plan, "utf8"));
  } catch (e) {
    return stop(`the cut plan at ${out.plan} could not be read (${e instanceof SyntaxError ? "it is not JSON" : e.code || e.message})`);
  }
  const fault = planFault(plan);
  if (fault) return stop(`the cut plan at ${out.plan} could not be read (${fault})`);
  if (plan.video !== name) return stop(`the cut plan at ${out.plan} is the plan of ${plan.video}, and not of ${name}`);
  const work = join(deps.tmpDir || tmpdir(), `brimm-unedited-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  // Each video goes through `files`, and is put in place as soon as it is whole.
  const files = filesOf(work, { name, log, move: deps.move, copy: deps.copy });
  deps = { ...deps, files };
  let finished = false;
  try {
    // ffprobe is asked what the video is now, so that a plan is never used on a video it was not made of.
    const probed = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(file, probed));
    const now = probe.code === 0 && existsSync(probed) ? factsOf(readFileSync(probed, "utf8")) : null;
    if (!now) return stop(`the video could not be read (${lastLine(probe.stderr)})`);
    const { facts } = plan;
    if (!sameVideo(facts, now)) return stop(`the cut plan at ${out.plan} was made of another video: one of ${described(facts)}, and ${name} is ${described(now)}`);
    if (!facts.height) return stop("its cut plan says it has no picture, so it has no videos to make");
    const spans = keptSpans(plan.ranges, roughRate(facts));
    if (!spans.length) return stop("its cut plan keeps nothing, so it has no videos to make");
    log(`${name}: making its videos again from ${basename(out.plan)}.`);
    const clipped = (plan.claude ? plan.claude.clips : []).some((clip) => clip.files.length > 0);
    progress.begin(name);
    progress.length(facts.duration);
    progress.steps(["Making the rough cut", ...(needsReframe(facts) ? ["Finding the faces", "Making the upright version"] : []), ...(clipped ? ["Cutting the short clips"] : [])]);

    const made = [];
    const failed = [];
    /** What became of the video at `to`: `why` it could not be made, which is "" when it was. `what` says it could not. */
    const madeOr = (to, what, why) => {
      if (!why) made.push(basename(to));
      else {
        failed.push(`${what}: ${why}`);
        log(`${name}: ${what}: ${why}.${existsSync(to) ? " The one made before is kept." : ""}`);
      }
    };
    let why = "";
    try {
      why = await roughCut(file, out.rough, { plan, facts, spans }, deps);
    } catch (e) {
      rmSync(files.at(out.rough), { force: true });
      why = `the work stopped (${e.code || e.message})`;
    }
    madeOr(out.rough, "the rough cut could not be made again", why);
    // The faces are looked for once, for the upright version, and the clips are cropped by the same stills.
    let stills = [];
    if (needsReframe(facts)) {
      const up = await upright(file, out.vertical, { facts, spans }, work, deps);
      stills = up.stills;
      madeOr(out.vertical, "the upright version could not be made again", up.why);
    }
    // Each clip, and each part of its Story, that the run which wrote the plan made. One it could not cut is not cut now:
    // it has no captions, and the notes say it could not be cut.
    const pieces = [];
    let clips = 0;
    for (const clip of plan.claude ? plan.claude.clips : []) {
      const named = clipOutputs(file, clip.n, clip.story.length, deps.outDir || undefined);
      const has = (to) => clip.files.includes(basename(to));
      const notCut = (what) => log(`${name}: ${what} was not cut by the run that wrote the plan, so it is not cut now.`);
      if (!has(named.video)) {
        notCut(`clip ${clip.n}`);
        continue;
      }
      clips += 1;
      pieces.push({ to: named.video, ranges: clip.ranges, most: 0, what: `clip ${clip.n}` });
      named.story.forEach((to, k) => {
        const what = `part ${k + 1} of the Story of clip ${clip.n}`;
        if (has(to)) pieces.push({ to, ranges: clip.story[k].ranges, most: STORY_MAX, what });
        else notCut(what);
      });
    }
    if (clips) log(`${name}: cutting ${clips} short clip${clips === 1 ? "" : "s"}.`);
    for (const piece of pieces) {
      progress.step("Cutting the short clips", `Cutting ${piece.what}`);
      const cut = await cutPiece(file, piece.to, piece.ranges, { facts, stills, most: piece.most }, deps);
      madeOr(piece.to, `${piece.what} could not be cut again`, cut.why || "");
    }
    if (!failed.length) log(`${name}: done. Made again: ${listed(made)}.`);
    else log(made.length ? `${name}: made again: ${listed(made)}.` : `${name}: nothing was made again.`);
    finished = !failed.length;
    return { ok: !failed.length, name, made, message: failed.join("; ") };
  } finally {
    progress.end(finished);
    rmSync(work, { recursive: true, force: true });
  }
}

/** Do every video in a folder that has no cut plan yet, and file each one away in a folder of its own. One run at a time works
    on a folder, and the lock is the transcript tool's own, so the two never work on one folder at the same time. When this
    Mac has settings for episodes and the folder is its own drop folder, each video is made into an episode in Episodes
    instead, and checked again in Dropbox 15 minutes after it was copied in (filing.js); the run waits for that, kept awake. */
export async function uneditedFolder(dir, deps) {
  const { log = () => {}, alive = isRunning } = deps;
  const { settings } = deps;
  const episodic = episodeMode(dir, settings);
  // A drop folder for episodes is never worked the old way, which renames the video into a folder for the day in Dropbox:
  // when this Mac's settings cannot be used for it, nothing is done there, and the log says why.
  const marker = join(dir, ".brimm-watched-by");
  const dropFolderOf = existsSync(marker) || (basename(dirname(resolve(dir))) === "Unedited Video" && basename(dirname(dirname(resolve(dir)))) === "BRIMM Video");
  if (!episodic && dropFolderOf) {
    const owner = existsSync(marker) ? readFileSync(marker, "utf8").split("\n")[0] : "";
    log(`This is a drop folder for episodes (${owner ? `${marker} names ${owner}` : "it is in BRIMM Video/Unedited Video"}), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac.`);
    return [];
  }
  // The lock of this Mac's drop folder is kept in BRIMM Video Work, so that a run started by hand and the launch agent's,
  // whose temp folders differ, share it.
  const home = deps.home || homedir();
  const lockDir = deps.lockDir || (episodic ? runsFolder(home) : undefined);
  if (lockDir) mkdirSync(lockDir, { recursive: true });
  const lock = lockFile(dir, lockDir);
  const held = takeLock(lock, alive);
  if (held) {
    log(held);
    return [];
  }
  try {
    // When this is this Mac's drop folder, each video is made into an episode, and checked again 15 minutes after it was
    // copied into Dropbox (filing.js).
    if (episodic) {
      const episode = { root: settings.root, machine: settings.machine, checkout: settings.checkout, home };
      const withEpisode = { ...deps, episode };
      return await importEpisodes(dir, withEpisode, (name) => uneditedFile(join(dir, name), { ...withEpisode, outDir: "", watched: dir }));
    }
    // Only what is directly in the folder is looked at, so a video that has been filed away is never taken again.
    let names;
    try {
      names = waitingToCut(readdirSync(dir));
    } catch (e) {
      log(`The folder could not be read (${e.code || e.message}). If it is in Dropbox or another cloud drive, allow node to read it in System Settings, Privacy & Security, Files and Folders.`);
      return [];
    }
    log(names.length ? `Looked in the folder: ${names.length} waiting (${names.join(", ")}).` : "Looked in the folder: nothing is waiting.");
    const results = [];
    for (const name of names) results.push(await uneditedFile(join(dir, name), { ...deps, outDir: "", watched: dir }));
    return results;
  } finally {
    rmSync(lock, { force: true });
  }
}

export async function uneditedFolders(folders, deps) {
  const { log = () => {} } = deps;
  let code = 0;
  for (const given of folders) {
    const folder = resolve(given);
    if (!existsSync(folder)) {
      log(`There is no folder at ${folder}.`);
      code = 2;
      continue;
    }
    log(`Folder: ${folder}`);
    try {
      const results = await uneditedFolder(folder, deps);
      if (!code && results.some((r) => !r.ok && !r.arriving)) code = 1;
    } catch (e) {
      log(`The work on this folder stopped (${e.code || e.message}).`);
      if (!code) code = 1;
    }
  }
  return code;
}

export function parseArgs(argv) {
  const a = { file: "", folders: [], out: "", rulesOnly: false, fromPlan: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--help" || v === "-h") a.help = true;
    else if (v === "--watch") a.folders.push(argv[++i] || "");
    else if (v === "--out") a.out = argv[++i] || "";
    else if (v === "--rules-only") a.rulesOnly = true;
    else if (v === "--from-plan") a.fromPlan = true;
    else if (!a.file) a.file = v;
  }
  a.folders = a.folders.filter(Boolean);
  if (!a.file && !a.folders.length) a.help = true;
  return a;
}

const HELP = `For an unedited video: a transcript with a time for every word, a cut plan that Claude is asked to read, a rough cut and
its captions, an upright version for Instagram, a Final Cut Pro project file, Claude's notes for the editor and the short
clips it picked.

  node unedited.js <file>             one video: its files appear beside it, and nothing is moved
  node unedited.js --watch <folder>   every video in the folder that has no cut plan yet. Each one is then moved, with its
                                      files, into a new folder there named for the day

  --watch <folder>   again, to work more than one folder
  --out <folder>     where to write, for one file
  --rules-only       never ask Claude: the plan is the rules' alone, there are no notes and no clips, and nothing leaves
                     this Mac
  --from-plan        make the videos of one video again from the cut plan an earlier run wrote beside it: the rough
                     cut, its upright version and the clips Claude picked, as the tool writes videos now. No transcript
                     is made, Claude is not asked, and no other file is touched. Never with --watch

The video and its sound never leave this Mac. When Claude is asked, the words of the transcript with their times and the
rules' plan are sent to Claude through Claude Code, on the Claude account signed in on this Mac. The video's file name and
its length go with them.

While it works, a small window in the top right corner of the screen shows how far each video has got: the step, a bar,
and how long is left. Closing it changes nothing about the work.
`;

/** A banner on the Mac's screen. It is a courtesy: when it cannot be shown, nothing else changes. */
const banner = (text) => {
  const child = spawn("/usr/bin/osascript", ["-e", `display notification ${JSON.stringify(text)} with title "BRIMM unedited video"`], { stdio: "ignore" });
  child.on("error", () => {});
};

/** What a run started from the command line is given: the real way of running a program, the programs `found` on this Mac,
    the log, the banner and a real wait. And the home folder, where the Final Cut file's library is kept: the one HOME names,
    as it does for the launch agent and in a shell, and the Mac's own word for it when HOME names none. `args` is what the
    run was asked to do: with --rules-only among it, the run is told never to ask Claude. */
export function depsFor(found, log, env = process.env, args = {}) {
  const home = env.HOME || homedir();
  // This Mac's settings for episodes, when it has them: with them, the import of its own drop folder makes episodes.
  const settings = readSettings(home).settings || null;
  return { run: runProgram, tools: found, model: found.model, home, settings, rulesOnly: Boolean(args.rulesOnly), log, notify: banner, wait: (ms) => new Promise((r) => setTimeout(r, ms)), progress: reporter({ folder: progressFolder(home), swift: found.swift, log }) };
}

/** Do what a run was asked to do, with what it was given: the watched folders, or the one video. Resolves what the run ends
    with: for folders what uneditedFolders gives, and for one video 0 when everything was made, 1 when something was not, and
    2 when there is no such file. When Claude is not going to be asked, the log says so here, once for the whole run, and
    says why: the run was told to go by the rules alone, or Claude Code is not on this Mac, or it makes videos again from a
    plan (--from-plan). That is only ever done for one video, and never for a watched folder, whose videos are moved: asked
    for one, the run says so and ends with 2. It also ends with 2 when it stopped before it made anything. */
export async function doAsked(args, deps) {
  const { log = () => {} } = deps;
  if (args.fromPlan && args.folders.length) {
    log("--from-plan is for one video, named by its file, and never for a watched folder. Nothing was made.");
    return 2;
  }
  if (args.fromPlan) log("Claude is not asked in this run (--from-plan), and no transcript is made: the videos are made again from the cut plan an earlier run wrote, as it is.");
  else if (deps.rulesOnly) log("Claude is not asked in this run (--rules-only): each cut plan is the rules' alone.");
  else if (!deps.tools.claude) log("Claude Code is not installed, so Claude is not asked in this run: each cut plan is the rules' alone.");
  if (args.folders.length) return uneditedFolders(args.folders, deps);
  const file = resolve(args.file);
  if (!existsSync(file)) {
    log(`There is no file at ${file}.`);
    return 2;
  }
  if (args.fromPlan) {
    const r = await videosFromPlan(file, { ...deps, outDir: args.out ? resolve(args.out) : "" });
    return r.ok ? 0 : r.stopped ? 2 : 1;
  }
  if (args.out) mkdirSync(resolve(args.out), { recursive: true });
  const r = await uneditedFile(file, { ...deps, outDir: args.out ? resolve(args.out) : "" });
  return r.ok ? 0 : 1;
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const log = (line) => process.stdout.write(`${new Date().toISOString()} ${line}\n`);
  const found = findPrograms();
  if (found.missing.length) {
    for (const m of found.missing) log(m);
    log("Run tool/install.sh to set this Mac up.");
    return 2;
  }
  return doAsked(args, depsFor(found, log, process.env, args));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
