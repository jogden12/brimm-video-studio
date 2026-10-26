// The gated places (design 2026-10-26, section 2, "The gated places"): the folders and files her chat may not read under the open
// lock, because each can hold a gated video's name or words, a session's, another chat's, or a secret. They are held three
// ways, each from this list: the sandbox's denyRead (macOS holds Bash and all it starts), Claude Code's Read() deny rules (its
// own file tools), and the guard, which compares a path by what it is, not how it is spelled.
//
// Every place is named by its real path (realOf): ~/Movies on the Mac Studio is a link into Dropbox, and a rule written for the
// link's spelling would miss the folder. Each is also spelled a second way, under /System/Volumes/Data (bothSpellings), as
// macOS lets a path be. `readRules` are the paths the Read() deny rules are written for (none for a place only the sandbox and
// the guard hold); `carve` marks a place the guard opens a part of to one call (its own words, its own tool results, its own
// tasks, Claude Code's own program); `readAllowed` is what the sandbox lets Bash read inside them, and nothing else.
//
// A path is then judged by what it is (gatedIndex, R19): each folder along its real path is compared by its identity (device and
// inode) with the gated places that are there, and by its text, both spellings, letter case folded, with those that are not
// there yet. So `..`, a link, /System/Volumes/Data and a changed letter case all come to the same place. pathsIn takes every
// path-like string from a tool's input, at any depth, and searchRoot the folder a search starts from.
//
// This file reads only whether files and folders are there, what they are and where links lead, never what is in them. It is
// given the home, BRIMM Video, the uid, Claude Code's temp folder and her folder, so that a test gives made-up ones and never
// reads this Mac's own.
import { existsSync, lstatSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

/** Claude Code's name for a folder, as it names the folder's own subfolders of ~/.claude/projects and of its temp folder: every
    character but a letter or a digit made a dash. */
export const claudeDirName = (path) => path.replace(/[^A-Za-z0-9]/g, "-");

/** The real path of `path`: that of the nearest folder of it that is there, with the rest of the path after it. */
export function realOf(path) {
  let at = path;
  const rest = [];
  for (;;) {
    try {
      return join(realpathSync.native(at), ...rest);
    } catch {
      const up = dirname(at);
      if (up === at) return path;
      rest.unshift(basename(at));
      at = up;
    }
  }
}

/** A path as it is, and as macOS also lets it be spelled, under /System/Volumes/Data. */
export const bothSpellings = (path) => [path, path === "/" ? "/System/Volumes/Data" : `/System/Volumes/Data${path}`];

/** Whether a path names a .env file, or one of its kin (.env.local): such a file is held wherever it is (R20). */
export function isEnvFile(path) {
  const name = basename(String(path)).toLowerCase();
  return name === ".env" || name.startsWith(".env.");
}

/** The first folder above BRIMM Video that holds Dropbox's cache, `.dropbox.cache` (Dropbox's root), or null when none does. */
function dropboxRoot(root) {
  for (let at = dirname(root); ; at = dirname(at)) {
    if (existsSync(join(at, ".dropbox.cache"))) return at;
    if (dirname(at) === at) return null;
  }
}

/** Every gated place of this Mac, by its real path: { path, readRules, kind, carve? }. `tmp` is Claude Code's temp folder
    (CLAUDE_CODE_TMPDIR, or /tmp, by its real path), `uid` this Mac user's id, and `zoomFolder` where Zoom keeps its recordings,
    by default Documents/Zoom in the home folder. */
export function gatedPlaces({ home, root, uid, tmp = "/private/tmp", zoomFolder = join(home, "Documents", "Zoom") }) {
  const AS = join(home, "Library", "Application Support");
  const BV = realOf(root);
  const DB = dropboxRoot(BV);
  const itself = (path, kind = "folder") => ({ path: realOf(path), readRules: [realOf(path)], kind });
  const carved = (path, carve) => ({ path: realOf(path), readRules: [], kind: "folder", carve });
  const containers = join(home, "Library", "Containers");
  return [
    { path: BV, readRules: ["Drop", "Episodes", "Unedited Video"].map((name) => join(BV, name)), kind: "folder" },
    itself(join(dirname(BV), "BRIMM VIDEO Transfer")),
    itself(zoomFolder),
    itself(join(home, "Movies", "Final Cut Backups")),
    itself(join(home, "BRIMM Video Work")),
    itself(join(AS, "BRIMM Video")),
    carved(join(AS, "BRIMM Video Words"), "words"),
    carved(join(home, ".claude"), "claude"),
    carved(join(tmp, `claude-${uid}`), "tmp"),
    carved(join(AS, "Claude"), "app"),
    itself(join(home, ".claude.json"), "file"),
    itself(join(AS, "com.apple.sharedfilelist")),
    itself(join(home, "Library", "Preferences", "com.apple.finder.plist"), "file"),
    itself(join(home, ".dropbox")),
    itself(join(AS, "Dropbox")),
    ...(DB ? [itself(join(DB, ".dropbox.cache"))] : []),
    itself(join(home, "Library", "Group Containers", "G7HH3F8CAK.com.getdropbox.dropbox.sync")),
    itself(join(containers, "com.getdropbox.dropbox.fileprovider")),
    itself(join(containers, "com.getdropbox.dropbox.TransferExtension")),
    itself(join(containers, "com.getdropbox.dropbox.garcon")),
    itself(join(home, "Library", "Logs", "brimm-video.log"), "file"),
    itself(join(home, "Library", "Logs", "brimm-video-claude-check.log"), "file"),
    itself(join(home, ".ssh")),
    itself(join(home, "Library", "Keychains")),
    itself(join(home, ".aws")),
    itself(join(home, ".config")),
    itself(join(home, ".netrc"), "file"),
    itself(join(home, ".git-credentials"), "file"),
    itself(join(home, ".npmrc"), "file"),
  ];
}

/** What the sandbox lets Bash read inside the gated places (its allowRead), and nothing else: BRIMM Video's Assets, and the three
    places Bash itself needs (C36): her folder's own subfolder of Claude Code's temp folder, its shell snapshots and Claude Code's
    own program in the app's data. Each is the gated place's real path with the rest after it, never the real path of the whole:
    an open folder that is a link (Assets to Episodes, her temp folder to ~/.claude) would open where it leads. */
export function readAllowed({ home, root, uid, tmp = "/private/tmp", folder }) {
  return [
    join(realOf(root), "Assets"),
    join(realOf(join(tmp, `claude-${uid}`)), claudeDirName(folder)),
    join(realOf(join(home, ".claude")), "shell-snapshots"),
    join(realOf(join(home, "Library", "Application Support", "Claude")), "claude-code"),
  ];
}

/** A file's or folder's identity, its device and inode, with links followed (or, given lstatSync, the link's own); null when it
    is not there. */
function identity(path, look = statSync) {
  try {
    const st = look(path);
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
}

/** A path and each folder above it, from the path itself up to /. */
function upward(path) {
  const all = [];
  for (let at = path; ; at = dirname(at)) {
    all.push(at);
    if (dirname(at) === at) return all;
  }
}

/** A path or name as macOS compares names: letter case folded as Unicode folds it, wider than toLowerCase (a long s is an s, a
    dotless i an i), and compatibility forms made plain. Stricter is closed: a name it folds that macOS keeps apart is held too. */
export const fold = (path) => path.normalize("NFKC").toLowerCase().replace(/\u0131/g, "i");

/** A path under one of macOS's dot-root folders, /.vol (a file by its device and inode), /.nofollow or /.resolve, which name a
    file by a way no folder along it shows: such a path is held, whatever it names. */
const DOT_ROOT = /^\/\.[^/]/;

/** The real paths a path may come to, each walked by gatedIndex: its real path (links followed, `..` as text, as Claude Code's
    own tools take it); where it lies, with its last part not followed (a link in a gated place is held wherever it leads); its
    real path with `..` as macOS takes it, after a link; and, when its last part is a link that leads nowhere, where that link
    would lead, link after link. */
function comings(path) {
  const given = String(path);
  const resolved = resolve(given);
  const all = [realOf(resolved), join(realOf(dirname(resolved)), basename(resolved))];
  if (given.split("/").includes("..")) all.push(realOf(given));
  let link = resolved;
  for (let hops = 0; hops < 40; hops++) {
    let st;
    try {
      st = lstatSync(link);
    } catch {
      break;
    }
    if (!st.isSymbolicLink() || existsSync(link)) break;
    link = resolve(realOf(dirname(link)), readlinkSync(link));
    all.push(realOf(link));
  }
  return all;
}

/** The gated places, ready to judge paths by what they are. `open` are the folders inside them that are let through: the
    sandbox's allowRead (Assets, and the three Bash needs), or the carve-outs one call is given, each given as a gated place's
    real path with the rest after it. One that is a link, or lies through one, is not opened: it would open where it leads. Every
    identity of the places and of the open folders is taken once, here.
    - `at(path, more = [])`: the gated place `path` comes to, or null; `more` are carve-outs opened for this look alone, given as
      the open folders are. Each folder along each of its real paths (comings) is walked from the
      path upwards, each by its own identity (a link's own, not where it leads): the first that is an open folder lets it
      through, the first that is a place holds it, by identity, or by text, both spellings and letter case folded, for one not
      there. Any walk that is held holds the path, the stricter. A path whose name is a .env file's is a gated place of its own,
      wherever it is (R20), and so is one under a dot-root folder (DOT_ROOT).
    - `holds(dir)`: whether some gated place lies inside `dir`, or is `dir`: a search of it would reach one. A dot-root folder
      holds one. */
export function gatedIndex(places, open = []) {
  const byIdentity = new Map();
  const byText = new Map();
  const insideIdentities = new Set();
  const insideTexts = new Set();
  for (const place of places) {
    const id = identity(place.path);
    if (id && !byIdentity.has(id)) byIdentity.set(id, place);
    for (const spelling of bothSpellings(place.path)) if (!byText.has(fold(spelling))) byText.set(fold(spelling), place);
    for (const above of upward(place.path)) {
      const aboveId = identity(above);
      if (aboveId) insideIdentities.add(aboveId);
    }
    for (const spelling of bothSpellings(place.path)) for (const above of upward(spelling)) insideTexts.add(fold(above));
  }
  /** The open folders `dirs`, by identity and by text: each only when it is no link and lies through none. */
  const opened = (dirs) => {
    const ids = new Set();
    const texts = new Set();
    for (const dir of dirs) {
      const real = realOf(dir);
      if (fold(real) !== fold(resolve(dir))) continue;
      const id = identity(real);
      if (id) ids.add(id);
      for (const spelling of bothSpellings(real)) texts.add(fold(spelling));
    }
    return { ids, texts };
  };
  const always = opened(open);
  const walk = (real, more) => {
    for (const at of upward(real)) {
      const id = identity(at, lstatSync);
      if ([always, more].some((o) => (id && o.ids.has(id)) || o.texts.has(fold(at)))) return null;
      const place = (id && byIdentity.get(id)) || byText.get(fold(at));
      if (place) return place;
    }
    return null;
  };
  return {
    at(path, more = []) {
      const given = resolve(String(path));
      if (DOT_ROOT.test(given)) return { path: given, readRules: [], kind: "folder", dotRoot: true };
      const ways = comings(path);
      const dotted = ways.find((way) => DOT_ROOT.test(way));
      if (dotted) return { path: dotted, readRules: [], kind: "folder", dotRoot: true };
      const carved = opened(more);
      for (const real of ways) {
        const place = walk(real, carved);
        if (place) return place;
      }
      const env = [String(path), ...ways].find(isEnvFile);
      return env ? { path: resolve(env), readRules: [], kind: "file", env: true } : null;
    },
    holds(dir) {
      if (DOT_ROOT.test(resolve(dir))) return true;
      const real = realOf(resolve(dir));
      if (DOT_ROOT.test(real)) return true;
      const id = identity(real);
      return Boolean(id && insideIdentities.has(id)) || insideTexts.has(fold(real));
    },
  };
}

/** The longest path macOS takes, in bytes (PATH_MAX, its ending included). */
const PATH_MAX = 1024;

/** One string of a tool's input as a path, resolved, or null when it is not one: absolute, starting with `~` (`~/` from the home
    folder, `~name` from the folder that holds the home folders), holding `..`, or naming something there from `cwd`; and, so
    that a long text (a file's contents) is not walked folder by folder, shorter than any path macOS takes. White space around it
    is taken off first, as Claude Code's own tools take it off (expandPath). */
function pathOf(text, cwd, home) {
  const path = resolvedOf(text.trim(), cwd, home);
  return path !== null && Buffer.byteLength(path) < PATH_MAX ? path : null;
}

function resolvedOf(text, cwd, home) {
  if (text === "") return null;
  if (text === "~" || text.startsWith("~/")) return resolve(home, text.slice(2));
  if (text.startsWith("~")) return resolve(dirname(home), text.slice(1));
  if (isAbsolute(text)) return resolve(text);
  if (text.includes("..")) return resolve(cwd, text);
  try {
    lstatSync(resolve(cwd, text));
    return resolve(cwd, text);
  } catch {
    return null;
  }
}

/** Every path-like string in a tool's input, at any depth of its objects and arrays, each resolved once: a path may come in a
    field the guard does not know of. */
export function pathsIn(input, cwd, home) {
  const found = new Set();
  const seen = new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      const path = pathOf(value, cwd, home);
      if (path) found.add(path);
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      for (const inner of Array.isArray(value) ? value : Object.values(value)) visit(inner);
    }
  };
  visit(input);
  return [...found];
}

const GLOB = /[*?[\]{}]/;

/** The folder a search starts from, for Glob and Grep, kept for a later version of Claude Code that has them again (C20). For a
    Glob pattern that is absolute, starts with `~/` or holds `..`, the pattern's literal start, before `path`, gone up as far as
    its `..` after that start can climb: Glob searches from there whatever `path` says. Otherwise `path`, otherwise `cwd`. */
export function searchRoot(tool, input, cwd, home) {
  const given = input && typeof input === "object" ? input : {};
  const from = (path) => (path === "~" || path.startsWith("~/") ? resolve(home, path.slice(2)) : resolve(cwd, path));
  const base = typeof given.path === "string" && given.path !== "" ? from(given.path) : resolve(cwd);
  const pattern = given.pattern;
  if (tool !== "Glob" || typeof pattern !== "string") return base;
  const parts = pattern.split("/");
  const tilde = pattern === "~" || pattern.startsWith("~/");
  if (!isAbsolute(pattern) && !tilde && !parts.includes("..")) return base;
  const first = parts.findIndex((part) => GLOB.test(part));
  const literal = (first === -1 ? parts : parts.slice(0, first)).join("/");
  const start = tilde ? resolve(home, literal.slice(2)) : isAbsolute(pattern) ? resolve("/", literal) : resolve(base, literal);
  let depth = 0;
  let lowest = 0;
  for (const part of first === -1 ? [] : parts.slice(first)) {
    if (part === "..") depth -= 1;
    else if (part !== "" && part !== ".") depth += 1;
    lowest = Math.min(lowest, depth);
  }
  return resolve(start, ...Array(-lowest).fill(".."));
}
