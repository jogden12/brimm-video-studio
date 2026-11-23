// Studio's own names in a Reel Kit project, known by Studio (plan Task 10; reel-kit-worker.js runs these around every worker).
//
// A CLAUDE.md, an AGENTS.md, a .claude folder and the rest of OWN_NAMES are what a later Claude Code (the HyperFrames app's agent, in the
// project's public/) takes as its instructions and settings, so none may be the worker's. The sandbox and the hook keep the worker from
// making them; this is what holds when one gets in anyway (a folder moved in whole, a link, a name in letters the disk folds into one
// of them). The project itself can't say which of them are Studio's, since the worker writes there, so Studio keeps the list of the
// ones it wrote outside the project, beside the worker's settings (reel-kit-worker.js ownFile): each by its path, what file it is
// (device, inode, size, change time) and its SHA-256 (`noteOwn`). `sweepOwn` looks the project over, before every run and after it:
// every entry under one of the names that is not on the list, or is not the file noted, is moved out of the project, into Studio's own
// place beside that list (reel-kit-worker.js asideDir: `<slug> set aside/<when>/<its path>`, where the worker can neither read nor
// write), by renaming (a link is moved as itself; nothing is ever copied, deleted or written over), and named in the log. The run it
// was found at fails.
//
// The look is not sandboxed, so it must not be steered: by then nothing of the worker's should run (`stopHolders`, before each look,
// names in the log what still holds the project or its temp folder open, and stops none of it, as a holder may be hers), and each step
// is checked against the one before it. The walk
// (`ownEntries`) goes into a folder only when its real path is where the walk is and it is the folder it looked at (device and inode),
// before and after reading it; each move is made only when, just before it, the entry's folder is still at its real path inside the
// project and the entry is still the one the walk saw. Anything else is refused: the entry is left, said in the log, and the run
// fails. A SMALL WINDOW STAYS: Node has no openat or renameat, so between that last check and the rename itself a process still
// running (`stopHolders` names what holds the project open and stops none of it) could still swap a folder for a link. What was moved
// is looked at once more where it landed, and said loudly when it is not what was found.
//
// For Task 17 (`reelkit app`, which opens the HyperFrames app on a project's public/): run the look (reel-kit-worker.js sweepProject)
// immediately before opening the app, and open nothing when it finds anything; call `noteOwnFile` after each write of
// public/CLAUDE.md and public/AGENTS.md (a write changes the file's inode or change time, so one not noted again is set aside at the
// next look); and decide how the app's own writes under public/.claude/ are treated, since as it stands the next look sets that
// folder aside whole and fails that run (Studio did not write it).
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readCapped } from "./reel-kit-project.js";
import { foldName, idOf, ownIds, ownName } from "./reel-kit-worker-tools.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** The most of a noted file read for its SHA-256: notes for an agent are a few KB, and anything larger is not Studio's. */
const OWN_MOST = 8 << 20;
/** What a noted file is known by. */
const FACTS = Object.freeze(["dev", "ino", "size", "ctimeMs", "sha256"]);
/** What stands for a project that could not be looked over, where a path would be: its line in the log is its own. */
export const UNSEEN = "(the project could not be looked over)";

/** Write a file whole: under a name of this run's own beside it, then renamed. */
export function writeWhole(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const writing = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.writing`;
  try {
    writeFileSync(writing, text, { flag: "wx" });
    renameSync(writing, file);
  } catch (e) {
    rmSync(writing, { force: true });
    throw e;
  }
}

/** What the plain file at `path` is, { dev, ino, size, ctimeMs, sha256 }, read the safe way (no link followed, no pipe waited on, looked
    at once it is open, so the facts and the bytes are one file's); null for anything else, or a file larger than 8 MB. */
function factsOf(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size > OWN_MOST) return null;
    const buffer = Buffer.alloc(opened.size);
    let got = 0;
    while (got < buffer.length) {
      const read = readSync(fd, buffer, got, buffer.length - got, got);
      if (read === 0) break;
      got += read;
    }
    if (got !== buffer.length) return null;
    return { dev: opened.dev, ino: opened.ino, size: opened.size, ctimeMs: opened.ctimeMs, sha256: createHash("sha256").update(buffer).digest("hex") };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The list in the record `file`, [{ path, dev, ino, size, ctimeMs, sha256 }]; none when there is no record or it can't be read whole,
    so that a record gone wrong excuses nothing. */
export function readOwn(file) {
  try {
    const record = JSON.parse(readCapped(file, 1 << 20) ?? "null");
    const fits = (e) => isObject(e) && typeof e.path === "string" && typeof e.sha256 === "string" && ["dev", "ino", "size", "ctimeMs"].every((k) => typeof e[k] === "number");
    return isObject(record) && Array.isArray(record.files) ? record.files.filter(fits) : [];
  } catch {
    return [];
  }
}

/** Note in the record `file` that Studio wrote `rel` (a path inside the project `dir`, parted by `/`) and that it is Studio's as it is
    now: the entry, { path, dev, ino, size, ctimeMs, sha256 }, takes the place of an earlier one for the same path, and the record is
    written whole. Call it after every write of the file. Throws for anything but a plain file under one of Studio's own names, reached
    through real folders none of which is one of those names (a folder under one of them is never Studio's, and is set aside whole). */
export function noteOwn(file, dir, rel) {
  const parts = typeof rel === "string" ? rel.split("/") : [];
  if (!parts.length || parts.some((part) => part === "" || part === "." || part === ".." || part.includes("\0"))) throw new Error(`noteOwn: ${JSON.stringify(rel)} is not a path inside the project`);
  if (!ownName(parts.at(-1)) || parts.slice(0, -1).some(ownName)) throw new Error(`noteOwn: ${JSON.stringify(rel)} is not one of Studio's own names in a folder of the project`);
  let at = dir;
  for (const part of parts.slice(0, -1)) {
    at = join(at, part);
    if (!lstatSync(at).isDirectory()) throw new Error(`noteOwn: ${JSON.stringify(rel)} is not reached through folders`);
  }
  const facts = factsOf(join(dir, ...parts));
  if (facts === null) throw new Error(`noteOwn: ${JSON.stringify(rel)} is not a plain file that can be read`);
  const entry = { path: rel, ...facts };
  const files = readOwn(file);
  const at0 = files.findIndex((e) => e.path === rel);
  if (at0 < 0) files.push(entry);
  else files[at0] = entry;
  writeWhole(file, `${JSON.stringify({ files }, null, 2)}\n`);
  return entry;
}

/** Two paths that are one on the Mac's disk whichever way an accent is written. */
const samePath = (a, b) => a.normalize("NFC") === b.normalize("NFC");
const coded = (code, message) => Object.assign(new Error(message), { code });

/** Every entry under the project `dir` that is one of Studio's own names, each by its path inside (parted by `/`) and what it is,
    { kind, dev, ino } (`kind`: "file", "folder", "link" or "other"): by name as the Mac's disk folds one (ownName), or because the disk
    says it is the entry one of the names spelled plainly opens (ownIds: asked in every folder walked). But studio.json and its writing
    files at the top, which Studio writes itself. Links are looked at and never followed, and a folder under one of the names is looked
    into as any other. A folder is gone into only when its real path is where the walk is, inside the project, and it is still the
    folder the walk looked at once it has been read (device and inode): a folder swapped for a link meanwhile gives up the whole look.
    Whether each entry is one Studio wrote is sweepOwn's to say. null for a tree too large to look over (200,000 entries), one that
    can't be read, or one that changed under the walk. `read` is readdirSync (a test's, to change the tree under it). */
export function ownEntries(dir, { read = readdirSync } = {}) {
  const found = new Map();
  let seen = 0;
  let root;
  const walk = (folder, rel, was) => {
    if (!samePath(realpathSync.native(folder), folder)) throw coded("ELOOP", "a folder is not where it was");
    const names = read(folder);
    const now = lstatSync(folder);
    if (!now.isDirectory() || idOf(now) !== idOf(was)) throw coded("ELOOP", "a folder is not the one looked at");
    const ids = ownIds(folder);
    for (const name of names) {
      if (++seen > 200000) throw coded("E2BIG", "too many");
      const path = join(folder, name);
      const inside = rel ? `${rel}/${name}` : name;
      const entry = lstatSync(path);
      const folded = foldName(name);
      const top = rel === "" && (folded === "studio.json" || folded.startsWith(".studio.json"));
      if ((ownName(name) || ids.has(idOf(entry))) && !top) {
        found.set(inside, { kind: entry.isSymbolicLink() ? "link" : entry.isDirectory() ? "folder" : entry.isFile() ? "file" : "other", dev: entry.dev, ino: entry.ino });
      }
      if (entry.isDirectory()) walk(path, inside, entry);
    }
  };
  try {
    root = realpathSync.native(dir);
    walk(root, "", lstatSync(root));
    return found;
  } catch {
    return null;
  }
}

/** A new folder for one look's finds, `<aside>/<when>`, made by this call alone: its whole path. `aside` is Studio's own place for the
    project (reel-kit-worker.js asideDir). Throws when it can't be made, or when what is at `aside` is not a folder. */
function asideFor(aside) {
  mkdirSync(dirname(aside), { recursive: true });
  try {
    mkdirSync(aside);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  if (!lstatSync(aside).isDirectory()) throw coded("ENOTDIR", "set aside: not a folder");
  const when = new Date().toISOString().replace(/[:.]/g, "-");
  for (let n = 1; ; n++) {
    const place = join(aside, n === 1 ? when : `${when} ${n}`);
    try {
      mkdirSync(place);
      return place;
    } catch (e) {
      if (e.code !== "EEXIST" || n > 1000) throw e;
    }
  }
}

/** Why an entry could not be set aside, in a few words. */
const whyLeft = (e) => (e.code === "EXDEV" ? "Studio's set-aside folder is on another disk, and nothing is ever copied there" : e.code === "ESTALE" ? e.message : e.code || e.message);

/** Look the project `dir` over for Studio's own names (ownEntries) and set aside every one that Studio did not write: not on the list in
    the record `file` by its path, or on it but not the file noted (any of device, inode, size, change time or SHA-256 differs from the
    note or from what the walk saw, or it is no longer a plain file). Each is moved by renaming, as it is (a link as a link, a folder
    whole, what is under it going with it), to `<aside>/<when>/<its path>`, and named in a line of `log` that starts with `said` and
    says it "is not the file Studio noted". Just before each move the entry's folder must still be at its real path inside the
    project, and the entry the one the walk saw (device and inode); if not, or the rename fails (EXDEV, when `aside` is on another
    disk: never a copy and a delete), it is left where it is and said to be still in the project. What landed is looked at again, and
    said loudly when it is not what was found. Gives { planted, left }: the paths found, and those of them not moved. A project that
    can't be looked over gives UNSEEN in both, with a line of its own. Never throws, never copies, deletes or writes over anything.
    `entries` and `rename` are ownEntries and renameSync (a test's, to change the tree between the steps). */
export function sweepOwn({ file, dir, aside, said, log = () => {}, entries = ownEntries, rename = renameSync }) {
  try {
    const real = realpathSync.native(dir);
    const found = entries(real);
    if (found === null) {
      log(`${said}, the project could not be looked over.`);
      return { planted: [UNSEEN], left: [UNSEEN] };
    }
    const noted = new Map(readOwn(file).map((entry) => [entry.path, entry]));
    const studios = (rel) => {
      const entry = noted.get(rel);
      const saw = found.get(rel);
      if (!entry || saw.kind !== "file") return false;
      const facts = factsOf(join(real, rel));
      return facts !== null && FACTS.every((key) => facts[key] === entry[key]) && facts.dev === saw.dev && facts.ino === saw.ino;
    };
    const planted = [...found.keys()].filter((rel) => !studios(rel)).sort();
    // What is under a folder that is itself moved goes with it.
    const tops = planted.filter((rel) => !planted.some((other) => rel.startsWith(`${other}/`)));
    const left = [];
    let place = null;
    for (const rel of tops) {
      const what = `${said}, ${rel} in the project is under one of Studio's own names and is not the file Studio noted`;
      try {
        const saw = found.get(rel);
        const from = join(real, rel);
        place ??= asideFor(aside);
        const to = join(place, rel);
        mkdirSync(dirname(to), { recursive: true });
        // The last look before the move: its folder is where it was, by real path, and it is the entry the walk saw.
        if (!samePath(realpathSync.native(dirname(from)), dirname(from))) throw coded("ESTALE", "its folder is no longer where it was");
        const now = lstatSync(from);
        if (now.dev !== saw.dev || now.ino !== saw.ino) throw coded("ESTALE", "it is no longer the entry that was looked at");
        rename(from, to);
        const landed = lstatSync(to);
        if (landed.dev !== saw.dev || landed.ino !== saw.ino) {
          left.push(rel);
          log(`${what}: WHAT WAS MOVED IS NOT WHAT WAS FOUND (the project changed under the move). It is in "${basename(aside)}/${basename(place)}/${rel}", in Studio's place for the worker: look at it by hand.`);
          continue;
        }
        log(`${what}: it was set aside in "${basename(aside)}/${basename(place)}", in Studio's place for the worker.`);
      } catch (e) {
        left.push(rel);
        log(`${what}: it could not be set aside (${whyLeft(e)}), and is still in the project.`);
      }
    }
    return { planted, left };
  } catch (e) {
    log(`${said}, the project could not be looked over (${e.code || e.message}).`);
    return { planted: [UNSEEN], left: [UNSEEN] };
  }
}

/** The processes that hold one of `dirs` open, as `lsof -t +D <dir>` lists them (a working folder there, or any open file under it):
    their pids, or null when lsof could not be run or did not take the folder. A folder that is not there, or is not a folder, holds
    none. Exported for the render (reel-kit-render.js), which refuses to start while anything holds the project open. */
export function holdersOf(dirs, run = spawnSync) {
  const pids = new Set();
  for (const dir of dirs) {
    let real;
    try {
      if (!lstatSync(dir).isDirectory()) continue;
      real = realpathSync.native(dir);
    } catch {
      continue;
    }
    let ran;
    try {
      ran = run("/usr/sbin/lsof", ["-t", "+D", real], { encoding: "utf8", timeout: 120000, env: { LC_ALL: "C" } });
    } catch {
      return null;
    }
    // lsof ends 1 when no one holds it; its usage text is how it says it could not look.
    if (!ran || ran.error || !Number.isInteger(ran.status) || (ran.status !== 0 && /usage:/.test(String(ran.stderr ?? "")))) return null;
    for (const line of String(ran.stdout ?? "").split("\n")) if (/^\d+$/.test(line.trim())) pids.add(Number(line.trim()));
  }
  return [...pids];
}

/** The command line of the process `pid`, as `ps -o command=` says it with LC_ALL=C, or "" when it is not running or `ps` can't say. */
function commandOf(pid, run) {
  try {
    const ran = run("/bin/ps", ["-o", "command=", "-p", String(pid)], { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 });
    return ran && ran.status === 0 ? String(ran.stdout ?? "").trim().replace(/\s+/g, " ").slice(0, 300) : "";
  } catch {
    return "";
  }
}

/** Name what still runs with the project or the run's temp folder open, before the project is looked over, and stop none of it. Every
    process whose working folder or any open file is inside one of `dirs` (holdersOf), but this one and the one that started it
    (`spare`), is a line of `log` starting with `said`: its pid, when it started (`startOf(pid)`) and its command (`ps`), and that it
    was left running. It kills nothing: a holder may be hers (the HyperFrames app's agent in the project's public/, a Terminal left in
    it, QuickTime playing a render), and stopping it could lose her work. A later fix narrows a stop to processes that started at or
    after the worker's recorded start. Until then a process the worker started that left its process group can still change the
    project under the look: the checks of each step (ownEntries, sweepOwn) are what is left for that, as for a process holding
    nothing open there. Never throws. */
export async function stopHolders({ dirs, said, run = spawnSync, startOf, spare = [process.pid, process.ppid], log = () => {} }) {
  try {
    const pids = holdersOf(dirs, run);
    if (pids === null) return void log(`${said}, what still holds the project open could not be asked of lsof.`);
    for (const pid of pids.filter((p) => !spare.includes(p))) {
      const start = startOf(pid);
      const command = commandOf(pid, run);
      const what = [start === null ? "when it started could not be read" : `started ${start}`, command ? `running ${command}` : "its command could not be read"].join(", ");
      log(`${said}, process ${pid} (${what}) holds the project or its temp folder open: it was left running.`);
    }
  } catch (e) {
    log(`${said}, what still holds the project open could not be named (${e.code || e.message}).`);
  }
}
