// A client or group session's teachings, as edit.js, reading.js and finish.js share them (spec 2026-10-22, sections 2, 3 and 8):
// the training gate's words and the account Jason checked; the names brimm-video can see in a session (sessions.js
// visibleNames), from what is on this Mac; the session's teachings file, which its reading writes; and the items in it with
// what she decided of each, which the record keeps. sessions.js is the pure part; this reads the episode's folder, and writes
// nothing.
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { replaceSpeakers, visibleNames, namesSkipped, holdsName, NOT_NAMES, PUBLIC_NAMES } from "./sessions.js";
import { SHOW, HOST } from "./shared/show.js";
import { spellNames } from "./lib.js";
import { teachingsOn, teachingsLapsed } from "./settings.js";
import { TEACHINGS_OFF, TEACHINGS_LAPSED } from "./gate.js";
import { recordFile, recordNumbers, kindOf, shownName } from "./episode.js";
import { fileSafe } from "./names.js";

/** What the session's teachings file says it is. */
export const TEACHINGS_FORMAT = "brimm-video teachings";
/** The lists of a session's items, as her chat names an item of each and a number of them. */
export const ITEM_LISTS = [
  ["principles", "principle", "principles"],
  ["recurringPrinciples", "recurring principle", "recurring principles"],
  ["reelIdeas", "Reel idea", "Reel ideas"]
];
/** What is said when the claude command on this Mac is signed in to another account than the one Jason checked, or cannot say. */
export const OTHER_ACCOUNT = "The claude command on this Mac is signed in to another account than the one Jason checked: ask Jason.";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);

/** Why this Mac's training gate does not let a session's teachings be read now, in plain words, or "": off (never turned on, or
    turned on later than now, as a clock set back says), or lapsed, 90 days or more after Jason turned it on. */
export function teachingsWhy(settings, now) {
  if (teachingsOn(settings, now)) return "";
  return teachingsLapsed(settings, now) ? TEACHINGS_LAPSED : TEACHINGS_OFF;
}

/** An account as `claude auth status` gives it (reading.js accountOf), or as Jason recorded it: "<email> (<organisation>)", or
    the email alone. Its email and organisation, in lowercase. */
function accountParts(account) {
  const m = /^(.*?)(?:\s*\(([^()]*)\))?$/.exec(String(account ?? "").trim());
  return { email: (m[1] || "").trim().toLowerCase(), org: (m[2] || "").trim().toLowerCase() };
}

/** Whether the account the claude command is signed in to `now` is the one Jason `checked`: the same email, whatever its case,
    and, when he recorded an organisation, the same one. One that cannot be read ("") is never his. */
export function sameAccount(now, checked) {
  const a = accountParts(now);
  const b = accountParts(checked);
  return a.email !== "" && a.email === b.email && (b.org === "" || a.org === b.org);
}

/** Why the claude command's account `now` may not read a session on this Mac: OTHER_ACCOUNT, or "" when it is the one Jason
    checked for the claude command (the settings' `sessionTeachings.accounts.cli`). */
export const accountWhy = (now, settings) => (sameAccount(now, settings?.sessionTeachings?.accounts?.cli) ? "" : OTHER_ACCOUNT);

/** The files a session's reading writes, named by the session's name as everything made from it is (spec 2, "The session
    mark"): its label, or the name she gave it since, which `name` checked. Never the video's file's name: shownName gives the
    label for a name that is still the file's. */
export function teachingsFiles(record) {
  const stem = fileSafe(shownName(record));
  return { json: `${stem}.principles.json`, txt: `${stem}.principles.txt`, ideas: `${stem}.reel-ideas.txt` };
}

/** The teachings files an earlier reading of the session wrote, which a reading made again sets aside: by the teachings file the
    record's reading names, and the two copies beside it. None when it has no reading of its teachings. */
export function earlierTeachings(record) {
  const r = record && record.reading;
  const file = isObject(r) && r.kind === "session" && typeof r.principles === "string" ? r.principles : "";
  if (!file.endsWith(".principles.json") || file.includes("/")) return [];
  const stem = file.slice(0, -".principles.json".length);
  return [`${stem}.principles.json`, `${stem}.principles.txt`, `${stem}.reel-ideas.txt`];
}

/** Whether `rel` names a teachings file as a reading writes one: `<name>.principles.json`, in the episode's own folder. */
export const isTeachingsName = (rel) => typeof rel === "string" && rel.length > ".principles.json".length && rel.endsWith(".principles.json") && !/[/\\]/.test(rel) && !rel.startsWith(".");

/** The reading of a session that counts, as the record holds it: one made as a session, after her answer, which names its
    teachings file (`principles`); or null. */
export function sessionReading(record) {
  const r = record && record.reading;
  if (!isObject(r) || r.kind !== "session" || typeof r.principles !== "string" || r.principles === "") return null;
  // A reading before her answer was of another kind of video, whatever it says: and a time that cannot be read is not after.
  const answered = isObject(record.answer) ? Date.parse(record.answer.at) : NaN;
  return Date.parse(r.at) >= answered ? r : null;
}

/** Zoom's own names for the transcript it saves of a meeting on the computer: a person gave none of their words. */
const ZOOM_FIXED = ["meeting_saved_closed_caption.txt", "closed_caption.txt"];
/** The meeting's own transcripts in the episode, as its record lists them: a WebVTT file, or Zoom's saved transcript, in the
    episode's own folder. A session imported from one file has none. */
export const meetingTranscripts = (record) => Object.keys((record && record.files) || {}).filter((rel) => !rel.includes("/") && (/\.vtt$/i.test(rel) || ZOOM_FIXED.includes(rel.toLowerCase()))).sort();

/** The import's cut plan of a video, by its file's stem: the words a reading is made of. */
export const planOf = (record) => `${basename(record.video.file, extname(record.video.file))}.cut-plan.json`;

/** A session's label, as kinds.js sessionLabel makes it: "Session, 2026-10-22", and " (2)" after it for a second that day. It
    holds no one's name. */
export const SESSION_LABEL = /^Session, \d{4}-\d{2}-\d{2}(?: \(\d+\))?$/;

/** The most characters a session's name may have: its teachings files and its hand-off are named by it, and a file's name is
    at most 255 bytes on a Mac. */
export const SESSION_NAME_MOST = 100;

/** A name as the name of a file is compared with one, whatever its case, its accents and its punctuation: its letters and
    figures alone, in lowercase. */
const fileKey = (text) => String(text ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Whether `text` is the name of the video's file, or its name without its ending, in any case or form: "quillon marsh",
    "Quillon-Marsh.MP4" and "QuillonMarsh" are "Quillon Marsh.mp4"'s. A session's name is never its file's (spec 2, "The session
    mark"). */
export function isFilesName(text, record) {
  // A video named as its session's label is ("Session 2026-10-20.mp4"): the label is still the session's to have.
  if (SESSION_LABEL.test(String(text ?? "").trim())) return false;
  const file = String((record && record.video && record.video.file) || "");
  const key = fileKey(text);
  return key !== "" && file !== "" && [file, basename(file, extname(file))].some((name) => fileKey(name) === key);
}

/** A text's letters alone, in lowercase and without accents: what a name of several words is compared as when joined. */
const lettersOf = (text) => String(text ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}]+/gu, "");

/** The first word of words she gave, a session's name or what she changed of an item, that is a name brimm-video can see, as
    she wrote it ("quillon", "Quillon", "quillonmarsh"), or "" when none is. `hers` is sessionSeen's: her words are read as hers
    and not as Claude's prose. They are split at every mark that is not a letter or a figure ("quillon.marsh" is "quillon" and
    "marsh"; a mark no one sees, as a soft hyphen, splits nothing), and each word is also read without a plain plural or
    possessive ending ("s", "'s", "’s", "s'"). A word is one of
    `hers.strict` whatever its case (as if written with a capital), and one of `hers.lenient` only with its capital, as
    sessions.js holdsName reads Claude's prose: those are the words the transcript writes with a capital mid-sentence and says in
    lowercase too, which are ordinary words ("Reels" and "reels"). A name of several words (`hers.joined`, letters only) counts
    joined, in any case ("quillonmarsh", "@QuillonMarsh"). `hers` is required: without it, it throws. */
export function herWordsName(text, hers) {
  // Without the names to check against, every word would pass: a caller that does not give them is a mistake, and fails here.
  if (!isObject(hers) || ![hers.strict, hers.lenient, hers.joined].every(Array.isArray)) throw new Error("herWordsName needs the names it checks against: sessionSeen's `hers`.");
  const { strict, lenient, joined } = hers;
  if (typeof text !== "string") return "";
  const capital = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const all = [...strict, ...lenient];
  // A mark no one sees (a soft hyphen, a zero-width space) splits no word.
  const tokens = text.normalize("NFKC").replace(/\p{Cf}/gu, "").split(/[^\p{L}\p{M}\p{N}'’]+/u).filter(Boolean);
  for (const token of tokens) {
    const bare = [token.replace(/['’]s$/i, ""), ...token.split(/['’]/), token];
    const forms = [...new Set([...bare, ...bare.map((w) => w.replace(/s$/i, ""))])].filter((w) => /\p{L}/u.test(w));
    const hit = forms.find((w) => holdsName(w, all) || holdsName(capital(w), strict));
    if (hit) return hit;
    if (joined.some((name) => lettersOf(token).includes(name))) return token.replace(/['’]s$/i, "");
  }
  // A joined name her words split at a mark of their own: "quillon.marsh" is caught above, word by word.
  return joined.find((name) => lettersOf(text).includes(name)) || "";
}

/** The words of the record's spellings, both sides of each, as names: a spelling she gave may be a client's name, and none
    leaves a word out for a session (fail closed). The words that are nobody's name in sessions.js, and the show's own names
    and the host's, are not taken: a spelling of hers ("Sally" as "Sallie") makes no name of them. */
function spellingNames(spellings) {
  const nobody = new Set([...NOT_NAMES, ...PUBLIC_NAMES, ...[SHOW, HOST, "The BRIMM"].flatMap((n) => n.toLowerCase().split(/[^\p{L}]+/u))]);
  const sides = list(spellings).flatMap((pair) => (Array.isArray(pair) ? pair.slice(0, 2) : []));
  // A side that is the show's own name as the transcriber hears it (lib.js spellNames: "Sally" is "Sallie") is no one's either.
  return sides.flatMap((side) => String(side ?? "").normalize("NFKC").match(/[\p{L}\p{M}]{2,}/gu) || []).filter((w) => !nobody.has(w.toLowerCase()) && !nobody.has(spellNames(w).toLowerCase()));
}

/** The names a session's words are checked against when they are hers (herWordsName), from all of `names` (sessionSeen's):
    { strict, lenient, joined }. A name the transcript writes with a capital mid-sentence and also says in lowercase (or its plain
    plural or singular) is an ordinary word, `lenient`, unless a name of another place holds it too: a speaker brimm-video
    replaced, the name of a file, a name she gave before, a spelling (`sources`, their texts). Every other name is `strict`.
    `joined` is each run of two or more names side by side in one of `sources`, or written with a capital side by side in the
    transcript (`said`) with at least one name of the run strict, letters only, in lowercase ("quillonmarsh"): ordinary words
    side by side ("Your Brand Voice", said in lowercase too) are no one's name joined. */
function hersOf(names, { said, sources }) {
  const lower = new Set((said.normalize("NFKC").match(/[\p{L}\p{M}'’]+/gu) || []).filter((w) => /^\p{Ll}/u.test(w)).map((w) => w.replace(/['’]s$/i, "").toLowerCase()));
  const elsewhere = new Set(sources.flatMap((text) => String(text ?? "").normalize("NFKC").toLowerCase().match(/[\p{L}\p{M}]+/gu) || []));
  const ordinary = (name) => {
    const n = name.toLowerCase();
    return /^\p{Lu}/u.test(name) && !elsewhere.has(n) && [n, `${n}s`, n.replace(/s$/, "")].some((form) => lower.has(form));
  };
  const known = new Set(names.map((n) => n.toLowerCase()));
  const lenient = new Set(names.filter(ordinary).map((n) => n.toLowerCase()));
  const joined = new Set();
  /** Every run of two or more of `words` side by side for which `takes` is true, joined, when `counts` takes the run: each
      `{ w, ends }`, where `ends` says a run stops after it. */
  const runsOf = (words, takes, counts = () => true) => {
    let run = [];
    for (const word of [...words, null]) {
      if (word && takes(word.w)) run.push(word.w);
      if (!word || !takes(word.w) || word.ends) {
        for (let i = 0; i < run.length; i++) {
          for (let j = i + 2; j <= run.length; j++) if (counts(run.slice(i, j))) joined.add(lettersOf(run.slice(i, j).join("")));
        }
        run = [];
      }
    }
  };
  // In a speaker's label, a file's name, a name she gave or a spelling, names side by side in any case.
  for (const text of sources) runsOf((String(text ?? "").normalize("NFKC").match(/[\p{L}\p{M}]+/gu) || []).map((w) => ({ w, ends: false })), (w) => known.has(w.toLowerCase()));
  // In the transcript, names it writes with a capital side by side ("my client Quillon Marsh asked"), a run stopping at a mark
  // that ends a sentence or a clause. These are for `joined` alone: they make no name strict. A run counts only when one of its
  // names is strict: "Your Brand Voice", whose words it says in lowercase too, is ordinary words side by side, while "Quillon
  // Marsh" stays joined though "marsh" is said in lowercase too.
  const spoken = said.normalize("NFKC").split(/\s+/).filter(Boolean).map((token) => ({ w: token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").replace(/['’]s$/i, ""), ends: /[.,;:!?…)\]"”]$/u.test(token) }));
  runsOf(spoken, (w) => /^\p{Lu}/u.test(w) && known.has(w.toLowerCase()), (run) => run.some((w) => !lenient.has(w.toLowerCase())));
  return { strict: names.filter((n) => !ordinary(n)), lenient: names.filter(ordinary), joined: [...joined] };
}

/** The files of the episode that the names brimm-video can see in a session are read from: its plan, and the meeting's own
    transcripts. Each must be whole on this Mac first. */
export const seenFrom = (record) => [planOf(record), ...meetingTranscripts(record)];

/** The names a person gave the video before it was a session, by every record of it in its record folder: a name not still its
    file's, from a record that was no session. A record that cannot be read is passed over. */
function givenNames(folder, record) {
  const names = [];
  for (const n of recordNumbers(folder)) {
    try {
      const r = JSON.parse(readFileSync(recordFile(folder, n), "utf8"));
      const text = isObject(r) && isObject(r.name) && typeof r.name.text === "string" ? r.name.text : "";
      if (text && r.name.placeholder === false && kindOf(r) !== "session" && !r.session && text !== shownName(record)) names.push(text);
    } catch (e) {
      // It says nothing of a name.
    }
  }
  return [...new Set(names)];
}

/** What brimm-video can see of the session in `folder` whose record is `record`, from its files on this Mac (seenFrom, each
    whole: the caller sees to that): { names, speakers, skipped, plan }, or { why } when one cannot be read.
    - `speakers` is the meeting's own transcript with every speaker but her replaced (sessions.js replaceSpeakers, her name the
      settings' `host`, or the show's host's full name, HOST, which fails closed: a label of her first name alone is a
      participant's), only when one was replaced: undefined otherwise, as for a session of one file, so that no speaker labels
      go to Claude in a form not recognised;
    - `names` the names it can see (visibleNames): the speakers it replaced, the names a person gave its files (the video she
      dropped, a meeting transcript named for the meeting, names given before it was a session), and the words its plan's
      phrases write with a capital mid-sentence; and the words of the record's spellings, both sides (spellingNames). No spelling
      leaves a word out for a session;
    - `hers` the same names as her own words are checked against them (hersOf, herWordsName);
    - `skipped` the line saying its capitalised words were not checked, or "" (namesSkipped);
    - `plan` the cut plan, read. */
export function sessionSeen(folder, record, { host } = {}) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(join(folder, planOf(record)), "utf8"));
    if (!isObject(plan) || !Array.isArray(plan.phrases) || !Array.isArray(plan.ranges)) throw new Error("it is not a cut plan this tool wrote");
  } catch (e) {
    return { why: `its cut plan cannot be read (${e instanceof SyntaxError ? "it is not JSON" : e.code || e.message})` };
  }
  const meetings = meetingTranscripts(record);
  let zoom = "";
  try {
    zoom = meetings.map((rel) => readFileSync(join(folder, rel), "utf8")).join("\n\n");
  } catch (e) {
    return { why: `the meeting's own transcript cannot be read (${e.code || e.message})` };
  }
  const replaced = meetings.length ? replaceSpeakers(zoom, typeof host === "string" && host.trim() ? host : HOST) : { text: "", map: {} };
  const words = list(plan.phrases).map((p) => String((p && p.text) ?? "")).join(" ");
  // Zoom's fixed names are no person's: their lowercase words would match a field's words in any case.
  const fileName = [record.video.file, ...meetings.filter((rel) => !ZOOM_FIXED.includes(rel.toLowerCase())), ...givenNames(folder, record)];
  const seen = visibleNames({ map: replaced.map, fileName, words, spellings: [] });
  const known = new Set(seen.map((n) => n.toLowerCase()));
  const spelled = spellingNames(record.spellings).filter((w) => !known.has(w.toLowerCase()) && Boolean(known.add(w.toLowerCase())));
  const names = [...seen, ...spelled];
  const sources = [...Object.keys(replaced.map), ...fileName, ...list(record.spellings).flatMap((pair) => (Array.isArray(pair) ? pair.slice(0, 2) : []))];
  return {
    names,
    hers: hersOf(names, { said: words, sources }),
    speakers: Object.keys(replaced.map).length ? replaced.text : undefined,
    skipped: namesSkipped(words),
    plan
  };
}

/** The session's teachings, as its reading wrote them, from the episode in `folder`: { teachings, rel }; { none: true } when it
    has no reading of its teachings yet (sessionReading); { coming: rel } when the file is not whole on this Mac (`whole`); or
    { why } when it cannot be read. */
export function readTeachings(folder, record, whole) {
  const reading = sessionReading(record);
  if (!reading) return { none: true };
  const rel = reading.principles;
  // Only a teachings file in the episode's own folder, as a reading writes it, is read.
  if (!isTeachingsName(rel)) return { why: "its reading names no teachings file a reading writes" };
  if (!whole(join(folder, rel))) return { coming: rel };
  try {
    const teachings = JSON.parse(readFileSync(join(folder, rel), "utf8"));
    if (!isObject(teachings) || teachings.format !== TEACHINGS_FORMAT) throw new Error("it is not what a reading writes");
    return { teachings, rel };
  } catch (e) {
    return { why: e instanceof SyntaxError ? "it is not JSON" : e.code || e.message };
  }
}

/** The items of a session's teachings with what she decided of each and what she changed, as the record keeps them
    (`session.decided`, `session.edits`): { principles, recurringPrinciples, reelIdeas }, each item as the reading wrote it, with
    her changes laid over it, and `approved` true for one she kept, false for one she dropped, and none while it is undecided:
    as sessions.js approve and approvedSession take them. Only the record decides: an `approved` the teachings file holds is not
    hers, and is left out. Nothing given is changed. */
export function itemsOf(teachings, session) {
  const decided = (isObject(session) && isObject(session.decided) && session.decided) || {};
  const edits = (isObject(session) && isObject(session.edits) && session.edits) || {};
  const out = {};
  for (const [key] of ITEM_LISTS) {
    out[key] = list(teachings && teachings[key]).filter(isObject).map(({ approved, ...item }) => {
      const n = String(item.n);
      const said = isObject(decided[key]) ? decided[key][n] : undefined;
      const changed = isObject(edits[key]) && isObject(edits[key][n]) ? edits[key][n] : {};
      return { ...item, ...changed, ...(said === "kept" || said === "dropped" ? { approved: said === "kept" } : {}) };
    });
  }
  return out;
}

/** The line her chat and the teachings files say above what Claude read (spec 2026-10-22, section 3). */
export const CHECK_NAMES = "brimm-video took out the names it could see. Check these for anything about the client.";
/** What marks a principle's source_context, which describes the session: for her eyes only, never in the hand-off (spec 3). */
const FOR_HER = "(for you only: not sent to the page)";
/** What stands for a text the name check took out. */
const TAKEN = "(taken out)";
const textOr = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : TAKEN);
/** A text as a sentence: with a full stop, unless it ends as a sentence does already. */
const sentence = (t) => (/[.!?…]["'”’)\]]*$/.test(t) ? t : `${t}.`);
/** A list of texts on one line, or "none". */
const listOr = (v) => (Array.isArray(v) && v.length ? v.join("; ") : Array.isArray(v) ? "none" : TAKEN);
const quotedOr = (v) => (Array.isArray(v) && v.length ? v.map((p) => `"${p}"`).join("; ") : "none");
const after = (status) => (status ? ` ${status}` : "");

/** A principle as she reads it, its example and key phrases first: its head, with `status` after it, and one line for each field.
    A text the name check took out is "(taken out)". */
export function principleLines(p, status = "") {
  const category = typeof p.category === "string" && p.category.trim() ? ` (${p.category.trim()})` : "";
  return [
    `Principle ${p.n}: ${sentence(`${textOr(p.name)}${category}`)}${after(status)}`,
    `  Example: ${textOr(p.example_application)}`,
    `  Key phrases: ${quotedOr(p.verbatim_key_phrases)}`,
    `  What it says: ${textOr(p.description)}`,
    `  Steps: ${listOr(p.steps)}`,
    `  Red flags: ${listOr(p.red_flags)}`,
    `  Green flags: ${listOr(p.green_flags)}`,
    `  What decides it: ${listOr(p.decision_criteria)}`,
    `  Where it came up ${FOR_HER}: ${textOr(p.source_context)}`
  ];
}

/** A recurring principle as she reads it, on one line. */
export const recurringLine = (r, status = "") => `Recurring principle ${r.n}: ${sentence(textOr(r.text))}${after(status)}`;

/** A Reel idea as she reads it: whether it is filmed again or cut from the session, the principle it shows, and its words. */
export function ideaLines(r, status = "") {
  const how = r.refilm === true ? "To film again" : "To cut from the session, once the client agrees";
  const shows = Number.isInteger(r.principle) ? `; it shows principle ${r.principle}` : "";
  return [`Reel idea ${r.n}: ${sentence(textOr(r.idea))} ${how}${shows}.${after(status)}`, `  Words: ${textOr(r.words)}`, `  Why: ${textOr(r.why)}`];
}

/** What the name check took out of a list's items, each "Taken out: <field>: <why>.", by the field's words: never a name. */
export const takenLines = (dropped, starts) => (Array.isArray(dropped) ? dropped : []).filter((d) => starts.some((w) => String(d.field).startsWith(w))).map((d) => `Taken out: ${d.field}: ${d.why}.`);

/** The teachings files a session's reading writes for her to read beside the session, `<name>.principles.txt` and
    `<name>.reel-ideas.txt`: a convenience copy of what the teachings file holds. Nothing in them is decided: she decides in her
    chat. */
function fileText(head, teachings, body, starts) {
  const problems = Array.isArray(teachings.problems) ? teachings.problems : [];
  return [
    [head, "Claude could not see or hear the session, and nothing in this is decided yet: you decide each item in your chat.", CHECK_NAMES, ...takenLines(teachings.dropped, starts), ...(teachings.skipped ? [teachings.skipped] : [])].join("\n"),
    ...body,
    ...(problems.length ? [["What could not be used from its reply:", ...problems.map((p) => `- ${p}`)].join("\n")] : [])
  ].join("\n\n") + "\n";
}
export function teachingsText(name, day, teachings) {
  const principles = (teachings.principles || []).map((p) => principleLines(p).join("\n"));
  const recurring = (teachings.recurringPrinciples || []).map((r) => recurringLine(r));
  return fileText(`The principles of ${name}, from Claude's reading of it on ${day}.`, teachings, [...(principles.length ? principles : ["Claude found no principles in it."]), ["Recurring principles:", ...(recurring.length ? recurring : ["None."])].join("\n")], ["Principle", "Recurring principle"]);
}
export function ideasText(name, day, teachings) {
  const ideas = (teachings.reelIdeas || []).map((r) => ideaLines(r).join("\n"));
  return fileText(`The Reel ideas of ${name}, from Claude's reading of it on ${day}.`, teachings, ideas.length ? ideas : ["Claude found no Reel ideas in it."], ["Reel idea"]);
}
