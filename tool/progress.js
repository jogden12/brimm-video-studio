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
