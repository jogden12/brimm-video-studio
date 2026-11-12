// busy.js says what is at work on the Mac: the import's background job, an import's lock, an episode's command, a video being made ready.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CANNOT_TELL, RUNS_LOCK_STALE_MS, idleWhy, launchdPid, markUpdating, pidFromPrint } from "../busy.js";
import { lockOf, whenReadyLockOf } from "../detached.js";
import { lockFile } from "../run.js";
import { runsFolder, workFolder } from "../settings.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUSY = join(TOOL, "busy.js");
const EDIT = join(TOOL, "edit.js");
const alive = (pid) => pid === 4321;
/** A temp folder that is not there, for a test with no home of its own. */
const NO_TEMP = join(TOOL, "tests", "no such temp folder");
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

/** A temp folder of the made-up Mac's own, inside its home: no test reads this computer's real temp folder, where an import that
    is not for episodes keeps its lock (run.js lockFile). */
const tempOf = (home) => join(home, "its temp folder");
/** idleWhy on the made-up Mac whose home is `home`, with its own temp folder. */
const whyOn = (home, options) => idleWhy({ home, temp: tempOf(home), ...options });

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
/** The lock of an import of a folder that is not for episodes: run.js keeps it in the temp folder. */
const oldImportLock = (home, text = "4321") => {
  const file = lockFile("/Volumes/Work/An old folder", tempOf(home));
  mkdirSync(tempOf(home), { recursive: true });
  writeFileSync(file, text);
  return file;
};

describe("idleWhy", () => {
  it("is idle when nothing is at work, and when BRIMM Video Work is not there or is a file", () => {
    withHome((home) => {
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
      writeFileSync(workFolder(home), "x");
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
    });
  });

  it("says the background job is at work while launchd names its process", () => {
    withHome((home) => {
      assert.equal(whyOn(home, { agentPid: 4321, alive }), JOB);
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
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

  it("a launch agent whose print says pid = 0 is not running", () => {
    const printing = (text) => ({ run: () => ({ status: 0, stdout: text }), uid: 501 });
    assert.equal(launchdPid(printing("\tstate = waiting\n\tpid = 0\n")), null);
    assert.equal(launchdPid(printing("\tstate = running\n\tpid = 412\n")), 412);
  });

  it("says an import holds its lock while its process lives, for half a day at most", () => {
    withHome((home) => {
      const file = importLock(home);
      const now = Date.now();
      assert.equal(whyOn(home, { agentPid: null, alive, now }), LOCK);
      assert.equal(whyOn(home, { agentPid: null, alive: () => false, now }), "");
      const old = new Date(now - RUNS_LOCK_STALE_MS - 1000);
      utimesSync(file, old, old);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), "");
      writeFileSync(file, "x");
      const fresh = new Date(now);
      utimesSync(file, fresh, fresh);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), "");
    });
  });

  it("says an import of a folder that is not for episodes holds its lock, which run.js keeps in the temp folder", () => {
    withHome((home) => {
      const file = oldImportLock(home);
      const now = Date.now();
      // This Mac has no runs folder at all: the temp folder is looked in all the same.
      assert.equal(whyOn(home, { agentPid: null, alive, now }), LOCK);
      assert.equal(whyOn(home, { agentPid: null, alive: () => false, now }), "");
      // Another temp folder holds no lock.
      assert.equal(idleWhy({ home, temp: join(home, "another temp folder"), agentPid: null, alive, now }), "");
      const old = new Date(now - RUNS_LOCK_STALE_MS - 1000);
      utimesSync(file, old, old);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), "");
      writeFileSync(file, "x");
      const fresh = new Date(now);
      utimesSync(file, fresh, fresh);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), "");
    });
  });

  it("looks in both folders: a lock left by a dead run in one does not hide a held lock in the other", () => {
    withHome((home) => {
      const now = Date.now();
      importLock(home, "99");
      oldImportLock(home, "4321");
      assert.equal(whyOn(home, { agentPid: null, alive, now }), LOCK);
    });
    withHome((home) => {
      const now = Date.now();
      importLock(home, "4321");
      oldImportLock(home, "99");
      assert.equal(whyOn(home, { agentPid: null, alive, now }), LOCK);
    });
  });

  it("takes only an import's lock in the temp folder: another file there holds nothing", () => {
    withHome((home) => {
      mkdirSync(tempOf(home), { recursive: true });
      for (const name of ["brimm-transcribe-0123456789abcdef.txt", "another.lock", "brimm-transcribe.lock.old"]) writeFileSync(join(tempOf(home), name), "4321");
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
    });
  });

  it("takes only the name run.js gives an import's lock, 16 hex characters: a brimm-transcribe-notes.lock a live process wrote is not an import, in either folder (review finding 3, fix round 1)", () => {
    // Each of these holds a live process's number and is written now: only the name says it is not an import's lock.
    const others = ["brimm-transcribe-notes.lock", "brimm-transcribe-.lock", "brimm-transcribe-0123456789abcde.lock", "brimm-transcribe-0123456789abcdef0.lock", "brimm-transcribe-0123456789ABCDEF.lock", "brimm-transcribe-0123456789abcdeg.lock"];
    for (const folderOf of [tempOf, runsFolder]) {
      withHome((home) => {
        mkdirSync(folderOf(home), { recursive: true });
        for (const name of others) writeFileSync(join(folderOf(home), name), "4321");
        assert.equal(whyOn(home, { agentPid: null, alive }), "", others.join(", "));
        // The name run.js gives still counts, beside them. (Other characters than theirs: this disk may not tell A from a.)
        writeFileSync(join(folderOf(home), "brimm-transcribe-fedcba9876543210.lock"), "4321");
        assert.equal(whyOn(home, { agentPid: null, alive }), LOCK);
      });
    }
    // And run.js's own name is of that form, whatever the folder it is for.
    withHome((home) => {
      assert.match(basename(oldImportLock(home)), /^brimm-transcribe-[0-9a-f]{16}\.lock$/);
      assert.match(basename(importLock(home)), /^brimm-transcribe-[0-9a-f]{16}\.lock$/);
    });
  });

  it("says an episode's command is at work by the command alone, never by the episode's folder", () => {
    withHome((home) => {
      const lock = lockOf(home, "2026-11-09 Jane Client session Mac Studio");
      holding(lock, { pid: 4321, command: "finish", nonce: "n" });
      const line = whyOn(home, { agentPid: null, alive });
      assert.equal(line, "A command is at work on an episode: finish (process 4321).");
      assert.doesNotMatch(line, /Jane|Client/);
      holding(lock, { pid: 4321, command: "rm -rf ~", nonce: "n" });
      assert.equal(whyOn(home, { agentPid: null, alive }), "A command is at work on an episode (process 4321).");
      assert.equal(whyOn(home, { agentPid: null, alive: () => false }), "");
    });
  });

  it("says a video is being made ready for HyperFrames while its when-ready lock is held", () => {
    withHome((home) => {
      holding(whenReadyLockOf(home, "2026-11-09 a video Mac Studio"), { pid: 4321, command: "app" });
      assert.equal(whyOn(home, { agentPid: null, alive }), "A video is being made ready for HyperFrames (process 4321).");
    });
  });

  it("says the first thing at work: the background job, then an import's lock, then an episode's command, then a video being made ready", () => {
    withHome((home) => {
      const lock = importLock(home);
      const folder = "2026-11-09 a video Mac Studio";
      holding(lockOf(home, folder), { pid: 4321, command: "finish", nonce: "n" });
      holding(whenReadyLockOf(home, folder), { pid: 4321, command: "app" });
      assert.equal(whyOn(home, { agentPid: 4321, alive }), JOB);
      assert.equal(whyOn(home, { agentPid: null, alive }), LOCK);
      rmSync(lock);
      assert.equal(whyOn(home, { agentPid: null, alive }), "A command is at work on an episode: finish (process 4321).");
      rmSync(lockOf(home, folder));
      assert.equal(whyOn(home, { agentPid: null, alive }), "A video is being made ready for HyperFrames (process 4321).");
    });
  });

  it("idle-why says the same with a live marker", () => {
    withHome((home) => {
      const now = Date.now();
      const idle = whyOn(home, { agentPid: null, alive, now });
      assert.equal(idle, "");
      assert.equal(markUpdating({ home, now }), true);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), idle);
    });
    withHome((home) => {
      const now = Date.now();
      importLock(home);
      const held = whyOn(home, { agentPid: null, alive, now });
      assert.equal(held, LOCK);
      assert.equal(markUpdating({ home, now }), true);
      assert.equal(whyOn(home, { agentPid: null, alive, now }), held);
    });
  });

  it("a runs folder or work folder that cannot be listed cannot be told, and one that is not there is nothing at work", { skip: process.getuid?.() === 0 ? "root can read it" : false }, () => {
    withHome((home) => {
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
      mkdirSync(workFolder(home), { recursive: true });
      assert.equal(whyOn(home, { agentPid: null, alive }), "");
      for (const shut of [runsFolder(home), workFolder(home)]) {
        mkdirSync(shut, { recursive: true });
        chmodSync(shut, 0o000);
        try {
          assert.equal(whyOn(home, { agentPid: null, alive }), CANNOT_TELL, shut);
        } finally {
          chmodSync(shut, 0o755);
        }
        assert.equal(whyOn(home, { agentPid: null, alive }), "");
      }
    });
  });

  it("never throws, even when BRIMM_VIDEO_HOME is refused", () => {
    const was = process.env.BRIMM_VIDEO_HOME;
    process.env.BRIMM_VIDEO_HOME = "relative";
    try {
      assert.equal(idleWhy({ agentPid: null, temp: NO_TEMP }), CANNOT_TELL);
      assert.equal(idleWhy({ agentPid: 4321, temp: NO_TEMP }), JOB);
    } finally {
      if (was === undefined) delete process.env.BRIMM_VIDEO_HOME;
      else process.env.BRIMM_VIDEO_HOME = was;
    }
  });

  it("says it could not be told, in install.sh's own words, when something unexpected fails", () => {
    assert.equal(CANNOT_TELL, "Whether anything is at work on this Mac could not be told.");
    assert.ok(readFileSync(join(TOOL, "install.sh"), "utf8").includes(`why="\${why:-${CANNOT_TELL}}"`));
  });

  it("keeps run.js's half day", () => {
    assert.equal(RUNS_LOCK_STALE_MS, 43200000);
    assert.ok(readFileSync(join(TOOL, "run.js"), "utf8").includes("const STALE_LOCK_MS = 12 * 3600 * 1000;"));
  });
});

describe("the one parser of launchctl print", () => {
  it("edit.js reads the launch agent's pid with busy.js's parser, and has none of its own", () => {
    const text = readFileSync(EDIT, "utf8");
    const imports = text.split("\n").filter((line) => line.startsWith("import ") && line.includes('from "./busy.js"'));
    assert.equal(imports.length, 1, "one import from ./busy.js");
    assert.ok(imports[0].includes("launchdPid"), "it imports launchdPid");
    assert.ok(imports[0].includes("AGENT_LABEL"), "it imports AGENT_LABEL");
    // Its old two expressions, `/^\s*pid = \d+/m` and `/^\s*pid = (\d+)/m`, are gone: the parser is busy.js's pidFromPrint alone.
    for (const own of ["pid = \\d", "pid = (\\d"]) assert.ok(!text.includes(own), `edit.js holds no ${own} of its own`);
    // The label is named once, in busy.js: edit.js takes AGENT_LABEL and holds no string of its own.
    for (const quoted of ['"com.thebrimm.unedited"', "'com.thebrimm.unedited'", "`com.thebrimm.unedited`"]) assert.ok(!text.includes(quoted), `edit.js holds no ${quoted}`);
    // And launchctl print is asked by busy.js alone.
    assert.ok(!text.includes('["print"'), "edit.js does not run launchctl print itself");
  });
});

describe("node busy.js idle-why", () => {
  // The command's temp folder is node's own (os.tmpdir), which TMPDIR names: each run here is given the made-up Mac's.
  const ask = (home, words, input = "") =>
    spawnSync(process.execPath, [BUSY, ...words], { input, env: { PATH: "/usr/bin:/bin", HOME: home, BRIMM_VIDEO_HOME: home, TMPDIR: tempOf(home) }, encoding: "utf8" });

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
      for (const bad of [["idle-why", "--what"], ["idle"], ["idle-why", "--launchd", "x"], ["idle-why", "--launchd", "-", "extra"]]) {
        const ran = ask(home, bad);
        assert.equal(ran.status, 2);
        assert.match(ran.stderr, /Say: node busy\.js idle-why \[--launchd -\]/);
      }
    });
  });

  it("as a command, looks for the lock of an import that is not for episodes in node's own temp folder", () => {
    withHome((home) => {
      const words = ["idle-why", "--launchd", "-"];
      mkdirSync(tempOf(home), { recursive: true });
      const idle = ask(home, words, "");
      assert.deepEqual([idle.status, idle.stdout], [0, ""]);
      oldImportLock(home, String(process.pid));
      const held = ask(home, words, "");
      assert.deepEqual([held.status, held.stdout], [1, `An import is at work: it holds its lock (process ${process.pid}).\n`]);
    });
  });

  it("ends 2 and says why on standard error when BRIMM_VIDEO_HOME is refused", () => {
    const r = spawnSync(process.execPath, [BUSY, "idle-why"], { env: { PATH: "/usr/bin:/bin", BRIMM_VIDEO_HOME: "relative", TMPDIR: NO_TEMP }, encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.trim().length > 0, "a refusal is said");
  });

  it("ends 2 and says so on standard error when standard input cannot be read", () => {
    withHome((home) => {
      // A folder given as standard input cannot be read.
      const closed = spawnSync("/bin/sh", ["-c", `exec 0<"${home}"; "${process.execPath}" "${BUSY}" idle-why --launchd -`], { env: { PATH: "/usr/bin:/bin", HOME: home, BRIMM_VIDEO_HOME: home, TMPDIR: tempOf(home) }, encoding: "utf8" });
      assert.deepEqual([closed.status, closed.stdout, closed.stderr], [2, "", "Standard input could not be read.\n"]);
    });
  });
});

describe("busy.test.js itself", () => {
  it("gives every idleWhy a temp folder of the test's own, and every run of the command a TMPDIR, so none reads this computer's real one", () => {
    const text = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const calls = text.split("idleWhy(").slice(1).map((rest) => rest.split("\n")[0]);
    // The import's own line, the helper's, and this test's two are not calls with options.
    const without = calls.filter((rest) => rest.startsWith("{") && !rest.includes("temp:"));
    assert.deepEqual(without, []);
    const spawns = text.split("\n").filter((line) => line.includes("spawnSync(") && line.includes("BUSY") && !line.includes("TMPDIR:"));
    assert.deepEqual(spawns, []);
  });
});
