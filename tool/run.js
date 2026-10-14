// Copied in part from brimm-operations transcribe/transcribe.js at commit 84a2f61, to be kept in step by hand.
// What the tool borrows from the transcript tool: how a program is run, where the programs are on this Mac, and the lock that
// says a run is at work on a folder. The lock is the transcript tool's own, so the two never work on one folder at the same
// time.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MODEL_NAME = "ggml-large-v3-turbo.bin";
/** A lock older than this was left by a run that died. */
const STALE_LOCK_MS = 12 * 3600 * 1000;

/** Run a program to its end. Resolves {code, stderr}; never rejects, so a missing program is one more reason among the others.
    Only the end of what it prints is kept, `keep` characters of it. `signal` names what killed it, when something did.
    A program that prints its answer, on standard output, has it kept when `out` is given: the start of it, `out` characters at
    most, as `stdout`. Asked for none, the answer is not read and nothing is said of it.
    Three more things are done only when they are asked for:
    - `input` is a text the program is given to read, on its standard input. Given none, it has nothing to read. A program
      that ends before it has read the text is one more program that ended, and what it ended with is still the answer.
    - `cwd` is the folder the program is run in. Given none, that is the folder the tool itself was started in.
    - `limit` is how long the program may run, in milliseconds. One still running then is killed, and `outOfTime` is true.
      It is killed outright, since a program that hangs may hear nothing gentler. What it was given to read and what it
      prints are then let go of and no longer waited for: something the program started may hold on to them long after
      the program is gone. */
export const runProgram = (cmd, args, { keep = 4000, out = 0, input, cwd, limit = 0 } = {}) => new Promise((done) => {
  let stderr = "";
  let stdout = "";
  let outOfTime = false;
  const answer = () => ({ ...(outOfTime ? { outOfTime } : {}), ...(out ? { stdout } : {}) });
  const child = spawn(cmd, args, { stdio: [input == null ? "ignore" : "pipe", out ? "pipe" : "ignore", "pipe"], ...(cwd ? { cwd } : {}) });
  child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-keep); });
  if (out) {
    // Read as text, a character that comes in two pieces is put together. All of it is read, so the program is never held up.
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => { if (stdout.length < out) stdout = (stdout + d).slice(0, out); });
  }
  if (input != null) {
    // Writing to a program that has gone is an error of its own. Nobody listening for it, it would stop the tool.
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  }
  const clock = limit > 0 ? setTimeout(() => {
    outOfTime = true;
    child.kill("SIGKILL");
    for (const pipe of [child.stdin, child.stdout, child.stderr]) if (pipe) pipe.destroy();
  }, limit) : null;
  child.on("error", (e) => {
    clearTimeout(clock);
    done({ code: 127, stderr: String(e.message || e), ...answer() });
  });
  child.on("close", (code, signal) => {
    clearTimeout(clock);
    done({ code: code == null ? 1 : code, stderr, signal: signal || "", ...answer() });
  });
});

/** Where ffmpeg, the transcriber and its model are on this Mac. `missing` says what is not there, in plain words. */
export function findTools({ exists = existsSync, env = process.env, model = "" } = {}) {
  const dirs = [...String(env.PATH || "").split(":").filter(Boolean), "/opt/homebrew/bin", "/usr/local/bin"];
  const find = (names) => {
    for (const name of names) {
      for (const dir of dirs) if (exists(join(dir, name))) return join(dir, name);
    }
    return "";
  };
  const ffmpeg = find(["ffmpeg"]);
  const whisper = find(["whisper-cli", "whisper-cpp"]);
  const wanted = model || env.BRIMM_WHISPER_MODEL || join(String(env.HOME || ""), "Library", "Application Support", "BRIMM Transcribe", MODEL_NAME);
  const missing = [];
  if (!ffmpeg) missing.push("ffmpeg is not installed.");
  if (!whisper) missing.push("The transcriber (whisper-cpp) is not installed.");
  if (!exists(wanted)) missing.push(`The transcriber's model is not at ${wanted}.`);
  return { ffmpeg, whisper, model: wanted, missing };
}

export const lastLine = (text) => String(text || "").trim().split("\n").filter(Boolean).pop() || "no reason given";
export const sizeOnDisk = (file) => {
  try {
    return statSync(file).size;
  } catch (e) {
    return 0;
  }
};

/** The file that says a run is at work on a folder. It is kept on this Mac and never in the folder itself: the folder may sync,
    and a sync program can bring a deleted file back or pass it to other people. It holds the number of the process at work. */
export const lockFile = (dir, lockDir = tmpdir()) => join(lockDir, `brimm-transcribe-${createHash("sha1").update(resolve(dir)).digest("hex").slice(0, 16)}.lock`);

export const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

/** Take the folder for this run. Resolves "" when it is ours, or a line saying who has it. A lock whose process is gone, or
    that is half a day old, was left by a run that died, and is taken over. */
export function takeLock(lock, alive) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lock, String(process.pid), { flag: "wx" });
      return "";
    } catch (e) {
      let pid = 0;
      let age = Infinity;
      try {
        pid = Number(readFileSync(lock, "utf8")) || 0;
        age = Date.now() - statSync(lock).mtimeMs;
      } catch (gone) {
        continue;
      }
      if (pid && alive(pid) && age < STALE_LOCK_MS) return `Another run (process ${pid}) is at work on this folder. Nothing was started.`;
      rmSync(lock, { force: true });
    }
  }
  return "The folder could not be taken for this run. Nothing was started.";
}
