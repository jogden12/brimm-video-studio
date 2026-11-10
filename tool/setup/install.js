// The setup engine's staging of what the installer is given to fetch: the transcription model (a download checked against its pinned
// SHA-256), the HyperFrames command-line tools (npm, pinned) and the Chrome that HyperFrames renders with. Each stage tells the shell
// how far it has come, as `progress` events, and none of them shows what a program printed: that goes to the engine's stderr.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
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
    child.stdout.on("data", (chunk) => (printed += chunk));
    child.stderr.on("data", (chunk) => (printed += chunk));
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
    "skipped"; rejects with code "download" and words fit to show, or "stopped". */
export async function stageModel({ home, pin, programs, progress, signal, bytes = MODEL_BYTES, pollMs = 500 }) {
  const send = (state, done, total, detail) => progress({ part: "model", label: LABELS.model, done, total, state, ...(detail ? { detail } : {}) });
  const target = modelPath(home);
  const part = `${target}.part`;
  const bar = (size) => (size > bytes ? { done: size, total: null } : { done: size, total: bytes });
  const give = (message, code = "download") => {
    rmSync(part, { force: true });
    send("failed", 0, null, message);
    return Object.assign(new Error(message), { code });
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
