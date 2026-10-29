// Giving an episode's room back on this Mac (architecture 2026-10-27: sections 6.1 and 7.4, and risk 10; plan PR 15). A working copy is
// a second copy of the video, and the app and its agent write renders into a project all day, so an old episode takes room on the
// Mac's own disk. `free` takes the working copy and the renders away and nothing else: a project's text files, `brimm/`,
// `.hyperframes/` and every export stay, and so does the episode in Dropbox, so the video is made again when she opens the project
// (app.js puts it back).
//
// It deletes files, so it takes nothing it has not named, and names nothing it has not looked at:
//   - The paths are named: the episode's folder of copies (workcopy.js workCopyDir), and for each project of the record's
//     `app.projects` but a session clip's, its media/recording.mp4 and its renders/. Nothing is found by listing a folder or by a
//     pattern, so a file that only looks like one of them stays. A session clip's project is not named at all (`clips … done` is
//     its way out), and neither is a folder the record does not list. The record comes from Dropbox, where the other Mac writes it,
//     so a project's name that is not one plain folder name (app.js plainName) is left out and never joined to a path.
//   - Each path is looked at where it stands before the first goes. The work folder must be BRIMM Video Work in the real home, not a
//     link into Dropbox or anywhere else and not inside the BRIMM Video root; each path's parent must be the work folder's real path
//     with the same names after it, so that no folder on the way is a link; the path itself must be a file (the video) or a folder
//     (the others), not a link. A path that is not there is skipped. Anything else refuses the whole command, and what is removed
//     is the real path just looked at, so a link in the way cannot lead the removal elsewhere.
//   - It refuses before it takes anything: while the other Mac has the episode, while HyperFrames is running (its project may be
//     open on the video), while a run is at work on the episode, and when the video could not be made again (the recording is not in
//     the episode, or has changed since a project was made from it: that video would be gone for good).
// It writes no record, takes no claim and starts nothing: it is a Mac's own business, and `app` finds a project's video gone by
// looking for the file.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command. Everything it touches beyond the files
// it removes is given to it (`deps`), so no test runs a program: `running` and `rm` have defaults, and the default for a program it
// cannot ask after is that it is running.
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { changedSince, plainName } from "./app.js";
import { runningCommand } from "./detached.js";
import { heldText, shownName } from "./episode.js";
import { sizeText } from "./kinds.js";
import { episodeWork, workFolder } from "./settings.js";
import { workCopyDir, workCopyLockOf } from "./workcopy.js";

/** The program the app runs as, which pgrep finds by its exact name (CFBundleExecutable of HyperFrames.app). */
const APP_PROGRAM = "HyperFrames";

// --- What is said ---

const QUIT = "Quit HyperFrames first, then ask again. Nothing was taken away.";
const beingMade = (name) => `The video for HyperFrames is being made for ${name}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`;
const stillAtWork = (name) => `Something is still at work on ${name}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`;
const notAsMade = (name) => `The folder for ${name} on this Mac is not as it was made, so nothing was taken away. Ask Jason.`;
const notThere = (name) => `The recording of ${name} is not in its folder, so the video made from it could not be made again. Nothing was taken away.`;
const changed = (name) => `The recording of ${name} has changed since its HyperFrames project was made, so the video made from it could not be made again as it was. Nothing was taken away.`;
const nothing = (name) => `There is nothing to take away for ${name} on this Mac.`;
const stuck = (bytes) => (bytes > 0 ? `Took away ${sizeText(bytes)}, but part of it could not be taken away. Ask Jason.` : "Part of it could not be taken away. Ask Jason.");

// --- What it names ---

/** The projects `free` takes from: the main video's, including one kept for an earlier kind, and a Reel's. A session clip's is not
    one (`clip N`), and nothing else is either: a key this code does not know takes nothing. */
const freeable = (project) => typeof project?.key === "string" && /^(?:main|reel [1-9]\d*)$/.test(project.key);
const isClip = (project) => typeof project?.key === "string" && /^clip [1-9]\d*$/.test(project.key);

/** The paths `free` names for the episode in `folder` on this Mac, from the record: { work, copies, projects }, where `work` is the
    episode's own folder in BRIMM Video Work, `copies` its folder of copies, and each of `projects` is { key, name, dir, video,
    renders }: a project's folder, its media/recording.mp4 and its renders. Pure: nothing is looked at. A project is named once, and
    not when its name is not one plain folder name or is a session clip's. Throws for a folder that is not one folder's name. */
export function freePaths(home, folder, record) {
  const copies = workCopyDir(home, folder);
  const work = episodeWork(home, folder);
  const listed = Array.isArray(record?.app?.projects) ? record.app.projects : [];
  const clips = new Set(listed.filter(isClip).map((project) => project.name));
  const seen = new Set();
  const projects = [];
  for (const project of listed) {
    if (!freeable(project) || !plainName(project.name) || clips.has(project.name) || seen.has(project.name)) continue;
    seen.add(project.name);
    const dir = join(work, project.name);
    projects.push({ key: project.key, name: project.name, dir, video: join(dir, "media", "recording.mp4"), renders: join(dir, "renders") });
  }
  return { work, copies, projects };
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

/** Look at the disk for the paths `free` has named: { targets }, each { path, what, project } with `path` the real path to remove, and
    `what` "video" (a project's), "renders" or "copies"; or { bad: true } when anything is not as it was made. Videos come first,
    then renders, then the folder of copies, and a path that is not there is left out. The work folder is looked at first: one that
    is not there has nothing to take. See the head of this file for what must hold. */
function lookAt(ctx, paths) {
  const none = { targets: [] };
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
  const wanted = [
    ...paths.projects.map((p) => ({ path: p.video, type: "file", what: "video", project: p.name })),
    ...paths.projects.map((p) => ({ path: p.renders, type: "folder", what: "renders", project: p.name })),
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
    targets.push({ path: join(parent.path, basename(want.path)), what: want.what, project: want.project });
  }
  return { targets };
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

/** Whether HyperFrames is running on this Mac, as pgrep finds the program by its exact name (it exits 0 when one is, and 1 when none
    is). When pgrep cannot say (it is not there, it stops, or it exits otherwise), it counts as running: nothing is taken away from
    under an app that may have a project open. `spawn` is how it is asked: a test gives another. */
export function hyperFramesRunning(spawn = spawnSync) {
  const ran = spawn("/usr/bin/pgrep", ["-x", APP_PROGRAM], { stdio: "ignore" });
  return ran.status !== 1;
}

/** Some things as they are said in a row: "a", "a and b". */
const both = (things) => things.join(" and ");

// --- The command ---

/** Take the working copy and the renders of an episode away from this Mac, and resolve the code the command ends with: 0 when it took
    them or there was nothing to take, 1 when it refused or could not take all of them. `ctx` is what edit.js gives a command, { home,
    machine, root, alive, say, stat }; `found` is { name, folder }, the name of the episode's folder in Episodes and its path; and
    `record` is the episode's record. The order of what it does is the head of this file's. `deps`: `running(name)` says whether the
    program of that name is running (a promise or not), `rm(path, options)` removes one path (rmSync). */
export async function freeEpisode(ctx, { found, record }, deps = {}) {
  const { running = () => hyperFramesRunning(), rm = rmSync } = deps;
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
    open = Boolean(await running(APP_PROGRAM));
  } catch (e) {
    open = true;
  }
  if (open) return stop(QUIT);
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
  const { targets } = looked;
  if (!targets.length) {
    say(nothing(name));
    return 0;
  }

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
    const size = sizeOf(target.path);
    try {
      rm(target.path, { recursive: true });
    } catch (e) {
      if (e?.code !== "ENOENT") return stop(stuck(bytes));
    }
    bytes += size;
    gone.push(target);
  }

  const video = gone.some((target) => target.what !== "renders");
  const renders = gone.some((target) => target.what === "renders");
  const touched = new Set(gone.filter((target) => target.project !== null).map((target) => target.project));
  say(`Took away ${both([...(video ? ["the video made for HyperFrames"] : []), ...(renders ? ["what HyperFrames rendered"] : [])])} for ${name}. That gave back ${sizeText(bytes)} on this Mac.`);
  if (touched.size) say(touched.size === 1 ? "Its HyperFrames project, and everything done in it, stays." : "Its HyperFrames projects, and everything done in them, stay.");
  if (gone.some((target) => target.what === "video")) say(`Say "open ${name} in HyperFrames" when you want it again: the video is made again then.`);
  return 0;
}
