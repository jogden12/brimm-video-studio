// Where an episode's files are (Phase 3, the local working folder; design D1 and D2). On a Mac with a drop folder of its own, an episode's own
// files (the recording, its transcript, words, cut plan, notes, Reel suggestions, the rough cut's captions and a session's teachings) are kept on
// the Mac that took the video in, in its work folder's video/ (settings.js episodeFilesFolder), and its record says so: `local: { on: "<Mac>" }`,
// at layout 6 (episode.js LOCAL_VERSION). Its folder in Dropbox keeps record/, final/, history/, Original files/ and a plan's three files. A
// file's place is its name, and `files` keeps its shape. A record without `local` keeps every file in its folder in Dropbox, as before.
// An episode with `local` is changed only on its Mac (D3): on any other, every command that names it says ON_OTHER_MAC and changes nothing.
// This module reads and writes nothing: it says places and builds paths. It imports only what episode.js imports already (settings.js), so that
// episode.js and every reader of an episode's files can take it in without a loop of imports; for that, it names a plan's files itself
// (PLAN_FILES, held to plan.js PLAN_FILE_NAMES by a test) and says a Mac as kinds.js does (held to spokenMac by a test).
import { basename, join } from "node:path";
import { episodeFilesFolder } from "./settings.js";

/** The folders of an episode's folder in Dropbox whose files stay in Dropbox on a record with `local`: its records, the hand-off's (final/), what
    is set aside there (history/) and the recordings copied in after the hand-off (Original files/, D6). */
const DROPBOX_FOLDERS = ["record", "final", "history", "Original files"];
/** A plan's three files, made before any footage and kept in its folder in Dropbox (plan.js PLAN_FILE_NAMES, which a test holds this to). */
export const PLAN_FILES = Object.freeze(["video guide.md", "shot list.md", "teleprompter.txt"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Whether a record keeps its own files on a Mac: it holds `local`. */
const keptOnAMac = (record) => isObject(record) && isObject(record.local);
/** A Mac as a sentence says it (kinds.js spokenMac, which a test holds this to): "the Mac Studio", and a Mac named for its owner as it is. */
const spoken = (mac) => (/['’]s\b/.test(mac) ? mac : `the ${mac}`);

/** Where a file a record lists is, by its path from the episode's folder (`rel`, with "/"): "dropbox" for a file in record/, final/, history/ or
    Original files/, and for a plan's file; "local" for every other file of a record that holds `local`; and "dropbox" for every file of a record
    that does not. */
export function filePlace(record, rel) {
  const path = String(rel);
  if (DROPBOX_FOLDERS.includes(path.split("/")[0]) || PLAN_FILES.includes(path)) return "dropbox";
  return keptOnAMac(record) ? "local" : "dropbox";
}

/** The folder of a place (filePlace) for the episode in `folder` (its folder in Dropbox) with `record`: `folder` for "dropbox"; for "local", the
    episode's own folder on this Mac (`ctx.home`), its work folder's video/, by the name of its folder, when the record holds `local`, and `folder`
    for any other record. */
export function folderAt(ctx, { folder, record }, place) {
  return place === "local" && keptOnAMac(record) ? episodeFilesFolder(ctx.home, basename(folder)) : folder;
}

/** The path of a file a record lists (`rel`), in the folder of its place. */
export const fileAt = (ctx, { folder, record }, rel) => join(folderAt(ctx, { folder, record }, filePlace(record, rel)), rel);

/** The Mac a record is kept on when it is not this one (`ctx.machine`): its `local.on`. "" for a record kept on this Mac, a record without
    `local` or with one that names no Mac, and anything that is not a record. */
export function onOtherMac(ctx, record) {
  const on = keptOnAMac(record) && typeof record.local.on === "string" ? record.local.on : "";
  return on !== "" && on !== ctx.machine ? on : "";
}

/** What every command that names an episode kept on another Mac says on this one, and all it says: the episode as every line names it (`name`:
    its name, a plan by its title, a session or a video not yet answered by its label), and the Mac it is on (`mac`). */
export const ON_OTHER_MAC = (name, mac) => `"${name}" is on ${spoken(mac)}: carry on there. Nothing was changed.`;
