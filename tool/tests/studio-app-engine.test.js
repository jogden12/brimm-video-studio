// The engine's client, from tool/studio-app/Sources/EngineClient.swift, run through studio-check's drive command (Phase 6, Task 8).
// Each stand-in engine is a small node script the test writes and starts with the test's own node.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkerPath, noChecker } from "./studio-app-check.js";

/**
 * The start of every stand-in. `say` writes one event and its line feed in one write to fd 1, which is never opened as a stream, so a
 * stand-in that ends at once has written everything. `next()` gives the next line of stdin, or null once stdin has ended; `ended`
 * says whether it has. `keep(line)` adds a line to the file `got`.
 */
const PRELUDE = (got) => `
import { appendFileSync, writeSync } from "node:fs";
const say = (event) => writeSync(1, JSON.stringify(event) + "\\n");
const keep = (line) => appendFileSync(${JSON.stringify(got)}, line + "\\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ended = false;
let buffered = "";
const lines = [];
const waiting = [];
const give = () => {
  while (waiting.length && (lines.length || ended)) waiting.shift()(lines.length ? lines.shift() : null);
};
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffered += chunk;
  let at;
  while ((at = buffered.indexOf("\\n")) >= 0) {
    lines.push(buffered.slice(0, at));
    buffered = buffered.slice(at + 1);
  }
  give();
});
process.stdin.on("end", () => {
  ended = true;
  give();
});
const next = () => new Promise((resolve) => { waiting.push(resolve); give(); });
const step = { event: "step", id: "welcome", n: 1, of: 9, title: "Welcome", body: [] };
const question = (id = "welcome", more = {}) => ({ event: "question", id, kind: "confirm", prompt: "Go on?", ok: "Continue", ...more });
const done = { event: "done", outcome: "set-up", summary: "All set.", studio: "/x", notes: [] };
`;

/** The folders this file has made, each removed when the file ends. */
const folders = [];
after(() => {
  for (const dir of folders) rmSync(dir, { recursive: true, force: true });
});

/** A new folder with a stand-in engine whose body is `body`, an answers file holding `answers`, one JSON array a line, and the path of
    the stand-in's `got` file. */
function standIn(body, answers = []) {
  const folder = mkdtempSync(join(tmpdir(), "brimm-studio-engine-"));
  folders.push(folder);
  const got = join(folder, "got");
  const script = join(folder, "engine.mjs");
  writeFileSync(script, `${PRELUDE(got)}\n${body}\n`);
  const answersFile = join(folder, "answers");
  writeFileSync(answersFile, answers.map((a) => JSON.stringify(a)).join("\n") + (answers.length ? "\n" : ""));
  return { script, answersFile, got };
}

/** studio-check drive on a stand-in, with `flags` before the answers file: { status, stdout, stderr, lines }, `lines` each parsed. */
function drive(made, flags = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(checkerPath(), ["drive", ...flags, made.answersFile, process.execPath, made.script], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const limit = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`drive took too long. stdout:\n${stdout.slice(-2000)}\nstderr:\n${stderr}`));
    }, 20000);
    child.on("error", reject);
    child.on("close", (status) => {
      clearTimeout(limit);
      const lines = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
      resolve({ status, stdout, stderr, lines });
    });
  });
}

/** The names of the event lines, and the end line, of a drive's output. The end line must be the last. */
function told(ran) {
  assert.equal(ran.status, 0, ran.stderr);
  const end = ran.lines[ran.lines.length - 1];
  assert.ok(end && Object.hasOwn(end, "ended"), `the last line is not the end: ${ran.stdout.slice(-500)}`);
  const events = ran.lines.slice(0, -1);
  for (const line of events) assert.ok(typeof line.event === "string", `not an event line: ${JSON.stringify(line)}`);
  return { names: events.map((e) => e.event), events, end };
}

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the engine's client", { skip: noChecker }, () => {
  it("events come one a line, in order, and the end comes last", async () => {
    const made = standIn(
      `say(step);
say(question());
const line = await next();
keep(line);
say(done);
process.exit(0);`,
      [["confirm"]]
    );
    const { names, events, end } = told(await drive(made));
    assert.deepEqual(names, ["step", "question", "done"]);
    assert.equal(events[0].id, "welcome");
    assert.equal(events[1].id, "welcome");
    assert.deepEqual(end, { ended: 0, undecoded: 0 });
    assert.deepEqual(JSON.parse(readFileSync(made.got, "utf8")), { answer: "welcome", value: true });
  });

  it("every line comes before the end, however fast the engine ends", async () => {
    const made = standIn(`for (let i = 0; i < 500; i++) say({ event: "progress", part: "copy", label: "Copying", done: i, total: 500, state: "running" });
say(done);
process.exit(0);`);
    for (let run = 0; run < 20; run++) {
      const { names, end } = told(await drive(made));
      assert.equal(names.length, 501, `run ${run}`);
      assert.equal(names.filter((n) => n === "progress").length, 500, `run ${run}`);
      assert.equal(names[500], "done", `run ${run}`);
      assert.deepEqual(end, { ended: 0, undecoded: 0 });
    }
  });

  it("the end waits for stdout's end, even after the process has gone", async () => {
    // A child of the stand-in holds stdout open and writes the done after the stand-in itself has ended.
    const made = standIn(`import { spawn } from "node:child_process";
const late = \`setTimeout(() => require("node:fs").writeSync(1, \${JSON.stringify(JSON.stringify(done) + "\\n")}), 300)\`;
spawn(process.execPath, ["-e", late], { stdio: ["ignore", "inherit", "ignore"], detached: true }).unref();
say(step);
process.exit(0);`);
    const { names, end } = told(await drive(made));
    assert.deepEqual(names, ["step", "done"]);
    assert.deepEqual(end, { ended: 0, undecoded: 0 });
  });

  it("stdin stays open until the engine ends", async () => {
    const made = standIn(
      `say(question());
await next();
await sleep(300);
if (!ended) say(done);
process.exit(0);`,
      [["confirm"]]
    );
    const { names, end } = told(await drive(made));
    assert.deepEqual(names, ["question", "done"]);
    assert.equal(end.ended, 0);
  });

  it("an event split across two writes is one event", async () => {
    const made = standIn(`const line = JSON.stringify(done) + "\\n";
const half = Math.floor(line.length / 2);
writeSync(1, line.slice(0, half));
await sleep(200);
writeSync(1, line.slice(half));
process.exit(0);`);
    const { names, events, end } = told(await drive(made));
    assert.deepEqual(names, ["done"]);
    assert.equal(events[0].summary, "All set.");
    assert.deepEqual(end, { ended: 0, undecoded: 0 });
  });

  it("a pasted code reaches the engine and is nowhere in what the client says", async () => {
    const made = standIn(
      `say({ event: "question", id: "claude-sign-in", kind: "sign-in", prompt: "Paste the code.", paste: true });
keep(await next());
say(done);
process.exit(0);`,
      [["sign-in", "ABC-123-XYZ"]]
    );
    const ran = await drive(made);
    const { names } = told(ran);
    assert.deepEqual(names, ["question", "done"]);
    assert.equal(readFileSync(made.got, "utf8"), '{"answer":"claude-sign-in","value":{"code":"ABC-123-XYZ"}}\n');
    assert.ok(!ran.stdout.includes("ABC-123-XYZ"), ran.stdout);
    assert.ok(!ran.stderr.includes("ABC-123-XYZ"), ran.stderr);
  });

  it("an engine that ends without done or error is told as it is", async () => {
    const made = standIn(`say(step);
process.exit(1);`);
    const { names, end } = told(await drive(made));
    assert.deepEqual(names, ["step"]);
    assert.ok(!names.includes("done") && !names.includes("error"));
    assert.equal(end.ended, 1);
  });

  it("a great deal on stderr does not stop the engine", async () => {
    const made = standIn(`writeSync(2, "x".repeat(1024 * 1024));
say(done);
process.exit(0);`);
    const ran = await drive(made);
    const { names, end } = told(ran);
    assert.deepEqual(names, ["done"]);
    assert.equal(end.ended, 0);
    assert.equal(ran.stderr, "");
  });

  it("back and cancel are their own lines", async () => {
    const made = standIn(
      `say(question("first"));
keep(await next());
say(question("second"));
keep(await next());
say(done);
process.exit(0);`,
      [["back"], ["cancel"]]
    );
    const { names } = told(await drive(made));
    assert.deepEqual(names, ["question", "question", "done"]);
    assert.equal(readFileSync(made.got, "utf8"), '{"back":true}\n{"cancel":true}\n');
  });

  it("an answer after the engine has ended does nothing", async () => {
    const made = standIn(`say(done);
process.exit(0);`, [["confirm"]]);
    const { names, end } = told(await drive(made, ["--answer-after-end"]));
    assert.deepEqual(names, ["done"]);
    assert.deepEqual(end, { ended: 0, undecoded: 0 });
  });

  it("an answer to an engine that has stopped reading goes into a dead pipe, and the client still ends", async () => {
    // The stand-in closes its stdin and only then asks, so the answer is written to a pipe nobody reads while the engine still
    // runs: without SIGPIPE ignored, or with a write that is not guarded, the checker would die on it.
    const made = standIn(
      `process.stdin.destroy();
(await import("node:fs")).closeSync(0);
await sleep(200);
say(question());
await sleep(500);
say(done);
process.exit(0);`,
      [["confirm"]]
    );
    const { names, end } = told(await drive(made));
    assert.deepEqual(names, ["question", "done"]);
    assert.deepEqual(end, { ended: 0, undecoded: 0 });
  });

  it("a line that is no event is counted, and not told as one", async () => {
    const made = standIn(`writeSync(1, "not an event\\n");
say(done);
process.exit(0);`);
    const { names, end } = told(await drive(made));
    assert.deepEqual(names, ["done"]);
    assert.deepEqual(end, { ended: 0, undecoded: 1 });
  });
});
