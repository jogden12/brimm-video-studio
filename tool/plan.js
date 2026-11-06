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
// edit.js is only the wiring (plan); this module says what the command says, and does what it does. Its first half is pure: the words a
// command is given go in, and the package, the problems with it and the three files' texts come out. What it says goes into her chat, so
// it holds no path and no flag. The problems with a package are said to Claude, who corrects the words it gave: a line that says a | in a
// cue is written %7C is for Claude. Nothing here posts, sends or publishes anything, and no cue is built: a cue is built only when she takes
// it, in the app (design 3).
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { countWords, localDay } from "./shared/text.js";
import { SHOT_LIST_KINDS, acceptRev, isFromPlan, isPlannedRecord, localStamp, newId, newPlannedEpisode, readEpisode, shownName, undone, writeEpisode } from "./episode.js";
import { GRAPHIC_CUE_KINDS, SHOT_KINDS, graphicCuesOf } from "./graphic-cues.js";
import { findReference } from "./references.js";
import { referencesFolder, runsFolder } from "./settings.js";
import { episodeFolderName } from "./names.js";
import { textWriter } from "./dropbox.js";
import { commitOf, thisCheckout } from "./filing.js";
import { agreedFor, labelOf, partLine, partsOf as footageParts } from "./footage.js";
import { joinFor } from "./join.js";
import { voiceFor } from "./explainer.js";
import { SHOT_SAID, counted, dayText, joined, number, plainly, sentence, teleprompterText, textArg } from "./sentences.js";

// The helpers that say things in her chat stand in sentences.js, where footage.js reads them too; they are said from here as they always were.
export { SHOT_LIST_KINDS, SHOT_SAID, counted, dayText, joined, plainly, sentence, textArg };

/** What a plan may hold (design 5, PR H4): 60 cues, 40 shots and 400 lines of the teleprompter script, of at most 2,000 characters each; a
    title of at most 80 characters. A cue's words are those graphic-cues.js holds (30 words, 200 characters) and what it shows its 300; a
    shot's text is held to the same 300. */
const MOST = { cues: 60, shots: 40, lines: 400, line: 2000, title: 80, words: 30, wordChars: 200, show: 300, what: 300 };
/** How many words of the teleprompter script a minute holds, as a person reads aloud. */
const WORDS_A_MINUTE = 150;
/** The files of a package, by their names in the episode's folder. An explainer has no shot list. */
const GUIDE_FILE = "video guide.md";
const SHOT_LIST_FILE = "shot list.md";
const TELEPROMPTER_FILE = "teleprompter.txt";
/** The keys a cue's last parts may have: the shot it shows, and its style (graphic-cues.js holds at most one of the three). */
const KEYS = ["shot", "ref", "inspiration", "link"];

// --- The words of a command ---

/** A text on one line, trimmed: its white space, line breaks included, is a single space. */
const oneLine = (text) => text.replace(/\s+/g, " ").trim();
/** A text's length as a person counts it: in characters, an emoji being one. */
const length = (text) => Array.from(text).length;
/** The first letter of a text in capitals. */
const capital = (text) => text[0].toUpperCase() + text.slice(1);

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

/** What a cue of each kind that shows footage shows. */
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
    [TELEPROMPTER_FILE]: teleprompterText(plan.lines)
  };
}

/** The plan's files as a record makes them: `packageFiles` of its `planned`, headed by the name the record shows, and an explainer
    without a shot list. `{}` for a plan whose package was never set (`planned.set` is null), which has no files. Resolving a conflict
    writes these for the side she keeps. */
export function planFilesFrom(record) {
  const { planned } = record;
  if (planned.set === null) return {};
  const title = record.name && typeof record.name.text === "string" && record.name.text ? record.name.text : planned.title;
  return packageFiles(title, planned, { explainer: planned.route === "explainer" });
}

/** The names of the files a plan keeps, which a record's `files` lists with their sizes. */
export const PLAN_FILE_NAMES = [GUIDE_FILE, SHOT_LIST_FILE, TELEPROMPTER_FILE];

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


// --- The command ---

/** What `plan` is told, from the words after the command and its flags (edit.js flagsOf gives them, with --cue, --shot, --line and --voice
    taking a value each time they are given): { form: "new", title, explainer, voice }, { form: "show", episode }, { form: "set", episode, cues,
    shots, lines }, { form: "drop", episode }, (PR H6) { form: "voice", episode } (a HeyGen voice is done; no more words, no flag), (PR H5a) { form: "agreed", episode, video } or (PR H5b) { form: "join", episode, videos }; or null for
    anything else, which is the help. `new` is followed by the title, one word in quotes. A flag no form has is none. The episode is one word, as every
    command has it. A `set` gives at least one cue, shot or line. `agreed` is followed by the video, one word, and takes no flag. `join` is followed by
    the talking parts in the order she wants them, each one word, and by none when she has not said an order; it takes no flag. */
export function planAsked(words, flags) {
  const [first, second, ...more] = words;
  const only = (...allowed) => Object.keys(flags).every((flag) => allowed.includes(flag));
  const said = (word) => typeof word === "string" && word.trim() !== "";
  if (first === "new") {
    if (!said(second) || more.length || !only("explainer", "voice")) return null;
    return { form: "new", title: second, explainer: flags.explainer === true, voice: flags.voice === undefined ? null : flags.voice[flags.voice.length - 1] };
  }
  if (said(first) && second === "agreed") return more.length === 1 && said(more[0]) && only() ? { form: "agreed", episode: first, video: more[0] } : null;
  if (said(first) && second === "join") return more.every(said) && only() ? { form: "join", episode: first, videos: more } : null;
  if (said(first) && second === "voice") return more.length === 0 && only() ? { form: "voice", episode: first } : null;
  if (!said(first) || more.length) return null;
  if (second === undefined) return only() ? { form: "show", episode: first } : null;
  if (second === "drop") return only() ? { form: "drop", episode: first } : null;
  if (second !== "set" || !only("cue", "shot", "line")) return null;
  const [cues, shots, lines] = ["cue", "shot", "line"].map((flag) => flags[flag] ?? []);
  return cues.length + shots.length + lines.length ? { form: "set", episode: first, cues, shots, lines } : null;
}

const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};

/** What a plan is made of, as it is said: its guide, its shot list (a script's alone) and its teleprompter script. */
const madeOf = (explainer) => joined(["its guide", ...(explainer ? [] : ["its shot list"]), "its teleprompter script"]);

/** The programs and folders the rule is given on this Mac, as edit.js gives them to every command that writes. */
const ruleOpts = (ctx) => ({ ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) });
const writerOf = (ctx) => ({ commit: ctx.deps.commit || commitOf(thisCheckout()), on: ctx.machine });
/** A folder of this Mac's own that a command makes its files in before they are put into Dropbox, and takes away. */
const workOf = (ctx) => join(runsFolder(ctx.home), `plan-${process.pid}-${ctx.now()}`);

/** Why a record could not be written, in plain words with no path. */
const notWritten = (e) => {
  if (e.code === "CHANGED") return "this plan changed on the other Mac: say it again";
  if (e.code === "CONFLICTED") return "Dropbox has kept a conflicted copy of it: ask Jason";
  if (e.code === "NEWER") return "Jason has a newer brimm-video. Ask him to update this Mac";
  return `it could not be written (${e.code || "an error"})`;
};

/** The planned video that already has this title: the name it is found by, or "" when there is none. A plan that is dropped, or has been
    filmed (PR H5), is none: only a plan waiting for its footage is. A conflicted episode is read as it lies past its copies. */
function plannedWith(ctx, title) {
  let names = [];
  try {
    names = readdirSync(ctx.episodes).filter((name) => !name.startsWith("."));
  } catch (e) {
    return "";
  }
  for (const name of names) {
    const { record } = readEpisode(join(ctx.episodes, name), { pastCopies: true });
    if (isPlannedRecord(record) && !record.archived && record.planned.filmed === null && [record.planned.title, shownName(record)].some((known) => plainly(known) === plainly(title))) return shownName(record);
  }
  return "";
}

/** `plan new "<title>" [--explainer [--voice sallie|heygen]]`: a planned episode, filed in Episodes as `<day> <title> (<Mac>)` by the import's
    rule for a folder's name (names.js episodeFolderName), with only its first record. Ends with 0, or with 1, having said why and written
    nothing: a voice without --explainer, a voice that is neither, a title over 80 characters, or a title already planned and not yet
    filmed. The title's escapes are turned (textArg), so a title can hold a dollar sign or a quote. */
export function newPlan(ctx, { title: given, explainer, voice }) {
  const title = oneLine(textArg(given));
  if (voice !== null && !explainer) return refuse(ctx, "A voice is only for an explainer.");
  if (voice !== null && !["sallie", "heygen"].includes(voice)) return refuse(ctx, `A voice is Sallie's own ("sallie") or a HeyGen voice ("heygen").`);
  if (length(title) > MOST.title) return refuse(ctx, `A title is at most ${MOST.title} characters, and that is ${length(title)}.`);
  const same = plannedWith(ctx, title);
  if (same) return refuse(ctx, `There's a planned video called "${same}" already. Say "show me the plan for ${same}".`);
  const now = new Date(ctx.now());
  const day = ctx.deps.today ? ctx.deps.today() : localDay(now);
  let names = [];
  try {
    names = readdirSync(ctx.episodes);
  } catch (e) {
    // There is no Episodes yet: it is made below.
  }
  const folder = join(ctx.episodes, episodeFolderName(names, day, title, ctx.machine));
  const record = newPlannedEpisode({ id: newId(day, ctx.deps.rand), machine: ctx.machine, at: localStamp(now), title, route: explainer ? "explainer" : "script", voice, writer: writerOf(ctx) });
  // The folder is made here, and a name already taken is never used: making it without `recursive` fails on one.
  try {
    mkdirSync(ctx.episodes, { recursive: true });
    mkdirSync(folder);
  } catch (e) {
    return refuse(ctx, `Nothing was saved: ${notWritten(e)}.`);
  }
  const work = workOf(ctx);
  try {
    writeEpisode(folder, record, { expectRev: 0, writeText: textWriter({ work, ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home });
  } catch (e) {
    // The folder this command made, with no record in it, is no plan: it is taken away, so that nothing is left that looks like an import that stopped.
    rmSync(folder, { recursive: true, force: true });
    return refuse(ctx, `Nothing was saved: ${notWritten(e)}.`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  ctx.say(`"${title}" is planned. Next: ${madeOf(explainer)}.`);
  return 0;
}

/** The record `found` holds, written as its next record, or why not: 0 when written, 1 when not, having said why. A change Dropbox took away
    is said, as every command that writes the record says it. `before` is what is done between the checks and the record, with the work folder
    the files are made in: the package's files, which go in before the record. */
function writeNext(ctx, found, record, next, before = () => {}) {
  const gone = undone(record, ctx.home);
  if (gone) {
    ctx.say(`${gone} Nothing was saved.`);
    acceptRev(ctx.home, record.id, record.rev);
    return 1;
  }
  const work = workOf(ctx);
  try {
    before(work);
    writeEpisode(found.folder, next, { expectRev: record.rev, writeText: textWriter({ work: join(work, "record"), ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home });
  } catch (e) {
    return refuse(ctx, `Nothing was saved: ${notWritten(e)}.`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return 0;
}

/** Which file of the reference folder a style's picture is, for packageOf: { file }, or { why } in words that say what there is. */
function pictureIn(folder, said) {
  const found = findReference(folder, said);
  if (found.file) return { file: found.file };
  if (found.several) return { why: `which one is "${said}" in the reference folder? ${joined(found.several, "or")}` };
  return { why: found.pictures.length ? `there is no "${said}" in the reference folder, which has ${joined(found.pictures)}` : `there is no "${said}" in the reference folder, which has no pictures yet` };
}

/** `plan "<planned>" set …`: the whole package replaced, in one record write. Every entry is read first (packageOf): when any cannot be used,
    each problem is said on its own line, then "Nothing was saved.", and nothing is written, with 1. A ref is looked up in the reference folder.
    Otherwise the three files go into the plan's folder by the rule, each replacing the one there (dropbox.js textWriter, `replace`) and no
    other file touched, and the record last, with the rev it was read at, holding the package and the files' sizes. Says the plan is saved
    and how long its teleprompter script is. */
function setPlan(ctx, { found, record }, { cues, shots, lines }) {
  const explainer = record.planned.route === "explainer";
  const folder = referencesFolder(ctx.root);
  const { plan, problems } = packageOf({ cues, shots, lines }, { explainer, ref: (said) => pictureIn(folder, said) });
  if (problems.length) {
    for (const problem of problems) ctx.say(problem);
    ctx.say("Nothing was saved.");
    return 1;
  }
  const title = shownName(record);
  const texts = packageFiles(title, plan, { explainer });
  const sizes = Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, Buffer.byteLength(text)]));
  const files = Object.fromEntries(Object.entries(record.files).filter(([name]) => ![GUIDE_FILE, SHOT_LIST_FILE, TELEPROMPTER_FILE].includes(name)));
  const next = { ...record, planned: { ...record.planned, set: localStamp(new Date(ctx.now())), ...plan }, files: { ...files, ...sizes } };
  const code = writeNext(ctx, found, record, next, (work) => {
    const put = textWriter({ work, ...ruleOpts(ctx) });
    for (const [name, text] of Object.entries(texts)) put(join(found.folder, name), text, { replace: true });
  });
  if (code === 0) ctx.say(savedLine(title, plan, { explainer }));
  return code;
}

/** `plan "<planned>"`: the plan in plain words. A plan whose package is not set yet says what is still to be made. Its footage (PR H5a) is said
    after it, a line for each part, in the order they were answered (footage.js partLine); a plan with none says what it always did. */
function showPlan(ctx, { record }) {
  const { planned } = record;
  const explainer = planned.route === "explainer";
  const title = shownName(record);
  if (planned.set === null) ctx.say(`"${title}" is planned, and ${madeOf(explainer)} aren't made yet.`);
  else for (const line of planLines(title, planned, { explainer, voice: planned.voice })) ctx.say(line);
  for (const part of footageParts(ctx.root, record.id)) ctx.say(partLine(part, planned));
  return 0;
}

/** `plan "<planned>" drop`: the plan archived as an episode is (`archived`), so that `episodes` and the guide no longer show it. Its files stay
    in its folder. A plan that has footage (PR H5b, ruling 2) is not dropped before the join: its pieces are listed by no list but the plan's own, so a
    drop would leave her footage unlisted. It is refused, writing nothing, naming each piece by its label, and she takes each back first. */
function dropPlan(ctx, { found, record }) {
  const title = shownName(record);
  const parts = footageParts(ctx.root, record.id, { newer: true });
  if (parts.length) return refuse(ctx, `"${title}" has footage: ${parts.map(labelOf).join(", ")}. To drop it, first say "that's not footage for ${title}" for each.`);
  const code = writeNext(ctx, found, record, { ...record, archived: { at: localStamp(new Date(ctx.now())) } });
  if (code === 0) ctx.say(`The plan for "${title}" is dropped.`);
  return code;
}

/** `plan "<planned>" …` once edit.js has found the episode `got` (its gate has run): the plan shown, set or dropped, a client's agreement to a part
    noted (PR H5a; footage.js agreedFor, which edit.js has the plan's answer lock held for, and gives the `kit` of its own), or (PR H5b) all its
    footage said to be in (join.js joinFor). An episode that is not a planned video is told so, and a plan that was dropped is told so; neither is
    changed. A video made from a plan (episode.js isFromPlan) shows its plan and notes a client's agreement as a plan does, and is told that it is
    made from its footage already for `set`, `drop` and `join`: its plan can't be changed. Ends with 0, or 1, having said why; a promise of it, for
    an agreement, which waits for her click. */
export function planFor(ctx, got, asked, kit) {
  const { record } = got;
  const made = isFromPlan(record);
  if (!isPlannedRecord(record) && !made) return refuse(ctx, `"${shownName(record)}" is not a planned video.`);
  if (record.archived) return refuse(ctx, `The plan for "${shownName(record)}" was dropped.`);
  if (asked.form === "voice") return voiceFor(ctx, got, kit);
  if (made && asked.form === "join") return refuse(ctx, `"${shownName(record)}" is made from its footage already.`);
  if (made && (asked.form === "set" || asked.form === "drop")) return refuse(ctx, `"${shownName(record)}" is made from its footage already: its plan can't be changed.`);
  if (asked.form === "set") return setPlan(ctx, got, asked);
  if (asked.form === "agreed") return agreedFor(ctx, got, asked, kit);
  if (asked.form === "join") return joinFor(ctx, got, asked, kit);
  return asked.form === "drop" ? dropPlan(ctx, got) : showPlan(ctx, got);
}
