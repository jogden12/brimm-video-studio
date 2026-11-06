// late-wait.js (plan R1b): the local source a run that waits for the import's late check can read instead of waiting, and the moment
// that check is made (lateCheckAt). A late check is never skipped: the local file counts only while this Mac still owes the check
// for the video, is the file that came in (same size, same file as the pending one says), and is whole.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LATE_CHECK_MS } from "../dropbox.js";
import { fileId, lateCheckLockOf, readPendings, takeLateCheckLock, writePending } from "../filing.js";
import { LOCK_LOOK_MS, LOCK_WAIT_MS, keepCheckInStep, lateCheckAt, localSource, ownCheckOnly, projectWaits, readingCheckAt, readingWaitsUntil } from "../late-wait.js";
import { lockOf, resultFile, takeEpisodeLock } from "../detached.js";
import { pendingFolder } from "../settings.js";
import { writeStatus } from "../importing.js";

const ID = "e-20261014-3fa9c1";
const NOW = 1_800_000_000_000;

function setup() {
  const base = mkdtempSync(join(tmpdir(), "late-wait-"));
  const home = join(base, "home");
  const root = join(base, "BRIMM Video");
  const work = join(base, "work");
  const drop = join(base, "drop");
  const folder = join(root, "Episodes", "2026-10-14 Pricing talk (Mac Studio)");
  for (const dir of [home, folder, work, drop]) mkdirSync(dir, { recursive: true });
  const file = join(drop, "Pricing talk.mp4");
  writeFileSync(file, "x".repeat(40));
  // The episode's own video in Dropbox, which the work copy's key comes from.
  writeFileSync(join(folder, "Pricing talk.mp4"), "x".repeat(40));
  const record = { id: ID, video: { file: "Pricing talk.mp4", bytes: 40 } };
  const ctx = { home, root, machine: "Mac Studio", now: () => NOW, isWhole: () => true };
  const pending = (over = {}) => ({
    version: 1, id: ID, name: "n", folder, video: "Pricing talk.mp4", bytes: 40, seconds: 5, drop: file, dropFile: fileId(file), importId: "x", work,
    entries: [{ from: file, to: join(folder, "Pricing talk.mp4"), bytes: 40 }], lastCopy: NOW - 5 * 60 * 1000, root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt", ...over
  });
  return { base, home, root, work, drop, folder, file, record, ctx, pending, done: () => rmSync(base, { recursive: true, force: true }) };
}

describe("localSource", () => {
  it("gives the drop file of this Mac's pending late check when it is the file that came in, whole, and of the video's size", () => {
    const s = setup();
    writePending(s.home, s.pending());
    assert.deepEqual(localSource(s.ctx, s.record), { path: s.file });
    s.done();
  });
  it("gives null for a drop file of another size", () => {
    const s = setup();
    writePending(s.home, s.pending());
    assert.equal(localSource(s.ctx, { ...s.record, video: { ...s.record.video, bytes: 41 } }), null);
    writeFileSync(s.file, "y".repeat(41));
    assert.equal(localSource(s.ctx, s.record), null);
    s.done();
  });
  it("gives null for a drop file that is not the imported one any more", () => {
    const s = setup();
    writePending(s.home, s.pending());
    utimesSync(s.file, new Date(1_000_000), new Date(1_000_000));
    assert.equal(localSource(s.ctx, s.record), null);
    s.done();
  });
  it("gives null when the drop file is gone, or is not whole on this Mac", () => {
    const s = setup();
    writePending(s.home, s.pending());
    assert.equal(localSource({ ...s.ctx, isWhole: () => false }, s.record), null);
    rmSync(s.file);
    assert.equal(localSource(s.ctx, s.record), null);
    s.done();
  });
  it("gives null when the episode's video in Dropbox is missing, short, or not whole: the run waits as before, for the key comes from that file", () => {
    for (const [what, spoil] of [
      ["missing", (s) => rmSync(join(s.folder, "Pricing talk.mp4"))],
      ["short", (s) => writeFileSync(join(s.folder, "Pricing talk.mp4"), "xxx")],
      ["not whole", (s) => { s.ctx.isWhole = (path) => !path.startsWith(s.folder); }]
    ]) {
      const s = setup();
      writePending(s.home, s.pending());
      spoil(s);
      assert.equal(localSource(s.ctx, s.record), null, what);
      s.done();
    }
  });
  it("gives null for a pending check that found a problem, and for none", () => {
    const s = setup();
    assert.equal(localSource(s.ctx, s.record), null);
    writePending(s.home, s.pending({ problem: "Pricing talk.srt is not whole in Dropbox." }));
    assert.equal(localSource(s.ctx, s.record), null);
    s.done();
  });
  it("gives null for another episode's pending check, another Mac's, and another root's", () => {
    for (const over of [{ id: "e-20261001-aaaaaa" }, { machine: "Sallie's laptop" }, { root: "/somewhere/else" }]) {
      const s = setup();
      writePending(s.home, s.pending(over));
      assert.equal(localSource(s.ctx, s.record), null, JSON.stringify(over));
      s.done();
    }
  });
  it("finds a joined video's file among the entries put in: the entry whose to is the video's name, whose from is whole and of the video's size", () => {
    const s = setup();
    const out = join(s.work, "Take 1.mov");
    const other = join(s.work, "Take 1.words.json");
    writeFileSync(out, "z".repeat(40));
    writeFileSync(other, "{}");
    writeFileSync(join(s.folder, "Take 1.mov"), "z".repeat(40));
    const entries = [
      { from: other, to: join(s.folder, "Take 1.words.json"), bytes: 2 },
      { from: out, to: join(s.folder, "Take 1.mov"), bytes: 40 }
    ];
    writePending(s.home, s.pending({ video: "Take 1.mov", drop: join(s.work, "not in a drop folder"), dropFile: null, entries }));
    const record = { id: ID, video: { file: "Take 1.mov", bytes: 40 } };
    assert.deepEqual(localSource(s.ctx, record), { path: out });
    // Another size, a file that is gone, or one that is not whole: null.
    assert.equal(localSource(s.ctx, { ...record, video: { ...record.video, bytes: 39 } }), null);
    assert.equal(localSource({ ...s.ctx, isWhole: () => false }, record), null);
    rmSync(out);
    assert.equal(localSource(s.ctx, record), null);
    s.done();
  });
});

describe("lateCheckAt", () => {
  it("is the pending check's time, or now when that has passed, and null when nothing holds the video", () => {
    const s = setup();
    assert.equal(lateCheckAt(s.ctx, s.record), null);
    writePending(s.home, s.pending());
    assert.equal(lateCheckAt(s.ctx, s.record), NOW - 5 * 60 * 1000 + LATE_CHECK_MS);
    writePending(s.home, s.pending({ lastCopy: NOW - 40 * 60 * 1000 }));
    assert.equal(lateCheckAt(s.ctx, s.record), NOW);
    writePending(s.home, s.pending({ problem: "a problem" }));
    assert.equal(lateCheckAt(s.ctx, s.record), null);
    s.done();
  });
});

// --- plan R1c: the reading starts at once, and keeps the import's late check in step ---

const ALIVE = (pid) => pid === process.pid;
const NAME = "2026-10-14 Pricing talk (Mac Studio)";
/** An import status of the video, written `ago` milliseconds before NOW, with `over` laid on it. */
function status(s, over = {}) {
  const { ago = 0, ...rest } = over;
  writeStatus(s.root, { version: 1, machine: "Mac Studio", pid: process.pid, import: "x", video: "Pricing talk.mp4", bytes: 40, seconds: 5, step: "Waiting for its late check", at: new Date(NOW - ago).toISOString(), ...rest }, (to, text) => writeFileSync(to, text));
}
const REPLACED = ["Pricing talk.cut-plan.json", "Pricing talk.cut-plan.txt", "Pricing talk.rough-cut.srt", "Pricing talk.rough-cut.transcript.txt"];
/** The entries a light import's pending names: the video, the srt, the words, the record and the four files a raw reading replaces,
    each with a work copy as the import made it. */
function raw(s) {
  const names = ["Pricing talk.srt", "Pricing talk.words.json", "record/0001.json", ...REPLACED];
  mkdirSync(join(s.folder, "record"), { recursive: true });
  const entries = [{ from: s.file, to: join(s.folder, "Pricing talk.mp4"), bytes: 40 }];
  for (const name of names) {
    const from = join(s.work, name.replace("/", "-"));
    writeFileSync(from, `work copy of ${name}`);
    writeFileSync(join(s.folder, name), `import's ${name}`);
    entries.push({ from, to: join(s.folder, name), bytes: 10 + name.length });
  }
  return entries;
}
const ctxOf = (s) => ({ ...s.ctx, alive: ALIVE });
const step = (s, over = {}) => ({ name: NAME, record: { ...s.record, kind: "raw", name: { text: "Pricing talk", placeholder: false } }, paths: REPLACED.map((n) => join(s.folder, n)), ...over });
/** A wait that notes each call, does `on(n)` at the nth, and a log. */
const waiter = () => {
  const w = { waits: [], logs: [] };
  w.wait = async (ms) => {
    w.waits.push(ms);
    if (w.on) w.on(w.waits.length);
  };
  w.log = (line) => w.logs.push(line);
  return w;
};
const lockFile = (s) => lateCheckLockOf(s.home, NAME);
const pendingText = (s) => readFileSync(join(pendingFolder(s.home), `${ID}.json`), "utf8");

describe("ownCheckOnly and readingWaitsUntil (R1c)", () => {
  it("is true with this Mac's pending and no status, and with this Mac's import at work; readingWaitsUntil is then null", () => {
    for (const withStatus of [false, true]) {
      const s = setup();
      writePending(s.home, s.pending());
      if (withStatus) status(s);
      assert.equal(ownCheckOnly(ctxOf(s), s.record), true, String(withStatus));
      assert.equal(readingWaitsUntil(ctxOf(s), s.record), null, String(withStatus));
      s.done();
    }
  });
  it("is false with the other Mac's status at work, a failed or a problem status, a pending that found a problem, no pending, and another Mac's or root's pending; readingWaitsUntil is then lateCheckAt", () => {
    const cases = [
      ["the other Mac's status at work", (s) => { writePending(s.home, s.pending()); status(s, { machine: "Sallie's laptop" }); }],
      ["a failed status", (s) => { writePending(s.home, s.pending()); status(s, { failed: "disk full", step: "Importing" }); }],
      ["a problem status", (s) => { writePending(s.home, s.pending()); status(s, { problem: "a file is short", step: "Late check" }); }],
      ["a pending that found a problem", (s) => writePending(s.home, s.pending({ problem: "a file is short" }))],
      ["no pending", (s) => status(s)],
      ["another Mac's pending", (s) => writePending(s.home, s.pending({ machine: "Sallie's laptop" }))],
      ["another root's pending", (s) => writePending(s.home, s.pending({ root: "/somewhere/else" }))]
    ];
    for (const [what, arrange] of cases) {
      const s = setup();
      arrange(s);
      assert.equal(ownCheckOnly(ctxOf(s), s.record), false, what);
      assert.equal(readingWaitsUntil(ctxOf(s), s.record), lateCheckAt(ctxOf(s), s.record), what);
      s.done();
    }
  });
});

describe("keepCheckInStep (R1c)", () => {
  it("gives none, taking no lock and writing nothing, with no pending, and with a pending none of whose entries is among the paths", async () => {
    const s = setup();
    const w = waiter();
    assert.deepEqual(await keepCheckInStep(ctxOf(s), step(s), w), { none: true });
    assert.equal(existsSync(lockFile(s)), false);
    assert.deepEqual(readdirSync(s.home), []);
    writePending(s.home, s.pending());
    const before = pendingText(s);
    assert.deepEqual(await keepCheckInStep(ctxOf(s), step(s), w), { none: true });
    assert.equal(pendingText(s), before);
    assert.equal(existsSync(lockFile(s)), false);
    assert.deepEqual(w.waits, []);
    s.done();
  });
  it("takes the lock for read and marks the four files; end({ put: true }) takes exactly those entries out, leaves every other field, and lets the lock go", async () => {
    const s = setup();
    const entries = raw(s);
    writePending(s.home, s.pending({ entries, label: "Video of 14 Oct" }));
    const got = await keepCheckInStep(ctxOf(s), step(s), waiter());
    assert.equal(typeof got.end, "function");
    const held = JSON.parse(readFileSync(lockFile(s), "utf8"));
    assert.deepEqual([held.pid, held.command], [process.pid, "read"]);
    const marked = readPendings(s.home)[0];
    assert.deepEqual(marked.reading.to.slice().sort(), REPLACED.map((n) => join(s.folder, n)).sort());
    assert.deepEqual([marked.reading.pid, marked.reading.at], [process.pid, NOW]);
    got.end({ put: true });
    const after = readPendings(s.home)[0];
    assert.deepEqual(after.entries, entries.filter((e) => !REPLACED.some((n) => e.to.endsWith(n))));
    assert.equal("reading" in after, false);
    assert.equal(existsSync(lockFile(s)), false);
    const was = s.pending({ entries, label: "Video of 14 Oct" });
    for (const k of Object.keys(was).filter((k) => k !== "entries")) assert.deepEqual(after[k], was[k], k);
    s.done();
  });
  it("end({ put: false }) leaves the entries as they were, with no mark and no lock; a second end changes nothing and lets no one else's lock go", async () => {
    const s = setup();
    const entries = raw(s);
    writePending(s.home, s.pending({ entries }));
    const got = await keepCheckInStep(ctxOf(s), step(s), waiter());
    got.end({ put: false });
    assert.deepEqual(readPendings(s.home)[0], s.pending({ entries }));
    assert.equal(existsSync(lockFile(s)), false);
    // The import's check takes the lock meanwhile: a second end must neither write nor let its lock go.
    assert.ok(takeLateCheckLock(s.home, NAME, "late check", ALIVE));
    const text = pendingText(s);
    got.end({ put: true });
    assert.equal(pendingText(s), text);
    assert.equal(existsSync(lockFile(s)), true);
    s.done();
  });
  it("looks again every LOCK_LOOK_MS while the import's check holds the lock, and takes it once it is let go at the third look", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s) }));
    assert.ok(takeLateCheckLock(s.home, NAME, "late check", ALIVE));
    const w = waiter();
    w.on = (n) => n === 3 && rmSync(lockFile(s));
    const got = await keepCheckInStep(ctxOf(s), step(s), w);
    assert.deepEqual(w.waits, [LOCK_LOOK_MS, LOCK_LOOK_MS, LOCK_LOOK_MS]);
    assert.equal(typeof got.end, "function");
    got.end({ put: false });
    s.done();
  });
  it("gives up after LOCK_WAIT_MS in the words of the two minutes, writing nothing", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s) }));
    assert.ok(takeLateCheckLock(s.home, NAME, "late check", ALIVE));
    const before = pendingText(s);
    const w = waiter();
    const got = await keepCheckInStep(ctxOf(s), step(s), w);
    assert.deepEqual(got, { why: "The import was still checking its copies of Pricing talk in Dropbox after two minutes, so nothing Claude read was put in." });
    assert.equal(w.waits.length, LOCK_WAIT_MS / LOCK_LOOK_MS);
    assert.equal(pendingText(s), before);
    s.done();
  });
  it("takes at once a lock a dead process left", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s) }));
    mkdirSync(join(lockFile(s), ".."), { recursive: true });
    writeFileSync(lockFile(s), JSON.stringify({ pid: 999999, command: "late check", nonce: "n" }));
    const w = waiter();
    const got = await keepCheckInStep(ctxOf(s), step(s), w);
    assert.deepEqual(w.waits, []);
    assert.equal(typeof got.end, "function");
    got.end({ put: false });
    s.done();
  });
  it("lets the lock go and says the check's words when the pending has found a problem by the time the lock is taken, writing nothing", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s), problem: "Pricing talk.srt is not whole in Dropbox." }));
    const before = pendingText(s);
    const got = await keepCheckInStep(ctxOf(s), step(s), waiter());
    assert.equal(got.why, "The late check of this episode's import found a problem: Pricing talk.srt is not whole in Dropbox. Once it is put right, say \"try it again\" for Pricing talk.mp4 on Mac Studio, then say this again.");
    assert.equal(existsSync(lockFile(s)), false);
    assert.equal(pendingText(s), before);
    s.done();
  });
  it("lets the lock go and gives none when the check was made while it waited for the lock", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s) }));
    assert.ok(takeLateCheckLock(s.home, NAME, "late check", ALIVE));
    const w = waiter();
    w.on = () => {
      rmSync(join(pendingFolder(s.home), `${ID}.json`));
      rmSync(lockFile(s));
    };
    assert.deepEqual(await keepCheckInStep(ctxOf(s), step(s), w), { none: true });
    assert.equal(existsSync(lockFile(s)), false);
    s.done();
  });
  it("finds the entries however the paths are spelled: a /./ part, or an accent in NFD", async () => {
    const s = setup();
    const entries = raw(s);
    // The pending spells the episode's folder in NFD with a /./ part; the reading's paths are NFC and plain.
    const odd = (p) => p.replace(s.folder, `${s.folder}/.`).replace("Pricing talk", "Pricing talk".normalize("NFD"));
    writePending(s.home, s.pending({ entries: entries.map((e) => ({ ...e, to: odd(e.to) })) }));
    const got = await keepCheckInStep(ctxOf(s), step(s, { paths: REPLACED.map((n) => join(s.folder, n).normalize("NFC")) }), waiter());
    assert.equal(typeof got.end, "function");
    got.end({ put: true });
    assert.equal(readPendings(s.home)[0].entries.length, entries.length - 4);
    // An accented name: the same file spelled in NFC and in NFD is one file.
    const t = setup();
    const accented = join(t.folder, "Café talk.srt");
    writePending(t.home, t.pending({ entries: [{ from: t.file, to: accented.normalize("NFD"), bytes: 1 }] }));
    const again = await keepCheckInStep(ctxOf(t), { name: NAME, record: { ...t.record, kind: "raw", name: { text: "Café", placeholder: false } }, paths: [accented.normalize("NFC")] }, waiter());
    assert.equal(typeof again.end, "function");
    again.end({ put: false });
    s.done();
    t.done();
  });
  it("settles a mark an earlier reading left (it died) before it marks its own", async () => {
    const s = setup();
    const entries = raw(s);
    mkdirSync(join(s.folder, "record"), { recursive: true });
    writePending(s.home, s.pending({ entries, reading: { pid: 999999, at: NOW - 60000, to: [join(s.folder, REPLACED[0])] } }));
    // No record that reads: the mark cannot be settled yet.
    const got = await keepCheckInStep(ctxOf(s), step(s), waiter());
    assert.match(got.why, /^The import's check of its copies of Pricing talk in Dropbox is not settled yet/);
    assert.equal(existsSync(lockFile(s)), false);
    assert.ok(readPendings(s.home)[0].reading, "the old mark stays");
    s.done();
  });
  it("end whose write fails logs it, leaves the mark, and lets the lock go", async () => {
    const s = setup();
    writePending(s.home, s.pending({ entries: raw(s) }));
    const w = waiter();
    const got = await keepCheckInStep(ctxOf(s), step(s), w);
    chmodSync(pendingFolder(s.home), 0o555);
    try {
      got.end({ put: true });
    } finally {
      chmodSync(pendingFolder(s.home), 0o755);
    }
    assert.equal(existsSync(lockFile(s)), false);
    assert.ok(readPendings(s.home)[0].reading, "the mark stays");
    assert.equal(w.logs.length, 1);
    assert.match(w.logs[0], /could not be kept in step/);
    s.done();
  });
});

describe("projectWaits and readingCheckAt (R1d)", () => {
  const read = (s, over = {}) => ({ ...s.record, kind: "raw", name: { text: "Pricing talk", placeholder: false }, answer: { at: "2026-10-14 10:00" }, reading: { at: "2026-10-14 10:05", kind: "raw" }, ...over });
  const unread = (s) => read(s, { reading: { at: "2026-10-14 09:00", kind: "raw" } });
  const lock = (s, command = "read") => {
    mkdirSync(join(s.home, "work", NAME), { recursive: true });
    const path = lockOf(s.home, NAME);
    mkdirSync(join(path, ".."), { recursive: true });
    assert.ok(takeEpisodeLock(path, command, ALIVE).taken);
  };
  const early = (s, over = {}) => {
    mkdirSync(join(resultFile(s.home, NAME, "read"), ".."), { recursive: true });
    writeFileSync(resultFile(s.home, NAME, "read"), JSON.stringify({ version: 1, command: "read", started: NOW - 1000, ended: NOW - 5000, ok: true, made: [], failed: [], next: "", early: true, pid: process.pid, ...over }));
  };
  const asks = (s, record) => ({ name: NAME, record });
  it("says reading with a live read lock and a record whose reading is older than its answer or has none", () => {
    const s = setup();
    lock(s);
    assert.equal(projectWaits(ctxOf(s), asks(s, unread(s))), "reading");
    const none = read(s);
    delete none.reading;
    assert.equal(projectWaits(ctxOf(s), asks(s, none)), "reading");
    s.done();
  });
  it("says verify with the live read lock and the current reading in the record", () => {
    const s = setup();
    lock(s);
    assert.equal(projectWaits(ctxOf(s), asks(s, read(s))), "verify");
    s.done();
  });
  it("says verify with no run and this Mac's pending of the record, with or without a problem", () => {
    const s = setup();
    writePending(s.home, s.pending());
    assert.equal(projectWaits(ctxOf(s), asks(s, read(s))), "verify");
    writePending(s.home, s.pending({ problem: "x is missing" }));
    assert.equal(projectWaits(ctxOf(s), asks(s, read(s))), "verify");
    s.done();
  });
  it("says nothing with no run and no pending, with a live lock of another command, and with a read lock whose process is gone", () => {
    const s = setup();
    assert.equal(projectWaits(ctxOf(s), asks(s, read(s))), "");
    s.done();
    const t = setup();
    lock(t, "finish");
    assert.equal(projectWaits(ctxOf(t), asks(t, read(t))), "");
    t.done();
    const u = setup();
    lock(u);
    assert.equal(projectWaits({ ...ctxOf(u), alive: () => false }, asks(u, read(u))), "");
    u.done();
  });
  it("gives the early result's end plus the late check for the live read run, and null otherwise", () => {
    const s = setup();
    lock(s);
    early(s);
    assert.equal(readingCheckAt(ctxOf(s), asks(s, read(s))), NOW - 5000 + LATE_CHECK_MS);
    assert.equal(readingCheckAt(ctxOf(s), asks(s, unread(s))), null, "no current reading");
    early(s, { pid: process.pid + 1 });
    assert.equal(readingCheckAt(ctxOf(s), asks(s, read(s))), null, "another pid");
    early(s, { early: undefined });
    assert.equal(readingCheckAt(ctxOf(s), asks(s, read(s))), null, "a final result");
    rmSync(resultFile(s.home, NAME, "read"));
    assert.equal(readingCheckAt(ctxOf(s), asks(s, read(s))), null, "no result");
    s.done();
  });
});
