// What a finish leaves on this Mac's own disk about its late check, for the rest of the tool to read. A finish copies everything into
// final/, writes the record and the hand-off, shows the hand-off in Finder, and then waits at least 15 minutes (dropbox.js
// LATE_CHECK_MS) before it checks the copies in Dropbox again and takes away the originals it took. Her next step, the BRIMM Ops
// page, does not wait for that check, so from the moment the hand-off is written the run leaves a marker, finish.checking.json, in
// the episode's folder in BRIMM Video Work, beside its lock: the guide and `status` read it to say that the hand-off is ready and
// when the check is made. A marker is believed only while the episode's lock is held by a live finish run that took the lock with
// the marker's own nonce (detached.js runningRun), and only while the record still holds the revision the marker names: a run
// that was killed leaves its marker behind, and a process number can be used again.
// A finish whose hand-off was written and that then fails at the late check also leaves finish.problem.json, which the guide reads
// until a later finish ends well. Everything here is on this Mac's own disk, and never in Dropbox.
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { episodeWork } from "./settings.js";
import { runningRun } from "./detached.js";
import { isRunning } from "./run.js";

/** The marker of a finish that is waiting for its late check, in the episode's folder in BRIMM Video Work. */
export const CHECKING_FILE = "finish.checking.json";
/** The note of a finish whose late check found a problem after its hand-off was written. */
export const PROBLEM_FILE = "finish.problem.json";
/** The places a finish takes originals from: the HyperFrames app's exports are in Downloads. A marker an older finish left may name
    another place: it is none now. */
export const PLACES = ["Downloads"];

const checkingFile = (home, folder) => join(episodeWork(home, folder), CHECKING_FILE);
const problemFile = (home, folder) => join(episodeWork(home, folder), PROBLEM_FILE);

/** Write a file whole on this Mac's own disk: under a name of this process's own, then renamed, so that a reader never finds half
    of it. */
function writeWhole(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const writing = `${file}.${process.pid}.writing`;
  writeFileSync(writing, text);
  renameSync(writing, file);
}

/** Leave the marker of a finish that has written its record and shown its hand-off and now waits for its late check: `nonce` is the
    one in the lock the run holds ("" when it holds none, as in a test that calls the finish itself), `revision` the revision of
    the hand-off it wrote, `due` when the check is made (ms), and `took` the places it took originals from (PLACES), in that order.
    Throws when the file cannot be written; the finish then goes on as it did, with nothing said to her of the check. */
export function markChecking(home, folder, { nonce, revision, due, took }) {
  writeWhole(checkingFile(home, folder), `${JSON.stringify({ version: 1, nonce: nonce || "", revision, due, took: PLACES.filter((place) => took.includes(place)) }, null, 2)}\n`);
}

/** Take the marker away, when the run ends however it ends. It is no matter if there is none, or it cannot be taken away: a marker
    nobody holds the lock for is not believed (checkingNow). */
export function clearChecking(home, folder) {
  try {
    rmSync(checkingFile(home, folder), { force: true });
  } catch (e) {
    // Left where it is; checkingNow does not believe it.
  }
}

/** The late check a finish at work on the episode `folder` is waiting for, as its marker says: { revision, due, took }, or null when
    none is. The marker counts only while the episode's lock is held by a live finish run (`alive` says whether a process is
    running) that took it under the marker's own nonce, and only while `record`, the record in force, still holds the revision it
    names (`record.finished.revision`): otherwise it was left by a run that is gone or by an older one, or another write has
    changed what the finish wrote. A marker that cannot be read, or is not as it should be, is none. */
export function checkingNow(home, folder, record, alive = isRunning) {
  const run = runningRun(home, folder, alive);
  if (!run || run.command !== "finish" || run.nonce === "") return null;
  let marker = null;
  try {
    marker = JSON.parse(readFileSync(checkingFile(home, folder), "utf8"));
  } catch (e) {
    return null;
  }
  const shaped = marker !== null && typeof marker === "object" && marker.version === 1 && marker.nonce === run.nonce && Number.isInteger(marker.revision) && Number.isFinite(marker.due) && Array.isArray(marker.took);
  if (!shaped) return null;
  const finished = record !== null && typeof record === "object" ? record.finished : null;
  const holds = finished !== null && typeof finished === "object" && finished.revision === marker.revision;
  return holds ? { revision: marker.revision, due: marker.due, took: PLACES.filter((place) => marker.took.includes(place)) } : null;
}

/** Note that the late check of a finish whose hand-off was written found a problem, at `at` (ms), to be told until a later finish
    ends well (clearProblem). Throws when the note cannot be written. */
export function flagProblem(home, folder, at) {
  writeWhole(problemFile(home, folder), `${JSON.stringify({ version: 1, at }, null, 2)}\n`);
}

/** Take the note away: a finish ended well. It is no matter if there is none, or it cannot be taken away. */
export function clearProblem(home, folder) {
  try {
    rmSync(problemFile(home, folder), { force: true });
  } catch (e) {
    // Left where it is: the guide goes on telling it, until a finish ends well again.
  }
}

/** Whether the episode has a late check that found a problem, not put right by a later finish (flagProblem). */
export const problemFlagged = (home, folder) => statSync(problemFile(home, folder), { throwIfNoEntry: false }) !== undefined;
