// The checks run behind (Phase 3, L5): the pendings of each kind, the loop that makes them, a local import's first record, a finish's
// copies in final/, and a writer and the check in each order. Names L5 adds are reached through a namespace import, so that a file
// loads before they are there.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { watched } from "./watched-fs.js";
import { readAccess } from "../access.js";
import { flagProblem, markChecking, problemFlagged } from "../finish-check.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import * as filing from "../filing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { episodeWork, pendingFolder, runsFolder } from "../settings.js";
import { acceptRev, localStamp, recordFile, recordText } from "../episode.js";
import { HANDOFF, ID, L, LABEL, MAC, MP4, NAME, SRT, cloneOf, ctxOf, deadLock, holdFinal, holdImport, holdRecord, liveLock, mine, recordOf, run, runs, world } from "./checks-world.js";

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

const bare = (w, kind, over = {}) => ({ version: 1, kind, id: ID, name: NAME, folder: join(w.root, "Episodes", NAME), root: w.root, machine: MAC, entries: [], work: null, lastCopy: L, ...(kind === "final" ? { revision: 1, rev: 2 } : {}), ...over });
const M15 = LATE_CHECK_MS;

describe("the loop, with checks of its own (L5)", () => {
  it("F6 writes no import status for a pending of another kind", async () => {
    const w = world();
    try {
      holdFinal(w, L);
      const seen = [];
      const calls = [];
      await run(w, L + 10 * 60000, {
        checks: { final: (p, d) => { calls.push(d.clock()); filing.removePending(w.home, p); } },
        onWait: (ms, c) => { seen.push(...w.statuses()); c.add(ms); }
      });
      assert.deepEqual(seen, []);
      assert.equal(calls.length, 1);
      assert.ok(calls[0] >= L + M15);
    } finally {
      w.done();
    }
  });

  it("F7 looks again in the same run at a pending given a nextLook, lets the run end past its lookUntil, and looks once at the next run's start", async () => {
    const w = world();
    try {
      filing.writePending(w.home, bare(w, "original", { lastCopy: L - M15 }));
      let calls = 0;
      let first = true;
      const checks = {
        original: (p, d) => {
          calls += 1;
          const now = d.clock();
          filing.writePending(w.home, { ...p, nextLook: now + 10 * 60000, ...(first ? { lookUntil: now + 60 * 60000 } : {}) });
          first = false;
        }
      };
      const r = await run(w, L, { checks });
      assert.equal(calls, 7);
      assert.ok(r.waits.every((ms) => ms > 0));
      assert.ok(filing.readPendingAt(w.home, `original/${ID}.json`));
      calls = 0;
      await run(w, L + 61 * 60000 + 60000, { checks });
      assert.equal(calls, 1);
    } finally {
      w.done();
    }
  });

  it("F8 leaves alone a pending of a kind with no check", async () => {
    const w = world();
    try {
      filing.writePending(w.home, bare(w, "original", { lastCopy: L - M15 }));
      const before = readFileSync(join(pendingFolder(w.home), "original", `${ID}.json`), "utf8");
      const r = await run(w, L);
      assert.deepEqual(r.waits, []);
      assert.equal(readFileSync(join(pendingFolder(w.home), "original", `${ID}.json`), "utf8"), before);
      assert.deepEqual(r.logs.filter((l) => l.includes("ab0001")), []);
    } finally {
      w.done();
    }
  });

  it("F9 makes a pending written during the loop's last look in the same run", async () => {
    const w = world();
    try {
      writeFileSync(join(w.drop, "B.mov"), "b");
      let imports = 0;
      const calls = [];
      let now = () => 0;
      const importOne = async (name) => {
        imports += 1;
        if (imports === 1) return { ok: false, name, arriving: true };
        filing.writePending(w.home, bare(w, "final", { id: "e-20261106-ab0002", name: "2026-11-06 Other (Mac Studio)", lastCopy: now() }));
        return { ok: true, name };
      };
      const r = runs(w, L);
      now = r.now;
      await filing.importEpisodes(w.drop, { ...r.deps, checks: { final: (p, d) => { calls.push(d.clock()); filing.removePending(w.home, p); } } }, importOne);
      assert.equal(imports, 2);
      assert.equal(calls.length, 1);
      assert.ok(calls[0] >= L + M15);
    } finally {
      w.done();
    }
  });

  it("F10 looks again in the same run at a check that moves its own time on, whatever nextLook it kept", async () => {
    const w = world();
    try {
      filing.writePending(w.home, bare(w, "original", { lastCopy: L - M15, nextLook: L - 60000 }));
      const calls = [];
      await run(w, L, {
        checks: {
          original: (p, d) => {
            calls.push(d.clock());
            if (calls.length === 1) filing.writePending(w.home, { ...p, lastCopy: d.clock() });
            else filing.removePending(w.home, p);
          }
        }
      });
      assert.equal(calls.length, 2);
      assert.ok(calls[1] - calls[0] >= M15);
    } finally {
      w.done();
    }
  });

  it("F13 counts a kind's 15 minutes from the Mac's last wake", async () => {
    const stand = async (start, wokeStart, jump) => {
      const w = world();
      try {
        holdFinal(w, L);
        let woke = wokeStart;
        const called = [];
        let first = true;
        const r = await run(w, start, {
          wokeAt: () => woke,
          checks: { final: (p, d) => { called.push(d.clock()); filing.removePending(w.home, p); } },
          onWait: (ms, c) => {
            if (jump && first) { c.add(14 * 3600000); woke = c.now(); } else c.add(ms);
            first = false;
          }
        });
        return { called, r, start };
      } finally {
        w.done();
      }
    };
    // (a) the Mac slept 14 hours past the due, and woke: the check is made 15 minutes after the wake.
    const a = await stand(L + 2 * 60000, null, true);
    assert.equal(a.called.length, 1);
    assert.equal(a.called[0], L + 2 * 60000 + 14 * 3600000 + M15);
    assert.ok(a.r.waits.slice(1).every((ms) => ms <= 60000));
    // (b) a run started 14 hours on, a minute after a wake: made 14 minutes into the run.
    const s = L + 14 * 3600000;
    const b = await stand(s, s - 60000, false);
    assert.deepEqual(b.called, [s + 14 * 60000]);
    // (c) a wake before the copy changes nothing.
    const c = await stand(L + 2 * 60000, L - 60000, false);
    assert.deepEqual(c.called, [L + M15]);
    // (d) two minutes after the Mac started.
    const d = await stand(s, s - 120000, false);
    assert.deepEqual(d.called, [s + 13 * 60000]);
  });

  it("F16 makes a pending written again under a key it has made in the run", async () => {
    const w = world();
    try {
      holdFinal(w, L);
      writeFileSync(join(w.drop, "B.mov"), "b");
      const called = [];
      const r = runs(w, L + M15 + 1);
      await filing.importEpisodes(w.drop, { ...r.deps, checks: { final: (p, d) => { called.push(d.clock()); filing.removePending(w.home, p); } } }, async (name) => {
        filing.writePending(w.home, bare(w, "final", { lastCopy: r.now() }));
        return { ok: true, name };
      });
      assert.equal(called.length, 2);
      assert.ok(called[1] >= called[0] + M15);
    } finally {
      w.done();
    }
  });

  it("F17 looks once in a run, when it is due, at a pending past its lookUntil that a wake keeps from being due at the start", async () => {
    const stand = async (wokeAt) => {
      const w = world();
      try {
        const start = L + 14 * 3600000;
        filing.writePending(w.home, bare(w, "original", { lastCopy: L, lookUntil: L + 60 * 60000, nextLook: L + 70 * 60000 }));
        const called = [];
        const r = await run(w, start, {
          wokeAt: () => wokeAt(start),
          checks: { original: (p, d) => { called.push(d.clock() - start); filing.writePending(w.home, { ...p, nextLook: d.clock() + 10 * 60000 }); } }
        });
        assert.ok(r.waits.every((ms) => ms > 0));
        assert.ok(filing.readPendingAt(w.home, `original/${ID}.json`));
        return called;
      } finally {
        w.done();
      }
    };
    assert.deepEqual(await stand((s) => s - 60000), [14 * 60000]);
    assert.deepEqual(await stand(() => null), [0]);
  });

  it("F18 makes a pending written over the key of one the run chose, while it made another's check, at its own due", async () => {
    const w = world();
    try {
      const other = "e-20261106-ab0002";
      filing.writePending(w.home, bare(w, "final", { id: other, name: "2026-11-06 Other (Mac Studio)", lastCopy: L }));
      filing.writePending(w.home, bare(w, "final", { revision: 2, rev: 3, lastCopy: L + 1000 }));
      const calls = [];
      await run(w, L + M15 + 5000, {
        checks: {
          final: (p, d) => {
            calls.push([filing.pendingKeyOf(p), d.clock()]);
            if (p.id === other) filing.writePending(w.home, bare(w, "final", { revision: 2, rev: 3, lastCopy: d.clock() }));
            filing.removePending(w.home, p);
          }
        }
      });
      assert.equal(calls.length, 2);
      assert.equal(calls[0][0], `final/${other}-1.json`);
      assert.equal(calls[1][0], `final/${ID}-2.json`);
      assert.ok(calls[1][1] >= calls[0][1] + M15);
    } finally {
      w.done();
    }
  });
});

describe("settleReading, for a mark with a rev (L5)", () => {
  const setupMark = (w, rev, { withRev = true, to } = {}) => {
    const srt = join(w.root, "Episodes", NAME, "final", "Talk main.srt");
    const mark = { pid: 999999, at: L, to: [to || srt], nonce: "n", ...(withRev ? { rev } : {}) };
    return { h: holdFinal(w, L, { mark }), srt };
  };
  it("S1 settles a mark with a rev by the record's number", () => {
    for (const [rev, later, expectLeft] of [[3, (r) => ({}), true], [3, null, false], [4, (r) => ({ files: { ...r.files, "final/Talk main.srt": 9 } }), true]]) {
      const w = world();
      try {
        const { h, srt } = setupMark(w, rev);
        if (later) h.later(later);
        const got = filing.settleReading(h.pending, { home: w.home });
        assert.equal(got.pending.entries.some((e) => e.to === srt), !expectLeft);
        assert.equal("reading" in got.pending, false);
        assert.equal("reading" in filing.readPendingAt(w.home, h.key), false);
      } finally {
        w.done();
      }
    }
  });
  it("S2 settles a mark with no rev by sizes alone, as today", () => {
    const w = world();
    try {
      const { h, srt } = setupMark(w, 3, { withRev: false });
      h.later(() => ({}));
      assert.ok(filing.settleReading(h.pending, { home: w.home }).pending.entries.some((e) => e.to === srt));
    } finally {
      w.done();
    }
  });
  it("S4 settles a mark whose rev this Mac noted writing as the writer's, though Dropbox lost its record", () => {
    for (const [noted, left] of [[3, true], [2, false]]) {
      const w = world();
      try {
        const { h, srt } = setupMark(w, 3);
        acceptRev(w.home, ID, noted);
        assert.equal(filing.settleReading(h.pending, { home: w.home }).pending.entries.some((e) => e.to === srt), !left);
      } finally {
        w.done();
      }
    }
  });
  it("S3 settles past a conflicted copy of a file in final/, and not past one of a record", () => {
    const w = world();
    try {
      const hand = join(w.root, "Episodes", NAME, "final", "Talk.brimm-ops.json");
      const { h } = setupMark(w, 3, { to: hand });
      h.later((r) => ({ files: { ...r.files, "final/Talk.brimm-ops.json": 21 } }));
      writeFileSync(join(h.folder, "final", "Talk main (Sallie's laptop's conflicted copy 2026-11-06).srt"), SRT);
      const got = filing.settleReading(h.pending, { home: w.home });
      assert.equal(got.pending.entries.some((e) => e.to === hand), false);
      assert.equal("reading" in got.pending, false);
    } finally {
      w.done();
    }
    const w2 = world();
    try {
      const hand = join(w2.root, "Episodes", NAME, "final", "Talk.brimm-ops.json");
      const { h } = setupMark(w2, 3, { to: hand });
      h.later((r) => ({ files: { ...r.files, "final/Talk.brimm-ops.json": 21 } }));
      writeFileSync(join(h.folder, "record", "0003 (Sallie's laptop's conflicted copy 2026-11-06).json"), "{}");
      assert.deepEqual(filing.settleReading(h.pending, { home: w2.home }), { later: true });
      assert.ok(filing.readPendingAt(w2.home, h.key).reading);
    } finally {
      w2.done();
    }
  });
});

describe("takeOutOfCheck, restoreReads and busyWords, for a local episode (L5)", () => {
  const lockFile = (w) => join(episodeWork(w.home, NAME), "late-check.lock");
  const recordTwo = (h) => JSON.parse(readFileSync(recordFile(h.folder, 2), "utf8"));
  const step = (w, h, over = {}, opts = {}) => filing.takeOutOfCheck(ctxOf(w), { name: NAME, record: recordTwo(h), paths: [h.files.handoff], rev: 3, ...over }, { wait: async () => {}, ...opts });
  const idOf = (path) => ({ path, id: filing.fileId(path) });
  const words = { done: "nothing was changed", again: "Say it again in a minute." };

  it("T1 always takes the lock, with no pending owed, and end lets it go", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      filing.removePending(w.home, h.pending);
      const got = await step(w, h);
      assert.ok(got.end);
      assert.equal(JSON.parse(readFileSync(lockFile(w), "utf8")).command, "write");
      assert.deepEqual(got.end({ put: false }), { reopened: false });
      assert.equal(existsSync(lockFile(w)), false);
    } finally {
      w.done();
    }
  });

  it("T2 marks the entries among its paths in every pending of the episode, and end({ put: true }) takes them out of each", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      const h2 = holdFinal(w, L + 1000, { revision: 2, episode: false });
      const rec = holdRecord(w, L + 2000, { id: ID, there: "none" });
      const got = await step(w, h);
      for (const key of [h.key, h2.key]) {
        const p = filing.readPendingAt(w.home, key);
        assert.deepEqual(Object.keys(p.reading).sort(), ["at", "nonce", "pid", "rev", "to"]);
        assert.deepEqual([p.reading.to, p.reading.rev, p.reading.pid], [[h.files.handoff], 3, process.pid]);
      }
      assert.equal("reading" in filing.readPendingAt(w.home, rec.key), false);
      assert.deepEqual(got.end({ put: true }), { reopened: false });
      for (const [key, original] of [[h.key, h.pending], [h2.key, h2.pending]]) {
        const p = filing.readPendingAt(w.home, key);
        assert.equal("reading" in p, false);
        assert.deepEqual(p.entries, original.entries.filter((e) => e.to !== h.files.handoff));
        const { entries, ...rest } = p;
        const { entries: e2, ...rest2 } = original;
        assert.deepEqual(rest, rest2);
      }
    } finally {
      w.done();
    }
  });

  it("T3 end({ put: false }) leaves the entries, unmarked; a second end changes nothing", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      const got = await step(w, h);
      got.end({ put: false });
      assert.deepEqual(filing.readPendingAt(w.home, h.key), h.pending);
      const other = liveLock(w, NAME, "late check");
      assert.deepEqual(got.end({ put: true }), { reopened: false });
      assert.ok(existsSync(lockFile(w)));
      filing.releaseLateCheckLock(other);
      assert.deepEqual(filing.readPendingAt(w.home, h.key), h.pending);
    } finally {
      w.done();
    }
  });

  it("T4 is not stopped by a pending's problem", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L, { problem: "x" });
      const got = await step(w, h);
      assert.ok(got.end);
      assert.ok(filing.readPendingAt(w.home, h.key).reading);
      got.end({ put: false });
    } finally {
      w.done();
    }
  });

  it("T5 looks every LOCK_LOOK_MS while a check holds the lock, and is busy after LOCK_WAIT_MS, writing nothing", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      liveLock(w, NAME, "late check");
      const waits = [];
      const got = await step(w, h, {}, { wait: async (ms) => waits.push(ms) });
      assert.deepEqual(got, { busy: "held" });
      assert.equal(waits.length, filing.LOCK_WAIT_MS / filing.LOCK_LOOK_MS);
      assert.ok(waits.every((ms) => ms === filing.LOCK_LOOK_MS));
      assert.deepEqual(filing.readPendingAt(w.home, h.key), h.pending);
      assert.equal(filing.busyWords("held", "Talk", words), "Studio was still checking Dropbox's copies of Talk after two minutes, so nothing was changed. Say it again in a minute.");
    } finally {
      w.done();
    }
  });

  it("T6 takes at once a lock a dead process left", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      deadLock(w, NAME, "late check");
      const waits = [];
      const got = await step(w, h, {}, { wait: async (ms) => waits.push(ms) });
      assert.ok(got.end);
      assert.deepEqual(waits, []);
      got.end({ put: false });
    } finally {
      w.done();
    }
  });

  it("T7 settles an earlier dead writer's mark first, and is busy unsettled when it cannot be", async () => {
    const w = world();
    try {
      const mark = { pid: 999999, at: L, to: [join(w.root, "Episodes", NAME, "final", "Talk.brimm-ops.json")], nonce: "n", rev: 3 };
      const h = holdFinal(w, L, { mark });
      h.later(() => ({ files: { Talk: 1 } }));
      const got = await step(w, h, { rev: 4 });
      assert.ok(got.end);
      const settled = filing.readPendingAt(w.home, h.key);
      assert.equal("reading" in settled, false);
      assert.equal(settled.entries.some((e) => e.to === h.files.handoff), false);
      got.end({ put: false });
    } finally {
      w.done();
    }
    const w2 = world();
    try {
      const mark = { pid: 999999, at: L, to: [join(w2.root, "Episodes", NAME, "final", "Talk.brimm-ops.json")], nonce: "n", rev: 3 };
      const h = holdFinal(w2, L, { mark });
      writeFileSync(join(h.folder, "record", "0003 (Sallie's laptop's conflicted copy 2026-11-06).json"), "{}");
      const got = await step(w2, h);
      assert.deepEqual(got, { busy: "unsettled" });
      assert.ok(filing.readPendingAt(w2.home, h.key).reading);
      assert.equal(existsSync(lockFile(w2)), false);
    } finally {
      w2.done();
    }
  });

  it("T8 end leaves alone a pending written again under its key with another mark", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      const got = await step(w, h);
      const again = { ...filing.readPendingAt(w.home, h.key), reading: { pid: 1, at: 1, to: [], nonce: "other", rev: 9 } };
      filing.writePending(w.home, again);
      got.end({ put: true });
      assert.deepEqual(filing.readPendingAt(w.home, h.key), again);
    } finally {
      w.done();
    }
  });

  it("T9 for a record without local it is keepCheckInStep, with the caller's problem words", async () => {
    const w = world();
    try {
      const p = holdImport(w, "X.mov", L);
      const record = { ...recordOf({ id: p.id, rev: 1 }), local: undefined };
      delete record.local;
      const ctx = ctxOf(w);
      filing.writePending(w.home, { ...p, problem: "bad" });
      assert.deepEqual(await filing.takeOutOfCheck(ctx, { name: p.name, record, paths: [p.entries[0].to] }, { wait: async () => {}, problemWhy: () => "P." }), { why: "P." });
      assert.deepEqual(await filing.takeOutOfCheck(ctx, { name: p.name, record, paths: [p.entries[0].to] }, { wait: async () => {} }), { why: "Dropbox found a problem with a copy of this episode: bad." });
      assert.deepEqual(await filing.takeOutOfCheck(ctx, { name: p.name, record: { ...record, id: "e-20261106-ee0005" }, paths: [p.entries[0].to] }, { wait: async () => {} }), { none: true });
    } finally {
      w.done();
    }
  });

  it("T10 judges the copies among its reads under the lock: one not whole is put back, and it is busy restored, marking nothing", async () => {
    for (const bad of ["1\nHo.\n\n", SRT.slice(0, 3)]) {
      const w = world();
      try {
        const h = holdFinal(w, L);
        writeFileSync(h.files.srt, bad);
        const reads = [idOf(h.files.srt), idOf(h.files.handoff)];
        assert.deepEqual(await step(w, h, { reads }), { busy: "restored" });
        assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
        assert.deepEqual(filing.readPendingAt(w.home, h.key), h.pending);
        assert.equal(existsSync(lockFile(w)), false);
      } finally {
        w.done();
      }
    }
    const w = world();
    try {
      const h = holdFinal(w, L);
      const got = await step(w, h, { reads: [idOf(h.files.srt), idOf(h.files.handoff)] });
      assert.ok(got.end);
      assert.deepEqual(filing.readPendingAt(w.home, h.key).reading.to, [h.files.handoff]);
      got.end({ put: false });
      assert.equal(filing.busyWords("restored", "Talk", words), "A copy of Talk in final/ was not whole in Dropbox, so it is put back, and nothing was changed. Say it again in a minute.");
    } finally {
      w.done();
    }
  });

  it("T11 is busy lost, putting nothing back, when a copy among its reads is not whole and its copy on this Mac is gone", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L, { workCopies: false });
      writeFileSync(h.files.srt, SRT.slice(0, 3));
      assert.deepEqual(await step(w, h, { reads: [idOf(h.files.srt)] }), { busy: "lost" });
      assert.equal(readFileSync(h.files.srt, "utf8"), SRT.slice(0, 3));
      assert.equal("reading" in filing.readPendingAt(w.home, h.key), false);
      assert.equal(existsSync(lockFile(w)), false);
      assert.equal(filing.busyWords("lost", "Talk", words), "A copy of Talk in final/ is not whole in Dropbox, and it could not be put back, so nothing was changed. Ask Jason.");
    } finally {
      w.done();
    }
    const w2 = world();
    try {
      const h = holdFinal(w2, L);
      h.later((r) => ({ files: { ...r.files, "final/Talk main.srt": 99 } }));
      writeFileSync(h.files.srt, SRT.slice(0, 3));
      const got = await step(w2, h, { record: JSON.parse(readFileSync(recordFile(h.folder, 3), "utf8")), reads: [idOf(h.files.srt)] });
      assert.ok(got.end);
      got.end({ put: false });
    } finally {
      w2.done();
    }
  });

  it("T12 end({ put: true }) writes a pending with a problem that loses an entry with wasProblem and told, and says it reopened it", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L, { problem: "x" });
      filing.writePending(w.home, { ...h.pending, lookUntil: L - 1 });
      const got = await step(w, h);
      assert.deepEqual(got.end({ put: true }), { reopened: true });
      const p = filing.readPendingAt(w.home, h.key);
      assert.equal("problem" in p, false);
      assert.equal("lookUntil" in p, false);
      assert.deepEqual([p.wasProblem, p.told], ["x", L]);
      assert.equal(p.entries.some((e) => e.to === h.files.handoff), false);
      assert.equal(filing.isOpen(p, L), true);
      assert.deepEqual(got.end({ put: true }), { reopened: false });
      const again = await step(w, h, { paths: [h.files.srt] });
      assert.deepEqual(again.end({ put: false }), { reopened: false });
    } finally {
      w.done();
    }
    const w2 = world();
    try {
      const h = holdFinal(w2, L, { problem: "x" });
      const got = await step(w2, h);
      got.end({ put: false });
      assert.equal(filing.readPendingAt(w2.home, h.key).problem, "x");
    } finally {
      w2.done();
    }
  });

  it("T13 judges its reads only by a pending whose record reached Dropbox, so a dead finish's copy is never put back", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      writeFileSync(h.files.handoff, '{"revision": 2}\n');
      const workTwo = join(w.dir, "work", "final-dead");
      mkdirSync(workTwo, { recursive: true });
      writeFileSync(join(workTwo, "Talk.brimm-ops.json"), '{"revision": 2}\n');
      writeFileSync(join(workTwo, "0003.json"), "recordtext");
      const dead = { ...h.pending, revision: 2, rev: 3, copied: undefined, lastCopy: L + 1000, work: workTwo, entries: [{ from: join(workTwo, "Talk.brimm-ops.json"), to: h.files.handoff, bytes: 16 }], took: [], record: { from: join(workTwo, "0003.json"), to: recordFile(h.folder, 3), bytes: 10 } };
      delete dead.copied;
      filing.writePending(w.home, dead);
      const first = await step(w, h, { reads: [idOf(h.files.handoff)] });
      assert.deepEqual(first, { busy: "restored" });
      assert.equal(readFileSync(h.files.handoff, "utf8"), HANDOFF);
      assert.equal("reading" in filing.readPendingAt(w.home, h.key), false);
      assert.equal("reading" in filing.readPendingAt(w.home, "final/" + ID + "-2.json"), false);
      const second = await step(w, h, { reads: [idOf(h.files.handoff)] });
      assert.ok(second.end);
      assert.equal(readFileSync(h.files.handoff, "utf8"), HANDOFF);
      assert.ok(filing.readPendingAt(w.home, h.key).reading);
      assert.ok(filing.readPendingAt(w.home, "final/" + ID + "-2.json").reading);
      second.end({ put: false });
    } finally {
      w.done();
    }
  });

  it("T15 is busy restored when a read's file is no longer the one the writer read, though no pending holds it now", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      writeFileSync(h.files.srt, SRT.slice(0, 3));
      const id = filing.fileId(h.files.srt);
      rmSync(h.files.srt, { force: true });
      cloneOf(h.pending.entries[1].from, h.files.srt);
      filing.removePending(w.home, h.pending);
      assert.deepEqual(await step(w, h, { paths: [h.files.srt], reads: [{ path: h.files.srt, id }] }), { busy: "restored" });
      assert.equal(existsSync(lockFile(w)), false);
      const fresh = await step(w, h, { paths: [h.files.srt], reads: [idOf(h.files.srt)] });
      assert.ok(fresh.end);
      fresh.end({ put: false });
      const nulled = await step(w, h, { paths: [h.files.srt], reads: [{ path: h.files.srt, id: null }] });
      assert.ok(nulled.end);
      nulled.end({ put: false });
    } finally {
      w.done();
    }
  });

  it("T16 restoreReads judges only a read that is gone or at another size, asks no lock otherwise, and puts it back", async () => {
    const w = world();
    try {
      const h = holdFinal(w, L);
      const rels = ["final/Talk main.srt", "final/Talk.brimm-ops.json"];
      const args = () => [ctxOf(w), { name: NAME, record: recordTwo(h), folder: h.folder, rels, rev: 3 }, { wait: async () => assert.fail("no wait") }];
      const lock = liveLock(w, NAME, "late check");
      assert.equal(await filing.restoreReads(...args()), "");
      assert.ok(existsSync(lockFile(w)));
      filing.releaseLateCheckLock(lock);
      rmSync(h.files.srt);
      assert.equal(await filing.restoreReads(...args()), "restored");
      assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
      assert.deepEqual(filing.readPendingAt(w.home, h.key), h.pending);
      assert.equal(existsSync(lockFile(w)), false);
      writeFileSync(h.files.srt, SRT.slice(0, 3));
      assert.equal(await filing.restoreReads(...args()), "restored");
      rmSync(h.files.srt);
      rmSync(h.work, { recursive: true, force: true });
      assert.equal(await filing.restoreReads(...args()), "lost");
      filing.removePending(w.home, h.pending);
      assert.equal(await filing.restoreReads(...args()), "");
      assert.equal(await filing.restoreReads(ctxOf(w), { name: NAME, record: recordTwo(h), folder: h.folder, rels: ["final/none.srt"], rev: 3 }, { wait: async () => {} }), "");
      const old = { ...recordTwo(h) };
      delete old.local;
      assert.equal(await filing.restoreReads(ctxOf(w), { name: NAME, record: old, folder: h.folder, rels, rev: 3 }, { wait: async () => {} }), "");
    } finally {
      w.done();
    }
  });
});

describe("a local import's first record, checked behind (L5)", () => {
  const AT = L + M15 + 1;
  const GONE = `The folder of ${LABEL} is gone from Episodes, so the check of its copies in Dropbox is not made. Ask Jason.`;
  const ourText = recordText(recordOf({ rev: 1 }));
  const has = (r, line) => r.logs.includes(`${LABEL}: ${line}`);
  const gone = (h) => !existsSync(join(pendingFolder(h.w.home), h.key)) && !existsSync(h.work);
  const make = (over = {}) => {
    const w = world();
    const h = holdRecord(w, L, over);
    return { ...h, w };
  };

  it("R1 puts back a first record Dropbox lost, then goes", async () => {
    const h = make({ there: "none" });
    try {
      const r = await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), ourText);
      assert.ok(gone(h));
      assert.ok(has(r, "Dropbox lost its first record, so it is put back."), r.logs.join("|"));
    } finally {
      h.w.done();
    }
  });

  it("R2 puts nothing back when a later record is there", async () => {
    const h = make({ there: "none", later: true });
    try {
      const r = await run(h.w, AT);
      assert.equal(existsSync(h.to), false);
      assert.ok(existsSync(join(h.folder, "record", "0002.json")));
      assert.ok(gone(h));
      assert.ok(has(r, "its first record is not in Dropbox, but a later one is, so nothing is put back."));
    } finally {
      h.w.done();
    }
  });

  it("R3 drops a pending whose record never reached Dropbox", async () => {
    for (const drop of ["there", "unknown"]) {
      const h = make({ copied: false, there: "none", drop });
      try {
        const r = await run(h.w, AT);
        assert.ok(gone(h));
        assert.deepEqual(readdirSync(join(h.folder, "record")), []);
        assert.ok(has(r, "its import stopped before its first record reached Dropbox, so there is nothing to check."));
        if (drop === "there") assert.equal(readFileSync(h.dropPath, "utf8"), MP4);
      } finally {
        h.w.done();
      }
    }
  });

  it("R4 takes a record that reached Dropbox before the import noted it as its own", async () => {
    const h = make({ copied: false, there: "ours" });
    try {
      const r = await run(h.w, AT);
      assert.ok(gone(h));
      assert.equal(readFileSync(h.to, "utf8"), ourText);
      assert.ok(has(r, "its first record is whole in Dropbox."));
    } finally {
      h.w.done();
    }
  });

  it("R5 never puts back over another import's first record", async () => {
    const h = make({ there: "another" });
    try {
      const was = readFileSync(h.to, "utf8");
      const r = await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), was);
      assert.ok(gone(h));
      assert.ok(has(r, "another import's first record is in its place now, so nothing is put back."));
    } finally {
      h.w.done();
    }
  });

  it("R5b drops the pending of a stopped import whose folder another import has filed since", async () => {
    const h = make({ copied: false, there: "another", drop: "there" });
    try {
      const was = readFileSync(h.to, "utf8");
      const r = await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), was);
      assert.ok(gone(h));
      assert.ok(has(r, "its import stopped before its first record reached Dropbox, so there is nothing to check."));
      assert.equal(r.logs.some((l) => l.includes("another import")), false);
    } finally {
      h.w.done();
    }
  });

  it("R6 puts back a first record Dropbox left unreadable", async () => {
    const h = make({ there: "unreadable" });
    try {
      await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), ourText);
      assert.ok(gone(h));
    } finally {
      h.w.done();
    }
  });

  it("R7 a first record that cannot be put back is a problem: one notice, made again at the next run's start", async () => {
    const h = make({ there: "none", workCopy: false });
    try {
      const line = `${LABEL}: Dropbox lost its first record: its first record is not in Dropbox, and its copy on this Mac is gone, so it could not be put back.`;
      const first = await run(h.w, AT);
      assert.deepEqual(first.notices, [`Dropbox lost a file of ${LABEL}, and it could not be put back. Ask Jason.`]);
      assert.ok(filing.readPendingAt(h.w.home, h.key).problem);
      assert.deepEqual(first.waits, []);
      assert.ok(first.logs.includes(line));
      const second = await run(h.w, AT + 1000);
      assert.ok(second.logs.includes(line));
      assert.deepEqual(second.notices, []);
    } finally {
      h.w.done();
    }
  });

  it("R8 waits when its folder cannot be looked at, looking again every five minutes for an hour", async () => {
    const h = make({});
    const dir = join(h.folder, "record");
    try {
      chmodSync(dir, 0o000);
      const before = filing.readPendingAt(h.w.home, h.key);
      const r = await run(h.w, AT);
      const after = filing.readPendingAt(h.w.home, h.key);
      const { nextLook, lookUntil, ...rest } = after;
      assert.deepEqual(rest, before);
      assert.equal(lookUntil, AT + filing.WAIT_LOOK_FOR_MS);
      assert.ok(existsSync(h.work));
      assert.ok(r.waits.reduce((a, b) => a + b, 0) >= filing.WAIT_LOOK_FOR_MS - filing.WAIT_LOOK_MS);
      assert.equal(r.logs.filter((l) => l.includes("its check waits: its folder in Episodes cannot be read now")).length, 1);
      const again = await run(h.w, AT + filing.WAIT_LOOK_FOR_MS + 120000);
      assert.equal(again.logs.filter((l) => l.includes("its check waits: its folder in Episodes cannot be read now")).length, 1);
    } finally {
      chmodSync(dir, 0o755);
      h.w.done();
    }
  });

  it("R9 makes a lost first record's folder again only while this Mac holds the episode's video, and waits while Episodes cannot be listed", async () => {
    // (a)
    let h = make({});
    try {
      rmSync(h.folder, { recursive: true, force: true });
      const r = await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), ourText);
      assert.ok(gone(h));
      assert.ok(has(r, "Dropbox lost its first record, so it is put back."));
      assert.deepEqual(r.notices, []);
    } finally {
      h.w.done();
    }
    // (b)
    h = make({ video: false });
    try {
      rmSync(h.folder, { recursive: true, force: true });
      const r = await run(h.w, AT);
      assert.ok(gone(h));
      assert.equal(existsSync(h.folder), false);
      assert.deepEqual(r.notices, [GONE]);
      assert.equal(r.logs.filter((l) => l === GONE).length, 1);
    } finally {
      h.w.done();
    }
    // (c)
    h = make({ there: "none" });
    const episodes = join(h.w.root, "Episodes");
    try {
      renameSync(episodes, `${episodes}.away`);
      const r = await run(h.w, AT);
      assert.ok(filing.readPendingAt(h.w.home, h.key).lookUntil);
      assert.ok(existsSync(h.work));
      assert.equal(r.logs.filter((l) => l.includes("its check waits: its folder in Episodes cannot be read now")).length, 1);
      assert.deepEqual(r.notices, []);
      assert.equal(existsSync(episodes), false);
    } finally {
      if (existsSync(`${episodes}.away`)) renameSync(`${episodes}.away`, episodes);
      h.w.done();
    }
    // (d)
    h = make({ there: "none" });
    const ep = join(h.w.root, "Episodes");
    try {
      renameSync(ep, `${ep}.away`);
      let first = true;
      const r = await run(h.w, AT, {
        onWait: (ms, c) => {
          if (first) { renameSync(`${ep}.away`, ep); first = false; }
          c.add(ms);
        }
      });
      assert.equal(readFileSync(h.to, "utf8"), ourText);
      assert.ok(gone(h));
      assert.ok(has(r, "Dropbox lost its first record, so it is put back."));
    } finally {
      if (existsSync(`${ep}.away`)) renameSync(`${ep}.away`, ep);
      h.w.done();
    }
    // (e)
    h = make({ copied: false, written: false, there: "none", video: false });
    try {
      rmSync(h.folder, { recursive: true, force: true });
      const r = await run(h.w, AT);
      assert.ok(gone(h));
      assert.ok(has(r, "its import stopped before its first record reached Dropbox, so there is nothing to check."));
      assert.deepEqual(r.notices, []);
      assert.equal(existsSync(h.folder), false);
    } finally {
      h.w.done();
    }
  });

  it("R10 takes a placeholder first record as in Dropbox, and does not read it", async () => {
    const h = make({ there: "unreadable" });
    try {
      const r = await run(h.w, AT, { isWhole: (p) => !p.endsWith("0001.json") });
      assert.equal(readFileSync(h.to, "utf8"), "{ half");
      assert.ok(gone(h));
      assert.ok(has(r, "its first record is whole in Dropbox."));
    } finally {
      h.w.done();
    }
  });

  it("R11 puts back a first record whose import stopped before it noted it, by this Mac's note that it wrote it", async () => {
    for (const drop of ["gone", "another"]) {
      const h = make({ copied: false, written: true, there: "none", drop });
      try {
        const r = await run(h.w, AT);
        assert.equal(readFileSync(h.to, "utf8"), ourText);
        assert.ok(gone(h));
        assert.ok(has(r, "Dropbox lost its first record, so it is put back."));
      } finally {
        h.w.done();
      }
    }
  });

  it("R12 puts nothing back while its video is still in the drop folder, for the next look to import it again", async () => {
    for (const swap of [false, true]) {
      const h = make({ there: "none", drop: "there" });
      try {
        if (swap) {
          const ino = statSync(h.dropPath).ino;
          // Another file is written beside it and renamed over it, so it is another file on every disk: a remove and a write may get the same inode back on Linux.
          writeFileSync(`${h.dropPath}.new`, MP4);
          renameSync(`${h.dropPath}.new`, h.dropPath);
          utimesSync(h.dropPath, new Date(L - 60000), new Date(L - 60000));
          assert.notEqual(statSync(h.dropPath).ino, ino);
        }
        const r = await run(h.w, AT);
        assert.equal(existsSync(h.to), false);
        assert.ok(gone(h));
        assert.equal(readFileSync(h.dropPath, "utf8"), MP4);
        assert.ok(has(r, "its first record is not in Dropbox, and its video is still in the drop folder, so the next look imports it again, and nothing is put back."));
      } finally {
        h.w.done();
      }
    }
  });

  it("R13 drops a pending whose import was stopped before its clone, though its video has left the drop folder", async () => {
    const h = make({ copied: false, written: false, there: "none", drop: "gone" });
    try {
      const r = await run(h.w, AT);
      assert.ok(gone(h));
      assert.deepEqual(readdirSync(join(h.folder, "record")), []);
      assert.ok(has(r, "its import stopped before its first record reached Dropbox, so there is nothing to check."));
    } finally {
      h.w.done();
    }
  });

  it("R14 replaces a garbled first record its stopped import wrote, and waits on one it cannot tell", async () => {
    for (const [there, written] of [["unreadable", true], ["short", false]]) {
      const h = make({ copied: false, written, there, drop: "there" });
      try {
        const r = await run(h.w, AT);
        assert.equal(readFileSync(h.to, "utf8"), ourText);
        assert.ok(gone(h));
        assert.ok(has(r, "Dropbox lost its first record, so it is put back."));
        assert.equal(readFileSync(h.dropPath, "utf8"), MP4);
      } finally {
        h.w.done();
      }
    }
    const h = make({ copied: false, written: false, there: "unreadable", drop: "there" });
    try {
      const r = await run(h.w, AT);
      assert.equal(readFileSync(h.to, "utf8"), "{ half");
      const p = filing.readPendingAt(h.w.home, h.key);
      assert.ok(p.nextLook && p.lookUntil);
      assert.ok(existsSync(h.work));
      assert.equal(r.logs.filter((l) => l.includes("whether it is this import's cannot be told")).length, 1);
    } finally {
      h.w.done();
    }
  });
});

describe("the check of a local finish's copies in final/ (L5)", () => {
  const AT = L + M15 + 1;
  const PROBLEM = 'The check of Talk\'s copies in Dropbox found a problem: say "how far is it?"';
  const stash = (w) => ({ home: w.home, name: NAME });
  const marker = (w, over = {}) => markChecking(w.home, NAME, { nonce: "", revision: 1, due: L + M15, took: ["Downloads"], ...over });
  const markerThere = (w) => existsSync(join(episodeWork(w.home, NAME), "finish.checking.json"));
  const gone = (w, h) => !existsSync(join(pendingFolder(w.home), h.key)) && !existsSync(h.work);
  const twentyOne = "x".repeat(21);
  const withWorld = async (fn) => {
    const w = world();
    try {
      return await fn(w);
    } finally {
      w.done();
    }
  };
  const rec = (h, n) => JSON.parse(readFileSync(recordFile(h.folder, n), "utf8"));
  const session = { marked: "2026-11-06T10:05:00-06:00", on: MAC, teachings: null, cleared: null };

  it("C1 puts back a missing copy, then deletes the export", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    rmSync(h.files.srt);
    marker(w);
    const r = await run(w, AT);
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.equal(existsSync(h.exportPath), false);
    assert.ok(gone(w, h));
    assert.equal(markerThere(w), false);
    for (const line of ["Talk: Talk main.srt in final/ was not whole in Dropbox (it is not there), so it is put back from its copy on this Mac.", "Talk: Talk main.mp4 is taken out of Downloads.", "Talk: the check of its copies in final/ passed: every copy the record lists is whole in Dropbox."]) assert.ok(r.logs.includes(line), r.logs.join("|"));
  }));

  it("C2 leaves a file the record in force lists at another size", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    h.later((r) => ({ files: { ...r.files, "final/Talk.brimm-ops.json": 21 }, finished: { ...r.finished, revision: 2 } }));
    writeFileSync(h.files.handoff, twentyOne);
    const r = await run(w, AT);
    assert.equal(readFileSync(h.files.handoff, "utf8"), twentyOne);
    assert.ok(r.logs.includes("Talk: 1 of its copies in final/ is from a later write, so the check leaves it as it is."));
    assert.equal(existsSync(h.exportPath), false);
  }));

  it("C3 leaves a file the record in force no longer lists", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    h.later((r) => { const files = { ...r.files }; delete files["final/Talk main.srt"]; return { files }; });
    rmSync(h.files.srt);
    await run(w, AT);
    assert.equal(existsSync(h.files.srt), false);
  }));

  it("C4 deletes the Downloads export only when every copy is whole and it is unchanged", async () => {
    await withWorld(async (w) => {
      const h = holdFinal(w, L, { workCopies: false });
      rmSync(h.files.srt);
      const r = await run(w, AT);
      assert.ok(existsSync(h.exportPath));
      assert.ok(r.logs.includes("Talk: the exports it took are kept in Downloads, because a copy in final/ was not whole."));
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      const later = new Date(statSync(h.exportPath).mtimeMs + 1000);
      utimesSync(h.exportPath, later, later);
      const r = await run(w, AT);
      assert.ok(existsSync(h.exportPath));
      assert.ok(r.logs.includes("Talk: Talk main.mp4 changed in Downloads after it was taken, so it is kept there."));
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      await run(w, AT);
      assert.equal(existsSync(h.exportPath), false);
    });
  });

  it("C5 deletes the export after a later revision that keeps its part, and keeps it after one that took the part again", async () => {
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      h.later((r) => ({ finished: { ...r.finished, revision: 2 } }));
      await run(w, AT);
      assert.equal(existsSync(h.exportPath), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      h.later((r) => ({ finished: { ...r.finished, revision: 2, parts: { main: { ...r.finished.parts.main, source: { bytes: 10, mtimeMs: h.M + 1000 } } } } }));
      const r = await run(w, AT);
      assert.ok(existsSync(h.exportPath));
      assert.ok(r.logs.includes("Talk: the hand-off in force no longer holds Talk main.mp4, so it is left in Downloads."));
    });
  });

  it("C6 never deletes an original that was not taken from Downloads", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    filing.writePending(w.home, { ...h.pending, took: [{ ...h.pending.took[0], place: "the exports folder" }] });
    const r = await run(w, AT);
    assert.ok(existsSync(h.exportPath));
    assert.ok(r.logs.includes("Talk: Talk main.mp4 was not taken from Downloads, so it is left where it is."));
  }));

  it("C6b keeps an export it cannot look at, and still completes", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const dir = join(w.home, "Downloads");
    chmodSync(dir, 0o000);
    try {
      const r = await run(w, AT);
      assert.ok(r.logs.some((l) => l.startsWith("Talk: Talk main.mp4 could not be looked at or taken out of Downloads (EACCES), so it is kept there. Delete it there by hand.")), r.logs.join("|"));
    } finally {
      chmodSync(dir, 0o755);
    }
    assert.ok(existsSync(h.exportPath));
    assert.ok(gone(w, h));
  }));

  it("C6c notes a refused Downloads in access.json, posts its banner once, keeps the export, and notes ok once a delete works", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const refuse = { names: ["statSync"], deny: (name, path) => (path === h.exportPath ? Object.assign(new Error(`EPERM: operation not permitted, stat '${path}'`), { code: "EPERM" }) : null) };
    const { result: r } = await watched(() => run(w, AT), refuse);
    const note = readAccess(w.home);
    assert.equal(note.places.downloads.state, "refused");
    assert.equal(note.places.downloads.code, "EPERM");
    assert.equal(r.notices.length, 1, r.notices.join("|"));
    assert.ok(r.notices[0].includes("Downloads"), r.notices[0]);
    assert.equal(r.notices.some((n) => n.includes("Talk main.mp4")), false);
    assert.ok(existsSync(h.exportPath));
    assert.ok(gone(w, h));
    // A second refused check within the hour posts no second banner.
    holdFinal(w, L);
    const { result: r2 } = await watched(() => run(w, AT + 1000), refuse);
    assert.deepEqual(r2.notices, []);
    assert.equal(readAccess(w.home).places.downloads.state, "refused");
    // Later, a delete that works notes ok.
    holdFinal(w, L);
    await run(w, AT + 2000);
    assert.equal(readAccess(w.home).places.downloads.state, "ok");
    assert.equal(existsSync(h.exportPath), false);
  }));

  it("C6d names BRIMM Video Studio in a refused Downloads' banner on an installed Mac, as macOS does (review finding 1)", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const refuse = { names: ["statSync"], deny: (name, path) => (path === h.exportPath ? Object.assign(new Error(`EPERM: operation not permitted, stat '${path}'`), { code: "EPERM" }) : null) };
    const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
    const { result: r } = await watched(() => run(w, AT, { build: INSTALLED }), refuse);
    assert.equal(readAccess(w.home).places.downloads.state, "refused");
    assert.deepEqual(r.notices, ["This Mac does not let BRIMM Video Studio look in the Downloads folder. Allow it in System Settings › Privacy & Security › Files and Folders."]);
  }));

  it("C7 flags a problem as today", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { workCopies: false });
    rmSync(h.files.mp4);
    const first = await run(w, AT);
    assert.deepEqual(first.notices, [PROBLEM]);
    assert.equal(problemFlagged(w.home, NAME), true);
    const p = filing.readPendingAt(w.home, h.key);
    assert.equal(p.problem, "Talk main.mp4 in final/ is not whole in Dropbox (it is not there), and its copy on this Mac is gone, so it could not be put back.");
    assert.equal(p.problem.includes(w.dir), false);
    assert.deepEqual(first.waits, []);
    const second = await run(w, AT + 1000);
    assert.deepEqual(second.notices, []);
    assert.ok(second.logs.some((l) => l.includes("found a problem: Talk main.mp4 in final/ is not whole")));
  }));

  it("C8 takes the note away once a check of the episode passes and no other has a problem", () => withWorld(async (w) => {
    const one = holdFinal(w, L, { problem: "x", workCopies: false });
    rmSync(one.files.srt);
    flagProblem(w.home, NAME, L);
    const two = holdFinal(w, L + 1000, { revision: 2, episode: false });
    const first = await run(w, AT);
    assert.deepEqual(first.notices, []);
    assert.equal(readFileSync(one.files.srt, "utf8"), SRT);
    assert.ok(filing.readPendingAt(w.home, one.key));
    assert.equal(filing.readPendingAt(w.home, two.key), null);
    assert.equal(problemFlagged(w.home, NAME), true);
    await run(w, AT + 1000);
    assert.equal(filing.readPendingAt(w.home, one.key), null);
    assert.equal(problemFlagged(w.home, NAME), false);
  }));

  it("C9 drops a pending for a revision the record never held", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { copied: false, recordWritten: false });
    rmSync(h.files.srt);
    const r = await run(w, AT);
    assert.ok(gone(w, h));
    assert.equal(existsSync(h.files.srt), false);
    assert.ok(existsSync(h.exportPath));
    assert.ok(r.logs.includes("an episode (ab0001): its finish stopped before its record was written, so the check of its copies is not made."));
  }));

  it("C10 a finish killed after its record but before it noted it still has its check made", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { copied: false });
    rmSync(h.files.srt);
    await run(w, AT);
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.equal(existsSync(h.exportPath), false);
  }));

  it("C11 waits when the record cannot be read, looking again every five minutes for an hour", async () => {
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      const copy = join(h.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-11-06).json");
      writeFileSync(copy, "{}");
      const r = await run(w, AT);
      const p = filing.readPendingAt(w.home, h.key);
      assert.ok(p.nextLook && p.lookUntil);
      assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits: the episode's record cannot be read now. It is looked at again later.").length, 1);
      assert.ok(r.waits.reduce((a, b) => a + b, 0) >= filing.WAIT_LOOK_FOR_MS - filing.WAIT_LOOK_MS);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      const copy = join(h.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-11-06).json");
      writeFileSync(copy, "{}");
      let n = 0;
      await run(w, AT, { onWait: (ms, c) => { n += 1; if (n === 2) rmSync(copy); c.add(ms); } });
      assert.equal(filing.readPendingAt(w.home, h.key), null);
      assert.equal(existsSync(h.exportPath), false);
    });
  });

  it("C12 puts the finish's own record back when it is gone and no later record is there, and then judges by it", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const text = readFileSync(h.pending.record.from, "utf8");
    rmSync(recordFile(h.folder, 2));
    rmSync(h.files.srt);
    const r = await run(w, AT);
    assert.equal(readFileSync(recordFile(h.folder, 2), "utf8"), text);
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.ok(r.logs.includes("an episode (ab0001): its record 0002.json was lost in Dropbox, so it is put back from its copy on this Mac."), r.logs.join("|"));
    assert.ok(r.logs.some((l) => l.includes("Talk main.srt in final/ was not whole")));
  }));

  it("C13 never puts the finish's record back over a record of that number, and calls the number taken a problem", async () => {
    for (const workCopies of [true, false]) {
      await withWorld(async (w) => {
        const h = holdFinal(w, L, { workCopies });
        const other = rec(h, 2);
        writeFileSync(recordFile(h.folder, 2), recordText({ ...other, finished: { ...other.finished, revision: 5 } }));
        const was = readFileSync(recordFile(h.folder, 2), "utf8");
        const r = await run(w, AT);
        assert.equal(readFileSync(recordFile(h.folder, 2), "utf8"), was);
        assert.deepEqual(r.notices, [PROBLEM]);
        assert.equal(problemFlagged(w.home, NAME), true);
        assert.equal(filing.readPendingAt(w.home, h.key).problem, "its record 0002.json was lost in Dropbox, and a later change took its number.");
        assert.ok(existsSync(h.exportPath));
        assert.ok(r.logs.includes("Talk: the exports it took are kept in Downloads, because a copy in final/ was not whole."));
        assert.equal(r.logs.some((l) => l.includes("passed")), false);
      });
    }
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      writeFileSync(recordFile(h.folder, 2), readFileSync(h.pending.record.from, "utf8"));
      const r = await run(w, AT);
      assert.deepEqual(r.notices, []);
      assert.ok(gone(w, h));
    });
  });

  it("C14 waits when it cannot tell whether its record was written", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { copied: false });
    writeFileSync(recordFile(h.folder, 2), "{ half");
    const r = await run(w, AT);
    const p = filing.readPendingAt(w.home, h.key);
    assert.ok(p.nextLook && p.lookUntil);
    assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits: whether its record reached Dropbox cannot be told now. It is looked at again later.").length, 1);
  }));

  it("C15 puts nothing back for a video the gate holds, and deletes no export, and no line names it by its name as a video", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    h.later(() => ({ session }));
    rmSync(h.files.srt);
    const lock = liveLock(w, NAME, "write");
    let first = true;
    const r = await run(w, AT, { onWait: (ms, c) => { if (first) { filing.releaseLateCheckLock(lock); first = false; } c.add(ms); } });
    assert.equal(existsSync(h.files.srt), false);
    assert.ok(existsSync(h.exportPath));
    assert.ok(gone(w, h));
    assert.ok(r.logs.includes("an episode (ab0001): its check waits a moment: a write is putting its files in."));
    assert.ok(r.logs.includes("a client or group session (ab0001): it is held as a session now, so nothing of its hand-off is put back into Dropbox, and its exports stay in Downloads."), r.logs.join("|"));
    assert.equal(r.logs.some((l) => l.includes("Talk")), false);
  }));

  const beside = (w) => {
    const other = join(w.root, "Episodes", "2026-11-06 Talk again (Mac Studio)", "record", "0001.json");
    mkdirSync(dirname(other), { recursive: true });
    writeFileSync(other, recordText(recordOf({ id: "e-20261106-cd0002", rev: 1, over: { versionOf: ID, session } })));
    return other;
  };

  it("C15b a video held beside a session is not checked until that session is cleared (C26)", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    rmSync(h.files.srt);
    const other = beside(w);
    const line = "a video (ab0001): another version of it is a session not cleared, so nothing of its hand-off is put back into Dropbox yet, and its exports stay in Downloads.";
    const r = await run(w, AT);
    assert.equal(existsSync(h.files.srt), false);
    assert.ok(existsSync(h.exportPath));
    const p = filing.readPendingAt(w.home, h.key);
    assert.equal(p.lookUntil, AT);
    assert.ok(existsSync(h.work));
    assert.deepEqual(r.waits, []);
    assert.equal(r.logs.filter((l) => l === line).length, 1);
    assert.equal(r.logs.some((l) => l.includes("Talk")), false);
    const again = await run(w, AT + 1000);
    assert.equal(again.logs.filter((l) => l === line).length, 1);
    // C26: the session beside it is cleared.
    writeFileSync(join(dirname(other), "0002.json"), recordText(recordOf({ id: "e-20261106-cd0002", rev: 2, over: { versionOf: ID, session: { ...session, cleared: { at: "2026-11-06T10:30:00-06:00", on: MAC, to: "private", confirmed: "dialog" } } } })));
    const third = await run(w, AT + 2000);
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.equal(existsSync(h.exportPath), false);
    assert.ok(gone(w, h));
    assert.ok(third.logs.some((l) => l.includes("passed")));
  }));

  it("C15c a hold beside a session, whose lookUntil is past, that a wake keeps from being due at a run's start is looked at once in the run, when it is due", async () => {
    const line = "a video (ab0001): another version of it is a session not cleared, so nothing of its hand-off is put back into Dropbox yet, and its exports stay in Downloads.";
    const start = L + 14 * 3600000;
    for (const [woke, atStart] of [[start - 60000, false], [null, true]]) {
      await withWorld(async (w) => {
        const h = holdFinal(w, L);
        filing.writePending(w.home, { ...h.pending, lookUntil: L + 60 * 60000 });
        rmSync(h.files.srt);
        beside(w);
        const r = await run(w, start, { wokeAt: () => woke });
        assert.equal(r.logs.filter((l) => l === line).length, 1, r.logs.join("|"));
        assert.equal(r.waits.length > 0, !atStart);
        if (!atStart) assert.ok(r.waits.every((ms) => ms > 0) && r.waits.reduce((a, b) => a + b, 0) >= 13 * 60000);
        assert.equal(existsSync(h.files.srt), false);
        assert.ok(existsSync(h.exportPath));
        assert.ok(filing.readPendingAt(w.home, h.key));
      });
    }
  });

  // A Mac's disk finds a name in NFC or in NFD alike; a Linux disk (CI) does not, so there the NFC name is another folder.
  it("C16d an episode folder that Episodes lists in NFD, named in NFC by its pending, is not taken for a gone folder", { skip: process.platform !== "darwin" ? "a Mac's disk finds a name in NFC or NFD alike" : false }, async () => {
    const nfc = "2026-11-06 Caf\u00e9 (Mac Studio)";
    const nfd = nfc.normalize("NFD");
    for (const kind of ["final", "record"]) {
      await withWorld(async (w) => {
        const h = kind === "final" ? holdFinal(w, L, { name: nfd }) : holdRecord(w, L, { name: nfd, there: "none" });
        const listed = readdirSync(join(w.root, "Episodes"));
        assert.deepEqual(listed, [nfd]);
        filing.writePending(w.home, { ...h.pending, name: nfc, folder: join(w.root, "Episodes", nfc) });
        const r = await run(w, AT);
        assert.deepEqual(r.notices, []);
        assert.equal(r.logs.some((l) => l.includes("is gone from Episodes")), false, r.logs.join("|"));
        assert.deepEqual(filing.readEveryPending(w.home).filter((p) => p.kind === kind && !p.problem), []);
      });
    }
  });

  it("C16 never makes a gone episode folder again, says so in one short notice, and waits while Episodes cannot be listed", async () => {
    const GONE = "The folder of an episode (ab0001) is gone from Episodes, so the check of its copies in Dropbox is not made. Ask Jason.";
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      rmSync(h.folder, { recursive: true });
      const r = await run(w, AT);
      assert.equal(existsSync(h.folder), false);
      assert.ok(existsSync(h.exportPath));
      assert.ok(gone(w, h));
      assert.deepEqual(r.notices, [GONE]);
      assert.equal(r.logs.filter((l) => l === GONE).length, 1);
      assert.equal(r.logs.some((l) => l.includes("Talk")), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      const episodes = join(w.root, "Episodes");
      renameSync(episodes, `${episodes}.away`);
      try {
        const r = await run(w, AT);
        assert.ok(existsSync(h.work));
        assert.ok(filing.readPendingAt(w.home, h.key).lookUntil);
        assert.ok(existsSync(h.exportPath));
        assert.deepEqual(r.notices, []);
        assert.equal(r.logs.filter((l) => l.includes("its check waits: its folder in Episodes cannot be read now")).length, 1);
        assert.equal(existsSync(episodes), false);
      } finally {
        renameSync(`${episodes}.away`, episodes);
      }
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      rmSync(h.folder, { recursive: true });
      const dir = join(pendingFolder(w.home), "final");
      chmodSync(dir, 0o555);
      let first;
      try {
        first = await run(w, AT);
      } finally {
        chmodSync(dir, 0o755);
      }
      assert.deepEqual(first.notices, []);
      assert.ok(first.logs.some((l) => l.includes("its check is made, but it could not be put away (EACCES)")), first.logs.join("|"));
      assert.ok(filing.readPendingAt(w.home, h.key));
      const next = await run(w, AT + 1000);
      assert.deepEqual(next.notices, [GONE]);
    });
  });

  it("C17 a check stopped after it took the export out and before it put its pending away is made again", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    marker(w);
    rmSync(h.exportPath);
    const r = await run(w, AT);
    assert.equal(r.logs.some((l) => l.includes("Talk main.mp4 is taken out of Downloads")), false);
    assert.ok(gone(w, h));
    assert.equal(markerThere(w), false);
  }));

  it("C18 puts back a copy of its size whose bytes are not the ones written", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    writeFileSync(h.files.srt, "1\nHo.\n\n");
    const r = await run(w, AT);
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.ok(r.logs.some((l) => l.includes("(its bytes are not the ones written)")));
  }));

  it("C19 takes a placeholder copy at its size as whole, and does not read it", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    writeFileSync(h.files.srt, "1\nHo.\n\n");
    await run(w, AT, { isWhole: (p) => p !== h.files.srt });
    assert.equal(readFileSync(h.files.srt, "utf8"), "1\nHo.\n\n");
    assert.equal(existsSync(h.exportPath), false);
  }));

  it("C20 takes a copy at its size whose work copy is gone as whole", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { workCopies: false });
    await run(w, AT);
    assert.equal(existsSync(h.exportPath), false);
    assert.equal(filing.readPendingAt(w.home, h.key), null);
  }));

  it("C21 waits when a folder of the episode cannot be searched", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const dir = join(h.folder, "final");
    rmSync(h.files.srt);
    chmodSync(dir, 0o000);
    try {
      const r = await run(w, AT);
      assert.ok(filing.readPendingAt(w.home, h.key).lookUntil);
      assert.equal(r.logs.filter((l) => l.includes("the episode's record cannot be read now")).length, 1);
    } finally {
      chmodSync(dir, 0o755);
    }
    assert.equal(existsSync(h.files.srt), false);
  }));

  it("C22 a later hand-off that takes the lost copy out of a check with a problem reopens it, and both are made in the run", async () => {
    for (const lookUntil of [false, true]) {
      await withWorld(async (w) => {
        const one = holdFinal(w, L, { workCopies: false });
        if (lookUntil) filing.writePending(w.home, { ...one.pending, lookUntil: L });
        rmSync(one.files.mp4);
        holdRecord(w, L + 30 * 60000, { id: "e-20261106-ab0002", name: "2026-11-06 Other (Mac Studio)" });
        let n = 0;
        const r = await run(w, AT, {
          onWait: async (ms, c) => {
            n += 1;
            if (n === 1) {
              const step = await filing.takeOutOfCheck(ctxOf(w, { now: () => c.now() }), { name: NAME, record: rec(one, 2), paths: [one.files.mp4], rev: 3 }, { wait: async () => {} });
              assert.deepEqual(step.end({ put: true }), { reopened: true });
              holdFinal(w, c.now(), { revision: 2, episode: false });
            }
            c.add(ms);
          }
        });
        assert.deepEqual(r.notices, [PROBLEM]);
        assert.equal(problemFlagged(w.home, NAME), false);
        assert.deepEqual(filing.readPendingsOf(w.home, "final"), []);
      });
    }
  });

  it("C23 flags a problem with the launch agent's deps, which carry no clock and no alive", () => withWorld(async (w) => {
    const h = holdFinal(w, Date.now() - 20 * 60000, { workCopies: false });
    rmSync(h.files.mp4);
    const r = await run(w, 0, { clock: undefined, alive: undefined, wokeAt: () => null });
    assert.equal(problemFlagged(w.home, NAME), true);
    assert.equal(r.notices.length, 1);
    assert.equal(r.logs.some((l) => l.includes("could not be made")), false);
  }));

  it("C24 drops a pending whose record's number holds another writer's record of its revision", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { copied: false, recordWritten: false });
    rmSync(h.files.srt);
    writeFileSync(recordFile(h.folder, 2), recordText(recordOf({ rev: 2, over: { name: { text: "Talk too", placeholder: false }, finished: { revision: 1, at: "x", on: MAC, handoff: "final/Talk.brimm-ops.json", parts: {} } } })));
    const r = await run(w, AT);
    assert.ok(gone(w, h));
    assert.equal(existsSync(h.files.srt), false);
    assert.ok(existsSync(h.exportPath));
    assert.ok(r.logs.some((l) => l.includes("its finish stopped before its record was written")));
  }));

  it("C25 keeps the export, as no longer held, when the record in force has no finish", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    h.later(() => ({ finished: null }));
    const r = await run(w, AT);
    assert.ok(existsSync(h.exportPath));
    assert.ok(r.logs.includes("Talk: the hand-off in force no longer holds Talk main.mp4, so it is left in Downloads."));
    assert.equal(r.logs.some((l) => l.includes("could not be looked at")), false);
    assert.ok(gone(w, h));
  }));

  it("C27 takes the note away before it removes the pending, so a check that cannot remove it leaves no note behind", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { problem: "x" });
    flagProblem(w.home, NAME, L);
    marker(w);
    const dir = join(pendingFolder(w.home), "final");
    chmodSync(dir, 0o555);
    let r;
    try {
      r = await run(w, AT);
    } finally {
      chmodSync(dir, 0o755);
    }
    assert.equal(problemFlagged(w.home, NAME), false);
    assert.equal(markerThere(w), false);
    assert.ok(filing.readPendingAt(w.home, h.key));
    assert.equal(r.logs.filter((l) => l === "Talk: its check is made, but it could not be put away (EACCES). The next run looks at it again.").length, 1, r.logs.join("|"));
  }));

  it("F4 makes a record's and a final's checks of one episode in one run", () => withWorld(async (w) => {
    const rh = holdRecord(w, L);
    const fh = holdFinal(w, L);
    const r = await run(w, AT);
    assert.ok(!existsSync(join(pendingFolder(w.home), rh.key)) && !existsSync(join(pendingFolder(w.home), fh.key)));
    assert.ok(!existsSync(rh.work) && !existsSync(fh.work));
    assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
    assert.ok(r.logs.includes(`${LABEL}: its first record is whole in Dropbox.`));
    assert.ok(r.logs.some((l) => l.includes("the check of its copies in final/ passed")));
  }));

  it("F5 makes an import's, a record's and a final's checks due at once, each under its own episode's lock", () => withWorld(async (w) => {
    holdImport(w, "X.mov", L);
    const rh = holdRecord(w, L);
    const fh = holdFinal(w, L, { id: "e-20261106-ab0002", name: "2026-11-06 Other (Mac Studio)" });
    await run(w, AT);
    assert.deepEqual(filing.readEveryPending(w.home), []);
    assert.ok(!existsSync(rh.work) && !existsSync(fh.work));
    assert.deepEqual(w.statuses(), []);
  }));

  it("F12 makes two final pendings of one episode, one after the other, in one run", () => withWorld(async (w) => {
    const one = holdFinal(w, L);
    const two = holdFinal(w, L + 1000, { revision: 2, episode: false });
    await run(w, AT);
    assert.deepEqual(filing.readEveryPending(w.home), []);
    assert.ok(!existsSync(one.work) && !existsSync(two.work));
    assert.equal(existsSync(one.exportPath), false);
    assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
  }));

  it("T14 ownRecordBack puts back a held finish's lost record before a command builds on the record before it, and nothing else", async () => {
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      rmSync(recordFile(h.folder, 2));
      assert.equal(filing.ownRecordBack(ctxOf(w), { name: NAME, folder: h.folder, record: rec(h, 1) }), true);
      assert.equal(readFileSync(recordFile(h.folder, 2), "utf8"), readFileSync(h.pending.record.from, "utf8"));
      assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
      assert.ok(readFileSync(join(w.home, "Library", "Logs", "brimm-video.log"), "utf8").includes("an episode (ab0001): its record 0002.json was lost in Dropbox, so it is put back from its copy on this Mac."));
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L, { copied: false, recordWritten: false });
      assert.equal(filing.ownRecordBack(ctxOf(w), { name: NAME, folder: h.folder, record: rec({ folder: h.folder }, 1) }), false);
      assert.equal(existsSync(recordFile(h.folder, 2)), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      assert.equal(filing.ownRecordBack(ctxOf(w), { name: NAME, folder: h.folder, record: rec(h, 2) }), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      rmSync(recordFile(h.folder, 2));
      const lock = liveLock(w, NAME, "late check");
      assert.equal(filing.ownRecordBack(ctxOf(w), { name: NAME, folder: h.folder, record: rec(h, 1) }), false);
      assert.equal(existsSync(recordFile(h.folder, 2)), false);
      assert.ok(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")));
      filing.releaseLateCheckLock(lock);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L, { workCopies: false });
      rmSync(recordFile(h.folder, 2));
      assert.equal(filing.ownRecordBack(ctxOf(w), { name: NAME, folder: h.folder, record: rec({ folder: h.folder }, 1) }), false);
      assert.equal(existsSync(recordFile(h.folder, 2)), false);
    });
  });
});

describe("a writer and the check, in each order (L5)", () => {
  const AT = L + M15 + 1;
  const twentyOne = "x".repeat(21);
  const withWorld = async (fn) => {
    const w = world();
    try {
      return await fn(w);
    } finally {
      w.done();
    }
  };
  const markOf = (w, rev = 3) => ({ pid: 999999, at: L, to: [join(w.root, "Episodes", NAME, "final", "Talk.brimm-ops.json")], nonce: "n", rev });

  it("W1 puts off a due check while a writer holds its lock, and makes it once it is let go, leaving the writer's file", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const lock = liveLock(w, NAME, "write");
    let n = 0;
    const r = await run(w, AT, {
      onWait: (ms, c) => {
        n += 1;
        if (n === 2) {
          writeFileSync(h.files.handoff, twentyOne);
          h.later((rec2) => ({ files: { ...rec2.files, "final/Talk.brimm-ops.json": 21 } }));
          filing.writePending(w.home, { ...h.pending, entries: h.pending.entries.filter((e) => e.to !== h.files.handoff) });
          filing.releaseLateCheckLock(lock);
        }
        c.add(ms);
      }
    });
    assert.equal(readFileSync(h.files.handoff, "utf8"), twentyOne);
    assert.deepEqual(r.waits, [filing.LOCK_AGAIN_MS, filing.LOCK_AGAIN_MS]);
    assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits a moment: a write is putting its files in.").length, 1);
  }));

  it("W2 settles a dead writer's mark by its record's number: a writer whose record was written keeps its files", async () => {
    for (const [bytes, sameSize] of [[twentyOne, false], ["x".repeat(16), true]]) {
      await withWorld(async (w) => {
        const h = holdFinal(w, L, { mark: markOf(w) });
        writeFileSync(h.files.handoff, bytes);
        h.later((r) => (sameSize ? { name: { text: "Talk", placeholder: false } } : { files: { ...r.files, "final/Talk.brimm-ops.json": 21 } }));
        deadLock(w, NAME);
        const r = await run(w, AT);
        assert.equal(readFileSync(h.files.handoff, "utf8"), bytes);
        assert.ok(r.logs.includes("an episode (ab0001): a write stopped while it put its files in. Its check leaves out 1 file the record says is that write's."), r.logs.join("|"));
        assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
      });
    }
  });

  it("W3 keeps every marked entry when the writer's record was not written, and puts the finish's file back over the stopped write's", async () => {
    for (const bytes of [twentyOne, "x".repeat(16)]) {
      await withWorld(async (w) => {
        const h = holdFinal(w, L, { mark: markOf(w) });
        writeFileSync(h.files.handoff, bytes);
        deadLock(w, NAME);
        await run(w, AT);
        assert.equal(readFileSync(h.files.handoff, "utf8"), HANDOFF);
      });
    }
  });

  it("W4 leaves a dead writer's mark, and waits, when the record cannot be read", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { mark: markOf(w) });
    writeFileSync(join(h.folder, "record", "0003 (Sallie's laptop's conflicted copy 2026-11-06).json"), "{}");
    const r = await run(w, AT);
    const p = filing.readPendingAt(w.home, h.key);
    assert.ok(p.reading && p.nextLook && p.lookUntil);
    assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits: a write stopped while it put its files in, and the episode's record cannot be read now. It is looked at again later.").length, 1);
  }));

  it("W5 takes over a lock a dead check left, and makes the check", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    deadLock(w, NAME, "late check");
    await run(w, AT);
    assert.equal(filing.readPendingAt(w.home, h.key), null);
    assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
  }));

  it("W6 puts off, at the per-minute timer, a check a writer's lock holds, and throws nothing", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    rmSync(h.files.srt);
    writeFileSync(join(w.drop, "B.mov"), "b");
    const lock = liveLock(w, NAME, "write");
    let tick = null;
    let seen = null;
    const r = runs(w, L);
    r.deps.every = (fn) => { tick = fn; return 1; };
    r.deps.cancel = () => {};
    r.deps.wait = async (ms) => { if (lock) filing.releaseLateCheckLock(lock); r.setNow(r.now() + ms); };
    await filing.importEpisodes(w.drop, r.deps, async (name) => {
      r.setNow(AT);
      assert.doesNotThrow(() => tick());
      seen = { pending: Boolean(filing.readPendingAt(w.home, h.key)), srt: existsSync(h.files.srt) };
      return { ok: true, name };
    });
    assert.deepEqual(seen, { pending: true, srt: false });
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.equal(filing.readPendingAt(w.home, h.key), null);
  }));

  it("W7 a check of a new kind that throws is said by its code, left for the next run, and stops nothing else", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    const rh = holdRecord(w, L, { id: "e-20261106-ab0002", name: "2026-11-06 Other (Mac Studio)", there: "none" });
    const text = readFileSync(rh.from, "utf8");
    const r = await run(w, AT, { checks: { final: () => { throw Object.assign(new Error("x"), { code: "EACCES" }); } } });
    assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check could not be made (EACCES). The next run makes it again.").length, 1);
    assert.ok(filing.readPendingAt(w.home, h.key));
    assert.equal(readFileSync(rh.to, "utf8"), text);
    assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
  }));

  it("W8 pins ruling 20's cost: after a stopped writer, a record-only write that took its number leaves the writer's files unchecked", () => withWorld(async (w) => {
    const h = holdFinal(w, L, { mark: markOf(w) });
    writeFileSync(h.files.handoff, twentyOne);
    deadLock(w, NAME);
    h.later(() => ({ name: { text: "Talk too", placeholder: false } }));
    const r = await run(w, AT);
    assert.equal(readFileSync(h.files.handoff, "utf8"), twentyOne);
    assert.ok(r.logs.some((l) => l.includes("a write stopped while it put its files in")));
  }));

  it("W9 puts off a check while a live finish run holds the episode's lock, and makes it once the run ends", async () => {
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      const lock = lockOf(w.home, NAME);
      mkdirSync(dirname(lock), { recursive: true });
      assert.equal(takeEpisodeLock(lock, "finish", mine).taken, true);
      let n = 0;
      const seen = [];
      const r = await run(w, AT, {
        onWait: (ms, c) => {
          n += 1;
          if (n === 1) seen.push([existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), existsSync(h.exportPath)]);
          if (n === 2) rmSync(lock);
          c.add(ms);
        }
      });
      assert.deepEqual(r.waits, [filing.LOCK_AGAIN_MS, filing.LOCK_AGAIN_MS]);
      assert.deepEqual(seen, [[false, true]]);
      assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits until the finish at work on it ends.").length, 1);
      assert.equal(existsSync(h.exportPath), false);
      assert.equal(filing.readPendingAt(w.home, h.key), null);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      mkdirSync(episodeWork(w.home, NAME), { recursive: true });
      writeFileSync(lockOf(w.home, NAME), JSON.stringify({ pid: 999999, command: "finish", nonce: "x" }));
      const r = await run(w, AT);
      assert.deepEqual(r.waits, []);
      assert.equal(existsSync(h.exportPath), false);
    });
  });

  it("W9b puts off a check for a minute after her yes to a finish whose run has not taken its lock yet", async () => {
    const asked = (w, ago) => {
      mkdirSync(episodeWork(w.home, NAME), { recursive: true });
      writeFileSync(join(episodeWork(w.home, NAME), "finish.asked.json"), JSON.stringify({ version: 1, at: localStamp(new Date(AT - ago)), rev: 2, parts: [] }));
    };
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      asked(w, 30000);
      const r = await run(w, AT);
      assert.ok(r.waits.length >= 3);
      assert.equal(r.logs.filter((l) => l.includes("its check waits until the finish at work on it ends")).length, 1);
      assert.equal(existsSync(h.exportPath), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      asked(w, 30000);
      writeFileSync(join(episodeWork(w.home, NAME), "finish.result.json"), JSON.stringify({ ok: true, started: AT - 29000, ended: AT - 10000 }));
      const r = await run(w, AT);
      assert.deepEqual(r.waits, []);
      assert.equal(existsSync(h.exportPath), false);
    });
    await withWorld(async (w) => {
      const h = holdFinal(w, L);
      asked(w, 120000);
      const r = await run(w, AT);
      assert.deepEqual(r.waits, []);
      assert.equal(existsSync(h.exportPath), false);
    });
  });

  it("W10 asks again under its lock before it deletes an export, when her yes came while it read the copies", () => withWorld(async (w) => {
    const h = holdFinal(w, L);
    rmSync(h.files.srt);
    let asked = false;
    const isWhole = () => {
      if (!asked) {
        asked = true;
        mkdirSync(episodeWork(w.home, NAME), { recursive: true });
        writeFileSync(join(episodeWork(w.home, NAME), "finish.asked.json"), JSON.stringify({ version: 1, at: localStamp(new Date(AT)), rev: 2, parts: [] }));
      }
      return true;
    };
    const r = await run(w, AT, { isWhole });
    assert.equal(readFileSync(h.files.srt, "utf8"), SRT);
    assert.equal(r.logs.filter((l) => l === "Talk: its check waits until the finish at work on it ends.").length, 1);
    assert.equal(r.logs.filter((l) => l === "an episode (ab0001): its check waits until the finish at work on it ends.").length, 1);
    assert.equal(existsSync(h.exportPath), false);
    assert.equal(filing.readPendingAt(w.home, h.key), null);
    assert.equal(existsSync(join(episodeWork(w.home, NAME), "late-check.lock")), false);
  }));
});
