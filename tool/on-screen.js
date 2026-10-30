// The words on a HyperFrames project's picture (architecture 2026-10-27, section 8.5; plan PR 8): which text elements of `index.html`
// and of the compositions its hosts name are words on the screen, and when they appear. BRIMM Ops writes its hooks and posts from "the
// words in the picture" (`main.onPicture`, and a Reel's title); the app draws them now, so `finish` reads them out of the project and
// shows them for her to confirm. What is read is only ever a proposal: it is agent-written HTML, and nothing is handed off that she did
// not see.
//
// A text on the screen is an element with a numeric `data-start` and a duration above 0, that is not the captions, holding words. A
// composition a host names (`data-composition-src`) is read as the file it names, on the host's clock, with the host's own
// `data-variable-values` for the words of its `data-var-text` elements (A0 and A0b wrote both). `wordsOnScreen` is pure over a `read`;
// `projectReader` is the one function here that reads the disk (`projectWords` reads through it), and it only reads: a regular file of the
// project, of at most 2 MB, that is `index.html` or a `.html` file under `compositions/`, and never through a link. `projectReader` and
// `htmlTree` are also what on-timeline.js reads the recording's place on the timeline with.
//
// Below the reader are the words `finish` says and asks of what it found (`mainWordsSaid` for the main video's picture, `reelTitleAsk` for
// a Reel's title): plain sentences, with no path, no flag and no command name, since they go into Sallie's chat.
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { clockText } from "./clock.js";

/** The most a file may hold for it to be read: a composition is a few kilobytes, and an agent can write anything in the project. */
const BYTES_MOST = 2 * 1024 * 1024;
/** How much of a file is read at a time. */
const READ_PIECE = 64 * 1024;
/** The flags by which a project's file is opened: it follows no link, and does not wait on a file that is not one (a pipe). */
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;
/** What the reading of a project may use, all together (review I3): hosts that name hosts multiply the work, so the whole project has
    one budget, and a project that uses it up is not read in full. The most lines (a project of more is not given cut short), the most
    elements parsed or walked, and the most files asked of `read`. And the most a line may have (a longer one is a paragraph, not a
    title), the deepest element nesting kept (deeper elements are flattened into the one above), and how many compositions may nest. */
const LINES_MOST = 500;
const ELEMENTS_MOST = 200000;
const READS_MOST = 300;
const LINE_MOST = 300;
const DEPTH_MOST = 100;
const NESTING_MOST = 3;
/** Thrown inside `wordsOnScreen` when the budget is used up, and caught there. */
const SPENT = Symbol("spent");

// --- A forgiving reader of HTML: tags, attributes, text. It never throws, and what it cannot read it passes over. ---

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
/** The names of the entities for U+00A0 to U+00FF, in order (HTML's Latin-1 set), and the common typographic ones (review M5). A name not
    among them is left as it was written. */
const LATIN1 = "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(" ");
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  ...Object.fromEntries(LATIN1.map((name, i) => [name, String.fromCharCode(0xa0 + i)])),
  ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  dagger: "†", bull: "•", hellip: "…", permil: "‰", prime: "′", Prime: "″", lsaquo: "‹", rsaquo: "›", euro: "€", trade: "™",
  larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔", minus: "−"
};

/** A text with its entities read. One that is not a character (a number out of range, a half of a pair) is left as written. */
const decode = (text) => text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, name) => {
  if (name[0] !== "#") return Object.hasOwn(NAMED, name) ? NAMED[name] : whole;
  const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
});

/** A line as it is told (review M1): its whitespace collapsed to single spaces and its control characters taken out. An entity can write a
    control character (`&#7;`, `&#27;`), and so can an argument, and one in a line would move a cursor or colour a screen where the line is told. */
const cleanLine = (value) => String(value ?? "").replace(/\s+/g, " ").replace(/\p{Cc}/gu, "").trim();
/** Whether a line holds a letter or a figure: one that does not is no words. */
const hasWords = (line) => /[\p{L}\p{N}]/u.test(line);

const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
const TAG_NAME = /<([A-Za-z][^\s/>]*)/y;

/** The attributes of the tag whose name has just been read, from `from`: { attrs, end, selfClosed }. A tag never closed ends where the
    next one starts. Names are in lower case; the first of a name wins; a value has its entities read. */
function attributesFrom(source, from) {
  const attrs = Object.create(null);
  let i = from;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i += 1;
    const c = source[i];
    if (c === undefined) break;
    if (c === ">") return { attrs, end: i + 1, selfClosed: false };
    if (c === "/") {
      if (source[i + 1] === ">") return { attrs, end: i + 2, selfClosed: true };
      i += 1;
      continue;
    }
    if (c === "<") return { attrs, end: i, selfClosed: false };
    ATTRIBUTE.lastIndex = i;
    const found = ATTRIBUTE.exec(source);
    if (!found) {
      i += 1;
      continue;
    }
    const name = found[1].toLowerCase();
    if (!Object.hasOwn(attrs, name)) attrs[name] = decode(found[2] ?? found[3] ?? found[4] ?? "");
    i = ATTRIBUTE.lastIndex;
  }
  return { attrs, end: source.length, selfClosed: false };
}

/** A page as a tree: { tag, attrs, kids } for an element, { text } for a text. The content of `script` and `style` is not kept, nor are
    comments; a stray closing tag is passed over, and a closing tag ends everything open inside the element it closes. `spend` is called
    for each element parsed, and throws when the project's budget is used up. */
function parse(source, spend) {
  const root = { tag: "#root", attrs: Object.create(null), kids: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const close = (name) => {
    for (let k = stack.length - 1; k > 0; k -= 1) {
      if (stack[k].tag === name) {
        stack.length = k;
        return;
      }
    }
  };
  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      top().kids.push({ text: source.slice(i) });
      break;
    }
    if (lt > i) top().kids.push({ text: source.slice(i, lt) });
    const next = source[lt + 1];
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      i = end === -1 ? source.length : end + 3;
    } else if (next === "!" || next === "?") {
      const end = source.indexOf(">", lt + 2);
      i = end === -1 ? source.length : end + 1;
    } else if (next === "/") {
      const end = source.indexOf(">", lt + 2);
      close(source.slice(lt + 2, end === -1 ? source.length : end).trim().split(/[\s/]/)[0].toLowerCase());
      i = end === -1 ? source.length : end + 1;
    } else {
      TAG_NAME.lastIndex = lt;
      const named = TAG_NAME.exec(source);
      if (!named) {
        top().kids.push({ text: "<" });
        i = lt + 1;
        continue;
      }
      const tag = named[1].toLowerCase();
      const { attrs, end, selfClosed } = attributesFrom(source, lt + named[0].length);
      i = end;
      spend();
      const element = { tag, attrs, kids: [] };
      top().kids.push(element);
      if ((tag === "script" || tag === "style") && !selfClosed) {
        const closing = new RegExp(`</${tag}\\b`, "gi");
        closing.lastIndex = i;
        const found = closing.exec(source);
        const gt = found ? source.indexOf(">", found.index) : -1;
        i = gt === -1 ? source.length : gt + 1;
      } else if (!selfClosed && !VOID.has(tag) && stack.length <= DEPTH_MOST) stack.push(element);
    }
  }
  return root;
}

/** A page as a tree (parse's), for a reader that is not wordsOnScreen, such as on-timeline.js looking for the recording: null for a
    page with more than ELEMENTS_MOST elements, which is not read in full. It has the budget of one page, not of a whole project. */
export function htmlTree(source) {
  let elements = 0;
  try {
    return parse(String(source), () => {
      elements += 1;
      if (elements > ELEMENTS_MOST) throw SPENT;
    });
  } catch (e) {
    return null;
  }
}

// --- What on a page is words ---

/** Elements whose content is never words on the picture: the page's head, code, media and form controls. */
const NOT_WORDS = new Set(["head", "title", "desc", "script", "style", "noscript", "video", "audio", "img", "picture", "canvas", "iframe", "object", "embed", "source", "track", "input", "textarea", "select", "option", "map", "datalist"]);
/** Elements that end a line before and after them. Any other element, a span or a bold word, goes on in the line it is in. */
const BLOCK = new Set(["address", "article", "aside", "blockquote", "body", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "svg", "text", "template", "center", "menu", "dir"]);
const HIDDEN_STYLE = /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?)\s*(?:!\s*important\s*)?(?:;|$)/i;
/** `cap`, as the app names a caption (`cap`, `cap-01`, `cap-box`): at the start of a name, alone or joined by a dash or an underscore. A
    `drop-cap` or a `recap` is not one. */
const CAP_NAME = /^caps?(?:$|[-_])/i;
/** A name that is the captions': "captions", "caption", "subtitles", and those with a word joined by a dash, an underscore or a space. */
const CAPTIONS_NAME = /(?:^|[-_ ])(?:captions?|subtitles?)(?:$|[-_ ])/i;
const NUMBER = /^\d+(?:\.\d+)?$/;

const hidden = (attrs) => attrs.hidden !== undefined || HIDDEN_STYLE.test(attrs.style ?? "");
/** Whether a class or an id is the captions' (review M4): the app numbers its captions (`cap-01`), and a box can be named for what it holds. */
const captionName = (name) => CAPTIONS_NAME.test(name) || CAP_NAME.test(name);
/** An element that is, or is in, the captions: by its track, its class or its id. */
const captioned = (attrs) => (attrs["data-track-kind"] ?? "").trim().toLowerCase() === "captions" || (attrs.class ?? "").split(/\s+/).some(captionName) || captionName(attrs.id ?? "");
const stemOf = (rel) => posix.basename(String(rel), ".html");
/** When an element is on the screen, { start, duration } in seconds, or null: the start is a number of 0 or more, and the duration a number above 0. */
function timingOf(attrs) {
  const start = (attrs["data-start"] ?? "").trim();
  const duration = (attrs["data-duration"] ?? "").trim();
  if (!NUMBER.test(start) || !NUMBER.test(duration) || !(Number(duration) > 0)) return null;
  return { start: Number(start), duration: Number(duration) };
}

/** The path a host names, as a path from the project, or "" when it is not one that is read: `compositions/<...>.html`, with no `..`, no
    backslash and no absolute path, as `posix.normalize` leaves it. */
function compositionPath(source) {
  if (typeof source !== "string") return "";
  const text = source.trim();
  if (/[\0\\]/.test(text)) return "";
  // `normalize` settles every `.` and `..` it can, so a path that is under compositions/ afterwards has none left.
  const rel = posix.normalize(text);
  return rel.startsWith("compositions/") && rel.endsWith(".html") && rel.length > "compositions/.html".length ? rel : "";
}

/** The variables a host sets: the strings of its `data-variable-values` (JSON), by name. Anything else is none. */
function variablesOf(attrs) {
  try {
    const told = JSON.parse(attrs["data-variable-values"] ?? "{}");
    return told !== null && typeof told === "object" && !Array.isArray(told) ? told : {};
  } catch (e) {
    return {};
  }
}

/** The words on the picture of the project `read` gives, as [{ text, at }] in the order they appear: `at` is the second of the project's
    timeline, to the thousandth. `read(path)` gives a file's text, or { text, id } when it can say what the file is (a real file's device
    and inode: two names of one file give one id), from the project's folder, or null when there is none; it is asked for `index.html` and
    for the compositions its hosts name, once for each name, and a file is parsed once for each id. A line is the text of a block, or between
    two line breaks; the lines of one element that is on the screen are in the document's order, and two that start together are in the order
    they are written in. Captions, pictures and hidden boxes are never words. A file that holds itself, under any name, is read once on its
    way. The project has one budget (review I3): more than 200,000 elements parsed or walked, more than 300 files asked for, or more than
    500 lines is a project that was not read in full, and the answer is null, never a list cut short. Nothing here reads a disk, and nothing
    here throws. */
export function wordsOnScreen(read) {
  const units = [];
  let lines = 0;
  let elements = 0;
  let reads = 0;
  /** One element parsed or walked. */
  const spend = () => {
    elements += 1;
    if (elements > ELEMENTS_MOST) throw SPENT;
  };
  const named = new Map();
  const trees = new Map();
  /** A file by the name asked for: { text, id }, or null when there is none; `read` is asked for a name once. */
  const get = (rel) => {
    if (named.has(rel)) return named.get(rel);
    reads += 1;
    if (reads > READS_MOST) throw SPENT;
    let file = null;
    try {
      const got = read(rel);
      if (typeof got === "string") file = { text: got, id: `name:${rel}` };
      else if (got !== null && typeof got === "object" && typeof got.text === "string" && typeof got.id === "string") file = { text: got.text, id: got.id };
    } catch (e) {
      file = null;
    }
    named.set(rel, file);
    return file;
  };
  const treeOf = (file) => {
    if (!trees.has(file.id)) trees.set(file.id, parse(file.text, spend));
    return trees.get(file.id);
  };
  const unit = (at) => {
    const made = { at, lines: [] };
    units.push(made);
    return made;
  };
  /** The line a document has gathered so far, put in the element it belongs to, when it holds words. */
  const flush = (doc) => {
    if (!doc.buffer.length) return;
    const line = cleanLine(decode(doc.buffer.join("")));
    doc.buffer = [];
    if (doc.unit && line.length <= LINE_MOST && hasWords(line)) {
      lines += 1;
      if (lines > LINES_MOST) throw SPENT;
      doc.unit.lines.push(line);
    }
  };
  /** A file read on a clock, with the ids of the files it is inside: a file that is one of them is already being read. `end` is the
      second of the project's timeline at which the file stops being on the screen (the host's end, or the video's), and nothing that
      starts at or after it is (review M6). */
  const walkFile = (rel, { offset, host, vars, ids, end }) => {
    const file = get(rel);
    if (file === null || ids.includes(file.id)) return;
    const doc = { offset, vars, end, host, sized: false, unit: host ? unit(offset) : null, buffer: [], ids: [...ids, file.id] };
    walk(treeOf(file), doc);
    flush(doc);
  };
  /** A host: the composition it names, on its clock, when it is on the screen at a time and is a file to be read. One that starts
      at or after the end of what it is in is not on the screen, and is not read. */
  const walkHost = (attrs, doc) => {
    const timing = timingOf(attrs);
    const rel = compositionPath(attrs["data-composition-src"]);
    if (!timing || !rel || doc.ids.length > NESTING_MOST) return;
    if (CAPTIONS_NAME.test(attrs["data-composition-id"] ?? "") || CAPTIONS_NAME.test(stemOf(rel))) return;
    const start = doc.offset + timing.start;
    if (start >= doc.end) return;
    walkFile(rel, { offset: start, host: true, vars: variablesOf(attrs), ids: doc.ids, end: Math.min(doc.end, start + timing.duration) });
  };
  const walk = (node, doc) => {
    if (node.text !== undefined) {
      if (doc.unit) doc.buffer.push(node.text);
      return;
    }
    spend();
    const { tag, attrs } = node;
    if (tag !== "#root" && (NOT_WORDS.has(tag) || hidden(attrs) || captioned(attrs))) return;
    if (attrs["data-composition-src"] !== undefined) {
      flush(doc);
      walkHost(attrs, doc);
      return;
    }
    const root = attrs["data-composition-id"] !== undefined;
    if (root && CAPTIONS_NAME.test(attrs["data-composition-id"])) return;
    // The first root of the main page is the video: its duration is the length of the video, and nothing starts after that.
    if (root && !doc.host && !doc.sized) {
      doc.sized = true;
      const length = (attrs["data-duration"] ?? "").trim();
      if (NUMBER.test(length) && Number(length) > 0) doc.end = Math.min(doc.end, Number(length));
    }
    if (tag === "br") {
      flush(doc);
      return;
    }
    const block = BLOCK.has(tag);
    const timing = root ? null : timingOf(attrs);
    if (block || timing) flush(doc);
    const outer = doc.unit;
    // A unit that starts at or after the end is not on the screen, and its own words are none; a unit inside it has a start of its own.
    if (timing) doc.unit = doc.offset + timing.start < doc.end ? unit(doc.offset + timing.start) : null;
    const bound = attrs["data-var-text"];
    if (bound !== undefined && Object.hasOwn(doc.vars, bound) && typeof doc.vars[bound] === "string") {
      if (doc.unit) doc.buffer.push(doc.vars[bound]);
    } else {
      for (const kid of node.kids) walk(kid, doc);
    }
    if (block || timing) flush(doc);
    doc.unit = outer;
  };
  try {
    walkFile("index.html", { offset: 0, host: false, vars: {}, ids: [], end: Infinity });
  } catch (e) {
    // The budget is used up, or something went wrong that this was not written for: the project was not read in full.
    return null;
  }
  // Two that start together stay in the document's order: sort is stable.
  return units
    .sort((a, b) => a.at - b.at)
    .flatMap((made) => made.lines.map((text) => ({ text, at: Math.round(made.at * 1000) / 1000 })));
}

/** The reader of the files of the project in the folder `dir`: a `read(rel)` for wordsOnScreen, or null when there is no such folder.
    `read(rel)` gives { text, id } for the file `rel` (a path from the project), or null for anything that is not to be read. Only a
    regular file of at most 2 MB whose real path is its name as written, under the project's real path, is read (a link, or a file
    reached through one, wherever it leads, is not). The project's other
    writer, the app's agent, can swap a file between the look and the read, so a file is looked at, opened without following a link and
    without waiting for a writer (as `historyTail` opens the history), and read through the descriptor: it must be the file looked at (the
    same device and inode), a regular file within 2 MB, and no more than 2 MB and a byte is read from it, whatever it grows to. A file is
    what its device and inode say, so that two names of one file are one file, and its bytes are read once. It writes nothing.
    `io` gives the file functions in place of node's, for a test to swap a file from inside the look: lstat, open, fstat, read, close
    and realpath. projectWords reads the words of a project with it, and on-timeline.js reads index.html. */
export function projectReader(dir, io = {}) {
  const { lstat = lstatSync, open = openSync, fstat = fstatSync, read: readAt = readSync, close = closeSync, realpath = realpathSync } = io;
  let base;
  try {
    if (typeof dir !== "string" || dir === "" || !statSync(dir).isDirectory()) return null;
    base = realpathSync(dir);
  } catch (e) {
    return null;
  }
  const texts = new Map();
  /** The whole of an open file as text, or null when it holds more than 2 MB: read in pieces, none past the 2 MB and a byte. */
  const textOf = (fd) => {
    const pieces = [];
    let total = 0;
    while (total <= BYTES_MOST) {
      const piece = Buffer.alloc(Math.min(READ_PIECE, BYTES_MOST + 1 - total));
      const got = readAt(fd, piece, 0, piece.length, total);
      if (got === 0) return Buffer.concat(pieces).toString("utf8");
      pieces.push(piece.subarray(0, got));
      total += got;
    }
    return null;
  };
  const read = (rel) => {
    let fd;
    try {
      const file = join(base, rel);
      const looked = lstat(file);
      if (!looked.isFile() || looked.size > BYTES_MOST) return null;
      fd = open(file, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
      const opened = fstat(fd);
      if (!opened.isFile() || opened.size > BYTES_MOST || opened.ino !== looked.ino || opened.dev !== looked.dev) return null;
      const id = `${opened.dev}:${opened.ino}`;
      if (!texts.has(id)) texts.set(id, textOf(fd));
      const text = texts.get(id);
      if (text === null) return null;
      // The file is where its name says, through no link on the way (the project's folder is `base`, already settled): a folder that is a
      // link, to a folder outside the project or to another inside it, makes the real path another than the name's (review M9).
      return realpath(file) === file ? { text, id } : null;
    } catch (e) {
      return null;
    } finally {
      if (fd !== undefined) close(fd);
    }
  };
  return read;
}

/** The words on the picture of the project in the folder `dir`: { here, words }. `here` is false when there is no such folder.
    `incomplete: true` is there only for a project that was not read in full (its budget was used up, see wordsOnScreen), and its
    words are none. Only `index.html` and the compositions under `compositions/` that a host names are opened, each as projectReader
    opens a file of the project. It writes nothing. `io` is projectReader's. */
export function projectWords(dir, io = {}) {
  const read = projectReader(dir, io);
  if (read === null) return { here: false, words: [] };
  const words = wordsOnScreen(read);
  return words === null ? { here: true, words: [], incomplete: true } : { here: true, words };
}

/** The words on the picture of the project called `name` in the work folder `work`: projectWords of its folder. A name that does not
    lead to a folder of the work folder (it is a path, or empty) is a project that is not here. */
export function projectWordsIn(work, name, io) {
  return typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[/\0]/.test(name) ? projectWords(join(work, name), io) : { here: false, words: [] };
}

// --- What finish says and asks of them (plan PR 8; architecture 8.5). Every sentence is plain: no path, no flag, no command name. ---

const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);
const timed = (word) => `"${word.text}" at ${clockText(word.at)}`;
/** What a Reel's title may be, in words, as `title` takes it: a longer first line is not proposed. */
const TITLE_WORDS_MOST = 12;

export const BOTH_SAID = "Say what is on screen, or that nothing is, but not both.";
export const EMPTY_LINE = "A line on the screen needs words. Say what it says.";
export const TOO_LONG = `A line on the screen can have at most ${LINE_MOST} characters. Say it shorter.`;
export const TOO_MANY = `At most ${LINES_MOST} lines can be on the screen. Say fewer.`;
const NONE_FOUND = "I found no words on the main video's picture. Say what is on screen, or say that nothing is.";
const NOT_HERE = "I could not look at the main video's project on this Mac, so I do not know what is on its picture. Say what is on screen, or say that nothing is.";
const NOT_ALL_READ = "I could not read all the words on the main video's picture. Say what is on screen, or say that nothing is.";
const NOTHING_SAID = "Nothing is on the main video's picture, as you said.";

/** What `finish` says and asks of the words on the main video's picture, as { words, line, ask } or { refusal }:
    - `found` are the words read out of the project (wordsOnScreen) and `here` whether the project is on this Mac; `given` the lines she
      gave (a list, empty when she gave none), `none` whether she said there are none, `yes` whether she has said yes, and `taking`
      whether the main video is taken from an export in this finish (a main video kept as the last finish made it is not asked).
    - What she says is what goes on: her lines, in her order, or an empty list. Both at once, or a line with no words, is refused.
    - Otherwise, for a main video that is taken, the words found are said with their times and "Right?". Her yes is to the words she was
      shown: `shown` is whether the words found are the lines a call before this one showed (`finish` keeps them), and only then does a
      yes take them, and say them again as taken. A yes with words she was not shown shows them, and `shows` are the lines for `finish`
      to keep, so that her next yes is to them. Nothing found, a project that is not here, and a project that could not be read in full
      (`incomplete`: a list cut short is never shown) are asks: nothing starts until she has said.
    `words` are the lines that go on, or null when none is decided; `line` is what is said, and `ask` what is asked, or ""; `shows` is
    there only when the line asks "Right?", and holds the lines it shows. */
export function mainWordsSaid({ found = [], here = true, incomplete = false, given = [], none = false, yes = false, taking = true, shown = false } = {}) {
  const lines = (Array.isArray(given) ? given : []).map(cleanLine);
  if (none && lines.length) return { refusal: BOTH_SAID };
  if (lines.length > LINES_MOST) return { refusal: TOO_MANY };
  if (lines.some((line) => !hasWords(line))) return { refusal: EMPTY_LINE };
  if (lines.some((line) => line.length > LINE_MOST)) return { refusal: TOO_LONG };
  if (none) return { words: [], line: NOTHING_SAID, ask: "" };
  if (lines.length) return { words: lines, line: `On screen in the main video, as you said: ${listed(lines.map((line) => `"${line}"`))}.`, ask: "" };
  if (!taking) return { words: null, line: "", ask: "" };
  if (!here) return { words: null, line: "", ask: NOT_HERE };
  if (incomplete) return { words: null, line: "", ask: NOT_ALL_READ };
  if (!found.length) return { words: null, line: "", ask: NONE_FOUND };
  const told = listed(found.map(timed));
  const texts = found.map((word) => word.text);
  if (yes && shown) return { words: texts, line: `On screen in the main video: ${told}.`, ask: "" };
  return { words: null, line: `On screen in the main video I found ${told}. Right?`, ask: "", shows: texts };
}

/** What `finish` asks of a Reel that has no title on screen: today's ask, which names the suggestion's opening when it has one, and,
    when the Reel's picture holds words, the first of them as a proposal (at most 12 words, the most a title may have). She confirms it
    as she gives any title. `found` are the words read out of the Reel's project. */
export function reelTitleAsk({ n, found = [], opening = "" }) {
  const tail = opening ? `: it starts "${opening}"` : "";
  const [first] = found;
  if (first && first.text.split(" ").length <= TITLE_WORDS_MOST) return `Reel ${n} has no title on screen. On screen in it I found "${first.text}" at ${clockText(first.at)}. Is that its title? If not, say what it says${tail}.`;
  return `Reel ${n} has no title on screen. Say what it says${tail}.`;
}
