// How the finish her last yes started has gone, as this Mac's own disk says. finish.asked.json, which `finish … --yes` writes in the
// episode's folder in BRIMM Video Work, says when she said yes, and the result file of the run it started (detached.js) says how that run
// ended. `finish … --yes` reads it to know that the run began and ended before it looked for the run's lock, and the guide to tell a
// finish that ended without a hand-off at its first look. The result of a run that began before her yes is an earlier finish's, and none of
// this one. Everything here is on this Mac's own disk, and never in Dropbox.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { episodeWork } from "./settings.js";
import { readResult } from "./detached.js";

/** The file the quick part of a finish writes when she says yes: what to finish, and when (`at`, as the record keeps times). */
export const ASKED_FILE = "finish.asked.json";

/** When she last said yes to a finish of the episode `folder`, in milliseconds, or null when no yes is on file or it is not dated. */
export function askedAt(home, folder) {
  try {
    const asked = JSON.parse(readFileSync(join(episodeWork(home, folder), ASKED_FILE), "utf8"));
    const at = asked !== null && typeof asked === "object" && typeof asked.at === "string" ? Date.parse(asked.at) : Number.NaN;
    return Number.isFinite(at) ? at : null;
  } catch (e) {
    return null;
  }
}

/** The finish her last yes started, once its run has ended: { yes, result }, the time of the yes (ms) and the result the run left
    (detached.js), or null when there is none. Its result counts only when the run began at or after the yes: an older run's belongs
    to an earlier yes, and so does the early result a run writes while it still works. */
export function endedSinceYes(home, folder) {
  const result = readResult(home, folder, "finish");
  if (result === null || typeof result !== "object" || result.early === true) return null;
  const yes = askedAt(home, folder);
  return yes !== null && result.started >= yes ? { yes, result } : null;
}

/** Whether the finish her last yes started ended without writing a hand-off: its run ended and did not end well, and the hand-off on
    file (`handoffAt`, ms, or null when there is none) is older than her yes. A run that wrote its hand-off and then failed at the late
    check is not one: the hand-off it wrote is the newer. A hand-off whose time cannot be read is taken as the newer, so that nothing is
    said of a finish that may have written it. */
export function endedWithoutHandoff(home, folder, handoffAt) {
  const ended = endedSinceYes(home, folder);
  if (ended === null || ended.result.ok !== false) return false;
  return handoffAt === null || handoffAt < ended.yes;
}
