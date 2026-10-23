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
    left out.
    The fingerprints records keep (versions.js fingerprintOf) are made of words as this gives them: a change here makes every
    fingerprint already stored match nothing. */
export function normalWords(words) {
  const out = [];
  // May the next token join the one before it into one figure? Only across a space or a hyphen: "twenty five",
  // "twenty-five", never "twenty. One".
  let joins = false;
  for (const word of words) {
    const parts = String(word.w).split("-");
    parts.forEach((part, p) => {
      tokens(part).forEach((token, t) => {
        const figure = NUMBERS[token];
        const last = out[out.length - 1];
        if (figure && UNITS.has(figure) && last && last.tens && joins && t === 0) out[out.length - 1] = { w: String(Number(last.w) + Number(figure)), start: last.start, end: word.end };
        else out.push({ w: figure || token, start: word.start, end: word.end, ...(figure && TENS.has(figure) ? { tens: true } : {}) });
        joins = false;
      });
      // A hyphen joins what is either side of it; so does a space, after a word that ends in a letter or a figure.
      joins = p < parts.length - 1 ? /[\p{L}\p{N}]$/u.test(part) : /[\p{L}\p{N}]$/u.test(String(word.w).trim());
    });
  }
  return out.map(({ tens, ...said }) => said);
}

/** The tightest stretch of `b` that holds the most of `a`'s words in the same order, not all side by side: {count, early,
    late}, the pairs [place in a, place in b] of the words found, taken as early as they can be from the stretch's start and
    as late as they can be back from its end. The stretch's end is the earliest place the last of them can be, and its start
    the latest place the first of them can be, so a later repeat of the last words, or an earlier copy of the first, is not
    taken. */
function tightest(a, b) {
  const [R, W] = [a.length, b.length];
  // forward[i][j]: the most of a's first i words found in b's first j.
  const forward = Array.from({ length: R + 1 }, () => new Uint16Array(W + 1));
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= W; j++) forward[i][j] = a[i - 1] === b[j - 1] ? forward[i - 1][j - 1] + 1 : Math.max(forward[i - 1][j], forward[i][j - 1]);
  }
  const count = forward[R][W];
  if (!count) return { count: 0, early: [], late: [] };
  let end = 1;
  while (forward[R][end] < count) end += 1;
  // backward[i][j]: the most of a's words from i found in b from j, up to the end.
  const backward = Array.from({ length: R + 1 }, () => new Uint16Array(end + 1));
  for (let i = R - 1; i >= 0; i--) {
    for (let j = end - 1; j >= 0; j--) backward[i][j] = a[i] === b[j] ? backward[i + 1][j + 1] + 1 : Math.max(backward[i + 1][j], backward[i][j + 1]);
  }
  let start = end - 1;
  while (backward[0][start] < count) start -= 1;
  const early = [];
  for (let i = 0, j = start; i < R && j < end;) {
    if (a[i] === b[j]) {
      early.push([i, j]);
      i += 1;
      j += 1;
    } else if (backward[i + 1][j] >= backward[i][j + 1]) i += 1;
    else j += 1;
  }
  const late = [];
  for (let i = R, j = end; i > 0 && j > start;) {
    if (a[i - 1] === b[j - 1]) {
      late.unshift([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (forward[i - 1][j] >= forward[i][j - 1]) i -= 1;
    else j -= 1;
  }
  return { count, early, late };
}

/** How far apart two places of the Reel's words may be in the main, beyond how far apart the Reel says them, for a first or
    last word found to be taken for the Reel's own. A filler or a word the two passes heard differently changes the spacing
    by a fraction of a second; a stray copy of a word the main cut is most often a second or more away. Leaving out a true
    first word costs the gap to the next one, a few tenths of a second; keeping a stray costs its whole distance. */
const SPACING = 0.75;
/** The most of the Reel's own opening or closing words, in seconds of the Reel, that spacing may leave out: a stray copy is a
    word or two, and a longer run is the Reel's own. */
const MAX_DROP = 2;
/** The width of the clock offsets the Reel's words vote on, in seconds, and how many places are tried at most. */
const BIN = 2;
const PLACES = 8;
/** A place whose spacing is within this of the best is as good: the earliest of them is taken. */
const SAME_FIT = 0.25;

/** A time to the hundredth of a second. A sum such as 4.35 * 100 comes to 434.99999…, which is still 4.35. */
const hundredths = (t) => Math.round(t * 100 + 1e-6) / 100;

/** Where a finished Reel's words fall in the finished main video, as {start, end} in seconds of the main, or null. They fall
    there when at least 90 in 100 of the Reel's words are found in the main in the same order, inside one stretch of the main
    no longer than one and a half times the Reel. Its start and end are those of the tightest such stretch, kept within the
    main's length, `mainSeconds`: the transcriber may time the last words past the end of the file.
    - Where to look: each word the Reel and the main share votes for the difference between the two clocks there, and the
      places with the most votes are tried, the most first.
    - At each place, the tightest stretch (see tightest), as far as one and a half times the Reel, so parts of the Reel that
      lie apart in the main are found with what is between them. Then a run of first or last words found there is left out
      when its spacing to the next word found differs from the Reel's own by more than SPACING seconds with other words of
      the main between them: it is most often a stray copy of a word the main cut. At most MAX_DROP seconds of the Reel's
      words go so, and 90 in 100 are still found. With `spacing` false, as when either side's times are only spread over
      captions, nothing is left out by spacing.
    - Between places, the one that finds more words; then the one whose words are spaced most as the Reel's are; then the
      earliest, as when an outro says the Reel's words again. A place that finds every word, spaced as the Reel's are, ends
      the search. */
export function inMain(reelWords, mainWords, reelSeconds, mainSeconds = Infinity, { spacing = true } = {}) {
  const reel = normalWords(reelWords);
  const main = normalWords(mainWords);
  if (!reel.length || !main.length) return null;
  const need = Math.ceil(reel.length * IN_MAIN_SHARE);
  const reach = reelSeconds * IN_MAIN_REACH;
  const places = new Map();
  main.forEach((m, j) => places.set(m.w, [...(places.get(m.w) || []), j]));
  const votes = new Map();
  for (const r of reel) for (const j of places.get(r.w) || []) {
    const bin = Math.floor((main[j].start - r.start) / BIN);
    votes.set(bin, (votes.get(bin) || 0) + 1);
  }
  const near = (bin) => (votes.get(bin - 1) || 0) + (votes.get(bin) || 0) + (votes.get(bin + 1) || 0);
  const tried = [];
  for (const bin of [...votes.keys()].filter((k) => near(k) >= need / 2).sort((x, y) => near(y) - near(x) || x - y)) {
    if (tried.length === PLACES) break;
    if (!tried.some((t) => Math.abs(t - bin) <= 2)) tried.push(bin);
  }
  const slack = Math.max(3, reelSeconds / 4);
  const words = reel.map((r) => r.w);
  let best = null;
  for (const bin of tried) {
    const offset = (bin + 0.5) * BIN;
    const from = offset + reel[0].start - slack;
    // As far as the stretch may reach: a Reel's parts may lie apart in the main, with a story between them.
    // Without word times, though, only as far as the Reel's own length and the slack: spread over captions, a later repeat
    // of a few words could otherwise end the stretch half a Reel late.
    const to = spacing ? offset + reel[0].start + Math.max(reel[reel.length - 1].end - reel[0].start + slack, reach) : offset + reel[reel.length - 1].end + slack;
    const k = main.findIndex((m) => m.start >= from);
    if (k === -1) continue;
    let last = k;
    while (last + 1 < main.length && main[last + 1].end <= to) last += 1;
    const found = tightest(words, main.slice(k, last + 1).map((m) => m.w));
    if (found.count < need) continue;
    // The words found before the last break in spacing near the start, and after the first near the end, are left out,
    // while 90 in 100 are still found: a run of stray words ("you need" said a few seconds before the Reel's "You need
    // to…", whose "You" the main cut) keeps its own spacing, and breaks it only where it meets the Reel's true words.
    const gapOff = ([i0, j0], [i1, j1], at) => Math.abs((main[k + j1][at] - main[k + j0][at]) - (reel[i1][at] - reel[i0][at]));
    // Near the start the words after the first are taken as late as they can be, and near the end the words before the last
    // as early as they can be: a stray run then meets the Reel's true words at one clear break.
    const fromStart = found.late;
    const fromEnd = found.early;
    // A word is left out only when other words of the main lie between it and the next one found (a filler, or a pause the
    // Reel was tightened by hand to cut, changes the spacing without that), and only while what is left out is at most
    // MAX_DROP seconds of the Reel's own words and 90 in 100 are still found. With times only spread over captions on either
    // side, spacing says nothing, and nothing is left out by it.
    let first = 0;
    if (spacing) {
      for (let q = 0; q + 1 < fromStart.length; q++) {
        if (reel[fromStart[q + 1][0]].start - reel[fromStart[0][0]].start > MAX_DROP || found.count - (q + 1) < need) break;
        if (fromStart[q + 1][1] - fromStart[q][1] > 1 && gapOff(fromStart[q], fromStart[q + 1], "start") > SPACING) first = q + 1;
      }
    }
    let end = fromEnd.length - 1;
    if (spacing) {
      const last = fromEnd.length - 1;
      for (let q = last; q - 1 >= 0; q--) {
        if (reel[fromEnd[last][0]].end - reel[fromEnd[q - 1][0]].end > MAX_DROP || found.count - first - (last - q + 1) < need) break;
        if (fromEnd[q][1] - fromEnd[q - 1][1] > 1 && gapOff(fromEnd[q - 1], fromEnd[q], "end") > SPACING) end = q - 1;
      }
    }
    if (fromEnd[end][1] <= fromStart[first][1]) continue;
    const count = found.count - first - (fromEnd.length - 1 - end);
    const startAt = k + fromStart[first][1];
    const endAt = k + fromEnd[end][1];
    if (main[endAt].end - main[startAt].start > reach) continue;
    // How far the clock offset wanders across the words found: little where the main says them as the Reel does.
    const offsets = fromStart.slice(first).map(([i, j]) => main[k + j].start - reel[i].start).sort((x, y) => x - y);
    const middle = offsets[Math.floor(offsets.length / 2)];
    const fit = offsets.reduce((sum, o) => sum + Math.abs(o - middle), 0) / offsets.length;
    const place = { count, fit, startAt, endAt };
    const better = !best || place.count > best.count || (place.count === best.count && (place.fit < best.fit - SAME_FIT || (Math.abs(place.fit - best.fit) <= SAME_FIT && main[startAt].start < main[best.startAt].start)));
    if (better) best = place;
    if (best.count === reel.length && best.fit <= SAME_FIT && best === place && tried.every((t) => (t + 0.5) * BIN >= offset || near(t) < reel.length)) break;
  }
  if (!best) return null;
  const start = hundredths(main[best.startAt].start);
  const end = Math.min(hundredths(main[best.endAt].end), hundredths(mainSeconds));
  return end > start ? { start, end } : null;
}
