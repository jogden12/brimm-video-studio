// Where an episode's files are (Phase 3, the local working folder; design D1 and D2). On a Mac with a drop folder of its own, an episode's own
// files (the recording, its transcript, words, cut plan, notes, Reel suggestions, the rough cut's captions and a session's teachings) are kept on
// the Mac that took the video in, in its work folder's video/ (settings.js episodeFilesFolder), and its record says so: `local: { on: "<Mac>" }`,
// at layout 6 (episode.js LOCAL_VERSION). Its folder in Dropbox keeps record/, final/, history/, Original files/ and a plan's three files. A
// file's place is its name, and `files` keeps its shape. A record without `local` keeps every file in its folder in Dropbox, as before.
// An episode with `local` is changed only on its Mac (D3): on any other, every command that names it says ON_OTHER_MAC and changes nothing.
// This module reads and writes nothing but whether a recording is on this Mac (recordingAt, recordingStat): it says places and builds paths. It imports only what episode.js imports already (settings.js), so that
// episode.js and every reader of an episode's files can take it in without a loop of imports; for that, it names a plan's files itself
// (PLAN_FILES, held to plan.js PLAN_FILE_NAMES by a test) and says a Mac as kinds.js does (held to spokenMac by a test).
import { statSync } from "node:fs";
import { basename, join } from "node:path";
import { episodeFilesFolder } from "./settings.js";

/** The folder of an episode in Dropbox that keeps the recordings copied in after the hand-off (D6). */
export const ORIGINALS_FOLDER = "Original files";
/** The folders of an episode's folder in Dropbox whose files stay in Dropbox on a record with `local`: its records, the hand-off's (final/), what
    is set aside there (history/) and the recordings copied in after the hand-off (Original files/, D6). */
const DROPBOX_FOLDERS = ["record", "final", "history", ORIGINALS_FOLDER];
/** A plan's three files, made before any footage and kept in its folder in Dropbox (plan.js PLAN_FILE_NAMES, which a test holds this to). */
export const PLAN_FILES = Object.freeze(["video guide.md", "shot list.md", "teleprompter.txt"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Whether a record keeps its own files on a Mac: it holds `local`. */
export const keptOnAMac = (record) => isObject(record) && isObject(record.local);
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

/** What a file of an episode's own, kept on this Mac, is called in what is said of it: by its role, never by its path. */
export function roleOf(file) {
  const roles = [[/\.(mov|mp4|m4v)$/i, "recording"], [/\.rough-cut\.srt$/, "rough cut's captions"], [/\.srt$/, "captions"], [/\.transcript\.txt$/, "transcript"], [/\.words\.json$/, "words"], [/\.cut-plan\.json$/, "cut plan"], [/\.edit-notes\.txt$/, "notes"], [/^reels\.json$|\.reel-suggestions\.txt$/, "Reel suggestions"], [/\.principles\.json$/, "teachings"]];
  const found = roles.find(([pattern]) => pattern.test(file));
  return found ? found[1] : "file";
}

const statOf = (path) => {
  try {
    return statSync(path, { throwIfNoEntry: false });
  } catch (e) {
    return undefined;
  }
};
const listsOriginal = (record) => Number.isInteger((record.files || {})[`${ORIGINALS_FOLDER}/${record.video.file}`]);

/** The path to read a recording from (L6, ruling 8): where a record puts it (fileAt) while that is there, else its copy in Original files/ when the record lists it,
    else where the record puts it. A record without `local` has it in its folder in Dropbox. */
export function recordingAt(ctx, { folder, record }) {
  const here = fileAt(ctx, { folder, record }, record.video.file);
  if (filePlace(record, record.video.file) !== "local") return here;
  const found = statOf(here);
  if (found && found.isFile()) return here;
  return listsOriginal(record) ? join(folder, ORIGINALS_FOLDER, record.video.file) : here;
}

/** The size and time of a recording, to key a copy of it or tell whether it changed: the Mac's file while it is there, else what the record's `local.original` kept of it
    while the copy in Original files/ has that size (a placeholder shows its full size). Undefined when neither is there. */
export function recordingStat(ctx, { folder, record }) {
  const found = statOf(fileAt(ctx, { folder, record }, record.video.file));
  if (found) return found;
  if (!keptOnAMac(record) || !isObject(record.local.original) || record.local.original.file !== record.video.file) return undefined;
  const copy = statOf(join(folder, ORIGINALS_FOLDER, record.video.file));
  return copy && copy.size === record.local.original.bytes ? { size: record.local.original.bytes, mtimeMs: record.local.original.mtimeMs } : undefined;
}
