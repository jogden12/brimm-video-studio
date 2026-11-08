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
import { filePlace } from "./where.js";
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
    Layout 4 (Studio) adds `app`: the HyperFrames projects made of the episode, with the toolchain's version (architecture
    2026-10-27, 7.1). It holds numbers, names, states and times, never a session's words.
    Layout 5 (the HyperFrames-led path, PR H4) adds the planned episode: a record made in her chat from words she gave, before
    any footage exists, with no video and no kind, and `planned`: its route, title, voice, cues, shots and teleprompter lines.
    A record is written at layout 2, 3, 4, 5 or 6 only once it holds one of them (layoutOf), so an episode that none of them has
    touched is still read by a Mac that knows layout 1 alone, and one that holds them is refused there, never changed by code
    that would drop them. Layout 5 is written for a planned record, and for a part (PR H5a: a dropped video answered as footage for a
    planned video, which holds `partOf`) alone, while it holds no `local`: every other record without `local` stays at layout 4 or
    below, which is RECORD_VERSION, the newest layout of every other such record and the one a Mac on older code reads. So a Mac on
    older code reads a planned record as newer (it has no video, which that Mac would read as an import that has not finished), and
    a part as newer too, and leaves both alone.
    Layout 6 (Phase 3, the local working folder; L2) adds `local`: the episode's own files are kept on one Mac, `local.on`, in its work
    folder's video/, and it is changed only there (where.js says where each file is). It is written for a record that holds `local` alone,
    whatever else it holds, so a Mac on older code reads every such record as newer and leaves it alone; every other record stays at the
    layout it had. */
export const RECORD_VERSION = 4;
/** The layout of a planned episode's record, and a part's, while it holds no `local` (a plan or a part kept on one Mac is at layout 6,
    LOCAL_VERSION): a record of a higher layout is read for what it says and never written by a Mac that knows layout 5 alone. */
export const PLANNED_VERSION = 5;
/** The layout of a record that holds `local` (D2), and the newest layout this BRIMM Video Studio reads and writes (NEWEST_VERSION): a record of
    a higher layout is read for what it says and never written. */
export const LOCAL_VERSION = 6;
export const NEWEST_VERSION = LOCAL_VERSION;
/** The name of a record file: its number, with four digits. */
const RECORD_NAME = /^(\d{4})\.json$/;
/** The record file of one rev, in an episode's folder. */
export const recordFile = (folder, rev) => join(folder, RECORD_DIR, `${String(rev).padStart(4, "0")}.json`);

/** What an episode is. Today's two: an "episode", a whole recording imported before the switch, and a "short video", a short or
    upright recording, which gets no Reels. And the switch's: "finished" (the editor's), "raw" (with retakes) and "session"
    (with a client or a group). A video not yet answered has none, and its kind is null (NO_KIND_STATES). */
const KINDS = ["episode", "short video", "finished", "raw", "session"];
/** While `answer.state` is one of these, a record may have no kind: the video is waiting for its answer, has been left, or is a part
    (PR H5a): footage for a planned video, which no card can make anything else of until she takes it back. */
const NO_KIND_STATES = ["needs your answer", "not for brimm-video", "part"];
/** Where a video stands: waiting for its answer, answered, left alone by the person ("leave"), or answered as footage for a planned
    video ("part"; `footage` writes it, with `partOf`, and `footage … none` takes it back). */
const ANSWER_STATES = ["needs your answer", "answered", "not for brimm-video", "part"];
/** The answer of a part. */
const PART_STATE = "part";
/** The kinds of part: the kinds of shot in a shot list (SHOT_LIST_KINDS), footage she films talking to the camera, a screen recording of work
    on the computer, and b-roll; and (PR H6) the voiceover, a recording of sound alone that is the voice of an explainer, which is not a shot
    of any list. */
export const PART_KINDS = Object.freeze(["talking", "screen", "b-roll", "voiceover"]);
/** Where a planned episode stands: planned, with no video to answer. It is no state of the card (ANSWER_STATES). */
const PLANNED_STATE = "planned";
/** The routes of a planned episode: a video she films from a script, and a video of graphics and words alone (an explainer). The
    voice of an explainer is hers or a HeyGen voice; a script has none. */
const PLANNED_ROUTES = ["script", "explainer"];
const PLANNED_VOICES = ["sallie", "heygen"];
/** The kinds of shot in a shot list: talking to the camera, a screen recording of work on the computer, and b-roll of her working
    or in a coaching session (design 5, step 2). */
export const SHOT_LIST_KINDS = Object.freeze(["talking", "screen", "b-roll"]);
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
    that episode (`versionOf`) once she says so, never by the import. A planned episode's answer is none of the card's
    (isPlannedAnswer). */
const isCardAnswer = (a) => ANSWER_STATES.includes(a.state) && (a.guess === null || isText(a.guess)) && typeof a.seen === "string" && (a.came === null || CAMES.includes(a.came))
  && (a.match === undefined || a.match === null || isId(a.match))
  && (a.by === undefined || isText(a.by)) && (a.on === undefined || isText(a.on)) && (a.at === undefined || isTime(a.at)) && (a.private === undefined || ["yes", "no"].includes(a.private));
/** The answer of a planned episode (layout 5): it says "planned", who made it (`plan new`), on which Mac and when, and that it is not a
    private session. It has no guess, no sight of a video, no way it came and no match: nothing was imported. It is the whole of it, so
    that a record is taken for a planned one on exactly this answer. */
const isPlannedAnswer = (a) => isObject(a) && a.state === PLANNED_STATE && isText(a.by) && isText(a.on) && isTime(a.at) && a.private === "no"
  && ["guess", "seen", "came", "match"].every((key) => a[key] === undefined);
/** The answer of a part (PR H5a): the card's own facts (what the import saw, how it came, its guess and match) as they were, and the
    state "part", with who answered (`footage`), on which Mac, when, and that it is no private session, as `kind` writes them. */
const isPartAnswer = (a) => isCardAnswer(a) && a.state === PART_STATE && isText(a.by) && isText(a.on) && isTime(a.at) && a.private === "no";
const isAnswer = (a) => isObject(a) && (a.state === PLANNED_STATE ? isPlannedAnswer(a) : a.state === PART_STATE ? isPartAnswer(a) : isCardAnswer(a));

/** What a part is footage for (PR H5a): `{ id, as, shot, client }`, and nothing else. `id` is the planned episode's; `as` the kind of part
    (PART_KINDS); `shot` the number of the shot in the plan's shot list that a screen recording or b-roll shows, a whole number from 1,
    and null for a talking part, which has none (Studio puts the talking parts in order by their words); `client` whether it shows a
    client, a client's name or their work, which a talking part never does (it is her talking to the camera). A voiceover (PR H6) is sound
    alone: it has no shot, and no client to ask about, so its `client` is null (not false: nothing was asked). */
const isPartOf = (p) => isObject(p) && Object.keys(p).length === 4 && isId(p.id) && PART_KINDS.includes(p.as)
  && (p.as === "voiceover" ? p.shot === null && p.client === null
    : typeof p.client === "boolean" && (p.as === "talking" ? p.shot === null && p.client === false : Number.isInteger(p.shot) && p.shot >= 1));
/** Whether a record is a part: no kind, the answer "part" and a whole `partOf`. A part is gated like any video with no kind (gate.js
    gated), and named by its label. The record read whole (faultFor) holds more: layout 5 and a video. */
export const isPart = (r) => isObject(r) && r.kind === null && isObject(r.answer) && r.answer.state === PART_STATE && isPartOf(r.partOf);
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
/** A day as the calendar has it, written 2026-10-23: not 2026-02-30. */
export const isDay = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const at = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().startsWith(v);
};
/** A client's agreement to a Reel cut from a session, as `reel … --client-agreed` records it: the Reel idea's number, a whole
    number from 1, and the day it was noted. Nothing else: who agreed stays on the Mac that noted it. */
const isAgreement = (a) => isObject(a) && Object.keys(a).every((k) => k === "n" || k === "at") && Number.isInteger(a.n) && a.n >= 1 && isDay(a.at);
/** The mark of a client or group session (layout 3): when and where it was marked, whether its teachings were asked for, and
    when it was cleared, if it was: confirmed by her click on a dialog. Once her teachings are asked for, when (`asked`); and
    what she decided of each item Claude read (`decided`, "kept" or "dropped", by list and number) and what she changed of one
    (`edits`), which only her command writes (spec 2026-10-22, section 8); and the Reel ideas a client's agreement to cutting a
    Reel from the session was noted for, by number and day (`agreed`). A video read as another kind and answered again as a
    session owes the BRIMM Ops page an empty session revision (`emptyRevision`): "owed" until it is written, then the revision it
    was written as (edit.js, `kind … session --again`). */
const isSession = (x) => isObject(x) && isTime(x.marked) && isText(x.on) && (x.teachings === null || ["asked", "transcript only"].includes(x.teachings))
  && (x.cleared === null || (isObject(x.cleared) && isTime(x.cleared.at) && isText(x.cleared.on) && isText(x.cleared.to) && x.cleared.confirmed === "dialog"))
  && (x.asked === undefined || isTime(x.asked)) && (x.decided === undefined || byItem(x.decided, isDecision)) && (x.edits === undefined || byItem(x.edits, isEdit))
  && listOf(x.agreed, isAgreement)
  && (x.emptyRevision === undefined || x.emptyRevision === "owed" || (Number.isInteger(x.emptyRevision) && x.emptyRevision >= 1));
/** What the one Claude call did (layout 3): which kind it read as, with which model, when, where, as which account, and how it
    ended; for a session's reading, the teachings file it wrote (`principles`), `<name>.principles.json` in the episode's own
    folder; and for an iPhone clip's, the one line on what the clip is (`about`) and the graphic cues it read (`graphicCues`, PR H2),
    a list of cues as graphic-cues.js has them, which the clip's main project is given (graphicCuesOfRecord reads them again). */
const isTeachingsFile = (v) => typeof v === "string" && v.length > ".principles.json".length && v.endsWith(".principles.json") && !/[/\\]/.test(v) && !v.startsWith(".");
const isReading = (x) => isObject(x) && isText(x.kind) && isText(x.model) && isTime(x.at) && isText(x.on) && typeof x.account === "string" && isText(x.outcome)
  && (x.principles === undefined || isTeachingsFile(x.principles))
  && (x.graphicCues === undefined || (Array.isArray(x.graphicCues) && x.graphicCues.every(isObject)));
/** A field of layout 3 that may be missing or null, and is checked when it is there. */
const optional = (v, ok) => v === undefined || v === null || ok(v);

/** The states of a HyperFrames project (layout 4, architecture 7.1). */
const APP_STATES = ["made", "opened", "exported", "finished", "kept for an earlier kind"];
/** A working copy's frame rate: a number, as workcopy.js's facts give it, or a fraction as ffprobe writes one, "30/1". */
const isRate = (v) => (isNumber(v) && v > 0) || (typeof v === "string" && /^[1-9]\d*\/[1-9]\d*$/.test(v));
/** One HyperFrames project of an episode (layout 4): its key ("main", "reel N" or "clip N"), its name, when and on which Mac it
    was made, what its working copy was made from (the raw file's name, size and time) and what that copy is, when it was opened,
    whether her chat was handed over, the Reel suggestion it came from, and its state. */
const isAppProject = (p) => isObject(p) && /^(?:main|reel [1-9]\d*|clip [1-9]\d*)$/.test(p.key) && isText(p.name) && isTime(p.madeAt) && isText(p.on)
  && isObject(p.from) && isText(p.from.file) && !/[/\\]/.test(p.from.file) && isCount(p.from.bytes) && isTime(p.from.modified)
  && isObject(p.workingCopy) && isCount(p.workingCopy.bytes) && isNumber(p.workingCopy.seconds) && p.workingCopy.seconds > 0 && isRate(p.workingCopy.fps)
  && Array.isArray(p.opened) && p.opened.every(isTime) && typeof p.handover === "boolean"
  && (p.fromSuggestion === null || (Number.isInteger(p.fromSuggestion) && p.fromSuggestion >= 1)) && APP_STATES.includes(p.state);
/** The HyperFrames projects of an episode (layout 4): the pinned toolchain's version, and each project. */
const isApp = (x) => isObject(x) && isText(x.toolchain) && Array.isArray(x.projects) && x.projects.every(isAppProject);

/** A shot of a planned episode's shot list (layout 5): its number from 1, its kind (SHOT_LIST_KINDS) and what it is. */
const isPlannedShot = (s) => isObject(s) && Number.isInteger(s.n) && s.n >= 1 && SHOT_LIST_KINDS.includes(s.kind) && isText(s.what);
/** One client's agreement to a part being shown in a project (PR H5a), as `plan … agreed` records it: the part by its episode's id, never
    by its file (whose name may be a client's, and a plan's record is not gated), its label, and the day her click noted the agreement
    (isDay). Nothing else: who agreed, and what she typed, stay on the Mac that noted them (agreements.txt). */
const isConsent = (c) => isObject(c) && Object.keys(c).length === 3 && isId(c.id) && isText(c.label) && isDay(c.at);
/** The HyperFrames project of a HeyGen explainer before its voice is taken in (PR H6), as the plan keeps it: `{ name, madeAt, on, opened }`, and nothing
    else. `name` is the project's folder in the plan's work folder on the Mac `on` that made it, at the moment `madeAt`, and `opened` the moments it was
    opened in the app since, which `app` adds to. The name is one folder's name: a name that leads anywhere else is none. */
const isPlannedProject = (p) => isObject(p) && Object.keys(p).length === 4 && isText(p.name) && p.name !== "." && p.name !== ".." && !/[/\\\0]/.test(p.name)
  && isTime(p.madeAt) && isText(p.on) && Array.isArray(p.opened) && p.opened.every(isTime);

/** A planned episode's `planned` (layout 5), read whole: its route and title; its voice, which an explainer may have and a script
    never does; when and on which Mac it was planned and when its package was last set (`set`, or null before the first); the
    cues, which graphic-cues.js reads and so are only looked at as objects here; the shots; the teleprompter's lines; `filmed`
    (PR H5): null while there is no footage; `consent` (PR H5a), once a client's agreement is noted for any part: a list of
    { id, label, at } (isConsent); and `project` (PR H6), once a HeyGen explainer's project is made: { name, madeAt, on, opened }
    (isPlannedProject), which only an explainer read by a HeyGen voice has. A plan with none of these has none: each key is there only
    once there is something to keep in it. */
const isPlanned = (p) => isObject(p) && PLANNED_ROUTES.includes(p.route) && isText(p.title)
  && (p.voice === null || (p.route === "explainer" && PLANNED_VOICES.includes(p.voice)))
  && isTime(p.at) && isText(p.on) && (p.set === null || isTime(p.set))
  && Array.isArray(p.cues) && p.cues.every(isObject) && Array.isArray(p.shots) && p.shots.every(isPlannedShot)
  && Array.isArray(p.lines) && p.lines.every((line) => typeof line === "string")
  && (p.filmed === null || isTime(p.filmed) || isObject(p.filmed))
  && (p.consent === undefined || (Array.isArray(p.consent) && p.consent.every(isConsent)))
  && (p.project === undefined || (p.route === "explainer" && p.voice === "heygen" && isPlannedProject(p.project)));
/** The recording as it was on the Mac that holds it, once it is copied into Original files (layout 6, L6): `{ file, bytes, mtimeMs }`, and
    nothing else: its file's name in the episode's own folder there (one name, no folder), its size and its time. */
const isOriginal = (o) => isObject(o) && Object.keys(o).length === 3 && isText(o.file) && !/[/\\]/.test(o.file) && o.file !== "." && o.file !== ".."
  && isCount(o.bytes) && isNumber(o.mtimeMs);
/** Where an episode's own files are kept (layout 6, D2): `{ on, original? }`, and nothing else. `on` is the Mac that holds them, in its work
    folder's video/ (where.js), and `original`, once the recording is in Original files, the recording as it was there (isOriginal). */
const isLocalPlace = (l) => isObject(l) && isText(l.on) && (l.original === undefined || isOriginal(l.original)) && Object.keys(l).every((key) => key === "on" || key === "original");
/** Whether a record holds `local`, whatever it holds in it: its layout is 6 (layoutOf), and what is in it is checked (faultFor). */
const holdsLocal = (r) => r.local !== undefined && r.local !== null;

/** Whether a record is a planned episode, whole: the one record with no kind that is not gated (gate.js gated). It is none unless all
    of these hold, and a record that only claims to be planned, failing any, is a video not yet answered to every command:
    - its answer says "planned" and is a planned answer's (isPlannedAnswer);
    - its `planned` is whole (isPlanned);
    - it has no video (`video` is null) and no kind (`kind` is null), since it was made in her chat from words she gave and never
      from a file, so it cannot be a client's or a group's session;
    - it was written at layout 5, which a Mac on older code reads as newer, and holds no `local`; or (Phase 3, L2) at layout 6 with a whole
      `local` (isLocalPlace), a plan kept on one Mac; and
    - it holds no session mark.
    It reads nothing else of the record, and anything that is not an object is none. No code clears a plan's `local`: writeEpisode never lowers
    a layout, so a plan written again with `local` null would stay at layout 6, whole, and be no plan here (L2 review, R0-F4). L4 rules whether
    a plan's `local` is ever cleared; if it is, this rule or faultFor changes with it. */
export const isPlannedRecord = (r) => isObject(r) && (r.version === PLANNED_VERSION ? !holdsLocal(r) : r.version === LOCAL_VERSION && isLocalPlace(r.local))
  && r.kind === null && r.video === null && isPlannedAnswer(r.answer) && isPlanned(r.planned)
  && (r.session === undefined || r.session === null);

/** Whether a record is a video made from a plan (PR H5b): the plan's own record, written once more as the video its footage made when she said
    all the footage was in (`join`). It holds the plan it was (`planned`, whole), the video that was made (`video`) and a kind of its own, "raw"
    or "short video". It is no plan waiting for its footage (isPlannedRecord is false of it: it has a video and a kind), and it is gated as any
    answered video is. Its plan is kept in it, so that it stays at layout 5 (at 6, with its `local`, for a plan kept on one Mac); its
    `planned.filmed` says when and of which parts it was made. */
export const isFromPlan = (r) => isObject(r) && isObject(r.video) && KINDS.includes(r.kind) && isPlanned(r.planned);

/** The kind of a record as a person means it: "raw", "finished", "session" or "short video", or null while the video waits for
    its answer. An "episode" is a raw recording imported before the switch. */
export function kindOf(r) {
  const kind = isObject(r) ? r.kind : null;
  if (kind === "episode") return "raw";
  return KINDS.includes(kind) ? kind : null;
}

/** The reading the record holds when it is the current one, or null: one made after her answer (not before it), as the kind the
    video is now. `kind … --again` keeps the reading and its offers in the record while the new one is made, and a video answered
    again as another kind holds the old kind's: neither is a reading of this answer (the inverse of reading.js notAsAnswered). A
    time that cannot be read is not after. */
export function currentReading(record) {
  const reading = record.reading;
  if (reading === null || typeof reading !== "object" || record.answer === null || typeof record.answer !== "object") return null;
  return Date.parse(reading.at) >= Date.parse(record.answer.at) && reading.kind === kindOf(record) ? reading : null;
}

/** Her answer to the offers of the reading the record holds, { reading, at, on, applied, left }, or null while they are not
    answered. An answer is of one reading, the current one (currentReading): a reading made again (its `at` is another) has offers
    of its own. */
export function answerOf(record) {
  const answer = record.offers && record.offers.answered;
  const reading = currentReading(record);
  return answer && reading && answer.reading === reading.at && Array.isArray(answer.applied) && Array.isArray(answer.left) ? answer : null;
}

/** How a record is named in all that edit.js prints, which goes into Sallie's chat (spec 2026-10-22, section 1, "Unanswered and
    session videos are named by a neutral label"): a video not yet answered, or left alone, by its label, as the import made it
    and the record keeps it (it is never made again from when the record says it was imported: the label's moment is its
    own), or by its short id when it has none; every other record by its name, as today. It fails closed for every record the
    gate holds (gate.js gated): a session is named by its name, which is its label (F3 sets it in the same write as the mark,
    and F7 checks any rename), but never by a name that is still its file's; and a record of another kind whose session mark is
    not cleared is named by its label, and either of them, with no label, as "a client or group session (<short id>)". A
    record that has no name to give, as a conflicted copy that is not whole may be, is named by its short id. A planned episode
    (isPlannedRecord) is the one record with no kind that is named by its name, which is its title: it was made in her chat from
    words she gave, and never from a file. A record that only claims to be planned is named as any record with no kind is. */
export function shownName(r) {
  const short = isObject(r) && typeof r.id === "string" ? r.id.slice(-6) : "";
  const label = isObject(r) && isText(r.label) ? r.label : "";
  if (isPlannedRecord(r)) return isObject(r.name) && isText(r.name.text) ? r.name.text : r.planned.title;
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
    preset, a Reel's captions turned off, or the logo's picture); and 1 while it holds none. 4 once it holds `app`, and 5 once it holds
    a plan (`planned`) or what a part is footage for (`partOf`, PR H5a): that is a planned episode's layout, and a part's, and it stays
    5 whatever else the record comes to hold. 6 once it holds `local` (Phase 3, L2), whatever else it holds: a plan or a part kept on one Mac
    is at 6 too. */
export function layoutOf(r) {
  if (holdsLocal(r)) return LOCAL_VERSION;
  if (isObject(r.planned) || isObject(r.partOf)) return PLANNED_VERSION;
  if (r.app !== undefined && r.app !== null) return 4;
  const layered =(x) => Boolean(x) && (["texts", "graphics", "cuts"].some((k) => Array.isArray(x[k]) && x[k].length > 0) || x.logo === true || Boolean(x.preset) || x.captions === false);
  const withHow = (x) => Boolean(x) && Array.isArray(x.pushed) && x.pushed.some((p) => isObject(p) && p.how !== undefined);
  if (!["episode", "short video"].includes(r.kind) || Boolean(r.answer) || Boolean(r.session) || Boolean(r.reading) || Boolean(r.versionOf) || withHow(r.main) || (r.reels || []).some(withHow)) return 3;
  return (r.spellings || []).length > 0 || layered(r.main) || (r.reels || []).some(layered) || Boolean(r.brand && r.brand.logo) ? 2 : 1;
}

/** Whether a record is of the switch's layout (3) or a later one (4, which adds the app's projects): what is said of a switched
    record, as a light import's that may be named for a client, holds for every layout from the switch on. */
export const ofTheSwitch = (r) => layoutOf(r) >= 3;

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
    her answer sets it. A record made without them is a record of layout 1. `local` ({ on: the Mac }) is given for a video filed on a Mac with a
    drop folder of its own (Phase 3, L3): its files are then kept on that Mac, and the record is at layout 6.
    The video was recorded on the day its file says, when it says one, and otherwise on the day of the import. Its name is
    the video's own, without its ending, until a person gives it one. A video with a picture and no sound (the import gives
    `video.sound` false, PR H5a) says so in its record: `video.sound` is false; a video that has its sound says nothing of it.
    Its rev is 0 until writeEpisode first writes it. */
export function newEpisode({ id, machine, at, video, kind, writer, files = {}, title = null, reels = [], answer = null, label = "", fingerprint = "", versionOf = null, local = null }) {
  const made = video.created ? new Date(video.created) : null;
  const dated = made !== null && Number.isFinite(made.getTime()) && made.getFullYear() >= FIRST_YEAR;
  const record = {
    version: 1,
    id,
    rev: 0,
    writer,
    kind,
    video: { file: video.file, bytes: video.bytes, seconds: video.seconds, recorded: dated ? localDay(made) : at.slice(0, 10), recordedFrom: dated ? "video" : "import", ...(video.sound === false ? { sound: false } : {}) },
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
    ...(versionOf ? { versionOf } : {}),
    ...(local ? { local } : {})
  };
  return { ...record, version: layoutOf(record) };
}

/** The record of a planned episode (layout 5): a video planned in her chat from a script, before any footage exists, so it has no
    video and no kind. `route` is "script" or "explainer", the `title` is the words she gave, the `voice` is an explainer's
    ("sallie" or "heygen", or null while it has none) and a script's is null, `machine` and `at` are where and when it was planned
    (localStamp), and the `writer` is { commit, on }. It holds the answer "planned" (isPlannedAnswer), named by its title, and no
    package yet: no cues, shots or lines (`plan … set` fills them), and no footage (`filmed` is null; PR H5). Its rev is 0 until
    writeEpisode first writes it. Every other field is that of a video's record, as newEpisode has it, so that nothing that reads a
    record has to know a planned one is different. */
export function newPlannedEpisode({ id, machine, at, title, route, voice = null, writer }) {
  return {
    version: PLANNED_VERSION,
    id,
    rev: 0,
    writer,
    kind: null,
    video: null,
    imported: { on: machine, at },
    name: { text: title, placeholder: false },
    title: null,
    editing: null,
    released: null,
    archived: null,
    files: {},
    spellings: [],
    main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null },
    reels: [],
    libraries: {},
    finished: null,
    answer: { state: PLANNED_STATE, by: "plan new", on: machine, at, private: "no" },
    planned: { route, title, voice, at, on: machine, set: null, cues: [], shots: [], lines: [], filmed: null }
  };
}

/** What is wrong with a record, in plain words, by a brimm-video that reads the layouts up to `known`: "" when it is a whole
    record. Fields it does not know are not looked at, since they are kept as they are. Of the fields of layout 3, which are
    all optional, each is checked only when it is there. `episodeFault` is this for the layout this brimm-video reads; another
    `known` stands in for a Mac on older code, in a test. */
export const faultFor = (known) => (r) => {
  if (!isObject(r)) return "it is not an episode's record";
  if (!Number.isInteger(r.version) || r.version < 1 || r.version > known) return `it is version ${JSON.stringify(r.version)}, and this BRIMM Video Studio reads versions 1 to ${known}`;
  const v = r.video;
  const m = r.main;
  // A record with no video, and a record with no kind but the answer "planned", are whole only as a planned episode is: a planned
  // answer, a whole `planned`, and nothing of a video.
  const planAlone = isPlannedAnswer(r.answer) && isPlanned(r.planned);
  // A part (PR H5a) holds `partOf`, which a record has only with the answer "part", and the answer "part" only with it.
  const hasPart = r.partOf !== undefined && r.partOf !== null;
  const faults = [
    [/^e-\d{8}-[0-9a-f]{6}$/.test(r.id), "its id cannot be read"],
    [Number.isInteger(r.rev) && r.rev >= 1, "its rev cannot be read"],
    [isObject(r.writer) && isText(r.writer.commit) && isText(r.writer.on), "who last wrote it cannot be read"],
    [KINDS.includes(r.kind) || (r.kind === null && isObject(r.answer) && (NO_KIND_STATES.includes(r.answer.state) || (planAlone && v === null))), "its kind cannot be read"],
    [(isObject(v) && isText(v.file) && !v.file.includes("/") && isCount(v.bytes) && isNumber(v.seconds) && v.seconds >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(v.recorded) && ["video", "import"].includes(v.recordedFrom) && (v.sound === undefined || v.sound === false)) || (v === null && r.kind === null && planAlone), "its video cannot be read"],
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
    [optional(r.answer, isAnswer) && (!isObject(r.answer) || r.answer.state !== PLANNED_STATE || (r.kind === null && v === null && isPlanned(r.planned))) && (!isObject(r.answer) || r.answer.state !== PART_STATE || hasPart), "its answer cannot be read"],
    [r.label === undefined || typeof r.label === "string", "its label cannot be read"],
    [r.fingerprint === undefined || typeof r.fingerprint === "string", "its fingerprint cannot be read"],
    [optional(r.versionOf, isText), "which episode it is a version of cannot be read"],
    [optional(r.session, isSession), "its session mark cannot be read"],
    [optional(r.reading, isReading), "its reading by Claude cannot be read"],
    [optional(r.app, isApp), "its HyperFrames projects cannot be read"],
    [r.planned === undefined || r.planned === null || (isPlanned(r.planned) && r.version >= PLANNED_VERSION), "its plan cannot be read"],
    [!hasPart || (isPartOf(r.partOf) && r.version >= PLANNED_VERSION && r.kind === null && isObject(r.answer) && r.answer.state === PART_STATE), "which plan it is footage for cannot be read"],
    // Where its own files are kept (Phase 3, L2): a whole `local`, and only at layout 6 or above, which a Mac on older code reads as newer.
    [!holdsLocal(r) || (isLocalPlace(r.local) && r.version >= LOCAL_VERSION), "which Mac holds its files cannot be read"]
  ];
  const found = faults.find(([ok]) => !ok);
  return found ? found[1] : "";
};
/** What is wrong with a record, in plain words: "" when it is a whole record of a layout this brimm-video reads. */
export const episodeFault = faultFor(NEWEST_VERSION);

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

/** The conflicted copies Dropbox has kept of an episode's records, as they are read: each a record's object, past any that cannot
    be read. [] when there are none. A copy is only read, as edit.js's findEpisode reads them for the gate. */
export function recordCopies(folder) {
  return conflictedCopies(folder)
    .filter((path) => /^record\/\d{4}\.json$/.test(conflictedOf(path)))
    .map((path) => {
      try {
        return JSON.parse(readFileSync(join(folder, path), "utf8"));
      } catch (e) {
        return null;
      }
    })
    .filter((copy) => copy !== null && typeof copy === "object" && !Array.isArray(copy));
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
export function readEpisode(folder, { pastCopies = false, known = NEWEST_VERSION } = {}) {
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
    was. `pastCopies`, which `resolve` alone gives, writes past the conflicted copies, as it sorts them out one at a time. `known` is the
    newest layout this BRIMM Video Studio writes, as readEpisode's: a test gives an older one, to stand in for a Mac on older code. */
export function writeEpisode(folder, record, { expectRev, writeText, writer, home, pastCopies = false, known = NEWEST_VERSION }) {
  if (!Number.isInteger(expectRev) || expectRev < 0) throw new Error("the episode's record was not written, because the rev it was read at was not given");
  if (isObject(record) && Number.isInteger(record.version) && record.version > known) throw Object.assign(new Error("Jason has a newer BRIMM Video Studio. Ask him to update this Mac."), { code: "NEWER" });
  const copies = conflictedCopies(folder);
  if (copies.length && !pastCopies) throw Object.assign(new Error(conflictWhy(copies)), { code: "CONFLICTED" });
  if (recordNumbers(folder).some((n) => n > expectRev)) throw Object.assign(new Error("this episode changed on the other Mac: open it again"), { code: "CHANGED" });
  // A record once written at layout 2 or 3 stays there: a Mac that knows only 1 would push its Reels without what layout 2
  // draws, and one that knows only 2 would go on with an episode whose answer or kind it cannot see.
  const next = { ...record, version: Math.max(Number.isInteger(record.version) ? record.version : 1, layoutOf(record)), rev: expectRev + 1, writer };
  const fault = faultFor(known)(next);
  if (fault) throw Object.assign(new Error(`the episode's record was not written, because ${fault}`), { code: "FAULT" });
  mkdirSync(join(folder, RECORD_DIR), { recursive: true });
  writeText(recordFile(folder, next.rev), recordText(next));
  if (home) noteWritten(home, next.id, next.rev);
  return next;
}

/** Other names Dropbox may have kept a file under, beside it: with ".writing" after its name, or with "(1)", or a conflicted
    copy's words, before its ending. Each as a path from the episode's folder. */
export function otherNames(folder, path) {
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

/** What is wrong with an episode's files against the list in its record, one entry for each file: { file, kind, size, bytes, kept }.
    `kind` is "missing", "short" (smaller than listed) or "different" (larger than listed); `size` is what it is now (null when it is
    not there), `bytes` what the record lists, and `kept` any other name Dropbox may have kept it under. [] when every file is there at
    its size. `stat` is how a file is measured: a test gives a stand-in. (Review changes R4c: a rule about one file reads `file`,
    never the words.)
    A record that holds `local` (Phase 3, L2) keeps its own files on the Mac `local.on` (where.js filePlace): on that Mac each is looked for in
    `localFolder`, the episode's own folder there (its work folder's video/, where.js folderAt); on any other Mac (`machine`) none is looked
    for, and none is missing, since it is not kept there. Its files in Dropbox (record/, final/, history/, Original files/ and a plan's) are
    looked for in `folder`, as every file of a record without `local` is. A caller that gives no `machine` has every file looked for, and one
    that gives no `localFolder` has each looked for in `folder`, as before. */
export function fileProblems(folder, record, { stat = statSync, machine, localFolder = folder } = {}) {
  const problems = [];
  for (const [path, bytes] of Object.entries(record.files)) {
    if (path.split("/")[0] === RECORD_DIR) continue;
    const onTheMac = filePlace(record, path) === "local";
    if (onTheMac && machine !== undefined && machine !== record.local.on) continue;
    const dir = onTheMac ? localFolder : folder;
    let size = null;
    try {
      size = stat(join(dir, path)).size;
    } catch (e) {
      // A file that cannot be measured is not there for any command that needs it.
    }
    if (size === bytes) continue;
    // A recording that left the Mac (L6) is missing only when its copy in Original files/ is not there either, which the same loop looks at.
    if (size === null && onTheMac && path === record.video.file && record.local.original && record.local.original.file === path && Number.isInteger(record.files[`Original files/${path}`])) continue;
    problems.push({ file: path, kind: size === null ? "missing" : size < bytes ? "short" : "different", size, bytes, kept: otherNames(dir, path) });
  }
  return problems;
}

/** What is wrong with an episode's files, one line for each file, in plain words for a command's refusal: missing, short, or
    not the size listed, with any other name Dropbox may have kept it under. [] when every file is there at its size. It takes the options
    fileProblems takes. */
export function filesProblems(folder, record, { stat = statSync, machine, localFolder = folder, onMac } = {}) {
  return fileProblems(folder, record, { stat, machine, localFolder }).map(({ file, kind, size, bytes, kept }) => {
    // A file of an episode kept on this Mac, not whole in its video/ folder, is said in this Mac's words when `onMac` gives them (L2c).
    if (typeof onMac === "function" && filePlace(record, file) === "local") return onMac(file);
    const as = kept.length ? `, and Dropbox may have kept it as ${kept.join(" or ")}` : "";
    if (kind === "missing") return `${file} is missing${as}`;
    if (kind === "short") return `${file} is short: ${size} bytes of ${bytes}${as}`;
    return `${file} is ${size} bytes, not the ${bytes} the record lists${as}`;
  });
}

/** One problem of fileProblems told to her: what happened and what she can try first. */
export function fileProblemWords({ file, kind, kept }) {
  const as = kept.length ? ` Dropbox may have kept it as ${kept.join(" or ")}.` : "";
  if (kind === "missing") return `A file of this video is missing: ${file}. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason.${as}`;
  if (kind === "short") return `A file of this video is not all here yet: ${file}. Dropbox is still bringing it. Ask again in a few minutes.${as}`;
  return `A file of this video is not the one Studio saved: ${file}. If you changed it, tell me what you changed. If not, tell Jason.${as}`;
}

/** Who is editing an episode, when it is a Mac other than `machine`: the record's `editing`. null when nobody is, or this Mac
    is. */
export const heldElsewhere = (record, machine) => (record.editing && record.editing.by !== machine ? record.editing : null);

/** Why a command that writes the record, pushes or puts files into the episode must not change it now, because another Mac
    has it open (spec section 1, "Picking an episode up"), in plain words: "" when nobody does, or `machine` does. The episode is
    named as everything edit.js prints names it (shownName). */
export const heldText = (record, machine) => {
  const held = heldElsewhere(record, machine);
  return held ? `${held.by} has ${shownName(record)} open. Carry on there. Nothing was changed.` : "";
};

/** The record with `machine` editing it since `at`. */
export const claimed = (record, machine, at) => ({ ...record, editing: { by: machine, since: at } });

