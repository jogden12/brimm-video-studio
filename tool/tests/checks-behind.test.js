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
import { acceptRev } from "../episode.js";
import { HANDOFF, ID, L, MAC, NAME, SRT, holdFinal, holdImport, holdRecord, mine, run, runs, world } from "./checks-world.js";

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
