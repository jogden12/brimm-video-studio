// Reading a dropped Reel Kit download (spec 2026-11-23 Reel Kit in Studio, section 1; plan Task 3).
//
// A person drags a Reel Kit download into a Studio chat: a folder or its zip, of the skill folder alone or of the plugin folder
// that holds it at skills/reel-kit/. readDrop says what it is: where its skill folder (the one holding SKILL.md) is, its version,
// its fingerprint (reel-kit.js folderFingerprint), the HyperFrames it renders with, its GSAP, the SHA-256 of its requirements and
// where its LICENSE is. Or, in one plain line of DROP_WHY, why it can't be taken in. The install (Task 5) copies the skill folder
// and the LICENSE from here; nothing else is ever taken from a download.
//
// It never writes into the download. A zip is unpacked by the `unzip` it is given (in Studio, /usr/bin/ditto -x -k) into a
// scratch folder in the work folder's toolchain (never beside the zip), which it gives back for the caller to take away. Anything
// in a drop folder is refused before it is looked at, since a new file there starts an import, and so is anything in Studio's own
// toolchain, where KIT is. Every file it reads is opened the safe way: no link followed, no pipe waited on, its size known first.
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { LINK_INSIDE, REQUIRED_PATHS, PIN, folderFingerprint } from "./reel-kit.js";
import { defaultDropFolder, dropFolderOf, readSettings, workFolder } from "./settings.js";
import { fold, realOf } from "./places.js";

/** Why a drop is refused, one line each, in her words: never a path or a command for her to type. */
export const DROP_WHY = Object.freeze({
  gone: "I can't find that download any more. Drag it into this chat again.",
  notFolderOrZip: "That isn't a folder or a zip, so it can't be a Reel Kit download.",
  inDrop: "That Reel Kit is in the drop folder, which is only for videos. Move it out of there, then drag it into this chat again.",
  inKit: "That's the copy of Reel Kit Studio already keeps, not a download.",
  unzip: "That zip couldn't be opened. Download Reel Kit again, then drag it into this chat.",
  noSkill: "That isn't Reel Kit: nothing in it says it is the reel-kit skill.",
  link: "That Reel Kit has a shortcut (a link) inside it, so it can't be taken in as it is. Download it again.",
  odd: "That Reel Kit has something inside it that is neither a file nor a folder, so it can't be taken in. Download it again.",
  missing: (path) => `That Reel Kit is missing ${path}, so it can't be used. Download it again.`,
  version: "That Reel Kit's version isn't written as a version number (like 1.2.0), so it can't be used.",
  hyperframes: "That Reel Kit doesn't say which one HyperFrames version it renders with, so it can't be used.",
  gsap: "That Reel Kit doesn't say which GSAP it animates with, so it can't be used.",
  requirements: "That Reel Kit doesn't list the Python packages it needs, so it can't be used.",
  license: "That Reel Kit came without its licence, so it can't be taken in. Download it again.",
});

/** The most of any one file it reads: Reel Kit's SKILL.md and setup.py are tens of kilobytes. */
const READ_MOST = 4 << 20;
const X_Y_Z = /^\d+\.\d+\.\d+$/;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** Whether `path` is `dir` or inside it, both by real path, letter case folded (the disk ignores case; a link leads where it leads). */
const within = (path, dir) => {
  const p = fold(realOf(resolve(path)));
  const d = fold(realOf(resolve(dir)));
  return p === d || p.startsWith(`${d}/`);
};

/** Whether two paths are the same folder, by real path, letter case folded. */
const same = (a, b) => fold(realOf(resolve(a))) === fold(realOf(resolve(b)));

/** This Mac's drop folders, from its settings: the one it watches, and Drop in the work folder, where a Mac's own is made. */
function dropsOf(home) {
  const drops = [defaultDropFolder(home)];
  try {
    const { settings } = readSettings(home);
    if (settings) drops.push(dropFolderOf(settings, home));
  } catch {
    // Settings that can't be read name no other drop folder; the work folder's own is still refused.
  }
  return drops;
}

/** The default unzip: ditto, which Finder's own zips are made with, into `into`. A throw when it fails. */
function ditto(zip, into) {
  const done = spawnSync("/usr/bin/ditto", ["-x", "-k", zip, into], { stdio: ["ignore", "ignore", "pipe"] });
  if (done.status !== 0) throw new Error(`ditto could not unpack the zip (${done.error?.code ?? done.status})`);
}

/** The bytes of a regular file, opened the safe way (no link followed, no pipe waited on, the file opened the one named), or null
    for anything else, or for a file larger than READ_MOST. */
function readSafe(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd);
    const named = lstatSync(path);
    if (!opened.isFile() || !named.isFile() || opened.ino !== named.ino || opened.dev !== named.dev || opened.size > READ_MOST) return null;
    const buffer = Buffer.alloc(opened.size);
    let got = 0;
    while (got < buffer.length) {
      const read = readSync(fd, buffer, got, buffer.length - got, got);
      if (read === 0) break;
      got += read;
    }
    return buffer.subarray(0, got);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** What a path is, without following a link: "folder", "file", "link", "other", or "" when nothing is there. */
function kindOf(path) {
  try {
    const s = lstatSync(path);
    return s.isSymbolicLink() ? "link" : s.isDirectory() ? "folder" : s.isFile() ? "file" : "other";
  } catch {
    return "";
  }
}

/** Whether a SKILL.md's front matter names it the reel-kit skill. */
function namesReelKit(bytes) {
  if (!bytes) return false;
  const text = bytes.toString("utf8").replace(/\r\n/g, "\n");
  const front = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  return Boolean(front && /^name:\s*["']?reel-kit["']?\s*$/m.test(front[1]));
}

/** Every skill folder at or one level under `base` (a skill folder itself, a plugin folder holding skills/reel-kit, or, for an unpacked
    zip, the folder it unpacked into), never inside a zip's __MACOSX: [{ kit, plugin, linked }], `plugin` the plugin folder or "".
    `linked` marks a skill folder reached through a link, which is refused rather than read. */
function skillFolders(base, { unpacked }) {
  const found = [];
  const look = (dir) => {
    if (kindOf(join(dir, "SKILL.md")) === "file" && namesReelKit(readSafe(join(dir, "SKILL.md")))) {
      found.push({ kit: dir, plugin: "", linked: false });
      return;
    }
    const nested = join(dir, "skills", "reel-kit");
    const skills = kindOf(join(dir, "skills"));
    const kind = skills === "folder" ? kindOf(nested) : skills;
    if (kind === "link") found.push({ kit: nested, plugin: dir, linked: true });
    else if (kind === "folder" && kindOf(join(nested, "SKILL.md")) === "file" && namesReelKit(readSafe(join(nested, "SKILL.md")))) {
      found.push({ kit: nested, plugin: dir, linked: false });
    }
  };
  look(base);
  if (unpacked && found.length === 0) {
    let names = [];
    try {
      names = readdirSync(base);
    } catch {
      names = [];
    }
    for (const name of names.sort()) {
      if (name === "__MACOSX" || name === ".DS_Store" || name.startsWith("._")) continue;
      const kind = kindOf(join(base, name));
      if (kind === "link") found.push({ kit: join(base, name), plugin: "", linked: true });
      else if (kind === "folder") look(join(base, name));
    }
  }
  return found;
}

/** The one HyperFrames version `pipeline/common.py` names (`hyperframes@x.y.z`), or "" when it names none or more than one. */
function hyperframesOf(bytes) {
  if (!bytes) return "";
  const versions = new Set([...bytes.toString("utf8").matchAll(/hyperframes@([0-9][0-9A-Za-z.+-]*)/g)].map((m) => m[1]));
  const [only] = versions;
  return versions.size === 1 && X_Y_Z.test(only) ? only : "";
}

/** The GSAP version `setup/setup.py` names on its `GSAP_VERSION = "x.y.z"` line, or "". */
function gsapOf(bytes) {
  const m = bytes && /^GSAP_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']\s*(?:#.*)?$/m.exec(bytes.toString("utf8"));
  return m ? m[1] : "";
}

/** What the skill folder at `kit` holds, as readDrop gives it back, or { why }. */
function readKit(kit, plugin) {
  // The fingerprint's walk is also the check for links, and for anything that is neither a file nor a folder, inside.
  let fingerprint;
  try {
    fingerprint = folderFingerprint(kit);
  } catch (e) {
    return { why: e?.code === LINK_INSIDE ? DROP_WHY.link : DROP_WHY.odd };
  }
  for (const path of REQUIRED_PATHS) {
    const wants = path.endsWith("/") ? "folder" : "file";
    if (kindOf(join(kit, path.replace(/\/$/, ""))) !== wants) return { why: DROP_WHY.missing(path) };
  }
  const version = (readSafe(join(kit, "VERSION"))?.toString("utf8") ?? "").trim();
  if (!X_Y_Z.test(version)) return { why: DROP_WHY.version };
  const hyperframes = hyperframesOf(readSafe(join(kit, "pipeline", "common.py")));
  if (!hyperframes) return { why: DROP_WHY.hyperframes };
  const gsap = gsapOf(readSafe(join(kit, "setup", "setup.py")));
  if (!gsap) return { why: DROP_WHY.gsap };
  const requirements = readSafe(join(kit, "setup", "requirements.txt"));
  if (!requirements) return { why: DROP_WHY.requirements };
  // The licence stays with the kit: in the skill folder, or (as in 1.2.0) in the plugin folder above skills/.
  let license = "";
  for (const at of [kit, plugin].filter(Boolean)) {
    const path = join(at, PIN.license);
    const kind = kindOf(path);
    if (kind === "link") return { why: DROP_WHY.link };
    if (kind === "file") {
      license = path;
      break;
    }
  }
  if (!license) return { why: DROP_WHY.license };
  return { version, fingerprint, hyperframes, gsap, requirementsSha: createHash("sha256").update(requirements).digest("hex"), license };
}

/** Whether a file starts as a zip does. */
const looksZipped = (path) => {
  const fd = (() => {
    try {
      return openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    } catch {
      return null;
    }
  })();
  if (fd === null) return false;
  try {
    if (!fstatSync(fd).isFile()) return false;
    const head = Buffer.alloc(4);
    return readSync(fd, head, 0, 4, 0) === 4 && head.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  } finally {
    closeSync(fd);
  }
};

/** A dropped Reel Kit download at `path`: { ok: true, kit, version, fingerprint, hyperframes, gsap, requirementsSha, license } (and
    `scratch`, the folder a zip was unpacked into, for the caller to take away), or { ok: false, why } (with `scratch` when a zip was
    unpacked). `kit` is the folder holding SKILL.md: the path itself, or skills/reel-kit/ inside a plugin folder, or either inside what
    a zip unpacked to. `drops` are the folders a download is refused in (by default this Mac's drop folders, from its settings);
    `scratch` defaults to a new folder in `<work folder>/.toolchain/incoming/`. */
export function readDrop(path, { home = homedir(), unzip = ditto, scratch, drops = dropsOf(home) } = {}) {
  const dropped = resolve(String(path));
  if (drops.some((drop) => within(dropped, drop))) return { ok: false, why: DROP_WHY.inDrop };
  if (within(dropped, join(workFolder(home), ".toolchain"))) return { ok: false, why: DROP_WHY.inKit };
  const kind = kindOf(dropped);
  if (kind === "") return { ok: false, why: DROP_WHY.gone };
  if (kind === "link") return { ok: false, why: DROP_WHY.link };

  let base = dropped;
  let into;
  if (kind === "file") {
    if (!/\.zip$/i.test(basename(dropped)) || !looksZipped(dropped)) return { ok: false, why: DROP_WHY.notFolderOrZip };
    into = scratch ?? join(workFolder(home), ".toolchain", "incoming", randomBytes(8).toString("hex"));
    if (drops.some((drop) => within(into, drop)) || [into, dirname(into)].some((at) => same(at, dirname(dropped)))) {
      throw new Error("a zip is never unpacked into a drop folder or beside itself");
    }
    try {
      mkdirSync(into, { recursive: true });
      unzip(dropped, into);
    } catch {
      return { ok: false, why: DROP_WHY.unzip, scratch: into };
    }
    base = into;
  } else if (kind !== "folder") {
    return { ok: false, why: DROP_WHY.notFolderOrZip };
  }

  const refuse = (why) => (into ? { ok: false, why, scratch: into } : { ok: false, why });
  const found = skillFolders(base, { unpacked: Boolean(into) });
  if (found.length !== 1) return refuse(DROP_WHY.noSkill);
  const [{ kit, plugin, linked }] = found;
  if (linked) return refuse(DROP_WHY.link);
  const got = readKit(kit, plugin);
  if (got.why) return refuse(got.why);
  return { ok: true, kit, ...got, ...(into ? { scratch: into } : {}) };
}
