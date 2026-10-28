// "How far is it?" (`status`) says the working copy (plan PR 4, "The working copy"): the run that makes the video HyperFrames is given
// holds a lock of its own (workcopy.js workCopyLockOf), beside the episode's, and runs while the reading does. `status` used to read
// the episode's lock alone, so it said nothing of a working copy being made, and it listed the result of an older run of it while a
// new one worked. Now it says the run from the working copy's own lock, its progress from the panel's files with the others', and
// the result a run left once it has ended, in words: the working copy is "the video for HyperFrames", as `app` calls it, and no line
// holds the name of a command. The command itself is edit-workcopy.test.js's.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resultFile } from "../detached.js";
import { progressFolder } from "../progress.js";
import { episodeWork } from "../settings.js";
import { FOLDER, ID, NAME } from "./episodes.js";
import { PLAIN, UNANSWERED, atWork, on, world } from "./workcopy-world.js";

/** What `status` says while the working copy is made, and what it calls the run once it has ended. */
const BEING_MADE = "the video for HyperFrames is being made.";
const MAKING = "making the video for HyperFrames";

/** What `status` says now, and a check that nothing it says holds a path, a flag or the name of a command, but for the name of the
    episode's folder. */
async function howFar(t, ...words) {
  const r = await on(t.ctx.deps, "status", ...words);
  for (const line of r.said) assert.doesNotMatch(line.replace(FOLDER, "<episode>"), PLAIN, line);
  return r;
}
/** The result a run of `command` left for the episode, `ago` milliseconds ago. */
function left(t, command, ago, over = {}) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  const ended = t.now() - ago;
  writeFileSync(resultFile(t.home, FOLDER, command), JSON.stringify({ version: 1, command, started: ended - 60000, ended, ok: true, made: [], failed: [], next: "", ...over }));
}
/** The progress file a run of this process writes while it works, as progress.js does. */
function progressOf(t, detail, video = NAME) {
  mkdirSync(progressFolder(t.home), { recursive: true });
  writeFileSync(join(progressFolder(t.home), `${process.pid}.json`), JSON.stringify({ version: 1, pid: process.pid, video, detail }));
}

describe("status: the working copy", () => {
  it("says the working copy is being made while its run holds its own lock, with its progress, and not the result of an older run", async () => {
    const { t } = world();
    left(t, "workcopy", 10 * 60000, { made: ["the video for HyperFrames"] });
    atWork(t, "workcopy");
    progressOf(t, "Making the video for HyperFrames (step 1 of 1), 40%, less than a minute left");
    const r = await howFar(t);
    assert.deepEqual(r.said, ["Running on this Mac:", `  ${NAME}: Making the video for HyperFrames (step 1 of 1), 40%, less than a minute left`, `${FOLDER}: ${BEING_MADE}`]);
    t.done();
  });
  it("says it from the run's own progress while the job works: the line the reporter wrote, and its lock", async () => {
    // The command is given no recorder, so it makes the reporter a detached run does, and the lines are those its files give.
    let mid = null;
    const { t } = world({ inside: async () => (mid = await howFar(t)) });
    delete t.ctx.deps.progress;
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const r = await on(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(mid.said, ["Running on this Mac:", `  ${NAME}: Making the video for HyperFrames (step 1 of 1)`, `${FOLDER}: ${BEING_MADE}`]);
    // Once it has ended there is no run, no progress and no lock, and what it left is said in its place.
    const after = await howFar(t);
    assert.deepEqual(after.said, [`${FOLDER}: ${MAKING} ended 0 minutes ago. Made: the video for HyperFrames.`]);
    t.done();
  });
  it("says what the run left, in its words, once it has ended: what was made, or why it could not be", async () => {
    const { t } = world();
    left(t, "workcopy", 3 * 60000, { made: ["the video for HyperFrames", "its speed made steady at 30 pictures a second"] });
    assert.deepEqual((await howFar(t)).said, [`${FOLDER}: ${MAKING} ended 3 minutes ago. Made: the video for HyperFrames, its speed made steady at 30 pictures a second.`]);
    left(t, "workcopy", 3 * 60000, { ok: false, failed: ["It can't be used: it could not be converted."] });
    assert.deepEqual((await howFar(t)).said, [`${FOLDER}: ${MAKING} ended 3 minutes ago. Not done: It can't be used: it could not be converted.`]);
    t.done();
  });
  it("counts the lock of a run that died as no run: its result is said, and the copy is not said to be made", async () => {
    const { t } = world();
    left(t, "workcopy", 5 * 60000, { made: ["the video for HyperFrames"] });
    atWork(t, "workcopy");
    t.ctx.deps.alive = () => false;
    assert.deepEqual((await howFar(t)).said, [`${FOLDER}: ${MAKING} ended 5 minutes ago. Made: the video for HyperFrames.`]);
    t.done();
  });
  it("says the reading and the working copy at work at once, each by its own lock, and the result of neither's older run", async () => {
    const { t } = world();
    left(t, "workcopy", 10 * 60000, { made: ["the video for HyperFrames"] });
    left(t, "read", 10 * 60000, { made: ["notes.txt"] });
    atWork(t, "read");
    atWork(t, "workcopy");
    assert.deepEqual((await howFar(t)).said, [`${FOLDER}: read is running.`, `${FOLDER}: ${BEING_MADE}`]);
    t.done();
  });
  it("says the result of the working copy while only the reading is at work, and of the reading while only the working copy is", async () => {
    const { t } = world();
    left(t, "workcopy", 10 * 60000, { made: ["the video for HyperFrames"] });
    left(t, "read", 20 * 60000, { made: ["notes.txt"] });
    atWork(t, "read");
    assert.deepEqual((await howFar(t)).said, [`${FOLDER}: read is running.`, `${FOLDER}: ${MAKING} ended 10 minutes ago. Made: the video for HyperFrames.`]);
    t.done();
    const u = world();
    left(u.t, "workcopy", 10 * 60000, { made: ["the video for HyperFrames"] });
    left(u.t, "read", 20 * 60000, { made: ["notes.txt"] });
    atWork(u.t, "workcopy");
    assert.deepEqual((await howFar(u.t)).said, [`${FOLDER}: ${BEING_MADE}`, `${FOLDER}: read ended 20 minutes ago. Made: notes.txt.`]);
    u.t.done();
  });
  it("says a refusal of the gate that ended the run in the gate's words, naming the video by its label and short id and never by its folder", async () => {
    const { t } = world({ record: UNANSWERED });
    assert.equal((await on(t.ctx.deps, "workcopy", "--now", FOLDER)).code, 1);
    const r = await howFar(t);
    assert.deepEqual(r.said, [`${UNANSWERED.label} (${ID.slice(-6)}): ${MAKING} ended 0 minutes ago. Not done: This video is waiting for its answer: say what it is first.`]);
    for (const given of [FOLDER, "Pricing", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
    t.done();
  });
  it("says nothing of a working copy where none was ever made or is at work, as before", async () => {
    const { t } = world();
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.deepEqual((await howFar(t)).said, ["Nothing is running, and nothing is waiting."]);
    t.done();
  });
  it("says the working copy of the episode the words fit, and no other", async () => {
    const { t } = world();
    left(t, "workcopy", 3 * 60000, { made: ["the video for HyperFrames"] });
    atWork(t, "workcopy");
    assert.deepEqual((await howFar(t, "Pricing")).said, [`${FOLDER}: ${BEING_MADE}`]);
    assert.deepEqual((await howFar(t, "Budget")).said, ["Nothing is running, and nothing is waiting."]);
    t.done();
  });
});
