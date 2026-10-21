// Long commands run detached. Claude Code stops a command after a few minutes, and an episode's long work (bringing its files
// over, phase 2's finish) can take longer. So such a command is started detached and returns at once, and the run it starts
// works on its own: one run at a time for an episode, holding the episode's lock on this Mac's own disk, with the Mac kept
// awake while it runs. When it ends it leaves a result file, which `status` reads: what it made, what failed, and what to ask
// next. Everything here is on this Mac's own disk, in BRIMM Video Work, and never in Dropbox.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { episodeWork } from "./settings.js";
import { caffeinate } from "./filing.js";
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

/** The lock's holder, { pid, command }, or null when there is no lock or it cannot be read. */
function holder(home, folder) {
  try {
    const held = JSON.parse(readFileSync(lockOf(home, folder), "utf8"));
    return held && Number.isInteger(held.pid) && typeof held.command === "string" ? held : null;
  } catch (e) {
    return null;
  }
}

/** The command a detached run is at for an episode on this Mac, or "" when none is: a lock whose run is no longer running
    was left by a run that died, and counts as none. */
export function runningCommand(home, folder, alive = isRunning) {
  const held = holder(home, folder);
  return held && alive(held.pid) ? held.command : "";
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

/** Take the episode's lock for this run: { taken: true, text } with the lock's text, or { running } naming the command of the
    live run that holds it. Safe for any number of runs at once:
    - the lock is taken by a hard link of a file of this run's own to the lock's name, which fails when the lock is there,
      so one run alone takes a free lock;
    - a lock whose run is not running is taken away only by the run that holds the takeover guard (taken by a hard link too),
      and only when its text is still, word for word, the dead run's: no live run's lock is ever taken away. */
function takeEpisodeLock(lock, command, alive) {
  const text = JSON.stringify({ pid: process.pid, command, nonce: randomUUID() });
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
        return { taken: true, text };
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
          return { taken: true, text };
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
function releaseEpisodeLock(lock, text) {
  if (textOf(lock) === text) rmSync(lock, { force: true });
}

/** Run `work` as the detached run of `command` for the episode `folder`: it takes the episode's lock (one left by a run that
    died is taken over), keeps the Mac awake while this process runs (`keepAwake`), awaits `work()`, which resolves
    { ok, made, failed, next }, writes the result file whole, and lets the lock go, whatever happened. The bring of a take-over
    that brought every file also resolves `takeOver`, { by, since, next }: the claim it was for, and what to say next while
    that claim stands, which the result keeps. Resolves the result, or { running } naming the command whose run holds the lock, when another run is at
    work on the episode: then nothing is done. `alive` and `now` are the Mac's own unless a test gives others. */
export async function runDetached({ home, folder, command, keepAwake = caffeinate, alive = isRunning, now = Date.now }, work) {
  const lock = lockOf(home, folder);
  mkdirSync(episodeWork(home, folder), { recursive: true });
  const took = takeEpisodeLock(lock, command, alive);
  if (took.taking) return { taking: true };
  if (!took.taken) return { running: took.running };
  const started = now();
  let done;
  try {
    keepAwake(process.pid);
    done = await work();
  } catch (e) {
    done = { ok: false, made: [], failed: [`The work stopped (${e.code || e.message}).`], next: "" };
  }
  const result = { version: 1, command, started, ended: now(), ok: Boolean(done.ok), made: done.made || [], failed: done.failed || [], next: done.next || "" };
  if (done.takeOver) result.takeOver = done.takeOver;
  try {
    writeWhole(resultFile(home, folder, command), JSON.stringify(result, null, 2) + "\n");
  } finally {
    releaseEpisodeLock(lock, took.text);
  }
  return result;
}

/** Start a program detached from this one, and do not wait for it: it goes on when this process ends, and what it prints goes
    into the tool's log, ~/Library/Logs/brimm-video.log. */
export function spawnDetached(cmd, args, { log = join(process.env.HOME || homedir(), "Library", "Logs", "brimm-video.log") } = {}) {
  let out = "ignore";
  try {
    mkdirSync(join(log, ".."), { recursive: true });
    out = openSync(log, "a");
  } catch (e) {
    // Without the log, what the run prints is let go.
  }
  const child = spawn(cmd, args, { detached: true, stdio: ["ignore", out, out] });
  child.on("error", () => {});
  child.unref();
  if (typeof out === "number") closeSync(out);
}

/** Start an edit.js command detached, on the episode `folder`, with this checkout's edit.js, and return at once: the run is
    `node edit.js <command> --now <folder> <args…>`, which runs its work with runDetached. `ctx.start` is how a program is
    started detached (spawnDetached, unless a test gives another). */
export function startDetached(ctx, { command, folder, args = [] }) {
  ctx.start(process.execPath, [join(ctx.settings.checkout, "tool", "edit.js"), command, "--now", folder, ...args]);
}
