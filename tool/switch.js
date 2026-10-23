// What keeps a Mac's drop folder from being switched: the work still in the old folder. The installer (install.sh --machine
// with --drop) switches the folder a Mac watches by writing its settings, through `node settings.js write`, and the Mac then
// watches the new folder and no longer the old, which is left as it is. A video still in the old one would be left there, never
// imported, and an import that failed, or whose late check found a problem, is for a person to see to (retry) from the
// drop folder it is in. So the switch is refused until they are dealt with. Nothing here changes anything.
// This file reads the status files (importing.js) and the episodes (filing.js), and both of them read settings.js, so
// settings.js reaches this file by a dynamic import from the command that needs it, and not by a static one: a static import
// would make the three a cycle.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isMedia } from "./lib.js";
import { clockTime, dueAt, holdingEpisode, readPendings } from "./filing.js";
import { importState, readStatuses } from "./importing.js";
import { dropFolder, importingFolder } from "./settings.js";

/** The code of an error, as the only thing said of it: its message may hold a path, and a path may hold a client's file name. */
const codeOf = (e) => (e && e.code) || "an error";

/** The names in `folder`: { names }, none when the folder is not there, or { code } when it cannot be read. Only a folder that
    is not there is empty: one that macOS has not let node read (it asks about Dropbox) is not known to be. */
function namesIn(folder) {
  try {
    return { names: readdirSync(folder) };
  } catch (e) {
    return e.code === "ENOENT" ? { names: [] } : { code: codeOf(e) };
  }
}

/** What the old drop folder `old` ("Unedited Video" or "Drop") of the Mac `machine`, in BRIMM Video at `root`, still holds that
    stops the switch, in plain words: { work, imported, kept, unreadable }, each a list of lines, all [] when it holds nothing of
    the kind. `work` is a video in the folder (the marker, the files Finder keeps and the parts of a file still arriving are
    none), and an import of this Mac, in Episodes/.importing, that failed or whose late check found a problem. A video that an
    episode holds already is imported, and is one of two kinds, by whether `home`, this Mac's own folder, holds the late check
    this Mac still has to make for it: `imported` has one, so the video leaves the folder once it has passed, is to be waited
    for and never taken out, and its line says when it is due; `kept` has none (its late check has passed, or it is a copy of an
    imported video), so nothing of this Mac's import will take it out, and a person deletes it. `unreadable` is what could not be read, with the error's code and the folder's own path, which holds no video's
    name: the old folder, or the status files. `now` is a time in milliseconds, for the status files.
    A line names a thing by a label when it has one: a light import's status carries its video's label, and the record of an
    episode that holds the video does too. A video, or a status, that has none is counted and not named when `light` says the
    import is the light one (its name may be a client's, and nothing about an unanswered video, its file name included, is to
    reach a chat), and is named by its video's file name when the import is today's. A status is never named by its own file's
    name; and what it says of why it failed is left out, as it may hold a file's name. */
export function heldInOld({ root, machine, old, light, home, now = Date.now() }) {
  const folder = dropFolder(root, machine, old);
  const unreadable = [];
  const inFolder = namesIn(folder);
  if (inFolder.code) unreadable.push(`  The old folder, ${folder}, could not be read (${inFolder.code}), so what it holds is not known.`);
  const videos = (inFolder.names || []).filter(isMedia).sort();
  const importing = namesIn(importingFolder(root));
  if (importing.code) unreadable.push(`  The import status files, in ${importingFolder(root)}, could not be read (${importing.code}), so whether an import failed is not known.`);
  const mine = importing.code ? [] : readStatuses(root, now).map((s) => s.status).filter((status) => status && status.machine === machine);
  const lines = new Set();
  const named = new Set();
  const trouble = mine.filter((s) => ["failed", "problem"].includes(importState(s, now))).sort((a, b) => a.video.localeCompare(b.video));
  let failed = 0;
  let problems = 0;
  for (const status of trouble) {
    named.add(status.video);
    const isFailed = importState(status, now) === "failed";
    if (light && !status.label) {
      if (isFailed) failed += 1;
      else problems += 1;
      continue;
    }
    const what = isFailed ? "its import failed" : "it was copied in, but its late check found a problem";
    // A failed import whose video has since been taken out of the folder cannot be tried again: only its status file holds it.
    const gone = videos.includes(status.video) || inFolder.code ? "" : `, and its video is not in the old folder now: only its status file, in ${importingFolder(root)}, holds this, and a person takes it away by hand`;
    lines.add(`  ${status.label || status.video}: ${what}${gone}.`);
  }
  if (failed) lines.add(`  ${failed === 1 ? "1 import" : `${failed} imports`} failed.`);
  if (problems) lines.add(`  ${problems === 1 ? "1 late check" : `${problems} late checks`} found a problem.`);
  const pendings = home ? readPendings(home) : [];
  const imported = new Set();
  const kept = new Set();
  let counted = 0;
  let importedCounted = 0;
  let keptCounted = 0;
  for (const video of videos.filter((v) => !named.has(v))) {
    // A video that cannot be looked at (a link that goes round in a circle) is a video all the same, whose size is not known.
    let bytes;
    try {
      bytes = statSync(join(folder, video)).size;
    } catch (e) {
      bytes = undefined;
    }
    const holding = holdingEpisode({ root, video, bytes });
    const label = mine.find((s) => s.video === video && s.bytes === bytes && s.label)?.label || holding?.record.label;
    if (holding) {
      // Whether this Mac still owes the episode's late check for it: it is then to be waited for. If not, the late check has passed,
      // or it is a copy of an imported video, and filing.js leaves it in the drop folder for a person to delete.
      const pending = pendings.find((p) => p.video === video && p.bytes === bytes && p.machine === machine && p.root === root);
      if (pending) {
        if (!label && light) importedCounted += 1;
        else imported.add(`  ${label || video}: already imported; its late check is still to come (due at ${clockTime(dueAt(pending))}).`);
      } else if (!label && light) keptCounted += 1;
      else kept.add(`  ${label || video}: already imported, and nothing of this Mac's import will take it out of the old folder: its late check has passed, or it is a copy of an imported video.`);
    } else if (label) lines.add(`  ${label}: waits in ${folder}.`);
    else if (light) counted += 1;
    else lines.add(`  ${video}: waits in ${folder}.`);
  }
  if (counted) lines.add(`  ${counted === 1 ? "1 video waits" : `${counted} videos wait`} in ${folder}.`);
  if (importedCounted) imported.add(importedCounted === 1 ? "  1 video is already imported, and its late check is still to come." : `  ${importedCounted} videos are already imported, and their late checks are still to come.`);
  if (keptCounted) kept.add(keptCounted === 1 ? "  1 video is already imported, and nothing of this Mac's import will take it out of the old folder." : `  ${keptCounted} videos are already imported, and nothing of this Mac's import will take them out of the old folder.`);
  return { work: [...lines], imported: [...imported], kept: [...kept], unreadable };
}
