// Sallie's own Reel Kit style pack, in BRIMM Video in Dropbox (spec 2026-11-23 Reel Kit in Studio; plan Task 8).
//
// Her pack is the folder `Reel Kit style` in BRIMM Video (`settings.root`). It is made once, from the shipped pack
// (tool/brand/reel-kit, Task 7), only when BRIMM Video's folder is there and `Reel Kit style` is not, and nothing Studio does
// afterwards writes into it but her own backups and her own "go back". Before every edit `syncPack` copies her pack, with
// tool/brand/fonts' font files, into `<REEL_KIT_HOME>/style/` on this Mac, built whole beside it and swapped in; while she has her
// own pack the shipped one is never read. Her pack gone after it was there, BRIMM Video's folder gone, or her pack not readable
// (a half-synced style.json): one plain line, and nothing is made or changed.
//
// Every write into Dropbox is by dropbox.js's rule: each file is written whole on this Mac's own disk first and cloned in under
// its final name (cloneIn, or replaceIn over a file of hers), nothing there is renamed, and BRIMM Video's folder is looked at
// again at the moment of each write. Nothing here makes a folder with `recursive`, so nothing can make BRIMM Video's folder.
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildOf, isInstalled } from "./build.js";
import { cloneIn, replaceIn } from "./dropbox.js";
import { folderFingerprint, reelKitHome } from "./reel-kit.js";
import { commit, fresh, recoverAll, rollBack, swapIn } from "./reel-kit-swap.js";
import { rootGone } from "./settings.js";

const TOOL = dirname(fileURLToPath(import.meta.url));
/** The shipped BRIMM style pack (Task 7): what her pack is made from, the first time only. */
export const SHIPPED_PACK = join(TOOL, "brand", "reel-kit");
/** The brand's font files (Google Fonts TTFs, Allison and the OFL texts): copied into the style Reel Kit reads, never into Dropbox. */
export const BRAND_FONTS = join(TOOL, "brand", "fonts");
const BRAND_MD = join(TOOL, "brand", "brand.md");
/** This checkout's build (build.js): whether this is a dev Mac (the Mac Studio, which makes her pack) or an installed one. */
const thisBuild = () => buildOf(dirname(TOOL));

/** Her pack's folder's name, in BRIMM Video. */
export const PACK_NAME = "Reel Kit style";
/** The file in her pack that holds the shipped pack's fingerprint it was made from. */
export const MADE_FROM = ".made-from";
/** The folder in her pack that holds the shipped pack it was made from (no fonts), so that a carry onto a new one is a three-way merge.
    Nothing reads it but the carry: syncPack, packDiff, packFault, her copies and the working copies leave it out (walkPack). */
export const BASE = ".base";
/** Her pack: `Reel Kit style` in BRIMM Video. */
export const herPack = (settings) => join(settings.root, PACK_NAME);
/** The style Reel Kit reads on this Mac. */
export const styleDir = (home) => join(reelKitHome(home), "style");
/** This Mac's record that her pack was made, or seen, in Dropbox: `{ madeAt, from }` (and `foundAt` when another Mac made it). */
export const madeRecord = (home) => join(reelKitHome(home), "style-made.json");
/** The marker reel-kit-swap.js's commit writes while the old style is taken away, so a run killed then is known to have been whole. */
export const swapMarker = (home) => join(reelKitHome(home), "style-swap.committed");

/** The text files of her pack that Reel Kit reads, at its top. */
const TOP = ["STYLE.md", "style.json", "brand.css"];
/** A backup of her pack, inside it: `before <YYYY-MM-DD HH.MM>`, with ` (2)` and on for a second in one minute. */
const BACKUP = /^before \d{4}-\d{2}-\d{2} \d{2}\.\d{2}(?: \(\d+\))?$/;
const isBackup = (name) => name.startsWith("before ");
const leftover = (name) => name === ".DS_Store" || name.startsWith("._");
const TEXT = /\.(md|json|css|html|txt|js|svg)$/i;

/** The font families the brand uses: Josefin Sans and Allison, both from Google Fonts (tool/brand/brand.md). */
export const FAMILIES = ["Josefin Sans", "Allison"];
/** CSS's own generic families and keywords, which name no font. */
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong", "inherit", "initial", "unset", "revert", "revert-layer"]);
/** style.json's colour keys that hold a brand colour, and the brand.md name of each. */
export const BRAND_KEYS = Object.freeze({ light: "Smoke", dark: "Navy", ink: "Navy", accent: "Sand", accent_on_light: "Sand on light" });
const HEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

// --- Her words. No line holds a path or a command. ---
const NO_ROOT = "BRIMM Video's folder in Dropbox is not here (Dropbox may be signed out, or have moved), so Reel Kit's style was left as it was and nothing was made.";
const GONE = "Your Reel Kit style folder is no longer in BRIMM Video in Dropbox. It was there before, so Studio will not edit with its starting style in its place: bring the folder back from Dropbox's deleted files, or ask Jason.";
const NOT_FOLDER = "Reel Kit style in BRIMM Video is not a folder, so Reel Kit's style was left as it was: ask Jason.";
const NO_PACK = "There is no Reel Kit style folder in BRIMM Video yet, so there is nothing to keep a copy of.";
/** An installed Mac never makes her pack: the Mac Studio does, and Dropbox brings it over. */
export const NOT_YET = "Your Reel Kit style isn't on this Mac yet: Dropbox may still be bringing it over. Try again in a few minutes, or ask Jason.";
const NO_PACK_TO_COMPARE = "There is no Reel Kit style folder in BRIMM Video yet, so there is nothing to compare with the starting style.";

/** A file of her pack as she finds it in Finder, never a path: its own name, and "Reel Kit style's board" when it sits in board/. */
const nameIn = (rel) => `${basename(rel)} in Reel Kit style${rel.startsWith("board/") ? "'s board" : ""}`;

/** A refusal in her words: thrown inside this module and given back as its line. */
class Refused extends Error {}
/** What went wrong, as her line: a refusal's own words, or, for anything else, a line with no path in it, the detail given to `log`
    (the caller's, for Jason). */
const lineOf = (e, log = () => {}, root) => {
  if (e instanceof Refused) return e.message;
  // BRIMM Video's folder gone in the middle of a write fails the write itself (cloneIn finds no file, or no folder): that is the line.
  if (root !== undefined && rootGone(root)) return NO_ROOT;
  log(`Reel Kit style: ${String(e?.message ?? e)}`);
  return "Reel Kit's style could not be brought over, so it was left as it was: ask Jason.";
};

/** brand.md's colours by name (its colour table, and "Sand on light" from its line about the Reel Kit style pack), each upper case.
    Shared with tests/reel-kit-pack.test.js, so one reader says what the brand's colours are. */
export function brandColours(text = readFileSync(BRAND_MD, "utf8")) {
  const out = {};
  for (const m of String(text).matchAll(/^\| ([A-Za-z][A-Za-z ]*?) \| `(#[0-9A-Fa-f]{6})`/gm)) out[m[1]] = m[2].toUpperCase();
  const sand = String(text).match(/Sand on light[^`\n]*`(#[0-9A-Fa-f]{6})`/);
  if (sand) out["Sand on light"] = sand[1].toUpperCase();
  return out;
}

// --- Reading what Dropbox holds, the safe way: no link followed, no pipe waited on, fstat before reading. ---
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;
/** The most of any one file read, against a runaway file, not a check of her file's size: a headshot is a few megabytes. */
const READ_MOST = 512 << 20;

/** The bytes of the file at `path`, or null when it is not a plain file there or cannot be read whole now (a placeholder
    Dropbox has not brought down cannot be read by a program the launch agent starts). */
function readSafe(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size > READ_MOST) return null;
    const buffer = Buffer.alloc(opened.size);
    let got = 0;
    while (got < buffer.length) {
      const read = readSync(fd, buffer, got, buffer.length - got, got);
      if (read === 0) break;
      got += read;
    }
    return got === buffer.length ? buffer : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
const textOf = (path) => {
  const bytes = readSafe(path);
  return bytes === null ? null : bytes.toString("utf8");
};
/** What is at `path`, not following a link: "folder", "file", "other", or "" when nothing is. */
const kindOf = (path) => {
  try {
    const s = lstatSync(path);
    return s.isDirectory() ? "folder" : s.isFile() ? "file" : "other";
  } catch {
    return "";
  }
};

/** Every folder and file in a pack, relative, `/`-joined, parents before what they hold. `before …` folders and `.base` at its top
    (`.base` kept with `base`: a copy kept and a going back carry it, so `.made-from` and the base never part), `.DS_Store` and `._*`
    are left out. A link or anything that is neither a file nor a folder refuses the pack. */
function walkPack(dir, { base = false } = {}) {
  const dirs = [];
  const files = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      if (leftover(name) || (rel === "" && (isBackup(name) || (name === BASE && !base)))) continue;
      const r = rel ? `${rel}/${name}` : name;
      const kind = lstatSync(join(abs, name));
      if (kind.isSymbolicLink()) throw new Refused(`${nameIn(r)} is a link, and Studio copies only plain files and folders, so Reel Kit's style was left as it was.`);
      if (kind.isDirectory()) {
        dirs.push(r);
        walk(join(abs, name), r);
      } else if (kind.isFile()) files.push(r);
      else throw new Refused(`${nameIn(r)} is not a file or a folder, so Reel Kit's style was left as it was.`);
    }
  };
  walk(dir, "");
  return { dirs, files };
}

/** Copy `files` (relative) from `from` into the local folder `to`, each read the safe way. A file that cannot be read refuses. */
function copyLocal(from, to, files) {
  for (const f of files) {
    const bytes = readSafe(join(from, f));
    if (bytes === null) throw new Refused(`${nameIn(f)} could not be read (Dropbox may still be bringing it over), so Reel Kit's style was left as it was.`);
    mkdirSync(dirname(join(to, f)), { recursive: true });
    writeFileSync(join(to, f), bytes);
  }
}

/** A folder of this Mac's own disk for one run's work copies, beside REEL_KIT_HOME's style. */
let runs = 0;
const workOf = (home) => join(reelKitHome(home), "style-work", `${process.pid}-${(runs += 1)}`);

/** Put the work copies at `work` into Dropbox at `dest`, by dropbox.js's rule: the folders made one by one (never `recursive`),
    then each file cloned in, in the order given (`replace`: a file already there is replaced, for her "go back"). `guard()` is
    asked before each write and throws when the write must not happen (BRIMM Video's folder gone). `put` lists what was put in,
    so a failure can take away what this run made. `makeDest`: whether `dest` itself is made. `dropbox` is cloneIn's options. */
function putIn({ work, dest, dirs, files, guard, put, makeDest = true, replace = false, dropbox = {} }) {
  if (makeDest) {
    guard();
    mkdirSync(dest);
    put.dirs.push(dest);
  }
  for (const d of dirs) {
    if (kindOf(join(dest, d)) === "folder") continue;
    guard();
    mkdirSync(join(dest, d));
    put.dirs.push(join(dest, d));
  }
  for (const f of files) {
    guard();
    const to = join(dest, f);
    if (replace && existsSync(to)) replaceIn(join(work, f), to, dropbox);
    else cloneIn(join(work, f), to, dropbox);
    put.files.push(to);
  }
}

/** Take away what a failed run put into Dropbox: its own files, then its own folders when they are empty. Nothing else. */
function takeBack(put) {
  for (const f of put.files.reverse()) rmSync(f, { force: true });
  for (const d of put.dirs.reverse()) {
    try {
      rmdirSync(d);
    } catch {
      // Not empty, or gone with BRIMM Video's folder: left as it is.
    }
  }
}

/** The guard of every write into Dropbox: BRIMM Video's folder is looked at again, at the moment of the write. */
const rootGuard = (root, also = () => {}) => () => {
  if (rootGone(root)) throw new Refused(NO_ROOT);
  also();
};

function readRecord(home) {
  try {
    const doc = JSON.parse(readFileSync(madeRecord(home), "utf8"));
    return doc && typeof doc === "object" ? doc : null;
  } catch {
    return null;
  }
}
/** This Mac's record, written whole (`.writing`, then renamed: it is on this Mac's own disk, not in Dropbox). */
function writeRecord(home, doc) {
  mkdirSync(reelKitHome(home), { recursive: true });
  const to = madeRecord(home);
  writeFileSync(`${to}.writing`, `${JSON.stringify(doc, null, 2)}\n`);
  renameSync(`${to}.writing`, to);
}
const isoOf = (now) => new Date(now instanceof Date ? now.getTime() : now).toISOString();
const madeFromOf = (pack) => {
  const text = textOf(join(pack, MADE_FROM));
  return text === null ? null : text.trim() || null;
};

/** Make her pack from the shipped one, only when BRIMM Video's folder is there and `Reel Kit style` is not, and this Mac has
    never known her pack (`style-made.json`): then it is gone, and is never made again in its place. Gives `{ made, why }`: `why` is
    "" or the one line she reads, and nothing is made with it. A pack found there that this Mac has no record of is recorded as seen
    (`foundAt`), so this Mac too refuses once it has gone. Made, it holds the shipped pack's files and `.made-from` (its fingerprint);
    `style.json` goes in last, so a pack cut short never reads as whole, and what this run put in is taken back on a failure.
    Only a dev Mac makes it (`build`, build.js's, this checkout's by default: the Mac Studio, which runs Reel Kit first); an installed
    Mac that finds no pack makes nothing and says NOT_YET. `shipped`, `now` and `dropbox` (cloneIn's options) are a test's to give. */
export function ensureHerPack({ settings, home = homedir(), shipped = SHIPPED_PACK, now = Date.now(), dropbox = {}, log = () => {}, build = thisBuild() } = {}) {
  const her = herPack(settings);
  if (rootGone(settings.root)) return { made: false, why: NO_ROOT };
  const record = readRecord(home);
  const there = kindOf(her);
  if (there === "other" || there === "file") return { made: false, why: NOT_FOLDER };
  if (there === "folder") {
    if (!record) {
      try {
        writeRecord(home, { madeAt: null, foundAt: isoOf(now), from: madeFromOf(her) });
      } catch (e) {
        return { made: false, why: lineOf(e, log) };
      }
    }
    return { made: false, why: "" };
  }
  if (record) return { made: false, why: GONE };
  if (isInstalled(build)) return { made: false, why: NOT_YET };

  const work = workOf(home);
  const pack = join(work, "pack");
  const put = { dirs: [], files: [] };
  try {
    const { dirs, files } = walkPack(shipped);
    mkdirSync(pack, { recursive: true });
    for (const f of files) {
      mkdirSync(dirname(join(pack, f)), { recursive: true });
      writeFileSync(join(pack, f), readFileSync(join(shipped, f)));
    }
    const from = folderFingerprint(pack);
    writeFileSync(join(pack, MADE_FROM), `${from}\n`);
    // The base it is made from, beside it, for a carry onto a later one.
    for (const f of files) {
      mkdirSync(dirname(join(pack, BASE, f)), { recursive: true });
      writeFileSync(join(pack, BASE, f), readFileSync(join(shipped, f)));
    }
    const base = files.map((f) => `${BASE}/${f}`);
    const order = [...files.filter((f) => f !== "style.json"), ...base, MADE_FROM, ...files.filter((f) => f === "style.json")];
    putIn({ work: pack, dest: her, dirs: [...dirs, BASE, ...dirs.map((d) => `${BASE}/${d}`)], files: order, guard: rootGuard(settings.root), put, dropbox });
    writeRecord(home, { madeAt: isoOf(now), from });
    return { made: true, why: "" };
  } catch (e) {
    takeBack(put);
    return { made: false, why: lineOf(e, log, settings.root) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The font families style.json names: every string under a `family` key, anywhere in it. */
function familiesInStyle(doc) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "family" && typeof x === "string") out.push(x.trim());
        else walk(x);
      }
    }
  };
  walk(doc);
  return out;
}
/** The font families brand.css names: in `font-family` and in its `--font-…` variables, quotes taken off, generics left out. */
function familiesInCss(css) {
  const out = [];
  for (const m of css.matchAll(/(?:font-family|--font-[\w-]+)\s*:\s*([^;}]+)/gi)) {
    for (const piece of m[1].split(",")) {
      const name = piece.trim().replace(/^['"]|['"]$/g, "").trim();
      if (name && !GENERIC.has(name.toLowerCase()) && !/var\(/i.test(name)) out.push(name);
    }
  }
  return out;
}
/** The font files brand.css's `@font-face` rules name, as written in their `url(...)`. */
const fontFilesInCss = (css) =>
  [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].flatMap((m) => [...m[1].matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)].map((u) => u[1]));

/** Whether a "Sallie Holder" in `text` at `index` is a line saying never to use it (Task 7's pack test's form). */
const toldNever = (text, index) => /["“]$|\bNever |\bno /i.test(text.slice(Math.max(0, index - 20), index));

/** What is wrong with the pack at `dir`, as one plain line, or "" when nothing is. In order: style.json reads as JSON (a half-synced
    file fails here), and STYLE.md and brand.css read; every font family style.json or brand.css names is Josefin Sans or Allison,
    every font file brand.css (or board/files.json) names is one tool/brand/fonts holds; no "Sallie Holder" in its text files but a
    line saying never to use it; each style.json key that holds a brand colour holds a colour (one she changed on purpose is hers).
    `before …` folders are not looked in. Her files are never size-checked. `fonts` is a test's to give. */
export function packFault(dir, { fonts = BRAND_FONTS } = {}) {
  const text = textOf(join(dir, "style.json"));
  let style = null;
  try {
    style = text === null ? null : JSON.parse(text);
  } catch {
    style = null;
  }
  if (!style || typeof style !== "object" || Array.isArray(style)) {
    return text === null
      ? "Reel Kit style has no style.json that can be read (Dropbox may still be bringing it over), so Reel Kit's style was left as it was."
      : "Reel Kit style's style.json does not read (Dropbox may still be bringing it over, or it was saved part-way), so Reel Kit's style was left as it was.";
  }
  const css = textOf(join(dir, "brand.css"));
  for (const [name, got] of [["STYLE.md", textOf(join(dir, "STYLE.md"))], ["brand.css", css]]) {
    if (got === null) return `Reel Kit style has no ${name} that can be read (Dropbox may still be bringing it over), so Reel Kit's style was left as it was.`;
  }

  const allowed = new Set(FAMILIES.map((f) => f.toLowerCase()));
  for (const family of [...familiesInStyle(style), ...familiesInCss(css)]) {
    if (!allowed.has(family.toLowerCase())) return `Reel Kit style names the font ${family}, and The BRIMM uses only Josefin Sans and Allison, from Google Fonts, so Reel Kit's style was left as it was.`;
  }
  let held;
  try {
    held = new Set(readdirSync(fonts));
  } catch {
    held = new Set();
  }
  const files = fontFilesInCss(css);
  const listed = textOf(join(dir, "board", "files.json"));
  if (listed !== null) {
    let list;
    try {
      list = JSON.parse(listed);
    } catch {
      return "Reel Kit style's board files.json does not read (Dropbox may still be bringing it over), so Reel Kit's style was left as it was.";
    }
    if (Array.isArray(list)) files.push(...list.filter((f) => typeof f === "string" && f.startsWith("fonts/")));
  }
  for (const file of files) {
    const name = file.startsWith("fonts/") ? file.slice(6) : "";
    if (!name || name.includes("/") || !held.has(name)) return `Reel Kit style uses the font file ${basename(file.split(/[?#]/)[0]) || "with no name"}, which is not one of the brand's Google Fonts files, so Reel Kit's style was left as it was.`;
  }

  let all;
  try {
    all = walkPack(dir).files;
  } catch (e) {
    return lineOf(e);
  }
  for (const f of all.filter((x) => TEXT.test(x))) {
    const t = textOf(join(dir, f));
    if (t === null) continue;
    for (const m of t.matchAll(/Sallie Holder/g)) {
      if (!toldNever(t, m.index)) return `${nameIn(f)} uses the name Sallie Holder: the name on screen is Sallie Ogden, so Reel Kit's style was left as it was.`;
    }
  }

  const colours = style.colors;
  const brand = brandColours();
  for (const [key, name] of Object.entries(BRAND_KEYS)) {
    const v = colours && typeof colours === "object" ? colours[key] : undefined;
    if (typeof v !== "string" || !HEX.test(v.trim())) {
      return `Reel Kit style's colour ${key} (the brand's ${name}, ${brand[name] ?? "a hex colour"}) is not a colour like #1F2D42, so Reel Kit's style was left as it was.`;
    }
  }
  return "";
}

/** The font files the style at `dir` names (brand.css's and board/files.json's `fonts/…`), with Allison and the OFL texts. */
function fontsWanted(dir, fonts) {
  const css = textOf(join(dir, "brand.css")) ?? "";
  const names = new Set(fontFilesInCss(css).filter((f) => f.startsWith("fonts/")).map((f) => f.slice(6)));
  try {
    const list = JSON.parse(textOf(join(dir, "board", "files.json")) ?? "[]");
    if (Array.isArray(list)) for (const f of list) if (typeof f === "string" && f.startsWith("fonts/")) names.add(f.slice(6));
  } catch {
    // packFault has refused a files.json that does not read.
  }
  for (const f of readdirSync(fonts)) if (f === "Allison-Regular.ttf" || /^OFL-.*\.txt$/.test(f)) names.add(f);
  return [...names].sort();
}

/** Bring her pack over to the style Reel Kit reads on this Mac, before every edit: her `STYLE.md`, `style.json`, `brand.css`, any
    `headshot.*` and `board/`, then tool/brand/fonts' files into its `fonts/` and `board/fonts/` (only those the pack names, with
    Allison and the OFL texts), built whole in `style.new` beside it and swapped in for `style`. Makes her pack first, the first time
    (ensureHerPack). Gives "" or the one line she reads; with a line nothing is copied and `style` is as it was. Her pack is never
    written into, and the shipped pack never read while she has her own. */
export function syncPack({ settings, home = homedir(), shipped = SHIPPED_PACK, now = Date.now(), dropbox = {}, fonts = BRAND_FONTS, log = () => {}, build = thisBuild() } = {}) {
  const style = styleDir(home);
  // The swap is reel-kit-swap.js's, in REEL_KIT_HOME (all of it this Mac's own): a run killed in the middle of one is put right
  // first, before anything can refuse, so `style` is never left missing with only `style.old` holding it.
  const ctx = { paths: { work: reelKitHome(home), committed: swapMarker(home) }, journal: [] };
  try {
    mkdirSync(reelKitHome(home), { recursive: true });
    recoverAll(ctx, [style]);
  } catch (e) {
    return lineOf(e, log);
  }
  const ensured = ensureHerPack({ settings, home, shipped, now, dropbox, log, build });
  if (ensured.why) return ensured.why;
  const her = herPack(settings);
  let next = "";
  try {
    next = fresh(ctx, style);
    const { files } = walkPack(her);
    const wanted = files.filter((f) => TOP.includes(f) || /^headshot\.[^/]+$/i.test(f) || (f.startsWith("board/") && !f.startsWith("board/fonts/")));
    copyLocal(her, next, wanted);
    // What is checked is the copy Reel Kit will read, so a change she makes meanwhile is never half taken.
    const fault = packFault(next, { fonts });
    if (fault) throw new Refused(fault);
    const names = fontsWanted(next, fonts);
    for (const into of ["fonts", ...(kindOf(join(next, "board")) === "folder" ? ["board/fonts"] : [])]) {
      mkdirSync(join(next, into), { recursive: true });
      for (const f of names) writeFileSync(join(next, into, f), readFileSync(join(fonts, f)));
    }
    swapIn(ctx, next, style);
    const left = commit(ctx);
    if (left.length) log(`Reel Kit style: the old style could not be taken away yet; the next run takes it away.`);
    return "";
  } catch (e) {
    try {
      rollBack(ctx);
      if (next) rmSync(next, { recursive: true, force: true });
    } catch {
      // What is left is put right by the next run's recoverAll.
    }
    return lineOf(e, log, settings.root);
  }
}

const two = (n) => String(n).padStart(2, "0");
/** `before <YYYY-MM-DD HH.MM>`, in this Mac's own time. */
const backupName = (now) => {
  const d = now instanceof Date ? now : new Date(now);
  return `before ${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}.${two(d.getMinutes())}`;
};

/** Keep a copy of her pack inside it, as `before <YYYY-MM-DD HH.MM>` (with ` (2)` and on when the minute has one already), copied,
    never moved, and never holding another backup. Gives the backup's name. Throws, in her words, when BRIMM Video's folder or her
    pack is not there, or a file cannot be read or put in; what this run put in is then taken back. */
export function backupPack({ settings, home = homedir(), now = new Date(), dropbox = {}, log = () => {} } = {}) {
  const her = herPack(settings);
  if (rootGone(settings.root)) throw new Error(NO_ROOT);
  if (kindOf(her) !== "folder") throw new Error(NO_PACK);
  const stem = backupName(now);
  let name = stem;
  for (let n = 2; existsSync(join(her, name)); n++) name = `${stem} (${n})`;
  const work = workOf(home);
  const put = { dirs: [], files: [] };
  const guard = rootGuard(settings.root, () => {
    if (kindOf(her) !== "folder") throw new Refused(NO_PACK);
  });
  try {
    const { dirs, files } = walkPack(her, { base: true });
    mkdirSync(work, { recursive: true });
    copyLocal(her, work, files);
    putIn({ work, dest: join(her, name), dirs, files, guard, put, dropbox });
    return name;
  } catch (e) {
    takeBack(put);
    if (!(e instanceof Refused)) log(`Reel Kit style: ${String(e?.message ?? e)}`);
    if (e instanceof Refused || rootGone(settings.root)) throw new Error(e instanceof Refused ? e.message : NO_ROOT);
    throw new Error("A copy of Reel Kit style could not be kept, and nothing in it was changed: ask Jason.");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Go back to the backup `name` in her pack: a backup of her pack as it is now is kept first (backupPack), then the backup's files
    (with the base it was made from, `.base/`, when it holds one) are put in over hers, each replaced by dropbox.js's rule. Files of hers that the backup does not hold stay. Gives the name of
    the backup of how it was. Throws, in her words, when there is no such backup or a write cannot be made. */
export function restorePack({ settings, name, home = homedir(), now = new Date(), dropbox = {}, log = () => {} } = {}) {
  const her = herPack(settings);
  if (rootGone(settings.root)) throw new Error(NO_ROOT);
  const from = join(her, String(name ?? ""));
  if (!BACKUP.test(String(name ?? "")) || kindOf(from) !== "folder") throw new Error(`There is no copy called ${name} in Reel Kit style, so nothing was changed.`);
  // A copy that is not whole is never put back, and nothing is kept for it.
  const fault = packFault(from);
  if (fault) throw new Error(`The copy called ${name} in Reel Kit style is not whole, so nothing was changed: ${fault}`);
  const kept = backupPack({ settings, home, now, dropbox, log });
  const work = workOf(home);
  const guard = rootGuard(settings.root, () => {
    if (kindOf(her) !== "folder") throw new Refused(NO_PACK);
  });
  try {
    const { dirs, files } = walkPack(from, { base: true });
    mkdirSync(work, { recursive: true });
    copyLocal(from, work, files);
    putIn({ work, dest: her, dirs, files, guard, put: { dirs: [], files: [] }, makeDest: false, replace: true, dropbox });
    return kept;
  } catch (e) {
    if (!(e instanceof Refused)) log(`Reel Kit style: ${String(e?.message ?? e)}`);
    const why = e instanceof Refused ? ` ${e.message}` : rootGone(settings.root) ? ` ${NO_ROOT}` : " Ask Jason.";
    throw new Error(`Reel Kit style could not go back to ${name}, and how it was is kept as ${kept}.${why}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Every leaf of a JSON value by dotted path (`captions.hifi.size`, `colors.series.0`); an empty object or list is a leaf. */
function leaves(value, at = "", out = new Map()) {
  const isObject = value && typeof value === "object";
  const keys = isObject ? Object.keys(value) : [];
  if (!isObject || keys.length === 0) {
    out.set(at, value);
    return out;
  }
  for (const k of keys) leaves(value[k], at ? `${at}.${k}` : k, out);
  return out;
}
const shown = (v) => (typeof v === "string" ? `"${v}"` : JSON.stringify(v));

/** How her pack differs from the shipped one, as plain lines: each key of style.json by dotted path, then which of STYLE.md and
    brand.css are not the same. None when they are the same. `before …` folders are not hers. */
export function packDiff({ settings, shipped = SHIPPED_PACK } = {}) {
  const her = herPack(settings);
  if (rootGone(settings.root)) return [NO_ROOT];
  if (kindOf(her) !== "folder") return [NO_PACK_TO_COMPARE];
  const lines = [];
  let hers;
  try {
    hers = JSON.parse(textOf(join(her, "style.json")));
  } catch {
    hers = undefined;
  }
  const base = JSON.parse(readFileSync(join(shipped, "style.json"), "utf8"));
  if (hers === undefined || hers === null) lines.push("style.json: yours does not read, so it cannot be compared with the starting style.");
  else {
    const a = leaves(base);
    const b = leaves(hers);
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const label = key || "style.json";
      if (!b.has(key)) lines.push(`${label}: ${shown(a.get(key))} in the starting style, not in yours`);
      else if (!a.has(key)) lines.push(`${label}: ${shown(b.get(key))} in yours, not in the starting style`);
      else if (JSON.stringify(a.get(key)) !== JSON.stringify(b.get(key))) lines.push(`${label}: ${shown(b.get(key))} in yours, ${shown(a.get(key))} in the starting style`);
    }
  }
  for (const name of ["STYLE.md", "brand.css"]) {
    const mine = readSafe(join(her, name));
    if (mine === null) lines.push(`${name}: not in yours`);
    else if (!mine.equals(readFileSync(join(shipped, name)))) lines.push(`${name}: yours is not the same as the starting style's`);
  }
  return lines;
}

/** Whether Jason has shipped a new base since her pack was made: the shipped pack's fingerprint is not the one in her pack's
    `.made-from`. False when her pack holds no `.made-from`, since that cannot be told. */
export function shippedMoved({ settings, shipped = SHIPPED_PACK } = {}) {
  const from = madeFromOf(herPack(settings));
  if (!from) return false;
  return folderFingerprint(shipped) !== from;
}

// --- Her style changed in her chat (plan Task 13: reel-kit-style-chat.js) ---

/** What of a working copy of her pack is never put into Dropbox: the font files (the pack points at tool/brand/fonts, which syncPack copies
    in), the board's own fonts and board.py's scratch folder, and `.made-from`, which says the base her own pack was made from. */
const notHers = (rel) => rel === MADE_FROM || ["fonts", "board/fonts", "board/_work"].some((d) => rel === d || rel.startsWith(`${d}/`));

/** The files of a working copy that are a style's own, and go into her pack on her yes: STYLE.md, style.json, brand.css, any headshot, and
    board/ but its fonts and board.py's scratch. Anything else the worker or Reel Kit left there stays out. */
const styleFile = (rel) => TOP.includes(rel) || /^headshot\.[^/]+$/i.test(rel) || (rel.startsWith("board/") && !notHers(rel));
/** The most of one file of hers a change puts in (a page's file is 15 MB at most), and of all of them. */
const FILE_MOST = 16 << 20;
const PACK_MOST = 64 << 20;

/** Her pack's fingerprint as it is now: the SHA-256 of every file's relative path and SHA-256, `before …` copies and `.base` left out
    (walkPack), each read the safe way; null when it can't be read whole. A change records it when its copy is made, and her yes is
    refused when it is no longer the same. */
export function packPrint(settings) {
  try {
    const her = herPack(settings);
    const lines = walkPack(her).files.map((f) => {
      const bytes = readSafe(join(her, f));
      if (bytes === null) throw new Error("unread");
      return `${createHash("sha256").update(bytes).digest("hex")}  ${f}\n`;
    });
    return createHash("sha256").update(lines.join("")).digest("hex");
  } catch {
    return null;
  }
}

/** Make the working copy of her pack that a style change runs on, at `to` (a folder of this Mac's own disk, not there yet): every file of her
    pack (never its `before …` copies), or of `from`, a change still waiting for her yes, each read the safe way; refused when it breaks a
    brand rule (packFault) as it is; then tool/brand/fonts' files that it names into its `fonts/`, where Reel Kit's style.py and board.py
    look for them. Gives "" or the one line she reads; with a line, nothing is left at `to`. */
export function makeWorkingCopy({ settings, to, from = null, fonts = BRAND_FONTS, log = () => {} }) {
  const source = from ?? herPack(settings);
  if (from === null && rootGone(settings.root)) return NO_ROOT;
  if (kindOf(source) !== "folder") return from === null ? NOT_FOLDER : "The change your style was to build on is no longer on this Mac: say what you'd like changed again.";
  try {
    const { files } = walkPack(source);
    mkdirSync(to, { recursive: true });
    copyLocal(source, to, files);
    const fault = packFault(to, { fonts });
    if (fault) throw new Refused(fault);
    mkdirSync(join(to, "fonts"), { recursive: true });
    for (const f of fontsWanted(to, fonts)) writeFileSync(join(to, "fonts", f), readFileSync(join(fonts, f)));
    return "";
  } catch (e) {
    rmSync(to, { recursive: true, force: true });
    return lineOf(e, log, from === null ? settings.root : undefined);
  }
}

/** A refusal of adoptPack's, in her words, and how many files it had put into her pack before it stopped (`wrote`). */
class NotAdopted extends Error {
  constructor(message, wrote, keepNothing = false) {
    super(message);
    this.wrote = wrote;
    /** The change itself is refused (a brand rule broken, or too large): nothing of it is to be kept. */
    this.keepNothing = keepNothing;
  }
}

/** Make the working copy `from` her pack: it is read again whole onto this Mac's own disk, checked there (packFault: what is checked is
    what is written), and its files put into her pack by dropbox.js's rule, each cloned in (a file of hers replaced, by replaceIn), the
    folders made one by one, `style.json` last, with BRIMM Video's folder and her pack looked at again before each write. Only a style's
    own files go in (styleFile: STYLE.md, style.json, brand.css, any headshot and board/, never its font files or board.py's scratch), each
    at most 16 MB and 64 MB in all. Files of hers it does not hold stay. Throws a NotAdopted in her words: `wrote` says how many files went
    in before it stopped (0: her pack is as it was), and `keepNothing` whether the change itself is refused. The backup of how it was is the caller's, made first. */
export function adoptPack({ settings, home = homedir(), from, fonts = BRAND_FONTS, dropbox = {}, log = () => {} }) {
  const her = herPack(settings);
  if (rootGone(settings.root)) throw new NotAdopted(NO_ROOT, 0);
  if (kindOf(her) !== "folder") throw new NotAdopted(NOT_FOLDER, 0);
  const work = workOf(home);
  const put = { dirs: [], files: [] };
  try {
    const { dirs, files } = walkPack(from);
    const wanted = files.filter(styleFile);
    let total = 0;
    for (const f of wanted) {
      const size = lstatSync(join(from, f)).size;
      if (size > FILE_MOST) throw Object.assign(new Refused(`${nameIn(f)} is larger than a file of a style may be, so Reel Kit's style was left as it was.`), { keepNothing: true });
      total += size;
    }
    if (total > PACK_MOST) throw Object.assign(new Refused("Reel Kit style would be larger than a style may be, so Reel Kit's style was left as it was."), { keepNothing: true });
    copyLocal(from, work, wanted);
    const fault = packFault(work, { fonts });
    if (fault) throw Object.assign(new Refused(fault), { keepNothing: true });
    const order = [...wanted.filter((f) => f !== "style.json"), ...wanted.filter((f) => f === "style.json")];
    const guard = rootGuard(settings.root, () => {
      if (kindOf(her) !== "folder") throw new Refused(NOT_FOLDER);
    });
    putIn({ work, dest: her, dirs: dirs.filter((d) => (d === "board" || d.startsWith("board/")) && !notHers(d)), files: order, guard, put, makeDest: false, replace: true, dropbox });
  } catch (e) {
    throw new NotAdopted(lineOf(e, log, settings.root), put.files.length, Boolean(e?.keepNothing));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The `before …` copies of her pack, by name, newest first; none when there are none or her pack can't be read. */
export function backupsOf(settings) {
  try {
    return readdirSync(herPack(settings)).filter((name) => BACKUP.test(name) && kindOf(join(herPack(settings), name)) === "folder").sort().reverse();
  } catch {
    return [];
  }
}

/** Her pack's main lines, as she reads them: its type, its colours (by the brand's names where they are the brand's), its captions, its
    motion and its sound. None for a style.json that does not read: packFault says why first. */
export function packLines(dir) {
  let style;
  try {
    style = JSON.parse(textOf(join(dir, "style.json")));
  } catch {
    return [];
  }
  if (!style || typeof style !== "object") return [];
  const named = Object.fromEntries(Object.entries(brandColours()).filter(([name]) => name !== "Sand on light").map(([name, hex]) => [hex, name]));
  const colour = (v) => (typeof v === "string" ? (named[v.trim().toUpperCase()] ? `${named[v.trim().toUpperCase()]} ${v}` : v) : "none");
  const font = (role, said) => {
    const f = style.fonts?.[role];
    return f && typeof f.family === "string" ? `${said} ${f.family}${Number.isInteger(f.weight) ? ` ${f.weight}` : ""}${f.italic === true ? " italic" : ""}` : null;
  };
  const c = style.colors ?? {};
  const cap = (k) => {
    const x = style.captions?.[k] ?? {};
    return `size ${Number.isFinite(x.size) ? x.size : "as Reel Kit's"}${x.box ? " in a box" : ""}${x.uppercase ? ", in capitals" : ""}`;
  };
  const sfx = typeof style.sound?.sfx === "string" ? `${style.sound.sfx} effects` : "effects as Reel Kit's";
  const music = style.sound?.music === "none" || style.sound?.music === undefined ? "no music" : "music";
  return [
    `Type: ${[font("display", "display"), font("text", "text"), font("caption", "captions")].filter(Boolean).join(", ") || "as Reel Kit's"}.`,
    `Colours: light ${colour(c.light)}, dark ${colour(c.dark)}, accent ${colour(c.accent)}${typeof c.accent_on_light === "string" ? ` (${c.accent_on_light} on light)` : ""}.`,
    `Captions: hi-fi ${cap("hifi")}; lo-fi ${cap("lofi")}.`,
    `Motion: ${typeof style.motion === "string" ? style.motion : "as Reel Kit's"}. Sound: ${sfx}, ${music}.`
  ];
}

/** Her pack's board, made whole on this Mac's own disk for the side panel, and `use(folder)` given it: the board's files (never its own
    fonts) read the safe way, and tool/brand/fonts' files its files.json names into its `fonts/`, as syncPack puts them. Gives what `use`
    gives, and throws what it throws; throws, in her words, when there is no board or a file can't be read. The folder is taken away after. */
export function withHerBoard({ settings, home = homedir(), fonts = BRAND_FONTS }, use) {
  const board = join(herPack(settings), "board");
  if (rootGone(settings.root)) throw new Error(NO_ROOT);
  if (kindOf(join(board, "index.html")) !== "file") throw new Error("Your Reel Kit style has no board to show: ask Jason.");
  const work = workOf(home);
  try {
    const { files } = walkPack(board);
    copyLocal(board, work, files.filter((f) => f !== "fonts" && !f.startsWith("fonts/")));
    let list = [];
    try {
      list = JSON.parse(textOf(join(work, "files.json")) ?? "[]");
    } catch {
      list = [];
    }
    const held = new Set(readdirSync(fonts));
    for (const f of Array.isArray(list) ? list : []) {
      if (typeof f !== "string" || !f.startsWith("fonts/")) continue;
      const name = f.slice(6);
      if (name.includes("/") || !held.has(name)) throw new Refused(`Reel Kit style's board uses the font file ${basename(name)}, which is not one of the brand's Google Fonts files: ask Jason.`);
      mkdirSync(join(work, "fonts"), { recursive: true });
      writeFileSync(join(work, "fonts", name), readFileSync(join(fonts, name)));
    }
  } catch (e) {
    rmSync(work, { recursive: true, force: true });
    throw new Error(e instanceof Refused ? e.message : lineOf(e, () => {}, settings.root));
  }
  try {
    return use(work);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Every leaf of a style.json by dotted path, a list or an empty object being one leaf (a list is taken whole, never by its places). */
function leafMap(value, at = "", out = new Map()) {
  const plain = value !== null && typeof value === "object" && !Array.isArray(value);
  if (!plain || Object.keys(value).length === 0) {
    if (at) out.set(at, value);
    return out;
  }
  for (const [k, v] of Object.entries(value)) leafMap(v, at ? `${at}.${k}` : k, out);
  return out;
}
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shownOr = (v) => (v === undefined ? "none" : shown(v));
/** The three-way merge of style.json, key by key (dotted paths): a key she never changed from her base (`old`) takes the new base's value,
    or goes when the new base takes it out; a key she changed keeps hers; a key the new base adds is added; a key both changed keeps hers.
    It goes into an object only where hers and the new base's are both objects with keys; where the new base changes the shape around
    something she changed (a value, an emptied object), hers is kept whole there. `brought` gets a line for each leaf the new base brings
    in, `kept` one for each place both changed, differently. */
function mergeStyle(old, hers, neu, brought, kept, at = "") {
  const isFull = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0;
  if (sameValue(hers, old)) {
    // Hers as her base was: the new base's, each leaf it changed named.
    const o = leafMap(old, at);
    const n = leafMap(neu, at);
    for (const path of new Set([...o.keys(), ...n.keys()])) {
      if (sameValue(o.get(path), n.get(path))) continue;
      brought.push(n.get(path) === undefined ? `${path}: taken out` : `${path}: ${shown(n.get(path))}`);
    }
    return neu;
  }
  if (sameValue(neu, old) || sameValue(hers, neu)) return hers;
  if (isFull(hers) && isFull(neu)) {
    const was = isFull(old) ? old : {};
    const out = {};
    for (const k of new Set([...Object.keys(hers), ...Object.keys(neu), ...Object.keys(was)])) {
      const value = mergeStyle(was[k], hers[k], neu[k], brought, kept, at ? `${at}.${k}` : k);
      if (value !== undefined) out[k] = value;
    }
    return out;
  }
  kept.push(`${at}: yours ${shownOr(hers)}, the new starting style's ${shownOr(neu)}`);
  return hers;
}

/** Her style.json with only the keys a new base adds (for a pack with no base kept: a value of hers can't be told from the old base's). */
function addOnly(base, hers, at, brought) {
  const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!isPlain(base) || !isPlain(hers)) return hers;
  const out = { ...hers };
  for (const [k, v] of Object.entries(base)) {
    const path = at ? `${at}.${k}` : k;
    if (!Object.hasOwn(hers, k)) {
      out[k] = v;
      brought.push(`${path}: ${shown(v)}`);
    } else out[k] = addOnly(v, hers[k], path, brought);
  }
  return out;
}

const sameBytes = (a, b) => (a === null ? b === null : b !== null && a.equals(b));

/** What carrying her pack onto the base shipped now would do: { style, take, brought, kept, base }. `style` is her style.json merged
    three ways with her base (`.base/style.json`) and the new one (mergeStyle); `take`, the other files of the new base to put in: each
    whose copy in her pack is still her base's and that the new base changed; `brought` and `kept`, the lines of what is and isn't
    carried (a file she changed that the new base changed too is kept, and named). `base` is "kept" for a base that is the one
    `.made-from` names (folderFingerprint), "none" for a pack made before its base was kept, and "unchecked" for one whose base is not the
    one `.made-from` names: for those two only the keys the new base adds are carried, and no file. Throws, in her words, for a style.json of hers that does not read. */
export function carryPlan({ settings, shipped = SHIPPED_PACK }) {
  const her = herPack(settings);
  const json = (dir) => {
    try {
      const doc = JSON.parse(textOf(join(dir, "style.json")));
      return doc && typeof doc === "object" && !Array.isArray(doc) ? doc : null;
    } catch {
      return null;
    }
  };
  const hers = json(her);
  if (!hers) throw new Error("Your style.json in Reel Kit style does not read (Dropbox may still be bringing it over), so nothing was carried over.");
  const neu = JSON.parse(readFileSync(join(shipped, "style.json"), "utf8"));
  const baseDir = join(her, BASE);
  // The base is trusted only when it is the one `.made-from` names: a going back of an older Studio's, or a base cut short, is not.
  let checked = false;
  if (kindOf(baseDir) === "folder") {
    try {
      checked = folderFingerprint(baseDir) === madeFromOf(her);
    } catch {
      checked = false;
    }
  }
  const old = checked ? json(baseDir) : null;
  const brought = [];
  const kept = [];
  if (!old) return { style: addOnly(neu, hers, "", brought), take: [], brought, kept, base: kindOf(baseDir) === "folder" ? "unchecked" : "none" };
  const style = mergeStyle(old, hers, neu, brought, kept);
  const take = [];
  let rels;
  try {
    rels = new Set([...walkPack(shipped).files, ...walkPack(baseDir).files].filter((f) => f !== "style.json"));
  } catch (e) {
    throw new Error(e instanceof Refused ? e.message : "Your style's starting style can't be read whole, so nothing was carried over: ask Jason.");
  }
  for (const f of [...rels].sort()) {
    const [h, o, n] = [readSafe(join(her, f)), readSafe(join(baseDir, f)), readSafe(join(shipped, f))];
    if (sameBytes(n, o)) continue;
    if (sameBytes(h, o)) {
      if (n !== null) {
        take.push(f);
        brought.push(nameIn(f));
      }
    } else if (!sameBytes(h, n)) kept.push(`${nameIn(f)} (the new starting style has another)`);
  }
  return { style, take, brought, kept, base: "kept" };
}

/** Carry her pack onto the base shipped now (carryPlan), on her yes. Her pack as it will be is made whole on this Mac's own disk and
    checked (packFault) before anything is kept or written; then a copy of her pack is kept (backupPack); then the new base's files she
    never changed, her merged style.json, the new base as `.base/`, and `.made-from` its fingerprint, each put in by dropbox.js's rule:
    her base and `.made-from` move to the new one only once the carry is written, so a carry cut short is carried again. Gives
    { backup, brought, keptYours, base }: the copy kept, carryPlan's lines, and whether her pack had a base; throws in her words. */
export function carryPack({ settings, home = homedir(), shipped = SHIPPED_PACK, now = new Date(), dropbox = {}, log = () => {} }) {
  const plan = carryPlan({ settings, shipped });
  const her = herPack(settings);
  const work = workOf(home);
  let order;
  let dirs;
  try {
    const { files } = walkPack(her);
    copyLocal(her, work, files.filter((f) => f !== "style.json" && !notHers(f)));
    for (const f of plan.take) {
      mkdirSync(dirname(join(work, f)), { recursive: true });
      writeFileSync(join(work, f), readFileSync(join(shipped, f)));
    }
    writeFileSync(join(work, "style.json"), `${JSON.stringify(plan.style, null, 2)}\n`);
    const base = walkPack(shipped);
    for (const f of base.files) {
      mkdirSync(dirname(join(work, BASE, f)), { recursive: true });
      writeFileSync(join(work, BASE, f), readFileSync(join(shipped, f)));
    }
    writeFileSync(join(work, MADE_FROM), `${folderFingerprint(shipped)}\n`);
    // What is checked is her pack as it will be, before a copy of it is kept.
    const fault = packFault(work);
    if (fault) throw new Refused(fault);
    const parents = new Set(plan.take.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
    dirs = [...[...parents].sort(), BASE, ...base.dirs.map((d) => `${BASE}/${d}`)];
    order = [...plan.take, "style.json", ...base.files.map((f) => `${BASE}/${f}`), MADE_FROM];
  } catch (e) {
    rmSync(work, { recursive: true, force: true });
    throw new Error(lineOf(e, log, settings.root));
  }
  try {
    const backup = backupPack({ settings, home, now, dropbox, log });
    try {
      const guard = rootGuard(settings.root, () => {
        if (kindOf(her) !== "folder") throw new Refused(NOT_FOLDER);
      });
      putIn({ work, dest: her, dirs, files: order, guard, put: { dirs: [], files: [] }, makeDest: false, replace: true, dropbox });
    } catch (e) {
      throw new Error(`${lineOf(e, log, settings.root)} How it was is kept as ${backup}.`);
    }
    return { backup, brought: plan.brought, keptYours: plan.kept, base: plan.base };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
