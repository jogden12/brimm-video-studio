// How long a finish takes until its hand-off is ready (finish-time.js): the lengths of the videos it takes, from the record, the speed
// this Mac measured of the last ones, and the measuring of a new one. None of it needs a program or Dropbox; the rates are in a
// home folder of the test's own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RATES, aboutLeft, progressFolder, readRates } from "../progress.js";
import { HANDOFF_STEP, handoffIn, videoSeconds, measured } from "../finish-time.js";

const RECORD = { video: { seconds: 600 }, reels: [{ n: 1, from: 100, to: 130 }, { n: 2, from: 200, to: 290 }, { n: 3, from: 0, to: 0 }, { n: 4 }] };
const part = (key, over = {}) => ({ key, ...(key.startsWith("reel ") ? { reel: Number(key.slice(5)) } : {}), kept: false, ...over });

describe("the lengths of the videos a finish takes", () => {
  it("are the recording's for the main video and a Reel's stretch of it for a Reel, of each part it takes now", () => {
    assert.equal(videoSeconds(RECORD, [part("main")]), 600);
    assert.equal(videoSeconds(RECORD, [part("reel 2")]), 90);
    assert.equal(videoSeconds(RECORD, [part("main"), part("reel 1"), part("reel 2")]), 720);
  });
  it("leave out a part the last finish made and this one keeps, and one whose length the record does not give", () => {
    assert.equal(videoSeconds(RECORD, [part("main", { kept: true }), part("reel 1")]), 30);
    assert.equal(videoSeconds(RECORD, [part("reel 3"), part("reel 4"), part("reel 9")]), 0);
    assert.equal(videoSeconds({ reels: [] }, [part("main")]), 0);
    assert.equal(videoSeconds({ video: { seconds: "long" } }, [part("main")]), 0);
    assert.equal(videoSeconds({ video: { seconds: -4 } }, [part("main")]), 0);
    assert.equal(videoSeconds(RECORD, []), 0);
  });
});

describe("how long a finish takes until its hand-off is ready, from what this Mac measured", () => {
  it("is the speed for each second of video times the seconds of video, rounded", () => {
    assert.equal(handoffIn({ [HANDOFF_STEP]: 0.4 }, 600), 240);
    assert.equal(handoffIn({ [HANDOFF_STEP]: 0.0999 }, 2400), 240);
    assert.equal(handoffIn({ [HANDOFF_STEP]: 0.4, "Asking Claude": 0.31 }, 30), 12);
  });
  it("is none while the speed or the length is not known, or comes to less than a second", () => {
    for (const [rates, length] of [[{}, 600], [{ [HANDOFF_STEP]: 0.4 }, 0], [{ [HANDOFF_STEP]: 0.4 }, -5], [{ [HANDOFF_STEP]: 0.4 }, undefined], [{ [HANDOFF_STEP]: 0 }, 600], [{ [HANDOFF_STEP]: "fast" }, 600], [{ [HANDOFF_STEP]: null }, 600], [{ "Asking Claude": 0.31 }, 600], [{ [HANDOFF_STEP]: 0.001 }, 100]]) {
      assert.equal(handoffIn(rates, length), null, JSON.stringify([rates, length]));
    }
  });
});

describe("the measuring of a finish's hand-off", () => {
  function home() {
    const dir = mkdtempSync(join(tmpdir(), "brimm-finish-time-"));
    return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  it("keeps the seconds it took for each second of video among the panel's rates, on this Mac's own disk, under its own name", () => {
    const t = home();
    assert.equal(HANDOFF_STEP, "Making the hand-off");
    assert.equal(measured(t.dir, 240000, 600), true);
    assert.deepEqual(readRates(progressFolder(t.dir)), { [HANDOFF_STEP]: 0.4 });
    assert.equal(RATES, "rates.json");
    t.done();
  });
  it("blends with the speed measured before, the new counting for half, and leaves the speeds of the panel's steps as they are", () => {
    const t = home();
    measured(t.dir, 60000, 600);
    measured(t.dir, 180000, 600);
    assert.deepEqual(readRates(progressFolder(t.dir)), { [HANDOFF_STEP]: 0.2 });
    t.done();
  });
  it("measures nothing for no length, or no time", () => {
    const t = home();
    for (const [ms, length] of [[1000, 0], [0, 600], [-5, 600], [Number.NaN, 600], [1000, Number.NaN]]) assert.equal(measured(t.dir, ms, length), false, `${ms} ${length}`);
    assert.deepEqual(readRates(progressFolder(t.dir)), {});
    t.done();
  });
});

describe("one slow run does not make the speed run away", () => {
  function home() {
    const dir = mkdtempSync(join(tmpdir(), "brimm-finish-time-"));
    return { dir, rates: () => readRates(progressFolder(dir)), done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  it("counts a hand-off that took longer than the video is long as taking that long: a 25-second Reel that took 185 seconds is 1 for each second, not 7.4", () => {
    const t = home();
    assert.equal(measured(t.dir, 185000, 25), true);
    assert.deepEqual(t.rates(), { [HANDOFF_STEP]: 1 });
    // The next recording, half an hour long, is told as the video is long: not in hours (7.4 would say "about 3 hours 42 minutes").
    assert.equal(aboutLeft(handoffIn(t.rates(), 1800)), "about 30 minutes");
    t.done();
  });
  it("keeps a speed at the video's length or below as it was measured, and blends it as before", () => {
    const t = home();
    assert.equal(measured(t.dir, 25000, 25), true);
    assert.deepEqual(t.rates(), { [HANDOFF_STEP]: 1 });
    assert.equal(measured(t.dir, 5000, 25), true);
    assert.deepEqual(t.rates(), { [HANDOFF_STEP]: 0.6 });
    t.done();
  });
  it("is back near the truth after five clean runs of 0.2 following a slow first one: about 7 minutes for half an hour, where the slow run's own 7.4 would still say about 13", () => {
    const t = home();
    measured(t.dir, 185000, 25);
    for (let run = 0; run < 5; run++) measured(t.dir, 5000, 25);
    assert.equal(aboutLeft(handoffIn(t.rates(), 1800)), "about 7 minutes");
    t.done();
  });
  it("counts a slow run after a good history as one at the most: 0.2 and a slow 7.4 make 0.6, not 3.8", () => {
    const t = home();
    measured(t.dir, 5000, 25);
    measured(t.dir, 185000, 25);
    assert.deepEqual(t.rates(), { [HANDOFF_STEP]: 0.6 });
    t.done();
  });
});
