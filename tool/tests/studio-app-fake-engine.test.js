// The stand-in engine, tool/studio-app/dev/fake-engine.mjs, which a build option puts in place of the real one so that the windows
// can be looked at by hand (Phase 6, Task 11). Each run is started with the test's own node, a temp folder as TMPDIR and
// FAKE_ENGINE_FAST=1, and is answered line by line as the shell would answer it.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_REFUSAL } from "../settings.js";
import { DAMAGED } from "../setup/checks.js";
import { PARTS, eventFault } from "../setup/protocol.js";
import { check, checkerPath, noChecker } from "./studio-app-check.js";

const FAKE = fileURLToPath(new URL("../studio-app/dev/fake-engine.mjs", import.meta.url));
const APP = "/Applications/BRIMM Video Studio.app";
const TOOLS = `${APP}/Contents/Resources/node/bin`;

const ERRORS = ["damaged", "dev", "busy", "download", "install", "settings"];
const SCENARIOS = ["whole", ...ERRORS, "crash", "moved", "fresh"];
const KINDS = ["confirm", "text", "choice", "folder", "apps", "sign-in"];

const newTemp = () => mkdtempSync(join(tmpdir(), "brimm-fake-engine-test-"));

/** The shell's answer to a question of a run of `scenario`, as a line to send, or undefined for a question it does not know. An apps
    question is answered with a row's action first, then with check while a row is not here, then with continue. */
function answerTo(question, scenario) {
  const value = (() => {
    if (question.id === "scenario") return scenario;
    if (question.kind === "confirm") return true;
    if (question.kind === "text" || question.kind === "folder") return question.suggested;
    if (question.kind === "choice") return question.options[0].value;
    if (question.kind === "sign-in") return { code: "sample-code" };
    if (question.kind === "apps") {
      const acting = question.apps.find((a) => a.action);
      if (acting) return acting.action;
      return question.apps.every((a) => a.here) ? "continue" : "check";
    }
    return undefined;
  })();
  return value === undefined ? undefined : { answer: question.id, value };
}

/** Runs the stand-in with `run` in `temp`, answering each question with `reply(event, events)` (undefined sends nothing), and keeps
    its stdin open until it ends. Gives its exit code, its stdout's lines and those lines read as events. */
function drive({ run, temp, reply = () => undefined, limit = 20000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FAKE, "--run", run, "--app", APP, "--tools", TOOLS, "--protocol", "1"], {
      env: { ...process.env, TMPDIR: temp, FAKE_ENGINE_FAST: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const lines = [];
    const events = [];
    let held = "";
    let errors = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`The stand-in's ${run} run did not end. Its lines: ${lines.join("\n")}`));
    }, limit);
    child.stdin.on("error", () => {});
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      const parts = (held + chunk).split("\n");
      held = parts.pop();
      for (const line of parts) {
        lines.push(line);
        const event = JSON.parse(line);
        events.push(event);
        const answer = reply(event, events);
        if (answer !== undefined && !child.stdin.destroyed) child.stdin.write(`${JSON.stringify(answer)}\n`);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (held !== "") lines.push(held);
      resolve({ code, lines, events, errors });
    });
  });
}

/** A setup run of `scenario` in `temp`, answered as the shell would. */
const setupOf = (scenario, temp = newTemp()) => drive({ run: "setup", temp, reply: (e) => (e.event === "question" ? answerTo(e, scenario) : undefined) });

/** The status run's needs in `temp`. */
async function needsIn(temp) {
  const { code, events } = await drive({ run: "status", temp });
  assert.equal(code, 0);
  return events.find((e) => e.event === "summary" && e.id === "status").needs;
}

/** Every file and folder under `dir`, as paths relative to it. */
function listing(dir, at = "") {
  return readdirSync(join(dir, at), { withFileTypes: true }).flatMap((entry) => {
    const path = at ? `${at}/${entry.name}` : entry.name;
    return entry.isDirectory() ? [path, ...listing(dir, path)] : [path];
  });
}

describe("the stand-in engine", () => {
  it("every line of every scenario is a whole event", async () => {
    const runs = [...SCENARIOS.map((scenario) => ["setup", scenario]), ["repair"], ["status"]];
    for (const [run, scenario] of runs) {
      const temp = newTemp();
      const { lines } = run === "setup" ? await setupOf(scenario, temp) : await drive({ run, temp });
      assert.ok(lines.length > 0, `${run} ${scenario ?? ""} said nothing`);
      for (const line of lines) assert.equal(eventFault(JSON.parse(line)), "", `${run} ${scenario ?? ""}: ${line}`);
    }
  });

  it("the whole scenario asks one question of each kind and shows the six bars", async () => {
    const { code, events } = await setupOf("whole");
    assert.equal(code, 0);
    const questions = events.filter((e) => e.event === "question" && e.id !== "scenario");
    assert.deepEqual([...new Set(questions.map((q) => q.kind))].sort(), [...KINDS].sort());
    assert.equal(questions.filter((q) => q.warning).length, 1);
    assert.equal(questions.filter((q) => q.fault).length, 1);
    const apps = questions.filter((q) => q.kind === "apps");
    const hereIn = (q) => q.apps.filter((a) => a.here).length;
    assert.equal(hereIn(apps[0]), 0);
    assert.equal(hereIn(apps[apps.length - 1]), apps[0].apps.length);
    for (let i = 1; i < apps.length; i += 1) assert.ok([0, 1].includes(hereIn(apps[i]) - hereIn(apps[i - 1])), "a row turns here one at a time");
    const actions = new Set(apps.flatMap((q) => q.apps.map((a) => a.action).filter(Boolean)));
    assert.deepEqual([...actions].sort(), ["install-claude-code", "sign-in"]);
    const bars = events.filter((e) => e.event === "progress");
    assert.deepEqual([...new Set(bars.map((b) => b.part))], PARTS);
    for (const bar of bars) assert.equal(bar.total === null, bar.part !== "model", JSON.stringify(bar));
    assert.ok(PARTS.every((part) => bars.filter((b) => b.part === part).pop().state === "done"));
    const review = events.find((e) => e.event === "summary" && e.id === "review");
    assert.equal(typeof review.details, "string");
    assert.ok(events.some((e) => e.event === "summary" && e.id === "setup"));
    const done = events[events.length - 1];
    assert.equal(done.event, "done");
    assert.equal(done.outcome, "installed");
    assert.equal(done.notes.length, 2);
    assert.notEqual(done.guide, null);
  });

  for (const code of ERRORS) {
    it(`the ${code} scenario ends with error ${code}`, async () => {
      const { code: exit, events } = await setupOf(code);
      assert.equal(exit, 1);
      const last = events[events.length - 1];
      assert.equal(last.event, "error");
      assert.equal(last.code, code);
      assert.equal(events.filter((e) => e.event === "step").length, 2);
      if (code === "damaged") assert.equal(last.message, DAMAGED);
      if (code === "dev") assert.equal(last.message, DEV_REFUSAL);
    });
  }

  it("the crash scenario ends with no last event", async () => {
    const { code, events } = await setupOf("crash");
    assert.equal(code, 1);
    assert.deepEqual(events.slice(1).map((e) => e.event), ["step"]);
  });

  it("status says what the last run left", async () => {
    const temp = newTemp();
    assert.equal(await needsIn(temp), "setup");
    await setupOf("whole", temp);
    assert.equal(await needsIn(temp), "nothing");
    const moved = await setupOf("moved", temp);
    assert.equal(moved.events[moved.events.length - 1].outcome, "cancelled");
    assert.equal(await needsIn(temp), "repair");
    await setupOf("fresh", temp);
    assert.equal(await needsIn(temp), "setup");
    const { events } = await drive({ run: "status", temp });
    assert.equal(events.find((e) => e.event === "summary").lines.length, 6);
    assert.equal(events[events.length - 1].outcome, "status");
  });

  it("a repair shows the two steps and the six bars, and leaves nothing to do", async () => {
    const temp = newTemp();
    const { code, events } = await drive({ run: "repair", temp });
    assert.equal(code, 0);
    assert.deepEqual(events.filter((e) => e.event === "step").map((e) => e.id), ["install", "done"]);
    assert.deepEqual([...new Set(events.filter((e) => e.event === "progress").map((e) => e.part))], PARTS);
    const done = events[events.length - 1];
    assert.equal(done.outcome, "repaired");
    assert.notEqual(done.guide, null);
    assert.equal(await needsIn(temp), "nothing");
  });

  it("a back sends the question before again, and a cancel before the install ends the run", async () => {
    let backed = false;
    const reply = (e) => {
      if (e.event !== "question") return undefined;
      if (e.id === "scenario") return answerTo(e, "whole");
      if (e.id === "name" && !backed) {
        backed = true;
        return { back: true };
      }
      if (e.id === "name") return { cancel: true };
      return answerTo(e, "whole");
    };
    const { code, events } = await drive({ run: "setup", temp: newTemp(), reply });
    assert.equal(code, 0);
    const asked = events.filter((e) => e.event === "question").map((e) => e.id);
    assert.deepEqual(asked, ["scenario", "welcome", "name", "welcome", "name"]);
    const last = events[events.length - 1];
    assert.equal(last.event, "done");
    assert.equal(last.outcome, "cancelled");
  });

  it("stdin closing before the install ends the run as a cancel", async () => {
    const temp = newTemp();
    const child = spawn(process.execPath, [FAKE, "--run", "setup", "--app", APP, "--tools", TOOLS, "--protocol", "1"], { env: { ...process.env, TMPDIR: temp, FAKE_ENGINE_FAST: "1" } });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stdin.end();
    const code = await new Promise((resolve) => child.on("close", resolve));
    assert.equal(code, 0);
    const last = JSON.parse(out.trim().split("\n").pop());
    assert.equal(last.outcome, "cancelled");
  });

  it("it writes only in its own folder", async () => {
    const temp = newTemp();
    const before = listing(temp);
    await setupOf("whole", temp);
    await drive({ run: "repair", temp });
    await drive({ run: "status", temp });
    const added = listing(temp).filter((path) => !before.includes(path));
    assert.ok(added.length > 0);
    assert.deepEqual(added.filter((path) => path !== "brimm-fake-engine" && !path.startsWith("brimm-fake-engine/")), []);
  });
});

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the stand-in engine and the shell", { skip: noChecker }, () => {
  it("the shell understands every line of every scenario", async () => {
    const runs = [...SCENARIOS.map((scenario) => ["setup", scenario]), ["repair"], ["status"]];
    for (const [run, scenario] of runs) {
      const { lines } = run === "setup" ? await setupOf(scenario) : await drive({ run, temp: newTemp() });
      const ran = check("state", ["--ended"], { input: `${lines.join("\n")}\n` });
      assert.equal(ran.status, 0, ran.stderr);
      assert.equal(ran.json.undecoded, 0, `${run} ${scenario ?? ""}`);
      if (scenario === "whole") {
        assert.equal(ran.json.rows.length, 9);
        assert.ok(ran.json.rows.every((r) => r.mark === "done"), JSON.stringify(ran.json.rows));
      }
    }
  });
});
