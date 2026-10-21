// The main video's project, one way for the import and for a push: the episode's spellings in its captions, and nothing else
// changed when there are none.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mainProject } from "../projects.js";

const FACTS = { duration: 20, width: 1280, height: 720, fps: "30/1", sound: true, soundStart: 0 };
const PLAN = { ranges: [{ start: 0, end: 10, keep: true, kind: "keep", why: "", phrases: [], text: "" }, { start: 10, end: 20, keep: false, kind: "pause", why: "silence after the last words", phrases: [], text: "" }] };
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sallie.\n\n";

describe("the main video's project", () => {
  it("spells its captions as the episode spells, and leaves them as written with no spelling", () => {
    assert.match(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: PLAN, srt: SRT, spellings: [["Sallie", "Sally"]] }).text, /name="Thank you, Sally\."/);
    assert.match(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: PLAN, srt: SRT }).text, /name="Thank you, Sallie\."/);
  });
  it("says why there is none when nothing is kept", () => {
    assert.deepEqual(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: { ranges: [PLAN.ranges[1]] } }), { why: "the plan keeps nothing" });
  });
});
