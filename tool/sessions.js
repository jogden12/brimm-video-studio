// A private session's names, and what she approves of it (spec 2026-10-22, sections 3 and 8). A session is a recording of Sallie with
// a client or a group, so what its people are called must reach neither the principles brimm-video hands to the BRIMM Ops page nor
// her chat where the spec forbids it. Before the call, every speaker of a Zoom transcript but her is "Participant 1", "Participant 2"
// and so on, and the map of who was who stays on the Mac. After the call, Claude's reply is checked field by field against the names
// brimm-video can see: a text that holds one is left out, and so is each entry of a list that holds one, and the check says which,
// never the name. She then keeps, changes or drops each item by her own command, and only what she approved is handed over.
// The check catches the names brimm-video can see, not a client's business: her approval is the real gate.
// Nothing here touches a disk or runs a program.
import { basename } from "node:path";
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
/** A speaker's line of Zoom's saved transcript: a bracket at the start of the line, the label, a bracket, spaces, and a time of the
    form H:MM:SS or HH:MM:SS, with the seconds and no more figures, "[Jane Doe] 10:02:13". Anything may follow the time, as a version
    of Zoom writes "10:02:13 AM", "10:02:13.250" or the words after a tab: a line is taken for one rather than missed. The label is
    the text up to the bracket that the time follows, so that a label with brackets in it, "[Jane Doe [she/her]] 10:02:13", is
    taken whole, and a line of speech that holds a bracket and a time with no seconds, "[laughs] okay [pause] 10:30 works", is not
    one. The same pattern says whether a text is a saved transcript. */
const SAVED = new RegExp(`^(\\[)(.{1,${LABEL_MOST}}?)(\\](?=[ \\t]+\\d{1,2}:\\d{2}:\\d{2}(?!\\d)))`);

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

/** The names of the show, which a label made of nothing else is the show's own account in: a name for the host, the show and the
    brand. */
const SHOW_NAMES = [SHOW, HOST, "The BRIMM"];
/** What sets one name in a label apart from the next: a dash or a bar with a space on both sides; a slash, "&" or "+", with spaces
    round it or none; " and ", " with ", " w/ ", " x " in any case; or a comma. */
const SEPARATOR = / [-\u2013\u2014|] | w\/ | with | and | x |[/&+]|,/i;

/** Whether a label is Sallie's. It is when, with every bracketed part left out ("( ... )" and "[ ... ]", also one inside another)
    and what is left split at its separators, every part either holds every word of `sallie` as a whole word, whatever the case, or
    is made of the words of the show's names and nothing else. So "Sallie's iPhone", "Sallie Ogden - The BRIMM", "Sallie Ogden/The
    BRIMM" and "The BRIMM" are hers, and "Salliebeth Kay", "Jane Doe - Sallie's client", "Sallie & Jane", "Sallie/Jane", "Sallie w/
    Jane" and "Sallie Ogden, Coach" are not: a label that is hers and something more is not known to be hers alone. */
function isHers(label, sallie, show) {
  let outside = label;
  for (let before = ""; before !== outside; ) {
    before = outside;
    outside = outside.replace(/\([^()]*\)|\[[^[\]]*\]/g, " ");
  }
  const mine = wordsAlone(sallie || "");
  const shows = new Set(list(show).flatMap(wordsAlone));
  const parts = outside.split(SEPARATOR).map(wordsAlone).filter((words) => words.length > 0);
  return parts.length > 0 && parts.every((words) => (mine.length ? mine : ["sallie"]).every((w) => words.includes(w)) || words.every((w) => shows.has(w)));
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
    like (isLabel), as the "Label:" that begins a line. A byte order mark (U+FEFF) at the start of the text, which some programs
    write there, is taken off first, and the text is given back without it. Everything else in the text, the names said in it too,
    is as it was, character for character: that is for the name check. Not text gives no text and an empty map. */
export function replaceSpeakers(zoomText, sallie = "Sallie", show = SHOW_NAMES) {
  if (typeof zoomText !== "string") return { text: "", map: {} };
  const map = {};
  const named = (label) => {
    if (isHers(label, sallie, show)) return label;
    // A label may be the name of a method every object has, which is why this asks whether the map has it of its own.
    if (!Object.hasOwn(map, label)) map[label] = `Participant ${Object.keys(map).length + 1}`;
    return map[label];
  };
  /** `line` with the label at `place` replaced. */
  const swap = (line, place) => (place ? line.slice(0, place[0]) + named(line.slice(place[0], place[1])) + line.slice(place[1]) : line);
  // Only one mark is taken off: a second is part of the text.
  const lines = zoomText.replace(/^\uFEFF/, "").split("\n");
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
/** The parts a joined word is made of, where it changes from lowercase to a capital: "JaneDoe" is "Jane" and "Doe". A word that does
    not change has none. */
const partsOf = (w) => {
  const parts = w.split(/(?<=\p{Ll})(?=\p{Lu})/u);
  return parts.length > 1 ? parts : [];
};
/** All the words of a text that a field is checked by: each word, and the parts of a joined word as well. */
const pieces = (text) => baseWords(text).flatMap((w) => [w, ...partsOf(w)]);
/** The words of a text that can be names: those of at least two letters, none of them split into its parts. */
const wordsOf = (text) => baseWords(text).filter((w) => letters(w) >= 2);

/** What ends a sentence as the transcriber writes it: a full stop, a question mark, an exclamation mark or an ellipsis, with any
    closing quote or bracket after it. But a title, "Dr.", and the initial of a name, one capital letter other than I with a full
    stop, "J.", do not end one; "I.", a lowercase letter with a full stop and a longer abbreviation such as "U.S." do. */
const SENTENCE_END = /[.?!…]["'”’»)\]}]*$/;
const TITLE_STOP = /(?:^|[^\p{L}\p{N}.])(?:mr|mrs|ms|mx|dr|prof|st|jr|sr)\.["'”’»)\]}]*$/iu;
const INITIAL_STOP = /(?:^|[^\p{L}\p{N}.])(?!I)\p{Lu}\.["'”’»)\]}]*$/u;
const endsSentence = (token) => SENTENCE_END.test(token) && !TITLE_STOP.test(token) && !INITIAL_STOP.test(token);
/** I and its short forms are written with a capital in the middle of a sentence, and are nobody's name. */
const I_FORM = /^I(?:'(?:m|ve|ll|d))?$/;
/** Words that are nobody's name, from any source and whatever the case: the small words of a sentence, pronouns, titles, the
    words of a mail address, the days of the week, and the months that are nobody's given name (April, May, June and August may
    be). A name is not looked for among them, in a label, in the name of a file or among the words that are capitalised. */
export const NOT_NAMES = [
  ...new Set([
    ..."a an the and or but nor so yet if then than when while what why how who where here there now well yes no not oh ok okay also just of for at to in on by with from into onto about as up out my our your its their this that these those we you us it is are was be me i".split(" "),
    ..."she her hers he him his they them their theirs".split(" "),
    ..."mr mrs ms mx dr prof st jr sr".split(" "),
    ..."com net org co uk gmail icloud outlook hotmail yahoo".split(" "),
    ..."monday tuesday wednesday thursday friday saturday sunday".split(" "),
    ..."january february march july september october november december".split(" ")
  ])
];
/** The names of the platforms, the tools and the people a session speaks of that are no client's: nobody's name, from any source,
    a label too, whatever the case, as the show's names are not one in the file's name or among the capitalised words. They are
    here and not in shared/show.js, which is a copy of brimm-operations' and is kept in step with it by hand. */
export const PUBLIC_NAMES = "instagram facebook linkedin youtube tiktok pinterest threads twitter snapchat whatsapp zoom google gmail chatgpt openai canva shopify etsy amazon apple microsoft excel slack notion calendly hubspot quickbooks paypal venmo stripe squarespace wix mailchimp opusclip hormozi".split(" ");
/** The words of her own name are nobody's name either, in whatever label or file name they stand. */
const NEVER = new Set([...NOT_NAMES, ...wordsAlone(HOST)]);
const PUBLIC = new Set(PUBLIC_NAMES);
/** The words of a label that say what a speaker is on or what they are in the call, as Zoom names a speaker by a device ("Jane's
    iPhone") and a speaker adds a role ("Jane Doe | Business Coach"): in a label, nobody's name. Elsewhere they are words like any. */
const DEVICES = new Set("iphone ipad phone macbook pro air android galaxy pixel laptop desktop pc host cohost co-host guest coach speaker participant admin owner founder ceo team business office".split(" "));
/** The words in the name of a file that Zoom downloads, or of the folder Zoom makes, that are Zoom's own. */
const ZOOM_WORDS = new Set(["gmt", "recording", "gvo", "avo", "audio", "video", "gallery", "speaker", "shared", "screen", "view", "only", "transcript", "chat", "meeting"]);
/** The name of the folder Zoom makes for a recording on the computer: the day and the time, as "2026-10-13 14.29.33", and the
    meeting's name, as "Jane Doe's Zoom Meeting". */
const ZOOM_FOLDER = /^\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2} /;
/** A word written all in capitals, two or more and a lowercase "s" after them or none: "CEO", "DMs", "KPIs". */
const ALL_CAPITALS = /^\p{Lu}{2,}s?$/u;

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
    with a letter, counting only words of two letters or more, as a word is everywhere here, there are at least twenty, and more
    than half of them begin with a capital. Then a capital says nothing. */
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

/** An extension: a full stop and one to five letters or figures at the end of a name. It is one only when a letter is among them,
    so ".mp4" is, and the ".33" of Zoom's "2026-10-13 14.29.33 Jane Doe's Zoom Meeting" is not. */
const EXTENSION = /\.[A-Za-z0-9]{1,5}$/;
/** The name of a file or a folder as its words are looked at: without the folder it is in, and without its extension. */
function stem(name) {
  const base = basename(name);
  const ext = EXTENSION.exec(base);
  return ext && /[A-Za-z]/.test(ext[0]) ? base.slice(0, ext.index) : base;
}

/** Why a word is not a name, each said in a few words and tested on the word and on what is `seen` of the recording and the file:
    `written(w)`, whether the recording writes the word in lowercase in the middle of a sentence; `left`, the words of the show's
    names and of the episode's spellings, in lowercase; `own`, Zoom's own words when the name of the file is one of Zoom's. */
const NOT_A_NAME = {
  "fewer than two letters": (w) => letters(w) < 2,
  "fewer than three letters": (w) => letters(w) < 3,
  "a figure in it": (w) => /\p{N}/u.test(w),
  "nobody's name, or hers": (w) => NEVER.has(w.toLowerCase()),
  "a public name": (w) => PUBLIC.has(w.toLowerCase()),
  "a device or a role": (w) => DEVICES.has(w.toLowerCase()),
  "I or a short form of it": (w) => I_FORM.test(w),
  "all in capitals": (w) => ALL_CAPITALS.test(w),
  "Zoom's own": (w, seen) => seen.own.has(w.toLowerCase()),
  "written in lowercase": (w, seen) => seen.written(w),
  "in lowercase and written so": (w, seen) => lowercase(w) && seen.written(w),
  "the show's or a spelling's": (w, seen) => seen.left.has(spellNames(w).toLowerCase())
};

/** What leaves a word out of the names, side by side for each place a word comes from: a label brimm-video replaced, a name of
    the file, a word the recording writes with a capital in the middle of a sentence, and a part of a joined word from any of them.
    A word is not a name when one of its place's rules says so. */
const LEFT_OUT = {
  label: ["fewer than two letters", "nobody's name, or hers", "a public name", "a device or a role", "in lowercase and written so"],
  file: ["fewer than two letters", "a figure in it", "nobody's name, or hers", "a public name", "Zoom's own", "written in lowercase", "the show's or a spelling's"],
  capitalised: ["fewer than two letters", "nobody's name, or hers", "a public name", "I or a short form of it", "all in capitals", "the show's or a spelling's"],
  part: ["fewer than three letters", "nobody's name, or hers", "a public name", "written in lowercase", "the show's or a spelling's"]
};
const notAName = (from, w, seen) => LEFT_OUT[from].some((rule) => NOT_A_NAME[rule](w, seen));

/** The single words that brimm-video can see are names, each once, in the spelling it saw first, from three places, each with
    what LEFT_OUT says leaves a word out of it:
    - every word of the labels in `map`, the speakers it replaced, the words of a bracketed note too: the tool has ruled the label
      is not Sallie's, so not even a word of the show's names, of a spelling or of Sally is left out. But a word in NOT_NAMES or in
      PUBLIC_NAMES is, a word of the host's name ("Sallie", "Ogden") is, a word of a device or a role ("iPhone", "Host", "Coach")
      is, and a word that begins in lowercase and that `words` writes in lowercase in the middle of a sentence, an ordinary word;
    - every word of each name in `fileName`, a text or a list of texts (the file dropped, Zoom's transcript, the folder Zoom made),
      each read alone, without its folder and its extension (see stem): a word of at least two letters and no figure, but for a
      word in NOT_NAMES or PUBLIC_NAMES or of the host's name, one that `words` writes in lowercase in the middle of a sentence,
      and, in a name that is Zoom's or that of Zoom's folder, Zoom's own words;
    - unless the recording is capitalised throughout, every word that `words` writes with a capital in the middle of a sentence,
      but for a word in NOT_NAMES or PUBLIC_NAMES, of the host's name, or that it writes all in capitals ("CEO", "DMs");
    and of the last two, not, whatever the case, a word of the `show`'s names or of either side of a spelling of the episode's,
    which are no one's, and each is spelled the show's way first, so that "Sally" is "Sallie" and left out. A joined word, from any
    of the three, "JaneDoe", is the whole word as above, and each of its parts, split where it changes from lowercase to a capital,
    that has three letters or more and is left out by none of what leaves a word out: NOT_NAMES, PUBLIC_NAMES, the host's name,
    the show's names, the spellings, and a lowercase word of the recording. "Jane" and "Doe" are names, "You" of "YouTube" is not,
    and nothing of a joined word that is left out as a whole is a name. */
export function visibleNames({ map = {}, fileName = "", words = [], show = SHOW_NAMES, spellings = [] } = {}) {
  const mid = midSentence(words);
  const ordinary = new Set(mid);
  const seen = {
    written: (w) => ordinary.has(w.toLowerCase()),
    left: new Set([...list(show), ...list(spellings).flatMap(sidesOf)].flatMap(wordsOf).map((w) => w.toLowerCase())),
    own: new Set()
  };
  const names = new Map();
  const add = (w) => {
    if (!names.has(w.toLowerCase())) names.set(w.toLowerCase(), w);
  };
  // A word that is a name, as it is to be spelled, and each part of it that is one too, spelled the show's way.
  const addWord = (w, spelt) => {
    add(spelt);
    partsOf(w).map(spellNames).filter((part) => !notAName("part", part, seen)).forEach(add);
  };
  // A label's words are names whatever the show's names and the spellings say, and are kept as they are spelled.
  for (const w of Object.keys(map || {}).flatMap((label) => baseWords(label))) {
    if (!notAName("label", w, seen)) addWord(w, w);
  }
  for (const name of Array.isArray(fileName) ? fileName : [fileName]) {
    const file = String(name ?? "");
    const zoom = { ...seen, own: isZoomName(file) || ZOOM_FOLDER.test(basename(file)) ? ZOOM_WORDS : seen.own };
    for (const w of baseWords(stem(file))) {
      if (!notAName("file", w, zoom)) addWord(w, spellNames(w));
    }
  }
  if (!throughout(mid)) {
    for (const w of mid.filter(capital)) {
      if (!notAName("capitalised", w, seen)) addWord(w, spellNames(w));
    }
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

/** A word as a name and a field's word are compared: in lowercase, and with its accents taken off (the word written apart, NFD,
    and its marks left out), so that "José" is "jose". */
const folded = (w) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Whether a text holds one of `names`, by the rule the name check takes a field out by. Each of `names` is split into words as
    visibleNames splits them, and the text into its words and the parts of a joined word (see pieces). The text holds a name when
    one of its words is one of them, whatever the case and the accents, and is either written with a capital letter or a letter
    that has no case, or was seen beginning in lowercase: the client "Mark" is in "Mark said" and not in "mark the date", "José" is
    in "Jose said so", and "d'Angelo" is in "As d'Angelo put it". A list holds one when one of its entries does, and anything else
    that is not text holds none. */
export function holdsName(text, names) {
  if (Array.isArray(text)) return text.some((entry) => holdsName(entry, names));
  if (typeof text !== "string") return false;
  // For each name, folded: whether one of its spellings begins in lowercase, which takes a word of any case.
  const known = new Map();
  for (const w of list(names).flatMap(wordsOf)) known.set(folded(w), known.get(folded(w)) || lowercase(w));
  return pieces(text).some((w) => known.has(folded(w)) && (known.get(folded(w)) || !lowercase(w)));
}

/** A copy of plain data that shares nothing with it: every list and object in it is new. */
const copyOf = (v) => (Array.isArray(v) ? v.map(copyOf) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copyOf(x)])) : v);

/** A reading with every text that holds a name left out, and every entry of a list that holds one: { kept, dropped }. The reading
    is not changed, and `kept` shares nothing with it. Every text field and every list of texts of every item of its lists (the
    principles, the recurring principles, the Reel ideas, and the Reel ideas to film) is looked at, whichever of the lists the
    reading has; whether a text holds a name is for holdsName to say. A text that holds one is not in its item in `kept`. A list
    keeps, in their order, the entries that hold none, and is an empty list when none is left. `dropped` has one { field, why } for
    each text and each entry left out, with `field` as she reads of it ("Principle 2's example_application", and "Principle 2's
    steps, entry 3" for the third entry of the list as it was given) and `why` in plain words. Neither holds the name or any word
    of the field: a field is named by its key and an entry by its place, and the keys are the readers' own. */
export function checkNames(reading, names) {
  const kept = copyOf({ ...reading });
  const dropped = [];
  for (const [key, label] of LISTS) {
    if (!Array.isArray(reading?.[key])) continue;
    kept[key] = reading[key].map((item) => {
      if (!item || typeof item !== "object") return copyOf(item);
      const left = {};
      for (const [field, value] of Object.entries(item)) {
        const named = `${label} ${item.n}'s ${field}`;
        if (NO_WORDS.has(field)) left[field] = copyOf(value);
        else if (Array.isArray(value)) {
          left[field] = [];
          value.forEach((entry, i) => (holdsName(entry, names) ? dropped.push({ field: `${named}, entry ${i + 1}`, why: NAME_SEEN }) : left[field].push(copyOf(entry))));
        } else if (holdsName(value, names)) dropped.push({ field: named, why: NAME_SEEN });
        else left[field] = copyOf(value);
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
    name; `dropped` is what that check took out of what is in the file, as checkNames gives it, a text or an entry of a list. A
    principle has the keys the page takes and never its `source_context` or its `approved`; a text the check took out is written
    as an empty text, as the page reads a missing one, and a list keeps the entries it left, or is empty when it left none. A
    Reel idea to film (kept, with `refilm` true) has its `principle` only when that principle is in the hand-off, and null
    otherwise. A kept idea that is not to be filmed is not in it: a Reel cut from the session is made, with the client's
    agreement, by a later phase. The lists are copies.
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
