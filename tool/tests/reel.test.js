// A picked Reel pushed to Final Cut, through phase 1a's push, with its guard. For an episode imported before phase 3, which
// has no reels.json, its timeline is the clip the import cut, whole: upright, with its captions on the clip's own clock
// (reel.js). Further down: phase 3's own project of a Reel, the list of candidates (reels), and ask.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync as copyFile, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
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

// Phase 3: a Reel's own project. An episode the import made after phase 3 has reels.json, with each candidate's stretches and
// crops, and a preview of each; its Reels' timelines are made from them (reels.js reelProject), not from a clip.
import { wordsOf, pausesOf, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { reelCandidates, reelsFile, reelEntries, previewPath, REEL_FRAME } from "../reels.js";
import { pickReels } from "../edit.js";
import { TOLD, PAUSES, probed } from "./fixtures.js";
import { NAME } from "./episodes.js";
import { writeFileSync as writeFile } from "node:fs";

/** The made-up recording of fixtures.js, planned by the rules, with Claude cutting "It is very, very important." (p8) and
    picking two clips: the opening (Reel 1) and "So the first thing..." to the end (Reel 2), cropped on a face a quarter of
    the way across. */
const PHASE_3 = (() => {
  const heard = pausesOf(PAUSES);
  const facts = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
  const read = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [{ from: "p4", to: "p5", hook: "The opening", why: "It says what the talk is about." }, { from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
  const plan = applyDecisions(cutPlan(phrasesOf(wordsOf(TOLD), heard), { duration: facts.duration, pauses: heard }), read.decisions, heard).plan;
  const stills = Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.2 }] }));
  const candidates = reelCandidates({ clips: clipRanges(plan, read.clips, heard).clips, plan, facts, stills }).map((c) => ({ ...c, preview: previewPath(c.n) }));
  const files = {
    "Pricing talk.mp4": "the raw video",
    "Pricing talk.cut-plan.json": JSON.stringify({ version: 1, video: "Pricing talk.mp4", facts, phrases: plan.phrases, ranges: plan.ranges, kept: plan.kept, cut: plan.cut, by: plan.by }),
    "reels.json": JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates }), null, 2) + "\n",
    "previews/reel-1.mp4": "preview one",
    "previews/reel-2.mp4": "preview two"
  };
  const record = { name: { text: NAME, placeholder: false }, reels: reelEntries(candidates).map((r) => (r.n === 2 ? { ...r, status: "picked" } : r)) };
  return { facts, candidates, files, record };
})();
/** Put `text` in as the episode's reels.json, and have its first record list that size, as a put of it by the rule does. */
const relist = (found, text) => {
  rmSync(join(found.folder, "reels.json"), { force: true });
  writeFile(join(found.folder, "reels.json"), text);
  const at = join(found.folder, "record", "0001.json");
  const record = JSON.parse(readFileSync(at, "utf8"));
  writeFile(at, JSON.stringify({ ...record, files: { ...record.files, "reels.json": Buffer.byteLength(text) } }, null, 2) + "\n");
};
/** ffprobe's answer for the raw video: the made-up recording, with its sound at 48 kHz in two channels, and the colour
    `colour` gives its picture. */
const rawProbe = (colour = {}) => (args) => {
  writeFile(args[args.indexOf("-o") + 1], probed({ picture: colour, sound: { sample_rate: "48000", channels: 2 } }));
  return { code: 0, stderr: "" };
};
/** A phase 3 episode, and a ctx whose ffprobe reads its raw video. `only` keeps the candidates of those numbers alone, in
    reels.json and the record, as an episode whose import found fewer. */
const phase3 = (programs = {}, { only } = {}) => {
  const t = setup({ programs: { FFPROBE: rawProbe(), ...programs } });
  if (!only) return { t, found: episodeFor(t, { record: PHASE_3.record, files: PHASE_3.files }) };
  const keep = (list) => list.filter((x) => only.includes(x.n));
  const reels = JSON.parse(PHASE_3.files["reels.json"]);
  const files = { ...PHASE_3.files, "reels.json": JSON.stringify({ ...reels, candidates: keep(reels.candidates) }, null, 2) + "\n" };
  return { t, found: episodeFor(t, { record: { ...PHASE_3.record, reels: keep(PHASE_3.record.reels) }, files }) };
};

describe("reelTimeline, a Reel's own project (phase 3)", () => {
  it("is the Reel's stretches as clips, upright, each filled and moved onto the face, its video named from edit/", async () => {
    const { t, found } = phase3();
    const reel = found.record.reels.find((r) => r.n === 2);
    const made = await reelTimeline(found, reel, t.ctx);
    assert.ok(made.xml, made.why);
    const candidate = PHASE_3.candidates[1];
    assert.deepEqual(tags(made.xml, "format").map((f) => [f.id, f.width, f.height]), [["r1", "1280", "720"], ["r3", "1080", "1920"]]);
    assert.deepEqual(tags(made.xml, "asset-clip").map((c) => c.format), candidate.ranges.map(() => "r1"));
    assert.deepEqual(tags(made.xml, "adjust-transform").map((a) => a.position), candidate.ranges.map(() => "44.4444 0"));
    assert.deepEqual(tags(made.xml, "media-rep").map((m) => m.src), ["../Pricing%20talk.mp4"]);
    assert.equal(tags(made.xml, "import-options").length, 0);
    assert.deepEqual(tags(made.xml, "marker").map((m) => m.value), ["Taken out, 2.7 seconds. Claude: It adds nothing to the line before it."]);
    assert.deepEqual(checkFcpxml(made.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    t.done();
  });
  it("carries the video's sound and colour as ffprobe reads them, an iPhone's HDR video's own colour space included", async () => {
    const { t, found } = phase3({ FFPROBE: rawProbe({ color_primaries: "bt2020", color_transfer: "arib-std-b67" }) });
    const made = await reelTimeline(found, found.record.reels[1], t.ctx);
    assert.deepEqual([tags(made.xml, "asset")[0].audioRate, tags(made.xml, "asset")[0].audioChannels], ["48000", "2"]);
    assert.deepEqual(tags(made.xml, "format").map((f) => f.colorSpace), ["9-18-9 (Rec. 2020 HLG)", "1-1-1 (Rec. 709)"]);
    t.done();
  });
  it("carries the sound the tool takes of an iPhone's clip, its AAC, and not the APAC listed first (main #18, soundStream)", async () => {
    const { t, found } = phase3({ FFPROBE: (args) => {
      const told = JSON.parse(probed({ sound: { sample_rate: "48000", channels: 4 } }));
      const [picture, sound] = told.streams;
      told.streams = [{ ...picture, index: 0 }, { ...sound, index: 1, codec_name: "apple_apac" }, { ...sound, index: 2, codec_name: "aac", sample_rate: "44100", channels: 2 }];
      writeFile(args[args.indexOf("-o") + 1], JSON.stringify(told));
      return { code: 0, stderr: "" };
    } });
    const made = await reelTimeline(found, found.record.reels[1], t.ctx);
    assert.deepEqual([tags(made.xml, "asset")[0].audioRate, tags(made.xml, "asset")[0].audioChannels], ["44100", "2"]);
    t.done();
  });
  it("says Dropbox is bringing the video over when it is not whole on this Mac yet", async () => {
    const { t, found } = phase3();
    t.ctx.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.deepEqual(await reelTimeline(found, found.record.reels[1], t.ctx), { coming: "Pricing talk.mp4", bring: ["Pricing talk.mp4"] });
    t.done();
  });
  it("says why there is no project: no such candidate, one with nothing to show, a video ffprobe cannot read, or another video", async () => {
    const { t, found } = phase3();
    assert.deepEqual(await reelTimeline(found, { n: 9, files: [] }, t.ctx), { why: "reels.json has no Reel 9." });
    const empty = phase3();
    const reels = JSON.parse(PHASE_3.files["reels.json"]);
    reels.candidates[1] = { ...reels.candidates[1], ranges: [], failed: "it is shorter than one picture" };
    writeFile(join(empty.found.folder, "reels.json"), JSON.stringify(reels));
    assert.deepEqual(await reelTimeline(empty.found, empty.found.record.reels[1], empty.t.ctx), { why: "Reel 2 has nothing to show: it is shorter than one picture." });
    const unread = phase3({ FFPROBE: () => ({ code: 1, stderr: "moov atom not found\n" }) });
    assert.deepEqual(await reelTimeline(unread.found, unread.found.record.reels[1], unread.t.ctx), { why: "Pricing talk.mp4 could not be read (moov atom not found)." });
    const other = phase3({ FFPROBE: (args) => { writeFile(args[args.indexOf("-o") + 1], probed({ duration: "45.000000" })); return { code: 0, stderr: "" }; } });
    assert.deepEqual(await reelTimeline(other.found, other.found.record.reels[1], other.t.ctx), { why: "Pricing talk.mp4 is not the video its cut plan was made of: it is 45 seconds, 1280 by 720 at 30000/1001, and the plan's is 23.423 seconds, 1280 by 720 at 30000/1001." });
    // A video of the same length and size at another frame rate is another video too: the plan's stretches are on its clock.
    const rate = phase3({ FFPROBE: (args) => { writeFile(args[args.indexOf("-o") + 1], probed({ picture: { r_frame_rate: "25/1", avg_frame_rate: "25/1" } })); return { code: 0, stderr: "" }; } });
    assert.deepEqual(await reelTimeline(rate.found, rate.found.record.reels[1], rate.t.ctx), { why: "Pricing talk.mp4 is not the video its cut plan was made of: it is 23.423 seconds, 1280 by 720 at 25/1, and the plan's is 23.423 seconds, 1280 by 720 at 30000/1001." });
    for (const x of [t, empty.t, unread.t, other.t, rate.t]) x.done();
  });
});

describe("a picked Reel's project (phase 3)", () => {
  it("is written as edit/reel-<n>.v0.fcpxml by the rule when the Reel is picked, listed in the record, and the person is told", async () => {
    const { t, found } = phase3();
    assert.equal(await pickReels(t.ctx, found, [1]), 0);
    const kept = join(found.folder, "edit", "reel-1.v0.fcpxml");
    assert.ok(existsSync(kept));
    assert.match(readFileSync(kept, "utf8"), /<format id="r3" frameDuration="[^"]+" width="1080" height="1920"/);
    assert.ok(t.clones.some(([, to]) => to === kept), "it is cloned in");
    const record = reread(found);
    assert.deepEqual([record.reels[0].status, record.files["edit/reel-1.v0.fcpxml"]], ["picked", readFileSync(kept).length]);
    assert.match(t.said(), /Reel 1 is picked\. Its upright Final Cut project is written\. Say "show reel 1 in Final Cut" to have it pushed\./);
    t.done();
  });
  it("is pushed as the Reel's own project, upright, in the episode's event, its video the raw recording", async () => {
    const { t, found } = phase3();
    assert.equal(await pushReel(t.ctx, found, 2, {}), 0);
    const pushed = reread(found).reels[1].pushed;
    assert.equal(pushed[0].file, "edit/reel-2.v1.mac-studio.fcpxml");
    const xml = readFileSync(join(found.folder, pushed[0].file), "utf8");
    assert.match(xml, /media-rep kind="original-media" src="\.\.\/Pricing%20talk\.mp4"/);
    assert.match(xml, /width="1080" height="1920"/);
    assert.equal(tags(xml, "event")[0].name, FOLDER);
    t.done();
  });
  it("still picks a Reel when its project cannot be written yet, and says why", async () => {
    const { t, found } = phase3();
    t.ctx.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.equal(await pickReels(t.ctx, found, [1]), 0);
    assert.equal(reread(found).reels[0].status, "picked");
    assert.ok(!existsSync(join(found.folder, "edit", "reel-1.v0.fcpxml")));
    assert.match(t.said(), /Reel 1 is picked\. Say "show reel 1 in Final Cut" to have it pushed\. Reel 1's project is written when it is shown: Dropbox is still bringing Pricing talk\.mp4 over to this Mac\./);
    t.done();
  });
  it("brings the raw video over, when it is not on this Mac yet, before it can be pushed", async () => {
    const { t, found } = phase3();
    t.ctx.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.equal(await pushReel(t.ctx, found, 2, {}), 1);
    assert.deepEqual(t.started.map(([, args]) => args.slice(-4)), [["bring", "--now", FOLDER, "Pricing talk.mp4"]]);
    assert.match(t.said(), /Dropbox is bringing Pricing talk\.mp4 over to this Mac\. Say "show reel 2 in Final Cut" again when it is done\./);
    t.done();
  });
});

describe("reels, the list of an episode's Reel candidates (phase 3)", () => {
  it("is printed, and each preview is opened in QuickTime Player", async () => {
    const { t, found } = phase3();
    assert.equal(await editMain(["reels", "Pricing"], t.ctx.deps), 0);
    assert.match(t.said(), /^Reel candidates of Pricing talk\.mp4: 2\.$/m);
    assert.match(t.said(), /^2\. 0:13 to 0:21, 5 seconds\. Picked\.$/m);
    assert.deepEqual(t.opened, [1, 2].map((n) => ["QuickTime Player", join(found.folder, "previews", `reel-${n}.mp4`)]));
    t.done();
  });
  it("names a preview Dropbox has not brought over yet, starts bringing it, and opens the rest", async () => {
    const { t, found } = phase3();
    t.ctx.deps.isWhole = (path) => !path.endsWith("reel-2.mp4");
    assert.equal(await editMain(["reels", "Pricing"], t.ctx.deps), 0);
    assert.match(t.said(), /Dropbox is still bringing previews\/reel-2\.mp4 over to this Mac\./);
    assert.deepEqual(t.opened, [["QuickTime Player", join(found.folder, "previews", "reel-1.mp4")]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(-4)), [["bring", "--now", FOLDER, "previews/reel-2.mp4"]]);
    t.done();
  });
  it("lists only, with --no-play", async () => {
    const { t } = phase3();
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], t.ctx.deps), 0);
    assert.deepEqual(t.opened, []);
    t.done();
  });
  it("says why, in one sentence, when the list cannot be read, as one a newer brimm-video wrote", async () => {
    const { t, found } = phase3();
    writeFile(join(found.folder, "reels.json"), JSON.stringify({ ...JSON.parse(PHASE_3.files["reels.json"]), version: 2 }));
    assert.equal(await editMain(["reels", "Pricing"], t.ctx.deps), 1);
    assert.equal(t.said(), "Its list of Reel candidates cannot be read: it was written by a newer brimm-video. Ask Jason to update this Mac.");
    assert.deepEqual(await reelTimeline(found, found.record.reels[1], t.ctx), { why: "The list of Reel candidates cannot be read: it was written by a newer brimm-video. Ask Jason to update this Mac." });
    t.done();
  });
  it("offers to ask again on a Mac that can, though the importing Mac had no Claude Code (PR 19's review)", async () => {
    const p = askable();
    relist(p.found, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "Claude was not asked", cannotAsk: "Claude Code is not installed on this Mac" })));
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
    assert.equal(p.t.said(), 'There are no Reel candidates of Pricing talk.mp4: Claude was not asked.\nSay "ask Claude again for Reels" to ask again.\n');
    p.t.done();
  });
  it("says why Claude cannot be asked, as ask would, in place of offering it", async () => {
    const p = askable();
    relist(p.found, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "no cut plan could be made" })));
    rmSync(join(p.found.folder, "Pricing talk.cut-plan.json"));
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
    assert.equal(p.t.said(), "There are no Reel candidates of Pricing talk.mp4: no cut plan could be made.\nPricing talk.mp4 has no cut plan here, so Claude cannot be asked.\n");
    const none = askable();
    none.t.ctx.deps.tools = { ...none.t.ctx.deps.tools, claude: "" };
    relist(none.found, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "Claude could not be asked (it timed out)" })));
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], none.t.ctx.deps), 0);
    assert.match(none.t.said(), /\nClaude Code is not installed on this Mac, so Claude cannot be asked\.\n$/);
    p.t.done();
    none.t.done();
  });
  /** An episode whose list has no candidates, as the import wrote it with `more`. */
  const noneListed = (p, more) => relist(p.found, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], ...more })));
  it("says Claude cannot be asked, and brings nothing, for an import that went by the rules alone whose video is not here (PR 19's re-review, N7)", async () => {
    const p = askable();
    noneListed(p, { none: "Claude was not asked", cannotAsk: "the import on Mac Studio is set to go by the rules alone", rulesOnly: true });
    p.t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
    assert.match(p.t.said(), /\nClaude cannot be asked for Reels: the import on Mac Studio is set to go by the rules alone\.\n$/);
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.equal(p.t.started.length, 0);
    p.t.done();
  });
  it("says Claude cannot be asked, and brings nothing, for a recording with no picture whose video is not here (N7)", async () => {
    const p = askable();
    const at = join(p.found.folder, "Pricing talk.cut-plan.json");
    const plan = JSON.parse(readFileSync(at, "utf8"));
    rmSync(at);
    writeFile(at, JSON.stringify({ ...plan, facts: { ...plan.facts, width: 0, height: 0, fps: "" } }));
    noneListed(p, { none: "it has no picture" });
    p.t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
    assert.match(p.t.said(), /\nA recording with no picture gets no Reels\.\n$/);
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.equal(p.t.started.length, 0);
    p.t.done();
  });
  it("does not offer to ask while ask, or another command, is at work on the episode (N8, N16)", async () => {
    for (const [command, said] of [["ask", 'Claude is being asked already. Say "how far is it?" to see how far it has got.'], ["push", `push is running for ${FOLDER} already. Say it again when it has finished.`]]) {
      const p = askable();
      noneListed(p, { none: "Claude picked no clip that stands alone" });
      makeDir(join(p.t.home, "BRIMM Video Work", FOLDER), { recursive: true });
      writeFile(lockOf(p.t.home, FOLDER), JSON.stringify({ pid: 4242, command, nonce: "x" }));
      p.t.ctx.deps.alive = () => true;
      assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
      assert.equal(p.t.said(), `There are no Reel candidates of Pricing talk.mp4: Claude picked no clip that stands alone.\n${said}\n`);
      p.t.done();
    }
  });
  it("still names an old episode's Reels, the clips the import cut, once ask has added candidates", async () => {
    const t = setup({ programs: { CLAUDE: claudeSays([{ from: "p4", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: "[]" }) } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    episodeFor(t, { record: { ...PICKED, reels: [PICKED.reels[0]] }, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": PHASE_3.files["Pricing talk.cut-plan.json"], "Pricing talk.reel-1.mp4": "clip one", "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n" } });
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0);
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], t.ctx.deps), 0);
    assert.match(t.said(), /Reel candidates of Pricing talk\.mp4: 1\.\n/);
    assert.match(t.said(), /\nReels the import cut as clips: Reel 1, picked\.\n/);
    t.done();
  });
  it("says so when the episode has no list of candidates, as one imported before phase 3", async () => {
    const t = setup();
    episodeFor(t, { record: PICKED });
    assert.equal(await editMain(["reels", "Pricing"], t.ctx.deps), 1);
    assert.match(t.said(), /This episode has no list of Reel candidates \(reels\.json\)\. Its Reels are the clips the import cut: Reel 1, Reel 2 and Reel 3\./);
    t.done();
  });
  it("is in the help", () => {
    const said = [];
    editMain(["--help"], { say: (line) => said.push(line) });
    assert.match(said.join("\n"), /node edit\.js reels "<episode>" \[--no-play\]/);
  });
});

// ask: Claude asked again for Reel candidates, the quick part that starts it and the detached part that does it.
import { lockOf, readResult } from "../detached.js";
import { mkdirSync as makeDir } from "node:fs";

/** What Claude Code prints with its reply: one clip, from "Today we are going..." (p5) to "pricing"... that is p5 alone. */
const claudeSays = (clips) => () => ({ code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify({ decisions: [], notes: "", graphics: [], clips }) }) });
/** A phase 3 episode whose ctx can ask Claude, find faces and make previews, all by stand-ins. */
const askable = (programs = {}, shape = { only: [2] }) => {
  const p = phase3({ CLAUDE: claudeSays([{ from: "p7", to: "p7", hook: "Know your costs, first", why: "It is the point." }, { from: "p5", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: [] }))) }), ...programs }, shape);
  p.t.ctx.deps.tools = { ...p.t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
  p.t.ctx.deps.runGuarded = async (cmd, args, limits) => {
    // As the watchdog itself does (guard.js): it never runs a program without both a memory cap and a time limit.
    if (!(limits && limits.most > 0 && limits.limit > 0)) throw new Error("A guarded program needs a memory cap and a time limit.");
    return { ...(await p.t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" };
  };
  return p;
};

describe("ask, Claude asked again for Reels (phase 3)", () => {
  it("starts detached and returns at once", async () => {
    const { t } = askable();
    assert.equal(await editMain(["ask", "Pricing"], t.ctx.deps), 0);
    assert.deepEqual(t.started.map(([, args]) => args.slice(-3)), [["ask", "--now", FOLDER]]);
    assert.match(t.said(), /Started: Claude is asked for Reel candidates again\. Say "how far is it\?" to see how far it has got\./);
    t.done();
  });
  it("refuses a short video, a Mac without Claude Code, and a second ask while one runs", async () => {
    const short = setup();
    episodeFor(short, { record: { kind: "short video", reels: [] } });
    assert.equal(await editMain(["ask", "Pricing"], { ...short.ctx.deps, tools: { ...short.ctx.deps.tools, claude: "CLAUDE" } }), 1);
    assert.match(short.said(), /A short video gets no Reels\./);
    const none = askable();
    none.t.ctx.deps.tools = { ...none.t.ctx.deps.tools, claude: "" };
    assert.equal(await editMain(["ask", "Pricing"], none.t.ctx.deps), 1);
    assert.match(none.t.said(), /Claude Code is not installed on this Mac, so Claude cannot be asked\./);
    const busy = askable();
    makeDir(join(busy.t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFile(lockOf(busy.t.home, FOLDER), JSON.stringify({ pid: 4242, command: "ask", nonce: "x" }));
    busy.t.ctx.deps.alive = () => true;
    assert.equal(await editMain(["ask", "Pricing"], busy.t.ctx.deps), 1);
    assert.match(busy.t.said(), /Claude is being asked already\. Say "how far is it\?"/);
    for (const x of [short, none.t, busy.t]) x.done();
  });
  it("adds Claude's new candidates and their previews by the rule, keeps the picked Reel, and numbers the new ones on", async () => {
    const { t, found } = askable();
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0);
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.equal(reels.by, "ask");
    // The episode has Reel 2 alone, picked; it stays. "Know your costs, first" is inside it, so it is left out; "What this is
    // about" is new: Reel 3.
    assert.deepEqual(reels.candidates.map((c) => [c.n, c.title]), [[2, "Know your costs"], [3, "What this is about"]]);
    assert.equal(reels.highest, 3);
    const record = reread(found);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status, r.files]), [[2, "picked", ["previews/reel-2.mp4"]], [3, "candidate", ["previews/reel-3.mp4"]]]);
    assert.ok(existsSync(join(found.folder, "previews", "reel-3.mp4")));
    assert.ok(t.clones.some(([, to]) => to === join(found.folder, "previews", "reel-3.mp4")), "the preview is cloned in");
    assert.ok(t.clones.some(([, to]) => to === join(found.folder, "record", "0002.json")), "the record is cloned in");
    assert.ok(t.waits.includes(15 * 60 * 1000), "the late check waited");
    const result = readResult(t.home, FOLDER, "ask");
    assert.equal(result.ok, true);
    assert.deepEqual(result.made, ["Reel 3"]);
    assert.ok(result.failed.some((f) => /A new clip from 0:13 to 0:16 was left out: it has words of Reel 2, which is picked\./.test(f)), result.failed.join(" | "));
    t.done();
  });
  it("changes nothing, and says why, when every clip Claude picks has words of a candidate already there", async () => {
    const { t, found } = askable({}, {});
    const before = readFileSync(join(found.folder, "reels.json"), "utf8");
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0);
    assert.equal(readFileSync(join(found.folder, "reels.json"), "utf8"), before);
    assert.equal(reread(found).rev, 1);
    const result = readResult(t.home, FOLDER, "ask");
    assert.deepEqual(result.made, []);
    assert.match(result.next, /^Every clip Claude picked has words of a Reel or a candidate already there\. The Reel candidates are as they were\.$/);
    t.done();
  });
  it("changes nothing, and says why, when Claude cannot be asked", async () => {
    const { t, found } = askable({ CLAUDE: () => ({ code: 1, stderr: "Failed to authenticate\n", stdout: "" }) });
    const before = readFileSync(join(found.folder, "reels.json"), "utf8");
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 1);
    assert.equal(readFileSync(join(found.folder, "reels.json"), "utf8"), before);
    assert.equal(reread(found).rev, 1);
    assert.match(readResult(t.home, FOLDER, "ask").failed[0], /^Claude could not be asked \(/);
    t.done();
  });
  it("is in the help", () => {
    const said = [];
    editMain(["--help"], { say: (line) => said.push(line) });
    assert.match(said.join("\n"), /node edit\.js ask "<episode>"/);
  });
});

describe("a Reel's timeline, decided for each Reel (from the review)", () => {
  it("is the project written at its pick, edit/reel-<n>.v0.fcpxml, once there is one, whatever reels.json says after", async () => {
    const { t, found } = phase3();
    await pickReels(t.ctx, found, [1]);
    const v0 = readFileSync(join(found.folder, "edit", "reel-1.v0.fcpxml"), "utf8");
    // The other Mac's newer brimm-video writes a reels.json this one cannot read, and the record with its size.
    const unreadable = JSON.stringify({ format: "brimm-video reels", version: 2, video: "Pricing talk.mp4", candidates: [] });
    writeFile(join(found.folder, "reels.json"), unreadable);
    const now = reread(found);
    writeFile(join(found.folder, "record", "0003.json"), JSON.stringify({ ...now, rev: 3, files: { ...now.files, "reels.json": unreadable.length } }, null, 2) + "\n");
    assert.deepEqual(await reelTimeline({ ...found, record: reread(found) }, reread(found).reels[0], t.ctx), { xml: v0 });
    assert.equal(await pushReel(t.ctx, { ...found, record: reread(found) }, 1, {}), 0);
    t.done();
  });
  it("is still the clip the import cut for an old episode's Reel, after ask has added candidates of its own", async () => {
    const t = setup();
    const found = episodeFor(t, { record: PICKED });
    const four = { ...PHASE_3.candidates[1], n: 4 };
    writeFile(join(found.folder, "reels.json"), JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "ask", made: "2026-10-20T10:00:00-05:00", candidates: [four] })));
    const made = await reelTimeline(found, found.record.reels[0], t.ctx);
    assert.equal(tags(made.xml, "media-rep")[0].src, "../Pricing%20talk.reel-1.mp4");
    assert.equal(await pushReel(t.ctx, found, 1, {}), 0);
    t.done();
  });
  it("is still the clip for an old episode's Reel after ask itself has run on the episode, numbering its candidates on", async () => {
    const t = setup({ programs: { CLAUDE: claudeSays([{ from: "p4", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: "[]" }) } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    // Imported before phase 3: no reels.json, and its one Reel the clip the import cut, picked and pushed.
    const found = episodeFor(t, { record: { ...PICKED, reels: [PICKED.reels[0]] }, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": PHASE_3.files["Pricing talk.cut-plan.json"], "Pricing talk.reel-1.mp4": "clip one", "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n" } });
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0, readResult(t.home, FOLDER, "ask").failed.join(" | "));
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.deepEqual([reels.candidates.map((c) => [c.n, c.title]), reels.highest], [[[2, "What this is about"]], 2]);
    const now = { ...found, record: reread(found) };
    assert.deepEqual(now.record.reels.map((r) => [r.n, r.status, r.files]), [[1, "picked", ["Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"]], [2, "candidate", ["previews/reel-2.mp4"]]]);
    const made = await reelTimeline(now, now.record.reels[0], t.ctx);
    assert.equal(tags(made.xml, "media-rep")[0].src, "../Pricing%20talk.reel-1.mp4");
    assert.equal(await pushReel(t.ctx, now, 1, { noHandEdits: true }), 0, t.said());
    t.done();
  });
  it("refuses to pick a candidate that has nothing to show, and says why", async () => {
    const { t, found } = phase3();
    const reels = JSON.parse(PHASE_3.files["reels.json"]);
    reels.candidates[0] = { ...reels.candidates[0], ranges: [], preview: null, failed: "it is shorter than one picture" };
    writeFile(join(found.folder, "reels.json"), JSON.stringify(reels));
    assert.equal(await pickReels(t.ctx, found, [1]), 1);
    assert.match(t.said(), /Reel 1 has nothing to show: it is shorter than one picture\./);
    assert.equal(reread(found).reels[0].status, "candidate");
    t.done();
  });
  it("leaves no project behind when the pick is not written, as when the other Mac wrote meanwhile", async () => {
    const { t, found } = phase3();
    const newer = { ...found.record, rev: 2 };
    writeFile(join(found.folder, "record", "0002.json"), JSON.stringify(newer, null, 2) + "\n");
    assert.equal(await pickReels(t.ctx, found, [1]), 1);
    assert.match(t.said(), /Nothing was written/);
    assert.ok(!existsSync(join(found.folder, "edit", "reel-1.v0.fcpxml")), "no project is left that no record lists");
    t.done();
  });
});

describe("ask, when something fails half-way (from the review)", () => {
  it("puts everything back, and writes no record of its own, when the other Mac writes the record meanwhile", async () => {
    const { t, found } = askable();
    const before = readFileSync(join(found.folder, "reels.json"), "utf8");
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      // The other Mac's pick lands just as this Mac's reels.json goes in.
      if (to.endsWith("reels.json") && !existsSync(join(found.folder, "record", "0002.json"))) writeFile(join(found.folder, "record", "0002.json"), JSON.stringify({ ...found.record, rev: 2 }, null, 2) + "\n");
    };
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 1);
    assert.equal(readFileSync(join(found.folder, "reels.json"), "utf8"), before);
    assert.ok(!existsSync(join(found.folder, "previews", "reel-3.mp4")), "the new preview is taken away");
    assert.equal(reread(found).rev, 2);
    const result = readResult(t.home, FOLDER, "ask");
    assert.ok(result.failed.some((f) => /changed on the other Mac/.test(f)));
    // Nothing was made, since everything was put back (finding 1 of PR 19's review).
    assert.deepEqual([result.made, result.next], [[], "The Reel candidates are as they were."]);
    t.done();
  });
  it("puts everything back, and writes no record, when a file cannot be put into the episode", async () => {
    const { t, found } = askable();
    const before = readFileSync(join(found.folder, "reels.json"), "utf8");
    const clone = t.ctx.deps.clone;
    let failed = false;
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith("reels.json") && !failed) {
        failed = true;
        throw new Error("the clone could not be made");
      }
      clone(from, to);
    };
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 1);
    assert.equal(readFileSync(join(found.folder, "reels.json"), "utf8"), before);
    assert.ok(!existsSync(join(found.folder, "previews", "reel-3.mp4")));
    assert.equal(reread(found).rev, 1);
    const result = readResult(t.home, FOLDER, "ask");
    assert.ok(result.failed.some((f) => /^reels\.json could not be put into .*: the clone could not be made\. Nothing was copied\.$/.test(f)), result.failed.join(" | "));
    assert.ok(result.failed.some((f) => /^Nothing was changed in the episode\.$/.test(f)));
    assert.deepEqual([result.made, result.next], [[], "The Reel candidates are as they were."]);
    t.done();
  });
});

// What ask refuses, before anything is asked: each case both in the quick part, which starts nothing, and in the detached
// part, which asks Claude nothing and changes nothing.
import { writeStatus } from "../importing.js";
import { writePending } from "../filing.js";
import { acceptRev, readEpisode, filesProblems, writeEpisode } from "../episode.js";

/** Run ask both ways on a ready episode: the quick part, then the detached part. Resolves what each said and did. */
const askedBoth = async (p) => {
  const quick = await editMain(["ask", "Pricing"], p.t.ctx.deps);
  const started = p.t.started.length;
  const before = existsSync(join(p.found.folder, "reels.json")) ? readFileSync(join(p.found.folder, "reels.json"), "utf8") : null;
  const now = await editMain(["ask", "--now", FOLDER], p.t.ctx.deps);
  const after = existsSync(join(p.found.folder, "reels.json")) ? readFileSync(join(p.found.folder, "reels.json"), "utf8") : null;
  return { quick, started, now, failed: readResult(p.t.home, FOLDER, "ask").failed, claude: p.t.calls.filter((c) => c.cmd === "CLAUDE").length, kept: before === after, rev: reread(p.found).rev };
};

describe("ask, and a video with a sound ffmpeg cannot read beside one it can, as an iPhone's (main #17)", () => {
  it("makes each new preview from the sound it can read, by its number, though APAC is listed first", async () => {
    const p = askable({ FFPROBE: (args) => {
      const told = JSON.parse(probed({ sound: { sample_rate: "48000", channels: 2 } }));
      const [picture, sound] = told.streams;
      told.streams = [{ ...picture, index: 0 }, { ...sound, index: 1, codec_name: "apple_apac", channels: 4 }, { ...sound, index: 2, codec_name: "aac" }];
      writeFile(args[args.indexOf("-o") + 1], JSON.stringify(told));
      return { code: 0, stderr: "" };
    } });
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    const graphs = p.t.calls.filter((c) => c.cmd === "FFMPEG" && /\.part-\d+\.mov$/.test(c.args[c.args.length - 1])).map((c) => c.args[c.args.indexOf("-filter_complex") + 1]);
    assert.ok(graphs.length > 0, "a preview was made");
    for (const g of graphs) assert.ok(/\[0:0\]fps=/.test(g) && /\[1:2\]aresample/.test(g) && !/:[av]\]/.test(g), g);
    p.t.done();
  });
  it("asks nothing, and changes nothing, when ffprobe cannot read the video", async () => {
    const p = askable({ FFPROBE: () => ({ code: 1, stderr: "moov atom not found\n" }) });
    const before = readFileSync(join(p.found.folder, "reels.json"), "utf8");
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.deepEqual(readResult(p.t.home, FOLDER, "ask").failed, ["Pricing talk.mp4 could not be read (moov atom not found)."]);
    assert.equal(p.t.calls.filter((c) => c.cmd === "CLAUDE").length, 0);
    assert.equal(readFileSync(join(p.found.folder, "reels.json"), "utf8"), before);
    p.t.done();
  });
});

describe("ask, when the list or Claude's reply is not as it was read (PR 19's review)", () => {
  it("writes nothing over a list that a newer brimm-video wrote while Claude was asked, and says why", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const newer = JSON.stringify({ ...JSON.parse(readFileSync(at, "utf8")), version: 2 });
    const asked = claudeSays([{ from: "p5", to: "p5", hook: "What this is about", why: "It says it." }]);
    p.t.ctx.deps.run = ((run) => async (cmd, args, more) => {
      if (cmd === "CLAUDE") {
        rmSync(at);
        writeFile(at, newer);
        return asked();
      }
      return run(cmd, args, more);
    })(p.t.ctx.deps.run);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), newer);
    assert.equal(reread(p.found).rev, 1);
    assert.deepEqual(readResult(p.t.home, FOLDER, "ask").failed, ["The list of Reel candidates cannot be read: it was written by a newer brimm-video. Ask Jason to update this Mac."]);
    p.t.done();
  });
  it("puts nothing in when the list changed while the previews were made, as when the other Mac added a candidate", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const theirs = JSON.parse(readFileSync(at, "utf8"));
    const other = JSON.stringify({ ...theirs, candidates: [...theirs.candidates, { ...theirs.candidates[0], n: 9 }], highest: 9 });
    const guarded = p.t.ctx.deps.runGuarded;
    p.t.ctx.deps.runGuarded = async (cmd, args) => {
      if (readFileSync(at, "utf8") !== other) {
        rmSync(at);
        writeFile(at, other);
      }
      return guarded(cmd, args);
    };
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), other);
    assert.ok(!existsSync(join(p.found.folder, "previews", "reel-3.mp4")));
    assert.equal(reread(p.found).rev, 1);
    assert.deepEqual(readResult(p.t.home, FOLDER, "ask").failed, ["This episode changed while Claude was asked, so nothing was changed. Ask again."]);
    p.t.done();
  });
  it("says which of Claude's clips were left out, and what was wrong with its reply, when another clip is taken", async () => {
    const p = askable({ CLAUDE: () => ({ code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify({ decisions: [], notes: 3, graphics: [], clips: [{ from: "p999", to: "p999", hook: "Nowhere", why: "None." }, { from: "p5", to: "p5", hook: "What this is about", why: "It says it." }] }) }) }) });
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0);
    const result = readResult(p.t.home, FOLDER, "ask");
    assert.deepEqual(result.made, ["Reel 3"]);
    assert.ok(result.failed.includes('"notes" in its reply is not text, so it was left out.'), result.failed.join(" | "));
    assert.ok(result.failed.some((f) => /^Clip 1 was left out: /.test(f)), result.failed.join(" | "));
    p.t.done();
  });
});

describe("ask and pick, pinned (PR 19's review)", () => {
  it("copies in again, at its late check, each file Dropbox took away during the wait: the list, the preview and the record", async () => {
    const p = askable();
    const gone = ["reels.json", "previews/reel-3.mp4", "record/0002.json"];
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === 15 * 60 * 1000) for (const f of gone) rmSync(join(p.found.folder, f), { force: true });
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    for (const f of gone) assert.ok(existsSync(join(p.found.folder, f)), f);
    assert.deepEqual(JSON.parse(readFileSync(join(p.found.folder, "reels.json"), "utf8")).candidates.map((c) => c.n), [2, 3]);
    p.t.done();
  });
  it("keeps a candidate whose preview could not be made, when it adds new ones", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const reels = JSON.parse(readFileSync(at, "utf8"));
    relist(p.found, JSON.stringify({ ...reels, candidates: reels.candidates.map((c) => ({ ...c, preview: null, failed: "ffmpeg was stopped: it took more than 2 GB of memory, so it was stopped" })) }, null, 2) + "\n");
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    const after = JSON.parse(readFileSync(at, "utf8"));
    assert.deepEqual(after.candidates.map((c) => [c.n, c.preview, c.failed || ""]), [[2, null, "ffmpeg was stopped: it took more than 2 GB of memory, so it was stopped"], [3, "previews/reel-3.mp4", ""]]);
    p.t.done();
  });
  it("pushes a picked Reel from the project written at its pick, though reels.json can be read and its crop changed since", async () => {
    const { t, found } = phase3();
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 0, t.said());
    const v0 = readFileSync(join(found.folder, "edit", "reel-1.v0.fcpxml"), "utf8");
    // The other Mac's brimm-video, or a hand, moves Reel 1's crop in a list this one can read.
    const at = join(found.folder, "reels.json");
    const reels = JSON.parse(readFileSync(at, "utf8"));
    rmSync(at);
    writeFile(at, JSON.stringify({ ...reels, candidates: reels.candidates.map((c) => (c.n === 1 ? { ...c, ranges: c.ranges.map((r) => ({ ...r, crop: { ...r.crop, x: 0 } })) } : c)) }, null, 2) + "\n");
    const now = { ...found, record: reread(found) };
    const made = await reelTimeline(now, now.record.reels.find((r) => r.n === 1), t.ctx);
    assert.equal(made.xml, v0);
    t.done();
  });
});

describe("ask, when the list its record names is gone (PR 19's re-review, N1, N4, N15)", () => {
  const gone = "reels.json is missing from this episode, though its record lists it, so Claude is not asked: the candidates in it would be lost.";
  it("refuses, and writes no list, when reels.json is gone though the record lists it", async () => {
    const p = askable();
    rmSync(join(p.found.folder, "reels.json"));
    const r = await askedBoth(p);
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.rev], [1, 0, 1, 0, 1]);
    assert.ok(!existsSync(join(p.found.folder, "reels.json")));
    assert.ok(p.t.said().includes(gone), p.t.said());
    assert.deepEqual(r.failed, [gone]);
    p.t.done();
  });
  it("does not name a copy an earlier run kept, which may be older than the list the record names (PR 19's check of dfe3aab, D2, D14)", async () => {
    const p = askable();
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    makeDir(dirname(kept), { recursive: true });
    // An earlier, shorter list: not the one the record lists, by its size.
    writeFile(kept, readFileSync(join(p.found.folder, "reels.json"), "utf8").slice(0, 40));
    rmSync(join(p.found.folder, "reels.json"));
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.equal(p.t.said().trim(), gone);
    p.t.done();
  });
  it("refuses a reels.json that is there but not the one the record lists, as an older one Dropbox put back (D1, D6)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const listed = statSync(at).size;
    rmSync(at);
    writeFile(at, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "an older list" })));
    const r = await askedBoth(p);
    const why = `reels.json in this episode is not the one its record lists (it is ${statSync(at).size} bytes, and the record lists ${listed}), so Claude is not asked: the candidates in the one it lists would be lost. Say it again once Dropbox has brought that one.`;
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("says the candidates are as they were when a put is undone on an episode that never had a list (M1)", async () => {
    const t = setup({ programs: { CLAUDE: claudeSays([{ from: "p4", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: "[]" }) } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    episodeFor(t, { record: { ...PICKED, reels: [PICKED.reels[0]] }, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": PHASE_3.files["Pricing talk.cut-plan.json"], "Pricing talk.reel-1.mp4": "clip one", "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n" } });
    t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 1);
    assert.equal(readResult(t.home, FOLDER, "ask").next, "The Reel candidates are as they were.");
    t.done();
  });
  it("refuses, and writes no list, when reels.json goes while Claude is asked", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const asked = claudeSays([{ from: "p5", to: "p5", hook: "What this is about", why: "It says it." }]);
    p.t.ctx.deps.run = ((run) => async (cmd, args, more) => {
      if (cmd === "CLAUDE") {
        rmSync(at, { force: true });
        return asked();
      }
      return run(cmd, args, more);
    })(p.t.ctx.deps.run);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(at));
    assert.equal(reread(p.found).rev, 1);
    assert.deepEqual(readResult(p.t.home, FOLDER, "ask").failed, [gone]);
    p.t.done();
  });
});

describe("ask's late checks never put this Mac's list back over the other Mac's (PR 19's re-review, N12, N18, N20)", () => {
  /** The other Mac's ask, landing in the episode through Dropbox: its list, the one there with a Reel `n` added, and its record,
      the newest with that Reel and the list's size, one rev on, written on the laptop. */
  const otherMac = (folder, n) => {
    const at = join(folder, "reels.json");
    const reels = JSON.parse(readFileSync(at, "utf8"));
    const text = JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n, title: "Welcome" }], highest: n }, null, 2) + "\n";
    rmSync(at);
    writeFile(at, text);
    const record = readEpisode(folder).record;
    writeFile(join(folder, "record", `${String(record.rev + 1).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 1, writer: { commit: "c709b57", on: "Laptop" }, reels: [...record.reels, { n, status: "candidate", from: 0, to: 4, title: "Welcome", why: "", files: [], pushed: [] }], files: { ...record.files, "reels.json": Buffer.byteLength(text) } }, null, 2) + "\n");
    return text;
  };
  const left = "reels.json was put in by the other Mac since this Mac put it in, as the record lists, so its late check left it as it is.";
  it("leaves the other Mac's newer list, put in during the wait after a good put, and says so", async () => {
    const p = askable();
    let theirs = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === 15 * 60 * 1000) theirs = otherMac(p.found.folder, 4);
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(join(p.found.folder, "reels.json"), "utf8"), theirs);
    const result = readResult(p.t.home, FOLDER, "ask");
    assert.deepEqual(result.made, ["Reel 3"]);
    assert.ok(result.failed.includes(left), result.failed.join(" | "));
    assert.deepEqual(filesProblems(p.found.folder, readEpisode(p.found.folder).record), []);
    p.t.done();
  });
  it("leaves the other Mac's list, whose record is why the put was undone, at the late check of what was put back", async () => {
    const p = askable();
    let failed = false;
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.endsWith("reels.json") && !failed) {
        failed = true;
        throw new Error("the clone could not be made");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    let theirs = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === 15 * 60 * 1000) theirs = otherMac(p.found.folder, 3);
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(join(p.found.folder, "reels.json"), "utf8"), theirs);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes(left), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.deepEqual(filesProblems(p.found.folder, readEpisode(p.found.folder).record), []);
    p.t.done();
  });
});

describe("ask, when its list cannot be put back (PR 19's re-review, N2, N14, N5)", () => {
  it("does not say the candidates are as they were when reels.json could not be put back, and says where its copy is", async () => {
    const p = askable();
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.endsWith("reels.json")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.ok(!existsSync(join(p.found.folder, "reels.json")));
    assert.equal(readResult(p.t.home, FOLDER, "ask").next, `reels.json is not in the episode now. A copy of it is kept at ${kept}: ask Jason to put it back.`);
    p.t.done();
  });
  it("keeps a copy, and does not say nothing was changed, when the late check of what was put back cannot copy it in again", async () => {
    const p = askable();
    const before = readFileSync(join(p.found.folder, "reels.json"), "utf8");
    let broken = false;
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/") || broken) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === 15 * 60 * 1000) {
        rmSync(join(p.found.folder, "reels.json"));
        broken = true;
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.equal(readFileSync(kept, "utf8"), before);
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(!failed.includes("Nothing was changed in the episode."), failed.join(" | "));
    assert.ok(failed.includes(`reels.json could not be put back as it was at its late check. The one that was there is kept at ${kept}.`), failed.join(" | "));
    p.t.done();
  });
});

describe("ask's late checks leave a record another wrote, a file with a conflicted copy, and what no record can judge (PR 19's check of 2d4c8af, F1, F9, F2)", () => {
  const LATE = 15 * 60 * 1000;
  it("leaves another whole record of this run's number, and says a person must choose, as when Sallie dropped a Reel during the wait", async () => {
    const p = askable();
    const at = join(p.found.folder, "record", "0002.json");
    let theirs = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        // Dropbox takes this run's rev 2 away; then a record-only change on this Mac writes its own rev 2.
        rmSync(at);
        const record = readEpisode(p.found.folder).record;
        writeEpisode(p.found.folder, { ...record, reels: record.reels.map((r) => ({ ...r, status: "dropped" })) }, { expectRev: record.rev, writeText: (to, text) => writeFile(to, text), writer: { commit: "c709b57", on: "Mac Studio" }, home: join(p.t.dir, "elsewhere") });
        theirs = readFileSync(at, "utf8");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), theirs);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("record/0002.json is another record of the same number, written meanwhile on Mac Studio: which to keep is for a person to say, so this Mac's was not copied over it."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("copies this run's record in again when it is cut off", async () => {
    const p = askable();
    const at = join(p.found.folder, "record", "0002.json");
    let ours = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        rmSync(at);
        writeFile(at, ours.slice(0, 50));
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(at, "utf8"), ours);
    p.t.done();
  });
  it("leaves a file and its conflicted copy as they are, and says a person must choose", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const copy = join(p.found.folder, "reels (Sallie's MacBook Pro's conflicted copy 2026-10-20).json");
    let theirs = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        // The laptop's list kept the name, and this Mac's became the conflicted copy.
        const ours = readFileSync(at, "utf8");
        theirs = ours.replace('"by": "ask"', '"by": "ask", "on": "laptop"');
        rmSync(at);
        writeFile(at, theirs);
        writeFile(copy, ours);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), theirs);
    assert.ok(existsSync(copy));
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("reels.json has a conflicted copy in the episode: which to keep is for a person to say, so it was left as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("leaves a list it cannot judge while a newer record is still coming, and says so", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let theirs = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        const reels = JSON.parse(readFileSync(at, "utf8"));
        theirs = JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n: 4, preview: "previews/reel-4.mp4" }], highest: 4 }, null, 2) + "\n";
        rmSync(at);
        writeFile(at, theirs);
        // The laptop's record, which lists that list, is not whole yet.
        writeFile(join(p.found.folder, "record", "0003.json"), "{ \"rev\": 3,");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), theirs);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("A newer record of this episode is still coming, so reels.json was left as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("does not put back over a list when the episode has a conflicted copy of it", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const copy = join(p.found.folder, "reels (Sallie's MacBook Pro's conflicted copy 2026-10-20).json");
    let there = "";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        there = readFileSync(at, "utf8");
        writeFile(copy, "the laptop's list");
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), there);
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(failed.includes("reels.json has a conflicted copy in the episode: which to keep is for a person to say, so it was left as it is."), failed.join(" | "));
    assert.ok(!failed.includes("Nothing was changed in the episode."), failed.join(" | "));
    p.t.done();
  });
});

describe("ask's late checks: the record says whose a file is (PR 19's check of 0ab7850, E1, E10)", () => {
  const LATE = 15 * 60 * 1000;
  it("copies in again a list two puts old, short and not the start of this run's, while the record still lists this run's", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let ours = "";
    const older = JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-13T09:00:00-05:00", candidates: [], none: "an older list" }));
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        rmSync(at);
        writeFile(at, older);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(at, "utf8"), ours);
    assert.deepEqual(filesProblems(p.found.folder, readEpisode(p.found.folder).record), []);
    p.t.done();
  });
  it("leaves a preview gone that the record in force no longer lists, and says so", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        rmSync(preview);
        const record = readEpisode(p.found.folder).record;
        const files = { ...record.files };
        delete files["previews/reel-3.mp4"];
        writeFile(join(p.found.folder, "record", `${String(record.rev + 1).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 1, writer: { commit: "c709b57", on: "Laptop" }, files }, null, 2) + "\n");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.ok(!existsSync(preview));
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("previews/reel-3.mp4 is gone, and the record no longer lists it, so its late check left it out."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
});

describe("a list this Mac's own put-back kept, and picks that need no list (PR 19's check of 0ab7850, E5, E6, E9, E12, E13)", () => {
  it("names the kept copy, which is the list the record lists, after this Mac's own put-back could not put it back", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to === at) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.ok(!existsSync(at));
    const again = await editMain(["ask", "Pricing"], p.t.ctx.deps);
    assert.equal(again, 1);
    assert.ok(p.t.said().includes(`reels.json is missing from this episode, though its record lists it, so Claude is not asked: the candidates in it would be lost. The one its record lists is kept at ${kept}: ask Jason to put it back.`), p.t.said());
    p.t.done();
  });
  it("says the list in the episode is this run's, not the one listed, when its put-back could not take it away", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        // The record cannot be written, and the folder then refuses every delete, so this run's list stays.
        chmodSync(p.found.folder, 0o555);
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    try {
      assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    } finally {
      chmodSync(p.found.folder, 0o755);
    }
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.equal(readResult(p.t.home, FOLDER, "ask").next, `reels.json in the episode is this run's new list, which its record does not list. The one it lists is kept at ${kept}: ask Jason to put it back.`);
    p.t.done();
  });
  it("picks a Reel whose project is written and listed, though the listed reels.json is gone", async () => {
    const { t, found } = phase3();
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 0, t.said());
    rmSync(join(found.folder, "reels.json"));
    assert.equal(await editMain(["reel", "drop", "Pricing", "1"], t.ctx.deps), 0, t.said());
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 0, t.said());
    t.done();
  });
  it("picks a clip Reel of an episode imported before phase 3, after ask added a list that is now gone", async () => {
    const t = setup({ programs: { CLAUDE: claudeSays([{ from: "p4", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: "[]" }) } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    const found = episodeFor(t, { record: { ...PICKED, reels: [{ ...PICKED.reels[0], status: "candidate" }] }, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": PHASE_3.files["Pricing talk.cut-plan.json"], "Pricing talk.reel-1.mp4": "clip one", "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n" } });
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0);
    rmSync(join(found.folder, "reels.json"));
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 0, t.said());
    t.done();
  });
  it("says the episode changed, not that the list is stale, when the other Mac's ask lands while Claude answers", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const asked = claudeSays([{ from: "p5", to: "p5", hook: "What this is about", why: "It says it." }]);
    p.t.ctx.deps.run = ((run) => async (cmd, args, more) => {
      if (cmd === "CLAUDE") {
        const reels = JSON.parse(readFileSync(at, "utf8"));
        const text = JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n: 4, preview: "previews/reel-4.mp4" }], highest: 4 }, null, 2) + "\n";
        rmSync(at);
        writeFile(at, text);
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", "0002.json"), JSON.stringify({ ...record, rev: 2, writer: { commit: "c709b57", on: "Laptop" }, files: { ...record.files, "reels.json": Buffer.byteLength(text) } }, null, 2) + "\n");
        return asked();
      }
      return run(cmd, args, more);
    })(p.t.ctx.deps.run);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.deepEqual(readResult(p.t.home, FOLDER, "ask").failed, ["This episode changed while Claude was asked, so nothing was changed. Ask again."]);
    p.t.done();
  });
});

describe("a kept list is named only when the list there is this Mac's own unlisted one (PR 19's check of 2d4c8af, F4, F8, F11)", () => {
  /** The episode as E6 leaves it: this run's record could not be written, and the folder refused to let its list be taken
      away, so this run's list stays, unlisted, and the listed one is kept. */
  const e6 = async () => {
    const p = askable();
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        chmodSync(p.found.folder, 0o555);
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    try {
      assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    } finally {
      chmodSync(p.found.folder, 0o755);
    }
    p.t.ctx.deps.clone = (from, to) => copyFile(from, to);
    return { ...p, kept: join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json") };
  };
  it("names the kept list to ask, after this Mac's own list stayed unlisted", async () => {
    const p = await e6();
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.match(p.t.said(), new RegExp(`so Claude is not asked: the candidates in the one it lists would be lost\\. The one its record lists is kept at ${p.kept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: ask Jason to put it back\\.`));
    p.t.done();
  });
  it("does not show this Mac's unlisted list as the candidates, and names the kept one (F8)", async () => {
    const p = await e6();
    const there = statSync(join(p.found.folder, "reels.json")).size;
    const listed = reread(p.found).files["reels.json"];
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 1);
    assert.equal(p.t.said().split("\n").pop(), `reels.json in this episode is not the one its record lists (it is ${there} bytes, and the record lists ${listed}), so its candidates are not shown. The one its record lists is kept at ${p.kept}: ask Jason to put it back.`);
    p.t.done();
  });
  it("does not name a kept list when the list there is the other Mac's newer one, landed before its record (F4)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    makeDir(dirname(kept), { recursive: true });
    writeFile(kept, readFileSync(at, "utf8"));
    const reels = JSON.parse(readFileSync(at, "utf8"));
    rmSync(at);
    writeFile(at, JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n: 4, preview: "previews/reel-4.mp4" }], highest: 4 }, null, 2) + "\n");
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.ok(!p.t.said().includes(kept), p.t.said());
    assert.match(p.t.said(), /Say it again once Dropbox has brought that one\.$/);
    p.t.done();
  });
});

describe("ask's late check and put-back, pinned (PR 19's check of 2d4c8af, F3, F6, F7, F11)", () => {
  const LATE = 15 * 60 * 1000;
  /** A Laptop record at rev `rev`, the newest with `files` laid over its files, written straight into the folder. */
  const laptopRecord = (found, rev, files) => {
    const record = readEpisode(found.folder).record;
    writeFile(join(found.folder, "record", `${String(rev).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev, writer: { commit: "c709b57", on: "Laptop" }, files: { ...record.files, ...files } }, null, 2) + "\n");
  };
  it("copies in again a file gone when no record can be read, as with a conflicted copy of another file", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        rmSync(preview);
        writeFile(join(p.found.folder, "Pricing talk (Sallie's MacBook Pro's conflicted copy 2026-10-20).cut-plan.json"), "{}");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    await editMain(["ask", "--now", FOLDER], p.t.ctx.deps);
    assert.ok(existsSync(preview));
    p.t.done();
  });
  it("puts back the list that was there over a list two puts old, which the record does not list", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        rmSync(at);
        writeFile(at, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-13T09:00:00-05:00", candidates: [], none: "an older list" })));
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), before);
    p.t.done();
  });
  it("puts back the list that was there over this run's own, though the other Mac's newer record lists another size", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      clone(from, to);
      if (to === at) laptopRecord(p.found, 2, { "reels.json": 9999 });
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), before);
    p.t.done();
  });
  it("leaves at the put-back a list it cannot judge while a newer record is still coming", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const theirs = "the laptop's list";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        rmSync(at);
        writeFile(at, theirs);
        writeFile(join(p.found.folder, "record", "0003.json"), "{ \"rev\": 3,");
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), theirs);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("A newer record of this episode is still coming, so reels.json was left as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  /** An episode imported before phase 3, with no list, whose ask's record cannot be written: so its put is undone, taking
      away the new list and preview. `during` runs at the put-back's wait, given the episode and this run's own preview. */
  const oldUndone = async (during) => {
    const t = setup({ programs: { CLAUDE: claudeSays([{ from: "p4", to: "p5", hook: "What this is about", why: "It says it." }]), SWIFT: () => ({ code: 0, stderr: "", stdout: "[]" }) } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE", swift: "SWIFT" };
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    const found = episodeFor(t, { record: { ...PICKED, reels: [PICKED.reels[0]] }, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": PHASE_3.files["Pricing talk.cut-plan.json"], "Pricing talk.reel-1.mp4": "clip one", "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n" } });
    const preview = join(found.folder, "previews", "reel-2.mp4");
    let ours = "";
    t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to === preview) ours = readFileSync(from, "utf8");
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(t.ctx.deps.clone);
    t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) await during(found, preview, ours);
      return wait(ms);
    })(t.ctx.deps.wait);
    const code = await editMain(["ask", "--now", FOLDER], t.ctx.deps);
    return { t, found, preview, code, result: readResult(t.home, FOLDER, "ask") };
  };
  it("waits, and takes away again a preview Dropbox brought back, when every file of the undone put was new (F6, F11)", async () => {
    const r = await oldUndone((found, preview, ours) => writeFile(preview, ours));
    assert.ok(r.t.waits.includes(LATE));
    assert.ok(!existsSync(r.preview));
    r.t.done();
  });
  it("leaves a preview that came back but is not this run's (F6)", async () => {
    const r = await oldUndone((found, preview) => writeFile(preview, "the laptop's preview"));
    assert.equal(readFileSync(r.preview, "utf8"), "the laptop's preview");
    r.t.done();
  });
  it("leaves a preview that came back when a record lists it (F6)", async () => {
    const r = await oldUndone((found, preview, ours) => {
      writeFile(preview, ours);
      laptopRecord(found, 2, { "previews/reel-2.mp4": Buffer.byteLength(ours) });
    });
    assert.ok(existsSync(r.preview));
    r.t.done();
  });
  it("does not say nothing was changed when a preview that came back cannot be taken away again (F11)", async () => {
    let previews = "";
    const r = await oldUndone((found, preview, ours) => {
      writeFile(preview, ours);
      previews = dirname(preview);
      chmodSync(previews, 0o555);
    });
    chmodSync(previews, 0o755);
    assert.ok(r.result.failed.includes("previews/reel-2.mp4 could not be taken away again: " + r.result.failed.find((f) => f.startsWith("previews/reel-2.mp4 could not be taken away again: ")).slice("previews/reel-2.mp4 could not be taken away again: ".length)), r.result.failed.join(" | "));
    assert.ok(!r.result.failed.includes("Nothing was changed in the episode."), r.result.failed.join(" | "));
    r.t.done();
  });
  it("names the kept list in reels and reel pick too, after this Mac's own put-back lost it (F7, F11)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to === at) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    const said = () => p.t.said().split("\n").pop();
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 1);
    assert.equal(said(), `reels.json is missing from this episode, though its record lists it, so its Reel candidates cannot be shown. The one its record lists is kept at ${kept}: ask Jason to put it back.`);
    assert.equal(await editMain(["reel", "pick", "Pricing", "2"], p.t.ctx.deps), 1);
    assert.equal(said(), `reels.json is missing from this episode, though its record lists it, so no Reel is picked: its project could not be made. The one its record lists is kept at ${kept}: ask Jason to put it back.`);
    p.t.done();
  });
  it("needs the list to pick a Reel whose listed project is gone (F11)", async () => {
    const { t, found } = phase3();
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 0, t.said());
    assert.equal(await editMain(["reel", "drop", "Pricing", "1"], t.ctx.deps), 0, t.said());
    rmSync(join(found.folder, "edit", "reel-1.v0.fcpxml"));
    rmSync(join(found.folder, "reels.json"));
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], t.ctx.deps), 1);
    t.done();
  });
});

describe("ask's put-back, pinned (PR 19's check of 0ab7850, E2, E4, E11, E15)", () => {
  const LATE = 15 * 60 * 1000;
  it("takes away again a new preview Dropbox brought back after the put was undone", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    let ours = "";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to === preview) ours = readFileSync(from, "utf8");
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) writeFile(preview, ours);
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(preview));
    p.t.done();
  });
  it("does not name a copy an earlier run kept, when the list is gone after this run kept none", async () => {
    const p = askable();
    const stale = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    makeDir(dirname(stale), { recursive: true });
    writeFile(stale, "an earlier list");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.endsWith("reel-3.mp4")) {
        // The preview cannot be put in, and Dropbox takes the list away meanwhile: this run kept no copy of it.
        rmSync(join(p.found.folder, "reels.json"), { force: true });
        throw new Error("No space left on device");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readResult(p.t.home, FOLDER, "ask").next, "reels.json is not in the episode now.");
    p.t.done();
  });
  it("leaves a list as it was, and says nothing changed, when its delete is refused and nothing was put in over it", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      clone(from, to);
      // Once the preview is in, the episode's folder refuses every delete, as the File Provider can.
      if (to.endsWith("reel-3.mp4")) chmodSync(p.found.folder, 0o555);
    })(p.t.ctx.deps.clone);
    try {
      assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    } finally {
      chmodSync(p.found.folder, 0o755);
    }
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.equal(readFileSync(at, "utf8"), before);
    assert.ok(!failed.some((f) => /could not be put back/.test(f)), failed.join(" | "));
    assert.ok(failed.includes("Nothing was changed in the episode."), failed.join(" | "));
    p.t.done();
  });
});

describe("ask's late checks decide whose a file is by its words (PR 19's check of dfe3aab, D4, D5, D9, D11, D13)", () => {
  const LATE = 15 * 60 * 1000;
  it("copies in again a list Dropbox left short, though this Mac wrote a record during the wait", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let ours = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        // This Mac names the episode meanwhile (a record of its own), and Dropbox leaves reels.json short.
        const record = readEpisode(p.found.folder).record;
        writeEpisode(p.found.folder, { ...record, name: { text: "Pricing: what to charge?", placeholder: false } }, { expectRev: record.rev, writeText: (to, text) => writeFile(to, text), writer: { commit: "c709b57", on: "Mac Studio" }, home: p.t.home });
        rmSync(at);
        writeFile(at, ours.slice(0, Math.floor(ours.length / 2)));
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(at, "utf8"), ours);
    assert.ok(!readResult(p.t.home, FOLDER, "ask").failed.some((f) => /was changed since/.test(f)));
    p.t.done();
  });
  it("copies in again a list Dropbox put back as it was before this put", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    let ours = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        rmSync(at);
        writeFile(at, before);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(at, "utf8"), ours);
    p.t.done();
  });
  it("puts the list back again when Dropbox brings back this run's put over what was put back", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    let ours = "";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.endsWith("reels.json") && !ours) ours = readFileSync(from, "utf8");
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        rmSync(at);
        writeFile(at, ours);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), before);
    p.t.done();
  });
  it("leaves, and does not put back, a list someone else put there before the put was undone", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let theirs = "";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        // While this run's record goes in, the other Mac's list lands over this run's, with a record of its own that lists
        // its size; and this run's record cannot be written.
        const reels = JSON.parse(readFileSync(at, "utf8"));
        theirs = JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n: 9 }], highest: 9 }, null, 2) + "\n";
        rmSync(at);
        writeFile(at, theirs);
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", `${String(record.rev + 2).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 2, writer: { commit: "c709b57", on: "Laptop" }, files: { ...record.files, "reels.json": Buffer.byteLength(theirs) } }, null, 2) + "\n");
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), theirs);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("reels.json was put in by the other Mac since this Mac put it in, as the record lists, so it was left as it is, not put back."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
});

describe("reels, pick and push of an episode whose listed reels.json is gone (PR 19's check of dfe3aab, D3)", () => {
  it("say the list is missing, not that the Reels are clips the import cut", async () => {
    const { t, found } = phase3();
    rmSync(join(found.folder, "reels.json"));
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], t.ctx.deps), 1);
    assert.equal(t.said(), "reels.json is missing from this episode, though its record lists it, so its Reel candidates cannot be shown. Say this again once Dropbox has it back.");
    const pick = phase3();
    rmSync(join(pick.found.folder, "reels.json"));
    assert.equal(await editMain(["reel", "pick", "Pricing", "1"], pick.t.ctx.deps), 1);
    assert.equal(pick.t.said(), "reels.json is missing from this episode, though its record lists it, so no Reel is picked: its project could not be made. Say this again once Dropbox has it back.");
    assert.equal(reread(pick.found).rev, 1);
    assert.deepEqual(await reelTimeline(found, found.record.reels[1], t.ctx), { why: "reels.json is missing from this episode, though its record lists it." });
    t.done();
    pick.t.done();
  });
});

describe("ask, of a recording with no picture (PR 19's review)", () => {
  it("refuses, since a recording with no picture gets no Reels", async () => {
    const p = askable();
    const at = join(p.found.folder, "Pricing talk.cut-plan.json");
    const plan = JSON.parse(readFileSync(at, "utf8"));
    rmSync(at);
    writeFile(at, JSON.stringify({ ...plan, facts: { ...plan.facts, width: 0, height: 0, fps: "" } }));
    const r = await askedBoth(p);
    const why = "A recording with no picture gets no Reels.";
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
});

describe("ask's result when no clip is taken, pinned (PR 19's re-review, N3)", () => {
  it("still says what was wrong with Claude's reply, and which clips were left out", async () => {
    const p = askable({ CLAUDE: () => ({ code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify({ decisions: [], notes: 3, graphics: [], clips: [{ from: "p999", to: "p999", hook: "Nowhere", why: "None." }] }) }) }) });
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0);
    const result = readResult(p.t.home, FOLDER, "ask");
    assert.deepEqual(result.made, []);
    assert.ok(result.failed.includes('"notes" in its reply is not text, so it was left out.'), result.failed.join(" | "));
    assert.ok(result.failed.some((f) => /^Clip 1 was left out: /.test(f)), result.failed.join(" | "));
    p.t.done();
  });
});

describe("ask's late checks copy nothing once the other Mac has the episode (PR 19's rebased check, fidelity-1)", () => {
  const LATE = 15 * 60 * 1000;
  /** The laptop opens the episode: its claim, as a record of its own one rev on. */
  const laptopOpens = (found) => {
    const record = readEpisode(found.folder).record;
    writeFile(join(found.folder, "record", `${String(record.rev + 1).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
  };
  it("leaves what is not whole after a good put, says so, and is not ok, when the laptop opened it during the wait", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        const cut = readFileSync(at, "utf8").slice(0, 40);
        rmSync(at);
        writeFile(at, cut);
        rmSync(preview);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8").length, 40);
    assert.ok(!existsSync(preview));
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    for (const f of ["previews/reel-3.mp4", "reels.json"]) assert.ok(failed.includes(`${f} is not as this Mac put it at the late check, and Sallie's laptop has ${NAME} open now, so it was not copied in again. This Mac's copy is kept at ${join(p.t.home, "BRIMM Video Work", FOLDER, "put back", f)}.`), failed.join(" | "));
    p.t.done();
  });
  it("copies nothing back at the put-back's late check either, when the laptop opened it during that wait", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        rmSync(at);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(at));
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(failed.includes(`reels.json is not as this Mac put it at the late check, and Sallie's laptop has ${NAME} open now, so it was not copied in again. This Mac's copy is kept at ${join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json")}.`), failed.join(" | "));
    assert.ok(!failed.includes("Nothing was changed in the episode."), failed.join(" | "));
    p.t.done();
  });
  it("at the put-back, leaves a list the laptop put in after it opened the episode, and says why", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) {
        // While this run's record goes in, the laptop opens the episode (a record one rev further on) and puts its own list
        // in; this run's record cannot be written.
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", `${String(record.rev + 2).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 2, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
        rmSync(at);
        writeFile(at, "the laptop's list");
        throw new Error("Operation not permitted");
      }
      clone(from, to);
    })(p.t.ctx.deps.clone);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readFileSync(at, "utf8"), "the laptop's list");
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(failed.includes(`Sallie's laptop has ${NAME} open now, so reels.json was left as it is.`), failed.join(" | "));
    p.t.done();
  });
  it("keeps this run's copy of a list it does not copy in under her claim, says where, and names it after (PR 19's final check, claim-latecheck-1)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let ours = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        laptopOpens(p.found);
        rmSync(at);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.equal(readFileSync(kept, "utf8"), ours);
    const result = readResult(p.t.home, FOLDER, "ask");
    assert.ok(result.failed.includes(`reels.json is not as this Mac put it at the late check, and Sallie's laptop has ${NAME} open now, so it was not copied in again. This Mac's copy is kept at ${kept}.`), result.failed.join(" | "));
    assert.ok(!/show me the Reels/.test(result.next), result.next);
    // Shown the Reels afterwards, the list the record lists is named where it is kept.
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 1);
    assert.ok(p.t.said().endsWith(`The one its record lists is kept at ${kept}: ask Jason to put it back.`), p.t.said());
    p.t.done();
  });
  it("keeps the list it put back, under her claim, when its late check cannot copy it in again", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        rmSync(at);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.equal(readFileSync(kept, "utf8"), before);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes(`reels.json is not as this Mac put it at the late check, and Sallie's laptop has ${NAME} open now, so it was not copied in again. This Mac's copy is kept at ${kept}.`), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("sees her claim though a conflicted copy is in the folder, and copies nothing in (claim-latecheck-2)", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        writeFile(join(p.found.folder, "Pricing talk (Sallie's laptop's conflicted copy 2026-10-20).cut-plan.json"), "{}");
        rmSync(preview);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(preview));
    p.t.done();
  });
  it("sees her claim in a conflicted copy of a record, and copies nothing in (claim-latecheck-2)", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), JSON.stringify({ ...record, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
        rmSync(preview);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(preview));
    p.t.done();
  });
  it("copies nothing in once her claim is seen after this run's record goes back in (claim-latecheck-3)", async () => {
    const p = askable();
    const own = join(p.found.folder, "record", "0002.json");
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    let waited = false;
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      clone(from, to);
      if (waited && to === own) laptopOpens(p.found);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        waited = true;
        rmSync(own);
        rmSync(preview);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(existsSync(own));
    assert.ok(!existsSync(preview));
    p.t.done();
  });
  it("names a preview of this run's that came back under her claim, and does not say nothing was changed (claim-latecheck-4)", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    let ours = "";
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (to === preview) ours = readFileSync(from, "utf8");
      if (to.includes("/record/")) throw new Error("Operation not permitted");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        writeFile(preview, ours);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(existsSync(preview));
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(failed.includes(`previews/reel-3.mp4 is this run's, and no record lists it, but Sallie's laptop has ${NAME} open now, so it was left as it is.`), failed.join(" | "));
    assert.ok(!failed.includes("Nothing was changed in the episode."), failed.join(" | "));
    p.t.done();
  });
  it("calls a list she put in under her claim hers, as her record lists it, and keeps no copy of this run's (PR 19, G3)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    let hers = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        laptopOpens(p.found);
        // Her own ask, under her claim: her list, and her record that lists it.
        const reels = JSON.parse(readFileSync(at, "utf8"));
        hers = JSON.stringify({ ...reels, candidates: [...reels.candidates, { ...reels.candidates[0], n: 4, preview: "previews/reel-4.mp4" }], highest: 4 }, null, 2) + "\n";
        rmSync(at);
        writeFile(at, hers);
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", `${String(record.rev + 1).padStart(4, "0")}.json`), JSON.stringify({ ...record, rev: record.rev + 1, files: { ...record.files, "reels.json": Buffer.byteLength(hers) } }, null, 2) + "\n");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 0, readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    assert.equal(readFileSync(at, "utf8"), hers);
    assert.ok(!existsSync(join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json")));
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("reels.json was put in by the other Mac since this Mac put it in, as the record lists, so its late check left it as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("keeps this run's list when Dropbox brings the one before back, though her claim, made from the record before, lists that one (PR 19, H1)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    const before = readFileSync(at, "utf8");
    let ours = "";
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        ours = readFileSync(at, "utf8");
        // Her laptop, behind, opened the episode from rev 1 as this run wrote rev 2: Dropbox keeps her claim as a conflicted
        // copy of 0002, listing the list before. And Dropbox brings that list back over this run's.
        const first = JSON.parse(readFileSync(join(p.found.folder, "record", "0001.json"), "utf8"));
        writeFile(join(p.found.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), JSON.stringify({ ...first, rev: 2, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
        rmSync(at);
        writeFile(at, before);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const kept = join(p.t.home, "BRIMM Video Work", FOLDER, "put back", "reels.json");
    assert.equal(readFileSync(kept, "utf8"), ours);
    const failed = readResult(p.t.home, FOLDER, "ask").failed;
    assert.ok(failed.includes(`reels.json is not as this Mac put it at the late check, and Sallie's laptop has ${NAME} open now, so it was not copied in again. This Mac's copy is kept at ${kept}.`), failed.join(" | "));
    assert.ok(!failed.some((f) => /^reels\.json was put in by the other Mac/.test(f)), failed.join(" | "));
    p.t.done();
  });
  it("does not count a claim in a conflicted copy of a record older than the one in force (G4)", async () => {
    const p = askable();
    const preview = join(p.found.folder, "previews", "reel-3.mp4");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        const first = JSON.parse(readFileSync(join(p.found.folder, "record", "0001.json"), "utf8"));
        writeFile(join(p.found.folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), JSON.stringify({ ...first, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
        rmSync(preview);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    await editMain(["ask", "--now", FOLDER], p.t.ctx.deps);
    assert.ok(existsSync(preview));
    p.t.done();
  });
  it("says a person must choose when her claim is in a conflicted copy of this run's record, though all else is as it put it (G4)", async () => {
    const p = askable();
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        const record = readEpisode(p.found.folder).record;
        writeFile(join(p.found.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), JSON.stringify({ ...record, writer: { commit: "c709b57", on: "Sallie's laptop" }, editing: { by: "Sallie's laptop", since: "2026-10-20T15:10:00-05:00" } }, null, 2) + "\n");
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("record/0002.json has a conflicted copy in the episode: which to keep is for a person to say, so it was left as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
  it("does not say copies are kept when none were (G5)", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        writeFile(join(p.found.folder, "Pricing talk (Sallie's laptop's conflicted copy 2026-10-20).cut-plan.json"), "{}");
        const cut = readFileSync(at, "utf8").slice(0, 40);
        rmSync(at);
        writeFile(at, cut);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.equal(readResult(p.t.home, FOLDER, "ask").next, "Not everything is as this Mac put it: what is not done says which.");
    p.t.done();
  });
  it("leaves a record and its conflicted copy whose Mac name has brackets and a number (fidelity-3)", async () => {
    const p = askable();
    const at = join(p.found.folder, "record", "0002.json");
    const copy = join(p.found.folder, "record", "0002 (Sallie's MacBook Air (2)'s conflicted copy 2026-10-20) (1).json");
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === LATE) {
        writeFile(copy, readFileSync(at, "utf8"));
        rmSync(at);
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    assert.ok(!existsSync(at));
    assert.ok(readResult(p.t.home, FOLDER, "ask").failed.includes("record/0002.json has a conflicted copy in the episode: which to keep is for a person to say, so it was left as it is."), readResult(p.t.home, FOLDER, "ask").failed.join(" | "));
    p.t.done();
  });
});

describe("ask, reels and an episode the other Mac has open (phase 1b's claim)", () => {
  /** The episode as the laptop has it open: its record says so. */
  const openOnLaptop = (found) => {
    const at = join(found.folder, "record", "0001.json");
    const record = JSON.parse(readFileSync(at, "utf8"));
    writeFile(at, JSON.stringify({ ...record, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } }, null, 2) + "\n");
  };
  const held = `Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`;
  it("ask refuses, both parts, and asks nothing", async () => {
    const p = askable();
    openOnLaptop(p.found);
    const r = await askedBoth(p);
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(held), p.t.said());
    assert.deepEqual(r.failed, [held]);
    p.t.done();
  });
  it("reels says so in place of offering to ask, without saying nothing was changed by a listing (claim-items-4)", async () => {
    const p = askable();
    relist(p.found, JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "Claude picked no clip that stands alone" })));
    openOnLaptop(p.found);
    assert.equal(await editMain(["reels", "Pricing", "--no-play"], p.t.ctx.deps), 0);
    assert.equal(p.t.said(), `There are no Reel candidates of Pricing talk.mp4: Claude picked no clip that stands alone.\n${held.replace(" Nothing was changed.", "")}\n`);
    p.t.done();
  });
  it("ask says the other Mac has it before it says ask is running here (claim-items-3)", async () => {
    const p = askable();
    openOnLaptop(p.found);
    makeDir(join(p.t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFile(lockOf(p.t.home, FOLDER), JSON.stringify({ pid: 4242, command: "ask", nonce: "x" }));
    p.t.ctx.deps.alive = () => true;
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.equal(p.t.said(), held);
    p.t.done();
  });
});

describe("ask, what it refuses (from the review)", () => {
  it("refuses a list of Reel candidates it cannot read, as one a newer brimm-video wrote, and writes nothing over it", async () => {
    const p = askable();
    const reels = JSON.parse(readFileSync(join(p.found.folder, "reels.json"), "utf8"));
    rmSync(join(p.found.folder, "reels.json"));
    writeFile(join(p.found.folder, "reels.json"), JSON.stringify({ ...reels, version: 2 }));
    const r = await askedBoth(p);
    const why = "The list of Reel candidates cannot be read: it was written by a newer brimm-video. Ask Jason to update this Mac.";
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("refuses while Dropbox is still bringing the video over, and starts bringing it", async () => {
    const p = askable();
    p.t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await askedBoth(p);
    const why = 'Dropbox is still bringing Pricing talk.mp4 over to this Mac. Say "ask Claude again for Reels" again when it is done.';
    assert.deepEqual([r.quick, r.now, r.claude, r.kept, r.rev], [1, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(p.t.started.map(([, args]) => args.slice(-4)), [["bring", "--now", FOLDER, "Pricing talk.mp4"]]);
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("refuses while the import is still at work on the episode, its late check to come", async () => {
    const p = askable();
    writeStatus(p.t.root, { version: 1, machine: "Mac Studio", pid: 4242, import: "k3x9", video: "Pricing talk.mp4", bytes: p.found.record.video.bytes, seconds: 23.423, step: "Waiting for the late check", at: new Date(p.t.now()).toISOString() }, writeFile);
    const r = await askedBoth(p);
    const why = 'The import of this episode has not finished on Mac Studio yet: it is at "Waiting for the late check". Say it again when it has.';
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("is not held by another video's import", async () => {
    const p = askable();
    const status = { version: 1, machine: "Mac Studio", pid: 4242, import: "k3x9", seconds: 23.423, step: "Waiting for the late check" };
    writeStatus(p.t.root, { ...status, video: "Another talk.mp4", bytes: 9, at: new Date(p.t.now()).toISOString() }, writeFile);
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 0);
    p.t.done();
  });
  it("refuses while an import that stopped has its late check still to make, which would put its own files back (PR 19's review)", async () => {
    const p = askable();
    writeStatus(p.t.root, { version: 1, machine: "Laptop", pid: 4242, import: "k3x9", seconds: 23.423, step: "Waiting for the late check", video: "Pricing talk.mp4", bytes: p.found.record.video.bytes, at: new Date(p.t.now() - 11 * 60 * 1000).toISOString() }, writeFile);
    const r = await askedBoth(p);
    const why = 'The import of this episode stopped on Laptop before its late check was made. On Laptop, say "try it again" for Pricing talk.mp4, then say this again.';
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("refuses while this Mac has the late check of the episode's import still to make, its status gone", async () => {
    const p = askable();
    writePending(p.t.home, { version: 1, id: p.found.record.id, name: FOLDER, folder: p.found.folder, video: "Pricing talk.mp4", bytes: p.found.record.video.bytes, seconds: 23.423, drop: "/nowhere/Pricing talk.mp4", work: "/nowhere", entries: [], lastCopy: p.t.now() - 20 * 60 * 1000, root: p.t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    const r = await askedBoth(p);
    const why = 'This Mac has still to make the late check of this episode\'s import. Say "try it again" for Pricing talk.mp4 to have it made now, then say this again.';
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  /** A late check this Mac owes of the episode's import, as the import keeps it, with `more` laid over it. */
  const owe = (p, more = {}) => writePending(p.t.home, { version: 1, id: p.found.record.id, name: FOLDER, folder: p.found.folder, video: "Pricing talk.mp4", bytes: p.found.record.video.bytes, seconds: 23.423, drop: "/nowhere/Pricing talk.mp4", work: "/nowhere", entries: [], lastCopy: p.t.now() - 20 * 60 * 1000, root: p.t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt", ...more });
  const importing = (p, more = {}, minutesAgo = 1) => writeStatus(p.t.root, { version: 1, machine: "Mac Studio", pid: 4242, import: "k3x9", seconds: 23.423, step: "Waiting for its late check", video: "Pricing talk.mp4", bytes: p.found.record.video.bytes, at: new Date(p.t.now() - minutesAgo * 60 * 1000).toISOString(), ...more }, writeFile);
  it("says the import is at work, on the Mac that imports, while it waits for its own late check (PR 19's re-review, N13)", async () => {
    const p = askable();
    owe(p);
    importing(p);
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.match(p.t.said(), /The import of this episode has not finished on Mac Studio yet: it is at "Waiting for its late check"\. Say it again when it has\./);
    p.t.done();
  });
  it("says what the late check found, and how to have it made again, when it found a problem (N21)", async () => {
    const p = askable();
    owe(p, { problem: "reels.json is not whole." });
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.ok(p.t.said().includes('The late check of this episode\'s import found a problem: reels.json is not whole. Once it is put right, say "try it again" for Pricing talk.mp4 on Mac Studio, then say this again.'), p.t.said());
    const status = askable();
    importing(status, { problem: "reels.json is not whole." });
    assert.equal(await editMain(["ask", "Pricing"], status.t.ctx.deps), 1);
    assert.ok(status.t.said().includes('The late check of this episode\'s import found a problem: reels.json is not whole. Once it is put right, say "try it again" for Pricing talk.mp4 on Mac Studio, then say this again.'), status.t.said());
    p.t.done();
    status.t.done();
  });
  it("says when the late check is due, while it is not due yet, and not that it can be made now (PR 19's check of dfe3aab, D8, D12)", async () => {
    const p = askable();
    const lastCopy = p.t.now() - 5 * 60 * 1000;
    owe(p, { lastCopy });
    const due = new Date(lastCopy + 15 * 60 * 1000);
    const at = `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    // No import of the video is at work here, so none will make it unless told to (PR 19's check of 0ab7850, E7, E14).
    assert.ok(p.t.said().includes(`This Mac has still to make the late check of this episode's import, due at ${at}. Say "try it again" for Pricing talk.mp4 to have it made then, then say this again.`), p.t.said());
    p.t.done();
  });
  it("is not held by a late check kept under another name of this Mac, which its import never makes (N22)", async () => {
    const p = askable();
    owe(p, { machine: "Studio" });
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 0, p.t.said());
    p.t.done();
  });
  it("still says it made the Reel when the put went in and only its late check found a problem", async () => {
    const p = askable();
    const at = join(p.found.folder, "reels.json");
    // Dropbox takes reels.json away during the wait, and it cannot be copied in again.
    let broken = false;
    p.t.ctx.deps.clone = ((clone) => (from, to) => {
      if (broken) throw new Error("the clone could not be made");
      clone(from, to);
    })(p.t.ctx.deps.clone);
    p.t.ctx.deps.wait = ((wait) => async (ms) => {
      if (ms === 15 * 60 * 1000) {
        rmSync(at);
        broken = true;
      }
      return wait(ms);
    })(p.t.ctx.deps.wait);
    assert.equal(await editMain(["ask", "--now", FOLDER], p.t.ctx.deps), 1);
    const result = readResult(p.t.home, FOLDER, "ask");
    assert.deepEqual(result.made, ["Reel 3"]);
    assert.ok(result.failed.some((f) => /reels\.json/.test(f)), result.failed.join(" | "));
    assert.equal(reread(p.found).rev, 2);
    p.t.done();
  });
  it("refuses while another command is at work on the episode", async () => {
    const p = askable();
    makeDir(join(p.t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFile(lockOf(p.t.home, FOLDER), JSON.stringify({ pid: 4242, command: "push", nonce: "x" }));
    p.t.ctx.deps.alive = () => true;
    assert.equal(await editMain(["ask", "Pricing"], p.t.ctx.deps), 1);
    assert.match(p.t.said(), /push is running for 2026-10-14 Pricing talk \(Mac Studio\) already\. Say it again when it has finished\./);
    assert.equal(p.t.started.length, 0);
    p.t.done();
  });
  it("refuses an episode whose import went by the rules alone, as its list says", async () => {
    const p = askable();
    rmSync(join(p.found.folder, "reels.json"));
    writeFile(join(p.found.folder, "reels.json"), JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates: [], none: "Claude was not asked", cannotAsk: "the import on Mac Studio is set to go by the rules alone", rulesOnly: true }), null, 2) + "\n");
    const r = await askedBoth(p);
    const why = "Claude cannot be asked for Reels: the import on Mac Studio is set to go by the rules alone.";
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("refuses an episode with no cut plan", async () => {
    const p = askable();
    rmSync(join(p.found.folder, "Pricing talk.cut-plan.json"));
    const r = await askedBoth(p);
    const why = "Pricing talk.mp4 has no cut plan here, so Claude cannot be asked.";
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
  it("refuses an episode Dropbox took this Mac's last change away from", async () => {
    const p = askable();
    acceptRev(p.t.home, p.found.record.id, 2);
    const r = await askedBoth(p);
    const why = `Dropbox undid this Mac's last change to ${NAME}. Say it again.`;
    assert.deepEqual([r.quick, r.started, r.now, r.claude, r.kept, r.rev], [1, 0, 1, 0, true, 1]);
    assert.ok(p.t.said().includes(why), p.t.said());
    assert.deepEqual(r.failed, [why]);
    p.t.done();
  });
});
