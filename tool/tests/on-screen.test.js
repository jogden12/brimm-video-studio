// The words on a HyperFrames project's picture (plan PR 8, groups A1 to A6; architecture 2026-10-27, section 8.5): which text elements of
// `index.html` and of the compositions its hosts name are words on the screen, when they appear, and what is never words (the captions,
// a picture, a hidden box). The files are made up in the shape of the ones the app wrote for A0 and A0b (fixtures/hyperframes-0.8.208/
// on-screen/); `wordsOnScreen` is pure over a `read` the test gives, and `projectWords` reads a project folder made in the test's own
// temporary folder. Nothing here touches the real BRIMM Video Work, Dropbox or Downloads, or the files A0 left.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectWords, projectWordsIn, wordsOnScreen } from "../on-screen.js";

const FIXTURES = new URL("./fixtures/hyperframes-0.8.208/on-screen/", import.meta.url);
const fixture = (rel) => readFileSync(new URL(rel, FIXTURES), "utf8");
const COMPOSITIONS = ["lower-third", "title-card", "title", "captions", "end-card"];
/** The made-up main project: its index and the five compositions, as a `read` takes them. */
const MAIN = { "index.html": fixture("index.html"), ...Object.fromEntries(COMPOSITIONS.map((name) => [`compositions/${name}.html`, fixture(`compositions/${name}.html`)])) };
const REEL = { ...MAIN, "index.html": fixture("reel-index.html") };
const readFrom = (files) => (rel) => (Object.hasOwn(files, rel) ? files[rel] : null);
/** A project whose index holds `inner` in its main composition, and the composition files `files`. */
const projectOf = (inner, files = {}) => ({ "index.html": `<div id="root" data-composition-id="main" data-start="0" data-duration="60">${inner}</div>`, ...files });
const wordsOf = (files) => wordsOnScreen(readFrom(files));
const texts = (words) => words.map((w) => w.text);
/** A composition file in the shape of A0b's: a template with a root and the markup `inner` inside it. */
const composition = (id, inner) => `<template><div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">${inner}</div></template>`;
const hostOf = (id, src, start, duration, extra = "") => `<div id="${id}" data-composition-id="${id}" data-composition-src="${src}" data-start="${start}" data-duration="${duration}" ${extra}></div>`;
const host = (id, start, duration, extra = "") => hostOf(id, `compositions/${id}.html`, start, duration, extra);

describe("A1. the shapes of A0 and A0b", () => {
  it("finds a lower third that is a composition, a title card whose host sets its words, and a text in index.html itself, in the order they appear", () => {
    assert.deepEqual(wordsOf(MAIN), [
      { text: "Alex Rivera", at: 3 },
      { text: "Head of Pricing", at: 3 },
      { text: "Three pricing", at: 20 },
      { text: "mistakes", at: 20 },
      { text: "Know your costs", at: 40 }
    ]);
  });
  it("takes the host's variables for the words of an element marked data-var-text, and the file's own words when the host sets none", () => {
    const without = { ...MAIN, "index.html": MAIN["index.html"].replace(/data-variable-values='[^']*'/, "") };
    assert.deepEqual(wordsOf(without).filter((w) => w.at === 20), [{ text: "Your title", at: 20 }, { text: "goes here", at: 20 }]);
    const partly = { ...MAIN, "index.html": MAIN["index.html"].replace(`'{"line1":"Three pricing","line2":"mistakes"}'`, `'{"line2":"mistakes"}'`) };
    assert.deepEqual(wordsOf(partly).filter((w) => w.at === 20), [{ text: "Your title", at: 20 }, { text: "mistakes", at: 20 }]);
    const odd = { ...MAIN, "index.html": MAIN["index.html"].replace(`'{"line1":"Three pricing","line2":"mistakes"}'`, `'not json'`) };
    assert.deepEqual(texts(wordsOf(odd).filter((w) => w.at === 20)), ["Your title", "goes here"]);
    const numbers = { ...MAIN, "index.html": MAIN["index.html"].replace(`'{"line1":"Three pricing","line2":"mistakes"}'`, `'{"line1":3,"line2":null}'`) };
    assert.deepEqual(texts(wordsOf(numbers).filter((w) => w.at === 20)), ["Your title", "goes here"], "only a text replaces a word");
  });
  it("gives a title composition whose words sit in no timed element of its own the host's start", () => {
    assert.deepEqual(wordsOf(REEL), [{ text: "Mistake one", at: 0 }]);
    const later = { ...REEL, "index.html": REEL["index.html"].replace('id="title" data-composition-id="title" data-composition-src="compositions/title.html" class="clip" data-start="0"', 'id="title" data-composition-id="title" data-composition-src="compositions/title.html" class="clip" data-start="12.5"') };
    assert.deepEqual(wordsOf(later), [{ text: "Mistake one", at: 12.5 }]);
  });
  it("gives a text in index.html itself, with data-start and a duration, at its start", () => {
    const files = projectOf('<div class="clip" data-start="40" data-duration="4" data-track-index="1">Know your costs</div>');
    assert.deepEqual(wordsOf(files), [{ text: "Know your costs", at: 40 }]);
  });
  it("adds a card's start inside a composition to the host's start", () => {
    const files = projectOf(host("card", 20, 5), { "compositions/card.html": composition("card", '<div class="clip" data-start="1.5" data-duration="2">Inside</div><div class="clip" data-start="0" data-duration="1">First</div>') });
    assert.deepEqual(wordsOf(files), [{ text: "First", at: 20 }, { text: "Inside", at: 21.5 }]);
  });
  it("adds the starts of hosts inside hosts, and keeps the sum to the thousandth", () => {
    const files = projectOf(host("outer", 33.6, 10), {
      "compositions/outer.html": composition("outer", host("inner", 0.5, 4)),
      "compositions/inner.html": composition("inner", '<div class="clip" data-start="0.1" data-duration="2">Deep</div>')
    });
    assert.deepEqual(wordsOf(files), [{ text: "Deep", at: 34.2 }]);
  });
  it("takes the words of a block as a line each, the spans of one line as one, and a br as the end of a line", () => {
    const files = projectOf('<div class="clip" data-start="2" data-duration="3">Before<h1>A <span>big</span> <b>idea</b></h1><p>Line one<br/>Line two</p><ul><li>Item</li><li>Another</li></ul>Trailing</div>');
    assert.deepEqual(texts(wordsOf(files)), ["Before", "A big idea", "Line one", "Line two", "Item", "Another", "Trailing"]);
  });
  it("collapses whitespace and reads the entities", () => {
    const files = projectOf('<div class="clip" data-start="1" data-duration="3">  Fish &amp;\n   chips &#8212; it&#39;s &quot;fresh&quot;&nbsp;&#x2713; </div>');
    assert.deepEqual(texts(wordsOf(files)), ["Fish & chips — it's \"fresh\" ✓"]);
  });
  it("reads the named entities of Latin-1 and the common typographic ones, and leaves one it does not know as it was written (review M5)", () => {
    const pairs = [["iexcl", "¡"], ["cent", "¢"], ["pound", "£"], ["yen", "¥"], ["sect", "§"], ["copy", "©"], ["laquo", "«"], ["reg", "®"], ["deg", "°"], ["plusmn", "±"], ["sup2", "²"], ["micro", "µ"], ["para", "¶"], ["raquo", "»"], ["frac14", "¼"], ["frac12", "½"], ["frac34", "¾"], ["iquest", "¿"],
      ["Agrave", "À"], ["Aring", "Å"], ["AElig", "Æ"], ["Ccedil", "Ç"], ["Eacute", "É"], ["ETH", "Ð"], ["Ntilde", "Ñ"], ["times", "×"], ["Oslash", "Ø"], ["THORN", "Þ"], ["szlig", "ß"], ["agrave", "à"], ["aelig", "æ"], ["ccedil", "ç"], ["eacute", "é"], ["eth", "ð"], ["ntilde", "ñ"], ["divide", "÷"], ["oslash", "ø"], ["uuml", "ü"], ["thorn", "þ"], ["yuml", "ÿ"],
      ["sbquo", "‚"], ["bdquo", "„"], ["dagger", "†"], ["permil", "‰"], ["prime", "′"], ["lsaquo", "‹"], ["rsaquo", "›"], ["euro", "€"], ["trade", "™"], ["larr", "←"], ["uarr", "↑"], ["rarr", "→"], ["darr", "↓"], ["harr", "↔"], ["minus", "−"], ["mdash", "—"], ["ndash", "–"], ["hellip", "…"], ["lsquo", "‘"], ["rsquo", "’"], ["ldquo", "“"], ["rdquo", "”"]];
    for (const [name, character] of pairs) {
      const found = wordsOf(projectOf(`<div class="clip" data-start="1" data-duration="3">a&${name};b</div>`));
      assert.deepEqual(texts(found), [`a${character}b`], name);
    }
    // One it does not know, one with no semicolon, and one of another case stay as written.
    assert.deepEqual(texts(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3">&bogus; &Eacute &EACUTE; &frac99;</div>'))), ["&bogus; &Eacute &EACUTE; &frac99;"]);
    assert.deepEqual(texts(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3">Caf&eacute; &amp; Cr&egrave;me &mdash; 5&euro;</div>'))), ["Café & Crème — 5€"]);
  });
});

describe("A2. what is not words", () => {
  it("gives none for the end card: a picture with an alt, a timed box with no text", () => {
    const files = { "index.html": MAIN["index.html"], "compositions/end-card.html": MAIN["compositions/end-card.html"] };
    assert.deepEqual(wordsOf(files), [{ text: "Know your costs", at: 40 }], "only the note in index.html: the other compositions are missing, and the end card holds no words");
    assert.deepEqual(wordsOf(projectOf(host("end-card", 176, 4), { "compositions/end-card.html": MAIN["compositions/end-card.html"] })), []);
  });
  it("gives none for a video, an audio or a picture, and does not read a video's fallback text", () => {
    const files = projectOf('<video class="clip" data-start="0" data-duration="9" src="a.mp4">Your browser cannot play this video.</video><audio class="clip" data-start="0" data-duration="9" src="a.mp3">No audio</audio><img class="clip" data-start="1" data-duration="3" src="a.png" alt="A chart">');
    assert.deepEqual(wordsOf(files), []);
  });
  it("gives none for script, style, head, title and a comment", () => {
    const files = projectOf('<div class="clip" data-start="1" data-duration="3"><script>var words = "Script words";</script><style>.a::after { content: "Style words"; }</style><!-- Comment words --><title>Title words</title>Real</div>');
    assert.deepEqual(texts(wordsOf(files)), ["Real"]);
    assert.deepEqual(wordsOnScreen(() => '<html><head><title>Head words</title></head><body><div data-start="1" data-duration="2">Body</div></body></html>'), [{ text: "Body", at: 1 }]);
  });
  it("gives none for what is hidden, and what is in it", () => {
    const hidden = ['hidden', 'style="display:none"', 'style="color: red; display: none;"', 'style="visibility:hidden"', 'style="opacity:0"', 'style="opacity: 0.0;"'];
    for (const attribute of hidden) assert.deepEqual(wordsOf(projectOf(`<div class="clip" data-start="1" data-duration="3" ${attribute}>Gone <span>too</span></div>`)), [], attribute);
    assert.deepEqual(texts(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3"><div style="display:none">Gone <b>too</b></div>Seen</div>'))), ["Seen"]);
    assert.deepEqual(texts(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3" style="opacity:0.5">Half</div>'))), ["Half"]);
  });
  it("takes an element for a unit only with a start that is a number and a duration above 0", () => {
    for (const attributes of ['data-start="soon" data-duration="3"', 'data-start="1" data-duration="long"', 'data-start="1" data-duration="0"', 'data-start="1" data-duration="-2"', 'data-start="-1" data-duration="3"', 'data-start="" data-duration="3"', 'data-start="1"', 'data-duration="3"', 'data-start="intro" data-duration="3"']) {
      assert.deepEqual(wordsOf(projectOf(`<div class="clip" ${attributes}>Words</div>`)), [], attributes);
    }
  });
  it("gives none for a unit that starts at or after the end of its host, or after the end of the video (review M6)", () => {
    const card = (...starts) => composition("card", starts.map((start) => `<div class="clip" data-start="${start}" data-duration="2">At ${start}</div>`).join(""));
    // A host that runs 10 to 15: a card at 4 is on the screen at 14, one at 5 starts as the host ends, one at 6 is at 16.
    const files = projectOf(host("card", 10, 5), { "compositions/card.html": card(0, 4, 4.9, 5, 6, 40) });
    assert.deepEqual(wordsOf(files), [{ text: "At 0", at: 10 }, { text: "At 4", at: 14 }, { text: "At 4.9", at: 14.9 }]);
    // A video of 60 seconds: a unit at 500 is not in it, nor is one at 60, and a host that starts at 70 is not read.
    const asked = [];
    const long = wordsOnScreen((rel) => {
      asked.push(rel);
      const index = projectOf(`<div class="clip" data-start="59.9" data-duration="2">Last</div><div class="clip" data-start="60" data-duration="2">At the end</div><div class="clip" data-start="500" data-duration="2">Far away</div>${host("late", 70, 5)}`);
      return rel === "index.html" ? index["index.html"] : null;
    });
    assert.deepEqual(long, [{ text: "Last", at: 59.9 }]);
    assert.deepEqual(asked, ["index.html"], "a host that starts after the video is not read");
    // A host inside a host is cut by the host it is in: B runs 12 to 32 on the clock, and A, which holds it, ends at 15.
    const nested = projectOf(host("a", 10, 5), {
      "compositions/a.html": composition("a", host("b", 2, 20)),
      "compositions/b.html": composition("b", '<div class="clip" data-start="0" data-duration="2">B at 12</div><div class="clip" data-start="2" data-duration="2">B at 14</div><div class="clip" data-start="3" data-duration="2">B at 15</div><div class="clip" data-start="4" data-duration="2">B at 16</div>')
    });
    assert.deepEqual(wordsOf(nested), [{ text: "B at 12", at: 12 }, { text: "B at 14", at: 14 }]);
  });
  it("gives none for the words of a host that starts after the video, though no unit of their own holds them", () => {
    const title = composition("title", "<h1>Title words</h1>");
    assert.deepEqual(wordsOf(projectOf(host("title", 59, 5), { "compositions/title.html": title })), [{ text: "Title words", at: 59 }]);
    assert.deepEqual(wordsOf(projectOf(host("title", 60, 5), { "compositions/title.html": title })), []);
  });
  it("keeps the words inside a unit that is past the end, if a unit inside it starts before the end", () => {
    // The timing of the elements is flat: a unit inside another is on the clock of the composition, not of the unit that holds it.
    const files = projectOf('<div class="clip" data-start="500" data-duration="2">Away<div class="clip" data-start="5" data-duration="2">Inside</div></div>');
    assert.deepEqual(wordsOf(files), [{ text: "Inside", at: 5 }]);
  });
  it("takes the first root of the main page for the video, and not a root inside it", () => {
    const files = { "index.html": '<div id="root" data-composition-id="main" data-duration="60"><div id="inner" data-composition-id="inner" data-duration="5"><div class="clip" data-start="3" data-duration="1">Inside</div></div><div class="clip" data-start="30" data-duration="2">Later</div></div>' };
    assert.deepEqual(wordsOf(files), [{ text: "Inside", at: 3 }, { text: "Later", at: 30 }]);
    // Before the first root there is no video yet: a root that follows another element still sizes it.
    const after = { "index.html": '<div class="clip" data-start="20" data-duration="1">Before the root</div><div id="root" data-composition-id="main" data-duration="10"><div class="clip" data-start="30" data-duration="1">After the end</div></div>' };
    assert.deepEqual(wordsOf(after), [{ text: "Before the root", at: 20 }]);
    // A composition's own root gives no end: the host it is named by does.
    const card = `<template><div id="root" data-composition-id="card" data-duration="3"><div class="clip" data-start="5" data-duration="1">Past its own root</div></div></template>`;
    assert.deepEqual(wordsOf(projectOf(host("card", 10, 10), { "compositions/card.html": card })), [{ text: "Past its own root", at: 15 }]);
  });
  it("takes a project whose root says no length, or a nonsense one, to have no end", () => {
    const bare = (root) => ({ "index.html": `<div ${root}><div class="clip" data-start="500" data-duration="2">Far</div></div>` });
    for (const root of ['id="root" data-composition-id="main"', 'id="root" data-composition-id="main" data-duration="long"', 'id="root" data-composition-id="main" data-duration="0"', 'id="root" data-composition-id="main" data-duration="-5"']) {
      assert.deepEqual(wordsOf(bare(root)), [{ text: "Far", at: 500 }], root);
    }
    assert.deepEqual(wordsOf(bare('id="root" data-composition-id="main" data-duration="600"')), [{ text: "Far", at: 500 }]);
    assert.deepEqual(wordsOf(bare('id="root" data-composition-id="main" data-duration="500"')), []);
  });
  it("gives none for text outside every unit, in index.html and in the root of the main composition", () => {
    assert.deepEqual(wordsOf(projectOf("Plain text<div>More</div>")), []);
    assert.deepEqual(wordsOnScreen(() => '<html><body>Bare<div id="root" data-composition-id="main" data-start="0" data-duration="9">In the root</div></body></html>'), []);
  });
  it("gives none for a line of punctuation alone, or for one with nothing in it", () => {
    assert.deepEqual(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3"><p>***</p><p>   </p><p>•</p><p>2026</p></div>')), [{ text: "2026", at: 1 }]);
  });
  it("takes the control characters out of a line, which an entity can write, and gives none for a line of nothing else (review M1)", () => {
    const found = wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3"><p>Head&#7; of&#27;[0m Pricing&#x85;&#x7f;</p><p>&#7;&#27;</p><p>&#7;---&#27;</p><p>Tab\there</p></div>'));
    assert.deepEqual(texts(found), ["Head of[0m Pricing", "Tab here"]);
    for (const { text } of found) assert.doesNotMatch(text, /\p{Cc}/u);
    // Taken out before the length is counted and before the line is looked at for words.
    const padded = `${"w".repeat(299)}${"&#7;".repeat(40)}x`;
    assert.deepEqual(texts(wordsOf(projectOf(`<div class="clip" data-start="1" data-duration="3"><p>${padded}</p></div>`))), [`${"w".repeat(299)}x`]);
  });
  it("gives none for a line of more than 300 characters: it is not a title", () => {
    const long = "word ".repeat(80).trim();
    assert.equal(long.length > 300, true);
    assert.deepEqual(texts(wordsOf(projectOf(`<div class="clip" data-start="1" data-duration="3"><p>${long}</p><p>Short</p></div>`))), ["Short"]);
  });
});

describe("A3. captions are never words", () => {
  it("passes over a captions composition named by a host whose id is captions, and finds the title beside it", () => {
    assert.deepEqual(wordsOf(REEL), [{ text: "Mistake one", at: 0 }]);
    assert.deepEqual(wordsOf({ ...REEL, "index.html": REEL["index.html"].replace(/<div[^>]*id="title"[^>]*><\/div>/, "") }), []);
  });
  /** A captions composition written another way: its lines are plain timed boxes, with no class to give them away. */
  const PLAIN = (id) => composition(id, '<div data-start="0" data-duration="1">Said aloud</div><div data-start="1" data-duration="1">Said again</div>');
  it("passes over a captions composition by its file name alone, by data-track-kind alone, or by its host's id alone", () => {
    const byFile = projectOf('<div id="words" data-composition-id="words" data-composition-src="compositions/captions.html" data-start="0" data-duration="60"></div>', { "compositions/captions.html": PLAIN("words") });
    assert.deepEqual(wordsOf(byFile), []);
    const byKind = projectOf('<div id="words" data-composition-id="words" data-composition-src="compositions/words.html" data-start="0" data-duration="60" data-track-kind="captions"></div>', { "compositions/words.html": PLAIN("words") });
    assert.deepEqual(wordsOf(byKind), []);
    const byId = projectOf('<div id="x" data-composition-id="captions-karaoke" data-composition-src="compositions/x.html" data-start="0" data-duration="60"></div>', { "compositions/x.html": PLAIN("x") });
    assert.deepEqual(wordsOf(byId), []);
    const control = projectOf('<div id="x" data-composition-id="x" data-composition-src="compositions/x.html" data-start="0" data-duration="60"></div>', { "compositions/x.html": PLAIN("x") });
    assert.deepEqual(texts(wordsOf(control)), ["Said aloud", "Said again"], "the same lines, named another way, are words");
  });
  it("passes over a captions composition by the id of its own root, whatever the host and the file are called", () => {
    const files = projectOf(host("renamed", 0, 60), { "compositions/renamed.html": PLAIN("captions") });
    assert.deepEqual(wordsOf(files), []);
    assert.deepEqual(wordsOf(projectOf(host("renamed", 0, 60), { "compositions/renamed.html": PLAIN("subtitles") })), []);
  });
  it("passes over captions written in index.html itself, with everything in them", () => {
    const files = projectOf([
      '<div class="clip cap" data-start="0" data-duration="1"><span class="cap-box">Said aloud</span></div>',
      '<div class="clip caption" data-start="1" data-duration="1">Also said</div>',
      '<div class="subtitles" data-start="2" data-duration="1">Subtitled</div>',
      '<div data-start="3" data-duration="2" data-track-kind="captions"><div>Nested</div></div>',
      '<div id="captions" class="clip" data-start="3.5" data-duration="1">By its id</div>',
      '<div id="subtitle" data-start="3.6" data-duration="1">Also by its id</div>',
      '<div class="clip cap" data-start="4" data-duration="1"><div class="clip" data-start="4.2" data-duration="0.5">Inside a caption</div></div>',
      '<div class="clip" data-start="5" data-duration="2">A title</div>'
    ].join(""));
    assert.deepEqual(wordsOf(files), [{ text: "A title", at: 5 }]);
  });
  it("does not take a class that only holds the letters for a captions class", () => {
    const files = projectOf('<div class="clip capacity escape captain" data-start="1" data-duration="2">Kept</div>');
    assert.deepEqual(texts(wordsOf(files)), ["Kept"]);
  });
  it("passes over an id or a class that is the captions' name with a word joined to it by a dash, an underscore or a space (review M4)", () => {
    // The app numbers its captions (`cap-01`), and a captions box can be named for what it holds: none of them is a title.
    const files = projectOf([
      '<div id="cap-01" data-start="0" data-duration="1">By its id</div>',
      '<div id="caption-2" data-start="1" data-duration="1">By a longer id</div>',
      '<div id="the_captions" data-start="1.5" data-duration="1">By an id with an underscore</div>',
      '<div class="caption-line" data-start="2" data-duration="1">By a class</div>',
      '<div class="clip captions-wrap" data-start="3" data-duration="1"><span>In a wrap</span></div>',
      '<div class="main_subtitles" data-start="4" data-duration="1">Joined by an underscore</div>',
      '<div class="cap-box" data-start="5" data-duration="1">The box of a caption</div>',
      '<div class="clip cap_line" data-start="5.5" data-duration="1">Also by an underscore</div>',
      '<div id="SUBTITLE-3" data-start="5.8" data-duration="1">In capitals</div>',
      '<div class="clip" data-start="6" data-duration="2">A title</div>'
    ].join(""));
    assert.deepEqual(wordsOf(files), [{ text: "A title", at: 6 }]);
  });
  it("keeps a name that holds the letters of a captions name without being one: a drop cap, a capacity, a captain, a recap", () => {
    const files = projectOf([
      '<div class="drop-cap" data-start="1" data-duration="1">Drop</div>',
      '<div id="recap-1" data-start="2" data-duration="1">Recap</div>',
      '<div id="capacity-2" class="captain" data-start="3" data-duration="1">Capacity</div>',
      '<div id="captionless" data-start="4" data-duration="1">Captionless</div>',
      '<div class="subtitled" data-start="5" data-duration="1">Subtitled</div>',
      '<div id="cap2" data-start="6" data-duration="1">Joined to a figure</div>'
    ].join(""));
    assert.deepEqual(texts(wordsOf(files)), ["Drop", "Recap", "Capacity", "Captionless", "Subtitled", "Joined to a figure"]);
  });
});

describe("A4. order", () => {
  it("is by when the words appear, not by the document's order", () => {
    const files = projectOf('<div class="clip" data-start="40" data-duration="2">Late</div><div class="clip" data-start="3" data-duration="2">Early</div><div class="clip" data-start="12" data-duration="2">Middle</div>');
    assert.deepEqual(wordsOf(files), [{ text: "Early", at: 3 }, { text: "Middle", at: 12 }, { text: "Late", at: 40 }]);
  });
  it("keeps the document's order for words that start together, and a card's lines in their order", () => {
    const files = projectOf('<div class="clip" data-start="5" data-duration="2"><p>Second written, first line</p><p>Second line</p></div><div class="clip" data-start="5" data-duration="2">Written after</div>');
    assert.deepEqual(texts(wordsOf(files)), ["Second written, first line", "Second line", "Written after"]);
  });
  it("tells the same words twice when they appear twice", () => {
    const files = projectOf('<div class="clip" data-start="3" data-duration="2">Alex Rivera</div><div class="clip" data-start="50" data-duration="2">Alex Rivera</div>');
    assert.deepEqual(wordsOf(files), [{ text: "Alex Rivera", at: 3 }, { text: "Alex Rivera", at: 50 }]);
  });
  it("puts a unit inside a unit where it appears, and the outer unit's own words where the outer one does", () => {
    const files = projectOf('<div class="clip" data-start="10" data-duration="9"><p>Outer first</p><div class="clip" data-start="4" data-duration="2"><p>Inner</p></div><p>Outer last</p></div>');
    assert.deepEqual(wordsOf(files), [{ text: "Inner", at: 4 }, { text: "Outer first", at: 10 }, { text: "Outer last", at: 10 }]);
  });
});

describe("A5. lenient, and safe", () => {
  it("reads broken markup for the words it holds", () => {
    const files = projectOf('<div class="clip" data-start="1" data-duration=3>Open box<p>Stray</span><br/><b>Bold</b> &amp; plain</div></div>');
    assert.deepEqual(texts(wordsOf(files)), ["Open box", "Stray", "Bold & plain"]);
    assert.deepEqual(texts(wordsOf(projectOf("<div class='clip' data-start='1' data-duration='2'>Single quotes</div>"))), ["Single quotes"]);
    assert.deepEqual(texts(wordsOf(projectOf("<DIV CLASS=\"clip\" DATA-START=\"1\" DATA-DURATION=\"2\">Capitals</DIV>"))), ["Capitals"]);
  });
  it("never throws, and ends at once, for a table of nasty inputs", () => {
    const deep = `<div class="clip" data-start="1" data-duration="3">${"<div>".repeat(5000)}Deep${"</div>".repeat(5000)}</div>`;
    const inputs = ["", "<", "<<<", "<div", "<div data-start=", '<div data-start="1" data-duration="2"', "<!-- never closed", "<script>never closed", "<style>", "<![CDATA[ x", "<?php echo 1; ?>", "</", "</>", "</div", "&", "&#", "&#99999999999;", "&bogus;", "\0", "<a b='c", '<div data-start="1" data-duration="2">' + "x".repeat(1e6), deep, "<div ".repeat(20000), "<p>".repeat(20000)];
    const started = Date.now();
    // Each as the page, and each inside a box on the screen, where its words are read.
    for (const input of inputs) {
      assert.ok(Array.isArray(wordsOnScreen(() => input)), input.slice(0, 20));
      assert.ok(Array.isArray(wordsOnScreen(() => `<div class="clip" data-start="1" data-duration="3">${input}</div>`)), input.slice(0, 20));
    }
    assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
    const found = wordsOnScreen(() => deep);
    assert.ok(found.length === 1 && found[0].text.endsWith("Deep"), JSON.stringify(found).slice(0, 80));
  });
  it("gives null, and no words, for a project that holds more than 200,000 elements to read (a page parsed and walked, all together)", () => {
    // The reading of a whole project has one budget (review I3): an element parsed and an element walked each use one of its 200,000.
    const page = (count) => `<div id="root" data-composition-id="main" data-start="0" data-duration="9">${"<i></i>".repeat(count)}<div class="clip" data-start="1" data-duration="2">After</div></div>`;
    assert.equal(wordsOnScreen(() => page(210000)), null);
    assert.equal(wordsOnScreen(() => page(110000)), null, "parsed once and walked once: 220,000");
    assert.deepEqual(texts(wordsOnScreen(() => page(90000))), ["After"]);
    assert.deepEqual(texts(wordsOnScreen(() => `<div class="clip" data-start="1" data-duration="2">Before</div>${"<i></i>".repeat(1000)}`)), ["Before"]);
  });
  it("gives nothing for a file that is not HTML, or not there, or that cannot be read", () => {
    assert.deepEqual(wordsOnScreen(() => null), []);
    assert.deepEqual(wordsOnScreen(() => { throw new Error("EACCES"); }), []);
    assert.deepEqual(wordsOnScreen(() => '{"json": "not a page"}'), []);
    assert.deepEqual(wordsOnScreen(() => 42), []);
    assert.deepEqual(wordsOnScreen(() => undefined), []);
    const files = projectOf(host("card", 3, 5), {});
    assert.deepEqual(wordsOf(files), [], "a composition the host names that is not there");
    const throws = (rel) => {
      if (rel === "compositions/card.html") throw new Error("EIO");
      return files["index.html"];
    };
    assert.deepEqual(wordsOnScreen(throws), []);
  });
  it("asks `read` only for index.html and for .html files under compositions/, however the host spells the path", () => {
    const refused = ["../x.html", "/etc/x.html", "compositions/../index.html", "compositions/x.txt", "compositions/card.json", "compositions/card.html.txt", "compositions/card.htm", "compositions/.html", "index.html", "assets/x.html", "compositions/..", "compositions/", "http://example.com/x.html", "compositions\\x.html", "compositions/a\0b.html", "", "  ", "x.html"];
    for (const src of refused) {
      const asked = [];
      const files = projectOf(`<div id="h" data-composition-id="h" data-composition-src="${src}" data-start="1" data-duration="3"></div>`);
      wordsOnScreen((rel) => {
        asked.push(rel);
        return files[rel] ?? null;
      });
      assert.deepEqual(asked, ["index.html"], `${JSON.stringify(src)} was asked for as ${asked.join(", ")}`);
    }
    for (const src of ["./compositions/x.html", "compositions//x.html", "compositions/sub/../x.html"]) {
      const asked = [];
      const files = projectOf(`<div id="h" data-composition-id="h" data-composition-src="${src}" data-start="1" data-duration="3"></div>`);
      wordsOnScreen((rel) => {
        asked.push(rel);
        return files[rel] ?? null;
      });
      assert.deepEqual(asked, ["index.html", "compositions/x.html"], src);
    }
  });
  it("reads a composition only for a host that is on the screen at a time: with a start and a duration", () => {
    for (const times of ['data-start="1"', 'data-duration="3"', 'data-start="soon" data-duration="3"', 'data-start="1" data-duration="0"', ""]) {
      const asked = [];
      const files = projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/card.html" ${times}></div>`, { "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Untimed host</div>') });
      const found = wordsOnScreen((rel) => {
        asked.push(rel);
        return files[rel] ?? null;
      });
      assert.deepEqual([asked, found], [["index.html"], []], times);
    }
  });
  it("does not let a script or a style close the box it is in, or open another", () => {
    const files = projectOf('<div class="clip" data-start="1" data-duration="3"><script>var close = "</div>"; var open = "<p>Fake</p>"; if (1 < 2) {}</script><style>.a::after { content: "</div>"; }</style>Seen</div>');
    assert.deepEqual(texts(wordsOf(files)), ["Seen"]);
    assert.deepEqual(texts(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3"><SCRIPT>x</div></SCRIPT >Upper</div>'))), ["Upper"]);
  });
  it("reads two compositions that name each other, and one that names itself, once each", () => {
    const asked = [];
    const files = projectOf(host("a", 0, 30), {
      "compositions/a.html": composition("a", `${host("b", 1, 10)}<div class="clip" data-start="0" data-duration="2">In a</div>`),
      "compositions/b.html": composition("b", `${host("a", 1, 10)}${host("b", 2, 5)}<div class="clip" data-start="0" data-duration="2">In b</div>`)
    });
    const found = wordsOnScreen((rel) => {
      asked.push(rel);
      return files[rel] ?? null;
    });
    assert.deepEqual(asked, ["index.html", "compositions/a.html", "compositions/b.html"]);
    assert.deepEqual(found, [{ text: "In a", at: 0 }, { text: "In b", at: 1 }]);
  });
  it("reads the same composition for each host that names it", () => {
    const files = projectOf(`${hostOf("card-one", "compositions/card.html", 3, 5)}${hostOf("card-two", "compositions/card.html", 30, 5)}`, { "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Twice</div>') });
    assert.deepEqual(wordsOf(files), [{ text: "Twice", at: 3 }, { text: "Twice", at: 30 }]);
  });
  it("reads compositions three deep and no deeper", () => {
    const asked = [];
    const files = projectOf(host("c1", 0, 9), {
      "compositions/c1.html": composition("c1", host("c2", 0, 9)),
      "compositions/c2.html": composition("c2", host("c3", 0, 9)),
      "compositions/c3.html": composition("c3", `${host("c4", 0, 9)}<div class="clip" data-start="0" data-duration="2">Third</div>`),
      "compositions/c4.html": composition("c4", '<div class="clip" data-start="0" data-duration="2">Fourth</div>')
    });
    const found = wordsOnScreen((rel) => {
      asked.push(rel);
      return files[rel] ?? null;
    });
    assert.deepEqual(asked, ["index.html", "compositions/c1.html", "compositions/c2.html", "compositions/c3.html"]);
    assert.deepEqual(texts(found), ["Third"]);
  });
  it("gives null, and not the first 500, for a project of more than 500 lines: a list cut short is never given", () => {
    const lines = (count) => Array.from({ length: count }, (_, i) => `<div class="clip" data-start="${i}" data-duration="1">Line ${i}</div>`).join("");
    const page = (count) => `<div id="root" data-composition-id="main" data-start="0" data-duration="9000">${lines(count)}</div>`;
    assert.equal(wordsOnScreen(() => page(3000)), null);
    assert.equal(wordsOnScreen(() => page(501)), null);
    const found = wordsOnScreen(() => page(500));
    assert.equal(found.length, 500);
    assert.equal(found[0].text, "Line 0");
  });
});

describe("A7. a project too big to read in full, and a file that is two names (review I3)", () => {
  // Hosts that name hosts multiply the reading: 40 hosts that each name a composition that holds 40 more is 64,000 walks at three levels.
  // The reading of a project has one budget: 200,000 elements parsed or walked, all together, and 300 files asked of `read`. A file is
  // asked for once by its name and parsed once by what it is, and when the budget is used up the answer is null: nothing is found.
  const timed = (count) => Array.from({ length: count }, (_, i) => `<div class="clip" data-start="${i % 10}" data-duration="2">Word ${i}</div>`).join("");
  /** Boxes with no words in them: only the budget of elements can stop the reading of these, not the budget of lines. */
  const boxes = (count) => Array.from({ length: count }, (_, i) => `<div id="box-${i}" class="clip" data-start="${i % 10}" data-duration="2"></div>`).join("");
  const asking = (files) => {
    const asked = [];
    return { asked, read: (rel) => { asked.push(rel); return files[rel] ?? null; } };
  };
  const within = (limit, then) => {
    const started = Date.now();
    const result = then();
    assert.ok(Date.now() - started < limit, `${Date.now() - started} ms`);
    return result;
  };
  it("gives null at once for 3,000 hosts that name one composition of 21 KB, and asks for the file once", () => {
    // Boxes with words in them (320 lines in the file) and boxes with none: the budget of lines stops the first, that of elements the second.
    for (const inner of [timed(320), boxes(320)]) {
      const big = composition("big", inner);
      assert.ok(big.length > 20000 && big.length < 30000, String(big.length));
      const hosts = Array.from({ length: 3000 }, (_, i) => hostOf(`h${i}`, "compositions/big.html", i % 100, 5)).join("");
      const { asked, read } = asking(projectOf(hosts, { "compositions/big.html": big }));
      assert.equal(within(5000, () => wordsOnScreen(read)), null);
      assert.deepEqual(asked, ["index.html", "compositions/big.html"]);
    }
  });
  it("gives null at once for 40 hosts that name a composition holding 40 hosts that name one holding 40, at three levels", () => {
    const level = (name, next) => composition(name, Array.from({ length: 40 }, (_, i) => hostOf(`${name}-${i}`, `compositions/${next}.html`, i % 10, 5)).join(""));
    for (const inner of [timed(20), boxes(20)]) {
      const files = projectOf(Array.from({ length: 40 }, (_, i) => hostOf(`top-${i}`, "compositions/a.html", i, 5)).join(""), {
        "compositions/a.html": level("a", "b"),
        "compositions/b.html": level("b", "c"),
        "compositions/c.html": composition("c", inner)
      });
      const { asked, read } = asking(files);
      assert.equal(within(5000, () => wordsOnScreen(read)), null);
      assert.deepEqual(asked, ["index.html", "compositions/a.html", "compositions/b.html", "compositions/c.html"]);
    }
  });
  it("gives the words of a project of a reasonable size, though many hosts name one composition", () => {
    const hosts = Array.from({ length: 10 }, (_, i) => hostOf(`h${i}`, "compositions/card.html", i * 5, 10)).join("");
    const { read } = asking(projectOf(hosts, { "compositions/card.html": composition("card", timed(40)) }));
    const found = wordsOnScreen(read);
    assert.equal(found.length, 10 * 40);
  });
  it("asks for no more than 300 files: index.html and 299 compositions are read, and one more is too many", () => {
    const files = (count) => projectOf(Array.from({ length: count }, (_, i) => host(`card${i}`, 1, 3)).join(""), Object.fromEntries(Array.from({ length: count }, (_, i) => [`compositions/card${i}.html`, composition(`card${i}`, '<div class="clip" data-start="0" data-duration="2">Seen</div>')])));
    const fine = asking(files(299));
    assert.equal(wordsOnScreen(fine.read).length, 299);
    assert.equal(fine.asked.length, 300);
    const toomany = asking(files(300));
    assert.equal(wordsOnScreen(toomany.read), null);
    assert.equal(toomany.asked.length, 300, "no file is asked for after the 300th");
  });
  it("asks for a host that names a file that is not there once, however many hosts name it", () => {
    const { asked, read } = asking(projectOf(Array.from({ length: 2000 }, (_, i) => hostOf(`h${i}`, "compositions/gone.html", 1, 3)).join("")));
    assert.deepEqual(within(5000, () => wordsOnScreen(read)), []);
    assert.deepEqual(asked, ["index.html", "compositions/gone.html"]);
  });
  it("parses a file once, whatever the spellings it is named by: `read` may give { text, id }, and the id is what the file is", () => {
    // The id is the device and inode of a real file. Two names for one file give one id, so the page is parsed the first time and the
    // tree is used again (the second text below, which a real file never has, is never looked at). Two hosts are two times, so the
    // words are told for each.
    const page = projectOf(`${hostOf("one", "compositions/Card.html", 3, 5)}${hostOf("two", "compositions/card.html", 30, 5)}`);
    const texts_ = { "compositions/Card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">First spelling</div>'), "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Second spelling</div>') };
    const read = (rel) => (rel === "index.html" ? { text: page["index.html"], id: "1:1" } : texts_[rel] ? { text: texts_[rel], id: "1:77" } : null);
    assert.deepEqual(wordsOnScreen(read), [{ text: "First spelling", at: 3 }, { text: "First spelling", at: 30 }]);
  });
  it("does not read a file inside itself under another spelling: it is the file it is, and its words are told once", () => {
    // On a disk that does not tell A.html from a.html, a composition that names itself by the other spelling is not a new file.
    const files = {
      "index.html": projectOf(hostOf("a", "compositions/A.html", 0, 30))["index.html"],
      "compositions/A.html": { text: composition("a", `${hostOf("again", "compositions/a.html", 1, 10)}<div class="clip" data-start="0" data-duration="2">In a</div>`), id: "7:1" },
      "compositions/a.html": { text: composition("a", `${hostOf("again", "compositions/a.html", 1, 10)}<div class="clip" data-start="0" data-duration="2">In a</div>`), id: "7:1" }
    };
    const read = (rel) => (typeof files[rel] === "string" ? { text: files[rel], id: "7:0" } : files[rel] ?? null);
    assert.deepEqual(wordsOnScreen(read), [{ text: "In a", at: 0 }]);
  });
  it("does not take two files for one when `read` gives no id, or gives the same one to two things it did not mean", () => {
    // Without an id a file is what its name says: two names are two files (as a made-up `read` that gives text alone has it).
    const files = projectOf(`${hostOf("one", "compositions/Card.html", 3, 5)}${hostOf("two", "compositions/card.html", 30, 5)}`, {
      "compositions/Card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Upper</div>'),
      "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Lower</div>')
    });
    assert.deepEqual(texts(wordsOnScreen(readFrom(files))), ["Upper", "Lower"]);
  });
});

describe("A6. from a folder", () => {
  const made = [];
  const folder = (files) => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-on-screen-"));
    made.push(dir);
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), text);
    }
    return dir;
  };
  /** Every file under a folder with its size and time, to see that nothing was written. */
  const listing = (dir, from = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name);
    return entry.isDirectory() ? listing(at, from) : [[at.slice(from.length), statSync(at).size, statSync(at).mtimeMs]];
  });
  const done = () => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));

  it("reads index.html and the compositions it names, and nothing else, and writes nothing", () => {
    const dir = folder({ ...MAIN, "compositions/unused.html": composition("unused", '<div class="clip" data-start="0" data-duration="5">Never named</div>'), "boards/storyboard.html": '<div data-start="1" data-duration="2">A board</div>', "index.txt": "x" });
    const before = listing(dir);
    const found = projectWords(dir);
    assert.equal(found.here, true);
    assert.deepEqual(texts(found.words), ["Alex Rivera", "Head of Pricing", "Three pricing", "mistakes", "Know your costs"]);
    assert.deepEqual(listing(dir), before);
    done();
  });
  it("says a folder that is not there is not here", () => {
    const dir = join(tmpdir(), `brimm-on-screen-missing-${process.pid}`);
    assert.deepEqual(projectWords(dir), { here: false, words: [] });
    assert.deepEqual(projectWords(""), { here: false, words: [] });
    assert.deepEqual(projectWords(undefined), { here: false, words: [] });
    const file = folder({ "x.txt": "a file, not a folder" });
    assert.deepEqual(projectWords(join(file, "x.txt")), { here: false, words: [] });
    done();
  });
  it("reads a project by its name in the work folder, and a name that leads out of it is a project that is not here", () => {
    const work = folder({ "Pricing main/index.html": projectOf("")["index.html"].replace("</div>", '<div class="clip" data-start="3" data-duration="2">Seen</div></div>'), "elsewhere/index.html": '<div class="clip" data-start="1" data-duration="2">Outside</div>' });
    assert.deepEqual(projectWordsIn(work, "Pricing main"), { here: true, words: [{ text: "Seen", at: 3 }] });
    mkdirSync(join(work, "inside"));
    for (const name of ["..", ".", "", "../elsewhere", "Pricing main/../../elsewhere", "a/b", "x\0y", undefined, null, 7, ["Pricing main"]]) assert.deepEqual(projectWordsIn(join(work, "inside"), name), { here: false, words: [] }, JSON.stringify(name));
    assert.deepEqual(projectWordsIn(join(work, "inside"), "nothing here"), { here: false, words: [] });
    done();
  });
  it("says a folder without an index.html is here, with no words", () => {
    const dir = folder({ "compositions/lower-third.html": MAIN["compositions/lower-third.html"] });
    assert.deepEqual(projectWords(dir), { here: true, words: [] });
    done();
  });
  it("does not follow a link in place of index.html, or a link in compositions/ to a file outside the project", () => {
    const outside = folder({ "secret.html": '<div class="clip" data-start="1" data-duration="3">Outside</div>', "card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Linked</div>') });
    const linkedIndex = folder({});
    symlinkSync(join(outside, "secret.html"), join(linkedIndex, "index.html"));
    assert.deepEqual(projectWords(linkedIndex), { here: true, words: [] });
    const linkedCard = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"] });
    mkdirSync(join(linkedCard, "compositions"));
    symlinkSync(join(outside, "card.html"), join(linkedCard, "compositions", "card.html"));
    assert.deepEqual(projectWords(linkedCard).words, []);
    done();
  });
  it("does not follow a link even to a file inside the project", () => {
    const dir = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/real.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Real</div>') });
    symlinkSync(join(dir, "compositions", "real.html"), join(dir, "compositions", "card.html"));
    assert.deepEqual(projectWords(dir).words, []);
    const linkedIndex = folder({ "other.html": projectOf("")["index.html"] });
    symlinkSync(join(linkedIndex, "other.html"), join(linkedIndex, "index.html"));
    assert.deepEqual(projectWords(linkedIndex), { here: true, words: [] });
    done();
  });
  it("does not read a compositions folder that is a link to a folder outside the project, or a folder in it that is", () => {
    const outside = folder({ "card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Linked</div>') });
    const whole = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"] });
    symlinkSync(outside, join(whole, "compositions"));
    assert.deepEqual(projectWords(whole).words, []);
    const inner = folder({ "index.html": projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/sub/card.html" data-start="3" data-duration="5"></div>`)["index.html"] });
    mkdirSync(join(inner, "compositions"));
    symlinkSync(outside, join(inner, "compositions", "sub"));
    assert.deepEqual(projectWords(inner).words, []);
    done();
  });
  it("does not follow a link to a folder inside compositions/ either: never through a link, wherever it leads (review M9)", () => {
    const card = composition("card", '<div class="clip" data-start="0" data-duration="2">Through a link</div>');
    const inside = folder({ "index.html": projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/sub/card.html" data-start="3" data-duration="5"></div>`)["index.html"], "compositions/real/card.html": card });
    symlinkSync(join(inside, "compositions", "real"), join(inside, "compositions", "sub"));
    assert.deepEqual(projectWords(inside).words, [], "a folder of compositions/ that is a link to another folder of compositions/");
    const elsewhere = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "assets/comps/card.html": card });
    symlinkSync(join(elsewhere, "assets", "comps"), join(elsewhere, "compositions"));
    assert.deepEqual(projectWords(elsewhere).words, [], "compositions/ that is a link to another folder of the project");
    // The folders themselves, with no link on the way, are read; and so is a project whose own folder is reached through a link.
    const plain = folder({ "index.html": projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/sub/card.html" data-start="3" data-duration="5"></div>`)["index.html"], "compositions/sub/card.html": card });
    assert.deepEqual(projectWords(plain).words, [{ text: "Through a link", at: 3 }]);
    const through = join(plain, "..", `brimm-on-screen-link-${process.pid}`);
    symlinkSync(plain, through);
    try {
      assert.deepEqual(projectWords(through).words, [{ text: "Through a link", at: 3 }]);
    } finally {
      rmSync(through, { force: true });
    }
    done();
  });
  it("reads a composition by a spelling of its name that the disk takes for the same, as the disk reads it: the real path is the name as written", () => {
    // On a disk that does not tell Card.html from card.html (this Mac's), the name as the host writes it is the name the real path gives back.
    const dir = folder({ "index.html": projectOf(host("Card", 3, 5))["index.html"], "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Either case</div>') });
    const blind = existsSync(join(dir, "compositions", "Card.html"));
    assert.deepEqual(projectWords(dir).words, blind ? [{ text: "Either case", at: 3 }] : []);
    done();
  });
  it("does not read a file of more than 2 MB", () => {
    const big = composition("card", `<div class="clip" data-start="0" data-duration="2">Big</div><!-- ${"x".repeat(2 * 1024 * 1024)} -->`);
    const dir = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/card.html": big });
    assert.deepEqual(projectWords(dir).words, []);
    const fine = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/card.html": composition("card", `<div class="clip" data-start="0" data-duration="2">Small</div><!-- ${"x".repeat(1024 * 1024)} -->`) });
    assert.deepEqual(projectWords(fine).words, [{ text: "Small", at: 3 }]);
    done();
  });
  it("says a project it could not read in full is here, with no words, and says it was not read in full (review I3)", () => {
    const big = composition("big", Array.from({ length: 320 }, (_, i) => `<div class="clip" data-start="${i % 10}" data-duration="2">Word ${i}</div>`).join(""));
    const hosts = Array.from({ length: 3000 }, (_, i) => hostOf(`h${i}`, "compositions/big.html", i % 100, 5)).join("");
    const dir = folder({ "index.html": projectOf(hosts)["index.html"], "compositions/big.html": big });
    const started = Date.now();
    assert.deepEqual(projectWords(dir), { here: true, words: [], incomplete: true });
    assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
    // A project that was read in full says nothing of the kind.
    const whole = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Whole</div>') });
    assert.deepEqual(projectWords(whole), { here: true, words: [{ text: "Whole", at: 3 }] });
    done();
  });
  it("takes two names of one file for one file: a composition that names itself by its other name is not told twice", () => {
    // A hard link is a second name of the same file, as `A.html` and `a.html` are on a disk that does not tell them apart.
    const inner = (name) => composition("a", `${hostOf("again", `compositions/${name}.html`, 1, 10)}<div class="clip" data-start="0" data-duration="2">In a</div>`);
    const dir = folder({ "index.html": projectOf(host("a", 0, 30))["index.html"], "compositions/a.html": inner("b") });
    linkSync(join(dir, "compositions", "a.html"), join(dir, "compositions", "b.html"));
    assert.deepEqual(projectWords(dir), { here: true, words: [{ text: "In a", at: 0 }] });
    done();
  });
  it("reads a composition in a folder of compositions/", () => {
    const dir = folder({ "index.html": projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/sub/card.html" data-start="3" data-duration="5"></div>`)["index.html"], "compositions/sub/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Nested</div>') });
    assert.deepEqual(projectWords(dir).words, [{ text: "Nested", at: 3 }]);
    done();
  });
});

describe("A8. a file is read as the one thing it was looked at as, and no more than 2 MB of it (review I4)", () => {
  // A project is written by the app's agent while `finish` reads it. The file looked at is opened without following a link and without
  // waiting for a writer, the thing opened must be the thing looked at (the same device and inode, a regular file), and no more than 2 MB
  // and a byte is read from it, whatever it has grown to. The tests swap a file from inside the look, as free.test.js's do from `ctx.stat`.
  const MB = 1024 * 1024;
  const made = [];
  const folder = (files) => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-on-screen-"));
    made.push(dir);
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), text);
    }
    return dir;
  };
  const done = () => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  const SEEN = '<div class="clip" data-start="1" data-duration="2">Seen</div>';
  const SWAPPED = '<div class="clip" data-start="1" data-duration="2">Swapped in</div>';
  /** `io` for projectWords: the look at a file runs `swap(path)` once, after it has looked, before the file is opened. */
  const afterLook = (swap) => {
    let swapped = false;
    return {
      lstat: (path) => {
        const found = lstatSync(path);
        if (!swapped) {
          swapped = true;
          swap(path);
        }
        return found;
      }
    };
  };
  it("does not read a file swapped for another after the look: the file opened is not the file looked at", () => {
    const dir = folder({ "index.html": SEEN });
    // The other file exists beside the first when it takes its place, so that it has an inode of its own.
    const found = projectWords(dir, afterLook((path) => {
      writeFileSync(`${path}.other`, SWAPPED);
      renameSync(`${path}.other`, path);
    }));
    assert.deepEqual(found, { here: true, words: [] });
    assert.deepEqual(projectWords(dir).words, [{ text: "Swapped in", at: 1 }], "the swapped-in file is an ordinary one when it is there at the look");
    done();
  });
  it("does not follow a link swapped in for a file after the look, though it leads to a file of the project that is the same file", () => {
    const dir = folder({ "index.html": SEEN });
    const found = projectWords(dir, afterLook((path) => {
      linkSync(path, join(dir, "real.html"));
      rmSync(path);
      symlinkSync(join(dir, "real.html"), path);
    }));
    assert.deepEqual(found, { here: true, words: [] });
    done();
  });
  it("does not wait for a writer on a file swapped for a pipe after the look", () => {
    // A pipe opened to read waits for a writer for good: the child process has a time limit, and the swap is made after the look, since
    // a pipe there at the look is refused before it is opened.
    const dir = folder({ "index.html": SEEN });
    const script = `
      import { lstatSync, rmSync } from "node:fs";
      import { execFileSync } from "node:child_process";
      import { projectWords } from ${JSON.stringify(fileURLToPath(new URL("../on-screen.js", import.meta.url)))};
      const dir = process.argv[1];
      let swapped = false;
      const lstat = (path) => {
        const found = lstatSync(path);
        if (!swapped) {
          swapped = true;
          rmSync(path);
          execFileSync("mkfifo", [path]);
        }
        return found;
      };
      console.log(JSON.stringify(projectWords(dir, { lstat })));
    `;
    const ran = spawnSync(process.execPath, ["--input-type=module", "-e", script, dir], { encoding: "utf8", timeout: 20000, killSignal: "SIGKILL" });
    assert.equal(ran.error, undefined, `it waited: ${ran.error?.message}`);
    assert.equal(ran.status, 0, ran.stderr);
    assert.deepEqual(JSON.parse(ran.stdout), { here: true, words: [] });
    done();
  });
  it("reads no more than 2 MB and a byte of a file that grows after the look, and refuses it", () => {
    const dir = folder({ "index.html": SEEN });
    const file = join(dir, "index.html");
    let requested = 0;
    let grown = false;
    const io = {
      fstat: (fd) => {
        const found = fstatSync(fd);
        if (!grown) {
          grown = true;
          truncateSync(file, 60 * MB);
        }
        return found;
      },
      read: (fd, buffer, offset, length, position) => {
        requested += length;
        return readSync(fd, buffer, offset, length, position);
      }
    };
    assert.deepEqual(projectWords(dir, io), { here: true, words: [] });
    assert.ok(requested > 0 && requested <= 2 * MB + 1, `${requested} bytes were asked for`);
    done();
  });
  it("opens nothing that the look refuses: what is no file, or holds more than 2 MB", () => {
    for (const refused of [(found) => ({ isFile: () => false, size: found.size }), (found) => ({ isFile: () => true, size: 3 * MB })]) {
      const dir = folder({ "index.html": SEEN });
      let opened = 0;
      const io = {
        lstat: (path) => {
          const found = lstatSync(path);
          return { dev: found.dev, ino: found.ino, ...refused(found) };
        },
        open: (path, flags) => {
          opened += 1;
          return openSync(path, flags);
        }
      };
      assert.deepEqual(projectWords(dir, io), { here: true, words: [] });
      assert.equal(opened, 0);
    }
    done();
  });
  it("reads a file of exactly 2 MB, and not one of a byte more", () => {
    const exactly = (size) => {
      const head = `${SEEN}<!--`;
      return `${head}${"x".repeat(size - head.length - 3)}-->`;
    };
    assert.equal(Buffer.byteLength(exactly(2 * MB)), 2 * MB);
    assert.deepEqual(projectWords(folder({ "index.html": exactly(2 * MB) })).words, [{ text: "Seen", at: 1 }]);
    assert.deepEqual(projectWords(folder({ "index.html": exactly(2 * MB + 1) })).words, []);
    done();
  });
  it("reads nothing of a file that has grown past 2 MB by the time it is opened", () => {
    const dir = folder({ "index.html": SEEN });
    let requested = 0;
    const io = {
      ...afterLook((path) => truncateSync(path, 60 * MB)),
      read: (fd, buffer, offset, length, position) => {
        requested += length;
        return readSync(fd, buffer, offset, length, position);
      }
    };
    assert.deepEqual(projectWords(dir, io), { here: true, words: [] });
    assert.equal(requested, 0, "its size, as the descriptor gives it, is too much");
    done();
  });
  it("does not take what the descriptor says is another device, or no file, for the file looked at", () => {
    for (const change of [(found) => ({ dev: found.dev + 1 }), () => ({ isFile: () => false })]) {
      const dir = folder({ "index.html": SEEN });
      const io = { fstat: (fd) => { const found = fstatSync(fd); return { dev: found.dev, ino: found.ino, size: found.size, isFile: () => true, ...change(found) }; } };
      assert.deepEqual(projectWords(dir, io), { here: true, words: [] });
      assert.deepEqual(projectWords(dir, { fstat: (fd) => { const found = fstatSync(fd); return { dev: found.dev, ino: found.ino, size: found.size, isFile: () => true }; } }).words, [{ text: "Seen", at: 1 }], "and the same stand-in with nothing changed is the file");
    }
    done();
  });
  it("reads a file larger than one read, with a character across the boundary of two, whole", () => {
    const lead = '<!---->' + '<div class="clip" data-start="1" data-duration="2">Price 5';
    const padding = "x".repeat(65535 - Buffer.byteLength(lead));
    const page = `<!--${padding}-->` + '<div class="clip" data-start="1" data-duration="2">Price 5€ now</div>';
    const dir = folder({ "index.html": page });
    assert.equal(Buffer.byteLength(page.slice(0, page.indexOf("€"))), 65535, "its three bytes are the last of the first 64 KB and the first two of the next");
    assert.deepEqual(projectWords(dir).words, [{ text: "Price 5€ now", at: 1 }]);
    const big = folder({ "index.html": `<!--${"x".repeat(1900 * 1024)}-->${SEEN}` });
    assert.deepEqual(projectWords(big).words, [{ text: "Seen", at: 1 }]);
    done();
  });
  it("reads the bytes of a file once for two names of it, and the words of both hosts", () => {
    const a = composition("card", '<div class="clip" data-start="0" data-duration="2">Twice</div>');
    const dir = folder({ "index.html": projectOf(`${hostOf("one", "compositions/a.html", 3, 5)}${hostOf("two", "compositions/b.html", 30, 5)}`)["index.html"], "compositions/a.html": a });
    linkSync(join(dir, "compositions", "a.html"), join(dir, "compositions", "b.html"));
    const names = new Map();
    const reads = [];
    const opened = [];
    const closed = [];
    const base = realpathSync(dir);
    const io = {
      open: (path, flags) => {
        const fd = openSync(path, flags);
        names.set(fd, path);
        opened.push(fd);
        return fd;
      },
      read: (fd, buffer, offset, length, position) => {
        const got = readSync(fd, buffer, offset, length, position);
        if (got > 0) reads.push(names.get(fd).slice(base.length + 1));
        return got;
      },
      close: (fd) => {
        closed.push(fd);
        closeSync(fd);
      }
    };
    assert.deepEqual(projectWords(dir, io), { here: true, words: [{ text: "Twice", at: 3 }, { text: "Twice", at: 30 }] });
    assert.equal(reads.filter((rel) => rel.startsWith("compositions/")).length, 1, `read as ${reads.join(", ")}`);
    assert.equal(opened.length, 3, "index.html and both names");
    assert.deepEqual(closed, opened, "every file it opened, it closed, one at a time");
    done();
  });
});
