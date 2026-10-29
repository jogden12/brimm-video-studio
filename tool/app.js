// Opening an episode in the HyperFrames app (architecture 2026-10-27: sections 4.1, 4.8, 5.1, 5.2, 5.6, 5.7 and 7.1).
//
// edit.js finds the episode, asks the gate, refuses an episode whose main project in use was made on another Mac and is not on this
// one (projectOnAnotherMac), claims it for this Mac, and then gives it to openInApp, which does the rest:
//   - a project made before is opened again, and nothing is made or started (4.8). If the recording has changed since the project
//     was made she is told, and the project is opened as it was: a project that may be open in the app is never changed (4.8);
//   - a folder at the project's name that the record does not know, as a run whose record was not written leaves, is taken as the
//     project it is and recorded: nothing is made or started for it either;
//   - the project's name is the first that no project the record keeps has: "main", and "main 2", "main 3" and so on once a correction
//     of the video's kind has kept the project made for the earlier kind (4.8). That project keeps its name, its folder and its entry,
//     and a folder that is there is never written over, whatever the record says of it;
//   - otherwise the episode's words must be on this Mac, and so must the working copy of its video (5.7). The copy is a detached
//     job (workcopy.js) that can take minutes, so when it is not there it is asked for, and she is told to say it again when it
//     is made;
//   - and Claude's reading must be over: the project is written from it (the cut plan and the Reel suggestions), and nothing writes
//     it again afterwards, so a project made while `read` is still at work would keep an unfinished reading for good. While it is at
//     work nothing is made, and she is told to say it again when it has finished. Only a new project waits for it: one made before
//     is opened as it was, and so is a folder the record does not know;
//   - the project is written from them (project.js), whole or not at all, with the working copy moved into it (5.1, 5.2);
//   - the app is opened on the project by the pinned command line (hyperframes.js), by absolute path and in a short list of
//     variables of its own, with her chat handed to the app only when handoverAllowed says it may be (5.6);
//   - what the command line printed is said in her words, and, whenever the app opened, a last line names the app's buttons that
//     Studio cannot control (BUTTONS; 3.3 and 5.9). The record gets the project and the time it was opened (7.1). A record
//     that could not be written ends the run with 1, and the project it was for stays on this Mac.
// A project that was made is kept whether or not the app opened: nothing here takes one away.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command. What it touches beyond the episode's own
// files is given to it (`deps`), so that no test runs the command line, the app or `claude`; each but `save` has a default, and the
// defaults fail closed.
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { chainUp, claudeAbove, processTable, readProcesses } from "./chain.js";
import { runningCommand } from "./detached.js";
import { kindOf, localStamp } from "./episode.js";
import { sessionNotCleared } from "./gate.js";
import { chatHeld } from "./held.js";
import { PIN, childEnv, cliPath, handoverAllowed, readOpen, toolchainDir } from "./hyperframes.js";
import { transcriptOf } from "./loosened.js";
import { projectFiles, projectName, writeProject } from "./project.js";
import { REELS_FILE } from "./reels.js";
import { appHandoverOn, episodeWork } from "./settings.js";
import { studioFolder } from "./studio.js";
import { requestWorkCopy, workCopyKey, workCopyPaths } from "./workcopy.js";

/** What is said of a Mac that is not set up for the app (settings.js appOf). edit.js says it before it goes any further, so
    openInApp is only ever given a Mac that is set up, and does not say it. */
export const NOT_SET_UP = "This Mac isn't set up for HyperFrames yet: ask Jason.";

/** How long the command line may take to hand the project to the app, in milliseconds: it returns once the app has been asked. */
const OPEN_MS = 60 * 1000;
/** The state of a project that was made for a kind the episode is no longer (4.8): it is kept, and no longer the main project.
    edit.js `kind` writes it, in the record that changes the kind. */
export const KEPT = "kept for an earlier kind";

const noWords = (name) => `The words of ${name} are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason.`;
const beingMade = (name) => `The video for HyperFrames is being made. Say "open ${name} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
const stillReading = (name) => `Claude is still reading it. Say "open ${name} in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.`;
const notWhole = (name) => `The HyperFrames project for ${name} is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason.`;
const recordingChanged = (name) => `The recording of ${name} has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.`;
/** Why her chat stayed where it is when the setting asked for it to go (handoverAllowed's `why`), in her words. */
const STAYS = {
  held: "This chat has held a client or group session's words, so it stays here.",
  "no chat": "This chat could not be found, so it stays here."
};
const STAYS_OTHERWISE = "This video's chat stays here.";
/** The last line, whenever the app opened (architecture 3.3 and 5.9): the app's own buttons, which Studio cannot turn off, and what
    is allowed with them: Share for invited people only, exports on This Mac and never in the cloud, and no HeyGen avatars or voices
    without Jason's yes. It holds no path, no flag and no name of a command. */
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";

/** Whether a project of the record is the one in use for the main video: its key is "main", and it was not kept for an earlier kind.
    edit.js `kind` asks it too, of a record that changes kind. */
export const isMain = (project) => project.key === "main" && project.state !== KEPT;

/** Whether a name is one folder's name and leads nowhere else. A project's name comes from the record, which Dropbox and the other
    Mac write, and is joined to a folder here (and by app-history.js, which looks at the project). */
export const plainName = (name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[/\0]/.test(name);

/** The Mac a main project in use was made on, when that is not this Mac and the project's folder is not on this Mac either; null
    otherwise. A project's folder is in the Mac's own work folder, never in Dropbox, so the project of another Mac is not here, and
    everything done in it (the app's history, what is in its folder) is there. Making a new project under its name would drop its
    entry from the record and leave that Mac's work unreachable, so `app` refuses such an episode (edit.js), until a take-over can
    rebuild the project from the snapshot (plan PR 11). The project of this Mac is not asked about: when its folder is gone it is made
    again, under its own name (openInApp). A project whose folder is here is opened, whichever Mac made it. A name that leads
    nowhere a folder is, is a folder that is not here. `ctx` is { home, machine }, `found` { name }, and `record` the episode's. */
export function projectOnAnotherMac(ctx, { found, record }) {
  const earlier = (record.app?.projects ?? []).find(isMain);
  if (!earlier || typeof earlier.on !== "string" || earlier.on === "" || earlier.on === ctx.machine) return null;
  return plainName(earlier.name) && existsSync(join(episodeWork(ctx.home, found.name), earlier.name)) ? null : earlier.on;
}

/** What a JSON file holds, or undefined when there is no such file. A file that is there and is not JSON throws. */
function jsonIn(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return undefined;
    throw e;
  }
}

/** The episode's words, [{ w, start, end }], from its .words.json: the import writes { video, duration, words }, and a bare list is
    taken too. null when the file is not there, cannot be read, or holds no list: then the words are not on this Mac yet. */
function wordsIn(path) {
  try {
    const held = JSON.parse(readFileSync(path, "utf8"));
    const words = Array.isArray(held) ? held : held?.words;
    return Array.isArray(words) ? words : null;
  } catch {
    return null;
  }
}

/** The logos in the Assets folder of BRIMM Video, `Assets/Logos` (5.2): the .svg and .png files in it, as paths, sorted. None when
    the folder is not there. */
function logosIn(root) {
  const dir = join(root, "Assets", "Logos");
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.(?:svg|png)$/i.test(entry.name)).map((entry) => join(dir, entry.name)).sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

/** The guidance the pinned package ships, the CLAUDE.md its projects start from (5.4, item 3). */
const guidanceOf = (home) => join(toolchainDir(home), "node_modules", "hyperframes", "dist", "templates", "_shared", "CLAUDE.md");

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
function factsIn(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** A file's facts as stat gives them, or undefined when there is no such file or it cannot be looked at. */
function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

/** What the record keeps of a working copy, { bytes, seconds, fps }, from facts that hold them, or null when they do not hold what
    the record needs (episode.js isAppProject): a size in bytes, a length in seconds above 0, and a frame rate. */
function copyOf(facts) {
  const { bytes, seconds, fps } = facts ?? {};
  const rate = (typeof fps === "number" && Number.isFinite(fps) && fps > 0) || (typeof fps === "string" && /^[1-9]\d*\/[1-9]\d*$/.test(fps));
  return Number.isInteger(bytes) && bytes >= 0 && typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && rate ? { bytes, seconds, fps } : null;
}

/** What the record keeps of the working copy a project holds, from the project's own brimm/facts.json (project.js), which has the
    length and the rate but not the size, and from the size of the video in the project. null when either cannot be had. */
function copyIn(dir) {
  const video = statOf(join(dir, "media", "recording.mp4"));
  return video?.isFile() ? copyOf({ ...factsIn(join(dir, "brimm", "facts.json")), bytes: video.size }) : null;
}

/** What a project was made from, as the record keeps it (7.1): the raw file's name, size and time, as stat gives them. */
const fromOf = (record, raw) => ({ file: record.video.file, bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) });

/** Whether the recording is not the one a project was made from (4.8): its size or its time is not what the project's `from` says.
    The times are compared as moments, to the second the record keeps, and not as the text the record holds: that is written with
    the offset the Mac's zone had on the day, so the same moment is other text once the clocks change. A recording that cannot be
    looked at is no change that can be told, since a project is opened without it. */
function changedSince(project, { found, record }) {
  const raw = statOf(join(found.folder, record.video.file));
  return raw !== undefined && (project.from.bytes !== raw.size || Date.parse(project.from.modified) !== Math.floor(raw.mtimeMs / 1000) * 1000);
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
  const raw = statSync(join(found.folder, record.video.file));
  const copy = workCopyPaths(home, found.name, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  const workingCopy = copyOf(factsIn(copy.facts)) ?? copyIn(dir);
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
    - While Claude's reading of the episode is at work (`read` holds the episode's lock), nothing is made: the project is written
      from the reading, and nothing writes it again later. She is told to say it again when it has finished (0). The working copy
      is still asked for when it is not there, as above, and the one line she gets is the reading's: it is the one she waits for
      (the copy is made meanwhile), and what she says again is the same.
    The project is written whole or not at all (project.js writeProject), and a folder of that name that is there already is never
    written over: it throws. Its name is the first that no project the record keeps has (nextMain), so after a correction of the
    kind it is "main 2", and a folder the record does not know at that name is taken before this (adoptProject): what is left to
    throw is a folder that appeared between the two. */
function makeProject(ctx, { found, record, at, projects }, { cli, guidance }) {
  const { home } = ctx;
  const stem = basename(record.video.file, extname(record.video.file));
  const words = wordsIn(join(found.folder, `${stem}.words.json`));
  if (!words) {
    ctx.say(noWords(record.name.text));
    return { code: 1 };
  }
  const raw = statSync(join(found.folder, record.video.file));
  const copy = workCopyPaths(home, found.name, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  const reading = runningCommand(home, found.name, ctx.alive) === "read";
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    requestWorkCopy(ctx, { folder: found.name });
    ctx.say(reading ? stillReading(record.name.text) : beingMade(record.name.text));
    return { code: 0 };
  }
  if (reading) {
    ctx.say(stillReading(record.name.text));
    return { code: 0 };
  }
  const facts = JSON.parse(readFileSync(copy.facts, "utf8"));
  const { name, number } = nextMain(record, projects);
  const reels = jsonIn(join(found.folder, REELS_FILE));
  writeProject(join(episodeWork(home, found.name), name), projectFiles({
    kind: "main", number, id: record.id, name: record.name.text, spellings: record.spellings, logos: logosIn(ctx.settings.root), facts, words,
    plan: jsonIn(join(found.folder, `${stem}.cut-plan.json`)), reels: reels?.candidates, video: copy.video, cli, guidance: readFileSync(guidance, "utf8"), createdAt: at
  }));
  return { project: madeEntry(ctx, { name, at, from: fromOf(record, raw), workingCopy: { bytes: facts.bytes, seconds: facts.seconds, fps: facts.fps } }) };
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
    replaced and no new project made: a new project for the new recording is a later step. A main project in the record whose
    folder is not here is replaced, when this Mac made it: by the folder at the name the project would get, when one is there
    that the record does not know (adoptProject), and otherwise by a new project (makeProject). One that another Mac made is not
    replaced: its work is on that Mac, and a new project under its name would drop its entry, so edit.js refuses it before the
    claim (projectOnAnotherMac). A new project is not made while Claude's reading of the episode is at work (`read` holds its
    lock): she is told to say it again when it has finished, and it ends with 0. Only a new project waits: one made before is
    opened, and a folder the record does not know is taken, whether or not the reading is at work. A project kept for an earlier
    kind (KEPT) is none in use: the next is made as any first one is, under the first name no project the record keeps has
    (nextMain), "main 2" after the first, and the kept one keeps its folder, its name and its entry in the record.
    What it says when the app opened is the command line's own words in hers, one line more about her chat when a handover was
    wanted and not made, and last the line about the buttons Studio cannot control (BUTTONS); when the app did not open it says
    the reason alone.
    The record that is saved holds the project in `app.projects`, with a time in `opened` only if the app opened, and `handover`
    true if the command line says it took her chat, whatever was asked of it.
    `deps` is all that is touched beyond the episode's own files, and each one but `save` has a default:
    - `save(next)` writes the episode's next record and resolves 0 when it has, and anything else when it could not, having said
      itself why: then the run ends with 1. It is called once, after the app has been asked, so a project that was made and not
      opened is recorded too. It is checked first, so that nothing is made without it;
    - `cli` and `node`: the pinned command line's program (hyperframes.js cliPath), and the program that runs it (this one);
    - `guidance`: the path of the CLAUDE.md the pinned package ships, in the toolchain's folder;
    - `spawn` (spawnSync) runs the command line, and `env` (this process's) is where the chat's id and the LANG come from;
    - `chat()` gives { sessionId, held } for the chat that asked (chatOf). It is asked only when this Mac's setting wants the
      handover, since that is all it decides. */
export async function openInApp(ctx, { found, record }, deps = {}) {
  const { save, spawn = spawnSync, env = process.env, node = process.execPath } = deps;
  if (typeof save !== "function") throw new Error("openInApp: no save was given, so the record could not be written");
  const { home } = ctx;
  const cli = deps.cli ?? cliPath(home);
  const at = localStamp(new Date(ctx.now()));
  const work = episodeWork(home, found.name);
  const projects = record.app?.projects ?? [];
  const earlier = projects.find(isMain);

  let project = earlier && plainName(earlier.name) && existsSync(join(work, earlier.name)) ? earlier : null;
  if (project) {
    // The project is opened as it was whatever the recording is now: a project that may be open in the app is never changed (4.8).
    if (changedSince(project, { found, record })) ctx.say(recordingChanged(record.name.text));
  } else {
    const taken = adoptProject(ctx, { found, record, at, projects }) ?? makeProject(ctx, { found, record, at, projects }, { cli, guidance: deps.guidance ?? guidanceOf(home) });
    if (taken.code !== undefined) return taken.code;
    ({ project } = taken);
  }

  // A handover is looked into only where it is wanted: it is all the chat decides, and finding out can take a while.
  const wanted = appHandoverOn(ctx.settings);
  const askChat = deps.chat ?? (() => chatOf(home, env));
  const chat = wanted ? askChat() : { sessionId: "", held: true };
  const handover = handoverAllowed({
    setting: wanted, sessionId: chat.sessionId, held: chat.held,
    episode: { session: sessionNotCleared(record), unanswered: kindOf(record) === null }, project: { clip: false }
  });
  const ran = spawn(node, [cli, "open", join(work, project.name), "--json"], {
    env: childEnv({ base: { HOME: home, LANG: env.LANG }, node, handover: handover.allowed, sessionId: chat.sessionId }),
    encoding: "utf8", timeout: OPEN_MS
  });
  const read = readOpen(ran.stdout, ran.status, { handoverWanted: wanted });
  ctx.say(read.words);
  if (wanted && read.opened && !read.handedOver) ctx.say(Object.hasOwn(STAYS, handover.why) ? STAYS[handover.why] : STAYS_OTHERWISE);
  // The buttons Studio cannot control are named whenever the app opened, after the opening and whatever is said of her chat. The app
  // is open whether or not the record can be written below, so the reminder does not wait for it.
  if (read.opened) ctx.say(BUTTONS);

  // A time is added only if the app opened; a chat once handed over stays recorded as handed over; a later state is not moved back.
  const updated = {
    ...project,
    opened: read.opened ? [...project.opened, at] : project.opened,
    handover: project.handover || read.handedOver,
    state: read.opened && project.state === "made" ? "opened" : project.state
  };
  // The app has been asked by now, so a record that could not be written ends the run with 1, whether or not the app opened: what the
  // project is stays on this Mac, and the next run finds it again (adoptProject).
  const written = await save({ ...record, app: { ...record.app, toolchain: PIN.version, projects: [...projects.filter((p) => !isMain(p)), updated] } });
  if (written !== 0) return 1;
  return read.opened ? 0 : 1;
}
