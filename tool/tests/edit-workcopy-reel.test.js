// `workcopy --now "<episode folder>" --reel <n>`: the detached run that makes a Reel's video, the stretch of the recording the Reel's
// project holds (plan PR 5; architecture 2026-10-27: 4.3, 5.7 and 6.2). It is the working copy's run (edit-workcopy.test.js) with a
// stretch of the recording in place of the whole of it: the same chain, checks, watchdog, lock of its own and place, and it runs for a
// finished video too, which has no working copy of its own. The job is workcopy.js's makeWorkCopy, which workcopy.test.js tests on its
// own; these tests run the command through editMain, with stand-ins for ffprobe, ffmpeg under its watchdog, the face finder and the
// progress panel (workcopy-world.js), so no test runs ffmpeg, swift or any other program. They are about what is wired: the gate, the
// kinds it runs for, the Reel's place in reels.json, the faces, and the result it leaves. What `app` asks for is edit-app-reel.test.js's.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { COMMAND_NAMES, HELP } from "../edit.js";
import { HELD } from "../gate.js";
import { lockOf, readResult, resultFile } from "../detached.js";
import { reelStretch } from "../app-reel.js";
import { recordFile, recordText } from "../episode.js";
import { writePending } from "../filing.js";
import { READ_LOOK_MS } from "../reading.js";
import { STILL_EVERY } from "../reframe.js";
import { pendingFolder } from "../settings.js";
import { REEL_COPY_STEPS, REEL_FACES_MS, WORK_COPY_STEP, reelCopyKey, reelCopyPaths, workCopyLimits, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { probed } from "./fixtures.js";
import { FOLDER, ID, NAME, episodeAs, reread } from "./episodes.js";
import { ANSWERED, CLEARED, CLIP, COPY, FINISHED, LEFT, PLAIN, RAW, SESSION, SESSION_MARK, UNANSWERED, WAS_SESSION, atWork, dropbox, on, world } from "./workcopy-world.js";

const WAITING_WORDS = "This video is waiting for its answer: say what it is first.";
const LEFT_WORDS = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const NOT_A_REEL_KIND = "It can't be used: it is not a raw or a finished video.";
const BOX = { x: 0.41, y: 0.22, w: 0.18, h: 0.3 };
const FOUND = { stills: [{ file: "0001.jpg", faces: [] }, { file: "0002.jpg", faces: [BOX] }] };

/** The made-up world of workcopy-world.js, with ffprobe answering for what is made of the recording by the length of Reel 2's stretch
    (a little over: the sound of an AAC file is), and where the Reel's video goes. */
function reelWorld(opts = {}) {
  let made = 0;
  const w = world({
    ...opts,
    programs: {
      FFPROBE: (args) => {
        const file = args[args.length - 1];
        writeFileSync(args[args.indexOf("-o") + 1], probed({ sound: { sample_rate: "48000", channels: 2 }, ...(file.includes("/.runs/") ? { duration: made.toFixed(6) } : {}) }));
        return { code: 0, stderr: "" };
      },
      ...(opts.programs || {})
    }
  });
  const { stretch } = reelStretch(w.found.folder, 2);
  made = stretch.end - stretch.start + 0.02;
  const copy = reelCopyPaths(w.t.home, FOLDER, 2, reelCopyKey({ bytes: w.raw.size, mtimeMs: w.raw.mtimeMs }, stretch));
  return { ...w, stretch, copy, seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, made };
}
const ASK = ["workcopy", "--now", FOLDER, "--reel", "2"];
const nothingMade = (w) => assert.deepEqual([w.guarded.length, existsSync(w.copy.video), existsSync(w.copy.facts), existsSync(w.copy.dir)], [0, false, false, false], "nothing is made");

describe("workcopy --reel: the command", () => {
  it("is still in no help, and --reel without a whole number from 1 after it is the help and 2, whatever else it is given", async () => {
    assert.ok(COMMAND_NAMES.includes("workcopy"));
    assert.ok(!HELP.includes("workcopy") && !HELP.includes("--reel"));
    for (const argv of [["--reel"], ["--reel", ""], ["--reel", "x"], ["--reel", "0"], ["--reel", "-1"], ["--reel", "2.5"], ["--reel", "02x"], ["--reel", "2", "--reel", "3"]]) {
      const w = reelWorld();
      const before = dropbox(w.found);
      const r = await on(w.t.ctx.deps, "workcopy", "--now", FOLDER, ...argv);
      assert.deepEqual([r.code, r.said], [2, [HELP]], argv.join(" "));
      assert.deepEqual([dropbox(w.found), w.t.calls, w.t.started, existsSync(resultFile(w.t.home, FOLDER, "workcopy")), existsSync(workCopyLockOf(w.t.home, FOLDER))], [before, [], [], false, false], argv.join(" "));
      w.t.done();
    }
  });
  it("makes the Reel's video: ffmpeg cuts the stretch from the recording as it is filed, with the working copy's own limits for the stretch, and it is put in place whole, with its facts", async () => {
    const w = reelWorld();
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.equal(w.guarded.length, 1);
    const [ran] = w.guarded;
    assert.deepEqual([ran.cmd, ran.args[ran.args.indexOf("-i") + 1], ran.args[ran.args.indexOf("-ss") + 1], ran.args[ran.args.indexOf("-t") + 1], ran.limits],
      ["FFMPEG", join(w.found.folder, "Pricing talk.mp4"), String(w.stretch.start), String(w.seconds), workCopyLimits(w.seconds, false)]);
    assert.ok(ran.args[ran.args.length - 1].startsWith(join(w.t.home, "BRIMM Video Work", ".runs")), ran.args[ran.args.length - 1]);
    assert.equal(readFileSync(w.copy.video, "utf8"), COPY);
    const facts = JSON.parse(readFileSync(w.copy.facts, "utf8"));
    assert.deepEqual([facts.width, facts.height, facts.fps, facts.bytes, facts.stretch], [1280, 720, 29.97, COPY.length, { start: w.stretch.start, end: w.stretch.end }]);
    // The working copy's own place holds nothing of the video's: only the Reel's two files are in the folder of the copies.
    assert.deepEqual(readdirSync(w.copy.dir).sort(), [basename(w.copy.facts), basename(w.copy.video)].sort());
    assert.ok(!existsSync(workCopyPaths(w.t.home, FOLDER, `${w.raw.size}-${Math.floor(w.raw.mtimeMs)}`).video));
    w.t.done();
  });
  it("leaves its result for \"how far is it?\": the video for the Reel, in words, and the lock of its own let go", async () => {
    const w = reelWorld();
    await on(w.t.ctx.deps, ...ASK);
    const result = readResult(w.t.home, FOLDER, "workcopy");
    assert.deepEqual([result.command, result.ok, result.made, result.failed, result.next], ["workcopy", true, ["the video for Reel 2"], [], ""]);
    assert.deepEqual([existsSync(workCopyLockOf(w.t.home, FOLDER)), existsSync(lockOf(w.t.home, FOLDER))], [false, false]);
    for (const line of [...result.made, ...result.failed]) assert.doesNotMatch(line, PLAIN, line);
    w.t.done();
  });
  it("takes the working copy's own lock for as long as it works, and never the episode's; and it writes no record and puts nothing in Dropbox", async () => {
    const w = reelWorld();
    const before = dropbox(w.found);
    await on(w.t.ctx.deps, ...ASK);
    assert.deepEqual([w.guarded[0].copyLock, w.guarded[0].episodeLock], [true, false]);
    assert.deepEqual([dropbox(w.found), w.t.started], [before, []]);
    w.t.done();
  });
  it("runs for a finished video, which has no working copy of its own, and for a raw video whose session mark was cleared, and a record from before the switch", async () => {
    for (const [what, record] of [["a finished video", FINISHED], ["a cleared session", WAS_SESSION], ["a record from before the switch", {}]]) {
      const w = reelWorld({ record });
      const r = await on(w.t.ctx.deps, ...ASK);
      assert.equal(r.code, 0, `${what}: ${r.text}`);
      assert.deepEqual([existsSync(w.copy.video), existsSync(w.copy.facts)], [true, true], what);
      w.t.done();
    }
  });
  it("is never for an iPhone clip, whose video the working copy is: it says in words that it can't be used, and makes nothing", async () => {
    const w = reelWorld({ record: CLIP });
    const before = dropbox(w.found);
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.deepEqual([r.code, w.guarded, w.t.calls, dropbox(w.found)], [1, [], [], before]);
    nothingMade(w);
    assert.deepEqual(readResult(w.t.home, FOLDER, "workcopy").failed, [NOT_A_REEL_KIND]);
    assert.doesNotMatch(NOT_A_REEL_KIND, PLAIN);
    w.t.done();
  });
  it("is never for a record that says session, even where the mark was cleared: a session is never given a copy", async () => {
    const w = reelWorld({ record: { ...SESSION, session: { ...SESSION_MARK, cleared: CLEARED } } });
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.deepEqual([r.code, w.guarded, readResult(w.t.home, FOLDER, "workcopy").failed], [1, [], [NOT_A_REEL_KIND]]);
    w.t.done();
  });
});

describe("workcopy --reel: the gate asks first, in its own words, as workcopy's does", () => {
  it("refuses a video not yet answered, a video left alone, a session not cleared and a video held beside a session, makes nothing, and leaves a result in those words", async () => {
    const OLD = "e-20261010-a0a0a0";
    for (const [what, record, why] of [["not yet answered", UNANSWERED, WAITING_WORDS], ["left alone", LEFT, LEFT_WORDS], ["a session", SESSION, NOT_FOR_SESSION], ["held beside a session", { ...RAW, versionOf: OLD }, HELD]]) {
      const w = world({ record });
      if (what === "held beside a session") episodeAs(w.t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
      const before = dropbox(w.found);
      const r = await on(w.t.ctx.deps, ...ASK);
      assert.deepEqual([r.code, r.said], [1, [why]], what);
      assert.deepEqual([w.guarded, w.t.calls, w.t.started, dropbox(w.found)], [[], [], [], before], what);
      const result = readResult(w.t.home, FOLDER, "workcopy");
      assert.deepEqual([result.ok, result.failed, result.made], [false, [why], []], what);
      assert.deepEqual([existsSync(workCopyLockOf(w.t.home, FOLDER)), existsSync(lockOf(w.t.home, FOLDER))], [false, false], what);
      for (const given of [FOLDER, "Pricing", "mp4"]) assert.ok(!readFileSync(resultFile(w.t.home, FOLDER, "workcopy"), "utf8").includes(given), `${given} in the result`);
      w.t.done();
    }
  });
  it("refuses a session whether this Mac's training gate is on or off: workcopy is in no list", async () => {
    const w = world({ record: SESSION });
    const taught = { ...w.t.ctx.deps, settings: { ...w.t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    const r = await on(taught, ...ASK);
    assert.deepEqual([r.code, r.said, w.guarded], [1, [NOT_FOR_SESSION], []]);
    w.t.done();
  });
});

describe("workcopy --reel: the Reel is read from the list of suggestions, and only a Reel that is there is made", () => {
  const listed = (w, change) => {
    const at = join(w.found.folder, "reels.json");
    writeFileSync(at, JSON.stringify(change(JSON.parse(readFileSync(at, "utf8")))));
  };
  it("says in words, and makes nothing, when the list no longer has the Reel", async () => {
    const w = reelWorld();
    listed(w, (reels) => ({ ...reels, candidates: reels.candidates.filter((c) => c.n !== 2) }));
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 1, r.text);
    nothingMade(w);
    assert.deepEqual([w.t.calls, readResult(w.t.home, FOLDER, "workcopy").failed], [[], ["It can't be used: Reel 2 is not one of the suggestions any more."]]);
    w.t.done();
  });
  it("says in words when the Reel has no stretch to show, and when the list cannot be read", async () => {
    const empty = reelWorld();
    listed(empty, (reels) => ({ ...reels, candidates: reels.candidates.map((c) => (c.n === 2 ? { ...c, ranges: [], failed: "it is shorter than one picture" } : c)) }));
    assert.equal((await on(empty.t.ctx.deps, ...ASK)).code, 1);
    assert.deepEqual(readResult(empty.t.home, FOLDER, "workcopy").failed, ["It can't be used: Reel 2 has nothing to show: it is shorter than one picture."]);
    nothingMade(empty);
    const broken = reelWorld();
    writeFileSync(join(broken.found.folder, "reels.json"), "{ not json");
    assert.equal((await on(broken.t.ctx.deps, ...ASK)).code, 1);
    assert.deepEqual(readResult(broken.t.home, FOLDER, "workcopy").failed, ["It can't be used: the Reel suggestions cannot be read."]);
    nothingMade(broken);
    for (const w of [empty, broken]) {
      for (const line of readResult(w.t.home, FOLDER, "workcopy").failed) assert.doesNotMatch(line, PLAIN, line);
      w.t.done();
    }
  });
});

describe("workcopy --reel: what it cannot make, it says in words, as the working copy does", () => {
  it("says why in the result, and leaves nothing in the folder of the copies, when ffmpeg cannot make it", async () => {
    const w = reelWorld({ how: "fail" });
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 1);
    assert.deepEqual(readResult(w.t.home, FOLDER, "workcopy").failed, ["It can't be used: it could not be converted."]);
    assert.deepEqual([existsSync(w.copy.dir), existsSync(workCopyLockOf(w.t.home, FOLDER))], [false, false]);
    w.t.done();
  });
  it("says in words when the stretch is not in the recording: the list is the reading's, the recording is another file", async () => {
    const w = reelWorld();
    const at = join(w.found.folder, "reels.json");
    const reels = JSON.parse(readFileSync(at, "utf8"));
    writeFileSync(at, JSON.stringify({ ...reels, candidates: reels.candidates.map((c) => (c.n === 2 ? { ...c, start: 40, end: 50, ranges: [{ start: 40, end: 50, ...(c.ranges[0].crop ? { crop: c.ranges[0].crop } : {}) }] } : c)) }));
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 1, r.text);
    assert.deepEqual([w.guarded, readResult(w.t.home, FOLDER, "workcopy").failed], [[], ["It can't be used: Reel 2 is not in the video."]]);
    w.t.done();
  });
});

describe("workcopy --reel: it runs beside the reading, one copy at a time, and waits for the import's check", () => {
  it("runs while the reading holds the episode's lock, and does nothing, saying the video is being made, while a copy is at work, a Reel's or the video's", async () => {
    const w = reelWorld();
    atWork(w.t, "read");
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([existsSync(w.copy.video), w.guarded[0].copyLock, w.guarded[0].episodeLock], [true, true, true]);
    const busy = reelWorld();
    atWork(busy.t, "workcopy");
    const again = await on(busy.t.ctx.deps, ...ASK);
    assert.deepEqual([again.code, again.said, busy.guarded, existsSync(busy.copy.video)], [1, [`The video for HyperFrames is being made for ${FOLDER} already.`], [], false]);
    w.t.done();
    busy.t.done();
  });
  it("waits, making nothing, while this Mac's late check of the video is still to come, and makes the Reel's video once the check is made", async () => {
    const w = reelWorld();
    writePending(w.t.home, { version: 1, id: ID, name: FOLDER, folder: w.found.folder, video: "Pricing talk.mp4", bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: w.t.now() - 5 * 60 * 1000, root: w.t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    const waited = w.t.ctx.deps.wait;
    let looks = 0;
    w.t.ctx.deps.wait = async (ms) => {
      if (ms === READ_LOOK_MS) {
        looks += 1;
        nothingMade(w);
        if (looks === 2) rmSync(join(pendingFolder(w.t.home), `${ID}.json`), { force: true });
      }
      await waited(ms);
    };
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([looks, w.guarded.length, existsSync(w.copy.video)], [2, 1, true]);
    assert.equal(r.said[0], `${NAME}: the video for HyperFrames is made once the import has checked its copies.`);
    w.t.done();
  });
  it("is found again after the wait, and stops, making nothing, when she said it is an iPhone clip while it waited", async () => {
    const w = reelWorld();
    writePending(w.t.home, { version: 1, id: ID, name: FOLDER, folder: w.found.folder, video: "Pricing talk.mp4", bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: w.t.now() - 5 * 60 * 1000, root: w.t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    const waited = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      if (ms === READ_LOOK_MS) {
        writeFileSync(recordFile(w.found.folder, 2), recordText({ ...reread(w.found), rev: 2, kind: "short video" }));
        rmSync(join(pendingFolder(w.t.home), `${ID}.json`), { force: true });
      }
      await waited(ms);
    };
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 1, r.text);
    nothingMade(w);
    assert.deepEqual(readResult(w.t.home, FOLDER, "workcopy").failed, [NOT_A_REEL_KIND]);
    w.t.done();
  });
  it("does not wait at all for a video it will not make a copy of: an iPhone clip is refused first", async () => {
    const w = reelWorld({ record: CLIP });
    writePending(w.t.home, { version: 1, id: ID, name: FOLDER, folder: w.found.folder, video: "Pricing talk.mp4", bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: w.t.now() - 5 * 60 * 1000, root: w.t.root, machine: "Mac Studio", planTxt: "x.txt" });
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 1, r.text);
    assert.deepEqual(w.t.waits, []);
    w.t.done();
  });
});

describe("workcopy --reel: the progress panel, and the faces looked for in the Reel's video", () => {
  it("tells the panel the video by the episode's name and the Reel's, its two steps, and that it finished", async () => {
    const w = reelWorld();
    await on(w.t.ctx.deps, ...ASK);
    assert.deepEqual(w.events.map(([what]) => what), ["begin", "steps", "step", "length", "encoding", "stop", "step", "end"]);
    assert.deepEqual([w.events[0], w.events[1], w.events[2], w.events[3], w.events[6], w.events[7]],
      [["begin", `${NAME}, Reel 2`], ["steps", REEL_COPY_STEPS], ["step", WORK_COPY_STEP], ["length", w.seconds], ["step", "Finding the faces"], ["end", true]]);
    w.t.done();
  });
  it("keeps the faces beside the Reel's video when the finder found some, as it printed them, and nothing when it found none", async () => {
    const found = reelWorld();
    found.t.ctx.deps.faces = async () => FOUND;
    assert.equal((await on(found.t.ctx.deps, ...ASK)).code, 0);
    assert.deepEqual(JSON.parse(readFileSync(found.copy.faces, "utf8")), { every: STILL_EVERY, stills: FOUND.stills });
    const none = reelWorld();
    none.t.ctx.deps.faces = async () => ({ stills: [{ file: "0001.jpg", faces: [] }] });
    assert.equal((await on(none.t.ctx.deps, ...ASK)).code, 0);
    assert.equal(existsSync(none.copy.faces), false);
    found.t.done();
    none.t.done();
  });
  it("looks for them with the face finder swift runs, in stills of the Reel's video, when this Mac has swift, and in no other case", async () => {
    const stills = [{ file: "0001.jpg", faces: [BOX] }];
    const w = reelWorld({ programs: { SWIFT: () => ({ code: 0, stderr: "", stdout: JSON.stringify(stills) }) } });
    w.t.ctx.deps.tools = { ...w.t.ctx.deps.tools, swift: "SWIFT" };
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(JSON.parse(readFileSync(w.copy.faces, "utf8")), { every: STILL_EVERY, stills });
    const swift = w.t.calls.find((call) => call.cmd === "SWIFT");
    assert.ok(swift && swift.args[0].endsWith("faces.swift"), JSON.stringify(swift));
    // The stills were made of the Reel's video, in the run's own folder, at the finder's own spacing.
    const ffmpeg = w.t.calls.find((call) => call.cmd === "FFMPEG" && call.args.includes("-vf") && /fps=1\/2/.test(call.args[call.args.indexOf("-vf") + 1]));
    assert.ok(ffmpeg, JSON.stringify(w.t.calls.map((call) => call.cmd)));
    assert.equal(ffmpeg.args[ffmpeg.args.indexOf("-i") + 1], w.copy.video);
    assert.ok(swift.args[1].startsWith(join(w.t.home, "BRIMM Video Work", ".runs")), swift.args[1]);
    // Without swift there is no finder: the copy is made all the same, and says nothing of faces to her.
    const bare = reelWorld();
    const done = await on(bare.t.ctx.deps, ...ASK);
    assert.equal(done.code, 0, done.text);
    assert.equal(existsSync(bare.copy.faces), false);
    assert.ok(!bare.t.calls.some((call) => call.cmd === "SWIFT"));
    w.t.done();
    bare.t.done();
  });
  it("limits how long the finder's two programs may run, so that one that hangs does not hold the working copy's lock for good", async () => {
    const stills = [{ file: "0001.jpg", faces: [BOX] }];
    const w = reelWorld({ programs: { SWIFT: () => ({ code: 0, stderr: "", stdout: JSON.stringify(stills) }) } });
    w.t.ctx.deps.tools = { ...w.t.ctx.deps.tools, swift: "SWIFT" };
    const run = w.t.ctx.deps.run;
    const asked = [];
    w.t.ctx.deps.run = async (cmd, args, options) => (asked.push({ cmd, args, options }), run(cmd, args, options));
    assert.equal((await on(w.t.ctx.deps, ...ASK)).code, 0);
    const finder = asked.filter(({ cmd, args }) => cmd === "SWIFT" || (cmd === "FFMPEG" && args.some((arg) => /fps=1\/2/.test(arg))));
    assert.deepEqual(finder.map(({ cmd, options }) => [cmd, options && options.limit]), [["FFMPEG", REEL_FACES_MS], ["SWIFT", REEL_FACES_MS]]);
    assert.ok(REEL_FACES_MS >= 60000 && REEL_FACES_MS <= 10 * 60 * 1000, "a Reel is at most 90 seconds: minutes are enough, and hours are not wanted");
    w.t.done();
  });
  it("offers no faces, says why in the log, and still makes the copy, when the finder runs out of its time", async () => {
    const w = reelWorld({ programs: { SWIFT: () => ({ code: 1, stderr: "", signal: "SIGKILL", outOfTime: true }) } });
    w.t.ctx.deps.tools = { ...w.t.ctx.deps.tools, swift: "SWIFT" };
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /no face was found in the video \(the face finder stopped \(it took more than 3 minutes, so it was stopped\)\), so the faces are not offered/);
    assert.deepEqual([existsSync(w.copy.video), existsSync(w.copy.faces)], [true, false]);
    assert.equal(existsSync(workCopyLockOf(w.t.home, FOLDER)), false, "the lock is let go");
    w.t.done();
  });
  it("is never looked for in the working copy of the whole video, and a run without --reel has the one step as before", async () => {
    const w = world();
    w.t.ctx.deps.faces = async () => {
      throw new Error("faces are looked for in a Reel's video alone");
    };
    assert.equal((await on(w.t.ctx.deps, "workcopy", "--now", FOLDER)).code, 0);
    assert.deepEqual(w.events.find(([what]) => what === "steps"), ["steps", [WORK_COPY_STEP]]);
    w.t.done();
  });
});

describe("workcopy --reel: \"how far is it?\" says it, as it says the working copy", () => {
  it("says the video for HyperFrames is being made while the run works, with its two steps, and what it made once it has ended", async () => {
    let mid = null;
    const w = reelWorld({ inside: async () => (mid = await on(w.t.ctx.deps, "status")) });
    delete w.t.ctx.deps.progress;
    w.t.ctx.deps.alive = (pid) => pid === process.pid;
    const r = await on(w.t.ctx.deps, ...ASK);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(mid.said, ["Running on this Mac:", `  ${NAME}, Reel 2: Making the video for HyperFrames (step 1 of 2)`, `${FOLDER}: the video for HyperFrames is being made.`]);
    const after = await on(w.t.ctx.deps, "status");
    assert.deepEqual(after.said, [`${FOLDER}: making the video for HyperFrames ended 0 minutes ago. Made: the video for Reel 2.`]);
    for (const line of [...mid.said, ...after.said]) assert.doesNotMatch(line.replace(FOLDER, "<episode>"), PLAIN, line);
    w.t.done();
  });
});
