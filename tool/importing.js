// The import status files: small files for each import, in Episodes/.importing/ in Dropbox, so that both Macs can see them.
// Each says which Mac is importing which video, the video's size and length, the step the import is at, and when it was
// written. A status file is never written into: each write is a new file, named for the video, the Mac, the import's own short
// id and the next number, as "Pricing talk.mp4 (Mac Studio) k3j9x 3.json", and the one before is then deleted. The id keeps
// two imports of one name apart, as of a video dropped again under the same name. The import writes one at the start, at each
// step and at least once a minute, so a status not written for 10 minutes is an import that stopped, as when the Mac slept
// or the run was killed. They are taken away once the import's files have passed the late check. One that says why the
// import failed, or what the late check found wrong, is left for a person: only `edit.js retry` takes it away. While a
// status holds its video, the video is not imported again.
// Nothing here runs a program. A status file is written only through the rule's text writer, which the caller gives.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { importingFolder } from "./settings.js";

/** How long a status may go unwritten before its import counts as stopped: 10 minutes. The import writes one at least once a
    minute. */
export const STALE_MS = 10 * 60 * 1000;

/** The name of a status file: the video's file name, the Mac that imports it in brackets, the import's own id when it has
    one, and the file's number. A path is cut to its file's name. */
export const statusName = (video, machine, n, id = "") => `${basename(video)} (${machine}) ${id ? `${id} ` : ""}${n}.json`;

/** The number at the end of a status file's name, or 0 when it has none. */
const numberOf = (name) => {
  const m = / (\d+)\.json$/.exec(name);
  return m ? Number(m[1]) : 0;
};

/** The names in Episodes/.importing/ that are one video's status files from one Mac, each with its number: of the import
    `id`, or of every import of the video when no id is given. The video's name and the Mac's may both hold brackets, so a
    name is matched against the one it would have, and not taken apart. */
function filesOf(names, video, machine, id) {
  const start = `${basename(video)} (${machine}) `;
  const rest = id === undefined ? /^(?:[0-9a-z]+ )?\d+\.json$/ : id ? new RegExp(`^${id} \\d+\\.json$`) : /^\d+\.json$/;
  return names.filter((n) => n.startsWith(start) && rest.test(n.slice(start.length))).map((n) => ({ name: n, n: numberOf(n) }));
}

/** The names in Episodes/.importing/ under `root`, or [] when there is no such folder. */
function namesIn(root) {
  try {
    return readdirSync(importingFolder(root));
  } catch (e) {
    return [];
  }
}

/** What is wrong with a status, in plain words: "" when it is whole. Its fields are { version: 1, machine, pid, video, bytes,
    seconds, step, at }, where `pid` is the run that wrote it, on its Mac, `video` is the file's name, `seconds` is null until
    ffprobe has read the length, and `at` is when it was written (localStamp). `failed`, why the import failed, and
    `problem`, what the late check found wrong, are there only when they apply. */
export function statusFault(s) {
  if (s === null || typeof s !== "object" || Array.isArray(s)) return "it is not an import's status";
  if (s.version !== 1) return `it is version ${JSON.stringify(s.version)}, and this brimm-video reads version 1`;
  const faults = [
    [typeof s.machine === "string" && s.machine !== "", "it names no Mac"],
    [Number.isInteger(s.pid) && s.pid > 0, "the run that wrote it cannot be read"],
    [s.import === undefined || (typeof s.import === "string" && /^[0-9a-z]+$/.test(s.import)), "the import it is of cannot be read"],
    [typeof s.video === "string" && s.video !== "" && s.video === basename(s.video), "it names no video"],
    [Number.isInteger(s.bytes) && s.bytes >= 0, "the video's size cannot be read"],
    [s.seconds === null || (typeof s.seconds === "number" && Number.isFinite(s.seconds) && s.seconds >= 0), "the video's length cannot be read"],
    [typeof s.step === "string" && s.step !== "", "it names no step"],
    [typeof s.at === "string" && Number.isFinite(Date.parse(s.at)), "when it was written cannot be read"],
    [s.failed === undefined || (typeof s.failed === "string" && s.failed !== ""), "why the import failed cannot be read"],
    [s.problem === undefined || (typeof s.problem === "string" && s.problem !== ""), "the problem it found cannot be read"]
  ];
  const found = faults.find(([ok]) => !ok);
  return found ? found[1] : "";
}

/** Write a video's status into Episodes/.importing/ under `root`, as a new file with the next number for the video and the
    Mac, through `writeText(to, text)`, the rule's text writer, which never writes over a file. The folder is made first
    when it is not there, and the files before this one are deleted after it. Gives back the file. It throws, and writes
    nothing, when the status is not whole. */
export function writeStatus(root, status, writeText) {
  const fault = statusFault(status);
  if (fault) throw new Error(`the import's status was not written, because ${fault}`);
  const folder = importingFolder(root);
  mkdirSync(folder, { recursive: true });
  const before = filesOf(namesIn(root), status.video, status.machine, status.import || "");
  const n = before.reduce((most, f) => Math.max(most, f.n), 0) + 1;
  const file = join(folder, statusName(status.video, status.machine, n, status.import || ""));
  writeText(file, JSON.stringify(status, null, 2) + "\n");
  for (const f of before) rmSync(join(folder, f.name), { force: true });
  return file;
}

/** Whether a status has gone unwritten for 10 minutes at `now`, in milliseconds. */
const isStale = (status, now) => now - Date.parse(status.at) >= STALE_MS;

/** The status files in Episodes/.importing/ under `root`, by name: for each video and Mac the one with the highest number,
    as { file, status, stale, n }, where `stale` says it was not written in the 10 minutes before `now`, in milliseconds. A
    lower number that Dropbox has not yet deleted is left out. A file that cannot be read is listed with status null, stale
    false, and `why` in plain words. Hidden files, and files that are not status files, are left out. [] when there is no
    folder. */
export function readStatuses(root, now = Date.now()) {
  const folder = importingFolder(root);
  const read = namesIn(root)
    .filter((n) => !n.startsWith(".") && numberOf(n) > 0)
    .sort()
    .map((name) => {
      const file = join(folder, name);
      const n = numberOf(name);
      let status;
      try {
        status = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        return { file, status: null, stale: false, n, why: `it could not be read (${e instanceof SyntaxError ? "it is not whole" : e.message})` };
      }
      const fault = statusFault(status);
      return fault ? { file, status: null, stale: false, n, why: `it could not be read (${fault})` } : { file, status, stale: isStale(status, now), n };
    });
  // Of one import's files, the highest number is the status.
  const key = (r) => JSON.stringify([r.status.video, r.status.machine, r.status.import || ""]);
  const highest = new Map();
  for (const r of read.filter((r) => r.status)) if (!highest.has(key(r)) || highest.get(key(r)).n < r.n) highest.set(key(r), r);
  return read.filter((r) => !r.status || highest.get(key(r)) === r);
}

/** Take away the status files of one video from one Mac, `machine`, under `root`: of the import `id` alone, once its files
    have passed the late check; or of every import of the video, with no id, at this Mac's next run after a crash, or by
    `edit.js retry`. Nothing happens when there is none. */
export function removeStatus(root, video, machine, id) {
  for (const f of filesOf(namesIn(root), video, machine, id)) rmSync(join(importingFolder(root), f.name), { force: true });
}

/** Where an import has got to, by its whole status at `now`, in milliseconds: "failed" when it says why it failed; "problem"
    when its files were copied in but the late check found something wrong; otherwise "running" while it was written in the
    last 10 minutes, and "stopped" after that. A failed import and one with a problem stay as they are, however old: only a
    person takes them on. */
export function importState(status, now) {
  if (status.failed) return "failed";
  if (status.problem) return "problem";
  return isStale(status, now) ? "stopped" : "running";
}

/** Whether a status holds its video, so that the import does not take it again: while its import runs, after it failed, and
    after its late check found a problem. A stopped import does not hold it, and nor does a status that could not be read
    (null). */
export const holdsVideo = (status, now) => status !== null && importState(status, now) !== "stopped";

/** Whether a status was left behind by a crash on this Mac, `machine`, so that this Mac's next run takes it away and imports
    the video again: it stopped, with nothing failed and no problem, and this Mac wrote it. The other Mac's are its own to
    take away. */
export const leftByCrash = (status, now, machine) => status !== null && status.machine === machine && importState(status, now) === "stopped";
