// The guide on a video with a Reel Kit edit (plan Task 20, wired): what edit.js reads of a raw video's Reel Kit main video for the guide (its
// record's entry, its project's studio.json, Studio's own mark that it opened the project in the app), and what `guide` then says.
// guide-reel-kit.test.js has the words by their facts; here the facts are read from a made-up episode as `guide` reads them, in a made-up
// home (exports-world.js). No test touches the real home, Downloads, Dropbox or a program, and the guide writes nothing.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PIN } from "../hyperframes.js";
import { compositionFingerprint, entryOf, slugOf, writeState } from "../reel-kit-project.js";
import { markOpened } from "../reel-kit-worker.js";
import { ID } from "./episodes.js";
import { AT, MAIN, ms } from "./exports-world.js";
import { depsOf, guideWorld } from "./guide-world.js";
import { PLAIN, on } from "./workcopy-world.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const says = (text) => `${NAMED}: ${text}`;
const RK_MAIN = `${MAIN} Reel Kit v1`;
const SLUG = slugOf({ id: ID }, "main", 1);
const FROM = { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" };
const COPY = { bytes: 16, seconds: 23.423, fps: 30 };
/** The record's entry of the main video's Reel Kit edit, as `reelkit start` writes it, with `over` laid on it (`reelkit app` adds its times). */
const rkEntry = (over = {}) => ({ ...entryOf({ key: "main", name: RK_MAIN, mode: "hifi", version: 1, at: AT, machine: "Mac Studio", fromSuggestion: null, from: FROM, workingCopy: COPY }), ...over });

const STEPS = {
  storyboard: 'Its Reel Kit storyboard is ready. Say "show me the storyboard" to see it in the side panel and leave your notes there, then "make the changes", or "looks good, render it" if it is right.',
  ready: 'Its Reel Kit edit is built. Say "render it", or "open it in HyperFrames" to change it there.',
  rendered: 'Its Reel Kit edit is rendered. Say "hand it off" and I will check it.',
  opened: 'Its Reel Kit edit is open in HyperFrames. When you are done there, export it on This Mac, as MP4, then say "hand it off".'
};
const WAITS_V2 = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
const UNREAD = "I can't read how its Reel Kit edit is doing on this Mac: ask Jason.";

const worlds = [];
after(() => {
  for (const w of worlds) w.t.done();
});

/** The made-up raw video, read and its spellings answered, whose main video has a Reel Kit edit and no HyperFrames project: its entry `entry`,
    and its project on disk as Reel Kit and Studio leave it, its studio.json at `state` (none at all for `state: null`). */
function rkWorld({ state, entry = {}, handoffVersion = 2 } = {}) {
  const w = guideWorld({ projects: null, handoffVersion, over: { version: 4, app: { toolchain: PIN.version, projects: [rkEntry(entry)] } } });
  worlds.push(w);
  const dir = join(w.work, RK_MAIN);
  for (const folder of ["public", "renders", "source", "cards", "fx", "storyboard"]) mkdirSync(join(dir, folder), { recursive: true });
  writeFileSync(join(dir, "edit.py"), "TITLE = \"Know your costs\"\n");
  writeFileSync(join(dir, "public", "index.html"), "<html></html>\n");
  for (const rel of ["edit.py", "public/index.html"]) utimesSync(join(dir, rel), new Date(ms(13, 40)), new Date(ms(13, 40)));
  const fingerprint = compositionFingerprint(dir);
  if (state === "storyboard") writeState(dir, { slug: SLUG, state: "storyboard", job: "edit", step: "storyboard" });
  if (state === "ready") writeState(dir, { slug: SLUG, state: "ready", step: "finalize", fingerprint });
  if (state === "rendered") writeState(dir, { slug: SLUG, state: "rendered", fingerprint, renders: [{ name: `${SLUG}-v1`, file: `renders/${SLUG}-v1.mp4`, phone: null, at: AT, fingerprint }] });
  return { w, dir };
}

/** The line `guide` says of the made-up episode. Nothing she reads holds a path, a flag or the name of a command. */
async function line(w, over) {
  const r = await on(depsOf(w, over), "guide", "3fa9c1");
  assert.equal(r.code, 0, r.text);
  assert.doesNotMatch(r.text, PLAIN);
  return r.said[0];
}

describe("the guide on a raw video whose main video has a Reel Kit edit", () => {
  for (const state of ["storyboard", "ready", "rendered"]) {
    it(`says its step at ${state}, from its project's studio.json`, async () => {
      const { w } = rkWorld({ state });
      assert.equal(await line(w), says(STEPS[state]));
    });
  }

  it("says it is open in HyperFrames once `reelkit app` opened it: its entry's state and times", async () => {
    const { w } = rkWorld({ state: "ready", entry: { state: "opened", opened: ["2026-10-20 14:10"] } });
    assert.equal(await line(w), says(STEPS.opened));
  });

  it("says it is open in HyperFrames from Studio's own mark alone, when the record's entry was not written after the open", async () => {
    const { w } = rkWorld({ state: "ready" });
    markOpened(w.t.home, SLUG, "2026-10-20T19:10:00.000Z");
    assert.equal(await line(w), says(STEPS.opened));
  });

  it("says a rendered edit, opened before its render, is rendered", async () => {
    const { w } = rkWorld({ state: "rendered", entry: { state: "opened", opened: ["2026-10-20 14:10"] } });
    markOpened(w.t.home, SLUG, "2026-10-20T19:10:00.000Z");
    assert.equal(await line(w), says(STEPS.rendered));
  });

  it("says to export a rendered edit from HyperFrames once it was changed there after its render (final review C2)", async () => {
    const { w, dir } = rkWorld({ state: "rendered", entry: { state: "opened", opened: ["2026-10-20 14:10"] } });
    writeFileSync(join(dir, "public", "index.html"), "<html>changed in the app after its render</html>\n");
    assert.equal(await line(w), says(STEPS.opened));
  });

  it("says the wait for version 2, not the hand-off, on a Mac that hands off version 1 only, once it is rendered", async () => {
    const { w } = rkWorld({ state: "rendered", handoffVersion: 1 });
    assert.equal(await line(w, { settings: { ...w.t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 1 } }), says(WAITS_V2));
    const { w: built } = rkWorld({ state: "ready", handoffVersion: 1 });
    assert.equal(await line(built, { settings: { ...built.t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 1 } }), says(STEPS.ready), "before its render, its step is the edit's");
  });

  it("says it can't read the edit when its project has no studio.json", async () => {
    const { w } = rkWorld({ state: null });
    assert.equal(await line(w), says(UNREAD));
  });

  it("never sends a video with a Reel Kit main video to HyperFrames' own steps", async () => {
    for (const state of ["storyboard", "ready", "rendered"]) {
      const { w } = rkWorld({ state });
      assert.doesNotMatch(await line(w), /open it in HyperFrames" to edit it there|You have exported it/);
    }
  });
});
