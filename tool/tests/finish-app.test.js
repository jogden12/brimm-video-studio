// finish from HyperFrames' exports, the detached part (plan PR 7, groups E1 to E7; architecture 2026-10-27, section 8): it waits for each export
// to be whole, brings a Dropbox placeholder over, checks the files, transcribes them again, cuts the Story parts, copies everything into the
// episode's final/ by the Dropbox rule with the hand-off last, writes the record, shows the hand-off, and after the late check removes from
// Downloads what it took from there and nothing else. It runs in the made-up world of exports-world.js (finish.test.js's, with a project on
// disk for each part and a Downloads folder in the test's own home), with stand-ins for ffprobe, ffmpeg, the transcriber and open.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { recordFile } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { PIN } from "../hyperframes.js";
import { tidyTranscript } from "../shared/transcript.js";
import { EDITED, ID, PROJECT, SRT, partOf, reread } from "./episodes.js";
import { EPISODE } from "./phase4.js";
import { MAIN, MAIN_WORDS, REEL1, REEL2, entry, exportOf, fw, named, probeFor, whisper } from "./exports-world.js";

const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const stem = (file) => file.replace(/\.[^.]+$/, "");
const MAIN_FILE = named(MAIN, "13.56");
const REEL1_FILE = named(REEL1, "14.00");
const REEL_FILE = named(REEL2, "14.03");
const withTexts = (file) => [file, ...["srt", "transcript.txt", "words.json"].map((ending) => `${stem(file)}.${ending}`)];
/** What final/ holds after the made-up episode is finished from the main video's export and Reel 2's. */
const FINAL = [HANDOFF, ...withTexts(MAIN_FILE), ...withTexts(REEL_FILE), `${stem(REEL_FILE)}.story-1.mp4`, `${stem(REEL_FILE)}.story-2.mp4`].sort();
const RAW_FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-raw.json", import.meta.url), "utf8"));
const NOT_AN_APP_WORD = /Final Cut|Share|From Final Cut|Delete Generated/;

/** The same record with Reel 1 made too, from times she gave, and both Reels picked. */
const THREE = () => ({
  app: { toolchain: PIN.version, projects: [entry("main"), entry("reel 1", { fromSuggestion: null }), entry("reel 2")] },
  reels: [{ ...EPISODE.record.reels[0], status: "picked" }, EPISODE.record.reels[1]]
});

/** finish asked with a yes: the episode as it is then, with the quick part's claim. */
async function asked(w, answers = {}) {
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, ...answers }), 0, w.t.said());
  return { ...w.found, record: reread(w.found) };
}
/** Have `then` run while the finish waits for its late check, 15 minutes after its last copy. */
const whileLate = (t, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (ms) => {
    if (ms === LATE_CHECK_MS) then();
    return wait(ms);
  };
};
/** A file made again: other bytes, a later time. */
const madeAgain = (w, path, text = "an export made again") => {
  writeFileSync(path, text);
  const when = new Date(w.t.now() + 60000);
  utimesSync(path, when, when);
};
/** Why a finish failed: what it said, without the line that says it let go the claim its quick part took. */
const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
const handoffOf = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
const finished = async (w, answers = {}) => {
  const found = await asked(w, answers);
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { found, result };
};

describe("E1. finish from HyperFrames' exports: what final/ holds, and the hand-off", () => {
  it("copies each export, its transcripts, the Story parts of a Reel over a minute and the hand-off last, as clones, with no Final Cut export", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    let during = null;
    whileLate(w.t, () => {
      during = readdirSync(w.downloads).sort();
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(w.t.inFinal(found), FINAL);
    assert.deepEqual(during, [MAIN_FILE, REEL_FILE].sort(), "the originals are in Downloads until the late check");
    const cloned = new Set(w.t.clones.map(([, to]) => to));
    for (const file of FINAL) assert.ok(cloned.has(join(found.folder, "final", file)), file);
    const intoFinal = w.t.clones.map(([, to]) => to).filter((to) => to.startsWith(`${join(found.folder, "final")}/`));
    assert.equal(intoFinal.at(-1), join(found.folder, "final", HANDOFF), "the hand-off goes in last");
    assert.deepEqual(w.t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args), [["-R", join(found.folder, "final", HANDOFF)]]);
    assert.deepEqual(w.t.calls.filter((c) => c.cmd === "FFMPEG" && /\.story-\d+\.mp4$/.test(c.args.at(-1))).map((c) => c.args[c.args.indexOf("-i") + 1].endsWith(REEL_FILE)), [true, true]);
    w.t.done();
  });
  it("writes a version 2 hand-off of a raw video: it passes the contract's check, the page can read its captions, and its keys are the raw fixture's, in order", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE() });
    exportOf(w, "main");
    exportOf(w, "reel 1");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([handoff.version, handoff.revision, handoff.video.id, handoff.video.kind], [2, 1, ID, "raw"]);
    // Its keys are the raw fixture's, in order, but for `suggestions`, which are written when a suggestion falls in the main video (plan PR 8's
    // groups E and F); `main.onPicture` is the words on the main video's picture.
    assert.deepEqual(Object.keys(handoff), Object.keys(RAW_FIXTURE).filter((key) => key !== "suggestions"));
    assert.deepEqual(Object.keys(handoff.video), Object.keys(RAW_FIXTURE.video));
    assert.deepEqual(Object.keys(handoff.main), Object.keys(RAW_FIXTURE.main));
    for (const reel of handoff.reels) assert.deepEqual(Object.keys(reel).filter((key) => key !== "inMain"), Object.keys(RAW_FIXTURE.reels[0]));
    for (const srt of [handoff.main.srt, ...handoff.reels.map((r) => r.srt)]) assert.match(tidyTranscript(srt), /^\[0:00\] /);
    w.t.done();
  });
  it("takes main.file from the main export, each Reel's file from its export, and each Reel's fromSuggestion from its project: a number, or null for times she gave", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE() });
    exportOf(w, "main");
    exportOf(w, "reel 1");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.deepEqual([handoff.main.file, handoff.main.seconds], [MAIN_FILE, 11.878]);
    assert.deepEqual(handoff.reels.map((r) => [r.n, r.title, r.file, r.seconds, r.fromSuggestion]), [[1, "The opening", REEL1_FILE, 7.7, null], [2, "Know your costs", REEL_FILE, 75, 2]]);
    w.t.done();
  });
  it("finds a Reel that falls in the main video (inMain), and none for a Reel whose words are not in it; it holds no suggestions, though the words on the picture", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE(), captions: { "reel 2": SRT["reel 2"] } });
    exportOf(w, "main");
    exportOf(w, "reel 1");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.deepEqual(handoff.reels[0].inMain, { start: 4.1, end: 11.8 });
    assert.equal("inMain" in handoff.reels[1], false);
    assert.deepEqual(["suggestions" in handoff, handoff.main.onPicture], [false, MAIN_WORDS]);
    w.t.done();
  });
  // Review I1: the titles drawn in Final Cut (`record.main.texts`) are not the words on a HyperFrames export's picture: those are read out of the
  // project (plan PR 8).
  const TITLED = { preset: null, cuts: [], texts: [{ id: "t1", kind: "lower-third", lines: ["Three pricing mistakes"], at: 3, for: 5 }], graphics: [], logo: false, base: null, pushed: [] };
  it("hands off the words on the picture of a main video taken from HyperFrames, and not the titles the record holds that were drawn in Final Cut", async () => {
    const w = fw({ over: { main: TITLED } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(handoff.main.onPicture, MAIN_WORDS);
    assert.deepEqual(reread(found).main.texts, TITLED.texts, "the record keeps the titles all the same");
    w.t.done();
  });
  it("keeps the titles of a main video that went the Final Cut way beside a Reel from HyperFrames", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = fw({ projects: ["reel 2"], over: { main: { ...EDITED.main, texts: TITLED.texts, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    assert.deepEqual(handoffOf(found).main.onPicture, ["Three pricing mistakes"]);
    w.t.done();
  });
  it("leaves the original exports in Downloads untouched while it works, and touches nothing else there", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    exportOf(w, "reel 2");
    writeFileSync(join(w.downloads, "a letter.pdf"), "not an export");
    const before = statSync(main.path);
    const found = await asked(w);
    const writes = [];
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      writes.push(to);
      return clone(from, to);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(writes.every((to) => !to.startsWith(w.downloads)), "nothing is written into Downloads");
    assert.deepEqual(readdirSync(w.downloads), ["a letter.pdf"]);
    assert.equal(before.size > 0, true);
    w.t.done();
  });
});

describe("E2. the record of a finish from HyperFrames' exports", () => {
  it("lists each part's file, facts, source and project, with neither an export nor 'no hand edits', and marks each project taken finished", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE() });
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const sizes = { main: statSync(main.path), reel: statSync(reel.path) };
    const { found } = await finished(w, { without: ["reel 1"] });
    const record = reread(found);
    assert.equal(record.finished.revision, 1);
    assert.deepEqual(Object.keys(record.finished.parts), ["main", "reel 2"]);
    const part = record.finished.parts.main;
    assert.deepEqual(Object.keys(part).sort(), ["bytes", "file", "onPicture", "project", "seconds", "source", "words"]);
    assert.deepEqual([part.file, part.project, part.seconds, part.bytes], [`final/${MAIN_FILE}`, MAIN, 11.878, sizes.main.size]);
    assert.deepEqual(part.source, { bytes: sizes.main.size, mtimeMs: sizes.main.mtimeMs });
    assert.equal(part.words, `final/${stem(MAIN_FILE)}.words.json`);
    const reelPart = record.finished.parts["reel 2"];
    assert.deepEqual(Object.keys(reelPart).sort(), ["bytes", "file", "project", "seconds", "source", "story", "words"]);
    assert.deepEqual([reelPart.file, reelPart.project, reelPart.seconds, reelPart.story], [`final/${REEL_FILE}`, REEL2, 75, [`final/${stem(REEL_FILE)}.story-1.mp4`, `final/${stem(REEL_FILE)}.story-2.mp4`]]);
    assert.equal("v" in part || "export" in part || "noHandEdits" in part, false);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["main", "finished"], ["reel 1", "opened"], ["reel 2", "finished"]]);
    w.t.done();
  });
  it("marks each Reel taken finished with its final, leaves the others as they were, and lists every file of final/", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE() });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w, { without: ["reel 1"] });
    const record = reread(found);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status]), [[1, "picked"], [2, "finished"]]);
    assert.deepEqual(record.reels[1].final, { file: `final/${REEL_FILE}`, seconds: 75 });
    for (const file of FINAL) assert.equal(record.files[`final/${file}`], statSync(join(found.folder, "final", file)).size, file);
    w.t.done();
  });
  it("lets the claim go, and writes the record last with the revision it was asked at", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    assert.equal(reread(w.found).editing.by, "Mac Studio");
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const record = reread(found);
    assert.ok(!record.editing);
    assert.equal(record.rev, found.record.rev + 1);
    assert.equal(existsSync(recordFile(found.folder, found.record.rev + 1)), true);
    w.t.done();
  });
  it("names the hand-off in the record, as the revision handoffTarget gave it", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const record = reread(found);
    assert.deepEqual([record.finished.handoff, record.finished.on, record.finished.revision, handoffOf(found).revision], [`final/${HANDOFF}`, "Mac Studio", 1, 1]);
    w.t.done();
  });
  // Review, minor 5: a Reel the last finish took from Final Cut, which this finish keeps (she left it out), is not taken from its project: the
  // project is not finished, since the Reel in the hand-off is still the one from Final Cut.
  const FROM_FINAL_CUT = () => ({
    finished: { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: `final/${HANDOFF}`, parts: { "reel 2": { v: 1, file: "final/Reel two from Final Cut.mov", bytes: 5, seconds: 75, source: { bytes: 5, mtimeMs: 1 }, export: "final/Reel two from Final Cut.fcpxmld" } } },
    reels: [EPISODE.record.reels[0], { ...EPISODE.record.reels[1], status: "finished", final: { file: "final/Reel two from Final Cut.mov", seconds: 75 } }]
  });
  it("does not mark finished the project of a Reel that this finish keeps as the last one took it from Final Cut", async () => {
    const w = fw({ over: FROM_FINAL_CUT() });
    mkdirSync(join(w.found.folder, "final"), { recursive: true });
    writeFileSync(join(w.found.folder, "final", "Reel two from Final Cut.srt"), SRT["reel 2"]);
    exportOf(w, "main");
    const { found } = await finished(w, { without: ["reel 2"] });
    const record = reread(found);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["main", "finished"], ["reel 2", "opened"]]);
    assert.deepEqual([record.finished.parts["reel 2"].export, "project" in record.finished.parts["reel 2"]], ["final/Reel two from Final Cut.fcpxmld", false]);
    assert.equal(handoffOf(found).reels[0].file, "Reel two from Final Cut.mov");
    w.t.done();
  });
});

describe("E3. it waits", () => {
  it("looks again at an export whose size grows, and goes on when it settles", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const was = statSync(main.path).size;
    let grows = 3;
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      if (grows-- > 0) w.t.grow(main.path, 1000);
      return wait(ms);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(statSync(join(found.folder, "final", MAIN_FILE)).size, was + 3000);
    w.t.done();
  });
  it("stops after ten minutes of an export still being written, in plain words, and copies and transcribes nothing", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      w.t.grow(main.path, 1000);
      return wait(ms);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MAIN_FILE} is still being written. Say "hand it off" again when HyperFrames has finished exporting it.`]);
    assert.deepEqual(w.t.inFinal(found), []);
    assert.deepEqual(w.t.calls.filter((c) => c.cmd === "WHISPER"), []);
    assert.ok(!reread(found).editing, "the claim the quick part took is let go");
    w.t.done();
  });
  it("says the same of an export ffprobe cannot read, that is, one with no length", async () => {
    const w = fw({ programs: { FFPROBE: (args) => (args.at(-1).includes(MAIN) ? { code: 1, stderr: "moov atom not found\n" } : probeFor()(args)) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.equal(result.failed[0], `${MAIN_FILE} is still being written. Say "hand it off" again when HyperFrames has finished exporting it.`);
    w.t.done();
  });
  it("brings an export over that Dropbox holds only as a placeholder, reading it through once, and goes on when it is whole", async () => {
    const w = fw();
    exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    const brought = [];
    w.t.ctx.isWhole = (path) => path !== reel.path || brought.includes(path);
    w.t.ctx.deps.readAll = async (path) => {
      brought.push(path);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(brought, [reel.path]);
    assert.equal(existsSync(join(found.folder, "final", REEL_FILE)), true);
    w.t.done();
  });
  it("says why when Dropbox could not bring it over, naming the file, and copies nothing", async () => {
    const w = fw();
    exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    w.t.ctx.isWhole = (path) => path !== reel.path;
    w.t.ctx.deps.readAll = async () => {
      throw new Error("Dropbox sent nothing of it for 5 minutes, so it was given up");
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`Dropbox could not bring ${REEL_FILE} over to this Mac (Dropbox sent nothing of it for 5 minutes, so it was given up). Say "hand it off" again.`]);
    assert.deepEqual(w.t.inFinal(found), []);
    w.t.done();
  });
  it("reads a placeholder through once, and waits ten minutes if it still is not whole", async () => {
    const w = fw();
    exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    let reads = 0;
    w.t.ctx.isWhole = (path) => path !== reel.path;
    w.t.ctx.deps.readAll = async () => {
      reads += 1;
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.equal(reads, 1);
    assert.equal(result.failed[0], `${REEL_FILE} is still being written. Say "hand it off" again when HyperFrames has finished exporting it.`);
    w.t.done();
  });
});

describe("E4. the checks", () => {
  it("stops a Reel that is not upright, naming the file, and writes no hand-off", async () => {
    const w = fw({ programs: { FFPROBE: probeFor((file) => (file.includes("reel 2") ? { picture: { width: 1920, height: 1080, color_primaries: "bt709", color_transfer: "bt709" } } : {})) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${REEL_FILE} is wider than it is tall, and a Reel is upright.`]);
    assert.equal(existsSync(join(found.folder, "final", HANDOFF)), false);
    assert.equal(reread(found).finished, null);
    assert.ok(!reread(found).editing);
    w.t.done();
  });
  it("stops a main video of another shape than the raw video's", async () => {
    const w = fw({ programs: { FFPROBE: probeFor((file) => (file.includes("main") ? { picture: { width: 1080, height: 1920, color_primaries: "bt709", color_transfer: "bt709" } } : {})) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MAIN_FILE} is upright, and the main video has the raw video's shape: wider than it is tall.`]);
    w.t.done();
  });
  it("stops an export with no sound, and says how to get it", async () => {
    const w = fw({ programs: { FFPROBE: probeFor((file) => (file.includes("reel 2") ? { sound: null } : {})) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${REEL_FILE} has no sound. Export it again from HyperFrames with its sound.`]);
    assert.deepEqual(w.t.inFinal(found), []);
    assert.deepEqual(w.t.calls.filter((c) => c.cmd === "WHISPER"), []);
    w.t.done();
  });
  it("names every export that fails, not only the first", async () => {
    const w = fw({ programs: { FFPROBE: probeFor(() => ({ sound: null })) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.deepEqual(reasons(result), [`${MAIN_FILE} has no sound. Export it again from HyperFrames with its sound.`, `${REEL_FILE} has no sound. Export it again from HyperFrames with its sound.`]);
    w.t.done();
  });
  it("says nothing of BT.709, mentions a file with no colour tags and goes on, and names HDR colour for a person to check", async () => {
    const tags = { none: { picture: { width: 1280, height: 720 } }, hdr: { picture: { width: 1280, height: 720, color_primaries: "bt2020", color_transfer: "arib-std-b67" } } };
    for (const [which, expected] of [["standard", null], ["none", `${MAIN_FILE} has no colour tags: check by eye that its colours look right.`], ["hdr", `${MAIN_FILE} is tagged as HDR colour, which most players show washed out: check it by eye, and export it again in standard colour if it looks wrong.`]]) {
      const w = fw({ programs: { FFPROBE: probeFor((file) => (file.includes("main") && tags[which] ? tags[which] : {})) } });
      exportOf(w, "main");
      exportOf(w, "reel 2");
      const { result } = await finished(w);
      if (expected) assert.ok(result.next.includes(expected), `${which}: ${result.next}`);
      else assert.doesNotMatch(result.next, /colour/, which);
      w.t.done();
    }
  });
  it("checks a Reel made from a suggestion against the suggestion's first words, names a mismatch for her to look at, and stops nothing", async () => {
    const w = fw({ captions: { "reel 2": SRT["reel 2"] } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { result } = await finished(w);
    assert.ok(result.next.includes('Reel 2 starts with "Welcome to the show. Today we are... Let me do that again.", where "So the first thing you need to do is know your costs." was expected: check by eye that it is the right video.'), result.next);
    w.t.done();
  });
  it("does not check the main video's first words, which she may start anywhere, nor a Reel made from times she gave", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE(), captions: { main: SRT["reel 2"], "reel 1": SRT["reel 2"] } });
    exportOf(w, "main");
    exportOf(w, "reel 1");
    exportOf(w, "reel 2");
    const { result } = await finished(w);
    assert.doesNotMatch(result.next, /starts with/);
    w.t.done();
  });
  it("says a Reel starts as expected when the first words match, and nothing about it", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { result } = await finished(w);
    assert.doesNotMatch(result.next, /starts with|where .* was expected/);
    w.t.done();
  });
});

describe("E5. spellings, and a file that changes", () => {
  it("transcribes each export with the record's spellings, in its captions and in its word times", async () => {
    const w = fw({ over: { spellings: [["Sallie", "Sally"]] } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const handoff = handoffOf(found);
    assert.match(handoff.main.srt, /Thank you so much, Sally\./);
    assert.match(handoff.reels[0].srt, /Thank you so much, Sally\./);
    const words = JSON.parse(readFileSync(join(found.folder, "final", `${stem(MAIN_FILE)}.words.json`), "utf8"));
    assert.ok(words.words.some((x) => x.w.startsWith("Sally")), "the word times are spelled too");
    assert.ok(!words.words.some((x) => x.w.startsWith("Sallie")));
    w.t.done();
  });
  it("stops before it copies anything when an export changed in Downloads while it was being transcribed, naming the file and the folder", async () => {
    let changed = false;
    let w = null;
    let main = null;
    w = fw({ programs: { WHISPER: (args) => {
      if (!changed) {
        changed = true;
        madeAgain(w, main.path);
      }
      return whisper()(args);
    } } });
    main = exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${MAIN_FILE} changed in Downloads while finish was working on it. Say "hand it off" again.`]);
    assert.deepEqual(w.t.inFinal(found), []);
    assert.deepEqual(readdirSync(w.downloads).sort(), [MAIN_FILE, REEL_FILE].sort(), "nothing is removed from Downloads");
    w.t.done();
  });
  it("copies nothing into final/ and leaves the record alone when the other Mac takes the episode over while it works", async () => {
    let wrote = false;
    let w = null;
    let found = null;
    w = fw({ programs: { WHISPER: (args) => {
      if (!wrote && found) {
        wrote = true;
        writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
      }
      return whisper()(args);
    } } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    found = await asked(w);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /The episode changed while finish was working, so nothing was copied into final\/\./);
    assert.ok(!existsSync(join(found.folder, "final")));
    assert.deepEqual(readdirSync(w.downloads).sort(), [MAIN_FILE, REEL_FILE].sort());
    w.t.done();
  });
  // Review, minor 7: what to say again is the way of the parts taken now, not of a Reel kept from Final Cut beside them.
  it("says to hand it off again, and not to finish again, when a Reel the last finish took from Final Cut is kept beside the exports taken", async () => {
    let wrote = false;
    let w = null;
    let found = null;
    const finishedBefore = { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: `final/${HANDOFF}`, parts: { "reel 1": { v: 1, file: "final/Reel one from Final Cut.mov", bytes: 5, seconds: 7.7, source: { bytes: 5, mtimeMs: 1 }, export: "final/Reel one from Final Cut.fcpxmld" } } };
    w = fw({ projects: ["main"], over: { finished: finishedBefore, reels: [{ ...EPISODE.record.reels[0], status: "finished", final: { file: "final/Reel one from Final Cut.mov", seconds: 7.7 } }, EPISODE.record.reels[1]] }, programs: { WHISPER: (args) => {
      if (!wrote && found) {
        wrote = true;
        writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
      }
      return whisper()(args);
    } } });
    mkdirSync(join(w.found.folder, "final"), { recursive: true });
    writeFileSync(join(w.found.folder, "final", "Reel one from Final Cut.srt"), SRT["reel 1"]);
    exportOf(w, "main");
    found = await asked(w);
    assert.deepEqual(found.record && w.asked().parts.map((p) => [p.key, p.kept, Boolean(p.project)]), [["main", false, true], ["reel 1", true, false]]);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /The episode changed while finish was working, so nothing was copied into final\/\. Say "hand it off" again\./);
    w.t.done();
  });
  it("refuses to start when the episode changed since finish was asked", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed[0], /The episode changed since finish was asked\./);
    assert.deepEqual(w.t.inFinal(found), []);
    w.t.done();
  });
});

describe("E6. the late check, and what is removed from Downloads", () => {
  it("waits at least the late check after the last copy, then removes from Downloads exactly what it took, and nothing else there", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const older = exportOf(w, "main", { start: [13, 50, 0], record: false });
    writeFileSync(join(w.downloads, "a letter.pdf"), "not an export");
    const another = exportOf(w, "main", { name: "Some other project 2026-10-20 13.58.mp4", record: false });
    const { found } = await finished(w);
    assert.ok(w.t.waits.reduce((sum, ms) => sum + ms, 0) >= LATE_CHECK_MS);
    assert.deepEqual(readdirSync(w.downloads).sort(), ["a letter.pdf", older.name, another.name].sort());
    assert.equal(existsSync(join(found.folder, "final", MAIN_FILE)), true);
    w.t.done();
  });
  it("puts a copy that went missing back from what it took, never from a file made again since, before it removes anything", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    const copied = join(found.folder, "final", MAIN_FILE);
    whileLate(w.t, () => {
      rmSync(copied);
      madeAgain(w, main.path);
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(readFileSync(copied, "utf8"), "the export of main");
    assert.equal(readFileSync(main.path, "utf8"), "an export made again", "the file made again is kept");
    assert.match(result.next, new RegExp(`${MAIN_FILE.replace(/[.]/g, "\\.")} changed in Downloads after it was taken, so it is kept there\\.`));
    w.t.done();
  });
  it("keeps a file changed after it was taken, and says so, and removes the other", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    whileLate(w.t, () => madeAgain(w, reel.path));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(existsSync(main.path), false);
    assert.equal(existsSync(reel.path), true);
    assert.ok(result.next.includes(`${REEL_FILE} changed in Downloads after it was taken, so it is kept there.`), result.next);
    w.t.done();
  });
  it("never removes a file it took from another folder, from what the other Mac released, or from the project's own renders", async () => {
    const w = fw({ projects: ["main", "reel 1", "reel 2"], over: THREE() });
    const elsewhere = join(w.t.home, "Movies", "exports");
    const main = exportOf(w, "main", { folder: elsewhere });
    const reel = exportOf(w, "reel 2", { folder: join(w.found.folder, "edit", "from-hyperframes"), record: false });
    const renders = join(w.dirOf("reel 1"), "renders", "Pricing_2026-10-20_14-00-30.mp4");
    writeFileSync(renders, "a render");
    utimesSync(renders, new Date(+w.t.now() - 3600000), new Date(+w.t.now() - 3600000));
    const found = await asked(w, { take: { "reel 1": "Pricing_2026-10-20_14-00-30.mp4" } });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([existsSync(main.path), existsSync(reel.path), existsSync(renders)], [true, true, true]);
    assert.equal(existsSync(join(found.folder, "final", MAIN_FILE)), true);
    assert.equal(existsSync(join(found.folder, "final", REEL_FILE)), true);
    w.t.done();
  });
  // Review, minor 6: what finish.asked.json says of where a file came from is not taken on trust when a file is removed: it must be in the
  // Downloads folder of this Mac.
  it("removes nothing from a folder that is not this Mac's Downloads, though what it was told says the file came from there", async () => {
    const w = fw();
    const main = exportOf(w, "main", { folder: join(w.t.home, "Movies", "exports") });
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    const told = w.asked();
    assert.equal(told.parts[0].video.where, "another folder");
    told.parts[0].video.where = "Downloads";
    writeFileSync(join(w.work, "finish.asked.json"), JSON.stringify(told));
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([existsSync(main.path), existsSync(reel.path)], [true, false]);
    w.t.done();
  });
  it("leaves in Downloads a file a person named, or a record named, under a name that is no export's", async () => {
    const w = fw();
    const named_ = exportOf(w, "main", { name: "final.mp4", record: false });
    const recorded = exportOf(w, "reel 2", { name: "reel two final.mp4" });
    const found = await asked(w, { take: { main: "final.mp4" } });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([existsSync(named_.path), existsSync(recorded.path)], [true, true]);
    assert.equal(existsSync(join(found.folder, "final", "final.mp4")), true);
    assert.equal(existsSync(join(found.folder, "final", "reel two final.mp4")), true);
    w.t.done();
  });
  it("keeps every original when a copy in final/ is not whole at the late check, and says so", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    const result = await finishNow(w.t.ctx, found, { lateCheck: () => [`${MAIN_FILE} is not whole in final (it is missing).`] });
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /is not whole in final/);
    assert.ok(result.next.includes("The exports it took from Downloads are kept there, because a copy in final/ was not whole at the late check."), result.next);
    assert.deepEqual([existsSync(main.path), existsSync(reel.path)], [true, true]);
    w.t.done();
  });
  it("does not remove them, either, when the record no longer holds this finish", async () => {
    const w = fw();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    const ours = recordFile(found.folder, found.record.rev + 1);
    const theirs = JSON.stringify({ ...found.record, rev: found.record.rev + 1, title: { text: "Their title", from: "person", approved: true } });
    whileLate(w.t, () => {
      rmSync(ours);
      writeFileSync(ours, theirs);
    });
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /The episode's record no longer holds this finish/);
    assert.deepEqual([existsSync(main.path), existsSync(reel.path)], [true, true]);
    w.t.done();
  });
});

describe("E7. again, and the run", () => {
  it("keeps every part on a second finish with no new export, and writes the next revision under the same id", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const first = handoffOf(found);
    w.t.calls.length = 0;
    w.t.clones.length = 0;
    const again = { ...found, record: reread(found) };
    assert.equal(await finishEpisode(w.t.ctx, again, {}), 0);
    assert.deepEqual(w.t.said().split("\n").slice(-3), ["The main video: kept as the last finish made it.", "Reel 2: kept as the last finish made it.", 'Say "yes, hand it off" to start.']);
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0);
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(w.t.calls.filter((c) => c.cmd === "WHISPER"), [], "nothing is transcribed again");
    const second = handoffOf(found);
    assert.deepEqual([second.revision, second.video.id, second.main.srt, second.main.file], [2, first.video.id, first.main.srt, first.main.file]);
    assert.equal(reread(found).finished.revision, 2);
    assert.deepEqual(Object.keys(reread(found).finished.parts), ["main", "reel 2"]);
    w.t.done();
  });
  // Review I2: she exports at 13:10, edits, exports at 13:56 and hands off. The 13:56 file is taken and removed; the 13:10 file is not
  // taken and stays in Downloads, and must not stand in the way of a second hand-off, nor be handed off in place of the good one.
  it("keeps a part on a second finish though an earlier export of it is left in Downloads, and an answer that it is final does not hand that one off", async () => {
    const w = fw();
    const earlier = exportOf(w, "main", { start: [13, 10, 0] });
    exportOf(w, "main", { start: [13, 56, 40] });
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    assert.deepEqual(readdirSync(w.downloads), [earlier.name], "only the export finish took was removed");
    const first = handoffOf(found);
    const had = w.t.said().split("\n").length;
    const again = { ...found, record: reread(found) };
    assert.equal(await finishEpisode(w.t.ctx, again, {}), 0);
    assert.deepEqual(w.t.said().split("\n").slice(had), ["The main video: kept as the last finish made it.", "Reel 2: kept as the last finish made it.", 'Say "yes, hand it off" to start.']);
    assert.equal(await finishEpisode(w.t.ctx, again, { final: ["main"], yes: true }), 0);
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    const second = handoffOf(found);
    assert.deepEqual([second.revision, second.main.file, second.main.srt], [2, first.main.file, first.main.srt]);
    assert.equal(first.main.file, MAIN_FILE);
    assert.deepEqual(readdirSync(w.downloads), [earlier.name], "and the earlier export is not touched");
    w.t.done();
  });
  it("makes only the main video again for a new export of it, keeps the Reel, and leaves the earlier export in final/, listed", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const first = handoffOf(found);
    w.t.calls.length = 0;
    const newer = exportOf(w, "main", { start: [14, 30, 0] });
    const again = { ...found, record: reread(found) };
    // The first finish used up what it was shown: the main video's words are shown again for the new export, and her yes is to them.
    const started = w.t.started.length;
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(w.t.started.length, started, "that yes started nothing");
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(w.t.started.length, started + 1, "and the next yes started the finish");
    const result = await finishNow(w.t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([...new Set(w.t.calls.filter((c) => c.cmd === "WHISPER").map((c) => partOf(c.args[c.args.indexOf("-f") + 1])))], ["main"]);
    const second = handoffOf(found);
    assert.deepEqual([second.revision, second.main.file, second.reels[0].file, second.reels[0].srt], [2, newer.name, first.reels[0].file, first.reels[0].srt]);
    const record = reread(found);
    for (const file of [...withTexts(MAIN_FILE), ...withTexts(newer.name)]) assert.ok(record.files[`final/${file}`] > 0, file);
    assert.equal(existsSync(join(found.folder, "final", MAIN_FILE)), true, "the earlier export stays in final/");
    assert.equal(record.finished.parts.main.file, `final/${newer.name}`);
    assert.equal(record.finished.parts["reel 2"].file, `final/${REEL_FILE}`);
    w.t.done();
  });
  it("lets the claim go when a finish fails, and writes no finish", async () => {
    const w = fw({ programs: { FFPROBE: probeFor(() => ({ sound: null })) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    assert.equal(reread(found).editing.by, "Mac Studio");
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.ok(!reread(found).editing);
    assert.equal(reread(found).finished, null);
    w.t.done();
  });
  it("shows the steps of a finish from HyperFrames' exports, with their own first step", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = await asked(w);
    let steps = null;
    const stepped = [];
    const progress = { begin() {}, length() {}, steps: (list) => (steps = list), step: (name) => stepped.push(name), fraction() {}, encoding: () => ({ args: [], stop() {} }), end() {} };
    const result = await finishNow(w.t.ctx, found, { progress });
    assert.equal(result.ok, true, result.failed.join(" "));
    const named_ = ["Waiting for HyperFrames' exports", "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode", "Checking the copies"];
    assert.deepEqual(steps, named_);
    assert.deepEqual(stepped, named_);
    w.t.done();
  });
  it("says in the end only what applies to HyperFrames: how to free space, and nothing of Final Cut", async () => {
    const w = fw();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const { result } = await finished(w);
    assert.match(result.next, /make the episode's folder online-only: in Finder, Control-click it and choose Make online-only\./);
    assert.doesNotMatch(result.next, NOT_AN_APP_WORD);
    w.t.done();
  });
  it("finishes a main video that went the Final Cut way beside a Reel from HyperFrames, each as its own way says", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = fw({ projects: ["reel 2"], over: { main: { ...EDITED.main, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    let steps = null;
    const progress = { begin() {}, length() {}, steps: (list) => (steps = list), step() {}, fraction() {}, encoding: () => ({ args: [], stop() {} }), end() {} };
    const result = await finishNow(w.t.ctx, found, { progress });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(steps[0], "Waiting for the finished videos");
    const record = reread(found);
    assert.equal(record.finished.parts.main.export, `final/${PROJECT.main}.fcpxmld`);
    assert.equal("project" in record.finished.parts.main, false);
    assert.equal(record.finished.parts["reel 2"].project, REEL2);
    assert.equal("export" in record.finished.parts["reel 2"] || "noHandEdits" in record.finished.parts["reel 2"], false);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["reel 2", "finished"]]);
    assert.deepEqual(readdirSync(w.downloads), [], "the Reel's export is removed from Downloads");
    assert.equal(existsSync(reel.path), false);
    assert.equal(readdirSync(join(w.t.home, "BRIMM Video Work", "From Final Cut")).length, 0, "and what it took from From Final Cut");
    assert.match(result.next, /File > Delete Generated Library Files/);
    w.t.done();
  });
});
