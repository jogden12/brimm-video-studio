// Opening an episode in the HyperFrames app (architecture 2026-10-27: sections 4.1, 4.8, 5.1, 5.2, 5.6, 5.7 and 7.1).
//
// edit.js finds the episode, asks the gate and claims it for this Mac, and then gives it to openInApp, which does the rest:
//   - a project made before is opened again, and nothing is made or started (4.8). If the recording has changed since the project
//     was made she is told, and the project is opened as it was: a project that may be open in the app is never changed (4.8);
//   - a folder at the project's name that the record does not know, as a run whose record was not written leaves, is taken as the
//     project it is and recorded: nothing is made or started for it either;
//   - otherwise the episode's words must be on this Mac, and so must the working copy of its video (5.7). The copy is a detached
//     job (workcopy.js) that can take minutes, so when it is not there it is asked for, and she is told to say it again when it
//     is made;
//   - the project is written from them (project.js), whole or not at all, with the working copy moved into it (5.1, 5.2);
//   - the app is opened on the project by the pinned command line (hyperframes.js), by absolute path and in a short list of
//     variables of its own, with her chat handed to the app only when handoverAllowed says it may be (5.6);
//   - what the command line printed is said in her words, and the record gets the project and the time it was opened (7.1). A record
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
import { kindOf, localStamp } from "./episode.js";
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
/** The state of a project that was made for a kind the episode is no longer (4.8): it is kept, and no longer the main project. */
const KEPT = "kept for an earlier kind";

const noWords = (name) => `The words of ${name} are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason.`;
const beingMade = (name) => `The video for HyperFrames is being made. Say "open ${name} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
const notWhole = (name) => `The HyperFrames project for ${name} is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason.`;
const recordingChanged = (name) => `The recording of ${name} has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.`;
/** Why her chat stayed where it is when the setting asked for it to go (handoverAllowed's `why`), in her words. */
const STAYS = {
  held: "This chat has held a client or group session's words, so it stays here.",
  "no chat": "This chat could not be found, so it stays here."
};
const STAYS_OTHERWISE = "This video's chat stays here.";

/** Whether a project of the record is the one in use for the main video: its key is "main", and it was not kept for an earlier kind. */
const isMain = (project) => project.key === "main" && project.state !== KEPT;

/** Whether a name is one folder's name and leads nowhere else. A project's name comes from the record, which Dropbox and the other
    Mac write, and is joined to a folder here. */
const plainName = (name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[/\0]/.test(name);

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
    chat: the handover is never guessed at. */
function chatOf(home, env) {
  const sessionId = typeof env.CLAUDE_CODE_SESSION_ID === "string" ? env.CLAUDE_CODE_SESSION_ID : "";
  try {
    const transcriptPath = transcriptOf({ home, env, folder: realpathSync.native(studioFolder(home)), sessionId });
    if (transcriptPath === null || !readable(transcriptPath)) return { sessionId, held: true };
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

/** A folder at the name the main project would get that the record does not know, taken as the project it is: a run that made the
    project and could not write the record leaves one, and the next run finds it here instead of making it again. Gives { project },
    the record's entry for it as makeProject does (state "made", never opened, made now, from the raw video as it is), or { code } 1
    when part of it cannot be read (then a line says so, and nothing is opened), or null when there is no such folder. Nothing is
    asked for and nothing is written, so the words of the recording are not needed. The working copy it was made from is
    described by the facts beside that copy (workcopy.js) when they are still there, which they are unless something took them
    away, and otherwise by the project's own brimm/facts.json (project.js), with the size of the video in the project.
    A folder the record lists is its own, whatever it is kept for: a project kept for an earlier kind has the name a new main
    project would get (4.8), and is never taken for the main one. */
function adoptProject(ctx, { found, record, at, projects }) {
  const { home } = ctx;
  const name = projectName({ name: record.name.text, part: "main", id: record.id });
  const dir = join(episodeWork(home, found.name), name);
  if (projects.some((p) => p.name === name) || !existsSync(dir)) return null;
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
    The project is written whole or not at all (project.js writeProject), and a folder of that name that is there already is never
    written over: it throws. A folder the record does not know is taken before this (adoptProject), so what is left to throw is the
    name of a project the record keeps for an earlier kind. */
function makeProject(ctx, { found, record, at }, { cli, guidance }) {
  const { home } = ctx;
  const stem = basename(record.video.file, extname(record.video.file));
  const words = wordsIn(join(found.folder, `${stem}.words.json`));
  if (!words) {
    ctx.say(noWords(record.name.text));
    return { code: 1 };
  }
  const raw = statSync(join(found.folder, record.video.file));
  const copy = workCopyPaths(home, found.name, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    requestWorkCopy(ctx, { folder: found.name });
    ctx.say(beingMade(record.name.text));
    return { code: 0 };
  }
  const facts = JSON.parse(readFileSync(copy.facts, "utf8"));
  const name = projectName({ name: record.name.text, part: "main", id: record.id });
  const reels = jsonIn(join(found.folder, REELS_FILE));
  writeProject(join(episodeWork(home, found.name), name), projectFiles({
    kind: "main", id: record.id, name: record.name.text, spellings: record.spellings, logos: logosIn(ctx.settings.root), facts, words,
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
    folder is not here is replaced by the folder at the name the project would get, when one is there that the record does not
    know (adoptProject), and otherwise by a new project (makeProject).
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
    const taken = adoptProject(ctx, { found, record, at, projects }) ?? makeProject(ctx, { found, record, at }, { cli, guidance: deps.guidance ?? guidanceOf(home) });
    if (taken.code !== undefined) return taken.code;
    ({ project } = taken);
  }

  // A handover is looked into only where it is wanted: it is all the chat decides, and finding out can take a while.
  const wanted = appHandoverOn(ctx.settings);
  const askChat = deps.chat ?? (() => chatOf(home, env));
  const chat = wanted ? askChat() : { sessionId: "", held: true };
  const handover = handoverAllowed({
    setting: wanted, sessionId: chat.sessionId, held: chat.held,
    episode: { session: record.kind === "session" || Boolean(record.session), unanswered: kindOf(record) === null }, project: { clip: false }
  });
  const ran = spawn(node, [cli, "open", join(work, project.name), "--json"], {
    env: childEnv({ base: { HOME: home, LANG: env.LANG }, node, handover: handover.allowed, sessionId: chat.sessionId }),
    encoding: "utf8", timeout: OPEN_MS
  });
  const read = readOpen(ran.stdout, ran.status, { handoverWanted: wanted });
  ctx.say(read.words);
  if (wanted && read.opened && !read.handedOver) ctx.say(Object.hasOwn(STAYS, handover.why) ? STAYS[handover.why] : STAYS_OTHERWISE);

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
