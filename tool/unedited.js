#!/usr/bin/env node
// For an unedited video: writes a transcript with a time for every word, a cut plan that suggests what to take out (retakes,
// false starts, spoken cues to start over, long pauses), and the captions of the rough cut, worked out from the plan. That is the
// light import (spec 2026-10-22, section 1), and it is the only import (Phase 2): Claude is not asked, no video is made, and there
// is no Final Cut file, reels.json or notes. The rough cut itself is made when a video is read (roughCut, below).
//
// The video and its sound never leave this Mac, and nothing of them goes to Claude when a video is imported.
//
//   node unedited.js <file>             one video: its files appear beside it, and nothing is moved
//   node unedited.js --watch <folder>   every video in the folder that has no cut plan yet, then stop. Each one is then moved,
//                                       with its files, into a new folder there named for the day
//   options:  --watch <folder>   again, to work more than one folder
//             --out <folder>     where to write, for one file
//             --rules-only       accepted, and means nothing now: the import never asks Claude
//             --from-plan        gone: the import makes no videos now. It says so and ends with 2
//
// The files, each named after the video: <name>.srt and <name>.transcript.txt as the transcript tool writes them,
// <name>.words.json, <name>.cut-plan.json and <name>.cut-plan.txt, <name>.rough-cut.srt and <name>.rough-cut.transcript.txt.
// The cuts are suggested by rules (cuts.js), and are for a person to check.
// Each file is written whole in the run's own folder, among the Mac's temporary files, and only then moved where it belongs,
// under its own name. So a folder that syncs to a cloud drive never sees a file half written, and never sees one renamed.
//
// ffprobe reads the file's facts. ffmpeg takes the sound out and finds the pauses. whisper.cpp writes the captions and the time
// of every word. They are the transcript tool's programs, and install.sh sets them up. While it works, it says how far it has
// got in a small file on this Mac's own disk (progress.js), and swift runs progress.swift to show that in a small window: closing
// the window, or its failing to open, changes nothing about the work.
// "install.sh <folder>" has the Mac run the --watch form whenever something lands in that folder.
// A video in this Mac's drop folder is made into an episode whose record waits for her to say what the video is, and until then the
// video is named by its label, never by its file. Until the import takes Zoom's downloads (phase Z), a file named as Zoom names
// them is left where it is, with a status that says so (filing.js). A watched folder that is not this Mac's drop folder, and the
// one file given on the command line, are imported the same way, and name the video by its file.
// What Claude is still asked from here: askClaude and askAgain (Reel candidates, asked for in her chat) and the readings (reading.js).
import { spawn, spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { homeRefusal, studioHome } from "./home.js";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay, stamp } from "./shared/text.js";
import { dayFolder, ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount, settled } from "./lib.js";
import { runProgram, findTools, lockFile, takeLock, isRunning, lastLine, sizeOnDisk } from "./run.js";
import { closingFrom, withoutClosingWords } from "./closing.js";
import { probeArgs, factsOf, wordArgs, pauseArgs, wordsOf, pausesOf, phrasesOf, cutPlan, streamsOf, soundStream, planText, keptSpans, roughRate, roughCutArgs, roughCaptions, cutOutputs, clipFiles, waitingToCut } from "./cuts.js";
import { notesRequest, readNotes, clipRanges, pausesOfPlan } from "./notes.js";
import { stillsArgs } from "./reframe.js";
import { previewSteps, previewLimits } from "./reels.js";
import { previewPath, reelCandidates, reelsFile, readReels, mergeCandidates, REELS_FILE } from "./reel-candidates.js";
import { runGuarded } from "./guard.js";
import { reporter, progressFolder, noProgress } from "./progress.js";
import { isWhole, readThrough, textWriter, replaceIn, LATE_CHECK_MS } from "./dropbox.js";
import { episodeMode, episodeKind, fileEpisode, pendingFor, statusReporter, importEpisodes, writePending, readPendings, dueAt, fileId, importIdOf, commitOf, thisCheckout, readSeen, seenKey } from "./filing.js";
import { readSettings, runsFolder, episodeWork, episodesFolder } from "./settings.js";
import { localStamp, readEpisode, writeEpisode, undone, heldText, heldElsewhere, RECORD_DIR, recordNumbers, conflictedCopies, conflictedOf, kindOf } from "./episode.js";
import { cameFrom, guessKind, labelFor, namesOf, numbered, seenLine, withoutNames } from "./kinds.js";
import { fingerprintOf, matchVersion } from "./versions.js";
import { LEFT, leftAlone, sessionNotCleared } from "./gate.js";
import { STUDIO_NAME } from "./name.js";
import { readStatuses, importState, shownStep } from "./importing.js";

/** How often a file's size is looked at while it arrives, and how many looks before it is left for the next time. They are the
    transcript tool's own numbers. */
const LOOK_MS = 5000;
const MAX_LOOKS = 120;

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
export const CLAUDE_TRIES = 2;
export const AGAIN_MS = 3000;
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
    swift the work goes on, and a Reel candidate is cropped at the centre of the picture, and without claude a reading and `ask` cannot ask
    Claude (the import never does). */
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
export function filesOf(work, { name, hold = false, log = () => {}, move, copy }) {
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
    into the new folder after it, so that it appears there whole. When the video cannot be moved it stays where it is, and its
    files are put beside it. When a file cannot be put in the new folder, it and the ones after it are
    put in the watched folder instead. The log says which, and says so of a file that could not be put there either.
    Returns the new folder's name when every file is in it, and "" otherwise. */
function fileAway(dir, file, made, deps) {
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
    const folder = dayFolder(readdirSync(dir), today());
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

/** A sentence as a part of another: without its full stop, and without its capital, unless it opens with Claude's name or
    with a quoted word. */
const clause = (whole) => {
  const said = String(whole).replace(/\.$/, "");
  return !said || /^(Claude|")/.test(said) ? said : said[0].toLowerCase() + said.slice(1);
};

/** The steps of the work on one video, as the progress panel counts them: the import reads, transcribes, plans and files, and
    nothing more. */
const LIGHT_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Filing"];
/** The steps a video is told: "Filing" only when the video is filed away after, in a watched folder or into a plan's episode. */
const stepsOf = (filing) => (filing ? [...LIGHT_STEPS] : LIGHT_STEPS.slice(0, -1));
/** The steps of the light import of a video with a picture and no sound (PR H5a): there is nothing to hear, so it is looked at and filed. */
const SILENT_STEPS = ["Reading the sound", "Filing"];

/** The seconds that stretches of a video come to. */
const secondsIn = (stretches) => stretches.reduce((sum, s) => sum + (s.end - s.start), 0);

/** The words with their times, the pauses ffmpeg heard and the cut plan the rules make, or `why` there is none. `probe` is what
    ffprobe ended with, `told` is the file the transcriber wrote its times into, `untimed` says why it wrote none, and `silent`
    is the long silences. */
async function planFor({ facts, probe, told, untimed, silent, wav, edge = null, heard: given = null }, { run, tools }) {
  if (!facts) return { why: `the file's length and picture could not be read (${lastLine(probe.stderr)})` };
  if (untimed) return { why: untimed };
  // A file's clock starts with whichever of its picture and its sound comes first. The transcriber and ffmpeg count from the
  // start of the sound, so their times are moved on by as much as the sound starts after the picture.
  const shift = Math.max(0, facts.soundStart);
  let words = [];
  try {
    words = withoutClosingWords(wordsOf(JSON.parse(readFileSync(told, "utf8")), { silent, shift }), edge, shift);
  } catch (e) {
    // The file is not there or cannot be read, and that leaves no words.
  }
  if (!words.length) return { why: "the transcriber wrote no times for the words" };
  // Every line of what ffmpeg prints is needed here too. The pauses are looked for to the end of the recording, which may
  // go on after its sound has ended.
  const heard = given || await run(tools.ffmpeg, pauseArgs(wav, facts.duration - shift), { keep: 1000000 });
  if (heard.code !== 0) return { why: `the pauses could not be found (${lastLine(heard.stderr)})` };
  const pauses = pausesOf(heard.stderr, shift);
  return { words, pauses, plan: cutPlan(phrasesOf(words, pauses), { duration: facts.duration, pauses }) };
}

/** Did Claude's reply, as readNotes read it, give nothing at all: no decision, no notes, no graphic cue, no clip, and something
    wrong with it? A reply that finds the rules right and has nothing to add is whole, and is not one of these, and neither is
    one that has graphic cues and nothing else. */
const nothingIn = (read) => !read.decisions.length && !read.notes && !read.graphicCues.length && !read.clips.length && read.problems.length > 0;

/** Ask Claude once, through Claude Code, run in `folder`, with the text `request` (the one Claude call: CLAUDE_ARGS, the
    request on standard input, the reply read as data): {read}, its reply as `read` read it, or {why} there is none. It counts
    as no reply when Claude Code ran out of time, said it could not get an answer, ended badly, or printed something that is not
    its answer, and when nothing could be read from what Claude wrote (`nothing`, of what `read` gave). `read` is readNotes, and
    `nothing` nothingIn, unless the caller gives others, as a reading does for its kind (reading.js).
    With `quote` (as the import has it), why says what Claude Code last printed, and what could not be read of the reply.
    Without it, why is in fixed words only, and holds nothing Claude Code or Claude wrote: a reading's log and result never
    quote a reply (spec 2026-10-22, section 2).
    `limit` is how long Claude Code may take, in milliseconds: CLAUDE_MS, ten minutes, unless a caller gives a shorter one, as the
    run that makes a Reel's video does for the Reel's cues (workcopy.js), which holds the working copy's lock for as long as it works.
    A limit that is not a number above 0 is none. Why says the time that ran out. */
export async function askOnce(request, folder, { run, tools }, { read: readAs = readNotes, nothing = nothingIn, quote = true, limit = CLAUDE_MS } = {}) {
  const time = Number.isFinite(limit) && limit > 0 ? limit : CLAUDE_MS;
  mkdirSync(folder, { recursive: true });
  const ended = await run(tools.claude, CLAUDE_ARGS, { input: request, cwd: folder, limit: time, out: CLAUDE_PRINTED });
  if (ended.outOfTime) return { why: `it gave no answer in ${limitText(time)}` };
  let told = null;
  try {
    told = JSON.parse(ended.stdout);
  } catch (e) {
    // It is not JSON, and the lines below say so.
  }
  // When Claude Code could not get an answer it says so in what it prints, and says why there, whatever it ends with.
  if (told && told.is_error === true) return { why: quote ? `Claude Code gave an error (${lastLine(typeof told.result === "string" ? told.result : "")})` : "Claude Code gave an error" };
  if (ended.code !== 0) return { why: `Claude Code stopped (${quote ? reasonOf(ended) : ended.signal ? `it was killed by ${ended.signal}` : `it ended with ${ended.code}`})` };
  if (!told || told.is_error !== false || typeof told.result !== "string") return { why: "what Claude Code printed could not be read" };
  const got = readAs(told.result);
  if (!nothing(got)) return { read: got };
  return { why: quote ? got.problems.map(clause).join("; ") : "nothing in its reply could be read" };
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
export async function roughCut(file, to, { plan, facts, spans, streams = null }, { run, tools, files, log = () => {}, progress = noProgress }) {
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

/** A time limit as a log line says it: "3 minutes", "90 seconds". */
const limitText = (ms) => (ms % 60000 === 0 ? `${ms / 60000} minute${ms === 60000 ? "" : "s"}` : `${Math.round(ms / 1000)} seconds`);

/** Where the faces are in a video: {stills}, what the face finder printed for stills of it, or {why} they could not be looked
    for. The stills go into the run's own folder `work`, which is taken away when the run ends.
    `limit` is how long each of its two programs, the ffmpeg that cuts the stills and the finder that looks in them, may run, in
    milliseconds (run.js runProgram kills one still running then); one stopped for it is said so. A Reel's video is looked in by the
    working copy's run, which holds the working copy's lock for as long as it works, so that a finder that hangs would hold it for
    good (workcopy.js REEL_FACES_MS). Given none, a program has all the time it takes, as the upright version of the import (now gone)
    always gave it: the stills of a long recording take as long as they take. */
export async function facesIn(file, work, { run, tools, limit = 0 }) {
  if (!tools.swift) return { why: "swift, which finds the faces, is not installed" };
  const folder = join(work, "stills");
  mkdirSync(folder, { recursive: true });
  const asked = limit > 0 ? { limit } : {};
  const stoppedFor = (ended) => (ended.outOfTime ? `it took more than ${limitText(limit)}, so it was stopped` : reasonOf(ended));
  const cut = await run(tools.ffmpeg, stillsArgs(file, folder), asked);
  if (cut.code !== 0) return { why: `the stills to look in could not be made (${cut.outOfTime ? stoppedFor(cut) : lastLine(cut.stderr)})` };
  // What the face finder prints is its answer, so that is kept, whole.
  const found = await run(tools.swift, [FACES, folder], { out: FACES_PRINTED, ...asked });
  if (found.code !== 0) return { why: `the face finder stopped (${stoppedFor(found)})` };
  try {
    const stills = JSON.parse(found.stdout);
    if (isStills(stills)) return { stills };
  } catch (e) {
    // It is not JSON, and the line below says so.
  }
  return { why: "what the face finder printed could not be read" };
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
      steps = previewSteps({ video: file, ranges: candidate.ranges, out: writing, fps: roughRate(facts), duration: facts.duration, work: dirname(writing), size: { width: facts.width, height: facts.height }, streams, n: candidate.n });
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

/** The first line of a light import's cut log: its times are the recording's, since no rough cut is made at a drop, and the plan
    is the rules' alone. */
const LIGHT_PLAN_NOTE = "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it.";

/** The episode on this Mac that a new video, given by its length in `seconds`, its `fingerprint` and its `words`, is a new
    version of (matchVersion, in versions.js): { id, folder }, or null. Each whole record in Episodes under `root` is a
    candidate, and an episode's words are read from its .words.json only when that file is whole on this Mac (`whole`):
    nothing is brought down from Dropbox for it, and the log says so, by the episode's label, or its id when it has none. A
    record of before the switch has no fingerprint, and never matches. Nothing is thrown from here: a folder that cannot be
    read is no match. */
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
    // Named by its label, or by its id: never by its folder, whose name is its file's.
    const named = record.label || record.id;
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
    could not read the file, nothing is said of how it came or what was seen: `came` is null and `seen` is "". The words are
    compared with the episodes on this Mac unless `matching` is false (PR H5b: the video the join makes of a plan is nobody's new
    version, and its own parts' words would be what it matched). */
function lightFields({ name, facts, plan, words, root, matching = true }, deps) {
  const came = facts ? cameFrom({ name, facts }) : null;
  const fingerprint = fingerprintOf(words);
  const match = matching && fingerprint && facts ? versionIn(root, { seconds: facts.duration, fingerprint, words }, deps) : null;
  const answer = { state: "needs your answer", guess: facts && plan ? guessKind({ facts, plan, came }) : null, seen: facts ? seenLine({ facts, plan, came }) : "", came, match: match ? match.id : null };
  return { answer, fingerprint };
}

async function workOn(file, deps) {
  const { run, tools, model, wait, sizeOf = sizeOnDisk } = deps;
  let progress = deps.progress || noProgress;
  const name = basename(file);
  const out = cutOutputs(file, deps.outDir || undefined);
  const { episode } = deps;
  // The video the join makes of a plan's talking parts (importInto) is taken in by the light import's own steps, but it was made outside
  // any drop folder, into an episode that is there already: `into` (fileEpisode's). It is waited for nowhere, named by no label (the plan's
  // title names it, `deps.shown`), written in no status, and it posts no notice of its own: the join run says when it is ready.
  const into = deps.into || null;
  const notify = into ? () => {} : deps.notify || (() => {});
  // Every import is the light one (Phase 2): the transcript, the cut plan and its text, and the rough cut's captions, worked out
  // from the plan; no Claude, no video made, no Final Cut file, no reels.json and no notes. An episode's import names the video
  // by its label (`shown`), and until the label is known as "A video in the drop folder"; and what a step logs on the
  // way, as a program's error or a file that could not be put somewhere, is logged with nothing of the file's names or a path
  // in it (kinds.js withoutNames), as is why it failed in its status. Its file is often named for a client.
  const quiet = Boolean(episode) && !into;
  const hide = { names: quiet ? namesOf(file) : [], keep: [] };
  const plain = (text) => (quiet ? withoutNames(text, hide.names, hide.keep) : text);
  const said = deps.log || (() => {});
  const log = quiet ? (line) => said(plain(line)) : said;
  let shown = into ? deps.shown || name : quiet ? "A video in the drop folder" : name;
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
  while (!into && (!settled(sizes) || !whole(file))) {
    if (settled(sizes) && !broughtDown.has(readKey())) {
      broughtDown.add(readKey());
      log(`${shown}: Dropbox has not brought it down to this Mac yet, so it is asked for.`);
      await bringDown(file).catch((e) => log(`${shown}: it could not be read through (${e.code || e.message}).`));
    }
    if (sizes.length > MAX_LOOKS) {
      log(`${shown}: still arriving. It is taken the next time the folder changes.`);
      return { ok: false, name, arriving: true, message: "still arriving" };
    }
    await wait(LOOK_MS);
    sizes.push(sizeOf(file));
  }
  // What the video in the drop folder is when its import begins, so that one put in its place meanwhile is told apart.
  const arrived = episode && !into ? fileId(file) : null;
  // An episode's record waits for her answer (spec 2026-10-22, section 1). Her screen may be shared, so the progress
  // panel and every notice name the video by its label, made of the Mac and the moment it was dropped, and never by its file:
  // `shown`. The label's short form, the one kept, holds no length, so it is known before the video is read. The moment is when
  // this Mac first saw the video in its drop folder (seen.json, filing.js noteSeen), so that a queue of drops keeps their own
  // times; when that was not noted, it is the moment this import began. Videos first seen at one look of the folder share
  // that moment, so a label this Mac has given already is numbered, "(2)", "(3)", as a session's is.
  const noted = quiet && arrived ? readSeen(episode.home)[seenKey(name, arrived)] : null;
  const dropped = noted && Number.isFinite(noted.at) ? new Date(noted.at) : deps.now ? deps.now() : new Date();
  const unnumbered = quiet ? labelFor({ seconds: 0, machine: episode.machine, at: localStamp(dropped) }).short : "";
  const label = quiet ? numbered(unnumbered, labelsGiven(episode.root, episode.machine, { video: name, importId: importIdOf(arrived) })) : "";
  if (quiet) {
    shown = label;
    hide.keep.push(label);
  }
  // An episode's import keeps its own folder in BRIMM Video Work, on the same disk as Dropbox, until the late check: macOS
  // may clear the temp folder before a late check that a restart left is made. The join's run gives the folder it made the video in
  // (`deps.work`), which holds the video and is the one kept.
  const work = deps.work || (episode ? join(runsFolder(episode.home), `${process.pid}-${Date.now()}`) : join(deps.tmpDir || tmpdir(), `brimm-unedited-${process.pid}-${Date.now()}`));
  mkdirSync(work, { recursive: true });
  // Whether the run's folder stays when the run ends: it does once an episode's files are in Dropbox, for the late check.
  let keepWork = false;
  // What the run writes goes through `files`. For a watched folder each file is held in the run's own folder until the video
  // is filed away with them, and otherwise each is put beside the video, or in --out, as soon as it is whole.
  const files = filesOf(work, { name: shown, hold: Boolean(deps.watched) || Boolean(into), log, move: deps.move, copy: deps.copy });
  // An episode's import also says how far it has got in a status file in Episodes/.importing/, for both Macs to see. A light
  // import's status carries the video's label, for the commands to name it by in place of its file (Part F). The join writes none: its
  // run holds the plan's lock, and the guide says it is at work.
  if (episode && !into) {
    const writeText = textWriter({ work: join(work, "status"), ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}) });
    progress = statusReporter(progress, { root: episode.root, machine: episode.machine, video: name, bytes: sizeOf(file), importId: importIdOf(arrived), label, writeText, log, ...(deps.every ? { every: deps.every } : {}), ...(deps.cancel ? { cancel: deps.cancel } : {}) });
  }
  deps = { ...deps, log, files, progress };
  /** Keep the late check of the episode just filed (`filed`) on this Mac's own disk, so that a run stopped first leaves it for the next. */
  const keepLateCheck = (filed) => {
    // The video the join made is not in a drop folder: the file the check takes away is one in the run's own folder that is nobody's.
    const pending = pendingFor(filed, { video: name, drop: into ? join(work, "not in a drop folder") : file, dropFile: arrived, importId: importIdOf(arrived), work, planTxt: basename(out.planTxt), label: into ? shown : label }, { episode, clock: deps.clock || Date.now });
    try {
      writePending(episode.home, pending);
      log(`${shown}: copied into Dropbox. Its late check is due at ${new Date(dueAt(pending)).toTimeString().slice(0, 5)}.`);
    } catch (e) {
      log(`${shown}: copied into Dropbox, but its late check could not be kept (${e.code || e.message}), so it is not made, and the video stays in the drop folder.`);
    }
  };
  const fail = (given) => {
    const why = plain(given);
    // An episode's import writes nothing into the drop folder: its status file says why (importing.js). The join's has no status, and
    // its run says why in its result.
    if (into) {
      // Nothing is written anywhere.
    } else if (episode) progress.fail(why);
    else {
      writeFileSync(files.at(out.failed), `No transcript could be made from ${name}.\n\nWhy: ${why}.\n\nTo try again, delete this note. The video is taken again the next time something changes in this folder.\n`);
      files.put(out.failed);
    }
    log(`${shown}: failed. ${why}.`);
    notify(episode ? `No transcript could be made from ${shown}. It stays in the drop folder; see the log.` : `No transcript could be made from ${name}. See the note beside it.`);
    return { ok: false, name, message: why };
  };
  // The progress panel is told each step as it begins.
  progress.begin(shown);
  progress.steps(stepsOf(Boolean(deps.watched) || Boolean(into)));
  // Whether the work on the video finished with every file made: only then is what its steps took kept as a measure.
  let finished = false;
  try {
    progress.step("Reading the sound");
    log(`${shown}: reading the sound.`);
    const probed = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(file, probed));
    const printed = probe.code === 0 && existsSync(probed) ? readFileSync(probed, "utf8") : "";
    const facts = printed ? factsOf(printed) : null;
    // A video with a picture and no sound (PR H5a) can only be footage for a planned video: nothing is said in it to read, so the
    // import of an episode files it alone, with its record waiting for her answer. Any other file with no sound fails, as it always
    // did: one with no picture too, and one given to the import alone.
    if (facts && !facts.sound) {
      if (!(episode && !into && facts.height > 0)) return fail("there is no sound in the file");
      progress.steps(SILENT_STEPS);
      progress.step("Filing");
      log(`${shown}: it has a picture and no sound, so it is filed with nothing made of it.`);
      let filed = null;
      try {
        // No sound is read, no transcript, plan or words are made, and so there are no retakes, no guess and no fingerprint to match.
        filed = fileEpisode({ file, made: [], at: files.at, facts, printed, kind: null, read: null, reels: [], work, dropFile: arrived, label, ...lightFields({ name, facts, plan: null, words: [], root: episode.root }, { log, whole }) }, deps);
        keepWork = true;
        keepLateCheck(filed);
      } catch (e) {
        if (e.code === "DROP_CHANGED") {
          log(`${shown}: it changed in the drop folder while it was imported, so this import is stopped, and the new file is imported on its own.`);
          progress.drop();
          return { ok: false, name, arriving: true, changed: true, message: "it changed in the drop folder while it was imported" };
        }
        const why = plain(`it could not be filed into Episodes: ${String(e.message).replace(/\.$/, "")}`);
        progress.fail(why);
        log(`${shown}: ${why}. It stays in the drop folder, and is done again the next time.`);
        notify(`${shown} could not be put into Episodes. It stays in the drop folder; see the log.`);
        return { ok: false, name, message: why };
      }
      notify(`Ready: ${label}. In Claude, say "what's waiting?"`);
      finished = true;
      return { ok: true, name, folder: filed.name, filed, message: "" };
    }
    // The picture and the first sound this Mac's ffmpeg can read, which every ffmpeg the run asks for is told to take: an
    // iPhone's clip carries Apple's APAC beside its AAC, and ffmpeg on its own takes the sound with the most channels.
    const streams = streamsOf(printed);
    if (facts && streams.audio === null && streams.unreadable.length) return fail(`its sound is in a form this Mac's ffmpeg cannot read (${streams.unreadable.join(", ")})`);
    // An episode of a recording that is upright, square or short is a short video.
    const kind = episode && facts ? episodeKind(facts) : "";
    if (facts) {
      progress.length(facts.duration);
      progress.steps(stepsOf(Boolean(deps.watched) || Boolean(into)));
    }
    const wav = join(work, "sound.wav");
    const a = await run(tools.ffmpeg, ffmpegArgs(file, wav, streams.audio));
    if (a.code !== 0 || !existsSync(wav)) return fail(`the sound could not be read from the file (${lastLine(a.stderr)})`);
    progress.step("Writing the transcript");
    log(`${shown}: writing the transcript, with a time for every word.`);
    const outBase = join(work, "captions");
    let b = await run(tools.whisper, wordArgs({ model, wav, outBase }));
    // On some recordings the transcriber dies inside its word timing, every time it is tried, and reads the same sound
    // without trouble when it is not asked for the times. The transcript is then written by the transcript tool's own pass,
    // and there is no cut plan.
    let untimed = "";
    if (b.code !== 0) {
      untimed = `the transcriber could not time the words (${reasonOf(b)})`;
      log(`${shown}: ${untimed}. Writing the transcript without them.`);
      b = await run(tools.whisper, whisperArgs({ model, wav, outBase }));
    }
    if (b.code !== 0) return fail(`the transcriber stopped (${reasonOf(b)})`);
    const written = existsSync(outBase + ".srt") ? readFileSync(outBase + ".srt", "utf8") : "";
    // The captions are made as the transcript tool makes them: without the ones written over a long silence, and with the
    // show's names spelled right. When ffmpeg cannot say where the silences are, they are written whole.
    const heard = captionCount(written) ? await run(tools.ffmpeg, silenceArgs(wav), { keep: 1000000 }) : null;
    const silent = heard && heard.code === 0 ? silences(heard.stderr) : [];
    const quiet = dropSilent(written, silent);
    if (quiet.dropped) log(`${shown}: left out ${quiet.dropped} caption${quiet.dropped === 1 ? "" : "s"} written where nobody speaks.`);
    // And without the ones the transcriber invents after the last thing said (closing.js), which the guard above does not see. The
    // pauses it needs are the ones the cut plan is made from, so they are asked for here, once, and planFor is given them.
    const length = facts ? facts.duration - Math.max(0, facts.soundStart) : 0;
    const heardPauses = facts && !untimed && existsSync(outBase + ".json") && captionCount(quiet.srt) ? await run(tools.ffmpeg, pauseArgs(wav, length), { keep: 1000000 }).catch(() => null) : null;
    const closed = closingFrom(quiet.srt, heardPauses, length);
    if (closed.dropped) log(`${shown}: left out ${closed.dropped} caption${closed.dropped === 1 ? "" : "s"} written where nobody speaks.`);
    const srt = spellNames(closed.srt);
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
    log(`${shown}: the transcript is written, ${captions} captions.`);

    // From here on a step that fails costs the plan or a file made from it, and never the transcript: what was made is kept
    // and filed, and the plan's own text says what is missing.
    progress.step("Making the cut plan");
    const planned = await planFor({ facts, probe, told: outBase + ".json", untimed, silent, wav, edge: closed.edge, heard: heardPauses }, deps).catch((e) => ({ why: `the work on the plan stopped (${e.message})` }));
    // The plan the rules made: the plan of every import is the rules' alone.
    const { plan } = planned;
    // What could not be made, each as the log says it.
    const missing = [];
    /** What a plan comes to, as the log says it. */
    const sums = (made) => {
      const cuts = made.ranges.filter((r) => !r.keep).length;
      return `keeps ${stamp(Math.round(made.kept))} of ${stamp(Math.round(facts.duration))} and suggests ${cuts} cut${cuts === 1 ? "" : "s"}`;
    };
    /** The plan `made` as its file holds it (see where it is written, below). */
    const planJson = (made) => JSON.stringify({ version: 1, video: name, facts, phrases: made.phrases, ranges: made.ranges, kept: made.kept, cut: made.cut, pauses: planned.pauses.map(([start, end]) => [start, Math.min(end, facts.duration)]), by: made.by || "rules", ...(made.changes ? { changes: made.changes } : {}) }, null, 2) + "\n";
    if (!plan) {
      missing.push(`no cut plan could be made: ${planned.why}`);
      files.text(out.planTxt, `No cut plan could be made for ${name}.\n\nWhy: ${planned.why}.\n\nIts transcript was made, and is beside this note.\n`);
    } else {
      // The import makes no video: the words, the rough cut's captions, placed by the plan's own arithmetic, the cut log,
      // whose first line says its times are the recording's, and the plan, written last, as below. A file that cannot be written
      // ends the import as one that failed, whose status says why with nothing of the file's names in it (fail), and nothing is
      // filed: the next try makes them again. The plan is written after everything made from it: it is what says this video is
      // done. It keeps the pauses ffmpeg heard, which the plan was made from, so that a reading made later, perhaps on the other
      // Mac with no sound file, changes the plan with the same pauses (pausesOfPlan, in notes.js). A pause that never ends lasts to
      // the end of the video, and is written so: JSON has no time with no end, and nothing changes by it.
      log(`${shown}: the cut plan ${sums(plan)}.`);
      try {
        files.text(out.words, JSON.stringify({ video: name, duration: facts.duration, words: planned.words }, null, 2) + "\n");
        const roughSrt = roughCaptions(plan.phrases, keptSpans(plan.ranges, roughRate(facts)));
        files.text(out.roughTxt, stampedText(roughSrt));
        files.text(out.roughSrt, roughSrt);
        files.text(out.planTxt, planText(plan, LIGHT_PLAN_NOTE));
        files.text(out.plan, planJson(plan));
      } catch (e) {
        // A video that is not an episode's ends that video's run with the error, and is done again the next time (uneditedFile logs it); the others go on.
        if (!episode) throw e;
        return fail(`the work stopped (${e.code || e.message})`);
      }
    }
    for (const what of missing) log(`${shown}: ${what}.`);
    if (!missing.length) log(`${shown}: done.`);
    // For a watched folder, the video is filed away with the files the run held for it, the plan last.
    const held = [out.srt, out.txt, out.words, out.planTxt, out.roughSrt, out.roughTxt, out.plan];
    if (deps.watched || into) progress.step("Filing");
    if (episode) {
      // An episode is filed into its own folder in Episodes, by clones, and the raw video stays in the drop folder until the
      // late check. When it cannot be filed, no record is written, and the next run files it again.
      let filed = null;
      try {
        // The video waits for her answer: it has no kind yet, and it has its label, its guess, the fingerprint of its words, and
        // the episode whose words it holds, when they match one on this Mac, for her card to offer first. It is a new version of
        // that one only once she says so. The video the join made is filed into its plan instead (`into`), as the kind the rule
        // gives it ("raw", or "short video"), and is nobody's new version.
        filed = fileEpisode({ file, made: held.filter((f) => files.has(f)), at: files.at, facts: facts || { duration: 0, width: 0, height: 0 }, printed, kind: into ? (kind === "short video" ? "short video" : "raw") : null, read: null, reels: [], work, dropFile: arrived, label, ...(into ? { into } : {}), ...lightFields({ name, facts, plan, words: planned.words || [], root: episode.root, matching: !into }, { log, whole }) }, deps);
        const match = filed.record.answer ? filed.record.answer.match : null;
        if (match) log(`${shown}: its words are those of the episode ${match}, so her card offers it as a new version of that one.`);
        keepWork = true;
        // The late check is kept on this Mac's own disk, so a run stopped before it leaves it for the next run.
        keepLateCheck(filed);
      } catch (e) {
        if (e.code === "DROP_CHANGED") {
          // Nothing of it was put into Dropbox. The new file is imported on its own, as another recording.
          log(`${shown}: it changed in the drop folder while it was imported, so this import is stopped, and the new file is imported on its own.`);
          progress.drop();
          return { ok: false, name, arriving: true, changed: true, message: "it changed in the drop folder while it was imported" };
        }
        // The record is the last file filed: why it could not be, as a clone's error naming the file, is said in its
        // status with nothing of the file's names in it.
        const why = plain(`it could not be filed into Episodes: ${String(e.message).replace(/\.$/, "")}`);
        missing.push(why);
        if (!into) progress.fail(why);
        log(into ? `${shown}: ${why}.` : `${shown}: ${why}. It stays in the drop folder, and is done again the next time.`);
      }
      // The label names the Mac it was dropped on, so the notice does not say it again.
      if (filed) notify(`Ready: ${label}. In Claude, say "what's waiting?"`);
      else notify(`${shown} could not be put into Episodes. It stays in the drop folder; see the log.`);
      finished = !missing.length;
      return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder: filed ? filed.name : "", ...(filed ? { filed } : {}), message: missing.join("; ") };
    }
    const folder = deps.watched ? fileAway(deps.watched, file, held.filter((f) => files.has(f)), deps) : "";
    const where = folder ? `, in the folder ${folder}` : "";
    if (plan) notify(`The cut plan for ${name} is ready${where}.`);
    else notify(`The transcript of ${name} is ready${where}, but no cut plan could be made. See ${basename(out.planTxt)}.`);
    finished = !missing.length;
    return { ok: !missing.length, name, captions, ...(plan ? { kept: plan.kept, cut: plan.cut } : {}), folder, message: missing.join("; ") };
  } catch (e) {
    // Something nobody foresaw stopped an episode's import: its status says so, so that both Macs see it failed, and it is not
    // taken again until a person says to. An episode's label goes with the error, for the log to name the video by it.
    if (episode && !into) progress.fail(plain(`the work stopped (${e.code || e.message})`));
    if (episode && e !== null && typeof e === "object") e.label = label;
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
    is the folder it went into. Nothing is thrown from here: when something nobody foresaw stops the work, the log says so.
    Every import is the light import: Claude is never asked, no video is made, and the plan is the rules' alone. */
export async function uneditedFile(file, deps) {
  try {
    return await workOn(file, deps);
  } catch (e) {
    // An episode's import names the video by its label, and says why with nothing of the file's names in it, as workOn does.
    const light = Boolean(deps.episode);
    const why = light ? withoutNames(String(e.code || e.message), namesOf(file)) : String(e.code || e.message);
    (deps.log || (() => {}))(`${light ? (e && e.label) || "A video in the drop folder" : basename(file)}: the work stopped (${why}).`);
    return { ok: false, name: basename(file), message: why };
  }
}

/** The light import's own steps on a video made outside any drop folder (PR H5b): the talking parts of a plan, joined by the run of `join` into
    one file of its own folder. The sound is read, the words written with a time for each, the rules' cut plan and the rough cut's captions
    made, and the video and what was made of it filed, by the rule, into an episode that is there already (`into`, filing.js fileEpisode's:
    { folder, record, change }) and not into a new one, with its late check kept on this Mac (writePending) as an import keeps it. It is
    uneditedFile's work with the light import's, with these differences, since the video was not dropped and the episode is no new one:
    - it is waited for nowhere: it is whole already;
    - it is named in the log and the panel by `deps.shown`, the plan's title, in place of a label made of the moment it was dropped;
    - the work goes on in the folder the caller gives (`deps.work`), where the video is, and which is kept for the late check when the video
      is filed; otherwise it is taken away;
    - no status is written into Episodes/.importing, and no notice is posted: the run of `join` says when the plan is its video;
    - the episode's words are compared with no other episode's, and a video with no sound is not filed alone, as the light import of a drop
      files one: it fails, as any file with no sound does;
    - the kind the rule gives it ("raw", or "short video") is filed with it, and `into.change` writes the rest of the record.
    Resolves what uneditedFile does: { ok, name, captions, kept, cut, folder, filed, message }, `filed` being fileEpisode's. A video that was
    filed with something missing (no cut plan could be made) has `filed` and is not `ok`. Nothing is thrown from here. `deps` are the light
    import's, with `episode` ({ root, machine, checkout, home }): `run`, `tools`, `model`, `progress`, `log`, `clock`, `now` (which gives a
    Date), and the rule's `clone` and `sameDisk`. */
export async function importInto(file, into, deps) {
  try {
    return await workOn(file, { ...deps, into, light: true });
  } catch (e) {
    (deps.log || (() => {}))(`${deps.shown || basename(file)}: the work stopped (${e.code || e.message}).`);
    return { ok: false, name: basename(file), message: String(e.code || e.message) };
  }
}

/** How far apart, in seconds, the length of a video now and the length its plan was made with may be, for the plan to be of
    that video. ffprobe gives the same length for the same file, but another version of ffprobe may read it a little
    differently. */
const SAME_LENGTH = 0.1;

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
    record, and `expectRev`, when given, is the rev the work was worked out from. `onPut`, when given, is called once the files and
    the record are in, before the wait for the late check: a reading posts its notice then (reading.js).
    Nothing is put in when the episode cannot be gone on with as it is now: its record cannot be read, a newer brimm-video
    wrote it, Dropbox undid this Mac's last change to it (episode.js undone), or its rev is not `expectRev`. A change of this
    Mac's that Dropbox took away is so never written over in silence.
    Nothing is left half done. Each file it replaces is first copied into the run's folder, and when a file cannot be put in,
    or the record cannot be written, every file put in so far is put back as it was (one that was not there is taken away
    again), and no record is written. What was put back has its late check too, after the same wait. One that cannot be put
    back is kept in BRIMM Video Work, in the episode's folder there, under "put back", and the problem says where. */
export async function intoEpisode(file, madeAt, work, deps, { change = (record) => record, expectRev, onPut } = {}) {
  const { files, log = () => {} } = deps;
  const home = deps.home || studioHome();
  const folder = dirname(file);
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const wait = deps.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const unchanged = "Nothing was changed in the episode";
  const rel = (to) => relative(folder, to).split(sep).join("/");
  // Why the episode cannot be gone on with as it is now, or "".
  const notAsWas = (found, rev) => {
    if (!found.record) return `the episode's record cannot be read: ${String(found.why || "it is not there").replace(/\.$/, "")}`;
    if (found.newer) return "the episode was written by a newer BRIMM Video Studio. Ask Jason to update this Mac";
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
          theirs(e.to, "the check of its copies left it as it is");
          continue;
        }
        const kept = keep(e.to, e.from);
        problems.push(`${rel(e.to)} is not as this Mac put it when its copies were checked, and ${judge.held.by} has ${judge.name} open now, so it was not copied in again${kept ? `. This Mac's copy is kept at ${kept}` : ""}`);
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
        theirs(e.to, "the check of its copies left it as it is");
        continue;
      }
      if (now === "unlisted") {
        notes.push(`${rel(e.to)} is gone, and the record no longer lists it, so the check of its copies left it out`);
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
      if (deps.progress) deps.progress.step("Waiting for the late check", "Waiting for Dropbox's check of its copies");
      await wait(LATE_CHECK_MS);
      const late = ownLateCheck(back);
      problems.push(...late.problems);
      if (late.held && late.problems.length) whole = false;
      // A file its late check could not copy in again is kept too: its work copy goes with the run's folder.
      for (const e of late.checked) {
        if (sameBytes(e.to, e.from)) continue;
        whole = false;
        const kept = keep(e.to, e.from);
        problems.push(`${rel(e.to)} could not be put back as it was when its copies were checked${kept ? `. The one that was there is kept at ${kept}` : ""}`);
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
    const writer = { commit: deps.commit || (deps.settings ? commitOf(thisCheckout()) : "unknown"), on: deps.settings ? deps.settings.machine : "unknown" };
    const write = textWriter({ work: join(work, "record"), keep: true, ...opts });
    writeEpisode(folder, change({ ...found.record, files: { ...found.record.files, ...sizes } }), { expectRev: before.record.rev, writeText: (to, text) => entries.push(write(to, text)), writer, home });
  } catch (e) {
    problems.push(`the episode's record could not be written again: ${String(e.message).replace(/\.$/, "")}`);
    await undo();
    return { put: false, problems, notes, kept: keptNow };
  }
  log(`${basename(file)}: put into its episode. Its late check is in ${LATE_CHECK_MS / 60000} minutes.`);
  if (onPut) await onPut();
  if (deps.progress) deps.progress.step("Waiting for the late check", "Waiting for Dropbox's check of its copies");
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
  return importHold({ root, home, machine, record, now }).why;
}

/** importHolds, with whether the hold clears by itself and what holds it: { why, waits, state }. It `waits` while an import of
    the video is at work on either Mac (its late check comes within that run), and while this Mac's own late check of it is
    still to come, at its time, with no problem found yet. A hold that needs a person (an import that failed or stopped, a late
    check that found a problem, or one this Mac owes past its time with no import at work to make it) does not. A raw reading
    waits only while it waits (reading.js). `state` says which hold it is: "running" (an import of the video is at work on
    either Mac), "failed", "problem" (a status, or this Mac's pending check, says the late check found one), "due" (this Mac
    owes the late check, and its own import, `importing`, is at work and makes it, before its time or after), "owed" (this Mac
    owes it and no import is at work to make it), "stopped" (a status of an import that stopped), or "" when none holds it,
    as { why: "", waits: false, state: "" }. `importing` is whether this Mac's launch agent run is at work now. */
export function importHold({ root, home, machine, record, now = Date.now(), importing = false }) {
  const video = record.video.file;
  const said = (text) => String(text).replace(/\.$/, "");
  const again = (on) => `say "try it again" for ${video} on ${on}, then say this again`;
  const statuses = readStatuses(root, now).map((s) => s.status).filter((s) => s && s.video === video && s.bytes === record.video.bytes);
  const state = (want) => statuses.find((s) => importState(s, now) === want);
  const held = (why, waits = false, kind = "") => ({ why, waits, state: kind });
  const running = state("running");
  if (running) return held(`The import of this episode has not finished on ${running.machine} yet: it is at "${shownStep(running.step)}". Say it again when it has.`, true, "running");
  const failed = state("failed");
  if (failed) return held(`The import of this episode failed on ${failed.machine}: ${said(failed.failed)}. Say "try it again" to import it again.`, false, "failed");
  const problem = state("problem");
  if (problem) return held(`Dropbox found a problem with a copy of this episode: ${said(problem.problem)}. Once it is put right, ${again(problem.machine)}.`, false, "problem");
  const owed = readPendings(home).find((p) => p.id === record.id && (!machine || p.machine === machine) && resolve(String(p.root)) === resolve(root));
  if (owed && owed.problem) return held(`Dropbox found a problem with a copy of this episode: ${said(owed.problem)}. Once it is put right, ${again(owed.machine)}.`, false, "problem");
  // No import of the video is at work here (a running status would have said so), so none makes the check unless told to. The
  // hold is "due" when this Mac's launch agent run is at work, as it will make the check itself, and "owed" when it is not.
  if (owed && dueAt(owed) > now) return held(`This Mac has still to make the check of this episode's copies, due at ${clockAt(dueAt(owed))}. Say "try it again" for ${video} to have it made then, then say this again.`, true, importing ? "due" : "owed");
  if (owed) return held(`This Mac has still to make the check of this episode's copies. Say "try it again" for ${video} to have it made now, then say this again.`, false, importing ? "due" : "owed");
  const stopped = state("stopped");
  if (stopped) return held(`The import of this episode stopped on ${stopped.machine} before the check of its copies was made. On ${stopped.machine}, say "try it again" for ${video}, then say this again.`, false, "stopped");
  return held("");
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
  if (kindOf(record) === null) return { why: leftAlone(record) ? LEFT : "This video is waiting for its answer: say what it is first." };
  // A session is known by its kind or by its mark, and only a mark cleared by her click lets Claude read it, by the gate's own rule
  // (gate.js sessionNotCleared): a record of kind "session" with no mark at all is refused too.
  if (sessionNotCleared(record)) return { why: "This is a client or group session: Claude reads it only for its teachings." };
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
  const blocked = askBlocked({ folder, record, root: deps.settings.root, home: deps.home || studioHome(), machine: deps.settings.machine, now: deps.now ? deps.now() : Date.now(), whole: deps.isWhole || isWhole });
  if (blocked.why) return { ok: false, made: [], failed: [blocked.why], next: as };
  const name = record.video.file;
  const video = join(folder, name);
  const stem = basename(name, extname(name));
  const plan = JSON.parse(readFileSync(join(folder, `${stem}.cut-plan.json`), "utf8"));
  const work = join(runsFolder(deps.home || studioHome()), `ask-${process.pid}-${Date.now()}`);
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
    // Claude is asked what it was asked at the import (askClaude), and of its reply only the clips are used. Its decisions, its notes
    // and its graphic cues are thrown away, as its ideas for graphics were: the cut plan keeps the cues its reading wrote.
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
    const lost = listGone({ folder, record: readEpisode(folder).record || record, home: deps.home || studioHome() });
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
  // A folder directly in BRIMM Video/Unedited Video/, or in BRIMM Video/Drop/ once the switch names Drop, is a drop folder: the
  // log names the one it is in.
  const parent = basename(dirname(resolve(dir)));
  const inBrimmVideo = ["Unedited Video", "Drop"].includes(parent) && basename(dirname(dirname(resolve(dir)))) === "BRIMM Video";
  if (!episodic && (existsSync(marker) || inBrimmVideo)) {
    const owner = existsSync(marker) ? readFileSync(marker, "utf8").split("\n")[0] : "";
    log(`This is a drop folder for episodes (${owner ? `${marker} names ${owner}` : `it is in BRIMM Video/${parent}`}), and this Mac has no settings for episodes that name it, so nothing is done here. Jason runs install.sh --machine on this Mac.`);
    return [];
  }
  // The lock of this Mac's drop folder is kept in BRIMM Video Work, so that a run started by hand and the launch agent's,
  // whose temp folders differ, share it.
  const home = deps.home || studioHome();
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

/** The names in a folder, or none when it cannot be read. */
function namesIn(folder) {
  try {
    return readdirSync(folder);
  } catch (e) {
    return [];
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
      // In a light import, why says nothing of the file of any video in the folder, nor any path: it may be a client's.
      const why = String(e.code || e.message);
      log(`The work on this folder stopped (${withoutNames(why, namesOf(...namesIn(folder)))}).`);
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
  if (!a.file && !a.folders.length && !a.checkClaude && !a.fromPlan) a.help = true;
  return a;
}

const HELP = `For a video that is not edited yet: a transcript with a time for every word, a cut plan made by the rules, and the
rough cut's captions. Claude is not asked, and no video is made: the import is always the light import.

  node unedited.js <file>             one video: its files appear beside it, and nothing is moved
  node unedited.js --watch <folder>   every video in the folder that has no cut plan yet. Each one is then moved, with its
                                      files, into a new folder there named for the day

  --watch <folder>   again, to work more than one folder
  --out <folder>     where to write, for one file
  --rules-only       accepted, and means nothing now: the import never asks Claude
  --check-claude     ask Claude once, as a reading does, and say whether it answered: the installer runs this from a
                     launch agent of its own, to see that the background job can reach Claude
  --until <time>     with --check-claude: ask Claude nothing once this time, in seconds since 1970, has passed. The
                     installer gives it, so that a check a cut-short setup left behind asks nothing at the next login
  --from-plan        gone: the import makes no videos now. It says so and ends with 2

A video in this Mac's drop folder is made into an episode that waits for its person to say what it is. A Zoom download is
not imported yet: it is left in the folder, and its status says to put it in BRIMM VIDEO Transfer.

The video and its sound never leave this Mac, and nothing of them goes to Claude when a video is imported.

While it works, a small window in the top right corner of the screen shows how far each video has got: the step, a bar,
and how long is left. Closing it changes nothing about the work.
`;

/** A banner on the Mac's screen. It is a courtesy: when it cannot be shown, nothing else changes. The import posts its notices
    through it, and so does a reading (reading.js). */
export const bannerArgs = (text) => ["-e", `display notification ${JSON.stringify(text)} with title ${JSON.stringify(STUDIO_NAME)}`];
export const banner = (text) => {
  const child = spawn("/usr/bin/osascript", bannerArgs(text), { stdio: "ignore" });
  child.on("error", () => {});
};

/** What a run started from the command line is given: the real way of running a program, the programs `found` on this Mac,
    the log, the banner and a real wait. And the home folder: the one HOME names, as it does for the launch agent and in a
    shell, and the Mac's own word for it when HOME names none. Every import is the light import (Phase 2), so the run is told so
    (`light`) whatever this Mac's settings say of the import: the episodes of its drop folder are imported lightly, and so are
    the one file and a folder that is not its drop folder. `args` is what the run was asked to do; --rules-only means nothing
    now, since the import never asks Claude. */
export function depsFor(found, log, env = process.env, args = {}) {
  const home = studioHome(env);
  // This Mac's settings for episodes, when it has them: with them, the import of its own drop folder makes episodes.
  const settings = readSettings(home).settings || null;
  return { run: runProgram, tools: found, model: found.model, home, settings, log, notify: banner, wait: (ms) => new Promise((r) => setTimeout(r, ms)), progress: reporter({ folder: progressFolder(home), swift: found.swift, log }) };
}

/** Do what a run was asked to do, with what it was given: the watched folders, or the one video. Resolves what the run ends
    with: for folders what uneditedFolders gives, and for one video 0 when everything was made, 1 when something was not, and
    2 when there is no such file. --from-plan is gone, since the import makes no videos now: asked for, the run says so and
    ends with 2, whatever else it was asked, before anything is made. */
export async function doAsked(args, deps) {
  const { log = () => {} } = deps;
  if (args.fromPlan) {
    log("--from-plan is gone: the import makes no videos now.");
    return 2;
  }
  if (args.folders.length) return uneditedFolders(args.folders, deps);
  const file = resolve(args.file);
  if (!existsSync(file)) {
    log(`There is no file at ${file}.`);
    return 2;
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
  // Said even on a Mac that lacks a program: nothing is made, so nothing is needed.
  if (args.fromPlan) {
    log("--from-plan is gone: the import makes no videos now.");
    return 2;
  }
  const refused = homeRefusal();
  if (refused) {
    log(refused);
    return 2;
  }
  const found = findPrograms();
  if (found.missing.length) {
    for (const m of found.missing) log(m);
    log("Run tool/install.sh to set this Mac up.");
    return 2;
  }
  const deps = depsFor(found, log, process.env, args);
  try {
    return await doAsked(args, deps);
  } catch (e) {
    // An error may name a video's file, as a path does: only its code is logged, and the run ends with 1.
    log(`The work stopped (${(e && e.code) || "an error"}).`);
    return 1;
  }
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
