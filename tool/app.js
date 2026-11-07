// Opening an episode in the HyperFrames app (architecture 2026-10-27: sections 4.1, 4.8, 5.1, 5.2, 5.6, 5.7 and 7.1).
//
// edit.js finds the episode, asks the gate, refuses an episode whose main project in use was made on another Mac and is not on this
// one (projectOnAnotherMac: one Mac edits a video from start to finish), refuses a project whose folder is a session clip's on the
// volume, however the record spells its name (clipFolders, clipTrouble: PR 15's rule, as free.js has it; decided before the claim),
// claims it for this Mac, and then gives it to openInApp, which does the rest:
//   - a project made before is opened again, and nothing is made or started (4.8). If the recording has changed since the project
//     was made she is told, and the project is opened as it was: a project that may be open in the app is never changed (4.8);
//   - unless its video has been taken away (`free`, free.js; plan PR 15). The project is still the one in use, so no second is made:
//     the working copy is asked for if it is not there (she is told it is being made, and to say it again), and when it is, and is the
//     size and length the project was made at, it is renamed into media/recording.mp4, as the writer put it there. A recording that
//     has changed since cannot be made into that video again, so the project is not opened (5.6);
//   - a folder at the project's name that the record does not know, as a run whose record was not written leaves, is taken as the
//     project it is and recorded: nothing is made or started for it either;
//   - the project's name is the first that no project the record keeps has: "main", and "main 2", "main 3" and so on once a correction
//     of the video's kind has kept the project made for the earlier kind (4.8). That project keeps its name, its folder and its entry,
//     and a folder that is there is never written over, whatever the record says of it;
//   - otherwise the episode's words must be on this Mac, and so must the working copy of its video (5.7). The copy is a detached
//     job (workcopy.js) that can take minutes, so when it is not there it is asked for, and she is told to say it again when it
//     is made;
//   - and Claude's reading must be in the episode's record: the project is written from it (the cut plan and the Reel suggestions), and
//     nothing writes it again afterwards, so a project made while `read` is still at work on it would keep an unfinished reading for
//     good. Until the record holds the current reading nothing is made, and she is told to say it again when it has finished. Once it
//     does, the project is made even while the reading's own late check is still to come (plan R1d), if the words, the Reel
//     suggestions and the cut plan are each at the size the record lists (readListed; else she is told some files are not whole yet,
//     and claimAndBring says so before it claims anything). Only a new project waits for the reading: one made before is opened as it
//     was, and so is a folder the record does not know;
//   - the project is written from them (project.js), whole or not at all, with the working copy moved into it (5.1, 5.2);
//   - the app is opened on the project by the pinned command line (hyperframes.js), by absolute path and in a short list of
//     variables of its own, with her chat handed to the app only when handoverAllowed says it may be (5.6);
//   - what the command line printed is said in her words, and, whenever the app opened, a line names the app's buttons that
//     Studio cannot control (BUTTONS; 3.3 and 5.9), and after it, when this Mac picked an exports folder that is not Downloads, a
//     last line says where to export, in Finder's words (Phase 3, L1b). The record gets the project and the time it was opened
//     (7.1). A record that could not be written ends the run with 1, and the project it was for stays on this Mac.
// A project that was made is kept whether or not the app opened: nothing here takes one away.
//
// The last three steps are openProjectInApp, which a Reel's project is opened by too (app-reel.js, plan PR 5): it asks the app,
// says what the command line printed, and writes the record, for any project it is given (`keeps` says which other projects stay as
// they are, and `also` may change the record that is written, as a Reel's picking does). The words and the readers of a project
// folder that a Reel's project has in common with the main project's (noWords, notWhole, recordingChanged, factsIn, copyIn and the
// like) are exported for app-reel.js to use as they are.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command. What it touches beyond the episode's own
// files is given to it (`deps`), so that no test runs the command line, the app or `claude`; each but `save` has a default, and the
// defaults fail closed.
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { chainUp, claudeAbove, processTable, readProcesses } from "./chain.js";
import { programHome } from "./home.js";
import { readResult, runningCommand } from "./detached.js";
import { isFromPlan, kindOf, localStamp } from "./episode.js";
import { sessionNotCleared } from "./gate.js";
import { copyIn as copyTakes, waitWords } from "./guide.js";
import { projectWaits, readingWaitsUntil, waitFacts } from "./late-wait.js";
import { chatHeld } from "./held.js";
import { PIN, childEnv, cliPath, handoverAllowed, readOpen, toolchainDir } from "./hyperframes.js";
import { transcriptOf } from "./loosened.js";
import { aboutLeft, progressFolder, readRates } from "./progress.js";
import { graphicCuesOfPlan, graphicCuesOfRecord } from "./graphic-cues.js";
import { VOICEOVER, projectCues, projectFiles, projectName, writeProject } from "./project.js";
import { refNamesOf, withReferences } from "./references.js";
import { REELS_FILE } from "./reel-candidates.js";
import { appHandoverOn, episodeWork, exportsWords } from "./settings.js";
import { teleprompterText } from "./sentences.js";
import { studioFolder } from "./studio.js";
import { clockAt } from "./unedited.js";
import { requestWorkCopy, voiceCopyPaths, workCopyKey, workCopyLockOf, workCopyPaths } from "./workcopy.js";
import { fileAt } from "./where.js";

/** The path of a file of the episode `found` (where.js fileAt): in its folder in Dropbox, or in its video/ folder on this Mac when its record keeps its own files there. */
const fileOf = (ctx, found, rel) => fileAt(ctx, { folder: found.folder, record: found.record ?? found.read?.record }, rel);

/** What is said of a Mac that is not set up for the app (settings.js appOf). edit.js says it before it goes any further, so
    openInApp is only ever given a Mac that is set up, and does not say it. */
export const NOT_SET_UP = "This Mac isn't set up for HyperFrames yet: ask Jason.";

/** How long the command line may take to hand the project to the app, in milliseconds: it returns once the app has been asked. */
const OPEN_MS = 60 * 1000;
/** The state of a project that was made for a kind the episode is no longer (4.8): it is kept, and no longer the main project.
    edit.js `kind` writes it, in the record that changes the kind. */
export const KEPT = "kept for an earlier kind";

/** What she is told, in words that hold no path, no flag and no command name. The three exported ones are said of a Reel's project in
    the same words (app-reel.js, plan PR 5); the other two, which tell her what to say again, have a Reel's own there. */
export const noWords = (name) => `The words of ${name} are not on this Mac yet, so there is nothing for HyperFrames to start from. Dropbox may still be bringing them: say it again in a few minutes. If it says this again, tell Jason.`;
const beingMade = (name, ready = "") => `The video for HyperFrames is being made.${ready} Say "open ${name} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
/** When the video for HyperFrames will be ready, as a clock time and in minutes, for the line that says it is being made: from the speed
    this Mac measured of making one (guide.js copyIn, which the guide's "It usually takes" is made of) and the recording's length, as
    the clock shows it now. Nothing while it has measured none, so that no time is named that cannot be backed. */
function readyAt(ctx, record) {
  const seconds = copyTakes(readRates(progressFolder(ctx.home)), record.video && record.video.seconds);
  // While the copy has to wait for Dropbox's late check (plan R1a), the time is the check's, and the copy's after it.
  const wait = waitFacts(ctx, record, seconds);
  if (wait) return ` ${waitWords(wait)}`;
  return seconds === null ? "" : ` It is ready about ${clockAt(ctx.now() + seconds * 1000)}, in ${aboutLeft(seconds)}.`;
}
/** Claude's reading of a raw video waits for the import's late check as well (reading.js): while that is still to come, when the reading
    starts is said with it (plan R1a). */
function stillReading(ctx, record) {
  const due = kindOf(record) === "raw" ? readingWaitsUntil(ctx, record) : null;
  const starts = due === null ? "" : ` It starts at ${clockAt(due)}, when Dropbox has checked its copies.`;
  return `Claude is still reading it.${starts} Say "open ${record.name.text} in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.`;
}
/** What is said when the project is not made because a file it reads is not at the size the record lists, while the reading's own
    late check is still to come (plan R1d). */
export const notWholeYet = (name) => `Some files of ${name} are not whole in Dropbox yet, so its HyperFrames project wasn't made. Say "open ${name} in HyperFrames" again in a few minutes. If it says this again, tell Jason.`;
export const notWhole = (name) => `The HyperFrames project for ${name} is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason.`;
/** What is said of an explainer's HyperFrames project in a HeyGen voice when its folder is not on this Mac (PR H6):
    it holds no media to make it again from, since the voice was made in it. */
export const projectGone = (name) => `The HyperFrames project for ${name} is not on this Mac, and its HeyGen voice is made in it, so it can't be made again here. Ask Jason.`;
export const recordingChanged = (name) => `The recording of ${name} has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.`;
/** What is said of a project's video made again and put back after `free` took it away. The four that follow are said of a Reel's project in the same words (app-reel.js), with the Reel named in `name`. */
export const videoBack = (name) => `The video for ${name} was made again, and it is in the project.`;
export const videoGoneAndChanged = (name) => `The recording of ${name} has changed since its HyperFrames project was made, and the video that project was made from has been taken away, so it can't be opened. Ask Jason.`;
export const noRecording = (name) => `The recording of ${name} is not in its folder, so the video of its HyperFrames project could not be made again. Ask Jason.`;
export const notTheSame = (name) => `The video made again for ${name} isn't the size or length of the one its HyperFrames project was made with, so it wasn't put back. Ask Jason.`;
export const notPutBack = (name) => `The video for ${name} was made again, but it could not be put back in its HyperFrames project. Ask Jason.`;
/** Why her chat stayed where it is when the setting asked for it to go (handoverAllowed's `why`), in her words. */
const STAYS = {
  held: "This chat has held a client or group session's words, so it stays here.",
  "no chat": "This chat could not be found, so it stays here."
};
const STAYS_OTHERWISE = "This video's chat stays here.";
/** The line said whenever the app opened (openOnly), last but for where to export, which openProjectInApp says after it for the main
    video's project and a Reel's when this Mac picked an exports folder that is not Downloads, and never for a HeyGen explainer's opened
    for its voice (architecture 3.3 and 5.9): the app's own buttons, which Studio cannot turn off, and what
    is allowed with them: Share for invited people only, and exports on This Mac, though the Export dialog may start on Cloud. It
    ends with a warning and blocks nothing (Jason, 2026-11-04): The BRIMM doesn't use AI avatars or an AI Sallie, her face or her
    voice, for now. It holds no path, no flag and no name of a command. */
const BUTTONS = "In HyperFrames, share only with people you invite, and export on This Mac: the Export dialog may start on Cloud. The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now.";

/** Whether a project of the record is the one in use for the main video: its key is "main", and it was not kept for an earlier kind.
    edit.js `kind` asks it too, of a record that changes kind. */
export const isMain = (project) => project.key === "main" && project.state !== KEPT;

/** Whether a name is one folder's name and leads nowhere else. A project's name comes from the record, which Dropbox and the other
    Mac write, and is joined to a folder here (by app-reel.js and app-history.js too, which look at a project, and by free.js, which
    deletes inside it). */
export const plainName = (name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[/\0]/.test(name);

// --- A session clip's folder (PR 15's rule, free.js; the review of PR 11, I4) ---
// Nothing of a session goes to HyperFrames unless Sallie confirms. A record that lists a session clip's
// folder again, as a Reel's or the main video's project, under another spelling of its name, must not make it one: the volume takes
// "SESSION CLIP 1" for "Session clip 1", and an accent written as a letter and a mark for the composed one.

/** What a folder is on its volume, { id }: its device and its number there, which no spelling of its name changes; {} when nothing is there;
    { bad: true } when it cannot be looked at. A link is not followed: it has a number of its own. */
export function identityOf(path) {
  try {
    const found = lstatSync(path, { bigint: true });
    return { id: `${found.dev}:${found.ino}` };
  } catch (e) {
    return e.code === "ENOENT" || e.code === "ENOTDIR" ? {} : { bad: true };
  }
}

/** The session clips of the record (a project whose key is `clip N`) as the volume knows their folders in the episode's work folder `work`:
    { names, ids } the plain names the record gives them and the identity of each folder that is there, or { bad: true } when any cannot be
    looked at. A clip is never opened, and nothing that is its folder is either. */
export function clipFolders(work, record) {
  const clips = (Array.isArray(record?.app?.projects) ? record.app.projects : []).filter((p) => typeof p?.key === "string" && /^clip [1-9]\d*$/.test(p.key) && plainName(p.name));
  const ids = new Set();
  for (const clip of clips) {
    const there = identityOf(join(work, clip.name));
    if (there.bad) return { bad: true };
    if (there.id) ids.add(there.id);
  }
  return { names: new Set(clips.map((p) => p.name)), ids };
}

/** Whether the project called `name` is a session clip's folder: "clip" when its name is a clip's or its folder is a clip's on the volume,
    whatever the record calls it; "bad" when that cannot be told (a folder cannot be looked at); "" otherwise. `clips` is clipFolders'. */
export function clipTrouble(work, clips, name) {
  if (clips.bad) return "bad";
  if (clips.names.has(name)) return "clip";
  const there = identityOf(join(work, name));
  if (there.bad) return "bad";
  return there.id && clips.ids.has(there.id) ? "clip" : "";
}

/** The Mac a project in use was made on, when that is not this Mac and the project's folder is not on this Mac either; null
    otherwise. A project's folder is in the Mac's own work folder, never in Dropbox, so the project of another Mac is not here, and
    everything done in it (the app's history, what is in its folder) is there. Making a new project here under its name would drop its
    entry from the record and leave that Mac's work unreachable, so `app` refuses such an episode (edit.js): one Mac edits a video from
    start to finish. The project of this Mac is not asked about: when its folder is gone it is made again under its own name
    (openInApp). A project whose folder is here is opened, whichever Mac made it. A name that leads nowhere a folder is, is a folder
    that is not here. `ctx` is { home, machine }, `found` { name }, and `record` the episode's. `key` says which project: "main", the
    main video's in use (isMain), or a Reel's, "reel 2" (plan PR 5), the record's entry of that key, in whatever state it is in. */
export function projectOnAnotherMac(ctx, { found, record }, key = "main") {
  const earlier = (record.app?.projects ?? []).find((p) => (key === "main" ? isMain(p) : p.key === key));
  if (!earlier || typeof earlier.on !== "string" || earlier.on === "" || earlier.on === ctx.machine) return null;
  return plainName(earlier.name) && existsSync(join(episodeWork(ctx.home, found.name), earlier.name)) ? null : earlier.on;
}

/** What a JSON file holds, or undefined when there is no such file. A file that is there and is not JSON throws. (app-reel.js reads
    the cut plan with it, as the main video's project does.) */
export function jsonIn(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return undefined;
    throw e;
  }
}

/** What the file `rel` in the episode's `folder` holds, read whole and judged by the bytes read (plan R1d): { text } when the record
    lists the file and the bytes read are the size it lists, or it lists none and the file is there; { notWhole: rel } when it lists
    the file and it is missing or of another size; { absent: true } when it lists none and the file is not there. The size is that
    of what was read, not of a look before it. */
export function readListed(folder, record, rel) {
  const listed = record.files && Object.prototype.hasOwnProperty.call(record.files, rel);
  let bytes;
  try {
    bytes = readFileSync(join(folder, rel));
  } catch (e) {
    if (e.code === "ENOENT") return listed ? { notWhole: rel } : { absent: true };
    if (listed) return { notWhole: rel };
    throw e;
  }
  return listed && bytes.length !== record.files[rel] ? { notWhole: rel } : { text: bytes.toString("utf8") };
}

/** `readListed` for the episode's words file: a read that fails for a reason other than the file's not being there is not there either
    ({ absent: true }), as `wordsIn` takes it, so that the words are said not to be on this Mac yet and nothing throws. */
export function readWords(folder, record, rel) {
  try {
    return readListed(folder, record, rel);
  } catch {
    return { absent: true };
  }
}

/** The words, [{ w, start, end }], that `text` holds: the import writes { video, duration, words }, and a bare list is taken too.
    null when it is no JSON or holds no list. */
export const wordsOfText = (text) => {
  try {
    const held = JSON.parse(text);
    const words = Array.isArray(held) ? held : held?.words;
    return Array.isArray(words) ? words : null;
  } catch {
    return null;
  }
};

/** The episode's words, [{ w, start, end }], from its .words.json: the import writes { video, duration, words }, and a bare list is
    taken too. null when the file is not there, cannot be read, or holds no list: then the words are not on this Mac yet. */
export function wordsIn(path) {
  try {
    return wordsOfText(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** The logos in the Assets folder of BRIMM Video, `Assets/Logos` (5.2): the .svg and .png files in it, as paths, sorted. None when
    the folder is not there. */
export function logosIn(root) {
  const dir = join(root, "Assets", "Logos");
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.(?:svg|png)$/i.test(entry.name)).map((entry) => join(dir, entry.name)).sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

/** The guidance the pinned package ships, the CLAUDE.md its projects start from (5.4, item 3). */
export const guidanceOf = (home) => join(toolchainDir(home), "node_modules", "hyperframes", "dist", "templates", "_shared", "CLAUDE.md");

/** Whether `path` is a file that can be read. */
function readable(path) {
  try {
    accessSync(path, constants.R_OK);
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** The chat this command runs in, { sessionId, held } (5.6): the id Claude Code gave it, in `env`, and whether it holds a
    session's words. It is held unless its transcript is found, in her folder's projects folder (loosened.js transcriptOf), and
    can be read, and chatHeld then says it holds none. chatHeld is given the `claude` above this process, found as markChat finds
    it, or "unknown" when none is found, which holds a chat that a mark could belong to. Anything that goes wrong holds the
    chat: the handover is never guessed at.
    A chat that is not found is held, and has no id here: she has no folder for Claude on this Mac, the id is not a chat's, or
    its transcript is not there or is not a file that can be read. handoverAllowed then says "no chat", and she is told that the
    chat could not be found, which is what is true of it; "held" is for a chat that is found and holds a session's words. */
function chatOf(home, env) {
  const sessionId = typeof env.CLAUDE_CODE_SESSION_ID === "string" ? env.CLAUDE_CODE_SESSION_ID : "";
  const notFound = { sessionId: "", held: true };
  let transcriptPath;
  try {
    transcriptPath = transcriptOf({ home, env, folder: realpathSync.native(studioFolder(home)), sessionId });
  } catch {
    return notFound;
  }
  if (transcriptPath === null || !readable(transcriptPath)) return notFound;
  try {
    const table = readProcesses();
    const above = table === null ? null : claudeAbove(chainUp(processTable(table), process.pid));
    return { sessionId, held: chatHeld({ home, sessionId, transcriptPath, claude: above ? { pid: above.pid, start: above.start } : "unknown" }) };
  } catch {
    return { sessionId, held: true };
  }
}

/** What a JSON file holds, or null when there is no such file, it cannot be read, or it is not JSON. */
export function factsIn(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** A file's facts as stat gives them, or undefined when there is no such file or it cannot be looked at. */
export function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

/** What the record keeps of a working copy, { bytes, seconds, fps }, from facts that hold them, or null when they do not hold what
    the record needs (episode.js isAppProject): a size in bytes, a length in seconds above 0, and a frame rate. */
export function copyOf(facts) {
  const { bytes, seconds, fps } = facts ?? {};
  const rate = (typeof fps === "number" && Number.isFinite(fps) && fps > 0) || (typeof fps === "string" && /^[1-9]\d*\/[1-9]\d*$/.test(fps));
  return Number.isInteger(bytes) && bytes >= 0 && typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && rate ? { bytes, seconds, fps } : null;
}

/** The media a project of this episode holds as its video, as a path from the project, or null when it holds none (PR H6): the recording, `media/recording.mp4`,
    for any episode; `media/voiceover.m4a` for an explainer in her own voice (episode.js isFromPlan of a plan whose route is an explainer), whose video is its
    voiceover, a sound alone; and none for an explainer in a HeyGen voice, whose project holds no media at all, the voice being made in it by the app's agent,
    into its assets/. `free` and the video put back (putVideoBack) ask it: with none there is nothing to take away or put back. */
export function mediaOf(record) {
  if (!isFromPlan(record) || record.planned.route !== "explainer") return "media/recording.mp4";
  return record.planned.voice === "heygen" ? null : VOICEOVER;
}

/** The video of a project of the episode whose record is `record`: where project.js moves the working copy to, last, and where `free` (free.js) takes it from
    (mediaOf), or null when the project holds none. Without a record it is the recording's, as a Reel's project's is (app-reel.js). */
export const videoIn = (dir, record = null) => {
  const media = mediaOf(record);
  return media === null ? null : join(dir, media);
};

/** Where the working copy of the episode's video is made and kept (workcopy.js): a video's, or an explainer's voice's (PR H6), by the media its project holds. */
function copyPathsOf(home, folder, record, raw) {
  const key = workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs });
  return mediaOf(record) === VOICEOVER ? voiceCopyPaths(home, folder, key) : workCopyPaths(home, folder, key);
}

/** Whether there is nothing at a path, not even a link. Anything else that stops it being looked at is something there. */
export function nothingAt(path) {
  try {
    lstatSync(path);
    return false;
  } catch (e) {
    return e.code === "ENOENT";
  }
}

/** What the record keeps of the working copy a project holds, from the project's own brimm/facts.json (project.js), which has the
    length and the rate but not the size, and from the size of the video in the project. null when either cannot be had. */
export function copyIn(dir, record = null) {
  const at = videoIn(dir, record);
  const video = at === null ? undefined : statOf(at);
  return video?.isFile() ? copyOf({ ...factsIn(join(dir, "brimm", "facts.json")), bytes: video.size }) : null;
}

/** What a project was made from, as the record keeps it (7.1): the raw file's name, size and time, as stat gives them. */
export const fromOf = (record, raw) => ({ file: record.video.file, bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) });

/** Whether the recording is not the one a project was made from (4.8): its size or its time is not what the project's `from` says.
    The times are compared as moments, to the second the record keeps, and not as the text the record holds: that is written with
    the offset the Mac's zone had on the day, so the same moment is other text once the clocks change. A recording that cannot be
    looked at is no change that can be told, since a project is opened without it. A project that says nothing readable of the
    recording it was made from (no `from`, or one that is no record of a file) may have been made from another: it counts as changed,
    and the record, which two Macs write, is never taken to hold what it does not. */
export function changedSince(project, { found, record, ctx = null }) {
  const raw = statOf(ctx ? fileOf(ctx, found, record.video.file) : join(found.folder, record.video.file));
  if (raw === undefined) return false;
  const from = project?.from;
  if (from === null || typeof from !== "object") return true;
  return from.bytes !== raw.size || Date.parse(from.modified) !== Math.floor(raw.mtimeMs / 1000) * 1000;
}

/** The record's entry for a main project that is made and has never been opened. */
const madeEntry = (ctx, { name, at, from, workingCopy }) => ({ key: "main", name, madeAt: at, on: ctx.machine, from, workingCopy, opened: [], handover: false, fromSuggestion: null, state: "made" });

/** The name the next main project gets, and which one it is (project.js projectName): the first of "<name> main <id>", "<name> main 2
    <id>", "<name> main 3 <id>" and on that no project the record keeps has. A correction of the video's kind keeps the project made
    for the earlier kind, in the record and on disk (4.8), and its name stays its own, so the next main project is another folder: a
    folder of a project the record keeps is never written over, nor taken for the new one. The main project in use is not counted
    among those the record keeps: the one made now takes its place in the record (this is asked only when its folder is gone, or it
    could not be opened as it was), so it may have its name again. Its key in the record stays "main" whatever its number. */
function nextMain(record, projects) {
  const kept = projects.filter((p) => !isMain(p));
  for (let number = 1; ; number++) {
    const name = projectName({ name: record.name.text, part: "main", number, id: record.id });
    if (!kept.some((p) => p.name === name)) return { name, number };
  }
}

/** A folder at the name the main project would get (nextMain) that the record does not know, taken as the project it is: a run that
    made the project and could not write the record leaves one, and the next run finds it here instead of making it again. Gives { project },
    the record's entry for it as makeProject does (state "made", never opened, made now, from the raw video as it is), or { code } 1
    when part of it cannot be read (then a line says so, and nothing is opened), or null when there is no such folder. Nothing is
    asked for and nothing is written, so the words of the recording are not needed. The working copy it was made from is
    described by the facts beside that copy (workcopy.js) when they are still there, which they are unless something took them
    away, and otherwise by the project's own brimm/facts.json (project.js), with the size of the video in the project.
    A folder of a project the record keeps is its own, whatever it is kept for: the name looked at is the first that no such project
    has (nextMain), so a project kept for an earlier kind (4.8) is never taken for the main one, and a folder at the name after
    it is the one a run left. A folder there that cannot be taken for a project is not written over either. */
function adoptProject(ctx, { found, record, at, projects }) {
  const { home } = ctx;
  const { name } = nextMain(record, projects);
  const dir = join(episodeWork(home, found.name), name);
  if (!existsSync(dir)) return null;
  const raw = statSync(fileOf(ctx, found, record.video.file));
  const copy = copyPathsOf(home, found.name, record, raw);
  const workingCopy = copyOf(factsIn(copy.facts)) ?? copyIn(dir, record);
  if (!workingCopy) {
    ctx.say(notWhole(record.name.text));
    return { code: 1 };
  }
  return { project: madeEntry(ctx, { name, at, from: fromOf(record, raw), workingCopy }) };
}

/** Make the main video's project, if it can be made now: { project }, the record's entry for it (state "made", never opened), or
    { code }, when nothing was made and a line said why: the exit code to end with.
    - Without the episode's words there is nothing to start from, so nothing is made or started (1).
    - Without the working copy, it is asked for, unless it is being made already (workcopy.js requestWorkCopy), and she is told
      to say it again when it is done (0). A project made before has taken the copy into itself and left only its facts, which
      is why openInApp looks for that project first.
    - While Claude's reading of the episode is at work and not yet in the record (`projectWaits` "reading"), nothing is made: the project
      is written from the reading, and nothing writes it again later. She is told to say it again when it has finished (0). With the
      reading in the record ("verify": the read run is at its own late check, or this Mac still owes the import's) the words, the Reel
      suggestions and the cut plan are read through `readListed`, and a file not at the size the record lists makes nothing (0, in
      `notWholeYet`'s words). The working copy
      is still asked for when it is not there, as above, and the one line she gets is the reading's: it is the one she waits for
      (the copy is made meanwhile), and what she says again is the same.
    - The pictures its cues name by a `ref` in their style are copied from the reference folder into its brimm/references/ (references.js
      withReferences, PR H3; a HEIC or TIFF picture as a JPEG, and the cue then names the JPEG). A picture that is not in the folder, not
      whole yet, or that could not be turned into a JPEG is left out and said in her words, and its cue keeps its style. Cues that name
      none look at no folder, say nothing and make nothing.
    The project is written whole or not at all (project.js writeProject), and a folder of that name that is there already is never
    written over: it throws. Its name is the first that no project the record keeps has (nextMain), so after a correction of the
    kind it is "main 2", and a folder the record does not know at that name is taken before this (adoptProject): what is left to
    throw is a folder that appeared between the two. */
async function makeProject(ctx, { found, record, at, projects }, { cli, guidance, planned }) {
  const { home } = ctx;
  const stem = basename(record.video.file, extname(record.video.file));
  const wait = projectWaits(ctx, { name: found.name, record });
  // While the reading's own late check is still to come (plan R1d), the three files read from the episode's folder are held to the
  // sizes the record lists, judged by the bytes read; one that is not whole makes nothing.
  const checked = wait === "verify" ? [`${stem}.words.json`, REELS_FILE, `${stem}.cut-plan.json`].map((rel, i) => (i === 0 ? readWords : readListed)(dirname(fileOf(ctx, found, rel)), record, rel)) : null;
  if (checked && checked.some((got) => got.notWhole)) {
    ctx.say(notWholeYet(record.name.text));
    return { code: 0 };
  }
  const words = checked ? (checked[0].text === undefined ? null : wordsOfText(checked[0].text)) : wordsIn(fileOf(ctx, found, `${stem}.words.json`));
  if (!words) {
    ctx.say(noWords(record.name.text));
    return { code: 1 };
  }
  const raw = statSync(fileOf(ctx, found, record.video.file));
  const copy = copyPathsOf(home, found.name, record, raw);
  const reading = wait === "reading";
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    requestWorkCopy(ctx, { folder: found.name });
    ctx.say(reading ? stillReading(ctx, record) : beingMade(record.name.text, readyAt(ctx, record)));
    return { code: 0 };
  }
  if (reading) {
    ctx.say(stillReading(ctx, record));
    return { code: 0 };
  }
  const facts = JSON.parse(readFileSync(copy.facts, "utf8"));
  const { name, number } = nextMain(record, projects);
  const reels = checked ? (checked[1].text === undefined ? undefined : JSON.parse(checked[1].text)) : jsonIn(fileOf(ctx, found, REELS_FILE));
  const plan = checked ? (checked[2].text === undefined ? undefined : JSON.parse(checked[2].text)) : jsonIn(fileOf(ctx, found, `${stem}.cut-plan.json`));
  // The graphic cues go in beside the suggested cuts, placed on the project's words (project.js). A raw video's are the cut plan's own,
  // or for a plan made before them its ideas for graphics as cues (graphic-cues.js graphicCuesOfPlan). An iPhone clip's are the ones its
  // reading kept in its record (graphicCuesOfRecord, PR H2): its cut plan is the import's, and holds none.
  const short = record.kind === "short video";
  // A video made from a plan (PR H5b) takes the plan's guide's cues in place of the reading's, each b-roll and screen cue naming its footage's file,
  // and the footage whose copies are made already is moved in with the recording; the rest comes at an open (placeFootage).
  const kit = isFromPlan(record) && typeof planned === "function" ? planned({ found, record }) : null;
  // An explainer in her own voice (PR H6): its project is the explainer's page over its voiceover, the plan's cues placed on the voiceover's words, and
  // the plan's teleprompter script beside them. (Its voice is the working copy `copy` made of the voiceover: media/voiceover.m4a.)
  const explainer = mediaOf(record) === VOICEOVER ? { voice: "sallie", teleprompter: teleprompterText(record.planned.lines) } : null;
  const input = {
    kind: "main", number, short, id: record.id, name: record.name.text, spellings: record.spellings, logos: logosIn(ctx.settings.root), facts, words,
    plan, graphicCues: kit ? kit.cues : short ? graphicCuesOfRecord(record) : graphicCuesOfPlan(plan), reels: reels?.candidates, video: copy.video, cli, guidance: readFileSync(guidance, "utf8"), createdAt: at,
    ...(kit && kit.footage ? { footage: kit.footage.filter((item) => item.from !== null).map(({ path, from }) => ({ path, from })) } : {}),
    ...(explainer ? { explainer } : {})
  };
  // The pictures its cues name by a ref come from the reference folder into the project (references.js; PR H3): those that are not there are said, and
  // their cues keep their styles. A project whose cues name none looks at no folder and says nothing of it.
  await withReferences(ctx, refNamesOf(projectCues(input)), (references) => writeProject(join(episodeWork(home, found.name), name), projectFiles({ ...input, references })));
  return { project: madeEntry(ctx, { name, at, from: fromOf(record, raw), workingCopy: { bytes: facts.bytes, seconds: facts.seconds, fps: facts.fps } }) };
}

/** Whether facts (a copy's, or a project's brimm/facts.json) say how long a video is and how large its picture: what a video put back is
    held to. */
export const sizedFacts = (facts) => Boolean(facts) && Number.isFinite(facts.seconds) && facts.seconds > 0 && Number.isFinite(facts.width) && facts.width > 0 && Number.isFinite(facts.height) && facts.height > 0;

/** The one check every working copy put into a project passes (plan PR 15; the video of a project `free` took the video from): a copy, by its facts `made`, against the project's own `was`
    (brimm/facts.json), and `size`, the file's size on disk. Gives { workingCopy }, what the record keeps of the copy, when the project's
    facts say its picture and length, the copy's say what the record keeps, the copy is the same picture size and within a second of the same
    length (the job's own allowance), starts where the project says it does (`starts`, which a Reel's check gives; true for the main video),
    and the file is as large as its own facts say; else { no }, the first that fails, in this order: "project" (the project's own facts cannot
    be read), "copy" (the copy's facts say nothing the record can keep), "other" (it is not the project's size, length or start), and "copy"
    again (the file is not as large as its facts say). */
export function copyFits({ was, made, size, starts = true }) {
  if (!sizedFacts(was)) return { no: "project" };
  const workingCopy = copyOf(made);
  if (!sizedFacts(made) || !workingCopy) return { no: "copy" };
  if (made.width !== was.width || made.height !== was.height || Math.abs(made.seconds - was.seconds) > 1 || !starts) return { no: "other" };
  if (size !== workingCopy.bytes) return { no: "copy" };
  return { workingCopy };
}

/** Put the video back into a project whose video has been taken away (`free`, free.js): { workingCopy }, what the record keeps of the
    copy that was put in, when it was, or { code }, when nothing was put back and a line said why: the exit code to end with. The
    project is still the project in use, so nothing is made but the video, and the app is not asked until it is back.
    - A recording that is not the one the project was made from (changedSince) cannot be made into that video again, and one that is
      not in the episode cannot be made into any: the project is not opened (1). `free` takes nothing in either case, so this is a
      video taken away by hand.
    - Without the working copy, it is asked for, unless it is being made already (workcopy.js requestWorkCopy), and she is told to say
      it again when it is done (0), as for a new project. A copy is there when its video and its facts both are.
    - The copy must be the size and the length the project was made at, to the second, as its own brimm/facts.json says (project.js):
      its page, its words and their times were made from that video. Facts that cannot be read are no check, so a project whose facts
      cannot be read is not opened (notWhole), nor a copy whose facts cannot (notPutBack), and a copy of another size or length is left
      where it is, with the project (notTheSame): all 1. And the file must be as large as its own facts say, as the job leaves it: one
      that is not is not whole (notPutBack).
    - Then the copy is renamed into media/recording.mp4, on the same disk, as the writer put it there, so that the project never holds
      a half-written video; its facts stay beside it. A rename that fails leaves the copy where it was (notPutBack, 1).
    `rename` is how a file is moved: a test gives another. */
function putVideoBack(ctx, { found, record, project, dir }, { rename }) {
  const { home } = ctx;
  const name = record.name.text;
  const raw = statOf(fileOf(ctx, found, record.video.file));
  if (raw === undefined) {
    ctx.say(noRecording(name));
    return { code: 1 };
  }
  if (changedSince(project, { found, record, ctx })) {
    ctx.say(videoGoneAndChanged(name));
    return { code: 1 };
  }
  const copy = copyPathsOf(home, found.name, record, raw);
  const was = factsIn(join(dir, "brimm", "facts.json"));
  const made = factsIn(copy.facts);
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    requestWorkCopy(ctx, { folder: found.name });
    ctx.say(beingMade(name, readyAt(ctx, record)));
    return { code: 0 };
  }
  // The copy's own facts say how large it is when the job puts it in place whole; a file of another size is not that copy.
  const fits = copyFits({ was, made, size: statOf(copy.video)?.size });
  if (fits.no) {
    ctx.say({ project: notWhole, copy: notPutBack, other: notTheSame }[fits.no](name));
    return { code: 1 };
  }
  if (!moveIn(copy.video, videoIn(dir, record), rename)) {
    ctx.say(notPutBack(name));
    return { code: 1 };
  }
  ctx.say(videoBack(name));
  return { workingCopy: fits.workingCopy };
}

/** Move a video into a project, which `rename` does on the same disk, so that nothing is copied and the project never holds half a video:
    true when it is there, false when it could not be (then it is where it was). `rename` is how a file is moved: a test gives another. */
export function moveIn(from, to, rename) {
  try {
    mkdirSync(dirname(to), { recursive: true });
    rename(from, to);
    return true;
  } catch (e) {
    return false;
  }
}

/** What she is told while the copies of the footage of a video made from a plan are being made, at an open (PR H5b): the project opens, and the
    footage comes into it the next time she opens it. */
export const FOOTAGE_COMING = 'Its footage is still being made for HyperFrames: say "open it in HyperFrames" again when it is done.';
/** What she is told when a copy of footage that is made could not be moved into the project. */
export const footageNotInWords = (name) => `Some of its footage could not be put into the project. Say "open ${name} in HyperFrames" again. If it says this again, tell Jason.`;
/** What she is told when a copy of footage is still missing and the last run that made copies failed for it for a reason that will not pass. */
export const footageNotMadeWords = (name) => "Some of its footage could not be made for HyperFrames, and opening it again won't change that. Ask Jason."; // `name` is kept for callers: no retry is promised

/** Whether the last run of the working copy for this episode failed to make the copy of the footage of `shot` for a reason that will not pass: its
    result holds a line "The footage for shot <n> could not be made: <why>" (workcopy.js makeFootageCopies), in `failed` for a run of the footage alone
    and in `footageFailed` for the run that made the video's copy first, and the why is not that Dropbox is still bringing the video over. A run at
    work now (`making`) has not left its result yet: what the last one left is not read. */
function footageNotMade(ctx, found, shot) {
  return footageFailedLines(ctx, found.name).some((line) => line.startsWith(`The footage for shot ${shot} could not be made:`));
}

/** The lines of the last working-copy result of the episode in `folder` that say a copy of footage could not be made for a reason that will not pass
    ("The footage for shot <n> could not be made: <why>"): none while a run of the copy is at work, and none for a why that is Dropbox still bringing
    the video over. */
function footageFailedLines(ctx, folder) {
  if (runningCommand(ctx.home, folder, ctx.alive, workCopyLockOf(ctx.home, folder))) return [];
  const result = readResult(ctx.home, folder, "workcopy");
  if (result === null || typeof result !== "object") return [];
  const lines = [...(Array.isArray(result.failed) ? result.failed : []), ...(Array.isArray(result.footageFailed) ? result.footageFailed : [])];
  return lines.filter((line) => typeof line === "string" && /^The footage for shot \d+ could not be made:/.test(line) && !line.includes("Dropbox is still bringing"));
}

/** Whether the last run of the working copy for the episode in `folder` left a copy of footage it could not make for a reason that will not pass
    (`status` says so). */
export const footageFailed = (ctx, folder) => footageFailedLines(ctx, folder).length > 0;

/** Put the footage of a video made from a plan into its main project at `dir`, at every open of it (PR H5b). `kit` is what the plan gives the
    project (join.js planProject, given as the `plan` dep: footage.js reaches this module through finish.js, so it is not imported here), read just
    now, so that a part her client has agreed to since, and a copy made since, are found: its `footage` are the files that may go into media/, each
    { path, from } with `from` the copy made of it, or null while there is none. Each that is not in the project already is moved in from its
    copy (moveIn: a rename on the same disk, nothing copied); one with no copy is asked for, once for all (workcopy.js requestWorkCopy with
    `footage`, which starts nothing while a run is at work), and she is told the footage is being made (FOOTAGE_COMING); a copy that cannot be
    moved is left where it is and she is told (footageNotInWords). Nothing here stops the project opening, and a null `kit` does nothing, nor does one with
    no footage (`footage: null`, an explainer's: it has none, PR H6). */
function placeFootage(ctx, { found, dir, kit, record }, { rename }) {
  const after = [];
  if (!kit || !kit.footage) return after;
  let waiting = false;
  let stuck = false;
  let unmade = false;
  for (const item of kit.footage) {
    const to = join(dir, item.path);
    if (existsSync(to)) continue;
    if (item.from === null) {
      // A copy that the last run failed to make for a reason that will not pass is not asked for again at every open (the final review, fix 4).
      if (footageNotMade(ctx, found, item.shot)) unmade = true;
      else waiting = true;
    } else if (!moveIn(item.from, to, rename)) stuck = true;
  }
  if (waiting) {
    requestWorkCopy(ctx, { folder: found.name, footage: true });
    after.push(FOOTAGE_COMING);
  }
  if (unmade) after.push(footageNotMadeWords(record.name.text));
  if (stuck) after.push(footageNotInWords(record.name.text));
  return after;
}

/** Open the episode's main video in the HyperFrames app, making its project first when it has none, and resolve the exit code: 0
    when the app opened on the project, or when the working copy is being made and she has been told to say it again; 1 when the
    app did not open, or the episode's words are not on this Mac, or a project folder of this Mac cannot be read, or the record
    could not be written. It runs once edit.js has gated the episode and claimed it. A project that is made stays, whether or not
    the app opened.
    `ctx` is what edit.js gives a command, { home, machine, now, alive, say, start, settings }. `found` is { name, folder }: the
    name of the episode's folder, and its path in Episodes. `record` is the episode's record.
    The main project in the record's `app` whose folder is on this Mac is opened again, with one more time it was opened, and
    nothing is made or started. If the recording is not the one it was made from (its size or its time is not what `from` says,
    and a recording that is not there is no change), that is said first, and the project is opened as it was, with nothing in it
    replaced and no new project made: a new project for the new recording is a later step. Unless its video has been taken away
    (`free`, free.js): then the video is put back first (putVideoBack), from a working copy made again, or the copy is asked for and
    she is told to say it again, and the recording having changed means the project is not opened at all. A main project in the record whose
    folder is not here is replaced, when this Mac made it: by the folder at the name the project would get, when one is there
    that the record does not know (adoptProject), and otherwise by a new project (makeProject). One that another Mac made is not
    replaced: its work is on that Mac, and a new project under its name would drop its entry, so edit.js refuses it before the
    claim (projectOnAnotherMac). A new project is not made
    while Claude's reading of the episode is at work and not yet in the record (`read` holds its
    lock): she is told to say it again when it has finished, and it ends with 0; once the reading is in, the files are held to the sizes
    the record lists (makeProject). Only a new project waits: one made before is
    opened, and a folder the record does not know is taken, whether or not the reading is at work. A project kept for an earlier
    kind (KEPT) is none in use: the next is made as any first one is, under the first name no project the record keeps has
    (nextMain), "main 2" after the first, and the kept one keeps its folder, its name and its entry in the record.
    What it says when the app opened is the command line's own words in hers, one line more about her chat when a handover was
    wanted and not made, then the line about the buttons Studio cannot control (BUTTONS), and last, when this Mac picked an exports
    folder that is not Downloads, where to export: "Export it on This Mac, into <the folder in Finder's words>." (openProjectInApp);
    when the app did not open it says the reason alone.
    The record that is saved holds the project in `app.projects`, with a time in `opened` only if the app opened, and `handover`
    true if the command line says it took her chat, whatever was asked of it.
    `deps` is all that is touched beyond the episode's own files, and each one but `save` has a default:
    - `save(next)` writes the episode's next record and resolves 0 when it has, and anything else when it could not, having said
      itself why: then the run ends with 1. It is called once, after the app has been asked, so a project that was made and not
      opened is recorded too. It is checked first, so that nothing is made without it;
    - `cli` and `node`: the pinned command line's program (hyperframes.js cliPath), and the program that runs it (this one);
    - `guidance`: the path of the CLAUDE.md the pinned package ships, in the toolchain's folder;
    - `spawn` (spawnSync) runs the command line, and `env` (this process's) is where the chat's id and the LANG come from;
    - `rename` (renameSync) moves a working copy made again into a project whose video was taken away (putVideoBack);
    - `chat()` gives { sessionId, held } for the chat that asked (chatOf). It is asked only when this Mac's setting wants the
      handover, since that is all it decides;
    - `plan({ found, record })` gives what the plan a video was made from gives its project, { cues, footage }, for a record that is such a video
      (episode.js isFromPlan; edit.js gives join.js planProject): the project is made from its guide's cues, with the footage whose copies are
      made, and at every open the footage that may go in and is not in media/ is moved in, the copies not made are asked for, and she is told
      (placeFootage; PR H5b). None given, a video made from a plan is a raw video's. */
export async function openInApp(ctx, { found, record }, deps = {}) {
  const { save, spawn = spawnSync, env = process.env, node = process.execPath, rename = renameSync } = deps;
  if (typeof save !== "function") throw new Error("openInApp: no save was given, so the record could not be written");
  const { home } = ctx;
  const cli = deps.cli ?? cliPath(home);
  const at = localStamp(new Date(ctx.now()));
  const work = episodeWork(home, found.name);
  const projects = record.app?.projects ?? [];
  const earlier = projects.find(isMain);

  let project = earlier && plainName(earlier.name) && existsSync(join(work, earlier.name)) ? earlier : null;
  let restored = null;
  if (project) {
    const media = videoIn(join(work, project.name), record);
    if (media !== null && nothingAt(media)) {
      // Its video has been taken away (free.js): it is put back before the app is asked, or the project is not opened. (A project that holds no media, as
      // an explainer's in a HeyGen voice, has none to put back: PR H6.)
      const back = putVideoBack(ctx, { found, record, project, dir: join(work, project.name) }, { rename });
      if (back.code !== undefined) return back.code;
      restored = back.workingCopy;
    } else if (media !== null && changedSince(project, { found, record, ctx })) {
      // The project is opened as it was whatever the recording is now: a project that may be open in the app is never changed (4.8).
      ctx.say(recordingChanged(record.name.text));
    }
  } else {
    // An explainer in a HeyGen voice whose project is not on this Mac has no media to make it again from (PR H6): its voice was made in the project, by the
    // app's agent, and what is in the plan's folder is a sound with no page to play it. Nothing is made.
    if (mediaOf(record) === null) {
      ctx.say(projectGone(record.name.text));
      return 1;
    }
    const taken = adoptProject(ctx, { found, record, at, projects }) ?? await makeProject(ctx, { found, record, at, projects }, { cli, guidance: deps.guidance ?? guidanceOf(home), planned: deps.plan });
    if (taken.code !== undefined) return taken.code;
    ({ project } = taken);
  }
  // The footage of a video made from a plan, at every open (PR H5b): what may go in and is not in media/ is moved in from its copy, and the copies
  // that are not made are asked for. The project opens whatever comes of that: footage is added to it, never needed for it.
  // What it says of the footage comes after "It's open in HyperFrames." (review changes R4c), not before it.
  const footage = typeof deps.plan === "function" && isFromPlan(record) ? placeFootage(ctx, { found, dir: join(work, project.name), kit: deps.plan({ found, record }), record }, { rename }) : [];
  const opened = await openProjectInApp(ctx, { record, project, dir: join(work, project.name), projects, keeps: (p) => !isMain(p), at, restored }, { save, cli, spawn, env, node, chat: deps.chat });
  for (const line of footage) ctx.say(line);
  return opened;
}

/** Ask the app to open the project in `dir`, and say what came of it in her words, without writing any record (PR H6: the open half of
    openProjectInApp, which a HeyGen explainer's project is opened by too, before its voice is taken in, when its record is a plan's: explainer.js
    openVoiceProject). Resolves what the command line printed, as hyperframes.js readOpen reads it: { opened, handedOver, words }. What it says is the
    command line's own words in hers (readOpen), one line more about her chat when a handover was wanted and not made, and last, whenever the app
    opened, the line about the buttons Studio cannot control (BUTTONS). Where to export is said after it by openProjectInApp alone: a HeyGen
    explainer's project opens for its voice, with nothing to export yet. `record` is the episode's record, which says whether her chat may be handed over
    (hyperframes.js handoverAllowed). `deps` are `cli`, `spawn`, `env`, `node` and `chat` as openInApp has them; the chat is asked only when this Mac's
    setting wants the handover. */
export function openOnly(ctx, { record, dir }, { cli, spawn = spawnSync, env = process.env, node = process.execPath, chat: given }) {
  const { home } = ctx;
  // A handover is looked into only where it is wanted: it is all the chat decides, and finding out can take a while.
  const wanted = appHandoverOn(ctx.settings);
  const askChat = given ?? (() => chatOf(home, env));
  const chat = wanted ? askChat() : { sessionId: "", held: true };
  const handover = handoverAllowed({
    setting: wanted, sessionId: chat.sessionId, held: chat.held,
    episode: { session: sessionNotCleared(record), unanswered: kindOf(record) === null }, project: { clip: false }
  });
  const ran = spawn(node, [cli, "open", dir, "--json"], {
    env: childEnv({ base: { HOME: programHome(home, env), LANG: env.LANG }, node, handover: handover.allowed, sessionId: chat.sessionId }),
    encoding: "utf8", timeout: OPEN_MS
  });
  const read = readOpen(ran.stdout, ran.status, { handoverWanted: wanted });
  ctx.say(read.words);
  if (wanted && read.opened && !read.handedOver) ctx.say(Object.hasOwn(STAYS, handover.why) ? STAYS[handover.why] : STAYS_OTHERWISE);
  // The buttons Studio cannot control are named whenever the app opened, after the opening and whatever is said of her chat. The app
  // is open whether or not the record can be written, so the reminder does not wait for it.
  if (read.opened) ctx.say(BUTTONS);
  return read;
}

/** Ask the app to open a project of the episode, say what came of it in her words, and write the record: the part of opening that the
    main video's project and a Reel's (app-reel.js, plan PR 5) have in common. Resolves the exit code: 0 when the app opened, 1 when
    it did not or when the record could not be written.
    `project` is the record's entry for the project, made or made before, and `dir` its folder. `projects` are the record's, and
    `keeps` says which of them stay as they are in the record that is written: the project's own entry is replaced by the updated
    one, and the others, the main project's and the other Reels', are kept. `at` is the moment, as the record keeps one (the moment
    the project was made, when it was made by the same run). `also(next)` may change the record that is written (a Reel is marked
    picked in the same write); it is given it whole and gives it back. `restored` is what the record keeps of the working copy that
    was put back into the project's folder a moment before (putVideoBack), when one was: the project's entry gets it.
    What it says is the command line's own words in hers (readOpen), one line more about her chat when a handover was wanted and not
    made, then the line about the buttons Studio cannot control (BUTTONS), which is said whenever the app opened (openOnly), and after
    it, when this Mac picked an exports folder that is not Downloads (settings.js exportsWords), where to export: "Export it on This
    Mac, into <the folder in Finder's words>." (Phase 3, L1b). The record gets
    the time of the open only if the app opened, `handover` true if the command line says it took her chat, and the state moved
    from made to opened and never back.
    `deps` are the `save` that writes the record (resolves 0 when it has), the pinned command line's program `cli`, and `spawn`,
    `env`, `node` and `chat` as openInApp has them. The chat is asked only when this Mac's setting wants the handover. */
export async function openProjectInApp(ctx, { record, project, dir, projects, keeps, at = localStamp(new Date(ctx.now())), also = (next) => next, restored = null }, { save, cli, spawn = spawnSync, env = process.env, node = process.execPath, chat: given }) {
  const read = openOnly(ctx, { record, dir }, { cli, spawn, env, node, chat: given });
  // Where to export, in Finder's words, when this Mac picked an exports folder that is not Downloads (Phase 3, L1b): said for the main
  // video's project and a Reel's, which are exported from the app, and not by openOnly, which a HeyGen explainer's project opens by too
  // before its voice is made. Like the buttons line, it does not wait for the record.
  if (read.opened) {
    const into = exportsWords(ctx.settings, ctx.home);
    if (into) ctx.say(`Export it on This Mac, into ${into}.`);
  }

  // A time is added only if the app opened; a chat once handed over stays recorded as handed over; a later state is not moved back.
  const updated = {
    ...project,
    ...(restored ? { workingCopy: restored } : {}),
    opened: read.opened ? [...project.opened, at] : project.opened,
    handover: project.handover || read.handedOver,
    state: read.opened && project.state === "made" ? "opened" : project.state
  };
  // The app has been asked by now, so a record that could not be written ends the run with 1, whether or not the app opened: what the
  // project is stays on this Mac, and the next run finds it again (adoptProject).
  const written = await save(also({ ...record, app: { ...record.app, toolchain: PIN.version, projects: [...projects.filter(keeps), updated] } }));
  if (written !== 0) return 1;
  return read.opened ? 0 : 1;
}

/** The home folder the command line and the app are given as HOME (home.js): the real one, even in a check that gives Studio a home of its own. */
export { programHome };
