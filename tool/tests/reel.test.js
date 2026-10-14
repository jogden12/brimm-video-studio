// A picked Reel pushed to Final Cut. Until phase 3 writes a Reel's own project, its timeline is the clip the import cut, whole:
// upright, with its captions on the clip's own clock (reel.js). It goes through phase 1a's push, with its guard.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reelTimeline } from "../reel.js";
import { pushReel, editMain } from "../edit.js";
import { checkFcpxml } from "../fcpxml.js";
import { setup, episodeFor, reread, EDITED, FOLDER } from "./episodes.js";

/** The attributes of every tag of one name in a Final Cut file. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
/** The made-up episode's Reels, as picked: Reel 1 picked, never pushed. */
const PICKED = { ...EDITED, reels: EDITED.reels.map((r) => ({ ...r, pushed: [] })) };
/** ffprobe's answer for an upright clip of 7.7 seconds at 30000/1001. */
const facts = { duration: 7.7, frameRate: "30000/1001", width: 1080, height: 1920, hasAudio: true, audioRate: 48000, audioChannels: 2 };

describe("reelTimeline", () => {
  it("makes the clip the import cut into an upright timeline, whole, with its captions on the clip's own clock", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    const made = await reelTimeline(found, found.record.reels[0], t.ctx);
    assert.ok(made.xml, made.why);
    assert.deepEqual(checkFcpxml(made.xml, facts), []);
    assert.deepEqual(tags(made.xml, "format").map((f) => [f.width, f.height]), [["1080", "1920"]]);
    assert.equal(tags(made.xml, "asset-clip").length, 1);
    assert.equal(tags(made.xml, "caption").length, 1);
    assert.equal(tags(made.xml, "media-rep")[0].src, "../Pricing%20talk.reel-1.mp4");
    assert.equal(tags(made.xml, "import-options").length, 0);
    t.done();
  });
  it("says why there is no timeline: no clip was cut, or ffprobe cannot read the clip", async () => {
    const t = setup({ programs: { FFPROBE: () => ({ code: 1, stderr: "moov atom not found\n" }) } });
    const found = episodeFor(t, { record: PICKED });
    assert.deepEqual(await reelTimeline(found, { ...found.record.reels[0], files: [] }, t.ctx), { why: "Reel 1 has no clip: the import could not cut it." });
    assert.deepEqual(await reelTimeline(found, found.record.reels[0], t.ctx), { why: "Pricing talk.reel-1.mp4 could not be read (moov atom not found)." });
    t.done();
  });
});

describe("push reel", () => {
  it("pushes a picked Reel through the push every part shares, as the Reel's own project", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    assert.equal(await pushReel(t.ctx, found, 1, {}), 0);
    const pushed = reread(found).reels[0].pushed;
    assert.equal(pushed.length, 1);
    assert.equal(pushed[0].project, "Pricing- what to charge- reel 1 v1 3fa9c1");
    assert.equal(pushed[0].file, "edit/reel-1.v1.mac-studio.fcpxml");
    assert.ok(existsSync(join(found.folder, pushed[0].file)));
    assert.match(readFileSync(join(found.folder, pushed[0].file), "utf8"), /media-rep kind="original-media" src="\.\.\/Pricing%20talk\.reel-1\.mp4"/);
    assert.equal(t.opened.length, 1);
    t.done();
  });
  it("keeps the guard: a second push of the Reel needs the answer that there were no hand edits", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    await pushReel(t.ctx, found, 1, {});
    const again = { ...found, record: reread(found) };
    assert.equal(await pushReel(t.ctx, again, 1, {}), 1);
    assert.match(t.said(), /Did you change v1 of .* in Final Cut since it was shown\?/);
    assert.equal(await pushReel(t.ctx, again, 1, { noHandEdits: true }), 0);
    assert.deepEqual(reread(found).reels[0].pushed.map((p) => p.v), [1, 2]);
    t.done();
  });
  it("asks the guard's question from the command line too, at a second push", async () => {
    const t = setup();
    episodeFor(t, { record: PICKED });
    assert.equal(await editMain(["push", "Pricing", "reel", "1"], t.ctx.deps), 0);
    assert.equal(await editMain(["push", "Pricing", "reel", "1"], t.ctx.deps), 1);
    assert.match(t.said(), /Did you change v1 of .* in Final Cut since it was shown\?/);
    assert.equal(await editMain(["push", "Pricing", "reel", "1", "--no-hand-edits"], t.ctx.deps), 0);
    t.done();
  });
  it("starts bringing a clip over when it is not on this Mac yet, as open does, and says to ask again", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    t.ctx.isWhole = (path) => !path.endsWith(".reel-1.mp4");
    assert.equal(await pushReel(t.ctx, found, 1, {}), 1);
    assert.deepEqual(t.started.map(([, args]) => args.slice(-5)), [["bring", "--now", FOLDER, "Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"]]);
    // bring, given files, reads those alone.
    const read = [];
    t.ctx.deps.readAll = async (path) => read.push(path);
    t.ctx.isWhole = () => false;
    assert.equal(await editMain(["bring", "--now", FOLDER, "Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"], { ...t.ctx.deps, isWhole: () => false }), 1);
    assert.deepEqual(read.map((p) => p.split("/").pop()), ["Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"]);
    assert.match(t.said(), /Dropbox is bringing Pricing talk\.reel-1\.mp4 over to this Mac\. Say "show reel 1 in Final Cut" again when it is done\./);
    t.done();
  });
  it("refuses a Reel that is not picked, one that is not there, and any Reel of a short video", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    assert.equal(await pushReel(t.ctx, found, 3, {}), 1);
    assert.match(t.said(), /Reel 3 is not picked\. Pick it first\./);
    assert.equal(await pushReel(t.ctx, found, 9, {}), 1);
    assert.match(t.said(), /There is no Reel 9\./);
    const short = setup();
    assert.equal(await pushReel(short.ctx, episodeFor(short, { record: { kind: "short video", reels: [] } }), 1, {}), 1);
    assert.match(short.said(), /A short video has no Reels\./);
    assert.equal(t.opened.length, 0);
    t.done();
    short.done();
  });
});
