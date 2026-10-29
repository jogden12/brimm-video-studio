// The words on a HyperFrames project's picture (plan PR 8, groups A1 to A6; architecture 2026-10-27, section 8.5): which text elements of
// `index.html` and of the compositions its hosts name are words on the screen, when they appear, and what is never words (the captions,
// a picture, a hidden box). The files are made up in the shape of the ones the app wrote for A0 and A0b (fixtures/hyperframes-0.8.208/
// on-screen/); `wordsOnScreen` is pure over a `read` the test gives, and `projectWords` reads a project folder made in the test's own
// temporary folder. Nothing here touches the real BRIMM Video Work, Dropbox or Downloads, or the files A0 left.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  it("gives none for text outside every unit, in index.html and in the root of the main composition", () => {
    assert.deepEqual(wordsOf(projectOf("Plain text<div>More</div>")), []);
    assert.deepEqual(wordsOnScreen(() => '<html><body>Bare<div id="root" data-composition-id="main" data-start="0" data-duration="9">In the root</div></body></html>'), []);
  });
  it("gives none for a line of punctuation alone, or for one with nothing in it", () => {
    assert.deepEqual(wordsOf(projectOf('<div class="clip" data-start="1" data-duration="3"><p>***</p><p>   </p><p>•</p><p>2026</p></div>')), [{ text: "2026", at: 1 }]);
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
  it("stops reading a page at 200,000 elements: what comes after is not read", () => {
    const page = `<div id="root" data-composition-id="main" data-start="0" data-duration="9">${"<i></i>".repeat(210000)}<div class="clip" data-start="1" data-duration="2">After</div></div>`;
    assert.deepEqual(wordsOnScreen(() => page), []);
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
  it("gives only a cap of lines for a page that holds a great many", () => {
    const many = Array.from({ length: 3000 }, (_, i) => `<div class="clip" data-start="${i}" data-duration="1">Line ${i}</div>`).join("");
    const found = wordsOnScreen(() => `<div id="root" data-composition-id="main" data-start="0" data-duration="9000">${many}</div>`);
    assert.equal(found.length, 500);
    assert.equal(found[0].text, "Line 0");
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
  it("does not read a file of more than 2 MB", () => {
    const big = composition("card", `<div class="clip" data-start="0" data-duration="2">Big</div><!-- ${"x".repeat(2 * 1024 * 1024)} -->`);
    const dir = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/card.html": big });
    assert.deepEqual(projectWords(dir).words, []);
    const fine = folder({ "index.html": projectOf(host("card", 3, 5))["index.html"], "compositions/card.html": composition("card", `<div class="clip" data-start="0" data-duration="2">Small</div><!-- ${"x".repeat(1024 * 1024)} -->`) });
    assert.deepEqual(projectWords(fine).words, [{ text: "Small", at: 3 }]);
    done();
  });
  it("reads a composition in a folder of compositions/", () => {
    const dir = folder({ "index.html": projectOf(`<div id="card" data-composition-id="card" data-composition-src="compositions/sub/card.html" data-start="3" data-duration="5"></div>`)["index.html"], "compositions/sub/card.html": composition("card", '<div class="clip" data-start="0" data-duration="2">Nested</div>') });
    assert.deepEqual(projectWords(dir).words, [{ text: "Nested", at: 3 }]);
    done();
  });
});
