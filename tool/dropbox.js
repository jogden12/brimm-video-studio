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
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { compiledHelper, hasXcodeTools, helperCommand, helperSource } from "./helpers.js";
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

/** How long a read of a placeholder may go with no bytes coming before it is given up: two minutes. */
export const READ_QUIET_MS = 2 * 60 * 1000;

/** A stretch of time as a person reads it: "50 ms", "2 minutes". */
const spoken = (ms) => (ms < 60000 ? `${ms} ms` : `${ms / 60000} minute${ms === 60000 ? "" : "s"}`);

/** The fallback read, for a Mac with Xcode's command line tools and no compiled brimm-read-through (read-through.swift does the
    same work). What python3 runs to read a file through: it reads the file to its end, a mebibyte at a time, and after each read says on
    its standard output how much of it it has read. Each program on a Mac has a setting for whether its reads of a file that is
    not here yet have the file brought down, and one the launch agent starts has it off, as have the programs it starts: such
    a read is refused at once, with "Resource deadlock avoided" (EDEADLK; Apple's TN3150 and the getiopolicy_np manual). Node
    cannot change the setting, so python3 turns it on first, for itself alone, with setiopolicy_np:
    IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES (3), IOPOL_SCOPE_PROCESS (0), IOPOL_MATERIALIZE_DATALESS_FILES_ON (2). When the
    file cannot be read, python3 says why in plain words, on its standard error. python3 comes with Xcode's command line
    tools, which each Mac has. brimm-operations' transcript tool brings a placeholder down the same way. */
const READ_THROUGH = [
  "import ctypes, sys",
  "if ctypes.CDLL(None).setiopolicy_np(3, 0, 2) != 0:",
  "    sys.exit('reads that bring a file down could not be turned on')",
  "try:",
  "    with open(sys.argv[1], 'rb', buffering=0) as f:",
  "        n = 0",
  "        while True:",
  "            got = f.read(1048576)",
  "            if not got:",
  "                break",
  "            n += len(got)",
  "            sys.stdout.write('%d\\n' % n)",
  "            sys.stdout.flush()",
  "except OSError as e:",
  "    sys.exit(e.strerror or str(e))"
].join("\n");

/** What is said when there is no way to read a file through: neither the app's own reader nor Xcode's command line tools. */
export const NO_READ_THROUGH = "nothing on this Mac can bring it down: BRIMM Video Studio's own reader is not here, and nor are Xcode's command line tools";

/** How to start the read: brimm-read-through beside node when it is there, else python3 with READ_THROUGH when Xcode's command
    line tools are here, else none. Xcode's tools are asked about only when there is no compiled reader. `bin`, `exists` and
    `xcodeTools` are the Mac's own unless a test gives others. */
export function readThroughCommand({ bin, exists, xcodeTools = hasXcodeTools } = {}) {
  return compiledHelper("read-through", { bin, exists }) || (xcodeTools() ? { program: "/usr/bin/python3", args: ["-I", "-c", READ_THROUGH] } : null);
}

/** Read a file to its end and let what is read go: Dropbox then brings all of it down to this Mac, as it does for a file that
    is there only as a placeholder. The reader (readThroughCommand) is given the file as an argument of its own. Resolves
    when it is read. Rejects when it cannot be read, saying why in the reader's words, in plain words when no bytes come
    for `quietMs`, so that a placeholder Dropbox does not bring down never holds a run: the reader is then stopped, and with
    NO_READ_THROUGH, starting nothing, when there is no reader. `spawn` is how the reader is started, for a test to give
    another. */
export const readThrough = (path, { spawn: start = spawn, quietMs = READ_QUIET_MS, bin, xcodeTools } = {}) => new Promise((done, fail) => {
  const cmd = readThroughCommand({ bin, xcodeTools });
  if (!cmd) return fail(new Error(NO_READ_THROUGH));
  const reader = start(cmd.program, [...cmd.args, path], { stdio: ["ignore", "pipe", "pipe"] });
  let why = "";
  let timer = null;
  const quiet = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      reader.kill("SIGKILL");
      fail(new Error(`Dropbox sent nothing of it for ${spoken(quietMs)}, so it was given up`));
    }, quietMs);
  };
  quiet();
  reader.stdout.on("data", quiet);
  reader.stderr.on("data", (d) => {
    why = (why + d).slice(-4000);
  });
  reader.on("error", (e) => {
    clearTimeout(timer);
    fail(e);
  });
  reader.on("close", (code) => {
    clearTimeout(timer);
    if (code === 0) done();
    else fail(new Error(lastLine(why)));
  });
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
    `{ from, to, bytes }`, and throws as cloneIn does. `onCopy({ from, to, bytes })`, when given, is called once the work copy is written whole
    and before it is put in (a local import tells the late check of the first record here, Phase 3, L3). `opts` are cloneIn's. */
export function textWriter({ work, keep = false, onCopy, ...opts }) {
  return (to, text, { replace = false } = {}) => {
    mkdirSync(work, { recursive: true });
    written += 1;
    const from = join(work, `${process.pid}-${written}-${basename(to)}`);
    writeFileSync(from, text);
    try {
      if (onCopy) onCopy({ from, to, bytes: statSync(from).size });
      (replace ? replaceIn : cloneIn)(from, to, opts);
      return { from, to, bytes: statSync(from).size };
    } finally {
      if (!keep) rmSync(from, { force: true });
    }
  };
}

/** Whether the first `length` bytes of the files at `a` and `b` are the same, read a megabyte at a time. False when either
    cannot be read. */
export function startsAlike(a, b, length) {
  let fa;
  let fb;
  try {
    fa = openSync(a, "r");
    fb = openSync(b, "r");
    const size = 1024 * 1024;
    const ba = Buffer.alloc(size);
    const bb = Buffer.alloc(size);
    for (let at = 0; at < length; at += size) {
      const n = Math.min(size, length - at);
      if (readSync(fa, ba, 0, n, at) !== n || readSync(fb, bb, 0, n, at) !== n || !ba.subarray(0, n).equals(bb.subarray(0, n))) return false;
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    if (fa !== undefined) closeSync(fa);
    if (fb !== undefined) closeSync(fb);
  }
}

/** Whether the files at `a` and `b` hold the same bytes. */
export function sameBytes(a, b) {
  const sa = statSync(a, { throwIfNoEntry: false });
  const sb = statSync(b, { throwIfNoEntry: false });
  return Boolean(sa && sb) && sa.size === sb.size && startsAlike(a, b, sa.size);
}

/** The source of the helper that asks macOS whether Dropbox reports a file uploaded (ubiquitousItemIsUploadedKey): uploaded.swift, beside the tool. Compiled, it is
    brimm-uploaded beside node. */
export const UPLOADED = helperSource("uploaded");
/** How long the helper may take: swift compiles it each time, when there is no compiled helper. */
export const UPLOADED_TIMEOUT_MS = 20 * 1000;

/** Whether Dropbox reports the file at `path` uploaded: true or false, or null when that cannot be told (no helper: neither brimm-uploaded beside node nor swift, a file outside Dropbox, a timeout, a failure, an
    answer that is not the helper's JSON). Synchronous: it never gives a promise. */
export function uploadedOf(path, { swift = "", bin, exec = execFileSync, timeoutMs = UPLOADED_TIMEOUT_MS } = {}) {
  const helper = helperCommand("uploaded", { swift, bin });
  if (!helper) return null;
  try {
    const out = exec(helper.program, [...helper.args, path], { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] });
    const said = JSON.parse(String(out).trim());
    return said && (said.uploaded === true || said.uploaded === false) ? said.uploaded : null;
  } catch (e) {
    return null;
  }
}

/** The source of the helper that asks Dropbox to make a file online-only (evictUbiquitousItem): online-only.swift, beside the tool. Compiled, it is
    brimm-online-only beside node. */
export const ONLINE_ONLY = helperSource("online-only");
/** How long the helper may take: swift compiles it each time, when there is no compiled helper. */
export const ONLINE_ONLY_TIMEOUT_MS = 20 * 1000;

/** Asks Dropbox to make the file at `path` online-only: true or false from the helper's document, or null when that cannot be told (no helper: neither brimm-online-only beside node nor swift, a timeout, a failure, an
    answer that is not the helper's JSON). On false, `said` is given the helper's error text. Synchronous: it never gives a promise. */
export function makeOnlineOnly(path, { swift = "", bin, exec = execFileSync, timeoutMs = ONLINE_ONLY_TIMEOUT_MS, said = () => {} } = {}) {
  const helper = helperCommand("online-only", { swift, bin });
  if (!helper) return null;
  try {
    const out = exec(helper.program, [...helper.args, path], { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] });
    const doc = JSON.parse(String(out).trim());
    if (!doc || (doc.onlineOnly !== true && doc.onlineOnly !== false)) return null;
    if (doc.onlineOnly === false && typeof doc.error === "string") said(doc.error);
    return doc.onlineOnly;
  } catch (e) {
    return null;
  }
}
