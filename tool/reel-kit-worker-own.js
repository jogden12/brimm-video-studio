// Studio's own names in a Reel Kit project, known by Studio (plan Task 10; reel-kit-worker.js runs these around every worker).
//
// A CLAUDE.md, an AGENTS.md, a .claude folder and the rest of OWN_NAMES are what a later Claude Code (the HyperFrames app's agent, in the
// project's public/) takes as its instructions and settings, so none may be the worker's. The sandbox and the hook keep the worker from
// making them; this is what holds when one gets in anyway (a folder moved in whole, a link). The project itself can't say which of them
// are Studio's, since the worker writes there, so Studio keeps the list of the ones it wrote outside the project, beside the worker's
// settings (reel-kit-worker.js ownFile): each by its path, what file it is (device, inode, size, change time) and its SHA-256
// (`noteOwn`). `sweepOwn` looks the project over, before every run and after it: every entry under one of the names that is not on the
// list, or is not the file noted, is moved out of the project, into `<project folder> set aside/<when>/<its path>` beside it, by
// renaming (a link is moved as itself; nothing is ever deleted or written over), and named in the log. The run it was found at fails.
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readCapped } from "./reel-kit-project.js";
import { ownEntries, ownName } from "./reel-kit-worker-tools.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** The most of a noted file read for its SHA-256: notes for an agent are a few KB, and anything larger is not Studio's. */
const OWN_MOST = 8 << 20;
/** What a noted file is known by. */
const FACTS = Object.freeze(["dev", "ino", "size", "ctimeMs", "sha256"]);
/** What stands for a project that could not be looked over, where a path would be. */
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

/** A new folder for one look's finds, `<project folder> set aside/<when>` beside the project (real path `real`), made by this call alone:
    its whole path. Throws when it can't be made, or when what is at `<project folder> set aside` is not a folder. */
function asideFor(real) {
  const root = join(dirname(real), `${basename(real)} set aside`);
  try {
    mkdirSync(root);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  if (!lstatSync(root).isDirectory()) throw Object.assign(new Error("set aside: not a folder"), { code: "ENOTDIR" });
  const when = new Date().toISOString().replace(/[:.]/g, "-");
  for (let n = 1; ; n++) {
    const place = join(root, n === 1 ? when : `${when} ${n}`);
    try {
      mkdirSync(place);
      return place;
    } catch (e) {
      if (e.code !== "EEXIST" || n > 1000) throw e;
    }
  }
}

/** Look the project `dir` over for Studio's own names (reel-kit-worker-tools.js ownEntries: any case, no link followed, the top's
    studio.json and its writing files left out) and set aside every one that Studio did not write: not on the list in the record `file`
    by its path, or on it but not the file noted (any of device, inode, size, change time or SHA-256 differs, or it is no longer a plain
    file). Each is moved by renaming, as it is (a link as a link, a folder whole, what is under it going with it), to
    `<project folder> set aside/<when>/<its path>`, and named in a line of `log` that starts with `said`. Gives { planted, left }: the
    paths found, and those of them still in the project because they could not be moved (said in the log too). A project that can't be
    looked over gives UNSEEN in both. Never throws, never deletes, never writes over anything. */
export function sweepOwn({ file, dir, said, log = () => {} }) {
  try {
    const found = ownEntries(dir);
    if (found === null) {
      log(`${said}: ${UNSEEN}`);
      return { planted: [UNSEEN], left: [UNSEEN] };
    }
    const noted = new Map(readOwn(file).map((entry) => [entry.path, entry]));
    const studios = (rel) => {
      const entry = noted.get(rel);
      if (!entry) return false;
      const facts = factsOf(join(dir, rel));
      return facts !== null && FACTS.every((key) => facts[key] === entry[key]);
    };
    const planted = [...found.keys()].filter((rel) => !studios(rel)).sort();
    // What is under a folder that is itself moved goes with it.
    const tops = planted.filter((rel) => !planted.some((other) => rel.startsWith(`${other}/`)));
    const left = [];
    let real = null;
    let place = null;
    for (const rel of tops) {
      try {
        real ??= realpathSync(dir);
        place ??= asideFor(real);
        const to = join(place, rel);
        mkdirSync(dirname(to), { recursive: true });
        renameSync(join(real, rel), to);
        log(`${said}: ${rel} (set aside in "${basename(dirname(place))}/${basename(place)}", beside the project)`);
      } catch (e) {
        left.push(rel);
        log(`${said}: ${rel} (it could not be set aside, ${e.code || e.message}: it is still in the project)`);
      }
    }
    return { planted, left };
  } catch (e) {
    log(`${said}: ${UNSEEN} (${e.code || e.message})`);
    return { planted: [UNSEEN], left: [UNSEEN] };
  }
}
