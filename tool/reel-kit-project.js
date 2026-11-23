// A Reel Kit project in an episode (spec 2026-11-23 Reel Kit in Studio; plan Task 9, Decisions 2, 3, 9 and 11).
//
// A Reel Kit edit is of one part of an episode, its main video or one of its Reels, in one of Reel Kit's three modes, which she picks
// and Studio never guesses. Its project is a folder of the episode's own in BRIMM Video Work, beside its HyperFrames projects, named as
// they are (project.js projectName) with ` Reel Kit v<n>` after it: never in Dropbox, never in a drop folder. Reel Kit wants every
// project at REEL_KIT_HOME/projects/<slug>, so that is a symbolic link to the folder (Decision 2), and Reel Kit's new.py makes its
// folders through it. Its source is a copy of 4K of the part, made by the working copy's own code (workcopy.js makeWorkCopy) and
// linked into the project as source/clip.mp4 (Decision 3): a Reel's is cut to its own times, so Reel Kit's KEEP works inside them.
//
// What is here:
//   - MODES, modeOf: Reel Kit's three modes, and the words she may say for each;
//   - startWhy: why an edit of a part may not start, in her words, or "": a video not answered, a session (any, Decision 9), a part of a
//     planned video, no mode, the main video of a wide recording, a part with a HyperFrames project, a part whose edit is queued or at
//     work. A part with an earlier edit gets the next version in a folder of its own (Decision 11);
//   - modeLeans: which mode the kind of video leans to, said and never chosen;
//   - entryOf: the record's entry for an edit, in the shape of a HyperFrames project's (app.js, app-reel.js), with `maker: "reel-kit"`.
//     Reel Kit's own progress is in the project's studio.json, never in the record;
//   - projectFolderOf, slugOf, linkProject, versionFor: the project's places and names;
//   - stateFile, readState, writeState: studio.json, Studio's own, written whole and read the safe way;
//   - scaffold: the project made, as a step of the queued job.
//
// What she reads holds no path, no flag and no name of a command.
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { KEPT, copyOf, fromOf, plainName } from "./app.js";
import { isPart, isPlannedRecord, kindOf, localStamp, shownName } from "./episode.js";
import { mayGoIn } from "./footage.js";
import { HELD, NOT_FOR_SESSION, gateFor, gated } from "./gate.js";
import { projectName } from "./project.js";
import { kitDir, reelKitEnv, reelKitHome, venvPython } from "./reel-kit.js";
import { runCaptured } from "./reel-kit-install.js";
import { syncPack } from "./reel-kit-style.js";
import { episodeWork } from "./settings.js";
import { findPrograms } from "./unedited.js";
import { recordingAt, recordingStat } from "./where.js";
import { makeWorkCopy } from "./workcopy.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// --- The mode ---

/** Reel Kit's three modes, as its new.py takes them. */
export const MODES = Object.freeze(["hifi", "lofi", "showcase"]);
/** The words she may say for each mode: Reel Kit's own synonyms. */
const MODE_WORDS = Object.freeze({
  hifi: ["hifi", "hi-fi", "high", "produced"],
  lofi: ["lofi", "lo-fi", "low", "selfie"],
  showcase: ["showcase", "show-off", "show off", "flex"]
});

/** The mode a word she said names, in any case and with any spaces around it: "hifi", "lofi" or "showcase", or null for any other. */
export function modeOf(word) {
  if (typeof word !== "string") return null;
  const said = word.trim().toLowerCase().replace(/\s+/g, " ");
  return MODES.find((mode) => MODE_WORDS[mode].includes(said)) ?? null;
}

/** What is asked when no mode was given: Reel Kit's rule is that the creator picks it, never a guess. */
export const MODE_ASK = "Hi-fi, lo-fi or showcase?";
/** Reel Kit makes an upright video: a wide recording's main video is not one. */
export const WIDE_MAIN = "Reel Kit makes upright videos only: choose a Reel of it.";

/** Whether the import saw the recording upright (answer.seen, kinds.js seenLine): true for "upright", false for "wide", and null when the
    record does not say. */
function seenUpright(record) {
  const seen = isObject(record.answer) && typeof record.answer.seen === "string" ? record.answer.seen : "";
  return seen.startsWith("upright") ? true : seen.startsWith("wide") ? false : null;
}

/** Which mode the kind of video leans to, said to her and never chosen for her: "lofi" for a clip from a phone (a short video the import
    saw upright, or one that came from an iPhone), "hifi" for a raw sit-down take, and "" for any other. */
export function modeLeans(record) {
  if (!isObject(record)) return "";
  const kind = kindOf(record);
  const phone = isObject(record.answer) && record.answer.came === "phone";
  if (kind === "short video" && (phone || seenUpright(record) === true)) return "lofi";
  return kind === "raw" ? "hifi" : "";
}

// --- The part ---

/** The part a record's key names, as project.js projectName takes it: "main", or { reel: n } for "reel <n>"; null for any other. */
function partOf(key) {
  if (key === "main") return "main";
  const reel = /^reel ([1-9]\d*)$/.exec(String(key));
  return reel ? { reel: Number(reel[1]) } : null;
}
/** A part as a sentence starts with it. */
const saidOf = (part) => (part === "main" ? "The main video" : `Reel ${part.reel}`);
const noSuchReel = (n, numbers) => `There is no Reel ${n}. The Reels are ${numbers.join(", ") || "none"}.`;
/** The Reel the record lists by its number, or undefined. */
const reelOf = (record, n) => (Array.isArray(record.reels) ? record.reels : []).find((r) => isObject(r) && r.n === n);

/** Who made a project in the record's list: Reel Kit's say so. */
export const MAKER = "reel-kit";
const isReelKit = (p) => isObject(p) && p.maker === MAKER;
const projectsOf = (record) => (isObject(record.app) && Array.isArray(record.app.projects) ? record.app.projects : []);

/** The record's entry for a Reel Kit edit, in the shape of a HyperFrames project's (app.js and app-reel.js madeEntry), so that exports.js
    and `finish` take it as they take theirs: never opened, not handed over, state "made", and `maker` "reel-kit" with its mode and
    version. `from` (what the recording was, app.js fromOf) and `workingCopy` (what the copy of 4K is, app.js copyOf) go in after it when
    given, as the record's check of a project needs them (episode.js isAppProject). */
export function entryOf({ key, name, mode, version, at, machine, fromSuggestion = null, from, workingCopy }) {
  return {
    key, name, maker: MAKER, mode, version, madeAt: at, on: machine, opened: [], handover: false, state: "made", fromSuggestion,
    ...(from ? { from } : {}), ...(workingCopy ? { workingCopy } : {})
  };
}

/** The version the next Reel Kit edit of the part `key` is: one after the newest the record lists, and after any of `onDisk` (the
    versions whose folders are on this Mac, as a run that was stopped before the record was written leaves one). 1 for the first. */
export function versionFor(record, key, onDisk = []) {
  const listed = projectsOf(record).filter((p) => isReelKit(p) && p.key === key).map((p) => p.version);
  const all = [...listed, ...onDisk].filter((v) => Number.isInteger(v) && v >= 1);
  return all.length ? Math.max(...all) + 1 : 1;
}

// --- Places and names ---

/** The folder of a project of the episode in `folder` on this Mac: `name` in the episode's own folder in BRIMM Video Work. Throws for a
    folder or a name that is not one folder's name, so that no path leaves it. */
export function projectFolderOf(home, folder, name) {
  if (!plainName(folder)) throw new Error(`An episode's folder is one folder's name, and ${JSON.stringify(folder)} is not one.`);
  if (!plainName(name)) throw new Error(`A project's folder is one folder's name, and ${JSON.stringify(name)} is not one.`);
  return join(episodeWork(home, folder), name);
}

/** What a slug looks like: the episode id's last six, the part, the version. */
const SLUG = /^[0-9a-z]{6}-(?:main|reel-[1-9]\d*)-v[1-9]\d*$/;

/** The slug of a Reel Kit edit, its name in REEL_KIT_HOME/projects (Decision 2): `<episode id's last 6>-<main|reel-n>-v<n>`, as
    "3fa9c1-reel-2-v1". Throws for a key, an id or a version that cannot make one. */
export function slugOf(record, key, version) {
  const part = partOf(key);
  if (!part) throw new Error(`slugOf: ${JSON.stringify(key)} is not "main" or "reel <n>"`);
  if (!Number.isInteger(version) || version < 1) throw new Error(`slugOf: ${JSON.stringify(version)} is not a version from 1`);
  const slug = `${String(record?.id ?? "").slice(-6)}-${part === "main" ? "main" : `reel-${part.reel}`}-v${version}`;
  if (!SLUG.test(slug)) throw new Error(`slugOf: the episode's id ${JSON.stringify(record?.id)} makes no slug`);
  return slug;
}

/** What she reads when Reel Kit's place for an edit holds something Studio did not put there. */
const PLACE_TAKEN = "Reel Kit's place for this edit on this Mac holds something else, so nothing was changed: ask Jason.";

/** Make REEL_KIT_HOME/projects/<slug> a symbolic link to the project folder `dir` (Decision 2): "" when it is made, or is that link
    already; the one line she reads when anything else is there (a folder, a file, a link to elsewhere), which is left as it is, or when
    `projects` itself is not a folder of its own. Throws for a slug slugOf could not make, or a `dir` that is not a whole path. */
export function linkProject(home, slug, dir) {
  if (typeof slug !== "string" || !SLUG.test(slug)) throw new Error(`linkProject: ${JSON.stringify(slug)} is not a slug`);
  if (typeof dir !== "string" || !isAbsolute(dir)) throw new Error("linkProject: the project's folder must be a whole path");
  const projects = join(reelKitHome(home), "projects");
  mkdirSync(projects, { recursive: true });
  const kind = lstatSync(projects);
  if (kind.isSymbolicLink() || !kind.isDirectory()) return PLACE_TAKEN;
  const at = join(projects, slug);
  let there;
  try {
    there = lstatSync(at);
  } catch (e) {
    if (e.code !== "ENOENT") return PLACE_TAKEN;
    symlinkSync(dir, at);
    return "";
  }
  return there.isSymbolicLink() && readlinkSync(at) === dir ? "" : PLACE_TAKEN;
}

// --- studio.json ---

/** The project's status file, Studio's own (Decision 5): what the edit is, and how far it has got. */
export const stateFile = (dir) => join(dir, "studio.json");
/** The most of studio.json read: it is a few lines, and anything larger is not Studio's. */
const STATE_MOST = 1 << 20;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** The text of a plain file at `path` of at most `most` bytes, read the safe way: no link followed, no pipe waited on, looked at once it
    is open. null for anything else, or a file that cannot be read whole now. */
function readCapped(path, most) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size > most) return null;
    const buffer = Buffer.alloc(opened.size);
    let got = 0;
    while (got < buffer.length) {
      const read = readSync(fd, buffer, got, buffer.length - got, got);
      if (read === 0) break;
      got += read;
    }
    return got === buffer.length ? buffer.toString("utf8") : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** What the project in `dir` says of itself (its studio.json), or null when there is none, or what is there is not a plain file of its
    size holding an object. */
export function readState(dir) {
  const text = readCapped(stateFile(dir), STATE_MOST);
  if (text === null) return null;
  try {
    const state = JSON.parse(text);
    return isObject(state) ? state : null;
  } catch {
    return null;
  }
}

/** Write the project's studio.json whole: into a file of its own beside it, then renamed over it, so that it is never read half
    written. Throws when it cannot be written, and leaves no file of its own behind. */
export function writeState(dir, state) {
  if (!isObject(state)) throw new Error("writeState: the state is an object");
  const temporary = join(dir, `.studio.json.${process.pid}.${Date.now()}`);
  try {
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
    renameSync(temporary, stateFile(dir));
  } catch (e) {
    rmSync(temporary, { force: true });
    throw e;
  }
}

// --- Whether an edit may start ---

/** The gate's words for a record it holds: a command named in none of its lists is refused for every record it gates (gate.js gateFor). */
const GATE_COMMAND = "reelkit start";
const PART_FOOTAGE = "This is footage for a planned video: Reel Kit edits the video it goes into, not its footage.";
const CLIENT_WAITS = "This footage shows a client, and waits for their agreement: it goes into no edit until then.";
const busy = (part) => `${saidOf(part)} has a Reel Kit edit waiting or being made already.`;
const inHyperFrames = (part) => `${saidOf(part)} has a HyperFrames project already, so it is edited there.`;

/** Whether the project of a Reel Kit entry is queued or at work, by its studio.json: "queued", or "working" by a worker that is alive
    (`alive`, given a pid; without it a worker counts as alive). Task 10's statusOf reads the same file. An entry whose folder cannot be
    named (no episode folder given, or a name that is not one folder's) counts as at work, as a gate errs toward refusing. */
function atWork(home, folder, entry, alive) {
  let dir;
  try {
    dir = projectFolderOf(home, folder, entry.name);
  } catch {
    return true;
  }
  const state = readState(dir);
  if (!state) return false;
  if (state.state === "queued") return true;
  if (state.state !== "working") return false;
  return !(typeof alive === "function" && Number.isInteger(state.pid) && !alive(state.pid));
}

/** Why a Reel Kit edit of the part `key` ("main" or "reel <n>") of the episode with `record` may not start, in her words, or "" when it
    may. In this order:
    - a part of a planned video (footage.js): one that shows a client, until her plan (`planned`) holds their agreement (mayGoIn), and any
      part, since Reel Kit edits the video it goes into;
    - a video held as a session (`held`: one of its other versions is a session not cleared), in the gate's words (HELD);
    - any record the gate holds (gate.js gated: not answered, left alone, a session not cleared) and a planned video, in the gate's words;
    - any session, cleared or not (Decision 9): session clips are not built yet;
    - a Reel the record does not list;
    - no mode, or one that is not Reel Kit's (MODE_ASK): she picks it;
    - the main video of a recording the import did not see upright (WIDE_MAIN): Reel Kit makes upright videos only, and a Reel of a wide
      one is cropped upright;
    - a part with a HyperFrames project in use (not KEPT for an earlier kind);
    - a part with a Reel Kit edit queued or at work (its studio.json, in the episode's folder `folder` under `home`; `alive` says whether
      a worker's pid runs). An earlier edit that waits for her or is done is no refusal: the next is a new version (versionFor). */
export function startWhy({ record, key, mode, home, folder, held = false, planned = null, alive = null }) {
  if (!isObject(record)) return "That video can't be read: ask Jason.";
  if (isPart(record)) return mayGoIn({ record }, planned) ? PART_FOOTAGE : CLIENT_WAITS;
  if (held) return HELD;
  if (gated(record) || isPlannedRecord(record)) return gateFor(GATE_COMMAND, record) || NOT_FOR_SESSION;
  if (kindOf(record) === "session") return NOT_FOR_SESSION;
  const part = partOf(key);
  if (!part) throw new Error(`startWhy: ${JSON.stringify(key)} is not "main" or "reel <n>"`);
  if (part !== "main" && !reelOf(record, part.reel)) return noSuchReel(part.reel, (Array.isArray(record.reels) ? record.reels : []).map((r) => r.n));
  if (!MODES.includes(mode)) return MODE_ASK;
  if (part === "main" && seenUpright(record) !== true) return WIDE_MAIN;
  const projects = projectsOf(record).filter((p) => isObject(p) && p.key === key);
  if (projects.some((p) => !isReelKit(p) && p.state !== KEPT)) return inHyperFrames(part);
  if (projects.some((p) => isReelKit(p) && atWork(home, folder, p, alive))) return busy(part);
  return "";
}

// --- The project made ---

const NOT_SET_UP = "Reel Kit isn't set up on this Mac yet: ask Jason.";
const NEW_FAILED = "Reel Kit could not start this edit: ask Jason.";
const SOURCE_TAKEN = "The project's place for its video holds something else, so nothing was changed: ask Jason.";
const BAD_TITLE = "The Reel's title can't hold a double quote, a backslash or a new line for Reel Kit: say it again without them.";
const NO_TITLE = "The Reel needs a title for Reel Kit.";

/** Why a title cannot go to Reel Kit as it is, or "": Reel Kit's new.py writes it into edit.py between double quotes, word for word, so a
    title with a double quote, a backslash or a control character in it would make edit.py one it cannot read. */
function titleWhy(title) {
  if (typeof title !== "string" || title.trim() === "") return NO_TITLE;
  return /["\\\p{Cc}]/u.test(title) ? BAD_TITLE : "";
}

/** The versions of the part's edits whose folders are in the episode's work folder: `<base> Reel Kit v<n>`. */
function versionsOnDisk(work, base) {
  let names = [];
  try {
    names = readdirSync(work);
  } catch {
    return [];
  }
  const prefix = `${base} Reel Kit v`;
  return names.filter((n) => n.startsWith(prefix) && /^[1-9]\d*$/.test(n.slice(prefix.length))).map((n) => Number(n.slice(prefix.length)));
}

/** Make the source/clip.mp4 of the project in `dir` a symbolic link to `copy`, the copy of 4K: "" when it is made or is that link; a
    link of Studio's to another copy is made again; anything else there is left, and the line says so. Never a hard link. */
function linkSource(dir, copy) {
  mkdirSync(join(dir, "source"), { recursive: true });
  const at = join(dir, "source", "clip.mp4");
  let there;
  try {
    there = lstatSync(at);
  } catch (e) {
    if (e.code !== "ENOENT") return SOURCE_TAKEN;
  }
  if (there) {
    if (!there.isSymbolicLink()) return SOURCE_TAKEN;
    if (readlinkSync(at) === copy) return "";
    rmSync(at);
  }
  symlinkSync(copy, at);
  return "";
}

/** A JSON file of the copy's facts, read as makeWorkCopy wrote it, or null. */
function factsAt(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Make the Reel Kit project of the part `key` of the episode `found` ({ name, folder }) with `record`, in `mode`, titled `title`:
    { dir, slug, name, version, from, workingCopy }, what the record's entry needs (entryOf), or { why }, the one line she reads, when
    nothing more was made. It is a step of the queued job, run under the Mac-wide worker lock Task 10 makes, never the first half of a chat
    command: syncPack takes no lock of its own, and only one worker may copy her pack into REEL_KIT_HOME/style at a time. In this order:
    - the mode and the title are checked (titleWhy), and a Reel the record does not list is refused;
    - the version is `version` when the job was given one, else the next (versionFor, counting the folders on this Mac too), and the
      folder `<project.js projectName> Reel Kit v<n>` in the episode's work folder; an earlier version's folder is left as it is;
    - Reel Kit's kit and Python must be on this Mac;
    - her pack is copied in (reel-kit-style.js syncPack), so that new.py copies it into the project; a pack that can't be used stops it;
    - the copy of 4K is made (workcopy.js makeWorkCopy, `fourK`, and a Reel's own times from the record: Decision 3), in BRIMM Video Work,
      and linked as the project's source/clip.mp4;
    - REEL_KIT_HOME/projects/<slug> is made a link to the folder (linkProject);
    - Reel Kit's new.py is run (`PY <kit>/pipeline/new.py <slug> "<clip>" "<title>" --mode <mode>`, the title word for word) in Reel
      Kit's own environment (reel-kit.js reelKitEnv);
    - studio.json is written whole with what the edit is, keeping what the job wrote there before (its state).
    `deps`: `syncPack`, `makeWorkCopy` and `copy` (its deps: `tools` from findPrograms by default), `run` (runCaptured: a program and its
    arguments, with `{ env }`, to `{ code, out }`), `node` (Studio's, for reelKitEnv), `base` (HOME and LANG), `log`. */
export async function scaffold(ctx, { found, record, key, mode, title, version: given }, deps = {}) {
  const {
    syncPack: sync = syncPack, makeWorkCopy: makeCopy = makeWorkCopy, copy = {}, run = runCaptured, node = process.execPath,
    base = { HOME: ctx.home, LANG: process.env.LANG }, log = () => {}
  } = deps;
  const home = ctx.home;
  if (!MODES.includes(mode)) return { why: MODE_ASK };
  const titled = titleWhy(title);
  if (titled) return { why: titled };
  const part = partOf(key);
  if (!part) throw new Error(`scaffold: ${JSON.stringify(key)} is not "main" or "reel <n>"`);
  const reel = part === "main" ? null : reelOf(record, part.reel);
  if (part !== "main" && !reel) return { why: noSuchReel(part.reel, (record.reels ?? []).map((r) => r.n)) };

  const baseName = projectName({ name: record.name?.text ?? "", part, id: record.id });
  const version = Number.isInteger(given) && given >= 1 ? given : versionFor(record, key, versionsOnDisk(episodeWork(home, found.name), baseName));
  const name = `${baseName} Reel Kit v${version}`;
  const dir = projectFolderOf(home, found.name, name);
  const slug = slugOf(record, key, version);
  const newPy = join(kitDir(home), "pipeline", "new.py");
  const python = venvPython(home);
  try {
    if (!lstatSync(newPy).isFile() || !lstatSync(python).isFile()) return { why: NOT_SET_UP };
  } catch {
    return { why: NOT_SET_UP };
  }

  const packed = sync({ settings: ctx.settings, home, log, ...(ctx.build ? { build: ctx.build } : {}) });
  if (packed) return { why: packed };

  const video = recordingAt(ctx, { folder: found.folder, record });
  const rawStat = recordingStat(ctx, { folder: found.folder, record });
  const stretch = reel ? { n: reel.n, start: reel.from, end: reel.to } : null;
  const made = await makeCopy({
    home, folder: found.name, video, name: `${shownName(record)}${reel ? `, Reel ${reel.n}` : ""}, for Reel Kit`, fourK: true, reel: stretch,
    ...(rawStat ? { rawStat } : {})
  }, { log, ...copy, tools: copy.tools ?? findPrograms() });
  if (!made.ok) return { why: made.words };

  mkdirSync(dir, { recursive: true });
  const sourced = linkSource(dir, made.paths.video);
  if (sourced) return { why: sourced };
  const linked = linkProject(home, slug, dir);
  if (linked) return { why: linked };

  const clip = join(dir, "source", "clip.mp4");
  const env = reelKitEnv({ home, node, base });
  const ran = await run(python, [newPy, slug, clip, title, "--mode", mode], { env });
  if (ran.code !== 0) {
    log(`Reel Kit's new.py ended ${ran.code} for ${slug}: ${String(ran.out ?? "").trim().split("\n").at(-1) ?? ""}`);
    return { why: NEW_FAILED };
  }

  const raw = rawStat ?? { size: 0, mtimeMs: 0 };
  writeState(dir, { ...(readState(dir) ?? {}), slug, key, mode, version, title, name, madeAt: localStamp(new Date(ctx.now ? ctx.now() : Date.now())) });
  return { dir, slug, name, version, from: fromOf(record, raw), workingCopy: copyOf(factsAt(made.paths.facts)) };
}
