// Copied in part from brimm-operations transcribe/lib.js at commit 84a2f61, to be kept in step by hand.
// The transcript tool's rules that this tool shares: which files it takes, what it names its files and the folder a finished
// video is filed in, and what it asks ffmpeg and the transcriber to do. The parts about Zoom calls are the transcript tool's
// alone, and are left out here.
// Nothing here touches a disk or runs a program, so all of it is tested without a video.
import { basename, dirname, extname, join } from "node:path";
import { tidyTranscript } from "./shared/transcript.js";

/** The kinds of file it makes a transcript of. */
export const MEDIA = [".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mp3", ".m4a", ".wav", ".aac", ".flac", ".aif", ".aiff"];
/** Endings a browser or a sync program gives a file that has not finished arriving. */
const ARRIVING = [".part", ".download", ".crdownload", ".tmp"];

/** Names the show's people and offers, so the transcriber spells them the way they are spelled. */
export const PROMPT = "The Sallie Ogden Show, with Sallie Ogden, founder of The BRIMM. She talks about the Founder Forum, the CEO Forum and the Next Move Session.";

export function isMedia(name) {
  const n = String(name || "");
  if (!n || n.startsWith(".") || ARRIVING.some((e) => n.toLowerCase().endsWith(e))) return false;
  return MEDIA.includes(extname(n).toLowerCase());
}

/** The files written for a video: the captions, the plain-text transcript, and a note when it could not be done. */
export function outputsFor(file, outDir = dirname(file)) {
  const base = basename(file, extname(file));
  return { base, srt: join(outDir, base + ".srt"), txt: join(outDir, base + ".transcript.txt"), failed: join(outDir, base + ".failed.txt") };
}

/** The name of a new folder for a finished video, among the names already in the watched folder: the day, as "2026-10-13",
    or the day with the first number from 2 that is free, as "2026-10-13-2". A file of that name takes it as a folder does. */
export function dayFolder(names, day) {
  const have = new Set(names);
  let name = day;
  for (let n = 2; have.has(name); n++) name = `${day}-${n}`;
  return name;
}

/** Take the sound out of a video as 16 kHz mono, which is what the transcriber reads. */
export const ffmpegArgs = (input, wav) => ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav];

/** Write an .srt of short lines. Short lines put a time every few seconds, which is what chapters and clip times are read from. */
export const whisperArgs = ({ model, wav, outBase, language = "en", prompt = PROMPT }) => ["-m", model, "-f", wav, "-l", language, "-ml", "60", "-sow", "-osrt", "-of", outBase, "--prompt", prompt, "-np"];

/** Have ffmpeg say where the sound is silent: quieter than -45 dB for five seconds or more. It writes no file. */
export const silenceArgs = (wav) => ["-nostdin", "-hide_banner", "-nostats", "-i", wav, "-af", "silencedetect=noise=-45dB:d=5", "-f", "null", "-"];

/** The silences in what ffmpeg printed, each as [start, end] in seconds. One that never ends lasts to the end of the recording. */
export function silences(printed) {
  const out = [];
  for (const m of String(printed || "").matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === "start") out.push([Number(m[2]), Infinity]);
    else if (out.length) out[out.length - 1][1] = Number(m[2]);
  }
  return out;
}

/** How much of a caption has to lie in silence before it is taken for words nobody said. On the first real recording a caption
    that only ran over a pause in the talk lay 64% in it, and the ones written over the silent opening lay 99% in it or more. */
const SILENT_SHARE = 0.9;
const CAPTION_TIMES = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/;
const secondsOf = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

/** The captions without the ones that lie in a silence. Over a long silence the transcriber writes words nobody said, most
    often "Thank you." The captions that are left are numbered again. With none to leave out they come back as they were. */
export function dropSilent(srt, spans) {
  const kept = [];
  let dropped = 0;
  for (const block of String(srt).replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => CAPTION_TIMES.test(l));
    if (at === -1) continue;
    const t = CAPTION_TIMES.exec(lines[at]);
    const start = secondsOf(t[1], t[2], t[3], t[4]);
    const end = secondsOf(t[5], t[6], t[7], t[8]);
    const quiet = spans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(end, b) - Math.max(start, a)), 0);
    // The transcriber gives some of its invented words no length at all. Such a caption is a moment, and lies in a silence when
    // that moment does. The moment a silence ends is when somebody starts to speak, so a caption there is kept.
    const silent = end > start ? quiet / (end - start) >= SILENT_SHARE : spans.some(([a, b]) => start >= a && start < b);
    if (silent) dropped += 1;
    else kept.push(lines.slice(at).join("\n"));
  }
  return dropped ? { srt: kept.map((caption, i) => `${i + 1}\n${caption}\n`).join("\n"), dropped } : { srt, dropped: 0 };
}

/** The captions of an .srt, each {start, end, text}: the seconds it starts and ends at, and its words, with a line break where
    the file has one. */
export function captionsOf(srt) {
  const captions = [];
  for (const block of String(srt).replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => CAPTION_TIMES.test(l));
    if (at === -1) continue;
    const t = CAPTION_TIMES.exec(lines[at]);
    captions.push({ start: secondsOf(t[1], t[2], t[3], t[4]), end: secondsOf(t[5], t[6], t[7], t[8]), text: lines.slice(at + 1).join("\n").trim() });
  }
  return captions;
}

/** Names the transcriber spells its own way whatever it is told, and how they are spelled. */
const SPELLINGS = [[/\bSally\b/g, "Sallie"]];

/** The captions with the show's names spelled the way they are spelled. */
export const spellNames = (text) => SPELLINGS.reduce((t, [wrong, right]) => t.replace(wrong, right), String(text));

/** The transcript as plain text, one "[m:ss] words" line per caption: the same lines BRIMM Ops makes of the .srt. */
export function stampedText(srt) {
  const text = tidyTranscript(srt);
  return text ? text + "\n" : "";
}

/** How many captions an .srt holds. None means the transcriber wrote nothing that can be used. */
export const captionCount = (srt) => (String(srt).match(/^\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->/gm) || []).length;

/** Has a file finished arriving? `sizes` is its size each time it was looked at. */
export const settled = (sizes) => sizes.length >= 2 && sizes[sizes.length - 1] > 0 && sizes[sizes.length - 1] === sizes[sizes.length - 2];
