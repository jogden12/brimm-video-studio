// Claude's ideas for graphics as she reads them (Sallie's note 8, 25 Oct: "Add timestamps to graphics suggestions so that they can
// easily be added"): numbered, each with its start and end on the newest version shown on this Mac, put up by its number, and left
// out of Claude's notes of a raw video, whose times are the recording's. A finished video and an iPhone clip get none.
// Every program is a stand-in, nothing opens, and every name is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { studioFiles } from "../studio.js";
import { EPISODE, episode } from "./phase4.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
/** A PNG's first bytes, of a size, as a picture in her Pictures folder. */
const picture = (t, name, width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  const dir = join(t.home, "BRIMM Video Studio", "Pictures");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), b);
};
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
/** Claude's ideas, in its own order: on "So the first thing…" (p7), on no phrase of the plan, on "It is very, very important."
    (p8, which Claude's decision cut), and on "Welcome to the show." (p4). */
const IDEAS = [
  { id: "p7", idea: "A chart of what it costs to run the business" },
  { id: "p99", idea: "A picture of nothing" },
  { id: "p8", idea: 'The word "important" in the corner' },
  { id: "p4", idea: "The show's name in the lower third." }
];
/** The made-up episode's files, its plan holding `graphics` as Claude's ideas. */
const withIdeas = (graphics) => {
  const plan = JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]);
  return { ...EPISODE, files: { ...EPISODE.files, "Pricing talk.cut-plan.json": JSON.stringify({ ...plan, claude: { ...plan.claude, graphics } }) } };
};
/** A raw video she has answered, whose rough cut, version 0, was rendered and opened on this Mac: the clock she reads. */
const ROUGH = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT };
const raw = () => episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH], base: null } }, {}, withIdeas(IDEAS));
/** A finished video's, or an iPhone clip's, files as the light import leaves them. */
const LIGHT = { "Pricing talk.mp4": "the video", "Pricing talk.cut-plan.json": "{}", "Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n" };
const KINDS = [["finished", "a finished video"], ["short video", "an iPhone clip"]];
const light = (kind) => {
  const t = setup();
  const found = episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: "Video of 14 Oct, 09:12 (Mac Studio)" }, files: LIGHT });
  return { t, found };
};
const ASK = 'To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".';

// --- Task 1 ---

describe("graphic ideas", () => {
  it("numbers Claude's ideas in the order their words are said, each with its start and end on the rough cut she watches, and says which are cut now", async () => {
    const { t } = raw();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on the main video: 3, with times on main v0.",
      `Idea 1, 0:00 to 0:01: The show's name in the lower third. Over "Welcome to the show."`,
      'Idea 2, 0:04 to 0:07: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, cut now: The word "important" in the corner. Over "It is very, very important."',
      ASK
    ].join("\n")]);
    t.done();
  });
  it("keeps each idea's number on a Reel, and lists only those in its stretch, with their times on the Reel", async () => {
    const { t } = episode({}, {}, withIdeas(IDEAS));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on Reel 2: 2, with times on Reel 2 as it is now.",
      'Idea 2, 0:00 to 0:03: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, cut now: The word "important" in the corner. Over "It is very, very important."',
      ASK
    ].join("\n")]);
    t.done();
  });
  it("gives no time to an idea whose words were kept again since the version she watched, never 0:00", async () => {
    const { t } = raw();
    assert.equal((await on(t.ctx.deps, "cut", "Pricing", "keep", "--words", "very important")).code, 0);
    assert.match((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text, /\nIdea 3, not on main v0 \(kept again since\): The word "important" in the corner\. Over "It is very, very important\."\n/);
    t.done();
  });
  it("says Claude gave none when the plan holds none", async () => {
    const { t } = episode({}, {}, withIdeas([]));
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 0, text: "Claude gave no ideas for graphics on the main video." });
    t.done();
  });
  it("says a finished video and an iPhone clip have none", async () => {
    for (const [kind, what] of KINDS) {
      const { t } = light(kind);
      assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing talk", "ideas"), { code: 0, text: `Pricing talk has no ideas for graphics: Claude gives none for ${what}.` }, kind);
      t.done();
    }
  });
});
