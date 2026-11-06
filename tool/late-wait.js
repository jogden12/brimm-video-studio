// What a run that must wait for the import's late check can do instead of waiting (plan R1b), and when that check is made. The late
// check is never skipped: it is still made by the import, behind the run. A run that only reads the video, to make a copy of it on
// this Mac's own disk, may read the file this Mac already holds, the one the import put into Dropbox from, while this Mac still
// owes the check for that video. It is used only when it is the file that came in (the same size as the record's, and the same
// file as the pending check says by its inode, size and time), and whole on this Mac. Otherwise the run waits as before.
import { statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { LATE_CHECK_MS } from "./dropbox.js";
import { dueAt, readPendings, sameFile } from "./filing.js";
import { importState, readStatuses } from "./importing.js";

/** This Mac's pending late check of the episode with `record`, with no problem found: the check it still owes, or undefined. */
const owedFor = (ctx, record) => readPendings(ctx.home).find((p) => p.id === record.id && p.machine === ctx.machine && resolve(String(p.root)) === resolve(ctx.root) && !p.problem);

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
  const owed = owedFor(ctx, record);
  const bytes = record.video && record.video.bytes;
  if (!owed || !Number.isFinite(bytes)) return null;
  const usable = (path) => typeof path === "string" && path !== "" && sizeOf(path) === bytes && ctx.isWhole(path);
  if (usable(owed.drop) && sameFile(owed.drop, owed.dropFile)) return { path: owed.drop };
  // A drop file that is there but is not the one imported is never made good by the entry that was put in from it.
  const name = record.video.file;
  const entry = owed.entries.find((e) => e && basename(String(e.to)) === name && e.from !== owed.drop && usable(e.from));
  return entry ? { path: entry.from } : null;
}

/** When the import's late check will have been made of the episode with this `record`, in milliseconds, or null when nothing is
    holding it. This Mac owes the check (a pending one in its own folder, which has not found a problem): it is due at its time,
    or now when that has passed, since the import makes a check that is due within a minute. Or an import of the video is at
    work on either Mac, by its status: then the check is made at the latest LATE_CHECK_MS from now, since the video has been
    copied into its episode already. A check that found a problem, or an import that failed or stopped, does not clear by
    itself, and holds nothing here: the reading says why when it meets it. */
export function lateCheckAt(ctx, record) {
  const now = ctx.now();
  const owed = owedFor(ctx, record);
  if (owed) return Math.max(dueAt(owed), now);
  const working = readStatuses(ctx.root, now).map((s) => s.status).find((s) => s && s.video === record.video.file && s.bytes === record.video.bytes && importState(s, now) === "running");
  return working ? now + LATE_CHECK_MS : null;
}
