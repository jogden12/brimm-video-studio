// The transcript of a finished video, made again, as the transcript tool makes one (spec section 5, step 5; Jason's answer
// 1): the transcriber's own pass writes the captions, without the ones written over a long silence and with the show's and
// the episode's spellings. Those captions go into the hand-off. The word pass writes the time of every word. On some
// recordings the word pass dies, every time: the captions are then the plain pass's alone, and `untimed` says so.
// The transcriber starts a caption and a word at 0 when the video opens on a silent title card (Jason's fbb80c: 3 seconds of one, and
// "Hi," timed from 0 to 3.8). So a caption or a word that starts in a silence of a second or more starts where the silence ends.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount } from "./lib.js";
import { captionTime, wordArgs, wordsOf } from "./cuts.js";
import { lastLine } from "./run.js";

/** Why a program ended badly, in plain words. One that was killed gave no reason of its own. */
const reasonOf = (ended) => (ended.signal ? `it was killed by ${ended.signal}` : lastLine(ended.stderr));
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A text with the episode's own spellings: each [wrong, right] pair is a whole word, matched as it is written. A pair whose
    wrong word is not a word of letters and figures is passed over. */
export function spelledPairs(text, spellings = []) {
  let out = String(text);
  for (const [wrong, right] of spellings) {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u.test(String(wrong || ""))) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped(wrong)}(?![\\p{L}\\p{N}])`, "gu"), right);
  }
  return out;
}

/** A text with the show's names spelled the way they are spelled, and then the episode's own (spelledPairs). */
export const spelled = (text, spellings = []) => spelledPairs(spellNames(text), spellings);

/** Captions with the spellings applied to their words alone: never to a caption's number or its times, so a spelling of a
    figure ("10" as "ten") leaves "00:00:10,000" and caption 10 as they are. `spell` is how a line is spelled: the show's names
    and the episode's (spelled), or the episode's pairs alone (spelledPairs). */
export function spelledCaptions(srt, spellings, spell = spelled) {
  let words = false;
  return String(srt).split("\n").map((line) => {
    if (!line.trim()) words = false;
    else if (line.includes("-->")) words = true;
    else if (words) return spell(line, spellings);
    return line;
  }).join("\n");
}

/** Have ffmpeg say where the sound is silent for a second or more: quieter than -45 dB, as lib.js silenceArgs asks, but for one second
    and not five. It writes no file. The transcriber starts a caption and a word at 0 when the video opens on a silent title card, and
    this is how far into the silence it is. These are Studio's own arguments: silenceArgs is the transcript tool's copy and stays as
    it is, and what leaves out the captions written over a long silence (dropSilent) is still given only its silences of five seconds. */
export const shortSilenceArgs = (wav) => ["-nostdin", "-hide_banner", "-nostats", "-i", wav, "-af", "silencedetect=noise=-45dB:d=1", "-f", "null", "-"];

/** Where a start, of something that runs to `end`, begins instead: at the end of the silence in `spans` ([start, end] in seconds, an end
    of Infinity for one that never ends) that it lies in, to the millisecond, when that is before `end`; else where it was. */
function afterSilence(start, end, spans) {
  const lying = spans.find(([a, b]) => a <= start && start < b);
  if (!lying) return start;
  const moved = Math.round(lying[1] * 1000) / 1000;
  return moved < end ? moved : start;
}

/** The times of the first caption line: the hours, minutes, seconds, the point or comma, and the milliseconds of its start, and the
    arrow and the end after it. */
const CAPTION_TIMES = /^(\d{1,2}):(\d{2}):(\d{2})([.,])(\d{3})(\s*-->\s*)(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/;

/** The captions of an .srt with each whose start lies in one of the silences `spans` ([start, end] in seconds) starting at the end of
    that silence instead, when that is before the caption's end: the transcriber starts a caption at 0 when the video opens on a silent
    title card, in the silence. Only the time of the start is written again, in the separator the file has; the caption's number, order,
    words and end are as they were, and a file with no such caption comes back as it was. */
export function startedAfterSilence(srt, spans) {
  if (!spans.length) return srt;
  return String(srt).split("\n").map((line) => {
    const m = CAPTION_TIMES.exec(line);
    if (!m) return line;
    const start = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[5]) / 1000;
    const end = Number(m[7]) * 3600 + Number(m[8]) * 60 + Number(m[9]) + Number(m[10]) / 1000;
    const moved = afterSilence(start, end, spans);
    return moved === start ? line : captionTime(moved).replace(",", m[4]) + line.slice(`${m[1]}:${m[2]}:${m[3]}${m[4]}${m[5]}`.length);
  }).join("\n");
}

/** The words (each { w, start, end } in seconds) with each whose start lies in one of the silences `spans` starting at the end of that
    silence instead, when that is before the word's end; its end is as it was. Nothing it is given is changed. */
export const wordsStartedAfterSilence = (words, spans) => (spans.length ? words.map((word) => {
  const start = afterSilence(word.start, word.end, spans);
  return start === word.start ? word : { ...word, start };
}) : words);

/** Transcribe a finished video again, in the folder `work`: {srt, txt, words, untimed, wav}, or {why} there is no transcript.
    `deps` gives the programs (`run`, `tools`, `model`) and the episode's `spellings`. The silences of five seconds or more, which leave
    out the captions written over them, are looked for as they always were, by their own run of ffmpeg; the silences of a second or more,
    which no caption or word starts in, by a second run (shortSilenceArgs). One run would have to give dropSilent the five seconds' share
    of what it heard, and a silence that never ends is not known to last five seconds (ffmpeg says where it began and no more), so that
    dropSilent could be given what it never was. The second run reads a 16 kHz mono sound, and takes moments. */
export async function finalTranscript(video, work, { run, tools, model, spellings = [] }) {
  mkdirSync(work, { recursive: true });
  const wav = join(work, "sound.wav");
  const a = await run(tools.ffmpeg, ffmpegArgs(video, wav));
  if (a.code !== 0 || !existsSync(wav)) return { why: `the sound could not be read from it (${lastLine(a.stderr)})` };
  const plain = join(work, "plain");
  const b = await run(tools.whisper, whisperArgs({ model, wav, outBase: plain }));
  if (b.code !== 0) return { why: `the transcriber stopped (${reasonOf(b)})` };
  const written = existsSync(plain + ".srt") ? readFileSync(plain + ".srt", "utf8") : "";
  const heard = captionCount(written) ? await run(tools.ffmpeg, silenceArgs(wav), { keep: 1000000 }) : null;
  const silent = heard && heard.code === 0 ? silences(heard.stderr) : [];
  const paused = captionCount(written) ? await run(tools.ffmpeg, shortSilenceArgs(wav), { keep: 1000000 }) : null;
  const quiet = paused && paused.code === 0 ? silences(paused.stderr) : [];
  const srt = spelledCaptions(startedAfterSilence(dropSilent(written, silent).srt, quiet), spellings);
  if (!captionCount(srt)) return { why: "the transcriber found no speech in it" };
  const timed = join(work, "timed");
  const c = await run(tools.whisper, wordArgs({ model, wav, outBase: timed }));
  let words = null;
  let untimed = "";
  if (c.code !== 0) untimed = `the transcriber could not time the words (${reasonOf(c)})`;
  else {
    try {
      words = wordsStartedAfterSilence(wordsOf(JSON.parse(readFileSync(timed + ".json", "utf8")), { silent }).map((word) => ({ ...word, w: spelled(word.w, spellings) })), quiet);
    } catch (e) {
      words = null;
    }
    if (!words || !words.length) {
      words = null;
      untimed = "the transcriber wrote no times for the words";
    }
  }
  return { srt, txt: stampedText(srt), words, untimed, wav };
}
