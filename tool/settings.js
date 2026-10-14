// This Mac's own settings for episodes: which Mac it is, where BRIMM Video is on it (each Mac reaches Dropbox by a path of its
// own), and where its checkout of brimm-video is. The Claude model is not among them: it is named in unedited.js, so that both
// Macs read a plan with the same one. And
// the folders found from them: in BRIMM Video, this Mac's drop folder, the episodes and the status files of imports; on this
// Mac's own disk, BRIMM Video Work, where Final Cut's work is kept, never in Dropbox.
// The settings are kept in Application Support, on this Mac's own disk. install.sh --machine writes them, through this
// file's command line, and edit.js and the import read them.
//
//   node settings.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"
//   node settings.js show
//   node settings.js marker "<drop folder>" "<this Mac>"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { textWriter } from "./dropbox.js";

/** Where this Mac's settings are kept: in Application Support, on its own disk. */
export const settingsFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "settings.json");
/** The folder this Mac watches for videos to import, in BRIMM Video: one for each Mac, so no video is imported twice. */
export const dropFolder = (root, machine) => join(root, "Unedited Video", machine);
/** The folder of episodes, in BRIMM Video. No Mac watches it. */
export const episodesFolder = (root) => join(root, "Episodes");
/** The folder of the small status files that say how far each import has got, in Episodes. */
export const importingFolder = (root) => join(episodesFolder(root), ".importing");
/** Where this Mac keeps its work in Final Cut: on its own disk, never in Dropbox. */
export const workFolder = (home) => join(home, "BRIMM Video Work");
/** The one folder Final Cut's Share and File > Export XML… both save into, on this Mac's own disk. */
export const fromFinalCutFolder = (home) => join(workFolder(home), "From Final Cut");
/** Where each episode's library keeps its backups: Final Cut's own default on the Mac Studio is ~/Movies, which is in
    Dropbox there. */
export const backupsFolder = (home) => join(workFolder(home), "Backups");
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

/** What is wrong with this Mac's settings, in plain words: "" when nothing is. */
export function settingsFault(s) {
  if (!s || typeof s !== "object" || Array.isArray(s) || s.version !== 1) return "they are not version 1 of brimm-video's settings";
  const fault = machineFault(s.machine);
  if (fault) return fault;
  if (typeof s.root !== "string" || !isAbsolute(s.root)) return "the path to BRIMM Video is not a whole path";
  if (typeof s.checkout !== "string" || !isAbsolute(s.checkout)) return "the path to the checkout of brimm-video is not a whole path";
  return "";
}

/** This Mac's settings, as {settings}, or {why} there are none that can be used, in plain words. Any field a later version of
    brimm-video adds is kept as it is. */
export function readSettings(home) {
  const file = settingsFile(home);
  let s;
  try {
    s = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return { why: `This Mac has no settings for episodes (${file}).` };
    return { why: `This Mac's settings could not be read (${file}: ${e instanceof SyntaxError ? "it is not JSON" : e.code || e.message}).` };
  }
  const fault = settingsFault(s);
  return fault ? { why: `This Mac's settings could not be read (${file}: ${fault}).` } : { settings: s };
}

/** Write this Mac's settings whole, over any there were: under another name first, then under their own. They are on this
    Mac's own disk, not in Dropbox, so the rename is safe. Gives back the file's path. A value that will not do throws, in
    plain words, and nothing is written. */
export function writeSettings(home, { machine, root, checkout }) {
  const s = { version: 1, machine, root, checkout };
  const fault = settingsFault(s);
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
                               write them, as install.sh --machine does, and say where
  node settings.js show        say what they are, or why there are none
  node settings.js marker "<drop folder>" "<this Mac>"
                               mark this Mac's drop folder as its own, as install.sh --machine does, by the rule for
                               writing into Dropbox. A folder another Mac has marked is refused`;

/** The options `write` is told the settings by, and the setting each one names. */
const WRITTEN = { "--machine": "machine", "--root": "root", "--checkout": "checkout" };

/** The settings `write` is told, by name: null when it is told an option it does not know, or one with no value after it. */
function toldOf(rest) {
  const told = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!WRITTEN[rest[i]] || i + 1 >= rest.length) return null;
    told[WRITTEN[rest[i]]] = rest[i + 1];
  }
  return told;
}

/** `write`: the settings it is told, written and checked. */
function write(home, rest, say) {
  const told = toldOf(rest);
  if (!told || told.machine === undefined || told.root === undefined || told.checkout === undefined) {
    say(HELP);
    return 2;
  }
  const fault = settingsFault({ version: 1, ...told });
  if (fault) {
    say(`Not written: ${fault}.`);
    return 1;
  }
  try {
    say(`Written: ${writeSettings(home, told)}`);
    return 0;
  } catch (e) {
    say(`This Mac's settings could not be written (${e.code || e.message}).`);
    return 1;
  }
}

/** `show`: the settings, with the folders found from them, or why there are none. */
function show(home, say) {
  const got = readSettings(home);
  if (got.why) {
    say(`${got.why} Jason runs install.sh --machine on it.`);
    return 2;
  }
  const s = got.settings;
  say(`This Mac's settings, in ${settingsFile(home)}:`);
  say(`  This Mac:  ${s.machine}`);
  say(`  BRIMM Video:  ${s.root}`);
  say(`  Its drop folder:  ${dropFolder(s.root, s.machine)}`);
  say(`  Episodes:  ${episodesFolder(s.root)}`);
  say(`  brimm-video, run from:  ${s.checkout}`);
  say(`  Work in Final Cut:  ${workFolder(home)}`);
  say(`  From Final Cut:  ${fromFinalCutFolder(home)}`);
  return 0;
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
    was asked wrongly or this Mac has no settings to show. The home folder is the one HOME names, as for the launch agent and
    in a shell, and the Mac's own word for it when HOME names none. */
export function settingsMain(argv, { home = process.env.HOME || homedir(), say = (line) => process.stdout.write(`${line}\n`), clone } = {}) {
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    say(HELP);
    return 0;
  }
  if (command === "write") return write(home, rest, say);
  if (command === "show" && !rest.length) return show(home, say);
  if (command === "marker") return mark(rest, say, clone);
  say(HELP);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = settingsMain(process.argv.slice(2));
