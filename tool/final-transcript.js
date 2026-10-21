// The transcript of a finished video, made again, as the transcript tool makes one (spec section 5, step 5; Jason's answer
// 1): the transcriber's own pass writes the captions, without the ones written over a long silence and with the show's and
// the episode's spellings. Those captions go into the hand-off. The word pass writes the time of every word. On some
// recordings the word pass dies, every time: the captions are then the plain pass's alone, and `untimed` says so.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount } from "./lib.js";
import { wordArgs, wordsOf } from "./cuts.js";
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

/** Transcribe a finished video again, in the folder `work`: {srt, txt, words, untimed, wav}, or {why} there is no transcript.
    `deps` gives the programs (`run`, `tools`, `model`) and the episode's `spellings`. */
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
  const srt = spelledCaptions(dropSilent(written, silent).srt, spellings);
  if (!captionCount(srt)) return { why: "the transcriber found no speech in it" };
  const timed = join(work, "timed");
  const c = await run(tools.whisper, wordArgs({ model, wav, outBase: timed }));
  let words = null;
  let untimed = "";
  if (c.code !== 0) untimed = `the transcriber could not time the words (${reasonOf(c)})`;
  else {
    try {
      words = wordsOf(JSON.parse(readFileSync(timed + ".json", "utf8")), { silent }).map((word) => ({ ...word, w: spelled(word.w, spellings) }));
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
