// The hand-off file, version 1: what brimm-video gives BRIMM Ops at the end of an edit, in one file that a person drops on
// the BRIMM Ops page. It holds the episode's final transcript, and each finished Reel with its transcript and its on-screen
// title (spec section 5). Its tests, and the fixture in tests/fixtures that brimm-operations keeps a copy of, are the
// contract between the two: change neither without changing both.
// Nothing here touches a disk or runs a program.
import { tidyTranscript } from "./shared/transcript.js";
import { tokens } from "./shared/text.js";

export const FORMAT = "brimm-video hand-off";
export const VERSION = 1;

/** How many of a Reel's words must be found in the main video, in order, for the hand-off to say where they fall, and how much
    longer than the Reel the stretch of the main they are found in may be. */
const IN_MAIN_SHARE = 0.9;
const IN_MAIN_REACH = 1.5;

/** The hand-off, in the spec's order. `record` is the episode's record; `main` and each of `reels` say what was finished:
    the file's name in final/, its length in seconds and its captions as the transcript tool writes them. `title` is the
    approved title, and null when there is none. A Reel's `inMain` is left out when its words were not found in the main. */
export function buildHandoff({ record, revision, made, madeOn, commit, main, reels = [] }) {
  const title = record.title && record.title.approved ? record.title.text : null;
  return {
    format: FORMAT,
    version: VERSION,
    revision,
    made,
    madeOn,
    madeBy: `brimm-video ${commit}`,
    episode: { id: record.id, kind: record.kind, name: record.name.text, recorded: record.video.recorded, recordedFrom: record.video.recordedFrom, title },
    main: { file: main.file, seconds: main.seconds, srt: main.srt },
    reels: reels.map((r) => ({ n: r.n, title: r.title, file: r.file, seconds: r.seconds, ...(r.inMain ? { inMain: r.inMain } : {}), srt: r.srt }))
  };
}

/** The file's text: JSON set in by two spaces, with a line break at the end. */
export const handoffText = (handoff) => JSON.stringify(handoff, null, 2) + "\n";

const text = (v) => typeof v === "string" && v.trim() !== "";
const seconds = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
/** Captions the BRIMM Ops page can read: tidyTranscript, the page's own reader, makes lines of them. */
const captions = (srt) => text(srt) && /-->/.test(srt) && tidyTranscript(srt).startsWith("[");

/** What is wrong with a hand-off, in plain words, or "" when nothing is. The first fault found is the one given. */
export function handoffFault(h) {
  if (!h || h.format !== FORMAT) return `It is not a ${FORMAT}.`;
  if (h.version !== VERSION) return `It is version ${h.version}, and this reads version ${VERSION}.`;
  if (!Number.isInteger(h.revision) || h.revision < 1) return "Its revision is not a whole number from 1.";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(h.made))) return "The time it was made is not a local time with its offset.";
  if (!text(h.madeOn) || !/^brimm-video \S+$/.test(String(h.madeBy))) return "It does not say which Mac and which brimm-video made it.";
  const e = h.episode || {};
  if (!/^e-\d{8}-[0-9a-f]{6}$/.test(String(e.id))) return "The episode's id is not an id brimm-video gives.";
  if (e.kind !== "episode" && e.kind !== "short video") return "The episode's kind is neither an episode nor a short video.";
  if (!text(e.name)) return "The episode has no name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.recorded)) || !["video", "import"].includes(e.recordedFrom)) return "The day it was recorded, or where that day was read from, is missing.";
  if (e.title !== null && !text(e.title)) return "The title is neither words nor null.";
  if (e.kind === "episode" && e.title === null) return "An episode needs its approved title.";
  const m = h.main || {};
  if (!text(m.file) || !seconds(m.seconds)) return "The main video has no file or no length.";
  if (!captions(m.srt)) return "The main video's captions cannot be read.";
  if (!Array.isArray(h.reels)) return "Its Reels are not a list.";
  if (e.kind === "short video" && h.reels.length) return "A short video has no Reels.";
  const seen = new Set();
  for (const r of h.reels) {
    const which = `Reel ${r && r.n}`;
    if (!Number.isInteger(r.n) || r.n < 1) return "A Reel's number is not a whole number from 1.";
    if (seen.has(r.n)) return `${which} is in it twice.`;
    seen.add(r.n);
    if (!text(r.title) || !text(r.file) || !seconds(r.seconds)) return `${which} has no title, no file or no length.`;
    if (!captions(r.srt)) return `${which}'s captions cannot be read.`;
    if (r.inMain !== undefined) {
      const { start, end } = r.inMain || {};
      if (!(typeof start === "number" && typeof end === "number" && start >= 0 && end > start && end <= m.seconds + 0.01)) return `${which}'s place in the main video is not a stretch of it.`;
    }
  }
  return "";
}

/** Numbers said as words, written as the transcriber writes them in figures, so that "three" and "3" are one word. */
const NUMBERS = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000" };

/** Number words that are tens and units, in figures: "twenty" "five" is said for 25. */
const TENS = new Set(["20", "30", "40", "50", "60", "70", "80", "90"]);
const UNITS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/** Words as they are matched: lower case, without punctuation, numbers in figures. A word of two parts ("well-known") is two
    words, each with the word's times. A number said as tens and units ("twenty-five", "twenty five") is one figure, as the
    transcriber writes it in figures, from the first word's start to the last's end. What has no letter or figure in it is
    left out. */
export function normalWords(words) {
  const out = [];
  for (const word of words) {
    for (const token of tokens(word.w)) {
      const figure = NUMBERS[token];
      const last = out[out.length - 1];
      if (figure && UNITS.has(figure) && last && last.tens) out[out.length - 1] = { w: String(Number(last.w) + Number(figure)), start: last.start, end: word.end };
      else out.push({ w: figure || token, start: word.start, end: word.end, ...(figure && TENS.has(figure) ? { tens: true } : {}) });
    }
  }
  return out.map(({ tens, ...said }) => said);
}

/** The tightest stretch of `b` that holds the most of `a`'s words in the same order, not all side by side: {count, first,
    last}, the places in `b` of the first and the last word of it. Its end is the earliest place the last of them can be,
    and its start the latest place the first of them can be, so a later repeat of the last words, or an earlier copy of the
    first, is not taken. Then a first or last word found apart from the rest, with words of `b` between it and the next one
    found, is left out while at least `need` words are still found: such a word is most often a stray copy of one the main
    video cut ("and so on" just before a Reel's "So" that was trimmed). */
function tightest(a, b, need) {
  const [R, W] = [a.length, b.length];
  // forward[i][j]: the most of a's first i words found in b's first j.
  const forward = Array.from({ length: R + 1 }, () => new Uint16Array(W + 1));
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= W; j++) forward[i][j] = a[i - 1] === b[j - 1] ? forward[i - 1][j - 1] + 1 : Math.max(forward[i - 1][j], forward[i][j - 1]);
  }
  const count = forward[R][W];
  if (!count) return { count: 0, first: -1, last: -1 };
  let end = 1;
  while (forward[R][end] < count) end += 1;
  // backward[i][j]: the most of a's words from i found in b from j, up to the end.
  const backward = Array.from({ length: R + 1 }, () => new Uint16Array(end + 1));
  for (let i = R - 1; i >= 0; i--) {
    for (let j = end - 1; j >= 0; j--) backward[i][j] = a[i] === b[j] ? backward[i + 1][j + 1] + 1 : Math.max(backward[i + 1][j], backward[i][j + 1]);
  }
  let start = end - 1;
  while (backward[0][start] < count) start -= 1;
  // The places found, taken as early as they can be from the start, and as late as they can be back from the end.
  const early = [];
  for (let i = 0, j = start; i < R && j < end;) {
    if (a[i] === b[j]) {
      early.push(j);
      i += 1;
      j += 1;
    } else if (backward[i + 1][j] >= backward[i][j + 1]) i += 1;
    else j += 1;
  }
  const late = [];
  for (let i = R, j = end; i > 0 && j > start;) {
    if (a[i - 1] === b[j - 1]) {
      late.unshift(j - 1);
      i -= 1;
      j -= 1;
    } else if (forward[i - 1][j] >= forward[i][j - 1]) i -= 1;
    else j -= 1;
  }
  let found = count;
  let k = 0;
  while (found - 1 >= need && early[k + 1] - early[k] > 1) {
    k += 1;
    found -= 1;
  }
  let m = late.length - 1;
  while (found - 1 >= need && late[m] - late[m - 1] > 1 && late[m - 1] > early[k]) {
    m -= 1;
    found -= 1;
  }
  return { count: found, first: early[k], last: late[m] };
}

const hundredths = (t) => Math.round(t * 100) / 100;

/** Where a finished Reel's words fall in the finished main video, as {start, end} in seconds of the main, or null. They fall
    there when at least 90 in 100 of the Reel's words are found in the main in the same order, inside one stretch no longer
    than one and a half times the Reel. Its start and end are those of the tightest such stretch (see tightest), kept within
    the main's length, `mainSeconds`: the transcriber may time the last words past the end of the file. A stretch is tried
    from each place in the main where one of the Reel's first words is said: the first of those words that must be found. */
export function inMain(reelWords, mainWords, reelSeconds, mainSeconds = Infinity) {
  const reel = normalWords(reelWords).map((x) => x.w);
  const main = normalWords(mainWords);
  if (!reel.length || !main.length) return null;
  const need = Math.ceil(reel.length * IN_MAIN_SHARE);
  const opening = new Set(reel.slice(0, reel.length - need + 1));
  const reach = reelSeconds * IN_MAIN_REACH;
  let best = null;
  for (let k = 0; k < main.length; k++) {
    if (!opening.has(main[k].w)) continue;
    let end = k;
    while (end + 1 < main.length && main[end + 1].end - main[k].start <= reach) end += 1;
    const found = tightest(reel, main.slice(k, end + 1).map((x) => x.w), need);
    if (found.count < need) continue;
    const stretch = { count: found.count, first: k + found.first, last: k + found.last };
    const span = (s) => main[s.last].end - main[s.first].start;
    if (!best || stretch.count > best.count || (stretch.count === best.count && span(stretch) < span(best))) best = stretch;
  }
  if (!best) return null;
  const start = hundredths(main[best.first].start);
  const end = Math.min(hundredths(main[best.last].end), Math.floor(mainSeconds * 100) / 100);
  return end > start ? { start, end } : null;
}
