// What is at work on this Mac, in a line: the import's background job, an import's lock, an episode's command, or a video being
// made ready for HyperFrames. The installer asks it (`node busy.js idle-why`) before a real run touches the Mac, so that a repair
// or an update never lands in the middle of a run (design 5, "Updating safely"). It also keeps the marker of an update under way,
// `updating.json` in Studio's support folder, beside settings.json. The app writes it again every thirty seconds while it updates
// Studio, and it is live for two minutes after it was last written, by the file's own time and never by its text: while it is live
// no new work starts. idleWhy never looks at it: the marker stops work from starting, and idleWhy says whether work is still going.
// A line names a command at most, and never an episode's folder: its name can carry a client's name.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runningRun, lockOf, whenReadyLockOf } from "./detached.js";
import { homeRefusal, studioHome } from "./home.js";
import { isMain } from "./is-main.js";
import { isRunning } from "./run.js";
import { runsFolder, settingsFile, workFolder } from "./settings.js";

/** The import's launch agent. */
export const AGENT_LABEL = "com.thebrimm.unedited";

/** What is said when the check itself fails: that it could not be told counts as busy. The same words as install.sh's. */
export const CANNOT_TELL = "Whether anything is at work on this Mac could not be told.";

/** What is said while an update is under way. */
export const UPDATING = "BRIMM Video Studio is being updated on this Mac. Try again once it has finished.";

/** What is said when the marker could not be looked at. */
export const UPDATING_UNTOLD = "Whether BRIMM Video Studio is being updated on this Mac could not be told. Open BRIMM Video Studio and choose Repair.";

/** How long the marker is live after it was last written: two minutes. */
export const UPDATING_HOLD_MS = 120000;

/** The command's usage line. */
const USAGE = "Say: node busy.js idle-why [--launchd -], or node busy.js updating begin, or node busy.js updating end [--look]";

/** The marker of an update under way: updating.json, in the folder settings.json is in. */
export const updatingFile = (home) => join(dirname(settingsFile(home)), "updating.json");

/** Whether an error says that a file or folder is not there. */
const notThere = (e) => e?.code === "ENOENT" || e?.code === "ENOTDIR";

/** Writes the marker with its time set to `now`: to a temp file beside it, then renamed into place. The support folder is made when
    it is not there. False when the marker could not be written. Never throws. */
export function markUpdating(options = {}) {
  let temp = "";
  try {
    const { home = studioHome(), now = Date.now() } = options;
    const file = updatingFile(home);
    mkdirSync(dirname(file), { recursive: true });
    temp = join(dirname(file), `.updating.json.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`);
    writeFileSync(temp, `${JSON.stringify({ version: 1, at: new Date(now).toISOString() })}\n`);
    utimesSync(temp, new Date(now), new Date(now));
    renameSync(temp, file);
    return true;
  } catch (e) {
    try {
      if (temp) rmSync(temp, { force: true });
    } catch (e2) {
      // A temp file that cannot be taken away is left.
    }
    return false;
  }
}

/** UPDATING while the marker is live: it is there, and its modified time is less than UPDATING_HOLD_MS before `now` and not more
    than UPDATING_HOLD_MS after it. UPDATING_UNTOLD when it could not be looked at, else "". Its text is never read. Never throws. */
export function updatingWhy(options = {}) {
  try {
    const { home = studioHome(), now = Date.now() } = options;
    let at;
    try {
      at = statSync(updatingFile(home)).mtimeMs;
    } catch (e) {
      if (notThere(e)) return "";
      throw e;
    }
    return now - at < UPDATING_HOLD_MS && at - now <= UPDATING_HOLD_MS ? UPDATING : "";
  } catch (e) {
    return UPDATING_UNTOLD;
  }
}

/** Takes the marker away, then calls `kick`, when one is given, to ask the background job to take in what waited. Never throws: a
    marker that is not there is no fault, and neither is a kick that throws. */
export function endUpdating(options = {}) {
  const { kick } = options;
  try {
    const { home = studioHome() } = options;
    rmSync(updatingFile(home), { force: true });
  } catch (e) {
    // A marker that cannot be taken away lapses by itself.
  }
  try {
    if (kick) kick();
  } catch (e) {
    // The job looks again of its own accord.
  }
}

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

/** The names in a folder, in order, that are folders; none when it is not there. It throws when the folder is there and cannot be
    listed, so that idleWhy says it could not be told: a safety check fails toward busy. */
function foldersIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (e) {
    if (notThere(e)) return [];
    throw e;
  }
}

/** The process of an import's lock that is held now, or 0: a lock of a live process, written within half a day (run.js's rule).
    An import for episodes keeps its lock in the runs folder, and an import of any other folder keeps it in the temp folder
    (run.js lockFile, unedited.js): both are looked in. A folder that is not there holds nothing; one that is there and cannot be
    listed throws, so that idleWhy says it could not be told. */
function importLockPid(home, temp, alive, now) {
  for (const dir of [runsFolder(home), temp]) {
    let names = [];
    try {
      // Only run.js's name. brimm-video's and brimm-operations' imports write it too, and so count (the careful side). Only this user's own temp folder is read.
      names = readdirSync(dir).filter((n) => /^brimm-transcribe-[0-9a-f]{16}\.lock$/.test(n)).sort();
    } catch (e) {
      if (notThere(e)) continue;
      throw e;
    }
    for (const name of names) {
      try {
        const file = join(dir, name);
        const text = readFileSync(file, "utf8").trim();
        if (!/^\d+$/.test(text)) continue;
        const pid = Number(text);
        if (pid > 0 && alive(pid) && now - statSync(file).mtimeMs < RUNS_LOCK_STALE_MS) return pid;
      } catch (e) {
        // a lock that cannot be read holds nothing
      }
    }
  }
  return 0;
}

/** Why the Mac is not idle, in one line, or "" when nothing is at work; CANNOT_TELL when it fails. Never throws. `temp` is the
    temp folder an import of a folder that is not for episodes keeps its lock in: node's own, unless a test gives another. */
export function idleWhy(options = {}) {
  try {
    const { agentPid = launchdPid(), alive = isRunning, now = Date.now() } = options;
    if (Number.isInteger(agentPid) && agentPid > 0) return `The import is at work: its background job, ${AGENT_LABEL}, is running (process ${agentPid}).`;
    const { home = studioHome(), temp = tmpdir() } = options;
    const lockPid = importLockPid(home, temp, alive, now);
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
  const fromStdin = words[0] === "idle-why" && words.length === 3 && words[1] === "--launchd" && words[2] === "-";
  const idleAsked = words[0] === "idle-why" && (words.length === 1 || fromStdin);
  const beginAsked = words.length === 2 && words[0] === "updating" && words[1] === "begin";
  const look = words.length === 3 && words[0] === "updating" && words[1] === "end" && words[2] === "--look";
  const endAsked = look || (words.length === 2 && words[0] === "updating" && words[1] === "end");
  if (!idleAsked && !beginAsked && !endAsked) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  const refusal = homeRefusal();
  if (refusal) {
    process.stderr.write(`${refusal}\n`);
    process.exit(2);
  }
  if (beginAsked) {
    if (markUpdating({ now: Date.now() })) process.exit(0);
    process.stdout.write("The update could not be marked on this Mac.\n");
    process.exit(1);
  }
  if (endAsked) {
    // With --look the background job is asked to take in what waited while the update was under way. How that ends is not minded.
    const kick = look ? () => spawnSync("/bin/launchctl", ["kickstart", `gui/${process.getuid()}/${AGENT_LABEL}`], { stdio: "ignore" }) : undefined;
    endUpdating({ kick });
    process.exit(0);
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
