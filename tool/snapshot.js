// A HyperFrames project's snapshot (architecture 2026-10-27: 4.7, 7.3 and F12; plan PR 11). A project lives in a Mac's own work folder,
// never in Dropbox (CLAUDE.md), so the other Mac cannot open what this one made. `release` (hand-over.js) therefore writes the
// project's text files into the episode as a snapshot, by the rule for writing into Dropbox, and `app` on the other Mac rebuilds the
// project from it (rebuild, below). The app's history does not travel.
//
// A snapshot is `Episodes/<episode>/app-snapshot/<time>/<project name>/…`. What it holds of a project (snapshotFiles):
//   - every file but the project's own top-level `media/` (the working copy, which is made again from the raw video), `node_modules/` (the
//     link into the toolchain, made again for the Mac's own), `renders/` and `snapshots/`; and any name that starts with a dot, at any
//     depth (`.hyperframes/`, `.claude/`, the app's thumbnails and caches, `.DS_Store`, a `.env`): Dropbox does not sync such names, and a
//     file the record lists that never arrives stops the other Mac's `open` for good (edit.js `filesUnder` leaves them out of the Final
//     Cut copies for the same reason). A link is neither followed nor listed;
//   - `assets/` while what the app was given is small: the app copies the media it is given into `assets/` (A0's project held a 213 MB video
//     there beside 0.6 MB of fonts and brand kit), so over ASSETS_MOST none of that goes, and a note in the snapshot (LEFT_OUT_NOTE) says so; but
//     Studio's own `assets/fonts/` and `assets/logos/` always go, since the project's page cannot draw without them. The whole of what goes is
//     at most SNAPSHOT_MOST, or the project is refused in words by hand-over.js, never half copied.
// The record lists the snapshot's files in its `files`, written last, so a snapshot is whole when the record lists it. The two newest whole
// ones are kept (keptSnapshots), and one newer than the newest of those, which the other Mac is still bringing over, is never dropped. Which is
// newer is the record's own order of listing (snapshotsOf), never the clock that named it: `<time>` is UTC, so that the names read as the
// moments do whatever zone a Mac is in, but a Mac whose clock is behind names its snapshot earlier than the one it was rebuilt from.
//
// A project here that is older than the newest snapshot (olderThan) is neither opened nor handed over again: a Mac that came back to an
// episode after the other Mac worked on it would otherwise go on from an older state. Each project folder keeps a dot-file, the marker
// (MARKER), that names the snapshot the project was last rebuilt from or handed over as, and the Mac that made it; a project whose marker
// names another snapshot than the newest the record lists is older, whatever the times of its files say. A project with no marker (made
// here, never handed over) is judged by the times of its files (behindSnapshot), as before.
//
// A project whose marker says it is older is set aside, not refused (plan PR 18; Jason, 2026-10-29: "have Studio move the older folder aside itself,
// deleting nothing, and rebuild from the newer snapshot"): rebuildProject, given a place to set it aside to (asidePlace), builds the new project
// beside its place first, then moves the older folder there with one rename, whole and as it is, then renames the new project into its place, and
// puts the older folder back if that last step fails. A project with no marker is not set aside: its file times are not a word to act on.
// The older folder's own `assets/` that a snapshot of it left out for weighing too much (ownAssets) never reached the other Mac, so the project
// built from what it handed over lacks them: once that project is in its place they are renamed into it from the set-aside folder (keepAssets),
// never over a path it has (the review of PR 18, F1).
//
// Nothing here writes into Dropbox. rebuildProject writes one project folder in the Mac's own work folder, whole or not at all (project.js).
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { recordFile, recordNumbers } from "./episode.js";
import { settingsText, writeProject } from "./project.js";

/** The folder of an episode that holds its snapshots. */
export const SNAPSHOT_DIR = "app-snapshot";
/** How many snapshots an episode keeps: the newest that are whole. */
export const SNAPSHOTS_KEPT = 2;
/** The most `assets/` weighs for it to go in a snapshot, in bytes: 50 MB. A video the app was given weighs more. */
export const ASSETS_MOST = 50 * 1024 * 1024;
/** The most one project's snapshot weighs, in bytes: 100 MB. */
export const SNAPSHOT_MOST = 100 * 1024 * 1024;
/** How much older (in milliseconds) a project's newest file may be than the snapshot's and still be as new: Dropbox keeps a file's time to
    the whole second, so a copy may be up to a second either way. */
export const BEHIND_MS = 2000;
/** The folder, in an episode's own work folder on a Mac, that an older project folder is set aside into (asidePlace). No command takes it for a
    project: a project is found by its name in the record, and app.js plainName refuses this name to a record. */
export const ASIDE_DIR = "set aside";
/** How many seconds from the moment asidePlace looks for a name that is not taken. */
const ASIDE_TRIES = 100;

/** The files of Studio's own brand kit in a project's `assets/`: its fonts and its logos. A snapshot always holds them, the limit on `assets/`
    never taking them (they are small, and the project's page cannot draw without them). */
const isBrandKit = (rel) => rel.startsWith("assets/fonts/") || rel.startsWith("assets/logos/");
/** The file a snapshot holds, in place of the assets that were left out for weighing too much (snapshotFiles; the review of PR 11, M4): made
    by `release`, not read from the project, and never made into a file of the project by a rebuild, which says the assets are not in it. */
export const LEFT_OUT_NOTE = "assets/left-out.txt";
const LEFT_OUT_TEXT = "Some of this project's assets (pictures, music and video) were too big to hand over, so they are not in this snapshot. They stay on the Mac that made it.\n";

/** The folders at a project's top level that a snapshot leaves out. */
const LEFT_OUT = new Set(["media", "node_modules", "renders", "snapshots"]);

/** Whether Dropbox never syncs a file or folder of this name: one that starts with a dot (Finder's .DS_Store, the app's .hyperframes, a .env) and
    Finder's Icon\r. A file the record lists that never arrives stops the other Mac's `open` for good, so a snapshot holds none, and neither
    do the Final Cut copies (edit.js filesUnder, which uses this too: the review of PR 11, M2). */
export const notSynced = (name) => name.startsWith(".") || name === "Icon\r";

const pad = (n, width = 2) => String(n).padStart(width, "0");

/** A snapshot's folder name for the moment `ms`: UTC, to the second, "2026-10-20 20.00.00Z". */
export function timeName(ms) {
  const at = new Date(ms);
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ${pad(at.getUTCHours())}.${pad(at.getUTCMinutes())}.${pad(at.getUTCSeconds())}Z`;
}

/** The moment a snapshot's folder name gives, in milliseconds, or null when the name is not one timeName makes. */
export function timeOf(name) {
  const read = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})Z$/.exec(typeof name === "string" ? name : "");
  if (!read) return null;
  const [year, month, day, hours, minutes, seconds] = read.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  return timeName(ms) === name ? ms : null;
}

/** Where the older folder of the project called `name` is set aside to, in the episode's own work folder `work`: `set aside/<name> <moment>`,
    the moment as a snapshot's folder is named (timeName), taken a second later while that name is there (a link that leads nowhere is
    there too, and so is anything that cannot be looked at), and null when none of a hundred seconds is free or `ms` is not a moment.
    It is null too when `set aside` is there and is not a folder of its own: a link (to a folder in Dropbox, say) would have the rename
    follow it out of the work folder, and a file would make it fail (the review of PR 18, F8). The work folder itself may be a link: the
    project is in it too, so a rename into it goes where the project's own folder is. Nothing is written. */
export function asidePlace(work, name, ms) {
  if (!Number.isFinite(ms)) return null;
  try {
    if (!lstatSync(join(work, ASIDE_DIR)).isDirectory()) return null;
  } catch (e) {
    // Not there (it is made when the older folder is moved), or not to be looked at: below, no name in it is found free either.
  }
  for (let second = 0; second < ASIDE_TRIES; second++) {
    const place = join(work, ASIDE_DIR, `${name} ${timeName(ms + second * 1000)}`);
    try {
      lstatSync(place);
    } catch (e) {
      if (e.code === "ENOENT") return place;
    }
  }
  return null;
}

/** Whether a path from a project's folder is one a snapshot holds and a rebuild takes: a relative path of plain names, none starting with a
    dot, and not inside one of the folders left out at the project's top. */
export function holds(rel) {
  if (typeof rel !== "string" || rel === "") return false;
  const names = rel.split("/");
  if (names.some((name) => name === "" || name === "." || name === ".." || notSynced(name))) return false;
  return !LEFT_OUT.has(names[0]);
}

/** Every file of a project's folder `dir` that a snapshot could hold, { rel, bytes, mtimeMs } in path order (rel with "/"): all but the
    project's own top-level `media/`, `node_modules/`, `renders/` and `snapshots/`, every name that starts with a dot, at any depth (Dropbox
    does not sync those), and any link, which is neither followed nor listed. null when the folder is not there, is not a folder (a link is
    not one), or it or any folder in it cannot be read: a project is never taken for the part of it that could be read. Nothing is written. */
function walkProject(dir) {
  try {
    if (!lstatSync(dir).isDirectory()) return null;
  } catch (e) {
    return null;
  }
  const found = [];
  let unreadable = false;
  const walk = (folder, rel) => {
    let entries;
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch (e) {
      unreadable = true;
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (notSynced(entry.name) || (rel === "" && LEFT_OUT.has(entry.name)) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(join(folder, entry.name), path);
      } else if (entry.isFile()) {
        try {
          const here = lstatSync(join(folder, entry.name));
          found.push({ rel: path, bytes: here.size, mtimeMs: here.mtimeMs });
        } catch (e) {
          unreadable = true;
        }
      }
    }
  };
  walk(dir, "");
  return unreadable ? null : found;
}

/** What the app was given, of the files `found` (walkProject): `assets/` but for Studio's own fonts and logos (the brand kit), which always go
    in a snapshot (the review of PR 11, M4). { inAssets, weighs, left }: those files, what they weigh, and whether a snapshot leaves them out:
    over the limit all of them are left out (never a part of them). One rule for snapshotFiles, which leaves them out, and ownAssets, which
    finds the files that were left out. */
function assetsOf(found, assetsMost) {
  const inAssets = found.filter((file) => file.rel.startsWith("assets/") && !isBrandKit(file.rel));
  const weighs = inAssets.reduce((sum, file) => sum + file.bytes, 0);
  return { inAssets, weighs, left: inAssets.length > 0 && weighs > assetsMost };
}

/** The files of a project's folder `dir` that go in its snapshot: { files, bytes, assets }, each file { rel, bytes, mtimeMs } in path order
    (rel with "/"), `bytes` what they weigh together, and `assets` { any, bytes, left }: whether `assets/` holds a file, what it weighs, and
    whether it was left out for weighing more than `assetsMost`; over the limit none of it goes, and a note in the snapshot says so, so that the
    other Mac can tell it from a project that had no assets of its own. { unreadable: true } when the folder is not there, is not a folder (a
    link is not one), or it or any folder in it cannot be read: a snapshot is never made of part of a project. Nothing is written. */
export function snapshotFiles(dir, { assetsMost = ASSETS_MOST } = {}) {
  const found = walkProject(dir);
  if (found === null) return { unreadable: true };
  const { inAssets, weighs, left } = assetsOf(found, assetsMost);
  const files = left
    ? [...found.filter((file) => !inAssets.includes(file)), { rel: LEFT_OUT_NOTE, bytes: Buffer.byteLength(LEFT_OUT_TEXT), text: LEFT_OUT_TEXT }].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
    : found;
  return { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0), assets: { any: inAssets.length > 0, bytes: weighs, left } };
}

/** The files of a project's folder `dir` that a snapshot of it leaves out for being too big, { rel, bytes }: its own `assets/`, but for the brand
    kit, when they weigh more than `assetsMost` (the very rule snapshotFiles has), else none. These never reached the other Mac, so a project
    rebuilt from what it handed over lacks them (plan PR 18, the review's F1). null when the folder cannot be read (walkProject): nothing can
    be said of its assets. Nothing is written. */
export function ownAssets(dir, { assetsMost = ASSETS_MOST } = {}) {
  const found = walkProject(dir);
  if (found === null) return null;
  const { inAssets, left } = assetsOf(found, assetsMost);
  return left ? inAssets.map(({ rel, bytes }) => ({ rel, bytes })) : [];
}

/** Move the older project's own assets `files` (ownAssets, listed from the folder `aside` it was set aside to) into the project at `dir`, the
    one built from the newer snapshot: each by rename, on the one disk, making the folders it needs, so that the very file is there and nothing
    is copied or deleted. A path the project already has (a file, a link or a folder: what the snapshot brought, or the other Mac's own) is
    never written over, and its older file stays in the older folder. { kept, failed }: how many were moved, and how many could not be (a folder
    in the way that is a file, a rename that fails, a path that is not a plain one of `assets/`), which stay where they were. `fs` is node:fs,
    which a test replaces to make a step fail. */
export function keepAssets({ aside, dir, files, fs = nodeFs }) {
  let kept = 0;
  let failed = 0;
  for (const { rel } of files) {
    if (typeof rel !== "string" || !rel.startsWith("assets/") || !holds(rel)) {
      failed++;
      continue;
    }
    const to = join(dir, rel);
    try {
      try {
        fs.lstatSync(to);
        continue;
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      fs.mkdirSync(dirname(to), { recursive: true });
      fs.renameSync(join(aside, rel), to);
      kept++;
    } catch (e) {
      failed++;
    }
  }
  return { kept, failed };
}

/** The snapshots an episode's record lists, newest first, from its `files` (paths from the episode's folder, to their sizes):
    [{ time, ms, projects }], where `projects` is { <project name>: [{ rel, bytes }] }, each list in path order. A path that is not under
    `app-snapshot/<time>/<project name>/<file>`, whose time is not one timeName makes, or that has an empty name or a `.` or `..` in it,
    is none. The record is written by both Macs and by Dropbox, so nothing it lists is trusted to stay inside the episode's folder.
    Which is newer is the record's own order of listing, never the clock that named a snapshot (a Mac whose clock is behind names its
    snapshot earlier than the one it was rebuilt from): a snapshot stands where its first file stands in `files`, and the one listed last is
    the newest. A release adds its files at the end of the list ({ ...record.files, ...copies }) and nothing in this tool sorts or builds
    the list again, so the order of the list is the order the releases were written in. */
export function snapshotsOf(files) {
  const found = new Map();
  let at = 0;
  for (const [path, bytes] of Object.entries(files && typeof files === "object" ? files : {})) {
    at++;
    const names = path.split("/");
    if (names.length < 4 || names[0] !== SNAPSHOT_DIR) continue;
    const [, time, project, ...rest] = names;
    const ms = timeOf(time);
    if (ms === null || [project, ...rest].some((name) => name === "" || name === "." || name === "..")) continue;
    if (!found.has(time)) found.set(time, { time, ms, projects: {}, at });
    const of = found.get(time).projects;
    if (!Object.hasOwn(of, project)) of[project] = [];
    of[project].push({ rel: rest.join("/"), bytes });
  }
  for (const snapshot of found.values()) for (const list of Object.values(snapshot.projects)) list.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return [...found.values()].sort((a, b) => b.at - a.at).map(({ at: listed, ...snapshot }) => snapshot);
}

/** The Mac that first listed each of `paths` (paths from the episode's folder) in the episode's record, from the record's own revisions, which
    are kept (`record/0001.json` and on) and each written by the Mac that made it (`writer.on`): { <path>: "Mac Studio" }, "" for a path
    that no revision lists, or whose first listing cannot be told because a revision between is missing or cannot be read. A Mac lists a
    snapshot's files, and the copies of its exports, in the one write that puts them in, so the Mac that first listed a file is the one that
    made the copy. Revisions are read from the newest back, no further than the oldest that is needed. Nothing is written. */
export function listedBy(folder, paths) {
  const out = {};
  const open = new Set(paths);
  const last = new Map();
  let above = null;
  let whole = true;
  for (const n of recordNumbers(folder)) {
    let rev = null;
    try {
      const text = readRegular(recordFile(folder, n));
      rev = text === null ? null : JSON.parse(text);
    } catch (e) {
      rev = null;
    }
    if ((above !== null && n !== above - 1) || rev === null || typeof rev !== "object" || rev.rev !== n || rev.files === null || typeof rev.files !== "object") {
      whole = false;
      break;
    }
    above = n;
    for (const path of [...open]) {
      if (Object.hasOwn(rev.files, path)) last.set(path, typeof rev.writer?.on === "string" ? rev.writer.on : "");
      else {
        out[path] = last.get(path) ?? "";
        open.delete(path);
      }
    }
    if (open.size === 0) break;
  }
  for (const path of open) out[path] = whole ? (last.get(path) ?? "") : "";
  return out;
}

/** The Mac that made `snapshot` (snapshotOf) in the episode's `folder`: who first listed its first file (listedBy), or "" when the record does
    not say or the snapshot holds no file. */
export function makerOf(folder, snapshot) {
  const first = snapshot.files[0] ? `${snapshot.dir}/${snapshot.files[0].rel}` : null;
  return first === null ? "" : listedBy(folder, [first])[first];
}

/** The newest snapshot that holds files of the project called `name`: { time, ms, dir, files }, `dir` being its folder from the episode's
    (`app-snapshot/<time>/<name>`) and `files` the list the record gives, or null when none does. */
export function snapshotOf(files, name) {
  if (typeof name !== "string") return null;
  for (const snapshot of snapshotsOf(files)) {
    if (Object.hasOwn(snapshot.projects, name)) return { time: snapshot.time, ms: snapshot.ms, dir: `${SNAPSHOT_DIR}/${snapshot.time}/${name}`, files: snapshot.projects[name] };
  }
  return null;
}

/** Which snapshots an episode keeps, of the record's `files`: { keep, drop }, the names (newest first) of the snapshots kept: the two newest
    that are whole, and every one newer than the newest of those, which is not whole yet because the other Mac's files are still on their way
    (it is never dropped, nor counted among the two), and of every other (newest first), older or not whole. A snapshot is whole when
    `whole(path, bytes)` says each file the record lists for it, as a path from the episode's folder and its size, is there at that size. */
export function keptSnapshots(files, whole) {
  const keep = [];
  const drop = [];
  let wholeKept = 0;
  let sawWhole = false;
  for (const snapshot of snapshotsOf(files)) {
    const all = Object.entries(snapshot.projects).every(([project, list]) => list.every(({ rel, bytes }) => whole(`${SNAPSHOT_DIR}/${snapshot.time}/${project}/${rel}`, bytes)));
    if (all) sawWhole = true;
    const kept = all ? wholeKept < SNAPSHOTS_KEPT : !sawWhole;
    if (kept && all) wholeKept++;
    (kept ? keep : drop).push(snapshot.time);
  }
  return { keep, drop };
}

/** The files of `snapshot` (snapshotOf) as they are in the episode's folder `folder`: [{ rel, bytes, mtimeMs }], or null when any is not
    there, is not a file, or is not the size the record lists. Nothing is written. */
export function snapshotStats(folder, snapshot) {
  const out = [];
  for (const { rel, bytes } of snapshot.files) {
    try {
      const here = lstatSync(join(folder, snapshot.dir, rel));
      if (!here.isFile() || here.size !== bytes) return null;
      out.push({ rel, bytes, mtimeMs: here.mtimeMs });
    } catch (e) {
      return null;
    }
  }
  return out;
}

/** A moment as she is told it, to the minute, in the zone `zone` gives ({ text(ms) }, exports.js fixedZone for a test) or this Mac's own:
    "2026-10-20 15:00". */
export function momentText(ms, zone) {
  if (zone && typeof zone.text === "function") return zone.text(ms);
  const at = new Date(ms);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Rebuild the project that `snapshot` (snapshotOf) holds, in the folder `dir` on this Mac, whole or not at all (project.js writeProject):
    every file of the snapshot that a snapshot holds (holds), with the time it had (but for one dated after `now`, which is given that
    moment), `.claude/settings.json` made again from the pin's table, the marker (MARKER) that names this snapshot and `by`, the Mac that
    made it ("" when the record does not say), and `node_modules/.bin/hyperframes` a link to `cli`, this Mac's own toolchain. The video is not in a snapshot and is not made here: it is
    made again from the raw video, as `free` leaves a project without it (app.js putVideoBack). `folder` is the episode's folder in Dropbox.
    `deps.fs` is node:fs, which a test replaces to make a step fail. Gives { assetsLeft }, true when no file of `assets/` was in the snapshot
    (they weighed too much to be handed over), or { why }: "not whole" when a file the record lists for it is not here at its size, or it
    holds nothing, and "could not" when the folder could not be made (then none is left). Nothing in `folder` is written.
    `aside` (asidePlace) is where the folder that is at `dir` already, an older project, is to be set aside to (plan PR 18): the new project is
    made beside `dir` first, whole or not at all, in a folder of its own (`<name> <8 characters>.new`); then the older folder is moved to
    `aside` with one rename, whole and as it is, a rename of a folder on one volume copying and deleting nothing; then the new project is
    renamed into `dir`. A step that fails leaves the older folder where it was: one that fails before the move leaves nothing of its own; one
    that fails after it puts the older folder back with a rename, and then takes away the project it built (the one thing removed, which is
    Studio's own and can be built again). Gives { assetsLeft, aside, assets } when it was set aside, or { why }: those two, and "stuck" when
    even the older folder could not be put back, which leaves it whole in its set-aside place and the new project built beside `dir`, nothing
    removed.
    `assets` { kept, failed } is the review's F1 (PR 18): when the older folder's own `assets/` (the brand kit apart) weighed more than
    `assetsMost`, a snapshot of it left them out, so they never reached the other Mac and the project built from what it handed over lacks
    them. Once that project is in its place, each of those files it lacks is moved into it from the set-aside folder (keepAssets), never over
    a path it has; `kept` is how many were moved and `failed` how many could not be, which stay in the set-aside folder. When they weighed the
    limit or less they were handed over, and a file the other Mac removed is not brought back. */
export function rebuildProject({ folder, snapshot, dir, cli, by = "", now, aside = null, assetsMost = ASSETS_MOST }, deps = {}) {
  const stats = snapshotStats(folder, { ...snapshot, files: snapshot.files.filter(({ rel }) => holds(rel)) });
  if (stats === null || stats.length === 0) return { why: "not whole" };
  // A file keeps the time it had, but not one in the future: the project's last change (exports.js projectChange) is read from these
  // times, and one file dated after the moment of the rebuild would stand for it, and make every export look older.
  const timed = (mtimeMs) => (Number.isFinite(now) ? Math.min(mtimeMs, now) : mtimeMs);
  const files = new Map(stats.filter(({ rel }) => rel !== LEFT_OUT_NOTE).map(({ rel, mtimeMs }) => [rel, { copy: join(folder, snapshot.dir, rel), mtimeMs: timed(mtimeMs) }]));
  files.set(".claude/settings.json", settingsText("main"));
  files.set(MARKER, markerText(snapshot.time, by));
  files.set("node_modules/.bin/hyperframes", { link: cli });
  const assetsLeft = stats.some(({ rel }) => rel === LEFT_OUT_NOTE);
  if (aside === null) {
    try {
      writeProject(dir, files, deps.fs ? { fs: deps.fs } : {});
    } catch (e) {
      return { why: "could not" };
    }
    return { assetsLeft };
  }
  const fs = deps.fs ?? nodeFs;
  const placed = replaceOlder({ dir, aside, files, fs });
  if (placed.why) return placed;
  // The older folder is where `aside` says now, whole, and the new project is in its place: what the older folder had that never reached the
  // other Mac is moved in last, so that a step before this one that fails leaves the older folder as it was. A folder that cannot be read
  // says nothing of its assets, and is set aside whole all the same.
  const own = ownAssets(aside, { assetsMost }) ?? [];
  return { assetsLeft, aside, assets: keepAssets({ aside, dir, files: own, fs }) };
}

/** Put the project that `files` make (project.js) in place of the older folder at `dir`, which goes to `aside`: the order, and what a step that
    fails leaves, are rebuildProject's. Gives {} when it is done, or { why: "could not" | "stuck" }. */
function replaceOlder({ dir, aside, files, fs }) {
  const building = join(dirname(dir), `${basename(dir)} ${randomUUID().slice(0, 8)}.new`);
  try {
    writeProject(building, files, { fs });
  } catch (e) {
    return { why: "could not" };
  }
  // The project just built is Studio's own, made seconds ago from the snapshot: it is the one thing taken away, and only when a later step fails.
  const dropBuilt = () => {
    try {
      fs.rmSync(building, { recursive: true, force: true });
    } catch (e) {
      // It stays beside the project's place, whole, and the next try builds another.
    }
  };
  try {
    fs.mkdirSync(dirname(aside), { recursive: true });
    fs.renameSync(dir, aside);
  } catch (e) {
    dropBuilt();
    return { why: "could not" };
  }
  try {
    fs.renameSync(building, dir);
  } catch (e) {
    try {
      fs.renameSync(aside, dir);
    } catch (again) {
      return { why: "stuck" };
    }
    dropBuilt();
    return { why: "could not" };
  }
  return {};
}

/** Whether a project's files `local` are older than a snapshot's `there`: the newest of them is more than BEHIND_MS older than the snapshot's.
    Each is a list of { mtimeMs }. A project that holds no file with a time is older than any snapshot that has one, and a snapshot with none
    is older than nothing. This is the file-time test, which a project that has no marker (olderThan) falls back to: a clock that is behind,
    a file that is only deleted, or one dated in the future fool it. */
export function behindSnapshot(local, there) {
  const newest = (list) => (Array.isArray(list) ? list : []).reduce((most, file) => (Number.isFinite(file?.mtimeMs) && (most === null || file.mtimeMs > most) ? file.mtimeMs : most), null);
  const snapshot = newest(there);
  if (snapshot === null) return false;
  const here = newest(local);
  return here === null || here + BEHIND_MS < snapshot;
}

// --- Which snapshot a project is (the review of PR 11, I1) ---

/** The file in a project's folder (on the Mac's own disk, never in a snapshot: it starts with a dot) that says which snapshot the project was
    last rebuilt from or handed over as, and the Mac that made that snapshot: { "snapshot": "<time>", "by": "<Mac>" }. `by` is "" when the
    record does not say. */
export const MARKER = ".brimm-snapshot.json";

/** The flags by which a file in a project (the app's folder, which its agent can write in) is opened to be read: no link is followed, and no
    wait is made on a file that is not a regular one. A pipe where the file should be has no writer, and opening it as a plain read waits for
    one for good (plan PR 10, review I1: exports.js readRegular reads the app's files the same way). */
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** The text of the file at `path` when it is a regular file; null for anything else (a link, a folder, a pipe, a file that is not there or
    cannot be read). It is looked at once it is open, so that what is read is the very file that was looked at. */
function readRegular(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    return fstatSync(fd).isFile() ? readFileSync(fd, "utf8") : null;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** What a project's marker says, { snapshot, by }, or null when there is none, it is not a regular file, it cannot be read, or it names no snapshot. */
export function readMarker(dir) {
  try {
    const text = readRegular(join(dir, MARKER));
    if (text === null) return null;
    const told = JSON.parse(text);
    if (told === null || typeof told !== "object" || timeOf(told.snapshot) === null) return null;
    return { snapshot: told.snapshot, by: typeof told.by === "string" ? told.by : "" };
  } catch (e) {
    return null;
  }
}

/** The marker's text. */
export const markerText = (snapshot, by = "") => `${JSON.stringify({ snapshot, by })}\n`;

/** Write a project's marker, whole: beside it under another name, then renamed over it. Throws when it cannot be written. */
export function writeMarker(dir, snapshot, by = "") {
  putMarkerText(dir, markerText(snapshot, by));
}

/** What a project's marker file holds, as text, or null when there is none (or it is not a regular file): for putting it back as it was
    (putMarkerText). */
export function markerAsItIs(dir) {
  return readRegular(join(dir, MARKER));
}

/** Put a project's marker file back as `text` says (markerAsItIs), whole, or take it away when `text` is null. Throws when it cannot. */
export function putMarkerText(dir, text) {
  const file = join(dir, MARKER);
  if (text === null) {
    rmSync(file, { force: true });
    return;
  }
  // Written beside it under another name, then renamed over it (over a pipe or a link that is in its place, which the rename replaces): the name
  // beside it is cleared first and made new ("wx"), so that a pipe left there is not written into, which would wait for a reader for good.
  try {
    rmSync(`${file}.writing`, { force: true });
    writeFileSync(`${file}.writing`, text, { flag: "wx" });
    renameSync(`${file}.writing`, file);
  } catch (e) {
    rmSync(`${file}.writing`, { force: true });
    throw e;
  }
}

/** Whether the project in `dir` is older than `newest`, the newest snapshot the record lists of it (snapshotOf), by its marker's word alone
    (plan PR 18), which is what a folder is set aside on. `listed` is every snapshot the record lists of the project, as snapshotsOf gives them
    ({ time, ms }, newest first). It is older when the marker names:
    - a snapshot the record lists that is not the newest: the record's own order of listing says it is older; or
    - one the record lists no more that was named before every snapshot it does list: the record keeps the two newest, so a Mac that was away
      while the other Mac handed over twice holds a marker for a snapshot that has been dropped.
    A marker for a snapshot that the record never listed, or that was named after one it lists, may be newer work, not older (Dropbox can undo
    the record of a hand-over this Mac made, and the snapshot's files stay), and a clock that is ahead names a snapshot late: that is not a word to
    set a folder aside on (olderThan takes it for older, to refuse). A project with no marker, or whose marker cannot be read (it is a link, a
    pipe, not JSON, or names no snapshot), is not marked older, whatever the times of its files say. false for no snapshot. Without `listed`
    every marker for another snapshot is older, as olderThan has it. */
export function markedOlder(newest, dir, listed = null) {
  if (!newest) return false;
  const marker = readMarker(dir);
  if (marker === null || marker.snapshot === newest.time) return false;
  if (!Array.isArray(listed)) return true;
  if (listed.some((snapshot) => snapshot.time === marker.snapshot)) return true;
  const named = timeOf(marker.snapshot);
  return named !== null && listed.every((snapshot) => named < snapshot.ms);
}

/** Whether the project in `dir` on this Mac is older than `newest`, the newest snapshot the record lists of it (snapshotOf): the other Mac
    worked on it since, and a project that is opened or handed over from here would go on from an older state. null for `newest` is no
    question. A project whose marker names another snapshot than the newest is older, whatever the times of its files say: a deletion, a
    clock that is behind and a file dated in the future change nothing there; a marker that names a snapshot the record lists no more is
    older too, since the snapshots the record keeps are the newest. A project with no marker (made here and never handed over) is judged by
    the times of its files (behindSnapshot) against the snapshot's in the episode's `folder`, as before; `local` is its files if the caller
    has listed them already (snapshotFiles). false when nothing says it is: the snapshot is not whole here, or the project cannot be read. */
export function olderThan(newest, dir, { folder, local } = {}) {
  if (!newest) return false;
  const marker = readMarker(dir);
  if (marker) return marker.snapshot !== newest.time;
  const there = snapshotStats(folder, newest);
  if (there === null) return false;
  const here = local ?? snapshotFiles(dir);
  return here.unreadable ? false : behindSnapshot(here.files, there);
}
