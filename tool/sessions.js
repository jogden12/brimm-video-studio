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

/** How far into a line a label may reach: a cue's label ends at a colon before this, and a saved transcript's label is no longer. */
const LABEL_MOST = 80;
/** A WebVTT timing line, as "00:00:04.500 --> 00:00:07.000". */
const TIMING = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/;
/** A colon that ends a cue's label: one that a space follows, or that ends the line. */
const COLON = /:(?=\s|$)/;
/** A line that begins with a voice tag, which names the speaker itself. */
const VOICED = /^\s*<v[\s.]/;
/** A voice tag, "<v Jane Doe>" or "<v.loud Jane Doe>": its text is the label. */
const VOICE = /<v(?:\.[^\s>]*)?[ \t]+([^>\r\n]*)>/g;
/** A line of Zoom's saved transcript, "[Jane Doe] 10:02:13": the text in the brackets is the label. */
const SAVED = new RegExp(`^([ \\t]*\\[)([^\\]\\r\\n]{1,${LABEL_MOST}})(\\](?=[ \\t]+\\d{1,2}:\\d{2}))`);

/** What may be a speaker's label in a text that has neither form: one to four words, and a bracketed note after them. Whether it
    is one is for `isLabel` to say. */
const LABEL_WORD = "[^\\s:()<>\\[\\]]+";
const LEADING = new RegExp(`^([ \\t]*)(${LABEL_WORD}(?:[ \\t]+${LABEL_WORD}){0,3}(?:[ \\t]+\\([^()\\r\\n]*\\))?)(:(?=\\s|$))`, "u");

/** Whether what stands where a label may be in a text with no timing lines and no brackets is one: at most forty characters, a
    first word with a letter in it, and every word of it holding a capital letter or a letter that has no case, or being a number.
    So "Jane Doe", "Jane's iPhone", "李明" and "Speaker 2" are labels, and "So here's the thing" and "1: first point" are not. */
function isLabel(label) {
  if (label.length > 40) return false;
  const words = label.replace(/[ \t]+\([^()]*\)$/, "").split(/[ \t]+/);
  return /\p{L}/u.test(words[0]) && words.every((w) => /[\p{Lu}\p{Lt}\p{Lo}]/u.test(w) || /^\+?\p{N}[\p{N}-]*$/u.test(w));
}

/** The words of a text in lowercase, apart from one another: runs of letters and figures. */
const wordsAlone = (text) => String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Whether a label is Sallie's: outside any bracketed note, it holds every word of `sallie` as a whole word, whatever the case.
    "Sallie's iPhone" holds "Sallie", and "Salliebeth Kay" does not. "Jane Doe (Sallie's guest)" is not hers. */
function isHers(label, sallie) {
  const mine = wordsAlone(sallie || "");
  const here = wordsAlone(label.replace(/\([^()]*\)/g, " "));
  return (mine.length ? mine : ["sallie"]).every((w) => here.includes(w));
}

/** The place [from, to) of `line` between `from` and `to` with the white space at both ends left out, or null when nothing is left. */
function trimmedPlace(line, from, to) {
  const text = line.slice(from, to);
  const start = from + text.length - text.trimStart().length;
  const label = text.trim();
  return label ? [start, start + label.length] : null;
}

/** A Zoom transcript with every speaker's label but Sallie's replaced by "Participant 1", "Participant 2" and so on, in the order
    the speakers first appear, the same label always by the same number: { text, map }. `map` goes from each label replaced, as it
    is written, to its Participant. Sallie's label is any that holds every word of `sallie`, outside a bracketed note, and is left
    as it is written.
    A label is found by where the format puts it, and is then everything that stands there, whatever it is made of, since a name
    may be written in any way: in a WebVTT text (one with a timing line, "00:00:04.500 --> 00:00:07.000"), everything before the
    first colon that a space follows, or that ends the line, in the first line of a cue's words if the colon is in its first 80
    characters, and the whole text of a voice tag "<v Jane Doe>"; in a saved Zoom transcript, whose lines begin "[Jane Doe] 10:02:13",
    the whole text in the brackets, of up to 80 characters. Only in a text with neither is a label told from words by what it looks
    like (isLabel), as the "Label:" that begins a line. Everything else in the text, the names said in it too, is as it was,
    character for character: that is for the name check. Not text gives no text and an empty map. */
export function replaceSpeakers(zoomText, sallie = "Sallie") {
  if (typeof zoomText !== "string") return { text: "", map: {} };
  const map = {};
  const named = (label) => {
    if (isHers(label, sallie)) return label;
    // A label may be the name of a method every object has, which is why this asks whether the map has it of its own.
    if (!Object.hasOwn(map, label)) map[label] = `Participant ${Object.keys(map).length + 1}`;
    return map[label];
  };
  /** `line` with the label at `place` replaced. */
  const swap = (line, place) => (place ? line.slice(0, place[0]) + named(line.slice(place[0], place[1])) + line.slice(place[1]) : line);
  const lines = zoomText.split("\n");
  const vtt = lines.some((l) => TIMING.test(l));
  const saved = !vtt && lines.some((l) => SAVED.test(l));
  const out = lines.map((line, i) => {
    if (vtt) {
      // Only the first line of a cue's words, the line right after its timing line, begins with a speaker. A later line may begin
      // with words and a colon that are not one. A line that begins with a voice tag names its speaker in the tag.
      const colon = i > 0 && TIMING.test(lines[i - 1]) && !VOICED.test(line) ? COLON.exec(line) : null;
      const first = swap(line, colon && colon.index < LABEL_MOST ? trimmedPlace(line, 0, colon.index) : null);
      return first.replace(VOICE, (tag, text) => swap(tag, trimmedPlace(tag, tag.length - 1 - text.length, tag.length - 1)));
    }
    if (saved) return line.replace(SAVED, (all, before, text, after) => before + swap(text, trimmedPlace(text, 0, text.length)) + after);
    return line.replace(LEADING, (all, before, label, after) => (isLabel(label) ? before + named(label) + after : all));
  });
  return { text: out.join("\n"), map };
}

/** An apostrophe, straight, curly or U+02BC. */
const APOSTROPHES = new RegExp(`[’${String.fromCharCode(0x2bc)}]`, "g");
const letters = (w) => (w.match(/\p{L}/gu) || []).length;
const capital = (w) => /^\p{Lu}/u.test(w);
const lowercase = (w) => /^\p{Ll}/u.test(w);

/** The words of a text, as names are looked for among them: runs of letters, figures and apostrophes, with every kind of
    apostrophe read as a straight one, none at either end, and no possessive 's. The text is first written the one way (NFKC), so
    that an accent written apart from its letter, as a Mac writes it in a file's name, is joined to it, and a full-width letter is
    a plain one. */
const baseWords = (text) =>
  (String(text ?? "").normalize("NFKC").match(/[\p{L}\p{M}\p{N}'’]+/gu) || [])
    .map((w) => w.replace(APOSTROPHES, "'").replace(/^'+|'+$/g, "").replace(/'s$/i, ""))
    .filter(Boolean);
/** A word and, when it changes from lowercase to a capital, the parts it is made of: "JaneDoe" is "JaneDoe", "Jane" and "Doe". */
const withParts = (w) => {
  const parts = w.split(/(?<=\p{Ll})(?=\p{Lu})/u);
  return parts.length > 1 ? [w, ...parts] : [w];
};
/** All the words of a text that can be looked for, parts included: the words a field is checked by. */
const pieces = (text) => baseWords(text).flatMap(withParts);
/** The pieces of a text that can be names: those of at least two letters. */
const wordsOf = (text) => pieces(text).filter((w) => letters(w) >= 2);

/** What ends a sentence as the transcriber writes it: a full stop, a question mark, an exclamation mark or an ellipsis, with any
    closing quote or bracket after it. A title, "Dr.", and a single letter with a full stop, "J.", do not end one. */
const SENTENCE_END = /[.?!…]["'”’»)\]}]*$/;
const ABBREVIATION = /(?:^|[^\p{L}\p{N}])(?:mr|mrs|ms|mx|dr|prof|st|jr|sr|\p{L})\.["'”’»)\]}]*$/iu;
const endsSentence = (token) => SENTENCE_END.test(token) && !ABBREVIATION.test(token);
/** I and its short forms are written with a capital in the middle of a sentence, and are nobody's name. */
const I_FORM = /^I(?:'(?:m|ve|ll|d))?$/;
/** Words that are nobody's name wherever they stand: pronouns, which a label may hold, and titles. */
const NEVER_NAMES = new Set(["she", "her", "hers", "he", "him", "his", "they", "them", "their", "theirs", "mr", "mrs", "ms", "mx", "dr", "prof", "st", "jr", "sr"]);
/** The words in the name of a file that Zoom downloads that are Zoom's own. */
const ZOOM_WORDS = new Set(["gmt", "recording", "gvo", "avo", "audio", "video", "gallery", "speaker", "shared", "screen", "view", "only", "transcript", "chat"]);

/** The words that a words file writes in the middle of a sentence: every word but the first of the recording, and but the first
    after one that ends a sentence. `words` is the words file's words, each {w} with spaces and punctuation round it, or a text. */
function midSentence(words) {
  const tokens = (typeof words === "string" ? [words] : list(words)).flatMap((w) => String((w && typeof w === "object" ? w.w : w) ?? "").split(/\s+/)).filter(Boolean);
  const mid = [];
  let starts = true;
  for (const token of tokens) {
    const found = baseWords(token);
    if (found.length) {
      mid.push(...(starts ? found.slice(1) : found));
      starts = false;
    }
    if (endsSentence(token)) starts = true;
  }
  return mid;
}

/** Whether the transcriber capitalised the recording throughout: of the words it writes in the middle of a sentence that begin
    with a letter, and have two letters or more as a word has, there are at least twenty, and more than half of them begin with a
    capital. Then a capital says nothing. */
function throughout(mid) {
  const lettered = mid.filter((w) => /^\p{L}/u.test(w) && letters(w) >= 2);
  return lettered.length >= 20 && lettered.filter(capital).length * 2 > lettered.length;
}

const SKIPPED = "The transcriber wrote this recording with capitals throughout, so brimm-video did not check its capitalised words for names: only the speakers' names and the file's name were checked.";

/** The line that says the capitalised words of a recording were not checked for names, because the transcriber capitalised it
    throughout, and nothing for any other recording. */
export const namesSkipped = (words) => (throughout(midSentence(words)) ? SKIPPED : "");

/** A spelling as the record keeps it, [heard, spelled], or as {heard, spelled}: its two sides. */
const sidesOf = (s) => (Array.isArray(s) ? s.slice(0, 2) : s && typeof s === "object" ? [s.heard, s.spelled] : []);

/** The single words that brimm-video can see are names, each once, in the spelling it saw first:
    - every word of the labels in `map`, the speakers it replaced, the words of a bracketed note too: the tool has ruled the label
      is not Sallie's, so not even a word of the show's names, of a spelling or of Sally is left out, but for a pronoun, a title,
      and a word that begins in lowercase and that `words` writes in lowercase in the middle of a sentence, which is an ordinary word;
    - every word of the file's name (its folder and its extension are not), of at least two letters and no figure, but for one that
      `words` writes in lowercase in the middle of a sentence, and, for a name that is Zoom's, Zoom's own words;
    - unless the recording is capitalised throughout, every word that `words` writes with a capital in the middle of a sentence;
    and of the last two, not, whatever the case, a word of the `show`'s names or of either side of a spelling of the episode's,
    which are no one's, and each is spelled the show's way first, so that "Sally" is "Sallie" and left out. A word that changes
    from lowercase to a capital is also the parts it is made of. */
export function visibleNames({ map = {}, fileName = "", words = [], show = [SHOW, HOST, "The BRIMM"], spellings = [] } = {}) {
  const mid = midSentence(words);
  const ordinary = new Set(mid);
  const never = (w) => NEVER_NAMES.has(w.toLowerCase());
  const speakers = Object.keys(map || {}).flatMap(wordsOf).filter((w) => !never(w) && !(lowercase(w) && ordinary.has(w.toLowerCase())));
  const file = String(fileName ?? "");
  const own = isZoomName(file) ? ZOOM_WORDS : new Set();
  const fromFile = baseWords(basename(file, extname(file)))
    .filter((w) => !/\p{N}/u.test(w))
    .flatMap(withParts)
    .filter((w) => letters(w) >= 2 && !never(w) && !own.has(w.toLowerCase()) && !ordinary.has(w.toLowerCase()));
  const capitalised = throughout(mid) ? [] : mid.filter(capital).flatMap(withParts).filter((w) => letters(w) >= 2 && !never(w) && !I_FORM.test(w));
  const left = new Set([...list(show), ...list(spellings).flatMap(sidesOf)].flatMap(wordsOf).map((w) => w.toLowerCase()));
  const names = new Map();
  const add = (w) => {
    if (!names.has(w.toLowerCase())) names.set(w.toLowerCase(), w);
  };
  speakers.forEach(add);
  for (const w of [...fromFile, ...capitalised].map(spellNames)) if (!left.has(w.toLowerCase())) add(w);
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
    to film) is looked at, whichever of the lists the reading has. Each of `names` is split into words as visibleNames splits
    them. A field holds a name when one of its words, so split, is one of them whatever the case, and is either written with a
    capital letter or a letter that has no case, or was seen beginning in lowercase: the client "Mark" is in "Mark said" and not in
    "mark the date", and "d'Angelo" is in "As d'Angelo put it". A field that holds one is not in its item in `kept`, and a list is
    left out whole. `dropped` has one { field, why } for each, with `field` as she reads of it ("Principle 2's example_application")
    and `why` in plain words. Neither holds the name or any word of the field: a field is named by its key, and the keys are the
    readers' own. */
export function checkNames(reading, names) {
  // For each name, in lowercase: whether one of its spellings begins in lowercase, which takes a word of any case.
  const known = new Map();
  for (const w of list(names).flatMap(wordsOf)) known.set(w.toLowerCase(), known.get(w.toLowerCase()) || lowercase(w));
  const holdsName = (value) => {
    if (Array.isArray(value)) return value.some(holdsName);
    return typeof value === "string" && pieces(value).some((w) => known.has(w.toLowerCase()) && (known.get(w.toLowerCase()) || !lowercase(w)));
  };
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

/** The keys of a principle that the page takes, in the order the hand-off has them, and the keys of a Reel idea to film that hold
    words. */
const PRINCIPLE_KEYS = ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"];
const REEL_KEYS = ["n", "idea", "words", "why", "principle"];
const pick = (item, keys) => Object.fromEntries(keys.filter((k) => Object.hasOwn(item, k)).map((k) => [k, item[k]]));
/** Whether a value is text with something in it. */
const filled = (v) => typeof v === "string" && v.trim() !== "";
/** A text, or an empty one when the value is not text; and a list of texts, a copy, or an empty one. */
const textOf = (v) => (typeof v === "string" ? v : "");
const textsOf = (v) => list(v).filter((t) => typeof t === "string");

/** What a session hands over once she has decided every item of it, for the hand-off to take as its `session`:
    { session: { principles, recurringPrinciples, reelsToFilm }, dropped }, or { why } while it cannot be handed over. Only what
    she approved is in it, ordered by `n`, and the name check is run on it again with `names`, as an edit she dictated may hold a
    name; `dropped` is what that check took out of what is in the file, as checkNames gives it. A principle has the keys the page
    takes and never its `source_context` or its `approved`; a field the check took out is written as an empty text, or an empty
    list, as the page reads a missing one. A Reel idea to film (kept, with `refilm` true) has its `principle` only when that
    principle is in the hand-off, and null otherwise. A kept idea that is not to be filmed is not in it: a Reel cut from the
    session is made, with the client's agreement, by a later phase. The lists are copies.
    It is refused, in plain words and with the name never in them, while an item is undecided, and for a kept item the check left
    with nothing to say: a principle with no name, a recurring principle with no text, a Reel idea to film with no idea or no
    words, each missing, not text, or blank. */
export function approvedSession(session, names) {
  const open = undecided(session);
  if (open.length) return { why: open.join("\n") };
  const approved = (key) => list(session?.[key]).filter((item) => item?.approved === true).sort((a, b) => a.n - b.n);
  // Only what goes into the file is looked at.
  const chosen = {
    principles: approved("principles").map((p) => pick(p, PRINCIPLE_KEYS)),
    recurringPrinciples: approved("recurringPrinciples").map((r) => pick(r, ["n", "text"])),
    reelIdeas: approved("reelIdeas").filter((r) => r.refilm === true).map((r) => pick(r, REEL_KEYS))
  };
  const { kept, dropped } = checkNames(chosen, names);
  const refusals = [
    ...kept.principles.filter((p) => !filled(p.name)).map((p) => `Principle ${p.n}'s name held a name brimm-video took out: give it another name, or drop it.`),
    ...kept.recurringPrinciples.filter((r) => !filled(r.text)).map((r) => `Recurring principle ${r.n}'s text held a name brimm-video took out: say it another way, or drop it.`),
    ...kept.reelIdeas.flatMap((r) => ["idea", "words"].filter((field) => !filled(r[field])).map((field) => `Reel idea ${r.n}'s ${field} held a name brimm-video took out: say it another way, or drop it.`))
  ];
  if (refusals.length) return { why: refusals.join("\n") };
  const principles = kept.principles.map((p) => ({
    n: p.n,
    name: p.name,
    category: textOf(p.category),
    description: textOf(p.description),
    steps: textsOf(p.steps),
    red_flags: textsOf(p.red_flags),
    green_flags: textsOf(p.green_flags),
    decision_criteria: textsOf(p.decision_criteria),
    example_application: textOf(p.example_application),
    verbatim_key_phrases: textsOf(p.verbatim_key_phrases)
  }));
  const shown = new Set(principles.map((p) => p.n));
  return {
    session: {
      principles,
      recurringPrinciples: kept.recurringPrinciples.map((r) => ({ n: r.n, text: r.text })),
      reelsToFilm: kept.reelIdeas.map((r) => ({ n: r.n, idea: r.idea, words: r.words, why: textOf(r.why), principle: shown.has(r.principle) ? r.principle : null }))
    },
    dropped
  };
}
