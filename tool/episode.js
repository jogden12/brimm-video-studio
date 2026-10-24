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
import { fileSafe } from "./names.js";
// gate.js takes kindOf from here: each is used only when called, so neither needs the other to have been read first.
import { gated } from "./gate.js";

/** The folder of an episode's records. */
export const RECORD_DIR = "record";
/** The newest layout of the record this brimm-video reads and writes. A record of a higher one is read for what it says, and
    never written: a later brimm-video wrote it.
    Layout 2 (phase 4) adds what the session's commands record: on each Reel its captions, texts, graphics, cuts, logo and
    preset, and the episode's logo picture, `brand`, beside the main video's own, which layout 1 already had.
    Layout 3 (the switch) adds the video that is not yet answered, which has no kind; the kinds finished, raw and session;
    `answer`, `label`, `fingerprint`, `versionOf`, `session` and `reading`; and a version of a timeline that was rendered, not
    handed to Final Cut, which may be version 0.
    A record is written at layout 2 or 3 only once it holds one of them (layoutOf), so an episode that none of them has
    touched is still read by a Mac that knows layout 1 alone, and one that holds them is refused there, never changed by code
    that would drop them. */
export const RECORD_VERSION = 3;
/** The name of a record file: its number, with four digits. */
const RECORD_NAME = /^(\d{4})\.json$/;
/** The record file of one rev, in an episode's folder. */
export const recordFile = (folder, rev) => join(folder, RECORD_DIR, `${String(rev).padStart(4, "0")}.json`);

/** What an episode is. Today's two: an "episode", a whole recording imported before the switch, and a "short video", a short or
    upright recording, which gets no Reels. And the switch's: "finished" (the editor's), "raw" (with retakes) and "session"
    (with a client or a group). A video not yet answered has none, and its kind is null (NO_KIND_STATES). */
const KINDS = ["episode", "short video", "finished", "raw", "session"];
/** While `answer.state` is one of these, a record may have no kind: the video is waiting for its answer, or has been left. */
const NO_KIND_STATES = ["needs your answer", "not for brimm-video"];
/** Where a video stands: waiting for its answer, answered, or left alone by the person ("leave"). */
const ANSWER_STATES = ["needs your answer", "answered", "not for brimm-video"];
/** How a video came: from a camera or a phone, as a Zoom download, or as sound alone. */
const CAMES = ["camera", "phone", "zoom", "sound"];
/** Where a Reel candidate has got to: Claude's pick, kept by a person, dropped by one, or finished. */
const REEL_STATUSES = ["candidate", "picked", "dropped", "finished"];
/** Dropbox's names for the copy it keeps when two Macs changed one file at once: "talk (Jason Ogden's conflicted copy
    2026-10-14).mp4", and "talk (Case Conflict).mp4", "(Unicode Encoding Conflict)" and "(Selective Sync Conflict)" for its
    other kinds. `copy` is the words of the first kind; `by` is what joins the Mac's name to them, "'s" with a straight
    apostrophe or a curly one; `kinds` are the bracketed words of the others. Only these are taken: a name such as
    "Leadership (managing conflict).mov" is a video's own. Finding the copies (CONFLICTED), naming the file each is a copy
    of (OWN_WORDS) and naming the Mac it came from (BY_WORDS) are all built from this list, and none of them spells a word
    of Dropbox's itself, so what the guide's conflict step learns of what Dropbox's File Provider calls them goes here,
    once. CONFLICTED is wider than the other two, on purpose: it finds a copy whose Mac's name has a bracket left open or
    brackets two deep, which they cannot take apart. It may grow wider, and never narrower, since a copy it does not find
    is passed over without a word. */
export const CONFLICT_FORMS = { copy: "conflicted copy", by: ["'s", "’s"], kinds: ["Case Conflict", "Unicode Encoding Conflict", "Selective Sync Conflict"] };
/** Text as a regular expression takes it, letter for letter. */
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Dropbox's bracketed words for its other kinds of copy, as a regular expression: "(Case Conflict)" and the rest. */
const KIND_WORDS = String.raw`\((?:${CONFLICT_FORMS.kinds.map(literally).join("|")})\)`;
/** A conflicted copy's name: Dropbox's bracketed words anywhere in it. */
const CONFLICTED = new RegExp(String.raw`\(.*${literally(CONFLICT_FORMS.copy)}.*\)|${KIND_WORDS}`, "i");
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
/** A version of a timeline: its number, when, on which Mac, and the file kept in edit/. Handed to Final Cut, it is a push, from
    number 1, and has no `how` or the word "push" (every version before the switch is one). Rendered by brimm-video, it has
    `how: "render"`, and may be number 0, the rough cut. */
const isPush = (p) => isObject(p) && Number.isInteger(p.v) && (p.how === "render" ? p.v >= 0 : (p.how === undefined || p.how === "push") && p.v >= 1) && isTime(p.at) && isText(p.on) && isText(p.file);
/** A moment of the raw video, in seconds from its start, and a length after it. */
const isAt = (v) => isNumber(v) && v >= 0;
const isLength = (v) => isNumber(v) && v > 0;
/** A picture in the episode's media/ folder, by its path from the episode's folder. */
const isPicture = (v) => isText(v) && /^media\/(?!\.\.?$)[^/]+$/.test(v);
/** The layers a person asks for on a timeline (phase 4): a name title (a name over a role), a graphic at a place, a stretch
    kept or taken out, each with an id of its own; whether its captions and the logo show; and its preset. */
const isTextLayer = (t) => isObject(t) && /^t\d+$/.test(t.id) && t.kind === "lower-third" && isAt(t.at) && isLength(t.for) && Array.isArray(t.lines) && t.lines.length >= 1 && t.lines.length <= 2 && t.lines.every(isText);
const isGraphic = (g) => isObject(g) && /^g\d+$/.test(g.id) && isPicture(g.picture) && isAt(g.at) && isLength(g.for) && ["full", "corner", "lower"].includes(g.place);
const isCut = (c) => isObject(c) && /^c\d+$/.test(c.id) && typeof c.keep === "boolean" && isAt(c.from) && isNumber(c.to) && c.from < c.to;
const isPreset = (p) => p === null || p === undefined || (isObject(p) && isText(p.job) && isText(p.captions) && isText(p.look));
const listOf = (v, each) => v === undefined || (Array.isArray(v) && v.every(each));
const isLayered = (x) => listOf(x.texts, isTextLayer) && listOf(x.graphics, isGraphic) && listOf(x.cuts, isCut) && [x.logo, x.captions].every((b) => b === undefined || typeof b === "boolean") && isPreset(x.preset);
/** A Reel: its number from 1, where it has got to, its stretch in seconds of the raw video, its pushes, when it has any, and
    the layers a person asked for on it (phase 4). */
const isReel = (c) => isObject(c) && Number.isInteger(c.n) && c.n >= 1 && REEL_STATUSES.includes(c.status) && isNumber(c.from) && isNumber(c.to) && c.from < c.to && typeof c.title === "string" && (c.pushed === undefined || (Array.isArray(c.pushed) && c.pushed.every(isPush))) && isLayered(c);

/** An episode's id, as newId makes it. */
const isId = (v) => typeof v === "string" && /^e-\d{8}-[0-9a-f]{6}$/.test(v);
/** What the person said to the card about a video (layout 3): where it stands, what the import guessed, what it saw, how the
    video came, the episode whose words the import found in it (`match`, an id, or null when none), and once answered, who
    answered, on which Mac, when, and whether it is a private session. How it came is null when the import could not read the
    file's facts, and what was seen is then "". The match is only what her card offers first: the record is a new version of
    that episode (`versionOf`) once she says so, never by the import. */
const isAnswer = (a) => isObject(a) && ANSWER_STATES.includes(a.state) && (a.guess === null || isText(a.guess)) && typeof a.seen === "string" && (a.came === null || CAMES.includes(a.came))
  && (a.match === undefined || a.match === null || isId(a.match))
  && (a.by === undefined || isText(a.by)) && (a.on === undefined || isText(a.on)) && (a.at === undefined || isTime(a.at)) && (a.private === undefined || ["yes", "no"].includes(a.private));
/** The keys of each list of a session's items that she may change by her command, by the list: sessions.js EDITS, which a test
    holds this to (episode.js reads no module of a session's). */
export const SESSION_EDITS = { principles: ["name", "category", "description", "example_application"], recurringPrinciples: ["text"], reelIdeas: ["idea", "words", "why"] };
/** An item's number, as a key of an object: a whole number from 1, as she says it. */
const isItemKey = (k) => /^[1-9]\d*$/.test(k);
/** For each list of a session's items, something kept by the item's number: each list's object of numbers, each number's
    `each`. */
const byItem = (v, each) => isObject(v) && Object.entries(v).every(([list, items]) => Object.hasOwn(SESSION_EDITS, list) && isObject(items) && Object.entries(items).every(([n, x]) => isItemKey(n) && each(x, list)));
/** Her decision of an item, and her change of one: the keys she may change, each to words. */
const isDecision = (d) => d === "kept" || d === "dropped";
const isEdit = (e, list) => isObject(e) && Object.entries(e).every(([key, text]) => SESSION_EDITS[list].includes(key) && isText(text));
/** The mark of a client or group session (layout 3): when and where it was marked, whether its teachings were asked for, and
    when it was cleared, if it was: confirmed by her click on a dialog. Once her teachings are asked for, when (`asked`); and
    what she decided of each item Claude read (`decided`, "kept" or "dropped", by list and number) and what she changed of one
    (`edits`), which only her command writes (spec 2026-10-22, section 8). A video read as another kind and answered again as a
    session owes the BRIMM Ops page an empty session revision (`emptyRevision`): "owed" until it is written, then the revision it
    was written as (edit.js, `kind … session --again`). */
const isSession = (x) => isObject(x) && isTime(x.marked) && isText(x.on) && (x.teachings === null || ["asked", "transcript only"].includes(x.teachings))
  && (x.cleared === null || (isObject(x.cleared) && isTime(x.cleared.at) && isText(x.cleared.on) && isText(x.cleared.to) && x.cleared.confirmed === "dialog"))
  && (x.asked === undefined || isTime(x.asked)) && (x.decided === undefined || byItem(x.decided, isDecision)) && (x.edits === undefined || byItem(x.edits, isEdit))
  && (x.emptyRevision === undefined || x.emptyRevision === "owed" || (Number.isInteger(x.emptyRevision) && x.emptyRevision >= 1));
/** What the one Claude call did (layout 3): which kind it read as, with which model, when, where, as which account, and how it
    ended; and for a session's reading, the teachings file it wrote (`principles`), `<name>.principles.json` in the episode's
    own folder. */
const isTeachingsFile = (v) => typeof v === "string" && v.length > ".principles.json".length && v.endsWith(".principles.json") && !/[/\\]/.test(v) && !v.startsWith(".");
const isReading = (x) => isObject(x) && isText(x.kind) && isText(x.model) && isTime(x.at) && isText(x.on) && typeof x.account === "string" && isText(x.outcome)
  && (x.principles === undefined || isTeachingsFile(x.principles));
/** A field of layout 3 that may be missing or null, and is checked when it is there. */
const optional = (v, ok) => v === undefined || v === null || ok(v);

/** The kind of a record as a person means it: "raw", "finished", "session" or "short video", or null while the video waits for
    its answer. An "episode" is a raw recording imported before the switch. */
export function kindOf(r) {
  const kind = isObject(r) ? r.kind : null;
  if (kind === "episode") return "raw";
  return KINDS.includes(kind) ? kind : null;
}

/** How a record is named in all that edit.js prints, which goes into Sallie's chat (spec 2026-10-22, section 1, "Unanswered and
    session videos are named by a neutral label"): a video not yet answered, or left alone, by its label, as the import made it
    and the record keeps it (it is never made again from when the record says it was imported: the label's moment is its
    own), or by its short id when it has none; every other record by its name, as today. It fails closed for every record the
    gate holds (gate.js gated): a session is named by its name, which is its label (F3 sets it in the same write as the mark,
    and F7 checks any rename), but never by a name that is still its file's; and a record of another kind whose session mark is
    not cleared is named by its label, and either of them, with no label, as "a client or group session (<short id>)". A
    record that has no name to give, as a conflicted copy that is not whole may be, is named by its short id. */
export function shownName(r) {
  const short = isObject(r) && typeof r.id === "string" ? r.id.slice(-6) : "";
  const label = isObject(r) && isText(r.label) ? r.label : "";
  if (kindOf(r) === null) return label || `a video not yet answered (${short})`;
  const name = isObject(r.name) && isText(r.name.text) ? r.name.text : "";
  if (!gated(r)) return name || `an episode (${short})`;
  if (r.kind === "session" && name && !filesName(r)) return name;
  return label || `a client or group session (${short})`;
}

/** Whether a record's name is still its video file's: a placeholder, or the file's name, with or without its ending and in the
    file-safe form, whatever its case. */
function filesName(r) {
  if (r.name.placeholder === true) return true;
  const file = isObject(r.video) && isText(r.video.file) ? r.video.file : "";
  const stem = basename(file, extname(file));
  const same = (a, b) => a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase();
  return Boolean(file) && [file, stem, fileSafe(stem)].some((n) => same(n, r.name.text));
}

/** The layout a record is written at: 3 once it holds anything of the switch (a kind other than "episode" or "short video",
    and having none is one; an answer, a session mark, a reading, or the episode it is a version of; or a version with a `how`,
    one that was rendered); otherwise 2 once it holds a layer of phase 4 (a spelling, a text, a graphic, a cut, the logo, a
    preset, a Reel's captions turned off, or the logo's picture); and 1 while it holds none. */
export function layoutOf(r) {
  const layered = (x) => Boolean(x) && (["texts", "graphics", "cuts"].some((k) => Array.isArray(x[k]) && x[k].length > 0) || x.logo === true || Boolean(x.preset) || x.captions === false);
  const withHow = (x) => Boolean(x) && Array.isArray(x.pushed) && x.pushed.some((p) => isObject(p) && p.how !== undefined);
  if (!["episode", "short video"].includes(r.kind) || Boolean(r.answer) || Boolean(r.session) || Boolean(r.reading) || Boolean(r.versionOf) || withHow(r.main) || (r.reels || []).some(withHow)) return 3;
  return (r.spellings || []).length > 0 || layered(r.main) || (r.reels || []).some(layered) || Boolean(r.brand && r.brand.logo) ? 2 : 1;
}

/** Whether she has answered the card about a video (layout 3): its `answer` says "answered". A video from before the switch has no
    answer. This is what the switch's reading of times and its list of Reel suggestions turn on, and not layoutOf, which turns
    3 for an old video that only holds a version with a `how` (a render, or a push so marked). */
export const isAnswered = (r) => isObject(r) && isObject(r.answer) && r.answer.state === "answered";

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

/** The record of a video the import has just made an episode of, with every field of layout 1 and those of layout 3 it is
    given (below), from what the import knows: the new `id`, this Mac's name as `machine`, the moment `at` (localStamp), the
    `video` as { file, bytes, seconds, created }, where `created` is the creation time ffprobe read from the file, or null;
    the `kind`, which is null for a video not yet answered; the `writer`, { commit, on }; the `files` it copied in, each path
    from the episode's folder to its size; the `title` Claude recommended, or null; and the Reel `reels` candidates Claude
    picked.
    The fields of layout 3 are in the record only when they are given: the `answer` (the card's question, with the guess, what
    the import saw, and the episode whose words it matched), the `label` that names the video until it is answered, the
    `fingerprint` of its words, and `versionOf`, the id of the episode it is a new version of, which the import never gives:
    her answer sets it. A record made without them is a record of layout 1.
    The video was recorded on the day its file says, when it says one, and otherwise on the day of the import. Its name is
    the video's own, without its ending, until a person gives it one. Its rev is 0 until writeEpisode first writes it. */
export function newEpisode({ id, machine, at, video, kind, writer, files = {}, title = null, reels = [], answer = null, label = "", fingerprint = "", versionOf = null }) {
  const made = video.created ? new Date(video.created) : null;
  const dated = made !== null && Number.isFinite(made.getTime()) && made.getFullYear() >= FIRST_YEAR;
  const record = {
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
    finished: null,
    ...(answer ? { answer } : {}),
    ...(label ? { label } : {}),
    ...(fingerprint ? { fingerprint } : {}),
    ...(versionOf ? { versionOf } : {})
  };
  return { ...record, version: layoutOf(record) };
}

/** What is wrong with a record, in plain words, by a brimm-video that reads the layouts up to `known`: "" when it is a whole
    record. Fields it does not know are not looked at, since they are kept as they are. Of the fields of layout 3, which are
    all optional, each is checked only when it is there. `episodeFault` is this for the layout this brimm-video reads; another
    `known` stands in for a Mac on older code, in a test. */
export const faultFor = (known) => (r) => {
  if (!isObject(r)) return "it is not an episode's record";
  if (!Number.isInteger(r.version) || r.version < 1 || r.version > known) return `it is version ${JSON.stringify(r.version)}, and this brimm-video reads versions 1 to ${known}`;
  const v = r.video;
  const m = r.main;
  const faults = [
    [/^e-\d{8}-[0-9a-f]{6}$/.test(r.id), "its id cannot be read"],
    [Number.isInteger(r.rev) && r.rev >= 1, "its rev cannot be read"],
    [isObject(r.writer) && isText(r.writer.commit) && isText(r.writer.on), "who last wrote it cannot be read"],
    [KINDS.includes(r.kind) || (r.kind === null && isObject(r.answer) && NO_KIND_STATES.includes(r.answer.state)), "its kind cannot be read"],
    [isObject(v) && isText(v.file) && !v.file.includes("/") && isCount(v.bytes) && isNumber(v.seconds) && v.seconds >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(v.recorded) && ["video", "import"].includes(v.recordedFrom), "its video cannot be read"],
    [isObject(r.imported) && isText(r.imported.on) && isTime(r.imported.at), "where and when it was imported cannot be read"],
    [isObject(r.name) && isText(r.name.text) && typeof r.name.placeholder === "boolean", "its name cannot be read"],
    [r.title === null || (isObject(r.title) && isText(r.title.text) && ["claude", "person"].includes(r.title.from) && typeof r.title.approved === "boolean"), "its title cannot be read"],
    [r.editing === null || (isObject(r.editing) && isText(r.editing.by) && isTime(r.editing.since)), "who is editing it cannot be read"],
    [r.released === null || (isObject(r.released) && isTime(r.released.at) && isFiles(r.released.files)), "what it held when it was last let go cannot be read"],
    [r.archived === undefined || r.archived === null || (isObject(r.archived) && isTime(r.archived.at)), "whether it is archived cannot be read"],
    [isFiles(r.files), "its list of files cannot be read"],
    [Array.isArray(r.spellings) && r.spellings.every((s) => Array.isArray(s) && s.length === 2 && s.every(isText)), "its spellings cannot be read"],
    [isObject(m) && [m.cuts, m.texts, m.graphics].every(Array.isArray) && typeof m.logo === "boolean" && isLayered(m) && Array.isArray(m.pushed) && m.pushed.every(isPush) && (m.base === null || isText(m.base)), "its main video cannot be read"],
    [r.brand === undefined || r.brand === null || (isObject(r.brand) && (r.brand.logo === undefined || isPicture(r.brand.logo))), "its logo cannot be read"],
    [Array.isArray(r.reels) && r.reels.every(isReel), "its Reels cannot be read"],
    [isObject(r.libraries) && Object.values(r.libraries).every(isText), "its libraries cannot be read"],
    [r.finished === null || (isObject(r.finished) && Number.isInteger(r.finished.revision) && r.finished.revision >= 1 && isTime(r.finished.at) && isText(r.finished.on)), "whether it is finished cannot be read"],
    [optional(r.answer, isAnswer), "its answer cannot be read"],
    [r.label === undefined || typeof r.label === "string", "its label cannot be read"],
    [r.fingerprint === undefined || typeof r.fingerprint === "string", "its fingerprint cannot be read"],
    [optional(r.versionOf, isText), "which episode it is a version of cannot be read"],
    [optional(r.session, isSession), "its session mark cannot be read"],
    [optional(r.reading, isReading), "its reading by Claude cannot be read"]
  ];
  const found = faults.find(([ok]) => !ok);
  return found ? found[1] : "";
};
/** What is wrong with a record, in plain words: "" when it is a whole record of a layout this brimm-video reads. */
export const episodeFault = faultFor(RECORD_VERSION);

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
    copies goes by CONFLICTED; both are built from CONFLICT_FORMS. */
const OWN_WORDS = new RegExp(String.raw` ?(?:\(${INSIDE}${literally(CONFLICT_FORMS.copy)}${INSIDE}\)|${KIND_WORDS})(?: \(\d+\))?`, "i");
/** The Mac's name in Dropbox's bracketed words, before "'s conflicted copy", or "’s conflicted copy" with a curly
    apostrophe: "Sallie's MacBook Air (2)" in "main (Sallie's MacBook Air (2)'s conflicted copy 2026-10-20).fcpxml". */
const BY_WORDS = new RegExp(String.raw`\((${INSIDE})(?:${CONFLICT_FORMS.by.map(literally).join("|")}) ${literally(CONFLICT_FORMS.copy)}`, "i");

/** The Mac a conflicted copy came from, by Dropbox's words in its name, or "" when they name none, as a "(Case Conflict)"
    does. */
export function conflictedBy(path) {
  const m = BY_WORDS.exec(basename(path));
  return m ? m[1] : "";
}

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
export function recordNumbers(folder) {
  let names;
  try {
    names = readdirSync(join(folder, RECORD_DIR));
  } catch (e) {
    return [];
  }
  return names.map((n) => RECORD_NAME.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => b - a);
}

/** A record file, read by a brimm-video that knows the layouts up to `known`: the record when it is whole and its rev is its
    number, and `newer` when it is of a layout later than that, which is read for its id and rev alone. null otherwise. A
    record of a later layout is the record, and is not passed over for an older one, as one that is not whole is: the older
    one shows the episode as it stood before the other Mac changed it. */
function recordIn(folder, n, known) {
  let record;
  try {
    record = JSON.parse(readFileSync(recordFile(folder, n), "utf8"));
  } catch (e) {
    return null;
  }
  if (!isObject(record) || record.rev !== n) return null;
  if (Number.isInteger(record.version) && record.version > known) return /^e-\d{8}-[0-9a-f]{6}$/.test(record.id) ? { record, newer: true } : null;
  return faultFor(known)(record) ? null : { record };
}

/** Read the episode in `folder`: {record, file}, the record with the highest number that reads whole, and `newer: true` when
    a later brimm-video wrote it; or {why, code} in plain words. It stops on a conflicted copy of any file in the folder, a
    record's or a timeline's alike (code CONFLICTED), since the record may then not say what the folder holds. A folder with
    no whole record is an import that has not finished (code NONE). A record above the one read that is not whole yet, as
    while Dropbox brings it over, is passed over here, and stops a write (writeEpisode). With `pastCopies`, which `resolve`
    alone gives, the conflicted copies are passed over, and the newest whole record is read as if they were not there. `known`
    is the newest layout this brimm-video reads: a test gives an older one, to stand in for a Mac on older code. */
export function readEpisode(folder, { pastCopies = false, known = RECORD_VERSION } = {}) {
  let names;
  try {
    names = everything(folder);
  } catch (e) {
    return { why: `the folder ${basename(folder)} could not be read (${e.code === "ENOENT" ? "it is not there" : e.message})`, code: "UNREADABLE" };
  }
  const copies = conflictedIn(names);
  if (copies.length && !pastCopies) return { why: conflictWhy(copies), code: "CONFLICTED" };
  for (const n of recordNumbers(folder)) {
    const read = recordIn(folder, n, known);
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
  // A video not yet answered is named by its label: its name is still the file's (shownName).
  const name = kindOf(record) === null ? shownName(record) : isObject(record.name) && isText(record.name.text) ? record.name.text : record.id;
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
  // A record once written at layout 2 or 3 stays there: a Mac that knows only 1 would push its Reels without what layout 2
  // draws, and one that knows only 2 would go on with an episode whose answer or kind it cannot see.
  const next = { ...record, version: Math.max(Number.isInteger(record.version) ? record.version : 1, layoutOf(record)), rev: expectRev + 1, writer };
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

/** Why a command that writes the record, pushes or puts files into the episode must not change it now, because another Mac
    has it open (spec section 1, "Picking an episode up"), in plain words: "" when nobody does, or `machine` does. The episode is
    named as everything edit.js prints names it (shownName). */
export const heldText = (record, machine) => {
  const held = heldElsewhere(record, machine);
  return held ? `${held.by} has ${shownName(record)} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.` : "";
};

/** The record with `machine` editing it since `at`. */
export const claimed = (record, machine, at) => ({ ...record, editing: { by: machine, since: at } });

/** The record let go at `at` by the Mac `by`: nobody is editing it, and `files`, the files the episode holds now with their
    sizes, are kept as what it held then, so that the other Mac's `open` can wait until they have all arrived. `answers` are
    what that Mac said of each part it pushed last, by its key ("main", "reel 2"): { v, said }, where `said` is "no changes"
    or "changes stay on <Mac>", which the other Mac's push takes in place of asking (spec section 4). */
export const released = (record, files, { at = localStamp(), by, answers = {} } = {}) => ({ ...record, editing: null, released: { at, by, files, answers } });
