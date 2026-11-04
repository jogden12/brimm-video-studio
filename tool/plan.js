// The planned episode's package (design 2026-11-03, sections 5 and 6; PR H4): Sallie brings her script into her BRIMM Video Studio chat,
// and Claude works it with her into three things, which Studio saves as a planned episode before any footage exists:
//   - the video guide: the graphic cues (graphic-cues.js), each tied to the words of her script it goes with;
//   - the shot list: each shot she needs to film, as talking to the camera, a screen recording or b-roll;
//   - the teleprompter script: her words alone, laid out to read from, with no cue in them.
// A planned episode is an episode with no video and no kind (episode.js newPlannedEpisode), filed in Episodes/ with only its record. Each
// `plan … set` replaces the whole package in one record write; its three files, video guide.md, shot list.md (none for an explainer, a
// video of graphics and words alone) and teleprompter.txt, are put in its folder by the rule (dropbox.js): made in a folder of this Mac's
// own, cloned in under their names, a file there deleted first and never written over, and the record last, with the rev it was read at.
// The files are for a person to read; the record holds the package, and the project made of the footage (PR H5) is made from the record.
//
// This part is pure: the words a command is given go in, and the package, the problems with it and the three files' texts come out. What it
// says goes into her chat, so it holds no path and no flag. The problems with a package are said to Claude, who corrects the words it gave: a
// line that says a | in a cue is written %7C is for Claude. Nothing here posts, sends or publishes anything, and no cue is built: a cue is built
// only when she takes it, in the app (design 3).
import { countWords } from "./shared/text.js";
import { SHOT_LIST_KINDS } from "./episode.js";
import { GRAPHIC_CUE_KINDS, SHOT_KINDS, graphicCuesOf } from "./graphic-cues.js";

export { SHOT_LIST_KINDS };

/** What a plan may hold (design 5, PR H4): 60 cues, 40 shots and 400 lines of the teleprompter script, of at most 2,000 characters each; a
    title of at most 80 characters. A cue's words are those graphic-cues.js holds (30 words, 200 characters) and what it shows its 300; a
    shot's text is held to the same 300. */
const MOST = { cues: 60, shots: 40, lines: 400, line: 2000, title: 80, words: 30, wordChars: 200, show: 300, what: 300 };
/** How many words of the teleprompter script a minute holds, as a person reads aloud. */
const WORDS_A_MINUTE = 150;
/** The files of a package, by their names in the episode's folder. An explainer has no shot list. */
export const GUIDE_FILE = "video guide.md";
export const SHOT_LIST_FILE = "shot list.md";
export const TELEPROMPTER_FILE = "teleprompter.txt";
/** The keys a cue's last parts may have: the shot it shows, and its style (graphic-cues.js holds at most one of the three). */
const KEYS = ["shot", "ref", "inspiration", "link"];

// --- The words of a command ---

/** The six marks a command's words cannot carry through the shell and the cue format, written as a % and two hex digits in either case:
    %22 is a double quote, %24 a dollar sign, %25 a percent sign, %5C a backslash, %60 a backtick and %7C a pipe, which splits a cue's
    parts. Nothing else is turned: a % with any other letters after it, or none, such as "100% sure", is a % as it stands. */
const ESCAPES = { 22: '"', 24: "$", 25: "%", "5c": "\\", 60: "`", "7c": "|" };
/** A command's word with its six escapes turned, once, from left to right: "%2522" is "%22", the text of a percent sign and "22". */
export const textArg = (word) => String(word ?? "").replace(/%(22|24|25|5c|60|7c)/gi, (_, code) => ESCAPES[code.toLowerCase()]);

/** A text on one line, trimmed: its white space, line breaks included, is a single space. */
const oneLine = (text) => text.replace(/\s+/g, " ").trim();
/** A text's length as a person counts it: in characters, an emoji being one. */
const length = (text) => Array.from(text).length;
/** A whole number, with its thousands in commas. */
const number = (n) => n.toLocaleString("en-US");
/** Some things in a row: "a", "a and b", "a, b and c"; with `word` "or", "a or b". */
const joined = (things, word = "and") => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} ${word} ${things[things.length - 1]}`);
/** A count with its noun. */
const counted = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`;
/** The first letter of a text in capitals. */
const capital = (text) => text[0].toUpperCase() + text.slice(1);
/** A text as a sentence: it ends with a stop, a question or an exclamation mark, or a full stop is put there. */
const sentence = (text) => (/[.!?…]["”']?$/.test(text) ? text : `${text}.`);

// --- Reading a package out of the words a command is given ---

/** The parts of a cue or a shot as it is given, "<kind> | <seconds> | <words> | <what to show>[ | <key>: <value>]…": split at each |, and
    then each part's escapes are turned, so that a | written %7C stays in its part. Each part is trimmed. */
const partsOf = (given) => String(given ?? "").split("|").map((part) => textArg(part).trim());

/** Whether a text is an https link, as graphic-cues.js holds a cue's link: one a person can follow, with a host and no white space. */
function secureLink(text) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname !== "" && !/\s/.test(text);
  } catch (e) {
    return false;
  }
}
/** Whether a text is the name of a file, and not a path to one: a cue's ref names a file in the reference folder. */
const fileName = (text) => !/[\\/\u0000-\u001f]/.test(text) && !text.startsWith(".");

/** How a shot is said where a cue names it, and what a cue of each kind that shows footage shows. */
const SHOT_SAID = { talking: "talking to the camera", screen: "a screen recording", "b-roll": "b-roll" };
const FOOTAGE_SAID = { "b-roll": "b-roll", screen: "a screen recording" };
/** A part that is not a key and a value, as it is quoted in what is said of it: its first 30 characters. */
const quoted = (part) => `"${length(part) > 30 ? `${Array.from(part).slice(0, 30).join("")}…` : part}"`;

/** One `--cue` as the entry graphic-cues.js is given, or why it cannot be one: { entry } or { whys }. `shotKinds` are the kinds of the
    shots in the list, in order (null for a shot that is itself no shot), which a cue that shows footage names; `ref(said)` gives { file }
    or { why } for a style that names a picture, and is not asked when no way is given. Every problem of the cue is said, each its own. */
function readCue(given, { explainer, shotKinds, ref }) {
  const parts = partsOf(given);
  if (parts.length < 4) return { whys: ["it needs four parts: its kind, its seconds, its words and what it shows"] };
  const [kindGiven, secondsGiven, wordsGiven, showGiven, ...keyed] = parts;
  const whys = [];
  const kinds = explainer ? SHOT_KINDS : GRAPHIC_CUE_KINDS;
  const kind = kindGiven.toLowerCase();
  const kindOk = kinds.includes(kind);
  if (!kindOk) whys.push(explainer && GRAPHIC_CUE_KINDS.includes(kind) ? `an explainer shows graphics and words on screen only, so a ${kind} cue is not one` : `"${kindGiven}" is not a kind of cue: use ${joined(kinds, "or")}`);
  const words = oneLine(wordsGiven);
  if (!words) whys.push("it has no words");
  else if (words.split(" ").length > MOST.words) whys.push(`its words are ${words.split(" ").length} words, and at most ${MOST.words} can be used`);
  else if (length(words) > MOST.wordChars) whys.push(`its words are ${length(words)} characters, and at most ${MOST.wordChars} can be used`);
  const show = oneLine(showGiven);
  if (!show) whys.push("it shows nothing");
  else if (length(show) > MOST.show) whys.push(`what it shows is ${length(show)} characters, and at most ${MOST.show} can be used`);
  // The keys: the shot it shows, and one style.
  let shot;
  let style = null;
  let shotNamed = false;
  let styles = 0;
  let shotWhy = "";
  keyed.forEach((part, k) => {
    // A key is one word before a colon. Anything else is a piece of the text that a bare | cut off.
    const at = part.indexOf(":");
    const key = at < 0 ? "" : part.slice(0, at).trim().toLowerCase();
    const value = at < 0 ? "" : part.slice(at + 1).trim();
    if (!/^[a-z]+$/.test(key)) {
      whys.push(`part ${k + 5} (${quoted(part)}) is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C`);
      return;
    }
    if (!KEYS.includes(key)) {
      whys.push(`"${part.slice(0, at).trim()}" is not a key: use ${joined(KEYS, "or")}`);
      return;
    }
    if (key === "shot") {
      if (shotNamed) {
        if (!shotWhy) shotWhy = "it names more than one shot";
        return;
      }
      shotNamed = true;
      if (/^[1-9]\d*$/.test(value)) shot = Number(value);
      else shotWhy = "its shot is not a number from 1";
      return;
    }
    if (!value) {
      whys.push(`its ${key} is empty`);
      return;
    }
    styles += 1;
    if (styles > 1) return;
    if (key === "link" && !secureLink(value)) whys.push("its link must be an https link");
    else if (key === "ref" && !fileName(value)) whys.push("its ref must be the name of a file in the reference folder, with no folder in it");
    else if (key === "ref" && ref) {
      const found = ref(value);
      if (found.file) style = { ref: found.file };
      else whys.push(found.why);
    } else style = { [key]: value };
  });
  if (styles > 1) whys.push("it has more than one style: use one of ref, inspiration or link");
  if (shotWhy) whys.push(shotWhy);
  else if (kindOk && shotNamed) {
    if (!FOOTAGE_SAID[kind]) whys.push(`a ${kind} cue shows no footage, so it has no shot`);
    else if (shot > shotKinds.length) whys.push(`there is no shot ${shot} in the shot list, which has ${shotKinds.length || "none"}`);
    else if (shotKinds[shot - 1] !== null && shotKinds[shot - 1] !== kind) whys.push(`shot ${shot} is ${SHOT_SAID[shotKinds[shot - 1]]}, and a ${kind} cue shows ${FOOTAGE_SAID[kind]}`);
  } else if (kindOk && FOOTAGE_SAID[kind]) {
    const first = shotKinds.indexOf(kind);
    whys.push(first < 0 ? `a ${kind} cue needs a ${kind === "screen" ? "screen recording" : "b-roll"} shot in the shot list, and it has none` : `a ${kind} cue needs the number of the shot it shows, as "shot: ${first + 1}"`);
  }
  if (whys.length) return { whys };
  const seconds = secondsGiven === "" ? Number.NaN : Number(secondsGiven);
  return { entry: { kind, seconds, words, show, style, ...(shot ? { shot } : {}) } };
}

/** One `--shot`, "<kind> | <what>", as a shot without its number, or why it cannot be one: { shot } or { whys }. */
function readShot(given, { explainer }) {
  if (explainer) return { whys: ["an explainer has no shots"] };
  const parts = partsOf(given);
  if (parts.length !== 2) return { whys: ["it needs two parts: its kind and what it is. If a | belongs to what it is, write it as %7C"] };
  const kind = parts[0].toLowerCase();
  const what = oneLine(parts[1]);
  const whys = [];
  if (!SHOT_LIST_KINDS.includes(kind)) whys.push(`"${parts[0]}" is not a kind of shot: use ${joined(SHOT_LIST_KINDS, "or")}`);
  if (!what) whys.push("it says nothing of what it is");
  else if (length(what) > MOST.what) whys.push(`what it is runs to ${length(what)} characters, and at most ${MOST.what} can be used`);
  return whys.length ? { whys, kind: SHOT_LIST_KINDS.includes(kind) ? kind : null } : { shot: { kind, what }, kind };
}

/** The package of a plan out of the words a command is given, `cues` (each "<kind> | <seconds> | <words> | <what to show>[ | <key>: <value>]…"),
    `shots` ("<kind> | <what>") and `lines` (her words, a paragraph each), all as given, escapes unturned: { plan, problems }. `plan` is { cues,
    shots, lines }, the cues as graphic-cues.js holds them (numbered from 1 in the order given, with a `shot` for a cue that shows footage) and
    the shots as { n, kind, what }; it is null when any entry cannot be used. `problems` are the lines that say so, one for each problem of
    each entry, as "Cue 3 can't be used: <why>.", "Shot 2 can't be used: <why>." and "Line 12 can't be used: <why>.", the cues' first, then
    the shots' and the lines', each entry numbered by its place in the words given. A script's cue is any of the four kinds, and one that shows
    b-roll or a screen recording names a shot of its own kind; an explainer's is a graphic or words on screen, and it has no shots. Nothing
    is cut: a cue's words and what it shows are checked against the limits graphic-cues.js holds them to before they are given to it, which
    would cut what runs over. `ref(said)`, when it is given, says which file in the reference folder a style's picture is: { file } or { why }. */
export function packageOf({ cues = [], shots = [], lines = [] }, { explainer = false, ref } = {}) {
  const problems = [];
  const said = (what, i, whys) => whys.forEach((why) => problems.push(`${what} ${i + 1} can't be used: ${why}.`));
  // The shots first, since a cue that shows footage names one.
  const readShots = shots.map((given, i) => (i >= MOST.shots && !explainer ? { whys: [`a plan has at most ${MOST.shots} shots`] } : readShot(given, { explainer })));
  const shotKinds = readShots.map((read) => read.kind ?? null);
  const readCues = cues.map((given, i) => (i >= MOST.cues ? { whys: [`a plan has at most ${MOST.cues} cues`] } : readCue(given, { explainer, shotKinds, ref })));
  readCues.forEach((read, i) => said("Cue", i, read.whys ?? []));
  readShots.forEach((read, i) => said("Shot", i, read.whys ?? []));
  const texts = lines.map((given) => textArg(given).trim());
  texts.forEach((text, i) => {
    if (i >= MOST.lines) said("Line", i, [`a plan has at most ${MOST.lines} lines`]);
    else if (!text) said("Line", i, ["it is empty"]);
    else if (length(text) > MOST.line) said("Line", i, [`it is ${number(length(text))} characters, and at most ${number(MOST.line)} can be used`]);
  });
  if (problems.length) return { plan: null, problems };
  // Every entry is whole: graphic-cues.js numbers the cues and holds them as it holds a reading's.
  const made = graphicCuesOf(readCues.map((read) => read.entry), { kinds: explainer ? SHOT_KINDS : GRAPHIC_CUE_KINDS, most: MOST.cues });
  made.problems.forEach((problem, i) => problems.push(`Cue ${Number(/\d+/.exec(problem)[0])} can't be used: it could not be read.`));
  if (problems.length) return { plan: null, problems };
  return { plan: { cues: made.cues, shots: readShots.map((read, i) => ({ n: i + 1, ...read.shot })), lines: texts }, problems };
}

// --- What is said of a package, and the files it is kept in ---

/** A cue in the words of the video guide and of the plan: what kind it is and how long it stays, the words it goes with, what it shows, and
    its style or the shot it shows, as "a graphic for 4 seconds, on "too many SKUs": A stack of boxes that keeps growing. Style: blue
    carousel.png." */
const CUE_SAID = { graphic: "a graphic", words: "words on screen", "b-roll": "b-roll", screen: "a screen recording" };
function cueSaid(cue) {
  const style = cue.style === null || cue.style === undefined ? "" : cue.style.ref !== undefined ? ` Style: ${cue.style.ref}.` : cue.style.inspiration !== undefined ? ` Style: the Inspiration video ${cue.style.inspiration}.` : ` Style: ${cue.style.link}.`;
  const shot = Number.isInteger(cue.shot) ? ` From shot ${cue.shot}.` : "";
  return `${CUE_SAID[cue.kind]} for ${cue.seconds} ${cue.seconds === 1 ? "second" : "seconds"}, on "${cue.words}": ${sentence(cue.show)}${style}${shot}`;
}
/** The cues that show a shot, as "For cue 4." or "For cues 1 and 2.", or nothing. */
function usedBy(n, cues) {
  const used = cues.filter((cue) => cue.shot === n).map((cue) => cue.n);
  return used.length ? ` For ${used.length === 1 ? "cue" : "cues"} ${joined(used.map(String))}.` : "";
}

/** A file of a package: its heading, then a blank line and the lines, if there are any, and a newline at the end. */
const listed = (heading, lines) => `${[`# ${heading}`, ...(lines.length ? ["", ...lines] : [])].join("\n")}\n`;

/** The files of a package, by their names, each as its text (design 5, step 2): `video guide.md`, "# <title>: the video guide" and a numbered
    line for each cue in the show's words, with its style; `shot list.md`, "# <title>: the shot list" and a numbered line for each shot, and "For
    cue 4." after a shot a cue shows (none for an explainer, which has no shots); and `teleprompter.txt`, her lines joined by a blank line with a
    newline at the end, and nothing else. */
export function packageFiles(title, plan, { explainer = false } = {}) {
  return {
    [GUIDE_FILE]: listed(`${title}: the video guide`, plan.cues.map((cue) => `${cue.n}. ${capital(cueSaid(cue))}`)),
    ...(explainer ? {} : { [SHOT_LIST_FILE]: listed(`${title}: the shot list`, plan.shots.map((shot) => `${shot.n}. ${capital(SHOT_SAID[shot.kind])}: ${sentence(shot.what)}${usedBy(shot.n, plan.cues)}`)) }),
    [TELEPROMPTER_FILE]: `${plan.lines.join("\n\n")}\n`
  };
}

/** How long the teleprompter script is, as { words, minutes }: its words, and the minutes they take at 150 a minute, rounded and at least 1. */
function scriptLength(plan) {
  const words = plan.lines.reduce((sum, line) => sum + countWords(line), 0);
  return { words, minutes: Math.max(1, Math.round(words / WORDS_A_MINUTE)) };
}
const lengthSaid = ({ words, minutes }) => `${counted(words, "word")}, about ${counted(minutes, "minute")}`;

/** What `plan … set` says once the plan is saved. */
export function savedLine(title, plan, { explainer = false } = {}) {
  const parts = [counted(plan.cues.length, "graphic cue"), ...(explainer ? [] : [counted(plan.shots.length, "shot")]), `a teleprompter script of ${lengthSaid(scriptLength(plan))}`];
  return `The plan for "${title}" is saved: ${joined(parts)}. Its files are in its folder in Episodes.`;
}

/** The plan in plain words, line by line (`plan "<planned>"`): its heading, which says an explainer's voice; each cue, each shot; and the
    teleprompter script's length. */
export function planLines(title, plan, { explainer = false, voice = null } = {}) {
  const who = voice === "sallie" ? " in Sallie's voice" : voice === "heygen" ? " in a HeyGen voice" : "";
  return [
    explainer ? `The plan for "${title}", an explainer${who}:` : `The plan for "${title}":`,
    ...plan.cues.map((cue) => `Cue ${cue.n}, ${cueSaid(cue)}`),
    ...plan.shots.map((shot) => `Shot ${shot.n}, ${SHOT_SAID[shot.kind]}: ${sentence(shot.what)}`),
    `The teleprompter script is ${lengthSaid(scriptLength(plan))}.`
  ];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A day as the record's moment keeps it, as a person says it: "4 November". The day is the one the stamp itself names, where she was. */
const dayText = (at) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(at));
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : String(at);
};

/** What `episodes` says of a planned episode (the record's `planned`), after its two spaces: its name, the day it was planned, what it
    waits for, and its short id. A script waits for its footage, and says how many shots its list has; an explainer waits for its voice. */
export function plannedLine(record) {
  const plan = record.planned;
  const name = typeof record.name?.text === "string" && record.name.text !== "" ? record.name.text : plan.title;
  const id = String(record.id).slice(-6);
  if (plan.route === "explainer") return `"${name}": an explainer planned on ${dayText(plan.at)}, waiting for its ${plan.voice === "heygen" ? "HeyGen voice" : "voiceover"}, id ${id}`;
  const n = plan.shots.length;
  return `"${name}": planned on ${dayText(plan.at)}, waiting for its footage (${n ? counted(n, "shot") : "no shots yet"}), id ${id}`;
}

