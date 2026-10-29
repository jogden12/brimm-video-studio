// The Reel suggestions of a raw video, placed in the main video HyperFrames exported (architecture 2026-10-27, section 8.6; plan PR 8).
// A Final Cut finish never gave a raw video its suggestions: their times are on the recording's clock, which the finish does not know.
// The exported main video is a recording of its own, so each suggestion's words are looked for in the export's words by `inMain`
// (handoff.js: 9 in 10 of them, in order, inside one stretch of no more than one and a half times the suggestion), and a suggestion that
// is found becomes the one the hand-off holds, on the export's clock. There is no new matching: this is the glue that turns `inMain`'s
// answer, a start and an end, into a suggestion, and the words that say what is left out.
//
// Plain words and times in; nothing but `suggestionsFor` reads a disk, and it only reads.
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { wordsIn } from "./app.js";
import { keptWords } from "./clock.js";
import { spelled } from "./final-transcript.js";
import { inMain } from "./handoff.js";
import { REELS_FILE, readReels } from "./reels.js";

const text = (value) => (typeof value === "string" ? value.trim() : "");
const isRange = (r) => r !== null && typeof r === "object" && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start;
const left = (n, why) => `Suggestion ${n} is left out of the hand-off: ${why}.`;

/** The suggestions in `candidates` (reels.json's, each { n, ranges, first, last, reason, point }) that fall in the main video, as the
    hand-off holds them: { list, left }. `words` are the recording's, { w, start, end }, on its own clock; `main` is the export's:
    { words, seconds, timed }, its words in the same shape on its clock, its length, and whether the word times are real (they are not
    when only its captions' times could be had, which `inMain` then reads without the spacing of the words).
    - A suggestion's words are those of `words` that end in one of its stretches (clock.js keptWords, as the hand-off takes them), spelled
      as the export's are, with the episode's `spellings`, so that a name it spells another way is found.
    - A suggestion that is found is { n, start, end, stretches: [{ start, end }], first, last, why, point }: its number, the one stretch of
      the export `inMain` puts its words in (which spans what lies between its parts), its own opening and closing words, spelled, and its
      reason and point, as they were.
    - A suggestion with no stretch is passed over. One without its first words, last words, reason or point (the page needs all four), one
      with no word of the recording in its stretches, and one whose words are not found in one stretch are left out, and `left` says so, in
      plain words, for each.
    The order and the numbers are the candidates'. What it is given is not changed. */
export function suggestionsInMain({ candidates, words, spellings = [], main }) {
  const list = [];
  const out = [];
  for (const c of candidates) {
    const ranges = (Array.isArray(c.ranges) ? c.ranges : []).filter(isRange);
    if (!ranges.length) continue;
    const said = [["first words", spelled(text(c.first), spellings)], ["last words", spelled(text(c.last), spellings)], ["reason", text(c.reason)], ["point", text(c.point)]];
    const missing = said.find(([, value]) => !value);
    if (missing) {
      out.push(left(c.n, `it has no ${missing[0]}`));
      continue;
    }
    const own = keptWords(words, ranges).map((word) => ({ ...word, w: spelled(word.w, spellings) }));
    if (!own.length) {
      out.push(left(c.n, "it has no words in the recording"));
      continue;
    }
    const seconds = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
    const found = inMain(own, main.words, seconds, main.seconds, { spacing: main.timed });
    if (!found) {
      out.push(left(c.n, "its words are not said together in the main video"));
      continue;
    }
    list.push({ n: c.n, start: found.start, end: found.end, stretches: [{ start: found.start, end: found.end }], first: said[0][1], last: said[1][1], why: said[2][1], point: said[3][1] });
  }
  return { list, left: out };
}

/** The suggestions of the episode in `folder` that fall in the main video `main` (suggestionsInMain's), for a raw video's hand-off from
    HyperFrames' export: the unmade ones, which are the candidates of its reels.json that the record (`record.reels`) has neither picked,
    finished nor dropped (a suggestion made into a Reel is the Reel, and `reels` offers no other), against the recording's words, from
    `<stem>.words.json`, with the episode's spellings. { list, left }; with the list or the words unusable it says why nothing is listed,
    and with no list at all it says nothing. */
export function suggestionsFor({ folder, record, main }) {
  let read;
  try {
    read = readReels(readFileSync(join(folder, REELS_FILE), "utf8"));
  } catch (e) {
    return { list: [], left: e && e.code === "ENOENT" ? [] : ["No Reel suggestions are in the hand-off: their list cannot be read."] };
  }
  if (read.why) return { list: [], left: [`No Reel suggestions are in the hand-off: their list cannot be used: ${read.why.replace(/\.$/, "")}.`] };
  const status = new Map((Array.isArray(record.reels) ? record.reels : []).map((r) => [r && r.n, r && r.status]));
  const unmade = read.reels.candidates.filter((c) => (status.get(c.n) ?? "candidate") === "candidate");
  if (!unmade.length) return { list: [], left: [] };
  const recording = wordsIn(join(folder, `${basename(record.video.file, extname(record.video.file))}.words.json`));
  if (!recording) return { list: [], left: ["No Reel suggestions are in the hand-off: the recording's words are not on this Mac."] };
  return suggestionsInMain({ candidates: unmade, words: recording, spellings: Array.isArray(record.spellings) ? record.spellings : [], main });
}
