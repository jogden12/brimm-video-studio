// An episode: one imported video, its folder in Episodes, and its record there, of what has been decided for it (version 1,
// as the design's section 1 lays it out). The record is never written into or replaced: each change is a new file in the
// folder record/, with the next number, as record/0008.json, and the highest number whose file reads whole is the record.
// So nothing is ever written into a file Dropbox may be syncing, and older records stay as the episode's history. Either Mac
// reads the record and writes it, through Dropbox, which has no lock. So a command reads the record, does its work, and
// writes the next one only when no record above the one it read is there: otherwise the other Mac wrote meanwhile, and
// nothing is written. When both Macs write the same number before Dropbox can bring one across, Dropbox keeps both, the
// second as a conflicted copy, and nothing here goes on until a person has kept one. Each Mac notes on its own disk the last
// rev it wrote of each episode, so that a record Dropbox took away again is noticed.
// Nothing here runs a program. A record is written only through the rule's text writer, which the caller gives.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { localDay } from "./shared/text.js";
import { writtenFile } from "./settings.js";

/** The folder of an episode's records. */
export const RECORD_DIR = "record";
/** The record's layout this brimm-video reads and writes. A record of a higher one is read for what it says, and never
    written: a later brimm-video wrote it. */
export const RECORD_VERSION = 1;
/** The name of a record file: its number, with four digits. */
const RECORD_NAME = /^(\d{4})\.json$/;
/** The record file of one rev, in an episode's folder. */
export const recordFile = (folder, rev) => join(folder, RECORD_DIR, `${String(rev).padStart(4, "0")}.json`);

/** What an episode is: a whole episode, or a short or upright recording, which gets no Reels. */
const KINDS = ["episode", "short video"];
/** Where a Reel candidate has got to: Claude's pick, kept by a person, dropped by one, or finished. */
const REEL_STATUSES = ["candidate", "picked", "dropped", "finished"];
/** Dropbox's names for the copy it keeps when two Macs changed one file at once: "talk (Jason Ogden's conflicted copy
    2026-10-14).mp4", and "talk (Case Conflict).mp4", "(Unicode Encoding Conflict)" and "(Selective Sync Conflict)" for its
    other kinds. Only these are taken: a name such as "Leadership (managing conflict).mov" is a video's own. Phase 1b learns
    what Dropbox's File Provider calls them, and this follows it. */
const CONFLICTED = /\(.*conflicted copy.*\)|\((Case|Unicode Encoding|Selective Sync) Conflict\)/i;
/** A creation time before this year is a file's empty date (QuickTime counts from 1904, Unix from 1970), not the day it was
    recorded. */
const FIRST_YEAR = 2000;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v !== "";
const isTime = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
/** A list of files: each path from the episode's folder, with "/", and inside it, to its size in bytes. */
const isFiles = (v) => isObject(v) && Object.entries(v).every(([path, bytes]) => isText(path) && !path.startsWith("/") && !path.split("/").includes("..") && isCount(bytes));
/** A version of a timeline handed to Final Cut: its number from 1, when, on which Mac, and the file kept in edit/. */
const isPush = (p) => isObject(p) && Number.isInteger(p.v) && p.v >= 1 && isTime(p.at) && isText(p.on) && isText(p.file);
/** A Reel: its number from 1, where it has got to, its stretch in seconds of the raw video, and its pushes, when it has any. */
const isReel = (c) => isObject(c) && Number.isInteger(c.n) && c.n >= 1 && REEL_STATUSES.includes(c.status) && isNumber(c.from) && isNumber(c.to) && c.from < c.to && typeof c.title === "string" && (c.pushed === undefined || (Array.isArray(c.pushed) && c.pushed.every(isPush)));

/** A new episode's id, made once at the import and never changed: "e-", the day without its dashes, and six hex digits, as
    "e-20261014-3fa9c1". `rand` gives a number from 0 up to 1, as Math.random does: a test gives a stand-in. */
export const newId = (day, rand = Math.random) => `e-${day.split("-").join("")}-${Math.floor(rand() * 0x1000000).toString(16).padStart(6, "0")}`;

/** A moment as the record keeps it: the Mac's own time, with how far it is from UTC, as "2026-10-14T09:12:00-05:00". */
export function localStamp(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${off < 0 ? "-" : "+"}${pad(off / 60)}:${pad(off % 60)}`;
}

/** A moment from the record as a person reads it, to the minute: "2026-10-14 09:12". */
export const shown = (at) => String(at || "").slice(0, 16).replace("T", " ");

/** The record of a video the import has just made an episode of, with every field of version 1, from what the import knows:
    the new `id`, this Mac's name as `machine`, the moment `at` (localStamp), the `video` as { file, bytes, seconds, created },
    where `created` is the creation time ffprobe read from the file, or null; the `kind`; the `writer`, { commit, on }; the
    `files` it copied in, each path from the episode's folder to its size; the `title` Claude recommended, or null; and the Reel
    `reels` candidates Claude picked.
    The video was recorded on the day its file says, when it says one, and otherwise on the day of the import. Its name is
    the video's own, without its ending, until a person gives it one. Its rev is 0 until writeEpisode first writes it. */
export function newEpisode({ id, machine, at, video, kind, writer, files = {}, title = null, reels = [] }) {
  const made = video.created ? new Date(video.created) : null;
  const dated = made !== null && Number.isFinite(made.getTime()) && made.getFullYear() >= FIRST_YEAR;
  return {
    version: 1,
    id,
    rev: 0,
    writer,
    kind,
    video: { file: video.file, bytes: video.bytes, seconds: video.seconds, recorded: dated ? localDay(made) : at.slice(0, 10), recordedFrom: dated ? "video" : "import" },
    imported: { on: machine, at },
    name: { text: basename(video.file, extname(video.file)), placeholder: true },
    title,
    editing: null,
    released: null,
    archived: null,
    files,
    spellings: [],
    main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null },
    reels,
    libraries: {},
    finished: null
  };
}

/** What is wrong with a record, in plain words: "" when it is a whole record of version 1. Fields this version does not know
    are not looked at, since they are kept as they are. */
export function episodeFault(r) {
  if (!isObject(r)) return "it is not an episode's record";
  if (r.version !== RECORD_VERSION) return `it is version ${JSON.stringify(r.version)}, and this brimm-video reads version ${RECORD_VERSION}`;
  const v = r.video;
  const m = r.main;
  const faults = [
    [/^e-\d{8}-[0-9a-f]{6}$/.test(r.id), "its id cannot be read"],
    [Number.isInteger(r.rev) && r.rev >= 1, "its rev cannot be read"],
    [isObject(r.writer) && isText(r.writer.commit) && isText(r.writer.on), "who last wrote it cannot be read"],
    [KINDS.includes(r.kind), "it is neither an episode nor a short video"],
    [isObject(v) && isText(v.file) && !v.file.includes("/") && isCount(v.bytes) && isNumber(v.seconds) && v.seconds >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(v.recorded) && ["video", "import"].includes(v.recordedFrom), "its video cannot be read"],
    [isObject(r.imported) && isText(r.imported.on) && isTime(r.imported.at), "where and when it was imported cannot be read"],
    [isObject(r.name) && isText(r.name.text) && typeof r.name.placeholder === "boolean", "its name cannot be read"],
    [r.title === null || (isObject(r.title) && isText(r.title.text) && ["claude", "person"].includes(r.title.from) && typeof r.title.approved === "boolean"), "its title cannot be read"],
    [r.editing === null || (isObject(r.editing) && isText(r.editing.by) && isTime(r.editing.since)), "who is editing it cannot be read"],
    [r.released === null || (isObject(r.released) && isTime(r.released.at) && isFiles(r.released.files)), "what it held when it was last let go cannot be read"],
    [r.archived === undefined || r.archived === null || (isObject(r.archived) && isTime(r.archived.at)), "whether it is archived cannot be read"],
    [isFiles(r.files), "its list of files cannot be read"],
    [Array.isArray(r.spellings) && r.spellings.every((s) => Array.isArray(s) && s.length === 2 && s.every(isText)), "its spellings cannot be read"],
    [isObject(m) && (m.preset === null || isObject(m.preset)) && [m.cuts, m.texts, m.graphics].every(Array.isArray) && typeof m.logo === "boolean" && Array.isArray(m.pushed) && m.pushed.every(isPush) && (m.base === null || isText(m.base)), "its main video cannot be read"],
    [Array.isArray(r.reels) && r.reels.every(isReel), "its Reels cannot be read"],
    [isObject(r.libraries) && Object.values(r.libraries).every(isText), "its libraries cannot be read"],
    [r.finished === null || (isObject(r.finished) && Number.isInteger(r.finished.revision) && r.finished.revision >= 1 && isTime(r.finished.at) && isText(r.finished.on)), "whether it is finished cannot be read"]
  ];
  const found = faults.find(([ok]) => !ok);
  return found ? found[1] : "";
}

/** The text a record file holds: the record, two spaces to a level, and a line end. */
export const recordText = (record) => JSON.stringify(record, null, 2) + "\n";

/** Every name in an episode's folder, at any depth, as a path from the folder. It throws when the folder cannot be read. */
const everything = (folder) => readdirSync(folder, { recursive: true });

/** Of the names in an episode's folder, the conflicted copies, in order. What `resolve` set aside in history/ is left out: it
    is kept there on purpose. */
const conflictedIn = (names) => names.filter((n) => !/^history(\/|$)/.test(n) && CONFLICTED.test(basename(n))).sort();

/** Why an episode cannot be gone on with while Dropbox keeps conflicted copies in it, naming them, and what to say: `resolve`
    sorts it out. With no full stop, since its callers add one. */
const conflictWhy = (copies) => `Dropbox has kept a conflicted copy in this episode: ${copies.join(", ")}. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict"`;

/** The file a conflicted copy is a copy of, as a path from the episode's folder: the copy's path with Dropbox's bracketed words,
    and the space before them, taken out. "record/0008 (Sallie's conflicted copy 2026-10-20).json" is a copy of
    "record/0008.json". */
export function conflictedOf(path) {
  const where = dirname(path);
  const name = basename(path).replace(OWN_WORDS, "");
  return where === "." ? name : `${where}/${name}`;
}

/** Text that may sit inside Dropbox's brackets: anything but a bracket, or a bracketed part of its own, as in a Mac's name
    "MacBook Air (2)". */
const INSIDE = String.raw`(?:[^()]|\([^()]*\))*`;
/** Dropbox's bracketed words alone, with the space before them, so that a file whose own name has brackets keeps them:
    "Leadership (managing conflict) (Sallie's conflicted copy 2026-10-20).mov" is a copy of
    "Leadership (managing conflict).mov". A number Dropbox puts after the words, for a second copy, goes with them. Finding
    copies goes by CONFLICTED, as it always has. */
const OWN_WORDS = new RegExp(String.raw` ?(?:\(${INSIDE}conflicted copy${INSIDE}\)|\((?:Case|Unicode Encoding|Selective Sync) Conflict\))(?: \(\d+\))?`, "i");

/** The conflicted copies Dropbox has kept in an episode's folder, at any depth, as paths from the folder with "/", in order.
    [] when there are none, or when the folder cannot be read. */
export function conflictedCopies(folder) {
  try {
    return conflictedIn(everything(folder));
  } catch (e) {
    return [];
  }
}

/** The numbers of the record files in an episode's folder, highest first: [] when there are none, or no folder record/. */
function recordNumbers(folder) {
  let names;
  try {
    names = readdirSync(join(folder, RECORD_DIR));
  } catch (e) {
    return [];
  }
  return names.map((n) => RECORD_NAME.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => b - a);
}

/** A record file, read: the record when it is whole and its rev is its number, and `newer` when it is of a layout later than
    this brimm-video's, which is read for its id and rev alone. null otherwise. */
function recordIn(folder, n) {
  let record;
  try {
    record = JSON.parse(readFileSync(recordFile(folder, n), "utf8"));
  } catch (e) {
    return null;
  }
  if (!isObject(record) || record.rev !== n) return null;
  if (Number.isInteger(record.version) && record.version > RECORD_VERSION) return /^e-\d{8}-[0-9a-f]{6}$/.test(record.id) ? { record, newer: true } : null;
  return episodeFault(record) ? null : { record };
}

/** Read the episode in `folder`: {record, file}, the record with the highest number that reads whole, and `newer: true` when
    a later brimm-video wrote it; or {why, code} in plain words. It stops on a conflicted copy of any file in the folder, a
    record's or a timeline's alike (code CONFLICTED), since the record may then not say what the folder holds. A folder with
    no whole record is an import that has not finished (code NONE). A record above the one read that is not whole yet, as
    while Dropbox brings it over, is passed over here, and stops a write (writeEpisode). With `pastCopies`, which `resolve`
    alone gives, the conflicted copies are passed over, and the newest whole record is read as if they were not there. */
export function readEpisode(folder, { pastCopies = false } = {}) {
  let names;
  try {
    names = everything(folder);
  } catch (e) {
    return { why: `the folder ${basename(folder)} could not be read (${e.code === "ENOENT" ? "it is not there" : e.message})`, code: "UNREADABLE" };
  }
  const copies = conflictedIn(names);
  if (copies.length && !pastCopies) return { why: conflictWhy(copies), code: "CONFLICTED" };
  for (const n of recordNumbers(folder)) {
    const read = recordIn(folder, n);
    if (read) return { record: read.record, file: recordFile(folder, n), ...(read.newer ? { newer: true } : {}) };
  }
  return { why: "it has no whole record, so its import has not finished, or it is not an episode", code: "NONE" };
}

/** The last rev this Mac wrote of the episode `id`, as written.json on its own disk keeps it: 0 when it wrote none, or the
    file cannot be read. */
export function lastWritten(home, id) {
  try {
    const revs = JSON.parse(readFileSync(writtenFile(home), "utf8"));
    return Number.isInteger(revs[id]) ? revs[id] : 0;
  } catch (e) {
    return 0;
  }
}

/** Note that this Mac wrote `rev` of the episode `id`, in written.json on its own disk: written under another name and then
    renamed, which is safe there. A note that cannot be written costs only the check that Dropbox undid a change. */
function noteWritten(home, id, rev) {
  const file = writtenFile(home);
  let revs = {};
  try {
    revs = JSON.parse(readFileSync(file, "utf8"));
    if (!isObject(revs)) revs = {};
  } catch (e) {
    // There is none yet, or it cannot be read, and it is written again whole.
  }
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.writing`, JSON.stringify({ ...revs, [id]: rev }, null, 2) + "\n");
    renameSync(`${file}.writing`, file);
  } catch (e) {
    rmSync(`${file}.writing`, { force: true });
  }
}

/** Take the record as Dropbox has it now as the one this Mac last wrote, once it has said that Dropbox undid a change: so the
    person can say the change again, and it goes through. */
export const acceptRev = (home, id, rev) => noteWritten(home, id, rev);

/** Why a record read now cannot be gone on with, because Dropbox took away a change this Mac made: the newest record is
    older than the last one this Mac wrote. "" when it is not. Commands that write only the record have no late check of
    their own, and this is what stands for it. */
export function undone(record, home) {
  if (!isObject(record) || !Number.isInteger(record.rev) || record.rev >= lastWritten(home, record.id)) return "";
  const name = isObject(record.name) && isText(record.name.text) ? record.name.text : record.id;
  return `Dropbox undid this Mac's last change to ${name}. Say it again.`;
}

/** Write an episode's next record into `folder`. `expectRev` is the rev it was read at: 0 for the import's first record.
    Nothing is written, and the error has a code, when:
    - the record is of a layout later than this brimm-video's (NEWER);
    - Dropbox keeps a conflicted copy in the folder (CONFLICTED);
    - a record above `expectRev` is in the folder, whole or not: the other Mac wrote meanwhile (CHANGED), in the design's words;
    - the record would not read back (FAULT).
    Otherwise the record is written as record/<expectRev + 1>.json, a new file, with that rev and with `writer`, { commit, on },
    through `writeText(to, text)`, the rule's text writer, which never writes over a file; this Mac notes the rev in
    written.json in `home`; and the record is given back as written. Any field this version does not know is written as it
    was. `pastCopies`, which `resolve` alone gives, writes past the conflicted copies, as it sorts them out one at a time. */
export function writeEpisode(folder, record, { expectRev, writeText, writer, home, pastCopies = false }) {
  if (!Number.isInteger(expectRev) || expectRev < 0) throw new Error("the episode's record was not written, because the rev it was read at was not given");
  if (isObject(record) && Number.isInteger(record.version) && record.version > RECORD_VERSION) throw Object.assign(new Error("Jason has a newer brimm-video. Ask him to update this Mac."), { code: "NEWER" });
  const copies = conflictedCopies(folder);
  if (copies.length && !pastCopies) throw Object.assign(new Error(conflictWhy(copies)), { code: "CONFLICTED" });
  if (recordNumbers(folder).some((n) => n > expectRev)) throw Object.assign(new Error("this episode changed on the other Mac: open it again"), { code: "CHANGED" });
  const next = { ...record, rev: expectRev + 1, writer };
  const fault = episodeFault(next);
  if (fault) throw Object.assign(new Error(`the episode's record was not written, because ${fault}`), { code: "FAULT" });
  mkdirSync(join(folder, RECORD_DIR), { recursive: true });
  writeText(recordFile(folder, next.rev), recordText(next));
  if (home) noteWritten(home, next.id, next.rev);
  return next;
}

/** Other names Dropbox may have kept a file under, beside it: with ".writing" after its name, or with "(1)", or a conflicted
    copy's words, before its ending. Each as a path from the episode's folder. */
function otherNames(folder, path) {
  const where = dirname(path);
  const name = basename(path);
  const ending = extname(name);
  const stem = basename(name, ending);
  let names;
  try {
    names = readdirSync(join(folder, where));
  } catch (e) {
    return [];
  }
  return names
    .filter((n) => n !== name && (n === `${name}.writing` || (n.startsWith(`${stem} (`) && n.endsWith(`)${ending}`))))
    .sort()
    .map((n) => (where === "." ? n : `${where}/${n}`));
}

/** What is wrong with an episode's files against the list in its record, one line for each file, in plain words: missing,
    short, or not the size listed, with any other name Dropbox may have kept it under. [] when every file is there at its
    size. `stat` is how a file is measured: a test gives a stand-in. */
export function filesProblems(folder, record, { stat = statSync } = {}) {
  const problems = [];
  for (const [path, bytes] of Object.entries(record.files)) {
    if (path.split("/")[0] === RECORD_DIR) continue;
    let size = null;
    try {
      size = stat(join(folder, path)).size;
    } catch (e) {
      // A file that cannot be measured is not there for any command that needs it.
    }
    if (size === bytes) continue;
    const others = otherNames(folder, path);
    const kept = others.length ? `, and Dropbox may have kept it as ${others.join(" or ")}` : "";
    if (size === null) problems.push(`${path} is missing${kept}`);
    else if (size < bytes) problems.push(`${path} is short: ${size} bytes of ${bytes}${kept}`);
    else problems.push(`${path} is ${size} bytes, not the ${bytes} the record lists${kept}`);
  }
  return problems;
}

/** Who is editing an episode, when it is a Mac other than `machine`: the record's `editing`. null when nobody is, or this Mac
    is. */
export const heldElsewhere = (record, machine) => (record.editing && record.editing.by !== machine ? record.editing : null);

/** The record with `machine` editing it since `at`. */
export const claimed = (record, machine, at) => ({ ...record, editing: { by: machine, since: at } });

/** The record let go at `at` by the Mac `by`: nobody is editing it, and `files`, the files the episode holds now with their
    sizes, are kept as what it held then, so that the other Mac's `open` can wait until they have all arrived. `answers` are
    what that Mac said of each part it pushed last, by its key ("main", "reel 2"): { v, said }, where `said` is "no changes"
    or "changes stay on <Mac>", which the other Mac's push takes in place of asking (spec section 4). */
export const released = (record, files, { at = localStamp(), by, answers = {} } = {}) => ({ ...record, editing: null, released: { at, by, files, answers } });
