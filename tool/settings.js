// This Mac's own settings for episodes: which Mac it is, where BRIMM Video is on it (each Mac reaches Dropbox by a path of its
// own), and where its checkout of brimm-video is. The Claude model is not among them: it is named in unedited.js, so that both
// Macs read a plan with the same one. And
// the folders found from them: in BRIMM Video, this Mac's drop folder, the episodes and the status files of imports; on this
// Mac's own disk, BRIMM Video Work, where Final Cut's work is kept, never in Dropbox.
// The settings are kept in Application Support, on this Mac's own disk. install.sh --machine writes them, through this
// file's command line, and edit.js and the import read them. A write keeps every setting it does not write. Besides those three,
// the switch to the light import has settings of its own, all optional: what is absent is today's way (import "full", readings
// on, hand-off version 1, the drop folder Unedited Video, no teachings from sessions). install.sh --machine writes them as it is
// told (--import, --handoff, --drop, and --rules-only as readings off): `plan` says what `write` would write, and refuses what
// `write` would, before the installer changes anything. A switch of the drop folder is refused while the old folder still holds
// work. That look is switch.js's, which reads the status files and the episodes, and this file reaches it by a dynamic import:
// importing.js and filing.js import this file, and a static import here would make the three a cycle.
//
//   node settings.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"
//                          [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
//   node settings.js plan --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"
//                         [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
//   node settings.js set [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
//   node settings.js sessions --teachings on --cli-account <email> --app-account <email>
//   node settings.js sessions --teachings off
//   node settings.js show
//   node settings.js marker "<drop folder>" "<this Mac>"
//   node settings.js studio --node "<path to node>"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { textWriter } from "./dropbox.js";
import { writeStudio } from "./studio.js";

/** Where this Mac's settings are kept: in Application Support, on its own disk. */
export const settingsFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "settings.json");
/** The folder this Mac watches for videos to import, in BRIMM Video: one for each Mac, so no video is imported twice. It is in
    the folder called Unedited Video until the switch names Drop (the `drop` setting). */
export const dropFolder = (root, machine, folder = "Unedited Video") => join(root, folder, machine);
/** The folder of episodes, in BRIMM Video. No Mac watches it. */
export const episodesFolder = (root) => join(root, "Episodes");
/** The folder of the small status files that say how far each import has got, in Episodes. */
export const importingFolder = (root) => join(episodesFolder(root), ".importing");
/** Where this Mac keeps its work in Final Cut: on its own disk, never in Dropbox. */
export const workFolder = (home) => join(home, "BRIMM Video Work");
/** The one folder Final Cut's Share and File > Export XML… both save into, on this Mac's own disk. */
export const fromFinalCutFolder = (home) => join(workFolder(home), "From Final Cut");
/** Where an import keeps its own folder while it works and until its late check: on the same disk as Dropbox, so its files
    can be cloned in, and not in the temp folder, which macOS may clear before a late check left by a restart is made. */
export const runsFolder = (home) => join(workFolder(home), ".runs");
/** This Mac's folder for one episode: the copies handed to Final Cut, and the episode's library. */
export const episodeWork = (home, folder) => join(workFolder(home), folder);
/** Where the copies of an episode's timelines handed to Final Cut on this Mac are written. */
export const pushedFolder = (home, folder) => join(episodeWork(home, folder), "pushed");
/** This Mac's Final Cut library for one episode, named for the episode's folder. */
export const libraryFor = (home, folder) => join(episodeWork(home, folder), `${folder}.fcpbundle`);
/** Where this Mac notes the last rev it wrote of each episode's record, so it can tell when Dropbox undid one. */
export const writtenFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "written.json");
/** Where this Mac notes when it first saw each video in its drop folder, so that how long one has waited is known whatever
    dates the file itself carries. */
export const seenFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "seen.json");
/** Where this Mac keeps the late checks it has still to make, so a run that is stopped leaves them for the next. */
export const pendingFolder = (home) => join(home, "Library", "Application Support", "BRIMM Video", "pending");

/** What is wrong with a name for a Mac, in plain words: "" when nothing is. The name is the name of the Mac's drop folder, and
    goes into the names of episode folders, so it is a name of 40 characters at most that a folder in Dropbox can carry. */
export function machineFault(name) {
  const text = typeof name === "string" ? name : "";
  if (!text) return "a Mac's name cannot be empty";
  if ([...text].length > 40) return "a Mac's name can be 40 characters long at most";
  if (/\p{Cc}/u.test(text)) return "a Mac's name cannot hold a control character, such as a tab or a line break";
  if (/[/\\:*?"<>|]/.test(text)) return 'a Mac\'s name cannot hold any of / \\ : * ? " < > |';
  if (text !== text.trim()) return "a Mac's name cannot start or end with a space";
  if (text.startsWith(".")) return "a Mac's name cannot start with a dot";
  return "";
}

/** How long Jason's check of the training setting is good for, from the day he turned the teachings on: then he checks again. */
const TEACHINGS_DAYS = 90;

/** Whether `t` is what `node settings.js sessions --teachings on` writes: on, the moment it was turned on as a time with its
    offset, and the two accounts that were checked, each by name. */
function teachingsWhole(t) {
  const account = (a) => typeof a === "string" && a.trim() !== "";
  return (
    Boolean(t) && typeof t === "object" && !Array.isArray(t) && t.on === true &&
    typeof t.at === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(t.at) && Number.isFinite(Date.parse(t.at)) &&
    Boolean(t.accounts) && typeof t.accounts === "object" && account(t.accounts.cli) && account(t.accounts.app)
  );
}

/** What is wrong with this Mac's settings, in plain words: "" when nothing is. The settings of the switch (import, readings,
    handoffVersion, drop and sessionTeachings) need not be there, and are checked when they are. */
export function settingsFault(s) {
  if (!s || typeof s !== "object" || Array.isArray(s) || s.version !== 1) return "they are not version 1 of brimm-video's settings";
  const fault = machineFault(s.machine);
  if (fault) return fault;
  if (typeof s.root !== "string" || !isAbsolute(s.root)) return "the path to BRIMM Video is not a whole path";
  if (typeof s.checkout !== "string" || !isAbsolute(s.checkout)) return "the path to the checkout of brimm-video is not a whole path";
  if (s.import !== undefined && s.import !== "full" && s.import !== "light") return 'the import must be "full" or "light"';
  if (s.readings !== undefined && typeof s.readings !== "boolean") return "readings must be true or false";
  if (s.handoffVersion !== undefined && s.handoffVersion !== 1 && s.handoffVersion !== 2) return "the version of the hand-off must be 1 or 2";
  if (s.drop !== undefined && s.drop !== "Unedited Video" && s.drop !== "Drop") return 'the drop folder must be "Unedited Video" or "Drop"';
  if (s.sessionTeachings !== undefined && s.sessionTeachings !== null && s.sessionTeachings !== false && !teachingsWhole(s.sessionTeachings)) {
    return "the setting for teachings from sessions is neither off (null or false) nor what node settings.js sessions --teachings on writes";
  }
  return "";
}

/** Whether this Mac does the light import, which asks Claude nothing about a video until its person answers. Anything but
    "light" in the import setting, and no setting, is today's import. */
export const lightImport = (s) => s?.import === "light";

/** Whether Claude may read what is taught in a client or group session on this Mac: only when Jason has turned the teachings on
    and it is less than 90 days since. `now` is a time in milliseconds, or a Date. Settings that do not say so (absent, null or
    false), or say so in a way that is not whole, are off. So are settings that were turned on later than now: the clock has
    been set back, or the file is not what Jason wrote, and the 90 days cannot be told. */
export function teachingsOn(s, now = Date.now()) {
  const t = s?.sessionTeachings;
  if (!teachingsWhole(t)) return false;
  const age = Number(now) - Date.parse(t.at);
  return age >= 0 && age < TEACHINGS_DAYS * 24 * 60 * 60 * 1000;
}

/** This Mac's settings, as {settings}, or {why} there are none that can be used, in plain words, and {mend}, what Jason does
    about it, as a sentence. Any field a later version of brimm-video adds is kept as it is. install.sh --machine makes
    settings that are not there and mends a file that is not JSON; it mends a setting that is wrong only when it is told that
    one, with --import, --handoff or --drop; and nothing else in the file. */
function usable(home) {
  const file = settingsFile(home);
  const installer = "Jason runs install.sh --machine on it.";
  let s;
  try {
    s = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return { why: `This Mac has no settings for episodes (${file}).`, mend: installer };
    if (e instanceof SyntaxError) return { why: `This Mac's settings could not be read (${file}: it is not JSON).`, mend: installer };
    return { why: `This Mac's settings could not be read (${file}: ${e.code || e.message}).`, mend: "Jason puts that file right by hand." };
  }
  const fault = settingsFault(s);
  return fault
    ? { why: `This Mac's settings could not be read (${file}: ${fault}).`, mend: "Jason puts that setting right by hand, or runs install.sh --machine on it with --import, --handoff or --drop when it is one of those." }
    : { settings: s };
}

/** This Mac's settings, as {settings}, or {why} there are none that can be used, in plain words. */
export function readSettings(home) {
  const { mend, ...got } = usable(home);
  return got;
}

/** What the settings file holds, as the object it is: {} when there is no file, or what is in it is not JSON, or is JSON that is
    not an object, so that there is nothing in it to keep. Any other trouble with the file is thrown. */
function heldIn(file) {
  try {
    const held = JSON.parse(readFileSync(file, "utf8"));
    return held && typeof held === "object" && !Array.isArray(held) ? held : {};
  } catch (e) {
    if (e.code === "ENOENT" || e instanceof SyntaxError) return {};
    throw e;
  }
}

/** The settings after a write of `fields` over `held`, what the file holds: { settings, fault }, where `fault` is what is wrong
    with them, in plain words, "" when nothing is. A field given as undefined is not given. */
function afterWrite(held, fields) {
  const given = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const merged = { ...held, ...given };
  // The first four in their place, whatever order they were given in; everything else after them.
  const settings = { version: 1, machine: merged.machine, root: merged.root, checkout: merged.checkout, ...merged };
  return { settings, fault: settingsFault(settings) };
}

/** Write this Mac's settings: the ones the file holds, with the fields given put over them, so that a write keeps every field it
    does not write, those a later version of brimm-video adds as well. A field given as undefined is not given. Only a file
    that is not there, or is not JSON, starts from the fields given alone, and then the Mac, the path and the checkout must all
    be given. Settings in the file that will not do, and are not mended by what is given, are not written over: that would lose
    the switch's settings with them. It throws, in plain words, and the file is left as it is. They are written under another
    name first, then under their own: they are on this Mac's own disk, not in Dropbox, so the rename is safe. Gives back the
    file's path. A value that will not do throws, in plain words, and nothing is written. */
export function writeSettings(home, fields) {
  const { settings: s, fault } = afterWrite(heldIn(settingsFile(home)), fields);
  if (fault) throw new Error(fault);
  const file = settingsFile(home);
  const writing = `${file}.writing`;
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(writing, JSON.stringify(s, null, 2) + "\n");
    renameSync(writing, file);
  } catch (e) {
    rmSync(writing, { force: true });
    throw e;
  }
  return file;
}

const HELP = `This Mac's settings for episodes, kept in ~/Library/Application Support/BRIMM Video/settings.json.

  node settings.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"
                               [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
                               write them, as install.sh --machine does, and say where. The settings of the switch that it
                               is told are written with them, as set reads them, and any setting it is not told is kept.
                               It refuses what set refuses, and a switch of the drop folder while the old drop folder
                               still holds a video, or an import of this Mac failed or found a problem: it says which
                               (by label where there is one), and what to do first
  node settings.js plan --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"
                               [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
                               say what write would write, whole, as JSON, but for the emails of the accounts of the
                               teachings from sessions, shown as (not shown), and then the drop folder as it is now and as
                               it will be, a line each, or why it would refuse it. Nothing is written. install.sh asks this
                               before it changes anything
  node settings.js set [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]
                               change the settings of the switch to the light import, and say what changed. Any other
                               setting is kept. It does not change the drop folder: it is switched by the installer, which
                               makes the new folder, marks it and points the import at it, after it has checked the old one
  node settings.js sessions --teachings on --cli-account <email> --app-account <email>
                               record that Jason has checked that the setting letting Anthropic train on chats is off on
                               both accounts that touch a session, the one the claude command is signed in to and the one
                               the Code tab shows, and when. Claude may then read the teachings of a session for 90 days
  node settings.js sessions --teachings off
                               turn the teachings from sessions off
  node settings.js show        say what they are, or why there are none
  node settings.js marker "<drop folder>" "<this Mac>"
                               mark this Mac's drop folder as its own, as install.sh --machine does, by the rule for
                               writing into Dropbox. A folder another Mac has marked is refused
  node settings.js studio --node "<path to node>"
                               write the folder for Claude, ~/BRIMM Video Studio, as install.sh --machine does: its
                               CLAUDE.md, its settings that let Claude run only edit.js, run with that node, its skill and
                               Pictures/`;

/** The options `write` and `plan` are told the settings every Mac has by, and the setting each one names. They are told the
    settings of the switch as `set` is, by SETTABLE's options. */
export const WRITTEN = { "--machine": "machine", "--root": "root", "--checkout": "checkout" };

/** What a command is told, by the name `options` gives each option: null when it is told an option it does not know, or one
    with no value after it. */
function pairsOf(rest, options) {
  const told = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!Object.hasOwn(options, rest[i]) || i + 1 >= rest.length) return null;
    told[options[rest[i]]] = rest[i + 1];
  }
  return told;
}

/** Each option of SETTABLE as `set` has it, by the name `pairsOf` gives what it is told. */
const OF_SET = () => Object.fromEntries(Object.keys(SETTABLE).map((option) => [option, option]));

/** What `write` and `plan` are told, as the fields of the settings: { fields }, or { code, said } when it is asked wrongly (2),
    or refused (1): what `set` refuses it refuses by the same code (notBuilt), and a value that will not do by the same readers. */
function fieldsToldBy(rest) {
  const told = pairsOf(rest, { ...WRITTEN, ...OF_SET() });
  if (!told || told.machine === undefined || told.root === undefined || told.checkout === undefined) return { code: 2, said: HELP };
  const values = {};
  for (const option of Object.keys(SETTABLE).filter((o) => told[o] !== undefined)) {
    values[option] = SETTABLE[option].read(told[option]);
    if (values[option] === undefined) return { code: 1, said: `Not written: ${option} takes ${SETTABLE[option].takes}.` };
  }
  const refused = notBuilt(values);
  if (refused) return { code: 1, said: refused };
  const fields = { machine: told.machine, root: told.root, checkout: told.checkout };
  const fault = settingsFault({ version: 1, ...fields });
  if (fault) return { code: 1, said: `Not written: ${fault}.` };
  for (const [option, value] of Object.entries(values)) fields[SETTABLE[option].field] = value;
  return { fields };
}

/** The settings `write` would write, checked: { settings, fields } (the fields it was told), or { code, said } with the lines it
    refuses by. It refuses what is not built, a value that will not do, and settings that would not do once written, and
    when the drop folder changes, a drop folder that still holds work (switch.js), which it looks at by a dynamic import: so it
    gives back a promise then, and the result itself when it needs no such look. `now` is a time, for the status files. */
function planned(home, rest, now) {
  const told = fieldsToldBy(rest);
  if (!told.fields) return { code: told.code, said: [told.said] };
  let held;
  try {
    held = heldIn(settingsFile(home));
  } catch (e) {
    return { code: 1, said: [`This Mac's settings could not be written (${e.code || e.message}).`] };
  }
  const { settings, fault } = afterWrite(held, told.fields);
  if (fault) return { code: 1, said: [`This Mac's settings could not be written (${fault}).`] };
  // The drop folder is Unedited Video until the file says Drop.
  const from = held.drop === "Drop" ? "Drop" : "Unedited Video";
  const to = settings.drop === "Drop" ? "Drop" : "Unedited Video";
  if (from === to) return { settings, fields: told.fields, from, to };
  const light = lightImport(held) || lightImport(settings);
  // Whatever goes wrong in the look is said by its code alone: an error's message may hold a path, and a path a client's file name.
  return import("./switch.js")
    .then(({ heldInOld }) => {
      const { work, running, problem, problemHere, problemGone, imported, kept, unreadable } = heldInOld({ root: settings.root, machine: settings.machine, old: from, light, home, now: Number(now) });
      if (![work, running, problem, imported, kept, unreadable].some((lines) => lines.length)) return { settings, fields: told.fields, from, to };
      const head = unreadable.length && ![work, running, problem, imported, kept].some((lines) => lines.length) ? "and the old one could not be looked at:" : "and work is not finished in the old one:";
      // Each kind of line is followed by the advice for it alone: what to do about a failed import is not what to do about a late
      // check that found a problem (leave its video where it is), nor about an import at work (wait for it), nor an imported video.
      const kinds = [
        [work, ["Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again."]],
        [running, ["Wait for each of these imports to finish, then run this again: leave the video in the old folder, which its late check needs."]],
        [problem, [
          ...(problemHere ? ["Try each of these again with retry, which makes its late check again from the video in the old folder: leave the video there, and run this again once the check has passed."] : []),
          ...(problemGone ? ["A late check needs its video: where the video is no longer in the old folder, the check cannot be made again, and Jason looks at it."] : [])
        ]],
        [imported, ["A video that is already imported leaves the old folder once its late check has passed: run this again after that."]],
        [kept, ["Delete each of these from the old folder by hand, then run this again."]],
        [unreadable, ["Make each readable (macOS asks whether node may read Dropbox: Allow it), then run this again."]]
      ];
      return {
        code: 1,
        said: [`Not written: the drop folder would change from ${from} to ${to}, ${head}`, ...kinds.flatMap(([lines, advice]) => (lines.length ? [...lines, ...advice] : []))]
      };
    })
    .catch((e) => ({ code: 1, said: [`The old drop folder could not be looked at (${(e && e.code) || "an error"}), so nothing was written.`] }));
}

/** Gives `next(result)`, after the result when it is a promise of one: a command that needs no look at the old drop folder
    ends at once, so that it ends with a number, as the others do. */
const afterwards = (result, next) => (typeof result.then === "function" ? result.then(next) : next(result));

/** `write`: the settings it is told, checked (planned) and then written. Gives the number it ends with, or a promise of it when
    the drop folder changes. */
function write(home, rest, say, now) {
  return afterwards(planned(home, rest, now), (result) => {
    if (!result.fields) {
      for (const line of result.said) say(line);
      return result.code;
    }
    try {
      say(`Written: ${writeSettings(home, result.fields)}`);
      return 0;
    } catch (e) {
      say(`This Mac's settings could not be written (${e.code || e.message}).`);
      return 1;
    }
  });
}

/** `plan`: the settings `write` would write, whole, as JSON (the emails of the accounts of the teachings from sessions shown as
    "(not shown)"), then the drop folder now and as it will be, each on a line of its own, and nothing written; or the lines `write` would refuse by. Gives the
    number it ends with, or a promise of it when the drop folder changes. */
function plan(home, rest, say, now) {
  return afterwards(planned(home, rest, now), (result) => {
    if (!result.fields) {
      for (const line of result.said) say(line);
      return result.code;
    }
    // The settings as write writes them, but for the emails of the accounts the teachings were checked on, which the installer, that
    // shows what is said here, shows nowhere else.
    const accounts = result.settings.sessionTeachings?.accounts;
    const shown = accounts && typeof accounts === "object"
      ? { ...result.settings, sessionTeachings: { ...result.settings.sessionTeachings, accounts: Object.fromEntries(Object.keys(accounts).map((account) => [account, "(not shown)"])) } }
      : result.settings;
    say(JSON.stringify(shown, null, 2));
    // The drop folder as it is and as it would be, each on a line of its own, for install.sh, which reads them without parsing JSON.
    say(`The drop folder is now: ${result.from}`);
    say(`The drop folder will be: ${result.to}`);
    return 0;
  });
}

/** The settings `set` changes, by option: the setting it names; what it takes, in words; how its value is read (undefined when
    it will not do); how that is said; what the setting is while the file does not say; and how a line about it is worded. */
export const SETTABLE = {
  "--import": {
    field: "import", takes: "light or full", read: (v) => (v === "light" || v === "full" ? v : undefined), said: String,
    otherwise: "full", subject: "The import", be: "is", was: "it was"
  },
  "--readings": {
    field: "readings", takes: "on or off", read: (v) => (v === "on" ? true : v === "off" ? false : undefined), said: (v) => (v ? "on" : "off"),
    otherwise: true, subject: "Readings", be: "are", was: "they were"
  },
  "--handoff": {
    field: "handoffVersion", takes: "1 or 2", read: (v) => (v === "1" ? 1 : v === "2" ? 2 : undefined), said: String,
    otherwise: 1, subject: "The hand-off version", be: "is", was: "it was"
  },
  "--drop": {
    field: "drop", takes: 'Drop or "Unedited Video"', read: (v) => (v === "Drop" || v === "Unedited Video" ? v : undefined), said: String,
    otherwise: "Unedited Video", subject: "The drop folder", be: "is", was: "it was"
  }
};

/** A moment as a local time with its offset, "2026-10-22T20:00:00-04:00", as localStamp in episode.js writes it. That file
    cannot be read here: it reads this one. */
function localTime(d) {
  const off = -d.getTimezoneOffset();
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${off < 0 ? "-" : "+"}${pad(off / 60)}:${pad(off % 60)}`;
}

/** What `set`, `write` and `plan` refuse until it is built, by option and value, and why: the light import, until the question in
    her chat exists (Part F), which takes this away. */
const NOT_BUILT = [["--import", "light", "The light import needs the question in her chat, which is not built yet."]];

/** Why the first of the values `values`, by option, is refused as not built yet, in plain words: "" when none is. */
function notBuilt(values) {
  for (const [option, value] of Object.entries(values)) {
    const refused = NOT_BUILT.find(([o, v]) => o === option && v === value);
    if (refused) return refused[2];
  }
  return "";
}

/** `set`: the settings of the switch it is told, changed and checked, each change said. A setting that is as it is told is
    left, and said to be. What is not built yet is refused (NOT_BUILT), and so is a change of the drop folder, which the
    installer makes: nothing is changed. */
function set(home, rest, say) {
  const told = pairsOf(rest, OF_SET());
  if (!told || !Object.keys(told).length) {
    say(HELP);
    return 2;
  }
  const values = {};
  for (const [option, said] of Object.entries(told)) {
    values[option] = SETTABLE[option].read(said);
    if (values[option] === undefined) {
      say(`Not changed: ${option} takes ${SETTABLE[option].takes}.`);
      return 1;
    }
  }
  const refused = notBuilt(values);
  if (refused) {
    say(refused);
    return 1;
  }
  const got = usable(home);
  if (got.why) {
    say(`${got.why} ${got.mend}`);
    return 2;
  }
  // The drop folder is not a setting to change by itself: the new folder must be made and marked, the launch agent pointed at it,
  // and the old folder looked at first. Written alone, the setting left the agent watching the old folder, and the import then
  // skipped every video found there. So a change of it is the installer's, and nothing here is changed.
  const to = values["--drop"];
  if (to !== undefined && to !== (got.settings.drop ?? SETTABLE["--drop"].otherwise)) {
    say(`The drop folder is switched by the installer, which makes the new folder, marks it and points the import at it, after it has checked the old one. To see what it would do: ./install.sh --print --machine "${got.settings.machine}" --drop ${to === "Drop" ? to : `"${to}"`} "${got.settings.root}"`);
    return 1;
  }
  const changes = {};
  const lines = [];
  for (const [option, value] of Object.entries(values)) {
    const { field, said, otherwise, subject, be, was } = SETTABLE[option];
    const before = got.settings[field] ?? otherwise;
    if (before === value) {
      lines.push(`${subject} ${be} ${said(value)} already.`);
    } else {
      changes[field] = value;
      lines.push(`${subject} ${be} now ${said(value)} (${was} ${said(before)}).`);
    }
  }
  try {
    if (Object.keys(changes).length) lines.push(`Written: ${writeSettings(home, changes)}`);
  } catch (e) {
    say(`This Mac's settings could not be written (${e.code || e.message}).`);
    return 1;
  }
  for (const line of lines) say(line);
  return 0;
}

/** `sessions`: record that Jason has checked the training setting on the two accounts that touch a session, and when, or take
    that away. The account setting cannot be read from code: this records that a person checked, and no more. */
function sessions(home, rest, say, now) {
  const told = pairsOf(rest, { "--teachings": "teachings", "--cli-account": "cli", "--app-account": "app" });
  const accounts = told ? [told.cli, told.app].filter((a) => a !== undefined).length : 0;
  const on = told?.teachings === "on" && accounts === 2;
  const off = told?.teachings === "off" && accounts === 0;
  if (!on && !off) {
    say(HELP);
    return 2;
  }
  if (on && (!told.cli.trim() || !told.app.trim())) {
    say("Not changed: teachings need both accounts, the one the claude command is signed in to and the one the Code tab shows.");
    return 1;
  }
  const got = usable(home);
  if (got.why) {
    say(`${got.why} ${got.mend}`);
    return 2;
  }
  if (off && !got.settings.sessionTeachings) {
    say("Teachings from sessions were off already.");
    return 0;
  }
  const at = localTime(now);
  const sessionTeachings = on ? { on: true, at, accounts: { cli: told.cli, app: told.app } } : null;
  try {
    const file = writeSettings(home, { sessionTeachings });
    if (off) {
      say("Teachings from sessions are off.");
    } else {
      const until = localTime(new Date(Date.parse(at) + TEACHINGS_DAYS * 24 * 60 * 60 * 1000)).slice(0, 10);
      say(`Teachings from sessions are on from ${at}, for ${TEACHINGS_DAYS} days (until ${until}).`);
      say(`The claude command is signed in to ${told.cli}; the Code tab shows ${told.app}.`);
    }
    say(`Written: ${file}`);
    return 0;
  } catch (e) {
    say(`This Mac's settings could not be written (${e.code || e.message}).`);
    return 1;
  }
}

/** `show`: the settings, with the folders found from them, or why there are none. The settings of the switch are said when
    the file has them. */
function show(home, say, now) {
  const got = usable(home);
  if (got.why) {
    say(`${got.why} ${got.mend}`);
    return 2;
  }
  const s = got.settings;
  say(`This Mac's settings, in ${settingsFile(home)}:`);
  say(`  This Mac:  ${s.machine}`);
  say(`  BRIMM Video:  ${s.root}`);
  say(`  Its drop folder:  ${dropFolder(s.root, s.machine, s.drop)}`);
  say(`  Episodes:  ${episodesFolder(s.root)}`);
  say(`  brimm-video, run from:  ${s.checkout}`);
  say(`  Work in Final Cut:  ${workFolder(home)}`);
  say(`  From Final Cut:  ${fromFinalCutFolder(home)}`);
  if (s.import !== undefined) say(`  Import:  ${s.import}`);
  if (s.readings !== undefined) say(`  Readings:  ${s.readings ? "on" : "off"}`);
  if (s.handoffVersion !== undefined) say(`  Hand-off version:  ${s.handoffVersion}`);
  if (s.sessionTeachings) {
    const { at, accounts } = s.sessionTeachings;
    say(`  Teachings from sessions:  ${teachingsOn(s, now) ? "on" : "lapsed"}, turned on ${at} (the claude command: ${accounts.cli}; the Code tab: ${accounts.app})`);
  }
  return 0;
}

/** `studio`: write the folder for Claude from this Mac's settings, with the node the installer found. That node is named,
    and is not the one running this: with Homebrew that is a versioned path that the next upgrade of node takes away. */
function studio(home, rest, say) {
  if (rest.length !== 2 || rest[0] !== "--node" || !isAbsolute(rest[1])) {
    say(HELP);
    return 2;
  }
  const got = usable(home);
  if (got.why) {
    say(`${got.why} ${got.mend}`);
    return 2;
  }
  try {
    say(`Written: ${writeStudio(home, { checkout: got.settings.checkout, node: rest[1] })}`);
    return 0;
  } catch (e) {
    say(`The folder for Claude could not be written (${e.code || e.message}).`);
    return 1;
  }
}

/** The name of the marker in a drop folder, which holds the name of the Mac that watches it. */
export const MARKER = ".brimm-watched-by";

/** `marker`: mark the drop folder `drop` as this Mac's, `machine`. The marker is written by the rule for writing into Dropbox
    (dropbox.js): whole outside it, then cloned in, a marker of this Mac's own replaced by a new file. A folder another Mac
    has marked is refused: two Macs watching one folder would import every video twice. */
function mark(rest, say, clone) {
  if (rest.length !== 2) {
    say(HELP);
    return 2;
  }
  const [drop, machine] = rest;
  const fault = machineFault(machine);
  if (fault) {
    say(`Not marked: ${fault}.`);
    return 1;
  }
  const file = join(drop, MARKER);
  const owner = existsSync(file) ? readFileSync(file, "utf8").split("\n")[0] : "";
  if (owner && owner !== machine) {
    say(`The folder ${drop} is watched by ${owner} already. A drop folder is watched by one Mac only.`);
    return 1;
  }
  try {
    textWriter({ work: join(tmpdir(), `brimm-marker-${process.pid}`), ...(clone ? { clone } : {}) })(file, `${machine}\n`, { replace: Boolean(owner) });
    say(`Marked: ${file}`);
    return 0;
  } catch (e) {
    say(`The folder could not be marked: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  }
}

/** What `node settings.js` does. Ends with 0 when it did what it was asked, 1 when it refused or could not, and 2 when it
    was asked wrongly or this Mac has no settings to show; or gives a promise of that number, for `write` and `plan` when they
    change the drop folder, which makes them look at the old folder (switch.js). The home folder is the one HOME names, as for the
    launch agent and in a shell, and the Mac's own word for it when HOME names none. */
export function settingsMain(argv, { home = process.env.HOME || homedir(), say = (line) => process.stdout.write(`${line}\n`), clone, now = new Date() } = {}) {
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    say(HELP);
    return 0;
  }
  if (command === "write") return write(home, rest, say, now);
  if (command === "plan") return plan(home, rest, say, now);
  if (command === "set") return set(home, rest, say);
  if (command === "sessions") return sessions(home, rest, say, now);
  if (command === "show" && !rest.length) return show(home, say, now);
  if (command === "marker") return mark(rest, say, clone);
  if (command === "studio") return studio(home, rest, say);
  say(HELP);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Whatever else goes wrong ends it with 1 and a plain line, never an unhandled rejection with a stack trace, which holds paths.
  Promise.resolve()
    .then(() => settingsMain(process.argv.slice(2)))
    .then((code) => {
      process.exitCode = code;
    }, (e) => {
      process.stdout.write(`This Mac's settings could not be handled (${(e && e.code) || "an error"}).\n`);
      process.exitCode = 1;
    });
}
