// The guide while a finish waits for its late check (finish.js, finish-check.js): the BRIMM Ops page does not wait for the check. The
// finish is run as the command line runs it, holding the episode's lock, and the guide is asked while it waits; the lock is this
// process's, so the guide is told that this process is the finish run at work. The worlds are guide-world.js's (exports-world.js's
// episode, read by Claude and its spellings answered), reels-world.js's for the Reels of a finished video, and episodes.js's for the
// Final Cut way, with stand-ins for ffprobe, ffmpeg, the transcriber and open: nothing here touches the real home, Downloads,
// Dropbox or a program. The guide writes nothing, but her note when she says she has done a step.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { CHECKING_FILE, markChecking } from "../finish-check.js";
import { OPS_PAGE } from "../guide.js";
import { episodeWork } from "../settings.js";
import { clockAt } from "../unedited.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { ANSWERED, exportOf } from "./exports-world.js";
import { OFFERS, READ } from "./guide-world.js";
import { finishedWorld } from "./reels-world.js";
import { HANDOFF, NAMED, atWait, check, exported, on, seeing, whileChecking } from "./checking-world.js";

const TAKEN = 'On the BRIMM Ops page: Drag the hand-off onto Episodes. If the page offers "Add it as a new episode", press it, then "Add the episode". Then press "Take the hand-off".';
const ONLINE = ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".';
const KIT = 'Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.';
const POSTED = 'Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".';
const POST_TEXT = 'Press "Write what’s next", and pick the hook and the YouTube Short title. Approve and copy the caption, the Short\'s title and description, and the LinkedIn post.';
const FINISH_RUNNING = "Its finish is running. The panel shows how far it is.";
const DROP = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
/** What the guide says of a Reel exported while the finish of the Reels before it waits for its late check at `due`: to hand it off after. */
const REEL_AFTER = (n, due) => `You have exported Reel ${n} from HyperFrames. Say "hand off the Reels" after ${clockAt(due)} to add it to the hand-off.`;

describe("the guide while a raw video's finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step, and after its lines the line of when Studio checks Dropbox's copies and then takes the export out of Downloads", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
  it("lists the video among those under way with the BRIMM Ops page's step, and the line under it", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { all: ["guide"] });
    assert.deepEqual(heard.all.said, [
      "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio", "Under way:", `  ${NAMED}: ${TAKEN}${ONLINE}`, `    ${check(heard.due)}`
    ]);
    w.t.done();
  });
  it("shows the hand-off in Finder, and opens the BRIMM Ops page, as at any other time", async () => {
    const w = await exported();
    const before = w.t.calls.filter((c) => c.cmd === "/usr/bin/open").length;
    const heard = await whileChecking(w, { show: ["guide", "3fa9c1", "show"], page: ["guide", "page"] });
    assert.deepEqual([heard.show.code, heard.show.said], [0, [`Shown in Finder: the hand-off of ${NAMED}.`]]);
    assert.deepEqual([heard.page.code, heard.page.said], [0, ["Opened the BRIMM Ops page in your browser."]]);
    // The finish showed the hand-off itself (the first call), then `show` did, then `page` opened the page.
    const opened = w.t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args);
    assert.deepEqual(opened.slice(before), [["-R", join(w.found.folder, "final", HANDOFF)], ["-R", join(w.found.folder, "final", HANDOFF)], [OPS_PAGE]]);
    w.t.done();
  });
  it("answers `tell` at once with the page's step, and waits for nothing", async () => {
    const w = await exported();
    let waits = 0;
    const heard = await whileChecking(w, { tell: ["guide", "3fa9c1", "tell"] }, { wait: async () => { waits += 1; } });
    assert.deepEqual([heard.tell.code, heard.tell.said], [0, [`${NAMED}: ${TAKEN}${ONLINE}`]]);
    assert.equal(waits, 0);
    w.t.done();
  });
  it("notes the page's steps as she does them, and says the next step each time with the line after it", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { done: ["guide", "3fa9c1", "done", "taken"] });
    assert.deepEqual(heard.done.said, [`Noted: ${NAMED}, taken.`, `${NAMED}: On the BRIMM Ops page: ${KIT}`, `Then: ${POSTED}`, "Step: kit", check(heard.due)]);
    w.t.done();
  });
  it("is the step of a finish that has ended, without the line, once the run is over", async () => {
    const w = await exported();
    await whileChecking(w, {});
    const after = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(after.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"]);
    assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), CHECKING_FILE)), false);
    w.t.done();
  });
  it("says its finish is running while the finish still copies, before it has reached the check", async () => {
    const w = await exported();
    // The first look at an export, which the finish waits five seconds before.
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "guide", "3fa9c1");
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
  it("says its finish is running while a second finish copies, though the first one's hand-off is written, and the page's step again once that one waits for its check", async () => {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    // A newer export of the main video: finish shows its words again for her yes first, and the next yes starts the finish.
    exportOf(w, "main", { start: [14, 30, 0] });
    const again = { ...w.found, record: reread(w.found) };
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "guide", "3fa9c1");
    }, 5000);
    const heard = await whileChecking(w, { second: ["guide", "3fa9c1"] });
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    assert.deepEqual(heard.second.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while an iPhone clip's finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step for a clip, and the line", async () => {
    const w = await exported("short video");
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}`, `Then: ${POST_TEXT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while the Reels of a finished video are handed off, and the finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step for the new revision, and the line", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while the Reels of a finished video are handed off, the finish waits for its late check, and another Reel is exported meanwhile", () => {
  /** The Reels of the finished video: Reel 2 is exported and asked for, so that its finish takes it; Reel 1 is exported later, by `before`. */
  async function reelsAsked() {
    const w = await finishedWorld({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, without: ["reel 1"] }), 0, w.t.said());
    return w;
  }
  it("gives the Reels step to say after the check, and not that its finish is running, and after its lines the line of when Studio checks Dropbox's copies", async () => {
    const w = await reelsAsked();
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] }, {}, () => exportOf(w, "reel 1"));
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${REEL_AFTER(1, heard.due)}`, check(heard.due)]);
    w.t.done();
  });
  it("lists the video among those under way with the Reels step, and the line under it", async () => {
    const w = await reelsAsked();
    const heard = await whileChecking(w, { all: ["guide"] }, {}, () => exportOf(w, "reel 1"));
    assert.deepEqual(heard.all.said, [DROP, "Under way:", `  ${NAMED}: ${REEL_AFTER(1, heard.due)}`, `    ${check(heard.due)}`]);
    w.t.done();
  });
  it("says its finish is running while the Reels finish still copies, though another Reel is exported, and the Reels step once it waits for its check", async () => {
    const w = await reelsAsked();
    let copying = null;
    atWait(w.t, async () => {
      exportOf(w, "reel 1");
      copying = await on(seeing(w), "guide", "3fa9c1");
    }, 5000);
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${REEL_AFTER(1, heard.due)}`, check(heard.due)]);
    w.t.done();
  });
  it("answers `tell` at once with the Reels step, and waits for nothing", async () => {
    const w = await reelsAsked();
    let waits = 0;
    // A tell that waited for a finish at its check would wait for ever on this clock: it is stopped, and fails.
    const wait = async () => {
      waits += 1;
      if (waits > 3) throw new Error("tell is waiting for a finish that only waits for its check");
    };
    const heard = await whileChecking(w, { tell: ["guide", "3fa9c1", "tell"] }, { wait }, () => exportOf(w, "reel 1"));
    assert.deepEqual([heard.tell.code, heard.tell.said], [0, [`${NAMED}: ${REEL_AFTER(1, heard.due)}`]]);
    assert.equal(waits, 0);
    w.t.done();
  });
  it("is the page's step, as it was, where no Reel is exported meanwhile", async () => {
    const w = await reelsAsked();
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while a finish of the Final Cut way waits for its late check", () => {
  it("gives the page's step, and the line names From Final Cut as the place the originals are taken from", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, version: 3, kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS } });
    t.shared(`${PROJECT.main}.mp4`, 2000);
    t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0, t.said());
    const heard = await whileChecking({ t, found }, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said.slice(0, 1), [`${NAMED}: ${TAKEN}${ONLINE}`]);
    assert.equal(heard.next.said.at(-1), check(heard.due, "what it took out of From Final Cut"));
    t.done();
  });
});

describe("the guide after a late check found a problem that she had been told she could go on from", () => {
  const LEAD = 'The check of its copies in Dropbox found a problem. Say "how far is it?" to see what.';
  const STEP = [`${NAMED}: ${LEAD} ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"];
  /** A raw video whose finish wrote its hand-off and then failed at its late check. */
  async function failedCheck() {
    const w = await exported();
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found, { nonce: "a run's nonce", notify: () => {}, lateCheck: () => ["a copy in final/ is not whole"] });
    assert.equal(result.ok, false);
    return w;
  }
  it("leads its answer with the problem and what to say, then gives the step as it did, in the list, for the video and in a line of `tell`", async () => {
    const w = await failedCheck();
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1")).said, STEP);
    assert.deepEqual((await on(seeing(w), "guide")).said.slice(2), [`  ${NAMED}: ${LEAD} ${TAKEN}${ONLINE}`]);
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "tell")).said, [`${NAMED}: ${LEAD} ${TAKEN}${ONLINE}`]);
    w.t.done();
  });
  it("still shows the hand-off in Finder, and notes the steps she does", async () => {
    const w = await failedCheck();
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "show")).said, [`Shown in Finder: the hand-off of ${NAMED}.`]);
    const done = await on(seeing(w), "guide", "3fa9c1", "done", "taken");
    assert.equal(done.said[0], `Noted: ${NAMED}, taken.`);
    assert.ok(done.said[1].startsWith(`${NAMED}: ${LEAD} On the BRIMM Ops page: ${KIT}`), done.said[1]);
    w.t.done();
  });
  it("goes when a later finish ends well, and stays when one fails before its hand-off is written", async () => {
    const w = await failedCheck();
    // Not asked again, the finish finds that the episode changed since it was asked, and writes nothing.
    const early = await finishNow(w.t.ctx, { ...w.found, record: w.found.record }, { nonce: "a run's nonce", notify: () => {} });
    assert.equal(early.ok, false);
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1")).said, STEP);
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
    assert.equal((await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) }, { nonce: "a run's nonce", notify: () => {} })).ok, true);
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1")).said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"]);
    w.t.done();
  });
  it("is not said while a later finish runs: it says its finish is running while it copies, and the step and the check once it waits", async () => {
    const w = await failedCheck();
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken", check(heard.due, "")]);
    w.t.done();
  });
  it("is not said of a video she has said is finished", async () => {
    const w = await failedCheck();
    assert.deepEqual((await on(seeing(w), "guide", "3fa9c1", "finished")).said, [`${NAMED} is no longer under way.`]);
    assert.deepEqual((await on(seeing(w), "guide")).said.slice(1), ["Nothing is under way. To start, put the video in your drop folder."]);
    w.t.done();
  });
  it("is said of an iPhone clip and of a finished video whose Reels were handed off", async () => {
    const clip = await exported("short video");
    assert.equal((await finishNow(clip.t.ctx, { ...clip.found, record: reread(clip.found) }, { nonce: "n", notify: () => {}, lateCheck: () => ["a copy in final/ is not whole"] })).ok, false);
    assert.deepEqual((await on(seeing(clip), "guide", "3fa9c1")).said, [`${NAMED}: ${LEAD} ${TAKEN}`, `Then: ${POST_TEXT}`, "Step: taken"]);
    const reels = await finishedWorld();
    exportOf(reels, "reel 2");
    assert.equal(await finishEpisode(reels.t.ctx, { ...reels.found, record: reread(reels.found) }, { reels: true, yes: true }), 0, reels.t.said());
    assert.equal((await finishNow(reels.t.ctx, { ...reels.found, record: reread(reels.found) }, { nonce: "n", notify: () => {}, lateCheck: () => ["a copy in final/ is not whole"] })).ok, false);
    assert.deepEqual((await on(seeing(reels), "guide", "3fa9c1")).said, [`${NAMED}: ${LEAD} ${TAKEN}`, `Then: ${KIT}`, "Step: taken"]);
    clip.t.done();
    reels.t.done();
  });
});

describe("`guide … tell` for a video whose finish is running", () => {
  const READY = `${NAMED}: Its hand-off is ready. ${TAKEN}${ONLINE}`;
  const FAILED = `${NAMED}: Its finish did not write a hand-off. Say "how far is it?" to see why.`;
  /** A raw video whose first finish has ended (revision 1), and a second finish at work: its lock is held by this process, and it has
      written nothing yet. `took.nonce` is the nonce of that lock. */
  async function secondFinish() {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    return { w, took };
  }
  it("waits while the finish copies, and says its hand-off is ready as soon as the finish has written it: the run is still at its late check", async () => {
    const { w, took } = await secondFinish();
    const waits = [];
    const wait = async (ms) => {
      waits.push(ms);
      // The second look: the finish has written its hand-off, and waits for its late check.
      if (waits.length === 2) markChecking(w.t.home, FOLDER, { nonce: took.nonce, revision: reread(w.found).finished.revision, due: w.t.now() + LATE_CHECK_MS, took: ["Downloads"] });
    };
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual([said.code, said.said, waits], [0, [READY], [15000, 15000]]);
    assert.ok(existsSync(lockOf(w.t.home, FOLDER)), "the finish still holds the lock: it has not made its late check");
    w.t.done();
  });
  it("says its hand-off is ready when the finish ended well while it waited", async () => {
    const { w } = await secondFinish();
    const wait = async () => {
      // The finish is over: the lock goes, and a finish of its own, which keeps both parts, writes the next revision.
      rmSync(lockOf(w.t.home, FOLDER));
      assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
      assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    };
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual(said.said, [READY]);
    assert.equal(reread(w.found).finished.revision, 2);
    w.t.done();
  });
  it("says the finish wrote no hand-off, and what to say to see why, when it ended without one", async () => {
    const { w } = await secondFinish();
    const wait = async () => rmSync(lockOf(w.t.home, FOLDER));
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual([said.code, said.said], [0, [FAILED]]);
    w.t.done();
  });
  it("says it too of a first finish that ended without a hand-off, where the step it leaves is to hand it off again", async () => {
    const w = await exported();
    takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    const wait = async () => rmSync(lockOf(w.t.home, FOLDER));
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual(said.said, [FAILED]);
    w.t.done();
  });
  it("answers at once with the step for a video whose finish is not running, as it did", async () => {
    const w = await exported();
    let waits = 0;
    const said = await on(seeing(w, { wait: async () => { waits += 1; } }), "guide", "3fa9c1", "tell");
    assert.deepEqual([said.said, waits], [[`${NAMED}: You have exported it. Say "hand it off" and I will check what you exported.`], 0]);
    w.t.done();
  });
  it("waits for the finish that hands off the Reels of a finished video too, and says the new revision is ready", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    const wait = async () => {
      rmSync(lockOf(w.t.home, FOLDER));
      assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    };
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    // Revision 2, but she has no note on this hand-off, and her note is the guide's only record of what she took on the page: it is a first take.
    assert.deepEqual(said.said, [`${NAMED}: Its hand-off is ready. ${TAKEN}`]);
    assert.equal(reread(w.found).finished.revision, 2);
    w.t.done();
  });
  it("waits for the finish that hands off the Reels while it copies, and says its hand-off is ready, with the Reels step for a Reel it does not hold, once it only waits for its check", async () => {
    const w = await finishedWorld({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, without: ["reel 1"] }), 0, w.t.said());
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    exportOf(w, "reel 1");
    // A finish at work again, its lock this process's: it has written nothing yet, and Reel 1 is exported and not in the hand-off.
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    const due = w.t.now() + LATE_CHECK_MS;
    const waits = [];
    const wait = async (ms) => {
      waits.push(ms);
      // The second look: the finish has written its hand-off, and waits for its late check.
      if (waits.length === 2) markChecking(w.t.home, FOLDER, { nonce: took.nonce, revision: reread(w.found).finished.revision, due, took: ["Downloads"] });
      // A tell that still waits for a finish that only waits for its check would wait for ever on this clock: it fails instead.
      if (waits.length > 4) throw new Error("tell is waiting for a finish that only waits for its check");
    };
    const said = await on(seeing(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual([said.code, said.said, waits], [0, [`${NAMED}: Its hand-off is ready. ${REEL_AFTER(1, due)}`], [15000, 15000]]);
    w.t.done();
  });
  it("is still on its way after 60 minutes of a finish that has not written its hand-off, and says where to see how far it is", async () => {
    const { w } = await secondFinish();
    let clock = w.t.now();
    const said = await on(seeing(w, { now: () => clock, wait: async (ms) => { clock += ms; } }), "guide", "3fa9c1", "tell");
    assert.deepEqual(said.said, [`${NAMED}: It is still on its way after 60 minutes. ${FINISH_RUNNING}`]);
    w.t.done();
  });
});

describe("a marker the guide does not believe", () => {
  /** A raw video whose finish has ended, so that its hand-off is written and nothing is at work. */
  async function finished() {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    return w;
  }
  /** A marker for the hand-off the record holds, under `nonce`. */
  const mark = (w, nonce, over = {}) => markChecking(w.t.home, FOLDER, { nonce, revision: reread(w.found).finished.revision, due: w.t.now() + LATE_CHECK_MS, took: ["Downloads"], ...over });
  const STEP = [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"];
  it("is believed with the lock's own nonce, a live finish run and the record's revision, and the guide writes nothing meanwhile", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce);
    const files = readdirSync(episodeWork(w.t.home, FOLDER)).sort();
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, [...STEP, check(w.t.now() + LATE_CHECK_MS)]);
    assert.deepEqual(readdirSync(episodeWork(w.t.home, FOLDER)).sort(), files);
    w.t.done();
  });
  it("is not believed when its run is gone: the finish was killed, and the lock it held is a dead run's", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce);
    const dead = await on(seeing(w, { alive: () => false }), "guide", "3fa9c1");
    assert.deepEqual(dead.said, STEP, "no finish is running: the step, and no line of a check to wait for");
    w.t.done();
  });
  it("is not believed when another finish holds the lock: an older run's marker, and a later finish still copying", async () => {
    const w = await finished();
    takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, "the nonce of the run that was killed");
    const copying = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
  it("is not believed when the lock is another command's", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "bring", () => true);
    mark(w, took.nonce);
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, STEP);
    w.t.done();
  });
  it("is not believed once the record no longer holds the finish it names", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce, { revision: reread(w.found).finished.revision + 1 });
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
});
