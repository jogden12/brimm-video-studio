// The episode import's own steps. When this Mac has settings and the folder the import watches is this Mac's drop folder,
// in BRIMM Video in Dropbox, each video is made into an episode: everything is made as for any video, held in the run's own
// folder, and then filed into a folder of its own in Episodes. The raw video is cloned in from the drop folder, each file
// made of it is cloned in from the run's folder, and the episode's first record, record/0001.json, comes last: it is the sign that
// the import finished. The import makes no Final Cut file and no edit/ folder (Phase 2); an episode of an older import still has
// them, and they are read as they were. Nothing in Dropbox is renamed, moved or written into (dropbox.js). The raw video stays in the drop
// folder, and the run's folder stays, until the late check.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay } from "./shared/text.js";
import { createdOf, waitingToCut } from "./cuts.js";
import { isMedia } from "./lib.js";
import { LATE_CHECK_MS, cloneFile, cloneIn, isWhole, lateCheck, onSameDisk, replaceIn, sameBytes, startsAlike, textWriter } from "./dropbox.js";
import { RECORD_DIR, recordFile, conflictedCopies, conflictedOf, lastWritten, newEpisode, newId, localStamp, readEpisode, recordCopies, recordNumbers, writeEpisode, shownName } from "./episode.js";
import { episodeFolderName, fileSafe } from "./names.js";
import { putHereNow } from "./put-here.js";
import { downloadsFolder, dropFolderOf, episodeFilesFolder, episodeWork, episodesFolder, importingFolder, pendingFolder, runsFolder, sameFolder, seenFile, workFolder } from "./settings.js";
// detached.js takes caffeinate and thisCheckout from here: each is used only when called, as kinds.js's are, so the cycle costs nothing at load.
import { releaseEpisodeLock, runningCommand, takeEpisodeLock } from "./detached.js";
// finish-ended.js takes its result from detached.js: used only when called, like detached.js's own names.
import { askedAt, endedSinceYes } from "./finish-ended.js";
import { holdsVideo, importState, leftByCrash, readStatusesIn, removeStatusIn, writeStatusIn } from "./importing.js";
import { isRunning } from "./run.js";
import { lookAt, lookLog, noteState, placeWordsOf, postIfDue, readAccess } from "./access.js";
// kinds.js takes episodeKind from here: each is used only when called, so neither needs the other to have been read first.
import { isZoomName, namesOf, withoutNames, zoomTimeOf } from "./kinds.js";
import { gated, gatedAsOf, withShortId } from "./gate.js";
import { keptOnAMac } from "./where.js";
// originals.js imports this file, as finish.js does: checkOriginal is a function declaration, bound before any module of the cycle runs.
import { checkOriginal, oweForgotten } from "./originals.js";
// finish.js, finish-check.js and finish-ended.js each import this file, directly or through detached.js: their names are used only inside functions.
import { linksOf } from "./finish.js";
import { clearChecking, clearProblem, flagProblem, problemNotice } from "./finish-check.js";
import { randomUUID } from "node:crypto";

/** How long a recording must be to be an episode, in seconds. One that is shorter is a short video. */
const SHORT_UNDER = 90;

/** Whether the import of the watched folder `dir` makes episodes: when this Mac has `settings` and `dir` is its own drop
    folder: the one picked on this Mac (dropPath), else the one its `drop` setting names (Unedited Video when it names none). Otherwise the import does what it did before
    episodes, filing each video into a folder for the day. */
export const episodeMode = (dir, settings, home) => Boolean(settings) && resolve(dir) === resolve(dropFolderOf(settings, home));

/** What kind of episode a video makes, by its facts: a short video when its picture is upright or square, or it is shorter
    than 90 seconds, and an episode otherwise. A short video gets no upright version and no Reels. A recording of sound alone
    is an episode. */
export function episodeKind(facts) {
  if (!facts.height) return "episode";
  return facts.width <= facts.height || facts.duration < SHORT_UNDER ? "short video" : "episode";
}

/** The folders in Episodes that the Mac `machine` would have named for a video: any day, the video's name, that Mac's, and a
    number or none. With no `machine`, the folders either Mac would have named for it, any Mac's name in its brackets. */
function namedFor(name, stem, machine) {
  const tail = ` ${fileSafe(stem)} (`;
  const i = name.indexOf(tail);
  if (i < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(name.slice(0, i))) return false;
  const rest = name.slice(i + tail.length);
  if (machine === undefined) return /^.+\)(-\d+)?$/.test(rest);
  return rest.startsWith(`${machine})`) && /^(-\d+)?$/.test(rest.slice(machine.length + 1));
}

/** The size of a file, or -1 when it is not there. */
const sizeOf = (file) => {
  const found = statSync(file, { throwIfNoEntry: false });
  return found ? found.size : -1;
};

/** The name of the file that marks a local episode's folder as the one an import made: video/.import.json, { import, drop }, the import's short
    id (importIdOf) and the drop file's full one (dropIdOf). */
export const IMPORT_MARK = ".import.json";

/** The folders of episodes' own files on this Mac, under `work` (its BRIMM Video Work): the names that hold a video/ folder. */
function localFolders(work) {
  let names = [];
  try {
    names = readdirSync(work);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return names.filter((name) => statSync(join(work, name, "video"), { throwIfNoEntry: false })?.isDirectory());
}

/** What a local episode's marker says, or null when it has none, or none that can be read. */
function markOf(folder) {
  try {
    const mark = JSON.parse(readFileSync(join(folder, IMPORT_MARK), "utf8"));
    return mark && typeof mark === "object" ? mark : null;
  } catch (e) {
    return null;
  }
}

/** Whether the folder `name` of a local import, found by its marker, is a run that stopped and nothing else: video/ holds none of the episode's
    work (history/, .put.json), and Episodes/<name> is not there, or has no record file at all (NNNN.json, whether it reads now or not). */
export function stoppedRun(episodes, work, name) {
  const video = join(work, name, "video");
  if (existsSync(join(video, "history")) || existsSync(join(video, ".put.json"))) return false;
  const folder = join(episodes, name);
  if (!statSync(folder, { throwIfNoEntry: false })) return true;
  return readEpisode(folder).code === "NONE" && !cannotTell(folder, { code: "NONE" });
}

/** The folder in `episodes` the video `video`, of `bytes` bytes, goes into on `machine`, on the day `day`: { name, reused }, and `held: true` for a marked folder that is no stopped run and has no whole record (neither used again nor written over).
    Listing Episodes throws on any error but its not being there: a name is never given while Episodes cannot be read.
    With no `work` (a Mac on a drop folder in Dropbox, or the join), an import of this video by this Mac that stopped before it wrote a
    whole record left a folder, which is used again: its name is one this Mac would give the video, it has no whole record, and it
    holds the video at its size, or no video yet. Otherwise a new name, by episodeFolderName.
    With `work`, this Mac's work folder (a Mac with a drop folder of its own; Phase 3, L3), the episode's own files are in <work>/<name>/video,
    and a folder in Episodes with no record and no video is a first record lost, not a folder to use again: a name is free only when
    neither Episodes/<name> nor <work>/<name>/video is there, unless that video/.import.json names this import (`importId` and `dropId`
    both), which is the folder of a run that stopped, whatever day it was named on. */
export function findFolder(episodes, { video, bytes, machine, day, work, importId = "", dropId = "" }) {
  const stem = basename(video, extname(video));
  let names = [];
  try {
    names = readdirSync(episodes);
  } catch (e) {
    // There is no Episodes yet, and nothing in it to use again. Any other error is not known to be that.
    if (e.code !== "ENOENT") throw e;
  }
  if (work) {
    const mine = localFolders(work);
    const marked = importId && dropId ? mine.sort().find((name) => {
      const mark = markOf(join(work, name, "video"));
      return mark !== null && mark.import === importId && mark.drop === dropId;
    }) : undefined;
    // A folder with a whole record is an episode, not a run that stopped: it is never used again. A marked folder that is no stopped run and has no
    // whole record (its records are there and do not read now, or its folder cannot be read, or its video/ was worked on) is held: the drop file waits.
    if (marked && stoppedRun(episodes, work, marked)) return { name: marked, reused: true };
    if (marked && !readEpisode(join(episodes, marked)).record) return { name: marked, reused: false, held: true };
    return { name: episodeFolderName([...names, ...mine], day, stem, machine), reused: false };
  }
  const stopped = names.filter((name) => namedFor(name, stem, machine)).sort().find((name) => {
    const folder = join(episodes, name);
    if (readEpisode(folder).code !== "NONE") return false;
    const size = sizeOf(join(folder, video));
    return size === -1 || size === bytes;
  });
  return stopped ? { name: stopped, reused: true } : { name: episodeFolderName(names, day, stem, machine), reused: false };
}

/** The name of the marked folder that holds the video `file` back on a Mac with a drop folder of its own (findFolder's `held`), or "": decided before
    any work is done on the video, so that a held video is not read and transcribed again at every look. */
export function heldFolderOf(file, dropFile, { episode, today }) {
  try {
    const found = findFolder(episodesFolder(episode.root), { video: basename(file), bytes: statSync(file).size, machine: episode.machine, day: today ? today() : localDay(), work: workFolder(episode.home), importId: importIdOf(dropFile), dropId: dropIdOf(dropFile) });
    return found.held ? found.name : "";
  } catch (e) {
    return "";
  }
}

/** Whether the folder `checkout` has a .git of its own, which is a folder, or a worktree's file. The app's copy of the code has none,
    and a folder inside a checkout (tool/) has none of its own, so git is asked only where this is true. */
export const isGitCheckout = (checkout, { exists = existsSync } = {}) => typeof checkout === "string" && checkout !== "" && exists(join(checkout, ".git"));

/** What git says: the short commit the checkout `checkout` is at, or "unknown". */
function gitCommitOf(checkout, spawn) {
  const ran = spawn("git", ["-C", checkout, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const commit = ran.status === 0 ? String(ran.stdout).trim() : "";
  return /^[0-9a-f]{7,}$/.test(commit) ? commit : "unknown";
}

/** Which brimm-video is at work: the short commit the checkout `checkout` is at, as git says it, or "unknown", where the folder has
    no .git of its own (isGitCheckout), and then git is not asked. It goes into each record's writer, for information only. */
export function commitOf(checkout, { spawn = spawnSync, exists = existsSync } = {}) {
  if (!isGitCheckout(checkout, { exists })) return "unknown";
  return gitCommitOf(checkout, spawn);
}

/** The checkout this code is in: the folder above tool/, where this file is. It is the checkout at work, so it is the one a
    detached run is started from (detached.js), and the one whose commit (commitOf) a record or a hand-off names as the brimm-video
    that wrote it. The checkout this Mac's settings name is not: it is where its launch agent and her folder's commands run from,
    and a Mac that brimm-video set up names brimm-video's. */
export const thisCheckout = () => dirname(dirname(fileURLToPath(import.meta.url)));

/** File a video that has been worked on into its episode, in Episodes under BRIMM Video. `file` is the raw video in the drop
    folder; `made` are the files made of it, each where it belongs, and `at(to)` where its whole copy is in the run's own
    folder `work`; `facts` and `printed` are what ffprobe said; `kind` is the episode's kind; `read` and `reels` are null and [] for every
    caller now (the import asks Claude nothing, and makes no Reel candidates). A made file goes into the episode folder
    where it sits beside the video, "Talk.srt", and a folder it needs there is made. `deps` gives `episode` ({ root, machine, checkout, home }), and `clone`, `sameDisk`, `log`,
    `today`, `now`, `commit` and `rand` when a test gives others. A video the facts say has no sound (`facts.sound` is false; PR H5a)
    is filed with `video.sound` false in its record, and nothing else made of it (`made` is empty).
    The import (the light import, spec 2026-10-22, section 1) gives no Final Cut file, so no edit/ folder is made, and `kind` null, with
    `answer` (her answer, waiting, with the guess and the episode whose words it matched, or null), `label` and
    `fingerprint`, which go into the record as they are (newEpisode). An import never sets `versionOf`: her answer does.
    The folder is made, or the one a stopped import left is used again; the raw video is cloned in from the drop folder; each
    file is cloned in from the run's folder; and the first record is written last, by the rule, its work copy kept. Gives
    back { name, path, record, entries }, where `entries` are the late check's: { from, to, bytes } for every file put in,
    the record's among them. Throws, saying why, when a file cannot be put in: then no record is written, and the next run
    uses the folder again.
    `into` (PR H5b) files the video into an episode that is there already, not a new one: the plan the join makes a video of.
    { folder, record, change }: `folder` is the episode's own folder, `record` the record it was read at, and `change(first)`
    gives the record to write, from the record this call would have written for a new episode (`first`, which has the video,
    the files put in, the kind and the fingerprint), as the plan's record written once more as the video. That record is
    written as the episode's next one, by the rule, with the rev the episode was read at (`record.rev`), so that a record
    written meanwhile is never written over (CHANGED), and `first` takes the episode's own id. `change` is called last,
    after every file is put in, and may throw to stop it. A record it gives that has a kind and a video with no sound
    (`video.sound` false) is refused too, whoever the caller is: a video with no sound takes no kind. Files go in by clones and
    never over a file: one of the names is there already, and the call throws. And when it throws, for that or for a record that
    cannot be written, every file this call put in is taken away again, so that the episode is as it was. `file` and `made` are
    then wherever the call's caller made them, and there is no drop folder: `dropFile` is not asked.
    On a Mac with a drop folder of its own (`deps.episode.local`, and not `into`) the video is filed on this Mac, with only the first record in
    Dropbox, and the drop file is deleted once that record is written (fileLocal); `deps.onRecordCopy` is told of the record's work copy. */
export function fileEpisode({ file, made, at, facts, printed, kind, read, reels = [], work, dropFile, answer = null, label = "", fingerprint = "", into = null }, deps) {
  const { episode, log = () => {} } = deps;
  // The video in the drop folder must still be the one that was worked on: one put in its place meanwhile, as a corrected
  // export, is another recording, and is never filed with this one's transcript and cuts.
  if (!sameFile(file, dropFile)) throw Object.assign(new Error(`${basename(file)} changed in the drop folder while it was imported`), { code: "DROP_CHANGED" });
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  // A Mac with a drop folder of its own files the video on this Mac, with only the first record in Dropbox.
  if (episode.local && !into) return fileLocal({ file, made, at, facts, printed, kind, read, reels, work, dropFile, answer, label, fingerprint }, deps);
  // A video made for a plan kept on this Mac (the join's, or a HeyGen voice) is filed into the plan's video/ here, with only its record in Dropbox.
  if (into && into.local) return fileIntoPlanHere({ file, made, at, facts, printed, kind, work, fingerprint, into }, deps);
  const video = basename(file);
  const bytes = statSync(file).size;
  const day = deps.today ? deps.today() : localDay();
  const episodes = episodesFolder(episode.root);
  mkdirSync(episodes, { recursive: true });
  const found = into ? { name: basename(into.folder), reused: false } : findFolder(episodes, { video, bytes, machine: episode.machine, day });
  const path = into ? into.folder : join(episodes, found.name);
  // A stopped import may have left a record that is not whole. It is no one's record, and the first one is written anew. A whole record is
  // never taken away, whoever asks.
  if (found.reused) {
    if (statSync(path, { throwIfNoEntry: false }) && readEpisode(path).code !== "NONE") throw new Error(`${found.name} has a record already, and a record is never written over`);
    rmSync(join(path, RECORD_DIR), { recursive: true, force: true });
  }
  const entries = [];
  const files = {};
  // What this call put into an episode that was there before it, to take away again if it cannot finish.
  const placed = [];
  const put = (from, rel) => {
    const to = join(path, rel);
    mkdirSync(dirname(to), { recursive: true });
    (found.reused ? replaceIn : cloneIn)(from, to, opts);
    if (into) placed.push(to);
    entries.push({ from, to, bytes: statSync(from).size });
    files[rel] = statSync(from).size;
  };
  const writer = { commit: deps.commit || commitOf(episode.checkout), on: episode.machine };
  const write = textWriter({ work: join(work, "record"), keep: true, ...opts });
  const title = read && typeof read.title === "string" && read.title.trim() ? { text: read.title.trim(), from: "claude", approved: false } : null;
  let record;
  try {
    put(file, video);
    for (const to of made) put(at(to), relative(dirname(file), to).split(sep).join("/"));
    const first = newEpisode({
      id: into ? into.record.id : newId(day, deps.rand),
      machine: episode.machine,
      at: localStamp(deps.now ? deps.now() : new Date()),
      video: { file: video, bytes, seconds: facts.duration, created: createdOf(printed), ...(facts.sound === false ? { sound: false } : {}) },
      kind,
      writer,
      files,
      title,
      reels,
      answer,
      label,
      fingerprint
    });
    const next = into ? into.change(first) : first;
    // A video with no sound takes no kind (PR H5b, ruling 5), and no caller of `into` may give it one: it is refused here, before the record is written,
    // and the files put in are taken away again. (The record's own judge, episode.js faultFor, is also what reads every record back from disk, and a
    // rule there would make a record already written with a kind and no sound unreadable; so the rule is kept to what is filed into a plan.)
    if (into && next.kind !== null && next.video && next.video.sound === false) throw new Error("a video with no sound takes no kind, so it is not filed as one");
    record = writeEpisode(path, next, { expectRev: into ? into.record.rev : 0, writeText: (to, text) => entries.push(write(to, text)), writer, home: episode.home });
  } catch (e) {
    // An episode that was there before is left as it was: the files this call put in are taken away.
    for (const to of placed) rmSync(to, { force: true });
    throw e;
  }
  // A light import's video is named by its label, and its episode by its id: the folder's name is the file's.
  const reused = found.reused ? ", in the folder an import that stopped had made" : "";
  log(label ? `${label}: filed into Episodes as ${record.id}${reused}.` : `${video}: filed into Episodes as "${found.name}"${reused}.`);
  return { name: found.name, path, record, entries };
}

/** File a video made for a plan kept on this Mac (`into.local`: Phase 3, L4) into the plan's own video/ folder here, with putHere (put-here.js): the video and the
    files made of it are written whole, the plan's record is written last as the video it waits to be (`into.change`, called with the record a new episode
    would have had), with the rev the plan was read at, and nothing else goes into Dropbox. No late check is kept: there is nothing in Dropbox to check. Throws,
    saying why, when it could not be done, with every file taken away again. Gives back { name, path, record, entries }, `entries` being empty. */
function fileIntoPlanHere({ file, made, at, facts, printed, kind, work, fingerprint, into }, deps) {
  const { episode, log = () => {} } = deps;
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const video = basename(file);
  const bytes = statSync(file).size;
  const list = [{ rel: video, from: file }, ...made.map((to) => ({ rel: relative(dirname(file), to).split(sep).join("/"), from: at(to) }))];
  const files = Object.fromEntries(list.map(({ rel, from }) => [rel, statSync(from).size]));
  const writer = { commit: deps.commit || commitOf(episode.checkout), on: episode.machine };
  const first = newEpisode({
    id: into.record.id,
    machine: episode.machine,
    at: localStamp(deps.now ? deps.now() : new Date()),
    video: { file: video, bytes, seconds: facts.duration, created: createdOf(printed), ...(facts.sound === false ? { sound: false } : {}) },
    kind,
    writer,
    files,
    fingerprint
  });
  const next = into.change(first);
  // A video with no sound takes no kind (PR H5b, ruling 5), and no caller of `into` may give it one.
  if (next.kind !== null && next.video && next.video.sound === false) throw new Error("a video with no sound takes no kind, so it is not filed as one");
  const put = putHereNow({ folder: into.folder, record: into.record }, list, { ...opts, home: episode.home, work: join(work, "record"), writer, change: (record) => ({ ...next, files: { ...record.files, ...next.files } }), expectRev: into.record.rev, now: deps.now ? deps.now().getTime() : Date.now() });
  if (!put.put) throw new Error(put.why);
  log(`${shownName(put.record)}: filed into its own folder on this Mac.`);
  return { name: basename(into.folder), path: into.folder, record: put.record, entries: [] };
}

/** Write the file at `from` whole at `to` on this Mac's own disk: copied under a name of its own beside it, looked at (it must be `from`'s size),
    and then renamed into place. `clone` and `sameDisk` are given for the recording: a clone on one disk, a whole copy otherwise. Gives the
    names it made, to take away if the run fails: the file under its own name first, and then at `to`. Throws, saying why, and leaves nothing
    under the name of its own. */
function placeWhole(from, to, wrote, { clone = cloneFile, sameDisk = onSameDisk } = {}) {
  const own = `${to}.${process.pid}.writing`;
  wrote.push(own);
  rmSync(own, { force: true });
  (sameDisk(from, dirname(to)) ? clone : copyFileSync)(from, own);
  const size = statSync(from).size;
  const found = sizeOf(own);
  if (found !== size) throw new Error(`${basename(to)} could not be put into ${dirname(to)}: it is ${found} bytes there, not ${size}`);
  wrote.push(to);
  renameSync(own, to);
}

/** Take away the files a killed run left half-written in `folder` and the folders in it: those whose names end in .writing. */
function clearWriting(folder) {
  let entries = [];
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) clearWriting(join(folder, entry.name));
    else if (entry.name.endsWith(".writing")) rmSync(join(folder, entry.name), { force: true });
  }
}

/** File a video on a Mac with a drop folder of its own (Phase 3, L3), in this order: Episodes is listed (an error but its not being there ends
    the filing), the folder is found (findFolder, by the marker of a run that stopped, else by a name no folder in Episodes or on this Mac has),
    video/ is made in the episode's folder in BRIMM Video Work with its marker, each made file is written there whole, the drop file is checked
    unchanged, the recording is copied in beside them and its size checked, the first record, record/0001.json, is written by the rule, its work
    copy kept (`deps.onRecordCopy({ from, to, bytes })`, if given, is told when that copy is whole and before it is cloned in), and then the drop
    file is deleted, if it is unchanged. Only the first record is in Dropbox. If anything fails before the record, only the files this run
    wrote are taken away, then the marker, then video/ if it is empty, and the drop file stays; the call throws. A drop file that cannot be
    deleted stays, held by its episode, and the log says so. Gives back { name, path, record, entries }, `entries` being the record's alone. */
function fileLocal({ file, made, at, facts, printed, kind, read, reels, work, dropFile, answer, label, fingerprint }, deps) {
  const { episode, log = () => {} } = deps;
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const video = basename(file);
  const bytes = statSync(file).size;
  const day = deps.today ? deps.today() : localDay();
  const episodes = episodesFolder(episode.root);
  mkdirSync(episodes, { recursive: true });
  const found = findFolder(episodes, { video, bytes, machine: episode.machine, day, work: workFolder(episode.home), importId: importIdOf(dropFile), dropId: dropIdOf(dropFile) });
  const path = join(episodes, found.name);
  const own = episodeFilesFolder(episode.home, found.name);
  // A reused folder (a stopped run's) has no record file at all, and none of the episode's work in video/: the first record is written in it. A marked
  // folder with records or work (`held`) is not reused: the drop file waits.
  if (found.held) throw new Error(`${found.name} has records or work already that cannot be read now, so this video waits for a later look`);
  if (found.reused) {
    if (statSync(path, { throwIfNoEntry: false }) && readEpisode(path).code !== "NONE") throw new Error(`${found.name} has a record already, and a record is never written over`);
    rmSync(join(path, RECORD_DIR), { recursive: true, force: true });
  }
  // What this run makes in Dropbox, to take away again, empty, if the record cannot be written.
  const madeFolder = !existsSync(path);
  const madeRecords = !existsSync(join(path, RECORD_DIR));
  const entries = [];
  const files = {};
  // What this run wrote in video/, to take away if it cannot finish, and whether it wrote the marker.
  const wrote = [];
  let marked = false;
  const writer = { commit: deps.commit || commitOf(episode.checkout), on: episode.machine };
  const write = textWriter({ work: join(work, "record"), keep: true, ...(deps.onRecordCopy ? { onCopy: deps.onRecordCopy } : {}), ...opts });
  let record;
  try {
    mkdirSync(own, { recursive: true });
    const mark = join(own, IMPORT_MARK);
    // Writing a killed run left half-way is cleared; the marker a stopped run left is kept if this run fails, as it is not this run's.
    if (found.reused) clearWriting(own);
    marked = !existsSync(mark);
    writeFileSync(`${mark}.${process.pid}.writing`, JSON.stringify({ import: importIdOf(dropFile), drop: dropIdOf(dropFile) }) + "\n");
    renameSync(`${mark}.${process.pid}.writing`, mark);
    for (const to of made) {
      const rel = relative(dirname(file), to).split(sep).join("/");
      mkdirSync(dirname(join(own, rel)), { recursive: true });
      placeWhole(at(to), join(own, rel), wrote, { clone: (a, b) => copyFileSync(a, b), sameDisk: () => true });
      files[rel] = statSync(join(own, rel)).size;
    }
    // The drop file is copied only while it is still the one that was worked on.
    if (!sameFile(file, dropFile)) throw Object.assign(new Error(`${video} changed in the drop folder while it was imported`), { code: "DROP_CHANGED" });
    placeWhole(file, join(own, video), wrote, opts);
    files[video] = statSync(join(own, video)).size;
    const first = newEpisode({
      id: newId(day, deps.rand),
      machine: episode.machine,
      at: localStamp(deps.now ? deps.now() : new Date()),
      video: { file: video, bytes, seconds: facts.duration, created: createdOf(printed), ...(facts.sound === false ? { sound: false } : {}) },
      kind,
      writer,
      files,
      title: read && typeof read.title === "string" && read.title.trim() ? { text: read.title.trim(), from: "claude", approved: false } : null,
      reels,
      answer,
      label,
      fingerprint,
      local: { on: episode.machine }
    });
    record = writeEpisode(path, first, { expectRev: 0, writeText: (to, text) => entries.push(write(to, text)), writer, home: episode.home });
  } catch (e) {
    for (const f of wrote) rmSync(f, { force: true });
    if (marked) rmSync(join(own, IMPORT_MARK), { force: true });
    for (const folder of [own, dirname(own), ...(madeRecords ? [join(path, RECORD_DIR)] : []), ...(madeFolder ? [path] : [])]) {
      try {
        rmdirSync(folder);
      } catch (stays) {
        // It holds something that is not this run's, and is left.
      }
    }
    throw e;
  }
  log(label ? `${label}: filed into Episodes as ${record.id}${found.reused ? ", in the folder an import that stopped had made" : ""}.` : `${video}: filed into Episodes as "${found.name}".`);
  // The record is written: the drop file is deleted, if it is the file that was imported. One that cannot be deleted stays, held by its episode.
  const who = label || video;
  if (!sameFile(file, dropFile)) log(`${who}: the video in the drop folder is another file of that name now, so it is left there.`);
  else {
    try {
      rmSync(file, { force: true });
    } catch (e) {
      log(`${who}: could not be taken out of the drop folder (${e.code || e.message}). Delete it there by hand.`);
    }
  }
  return { name: found.name, path, record, entries };
}

/** The late check still to be made of the episode just filed (`filed`, fileEpisode's), as this Mac keeps it on its own disk until it is made
    (writePending): the episode's id, its folder and name, the video and its size and length, `drop`, the file in the drop folder that the check
    takes away once it has passed, and `dropFile`, what that file was when it was imported (so that another of its name is never taken), the
    import's id, `work`, the run's own folder, which holds the work copies the check puts a file in again from, `planTxt`, the cut plan's text by
    its name, and `label`, the name a status and a notice give it in place of its file's. `deps` gives `episode` ({ root, machine }) and the clock
    (`clock`, in milliseconds), which says when the last file was put in. `drop` is a file that is nobody's but the run's when the video was not
    dropped there (PR H5b: the join makes one, and one of its parts is another episode's own video). */
export function pendingFor(filed, { video, drop, dropFile = null, importId = "", work, planTxt, label = "" }, { episode, clock = Date.now }) {
  return { version: 1, id: filed.record.id, name: filed.name, folder: filed.path, video, bytes: filed.record.video.bytes, seconds: filed.record.video.seconds, drop, dropFile, importId, work, entries: filed.entries, lastCopy: clock(), root: episode.root, machine: episode.machine, planTxt, ...(label ? { label } : {}) };
}

/** The folder this import writes its statuses in: `episode.statuses`, which unedited.js gives from the Mac's settings (settings.js
    importingFolderOf: the Mac's own folder when it has a drop folder of its own), else Episodes/.importing. */
export const statusWriteFolder = (episode) => episode.statuses || importingFolder(episode.root);
/** The folders its statuses are read in: this Mac's own and Episodes/.importing, where another Mac may still write (settings.js
    statusFoldersOf), else Episodes/.importing alone. */
export const statusReadFolders = (episode) => episode.statusFolders || [importingFolder(episode.root)];

/** How often a status is written while a step runs: once a minute, so that one not written for 10 minutes is an import that
    stopped. */
const STATUS_EVERY_MS = 60 * 1000;

/** The progress reporter of an episode's import: it tells `inner`, the progress panel's reporter, everything it is told, and
    also writes the import's status file in Episodes/.importing/ (importing.js): at the start, at each step, and once a minute
    while a step runs, by the timer `every`. `fail(why)` writes the status with why the import failed, and the status is left.
    `end` stops the timer and leaves the status: the late check takes it away. A status that cannot be written costs nothing
    but itself: the log says so once, and the work goes on. A light import gives its video's `label`, which every status
    carries, and which the log names the video by. */
export function statusReporter(inner, { folder, machine, video, bytes, importId = "", label = "", writeText, log = () => {}, pid = process.pid, now = () => Date.now(), every = setInterval, cancel = clearInterval }) {
  const status = { version: 1, machine, pid, ...(importId ? { import: importId } : {}), video, bytes, seconds: null, step: "Waiting to start", ...(label ? { label } : {}) };
  let told = false;
  const write = (more = {}) => {
    try {
      writeStatusIn(folder, { ...status, ...more, at: localStamp(new Date(now())) }, writeText);
    } catch (e) {
      const why = String(e.message).replace(/\.$/, "");
      if (!told) log(`${label || video}: its status could not be written (${label ? withoutNames(why, namesOf(video), [label]) : why}). The work goes on.`);
      told = true;
    }
  };
  let timer = null;
  return {
    begin(name) {
      inner.begin(name);
      write();
      timer = every(() => write(), STATUS_EVERY_MS);
      if (timer && typeof timer.unref === "function") timer.unref();
    },
    length(seconds) {
      inner.length(seconds);
      status.seconds = seconds;
    },
    steps: (names) => inner.steps(names),
    step(name, shown) {
      inner.step(name, shown);
      status.step = name;
      write();
    },
    fraction: (f) => inner.fraction(f),
    encoding: (seconds) => inner.encoding(seconds),
    fail(why) {
      write({ failed: why });
    },
    /** Take this import's status away, as when it stopped because its video changed, or when a Mac with a drop folder of its own has
        filed the video: nothing is then left to check. The timer that writes it stops first, so it is not written again. */
    drop() {
      if (timer !== null) cancel(timer);
      timer = null;
      removeStatusIn(folder, video, machine, importId);
    },
    end(finished) {
      if (timer !== null) cancel(timer);
      timer = null;
      inner.end(finished);
    }
  };
}

/** Why the video `video`, of `bytes` bytes, in this Mac's drop folder is not to be imported now, in plain words: "" when it
    is. An episode in `episodes` whose whole record names this video at this size holds it, and so does a status that holds
    it (holdsVideo): an import running on either Mac, one that failed, one whose late check found a problem, and one that
    says the video is held (a Zoom download, left where it is until the import takes them), which says why.
    The design says a video matches an episode by its size and its length. The size is enough here: this guard runs before
    ffprobe has read the length, the name must match too, and two recordings of one name and one size to the byte are not
    met in practice. Matching the length as well would mean an ffprobe of every video in the drop folder at every run.
    `statusFolders` are the folders its statuses are read in (settings.js statusFoldersOf): this Mac's own and Episodes/.importing, where another Mac
    may still write; Episodes/.importing alone when none is given. */
export function heldBy({ root, statusFolders = [importingFolder(root)], video, bytes, now = Date.now(), gatedAs, local = false }) {
  // A status that failed or found a problem says most, then one that says the video is held, then an episode that holds the
  // video, then an import running. A running import, and a hold, keep only a video of their own size: one dropped again under
  // the same name, as a corrected export, is another recording.
  const own = (status) => !["running", "held"].includes(importState(status, now)) || status.bytes === bytes;
  const held = readStatusesIn(statusFolders, now).filter(({ status }) => status && status.video === video && holdsVideo(status, now) && own(status)).map(({ status }) => status);
  const failed = held.find((status) => importState(status, now) === "failed");
  if (failed) return `its import failed on ${failed.machine}: ${String(failed.failed).replace(/\.$/, "")}. Say "try it again" to import it again.`;
  const problem = held.find((status) => importState(status, now) === "problem");
  if (problem) return `copied in, but Dropbox found a problem with a copy of it: ${String(problem.problem).replace(/\.$/, "")}.`;
  const left = held.find((status) => importState(status, now) === "held");
  if (left) return String(left.held);
  const episode = episodeHolding({ root, video, bytes, gatedAs, local });
  if (episode) return episode;
  if (held.length) return `it is being imported on ${held[0].machine}.`;
  return "";
}

/** The episode that holds the video `video`, of `bytes` bytes, as { name, record }: the first, by its folder's name, one of whose
    records names the video at that size, its record in force or a conflicted copy Dropbox keeps of one, read past the copies as
    edit.js reads an episode the gate holds by any of its records. `record` is the one to name it by: the first of them that the
    gate holds (gate.js gated), else the record in force. null when none does; { unknown: true } when none does, but Episodes
    could not be read, or an episode that could be its, one in a folder either Mac would have named for this video (namedFor),
    could not be read (its folder or its records), or has a record that is not whole yet: what holds the video cannot then be
    told, and it is not to be named by its file, since it may be a session's. An episode named for another video that cannot be
    read changes nothing for this one. */
export function holdingEpisode({ root, video, bytes }) {
  const episodes = episodesFolder(root);
  let names = [];
  try {
    names = readdirSync(episodes).filter((n) => !n.startsWith("."));
  } catch (e) {
    return e.code === "ENOENT" ? null : { unknown: true };
  }
  // A planned episode (PR H4) has no video (`video` is null), so it holds no file and is never the episode a file in a drop folder is in.
  const holds = (r) => r && typeof r === "object" && r.video && r.video.file === video && r.video.bytes === bytes;
  const shaped = (r) => r !== null && typeof r === "object" && typeof r.id === "string" && Number.isInteger(r.version);
  const stem = basename(video, extname(video));
  let unknown = false;
  for (const name of names.sort()) {
    const folder = join(episodes, name);
    const read = readEpisode(folder);
    const past = read.code === "CONFLICTED" ? readEpisode(folder, { pastCopies: true }) : null;
    const inForce = read.record || (past && past.record) || null;
    const records = [inForce, ...(past ? recordCopies(folder) : [])].filter(shaped);
    if (records.some(holds)) return { name, record: records.find(gated) || inForce || records.find(holds) };
    if (!inForce && namedFor(name, stem) && cannotTell(folder, past || read)) unknown = true;
  }
  return unknown ? { unknown: true } : null;
}

/** Whether the episode folder `folder`, of which `read` (readEpisode's) gave no whole record, may hold a record this Mac cannot
    read yet: the folder, or its record folder, cannot be read, or a record file is there that is not whole. A name in Episodes
    that is not a folder, and a folder with no record folder or no record in it, holds none. */
function cannotTell(folder, read) {
  if (read.code === "UNREADABLE") {
    try {
      return statSync(folder).isDirectory();
    } catch (e) {
      return e.code !== "ENOENT";
    }
  }
  try {
    return readdirSync(join(folder, RECORD_DIR)).some((n) => /^\d{4}\.json$/.test(n));
  } catch (e) {
    return !["ENOENT", "ENOTDIR"].includes(e.code);
  }
}

/** Why an episode holds the video `video`, of `bytes` bytes, in plain words: its whole record names the video at that size
    (holdingEpisode). "" when none does. The episode is named by its folder, but a video not yet answered, or a session, by its
    label and short id (shownName): its folder holds the file's name, which may be a client's. `gatedAs` gives the name of a
    record named so ("" for one named by its folder): edit.js gives one that names a video held as a session so too. */
export function episodeHolding({ root, video, bytes, gatedAs = (record) => (gated(record) ? shownName(record) : ""), local = false }) {
  const held = holdingEpisode({ root, video, bytes });
  if (!held || held.unknown) return "";
  const as = gatedAs(held.record);
  const stays = held.record.local || local ? "It stays in the drop folder for you to delete." : "It stays in the drop folder until Dropbox's check of its copies passes, or for a person to delete.";
  return `already imported as ${as ? withShortId(as, held.record) : held.name}. ${stays}`;
}

/** Take away the status files this Mac's runs left when they stopped before they were done: a status of this Mac, `machine`,
    with nothing failed, no problem and no hold, that has gone unwritten for 10 minutes, or whose run is no longer running
    (one run at a time works a drop folder, so a run of this Mac that is not this one and not running has stopped). Gives
    back the videos whose status was taken away, to be imported again. A video held is no import that stopped: its status
    stays, and is taken away when the video is no longer held (releaseHeld). Each is taken away in the folder it is in (`statusFolders`, as heldBy's). */
export function clearCrashes({ statusFolders, machine, now = Date.now(), alive = isRunning, pid = process.pid }) {
  const cleared = [];
  for (const { status, folder } of readStatusesIn(statusFolders, now)) {
    if (!status || status.machine !== machine || status.failed || status.problem || status.held) continue;
    const gone = status.pid !== pid && !alive(status.pid);
    if (!gone && !leftByCrash(status, now, machine)) continue;
    removeStatusIn(folder, status.video, machine, status.import || "");
    cleared.push(status.video);
  }
  return cleared;
}

/** The late check a Mac has still to make of an episode's import, kept on its own disk until it is made, so that a run that
    is stopped first leaves it for the next: { version: 1, id, name, folder, video, bytes, seconds, drop, work, entries,
    lastCopy, root, machine, planTxt, label?, problem? }. `entries` are the late check's (dropbox.js); `work` is the run's own
    folder, which holds their work copies; `drop` is the raw video in the drop folder; `lastCopy` is when the last file was put
    into Dropbox, in milliseconds; `planTxt` is the cut plan's text file, by its name. `label` is there for a light import: the
    video's label, which its banner names it by. `problem` is there once a late check found a file still wrong. */
const pendingFile = (home, id) => join(pendingFolder(home), `${id}.json`);

/** The kinds of pending a Mac keeps besides the import's own (no `kind`): each in a folder of its own under pending/. `record` is a
    local import's first record, `final` a finish's copies in final/ (one per revision), `original` L6's. */
export const PENDING_KINDS = ["record", "final", "original"];

/** A pending's key: its file's path from pendingFolder. */
export const pendingKeyOf = (pending) => (!pending.kind ? `${pending.id}.json` : pending.kind === "final" ? `final/${pending.id}-${pending.revision}.json` : `${pending.kind}/${pending.id}.json`);

/** Keep a pending still to be made, written whole on this Mac's own disk, under another name and then renamed. Throws when it cannot. */
export function writePending(home, pending) {
  const file = join(pendingFolder(home), pendingKeyOf(pending));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.writing`, JSON.stringify(pending, null, 2) + "\n");
  renameSync(`${file}.writing`, file);
}

/** The pending in the file `key` (pendingKeyOf), when it reads whole, is version 1, has an entries list and a finite lastCopy, and its own key is `key`. */
export function readPendingAt(home, key) {
  try {
    const pending = JSON.parse(readFileSync(join(pendingFolder(home), key), "utf8"));
    if (pending && pending.version === 1 && Array.isArray(pending.entries) && Number.isFinite(pending.lastCopy) && pendingKeyOf(pending) === key) return pending;
  } catch (e) {
    // It is not there, or half written.
  }
  return null;
}

/** The pendings of one kind, oldest first. A folder that cannot be read gives []. */
export function readPendingsOf(home, kind) {
  let names = [];
  try {
    names = readdirSync(join(pendingFolder(home), kind)).filter((n) => n.endsWith(".json"));
  } catch (e) {
    return [];
  }
  const read = [];
  for (const name of names) {
    const pending = readPendingAt(home, `${kind}/${name}`);
    if (!pending || pending.kind !== kind || typeof pending.id !== "string") continue;
    if (kind === "final" && !(Number.isInteger(pending.revision) && Number.isInteger(pending.rev))) continue;
    read.push(pending);
  }
  return read.sort((a, b) => a.lastCopy - b.lastCopy);
}

/** Every pending of this Mac, the import's and each kind's, oldest first. */
export const readEveryPending = (home) => [...readPendings(home), ...PENDING_KINDS.flatMap((kind) => readPendingsOf(home, kind))].sort((a, b) => a.lastCopy - b.lastCopy);

/** Take a pending away. */
export const removePending = (home, pending) => rmSync(join(pendingFolder(home), pendingKeyOf(pending)), { force: true });

/** The late checks this Mac has still to make, oldest first: the import's own (no kind) alone. One that cannot be read is left out. */
export function readPendings(home) {
  let names = [];
  try {
    names = readdirSync(pendingFolder(home)).filter((n) => n.endsWith(".json"));
  } catch (e) {
    return [];
  }
  const read = [];
  for (const name of names) {
    try {
      const pending = JSON.parse(readFileSync(join(pendingFolder(home), name), "utf8"));
      if (pending && pending.version === 1 && Array.isArray(pending.entries) && Number.isFinite(pending.lastCopy)) read.push(pending);
    } catch (e) {
      // It is half written, and its run wrote it again or is gone.
    }
  }
  return read.sort((a, b) => a.lastCopy - b.lastCopy);
}

/** What tells one file from another of the same name: its inode, its size and when it was last written. */
export const fileId = (path) => {
  const found = statSync(path, { throwIfNoEntry: false });
  return found ? { ino: found.ino, size: found.size, mtimeMs: found.mtimeMs } : null;
};

/** Whether the file at `path` is still the one `id` was taken of: by each of its inode, size and time that `id` holds. With no
    id, as of a late check written before ids were kept, it counts as the same. */
export const sameFile = (path, id) => {
  if (!id) return true;
  const now = fileId(path);
  return Boolean(now) && ["ino", "size", "mtimeMs"].every((k) => id[k] === undefined || now[k] === id[k]);
};

/** The short id of an import, which keeps two imports of one name apart in their status files: the inode of the video it
    took, in base 36. */
export const importIdOf = (id) => (id ? Number(id.ino).toString(36) : "");

/** What tells the file an import took from the drop folder from any other of its name, in full: its inode, size and time. With the import's
    short id (importIdOf) it is what a local import's marker, video/.import.json, holds, so that a run stopped part-way finds its folder. */
export const dropIdOf = (id) => (id ? `${id.ino}:${id.size}:${id.mtimeMs}` : "");

/** When a pending is due, in milliseconds: the later of its own due and its `nextLook`, which only ever makes a look later. An import's
    (no kind) is LATE_CHECK_MS after its last copy; one with `owed` (L6's move) is due at its lastCopy; any other is LATE_CHECK_MS after the later of its
    last copy and `woke`, when the Mac last woke or started (ruling 33). */
export const dueAt = (pending, woke = null) => {
  const base = pending.owed === true ? pending.lastCopy : pending.kind ? Math.max(pending.lastCopy, Number.isFinite(woke) ? woke : -Infinity) + LATE_CHECK_MS : pending.lastCopy + LATE_CHECK_MS;
  return Math.max(base, Number.isFinite(pending.nextLook) ? pending.nextLook : -Infinity);
};

/** The later of when this Mac last woke from sleep and when it last started, in milliseconds, or null when neither can be read (kern.waketime and kern.boottime). */
export function lastWake({ run = spawnSync } = {}) {
  const times = [];
  for (const name of ["kern.waketime", "kern.boottime"]) {
    try {
      const ran = run("/usr/sbin/sysctl", ["-n", name], { encoding: "utf8" });
      const sec = ran && ran.status === 0 ? /sec = (\d+)/.exec(String(ran.stdout)) : null;
      if (sec) times.push(Number(sec[1]) * 1000);
    } catch (e) {
      // It cannot be read.
    }
  }
  return times.length ? Math.max(...times) : null;
}

/** Whether a pending's hour of looks is gone. */
export const pastLookUntil = (pending, now) => Number.isFinite(pending.lookUntil) && now > pending.lookUntil;

/** Whether a pending is one the loop waits for: no problem found, and its hour of looks not gone. */
export const isOpen = (pending, now) => !pending.problem && !pastLookUntil(pending, now);

/** How soon a check that waits looks again in the run, and for how long a run goes on looking (ruling 36). */
export const WAIT_LOOK_MS = 5 * 60 * 1000;
export const WAIT_LOOK_FOR_MS = 60 * 60 * 1000;

/** Append a line to the tool's log, as edit.js toolLog does; a throw is passed over. */
export const logTo = (home) => (line) => {
  try {
    const file = join(home, "Library", "Logs", "brimm-video.log");
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${line}\n`);
  } catch (e) {
    // The log costs nothing but itself.
  }
};

/** Ask the launch agent to run when it is not running, so a check that was just left is made within a minute. A throw is logged, named `shown`, and nothing else happens. */
export function askAgent(ctx, shown) {
  try {
    if (!ctx.agentRunning()) ctx.kickstart();
  } catch (e) {
    logTo(ctx.home)(`${shown}: the launch agent could not be asked to make the check of its copies (${e.code || "an error"}). It is made when the Mac's import next runs.`);
  }
}

/** How long the wait for late checks waits before it looks again, when it put a check off because a reading held its lock (plan R1c). */
export const LOCK_AGAIN_MS = 10 * 1000;

/** How long after her yes to a finish its run may not hold the episode's lock yet: node loads, and findEpisode runs (ruling 14). */
export const FINISH_START_MS = 60 * 1000;

/** Whether a finish is at work on the episode `name`: a live finish run holds its lock, or her yes was given less than FINISH_START_MS ago and the run it started has not ended. */
export function finishAtWork(home, name, alive, now) {
  if (runningCommand(home, name, alive) === "finish") return true;
  const at = askedAt(home, name);
  return at !== null && now - at >= 0 && now - at < FINISH_START_MS && endedSinceYes(home, name) === null;
}

/** The checks of the kinds of pending: each is called under the episode's late-check lock, with the pending read again, and gives back nothing. */
export const CHECKS = {};

/** The lock of an episode's late check, on this Mac's own disk: beside the episode's own lock, in its folder in BRIMM Video Work. The
    import's check takes it for as long as it looks at the episode's files, and a reading takes it for as long as it puts its files in
    and takes them out of the check (late-wait.js keepCheckInStep), so that the check never puts an older file back over the reading's.
    `name` is the pending check's `name`, the episode's folder. */
export const lateCheckLockOf = (home, name) => join(episodeWork(home, name), "late-check.lock");

/** Take the late check's lock of the episode `name` for `command` ("late check" or "read"): { file, text } to give back to
    `releaseLateCheckLock`, or null while a live run holds it, or another run is taking it over from a dead one. A lock a dead run left
    is taken over (detached.js takeEpisodeLock). Throws when the folder or the lock cannot be made: that is an error of the check, as a
    file that cannot be looked at is. */
export function takeLateCheckLock(home, name, command, alive) {
  mkdirSync(episodeWork(home, name), { recursive: true });
  const file = lateCheckLockOf(home, name);
  const took = takeEpisodeLock(file, command, alive);
  return took.taken ? { file, text: took.text } : null;
}

/** Let a late check's lock go, when it is still the one `held` took (detached.js releaseEpisodeLock). */
export const releaseLateCheckLock = (held) => releaseEpisodeLock(held.file, held.text);

/** Settle the mark a reading left on a pending late check, under the check's lock (plan R1c): a reading that stopped while it put its
    files in. `pending` is read fresh. With no mark it comes back as it is: { pending }. With one, the record in force says which files
    are the reading's: an entry the mark names whose file the record lists at any other size than the entry's bytes is the reading's, and
    is left out of the check; every other entry is kept (one the mark names that the record still lists at the entry's bytes too), so
    the import's file is put back when the reading's put did not get as far as its record. The pending is written whole
    without the mark. { later: true } when no record can be trusted to say (none that reads, one a newer brimm-video wrote, or a record
    file above it still coming): nothing is written then, and the check waits for the next run. */
export function settleReading(pending, { home, log = () => {} }) {
  if (!pending.reading) return { pending };
  const rev = pending.reading.rev;
  const withRev = Number.isInteger(rev);
  // A mark with a rev reads the record in force past conflicted copies, unless one is of a file in record/ (ruling 20).
  const pastCopies = withRev && !conflictedCopies(pending.folder).some((path) => /^record\/\d{4}\.json$/.test(conflictedOf(path)));
  const read = readEpisode(pending.folder, pastCopies ? { pastCopies: true } : {});
  if (!read.record || read.newer || (recordNumbers(pending.folder)[0] || 0) > read.record.rev) return { later: true };
  const marked = new Set(Array.isArray(pending.reading.to) ? pending.reading.to : []);
  const listed = read.record.files || {};
  // A mark with a rev: a marked entry stays only while the record lists its file at the entry's bytes, no record numbered `rev` or above is in
  // the folder, and this Mac has not noted writing `rev`: the writer's record was written, even if Dropbox has lost it since. A mark with no rev
  // (a reading's) is settled by sizes alone.
  const written = withRev ? recordNumbers(pending.folder).some((n) => n >= rev) || lastWritten(home, pending.id) >= rev : false;
  const stays = (e) => !marked.has(e.to) || (listed[relative(pending.folder, e.to).split(sep).join("/")] === e.bytes && !written);
  const { reading, ...rest } = pending;
  const next = { ...rest, entries: pending.entries.filter(stays) };
  const left = pending.entries.length - next.entries.length;
  writePending(home, next);
  log(pending.kind ? `${pending.label || `an episode (${String(pending.id).slice(-6)})`}: a write stopped while it put its files in. Its check leaves out ${left} file${left === 1 ? "" : "s"} the record says ${left === 1 ? "is" : "are"} that write's.` : `${pending.label || pending.video}: a reading stopped while it put its files in. Its late check leaves out ${left} file${left === 1 ? "" : "s"} the record says ${left === 1 ? "is" : "are"} the reading's.`);
  return { pending: next };
}

/** How a writer looks again for the lock of an episode's check while the check holds it, and for how long in all. */
export const LOCK_LOOK_MS = 1000;
export const LOCK_WAIT_MS = 2 * 60 * 1000;

/** The sentence a writer says when it could not go on: "held" (the check kept its lock), "unsettled" (an earlier write's mark cannot be settled), "restored" (a
    copy it built on was put back, or changed) and "lost" (one could not be put back). `shown` names the episode; `done` is what was not done, `again` how to ask. */
export function busyWords(busy, shown, { done, again }) {
  // With no name (null), the words name no video and no folder: a video becoming a session is spoken of by neither.
  if (shown === null) {
    if (busy === "unsettled") return `A change stopped half way, and its record cannot be read now to sort it out, so ${done}. Ask Jason.`;
    if (busy === "restored") return `A copy in Dropbox was not whole, so it is put back, and ${done}. ${again}`;
    if (busy === "lost") return `A copy in Dropbox is not whole, and it could not be put back, so ${done}. Ask Jason.`;
    return `Studio was still checking Dropbox's copies after two minutes, so ${done}. ${again}`;
  }
  if (busy === "unsettled") return `A change to ${shown} stopped half way, and its record cannot be read now to sort it out, so ${done}. Ask Jason.`;
  if (busy === "restored") return `A copy of ${shown} in final/ was not whole in Dropbox, so it is put back, and ${done}. ${again}`;
  if (busy === "lost") return `A copy of ${shown} in final/ is not whole in Dropbox, and it could not be put back, so ${done}. Ask Jason.`;
  return `Studio was still checking Dropbox's copies of ${shown} after two minutes, so ${done}. ${again}`;
}

const relOf = (folder, to) => relative(folder, to).split(sep).join("/");

/** Whether a finish's record reached Dropbox, by the record file it wrote (ruling 11): true when it is there, or a later record of its revision is; false when the record at its
    number is another writer's, or none is there; null when that cannot be told (a file cut short or unreadable). */
export function recordHolds(pending, { isWhole: whole = isWhole } = {}) {
  const rec = pending.record;
  if (!rec || typeof rec.to !== "string") return null;
  let st;
  try {
    st = statSync(rec.to, { throwIfNoEntry: false });
  } catch (e) {
    return null;
  }
  const ofRevision = (r) => r && r.id === pending.id && r.finished && r.finished.revision === pending.revision;
  if (st) {
    if (!whole(rec.to)) return null;
    if (existsSync(rec.from) && sameBytes(rec.to, rec.from)) return true;
    let read;
    try {
      read = JSON.parse(readFileSync(rec.to, "utf8"));
    } catch (e) {
      return null;
    }
    if (!existsSync(rec.from) && read && read.rev === pending.rev && ofRevision(read)) return true;
    return false;
  }
  const folder = dirname(dirname(rec.to));
  try {
    readdirSync(dirname(rec.to));
  } catch (e) {
    return e.code === "ENOENT" ? false : null;
  }
  let unreadable = false;
  for (const n of recordNumbers(folder).filter((n) => n > pending.rev)) {
    try {
      if (ofRevision(JSON.parse(readFileSync(recordFile(folder, n), "utf8")))) return true;
    } catch (e) {
      unreadable = true;
    }
  }
  return unreadable ? null : false;
}

/** Table J (algorithm C, step 7): how a copy of `e` in final/ stands against `listed`, the files the record in force lists. { left: true } when the record lists it at other
    bytes, { put: <what> } when it is to be put back, else {} (whole). */
export function judgeEntry(e, folder, listed, whole) {
  if (listed[relOf(folder, e.to)] !== e.bytes) return { left: true };
  const st = statSync(e.to, { throwIfNoEntry: false });
  if (!st) return { put: "it is not there" };
  if (st.size !== e.bytes) return { put: `it is ${st.size} bytes there, not ${e.bytes}` };
  if (!whole(e.to)) return {};
  if (!existsSync(e.from)) return {};
  return sameBytes(e.to, e.from) ? {} : { put: "its bytes are not the ones written" };
}

/** Put a copy back from its work copy on this Mac: "" when it is, else the problem, in plain words with no path. */
export function putEntryBack(e, what, { opts, log, shown }) {
  const file = basename(e.to);
  if (!existsSync(e.from)) return `${file} in final/ is not whole in Dropbox (${what}), and its copy on this Mac is gone, so it could not be put back.`;
  try {
    mkdirSync(dirname(e.to), { recursive: true });
    if (existsSync(e.to)) replaceIn(e.from, e.to, opts);
    else cloneIn(e.from, e.to, opts);
    log(`${shown}: ${file} in final/ was not whole in Dropbox (${what}), so it is put back from its copy on this Mac.`);
    return "";
  } catch (err) {
    return `${file} in final/ could not be put back in Dropbox (${err.code || "an error"}).`;
  }
}

/** Take the files a writer is about to put in or take out of final/ out of this Mac's own checks of the episode, under the lock the check also takes (plan R1c), so that
    the check never puts an older file back over the writer's. Resolves:
    - for a record without `local`, as keepCheckInStep always has: { none: true }, { why } or { end };
    - for a record with `local`: { end } with `late-check.lock` held, or { busy: "held" | "unsettled" | "restored" | "lost" } with no lock held and no mark written.
    `end({ put })` is to be called once. `reads` are the files the writer read to build its own, `{ path, id }`, `id` the fileId it took before reading, or null (ruling 34). */
export async function takeOutOfCheck(ctx, { name, record, paths, reads = [], rev }, { wait, log = () => {}, problemWhy = () => "" }) {
  const same = (p) => p.id === record.id && p.machine === ctx.machine && resolve(String(p.root)) === resolve(ctx.root);
  // Both sides are spelled by two sources (the writer's folder, the pending's own), so they are compared resolved and in NFC.
  const spelled = (path) => resolve(String(path)).normalize("NFC");
  const wanted = new Set(paths.map(spelled));
  const shown = shownName(record);
  if (!keptOnAMac(record)) {
    const among = (p) => p.entries.filter((e) => e && wanted.has(spelled(e.to))).map((e) => e.to);
    const first = readPendings(ctx.home).find(same);
    if (!first || !among(first).length) return { none: true };
    let held = null;
    for (let waited = 0; ; waited += LOCK_LOOK_MS) {
      held = takeLateCheckLock(ctx.home, name, "read", ctx.alive);
      if (held) break;
      if (waited >= LOCK_WAIT_MS) return { why: `The import was still checking its copies of ${shown} in Dropbox after two minutes, so nothing Claude read was put in.` };
      await wait(LOCK_LOOK_MS);
    }
    let to = [];
    let marked = false;
    try {
      // Under the lock the pending is read again: the check may have been made, or found a problem, while the lock was waited for.
      let fresh = readPendings(ctx.home).find(same);
      if (!fresh) return { none: true };
      if (fresh.problem) return { why: problemWhy(record) || `Dropbox found a problem with a copy of this episode: ${String(fresh.problem).replace(/\.$/, "")}.` };
      // A mark an earlier reading left (it stopped while it put its files in) is settled first, by the record, as the check settles it.
      if (fresh.reading) {
        const settled = settleReading(fresh, { home: ctx.home, log });
        if (settled.later) return { why: `The import's check of its copies of ${shown} in Dropbox is not settled yet, so nothing Claude read was put in.` };
        fresh = settled.pending;
      }
      to = among(fresh);
      if (!to.length) return { none: true };
      writePending(ctx.home, { ...fresh, reading: { pid: process.pid, at: ctx.now(), to } });
      marked = true;
    } finally {
      if (!marked) releaseLateCheckLock(held);
    }
    let ended = false;
    const end = ({ put }) => {
      if (ended) return { reopened: false };
      ended = true;
      try {
        const now = readPendings(ctx.home).find(same);
        if (now) {
          const { reading, ...rest } = now;
          writePending(ctx.home, put ? { ...rest, entries: now.entries.filter((e) => !to.includes(e.to)) } : rest);
        }
      } catch (e) {
        log(`The import's late check could not be kept in step with the reading (${e.code || "an error"}). It settles the reading's files at its next look.`);
      } finally {
        releaseLateCheckLock(held);
      }
      return { reopened: false };
    };
    return { end };
  }
  // A record kept on this Mac: algorithm D.
  let held = null;
  for (let waited = 0; ; waited += LOCK_LOOK_MS) {
    held = takeLateCheckLock(ctx.home, name, "write", ctx.alive);
    if (held) break;
    if (waited >= LOCK_WAIT_MS) return { busy: "held" };
    await wait(LOCK_LOOK_MS);
  }
  let marksWritten = false;
  const marks = [];
  const nonce = randomUUID();
  try {
    for (const p of readEveryPending(ctx.home).filter((x) => same(x) && x.reading)) {
      if (settleReading(p, { home: ctx.home, log }).later) return { busy: "unsettled" };
    }
    const opts = ruleOpts({ ...ctx.deps, log });
    const readPaths = new Set(reads.map((r) => spelled(r.path)));
    let changed = false;
    let lost = false;
    let putBack = false;
    for (const r of reads) {
      if (!r.id) continue;
      const now = fileId(r.path);
      if (!now || now.ino !== r.id.ino || now.size !== r.id.size || now.mtimeMs !== r.id.mtimeMs) changed = true;
    }
    const listed = record.files || {};
    for (const p of readPendingsOf(ctx.home, "final").filter(same)) {
      if (!(p.copied === true || recordHolds(p, { isWhole: ctx.isWhole }) === true)) continue;
      for (const e of p.entries) {
        if (!e || !readPaths.has(spelled(e.to))) continue;
        const judged = judgeEntry(e, p.folder, listed, ctx.isWhole);
        if (!judged.put) continue;
        if (putEntryBack(e, judged.put, { opts, log, shown }) === "") putBack = true;
        else lost = true;
      }
    }
    if (lost) return { busy: "lost" };
    if (putBack || changed) return { busy: "restored" };
    for (const p of readEveryPending(ctx.home).filter(same)) {
      const to = p.entries.filter((e) => e && wanted.has(spelled(e.to))).map((e) => e.to);
      if (!to.length) continue;
      try {
        writePending(ctx.home, { ...p, reading: { pid: process.pid, at: ctx.now(), to: [...to], nonce, rev } });
      } catch (e) {
        throw Object.assign(new Error("the check of its copies could not be kept in step on this Mac"), { code: e.code });
      }
      marks.push({ key: pendingKeyOf(p), to });
    }
    marksWritten = true;
  } finally {
    if (!marksWritten) releaseLateCheckLock(held);
  }
  let ended = false;
  const end = ({ put }) => {
    if (ended) return { reopened: false };
    ended = true;
    let reopened = false;
    try {
      for (const m of marks) {
        const now = readPendingAt(ctx.home, m.key);
        if (!now || !now.reading || now.reading.nonce !== nonce) continue;
        const { reading, ...rest } = now;
        let next = rest;
        let reopening = false;
        if (put) {
          next = { ...rest, entries: now.entries.filter((e) => !m.to.includes(e.to)) };
          if (now.problem && next.entries.length < now.entries.length) {
            const { problem, lookUntil, nextLook, ...clear } = next;
            next = { ...clear, wasProblem: problem, told: ctx.now() };
            reopening = true;
          }
        }
        try {
          writePending(ctx.home, next);
          if (reopening) reopened = true;
        } catch (e) {
          log(`${shown}: a write could not take its files out of an earlier check (${e.code || "an error"}). That check settles them by the record.`);
        }
      }
    } finally {
      releaseLateCheckLock(held);
    }
    return { reopened };
  };
  return { end };
}

/** Put back the files a writer is about to read, or stand on, that Dropbox lost or left short (ruling 34): "" when none needs it (or no held pending holds it), "held"
    "unsettled" "restored" "lost" as takeOutOfCheck says. For a record without `local`, "" at once. `rels` are paths from `folder`. */
export async function restoreReads(ctx, { name, record, folder, rels, rev }, { wait, log = () => {} }) {
  if (!keptOnAMac(record)) return "";
  const listed = record.files || {};
  const doubtful = rels.filter((rel) => {
    if (!(rel in listed)) return false;
    const st = statSync(join(folder, rel), { throwIfNoEntry: false });
    return !st || st.size !== listed[rel];
  });
  if (!doubtful.length) return "";
  const step = await takeOutOfCheck(ctx, { name, record, paths: [], reads: doubtful.map((rel) => ({ path: join(folder, rel), id: null })), rev }, { wait, log });
  if (step.busy) return step.busy;
  if (step.end) step.end({ put: false });
  return "";
}

/** The notice of a first record that cannot be put back. */
export const RECORD_LOST = (label) => `Dropbox lost a file of ${label}, and it could not be put back. Ask Jason.`;

/** The one line, posted and logged, of a check that puts its pending away because its episode's folder is gone from Episodes (ruling 16). */
export const FOLDER_GONE = (who) => `The folder of ${who} is gone from Episodes, so the check of its copies in Dropbox is not made. Ask Jason.`;

/** The name a check's lines give a pending: a record pending's import label, any other by its short id. */
const whoOf = (p) => p.label || `an episode (${String(p.id).slice(-6)})`;

/** Make the check of a local import's first record (algorithm B), under the episode's late-check lock, with the pending read again: the first record is put back
    when Dropbox lost it, and only then. Synchronous. */
export function checkRecord(p, deps) {
  const home = deps.episode.home;
  const e = p.entries[0];
  const who = whoOf(p);
  const clock = deps.clock;
  const log = deps.log || (() => {});
  const once = deps.once || log;
  const opts = ruleOpts({ ...deps, log });
  const whole = deps.isWhole || isWhole;
  const putAway = () => {
    try {
      removePending(home, p);
      if (typeof p.work === "string") rmSync(p.work, { recursive: true, force: true });
      return true;
    } catch (err) {
      once(`${who}: its check is made, but it could not be put away (${err.code || "an error"}). The next run looks at it again.`);
      return false;
    }
  };
  const goneAway = () => {
    if (!putAway()) return;
    log(FOLDER_GONE(who));
    (deps.notify || (() => {}))(FOLDER_GONE(who));
  };
  const wait = (line) => {
    writePending(home, { ...p, nextLook: clock() + WAIT_LOOK_MS, lookUntil: Number.isFinite(p.lookUntil) ? p.lookUntil : clock() + WAIT_LOOK_FOR_MS });
    once(line);
  };
  const cannotTell = () => wait(`${who}: its check waits: its folder in Episodes cannot be read now. It is looked at again later.`);
  // 0. Its record never reached Dropbox, whatever became of its folder: it is put away before the folder is looked at.
  if (p.copied !== true && lastWritten(home, p.id) < 1) {
    let there = true;
    try {
      there = Boolean(statSync(e.to, { throwIfNoEntry: false }));
    } catch (err) {
      there = true;
    }
    if (!there) {
      if (putAway()) log(`${who}: its import stopped before its first record reached Dropbox, so there is nothing to check.`);
      return;
    }
  }
  // 1. The folder (ruling 16).
  let list;
  try {
    list = readdirSync(episodesFolder(p.root));
  } catch (err) {
    cannotTell();
    return;
  }
  try {
    if (!list.some((n) => n.normalize("NFC") === basename(p.folder).normalize("NFC"))) {
      const video = statSync(episodeFilesFolder(home, p.name), { throwIfNoEntry: false });
      if (!(video && video.isDirectory())) return goneAway();
    } else {
      const folder = statSync(p.folder, { throwIfNoEntry: false });
      if (!(folder && folder.isDirectory())) return goneAway();
    }
  } catch (err) {
    cannotTell();
    return;
  }
  // 2. What is at its first record's place.
  let state;
  try {
    const found = statSync(e.to, { throwIfNoEntry: false });
    if (!found) state = "absent";
    else if (!whole(e.to)) state = "placeholder";
    else {
      try {
        const read = JSON.parse(readFileSync(e.to, "utf8"));
        state = read && read.id === p.id && read.rev === 1 ? "ours" : "another";
      } catch (err) {
        state = "unreadable";
      }
    }
  } catch (err) {
    cannotTell();
    return;
  }
  // 3.
  if (state === "ours" || state === "placeholder") {
    if (putAway()) log(`${who}: its first record is whole in Dropbox.`);
    return;
  }
  // 4. Whether its record reached Dropbox (rulings 0, 9 and 32).
  const reached = p.copied === true || lastWritten(home, p.id) >= 1 || (state === "unreadable" && existsSync(e.from) && startsAlike(e.to, e.from, statSync(e.to).size));
  if (!reached) {
    if (state === "unreadable") {
      wait(`${who}: its check waits: its first record in Dropbox does not read, and whether it is this import's cannot be told. It is looked at again later.`);
      return;
    }
    if (putAway()) log(`${who}: its import stopped before its first record reached Dropbox, so there is nothing to check.`);
    return;
  }
  // 5.
  if (state === "another") {
    if (putAway()) log(`${who}: another import's first record is in its place now, so nothing is put back.`);
    return;
  }
  // 6. The video is still in the drop folder as it arrived: the next look imports it again, and nothing is put back.
  if (state === "absent") {
    const known = p.dropFile && typeof p.dropFile === "object" && typeof p.drop === "string";
    let there = false;
    if (known) {
      try {
        there = sameFile(p.drop, { size: p.dropFile.size, mtimeMs: p.dropFile.mtimeMs });
      } catch (err) {
        there = false;
      }
    }
    if (there) {
      if (putAway()) log(`${who}: its first record is not in Dropbox, and its video is still in the drop folder, so the next look imports it again, and nothing is put back.`);
      return;
    }
  }
  // 7.
  if ((recordNumbers(p.folder)[0] || 0) > 1) {
    if (putAway()) log(`${who}: its first record is not in Dropbox, but a later one is, so nothing is put back.`);
    return;
  }
  // 8. Put it back.
  let problem = "";
  if (!existsSync(e.from)) problem = "its first record is not in Dropbox, and its copy on this Mac is gone, so it could not be put back.";
  else {
    try {
      mkdirSync(dirname(e.to), { recursive: true });
      if (state === "absent") cloneIn(e.from, e.to, opts);
      else replaceIn(e.from, e.to, opts);
    } catch (err) {
      problem = `its first record could not be put back in Dropbox (${err.code || "an error"}).`;
    }
  }
  if (!problem) {
    if (putAway()) log(`${who}: Dropbox lost its first record, so it is put back.`);
    return;
  }
  log(`${who}: Dropbox lost its first record: ${problem}`);
  if (!p.problem) (deps.notify || (() => {}))(RECORD_LOST(who));
  const { nextLook, ...rest } = p;
  writePending(home, { ...rest, problem });
}

CHECKS.record = checkRecord;

/** The finish's own record, put back when Dropbox lost it (ruling 12), alone: synchronous, and the caller holds the episode's late-check lock. `p.record` is the entry the
    finish wrote. Gives { put, problems }. */
export function putOwnRecordBack(p, { isWhole: whole = isWhole, opts }) {
  const rec = p.record;
  const own = rec.to;
  const number = basename(own);
  const log = (opts && opts.log) || (() => {});
  const gone = `its record ${number} is not in Dropbox, and its copy on this Mac is gone, so it could not be put back.`;
  try {
    const above = recordNumbers(p.folder).some((n) => n > p.rev);
    const found = statSync(own, { throwIfNoEntry: false });
    const back = (how) => {
      if (!existsSync(rec.from)) return { put: false, problems: [gone] };
      mkdirSync(dirname(own), { recursive: true });
      how(rec.from, own, opts);
      log(`${whoOf(p)}: its record ${number} was lost in Dropbox, so it is put back from its copy on this Mac.`);
      return { put: true, problems: [] };
    };
    if (!found) return above ? { put: false, problems: [] } : back(cloneIn);
    if (!whole(own)) return { put: false, problems: [] };
    let read = null;
    try {
      read = JSON.parse(readFileSync(own, "utf8"));
    } catch (err) {
      read = null;
    }
    const reads = read !== null && typeof read === "object" && read.rev === p.rev;
    if (!reads) return above ? { put: false, problems: [] } : back(replaceIn);
    const ours = existsSync(rec.from) ? sameBytes(own, rec.from) : read.id === p.id && Boolean(read.finished) && read.finished.revision === p.revision;
    return ours ? { put: false, problems: [] } : { put: false, problems: [`its record ${number} was lost in Dropbox, and a later change took its number.`] };
  } catch (err) {
    return { put: false, problems: [`its record ${number} could not be put back in Dropbox (${err.code || "an error"}).`] };
  }
}

/** Put back a finish's record that Dropbox lost, before a command builds on the record before it (ruling 35): true when it put a record back. Synchronous; asks the episode's
    late-check lock once, as "write", and never waits for it. */
export function ownRecordBack(ctx, { name, folder, record }) {
  const sameEp = (p) => p.id === record.id && p.machine === ctx.machine && resolve(String(p.root)) === resolve(ctx.root);
  const owed = (p) => sameEp(p) && p.rev > record.rev && (p.copied === true || recordHolds(p, { isWhole: ctx.isWhole }) === true);
  if (!readPendingsOf(ctx.home, "final").some(owed)) return false;
  let held = null;
  try {
    held = takeLateCheckLock(ctx.home, name, "write", ctx.alive);
  } catch (err) {
    return false;
  }
  if (!held) return false;
  let any = false;
  try {
    for (const p of readPendingsOf(ctx.home, "final").filter(owed)) {
      const fresh = readPendingAt(ctx.home, pendingKeyOf(p));
      if (!fresh || !owed(fresh)) continue;
      if (putOwnRecordBack(fresh, { isWhole: ctx.isWhole, opts: ruleOpts({ ...(ctx.deps || {}), log: logTo(ctx.home) }) }).put) any = true;
    }
  } finally {
    releaseLateCheckLock(held);
  }
  return any;
}

/** Make the check of a finish's copies in final/ (algorithm C), under the episode's late-check lock, with the pending read again: the copies the record in force lists are put back
    when Dropbox lost or changed them, a file it lists at another size is left, and the exports the finish took from Downloads are deleted only when every copy is whole and
    the record in force still holds the part each was taken for. Synchronous. */
export function checkFinal(p, deps) {
  const home = deps.episode.home;
  const clock = deps.clock;
  const log = deps.log || (() => {});
  const once = deps.once || log;
  const opts = ruleOpts({ ...deps, log });
  const whole = deps.isWhole || isWhole;
  const who = whoOf(p);
  let shown = who;
  let q = p;
  const otherProblem = () => readPendingsOf(home, "final").some((x) => pendingKeyOf(x) !== pendingKeyOf(q) && x.id === q.id && x.machine === q.machine && resolve(x.root) === resolve(q.root) && x.problem);
  const putAway = () => {
    try {
      clearChecking(home, q.name, q.revision);
      if (!otherProblem()) clearProblem(home, q.name);
      removePending(home, q);
      if (typeof q.work === "string") rmSync(q.work, { recursive: true, force: true });
      return true;
    } catch (err) {
      once(`${shown}: its check is made, but it could not be put away (${err.code || "an error"}). The next run looks at it again.`);
      return false;
    }
  };
  const wait = (line, pend = q) => {
    writePending(home, { ...pend, nextLook: clock() + WAIT_LOOK_MS, lookUntil: Number.isFinite(pend.lookUntil) ? pend.lookUntil : clock() + WAIT_LOOK_FOR_MS });
    once(line);
  };
  // 1. The folder (ruling 16).
  const unreadable = () => wait(`${who}: its check waits: its folder in Episodes cannot be read now. It is looked at again later.`);
  const goneAway = () => {
    if (!putAway()) return;
    log(FOLDER_GONE(who));
    (deps.notify || (() => {}))(FOLDER_GONE(who));
  };
  let list;
  try {
    list = readdirSync(episodesFolder(p.root));
  } catch (err) {
    return unreadable();
  }
  try {
    const folder = list.some((n) => n.normalize("NFC") === basename(p.folder).normalize("NFC")) ? statSync(p.folder, { throwIfNoEntry: false }) : undefined;
    if (!(folder && folder.isDirectory())) return goneAway();
  } catch (err) {
    return unreadable();
  }
  // 2. Whether the finish's record reached Dropbox (ruling 11).
  const held = p.copied === true ? true : recordHolds(p, { isWhole: whole });
  if (held === false) {
    if (putAway()) log(`${who}: its finish stopped before its record was written, so the check of its copies is not made.`);
    return;
  }
  if (held === null) return wait(`${who}: its check waits: whether its record reached Dropbox cannot be told now. It is looked at again later.`);
  // 3. The finish's own record, when Dropbox lost it (ruling 12).
  let problems = [];
  if (p.record) problems = putOwnRecordBack(p, { isWhole: whole, opts }).problems;
  // 4. A writer's mark, settled by the record.
  if (p.reading) {
    const settled = settleReading(p, { home, log });
    if (settled.later) return wait(`${who}: its check waits: a write stopped while it put its files in, and the episode's record cannot be read now. It is looked at again later.`, p);
    q = settled.pending;
  }
  // 5. The record in force.
  const read = readEpisode(q.folder);
  if (!read.record || read.newer || (recordNumbers(q.folder)[0] || 0) > read.record.rev) return wait(`${who}: its check waits: the episode's record cannot be read now. It is looked at again later.`);
  // 6. The gate (ruling 15): while it holds the video, nothing is put back and no export is deleted.
  const links = linksOf(q.root);
  const named = withShortId(gatedAsOf(links)(read.record), read.record);
  if (gated(read.record)) {
    if (putAway()) log(`${named}: it is held as a session now, so nothing of its hand-off is put back into Dropbox, and its exports stay in Downloads.`);
    return;
  }
  if (links.sessionsBeside(read.record, q.folder).length > 0) {
    writePending(home, { ...(({ nextLook, ...rest }) => rest)(q), lookUntil: Number.isFinite(q.lookUntil) ? q.lookUntil : clock() });
    once(`${named}: another version of it is a session not cleared, so nothing of its hand-off is put back into Dropbox yet, and its exports stay in Downloads.`);
    return;
  }
  shown = shownName(read.record);
  // 7. Each copy, by table J against the files the record in force lists.
  const listed = read.record.files || {};
  const left = new Set();
  for (const e of q.entries) {
    const judged = judgeEntry(e, q.folder, listed, whole);
    if (judged.left) {
      left.add(e.to);
      continue;
    }
    if (!judged.put) continue;
    const problem = putEntryBack(e, judged.put, { opts, log, shown });
    if (problem) problems.push(problem);
  }
  // 8. Problems: kept, noted, and posted the first time.
  if (problems.length) {
    for (const problem of problems) log(`${shown}: the check of its copies in final/ found a problem: ${problem}`);
    try {
      flagProblem(home, q.name, clock());
    } catch (err) {
      // The note costs nothing but itself.
    }
    if (!q.problem && !Number.isFinite(q.told)) (deps.notify || (() => {}))(problemNotice(shown));
    if (q.took.length) log(`${shown}: the exports it took are kept in Downloads, because a copy in final/ was not whole.`);
    const { wasProblem, nextLook, ...rest } = q;
    writePending(home, { ...rest, problem: problems.join(" ") });
    return;
  }
  // 9. Every copy is whole: a finish may have come while the copies were read.
  if (finishAtWork(home, q.name, deps.alive, clock())) {
    writePending(home, { ...q, nextLook: clock() + LOCK_AGAIN_MS });
    once(`${shown}: its check waits until the finish at work on it ends.`);
    return;
  }
  const finished = read.record.finished;
  // What macOS answered the Downloads export is noted in access.json, with the banner when it is due. Neither changes what the check does, and neither
  // can stop it.
  const noteDownloads = (err) => {
    try {
      const folder = downloadsFolder(home);
      const node = deps.node || process.execPath;
      noteState("downloads", folder, err, { home, clock, node });
      postIfDue("downloads", readAccess(home), { notify: deps.notify || (() => {}), clock, node, placeWords: err ? placeWordsOf("downloads", folder, home) : "", home });
    } catch {
      // a note or banner that fails costs only itself
    }
  };
  for (const t of q.took) {
    try {
      if (!statSync(t.path, { throwIfNoEntry: false })) continue;
      if (t.place !== "Downloads" || !sameFolder(dirname(t.path), downloadsFolder(home))) {
        log(`${shown}: ${t.name} was not taken from Downloads, so it is left where it is.`);
        continue;
      }
      const mine = q.entries.find((e) => e.to === join(q.folder, "final", t.name));
      const part = finished && finished.parts ? finished.parts[t.key] : undefined;
      const holds = mine && !left.has(mine.to) && part && part.file === `final/${t.name}` && part.source && part.source.bytes === t.snap.size && part.source.mtimeMs === t.snap.mtimeMs;
      if (!holds) {
        log(`${shown}: the hand-off in force no longer holds ${t.name}, so it is left in Downloads.`);
        continue;
      }
      const now = statSync(t.path);
      if (now.size !== t.snap.size || now.mtimeMs !== t.snap.mtimeMs) {
        log(`${shown}: ${t.name} changed in Downloads after it was taken, so it is kept there.`);
        continue;
      }
      rmSync(t.path, { recursive: true, force: true });
      noteDownloads(null);
      log(`${shown}: ${t.name} is taken out of Downloads.`);
    } catch (err) {
      noteDownloads(err);
      log(`${shown}: ${t.name} could not be looked at or taken out of Downloads (${err.code || "an error"}), so it is kept there. Delete it there by hand.`);
    }
  }
  // 10. Put away.
  if (putAway()) {
    log(`${shown}: the check of its copies in final/ passed: every copy the record lists is whole in Dropbox.`);
    if (left.size) log(left.size === 1 ? `${shown}: 1 of its copies in final/ is from a later write, so the check leaves it as it is.` : `${shown}: ${left.size} of its copies in final/ are from a later write, so the check leaves them as they are.`);
  }
}

CHECKS.final = checkFinal;
CHECKS.original = checkOriginal;

/** A time of day as a person reads it, "10:15". */
export const clockTime = (ms) => new Date(ms).toTimeString().slice(0, 5);

/** The options the rule is given in a run: the clone and the check of one disk a test gives, and the log. */
export const ruleOpts = (deps) => ({ ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log: deps.log || (() => {}) });

/** The label of a light import's video, as its statuses carry it, from its late check: { label }, or nothing. */
const labelOf = (pending) => (pending.label ? { label: pending.label } : {});

/** Write the status of a video whose import is waiting for its late check, so the other Mac sees this one is still at it. Of
    the step "Waiting for its late check" it says when the check is due, as `due`, in milliseconds: the other Mac does not make
    its own look at the video's files before then. */
function waitingStatus(pending, deps, step) {
  try {
    writeStatusIn(statusWriteFolder(deps.episode), { version: 1, machine: pending.machine, pid: process.pid, ...(pending.importId ? { import: pending.importId } : {}), video: pending.video, bytes: pending.bytes, seconds: pending.seconds, step, at: localStamp(new Date(Date.now())), ...(step === "Waiting for its late check" ? { due: dueAt(pending) } : {}), ...labelOf(pending) }, textWriter({ work: join(pending.work, "status"), ...ruleOpts(deps) }));
  } catch (e) {
    // The status costs nothing but itself, and the next minute's is written again.
  }
}

/** Make the late check of an episode's import (dropbox.js lateCheck): every file put into Dropbox is looked at, and one that
    is missing or short is put in again from its work copy. When every file is whole, the run's own folder, the raw video in
    the drop folder, this Mac's status files of the video and the pending check are taken away. When a file is still wrong,
    the log says each problem; the first time, the cut plan's text in the episode is written again with the problem first,
    and a new record lists its size, and a banner says so; the status says the problem; and the raw video, the work copies
    and the pending check stay, so that the next run checks again and the video is never imported twice. Gives back
    { ok, problems }. */
export function finishLate(pending, deps) {
  const { notify = () => {} } = deps;
  // A light import's video is named by its label, and its episode by its id, in every line of its late check; and what the check
  // finds, which names a file of it and its folder, is said in the log and its status with nothing of the file's names in it.
  const who = pending.label || pending.video;
  const plain = (text) => (pending.label ? withoutNames(text, [...namesOf(pending.video, pending.drop), pending.name, pending.folder], [pending.label]) : text);
  const logged = deps.log || (() => {});
  const log = (line) => logged(plain(line));
  const opts = ruleOpts({ ...deps, log });
  // The video in the drop folder is the work copy of the raw video only while it is the file that was imported: one dropped
  // again under the same name is another recording, and is never copied in for it, nor deleted.
  const same = sameFile(pending.drop, pending.dropFile);
  const entries = same ? pending.entries : pending.entries.map((e) => (e.from === pending.drop ? { ...e, from: join(pending.work, "the video in the drop folder is another file now") } : e));
  const problems = lateCheck(entries, opts);
  if (!problems.length) {
    rmSync(pending.work, { recursive: true, force: true });
    try {
      if (same) rmSync(pending.drop, { force: true });
    } catch (e) {
      log(`${who}: could not be taken out of the drop folder (${e.code || e.message}). Delete it there by hand.`);
    }
    try {
      removeStatusIn(statusWriteFolder(deps.episode), pending.video, pending.machine, pending.importId || "");
      rmSync(pendingFile(deps.episode.home, pending.id), { force: true });
    } catch (e) {
      log(`${who}: its late check passed, but it could not be put away (${e.code || e.message}). The next run checks it again.`);
    }
    log(`${who}: the late check passed: every file of ${pending.label ? `its episode, ${pending.id},` : `"${pending.name}"`} is whole in Dropbox. ${same ? "The video is taken out of the drop folder." : "The video in the drop folder is another file of that name now, so it is left there."}`);
    return { ok: true, problems };
  }
  for (const problem of problems) log(`${who}: the late check found a problem: ${problem}`);
  const said = plain(problems.join(" "));
  if (!pending.problem) {
    // A light import's video is named by its label, as in every notice of its import: a notice may show on a shared screen.
    notify(`Dropbox lost a file of ${pending.label || basename(pending.video, extname(pending.video))}. The video stays in the drop folder; see the log.`);
    try {
      noteProblem(pending, said, { ...deps, log });
    } catch (e) {
      log(`${who}: the problem could not be written into its cut plan (${String(e.message).replace(/\.$/, "")}).`);
    }
  }
  pending.problem = said;
  try {
    writePending(deps.episode.home, pending);
  } catch (e) {
    log(`${who}: its late check could not be kept for the next run (${e.code || e.message}).`);
  }
  try {
    writeStatusIn(statusWriteFolder(deps.episode), { version: 1, machine: pending.machine, pid: process.pid, ...(pending.importId ? { import: pending.importId } : {}), video: pending.video, bytes: pending.bytes, seconds: pending.seconds, step: "Late check", at: localStamp(new Date(Date.now())), problem: said, ...labelOf(pending) }, textWriter({ work: join(pending.work, "status"), ...opts }));
  } catch (e) {
    log(`${who}: its status could not say the problem (${String(e.message).replace(/\.$/, "")}).`);
  }
  return { ok: false, problems };
}

/** Put the late check's problem first in the episode's cut plan text, by the rule, and write a new record that lists the
    file's new size. The late check's entry for the file is changed to the new work copy. */
function noteProblem(pending, said, deps) {
  const opts = ruleOpts(deps);
  const late = join(pending.work, "late");
  mkdirSync(late, { recursive: true });
  const entry = pending.entries.find((e) => basename(e.to) === pending.planTxt && dirname(e.to) === pending.folder);
  if (!entry) return;
  const from = join(late, pending.planTxt);
  writeFileSync(from, `Dropbox lost a file of this episode after it was copied in, and it could not be put back: ${said}\n${readFileSync(entry.from, "utf8")}`);
  replaceIn(from, entry.to, opts);
  Object.assign(entry, { from, bytes: statSync(from).size });
  const { record } = readEpisode(pending.folder);
  if (!record) return;
  const write = textWriter({ work: join(late, "record"), keep: true, ...opts });
  writeEpisode(pending.folder, { ...record, files: { ...record.files, [pending.planTxt]: entry.bytes } }, { expectRev: record.rev, writeText: (to, text) => pending.entries.push(write(to, text)), writer: record.writer, home: deps.episode.home });
}

/** Keep this Mac awake while `pid` runs: caffeinate, which is part of macOS, holds off idle sleep until that process ends.
    It is a courtesy: when it cannot be started, nothing else changes. */
export function caffeinate(pid) {
  if (!existsSync("/usr/bin/caffeinate")) return;
  const child = spawn("/usr/bin/caffeinate", ["-i", "-w", String(pid)], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

/** What the light import says of a Zoom download it leaves in the drop folder, in its status and its log, until phase Z of
    the design (2026-10-22) teaches the import Zoom's downloads. */
const ZOOM_HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";

/** Whether the import leaves the video `name` where it is, held: a file that Zoom's names say is its download. Only an episode
    import asks, so a watched folder that is not this Mac's drop folder and the one-file command line never hold anything. */
const holdsZoom = (name) => isZoomName(name);

/** Hold the video `name` in the drop folder `dir`: write the status that says why it is not imported, as a new file by the
    rule, so that both Macs' `episodes` say it. Its label is its Zoom time alone (kinds.js zoomTimeOf), by which every command on
    either Mac names it, and so does the log: a download renamed with a client's words after Zoom's own name is never named by
    them. It is held whether or not the status could be written, and the log says so, once, when it could not. */
function hold(name, dir, deps, told) {
  const { episode, log = () => {}, clock = Date.now } = deps;
  const work = join(runsFolder(episode.home), `held-${process.pid}-${clock()}`);
  try {
    const bytes = statSync(join(dir, name), { throwIfNoEntry: false })?.size ?? 0;
    writeStatusIn(statusWriteFolder(episode), { version: 1, machine: episode.machine, pid: process.pid, video: name, bytes, seconds: null, step: "Held", at: localStamp(new Date(clock())), held: ZOOM_HELD, label: zoomTimeOf(name) }, textWriter({ work, ...ruleOpts(deps) }));
  } catch (e) {
    if (!told.has(`status:${name}`)) log(`${zoomTimeOf(name)}: its status could not be written (${String(withoutNames(e.message, namesOf(name), [zoomTimeOf(name)])).replace(/\.$/, "")}). It is held all the same.`);
    told.add(`status:${name}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return ZOOM_HELD;
}

/** Take away this Mac's status of each video it held that it holds no longer: the file has left the drop folder `dir`, as
    when it is put in BRIMM VIDEO Transfer, or is another file of that name (its size is not the status's). */
function releaseHeld(dir, deps) {
  const { episode, log = () => {} } = deps;
  for (const { status, folder } of readStatusesIn(statusReadFolders(episode))) {
    if (!status || !status.held || status.machine !== episode.machine) continue;
    const size = statSync(join(dir, status.video), { throwIfNoEntry: false })?.size;
    if (holdsZoom(status.video) && size === status.bytes) continue;
    try {
      removeStatusIn(folder, status.video, episode.machine, status.import || "");
    } catch (e) {
      // A Zoom download is named by its Zoom time alone, or its label, and why holds no name of its file.
      const who = status.label || zoomTimeOf(status.video) || status.video;
      log(`${who}: the status that said it was held could not be taken away (${String(who === status.video ? e.message : withoutNames(e.message, namesOf(status.video), [who])).replace(/\.$/, "")}).`);
    }
  }
}

/** What the log says of a late check that threw, whether of a kind's or an import's: it stays pending, and the next run makes it again. */
const checkPutOff = (label, e) => `${label}: its check could not be made (${e.code || "an error"}). The next run makes it again.`;

/** How often the wait for a late check looks in the drop folder for videos that have arrived meanwhile. */
const LOOK_AGAIN_MS = 60 * 1000;

/** The episode import of this Mac's drop folder `dir`, with the folder's lock held: the late checks earlier runs left that
    are due, first; then each video waiting in the folder (`importOne(name)`, which resolves what uneditedFile does), unless
    an episode or a status holds it (heldBy), or it is a Zoom download, which is held in
    the folder with a status that says why until the import takes them; then, while any late check of this run is not yet
    due, a wait of a minute at most, a look for videos that arrived meanwhile, and each late check that has come due; and,
    while a video imports, each minute, the late checks that have come due then, whose drop files the loop then passes over.
    The Mac is kept awake while there is work (`deps.keepAwake`). Resolves the results of the videos imported, and of those
    held, each with `held`. The log names no video by its file, which may be named for a client: a video by
    the label its status carries, or as "A video in the drop folder", and why it is held with nothing of its file's names in it.
    A Zoom download is named by its Zoom time alone (kinds.js zoomTimeOf), the part of its name that is Zoom's: the time and a
    number. */
export async function importEpisodes(dir, deps, importOne) {
  const { episode, log = () => {}, wait, clock = Date.now, keepAwake = caffeinate } = deps;
  // The launch agent's deps carry neither a clock nor `alive`: a check is given these, resolved, and never calls deps.clock or deps.alive as given.
  const alive = deps.alive || isRunning;
  // When the Mac last woke or started (ruling 33): its own answer, but none when a test gives a clock, which is not the Mac's.
  const wokeAt = deps.wokeAt || (deps.clock ? () => null : lastWake);
  let woke = null;
  /** How the log names the video `name` in the drop folder: by its label, or as "A video in the drop folder", unless Zoom named it.
      `labels` gives the labels the statuses carried, by the video's file. */
  const named = (name, labels = labelsNow()) => (isZoomName(name) ? zoomTimeOf(name) : labels.get(name) || "A video in the drop folder");
  const labelsNow = () => new Map(readStatusesIn(statusReadFolders(episode)).filter(({ status }) => status && status.machine === episode.machine && status.label).map(({ status }) => [status.video, status.label]));
  const results = [];
  // The files tried in this run, by name, inode and size: a video dropped again under the same name is another file. A video
  // held by an episode or a status is looked at again each minute, and the log says why once.
  const seen = new Set();
  const told = new Set();
  // Each late check is made once in a run: one that found a problem, or could not be put away, waits for the next run. Held by key,
  // last copy and told, so a pending written again under a key the run has made, or one a writer reopened, is another.
  const checked = new Set();
  const checkedKey = (p) => `${pendingKeyOf(p)}@${p.lastCopy}@${Number.isFinite(p.told) ? p.told : 0}`;
  const hasCheck = (p) => !p.kind || Boolean({ ...CHECKS, ...deps.checks }[p.kind]);
  // Each pending past its lookUntil that a run's start could not make yet because it was not yet due: this run owes it its one look.
  const lookOwed = new Set();
  let awake = false;
  const wake = () => {
    if (!awake) keepAwake(process.pid);
    awake = true;
  };
  const mine = () => readEveryPending(episode.home).filter((p) => p.machine === episode.machine && resolve(p.root) === resolve(episode.root) && !checked.has(checkedKey(p)) && hasCheck(p));
  const stillOpen = (p) => isOpen(p, clock()) || lookOwed.has(checkedKey(p));
  /** Whether the check of `p` is to be made now: the table of ruling 24 (an import's is today's test). */
  const dueNow = (p, atStart, now) => {
    const key = checkedKey(p);
    const past = pastLookUntil(p, now);
    const due = now >= dueAt(p, woke);
    if (atStart) {
      if (past && !due) lookOwed.add(key);
      return due;
    }
    if (lookOwed.has(key)) {
      if (due) lookOwed.delete(key);
      return due;
    }
    return !p.problem && !past && due;
  };
  // What a check that is put off, or cannot be settled, says in the log: once in a run for each.
  const saidOnce = new Set();
  const sayOnce = (key, line) => {
    if (saidOnce.has(key)) return;
    saidOnce.add(key);
    log(line);
  };
  /** Make each check that is due, under the lock of its episode's check (plan R1c): the lock a reading or a writer takes while it puts its
      files in and takes them out of the check. A check whose lock is held is put off, not skipped: it is made on a later look. Under the lock the pending
      is read again, so that what a writer took out of it is out of the check, and the check is made of that. Gives back how many checks it put off. */
  const finishDue = (atStart) => {
    let putOff = 0;
    woke = wokeAt();
    for (const pending of mine()) {
      if (!dueNow(pending, atStart, clock())) continue;
      wake();
      const key = pendingKeyOf(pending);
      const who = pending.kind ? pending.label || `an episode (${String(pending.id).slice(-6)})` : pending.label || pending.video;
      // A finish at work on the episode may have named the exports the check would delete: nothing is asked of its lock (ruling 14).
      if (pending.kind === "final" && finishAtWork(episode.home, pending.name, alive, clock())) {
        putOff += 1;
        sayOnce(`finish:${key}`, `${who}: its check waits until the finish at work on it ends.`);
        continue;
      }
      const held = takeLateCheckLock(episode.home, pending.name, "late check", alive);
      if (!held) {
        putOff += 1;
        sayOnce(`off:${key}`, pending.kind ? `${who}: its check waits a moment: a write is putting its files in.` : `${who}: its late check waits a moment: a reading is putting its files in.`);
        continue;
      }
      try {
        if (pending.kind) {
          const fresh = readPendingAt(episode.home, key);
          if (!fresh) continue;
          // Written again since the loop chose it (a finish's own over a dead finish's key, a writer's reopening): made at its own due.
          if (checkedKey(fresh) !== checkedKey(pending) || dueAt(fresh, woke) > clock()) continue;
          const check = { ...CHECKS, ...deps.checks }[fresh.kind];
          try {
            check(fresh, { ...deps, clock, alive, once: (line) => sayOnce(`said:${key}:${line}`, line) });
          } catch (e) {
            checked.add(checkedKey(fresh));
            sayOnce(`threw:${key}`, checkPutOff(who, e));
            continue;
          }
          const after = readPendingAt(episode.home, key);
          if (!(after && !after.problem && dueAt(after, woke) > clock())) checked.add(checkedKey(fresh));
          continue;
        }
        // The pending as it is now: a reading may have taken files out of it, or the check may have been made meanwhile.
        const fresh = readPendings(episode.home).find((p) => p.id === pending.id && p.machine === episode.machine && resolve(p.root) === resolve(episode.root));
        if (!fresh) continue;
        // Each check in its own try, as a kind's is: a read macOS refuses (the drop file's stat) must not end the run. The check stays pending, and
        // the log says so by the pending's label, never by its file (`who` is the file for a pending with no label).
        try {
          let now = fresh;
          if (fresh.reading) {
            const settled = settleReading(fresh, { home: episode.home, log: (line) => log(line) });
            if (settled.later) {
              checked.add(checkedKey(pending));
              sayOnce(`later:${pending.id}`, `${who}: its late check waits for the next run: a reading stopped while it put its files in, and the episode's record cannot be read now.`);
              continue;
            }
            now = settled.pending;
          }
          checked.add(checkedKey(pending));
          finishLate(now, deps);
        } catch (e) {
          checked.add(checkedKey(pending));
          sayOnce(`threw:${key}`, checkPutOff(pending.label || "A video", e));
        }
      } finally {
        releaseLateCheckLock(held);
      }
    }
    return putOff;
  };
  // Whether an import was stopped because its video was replaced meanwhile: the new file is then looked for at once.
  let changed = false;
  // The videos whose import failed in this run, by their files: once the failed status is taken away, as `retry` does, the
  // video is looked at again.
  const failed = new Map();
  // Whether the last look imported anything, which then has its late check to wait for.
  let progressed = false;
  // What the log says of a look that macOS or the folder's permissions refused: once while the look goes on meeting it.
  const lookSaid = new Map();
  const node = deps.node || process.execPath;
  const sayLook = (place, folder, look) => {
    // The banner for whoever is at the Mac: access.js says whether it is due, from the note's `told`. It never stops the run. The place's
    // words are worked out only for a look that was refused or locked.
    try {
      const stopped = look && (look.state === "refused" || look.state === "locked");
      postIfDue(place, readAccess(episode.home), { notify: deps.notify || (() => {}), clock, node, placeWords: stopped ? placeWordsOf(place, folder, episode.home) : "", home: episode.home });
    } catch {
      // a banner that fails costs only the banner
    }
    const line = lookLog(place, folder, look, episode.home, node);
    if (!line) lookSaid.delete(place);
    else if (lookSaid.get(place) !== line) {
      lookSaid.set(place, line);
      log(line);
    }
  };
  const noted = { home: episode.home, clock, node };
  const episodesAt = episodesFolder(episode.root);
  // Whether Episodes was refused, locked or failed at its last look: nothing is imported then, for each import needs it. Not there is
  // not that: the import makes Episodes itself.
  let episodesStopped = false;
  const lookEpisodes = () => {
    const look = lookAt("episodes", episodesAt, noted);
    sayLook("episodes", episodesAt, look);
    episodesStopped = ["refused", "locked", "error"].includes(look.state);
  };
  const importWaiting = async (first) => {
    const look = lookAt("drop", dir, noted);
    // A folder that is not there was said by the caller (unedited.js uneditedFolders), which goes on to it only on a Mac with a drop folder of its own.
    sayLook("drop", dir, look);
    if (!look.names) return;
    noteSeen(episode.home, dir, clock(), look.names);
    releaseHeld(dir, deps);
    if (episodesStopped) {
      lookEpisodes();
      if (episodesStopped) return;
    }
    for (const [id, name] of failed) {
      const still = readStatusesIn(statusReadFolders(episode)).some(({ status }) => status && status.video === name && status.machine === episode.machine && status.failed);
      if (!still) {
        failed.delete(id);
        seen.delete(id);
      }
    }
    const key = (name) => {
      const id = fileId(join(dir, name));
      return id ? `${name}:${id.ino}:${id.size}` : name;
    };
    const names = waitingToCut(look.names).filter((name) => !seen.has(key(name)));
    if (first) log(names.length ? `Looked in the folder: ${names.length} waiting.` : "Looked in the folder: nothing is waiting.");
    for (const name of names) {
      // A late check that came due while an earlier video imported took this video out of the folder: it is no video to import,
      // and none to say failed.
      if (!statSync(join(dir, name), { throwIfNoEntry: false })) continue;
      const id = key(name);
      let held = heldBy({ root: episode.root, statusFolders: statusReadFolders(episode), video: name, bytes: statSync(join(dir, name), { throwIfNoEntry: false })?.size ?? 0, local: Boolean(episode.local) });
      // A light import takes no Zoom download yet: it is left in the folder, and its status says why.
      if (!held && holdsZoom(name)) held = hold(name, dir, deps, told);
      if (held) {
        if (!told.has(`${id}:${held}`)) {
          told.add(`${id}:${held}`);
          log(`${named(name)}: ${withoutNames(held, namesOf(name), [named(name)])}`);
          results.push({ ok: true, name, held });
        }
        continue;
      }
      seen.add(id);
      wake();
      // While a video is imported, which can take many minutes, the videos waiting for their late checks go on saying so, and
      // each late check that comes due is made, as the loop below makes it: a long import does not hold a video's check.
      const { every = setInterval, cancel = clearInterval } = deps;
      const keep = every(() => {
        for (const pending of mine().filter((p) => !p.kind && !p.problem)) waitingStatus(pending, deps, "Waiting for its late check");
        // A check that cannot be made, as when a file cannot be looked at, must not end the process in the middle of another video's
        // import: a throw in a timer is never caught. The check stays pending, and the next run's start makes it again. A light
        // import's log names no video by its file, and an error's own words may hold a path, so this line gives only its code.
        try {
          finishDue(false);
        } catch (e) {
          log(`The late check of a video waiting for it could not be made (${e.code || "an error"}). The next run makes it again.`);
        }
      }, LOOK_AGAIN_MS);
      if (keep && typeof keep.unref === "function") keep.unref();
      let result;
      try {
        result = await importOne(name);
      } finally {
        cancel(keep);
      }
      if (result.changed) changed = true;
      // An import that filed nothing failed. It is looked at again in this run only once its failed status has been seen and
      // then taken away, as retry does: when that status could not be written, never. One that filed its episode, even with a
      // piece missing, is filed: it has a late check to wait for, and is not looked at again.
      if (!result.ok && !result.arriving && !result.filed) {
        const said = readStatusesIn(statusReadFolders(episode)).some(({ status }) => status && status.video === name && status.machine === episode.machine && status.failed);
        if (said) failed.set(id, name);
        else log(`${named(name)}: its import failed, and its status, which would say so, could not be written, so it is not tried again in this run.`);
      }
      if (result.filed) progressed = true;
      // A video still arriving is looked at again.
      if (result.arriving) seen.delete(id);
      results.push(result);
    }
  };
  clearRuns(episode.home, alive);
  // The first things the run does with the folders, each noted in access.json, before any other read of Dropbox (the labels, the crashes
  // and the owed recordings read Episodes) and before any late check is made: a run held at macOS's question is seen as asking.
  sayLook("drop", dir, lookAt("drop", dir, noted));
  lookEpisodes();
  const before = labelsNow();
  for (const video of clearCrashes({ statusFolders: statusReadFolders(episode), machine: episode.machine, ...(deps.alive ? { alive: deps.alive } : {}) })) log(`${named(video, before)}: an import of it on this Mac stopped before it was done, so it is imported again.`);
  // A hand-off writer that stopped before it owed its video's recordings (or whose owe could not be written) is made good here (L6).
  try {
    oweForgotten({ episode, clock, log });
  } catch (e) {
    log(`Recordings owed to Original files could not be looked for (${e.code || "an error"}).`);
  }
  finishDue(true);
  await importWaiting(true);
  while (changed) {
    changed = false;
    await importWaiting(false);
  }
  // When the drop folder was last looked in and the waiting statuses last written, by the clock.
  let lastLook = clock();
  for (;;) {
    const open = mine().filter(stillOpen);
    if (!open.length) {
      // A last look, so that a video that came, or a failed import taken again, while this run worked is not left until
      // something lands in the folder. Anything it imports has its late check waited for, as the others had. Then the pendings are read once
      // more, and the run goes on if one came meanwhile.
      progressed = false;
      do {
        changed = false;
        await importWaiting(false);
      } while (changed);
      if (!progressed && !mine().some(stillOpen)) break;
      continue;
    }
    wake();
    woke = wokeAt();
    const left = Math.min(...open.map((p) => dueAt(p, woke))) - clock();
    if (left > 0) {
      for (const pending of open.filter((p) => !p.kind)) waitingStatus(pending, deps, "Waiting for its late check");
      await wait(Math.min(LOOK_AGAIN_MS, left));
      await importWaiting(false);
      while (changed) {
        changed = false;
        await importWaiting(false);
      }
      lastLook = clock();
    }
    // A check put off because a reading holds its lock is looked at again in a moment: the loop never goes round with no wait. A long
    // hold must not stop the rest: each LOOK_AGAIN_MS the waiting statuses are written again and the drop folder is looked in, as above.
    if (finishDue(false)) {
      await wait(LOCK_AGAIN_MS);
      if (clock() - lastLook >= LOOK_AGAIN_MS) {
        for (const pending of mine().filter((p) => !p.kind && !p.problem)) waitingStatus(pending, deps, "Waiting for its late check");
        await importWaiting(false);
        while (changed) {
          changed = false;
          await importWaiting(false);
        }
        lastLook = clock();
      }
    }
  }
  return results;
}

/** Take away the folders in BRIMM Video Work/.runs that runs left when they stopped: a folder named for a run, "<pid>-<time>"
    or "push-<pid>-<time>", whose run is not running and that no late check still to make names. Gives back what was taken
    away. */
export function clearRuns(home, alive = isRunning) {
  const runs = runsFolder(home);
  let names = [];
  try {
    names = readdirSync(runs);
  } catch (e) {
    return [];
  }
  // Which runs are not running is asked first, then the pendings of every kind are read: a writer writes its pending before it ends,
  // so a run found dead has written every pending it will.
  const dead = names.filter((name) => {
    // A run's folder is named for its process: "<pid>-<time>", or a command's word first ("push-", "finish-", "reel-").
    const m = /^(?:[a-z]+-)?(\d+)-\d+$/.exec(name);
    return m && !alive(Number(m[1]));
  });
  const needed = new Set(readEveryPending(home).filter((p) => typeof p.work === "string").map((p) => resolve(p.work)));
  const gone = [];
  for (const name of dead) {
    if (needed.has(resolve(join(runs, name)))) continue;
    rmSync(join(runs, name), { recursive: true, force: true });
    gone.push(name);
  }
  return gone;
}

/** The key a video is known by in seen.json: its name, inode and size. */
export const seenKey = (name, id) => `${name}:${id.ino}:${id.size}`;

/** When this Mac first saw each video in its drop folder, by seenKey: { path, at }. {} when nothing is noted, or the file
    cannot be read. */
export function readSeen(home) {
  try {
    const seen = JSON.parse(readFileSync(seenFile(home), "utf8"));
    return seen && typeof seen === "object" && !Array.isArray(seen) ? seen : {};
  } catch (e) {
    return {};
  }
}

/** Note when this Mac first saw each video in the drop folder `dir`, at `now`, and forget each video noted that is no longer
    there as it was. Written whole on this Mac's own disk, under another name and then renamed. A note that cannot be written
    costs only how long a video is said to have waited. */
export function noteSeen(home, dir, now, listed) {
  const seen = readSeen(home);
  let changed = false;
  for (const [key, entry] of Object.entries(seen)) {
    const [name, ino, size] = key.split(/:(?=\d+:\d+$)|:(?=\d+$)/);
    let gone;
    try {
      gone = !entry || !sameFile(entry.path, { ino: Number(ino), size: Number(size) }) || basename(entry.path) !== name;
    } catch (e) {
      // Any throw (a file macOS will not let the import look at, or a malformed entry) leaves the entry noted: it is not known to be gone.
      continue;
    }
    if (gone) {
      delete seen[key];
      changed = true;
    }
  }
  // With the names given, the folder has been listed already (access.js lookAt) and is not listed again.
  let names = [];
  try {
    names = (listed || readdirSync(dir)).filter(isMedia);
  } catch (e) {
    // The folder cannot be read now, and nothing new is noted.
  }
  for (const name of names) {
    let id;
    try {
      id = fileId(join(dir, name));
    } catch (e) {
      continue;
    }
    if (!id || seen[seenKey(name, id)]) continue;
    seen[seenKey(name, id)] = { path: join(dir, name), at: now };
    changed = true;
  }
  if (!changed) return;
  const file = seenFile(home);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.writing`, JSON.stringify(seen, null, 2) + "\n");
    renameSync(`${file}.writing`, file);
  } catch (e) {
    rmSync(`${file}.writing`, { force: true });
  }
}
