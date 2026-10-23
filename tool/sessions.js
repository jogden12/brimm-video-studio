// A private session's names, and what she approves of it (spec 2026-10-22, sections 3 and 8). A session is a recording of Sallie with
// a client or a group, so what its people are called must reach neither the principles brimm-video hands to the BRIMM Ops page nor
// her chat where the spec forbids it. Before the call, every speaker of a Zoom transcript but her is "Participant 1", "Participant 2"
// and so on, and the map of who was who stays on the Mac. After the call, Claude's reply is checked field by field against the names
// brimm-video can see: a field that holds one is left out, and the check says which field, never the name. She then keeps, changes
// or drops each item by her own command, and only what she approved is handed over.
// The check catches the names brimm-video can see, not a client's business: her approval is the real gate.
// Nothing here touches a disk or runs a program.
import { basename, extname } from "node:path";
import { SHOW, HOST } from "./shared/show.js";
import { spellNames } from "./lib.js";
import { isZoomName } from "./kinds.js";

const list = (v) => (Array.isArray(v) ? v : []);
/** Text on one line, with no space at either end. */
const oneLine = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** One word of a speaker's label: anything but white space, a colon or a bracket. */
const LABEL_WORD = "[^\\s:()<>\\[\\]]+";
/** What may be a speaker's label: one to four words, and a bracketed note after them. Whether it is one is for `isLabel` to say. */
const LABEL = `${LABEL_WORD}(?:[ \\t]+${LABEL_WORD}){0,3}(?:[ \\t]+\\([^()\\r\\n]*\\))?`;
/** A WebVTT timing line, as "00:00:04.500 --> 00:00:07.000". */
const TIMING = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/;
/** Each finds a label as its second group, with what comes before it as the first and what comes after it as the third. A label
    begins a line and has a colon after it; or stands in a voice tag, "<v Jane Doe>"; or is in the brackets that begin a line of
    Zoom's saved transcript, "[Jane Doe] 10:02:13". */
const LEADING = new RegExp(`^([ \\t]*)(${LABEL})(:(?=\\s|$))`, "u");
const VOICE = new RegExp(`(<v[ \\t]+)(${LABEL})(>)`, "gu");
const SAVED = new RegExp(`^([ \\t]*\\[)(${LABEL})(\\](?=[ \\t]+\\d{1,2}:\\d{2}))`, "u");

/** Whether what stands where a label may be is one: at most forty characters, and every word of it holding a capital letter or
    being a number. So "Jane Doe", "Jane's iPhone" and "Speaker 2" are labels, and "So here's the thing" is not. */
function isLabel(label) {
  if (label.length > 40) return false;
  return label.replace(/[ \t]+\([^()]*\)$/, "").split(/[ \t]+/).every((w) => /\p{Lu}/u.test(w) || /^\+?\p{N}[\p{N}-]*$/u.test(w));
}

/** Whether a label holds `word` as a whole word, whatever the case: "Sallie's iPhone" does, "Salliebeth Kay" does not. */
const holds = (label, word) => label.toLowerCase().split(/[^\p{L}\p{N}]+/u).includes(word.toLowerCase());

/** A Zoom transcript with every speaker's label but Sallie's replaced by "Participant 1", "Participant 2" and so on, in the order
    the speakers first appear, the same label always by the same number: { text, map }. `map` goes from each label replaced, as it
    is written, to its Participant. Sallie's label is any that holds `sallie` as a word, and is left as it is written.
    What a label is depends on the text. In a WebVTT text (one with a timing line, "00:00:04.500 --> 00:00:07.000") it is the
    "Label:" that begins the first line of a cue's words, and a voice tag. In a saved Zoom transcript, whose lines begin
    "[Label] 10:02:13", it is the bracketed label. In a text with neither it is the "Label:" that begins any line. Everything else
    in the text, the names said in it too, is as it was, character for character: that is for the name check. Not text gives no
    text and an empty map. */
export function replaceSpeakers(zoomText, sallie = "Sallie") {
  if (typeof zoomText !== "string") return { text: "", map: {} };
  const hers = String(sallie || "Sallie");
  const map = {};
  const named = (label) => {
    if (!isLabel(label) || holds(label, hers)) return label;
    // A label may be the name of a method every object has, which is why this asks whether the map has it of its own.
    if (!Object.hasOwn(map, label)) map[label] = `Participant ${Object.keys(map).length + 1}`;
    return map[label];
  };
  const swap = (line, re) => line.replace(re, (all, before, label, after) => before + named(label) + after);
  const lines = zoomText.split("\n");
  const vtt = lines.some((l) => TIMING.test(l));
  const saved = !vtt && lines.some((l) => { const m = SAVED.exec(l); return m !== null && isLabel(m[2]); });
  const out = lines.map((line, i) => {
    if (!vtt) return swap(line, saved ? SAVED : LEADING);
    // Only the first line of a cue's words, the line right after its timing line, begins with a speaker. A later line may begin
    // with words and a colon that are not one.
    return swap(i > 0 && TIMING.test(lines[i - 1]) ? swap(line, LEADING) : line, VOICE);
  });
  return { text: out.join("\n"), map };
}

/** The words of a text, as names are looked for among them: runs of letters, figures and apostrophes, a curly apostrophe read as
    a straight one, with no apostrophe at either end and no possessive 's. The text is first written the one way (NFKC), so that an
    accent written apart from its letter, as a Mac writes it in a file's name, is joined to it, and a full-width letter is a plain one. */
const pieces = (text) =>
  (String(text ?? "").normalize("NFKC").match(/[\p{L}\p{M}\p{N}'’]+/gu) || [])
    .map((w) => w.replace(/’/g, "'").replace(/^'+|'+$/g, "").replace(/'s$/i, ""))
    .filter(Boolean);
const letters = (w) => (w.match(/\p{L}/gu) || []).length;
const capital = (w) => /^\p{Lu}/u.test(w);
/** The pieces of a text that can be names: those of at least two letters. */
const wordsOf = (text) => pieces(text).filter((w) => letters(w) >= 2);

/** What ends a sentence as the transcriber writes it: a full stop, a question mark, an exclamation mark or an ellipsis, with any
    closing quote or bracket after it. */
const SENTENCE_END = /[.?!…]["'”’»)\]}]*$/;
/** I and its short forms are written with a capital in the middle of a sentence, and are nobody's name. */
const I_FORM = /^I(?:'(?:m|ve|ll|d))?$/;

/** The words that a words file writes in the middle of a sentence: every word but the first of the recording, and but the first
    after one that ends a sentence. `words` is the words file's words, each {w} with spaces and punctuation round it, or a text. */
function midSentence(words) {
  const tokens = (typeof words === "string" ? [words] : list(words)).flatMap((w) => String((w && typeof w === "object" ? w.w : w) ?? "").split(/\s+/)).filter(Boolean);
  const mid = [];
  let starts = true;
  for (const token of tokens) {
    const found = pieces(token);
    if (found.length) {
      mid.push(...(starts ? found.slice(1) : found));
      starts = false;
    }
    if (SENTENCE_END.test(token)) starts = true;
  }
  return mid;
}

/** Whether the transcriber capitalised the recording throughout: of the words it writes in the middle of a sentence that begin
    with a letter, there are at least twenty, and more than half of them begin with a capital. Then a capital says nothing. */
function throughout(mid) {
  const lettered = mid.filter((w) => /^\p{L}/u.test(w));
  return lettered.length >= 20 && lettered.filter(capital).length * 2 > lettered.length;
}

const SKIPPED = "The transcriber wrote this recording with capitals throughout, so brimm-video did not check its capitalised words for names: only the speakers' names and the file's name were checked.";

/** The line that says the capitalised words of a recording were not checked for names, because the transcriber capitalised it
    throughout, and nothing for any other recording. */
export const namesSkipped = (words) => (throughout(midSentence(words)) ? SKIPPED : "");

/** A spelling as the record keeps it, [heard, spelled], or as {heard, spelled}: its two sides. */
const sidesOf = (s) => (Array.isArray(s) ? s.slice(0, 2) : s && typeof s === "object" ? [s.heard, s.spelled] : []);

/** The single words that brimm-video can see are names, each once, in the spelling it saw first:
    - every word of the labels in `map`, the speakers it replaced;
    - unless `fileName` is Zoom's, every word of the file's name (its folder and its extension are not), of at least two letters
      and no figure, but for one that `words` writes in lowercase in the middle of a sentence, which is an ordinary word;
    - unless the recording is capitalised throughout, every word that `words` writes with a capital in the middle of a sentence;
    but not, whatever the case, a word of the `show`'s names or of either side of a spelling of the episode's, which are
    no one's. Each is spelled the show's way first, so that "Sally" is "Sallie" and left out. */
export function visibleNames({ map = {}, fileName = "", words = [], show = [SHOW, HOST, "The BRIMM"], spellings = [] } = {}) {
  const mid = midSentence(words);
  // A word of the file's name in lowercase is found among these only when the recording writes it that way.
  const ordinary = new Set(mid);
  const file = String(fileName ?? "");
  const found = [
    ...Object.keys(map || {}).flatMap(wordsOf),
    ...(isZoomName(file) ? [] : wordsOf(basename(file, extname(file))).filter((w) => !/\p{N}/u.test(w) && !ordinary.has(w.toLowerCase()))),
    ...(throughout(mid) ? [] : mid.filter((w) => capital(w) && letters(w) >= 2 && !I_FORM.test(w)))
  ];
  const left = new Set([...list(show), ...list(spellings).flatMap(sidesOf)].flatMap(wordsOf).map((w) => w.toLowerCase()));
  const names = new Map();
  for (const w of found.map(spellNames)) {
    const key = w.toLowerCase();
    if (!left.has(key) && !names.has(key)) names.set(key, w);
  }
  return [...names.values()];
}

/** The lists of a session's items, and what an item of each is called when she reads of it. */
const SESSION_LISTS = [["principles", "Principle"], ["recurringPrinciples", "Recurring principle"], ["reelIdeas", "Reel idea"]];
/** The lists the name check walks: those of a session, and the Reel ideas of a hand-off, which she reads of in the same way. */
const LISTS = [...SESSION_LISTS, ["reelsToFilm", "Reel idea"]];
/** The keys of an item that hold no words. */
const NO_WORDS = new Set(["n", "approved", "refilm", "principle"]);
const NAME_SEEN = "it held a name brimm-video can see";

/** A reading with every field that holds a name left out: { kept, dropped }. The reading is not changed. Every text field and
    every list of texts of every item of its lists (the principles, the recurring principles, the Reel ideas, and the Reel ideas
    to film) is looked at, whichever of the lists the reading has. A field holds a name when one of its words, as visibleNames
    splits them, is one of `names` whatever the case, and is written with a capital letter: the client "Mark" is in "Mark said"
    and not in "mark the date". A field that holds one is not in its item in `kept`, and a list is left out whole. `dropped` has
    one { field, why } for each, with `field` as she reads of it ("Principle 2's example_application") and `why` in plain words.
    Neither holds the name or any word of the field: a field is named by its key, and the keys are the readers' own. */
export function checkNames(reading, names) {
  const known = new Set(list(names).map((n) => String(n).normalize("NFKC").toLowerCase()));
  const holdsName = (value) => (Array.isArray(value) ? value.some(holdsName) : typeof value === "string" && pieces(value).some((w) => capital(w) && known.has(w.toLowerCase())));
  const kept = { ...reading };
  const dropped = [];
  for (const [key, label] of LISTS) {
    if (!Array.isArray(reading?.[key])) continue;
    kept[key] = reading[key].map((item) => {
      if (!item || typeof item !== "object") return item;
      const left = {};
      for (const [field, value] of Object.entries(item)) {
        if (!NO_WORDS.has(field) && holdsName(value)) dropped.push({ field: `${label} ${item.n}'s ${field}`, why: NAME_SEEN });
        else left[field] = value;
      }
      return left;
    });
  }
  return { kept, dropped };
}

/** The keys of each kind of item that she may change by saying so, as `approve` takes them. */
export const EDITS = {
  principles: ["name", "category", "description", "example_application"],
  recurringPrinciples: ["text"],
  reelIdeas: ["idea", "words", "why"]
};

const SAY_VERB = 'Say keep, drop or edit, then the numbers: keep 1 3, drop 2, edit 3 --name "…".';
const SAY_NUMBERS = "Say which numbers: keep 1 3.";
const SAY_ONE = 'Edit one at a time: edit 3 --name "…".';
const SAY_WHAT = 'Say what to change it to: edit 3 --name "…".';

/** The numbers in these words, any of which may be several joined with commas ("1,3"), or null when one is no number. */
function numbersIn(words) {
  const given = words.flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean);
  return given.every((w) => /^\d+$/.test(w)) ? given.map(Number) : null;
}

/** A list of words as a sentence says it: "a", "a or b", "a, b or c". */
const orList = (l) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} or ${l[l.length - 1]}` : l.join(""));

/** What she says of a list of items, as the words after its label: ["keep", "1", "3"], ["drop", "2"] or ["edit", "3", "--name",
    "Price first"]. The numbers are the items' `n`, and may be joined with commas. Gives { items }, a new list in which `keep` has
    set `approved: true` on each item named and `drop` has set `approved: false`; and `edit` has set each key it names, from
    `--key text` (the text trimmed and on one line, in as many words as it comes in), and `approved: true`, because an edit she
    dictates counts as hers. Only a key in `editable` may be edited. Or gives { why }, in plain words, for what cannot be done,
    and then nothing is changed. The items given are not changed either way. */
export function approve(items, said, editable = EDITS.principles) {
  const given = list(items);
  const words = list(said).map(String);
  if (!["keep", "drop", "edit"].includes((words[0] ?? "").toLowerCase())) return { why: SAY_VERB };
  const verb = words[0].toLowerCase();
  const rest = words.slice(1);
  // The numbers come first, and for an edit they end where the first "--key" is.
  const at = verb === "edit" ? rest.findIndex((w) => w.startsWith("--")) : -1;
  const numbers = numbersIn(at === -1 ? rest : rest.slice(0, at));
  if (!numbers || !numbers.length) return { why: SAY_NUMBERS };
  const missing = numbers.find((n) => !given.some((item) => item.n === n));
  if (missing !== undefined) return { why: `There is no ${missing} in this list.` };
  if (verb !== "edit") return { items: given.map((item) => (numbers.includes(item.n) ? { ...item, approved: verb === "keep" } : { ...item })) };
  if (numbers.length !== 1) return { why: SAY_ONE };
  // Each "--key" begins a text, which is the words up to the next "--key".
  const edits = [];
  for (const w of at === -1 ? [] : rest.slice(at)) {
    if (w.startsWith("--")) edits.push([w.slice(2), []]);
    else edits[edits.length - 1][1].push(w);
  }
  const texts = edits.map(([key, spoken]) => [key, oneLine(spoken.join(" "))]);
  if (!texts.length || texts.some(([, text]) => !text)) return { why: SAY_WHAT };
  const may = list(editable);
  const not = texts.find(([key]) => !may.includes(key));
  if (not) return { why: `--${not[0]} cannot be changed here: change ${orList(may)}.` };
  return { items: given.map((item) => (item.n === numbers[0] ? { ...item, ...Object.fromEntries(texts), approved: true } : { ...item })) };
}

/** One line for each item of a session she has not decided, which is one with no `approved` of true or false: the principles
    first, then the recurring principles, then the Reel ideas, each by its `n`. A list that is missing counts as empty. */
export const undecided = (session) =>
  SESSION_LISTS.flatMap(([key, label]) =>
    list(session?.[key])
      .filter((item) => typeof item?.approved !== "boolean")
      .map((item) => `${label} ${item.n} is not decided yet: keep it or drop it.`)
  );

/** The keys of a principle that the page takes, in the order the hand-off has them, and the keys of a Reel idea to film that are
    kept as they are: its `principle` is set on its own. */
const PRINCIPLE_KEYS = ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"];
const REEL_KEYS = ["n", "idea", "words", "why"];
const pick = (item, keys) => Object.fromEntries(keys.filter((k) => Object.hasOwn(item, k)).map((k) => [k, item[k]]));

/** What a session hands over once she has decided every item of it, for the hand-off to take as its `session`:
    { session: { principles, recurringPrinciples, reelsToFilm } }, or { why } while it cannot be handed over. Only what she
    approved is in it, ordered by `n`, and the name check is run on it again with `names`, as an edit she dictated may hold a
    name. A principle has the keys the page takes and never its `source_context` or its `approved`; a field the check took out is
    left out, and is not an empty text or list. A Reel idea to film (kept, with `refilm` true) has its `principle` only when that
    principle is in the hand-off, and null otherwise. A kept idea that is not to be filmed is not in it: a Reel cut from the
    session is made, with the client's agreement, by a later phase.
    It is refused, in plain words and with the name never in them, while an item is undecided, and for a kept item the check left
    with nothing to say: a principle with no name, a recurring principle with no text, a Reel idea to film with no idea or no words. */
export function approvedSession(session, names) {
  const open = undecided(session);
  if (open.length) return { why: open.join("\n") };
  const approved = Object.fromEntries(SESSION_LISTS.map(([key]) => [key, list(session?.[key]).filter((item) => item.approved === true).sort((a, b) => a.n - b.n)]));
  const { kept } = checkNames(approved, names);
  const filmed = kept.reelIdeas.filter((r) => r.refilm === true);
  const refusals = [
    ...kept.principles.filter((p) => !p.name).map((p) => `Principle ${p.n}'s name held a name brimm-video took out: give it another name, or drop it.`),
    ...kept.recurringPrinciples.filter((r) => !r.text).map((r) => `Recurring principle ${r.n}'s text held a name brimm-video took out: say it another way, or drop it.`),
    ...filmed.flatMap((r) => ["idea", "words"].filter((field) => !r[field]).map((field) => `Reel idea ${r.n}'s ${field} held a name brimm-video took out: say it another way, or drop it.`))
  ];
  if (refusals.length) return { why: refusals.join("\n") };
  const principles = kept.principles.map((p) => pick(p, PRINCIPLE_KEYS));
  const shown = new Set(principles.map((p) => p.n));
  return {
    session: {
      principles,
      recurringPrinciples: kept.recurringPrinciples.map((r) => pick(r, ["n", "text"])),
      reelsToFilm: filmed.map((r) => ({ ...pick(r, REEL_KEYS), principle: shown.has(r.principle) ? r.principle : null }))
    }
  };
}
