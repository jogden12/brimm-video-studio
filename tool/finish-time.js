// How long a finish takes until its hand-off is ready, which `finish … --yes` says when it starts: the person is not left to watch
// the progress panel (Jason, 2 November 2026). The detached part measures it, once its hand-off is written and shown: the seconds it
// took, for each second of the videos it took, kept among the panel's rates (progress.js addRates, rates.json) under HANDOFF_STEP,
// blended with what this Mac measured of the finishes before, as the panel's steps are. The seconds of video are the record's own, the
// same when the speed is measured as when it is used, since the exports' own lengths are not known until the detached part has probed
// them: the main video is counted as the recording is long, and a Reel as its stretch of it. So the speed takes in whatever those
// differ by. Everything here is on this Mac's own disk.
import { addRates, progressFolder } from "./progress.js";

/** The name the speed of a finish's hand-off is kept under in rates.json: the seconds from the start of the detached part to the
    hand-off shown, for each second of video it took. It is no step of the panel's, and the panel does not read it. */
export const HANDOFF_STEP = "Making the hand-off";

/** The seconds of video a finish takes now, from the record: of each of its `parts` that it takes and does not keep as the last
    finish made it, the recording's length for the main video and the stretch of it a Reel is for a Reel. A part whose length the
    record does not give is left out, so that nothing is made up; none at all makes 0. */
export function videoSeconds(record, parts) {
  const reels = Array.isArray(record.reels) ? record.reels : [];
  let seconds = 0;
  for (const part of parts) {
    if (part.kept) continue;
    const reel = part.reel ? reels.find((r) => r && r.n === part.reel) : null;
    const length = part.reel ? (reel ? reel.to - reel.from : Number.NaN) : record.video && record.video.seconds;
    if (Number.isFinite(length) && length > 0) seconds += length;
  }
  return seconds;
}

/** Seconds until a finish of `length` seconds of video has its hand-off ready, by the speed this Mac measured (`rates`, progress.js
    readRates), rounded. Null while the speed or the length is not known, or the time comes to less than a second. */
export function handoffIn(rates, length) {
  const rate = rates[HANDOFF_STEP];
  const seconds = Number.isFinite(rate) && rate > 0 && Number.isFinite(length) && length > 0 ? Math.round(rate * length) : 0;
  return seconds >= 1 ? seconds : null;
}

/** Keep what a finish measured: its hand-off took `ms` milliseconds for `length` seconds of video, blended with the speed this Mac
    has (progress.js addRates). True when it was kept; false, and nothing kept, for no time or no length, or when the file could
    not be written, which costs the finish nothing. */
export function measured(home, ms, length) {
  if (!Number.isFinite(ms) || !(ms > 0) || !Number.isFinite(length) || !(length > 0)) return false;
  return addRates(progressFolder(home), { [HANDOFF_STEP]: ms / 1000 / length });
}
