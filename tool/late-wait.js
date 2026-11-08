// What a run that must wait for the import's late check can do instead of waiting (plan R1b), and when that check is made. The late
// check is never skipped: it is still made by the import, behind the run. A run that only reads the video, to make a copy of it on
// this Mac's own disk, may read the file this Mac already holds, the one the import put into Dropbox from, while this Mac still
// owes the check for that video. It is used only when it is the file that came in (the same size as the record's, and the same
// file as the pending check says by its inode, size and time), and whole on this Mac. Otherwise the run waits as before.
// A reading that replaces files the import's check looks at (plan R1c) need not wait either, on the Mac that owns that check: it
// takes its files out of the check under a lock the check also takes (keepCheckInStep), so the check never puts an older file back
// over one the reading wrote, and still looks at every other file.
// And the making of an episode's HyperFrames project need not wait for the reading's own late check (plan R1d): once the reading is in the
// record, `projectWaits` says to verify the files the project reads against the sizes the record lists (app.js readListed), and
// `readingCheckAt` says when the read run's own check is made, for the words of the commands it stops.
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { LATE_CHECK_MS } from "./dropbox.js";
import { dueAt, readPendings, sameFile, statusReadFolders, takeOutOfCheck } from "./filing.js";
import { holdsVideo, importState, readStatusesIn } from "./importing.js";
import { currentReading, shownName } from "./episode.js";
import { readResult, runningCommand, runningRun } from "./detached.js";
import { clockAt, importHold } from "./unedited.js";
import { keptOnAMac } from "./where.js";

/** This Mac's pending late check of the episode with `record`: the check it still owes, or undefined. It leaves out one that has found a
    problem, unless `problem` is true (projectWaits holds while the check is owed, with or without a problem). */
const owedFor = (ctx, record, { problem = false } = {}) => readPendings(ctx.home).find((p) => p.id === record.id && p.machine === ctx.machine && resolve(String(p.root)) === resolve(ctx.root) && (problem || !p.problem));

/** The size of the file at `path`, or -1 when it is not there. */
const sizeOf = (path) => {
  try {
    return statSync(path).size;
  } catch (e) {
    return -1;
  }
};

/** The file this Mac holds of the video of the episode with `record`, to be read in place of the one in Dropbox while the late
    check is still owed: { path }, or null when there is none to use. For a video that came in from a drop folder it is the drop
    file of this Mac's pending check, when that is the file imported (`sameFile`), is there and whole (`ctx.isWhole`), and has the
    record's size. For a video the join made (its drop file is nobody's and not there) it is the `from` of the pending check's
    entry that was put in under the video's name, when that is there, whole, and of the record's size. */
export function localSource(ctx, record) {
  // An episode kept on this Mac has its video here, and no late check of Dropbox's reads or holds it (Phase 3, L4, D4).
  if (keptOnAMac(record)) return null;
  const owed = owedFor(ctx, record);
  const bytes = record.video && record.video.bytes;
  if (!owed || !Number.isFinite(bytes)) return null;
  // The work copy is keyed by the video in Dropbox, so that must be there, whole and of the record's size: if it is missing or short, it
  // is the very state the late check repairs, and the run waits for the check as before.
  const kept = join(String(owed.folder), record.video.file);
  if (sizeOf(kept) !== bytes || !ctx.isWhole(kept)) return null;
  const usable = (path) => typeof path === "string" && path !== "" && sizeOf(path) === bytes && ctx.isWhole(path);
  if (usable(owed.drop) && sameFile(owed.drop, owed.dropFile)) return { path: owed.drop };
  // A drop file that is there but is not the one imported is never made good by the entry that was put in from it.
  // Its entry is the one put in under the video's own name in the check's own folder: a file of that size and name put in elsewhere is no match.
  const entry = owed.entries.find((e) => e && String(e.to) === kept && e.from !== owed.drop && usable(e.from));
  return entry ? { path: entry.from } : null;
}

/** When the import's late check will have been made of the episode with this `record`, in milliseconds, or null when nothing is
    holding it. This Mac owes the check (a pending one in its own folder, which has not found a problem): it is due at its time,
    or now when that has passed, since the import makes a check that is due within a minute. Or an import of the video is at
    work on either Mac, by its status: then the check is made at the latest LATE_CHECK_MS from now, since the video has been
    copied into its episode already. A check that found a problem, or an import that failed or stopped, does not clear by
    itself, and holds nothing here: the reading says why when it meets it. */
export function lateCheckAt(ctx, record) {
  // Nothing of an episode kept on this Mac waits for Dropbox's check (D4): the checks that remain run behind, and no one waits for them.
  if (keptOnAMac(record)) return null;
  const now = ctx.now();
  const owed = owedFor(ctx, record);
  if (owed) return Math.max(dueAt(owed), now);
  const working = readStatusesIn(statusReadFolders(ctx), now).map((s) => s.status).find((s) => s && s.video === record.video.file && s.bytes === record.video.bytes && importState(s, now) === "running");
  return working ? now + LATE_CHECK_MS : null;
}

/** How often a reading looks again for the lock of the import's late check while the check holds it, and for how long in all (moved to filing.js). */
export { LOCK_LOOK_MS, LOCK_WAIT_MS } from "./filing.js";

/** Whether the only late check that holds the episode with `record` is this Mac's own, so that a reading here can keep it in step instead
    of waiting for it (plan R1c): this Mac owes the check of the record's import (a pending one of this Mac, of this root, with the
    record's id), which has found no problem; and every status of the video (its file and size) that holds it is this Mac's and at work.
    A video joined from parts has no status, so its pending check alone decides. */
export function ownCheckOnly(ctx, record) {
  if (!owedFor(ctx, record)) return false;
  const now = ctx.now();
  return readStatusesIn(statusReadFolders(ctx), now).map((s) => s.status).filter((s) => s && s.video === record.video.file && s.bytes === record.video.bytes && holdsVideo(s, now)).every((s) => s.machine === ctx.machine && importState(s, now) === "running");
}

/** When a reading of the episode with `record` can begin, in milliseconds, or null when it can begin now: the import's late check holds
    nothing of it that it cannot keep in step (`ownCheckOnly`), or nothing holds it. Otherwise the time the check will have been made
    (`lateCheckAt`). */
export function readingWaitsUntil(ctx, record) {
  if (keptOnAMac(record)) return null;
  return ownCheckOnly(ctx, record) ? null : lateCheckAt(ctx, record);
}

/** Take the files a reading is about to put in out of this Mac's own late check of the episode's import, under the lock the check also
    takes (plan R1c): filing.js takeOutOfCheck, moved there so that a writer into final/ can use it too; this keeps its old name, and
    gives the import's problem words (importHold) for a record without `local`. Its results and words are as they always were. */
export const keepCheckInStep = (ctx, step, opts) => takeOutOfCheck(ctx, step, { ...opts, problemWhy: (record) => importHold({ root: ctx.root, statusFolders: statusReadFolders(ctx), home: ctx.home, machine: ctx.machine, record, now: ctx.now() }).why });

/** When the copy of the episode's video for HyperFrames can begin, in milliseconds, or null when nothing holds it (plan R1a). It
    waits for the import's late check (`lateCheckAt`) unless it starts from the local file (`localSource`): that one waits for
    nothing, the check going on behind it. (A reading's own wait is `readingWaitsUntil`, not this: a copy and a reading are held by
    different things.) */
export function lateWaitFor(ctx, record) {
  return localSource(ctx, record) ? null : lateCheckAt(ctx, record);
}

/** A moment on this Mac's clock to the nearest minute, as a time that is worked out is said (a due time is said as the clock shows it). */
const clockNear = (ms) => clockAt(Math.round(ms / 60000) * 60000);

/** What is said of a copy that takes `copySeconds` (null while this Mac has measured no speed) and must wait for the late check:
    { checkAt, readyAt, inSeconds }, "17:15" for when Dropbox has checked its copies, "17:26" for when the copy is ready ("" when
    `copySeconds` is null) and the seconds from now to then (null); or null when it does not wait. */
export function waitFacts(ctx, record, copySeconds) {
  if (keptOnAMac(record)) return null;
  const due = lateWaitFor(ctx, record);
  if (due === null) return null;
  const ready = copySeconds === null || copySeconds === undefined ? null : due + copySeconds * 1000;
  return { checkAt: clockAt(due), readyAt: ready === null ? "" : clockNear(ready), inSeconds: ready === null ? null : Math.max(0, Math.round((ready - ctx.now()) / 1000)) };
}

/** What the making of an episode's HyperFrames project waits for (plan R1d), from the run at work and the record `record` (of the
    folder `name`): "reading" while a read run holds the episode's lock and the record holds no current reading, so there is nothing
    to make a project from yet; "verify" when the reading is in the record (the run is at its own late check) or no read run is at
    work and this Mac owes the import's late check, with or without a problem found: then the project may be made, from the files
    the record lists at the sizes it lists (app.js readListed); "" when nothing holds it. Nothing is locked, written or waited for. */
export function projectWaits(ctx, { name, record }) {
  // On an episode kept on this Mac only "reading" stays: its files are here, so there is no Dropbox file to verify (Phase 3, L4, D4).
  if (keptOnAMac(record)) return runningCommand(ctx.home, name, ctx.alive) === "read" && !currentReading(record) ? "reading" : "";
  if (runningCommand(ctx.home, name, ctx.alive) === "read") return currentReading(record) ? "verify" : "reading";
  return owedFor(ctx, record, { problem: true }) ? "verify" : "";
}

/** When the late check of the read run at work on the episode `name` is made, in milliseconds, or null: the run holding the episode's
    lock is a read (`runningRun`), the record holds the current reading, and the read result is that run's early one (`early`, its
    `pid`), written when the reading put its files in: its end plus LATE_CHECK_MS. Without that result it is not known. */
export function readingCheckAt(ctx, { name, record }) {
  const run = runningRun(ctx.home, name, ctx.alive);
  if (!run || run.command !== "read" || !currentReading(record)) return null;
  const result = readResult(ctx.home, name, "read");
  return result && result.early === true && result.pid === run.pid && Number.isFinite(result.ended) ? result.ended + LATE_CHECK_MS : null;
}
