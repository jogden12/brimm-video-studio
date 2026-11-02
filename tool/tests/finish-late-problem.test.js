// A late check that fails after she has been told she can go on is not silent (finish.js, finish-check.js). The finish posts a notice on
// this Mac, through the notice the import and the reading post theirs by, and leaves a note on this Mac's disk, which the guide tells
// until a later finish ends well. Only a failure at the late check counts: a finish that failed before its hand-off was written said so
// while she waited for it. The world is exports-world.js's, with stand-ins for ffprobe, ffmpeg, the transcriber and open; the notice is a
// stand-in too, so that no test posts one.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { problemFlagged } from "../finish-check.js";
import { FOLDER, reread } from "./episodes.js";
import { exportOf, fw } from "./exports-world.js";

const NONCE = "the nonce of the run's lock";
const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const NOTICE = 'The check of Pricing: what to charge?\'s copies in Dropbox found a problem: say "how far is it?"';
const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
/** Have `then` run once, while the finish waits for its late check, 15 minutes after its last copy. */
function whileLate(t, then) {
  const wait = t.ctx.deps.wait;
  let done = false;
  t.ctx.deps.wait = async (waited) => {
    if (waited === LATE_CHECK_MS && !done) {
      done = true;
      await then();
    }
    return wait(waited);
  };
}
/** A raw video finished from HyperFrames: both exports are in Downloads, and finish has been asked with a yes. */
async function hyperframes() {
  const w = fw();
  exportOf(w, "main");
  exportOf(w, "reel 2");
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  return { w, found: { ...w.found, record: reread(w.found) } };
}
/** The other Mac writes the episode again while the finish waits: the record no longer holds the finish. */
const changedMeanwhile = (w, found) => () => {
  const now = reread(found);
  writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, finished: null }));
};

describe("a late check that fails after the hand-off was written", () => {
  it("posts a notice on this Mac that says what to say to see why, and leaves the note the guide tells", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text), lateCheck: () => ["a copy in final/ is not whole"] });
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), ["a copy in final/ is not whole"]);
    assert.deepEqual(notices, [NOTICE]);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    w.t.done();
  });
  it("does so too when the record no longer holds the finish, as when the other Mac changed it while the run waited", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    whileLate(w.t, changedMeanwhile(w, found));
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text) });
    assert.equal(result.ok, false);
    assert.deepEqual(notices, [NOTICE]);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    w.t.done();
  });
  it("does so too when the run stopped while it waited", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (waited) => {
      if (waited === LATE_CHECK_MS) throw new Error("the Mac stopped waiting");
      return wait(waited);
    };
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text) });
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), ["The finish stopped: the Mac stopped waiting"]);
    assert.deepEqual(notices, [NOTICE]);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    w.t.done();
  });
  it("posts it once, when the finish is run as the command line runs it, through the notice the Mac's other runs post theirs by", async () => {
    const { w } = await hyperframes();
    whileLate(w.t, changedMeanwhile(w, w.found));
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 1);
    assert.deepEqual(w.t.notices, [NOTICE]);
    w.t.done();
  });
  it("is not posted for a copy that was put back: the late check puts back what Dropbox took away, and the finish ends well", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    whileLate(w.t, () => rmSync(join(found.folder, "final", HANDOFF)));
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(notices, []);
    assert.equal(problemFlagged(w.t.home, FOLDER), false);
    w.t.done();
  });
});

describe("a finish that failed before its hand-off was written", () => {
  it("posts no notice and leaves no note: it said so while she waited", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    // The episode changed since finish was asked: nothing is copied.
    writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1 }));
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text) });
    assert.equal(result.ok, false);
    assert.deepEqual(notices, []);
    assert.equal(problemFlagged(w.t.home, FOLDER), false);
    w.t.done();
  });
  it("posts no notice and leaves no note when the record was not written, though the files were copied", async () => {
    const { w, found } = await hyperframes();
    const notices = [];
    const clone = w.t.ctx.deps.clone;
    let wrote = false;
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!wrote && to.endsWith(".brimm-ops.json")) {
        wrote = true;
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, name: { text: "Changed meanwhile", placeholder: false } }));
      }
    };
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: (text) => notices.push(text) });
    assert.equal(result.ok, false);
    assert.match(reasons(result).join(" "), /the record was not written/);
    assert.deepEqual(notices, []);
    assert.equal(problemFlagged(w.t.home, FOLDER), false);
    w.t.done();
  });
});

describe("the note of a late check that found a problem", () => {
  /** A finish whose late check found a problem: its note is there, and its exports are still in Downloads. */
  async function failed() {
    const { w, found } = await hyperframes();
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, notify: () => {}, lateCheck: () => ["a copy in final/ is not whole"] });
    assert.equal(result.ok, false);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    return { w, found };
  }
  it("stays until a later finish ends well, and is taken away then", async () => {
    const { w, found } = await failed();
    assert.equal(await finishEpisode(w.t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) }, { nonce: NONCE, notify: () => {} });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(problemFlagged(w.t.home, FOLDER), false);
    w.t.done();
  });
  it("stays through a later finish that fails before its hand-off is written, which has not put right what the check found", async () => {
    const { w, found } = await failed();
    // Not asked again, the finish finds that the episode changed since it was asked: the first finish's own record is a later one.
    const result = await finishNow(w.t.ctx, { ...found, record: found.record }, { nonce: NONCE, notify: () => {} });
    assert.equal(result.ok, false);
    assert.match(reasons(result).join(" "), /The episode changed since finish was asked/);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    w.t.done();
  });
  it("is made again by a later finish whose late check finds a problem too", async () => {
    const { w, found } = await failed();
    const notices = [];
    assert.equal(await finishEpisode(w.t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) }, { nonce: NONCE, notify: (text) => notices.push(text), lateCheck: () => ["a copy in final/ is not whole"] });
    assert.equal(result.ok, false);
    assert.deepEqual(notices, [NOTICE]);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    w.t.done();
  });
});
