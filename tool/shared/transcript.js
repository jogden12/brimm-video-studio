// Copied from brimm-operations app/src/transcript.js at commit 84a2f61, to be kept in step by hand.
// Transcripts: tidying a caption file, judging size, and finding words and times in the text.
import { norm, seconds, stamp } from "./text.js";

export const MAX_CHARS = 200000;
export const MIN_WORDS = 300;
/** A short video says far less than an episode: a reel of fifteen seconds is some forty words. */
export const MIN_WORDS_SHORT = 20;

/** Where a transcript came from. `prompt` is how the writing instructions describe it. */
export const SOURCES = {
  final_cut: { label: "The final cut", prompt: "a transcript of the final cut" },
  raw_recording: { label: "The raw recording", prompt: "a transcript of the raw recording" },
  youtube_captions: { label: "YouTube's captions", prompt: "automatic captions from the published video" },
  script: { label: "Her script", prompt: "Sallie Ogden's script for the episode, not a transcript of what was said" },
  unknown: { label: "Not sure", prompt: "not stated" }
};

/** What the timestamps in a transcript mean. */
export const STAMPS = {
  published: { label: "They match the published video", prompt: "they match the published video" },
  raw: { label: "They are from the raw recording", prompt: "they are raw-recording times and will not match the published video" },
  none: { label: "There are none", prompt: "there are none" }
};

/** The captions of a .vtt or .srt file: the second each starts at, and its lines of text with the markup taken out. */
function captions(text) {
  const out = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i === -1) continue;
    const start = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,]\d{3}/.exec(lines[i]);
    if (!start) continue;
    const sec = (start[1] ? Number(start[1]) * 3600 : 0) + Number(start[2]) * 60 + Number(start[3]);
    const words = lines.slice(i + 1).map((l) => l.replace(/<v\s+([^>]+)>/g, "$1: ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
    out.push({ sec, lines: words });
  }
  return out;
}

/** YouTube's automatic captions repeat themselves: each caption shows the line before it again, then adds one. A file is
    treated that way only when a good share of its captions open with the line the one before ended on. */
function repeats(caps) {
  let n = 0;
  for (let i = 1; i < caps.length; i++) {
    if (caps[i].lines.length && caps[i - 1].lines.length && caps[i].lines[0] === caps[i - 1].lines[caps[i - 1].lines.length - 1]) n += 1;
  }
  return n >= 3 && n >= caps.length * 0.3;
}

/** Caption files (.vtt, .srt) become one "[m:ss] text" line per caption. In a file that repeats itself, each line is kept
    once. Anything else is left as it is, apart from trimming. The words are never changed. */
export function tidyTranscript(raw) {
  const text = String(raw || "").replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  if (!/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(text)) return text.trim();
  const caps = captions(text);
  const rolling = repeats(caps);
  const out = [];
  let last = "";
  for (const c of caps) {
    const fresh = rolling ? c.lines.filter((l) => {
      const isNew = l !== last;
      last = l;
      return isNew;
    }) : c.lines;
    if (fresh.length) out.push("[" + stamp(c.sec) + "] " + fresh.join(" "));
  }
  return out.join("\n");
}

/** Is this what a plain-text file holds? A Word document, a PDF or a rich-text file read as text is not: its name says so, or it
    carries control characters that no transcript has. */
export function plainTextFile(text, fileName) {
  if (/\.(?:docx?|pdf|rtf|pages|odt|zip)$/i.test(String(fileName || "").trim())) return false;
  return !/[\u0000-\u0008\u000e-\u001f]/.test(String(text).slice(0, 20000));
}

export const hasStamps = (t) => /^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?/m.test(String(t));

/** Words in the transcript, not counting timestamps, in brackets or bare at the start of a line, or bracketed sound tags. */
export const transcriptWords = (t) => String(t).replace(/\[[^\]]*\]/g, " ").replace(/^[ \t]*\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/gm, " ").split(/\s+/).filter(Boolean).length;

/** The page's first guess at what the timestamps mean. She can correct it. */
export function guessStamps(text, source) {
  if (!hasStamps(text)) return "none";
  if (source === "raw_recording") return "raw";
  if (source === "script") return "none";
  return "published";
}

/** The transcript as the page works from it. Where she said its timestamps mean something and its text holds none, it has none:
    asked for times that are not there, Claude makes them up, and every one comes back as a warning. */
export const asWorked = (tr) => (tr && tr.stamps !== "none" && !hasStamps(tr.text) ? { ...tr, stamps: "none" } : tr);

/** Is this transcript the right size to work from? `message` says which way it is wrong, with the size. `min` is the fewest
    words it may have: an episode's 300 unless the page says it is a short video's. */
export function assessTranscript(text, min = MIN_WORDS) {
  const words = transcriptWords(text);
  const chars = String(text).length;
  if (chars > MAX_CHARS) {
    return { ok: false, problem: "too_long", words, chars, message: `That transcript is ${chars.toLocaleString("en-US")} characters, and the limit is ${MAX_CHARS.toLocaleString("en-US")}, which is about three hours of speech.` };
  }
  if (words < min) {
    return { ok: false, problem: "too_short", words, chars, message: `That transcript is ${words} words. It needs at least ${min} to work from.` };
  }
  return { ok: true, problem: "", words, chars, message: "" };
}

/** An index of the transcript: its normalized text, and where each timestamped line starts in it. */
export function indexTranscript(transcript) {
  let text = "";
  const marks = [];
  for (const line of String(transcript).split("\n")) {
    const m = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/.exec(line);
    const body = norm(m ? m[2] : line);
    if (m) marks.push({ t: seconds(m[1]), pos: text.length ? text.length + 1 : 0 });
    if (body) text += (text ? " " : "") + body;
  }
  return { text, marks };
}

/** The time of the timestamped line that holds a position in the index. */
export function timeAt(ix, pos) {
  let t = null;
  for (const m of ix.marks) {
    if (m.pos <= pos) t = m.t;
    else break;
  }
  return t;
}

/** Where a passage is in the transcript, or -1. */
export function find(ix, passage) {
  const n = norm(passage);
  if (!n) return -1;
  return ix.text.indexOf(n);
}

/** The occurrence nearest a stated time, for a line that is said more than once. */
export function findNear(ix, passage, t) {
  const n = norm(passage);
  if (!n) return -1;
  let best = -1;
  let gap = Infinity;
  let i = ix.text.indexOf(n);
  if (t == null) return i;
  while (i !== -1) {
    const at = timeAt(ix, i);
    const d = at == null ? Infinity : Math.abs(at - t);
    if (best === -1 || d < gap) {
      best = i;
      gap = d;
    }
    i = ix.text.indexOf(n, i + 1);
  }
  return best;
}
