// The lock's narrow opening for Reel Kit's storyboards (spec 2026-11-23 Reel Kit in Studio, section 4b; plan Task 12). The worker runs
// headless and can't show a storyboard, so her chat publishes it to the side panel with the Artifact tool, and reads her comments on it
// with ArtifactComments, under this opening and nothing wider, in both locks:
//
//   - Artifact: a publish (action left out, or "publish") of a page Studio staged, exactly as `reelkit storyboard` prints it (publishInput):
//     its index.html by its real path with no link on the way, its files from its own stage and nothing else, the comments capability,
//     and the URL recorded for it once it has one (never another, the kept BRIMM Ops page's among them). `open` of a recorded URL. The
//     read-only `quickstart` the tool asks for before a new page, with intent "other" and no design systems. Nothing else: no read, list,
//     delete, pin, assets, types or sharing.
//   - ArtifactComments: read, resolve, and reply with exactly "On it.", each on a recorded URL; watch never.
//   - ArtifactData stays on the never list (never.json `tools`); these two are never.json's `narrow`: never.js still catches them, so
//     nothing else lets them through, and the open lock's settings no longer deny them, so this guard alone decides.
//
// A page is staged by Studio (stagePage), never by her chat: Reel Kit's storyboard folder (or its style board) copied into her folder,
// `Storyboards/<slug>/v<n>/`, as the Artifact tool takes files only under the chat's working folder. Only index.html and the files its
// files.json names are copied, each a regular file reached by no link, and each copy's size, identity (device and inode) and SHA-256 go
// into the registry, `~/Library/Application Support/BRIMM Video/storyboards.json`, which a sandboxed command can't write (a gated place in
// both locks). The guard reads it the safe way, and any trouble reading it refuses. At each publish it looks again at every file of the
// one page named, so a file swapped for a link, edited, or replaced after staging is refused.
//
// The registry's shape: { pages: [{ id, kind: "storyboard"|"style-board", slug, episode, version, stage, file, files: [{ rel, size, dev,
// ino, sha256 }], title, description, icon, url }] }, one page per id (an edit's slug), its stage the newest version's, its url recorded
// once (recordUrl) and kept by every later version.
//
// This file imports only Node's own modules and never.js, as the guard loads it for every call.
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, normalize, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { NARROW as NEVER_NARROW } from "./never.js";

/** The two tools the opening answers for, never.json's `narrow`. */
export const NARROW = Object.freeze([...NEVER_NARROW]);
/** What a storyboard is published with, as Reel Kit publishes it: inline comments, written only through the page's composer. */
export const CAPABILITIES = Object.freeze({ comments: Object.freeze({ composer_only: true }) });
/** The folder of her folder the pages are staged in. */
export const STORYBOARDS = "Storyboards";
/** What the guard says for everything else these two tools would do. */
export const OPENING_REFUSED = "That is not something this folder does with pages. Ask Jason.";
/** What it says for a publish of a staged page that isn't the one printed for it. */
export const PUBLISH_EXACTLY = "Publish the storyboard exactly as BRIMM Video Studio printed it, with nothing changed or added.";
/** The one reply her chat may leave on a comment. */
export const REPLY = "On it.";
/** What a staged page is published as, beside its title. */
const DESCRIPTION = "A Reel Kit storyboard for The BRIMM.";
const ICON = "film";

const KINDS = ["storyboard", "style-board"];
const SLUG = /^[0-9a-z][0-9a-z-]{0,62}$/;
/** A name of one part of a staged file's path: no dot first, no slash. */
const PART = /^[A-Za-z0-9_][A-Za-z0-9 _.,+()-]{0,127}$/;
/** What a page's files may be: pictures, fonts, video and sound, and the page's own styles and scripts. */
const KEPT_TYPES = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "woff", "woff2", "ttf", "otf", "css", "js", "mp4", "webm", "mp3", "m4a", "wav"]);
/** The Artifact tool's own limits: a page and each text file 16 MB, a binary file 15 MB, 255 files and 64 MB in one publish. */
const PAGE_MOST = 16 << 20;
const FILE_MOST = 15 << 20;
const ALL_MOST = 64 << 20;
const FILES_MOST = 254;
const REGISTRY_MOST = 1 << 20;
const FILES_JSON_MOST = 1 << 20;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The registry of staged pages, in Application Support, out of the sandbox's reach. */
export const registryFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "storyboards.json");

// --- Reading files the safe way ---

/** The bytes of the plain file at `path`, of at most `most`, read with no link followed and no pipe waited on, and the identity it was
    opened as ({ bytes, dev, ino } as strings); null for anything else. */
function readPlain(path, most) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.size > BigInt(most)) return null;
    const bytes = Buffer.alloc(Number(opened.size));
    let got = 0;
    while (got < bytes.length) {
      const read = readSync(fd, bytes, got, bytes.length - got, got);
      if (read === 0) break;
      got += read;
    }
    return got === bytes.length ? { bytes, dev: String(opened.dev), ino: String(opened.ino) } : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Whether no part of the whole path `path`, from the top down, is a link, and it is there: the folders on the way folders, and the last of
    the kind `last` ("file" or "folder"). */
function noLinkOnTheWay(path, last) {
  if (!isAbsolute(path) || normalize(path) !== path) return false;
  const parts = path.split(sep).filter(Boolean);
  let at = sep;
  for (let i = 0; i < parts.length; i++) {
    at = join(at, parts[i]);
    let seen;
    try {
      seen = lstatSync(at);
    } catch {
      return false;
    }
    if (seen.isSymbolicLink()) return false;
    const wantFile = i === parts.length - 1 && last === "file";
    if (wantFile ? !seen.isFile() : !seen.isDirectory()) return false;
  }
  return true;
}

// --- The registry ---

const HEX64 = /^[0-9a-f]{64}$/;
const DECIMAL = /^\d+$/;
const isRel = (rel) => typeof rel === "string" && rel.split("/").every((part) => PART.test(part)) && rel.split("/").length <= 4;

/** Whether `page` is one the registry may hold, in its whole shape. */
function wellMade(page) {
  if (!isObject(page)) return false;
  const { id, kind, slug, stage, file, files, url, title, description, icon, version } = page;
  if (typeof id !== "string" || !SLUG.test(id) || id !== slug || !KINDS.includes(kind) || typeof page.episode !== "string") return false;
  if (typeof stage !== "string" || !isAbsolute(stage) || normalize(stage) !== stage || file !== join(stage, "index.html")) return false;
  if (!Number.isInteger(version) || version < 1 || typeof title !== "string" || typeof description !== "string" || typeof icon !== "string") return false;
  if (url !== null && !isArtifactUrl(url)) return false;
  if (!Array.isArray(files) || !files.length || files.length > FILES_MOST + 1 || files[0]?.rel !== "index.html") return false;
  const rels = new Set();
  for (const f of files) {
    if (!isObject(f) || !isRel(f.rel) || !Number.isInteger(f.size) || f.size < 0 || !DECIMAL.test(String(f.dev)) || !DECIMAL.test(String(f.ino)) || typeof f.sha256 !== "string" || !HEX64.test(f.sha256)) return false;
    if (rels.has(f.rel)) return false;
    rels.add(f.rel);
  }
  return true;
}

/** The registry: { pages }, { pages: [] } when there is none yet, or null when what is there can't be read whole as Studio's. */
export function readRegistry(home) {
  try {
    lstatSync(registryFile(home));
  } catch (e) {
    return e.code === "ENOENT" ? { pages: [] } : null;
  }
  const read = readPlain(registryFile(home), REGISTRY_MOST);
  if (read === null) return null;
  try {
    const registry = JSON.parse(read.bytes.toString("utf8"));
    if (!isObject(registry) || !Array.isArray(registry.pages) || !registry.pages.every(wellMade)) return null;
    const ids = registry.pages.map((p) => p.id);
    const urls = registry.pages.map((p) => p.url).filter(Boolean);
    if (new Set(ids).size !== ids.length || new Set(urls).size !== urls.length) return null;
    return { pages: registry.pages };
  } catch {
    return null;
  }
}

/** Write the registry whole: into a file of its own beside it, then renamed over it. Throws when it can't. */
function writeRegistry(home, registry) {
  const file = registryFile(home);
  mkdirSync(join(file, ".."), { recursive: true });
  const writing = `${file}.${process.pid}.${Date.now()}.writing`;
  try {
    writeFileSync(writing, `${JSON.stringify(registry, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(writing, file);
  } catch (e) {
    rmSync(writing, { force: true });
    throw e;
  }
}

/** The page the registry holds for `id`, or null (none, or a registry that can't be read). */
export function pageOf(home, id) {
  return readRegistry(home)?.pages.find((p) => p.id === id) ?? null;
}

// --- A page's URL ---

const ARTIFACT_URL = /^https:\/\/claude\.ai\/(?:artifact\/[A-Za-z0-9_-]{1,64}|code\/artifact\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/;
/** Whether `url` is an artifact's link, as claude.ai gives one: claude.ai/artifact/<id> or claude.ai/code/artifact/<uuid>, with or without a
    slash after it. */
export const isArtifactUrl = (url) => typeof url === "string" && ARTIFACT_URL.test(url);
/** A URL as it is compared: with one slash at its end taken off. */
const plainUrl = (url) => (typeof url === "string" && url.endsWith("/") ? url.slice(0, -1) : url);

/** Record the URL a page's first publish gave: "" when recorded, or why not: "url" (not an artifact's link), "kept" (one of `refused`, the
    kept BRIMM Ops page's), "none" (no such page staged), "same" (recorded already), "changed" (it has another: never changed), "other" (another
    page's), "unread" (the registry can't be read or written). */
export function recordUrl(home, id, url, { refused = [] } = {}) {
  if (!isArtifactUrl(url)) return "url";
  const plain = plainUrl(url);
  if (refused.map(plainUrl).includes(plain)) return "kept";
  const registry = readRegistry(home);
  if (registry === null) return "unread";
  const page = registry.pages.find((p) => p.id === id);
  if (!page) return "none";
  if (page.url === plain) return "same";
  if (page.url !== null) return "changed";
  if (registry.pages.some((p) => p.url === plain)) return "other";
  try {
    writeRegistry(home, { pages: registry.pages.map((p) => (p.id === id ? { ...p, url: plain } : p)) });
  } catch {
    return "unread";
  }
  return "";
}

/** The Artifact tool's input for publishing `page`, exactly: what `reelkit storyboard` prints and the guard lets through. */
export function publishInput(page) {
  return {
    file_path: page.file,
    files: Object.fromEntries(page.files.slice(1).map((f) => [f.rel, join(page.stage, f.rel)])),
    capabilities: CAPABILITIES,
    ...(page.url ? { url: page.url } : {}),
    title: page.title, description: page.description, icon: page.icon
  };
}

// --- Staging ---

/** What a staged page's files are: the names its files.json gives, checked; throws for any it may not hold. */
function namesOf(from) {
  const read = readPlain(join(from, "files.json"), FILES_JSON_MOST);
  if (read === null) throw new Error("files.json can't be read as a plain file");
  const names = JSON.parse(read.bytes.toString("utf8"));
  if (!Array.isArray(names) || names.length > FILES_MOST) throw new Error("files.json is not a list of at most 254 names");
  const folded = new Set();
  for (const rel of names) {
    if (!isRel(rel)) throw new Error(`files.json names a file a page may not hold: ${JSON.stringify(rel)}`);
    const type = rel.includes(".") ? rel.slice(rel.lastIndexOf(".") + 1).toLowerCase() : "";
    if (!KEPT_TYPES.has(type)) throw new Error(`files.json names a file a page may not hold: ${JSON.stringify(rel)}`);
    // APFS folds a name as Unicode's full case folding does (gotchas, "Data and records"): no two may be one file. The names are ASCII
    // (PART), so this is only letter case, folded the disk's way all the same.
    const key = rel.normalize("NFKC").toUpperCase().toLowerCase();
    if (folded.has(key)) throw new Error(`files.json names one file twice: ${JSON.stringify(rel)}`);
    folded.add(key);
  }
  return [...names].sort();
}

/** The bytes of the file `rel` of the folder `from`, which is no link and holds no link on the way to it: looked at before it is opened
    and again after, each folder on the way the same folder both times. Throws for anything else. */
function readSource(from, rel, most) {
  const path = join(from, rel);
  const way = (p) => {
    if (!noLinkOnTheWay(p, "file")) throw new Error(`${rel} is not a plain file of the storyboard, reached by no link`);
    const parts = rel.split("/");
    return parts.map((_, i) => lstatSync(join(from, ...parts.slice(0, i + 1)), { bigint: true })).map((s) => `${s.dev}:${s.ino}`).join("/");
  };
  const before = way(path);
  const read = readPlain(path, most);
  if (read === null) throw new Error(`${rel} can't be read whole`);
  if (way(path) !== before || !before.endsWith(`${read.dev}:${read.ino}`)) throw new Error(`${rel} changed while it was read`);
  return read.bytes;
}

/** A folder of `parent` named `name`: made when it isn't there, and a folder of its own, no link, when it is. Throws otherwise. */
function ownFolder(parent, name) {
  const at = join(parent, name);
  try {
    mkdirSync(at);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  if (!lstatSync(at).isDirectory()) throw new Error(`${at} is not a folder of its own`);
  return at;
}

/** Stage the page in the folder `from` (a Reel Kit project's storyboard/, or the style board) in her folder `folder`, as
    `Storyboards/<slug>/v<version>/`, and register it: { stage, file, files, version, reused }. Only index.html and the files its files.json
    names are copied, each a plain file reached by no link; `files` are their names, index.html left out. A storyboard the same as the one
    staged for it (every file's name and hash) is not staged again: its stage is given back (reused). The version is `version` when given,
    else the next after the page's last. The page keeps the URL recorded for it. Throws, staging nothing, for a name files.json may not
    give, a file that is a link or not there, a Storyboards or slug folder that is not her folder's own, or a registry that can't be read. */
export function stagePage(home, folder, { from, slug, version, kind = "storyboard", episode = "", title = "" }) {
  if (typeof slug !== "string" || !SLUG.test(slug)) throw new Error(`stagePage: ${JSON.stringify(slug)} is not a slug`);
  if (!KINDS.includes(kind)) throw new Error(`stagePage: ${JSON.stringify(kind)} is not a kind of page`);
  // The folders above the storyboard's are Studio's own (the episode's work folder, the project's); the storyboard folder and all in it
  // are the worker's, and are looked at part by part.
  if (typeof from !== "string" || !isAbsolute(from) || normalize(from) !== from || from === sep) throw new Error("stagePage: the storyboard is not a whole path");
  let source;
  try {
    source = join(realpathSync.native(dirname(from)), basename(from));
  } catch {
    throw new Error("stagePage: the storyboard's project is not there");
  }
  if (!noLinkOnTheWay(source, "folder")) throw new Error("stagePage: the storyboard is not a folder reached by no link");
  from = source;
  const registry = readRegistry(home);
  if (registry === null) throw new Error("stagePage: the registry can't be read");
  const names = namesOf(from);
  let total = 0;
  const sources = [["index.html", readSource(from, "index.html", PAGE_MOST)], ...names.map((rel) => [rel, readSource(from, rel, FILE_MOST)])];
  for (const [, bytes] of sources) total += bytes.length;
  if (total > ALL_MOST) throw new Error("stagePage: the storyboard is larger than a page may be");
  const hashes = sources.map(([rel, bytes]) => [rel, sha256(bytes)]);

  const before = registry.pages.find((p) => p.id === slug) ?? null;
  if (before && version === undefined && isDeepStrictEqual(before.files.map((f) => [f.rel, f.sha256]), hashes) && pageStill(before)) {
    return { stage: before.stage, file: before.file, files: before.files.slice(1).map((f) => f.rel), version: before.version, reused: true };
  }
  const real = realpathSync.native(folder);
  const place = ownFolder(ownFolder(real, STORYBOARDS), slug);
  let n = Number.isInteger(version) && version >= 1 ? version : (before?.version ?? 0) + 1;
  // A version's folder left from a registry that was lost is never written into: the next free one is taken.
  if (!(Number.isInteger(version) && version >= 1)) while (lstatSync(join(place, `v${n}`), { throwIfNoEntry: false })) n++;
  const stage = join(place, `v${n}`);
  mkdirSync(stage);
  try {
    const files = sources.map(([rel, bytes], i) => {
      const parts = rel.split("/");
      let at = stage;
      for (const part of parts.slice(0, -1)) at = ownFolder(at, part);
      const to = join(at, parts.at(-1));
      writeFileSync(to, bytes, { flag: "wx", mode: 0o644 });
      const made = lstatSync(to, { bigint: true });
      return { rel, size: Number(made.size), dev: String(made.dev), ino: String(made.ino), sha256: hashes[i][1] };
    });
    const page = {
      id: slug, kind, slug, episode: String(episode), version: n, stage, file: join(stage, "index.html"), files,
      title: typeof title === "string" && title ? title : "Reel Kit storyboard", description: DESCRIPTION, icon: ICON, url: before?.url ?? null
    };
    writeRegistry(home, { pages: [...registry.pages.filter((p) => p.id !== slug), page] });
    return { stage, file: page.file, files: names, version: n, reused: false };
  } catch (e) {
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
}

/** Whether every file of `page` is still as it was staged: its stage reached by no link from the top, and each file a plain file reached
    by no link, of the size, device, inode and SHA-256 it was staged with. */
function pageStill(page) {
  if (!noLinkOnTheWay(page.stage, "folder")) return false;
  for (const f of page.files) {
    const path = join(page.stage, f.rel);
    const parts = f.rel.split("/");
    for (let i = 0; i < parts.length; i++) {
      let seen;
      try {
        seen = lstatSync(join(page.stage, ...parts.slice(0, i + 1)), { bigint: true });
      } catch {
        return false;
      }
      if (seen.isSymbolicLink() || (i < parts.length - 1 ? !seen.isDirectory() : !seen.isFile())) return false;
      if (i === parts.length - 1 && (Number(seen.size) !== f.size || String(seen.dev) !== f.dev || String(seen.ino) !== f.ino)) return false;
    }
    const read = readPlain(path, f.size);
    if (read === null || read.dev !== f.dev || read.ino !== f.ino || read.bytes.length !== f.size || sha256(read.bytes) !== f.sha256) return false;
  }
  return true;
}

// --- The guard's answer ---

const allow = (reason) => ({ decision: "allow", reason });
const deny = (reason = OPENING_REFUSED) => ({ decision: "deny", reason });

/** Whether `given` holds no key but `keys`. */
const only = (given, keys) => Object.keys(given).every((key) => keys.includes(key));

/** Whether `path` is the whole path `want`, written plainly: no `.` or `..`, no doubled or last slash. */
const exactly = (path, want) => typeof path === "string" && isAbsolute(path) && normalize(path) === path && !path.endsWith("/") && path === want;

/** The pages of the registry whose stage is in her folder `folder`, by its real path; null when the registry can't be read. */
function pagesIn(home, folder) {
  const registry = readRegistry(home);
  if (registry === null) return null;
  let real;
  try {
    real = realpathSync.native(folder);
  } catch {
    return [];
  }
  const inside = join(real, STORYBOARDS) + sep;
  return registry.pages.filter((p) => p.stage.startsWith(inside));
}

const PUBLISH_KEYS = ["action", "file_path", "files", "root", "url", "capabilities", "title", "description", "icon"];

/** What a publish of `page` with `given` is answered. */
function publishOf(page, given) {
  if (!only(given, PUBLISH_KEYS)) return deny(PUBLISH_EXACTLY);
  if (given.capabilities !== undefined && !isDeepStrictEqual(given.capabilities, CAPABILITIES)) return deny(PUBLISH_EXACTLY);
  if (page.url === null ? given.url !== undefined : plainUrl(given.url) !== page.url) return deny(PUBLISH_EXACTLY);
  for (const key of ["title", "description", "icon"]) if (given[key] !== undefined && given[key] !== page[key]) return deny(PUBLISH_EXACTLY);
  if (given.root !== undefined && !exactly(given.root, page.stage)) return deny(PUBLISH_EXACTLY);
  if (given.files !== undefined) {
    if (!isObject(given.files)) return deny(PUBLISH_EXACTLY);
    const rels = page.files.slice(1).map((f) => f.rel);
    const keys = Object.keys(given.files);
    if (keys.length !== rels.length || !keys.every((key) => rels.includes(key))) return deny(PUBLISH_EXACTLY);
    for (const rel of rels) {
      const value = given.files[rel];
      const source = typeof value === "string" ? value : isObject(value) && only(value, ["from"]) ? value.from : undefined;
      if (typeof source !== "string" || source === "") return deny(PUBLISH_EXACTLY);
      const want = join(page.stage, rel);
      if (isAbsolute(source) ? !exactly(source, want) : !(given.root !== undefined && normalize(source) === source && source === rel)) return deny(PUBLISH_EXACTLY);
    }
  }
  if (!pageStill(page)) return deny(PUBLISH_EXACTLY);
  return allow("a storyboard BRIMM Video Studio staged");
}

const COMMENT_KEYS = { read: ["action", "url", "thread_id", "cursor"], resolve: ["action", "url", "thread_id"], reply: ["action", "url", "thread_id", "text"] };

/** What the opening answers to a call of Artifact or ArtifactComments, `input` as the PreToolUse hook is given it, for her folder
    `folder` in the home `home`: { decision: "allow"|"deny", reason }. Any other tool, a registry that can't be read, and anything these
    two would do but what the opening allows, are refused. */
export function openingDecision(input, { home, folder }) {
  const name = isObject(input) ? input.tool_name : undefined;
  const given = isObject(input) && isObject(input.tool_input) ? input.tool_input : null;
  if (!NARROW.includes(name) || given === null) return deny();
  const action = given.action;
  if (name === "Artifact" && action === "quickstart") {
    return only(given, ["action", "intent", "design_systems"]) && given.intent === "other" && given.design_systems === false ? allow("the read-only start of a page") : deny();
  }
  if (typeof home !== "string" || !isAbsolute(home) || typeof folder !== "string" || !isAbsolute(folder)) return deny();
  const pages = pagesIn(home, folder);
  if (pages === null) return deny();
  const recorded = (url) => (typeof url === "string" ? pages.find((p) => p.url !== null && p.url === plainUrl(url)) ?? null : null);

  if (name === "Artifact") {
    if (action === undefined || action === "publish") {
      const page = pages.find((p) => exactly(given.file_path, p.file));
      return page ? publishOf(page, given) : deny();
    }
    if (action === "open") return only(given, ["action", "url"]) && recorded(given.url) ? allow("a storyboard's page, opened") : deny();
    return deny();
  }
  // ArtifactComments.
  if (!Object.hasOwn(COMMENT_KEYS, action) || !only(given, COMMENT_KEYS[action]) || !recorded(given.url)) return deny();
  for (const key of ["thread_id", "cursor"]) if (given[key] !== undefined && (typeof given[key] !== "string" || given[key] === "")) return deny();
  if (action === "resolve" && given.thread_id === undefined) return deny();
  if (action === "reply" && (given.thread_id === undefined || given.text !== REPLY)) return deny();
  return allow(action === "read" ? "her notes on a storyboard" : action === "reply" ? "On it." : "a note on a storyboard, done");
}
