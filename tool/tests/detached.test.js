// Long commands run detached (detached.js): one run at a time for an episode, holding its lock, the Mac kept awake, and a
// result file that `status` reads after. Each test has a home folder of its own; keeping awake and starting a program are
// stand-ins. Nothing here starts a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDetached, runDetached, resultFile, readResult, runningCommand, lockOf } from "../detached.js";

const FOLDER = "2026-10-13 Talk (Mac Studio)";

function setup() {
  const home = mkdtempSync(join(tmpdir(), "brimm-detached-"));
  const awake = [];
  let clock = Date.parse("2026-10-14T12:00:00");
  const opts = { home, folder: FOLDER, keepAwake: (pid) => awake.push(pid), alive: () => false, now: () => (clock += 1000) };
  return { home, awake, opts, done: () => rmSync(home, { recursive: true, force: true }) };
}

describe("a command run detached", () => {
  it("runs the work holding the episode's lock, kept awake, and writes its result", async () => {
    const t = setup();
    let held = null;
    const r = await runDetached({ ...t.opts, command: "bring" }, async () => {
      held = runningCommand(t.home, FOLDER, () => true);
      return { ok: true, made: ["Talk.mov"], failed: [], next: 'Say "open Talk" again.' };
    });
    assert.equal(held, "bring");
    assert.deepEqual(t.awake, [process.pid]);
    assert.deepEqual(r, readResult(t.home, FOLDER, "bring"));
    assert.deepEqual({ ...r, started: 0, ended: 0 }, { version: 1, command: "bring", started: 0, ended: 0, ok: true, made: ["Talk.mov"], failed: [], next: 'Say "open Talk" again.' });
    assert.ok(r.ended > r.started);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    assert.equal(resultFile(t.home, FOLDER, "bring"), join(t.home, "BRIMM Video Work", FOLDER, "bring.result.json"));
    t.done();
  });
  it("starts nothing when another run holds the episode's lock, and says which", async () => {
    const t = setup();
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "finish" }));
    let ran = false;
    const r = await runDetached({ ...t.opts, command: "bring", alive: (pid) => pid === 4242 }, async () => {
      ran = true;
      return { ok: true, made: [], failed: [], next: "" };
    });
    assert.deepEqual([r, ran, runningCommand(t.home, FOLDER, (pid) => pid === 4242)], [{ running: "finish" }, false, "finish"]);
    t.done();
  });
  it("takes over a lock its run left when it died", async () => {
    const t = setup();
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "bring" }));
    const r = await runDetached({ ...t.opts, command: "bring" }, async () => ({ ok: true, made: [], failed: [], next: "" }));
    assert.equal(r.ok, true);
    assert.equal(runningCommand(t.home, FOLDER, () => false), "");
    t.done();
  });
  it("writes a result that says what went wrong when the work throws, and lets the lock go", async () => {
    const t = setup();
    const r = await runDetached({ ...t.opts, command: "bring" }, async () => {
      throw Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
    });
    assert.deepEqual([r.ok, r.failed], [false, ["The work stopped (ENOSPC)."]]);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    assert.deepEqual(readdirSync(join(t.home, "BRIMM Video Work", FOLDER)), ["bring.result.json"]);
    t.done();
  });
  it("is started detached, with this checkout's edit.js, and returns at once", () => {
    const started = [];
    startDetached({ settings: { checkout: "/checkout" }, start: (cmd, args) => started.push([cmd, ...args]) }, { command: "bring", folder: FOLDER, args: ["--quiet"] });
    assert.deepEqual(started, [[process.execPath, "/checkout/tool/edit.js", "bring", "--now", FOLDER, "--quiet"]]);
  });
  it("has no result before it has run, and no running command without a lock", () => {
    const t = setup();
    assert.deepEqual([readResult(t.home, FOLDER, "bring"), runningCommand(t.home, FOLDER, () => true)], [null, ""]);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in detached runs", () => {
  it("23. lets one run alone take over a dead run's lock, when two find it at once", async () => {
    const t = setup();
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "finish" }));
    let other = null;
    let release;
    const holding = new Promise((done) => (release = done));
    // While this run looks at the dead run's lock, another run takes it over.
    const alive = (pid) => {
      if (pid === 4242) {
        if (!other) other = runDetached({ ...t.opts, command: "bring", alive: (p) => p !== 4242 }, async () => { await holding; return { ok: true, made: [], failed: [], next: "" }; });
        return false;
      }
      return pid === process.pid;
    };
    let ran = false;
    const mine = await runDetached({ ...t.opts, command: "finish", alive }, async () => {
      ran = true;
      return { ok: true, made: [], failed: [], next: "" };
    });
    assert.deepEqual([mine, ran, runningCommand(t.home, FOLDER, (p) => p === process.pid)], [{ running: "bring" }, false, "bring"]);
    release();
    assert.equal((await other).ok, true);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    assert.deepEqual(readdirSync(join(t.home, "BRIMM Video Work", FOLDER)), ["bring.result.json"]);
    t.done();
  });
});
