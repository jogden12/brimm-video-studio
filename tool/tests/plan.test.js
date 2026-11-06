// The planned episode's package (PR H4; design 2026-11-03, sections 5 and 6): her script worked into a video guide (graphic cues), a
// shot list and a teleprompter script, saved as a planned episode before any footage exists. plan.js is pure here: the words a command
// is given go in, and the package, the problems with it and the three files' texts come out. Nothing is read or written.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SHOT_LIST_KINDS, packageFiles, packageOf, planFilesFrom, planLines, plannedLine, savedLine, textArg } from "../plan.js";

/** A cue's words as the command is given them, for a script that has a talking shot, a screen recording and some b-roll. */
const SHOTS = ["talking | Open on the problem, to the camera.", "screen | The inventory sheet, scrolling.", "b-roll | Sallie at her desk sorting invoices."];
const cue = (...parts) => parts.join(" | ");
/** What a script's package is for these cues, shots and lines, with no problem. */
const made = (cues, shots = [], lines = ["One."], options = {}) => packageOf({ cues, shots, lines }, options);

describe("textArg, the six escapes of a command's words (PR H4)", () => {
  it("turns %22 %24 %25 %5C %60 and %7C into a double quote, a dollar sign, a percent sign, a backslash, a backtick and a pipe", () => {
    assert.equal(textArg("%22"), '"');
    assert.equal(textArg("%24"), "$");
    assert.equal(textArg("%25"), "%");
    assert.equal(textArg("%5C"), "\\");
    assert.equal(textArg("%60"), "`");
    assert.equal(textArg("%7C"), "|");
  });
  it("takes either case of the code", () => {
    assert.equal(textArg("%5c"), "\\");
    assert.equal(textArg("%7c"), "|");
    assert.equal(textArg("a%5Cb%5cc"), "a\\b\\c");
  });
  it("turns nothing else: a percent sign with no code stays, and so does a code that is not one of the six", () => {
    for (const same of ["100% sure", "100%", "%", "50% off, 20% more", "%20", "%41", "%2", "%2x", "%7", "%5", "%G0", "% 22", "%%", "100%%", "plain", "", "it's", 'say "hi"', "back\\slash", "a|b", "cost $5"]) assert.equal(textArg(same), same, JSON.stringify(same));
  });
  it("turns a code once, from left to right, so that %25 and what follows it are not turned again", () => {
    assert.equal(textArg("%2522"), "%22");
    assert.equal(textArg("%255C"), "%5C");
    assert.equal(textArg("%%22"), '%"');
    assert.equal(textArg("100%25 sure"), "100% sure");
  });
  it("turns every code in a text, among words that need none", () => {
    assert.equal(textArg("He said %22it costs %2499%22 and 100%25 of it, %5C %60x%60 %7C done"), 'He said "it costs $99" and 100% of it, \\ `x` | done');
  });
  it("is given nothing it could break on", () => {
    assert.equal(textArg(undefined), "");
    assert.equal(textArg(null), "");
  });
});

describe("the kinds of shot", () => {
  it("are talking, screen and b-roll, in the design's order", () => {
    assert.deepEqual([...SHOT_LIST_KINDS], ["talking", "screen", "b-roll"]);
  });
});

describe("packageOf, the cues of a script", () => {
  it("reads a cue of each kind, as graphic-cues.js holds it: numbered from 1 in the order given, with no style", () => {
    const { plan, problems } = made([
      cue("graphic", 4, "too many SKUs", "A stack of product boxes that keeps growing until it topples."),
      cue("words", 3, "every one of them", "The words EVERY ONE in the brand's navy."),
      cue("b-roll", 5, "sorting invoices", "Her hands on the pile.", "shot: 3"),
      cue("screen", 6, "the inventory sheet", "The sheet, scrolling to the bottom.", "shot: 2")
    ], SHOTS);
    assert.deepEqual(problems, []);
    assert.deepEqual(plan.cues, [
      { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of product boxes that keeps growing until it topples.", seconds: 4, style: null },
      { n: 2, words: "every one of them", kind: "words", show: "The words EVERY ONE in the brand's navy.", seconds: 3, style: null },
      { n: 3, words: "sorting invoices", kind: "b-roll", show: "Her hands on the pile.", seconds: 5, style: null, shot: 3 },
      { n: 4, words: "the inventory sheet", kind: "screen", show: "The sheet, scrolling to the bottom.", seconds: 6, style: null, shot: 2 }
    ]);
  });
  it("reads each key: shot, ref, inspiration and link", () => {
    const { plan, problems } = made([
      cue("graphic", 4, "one", "A one.", "ref: blue carousel.png"),
      cue("graphic", 4, "two", "A two.", "inspiration: Spotlight"),
      cue("graphic", 4, "three", "A three.", "link: https://example.com/post?id=7"),
      cue("b-roll", 4, "four", "A four.", "shot: 3", "ref: quote card.jpg"),
      cue("screen", 4, "five", "A five.", "link: https://example.com/a:b", "shot: 2")
    ], SHOTS);
    assert.deepEqual(problems, []);
    assert.deepEqual(plan.cues.map((c) => [c.style, c.shot]), [
      [{ ref: "blue carousel.png" }, undefined], [{ inspiration: "Spotlight" }, undefined], [{ link: "https://example.com/post?id=7" }, undefined],
      [{ ref: "quote card.jpg" }, 3], [{ link: "https://example.com/a:b" }, 2]
    ]);
  });
  it("takes the kind in any case, and the seconds as a number from 1 to 10, else 4 as graphic-cues.js does", () => {
    const { plan, problems } = made([cue("Graphic", 4, "a", "A."), cue(" WORDS ", 2.5, "b", "B."), cue("graphic", 1, "c", "C."), cue("graphic", 10, "d", "D."), cue("graphic", 0, "e", "E."), cue("graphic", 11, "f", "F."),
      cue("graphic", "soon", "g", "G."), cue("graphic", "", "h", "H."), cue("graphic", -3, "i", "I.")]);
    assert.deepEqual(problems, []);
    assert.deepEqual(plan.cues.map((c) => [c.kind, c.seconds]), [["graphic", 4], ["words", 2.5], ["graphic", 1], ["graphic", 10], ["graphic", 4], ["graphic", 4], ["graphic", 4], ["graphic", 4], ["graphic", 4]]);
  });
  it("trims every part and puts a part's inner white space on one line, as a cue's words and what it shows are held", () => {
    const { plan } = made(["  graphic  |  4  |   too   many   SKUs  |   A  stack\tof boxes.   "]);
    assert.deepEqual([plan.cues[0].words, plan.cues[0].show], ["too many SKUs", "A stack of boxes."]);
  });
  it("needs a b-roll or a screen cue to name a shot of its own kind that is in the list", () => {
    const one = (parts) => made([parts], SHOTS).problems;
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.")), [`Cue 1 can't be used: a b-roll cue needs the number of the shot it shows, as "shot: 3".`]);
    assert.deepEqual(one(cue("screen", 4, "w", "S.")), [`Cue 1 can't be used: a screen cue needs the number of the shot it shows, as "shot: 2".`]);
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.", "shot: 2")), [`Cue 1 can't be used: shot 2 is a screen recording, and a b-roll cue shows b-roll.`]);
    assert.deepEqual(one(cue("screen", 4, "w", "S.", "shot: 3")), [`Cue 1 can't be used: shot 3 is b-roll, and a screen cue shows a screen recording.`]);
    assert.deepEqual(one(cue("screen", 4, "w", "S.", "shot: 1")), [`Cue 1 can't be used: shot 1 is talking to the camera, and a screen cue shows a screen recording.`]);
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.", "shot: 9")), [`Cue 1 can't be used: there is no shot 9 in the shot list, which has 3.`]);
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.", "shot: 0")), [`Cue 1 can't be used: its shot is not a number from 1.`]);
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.", "shot: two")), [`Cue 1 can't be used: its shot is not a number from 1.`]);
    assert.deepEqual(one(cue("b-roll", 4, "w", "S.", "shot: 3", "shot: 3")), [`Cue 1 can't be used: it names more than one shot.`]);
    // With no shot list at all.
    assert.deepEqual(made([cue("b-roll", 4, "w", "S.", "shot: 1")], []).problems, [`Cue 1 can't be used: there is no shot 1 in the shot list, which has none.`]);
  });
  it("lets a graphic or words cue have no shot: it shows no footage", () => {
    assert.deepEqual(made([cue("graphic", 4, "w", "S.", "shot: 3")], SHOTS).problems, [`Cue 1 can't be used: a graphic cue shows no footage, so it has no shot.`]);
    assert.deepEqual(made([cue("words", 4, "w", "S.", "shot: 3")], SHOTS).problems, [`Cue 1 can't be used: a words cue shows no footage, so it has no shot.`]);
  });
  it("lets two cues show one shot", () => {
    const { plan, problems } = made([cue("b-roll", 4, "a", "A.", "shot: 3"), cue("b-roll", 4, "b", "B.", "shot: 3")], SHOTS);
    assert.deepEqual([problems, plan.cues.map((c) => c.shot)], [[], [3, 3]]);
  });
  it("refuses a kind that is none, and a cue with fewer than four parts", () => {
    assert.deepEqual(made([cue("podcast", 4, "w", "S.")]).problems, [`Cue 1 can't be used: "podcast" is not a kind of cue: use graphic, words, b-roll or screen.`]);
    assert.deepEqual(made([""]).problems, [`Cue 1 can't be used: it needs four parts: its kind, its seconds, its words and what it shows.`]);
    assert.deepEqual(made(["graphic | 4 | words"]).problems, [`Cue 1 can't be used: it needs four parts: its kind, its seconds, its words and what it shows.`]);
  });
  it("refuses empty words and an empty show, and each limit: 30 words and 200 characters of words, and 300 characters of show", () => {
    assert.deepEqual(made(["graphic | 4 |  | S."]).problems, [`Cue 1 can't be used: it has no words.`]);
    assert.deepEqual(made(["graphic | 4 | w |  "]).problems, [`Cue 1 can't be used: it shows nothing.`]);
    const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
    assert.deepEqual(made([cue("graphic", 4, words(30), "S.")]).problems, []);
    assert.deepEqual(made([cue("graphic", 4, words(31), "S.")]).problems, [`Cue 1 can't be used: its words are 31 words, and at most 30 can be used.`]);
    assert.deepEqual(made([cue("graphic", 4, "a".repeat(200), "S.")]).problems, []);
    assert.deepEqual(made([cue("graphic", 4, "a".repeat(201), "S.")]).problems, [`Cue 1 can't be used: its words are 201 characters, and at most 200 can be used.`]);
    assert.deepEqual(made([cue("graphic", 4, "w", "s".repeat(300))]).problems, []);
    assert.deepEqual(made([cue("graphic", 4, "w", "s".repeat(301))]).problems, [`Cue 1 can't be used: what it shows is 301 characters, and at most 300 can be used.`]);
    // Characters are counted as a person counts them: an emoji is one.
    assert.deepEqual(made([cue("graphic", 4, "w", "🙂".repeat(300))]).problems, []);
    assert.equal(made([cue("graphic", 4, "w", "🙂".repeat(300))]).plan.cues[0].show, "🙂".repeat(300));
  });
  it("keeps the words of a cue whole: nothing is cut that the limits let through", () => {
    const text = "x ".repeat(29).trim() + " y";
    assert.equal(made([cue("graphic", 4, text, "S.")]).plan.cues[0].words, text);
  });
  it("refuses a cue with a fifth part that has no key, which a bare | in its words makes, and says what to write instead", () => {
    assert.deepEqual(made(["graphic | 4 | this | that | what it shows"]).problems, [
      `Cue 1 can't be used: part 5 ("what it shows") is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C.`
    ]);
    assert.deepEqual(made(["graphic | 4 | words | show | shot 2"], SHOTS).problems, [
      `Cue 1 can't be used: part 5 ("shot 2") is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C.`
    ]);
    // A part with no text at all is none either.
    assert.match(made(["graphic | 4 | words | show | "]).problems[0], /part 5 \(""\) is not a key and a value/);
  });
  it("takes a | written %7C as part of the words, and does not split on it", () => {
    const { plan, problems } = made([cue("graphic", 4, "this %7C that", "A %7C between two words: %7C.")]);
    assert.deepEqual(problems, []);
    assert.deepEqual([plan.cues[0].words, plan.cues[0].show], ["this | that", "A | between two words: |."]);
  });
  it("hands a quote, a dollar sign, a percent sign, a backslash, a backtick and an apostrophe on whole, as she wrote them", () => {
    const { plan, problems } = made([cue("graphic", 4, "it's %2499 and %22100%25%22", "She said %22it's 50%25 off%22: %5C is a backslash and %60 a backtick.")]);
    assert.deepEqual(problems, []);
    assert.deepEqual([plan.cues[0].words, plan.cues[0].show], ["it's $99 and \"100%\"", "She said \"it's 50% off\": \\ is a backslash and ` a backtick."]);
    // A percent sign with no code stays, as `100% sure` is.
    assert.equal(made([cue("graphic", 4, "100% sure", "It is 100% sure.")]).plan.cues[0].words, "100% sure");
  });
  it("refuses a key it does not know, an empty one, two styles, and a link that is not https", () => {
    const one = (...extra) => made([cue("graphic", 4, "w", "S.", ...extra)]).problems;
    assert.deepEqual(one("colour: red"), [`Cue 1 can't be used: "colour" is not a key: use shot, ref, inspiration or link.`]);
    // Words before a colon are no key when they are more than a word: they are what a bare | cut off the text before them.
    assert.deepEqual(one("what it shows: and more"), [`Cue 1 can't be used: part 5 ("what it shows: and more") is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C.`]);
    assert.deepEqual(one("ref:"), [`Cue 1 can't be used: its ref is empty.`]);
    assert.deepEqual(one("link: "), [`Cue 1 can't be used: its link is empty.`]);
    assert.deepEqual(one("ref: a.png", "link: https://example.com"), [`Cue 1 can't be used: it has more than one style: use one of ref, inspiration or link.`]);
    assert.deepEqual(one("inspiration: A", "inspiration: B"), [`Cue 1 can't be used: it has more than one style: use one of ref, inspiration or link.`]);
    assert.deepEqual(one("link: http://example.com"), [`Cue 1 can't be used: its link must be an https link.`]);
    assert.deepEqual(one("link: example.com"), [`Cue 1 can't be used: its link must be an https link.`]);
    assert.deepEqual(one("link: javascript:alert(1)"), [`Cue 1 can't be used: its link must be an https link.`]);
    // A key is read in any case, with its value after the first colon alone.
    assert.deepEqual(made([cue("graphic", 4, "w", "S.", "LINK: https://example.com:8080/x")]).plan.cues[0].style, { link: "https://example.com:8080/x" });
  });
  it("refuses a ref that is not a bare file name, which the reference folder could not hold", () => {
    for (const bad of ["../x.png", "a/b.png", ".hidden.png", "a\\b.png"]) assert.match(made([cue("graphic", 4, "w", "S.", `ref: ${bad}`)]).problems[0] ?? "", /^Cue 1 can't be used: /, bad);
  });
  it("asks the folder about a ref, when it is given a way to, and uses the file it names; or refuses, in the folder's words", () => {
    const folder = (said) => (said === "blue carousel" ? { file: "blue carousel.png" } : { why: `there is no "${said}" in the reference folder` });
    const ok = made([cue("graphic", 4, "w", "S.", "ref: blue carousel")], [], ["One."], { ref: folder });
    assert.deepEqual([ok.problems, ok.plan.cues[0].style], [[], { ref: "blue carousel.png" }]);
    assert.deepEqual(made([cue("graphic", 4, "w", "S.", "ref: nothing")], [], ["One."], { ref: folder }).problems, [`Cue 1 can't be used: there is no "nothing" in the reference folder.`]);
    // Asked only of a ref: a link or an inspiration is not looked up.
    const asked = [];
    made([cue("graphic", 4, "w", "S.", "link: https://example.com"), cue("graphic", 4, "w", "S.", "inspiration: Spotlight"), cue("graphic", 4, "w", "S.", "ref: x")], [], ["One."], { ref: (said) => (asked.push(said), { file: "x.png" }) });
    assert.deepEqual(asked, ["x"]);
  });
  it("numbers a problem by the cue's place in the words given, and lists the problem of every cue, in order, with the shots' and the lines' after them", () => {
    const { plan, problems } = made([cue("graphic", 4, "ok", "Fine."), "graphic | 4 | w", cue("graphic", 4, "ok", "Fine."), cue("podcast", 4, "w", "S."), cue("graphic", 4, "w", "S.", "colour: red")],
      ["drone | Up high.", "talking | Fine."], ["Fine.", " ", "Also fine."]);
    assert.equal(plan, null);
    assert.deepEqual(problems, [
      `Cue 2 can't be used: it needs four parts: its kind, its seconds, its words and what it shows.`,
      `Cue 4 can't be used: "podcast" is not a kind of cue: use graphic, words, b-roll or screen.`,
      `Cue 5 can't be used: "colour" is not a key: use shot, ref, inspiration or link.`,
      `Shot 1 can't be used: "drone" is not a kind of shot: use talking, screen or b-roll.`,
      `Line 2 can't be used: it is empty.`
    ]);
  });
  it("says every problem of one cue, each on its own line", () => {
    const { problems } = made([cue("podcast", 4, "", "")]);
    assert.deepEqual(problems, [`Cue 1 can't be used: "podcast" is not a kind of cue: use graphic, words, b-roll or screen.`, `Cue 1 can't be used: it has no words.`, `Cue 1 can't be used: it shows nothing.`]);
  });
});

describe("packageOf, the cues of an explainer", () => {
  const explainer = { explainer: true };
  it("has graphic and words cues only, and no shots", () => {
    const ok = made([cue("graphic", 4, "w", "S."), cue("words", 4, "w", "S.")], [], ["One."], explainer);
    assert.deepEqual([ok.problems, ok.plan.cues.map((c) => c.kind), ok.plan.shots], [[], ["graphic", "words"], []]);
    assert.deepEqual(made([cue("b-roll", 4, "w", "S.")], [], ["One."], explainer).problems, [`Cue 1 can't be used: an explainer shows graphics and words on screen only, so a b-roll cue is not one.`]);
    assert.deepEqual(made([cue("screen", 4, "w", "S.")], [], ["One."], explainer).problems, [`Cue 1 can't be used: an explainer shows graphics and words on screen only, so a screen cue is not one.`]);
    assert.deepEqual(made([cue("podcast", 4, "w", "S.")], [], ["One."], explainer).problems, [`Cue 1 can't be used: "podcast" is not a kind of cue: use graphic or words.`]);
  });
  it("is given no shot: each is a problem of its own", () => {
    assert.deepEqual(made([cue("graphic", 4, "w", "S.")], ["talking | A.", "b-roll | B."], ["One."], explainer).problems, [`Shot 1 can't be used: an explainer has no shots.`, `Shot 2 can't be used: an explainer has no shots.`]);
  });
});

describe("packageOf, the shots", () => {
  it("reads a shot of each kind, numbered from 1 in the order given", () => {
    const { plan, problems } = made([], ["talking | Open to the camera.", "SCREEN |  The sheet. ", "b-roll | Her desk."]);
    assert.deepEqual(problems, []);
    assert.deepEqual(plan.shots, [{ n: 1, kind: "talking", what: "Open to the camera." }, { n: 2, kind: "screen", what: "The sheet." }, { n: 3, kind: "b-roll", what: "Her desk." }]);
  });
  it("hands a quote, a dollar sign and a | written %7C on whole", () => {
    assert.equal(made([], ["talking | She says %22%2499%22 %7C %25."]).plan.shots[0].what, 'She says "$99" | %.');
  });
  it("refuses a kind that is none, a shot with a part too few or too many, an empty one and one that runs over 300 characters", () => {
    assert.deepEqual(made([], ["drone | Up high."]).problems, [`Shot 1 can't be used: "drone" is not a kind of shot: use talking, screen or b-roll.`]);
    assert.deepEqual(made([], ["talking"]).problems, [`Shot 1 can't be used: it needs two parts: its kind and what it is. If a | belongs to what it is, write it as %7C.`]);
    assert.deepEqual(made([], ["talking | Open | to the camera."]).problems, [`Shot 1 can't be used: it needs two parts: its kind and what it is. If a | belongs to what it is, write it as %7C.`]);
    assert.deepEqual(made([], ["talking |  "]).problems, [`Shot 1 can't be used: it says nothing of what it is.`]);
    assert.deepEqual(made([], [`talking | ${"s".repeat(300)}`]).problems, []);
    assert.deepEqual(made([], [`talking | ${"s".repeat(301)}`]).problems, [`Shot 1 can't be used: what it is runs to 301 characters, and at most 300 can be used.`]);
  });
});

describe("packageOf, the teleprompter's lines", () => {
  it("keeps each line as she wrote it, trimmed, in order", () => {
    assert.deepEqual(made([], [], ["  First.  ", "Second, with 100%25 of it and a %7C.", "It's \"third\"."]).plan.lines, ["First.", "Second, with 100% of it and a |.", "It's \"third\"."]);
  });
  it("refuses an empty line and one over 2,000 characters", () => {
    assert.deepEqual(made([], [], [""]).problems, [`Line 1 can't be used: it is empty.`]);
    assert.deepEqual(made([], [], ["a".repeat(2000)]).problems, []);
    assert.deepEqual(made([], [], ["a".repeat(2001)]).problems, [`Line 1 can't be used: it is 2,001 characters, and at most 2,000 can be used.`]);
  });
});

describe("packageOf, the limits: 60 cues, 40 shots and 400 lines", () => {
  it("takes the most of each", () => {
    const { problems, plan } = made(Array.from({ length: 60 }, (_, i) => cue("graphic", 4, `w${i}`, "S.")), Array.from({ length: 40 }, () => "talking | A."), Array.from({ length: 400 }, () => "L."));
    assert.deepEqual(problems, []);
    assert.deepEqual([plan.cues.length, plan.shots.length, plan.lines.length], [60, 40, 400]);
  });
  it("refuses each one over the most, by its place, and reads none of them", () => {
    const cues = Array.from({ length: 62 }, (_, i) => cue("graphic", 4, `w${i}`, "S."));
    const { problems } = made(cues, Array.from({ length: 42 }, () => "talking | A."), Array.from({ length: 402 }, () => "L."));
    assert.deepEqual(problems, [
      `Cue 61 can't be used: a plan has at most 60 cues.`, `Cue 62 can't be used: a plan has at most 60 cues.`,
      `Shot 41 can't be used: a plan has at most 40 shots.`, `Shot 42 can't be used: a plan has at most 40 shots.`,
      `Line 401 can't be used: a plan has at most 400 lines.`, `Line 402 can't be used: a plan has at most 400 lines.`
    ]);
  });
});

describe("the three files of a package", () => {
  const TITLE = "Too many SKUs";
  const given = {
    cues: [
      cue("graphic", 4, "too many SKUs", "A stack of product boxes that keeps growing until it topples."),
      cue("words", 1, "every one", "The words EVERY ONE", "ref: blue carousel.png"),
      cue("b-roll", 3, "sorting invoices", "Her hands on the pile", "shot: 3"),
      cue("screen", 6, "the sheet", "The sheet, scrolling.", "inspiration: Spotlight", "shot: 2"),
      cue("graphic", 2.5, "tipping point", "A scale tips.", "link: https://example.com/post")
    ],
    shots: SHOTS,
    lines: ["Too many SKUs will sink a small shop.", "Here is why, in three steps."]
  };
  const { plan, problems } = packageOf(given, { ref: (said) => ({ file: said }) });
  it("has no problem", () => assert.deepEqual(problems, []));
  it("makes the video guide: its heading, then one numbered line for each cue, in the show's words, with its style", () => {
    assert.equal(packageFiles(TITLE, plan)["video guide.md"], [
      "# Too many SKUs: the video guide",
      "",
      '1. A graphic for 4 seconds, on "too many SKUs": A stack of product boxes that keeps growing until it topples.',
      '2. Words on screen for 1 second, on "every one": The words EVERY ONE. Style: blue carousel.png.',
      '3. B-roll for 3 seconds, on "sorting invoices": Her hands on the pile. From shot 3.',
      '4. A screen recording for 6 seconds, on "the sheet": The sheet, scrolling. Style: the Inspiration video Spotlight. From shot 2.',
      '5. A graphic for 2.5 seconds, on "tipping point": A scale tips. Style: https://example.com/post.',
      ""
    ].join("\n"));
  });
  it("makes the shot list: its heading, then one numbered line for each shot, and the cues that use it", () => {
    assert.equal(packageFiles(TITLE, plan)["shot list.md"], [
      "# Too many SKUs: the shot list",
      "",
      "1. Talking to the camera: Open on the problem, to the camera.",
      "2. A screen recording: The inventory sheet, scrolling. For cue 4.",
      "3. B-roll: Sallie at her desk sorting invoices. For cue 3.",
      ""
    ].join("\n"));
    // Two cues on one shot are both named.
    const twice = packageOf({ cues: [cue("b-roll", 3, "a", "A.", "shot: 3"), cue("b-roll", 3, "b", "B.", "shot: 3")], shots: SHOTS, lines: ["x"] }).plan;
    assert.match(packageFiles(TITLE, twice)["shot list.md"], /\n3\. B-roll: Sallie at her desk sorting invoices\. For cues 1 and 2\.\n$/);
    const three = packageOf({ cues: [cue("b-roll", 3, "a", "A.", "shot: 3"), cue("b-roll", 3, "b", "B.", "shot: 3"), cue("b-roll", 3, "c", "C.", "shot: 3")], shots: SHOTS, lines: ["x"] }).plan;
    assert.match(packageFiles(TITLE, three)["shot list.md"], /For cues 1, 2 and 3\.\n$/);
  });
  it("makes the teleprompter script: the lines joined by a blank line, with a newline at the end, and nothing else", () => {
    assert.equal(packageFiles(TITLE, plan)["teleprompter.txt"], "Too many SKUs will sink a small shop.\n\nHere is why, in three steps.\n");
    assert.equal(packageFiles(TITLE, packageOf({ cues: [], shots: [], lines: ["Only one."] }).plan)["teleprompter.txt"], "Only one.\n");
  });
  it("makes a guide and a shot list with just a heading when there is no cue and no shot, and a teleprompter script of a newline when there is no line", () => {
    const none = packageOf({ cues: [], shots: [], lines: [] }).plan;
    assert.deepEqual(packageFiles(TITLE, none), { "video guide.md": "# Too many SKUs: the video guide\n", "shot list.md": "# Too many SKUs: the shot list\n", "teleprompter.txt": "\n" });
  });
  it("makes no shot list for an explainer", () => {
    const explained = packageOf({ cues: [cue("graphic", 4, "w", "S.")], shots: [], lines: ["Voice."] }, { explainer: true }).plan;
    assert.deepEqual(Object.keys(packageFiles("Why SKUs", explained, { explainer: true })), ["video guide.md", "teleprompter.txt"]);
  });
  it("puts a title with a quote, a dollar sign or a pipe in a heading as it is", () => {
    assert.equal(packageFiles('Say "$5" | now', plan)["video guide.md"].split("\n")[0], '# Say "$5" | now: the video guide');
  });
});

describe("what is said of a package", () => {
  // 1,240 words, in 31 lines of 40.
  const { plan } = packageOf({ cues: Array.from({ length: 7 }, (_, i) => cue("graphic", 4, `w${i}`, "S.")), shots: Array.from({ length: 5 }, () => "talking | A."), lines: Array.from({ length: 31 }, () => Array.from({ length: 40 }, () => "word").join(" ")) });
  it("says it is saved, with the count of its parts and of the teleprompter's words, in minutes at 150 words each", () => {
    assert.equal(savedLine("Too many SKUs", plan), 'The plan for "Too many SKUs" is saved: 7 graphic cues, 5 shots and a teleprompter script of 1,240 words, about 8 minutes. Its files are in its folder in Episodes.');
  });
  it("says one of each as one, and at least a minute", () => {
    const one = packageOf({ cues: [cue("graphic", 4, "w", "S.")], shots: ["talking | A."], lines: ["Just one."] }).plan;
    assert.equal(savedLine("T", one), 'The plan for "T" is saved: 1 graphic cue, 1 shot and a teleprompter script of 2 words, about 1 minute. Its files are in its folder in Episodes.');
    const none = packageOf({ cues: [], shots: [], lines: [] }).plan;
    assert.equal(savedLine("T", none), 'The plan for "T" is saved: 0 graphic cues, 0 shots and a teleprompter script of 0 words, about 1 minute. Its files are in its folder in Episodes.');
    const word = packageOf({ cues: [], shots: [], lines: ["One"] }).plan;
    assert.match(savedLine("T", word), /a teleprompter script of 1 word, about 1 minute\./);
  });
  it("rounds the minutes: 224 words is about 1, 225 is about 2, and a thousand is about 7", () => {
    const at = (n) => packageOf({ cues: [], shots: [], lines: [Array.from({ length: n }, () => "w").join(" ")] }).plan;
    assert.match(savedLine("T", at(224)), /224 words, about 1 minute\./);
    assert.match(savedLine("T", at(225)), /225 words, about 2 minutes\./);
    assert.match(savedLine("T", at(1000)), /1,000 words, about 7 minutes\./);
  });
  it("leaves out the shots of an explainer, which has none", () => {
    const explained = packageOf({ cues: [cue("graphic", 4, "w", "S."), cue("words", 4, "w", "S.")], shots: [], lines: ["Two words."] }, { explainer: true }).plan;
    assert.equal(savedLine("Why SKUs", explained, { explainer: true }), 'The plan for "Why SKUs" is saved: 2 graphic cues and a teleprompter script of 2 words, about 1 minute. Its files are in its folder in Episodes.');
  });
  it("counts the words in every line", () => {
    const two = packageOf({ cues: [], shots: [], lines: ["One two three.", "Four five."] }).plan;
    assert.match(savedLine("T", two), /a teleprompter script of 5 words/);
  });
});

describe("planLines, the plan in plain words", () => {
  const { plan } = packageOf({
    cues: [
      cue("graphic", 4, "too many SKUs", "A stack of product boxes that keeps growing until it topples."),
      cue("words", 1, "every one", "The words EVERY ONE", "ref: blue carousel.png"),
      cue("b-roll", 3, "sorting invoices", "Her hands on the pile.", "shot: 3"),
      cue("screen", 6, "the sheet", "The sheet, scrolling.", "shot: 2")
    ],
    shots: SHOTS,
    lines: ["Too many SKUs will sink a small shop.", "Here is why."]
  });
  it("says each cue, each shot and the teleprompter's length, for a script", () => {
    assert.deepEqual(planLines("Too many SKUs", plan), [
      'The plan for "Too many SKUs":',
      'Cue 1, a graphic for 4 seconds, on "too many SKUs": A stack of product boxes that keeps growing until it topples.',
      'Cue 2, words on screen for 1 second, on "every one": The words EVERY ONE. Style: blue carousel.png.',
      'Cue 3, b-roll for 3 seconds, on "sorting invoices": Her hands on the pile. From shot 3.',
      'Cue 4, a screen recording for 6 seconds, on "the sheet": The sheet, scrolling. From shot 2.',
      "Shot 1, talking to the camera: Open on the problem, to the camera.",
      "Shot 2, a screen recording: The inventory sheet, scrolling.",
      "Shot 3, b-roll: Sallie at her desk sorting invoices.",
      "The teleprompter script is 11 words, about 1 minute."
    ]);
  });
  it("says the same for an explainer, with its voice and without shots", () => {
    const explained = packageOf({ cues: [cue("graphic", 4, "w", "S.")], shots: [], lines: ["Voice."] }, { explainer: true }).plan;
    assert.deepEqual(planLines("Why SKUs", explained, { explainer: true, voice: "sallie" }), [
      'The plan for "Why SKUs", an explainer in Sallie\'s voice:', 'Cue 1, a graphic for 4 seconds, on "w": S.', "The teleprompter script is 1 word, about 1 minute."
    ]);
    assert.equal(planLines("Why SKUs", explained, { explainer: true, voice: "heygen" })[0], 'The plan for "Why SKUs", an explainer in a HeyGen voice:');
    assert.equal(planLines("Why SKUs", explained, { explainer: true, voice: null })[0], 'The plan for "Why SKUs", an explainer:');
  });
});

describe("plannedLine, what `episodes` says of a planned episode", () => {
  const record = (over = {}) => ({ id: "e-20261104-3fa9c1", planned: { route: "script", title: "Too many SKUs", voice: null, at: "2026-11-04T09:12:00-05:00", on: "Mac Studio", set: null, cues: [], shots: [], lines: [], filmed: null, ...over }, name: { text: "Too many SKUs", placeholder: false } });
  it("says its title, the day it was planned and that it waits for its footage, with its shots and its short id", () => {
    const shots = (n) => Array.from({ length: n }, (_, i) => ({ n: i + 1, kind: "talking", what: "x" }));
    assert.equal(plannedLine(record({ shots: shots(5) })), '"Too many SKUs": planned on 4 November, waiting for its footage (5 shots), id 3fa9c1');
    assert.equal(plannedLine(record({ shots: shots(1) })), '"Too many SKUs": planned on 4 November, waiting for its footage (1 shot), id 3fa9c1');
    assert.equal(plannedLine(record({ shots: [] })), '"Too many SKUs": planned on 4 November, waiting for its footage (no shots yet), id 3fa9c1');
  });
  it("names the day as the record keeps it, whatever the zone, and any month", () => {
    assert.match(plannedLine(record({ at: "2026-01-01T23:59:00-08:00" })), /planned on 1 January,/);
    assert.match(plannedLine(record({ at: "2026-12-31T00:00:00+09:00" })), /planned on 31 December,/);
    assert.match(plannedLine(record({ at: "2026-02-09T12:00:00-05:00" })), /planned on 9 February,/);
  });
  it("names an explainer by what it waits for: its voice-over", () => {
    assert.equal(plannedLine(record({ route: "explainer", voice: "sallie" })), '"Too many SKUs": an explainer planned on 4 November, waiting for its voiceover, id 3fa9c1');
    assert.equal(plannedLine(record({ route: "explainer", voice: "heygen" })), '"Too many SKUs": an explainer planned on 4 November, waiting for its HeyGen voice, id 3fa9c1');
    assert.equal(plannedLine(record({ route: "explainer", voice: null })), '"Too many SKUs": an explainer planned on 4 November, waiting for its voiceover, id 3fa9c1');
  });
  it("is named by the name she gave it", () => {
    assert.match(plannedLine({ ...record(), name: { text: "Why SKUs sink you", placeholder: false } }), /^"Why SKUs sink you": planned on/);
  });
});

describe("planFilesFrom", () => {
  it("makes the plan's files from a record, as packageFiles does from its plan, named by the record's name", () => {
    const planned = { route: "script", title: "Old title", voice: null, set: "2026-11-05T10:00:00-05:00", cues: [], shots: [{ n: 1, kind: "talking", what: "Open on it." }], lines: ["One.", "Two."] };
    const r = { name: { text: "New name", placeholder: false }, planned };
    assert.deepEqual(planFilesFrom(r), packageFiles("New name", planned, { explainer: false }));
    assert.deepEqual(Object.keys(planFilesFrom(r)).sort(), ["shot list.md", "teleprompter.txt", "video guide.md"]);
  });
  it("makes the explainer's files without a shot list, and nothing for a plan whose package was never set", () => {
    const planned = { route: "explainer", title: "T", voice: "heygen", set: "2026-11-05T10:00:00-05:00", cues: [], shots: [], lines: ["One."] };
    assert.ok(!("shot list.md" in planFilesFrom({ name: { text: "T", placeholder: false }, planned })));
    assert.deepEqual(planFilesFrom({ name: { text: "T", placeholder: false }, planned: { ...planned, set: null } }), {});
  });
});
