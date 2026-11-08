// The import's note of each look at a folder, and what to say of it. The launch agent runs Homebrew's node, and macOS decides,
// program by program, whether node may read a folder under Desktop, Documents, Downloads, iCloud Drive, a cloud drive (Dropbox's
// among them) or another disk. After a `brew upgrade node` it asks again, and with nobody at the Mac, or on Don't Allow, the import
// cannot look in the drop folder and a dropped video waits for ever. So each look is written down in `access.json`, beside
// seen.json on this Mac's own disk (never in Dropbox, never in a watched folder), and this file judges the note and holds every
// sentence that is said of it: in the log, in a banner, in her chat and in the installer. filing.js, unedited.js and edit.js
// only call it. Design: docs/superpowers/specs/2026-11-07-import-folder-access-notice-design.md.
// No note, line or banner names a video by its file. A write that fails costs only the notice.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { studioHome } from "./home.js";
import { realOf } from "./places.js";
import { isRunning } from "./run.js";
import { dropFolderOf, episodesFolder, folderWords, readSettings, seenFile } from "./settings.js";

/** How long a look may wait before it is said that the import is waiting on macOS's question (or on a slow folder). */
export const ASKING_MS = 60 * 1000;
/** How old a video in the drop folder is before it is told that the import has not taken it. */
export const UNSEEN_MS = 3 * 60 * 1000;
/** How long after a banner for a place that place's banner may come again while nothing has changed. */
export const BANNER_AGAIN_MS = 60 * 60 * 1000;
/** How long a refused Downloads export is left before it is said again (the Downloads check uses it). */
export const DOWNLOADS_SAY_MS = 24 * 60 * 60 * 1000;
/** Her words for "look again", the command that asks the import to look in the drop folder now. */
export const LOOK_AT_WORK = "The import is at work now: it looks in your drop folder again within a minute.";
export const LOOK_ASKED = "The import is asked to look in your drop folder now. The panel shows how far it is.";

const PLACES = ["drop", "episodes", "downloads"];
const STATES = { EPERM: "refused", EACCES: "locked", ENOENT: "missing" };
const EMPTY = () => ({ version: 1, places: {}, looking: null, told: {} });

/** Where the note is kept: beside seen.json. */
export const accessFile = (home) => join(dirname(seenFile(home)), "access.json");

/** The note, or an empty one when there is none or it cannot be read. */
export function readAccess(home) {
  try {
    const note = JSON.parse(readFileSync(accessFile(home), "utf8"));
    if (note && typeof note === "object" && !Array.isArray(note)) return { ...EMPTY(), ...note, places: note.places || {}, told: note.told || {} };
  } catch {
    // none, or not readable: the same as none
  }
  return EMPTY();
}

/** Write the note whole, under another name and then renamed, as seen.json is. A write that fails is passed over. */
export function writeAccess(home, note) {
  try {
    const file = accessFile(home);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.writing`, JSON.stringify(note, null, 2) + "\n");
    renameSync(`${file}.writing`, file);
  } catch {
    try {
      rmSync(`${accessFile(home)}.writing`, { force: true });
    } catch {
      // nothing more to do
    }
  }
}

/** Run `fn` with the note saying that the import is looking at `place` (its process and the time), and take that out again whatever
    `fn` does, so that a run stuck in `fn` shows in the note. Gives fn's result; a throw goes on. `fn` is not waited for if it is async. */
export function bracket(place, fn, { home, clock = Date.now, pid = process.pid } = {}) {
  const note = readAccess(home);
  note.looking = { place, pid, at: clock() };
  writeAccess(home, note);
  try {
    return fn();
  } finally {
    const after = readAccess(home);
    after.looking = null;
    writeAccess(home, after);
  }
}

/** Write what a look at `folder` found for `place`: no error is ok, EPERM is refused (macOS's privacy control), EACCES locked (the
    folder's own permissions), ENOENT missing, any other error. `since` stays while the state does; `okNode` is the node of the last
    ok look, kept through the other states and absent until a first ok look. Gives the state it wrote. */
export function noteState(place, folder, error, { home, clock = Date.now, node = process.execPath } = {}) {
  const note = readAccess(home);
  const before = note.places[place];
  const state = error ? STATES[error.code] || "error" : "ok";
  const at = clock();
  const next = { state, code: error ? String(error.code || "") : "", at, since: before && before.state === state ? before.since : at, folder: resolve(folder), node };
  if (state === "ok") next.okNode = node;
  else if (before && before.okNode) next.okNode = before.okNode;
  note.places[place] = next;
  writeAccess(home, note);
  return state;
}

/** List `folder` in a bracket, and write what came of it. Gives { names }, or { state, code } when the folder could not be read. */
export function lookAt(place, folder, opts = {}) {
  let names;
  let failed = null;
  try {
    names = bracket(place, () => readdirSync(folder), opts);
  } catch (e) {
    failed = e;
  }
  const state = noteState(place, folder, failed, opts);
  return failed ? { state, code: String(failed.code || "") } : { names };
}

/** What, if anything, to tell her or Jason about the import's looks, as one finding. `places` says where each place is now; `missing`
    is whether this Mac's drop folder is not there as her chat sees it; `unseen` is the videos the import has not taken; `agentNode`
    is the node the plist names, "" when it is not known; `needsAccess` lists the places (drop, episodes) that macOS guards. The first that
    holds: asking, refused/locked/error (the first noted place, drop then episodes then downloads, that is still where it was),
    missing, unseen, newNode. */
export function findingOf({ note, now, places, agentPid, missing = false, unseen = [], agentNode = "", needsAccess = [] }) {
  const looking = note.looking;
  if (looking && looking.pid === agentPid && now - looking.at > ASKING_MS) return { kind: "asking", place: looking.place };
  for (const place of PLACES) {
    const noted = note.places[place];
    if (!noted || typeof noted.folder !== "string" || !places[place] || resolve(noted.folder) !== resolve(places[place])) continue;
    if (noted.state === "refused" || noted.state === "locked" || noted.state === "error") return { kind: noted.state, place, code: noted.code };
  }
  if (missing) return { kind: "missing", place: "drop" };
  if (unseen.length) return { kind: "unseen", videos: unseen };
  const guarded = needsAccess.filter((place) => place === "drop" || place === "episodes").map((place) => (note.places[place] || {}).okNode);
  if (agentNode && guarded.some((okNode) => okNode && okNode !== agentNode)) return { kind: "newNode" };
  return null;
}

/** A place in her words: her drop folder with where it is, BRIMM Video in Dropbox, or the Downloads folder. */
export function placeWordsOf(place, folder, home) {
  if (place === "drop") return `your drop folder, ${folderWords(folder, home)}`;
  if (place === "downloads") return "the Downloads folder";
  return "BRIMM Video in Dropbox";
}

/** The Files and Folders switch that covers `folder`, by its real path, in System Settings' words. */
export function switchFor(folder, home) {
  const h = realOf(home);
  const real = realOf(folder);
  const under = (dir) => real === dir || real.startsWith(`${dir}/`);
  if (under(join(h, "Desktop"))) return "Desktop Folder";
  if (under(join(h, "Documents"))) return "Documents Folder";
  if (under(join(h, "Downloads"))) return "Downloads Folder";
  const storage = join(h, "Library", "CloudStorage");
  if (real.startsWith(`${storage}/`)) return `the switch for ${real.slice(storage.length + 1).split("/")[0].split("-")[0]}`;
  if (under(join(h, "Library", "Mobile Documents"))) return "the switch for iCloud Drive";
  if (under("/Volumes")) return "Removable Volumes";
  return "its switches";
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const LOG_FILE = "~/Library/Logs/brimm-video.log";

/** The line for her chat (and the installer) for a finding. `placeWords` is the place in her words, `switchName` the switch to turn on,
    `code` the error's code when the finding has none. */
export function accessLine(finding, { placeWords = "", switchName = "", code = "" } = {}) {
  const gone = finding.place === "downloads" ? ", so the exports HyperFrames put there stay there" : ", so the videos you drop wait";
  switch (finding.kind) {
    case "asking":
      return `The import has waited more than a minute to look in ${placeWords}. If a box on this Mac's screen asks whether "node" may look in it, choose Allow, and the import goes on.`;
    case "refused":
      return `This Mac does not let the import look in ${placeWords}${gone}. In System Settings, under Privacy & Security, Files and Folders, turn on ${switchName} under each "node" listed. Then say "look again".`;
    case "locked":
      return `The import cannot open ${placeWords}: the folder's own permissions shut it. Ask Jason. (Jason: node gets EACCES there; see Get Info, Sharing & Permissions.)`;
    case "error":
      return `The import could not look in ${placeWords} (${finding.code || code}). Ask Jason. (Jason: see ${LOG_FILE}.)`;
    case "missing":
      return `${capital(placeWords)}, is not there now. If it is on another disk, connect the disk, then say "look again".`;
    case "unseen": {
      const n = finding.videos.length;
      const [what, it, waits] = n === 1 ? ["1 video", "it", "waits"] : [`${n} videos`, "they", "wait"];
      return `The import has not taken ${what} in your drop folder, and no import is running. Say "look again". If ${it} still ${waits}, ask Jason. (Jason: see ${LOG_FILE}, and launchctl print gui/$(id -u)/com.thebrimm.unedited.)`;
    }
    case "newNode":
      return "node was updated on this Mac, so macOS may ask whether node may look in your drop folder or in Dropbox. If a box asks, choose Allow.";
    default:
      return "";
  }
}

/** The line on one waiting video's step: its own for a video the import has not taken, else the finding's line as it is. Nothing for
    a finding that does not block a video, or one about Downloads. */
export function stepLine(finding, opts = {}) {
  if (finding.kind === "unseen") return 'The import has not taken it, and no import is running. Say "look again". If it still waits, ask Jason.';
  if (finding.place === "downloads") return "";
  return ["asking", "refused", "locked", "error"].includes(finding.kind) ? accessLine(finding, opts) : "";
}

/** Whether a finding blocks the videos in this Mac's drop folder: the import cannot look in the drop folder or Episodes (every arriving video
    of this Mac), or it never took a video (only those). Not Downloads, a missing folder or a new node. */
export const blocksDrop = (finding) => finding.kind === "unseen" || (["asking", "refused", "locked", "error"].includes(finding.kind) && (finding.place === "drop" || finding.place === "episodes"));

/** Whether the guide's overview says a finding: all but a new node and one about Downloads. */
export const saysInOverview = (finding) => finding.kind !== "newNode" && finding.place !== "downloads";

/** Whether `episodes` says a finding: all but a new node. */
export const saysInEpisodes = (finding) => finding.kind !== "newNode";

/** The banner for whoever is at the Mac. */
export function accessBanner(kind, placeWords) {
  if (kind === "refused") return `This Mac does not let node look in ${placeWords}. Allow it in System Settings › Privacy & Security › Files and Folders.`;
  if (kind === "locked") return `The import cannot open ${placeWords}. Ask Jason.`;
  if (kind === "newNode") return "node was updated. If macOS asks whether node may look in a folder, choose Allow.";
  return "";
}

/** The log line for a look that macOS or the folder's permissions refused. */
export function accessLog(state, code, node, placeWords) {
  if (state === "refused") return `macOS does not let node (${node}) look in ${placeWords} (${code}). Allow node in System Settings, Privacy & Security, Files and Folders; then say "look again" in her chat, or drop the video again.`;
  if (state === "locked") return `The folder's own permissions do not let node look in ${placeWords} (${code}). Jason checks them in Finder, Get Info, Sharing & Permissions.`;
  return "";
}

/** The log line for a `lookAt` result that was not ok: `accessLog`'s line for refused and locked, a line with the code for any other error, and
    "" for a look that found the folder, or did not find it there (the caller says that). `home` is for the place's words. */
export function lookLog(place, folder, look, home, node = process.execPath) {
  if (!look || look.names) return "";
  const words = placeWordsOf(place, folder, home);
  if (look.state === "error") return `node (${node}) could not look in ${words} (${look.code || "an error"}).`;
  return accessLog(look.state, look.code, node, words);
}

/** The installer's line, from the note, for what macOS answered at the end of the setup. `home` is for the place words, `now` the time, `alive`
    whether a process is running (kill 0, as run.js isRunning), and `places` where each place is now, to name a place the note has no
    folder for yet (a first look). Only these: both places ok; none looked yet; a live look under a minute old (still looking), or older
    (the asking line); a look whose process is gone is passed over; refused, locked and error in any place; missing for the drop folder only. */
export function setupLine(note, { home = studioHome(), now = Date.now(), alive = isRunning, places = {} } = {}) {
  const lead = "  Files and Folders, at the end:  ";
  const folderOf = (place) => {
    const noted = (note.places[place] || {}).folder;
    return typeof noted === "string" && noted ? noted : places[place] || "";
  };
  const words = (place) => (folderOf(place) ? placeWordsOf(place, folderOf(place), home) : place === "drop" ? "your drop folder" : placeWordsOf(place, "", home));
  const looking = note.looking;
  if (looking && alive(looking.pid)) {
    if (now - looking.at < ASKING_MS) return `${lead}the import is still looking; if a box asks whether "node" may look in a folder, choose Allow.`;
    return lead + accessLine({ kind: "asking", place: looking.place }, { placeWords: words(looking.place) });
  }
  for (const place of PLACES) {
    const noted = note.places[place];
    if (!noted) continue;
    // A refused Downloads note is never cleared until a later finish, so it is said only within the window her chat uses.
    if (place === "downloads" && !(typeof noted.at === "number" && now - noted.at <= DOWNLOADS_SAY_MS)) continue;
    const said = noted.state === "missing" ? place === "drop" : ["refused", "locked", "error"].includes(noted.state);
    if (!said) continue;
    const finding = { kind: noted.state, place, code: noted.code };
    return lead + accessLine(finding, { placeWords: words(place), switchName: folderOf(place) ? switchFor(folderOf(place), home) : "its switches" });
  }
  const both = ["drop", "episodes"].every((place) => note.places[place] && note.places[place].state === "ok");
  return lead + (both ? "node may look in the drop folder and in Dropbox." : "the import has not looked yet.");
}

/** Post the banner for `place` when its look found the folder refused or locked (`note.places[place].state`) and the rule says it is due:
    the state or node is not what `told[place]` last said, or the last banner for the place is more than an hour old. An ok look (or any
    other state) posts nothing and takes `told[place]` away, so the next refusal posts at once. The rule reads `told` from `note` and writes
    it to `home` each time, never from the run's memory (a run starts again on every dropped video). `notify` failing costs only the banner.
    `home` is required for `told` to persist: without it the rule works on `note` in memory only. Pass a `note` read after noteState (the
    look's own write), or the banner is judged from a note the look has since changed. Gives whether a banner was posted. */
export function postIfDue(place, note, { notify, clock = Date.now, node = process.execPath, placeWords = "", home } = {}) {
  const state = (note.places[place] || {}).state;
  const told = (note.told = note.told || {});
  if (state !== "refused" && state !== "locked") {
    if (place in told) {
      delete told[place];
      if (home) writeAccess(home, note);
    }
    return false;
  }
  const key = `${state}|${node}`;
  const now = clock();
  const last = told[place];
  if (last && last.key === key && now - last.at <= BANNER_AGAIN_MS) return false;
  try {
    notify(accessBanner(state, placeWords));
  } catch {
    return false;
  }
  told[place] = { key, at: now };
  if (home) writeAccess(home, note);
  return true;
}

/** Post the new-node banner once per `node`, when `needs` (the places whose folder needs Files and Folders access) has a place whose last
    ok look was by another node. Gives whether a banner was posted. */
export function postNewNodeIfDue(note, { notify, clock = Date.now, node = process.execPath, needs = [], home } = {}) {
  const told = (note.told = note.told || {});
  if (told.newNode && told.newNode.node === node) return false;
  if (!needs.some((place) => (note.places[place] || {}).okNode && note.places[place].okNode !== node)) return false;
  try {
    notify(accessBanner("newNode", ""));
  } catch {
    return false;
  }
  told.newNode = { node, at: clock() };
  if (home) writeAccess(home, note);
  return true;
}

/** Where each place is now, from this Mac's settings: {} when none can be read. */
function placesFromSettings(home) {
  try {
    const { settings } = readSettings(home);
    if (!settings) return {};
    return { drop: dropFolderOf(settings, home), episodes: episodesFolder(settings.root) };
  } catch {
    return {};
  }
}

/** `node access.js --setup-line`: the installer's one line at the end of a setup, from the note. Prints nothing for any other argument,
    and never fails the installer: whatever goes wrong prints nothing. */
export function main(argv, { out = process.stdout, home } = {}) {
  if (argv[0] !== "--setup-line") return 0;
  try {
    const h = home || studioHome();
    out.write(`${setupLine(readAccess(h), { home: h, places: placesFromSettings(h) })}\n`);
  } catch {
    // Nothing: the setup goes on without the line.
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
