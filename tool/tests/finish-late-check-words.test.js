// The late check of a raw video's finish from HyperFrames' exports, and a write that comes after it (plan PR 8 with PR 9's review C1). A finish
// waits at least 15 minutes after its last copy, then looks at what it put into final/ and puts back whatever is not whole (dropbox.js
// lateCheck). If the other Mac wrote the episode in that time, final/ holds that write's files, which differ from this finish's in size only
// because they are newer: none of this finish's is put back over them (finish.js, `movedOn`). That holds for the hand-off of a raw video as PR 8
// makes it, with the words on the main video's picture (`main.onPicture`) and the Reel suggestions: what the later write left in them stays,
// and what it kept of the finish before is the same. The world is exports-world.js's, with stand-ins for ffprobe, ffmpeg and the transcriber:
// nothing here touches the real Downloads folder, Dropbox or BRIMM Video Work.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { downloadsFolder, episodeWork } from "../settings.js";
import { FOLDER, otherMac, reread } from "./episodes.js";
import { CANDIDATES, MAIN_WORDS, exportOf, fw, ms, screen } from "./exports-world.js";
import { HANDOFF } from "./reels-world.js";

const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
const MOVED = "The episode's record no longer holds this finish: the other Mac changed it after the copies were made, so nothing in final/ was put back over what it wrote.";
const LAPTOP_WORDS = { "index.html": '<div id="root" data-composition-id="main" data-start="0" data-duration="180"><div class="clip" data-start="5" data-duration="3">Laptop words</div></div>' };
/** Sallie's laptop, which hands off version 2 as this Mac does. */
function laptop(t) {
  const her = otherMac(t);
  her.settings = { ...her.settings, app: "hyperframes", handoffVersion: 2 };
  return her;
}
/** The world seen from the laptop: its own Downloads, and its own copy of each of the projects `keys` names. */
function seenFrom(w, her, keys) {
  const work = episodeWork(her.home, FOLDER);
  const dirOf = (key) => join(work, w.names[key]);
  for (const key of keys) {
    mkdirSync(join(dirOf(key), "renders"), { recursive: true });
    writeFileSync(join(dirOf(key), "index.html"), "<html></html>");
    utimesSync(join(dirOf(key), "index.html"), new Date(ms(13, 40)), new Date(ms(13, 40)));
  }
  return { ...w, t: { ...w.t, ctx: her, home: her.home }, work, downloads: downloadsFolder(her.home), dirOf };
}
/** Have `then` run once, while the finish waits for its late check, 15 minutes after its last copy. */
function whileLate(t, then) {
  const wait = t.ctx.deps.wait;
  let done = false;
  t.ctx.deps.wait = async (waited) => {
    if (waited === LATE_CHECK_MS && !done) {
      done = true;
      await then();
    }
    return wait(waited);
  };
}
const handoffOf = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
/** A raw video's finish from HyperFrames' exports, asked with a yes (the world has shown her its lower third already) and not yet run. */
async function firstFinish() {
  const w = fw({ candidates: CANDIDATES });
  exportOf(w, "main");
  exportOf(w, "reel 2");
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  return { w, found: { ...w.found, record: reread(w.found) } };
}

describe("a raw video's finish from HyperFrames, and the other Mac's write while its late check waits", () => {
  it("leaves the hand-off a finish of a Reel on the other Mac wrote, which keeps the words on the picture and places the suggestions again", async () => {
    const { w, found } = await firstFinish();
    const her = laptop(w.t);
    const hers = seenFrom(w, her, ["main", "reel 2"]);
    exportOf(hers, "reel 2", { start: [14, 10, 0], text: "the Reel exported again on the laptop" });
    let during = null;
    whileLate(w.t, async () => {
      // The main video is kept as the last finish made it, so her words are not asked again: this finish's are kept in its part.
      assert.equal(await finishEpisode(her, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
      during = await finishNow(her, { ...found, record: reread(found) });
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(during.ok, true, during.failed.join(" "));
    const handoff = handoffOf(found);
    assert.equal(handoff.revision, 2, "the laptop's revision 2 is what final/ holds, not revision 1 put back over it");
    assert.deepEqual(handoff.main.onPicture, MAIN_WORDS);
    assert.deepEqual(handoff.suggestions.map((s) => s.n), [1, 3]);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([reread(found).finished.revision, reread(found).finished.parts.main.onPicture], [2, MAIN_WORDS]);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MOVED} Say "hand it off" again.`]);
    w.t.done();
  });
  it("leaves the hand-off a finish on the other Mac wrote with a new main video and the words she was shown there", async () => {
    const { w, found } = await firstFinish();
    const her = laptop(w.t);
    const hers = seenFrom(w, her, ["main", "reel 2"]);
    screen(hers, "main", LAPTOP_WORDS, { only: true });
    exportOf(hers, "main", { start: [14, 20, 0], text: "the main video exported again on the laptop" });
    let during = null;
    let shown = null;
    whileLate(w.t, async () => {
      // Her yes is to the words she was shown, on the laptop as here: the first call there shows them and starts nothing.
      const said = w.t.said().split("\n").length;
      assert.equal(await finishEpisode(her, { ...found, record: reread(found) }, { yes: true }), 0);
      shown = w.t.said().split("\n").slice(said);
      assert.equal(await finishEpisode(her, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
      during = await finishNow(her, { ...found, record: reread(found) });
    });
    const result = await finishNow(w.t.ctx, found);
    assert.ok(shown.some((line) => line === 'On screen in the main video I found "Laptop words" at 0:05. Right?'), shown.join("\n"));
    assert.equal(during.ok, true, (during.failed || []).join(" "));
    const handoff = handoffOf(found);
    assert.equal(handoff.revision, 2);
    assert.deepEqual(handoff.main.onPicture, ["Laptop words"], "the words the laptop's finish was shown, not this Mac's");
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(reread(found).finished.parts.main.onPicture, ["Laptop words"]);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MOVED} Say "hand it off" again.`]);
    w.t.done();
  });
  it("still puts a copy back that went missing when no later write came, and keeps the words and the suggestions it made", async () => {
    const { w, found } = await firstFinish();
    const copied = join(found.folder, "final", HANDOFF);
    let made = null;
    whileLate(w.t, async () => {
      // The finish has copied the hand-off by now; it is damaged while the finish waits, and no later record says anything else.
      made = readFileSync(copied, "utf8");
      writeFileSync(copied, "damaged while the finish waited");
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = handoffOf(found);
    assert.deepEqual([handoff.revision, handoff.main.onPicture, handoff.suggestions.map((s) => s.n)], [1, MAIN_WORDS, [1, 3]]);
    assert.equal(readFileSync(copied, "utf8"), made, "put back from what this finish made");
    w.t.done();
  });
});
