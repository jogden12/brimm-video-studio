// The guide on the HyperFrames way (plan PR 10; architecture 2026-10-27, 4.5): what edit.js reads of a raw video and an iPhone clip for
// it, and what the guide then says. guide.test.js has the words by their facts; here the facts are read from a made-up episode as
// `guide` reads them: from the record, the working copy's lock, the progress panel's files, the project's history and renders, and
// Downloads, in a made-up home (exports-world.js). No test touches the real home, Downloads, Dropbox or a program, and the guide
// writes nothing.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEPT } from "../app.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { HELP } from "../edit.js";
import { COPY_STEP } from "../guide.js";
import { PIN } from "../hyperframes.js";
import { RATES, aboutLeft, progressFolder, readRates, reporter } from "../progress.js";
import { WORK_COPY_WAIT_STEP, workCopyLockOf } from "../workcopy.js";
import { FOLDER, ID, episodeAs, listAll, reread } from "./episodes.js";
import { ANSWERED, entry, exportOf } from "./exports-world.js";
import { OFFERS, READ, depsOf, guideWorld } from "./guide-world.js";
import { PLAIN, RAW as RAW_RECORD, atWork, on, world as copyWorld } from "./workcopy-world.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const says = (text) => `${NAMED}: ${text}`;
const OPEN = 'Say "open it in HyperFrames" to edit it there.';
const AFTER = 'Say "open it in HyperFrames" when it is done.';
const EXPORTED = 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.';
const edit = (last = "") => `Edit it in HyperFrames.${last ? ` Your last request there was ${last}.` : ""} When you are done, export it on This Mac, as MP4, then say "hand it off".`;
const SHOW = 'Ask for any changes in your own words, then say "show it in Final Cut".';
const FINISH = 'Trim it by hand in Final Cut. Then Share it with Command-E, and choose File > Export XML…, both into From Final Cut. Then say "finish the episode".';
const AGAIN = 'It was shown in Final Cut again since its finish. Share it and Export XML again, then say "finish the episode".';
const TAKE = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
const CLIP_NEXT = 'Open it in HyperFrames to edit it, then export it on this Mac and say "hand it off". Or say "hand it off" to hand it off as it is.';
const FINISH_RUNNING = "Its finish is running. The panel shows how far it is.";

const MAIN_PUSHED = (pushed) => ({ preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed });
const push = (v, at) => ({ v, at, on: "Mac Studio", file: `edit/x.v${v}.mac-studio.fcpxml`, project: `Pricing- what to charge- main v${v} 3fa9c1` });
const FINISHED = { revision: 1, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} };

/** The made-up episode's hand-off, written in final/ as a finish writes one. */
function handOff(w, kind = "raw") {
  mkdirSync(join(w.found.folder, "final"), { recursive: true });
  writeFileSync(join(w.found.folder, "final", "Pricing talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID, kind, name: "Pricing talk" }, main: { file: "Pricing talk.mov" } }));
}
/** The line `guide` says of the made-up episode. Nothing she reads holds a path, a flag or the name of a command. */
async function line(w, over) {
  const r = await on(depsOf(w, over), "guide", "3fa9c1");
  assert.equal(r.code, 0, r.text);
  assert.doesNotMatch(r.text, PLAIN);
  return r.said[0];
}
/** The app's history in the project of the main video: a turn for each time, in the order given. */
function history(w, ...times) {
  const dir = join(w.dirOf("main"), ".hyperframes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "app-history.jsonl"), times.map((at, i) => JSON.stringify({ at, engine: "claude", asked: `Request ${i + 1}`, did: "Done.", files: [] })).join("\n") + "\n");
}
/** What the progress panel keeps for the run of this very process (atWork takes the lock as this process), and for its speeds. */
function panel(w, run) {
  mkdirSync(progressFolder(w.t.home), { recursive: true });
  writeFileSync(join(progressFolder(w.t.home), `${run.pid ?? process.pid}.json`), JSON.stringify({ version: 1, pid: process.pid, video: "Pricing: what to charge?", step: COPY_STEP, n: 1, of: 1, percent: 40, left: 180, total: null, detail: "", started: 0, updated: w.t.now(), ...run }));
}
function speeds(w, speed) {
  mkdirSync(progressFolder(w.t.home), { recursive: true });
  writeFileSync(join(progressFolder(w.t.home), RATES), JSON.stringify({ [COPY_STEP]: speed }));
}
/** A wait stand-in that does `then` on the `n`th wait, once. */
const onWait = (w, n, then) => {
  let count = 0;
  const wait = w.t.ctx.deps.wait;
  return async (ms) => {
    await wait(ms);
    if (++count === n) then();
  };
};

describe("the guide picks the way as finish does, by the record", () => {
  it("sends a raw video with neither a project nor a push to open it in HyperFrames, on a Mac whose settings turn the app on", async () => {
    const w = guideWorld({ projects: null });
    assert.equal(await line(w), says(OPEN));
    w.t.done();
  });
  it("leaves a raw video that was pushed to Final Cut and has no project on the Final Cut way, and so one on a Mac whose settings have the app off", async () => {
    const pushed = guideWorld({ projects: null, over: { main: MAIN_PUSHED([push(1, "2026-10-20T10:00:00-05:00")]) } });
    assert.equal(await line(pushed), says(FINISH));
    const off = guideWorld({ projects: null, set: false });
    assert.equal(await line(off), says(SHOW));
    pushed.t.done();
    off.t.done();
  });
  it("takes a main project in use for the HyperFrames way, a push to Final Cut beside it changing nothing, and a project kept for an earlier kind for none", async () => {
    const both = guideWorld({ over: { main: MAIN_PUSHED([push(1, "2026-10-20T10:00:00-05:00")]) } });
    assert.equal(await line(both), says(edit()));
    const kept = guideWorld({ over: { app: { toolchain: PIN.version, projects: [entry("main", { state: KEPT })] } } });
    assert.equal(await line(kept), says(OPEN));
    both.t.done();
    kept.t.done();
  });
  it("does not send a video on the HyperFrames way back to Final Cut after a finish, as it does one on the Final Cut way", async () => {
    const over = { finished: FINISHED, main: MAIN_PUSHED([push(1, "2026-10-20T09:00:00-05:00"), push(2, "2026-10-20T11:00:00-05:00")]) };
    const app = guideWorld({ over });
    handOff(app);
    const step = await line(app);
    assert.equal(step, says(TAKE + ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".'));
    assert.doesNotMatch(step, /Final Cut|Share|Export XML/);
    const old = guideWorld({ projects: null, over });
    handOff(old);
    assert.equal(await line(old), says(AGAIN));
    app.t.done();
    old.t.done();
  });
});

describe("the guide while the video for HyperFrames is made", () => {
  it("is making it while a live process holds the working copy's lock, with no time while none is known", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    w.t.done();
  });
  it("says how long is left by the panel's run of that process, as of when the panel wrote it", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    panel(w, { left: 180 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made, about 3 minutes left. ${AFTER}`));
    // Written a minute ago, with 3 minutes left then: 2 are left now.
    panel(w, { left: 180, updated: w.t.now() - 60000 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made, about 2 minutes left. ${AFTER}`));
    // Written so long ago that the time has run out: none is said.
    panel(w, { left: 180, updated: w.t.now() - 400000 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    w.t.done();
  });
  it("says how long it usually takes by the speed this Mac measured, when the panel says none, and the panel's time before it", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    speeds(w, 10);
    // 10 seconds of work for each second of the recording's 23.423: 234 seconds, about 4 minutes.
    assert.equal(await line(w), says(`The video for HyperFrames is being made. It usually takes about 4 minutes. ${AFTER}`));
    panel(w, { left: 20 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made, less than a minute left. ${AFTER}`));
    // The panel's run of another live process (process 1 sorts before any other) says nothing of this one, whether this one's is there or not.
    w.t.ctx.deps.alive = (pid) => pid === process.pid || pid === 1;
    panel(w, { pid: 1, left: 600 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made, less than a minute left. ${AFTER}`));
    rmSync(join(progressFolder(w.t.home), `${process.pid}.json`));
    assert.equal(await line(w), says(`The video for HyperFrames is being made. It usually takes about 4 minutes. ${AFTER}`));
    w.t.done();
  });
  it("says no usual time while the run waits for the import to check its copies: it has not begun (review I3a)", async () => {
    const w = guideWorld({ kind: "short video", projects: null });
    atWork(w.t, "workcopy");
    // 1 second of work for each second of the recording's 23: the usual time would be "less than a minute", of a run that waits.
    speeds(w, 1);
    panel(w, { step: WORK_COPY_WAIT_STEP, n: null, of: null, percent: null, left: null, total: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    // Nor before its first step has begun, when its panel still says it is starting.
    panel(w, { step: "Starting", n: null, of: 1, percent: null, left: null, total: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    // Once it makes the copy, with no time of its own yet, the usual time stands.
    panel(w, { percent: null, left: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. It usually takes less than a minute. ${AFTER}`));
    w.t.done();
  });
  it("says no usual time of a Reel's video, which shares the lock, has two steps, and is not the recording's length (review I3b)", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    speeds(w, 10);
    // Step 1 of 2 with 8 seconds left of it and no total: the time left is dropped, and the main video's usual time must not stand in for it.
    panel(w, { n: 1, of: 2, percent: 90, left: 8, total: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    // Just begun, with no time of its own: still not the main video's.
    panel(w, { n: 1, of: 2, percent: null, left: null, total: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    w.t.done();
  });
  it("says no usual time once the panel's own time has run out: at the end of the run, or long after the panel wrote it (review I3c)", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    speeds(w, 10);
    panel(w, { percent: 100, left: 0 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    panel(w, { left: 180, updated: w.t.now() - 400000 });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. ${AFTER}`));
    // Before it has said any time (ffmpeg has not said how far it is), the usual time stands.
    panel(w, { percent: null, left: null });
    assert.equal(await line(w), says(`The video for HyperFrames is being made. It usually takes about 4 minutes. ${AFTER}`));
    w.t.done();
  });
  it("is not making it for a lock a dead process left, the reading's lock, or another episode's working copy", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    w.t.ctx.deps.alive = () => false;
    assert.equal(await line(w), says(OPEN));
    // The episode's own lock is the reading's, and a run of another episode has a lock of its own.
    w.t.ctx.deps.alive = (pid) => pid === process.pid;
    rmSync(workCopyLockOf(w.t.home, FOLDER));
    assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "read", () => true).taken, true);
    const other = "2026-10-14 Other talk (Mac Studio)";
    mkdirSync(dirname(workCopyLockOf(w.t.home, other)), { recursive: true });
    assert.equal(takeEpisodeLock(workCopyLockOf(w.t.home, other), "workcopy", () => true).taken, true);
    assert.equal(await line(w), says(OPEN));
    w.t.done();
  });
  it("is not making it once a project is here: a Reel's video at work beside it is not the main video's", async () => {
    const w = guideWorld();
    atWork(w.t, "workcopy");
    assert.equal(await line(w), says(edit()));
    w.t.done();
  });
  it("comes after the reading and the spellings, which are still first", async () => {
    const reading = guideWorld({ projects: null, over: { reading: null, offers: undefined } });
    atWork(reading.t, "workcopy");
    assert.equal(await line(reading), says('Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'));
    const spellings = guideWorld({ projects: null, over: { offers: { spellings: [] } } });
    atWork(spellings.t, "workcopy");
    assert.equal(await line(spellings), says('Claude has read it. Say "what did Claude find?", then answer the spellings card.'));
    reading.t.done();
    spellings.t.done();
  });
});

describe("the guide while a video is in HyperFrames", () => {
  it("gives the time of her last request there: today, yesterday, or an older day, in the zone it is given, and the last by its time", async () => {
    for (const [turns, last] of [
      [["2026-10-20T14:41:00-05:00"], "today at 2:41 pm"],
      [["2026-10-19T14:41:00-05:00"], "yesterday at 2:41 pm"],
      [["2026-10-13T14:41:00-05:00"], "on Tuesday 13 October at 2:41 pm"],
      // The file is not in order: the last turn is the latest, not the last line.
      [["2026-10-13T14:41:00-05:00", "2026-10-19T14:41:00-05:00", "2026-10-16T09:00:00-05:00"], "yesterday at 2:41 pm"]
    ]) {
      const w = guideWorld();
      history(w, ...turns);
      assert.equal(await line(w), says(edit(last)), turns.join());
      w.t.done();
    }
  });
  it("gives no time when the app has kept no history, or none that can be read", async () => {
    const none = guideWorld();
    assert.equal(await line(none), says(edit()));
    const junk = guideWorld();
    mkdirSync(join(junk.dirOf("main"), ".hyperframes"), { recursive: true });
    writeFileSync(join(junk.dirOf("main"), ".hyperframes", "app-history.jsonl"), 'not json\n{"at":"yesterday-ish","asked":"x"}\n\n');
    assert.equal(await line(junk), says(edit()));
    none.t.done();
    junk.t.done();
  });
  it("sends her to open it when the record lists no time the app opened it, and when the project's folder is not here", async () => {
    const never = guideWorld({ over: { app: { toolchain: PIN.version, projects: [entry("main", { opened: [], state: "made" })] } } });
    assert.equal(await line(never), says(OPEN));
    const gone = guideWorld();
    rmSync(gone.dirOf("main"), { recursive: true });
    assert.equal(await line(gone), says(OPEN));
    // The folder is gone and its video is being made again: that is said first.
    atWork(gone.t, "workcopy");
    assert.equal(await line(gone), says(`The video for HyperFrames is being made. ${AFTER}`));
    never.t.done();
    gone.t.done();
  });
});

describe("the guide once a video is exported from HyperFrames", () => {
  it("says so when Downloads holds an export of the project that began after its last change, with the app's record of it or without", async () => {
    for (const record of [true, false]) {
      const w = guideWorld();
      exportOf(w, "main", { record });
      assert.equal(await line(w), says(EXPORTED), `record ${record}`);
      w.t.done();
    }
  });
  it("says so for a project the record lists no time the app opened, and not for one she changed after exporting it", async () => {
    const quiet = guideWorld({ over: { app: { toolchain: PIN.version, projects: [entry("main", { opened: [], state: "made" })] } } });
    exportOf(quiet, "main");
    assert.equal(await line(quiet), says(EXPORTED));
    // A request in the app after the export: the export is older than the project's last change.
    const after = guideWorld();
    exportOf(after, "main");
    history(after, "2026-10-20T14:41:00-05:00");
    assert.equal(await line(after), says(edit("today at 2:41 pm")));
    quiet.t.done();
    after.t.done();
  });
  it("does not say so for an export that began before the last change, a WebM, another project's export, or a Reel's alone", async () => {
    const early = guideWorld();
    exportOf(early, "main", { start: [13, 30, 0] });
    const named = guideWorld();
    exportOf(named, "main", { start: [13, 30, 0], record: false });
    const webm = guideWorld();
    exportOf(webm, "main", { ending: "webm" });
    const other = guideWorld();
    exportOf(other, "main", { name: "Other talk main 3fa9c1 2026-10-20 13.56.mp4", record: false });
    const reel = guideWorld({ projects: ["main", "reel 2"] });
    exportOf(reel, "reel 2");
    for (const w of [early, named, webm, other, reel]) {
      assert.equal(await line(w), says(edit()));
      w.t.done();
    }
  });
  it("says so when two exports of the main video began in one minute, after the last change: finish asks which is final (review M1)", async () => {
    for (const [what, make] of [
      ["an MP4 and a MOV", (w) => { exportOf(w, "main", { record: false }); exportOf(w, "main", { ending: "mov", record: false }); }],
      ["a file and the copy of it the system numbered", (w) => { exportOf(w, "main", { record: false }); exportOf(w, "main", { name: `${w.names.main} 2026-10-20 13.56 (1).mp4`, record: false }); }],
      ["an MP4 the app's record names and a MOV it does not", (w) => { exportOf(w, "main"); exportOf(w, "main", { ending: "mov", record: false }); }]
    ]) {
      const w = guideWorld();
      make(w);
      assert.equal(await line(w), says(EXPORTED), what);
      w.t.done();
    }
  });
  it("does not say so when two exports in one minute both began before the project last changed", async () => {
    const w = guideWorld();
    exportOf(w, "main", { start: [13, 30, 0], record: false });
    exportOf(w, "main", { start: [13, 30, 0], ending: "mov", record: false });
    assert.equal(await line(w), says(edit()));
    w.t.done();
  });
  it("does not say so when this Mac will not let Downloads be read", async () => {
    const w = guideWorld();
    exportOf(w, "main");
    const refused = (dir) => {
      throw Object.assign(new Error(`EPERM: operation not permitted, scandir '${dir}'`), { code: "EPERM" });
    };
    assert.equal(await line(w, { readdir: refused }), says(edit()));
    w.t.done();
  });
  it("lists Downloads only for a video that has a main project here and no hand-off written", async () => {
    const looked = [];
    const readdir = (dir) => (looked.push(dir), readdirSync(dir));
    const app = guideWorld();
    exportOf(app, "main");
    assert.equal(await line(app, { readdir }), says(EXPORTED));
    // Downloads, and what the other Mac released into the episode: the two places an export is looked for in, and no other.
    assert.deepEqual(looked, [app.downloads, join(app.found.folder, "edit", "from-hyperframes")]);
    looked.length = 0;
    const none = guideWorld({ projects: null });
    exportOf(none, "main", { record: false });
    assert.equal(await line(none, { readdir }), says(OPEN));
    const written = guideWorld({ over: { finished: FINISHED } });
    handOff(written);
    exportOf(written, "main");
    assert.match(await line(written, { readdir }), /On the BRIMM Ops page: Drag the hand-off onto Episodes/);
    assert.deepEqual(looked, []);
    app.t.done();
    none.t.done();
    written.t.done();
  });
});

describe("the guide for an iPhone clip", () => {
  it("is in HyperFrames once the app has opened its project, and exported with an export", async () => {
    const w = guideWorld({ kind: "short video" });
    history(w, "2026-10-20T14:41:00-05:00");
    assert.equal(await line(w), says(edit("today at 2:41 pm")));
    exportOf(w, "main", { start: [14, 50, 0] });
    assert.equal(await line(w), says(EXPORTED));
    w.t.done();
  });
  it("makes the video for HyperFrames first, on a Mac set up for the app, and otherwise offers what PR 7's F5 offers", async () => {
    const copying = guideWorld({ kind: "short video", projects: null });
    atWork(copying.t, "workcopy");
    assert.equal(await line(copying), says(`The video for HyperFrames is being made. ${AFTER}`));
    const idle = guideWorld({ kind: "short video", projects: null });
    assert.equal(await line(idle), says(CLIP_NEXT));
    const never = guideWorld({ kind: "short video", over: { app: { toolchain: PIN.version, projects: [entry("main", { opened: [], state: "made" })] } } });
    assert.equal(await line(never), says(CLIP_NEXT));
    const off = guideWorld({ kind: "short video", projects: null, set: false });
    assert.equal(await line(off), says('Say "hand it off" to hand it off as it is.'));
    for (const w of [copying, idle, never, off]) w.t.done();
  });
  it("says its finish is running, as for a raw video", async () => {
    for (const kind of ["short video", "raw"]) {
      const w = guideWorld({ kind });
      exportOf(w, "main");
      assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true).taken, true);
      w.t.ctx.deps.alive = (pid) => pid === process.pid;
      assert.equal(await line(w), says(FINISH_RUNNING), kind);
      w.t.done();
    }
  });
});

describe("the guide for a video the gate holds as a session, though its kind is not one (plan PR 10, review I2)", () => {
  /** A session's mark, not cleared: what a Dropbox conflict or a hand edit can leave on a record of another kind. */
  const MARKED = { marked: "2026-10-20T08:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
  const CLEAR = 'It is held as a client or group session. If it is not one, say "clear the session mark".';
  /** A `readdir` that writes down the folders it is asked to list. */
  const spy = () => {
    const looked = [];
    return { looked, readdir: (dir) => (looked.push(dir), readdirSync(dir)) };
  };
  for (const kind of ["raw", "short video", "finished"]) {
    for (const app of [true, false]) {
      it(`tells a ${kind} video how to clear the mark, whether it has no project, a project here, or an export too, on a Mac whose settings have the app ${app ? "on" : "off"}; nothing of HyperFrames or Final Cut, and Downloads not listed`, async () => {
        for (const [what, projects, exported] of [["no project", null, false], ["a project here", ["main"], false], ["a project and an export in Downloads", ["main"], true]]) {
          const w = guideWorld({ kind, projects, set: app, over: { session: MARKED } });
          if (exported) exportOf(w, "main");
          const { looked, readdir } = spy();
          const said = await line(w, { readdir });
          const [name, ...rest] = said.split("): ");
          assert.match(`${name})`, /\(3fa9c1\)$/, said);
          assert.equal(rest.join("): "), CLEAR, `${what}: ${said}`);
          assert.doesNotMatch(said, /HyperFrames|Final Cut/, what);
          assert.deepEqual(looked, [], `${what}: Downloads was listed`);
          w.t.done();
        }
      });
    }
  }
  it("says the BRIMM Ops page's step once its hand-off is written, as it did, and a video held beside a session is held and nothing of it is read", async () => {
    const written = guideWorld({ over: { session: MARKED, finished: FINISHED } });
    handOff(written);
    assert.match(await line(written), /On the BRIMM Ops page: Drag the hand-off onto Episodes/);
    // A session that is a version of the video: the video is held beside it, and is not a session itself.
    const w = guideWorld();
    exportOf(w, "main");
    episodeAs(w.t, { id: "e-20261020-a2a2a2", name: "2026-10-20 Group call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: MARKED, versionOf: ID, imported: { on: "Mac Studio", at: "2026-10-20T10:00:00-05:00" } } });
    const { looked, readdir } = spy();
    const said = await line(w, { readdir });
    assert.match(said, /^a video \(3fa9c1\): One of its other versions is a client or group session\. Say "it was a session after all" for this one too\.$/);
    assert.deepEqual(looked, []);
    written.t.done();
    w.t.done();
  });
});

describe("the guide waits while the video for HyperFrames is made", () => {
  it("waits in steps of 5 seconds, and says the overview once the video is made", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    const wait = onWait(w, 2, () => rmSync(workCopyLockOf(w.t.home, FOLDER)));
    const r = await on(depsOf(w, { wait }), "guide", "wait");
    assert.deepEqual(r.said, [DROP_LINE, "Under way:", `  ${NAMED}: ${OPEN}`]);
    assert.deepEqual(w.t.waits, [5000, 5000]);
    w.t.done();
  });
  it("gives up after 90 seconds when nothing changes, and answers at once for a video in HyperFrames", async () => {
    const copying = guideWorld({ projects: null });
    atWork(copying.t, "workcopy");
    const r = await on(depsOf(copying), "guide", "wait");
    assert.equal(r.said[0], "Nothing has changed in 90 seconds.");
    assert.deepEqual(r.said.slice(1), [DROP_LINE, "Under way:", `  ${NAMED}: The video for HyperFrames is being made. ${AFTER}`]);
    assert.deepEqual(copying.t.waits, Array(18).fill(5000));
    const editing = guideWorld();
    const at = await on(depsOf(editing), "guide", "wait");
    assert.deepEqual(at.said, [DROP_LINE, "Under way:", `  ${NAMED}: ${edit()}`]);
    assert.deepEqual(editing.t.waits, []);
    copying.t.done();
    editing.t.done();
  });
  it("tells her in one line, when asked to, that it is done: its next step, and never a file's name", async () => {
    const w = guideWorld({ projects: null });
    atWork(w.t, "workcopy");
    const wait = onWait(w, 2, () => rmSync(workCopyLockOf(w.t.home, FOLDER)));
    const r = await on(depsOf(w, { wait }), "guide", "3fa9c1", "tell");
    assert.deepEqual(r, { code: 0, said: [says(OPEN)], text: says(OPEN) });
    assert.deepEqual(w.t.waits, [15000, 15000]);
    assert.doesNotMatch(r.text, /\.mp4|\.mov|Pricing talk\./);
    w.t.done();
  });
});

describe("the speed of the working copy", () => {
  it("is learned by a run that finishes, and the guide says how long the next one usually takes by it", async () => {
    const c = copyWorld({ record: { ...RAW_RECORD, reading: READ("raw"), offers: OFFERS } });
    let tick = 0;
    c.t.ctx.deps.progress = reporter({ folder: progressFolder(c.t.home), swift: "", now: () => (tick += 1000), pid: 4242 });
    const ran = await on(c.t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(ran.code, 0, ran.text);
    const speed = readRates(progressFolder(c.t.home))[COPY_STEP];
    assert.ok(speed > 0, String(speed));
    // The next run holds the lock, and the guide says how long it usually takes.
    atWork(c.t, "workcopy");
    const deps = { ...c.t.ctx.deps, settings: { ...c.t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2, app: "hyperframes" } };
    const usual = aboutLeft(Math.round(speed * reread(c.found).video.seconds));
    assert.equal((await on(deps, "guide", "3fa9c1")).said[0], says(`The video for HyperFrames is being made. It usually takes ${usual}. ${AFTER}`));
    c.t.done();
  });
});

describe("what says the guide's new states: the help and the README (the skills' words are studio.test.js's)", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const row = (start) => readme.split("\n").find((text) => text.startsWith(start)) ?? "";
  it("has the help say that a raw video and an iPhone clip are followed through HyperFrames, and what the wait and the tell wait for", () => {
    const guide = HELP.slice(HELP.indexOf('node edit.js guide ["<video>"]'), HELP.indexOf('node edit.js kind "<video>"'));
    for (const words of [
      "A raw video and an iPhone clip are followed through HyperFrames", "while its video is made, how long is left", "then to open it there", "when she last asked the app for something",
      "and once it is exported, to hand it off", "A raw video that goes the Final Cut way keeps its Final Cut steps",
      "being imported, being read or having its video for HyperFrames made", "its video for HyperFrames made, or an import or reading that did not finish"
    ]) assert.ok(guide.replace(/\n {40}/g, " ").includes(words), words);
  });
  it("has the README's rows for guide say the same: the stages, the times and where they come from, the Final Cut way's until wave 4, and that it only reads", () => {
    const first = row('| `guide ["<video>"]`');
    for (const words of [
      "followed through HyperFrames (plan PR 10)", "Making the video for HyperFrames", "how long is left", "usually takes", ".hyperframes/app-history.jsonl", "the time of her last request there",
      "export on This Mac", "an export that began after its last change", "Final Cut way", "until the retirement's wave 4", "These only read, and write nothing",
      "is told to clear the mark, and nothing of HyperFrames or Final Cut is said or read for it"
    ]) assert.ok(first.includes(words), words);
    assert.ok(row("| `guide drop [zoom]").includes("being imported, being read or having its video for HyperFrames made"));
    assert.ok(row('| `guide "<video>" done').includes("Its video for HyperFrames being made is waited for too, and ends with its next step; no notice is posted for it"));
    assert.ok(row("| `tool/guide.js`, `tool/guide-note.js`").includes("where a raw video and an iPhone clip are in HyperFrames"));
  });
});

/** Run a scenario of pipe-scenario.mjs in a child process with a time limit for the command it runs, which starts once the child says READY
    (the episode is made then, and the pipe), so that a loaded Mac's slow start costs nothing. Gives { hung, code, said } of its answer, or
    { hung: true, stage } when the command did not answer in `limit` milliseconds, or { hung: false, exited, err } when the child ended with
    none. The child is killed whatever happens, and its temporary folder taken away. */
function inChild(what, command, { limit = 20000, start = 240000 } = {}) {
  return new Promise((resolve) => {
    const tmp = mkdtempSync(join(tmpdir(), "brimm-pipes-"));
    const child = spawn(process.execPath, [fileURLToPath(new URL("./pipe-scenario.mjs", import.meta.url)), what, command], { env: { ...process.env, TMPDIR: tmp }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let ready = false;
    let over = false;
    let timer = null;
    const end = (result) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      rmSync(tmp, { recursive: true, force: true });
      resolve(result);
    };
    timer = setTimeout(() => end({ hung: true, stage: "before the command" }), start);
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (!ready && out.includes("READY\n")) {
        ready = true;
        clearTimeout(timer);
        timer = setTimeout(() => end({ hung: true, stage: "in the command" }), limit);
      }
      const got = /^RESULT (.*)$/m.exec(out);
      if (got) end({ hung: false, ...JSON.parse(got[1]) });
    });
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (exited) => end({ hung: false, exited, err }));
  });
}

describe("a file the app keeps that is a named pipe, where a reader that waits for a writer would wait for good (plan PR 10, review I1)", () => {
  const MAIN_EXPORT = /^The main video: Pricing- what to charge- main 3fa9c1 2026-10-20 13\.56\.mp4, from Downloads, exported 2026-10-20 13:56\.$/;
  it("answers `guide` when the app's history is a pipe: no time of a last request, and the export still found", async () => {
    const got = await inChild("history", "guide");
    assert.equal(got.hung, false, `${got.stage}`);
    assert.deepEqual([got.code, got.said], [0, [says(EXPORTED)]], JSON.stringify(got));
  });
  it("answers `guide` when an export's record in renders/ is a pipe: passed over, and the export found by its name", async () => {
    const got = await inChild("record", "guide");
    assert.equal(got.hung, false, `${got.stage}`);
    assert.deepEqual([got.code, got.said], [0, [says(EXPORTED)]], JSON.stringify(got));
  });
  it("answers `finish` when the app's history is a pipe, as it answers without one", async () => {
    const got = await inChild("history", "finish");
    assert.equal(got.hung, false, `${got.stage}`);
    assert.equal(got.code, 0, JSON.stringify(got));
    assert.match(got.said[0], MAIN_EXPORT);
    assert.equal(got.said.at(-1), 'Say "yes, hand it off" to start.');
  });
  it("answers `finish` when an export's record in renders/ is a pipe", async () => {
    const got = await inChild("record", "finish");
    assert.equal(got.hung, false, `${got.stage}`);
    assert.equal(got.code, 0, JSON.stringify(got));
    assert.match(got.said[0], MAIN_EXPORT);
    assert.equal(got.said.at(-1), 'Say "yes, hand it off" to start.');
  });
});

describe("the guide reads and writes nothing of the video's", () => {
  const contents = (dir) => Object.fromEntries(listAll(dir).map((file) => [file, readFileSync(join(dir, file), "utf8")]));
  const snapshot = (w) => [reread(w.found).rev, listAll(w.found.folder), contents(w.work), contents(w.downloads), contents(progressFolder(w.t.home))];
  it("leaves the record, the project, Downloads and the panel's files as they were, in every state", async () => {
    const editing = guideWorld();
    history(editing, "2026-10-20T14:41:00-05:00");
    exportOf(editing, "main", { start: [14, 50, 0] });
    const copying = guideWorld({ projects: null });
    atWork(copying.t, "workcopy");
    panel(copying, { left: 180 });
    speeds(copying, 10);
    for (const w of [editing, copying]) {
      const before = snapshot(w);
      for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", "wait"], ["guide", "3fa9c1", "show"]]) await on(depsOf(w, { wait: onWait(w, 99, () => {}) }), ...argv);
      assert.deepEqual(snapshot(w), before);
      w.t.done();
    }
  });
});
