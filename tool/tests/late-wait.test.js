// late-wait.js (plan R1b): the local source a run that waits for the import's late check can read instead of waiting, and the moment
// that check is made (lateCheckAt). A late check is never skipped: the local file counts only while this Mac still owes the check
// for the video, is the file that came in (same size, same file as the pending one says), and is whole.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LATE_CHECK_MS } from "../dropbox.js";
import { fileId, writePending } from "../filing.js";
import { lateCheckAt, localSource } from "../late-wait.js";

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
