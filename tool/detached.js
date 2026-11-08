// Long commands run detached. Claude Code stops a command after a few minutes, and an episode's long work (bringing its files
// over, phase 2's finish) can take longer. So such a command is started detached and returns at once, and the run it starts
// works on its own: one run at a time for an episode, holding the episode's lock on this Mac's own disk, with the Mac kept
// awake while it runs. When it ends it leaves a result file, which `status` reads: what it made, what failed, and what to ask
// next. Everything here is on this Mac's own disk, in BRIMM Video Work, and never in Dropbox.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { studioHome } from "./home.js";
import { join } from "node:path";
import { episodeWork } from "./settings.js";
import { caffeinate, thisCheckout } from "./filing.js";
import { isRunning } from "./run.js";

/** The lock of an episode on this Mac, which a detached run holds while it works: { pid, command }. */
export const lockOf = (home, folder) => join(episodeWork(home, folder), "episode.lock");

/** The result a detached command left for an episode on this Mac. */
export const resultFile = (home, folder, command) => join(episodeWork(home, folder), `${command}.result.json`);

/** The result a detached command left for an episode, or null when it has left none, or it cannot be read. */
export function readResult(home, folder, command) {
  try {
    return JSON.parse(readFileSync(resultFile(home, folder, command), "utf8"));
  } catch (e) {
    return null;
  }
}

/** A lock's holder, { pid, command }, or null when there is no lock or it cannot be read. The lock is the episode's unless another
    is given. */
function holder(home, folder, lock = lockOf(home, folder)) {
  try {
    const held = JSON.parse(readFileSync(lock, "utf8"));
    return held && Number.isInteger(held.pid) && typeof held.command === "string" ? held : null;
  } catch (e) {
    return null;
  }
}

/** The detached run at work on an episode on this Mac, { pid, command, nonce }, or null when none is: a lock whose run is no
    longer running was left by a run that died, and counts as none. It is the run that holds the episode's lock, or `lock` when
    one is given: a run with a lock of its own, as the working copy's (workcopy.js), runs beside the episode's. The nonce is the
    one the run took its lock with, which names that run alone (a process number can be used again): "" for a lock written
    without one. */
export function runningRun(home, folder, alive = isRunning, lock = lockOf(home, folder)) {
  const held = holder(home, folder, lock);
  return held && alive(held.pid) ? { pid: held.pid, command: held.command, nonce: typeof held.nonce === "string" ? held.nonce : "" } : null;
}

/** The command a detached run is at for an episode on this Mac, or "" when none is (runningRun), by the episode's lock or `lock`. */
export function runningCommand(home, folder, alive = isRunning, lock = lockOf(home, folder)) {
  const run = runningRun(home, folder, alive, lock);
  return run ? run.command : "";
}

/** Write a file whole on this Mac's own disk: under a name of this run's own, then renamed, which is safe there. */
function writeWhole(file, text) {
  const writing = `${file}.${process.pid}.writing`;
  writeFileSync(writing, text);
  renameSync(writing, file);
}

/** A lock file's text, or null when there is none. */
function textOf(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    return null;
  }
}

/** A lock's holder, read from its text: { pid, command }, or null. */
function heldBy(text) {
  try {
    const held = JSON.parse(text);
    return held && Number.isInteger(held.pid) ? held : null;
  } catch (e) {
    return null;
  }
}

/** Wait a few milliseconds, holding up nothing but this run. */
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** How old a takeover guard may be before it counts as left by a run that died inside it: it is held for a moment only. */
const GUARD_STALE_MS = 10000;

/** Take the episode's lock for this run: { taken: true, text, nonce } with the lock's text and the nonce in it, or { running }
    naming the command of the live run that holds it. Safe for any number of runs at once:
    - the lock is taken by a hard link of a file of this run's own to the lock's name, which fails when the lock is there,
      so one run alone takes a free lock;
    - a lock whose run is not running is taken away only by the run that holds the takeover guard (taken by a hard link too),
      and only when its text is still, word for word, the dead run's: no live run's lock is ever taken away. */
export function takeEpisodeLock(lock, command, alive) {
  const nonce = randomUUID();
  const text = JSON.stringify({ pid: process.pid, command, nonce });
  const mine = `${lock}.${process.pid}.${randomUUID().slice(0, 8)}`;
  const guard = `${lock}.takeover`;
  writeFileSync(mine, text);
  // Whether a takeover guard stood in the way: when the attempts run out so, another run is taking over the lock.
  let guarded = false;
  try {
    for (let attempt = 0; attempt < 400; attempt++) {
      guarded = false;
      try {
        linkSync(mine, lock);
        return { taken: true, text, nonce };
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const seen = textOf(lock);
      if (seen === null) continue;
      const held = heldBy(seen);
      if (held && alive(held.pid)) return { running: held.command };
      // The lock is a dead run's. Only the run that holds the guard may take it away, and only if it is still that one.
      try {
        linkSync(mine, guard);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        const keeper = heldBy(textOf(guard));
        let age = 0;
        try {
          age = Date.now() - statSync(guard).mtimeMs;
        } catch (gone) {
          continue;
        }
        if (age > GUARD_STALE_MS && !(keeper && alive(keeper.pid))) rmSync(guard, { force: true });
        else pause(5);
        guarded = true;
        continue;
      }
      try {
        if (textOf(lock) === seen) rmSync(lock, { force: true });
        try {
          linkSync(mine, lock);
          return { taken: true, text, nonce };
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
        }
      } finally {
        if (textOf(guard) === text) rmSync(guard, { force: true });
      }
    }
    const held = heldBy(textOf(lock));
    if (guarded && !(held && alive(held.pid))) return { taking: true };
    return { running: held ? held.command : "another run" };
  } finally {
    rmSync(mine, { force: true });
  }
}

/** Let the episode's lock go, when it is still this run's own (its text is the one taken): a lock some other run holds is
    never taken away. */
export function releaseEpisodeLock(lock, text) {
  if (textOf(lock) === text) rmSync(lock, { force: true });
}

/** Run `work` as the detached run of `command` for the episode `folder`: it takes the episode's lock (one left by a run that
    died is taken over), keeps the Mac awake while this process runs (`keepAwake`), awaits `work()`, which resolves
    { ok, made, failed, next }, writes the result file whole, and lets the lock go, whatever happened. Resolves the result, or { running } naming the command whose run holds the lock, when another run is at
    work on the episode: then nothing is done. `alive` and `now` are the Mac's own unless a test gives others. `clean` is what
    each line of the result is written as, which `status` prints into Sallie's chat: for a video not yet answered, or a session,
    the line with nothing of the video's names in it (edit.js), and for any other the line as it is. An error of its own, as a
    folder in BRIMM Video Work that cannot be made or a result that cannot be written, names the episode's folder: it is thrown
    said through `clean` too, so that nothing of it reaches the log or the chat otherwise.
    `work` is given { early, nonce }: a run whose own work is done before it ends (a reading, whose copies have their late check
    still to come) says so by `early(result)`, which writes that result at once, as the final one is written, marked `early` and
    with this run's pid, so that `kind`, waiting, and `status` can say what it made; the final result is written over it when the
    run ends. An early result that cannot be written costs nothing: the final one is still written. `nonce` is the one in the lock
    this run holds, for a run that leaves a note of its own on the disk to be believed only while that lock is its own.
    `tag` is an object the run writes into its result, its early result too, whatever the work did (returned, threw or was refused): the working
    copy's run says which copy it is (`copy`) and which request it answers (`asked`), so that `app --when-ready` is answered by its own request
    alone. A key the work's own result has is never read in its place. */
export async function runDetached({ home, folder, command, lock: own, keepAwake = caffeinate, alive = isRunning, now = Date.now, clean = (text) => text, tag = {} }, work) {
  // The episode's lock, or a lock of the command's own (`lock`), for a run that writes no record and so may run beside the others.
  const lock = own ?? lockOf(home, folder);
  /** The error `e` as `clean` says it: the same error when that changes nothing, as for every episode today. */
  const cleaned = (e) => {
    const message = String(e && e.message ? e.message : e);
    const said = clean(message);
    return said === message ? e : Object.assign(new Error(said), e && e.code ? { code: e.code } : {});
  };
  let took;
  try {
    mkdirSync(episodeWork(home, folder), { recursive: true });
    took = takeEpisodeLock(lock, command, alive);
  } catch (e) {
    throw cleaned(e);
  }
  if (took.taking) return { taking: true };
  if (!took.taken) return { running: took.running };
  const started = now();
  const resultOf = (done) => ({ version: 1, command, started, ended: now(), ok: Boolean(done.ok), ...tag, made: (done.made || []).map(clean), failed: (done.failed || []).map(clean), next: done.next ? clean(done.next) : "" });
  const early = (done) => {
    try {
      writeWhole(resultFile(home, folder, command), JSON.stringify({ ...resultOf(done), early: true, pid: process.pid }, null, 2) + "\n");
    } catch (e) {
      // The final result is written all the same.
    }
  };
  let done;
  try {
    keepAwake(process.pid);
    done = await work({ early, nonce: took.nonce });
  } catch (e) {
    done = { ok: false, made: [], failed: [`The work stopped (${e.code || e.message}).`], next: "" };
  }
  const result = resultOf(done);
  // The footage copies a working copy's run could not make (edit.js workcopy): the run's own result is the video's, and they cost it nothing, but the open of the project reads them (app.js placeFootage).
  if (Array.isArray(done.footageFailed) && done.footageFailed.length) result.footageFailed = done.footageFailed.map(clean);
  let failure = null;
  try {
    writeWhole(resultFile(home, folder, command), JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    failure = cleaned(e);
  }
  try {
    releaseEpisodeLock(lock, took.text);
  } catch (e) {
    failure = failure || cleaned(e);
  }
  if (failure) throw failure;
  return result;
}

/** Start a program detached from this one, and do not wait for it: it goes on when this process ends, and what it prints goes
    into the tool's log, ~/Library/Logs/brimm-video.log (in Studio's own home, which BRIMM_VIDEO_HOME may name: home.js). It is started with this process's environment (`env`) but CLAUDECODE: a
    detached run prints to no chat, so it is not under Claude Code, and never marks a chat as holding a session's words (design
    2026-10-26, R8). Which run is detached is told by this, never by the word `--now`, which Claude can type. `spawn` is a test's
    stand-in. */
export function spawnDetached(cmd, args, { spawn: start = spawn, env = process.env, log = join(studioHome(env), "Library", "Logs", "brimm-video.log") } = {}) {
  let out = "ignore";
  try {
    mkdirSync(join(log, ".."), { recursive: true });
    out = openSync(log, "a");
  } catch (e) {
    // Without the log, what the run prints is let go.
  }
  const { CLAUDECODE, ...outside } = env;
  const child = start(cmd, args, { detached: true, stdio: ["ignore", out, out], env: outside });
  child.on("error", () => {});
  child.unref();
  if (typeof out === "number") closeSync(out);
}

/** Start an edit.js command detached, on the episode `folder`, and return at once: the run is
    `node edit.js <command> --now <folder> <args…>`, which runs its work with runDetached. The run is the second half of the
    command that starts it, so it is the same code as the first half: the edit.js of the checkout this code is in (thisCheckout,
    in filing.js), and never the one this Mac's settings name. The settings' checkout is where this Mac's launch agent and her
    folder's commands run from, and when they run it, it is this code. But a Mac that brimm-video set up names brimm-video's
    checkout, whose edit.js has no `workcopy`: it prints its help in the log and does nothing. `ctx.start` is how a program is
    started detached (spawnDetached, unless a test gives another). */
export function startDetached(ctx, { command, folder, args = [] }) {
  ctx.start(process.execPath, [join(thisCheckout(), "tool", "edit.js"), command, "--now", folder, ...args]);
}

/** The lock of an `app --when-ready` run (Phase 3, L7) for the episode `folder`: held as long as the run waits for the video for HyperFrames, which the
    episode's own lock is not, so that nothing she says meanwhile is refused for it. */
export const whenReadyLockOf = (home, folder) => join(episodeWork(home, folder), "when-ready.lock");

/** Start `app --when-ready <folder>`, the run that opens an episode kept on this Mac in HyperFrames once its video is ready: the same edit.js as
    startDetached starts, and the folder itself, with no `--now`. `asked` is the token of the request for the main video's copy that this run answers (workcopy.js
    requestWorkCopy), given after the folder as `--asked <n>` when there is one. */
export function startWhenReady(ctx, folder, asked) {
  ctx.start(process.execPath, [join(thisCheckout(), "tool", "edit.js"), "app", "--when-ready", folder, ...(asked === undefined ? [] : ["--asked", String(asked)])]);
}
