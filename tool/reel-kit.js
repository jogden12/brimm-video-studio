// Reel Kit's pin, and where Reel Kit lives on a Mac (spec 2026-11-23 Reel Kit in Studio, sections 1 and 2).
//
// Studio pins one Reel Kit version and installs it itself, as it pins its own HyperFrames (hyperframes.js). This file is:
//   - the pin (reel-kit.pin.json): the version, one fingerprint of its whole skill folder, the files Studio relies on in it, and
//     everything it fetches at setup, each by URL and SHA-256 (or npm integrity, or a hash-locked requirements file): its own
//     HyperFrames, GSAP, uv, the Python uv installs, the two lock files, its four models, the faster-whisper model and ffmpeg;
//   - where everything is kept: the kit (KIT) in the toolchain folder, read only, and REEL_KIT_HOME, both in the work folder, which
//     is on the Mac's own disk and never in Dropbox. Nothing of Studio's uses ~/reel-kit;
//   - the folder fingerprint, which says whether a dropped Reel Kit is the pinned one.
//
// Pure but for reading: its own pin file, and the folder folderFingerprint is given. It writes nothing and runs nothing.
import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { workFolder } from "./settings.js";

/** A value and everything inside it, frozen. */
function deepFreeze(value) {
  if (value !== null && typeof value === "object") for (const inner of Object.values(value)) deepFreeze(inner);
  return Object.freeze(value);
}

const VERSION = /^\d+\.\d+\.\d+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const https = (v) => typeof v === "string" && /^https:\/\/[^\s]+$/.test(v);
/** A path inside a folder: relative, `/`-separated, with no empty, `.` or `..` part (a trailing `/` names a folder). */
const inside = (v) => typeof v === "string" && v !== "" && !v.startsWith("/") && v.replace(/\/$/, "").split("/").every((p) => p !== "" && p !== "." && p !== "..");
/** A file's name alone, with no folder in it. */
const plainName = (v) => inside(v) && !v.includes("/");
const fetched = (v) => object(v) && https(v.url) && SHA256.test(v.sha256);
const locked = (v) => object(v) && inside(v.file) && !v.file.endsWith("/") && SHA256.test(v.sha256);

/** Each key of the pin, and whether its value is shaped as the pin needs it. */
const SHAPE = {
  version: (v) => typeof v === "string" && VERSION.test(v),
  fingerprint: (v) => typeof v === "string" && /^sha256-[0-9a-f]{64}$/.test(v),
  required: (v) => Array.isArray(v) && v.length > 0 && v.every(inside),
  hyperframes: (v) => object(v) && VERSION.test(v.version) && /^sha512-[A-Za-z0-9+/]{86}==$/.test(v.integrity),
  gsap: (v) => object(v) && VERSION.test(v.version) && fetched(v),
  uv: (v) => object(v) && VERSION.test(v.version) && fetched(v),
  python: (v) => typeof v === "string" && /^3\.12\.\d+$/.test(v),
  locks: (v) => object(v) && locked(v.main) && locked(v.mp),
  models: (v) => Array.isArray(v) && v.length > 0 && v.every((m) => object(m) && plainName(m.name) && Number.isInteger(m.bytes) && m.bytes > 0 && fetched(m)),
  whisper: (v) => object(v) && typeof v.repo === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v.repo) && !v.repo.split("/").some((p) => p === "." || p === "..")
    && /^[0-9a-f]{40}$/.test(v.revision) && Array.isArray(v.files) && v.files.length > 0 && v.files.every((f) => object(f) && inside(f.path) && SHA256.test(f.sha256)),
  ffmpeg: (v) => object(v) && VERSION.test(v.version) && fetched(v.ffmpeg) && fetched(v.ffprobe),
};

/** The pin from the text of the pin file, frozen, or a throw naming the first key that is missing or not shaped right. The version
    goes into a folder's name and every hash is what the installer checks a download against: a pin file that holds anything else is
    refused when this file is loaded, not used. */
export function pinFrom(text) {
  const pin = JSON.parse(text);
  if (!object(pin)) throw new Error("reel-kit.pin.json must hold an object");
  for (const [key, fits] of Object.entries(SHAPE)) {
    if (!fits(pin[key])) throw new Error(`reel-kit.pin.json must hold ${key}, shaped as reel-kit.js says`);
  }
  return deepFreeze(pin);
}

/** The pin. Moving it is a pull request: the new values, read from the new download and the registries on the Mac Studio. */
export const PIN = pinFrom(readFileSync(new URL("./reel-kit.pin.json", import.meta.url), "utf8"));
/** The files and folders (ending in `/`) Studio relies on in a Reel Kit skill folder. */
export const REQUIRED_PATHS = PIN.required;

/** KIT: a Reel Kit version's skill folder, read only, replaced whole on a version change. */
export const kitDir = (home, version = PIN.version) => join(workFolder(home), ".toolchain", `reel-kit-${version}`);
/** REEL_KIT_HOME, set on every Reel Kit command Studio starts: its .venv, tools, models, vendor and style. */
export const reelKitHome = (home) => join(workFolder(home), ".reel-kit");
/** The folder Reel Kit puts first on PATH (its common.py): Studio's npx stand-in, node, ffmpeg, ffprobe and python3. */
export const binDir = (home) => join(reelKitHome(home), "tools", "bin");
/** The Python of Reel Kit's main environment. */
export const venvPython = (home) => join(reelKitHome(home), ".venv", "bin", "python");
/** Reel Kit's own HyperFrames, kept beside Studio's and installed the same way, never fetched by npx. */
export const hfDir = (home) => join(workFolder(home), ".toolchain", `hyperframes-${PIN.hyperframes.version}`);
/** Its program, the file node is given to run. */
export const hfCli = (home) => join(hfDir(home), "node_modules", "hyperframes", "bin", "hyperframes.mjs");

/** Whether a name is Finder's or a copy's leftover, which no fingerprint counts. */
const leftover = (name) => name === ".DS_Store" || name.startsWith("._");

/** The SHA-256 of a file, read a block at a time. */
function fileSha256(path) {
  const hash = createHash("sha256");
  const block = Buffer.alloc(1 << 20);
  const fd = openSync(path, "r");
  try {
    for (let n; (n = readSync(fd, block, 0, block.length, null)) > 0; ) hash.update(block.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** The fingerprint of a folder: every regular file under it, by its path relative to the folder (`/`-joined, NFC), sorted by those
    paths' UTF-8 bytes, `.DS_Store` and `._*` left out. The manifest is one line per file, `<sha256 hex>  <path>\n`, and the fingerprint
    is `sha256-` and the SHA-256 of the manifest. A link anywhere inside, or anything that is neither a file nor a folder, refuses the
    folder: it throws. */
export function folderFingerprint(dir) {
  const files = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      if (leftover(name)) continue;
      const path = join(abs, name);
      const relPath = rel === "" ? name : `${rel}/${name}`;
      const kind = lstatSync(path);
      if (kind.isSymbolicLink()) throw new Error(`a link is inside the folder: ${relPath}`);
      if (kind.isDirectory()) walk(path, relPath);
      else if (kind.isFile()) files.push({ path, rel: relPath.normalize("NFC") });
      else throw new Error(`something that is not a file or a folder is inside the folder: ${relPath}`);
    }
  };
  walk(dir, "");
  files.sort((a, b) => Buffer.compare(Buffer.from(a.rel, "utf8"), Buffer.from(b.rel, "utf8")));
  const manifest = files.map((f) => `${fileSha256(f.path)}  ${f.rel}\n`).join("");
  return `sha256-${createHash("sha256").update(manifest, "utf8").digest("hex")}`;
}
