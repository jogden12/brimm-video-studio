// The rule for writing into Dropbox. On 2026-10-14 Dropbox (the macOS File Provider) undid two renames of large files minutes
// after they had returned, so nothing is written in place in a folder that syncs, nothing there is written into, and nothing
// there is renamed or moved. Each file is written whole in the run's own folder, on this Mac's own disk, and only then put in
// under its final name, as an APFS clone made by /bin/cp -c, which calls clonefile(2): it took 6 to 12 ms for a file of about
// 1 GB on the Mac Studio, and used no space. Node's copyFileSync with COPYFILE_FICLONE made a full copy there, so it is not
// used. cp -c itself copies byte for byte, and says nothing, when the two folders are on different disks (its manual says
// so), so the two are checked to be on one disk first. Where a clone cannot be made, nothing is copied: the command stops
// and says why. A file already there is deleted first and the new one cloned in. The work copy is kept until the late check,
// at least 15 minutes after the last copy, which copies a file in again when Dropbox has taken it away or left it short.
// And a file that Dropbox is still bringing over to this Mac can show its full size with no data in it yet, so a file counts
// as here only when its blocks on the disk cover its size, or the disk does not mark it dataless.
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { lastLine } from "./run.js";

/** How long after the last copy into Dropbox the late check is made: 15 minutes. On 2026-10-14 Dropbox undid two renames
    minutes after they had returned. */
export const LATE_CHECK_MS = 15 * 60 * 1000;

/** How long is waited between two looks at a file that Dropbox is still bringing over: the transcript tool's own number. */
const LOOK_MS = 5000;

/** The flag macOS sets on a file whose data is not on this Mac yet (SF_DATALESS, in sys/stat.h). */
const SF_DATALESS = 0x40000000;

/** How many text files this run has written, so that each has a name of its own in the work folder. */
let written = 0;

/** Clone the file at `from` to `to` with /bin/cp -c, which calls clonefile(2). Throws, saying why in cp's words, when cp
    fails or leaves no file there. On different disks cp makes a plain copy instead, so cloneIn checks that first. */
export function cloneFile(from, to) {
  const ran = spawnSync("/bin/cp", ["-c", from, to], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(ran.error ? ran.error.message : lastLine(ran.stderr));
  if (!existsSync(to)) throw new Error("there is no file of that name there after the clone");
}

/** Whether a file and a folder are on one disk, where a clone can be made. */
export const onSameDisk = (from, folder, stat = statSync) => stat(from).dev === stat(folder).dev;

/** What is wrong with the file at `to`, which should hold `bytes` bytes: "" when nothing is. */
function wrong(to, bytes) {
  const found = statSync(to, { throwIfNoEntry: false });
  if (!found) return "it is not there";
  return found.size === bytes ? "" : `it is ${found.size} bytes there, not ${bytes}`;
}

/** Put the whole work copy at `from` into Dropbox at `to`, under its final name, as a clone, by the rule. The folder must be
    there, and on the same disk as the work copy, and nothing must be under that name: a file in Dropbox is never written
    over (replaceIn deletes it first). The file is then looked at, and must be the work copy's size. The work copy is kept,
    for the late check. Throws, saying why in plain words, when the file is not there whole, and leaves nothing under its
    name. `clone`, `sameDisk` and `log` are the Mac's own unless a test gives others. */
export function cloneIn(from, to, { clone = cloneFile, sameDisk = onSameDisk, log = () => {} } = {}) {
  const folder = dirname(to);
  const name = basename(to);
  if (existsSync(to)) throw new Error(`${name} is in ${folder} already, and a file there is never written over.`);
  if (!existsSync(folder)) throw new Error(`${name} could not be put into ${folder}: the folder is not there. Nothing was copied.`);
  if (!sameDisk(from, folder)) throw new Error(`${name} could not be put into ${folder}: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was copied.`);
  const bytes = statSync(from).size;
  let why = "";
  try {
    clone(from, to);
    why = wrong(to, bytes);
  } catch (e) {
    why = String(e.message).replace(/\.$/, "");
  }
  if (!why) return;
  try {
    rmSync(to, { force: true });
  } catch (stays) {
    // What is there is not a file, and nothing was cloned into it.
  }
  log(`${name} could not be put into ${folder}: ${why}.`);
  throw new Error(`${name} could not be put into ${folder}: ${why}. Nothing was copied.`);
}

/** Put a new file in place of one in Dropbox: the old one is deleted first, and the new one cloned in (cloneIn), so nothing
    there is written into or renamed over. */
export function replaceIn(from, to, opts = {}) {
  rmSync(to, { force: true });
  cloneIn(from, to, opts);
}

/** The late check, made at least LATE_CHECK_MS after the last copy: the caller waits, and this looks. Each of `entries` is a
    file put in: `from` is its work copy, which is still kept, `to` is where it is in Dropbox, and `bytes` is its size. A file
    that is missing or short there is put in again from its work copy, by the rule (replaceIn, with `opts`), and the log says
    so. Gives back what is still wrong after that, a sentence in plain words for each file, for the run to log and to put
    first in the cut plan: none when every file is whole. */
export function lateCheck(entries, opts = {}) {
  const { log = () => {} } = opts;
  const problems = [];
  for (const { from, to, bytes } of entries) {
    const why = wrong(to, bytes);
    if (!why) continue;
    if (!existsSync(from)) {
      problems.push(`${basename(to)} is not whole in ${dirname(to)} (${why}), and its work copy is gone, so it could not be copied in again.`);
      continue;
    }
    log(`${basename(to)} is not whole in ${dirname(to)} at the late check (${why}), so it is copied in again from its work copy.`);
    try {
      // Dropbox may have taken the file's folder away with it, as edit/ or record/: it is made again. Making a folder is not
      // writing into a file.
      mkdirSync(dirname(to), { recursive: true });
      replaceIn(from, to, opts);
    } catch (e) {
      problems.push(e.message);
    }
  }
  return problems;
}

/** A file's flags, as `stat -f %Xf` prints them, in hex. */
function fileFlags(path) {
  const ran = spawnSync("/usr/bin/stat", ["-f", "%Xf", path], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(lastLine(ran.stderr));
  return parseInt(ran.stdout.trim(), 16);
}

/** Whether the file at `path` is here whole, and is not a placeholder that Dropbox shows at its full size before it has
    brought the data over to this Mac: its blocks on the disk cover its size, or, when they do not (as for a file APFS has
    compressed), the disk does not mark it dataless. An empty file is whole, and a file that is not there is not. Whether its
    size has settled is for the caller to say. `stat` and `flags` are the Mac's own unless a test gives others. */
export function isWhole(path, { stat = statSync, flags = fileFlags } = {}) {
  let found;
  try {
    found = stat(path);
  } catch (e) {
    return false;
  }
  if (found.blocks * 512 >= found.size) return true;
  try {
    return (flags(path) & SF_DATALESS) === 0;
  } catch (e) {
    return false;
  }
}

/** Read a file to its end and let what is read go: Dropbox then brings all of it down to this Mac, as it does for a file that
    is there only as a placeholder. Resolves when it is read, and rejects when it cannot be. */
export const readThrough = (path) => new Promise((done, fail) => {
  const stream = createReadStream(path);
  stream.on("data", () => {});
  stream.on("end", done);
  stream.on("error", fail);
});

/** Wait for files that Dropbox may still be bringing over: each is looked at, and while any is not whole, the wait is a few
    seconds and they are looked at again, `tries` looks in all. Gives back which are whole and which are not yet, each in the
    order given. `wait`, `stat` and `flags` are the Mac's own unless a test gives others. */
export async function waitWhole(paths, { wait = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 3, stat, flags } = {}) {
  const whole = (path) => isWhole(path, { ...(stat ? { stat } : {}), ...(flags ? { flags } : {}) });
  let notYet = paths.filter((path) => !whole(path));
  for (let look = 2; look <= tries && notYet.length; look++) {
    await wait(LOOK_MS);
    notYet = notYet.filter((path) => !whole(path));
  }
  return { whole: paths.filter((path) => !notYet.includes(path)), notYet };
}

/** How a small file is written into Dropbox by the rule: a record, a status file, the marker. Gives back a writer,
    `(to, text, { replace })`, which writes `text` whole in the folder `work`, under a name of its own each time, puts it in
    at `to` (cloneIn, or replaceIn when `replace` is true), and then deletes its work copy. With `keep`, the work copy stays,
    for the late check, and goes with the run's own folder. The writer gives back the file as the late check takes it,
    `{ from, to, bytes }`, and throws as cloneIn does. `opts` are cloneIn's. */
export function textWriter({ work, keep = false, ...opts }) {
  return (to, text, { replace = false } = {}) => {
    mkdirSync(work, { recursive: true });
    written += 1;
    const from = join(work, `${process.pid}-${written}-${basename(to)}`);
    writeFileSync(from, text);
    try {
      (replace ? replaceIn : cloneIn)(from, to, opts);
      return { from, to, bytes: statSync(from).size };
    } finally {
      if (!keep) rmSync(from, { force: true });
    }
  };
}
