// A finish that has written its record and shown its hand-off tells the rest of the tool that it has reached its late check (finish.js,
// finish-check.js): it leaves a marker on this Mac's own disk, and the panel's last step says she can go on. The marker is there only
// from the moment the record is written until the run ends, however it ends. The made-up worlds are exports-world.js's (a raw video
// finished from HyperFrames' exports) and episodes.js's (the Final Cut way), with stand-ins for ffprobe, ffmpeg, the transcriber and
// open: nothing here touches the real Downloads folder, Dropbox, BRIMM Video Work or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { CHECKING_FILE } from "../finish-check.js";
import { lockOf } from "../detached.js";
import { episodeWork } from "../settings.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { exportOf, fw } from "./exports-world.js";

const NONCE = "the nonce of the run's lock";
const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
/** The marker, as it is on this Mac's disk now, or null when there is none. */
const markerOf = (home) => (existsSync(join(episodeWork(home, FOLDER), CHECKING_FILE)) ? JSON.parse(readFileSync(join(episodeWork(home, FOLDER), CHECKING_FILE), "utf8")) : null);
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
/** The made-up edit finished the Final Cut way: each part Shared and exported into From Final Cut, finish asked with a yes. */
async function finalCut() {
  const t = setup();
  const found = episodeFor(t, { record: EDITED });
  t.shared(`${PROJECT.main}.mp4`, 2000);
  t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
  t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
  assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0, t.said());
  return { t, found: { ...found, record: reread(found) } };
}
/** A progress reporter that writes down each step with how it was shown, and how the video ended. */
function panel() {
  const seen = { steps: [], ended: [] };
  return { seen, begin() {}, length() {}, steps() {}, step: (name, shown) => seen.steps.push([name, shown]), fraction() {}, encoding: () => ({ args: [], stop() {} }), end: (finished) => seen.ended.push(finished) };
}

describe("the marker of a finish that waits for its late check", () => {
  it("is left after the record is written and the hand-off shown, before the wait: the run's nonce, the hand-off's revision, when the check is due, and where the originals are", async () => {
    const { w, found } = await hyperframes();
    let during = null;
    whileLate(w.t, () => {
      during = {
        marker: markerOf(w.t.home), revision: reread(found).finished.revision, handoff: existsSync(join(found.folder, "final", HANDOFF)),
        shown: w.t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args), now: w.t.now()
      };
    });
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(during.marker, { version: 1, nonce: NONCE, revision: 1, due: during.now + LATE_CHECK_MS, took: ["Downloads"] });
    assert.deepEqual([during.revision, during.handoff, during.shown], [1, true, [["-R", join(found.folder, "final", HANDOFF)]]], "the record holds the finish, and the hand-off is in final/ and shown");
    w.t.done();
  });
  it("names the place the originals were taken from: From Final Cut for a Final Cut finish", async () => {
    const { t, found } = await finalCut();
    let during = null;
    whileLate(t, () => {
      during = markerOf(t.home);
    });
    const result = await finishNow(t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([during.revision, during.took], [1, ["From Final Cut"]]);
    t.done();
  });
  it("names both places when the main video is from Final Cut and a Reel from HyperFrames' export", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = fw({ projects: ["reel 2"], over: { main: { ...EDITED.main, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    let during = null;
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) }, { nonce: NONCE });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(during.took, ["Downloads", "From Final Cut"]);
    w.t.done();
  });
  it("names no place when the finish took no original away, as a second finish with no new export, which keeps every part", async () => {
    const { w, found } = await hyperframes();
    assert.equal((await finishNow(w.t.ctx, found, { nonce: NONCE })).ok, true);
    assert.equal(await finishEpisode(w.t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
    let during = null;
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) }, { nonce: NONCE });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([during.revision, during.took], [2, []]);
    w.t.done();
  });
  it("is left with no nonce when the run was not given one, as a test that calls the finish itself gives none, and such a marker is never believed", async () => {
    const { w, found } = await hyperframes();
    let during = null;
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    await finishNow(w.t.ctx, found);
    assert.equal(during.nonce, "");
    w.t.done();
  });
  it("is the lock's own nonce when the finish is run as the command line runs it, holding the episode's lock", async () => {
    const { w } = await hyperframes();
    let during = null;
    whileLate(w.t, () => {
      during = { marker: markerOf(w.t.home), lock: JSON.parse(readFileSync(lockOf(w.t.home, FOLDER), "utf8")) };
    });
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.equal(typeof during.lock.nonce, "string");
    assert.notEqual(during.lock.nonce, "");
    assert.equal(during.marker.nonce, during.lock.nonce);
    assert.deepEqual([during.lock.command, during.lock.pid], ["finish", process.pid]);
    assert.equal(markerOf(w.t.home), null, "and it is gone once the run has ended");
    w.t.done();
  });
});

describe("the marker is not left when the record was not written", () => {
  it("is none while the run waits for its late check, and the panel does not say she can go on", async () => {
    const { w, found } = await hyperframes();
    const clone = w.t.ctx.deps.clone;
    let wrote = false;
    // The other Mac writes the episode again just as the hand-off is copied in: the record of this finish cannot be written over it.
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!wrote && to.endsWith(".brimm-ops.json")) {
        wrote = true;
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, name: { text: "Changed meanwhile", placeholder: false } }));
      }
    };
    let during = "not looked";
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    const progress = panel();
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, progress });
    assert.equal(result.ok, false);
    assert.match(reasons(result).join(" "), /the record was not written/);
    assert.equal(during, null);
    assert.deepEqual(progress.seen.steps.at(-1), ["Checking the copies", undefined]);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
  it("is none when the finish fails before it copies anything", async () => {
    const { w, found } = await hyperframes();
    writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1 }));
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, false);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
});

describe("the marker is taken away when the run ends, however it ends", () => {
  it("after a finish that ended well", async () => {
    const { w, found } = await hyperframes();
    let during = null;
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.notEqual(during, null);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
  it("after a late check that found a problem", async () => {
    const { w, found } = await hyperframes();
    let during = null;
    whileLate(w.t, () => {
      during = markerOf(w.t.home);
    });
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, lateCheck: () => ["a copy in final/ is not whole"] });
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), ["a copy in final/ is not whole"]);
    assert.notEqual(during, null);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
  it("after the record no longer holds the finish, as when the other Mac changed it while the run waited", async () => {
    const { w, found } = await hyperframes();
    whileLate(w.t, () => {
      const now = reread(found);
      writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, finished: null }));
    });
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, false);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
  it("after the run threw while it waited", async () => {
    const { w, found } = await hyperframes();
    const wait = w.t.ctx.deps.wait;
    let during = null;
    w.t.ctx.deps.wait = async (waited) => {
      if (waited === LATE_CHECK_MS) {
        during = markerOf(w.t.home);
        throw new Error("the Mac stopped waiting");
      }
      return wait(waited);
    };
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE });
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), ["The finish stopped: the Mac stopped waiting"]);
    assert.notEqual(during, null);
    assert.equal(markerOf(w.t.home), null);
    w.t.done();
  });
});

describe("the panel's last step, once she can go on", () => {
  it("says so, and is still the step Checking the copies, which the steps and the rates go by", async () => {
    const { w, found } = await hyperframes();
    const progress = panel();
    const result = await finishNow(w.t.ctx, found, { nonce: NONCE, progress });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(progress.seen.steps.at(-1), ["Checking the copies", "Checking the copies (you can go on)"]);
    // Every step before it is begun by its name alone, as it was.
    assert.deepEqual(progress.seen.steps.slice(0, -1).map(([, shown]) => shown), Array(progress.seen.steps.length - 1).fill(undefined));
    assert.deepEqual(progress.seen.steps.map(([name]) => name), ["Waiting for HyperFrames' exports", "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode", "Checking the copies"]);
    assert.deepEqual(progress.seen.ended, [true]);
    w.t.done();
  });
});
