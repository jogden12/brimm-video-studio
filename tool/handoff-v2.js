// The hand-off file, version 2: what brimm-video gives BRIMM Ops for a finished video, a raw video, a session or an iPhone clip,
// in one file that a person drops on the BRIMM Ops page (spec section 8, agreed with the page's own session). Its tests, and the
// five fixtures in tests/fixtures that brimm-operations keeps a copy of (one for each kind, and handoff-v2-session-replacing,
// a session that replaces a finished video's id), are the contract between the two: change neither without changing both. The page refuses a session's hand-off for any key it does not know, so the writer writes only the
// keys the contract names, and the check refuses any other.
// Version 1, in handoff.js, is unchanged and still read by the page.
// Nothing here touches a disk or runs a program.
import { FORMAT } from "./handoff.js";
import { kindOf } from "./episode.js";
import { tidyTranscript } from "./shared/transcript.js";
import { keptWords, lengthOf, timelineAt } from "./clock.js";

export const VERSION_2 = 2;

/** The kinds version 2 knows. A record kept as an "episode" is written "raw" (kindOf). */
const KINDS = ["finished", "raw", "session", "short video"];

/** The keys of the contract, in the order they are written. A Reel's `inMain` is only where there is a main video, and its
    `clientAgreed` only for a session's. */
const TOP = ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "main", "suggestions", "reels", "session"];
const VIDEO = ["id", "kind", "name", "recorded", "recordedFrom"];
const MAIN = ["file", "seconds", "srt", "onPicture"];
const SUGGESTION = ["n", "start", "end", "stretches", "first", "last", "why", "point"];
const STRETCH = ["start", "end"];
const REEL = ["n", "title", "file", "seconds", "inMain", "srt", "fromSuggestion"];
const SESSION_REEL = ["n", "title", "file", "seconds", "srt", "fromSuggestion", "clientAgreed"];
const SESSION = ["principles", "recurringPrinciples", "reelsToFilm"];
const LISTS = ["steps", "red_flags", "green_flags", "decision_criteria", "verbatim_key_phrases"];
const PRINCIPLE = ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"];
const RECURRING = ["n", "text"];
const FILM = ["n", "idea", "words", "why", "principle"];

/** The parts of a suggestion that are words, and what each is called when it is missing. */
const SUGGESTION_WORDS = [["first", "first words"], ["last", "last words"], ["why", "reason"], ["point", "point"]];

/** Of `o`, the keys in `keys`, in that order and as they are given: a key that is not there is left out, and a list is
    copied. Nothing the contract does not name is carried, whatever the record's own items hold. */
function pick(o, keys) {
  const out = {};
  if (o && typeof o === "object") for (const k of keys) if (o[k] !== undefined) out[k] = Array.isArray(o[k]) ? [...o[k]] : o[k];
  return out;
}

const suggestionOf = (given) => {
  const s = given || {};
  const out = pick(s, ["n", "start", "end"]);
  if (s.stretches !== undefined) out.stretches = Array.isArray(s.stretches) ? s.stretches.map((t) => pick(t, STRETCH)) : s.stretches;
  return { ...out, ...pick(s, ["first", "last", "why", "point"]) };
};

/** A made Reel. Its place in the main is left out when it was not found, or when there is no main video; and a session's Reel
    carries the day the client's agreement was noted. Its `fromSuggestion` is given by the caller: the suggestion's number, which
    the Reel takes, or null for a Reel made from times she gave, which has a fresh number. A missing one is not made null here:
    the check refuses it. */
const reelOf = (given, inSession) => {
  const r = given || {};
  return {
    ...pick(r, ["n", "title", "file", "seconds"]),
    ...(!inSession && r.inMain ? { inMain: pick(r.inMain, STRETCH) } : {}),
    ...pick(r, ["srt", "fromSuggestion"]),
    ...(inSession ? pick(r, ["clientAgreed"]) : {})
  };
};

/** A session's items, as they are given: the caller gives only what Sallie approved, and none of it is changed here, but only
    the contract's keys of each are written. Lists not given are empty: a session revision may hold nothing yet. A field not
    given is left out, never made up: a principle's fields other than its number and name, and a Reel idea's words and why,
    are left out where the name check took them out (spec 2026-10-22, section 8), and the page reads a missing text as "". A
    Reel idea's principle is always written, null when not given. */
const sessionOf = (given) => {
  const s = given || {};
  const items = (v, each) => (v === undefined ? [] : Array.isArray(v) ? v.map(each) : v);
  return {
    principles: items(s.principles, (p) => pick(p, PRINCIPLE)),
    recurringPrinciples: items(s.recurringPrinciples, (p) => pick(p, RECURRING)),
    reelsToFilm: items(s.reelsToFilm, (p) => ({ ...pick(p, FILM.slice(0, 4)), principle: p && p.principle !== undefined ? p.principle : null }))
  };
};

/** The hand-off, in the spec's order, by the kind of the record (`kindOf`).
    - `id` is the video's first version's id, which a new version keeps; `revision` rises across versions and formats.
    - `main` is the final video's file name in final/, its length in seconds and its captions as the transcript tool writes
      them; a session has none. `onPicture` is the words drawn on a raw video's or a clip's picture, in order, and is left out
      when there are none and for a finished video or a session, whose picture brimm-video does not draw on.
    - `suggestions` are a finished or raw video's, and are left out when there are none or for any other kind.
    - `reels` are the Reels made here: a finished or raw video's, or a session's Reels with `clientAgreed`; a short video has
      no `reels` key.
    - `session` is a session's approved principles, recurring principles and Reel ideas, and null for any other kind.
    There is no title: titles live on the page. */
export function buildHandoffV2({ record, revision, made, madeOn, commit, id, main = {}, onPicture, suggestions, reels = [], session }) {
  const kind = kindOf(record);
  const inSession = kind === "session";
  const drawn = (kind === "raw" || kind === "short video") && Array.isArray(onPicture) && onPicture.length > 0;
  const name = record && record.name ? record.name.text : undefined;
  const video = (record && record.video) || {};
  const out = {
    format: FORMAT,
    version: VERSION_2,
    revision,
    made,
    madeOn,
    madeBy: `brimm-video ${commit}`,
    video: { id, kind, name, recorded: video.recorded, recordedFrom: video.recordedFrom }
  };
  if (!inSession) out.main = { ...pick(main, ["file", "seconds", "srt"]), ...(drawn ? { onPicture: [...onPicture] } : {}) };
  if ((kind === "finished" || kind === "raw") && Array.isArray(suggestions) && suggestions.length > 0) out.suggestions = suggestions.map(suggestionOf);
  if (kind !== "short video") out.reels = Array.isArray(reels) ? reels.map((r) => reelOf(r, inSession)) : reels;
  out.session = inSession ? sessionOf(session) : null;
  return out;
}

/** The words brimm-video draws on a video's main picture, as its record asks for them (`main.onPicture`): the lines of the main
    video's name titles (`record.main.texts`), in the order they come on screen, and those of one asked for first when two
    start together. A line of no words is left out. The record is not changed. buildHandoffV2 writes them only for a raw or
    short video, since brimm-video does not draw on a finished video's picture or a session's. */
export function onPictureOf(record) {
  const texts = record && record.main && Array.isArray(record.main.texts) ? record.main.texts : [];
  return [...texts].sort((a, b) => a.at - b.at).flatMap((t) => (Array.isArray(t.lines) ? t.lines : [])).filter(text);
}

/** The suggestion a made Reel was made from (a Reel's `fromSuggestion`), by the Reel as the record holds it: what the Reel
    says, a suggestion's number or null, when it says; and otherwise its own number, since every Reel a record holds without
    saying is one of Claude's suggestions, picked, which keeps the suggestion's number. */
export const fromSuggestionOf = (reel) => (has(reel, "fromSuggestion") ? reel.fromSuggestion : reel.n);

/** How many of a suggestion's words, in 100, the final video must keep for the suggestion to be kept (spec section 8). */
const KEPT_IN_100 = 70;
/** How many words `first` and `last` hold when the suggestion did not say. */
const OPENING_WORDS = 4;
/** A time to the hundredth of a second, as inMain (handoff.js) gives its times: a sum such as 4.35 * 100 comes to 434.99999…,
    which is still 4.35. */
export const hundredths = (t) => Math.round(t * 100 + 1e-6) / 100;

/** A raw video's Reel suggestions on the final main video's clock (spec section 8, "One suggestion shape"). `suggestions` are
    as they are stored, `{ n, start, end, stretches, first, last, why, point }` in seconds of the raw video, and `words` the
    recording's words, `{ w, start, end }` in the same seconds (heardWords, clock.js, when a word is to start as it is said, not
    where the word before it ended). `clock` is the final main video's, its kept pieces as clockOf or clockOfRanges give them,
    and `seconds` how long its file is, which the clock's own length is when it is not given.
    - A suggestion's words are those of `words` that end in one of its stretches (keptWords, clock.js); a word is kept when it
      ends in a piece of the clock, and a kept word is where the clock puts it. A word that starts in what is cut starts where
      its piece does.
    - A suggestion is kept when at least 70 in 100 of its words are kept, and left out otherwise, and when it has no word at all.
    - Its `start` and `end` are those of its first and last kept words, and its `first` and `last` are those words, as many as
      the suggestion's own held (four when it held none): what it opens and closes with now.
    - Its `stretches` are its runs of kept words, and only a word of its own that the clock cuts breaks a run, so that no kept
      word lies between two of its stretches, as the page was told.
    - Times are to the hundredth of a second and kept within the main video, as inMain's are. One that would not then be a
      stretch of the video, a suggestion or a stretch of it with no length, leaves the suggestion out: the hand-off's check
      (handoffFaultV2) refuses it.
    Its number, its reason and its point are as they were, and nothing else of it is carried. What it is given is not changed. */
export function suggestionsOnClock({ suggestions, words, clock, seconds = lengthOf(clock) }) {
  const length = hundredths(seconds);
  const opening = (said) => String(said ?? "").split(/\s+/).filter(Boolean).length || OPENING_WORDS;
  const out = [];
  for (const s of suggestions) {
    const stretches = Array.isArray(s.stretches) && s.stretches.length > 0 ? s.stretches : [{ start: s.start, end: s.end }];
    // Each of its words as it is on the clock, or null where the clock cuts it.
    const placed = keptWords(words, stretches).map((word) => {
      const piece = clock.find((p) => word.end > p.from && word.end <= p.to);
      return piece ? { w: word.w, start: hundredths(timelineAt(clock, Math.max(word.start, piece.from))), end: Math.min(hundredths(timelineAt(clock, word.end)), length) } : null;
    });
    const kept = placed.filter(Boolean);
    if (kept.length === 0 || kept.length * 100 < placed.length * KEPT_IN_100) continue;
    const runs = [];
    placed.forEach((word, i) => {
      if (!word) return;
      if (i > 0 && placed[i - 1]) runs[runs.length - 1].end = word.end;
      else runs.push({ start: word.start, end: word.end });
    });
    if (!runs.every((t) => t.end > t.start)) continue;
    out.push({
      ...pick(s, ["n"]),
      start: runs[0].start,
      end: runs[runs.length - 1].end,
      stretches: runs,
      first: kept.slice(0, opening(s.first)).map((word) => word.w).join(" "),
      last: kept.slice(-opening(s.last)).map((word) => word.w).join(" "),
      ...pick(s, ["why", "point"])
    });
  }
  return out;
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v) => typeof v === "string" && v.trim() !== "";
const number = (v) => typeof v === "number" && Number.isFinite(v);
const seconds = (v) => number(v) && v > 0;
const whole = (v) => Number.isInteger(v) && v >= 1;
const strings = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");
/** A day, as 2026-10-23, that the calendar has: not 2026-02-30. */
const day = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const at = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().startsWith(v);
};
/** Captions the BRIMM Ops page can read: tidyTranscript, the page's own reader, makes lines of them. */
const captions = (srt) => text(srt) && /-->/.test(srt) && tidyTranscript(srt).startsWith("[");
/** The first key `o` holds that the contract does not name, as words, or "". */
const unknown = (who, o, keys) => {
  const k = Object.keys(o).find((key) => !keys.includes(key));
  return k === undefined ? "" : `${who} holds "${k}", which the contract does not name.`;
};

/** What is wrong with a hand-off, in plain words, or "" when nothing is. The first fault found is the one given. A session's
    hand-off may hold no key that the contract does not name, since the page refuses it for one; the other kinds' are held to
    the same, since only this writer makes them. */
export function handoffFaultV2(h) {
  if (!isObject(h) || h.format !== FORMAT) return `It is not a ${FORMAT}.`;
  if (h.version !== VERSION_2) return `It is version ${h.version}, and this reads version ${VERSION_2}.`;
  if (!Number.isInteger(h.revision) || h.revision < 1) return "Its revision is not a whole number from 1.";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(h.made))) return "The time it was made is not a local time with its offset.";
  if (!text(h.madeOn) || !/^brimm-video \S+$/.test(String(h.madeBy))) return "It does not say which Mac and which brimm-video made it.";

  const v = h.video;
  if (!isObject(v)) return "It has no video.";
  if (!/^e-\d{8}-[0-9a-f]{6}$/.test(String(v.id))) return "The video's id is not an id brimm-video gives.";
  if (!KINDS.includes(v.kind)) return "The video's kind is none of finished, raw, session or short video.";
  if (has(v, "title")) return "A video has no title in it: titles live on the BRIMM Ops page.";
  if (!text(v.name)) return "The video has no name.";
  if (!day(v.recorded) || !["video", "import"].includes(v.recordedFrom)) return "The day it was recorded, or where that day was read from, is missing.";
  const fault = unknown("The video", v, VIDEO);
  if (fault) return fault;
  const kind = v.kind;

  if (kind === "session") {
    if (has(h, "main")) return "A session's hand-off has no main video: it holds no transcript of the session.";
    if (has(h, "suggestions")) return "A session's hand-off has no suggestions.";
  }
  if (kind === "short video") {
    if (has(h, "suggestions")) return "A short video's hand-off has no suggestions.";
    if (has(h, "reels")) return "A short video has no Reels.";
  }
  const top = unknown("The hand-off", h, TOP);
  if (top) return top;

  let length = 0;
  if (kind !== "session") {
    const m = h.main;
    if (!isObject(m)) return "It has no main video.";
    if (!text(m.file) || !seconds(m.seconds)) return "The main video has no file or no length.";
    if (!captions(m.srt)) return "The main video's captions cannot be read.";
    if (has(m, "onPicture")) {
      if (kind === "finished") return "A finished video's main video has no words on its picture (onPicture): the page refuses them.";
      if (Array.isArray(m.onPicture) && m.onPicture.length === 0) return "The main video's onPicture is an empty list: it is left out when no words are drawn on the picture.";
      if (!Array.isArray(m.onPicture) || !m.onPicture.every(text)) return "The main video's onPicture is not a list of the words drawn on its picture.";
    }
    const extra = unknown("The main video", m, MAIN);
    if (extra) return extra;
    length = m.seconds;
  }
  /** Is this a stretch of the main video? A suggestion's times are held to what the page agreed (spec section 8, "Suggestion
      times"): 0 <= start < end <= main.seconds + 0.01, and its stretches in order, none over another, the first starting
      where it starts and the last ending where it ends, which puts each inside start and end. */
  const within = (start, end) => number(start) && number(end) && start >= 0 && end > start && end <= length + 0.01;

  if (has(h, "suggestions")) {
    if (!Array.isArray(h.suggestions)) return "Its suggestions are not a list.";
    const seen = new Set();
    for (const s of h.suggestions) {
      if (!isObject(s) || !whole(s.n)) return "A suggestion's number is not a whole number from 1.";
      const which = `Suggestion ${s.n}`;
      if (seen.has(s.n)) return `${which} is in it twice.`;
      seen.add(s.n);
      for (const [key, what] of SUGGESTION_WORDS) if (!text(s[key])) return `${which} has no ${what}.`;
      if (!within(s.start, s.end)) return `${which}'s times are not a stretch of the main video.`;
      const parts = s.stretches;
      if (!Array.isArray(parts) || parts.length === 0 || !parts.every((t) => isObject(t) && within(t.start, t.end)) || parts.some((t, i) => i > 0 && t.start < parts[i - 1].end)) return `${which}'s stretches are not kept stretches of the main video, in order.`;
      if (parts[0].start !== s.start || parts[parts.length - 1].end !== s.end) return `${which}'s stretches do not run from its start to its end.`;
      if (kind === "finished" && parts.length !== 1) return `A finished video's suggestion is one stretch of it, and ${which} is ${parts.length}.`;
      for (const t of parts) {
        const extra = unknown(`${which}'s stretch`, t, STRETCH);
        if (extra) return extra;
      }
      const extra = unknown(which, s, SUGGESTION);
      if (extra) return extra;
    }
  }

  if (kind !== "short video") {
    if (!Array.isArray(h.reels)) return "Its Reels are not a list.";
    /** The numbers of the suggestions that are listed, which only a Reel made from one may hold. */
    const listed = new Set(Array.isArray(h.suggestions) ? h.suggestions.map((s) => s.n) : []);
    const seen = new Set();
    for (const r of h.reels) {
      if (!isObject(r) || !whole(r.n)) return "A Reel's number is not a whole number from 1.";
      const which = `Reel ${r.n}`;
      if (seen.has(r.n)) return `${which} is in it twice.`;
      seen.add(r.n);
      if (kind !== "session" && has(r, "clientAgreed")) return `${which} holds clientAgreed, which only a session's Reels have.`;
      if (typeof r.title !== "string") return `${which} has no title: it may be empty, but it must be there.`;
      if (!text(r.file) || !seconds(r.seconds)) return `${which} has no file or no length.`;
      if (!captions(r.srt)) return `${which}'s captions cannot be read.`;
      if (!has(r, "fromSuggestion") || (r.fromSuggestion !== null && !whole(r.fromSuggestion))) return `${which}'s fromSuggestion is neither a suggestion's number nor null.`;
      if (kind === "session") {
        if (r.fromSuggestion !== null) return `${which}'s fromSuggestion is not null: a session has no suggestions.`;
      } else if (r.fromSuggestion !== null) {
        // A Reel made from a suggestion takes its number. The suggestion itself may be gone: a later reading may leave it out.
        if (r.fromSuggestion !== r.n) return `${which} says it was made from suggestion ${r.fromSuggestion}, but a Reel made from a suggestion takes its number.`;
      } else if (listed.has(r.n)) {
        return `${which} says it was made from times she gave, but suggestion ${r.n} has its number: a Reel made from times she gave has a fresh number.`;
      }
      if (kind === "session") {
        if (!has(r, "clientAgreed")) return `${which} has no clientAgreed: a session's Reel is made only once the client's agreement is noted, as a date.`;
        if (!day(r.clientAgreed)) return `${which}'s clientAgreed is not a date written like 2026-10-23: the day the agreement was noted, never who.`;
      } else if (has(r, "inMain")) {
        if (!isObject(r.inMain) || !within(r.inMain.start, r.inMain.end)) return `${which}'s place in the main video is not a stretch of it.`;
        const extra = unknown(`${which}'s place in the main video`, r.inMain, STRETCH);
        if (extra) return extra;
      }
      const extra = unknown(which, r, kind === "session" ? SESSION_REEL : REEL);
      if (extra) return extra;
    }
  }

  if (kind !== "session") {
    if (!has(h, "session")) return "It has no session: that is null unless the video is a session.";
    if (h.session !== null) return "Only a session holds session items, and this video is not one.";
    return "";
  }
  const s = h.session;
  if (!isObject(s)) return "A session's hand-off holds no session items: its session is not filled.";
  for (const list of SESSION) if (!Array.isArray(s[list])) return `The session's ${list} are not a list.`;
  const extra = unknown("The session", s, SESSION);
  if (extra) return extra;

  const principles = new Set();
  for (const p of s.principles) {
    if (!isObject(p) || !whole(p.n)) return "A principle's number is not a whole number from 1.";
    const which = `Principle ${p.n}`;
    if (principles.has(p.n)) return `${which} is in it twice.`;
    principles.add(p.n);
    if (has(p, "source_context")) return `${which} holds "source_context", which stays out of the hand-off: it describes the session, for her eyes only.`;
    if (!text(p.name)) return `${which} has no name.`;
    // Any field but its number and name is left out of the file when the name check took it out (spec 2026-10-22, section 8),
    // and the page reads a missing text as "": each is held to its kind only when it is there.
    for (const key of ["category", "description", "example_application"]) if (has(p, key) && typeof p[key] !== "string") return `${which}'s ${key} is not text.`;
    for (const key of LISTS) if (has(p, key) && !strings(p[key])) return `${which}'s ${key} is not a list of text.`;
    const more = unknown(which, p, PRINCIPLE);
    if (more) return more;
  }
  const recurring = new Set();
  for (const p of s.recurringPrinciples) {
    if (!isObject(p) || !whole(p.n)) return "A recurring principle's number is not a whole number from 1.";
    const which = `Recurring principle ${p.n}`;
    if (recurring.has(p.n)) return `${which} is in it twice.`;
    recurring.add(p.n);
    if (!text(p.text)) return `${which} has no text.`;
    const more = unknown(which, p, RECURRING);
    if (more) return more;
  }
  const films = new Set();
  for (const p of s.reelsToFilm) {
    if (!isObject(p) || !whole(p.n)) return "A Reel idea's number is not a whole number from 1.";
    const which = `Reel idea ${p.n}`;
    if (films.has(p.n)) return `${which} is in it twice.`;
    films.add(p.n);
    if (!text(p.idea)) return `${which} has no idea.`;
    // Its words and why are left out when the name check took them out, as a principle's fields are: held to their kind only
    // when they are there. Its idea and its principle (a number, or null) are always there.
    if (has(p, "words") && !text(p.words)) return `${which} has no words to say: they are left out when there are none.`;
    if (has(p, "why") && typeof p.why !== "string") return `${which}'s reason (why) is not text.`;
    if (p.principle !== null && !whole(p.principle)) return `${which}'s principle is neither a principle's number nor null.`;
    if (p.principle !== null && !principles.has(p.principle)) return `${which} names principle ${p.principle}, which is not in it.`;
    const more = unknown(which, p, FILM);
    if (more) return more;
  }
  return "";
}
