// What is at work on this Mac, in a line: the import's background job, an import's lock, an episode's command, or a video being
// made ready for HyperFrames. The installer asks it (`node busy.js idle-why`) before a real run touches the Mac, so that a repair
// or an update never lands in the middle of a run (design 5, "Updating safely"). Phase 7 adds the `updating.json` marker here.
// A line names a command at most, and never an episode's folder: its name can carry a client's name.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { runningRun, lockOf, whenReadyLockOf } from "./detached.js";
import { homeRefusal, studioHome } from "./home.js";
import { isMain } from "./is-main.js";
import { isRunning } from "./run.js";
import { runsFolder, workFolder } from "./settings.js";

/** The import's launch agent. */
export const AGENT_LABEL = "com.thebrimm.unedited";

/** What is said when the check itself fails: that it could not be told counts as busy. The same words as install.sh's. */
export const CANNOT_TELL = "Whether anything is at work on this Mac could not be told.";

/** How old an import's lock may be and still count: run.js's STALE_LOCK_MS (half a day), which run.js does not export. */
export const RUNS_LOCK_STALE_MS = 43200000;

/** The process number on the first line of what `launchctl print` said that is `pid = N` with N above 0, or null. A line like
    `parent pid = N` is not one. */
export function pidFromPrint(printed) {
  for (const line of String(printed).split("\n")) {
    const found = /^\s*pid = (\d+)\s*$/.exec(line);
    if (found) {
      const pid = Number(found[1]);
      return pid > 0 ? pid : null;
    }
  }
  return null;
}

/** The process number launchd gives the import's background job, or null when the job is not loaded or is not running. */
export function launchdPid(options = {}) {
  try {
    const { run = spawnSync, uid = process.getuid() } = options;
    const ran = run("/bin/launchctl", ["print", `gui/${uid}/${AGENT_LABEL}`], { encoding: "utf8" });
    return ran && ran.status === 0 ? pidFromPrint(ran.stdout) : null;
  } catch (e) {
    return null;
  }
}

/** The names in a folder, in order, that are folders; none when it cannot be listed. */
function foldersIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (e) {
    return [];
  }
}

/** The process of an import's lock that is held now, or 0: a lock of a live process, written within half a day (run.js's rule). */
function importLockPid(home, alive, now) {
  const runs = runsFolder(home);
  let names = [];
  try {
    names = readdirSync(runs).filter((n) => /^brimm-transcribe-.*\.lock$/.test(n)).sort();
  } catch (e) {
    return 0;
  }
  for (const name of names) {
    try {
      const file = join(runs, name);
      const text = readFileSync(file, "utf8").trim();
      if (!/^\d+$/.test(text)) continue;
      const pid = Number(text);
      if (pid > 0 && alive(pid) && now - statSync(file).mtimeMs < RUNS_LOCK_STALE_MS) return pid;
    } catch (e) {
      // a lock that cannot be read holds nothing
    }
  }
  return 0;
}

/** Why the Mac is not idle, in one line, or "" when nothing is at work; CANNOT_TELL when it fails. Never throws. */
export function idleWhy(options = {}) {
  try {
    const { agentPid = launchdPid(), alive = isRunning, now = Date.now() } = options;
    if (Number.isInteger(agentPid) && agentPid > 0) return `The import is at work: its background job, ${AGENT_LABEL}, is running (process ${agentPid}).`;
    const { home = studioHome() } = options;
    const lockPid = importLockPid(home, alive, now);
    if (lockPid) return `An import is at work: it holds its lock (process ${lockPid}).`;
    const folders = foldersIn(workFolder(home));
    for (const name of folders) {
      const run = runningRun(home, name, alive, lockOf(home, name));
      if (!run) continue;
      return /^[a-z][a-z-]{0,39}$/.test(run.command)
        ? `A command is at work on an episode: ${run.command} (process ${run.pid}).`
        : `A command is at work on an episode (process ${run.pid}).`;
    }
    for (const name of folders) {
      const run = runningRun(home, name, alive, whenReadyLockOf(home, name));
      if (run) return `A video is being made ready for HyperFrames (process ${run.pid}).`;
    }
    return "";
  } catch (e) {
    return CANNOT_TELL;
  }
}

if (isMain(import.meta.url)) {
  const words = process.argv.slice(2);
  const fromStdin = words.length === 3 && words[1] === "--launchd" && words[2] === "-";
  if (words[0] !== "idle-why" || !(words.length === 1 || fromStdin)) {
    process.stderr.write("Say: node busy.js idle-why [--launchd -]\n");
    process.exit(2);
  }
  const refusal = homeRefusal();
  if (refusal) {
    process.stderr.write(`${refusal}\n`);
    process.exit(2);
  }
  let agentPid;
  if (fromStdin) {
    let printed;
    try {
      printed = readFileSync(0, "utf8");
    } catch (e) {
      process.stderr.write("Standard input could not be read.\n");
      process.exit(2);
    }
    agentPid = pidFromPrint(printed);
  } else {
    agentPid = launchdPid();
  }
  const why = idleWhy({ agentPid });
  if (why) {
    process.stdout.write(`${why}\n`);
    process.exit(1);
  }
  process.exit(0);
}
