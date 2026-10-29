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
//   - `assets/` while it is small: the app copies the media it is given into `assets/` (A0's project held a 213 MB video there beside 0.6 MB
//     of fonts and brand kit), so over ASSETS_MOST none of it goes. The whole of what goes is at most SNAPSHOT_MOST, or the project is
//     refused in words by hand-over.js, never half copied.
// The record lists the snapshot's files in its `files`, written last, so a snapshot is whole when the record lists it. The two newest whole
// ones are kept (keptSnapshots). `<time>` is UTC, so that the names sort as the moments do whatever zone a Mac is in.
//
// A project here that is older than the newest snapshot (behindSnapshot) is neither opened nor handed over again: a Mac that came back to
// an episode after the other Mac worked on it would otherwise go on from an older state.
//
// Nothing here writes into Dropbox. rebuildProject writes one project folder in the Mac's own work folder, whole or not at all (project.js).
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/** The folders at a project's top level that a snapshot leaves out. */
const LEFT_OUT = new Set(["media", "node_modules", "renders", "snapshots"]);

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

/** Whether a path from a project's folder is one a snapshot holds and a rebuild takes: a relative path of plain names, none starting with a
    dot, and not inside one of the folders left out at the project's top. */
export function holds(rel) {
  if (typeof rel !== "string" || rel === "") return false;
  const names = rel.split("/");
  if (names.some((name) => name === "" || name === "." || name === ".." || name.startsWith("."))) return false;
  return !LEFT_OUT.has(names[0]);
}

/** The files of a project's folder `dir` that go in its snapshot: { files, bytes, assets }, each file { rel, bytes, mtimeMs } in path order
    (rel with "/"), `bytes` what they weigh together, and `assets` { any, bytes, left }: whether `assets/` holds a file, what it weighs, and
    whether it was left out for weighing more than `assetsMost`. { unreadable: true } when the folder is not there, is not a folder (a link
    is not one), or it or any folder in it cannot be read: a snapshot is never made of part of a project. Nothing is written. */
export function snapshotFiles(dir, { assetsMost = ASSETS_MOST } = {}) {
  try {
    if (!lstatSync(dir).isDirectory()) return { unreadable: true };
  } catch (e) {
    return { unreadable: true };
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
      if (entry.name.startsWith(".") || (rel === "" && LEFT_OUT.has(entry.name)) || entry.isSymbolicLink()) continue;
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
  if (unreadable) return { unreadable: true };
  const inAssets = found.filter((file) => file.rel.startsWith("assets/"));
  const weighs = inAssets.reduce((sum, file) => sum + file.bytes, 0);
  const left = inAssets.length > 0 && weighs > assetsMost;
  const files = left ? found.filter((file) => !file.rel.startsWith("assets/")) : found;
  return { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0), assets: { any: inAssets.length > 0, bytes: weighs, left } };
}

/** The snapshots an episode's record lists, newest first, from its `files` (paths from the episode's folder, to their sizes):
    [{ time, ms, projects }], where `projects` is { <project name>: [{ rel, bytes }] }, each list in path order. A path that is not under
    `app-snapshot/<time>/<project name>/<file>`, whose time is not one timeName makes, or that has an empty name or a `.` or `..` in it,
    is none. The record is written by both Macs and by Dropbox, so nothing it lists is trusted to stay inside the episode's folder. */
export function snapshotsOf(files) {
  const found = new Map();
  for (const [path, bytes] of Object.entries(files && typeof files === "object" ? files : {})) {
    const names = path.split("/");
    if (names.length < 4 || names[0] !== SNAPSHOT_DIR) continue;
    const [, time, project, ...rest] = names;
    const ms = timeOf(time);
    if (ms === null || [project, ...rest].some((name) => name === "" || name === "." || name === "..")) continue;
    if (!found.has(time)) found.set(time, { time, ms, projects: {} });
    const of = found.get(time).projects;
    if (!Object.hasOwn(of, project)) of[project] = [];
    of[project].push({ rel: rest.join("/"), bytes });
  }
  for (const snapshot of found.values()) for (const list of Object.values(snapshot.projects)) list.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return [...found.values()].sort((a, b) => b.ms - a.ms);
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
      rev = JSON.parse(readFileSync(recordFile(folder, n), "utf8"));
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
    every file of the snapshot that a snapshot holds (holds), with the time it had, `.claude/settings.json` made again from the pin's table,
    and `node_modules/.bin/hyperframes` a link to `cli`, this Mac's own toolchain. The video is not in a snapshot and is not made here: it is
    made again from the raw video, as `free` leaves a project without it (app.js putVideoBack). `folder` is the episode's folder in Dropbox.
    `deps.fs` is node:fs, which a test replaces to make a step fail. Gives { assetsLeft }, true when no file of `assets/` was in the snapshot
    (they weighed too much to be handed over), or { why }: "not whole" when a file the record lists for it is not here at its size, or it
    holds nothing, and "could not" when the folder could not be made (then none is left). Nothing in `folder` is written. */
export function rebuildProject({ folder, snapshot, dir, cli }, deps = {}) {
  const stats = snapshotStats(folder, { ...snapshot, files: snapshot.files.filter(({ rel }) => holds(rel)) });
  if (stats === null || stats.length === 0) return { why: "not whole" };
  const files = new Map(stats.map(({ rel, mtimeMs }) => [rel, { copy: join(folder, snapshot.dir, rel), mtimeMs }]));
  files.set(".claude/settings.json", settingsText("main"));
  files.set("node_modules/.bin/hyperframes", { link: cli });
  try {
    writeProject(dir, files, deps.fs ? { fs: deps.fs } : {});
  } catch (e) {
    return { why: "could not" };
  }
  return { assetsLeft: !stats.some(({ rel }) => rel.startsWith("assets/")) };
}

/** Whether a project's files `local` are older than a snapshot's `there`: the newest of them is more than BEHIND_MS older than the snapshot's.
    Each is a list of { mtimeMs }. A project that holds no file with a time is older than any snapshot that has one, and a snapshot with none
    is older than nothing. */
export function behindSnapshot(local, there) {
  const newest = (list) => (Array.isArray(list) ? list : []).reduce((most, file) => (Number.isFinite(file?.mtimeMs) && (most === null || file.mtimeMs > most) ? file.mtimeMs : most), null);
  const snapshot = newest(there);
  if (snapshot === null) return false;
  const here = newest(local);
  return here === null || here + BEHIND_MS < snapshot;
}
