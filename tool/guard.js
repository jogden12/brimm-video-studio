// Running a program that could run away, under a watchdog: ffmpeg making a Reel's preview. On 2026-10-14 an ffmpeg asked for a
// preview of a stretch that lay past the end of its video grew its memory without end, about 4 GB a second, and took the Mac
// Studio to 101 GB before it was killed by hand. An import runs unattended, and on Sallie's laptop there are 16 GB. So such a
// program is run in a group of its own, its memory is looked at every 50 ms, and the whole group is killed outright when the
// memory passes a cap or the program runs past its time. A timeout on a program that runs it, or a kill of the program alone,
// can leave what it started running, which is how that ffmpeg was left to grow.
import { spawn, execFile } from "node:child_process";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** How much memory a process holds in the computer's memory now, in bytes, as ps says (its resident size). 0 when it is gone.
    It is what the cap is measured by: memory that macOS compresses or swaps out is not counted, but a program that grows a
    gigabyte or more a second passes any cap in resident memory first. */
export const residentOf = (pid) => new Promise((done) => {
  execFile("ps", ["-o", "rss=", "-p", String(pid)], (error, stdout) => done(error ? 0 : (Number(String(stdout).trim()) || 0) * 1024));
});

/** A size in plain words: "2 GB" for whole gigabytes, and megabytes otherwise. */
const sizeOf = (bytes) => (bytes >= GB && bytes % GB === 0 ? `${bytes / GB} GB` : `${Math.round(bytes / MB)} MB`);

/** The groups this process has running now, so that they are killed if it ends first. */
const running = new Set();
let watching = false;
/** The signals that stop a process from outside: launchctl's bootout (the installer's re-run) sends SIGTERM, a terminal's
    Control-C SIGINT, and a closed terminal SIGHUP. */
const STOPS = ["SIGTERM", "SIGINT", "SIGHUP"];
const killGroup = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (e) {
    // The group is gone already.
  }
};

/** Run a program under the watchdog. Resolves {code, stderr, signal, overMemory, outOfTime, peak, stopped}: its exit code, the
    end of what it printed (`keep` characters of it), what killed it, whether the watchdog stopped it for its memory or its
    time, the most memory it was seen to hold, and `stopped`, which says in plain words why it was stopped, or is "".
    - `most` is the memory cap in bytes, and `limit` the time it may run, in milliseconds. Both must be given.
    - `every` is how often its memory is looked at, in milliseconds, and `resident` how it is looked at (residentOf), for a
      test to give another.
    The program runs in a process group of its own, and the whole group is killed: anything the program started goes too.
    A group still running when this process ends is killed then, and so is one running when this process is stopped by
    SIGTERM, SIGINT or SIGHUP, after which this process ends by that signal. A program that cannot be started resolves with no code and
    the reason as what it printed. */
export function runGuarded(cmd, args, { keep = 4000, most, limit, every = 50, resident = residentOf } = {}) {
  if (!(most > 0) || !(limit > 0)) return Promise.reject(new Error("A guarded program needs a memory cap and a time limit."));
  if (!watching) {
    watching = true;
    process.on("exit", () => running.forEach(killGroup));
    // Stopped by a signal, this process ends without its exit, so its groups are killed first. Then it ends by the signal as
    // it would have, unless something else here has said it will handle that signal.
    for (const signal of STOPS) {
      const stopped = () => {
        running.forEach(killGroup);
        process.removeListener(signal, stopped);
        if (!process.listenerCount(signal)) process.kill(process.pid, signal);
      };
      process.on(signal, stopped);
    }
  }
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"], detached: true });
    let stderr = "";
    let peak = 0;
    let overMemory = false;
    let outOfTime = false;
    let ended = false;
    const stop = () => killGroup(child.pid);
    const finish = (result) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      running.delete(child.pid);
      const stopped = overMemory ? `it took more than ${sizeOf(most)} of memory, so it was stopped` : outOfTime ? `it ran for more than ${limit / 1000} seconds, so it was stopped` : "";
      done({ ...result, stderr, overMemory, outOfTime, peak, stopped });
    };
    if (child.pid) running.add(child.pid);
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-keep);
    });
    const timer = setTimeout(() => {
      outOfTime = true;
      stop();
    }, limit);
    const look = async () => {
      if (ended) return;
      const now = await resident(child.pid);
      if (ended) return;
      peak = Math.max(peak, now);
      if (now > most) {
        overMemory = true;
        stop();
        return;
      }
      setTimeout(look, every);
    };
    setTimeout(look, every);
    child.on("error", (e) => {
      stderr = e.message;
      finish({ code: null, signal: null });
    });
    child.on("close", (code, signal) => finish({ code, signal }));
  });
}
