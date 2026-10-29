// What `release` hands over of an episode's HyperFrames projects (architecture 2026-10-27: 4.7, 7.3 and F12; plan PR 11). A project lives in
// a Mac's own work folder, never in Dropbox (CLAUDE.md), so to let the other Mac go on with it, `release` puts a snapshot of each project
// into the episode (snapshot.js says what a snapshot holds) and the newest export of each into `edit/from-hyperframes/` (which exports.js
// reads on the other Mac). edit.js's releaseEpisode keeps what it did for Final Cut, and gives the projects of the record that are on this
// Mac to handOver, which, in order:
//   - asks whether HyperFrames is open (free.js hyperFramesRunning, as `free` asks): what is copied is what was saved, and no export is
//     half written, only when the app is quit. Open, or when that cannot be told, it hands nothing over;
//   - lists each project's files (snapshotFiles) and refuses, before it writes anything, a project that cannot be read, that weighs more
//     than a snapshot may (SNAPSHOT_MOST), or that is older than the newest snapshot the episode holds (a Mac that came back to an episode
//     after the other Mac worked on it would otherwise hand its older state over as the newest);
//   - finds the newest export of each project of this Mac (exports.js exportsToCarry);
//   - puts them in by the rule for writing into Dropbox (dropbox.js): every file made outside, in the project or in Downloads, and cloned
//     in under a name that is new, never over a file. The snapshot goes in a folder of its own, named by the moment, so nothing in it is
//     there already. An export of the same name and size already listed is kept; one of the same name and another size is replaced, the
//     old one deleted first, as the rule does; a file that is not whole is left and named.
// A failure removes what this run made (the new snapshot folder and the new export copies), so no snapshot is ever half there; the record
// is edit.js's, written last, and lists what was put in. When the record cannot be written, `undo` removes it again.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command.
import { existsSync, lstatSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { KEPT, clipFolders, clipTrouble, folded, isMain, plainName } from "./app.js";
import { cloneIn, replaceIn } from "./dropbox.js";
import { kindOf, shownName } from "./episode.js";
import { RELEASED_FOLDER, exportsFound, exportsToCarry } from "./exports.js";
import { hyperFramesRunning } from "./free.js";
import { sessionNotCleared } from "./gate.js";
import { sizeText } from "./kinds.js";
import { episodeWork } from "./settings.js";
import { SNAPSHOT_DIR, SNAPSHOT_MOST, makerOf, markerAsItIs, olderThan, putMarkerText, snapshotFiles, snapshotOf, snapshotStats, timeName, writeMarker } from "./snapshot.js";

/** The program the app runs as, which is asked of `running`. */
const APP_PROGRAM = "HyperFrames";

// --- What is said ---

const QUIT = "Quit HyperFrames first, so that everything you did is saved, then say it again. Nothing was handed over.";
const CANT_TELL = "I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was handed over.";
/** "The HyperFrames project for Pricing talk", or "…for Reel 2 of Pricing talk": how every line names a project. */
const projectOf = (name, project) => `The HyperFrames project for ${project.of}${name}`;
const cantRead = (name, project) => `${projectOf(name, project)} on this Mac can't be read, so nothing was handed over. Ask Jason.`;
const tooBig = (name, project, bytes) => `${projectOf(name, project)} is too big to hand over: ${sizeText(bytes)} of files, and the most is ${sizeText(SNAPSHOT_MOST)}. Nothing was handed over. Ask Jason.`;
const older = (name, project) => `${projectOf(name, project)} on this Mac is older than the one the other Mac handed over, so it isn't handed over again. Nothing was handed over. Ask Jason.`;
/** What is said while the newest snapshot of a project, which another Mac made, is not all here yet: `by` is that Mac, or "" when the
    record does not say. */
const arriving = (name, project, by) => `Dropbox is still bringing what ${by || "the other Mac"} handed over of ${project.of}${name}. Say it again when it is done. Nothing was handed over.`;
/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

// --- What it hands over ---

/** Whether a path is a real folder: a link is not one. */
function isFolder(path) {
  try {
    return lstatSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

/** The projects of the record that this Mac hands over, in the order they are handed over (the main video's, then each Reel by its number):
    { projects, bad }, `projects` each { key, name, dir, label, of }, where `label` is how the words call the part ("the main video", "Reel 2")
    and `of` what goes before the episode's name in "The HyperFrames project for … ". They are the main project in use and each Reel project
    whose folder is a folder in this Mac's work folder for the episode: a Reel she dropped included, since opening it again picks it again,
    but not a session clip's, not one kept for an earlier kind, not one whose name is not one plain folder name and not a duplicate of another
    however its name is spelled. A project whose folder is a session clip's on the volume, whatever the record calls it, is none (PR 15's
    rule, as free.js has it: the name is a clip's, or the folder is the same folder); and when a folder it has to tell from a clip's cannot
    be looked at, `bad` is true and nothing is handed over. A video that waits for its answer, and a session that is not cleared, have none. */
export function projectsToHand(ctx, { found, record }) {
  if (kindOf(record) === null || sessionNotCleared(record)) return { projects: [], bad: false };
  const listedProjects = Array.isArray(record?.app?.projects) ? record.app.projects : [];
  const work = episodeWork(ctx.home, found.name);
  const clips = clipFolders(work, record);
  if (clips.bad) return { projects: [], bad: true };
  const mains = [];
  const reels = [];
  const seen = new Set();
  // The main project in use is the first of the record that `app` would open (isMain), as app.js openInApp takes it: when its folder is not
  // on this Mac, no later "main" takes its place here.
  const inUse = listedProjects.find((project) => Boolean(project) && isMain(project));
  for (const project of listedProjects) {
    const reel = /^reel ([1-9]\d*)$/.exec(typeof project?.key === "string" ? project.key : "");
    const main = project === inUse;
    if ((!main && !(reel && project.state !== KEPT)) || !plainName(project.name) || seen.has(folded(project.name))) continue;
    const trouble = clipTrouble(work, clips, project.name);
    if (trouble === "bad") return { projects: [], bad: true };
    if (trouble === "clip") continue;
    const dir = join(work, project.name);
    if (!isFolder(dir)) continue;
    seen.add(folded(project.name));
    if (main) mains.push({ key: "main", name: project.name, dir, label: "the main video", of: "" });
    else reels.push({ key: project.key, n: Number(reel[1]), name: project.name, dir, label: `Reel ${reel[1]}`, of: `Reel ${reel[1]} of ` });
  }
  return { projects: [...mains, ...reels.sort((a, b) => a.n - b.n)], bad: false };
}

/** The first moment from `ms` that no snapshot of the episode in `folder` is named for, a second at a time. */
function freeTime(folder, ms) {
  for (let at = ms; ; at += 1000) if (!existsSync(join(folder, SNAPSHOT_DIR, timeName(at)))) return timeName(at);
}

/** The reason a copy failed, in words that hold no path: the last of cloneIn's phrases ("…: no room left on the disk. Nothing was copied."),
    or, of one of Node's own ("ENOSPC: no space left on device, copyfile '/a' -> '/b'"), the words before the call and the paths. A reason
    that still holds a path, or none, is "a file could not be copied" (the review of PR 11, M1). */
export const reasonOf = (e) => {
  const text = String(typeof e?.message === "string" ? e.message : "").replace(/ Nothing was copied\.$/, "").replace(/\.$/, "");
  const reason = text.split(": ").pop().replace(/, [a-z]+ '.*$/s, "").trim();
  return reason === "" || reason.includes("/") ? "a file could not be copied" : reason;
};

/** Hand over the projects `own` (projectsToHand) of the episode `found` with `record`, this Mac holding it. Resolves one of:
    - { refused }, words to say, ending the release with 1: nothing was written, or, with `lost`, the paths of copies in the episode that
      this run deleted to replace and could not (the record must stop listing them), and `resized`, { <path>: size } for the copies it replaced
      before the failure, which the record must list at the size they have now;
    - { copies, names, notYet, assetsLeft, time, undo }: `copies` the paths from the episode's folder of what was put in, with their sizes
      (the record lists them), `names` what to say was copied (the projects, then each export), `notYet` the exports that were not whole,
      `assetsLeft` the labels of the parts whose assets were left out for weighing too much, `time` the snapshot's folder name (nothing
      when no snapshot was made), and `undo()`, which removes what this run put in (for a record that cannot be written).
    `deps`: `running(name)`, whether the program is running (true or false, as a promise or not; a throw, or anything else, is that it
    cannot be told), `opts` the rule's (clone and sameDisk, cloneIn's), and `rm`. */
export async function handOver(ctx, { found, record, own = projectsToHand(ctx, { found, record }).projects }, { running = () => hyperFramesRunning(), opts = {}, rm = rmSync } = {}) {
  const name = shownName(record);
  let open;
  try {
    open = await running(APP_PROGRAM);
  } catch (e) {
    open = null;
  }
  if (open === true) return { refused: QUIT };
  if (open !== false) return { refused: CANT_TELL };

  const planned = [];
  for (const project of own) {
    const got = snapshotFiles(project.dir);
    if (got.unreadable) return { refused: cantRead(name, project) };
    if (got.bytes > SNAPSHOT_MOST) return { refused: tooBig(name, project, got.bytes) };
    const newest = snapshotOf(record.files, project.name);
    if (newest) {
      // The newest snapshot of this project is not all here. If another Mac made it, what is missing is on its way, and this Mac's older
      // project must not take its place as the newest (the review of PR 11, C1). A snapshot this Mac made itself that lost a file is none
      // to wait for: a new one takes its place.
      if (snapshotStats(found.folder, newest) === null) {
        const by = makerOf(found.folder, newest);
        if (by !== ctx.machine) return { refused: arriving(name, project, by) };
      }
      // A project that is not the newest snapshot (its marker says so, or, with no marker, the times of its files) is not handed over again.
      if (olderThan(newest, project.dir, { folder: found.folder, local: got })) return { refused: older(name, project) };
    }
    planned.push({ ...project, ...got });
  }

  const at = (rel) => join(found.folder, rel);
  const seen = exportsFound({ home: ctx.home, name: found.name, folder: found.folder, record, zone: ctx.deps.zone, readdir: ctx.deps.readdir });
  const wanted = exportsToCarry(seen.input);
  const copies = {};
  const made = [];
  const replaced = [];
  const time = planned.length ? freeTime(found.folder, ctx.now()) : "";
  // Each project's marker (snapshot.js) is made to name this snapshot as the last thing before the record is written, and put back as it was
  // when the run fails or the record cannot be written, so that a project never names a snapshot that is not in the episode.
  const markers = [];
  const undo = () => {
    for (const { dir, was } of markers.splice(0).reverse()) {
      try {
        putMarkerText(dir, was);
      } catch (e) {
        // A marker that cannot be put back names a snapshot that is gone: the project then counts as older, which is the safe way to be wrong.
      }
    }
    for (const rel of made.reverse()) rm(at(rel), { force: true });
    if (time) rm(join(found.folder, SNAPSHOT_DIR, time), { recursive: true, force: true });
  };
  const notYet = [];
  const names = [];
  try {
    for (const project of planned) {
      for (const file of project.files) {
        const rel = `${SNAPSHOT_DIR}/${time}/${project.name}/${file.rel}`;
        mkdirSync(dirname(at(rel)), { recursive: true });
        cloneIn(join(project.dir, file.rel), at(rel), opts);
        copies[rel] = statSync(at(rel)).size;
      }
    }
    if (planned.length) names.push(`its HyperFrames project${planned.length > 1 ? "s" : ""} (${listed(planned.map((p) => p.label))})`);
    for (const file of wanted) {
      const from = join(file.dir, file.name);
      const rel = `${RELEASED_FOLDER}/${file.name}`;
      if (!ctx.isWhole(from)) {
        notYet.push(file.name);
        continue;
      }
      const there = ctx.stat(at(rel));
      if (there && there.size === file.bytes && record.files[rel] === file.bytes) continue;
      mkdirSync(dirname(at(rel)), { recursive: true });
      if (there) {
        replaced.push(rel);
        replaceIn(from, at(rel), opts);
      } else {
        cloneIn(from, at(rel), opts);
        made.push(rel);
      }
      copies[rel] = statSync(at(rel)).size;
      names.push(file.name);
    }
    for (const project of planned) {
      markers.push({ dir: project.dir, was: markerAsItIs(project.dir) });
      writeMarker(project.dir, time, ctx.machine);
    }
  } catch (e) {
    undo();
    // A copy that was replaced before the failure is the new one now: the record must list it at the size it has (the review of PR 11, M9),
    // and one whose old copy was deleted and whose new one could not be made is gone.
    const lost = replaced.filter((rel) => !existsSync(at(rel)));
    const resized = Object.fromEntries(replaced.filter((rel) => existsSync(at(rel))).map((rel) => [rel, statSync(at(rel)).size]));
    return { refused: `${name} could not be handed over: ${reasonOf(e)}. Nothing was handed over: say hand it over again.`, ...(lost.length ? { lost } : {}), ...(Object.keys(resized).length ? { resized } : {}) };
  }
  return { copies, names, notYet, assetsLeft: planned.filter((p) => p.assets.left).map((p) => p.label), time, undo };
}

/** The sentence that says which assets were left out for weighing too much, with the space that joins it to the sentence before, or "". */
export const assetsWords = (labels) => (labels.length ? ` The assets of ${listed(labels)} (their pictures, music and fonts) are too big to hand over, so they stay on this Mac.` : "");
