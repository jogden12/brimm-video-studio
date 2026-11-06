// The words the transcriber invents after the last thing said. On a silent ending it writes "See you next week." or "Thank you."
// over a quiet that is above the five-second guard's -45 dB (lib.js dropSilent), so nothing is dropped. This is Studio's own
// rule for the end of a recording alone: the closing pause is found by the cut plan's measure (cuts.js pauseArgs, quieter than
// -35 dB for 0.3 s), the captions that lie in it are left out, and so are the words that start after the last caption kept.
// Captions and words elsewhere in a recording are left to today's rules. lib.js is a copy and is not changed.
import { statSync } from "node:fs";
import { captionCount } from "./lib.js";
import { pauseArgs, pausesOf } from "./cuts.js";

/** How long the closing pause has to be, and how near the end of the recording its end has to lie (seconds). */
const LONG_ENOUGH = 1;
const AT_THE_END = 0.05;
/** How much of a caption has to lie in the closing pause before it is taken for words nobody said. */
const SHARE = 0.75;
/** A caption this much in the pause or more is words nobody said whatever else is heard; between SHARE and this it is kept when a
    sound starts for it (a pause ends up to SOUND_BEFORE seconds before it starts, or after), because the transcriber pads a
    real last caption's end into the silence. */
const WHOLLY = 0.99;
const SOUND_BEFORE = 0.5;
const CAPTION_TIMES = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/;
const secondsOf = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

/** The closing pause of `pauses` ([start, end] in seconds, as pausesOf gives them), or null: the last one, when it never ends
    or ends within 0.05 s of `length` (the recording's length; 0 when it is not known), and is a second or longer. */
export function closingPause(pauses, length = 0) {
  const last = (pauses || [])[(pauses || []).length - 1];
  if (!last) return null;
  const [start, end] = last;
  const toTheEnd = end === Infinity || (length > 0 && end >= length - AT_THE_END);
  return toTheEnd && end - start >= LONG_ENOUGH ? [start, end] : null;
}

/** The captions without the ones that lie in the closing pause: {srt, dropped, edge}. A caption with 75% or more of its time in
    it is left out, unless it is not wholly in it (under 99%) and a sound starts for it: one of `pauses` (all of them, [start,
    end]) ends from half a second before the caption starts to where the closing pause starts. A caption with no length is left
    out when its moment lies in the pause. The captions that are left are numbered again. `edge` is the second the last caption
    kept ends, and only when a caption was left out; otherwise null. With none left out the captions come back as they were. */
export function dropClosing(srt, pause, pauses = []) {
  if (!pause || !captionCount(srt)) return { srt, dropped: 0, edge: null };
  const [from, to] = pause;
  const kept = [];
  let dropped = 0;
  let edge = null;
  for (const block of String(srt).replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => CAPTION_TIMES.test(l));
    if (at === -1) continue;
    const t = CAPTION_TIMES.exec(lines[at]);
    const start = secondsOf(t[1], t[2], t[3], t[4]);
    const end = secondsOf(t[5], t[6], t[7], t[8]);
    const share = end > start ? Math.max(0, Math.min(end, to) - Math.max(start, from)) / (end - start) : null;
    const spoken = pauses.some(([, b]) => b >= start - SOUND_BEFORE && b < from);
    const inside = share === null ? start >= from && start < to : share >= WHOLLY || (share >= SHARE && !spoken);
    if (inside) dropped += 1;
    else {
      kept.push(lines.slice(at).join("\n"));
      edge = Math.max(edge === null ? 0 : edge, end);
    }
  }
  return dropped ? { srt: kept.map((caption, i) => `${i + 1}\n${caption}\n`).join("\n"), dropped, edge } : { srt, dropped: 0, edge: null };
}

/** The words without the ones that start at or after `edge` (plus `shift`, for a file whose sound starts after its picture).
    With no edge they come back as they were. */
export const withoutClosingWords = (words, edge, shift = 0) => (edge === null || edge === undefined ? words : words.filter((word) => word.start < edge + shift));

/** How long a sound is, in seconds, when it is the 16 kHz mono 16-bit .wav ffmpegArgs writes; 0 when it cannot be told. */
export function wavSeconds(wav) {
  try {
    return Math.max(0, (statSync(wav).size - 44) / 32000);
  } catch (e) {
    return 0;
  }
}

/** The captions `srt` cleaned of the closing words, for the sound `wav`: {srt, dropped, edge} (see dropClosing). ffmpeg is asked
    where the pauses are, by pauseArgs, to `length` seconds (the length of the sound, unless given). When ffmpeg cannot say, or
    there is no closing pause, nothing is changed. `edge` is what withoutClosingWords is given. `deps` are run and tools. */
export async function closingCleaned(srt, wav, { run, tools }, length = wavSeconds(wav)) {
  if (!captionCount(srt)) return { srt, dropped: 0, edge: null };
  const heard = await run(tools.ffmpeg, pauseArgs(wav, length), { keep: 1000000 }).catch(() => null);
  return closingFrom(srt, heard, length);
}

/** The same, from what ffmpeg ended with when it was asked (pauseArgs) by someone who also wants the pauses: {code, stderr}, or
    null when it could not be run. Nothing is changed when it did not end well. */
export function closingFrom(srt, heard, length) {
  if (!heard || heard.code !== 0 || !captionCount(srt)) return { srt, dropped: 0, edge: null };
  const pauses = pausesOf(heard.stderr);
  return dropClosing(srt, closingPause(pauses, length), pauses);
}
