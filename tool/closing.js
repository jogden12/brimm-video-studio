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
/** A caption this much in the pause or more is words nobody said whatever else is heard; between SHARE and this it is kept only
    when it owns the last stretch of sound (see dropClosing), because the transcriber pads a real last caption's end into the
    silence. A caption owns that stretch when it starts up to SOUND_BEFORE seconds before the stretch does, or after. */
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
    it is left out, with two exceptions. One 99% or more in it is always left out. One between 75% and 99% in it is kept when it
    owns the last stretch of sound: O is the end of the last of `pauses` ([start, end], all of them) that ends before the closing
    pause starts (0 when there is none), the sound from O to the closing pause is the last stretch, and its own caption is the
    first caption, in time order, that starts in [O - 0.5 s, the closing pause's start). Any other has no sound of its own.
    One case is accepted: a real short last word said straight on, with no pause before it (so no new stretch of sound), whose end
    the transcriber padded 75% or more into the closing pause, is left out. A caption with no length is left out when its moment
    lies in the pause. The captions that are left are numbered again. `edge` is the second the last caption kept ends, and only
    when a caption was left out; otherwise null. With none left out the captions come back as they were. */
export function dropClosing(srt, pause, pauses = []) {
  if (!pause || !captionCount(srt)) return { srt, dropped: 0, edge: null };
  const [from, to] = pause;
  const found = [];
  for (const block of String(srt).replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => CAPTION_TIMES.test(l));
    if (at === -1) continue;
    const t = CAPTION_TIMES.exec(lines[at]);
    found.push({ text: lines.slice(at).join("\n"), start: secondsOf(t[1], t[2], t[3], t[4]), end: secondsOf(t[5], t[6], t[7], t[8]) });
  }
  const last = pauses.filter(([, b]) => b < from).reduce((o, [, b]) => Math.max(o, b), 0);
  const own = found.filter((c) => c.start >= last - SOUND_BEFORE && c.start < from).sort((a, b) => a.start - b.start)[0];
  const kept = [];
  let dropped = 0;
  let edge = null;
  for (const c of found) {
    const share = c.end > c.start ? Math.max(0, Math.min(c.end, to) - Math.max(c.start, from)) / (c.end - c.start) : null;
    const inside = share === null ? c.start >= from && c.start < to : share >= WHOLLY || (share >= SHARE && c !== own);
    if (inside) dropped += 1;
    else {
      kept.push(c.text);
      edge = Math.max(edge === null ? 0 : edge, c.end);
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
