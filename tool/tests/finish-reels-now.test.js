// finish "<episode>" reels, the detached part (plan PR 9, groups 6 to 11; architecture 2026-10-27, 8.1 to 8.4 and 8.7): the Reels of a video
// her editor finished are waited for, checked, transcribed, copied into the episode's final/ by the Dropbox rule and handed off as the
// next revision of the hand-off the video has: the same id, `main`, the suggestions and the Reels it holds as they were, and the Reels
// taken now added. It is finishNow (finish.js), as PR 7 made it, run for a finish.asked.json that names the hand-off it is made from. The
// world is reels-world.js's, with stand-ins for ffprobe, ffmpeg and the transcriber: no test runs a program, and nothing touches the real
// Downloads folder, Dropbox or BRIMM Video Work.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishFinished, finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { lostReelsWords, missingWords } from "../finish-reels.js";
import { recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { PIN } from "../hyperframes.js";
import { tidyTranscript } from "../shared/transcript.js";
import { episodeAs, listAll, reread, FOLDER, ID, NAME } from "./episodes.js";
import { REEL1, REEL2, entry, exportOf, named, probeFor } from "./exports-world.js";
import { HANDOFF, HANDOFF_REL, finishedWorld, handoffIn } from "./reels-world.js";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
const stem = (file) => file.replace(/\.[^.]+$/, "");
const withTexts = (file) => [file, ...["srt", "transcript.txt", "words.json"].map((ending) => `${stem(file)}.${ending}`)];
const worlds = [];
async function W(opts) {
  const w = await finishedWorld(opts);
  worlds.push(w);
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});
/** finish asked for the Reels with a yes: the episode as it is then, with the quick part's claim. */
async function asked(w, answers = {}) {
  assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, ...answers }), 0, w.t.said());
  return { ...w.found, record: reread(w.found) };
}
/** Asked, and run to its end: what it said, and the episode as it is then. */
async function finished(w, answers = {}) {
  const found = await asked(w, answers);
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { found, result };
}
const LET_GO = "The episode is let go again, as it was before the finish.";
const reasons = (result) => result.failed.filter((line) => line !== LET_GO);
/** Every file of the episode's folder but its records (a claim and its letting go write those): what a finish that copies nothing leaves. */
const filesOf = (found) => listAll(found.folder).filter((file) => !file.startsWith("record/"));
/** The record written again with `change` laid over it, as a command of her chat would leave it. */
function rewrite(w, change) {
  const now = reread(w.found);
  writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...(typeof change === "function" ? change(now) : change) }));
}
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}
const linesOf = (w) => (w.t.said() === "" ? [] : w.t.said().split("\n"));
/** The lines finish said for the Reels, when asked now. */
async function lines(w, answers = {}) {
  const had = linesOf(w).length;
  await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, ...answers });
  return linesOf(w).slice(had);
}

describe("7. the hand-off: the next revision of the one the video has", () => {
  it("is revision 2 under revision 1's id, passes the contract's check, and has the finished fixture's keys in order, its captions readable by the page", async () => {
    const w = await W();
    const reel = exportOf(w, "reel 2");
    const { found } = await finished(w);
    const h = handoffIn(found);
    assert.deepEqual([h.version, h.revision, h.video.id, h.video.kind, h.session], [2, 2, ID, "finished", null]);
    assert.equal(handoffFaultV2(h), "");
    assert.deepEqual(Object.keys(h), Object.keys(FIXTURE));
    assert.deepEqual(Object.keys(h.video), Object.keys(FIXTURE.video));
    assert.deepEqual(Object.keys(h.main), Object.keys(FIXTURE.main));
    assert.deepEqual(Object.keys(h.suggestions[0]), Object.keys(FIXTURE.suggestions[0]));
    for (const r of h.reels) assert.deepEqual(Object.keys(r), Object.keys(FIXTURE.reels[0]));
    for (const srt of [h.main.srt, ...h.reels.map((r) => r.srt)]) assert.match(tidyTranscript(srt), /^\[0:00\] /);
    assert.equal(h.reels[0].file, reel.name);
  });
  it("keeps main and the suggestions as they were, a suggestion that was made into a Reel included, and adds the Reel with the title, length and place the record and its words give", async () => {
    const w = await W();
    const before = handoffIn(w.found);
    const reel = exportOf(w, "reel 2");
    const { found } = await finished(w);
    const h = handoffIn(found);
    assert.deepEqual(h.main, before.main);
    assert.deepEqual(h.suggestions, before.suggestions);
    assert.deepEqual(h.suggestions.map((s) => s.n), [1, 2]);
    assert.deepEqual(h.reels.map((r) => [r.n, r.title, r.file, r.seconds, r.fromSuggestion]), [[2, "Know your costs", reel.name, 75, 2]]);
    assert.deepEqual(h.reels[0].inMain, { start: 4.1, end: 11.8 });
    assert.deepEqual(h.reels[0].inMain, { start: h.suggestions[1].start, end: h.suggestions[1].end }, "where its words fall is the suggestion's stretch, as the contract's finished fixture has it");
    assert.deepEqual([h.made === before.made, h.madeOn], [false, "Mac Studio"]);
  });
  it("finds where a Reel falls in the video by the captions of the hand-off when the episode has no file of word times, and by none for words that are not in it", async () => {
    for (const words of [true, false]) {
      const w = await W({ projects: ["reel 1", "reel 2"], words });
      exportOf(w, "reel 1");
      exportOf(w, "reel 2");
      const { found } = await finished(w);
      const [one, two] = handoffIn(found).reels;
      assert.equal("inMain" in one, false, "Reel 1's words are not in the video");
      assert.deepEqual(two.inMain, { start: 4.1, end: 11.8 }, `Reel 2, ${words ? "by the word times" : "by the captions"}`);
    }
  });
  it("takes each Reel's fromSuggestion from its project: a suggestion's number, or null for times she gave", async () => {
    const projects = [entry("reel 2"), entry("reel 3", { fromSuggestion: null })];
    const w = await W({ projects: ["reel 2", "reel 3"], over: { app: { toolchain: PIN.version, projects } } });
    exportOf(w, "reel 2");
    exportOf(w, "reel 3");
    const { found } = await finished(w);
    const h = handoffIn(found);
    assert.equal(handoffFaultV2(h), "");
    assert.deepEqual(h.reels.map((r) => [r.n, r.fromSuggestion]), [[2, 2], [3, null]]);
  });
  it("is not written when the hand-off's own check finds a fault, and nothing is copied: a project that says Reel 2 was made from suggestion 3, and one that says Reel 1 was made from times she gave", async () => {
    const cases = [
      [["reel 2"], [entry("reel 2", { fromSuggestion: 3 })], "Reel 2 says it was made from suggestion 3, but a Reel made from a suggestion takes its number."],
      [["reel 1"], [entry("reel 1", { fromSuggestion: null })], "Reel 1 says it was made from times she gave, but suggestion 1 has its number: a Reel made from times she gave has a fresh number."]
    ];
    for (const [keys, projects, fault] of cases) {
      const w = await W({ projects: keys, over: { app: { toolchain: PIN.version, projects } } });
      for (const key of keys) exportOf(w, key);
      const found = await asked(w);
      const before = filesOf(found);
      const result = await finishNow(w.t.ctx, found);
      assert.equal(result.ok, false);
      assert.deepEqual(reasons(result), [`The hand-off could not be written: ${fault}`]);
      assert.deepEqual([filesOf(found), reread(found).finished.revision, handoffIn(found).revision], [before, 1, 1], "nothing is copied and the hand-off is as it was");
      assert.ok(!reread(found).editing, "the claim the quick part took is let go");
    }
  });
  it("stops before anything is copied when a Reel's export is wider than it is tall, or has no sound", async () => {
    const cases = [
      [() => ({ picture: { width: 1920, height: 1080, color_primaries: "bt709", color_transfer: "bt709" } }), (name) => `${name} is wider than it is tall, and a Reel is upright.`],
      [() => ({ sound: null }), (name) => `${name} has no sound. Export it again from HyperFrames with its sound.`]
    ];
    for (const [over, words] of cases) {
      const w = await W({ programs: { FFPROBE: probeFor(over) } });
      const reel = exportOf(w, "reel 2");
      const found = await asked(w);
      const before = filesOf(found);
      const result = await finishNow(w.t.ctx, found);
      assert.equal(result.ok, false);
      assert.deepEqual(reasons(result), [words(reel.name)]);
      assert.deepEqual(filesOf(found), before);
      assert.deepEqual(w.t.calls.filter((c) => c.cmd === "WHISPER"), []);
    }
  });
  it("keeps the hand-off under the name it has when the episode was named another way since, and writes no second one", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { name: { text: "Pricing, named again", placeholder: false } });
    const { found } = await finished(w);
    assert.deepEqual(w.t.inFinal(found).filter((file) => file.endsWith(".brimm-ops.json")), [HANDOFF]);
    assert.deepEqual([reread(found).finished.handoff, handoffIn(found).revision, handoffIn(found).video.name], [HANDOFF_REL, 2, "Pricing, named again"]);
  });
  it("puts the Reel's export, its transcripts and the Story parts of a Reel over a minute into final/, and the hand-off, of the name it had, last", async () => {
    const w = await W();
    const reel = exportOf(w, "reel 2");
    const { found } = await finished(w);
    const files = [HANDOFF, ...withTexts(reel.name), `${stem(reel.name)}.story-1.mp4`, `${stem(reel.name)}.story-2.mp4`, "Pricing talk.srt", "Pricing talk.transcript.txt"].sort();
    assert.deepEqual(w.t.inFinal(found), files);
    const intoFinal = w.t.clones.map(([, to]) => to).filter((to) => to.startsWith(`${join(found.folder, "final")}/`));
    assert.equal(intoFinal.at(-1), join(found.folder, "final", HANDOFF), "the hand-off goes in last");
    assert.equal(reread(found).finished.handoff, HANDOFF_REL);
    assert.equal(w.t.inFinal(found).filter((file) => file.endsWith(".brimm-ops.json")).length, 1, "one hand-off, replaced, under its name");
  });
});

describe("7 again. the hand-off it is made from is read again before anything is waited for", () => {
  /** Asked with a yes, then `change` the hand-off on file, then run: what it said and what it left. */
  async function after(change) {
    const w = await W();
    exportOf(w, "reel 2");
    const found = await asked(w);
    change(w, found);
    const before = filesOf(found);
    const result = await finishNow(w.t.ctx, found);
    return { w, found, result, before };
  }
  it("stops, copying nothing, when it cannot be used any more", async () => {
    const { w, found, result, before } = await after((w2, f) => writeFileSync(join(f.folder, HANDOFF_REL), "not json"));
    assert.deepEqual([result.ok, reasons(result)], [false, [`${NAME}'s hand-off cannot be used as it stands, so its Reels cannot be added to it. Ask Jason.`]]);
    assert.deepEqual([filesOf(found), w.t.calls.filter((c) => c.cmd === "WHISPER")], [before, []]);
    assert.ok(!reread(found).editing, "the claim the quick part took is let go");
  });
  it("stops when it is no longer the revision the finish was asked at, and tells her to say it again in the words of this form", async () => {
    const { found, result } = await after((w2, f) => writeFileSync(join(f.folder, HANDOFF_REL), readFileSync(join(f.folder, HANDOFF_REL), "utf8").replace('"revision": 1', '"revision": 9')));
    assert.deepEqual(reasons(result), [`The hand-off of ${NAME} changed since finish was asked. Say "hand off the Reels" again.`]);
    assert.deepEqual(handoffIn(found).revision, 9);
  });
  it("stops, with Dropbox asked to bring it over, when it is not whole here", async () => {
    const { result } = await after((w2) => {
      w2.t.ctx.isWhole = (path) => !path.endsWith(".brimm-ops.json");
    });
    assert.deepEqual(reasons(result), ['Dropbox is still bringing the hand-off over to this Mac. Say "hand off the Reels" again.']);
  });
});

describe("8. again: the Reels taken before stay as they were", () => {
  it("adds Reel 1 after Reel 2 as revision 3, the same id, with main, the suggestions and Reel 2 deep equal to revision 2's, the Reels in the order of their numbers", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    const second = (await finished(w, { without: ["reel 1"] })).found;
    const two = handoffIn(second);
    assert.equal(two.revision, 2);
    // Reel 2's title is changed meanwhile, in the record: the Reel stays in the hand-off as it was, and is not made again.
    rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, title: "A new title" } : r)) }));
    const one = exportOf(w, "reel 1");
    assert.deepEqual(await lines(w), [`Reel 1: ${one.name}, from Downloads, exported 2026-10-20 14:00.`, "Reel 2: kept as the last finish made it.", 'Say "yes, hand off the Reels" to start.']);
    const { found } = await finished(w);
    const three = handoffIn(found);
    assert.deepEqual([three.revision, three.video.id], [3, ID]);
    assert.equal(handoffFaultV2(three), "");
    assert.deepEqual(three.main, two.main);
    assert.deepEqual(three.suggestions, two.suggestions);
    assert.deepEqual(three.reels.map((r) => r.n), [1, 2]);
    assert.deepEqual(three.reels[1], two.reels[0]);
    assert.equal(three.reels[1].title, "Know your costs", "as it was, not as the record says now");
    assert.equal(three.reels[0].file, one.name);
    assert.deepEqual(Object.keys(reread(found).finished.parts).sort(), ["main", "reel 1", "reel 2"]);
  });
  it("puts a Reel exported again in the place of its earlier entry, once, with the other Reels as they were, and keeps the earlier export in final/", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    const first2 = exportOf(w, "reel 2");
    exportOf(w, "reel 1");
    const second = (await finished(w)).found;
    const two = handoffIn(second);
    const again = exportOf(w, "reel 2", { start: [14, 10, 0], text: "the Reel exported again" });
    assert.deepEqual(await lines(w), [`Reel 1: kept as the last finish made it.`, `Reel 2: ${again.name}, from Downloads, exported 2026-10-20 14:10.`, 'Say "yes, hand off the Reels" to start.']);
    const { found } = await finished(w);
    const three = handoffIn(found);
    assert.deepEqual(three.reels.map((r) => r.n), [1, 2], "each number once");
    assert.equal(three.reels[1].file, again.name);
    assert.deepEqual(three.reels[0], two.reels[0]);
    assert.ok(w.t.inFinal(found).includes(first2.name), "the earlier export stays in final/");
    assert.equal(reread(found).finished.parts["reel 2"].file, `final/${again.name}`);
  });
  it("says there is nothing new when the Reels are all in the hand-off, naming its revision", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    await finished(w);
    const r = await lines(w, { yes: true });
    assert.deepEqual(r, ["Reel 2: kept as the last finish made it.", `${NAME} has no Reel exported since its hand-off was made, as revision 2, so there is nothing new to hand off. Export one from HyperFrames on This Mac, then say "hand off the Reels".`]);
  });
});

describe("9. the Dropbox rule, and the record", () => {
  it("copies every file as a clone made outside and never over a file, the record last of all, written for the revision the finish was asked at", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const found = await asked(w);
    const cloned = w.t.clones.length;
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const made = w.t.clones.slice(cloned).map(([from, to]) => ({ from, to }));
    assert.ok(made.length > 5);
    assert.ok(made.every(({ from }) => !from.startsWith(w.found.folder)), "each is made outside the episode, in the run's own folder or Downloads");
    assert.equal(made.at(-1).to, recordFile(found.folder, found.record.rev + 1), "the record is written last");
    assert.equal(made.at(-2).to, join(found.folder, "final", HANDOFF), "the hand-off just before it");
  });
  it("leaves the record the other Mac wrote as it is when it changed while the copies were made, keeps the earlier finish in it, and keeps every original in Downloads", async () => {
    const w = await W();
    const reel = exportOf(w, "reel 2");
    const found = await asked(w);
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".brimm-ops.json")) writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1, editing: { by: "Sallie's laptop", since: "2026-10-20T15:30:00-05:00" } }));
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(reasons(result).join("\n"), /^Sallie's laptop took Pricing: what to charge\? over while finish was copying into final\/, so the finish is not in the record\./);
    assert.match(reasons(result).join("\n"), / The record lists what final\/ holds now, and keeps the hand-off it had: the Reels are taken again from their exports\. Take it over and say "hand off the Reels" again, or finish it there\.$/);
    assert.deepEqual(readdirSync(w.downloads), [reel.name], "every original stays in Downloads");
    const record = reread(found);
    assert.deepEqual([record.editing.by, record.finished.revision, Object.keys(record.finished.parts)], ["Sallie's laptop", 1, ["main"]], "the other Mac's record is not written over, and says no finish of the Reels");
  });
  it("records the finish: main as it was, a part for the Reel with its project and neither an export nor no hand edits, the Reel and its project finished, the claim let go", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    const before = reread(w.found);
    const reel = exportOf(w, "reel 2");
    const sized = statSync(reel.path);
    const { found } = await finished(w, { without: ["reel 1"] });
    const record = reread(found);
    assert.equal(record.finished.revision, 2);
    assert.equal(record.finished.handoff, before.finished.handoff);
    assert.deepEqual(record.finished.parts.main, before.finished.parts.main);
    const part = record.finished.parts["reel 2"];
    assert.deepEqual(Object.keys(part).sort(), ["bytes", "file", "project", "seconds", "source", "story", "words"]);
    assert.deepEqual([part.file, part.project, part.seconds, part.bytes, part.source], [`final/${reel.name}`, REEL2, 75, sized.size, { bytes: sized.size, mtimeMs: sized.mtimeMs }]);
    assert.deepEqual(part.story, [`final/${stem(reel.name)}.story-1.mp4`, `final/${stem(reel.name)}.story-2.mp4`]);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status]), [[1, "picked"], [2, "finished"]]);
    assert.deepEqual(record.reels[1].final, { file: `final/${reel.name}`, seconds: 75 });
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["reel 1", "opened"], ["reel 2", "finished"]]);
    assert.equal(record.editing, null, "the claim this Mac took is let go");
    for (const file of w.t.inFinal(found)) assert.ok(`final/${file}` in record.files, `${file} is listed`);
  });
  it("removes from Downloads after the late check exactly what it took, and leaves a letter and an older file of another name alone", async () => {
    const w = await W();
    const reel = exportOf(w, "reel 2");
    writeFileSync(join(w.downloads, "a letter.pdf"), "not an export");
    const found = await asked(w);
    let during = null;
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      if (ms === LATE_CHECK_MS) during = readdirSync(w.downloads).sort();
      return wait(ms);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(during, [reel.name, "a letter.pdf"].sort());
    assert.deepEqual(readdirSync(w.downloads), ["a letter.pdf"]);
  });
});

describe("6 again. numbers, in the detached part as well", () => {
  const FIRST = "e-20261010-7c1d2e";
  it("refuses a Reel number another version of the video gave since the quick part, copies nothing, and lets the claim go", async () => {
    const w = await W({ suggestions: false, handoff: false, over: { versionOf: FIRST } });
    const first = episodeAs(w.t, { id: FIRST, name: "2026-10-10 Pricing talk, first cut (Mac Studio)", record: { kind: "raw" } });
    assert.equal((await finishFinished(w.t.ctx, w.found, { record: w.found.record })).ok, true);
    exportOf(w, "reel 2");
    const found = await asked(w);
    const srt = "1\n00:00:00,000 --> 00:00:02,000\n Hi.\n\n";
    const gave = { format: "brimm-video hand-off", version: 2, revision: 7, made: "2026-10-10T10:00:00-05:00", madeOn: "Mac Studio", madeBy: "brimm-video c709b57", video: { id: FIRST, kind: "raw", name: "Pricing talk", recorded: "2026-10-10", recordedFrom: "video" }, main: { file: "x.mp4", seconds: 10, srt }, reels: [{ n: 2, title: "t", file: "r.mp4", seconds: 5, srt, fromSuggestion: null }], session: null };
    mkdirSync(join(first.folder, "final"), { recursive: true });
    writeFileSync(join(first.folder, "final", "Pricing talk, first cut.brimm-ops.json"), JSON.stringify(gave));
    const before = filesOf(found);
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(reasons(result), [`${NAME}'s hand-off would give Reel 2 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
    assert.deepEqual(filesOf(found), before);
    assert.ok(!reread(found).editing, "the claim the quick part took is let go");
  });
  it("lets the episode's own earlier revisions give their numbers by right: a Reel taken again is not refused for the number it had", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    await finished(w);
    exportOf(w, "reel 2", { start: [14, 10, 0], text: "the Reel exported again" });
    const { found } = await finished(w);
    assert.deepEqual(handoffIn(found).reels.map((r) => r.n), [2]);
  });
});

describe("10. a spelling after the Reels", () => {
  it("makes the hand-off again as the next revision with main and the Reels spelled, and keeps the Reels' parts in the record, so that the next finish keeps Reel 2", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    const two = handoffIn((await finished(w, { without: ["reel 1"] })).found);
    const parts = reread(w.found).finished.parts;
    const spelled = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(spelled.code, 0, spelled.said.join("\n"));
    const three = handoffIn(w.found);
    assert.equal(three.revision, 3);
    assert.match(three.main.srt, /Thank you so much, Sally\./);
    // The Reel is as it was but for its captions, which the spelling reaches too (the review's I1): they were "Sallie." and are "Sally." now.
    assert.deepEqual(three.reels.map(({ srt, ...rest }) => rest), two.reels.map(({ srt, ...rest }) => rest));
    assert.match(three.reels[0].srt, /Thank you so much, Sally\./);
    assert.doesNotMatch(three.reels[0].srt, /Sallie/);
    assert.deepEqual(reread(w.found).finished.parts["reel 2"], { ...parts["reel 2"], spellings: [["Sallie", "Sally"]] });
    assert.deepEqual(Object.keys(reread(w.found).finished.parts), ["main", "reel 2"]);
    exportOf(w, "reel 1");
    assert.deepEqual((await lines(w)).slice(1, 2), ["Reel 2: kept as the last finish made it."]);
    const four = handoffIn((await finished(w)).found);
    assert.deepEqual([four.revision, four.reels.map((r) => r.n)], [4, [1, 2]]);
    assert.deepEqual(four.reels[1], three.reels[0], "the next finish keeps Reel 2 as the spelling left it");
  });
});

describe("I1. a spelling after the Reels reaches the Reels the hand-off holds (the review)", () => {
  /** What the transcriber hears of Reel 2: the sentence of the made-up Reel, with a name of its own, which the video's captions do not hold. */
  const CYNTHIA = "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n2\n00:00:02,600 --> 00:00:07,700\n costs. It is very, very important. Thank you so much, Cynthia.\n\n";
  const text = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
  /** The Reel's files in final/, by what they are: the captions, the transcript and the word times. */
  const reelRel = (found, ending) => `final/${stem(handoffIn(found).reels[0].file)}.${ending}`;
  const KEPT = `Reel 2's captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".`;
  /** The finish of Reel 2 done, and `damage` done to the file of its word times: what a spelling then says, and what it left. */
  async function spelledAfter(damage, { pair = ["Sallie", "Sally"], opts = {} } = {}) {
    const w = await W(opts);
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const two = handoffIn(found);
    if (damage) damage(join(found.folder, reelRel(found, "words.json")));
    const srt = text(found, reelRel(found, "srt"));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", ...pair);
    return { w, found, two, three: handoffIn(found), r, srt };
  }
  it("spells a Reel's captions, its transcript and its word times, in final/ and in the hand-off, and leaves main as it was when the word is the Reel's alone", async () => {
    const w = await W({ captions: { "reel 2": CYNTHIA } });
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const two = handoffIn(found);
    const mainSrt = text(found, "final/Pricing talk.srt");
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Cynthia", "Allison");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(r.said, ['"Cynthia" is spelled "Allison" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again.']);
    const three = handoffIn(found);
    assert.equal(three.revision, 3);
    assert.deepEqual(three.main, two.main, "main is as it was, byte for byte");
    assert.equal(text(found, "final/Pricing talk.srt"), mainSrt);
    assert.match(three.reels[0].srt, /Thank you so much, Allison\./);
    assert.equal(text(found, reelRel(found, "srt")), three.reels[0].srt, "the captions in final/ are the hand-off's");
    assert.match(text(found, reelRel(found, "transcript.txt")), /Thank you so much, Allison\./);
    assert.deepEqual(JSON.parse(text(found, reelRel(found, "words.json"))).words.map((word) => word.w).filter((word) => /Allison|Cynthia/.test(word)), ["Allison."]);
    assert.equal(handoffFaultV2(three), "");
    const record = reread(found);
    assert.deepEqual(record.finished.parts["reel 2"].spellings, [["Cynthia", "Allison"]]);
    for (const ending of ["srt", "transcript.txt", "words.json"]) assert.equal(record.files[reelRel(found, ending)], Buffer.byteLength(text(found, reelRel(found, ending))), `${ending} is listed at its size`);
    assert.deepEqual(three.reels.map(({ srt, ...rest }) => rest), two.reels.map(({ srt, ...rest }) => rest), "the Reel is as it was but for its captions");
  });
  it("says a Reel's captions keep the old spelling when its word times cannot be read, and leaves its captions as they were", async () => {
    for (const damage of [(path) => rmSync(path), (path) => writeFileSync(path, "x".repeat(statSync(path).size))]) {
      const { found, two, three, r, srt } = await spelledAfter(damage);
      assert.equal(r.code, 0, r.said.join("\n"));
      assert.equal(r.said.at(-1), KEPT);
      assert.match(three.main.srt, /Thank you so much, Sally\./, "main is spelled all the same");
      assert.deepEqual(three.reels, two.reels, "the Reel is as it was");
      assert.equal(text(found, reelRel(found, "srt")), srt);
      assert.match(text(found, reelRel(found, "srt")), /Sallie\./);
      assert.deepEqual(reread(found).finished.parts["reel 2"].spellings, [], "the spelling is not held by it, so a later one tries it again");
    }
  });
  it("says it too when the hand-off comes out as it was, because the spelling is the Reel's alone and its word times cannot be read", async () => {
    const { three, two, r } = await spelledAfter((path) => rmSync(path), { pair: ["Cynthia", "Allison"], opts: { captions: { "reel 2": CYNTHIA } } });
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(r.said, ['"Cynthia" is spelled "Allison" now, in every caption. The final transcripts and the hand-off are as they were.', KEPT]);
    assert.equal(three.revision, two.revision);
  });
  it("keeps a Reel's captions and says so when a spelling it holds is taken back: it cannot be taken out of words that hold it", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const dropped = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(dropped.code, 0, dropped.said.join("\n"));
    assert.equal(dropped.said.at(-1), KEPT);
    const four = handoffIn(found);
    assert.deepEqual([four.revision, /Sallie\./.test(four.main.srt), /Sally\./.test(four.reels[0].srt)], [4, true, true]);
    assert.deepEqual(reread(found).finished.parts["reel 2"].spellings, [["Sallie", "Sally"]]);
  });
  it("asks Dropbox to bring a Reel's word times over when they are a placeholder, and writes nothing", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const before = filesOf(found);
    const rev = reread(found).rev;
    const started = w.t.started.length;
    w.t.ctx.deps.isWhole = (path) => !(path.includes("/final/") && path.endsWith(".words.json"));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.said], [1, ["Dropbox is still bringing the final captions over: say it again in a minute."]]);
    assert.deepEqual([filesOf(found), reread(found).rev, w.t.started.length], [before, rev, started + 1]);
    assert.deepEqual(w.t.started.at(-1)[1].slice(-4), ["bring", "--now", FOLDER, reelRel(found, "words.json")]);
  });
  it("puts a Reel's files back as they were when the record could not be written", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    const files = ["srt", "transcript.txt", "words.json"].map((ending) => reelRel(found, ending));
    const before = files.map((rel) => text(found, rel));
    const handoff = text(found, HANDOFF_REL);
    // The other Mac writes the next record while this one copies the hand-off in.
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".brimm-ops.json")) {
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, name: { text: "Changed meanwhile", placeholder: false } }));
      }
    };
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 1, r.said.join("\n"));
    assert.deepEqual(files.map((rel) => text(found, rel)), before, "the Reel's three files are as they were");
    assert.equal(text(found, HANDOFF_REL), handoff);
  });
});

describe("I2. a hand-off that is gone is not made again without its Reels (the review)", () => {
  /** The finish of Reel 2 done, then the hand-off `damage`d: what a spelling then says, and what it left. */
  async function spelledAfter(damage) {
    const w = await W();
    exportOf(w, "reel 2");
    const { found } = await finished(w);
    damage(join(found.folder, HANDOFF_REL));
    const before = filesOf(found);
    const rev = reread(found).rev;
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    return { w, found, r, before, rev };
  }
  it("refuses a spelling, and writes nothing, when the hand-off is gone from the folder and the record holds a Reel's part", async () => {
    const { found, r, before, rev } = await spelledAfter((path) => rmSync(path));
    assert.deepEqual([r.code, r.said], [1, [lostReelsWords(NAME)]]);
    assert.match(r.said[0], / Ask Jason\.$/);
    assert.deepEqual([filesOf(found), reread(found).rev, reread(found).spellings ?? []], [before, rev, []]);
    assert.deepEqual(Object.keys(reread(found).finished.parts), ["main", "reel 2"], "the Reel's part is still in the record");
    assert.equal(existsSync(join(found.folder, HANDOFF_REL)), false, "no hand-off without the Reel is written");
  });
  it("refuses it likewise when the hand-off cannot be read", async () => {
    // (Of the size the record lists, as a copy that is not what it should be but is whole is: a different size is a copy Dropbox is bringing.)
    const garbage = (path) => writeFileSync(path, "x".repeat(statSync(path).size));
    const { found, r, before, rev } = await spelledAfter(garbage);
    assert.deepEqual([r.code, r.said], [1, [lostReelsWords(NAME)]]);
    assert.deepEqual([filesOf(found), reread(found).rev, /^x+$/.test(readFileSync(join(found.folder, HANDOFF_REL), "utf8"))], [before, rev, true]);
    assert.deepEqual(Object.keys(reread(found).finished.parts), ["main", "reel 2"]);
  });
  it("still makes a hand-off again that is gone when the record holds no part of a Reel: only a first hand-off was written", async () => {
    const w = await W();
    rmSync(join(w.found.folder, HANDOFF_REL));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual([handoffIn(w.found).reels, handoffIn(w.found).suggestions.length], [[], 2]);
  });
  it("is what a copy of the hand-off that failed leaves: finishing the Reels says it is not there instead of bringing it over for ever, and a spelling is refused", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    await finished(w, { without: ["reel 1"] });
    exportOf(w, "reel 1");
    const found = await asked(w);
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(".brimm-ops.json")) throw new Error("the disk is full");
      return clone(from, to);
    };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, false);
    assert.equal(existsSync(join(found.folder, HANDOFF_REL)), false, "the rule deleted the old hand-off before its copy failed");
    w.t.ctx.deps.clone = clone;
    w.t.ctx.isWhole = (path) => existsSync(path);
    const started = w.t.started.length;
    assert.deepEqual(await lines(w, { yes: true }), [missingWords(NAME)]);
    assert.equal(w.t.started.length, started, "there is nothing to bring over, so none is started");
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.said], [1, [lostReelsWords(NAME)]]);
    assert.deepEqual(Object.keys(reread(found).finished.parts), ["main", "reel 2"], "the part of Reel 2 is not lost");
    assert.equal(existsSync(join(found.folder, HANDOFF_REL)), false);
  });
});

describe("11. the words", () => {
  const ACCENTED = 'Café "prix": quoi?';
  /** What is wrong with the words of lines: a path (a slash but the folder name final/, or a tilde), a flag, a command's name, or the
      word Studio but in a Mac's name. The names a line may hold (a project's, an export's, the episode's) are taken out first. */
  function problemsIn(said, names) {
    const longest = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
    const problems = [];
    for (const line of said) {
      let rest = line;
      for (const name of longest) rest = rest.split(name).join("(a name)");
      rest = rest.replace(/\bfinal\//g, "final").replace(/Mac Studio/g, "");
      for (const [pattern, what] of [[/\//, "a path"], [/~/, "a path"], [/--/, "a flag"], [/\bedit\.js\b/, "a command"], [/\bnode\b/, "a command"], [/\bnpx\b/, "a command"], [/\bStudio\b/, "the word Studio"]]) if (pattern.test(rest)) problems.push(`${what} in: ${line}`);
    }
    return problems;
  }
  for (const name of [NAME, ACCENTED]) {
    it(`holds no path, flag or command in anything it says, whichever way it ends, for ${name}`, async () => {
      const all = [];
      const names = new Set([name]);
      const own = name === NAME ? {} : { name };
      /** A world, and the names its lines may hold. */
      const make = async (opts = {}) => {
        const w = await W({ ...own, ...opts });
        for (const project of Object.values(w.names)) names.add(project);
        return w;
      };
      const exported = (w, key, opts) => {
        const got = exportOf(w, key, opts);
        names.add(got.name);
        return got;
      };
      const w = await make();
      const reel = exported(w, "reel 2");
      all.push(...(await lines(w)));
      const found = await asked(w);
      all.push(...linesOf(w));
      // An export that is still being written.
      const wait = w.t.ctx.deps.wait;
      w.t.ctx.deps.wait = async (ms) => {
        w.t.grow(reel.path, 1000);
        return wait(ms);
      };
      const stuck = await finishNow(w.t.ctx, found);
      all.push(...stuck.failed, stuck.next);
      // One that goes through, and a second ask with nothing new.
      const again = await make();
      exported(again, "reel 2");
      const done = await finished(again);
      all.push(...done.result.failed, done.result.next, ...(await lines(again, { yes: true })));
      // One that is wider than it is tall.
      const wide = await make({ programs: { FFPROBE: probeFor(() => ({ picture: { width: 1920, height: 1080, color_primaries: "bt709", color_transfer: "bt709" } })) } });
      exported(wide, "reel 2");
      all.push(...(await finishNow(wide.t.ctx, await asked(wide))).failed);
      assert.ok(all.filter(Boolean).length >= 8, all.join("\n"));
      assert.deepEqual(problemsIn(all.filter(Boolean), names), []);
      assert.ok(all.some((line) => line && line.includes('Say "hand off the Reels" again')), "it says what to say again in the words of this form");
    });
  }
});
