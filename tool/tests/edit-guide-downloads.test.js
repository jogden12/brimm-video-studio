// Where the guide reads, and how often (plan PR 17; the review of PR 10, M5, and the rule of the review of PR 16, F6, for a raw video): what the guide looks in for
// an export of a video in HyperFrames is its project, Downloads and what the other Mac released into the episode, and a video she set aside is looked in for none
// of them. The file system's own functions are watched while the guide runs, in made-up worlds with a home of their own: no test touches the real home,
// Downloads, Dropbox or a program, and the guide writes nothing.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { join, sep } from "node:path";
import { NOTHING_UNDER_WAY } from "../guide.js";
import { writeGuideNotes } from "../guide-note.js";
import { ID } from "./episodes.js";
import { AT, exportOf } from "./exports-world.js";
import { depsOf, guideWorld } from "./guide-world.js";
import { on } from "./workcopy-world.js";
import { watched } from "./watched-fs.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const EXPORTED = 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.';

const worlds = [];
/** The made-up episode of guide-world.js: a raw video with a main project here and no hand-off, with an export of it in Downloads. */
function raw(opts = {}) {
  const w = guideWorld(opts);
  worlds.push(w);
  if (w.names.main) exportOf(w, "main");
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});

describe("a raw video she set aside is read for nothing of its project (plan PR 17, the rule of the review of PR 16, F6, for a raw video)", () => {
  /** The functions of `fs` that look at a path, watched while `run` goes: the paths they were asked about. */
  const names = ["statSync", "lstatSync", "readdirSync", "readFileSync", "openSync", "existsSync", "realpathSync", "accessSync", "readlinkSync", "opendirSync"];
  const inside = (dir) => (path) => path === dir || path.startsWith(`${dir}${sep}`);
  it("looks in its project, Downloads and what the other Mac released for none of the forms that read, once she said it was finished: the overview, the video, wait and tell", async () => {
    const w = raw();
    const places = [w.dirOf("main"), w.downloads, join(w.found.folder, "edit")].map(inside);
    const reads = async () => {
      const said = [];
      const { calls } = await watched(async () => {
        for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", "wait"], ["guide", "3fa9c1", "tell"]]) said.push((await on(depsOf(w), ...argv)).said);
      }, { names });
      return { said, paths: calls.map((call) => call.path).filter((path) => places.some((is) => is(path))) };
    };
    // The same video before she said it: its project and Downloads are looked in (the control, so that this test would see a read at all).
    const before = await reads();
    assert.ok(before.paths.some(inside(w.downloads)), "Downloads is read for a video not set aside");
    assert.ok(before.paths.some(inside(w.dirOf("main"))), "its project is read for a video not set aside");
    assert.ok(before.said.every((lines) => lines.some((said) => said.includes(EXPORTED))), JSON.stringify(before.said));
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: { [ID]: AT } });
    const after = await reads();
    assert.deepEqual(after.paths, [], "nothing of its project or Downloads is looked in");
    assert.deepEqual(after.said, [[DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`], [DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`]]);
  });
});
