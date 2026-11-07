// The recordings moved into Original files after the hand-off (Phase 3, the local working folder; L6, design D6). At the hand-off of a video kept on
// a Mac, every recording she dropped for it (a plan's parts, a part that shows a client included) is copied into its own episode's Original files/
// in Dropbox, behind her, by the launch agent. The Mac's copy is deleted only once the copy in Dropbox is whole, the record in force lists it, and
// Dropbox says it is uploaded. A session's recording, or one held beside a session, never moves. Every file made from a recording stays where it
// is. The move and the check are filing.js' pendings of the kind `original`, made by `checkOriginal` under the episode's late-check lock.
// This module and filing.js, finish.js and footage.js import each other: every name is used only inside a function, but `checkOriginal`, a function
// declaration (bound before any module of the cycle runs), which filing.js' CHECKS names at its top level.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { cloneIn, isWhole, replaceIn, sameBytes, textWriter, uploadedOf } from "./dropbox.js";
import { acceptRev, isFromPlan, isPart, kindOf, lastWritten, readEpisode, recordNumbers, shownName, undone, writeEpisode } from "./episode.js";
import { FOLDER_GONE, LOCK_AGAIN_MS, WAIT_LOOK_FOR_MS, WAIT_LOOK_MS, askAgent, commitOf, dueAt, fileId, judgeEntry, logTo, putOwnRecordBack, ruleOpts, readEveryPending, readPendingAt, recordHolds, removePending, sameFile, settleReading, writePending } from "./filing.js";
import { linksOf, matchedSession } from "./finish.js";
import { partsOf } from "./footage.js";
import { gated, heldName } from "./gate.js";
import { releaseEpisodeLock, takeEpisodeLock, lockOf, runningRun } from "./detached.js";
import { episodeFilesFolder, episodeWork, episodesFolder, runsFolder, workFolder } from "./settings.js";
import { workCopyLockOf } from "./workcopy.js";
import { ORIGINALS_FOLDER, keptOnAMac } from "./where.js";

/** The name the move's and the check's lock holds for the episode's own lock, what `status` and a stopped command say it is. */
export const ORIGINALS_COMMAND = "originals";
/** How soon the check looks again at a copy Dropbox has not uploaded yet: every ten minutes, for an hour (WAIT_LOOK_FOR_MS), then once at each run's start. */
export const UPLOAD_LOOK_MS = 10 * 60 * 1000;

/** What a command of hers that meets the move's lock says; the rest of the sentence is how to ask again. */
export const ORIGINALS_RUNNING = "Its recording is being copied into Dropbox.";
/** The notice, posted once, and the guide's line, when the copy in Original files could not be kept whole in Dropbox. */
export const ORIGINALS_PROBLEM = (name) => `The recording of ${name} stays on this Mac: Dropbox didn't keep its copy whole. Ask Jason.`;
/** The guide's and `episodes`' line for a video that became a session after its recording was copied. */
export const ORIGINALS_SESSION = (label) => `The recording of ${label} was copied into Dropbox, in Original files, before it became a session. Dropbox keeps it there and in its history. Jason removes it by hand if he wants.`;

/** Whether a record lists its recording in Original files/ at a whole number of bytes. */
export const listsOriginal = (record) => Boolean(record) && typeof record.video === "object" && record.video !== null && Number.isInteger((record.files || {})[`${ORIGINALS_FOLDER}/${record.video.file}`]);

/** Whether a record's recording has moved into Original files/: it is kept on a Mac and holds `local.original`, or lists the copy. */
export const moved = (record) => keptOnAMac(record) && ((typeof record.local.original === "object" && record.local.original !== null) || listsOriginal(record));

/** Whether the gate holds a recording as a session: a part when the video its import matched is a session not cleared, or it is held beside one (a part is gated as
    a video with no kind always, so only these hold it); any other video when gated, a session, held beside one, or matching one. `links` is finish.js linksOf. */
export function asSession(links, { folder, record }) {
  if (isPart(record)) return matchedSession(links, record, { folder }) || links.sessionsBeside(record, folder).length > 0;
  return gated(record) || kindOf(record) === "session" || links.sessionsBeside(record, folder).length > 0 || matchedSession(links, record, { folder });
}

/** The recordings a video's hand-off owes, as { name, folder, record }: for a video made from a plan, each of its parts (partsOf); for any other, itself. Of those, each
    kept on this Mac (`ctx.machine`) with a recording named, not moved yet, and not held as a session. `ctx` is { root, machine }. */
export function originalsOf(ctx, { folder, record }) {
  const all = isFromPlan(record) ? partsOf(ctx.root, record.id) : [{ name: basename(folder), folder, record }];
  const mine = all.filter((one) => keptOnAMac(one.record) && one.record.local.on === ctx.machine && one.record.video && typeof one.record.video.file === "string" && !moved(one.record));
  if (!mine.length) return [];
  const links = linksOf(ctx.root);
  return mine.filter((one) => !asSession(links, one));
}

const pendingFile = (id) => `original/${id}.json`;

/** The pending that owes the recording of `one`, for the video `of` ({ id, name }) whose hand-off owed it. */
const owedPending = (ctx, one, of) => ({ version: 1, kind: "original", id: one.record.id, name: one.name, folder: one.folder, root: ctx.root, machine: ctx.machine, of, file: one.record.video.file, owed: true, entries: [], work: null, lastCopy: ctx.now() });

/** Owe each recording a video's hand-off owes (originalsOf) that has no pending: a pending written as owed, due at once. With `ask`, the launch agent is asked to run when
    anything was written. A pending already there, or a recording already moved, changes nothing. A write that throws is logged and the next is written. Synchronous. `ctx` is
    { home, root, machine, now, agentRunning, kickstart }. */
export function oweOriginals(ctx, { folder, record }, { ask = true } = {}) {
  const owed = [];
  for (const one of originalsOf(ctx, { folder, record })) {
    if (readPendingAt(ctx.home, pendingFile(one.record.id)) !== null) continue;
    try {
      writePending(ctx.home, owedPending(ctx, one, { id: record.id, name: basename(folder) }));
      owed.push(one.record.id);
    } catch (e) {
      logTo(ctx.home)(`${shownName(one.record)}: its recording could not be noted to go into Original files (${e.code || "an error"}). The launch agent notes it at its next run.`);
    }
  }
  if (ask && owed.length) askAgent(ctx, shownName(record));
  return { owed };
}

/** At a run's start, owe the recording of each handed-off video kept on this Mac that is still in video/, not moved, and owed by no pending: a hand-off writer that stopped
    before it owed, or whose owe could not be written. A part is owed when the video made of its plan has a hand-off. It asks no agent: it is the agent. */
export function oweForgotten({ episode: { root, machine, home }, clock = Date.now, log = () => {} }) {
  const owed = [];
  let names;
  try {
    names = readdirSync(workFolder(home));
  } catch (e) {
    return { owed };
  }
  let links = null;
  for (const name of names) {
    if (name.startsWith(".")) continue;
    try {
      if (!statSync(episodeFilesFolder(home, name), { throwIfNoEntry: false })?.isDirectory()) continue;
      const folder = join(episodesFolder(root), name);
      const read = readEpisode(folder);
      const record = read.record;
      if (!record || read.newer || !keptOnAMac(record) || record.local.on !== machine || moved(record) || !record.video || typeof record.video.file !== "string") continue;
      if (!existsSync(join(episodeFilesFolder(home, name), record.video.file))) continue;
      if (readPendingAt(home, pendingFile(record.id)) !== null) continue;
      links ??= linksOf(root);
      let of;
      if (isPart(record)) {
        const video = links.find(record.partOf.id);
        if (!video || !Number.isInteger(video.record.finished && video.record.finished.revision) || asSession(links, { folder, record })) continue;
        of = { id: video.record.id, name: basename(video.folder) };
      } else {
        if (isFromPlan(record) || !Number.isInteger(record.finished && record.finished.revision) || asSession(links, { folder, record })) continue;
        of = { id: record.id, name };
      }
      writePending(home, owedPending({ root, machine, now: clock }, { name, folder, record }, of));
      owed.push(record.id);
      log(`${shownName(record)}: its recording is noted to go into Original files.`);
    } catch (e) {
      log(`an episode's recording could not be noted to go into Original files (${e.code || "an error"}). The launch agent notes it at its next run.`);
    }
  }
  return { owed };
}

/** The check of an `original` pending (algorithms M and O): not built yet. */
export function checkOriginal(pending, deps) {
  throw new Error("not built");
}
