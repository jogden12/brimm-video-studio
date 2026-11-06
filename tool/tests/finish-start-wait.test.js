// The start of a finish she has said yes to: `finish … --yes` returns once the detached run it started holds the episode's lock, or says
// plainly that it did not start, so that the `guide … tell` her Claude runs next finds the finish at work and not the step from before it;
// and `tell` says that a finish ended without a hand-off, when it ended before `tell` looked (finish.js, finish-check.js, guide.js told).
// The process the command starts is a stand-in that takes the lock, or writes a result, after a time on the Mac's clock, or does
// nothing: the clock moves only when the work waits (episodes.js). The worlds are exports-world.js's (a raw video finished from
// HyperFrames' exports) and reels-world.js's (the Reels of a finished video), with stand-ins for ffprobe, ffmpeg, the transcriber and
// open: nothing here touches the real Downloads folder, Dropbox or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { HELP, editMain, finishEpisode } from "../edit.js";
import { lockOf, resultFile, takeEpisodeLock } from "../detached.js";
import { recordFile, recordText } from "../episode.js";
import { FOLDER, reread } from "./episodes.js";
import { exportOf, fw } from "./exports-world.js";
import { finishedWorld } from "./reels-world.js";
import { NAMED, THIS_PROCESS, exported, on, seeing } from "./checking-world.js";

const NOT_STARTED = 'The finish did not start: nothing is running for this episode after 5 seconds. Say "how far is it?" to see, and say "hand it off" again if nothing is.';
const STOPPED = 'The finish stopped as soon as it started, and wrote no hand-off. Say "how far is it?" to see why.';
const FAILED = `${NAMED}: Its finish did not write a hand-off. Say "how far is it?" to see why.`;
const OLD_STEP = `${NAMED}: You have exported it. Say "hand it off" and I will check what you exported.`;
const REELS_STEP = `${NAMED}: You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.`;
const TAKEN = 'On the BRIMM Ops page: Drag the hand-off onto Episodes. If the page says it is a new episode, press "Add the episode and take the hand-off". If it opens an episode, press "Take the hand-off". If the page already holds an older revision, press "Take revision N in place of revision M", with the numbers it shows.';
const ONLINE = ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".';

/** A raw video with a project for the main video alone, its export in Downloads. */
function mainOnly() {
  const w = fw({ projects: ["main"] });
  exportOf(w, "main");
  return w;
}
/** A result a finish run leaves, as runDetached writes it. */
const resultOf = (w, over) => JSON.stringify({ version: 1, command: "finish", started: w.t.now(), ended: w.t.now(), ok: true, made: [], failed: [], next: "", ...over });

describe("finish … --yes, until the run it started holds the episode's lock", () => {
  /** Stand in for the process `finish` starts: `then` is done `after` milliseconds of the Mac's clock after it was started, and with
      no `then` the process never begins. The command waits the five seconds of its own, as it does on a Mac, and this process is the
      run that is at work when a lock is held. */
  function starting(w, { after = 300, then = null } = {}) {
    delete w.t.ctx.deps.startWaitMs;
    w.t.ctx.alive = THIS_PROCESS;
    let at = null;
    let done = false;
    w.t.ctx.start = () => {
      at = w.t.now();
    };
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (then && at !== null && !done && w.t.now() - at >= after) {
        done = true;
        then();
      }
    };
  }
  const takes = (w) => () => takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => false);
  /** The looks the command took at the lock, a tenth of a second apart. */
  const looks = (w) => w.t.waits.filter((ms) => ms === 100).length;

  it("returns as soon as the run holds the lock, and then says when the hand-off will be ready", async () => {
    const w = mainOnly();
    starting(w, { after: 300, then: takes(w) });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal(looks(w), 3);
    assert.match(w.t.said().split("\n").at(-1), /^Started\. /);
    w.t.done();
  });
  it("says plainly that it did not start, after five seconds of looking, when nothing holds the lock, and does not say it started", async () => {
    const w = mainOnly();
    starting(w);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.equal(looks(w), 50);
    assert.equal(w.t.said().split("\n").at(-1), NOT_STARTED);
    assert.doesNotMatch(w.t.said(), /Started\./);
    w.t.done();
  });
  it("says so in the words of the Reels for the Reels of a finished video", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    starting(w);
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 1);
    assert.equal(w.t.said().split("\n").at(-1), NOT_STARTED.replace('"hand it off"', '"hand off the Reels"'));
    w.t.done();
  });
  it("says it stopped as soon as it started when the run began and ended before the first look, with no hand-off", async () => {
    const w = mainOnly();
    starting(w, { after: 200, then: () => writeFileSync(resultFile(w.t.home, FOLDER, "finish"), resultOf(w, { ok: false, failed: ["The episode changed since finish was asked."] })) });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.equal(looks(w), 2);
    assert.equal(w.t.said().split("\n").at(-1), STOPPED);
    assert.doesNotMatch(w.t.said(), /Started\./);
    w.t.done();
  });
  it("takes the result of an older run for no run of this yes: it still waits, and says it did not start", async () => {
    const w = mainOnly();
    writeFileSync(resultFile(w.t.home, FOLDER, "finish"), resultOf(w, { started: w.t.now() - 3600000, ended: w.t.now() - 3500000, ok: false, failed: ["Nothing says what to finish: say finish first."] }));
    starting(w);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.equal(looks(w), 50);
    assert.equal(w.t.said().split("\n").at(-1), NOT_STARTED);
    w.t.done();
  });
  it("looks at nothing when the world gives it no time to wait, as every other test does", async () => {
    const w = mainOnly();
    assert.equal(w.t.ctx.deps.startWaitMs, 0);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal(looks(w), 0);
    w.t.done();
  });
});

describe("the help, on the start of a finish", () => {
  it("says that --yes says when the hand-off will be ready, and returns once the run has begun, at most five seconds, and says so if none does", () => {
    const finish = HELP.slice(HELP.indexOf('node edit.js finish "<episode>" [--yes]'), HELP.indexOf('node edit.js finish "<episode>" reels'));
    const flat = finish.replace(/\n {40}/g, " ");
    assert.ok(flat.includes("It says when the hand-off will be ready, and returns once the run has begun (at most five seconds; it says so if none does)"), flat);
    const reels = HELP.slice(HELP.indexOf('node edit.js finish "<episode>" reels'), HELP.indexOf('node edit.js show "<episode>"')).replace(/\n {40}/g, " ");
    assert.ok(reels.includes("It says when the hand-off will be ready, and returns once the run has begun (at most five seconds; it says so if none does)"), reels);
  });
});

describe("`guide … tell` after a finish she said yes to has ended without a hand-off", () => {
  /** The finish stopped as soon as it started: the episode changed since it was asked, so it copies nothing. Run as the command line runs it. */
  async function failedAtOnce(w) {
    const now = reread(w.found);
    writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1 }));
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 1);
  }
  it("says so at once, where it said the step from before the finish", async () => {
    const w = await exported();
    const before = await on(seeing(w), "guide", "3fa9c1", "tell");
    assert.deepEqual(before.said, [OLD_STEP]);
    await failedAtOnce(w);
    const told = await on(seeing(w), "guide", "3fa9c1", "tell");
    assert.deepEqual([told.code, told.said], [0, [FAILED]]);
    // `status` is where the reasons are, as the line says.
    assert.match((await on(seeing(w), "status")).text, /Not done: The episode changed since finish was asked/);
    w.t.done();
  });
  it("says so for the Reels of a finished video, where it said the Reels to hand off", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    // The hand-off it has was written a minute before she said yes to the Reels.
    await w.t.ctx.deps.wait(60000);
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [REELS_STEP]);
    await failedAtOnce(w);
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [FAILED]);
    w.t.done();
  });
  it("says the step, as before, when the failure is of an earlier yes, not of the last", async () => {
    const w = await exported();
    // A failed run from two hours before she said yes.
    writeFileSync(resultFile(w.t.home, FOLDER, "finish"), resultOf(w, { started: w.t.now() - 7200000, ended: w.t.now() - 7190000, ok: false, failed: ["Nothing says what to finish: say finish first."] }));
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [OLD_STEP]);
    w.t.done();
  });
  it("says the step, as before, when the run before it ended well, or when no run has ended since the yes", async () => {
    const w = await exported();
    writeFileSync(resultFile(w.t.home, FOLDER, "finish"), resultOf(w, { started: Date.now(), ended: Date.now() }));
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [OLD_STEP]);
    const none = await exported();
    assert.deepEqual((await on(seeing(none), "guide", "3fa9c1", "tell")).said, [OLD_STEP]);
    w.t.done();
    none.t.done();
  });
  it("does not say it of a finish that wrote its hand-off and failed at the late check: the step is the page's, and the problem leads it", async () => {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    // The result says the run did not end well: the hand-off it wrote is on file all the same.
    writeFileSync(resultFile(w.t.home, FOLDER, "finish"), resultOf(w, { started: Date.now(), ended: Date.now(), ok: false, failed: ["a copy in final/ is not whole"] }));
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [`${NAMED}: ${TAKEN}${ONLINE}`]);
    w.t.done();
  });
});
