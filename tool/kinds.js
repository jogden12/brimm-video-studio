// How a video came to a Mac, what the tool guesses it to be, and the labels an unanswered or session video goes by in the chat
// (spec 2026-10-22, section 1). Her chat is Claude, and a file's name is often a client's or a meeting's, so a label is made
// of the length, the Mac and the moment the video was dropped, and never of the name.
// Nothing here touches a disk or runs a program.
import { basename } from "node:path";
import { stamp } from "./shared/text.js";
import { episodeKind } from "./filing.js";

const list = (v) => (Array.isArray(v) ? v : []);

/** The names Zoom gives what it downloads: a recording ("GMT20261013-142933_Recording_gvo_1280x720.mp4") and the separate
    sound and picture files of a meeting ("audio1449382767.m4a", "video1449382767.mp4"). */
const ZOOM_NAMES = [/^GMT\d{8}-\d{6}_Recording/, /^(audio|video)\d{8,}\.(m4a|mp4)$/];

/** Whether a file's name is one of Zoom's. */
export const isZoomName = (name) => typeof name === "string" && ZOOM_NAMES.some((re) => re.test(basename(name)));

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

/** The label of a session, from the day it is marked ("2026-10-22"): "Session, 2026-10-22", and with a number, "(2)", "(3)",
    for each one more that day. `taken` holds the labels the other sessions have. */
export function sessionLabel(day, taken = []) {
  const first = `Session, ${day}`;
  const used = new Set(taken);
  if (!used.has(first)) return first;
  let n = 2;
  while (used.has(`${first} (${n})`)) n++;
  return `${first} (${n})`;
}

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
