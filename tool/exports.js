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
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { KEPT, isMain } from "./app.js";
import { historyTail } from "./app-history.js";
import { isDay } from "./episode.js";
import { turnsOf } from "./hyperframes.js";
import { downloadsFolder, episodeWork } from "./settings.js";
import { isHdr } from "./workcopy.js";

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
/** The project's own recording: `free` takes it out and `app` puts it back, with a time of its own. That is no edit. */
const RECORDING = "media/recording.mp4";

/** When a project last changed in the app, in milliseconds, or null when that is not known: the later of its newest file change, outside
    the folders above at any depth and but for the project's own recording (media/recording.mp4), and its last turn in app-history.jsonl.
    `files` are { path, mtimeMs }, a path from the project's folder with "/", and `turns` are the app's turns (hyperframes.js turnsOf). A
    turn whose date is not a date is passed over. */
export function lastChangeOf({ files = [], turns = [] } = {}) {
  let latest = null;
  const see = (ms) => {
    if (Number.isFinite(ms) && (latest === null || ms > latest)) latest = ms;
  };
  for (const file of files) if (file && typeof file.path === "string" && file.path !== RECORDING && !file.path.split("/").some(notAChange)) see(file.mtimeMs);
  for (const turn of turns) see(typeof (turn && turn.at) === "string" ? Date.parse(turn.at) : NaN);
  return latest;
}

/** The flags by which a file the app keeps is opened to be read: no link is followed, and no wait is made on a file that is not a regular
    one. A pipe where the file should be has no writer, and opening it as a plain read waits for one for good (plan PR 10, review I1). */
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** A file the app keeps, `path`, read as text when it is a regular file; null for anything else (a link, a folder, a pipe, a file that is
    not there or cannot be read). It is looked at once it is open, so that what is read is the very file that was looked at. */
function readRegular(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    return fstatSync(fd).isFile() ? readFileSync(fd, "utf8") : null;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** When the project in the folder `dir` last changed (lastChangeOf), read from the disk: every file in it but those in the folders it
    skips, a link counting for its own time and never followed, and the app's history (app-history.js historyTail, which reads a regular
    file alone: a pipe in its place is no history, and is not waited on). null when the folder is not here, or holds nothing that counts. */
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
  return lastChangeOf({ files, turns: turnsOf(historyTail(dir)) });
}

// --- Which export a part takes ---

const nfc = (text) => String(text).normalize("NFC");
const capital = (text) => text[0].toUpperCase() + text.slice(1);
const count = (n) => (n === 2 ? "two" : String(n));
const minuteOf = (ms) => Math.floor(ms / 60000);
const secondOf = (ms) => Math.floor(ms / 1000);
const endingOf = (name) => ((/\.([A-Za-z0-9]+)$/.exec(String(name)) || [])[1] || "").toLowerCase();
const taking = (file) => TAKEN_ENDINGS.includes(file.ending);

/** Where a file is, as a person is told it: the places an export can be found in. */
const FROM = { Downloads: "from Downloads", "another folder": "from another folder", "the other Mac": "from what the other Mac released", renders: "HyperFrames' own render" };
/** Whether a file is on the other Mac's side, as a person is told: on this Mac, or from the other Mac. */
const placeOf = (file) => (file.where === "the other Mac" ? "from the other Mac" : "on this Mac");

/** Files as a person is told them: by name, and by where each is when two have one name. */
function shown(files) {
  const twice = (f) => files.filter((g) => nfc(g.name) === nfc(f.name)).length > 1;
  const order = (f) => `${nfc(f.name)}\u0000${f.where === "the other Mac" ? 1 : 0}`;
  return [...files].sort((a, b) => (order(a) < order(b) ? -1 : 1)).map((f) => (twice(f) ? `${f.name} ${placeOf(f)}` : f.name)).join(", ");
}
/** The files, but for one with the name and the size of an earlier one: the same export, in both places, is taken once. */
const once = (files) => files.filter((f, i) => !files.some((g, k) => k < i && nfc(g.name) === nfc(f.name) && g.bytes === f.bytes));

/** The video a part is given, as the detached part is told it. */
const videoOf = (file) => ({ name: file.name, dir: file.dir, where: file.where, bytes: file.bytes, mtimeMs: file.mtimeMs, began: file.began ?? null });

/** The files that can be a part's export: those its own records name (`part.recorded`), and those in Downloads and in what the other Mac
    released whose name is an export's name for the part's project. A file found both ways is one, the record's; one with nothing in it
    is none. Each is { name, dir, where, bytes, mtimeMs, began, ending }. */
function candidatesOf(part, input, zone) {
  const out = [];
  const at = new Map();
  const add = (candidate) => {
    const key = `${nfc(candidate.dir)}\u0000${nfc(candidate.name)}`;
    if (!at.has(key)) {
      at.set(key, out.length);
      out.push(candidate);
    } else if (candidate.via === "record") out[at.get(key)] = candidate;
  };
  for (const recorded of part.recorded || []) add({ ...recorded, via: "record", ending: endingOf(recorded.name) });
  for (const [place, where] of [[input.downloads, "Downloads"], [input.released, "the other Mac"]]) {
    for (const file of place.files) {
      const read = exportNameOf(file.name);
      if (read && nfc(read.project) === nfc(part.project)) add({ ...file, dir: place.dir, where, via: "name", ending: read.ending, began: beganAt(read, zone) });
    }
  }
  return out.filter((candidate) => candidate.bytes > 0);
}

/** What `finish` looks for among HyperFrames' exports, and what it asks (architecture 8.1, plan PR 7), in plain data.
    `input`: { parts, downloads, released, finished, zone }. A part is { key, label, reel?, project, fromSuggestion, here, mac, changed,
    recorded, renders }: its key ("main" or "reel 2") and label ("the main video", "Reel 2"), the project's name, the suggestion a Reel
    was made from, whether the project is on this Mac and the Mac it was made on, when it last changed (projectChange, null when not known),
    the files its records name (each with `where` and `began`), and the renders in its renders/ that no record names. `downloads` and
    `released` are { dir, files }, their video files as { name, bytes, mtimeMs }. `finished` is the record's last finish, for a part kept.
    `answers`: { take: { <key>: <a file's name, "this Mac" or "the other Mac"> }, final: [<key>], without: [<key>] }. `rest` is false when
    the main video is finished another way, in which case a Reel the last finish finished that has no project here is left to that way.
    Gives { parts, asks, stops, mentions, looked }: each part taken as { key, label, reel?, project, projects, fromSuggestion, video, export:
    null, kept, noHandEdits: false, line }, with `video` null when the part is kept as the last finish made it; the questions she is to
    answer; what finish cannot get past by an answer; what was passed over (a WebM, a render); and where it looked. Nothing is touched. */
export function lookForExports(input, answers = {}, { rest = true } = {}) {
  const { take = {}, final = [], without = [] } = answers || {};
  const zone = input.zone || LOCAL_ZONE;
  const finished = input.finished && input.finished.parts ? input.finished : null;
  const finishedAt = finished ? Date.parse(finished.at) : NaN;
  const asks = [];
  const stops = [];
  const mentions = [];
  const out = [];
  for (const part of input.parts) {
    const { key, label } = part;
    const Cap = capital(label);
    const made = (video, line, over = {}) => out.push({ key, label, ...(part.reel ? { reel: part.reel } : {}), project: part.project, projects: [part.project], fromSuggestion: part.fromSuggestion, video, export: null, kept: false, noHandEdits: false, line, ...over });
    const keep = () => made(null, `${Cap}: kept as the last finish made it.`, { kept: true });
    const before = finished ? finished.parts[key] : undefined;
    const prior = before && before.project === part.project ? before : null;
    // A Reel left out of this finish that the last finish finished stays in the hand-off, as lookFor keeps one.
    if (key !== "main" && without.includes(key)) {
      if (before) keep();
      continue;
    }
    const candidates = candidatesOf(part, input, zone);
    // An export that ended before the one the last finish took is a leftover of an earlier try: finish removes the export it took, and no
    // other. It is passed over, so that the part is kept as that finish made it, and an answer that it is final cannot hand it off in place
    // of the good one. The file the last finish took (the same time) is not older, and a file she names is taken whatever its age.
    const tookAt = prior && prior.source && Number.isFinite(prior.source.mtimeMs) ? prior.source.mtimeMs : null;
    const exports = once(candidates.filter(taking)).filter((file) => tookAt === null || !(file.mtimeMs < tookAt));
    const webms = candidates.filter((candidate) => candidate.ending === "webm");
    const renders = (part.renders || []).filter((file) => file.bytes > 0).map((file) => ({ ...file, where: "renders", ending: endingOf(file.name) }));
    /** What was passed over, said when a part has no export taken, or (a WebM) when one began after the export that is. */
    const passedOver = (than) => {
      for (const webm of webms) if (than === undefined || webm.began.ms > than.began.ms) mentions.push(`${webm.name} is a WebM, which is not taken: export it again as MP4.`);
      if (than === undefined && renders.length) {
        const newest = renders.reduce((best, file) => (file.mtimeMs > best.mtimeMs ? file : best));
        mentions.push(`${Cap}'s project has a video that HyperFrames' own render made, ${newest.name}. It is not an export, so it is not taken. Export it from HyperFrames, or tell me its file name to use it.`);
      }
    };

    // A file she names: wherever it is, whatever it is called, and with no check against the project's last change.
    if (take[key] !== undefined) {
      const said = nfc(take[key]);
      const lower = said.toLowerCase();
      const place = lower === "this mac" ? "this" : lower === "the other mac" ? "other" : "";
      const notAnExport = () => asks.push(`"${take[key]}" is not an export of ${label}. ${exports.length ? `The ones there are: ${shown(once(exports))}.` : "There is none there."} Which is the final one?`);
      let chosen;
      if (place) {
        const inPlace = exports.filter((file) => (file.where === "the other Mac") === (place === "other"));
        const newest = inPlace.length ? Math.max(...inPlace.map((file) => minuteOf(file.began.ms))) : null;
        const group = inPlace.filter((file) => minuteOf(file.began.ms) === newest);
        if (!group.length) notAnExport();
        else if (group.length > 1) asks.push(`For ${label} there are ${count(group.length)} exports ${placeOf(group[0])}: ${shown(group)}. Which is the final one?`);
        else [chosen] = group;
      } else {
        const listed = [[input.downloads, "Downloads"], [input.released, "the other Mac"]]
          .flatMap(([folder, where]) => folder.files.map((file) => ({ ...file, dir: folder.dir, where, ending: endingOf(file.name) })))
          .filter((file) => taking(file) && file.bytes > 0);
        const named = once([...exports, ...listed, ...renders.filter(taking)]).filter((file) => nfc(file.name) === said);
        const here = named.filter((file) => file.where !== "the other Mac");
        const there = named.filter((file) => file.where === "the other Mac");
        if (!named.length) notAnExport();
        else if (here.length && there.length) asks.push(`${named[0].name} is both on this Mac and from the other Mac, and they differ. Say which: this Mac, or the other Mac.`);
        else [chosen] = here.length ? here : there;
      }
      if (chosen) made(videoOf(chosen), `${Cap}: ${chosen.name}, ${FROM[chosen.where]}, the file you named.`);
      else passedOver();
      continue;
    }

    // Nothing to take: the part the last finish took is kept, a Reel is asked about, and the main video stops.
    if (!exports.length) {
      if (prior) {
        const changedSince = part.here && part.changed !== null && secondOf(part.changed) > secondOf(finishedAt);
        if (changedSince && !final.includes(key)) asks.push(`${Cap}'s project changed in HyperFrames, at ${zone.text(part.changed)}, after the last hand-off. Export it again from HyperFrames on This Mac, or say the last hand-off is final.`);
        else keep();
        continue;
      }
      if (key !== "main") asks.push(`${Cap} has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name.`);
      else if (!part.here) stops.push(`${Cap}'s HyperFrames project is on ${part.mac}, so its exports are there. Finish it on that Mac.`);
      else stops.push('The main video has no export yet. Export it from HyperFrames on This Mac, as MP4, then say "hand it off" again. If HyperFrames is still exporting it, say it again when the export is done.');
      passedOver();
      continue;
    }

    // The newest by when it began; two that began in one minute are asked about.
    const newest = Math.max(...exports.map((file) => minuteOf(file.began.ms)));
    const top = exports.filter((file) => minuteOf(file.began.ms) === newest);
    if (top.length > 1) {
      asks.push(`For ${label} there are ${count(top.length)} exports that began at ${zone.text(top[0].began.ms)}: ${shown(top)}. Which is the final one?`);
      passedOver();
      continue;
    }
    const [export_] = top;
    // It must have begun after the project's last change, to the second; a start known only to the minute counts to the end of it.
    const upper = export_.began.exact ? export_.began.ms : export_.began.ms + 59999;
    const older = part.here && part.changed !== null && secondOf(part.changed) > secondOf(upper);
    if (older && !final.includes(key)) {
      asks.push(`${Cap}'s newest export, ${export_.name}, began at ${zone.text(export_.began.ms)}, before you last changed it in HyperFrames, at ${zone.text(part.changed)}. Export it again from HyperFrames on This Mac, or say that export is the final one.`);
      continue;
    }
    if (prior && prior.source && prior.source.bytes === export_.bytes && prior.source.mtimeMs === export_.mtimeMs) {
      keep();
      continue;
    }
    const where = FROM[export_.where];
    made(videoOf(export_), !part.here
      ? `${Cap}: ${export_.name}, ${where}. Its project is on ${part.mac}, so the export could not be checked against it.`
      : `${Cap}: ${export_.name}, ${where}, exported ${zone.text(export_.began.ms)}.${older ? " HyperFrames changed after it, and you said it is final." : ""}`);
    passedOver(export_);
  }
  // A Reel the last finish finished that has no project in the record (it was finished another way) stays in the hand-off as that
  // finish made it: leaving it out would take it off the page. When the main video went the Final Cut way (`rest` false), that look
  // keeps such a Reel itself, and keeping it here as well would keep it twice.
  if (finished && rest) {
    const known = new Set(input.parts.map((part) => part.key));
    const number = (key) => Number(key.slice(5));
    for (const key of Object.keys(finished.parts).filter((k) => /^reel [1-9]\d*$/.test(k) && !known.has(k)).sort((a, b) => number(a) - number(b))) {
      out.push({ key, label: `Reel ${number(key)}`, reel: number(key), project: "", projects: [], fromSuggestion: undefined, video: null, export: null, kept: true, noHandEdits: false, line: `Reel ${number(key)}: kept as the last finish made it.` });
    }
  }
  const names = input.parts.map((part) => part.project);
  return { parts: out, asks, stops, mentions, looked: `Looked in Downloads and in what the other Mac released for exports of: ${names.join(", ")}.` };
}

// --- What is read from the disk ---

/** What finish says of a raw video that was never opened in HyperFrames, on a Mac set up for the app (architecture 4.1, plan PR 7). */
export const NEVER_OPENED = 'The main video was never opened in HyperFrames. Say "open it in HyperFrames" first, edit it there, export it on This Mac, then say "hand it off".';
/** What finish says when this Mac will not let it look in Downloads: macOS asks once, and keeps the answer. */
export const DOWNLOADS_UNREADABLE = 'This Mac does not let brimm-video look in the Downloads folder, where HyperFrames puts its exports. Allow it in System Settings, under Privacy & Security, Files and Folders, then say "hand it off" again.';
/** Where `release` puts the exports it copies into the episode for the other Mac (plan PR 11 writes it; this reads it): the way
    `edit/from-final-cut/` holds Final Cut's Shares. */
export const RELEASED_FOLDER = join("edit", "from-hyperframes");

/** Whether a name leads nowhere but a folder of its own: a project's name comes from the record, which Dropbox and the other Mac write. */
const plainName = (name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[/\0]/.test(name);
const isFolder = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
};
const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch (e) {
    return false;
  }
};
/** Whether two paths are one folder, however a link names it. */
function sameFolder(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch (e) {
    return resolve(a) === resolve(b);
  }
}

/** The videos in a folder, by their endings, as { name, bytes, mtimeMs }; a name that starts with a dot, a folder and anything gone while
    it was read are left out. { files, unreadable }: `unreadable` is true when this Mac will not let the folder be read (macOS keeps
    Downloads behind a permission), and a folder that is not there is empty. */
function videosIn(dir, readdir) {
  let names = [];
  try {
    names = readdir(dir);
  } catch (e) {
    return { files: [], unreadable: Boolean(e) && (e.code === "EPERM" || e.code === "EACCES") };
  }
  const files = [];
  for (const name of names) {
    if (name.startsWith(".") || !ENDINGS.includes(endingOf(name))) continue;
    try {
      const found = statSync(join(dir, name));
      if (found.isFile()) files.push({ name, bytes: found.size, mtimeMs: found.mtimeMs });
    } catch (e) {
      // A file gone while the folder was read is none.
    }
  }
  return { files, unreadable: false };
}

/** What a project's renders/ holds of exports: { recorded, renders }. `recorded` are the files its records name (each record that is
    complete, whose name gives the second the export began, and whose `exportedTo` is a video file that is there), each as
    { name, dir, where, bytes, mtimeMs, began }; `renders` are the videos in renders/ that no record names. */
function recordsIn(dir, downloads, zone) {
  const folder = join(dir, "renders");
  let names = [];
  try {
    names = readdirSync(folder);
  } catch (e) {
    return { recorded: [], renders: [] };
  }
  const recorded = [];
  const named = new Set();
  for (const name of names.filter((n) => n.endsWith(".meta.json"))) {
    const when = metaNameOf(name);
    // A record that cannot be read, or is not a regular file (a pipe, a link, a folder), is none.
    const text = readRegular(join(folder, name));
    const told = text === null ? null : metaOf(text);
    if (!told || !told.complete || !told.exportedTo) continue;
    named.add(resolve(told.exportedTo));
    if (!when || !ENDINGS.includes(endingOf(told.exportedTo)) || !isFile(told.exportedTo)) continue;
    const found = statSync(told.exportedTo);
    const inDownloads = sameFolder(dirname(told.exportedTo), downloads);
    recorded.push({ name: basename(told.exportedTo), dir: inDownloads ? downloads : dirname(told.exportedTo), where: inDownloads ? "Downloads" : "another folder", bytes: found.size, mtimeMs: found.mtimeMs, began: beganAt(when, zone) });
  }
  const renders = [];
  for (const name of names) {
    if (name.endsWith(".meta.json") || name.startsWith(".") || !ENDINGS.includes(endingOf(name)) || named.has(resolve(folder, name)) || !isFile(join(folder, name))) continue;
    const found = statSync(join(folder, name));
    renders.push({ name, dir: folder, bytes: found.size, mtimeMs: found.mtimeMs });
  }
  return { recorded, renders };
}

/** What `finish` reads of the disk to look for HyperFrames' exports (plan PR 7): for the main project in use and each Reel project of
    the record (not a project kept for an earlier kind, and not one of a Reel the record says is dropped), whether its folder is on this Mac, when it last changed (projectChange), the
    files its records name and the renders in its renders/ that none does; and the videos in Downloads and in what the other Mac
    released into the episode (`edit/from-hyperframes/`). `home` is this Mac's home, `name` the episode's folder name and `folder` its
    folder in Episodes. Gives { input, unreadable }: `input` is what lookForExports is given, and `unreadable` is true when this Mac will
    not let Downloads be read. `readdir` lists a folder as readdirSync does, for a test to give another. Nothing is written. */
export function exportsFound({ home, name, folder, record, zone = LOCAL_ZONE, readdir = readdirSync }) {
  const downloads = downloadsFolder(home);
  const work = episodeWork(home, name);
  const projects = Array.isArray(record.app && record.app.projects) ? record.app.projects : [];
  const main = projects.find(isMain);
  // A Reel dropped after its project was made (`reel drop`) is no part of a finish: it is not asked for, and an export of it left in
  // Downloads is not handed off, which would make the Reel finished again. A project whose Reel the record does not hold at all stays
  // a part, so that finish can stop on it.
  const dropped = new Set((Array.isArray(record.reels) ? record.reels : []).filter((r) => r && r.status === "dropped").map((r) => `reel ${r.n}`));
  const reels = projects.filter((p) => p.state !== KEPT && /^reel [1-9]\d*$/.test(p.key) && !dropped.has(p.key)).sort((a, b) => Number(a.key.slice(5)) - Number(b.key.slice(5)));
  const parts = [...(main ? [{ project: main, key: "main", label: "the main video" }] : []), ...reels.map((p) => ({ project: p, key: p.key, label: `Reel ${p.key.slice(5)}`, reel: Number(p.key.slice(5)) }))].map(({ project, key, label, reel }) => {
    const dir = plainName(project.name) ? join(work, project.name) : "";
    const here = dir !== "" && isFolder(dir);
    return {
      key, label, ...(reel ? { reel } : {}), project: project.name, fromSuggestion: project.fromSuggestion ?? null, here, mac: project.on,
      changed: here ? projectChange(dir) : null, ...(here ? recordsIn(dir, downloads, zone) : { recorded: [], renders: [] })
    };
  });
  const seen = videosIn(downloads, readdir);
  const releasedDir = join(folder, RELEASED_FOLDER);
  return {
    unreadable: seen.unreadable,
    input: { parts, downloads: { dir: downloads, files: seen.files }, released: { dir: releasedDir, files: videosIn(releasedDir, readdir).files }, finished: record.finished || null, zone }
  };
}

// --- The checks of an export (architecture 8.2), and the rule for what may be removed from Downloads (8.1) ---

/** Whether a file's name is an export's name for the project: the name the app gives what it exports (exportNameOf), of that project,
    compared composed. A file she named, or the app's record named, under another name is not. Only a file with such a name is removed from
    Downloads once it is copied, since a record in a project can be written by the app's agent too (8.1, the originals). */
export function isExportOf(name, project) {
  const read = exportNameOf(name);
  return read !== null && typeof project === "string" && project !== "" && read.project === project.normalize("NFC");
}

/** A picture's shape, in words. */
const shapeOf = (w, h) => (h > w ? "upright" : w > h ? "wider than it is tall" : "square");

/** What is wrong with a finished video's shape for its part, or "". A Reel is upright. The main video has the raw video's shape, so a short
    upright video's main video is upright. `facts` are the video's (cuts.js factsOf) and `raw` the raw video's, as its cut plan keeps them. */
export function shapeFault(part, name, facts, raw) {
  const shape = shapeOf(facts.width, facts.height);
  if (part.reel) return shape === "upright" ? "" : `${name} is ${shape}, and a Reel is upright.`;
  if (!raw || !raw.width || !raw.height) return "";
  const want = shapeOf(raw.width, raw.height);
  return shape === want ? "" : `${name} is ${shape}, and the main video has the raw video's shape: ${want}.`;
}

/** What is wrong with an export's sound, or "": BRIMM Ops reads the words, so an export with no sound cannot be handed off. */
export const soundFault = (facts, name) => (facts && facts.sound ? "" : `${name} has no sound. Export it again from HyperFrames with its sound.`);

/** What to tell her of an export's colour, or "": nothing for the colour of an ordinary picture (BT.709 is what the app writes), a note that
    there are no colour tags to read, and a note that it is HDR, which most players show washed out. Neither stops the finish. `colour` is
    { primaries, transfer } (cuts.js colourOf), or null when the file has no colour tags. */
export function colourNote(colour, name) {
  if (!colour) return `${name} has no colour tags: check by eye that its colours look right.`;
  if (isHdr(colour)) return `${name} is tagged as HDR colour, which most players show washed out: check it by eye, and export it again in standard colour if it looks wrong.`;
  return "";
}
