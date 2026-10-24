// How a video came to a Mac, what the tool guesses it to be, and the labels an unanswered or session video goes by in the chat
// (spec 2026-10-22, section 1). Her chat is Claude, and a file's name is often a client's or a meeting's, so a label is made
// of the length, the Mac and the moment the video was dropped, and never of the name.
// Nothing here touches a disk or runs a program.
import { basename, extname } from "node:path";
import { stamp } from "./shared/text.js";
import { episodeKind } from "./filing.js";
import { fileSafe } from "./names.js";

const list = (v) => (Array.isArray(v) ? v : []);

/** The names Zoom gives what it downloads: a recording ("GMT20261013-142933_Recording_gvo_1280x720.mp4") and the separate
    sound and picture files of a meeting ("audio1449382767.m4a", "video1449382767.mp4"). */
const ZOOM_NAMES = [/^GMT\d{8}-\d{6}_Recording/, /^(audio|video)\d{8,}\.(m4a|mp4)$/];

/** Whether a file's name is one of Zoom's. Zoom's own names are matched by how they start, so a download renamed with words after
    them is one too ("GMT20261013-142933_Recording_Jane Doe.mp4"). */
export const isZoomName = (name) => typeof name === "string" && ZOOM_NAMES.some((re) => re.test(basename(name)));

/** How a Zoom download is named in every line, status and log: by the part of its name that Zoom's own names match, its Zoom time
    alone ("GMT20261013-142933_Recording", "audio1449382767.m4a"), never by words a person put after it, which may be a client's. ""
    for a name that is not Zoom's. */
export function zoomTimeOf(name) {
  if (typeof name !== "string") return "";
  const matched = ZOOM_NAMES.map((re) => re.exec(basename(name))).find(Boolean);
  return matched ? matched[0] : "";
}

/** Whether the picture is upright or square, as episodeKind takes it. A file with no picture is not. */
const upright = (facts) => facts.height > 0 && facts.width <= facts.height;

/** How a video came, from its name and what ffprobe read: "zoom" for a name of Zoom's; "sound" for a file with no picture;
    "phone" when the file says an iPhone made it (its make is Apple and its model begins "iPhone") or its picture is upright;
    and "camera" for anything else. */
export function cameFrom({ name, facts }) {
  if (isZoomName(name)) return "zoom";
  if (!facts.height) return "sound";
  const device = facts.device || {};
  return (device.make === "Apple" && String(device.model || "").startsWith("iPhone")) || upright(facts) ? "phone" : "camera";
}

/** The kinds of range of a cut plan that are a retake: what the rules found and cut, which a pause is not. */
const RETAKES = new Set(["retake", "false start", "cue"]);

/** How many ranges of a cut plan the rules cut as a retake, a false start or a spoken cue. */
const retakesIn = (plan) => list(plan && plan.ranges).filter((r) => r && !r.keep && RETAKES.has(r.kind)).length;

const TEN_MINUTES = 600;

/** The tool's guess at what a video is, never made by Claude and never "session", which only she says: "clip" for a video
    that is upright or short (by episodeKind, so that the rule is the one an episode's kind uses); "raw" when the rules found
    at least one retake, false start or spoken cue for each ten minutes of the recording, as a recording with its retakes still
    in has; and "finished" when they found fewer. A Zoom download or a file of sound alone gets none, null: it is asked about
    with no guess. */
export function guessKind({ facts, plan, came }) {
  if (came === "zoom" || came === "sound") return null;
  if (episodeKind(facts) === "short video") return "clip";
  return retakesIn(plan) * TEN_MINUTES >= facts.duration ? "raw" : "finished";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The day and the clock time written in a moment as the record keeps it ("2026-10-22T10:40:00-04:00" is { day: "22 Oct",
    time: "10:40" }). They are read from the text, not turned into a time, so that they are the Mac's own whatever the zone
    of whoever reads them. Null for anything that is not such a moment. */
function whenIn(at) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(at ?? ""));
  if (!m || !MONTHS[Number(m[2]) - 1] || Number(m[3]) < 1 || Number(m[3]) > 31 || Number(m[4]) > 23 || Number(m[5]) > 59) return null;
  return { day: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`, time: `${m[4]}:${m[5]}` };
}

/** A Mac as a sentence says it, from its name in the settings: "the Mac Studio", but "Sallie's laptop". */
export const spokenMac = (machine) => (/['’]s\b/.test(machine) ? machine : `the ${machine}`);

/** The two ways to name a video that has been dropped and not answered, from its length in `seconds`, the Mac it was dropped
    on and the moment `at` it was (localStamp): { short, spoken }, as
    { short: "Video of 22 Oct, 10:40 (Mac Studio)", spoken: "the 42-minute video dropped on the Mac Studio at 10:40 on 22 Oct" }.
    The length is in minutes to the nearest whole minute, and left out for a video of less than half a minute. A moment
    that cannot be read leaves out the day and the time. Nothing else goes into a label, and a file's name never does. */
export function labelFor({ seconds, machine, at }) {
  const minutes = Math.round(Number(seconds) / 60);
  const when = whenIn(at);
  const on = spokenMac(machine);
  return {
    short: `Video${when ? ` of ${when.day}, ${when.time}` : ""} (${machine})`,
    spoken: `${minutes >= 1 ? `the ${minutes}-minute video` : "the video"} dropped on ${on}${when ? ` at ${when.time} on ${when.day}` : ""}`
  };
}

/** A label that no label in `taken` is: `label` itself when it is free, and otherwise `label` with the first number from 2
    up that is free, as "Video of 20 Oct, 14:52 (Mac Studio) (2)". */
export function numbered(label, taken = []) {
  const used = new Set(taken);
  if (!used.has(label)) return label;
  let n = 2;
  while (used.has(`${label} (${n})`)) n++;
  return `${label} (${n})`;
}

/** The label of a session, from the day it is marked ("2026-10-22"): "Session, 2026-10-22", and with a number, "(2)", "(3)",
    for each one more that day. `taken` holds the labels the other sessions have. */
export const sessionLabel = (day, taken = []) => numbered(`Session, ${day}`, taken);

/** What the tool saw, in a line for her card, with nothing of the file's name: "wide, 42:10, 2 retakes". The shape is "wide",
    "upright" (a square picture too, as episodeKind has it) or "sound only", then the length, then what the rules cut as
    retakes, false starts and spoken cues, counted together. With no plan the rules counted nothing, and the count is left
    out: "wide, 42:10". */
export function seenLine({ facts, plan }) {
  const shape = !facts.height ? "sound only" : upright(facts) ? "upright" : "wide";
  const seen = `${shape}, ${stamp(Math.round(facts.duration))}`;
  if (plan == null) return seen;
  const n = retakesIn(plan);
  return `${seen}, ${n === 0 ? "no retakes" : n === 1 ? "1 retake" : `${n} retakes`}`;
}

/** Whether a text is a line of what was seen, as seenLine makes it, on one line: "wide", "upright" or "sound only", the length, and
    when there is a plan the retakes, "no retakes", "1 retake" or "<n> retakes". A record may hold any text as what was seen, as a
    conflicted copy that was never checked does, so that a line printed from it into the chat is printed only in this shape: it
    holds no line break, and no name of a file. Anything that is not text is not one. */
export const isSeenLine = (text) => typeof text === "string" && /^(?:wide|upright|sound only), \d+(?::\d{2}){1,2}(?:, (?:no retakes|1 retake|\d+ retakes))?$/.test(text);

/** The names a video's file goes by, which a line about it must not hold while it is named by its label: the file's own name,
    that name without its ending, and that in the file-safe form its episode's folder and projects are named with. Each of
    `files` is a file's name, or a path to it. */
export function namesOf(...files) {
  const names = [];
  for (const file of files.filter((f) => typeof f === "string" && f !== "")) {
    const name = basename(file);
    const stem = basename(name, extname(name));
    names.push(file, name, stem, fileSafe(stem));
  }
  return [...new Set(names.filter((n) => n !== "" && n !== "video"))];
}

/** Text as a regular expression takes it, letter for letter. */
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A path in a line: from a "/" or "~/" that starts a word, or one just inside a quote or a bracket, up to a quote, a bracket, a
    colon or a comma with a space after it, a space and an opening bracket, a full stop at the end of a sentence, or the end of
    the line or of the text between two kept ones. A path may hold spaces, as Dropbox's do, and a folder's name in it may end in
    a bracketed part, as an episode's "(Mac Studio)" does: so it is taken to its end, and never word by word. It never ends in a
    space, so that one before a kept text stays. */
const PATH = /(^|[\s'"(\[=])~?\/(?:[^\n'"()[\]]|\([^\n'"()/]*\)(?=\/))*?(?<!\s)(?=['")\]\n]| \((?![^\n'"()/]*\)\/)|: |, |\.?\s*$|\.\s)/gm;

/** How a name is found in a line (withoutNames). A name of more than one word, a file's name with its ending, or a path, as a
    whole word wherever it stands, in any case. A name of one bare word, as the file "1.mov" or "Main.mov" has, could be a word
    of the tool's own ("reel 1", "the main video", "a client or group session"): so it is found in its own case alone, and only
    as the start of a file's name ("1.transcript.txt", "1 (Sallie's laptop's conflicted copy 2026-10-20).srt"), in an episode
    folder's name ("2026-10-20 1 (Mac Studio)"), and on its own when it is three characters or more and holds a letter. */
function finderOf(name) {
  const word = (re) => String.raw`(?<![\p{L}\p{N}])${re}(?![\p{L}\p{N}])`;
  if (/\s|\//u.test(name) || /\.\p{L}[\p{L}\p{N}]*$/u.test(name)) return new RegExp(word(literally(name)), "giu");
  const forms = [String.raw`(?<![\p{L}\p{N}])${literally(name)}(?=(?: \([^()\n]*\))?\.\p{L})`, String.raw`(?<=\d{4}-\d{2}-\d{2} )${literally(name)}(?= \()`];
  if ([...name].length >= 3 && /\p{L}/u.test(name)) forms.push(word(literally(name)));
  return new RegExp(forms.join("|"), "gu");
}

/** `text` with nothing in it of the names in `names` (namesOf: a video's file and what is named from it), each put as "the
    video" wherever it is found (finderOf), and, unless `paths` is false, with each path in it put as "a file": a line about a
    video named by its label (spec 2026-10-22, section 1). What is in `keep` stays as it is, as the label itself does when the
    file's name is a word of it ("Video.mov"): the text is taken apart at each of them, and only the parts between are looked
    at. */
export function withoutNames(text, names = [], keep = [], { paths = true } = {}) {
  const texts = (given) => [...new Set(given.filter((x) => typeof x === "string" && x !== "").map((x) => x.normalize("NFC")))].sort((a, b) => b.length - a.length);
  let parts = [{ text: String(text ?? "").normalize("NFC"), kept: false }];
  for (const k of texts(keep)) parts = parts.flatMap((p) => (p.kept ? [p] : p.text.split(k).flatMap((piece, i) => [...(i ? [{ text: k, kept: true }] : []), { text: piece, kept: false }])));
  const found = texts(names).map(finderOf);
  // A name is put as a mark of its own until the paths are taken out, so that no shorter name is found in what it is put as.
  const plain = (piece) => {
    const named = found.reduce((out, re) => out.replace(re, "\u0001"), piece);
    return (paths ? named.replace(PATH, "$1a file") : named).replace(/\u0001/g, "the video");
  };
  return parts.map((p) => (p.kept ? p.text : plain(p.text))).join("");
}
