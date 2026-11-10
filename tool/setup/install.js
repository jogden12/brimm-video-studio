// The setup engine's staging of what the installer is given to fetch: the transcription model (a download checked against its pinned
// SHA-256), the HyperFrames command-line tools (npm, pinned) and the Chrome that HyperFrames renders with. Each stage tells the shell
// how far it has come, as `progress` events, and none of them shows what a program printed: that goes to the engine's stderr.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, closeSync, createReadStream, existsSync, fstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { GUARD_CLAUDE, claudeAt, claudeEnv, claudeState, versionAtLeast } from "./checks.js";
import { signInQuestion } from "./questions.js";
import { idleWhy } from "../busy.js";
import { PIN, childEnv, cliPath, toolchainDiffers, toolchainDir, toolchainHolds } from "../hyperframes.js";

/** The label of each part of the setup, as the shell shows it. */
export const LABELS = {
  programs: "Checking BRIMM Video Studio",
  model: "Transcription model",
  hyperframes: "HyperFrames tools",
  chrome: "Chrome for HyperFrames",
  installer: "Setting up this Mac",
  claude: "Asking Claude from the background job"
};

/** The bar's guess of the model's size. Nothing is checked against it. */
export const MODEL_BYTES = 1624555275;

/** Where the model is kept on a Mac. tool/run.js looks in the same place: it is a copy from brimm-operations and is not imported,
    so a test holds this path to the one its text names. */
export const modelPath = (home) => join(home, "Library", "Application Support", "BRIMM Transcribe", "ggml-large-v3-turbo.bin");

/** The model's address and SHA-256, from tool/whisper-model.pin.json in the folder `checkout`. */
export function modelPin(checkout) {
  const { url, sha256 } = JSON.parse(readFileSync(join(checkout, "whisper-model.pin.json"), "utf8"));
  return { url, sha256 };
}

/** A file's SHA-256 in hex, read as a stream, so that a model of 1.6 GB is never held in memory. */
export function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

const fail = (message) => Object.assign(new Error(message), { code: "download" });
const stopped = () => Object.assign(new Error("This part was stopped."), { code: "stopped" });
const MODEL_WRONG = "The transcription model that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.";
const MODEL_FAILED = (code) => `The transcription model could not be downloaded (curl ${code}). Check this Mac's internet connection, then choose Repair.`;
/** curl's exit code when it could not write what it downloaded: on a Mac, most likely a disk that is full. */
const CURL_UNSAVED = 23;
const MODEL_UNSAVED = "The transcription model could not be saved on this Mac (curl 23): its disk may be full. Make room on it, then choose Repair.";
const FULL_DISK = "Make room on this Mac's disk, then open BRIMM Video Studio and choose Repair.";
const CLI_FAILED = "The HyperFrames tools could not be fetched as BRIMM Video Studio expects them. Check this Mac's internet connection, then choose Repair.";
const CHROME_FAILED = "HyperFrames could not fetch its copy of Chrome. Check this Mac's internet connection, then choose Repair.";

/** The lines of `text` but docker's: the HyperFrames command line looks for Docker, and a Mac without it says so, which is no fault. */
export function quiet(text) {
  return String(text)
    .split("\n")
    .filter((line) => !/^\/bin\/sh: (line \d+: )?docker: command not found$/.test(line))
    .join("\n");
}

/** Runs a program to its end: `{ code }`, with what it printed given to `errors` (the engine's stderr unless a test gives another) through quiet, once. A stop ends it (code null). */
export function runProgram(program, args, { env, signal, errors = process.stderr } = {}) {
  return new Promise((resolve) => {
    const child = spawn(program, args, { env, stdio: ["ignore", "pipe", "pipe"], signal });
    let printed = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (printed += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (printed += chunk));
    let settled = false;
    const end = (code) => {
      if (settled) return;
      settled = true;
      const shown = quiet(printed);
      if (shown.trim() !== "") errors.write(shown.endsWith("\n") ? shown : `${shown}\n`);
      resolve({ code });
    };
    child.on("error", () => end(null));
    child.on("close", (code) => end(code));
  });
}

const sizeOf = (file) => {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
};

/** Stages the model in `modelPath(home)`: a model that is there with the pin's SHA-256 is left (skipped, and curl is never run);
    otherwise it is downloaded to a .part file, which is given its name only when its SHA-256 is the pin's. The bar's `done` is the
    .part file's size, read every `pollMs`; its `total` is `bytes`, and null once the file is larger than that. Resolves "done" or
    "skipped"; rejects with code "download" and words fit to show (with the `advice` to give, when it is not the internet's fault),
    or "stopped". */
export async function stageModel({ home, pin, programs, progress, signal, bytes = MODEL_BYTES, pollMs = 500 }) {
  const send = (state, done, total, detail) => progress({ part: "model", label: LABELS.model, done, total, state, ...(detail ? { detail } : {}) });
  const target = modelPath(home);
  const part = `${target}.part`;
  const bar = (size) => (size > bytes ? { done: size, total: null } : { done: size, total: bytes });
  const give = (message, advice) => {
    rmSync(part, { force: true });
    send("failed", 0, null, message);
    return Object.assign(new Error(message), { code: "download", ...(advice ? { advice } : {}) });
  };
  if (signal?.aborted) throw stopped();
  send("running", 0, bytes);
  if (existsSync(target) && (await sha256Of(target)) === pin.sha256) {
    const size = sizeOf(target);
    send("skipped", size, size);
    return "skipped";
  }
  mkdirSync(dirname(target), { recursive: true });
  rmSync(part, { force: true });
  const args = ["--fail", "--location", "--silent", "--show-error", "--output", part, pin.url];
  const env = { HOME: home, PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" };
  const timer = setInterval(() => {
    const now = bar(sizeOf(part));
    send("running", now.done, now.total);
  }, pollMs);
  let ran;
  try {
    ran = await runProgram(programs.curl, args, { env, signal });
  } finally {
    clearInterval(timer);
  }
  if (signal?.aborted) {
    rmSync(part, { force: true });
    throw stopped();
  }
  if (ran.code === CURL_UNSAVED) throw give(MODEL_UNSAVED, FULL_DISK);
  if (ran.code !== 0) throw give(MODEL_FAILED(ran.code));
  if ((await sha256Of(part)) !== pin.sha256) throw give(MODEL_WRONG);
  renameSync(part, target);
  const size = sizeOf(target);
  send("done", size, size);
  return "done";
}

/** The arguments npm is given to install the pinned command line: install.sh's own. */
export const npmArgs = (home) => ["install", "--prefix", toolchainDir(home), "--ignore-scripts", "--no-fund", "--no-audit", "--save-exact", `hyperframes@${PIN.version}`];

/** Takes the pinned toolchain's folder away, and only a folder of that kind: one for a version under .toolchain (install.sh's drop_toolchain). */
function dropToolchain(home) {
  const dir = toolchainDir(home);
  if (/\/\.toolchain\/hyperframes-\d[^/]*$/.test(dir)) rmSync(dir, { recursive: true, force: true });
}

/** Stages the pinned HyperFrames command line: left as it is when it is there and is the pin (skipped, and npm is never run), else
    installed by the tools folder's npm. A toolchain that is still not the pin afterwards is taken away and the stage fails. */
export async function stageCli({ home, tools, progress, signal, run = runProgram, holds = toolchainHolds, differs = toolchainDiffers }) {
  const send = (state, detail) => progress({ part: "hyperframes", label: LABELS.hyperframes, done: 0, total: null, state, ...(detail ? { detail } : {}) });
  if (signal?.aborted) throw stopped();
  send("running");
  if (differs(holds(home)) === "") {
    send("skipped");
    return "skipped";
  }
  mkdirSync(toolchainDir(home), { recursive: true });
  const env = { HOME: home, PATH: `${tools}:/usr/bin:/bin`, LANG: "en_US.UTF-8", HYPERFRAMES_NO_TELEMETRY: "1", NPM_CONFIG_UPDATE_NOTIFIER: "false" };
  const ran = await run(join(tools, "npm"), npmArgs(home), { env, signal });
  if (signal?.aborted) {
    dropToolchain(home);
    throw stopped();
  }
  if (ran.code !== 0 || differs(holds(home)) !== "") {
    dropToolchain(home);
    send("failed", CLI_FAILED);
    throw fail(CLI_FAILED);
  }
  send("done");
  return "done";
}

/** Has the pinned command line fetch the Chrome it renders with, as install.sh does, every time: the command line finds its own
    and fetches one only when it has none, and Studio holds no pin for it (Decided 10). */
export async function stageChrome({ home, tools, progress, signal, run = runProgram }) {
  const send = (state, detail) => progress({ part: "chrome", label: LABELS.chrome, done: 0, total: null, state, ...(detail ? { detail } : {}) });
  if (signal?.aborted) throw stopped();
  send("running");
  const node = join(tools, "node");
  const ran = await run(node, [cliPath(home), "browser", "ensure"], { env: childEnv({ base: { HOME: home }, node }), signal });
  if (signal?.aborted) throw stopped();
  if (ran.code !== 0) {
    send("failed", CHROME_FAILED);
    throw fail(CHROME_FAILED);
  }
  send("done");
  return "done";
}

/** Claude Code's version, address and SHA-256, from tool/claude-code.pin.json in the folder `checkout`: null when there is no such file,
    it is no JSON, or it is not whole (a version of three numbers not below the floor, an https address, 64 hex digits). This phase adds no such file. */
export function claudePin(checkout) {
  let pin;
  try {
    pin = JSON.parse(readFileSync(join(checkout, "claude-code.pin.json"), "utf8"));
  } catch {
    return null;
  }
  if (!pin || typeof pin !== "object") return null;
  const { version, url, sha256 } = pin;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version) || !versionAtLeast(version, GUARD_CLAUDE)) return null;
  if (typeof url !== "string" || !/^https:\/\/[^\s/]/.test(url)) return null;
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  return { version, url, sha256 };
}

/** What the downloaded copy of Claude Code is run with: its own install step. The one place to change if the by-hand check finds otherwise. */
export const CLAUDE_INSTALL_ARGS = ["install"];

const CLAUDE_WRONG = "The copy of Claude Code that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.";
const CLAUDE_FAILED = "Claude Code could not be installed. Check this Mac's internet connection, then try again.";
const CLAUDE_UNSAVED = "Claude Code could not be saved on this Mac (curl 23): its disk may be full. Make room on it, then try again.";

/** Installs Claude Code from `pin`: downloads it, runs it with CLAUDE_INSTALL_ARGS only when its SHA-256 is the pin's, takes the
    download away whatever happens, and resolves with the path where claudeAt then finds Claude Code. Rejects with words fit to show
    (code "install"). A download is data until its SHA-256 is the pin's: one that is not is never made runnable and never run. */
export async function installClaudeCode({ home, tools, pin, programs, say = () => {}, signal, run = runProgram }) {
  const refuse = (message) => Object.assign(new Error(message), { code: "install" });
  if (!pin) throw refuse(CLAUDE_FAILED);
  const folder = join(home, "Library", "Caches", "BRIMM Video Studio");
  const part = join(folder, `claude-${pin.version}.part`);
  const env = claudeEnv({ home, tools });
  if (signal?.aborted) throw stopped();
  say("Downloading Claude Code.");
  mkdirSync(folder, { recursive: true });
  rmSync(part, { force: true });
  try {
    const got = await run(programs.curl, ["--fail", "--location", "--silent", "--show-error", "--output", part, pin.url], { env: { HOME: home, PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" }, signal });
    if (signal?.aborted) throw stopped();
    if (got.code === CURL_UNSAVED) throw refuse(CLAUDE_UNSAVED);
    if (got.code !== 0) throw refuse(CLAUDE_FAILED);
    if (!existsSync(part) || (await sha256Of(part)) !== pin.sha256) throw refuse(CLAUDE_WRONG);
    chmodSync(part, 0o755);
    say("Installing Claude Code.");
    const ran = await run(part, CLAUDE_INSTALL_ARGS, { env, signal });
    if (signal?.aborted) throw stopped();
    if (ran.code !== 0) throw refuse(CLAUDE_FAILED);
  } finally {
    rmSync(part, { force: true });
  }
  const where = claudeAt({ home, tools });
  if (!where) throw refuse(CLAUDE_FAILED);
  return where;
}

const SIGN_IN_HOSTS = ["claude.ai", "claude.com", "anthropic.com"];

/** The first link in `text` that may be passed on: https, with no user name and no password, and a host that is claude.ai, claude.com or
    anthropic.com or ends with a dot and one of them. Colour codes are taken off first. Any other link is never passed on; null when none is. */
export function signInLinkOf(text) {
  const plain = String(text).replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, "").replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, "");
  for (const found of plain.match(/https?:\/\/[^\s"'<>\u0000-\u001f]+/g) ?? []) {
    let url;
    try {
      url = new URL(found.replace(/[.,;:)\]]+$/, ""));
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") continue;
    const host = url.hostname.replace(/\.$/, "");
    if (SIGN_IN_HOSTS.some((one) => host === one || host.endsWith(`.${one}`))) return url.href;
  }
  return null;
}

/** How long a sign-in waits for claude's link before it asks without one, and how long claude is given to end by itself after an answer. */
export const LINK_WAIT_MS = 5000;
export const SETTLE_MS = 10000;
/** How long claude's output must be quiet before a link in it is taken as whole: a terminal can deliver a long link in several reads. */
export const LINK_QUIET_MS = 150;

const TOO_LONG = "Signing in took too long. Try again.";
const NOT_SIGNED_IN = "Claude Code is not signed in yet. Try again.";

/** Signs Claude Code in: runs `claude auth login` under `programs.script`, so that it has a terminal of its own, asks `ask` for the
    sign-in (with the link, once claude printed an allowed one), writes a pasted code to claude's input and nowhere else, ends claude, and
    gives back only whether Claude Code is then signed in, its plan, and a `fault` when it is not. With `pty` false it starts nothing and only
    asks claude's state (the shell then runs the terminal itself). Nothing claude prints is shown or kept: only a link of it is read. */
export async function signIn({ home, tools, claude, programs, ask, timeoutMs = 300000, linkWaitMs = LINK_WAIT_MS, settleMs = SETTLE_MS, pty = true }) {
  let timedOut = false;
  let leave = false;
  if (pty) {
    // Claude is started by a small shell that writes its own process id into a file (never the code) and then becomes claude, so that
    // the engine can end claude itself: a real script puts it in a session of its own, which ending script does not reach.
    const folder = join(home, "Library", "Caches", "BRIMM Video Studio");
    mkdirSync(folder, { recursive: true });
    const pidFile = join(folder, "claude-login.pid");
    rmSync(pidFile, { force: true });
    const child = spawn(programs.script, ["-q", "/dev/null", "/bin/sh", "-c", 'echo $$ > "$1"; exec "$2" auth login', "sh", pidFile, claude], { env: claudeEnv({ home, tools }), stdio: ["pipe", "pipe", "pipe"] });
    let ended = false;
    const endedP = new Promise((resolve) => {
      child.on("exit", () => ((ended = true), resolve("ended")));
      child.on("error", () => ((ended = true), resolve("ended")));
    });
    child.stdin.on("error", () => {});
    const stop = () => {
      if (!ended) {
        try {
          const pid = Number(readFileSync(pidFile, "utf8").trim());
          if (Number.isInteger(pid) && pid > 1) process.kill(pid, "SIGTERM");
        } catch {
          // No pid yet, or claude is already gone.
        }
        try {
          child.kill("SIGTERM");
        } catch {
          // Already gone.
        }
      }
      child.stdin.destroy();
    };
    const timers = new Set();
    const wait = (ms, value) => new Promise((resolve) => {
      const timer = setTimeout(() => (timers.delete(timer), resolve(value)), ms);
      timers.add(timer);
    });
    let seen = "";
    let link = null;
    let answered = false;
    let askedWith = null;
    let onLink = () => {};
    let quiet;
    const read = (chunk) => {
      seen = (seen + chunk).slice(-8000);
      if (link) return;
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        const now = signInLinkOf(seen);
        if (now && !link) {
          link = now;
          onLink();
        }
      }, LINK_QUIET_MS);
      timers.add(quiet);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    let hearAnswer;
    const heard = new Promise((resolve) => (hearAnswer = resolve));
    const pose = (question, kind) => {
      askedWith = kind;
      Promise.resolve(ask(question)).then(
        (value) => !answered && ((answered = true), hearAnswer({ value })),
        (error) => !answered && ((answered = true), hearAnswer({ error }))
      );
    };
    const linkP = new Promise((resolve) => (onLink = () => resolve("link")));
    try {
      const limit = wait(timeoutMs, "timeout");
      const first = await Promise.race([endedP, linkP, wait(linkWaitMs, "waited")]);
      if (first !== "ended") {
        if (link) pose(signInQuestion({ link }), "link");
        else {
          pose(signInQuestion(), "none");
          onLink = () => !answered && askedWith === "none" && pose(signInQuestion({ link }), "link");
        }
        const next = await Promise.race([endedP, heard, limit]);
        if (next === "timeout") {
          timedOut = true;
          stop();
        } else if (next !== "ended") {
          if (next.error) {
            stop();
            throw next.error;
          }
          const value = next.value;
          const code = value && typeof value === "object" && typeof value.code === "string" ? value.code.replace(/[\u0000-\u001f\u007f]/g, "") : "";
          if (value === "back" || value === "cancel") {
            stop();
            leave = true;
          } else {
            if (code !== "") child.stdin.write(`${code}\n`);
            const settled = await Promise.race([endedP, limit, wait(settleMs, "settled")]);
            if (settled === "timeout") timedOut = true;
            stop();
          }
        }
      }
      await Promise.race([endedP, wait(5000, "gone")]);
    } finally {
      stop();
      rmSync(pidFile, { force: true });
      for (const timer of timers) clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
    }
  }
  // After a back or a cancel claude is not asked: its answer could take a minute, and the person has left this step.
  if (leave) return { signedIn: false, plan: "" };
  const state = claudeState({ home, tools });
  return state.signedIn ? { signedIn: true, plan: state.plan } : { signedIn: false, plan: null, fault: timedOut ? TOO_LONG : NOT_SIGNED_IN };
}

/** The arguments the installer is given. A fresh Mac names its folders; a held, taken-over or installed Mac gives only its machine and
    the root of its settings, and the installer keeps the folders those hold. With `print`, --print stands where --yes stood. */
export function installerArgs(answers, { app, tools, print = false }) {
  const head = [print ? "--print" : "--yes", "--machine", answers.machine, "--tools", tools, "--app", app];
  return answers.kind === "fresh" ? [...head, "--drop-folder", answers.drop, "--exports-folder", answers.exports, answers.root] : [...head, answers.root];
}

/** The installer's environment, built from scratch: never the whole of `base`. */
export function installerEnv(home, base = process.env) {
  const env = { HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "en_US.UTF-8", NPM_CONFIG_UPDATE_NOTIFIER: "false" };
  for (const name of ["TMPDIR", "USER", "LOGNAME"]) if (base[name]) env[name] = base[name];
  return env;
}

/** Runs the installer to its end: its exit code, and what it printed as one text, through quiet. It has no time limit and is never
    ended by the engine: half an install is worse than a late answer to a cancel. */
export function runInstaller({ args, home, programs }) {
  return new Promise((resolve) => {
    const [program, ...first] = programs.installer;
    const child = spawn(program, [...first, ...args], { env: installerEnv(home), stdio: ["ignore", "pipe", "pipe"] });
    let printed = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (printed += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (printed += chunk));
    let settled = false;
    const end = (code) => {
      if (settled) return;
      settled = true;
      resolve({ code, text: quiet(printed) });
    };
    child.on("error", () => end(1));
    child.on("close", (code) => end(code ?? 1));
  });
}

/** What the installer's exit code means: 0 done, 2 refused (nothing was changed), 75 something is at work, and any other code failed. */
export function installerOutcome(code) {
  return code === 0 ? "done" : code === 2 ? "refused" : code === 75 ? "busy" : "failed";
}

export const BUSY_TRIES = 5;
export const BUSY_WAIT_MS = 30000;
const BUSY_GIVEN_UP = "BRIMM Video Studio is at work on this Mac, so setup cannot finish yet. Wait until it is done, then choose Repair.";

/** Runs the installer once nothing is at work on this Mac. Each try asks `why()` first: a line is shown (progress, waiting) and
    `wait(waitMs)` follows. An exit of 75 counts as a try the same way, and its line is asked again from `why()`: the installer's own
    text is never shown. After `tries` it rejects with code "busy". */
export async function installWhenIdle({ args, home, programs, why = () => idleWhy({ home }), wait, progress, tries = BUSY_TRIES, waitMs = BUSY_WAIT_MS }) {
  const hold = async (line) => {
    progress({ part: "installer", label: LABELS.installer, done: 0, total: null, state: "waiting", detail: line });
    await wait(waitMs);
  };
  for (let attempt = 0; attempt < tries; attempt++) {
    const line = why();
    if (line) {
      await hold(line);
      continue;
    }
    const result = await runInstaller({ args, home, programs });
    if (installerOutcome(result.code) !== "busy") return result;
    await hold(why() || "Something is at work on this Mac.");
  }
  throw Object.assign(new Error(BUSY_GIVEN_UP), { code: "busy" });
}

const checkLogFile = (home) => join(home, "Library", "Logs", "brimm-video-claude-check.log");

/** The installer's check log as it is before the installer runs: which file it is (its inode and birth time) and its size, or null
    when there is none. Its length alone cannot tell an old log from a new one: install.sh takes the old log away before its check,
    and the check's new log can be just as long. */
export function checkLogMark(home) {
  try {
    const { ino, birthtimeMs, size } = statSync(checkLogFile(home));
    return { ino, birthtimeMs, size };
  } catch {
    return null;
  }
}

/** Whether Claude answered from the background job, read from the check log: all of it when it is another file than `before` (its
    mark from before the installer ran) or there was none before, else only what was added to it since (all of it again when it is
    now shorter, since it was written again in place). The first line that says Claude answered or says it could not be asked, else
    a line saying there was no answer. */
export function checkLogSays(home, { before = null } = {}) {
  let text = "";
  try {
    const fd = openSync(checkLogFile(home), "r");
    try {
      const now = fstatSync(fd);
      const bytes = readFileSync(fd);
      const same = before !== null && now.ino === before.ino && now.birthtimeMs === before.birthtimeMs;
      text = bytes.subarray(same && bytes.length >= before.size ? before.size : 0).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    // No log: no answer.
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("Claude answered from here")) return { answered: true, line };
    if (line.startsWith("Claude could not be asked from here")) return { answered: false, line };
  }
  return { answered: false, line: "Claude did not answer from the background job within 90 seconds." };
}
