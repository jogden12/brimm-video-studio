// The window's state, from tool/studio-app/Sources/State.swift, made from the engine's six events and asked through studio-check
// (Phase 6, Task 6). The real engine's events come from setup-harness.js's made-up Macs.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { drive, mac } from "./setup-harness.js";
import { check, checkerPath, noChecker } from "./studio-app-check.js";

const CRASH_MESSAGE = "BRIMM Video Studio's setup stopped on a fault of its own.";
const CRASH_ADVICE = "Open BRIMM Video Studio and choose Repair.";
const EVERY_APP = ["claude-app", "dropbox", "hyperframes"];

/** studio-check's answer to `command` with `args`, which must have ended with 0. */
function ask(command, args = [], options) {
  const ran = check(command, args, options);
  assert.equal(ran.status, 0, `studio-check ${command} ${args.join(" ")} ended with ${ran.status}: ${ran.stderr}`);
  return ran.json;
}

/** The state that `lines` make, each line an event object or a text, with the command's `flags`. */
const stateOf = (lines, flags = []) => ask("state", flags, { input: lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n" });
const marksOf = (state) => state.rows.map((r) => r.mark);

/** Answers every question by its id from `table`, a value or a function of the question: setup-engine.test.js's reply and FRESH
    in small. A question sent again, with a warning, is answered again. */
const answerer = (table) => (event) => {
  if (event.event !== "question" || !Object.hasOwn(table, event.id)) return undefined;
  const given = table[event.id];
  return { answer: event.id, value: typeof given === "function" ? given(event) : given };
};
const FRESH = { welcome: true, name: "Studio Test", apps: "continue", "drop-folder": (q) => q.suggested, "exports-folder": (q) => q.suggested, review: true };
const HELD = { welcome: true, apps: "continue", review: true };

/** The events of the real engine's `run` on a made-up Mac of `options`, answered from `table`. */
async function eventsOf(options, run, table = {}) {
  const m = mac(options);
  try {
    const { code, events } = await drive(m, { run, answers: answerer(table) });
    assert.equal(code, 0, JSON.stringify(events[events.length - 1]));
    return events;
  } finally {
    m.done();
  }
}

// Small events of the right shapes.
const step = (id, n, of = 9) => ({ event: "step", id, n, of, title: id, body: [] });
const confirm = (id, more = {}) => ({ event: "question", id, kind: "confirm", prompt: "Go on?", ok: "Continue", ...more });

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the window's state, from the real engine", { skip: noChecker }, () => {
  it("every event of a whole fresh setup by the real engine is understood", async () => {
    const events = await eventsOf({ settings: "none", apps: EVERY_APP }, "setup", FRESH);
    const state = stateOf(events);
    assert.equal(state.undecoded, 0);
    assert.equal(state.done.outcome, "installed");
    assert.deepEqual(state.rows.map((r) => r.id), ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"]);
    assert.ok(state.rows.every((r) => r.mark === "done"), JSON.stringify(state.rows));
    assert.equal(state.running, false);
    assert.equal(state.installing, false);
    assert.equal(state.failure, null);
  });

  it("the shell's step lists are the engine's own", async () => {
    const stepsIn = (events) => events.filter((e) => e.event === "step").map((e) => ({ id: e.id, title: e.title }));
    assert.deepEqual(stepsIn(await eventsOf({ settings: "none", apps: EVERY_APP }, "setup", FRESH)), ask("steps", ["9"]));
    assert.deepEqual(stepsIn(await eventsOf({ settings: "takeover", apps: EVERY_APP }, "setup", HELD)), ask("steps", ["6"]));
    assert.deepEqual(stepsIn(await eventsOf({ settings: "installed", apps: EVERY_APP }, "repair")), ask("steps", ["2"]));
    assert.deepEqual(ask("steps", ["2"]), [{ id: "install", title: "Install" }, { id: "done", title: "Done" }]);
    assert.deepEqual(ask("steps", ["5"]), []);
  });
});

describe("the window's state, event by event", { skip: noChecker }, () => {
  it("before anything comes, nothing is shown and nothing runs", () => {
    const state = stateOf([], ["--idle"]);
    assert.deepEqual(state, {
      rows: [], step: null, question: null, bars: [], review: null, result: null, status: null, done: null, failure: null,
      running: false, installing: false, awaitingCheck: false, undecoded: 0
    });
    assert.equal(stateOf([]).running, true);
  });

  it("a step marks the rows before it done and itself current", () => {
    const state = stateOf([step("welcome", 1), step("apps", 3)]);
    assert.equal(state.rows.length, 9);
    assert.deepEqual(marksOf(state), ["done", "done", "current", "waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);
    assert.deepEqual(state.rows[2], { id: "apps", title: "Apps", mark: "current" });
    assert.equal(state.step.id, "apps");
    assert.equal(state.step.n, 3);
  });

  it("a step of a list the shell does not know shows only the steps seen so far", () => {
    const state = stateOf([step("welcome", 1, 5), step("apps", 2, 5)]);
    assert.deepEqual(state.rows, [{ id: "welcome", title: "welcome", mark: "done" }, { id: "apps", title: "apps", mark: "current" }]);
  });

  it("a question sent again replaces the open one", () => {
    const state = stateOf([step("welcome", 1), confirm("welcome"), confirm("welcome", { fault: "Choose Continue to go on." })]);
    assert.equal(state.question.id, "welcome");
    assert.equal(state.question.kind, "confirm");
    assert.equal(state.question.fault, "Choose Continue to go on.");
  });

  it("a step clears the question and the review before it", () => {
    const review = { event: "summary", id: "review", ok: true, lines: [{ label: "Name", value: "Studio Test" }] };
    const asked = stateOf([step("review", 7), review, confirm("review")]);
    assert.equal(asked.review.lines[0].value, "Studio Test");
    assert.equal(asked.question.id, "review");
    const state = stateOf([step("review", 7), review, confirm("review"), step("install", 8)]);
    assert.equal(state.question, null);
    assert.equal(state.review, null);
  });

  it("a summary goes to the review, the result or the status, by its id", () => {
    const summary = (id, more = {}) => ({ event: "summary", id, ok: true, lines: [], ...more });
    const state = stateOf([summary("setup"), summary("status", { needs: "repair", details: "More." })]);
    assert.equal(state.review, null);
    assert.equal(state.result.id, "setup");
    assert.equal(state.status.needs, "repair");
    assert.equal(state.status.details, "More.");
  });

  it("a bar replaces the one of its part, and a new part is added after the others", () => {
    const bar = (part, state, done = 0, total = null) => ({ event: "progress", part, label: part, done, total, state });
    const state = stateOf([bar("programs", "running"), bar("model", "running", 10, 100), bar("programs", "done"), bar("installer", "waiting")]);
    assert.deepEqual(state.bars.map((b) => [b.part, b.state]), [["programs", "done"], ["model", "running"], ["installer", "waiting"]]);
    assert.equal(state.bars[0].total, null);
    assert.deepEqual([state.bars[1].done, state.bars[1].total], [10, 100]);
  });

  it("an error ends the run and keeps its words", () => {
    const state = stateOf([step("apps", 3), confirm("apps"), { event: "error", code: "dev", message: "This Mac is for development.", advice: "Use the checkout." }]);
    assert.equal(state.failure.code, "dev");
    assert.equal(state.failure.message, "This Mac is for development.");
    assert.equal(state.failure.advice, "Use the checkout.");
    assert.equal(state.question, null);
    assert.equal(state.running, false);
    assert.equal(state.rows[2].mark, "current");
  });

  it("a cancelled run leaves its rows as they were", () => {
    const done = (outcome) => ({ event: "done", outcome, summary: "", studio: "", guide: null, notes: [] });
    const cancelled = stateOf([step("apps", 3), confirm("apps"), done("cancelled")]);
    assert.deepEqual(marksOf(cancelled), ["done", "done", "current", "waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);
    assert.equal(cancelled.question, null);
    assert.equal(cancelled.running, false);
    assert.equal(cancelled.done.outcome, "cancelled");
    assert.ok(marksOf(stateOf([step("apps", 3), done("installed")])).every((mark) => mark === "done"));
  });

  it("a run that ends with neither done nor error shows the engine's own last words", () => {
    const state = stateOf([step("welcome", 1), confirm("welcome")], ["--ended"]);
    assert.deepEqual(state.failure, { code: "engine", message: CRASH_MESSAGE, advice: CRASH_ADVICE, contact: null, details: null });
    assert.equal(state.running, false);
    const error = { event: "error", code: "busy", message: "A video is being taken in." };
    assert.equal(stateOf([step("welcome", 1), error], ["--ended"]).failure.code, "busy");
  });

  it("a line that is no event is counted, never shown", () => {
    const events = [step("welcome", 1), confirm("welcome")];
    const before = stateOf(events);
    const state = stateOf([...events, { event: "note" }, { event: "question", id: "x", kind: "slider", prompt: "How much?" }, "hello"]);
    assert.equal(state.undecoded, 3);
    assert.deepEqual({ ...state, undecoded: 0 }, before);
  });

  it("an event that lacks a field its kind must have is not one", () => {
    const state = stateOf([{ event: "question", id: "name", kind: "text", prompt: "Name?" }, { event: "step", id: "welcome", n: 1, title: "Welcome", body: [] }]);
    assert.equal(state.undecoded, 2);
    assert.equal(state.question, null);
  });

  it("the installer's step sets installing, and the end clears it", () => {
    const events = [step("review", 7), step("install", 8)];
    assert.equal(stateOf([step("review", 7)]).installing, false);
    const installing = stateOf(events);
    assert.equal(installing.installing, true);
    assert.equal(installing.running, true);
    const ended = stateOf(events, ["--ended"]);
    assert.equal(ended.installing, false);
    assert.equal(ended.running, false);
  });

  it("a sent check is awaited, and an apps question is shown with every field", () => {
    const apps = { event: "question", id: "apps", kind: "apps", prompt: "Apps", apps: [{ id: "dropbox", name: "Dropbox", here: true }] };
    assert.equal(stateOf([apps], ["--sent-check"]).awaitingCheck, true);
    assert.equal(stateOf([apps]).awaitingCheck, false);
    const state = stateOf([apps]);
    assert.deepEqual(state.question.apps, [{ id: "dropbox", name: "Dropbox", here: true, link: null, note: null, action: null }]);
  });
});
