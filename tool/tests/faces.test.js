// The face finder's two programs (unedited.js facesIn): ffmpeg cuts stills of a video, and the finder swift runs looks in them. A Reel's
// video is looked in by the working copy's run (plan PR 5), which holds the working copy's lock for as long as it works, so a finder
// that hangs would hold the lock for good: each of the two programs is given a time limit, and one that is stopped for its time is
// said so in the words of the others. The full import's own use of the finder gives none, as it never did. No test runs ffmpeg or
// swift: stand-ins answer for them, and write the stills.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { facesIn } from "../unedited.js";

const BOX = { x: 0.41, y: 0.22, w: 0.18, h: 0.3 };
const STILLS = [{ file: "0001.jpg", faces: [BOX] }];

/** A folder to work in, the programs `facesIn` is given as stand-ins that keep what each was asked, and what they answer: `answers`
    says what each ends with (the stills' ffmpeg and the finder). */
function world(c, answers = {}) {
  const work = mkdtempSync(join(tmpdir(), "brimm-faces-"));
  c.after(() => rmSync(work, { recursive: true, force: true }));
  const asked = [];
  const run = async (cmd, args, options = {}) => {
    asked.push({ cmd, args, options });
    if (cmd === "FFMPEG") {
      if (answers.stills) return answers.stills;
      writeFileSync(args[args.length - 1].replace("%04d", "0001"), "a still");
      return { code: 0, stderr: "" };
    }
    return answers.finder ?? { code: 0, stderr: "", stdout: JSON.stringify(STILLS) };
  };
  return { work, asked, run, tools: { ffmpeg: "FFMPEG", swift: "SWIFT" } };
}
const OUT_OF_TIME = { code: 1, stderr: "", signal: "SIGKILL", outOfTime: true };

describe("the faces looked for in a video (facesIn), with a time limit", () => {
  it("gives each of its two programs the limit it is given: the stills' ffmpeg and the finder", async (c) => {
    const w = world(c);
    assert.deepEqual(await facesIn("/in/reel.mp4", w.work, { run: w.run, tools: w.tools, limit: 180000 }), { stills: STILLS });
    assert.deepEqual(w.asked.map(({ cmd, options }) => [cmd, options.limit]), [["FFMPEG", 180000], ["SWIFT", 180000]]);
  });
  it("gives them none when it is given none, as the import's upright version has always looked: a long recording takes as long as it takes", async (c) => {
    const w = world(c);
    assert.deepEqual(await facesIn("/in/talk.mov", w.work, { run: w.run, tools: w.tools }), { stills: STILLS });
    assert.deepEqual(w.asked.map(({ options }) => options.limit), [undefined, undefined]);
    // The finder's answer is still asked for whole.
    assert.ok(w.asked[1].options.out >= 1000000);
  });
  it("says a finder that ran out of its time was stopped for it, in the words it says the others in, and offers no faces", async (c) => {
    const w = world(c, { finder: OUT_OF_TIME });
    assert.deepEqual(await facesIn("/in/reel.mp4", w.work, { run: w.run, tools: w.tools, limit: 180000 }), { why: "the face finder stopped (it took more than 3 minutes, so it was stopped)" });
  });
  it("says the same of the program that cuts the stills, and then does not run the finder", async (c) => {
    const w = world(c, { stills: OUT_OF_TIME });
    assert.deepEqual(await facesIn("/in/reel.mp4", w.work, { run: w.run, tools: w.tools, limit: 90000 }), { why: "the stills to look in could not be made (it took more than 90 seconds, so it was stopped)" });
    assert.deepEqual(w.asked.map(({ cmd }) => cmd), ["FFMPEG"]);
  });
  it("still says a program that was killed for another reason was killed, and one that failed what it printed", async (c) => {
    const killed = world(c, { finder: { code: 1, stderr: "", signal: "SIGKILL" } });
    assert.deepEqual(await facesIn("/in/reel.mp4", killed.work, { run: killed.run, tools: killed.tools, limit: 180000 }), { why: "the face finder stopped (it was killed by SIGKILL)" });
    const failed = world(c, { finder: { code: 1, stderr: "The folder of stills could not be read: /stills\n" } });
    assert.deepEqual(await facesIn("/in/reel.mp4", failed.work, { run: failed.run, tools: failed.tools, limit: 180000 }), { why: "the face finder stopped (The folder of stills could not be read: /stills)" });
  });
  it("has no finder to run without swift, and runs nothing", async (c) => {
    const w = world(c);
    assert.deepEqual(await facesIn("/in/reel.mp4", w.work, { run: w.run, tools: { ffmpeg: "FFMPEG" }, limit: 180000 }), { why: "swift, which finds the faces, is not installed" });
    assert.deepEqual(w.asked, []);
  });
});
