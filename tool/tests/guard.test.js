// The watchdog on a program that could run away: it is stopped, with all it started, when its memory passes a cap or it runs
// past its time. The programs here are stand-ins written in Node, never ffmpeg: one that ends, one that grows without end,
// one that never ends, and one that starts a program of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runGuarded } from "../guard.js";

const MB = 1024 * 1024;
const node = process.execPath;
/** A stand-in that takes another 20 MB of memory every 10 ms, and never lets any go. */
const GROWS = "const kept = []; setInterval(() => kept.push(Buffer.alloc(20 * 1024 * 1024, 1)), 10);";
/** A stand-in that does nothing, for ever. */
const WAITS = "setInterval(() => {}, 1000);";
/** Is a process still there? */
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
};

describe("a program run under the watchdog", () => {
  it("ends as it would: its code, and the end of what it printed", async () => {
    const r = await runGuarded(node, ["-e", "process.stderr.write('done\\n'); process.exit(3)"], { most: 500 * MB, limit: 20000 });
    assert.deepEqual([r.code, r.stderr, r.stopped], [3, "done\n", ""]);
  });
  it("is stopped, with all it started, when its memory passes the cap, and says so in plain words", async () => {
    const started = Date.now();
    const r = await runGuarded(node, ["-e", GROWS], { most: 200 * MB, limit: 30000 });
    assert.equal(r.overMemory, true);
    assert.equal(r.signal, "SIGKILL");
    assert.ok(r.peak > 200 * MB, `peak ${r.peak}`);
    assert.ok(Date.now() - started < 10000, "it was stopped well before its time ran out");
    assert.equal(r.stopped, "it took more than 200 MB of memory, so it was stopped");
  });
  it("is stopped when it runs past its time, and says so in plain words", async () => {
    const r = await runGuarded(node, ["-e", WAITS], { most: 500 * MB, limit: 300 });
    assert.deepEqual([r.outOfTime, r.overMemory, r.signal], [true, false, "SIGKILL"]);
    assert.equal(r.stopped, "it ran for more than 0.3 seconds, so it was stopped");
  });
  it("stops what the program started too, since it runs in a group of its own", async () => {
    // The stand-in starts a program that waits for ever, says its number, and then grows.
    const parent = `const { spawn } = require("node:child_process"); const c = spawn(process.execPath, ["-e", ${JSON.stringify(WAITS)}], { stdio: "ignore" }); process.stderr.write(c.pid + "\\n"); ${GROWS}`;
    const r = await runGuarded(node, ["-e", parent], { most: 200 * MB, limit: 30000 });
    const child = Number(r.stderr.trim());
    assert.ok(child > 0, r.stderr);
    await new Promise((done) => setTimeout(done, 200));
    assert.equal(alive(child), false, "the program it started is gone");
  });
  it("reads memory by what it is given, so the cap can be shown without growing", async () => {
    let looks = 0;
    const resident = async () => (++looks > 3 ? 3000 * MB : 100 * MB);
    const r = await runGuarded(node, ["-e", WAITS], { most: 2048 * MB, limit: 30000, every: 10, resident });
    assert.deepEqual([r.overMemory, r.stopped], [true, "it took more than 2 GB of memory, so it was stopped"]);
  });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    it(`stops what it runs when this process is stopped by ${signal}, as launchctl stops the import, and then ends by it`, async () => {
      // A process that runs a stand-in under the watchdog, waits until the stand-in has said its number, and is then sent the
      // signal. The stand-in runs in a group of its own, so nothing but the watchdog would stop it.
      const dir = mkdtempSync(join(tmpdir(), "brimm-guard-"));
      const said = join(dir, "pid");
      const guard = pathToFileURL(join(import.meta.dirname, "..", "guard.js")).href;
      const standIn = `require("node:fs").writeFileSync(${JSON.stringify(said)}, String(process.pid)); ${WAITS}`;
      const script = `const { runGuarded } = await import(${JSON.stringify(guard)});
        const { existsSync } = await import("node:fs");
        runGuarded(process.execPath, ["-e", ${JSON.stringify(standIn)}], { most: 500 * 1024 * 1024, limit: 60000 });
        const ready = setInterval(() => { if (existsSync(${JSON.stringify(said)})) { clearInterval(ready); process.kill(process.pid, ${JSON.stringify(signal)}); } }, 20);`;
      const ended = await new Promise((done) => spawn(node, ["--input-type=module", "-e", script], { stdio: "ignore" }).on("close", (code, sig) => done({ code, sig })));
      try {
        assert.equal(ended.sig, signal, `it ended by ${signal}: ${JSON.stringify(ended)}`);
        assert.ok(existsSync(said), "the stand-in was started");
        const standInPid = Number(readFileSync(said, "utf8"));
        await new Promise((done) => setTimeout(done, 200));
        assert.equal(alive(standInPid), false, "the stand-in is gone");
      } finally {
        // Whatever happened, no stand-in is left running.
        const left = existsSync(said) ? Number(readFileSync(said, "utf8")) : 0;
        if (left && alive(left)) process.kill(left, "SIGKILL");
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
  it("cannot be run without a cap and a time limit", async () => {
    await assert.rejects(runGuarded(node, ["-e", ""], { most: 0, limit: 1000 }), { message: "A guarded program needs a memory cap and a time limit." });
    await assert.rejects(runGuarded(node, ["-e", ""], { most: MB, limit: 0 }), { message: "A guarded program needs a memory cap and a time limit." });
  });
});
