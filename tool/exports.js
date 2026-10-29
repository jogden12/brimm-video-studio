// HyperFrames' exports (architecture 2026-10-27, section 8; plan PR 7): what the app leaves when she exports a project, how an export is
// matched to its project, and which export a part of an episode takes. It does `parts.js`'s job for the projects of the record and keeps
// its manner: plain data in, and the parts, the asks and the stops out.
//
// What the app does, and where each fact comes from, is in the architecture's 8.1 (A0, Jason's test of 2026-10-28, and the app's docs).
// In short: an export is a file named for its project, a day and a time to the minute (the time is when the export began), saved in
// Downloads unless the Export dialog was given another folder; and each export leaves `renders/<project>_<day>_<time to the second>.meta.json`
// in the project, which says where the file went. The app updates itself, so everything here reads what it writes tolerantly.
//
// Only projectChange and (below) exportsFound read the disk, and only the folders they are given. Nothing here writes anywhere.
import { closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isDay } from "./episode.js";
import { turnsOf } from "./hyperframes.js";

/** The endings of a video that is taken as an export. A WebM is read and mentioned, and never taken (8.1). */
export const TAKEN_ENDINGS = ["mp4", "mov", "m4v"];
const ENDINGS = [...TAKEN_ENDINGS, "webm"];

/** A moment's clock, in the Mac's zone: how a day and a time on a file's name become a moment, and a moment becomes words. The Mac's own
    unless a test gives another (fixedZone), so that no test depends on the Mac it runs on. */
export const LOCAL_ZONE = {
  ms: (y, mo, d, h, mi, s) => new Date(y, mo - 1, d, h, mi, s).getTime(),
  text: (ms) => {
    const at = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  }
};
/** A zone that is `minutes` from UTC all the year, such as -240 for UTC-4, for a test. */
export const fixedZone = (minutes) => ({
  ms: (y, mo, d, h, mi, s) => Date.UTC(y, mo - 1, d, h, mi, s) - minutes * 60000,
  text: (ms) => new Date(ms + minutes * 60000).toISOString().slice(0, 16).replace("T", " ")
});

/** A project's name, then a space, a day, a space, a time with a dot between the hour and the minute, the number the system adds to a copy
    (" (1)"), and an ending. The project's name begins and ends with something that is not a space. */
const EXPORT_NAME = /^(\S(?:.*\S)?) (\d{4}-\d{2}-\d{2}) (\d{2})\.(\d{2})(?: \((\d{1,4})\))?\.([A-Za-z0-9]+)$/;

/** An export's name read: { project, date, time, ending, copy }, or null when the app does not make that name (8.1). `project` is
    composed (NFC), since macOS may write a name decomposed; `time` is "13:56"; `ending` is in lower case; `copy` is the number the system
    gave a copy, 0 when it gave none. A name that starts with a dot, ends in the partial file of a download, is a Dropbox conflicted
    copy, or holds a day or a time that cannot be one, is none. */
export function exportNameOf(name) {
  if (typeof name !== "string") return null;
  const text = name.normalize("NFC");
  if (text.startsWith(".")) return null;
  const read = EXPORT_NAME.exec(text);
  if (!read) return null;
  const [, project, date, hours, minutes, copy, ending] = read;
  const end = ending.toLowerCase();
  if (!isDay(date) || Number(hours) > 23 || Number(minutes) > 59 || !ENDINGS.includes(end)) return null;
  return { project, date, time: `${hours}:${minutes}`, ending: end, copy: copy === undefined ? 0 : Number(copy) };
}

/** The project's name, then an underscore, a day, an underscore, a time to the second with dashes, and ".meta.json". The project's name
    may hold underscores, so it is what comes before the last two. */
const META_NAME = /^(\S(?:.*\S)?)_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})\.meta\.json$/;

/** The name of the record an export leaves in a project's renders/ read: { project, date, time }, `time` to the second, "13:56:40", or null
    when it is not such a name. The second it gives is when the export began (8.1). */
export function metaNameOf(name) {
  if (typeof name !== "string") return null;
  const read = META_NAME.exec(name.normalize("NFC"));
  if (!read) return null;
  const [, project, date, hours, minutes, seconds] = read;
  if (!isDay(date) || Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return { project, date, time: `${hours}:${minutes}:${seconds}` };
}

/** What an export's record says, from its text: { complete, exportedTo, format, resolution }, or null when the text is not JSON or not an
    object. `complete` is true unless the record says another status than "complete"; one with no status counts as complete. `exportedTo` is
    where the file went, an absolute path, or null when the record gives none that is. The fingerprint is not carried: it is not the
    file's SHA-256 (8.1), so it says nothing about whether a file is whole. Other keys are passed over, as is a missing `settings`. */
export function metaOf(text) {
  let told;
  try {
    told = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (told === null || typeof told !== "object" || Array.isArray(told)) return null;
  const settings = told.settings !== null && typeof told.settings === "object" ? told.settings : {};
  return {
    complete: told.status === undefined || told.status === "complete",
    exportedTo: typeof told.exportedTo === "string" && told.exportedTo.startsWith("/") ? told.exportedTo : null,
    format: typeof settings.format === "string" ? settings.format : "",
    resolution: typeof settings.resolution === "string" ? settings.resolution : ""
  };
}

/** When an export began, from the day and the time on its name: { ms, exact }. `exact` is true when the name gave the second (a record's
    does), and false when it gave only the minute (a file's does), in which case `ms` is the start of that minute. */
export function beganAt({ date, time }, zone = LOCAL_ZONE) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return { ms: zone.ms(year, month, day, hours, minutes, seconds ?? 0), exact: seconds !== undefined };
}

/** The folders the command line's own `catch-up` skips when it looks for what changed in a project: a name that starts with a dot,
    node_modules, renders and snapshots, so that the agent's own render, snapshot and check do not look like edits (8.1). */
const NOT_CHANGES = new Set(["node_modules", "renders", "snapshots"]);
const notAChange = (part) => part.startsWith(".") || NOT_CHANGES.has(part);

/** When a project last changed in the app, in milliseconds, or null when that is not known: the later of its newest file change, outside
    the folders above at any depth, and its last turn in app-history.jsonl. `files` are { path, mtimeMs }, a path from the project's folder
    with "/", and `turns` are the app's turns (hyperframes.js turnsOf). A turn whose date is not a date is passed over. */
export function lastChangeOf({ files = [], turns = [] } = {}) {
  let latest = null;
  const see = (ms) => {
    if (Number.isFinite(ms) && (latest === null || ms > latest)) latest = ms;
  };
  for (const file of files) if (file && typeof file.path === "string" && !file.path.split("/").some(notAChange)) see(file.mtimeMs);
  for (const turn of turns) see(typeof (turn && turn.at) === "string" ? Date.parse(turn.at) : NaN);
  return latest;
}

/** How much of the end of app-history.jsonl is read: a megabyte, as the command line's catch-up reads it. */
const HISTORY_BYTES = 1000000;

/** The end of a text file, at most `bytes` of it, or "" when it cannot be read. The first line may be cut: a reader of turns passes over a
    line that is not JSON. */
function tailOf(path, bytes) {
  let fd;
  try {
    fd = openSync(path, "r");
    const start = Math.max(0, fstatSync(fd).size - bytes);
    const buffer = Buffer.alloc(fstatSync(fd).size - start);
    readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } catch (e) {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** When the project in the folder `dir` last changed (lastChangeOf), read from the disk: every file in it but those in the folders it
    skips, a link counting for its own time and never followed, and the app's history. null when the folder is not here, or holds nothing
    that counts. */
export function projectChange(dir) {
  const files = [];
  const walk = (folder, rel) => {
    let entries = [];
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      if (notAChange(entry.name)) continue;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(folder, entry.name), path);
        continue;
      }
      try {
        files.push({ path, mtimeMs: lstatSync(join(folder, entry.name)).mtimeMs });
      } catch (e) {
        // A file gone while the folder was read changes nothing.
      }
    }
  };
  walk(dir, "");
  return lastChangeOf({ files, turns: turnsOf(tailOf(join(dir, ".hyperframes", "app-history.jsonl"), HISTORY_BYTES)) });
}
