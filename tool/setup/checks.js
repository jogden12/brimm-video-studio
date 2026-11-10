// What the setup engine can tell about this Mac and its own copy of BRIMM Video Studio: whether the copy is whole, and which kind
// of Mac this is (fresh, takeover, installed, dev, or one whose settings cannot be read). It reads, and runs only ffmpeg's lists and
// codesign's check; it writes nothing.
import { accessSync, constants, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildOf, isInstalled } from "../build.js";
import { devMarked, machineFault, readSettings, sameFolder, settingsFile } from "../settings.js";
import { HELPERS } from "../helpers.js";
import { hasFilters, hasHwaccel } from "../workcopy.js";

/** The programs the app carries in its tools folder (--tools): install.sh's TOOLS_PROGRAMS, then each of Studio's compiled helpers. */
export const PROGRAMS = ["node", "npm", "ffmpeg", "ffprobe", "whisper-cli", ...HELPERS.map((name) => `brimm-${name}`)];

/** What a person is told of a copy that is not whole: install.sh's DAMAGED. */
export const DAMAGED = "This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair.";

/** Whether `file` is a regular file that may be run. */
function runnable(file) {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/** What ffmpeg prints for one list, asked as install.sh asks. */
const listOf = (ffmpeg, flag) => {
  const ran = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", flag], { encoding: "utf8", timeout: 30000 });
  return ran.status === 0 ? String(ran.stdout) : "";
};

/** What is wrong with this copy of the app, in a few plain words that name the thing and never a path in the home, or "" when
    nothing is. In this order, the first fault stopping the look: the build file, each program, ffmpeg's ability to make an HDR video
    standard, and, when `deep`, the app's signature (a slow check, which the start of a run leaves out). `programs.codesign` is the
    program that checks the signature. */
export function copyFault({ app, tools, checkout, programs, deep = true }) {
  const build = buildOf(checkout);
  if (!isInstalled(build)) return "build.json is missing";
  if (build.broken) return "build.json cannot be read";
  for (const name of PROGRAMS) {
    const file = join(tools, name);
    if (!existsSync(file) || !statSync(file).isFile()) return `${name} is missing`;
    if (!runnable(file)) return `${name} cannot be run`;
  }
  const ffmpeg = join(tools, "ffmpeg");
  if (!hasHwaccel(listOf(ffmpeg, "-hwaccels"), "videotoolbox")) return "ffmpeg cannot make an HDR video standard (videotoolbox)";
  if (!hasFilters(listOf(ffmpeg, "-filters"), ["scale_vt"])) return "ffmpeg cannot make an HDR video standard (scale_vt)";
  if (deep) {
    const signed = spawnSync(programs.codesign, ["--verify", "--deep", "--strict", app], { encoding: "utf8", timeout: 120000 });
    if (signed.status !== 0) return "the signature does not verify";
  }
  return "";
}

/** Which kind of Mac this is, from its settings and the checkout of the copy that is running:
    fresh (no settings), unusable (settings that cannot be read, with `why` in their own words), dev (marked as Jason's development Mac,
    whatever its checkout), installed (the settings' checkout is an app's copy: this one, or `moved`, another), or takeover (anything
    else: a git clone, or a folder that is gone). */
export function kindOf({ home, checkout }) {
  if (!existsSync(settingsFile(home))) return { kind: "fresh" };
  const read = readSettings(home);
  if (read.why) return { kind: "unusable", why: read.why };
  const { settings } = read;
  if (devMarked(settings)) return { kind: "dev", settings };
  if (sameFolder(settings.checkout, checkout)) return { kind: "installed", settings, moved: false };
  if (/\.app\/Contents\/Resources\/Studio\/?$/.test(settings.checkout)) return { kind: "installed", settings, moved: true };
  return { kind: "takeover", settings };
}

/** The floor for Claude Code's version: install.sh's GUARD_CLAUDE, what her folder's guard needs. */
export const GUARD_CLAUDE = "2.1.295";

/** The three numbers of a version, or null when `text` holds none. */
const numbersOf = (text) => {
  const found = /(\d+)\.(\d+)\.(\d+)/.exec(typeof text === "string" ? text : "");
  return found ? [Number(found[1]), Number(found[2]), Number(found[3])] : null;
};

/** Whether `version` is `floor` or later, comparing the three numbers. A version with no three numbers is not. */
export function versionAtLeast(version, floor) {
  const have = numbersOf(version);
  const need = numbersOf(floor);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) if (have[i] !== need[i]) return have[i] > need[i];
  return true;
}

/** This Mac's ComputerName, trimmed, as a name to suggest, or "" when scutil fails or the name is one a Mac cannot have. */
export function nameSuggestion({ programs }) {
  const ran = spawnSync(programs.scutil, ["--get", "ComputerName"], { encoding: "utf8", timeout: 10000 });
  if (ran.status !== 0) return "";
  const name = String(ran.stdout).trim();
  return machineFault(name) ? "" : name;
}

/** The names of the folders (not files) inside `folder`, or none when it cannot be read. */
function foldersIn(folder) {
  try {
    return readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory() || (entry.isSymbolicLink() && isFolder(join(folder, entry.name)))).map((entry) => entry.name);
  } catch (e) {
    return [];
  }
}

/** Whether `path` is a folder, or a link to one. */
function isFolder(path) {
  try {
    return statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

/** The Macs' names already in use in BRIMM Video at `root`: the folders in Drop and in Unedited Video, and the name in the brackets at
    the end of each folder in Episodes ("(Mac)" or "(Mac)-2"). Sorted, each once. An episode's folder name can carry a client's name, so
    nothing of it outside the brackets is read out. */
export function namesInUse(root) {
  const names = new Set([...foldersIn(join(root, "Drop")), ...foldersIn(join(root, "Unedited Video"))]);
  for (const episode of foldersIn(join(root, "Episodes"))) {
    const bracketed = /\(([^()]+)\)(?:-\d+)?$/.exec(episode);
    if (bracketed) names.add(bracketed[1]);
  }
  return [...names].sort();
}

/** The warning for a name another Mac uses in BRIMM Video, whatever the case of the letters, or "" for a new name. */
export function nameClash(name, root) {
  const taken = namesInUse(root).some((other) => other.toLowerCase() === String(name).toLowerCase());
  return taken ? `Another Mac already uses the name "${name}" in BRIMM Video. Two Macs with one name would share a drop folder: choose another name, unless this is that Mac being set up again.` : "";
}

/** The BRIMM Video folders in Dropbox under `home`, looked for in the four places move.zsh's search_brimm_video looks, in its order.
    Folders only; one folder reached by two spellings counts once, by its real path, and the first spelling is kept. */
export function brimmVideoFolders(home) {
  const dropboxes = (parent) => foldersIn(parent).filter((name) => name.startsWith("Dropbox")).sort().map((name) => join(parent, name));
  const below = (folders) => folders.flatMap((folder) => foldersIn(folder).filter((name) => !name.startsWith(".")).sort().map((name) => join(folder, name)));
  const cloud = dropboxes(join(home, "Library", "CloudStorage"));
  const plain = dropboxes(home);
  const found = [];
  const seen = new Set();
  for (const top of [cloud, below(cloud), plain, below(plain)]) {
    for (const folder of top) {
      const candidate = join(folder, "The BRIMM DB", "BRIMM Video");
      if (!isFolder(candidate)) continue;
      const real = realpathSync(candidate);
      if (seen.has(real)) continue;
      seen.add(real);
      found.push(candidate);
    }
  }
  return found;
}

/** The lines a person reads when no BRIMM Video is found. */
export const NO_BRIMM_VIDEO = ["BRIMM Video was not found in Dropbox on this Mac.", 'Open Dropbox, sign in to The BRIMM\'s account, and wait until "The BRIMM DB" shows in Finder.', "Then choose Look again."];

const ADMINISTRATOR = "If this Mac asks for an administrator's password, drag the app into the Applications folder inside your home folder instead.";

/** The four apps the setup needs: each one's id, name, its folder in Applications (none for Claude Code), where to get it (none for
    Claude Code), and notes. `administrator` is the note for the three that are dragged into Applications. */
export const APPS = [
  { id: "claude-app", name: "Claude", folder: "Claude.app", link: "https://claude.ai/download", administrator: ADMINISTRATOR },
  { id: "claude-code", name: "Claude Code" },
  { id: "dropbox", name: "Dropbox", folder: "Dropbox.app", link: "https://www.dropbox.com/install", administrator: ADMINISTRATOR },
  { id: "hyperframes", name: "HyperFrames", folder: "HyperFrames.app", link: "https://hyperframes.dev/studio/download", note: "HyperFrames asks you to sign in to HeyGen the first time it opens.", administrator: ADMINISTRATOR }
];

/** Which of the apps with a folder are here: in `system` or in the home's Applications folder. */
export function appsHere({ home, system = "/Applications" }) {
  const here = {};
  for (const app of APPS.filter((one) => one.folder)) here[app.id] = [system, join(home, "Applications")].some((place) => isFolder(join(place, app.folder)));
  return here;
}

/** Where Claude Code is, looked for as install.sh's find_claude looks: in `tools`, in each of `system`, and in the home's .local/bin,
    for a file named claude that may be run. Homebrew's folder is not looked in. Null when it is not found. */
export function claudeAt({ home, tools, system = ["/usr/bin", "/bin"] }) {
  for (const folder of [tools, ...system, join(home, ".local", "bin")]) {
    if (runnable(join(folder, "claude"))) return join(folder, "claude");
  }
  return null;
}

/** The environment Claude Code is run with, built from scratch: its home, the app's tools folder and the system's, and a locale. */
export const claudeEnv = ({ home, tools }) => ({ HOME: home, PATH: `${tools}:/usr/bin:/bin`, LANG: "en_US.UTF-8" });

/** What is known of Claude Code: where it is, its version, whether it is signed in, and its plan. Claude is run with an environment
    built from scratch. Of what `auth status --json` prints only whether it is signed in and the plan are read: never the email, never
    the organisation. */
export function claudeState({ home, tools, run = spawnSync }) {
  const where = claudeAt({ home, tools });
  const state = { here: where !== null, where, version: null, enough: false, signedIn: false, plan: null };
  if (!where) return state;
  const env = claudeEnv({ home, tools });
  const ask = (args) => run(where, args, { encoding: "utf8", timeout: 30000, env });
  const said = ask(["--version"]);
  const version = /\d+\.\d+\.\d+/.exec(said.status === 0 ? String(said.stdout) : "");
  if (version) state.version = version[0];
  state.enough = versionAtLeast(state.version, GUARD_CLAUDE);
  const auth = ask(["auth", "status", "--json"]);
  try {
    const status = JSON.parse(String(auth.stdout));
    if (auth.status === 0 && status && status.loggedIn === true) {
      state.signedIn = true;
      if (typeof status.subscriptionType === "string") state.plan = status.subscriptionType;
    }
  } catch (e) {
    // Nothing that can be read: not signed in.
  }
  return state;
}
