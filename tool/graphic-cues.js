// Graphic cues (the HyperFrames-led path, design 3 and 4; PR H1): one of Sallie's points made visible with a short animated graphic
// or words on screen, tied to the words it goes with. In code it is a "graphic cue" (graphicCues, graphic-cues.js), because cuts.js
// already uses the kind "cue" for a spoken start-over.
// A cue is read from Claude's reply or from a package (graphicCuesOf, graphicCuesInReply), and is placed by its words, never by a time
// written in advance (placeGraphicCues): Studio finds the words in the recording's word times, so a cue lands where she says them, even
// when she says them a little differently. What a project holds of them is brimm/graphic-cues.json (graphicCuesJson). A Reel of an
// episode holds the cues that fall in its stretch, on its own clock and with its own word ids (reelGraphicCues; PR H2). A cue is a
// suggestion and is built only when she takes it, in the app, as a suggested cut is.
// Nothing here touches a disk or runs a program. It takes plain data and gives back plain data.
import { plain } from "./shared/text.js";

/** The kinds of a cue. On a video already shot, and in an explainer, only the first two (SHOT_KINDS, design 10.11): the other two
    are footage she films to a shot list. */
export const GRAPHIC_CUE_KINDS = Object.freeze(["graphic", "words", "b-roll", "screen"]);
export const SHOT_KINDS = Object.freeze(["graphic", "words"]);
/** How many seconds a cue stays when it does not say, or says something that is not a length. */
export const CUE_SECONDS = 4;
/** The shortest and longest a cue stays, in seconds. */
const SECONDS_FROM = 1;
const SECONDS_TO = 10;
/** How many words and characters a cue's words may have, and how many characters what it shows. */
const WORDS_MOST = 30;
const WORDS_CHARS = 200;
const SHOW_CHARS = 300;

/** Text on one line, trimmed. */
const oneLine = (v) => plain(v).replace(/\s+/g, " ").trim();
/** At most `most` characters of a text, never half of a character. */
const chars = (text, most) => {
  const all = Array.from(text);
  return all.length <= most ? text : all.slice(0, most).join("").trimEnd();
};
/** A cue's words as the cue holds them: the first 30 words, and as many of those as fit in 200 characters. */
function wordsHeld(text) {
  const words = text.split(" ").slice(0, WORDS_MOST);
  while (words.length > 1 && Array.from(words.join(" ")).length > WORDS_CHARS) words.pop();
  return chars(words.join(" "), WORDS_CHARS);
}

/** Is this a link that is https? */
function secureLink(text) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname !== "" && !/\s/.test(text);
  } catch (e) {
    return false;
  }
}
/** Is this the name of a file, and not a path to one? A cue's `ref` names a file in the reference folder. */
const fileName = (text) => !/[\\/\u0000-\u001f]/.test(text) && !text.startsWith(".");

const STYLE_KEYS = ["ref", "inspiration", "link"];
/** A cue's style as it is held: null for none, {ref}, {inspiration} or {link} for exactly one of those, and undefined for anything
    else, which no cue can hold: two keys, none, another key, a value that is not text, or a link that is not https. */
function styleOf(given) {
  if (given === undefined || given === null) return null;
  if (typeof given !== "object" || Array.isArray(given)) return undefined;
  const keys = Object.keys(given);
  if (keys.length !== 1 || !STYLE_KEYS.includes(keys[0])) return undefined;
  const [key] = keys;
  const value = typeof given[key] === "string" ? given[key].trim() : "";
  if (!value || (key === "link" && !secureLink(value)) || (key === "ref" && !fileName(value))) return undefined;
  return { [key]: value };
}

/** One entry as a cue without its number, or null when it is none: it needs its words, what it shows, a kind of `kinds`, and no
    style that cannot be held. `seconds` is a number from 1 to 10, or CUE_SECONDS. `phrase` is kept when it is text, and `shot` when
    it is a whole number from 1. */
function cueOf(given, kinds) {
  if (given === null || typeof given !== "object" || Array.isArray(given)) return null;
  const words = oneLine(given.words);
  const show = oneLine(given.show);
  const style = styleOf(given.style);
  if (!words || !show || !kinds.includes(given.kind) || style === undefined) return null;
  const phrase = typeof given.phrase === "string" ? given.phrase.trim() : "";
  const seconds = typeof given.seconds === "number" && given.seconds >= SECONDS_FROM && given.seconds <= SECONDS_TO ? given.seconds : CUE_SECONDS;
  return {
    words: wordsHeld(words), kind: given.kind, show: chars(show, SHOW_CHARS), seconds, style,
    ...(phrase ? { phrase } : {}), ...(Number.isInteger(given.shot) && given.shot >= 1 ? { shot: given.shot } : {})
  };
}

/** Cues from a list of entries, as a reply or a package gives them: { cues, problems }. An entry that is no cue (cueOf) is dropped,
    and `Graphic cue 3 could not be read.` says so of the third entry. The cues are numbered from 1 in the order given, whatever
    number they came with, and only the first `most` are made. `kinds` are the kinds a cue may have: the two a video already shot
    has, unless a caller says others. */
export function graphicCuesOf(entries, { kinds = SHOT_KINDS, most = Infinity } = {}) {
  const cues = [];
  const problems = [];
  (Array.isArray(entries) ? entries : []).forEach((given, i) => {
    if (cues.length >= most) return;
    const cue = cueOf(given, kinds);
    if (cue) cues.push({ n: cues.length + 1, ...cue });
    else problems.push(`Graphic cue ${i + 1} could not be read.`);
  });
  return { cues, problems };
}

const SPELLED_OUT = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** The line that asks Claude for graphic cues, `most` being how many at most (twelve for a raw episode, three for a Reel), spelled out. */
export const graphicCuesAsk = (most) => `- "graphicCues": at most ${SPELLED_OUT[most] ?? most} {"id", "words", "kind", "show", "seconds"}, in the order they are said. Each makes one of her points visible with a short animated graphic or words on screen. "id" is the kept phrase it goes with; "words" are the words it goes with, copied exactly from that phrase; "kind" is "graphic" or "words"; "show" says what it shows, in one or two plain sentences, with things and words and never people; "seconds" is how long it stays, from 2 to 8 and usually 3 or 4.`;

// --- Words become tokens ---

/** One word of a text as a token: lower case, without accents, and without any mark but an apostrophe inside it, a curly one made
    straight. Nothing is left of a mark on its own. */
const tokenOf = (word) => word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[‘’ʼ]/g, "'")
  .replace(/[^\p{L}\p{N}']/gu, "")
  .replace(/^'+|'+$/g, "");

/** The tokens of a text, split on spaces: the cue's words, and each word of a recording, are compared by them. */
export const cueTokens = (text) => plain(text).split(/\s+/).map(tokenOf).filter(Boolean);

// --- Where the plan's phrases are among its words ---

/** The spans of the phrases of a cut plan that have words, or only of those that are kept (`keep` is not false): the first word and
    the last of each among all the plan's words, as [first, last] indexes. The phrases split the recording's words in order (cuts.js
    phrasesOf), so they are found by counting, as the cut suggestions are (project.js cutSuggestions). A phrase with no words is
    not in it, and a phrase that is left out is still counted. */
function spansOf(phrases, onlyKept) {
  const spans = new Map();
  let at = 0;
  for (const phrase of Array.isArray(phrases) ? phrases : []) {
    const n = Array.isArray(phrase?.words) ? phrase.words.length : 0;
    if (n > 0 && (!onlyKept || phrase.keep !== false)) spans.set(phrase.id, [at, at + n - 1]);
    at += n;
  }
  return spans;
}

/** For each phrase of a cut plan that has words, its first word and its last among all the plan's words, as [first, last] indexes. */
export const phraseSpans = (phrases) => spansOf(phrases, false);

/** The same for the phrases that are kept alone (`keep` is not false), counted over all the words. A cue is given these as its
    phrases (placeGraphicCues): a cue is asked for a kept phrase, so one that names a phrase that is cut counts as naming none, and
    its words are looked for in kept words first. */
export const keptPhraseSpans = (phrases) => spansOf(phrases, true);

/** The indexes of the words in the phrases whose `keep` is not false, counted the same way. */
export function keptIndexes(phrases) {
  const kept = new Set();
  let at = 0;
  for (const phrase of Array.isArray(phrases) ? phrases : []) {
    const n = Array.isArray(phrase?.words) ? phrase.words.length : 0;
    if (phrase?.keep !== false) for (let i = 0; i < n; i++) kept.add(at + i);
    at += n;
  }
  return kept;
}

// --- Placing a cue ---

/** The text of a word: a project's transcript has `text`, and the episode's own words (cuts.js wordsOf) have `w`. */
const textOf = (word) => (word !== null && typeof word === "object" ? plain(word.text ?? word.w) : "");

/** How many of `wanted` can be found in `window`, in order, and where among `window` the first and the last of those are: the
    longest run of them in order, found from the left. { count, first, last } (first and last are -1 for none). */
function aligned(wanted, window) {
  const k = wanted.length;
  const m = window.length;
  // best[i][j]: the most of wanted[i…] that window[j…] has in order.
  const best = Array.from({ length: k + 1 }, () => new Array(m + 1).fill(0));
  for (let i = k - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) best[i][j] = wanted[i] === window[j] ? best[i + 1][j + 1] + 1 : Math.max(best[i + 1][j], best[i][j + 1]);
  }
  let first = -1;
  let last = -1;
  for (let i = 0, j = 0; i < k && j < m && best[i][j] > 0;) {
    if (wanted[i] === window[j]) {
      if (first < 0) first = j;
      last = j;
      i += 1;
      j += 1;
    } else if (best[i + 1][j] >= best[i][j + 1]) i += 1;
    else j += 1;
  }
  return { count: best[0][0], first, last };
}

/** Where a cue's tokens `wanted` are among the recording's `tokens` ({token, word}: a token and the place of the word it is of):
    every candidate, each { first, last, count, exact } with the places of its first and last words.
    - An exact candidate is the cue's tokens, in order and side by side.
    - A loose candidate starts on one of the cue's first two tokens, is the cue's length plus two, and has at least max(2, ⌈2k ÷ 3⌉)
      of the cue's k tokens in order (two of three, three of four, seven of ten); of one or two, every one. Its span runs from the
      first of those tokens to the last. */
function candidatesFor(wanted, tokens) {
  const k = wanted.length;
  const flat = tokens.map((t) => t.token);
  const found = [];
  for (let s = 0; s + k <= flat.length; s++) {
    if (flat[s] === wanted[0] && wanted.every((token, i) => flat[s + i] === token)) found.push({ first: tokens[s].word, last: tokens[s + k - 1].word, count: k, exact: true });
  }
  const need = k <= 2 ? k : Math.max(2, Math.ceil((2 * k) / 3));
  for (let s = 0; s < flat.length; s++) {
    if (flat[s] !== wanted[0] && flat[s] !== wanted[1]) continue;
    const got = aligned(wanted, flat.slice(s, s + k + 2));
    if (got.count >= need) found.push({ first: tokens[s + got.first].word, last: tokens[s + got.last].word, count: got.count, exact: false });
  }
  return found;
}

/** The candidate that wins: an exact one over a loose one, a higher count over a lower, then the first at or after `from`, and
    failing that the first. */
const bestOf = (group, from) => group.slice().sort((a, b) => (b.exact - a.exact) || (b.count - a.count) || ((a.first >= from ? 0 : 1) - (b.first >= from ? 0 : 1)) || (a.first - b.first) || (a.last - b.last))[0];

/** Where each of the cues is among the words, as { first, last } places of its first and last words, or null when it is not found,
    in the order the cues are given. See placeGraphicCues. */
function placesOf(cues, words, { spans, kept, spell }) {
  const tokens = [];
  words.forEach((word, index) => {
    for (const token of cueTokens(textOf(word))) tokens.push({ token, word: index });
  });
  const places = cues.map(() => null);
  // Each in the order of its number, a search starting after the first word of the cue placed before it.
  const order = cues.map((_, i) => i).sort((a, b) => (Number.isFinite(cues[a]?.n) ? cues[a].n : a + 1) - (Number.isFinite(cues[b]?.n) ? cues[b].n : b + 1) || a - b);
  let from = 0;
  for (const i of order) {
    const wanted = cueTokens(spell(plain(cues[i]?.words)));
    if (!wanted.length) continue;
    const all = candidatesFor(wanted, tokens);
    // Those inside the cue's own phrase count first, then those wholly in kept words, then any.
    const span = spans && typeof cues[i].phrase === "string" ? spans.get(cues[i].phrase) : undefined;
    const groups = [
      span ? all.filter((c) => c.first >= span[0] && c.last <= span[1]) : [],
      kept ? all.filter((c) => Array.from({ length: c.last - c.first + 1 }, (_, n) => c.first + n).every((n) => kept.has(n))) : [],
      all
    ];
    const group = groups.find((g) => g.length);
    if (!group) continue;
    places[i] = bestOf(group, from);
    from = places[i].first + 1;
  }
  return places;
}

/** The cues placed on the words of a recording, each as it is given with an `at`: { from, to, start, end }, the ids of its first and
    last words and their times (the first's start, the last's end), or null when its words are not found, and the cues after it are
    still placed. They come in the order given. `words` are [{text, start, end, id?}] as a project's transcript.json has them, or the
    episode's own words ({w, start, end}); a word with no id is given w<index>. Words become tokens (cueTokens): the cue's words
    first go through `spell`, the speller the words were spelled with, so a cue from an unspelled phrase finds "BRIMM" where the
    phrase said "brim". Cues are placed in the order of their numbers. A candidate is a run of the recording's tokens (see
    candidatesFor). The candidates that count are, in this order: those inside the cue's `phrase`, where it has one and `spans` ({id:
    [first, last]}, phraseSpans' or keptPhraseSpans') has it; those wholly in kept words, `kept` being the Set of their indexes
    (keptIndexes); any. A cue is asked for a kept phrase, so a caller gives the spans of the kept phrases alone (keptPhraseSpans):
    a cue that names a phrase that is cut then counts as naming none.
    Of the first of those that has a candidate, an exact one wins over a loose one, a higher count over a lower, and then the
    first at or after where the search starts, which is after the first word of the cue placed before it, and failing that the
    first. */
export function placeGraphicCues(cues, words, { spans = null, kept = null, spell = (text) => text } = {}) {
  const list = Array.isArray(words) ? words : [];
  const given = Array.isArray(cues) ? cues : [];
  const places = placesOf(given, list, { spans, kept, spell });
  const idOf = (i) => (typeof list[i].id === "string" && list[i].id ? list[i].id : `w${i}`);
  return given.map((cue, i) => ({ ...cue, at: places[i] ? { from: idOf(places[i].first), to: idOf(places[i].last), start: list[places[i].first].start, end: list[places[i].last].end } : null }));
}

// --- A Reel's cues (PR H2) ---

/** How many cues a Reel has at most: a Reel is a minute or so, and a few short graphics are all it holds (PR H2, ruling 2). */
export const REEL_CUES_MOST = 3;

/** How far outside a Reel's stretch a cue's words may be and still be the Reel's, in seconds, for a caller to give reelGraphicCues as its
    `slack`: a twentieth of a second. A Reel's ends are moved to the nearest picture (cuts.js keptSpans), up to half a picture, so a word
    that starts where a phrase does can start a few thousandths before the stretch, and one that ends where a phrase does can end a few
    thousandths after it, though the Reel holds both (a word is the Reel's when its middle is inside: project.js reelWords). */
export const REEL_EDGE_SLACK = 0.05;

/** A time to the thousandth of a second, as a Reel's words have theirs (project.js reelWords), and how near two such times must be to
    be the same one. */
const thousandth = (seconds) => Math.round(seconds * 1000) / 1000;
const SAME_TIME = 0.0005;

/** The cues of a recording, placed on its words (placeGraphicCues), as a Reel of it holds them: those whose words are wholly inside the
    Reel's `stretch` ({ start, end } in seconds of the recording, the ends included), at most the first REEL_CUES_MOST of them in the order
    given, each placed again on the Reel's own `words` ([{text, start, end, id}], its transcript.json's: on the Reel's clock, from 0, with
    the ids w0, w1, …), so that its `at` has the Reel's ids and times. A cue that was not found on the recording is not inside anything,
    and a cue whose words start before the stretch, or run past its end, is left out, and takes none of the places.
    A cue is put back where it was said, and not on the first time its words are said: the words of the Reel that start where the cue's
    first word did and end where its last did, on the Reel's clock, are its place, and placeGraphicCues looks for it there first. So
    the same words said again in the Reel, as in a retake, do not move a cue off the take it was placed on. Where no word of the Reel starts
    there it is placed by its words alone, as placeGraphicCues places any cue; and a cue the Reel's words do not hold has an `at` of null.
    The times are the Reel's words' own: one that starts before the stretch starts at 0 and one that ends after it ends at the Reel's
    length (project.js reelWords), so a cue at the Reel's edge is found where the Reel puts it.
    `spell` is the speller the Reel's words were spelled with. `slack` is how far outside the stretch, in seconds, a cue's words may
    be and still be inside it (REEL_EDGE_SLACK says why a caller gives one): none unless it is a number above 0. Each cue comes back as
    it was given, with its number, but for its `at`; what is given is not changed. */
export function reelGraphicCues(placed, stretch, words, { spell = (text) => text, slack = 0 } = {}) {
  const { start, end } = stretch !== null && typeof stretch === "object" ? stretch : {};
  if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) return [];
  const outside = Number.isFinite(slack) && slack > 0 ? slack : 0;
  const inside = (Array.isArray(placed) ? placed : [])
    .filter((cue) => cue && cue.at && Number.isFinite(cue.at.start) && Number.isFinite(cue.at.end) && cue.at.start >= start - outside && cue.at.end <= end + outside)
    .slice(0, REEL_CUES_MOST);
  const list = Array.isArray(words) ? words : [];
  const same = (a, b) => Math.abs(a - b) < SAME_TIME;
  // A time of the recording on the Reel's clock, as reelWords has it: not before 0, and not after the Reel's length.
  const length = thousandth(end - start);
  const onReel = (t) => Math.min(length, Math.max(0, thousandth(t - start)));
  // Where the cue was said, on the Reel's own words: from the word that starts when its first word did to the last that ends when its last did.
  const spans = new Map();
  const steered = inside.map(({ at, ...cue }, i) => {
    const first = list.findIndex((word) => same(word.start, onReel(at.start)));
    const last = list.findLastIndex((word, k) => k >= first && same(word.end, onReel(at.end)));
    if (first === -1 || last === -1) return cue;
    spans.set(`reel cue ${i}`, [first, last]);
    return { ...cue, phrase: `reel cue ${i}` };
  });
  const again = placeGraphicCues(steered, list, { spans, spell });
  return inside.map(({ at, ...cue }, i) => ({ ...cue, at: again[i].at }));
}

/** The cues in an object read from Claude's reply to graphicCuesAsk, { cues, problems }, at most `most` of them. Of an entry only the five
    things that were asked for are read (`id`, `words`, `kind`, `show`, `seconds`), its `id` being the phrase it was written for (its
    `phrase`): one with no id is no cue, and a style, a shot or a number of its own in a reply are not read. They are numbered from 1 and
    named, when one cannot be read, by its place in the reply's list (graphicCuesOf). A reply with no `graphicCues`, or one that is
    not a list, is said so in plain words, and nothing is read from it. */
export function graphicCuesInReply(data, most) {
  if (data.graphicCues === undefined) return { cues: [], problems: ['Its reply has no "graphicCues".'] };
  if (!Array.isArray(data.graphicCues)) return { cues: [], problems: ['"graphicCues" in its reply is not a list, so nothing was read from it.'] };
  const given = data.graphicCues.map((g) => {
    const id = g !== null && typeof g === "object" ? plain(g.id).trim() : "";
    return id ? { phrase: id, words: g.words, kind: g.kind, show: g.show, seconds: g.seconds } : null;
  });
  return graphicCuesOf(given, { most });
}

/** brimm/graphic-cues.json: version 1, the clock the times are on ("recording" for the main video, "reel" for a Reel), and the
    placed cues, with a new line after, as cut-suggestions.json is written. */
export function graphicCuesJson(placed, clock) {
  if (clock !== "recording" && clock !== "reel") throw new Error(`graphicCuesJson: the clock is "recording" or "reel", not ${JSON.stringify(clock)}`);
  return `${JSON.stringify({ version: 1, clock, cues: Array.isArray(placed) ? placed : [] }, null, 2)}\n`;
}

// --- An older plan's ideas ---

/** The ideas for graphics that a cut plan made before the cues holds (`claude.graphics`, each {id, idea}) as graphic cues: each
    on the words of the phrase it sat on, the phrase's text cut to its first 30 words and 200 characters, showing the idea for
    4 seconds, and written for that phrase. They are in the order of the phrases, and for two on one phrase the order given. An
    idea whose phrase the plan has not, or has no words, is left out. */
export function legacyCues(graphics, phrases) {
  const place = new Map((Array.isArray(phrases) ? phrases : []).map((p, i) => [p?.id, i]));
  const ideas = (Array.isArray(graphics) ? graphics : [])
    .map((g, i) => ({ g, i, at: place.get(g?.id) }))
    .filter(({ at }) => at !== undefined)
    .sort((a, b) => a.at - b.at || a.i - b.i);
  const entries = ideas.map(({ g, at }) => ({ words: phrases[at].text, kind: "graphic", show: g.idea, seconds: CUE_SECONDS, phrase: g.id }));
  return graphicCuesOf(entries, { kinds: SHOT_KINDS }).cues;
}

/** The graphic cues a cut plan holds: its `claude.graphicCues`, and failing that, for a plan made before them, its
    `claude.graphics` as legacyCues makes them. None for a plan with neither. */
export function graphicCuesOfPlan(plan) {
  const claude = plan?.claude;
  if (Array.isArray(claude?.graphicCues)) return claude.graphicCues;
  return Array.isArray(claude?.graphics) ? legacyCues(claude.graphics, plan.phrases) : [];
}

/** The cues of a cut plan placed on `words`, as the plan's own phrases say which words are kept: [{ cue, at, kept }], in the order
    the cues are given. `at` is { start, end }, the start of the first word of the cue's words and the end of the last, or null when
    they are not found; `kept` is whether they are all kept words (outside every suggested cut), which a cue not found is not.
    Placed as placeGraphicCues places a cue, given the plan's phrases: a cue is first in its own phrase when that phrase is kept,
    and one that names a phrase that is cut counts as naming none, so its words are looked for in kept words first and in the cut
    only when they are said nowhere else. With `older` the cues are an older plan's ideas for graphics (legacyCues), which stay
    tied to their own phrase, kept or cut, as they always were: one on a phrase that is cut is placed there, in the cut.
    `words` are the episode's, as they are said (clock.js heardWords), each {w, start, end} or {text, start, end}. */
export function graphicCuesInPlan(cues, plan, words, { older = false } = {}) {
  const given = Array.isArray(cues) ? cues : [];
  const list = Array.isArray(words) ? words : [];
  const kept = keptIndexes(plan?.phrases);
  const places = placesOf(given, list, { spans: older ? phraseSpans(plan?.phrases) : keptPhraseSpans(plan?.phrases), kept, spell: (text) => text });
  return given.map((cue, i) => {
    const place = places[i];
    if (!place) return { cue, at: null, kept: false };
    const whole = Array.from({ length: place.last - place.first + 1 }, (_, n) => place.first + n).every((n) => kept.has(n));
    return { cue, at: { start: list[place.first].start, end: list[place.last].end }, kept: whole };
  });
}

/** The notes a Final Cut file gets for a cut plan's cues, [{at, text}]: `Graphic idea: <show>` at the moment the first word of
    each cue starts, worded so that nobody takes it for more than an idea. A note is made only for a cue placed wholly in kept
    words: today's notes keep only kept phrases, and a note in a cut would land on a join, as if it belonged there (fcpxml.js).
    An older plan's ideas are placed on their own phrases (graphicCuesInPlan `older`), so they have the notes they always had.
    `words` are the episode's, as they are said (clock.js heardWords), each {w, start, end} or {text, start, end}. */
export function cueMarkers(plan, words) {
  const older = !Array.isArray(plan?.claude?.graphicCues);
  return graphicCuesInPlan(graphicCuesOfPlan(plan), plan, words, { older })
    .filter(({ kept }) => kept)
    .map(({ cue, at }) => ({ at: at.start, text: `Graphic idea: ${oneLine(cue.show)}` }));
}
