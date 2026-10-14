// Long commands run detached. Claude Code stops a command after a few minutes, and an episode's long work (bringing its files
// over, phase 2's finish) can take longer. So such a command is started detached and returns at once, and the run it starts
// works on its own: one run at a time for an episode, holding the episode's lock on this Mac's own disk, with the Mac kept
// awake while it runs. When it ends it leaves a result file, which `status` reads: what it made, what failed, and what to ask
// next. Everything here is on this Mac's own disk, in BRIMM Video Work, and never in Dropbox.
import { spawn } from "node:child_process";
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

/** Read a lock file: its holder, or null. */
function heldIn(file) {
  try {
    const held = JSON.parse(readFileSync(file, "utf8"));
    return held && Number.isInteger(held.pid) ? held : null;
  } catch (e) {
    return null;
  }
}

/** Take the episode's lock for this run: { taken: true }, or { running } naming the command of the live run that holds it.
    The lock is taken by a hard link of a file of this run's own to the lock's name, which fails when the lock is there:
    one run alone can take it. A lock whose run is not running is moved aside by a rename, which one run alone can make,
    and only then taken; when what was moved aside turns out to be the lock of a live run, which took it meanwhile, it is put
    back. */
function takeEpisodeLock(lock, command, alive) {
  const mine = `${lock}.${process.pid}`;
  writeFileSync(mine, JSON.stringify({ pid: process.pid, command }));
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        linkSync(mine, lock);
        return { taken: true };
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const held = heldIn(lock);
      if (held && alive(held.pid)) return { running: held.command };
      const aside = `${lock}.stale.${process.pid}`;
      try {
        renameSync(lock, aside);
      } catch (e) {
        continue;
      }
      const was = heldIn(aside);
      if (was && alive(was.pid)) {
        try {
          linkSync(aside, lock);
        } catch (e) {
          // Yet another run holds it now: it is the one at work.
        }
        rmSync(aside, { force: true });
        return { running: was.command };
      }
      rmSync(aside, { force: true });
    }
    const held = heldIn(lock);
    return { running: held ? held.command : "another run" };
  } finally {
    rmSync(mine, { force: true });
  }
}

/** Run `work` as the detached run of `command` for the episode `folder`: it takes the episode's lock (one left by a run that
    died is taken over), keeps the Mac awake while this process runs (`keepAwake`), awaits `work()`, which resolves
    { ok, made, failed, next }, writes the result file whole, and lets the lock go, whatever happened. Resolves the result, or
    { running } naming the command whose run holds the lock, when another run is at work on the episode: then nothing is
    done. `alive` and `now` are the Mac's own unless a test gives others. */
export async function runDetached({ home, folder, command, keepAwake = caffeinate, alive = isRunning, now = Date.now }, work) {
  const lock = lockOf(home, folder);
  mkdirSync(episodeWork(home, folder), { recursive: true });
  const took = takeEpisodeLock(lock, command, alive);
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
  try {
    writeWhole(resultFile(home, folder, command), JSON.stringify(result, null, 2) + "\n");
  } finally {
    rmSync(lock, { force: true });
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
