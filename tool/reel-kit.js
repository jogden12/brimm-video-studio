// Reel Kit's pin, and where Reel Kit lives on a Mac (spec 2026-11-23 Reel Kit in Studio, sections 1 and 2).
//
// Studio pins one Reel Kit version and installs it itself, as it pins its own HyperFrames (hyperframes.js). This file is:
//   - the pin (reel-kit.pin.json): the version, one fingerprint of its whole skill folder, the files Studio relies on in it, the
//     name of its licence (which stays with it: in the skill folder or the plugin folder above it), and everything it fetches at
//     setup, each by URL and SHA-256 (or npm integrity, or a hash-locked requirements file): its own HyperFrames, GSAP, uv, the
//     Python uv installs, the two lock files, its four models (each with every source models.py lists, in its order), the
//     faster-whisper model and ffmpeg;
//   - where everything is kept: the kit (KIT) in the toolchain folder, read only, and REEL_KIT_HOME, both in the work folder, which
//     is on the Mac's own disk and never in Dropbox. Nothing of Studio's uses ~/reel-kit;
//   - the folder fingerprint, which says whether a dropped Reel Kit is the pinned one.
//
// Pure but for reading: its own pin file, and the folder folderFingerprint is given. It writes nothing and runs nothing.
import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { workFolder } from "./settings.js";
import { quiet } from "./hyperframes.js";
import { shellWord } from "./studio.js";

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
  license: plainName,
  hyperframes: (v) => object(v) && VERSION.test(v.version) && /^sha512-[A-Za-z0-9+/]{86}==$/.test(v.integrity),
  gsap: (v) => object(v) && VERSION.test(v.version) && fetched(v),
  uv: (v) => object(v) && VERSION.test(v.version) && fetched(v),
  python: (v) => typeof v === "string" && /^3\.12\.\d+$/.test(v),
  locks: (v) => object(v) && locked(v.main) && locked(v.mp),
  models: (v) => Array.isArray(v) && v.length > 0 && v.every((m) => object(m) && plainName(m.name) && Number.isInteger(m.bytes) && m.bytes > 0
    && Array.isArray(m.sources) && m.sources.length > 0 && m.sources.every(fetched)),
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
/** Reel Kit's own HyperFrames, kept beside Studio's and installed the same way, never fetched by npx: a folder for each version (the
    pin's by default), so a Reel Kit installed beside the one in use never writes into the other's. Throws on a version that is not
    x.y.z, since it goes into a folder's name. */
export const hfDir = (home, version = PIN.hyperframes.version) => {
  if (!VERSION.test(String(version))) throw new Error(`hfDir: ${version} is not a version like 0.8.139`);
  return join(workFolder(home), ".toolchain", `hyperframes-${version}`);
};
/** Its program, the file node is given to run. */
export const hfCli = (home, version = PIN.hyperframes.version) => join(hfDir(home, version), "node_modules", "hyperframes", "bin", "hyperframes.mjs");

/** The `code` of folderFingerprint's throw for a link inside the folder, and for anything there that is neither a file nor a folder. */
/** A name folded as the Mac's disk folds one, near enough: APFS takes two names for one when they are equal under Unicode's full case
    folding, so `AGENT\u017F.md` (a long s) opens AGENTS.md and `\uFB06udio.json` (an st ligature) opens studio.json, which a plain
    toLowerCase misses. Compatibility composition, then capitals, then small letters: the long s, the ligatures and the Kelvin sign come
    out as s, st and k. It takes a few names for Studio's that the disk would not (a dotless i), never the other way for these names;
    a zero-width joiner or a Cyrillic letter stays what it is. */
export const foldName = (name) => name.normalize("NFKC").toUpperCase().toLowerCase();

export const LINK_INSIDE = "REEL_KIT_LINK_INSIDE";
export const ODD_INSIDE = "REEL_KIT_ODD_INSIDE";

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

/** The throw for a link inside a folder a fingerprint is made of, and for anything there that is neither a file nor a folder. */
const linkInside = (rel) => Object.assign(new Error(`a link is inside the folder: ${rel}`), { code: LINK_INSIDE });
const oddInside = (rel) => Object.assign(new Error(`something that is not a file or a folder is inside the folder: ${rel}`), { code: ODD_INSIDE });

/** Every regular file under the folder `dir`, as { path, rel }: `rel` its path from `dir` (`/`-joined, NFC), after `under` and a `/` when
    `under` is given. `.DS_Store` and `._*` are left out, and so is any entry `skip(rel)` says to leave out (never looked at, nor gone
    into). A link anywhere inside, or anything that is neither a file nor a folder, throws, the error's `code` LINK_INSIDE or ODD_INSIDE. */
export function filesUnder(dir, { under = "", skip = () => false } = {}) {
  const files = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      if (leftover(name)) continue;
      const path = join(abs, name);
      const relPath = rel === "" ? name : `${rel}/${name}`;
      if (skip(relPath)) continue;
      const kind = lstatSync(path);
      if (kind.isSymbolicLink()) throw linkInside(relPath);
      if (kind.isDirectory()) walk(path, relPath);
      else if (kind.isFile()) files.push({ path, rel: relPath.normalize("NFC") });
      else throw oddInside(relPath);
    }
  };
  walk(dir, under);
  return files;
}

/** The fingerprint of files ({ path, rel }): sorted by their `rel`'s UTF-8 bytes, one manifest line per file, `<sha256 hex>  <rel>\n`,
    and `sha256-` and the SHA-256 of the manifest. */
export function manifestFingerprint(files) {
  const sorted = [...files].sort((a, b) => Buffer.compare(Buffer.from(a.rel, "utf8"), Buffer.from(b.rel, "utf8")));
  const manifest = sorted.map((f) => `${fileSha256(f.path)}  ${f.rel}\n`).join("");
  return `sha256-${createHash("sha256").update(manifest, "utf8").digest("hex")}`;
}

/** The fingerprint of a folder: every regular file under it (filesUnder), by its path relative to the folder, as manifestFingerprint
    makes it. A link anywhere inside, or anything that is neither a file nor a folder, refuses the folder: it throws, the error's `code`
    LINK_INSIDE or ODD_INSIDE, which a caller decides by, never by the message. */
export function folderFingerprint(dir) {
  return manifestFingerprint(filesUnder(dir));
}

/** The one entry `path` as a fingerprint takes it: "file", "folder" or "none" (not there); a link, or anything else, throws as filesUnder
    does, `rel` naming it. */
export function entryKind(path, rel) {
  let kind;
  try {
    kind = lstatSync(path);
  } catch (e) {
    if (e.code === "ENOENT") return "none";
    throw e;
  }
  if (kind.isSymbolicLink()) throw linkInside(rel);
  if (kind.isDirectory()) return "folder";
  if (kind.isFile()) return "file";
  throw oddInside(rel);
}

/** The environment every Reel Kit command Studio starts is run in: a list, not what Studio inherited. `PATH` is Reel Kit's tools/bin
    (its npx, node, ffmpeg, ffprobe, python3), /usr/bin and /bin; `HOME` and `LANG` come from `base` (LANG en_US.UTF-8 when it has
    none); REEL_KIT_HOME is always BRIMM Video Work's .reel-kit and HF_HOME sits inside it. After install nothing reaches the network:
    HF_HUB_OFFLINE, PIP_NO_INDEX, UV_OFFLINE, PYTHONNOUSERSITE, and HyperFrames' own quiet variables (hyperframes.js). Nothing of
    Anthropic's, no proxy, no session id from the base. `node` must be absolute (Studio's own; the shim and links use it). Throws on
    a relative or missing HOME or node. A new object each time. */
export function reelKitEnv(options) {
  const { home, node, base } = options ?? {};
  if (!isAbsolute(home ?? "") || !isAbsolute(base?.HOME ?? "")) throw new Error("reelKitEnv: HOME must be an absolute path");
  if (!isAbsolute(node ?? "")) throw new Error("reelKitEnv: node must be an absolute path");
  return {
    PATH: [binDir(home), "/usr/bin", "/bin"].join(":"),
    HOME: base.HOME,
    LANG: typeof base.LANG === "string" && base.LANG !== "" ? base.LANG : "en_US.UTF-8",
    REEL_KIT_HOME: reelKitHome(home),
    HF_HOME: join(reelKitHome(home), "hf"),
    HF_HUB_OFFLINE: "1", PIP_NO_INDEX: "1", UV_OFFLINE: "1", PYTHONNOUSERSITE: "1",
    ...quiet()
  };
}

/** The text of the `npx` Studio puts in Reel Kit's tools/bin (a /bin/sh script; Task 5 writes it). Reel Kit's common.py puts that
    folder first on PATH and asks for `npx -y hyperframes@<version>`: this runs the pinned HyperFrames program by absolute path with
    Studio's node and never calls the real npx. Only the exact two words `-y` and `hyperframes@<version>` first are served; anything
    else prints one line on stderr and exits 1. */
export function npxShim({ node, cli, version }) {
  return `#!/bin/sh
# Reel Kit's npx: it serves only the pinned HyperFrames and never reaches the network.
if [ "$1" = "-y" ] && [ "$2" = ${shellWord(`hyperframes@${version}`)} ]; then
  shift 2
  exec ${shellWord(node)} ${shellWord(cli)} "$@"
fi
echo "This npx runs only HyperFrames ${version}." >&2
exit 1
`;
}
