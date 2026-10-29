// Giving an episode's room back on this Mac (architecture 2026-10-27: sections 6.1 and 7.4, and risk 10; plan PR 15). A working copy is
// a second copy of the video, and the app and its agent write renders into a project all day, so an old episode takes room on the
// Mac's own disk. `free` takes the working copy and the renders away and nothing else: a project's text files, `brimm/`,
// `.hyperframes/` and every export stay, and so does the episode in Dropbox, so the video is made again when she opens the project
// (app.js puts it back).
//
// It deletes files, so it takes nothing it has not named, and names nothing it has not looked at:
//   - The paths are named: the episode's folder of copies (workcopy.js workCopyDir), and for each project of the record's
//     `app.projects` but a session clip's, its renders/; and the media/recording.mp4 of the main project in use alone, because that
//     is the one project `app` puts the video back into. A Reel's video, and a kept project's, cannot be made again yet (a Reel
//     made from times she gave may have them nowhere else), so they stay, and it says so. Nothing is found by listing a folder or by
//     a pattern, so a file that only looks like one of them stays. A session clip's project is not named at all (`clips … done` is
//     its way out), and neither is a folder the record does not list. The record comes from Dropbox, where the other Mac writes it,
//     so a project's name that is not one plain folder name (app.js plainName) is left out and never joined to a path, and a folder
//     is told from a session clip's by what it is on the volume, not by how the record spells its name: a volume that ignores case,
//     or the way an accent is written, has many names for one folder.
//   - Each path is looked at where it stands before the first goes. The work folder must be BRIMM Video Work in the real home, not a
//     link into Dropbox or anywhere else and not inside the BRIMM Video root; each path's parent must be the work folder's real path
//     with the same names after it, so that no folder on the way is a link; the path itself must be a file (the video) or a folder
//     (the others), not a link. A path that is not there is skipped. Anything else refuses the whole command. And it is looked at
//     again just before it goes, since the disk is not still while the others go: a video is removed without the option that goes
//     into a folder, so that a folder put in its place is not taken; and what is removed is the real path just looked at, so a link
//     in the way cannot lead the removal elsewhere.
//   - It refuses before it takes anything: while the other Mac has the episode, while HyperFrames is running or cannot be told (its
//     project may be open on the video), while a run is at work on the episode, when a project's renders holds a video and the
//     episode is not handed off yet (a render the agent made lands there, and may be the only copy: architecture 8.1 takes such a
//     file only with her yes), and when the video could not be made again (the recording is not in the episode, or has changed since
//     the project was made from it: that video would be gone for good).
// It writes no record, takes no claim and starts nothing: it is a Mac's own business, and `app` finds a project's video gone by
// looking for the file.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command. Everything it touches beyond the files
// it removes is given to it (`deps`), so no test runs a program: `running` and `rm` have defaults, and the default for a program it
// cannot ask after is that it cannot tell, which takes nothing.
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { changedSince, isMain, plainName } from "./app.js";
import { runningCommand } from "./detached.js";
import { heldText, shownName } from "./episode.js";
import { sizeText } from "./kinds.js";
import { episodeWork, workFolder } from "./settings.js";
import { workCopyDir, workCopyLockOf } from "./workcopy.js";

/** The program the app runs as, which pgrep finds by its exact name (CFBundleExecutable of HyperFrames.app). */
const APP_PROGRAM = "HyperFrames";

// --- What is said ---

const QUIT = "Quit HyperFrames first, then ask again. Nothing was taken away.";
const CANT_TELL = "I can't tell whether HyperFrames is open. Quit it if it is, then ask again. Nothing was taken away.";
const beingMade = (name) => `The video for HyperFrames is being made for ${name}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`;
const stillAtWork = (name) => `Something is still at work on ${name}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`;
const notAsMade = (name) => `The folder for ${name} on this Mac is not as it was made, so nothing was taken away. Ask Jason.`;
const renderKept = (name) => `HyperFrames made a video for ${name} that may be kept nowhere else, and the episode is not handed off yet. Nothing was taken away. Hand it off first, or keep that video somewhere else, then ask again.`;
const notThere = (name) => `The recording of ${name} is not in its folder, so the video made from it could not be made again. Nothing was taken away.`;
const changed = (name) => `The recording of ${name} has changed since its HyperFrames project was made, so the video made from it could not be made again as it was. Nothing was taken away.`;
const nothing = (name) => `There is nothing to take away for ${name} on this Mac.`;
const stuck = (bytes) => (bytes > 0 ? `Took away ${sizeText(bytes)}, but part of it could not be taken away. Ask Jason.` : "Part of it could not be taken away. Ask Jason.");
/** The last line, when the video of a Reel's project or of a kept project is left where it is: app puts back the main project's
    alone, so nothing can make those again yet. It changes when a Reel can be cut again (plan PR 5). */
const STAYS = "The video of a Reel, or of a project kept for an earlier kind, stays: it can't be made again yet.";

// --- What it names ---

/** The projects `free` takes from: the main video's, including one kept for an earlier kind, and a Reel's. A session clip's is not
    one (`clip N`), and nothing else is either: a key this code does not know takes nothing. */
const freeable = (project) => typeof project?.key === "string" && /^(?:main|reel [1-9]\d*)$/.test(project.key);
const isClip = (project) => typeof project?.key === "string" && /^clip [1-9]\d*$/.test(project.key);
/** A name as the volume may take it for another: composed, and in lower case. It is only for telling a name the record gives twice;
    what a folder is, is told by the volume itself (identityOf). */
const folded = (name) => name.normalize("NFC").toLowerCase();

/** The paths `free` names for the episode in `folder` on this Mac, from the record: { work, copies, projects, clips }, where `work`
    is the episode's own folder in BRIMM Video Work, `copies` its folder of copies, each of `projects` is { key, name, dir, video,
    stays, renders }: a project's folder, its renders, and its media/recording.mp4, which is `video` (to be taken) for the main
    project in use, the first `isMain` of the record as `app` opens it, and `stays` (to be left) for any other; and each of `clips`
    is { name, dir }, a session clip's folder, which `free` looks at but never names. Pure: nothing is looked at. A project is named
    once, however its name is spelled, and not when its name is not one plain folder name or is a session clip's. Throws for a folder
    that is not one folder's name. */
export function freePaths(home, folder, record) {
  const copies = workCopyDir(home, folder);
  const work = episodeWork(home, folder);
  const listed = Array.isArray(record?.app?.projects) ? record.app.projects : [];
  const clipped = listed.filter(isClip);
  const clipNames = new Set(clipped.map((project) => project.name));
  const inUse = listed.find((project) => Boolean(project) && isMain(project));
  const seen = new Set();
  const projects = [];
  for (const project of listed) {
    if (!freeable(project) || !plainName(project.name) || clipNames.has(project.name) || seen.has(folded(project.name))) continue;
    seen.add(folded(project.name));
    const dir = join(work, project.name);
    const video = join(dir, "media", "recording.mp4");
    projects.push({ key: project.key, name: project.name, dir, video: project === inUse ? video : null, stays: project === inUse ? null : video, renders: join(dir, "renders") });
  }
  const clips = clipped.filter((project) => plainName(project.name)).map((project) => ({ name: project.name, dir: join(work, project.name) }));
  return { work, copies, projects, clips };
}

// --- What it looks at ---

/** The real path of `path`: { path }, or { missing: true } when nothing is there (or something on the way is a file), or { bad: true }
    when it cannot be looked at. The real path is the one that does not follow case or normalise a name: it is compared with names
    built the same way. */
function realOf(path) {
  try {
    return { path: realpathSync(path) };
  } catch (e) {
    return e.code === "ENOENT" || e.code === "ENOTDIR" ? { missing: true } : { bad: true };
  }
}

/** What a path is, as lstat says it and a link is not followed: { type: "file" | "folder" | "other" }, or { missing: true }, or
    { bad: true }. */
function kindOf(path) {
  try {
    const found = lstatSync(path);
    return { type: found.isFile() ? "file" : found.isDirectory() ? "folder" : "other" };
  } catch (e) {
    return e.code === "ENOENT" || e.code === "ENOTDIR" ? { missing: true } : { bad: true };
  }
}

/** What a folder is on its volume, { id }: its device and its number there, which no spelling of its name changes; { missing: true }
    when nothing is there; { bad: true } when it cannot be looked at. A link is not followed: it has a number of its own, and the
    real path catches it. */
function identityOf(path) {
  try {
    const found = lstatSync(path, { bigint: true });
    return { id: `${found.dev}:${found.ino}` };
  } catch (e) {
    return e.code === "ENOENT" || e.code === "ENOTDIR" ? { missing: true } : { bad: true };
  }
}

/** Look at the disk for the paths `free` has named: { targets, stays }, each of `targets` { path, type, what, project } with `path`
    the real path to remove, `type` "file" or "folder", and `what` "video" (a project's), "renders" or "copies"; and `stays` the
    media/recording.mp4 of the other projects that are there, which are left; or { bad: true } when anything is not as it was made.
    Videos come first, then renders, then the folder of copies, and a path that is not there is left out. The work folder is looked
    at first: one that is not there has nothing to take. A project whose folder is a session clip's folder on the volume, whatever
    the record calls it, is not named. See the head of this file for what must hold. */
function lookAt(ctx, paths) {
  const none = { targets: [], stays: [] };
  const workRoot = workFolder(ctx.home);
  const home = realOf(ctx.home);
  const work = realOf(workRoot);
  if (home.bad || work.bad) return { bad: true };
  if (home.missing || work.missing) return none;
  if (work.path !== join(home.path, "BRIMM Video Work")) return { bad: true };
  if (ctx.root) {
    const root = realOf(ctx.root);
    if (root.bad || (root.path && (work.path === root.path || work.path.startsWith(`${root.path}${sep}`)))) return { bad: true };
  }
  const clipIds = new Set();
  for (const clip of paths.clips) {
    const there = identityOf(clip.dir);
    if (there.bad) return { bad: true };
    if (there.id) clipIds.add(there.id);
  }
  const named = [];
  for (const project of paths.projects) {
    const there = identityOf(project.dir);
    if (there.bad) return { bad: true };
    if (!(there.id && clipIds.has(there.id))) named.push(project);
  }
  const wanted = [
    ...named.filter((p) => p.video !== null).map((p) => ({ path: p.video, type: "file", what: "video", project: p.name })),
    ...named.map((p) => ({ path: p.renders, type: "folder", what: "renders", project: p.name })),
    { path: paths.copies, type: "folder", what: "copies", project: null }
  ];
  const targets = [];
  for (const want of wanted) {
    const parent = realOf(dirname(want.path));
    if (parent.bad) return { bad: true };
    if (parent.missing) continue;
    // The names between the work folder and the path, on the real path of the work folder: no folder on the way is a link.
    if (parent.path !== join(work.path, relative(workRoot, dirname(want.path)))) return { bad: true };
    const there = kindOf(want.path);
    if (there.bad) return { bad: true };
    if (there.missing) continue;
    if (there.type !== want.type) return { bad: true };
    targets.push({ path: join(parent.path, basename(want.path)), type: want.type, what: want.what, project: want.project });
  }
  const stays = named.filter((p) => p.stays !== null && !kindOf(p.stays).missing).map((p) => p.stays);
  return { targets, stays };
}

/** Look again at a path just before it goes, as it was looked at first: the real path of its folder is that folder's own path (no
    link has been put in the way since, the work folder's included), and it is still a file, or a folder, as it was. { still: true };
    { gone: true } when it is no longer there; { bad: true } when it is not what it was, or cannot be looked at. */
function lookAgain(target) {
  const parent = realOf(dirname(target.path));
  if (parent.missing) return { gone: true };
  if (parent.bad || parent.path !== dirname(target.path)) return { bad: true };
  const there = kindOf(target.path);
  if (there.missing) return { gone: true };
  if (there.bad || there.type !== target.type) return { bad: true };
  return { still: true };
}

/** The size of what is under a path, in bytes: the files in it at any depth, as lstat says, and a link neither followed nor counted. */
function sizeOf(path) {
  let found;
  try {
    found = lstatSync(path);
  } catch (e) {
    return 0;
  }
  if (found.isFile()) return found.size;
  if (!found.isDirectory()) return 0;
  let sum = 0;
  try {
    for (const name of readdirSync(path)) sum += sizeOf(join(path, name));
  } catch (e) {
    // What cannot be read is not counted.
  }
  return sum;
}

/** What a video is called, by its ending: the ones a render, an export or a clip of the app's makes. */
const VIDEO = /\.(?:mp4|mov|m4v|webm)$/i;

/** Whether a folder holds a video at any depth: a file whose name ends as a video's does. A link is neither looked into nor counted,
    since what it leads to is not in the folder. A folder that cannot be read is taken to hold one: the question is asked to keep
    what may be the only copy. `list(path)` is how a folder is read, as readdirSync with its entries as Dirents: a test gives another. */
function holdsVideo(path, list) {
  let entries;
  try {
    entries = list(path);
  } catch (e) {
    return true;
  }
  return entries.some((entry) => !entry.isSymbolicLink() && (entry.isDirectory() ? holdsVideo(join(path, entry.name), list) : entry.isFile() && VIDEO.test(entry.name)));
}

/** Whether the episode in `folder` has been handed off to the BRIMM Ops page, for sure: its record says it was finished, or a hand-off
    (a .brimm-ops.json) is in its final/ or in its history/, at any depth. A folder that cannot be read is no hand-off that is known:
    finish.js handedOff takes a doubt as handed off, which is its safe side, and here a doubt is the one that takes nothing. */
function handedOffForSure(folder, record) {
  if (record.finished) return true;
  return ["final", "history"].some((dir) => {
    try {
      return readdirSync(join(folder, dir), { recursive: true }).some((name) => String(name).endsWith(".brimm-ops.json"));
    } catch (e) {
      return false;
    }
  });
}

/** Whether HyperFrames is running on this Mac, as pgrep finds the program by its exact name (it exits 0 when one is, and 1 when none
    is): true or false. When pgrep cannot say (it is not there, it stops, or it exits otherwise) the answer is null, and nothing is
    taken away from under an app that may have a project open. `spawn` is how it is asked: a test gives another. */
export function hyperFramesRunning(spawn = spawnSync) {
  const ran = spawn("/usr/bin/pgrep", ["-x", APP_PROGRAM], { stdio: "ignore" });
  return ran.status === 0 ? true : ran.status === 1 ? false : null;
}

/** Some things as they are said in a row: "a", "a and b". */
const both = (things) => things.join(" and ");

// --- The command ---

/** Take the working copy and the renders of an episode away from this Mac, and resolve the code the command ends with: 0 when it took
    them or there was nothing to take, 1 when it refused or could not take all of them. `ctx` is what edit.js gives a command, { home,
    machine, root, alive, say, stat }; `found` is { name, folder }, the name of the episode's folder in Episodes and its path; and
    `record` is the episode's record. The order of what it does is the head of this file's. `deps`: `running(name)` says whether the
    program of that name is running (true or false, as a promise or not; a throw, or anything else, is that it cannot be told),
    `rm(path, options)` removes one path (rmSync): with `recursive` for a folder, and without it for a file; and `list(path)` reads a
    folder of renders to see whether it holds a video (readdirSync, with its entries as Dirents). */
export async function freeEpisode(ctx, { found, record }, deps = {}) {
  const { running = () => hyperFramesRunning(), rm = rmSync, list = (path) => readdirSync(path, { withFileTypes: true }) } = deps;
  const { home, say } = ctx;
  const name = shownName(record);
  const stop = (why) => {
    say(why);
    return 1;
  };

  const held = heldText(record, ctx.machine);
  if (held) return stop(held);
  let open;
  try {
    open = await running(APP_PROGRAM);
  } catch (e) {
    open = null;
  }
  if (open === true) return stop(QUIT);
  if (open !== false) return stop(CANT_TELL);
  if (runningCommand(home, found.name, ctx.alive, workCopyLockOf(home, found.name))) return stop(beingMade(name));
  if (runningCommand(home, found.name, ctx.alive)) return stop(stillAtWork(name));

  let looked;
  let paths;
  try {
    paths = freePaths(home, found.name, record);
    looked = lookAt(ctx, paths);
  } catch (e) {
    return stop(notAsMade(name));
  }
  if (looked.bad) return stop(notAsMade(name));
  const { targets, stays } = looked;
  if (!targets.length) {
    say(nothing(name));
    if (stays.length) say(STAYS);
    return 0;
  }

  // A render the app's agent made lands in a project's renders/, and may be the only copy of it until the episode is handed off.
  if (!handedOffForSure(found.folder, record) && targets.some((target) => target.what === "renders" && holdsVideo(target.path, list))) return stop(renderKept(name));

  // Only renders can be taken without the recording: the video is made again from it, and from nothing else.
  if (targets.some((target) => target.what !== "renders")) {
    const raw = typeof record.video?.file === "string" && record.video.file !== "" ? ctx.stat(join(found.folder, record.video.file)) : undefined;
    if (!raw || !raw.isFile()) return stop(notThere(name));
    const taken = new Set(targets.filter((target) => target.what === "video").map((target) => target.project));
    const listed = Array.isArray(record.app?.projects) ? record.app.projects : [];
    if (listed.some((project) => Boolean(project) && taken.has(project.name) && changedSince(project, { found, record }))) return stop(changed(name));
  }

  let bytes = 0;
  const gone = [];
  for (const target of targets) {
    const again = lookAgain(target);
    if (again.gone) continue;
    if (again.bad) return stop(stuck(bytes));
    const size = sizeOf(target.path);
    try {
      rm(target.path, target.type === "folder" ? { recursive: true } : {});
    } catch (e) {
      if (e?.code !== "ENOENT") return stop(stuck(bytes));
    }
    bytes += size;
    gone.push(target);
  }
  if (!gone.length) {
    say(nothing(name));
    if (stays.length) say(STAYS);
    return 0;
  }

  const video = gone.some((target) => target.what !== "renders");
  const renders = gone.some((target) => target.what === "renders");
  const touched = new Set(gone.filter((target) => target.project !== null).map((target) => target.project));
  say(`Took away ${both([...(video ? ["the video made for HyperFrames"] : []), ...(renders ? ["what HyperFrames rendered"] : [])])} for ${name}. That gave back ${sizeText(bytes)} on this Mac.`);
  if (touched.size) say(touched.size === 1 ? "Its HyperFrames project, and everything done in it, stays." : "Its HyperFrames projects, and everything done in them, stay.");
  if (gone.some((target) => target.what === "video")) say(`Say "open ${name} in HyperFrames" when you want it again: the video is made again then.`);
  if (stays.length) say(STAYS);
  return 0;
}
