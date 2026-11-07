// The clock a video's times are on: the video's own, HyperFrames' (video-clock.js). One piece over the whole recording, or over a
// Reel's suggestion; the Final Cut days' records (a rough-cut render, a push) change nothing in it. Stand-ins only.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { videoClock } from "../video-clock.js";
import { timelineAt, lengthOf } from "../clock.js";
import { EPISODE, episode } from "./phase4.js";
import { saidWords } from "../project.js";

const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const V0 = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT };
const V1 = { v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: "p1" };
const raw = (pushed = [], more = {}) => ({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed, base: null }, ...more });

describe("videoClock", () => {
  it("gives a raw episode's words one piece over the whole video: a time on it is the recording's own", () => {
    const { t, found } = episode(raw());
    const got = videoClock({ ...found, record: found.record }, t.ctx, "main");
    assert.equal(got.on, "the video");
    assert.equal(got.clock.length, 1);
    assert.equal(timelineAt(got.clock, 12.4), 12.4);
    assert.equal(lengthOf(got.clock), 23.423);
    assert.ok(got.words.length > 5 && got.words.every((w) => typeof w.w === "string"));
    t.done();
  });
  it("starts a Reel's clock at the suggestion's start in reels.json and runs it to its end", () => {
    const list = JSON.parse(EPISODE.files["reels.json"]);
    const candidates = list.candidates.map((c) => (c.n === 1 ? { ...c, start: 30, end: 75, ranges: [{ start: 30, end: 75, crop: c.ranges[0].crop }] } : c));
    const made = { ...EPISODE, files: { ...EPISODE.files, "reels.json": JSON.stringify({ ...list, candidates }) } };
    const { t, found } = episode(raw(), {}, made);
    const got = videoClock(found, t.ctx, { reel: 1 });
    assert.equal(got.on, "Reel 1");
    assert.equal(timelineAt(got.clock, 41.0), 11.0);
    assert.equal(lengthOf(got.clock), 45);
    assert.deepEqual(videoClock(found, t.ctx, { reel: 9 }), { why: "There is no Reel 9." });
    t.done();
  });
  it("gives the same answer whatever versions the record lists: a rough-cut render and a Final Cut push change nothing", () => {
    const none = episode(raw());
    const listed = episode(raw([V0, V1]));
    const a = videoClock(none.found, none.t.ctx, "main");
    const b = videoClock(listed.found, listed.t.ctx, "main");
    assert.deepEqual(b, a);
    none.t.done();
    listed.t.done();
  });
  it("spells the words as the record spells them", () => {
    const { t, found } = episode(raw([], { spellings: [["thing", "item"]] }));
    const got = videoClock(found, t.ctx, "main");
    assert.ok(got.words.some((w) => w.w === "item"), JSON.stringify(got.words.map((w) => w.w)));
    t.done();
  });
  it("says the words file is coming while it is not whole on this Mac, naming it to bring", () => {
    const { t, found } = episode(raw());
    t.ctx.isWhole = (path) => !path.endsWith(".words.json");
    t.ctx.deps.isWhole = t.ctx.isWhole;
    assert.deepEqual(videoClock(found, t.ctx, "main"), { coming: "Pricing talk.words.json", bring: ["Pricing talk.words.json"] });
    t.done();
  });
  it("says why when there is no words file", () => {
    const { t, found } = episode(raw());
    writeFileSync(join(found.folder, "Pricing talk.words.json"), "not words");
    assert.ok(videoClock(found, t.ctx, "main").why);
    const gone = episode(raw(), {}, { ...EPISODE, files: Object.fromEntries(Object.entries(EPISODE.files).filter(([k]) => !k.endsWith(".words.json"))) });
    assert.deepEqual(videoClock(gone.found, gone.t.ctx, "main"), { why: "Pricing talk.words.json is not in the episode's folder." });
    t.done();
    gone.t.done();
  });
  it("places an iPhone clip's words with its cut plan's phrases, as any main video's", () => {
    const { t, found } = episode({ version: 3, kind: "short video" });
    const words = JSON.parse(EPISODE.files["Pricing talk.words.json"]).words;
    const got = videoClock(found, t.ctx, "main");
    assert.deepEqual(got.words, saidWords(words, JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]).phrases));
    assert.notDeepEqual(got.words, saidWords(words, []));
    t.done();
  });
  it("says why when the cut plan is listed but cannot be read", () => {
    const { t, found } = episode(raw());
    writeFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "{");
    assert.deepEqual(videoClock(found, t.ctx, "main"), { why: "Pricing talk.cut-plan.json or Pricing talk.words.json cannot be read." });
    t.done();
  });
});
