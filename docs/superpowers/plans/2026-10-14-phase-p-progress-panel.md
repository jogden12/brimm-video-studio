# Phase P, the progress panel: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the tool starts work on a video, a small window pops up in the top right corner of the screen. It shows a bar for each video being worked on: the step, how far the step has got, and how long is left. Closing the window, or its failing to open, never holds up the work.

**Architecture:** Each run writes one small JSON file about its progress in `~/Library/Application Support/BRIMM Video/progress/`, on the Mac's own disk (`tool/progress.js`). ffmpeg is given `-progress <file>` for every encode, and the run reads that file once a second for the percent. The steps an earlier run took on this Mac give the time left in all. A Swift script, `tool/progress.swift`, run with `swift` the way the face finder is, draws a floating AppKit panel from those files. The tool starts it detached when a video begins, and never waits for it. `tool/unedited.js` tells the reporter each step. Tests give it no reporter, so every existing ffmpeg call stays exactly as it is.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no npm packages. Swift with AppKit (from Xcode's command line tools, already needed for the face finder). ffmpeg's `-progress`.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`, section "Progress while a video is processed" and phase P. The spec is in pull request jogden12/brimm-video#3 and not yet on `main`.

**Status:** On 2026-10-14 Jason asked, through another session, for phase P to start alone. Every other phase waits for the review of the design that session is running. So this plan is built on `main` as it is (c709b57), and depends on nothing from the other phases. One part of the spec's phase P is left out on purpose: the status file in `Episodes/.importing/` for the other Mac. It needs the Episodes folder from phase 1, and the review is reconsidering where that folder goes.

**Checked before it was handed over:** on 2026-10-14 the code and tests of Tasks 1 to 4 were applied, as written here, to a scratch copy of `main` at c709b57. All 558 tests passed on the Mac Studio, the real `swift progress.swift --print` run included. The panel was also started for eight seconds with an empty folder: it compiled with no warning, showed no window, and kept running. Nobody has yet seen the window with a run in it. Task 4 does that by hand.

## Global Constraints

- Node 22 or later. No npm packages. `cd tool && node --test` runs every test.
- Write a failing test first, then the code (CLAUDE.md).
- Nothing is installed on a Mac, and no launch agent is changed. The panel needs only `swift`, which the face finder uses already. The launch agent runs `tool/unedited.js` from the main checkout, so it gets the panel when Jason merges.
- Experiments never write into a watched Dropbox folder. The by-hand check in Task 4 runs on a copy of a recording in a scratch folder.
- Progress files are written only in `~/Library/Application Support/BRIMM Video/progress/`, on the Mac's own disk, never in Dropbox.
- The work never waits on the panel or on a progress file. Nothing in `progress.js` throws. A failure is said once in the log ("…The work goes on without it.").
- No test shows a window. The panel is run in tests only with `--print`, and only on a Mac with `swift`.
- No test runs the real ffmpeg, whisper, Claude or Final Cut: stand-ins only, as now.
- Work in a git worktree (this branch is `claude/phase-p-progress-panel`, from `main`). The main checkout stays on `main`.
- Match the code around it: plain-English JSDoc comments, and messages in whole sentences.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

These are the inputs most likely to bite a person, each pinned by a test in the task that owns it:

1. **Two runs at once on one Mac**, such as the launch agent's and one started by hand. A person expects a bar for each and one window. Pinned in Task 1 ("is one file for each run…").
2. **Awkward characters in a video's name** (quotes, emoji, `&`, `%`, a line break). A person expects the name shown as it is. Pinned in Task 1 ("writes a video's name as it is…") and Task 2 (the `--print` test).
3. **An ffmpeg that writes no progress**, or writes `N/A` at first. A person expects a bar that keeps moving, not one stuck at 0%. Pinned in Task 1 ("keeps the bar moving with no number…").
4. **A step cut short**, as when ffmpeg stops at once. A person expects "left in all" not to drop to a minute because of one failed run. Pinned in Task 1 ("is not measured from a step cut short…").
5. **The panel started from the launch agent.** launchd ends the processes a job leaves behind, and the panel is started in a session of its own (`detached`) so that it survives the run. No automated test can show this. It is the first thing checked by hand after Jason merges ("After the code").

---

## File structure

| File | What it is for | Task |
|---|---|---|
| `tool/progress.js` (new) | The progress file, ffmpeg's progress, the time left, the rates measured on this Mac, starting the panel | 1 |
| `tool/tests/progress.test.js` (new) | Its tests, and at the end the panel's `--print` test | 1, 2 |
| `tool/progress.swift` (new) | The floating panel, and `--print` for the tests | 2 |
| `tool/unedited.js` | Tells the reporter each step. Gives ffmpeg `-progress`. `depsFor` makes the real reporter | 3 |
| `tool/tests/unedited.test.js` | What the panel is told, checked with a stand-in reporter | 3 |
| `README.md` | What the panel is | 4 |

---

### Task 1: `progress.js`, how far a run has got

**Files:**
- Create: `tool/progress.js`
- Test: `tool/tests/progress.test.js`

**Interfaces:**
- Produces, exported from `tool/progress.js`:
  - `progressFolder(home) → string`; the constants `PANEL`, `PANEL_PID` and `RATES`
  - `ffmpegProgress(text) → { seconds, ended }`, `aboutLeft(seconds) → string`, `detailOf({ step, n, of, percent, left, total }) → string`
  - `readRates(folder) → { [step]: secondsPerSecond }`, `blended(old, now) → number`
  - `noProgress`, the reporter that does nothing
  - `reporter({ folder, swift, log, pid?, now?, start?, alive?, timer? }) → { begin(video), length(seconds), steps(names), step(name, shown?), fraction(f), encoding(seconds) → { args, stop() }, end() }`
- The progress file each run writes, `<folder>/<pid>.json`: `{ version: 1, pid, video, step, n, of, percent, left, total, detail, started, updated }`. `percent`, `left` and `total` are `null` when not known. `started` and `updated` are milliseconds since 1970. Task 2's panel reads `version`, `pid`, `video`, `detail`, `percent` and `started`.

- [ ] **Step 1: Write the failing test**

Create `tool/tests/progress.test.js`:

```js
// How far a run has got, for the progress panel: the file each run writes, what ffmpeg says of an encode, the time left, and
// starting the panel. A clock, a timer and a way of starting a program are given to the reporter, so nothing here waits, and
// no panel is ever shown: the panel itself is run only with --print, at the end, on a Mac that has swift.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { progressFolder, PANEL, PANEL_PID, RATES, ffmpegProgress, aboutLeft, detailOf, readRates, blended, reporter, noProgress } from "../progress.js";

/** One test's progress folder, a clock that moves only when told, a timer whose ticks a test runs by hand, a stand-in for
    starting a program, and what the log said. */
function setup({ swift = "", alive = () => false } = {}) {
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
  const r = reporter({ folder, swift, log: (line) => logs.push(line), pid: 4242, now: () => clock.t, start, alive, timer: { every: (fn) => (ticks.push(fn), ticks.length), cancel: (h) => cancelled.push(h) } });
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
    t.r.end();
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
  it("is not measured from a step cut short, as when ffmpeg stopped at once, which would make it look shorter than it is", () => {
    const t = setup();
    t.r.begin("a.mov");
    t.r.length(100);
    t.r.steps(["Making the rough cut", "Filing"]);
    t.r.step("Making the rough cut");
    t.clock.t += 200;
    t.r.step("Filing");
    t.clock.t += 3000;
    t.r.end();
    assert.deepEqual(readRates(t.folder), { Filing: 0.03 });
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/progress.test.js`
Expected: FAIL, with `Cannot find module '…/tool/progress.js'`.

- [ ] **Step 3: Write `tool/progress.js`**

```js
// How far a run of the tool has got, for the progress panel (progress.swift). Each run writes one small file on this Mac's own
// disk, never in Dropbox: the video, the step it is at and its number out of how many, how far the step has got where that is
// known, and how long is left. The panel reads the files and shows a bar for each run. ffmpeg says how far an encode has got
// (its -progress option), and the steps of earlier runs on this Mac say roughly how long the whole run will take.
// Nothing here may hold the work up. A file that cannot be written, or a panel that cannot be started or is closed, changes
// nothing about the run: the log says so once, and the work goes on.
import { spawn } from "node:child_process";
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRunning } from "./run.js";

/** The folder the runs' files are in: in Application Support, on this Mac's own disk. */
export const progressFolder = (home) => join(home, "Library", "Application Support", "BRIMM Video", "progress");
/** The panel, which swift runs. */
export const PANEL = fileURLToPath(new URL("./progress.swift", import.meta.url));
/** The file in the folder that holds the number of the panel's process while one is showing. */
export const PANEL_PID = "panel.pid";
/** The file in the folder that holds what the runs on this Mac have measured: for each step, the seconds it took for each
    second of video. */
export const RATES = "rates.json";
/** How often a run's file is written again while a step goes on, at most, and how often ffmpeg's progress is read: once a
    second. */
const EVERY_MS = 1000;
/** How much of the end of ffmpeg's progress file is read: its last few blocks, each about 300 characters. */
const TAIL = 4096;

/** How far ffmpeg has got, from what it writes with -progress: the seconds of the file it has written so far, by the last
    out_time_us it gave, and whether it has ended. 0 seconds before it has given a time: early blocks say N/A. */
export function ffmpegProgress(text) {
  const times = [...String(text).matchAll(/^out_time_us=(\d+)\s*$/gm)];
  return { seconds: times.length ? Number(times[times.length - 1][1]) / 1e6 : 0, ended: /^progress=end\s*$/m.test(text) };
}

/** A number of seconds as a person says how long is left: "less than a minute", "about 2 minutes", "about 1 hour 5 minutes". */
export function aboutLeft(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} minute${rest === 1 ? "" : "s"}` : ""}`;
}

/** The line the panel shows under a video's name: the step, its number out of how many, how far it has got, how long is left
    of it, and how long is left in all. Each part that is not known is left out. */
export function detailOf({ step, n, of, percent, left, total }) {
  const parts = [`${step}${n && of ? ` (step ${n} of ${of})` : ""}`];
  if (percent != null) parts.push(`${percent}%`);
  if (left != null) parts.push(`${aboutLeft(left)} left`);
  if (total != null) parts.push(`${aboutLeft(total)} left in all`);
  return parts.join(", ");
}

/** What the runs on this Mac have measured, from the folder: {} when there is nothing, or nothing that can be read. */
export function readRates(folder) {
  try {
    const rates = JSON.parse(readFileSync(join(folder, RATES), "utf8"));
    return rates && typeof rates === "object" && !Array.isArray(rates) ? rates : {};
  } catch (e) {
    return {};
  }
}

/** A step shorter than this is not measured: it was cut short, as when ffmpeg stopped at once, and would make the time left
    in all look shorter than it is. */
const SHORTEST_MS = 1000;

/** A rate measured again: the new one counts for half, so the estimate follows the Mac without jumping. */
export const blended = (old, now) => (Number.isFinite(old) ? (old + now) / 2 : now);

/** The last `bytes` of a file as text, or "" when it cannot be read. */
function tail(file, bytes) {
  let fd;
  try {
    fd = openSync(file, "r");
    const size = fstatSync(fd).size;
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } catch (e) {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** A reporter that says nothing: what a run is given when nobody watches it, as in the tests. */
export const noProgress = { begin() {}, length() {}, steps() {}, step() {}, fraction() {}, encoding: () => ({ args: [], stop() {} }), end() {} };

/** The reporter for the runs of one process. `folder` is where its file goes. `swift` is the program that runs the panel, ""
    when there is none. `log` is the run's log. The rest are for a test to give: the process's number, the clock in
    milliseconds, how a program is started, how a process is known to be running, and the timer that reads ffmpeg's progress.
    Gives back:
    - begin(video): a video is begun. Its file is written, and the panel is started when none is showing;
    - length(seconds): the video's length, once it is known, for the time left in all;
    - steps(names): the steps the work on this video will take, in order, as far as they are known. Said again when that
      changes, as when Claude has picked no clips;
    - step(name, shown): a step is begun. `shown` is how the panel says it, when that is not its name, as "Cutting short clip 2
      of 3" for the step "Cutting the short clips";
    - fraction(f): how far the step has got, from 0 to 1;
    - encoding(seconds): ffmpeg is about to write a file of so many seconds. Gives back {args}, which go before the others
      ffmpeg is given, and stop(), to call when ffmpeg has ended. Meanwhile its progress is read once a second;
    - end(): the video is done, or the work on it stopped. The file is taken away, and what each step took is kept in RATES.
    No call ever throws. */
export function reporter({ folder, swift = "", log = () => {}, pid = process.pid, now = () => Date.now(), start = spawn, alive = isRunning, timer = { every: setInterval, cancel: clearInterval } }) {
  const file = join(folder, `${pid}.json`);
  const ffmpegFile = join(folder, `${pid}.ffmpeg.txt`);
  const said = new Set();
  /** Say a thing in the log once for the whole process. */
  const once = (key, line) => {
    if (said.has(key)) return;
    said.add(key);
    log(line);
  };
  let v = null;

  /** How long is left in all, in seconds, by the rates measured: null while any step still to come has none. */
  const inAll = (at) => {
    if (!(v.length > 0)) return null;
    const i = v.steps.indexOf(v.step);
    if (i === -1) return null;
    const later = v.steps.slice(i + 1);
    if (!later.every((name) => Number.isFinite(v.rates[name]))) return null;
    const rest = later.reduce((sum, name) => sum + v.rates[name] * v.length, 0);
    const here = v.left != null ? v.left : Number.isFinite(v.rates[v.step]) ? Math.max(0, v.rates[v.step] * v.length - (at - v.stepStarted) / 1000) : null;
    return here == null ? null : Math.round(here + rest);
  };

  /** Write the run's file, whole: under another name first, then under its own. Within a step, at most once a second. */
  const write = (force) => {
    if (!v) return;
    const at = now();
    if (!force && at - v.written < EVERY_MS) return;
    try {
      const n = v.steps.indexOf(v.step) + 1 || null;
      const of = v.steps.length || null;
      const total = inAll(at);
      const shown = v.shown || "Starting";
      const text = JSON.stringify({ version: 1, pid, video: v.video, step: shown, n, of, percent: v.percent, left: v.left, total, detail: detailOf({ step: shown, n, of, percent: v.percent, left: v.left, total }), started: v.started, updated: at });
      mkdirSync(folder, { recursive: true });
      writeFileSync(file + ".writing", text + "\n");
      renameSync(file + ".writing", file);
      v.written = at;
    } catch (e) {
      once("file", `The progress panel's file could not be written (${e.code || e.message}). The work goes on without it.`);
    }
  };

  /** Start the panel, unless one is showing. It is started on its own, and never waited for. */
  const showPanel = () => {
    if (!swift) return once("swift", "No progress panel is shown: swift, which draws it, is not installed.");
    try {
      const held = Number(readFileSync(join(folder, PANEL_PID), "utf8")) || 0;
      if (held && alive(held)) return;
    } catch (e) {
      // No panel has shown yet.
    }
    const failed = (e) => once("panel", `The progress panel could not be shown (${e.code || e.message}). The work goes on without it.`);
    try {
      const child = start(swift, [PANEL, folder], { detached: true, stdio: "ignore" });
      child.on("error", failed);
      child.unref();
    } catch (e) {
      failed(e);
    }
  };

  /** Take a file of this run's away. One that cannot be is left: the panel ignores a file whose process has gone. */
  const gone = (path) => {
    try {
      rmSync(path, { force: true });
    } catch (e) {
      // Left where it is.
    }
  };

  /** Add the time since the step began to what that step has taken. */
  const spend = (at) => {
    if (v.step) v.spent[v.step] = (v.spent[v.step] || 0) + (at - v.stepStarted);
  };

  const api = {
    begin(video) {
      const at = now();
      v = { video, length: 0, steps: [], step: "", shown: "", percent: null, left: null, started: at, stepStarted: at, written: -Infinity, spent: {}, rates: readRates(folder) };
      write(true);
      showPanel();
    },
    length(seconds) {
      if (v && seconds > 0) v.length = seconds;
    },
    steps(names) {
      if (!v) return;
      v.steps = [...names];
      write(true);
    },
    step(name, shown = name) {
      if (!v) return;
      const at = now();
      spend(at);
      Object.assign(v, { step: name, shown, stepStarted: at, percent: null, left: null });
      write(true);
    },
    fraction(f) {
      if (!v || !(f >= 0)) return;
      const part = Math.min(1, f);
      const elapsed = (now() - v.stepStarted) / 1000;
      v.percent = Math.floor(part * 100);
      v.left = part >= 0.02 ? Math.round((elapsed * (1 - part)) / part) : null;
      write(part >= 1);
    },
    encoding(seconds) {
      if (!v || !(seconds > 0)) return { args: [], stop() {} };
      try {
        mkdirSync(folder, { recursive: true });
        rmSync(ffmpegFile, { force: true });
      } catch (e) {
        once("file", `The progress panel's file could not be written (${e.code || e.message}). The work goes on without it.`);
        return { args: [], stop() {} };
      }
      // Until ffmpeg has said how far it has got, the bar goes on moving with no number.
      const read = () => {
        const got = ffmpegProgress(tail(ffmpegFile, TAIL));
        if (got.seconds > 0 || got.ended) api.fraction(got.ended ? 1 : got.seconds / seconds);
      };
      const handle = timer.every(read, EVERY_MS);
      if (handle && typeof handle.unref === "function") handle.unref();
      return {
        args: ["-progress", ffmpegFile],
        stop() {
          timer.cancel(handle);
          gone(ffmpegFile);
        }
      };
    },
    end() {
      if (!v) return;
      spend(now());
      if (v.length > 0) {
        const rates = readRates(folder);
        for (const [name, ms] of Object.entries(v.spent)) if (ms >= SHORTEST_MS) rates[name] = blended(rates[name], ms / 1000 / v.length);
        try {
          mkdirSync(folder, { recursive: true });
          writeFileSync(join(folder, RATES + ".writing"), JSON.stringify(rates, null, 2) + "\n");
          renameSync(join(folder, RATES + ".writing"), join(folder, RATES));
        } catch (e) {
          once("file", `The progress panel's file could not be written (${e.code || e.message}). The work goes on without it.`);
        }
      }
      gone(file);
      v = null;
    }
  };
  return api;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd tool && node --test tests/progress.test.js`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add tool/progress.js tool/tests/progress.test.js
git commit -F - <<'MSG'
Say how far a run has got, for a progress panel (progress.js)

Each run writes a small file on this Mac's own disk: the video, the step,
how far ffmpeg has got, and how long is left, in all once a run here has
measured the steps. Nothing in it can stop the work.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 2: `progress.swift`, the panel

**Files:**
- Create: `tool/progress.swift`
- Test: `tool/tests/progress.test.js` (one `describe` added at the end)

**Interfaces:**
- Consumes: the progress files of Task 1, and `PANEL` and `PANEL_PID`.
- Produces:
  - `swift tool/progress.swift <folder>` shows the panel. It keeps its own pid in `<folder>/panel.pid`. It ends at once when another live panel holds that file. It ends 5 seconds after the last run has gone, or 60 seconds when nothing ever showed. Closing the window ends it.
  - `swift tool/progress.swift --print <folder>` prints the live runs as JSON, oldest first, as `[{{ "video", "detail", "percent"? }}]`, and ends.

- [ ] **Step 1: Write the failing test**

Add at the end of `tool/tests/progress.test.js`:

```js
describe("progress.swift, the panel itself", () => {
  const cannot = process.platform !== "darwin" ? "the panel is drawn with AppKit, which is only on a Mac"
    : spawnSync("swift", ["--version"]).status !== 0 ? "swift is not installed, so the panel cannot be run" : false;
  it("shows each run whose process is still going, oldest first, and nothing of a run that has gone or a file it cannot read", { skip: cannot }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-panel-"));
    const gone = spawnSync("/usr/bin/true").pid;
    const run = (pid, video, started, more = {}) => writeFileSync(join(dir, `${pid}-${video}.json`), JSON.stringify({ version: 1, pid, video, step: "x", n: 1, of: 2, percent: null, left: null, total: null, detail: `${video} detail`, started, updated: started, ...more }));
    run(process.pid, "second.mov", 2000, { percent: 42 });
    run(process.pid, 'Sallie\'s "third" \u{1F600}.mov', 3000, { percent: 7 });
    run(process.pid, "first.mov", 1000);
    run(gone, "gone.mov", 500);
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/progress.test.js`
Expected, on a Mac with swift: FAIL, because swift cannot find `progress.swift`. Off a Mac, or without swift, the test skips itself.

- [ ] **Step 3: Write `tool/progress.swift`**

```swift
// The progress panel: a small window that floats above the others, in the top right corner, with a bar for each run of the
// unedited-video tool on this Mac. It shows the video, the step the run is at, how far it has got and how long is left, as
// the run's own file in the folder says it (progress.js writes them). The tool starts it when a run begins a video, and never
// waits for it. It reads the folder once a second, and a file whose process has gone is ignored. It closes itself a few
// seconds after the last run has ended. Closing it by hand closes only the window: the runs go on, and the next video a run
// begins opens it again.
//
//   swift progress.swift <folder>            show the panel
//   swift progress.swift --print <folder>    print what it would show, as JSON, and end. For the tests
//
// It uses AppKit, so it runs only on a Mac. Nothing leaves the machine.
import AppKit

func stop(_ why: String) -> Never {
  FileHandle.standardError.write((why + "\n").data(using: .utf8)!)
  exit(1)
}

/** One run as the panel shows it. */
struct Row {
  let video: String
  let detail: String
  let percent: Double?
  let started: Double
}

/** Is the process `pid` still going? Signal 0 asks without sending anything. */
func alive(_ pid: Int32) -> Bool {
  return pid > 0 && (kill(pid, 0) == 0 || errno == EPERM)
}

/** The runs in the folder whose processes are still going, oldest first. A file that cannot be read is not a run. */
func rows(in folder: URL) -> [Row] {
  let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
  var found: [Row] = []
  for name in names where name.hasSuffix(".json") {
    guard let data = try? Data(contentsOf: folder.appendingPathComponent(name)),
      let run = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      (run["version"] as? Int) == 1,
      let pid = (run["pid"] as? NSNumber)?.int32Value, alive(pid),
      let video = run["video"] as? String,
      let detail = run["detail"] as? String
    else { continue }
    found.append(Row(video: video, detail: detail, percent: (run["percent"] as? NSNumber)?.doubleValue, started: (run["started"] as? NSNumber)?.doubleValue ?? 0))
  }
  return found.sorted { $0.started < $1.started }
}

let args = Array(CommandLine.arguments.dropFirst())
if args.count == 2 && args[0] == "--print" {
  let shown = rows(in: URL(fileURLWithPath: args[1], isDirectory: true)).map { row -> [String: Any] in
    var out: [String: Any] = ["video": row.video, "detail": row.detail]
    if let percent = row.percent { out["percent"] = percent }
    return out
  }
  FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: shown, options: [.sortedKeys]))
  exit(0)
}
guard args.count == 1 else { stop("Give it the folder of progress files: swift progress.swift <folder>") }
let folder = URL(fileURLWithPath: args[0], isDirectory: true)

// One panel at a time: the number of its process is kept in panel.pid, and a second panel ends at once.
let pidFile = folder.appendingPathComponent("panel.pid")
if let text = try? String(contentsOf: pidFile, encoding: .utf8), let other = Int32(text.trimmingCharacters(in: .whitespacesAndNewlines)), other != getpid(), alive(other) {
  exit(0)
}
try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
try? String(getpid()).write(to: pidFile, atomically: true, encoding: .utf8)

/** End the panel, and take its number away when it is this panel's. */
func quit() -> Never {
  if let text = try? String(contentsOf: pidFile, encoding: .utf8), Int32(text.trimmingCharacters(in: .whitespacesAndNewlines)) == getpid() {
    try? FileManager.default.removeItem(at: pidFile)
  }
  exit(0)
}

/** The window, and what it shows. Everything in it is done on the main thread, as AppKit asks. */
@MainActor
final class Panel: NSObject, NSWindowDelegate {
  let width: CGFloat = 380
  let window: NSPanel
  let stack = NSStackView()
  /** The views of each run shown: its video, its bar, and the line under it. */
  var rowViews: [(title: NSTextField, bar: NSProgressIndicator, detail: NSTextField)] = []
  var shown = false
  var lastSeen = Date()

  override init() {
    window = NSPanel(contentRect: NSRect(x: 0, y: 0, width: width, height: 80), styleMask: [.titled, .closable, .utilityWindow, .nonactivatingPanel], backing: .buffered, defer: false)
    super.init()
    window.title = "BRIMM video"
    window.level = .floating
    window.isFloatingPanel = true
    window.hidesOnDeactivate = false
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    stack.orientation = .vertical
    stack.alignment = .leading
    stack.spacing = 12
    stack.edgeInsets = NSEdgeInsets(top: 12, left: 14, bottom: 14, right: 14)
    window.contentView = stack
    window.delegate = self
  }

  /** Closing the window ends the panel. The runs go on. */
  func windowWillClose(_ notification: Notification) { quit() }

  func makeRow() -> (title: NSTextField, bar: NSProgressIndicator, detail: NSTextField) {
    let title = NSTextField(labelWithString: "")
    title.font = .boldSystemFont(ofSize: 13)
    title.lineBreakMode = .byTruncatingMiddle
    let bar = NSProgressIndicator()
    bar.style = .bar
    bar.minValue = 0
    bar.maxValue = 100
    bar.isIndeterminate = true
    bar.startAnimation(nil)
    let detail = NSTextField(labelWithString: "")
    detail.font = .systemFont(ofSize: 11)
    detail.textColor = .secondaryLabelColor
    detail.lineBreakMode = .byWordWrapping
    detail.maximumNumberOfLines = 2
    for view in [title, bar, detail] as [NSView] { view.widthAnchor.constraint(equalToConstant: width - 28).isActive = true }
    let column = NSStackView(views: [title, bar, detail])
    column.orientation = .vertical
    column.alignment = .leading
    column.spacing = 4
    stack.addArrangedSubview(column)
    return (title, bar, detail)
  }

  /** A bar that moves with no number while a step says nothing of how far it has got, and fills as it does. */
  func setBar(_ bar: NSProgressIndicator, _ percent: Double?) {
    if let percent = percent {
      if bar.isIndeterminate {
        bar.stopAnimation(nil)
        bar.isIndeterminate = false
      }
      bar.doubleValue = percent
    } else if !bar.isIndeterminate {
      bar.isIndeterminate = true
      bar.startAnimation(nil)
    }
  }

  /** Read the folder, show what it says, and end a few seconds after the last run has gone: 5 once something was shown, and
      60 when nothing ever was, as when a run ended before the panel was ready. */
  func refresh() {
    let found = rows(in: folder)
    if found.isEmpty {
      if Date().timeIntervalSince(lastSeen) > (shown ? 5 : 60) { quit() }
      return
    }
    lastSeen = Date()
    if rowViews.count != found.count {
      for view in stack.arrangedSubviews { view.removeFromSuperview() }
      rowViews = found.map { _ in makeRow() }
    }
    for (row, views) in zip(found, rowViews) {
      views.title.stringValue = row.video
      views.detail.stringValue = row.detail
      setBar(views.bar, row.percent)
    }
    let top = window.frame.maxY
    window.setContentSize(stack.fittingSize)
    if shown {
      window.setFrameTopLeftPoint(NSPoint(x: window.frame.minX, y: top))
    } else {
      if let screen = NSScreen.main?.visibleFrame {
        window.setFrameTopLeftPoint(NSPoint(x: screen.maxX - window.frame.width - 20, y: screen.maxY - 20))
      }
      window.orderFrontRegardless()
      shown = true
    }
  }

  /** Read the folder now, and then once a second. */
  func start() {
    refresh()
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.refresh() }
    }
  }
}

// The script's own lines run on the main thread, which is where AppKit is to be used.
MainActor.assumeIsolated {
  let app = NSApplication.shared
  // No icon in the Dock and no menu: it is only a panel.
  app.setActivationPolicy(.accessory)
  let panel = Panel()
  panel.start()
  app.run()
}
```

- [ ] **Step 4: Run it to see it pass, and start the panel once by hand with nothing to show**

Run: `cd tool && node --test tests/progress.test.js`
Expected: PASS, 21 tests.

Then check that the panel compiles cleanly and stays up with nothing to show. It shows no window when the folder holds no run:

```bash
mkdir -p /tmp/brimm-panel-check && (swift tool/progress.swift /tmp/brimm-panel-check 2> /tmp/brimm-panel-check.err &) && sleep 8 && pgrep -f "progress.swift /tmp/brimm-panel-check" && pkill -f "progress.swift /tmp/brimm-panel-check"; cat /tmp/brimm-panel-check.err
```

Expected: a process number, then nothing from swift: no warning and no error. With Swift 6.4, code that touches AppKit outside the main actor warns here, and the file above keeps all of it in a `@MainActor` class.

- [ ] **Step 5: Commit**

```bash
git add tool/progress.swift tool/tests/progress.test.js
git commit -F - <<'MSG'
Add the progress panel: a floating window with a bar for each run

progress.swift reads the runs' files once a second and ignores a run whose
process has gone. It closes itself after the last run. --print is for the
tests.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 3: the import tells the panel each step

**Files:**
- Modify: `tool/unedited.js`
- Test: `tool/tests/unedited.test.js`

**Interfaces:**
- Consumes: `reporter`, `progressFolder` and `noProgress` (Task 1).
- Produces:
  - `deps.progress`, a reporter. `depsFor` makes a real one, writing in `progressFolder(home)` with this Mac's `swift`. Tests give none, and get `noProgress`.
  - The steps, by name: "Reading the sound", "Writing the transcript", "Making the cut plan", "Asking Claude", "Making the rough cut", "Finding the faces", "Making the upright version", "Cutting the short clips" (shown as "Cutting short clip 2 of 3", or "Cutting clip 1" with `--from-plan`), and "Filing".
  - Every ffmpeg encode (the rough cut, the upright version, each clip and each part of a Story) is given `-progress <file>` before its other arguments, when there is a reporter.

The variable `silent` already exists in `workOn`: it holds the long silences ffmpeg found. That is why the reporter that does nothing is called `noProgress`, not `silent`.

- [ ] **Step 1: Write the failing tests**

**Test edit 1.** Replace:

```js
assert.deepEqual(Object.keys(deps).sort(), ["home", "log", "model", "notify", "rulesOnly", "run", "tools", "wait"]);
```

with:

```js
assert.deepEqual(Object.keys(deps).sort(), ["home", "log", "model", "notify", "progress", "rulesOnly", "run", "tools", "wait"]);
```

**Test edit 2.** Replace:

```js
import { probed, told, TOLD, SRT, PAUSES } from "./fixtures.js";
```

with:

```js
import { probed, told, TOLD, SRT, PAUSES } from "./fixtures.js";
import { progressFolder } from "../progress.js";
```

**Test edit 3.** Add this `describe` before `describe("several folders of unedited videos", () => {`:

```js
describe("what the progress panel is told", () => {
  /** A stand-in for the progress reporter: it keeps what it is told, in order, and gives ffmpeg one more option, as the real
      one does, so that a test can see where it goes. */
  const watching = (t) => {
    const told = [];
    t.deps.progress = {
      begin: (video) => told.push(["begin", video]),
      length: (seconds) => told.push(["length", seconds]),
      steps: (names) => told.push(["steps", names]),
      step: (name, shown = name) => told.push(["step", shown]),
      fraction: () => {},
      encoding: (seconds) => {
        told.push(["encoding", Math.round(seconds * 1000) / 1000]);
        return { args: ["-progress", "/progress/ffmpeg.txt"], stop: () => told.push(["stopped"]) };
      },
      end: () => told.push(["end"])
    };
    return told;
  };
  const steps = (told) => told.filter(([what]) => what === "step").map(([, shown]) => shown);
  const ALL_STEPS = ["Reading the sound", "Writing the transcript", "Making the cut plan", "Asking Claude", "Making the rough cut", "Finding the faces", "Making the upright version", "Cutting the short clips"];
  it("is told each step of a video as it begins, the steps to come, the video's length, and the end", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(told[0], ["begin", "talk.mov"]);
    assert.deepEqual(told[told.length - 1], ["end"]);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript", "Making the cut plan", "Asking Claude", "Making the rough cut", "Finding the faces", "Making the upright version", "Cutting short clip 1 of 1"]);
    assert.deepEqual(told.find(([what]) => what === "length"), ["length", 23.423]);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [ALL_STEPS, ALL_STEPS, ALL_STEPS]);
    t.done();
  });
  it("has ffmpeg say how far it has got with each video it writes, and stops reading it when ffmpeg has ended", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const told = watching(t);
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    // Each encode is followed at once by the end of the watching: the rough cut, the upright version and the clip.
    const at = told.map(([what], i) => (what === "encoding" ? i : -1)).filter((i) => i >= 0);
    assert.equal(at.length, 3);
    for (const i of at) assert.deepEqual(told[i + 1], ["stopped"]);
    // The rough cut's encode is as long as the stretches it is made of, each end on a whole picture, and ffmpeg is given
    // -progress before everything else.
    const kept = keptSpans(USED.plan.ranges, FACTS.fps).reduce((sum, span) => sum + (span.end - span.start), 0);
    assert.deepEqual(told[at[0]], ["encoding", Math.round(kept * 1000) / 1000]);
    assert.deepEqual(roughCalls(t)[0].args, ["-progress", "/progress/ffmpeg.txt", ...roughCutArgs(file, join(t.dir, "talk.rough-cut.mp4.writing"), { ranges: USED.plan.ranges, fps: FACTS.fps })]);
    assert.deepEqual(uprightCall(t).args.slice(0, 2), ["-progress", "/progress/ffmpeg.txt"]);
    t.done();
  });
  it("is told less to come when the video is upright already, Claude is not asked or picks no clip, and of filing in a folder", async () => {
    const t = setup({ probed: probed({ picture: { width: 1080, height: 1920 } }) });
    const told = watching(t);
    t.video("a.mov");
    await uneditedFolder(t.dir, t.deps);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names).slice(-1), [["Reading the sound", "Writing the transcript", "Making the cut plan", "Making the rough cut", "Filing"]]);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript", "Making the cut plan", "Making the rough cut", "Filing"]);
    t.done();
  });
  it("is told of a video that cannot be done what was begun, and the end, so that its bar goes", async () => {
    const t = setup({ whisper: "fail" });
    const told = watching(t);
    await uneditedFile(t.video("talk.mov"), t.deps);
    assert.deepEqual(steps(told), ["Reading the sound", "Writing the transcript"]);
    assert.deepEqual(told[told.length - 1], ["end"]);
    t.done();
  });
  it("is told the videos made again from a plan (--from-plan): the rough cut, the faces, the upright version and each clip", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    const file = t.video("talk.mov");
    await uneditedFile(file, t.deps);
    const told = watching(t);
    await videosFromPlan(file, t.deps);
    assert.deepEqual(told.filter(([what]) => what === "steps").map(([, names]) => names), [["Making the rough cut", "Finding the faces", "Making the upright version", "Cutting the short clips"]]);
    assert.deepEqual(steps(told), ["Making the rough cut", "Finding the faces", "Making the upright version", "Cutting clip 1"]);
    assert.deepEqual([told[0], told[told.length - 1]], [["begin", "talk.mov"], ["end"]]);
    t.done();
  });
  it("is the real reporter in a run from the command line, writing in Application Support in the home folder, with this Mac's swift", () => {
    const deps = depsFor({ ffmpeg: "/f", ffprobe: "/p", whisper: "/w", swift: "", claude: "", model: "/m", missing: [] }, () => {}, { HOME: "/Users/sallie" });
    assert.equal(typeof deps.progress.begin, "function");
    assert.equal(progressFolder("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/progress");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/unedited.test.js`
Expected: FAIL. `depsFor` has no `progress` key, and the stand-in reporter is told nothing.

- [ ] **Step 3: Change `tool/unedited.js`**

Make these edits in order. Each "Replace" text is in the file exactly once, except Edit 16, which is there twice (the `finally` of `workOn` and of `videosFromPlan`) and is replaced in both places.

If `main` has changed `roughCut` or `joined` by the time you build this (another session has suggested writing videos outside Dropbox first), keep the change the same in spirit. Ask the reporter for `encoding(seconds)` before ffmpeg runs, put `watch.args` before ffmpeg's other arguments, and call `watch.stop()` in a `finally` once ffmpeg has ended.

**Edit 1.** Replace:

```js
import { fcpxml, checkFcpxml } from "./fcpxml.js";
```

with:

```js
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { reporter, progressFolder, noProgress } from "./progress.js";
```

**Edit 2.** Replace:

```js
const sentence = (part) => `${capital(part)}.`;
```

with:

```js
const sentence = (part) => `${capital(part)}.`;

/** The steps of the work on one video, as the progress panel counts them: Claude is asked (`claude`), there is an upright
    version to make (`wide`), there are clips to cut (`clips`), and the video is filed away after (`watched`). */
const stepsFor = ({ claude, wide, clips, watched }) => [
  "Reading the sound", "Writing the transcript", "Making the cut plan", ...(claude ? ["Asking Claude"] : []), "Making the rough cut",
  ...(wide ? ["Finding the faces", "Making the upright version"] : []), ...(clips ? ["Cutting the short clips"] : []), ...(watched ? ["Filing"] : [])
];

/** The seconds that stretches of a video come to. */
const secondsIn = (stretches) => stretches.reduce((sum, s) => sum + (s.end - s.start), 0);
```

**Edit 3.** Replace:

```js
async function roughCut(file, to, { plan, facts, spans }, { run, tools, log = () => {} }) {
  if (!facts.height) return "there is no picture in the file";
  if (!spans.length) return "the plan keeps nothing";
  log(`${basename(file)}: making the rough cut.`);
  const made = await run(tools.ffmpeg, roughCutArgs(file, to + ".writing", { ranges: plan.ranges, fps: roughRate(facts) }));
```

with:

```js
async function roughCut(file, to, { plan, facts, spans }, { run, tools, log = () => {}, progress = noProgress }) {
  if (!facts.height) return "there is no picture in the file";
  if (!spans.length) return "the plan keeps nothing";
  log(`${basename(file)}: making the rough cut.`);
  progress.step("Making the rough cut");
  // ffmpeg says how far it has got, for the progress panel. Without a panel it is given nothing more.
  const watch = progress.encoding(secondsIn(spans));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...roughCutArgs(file, to + ".writing", { ranges: plan.ranges, fps: roughRate(facts) })]);
  } finally {
    watch.stop();
  }
```

**Edit 4.** Replace:

```js
async function joined(file, to, { ranges, crops }, { run, tools }) {
  const made = await run(tools.ffmpeg, verticalArgs({ video: file, ranges, crops, out: to + ".writing" }));
```

with:

```js
async function joined(file, to, { ranges, crops }, { run, tools, progress = noProgress }) {
  const watch = progress.encoding(secondsIn(ranges));
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...verticalArgs({ video: file, ranges, crops, out: to + ".writing" })]);
  } finally {
    watch.stop();
  }
```

**Edit 5.** Replace:

```js
  const { log = () => {} } = deps;
  const name = basename(file);
  let seen = {};
  try {
    log(`${name}: making the upright version.`);
    seen = await facesIn(file, work, deps)
```

with:

```js
  const { log = () => {}, progress = noProgress } = deps;
  const name = basename(file);
  let seen = {};
  try {
    log(`${name}: making the upright version.`);
    progress.step("Finding the faces");
    seen = await facesIn(file, work, deps)
```

**Edit 6.** Replace:

```js
    return { why: await joined(file, to, { ranges, crops }, deps), centred: seen.why || "", stills: seen.stills || [] };
```

with:

```js
    progress.step("Making the upright version");
    return { why: await joined(file, to, { ranges, crops }, deps), centred: seen.why || "", stills: seen.stills || [] };
```

**Edit 7.** Replace:

```js
  const cut = [];
  for (const clip of clips) {
    const out = clipOutputs(file, clip.n, clip.story.length, deps.outDir || undefined);
```

with:

```js
  const { progress = noProgress } = deps;
  const cut = [];
  for (const [i, clip] of clips.entries()) {
    progress.step("Cutting the short clips", `Cutting short clip ${i + 1} of ${clips.length}`);
    const out = clipOutputs(file, clip.n, clip.story.length, deps.outDir || undefined);
```

**Edit 8.** Replace:

```js
async function workOn(file, deps) {
  const { run, tools, model, log = () => {}, notify = () => {}, wait, sizeOf = sizeOnDisk } = deps;
```

with:

```js
async function workOn(file, deps) {
  const { run, tools, model, log = () => {}, notify = () => {}, wait, sizeOf = sizeOnDisk, progress = noProgress } = deps;
```

**Edit 9.** Replace:

```js
    return { ok: false, name, message: why };
  };
  try {
    log(`${name}: reading the sound.`);
```

with:

```js
    return { ok: false, name, message: why };
  };
  // The progress panel is told each step as it begins. It is told the steps to come as far as they are known, and again as
  // more is known: whether there is an upright version to make, once the video has been read, and whether there are clips.
  const claude = !deps.rulesOnly && Boolean(tools.claude);
  const watched = Boolean(deps.watched);
  progress.begin(name);
  progress.steps(stepsFor({ claude, wide: true, clips: claude, watched }));
  try {
    progress.step("Reading the sound");
    log(`${name}: reading the sound.`);
```

**Edit 10.** Replace:

```js
    if (facts && !facts.sound) return fail("there is no sound in the file");
```

with:

```js
    if (facts && !facts.sound) return fail("there is no sound in the file");
    if (facts) {
      progress.length(facts.duration);
      progress.steps(stepsFor({ claude, wide: needsReframe(facts), clips: claude, watched }));
    }
```

**Edit 11.** Replace:

```js
    log(`${name}: writing the transcript, with a time for every word.`);
```

with:

```js
    progress.step("Writing the transcript");
    log(`${name}: writing the transcript, with a time for every word.`);
```

**Edit 12.** Replace:

```js
    const planned = await planFor(
```

with:

```js
    progress.step("Making the cut plan");
    const planned = await planFor(
```

**Edit 13.** Replace:

```js
      asked = deps.rulesOnly || !tools.claude ? null : await askClaude(name, plan, facts, work, deps);
```

with:

```js
      if (claude) progress.step("Asking Claude");
      asked = deps.rulesOnly || !tools.claude ? null : await askClaude(name, plan, facts, work, deps);
```

**Edit 14.** Replace:

```js
      const spans = keptSpans(plan.ranges, roughRate(facts));
      let why = "";
```

with:

```js
      progress.steps(stepsFor({ claude, wide: needsReframe(facts), clips: clips.length > 0, watched }));
      const spans = keptSpans(plan.ranges, roughRate(facts));
      let why = "";
```

**Edit 15.** Replace:

```js
    const filed = deps.watched ? fileAway(deps.watched, files, deps, day) : { folder: "", at: files };
```

with:

```js
    if (deps.watched) progress.step("Filing");
    const filed = deps.watched ? fileAway(deps.watched, files, deps, day) : { folder: "", at: files };
```

**Edit 16.** Replace:

```js
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
```

with:

```js
  } finally {
    progress.end();
    rmSync(work, { recursive: true, force: true });
  }
```

**Edit 17.** Replace:

```js
export async function videosFromPlan(file, deps) {
  const { run, tools, log = () => {} } = deps;
```

with:

```js
export async function videosFromPlan(file, deps) {
  const { run, tools, log = () => {}, progress = noProgress } = deps;
```

**Edit 18.** Replace:

```js
    log(`${name}: making its videos again from ${basename(out.plan)}.`);
```

with:

```js
    log(`${name}: making its videos again from ${basename(out.plan)}.`);
    const clipped = (plan.claude ? plan.claude.clips : []).some((clip) => clip.files.length > 0);
    progress.begin(name);
    progress.length(facts.duration);
    progress.steps(["Making the rough cut", ...(needsReframe(facts) ? ["Finding the faces", "Making the upright version"] : []), ...(clipped ? ["Cutting the short clips"] : [])]);
```

**Edit 19.** Replace:

```js
    for (const piece of pieces) {
      const cut = await cutPiece(
```

with:

```js
    for (const piece of pieces) {
      progress.step("Cutting the short clips", `Cutting ${piece.what}`);
      const cut = await cutPiece(
```

**Edit 20.** Replace:

```js
export function depsFor(found, log, env = process.env, args = {}) {
  return { run: runProgram, tools: found, model: found.model, home: env.HOME || homedir(), rulesOnly: Boolean(args.rulesOnly), log, notify: banner, wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
```

with:

```js
export function depsFor(found, log, env = process.env, args = {}) {
  const home = env.HOME || homedir();
  return { run: runProgram, tools: found, model: found.model, home, rulesOnly: Boolean(args.rulesOnly), log, notify: banner, wait: (ms) => new Promise((r) => setTimeout(r, ms)), progress: reporter({ folder: progressFolder(home), swift: found.swift, log }) };
```


- [ ] **Step 4: Run every test to see them pass**

Run: `cd tool && node --test`
Expected: PASS, all of them. Every existing test still passes unchanged, because it gives no reporter, so ffmpeg is given exactly what it was before.

- [ ] **Step 5: Commit**

```bash
git add tool/unedited.js tool/tests/unedited.test.js
git commit -F - <<'MSG'
Tell the progress panel each step of a video, and ffmpeg's progress

The import, a video made again from its plan, and a run by hand or from a
Claude session all write how far they have got, and start the panel.
Without a reporter, as in the tests, nothing changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 4: what the tool and the README say, and seeing the panel once

**Files:**
- Modify: `tool/unedited.js` (its header comment and `HELP`), `README.md`

- [ ] **Step 1: Say what the panel is**

In `tool/unedited.js`, after the header line that ends "Final Cut Pro is never opened from here.", add:

```js
// While it works, it says how far it has got in a small file on this Mac's own disk (progress.js), and swift runs
// progress.swift to show that in a small window: closing the window, or its failing to open, changes nothing about the work.
```

In `HELP`, after the paragraph that ends "The video's file name and its length go with them.", add a blank line and:

```
While it works, a small window in the top right corner of the screen shows how far each video has got: the step, a bar,
and how long is left. Closing it changes nothing about the work.
```

In `README.md`, under "## Unedited video", after the paragraph that begins "Having the Mac watch a folder for unedited video", add:

```markdown
**Progress.** While a video is worked on, a small window floats in the top right corner of the screen with a bar for each
video: the step it is at ("Making the upright version (step 7 of 8)"), how far that step has got when ffmpeg says so, and how
long is left. Once a video has been done on a Mac, it also says roughly how long is left in all, from what each step took
there, kept in `~/Library/Application Support/BRIMM Video/progress/rates.json`. It comes up for a run started by the launch
agent, by hand, or from a Claude session, and goes a few seconds after the last run ends. It is drawn by `tool/progress.swift`,
which swift runs, so nothing is installed. Without swift there is no window, and the log says so once. Each run writes a
small file in `~/Library/Application Support/BRIMM Video/progress/`, on the Mac's own disk and never in Dropbox. Closing the
window, or its failing to open, changes nothing about the work. A video dropped for the other Mac shows its window on that
Mac only.
```

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 2: See the panel with a run in it, by hand, on this Mac**

Copy any short recording into a scratch folder. Never use a watched folder or anything in Dropbox. Make its rough cut and upright version with Claude left out:

```bash
mkdir -p /tmp/brimm-progress-check && cp "<a short recording>.mov" /tmp/brimm-progress-check/
cd tool && node unedited.js --rules-only "/tmp/brimm-progress-check/<a short recording>.mov"
```

Expected, within a few seconds: a window titled "BRIMM video" in the top right corner, with the video's name, a bar, and a line such as "Making the upright version (step 6 of 6), 42%, about 1 minute left". It goes about 5 seconds after the run ends. Run it a second time: the line now ends with the time left in all. Close the window during a third run: the run finishes all the same, and its files are all there. Say in the pull request what was seen, and send a screenshot if one was taken.

- [ ] **Step 3: Commit, push, and open the pull request for Jason**

```bash
git add tool/unedited.js README.md
git commit -F - <<'MSG'
Say in the help and the README what the progress panel is

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git push -u origin claude/phase-p-progress-panel
```

Open a pull request into `main` titled "Phase P: a progress panel while a video is processed". Say what was seen in Step 2, and that the panel from the launch agent is checked after merging. End the description with the attribution line from the session's instructions. Do not merge it: Jason merges.

---

## After the code: Jason merges, then one check of the launch agent

1. Jason merges the pull request. The launch agent runs `tool/unedited.js` from the main checkout on the Mac Studio, so after `git pull` there, the next video dropped in the watched folder brings up the panel. No install and no change to the launch agent are needed.
2. **The check no test can make:** that the panel shows for a run the launch agent started, and stays until the run ends. launchd ends the processes a job leaves behind, so the tool starts the panel in a session of its own (`detached`). If no window comes up, the run is not affected. Look in `~/Library/Logs/brimm-video.log` for a line about the panel, and say what it says.

## Not in this phase

- The status file in `Episodes/.importing/`, which would show the other Mac how an import is going. It needs phase 1's Episodes folder, whose place the design review is reconsidering.
- The transcriber's own percent (whisper's `--print-progress`, not tried). Until then, "Writing the transcript" shows a moving bar with no number.
