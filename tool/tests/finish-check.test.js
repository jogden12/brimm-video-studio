// What a finish leaves on this Mac's own disk about its late check (finish-check.js): the marker it leaves from the moment its
// hand-off is written until the run ends, which the guide and `status` believe only while the run is at work, and the note it
// leaves when that check finds a problem. Each test has a home folder of its own, and this process takes the episode's lock as the
// finish run; nothing here starts a program or touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { CHECKING_FILE, PLACES, PROBLEM_FILE, checkingNow, clearChecking, clearProblem, flagProblem, markChecking, problemFlagged } from "../finish-check.js";
import { episodeWork } from "../settings.js";

const FOLDER = "2026-10-13 Talk (Mac Studio)";
const DUE = Date.parse("2026-10-20T15:20:00-05:00");
/** The record in force, as far as the marker looks at it: the finish it holds. */
const RECORD = { finished: { revision: 2 } };
const THIS_PROCESS = (pid) => pid === process.pid;

/** A home with the episode's folder in BRIMM Video Work, and this process holding the episode's lock as `command` (a finish). */
function setup(command = "finish") {
  const home = mkdtempSync(join(tmpdir(), "brimm-finish-check-"));
  mkdirSync(episodeWork(home, FOLDER), { recursive: true });
  const took = takeEpisodeLock(lockOf(home, FOLDER), command, () => true);
  assert.equal(took.taken, true);
  return { home, nonce: took.nonce, work: episodeWork(home, FOLDER), done: () => rmSync(home, { recursive: true, force: true }) };
}
/** The marker of the run that holds the lock, for the hand-off at `revision`. */
const mark = (t, over = {}) => markChecking(t.home, FOLDER, { nonce: t.nonce, revision: 2, due: DUE, took: ["Downloads"], ...over });
const believed = (t, record = RECORD, alive = THIS_PROCESS) => checkingNow(t.home, FOLDER, record, alive);

describe("the marker of a finish that waits for its late check", () => {
  it("is a small file in the episode's folder on this Mac's own disk, with the run's nonce, the hand-off's revision, when the check is due and where originals were taken from", () => {
    const t = setup();
    mark(t, { took: ["From Final Cut", "Downloads"] });
    assert.equal(join(t.work, CHECKING_FILE), join(t.home, "BRIMM Video Work", FOLDER, "finish.checking.json"));
    assert.deepEqual(JSON.parse(readFileSync(join(t.work, CHECKING_FILE), "utf8")), { version: 1, nonce: t.nonce, revision: 2, due: DUE, took: ["Downloads", "From Final Cut"] });
    assert.deepEqual(PLACES, ["Downloads", "From Final Cut"]);
    assert.deepEqual(readdirSync(t.work).filter((name) => name.endsWith(".writing")), [], "written whole, under a name of its own, then renamed");
    t.done();
  });
  it("says no place when originals were taken from none, and none it does not know", () => {
    const t = setup();
    mark(t, { took: [] });
    assert.deepEqual(believed(t).took, []);
    mark(t, { took: ["Dropbox", "Downloads"] });
    assert.deepEqual(believed(t).took, ["Downloads"]);
    t.done();
  });
  it("counts while a live finish run holds the episode's lock under its nonce and the record in force holds the revision it names", () => {
    const t = setup();
    mark(t, { took: ["Downloads", "From Final Cut"] });
    assert.deepEqual(believed(t), { revision: 2, due: DUE, took: ["Downloads", "From Final Cut"] });
    t.done();
  });
  it("is none when there is no marker", () => {
    const t = setup();
    assert.equal(believed(t), null);
    t.done();
  });
  it("is none when the run is not running: it was killed, and its marker was left behind", () => {
    const t = setup();
    mark(t);
    assert.equal(believed(t, RECORD, () => false), null);
    t.done();
  });
  it("is none when the lock is held by a run of another command, whatever the marker says", () => {
    const t = setup("bring");
    mark(t);
    assert.equal(believed(t), null);
    t.done();
  });
  it("is none when the lock was taken under another nonce: an older run's marker, with a later finish at work", () => {
    const t = setup();
    mark(t, { nonce: "an older run's" });
    assert.equal(believed(t), null);
    t.done();
  });
  it("is none when the lock holds no nonce, even for a marker that holds none either", () => {
    const t = setup();
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: process.pid, command: "finish" }));
    mark(t, { nonce: "" });
    assert.equal(believed(t), null);
    t.done();
  });
  it("is none when the record in force no longer holds the revision it names, or holds no finish, or cannot be read", () => {
    const t = setup();
    mark(t);
    for (const record of [{ finished: { revision: 3 } }, { finished: { revision: 1 } }, { finished: null }, {}, null, undefined]) assert.equal(checkingNow(t.home, FOLDER, record, THIS_PROCESS), null, String(JSON.stringify(record)));
    assert.notEqual(believed(t, { finished: { revision: 2 } }), null);
    t.done();
  });
  it("is none when the file is not a marker as it should be: unreadable, of another version, or without a number where one belongs", () => {
    const t = setup();
    const file = join(t.work, CHECKING_FILE);
    const good = { version: 1, nonce: t.nonce, revision: 2, due: DUE, took: ["Downloads"] };
    for (const text of ["", "{", "[]", "null", JSON.stringify({ ...good, version: 2 }), JSON.stringify({ ...good, revision: "2" }), JSON.stringify({ ...good, revision: 2.5 }), JSON.stringify({ ...good, due: "soon" }), JSON.stringify({ ...good, due: null }), JSON.stringify({ ...good, took: "Downloads" }), JSON.stringify({ ...good, nonce: 7 })]) {
      writeFileSync(file, text);
      assert.equal(believed(t), null, text);
    }
    writeFileSync(file, JSON.stringify(good));
    assert.notEqual(believed(t), null);
    t.done();
  });
  it("is taken away by clearChecking, and clearing when there is none is no matter", () => {
    const t = setup();
    clearChecking(t.home, FOLDER);
    mark(t);
    assert.equal(existsSync(join(t.work, CHECKING_FILE)), true);
    clearChecking(t.home, FOLDER);
    assert.equal(existsSync(join(t.work, CHECKING_FILE)), false);
    assert.equal(believed(t), null);
    t.done();
  });
  it("is made in the episode's folder even when the folder is not there yet, and throws when it cannot be written", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-finish-check-"));
    markChecking(home, FOLDER, { nonce: "n", revision: 1, due: DUE, took: [] });
    assert.equal(existsSync(join(episodeWork(home, FOLDER), CHECKING_FILE)), true);
    // A file where the folder should be: nothing can be written there.
    const blocked = mkdtempSync(join(tmpdir(), "brimm-finish-check-"));
    mkdirSync(join(blocked, "BRIMM Video Work"), { recursive: true });
    writeFileSync(join(blocked, "BRIMM Video Work", FOLDER), "a file");
    assert.throws(() => markChecking(blocked, FOLDER, { nonce: "n", revision: 1, due: DUE, took: [] }));
    rmSync(home, { recursive: true, force: true });
    rmSync(blocked, { recursive: true, force: true });
  });
});

describe("the note of a late check that found a problem", () => {
  it("is a small file beside the marker, which says when it was made, and is there until a later finish ends well", () => {
    const t = setup();
    assert.equal(problemFlagged(t.home, FOLDER), false);
    flagProblem(t.home, FOLDER, DUE);
    assert.equal(problemFlagged(t.home, FOLDER), true);
    assert.equal(join(t.work, PROBLEM_FILE), join(t.home, "BRIMM Video Work", FOLDER, "finish.problem.json"));
    assert.deepEqual(JSON.parse(readFileSync(join(t.work, PROBLEM_FILE), "utf8")), { version: 1, at: DUE });
    clearProblem(t.home, FOLDER);
    assert.equal(problemFlagged(t.home, FOLDER), false);
    t.done();
  });
  it("is not the marker: taking the marker away leaves it, and clearing when there is none is no matter", () => {
    const t = setup();
    clearProblem(t.home, FOLDER);
    flagProblem(t.home, FOLDER, DUE);
    mark(t);
    clearChecking(t.home, FOLDER);
    assert.equal(problemFlagged(t.home, FOLDER), true);
    t.done();
  });
  it("is none for an episode with no folder in BRIMM Video Work yet", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-finish-check-"));
    assert.equal(problemFlagged(home, FOLDER), false);
    rmSync(home, { recursive: true, force: true });
  });
});
