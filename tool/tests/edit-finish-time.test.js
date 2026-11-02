// What `finish` says when it starts the detached part: when the hand-off will be ready, as a clock time and in minutes, from what this Mac
// measured of the finishes before, and that she can carry on meanwhile (finish-time.js; Jason, 2 November 2026). The finish measures its
// own hand-off when it is written. The worlds are exports-world.js's (a raw video finished from HyperFrames' exports) and reels-world.js's
// (the Reels of a finished video), with stand-ins for ffprobe, ffmpeg, the transcriber and open: nothing here touches the real Downloads
// folder, Dropbox or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { addRates, progressFolder, readRates } from "../progress.js";
import { HANDOFF_STEP } from "../finish-time.js";
import { clockAt } from "../unedited.js";
import { FOLDER, reread } from "./episodes.js";
import { exportOf, fw } from "./exports-world.js";
import { finishedWorld } from "./reels-world.js";

/** The line `finish` says when it has no time to give. */
const UNTIMED = "Started. This Mac has not timed a hand-off yet, so there is no time to give. You can carry on meanwhile; the panel shows how far it is.";
/** The recording of the made-up episode is 23.423 seconds long: the length of its main video, for the rate. */
const SECONDS = 23.423;
const timed = (w, seconds, minutes) => `Started. The hand-off is ready about ${clockAt(w.t.now() + seconds * 1000)}, in ${minutes}. You can carry on meanwhile.`;
/** A raw video with a project for the main video alone, its export in Downloads. */
function mainOnly() {
  const w = fw({ projects: ["main"] });
  exportOf(w, "main");
  return w;
}
/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

describe("what finish says when it starts", () => {
  it("says when the hand-off will be ready, as a clock time and in minutes, from the speed this Mac measured, and that she can carry on", async () => {
    const w = mainOnly();
    addRates(progressFolder(w.t.home), { [HANDOFF_STEP]: 10 });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    // 10 seconds for each second of the recording of 23.423 seconds: 234 seconds, about 4 minutes.
    assert.equal(w.t.said().split("\n").at(-1), timed(w, 234, "about 4 minutes"));
    w.t.done();
  });
  it("says a few seconds, a half hour, and hours as the panel says how long is left", async () => {
    for (const [rate, seconds, minutes] of [[0.5, 12, "less than a minute"], [1, 23, "less than a minute"], [80, 1874, "about 31 minutes"], [160, 3748, "about 1 hour 2 minutes"]]) {
      const w = mainOnly();
      addRates(progressFolder(w.t.home), { [HANDOFF_STEP]: rate });
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
      assert.equal(w.t.said().split("\n").at(-1), timed(w, seconds, minutes), String(rate));
      w.t.done();
    }
  });
  it("says there is no time to give while this Mac has measured no hand-off, and names no time it cannot back", async () => {
    const w = mainOnly();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal(w.t.said().split("\n").at(-1), UNTIMED);
    assert.doesNotMatch(w.t.said().split("\n").at(-1), /\d:\d\d|minute/);
    // The speeds of the panel's steps are not a speed for a hand-off.
    const other = mainOnly();
    addRates(progressFolder(other.t.home), { "Writing the transcripts": 0.3, "Asking Claude": 0.31 });
    assert.equal(await finishEpisode(other.t.ctx, other.found, { yes: true }), 0, other.t.said());
    assert.equal(other.t.said().split("\n").at(-1), UNTIMED);
    w.t.done();
    other.t.done();
  });
  it("is said with `--no-on-screen` and with the words she gave, which start it the same", async () => {
    const w = mainOnly();
    addRates(progressFolder(w.t.home), { [HANDOFF_STEP]: 10 });
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes", "--no-on-screen");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said.at(-1), timed(w, 234, "about 4 minutes"));
    w.t.done();
  });
  it("counts only the Reels it takes now, for the Reels of a finished video", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    // Reel 2 is 7.7 seconds of the recording (the stretch of suggestion 2), the main video's 23.423 not counted.
    addRates(progressFolder(w.t.home), { [HANDOFF_STEP]: 10 });
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "reels", "--yes");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said.at(-1), timed(w, 77, "about 1 minute"));
    w.t.done();
  });
});

describe("what a finish measures of its own hand-off", () => {
  it("is the seconds it took to write and show it for each second of the recording, kept among the panel's rates", async () => {
    const w = mainOnly();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    // The only waiting before the hand-off is the one look at the export, five seconds.
    assert.deepEqual(readRates(progressFolder(w.t.home)), { [HANDOFF_STEP]: 5 / SECONDS });
    w.t.done();
  });
  it("is measured again by the next finish, which blends it with the first, and is then said at the start of one", async () => {
    const w = mainOnly();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal((await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) })).ok, true);
    exportOf(w, "main", { start: [14, 30, 0] });
    const again = { ...w.found, record: reread(w.found) };
    // The first call shows the words on the picture again for the new export, and her yes to them starts the finish.
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(w.t.said().split("\n").at(-1), timed(w, 5, "less than a minute"));
    w.t.done();
  });
  it("is not measured by a finish that does not write its hand-off", async () => {
    const w = mainOnly();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    // The episode changed since finish was asked: nothing is copied.
    const now = reread(w.found);
    writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1 }));
    const result = await finishNow(w.t.ctx, { ...w.found, record: now });
    assert.equal(result.ok, false);
    assert.deepEqual(readRates(progressFolder(w.t.home)), {});
    w.t.done();
  });
  it("is not measured for a finish that took no video now: it has no seconds of video to count", async () => {
    const w = mainOnly();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal((await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) })).ok, true);
    const before = readRates(progressFolder(w.t.home));
    // The second finish finds no newer export: every part is kept as the last one made it.
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
    assert.equal(w.t.said().split("\n").at(-1), UNTIMED);
    assert.equal((await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) })).ok, true);
    assert.deepEqual(readRates(progressFolder(w.t.home)), before);
    w.t.done();
  });
});
