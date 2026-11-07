// The checks run behind (Phase 3, L5): the pendings of each kind, the loop that makes them, a local import's first record, a finish's
// copies in final/, and a writer and the check in each order. Names L5 adds are reached through a namespace import, so that a file
// loads before they are there.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as filing from "../filing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { pendingFolder, runsFolder } from "../settings.js";
import { ID, L, MAC, NAME, holdFinal, holdImport, holdRecord, mine, run, world } from "./checks-world.js";

const base = (kind, over = {}) => ({ version: 1, ...(kind ? { kind } : {}), id: ID, name: NAME, folder: "/x", root: "/r", machine: MAC, entries: [], work: null, lastCopy: L, ...over });

describe("pendings by kind, and the loop (L5)", () => {
  it("F1 keeps a pending of each kind in a folder of its own, named by its key, and reads one kind at a time", () => {
    const w = world();
    try {
      filing.writePending(w.home, base(null, { lastCopy: L + 1 }));
      filing.writePending(w.home, base("record", { lastCopy: L + 2 }));
      filing.writePending(w.home, base("final", { revision: 1, rev: 2, lastCopy: L + 3 }));
      filing.writePending(w.home, base("final", { revision: 2, rev: 3, lastCopy: L + 4 }));
      filing.writePending(w.home, base("original", { lastCopy: L + 5 }));
      const dir = pendingFolder(w.home);
      assert.ok(existsSync(join(dir, `${ID}.json`)));
      for (const f of [`record/${ID}.json`, `final/${ID}-1.json`, `final/${ID}-2.json`, `original/${ID}.json`]) assert.ok(existsSync(join(dir, f)), f);
      assert.equal(filing.readPendings(w.home).length, 1);
      assert.deepEqual(filing.readPendingsOf(w.home, "final").map((p) => p.revision), [1, 2]);
      assert.equal(filing.readPendingAt(w.home, `final/${ID}-2.json`).revision, 2);
      assert.equal(filing.readEveryPending(w.home).length, 5);
      assert.deepEqual(filing.readEveryPending(w.home).map((p) => p.lastCopy), [L + 1, L + 2, L + 3, L + 4, L + 5]);
      writeFileSync(join(dir, "final", `${ID}-3.json`), "{ half");
      writeFileSync(join(dir, "final", `${ID}-5.json`), JSON.stringify(base("final", { revision: 4, rev: 5 })));
      assert.equal(filing.readPendingsOf(w.home, "final").length, 2);
      assert.equal(filing.readEveryPending(w.home).length, 5);
      assert.equal(filing.readPendingAt(w.home, `final/${ID}-5.json`), null);
      assert.deepEqual(readdirSync(join(dir, "final")).filter((n) => n.endsWith(".writing")), []);
    } finally {
      w.done();
    }
  });

  it("F2 dueAt takes the later of a pending's due and its nextLook, counts a kind's 15 minutes from a later wake; pastLookUntil and isOpen", () => {
    assert.equal(filing.dueAt({ lastCopy: L }), L + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ lastCopy: L }, L + 60000), L + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ kind: "final", lastCopy: L, nextLook: L + 5 }), L + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ kind: "final", lastCopy: L, nextLook: L + LATE_CHECK_MS + 5 }), L + LATE_CHECK_MS + 5);
    assert.equal(filing.dueAt({ kind: "original", owed: true, lastCopy: L }), L);
    assert.equal(filing.dueAt({ kind: "original", owed: true, lastCopy: L, nextLook: L + 5 }), L + 5);
    assert.equal(filing.dueAt({ kind: "final", lastCopy: L }, L + 60000), L + 60000 + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ kind: "final", lastCopy: L }, L - 60000), L + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ kind: "final", lastCopy: L }, null), L + LATE_CHECK_MS);
    assert.equal(filing.dueAt({ kind: "original", owed: true, lastCopy: L }, L + 60000), L);
    assert.equal(filing.pastLookUntil({ lookUntil: L }, L + 1), true);
    assert.equal(filing.pastLookUntil({ lookUntil: L }, L), false);
    assert.equal(filing.pastLookUntil({}, L), false);
    assert.equal(filing.isOpen({ problem: "x" }, L), false);
    assert.equal(filing.isOpen({ lookUntil: L - 1 }, L), false);
    assert.equal(filing.isOpen({ told: L, wasProblem: "x" }, L), true);
    assert.equal(filing.WAIT_LOOK_MS, 300000);
    assert.equal(filing.WAIT_LOOK_FOR_MS, 3600000);
  });

  it("F3 clearRuns keeps what a pending of any kind names and skips a work of null, so no import is stopped", async () => {
    const w = world();
    try {
      const runs = runsFolder(w.home);
      for (const n of ["finish-99999998-1", "99999997-2", `${process.pid}-3`]) mkdirSync(join(runs, n), { recursive: true });
      filing.writePending(w.home, base("final", { revision: 1, rev: 2, work: join(runs, "finish-99999998-1") }));
      filing.writePending(w.home, base("original", { work: null }));
      assert.doesNotThrow(() => filing.clearRuns(w.home, mine));
      assert.deepEqual(readdirSync(runs).sort(), [`${process.pid}-3`, "finish-99999998-1"].sort());
      writeFileSync(join(w.drop, "B.mov"), "b");
      const called = [];
      await run(w, L, { importOne: async (name) => { called.push(name); return { ok: true, name }; } });
      assert.deepEqual(called, ["B.mov"]);
    } finally {
      w.done();
    }
  });

  it("F11 clearRuns asks which runs are not running before it reads the pendings", () => {
    const w = world();
    try {
      const runs = runsFolder(w.home);
      mkdirSync(join(runs, "finish-99999998-1"), { recursive: true });
      const alive = (pid) => {
        if (pid === 99999998) filing.writePending(w.home, base("final", { revision: 1, rev: 2, work: join(runs, "finish-99999998-1") }));
        return false;
      };
      filing.clearRuns(w.home, alive);
      assert.ok(existsSync(join(runs, "finish-99999998-1")));
    } finally {
      w.done();
    }
  });

  it("F14 lastWake gives the later of when the Mac last woke and when it last started, and is null when neither can be read", () => {
    const wake = "{ sec = 1793966294, usec = 876198 } Fri Nov  6 06:58:14 2026\n";
    const boot = "{ sec = 1793900000, usec = 5 } Thu Nov  5 12:33:20 2026\n";
    const asked = [];
    const stand = (answers) => (cmd, args) => {
      asked.push([cmd, args]);
      const a = answers[args[1]];
      if (a instanceof Error) throw a;
      return a;
    };
    assert.equal(filing.lastWake({ run: stand({ "kern.waketime": { status: 0, stdout: wake }, "kern.boottime": { status: 0, stdout: boot } }) }), 1793966294000);
    assert.deepEqual(asked.slice(0, 2), [["/usr/sbin/sysctl", ["-n", "kern.waketime"]], ["/usr/sbin/sysctl", ["-n", "kern.boottime"]]]);
    assert.equal(filing.lastWake({ run: stand({ "kern.waketime": { status: 0, stdout: "{ sec = 0, usec = 0 } Thu Jan  1 00:00:00 1970\n" }, "kern.boottime": { status: 0, stdout: boot } }) }), 1793900000000);
    assert.equal(filing.lastWake({ run: stand({ "kern.waketime": { status: 1, stdout: "" }, "kern.boottime": { status: 0, stdout: boot } }) }), 1793900000000);
    assert.equal(filing.lastWake({ run: stand({ "kern.waketime": { status: 0, stdout: wake }, "kern.boottime": new Error("x") }) }), 1793966294000);
    for (const bad of [{ status: 1, stdout: "" }, { status: 0, stdout: "?" }, new Error("x")]) {
      assert.equal(filing.lastWake({ run: stand({ "kern.waketime": bad, "kern.boottime": bad }) }), null);
    }
  });
});
