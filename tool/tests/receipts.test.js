// The card in code (design 2026-10-26, section 5, "The card's receipt, with the open lock"; R10, R28): her card's two questions and
// each set of answers it may offer, and the follow-up for a Zoom download or sound alone, are fixed in receipts.js, with only the
// label and a video's name put in. `episodes` prints the exact card under each video waiting for her answer, and `kind` the
// follow-up after it says to ask first. Each test is a made-up Mac of its own (episodes.js); no real program runs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRIVATE_Q, WHAT_Q, cardOf, formOf, notSessionCardOf } from "../receipts.js";
import { editMain } from "../edit.js";
import { setup, episodeFor, episodeAs } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

const SESSION = "Client or group session";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null };
const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
const ASK_FIRST = "Ask first whether it is a client or group session: it came from Zoom, or is sound alone. Then answer again with --not-a-session.";

/** A card's questions as texts and option labels, in order. */
const shape = (card) => card.questions.map((q) => [q.question, q.options.map((o) => o.label)]);

/** The lines under the line of the video called `label` in what `episodes` said, up to the next line not indented four spaces. */
function under(said, label) {
  const at = said.findIndex((line) => line.startsWith(`  ${label}: `));
  assert.ok(at >= 0, said.join("\n"));
  const lines = [];
  for (let i = at + 1; i < said.length && said[i].startsWith("    "); i++) lines.push(said[i]);
  return lines;
}

/** The JSON a line that starts `start` gives, parsed, among `lines`; undefined when there is no such line. */
function jsonAfter(lines, start) {
  const line = lines.find((l) => l.startsWith(start));
  return line === undefined ? undefined : JSON.parse(line.slice(start.length));
}

/** Every card in a fixed form, for the label `label`: each guess, each Maybe line, and the three not-a-session cards. */
const everyCard = (label) => [
  ...[null, "finished", "raw", "clip"].map((guess) => [cardOf({ label, guess, maybe: null }), "what"]),
  ...[{ session: true }, { name: "Pricing talk", kind: "finished" }, { name: "Pricing talk", kind: "short video" }, { name: "Pricing talk", kind: "raw" }].map((maybe) => [cardOf({ label, guess: "raw", maybe }), "what"]),
  ...["zoom", "sound", null].map((came) => [notSessionCardOf({ label, came }), "not-a-session"])
];

describe("the card, in code", () => {
  it("words the card for each guess and each Maybe line exactly as her skill did", () => {
    for (const [given, first] of [
      [{ maybe: { session: true } }, ["Client or group session", "Finished by your editor", "Raw with retakes", "iPhone clip"]],
      [{ maybe: { name: "Pricing talk", kind: "finished" } }, ["A new version of Pricing talk", "Finished by your editor", "Raw with retakes", "Client or group session"]],
      [{ maybe: { name: "Pricing talk", kind: "raw" } }, ["A finished version of Pricing talk", "Finished by your editor", "Raw with retakes", "Client or group session"]],
      [{ guess: "finished" }, ["Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"]],
      [{ guess: "raw" }, ["Raw with retakes", "Finished by your editor", "iPhone clip", "Client or group session"]],
      [{ guess: "clip" }, ["iPhone clip", "Finished by your editor", "Raw with retakes", "Client or group session"]],
      [{}, ["Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"]]]) {
      const card = cardOf({ label: "Talk 3", guess: null, maybe: null, ...given });
      assert.deepEqual(card.questions.map((q) => [q.question, q.options.map((o) => o.label)]), [["What is Talk 3?", first], [PRIVATE_Q, ["Yes", "No"]]]);
    }
    assert.equal(PRIVATE_Q, "Is it a private session with a client or a group?");
    assert.equal(WHAT_Q("Talk 3"), "What is Talk 3?");
    // A Maybe line wins over a Guess line, and an iPhone clip's new version is offered as a new version, as a finished video's is.
    assert.deepEqual(shape(cardOf({ label: "Talk 3", guess: "clip", maybe: { name: "Pricing talk", kind: "short video" } }))[0][1], ["A new version of Pricing talk", "Finished by your editor", "Raw with retakes", SESSION]);
    assert.deepEqual(shape(cardOf({ label: "Talk 3", guess: "finished", maybe: { session: true } }))[0][1], [SESSION, "Finished by your editor", "Raw with retakes", "iPhone clip"]);
  });

  it("words the not-a-session card with the label, for Zoom, sound alone and neither", () => {
    const options = ["It is a client or group session", "It is not a session"];
    for (const [came, question] of [
      ["zoom", "Talk 3 came from Zoom, which is often a client or group session. Which is it?"],
      ["sound", "Talk 3 is sound alone, which is often a client or group session. Which is it?"],
      [null, "Talk 3 may be a Zoom download or sound alone, which is often a client or group session. Which is it?"]]) {
      assert.deepEqual(shape(notSessionCardOf({ label: "Talk 3", came })), [[question, options]], String(came));
    }
    // A way it came that is neither is said as neither.
    assert.deepEqual(shape(notSessionCardOf({ label: "Talk 3", came: "camera" })), shape(notSessionCardOf({ label: "Talk 3", came: null })));
  });

  it("finds the label and the form of a card in each fixed form, and none of a card worded otherwise", () => {
    for (const label of ["Talk 3", LABEL, "Sallie's \"Q&A\": part 2", "Q&A / part 2?", ".hidden", "What is it", "a came from Zoom, which is often a client or group session. Which is it?"]) {
      for (const [card, form] of everyCard(label)) assert.deepEqual(formOf(card.questions), { label, form }, `${label}: ${JSON.stringify(card)}`);
    }
    // What the tool's AskUserQuestion keeps beside the texts (a header, a description, multiSelect) is not the wording.
    const dressed = cardOf({ label: "Talk 3", guess: "raw" }).questions.map((q) => ({ ...q, header: "Video", multiSelect: false, options: q.options.map((o) => ({ ...o, description: "" })) }));
    assert.deepEqual(formOf(dressed), { label: "Talk 3", form: "what" });
    const what = cardOf({ label: "Talk 3", guess: "raw" }).questions;
    const swap = (list, i, j) => list.map((x, k) => (k === i ? list[j] : k === j ? list[i] : x));
    const withOptions = (q, labels) => ({ ...q, options: labels.map((label) => ({ label })) });
    const opts = (q) => q.options.map((o) => o.label);
    for (const [what_, questions] of [
      ["Claude's own card", [{ question: "Talk 3: is the sound clear?", options: [{ label: "Finished" }, { label: "Raw" }] }, { question: "Make it louder?", options: [{ label: "Yes" }, { label: "No" }] }]],
      ["the answers in another order", [withOptions(what[0], swap(opts(what[0]), 1, 2)), what[1]]],
      ["the session answer first, with no Maybe line", [withOptions(what[0], [SESSION, "Raw with retakes", "Finished by your editor", "iPhone clip"]), what[1]]],
      ["an answer left out", [withOptions(what[0], opts(what[0]).slice(0, 3)), what[1]]],
      ["an answer added", [withOptions(what[0], [...opts(what[0]), "Something else"]), what[1]]],
      ["Yes and No the other way", [what[0], withOptions(what[1], ["No", "Yes"])]],
      ["the questions the other way", [what[1], what[0]]],
      ["the first question alone", [what[0]]],
      ["the second question alone", [what[1]]],
      ["a third question", [...what, what[1]]],
      ["another first question", [{ ...what[0], question: "What's Talk 3?" }, what[1]]],
      ["the first question with no question mark", [{ ...what[0], question: "What is Talk 3" }, what[1]]],
      ["the first question with no label", [{ ...what[0], question: "What is ?" }, what[1]]],
      ["another second question", [what[0], { ...what[1], question: "Is it private?" }]],
      ["a new version offered in a guess's order", [withOptions(what[0], ["A new version of Pricing talk", "Raw with retakes", "Finished by your editor", SESSION]), what[1]]],
      ["a finished version with an iPhone clip", [withOptions(what[0], ["A finished version of Pricing talk", "Finished by your editor", "Raw with retakes", "iPhone clip"]), what[1]]],
      ["the not-a-session answers the other way", [withOptions(notSessionCardOf({ label: "Talk 3", came: "zoom" }).questions[0], ["It is not a session", "It is a client or group session"])]],
      ["the not-a-session question with no label", [{ ...notSessionCardOf({ label: "Talk 3", came: "zoom" }).questions[0], question: " came from Zoom, which is often a client or group session. Which is it?" }]],
      ["the not-a-session question with both cards", [...notSessionCardOf({ label: "Talk 3", came: "zoom" }).questions, ...what]],
      ["no questions", []],
      ["no list", null],
      ["a list of words", ["What is Talk 3?", PRIVATE_Q]],
      ["a question that is not words", [{ question: 3, options: [] }, what[1]]],
      ["options that are not a list", [{ ...what[0], options: "Raw with retakes" }, what[1]]],
      ["an option with no label", [{ ...what[0], options: [{}, ...what[0].options.slice(1)] }, what[1]]]]) {
      assert.equal(formOf(questions), null, what_);
    }
  });
});

describe("the card, as episodes and kind print it", () => {
  it("prints the card under each waiting video in episodes, as JSON she can be asked with as it is, whatever the label holds", async () => {
    const t = setup();
    const label = "Sallie's \"Q&A\": part 2";
    episodeFor(t, { record: { version: 3, kind: null, answer: ANSWER, label } });
    episodeAs(t, { id: "e-20261022-0b0b0b", name: "2026-10-22 Talk (Mac Studio)", record: { version: 3, kind: null, answer: { ...ANSWER, guess: "clip", came: "phone", seen: "upright, 0:40, no retakes" }, label: "Video of 22 Oct, 09:00 (Mac Studio)" } });
    const { code, said } = await on(t.ctx.deps, "episodes");
    assert.equal(code, 0);
    const lines = under(said, label);
    // The card's line is the last of her card's lines, after the Seen, Came and Guess lines.
    assert.deepEqual(lines.slice(0, 3), ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"]);
    assert.match(lines[3], /^ {4}Card: \{/);
    assert.equal(lines.length, 4);
    // One line, which parses back to the very card and the very label.
    const card = jsonAfter(lines, "    Card: ");
    assert.deepEqual(card, cardOf({ label, guess: "raw", maybe: null }));
    assert.deepEqual(formOf(card.questions), { label, form: "what" });
    assert.equal(card.questions[0].question, `What is ${label}?`);
    // Each waiting video has a card of its own, by its own label and guess.
    const other = under(said, "Video of 22 Oct, 09:00 (Mac Studio)");
    assert.deepEqual(jsonAfter(other, "    Card: "), cardOf({ label: "Video of 22 Oct, 09:00 (Mac Studio)", guess: "clip", maybe: null }));
    t.done();
  });

  it("prints the not-a-session card only for a Zoom download or sound alone, and after kind's ask-first line", async () => {
    for (const came of ["camera", "phone", "zoom", "sound", null]) {
      const t = setup();
      episodeFor(t, { record: { version: 3, kind: null, answer: { ...ANSWER, guess: null, came }, label: LABEL } });
      const lines = under((await on(t.ctx.deps, "episodes")).said, LABEL);
      const asked = jsonAfter(lines, "    Card if not a session: ");
      if (came === "zoom" || came === "sound") {
        assert.deepEqual(asked, notSessionCardOf({ label: LABEL, came }), came);
        assert.ok(lines.at(-1).startsWith("    Card if not a session: ") && lines.at(-2).startsWith("    Card: "), lines.join("\n"));
      } else assert.equal(asked, undefined, String(came));
      // kind says to ask first, and gives the card that asks it, by the label, with how it came when the record says.
      if (came === "zoom" || came === "sound" || came === null) {
        const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
        assert.deepEqual([r.code, r.said], [1, [ASK_FIRST, `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: LABEL, came }))}`]], String(came));
      }
      t.done();
    }
  });

  it("keeps in the code every order of the card's answers her skill wrote out, the Maybe line of a session first", () => {
    // The seven orders her skill wrote out (tool/studio/SKILL.md's card section before the card moved into code), each led by its
    // own guess or new version, with "Client or group session" first only for a new version of a session.
    const BASE = ["Finished by your editor", "Raw with retakes", "iPhone clip"];
    const GUESSED = { finished: "Finished by your editor", raw: "Raw with retakes", clip: "iPhone clip" };
    const first = (given) => shape(cardOf({ label: "<label>", guess: null, maybe: null, ...given }))[0][1];
    const orders = {
      "maybe session": first({ maybe: { session: true } }),
      "maybe other": first({ maybe: { name: "<name>", kind: "finished" } }),
      "maybe raw": first({ maybe: { name: "<name>", kind: "raw" } }),
      "guess finished": first({ guess: "finished" }),
      "guess raw": first({ guess: "raw" }),
      "guess clip": first({ guess: "clip" }),
      none: first({})
    };
    for (const [when, answers] of Object.entries(orders)) {
      assert.ok(answers.length <= 4, when);
      assert.equal(new Set(answers).size, answers.length, when);
      assert.ok(answers.includes(SESSION), when);
    }
    assert.deepEqual(orders["maybe session"], [SESSION, ...BASE]);
    assert.deepEqual(orders["maybe other"], ["A new version of <name>", "Finished by your editor", "Raw with retakes", SESSION]);
    assert.deepEqual(orders["maybe raw"], ["A finished version of <name>", "Finished by your editor", "Raw with retakes", SESSION]);
    for (const guess of ["finished", "raw", "clip"]) assert.deepEqual(orders[`guess ${guess}`], [GUESSED[guess], ...BASE.filter((a) => a !== GUESSED[guess]), SESSION], guess);
    assert.deepEqual(orders.none, [...BASE, SESSION]);
    for (const [when, answers] of Object.entries(orders)) if (when !== "maybe session") assert.notEqual(answers[0], SESSION, when);
    // The line her skill listens for, as edit.js says it.
    assert.match(readFileSync(new URL("../edit.js", import.meta.url), "utf8"), /lines\.push\("    Maybe a new version of a client or group session\."\)/);
  });
});
