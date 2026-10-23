// The episode import's own steps. When this Mac has settings and the folder the import watches is this Mac's drop folder,
// in BRIMM Video in Dropbox, each video is made into an episode: everything is made as for any video, held in the run's own
// folder, and then filed into a folder of its own in Episodes. The raw video is cloned in from the drop folder, each file
// made of it is cloned in from the run's folder, the Final Cut file goes into edit/ as main.v0.fcpxml, naming its video by a
// path from itself and naming no library, and the episode's first record, record/0001.json, comes last: it is the sign that
// the import finished. Nothing in Dropbox is renamed, moved or written into (dropbox.js). The raw video stays in the drop
// folder, and the run's folder stays, until the late check.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { localDay } from "./shared/text.js";
import { createdOf, waitingToCut } from "./cuts.js";
import { isMedia } from "./lib.js";
import { LATE_CHECK_MS, cloneIn, lateCheck, replaceIn, textWriter } from "./dropbox.js";
import { RECORD_DIR, newEpisode, newId, localStamp, readEpisode, writeEpisode } from "./episode.js";
import { episodeFolderName, fileSafe, timelineFile } from "./names.js";
import { dropFolder, episodesFolder, pendingFolder, runsFolder, seenFile } from "./settings.js";
import { holdsVideo, importState, leftByCrash, readStatuses, removeStatus, writeStatus } from "./importing.js";
import { isRunning } from "./run.js";
// kinds.js takes episodeKind from here: each is used only when called, so neither needs the other to have been read first.
import { isZoomName } from "./kinds.js";

/** How long a recording must be to be an episode, in seconds. One that is shorter is a short video. */
const SHORT_UNDER = 90;

/** Whether the import of the watched folder `dir` makes episodes: when this Mac has `settings` and `dir` is its own drop
    folder. Otherwise the import does what it did before episodes, filing each video into a folder for the day. */
export const episodeMode = (dir, settings) => Boolean(settings) && resolve(dir) === resolve(dropFolder(settings.root, settings.machine));

/** What kind of episode a video makes, by its facts: a short video when its picture is upright or square, or it is shorter
    than 90 seconds, and an episode otherwise. A short video gets no upright version and no Reels. A recording of sound alone
    is an episode. */
export function episodeKind(facts) {
  if (!facts.height) return "episode";
  return facts.width <= facts.height || facts.duration < SHORT_UNDER ? "short video" : "episode";
}

/** The folders in Episodes that this Mac would have named for a video: any day, the video's name, this Mac's, and a number
    or none. */
function namedFor(name, stem, machine) {
  const tail = ` ${fileSafe(stem)} (${machine})`;
  const i = name.indexOf(tail);
  return /^\d{4}-\d{2}-\d{2}$/.test(name.slice(0, i)) && /^(-\d+)?$/.test(name.slice(i + tail.length));
}

/** The size of a file, or -1 when it is not there. */
const sizeOf = (file) => {
  const found = statSync(file, { throwIfNoEntry: false });
  return found ? found.size : -1;
};

/** The folder in `episodes` the video `video`, of `bytes` bytes, goes into on `machine`, on the day `day`: { name, reused }.
    An import of this video by this Mac that stopped before it wrote a whole record left a folder, which is used again: its
    name is one this Mac would give the video, it has no whole record, and it holds the video at its size, or no video yet.
    Otherwise a new name, by episodeFolderName. */
export function findFolder(episodes, { video, bytes, machine, day }) {
  const stem = basename(video, extname(video));
  let names = [];
  try {
    names = readdirSync(episodes);
  } catch (e) {
    // There is no Episodes yet, and nothing in it to use again.
  }
  const stopped = names.filter((name) => namedFor(name, stem, machine)).sort().find((name) => {
    const folder = join(episodes, name);
    if (readEpisode(folder).code !== "NONE") return false;
    const size = sizeOf(join(folder, video));
    return size === -1 || size === bytes;
  });
  return stopped ? { name: stopped, reused: true } : { name: episodeFolderName(names, day, stem, machine), reused: false };
}

/** Which brimm-video is at work: the short commit the checkout `checkout` is at, as git says it, or "unknown". It goes into
    each record's writer, for information only. */
export function commitOf(checkout) {
  const ran = spawnSync("git", ["-C", checkout, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const commit = ran.status === 0 ? String(ran.stdout).trim() : "";
  return /^[0-9a-f]{7,}$/.test(commit) ? commit : "unknown";
}

/** File a video that has been worked on into its episode, in Episodes under BRIMM Video. `file` is the raw video in the drop
    folder; `made` are the files made of it, each where it belongs, and `at(to)` where its whole copy is in the run's own
    folder `work`; `fcpxml` is which of them is the Final Cut file, which goes into edit/main.v0.fcpxml; `facts` and
    `printed` are what ffprobe said; `kind` is the episode's kind; `read` is Claude's reply as it was read, or null; `reels`
    are the record's Reels, made of the Reel candidates (reelEntries, in reels.js). A made file goes into the episode folder
    where it sits beside the video, "Talk.srt" or "previews/reel-1.mp4", and a folder it needs there is made. `deps` gives `episode` ({ root, machine, checkout, home }), and `clone`, `sameDisk`, `log`,
    `today`, `now`, `commit` and `rand` when a test gives others.
    The light import (spec 2026-10-22, section 1) gives no Final Cut file, so no edit/ folder is made, and `kind` null, with
    `answer` (her answer, waiting, with the guess and the episode whose words it matched, or null), `label` and
    `fingerprint`, which go into the record as they are (newEpisode). An import never sets `versionOf`: her answer does.
    The folder is made, or the one a stopped import left is used again; the raw video is cloned in from the drop folder; each
    file is cloned in from the run's folder; and the first record is written last, by the rule, its work copy kept. Gives
    back { name, path, record, entries }, where `entries` are the late check's: { from, to, bytes } for every file put in,
    the record's among them. Throws, saying why, when a file cannot be put in: then no record is written, and the next run
    uses the folder again. */
export function fileEpisode({ file, made, at, fcpxml, facts, printed, kind, read, reels = [], work, dropFile, answer = null, label = "", fingerprint = "" }, deps) {
  const { episode, log = () => {} } = deps;
  // The video in the drop folder must still be the one that was worked on: one put in its place meanwhile, as a corrected
  // export, is another recording, and is never filed with this one's transcript and cuts.
  if (!sameFile(file, dropFile)) throw Object.assign(new Error(`${basename(file)} changed in the drop folder while it was imported`), { code: "DROP_CHANGED" });
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const video = basename(file);
  const bytes = statSync(file).size;
  const day = deps.today ? deps.today() : localDay();
  const episodes = episodesFolder(episode.root);
  mkdirSync(episodes, { recursive: true });
  const found = findFolder(episodes, { video, bytes, machine: episode.machine, day });
  const path = join(episodes, found.name);
  if (fcpxml) mkdirSync(join(path, "edit"), { recursive: true });
  // A stopped import may have left a record that is not whole. It is no one's record, and the first one is written anew.
  if (found.reused) rmSync(join(path, RECORD_DIR), { recursive: true, force: true });
  const entries = [];
  const files = {};
  const put = (from, rel) => {
    const to = join(path, rel);
    mkdirSync(dirname(to), { recursive: true });
    (found.reused ? replaceIn : cloneIn)(from, to, opts);
    entries.push({ from, to, bytes: statSync(from).size });
    files[rel] = statSync(from).size;
  };
  put(file, video);
  for (const to of made) put(at(to), to === fcpxml ? timelineFile({ part: "main", v: 0 }) : relative(dirname(file), to).split(sep).join("/"));
  const writer = { commit: deps.commit || commitOf(episode.checkout), on: episode.machine };
  const write = textWriter({ work: join(work, "record"), keep: true, ...opts });
  const title = read && typeof read.title === "string" && read.title.trim() ? { text: read.title.trim(), from: "claude", approved: false } : null;
  const first = newEpisode({
    id: newId(day, deps.rand),
    machine: episode.machine,
    at: localStamp(deps.now ? deps.now() : new Date()),
    video: { file: video, bytes, seconds: facts.duration, created: createdOf(printed) },
    kind,
    writer,
    files,
    title,
    reels,
    answer,
    label,
    fingerprint
  });
  const record = writeEpisode(path, first, { expectRev: 0, writeText: (to, text) => entries.push(write(to, text)), writer, home: episode.home });
  log(`${video}: filed into Episodes as "${found.name}"${found.reused ? ", in the folder an import that stopped had made" : ""}.`);
  return { name: found.name, path, record, entries };
}

/** How often a status is written while a step runs: once a minute, so that one not written for 10 minutes is an import that
    stopped. */
const STATUS_EVERY_MS = 60 * 1000;

/** The progress reporter of an episode's import: it tells `inner`, the progress panel's reporter, everything it is told, and
    also writes the import's status file in Episodes/.importing/ (importing.js): at the start, at each step, and once a minute
    while a step runs, by the timer `every`. `fail(why)` writes the status with why the import failed, and the status is left.
    `end` stops the timer and leaves the status: the late check takes it away. A status that cannot be written costs nothing
    but itself: the log says so once, and the work goes on. A light import gives its video's `label`, which every status
    carries. */
export function statusReporter(inner, { root, machine, video, bytes, importId = "", label = "", writeText, log = () => {}, pid = process.pid, now = () => Date.now(), every = setInterval, cancel = clearInterval }) {
  const status = { version: 1, machine, pid, ...(importId ? { import: importId } : {}), video, bytes, seconds: null, step: "Waiting to start", ...(label ? { label } : {}) };
  let told = false;
  const write = (more = {}) => {
    try {
      writeStatus(root, { ...status, ...more, at: localStamp(new Date(now())) }, writeText);
    } catch (e) {
      if (!told) log(`${video}: its status could not be written into Episodes/.importing (${String(e.message).replace(/\.$/, "")}). The work goes on.`);
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
    /** Take this import's status away, as when it stopped because its video changed. */
    drop() {
      removeStatus(root, video, machine, importId);
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
    met in practice. Matching the length as well would mean an ffprobe of every video in the drop folder at every run. */
export function heldBy({ root, video, bytes, now = Date.now() }) {
  // A status that failed or found a problem says most, then one that says the video is held, then an episode that holds the
  // video, then an import running. A running import, and a hold, keep only a video of their own size: one dropped again under
  // the same name, as a corrected export, is another recording.
  const own = (status) => !["running", "held"].includes(importState(status, now)) || status.bytes === bytes;
  const held = readStatuses(root, now).filter(({ status }) => status && status.video === video && holdsVideo(status, now) && own(status)).map(({ status }) => status);
  const failed = held.find((status) => importState(status, now) === "failed");
  if (failed) return `its import failed on ${failed.machine}: ${String(failed.failed).replace(/\.$/, "")}. Say "try it again" to import it again.`;
  const problem = held.find((status) => importState(status, now) === "problem");
  if (problem) return `copied in, but the late check found a problem: ${String(problem.problem).replace(/\.$/, "")}.`;
  const left = held.find((status) => importState(status, now) === "held");
  if (left) return String(left.held);
  const episode = episodeHolding({ root, video, bytes });
  if (episode) return episode;
  if (held.length) return `it is being imported on ${held[0].machine}.`;
  return "";
}

/** Why an episode holds the video `video`, of `bytes` bytes, in plain words: its whole record names the video at that size.
    "" when none does. */
export function episodeHolding({ root, video, bytes }) {
  const episodes = episodesFolder(root);
  let names = [];
  try {
    names = readdirSync(episodes).filter((n) => !n.startsWith("."));
  } catch (e) {
    return "";
  }
  for (const name of names.sort()) {
    const { record } = readEpisode(join(episodes, name));
    if (record && record.video && record.video.file === video && record.video.bytes === bytes) return `already imported as ${name}. It stays in the drop folder until its late check passes, or for a person to delete.`;
  }
  return "";
}

/** Take away the status files this Mac's runs left when they stopped before they were done: a status of this Mac, `machine`,
    with nothing failed, no problem and no hold, that has gone unwritten for 10 minutes, or whose run is no longer running
    (one run at a time works a drop folder, so a run of this Mac that is not this one and not running has stopped). Gives
    back the videos whose status was taken away, to be imported again. A video held is no import that stopped: its status
    stays, and is taken away when the video is no longer held (releaseHeld). */
export function clearCrashes({ root, machine, now = Date.now(), alive = isRunning, pid = process.pid }) {
  const cleared = [];
  for (const { status } of readStatuses(root, now)) {
    if (!status || status.machine !== machine || status.failed || status.problem || status.held) continue;
    const gone = status.pid !== pid && !alive(status.pid);
    if (!gone && !leftByCrash(status, now, machine)) continue;
    removeStatus(root, status.video, machine, status.import || "");
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

/** Keep a late check still to be made, written whole on this Mac's own disk, under another name and then renamed. */
export function writePending(home, pending) {
  const file = pendingFile(home, pending.id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.writing`, JSON.stringify(pending, null, 2) + "\n");
  renameSync(`${file}.writing`, file);
}

/** The late checks this Mac has still to make, oldest first. One that cannot be read is left out. */
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

/** When a late check is due, in milliseconds. */
export const dueAt = (pending) => pending.lastCopy + LATE_CHECK_MS;

/** A time of day as a person reads it, "10:15". */
const clockTime = (ms) => new Date(ms).toTimeString().slice(0, 5);

/** The options the rule is given in a run: the clone and the check of one disk a test gives, and the log. */
const ruleOpts = (deps) => ({ ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log: deps.log || (() => {}) });

/** The label of a light import's video, as its statuses carry it, from its late check: { label }, or nothing. */
const labelOf = (pending) => (pending.label ? { label: pending.label } : {});

/** Write the status of a video whose import is waiting for its late check, so the other Mac sees this one is still at it. */
function waitingStatus(pending, deps, step) {
  try {
    writeStatus(pending.root, { version: 1, machine: pending.machine, pid: process.pid, ...(pending.importId ? { import: pending.importId } : {}), video: pending.video, bytes: pending.bytes, seconds: pending.seconds, step, at: localStamp(new Date(Date.now())), ...labelOf(pending) }, textWriter({ work: join(pending.work, "status"), ...ruleOpts(deps) }));
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
  const { log = () => {}, notify = () => {} } = deps;
  const opts = ruleOpts(deps);
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
      log(`${pending.video}: could not be taken out of the drop folder (${e.code || e.message}). Delete it there by hand.`);
    }
    try {
      removeStatus(pending.root, pending.video, pending.machine, pending.importId || "");
      rmSync(pendingFile(deps.episode.home, pending.id), { force: true });
    } catch (e) {
      log(`${pending.video}: its late check passed, but it could not be put away (${e.code || e.message}). The next run checks it again.`);
    }
    log(`${pending.video}: the late check passed: every file of "${pending.name}" is whole in Dropbox. ${same ? "The video is taken out of the drop folder." : "The video in the drop folder is another file of that name now, so it is left there."}`);
    return { ok: true, problems };
  }
  for (const problem of problems) log(`${pending.video}: the late check found a problem: ${problem}`);
  const said = problems.join(" ");
  if (!pending.problem) {
    // A light import's video is named by its label, as in every notice of its import: a notice may show on a shared screen.
    notify(`Dropbox lost a file of ${pending.label || basename(pending.video, extname(pending.video))}. The video stays in the drop folder; see the log.`);
    try {
      noteProblem(pending, said, deps);
    } catch (e) {
      log(`${pending.video}: the problem could not be written into its cut plan (${String(e.message).replace(/\.$/, "")}).`);
    }
  }
  pending.problem = said;
  try {
    writePending(deps.episode.home, pending);
  } catch (e) {
    log(`${pending.video}: its late check could not be kept for the next run (${e.code || e.message}).`);
  }
  try {
    writeStatus(pending.root, { version: 1, machine: pending.machine, pid: process.pid, ...(pending.importId ? { import: pending.importId } : {}), video: pending.video, bytes: pending.bytes, seconds: pending.seconds, step: "Late check", at: localStamp(new Date(Date.now())), problem: said, ...labelOf(pending) }, textWriter({ work: join(pending.work, "status"), ...opts }));
  } catch (e) {
    log(`${pending.video}: its status could not say the problem (${String(e.message).replace(/\.$/, "")}).`);
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

/** Whether the light import leaves the video `name` where it is, held: a light import (`deps.light`) of a file that Zoom's
    names say is its download. Only an episode import asks, so a watched folder that is not this Mac's drop folder and the
    one-file command line never hold anything. */
const holdsZoom = (name, deps) => Boolean(deps.light) && isZoomName(name);

/** Hold the video `name` in the drop folder `dir`: write the status that says why it is not imported, as a new file by the
    rule, so that both Macs' `episodes` say it. It is held whether or not the status could be written, and the log says so,
    once, when it could not. */
function hold(name, dir, deps, told) {
  const { episode, log = () => {}, clock = Date.now } = deps;
  const work = join(runsFolder(episode.home), `held-${process.pid}-${clock()}`);
  try {
    const bytes = statSync(join(dir, name), { throwIfNoEntry: false })?.size ?? 0;
    writeStatus(episode.root, { version: 1, machine: episode.machine, pid: process.pid, video: name, bytes, seconds: null, step: "Held", at: localStamp(new Date(clock())), held: ZOOM_HELD }, textWriter({ work, ...ruleOpts(deps) }));
  } catch (e) {
    if (!told.has(`status:${name}`)) log(`${name}: its status could not be written into Episodes/.importing (${String(e.message).replace(/\.$/, "")}). It is held all the same.`);
    told.add(`status:${name}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return ZOOM_HELD;
}

/** Take away this Mac's status of each video it held that it holds no longer: the file has left the drop folder `dir`, as
    when it is put in BRIMM VIDEO Transfer, or is another file of that name (its size is not the status's), or this is no
    light import (`deps.light`) any more. */
function releaseHeld(dir, deps) {
  const { episode, log = () => {} } = deps;
  for (const { status } of readStatuses(episode.root)) {
    if (!status || !status.held || status.machine !== episode.machine) continue;
    const size = statSync(join(dir, status.video), { throwIfNoEntry: false })?.size;
    if (holdsZoom(status.video, deps) && size === status.bytes) continue;
    try {
      removeStatus(episode.root, status.video, episode.machine, status.import || "");
    } catch (e) {
      log(`${status.video}: the status that said it was held could not be taken away (${String(e.message).replace(/\.$/, "")}).`);
    }
  }
}

/** How often the wait for a late check looks in the drop folder for videos that have arrived meanwhile. */
const LOOK_AGAIN_MS = 60 * 1000;

/** The episode import of this Mac's drop folder `dir`, with the folder's lock held: the late checks earlier runs left that
    are due, first; then each video waiting in the folder (`importOne(name)`, which resolves what uneditedFile does), unless
    an episode or a status holds it (heldBy), or, in a light import (`deps.light`), it is a Zoom download, which is held in
    the folder with a status that says why until the import takes them; then, while any late check of this run is not yet
    due, a wait of a minute at most, a look for videos that arrived meanwhile, and each late check that has come due. The
    Mac is kept awake while there is work (`deps.keepAwake`). Resolves the results of the videos imported, and of those
    held, each with `held`. */
export async function importEpisodes(dir, deps, importOne) {
  const { episode, log = () => {}, wait, clock = Date.now, keepAwake = caffeinate } = deps;
  const results = [];
  // The files tried in this run, by name, inode and size: a video dropped again under the same name is another file. A video
  // held by an episode or a status is looked at again each minute, and the log says why once.
  const seen = new Set();
  const told = new Set();
  // Each late check is made once in a run: one that found a problem, or could not be put away, waits for the next run.
  const checked = new Set();
  let awake = false;
  const wake = () => {
    if (!awake) keepAwake(process.pid);
    awake = true;
  };
  const mine = () => readPendings(episode.home).filter((p) => p.machine === episode.machine && resolve(p.root) === resolve(episode.root) && !checked.has(p.id));
  const finishDue = (problems) => {
    for (const pending of mine()) {
      if ((problems || !pending.problem) && clock() >= dueAt(pending)) {
        wake();
        checked.add(pending.id);
        finishLate(pending, deps);
      }
    }
  };
  // Whether an import was stopped because its video was replaced meanwhile: the new file is then looked for at once.
  let changed = false;
  // The videos whose import failed in this run, by their files: once the failed status is taken away, as `retry` does, the
  // video is looked at again.
  const failed = new Map();
  // Whether the last look imported anything, which then has its late check to wait for.
  let progressed = false;
  const importWaiting = async (first) => {
    noteSeen(episode.home, dir, clock());
    releaseHeld(dir, deps);
    for (const [id, name] of failed) {
      const still = readStatuses(episode.root).some(({ status }) => status && status.video === name && status.machine === episode.machine && status.failed);
      if (!still) {
        failed.delete(id);
        seen.delete(id);
      }
    }
    const key = (name) => {
      const id = fileId(join(dir, name));
      return id ? `${name}:${id.ino}:${id.size}` : name;
    };
    let names;
    try {
      names = waitingToCut(readdirSync(dir)).filter((name) => !seen.has(key(name)));
    } catch (e) {
      log(`The folder could not be read (${e.code || e.message}). If it is in Dropbox or another cloud drive, allow node to read it in System Settings, Privacy & Security, Files and Folders.`);
      return;
    }
    if (first) log(names.length ? `Looked in the folder: ${names.length} waiting (${names.join(", ")}).` : "Looked in the folder: nothing is waiting.");
    for (const name of names) {
      const id = key(name);
      let held = heldBy({ root: episode.root, video: name, bytes: statSync(join(dir, name), { throwIfNoEntry: false })?.size ?? 0 });
      // A light import takes no Zoom download yet: it is left in the folder, and its status says why.
      if (!held && holdsZoom(name, deps)) held = hold(name, dir, deps, told);
      if (held) {
        if (!told.has(`${id}:${held}`)) {
          told.add(`${id}:${held}`);
          log(`${name}: ${held}`);
          results.push({ ok: true, name, held });
        }
        continue;
      }
      seen.add(id);
      wake();
      // While a video is imported, which can take many minutes, the videos waiting for their late checks go on saying so.
      const { every = setInterval, cancel = clearInterval } = deps;
      const keep = every(() => {
        for (const pending of mine().filter((p) => !p.problem)) waitingStatus(pending, deps, "Waiting for its late check");
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
        const said = readStatuses(episode.root).some(({ status }) => status && status.video === name && status.machine === episode.machine && status.failed);
        if (said) failed.set(id, name);
        else log(`${name}: its import failed, and its status, which would say so, could not be written, so it is not tried again in this run.`);
      }
      if (result.filed) progressed = true;
      // A video still arriving is looked at again.
      if (result.arriving) seen.delete(id);
      results.push(result);
    }
  };
  clearRuns(episode.home, deps.alive || isRunning);
  for (const video of clearCrashes({ root: episode.root, machine: episode.machine, ...(deps.alive ? { alive: deps.alive } : {}) })) log(`${video}: an import of it on this Mac stopped before it was done, so it is imported again.`);
  finishDue(true);
  await importWaiting(true);
  while (changed) {
    changed = false;
    await importWaiting(false);
  }
  for (;;) {
    const open = mine().filter((p) => !p.problem);
    if (!open.length) {
      // A last look, so that a video that came, or a failed import taken again, while this run worked is not left until
      // something lands in the folder. Anything it imports has its late check waited for, as the others had.
      progressed = false;
      do {
        changed = false;
        await importWaiting(false);
      } while (changed);
      if (!progressed) break;
      continue;
    }
    wake();
    const left = Math.min(...open.map(dueAt)) - clock();
    if (left > 0) {
      for (const pending of open) waitingStatus(pending, deps, "Waiting for its late check");
      await wait(Math.min(LOOK_AGAIN_MS, left));
      await importWaiting(false);
      while (changed) {
        changed = false;
        await importWaiting(false);
      }
    }
    finishDue(false);
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
  const needed = new Set(readPendings(home).map((p) => resolve(p.work)));
  const gone = [];
  for (const name of names) {
    // A run's folder is named for its process: "<pid>-<time>", or a command's word first ("push-", "finish-", "reel-").
    const m = /^(?:[a-z]+-)?(\d+)-\d+$/.exec(name);
    if (!m || alive(Number(m[1])) || needed.has(resolve(join(runs, name)))) continue;
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
export function noteSeen(home, dir, now) {
  const seen = readSeen(home);
  let changed = false;
  for (const [key, entry] of Object.entries(seen)) {
    const [name, ino, size] = key.split(/:(?=\d+:\d+$)|:(?=\d+$)/);
    if (!entry || !sameFile(entry.path, { ino: Number(ino), size: Number(size) }) || basename(entry.path) !== name) {
      delete seen[key];
      changed = true;
    }
  }
  let names = [];
  try {
    names = readdirSync(dir).filter(isMedia);
  } catch (e) {
    // The folder cannot be read now, and nothing new is noted.
  }
  for (const name of names) {
    const id = fileId(join(dir, name));
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
