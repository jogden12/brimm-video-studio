// The card in code (design 2026-10-26, section 5, "The card's receipt, with the open lock"; R10, R28): her card's two questions and
// each set of answers it may offer, and the follow-up for a Zoom download or sound alone, are fixed in receipts.js, with only the
// label and a video's name put in. `episodes` prints the exact card under each video waiting for her answer, and `kind` the
// follow-up after it says to ask first. A hook after each card she answers writes a receipt of her answers, and `kind`, under Claude
// Code on an open-lock Mac, answers a video with no kind only with one. Each test is a made-up Mac of its own (episodes.js, or a
// home of its own for the hook); no real program runs but node and /bin/sh for the hook as committed.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NO_RECEIPT, PRIVATE_Q, WHAT_Q, cardOf, expectedAnswers, formOf, notSessionCardOf, receiptFrom, receiptWhy, receiptsFolder, writeReceipt } from "../receipts.js";
import { editMain } from "../edit.js";
import { readEpisode } from "../episode.js";
import { setup, episodeFor, episodeAs } from "./episodes.js";
import { MINIMUM } from "./open-world.js";

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

/** The hook's input after a card was answered: AskUserQuestion's result `response`, and what Claude asked with, `asked`. */
const hookInput = (response, asked = { questions: response.questions }) => ({ session_id: "11111111-2222-4333-8444-555555555555", hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_input: asked, tool_response: response });
/** A result of `card` answered with `picks`, one option label for each question, in order. */
const answered = (card, picks) => ({ questions: card.questions, answers: Object.fromEntries(card.questions.map((q, i) => [q.question, picks[i]])) });
const NOW = Date.parse("2026-10-20T15:00:00-05:00");
const HOUR = 60 * 60 * 1000;
/** A home of its own, with her folder in it. */
function home() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-receipts-")));
  return { home: dir, folder: join(dir, "BRIMM Video Studio"), done: () => rmSync(dir, { recursive: true, force: true }) };
}
/** The receipts written on the Mac of `home`, each as it was written. */
const receiptsIn = (home) => (existsSync(receiptsFolder(home)) ? readdirSync(receiptsFolder(home)).sort().map((name) => ({ name, receipt: JSON.parse(readFileSync(join(receiptsFolder(home), name), "utf8")) })) : []);
const RESULT = JSON.parse(readFileSync(new URL("./fixtures/ask-user-question-result.json", import.meta.url), "utf8"));
/** The receipt hook as committed in this checkout. */
const RECEIPT_SH = fileURLToPath(new URL("../studio/receipt.sh", import.meta.url));

describe("the card's receipt", () => {
  it("writes a receipt for a card in each fixed form, from her answers in the result", () => {
    const h = home();
    for (const label of [LABEL, "Sallie's \"Q&A\": part 2"]) {
      for (const [card, form] of everyCard(label)) {
        for (const pick of [0, 1]) {
          const picks = card.questions.map((q) => q.options[Math.min(pick, q.options.length - 1)].label);
          const receipt = receiptFrom(hookInput(answered(card, picks)), NOW);
          assert.deepEqual(receipt, { at: NOW, label, form, answers: answered(card, picks).answers }, JSON.stringify(card));
          writeReceipt(h.home, receipt);
        }
      }
    }
    const written = receiptsIn(h.home);
    assert.equal(written.length, 2 * 2 * everyCard(LABEL).length);
    for (const { name, receipt } of written) {
      assert.match(name, /^receipt-\d+-[0-9a-f]{6}\.json$/);
      assert.equal(receipt.at, NOW);
    }
    // The fixture of AskUserQuestion's result, as 2.1.308's output schema shapes it.
    assert.deepEqual(receiptFrom(hookInput(RESULT), NOW), { at: NOW, label: LABEL, form: "what", answers: RESULT.answers });
    h.done();
  });

  it("writes none for a card worded otherwise, one left idle (afkTimeoutMs), one with followUp, a question unanswered or answered in Other's words, or answers only in what Claude asked with", () => {
    const card = cardOf({ label: LABEL, guess: "raw" });
    const good = answered(card, ["Raw with retakes", "No"]);
    assert.ok(receiptFrom(hookInput(good), NOW));
    const otherCard = { questions: [{ question: "Talk 3: is the sound clear?", options: [{ label: "Finished" }, { label: "Raw" }] }, { question: "Make it louder?", options: [{ label: "Yes" }, { label: "No" }] }] };
    for (const [what, input] of [
      ["a card worded otherwise", hookInput(answered(otherCard, ["Finished", "No"]))],
      ["left idle", hookInput({ ...good, afkTimeoutMs: 60000 })],
      ["left idle, its time null", hookInput({ ...good, afkTimeoutMs: null })],
      ["a followUp", hookInput({ ...good, followUp: "She asked something else" })],
      ["a question unanswered", hookInput({ ...good, answers: { [card.questions[0].question]: "Raw with retakes" } })],
      ["an answer empty", hookInput({ ...good, answers: { ...good.answers, [PRIVATE_Q]: "" } })],
      ["answered in Other's words", hookInput({ ...good, answers: { ...good.answers, [card.questions[0].question]: "It's a podcast" } })],
      ["two answers to one question", hookInput({ ...good, answers: { ...good.answers, [card.questions[0].question]: "Raw with retakes, iPhone clip" } })],
      ["answers that are not words", hookInput({ ...good, answers: { ...good.answers, [PRIVATE_Q]: ["No"] } })],
      ["no answers", hookInput({ questions: good.questions })],
      ["answers only in what Claude asked with", hookInput({ questions: good.questions }, { questions: good.questions, answers: good.answers })],
      ["questions only in what Claude asked with", hookInput({ answers: good.answers }, { questions: good.questions })],
      ["no result", { ...hookInput(good), tool_response: undefined }],
      ["a result that is words", { ...hookInput(good), tool_response: JSON.stringify(good) }],
      ["another tool", { ...hookInput(good), tool_name: "Bash" }],
      ["another event", { ...hookInput(good), hook_event_name: "PostToolUseFailure" }],
      ["before the card", { ...hookInput(good), hook_event_name: "PreToolUse" }],
      ["no input", null]]) {
      assert.equal(receiptFrom(input, NOW), null, what);
    }
  });

  it("never writes outside this Mac's receipts folder, nor over a receipt there", () => {
    const h = home();
    const receipt = { at: NOW, label: "../../../../Episodes/x", form: "what", answers: {} };
    writeReceipt(h.home, receipt);
    const [only] = receiptsIn(h.home);
    assert.deepEqual(only.receipt, receipt);
    assert.equal(receiptsFolder(h.home), join(h.home, "Library", "Application Support", "BRIMM Video", "receipts"));
    // A name already taken is never written over: the receipt is not written.
    const taken = join(receiptsFolder(h.home), `receipt-${NOW}-abcdef.json`);
    writeFileSync(taken, "hers");
    assert.equal(writeReceipt(h.home, { ...receipt, label: "Talk 3" }, { hex: () => "abcdef" }), null);
    assert.equal(readFileSync(taken, "utf8"), "hers");
    assert.equal(readdirSync(receiptsFolder(h.home)).length, 2);
    // A receipts folder that is a link elsewhere is not written through.
    const other = home();
    const elsewhere = join(other.home, "elsewhere");
    mkdirSync(elsewhere);
    mkdirSync(dirname(receiptsFolder(other.home)), { recursive: true });
    symlinkSync(elsewhere, receiptsFolder(other.home));
    assert.equal(writeReceipt(other.home, receipt), null);
    assert.deepEqual(readdirSync(elsewhere), []);
    h.done();
    other.done();
  });

  it("is run by /bin/sh from the checkout as committed, and writes the receipt into the home above her folder", () => {
    const h = home();
    const before = Date.now();
    const ran = spawnSync("/bin/sh", [RECEIPT_SH, process.execPath, h.folder], { input: JSON.stringify(hookInput(RESULT)), encoding: "utf8" });
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    const [one, ...more] = receiptsIn(h.home);
    assert.equal(more.length, 0);
    assert.deepEqual({ ...one.receipt, at: 0 }, { at: 0, label: LABEL, form: "what", answers: RESULT.answers });
    assert.ok(one.receipt.at >= before && one.receipt.at <= Date.now());
    // Input that is not a card's result, input that is not JSON, and a node that cannot run write nothing, say nothing, and end 0.
    for (const [input, node] of [[JSON.stringify(hookInput(RESULT, undefined)).replace("PostToolUse", "PreToolUse"), process.execPath], ["not json", process.execPath], [JSON.stringify(hookInput(RESULT)), join(h.home, "no-node")]]) {
      const r = spawnSync("/bin/sh", [RECEIPT_SH, node, h.folder], { input, encoding: "utf8" });
      assert.deepEqual([r.status, r.stdout], [0, ""], input);
    }
    assert.equal(receiptsIn(h.home).length, 1);
    h.done();
  });
});

describe("kind, with the card's receipt", () => {
  /** This Mac's deps, its lock open with its Claude Code named, run under Claude Code. */
  const openKind = (t, more = {}) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, lock: "open" }, minimum: MINIMUM, env: { CLAUDECODE: "1" }, ...more });
  /** A receipt of her answers to the card of the video called `label`, written `ago` before the test's clock. */
  const receiptOf = (t, { label = LABEL, first = "Finished by your editor", second = "No", ago = 0 } = {}) =>
    writeReceipt(t.home, { at: t.now() - ago, label, form: "what", answers: { [WHAT_Q(label)]: first, [PRIVATE_Q]: second } });
  /** A receipt of her answer to the not-a-session card of the video called `label`, as it came. */
  const notSessionReceipt = (t, { label = LABEL, came = null, answer = "It is not a session" } = {}) =>
    writeReceipt(t.home, { at: t.now(), label, form: "not-a-session", answers: { [notSessionCardOf({ label, came }).questions[0].question]: answer } });
  /** The record of `found` is as it was: nothing written. */
  const untouched = (found) => {
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.rev, now.kind, now.editing || null], [found.record.rev, null, null]);
  };
  const cardLine = (answer = ANSWER, label = LABEL) => `    Card: ${JSON.stringify(cardOf({ label, guess: answer.guess, maybe: null }))}`;

  it("says what to ask in the design's words", () => {
    assert.equal(NO_RECEIPT, "Ask her on the card first: only her answer on it answers a video that has no answer yet.");
  });

  it("lets kind answer a waiting video under Claude Code on an open-lock Mac only with a receipt holding her answers", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: null, answer: ANSWER, label: LABEL } });
    for (const [what, write] of [
      ["no receipt", () => {}],
      ["an hour-old one", () => receiptOf(t, { ago: HOUR })],
      ["one from later than now", () => receiptOf(t, { ago: -1000 })],
      ["one for another label", () => receiptOf(t, { label: "Video of 20 Oct, 14:00 (Mac Studio)" })],
      ["another answer to the same question", () => receiptOf(t, { first: "Raw with retakes" })],
      ["another answer to whether it is private", () => receiptOf(t, { second: "Yes" })],
      ["the not-a-session card alone", () => notSessionReceipt(t)]]) {
      write();
      const r = await on(openKind(t), "kind", LABEL, "finished", "--private", "no");
      assert.deepEqual([r.code, r.said], [1, [NO_RECEIPT, cardLine()]], what);
      untouched(found);
    }
    receiptOf(t, { ago: HOUR - 1000 });
    const r = await on(openKind(t), "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(readEpisode(found.folder).record.kind, "finished");
    t.done();
  });

  it("asks for the version the card offered, by its name, when kind names a video it is a new version of", async () => {
    const t = setup();
    episodeAs(t, { id: "e-20261018-0d0d0d", name: "2026-10-18 Pricing talk (Mac Studio)", record: { version: 3, kind: "finished", answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-18T09:00:00-05:00", private: "no" }, name: { text: "Pricing in a minute", placeholder: false } } });
    const found = episodeFor(t, { record: { version: 3, kind: null, answer: { ...ANSWER, match: "e-20261018-0d0d0d" }, label: LABEL } });
    receiptOf(t, { first: "Finished by your editor" });
    const r = await on(openKind(t), "kind", LABEL, "finished", "--private", "no", "--version-of", "0d0d0d");
    assert.equal(r.code, 1, r.said.join("\n"));
    assert.equal(r.said[0], NO_RECEIPT);
    assert.deepEqual(JSON.parse(r.said[1].slice("    Card: ".length)), cardOf({ label: LABEL, guess: "raw", maybe: { name: "Pricing in a minute", kind: "finished" } }));
    untouched(found);
    receiptOf(t, { first: "A new version of Pricing in a minute" });
    assert.equal((await on(openKind(t), "kind", LABEL, "finished", "--private", "no", "--version-of", "0d0d0d")).code, 0);
    t.done();
  });

  it("needs the not-a-session receipt too for --not-a-session", async () => {
    for (const came of ["zoom", "sound", null]) {
      const t = setup();
      const answer = { ...ANSWER, guess: null, came };
      const found = episodeFor(t, { record: { version: 3, kind: null, answer, label: LABEL } });
      receiptOf(t, { first: "Raw with retakes" });
      // Asked first whether it is a session: the receipt of the first card is not enough.
      const r = await on(openKind(t), "kind", LABEL, "raw", "--private", "no", "--not-a-session");
      const notSession = `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: LABEL, came }))}`;
      assert.deepEqual([r.code, r.said], [1, [NO_RECEIPT, cardLine(answer), notSession]], String(came));
      untouched(found);
      // Her answer to the not-a-session card worded for another way it came, or her other answer, is not this receipt.
      notSessionReceipt(t, { came: came === "zoom" ? "sound" : "zoom" });
      notSessionReceipt(t, { came, answer: "It is a client or group session" });
      assert.equal((await on(openKind(t), "kind", LABEL, "raw", "--private", "no", "--not-a-session")).code, 1);
      untouched(found);
      notSessionReceipt(t, { came });
      const given = await on(openKind(t), "kind", LABEL, "raw", "--private", "no", "--not-a-session");
      assert.equal(given.code, 0, given.said.join("\n"));
      t.done();
    }
  });

  it("answers a video as a session on her answer to either card", async () => {
    for (const card of ["what", "not-a-session"]) {
      const t = setup();
      const found = episodeFor(t, { record: { version: 3, kind: null, answer: { ...ANSWER, came: "zoom" }, label: LABEL } });
      assert.equal((await on(openKind(t), "kind", LABEL, "session", "--private", "yes")).code, 1);
      untouched(found);
      if (card === "what") receiptOf(t, { first: "Client or group session", second: "Yes" });
      else notSessionReceipt(t, { came: "zoom", answer: "It is a client or group session" });
      const r = await on(openKind(t), "kind", LABEL, "session", "--private", "yes");
      assert.equal(r.code, 0, `${card}: ${r.said.join("\n")}`);
      assert.equal(readEpisode(found.folder).record.kind, "session");
      t.done();
    }
  });

  it("refuses kind on a video she left alone without a receipt, and prints its card after the refusal", async () => {
    const t = setup();
    const answer = { ...ANSWER, state: "not for brimm-video" };
    const found = episodeFor(t, { record: { version: 3, kind: null, answer, label: LABEL } });
    const r = await on(openKind(t), "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [NO_RECEIPT, cardLine(answer)]]);
    untouched(found);
    // Its listing in `episodes` stays as it is: no card under it.
    const listed = (await on(openKind(t), "episodes")).said;
    assert.ok(!listed.some((line) => line.startsWith("    Card")), listed.join("\n"));
    receiptOf(t);
    assert.equal((await on(openKind(t), "kind", LABEL, "finished", "--private", "no")).code, 0);
    t.done();
  });

  it("needs no receipt in Terminal, on a strict-lock Mac (one whose settings say open while no Claude Code is named for it among them), or for a video already answered", async () => {
    for (const [what, deps] of [
      ["in Terminal", (t) => openKind(t, { env: {} })],
      ["CLAUDECODE not 1", (t) => openKind(t, { env: { CLAUDECODE: "0" } })],
      ["settings open, no Claude Code named", (t) => openKind(t, { minimum: null })],
      ["settings with no lock", (t) => openKind(t, { settings: t.ctx.settings })],
      ["settings strict", (t) => openKind(t, { settings: { ...t.ctx.settings, lock: "strict" } })]]) {
      const t = setup();
      episodeFor(t, { record: { version: 3, kind: null, answer: ANSWER, label: LABEL } });
      const r = await on(deps(t), "kind", LABEL, "finished", "--private", "no");
      assert.equal(r.code, 0, `${what}: ${r.said.join("\n")}`);
      t.done();
    }
    // A video answered already, answered again, needs none.
    const t = setup();
    const answeredBefore = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-20T14:00:00-05:00", private: "no" };
    episodeFor(t, { record: { version: 3, kind: "raw", answer: answeredBefore, label: LABEL, name: { text: "Pricing talk", placeholder: false } } });
    const r = await on(openKind(t), "kind", "Pricing talk", "finished", "--private", "no", "--again");
    assert.ok(!r.said.includes(NO_RECEIPT), r.said.join("\n"));
    t.done();
  });

  it("finds a receipt only for the expected answers of each form", () => {
    const h = home();
    const expected = expectedAnswers({ label: LABEL, stored: "raw", maybeName: null, maybeKind: null, notASession: true, came: "zoom" });
    assert.deepEqual(expected, [
      { form: "what", answers: { [WHAT_Q(LABEL)]: "Raw with retakes", [PRIVATE_Q]: "No" } },
      { form: "not-a-session", answers: { [notSessionCardOf({ label: LABEL, came: "zoom" }).questions[0].question]: "It is not a session" } }
    ]);
    for (const [given, first] of [
      [{ stored: "finished" }, "Finished by your editor"], [{ stored: "short video" }, "iPhone clip"], [{ stored: "session" }, "Client or group session"],
      [{ stored: "finished", maybeName: "Pricing talk", maybeKind: "finished" }, "A new version of Pricing talk"],
      [{ stored: "short video", maybeName: "Pricing talk", maybeKind: "short video" }, "A new version of Pricing talk"],
      [{ stored: "finished", maybeName: "Pricing talk", maybeKind: "raw" }, "A finished version of Pricing talk"],
      [{ stored: "raw", maybeName: "Pricing talk", maybeKind: "raw" }, "Raw with retakes"]]) {
      assert.equal(expectedAnswers({ label: LABEL, maybeName: null, maybeKind: null, notASession: false, ...given })[0].answers[WHAT_Q(LABEL)], first, JSON.stringify(given));
    }
    // No card offers a raw new version of a finished video: nothing answers it.
    assert.equal(receiptWhy({ home: h.home, expected: expectedAnswers({ label: LABEL, stored: "raw", maybeName: "Pricing talk", maybeKind: "finished", notASession: false }), now: NOW }), NO_RECEIPT);
    // A receipt folder that is not there, or a file in it that is not a receipt, answers nothing.
    assert.equal(receiptWhy({ home: h.home, expected, now: NOW }), NO_RECEIPT);
    mkdirSync(receiptsFolder(h.home), { recursive: true });
    writeFileSync(join(receiptsFolder(h.home), `receipt-${NOW}-000000.json`), "not json");
    writeFileSync(join(receiptsFolder(h.home), "notes.json"), JSON.stringify({ at: NOW, label: LABEL, form: "what", answers: expected[0].answers }));
    assert.equal(receiptWhy({ home: h.home, expected, now: NOW }), NO_RECEIPT);
    for (const one of expected) writeReceipt(h.home, { at: NOW, label: LABEL, ...one });
    assert.equal(receiptWhy({ home: h.home, expected, now: NOW }), "");
    h.done();
  });
});
