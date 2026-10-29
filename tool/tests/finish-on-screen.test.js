// finish from HyperFrames' exports and the words on the main video's picture, the detached part (plan PR 8, groups D1 to D4; architecture
// 2026-10-27, sections 8.4 and 8.5): the hand-off holds the words she confirmed as `main.onPicture`, the record keeps them in the finished
// part, and a finish that keeps the main video keeps its words. It runs in the made-up world of exports-world.js, with stand-ins for ffprobe,
// ffmpeg and the transcriber; nothing here runs a program or touches Dropbox, the app or the real Downloads folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { EDITED, FOLDER, PROJECT, reread } from "./episodes.js";
import { FIXTURE_MAIN, MAIN_WORDS, exportOf, fw, screen } from "./exports-world.js";

const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const RAW_FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-raw.json", import.meta.url), "utf8"));
const handoffOf = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
/** finish asked with a yes and these answers: the episode as it is then, with the quick part's claim. */
async function asked(w, answers = {}) {
  assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true, ...answers }), 0, w.t.said());
  return { ...w.found, record: reread(w.found) };
}
/** A finish, asked and run to its end. */
async function finished(w, answers = {}) {
  const found = await asked(w, answers);
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { found, result };
}
/** The made-up world with both exports in Downloads. */
function ready(options = {}) {
  const w = fw(options);
  exportOf(w, "main");
  exportOf(w, "reel 2");
  return w;
}

describe("D1. the hand-off holds the words she confirmed", () => {
  it("has main.onPicture of the lines shown, in order, and passes the contract's check", async () => {
    const w = ready();
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(handoff.main.onPicture, MAIN_WORDS);
    assert.deepEqual(Object.keys(handoff.main), Object.keys(RAW_FIXTURE.main), "main's keys are the raw fixture's, in its order");
    assert.deepEqual(Object.keys(handoff).filter((key) => key !== "suggestions"), Object.keys(RAW_FIXTURE).filter((key) => key !== "suggestions"));
    w.t.done();
  });
  it("has the words she gives instead, in her order, whatever the project held", async () => {
    const w = ready();
    const { found } = await finished(w, { onScreen: ["Head of Pricing", "A line the reader did not find"] });
    assert.deepEqual(handoffOf(found).main.onPicture, ["Head of Pricing", "A line the reader did not find"]);
    assert.equal(handoffFaultV2(handoffOf(found)), "");
    w.t.done();
  });
  it("has the words of a title card whose host sets them, a note in index.html, and none of the captions", async () => {
    const w = ready();
    screen(w, "main", FIXTURE_MAIN);
    // These words are new to her: the first call shows them, and her yes is to those.
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0, w.t.said());
    const { found } = await finished(w);
    assert.deepEqual(handoffOf(found).main.onPicture, ["Alex Rivera", "Head of Pricing", "Three pricing", "mistakes", "Know your costs"]);
    w.t.done();
  });
  it("leaves the key out when she said there are none: the contract refuses an empty list", async () => {
    const w = ready();
    const { found } = await finished(w, { noOnScreen: true });
    const handoff = handoffOf(found);
    assert.equal("onPicture" in handoff.main, false);
    assert.equal(handoffFaultV2(handoff), "");
    w.t.done();
  });
  it("writes the hand-off of a Reel and a main video as before, with the Reel's title from the record", async () => {
    const w = ready();
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.deepEqual(handoff.reels.map((r) => [r.n, r.title, r.fromSuggestion]), [[2, "Know your costs", 2]]);
    assert.equal("onPicture" in handoff.reels[0], false);
    w.t.done();
  });
});

describe("D2. the record keeps the words with the finished part", () => {
  it("lists them in finished.parts.main beside the part's other keys, and none in a Reel's part", async () => {
    const w = ready();
    const { found } = await finished(w);
    const record = reread(found);
    assert.deepEqual(Object.keys(record.finished.parts.main).sort(), ["bytes", "file", "onPicture", "project", "seconds", "source", "words"]);
    assert.deepEqual(record.finished.parts.main.onPicture, MAIN_WORDS);
    assert.equal("onPicture" in record.finished.parts["reel 2"], false);
    w.t.done();
  });
  it("leaves the key out when there are none", async () => {
    const w = ready();
    const { found } = await finished(w, { noOnScreen: true });
    assert.deepEqual(Object.keys(reread(found).finished.parts.main).sort(), ["bytes", "file", "project", "seconds", "source", "words"]);
    w.t.done();
  });
});

describe("D3. a second finish", () => {
  /** The episode finished once with these words, and ready to be finished again. */
  async function once(words = ["Alex Rivera", "Head of Pricing"]) {
    const w = ready();
    const { found } = await finished(w, { onScreen: words });
    return { w, found, again: () => ({ ...found, record: reread(found) }) };
  }
  it("keeps the main video's words in the next revision, and asks nothing about them", async () => {
    const { w, found, again } = await once();
    const had = w.t.said().split("\n").length;
    assert.equal(await finishEpisode(w.t.ctx, again(), {}), 0);
    assert.deepEqual(w.t.said().split("\n").slice(had), ["The main video: kept as the last finish made it.", "Reel 2: kept as the last finish made it.", 'Say "yes, hand it off" to start.']);
    assert.equal(await finishEpisode(w.t.ctx, again(), { yes: true }), 0);
    const result = await finishNow(w.t.ctx, again());
    assert.equal(result.ok, true, result.failed.join(" "));
    const second = handoffOf(found);
    assert.deepEqual([second.revision, second.main.onPicture, reread(found).finished.parts.main.onPicture], [2, ["Alex Rivera", "Head of Pricing"], ["Alex Rivera", "Head of Pricing"]]);
    assert.equal(handoffFaultV2(second), "");
    w.t.done();
  });
  it("asks again for a new export of the main video, and what she says replaces them", async () => {
    const { w, found, again } = await once();
    exportOf(w, "main", { start: [14, 30, 0] });
    assert.equal(await finishEpisode(w.t.ctx, again(), {}), 0);
    assert.equal(w.t.said().split("\n").at(-2), 'On screen in the main video I found "Alex Rivera" at 0:03 and "Head of Pricing" at 0:03. Right?');
    assert.equal(await finishEpisode(w.t.ctx, again(), { yes: true, onScreen: ["Replaced"] }), 0);
    const result = await finishNow(w.t.ctx, again());
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([handoffOf(found).revision, handoffOf(found).main.onPicture, reread(found).finished.parts.main.onPicture], [2, ["Replaced"], ["Replaced"]]);
    w.t.done();
  });
  it("takes the words she gives while the main video is kept, and the words that there are none", async () => {
    const { w, found, again } = await once();
    assert.equal(await finishEpisode(w.t.ctx, again(), { yes: true, onScreen: ["Changed"] }), 0);
    assert.equal((await finishNow(w.t.ctx, again())).ok, true);
    assert.deepEqual([handoffOf(found).revision, handoffOf(found).main.onPicture, reread(found).finished.parts.main.onPicture], [2, ["Changed"], ["Changed"]]);
    assert.equal(await finishEpisode(w.t.ctx, again(), { yes: true, noOnScreen: true }), 0);
    assert.equal((await finishNow(w.t.ctx, again())).ok, true);
    const third = handoffOf(found);
    assert.deepEqual([third.revision, "onPicture" in third.main, "onPicture" in reread(found).finished.parts.main], [3, false, false]);
    assert.equal(handoffFaultV2(third), "");
    w.t.done();
  });
  it("keeps a main video's words that the last finish did not have, as none", async () => {
    const w = ready();
    const { found } = await finished(w, { noOnScreen: true });
    assert.equal(await finishEpisode(w.t.ctx, { ...found, record: reread(found) }, { yes: true }), 0);
    assert.equal((await finishNow(w.t.ctx, { ...found, record: reread(found) })).ok, true);
    assert.equal("onPicture" in handoffOf(found).main, false);
    w.t.done();
  });
});

describe("D4. the edges", () => {
  it("writes no words on a Mac that hands off version 1, which has none", async () => {
    const w = ready({ handoffVersion: 1, over: { title: { text: "Price like you mean it", from: "person", approved: true } } });
    const { found } = await finished(w);
    assert.doesNotMatch(readFileSync(join(found.folder, "final", HANDOFF), "utf8"), /onPicture/);
    assert.equal("onPicture" in reread(found).finished.parts.main, false);
    w.t.done();
  });
  it("keeps the record's titles for a main video that went the Final Cut way beside a Reel from HyperFrames, and writes no words into its part", async () => {
    const texts = [{ id: "t1", kind: "lower-third", lines: ["Three pricing mistakes"], at: 3, for: 5 }];
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = fw({ projects: ["reel 2"], over: { main: { ...EDITED.main, texts, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    assert.deepEqual(handoffOf(found).main.onPicture, ["Three pricing mistakes"]);
    assert.equal("onPicture" in reread(found).finished.parts.main, false);
    w.t.done();
  });
  it("reads an onPicture in finish.asked.json that is not a list of words as the words that are, and none for the rest", async () => {
    const w = ready();
    const found = await asked(w);
    const file = join(w.work, "finish.asked.json");
    const told = JSON.parse(readFileSync(file, "utf8"));
    told.parts[0].onPicture = [1, "", "   ", { a: 1 }, null, "Kept", " Spaced  out "];
    writeFileSync(file, JSON.stringify(told));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(handoffOf(found).main.onPicture, ["Kept", "Spaced out"]);
    w.t.done();
    for (const junk of ["text", 7, {}, [], [""], null]) {
      const v = ready();
      const f = await asked(v);
      const path = join(v.work, "finish.asked.json");
      const t = JSON.parse(readFileSync(path, "utf8"));
      t.parts[0].onPicture = junk;
      writeFileSync(path, JSON.stringify(t));
      const r = await finishNow(v.t.ctx, f);
      assert.equal(r.ok, true, `${JSON.stringify(junk)}: ${r.failed.join(" ")}`);
      assert.equal("onPicture" in handoffOf(f).main, false, JSON.stringify(junk));
      v.t.done();
    }
  });
  it("keeps the words in the hand-off when a spelling makes it again", async () => {
    const w = ready();
    const { found } = await finished(w);
    const said = [];
    const code = await editMain(["spell", FOLDER, "add", "Sallie", "Sally"], { ...w.t.ctx.deps, say: (line) => said.push(line) });
    assert.equal(code, 0, said.join("\n"));
    const handoff = handoffOf(found);
    assert.deepEqual([handoff.revision, handoff.main.onPicture], [2, MAIN_WORDS]);
    assert.match(handoff.main.srt, /Sally/);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(reread(found).finished.parts.main.onPicture, MAIN_WORDS);
    w.t.done();
  });
});
