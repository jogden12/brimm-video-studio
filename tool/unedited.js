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
// When this Mac's settings say `import: "light"` (settings.js), a video in its drop folder is imported lightly (spec
// 2026-10-22, section 1): its transcript, words, cut plan and cut log, and the rough cut's captions worked out from the plan,
// and nothing more. Claude is not asked, no video is made, and there is no Final Cut file, reels.json or notes: the episode's
// record waits for her to say what the video is, and until then the video is named by its label, never by its file. Until
// the import takes Zoom's downloads (phase Z), a file named as Zoom names them is left where it is, with a status that says
// so (filing.js), and --from-plan refuses an episode imported lightly. A watched folder that is not this Mac's drop folder, and
// the one file given on the command line, keep the full run whatever the setting says.
import { mainProject } from "./projects.js";
import { spawn, spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay, stamp } from "./shared/text.js";
import { dayFolder, ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount, captionsOf, settled } from "./lib.js";
import { runProgram, findTools, lockFile, takeLock, isRunning, lastLine, sizeOnDisk } from "./run.js";
import { probeArgs, factsOf, framesASecond, wordArgs, pauseArgs, wordsOf, pausesOf, phrasesOf, cutPlan, colourOf, streamsOf, soundStream, joinNotes, planText, keptSpans, roughRate, roughCutArgs, roughCaptions, cutOutputs, clipOutputs, clipFiles, waitingToCut } from "./cuts.js";
import { notesRequest, readNotes, applyDecisions, clipRanges, notesText, pausesOfPlan } from "./notes.js";
import { stillsArgs, needsReframe, cropsFor, verticalArgs, stretchesOf, STORY_MAX } from "./reframe.js";
import { fcpxml, checkFcpxml, relativeUrl, colorSpaceOf } from "./fcpxml.js";
import { previewSteps, previewLimits, previewPath, reelCandidates, reelsFile, reelEntries, readReels, mergeCandidates, REELS_FILE } from "./reels.js";
import { runGuarded } from "./guard.js";
import { reporter, progressFolder, noProgress } from "./progress.js";
import { isWhole, readThrough, textWriter, replaceIn, lateCheck, LATE_CHECK_MS } from "./dropbox.js";
import { episodeMode, episodeKind, fileEpisode, statusReporter, importEpisodes, writePending, readPendings, dueAt, fileId, importIdOf, commitOf, readSeen, seenKey } from "./filing.js";
import { readSettings, runsFolder, episodeWork, episodesFolder, lightImport } from "./settings.js";
import { localStamp, readEpisode, writeEpisode, undone, heldText, heldElsewhere, RECORD_DIR, recordNumbers, conflictedCopies, conflictedOf, kindOf, layoutOf } from "./episode.js";
import { cameFrom, guessKind, labelFor, numbered, seenLine } from "./kinds.js";
import { fingerprintOf, matchVersion } from "./versions.js";
import { runDetached } from "./detached.js";
import { readStatuses, importState } from "./importing.js";

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
    version to make (`wide`), there are clips to cut (`clips`), or, for an episode, Reel previews to make (`previews`), and the
    video is filed away after (`watched`). The light import (`light`) reads, transcribes, plans and files, and nothing more. */
const LIGHT_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Filing"];
const stepsFor = ({ claude, wide, clips, previews, watched, light }) => light ? [...LIGHT_STEPS] : [
  "Reading the sound", "Writing the transcript", "Making the cut plan", ...(claude ? ["Asking Claude"] : []), "Making the rough cut",
  ...(wide ? ["Finding the faces", "Making the upright version"] : []), ...(previews ? ["Making the Reel previews"] : clips ? ["Cutting the short clips"] : []), ...(watched ? ["Filing"] : [])
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
async function roughCut(file, to, { plan, facts, spans, streams = null }, { run, tools, files, log = () => {}, progress = noProgress }) {
  if (!facts.height) return "there is no picture in the file";
  if (!spans.length) return "the plan keeps nothing";
  log(`${basename(file)}: making the rough cut.`);
  progress.step("Making the rough cut");
  const writing = files.at(to);
  // ffmpeg says how far it has got, for the progress panel. Without a panel it is given nothing more.
  const watch = progress.encoding(secondsIn(spans));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...roughCutArgs(file, writing, { ranges: plan.ranges, fps: roughRate(facts), streams })]);
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

/** Have ffmpeg write stretches of a video, joined, as one file at `to`: each with its crop, and the whole made 1080 by 1920,
    or with no crops for a video that keeps its shape. Resolves "" when the file is made, or why it is not. It is written
    whole in the run's own folder and then put where it belongs, as every other file is. */
async function joined(file, to, { ranges, crops, streams = null }, { run, tools, files, progress = noProgress }) {
  const writing = files.at(to);
  const watch = progress.encoding(secondsIn(ranges));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...verticalArgs({ video: file, ranges, crops, out: writing, streams })]);
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
async function upright(file, to, { facts, spans, streams = null }, work, deps) {
  const { log = () => {}, progress = noProgress } = deps;
  const name = basename(file);
  let seen = {};
  try {
    log(`${name}: making the upright version.`);
    progress.step("Finding the faces");
    seen = await facesIn(file, work, deps).catch((e) => ({ why: `the work stopped (${e.code || e.message})` }));
    if (seen.why) log(`${name}: the faces could not be looked for (${seen.why}), so the upright version is cropped at the centre of the picture.`);
    const ranges = stretchesOf(spans);
    const crops = cropsFor(facts, ranges, seen.stills || []);
    const guessed = crops.filter((crop) => !crop.found).length;
    if (seen.stills && guessed) {
      log(seen.stills.some((still) => still.faces.length) ? `${name}: no face was found in ${guessed} of the ${crops.length} kept stretches, so the crop of the whole video is used there.`
        : `${name}: no face was found in the video, so the upright version is cropped at the centre of the picture.`);
    }
    progress.step("Making the upright version");
    return { why: await joined(file, to, { ranges, crops, streams }, deps), centred: seen.why || "", stills: seen.stills || [] };
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
async function cutPiece(file, to, given, { facts, stills, most = 0, streams = null }, deps) {
  try {
    if (!facts.height) return { why: "there is no picture in the file" };
    const whole = keptSpans(given.map((range) => ({ ...range, keep: true })), roughRate(facts));
    const spans = most ? noLonger(whole, most, roughRate(facts)) : whole;
    if (!spans.length) return { why: "it is shorter than one picture" };
    const ranges = stretchesOf(spans);
    const why = await joined(file, to, { ranges, crops: needsReframe(facts) ? cropsFor(facts, ranges, stills) : null, streams }, deps);
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
async function cutClips(file, clips, { plan, facts, stills, streams = null }, deps) {
  const { progress = noProgress } = deps;
  const cut = [];
  for (const [i, clip] of clips.entries()) {
    progress.step("Cutting the short clips", `Cutting short clip ${i + 1} of ${clips.length}`);
    const out = clipOutputs(file, clip.n, clip.story.length, deps.outDir || undefined);
    const files = [];
    const failed = [];
    const whole = await cutPiece(file, out.video, clip.ranges, { facts, stills, streams }, deps);
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
        const part = await cutPiece(file, to, clip.story[k].ranges, { facts, stills, most: STORY_MAX, streams }, deps);
        if (part.why) failed.push(`part ${k + 1} of the Story of clip ${clip.n} could not be cut: ${part.why}`);
        else files.push(to);
      }
    }
    cut.push({ clip, files, failed });
  }
  return cut;
}

/** Make the preview of each of an episode's Reel candidates, in turn: in parts and then joined (previewSteps), each step by an
    ffmpeg run under the watchdog with a preview's limits (runGuarded and previewLimits, or `deps.runGuarded` for a test), so
    that no preview can grow without end. Resolves the candidates, each with `preview`, its path in the episode folder, when
    it was made, or `failed`, why not, in plain words. One that cannot be made does not stop the others. A candidate with no
    stretch already says why. The parts and their list are deleted once the join is over, whether or not it made the preview.
    The preview is held in the run's folder, for the episode to be filed with it. `streams` names the picture and the sound
    to take (streamsOf), as every other ffmpeg of the run is told. Nothing is thrown from here. */
async function makePreviews(file, given, { facts, streams = null }, deps) {
  const { progress = noProgress, log = () => {}, files, tools } = deps;
  const guarded = deps.runGuarded || runGuarded;
  const made = [];
  for (const [i, candidate] of given.entries()) {
    progress.step("Making the Reel previews", `Making the preview of Reel ${candidate.n} (${i + 1} of ${given.length})`);
    if (!candidate.ranges.length) {
      made.push(candidate);
      continue;
    }
    const to = join(dirname(file), previewPath(candidate.n));
    const writing = files.at(to);
    let steps = null;
    let why = "";
    try {
      steps = previewSteps({ video: file, ranges: candidate.ranges, out: writing, fps: roughRate(facts), duration: facts.duration, work: dirname(writing), size: { width: facts.width, height: facts.height }, streams });
      for (const step of [...steps.parts, null, steps.join]) {
        // The list of the parts is written just before the join.
        if (!step) {
          writeFileSync(steps.list.file, steps.list.text);
          continue;
        }
        const r = await guarded(tools.ffmpeg, step.args, previewLimits(step.seconds));
        if (r.stopped) why = `ffmpeg was stopped: ${r.stopped}`;
        else if (r.code !== 0) why = `ffmpeg stopped (${lastLine(r.stderr)})`;
        if (why) break;
      }
      if (!why && !existsSync(writing)) why = "ffmpeg made no file";
    } catch (e) {
      why = `the work stopped (${String(e.code || e.message).replace(/\.$/, "")})`;
    } finally {
      for (const part of steps ? steps.cleanup : []) rmSync(part, { force: true });
    }
    if (why) {
      rmSync(writing, { force: true });
      log(`${basename(file)}: the preview of Reel ${candidate.n} could not be made: ${why}.`);
      made.push({ ...candidate, failed: why });
    } else {
      files.done(to);
      made.push({ ...candidate, preview: previewPath(candidate.n) });
    }
  }
  return made;
}

/** What ffprobe wrote of the file's sound, as the Final Cut file says it: how many channels it has, and its samples a second.
    The sound is the one the tool takes (soundStream): of an iPhone's clip, its AAC, and not the APAC listed beside it. Either
    is left out when ffprobe does not say. */
export function soundOf(printed) {
  try {
    const sound = soundStream(JSON.parse(printed).streams) || {};
    return { audioChannels: Number(sound.channels) || undefined, audioRate: Number(sound.sample_rate) || undefined };
  } catch (e) {
    return {};
  }
}

/** Claude's ideas for graphics as notes for the Final Cut file: one for each idea that sits on a kept phrase of the plan, at
    the moment that phrase starts, worded so that nobody takes it for more than an idea. An idea whose phrase is cut, or is
    not in the plan, gets none: the Final Cut writer would put it on the join after it, as if it belonged there. The notes
    for the editor say what became of such an idea. */
export function ideaNotes(plan, graphics) {
  const phrases = new Map(plan.phrases.map((p) => [p.id, p]));
  return graphics.map((idea) => ({ on: phrases.get(idea.id), idea: idea.idea })).filter(({ on }) => on && on.keep).map(({ on, idea }) => ({ at: on.start, text: `Graphic idea: ${idea}` }));
}

/** The Final Cut file of a plan, for the video at `video`: {text}, or {why} there is none: the main video's project
    (projects.js mainProject), with what ffprobe printed of the video for its asset's sound and colour. `library` is where
    Final Cut Pro is to keep the project, and `writer` is what writes the file's text. */
function finalCut(video, { plan, facts, spans, srt, printed, ideas = [] }, { library, src, writer = fcpxml }) {
  if (!facts.height) return { why: "there is no picture in the file" };
  if (!spans.length) return { why: "the plan keeps nothing" };
  return mainProject({ video, facts, more: { ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) }, plan, srt, ideas, library, src, writer });
}

/** The first line of a light import's cut log: its times are the recording's, since no rough cut is made at a drop, and the plan
    is the rules' alone. */
const LIGHT_PLAN_NOTE = "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it.";

/** The episode on this Mac that a new video, given by its length in `seconds`, its `fingerprint` and its `words`, is a new
    version of (matchVersion, in versions.js): { id, folder }, or null. Each whole record in Episodes under `root` is a
    candidate, and an episode's words are read from its .words.json only when that file is whole on this Mac (`whole`):
    nothing is brought down from Dropbox for it, and the log says so, by the episode's label. A record of before the switch has
    no fingerprint, and never matches. Nothing is thrown from here: a folder that cannot be read is no match. */
function versionIn(root, mine, { log = () => {}, whole = isWhole }) {
  let names = [];
  try {
    names = readdirSync(episodesFolder(root)).filter((n) => !n.startsWith(".")).sort();
  } catch (e) {
    return null;
  }
  const records = new Map();
  const candidates = [];
  for (const n of names) {
    const folder = join(episodesFolder(root), n);
    const { record } = readEpisode(folder);
    if (!record || !record.video) continue;
    records.set(folder, record);
    candidates.push({ id: record.id, folder, kind: kindOf(record), archived: record.archived || null, session: record.session || null, seconds: record.video.seconds, fingerprint: record.fingerprint || "" });
  }
  const readWords = (folder) => {
    const record = records.get(folder);
    const named = record.label || basename(folder);
    const words = cutOutputs(join(folder, record.video.file)).words;
    if (!whole(words)) {
      log(`${named}: its words are not on this Mac, so it was not compared.`);
      return null;
    }
    try {
      const read = JSON.parse(readFileSync(words, "utf8")).words;
      if (Array.isArray(read)) return read;
    } catch (e) {
      // It cannot be read, and the line below says so.
    }
    log(`${named}: its words could not be read, so it was not compared.`);
    return null;
  };
  return matchVersion(mine, candidates, readWords);
}

/** The labels this Mac has given already, so that a light import does not give one of them again (kinds.js numbered): the
    label of each record in Episodes under `root`, and of each status of this Mac, `machine`, in Episodes/.importing. The
    status of this same import, of the video `video` with the import id `importId`, is left out, so that an import tried again
    keeps its label. A record or a status that cannot be read gives none. */
function labelsGiven(root, machine, { video, importId }) {
  const taken = [];
  let names = [];
  try {
    names = readdirSync(episodesFolder(root)).filter((n) => !n.startsWith("."));
  } catch (e) {
    // There is no Episodes folder yet, so no record has a label.
  }
  for (const n of names) {
    const { record } = readEpisode(join(episodesFolder(root), n), { pastCopies: true });
    if (record && typeof record.label === "string" && record.label) taken.push(record.label);
  }
  for (const { status } of readStatuses(root)) {
    if (!status || status.machine !== machine || !status.label) continue;
    if (status.video === video && (status.import || "") === importId) continue;
    taken.push(status.label);
  }
  return taken;
}

/** What a light import puts into a video's record beyond today's fields (spec 2026-10-22, section 1): her answer, waiting, with
    the tool's guess at the kind, what it saw, how the video came (kinds.js), and the id of the episode whose words it found
    in the video, or null (versionIn), as `answer.match`; and the fingerprint of its words. The match is only what her card
    offers first: the record's `versionOf` is set by her answer alone, never here. `name` is the file's, which only says
    whether it came from Zoom. With no plan the rules counted no retakes, so there is no guess. With no `facts`, when ffprobe
    could not read the file, nothing is said of how it came or what was seen: `came` is null and `seen` is "". */
function lightFields({ name, facts, plan, words, root }, deps) {
  const came = facts ? cameFrom({ name, facts }) : null;
  const fingerprint = fingerprintOf(words);
  const match = fingerprint && facts ? versionIn(root, { seconds: facts.duration, fingerprint, words }, deps) : null;
  const answer = { state: "needs your answer", guess: facts && plan ? guessKind({ facts, plan, came }) : null, seen: facts ? seenLine({ facts, plan, came }) : "", came, match: match ? match.id : null };
  return { answer, fingerprint };
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
  // A file is read through once in a run, however often it is looked at: `deps.broughtDown` holds those read, by name, inode
  // and size, for the run's whole folder.
  const bringDown = deps.bringDown || readThrough;
  const broughtDown = deps.broughtDown || new Set();
  const readKey = () => {
    const id = fileId(file);
    return id ? `${name}:${id.ino}:${id.size}` : name;
  };
  const sizes = [sizeOf(file)];
  while (!settled(sizes) || !whole(file)) {
    if (settled(sizes) && !broughtDown.has(readKey())) {
      broughtDown.add(readKey());
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
  // With this Mac's settings saying `import: "light"`, an episode's import is the light one (spec 2026-10-22, section 1): the
  // transcript, the cut plan and its text, and the rough cut's captions, worked out from the plan; no Claude, no video made,
  // no Final Cut file, no reels.json and no notes. Its record waits for her answer. Her screen may be shared, so the progress
  // panel and every notice name the video by its label, made of the Mac and the moment it was dropped, and never by its file:
  // `shown`. The label's short form, the one kept, holds no length, so it is known before the video is read. The moment is when
  // this Mac first saw the video in its drop folder (seen.json, filing.js noteSeen), so that a queue of drops keeps their own
  // times; when that was not noted, it is the moment this import began. Videos first seen at one look of the folder share
  // that moment, so a label this Mac has given already is numbered, "(2)", "(3)", as a session's is.
  const light = Boolean(episode && deps.light);
  const noted = light && arrived ? readSeen(episode.home)[seenKey(name, arrived)] : null;
  const dropped = noted && Number.isFinite(noted.at) ? new Date(noted.at) : deps.now ? deps.now() : new Date();
  const unnumbered = light ? labelFor({ seconds: 0, machine: episode.machine, at: localStamp(dropped) }).short : "";
  const label = light ? numbered(unnumbered, labelsGiven(episode.root, episode.machine, { video: name, importId: importIdOf(arrived) })) : "";
  const shown = light ? label : name;
  const work = episode ? join(runsFolder(episode.home), `${process.pid}-${Date.now()}`) : join(deps.tmpDir || tmpdir(), `brimm-unedited-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  // Whether the run's folder stays when the run ends: it does once an episode's files are in Dropbox, for the late check.
  let keepWork = false;
  // What the run writes goes through `files`. For a watched folder each file is held in the run's own folder until the video
  // is filed away with them, and otherwise each is put beside the video, or in --out, as soon as it is whole.
  const files = filesOf(work, { name, hold: Boolean(deps.watched), log, move: deps.move, copy: deps.copy });
  // An episode's import also says how far it has got in a status file in Episodes/.importing/, for both Macs to see. A light
  // import's status carries the video's label, for the commands to name it by in place of its file (Part F).
  if (episode) {
    const writeText = textWriter({ work: join(work, "status"), ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}) });
    progress = statusReporter(progress, { root: episode.root, machine: episode.machine, video: name, bytes: sizeOf(file), importId: importIdOf(arrived), label, writeText, log, ...(deps.every ? { every: deps.every } : {}), ...(deps.cancel ? { cancel: deps.cancel } : {}) });
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
    notify(episode ? `No transcript could be made from ${shown}. It stays in the drop folder; see the log.` : `No transcript could be made from ${name}. See the note beside it.`);
    return { ok: false, name, message: why };
  };
  // The progress panel is told each step as it begins. It is told the steps to come as far as they are known, and again as
  // more is known: whether there is an upright version to make, once the video has been read, and whether there are clips.
  // `asking` and not `claude`: the plan's own record of Claude's reply is called claude further down, in the same scope.
  const asking = !light && !deps.rulesOnly && Boolean(tools.claude);
  const watched = Boolean(deps.watched);
  progress.begin(shown);
  progress.steps(stepsFor({ claude: asking, wide: true, clips: asking && !episode, previews: asking && Boolean(episode), watched, light }));
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
    // The picture and the first sound this Mac's ffmpeg can read, which every ffmpeg the run asks for is told to take: an
    // iPhone's clip carries Apple's APAC beside its AAC, and ffmpeg on its own takes the sound with the most channels.
    const streams = streamsOf(printed);
    if (facts && streams.audio === null && streams.unreadable.length) return fail(`its sound is in a form this Mac's ffmpeg cannot read (${streams.unreadable.join(", ")})`);
    // An episode of a recording that is upright, square or short is a short video: it gets no upright version and no clips.
    const kind = episode && facts ? episodeKind(facts) : "";
    const wide = (f) => needsReframe(f) && kind !== "short video";
    if (facts) {
      progress.length(facts.duration);
      progress.steps(stepsFor({ claude: asking, wide: wide(facts), clips: asking && !episode, previews: asking && Boolean(episode) && kind !== "short video", watched, light }));
    }
    const wav = join(work, "sound.wav");
    const a = await run(tools.ffmpeg, ffmpegArgs(file, wav, streams.audio));
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
    // What came of asking Claude: {read} or {why}, and nothing when it was not asked. And the short clips as they were cut, or,
    // for an episode, its Reel candidates with their previews, and why there are none when there are none (reels.json).
    let asked = null;
    let cut = [];
    let candidates = [];
    let noReels = { none: kind === "short video" ? "it is a short video" : episode && facts && !facts.height ? "it has no picture" : "", cannotAsk: "" };
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
    /** What a plan comes to, as the log says it. */
    const sums = (made) => {
      const cuts = made.ranges.filter((r) => !r.keep).length;
      return `keeps ${stamp(Math.round(made.kept))} of ${stamp(Math.round(facts.duration))} and suggests ${cuts} cut${cuts === 1 ? "" : "s"}`;
    };
    /** The plan `made` as its file holds it (see where it is written, below), with `claude`, what Claude made of it, or null. */
    const planJson = (made, claude) => JSON.stringify({ version: 1, video: name, facts, phrases: made.phrases, ranges: made.ranges, kept: made.kept, cut: made.cut, pauses: planned.pauses.map(([start, end]) => [start, Math.min(end, facts.duration)]), by: made.by || "rules", ...(made.changes ? { changes: made.changes } : {}), ...(claude ? { claude } : {}) }, null, 2) + "\n";
    if (!plan) {
      if (!noReels.none) noReels = { none: "no cut plan could be made", cannotAsk: "" };
      missing.push(`no cut plan could be made: ${planned.why}`);
      files.text(out.planTxt, `No cut plan could be made for ${name}.\n\nWhy: ${planned.why}.\n\nIts transcript was made, and is beside this note.\n`);
    } else if (light) {
      // The light import makes no video: the words, the rough cut's captions, placed by the plan's own arithmetic, the cut log,
      // whose first line says its times are the recording's, and the plan, written last, as below.
      log(`${name}: the cut plan ${sums(plan)}.`);
      files.text(out.words, JSON.stringify({ video: name, duration: facts.duration, words: planned.words }, null, 2) + "\n");
      const roughSrt = roughCaptions(plan.phrases, keptSpans(plan.ranges, roughRate(facts)));
      files.text(out.roughTxt, stampedText(roughSrt));
      files.text(out.roughSrt, roughSrt);
      files.text(out.planTxt, planText(plan, LIGHT_PLAN_NOTE));
      files.text(out.plan, planJson(plan, null));
    } else {
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
        // A recording with no picture gets no Reel candidates: none could have a preview or a project.
        if (episode && !facts.height && clips.length) {
          log(`${name}: it has no picture, so the clips Claude picked are not Reel candidates.`);
          clips = [];
        }
        changes = (plan.changes || []).length;
        log(changes ? `${name}: Claude changed the cut plan in ${changes} place${changes === 1 ? "" : "s"}: it now ${sums(plan)}.` : `${name}: Claude changed nothing in the cut plan.`);
      }

      progress.steps(stepsFor({ claude: asking, wide: wide(facts), clips: clips.length > 0 && !episode, previews: clips.length > 0 && Boolean(episode), watched }));
      // Why an episode has no Reel candidates, when it has none, and why asking Claude again would not help, when it would not.
      if (episode && !noReels.none) {
        if (deps.rulesOnly) noReels = { none: "Claude was not asked", cannotAsk: `the import on ${episode.machine} is set to go by the rules alone`, rulesOnly: true };
        // The Mac is named: the other Mac, or this one later, may have Claude Code, and whether Claude can be asked is for the
        // Mac that shows the list to say.
        else if (!tools.claude) noReels = { none: `Claude was not asked, since Claude Code is not installed on ${episode.machine}`, cannotAsk: "" };
        else if (!read) noReels = { none: `Claude could not be asked (${asked.why})`, cannotAsk: "" };
        else if (!clips.length) noReels = { none: "Claude picked no clip that stands alone", cannotAsk: "" };
      }
      const spans = keptSpans(plan.ranges, roughRate(facts));
      let why = "";
      let note = "";
      try {
        files.text(out.words, JSON.stringify({ video: name, duration: facts.duration, words: planned.words }, null, 2) + "\n");
        const roughSrt = roughCaptions(plan.phrases, spans);
        files.text(out.roughTxt, stampedText(roughSrt));
        files.text(out.roughSrt, roughSrt);
        why = await roughCut(file, out.rough, { plan, facts, spans, streams }, deps);
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
        const made = await upright(file, out.vertical, { facts, spans, streams }, work, deps);
        ({ stills, centred } = made);
        if (made.why) lacks.push({ what: "upright version", why: made.why });
        else atCentre.push("the upright version");
      }

      // An episode's Reel candidates: Claude's clips, each with its stretches cropped on the speaker by the stills found for
      // the upright version, and a small upright preview of each. No full-size clip, no Story and no caption file: only a Reel
      // that is picked gets more (design, section 3). A preview that cannot be made is noted, as a clip that cannot be cut is.
      if (episode && clips.length) {
        log(`${name}: making the previews of ${clips.length} Reel candidate${clips.length === 1 ? "" : "s"}.`);
        candidates = await makePreviews(file, reelCandidates({ clips, plan, facts, stills }), { facts, streams }, deps);
        cut = candidates.map((c) => ({ clip: clips.find((clip) => clip.n === c.n), files: c.preview ? [join(dirname(file), c.preview)] : [], named: c.preview ? [c.preview] : [], failed: c.failed ? [`the preview of Reel ${c.n} could not be made: ${c.failed}`] : [] }));
        if (wide(facts) && candidates.some((c) => c.preview)) atCentre.push("the Reel previews");
      } else if (clips.length) {
        log(`${name}: cutting ${clips.length} short clip${clips.length === 1 ? "" : "s"}.`);
        cut = await cutClips(file, clips, { plan, facts, stills, streams }, deps);
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
      if (centred && atCentre.length) said.push(`${capital(listed(atCentre))} ${atCentre.includes("the short clips") || atCentre.includes("the Reel previews") ? "are" : "is"} cropped at the centre of the picture, and not on the speaker: ${centred}.`);

      missing.push(...lacks.map((lack) => `the ${lack.what} could not be made: ${lack.why}`), ...uncut);
      files.text(out.planTxt, planText(plan, [...lacks.map((lack) => `The ${lack.what} could not be made: ${lack.why}.${lack.note || ""}`), ...said].join("\n")));
      // The plan is written after everything made from it. It is what says this video is done, so a run cut short while the
      // rough cut, the upright version or a clip is being made does the video again. When it cannot be written the run
      // stops here, and the video is done again the next time: for a watched folder nothing has been put anywhere, and what
      // was held in the run's own folder goes with it. It keeps the pauses ffmpeg heard, which the plan was made from, so that
      // a reading made later, perhaps on the other Mac with no sound file, changes the plan with the same pauses (pausesOfPlan,
      // in notes.js). A pause that never ends lasts to the end of the video, and is written so: JSON has no time with no end,
      // and nothing changes by it. It says who made the plan. When Claude read it, it keeps what Claude decided, its ideas for
      // graphics as they were read, what was left out of its reply and why, and each clip with the names of the files that
      // were made of it, so that a person can see what changed. Nothing reads the ideas back yet: they are there for what is
      // made of the plan later. The title Claude recommends comes first, when it gave one: the import of an episode takes it
      // for the episode's title, for a person to approve.
      const claude = read ? { ...(read.title ? { title: read.title } : {}), decisions: read.decisions, graphics: read.graphics, ignored, clips: cut.map((made) => ({ ...made.clip, files: made.named || made.files.map((f) => basename(f)), ...(made.failed.length ? { failed: made.failed.map(sentence) } : {}) })) } : null;
      files.text(out.plan, planJson(plan, claude));
    }
    for (const what of missing) log(`${name}: ${what}.`);
    if (!missing.length) log(`${name}: done.`);
    // For a watched folder, the video is filed away with the files the run held for it, the plan last. Its Final Cut file
    // names it in the folder it is filed in: when it cannot be moved there, the file is first written again to name the
    // video where it stays.
    // An episode's Reel candidates go into reels.json, beside its other files, with why there are none when there are none.
    const reelsAt = join(dirname(file), REELS_FILE);
    if (episode && !light) {
      try {
        files.text(reelsAt, JSON.stringify(reelsFile({ video: name, by: "import", made: localStamp(deps.now ? deps.now() : new Date()), candidates, ...noReels }), null, 2) + "\n");
      } catch (e) {
        missing.push(`its list of Reel candidates could not be written: the work stopped (${e.code || e.message})`);
      }
    }
    const held = [out.srt, out.txt, out.words, out.planTxt, out.rough, out.roughSrt, out.roughTxt, out.vertical, out.fcpxml, out.notes, ...(episode ? [reelsAt] : []), ...cut.flatMap((made) => made.files), out.plan];
    if (deps.watched) progress.step("Filing");
    const unasked = asked && !asked.read ? " Claude could not be asked, so the plan is the rules' alone." : "";
    if (episode) {
      // An episode is filed into its own folder in Episodes, by clones, and the raw video stays in the drop folder until the
      // late check. When it cannot be filed, no record is written, and the next run files it again.
      const stem = basename(name, extname(name));
      let filed = null;
      try {
        const given = { file, made: held.filter((f) => files.has(f)), at: files.at, fcpxml: out.fcpxml, facts: facts || { duration: 0, width: 0, height: 0 }, printed, kind: kind || "episode", read: asked && asked.read, reels: kind === "short video" ? [] : reelEntries(candidates), work, dropFile: arrived };
        // A light import's video waits for her answer: it has no kind yet and no Final Cut file, and it has its label, its guess,
        // the fingerprint of its words, and the episode whose words it holds, when they match one on this Mac, for her card to
        // offer first. It is a new version of that one only once she says so.
        filed = fileEpisode(light ? { ...given, fcpxml: "", kind: null, label, ...lightFields({ name, facts, plan, words: planned.words || [], root: episode.root }, { log, whole }) } : given, deps);
        const match = light && filed.record.answer ? filed.record.answer.match : null;
        if (match) log(`${name}: its words are those of the episode ${match}, so her card offers it as a new version of that one.`);
        keepWork = true;
        // The late check is kept on this Mac's own disk, so a run stopped before it leaves it for the next run.
        const pending = { version: 1, id: filed.record.id, name: filed.name, folder: filed.path, video: name, bytes: filed.record.video.bytes, seconds: filed.record.video.seconds, drop: file, dropFile: arrived, importId: importIdOf(arrived), work, entries: filed.entries, lastCopy: (deps.clock || Date.now)(), root: episode.root, machine: episode.machine, planTxt: basename(out.planTxt), ...(light ? { label } : {}) };
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
      // The label names the Mac it was dropped on, so the notice does not say it again.
      if (filed && light) notify(`Ready: ${label}. In Claude, say "what's waiting?"`);
      else if (filed) notify(`Ready: ${stem}${lacks.length ? `, but ${listed(lacks.map((lack) => `its ${lack.what}`))} could not be made` : ""}. In Claude, say "open ${stem}".${unasked}`);
      else notify(`${shown} could not be put into Episodes. It stays in the drop folder; see the log.`);
      finished = !missing.length;
      return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder: filed ? filed.name : "", ...(filed ? { filed } : {}), message: missing.join("; ") };
    }
    const folder = deps.watched ? fileAway(deps.watched, file, held.filter((f) => files.has(f)), deps, day, () => nameAgain(file)) : "";
    const where = folder ? `, in the folder ${folder}` : "";
    if (plan) notify(`The cut plan for ${name} is ready${where}${lacks.length ? `, but ${listed(lacks.map((lack) => `its ${lack.what}`))} could not be made` : ""}.${unasked}`);
    else notify(`The transcript of ${name} is ready${where}, but no cut plan could be made. See ${basename(out.planTxt)}.`);
    finished = !missing.length;
    return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder, message: missing.join("; ") };
  } catch (e) {
    // Something nobody foresaw stopped an episode's import: its status says so, so that both Macs see it failed, and it is not
    // taken again until a person says to.
    if (episode) progress.fail(`the work stopped (${e.code || e.message})`);
    throw e;
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
export const described = (facts) => `${facts.duration} seconds, ${facts.width} by ${facts.height}${facts.fps ? ` at ${facts.fps}` : ""}`;
export const sameVideo = (a, b) => a.width === b.width && a.height === b.height && a.fps === b.fps && Math.abs(a.duration - b.duration) <= SAME_LENGTH;

/** Whether the first `length` bytes of the files at `a` and `b` are the same, read a megabyte at a time. False when either
    cannot be read. */
function startsAlike(a, b, length) {
  let fa;
  let fb;
  try {
    fa = openSync(a, "r");
    fb = openSync(b, "r");
    const size = 1024 * 1024;
    const ba = Buffer.alloc(size);
    const bb = Buffer.alloc(size);
    for (let at = 0; at < length; at += size) {
      const n = Math.min(size, length - at);
      if (readSync(fa, ba, 0, n, at) !== n || readSync(fb, bb, 0, n, at) !== n || !ba.subarray(0, n).equals(bb.subarray(0, n))) return false;
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    if (fa !== undefined) closeSync(fa);
    if (fb !== undefined) closeSync(fb);
  }
}

/** Whether the files at `a` and `b` hold the same bytes. */
function sameBytes(a, b) {
  const sa = statSync(a, { throwIfNoEntry: false });
  const sb = statSync(b, { throwIfNoEntry: false });
  return Boolean(sa && sb) && sa.size === sb.size && startsAlike(a, b, sa.size);
}

/** Put the files made again of an episode's video into its folder, by the rule: each made whole in the run's folder `work`,
    the one before deleted, the new one cloned in (replaceIn), never moved. Then the episode's record is written again, with
    each file's size as it is now, and, at least 15 minutes after the last copy (deps.wait), the late check looks at each
    again and copies in again one that is not as it put it, but never one someone else changed since (ownLateCheck). Resolves {put,
    problems, notes}: `put` says the files and the record went in, `problems` what could not be done, each in plain words:
    none when all was, and `notes` each file someone else changed since, which was left as it is. `change` makes any other change to the
    record, and `expectRev`, when given, is the rev the work was worked out from.
    Nothing is put in when the episode cannot be gone on with as it is now: its record cannot be read, a newer brimm-video
    wrote it, Dropbox undid this Mac's last change to it (episode.js undone), or its rev is not `expectRev`. A change of this
    Mac's that Dropbox took away is so never written over in silence.
    Nothing is left half done. Each file it replaces is first copied into the run's folder, and when a file cannot be put in,
    or the record cannot be written, every file put in so far is put back as it was (one that was not there is taken away
    again), and no record is written. What was put back has its late check too, after the same wait. One that cannot be put
    back is kept in BRIMM Video Work, in the episode's folder there, under "put back", and the problem says where. */
async function intoEpisode(file, madeAt, work, deps, { change = (record) => record, expectRev } = {}) {
  const { files, log = () => {} } = deps;
  const home = deps.home || homedir();
  const folder = dirname(file);
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const wait = deps.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const unchanged = "Nothing was changed in the episode";
  const rel = (to) => relative(folder, to).split(sep).join("/");
  // Why the episode cannot be gone on with as it is now, or "".
  const notAsWas = (found, rev) => {
    if (!found.record) return `the episode's record cannot be read: ${String(found.why || "it is not there").replace(/\.$/, "")}`;
    if (found.newer) return "the episode was written by a newer brimm-video. Ask Jason to update this Mac";
    const gone = undone(found.record, home);
    if (gone) return gone.replace(/\.$/, "");
    if (rev !== undefined && found.record.rev > rev) return "this episode changed on the other Mac meanwhile. Say it again";
    if (rev !== undefined && found.record.rev !== rev) return "the episode changed while this was made. Say it again";
    return "";
  };
  const before = readEpisode(folder);
  const first = notAsWas(before, expectRev);
  if (first) return { put: false, problems: [first, unchanged], notes: [], kept: [] };
  const problems = [];
  const entries = [];
  const sizes = {};
  // What each file put in replaced: a copy of the file that was there, on this Mac's disk, or null when none was.
  const done = [];
  // What this run left as it is, and why: a file the other Mac put in since, as the record lists, or one gone that the record
  // no longer lists.
  const notes = [];
  const theirs = (to, how) => notes.push(`${rel(to)} was put in by the other Mac since this Mac put it in, as the record lists, so ${how}`);
  // The copy that was there before each file this run put in, by where it went.
  const wasOf = (to) => (done.find((d) => d.to === to) || {}).was || null;
  /** What a late check or a put-back judges by, read now: `listed`, the files the record in force lists, by their paths,
      with their sizes, or null with `why` when no record can be trusted to judge (none can be read, as with a conflicted copy
      in the folder, or a newer one is still coming); and `conflicted`, the files that have a conflicted copy in the folder. */
  /** The other Mac's claim on the episode now, read past any conflicted copy, and from a conflicted copy of a record too: {held,
      name}, or null when no record that reads says another Mac has it open. */
  const claimNow = () => {
    const machine = deps.settings ? deps.settings.machine : "";
    const past = readEpisode(folder, { pastCopies: true });
    const own = past.record ? heldElsewhere(past.record, machine) : null;
    if (own) return { held: own, name: past.record.name.text, files: past.record.files || {} };
    // A copy older than the record in force is a race the other Mac lost: its claim does not hold.
    const floor = past.record ? past.record.rev : 0;
    for (const copy of conflictedCopies(folder).filter((c) => c.startsWith(`${RECORD_DIR}/`))) {
      try {
        const record = JSON.parse(readFileSync(join(folder, copy), "utf8"));
        if (!Number.isInteger(record.rev) || record.rev < floor) continue;
        const held = heldElsewhere(record, machine);
        if (held) return { held, name: record.name && record.name.text ? record.name.text : basename(folder), files: record.files || {} };
      } catch (e) {
        // A copy that does not read says nothing of a claim.
      }
    }
    return null;
  };
  const judgeNow = () => {
    const found = readEpisode(folder);
    const conflicted = new Set(conflictedCopies(folder).map(conflictedOf));
    // The other Mac has the episode open now (phase 1b's claim): nothing is copied into it again.
    const claim = claimNow();
    if (claim) return { listed: null, why: "", conflicted, held: claim.held, name: claim.name, claimFiles: claim.files };
    if (!found.record) return { listed: null, why: found.code === "CONFLICTED" ? "Dropbox has kept a conflicted copy in this episode" : `the episode's record cannot be read now (${String(found.why).replace(/\.$/, "")})`, conflicted };
    if (recordNumbers(folder).some((n) => n > found.record.rev)) return { listed: null, why: "A newer record of this episode is still coming", conflicted };
    return { listed: found.record.files || {}, why: "", conflicted };
  };
  /** Whether the file at `to` is a whole record, one that reads and whose rev is its number. */
  const wholeRecord = (to) => {
    try {
      const record = JSON.parse(readFileSync(to, "utf8"));
      return Number.isInteger(record.rev) && `${String(record.rev).padStart(4, "0")}.json` === basename(to);
    } catch (e) {
      return false;
    }
  };
  /** Whose the file at `to` is now, by what `judge` holds (judgeNow), with its words to break the tie. `ours` is the copy this
      run means to be there, of `bytes` bytes:
      - "conflicted": it has a conflicted copy in the folder, so which to keep is for a person to say;
      - "ours": its bytes are `ours`'s;
      - "missing": it is gone, and the record lists it (or no record can say); "unlisted": it is gone, and the record no
        longer lists it;
      - for a record file, which is written once each and never over: "otherRecord", another whole record of its number,
        which is a conflict for a person and not damage; or "damaged", when it is cut off or does not read;
      - "unjudged": it is not this run's, and no record can be trusted to say whose it is;
      - "theirs": the record lists another size for it, as every put of the other Mac's does;
      - "damaged": the record lists this run's size for it, but it is not this run's: Dropbox put back an older one, or left
        it part-written.
      Never by its size alone: an older file may be longer, and a record of this Mac's own may land meanwhile. */
  const whose = (to, ours, bytes, judge) => {
    const r = rel(to);
    if (judge.conflicted.has(r)) return "conflicted";
    const record = r.startsWith(`${RECORD_DIR}/`);
    if (!statSync(to, { throwIfNoEntry: false })) return record || !judge.listed || r in judge.listed ? "missing" : "unlisted";
    if (sameBytes(to, ours)) return "ours";
    if (record) return wholeRecord(to) ? "otherRecord" : "damaged";
    if (!judge.listed) return "unjudged";
    return judge.listed[r] === bytes ? "damaged" : "theirs";
  };
  /** Why the file at `to` was left as it is, for each judgement that leaves it and needs a person: "" for none. */
  const leftWhy = (now, to, judge) => {
    const r = rel(to);
    if (now === "conflicted") return `${r} has a conflicted copy in the episode: which to keep is for a person to say, so it was left as it is`;
    if (now === "unjudged") return judge.held ? `${judge.held.by} has ${judge.name} open now, so ${r} was left as it is` : `${judge.why}, so ${r} was left as it is`;
    if (now === "otherRecord") {
      let on = "";
      try {
        on = JSON.parse(readFileSync(to, "utf8")).writer.on || "";
      } catch (e) {
        on = "";
      }
      return `${r} is another record of the same number, written meanwhile${on ? ` on ${on}` : ""}: which to keep is for a person to say, so this Mac's was not copied over it`;
    }
    return "";
  };
  /** The late check of what this run put in, or put back (`from` is the copy that should be there): a file that is gone or
      damaged is put in again, by the rule; one the other Mac put in since, or one gone that the record no longer lists, is
      left as it is, and a note says so; and one with a conflicted copy, another record of this run's number, or a file no
      record can judge now is left, and the problem says a person must choose. Gives back {problems, checked}: what could not
      be put in again, or needs a person, and the entries it looked after. */
  const ownLateCheck = (list) => {
    const problems = [];
    const checked = [];
    // Once the other Mac has the episode, nothing is copied into it again: what is not as this Mac put it is said, for that
    // Mac to put right, as finish does (phase 1b, T20).
    // Each file not as this Mac put it is kept, for the record in force lists it: the run's folder goes when it ends.
    // A file with a conflicted copy is for a person to choose; one the claim's own record lists at its size is the other
    // Mac's, and only noted.
    const leave = (rest, judge) => {
      for (const e of rest) {
        if (judge.conflicted.has(rel(e.to))) {
          problems.push(leftWhy("conflicted", e.to, judge));
          continue;
        }
        if (sameBytes(e.to, e.from)) continue;
        const hers = judge.claimFiles ? judge.claimFiles[rel(e.to)] : undefined;
        const there = statSync(e.to, { throwIfNoEntry: false });
        // The file that was there before this run is Dropbox's revert, whatever a claim made from the record before lists.
        const was = wasOf(e.to);
        if (there && Number.isInteger(hers) && hers !== e.bytes && there.size === hers && !(was && sameBytes(e.to, was))) {
          theirs(e.to, "its late check left it as it is");
          continue;
        }
        const kept = keep(e.to, e.from);
        problems.push(`${rel(e.to)} is not as this Mac put it at the late check, and ${judge.held.by} has ${judge.name} open now, so it was not copied in again${kept ? `. This Mac's copy is kept at ${kept}` : ""}`);
      }
      return { problems, checked, held: true };
    };
    const first = judgeNow();
    if (first.held) return leave(list, first);
    // This run's record files first: the record in force, which judges the rest, may be one Dropbox took away.
    const isRecord = (e) => rel(e.to).startsWith(`${RECORD_DIR}/`);
    let judge = { listed: null, why: "", conflicted: first.conflicted };
    for (const e of [...list.filter(isRecord), null, ...list.filter((x) => !isRecord(x))]) {
      if (e === null) {
        judge = judgeNow();
        if (judge.held) return leave(list.filter((x) => !isRecord(x)), judge);
        continue;
      }
      const now = whose(e.to, e.from, e.bytes, judge);
      if (now === "ours") {
        checked.push(e);
        continue;
      }
      if (now === "theirs") {
        theirs(e.to, "its late check left it as it is");
        continue;
      }
      if (now === "unlisted") {
        notes.push(`${rel(e.to)} is gone, and the record no longer lists it, so its late check left it out`);
        continue;
      }
      const left = leftWhy(now, e.to, judge);
      if (left) {
        problems.push(left);
        continue;
      }
      checked.push(e);
      log(`${rel(e.to)} is not as this Mac put it at the late check (${now === "missing" ? "it is not there" : "it is another file, though the record lists this Mac's"}), so it is copied in again from its work copy.`);
      try {
        mkdirSync(dirname(e.to), { recursive: true });
        replaceIn(e.from, e.to, opts);
      } catch (err) {
        problems.push(String(err.message).replace(/\.$/, ""));
      }
    }
    return { problems, checked };
  };
  /** Keep a copy of the file that was at `to`, from `was`, where a person can find it: BRIMM Video Work, in the episode's
      folder there, under "put back". Gives back where, or "" when it could not be kept. */
  const keptNow = [];
  const keep = (to, was) => {
    try {
      const kept = join(episodeWork(home, basename(folder)), "put back", rel(to));
      mkdirSync(dirname(kept), { recursive: true });
      copyFileSync(was, kept);
      keptNow.push(kept);
      return kept;
    } catch (k) {
      return "";
    }
  };
  /** Put back what was put in, and make the late check of what was put back, and of what was taken away. The record in force
      judges, as at the late check: a file is put back when it is this run's, gone, or damaged against the size the record
      lists; one the other Mac put in since is left; and one that is as it was before already is left so. */
  const undo = async () => {
    const back = [];
    const gone = [];
    let whole = true;
    const judge = judgeNow();
    for (const { to, was } of done.reverse()) {
      const before = was ? statSync(was).size : undefined;
      // As it was before already, as when its delete was refused: there is nothing to put back, nor to check.
      if (was && sameBytes(to, was) && !judge.conflicted.has(rel(to))) continue;
      const there = existsSync(to);
      if (!there && !was) continue;
      if (judge.conflicted.has(rel(to))) {
        whole = false;
        problems.push(leftWhy("conflicted", to, judge));
        continue;
      }
      if (there && !sameBytes(to, files.at(to))) {
        if (!judge.listed) {
          problems.push(leftWhy("unjudged", to, judge));
          continue;
        }
        if (judge.listed[rel(to)] !== before) {
          theirs(to, "it was left as it is, not put back");
          continue;
        }
      }
      try {
        if (was) {
          replaceIn(was, to, opts);
          back.push({ from: was, to, bytes: before });
        } else {
          rmSync(to, { force: true });
          gone.push({ from: files.at(to), to });
        }
      } catch (e) {
        whole = false;
        const kept = was ? keep(to, was) : "";
        // When this run's file stays there, a copy of it beside the kept one lets a later run tell it from the other Mac's.
        if (kept && sameBytes(to, files.at(to))) {
          try {
            copyFileSync(files.at(to), `${kept}.unlisted`);
          } catch (k) {
            // Without it, the kept one is not named later, which costs only the hint.
          }
        }
        problems.push(`${rel(to)} could not be put back as it was: ${String(e.message).replace(/\.$/, "")}${kept ? `. The one that was there is kept at ${kept}` : ""}`);
      }
    }
    if (back.length || gone.length) {
      log(`${basename(file)}: what was put back has its late check in ${LATE_CHECK_MS / 60000} minutes.`);
      if (deps.progress) deps.progress.step("Waiting for the late check");
      await wait(LATE_CHECK_MS);
      const late = ownLateCheck(back);
      problems.push(...late.problems);
      if (late.held && late.problems.length) whole = false;
      // A file its late check could not copy in again is kept too: its work copy goes with the run's folder.
      for (const e of late.checked) {
        if (sameBytes(e.to, e.from)) continue;
        whole = false;
        const kept = keep(e.to, e.from);
        problems.push(`${rel(e.to)} could not be put back as it was at its late check${kept ? `. The one that was there is kept at ${kept}` : ""}`);
      }
      // A file this run took away that Dropbox brought back, still this run's and listed by no record, is taken away again.
      const now = judgeNow();
      // Under the other Mac's claim nothing is taken away; a file of this run's that came back is named.
      if (now.held) {
        for (const g of gone) {
          if (!existsSync(g.to) || !sameBytes(g.to, g.from)) continue;
          whole = false;
          problems.push(`${rel(g.to)} is this run's, and no record lists it, but ${now.held.by} has ${now.name} open now, so it was left as it is`);
        }
      }
      for (const g of now.held ? [] : gone) {
        if (!existsSync(g.to) || !sameBytes(g.to, g.from) || !now.listed || rel(g.to) in now.listed || now.conflicted.has(rel(g.to))) continue;
        log(`${rel(g.to)} came back at the late check, though this Mac took it away, so it is taken away again.`);
        try {
          rmSync(g.to, { force: true });
        } catch (e) {
          whole = false;
          problems.push(`${rel(g.to)} could not be taken away again: ${String(e.message).replace(/\.$/, "")}`);
        }
      }
    }
    problems.push(whole ? unchanged : "Everything else was put back as it was");
  };
  for (const to of madeAt) {
    let was = null;
    try {
      mkdirSync(dirname(to), { recursive: true });
      if (existsSync(to)) {
        was = join(work, "before", rel(to));
        mkdirSync(dirname(was), { recursive: true });
        copyFileSync(to, was);
      }
      done.push({ to, was });
      replaceIn(files.at(to), to, opts);
      const bytes = statSync(files.at(to)).size;
      entries.push({ from: files.at(to), to, bytes });
      sizes[rel(to)] = bytes;
    } catch (e) {
      // The rule's own message names the file already; any other is said of it.
      const said = String(e.message).replace(/\.$/, "");
      problems.push(said.startsWith(basename(to)) ? said : `${rel(to)} could not be put into the episode: ${said}`);
      break;
    }
  }
  if (problems.length) {
    await undo();
    return { put: false, problems, notes, kept: keptNow };
  }
  if (!entries.length) return { put: false, problems, notes, kept: keptNow };
  // The record is read again, and written only when it is still the one the files were put in by.
  const found = readEpisode(folder);
  try {
    const why = notAsWas(found, before.record.rev);
    if (why) throw new Error(why);
    const writer = { commit: deps.commit || (deps.settings ? commitOf(deps.settings.checkout) : "unknown"), on: deps.settings ? deps.settings.machine : "unknown" };
    const write = textWriter({ work: join(work, "record"), keep: true, ...opts });
    writeEpisode(folder, change({ ...found.record, files: { ...found.record.files, ...sizes } }), { expectRev: before.record.rev, writeText: (to, text) => entries.push(write(to, text)), writer, home });
  } catch (e) {
    problems.push(`the episode's record could not be written again: ${String(e.message).replace(/\.$/, "")}`);
    await undo();
    return { put: false, problems, notes, kept: keptNow };
  }
  log(`${basename(file)}: put into its episode. Its late check is in ${LATE_CHECK_MS / 60000} minutes.`);
  if (deps.progress) deps.progress.step("Waiting for the late check");
  await wait(LATE_CHECK_MS);
  problems.push(...ownLateCheck(entries).problems);
  return { put: true, problems, notes, kept: keptNow };
}

/** Ask Claude again for an episode's Reel candidates (edit.js ask, detached): with the import's own request and locked-down
    call, of the cut plan the import wrote. Only its clips are taken: the rough cut is made, so its decisions are not applied,
    and its clips are read on the plan as it is. The faces are found again for the crops, and each new candidate gets its
    preview, as at the import. Every candidate and Reel already there stays as it is, with its number, its stretch and its
    preview, and the new candidates are numbered on from the highest number ever given (mergeCandidates). When none is new,
    nothing is written. Then the previews, reels.json and the
    record go into the episode by the rule, and the late check is made after its wait. When Claude cannot be asked, or picks
    nothing, nothing is changed. `found` is {folder, record}; `deps` as the import's, with `home`, `settings` and `wait`.
    Resolves the detached run's result: {ok, made, failed, next}. */
/** Why the import of the episode whose record is `record` still holds its video, in plain words, with what to do: its
    status in Episodes/.importing/ under `root` says, at `now`, that it is at work on either Mac (its own late check to come
    within the run), that it failed, or that its late check found a problem; this Mac, `machine`, has the late check of its
    import still to make (filing.js readPendings, in `home`, kept under this Mac's name and root, as its import makes them);
    or its status says it stopped on either Mac before its late check, which that Mac makes when its import next runs, or
    at once when told to "try it again" (edit.js retry). "" when none holds it. Nothing that puts files into the episode goes
    on meanwhile: the import's late check would meet files it did not put there, and put its own back over them. */
export function importHolds({ root, home, machine, record, now = Date.now() }) {
  const video = record.video.file;
  const said = (text) => String(text).replace(/\.$/, "");
  const again = (on) => `say "try it again" for ${video} on ${on}, then say this again`;
  const statuses = readStatuses(root, now).map((s) => s.status).filter((s) => s && s.video === video && s.bytes === record.video.bytes);
  const state = (want) => statuses.find((s) => importState(s, now) === want);
  const running = state("running");
  if (running) return `The import of this episode has not finished on ${running.machine} yet: it is at "${running.step}". Say it again when it has.`;
  const failed = state("failed");
  if (failed) return `The import of this episode failed on ${failed.machine}: ${said(failed.failed)}. Say "try it again" to import it again.`;
  const problem = state("problem");
  if (problem) return `The late check of this episode's import found a problem: ${said(problem.problem)}. Once it is put right, ${again(problem.machine)}.`;
  const owed = readPendings(home).find((p) => p.id === record.id && (!machine || p.machine === machine) && resolve(String(p.root)) === resolve(root));
  if (owed && owed.problem) return `The late check of this episode's import found a problem: ${said(owed.problem)}. Once it is put right, ${again(owed.machine)}.`;
  // No import of the video is at work here (a running status would have said so), so none makes the check unless told to.
  if (owed && dueAt(owed) > now) return `This Mac has still to make the late check of this episode's import, due at ${clockAt(dueAt(owed))}. Say "try it again" for ${video} to have it made then, then say this again.`;
  if (owed) return `This Mac has still to make the late check of this episode's import. Say "try it again" for ${video} to have it made now, then say this again.`;
  const stopped = state("stopped");
  if (stopped) return `The import of this episode stopped on ${stopped.machine} before its late check was made. On ${stopped.machine}, say "try it again" for ${video}, then say this again.`;
  return "";
}

/** A moment, `ms`, as this Mac's clock shows it: "14:05". */
export const clockAt = (ms) => {
  const at = new Date(ms);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

/** The copy of the episode's reels.json a put-back of this Mac's kept (intoEpisode), in BRIMM Video Work under `home`, when
    it is the list the record lists, by its size, and the list in the episode is gone, or is this Mac's own put that its
    put-back could not take away (kept beside it as reels.json.unlisted): its path, or "". A copy at another size is an older
    list; and a list there that is not this Mac's own may be the other Mac's newer one, whose record is still coming. */
export function keptList({ folder, record, home }) {
  const listed = record.files ? record.files[REELS_FILE] : undefined;
  const kept = join(episodeWork(home, basename(folder)), "put back", REELS_FILE);
  const there = statSync(kept, { throwIfNoEntry: false });
  if (!Number.isInteger(listed) || !there || there.size !== listed) return "";
  const at = join(folder, REELS_FILE);
  return !existsSync(at) || sameBytes(at, `${kept}.unlisted`) ? kept : "";
}

/** Why reels.json cannot be gone on with, in plain words: the episode's record (`record`) lists it, but it is not in the
    episode's folder `folder`, or it is there at another size than the record lists, as an older one Dropbox put back. A new
    list would then hold the new candidates and not those in the one the record lists. When this Mac kept a copy of the
    listed one (keptList), it says where; no other copy is named. "" when it is the one listed, or the record does not list
    it, as of an episode imported before phase 3. */
export function listGone({ folder, record, home }) {
  const listed = record.files ? record.files[REELS_FILE] : undefined;
  if (listed === undefined) return "";
  const kept = home ? keptList({ folder, record, home }) : "";
  const there = statSync(join(folder, REELS_FILE), { throwIfNoEntry: false });
  const after = kept ? ` The one its record lists is kept at ${kept}: ask Jason to put it back.` : "";
  if (!there) return `${REELS_FILE} is missing from this episode, though its record lists it, so Claude is not asked: the candidates in it would be lost.${after}`;
  if (Number.isInteger(listed) && there.size !== listed) return `${REELS_FILE} in this episode is not the one its record lists (it is ${there.size} bytes, and the record lists ${listed}), so Claude is not asked: the candidates in the one it lists would be lost.${after || " Say it again once Dropbox has brought that one."}`;
  return "";
}

/** Why Claude cannot be asked again for the Reel candidates of the episode in `folder`, whose record is `record`: {why}, in
    plain words, with `bring`, the files Dropbox has still to bring over to this Mac, when that is why; {} when it can be
    asked. The quick part of `ask` and the detached part both look, in this order, for:
    - a video waiting for its answer, and a client or group session, by its kind or its mark, whose mark is not cleared or
      that has none (spec 2026-10-22, section 2): nothing of the first goes to Claude until she says what it is, and a
      session's words go only to its own reading;
    - a short video, which gets no Reels;
    - the other Mac having it open (phase 1b's claim, episode.js heldText);
    - a change of this Mac's that Dropbox undid (episode.js undone);
    - the import of the video still holding it (importHolds): its late check still to come on this Mac (in `home`) or on
      either Mac by its status under `root` at `now`, or one that failed or found a problem;
    - no cut plan, a reels.json the record lists that is gone (listGone), and the video, its cut plan or reels.json not
      whole on this Mac (`whole`);
    - a recording with no picture, as its cut plan says, which gets no Reels;
    - a list of candidates that cannot be read, as one a newer brimm-video wrote, which a new one would be written over;
    - an import told to go by the rules alone, as the list says (`rulesOnly`). */
export function askBlocked({ folder, record, root, home, machine, now = Date.now(), whole = isWhole }) {
  if (kindOf(record) === null) return { why: "This video is waiting for its answer: say what it is first." };
  // A session is known by its kind or by its mark, and only a mark that is cleared lets Claude read it: a record of kind
  // "session" with no mark at all is refused too.
  if ((kindOf(record) === "session" || record.session) && !(record.session && record.session.cleared)) return { why: "This is a client or group session: Claude reads it only for its teachings." };
  if (record.kind === "short video") return { why: "A short video gets no Reels." };
  // The other Mac has it open (phase 1b's claim): nothing is put into it from here meanwhile.
  const open = heldText(record, machine);
  if (open) return { why: open };
  const gone = undone(record, home);
  if (gone) return { why: gone };
  const held = importHolds({ root, home, machine, record, now });
  if (held) return { why: held };
  const name = record.video.file;
  const plan = `${basename(name, extname(name))}.cut-plan.json`;
  if (!existsSync(join(folder, plan))) return { why: `${name} has no cut plan here, so Claude cannot be asked.` };
  const lost = listGone({ folder, record, home });
  if (lost && !existsSync(join(folder, REELS_FILE))) return { why: lost };
  const listed = existsSync(join(folder, REELS_FILE));
  const bring = (coming) => ({ why: `Dropbox is still bringing ${coming.join(", ")} over to this Mac. Say "ask Claude again for Reels" again when it is done.`, bring: coming });
  // What the cut plan and the list decide is decided before the video is brought, so it is never brought only to be refused.
  const small = [plan, ...(listed ? [REELS_FILE] : [])].filter((rel) => !whole(join(folder, rel)));
  if (small.length) return bring(small);
  let facts = null;
  try {
    facts = JSON.parse(readFileSync(join(folder, plan), "utf8")).facts || null;
  } catch (e) {
    return { why: `The cut plan of ${name} cannot be read (${e instanceof SyntaxError ? "it is not JSON" : e.code || e.message}), so Claude cannot be asked.` };
  }
  if (!facts || !facts.height) return { why: "A recording with no picture gets no Reels." };
  if (listed) {
    const read = readReels(readFileSync(join(folder, REELS_FILE), "utf8"));
    if (read.why) return { why: `The list of Reel candidates cannot be read: ${read.why.replace(/\.$/, "")}.` };
    if (read.reels.rulesOnly === true) return { why: `Claude cannot be asked for Reels: ${read.reels.cannotAsk || "its import went by the rules alone"}.` };
    if (lost) return { why: lost };
  }
  return whole(join(folder, name)) ? {} : bring([name]);
}

export async function askAgain({ folder, record }, deps) {
  const { log = () => {} } = deps;
  const as = "The Reel candidates are as they were.";
  const blocked = askBlocked({ folder, record, root: deps.settings.root, home: deps.home || homedir(), machine: deps.settings.machine, now: deps.now ? deps.now() : Date.now(), whole: deps.isWhole || isWhole });
  if (blocked.why) return { ok: false, made: [], failed: [blocked.why], next: as };
  const name = record.video.file;
  const video = join(folder, name);
  const stem = basename(name, extname(name));
  const plan = JSON.parse(readFileSync(join(folder, `${stem}.cut-plan.json`), "utf8"));
  const work = join(runsFolder(deps.home || homedir()), `ask-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    // ffprobe is asked which streams the video has, so that each preview takes the picture and the sound a run takes.
    const probed = join(work, "facts.json");
    const probe = await deps.run(deps.tools.ffprobe, probeArgs(video, probed));
    const printed = probe.code === 0 && existsSync(probed) ? readFileSync(probed, "utf8") : "";
    if (!printed || !factsOf(printed)) return { ok: false, made: [], failed: [`${name} could not be read (${lastLine(probe.stderr)}).`], next: as };
    const streams = streamsOf(printed);
    const asked = await askClaude(name, plan, plan.facts, work, deps);
    if (!asked.read) return { ok: false, made: [], failed: [`Claude could not be asked (${asked.why}).`], next: as };
    // The plan was read back from its file, so the pauses ffmpeg heard are the ones it kept.
    const picked = clipRanges(plan, asked.read.clips, pausesOfPlan(plan));
    // What was wrong with Claude's reply, and the clips of it that were left out, are said whatever else happens.
    const said = [...asked.read.problems, ...picked.ignored];
    if (!picked.clips.length) return { ok: true, made: [], failed: said, next: `Claude picked no clip that stands alone. ${as}` };
    const seen = await facesIn(video, work, deps).catch((e) => ({ why: `the work stopped (${e.code || e.message})` }));
    if (seen.why) log(`${name}: the faces could not be looked for (${seen.why}), so the new candidates are cropped at the centre of the picture.`);
    const fresh = reelCandidates({ clips: picked.clips, plan, facts: plan.facts, stills: seen.stills || [] });
    // The list is read again, as it is now that Claude has answered, and a list that cannot be read now is refused, as at the
    // start: one a newer brimm-video wrote meanwhile is never written over.
    const reelsAt = join(folder, REELS_FILE);
    const listed = existsSync(reelsAt) ? readFileSync(reelsAt, "utf8") : null;
    const read = listed === null ? null : readReels(listed);
    if (read && read.why) return { ok: false, made: [], failed: [...said, `The list of Reel candidates cannot be read: ${read.why.replace(/\.$/, "")}.`], next: as };
    // The record is read again for it: the other Mac's ask may have landed meanwhile, which the rev check then says.
    const lost = listGone({ folder, record: readEpisode(folder).record || record, home: deps.home || homedir() });
    if (lost) return { ok: false, made: [], failed: [...said, lost], next: "" };
    const merged = mergeCandidates({ old: read ? read.reels : null, fresh, record });
    if (!merged.added.length) return { ok: true, made: [], failed: [...said, ...merged.ignored], next: `Every clip Claude picked has words of a Reel or a candidate already there. ${as}` };
    const files = filesOf(work, { name, hold: true, log });
    const made = await makePreviews(video, merged.added, { facts: plan.facts, streams }, { ...deps, files });
    const candidates = merged.candidates.map((c) => made.find((m) => m.n === c.n) || c);
    const entries = merged.entries.map((e) => {
      const m = made.find((c) => c.n === e.n);
      return m ? { ...e, files: m.preview ? [m.preview] : [] } : e;
    });
    files.text(reelsAt, JSON.stringify(reelsFile({ video: name, by: "ask", made: localStamp(deps.now ? new Date(deps.now()) : new Date()), candidates, highest: merged.highest }), null, 2) + "\n");
    // Nothing goes in when the record or the list changed while Claude was asked: the candidates were worked out from them as
    // they were.
    const now = readEpisode(folder);
    const nowListed = existsSync(reelsAt) ? readFileSync(reelsAt, "utf8") : null;
    if (!now.record || now.record.rev !== record.rev || nowListed !== listed) return { ok: false, made: [], failed: [...said, "This episode changed while Claude was asked, so nothing was changed. Ask again."], next: as };
    const madeAt = [...made.filter((c) => c.preview).map((c) => join(folder, c.preview)), reelsAt];
    const into = await intoEpisode(video, madeAt, work, { ...deps, files }, { change: (r) => ({ ...r, reels: entries }), expectRev: record.rev });
    const failed = [...said, ...merged.ignored, ...made.filter((c) => c.failed).map((c) => `The preview of Reel ${c.n} could not be made: ${c.failed}.`), ...into.problems.map((p) => `${p}.`), ...into.notes.map((n) => `${n}.`)];
    // When the put was undone, no Reel was made; and when reels.json could not be put back, the list is not as it was.
    const kept = into.kept.find((k) => basename(k) === REELS_FILE && basename(dirname(k)) === "put back");
    const oursStays = existsSync(reelsAt) && sameBytes(reelsAt, files.at(reelsAt));
    const lostList = listed !== null && !existsSync(reelsAt) ? `${REELS_FILE} is not in the episode now.${kept ? ` A copy of it is kept at ${kept}: ask Jason to put it back.` : ""}`
      : !into.put && oursStays ? `${REELS_FILE} in the episode is this run's new list, which its record does not list.${kept ? ` The one it lists is kept at ${kept}: ask Jason to put it back.` : ""}` : "";
    if (!into.put) return { ok: false, made: [], failed, next: lostList || as };
    const next = into.problems.length ? lostList || `Not everything is as this Mac put it: what is not done says which${into.kept.length ? ", and where this Mac's copies are kept" : ""}.` : "Say \"show me the Reels\" to see them.";
    return { ok: !into.problems.length && !made.some((c) => c.failed), made: merged.added.map((c) => `Reel ${c.n}`), failed, next };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** What --from-plan says when it is asked for a light episode, whose videos are made when it is read. */
const LIGHT_REFUSAL = "This episode was imported lightly: its videos are made when it is read, not from the plan.";
/** What --from-plan says when a newer brimm-video wrote the episode's record. */
const NEWER_STOP = "its episode was written by a newer brimm-video. Ask Jason to update this Mac";

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
    `message` saying why.
    A video in an episode's folder (one with a record/) is made again only when the episode can be gone on with: it stops in
    the same way when the record cannot be read (a conflicted copy, or an import not finished), when this Mac has no settings
    for episodes, when Dropbox undid this Mac's last change to it, while the import still holds the video (importHolds), and
    while another command is at work on the episode. The work holds the episode's lock, kept awake, and waits for the late
    check of what it put in before it ends.
    A light episode, one whose record is at layout 3, is never made again from its plan: it stops first of all, before anything
    is read or made and with or without --out, saying it was imported lightly (LIGHT_REFUSAL). Before even that, an episode
    whose record a newer brimm-video wrote stops in the same way, saying so (NEWER_STOP). */
export async function videosFromPlan(file, deps) {
  const { log = () => {} } = deps;
  const name = basename(file);
  const out = cutOutputs(file, deps.outDir || undefined);
  const stop = (why) => {
    log(`${name}: ${why}. Nothing was made.`);
    return { ok: false, name, made: [], stopped: true, message: why };
  };
  // A light episode is never made again from its plan (spec 2026-10-22, "Who else keeps the heavy path"): that would make the
  // whole-video rough cut and the upright version the light import leaves out, and its videos are made when it is read. It is
  // the record that says what an episode is: layout 3, which is a kind other than "episode" or "short video", an answer, and
  // the rest of the switch's fields. The refusal is the first thing, before the plan is read or anything is made, and it is
  // the same with --out. A record a newer brimm-video wrote is refused first, in today's words: what it is cannot be read
  // here, so it is never taken for a light episode, nor made from.
  const folder = dirname(file);
  if (existsSync(join(folder, RECORD_DIR))) {
    const { record, newer } = readEpisode(folder, { pastCopies: true });
    if (newer) return stop(NEWER_STOP);
    if (record && layoutOf(record) === 3) {
      log(`${name}: ${LIGHT_REFUSAL} Nothing was made.`);
      return { ok: false, name, made: [], stopped: true, message: LIGHT_REFUSAL };
    }
  }
  // Videos written straight into an episode's folder would skip the claim, the lock and the rule: --out anywhere in one, or in
  // Episodes itself, is refused.
  if (deps.outDir) {
    // --out as the disk has it: its nearest folder that is there, with links followed and its own case, then the rest as
    // given. So a link to Episodes, or Episodes in another case, is seen for what it is.
    let near = resolve(deps.outDir);
    let rest = "";
    while (!existsSync(near) && dirname(near) !== near) {
      rest = rest ? join(basename(near), rest) : basename(near);
      near = dirname(near);
    }
    const realOf = (p) => {
      try {
        return realpathSync.native(p);
      } catch (e) {
        return resolve(p);
      }
    };
    const at = rest ? join(realOf(near), rest) : realOf(near);
    // Only a real episode counts: a folder whose record/, so named, is a folder holding record files.
    const isEpisode = (d) => {
      try {
        return readdirSync(d).includes(RECORD_DIR) && statSync(join(d, RECORD_DIR)).isDirectory() && recordNumbers(d).length > 0;
      } catch (e) {
        return false;
      }
    };
    let inEpisode = false;
    for (let d = at; !inEpisode; d = dirname(d)) {
      inEpisode = isEpisode(d);
      if (dirname(d) === d) break;
    }
    const episodes = deps.settings ? realOf(episodesFolder(deps.settings.root)) : null;
    if (inEpisode || (episodes && `${at}${sep}`.toLowerCase().startsWith(`${episodes}${sep}`.toLowerCase()))) return stop("--out is in an episode's folder, or is Episodes itself: an episode's videos are made again without --out, so they go in by the rule");
  }
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
  // A video in an episode's folder, which has a record/ whatever its record says: what is made of it goes into the folder by
  // the rule (dropbox.js), never by a move, and only when the episode can be gone on with. The work holds the episode's lock,
  // as a detached command of edit.js does, so that no other works on the episode meanwhile.
  if (deps.outDir || !existsSync(join(folder, RECORD_DIR))) return remakeVideos(file, { out, plan, episode: false, stop }, deps);
  const read = readEpisode(folder);
  if (!read.record) return stop(`its episode's record cannot be read: ${read.why}`);
  if (read.newer) return stop(NEWER_STOP);
  if (!deps.settings) return stop("this Mac has no settings for episodes, so nothing can be put into its episode");
  const home = deps.home || homedir();
  const held = undone(read.record, home) || heldText(read.record, deps.settings.machine) || importHolds({ root: deps.settings.root, home, machine: deps.settings.machine, record: read.record, now: deps.clock ? deps.clock() : Date.now() });
  // Its own closing is the run's: "Nothing was made."
  if (held) return stop(held.replace(/ Nothing was changed\.$/, "").replace(/\.$/, ""));
  let made = null;
  const ran = await runDetached({ home, folder: basename(folder), command: "from-plan", ...(deps.keepAwake ? { keepAwake: deps.keepAwake } : {}), ...(deps.alive ? { alive: deps.alive } : {}) }, async () => {
    made = await remakeVideos(file, { out, plan, episode: true, stop, expectRev: read.record.rev }, deps);
    return { ok: made.ok, made: made.made, failed: made.message ? [made.message] : [], next: "" };
  });
  if (ran.running || ran.taking) return stop(ran.running ? `${ran.running} is running for ${basename(folder)} already` : `another run is taking over the lock of ${basename(folder)}`);
  return made || { ok: false, name, made: [], message: ran.failed.join(" ") };
}

/** The work of videosFromPlan, once the plan `plan` (read from `out.plan`) is known to be the video's, and an `episode` it is
    in can be gone on with, its record at rev `expectRev` when it was looked at. `stop` stops it, as there. */
async function remakeVideos(file, { out, plan, episode, stop, expectRev }, deps) {
  const { run, tools, log = () => {}, progress = noProgress } = deps;
  const name = basename(file);
  const work = episode ? join(runsFolder(deps.home || homedir()), `${process.pid}-${Date.now()}`) : join(deps.tmpDir || tmpdir(), `brimm-unedited-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  // Each video goes through `files`, and is put in place as soon as it is whole, or, for an episode, held until all are made.
  const files = filesOf(work, { name, hold: episode, log, move: deps.move, copy: deps.copy });
  deps = { ...deps, files };
  let finished = false;
  try {
    // ffprobe is asked what the video is now, so that a plan is never used on a video it was not made of.
    const probed = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(file, probed));
    const reprinted = probe.code === 0 && existsSync(probed) ? readFileSync(probed, "utf8") : "";
    const now = reprinted ? factsOf(reprinted) : null;
    // The streams to take, as a run takes them (streamsOf).
    const streams = streamsOf(reprinted);
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
    progress.steps(["Making the rough cut", ...(needsReframe(facts) ? ["Finding the faces", "Making the upright version"] : []), ...(episode ? ["Making the Reel previews"] : clipped ? ["Cutting the short clips"] : [])]);

    const made = [];
    const failed = [];
    // The videos made, where each belongs: for an episode, each is put in after all are made.
    const madeAt = [];
    /** What became of the video at `to`: `why` it could not be made, which is "" when it was. `what` says it could not. */
    const madeOr = (to, what, why) => {
      if (!why) {
        made.push(basename(to));
        madeAt.push(to);
      } else {
        failed.push(`${what}: ${why}`);
        log(`${name}: ${what}: ${why}.${existsSync(to) ? " The one made before is kept." : ""}`);
      }
    };
    let why = "";
    try {
      why = await roughCut(file, out.rough, { plan, facts, spans, streams }, deps);
    } catch (e) {
      rmSync(files.at(out.rough), { force: true });
      why = `the work stopped (${e.code || e.message})`;
    }
    madeOr(out.rough, "the rough cut could not be made again", why);
    // The faces are looked for once, for the upright version, and the clips are cropped by the same stills.
    let stills = [];
    if (needsReframe(facts)) {
      const up = await upright(file, out.vertical, { facts, spans, streams }, work, deps);
      stills = up.stills;
      madeOr(out.vertical, "the upright version could not be made again", up.why);
    }
    // An episode's Reel candidates have previews in place of clips: each made again, as the import makes them, from the
    // stretches and the crops reels.json holds, so a preview still matches the Reel's project, which is made with the same.
    if (episode) {
      const reelsAt = join(dirname(file), REELS_FILE);
      const read = existsSync(reelsAt) ? readReels(readFileSync(reelsAt, "utf8")) : { why: "there is no reels.json" };
      if (read.why) log(`${name}: no Reel previews are made again: ${read.why}.`);
      const again = read.reels ? read.reels.candidates.filter((c) => c.preview) : [];
      for (const c of again.length ? await makePreviews(file, again.map((c) => ({ ...c, preview: null })), { facts, streams }, deps) : []) {
        madeOr(join(dirname(file), previewPath(c.n)), `the preview of Reel ${c.n} could not be made again`, c.failed || "");
      }
    }
    // Each clip, and each part of its Story, that the run which wrote the plan made. One it could not cut is not cut now:
    // it has no captions, and the notes say it could not be cut.
    const pieces = [];
    let clips = 0;
    for (const clip of plan.claude && !episode ? plan.claude.clips : []) {
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
      const cut = await cutPiece(file, piece.to, piece.ranges, { facts, stills, most: piece.most, streams }, deps);
      madeOr(piece.to, `${piece.what} could not be cut again`, cut.why || "");
    }
    if (episode && madeAt.length) {
      const into = await intoEpisode(file, madeAt, work, deps, { expectRev });
      failed.push(...into.problems);
      for (const note of into.notes) log(`${name}: ${note}.`);
      // When nothing was put in, nothing was made again in the episode.
      if (!into.put) made.length = 0;
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
  // The placeholders this run has read through, so that each is read once in the run.
  deps = { ...deps, broughtDown: deps.broughtDown || new Set() };
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
    else if (v === "--check-claude") a.checkClaude = true;
    else if (v === "--until") a.until = Number(argv[++i]);
    else if (!a.file) a.file = v;
  }
  a.folders = a.folders.filter(Boolean);
  if (!a.file && !a.folders.length && !a.checkClaude) a.help = true;
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
  --check-claude     ask Claude once, as the import does, and say whether it answered: the installer runs this from a
                     launch agent of its own, to see that the background job can reach Claude
  --until <time>     with --check-claude: ask Claude nothing once this time, in seconds since 1970, has passed. The
                     installer gives it, so that a check a cut-short setup left behind asks nothing at the next login
  --from-plan        make the videos of one video again from the cut plan an earlier run wrote beside it: the rough
                     cut, its upright version and the clips Claude picked, as the tool writes videos now. No transcript
                     is made, Claude is not asked, and no other file is touched. Never with --watch

An episode, made of a video in this Mac's drop folder, gets Reel candidates in place of the short clips: reels.json, and a
small upright preview of each in previews/. --from-plan of an episode's video makes the previews again, and puts every
file into the episode by the rule. See the README, "Reel candidates". With this Mac's settings saying import light, a video
in the drop folder is imported lightly instead: its transcript, cut plan and the rough cut's captions, and nothing else.
Claude is not asked, and no video is made, until its person says what it is. A Zoom download is not imported yet: it is
left in the folder, and its status says to put it in BRIMM VIDEO Transfer. --from-plan refuses an episode imported lightly.

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
    run was asked to do: with --rules-only among it, the run is told never to ask Claude. When this Mac's settings say
    `import: "light"`, the run is told so (`light`), and the episodes of its drop folder are imported lightly: nothing else
    is, neither the one file nor a folder that is not its drop folder. With no such setting the run is given what it was. */
export function depsFor(found, log, env = process.env, args = {}) {
  const home = env.HOME || homedir();
  // This Mac's settings for episodes, when it has them: with them, the import of its own drop folder makes episodes.
  const settings = readSettings(home).settings || null;
  return { run: runProgram, tools: found, model: found.model, home, settings, ...(lightImport(settings) ? { light: true } : {}), rulesOnly: Boolean(args.rulesOnly), log, notify: banner, wait: (ms) => new Promise((r) => setTimeout(r, ms)), progress: reporter({ folder: progressFolder(home), swift: found.swift, log }) };
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

/** How long the check of Claude may take: two minutes. */
const CHECK_MS = 2 * 60 * 1000;

/** Ask Claude once, as the import asks it (CLAUDE_ARGS, the model named above, from a new empty folder), to reply with one
    word, and say whether it answered: "Claude answered from here." or why it could not be asked. The installer runs this
    from a launch agent of its own, once, so that a sign-in the background job cannot see shows at setup and not at the first
    import. Resolves 0 when Claude answered, and 1 when it did not.
    `until` is the time, in seconds since 1970, that the installer gives its launch agent. That agent is taken away once the
    check is over, but a kill -9 or a power cut during the setup can leave it, and launchd then runs it at every login. Past
    that time, or when it cannot be read, Claude is not asked, and this resolves 0. `job` is the launchd label this runs under
    (XPC_SERVICE_NAME): an agent of that label with no time given was left by a setup from before the time was given, and
    asks Claude nothing either, so that it cannot use the account at every login. Run by hand, it asks. `now` is the time in
    milliseconds. */
export async function checkClaude({ run, tools, say, tmpDir = tmpdir(), until, job, now = Date.now() }) {
  if (until === undefined && job === "com.thebrimm.claude-check") {
    say("This check of Claude was run by the launch agent an older setup left behind, com.thebrimm.claude-check, so Claude was not asked. To take that one agent away alone, in Terminal: launchctl bootout gui/$(id -u)/com.thebrimm.claude-check; rm ~/Library/LaunchAgents/com.thebrimm.claude-check.plist. Not install.sh --remove, which also stops the import's own agent, com.thebrimm.unedited.");
    return 0;
  }
  if (until !== undefined && !(now <= until * 1000)) {
    // The way out it gives is the setup guide's: that one agent taken away alone. install.sh --remove would also stop the
    // import's own agent, and her drop folder would then not be watched until the next setup.
    say("This check of Claude was for a setup that is over, so Claude was not asked. That setup was cut short and left its launch agent, com.thebrimm.claude-check, behind. To take that one agent away alone, in Terminal: launchctl bootout gui/$(id -u)/com.thebrimm.claude-check; rm ~/Library/LaunchAgents/com.thebrimm.claude-check.plist. Not install.sh --remove, which also stops the import's own agent, com.thebrimm.unedited.");
    return 0;
  }
  const no = (why) => {
    say(`Claude could not be asked from here: ${why}.`);
    return 1;
  };
  if (!tools.claude) return no("Claude Code is not on this Mac");
  const folder = mkdtempSync(join(tmpDir, "brimm-claude-check-"));
  try {
    const ended = await run(tools.claude, CLAUDE_ARGS, { input: "Reply with the one word OK.", cwd: folder, limit: CHECK_MS, out: CLAUDE_PRINTED });
    if (ended.outOfTime) return no(`it gave no answer in ${CHECK_MS / 60000} minutes`);
    let told = null;
    try {
      told = JSON.parse(ended.stdout);
    } catch (e) {
      // It is not JSON, and the line below says so.
    }
    if (told && told.is_error === true) return no(`Claude Code gave an error (${lastLine(typeof told.result === "string" ? told.result : "")})`);
    if (ended.code !== 0) return no(`Claude Code stopped (${reasonOf(ended)})`);
    if (!told || told.is_error !== false || typeof told.result !== "string") return no("what Claude Code printed could not be read");
    say("Claude answered from here.");
    return 0;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.checkClaude) return checkClaude({ run: runProgram, tools: findPrograms(), say: (line) => process.stdout.write(`${line}\n`), until: args.until, job: process.env.XPC_SERVICE_NAME });
  const log = (line) => process.stdout.write(`${new Date().toISOString()} ${line}\n`);
  const found = findPrograms();
  if (found.missing.length) {
    for (const m of found.missing) log(m);
    log("Run tool/install.sh to set this Mac up.");
    return 2;
  }
  return doAsked(args, depsFor(found, log, process.env, args));
}

/** End the process with `code` once what it printed is out. A run started by the launch agent is ended so, whatever is still
    open: a read of a placeholder that was given up is not cancelled in the kernel, and while the process lives, launchd
    starts no new run. */
export function finish(code, { exit = process.exit, out = process.stdout } = {}) {
  out.write("", () => exit(code));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => finish(code));
}
