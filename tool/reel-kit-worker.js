// The headless worker that does a Reel Kit edit (spec 2026-11-23 Reel Kit in Studio, section 4; plan Task 10, Decisions 4 and 5).
//
// Her chat can only run edit.js, so a Reel Kit edit runs as a detached job: `claude -p` on Studio's pinned model, in the project folder,
// following tool/reel-kit/WORKER.md (Reel Kit's own steps 1 to 8, rewritten around Studio's rules), held to that folder and the pinned
// programs by reel-kit-worker-tools.js. One worker runs at a time on a Mac: a job waits, `queued`, for the Mac-wide lock (`macLock`), and
// a job whose project is not made yet is in the queue record (`queueFile`) until it is, so that a second ask for the same part can be
// refused (`queuedFor`). Its project is made (reel-kit-project.js scaffold) inside the lock, never before.
//
// What it says of itself: studio.json, Studio's own, written whole by Studio and never by the worker (Decision 5). The worker writes
// work/worker-status.json (its step and Reel Kit's NEEDS, word for word), which is read the safe way as the run goes and copied in; a bad
// or oversize one is ignored with a line in the log. `statusOf` reads studio.json: a job whose run is no longer running reads as stopped
// at its step, never as working (Review Focus 4). When her usage runs out (usageLimited, Claude Code's result event) the job ends stopped
// at its step, with `why: "usage"`, and a resume carries on that session (`--resume`) from that step, never from the start.
//
// Studio's own names in a project (a CLAUDE.md, a .claude folder: reel-kit-worker-tools.js OWN_NAMES) are Studio's alone: it keeps the list
// of the ones it wrote out of the worker's reach (`ownFile`, `noteOwnFile`), and before and after every run, once whatever still holds
// the project open is named in the log (and left running), sets aside in its own place (`asideDir`) every one that is not on it (reel-kit-worker-own.js; what
// Task 17's `reelkit app` owes it is said there). Either fails the run, `why: "own"`.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { releaseEpisodeLock, takeEpisodeLock } from "./detached.js";
import { thisCheckout } from "./filing.js";
import { binDir, kitDir, reelKitEnv, reelKitHome } from "./reel-kit.js";
import { compositionFingerprint, readCapped, readState, scaffold, writeState } from "./reel-kit-project.js";
import { factsOf } from "./settings.js";
import { JOBS, JOB_ENDS, notesOf, startFault, usageLimited, workerPrompt } from "./reel-kit-worker-jobs.js";
import { appsOwn, noteOwn, stopHolders, sweepOwn, writeWhole } from "./reel-kit-worker-own.js";
import { WORKER_TOOLS, styleWrapperOf, workerArgs, workerSettings } from "./reel-kit-worker-tools.js";
import { isRunning } from "./run.js";
import { findPrograms } from "./unedited.js";

export { OWN_NAMES, WORKER_MODEL, WORKER_TOOLS, workerArgs, workerDecision, workerSettings } from "./reel-kit-worker-tools.js";
export { JOBS, JOB_ENDS, startFault, usageLimited, workerPrompt } from "./reel-kit-worker-jobs.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);


/** How long a worker may run before it is stopped, at its step: four hours. An edit takes minutes to an hour. */
const WORKER_MS = 4 * 3600 * 1000;
/** The most of work/worker-status.json read: a step and a few NEEDS lines. */
const STATUS_MOST = 64 * 1024;
/** The most NEEDS lines, and the longest, taken from it. */
const NEEDS_MOST = 40;
const NEED_LONGEST = 1000;

// --- Places ---

const appSupport = (home) => join(home, "Library", "Application Support", "BRIMM Video");
/** The Mac-wide lock one worker holds while it works: { pid, command, nonce }, taken as an episode's lock is (detached.js). */
export const macLock = (home) => join(appSupport(home), "reel-kit-worker.lock");
/** The queue record: { jobs: [{ id, episode, key, version, mode, job, at, pid }] }, the jobs waiting whose project is not made yet. */
export const queueFile = (home) => join(appSupport(home), "reel-kit-queue.json");
/** The worker's settings file for the project `slug`, written by Studio outside the project, out of the worker's Write reach. */
const settingsSlug = (slug) => {
  if (typeof slug !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) throw new Error(`settingsFileOf: ${JSON.stringify(slug)} is not a slug`);
  return slug;
};
export const settingsFileOf = (home, slug) => join(appSupport(home), "reel-kit-worker", `${settingsSlug(slug)}.json`);
/** The worker's own status file in its project: { step, needs: [{ beat, text }] }. */
export const workerStatusFile = (dir) => join(dir, "work", "worker-status.json");
/** Her notes for a revise, kept with the job so that a resume sends them again: [{ beat, text, at }]. Beside the worker's settings, out of
    its reach (its sandbox writes only in the project and its temp folder), so that what a resume says are her notes are hers. */
export const jobNotesFile = (home, slug) => join(appSupport(home), "reel-kit-worker", `${settingsSlug(slug)}.notes.json`);
/** The list of Studio's own names Studio itself wrote in the project `slug` (reel-kit-worker-own.js), { files: [{ path, dev, ino, size,
    ctimeMs, sha256 }] }, written whole: beside the worker's settings and her notes, out of its reach, so that the worker can add nothing
    to it. Anything under one of those names in the project that is not on it, as noted, is set aside. */
export const ownFile = (home, slug) => join(appSupport(home), "reel-kit-worker", `${settingsSlug(slug)}.own.json`);
/** Note that Studio wrote `rel` (a path inside the project `projectDir`, parted by `/`: `public/CLAUDE.md`, say) under one of its own
    names, as it is now, so that the look over the project leaves it alone while it stays that file: after every write of it, and never
    while a worker runs. It gives the entry noted, and throws for anything but a plain file (reel-kit-worker-own.js noteOwn). */
export const noteOwnFile = (home, slug, projectDir, rel) => noteOwn(ownFile(home, slug), projectDir, rel);
/** Where what the look finds is set aside for the project `slug`, `<slug> set aside/<when>/<its path in the project>`: Studio's own place,
    beside the worker's settings, which its sandbox lets it neither read nor write. A move there is a rename; were it on another disk
    than the project, nothing would be moved (never a copy and a delete). */
export const asideDir = (home, slug) => join(appSupport(home), "reel-kit-worker", `${settingsSlug(slug)} set aside`);
/** Look the project `projectDir` over for Studio's own names and set aside what Studio did not note (reel-kit-worker-own.js sweepOwn, with
    this project's list and set-aside place): { planted, left }. `said` starts each line of `log`. For a run of the worker, and for
    Task 17's `reelkit app`, immediately before it opens the app. */
export const sweepProject = (home, slug, projectDir, { said, log, opened = false } = {}) => sweepOwn({ file: ownFile(home, slug), dir: projectDir, aside: asideDir(home, slug), said, log, ...(opened ? { leave: appsOwn } : {}) });
/** Studio's own mark that it opened the project `slug` in the HyperFrames app (plan Task 17, `reelkit app`): { opened: [ISO times] },
    written whole beside the worker's settings, out of the worker's reach, and only once the app opened it. A project so marked is never
    run by the worker again (runJob), and the look before a later open leaves the app's own public/.claude/ alone (sweepProject's
    `opened`, reel-kit-worker-own.js appsOwn). */
export const openedFile = (home, slug) => join(appSupport(home), "reel-kit-worker", `${settingsSlug(slug)}.opened.json`);
/** The times Studio opened the project `slug` in the app, [] when none or when its mark can't be read. */
export function openedTimes(home, slug) {
  try {
    const mark = JSON.parse(readCapped(openedFile(home, slug), 1 << 20) ?? "null");
    return isObject(mark) && Array.isArray(mark.opened) ? mark.opened.filter((at) => typeof at === "string") : [];
  } catch {
    return [];
  }
}
/** Whether Studio has opened the project `slug` in the app. It fails closed, so that a worker never runs on a project the app may
    have: anything at its mark's place says so, even a mark that can't be read, and so does a mark that can't be looked at (any error but
    "not there") and a slug that is none (its mark's place can't be named). Never throws. */
export function wasOpened(home, slug) {
  try {
    lstatSync(openedFile(home, slug));
    return true;
  } catch (e) {
    return e.code !== "ENOENT";
  }
}
/** Mark that Studio opened the project `slug` in the app at `at` (an ISO time), keeping the times before. */
export const markOpened = (home, slug, at) => writeWhole(openedFile(home, slug), `${JSON.stringify({ opened: [...openedTimes(home, slug), at] }, null, 2)}\n`);
/** The record of the worker at work on this Mac, { pid, start, dir, at }: its `claude`, whose process group holds everything it started,
    so that a worker left running by a runner that died is found and stopped before the next one starts. */
export const macWorkerFile = (home) => join(appSupport(home), "reel-kit-worker.json");
/** The run's own temporary folder (TMPDIR and CLAUDE_CODE_TMPDIR), made fresh each run, one of the two places its sandbox lets it write. */
export const workerTmp = (home, slug) => {
  if (typeof slug !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) throw new Error(`workerTmp: ${JSON.stringify(slug)} is not a slug`);
  return join(reelKitHome(home), "tmp", slug);
};

/** When the process `pid` started, as `ps -o lstart=` says it with LC_ALL=C ("Mon Oct 26 09:00:00 2026", as chain.js reads it), or null
    when it is not running or `ps` can't say: with the pid, it names one process, since a pid is used again. */
export function processStart(pid, run = spawnSync) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const ran = run("/bin/ps", ["-o", "lstart=", "-p", String(pid)], { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 });
    const start = ran.status === 0 ? String(ran.stdout).trim() : "";
    return /^\w{3} \w{3} [ \d]\d \d\d:\d\d:\d\d \d{4}$/.test(start) ? start : null;
  } catch {
    return null;
  }
}

/** Whether the process `pid` that started at `start` still runs: alive, and the same process (its start, when one was recorded). */
const stillRuns = (pid, start, alive, startOf) => Number.isInteger(pid) && alive(pid) && (typeof start !== "string" || startOf(pid) === start);
/** Whether `pid` is, for sure, the process that started at `start`: only then is it ever killed, as a pid is used again. */
const surely = (pid, start, alive, startOf) => typeof start === "string" && stillRuns(pid, start, alive, startOf);

// --- Status ---

/** The most minutes a worker may say its job has left. */
const LEFT_MOST = 600;

/** The worker's status file for `job`, read the safe way: { step, needs, minutesLeft? } or { fault }, the fault said in a few words; null when there is
    none. A step that is not the job's, NEEDS not of their shape, or a file not plain or larger than 64 KB is a fault. */
export function readWorkerStatus(dir, job) {
  const file = workerStatusFile(dir);
  try {
    lstatSync(file);
  } catch {
    return null;
  }
  const text = readCapped(file, STATUS_MOST);
  if (text === null) return { fault: "it is not a plain file of at most 64 KB" };
  let status;
  try {
    status = JSON.parse(text);
  } catch {
    return { fault: "it is not JSON" };
  }
  if (!isObject(status) || !JOBS[job].includes(status.step)) return { fault: "its step is not one of the job's" };
  const needs = status.needs ?? [];
  const fits = (n) => isObject(n) && typeof n.beat === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(n.beat) && typeof n.text === "string" && n.text.length <= NEED_LONGEST;
  if (!Array.isArray(needs) || needs.length > NEEDS_MOST || !needs.every(fits)) return { fault: "its NEEDS are not a list of { beat, text }" };
  // Its guess of the minutes the job has left, when it says one: a whole number from 1 to 600, or nothing.
  const left = Number.isInteger(status.minutesLeft) && status.minutesLeft >= 1 && status.minutesLeft <= LEFT_MOST ? { minutesLeft: status.minutesLeft } : {};
  return { step: status.step, needs: needs.map((n) => ({ beat: n.beat, text: n.text })), ...left };
}

/** What the project in `dir` says of its edit: { state, step, needs, pid, why, minutesLeft }, or null when it has no studio.json. `minutesLeft`
    is the worker's own guess while it works (a whole number), or null. `state` is studio.json's
    (`queued`, `working`, `stopped`, `storyboard`, `ready`, `failed`, and later ones), but a `queued` job whose run (`pid`) is not running,
    and a `working` one whose run and whose `claude` (`worker`, with its start) are neither running, read `stopped` at their step,
    `why: "died"`: never working for a dead process, and working while its `claude` still runs. */
export function statusOf(dir, alive = isRunning, startOf = processStart) {
  const state = readState(dir);
  if (!state) return null;
  const status = {
    state: typeof state.state === "string" ? state.state : "",
    step: typeof state.step === "string" ? state.step : "",
    needs: Array.isArray(state.needs) ? state.needs : [],
    pid: Number.isInteger(state.pid) ? state.pid : null,
    why: typeof state.why === "string" ? state.why : "",
    minutesLeft: Number.isInteger(state.minutesLeft) && state.minutesLeft >= 1 ? state.minutesLeft : null
  };
  const runs = status.pid !== null && alive(status.pid);
  const worker = status.state === "working" && stillRuns(state.worker, state.workerStart, alive, startOf);
  if ((status.state === "working" || status.state === "queued") && !runs && !worker) return { ...status, state: "stopped", why: "died" };
  return status;
}

/** Her line for a stopped edit, by why it stopped: what is true now and the phrase that carries it on. */
export function stoppedLine(status) {
  if (!status || status.state !== "stopped") return "";
  const at = status.step ? ` at ${status.step}` : "";
  if (status.why === "usage") return `Your Claude usage ran out, so this edit stopped${at}. Once it's back, say "carry on" and it picks up from there.`;
  return `This edit stopped${at} before it was done. Say "carry on" and it picks up from there.`;
}

// --- The queue ---

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** The queue's jobs, or none when there is no record or it cannot be read. */
function readQueue(home) {
  const text = readCapped(queueFile(home), 1 << 20);
  try {
    const queue = JSON.parse(text ?? "");
    return Array.isArray(queue?.jobs) ? queue.jobs.filter(isObject) : [];
  } catch {
    return [];
  }
}

/** Change the queue record under its own short lock: `change` is given its jobs, those of runs that are no longer running left out, and
    gives the jobs back. Throws when the lock can't be had in a few seconds. */
function changeQueue(home, change, alive) {
  const lock = `${queueFile(home)}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  let took = null;
  for (let attempt = 0; attempt < 800 && !took?.taken; attempt++) {
    took = takeEpisodeLock(lock, "reelkit queue", alive);
    if (!took.taken) pause(5);
  }
  if (!took?.taken) throw new Error("The Reel Kit queue is busy.");
  try {
    const jobs = readQueue(home).filter((j) => Number.isInteger(j.pid) && alive(j.pid));
    writeWhole(queueFile(home), `${JSON.stringify({ jobs: change(jobs) }, null, 2)}\n`);
  } finally {
    releaseEpisodeLock(lock, took.text);
  }
}

/** Put `entry` ({ id, episode, key, version, mode, job, at, pid }) in the queue record, in place of one with its id: so that her chat's
    `reelkit start` makes its job visible at once, before it returns, with the pid of the detached run it started, and that run, given the
    same id (runJob's `queued`), takes the entry for its own. Throws when the queue's lock can't be had. */
export function enqueue(home, entry, alive = isRunning) {
  if (!isObject(entry) || typeof entry.id !== "string" || entry.id === "" || !Number.isInteger(entry.pid)) throw new Error("enqueue: an entry has an id and a pid");
  changeQueue(home, (jobs) => [...jobs.filter((j) => j.id !== entry.id), entry], alive);
}

/** Take the entry `id` out of the queue record: a start her chat could not finish. Throws when the queue's lock can't be had. */
export function dequeue(home, id, alive = isRunning) {
  changeQueue(home, (jobs) => jobs.filter((j) => j.id !== id), alive);
}

/** The queued jobs of the episode `episode` whose projects are not made yet, oldest first: none whose run is no longer running. */
export const queuedOf = (home, episode, alive = isRunning) => readQueue(home).filter((j) => j.episode === episode && Number.isInteger(j.pid) && alive(j.pid));

/** The queued job for the part `key` of the episode `episode` whose project is not made yet, { episode, key, version, mode, job, at, pid },
    or null: one whose run is no longer running is none. A job whose project is there says so in its studio.json instead (statusOf). */
export function queuedFor(home, episode, key, alive = isRunning) {
  return readQueue(home).find((j) => j.episode === episode && j.key === key && Number.isInteger(j.pid) && alive(j.pid)) ?? null;
}

// --- The job ---

/** The environment the worker runs in: Reel Kit's own (reel-kit.js reelKitEnv: offline, REEL_KIT_HOME, its tools/bin first), with the
    user's name and temporary folder from `base` and zsh for its commands. Nothing of the chat it was started from. */
function workerEnv({ home, node, base, tmp }) {
  const named = Object.fromEntries(["USER", "LOGNAME"].filter((k) => typeof base[k] === "string" && base[k] !== "").map((k) => [k, base[k]]));
  return { ...reelKitEnv({ home, node, base }), ...named, SHELL: "/bin/zsh", TMPDIR: tmp, CLAUDE_CODE_TMPDIR: tmp };
}

/** Make the run's temporary folder fresh: what an earlier run left there taken away (a link in its place taken away as a link). */
export function freshTmp(tmp) {
  try {
    const there = lstatSync(tmp);
    rmSync(tmp, { recursive: there.isDirectory(), force: true });
  } catch {
    // none there
  }
  mkdirSync(tmp, { recursive: true });
}

/** Stop the process group `pid` leads, everything a worker started: SIGTERM, then SIGKILL once `gone()` or `grace` ms have passed. */
export async function killGroup(pid, { grace, gone, wait }) {
  const signal = (sig) => {
    try {
      process.kill(-pid, sig);
    } catch {
      // the group is gone
    }
  };
  signal("SIGTERM");
  for (let waited = 0; waited < grace && !gone(); waited += 25) await wait(25);
  signal("SIGKILL");
}

/** Stop a worker an earlier runner left running (macWorkerFile), before this one starts: it is the Mac's one worker. Its own project's
    studio.json then reads stopped at its step (statusOf). A render (reel-kit-render.js) records its own process group there too, and
    stops one left running before it starts. */
export async function stopLeftOver(home, { alive, startOf, grace, wait, log }) {
  let left = null;
  try {
    left = JSON.parse(readCapped(macWorkerFile(home), 64 * 1024) ?? "null");
  } catch {
    left = null;
  }
  if (isObject(left) && surely(left.pid, left.start, alive, startOf)) {
    log(`A Reel Kit worker left running (process ${left.pid}) was stopped before the next one started.`);
    await killGroup(left.pid, { grace, gone: () => !alive(left.pid), wait });
  }
  rmSync(macWorkerFile(home), { force: true });
}

/** Take the worker's status file away before a run, so that a step from an earlier job is never read as this one's. */
function clearStatus(dir) {
  const file = workerStatusFile(dir);
  try {
    if (!lstatSync(file).isDirectory()) rmSync(file, { force: true });
  } catch {
    // none there
  }
}

/** Her notes kept with a revise, or her ask with a style job (jobNotesFile), as the prompt takes them; none when there are none or they can't be read whole. */
function keptNotes(home, slug) {
  try {
    return notesOf(JSON.parse(readCapped(jobNotesFile(home, slug), 1 << 20) ?? "[]"));
  } catch {
    return [];
  }
}

/** Whether a project's studio.json names its slug, which names its settings, notes and temp folder: no two projects share them. */
const hasSlug = (state) => isObject(state) && typeof state.slug === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(state.slug);

/** Run the worker for `job` in the project `dir`, once it holds the Mac, and resolve how it ended. */
async function work(ctx, { dir, job, notes, from, resume }, deps) {
  const { claude, log, every, limit, grace, wait } = deps;
  const home = ctx.home;
  const steps = JOBS[job];
  const before = readState(dir) ?? {};
  const mark = (fields) => writeState(dir, { ...(readState(dir) ?? {}), ...fields });
  const tools = { project: dir, kit: kitDir(home), rkHome: reelKitHome(home), bin: binDir(home) };
  if (!hasSlug(before)) return { state: "failed", why: "no slug", step: from };
  const slug = before.slug;
  const fail = (why) => {
    mark({ state: "failed", job, step: from, pid: process.pid, why });
    return { state: "failed", why, step: from };
  };
  if (!claude) return fail("no claude");
  if (!isObject(ctx.settings) || typeof ctx.settings.root !== "string") return fail("no settings");

  // Studio's own names in the project that Studio did not write (ownFile is its list) are set aside, out of the project, before the run
  // and after it. What is found before it (left by a run whose runner died, say) refuses this run: nothing is started.
  // Before each look, whatever still holds the project or the temp folder open is named in the log, and left running: it may be hers.
  const look = async (said) => {
    await stopHolders({ dirs: [dir, workerTmp(home, slug)], said, run: deps.run, startOf: (pid) => deps.startOf(pid, deps.run), log });
    return sweepProject(home, slug, dir, { said, log }).planted;
  };
  if ((await look(`Before the Reel Kit worker for ${slug} started`)).length) return fail("own");

  // Her notes (a style job's: her ask) go with the job, so that a resume sends them again.
  const given = resume ? (job === "revise" || job === "style" ? keptNotes(home, slug) : []) : notesOf(notes);
  if (!resume) writeWhole(jobNotesFile(home, slug), `${JSON.stringify(given, null, 2)}\n`);
  const tmp = workerTmp(home, slug);
  freshTmp(tmp);
  // A style job runs Reel Kit's style.py through Studio's offline wrapper: put there whole from this checkout, where the worker can read
  // it and never write it (styleWrapperOf).
  if (job === "style") {
    const wrapper = styleWrapperOf(reelKitHome(home));
    mkdirSync(dirname(wrapper), { recursive: true });
    writeWhole(wrapper, readFileSync(join(ctx.checkout ?? thisCheckout(), "tool", "reel-kit", "style-offline.py"), "utf8"));
  }
  const facts = deps.facts ?? factsOf(home, ctx.settings, {});
  const settingsFile = settingsFileOf(home, slug);
  writeWhole(settingsFile, `${JSON.stringify(workerSettings({ checkout: ctx.checkout ?? thisCheckout(), node: ctx.node ?? process.execPath, ...tools, facts, tmp }), null, 2)}\n`);
  const lists = WORKER_TOOLS({ ...tools, tmp });
  const carryOn = resume && typeof before.session === "string" ? before.session : null;
  let session = carryOn ?? randomUUID();
  const args = workerArgs({ settingsFile, ...lists, ...(carryOn ? { resume: carryOn } : { session }) });
  const prompt = workerPrompt({ job, ...tools, title: typeof before.title === "string" ? before.title : null, notes: given, from, resumed: Boolean(resume) });

  clearStatus(dir);
  mark({ state: "working", job, step: from, pid: process.pid, why: "", session, needs: resume && Array.isArray(before.needs) ? before.needs : [] });

  // Its own process group, so that everything it starts (Python, ffmpeg, HyperFrames' browser) is stopped with it.
  const env = workerEnv({ home, node: ctx.node ?? process.execPath, base: ctx.base ?? { HOME: home }, tmp });
  const child = spawn(claude, args, { cwd: dir, env, stdio: ["pipe", "pipe", "pipe"], detached: true });
  let exited = false;
  const closed = new Promise((done) => {
    child.on("error", () => done({ code: 127, signal: "" }));
    child.on("exit", () => (exited = true));
    child.on("close", (c, s) => done({ code: c, signal: s }));
  });
  let init = null;
  let unsafe = false;
  let usage = false;
  let result = null;
  let timedOut = false;
  let stderr = "";
  let poll = null;
  let clock = null;
  let code;
  let signal;
  let planted = [];
  let through = false;
  // From here on, whatever throws, its process group is stopped, and the project looked over, before the Mac's lock is let go.
  try {
    const workerStart = child.pid ? processStart(child.pid) : null;
    if (child.pid) {
      writeWhole(macWorkerFile(home), `${JSON.stringify({ pid: child.pid, start: workerStart, dir, at: new Date().toISOString() })}\n`);
      mark({ worker: child.pid, workerStart: workerStart ?? undefined });
      deps.started?.(child.pid);
    }
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));

    let fault = "";
    const stopAll = () => (child.pid ? killGroup(child.pid, { grace, gone: () => exited, wait }) : Promise.resolve());
    const copy = () => {
      if (unsafe) return;
      try {
        const status = readWorkerStatus(dir, job);
        if (status === null) return;
        if (status.fault) {
          if (status.fault !== fault) log(`Reel Kit's worker-status.json in ${slug} was ignored: ${status.fault}.`);
          fault = status.fault;
          return;
        }
        fault = "";
        const now = readState(dir) ?? {};
        if (now.step !== status.step || JSON.stringify(now.needs ?? []) !== JSON.stringify(status.needs) || now.minutesLeft !== status.minutesLeft) mark({ step: status.step, needs: status.needs, minutesLeft: status.minutesLeft });
      } catch (e) {
        log(`Reel Kit's worker status for ${slug} could not be copied: ${e.code || e.message}.`);
      }
    };
    const stop = (why) => {
      log(`Reel Kit's worker for ${slug} was stopped: ${why}.`);
      unsafe = true;
      void stopAll();
    };
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (!isObject(event) || unsafe) return;
        if (init === null) {
          if (event.type !== "system" || event.subtype !== "init") return void stop("it did something before it said how it started");
          init = event;
          const why = startFault(event);
          if (why) return void stop(`it did not start as it was told (${why})`);
          // The Claude Code it ran on, kept, and a line when it is not the one the last run said: its flags and events were checked on one.
          const version = typeof event.claude_code_version === "string" && /^[0-9A-Za-z.+-]{1,40}$/.test(event.claude_code_version) ? event.claude_code_version : null;
          const last = readState(dir)?.claudeCode;
          if (version !== null && version !== last) {
            if (typeof last === "string") log(`Reel Kit's worker for ${slug} ran on Claude Code ${version}; the last run was on ${last}.`);
            mark({ claudeCode: version });
          }
          if (typeof event.session_id === "string" && event.session_id !== session) {
            session = event.session_id;
            mark({ session });
          }
          return;
        }
        if (usageLimited(event)) usage = true;
        if (event.type === "result") result = event;
        copy();
      } catch (e) {
        log(`Reel Kit's worker stream for ${slug} could not be read: ${e.code || e.message}.`);
      }
    });
    poll = setInterval(copy, every);
    clock = setTimeout(() => {
      timedOut = true;
      void stopAll();
    }, limit);
    ({ code, signal } = await closed);
    copy();
    through = true;
  } finally {
    clearInterval(poll);
    clearTimeout(clock);
    // Anything it left running in its group goes with it.
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // nothing left
      }
      // Its `claude` is gone before the project is looked over (it is, but when something threw).
      for (let waited = 0; waited < grace && !exited; waited += 25) await wait(25);
    }
    // Studio's own names left anywhere in the project (a folder moved in, a link): each is set aside and named in the log, and the run
    // fails, also when something threw (the throw goes on its way after).
    planted = await look(`After the Reel Kit worker for ${slug} ended`);
    if (planted.length && !through) {
      try {
        mark({ state: "failed", why: "own", worker: undefined, workerStart: undefined });
      } catch (e) {
        log(`Reel Kit's worker for ${slug} left Studio's own names in its project, and its studio.json could not say so: ${e.code || e.message}.`);
      }
    }
  }

  const at = readState(dir) ?? {};
  const reached = at.step === steps.at(-1);
  const finished = result !== null && result.is_error === false && code === 0;
  let end;
  if (unsafe) end = { state: "failed", why: "unsafe" };
  else if (planted.length) end = { state: "failed", why: "own" };
  else if (usage && !(finished && reached)) end = { state: "stopped", why: "usage" };
  else if (timedOut) end = { state: "stopped", why: "time" };
  else if (finished) end = reached ? { state: JOB_ENDS[job], why: "" } : { state: "stopped", why: "unfinished" };
  else if (signal) end = { state: "stopped", why: "killed" };
  else end = { state: "failed", why: "error" };
  // An edit built to render records what it is (Task 14, Decision 6): its render refuses it once it was changed in HyperFrames. One that
  // can't be fingerprinted (a link in it) is not ready: it fails, as a render of what a link leads to is never made. An earlier render's
  // outcome is of an edit no longer there.
  let recorded = {};
  if (end.state === "ready") {
    try {
      recorded = { fingerprint: compositionFingerprint(dir), lastRender: undefined };
    } catch (e) {
      log(`Reel Kit's ${slug} could not be fingerprinted, so it is not ready to render: ${e.code || e.message}.`);
      end = { state: "failed", why: "fingerprint" };
    }
  }
  if (end.state === "failed" && !unsafe && end.why !== "fingerprint") log(`Reel Kit's worker for ${slug} ended ${code ?? signal}: ${stderr.trim().split("\n").at(-1) ?? ""}`);
  // What it said last, when it ended short of its last step (WORKER.md: a refused command it needed is said there), for Jason.
  if (end.state !== JOB_ENDS[job] && typeof result?.result === "string") log(`Reel Kit's worker for ${slug} stopped at ${at.step ?? from} (${end.why}): ${result.result.slice(0, 300)}`);
  mark({ ...end, ...recorded, worker: undefined, workerStart: undefined, minutesLeft: undefined });
  try {
    const left = JSON.parse(readCapped(macWorkerFile(home), 64 * 1024) ?? "null");
    if (isObject(left) && left.pid === child.pid) rmSync(macWorkerFile(home), { force: true });
  } catch {
    // the record is another's, or none
  }
  return { ...end, step: typeof at.step === "string" ? at.step : from };
}

/** Run one job of the Reel Kit worker, start to end; it resolves { state, why, step, dir }, and `made` when it made the project. `spec`:
    - `job`, one of JOBS; `dir`, the project, when it is made; or, for an edit whose project is not made yet, `make` (what scaffold takes:
      { found, record, key, mode, title, version }) with `episode`, `key`, `version` and `mode` for the queue record, and `queued`, the id
      of the entry her chat wrote for this run (enqueue), which it takes for its own;
    - `notes`, her notes for a revise ({ beat, text, at }), kept with the job (jobNotesFile, beside its settings, out of its reach); `from`, the step to start from (the
      job's first by default); `resume`, to carry on a stopped job: its job (studio.json's, and a `job` given must be the same, or nothing
      is done: `why: "job"`), from the step studio.json says, in its own session, with a revise's notes again.
    In this order: the job is marked queued (its studio.json, or the queue record), before anything waits; it waits for the Mac-wide lock
    while another job holds it; inside the lock, a worker an earlier runner left running is stopped (macWorkerFile), then, for `make`, its
    project is made (scaffold: her pack synced, the folder, the copy, new.py) and its queue record taken away; then the worker runs, in its
    own process group, which is stopped whole (SIGTERM, then SIGKILL after `grace`) when it runs out of time or does not start as told, and
    the lock is let go whatever happened. Before the worker is started, and after it has ended (also when something threw), every
    process that still holds the project or the run's temp folder open is named in the log and left running (reel-kit-worker-own.js
    stopHolders: it kills nothing, as a holder may be hers) and the project
    is looked over for Studio's own names (sweepOwn): each that Studio did not note (`noteOwnFile`), or that is no longer the file
    noted, is moved to `asideDir`'s `<slug> set aside/<when>/`, out of the worker's reach, never deleted, and the run is
    `failed`, `why: "own"`; found before the worker starts, nothing is started. A project whose run is running is left as it is: { state, why: "running" }, but one marked queued by this very run (by its pid); one whose run died
    but whose `claude` still runs is queued, and that `claude` stopped once this job holds the Mac.
    `deps`: `claude` (the program; findPrograms' by default), `scaffold` and `scaffoldDeps`, `inLock` (a made project's last look, inside
    the lock: "" or why the job is not run), `alive`, `startOf` (processStart), `wait` (ms
    to a promise), `every` (how often, in ms, the lock and the status file are looked at), `limit`, `grace`, `facts` (settings.js factsOf of
    ctx.settings by default), `log`, `run` (spawnSync: `lsof` and `ps`, for what holds the project open), and `started`, called with the `claude` pid once it runs (a test's, to throw there). `ctx`: `home`, `settings` (this Mac's: BRIMM Video's place for the sandbox), `checkout`, `node`, `base`. */
export async function runJob(ctx, spec, deps = {}) {
  const {
    claude = findPrograms().claude, scaffold: make = scaffold, scaffoldDeps = {}, inLock, alive = isRunning, startOf = processStart,
    wait = (ms) => new Promise((r) => setTimeout(r, ms)), every = 2000, limit = WORKER_MS, grace = 5000, facts, log = () => {}, run = spawnSync
  } = deps;
  const home = ctx.home;
  let dir = spec.dir ?? null;
  if (dir === null && !isObject(spec.make)) throw new Error("runJob: a job is given its project, or what makes it");
  const before = dir !== null ? readState(dir) : null;
  let job = spec.job;
  if (spec.resume && dir !== null && before !== null && Object.hasOwn(JOBS, before.job ?? "")) {
    if (job !== undefined && job !== before.job) {
      const status = statusOf(dir, alive, startOf);
      return { state: status.state, why: "job", step: status.step, dir };
    }
    job = before.job;
  }
  if (!Object.hasOwn(JOBS, job ?? "")) throw new Error(`runJob: ${JSON.stringify(job)} is not a job`);
  const at = new Date().toISOString();

  let from = spec.from ?? JOBS[job][0];
  let entry = null;
  if (dir !== null) {
    const status = statusOf(dir, alive, startOf);
    if (status === null) return { state: "failed", why: "no project", step: "", dir };
    if (!hasSlug(before)) return { state: "failed", why: "no slug", step: status.step, dir };
    // A project Studio opened in the HyperFrames app is the app's from then on (plan Task 17): nothing of the worker's runs in it again,
    // and nothing of it is marked. Further Reel Kit changes are a new version.
    if (wasOpened(home, before.slug)) return { state: status.state, why: "opened", step: status.step, dir };
    // A project marked queued by this very run (her chat's first half marks it with the pid of the run it starts) is this job's own.
    const runs = status.pid !== null && status.pid !== process.pid && alive(status.pid);
    if ((status.state === "working" || status.state === "queued") && runs) return { state: status.state, why: "running", step: status.step, dir };
    if (spec.resume) from = JOBS[job].includes(status.step) ? status.step : JOBS[job][0];
    if (!JOBS[job].includes(from)) throw new Error(`runJob: ${JSON.stringify(from)} is not a step of ${job}`);
    writeState(dir, { ...readState(dir), state: "queued", job, step: from, pid: process.pid, why: "", queuedAt: at });
  } else {
    // The entry her chat's first half wrote for this run (`queued`, its id) is taken for its own: one entry per job.
    entry = { id: typeof spec.queued === "string" && spec.queued !== "" ? spec.queued : randomUUID(), episode: spec.episode, key: spec.key, version: spec.version ?? null, mode: spec.mode, job, at, pid: process.pid };
    changeQueue(home, (jobs) => [...jobs.filter((j) => j.id !== entry.id), entry], alive);
  }

  const lock = macLock(home);
  mkdirSync(dirname(lock), { recursive: true });
  let took;
  for (;;) {
    took = takeEpisodeLock(lock, `reelkit ${job}`, alive);
    if (took.taken) break;
    await wait(every);
  }
  try {
    await stopLeftOver(home, { alive, startOf, grace, wait, log });
    // A made project's job is judged again here, after however long it waited (`inLock`: "" to go on, or why not): nothing is run then,
    // and the edit reads as stopped at the step it would have started from, so that "carry on" runs it once it may.
    if (dir !== null && typeof inLock === "function") {
      const why = await inLock();
      if (why) {
        log(`Reel Kit's ${job} of ${before.slug} was not run: ${why}`);
        writeState(dir, { ...(readState(dir) ?? {}), state: "stopped", job, step: from, pid: process.pid, why: "refused", queuedAt: undefined });
        return { state: "stopped", why: "refused", step: from, dir };
      }
    }
    let made = null;
    if (dir === null) {
      try {
        made = await make(ctx, spec.make, scaffoldDeps);
      } finally {
        changeQueue(home, (jobs) => jobs.filter((j) => j.id !== entry.id), alive);
      }
      if (!isObject(made) || typeof made.dir !== "string") return { state: "failed", why: made?.why ?? "not made", step: "", dir: null };
      dir = made.dir;
    }
    const ended = await work(ctx, { dir, job, notes: spec.notes ?? [], from, resume: spec.resume }, { claude, log, every, limit, grace, wait, alive, startOf, facts, run, started: deps.started });
    return { ...ended, dir, ...(made ? { made } : {}) };
  } finally {
    releaseEpisodeLock(lock, took.text);
  }
}
