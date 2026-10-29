// The late check of a finish and a write that comes after it (plan PR 9, the review's C1). A finish waits at least 15 minutes after its last
// copy, then looks at what it put into final/ and puts back whatever is not whole (dropbox.js lateCheck). If the other Mac wrote the
// episode in that time (a spelling that made the hand-off again, a finish of the Reels, a finish of a raw video), final/ holds that
// write's files, which differ from this finish's in size only because they are newer: putting this finish's copies back over them would
// leave the hand-off of an older revision beside a record that names the newer. So nothing is put back over a record that no longer
// says this finish; and a spelling on the other Mac, for a video whose Reels were handed off, waits for that Mac's late check, as a
// spelling of a Final Cut finish does (edit.js saveSpellings). The world is reels-world.js's (and exports-world.js's for a raw video),
// with stand-ins for ffprobe, ffmpeg and the transcriber: nothing touches the real Downloads folder, Dropbox or BRIMM Video Work.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishFinished, finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { PIN } from "../hyperframes.js";
import { downloadsFolder, episodeWork } from "../settings.js";
import { FOLDER, otherMac, reread } from "./episodes.js";
import { entry, exportOf, fw, ms } from "./exports-world.js";
import { HANDOFF, HANDOFF_REL, finishedWorld, handoffIn } from "./reels-world.js";

/** What is added to the late check's 15 minutes before a spelling on the other Mac is let through (edit.js LATE_MARGIN_MS). */
const MARGIN = 2 * 60 * 1000;
const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
const worlds = [];
async function W(opts) {
  const w = await finishedWorld(opts);
  worlds.push(w);
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});
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
/** Have `then` run once, while the finish waits for its late check, 15 minutes after its last copy. Gives the clock's own wait. */
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
  return wait;
}
/** finish asked for the Reels with a yes. */
async function askedReels(w, answers = {}) {
  assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, ...answers }), 0, w.t.said());
  return { ...w.found, record: reread(w.found) };
}
const on = async (deps, ...argv) => {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
};
const MOVED = "The episode's record no longer holds this finish: the other Mac changed it after the copies were made, so nothing in final/ was put back over what it wrote.";

describe("C1. the late check of a finish puts nothing back over a later write", () => {
  it("leaves the hand-off a spelling on the other Mac made again while it waited, and says the record no longer holds its finish", async () => {
    const w = await W();
    const reel = exportOf(w, "reel 2");
    const found = await askedReels(w);
    const her = laptop(w.t);
    let during = null;
    whileLate(w.t, async () => {
      const now = reread(found);
      during = await finishFinished(her, { ...found, record: now }, { record: { ...now, spellings: [["Sallie", "Sally"]] } });
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(during.ok, true, during.why);
    const h = handoffIn(found);
    assert.deepEqual([h.revision, /much, Sally\./.test(h.main.srt)], [3, true], "the hand-off in final/ is the laptop's revision 3, not this Mac's revision 2 put back over it");
    assert.deepEqual([reread(found).finished.revision, reread(found).finished.handoff], [3, HANDOFF_REL]);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MOVED} Say "hand off the Reels" again.`]);
    assert.ok(readdirSync(w.downloads).includes(reel.name), "the export is kept in Downloads, since the record does not hold the finish");
  });
  it("leaves the hand-off a second finish of the Reels on the other Mac wrote while it waited, with both Reels in it", async () => {
    // Reel 1's project was made on the laptop.
    const projects = [entry("reel 1", { on: "Sallie's laptop" }), entry("reel 2")];
    const w = await W({ projects: ["reel 1", "reel 2"], over: { app: { toolchain: PIN.version, projects } } });
    exportOf(w, "reel 2");
    const found = await askedReels(w, { without: ["reel 1"] });
    const her = laptop(w.t);
    const hers = seenFrom(w, her, ["reel 1"]);
    exportOf(hers, "reel 1");
    let during = null;
    whileLate(w.t, async () => {
      assert.equal(await finishEpisode(her, { ...found, record: reread(found) }, { reels: true, yes: true }), 0, w.t.said());
      during = await finishNow(her, { ...found, record: reread(found) });
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(during.ok, true, during.failed.join(" "));
    const h = handoffIn(found);
    assert.deepEqual([h.revision, h.reels.map((r) => r.n)], [3, [1, 2]], "the laptop's revision 3, with Reel 1 added, is what final/ holds");
    assert.deepEqual(Object.keys(reread(found).finished.parts).sort(), ["main", "reel 1", "reel 2"]);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MOVED} Say "hand off the Reels" again.`]);
  });
  it("leaves the hand-off a finish of a raw video on the other Mac wrote while it waited", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    const found = { ...w.found, record: reread(w.found) };
    const her = laptop(w.t);
    const hers = seenFrom(w, her, ["main", "reel 2"]);
    exportOf(hers, "reel 2", { start: [14, 10, 0], text: "the Reel exported again on the laptop" });
    let during = null;
    whileLate(w.t, async () => {
      assert.equal(await finishEpisode(her, { ...found, record: reread(found) }, { yes: true }), 0, w.t.said());
      during = await finishNow(her, { ...found, record: reread(found) });
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(during.ok, true, during.failed.join(" "));
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", "Pricing- what to charge-.brimm-ops.json"), "utf8"));
    assert.equal(handoff.revision, 2, "the laptop's revision 2 is what final/ holds, not revision 1 put back over it");
    assert.equal(reread(found).finished.revision, 2);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MOVED} Say "hand it off" again.`]);
  });
  it("still puts a copy back that went missing when a record written since still says its finish", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const found = await askedReels(w);
    const copied = join(found.folder, "final", HANDOFF);
    whileLate(w.t, async () => {
      // The other Mac only named the episode again, in a record above this finish's own, and a copy went missing.
      const ours = reread(found);
      writeFileSync(recordFile(found.folder, ours.rev + 1), recordText({ ...ours, rev: ours.rev + 1, name: { text: "Pricing, named again", placeholder: false } }));
      rmSync(copied);
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(handoffIn(found).revision, 2, "put back from what this finish made");
  });
});

describe("C1. a spelling on the other Mac waits for the late check of the Reels", () => {
  it("is refused while the finish has its late check to come, with nothing changed, and goes through after it", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const found = await askedReels(w);
    const her = laptop(w.t);
    let refused = null;
    let before = null;
    const wait = whileLate(w.t, async () => {
      before = readFileSync(join(found.folder, HANDOFF_REL), "utf8");
      refused = await on(her.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(refused.code, 1, refused.text);
    // (Seventeen minutes after the record was written, in the zone of the Mac the test runs on.)
    assert.match(refused.text, /^The finish on Mac Studio is still checking its copies in final\/, until 2026-10-20 \d\d:17\. Say it again after that\. Nothing was changed\.$/);
    assert.equal(readFileSync(join(found.folder, HANDOFF_REL), "utf8"), before, "nothing was written meanwhile");
    assert.deepEqual(reread(found).spellings, []);
    // Two minutes after the late check it goes through.
    await wait(MARGIN + 1000);
    const later = await on(her.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(later.code, 0, later.text);
    assert.equal(handoffIn(found).revision, 3);
  });
  it("is not refused for a video whose hand-off holds no Reel: only a first hand-off was written, and it has no late check", async () => {
    const w = await W();
    const her = laptop(w.t);
    const r = await on(her.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(handoffIn(w.found).revision, 2);
  });
});
