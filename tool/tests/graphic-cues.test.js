// A graphic cue (HyperFrames-led path, design 3): one of Sallie's points made visible with a short animated graphic or words on
// screen, tied to the words it goes with. What a cue is and how it is read, how its words become tokens, how it is placed on the
// words of a recording (the rule is in the brief of PR H1, and these tests check it), the file a project holds, an older plan's
// ideas as cues, and the markers a Final Cut file gets. No test here touches a disk or runs a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GRAPHIC_CUE_KINDS, SHOT_KINDS, CUE_SECONDS, graphicCuesOf, graphicCuesAsk, cueTokens, phraseSpans, keptIndexes, placeGraphicCues,
  graphicCuesJson, legacyCues, graphicCuesOfPlan, cueMarkers
} from "../graphic-cues.js";

/** A cue as the brief writes one. */
const WHOLE = { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of product boxes that keeps growing until it topples.", seconds: 4, style: null };
/** An entry as a reply or a package gives one, before it is a cue. */
const entry = (over = {}) => ({ words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, ...over });
/** A cue ready to be placed. */
const cue = (words, over = {}) => ({ n: 1, words, kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, ...over });
/** Words for a test, from a line such as "so we have too many SKUs": each takes a second, from 0, and has the id w0, w1, … unless
    `ids` is false. */
const said = (line, { ids = true } = {}) => line.split(" ").map((text, i) => ({ text, start: i, end: i + 0.5, ...(ids ? { id: `w${i}` } : {}) }));
/** Where a cue was placed, as ids. */
const where = (placed) => placed.map((p) => (p.at ? [p.at.from, p.at.to] : null));

describe("the kinds and the length of a graphic cue", () => {
  it("are the four kinds, the two a video already shot may have, and 4 seconds", () => {
    assert.deepEqual([...GRAPHIC_CUE_KINDS], ["graphic", "words", "b-roll", "screen"]);
    assert.deepEqual([...SHOT_KINDS], ["graphic", "words"]);
    assert.equal(CUE_SECONDS, 4);
  });
});

describe("graphicCuesOf: the cue", () => {
  it("keeps a whole cue, and numbers the cues from 1 in the order they are given, whatever number they came with", () => {
    const got = graphicCuesOf([{ ...WHOLE, n: 7 }, { ...WHOLE, n: 3, words: "pricing", kind: "words", show: "The word pricing.", seconds: 2.5 }]);
    assert.deepEqual(got, { cues: [WHOLE, { n: 2, words: "pricing", kind: "words", show: "The word pricing.", seconds: 2.5, style: null }], problems: [] });
    assert.deepEqual(Object.keys(got.cues[0]), ["n", "words", "kind", "show", "seconds", "style"]);
  });
  it("drops each entry with no words, no show, a kind outside the kinds, or a style with two keys, and says which with a problem for each", () => {
    const got = graphicCuesOf([
      entry({ words: "first" }),
      entry({ words: "   " }),
      entry({ show: "" }),
      entry({ kind: "b-roll" }),
      entry({ style: { ref: "boxes.png", link: "https://example.com/a" } }),
      entry({ words: "second" }),
      null,
      "too many SKUs",
      entry({ words: undefined }),
      entry({ kind: undefined })
    ]);
    assert.deepEqual(got.cues.map((c) => [c.n, c.words]), [[1, "first"], [2, "second"]]);
    assert.deepEqual(got.problems, [2, 3, 4, 5, 7, 8, 9, 10].map((n) => `Graphic cue ${n} could not be read.`));
  });
  it("gives the problem for the place an entry has in the list given, and the cues after it keep their own numbers from 1", () => {
    const got = graphicCuesOf([entry(), entry({ words: "" }), entry({ words: "two" })]);
    assert.deepEqual([got.cues.map((c) => c.n), got.problems], [[1, 2], ["Graphic cue 2 could not be read."]]);
  });
  it("reads a list that is not a list as no cues and no problem", () => {
    for (const given of [undefined, null, "cues", 3, {}]) assert.deepEqual(graphicCuesOf(given), { cues: [], problems: [] });
  });
  it("takes the kinds a video already shot has, unless it is told others, and then b-roll and screen recordings as well", () => {
    const all = ["graphic", "words", "b-roll", "screen", "movie", "Graphic", ""].map((kind) => entry({ kind, ...(kind === "b-roll" || kind === "screen" ? { shot: 2 } : {}) }));
    assert.deepEqual(graphicCuesOf(all).cues.map((c) => c.kind), ["graphic", "words"]);
    assert.deepEqual(graphicCuesOf(all, { kinds: GRAPHIC_CUE_KINDS }).cues.map((c) => c.kind), ["graphic", "words", "b-roll", "screen"]);
    assert.equal(graphicCuesOf(all, { kinds: GRAPHIC_CUE_KINDS }).problems.length, 3);
  });
  it("makes the length 4 seconds unless it is a number from 1 to 10", () => {
    const seconds = (given) => graphicCuesOf([entry({ seconds: given })]).cues[0].seconds;
    for (const given of [0, 0.9, 11, -3, "four", "5", null, undefined, NaN, Infinity, [4], {}]) assert.equal(seconds(given), 4, String(given));
    for (const given of [1, 2.5, 4, 8, 10]) assert.equal(seconds(given), given, String(given));
    assert.equal(graphicCuesOf([{ words: "a", kind: "graphic", show: "b" }]).cues[0].seconds, 4);
  });
  it("stops at the most it is given: thirteen cues give twelve, and the first twelve that can be read are the ones", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => entry({ words: `cue ${i + 1}` }));
    assert.equal(graphicCuesOf(thirteen).cues.length, 13);
    const twelve = graphicCuesOf(thirteen, { most: 12 });
    assert.deepEqual([twelve.cues.length, twelve.cues[11].words, twelve.problems], [12, "cue 12", []]);
    const bad = graphicCuesOf([entry({ words: "" }), ...thirteen], { most: 12 });
    assert.deepEqual([bad.cues.length, bad.cues[11].words, bad.problems], [12, "cue 12", ["Graphic cue 1 could not be read."]]);
    assert.deepEqual(graphicCuesOf(thirteen, { most: 0 }).cues, []);
  });
  it("has no style unless it is one of three: a file in the reference folder, an Inspiration video's name, or a link that is https", () => {
    const style = (given) => graphicCuesOf([entry({ style: given })]);
    assert.deepEqual(style(undefined).cues[0].style, null);
    assert.deepEqual(style(null).cues[0].style, null);
    assert.deepEqual(style({ ref: " boxes.png " }).cues[0].style, { ref: "boxes.png" });
    assert.deepEqual(style({ inspiration: "Kinetic type" }).cues[0].style, { inspiration: "Kinetic type" });
    assert.deepEqual(style({ link: "https://www.youtube.com/watch?v=abc" }).cues[0].style, { link: "https://www.youtube.com/watch?v=abc" });
  });
  it("refuses an http link, and any style that is not exactly one of the three: two keys, none, another key, an empty or other than text, a ref that is a path", () => {
    for (const given of [
      { link: "http://example.com/a" }, { link: "ftp://example.com/a" }, { link: "example.com/a" }, { link: "https://" }, { link: "https://exa mple.com" }, { link: "javascript:alert(1)" },
      { ref: "a.png", inspiration: "x" }, { ref: "a.png", link: "https://example.com" }, {}, { colour: "navy" }, { ref: "" }, { ref: "  " }, { ref: 3 }, { inspiration: null }, { link: ["https://example.com"] },
      { ref: "../secret.png" }, { ref: "folder/a.png" }, { ref: "/etc/passwd" }, { ref: "..\\a.png" }, { ref: ".env" },
      "https://example.com", ["https://example.com"], 3, true
    ]) {
      const got = graphicCuesOf([entry({ style: given })]);
      assert.deepEqual(got, { cues: [], problems: ["Graphic cue 1 could not be read."] }, JSON.stringify(given));
    }
  });
  it("keeps the phrase it was written for and the shot it shows, when they are text and a whole number from 1, and leaves them out otherwise", () => {
    const got = graphicCuesOf([entry({ phrase: "p7", shot: 2, kind: "b-roll" }), entry({ phrase: "  ", shot: 0 }), entry({ phrase: 7, shot: 1.5 }), entry({ phrase: " p3 ", shot: "2" }), entry({ shot: 1, kind: "screen" })], { kinds: GRAPHIC_CUE_KINDS });
    assert.deepEqual(got.cues.map((c) => [c.phrase, c.shot]), [["p7", 2], [undefined, undefined], [undefined, undefined], ["p3", undefined], [undefined, 1]]);
    assert.deepEqual(got.cues.map((c) => Object.keys(c)), [
      ["n", "words", "kind", "show", "seconds", "style", "phrase", "shot"], ["n", "words", "kind", "show", "seconds", "style"], ["n", "words", "kind", "show", "seconds", "style"],
      ["n", "words", "kind", "show", "seconds", "style", "phrase"], ["n", "words", "kind", "show", "seconds", "style", "shot"]
    ]);
    assert.equal(got.problems.length, 0);
  });
  it("reads its words and what it shows on one line, trimmed, and keeps the words as she wrote them, quotes, dollar signs and all", () => {
    const got = graphicCuesOf([entry({ words: '  "Fifty" per cent,\n  $5 | it\'s `fine` \\ ', show: " A line\n\nof  words. " })]);
    assert.deepEqual([got.cues[0].words, got.cues[0].show], ['"Fifty" per cent, $5 | it\'s `fine` \\', "A line of words."]);
  });
  it("cuts its words to 30 words and 200 characters, whole words, and what it shows to 300 characters", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    assert.equal(graphicCuesOf([entry({ words: long })]).cues[0].words, long.split(" ").slice(0, 30).join(" "));
    const wide = Array.from({ length: 20 }, () => "abcdefghij").join(" ");
    const cut = graphicCuesOf([entry({ words: wide })]).cues[0].words;
    assert.ok(cut.length <= 200 && wide.startsWith(cut) && cut.split(" ").every((w) => w === "abcdefghij"), cut);
    assert.equal(cut.split(" ").length, 18);
    assert.equal(graphicCuesOf([entry({ words: "x".repeat(250) })]).cues[0].words, "x".repeat(200));
    assert.equal(graphicCuesOf([entry({ show: "y".repeat(400) })]).cues[0].show, "y".repeat(300));
    assert.equal(graphicCuesOf([entry({ words: "a ".repeat(30).trim(), show: "z".repeat(300) })]).cues[0].show.length, 300);
  });
  it("does not change the entries it is given", () => {
    const given = [entry({ style: { link: "https://example.com" }, phrase: "p1" })];
    const before = JSON.stringify(given);
    graphicCuesOf(given, { most: 1 });
    assert.equal(JSON.stringify(given), before);
  });
});

describe("graphicCuesAsk: the line that asks for them", () => {
  const LINE = (most) => `- "graphicCues": at most ${most} {"id", "words", "kind", "show", "seconds"}, in the order they are said. Each makes one of her points visible with a short animated graphic or words on screen. "id" is the kept phrase it goes with; "words" are the words it goes with, copied exactly from that phrase; "kind" is "graphic" or "words"; "show" says what it shows, in one or two plain sentences, with things and words and never people; "seconds" is how long it stays, from 2 to 8 and usually 3 or 4.`;
  it("is the line, with the most spelled out", () => {
    assert.equal(graphicCuesAsk(12), LINE("twelve"));
    assert.equal(graphicCuesAsk(3), LINE("three"));
    assert.equal(graphicCuesAsk(1), LINE("one"));
  });
});

describe("cueTokens: words become tokens", () => {
  it("are lower case, with no comma, full stop, quotation mark or other mark, split on spaces", () => {
    assert.deepEqual(cueTokens('Too many SKUs, too many "products". (Really!) Yes?'), ["too", "many", "skus", "too", "many", "products", "really", "yes"]);
    assert.deepEqual(cueTokens("“Quoted” words… and ‘these’ — too"), ["quoted", "words", "and", "these", "too"]);
    assert.deepEqual(cueTokens("50% off, $5, 3.5"), ["50", "off", "5", "35"]);
  });
  it("keep an apostrophe inside a word, straight, whichever way it was written, and lose one at its edge", () => {
    assert.deepEqual(cueTokens("don’t don't DON’T"), ["don't", "don't", "don't"]);
    assert.deepEqual(cueTokens("rock'n'roll the dogs’ ‘tis 'quoted'"), ["rock'n'roll", "the", "dogs", "tis", "quoted"]);
    assert.deepEqual(cueTokens("it ʼs"), ["it", "s"]);
  });
  it("lose their accents", () => {
    assert.deepEqual(cueTokens("café Crème Brûlée naïve Zoë"), ["cafe", "creme", "brulee", "naive", "zoe"]);
    assert.deepEqual(cueTokens("café"), ["cafe"]);
  });
  it("are split on any number of spaces, tabs and line breaks, and none is made of nothing", () => {
    assert.deepEqual(cueTokens("  too   many\tSKUs\n\nhere  "), ["too", "many", "skus", "here"]);
    assert.deepEqual(cueTokens("— ... , ' ''"), []);
    assert.deepEqual(cueTokens(""), []);
  });
  it("are none for what is not text, and a number is its figures", () => {
    for (const given of [undefined, null, {}, []]) assert.deepEqual(cueTokens(given), []);
    assert.deepEqual(cueTokens(42), ["42"]);
  });
});

describe("phraseSpans and keptIndexes: where the plan's phrases are among its words", () => {
  const PHRASES = [
    { id: "p1", keep: false, words: [{ w: "a" }, { w: "b" }] },
    { id: "p2", keep: true, words: [{ w: "c" }] },
    { id: "p3", keep: true, words: [] },
    { id: "p4", words: [{ w: "d" }, { w: "e" }, { w: "f" }] },
    { id: "p5", keep: false, words: [{ w: "g" }] },
    { id: "p6" }
  ];
  it("count the words of each phrase in order, as the cut suggestions do: each phrase's first and last, and none for a phrase with no words", () => {
    assert.deepEqual([...phraseSpans(PHRASES)], [["p1", [0, 1]], ["p2", [2, 2]], ["p4", [3, 5]], ["p5", [6, 6]]]);
    assert.ok(phraseSpans(PHRASES) instanceof Map);
  });
  it("give the words of the phrases whose keep is not false, counted the same way", () => {
    assert.deepEqual([...keptIndexes(PHRASES)], [2, 3, 4, 5]);
    assert.ok(keptIndexes(PHRASES) instanceof Set);
  });
  it("are empty for a plan with no phrases", () => {
    for (const given of [undefined, null, [], "p1"]) assert.deepEqual([[...phraseSpans(given)], [...keptIndexes(given)]], [[], []]);
  });
});

describe("placeGraphicCues: placing a cue on the words said", () => {
  it("places an exact run with the ids and times of its first and last words", () => {
    const [placed] = placeGraphicCues([cue("too many SKUs")], said("so we have too many SKUs on the shelf"));
    assert.deepEqual(placed, { ...cue("too many SKUs"), at: { from: "w3", to: "w5", start: 3, end: 5.5 } });
  });
  it("gives a word with no id the id w<index>, and takes the id a word has", () => {
    assert.deepEqual(placeGraphicCues([cue("too many SKUs")], said("so we have too many SKUs on", { ids: false }))[0].at, { from: "w3", to: "w5", start: 3, end: 5.5 });
    const named = said("so we have too many SKUs on").map((w, i) => ({ ...w, id: `x${i * 10}` }));
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], named)), [["x30", "x50"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], [{ text: "too", start: 1, end: 2 }, { text: "many", start: 2, end: 3 }, { text: "SKUs", start: 3, end: 4, id: "z" }])), [["w0", "z"]]);
  });
  it("matches the words as tokens: not by case, commas, full stops, quotes, accents or the way an apostrophe is written", () => {
    const words = said("Don’t keep Too, many “SKUs.” at the Café").map((w, i) => ({ ...w, id: `w${i}` }));
    assert.deepEqual(where(placeGraphicCues([cue("too many skus")], words)), [["w2", "w4"]]);
    assert.deepEqual(where(placeGraphicCues([cue("don't keep")], words)), [["w0", "w1"]]);
    assert.deepEqual(where(placeGraphicCues([cue("the cafe")], words)), [["w6", "w7"]]);
  });
  it("skips a word that is no token, as a dash on its own", () => {
    const words = [{ text: "too", start: 0, end: 1 }, { text: "—", start: 1, end: 1.2 }, { text: "many", start: 1.2, end: 2 }, { text: "SKUs.", start: 2, end: 3 }];
    assert.deepEqual(placeGraphicCues([cue("too many SKUs")], words)[0].at, { from: "w0", to: "w3", start: 0, end: 3 });
  });
  it("places a loose run: 'too many products' for 'too many SKUs' is two of three tokens, and one of three is not found", () => {
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], said("so we have too many products here"))), [["w3", "w4"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], said("so we have too much stuff here"))), [null]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], said("so we have lots of SKUs here"))), [null]);
  });
  it("needs every token of a cue of one or two, and a loose run may have two words in it that the cue has not, and no more", () => {
    assert.deepEqual(where(placeGraphicCues([cue("big boxes")], said("a big red boxes here"))), [["w1", "w3"]]);
    assert.deepEqual(where(placeGraphicCues([cue("big boxes")], said("a big red tall boxes here"))), [["w1", "w4"]]);
    assert.deepEqual(where(placeGraphicCues([cue("big boxes")], said("a big red tall wide boxes here"))), [null]);
    assert.deepEqual(where(placeGraphicCues([cue("big boxes")], said("a big shoes here"))), [null]);
    assert.deepEqual(where(placeGraphicCues([cue("boxes")], said("a big boxes here"))), [["w2", "w2"]]);
    assert.deepEqual(where(placeGraphicCues([cue("pricing")], said("a big boxes here"))), [null]);
  });
  it("needs 3 of 4, 4 of 5 or 6, 7 of 10, and a loose run starts on one of the cue's first two tokens and is the cue's length plus two", () => {
    const four = cue("one two three four");
    assert.deepEqual(where(placeGraphicCues([four], said("one two x four y"))), [["w0", "w3"]]);
    assert.deepEqual(where(placeGraphicCues([four], said("one x x four y"))), [null]);
    // It may start on the second token: the first was not said.
    assert.deepEqual(where(placeGraphicCues([four], said("a two three four b"))), [["w1", "w3"]]);
    // But not on the third: nothing before it is a start.
    assert.deepEqual(where(placeGraphicCues([four], said("a b three four"))), [null]);
    // The cue's length plus two: of six, four are needed, and a run may be eight tokens long, from the first it starts on.
    assert.deepEqual(where(placeGraphicCues([cue("one two three four five six")], said("one two three x x five six"))), [["w0", "w6"]]);
    assert.deepEqual(where(placeGraphicCues([cue("one two three four five six")], said("one two x x x x x x five six"))), [null]);
    assert.deepEqual(where(placeGraphicCues([cue("one two three four five six")], said("one two x x x x five six"))), [["w0", "w7"]]);
    const ten = cue("a1 b2 c3 d4 e5 f6 g7 h8 i9 j10");
    assert.deepEqual(where(placeGraphicCues([ten], said("a1 b2 c3 x d4 e5 y f6 g7"))), [["w0", "w8"]]);
    assert.deepEqual(where(placeGraphicCues([ten], said("a1 b2 c3 x d4 e5 y f6"))), [null]);
  });
  it("lets a run be placed from its second token when that is the first it can be found by, with the span from the first token found to the last", () => {
    assert.deepEqual(where(placeGraphicCues([cue("one two three four five six")], said("go two three x five six now"))), [["w1", "w5"]]);
  });
  it("places 'The brim method' from a phrase the transcriber spelled its own way on a transcript that says 'The BRIMM method', as the project's words are spelled", () => {
    const spell = (text) => text.replace(/\bbrim\b/gi, "BRIMM");
    const words = said("learn the BRIMM method today");
    assert.deepEqual(where(placeGraphicCues([cue("The brim method")], words, { spell })), [["w1", "w3"]]);
    // Two tokens are all needed: only the spelling lets "brim method" be found on "BRIMM method".
    assert.deepEqual(where(placeGraphicCues([cue("brim method")], words, { spell })), [["w2", "w3"]]);
    assert.deepEqual(where(placeGraphicCues([cue("brim method")], words)), [null]);
  });
  it("places a script's 'BRIMM' on the same words, spelling or not", () => {
    const words = said("learn the BRIMM method today");
    const spell = (text) => text.replace(/\bbrim\b/gi, "BRIMM");
    for (const options of [{}, { spell }]) assert.deepEqual(where(placeGraphicCues([cue("The BRIMM method")], words, options)), [["w1", "w3"]]);
    // BRIMM is not 'brim' with an M after it, whole words only as the project's own spelling goes.
    assert.deepEqual(where(placeGraphicCues([cue("brimming method")], words, { spell })), [null]);
  });
  it("lands on the second time the words are said when the cue before it has the first: its search starts after the first word of the one placed before it", () => {
    const words = said("too many SKUs here and too many SKUs there");
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { n: 1 }), cue("too many SKUs", { n: 2 })], words)), [["w0", "w2"], ["w5", "w7"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { n: 1 }), cue("too many SKUs", { n: 2 }), cue("too many SKUs", { n: 3 })], words)), [["w0", "w2"], ["w5", "w7"], ["w0", "w2"]]);
  });
  it("places the cues in the order of their numbers, whatever the order they are given in, and gives them back in the order given", () => {
    const words = said("too many SKUs here and too many SKUs there");
    const placed = placeGraphicCues([cue("too many SKUs", { n: 2, show: "second" }), cue("too many SKUs", { n: 1, show: "first" })], words);
    assert.deepEqual(placed.map((p) => [p.show, p.at.from]), [["second", "w5"], ["first", "w0"]]);
  });
  it("starts the next search after the first word of the cue before it, not after its last, so a cue may begin inside the words of the one before", () => {
    const words = said("x many SKUs and y many SKUs and z");
    assert.deepEqual(where(placeGraphicCues([cue("x many SKUs and", { n: 1 }), cue("many SKUs and", { n: 2 })], words)), [["w0", "w3"], ["w1", "w3"]]);
  });
  it("lands where its phrase says, not on the first time the words are said", () => {
    const words = said("too many SKUs here and too many SKUs there");
    const spans = new Map([["p1", [0, 4]], ["p2", [5, 8]]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase: "p2" })], words, { spans })), [["w5", "w7"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase: "p1" })], words, { spans })), [["w0", "w2"]]);
    // With no phrase, or one the plan has not, it goes by its place in the order.
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase: "p9" })], words, { spans })), [["w0", "w2"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase: "p2" })], words)), [["w0", "w2"]]);
  });
  it("counts a run in its phrase before an exact one outside it, and one that fills only part of the phrase is not inside it", () => {
    const words = said("one two three four five six, then one two q r five six");
    const spans = new Map([["p1", [0, 5]], ["p2", [6, 12]]]);
    const run = "one two three four five six";
    // The loose run in p2 is the cue's own phrase's: it wins over the exact run before it.
    assert.deepEqual(where(placeGraphicCues([cue(run, { phrase: "p2" })], words, { spans })), [["w7", "w12"]]);
    assert.deepEqual(where(placeGraphicCues([cue(run)], words, { spans })), [["w0", "w5"]]);
    // A run across the edge of the phrase is not inside it.
    assert.deepEqual(where(placeGraphicCues([cue("five six then one", { phrase: "p1" })], words, { spans })), [["w4", "w7"]]);
  });
  it("loses a run inside a suggested cut to the same words in a kept take, and is placed in the cut when nothing else is found", () => {
    const words = said("too many SKUs here uh too many SKUs there");
    const kept = new Set([5, 6, 7, 8]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], words, { kept })), [["w5", "w7"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], words)), [["w0", "w2"]]);
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs")], said("so too many SKUs here"), { kept: new Set([3, 4]) })), [["w1", "w3"]]);
    // A run with a word of the cut in it is not wholly in kept words.
    assert.deepEqual(where(placeGraphicCues([cue("many SKUs here uh")], said("many SKUs here uh and many SKUs here uh"), { kept: new Set([4, 5, 6, 7, 8]) })), [["w5", "w8"]]);
    assert.deepEqual(where(placeGraphicCues([cue("many SKUs here")], said("many SKUs here and"), { kept: new Set([0, 2, 3]) })), [["w0", "w2"]]);
  });
  it("lands on the take she keeps when its words are in a retake a suggested cut takes out, whether it is given the phrase of the kept take or none", () => {
    const words = said("welcome to the show uh welcome to the show today");
    const spans = new Map([["p1", [0, 3]], ["p2", [4, 4]], ["p3", [5, 9]]]);
    const kept = new Set([5, 6, 7, 8, 9]);
    for (const phrase of [{}, { phrase: "p3" }]) assert.deepEqual(where(placeGraphicCues([cue("welcome to the show", phrase)], words, { spans, kept })), [["w5", "w8"]]);
  });
  it("ranks an exact run over a loose one, a higher count over a lower, and then the first at or after where it starts, and failing that the first", () => {
    const run = cue("one two three four five six");
    // Exact beats loose, though it is later.
    assert.deepEqual(where(placeGraphicCues([run], said("one two q r five six f1 f2 one two three four five six"))), [["w8", "w13"]]);
    // A higher count beats a lower, though it is later.
    assert.deepEqual(where(placeGraphicCues([run], said("one two q r five six f1 f2 f3 f4 f5 f6 one two three q five six"))), [["w12", "w17"]]);
    // The same count: the first at or after the start of the search.
    const twice = said("one two three four five six f1 f2 f3 one two three four five six");
    assert.deepEqual(where(placeGraphicCues([{ ...run, n: 1 }, { ...run, n: 2 }], twice)), [["w0", "w5"], ["w9", "w14"]]);
    // None at or after it: the first.
    assert.deepEqual(where(placeGraphicCues([{ ...run, n: 1 }, { ...run, n: 2 }], twice.slice(0, 6))), [["w0", "w5"], ["w0", "w5"]]);
  });
  it("is null for a cue that is not found, and the cues after it are still placed", () => {
    const words = said("so we have too many SKUs on the shelf");
    const placed = placeGraphicCues([cue("the moon landing", { n: 1 }), cue("many SKUs", { n: 2 }), cue("on the shelf", { n: 3 }), cue("the moon landing", { n: 4 })], words);
    assert.deepEqual(where(placed), [null, ["w4", "w5"], ["w6", "w8"], null]);
    assert.equal(placed[0].at, null);
  });
  it("is null for a cue with no words that make a token, and for words it is given none of", () => {
    const words = said("so we have too many SKUs");
    assert.deepEqual(where(placeGraphicCues([cue(""), cue("— ..."), { n: 3 }, cue(undefined), null], words)), [null, null, null, null, null]);
    assert.deepEqual(where(placeGraphicCues([cue("too many")], [])), [null]);
    assert.deepEqual(where(placeGraphicCues([cue("too many")], undefined)), [null]);
    assert.deepEqual(placeGraphicCues(undefined, words), []);
  });
  it("gives each cue back with the fields it had and an `at`, and changes neither the cues nor the words", () => {
    const cues = [cue("too many SKUs", { phrase: "p1", style: { ref: "boxes.png" }, shot: 2 })];
    const words = said("so we have too many SKUs on the shelf");
    const before = JSON.stringify([cues, words]);
    const [placed] = placeGraphicCues(cues, words, { spans: new Map([["p1", [0, 8]]]), kept: new Set([3, 4, 5]) });
    assert.deepEqual(placed, { ...cues[0], at: { from: "w3", to: "w5", start: 3, end: 5.5 } });
    assert.equal(JSON.stringify([cues, words]), before);
    assert.notEqual(placed, cues[0]);
  });
  it("takes the words of the episode as they are kept ({w, start, end}) as well as a project's transcript ({text, start, end, id})", () => {
    const heard = [{ w: "too", start: 1, end: 1.2 }, { w: "many", start: 1.2, end: 1.5 }, { w: "SKUs.", start: 1.5, end: 2 }];
    assert.deepEqual(placeGraphicCues([cue("too many SKUs")], heard)[0].at, { from: "w0", to: "w2", start: 1, end: 2 });
  });
  it("goes through a long recording quickly", () => {
    const filler = Array.from({ length: 60000 }, (_, i) => (i % 7 === 0 ? "the" : i % 11 === 0 ? "and" : `word${i % 997}`)).join(" ");
    const words = said(`${filler} too many SKUs ${filler}`);
    const started = Date.now();
    const placed = placeGraphicCues(Array.from({ length: 12 }, (_, i) => cue(i % 2 ? "the and the word5 word6 word7" : "too many SKUs here", { n: i + 1 })), words);
    assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
    assert.equal(placed.length, 12);
  });
});

describe("graphicCuesJson: brimm/graphic-cues.json", () => {
  it("is version 1, the clock, and the cues, with a new line after it, as cut-suggestions.json is", () => {
    const placed = placeGraphicCues([cue("too many SKUs"), cue("the moon", { n: 2 })], said("so too many SKUs"));
    const text = graphicCuesJson(placed, "recording");
    assert.equal(text, JSON.stringify({ version: 1, clock: "recording", cues: placed }, null, 2) + "\n");
    assert.deepEqual(JSON.parse(text), { version: 1, clock: "recording", cues: [{ ...cue("too many SKUs"), at: { from: "w1", to: "w3", start: 1, end: 3.5 } }, { ...cue("the moon", { n: 2 }), at: null }] });
    assert.deepEqual(Object.keys(JSON.parse(text)), ["version", "clock", "cues"]);
  });
  it("is empty of cues when it has none, and says a Reel's clock when it is one", () => {
    assert.deepEqual(JSON.parse(graphicCuesJson([], "recording")), { version: 1, clock: "recording", cues: [] });
    assert.equal(JSON.parse(graphicCuesJson([], "reel")).clock, "reel");
    assert.deepEqual(JSON.parse(graphicCuesJson(undefined, "recording")).cues, []);
  });
  it("refuses a clock that is neither", () => {
    for (const clock of [undefined, "timeline", "Recording", ""]) assert.throws(() => graphicCuesJson([], clock), /clock/, String(clock));
  });
});

describe("legacyCues: an older plan's ideas as cues", () => {
  const PHRASES = [
    { id: "p1", text: "Welcome to the show." },
    { id: "p2", text: "So the first thing you need to do is know your costs." },
    { id: "p3", text: "It is very, very important." }
  ];
  it("makes each idea a graphic cue of its phrase's words, with its idea to show, 4 seconds and the phrase it sat on, numbered from 1", () => {
    const got = legacyCues([{ id: "p2", idea: "A chart of what it costs." }, { id: "p1", idea: "The show's name." }], PHRASES);
    assert.deepEqual(got, [
      { n: 1, words: "Welcome to the show.", kind: "graphic", show: "The show's name.", seconds: 4, style: null, phrase: "p1" },
      { n: 2, words: "So the first thing you need to do is know your costs.", kind: "graphic", show: "A chart of what it costs.", seconds: 4, style: null, phrase: "p2" }
    ]);
  });
  it("cuts the words to the phrase's first 30 words and 200 characters, whole words", () => {
    const many = Array.from({ length: 45 }, (_, i) => `w${i}`).join(" ");
    assert.equal(legacyCues([{ id: "p1", idea: "A list." }], [{ id: "p1", text: many }])[0].words, many.split(" ").slice(0, 30).join(" "));
    const wide = Array.from({ length: 20 }, () => "abcdefghijklmno").join(" ");
    // Twelve of them are 191 characters, and a thirteenth would make 207.
    assert.equal(legacyCues([{ id: "p1", idea: "A list." }], [{ id: "p1", text: wide }])[0].words, Array(12).fill("abcdefghijklmno").join(" "));
  });
  it("leaves out an idea whose phrase the plan has not, or has no words, and says nothing of it", () => {
    assert.deepEqual(legacyCues([{ id: "p99", idea: "Nowhere." }, { id: "p4", idea: "Nothing." }, { id: "p3", idea: "The word." }], [...PHRASES, { id: "p4", text: "" }]).map((c) => c.phrase), ["p3"]);
    for (const given of [undefined, null, [], "p1", [null, 3, {}]]) assert.deepEqual(legacyCues(given, PHRASES), []);
    assert.deepEqual(legacyCues([{ id: "p1", idea: "x" }], undefined), []);
  });
  it("is in the order the phrases are in, and the order given for two ideas on one phrase", () => {
    const got = legacyCues([{ id: "p3", idea: "c" }, { id: "p1", idea: "a1" }, { id: "p3", idea: "d" }, { id: "p1", idea: "a2" }], PHRASES);
    assert.deepEqual(got.map((c) => [c.n, c.phrase, c.show]), [[1, "p1", "a1"], [2, "p1", "a2"], [3, "p3", "c"], [4, "p3", "d"]]);
  });
});

/** A plan of the made-up recording "so we have too many SKUs here uh too many SKUs there today": the first take of "too many SKUs"
    is a retake, and is cut. */
const PLAN_WORDS = said("so we have too many SKUs here uh too many SKUs there today");
const planOf = (claude) => ({
  phrases: [
    { id: "p1", keep: true, text: "so we have", words: PLAN_WORDS.slice(0, 3) },
    { id: "p2", keep: false, text: "too many SKUs here uh", words: PLAN_WORDS.slice(3, 8) },
    { id: "p3", keep: true, text: "too many SKUs there today", words: PLAN_WORDS.slice(8) }
  ],
  ...(claude ? { claude } : {})
});

describe("graphicCuesOfPlan: the cues a cut plan holds", () => {
  it("are its claude.graphicCues, and else its claude.graphics as legacyCues makes them, and none when it holds neither", () => {
    const cues = [cue("too many SKUs", { phrase: "p3" })];
    assert.deepEqual(graphicCuesOfPlan(planOf({ graphicCues: cues })), cues);
    assert.deepEqual(graphicCuesOfPlan(planOf({ graphics: [{ id: "p3", idea: "Boxes." }] })), legacyCues([{ id: "p3", idea: "Boxes." }], planOf().phrases));
    assert.deepEqual(graphicCuesOfPlan(planOf({ graphicCues: [], graphics: [{ id: "p3", idea: "Boxes." }] })), []);
    for (const plan of [planOf({}), planOf(), null, undefined, { claude: null }, { claude: { graphicCues: "none" } }]) assert.deepEqual(graphicCuesOfPlan(plan), []);
  });
});

describe("cueMarkers: the Final Cut file's notes", () => {
  const WORDS = PLAN_WORDS.map((w, i) => ({ ...w, start: 10 + i, end: 10.5 + i }));
  it("are 'Graphic idea: <show>' at the start of each cue placed in kept words", () => {
    const plan = planOf({ graphicCues: [cue("too many SKUs there", { n: 1, show: "A stack of boxes.", phrase: "p3" }), cue("here uh", { n: 2, show: "Cut words." })] });
    assert.deepEqual(cueMarkers(plan, WORDS), [{ at: 18, text: "Graphic idea: A stack of boxes." }]);
  });
  it("are none for a cue that was not placed, and none for one placed only inside a cut, which would land on a join", () => {
    const plan = planOf({ graphicCues: [cue("the moon landing", { n: 1 }), cue("uh", { n: 2, show: "In the cut." }), cue("here uh too", { n: 3, show: "Across the edge." })] });
    assert.deepEqual(cueMarkers(plan, WORDS), []);
  });
  it("go to the take that is kept when the same words are said in a retake that is cut", () => {
    const plan = planOf({ graphicCues: [cue("too many SKUs", { n: 1, show: "Boxes." })] });
    assert.deepEqual(cueMarkers(plan, WORDS), [{ at: 18, text: "Graphic idea: Boxes." }]);
    assert.deepEqual(cueMarkers(planOf({ graphicCues: [cue("too many SKUs", { n: 1, show: "Boxes.", phrase: "p3" })] }), WORDS), [{ at: 18, text: "Graphic idea: Boxes." }]);
  });
  it("come from an older plan's ideas when it holds no cues: one at the start of each idea's phrase, none for an idea whose phrase is cut", () => {
    const plan = planOf({ graphics: [{ id: "p1", idea: "The first line." }, { id: "p2", idea: "On the cut." }, { id: "p3", idea: "The last line." }, { id: "p99", idea: "Nowhere." }] });
    assert.deepEqual(cueMarkers(plan, WORDS), [{ at: 10, text: "Graphic idea: The first line." }, { at: 18, text: "Graphic idea: The last line." }]);
  });
  it("are none for a plan with no cues or ideas, and take the words of the episode as they are kept ({w, start, end}) as well", () => {
    assert.deepEqual(cueMarkers(planOf(), WORDS), []);
    assert.deepEqual(cueMarkers(null, WORDS), []);
    const plan = planOf({ graphicCues: [cue("too many SKUs there", { phrase: "p3", show: "Boxes." })] });
    assert.deepEqual(cueMarkers(plan, WORDS.map(({ text, start, end }) => ({ w: text, start, end }))), [{ at: 18, text: "Graphic idea: Boxes." }]);
  });
  it("keep the cue's words as the plan's phrases keep them, whatever the cut a person asked for later (a phrase turned to cut or kept again)", () => {
    const plan = planOf({ graphicCues: [cue("too many SKUs there", { phrase: "p3", show: "Boxes." })] });
    const recut = { ...plan, phrases: plan.phrases.map((p) => (p.id === "p3" ? { ...p, keep: false } : p)) };
    assert.deepEqual(cueMarkers(recut, WORDS), []);
  });
});
