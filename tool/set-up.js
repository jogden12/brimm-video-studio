// The record of the build of BRIMM Video Studio that last set this Mac up: set-up.json in Studio's support folder, beside
// settings.json. The setup engine writes it at the end of a setup, a repair or an update whose installer ended well. When the app's
// own build is another, the Mac has a newer copy that has yet to finish its update: the status says it needs an update, and `behind`
// says to open the app once. Sparkle tells the new copy nothing, and does not always open it, so this record is how it is known.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isInstalled } from "./build.js";
import { settingsFile } from "./settings.js";

/** What `behind` says while the app's own build has not finished an update on this Mac. */
export const UNFINISHED = "BRIMM Video Studio was updated on this Mac. Open it once so it finishes the update, then start a new chat.";

/** The record: set-up.json, in the folder settings.json is in. */
export const setUpFile = (home) => join(dirname(settingsFile(home)), "set-up.json");

/** The build number the record holds, or null when there is no record, or it cannot be read, or it holds no whole build number above
    0. Never throws. */
export function readSetUp(home) {
  try {
    const record = JSON.parse(readFileSync(setUpFile(home), "utf8"));
    const build = record !== null && typeof record === "object" && !Array.isArray(record) ? record.build : undefined;
    return Number.isSafeInteger(build) && build > 0 ? build : null;
  } catch (e) {
    return null;
  }
}

/** Writes the record of `build` (what buildOf gives): its build number and its version, on one line ended by a line feed, to a temp
    file beside the record and then renamed into place. The support folder is made when it is not there. False when the record could
    not be written. Never throws. */
export function writeSetUp(home, build) {
  let temp = "";
  try {
    const file = setUpFile(home);
    mkdirSync(dirname(file), { recursive: true });
    temp = join(dirname(file), `.set-up.json.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`);
    writeFileSync(temp, `${JSON.stringify({ version: 1, build: build.build, app: build.version })}\n`);
    renameSync(temp, file);
    return true;
  } catch (e) {
    try {
      if (temp) rmSync(temp, { force: true });
    } catch (e2) {
      // A temp file that cannot be taken away is left.
    }
    return false;
  }
}

/** The rule of an unfinished update, given `setUpBy`, the build number the record holds (what readSetUp gives): the build is an
    installed Mac's, its build file can be read, and the record is not of this build (or there is none). Reads no file. */
export const unfinishedBy = (setUpBy, build) => isInstalled(build) && !build.broken && setUpBy !== build.build;

/** Whether this Mac has an app whose update is not finished: unfinishedBy, with this Mac's record. */
export const unfinished = (home, build) => unfinishedBy(readSetUp(home), build);
