// busy.js says what is at work on the Mac: the import's background job, an import's lock, an episode's command, a video being made ready.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNS_LOCK_STALE_MS, idleWhy, launchdPid, pidFromPrint } from "../busy.js";
import { lockOf, whenReadyLockOf } from "../detached.js";
import { lockFile } from "../run.js";
import { runsFolder, workFolder } from "../settings.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUSY = join(TOOL, "busy.js");
const alive = (pid) => pid === 4321;
const JOB = "The import is at work: its background job, com.thebrimm.unedited, is running (process 4321).";
const LOCK = "An import is at work: it holds its lock (process 4321).";

/** Run `body` with a home of its own, removed after. */
function withHome(body) {
  const home = mkdtempSync(join(tmpdir(), "busy-"));
  try {
    return body(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

const holding = (file, held) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(held));
};
const importLock = (home, text = "4321") => {
  const file = lockFile("/Volumes/Work/Drop", runsFolder(home));
  mkdirSync(runsFolder(home), { recursive: true });
  writeFileSync(file, text);
  return file;
};

describe("idleWhy", () => {
  it("is idle when nothing is at work, and when BRIMM Video Work is not there or is a file", () => {
    withHome((home) => {
      assert.equal(idleWhy({ home, agentPid: null, alive }), "");
      writeFileSync(workFolder(home), "x");
      assert.equal(idleWhy({ home, agentPid: null, alive }), "");
    });
  });

  it("says the background job is at work while launchd names its process", () => {
    withHome((home) => {
      assert.equal(idleWhy({ home, agentPid: 4321, alive }), JOB);
      assert.equal(idleWhy({ home, agentPid: null, alive }), "");
    });
  });

  it("reads launchd's process number from what launchctl print says", () => {
    assert.equal(pidFromPrint("gui/501/com.thebrimm.unedited = {\n\tactive count = 1\n\tpid = 4321\n\tstate = running\n}\n"), 4321);
    for (const text of ["\tstate = not running\n", "", "\tpid = 0\n", "\tparent pid = 99\n"]) assert.equal(pidFromPrint(text), null);
    const calls = [];
    const run = (...args) => {
      calls.push(args.slice(0, 2).flat());
      return { status: 0, stdout: "\tpid = 77\n" };
    };
    assert.equal(launchdPid({ run, uid: 501 }), 77);
    assert.deepEqual(calls, [["/bin/launchctl", "print", "gui/501/com.thebrimm.unedited"]]);
    assert.equal(launchdPid({ run: () => ({ status: 113, stdout: "" }), uid: 501 }), null);
  });

  it("says an import holds its lock while its process lives, for half a day at most", () => {
    withHome((home) => {
      const file = importLock(home);
      const now = Date.now();
      assert.equal(idleWhy({ home, agentPid: null, alive, now }), LOCK);
      assert.equal(idleWhy({ home, agentPid: null, alive: () => false, now }), "");
      const old = new Date(now - RUNS_LOCK_STALE_MS - 1000);
      utimesSync(file, old, old);
      assert.equal(idleWhy({ home, agentPid: null, alive, now }), "");
      writeFileSync(file, "x");
      const fresh = new Date(now);
      utimesSync(file, fresh, fresh);
      assert.equal(idleWhy({ home, agentPid: null, alive, now }), "");
    });
  });

  it("says an episode's command is at work by the command alone, never by the episode's folder", () => {
    withHome((home) => {
      const lock = lockOf(home, "2026-11-09 Jane Client session Mac Studio");
      holding(lock, { pid: 4321, command: "finish", nonce: "n" });
      const line = idleWhy({ home, agentPid: null, alive });
      assert.equal(line, "A command is at work on an episode: finish (process 4321).");
      assert.doesNotMatch(line, /Jane|Client/);
      holding(lock, { pid: 4321, command: "rm -rf ~", nonce: "n" });
      assert.equal(idleWhy({ home, agentPid: null, alive }), "A command is at work on an episode (process 4321).");
      assert.equal(idleWhy({ home, agentPid: null, alive: () => false }), "");
    });
  });

  it("says a video is being made ready for HyperFrames while its when-ready lock is held", () => {
    withHome((home) => {
      holding(whenReadyLockOf(home, "2026-11-09 a video Mac Studio"), { pid: 4321, command: "app" });
      assert.equal(idleWhy({ home, agentPid: null, alive }), "A video is being made ready for HyperFrames (process 4321).");
    });
  });

  it("says the first thing at work: the background job, then an import's lock, then an episode's command, then a video being made ready", () => {
    withHome((home) => {
      const lock = importLock(home);
      const folder = "2026-11-09 a video Mac Studio";
      holding(lockOf(home, folder), { pid: 4321, command: "finish", nonce: "n" });
      holding(whenReadyLockOf(home, folder), { pid: 4321, command: "app" });
      assert.equal(idleWhy({ home, agentPid: 4321, alive }), JOB);
      assert.equal(idleWhy({ home, agentPid: null, alive }), LOCK);
      rmSync(lock);
      assert.equal(idleWhy({ home, agentPid: null, alive }), "A command is at work on an episode: finish (process 4321).");
      rmSync(lockOf(home, folder));
      assert.equal(idleWhy({ home, agentPid: null, alive }), "A video is being made ready for HyperFrames (process 4321).");
    });
  });

  it("never throws, even when BRIMM_VIDEO_HOME is refused", () => {
    const was = process.env.BRIMM_VIDEO_HOME;
    process.env.BRIMM_VIDEO_HOME = "relative";
    try {
      assert.equal(idleWhy({ agentPid: null }), "");
    } finally {
      if (was === undefined) delete process.env.BRIMM_VIDEO_HOME;
      else process.env.BRIMM_VIDEO_HOME = was;
    }
  });

  it("keeps run.js's half day", () => {
    assert.equal(RUNS_LOCK_STALE_MS, 43200000);
    assert.ok(readFileSync(join(TOOL, "run.js"), "utf8").includes("const STALE_LOCK_MS = 12 * 3600 * 1000;"));
  });
});

describe("node busy.js idle-why", () => {
  const ask = (home, words, input = "") =>
    spawnSync(process.execPath, [BUSY, ...words], { input, env: { PATH: "/usr/bin:/bin", HOME: home, BRIMM_VIDEO_HOME: home }, encoding: "utf8" });

  it("as a command, reads what launchctl printed from its standard input, says why and ends 1 when something is at work, and says nothing and ends 0 when nothing is", () => {
    withHome((home) => {
      const words = ["idle-why", "--launchd", "-"];
      const job = ask(home, words, "\tpid = 4321\n");
      assert.deepEqual([job.status, job.stdout], [1, `${JOB}\n`]);
      const idle = ask(home, words, "");
      assert.deepEqual([idle.status, idle.stdout], [0, ""]);
      importLock(home, String(process.pid));
      const held = ask(home, words, "");
      assert.deepEqual([held.status, held.stdout], [1, `An import is at work: it holds its lock (process ${process.pid}).\n`]);
      for (const bad of [["idle-why", "--what"], ["idle"]]) {
        const ran = ask(home, bad);
        assert.equal(ran.status, 2);
        assert.match(ran.stderr, /Say: node busy\.js idle-why \[--launchd -\]/);
      }
    });
  });
});
