// A graphic cue (HyperFrames-led path, design 3): one of Sallie's points made visible with a short animated graphic or words on
// screen, tied to the words it goes with. What a cue is and how it is read, how its words become tokens, how it is placed on the
// words of a recording (the rule is in the brief of PR H1, and these tests check it), the file a project holds, an older plan's
// ideas as cues, and the markers a Final Cut file gets. No test here touches a disk or runs a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GRAPHIC_CUE_KINDS, SHOT_KINDS, CUE_SECONDS, CLIP_CUES_MOST, REEL_CUES_MOST, REEL_EDGE_SLACK, graphicCuesOf, graphicCuesAsk, graphicCuesInReply, cueTokens, phraseSpans, keptPhraseSpans, keptIndexes, placeGraphicCues,
  reelGraphicCues, graphicCuesJson, legacyCues, graphicCuesOfPlan, graphicCuesOfRecord, graphicCuesInPlan
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
  it("give, for the spans of the kept phrases alone, the spans phraseSpans gives of the phrases whose keep is not false, counted over all the words", () => {
    assert.deepEqual([...keptPhraseSpans(PHRASES)], [["p2", [2, 2]], ["p4", [3, 5]]]);
    assert.ok(keptPhraseSpans(PHRASES) instanceof Map);
    for (const given of [undefined, null, [], "p1"]) assert.deepEqual([...keptPhraseSpans(given)], []);
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
  it("counts a phrase that is cut as no phrase when it is given the spans of the kept phrases alone: the kept words first, and the cut only when the words are said nowhere else", () => {
    // A retake the plan cuts (p2, words 0 to 4) and the take it keeps (p3, words 5 to 8), then a phrase that is said once, in the cut.
    const words = said("too many SKUs here uh too many SKUs there bye uh now");
    const phrases = [
      { id: "p2", keep: false, words: words.slice(0, 5) },
      { id: "p3", keep: true, words: words.slice(5, 9) },
      { id: "p4", keep: false, words: words.slice(9) }
    ];
    const options = { spans: keptPhraseSpans(phrases), kept: keptIndexes(phrases) };
    // Naming the cut retake's phrase is naming none: the cue is on the take that is kept.
    for (const phrase of ["p2", "p3", "p9", undefined]) assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase })], words, options)), [["w5", "w7"]], String(phrase));
    // Said nowhere else, it is in the cut, which is the fallback.
    assert.deepEqual(where(placeGraphicCues([cue("uh now", { phrase: "p4" })], words, options)), [["w10", "w11"]]);
    // Given the spans of every phrase, as placeGraphicCues is by default for a caller that gives them, a cue is first in its own phrase.
    assert.deepEqual(where(placeGraphicCues([cue("too many SKUs", { phrase: "p2" })], words, { spans: phraseSpans(phrases), kept: keptIndexes(phrases) })), [["w0", "w2"]]);
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

describe("graphicCuesInPlan: where the cues of a plan are, among the plan's own words", () => {
  const WORDS = PLAN_WORDS.map((w, i) => ({ ...w, start: 10 + i, end: 10.5 + i }));
  it("gives each cue back, in the order given, with where its words are: their start and end, or null when they are not found, and whether they are all in kept words", () => {
    const cues = [
      cue("too many SKUs there", { n: 1, phrase: "p3" }),
      cue("here uh", { n: 2 }),
      cue("the moon landing", { n: 3 }),
      cue("here uh too", { n: 4 })
    ];
    const got = graphicCuesInPlan(cues, planOf(), WORDS);
    assert.deepEqual(got.map((g) => g.cue), cues);
    assert.deepEqual(got.map(({ cue: c, at, kept }) => [c.n, at, kept]), [
      [1, { start: 18, end: 21.5 }, true],
      // Said in the retake that is cut, and nowhere else.
      [2, { start: 16, end: 17.5 }, false],
      [3, null, false],
      // Across the edge of the cut: not wholly in kept words.
      [4, { start: 16, end: 18.5 }, false]
    ]);
  });
  it("puts a cue that names the retake's phrase, which is cut, on the take that is kept, and its words are all in kept words", () => {
    const [got] = graphicCuesInPlan([cue("too many SKUs", { phrase: "p2" })], planOf(), WORDS);
    assert.deepEqual([got.at, got.kept], [{ start: 18, end: 20.5 }, true]);
  });
  it("keeps an older plan's idea on its own phrase when it is told the cues are an older plan's, kept or cut as that phrase is", () => {
    const words = said("too many SKUs uh too many SKUs").map((w, i) => ({ ...w, start: 10 + i, end: 10.5 + i }));
    const plan = { phrases: [{ id: "p1", keep: false, text: "too many SKUs uh", words: words.slice(0, 4) }, { id: "p2", keep: true, text: "too many SKUs", words: words.slice(4) }] };
    const ideas = legacyCues([{ id: "p1", idea: "On the retake." }], plan.phrases);
    assert.deepEqual(graphicCuesInPlan(ideas, plan, words, { older: true }).map((g) => [g.at.start, g.kept]), [[10, false]]);
    assert.deepEqual(graphicCuesInPlan(ideas, plan, words).map((g) => [g.at.start, g.kept]), [[14, true]]);
  });
  it("takes the words of the episode as they are kept ({w, start, end}), and finds nothing in no words or no cues", () => {
    const cues = [cue("too many SKUs there", { phrase: "p3" })];
    assert.deepEqual(graphicCuesInPlan(cues, planOf(), WORDS.map(({ text, start, end }) => ({ w: text, start, end }))).map((g) => g.kept), [true]);
    assert.deepEqual(graphicCuesInPlan(cues, planOf(), []).map((g) => [g.at, g.kept]), [[null, false]]);
    assert.deepEqual(graphicCuesInPlan(cues, planOf(), undefined).map((g) => [g.at, g.kept]), [[null, false]]);
    assert.deepEqual(graphicCuesInPlan([], planOf(), WORDS), []);
    assert.deepEqual(graphicCuesInPlan(undefined, planOf(), WORDS), []);
  });
});

// --- PR H2: the cues in a reply, an iPhone clip's in its record, and a Reel's ---

describe("graphicCuesOfRecord: the cues an iPhone clip's reading kept in its record (PR H2)", () => {
  const KEPT = [
    { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, phrase: "p2" },
    { n: 2, words: "pricing", kind: "words", show: "The word pricing.", seconds: 3, style: null, phrase: "p5" }
  ];
  /** A clip's record with its reading, as the reading writes it. */
  const clip = (graphicCues, over = {}) => ({ kind: "short video", reading: { kind: "short video", model: "m", at: "2026-10-20T15:00:00-05:00", on: "Mac Studio", account: "", outcome: "read", about: "A clip.", graphicCues, ...over } });
  it("are three at most, as a clip is asked for", () => {
    assert.equal(CLIP_CUES_MOST, 3);
  });
  it("are the record's reading.graphicCues, as they were read", () => {
    assert.deepEqual(graphicCuesOfRecord(clip(KEPT)), KEPT);
  });
  it("are read again as cues are read: numbered from 1, a video already shot's kinds only, and three at most, so a record changed by hand puts nothing else in a project", () => {
    const four = ["one", "two", "three", "four"].map((words, i) => ({ n: 9 - i, words, kind: "graphic", show: `Card ${i}.`, seconds: 3, style: null }));
    assert.deepEqual(graphicCuesOfRecord(clip(four)).map((c) => [c.n, c.words]), [[1, "one"], [2, "two"], [3, "three"]]);
    const odd = [{ words: "b-roll", kind: "b-roll", show: "A shot.", shot: 1 }, null, "words", { words: "", kind: "graphic", show: "x" }, { words: "fine", kind: "words", show: "A card.", style: { ref: "../../x.png" } }, KEPT[0]];
    assert.deepEqual(graphicCuesOfRecord(clip(odd)).map((c) => [c.n, c.words]), [[1, "too many SKUs"]]);
  });
  it("are none for a record that has no reading, a reading of another kind, a reading with no list of cues, an empty one, and what is not a record", () => {
    assert.deepEqual(graphicCuesOfRecord({ kind: "short video" }), []);
    assert.deepEqual(graphicCuesOfRecord(clip(KEPT, { kind: "finished" })), []);
    assert.deepEqual(graphicCuesOfRecord(clip(KEPT, { kind: "raw" })), []);
    for (const given of [undefined, null, "none", {}, 3, KEPT[0]]) assert.deepEqual(graphicCuesOfRecord(clip(given)), [], String(given));
    assert.deepEqual(graphicCuesOfRecord(clip([])), []);
    for (const given of [undefined, null, "record", 7, [], { reading: null }, { reading: "read" }]) assert.deepEqual(graphicCuesOfRecord(given), [], JSON.stringify(given));
  });
  it("do not change the record", () => {
    const record = clip(KEPT);
    const before = JSON.stringify(record);
    graphicCuesOfRecord(record);
    assert.equal(JSON.stringify(record), before);
  });
});

describe("graphicCuesInReply: the cues in what Claude replied", () => {
  const reply = (graphicCues) => ({ graphicCues });
  const given = (over = {}) => ({ id: "p7", words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, ...over });
  it("reads each as a cue of the five things it was asked for, its id being the phrase it was written for, and numbers them from 1", () => {
    const got = graphicCuesInReply(reply([given(), given({ id: "p9", words: "pricing", kind: "words", show: "The word pricing.", seconds: 3 })]), 3);
    assert.deepEqual(got, {
      cues: [
        { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, phrase: "p7" },
        { n: 2, words: "pricing", kind: "words", show: "The word pricing.", seconds: 3, style: null, phrase: "p9" }
      ],
      problems: []
    });
  });
  it("reads no more than the most it is told, and keeps the first ones that can be read", () => {
    const four = ["one", "two", "three", "four"].map((words) => given({ words }));
    assert.deepEqual(graphicCuesInReply(reply(four), 3).cues.map((c) => c.words), ["one", "two", "three"]);
    assert.deepEqual(graphicCuesInReply(reply(four), 12).cues.map((c) => c.words), ["one", "two", "three", "four"]);
    assert.deepEqual(graphicCuesInReply(reply([given({ id: "" }), ...four]), 3).cues.map((c) => c.words), ["one", "two", "three"]);
  });
  it("leaves out an entry with no id, and says which by its place in the list", () => {
    const got = graphicCuesInReply(reply([given({ id: undefined }), given(), null, "too many SKUs", given({ id: "  " }), given({ show: "" })]), 12);
    assert.deepEqual(got.cues.map((c) => c.n), [1]);
    assert.deepEqual(got.problems, [1, 3, 4, 5, 6].map((n) => `Graphic cue ${n} could not be read.`));
  });
  it("reads only the five things asked for: a style, a shot or a number of its own in the reply are not read", () => {
    const [read] = graphicCuesInReply(reply([given({ style: { link: "https://example.com/a" }, shot: 2, n: 9, phrase: "p1" })]), 3).cues;
    assert.deepEqual(read, { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, phrase: "p7" });
  });
  it("says the reply has none, or that none is a list, and reads nothing from either", () => {
    assert.deepEqual(graphicCuesInReply({}, 3), { cues: [], problems: ['Its reply has no "graphicCues".'] });
    assert.deepEqual(graphicCuesInReply({ spellings: [] }, 3), { cues: [], problems: ['Its reply has no "graphicCues".'] });
    for (const odd of ["too many SKUs", {}, 3, null]) assert.deepEqual(graphicCuesInReply(reply(odd), 3), { cues: [], problems: ['"graphicCues" in its reply is not a list, so nothing was read from it.'] }, String(odd));
    assert.deepEqual(graphicCuesInReply(reply([]), 3), { cues: [], problems: [] });
  });
});

describe("reelGraphicCues: a Reel's cues, from the cues placed on the recording", () => {
  /** A recording said from 300 s: word i is "word<i>", starts at 300 + i ÷ 2 and takes 0.4 s, with the id w<i>. */
  const RECORDING = Array.from({ length: 120 }, (_, i) => ({ text: `word${i}`, start: 300 + i / 2, end: 300 + i / 2 + 0.4, id: `w${i}` }));
  /** The Reel from 312.4 s to 340 s. Its words are the recording's whose middle is inside it, on its own clock from 0, with the ids w0, w1, …
      (project.js reelWords and transcriptJson): the recording's words 25 to 79, as the Reel's w0 to w54. */
  const STRETCH = { start: 312.4, end: 340 };
  const thousandth = (t) => Math.round(t * 1000) / 1000;
  /** The Reel's words as project.js reelWords makes them: a word that starts before the stretch starts at 0, and one that ends after it
      ends at the Reel's length. */
  const reelOf = (words, { start, end }) => words
    .filter((w) => (w.start + w.end) / 2 >= start && (w.start + w.end) / 2 <= end)
    .map((w, i) => ({ text: w.text, start: Math.max(0, thousandth(w.start - start)), end: Math.min(thousandth(end - start), thousandth(w.end - start)), id: `w${i}` }));
  const REEL = reelOf(RECORDING, STRETCH);
  /** A cue on words i to j of the recording. */
  const on = (n, i, j, over = {}) => cue(RECORDING.slice(i, j + 1).map((w) => w.text).join(" "), { n, ...over });
  const placedOn = (cues, words = RECORDING, options = {}) => placeGraphicCues(cues, words, options);

  it("has the Reel's words as the words 25 to 79 of the recording", () => {
    assert.deepEqual([REEL.length, REEL[0], REEL[54]], [55, { text: "word25", start: 0.1, end: 0.5, id: "w0" }, { text: "word79", start: 27.1, end: 27.5, id: "w54" }]);
  });
  it("puts a cue at 320 s on the Reel's own clock, at 7.6 s, with the Reel's ids", () => {
    const placed = placedOn([on(1, 40, 42)]);
    assert.deepEqual(placed[0].at, { from: "w40", to: "w42", start: 320, end: 321.4 });
    const got = reelGraphicCues(placed, STRETCH, REEL);
    assert.deepEqual(got, [{ ...on(1, 40, 42), at: { from: "w15", to: "w17", start: 7.6, end: 9 } }]);
    assert.equal(got[0].at.start, REEL.find((w) => w.id === "w15").start);
  });
  it("leaves out a cue whose words start before the stretch, and one that runs past its end", () => {
    const placed = placedOn([on(1, 22, 24), on(2, 40, 42), on(3, 78, 81), on(4, 24, 26), on(5, 77, 79)]);
    // Word 22 starts at 311 s, and word 24 at 312, before the Reel does at 312.4; word 81 ends at 340.9, after it ends at 340.
    assert.deepEqual(placed.map((c) => [c.at.start, c.at.end]), [[311, 312.4], [320, 321.4], [339, 340.9], [312, 313.4], [338.5, 339.9]]);
    assert.deepEqual(reelGraphicCues(placed, STRETCH, REEL).map((c) => [c.n, c.at.from, c.at.to]), [[2, "w15", "w17"], [5, "w52", "w54"]]);
  });
  it("keeps a cue whose first word starts at the stretch's start and a cue whose last word ends at its end", () => {
    const stretch = { start: 312.5, end: 339.9 };
    const words = reelOf(RECORDING, stretch);
    const placed = placedOn([on(1, 25, 27), on(2, 77, 79)]);
    assert.deepEqual([placed[0].at.start, placed[1].at.end], [312.5, 339.9]);
    assert.deepEqual(reelGraphicCues(placed, stretch, words).map((c) => [c.n, c.at.from, c.at.to, c.at.start, c.at.end]), [[1, "w0", "w2", 0, 1.4], [2, "w52", "w54", 26, 27.4]]);
  });
  describe("with the slack of a Reel's ends, which are on pictures", () => {
    // A Reel's ends are moved to the nearest picture (cuts.js keptSpans), so a word that starts where a phrase does can start a few
    // thousandths before the stretch, and one that ends where a phrase does can end a few thousandths after it: the Reel holds both
    // words (the middle of a word decides), and their times are cut to the Reel's ends (project.js reelWords).
    const SLACK = 0.05;
    const HAIR = { start: 312.51, end: 339.89 };
    const hairReel = reelOf(RECORDING, HAIR);
    it("is a twentieth of a second", () => {
      assert.equal(REEL_EDGE_SLACK, SLACK);
    });
    it("leaves out a cue a hair outside the stretch unless it is told the slack, and takes it when it is", () => {
      // Words 25 and 79 are the Reel's first and last: word 25 starts at 312.5 and word 79 ends at 339.9, outside by 0.01 s.
      const placed = placedOn([on(1, 25, 26), on(2, 78, 79)]);
      assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel), []);
      assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel, { slack: 0 }), []);
      assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel, { slack: SLACK }).map((c) => [c.n, c.at.from, c.at.to]), [[1, "w0", "w1"], [2, "w53", "w54"]]);
    });
    it("puts such a cue on the Reel's words by their clamped times: the first starts at 0, and the last ends at the Reel's length", () => {
      const placed = placedOn([on(1, 25, 26), on(2, 78, 79)]);
      const got = reelGraphicCues(placed, HAIR, hairReel, { slack: SLACK });
      assert.deepEqual([got[0].at.start, got[0].at.end, got[1].at.start, got[1].at.end], [0, 0.89, 26.49, 27.38]);
      assert.equal(got[1].at.end, hairReel[54].end);
    });
    it("lands such a cue on the take it was placed on when the same words are said again: the clamped times steer it", () => {
      const words = RECORDING.map((w, i) => (i === 25 || i === 26 || i === 50 || i === 51 ? { ...w, text: `again${i % 25}` } : w));
      const reel = reelOf(words, HAIR);
      /** The words that are kept when the take at `a` and `b` is the one cut. */
      const keptWithout = (a, b) => new Set(Array.from({ length: 120 }, (_, i) => i).filter((i) => i !== a && i !== b));
      const first = placedOn([cue("again0 again1")], words, { kept: keptWithout(50, 51) });
      assert.equal(first[0].at.from, "w25");
      assert.deepEqual(reelGraphicCues(first, HAIR, reel, { slack: SLACK }).map((c) => [c.at.from, c.at.to, c.at.start]), [["w0", "w1", 0]]);
      const second = placedOn([cue("again0 again1")], words, { kept: keptWithout(25, 26) });
      assert.equal(second[0].at.from, "w50");
      assert.deepEqual(reelGraphicCues(second, HAIR, reel, { slack: SLACK }).map((c) => [c.at.from, c.at.to]), [["w25", "w26"]]);
    });
    it("still leaves out a cue that starts well before the stretch, or ends well after it, as a cue far from its edges", () => {
      const placed = placedOn([on(1, 22, 24), on(2, 80, 81), on(3, 24, 26), on(4, 79, 80)]);
      // Word 24 starts at 312 s, 0.51 s before the stretch; word 80 ends at 340.4 s, 0.51 s after it.
      assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel, { slack: SLACK }), []);
    });
    it("counts the cues it takes in the three, as it does without the slack", () => {
      const placed = placedOn([on(1, 25, 26), on(2, 30, 31), on(3, 35, 36), on(4, 40, 41)]);
      assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel, { slack: SLACK }).map((c) => c.n), [1, 2, 3]);
    });
    it("takes a slack that is none as none", () => {
      const placed = placedOn([on(1, 25, 26)]);
      for (const slack of [undefined, null, -1, NaN, "0.05", Infinity]) assert.deepEqual(reelGraphicCues(placed, HAIR, hairReel, { slack }), [], String(slack));
    });
  });
  it("takes the first three of five cues inside the stretch, in the order given", () => {
    const placed = placedOn([30, 35, 40, 45, 50].map((i, k) => on(k + 1, i, i + 1)));
    const got = reelGraphicCues(placed, STRETCH, REEL);
    assert.deepEqual(got.map((c) => [c.n, c.at.from]), [[1, "w5"], [2, "w10"], [3, "w15"]]);
    assert.equal(REEL_CUES_MOST, 3);
  });
  it("counts the three among the cues that are inside the stretch, so a cue outside it takes no place", () => {
    const placed = placedOn([on(1, 22, 23), on(2, 30, 31), on(3, 35, 36), on(4, 40, 41), on(5, 45, 46)]);
    assert.deepEqual(reelGraphicCues(placed, STRETCH, REEL).map((c) => c.n), [2, 3, 4]);
  });
  it("leaves out a cue that was not found on the recording", () => {
    const placed = placedOn([cue("the moon landing", { n: 1 }), on(2, 40, 42)]);
    assert.equal(placed[0].at, null);
    assert.deepEqual(reelGraphicCues(placed, STRETCH, REEL).map((c) => c.n), [2]);
  });
  it("lands on the time the cue was said at when the same words are said twice in the Reel, as on the recording", () => {
    // The words are said at 7.6 s into the Reel and again at 17.6 s. On the recording the cue was placed on the take that is kept.
    const words = RECORDING.map((w, i) => (i >= 40 && i <= 42 ? { ...w, text: `again${i - 40}` } : i >= 60 && i <= 62 ? { ...w, text: `again${i - 60}` } : w));
    const reel = reelOf(words, STRETCH);
    const keeping = (cut) => new Set(Array.from({ length: 120 }, (_, i) => i).filter((i) => i < cut || i > cut + 2));
    const secondKept = placedOn([cue("again0 again1 again2")], words, { kept: keeping(40) });
    assert.equal(secondKept[0].at.from, "w60");
    assert.deepEqual(reelGraphicCues(secondKept, STRETCH, reel).map((c) => [c.at.from, c.at.to, c.at.start]), [["w35", "w37", 17.6]]);
    const firstKept = placedOn([cue("again0 again1 again2")], words, { kept: keeping(60) });
    assert.equal(firstKept[0].at.from, "w40");
    assert.deepEqual(reelGraphicCues(firstKept, STRETCH, reel).map((c) => [c.at.from, c.at.to, c.at.start]), [["w15", "w17", 7.6]]);
  });
  it("places a cue by its words, on the Reel's own words, when none of them starts where it did", () => {
    const placed = placedOn([on(1, 40, 42)]);
    // A Reel whose clock is not the stretch's: no word starts where the cue did on its clock.
    const odd = REEL.map((w) => ({ ...w, start: w.start + 0.25, end: w.end + 0.25 }));
    assert.deepEqual(reelGraphicCues(placed, STRETCH, odd).map((c) => [c.at.from, c.at.to, c.at.start]), [["w15", "w17", 7.85]]);
  });
  it("is null for a cue whose words the Reel's words do not hold, and still gives the others", () => {
    const placed = placedOn([on(1, 40, 42), on(2, 50, 51)]);
    const without = REEL.map((w) => (w.id === "w25" || w.id === "w26" ? { ...w, text: "gone" } : w));
    assert.deepEqual(reelGraphicCues(placed, STRETCH, without).map((c) => [c.n, c.at && c.at.from]), [[1, "w15"], [2, null]]);
  });
  it("spells the cue's words as the Reel's words are spelled, so a cue from an unspelled phrase finds its words", () => {
    const words = RECORDING.map((w, i) => (i === 40 ? { ...w, text: "BRIMM" } : w));
    const reel = reelOf(words, STRETCH);
    const spell = (text) => text.replace(/\bbrim\b/gi, "BRIMM");
    const placed = placedOn([cue("brim word41", { n: 1 })], words, { spell });
    assert.equal(placed[0].at.from, "w40");
    assert.deepEqual(reelGraphicCues(placed, STRETCH, reel, { spell }).map((c) => [c.at.from, c.at.to]), [["w15", "w16"]]);
  });
  it("gives each cue back as it was, its number and phrase and style among them, with the Reel's `at`, and changes none of what it is given", () => {
    const cues = [on(7, 40, 42, { phrase: "p7", style: { inspiration: "Calm" } }), on(9, 50, 51)];
    const placed = placedOn(cues);
    const before = JSON.stringify([placed, REEL, STRETCH]);
    const got = reelGraphicCues(placed, STRETCH, REEL);
    assert.deepEqual(got.map(({ at, ...rest }) => rest), cues);
    assert.deepEqual(got.map((c) => c.n), [7, 9]);
    assert.equal(JSON.stringify([placed, REEL, STRETCH]), before);
    assert.ok(got.every((c) => Object.keys(c.at).join() === "from,to,start,end"));
  });
  it("is none for no cues, none placed, no words, and a stretch that is none", () => {
    const placed = placedOn([on(1, 40, 42)]);
    assert.deepEqual(reelGraphicCues([], STRETCH, REEL), []);
    for (const given of [undefined, null, "cues", {}]) assert.deepEqual(reelGraphicCues(given, STRETCH, REEL), [], String(given));
    assert.deepEqual(reelGraphicCues(placed, STRETCH, []).map((c) => c.at), [null]);
    assert.deepEqual(reelGraphicCues(placed, STRETCH, undefined).map((c) => c.at), [null]);
    for (const stretch of [undefined, null, {}, { start: 5 }, { start: 340, end: 312.4 }, { start: "a", end: "b" }]) assert.deepEqual(reelGraphicCues(placed, stretch, REEL), [], JSON.stringify(stretch));
  });
});
