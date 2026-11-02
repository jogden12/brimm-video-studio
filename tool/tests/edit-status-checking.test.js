// What `status` says while a finish waits for its late check, and after it (finish.js, finish-check.js). The finish is run as the command
// line runs it, holding the episode's lock, and `status` is run while it waits; the lock is this process's, so `status` is told that
// this process is the finish run at work (checking-world.js). The progress panel's files are the real reporter's, in the test's own
// home, with no panel: nothing here touches the real home, Downloads, Dropbox or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { lockOf, resultFile, takeEpisodeLock } from "../detached.js";
import { recordFile, recordText } from "../episode.js";
import { markChecking } from "../finish-check.js";
import { progressFolder, reporter } from "../progress.js";
import { FOLDER, reread } from "./episodes.js";
import { atWait, exported, on, seeing, studio, whileChecking } from "./checking-world.js";

const WRITTEN = `${FOLDER}: the hand-off is written.`;
const RUNNING = `${FOLDER}: finish is running.`;
/** A run of another command that ended before, whose result `status` prints. */
function earlier(w, command, next) {
  mkdirSync(dirname(resultFile(w.t.home, FOLDER, command)), { recursive: true });
  writeFileSync(resultFile(w.t.home, FOLDER, command), JSON.stringify({ version: 1, command, started: w.t.now() - 600000, ended: w.t.now() - 300000, ok: true, made: [], failed: [], next }));
}
/** A raw video whose finish has ended, so that its hand-off is written and nothing is at work. */
async function finished() {
  const w = await exported();
  assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
  return w;
}

describe("status while a finish waits for its late check", () => {
  it("says the hand-off is written, and when Studio checks Dropbox's copies and then takes the export out of Downloads, in place of that the finish is running", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { status: ["status"] });
    assert.equal(heard.status.code, 0, heard.status.text);
    assert.deepEqual(heard.status.said, [`${WRITTEN} ${studio(heard.due)}`]);
    w.t.done();
  });
  it("names the places the originals were taken from: Downloads, From Final Cut, both, or none", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    const due = w.t.now() + LATE_CHECK_MS;
    for (const [places, where] of [
      [["Downloads"], "the export out of Downloads"],
      [["From Final Cut"], "what it took out of From Final Cut"],
      [["From Final Cut", "Downloads"], "the export out of Downloads and what it took out of From Final Cut"],
      [[], ""]
    ]) {
      markChecking(w.t.home, FOLDER, { nonce: took.nonce, revision: reread(w.found).finished.revision, due, took: places });
      const said = await on(seeing(w), "status");
      assert.deepEqual(said.said, [`${WRITTEN} ${studio(due, where)}`], places.join());
    }
    w.t.done();
  });
  it("prints the lines about the runs before it as it did: an earlier run's result, but not an earlier finish's, which the run at work will replace", async () => {
    const w = await finished();
    earlier(w, "bring", 'Every file of Pricing is here. Say "open Pricing".');
    // A second finish, which keeps both parts and takes nothing away, waits for its check beside the first finish's result and the bring's.
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
    const heard = await whileChecking(w, { status: ["status"] });
    assert.equal(heard.status.said.length, 2, heard.status.text);
    assert.equal(heard.status.said[0], `${WRITTEN} ${studio(heard.due, "")}`);
    assert.equal(heard.status.said[1], `${FOLDER}: bring ended 5 minutes ago. Every file of Pricing is here. Say "open Pricing".`);
    w.t.done();
  });
  it("lists the finish's bar while it copies, out of five steps, and lists none once the hand-off is written: the check goes on with no bar", async () => {
    const w = await exported();
    w.t.ctx.deps.progress = reporter({ folder: progressFolder(w.t.home), now: () => w.t.now() });
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "status");
    }, 5000);
    const heard = await whileChecking(w, { status: ["status"] });
    assert.deepEqual(copying.said, ["Running on this Mac:", "  Pricing: what to charge?: Waiting for HyperFrames' exports (step 1 of 5)", RUNNING]);
    assert.deepEqual(heard.status.said, [`${WRITTEN} ${studio(heard.due)}`]);
    w.t.done();
  });
});

describe("status while a finish has not reached its late check, or its marker is not believed", () => {
  it("says the finish is running, as it did, while the finish still copies", async () => {
    const w = await exported();
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "status");
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.deepEqual(copying.said, [RUNNING]);
    w.t.done();
  });
  for (const [what, command, alive, nonce, revision] of [
    ["another finish's lock", "finish", null, "the nonce of the run that was killed", 0],
    ["another command's lock", "bring", null, null, 0],
    ["a revision the record no longer holds", "finish", null, null, 1]
  ]) {
    it(`says it is running, as it did, for a marker of ${what}`, async () => {
      const w = await finished();
      const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), command, () => true);
      markChecking(w.t.home, FOLDER, { nonce: nonce ?? took.nonce, revision: reread(w.found).finished.revision + revision, due: w.t.now() + LATE_CHECK_MS, took: ["Downloads"] });
      const said = await on(seeing(w), "status");
      assert.deepEqual(said.said.filter((line) => line.includes(" is running.")), [`${FOLDER}: ${command} is running.`]);
      assert.equal(said.text.includes("the hand-off is written"), false);
      w.t.done();
    });
  }
  it("says nothing of a check for a marker of a run that is gone, which is no run at work", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    markChecking(w.t.home, FOLDER, { nonce: took.nonce, revision: reread(w.found).finished.revision, due: w.t.now() + LATE_CHECK_MS, took: ["Downloads"] });
    const said = await on(seeing(w, { alive: () => false }), "status");
    assert.equal(said.text.includes("is running"), false);
    assert.equal(said.text.includes("the hand-off is written"), false);
    w.t.done();
  });
});

describe("status after a finish that waited for its late check", () => {
  it("says what the finish made, as it did, with no line that it is running or that the hand-off is written", async () => {
    const w = await finished();
    const said = await on(seeing(w), "status");
    assert.equal(said.said.length, 1);
    assert.ok(said.said[0].startsWith(`${FOLDER}: finish ended 0 minutes ago. Made: `), said.said[0]);
    assert.doesNotMatch(said.text, /is running|the hand-off is written/);
    w.t.done();
  });
  it("says why, when the late check found a problem after the hand-off was written", async () => {
    const w = await exported();
    atWait(w.t, async () => {
      const now = reread(w.found);
      writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, finished: null }));
    });
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 1);
    const said = await on(seeing(w), "status");
    assert.match(said.text, /finish ended 0 minutes ago\. Made: .* Not done: The episode's record no longer holds this finish/);
    w.t.done();
  });
});
