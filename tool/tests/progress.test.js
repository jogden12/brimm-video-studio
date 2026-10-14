// How far a run has got, for the progress panel: the file each run writes, what ffmpeg says of an encode, the time left, and
// starting the panel. A clock, a timer and a way of starting a program are given to the reporter, so nothing here waits, and
// no panel is ever shown: the panel itself is run only with --print, at the end, on a Mac that has swift.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { progressFolder, PANEL, PANEL_PID, RATES, ffmpegProgress, aboutLeft, detailOf, readRates, blended, reporter, noProgress } from "../progress.js";

/** One test's progress folder, a clock that moves only when told, a timer whose ticks a test runs by hand, a stand-in for
    starting a program, and what the log said. */
function setup({ swift = "", alive = () => false, bootedAt } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-progress-"));
  const folder = join(dir, "progress");
  const clock = { t: 1_000_000 };
  const ticks = [];
  const cancelled = [];
  const started = [];
  const logs = [];
  const start = (cmd, args, options) => {
    started.push({ cmd, args, options });
    const child = new EventEmitter();
    child.unref = () => {};
    return child;
  };
  const r = reporter({ folder, swift, log: (line) => logs.push(line), pid: 4242, now: () => clock.t, start, alive, ...(bootedAt === undefined ? {} : { bootedAt }), timer: { every: (fn) => (ticks.push(fn), ticks.length), cancel: (h) => cancelled.push(h) } });
  const file = () => JSON.parse(readFileSync(join(folder, "4242.json"), "utf8"));
  return { dir, folder, clock, ticks, cancelled, started, logs, r, file, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("what ffmpeg writes with -progress", () => {
  it("says how many seconds it has written, by its last block, and whether it has ended", () => {
    const block = (us, end = false) => `frame=1\nout_time_us=${us}\nout_time_ms=${us}\nout_time=00:00:00.000000\nspeed=1x\nprogress=${end ? "end" : "continue"}\n`;
    assert.deepEqual(ffmpegProgress(""), { seconds: 0, ended: false });
    assert.deepEqual(ffmpegProgress(block("N/A")), { seconds: 0, ended: false });
    assert.deepEqual(ffmpegProgress(block(1500000) + block(4100000)), { seconds: 4.1, ended: false });
    assert.deepEqual(ffmpegProgress(block(3000000) + block(3000000, true)), { seconds: 3, ended: true });
  });
});

describe("how long is left, as a person says it", () => {
  it("is in minutes, and in hours and minutes from an hour", () => {
    assert.deepEqual([20, 60, 90, 600, 3600, 3900, 7260].map(aboutLeft), ["less than a minute", "about 1 minute", "about 2 minutes", "about 10 minutes", "about 1 hour", "about 1 hour 5 minutes", "about 2 hours 1 minute"]);
  });
  it("is said after the step, its number of how many and how far it has got, each part only when it is known", () => {
    assert.equal(detailOf({ step: "Writing the transcript", n: 2, of: 8, percent: null, left: null, total: null }), "Writing the transcript (step 2 of 8)");
    assert.equal(detailOf({ step: "Making the upright version", n: 7, of: 8, percent: 42, left: 190, total: 260 }), "Making the upright version (step 7 of 8), 42%, about 3 minutes left, about 4 minutes left in all");
    assert.equal(detailOf({ step: "Starting", n: null, of: null, percent: null, left: null, total: null }), "Starting");
  });
});

describe("a run's progress file", () => {
  it("is kept on this Mac's own disk, in Application Support, and never in Dropbox", () => {
    assert.equal(progressFolder("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/progress");
  });
  it("says the video, the step and its number of how many, and has no percent until a step says how far it has got", () => {
    const t = setup();
    t.r.begin("talk.mov");
    t.r.steps(["Reading the sound", "Writing the transcript"]);
    t.clock.t += 2000;
    t.r.step("Reading the sound");
    assert.deepEqual(t.file(), { version: 1, pid: 4242, video: "talk.mov", step: "Reading the sound", n: 1, of: 2, percent: null, left: null, total: null, detail: "Reading the sound (step 1 of 2)", started: 1_000_000, updated: 1_002_000 });
    t.r.step("Cutting the short clips", "Cutting short clip 1 of 2");
    assert.deepEqual([t.file().step, t.file().n], ["Cutting short clip 1 of 2", null]);
    t.done();
  });
  it("says how far an encode has got and how long is left of it, from what ffmpeg writes, at most once a second", () => {
    const t = setup();
    t.r.begin("talk.mov");
    t.r.steps(["Making the rough cut", "Making the upright version"]);
    t.r.step("Making the rough cut");
    const watch = t.r.encoding(100);
    assert.deepEqual(watch.args, ["-progress", join(t.folder, "4242.ffmpeg.txt")]);
    assert.equal(t.ticks.length, 1);
    // Thirty seconds in, ffmpeg has written 25 of the 100 seconds: 90 seconds are left, by the rate so far.
    t.clock.t += 30_000;
    writeFileSync(watch.args[1], "out_time_us=25000000\nprogress=continue\n");
    t.ticks[0]();
    assert.deepEqual([t.file().percent, t.file().left, t.file().detail], [25, 90, "Making the rough cut (step 1 of 2), 25%, about 2 minutes left"]);
    // Within the same second the file is not written again.
    writeFileSync(watch.args[1], "out_time_us=30000000\nprogress=continue\n");
    t.ticks[0]();
    assert.equal(t.file().percent, 25);
    t.clock.t += 1000;
    t.ticks[0]();
    assert.equal(t.file().percent, 30);
    // ffmpeg has ended: the timer stops, and its file is taken away.
    watch.stop();
    assert.deepEqual([t.cancelled, existsSync(watch.args[1])], [[1], false]);
    t.done();
  });
  it("keeps the bar moving with no number until ffmpeg says how far it has got, and fills it when ffmpeg says it has ended", () => {
    const t = setup();
    t.r.begin("talk.mov");
    t.r.step("Making the rough cut");
    const watch = t.r.encoding(100);
    t.clock.t += 5000;
    t.ticks[0]();
    writeFileSync(watch.args[1], "out_time_us=N/A\nprogress=continue\n");
    t.clock.t += 1000;
    t.ticks[0]();
    assert.equal(t.file().percent, null);
    writeFileSync(watch.args[1], "out_time_us=N/A\nprogress=end\n");
    t.clock.t += 1000;
    t.ticks[0]();
    assert.equal(t.file().percent, 100);
    watch.stop();
    t.done();
  });
  it("is one file for each run, so two runs at once on this Mac, as the launch agent's and one by hand, each have a bar, and one panel", () => {
    const t = setup({ swift: "/usr/bin/swift", alive: (pid) => pid === 4242 });
    const other = reporter({ folder: t.folder, swift: "/usr/bin/swift", pid: 5151, now: () => t.clock.t, start: (cmd, args, options) => { t.started.push({ cmd, args, options }); return Object.assign(new EventEmitter(), { unref() {} }); }, alive: () => true });
    t.r.begin("a.mov");
    writeFileSync(join(t.folder, PANEL_PID), "4242");
    other.begin("b.mov");
    assert.deepEqual(readdirSync(t.folder).filter((n) => n.endsWith(".json")).sort(), ["4242.json", "5151.json"]);
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("writes a video's name as it is, whatever characters are in it", () => {
    const t = setup();
    const name = 'Sallie\'s "talk" #1 & 100% \u{1F600}\n.mov';
    t.r.begin(name);
    assert.equal(t.file().video, name);
    t.done();
  });
  it("gives ffmpeg nothing more to do for a file of no length, and nothing before a video is begun", () => {
    const t = setup();
    assert.deepEqual(t.r.encoding(100).args, []);
    t.r.begin("talk.mov");
    assert.deepEqual(t.r.encoding(0).args, []);
    assert.equal(t.ticks.length, 0);
    t.done();
  });
  it("is taken away when the video is done", () => {
    const t = setup();
    t.r.begin("talk.mov");
    t.r.step("Reading the sound");
    t.r.end();
    assert.deepEqual(readdirSync(t.folder), []);
    t.done();
  });
  it("never stops a run: when it cannot be written the log says so once, and nothing is thrown", () => {
    const t = setup({ swift: "/usr/bin/swift" });
    // A file is where the folder would be.
    writeFileSync(t.folder, "not a folder");
    t.r.begin("a.mov");
    t.r.steps(["Reading the sound"]);
    t.r.step("Reading the sound");
    assert.deepEqual(t.r.encoding(10).args, []);
    t.r.fraction(0.5);
    t.r.end();
    // macOS says EEXIST of a folder that cannot be made where a file is, and other systems may say ENOTDIR.
    assert.equal(t.logs.length, 1);
    assert.match(t.logs[0], /^The progress panel's file could not be written \((EEXIST|ENOTDIR)\)\. The work goes on without it\.$/);
    t.done();
  });
  it("gives ffmpeg nothing more to do when the folder is there but cannot be written, which would stop every encode", () => {
    const t = setup({ swift: "/usr/bin/swift" });
    mkdirSync(t.folder, { recursive: true });
    chmodSync(t.folder, 0o500);
    try {
      t.r.begin("a.mov");
      t.r.step("Making the rough cut");
      assert.deepEqual(t.r.encoding(10).args, []);
      assert.equal(t.ticks.length, 0);
      assert.equal(t.logs.length, 1);
      assert.match(t.logs[0], /^The progress panel's file could not be written \(EACCES\)\. The work goes on without it\.$/);
    } finally {
      chmodSync(t.folder, 0o700);
      t.done();
    }
  });
  it("says nothing, and does nothing, when the run is given the reporter that says nothing", () => {
    for (const call of ["begin", "length", "steps", "step", "fraction", "end"]) assert.equal(noProgress[call]("x"), undefined);
    assert.deepEqual(noProgress.encoding(100).args, []);
  });
});

describe("the time left in all", () => {
  it("is said once a run on this Mac has measured every step still to come, from what each step took for each second of video", () => {
    const t = setup();
    // The first run measures: 20 seconds of reading and 30 of transcribing, for 100 seconds of video.
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Reading the sound", "Writing the transcript"]);
    t.r.step("Reading the sound");
    assert.equal(t.file().total, null);
    t.clock.t += 20_000;
    t.r.step("Writing the transcript");
    t.clock.t += 30_000;
    t.r.end(true);
    assert.deepEqual(readRates(t.folder), { "Reading the sound": 0.2, "Writing the transcript": 0.3 });
    // The next run, of a video of 200 seconds, is told about 100 seconds in all at its start: 40 of reading and 60 of the
    // transcript.
    t.r.begin("b.mov");
    t.r.length(200);
    t.r.steps(["Reading the sound", "Writing the transcript"]);
    t.r.step("Reading the sound");
    assert.equal(t.file().total, 100);
    assert.equal(t.file().detail, "Reading the sound (step 1 of 2), about 2 minutes left in all");
    // Ten seconds in, 30 of reading are left by the rate, and the transcript's 60.
    t.clock.t += 10_000;
    t.r.fraction(0.25);
    assert.equal(t.file().total, 90);
    t.done();
  });
  it("is measured from every step of a video whose work finished, however short a step was, so the next run can say it", () => {
    const t = setup();
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Making the cut plan", "Making the rough cut"]);
    t.r.step("Making the cut plan");
    t.clock.t += 200;
    t.r.step("Making the rough cut");
    t.clock.t += 3000;
    t.r.end(true);
    assert.deepEqual(readRates(t.folder), { "Making the cut plan": 0.002, "Making the rough cut": 0.03 });
    t.r.begin("b.mov");
    t.r.length(100);
    t.r.steps(["Making the cut plan", "Making the rough cut"]);
    t.r.step("Making the cut plan");
    assert.equal(t.file().total, 3);
    t.done();
  });
  it("is not measured from a video whose work did not finish, as when ffmpeg stopped at once, which would make it look shorter", () => {
    const t = setup();
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Making the rough cut", "Filing"]);
    t.r.step("Making the rough cut");
    t.clock.t += 200;
    t.r.step("Filing");
    t.clock.t += 3000;
    t.r.end(false);
    assert.deepEqual(readRates(t.folder), {});
    t.done();
  });
  it("is not said on the last step, where it would only say again how long is left of that step", () => {
    const t = setup();
    mkdirSync(t.folder, { recursive: true });
    writeFileSync(join(t.folder, RATES), JSON.stringify({ "Making the rough cut": 0.2 }));
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Making the rough cut"]);
    t.r.step("Making the rough cut");
    t.clock.t += 10_000;
    t.r.fraction(0.5);
    assert.deepEqual([t.file().left, t.file().total, t.file().detail], [10, null, "Making the rough cut (step 1 of 1), 50%, less than a minute left"]);
    t.done();
  });
  it("is not said while a step still to come has never been measured", () => {
    const t = setup();
    writeFileSync((mkdirSync(t.folder, { recursive: true }), join(t.folder, RATES)), JSON.stringify({ "Reading the sound": 0.2 }));
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Reading the sound", "Asking Claude"]);
    t.r.step("Reading the sound");
    assert.equal(t.file().total, null);
    t.done();
  });
  it("follows the Mac, the newest measure counting for half, and reads nothing it cannot", () => {
    assert.deepEqual([blended(undefined, 0.3), blended(0.2, 0.3)], [0.3, 0.25]);
    const t = setup();
    assert.deepEqual(readRates(t.folder), {});
    mkdirSync(t.folder, { recursive: true });
    writeFileSync(join(t.folder, RATES), "[]");
    assert.deepEqual(readRates(t.folder), {});
    t.done();
  });
});

describe("files left by runs that have gone", () => {
  const anHourAgo = () => (Date.now() - 3_600_000) / 1000;
  it("are taken away when a video begins: a run's file whose process has gone, or that was written before this Mac last started", () => {
    const t = setup({ alive: (pid) => pid === 555 || pid === 4243, bootedAt: Date.now() - 60_000 });
    mkdirSync(t.folder, { recursive: true });
    for (const name of ["999.json", "999.ffmpeg.txt", "555.json", "4243.json", RATES]) writeFileSync(join(t.folder, name), "{}");
    // 555 is a running process now, but its file was written before the restart: the number belongs to another program.
    utimesSync(join(t.folder, "555.json"), anHourAgo(), anHourAgo());
    t.r.begin("a.mov");
    assert.deepEqual(readdirSync(t.folder).sort(), ["4242.json", "4243.json", RATES]);
    t.done();
  });
  it("include a panel's number written before this Mac last started: the panel is started though that number now runs", () => {
    const t = setup({ swift: "/usr/bin/swift", alive: () => true, bootedAt: Date.now() - 60_000 });
    mkdirSync(t.folder, { recursive: true });
    writeFileSync(join(t.folder, PANEL_PID), "77");
    utimesSync(join(t.folder, PANEL_PID), anHourAgo(), anHourAgo());
    t.r.begin("a.mov");
    assert.equal(t.started.length, 1);
    t.done();
  });
});

describe("the panel", () => {
  it("is started when a video is begun, on its own and never waited for, with the folder of progress files", () => {
    const t = setup({ swift: "/usr/bin/swift" });
    t.r.begin("a.mov");
    assert.deepEqual(t.started, [{ cmd: "/usr/bin/swift", args: [PANEL, t.folder], options: { detached: true, stdio: "ignore" } }]);
    t.done();
  });
  it("is not started again while one is showing, by the number of its process in panel.pid", () => {
    const t = setup({ swift: "/usr/bin/swift", alive: (pid) => pid === 77 });
    mkdirSync(t.folder, { recursive: true });
    writeFileSync(join(t.folder, PANEL_PID), "77");
    t.r.begin("a.mov");
    assert.deepEqual(t.started, []);
    assert.deepEqual(t.logs, ["A progress panel is showing already (process 77), and this run's bar goes into it."]);
    writeFileSync(join(t.folder, PANEL_PID), "78");
    t.r.begin("b.mov");
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("is not shown without swift, and one that cannot be started is said once in the log, and nothing is thrown", () => {
    const none = setup();
    none.r.begin("a.mov");
    none.r.begin("b.mov");
    assert.deepEqual([none.started, none.logs], [[], ["No progress panel is shown: swift, which draws it, is not installed."]]);
    none.done();
    const t = setup({ swift: "/usr/bin/swift" });
    const r = reporter({ folder: t.folder, swift: "/usr/bin/swift", log: (line) => t.logs.push(line), now: () => 0, start: () => { throw Object.assign(new Error("spawn EAGAIN"), { code: "EAGAIN" }); } });
    r.begin("a.mov");
    r.begin("b.mov");
    assert.deepEqual(t.logs, ["The progress panel could not be shown (EAGAIN). The work goes on without it."]);
    t.done();
  });
});

describe("progress.swift, the panel itself", () => {
  const cannot = process.platform !== "darwin" ? "the panel is drawn with AppKit, which is only on a Mac"
    : spawnSync("swift", ["--version"]).status !== 0 ? "swift is not installed, so the panel cannot be run" : false;
  it("shows each run whose process is still going, oldest first, and nothing of a run that has gone or a file it cannot read", { skip: cannot }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-panel-"));
    const gone = spawnSync("/usr/bin/true").pid;
    const run = (pid, video, started, more = {}) => writeFileSync(join(dir, `${pid}-${video}.json`), JSON.stringify({ version: 1, pid, video, step: "x", n: 1, of: 2, percent: null, left: null, total: null, detail: `${video} detail`, started, updated: started, ...more }));
    const now = Date.now();
    run(process.pid, "second.mov", now - 2000, { percent: 42 });
    run(process.pid, 'Sallie\'s "third" \u{1F600}.mov', now - 1000, { percent: 7 });
    run(process.pid, "first.mov", now - 3000);
    run(gone, "gone.mov", now - 4000);
    // A running process, but its run's file was written before this Mac last started (1970, here): another program's number.
    run(process.pid, "before the restart.mov", 1000);
    writeFileSync(join(dir, "broken.json"), "{");
    writeFileSync(join(dir, RATES), JSON.stringify({ "Reading the sound": 0.2 }));
    writeFileSync(join(dir, PANEL_PID), "1");
    const r = spawnSync("swift", [PANEL, "--print", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), [
      { video: "first.mov", detail: "first.mov detail" },
      { video: "second.mov", detail: "second.mov detail", percent: 42 },
      { video: 'Sallie\'s "third" \u{1F600}.mov', detail: 'Sallie\'s "third" \u{1F600}.mov detail', percent: 7 }
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});
