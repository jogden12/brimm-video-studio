// The import status files: small files for each import, in Episodes/.importing/ in Dropbox, so that both Macs can see them.
// Each says which Mac is importing which video, the video's size and length, the step the import is at, and when it was
// written. A status file is never written into: each write is a new file, named for the video, the Mac, the import's own short
// id and the next number, as "Pricing talk.mp4 (Mac Studio) k3j9x 3.json", and the one before is then deleted. The id keeps
// two imports of one name apart, as of a video dropped again under the same name. The import writes one at the start, at each
// step and at least once a minute, so a status not written for 10 minutes is an import that stopped, as when the Mac slept
// or the run was killed. They are taken away once the import's files have passed the late check. One that says why the
// import failed, or what the late check found wrong, is left for a person: only `edit.js retry` takes it away. While a
// status holds its video, the video is not imported again. One that says why a video is held, not imported and left in the
// drop folder on purpose (a Zoom download, until the import takes them), is left until the video leaves the folder: the
// import takes it away then, or when it no longer holds that kind of video.
// Nothing here runs a program. A status file is written only through the rule's text writer, which the caller gives.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { importingFolder } from "./settings.js";

/** How long a status may go unwritten before its import counts as stopped: 10 minutes. The import writes one at least once a
    minute. */
export const STALE_MS = 10 * 60 * 1000;

/** The longest name a file can have on the Mac's disk, in bytes. */
const NAME_BYTES = 255;
/** What a status file's name keeps free after the video's and the Mac's names: an import's id (base 36 of an inode, 13
    characters at most) and a space, and a number of up to 8 digits with ".json". */
const ID_AND_NUMBER_BYTES = 14 + 13;

/** The start of every status file's name of a video from a Mac: the video's file name, cut on a whole character so that the
    whole name fits the disk, and the Mac's name in brackets. It does not depend on the import's id or the number. */
function startOf(video, machine) {
  const tail = ` (${machine}) `;
  const room = NAME_BYTES - ID_AND_NUMBER_BYTES - Buffer.byteLength(tail);
  let name = basename(video);
  while (Buffer.byteLength(name) > room) name = [...name].slice(0, -1).join("");
  return `${name}${tail}`;
}

/** The name of a status file: the video's file name (cut to fit), the Mac that imports it in brackets, the import's own id
    when it has one, and the file's number. A path is cut to its file's name. */
export const statusName = (video, machine, n, id = "") => `${startOf(video, machine)}${id ? `${id} ` : ""}${n}.json`;

/** Whether a file name in Episodes/.importing/ starts as the status files of `video` from the Mac `machine` do: the start of
    `statusName`, and nothing of the import's id or the number. It says of a file that cannot be read whose it was meant to be. */
export const isStatusFileOf = (name, video, machine) => name.startsWith(startOf(video, machine));

/** The number at the end of a status file's name, or 0 when it has none. */
const numberOf = (name) => {
  const m = / (\d+)\.json$/.exec(name);
  return m ? Number(m[1]) : 0;
};

/** The names in Episodes/.importing/ that are one video's status files from one Mac, each with its number: of the import
    `id`, or of every import of the video when no id is given. The video's name and the Mac's may both hold brackets, so a
    name is matched against the one it would have, and not taken apart. */
function filesOf(names, video, machine, id) {
  const start = startOf(video, machine);
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
    ffprobe has read the length, and `at` is when it was written (localStamp). `failed`, why the import failed,
    `problem`, what the late check found wrong, and `held`, why the video is left in the drop folder and not imported, are
    there only when they apply, and so is `label`, the name of a light import's video until she answers (kinds.js labelFor),
    which a command shows in place of the file's name. A status that waits for its late check also carries `due`, when the
    check is due, in milliseconds (filing.js waitingStatus); it is not looked at here, so a bad one never makes the whole status
    unreadable, and `dueOf` reads it only when it is a finite number. */
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
    [s.problem === undefined || (typeof s.problem === "string" && s.problem !== ""), "the problem it found cannot be read"],
    [s.held === undefined || (typeof s.held === "string" && s.held !== ""), "why the video is held cannot be read"],
    [s.label === undefined || (typeof s.label === "string" && s.label !== ""), "its label cannot be read"]
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

/** One video's statuses at `now`, in milliseconds, from the Macs `machines`: of `readStatuses`, those that can be read, are
    of `video` and were written by one of the Macs, of any state, stale or not, and the paths of the files that cannot be
    read and are named for `video` as a status file of one of the Macs is (isStatusFileOf). As { statuses, unreadable }. */
export function statusesOf(root, video, machines, now = Date.now()) {
  const read = readStatuses(root, now);
  const statuses = read.filter((r) => r.status && r.status.video === video && machines.includes(r.status.machine)).map((r) => r.status);
  const unreadable = read.filter((r) => !r.status && machines.some((m) => isStatusFileOf(basename(r.file), video, m))).map((r) => r.file);
  return { statuses, unreadable };
}

/** When a status says its late check is due, in milliseconds: `due`, when it is a finite number, and null for anything else
    or when it has none. `statusFault` does not look at it, so a bad one never makes a status unreadable, and a Mac that
    does not know the field reads the status as it always has. */
export const dueOf = (status) => (typeof status.due === "number" && Number.isFinite(status.due) ? status.due : null);

/** Take away the status files of one video from one Mac, `machine`, under `root`: of the import `id` alone, once its files
    have passed the late check; or of every import of the video, with no id, at this Mac's next run after a crash, or by
    `edit.js retry`. Nothing happens when there is none. */
export function removeStatus(root, video, machine, id) {
  for (const f of filesOf(namesIn(root), video, machine, id)) rmSync(join(importingFolder(root), f.name), { force: true });
}

/** Where an import has got to, by its whole status at `now`, in milliseconds: "failed" when it says why it failed; "problem"
    when its files were copied in but the late check found something wrong; "held" when the video is left in the drop folder
    on purpose, which is no import at all; otherwise "running" while it was written in the last 10 minutes, and "stopped"
    after that. A failed import, one with a problem and a held video stay as they are, however old: a person takes on the
    first two, and the import takes away the last when the video leaves the folder. */
export function importState(status, now) {
  if (status.failed) return "failed";
  if (status.problem) return "problem";
  if (status.held) return "held";
  return isStale(status, now) ? "stopped" : "running";
}

/** Whether a status holds its video, so that the import does not take it again: while its import runs, after it failed,
    after its late check found a problem, and while the video is held. A stopped import does not hold it, and nor does a
    status that could not be read (null). */
export const holdsVideo = (status, now) => status !== null && importState(status, now) !== "stopped";

/** Whether a status was left behind by a crash on this Mac, `machine`, so that this Mac's next run takes it away and imports
    the video again: it stopped, with nothing failed and no problem, and this Mac wrote it. The other Mac's are its own to
    take away. */
export const leftByCrash = (status, now, machine) => status !== null && status.machine === machine && importState(status, now) === "stopped";
