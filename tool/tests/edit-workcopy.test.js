// `workcopy --now "<episode folder>" [--4k]`: the detached run that makes the working copy of an episode's raw video, the video the
// HyperFrames app is given to edit (plan PR 4, "The working copy"; architecture 2026-10-27, sections 5.7 and 6.2). It is a detached
// run's alone, like `read`: `kind` and `app` start it (requestWorkCopy), it is in no help, and edit.js only wires it. The job is
// workcopy.js's makeWorkCopy, which workcopy.test.js tests on its own; these tests run the command through editMain, with
// stand-ins for ffprobe, for ffmpeg under its watchdog and for the progress panel (workcopy-world.js), so no test runs ffmpeg or any
// other program. They are about what is wired: the gate, the kinds it runs for, the lock of its own, and the result it leaves. How
// "how far is it?" says it is edit-status-workcopy.test.js's, and what `kind` starts is edit-kind.test.js's.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMAND_NAMES, HELP } from "../edit.js";
import { HELD } from "../gate.js";
import { lockOf, readResult, resultFile } from "../detached.js";
import { RECORD_VERSION, recordFile } from "../episode.js";
import { WORK_COPY_STEPS, workCopyKey, workCopyLimits, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { FOLDER, ID, NAME, episodeAs } from "./episodes.js";
import { ANSWERED, CLEARED, CLIP, COPY, FINISHED, LEFT, PLAIN, RAW, SESSION, SESSION_MARK, UNANSWERED, WAS_SESSION, atWork, dropbox, on, world } from "./workcopy-world.js";

const WAITING_WORDS = "This video is waiting for its answer: say what it is first.";
const LEFT_WORDS = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const NOT_RAW_OR_CLIP = "It can't be used: it is not a raw video or an iPhone clip.";

describe("workcopy: the command", () => {
  it("is one of edit.js's commands and in no help, as a detached run's alone is; without --now and an episode it says the help and ends with 2", async () => {
    assert.ok(COMMAND_NAMES.includes("workcopy"));
    assert.ok(!HELP.includes("workcopy"));
    for (const argv of [[], [FOLDER], ["--now"], ["--now", ""], ["--4k"]]) {
      const { t, found } = world();
      const before = dropbox(found);
      const r = await on(t.ctx.deps, "workcopy", ...argv);
      assert.deepEqual([r.code, r.said], [2, [HELP]], argv.join(" "));
      assert.deepEqual([dropbox(found), t.calls, t.started, existsSync(resultFile(t.home, FOLDER, "workcopy")), existsSync(workCopyLockOf(t.home, FOLDER))], [before, [], [], false, false], argv.join(" "));
      t.done();
    }
  });
  it("makes the working copy of a raw video: ffprobe reads it, ffmpeg writes the copy under the watchdog, and it is put in place whole, with its facts beside it", async () => {
    const { t, found, raw, paths, guarded, work } = world();
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    // ffmpeg ran once, on the raw video as it is filed, with the limits of a video of its length, and wrote into the run's own folder.
    assert.equal(guarded.length, 1);
    const [ran] = guarded;
    assert.deepEqual([ran.cmd, ran.args[ran.args.indexOf("-i") + 1], ran.limits], ["FFMPEG", join(found.folder, "Pricing talk.mp4"), workCopyLimits(23.423, false)]);
    assert.ok(ran.args[ran.args.length - 1].startsWith(join(t.home, "BRIMM Video Work", ".runs")), ran.args[ran.args.length - 1]);
    // The copy is where the key of the raw file puts it, whole, and so are its facts; nothing else is left in the episode's work folder
    // but the result and the folder of the copies.
    assert.equal(readFileSync(paths.video, "utf8"), COPY);
    assert.deepEqual(JSON.parse(readFileSync(paths.facts, "utf8")), { seconds: 23.423, fps: 29.97, width: 1280, height: 720, bytes: COPY.length });
    assert.deepEqual(readdirSync(work).sort(), ["workcopy.result.json", "working copy"]);
    assert.deepEqual(readdirSync(paths.dir).sort(), [`${raw.size}-${Math.floor(raw.mtimeMs)}.json`, `${raw.size}-${Math.floor(raw.mtimeMs)}.mp4`]);
    t.done();
  });
  it("leaves its result for \"how far is it?\": what it made, in words, and the lock of its own let go", async () => {
    const { t } = world();
    await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    const result = readResult(t.home, FOLDER, "workcopy");
    assert.deepEqual([result.command, result.ok, result.made, result.failed, result.next], ["workcopy", true, ["the video for HyperFrames"], [], ""]);
    assert.deepEqual([existsSync(workCopyLockOf(t.home, FOLDER)), existsSync(lockOf(t.home, FOLDER))], [false, false]);
    t.done();
  });
  it("makes one for an iPhone clip and for a record from before the switch, and a copy of 4K with --4k, whose limits are the larger", async () => {
    for (const [what, record] of [["an iPhone clip", CLIP], ["a record from before the switch", {}]]) {
      const { t, paths } = world({ record });
      assert.equal((await on(t.ctx.deps, "workcopy", "--now", FOLDER)).code, 0, what);
      assert.equal(existsSync(paths.video), true, what);
      t.done();
    }
    const { t, raw, guarded } = world();
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER, "--4k");
    assert.equal(r.code, 0, r.text);
    const fourK = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs, fourK: true }));
    assert.deepEqual([guarded[0].limits, existsSync(fourK.video), existsSync(fourK.facts)], [workCopyLimits(23.423, true), true, true]);
    t.done();
  });
  it("tells the progress panel the video by the episode's name, its one step, and that it finished", async () => {
    const { t, events } = world();
    await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual(events.map(([what]) => what), ["begin", "steps", "step", "length", "encoding", "stop", "end"]);
    assert.deepEqual([events[0], events[1], events[2], events[6]], [["begin", NAME], ["steps", WORK_COPY_STEPS], ["step", WORK_COPY_STEPS[0]], ["end", true]]);
    t.done();
  });
  it("writes no record and puts nothing in the episode's folder in Dropbox: it writes only on this Mac", async () => {
    const { t, found } = world();
    const before = dropbox(found);
    await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual(dropbox(found), before);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("takes the working copy's own lock for as long as it works, and never the episode's", async () => {
    const { t, guarded } = world();
    await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual([guarded[0].copyLock, guarded[0].episodeLock], [true, false]);
    t.done();
  });
});

describe("workcopy: it runs beside the reading, and one at a time", () => {
  it("runs while the reading holds the episode's lock, and leaves that lock as it found it", async () => {
    const { t, paths, guarded } = world();
    atWork(t, "read");
    const lock = readFileSync(lockOf(t.home, FOLDER), "utf8");
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([existsSync(paths.video), guarded[0].copyLock, guarded[0].episodeLock], [true, true, true]);
    assert.equal(readFileSync(lockOf(t.home, FOLDER), "utf8"), lock);
    t.done();
  });
  it("does nothing, and says the video is being made, while a run of it is at work", async () => {
    const { t, found, paths, guarded } = world();
    atWork(t, "workcopy");
    const before = dropbox(found);
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The video for HyperFrames is being made for ${FOLDER} already.`]]);
    assert.deepEqual([guarded, existsSync(paths.video), t.calls, dropbox(found)], [[], false, [], before]);
    // The run at work keeps its lock: this one did not take it away.
    assert.equal(JSON.parse(readFileSync(workCopyLockOf(t.home, FOLDER), "utf8")).pid, process.pid);
    t.done();
  });
  it("takes the lock over from a run that died, as every command does", async () => {
    const { t, paths } = world();
    atWork(t, "workcopy");
    t.ctx.deps.alive = () => false;
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([existsSync(paths.video), existsSync(workCopyLockOf(t.home, FOLDER))], [true, false]);
    t.done();
  });
});

describe("workcopy: the gate asks first, in its own words", () => {
  it("refuses a video not yet answered, a video left alone, a session not cleared and a video held beside a session, makes nothing, and leaves a result in those words", async () => {
    const OLD = "e-20261010-a0a0a0";
    for (const [what, record, why] of [["not yet answered", UNANSWERED, WAITING_WORDS], ["left alone", LEFT, LEFT_WORDS], ["a session", SESSION, NOT_FOR_SESSION], ["held beside a session", { ...RAW, versionOf: OLD }, HELD]]) {
      const { t, found, paths, guarded } = world({ record });
      if (what === "held beside a session") episodeAs(t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
      const before = dropbox(found);
      const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
      assert.deepEqual([r.code, r.said], [1, [why]], what);
      assert.deepEqual([guarded, t.calls, existsSync(paths.video), t.started, dropbox(found)], [[], [], false, [], before], what);
      // The refusal is left as a run's result, in the gate's words and naming no folder, and the lock of its own is let go.
      const result = readResult(t.home, FOLDER, "workcopy");
      assert.deepEqual([result.ok, result.failed, result.made], [false, [why], []], what);
      assert.deepEqual([existsSync(workCopyLockOf(t.home, FOLDER)), existsSync(lockOf(t.home, FOLDER))], [false, false], what);
      for (const given of [FOLDER, "Pricing", "mp4"]) assert.ok(!readFileSync(resultFile(t.home, FOLDER, "workcopy"), "utf8").includes(given), `${given} in the result`);
      t.done();
    }
  });
  it("refuses a session whether this Mac's training gate is on or off: workcopy is in no list", async () => {
    const { t, guarded } = world({ record: SESSION });
    const taught = { ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    const r = await on(taught, "workcopy", "--now", FOLDER);
    assert.deepEqual([r.code, r.said, guarded], [1, [NOT_FOR_SESSION], []]);
    t.done();
  });
  it("leaves its result in the gate's words even while the reading holds the episode's lock: the lock it takes is its own", async () => {
    const { t } = world({ record: UNANSWERED });
    atWork(t, "read");
    await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual(readResult(t.home, FOLDER, "workcopy").failed, [WAITING_WORDS]);
    t.done();
  });
  it("runs for an answered raw video, an iPhone clip, and a video answered as raw whose session mark was cleared", async () => {
    for (const [what, record] of [["a raw video", RAW], ["an iPhone clip", CLIP], ["a cleared session", WAS_SESSION]]) {
      const { t, paths } = world({ record });
      const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
      assert.equal(r.code, 0, `${what}: ${r.text}`);
      assert.equal(existsSync(paths.video), true, what);
      t.done();
    }
  });
});

describe("workcopy: only for a raw video or an iPhone clip", () => {
  it("refuses a finished video in words, makes nothing, and leaves a result that says so", async () => {
    const { t, found, paths, guarded } = world({ record: FINISHED });
    const before = dropbox(found);
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual([r.code, guarded, t.calls, existsSync(paths.video), existsSync(paths.dir), dropbox(found)], [1, [], [], false, false, before]);
    const result = readResult(t.home, FOLDER, "workcopy");
    assert.deepEqual([result.ok, result.failed, result.made, result.next], [false, [NOT_RAW_OR_CLIP], [], ""]);
    assert.doesNotMatch(NOT_RAW_OR_CLIP, PLAIN);
    assert.deepEqual([existsSync(workCopyLockOf(t.home, FOLDER)), existsSync(lockOf(t.home, FOLDER))], [false, false]);
    t.done();
  });
  it("refuses a record that says session even where its mark was cleared: a session is never given a copy", async () => {
    const { t, guarded } = world({ record: { ...SESSION, session: { ...SESSION_MARK, cleared: CLEARED } } });
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual([r.code, guarded, readResult(t.home, FOLDER, "workcopy").failed], [1, [], [NOT_RAW_OR_CLIP]]);
    t.done();
  });
});

describe("workcopy: what it cannot make, it says in words", () => {
  it("says why in the result, and leaves nothing in the folder of the copies, when ffmpeg cannot make it", async () => {
    const { t, paths } = world({ how: "fail" });
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 1);
    const result = readResult(t.home, FOLDER, "workcopy");
    assert.deepEqual([result.ok, result.made, result.failed], [false, [], ["It can't be used: it could not be converted."]]);
    assert.deepEqual([existsSync(paths.dir), existsSync(workCopyLockOf(t.home, FOLDER))], [false, false]);
    assert.doesNotMatch(result.failed.join(" "), PLAIN);
    t.done();
  });
  it("says in words when this Mac has no ffmpeg or no ffprobe to make it with, and runs nothing", async () => {
    for (const tools of [{}, { ffmpeg: "FFMPEG", ffprobe: "" }, { ffmpeg: "", ffprobe: "FFPROBE" }]) {
      const { t, guarded } = world();
      t.ctx.deps.tools = tools;
      const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
      assert.equal(r.code, 1);
      assert.deepEqual([guarded, t.calls, readResult(t.home, FOLDER, "workcopy").failed], [[], [], ["It can't be used: this Mac has no program to make it with: ask Jason."]]);
      t.done();
    }
  });
  it("says in words when the raw video is not on this Mac", async () => {
    const { t, found } = world();
    rmSync(join(found.folder, "Pricing talk.mp4"));
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 1);
    assert.deepEqual(readResult(t.home, FOLDER, "workcopy").failed, ["It can't be used: it isn't on this Mac."]);
    t.done();
  });
});

describe("workcopy: an episode that cannot be gone on with", () => {
  it("says no episode fits, and leaves no result, when none does", async () => {
    const { t } = world();
    const r = await on(t.ctx.deps, "workcopy", "--now", "No such episode");
    assert.deepEqual([r.code, r.said], [1, [`No episode fits "No such episode". The episodes are: ${FOLDER}.`]]);
    assert.deepEqual([readResult(t.home, FOLDER, "workcopy"), t.calls], [null, []]);
    t.done();
  });
  it("names a record a newer brimm-video wrote by its short id alone, as the gate does, and makes nothing", async () => {
    const { t, found, guarded } = world();
    writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.deepEqual([r.code, r.said, guarded], [1, [`That is an episode a newer brimm-video wrote (${ID.slice(-6)}). Jason has a newer brimm-video. Ask him to update this Mac.`], []]);
    t.done();
  });
});
