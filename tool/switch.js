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
import { holdingEpisode } from "./filing.js";
import { importState, readStatuses } from "./importing.js";
import { dropFolder, importingFolder } from "./settings.js";

/** What the old drop folder `old` ("Unedited Video" or "Drop") of the Mac `machine`, in BRIMM Video at `root`, still holds that
    stops the switch, in plain words, one line each: [] when it holds nothing of the kind. A video in the folder (the marker, the
    files Finder keeps and the parts of a file still arriving are none), and an import of this Mac, in Episodes/.importing, that
    failed or whose late check found a problem. `now` is a time in milliseconds, for the status files.
    A line names a thing by a label when it has one: a light import's status carries its video's label, and the record of an
    episode that holds the video does too. A video that has none is counted and not named when `light` says the import is the
    light one (its name may be a client's, and nothing about an unanswered video, its file name included, is to reach a chat),
    and is named by its file name when the import is today's. A status is named by its label, else by its video's file name,
    and never by its own file's name; and what it says of why it failed is left out, as it may hold a file's name. */
export function heldInOld({ root, machine, old, light, now = Date.now() }) {
  const folder = dropFolder(root, machine, old);
  let videos = [];
  try {
    videos = readdirSync(folder).filter(isMedia).sort();
  } catch (e) {
    // The old folder is not there, or cannot be read: it holds nothing that a switch could leave behind.
  }
  const mine = readStatuses(root, now).map((s) => s.status).filter((status) => status && status.machine === machine);
  const lines = new Set();
  const named = new Set();
  const trouble = mine.filter((s) => ["failed", "problem"].includes(importState(s, now))).sort((a, b) => a.video.localeCompare(b.video));
  for (const status of trouble) {
    named.add(status.video);
    const what = importState(status, now) === "failed" ? "its import failed" : "it was copied in, but its late check found a problem";
    // A failed import whose video has since been taken out of the folder cannot be tried again: only its status file holds it.
    const gone = videos.includes(status.video) ? "" : `, and its video is not in the old folder now: only its status file, in ${importingFolder(root)}, holds this, and a person takes it away by hand`;
    lines.add(`  ${status.label || status.video}: ${what}${gone}.`);
  }
  let counted = 0;
  for (const video of videos.filter((v) => !named.has(v))) {
    const bytes = statSync(join(folder, video), { throwIfNoEntry: false })?.size;
    const label = mine.find((s) => s.video === video && s.bytes === bytes && s.label)?.label || holdingEpisode({ root, video, bytes })?.record.label;
    if (label) lines.add(`  ${label}: waits in ${folder}.`);
    else if (light) counted += 1;
    else lines.add(`  ${video}: waits in ${folder}.`);
  }
  if (counted) lines.add(`  ${counted === 1 ? "1 video waits" : `${counted} videos wait`} in ${folder}.`);
  return [...lines];
}
