// The made-up world the tests of the `workcopy` command share (edit-workcopy.test.js, and the working copy's lines in
// edit-status-workcopy.test.js): the made-up recording of phase4.js, answered as a test says, with stand-ins in place of every
// program the command runs. ffprobe answers for the raw video and for what is made of it, ffmpeg under the watchdog writes a few
// words into the file it is asked for, and the progress panel is a recorder, so that no test runs ffmpeg or any other program.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { episodeWork } from "../settings.js";
import { workCopyKey, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { FOLDER, listAll, reread } from "./episodes.js";
import { episode } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
export async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

export const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
export const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
export const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
export const CLEARED = { at: AT, on: "Mac Studio", to: "raw", confirmed: "dialog" };
/** The records the gate decides by: an answered raw video, an iPhone clip, a finished video, a video not yet answered, one left
    alone, a session whose mark is not cleared, and a video answered as raw whose session mark was cleared. */
export const RAW = { version: 3, kind: "raw", answer: ANSWERED };
export const CLIP = { ...RAW, kind: "short video" };
export const FINISHED = { ...RAW, kind: "finished" };
export const UNANSWERED = { version: 3, kind: null, answer: ANSWER, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
export const LEFT = { ...UNANSWERED, answer: { ...ANSWER, state: "not for brimm-video" } };
export const SESSION = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-20", session: SESSION_MARK };
export const WAS_SESSION = { ...RAW, session: { ...SESSION_MARK, cleared: CLEARED } };

/** What ffmpeg's stand-in writes as the working copy. */
export const COPY = "THE WORKING COPY";
/** Nothing she reads holds a path, a flag or the name of a command. */
export const PLAIN = /\/|--|\bnode\b|edit\.js|workcopy|\bnpx\b/;

/** How the stand-in for ffmpeg under the watchdog ends: its answer, as guard.js resolves one. */
const ENDED = { code: 0, signal: null, stderr: "", overMemory: false, outOfTime: false, peak: 0, stopped: "" };

/** The made-up recording (phase4.js), answered as `record` says, with what the command is given in place of the programs: ffprobe
    answers for the raw video and for what is made of it (tests/phase4.js), ffmpeg under the watchdog writes `COPY` into the file it
    is asked for, and the progress panel is a recorder. `how` is how ffmpeg ends, as workcopy.test.js has it: "works" or "fail".
    `inside` is called with each ffmpeg the watchdog runs, while it runs. Gives back what the command made and where. */
export function world({ record = RAW, how = "works", inside = async () => {} } = {}) {
  const { t, found } = episode(record);
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const key = workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs });
  const paths = workCopyPaths(t.home, FOLDER, key);
  const guarded = [];
  const events = [];
  t.ctx.deps.runGuarded = async (cmd, args, limits) => {
    guarded.push({ cmd, args, limits, copyLock: existsSync(workCopyLockOf(t.home, FOLDER)), episodeLock: existsSync(lockOf(t.home, FOLDER)) });
    await inside(args);
    if (how === "fail") return { ...ENDED, code: 1, stderr: "Error while encoding: Cannot allocate memory\n" };
    writeFileSync(args[args.length - 1], COPY);
    return ENDED;
  };
  t.ctx.deps.progress = {
    begin: (name) => events.push(["begin", name]), length: (seconds) => events.push(["length", seconds]), steps: (names) => events.push(["steps", names]),
    step: (name) => events.push(["step", name]), fraction() {}, encoding: (seconds) => (events.push(["encoding", seconds]), { args: [], stop: () => events.push(["stop"]) }),
    end: (finished) => events.push(["end", finished])
  };
  return { t, found, raw, key, paths, guarded, events, work: episodeWork(t.home, FOLDER) };
}

/** A run of `command` at work on the episode now, as a live process holds it: the working copy's run holds the working copy's own
    lock, and every other the episode's. `alive` says this very process is a live one. */
export function atWork(t, command) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  const lock = command === "workcopy" ? workCopyLockOf(t.home, FOLDER) : lockOf(t.home, FOLDER);
  assert.equal(takeEpisodeLock(lock, command, () => true).taken, true);
  t.ctx.deps.alive = (pid) => pid === process.pid;
}

/** What the episode's folder in Dropbox holds, and what its record says: a command that writes none leaves both as they were. */
export const dropbox = (found) => [listAll(found.folder), reread(found).rev];
