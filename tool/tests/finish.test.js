// finish, the detached part (finish.js): wait for Final Cut's files, check them, transcribe each finished video again, cut
// Story parts from a finished Reel, copy everything into the episode's final/ by the Dropbox rule, write the hand-off and
// the record, show the hand-off, and after the late check empty From Final Cut of what it took. In a made-up episode
// (episodes.js), with stand-ins for ffprobe, ffmpeg, the transcriber and open.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow, finishFinished, suggestionsFrom, expectedWords, lastRevision, chainOf, chainGap, chainGapWords, nextRevision, handoffIdOf, handoffTarget, highestNumberOf, numbersTakenWords, writesV2For, linksOf, handedOff, cannotFinish } from "../finish.js";
import { handoffFault } from "../handoff.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { recordFile, recordText, acceptRev } from "../episode.js";
import { clearRuns } from "../filing.js";
import { noProgress } from "../progress.js";
import { runsFolder, writeSettings } from "../settings.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { fromFinalCutFolder } from "../settings.js";
import { tidyTranscript } from "../shared/transcript.js";
import { setup, episodeFor, episodeAs, reread, listAll, EDITED, NAME, NOT_YET, PROJECT, SRT, FOLDER, ID, partOf } from "./episodes.js";
import { probed } from "./fixtures.js";

const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
/** What final/ holds after the made-up edit is finished. */
const FINAL = [
  HANDOFF,
  `${PROJECT.main}.fcpxmld/Info.fcpxml`, `${PROJECT.main}.mp4`, `${PROJECT.main}.srt`, `${PROJECT.main}.transcript.txt`, `${PROJECT.main}.words.json`,
  `${PROJECT["reel 1"]}.fcpxmld/Info.fcpxml`, `${PROJECT["reel 1"]}.mov`, `${PROJECT["reel 1"]}.srt`, `${PROJECT["reel 1"]}.transcript.txt`, `${PROJECT["reel 1"]}.words.json`,
  `${PROJECT["reel 2"]}.mov`, `${PROJECT["reel 2"]}.srt`, `${PROJECT["reel 2"]}.story-1.mp4`, `${PROJECT["reel 2"]}.story-2.mp4`, `${PROJECT["reel 2"]}.transcript.txt`, `${PROJECT["reel 2"]}.words.json`
].sort();

/** The made-up edit, Shared and exported, and finish asked with a yes: Reel 2 was never exported and had no hand edits. */
async function asked(t, record = EDITED) {
  const found = episodeFor(t, { record });
  t.shared(`${PROJECT.main}.mp4`, 2000);
  t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
  t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
  assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
  return { ...found, record: reread(found) };
}
/** The transcriber's calls, by the part whose sound they read. */
const heardOf = (t) => t.calls.filter((c) => c.cmd === "WHISPER").map((c) => partOf(c.args[c.args.indexOf("-f") + 1]));

describe("the words a part is expected to start with", () => {
  const plan = { phrases: [
    { id: "p1", start: 1, end: 3, keep: true, text: "Welcome to the show." },
    { id: "p2", start: 3.5, end: 6, keep: true, text: "So the first thing is costs." },
    { id: "p3", start: 6.5, end: 8, keep: true, text: "And prices." }
  ] };
  it("are the first phrase the record's own cuts leave, on the main video and on a Reel", () => {
    const record = { main: { cuts: [{ id: "c1", keep: false, from: 1, to: 3 }] }, reels: [{ n: 2, from: 3.5, to: 8, cuts: [{ id: "c1", keep: false, from: 3.5, to: 6 }] }] };
    assert.equal(expectedWords({ key: "main" }, record, plan), "So the first thing is costs.");
    assert.equal(expectedWords({ key: "reel 2", reel: 2 }, record, plan), "And prices.");
  });
});

describe("finish, the detached part", () => {
  it("finishes the episode: final/ holds each video, its transcripts, the Story parts, the exports and the hand-off", async () => {
    const t = setup();
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(t.inFinal(found), FINAL);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
    assert.equal(handoffFault(handoff), "");
    assert.equal(handoff.revision, 1);
    assert.deepEqual([handoff.episode.id, handoff.episode.name, handoff.episode.title], ["e-20261014-3fa9c1", "Pricing: what to charge?", "Price like you mean it"]);
    assert.deepEqual([handoff.main.file, handoff.main.seconds, handoff.main.srt], [`${PROJECT.main}.mp4`, 11.878, SRT.main]);
    assert.deepEqual(handoff.reels.map((r) => [r.n, r.title, r.file, r.seconds]), [[1, "Know your costs", `${PROJECT["reel 1"]}.mov`, 7.7], [2, "Say it again, better", `${PROJECT["reel 2"]}.mov`, 75]]);
    assert.deepEqual(handoff.reels[0].inMain, { start: 4.1, end: 11.8 });
    assert.equal("inMain" in handoff.reels[1], false);
    for (const srt of [handoff.main.srt, ...handoff.reels.map((r) => r.srt)]) assert.match(tidyTranscript(srt), /^\[0:00\] /);
    t.done();
  });
  it("finishes again over the final videos a corrected answer left in final/ (F9b): each is replaced by the rule, and nothing trips on it", async () => {
    const t = setup();
    const found = await asked(t);
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    // Answered again: final/'s hand-off and text files are set aside, and its videos, Story parts and exports stay, listed.
    assert.equal(await editMain(["kind", FOLDER, "raw", "--private", "no", "--again"], t.ctx.deps), 0, t.said());
    const corrected = reread(found);
    assert.equal(corrected.finished, null);
    const stays = FINAL.filter((file) => /\.(mp4|mov)$/.test(file) || file.includes(".fcpxmld/"));
    for (const file of stays) assert.ok(existsSync(join(found.folder, "final", file)) && `final/${file}` in corrected.files, file);
    assert.deepEqual(t.inFinal(found), stays);
    // Finished again from new Shares: every part is made again, each kept file replaced, and the hand-off is the next revision. A video
    // answered as raw is handed off as version 2 (version 1 knows no kind but an episode and a short video).
    writeSettings(t.home, { handoffVersion: 2 });
    t.ctx.settings = { ...t.ctx.settings, handoffVersion: 2 };
    t.shared(`${PROJECT.main}.mp4`, 2000);
    t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
    assert.equal(await finishEpisode(t.ctx, { ...found, record: corrected }, { yes: true, noHandEdits: ["reel 2"] }), 0, t.said());
    const again = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(again.ok, true, again.failed.join(" "));
    const made = t.inFinal(found);
    assert.deepEqual(made.filter((file) => !file.endsWith(".brimm-ops.json")), FINAL.filter((file) => file !== HANDOFF));
    assert.equal(made.filter((file) => file.endsWith(".brimm-ops.json")).length, 1);
    for (const file of stays) assert.equal(reread(found).files[`final/${file}`], statSync(join(found.folder, "final", file)).size, file);
    assert.equal(reread(found).finished.revision, 2);
    t.done();
  });
  it("records the finish: its revision, each part's file and what keeps its edit, the Reels finished, the files listed", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    const record = reread(found);
    assert.equal(record.finished.revision, 1);
    assert.equal(record.finished.parts.main.export, `final/${PROJECT.main}.fcpxmld`);
    assert.equal(record.finished.parts["reel 2"].noHandEdits, true);
    assert.deepEqual(record.reels.map((r) => r.status), ["finished", "finished", "candidate"]);
    assert.deepEqual(record.reels[0].final, { file: `final/${PROJECT["reel 1"]}.mov`, seconds: 7.7 });
    for (const file of FINAL) assert.ok(record.files[`final/${file}`] > 0, file);
    t.done();
  });
  it("copies every file into Dropbox by the rule, as a clone, and shows the hand-off in Finder", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    const cloned = new Set(t.clones.map(([, to]) => to));
    for (const file of FINAL) assert.ok(cloned.has(join(found.folder, "final", file)), file);
    const shown = t.calls.filter((c) => c.cmd === "/usr/bin/open");
    assert.deepEqual(shown.map((c) => c.args), [["-R", join(found.folder, "final", HANDOFF)]]);
    t.done();
  });
  it("cuts a finished Reel of more than a minute into Story parts of at most a minute, from the Reel's own file", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    const parts = t.calls.filter((c) => c.cmd === "FFMPEG" && /\.story-\d+\.mp4$/.test(c.args[c.args.length - 1]));
    assert.equal(parts.length, 2);
    for (const c of parts) assert.ok(c.args[c.args.indexOf("-i") + 1].endsWith(`${PROJECT["reel 2"]}.mov`));
    t.done();
  });
  it("waits for a file Final Cut is still writing, and reads its sound only when it is whole", async () => {
    const t = setup();
    const found = await asked(t);
    const main = join(fromFinalCutFolder(t.home), `${PROJECT.main}.mp4`);
    let grows = 3;
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      if (grows-- > 0) t.grow(main, 1000);
      return wait(ms);
    };
    const sizes = [];
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, more) => {
      const read = args[args.indexOf("-i") + 1];
      if (cmd === "FFMPEG" && args.includes("pcm_s16le") && read.endsWith(`/${PROJECT.main}.mp4`)) sizes.push(statSync(read).size);
      return run(cmd, args, more);
    };
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(sizes, [statSync(join(found.folder, "final", `${PROJECT.main}.mp4`)).size]);
    t.done();
  });
  it("waits while ffprobe cannot read a Share still being written, whose index Final Cut writes last", async () => {
    let refusals = 4;
    const t = setup({ programs: { FFPROBE: (args) => {
      const file = args[args.length - 1];
      if (file.includes(PROJECT.main) && refusals-- > 0) return { code: 1, stderr: "moov atom not found\n" };
      writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: file.includes("reel") ? { width: 1080, height: 1920 } : { width: 1280, height: 720 }, duration: file.includes("reel 2") ? "75.000000" : file.includes("reel 1") ? "7.700000" : "11.878000" }));
      return { code: 0, stderr: "" };
    } } });
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(refusals < 0, "ffprobe was asked again until it could read it");
    t.done();
  });
  it("stops after ten minutes of a file still growing, in plain words, and copies nothing", async () => {
    const t = setup();
    const found = await asked(t);
    const main = join(fromFinalCutFolder(t.home), `${PROJECT.main}.mp4`);
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      t.grow(main, 1000);
      return wait(ms);
    };
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed[0], /Pricing- what to charge- main v5 3fa9c1\.mp4 is still being written by Final Cut\. Say finish again when its Share is done\./);
    assert.deepEqual(t.inFinal(found), []);
    assert.deepEqual(heardOf(t), []);
    t.done();
  });
  it("stops when a Reel is wide, naming the file, and writes no hand-off", async () => {
    const t = setup({ programs: { FFPROBE: (args) => {
      const out = args[args.indexOf("-o") + 1];
      const file = args[args.length - 1];
      const wide = !file.includes("reel 2");
      writeFileSync(out, JSON.stringify({ streams: [{ index: 0, codec_type: "video", width: wide ? 1280 : 1080, height: wide ? 720 : 1920, r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001", start_time: "0.000000", disposition: { attached_pic: 0 } }, { index: 1, codec_type: "audio", sample_rate: "48000", channels: 2, start_time: "0.000000" }], format: { duration: "7.700000" } }));
      return { code: 0, stderr: "" };
    } } });
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /Pricing- what to charge- reel 1 v1 3fa9c1\.mov is wider than it is tall, and a Reel is upright/);
    assert.equal(existsSync(join(found.folder, "final", HANDOFF)), false);
    assert.equal(reread(found).finished, null);
    t.done();
  });
  it("says, for a person to check by eye, a video whose first words are not those of its part, and finishes all the same", async () => {
    const t = setup({ programs: { WHISPER: (args) => {
      const base = args[args.indexOf("-of") + 1];
      const part = partOf(args[args.indexOf("-f") + 1]);
      const srt = part === "main" ? "1\n00:00:00,000 --> 00:00:03,000\n Okay, where was I? Right.\n\n2\n00:00:03,000 --> 00:00:11,800\n So the first thing you need to do is know your costs.\n\n" : SRT[part];
      writeFileSync(base + ".srt", srt);
      if (args.includes("-ojf")) writeFileSync(base + ".json", JSON.stringify({ transcription: [] }));
      return { code: 0, stderr: "" };
    } } });
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.match(result.next, /The main video starts with "Okay, where was I\? Right\.", where "Welcome to the show\." was expected: check by eye that it is the right video\./);
    assert.match(result.next, /Word times are missing for /);
    t.done();
  });
  it("on a second finish, transcribes only the Reel that changed, keeps the rest, and raises the revision", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    const first = JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
    t.calls.length = 0;
    t.clones.length = 0;
    t.shared(`${PROJECT["reel 1"]}.mov`, 9000, "a longer finished video");
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 9500);
    const again = { ...found, record: reread(found) };
    assert.equal(await finishEpisode(t.ctx, again, { yes: true }), 0);
    const result = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([...new Set(heardOf(t))], ["reel 1"]);
    const second = JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
    assert.equal(second.revision, 2);
    assert.equal(second.main.srt, first.main.srt);
    assert.deepEqual(second.reels.map((r) => r.n), [1, 2]);
    assert.deepEqual([second.main.seconds, second.reels[1].seconds], [first.main.seconds, first.reels[1].seconds]);
    const record = reread(found);
    assert.equal(record.finished.revision, 2);
    assert.deepEqual(Object.keys(record.finished.parts).sort(), ["main", "reel 1", "reel 2"]);
    assert.equal(record.finished.parts.main.seconds, 11.878);
    for (const file of FINAL) assert.ok(record.files[`final/${file}`] > 0, file);
    // The Reel made again went in by deleting the old copy first and cloning the new one: the clone stand-in refuses to
    // write over a file.
    assert.ok(t.clones.some(([, to]) => to === join(found.folder, "final", `${PROJECT["reel 1"]}.mov`)));
    assert.equal(readFileSync(join(found.folder, "final", `${PROJECT["reel 1"]}.mov`), "utf8"), "a longer finished video");
    t.done();
  });
  it("empties From Final Cut of what it took only after a clean late check, at least 15 minutes after the last copy", async () => {
    const t = setup();
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(t.waits.reduce((sum, ms) => sum + ms, 0) >= LATE_CHECK_MS);
    assert.deepEqual(readdirSync(fromFinalCutFolder(t.home)), []);
    const kept = setup();
    const held = await asked(kept);
    const after = await finishNow(kept.ctx, held, { lateCheck: () => ["Pricing- what to charge- main v5 3fa9c1.mp4 is not whole in final (it is missing)."] });
    assert.match(after.failed.join(" "), /is not whole in final/);
    assert.equal(readdirSync(fromFinalCutFolder(kept.home)).length, 5);
    t.done();
    kept.done();
  });
  it("offers, at the end, to make the episode online-only and how to free render files, and never to delete its library", async () => {
    const t = setup();
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    const next = result.next;
    assert.match(next, /make the episode's folder online-only: in Finder, Control-click it and choose Make online-only\./);
    assert.match(next, /File > Delete Generated Library Files/);
    assert.doesNotMatch(next, /free the space|delete its Final Cut library/);
    t.done();
  });
  it("never writes the hand-off with a made-up title: a finished Reel with none stops the finish, and is named", async () => {
    const t = setup();
    const found = await asked(t);
    const untitled = { ...found.record, reels: found.record.reels.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) };
    writeFileSync(recordFile(found.folder, found.record.rev), recordText(untitled));
    const result = await finishNow(t.ctx, { ...found, record: untitled });
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /Reel 2 has no title on screen\. Say what it says, and finish again\./);
    assert.equal(existsSync(join(found.folder, "final", HANDOFF)), false);
    assert.equal(reread(found).finished, null);
    t.done();
  });
  /** Have `then` run while the finish waits for its late check, 15 minutes after its last copy. */
  const whileLate = (t, then) => {
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      if (ms === LATE_CHECK_MS) then();
      return wait(ms);
    };
  };
  /** A file in From Final Cut made again: other bytes, a later time. */
  const madeAgain = (t, name, text = "a newer Share, made again") => {
    const at = join(fromFinalCutFolder(t.home), name);
    writeFileSync(at, text);
    const when = new Date(t.now() + 60000);
    utimesSync(at, when, when);
  };
  it("keeps in From Final Cut a file made again while it waited for the late check, and says so", async () => {
    const t = setup();
    const found = await asked(t);
    whileLate(t, () => madeAgain(t, `${PROJECT.main}.mp4`));
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(readFileSync(join(fromFinalCutFolder(t.home), `${PROJECT.main}.mp4`), "utf8"), "a newer Share, made again");
    assert.match(result.next, /Pricing- what to charge- main v5 3fa9c1\.mp4 changed in From Final Cut after it was taken, so it is kept there\./);
    assert.deepEqual(readdirSync(fromFinalCutFolder(t.home)), [`${PROJECT.main}.mp4`]);
    t.done();
  });
  it("keeps an export bundle when any file in it changed after it was taken", async () => {
    const t = setup();
    const found = await asked(t);
    whileLate(t, () => {
      const info = join(fromFinalCutFolder(t.home), `${PROJECT.main}.fcpxmld`, "Info.fcpxml");
      writeFileSync(info, "<fcpxml version=\"1.11\"/>\n");
      const when = new Date(t.now() + 60000);
      utimesSync(info, when, when);
    });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(existsSync(join(fromFinalCutFolder(t.home), `${PROJECT.main}.fcpxmld`, "Info.fcpxml")));
    t.done();
  });
  it("puts a copy that went missing back from what it took, never from a file made again since", async () => {
    const t = setup();
    const found = await asked(t);
    const copied = join(found.folder, "final", `${PROJECT.main}.mp4`);
    whileLate(t, () => {
      rmSync(copied);
      madeAgain(t, `${PROJECT.main}.mp4`);
    });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(readFileSync(copied, "utf8"), "a finished video");
    t.done();
  });
  it("checks the record it wrote at the late check too, and writes it again when Dropbox took it away", async () => {
    const t = setup();
    const found = await asked(t);
    whileLate(t, () => rmSync(recordFile(found.folder, found.record.rev + 1)));
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(reread(found).finished.revision, 1);
    t.done();
  });
  it("never puts its record back over one the other Mac wrote under the same number, and keeps From Final Cut", async () => {
    const t = setup();
    const found = await asked(t);
    const ours = recordFile(found.folder, found.record.rev + 1);
    const theirs = recordText({ ...found.record, rev: found.record.rev + 1, title: { text: "Their title", from: "person", approved: true } });
    whileLate(t, () => {
      rmSync(ours);
      writeFileSync(ours, theirs);
    });
    const result = await finishNow(t.ctx, found);
    assert.equal(readFileSync(ours, "utf8"), theirs);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /The episode's record no longer holds this finish: the other Mac changed it\. Say finish again\./);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5);
    t.done();
  });
  it("leaves its record alone when a higher one is there, and deletes from From Final Cut only when that one holds this finish", async () => {
    for (const [holds, kept] of [[false, 5], [true, 0]]) {
      const t = setup();
      const found = await asked(t);
      const ours = recordFile(found.folder, found.record.rev + 1);
      whileLate(t, () => {
        const written = JSON.parse(readFileSync(ours, "utf8"));
        rmSync(ours);
        writeFileSync(recordFile(found.folder, found.record.rev + 2), recordText({ ...(holds ? written : found.record), rev: found.record.rev + 2 }));
      });
      const result = await finishNow(t.ctx, found);
      assert.equal(existsSync(ours), false, "its own record is not put back under a higher one");
      assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, kept);
      assert.equal(result.ok, holds, result.failed.join(" "));
      t.done();
    }
  });
  it("keeps From Final Cut, and says to finish again, when Dropbox made a conflicted copy of its record", async () => {
    const t = setup();
    const found = await asked(t);
    const ours = recordFile(found.folder, found.record.rev + 1);
    whileLate(t, () => {
      const copy = ours.replace(/\.json$/, " (Sallie Ogden's conflicted copy 2026-10-20).json");
      writeFileSync(copy, readFileSync(ours, "utf8"));
      rmSync(ours);
      writeFileSync(ours, recordText({ ...found.record, rev: found.record.rev + 1 }));
    });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /Say finish again/);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5);
    t.done();
  });
  it("takes a video's facts from the copy it took, which is what goes into final/", async () => {
    const t = setup({ programs: { FFPROBE: (args) => {
      const file = args[args.length - 1];
      const taken = file.includes(`${runsFolder("")}`.replace(/^\//, "")) || file.includes("/.runs/");
      const shape = file.includes("reel") ? { width: 1080, height: 1920 } : { width: 1280, height: 720 };
      const seconds = file.includes("reel 2") ? 75 : file.includes("reel 1") ? 7.7 : taken ? 11.878 : 99;
      writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: shape, duration: seconds.toFixed(6) }));
      return { code: 0, stderr: "" };
    } } });
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.equal(JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8")).main.seconds, 11.878);
    t.done();
  });
  it("names its run folder with its process, so a run that died leaves nothing clearRuns keeps", async () => {
    const t = setup();
    const found = await asked(t);
    let seen = "";
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, more) => {
      if (cmd === "WHISPER" && !seen) seen = args[args.indexOf("-f") + 1];
      return run(cmd, args, more);
    };
    await finishNow(t.ctx, found);
    assert.match(seen, new RegExp(`/\\.runs/finish-${process.pid}-\\d+/`));
    const left = join(runsFolder(t.home), "finish-999999-1760000000000");
    mkdirSync(left, { recursive: true });
    assert.deepEqual(clearRuns(t.home, () => false), ["finish-999999-1760000000000"]);
    assert.equal(existsSync(left), false);
    t.done();
  });
  it("stops before it copies anything when a Share changed while it was being transcribed", async () => {
    let changed = false;
    let t = null;
    t = setup({ programs: { WHISPER: (args) => {
      if (!changed) {
        changed = true;
        madeAgain(t, `${PROJECT.main}.mp4`);
      }
      const base = args[args.indexOf("-of") + 1];
      writeFileSync(base + ".srt", SRT[partOf(args[args.indexOf("-f") + 1])] || SRT.main);
      return { code: 0, stderr: "" };
    } } });
    const found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /Pricing- what to charge- main v5 3fa9c1\.mp4 changed in From Final Cut while finish was working on it\. Say finish again\./);
    assert.deepEqual(t.inFinal(found), []);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5);
    t.done();
  });
  it("never deletes a part it took from what the other Mac released, nor another episode's Share", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    const released = join(found.folder, "edit", "from-final-cut");
    mkdirSync(released, { recursive: true });
    writeFileSync(join(released, `${PROJECT.main}.mp4`), "a finished video");
    mkdirSync(join(released, `${PROJECT.main}.fcpxmld`), { recursive: true });
    writeFileSync(join(released, `${PROJECT.main}.fcpxmld`, "Info.fcpxml"), "<fcpxml/>\n");
    const later = new Date(Date.parse("2026-10-20T14:00:05-05:00"));
    utimesSync(join(released, `${PROJECT.main}.fcpxmld`), later, later);
    t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
    t.shared("Another episode main v1 9a8b7c.mp4", 1000);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
    const result = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(existsSync(join(released, `${PROJECT.main}.mp4`)));
    assert.ok(existsSync(join(released, `${PROJECT.main}.fcpxmld`, "Info.fcpxml")));
    assert.deepEqual(readdirSync(fromFinalCutFolder(t.home)), ["Another episode main v1 9a8b7c.mp4"]);
    t.done();
  });
  it("never uses a hand-off's revision twice, even when the record of the last one was never written", async () => {
    let wrote = false;
    const t = setup();
    const found = await asked(t);
    // The other Mac writes the record after the hand-off is copied in, and before this Mac writes it.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!wrote && to.endsWith(HANDOFF)) {
        wrote = true;
        writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1 }));
      }
    };
    const first = await finishNow(t.ctx, found);
    assert.equal(first.ok, false);
    assert.equal(JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8")).revision, 1);
    const again = { ...found, record: reread(found) };
    assert.equal(await finishEpisode(t.ctx, again, { yes: true, noHandEdits: ["reel 2"] }), 0);
    const second = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(second.ok, true, second.failed.join(" "));
    assert.equal(JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8")).revision, 2);
    assert.equal(reread(found).finished.revision, 2);
    t.done();
  });
  it("copies the hand-off into final/ last, and writes the record by the rule", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    const intoFinal = t.clones.map(([, to]) => to).filter((to) => to.startsWith(join(found.folder, "final") + "/"));
    assert.equal(intoFinal[intoFinal.length - 1], join(found.folder, "final", HANDOFF));
    assert.ok(t.clones.some(([, to]) => to === recordFile(found.folder, found.record.rev + 1)));
    t.done();
  });
  it("forgets the Story parts and word times of an earlier cut of a part made again, and leaves their files", async () => {
    const t = setup();
    const found = await asked(t);
    await finishNow(t.ctx, found);
    t.shared(`${PROJECT["reel 2"]}.mov`, 9000, "a shorter finished Reel");
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, more) => {
      if (cmd === "FFPROBE" && args[args.length - 1].includes(PROJECT["reel 2"])) {
        writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: { width: 1080, height: 1920 }, duration: "50.000000" }));
        return { code: 0, stderr: "" };
      }
      if (cmd === "WHISPER" && args.includes("-ojf") && partOf(args[args.indexOf("-f") + 1]) === "reel 2") return { code: 134, stderr: "", signal: "SIGABRT" };
      return run(cmd, args, more);
    };
    assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true, noHandEdits: ["reel 2"] }), 0);
    const result = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    const record = reread(found);
    for (const stale of [`${PROJECT["reel 2"]}.story-1.mp4`, `${PROJECT["reel 2"]}.story-2.mp4`, `${PROJECT["reel 2"]}.words.json`]) {
      assert.equal(`final/${stale}` in record.files, false, stale);
      assert.ok(existsSync(join(found.folder, "final", stale)), stale);
    }
    assert.equal(record.finished.parts["reel 2"].words, undefined);
    assert.equal(record.finished.parts["reel 2"].seconds, 50);
    t.done();
  });
  it("refuses to start when the episode changed since finish was asked, and copies nothing", async () => {
    const t = setup();
    const found = await asked(t);
    writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed[0], /The episode changed since finish was asked\. Say finish again\./);
    assert.deepEqual(t.inFinal(found), []);
    t.done();
  });
  it("copies nothing into final/ and leaves the record alone when the other Mac changes the episode while it works", async () => {
    let wrote = false;
    let t = null;
    let found = null;
    t = setup({ programs: { WHISPER: (args) => {
      if (!wrote && found) {
        wrote = true;
        writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
      }
      const base = args[args.indexOf("-of") + 1];
      const srt = SRT[partOf(args[args.indexOf("-f") + 1])] || SRT.main;
      writeFileSync(base + ".srt", srt);
      return { code: 0, stderr: "" };
    } } });
    found = await asked(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.match(result.failed.join(" "), /The episode changed while finish was working, so nothing was copied into final\/\. Say finish again\./);
    assert.ok(!existsSync(join(found.folder, "final")));
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), [], "the hand-off is not shown when the record was not written");
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5, "From Final Cut keeps every file");
    t.done();
  });
});

// Revisions only rise (spec 2026-10-22, sections 1 and 8): a video's id, and the revision of each hand-off written for it, are
// counted across both hand-off versions, across the episodes that are new versions of it, and across the hand-offs set aside into
// history/. The hand-offs here are the contract fixtures with the id and revision laid over them; the page refuses one at or
// below what it holds, so a number is never used twice.
const FIXTURE = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const V1 = FIXTURE("handoff-v1");
const V2 = { finished: FIXTURE("handoff-v2-finished"), session: FIXTURE("handoff-v2-session") };
/** A hand-off of version 1 or 2 for the video `id`, at `revision`. */
const handoffOf = (version, id, revision, kind = "finished") => (version === 1 ? { ...V1, revision, episode: { ...V1.episode, id } } : { ...V2[kind], revision, video: { ...V2[kind].video, id } });
/** Put a hand-off at a path from an episode's folder. */
const lay = (folder, rel, handoff) => {
  mkdirSync(dirname(join(folder, rel)), { recursive: true });
  writeFileSync(join(folder, rel), JSON.stringify(handoff, null, 2) + "\n");
};
/** The id of a video's first version, and of two new versions of it. */
const SECOND = "e-20261020-5b2e77";
const THIRD = "e-20261022-9d41a0";
/** The made-up episode (ID) as an answered finished video, and one that is a new version of the episode `of`. */
const original = (t, record = {}) => episodeAs(t, { id: ID, name: "2026-10-14 Pricing talk (Mac Studio)", record: { kind: "finished", ...record } });
const later = (t, id, of, record = {}) => episodeAs(t, { id, name: `${id} Pricing talk, again (Mac Studio)`, record: { kind: "finished", versionOf: of, ...record } });

describe("lastRevision", () => {
  it("counts a version 1 hand-off by its episode.id and a version 2 one by its video.id, and no other video's", () => {
    const t = setup();
    const found = original(t);
    const final = join(found.folder, "final");
    assert.equal(lastRevision(final, ID), 0, "there is no final/ yet");
    lay(found.folder, "final/a.brimm-ops.json", handoffOf(1, ID, 2));
    assert.equal(lastRevision(final, ID), 2);
    lay(found.folder, "final/b.brimm-ops.json", handoffOf(2, ID, 5));
    assert.equal(lastRevision(final, ID), 5);
    lay(found.folder, "final/c.brimm-ops.json", handoffOf(2, SECOND, 9));
    lay(found.folder, "final/d.brimm-ops.json", handoffOf(1, SECOND, 11));
    assert.equal(lastRevision(final, ID), 5, "another video's hand-offs are not counted");
    assert.equal(lastRevision(final, SECOND), 11);
    t.done();
  });
  it("passes over a file that is not a hand-off, one that cannot be read and a revision that is not a whole number", () => {
    const t = setup();
    const found = original(t);
    const final = join(found.folder, "final");
    lay(found.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 2));
    lay(found.folder, "final/notes.json", handoffOf(2, ID, 8));
    writeFileSync(join(final, "broken.brimm-ops.json"), "{ not json");
    lay(found.folder, "final/odd.brimm-ops.json", { ...handoffOf(2, ID, 3), revision: "7" });
    lay(found.folder, "final/none.brimm-ops.json", { format: "brimm-video hand-off" });
    mkdirSync(join(final, "folder.brimm-ops.json"));
    assert.equal(lastRevision(final, ID), 2);
    t.done();
  });
  it("counts the hand-offs set aside into the episode's history/, at any depth, beside the ones in final/", () => {
    const t = setup();
    const found = original(t);
    const final = join(found.folder, "final");
    lay(found.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    lay(found.folder, "history/2026-10-23 10.00 a.brimm-ops.json", handoffOf(1, ID, 4));
    lay(found.folder, "history/2026-10-23 10.05/final/b.brimm-ops.json", handoffOf(2, ID, 6, "session"));
    lay(found.folder, "history/2026-10-23 10.05/final/c.brimm-ops.json", handoffOf(2, SECOND, 9));
    lay(found.folder, "history/2026-10-23 10.05/final/notes.txt", handoffOf(2, ID, 12));
    assert.equal(lastRevision(final, ID), 6);
    rmSync(final, { recursive: true });
    assert.equal(lastRevision(final, ID), 6, "with no final/ at all, history/ still counts");
    assert.equal(lastRevision(final, THIRD), 0);
    t.done();
  });
  it("passes over only a folder of history/ that cannot be read, and counts the rest", () => {
    const t = setup();
    const found = original(t);
    const final = join(found.folder, "final");
    lay(found.folder, "history/a/x.brimm-ops.json", handoffOf(2, ID, 7));
    lay(found.folder, "history/b/y.brimm-ops.json", handoffOf(2, ID, 9));
    lay(found.folder, "history/c/d/z.brimm-ops.json", handoffOf(1, ID, 4));
    const locked = join(found.folder, "history", "b");
    chmodSync(locked, 0o000);
    try {
      assert.equal(lastRevision(final, ID), 7, "the unreadable folder is passed over and every other hand-off still counts");
      chmodSync(join(found.folder, "history", "a"), 0o000);
      assert.equal(lastRevision(final, ID), 4, "each unreadable folder only loses its own");
    } finally {
      chmodSync(locked, 0o755);
      chmodSync(join(found.folder, "history", "a"), 0o755);
    }
    assert.equal(lastRevision(final, ID), 9, "readable again, it counts");
    t.done();
  });
});

describe("the chain of a video's versions", () => {
  it("is the episode alone when it is not a new version of any, and its own id is the hand-off's", () => {
    const t = setup();
    const found = original(t);
    assert.deepEqual(chainOf(t.root, found.record, found.folder), [{ folder: found.folder, record: found.record }]);
    assert.deepEqual(chainOf(t.root, found.record), [{ folder: found.folder, record: found.record }], "the folder is found by the id when it is not given");
    assert.equal(handoffIdOf(t.root, found.record), ID);
    t.done();
  });
  it("runs from a new version to the episode it is a version of, and the hand-off's id is the first's", () => {
    const t = setup();
    const old = original(t);
    const next = later(t, SECOND, ID);
    assert.deepEqual(chainOf(t.root, next.record, next.folder), [{ folder: next.folder, record: next.record }, { folder: old.folder, record: old.record }]);
    assert.equal(handoffIdOf(t.root, next.record), ID);
    t.done();
  });
  it("runs through every version of a video, and the id is the first version's", () => {
    const t = setup();
    const old = original(t);
    const middle = later(t, SECOND, ID);
    const newest = later(t, THIRD, SECOND);
    assert.deepEqual(chainOf(t.root, newest.record, newest.folder).map((link) => link.folder), [newest.folder, middle.folder, old.folder]);
    assert.equal(handoffIdOf(t.root, newest.record), ID);
    assert.equal(handoffIdOf(t.root, middle.record), ID);
    t.done();
  });
  it("is read from an episode that Dropbox has kept a conflicted copy in, which is only read", () => {
    const t = setup();
    const old = original(t);
    writeFileSync(join(old.folder, "Pricing talk (Sallie's conflicted copy 2026-10-20).txt"), "a note");
    const next = later(t, SECOND, ID);
    assert.deepEqual(chainOf(t.root, next.record, next.folder).map((link) => link.folder), [next.folder, old.folder]);
    t.done();
  });
  it("follows versionOf only from an answered record: an unanswered one's chain is itself", () => {
    const t = setup();
    original(t);
    const waiting = { kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10", came: "camera" }, versionOf: ID };
    const unanswered = later(t, SECOND, ID, waiting);
    assert.equal(unanswered.record.versionOf, ID, "the record holds the link, and the chain does not follow it");
    assert.deepEqual(chainOf(t.root, unanswered.record, unanswered.folder), [{ folder: unanswered.folder, record: unanswered.record }]);
    assert.equal(handoffIdOf(t.root, unanswered.record), SECOND);
    // An answered version stops at an unanswered record it points to.
    const asked = episodeAs(t, { id: THIRD, name: "2026-10-22 Waiting (Mac Studio)", record: { ...waiting, versionOf: SECOND } });
    const answered = episodeAs(t, { id: "e-20261023-0a0a0a", name: "2026-10-23 Answered (Mac Studio)", record: { kind: "raw", versionOf: THIRD } });
    assert.deepEqual(chainOf(t.root, answered.record, answered.folder).map((link) => link.folder), [answered.folder, asked.folder]);
    assert.equal(handoffIdOf(t.root, answered.record), THIRD);
    t.done();
  });
  it("ends where an episode cannot be read on this Mac, and the id is the last one the records name", () => {
    const t = setup();
    const next = later(t, SECOND, ID);
    assert.deepEqual(chainOf(t.root, next.record, next.folder), [{ folder: next.folder, record: next.record }]);
    assert.equal(handoffIdOf(t.root, next.record), ID);
    t.done();
  });
  it("ends where two episodes name each other, and does not go round", () => {
    const t = setup();
    const one = original(t, { versionOf: SECOND });
    const two = later(t, SECOND, ID);
    assert.deepEqual(chainOf(t.root, two.record, two.folder).map((link) => link.folder), [two.folder, one.folder]);
    assert.deepEqual(chainOf(t.root, one.record, one.folder).map((link) => link.folder), [one.folder, two.folder]);
    assert.equal(typeof handoffIdOf(t.root, two.record), "string");
    t.done();
  });
});

describe("a gap in the chain of a video's versions", () => {
  it("is none for an episode alone, for a whole chain, and for an unanswered record whose link points nowhere", () => {
    const t = setup();
    const old = original(t);
    assert.equal(chainGap(t.root, old.record), null, "an answered episode with no versionOf");
    const middle = later(t, SECOND, ID);
    const newest = later(t, THIRD, SECOND);
    assert.equal(chainGap(t.root, newest.record), null, "every link is on this Mac");
    assert.equal(chainGap(t.root, middle.record), null);
    const waiting = { kind: null, answer: { state: "needs your answer", guess: null, seen: "", came: null } };
    const lost = episodeAs(t, { id: "e-20261024-0b0b0b", name: "2026-10-24 Waiting (Mac Studio)", record: { ...waiting, versionOf: "e-20260101-000000" } });
    assert.equal(lost.record.versionOf, "e-20260101-000000");
    assert.equal(chainGap(t.root, lost.record), null, "the walk does not follow an unanswered record, so nothing is missing");
    t.done();
  });
  it("is the id of the middle episode, missing, when its folder is not on this Mac, and the first is not looked for past it", () => {
    const t = setup();
    original(t);
    const middle = later(t, SECOND, ID);
    const newest = later(t, THIRD, SECOND);
    rmSync(middle.folder, { recursive: true });
    assert.deepEqual(chainGap(t.root, newest.record), { id: SECOND, reason: "missing" });
    assert.deepEqual(chainOf(t.root, newest.record, newest.folder).map((link) => link.folder), [newest.folder]);
    t.done();
  });
  it("is the first version, missing, when a new version's old folder is not on this Mac", () => {
    const t = setup();
    const next = later(t, SECOND, ID);
    assert.deepEqual(chainGap(t.root, next.record), { id: ID, reason: "missing" });
    // A folder with no whole record, as an import not finished, is not there either.
    const unfinished = join(t.root, "Episodes", "2026-10-14 Pricing talk (Mac Studio)");
    mkdirSync(unfinished, { recursive: true });
    assert.deepEqual(chainGap(t.root, next.record), { id: ID, reason: "missing" });
    original(t);
    assert.equal(chainGap(t.root, next.record), null, "once Dropbox has brought it, there is no gap");
    t.done();
  });
  it("is a loop, from either end, with the id that is seen again", () => {
    const t = setup();
    const one = original(t, { versionOf: SECOND });
    const two = later(t, SECOND, ID);
    assert.deepEqual(chainGap(t.root, two.record), { id: SECOND, reason: "loop" });
    assert.deepEqual(chainGap(t.root, one.record), { id: ID, reason: "loop" });
    t.done();
  });
  it("is a loop for an episode that says it is a version of itself", () => {
    const t = setup();
    const own = original(t, { versionOf: ID });
    assert.deepEqual(chainGap(t.root, own.record), { id: ID, reason: "loop" });
    t.done();
  });
});

describe("the next revision of a video", () => {
  it("is 1 for an episode never handed off, and one above its record's last finish when final/ holds none", () => {
    const t = setup();
    const found = original(t);
    assert.equal(nextRevision(t.root, found), 1);
    const finished = { ...found.record, finished: { revision: 2, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio" } };
    assert.equal(nextRevision(t.root, { ...found, record: finished }), 3);
    t.done();
  });
  it("is one above the highest hand-off in final/ of either version, even when the record never said it", () => {
    const t = setup();
    const found = original(t);
    lay(found.folder, "final/a.brimm-ops.json", handoffOf(1, ID, 2));
    assert.equal(nextRevision(t.root, found), 3);
    lay(found.folder, "final/b.brimm-ops.json", handoffOf(2, ID, 4));
    assert.equal(nextRevision(t.root, found), 5);
    t.done();
  });
  it("is, for a new version whose old folder's final/ holds revision 3, 4, and the hand-off's id is the old one's", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    const next = later(t, SECOND, ID);
    assert.equal(nextRevision(t.root, next), 4);
    assert.equal(handoffIdOf(t.root, next.record), ID);
    // The new version's own final/ counts too, for the first id; a hand-off of its own id does not.
    lay(next.folder, "final/b.brimm-ops.json", handoffOf(2, ID, 4));
    lay(next.folder, "final/c.brimm-ops.json", handoffOf(1, SECOND, 9));
    assert.equal(nextRevision(t.root, next), 5);
    t.done();
  });
  it("counts the revisions every record of the chain says it finished, when final/ has been cleared", () => {
    const t = setup();
    original(t, { finished: { revision: 6, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio" } });
    const middle = later(t, SECOND, ID, { finished: { revision: 7, at: "2026-10-21T10:00:00-05:00", on: "Mac Studio" } });
    const newest = later(t, THIRD, SECOND);
    assert.equal(nextRevision(t.root, newest), 8);
    assert.equal(nextRevision(t.root, middle), 8);
    t.done();
  });
  it("counts the hand-offs set aside into history/ of every episode of the chain", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "history/2026-10-21 09.00/final/a.brimm-ops.json", handoffOf(1, ID, 5));
    const middle = later(t, SECOND, ID);
    lay(middle.folder, "history/2026-10-22 09.00 b.brimm-ops.json", handoffOf(2, ID, 7));
    const newest = later(t, THIRD, SECOND);
    assert.equal(nextRevision(t.root, newest), 8);
    t.done();
  });
  it("takes nothing from the old episodes for one that is not yet answered", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    const waiting = later(t, SECOND, ID, { kind: null, answer: { state: "needs your answer", guess: null, seen: "", came: null } });
    assert.equal(nextRevision(t.root, waiting), 1);
    assert.equal(handoffIdOf(t.root, waiting.record), SECOND);
    t.done();
  });
  it("counts the hand-offs a later version of the video has in its folder, for the first id, so an old version handed off again rises above them", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 1));
    const next = later(t, SECOND, ID);
    lay(next.folder, "final/b.brimm-ops.json", handoffOf(2, ID, 2));
    assert.equal(handoffIdOf(t.root, old.record), ID);
    assert.equal(nextRevision(t.root, old), 3, "the old version, handed off again, is above the new version's hand-off");
    assert.equal(nextRevision(t.root, next), 3);
    // Through another version, and in history/ of the newest.
    const newest = later(t, THIRD, SECOND);
    lay(newest.folder, "history/c.brimm-ops.json", handoffOf(1, ID, 6));
    assert.equal(nextRevision(t.root, old), 7);
    assert.equal(nextRevision(t.root, next), 7);
    assert.equal(nextRevision(t.root, newest), 7);
    t.done();
  });
  it("counts the revisions a later version's record says it finished, directly or through others, when final/ has been cleared", () => {
    const t = setup();
    const old = original(t);
    const middle = later(t, SECOND, ID, { finished: { revision: 4, at: "2026-10-21T10:00:00-05:00", on: "Mac Studio" } });
    later(t, THIRD, SECOND, { finished: { revision: 6, at: "2026-10-22T10:00:00-05:00", on: "Mac Studio" } });
    assert.equal(nextRevision(t.root, old), 7);
    assert.equal(nextRevision(t.root, middle), 7);
    t.done();
  });
  it("takes nothing from another video: not a hand-off under its own id, and not the finishes of an episode that is a version of something else", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 1));
    const next = later(t, SECOND, ID);
    lay(next.folder, "final/b.brimm-ops.json", handoffOf(2, ID, 2));
    assert.equal(nextRevision(t.root, old), 3);
    const other = episodeAs(t, { id: THIRD, name: "2026-10-22 Another talk (Mac Studio)", record: { kind: "finished", finished: { revision: 8, at: "2026-10-22T10:00:00-05:00", on: "Mac Studio" } } });
    lay(other.folder, "final/c.brimm-ops.json", handoffOf(2, THIRD, 9));
    lay(other.folder, "history/d.brimm-ops.json", handoffOf(1, THIRD, 10));
    const aside = episodeAs(t, { id: "e-20261023-0a0a0a", name: "2026-10-23 A version of that (Mac Studio)", record: { kind: "finished", versionOf: THIRD, finished: { revision: 11, at: "2026-10-23T10:00:00-05:00", on: "Mac Studio" } } });
    lay(aside.folder, "final/e.brimm-ops.json", handoffOf(2, THIRD, 12));
    assert.equal(nextRevision(t.root, old), 3, "the other video's revisions are its own");
    assert.equal(nextRevision(t.root, next), 3);
    assert.equal(nextRevision(t.root, other), 13, "and they count for it, with its version's");
    t.done();
  });
  it("is the same for a record alone as for the record with its folder", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    lay(old.folder, "history/b.brimm-ops.json", handoffOf(1, ID, 5));
    const next = later(t, SECOND, ID);
    lay(next.folder, "final/c.brimm-ops.json", handoffOf(2, ID, 6));
    lay(next.folder, "history/2026-10-23 09.00/d.brimm-ops.json", handoffOf(2, ID, 8));
    for (const found of [old, next]) assert.equal(nextRevision(t.root, { record: found.record }), nextRevision(t.root, found));
    assert.equal(nextRevision(t.root, { record: old.record }), 9);
    assert.equal(nextRevision(t.root, { record: next.record }), 9);
    t.done();
  });
  it("rises through a finished video, a session that replaces it, and a finished video again after the session is cleared", () => {
    const t = setup();
    const found = original(t);
    const final = (name) => `final/${name}.brimm-ops.json`;
    const set = [];
    const next = () => {
      const n = nextRevision(t.root, found);
      assert.ok(set.every((earlier) => n > earlier), `revision ${n} is above every one before it: ${set.join(", ")}`);
      set.push(n);
      return n;
    };
    // Finished: revision 1.
    const one = next();
    lay(found.folder, final("Pricing"), handoffOf(2, ID, one));
    // Answered as a session: the finished hand-off is set aside into history/ first, and the session's revision is the next.
    mkdirSync(join(found.folder, "history", "2026-10-23 10.00"), { recursive: true });
    renameSync(join(found.folder, final("Pricing")), join(found.folder, "history", "2026-10-23 10.00", "Pricing.brimm-ops.json"));
    assert.deepEqual(readdirSync(join(found.folder, "final")), []);
    const two = next();
    lay(found.folder, final("Session, 2026-10-14"), handoffOf(2, ID, two, "session"));
    // Cleared: the session's hand-off is set aside too, final/ holds none, and the next is above both.
    mkdirSync(join(found.folder, "history", "2026-10-23 10.30"), { recursive: true });
    renameSync(join(found.folder, final("Session, 2026-10-14")), join(found.folder, "history", "2026-10-23 10.30", "Session, 2026-10-14.brimm-ops.json"));
    assert.deepEqual(readdirSync(join(found.folder, "final")), []);
    const three = next();
    assert.deepEqual([one, two, three], [1, 2, 3]);
    lay(found.folder, final("Pricing"), handoffOf(2, ID, three));
    assert.equal(nextRevision(t.root, found), 4);
    t.done();
  });
});

describe("reading the chain", () => {
  it("writes nothing and calls nothing: no file, no clone, no program", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    lay(old.folder, "history/a.brimm-ops.json", handoffOf(1, ID, 2));
    const next = later(t, SECOND, ID);
    const tree = () => listAll(t.dir).map((rel) => [rel, statSync(join(t.dir, rel)).size, statSync(join(t.dir, rel)).mtimeMs]);
    const before = tree();
    assert.equal(chainOf(t.root, next.record).length, 2);
    assert.equal(handoffIdOf(t.root, next.record), ID);
    assert.equal(chainGap(t.root, next.record), null);
    assert.equal(nextRevision(t.root, next), 4);
    assert.equal(lastRevision(join(old.folder, "final"), ID), 3);
    assert.deepEqual(tree(), before, "every file as it was, and none added");
    assert.deepEqual(t.clones, []);
    assert.deepEqual(t.calls, []);
    assert.deepEqual(t.opened, []);
    t.done();
  });
});

// One small, read-only helper over the walk and the set (finish.js linksOf), which edit.js reads a video's links through when
// she answers "what is this video?": the chain of a record, the id its chain starts from, the set of every record whose walk ends
// at an id, and the handed-off records whose chain passes through an id. It reads Episodes once, for all of them.
describe("linksOf: a video's links, from one reading of Episodes", () => {
  /** The ids of some records, or of some { folder, record } pairs, sorted. */
  const idsOf = (list) => list.map((one) => (one.record || one).id).sort();
  /** A hand-off for the id in the folder's final/ (or in its history/ when `where` says so). */
  const handOff = (found, id, where = "final") => lay(found.folder, `${where}/${id}.brimm-ops.json`, handoffOf(2, id, 1));
  /** The video ID answered, SECOND a new version of it, THIRD a new version of that, beside a video that is not one of them. */
  function versions(t) {
    const old = original(t);
    const middle = later(t, SECOND, ID);
    const newest = later(t, THIRD, SECOND);
    const apart = episodeAs(t, { id: "e-20261001-aaaaaa", name: "2026-10-01 Another talk (Mac Studio)", record: { kind: "finished" } });
    return { old, middle, newest, apart };
  }
  it("gives the chain of a record as chainOf gives it, the folder found by the id when it is not given, and the first id as handoffIdOf does", () => {
    const t = setup();
    const { old, middle, newest, apart } = versions(t);
    const links = linksOf(t.root);
    for (const one of [old, middle, newest, apart]) {
      assert.deepEqual(links.chainOf(one.record), chainOf(t.root, one.record), one.record.id);
      assert.deepEqual(links.chainOf(one.record, one.folder), chainOf(t.root, one.record, one.folder), one.record.id);
      assert.equal(links.firstOf(one.record), handoffIdOf(t.root, one.record), one.record.id);
    }
    assert.deepEqual(links.chainOf(newest.record).map((link) => link.record.id), [THIRD, SECOND, ID]);
    assert.equal(links.firstOf(newest.record), ID);
    assert.deepEqual(links.find(SECOND), { folder: middle.folder, record: middle.record });
    assert.equal(links.find("e-20269999-ffffff"), undefined);
    t.done();
  });
  it("gives the set of an id: every record whose walk ends at it, the first's own included, and the folders whose hand-offs are read for it", () => {
    const t = setup();
    const { old, middle, newest, apart } = versions(t);
    // A folder with no whole record yet (Dropbox is still bringing it over) may be a version of it.
    const coming = join(t.root, "Episodes", "2026-10-21 Pricing talk, coming (Mac Studio)");
    mkdirSync(coming, { recursive: true });
    const set = linksOf(t.root).setOf(ID);
    assert.deepEqual(idsOf(set.members), [ID, SECOND, THIRD].sort());
    assert.deepEqual([...set.folders].sort(), [old.folder, middle.folder, newest.folder, coming].sort());
    assert.ok(!set.folders.has(apart.folder));
    // It is the set the hand-off writers read, for the same id.
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    assert.equal(nextRevision(t.root, middle), 4);
    assert.deepEqual(idsOf(linksOf(t.root).setOf(apart.record.id).members), [apart.record.id]);
    assert.deepEqual(linksOf(t.root).setOf("e-20269999-ffffff").members, []);
    t.done();
  });
  it("gives the set of an id that is not on this Mac: the records whose walk ends at it", () => {
    const t = setup();
    const next = later(t, SECOND, ID);
    const links = linksOf(t.root);
    assert.equal(links.firstOf(next.record), ID);
    assert.deepEqual(idsOf(links.setOf(ID).members), [SECOND]);
    t.done();
  });
  it("gives the handed-off records whose chain passes through an id, itself included: by the record, by a hand-off in final/, and by one in history/", () => {
    const t = setup();
    const { old, middle, newest, apart } = versions(t);
    const links = () => linksOf(t.root);
    assert.deepEqual(links().handedOffThrough(ID), [], "nothing was handed off");
    // The newest version was finished; its chain passes through all three.
    writeFileSync(recordFile(newest.folder, 2), recordText({ ...newest.record, rev: 2, finished: { revision: 1, at: "2026-10-22T10:00:00-05:00", on: "Mac Studio" } }));
    for (const id of [ID, SECOND, THIRD]) assert.deepEqual(idsOf(links().handedOffThrough(id)), [THIRD], id);
    assert.deepEqual(links().handedOffThrough(apart.record.id), []);
    // The middle one has a hand-off in its final/, and the first in its history/, at any depth.
    handOff(middle, SECOND);
    assert.deepEqual(idsOf(links().handedOffThrough(SECOND)), [SECOND, THIRD].sort());
    assert.deepEqual(idsOf(links().handedOffThrough(THIRD)), [THIRD]);
    lay(old.folder, "history/2026-10-21 09.00/final/b.brimm-ops.json", handoffOf(2, ID, 1));
    assert.deepEqual(idsOf(links().handedOffThrough(ID)), [ID, SECOND, THIRD].sort());
    // Each as { folder, record }, the record as Episodes holds it.
    assert.deepEqual(links().handedOffThrough(ID).find((one) => one.record.id === SECOND), { folder: middle.folder, record: middle.record });
    t.done();
  });
  it("counts a hand-off by its file's name alone, even one that cannot be read, and not a final/ that holds only other files", () => {
    const t = setup();
    const { old, middle } = versions(t);
    mkdirSync(join(middle.folder, "final"), { recursive: true });
    writeFileSync(join(middle.folder, "final", "Talk.mp4"), "a video");
    writeFileSync(join(middle.folder, "final", "Talk.srt"), "1\n");
    assert.deepEqual(linksOf(t.root).handedOffThrough(ID), []);
    mkdirSync(join(old.folder, "final"), { recursive: true });
    writeFileSync(join(old.folder, "final", "broken.brimm-ops.json"), "{ not json");
    assert.deepEqual(idsOf(linksOf(t.root).handedOffThrough(ID)), [ID]);
    t.done();
  });
  it("follows a link only from an answered record, as the chain does: an unanswered record's chain is itself", () => {
    const t = setup();
    original(t);
    const waiting = { kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10", came: "camera" }, versionOf: ID, finished: { revision: 1, at: "2026-10-22T10:00:00-05:00", on: "Mac Studio" } };
    later(t, SECOND, ID, waiting);
    assert.deepEqual(linksOf(t.root).handedOffThrough(ID), []);
    assert.deepEqual(idsOf(linksOf(t.root).handedOffThrough(SECOND)), [SECOND]);
    t.done();
  });
  it("gives every episode whose chain passes through an id, itself included, whether handed off or not; handedOffThrough is those that were", () => {
    const t = setup();
    const { middle, newest, apart } = versions(t);
    const links = () => linksOf(t.root);
    assert.deepEqual(idsOf(links().throughOf(ID)), [ID, SECOND, THIRD].sort());
    assert.deepEqual(idsOf(links().throughOf(SECOND)), [SECOND, THIRD].sort());
    assert.deepEqual(idsOf(links().throughOf(THIRD)), [THIRD]);
    assert.deepEqual(idsOf(links().throughOf(apart.record.id)), [apart.record.id]);
    assert.deepEqual(links().throughOf("e-20269999-ffffff"), []);
    assert.deepEqual(links().throughOf(SECOND).find((one) => one.record.id === THIRD), { folder: newest.folder, record: newest.record });
    // Only the ones handed off are handedOffThrough's.
    handOff(middle, SECOND);
    assert.deepEqual(idsOf(links().handedOffThrough(ID)), [SECOND]);
    assert.deepEqual(links().handedOffThrough(ID), links().throughOf(ID).filter((one) => handedOff(one.folder, one.record)));
    // An unanswered record's chain is itself.
    const waiting = { kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10", came: "camera" }, versionOf: ID };
    later(t, "e-20261023-0a0a0a", ID, waiting);
    assert.deepEqual(idsOf(links().throughOf(ID)), [ID, SECOND, THIRD].sort(), "an unanswered record with a versionOf is not on the chain");
    t.done();
  });
  it("gives the gap in a record's chain, as chainGap does: a loop, an episode not on this Mac, or none", () => {
    const t = setup();
    original(t, { versionOf: SECOND });
    const two = later(t, SECOND, ID);
    assert.deepEqual(linksOf(t.root).gapOf(two.record), chainGap(t.root, two.record));
    assert.deepEqual(linksOf(t.root).gapOf(two.record, two.folder), { id: SECOND, reason: "loop" });
    const lone = episodeAs(t, { id: THIRD, name: "2026-10-22 Pricing talk, apart (Mac Studio)", record: { kind: "finished", versionOf: "e-20261001-aaaaaa" } });
    assert.deepEqual(linksOf(t.root).gapOf(lone.record), { id: "e-20261001-aaaaaa", reason: "missing" });
    assert.equal(linksOf(t.root).gapOf(episodeAs(t, { id: "e-20261023-0b0b0b", name: "2026-10-23 Whole (Mac Studio)", record: { kind: "finished" } }).record), null);
    t.done();
  });
  describe("holdsSession: a member, or any conflicted copy of its record, that is a session not cleared", () => {
    const MARK = { marked: "2026-10-22T10:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
    const CLEARED = { ...MARK, cleared: { at: "2026-10-22T11:00:00-05:00", on: "Mac Studio", to: "finished", confirmed: "dialog" } };
    /** A conflicted copy of the episode's first record, holding `over` on it. */
    const copyOf = (found, over, name = "record/0001 (Sallie's laptop's conflicted copy 2026-10-20).json") => writeFileSync(join(found.folder, name), recordText({ ...found.record, ...over }));
    const held = (t, found) => linksOf(t.root).holdsSession(linksOf(t.root).find(found.record.id));
    it("is true for a session by its kind, and by its mark of another kind, and false for one cleared by her click, and for any other video", () => {
      for (const [what, over, want] of [["its kind, no mark", { kind: "session" }, true], ["its kind, a mark", { kind: "session", session: MARK }, true], ["its mark, another kind", { kind: "short video", session: MARK }, true], ["a mark cleared by her click", { kind: "finished", session: CLEARED }, false], ["no mark", { kind: "raw" }, false]]) {
        const t = setup();
        const found = original(t, over);
        assert.equal(held(t, found), want, what);
        t.done();
      }
    });
    it("is false for a video not yet answered, which is not a session", () => {
      const t = setup();
      const found = original(t, { kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10", came: "camera" } });
      assert.equal(held(t, found), false);
      t.done();
    });
    it("is true when a conflicted copy of its record holds the mark, as the gate holds a video by any of its copies, and false for a copy that is none", () => {
      const t = setup();
      const found = original(t);
      assert.equal(held(t, found), false);
      copyOf(found, { kind: "raw" }, "record/0001 (Sallie's laptop's conflicted copy 2026-10-19).json");
      assert.equal(held(t, found), false, "a copy that is not a session");
      copyOf(found, { kind: "finished", session: MARK });
      assert.equal(held(t, found), true);
      // A conflicted copy of another file of the episode says nothing of the record.
      const u = setup();
      const other = original(u);
      writeFileSync(join(other.folder, "Pricing talk (Sallie's conflicted copy 2026-10-20).txt"), "a note");
      assert.equal(held(u, other), false);
      t.done();
      u.done();
    });
    it("reads a copy once, however often it is asked", () => {
      const t = setup();
      const found = original(t);
      copyOf(found, { kind: "raw" });
      const real = fs.readFileSync;
      const reads = [];
      fs.readFileSync = (path, ...rest) => {
        if (String(path).includes("conflicted copy")) reads.push(String(path));
        return real(path, ...rest);
      };
      syncBuiltinESMExports();
      try {
        const links = linksOf(t.root);
        const one = links.find(ID);
        links.holdsSession(one);
        links.holdsSession(one);
        assert.equal(reads.length, 1);
      } finally {
        fs.readFileSync = real;
        syncBuiltinESMExports();
      }
      t.done();
    });
  });
  it("reads each record once for all of them, and writes and calls nothing", () => {
    const t = setup();
    const { old, middle, newest } = versions(t);
    handOff(middle, SECOND);
    const tree = () => listAll(t.dir).map((rel) => [rel, statSync(join(t.dir, rel)).size, statSync(join(t.dir, rel)).mtimeMs]);
    const before = tree();
    const real = fs.readFileSync;
    const reads = [];
    fs.readFileSync = (path, ...rest) => {
      if (String(path).includes("/record/")) reads.push(String(path));
      return real(path, ...rest);
    };
    syncBuiltinESMExports();
    try {
      const links = linksOf(t.root);
      links.setOf(ID);
      const once = reads.length;
      assert.ok(once >= 3, "the first reading reads every record");
      links.chainOf(newest.record);
      links.chainOf(old.record, old.folder);
      links.firstOf(newest.record);
      links.handedOffThrough(ID);
      links.handedOffThrough(SECOND);
      links.find(THIRD);
      links.setOf(THIRD);
      assert.equal(reads.length, once, "no record was read again");
    } finally {
      fs.readFileSync = real;
      syncBuiltinESMExports();
    }
    assert.deepEqual(tree(), before, "every file as it was, and none added");
    assert.deepEqual([t.clones, t.calls, t.opened], [[], [], []]);
    t.done();
  });
  it("reads Episodes only when a link is to be followed: none for a record that names no version", () => {
    const t = setup();
    const old = original(t);
    const real = fs.readdirSync;
    const looked = [];
    fs.readdirSync = (path, ...rest) => {
      looked.push(String(path));
      return real(path, ...rest);
    };
    syncBuiltinESMExports();
    try {
      const links = linksOf(t.root);
      links.chainOf(old.record, old.folder);
      links.firstOf(old.record, old.folder);
      assert.deepEqual(looked, []);
    } finally {
      fs.readdirSync = real;
      syncBuiltinESMExports();
    }
    t.done();
  });
});

describe("handedOff: a video that went to the BRIMM Ops page", () => {
  it("is one whose record says it was finished, or that has a hand-off in its final/ or at any depth in its history/", () => {
    const t = setup();
    const found = original(t);
    assert.equal(handedOff(found.folder, found.record), false);
    assert.equal(handedOff(found.folder, { ...found.record, finished: { revision: 1 } }), true);
    for (const rel of ["final/Talk.brimm-ops.json", "history/Talk.brimm-ops.json", "history/2026-10-20 15-00/final/Talk.brimm-ops.json"]) {
      const u = setup();
      const there = original(u);
      lay(there.folder, rel, handoffOf(2, ID, 1));
      assert.equal(handedOff(there.folder, there.record), true, rel);
      u.done();
    }
    for (const rel of ["final/Talk.srt", "history/Talk.mov", "Talk.brimm-ops.json"]) {
      const u = setup();
      const there = original(u);
      mkdirSync(dirname(join(there.folder, rel)), { recursive: true });
      writeFileSync(join(there.folder, rel), "x");
      assert.equal(handedOff(there.folder, there.record), false, rel);
      u.done();
    }
    t.done();
  });
  it("is true, as a doubt, when final/ or history/ cannot be read, and false only when they are not there", () => {
    const t = setup();
    const found = original(t);
    // Not there at all, or a file where the folder should be: no hand-off.
    assert.equal(handedOff(found.folder, found.record), false);
    writeFileSync(join(found.folder, "final"), "a file");
    assert.equal(handedOff(found.folder, found.record), false, "ENOTDIR");
    rmSync(join(found.folder, "final"));
    mkdirSync(join(found.folder, "history", "2026-10-20 15-00", "final"), { recursive: true });
    writeFileSync(join(found.folder, "history", "2026-10-20 15-00", "final", "Talk.srt"), "x");
    assert.equal(handedOff(found.folder, found.record), false, "readable, and no hand-off in it");
    for (const dir of ["history", "final"]) {
      mkdirSync(join(found.folder, dir), { recursive: true });
      chmodSync(join(found.folder, dir), 0o000);
      try {
        assert.equal(handedOff(found.folder, found.record), true, `${dir}/ cannot be read`);
      } finally {
        chmodSync(join(found.folder, dir), 0o755);
      }
    }
    t.done();
  });
});

// Hand-off version 2 (spec 2026-10-22, section 8), once this Mac's settings say so: the same finish writes version 2 for every
// kind, an "episode" written as raw, under the first version's id and above every revision written for it. With the setting at
// 1, or with none, it writes version 1 as it always has, title and all.
/** This Mac's settings say which version of the hand-off to write: on its disk, for a command run anew, and in the ctx made
    already. */
function handoffVersion(t, version) {
  writeSettings(t.home, { handoffVersion: version });
  t.ctx.settings = { ...t.ctx.settings, handoffVersion: version };
}
/** The hand-off a finish copied into final/. */
const handoffIn = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
/** The id of the video the made-up episode is a new version of, and that video, answered as raw, in its own folder. */
const FIRST = "e-20261010-7c1d2e";
const firstCut = (t, record = {}) => episodeAs(t, { id: FIRST, name: "2026-10-10 Pricing talk, first cut (Mac Studio)", record: { kind: "raw", ...record } });
/** A hand-off of the first cut, of version 1 or 2, at `revision`, made before any Reel or suggestion of it was: so the made-up
    episode's Reels 1 and 2, as a new version of it, are fresh numbers for the video, which never repeat within it (spec
    2026-10-22, section 8). */
const firstHandoff = (version, revision) => {
  const handoff = handoffOf(version, FIRST, revision);
  delete handoff.suggestions;
  return { ...handoff, reels: [] };
};
/** The label a light import gives the made-up episode. */
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
/** How every refusal names the made-up episode, an answered video that is not a session, label or none: by its name, as edit.js
    names it (episode.js shownName). A video not answered, and a session, are named by their labels. */
const SHOWN = NAME;
/** A refusal's words without the made-up episode's name as edit.js shows it: what is left names no file, folder or name. */
const besidesShown = (text) => text.split(SHOWN).join("");
/** Two name titles on the main video, the later one asked for first. */
const TEXTS = [{ id: "t2", kind: "lower-third", at: 8, for: 3, lines: ["Alex Hormozi"] }, { id: "t1", kind: "lower-third", at: 1, for: 3, lines: ["Sallie Ogden", "Founder, The BRIMM"] }];
/** The episode open on this Mac already, so that finish takes no claim: a refusal then leaves every record as it was. */
const OPEN = { editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } };
/** A command as she would say it on this Mac: its code, and what it said. */
async function command(t, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...t.ctx.deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
/** Every file in Episodes, with its size and time: what a refusal leaves as it was. */
const episodesTree = (t) => listAll(join(t.root, "Episodes")).map((rel) => [rel, statSync(join(t.root, "Episodes", rel)).size, statSync(join(t.root, "Episodes", rel)).mtimeMs]);
const MISSING = `${SHOWN} is a new version of a video that is not on this Mac yet (${FIRST}). Wait for Dropbox to bring it over, then say it again. Nothing was written.`;

describe("finish, with hand-off version 2", () => {
  it("finishes the same episode to version 1 with the setting off or at 1, title and all, and to version 2 with it at 2", async () => {
    for (const version of [undefined, 1, 2]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      const found = await asked(t);
      const result = await finishNow(t.ctx, found);
      assert.equal(result.ok, true, result.failed.join(" "));
      assert.deepEqual(t.inFinal(found), FINAL, `version ${version}`);
      const handoff = handoffIn(found);
      assert.deepEqual([handoff.revision, reread(found).finished.revision], [1, 1]);
      if (version === 2) {
        assert.equal(handoffFaultV2(handoff), "");
        assert.equal(handoff.version, 2);
        assert.deepEqual(handoff.video, { id: ID, kind: "raw", name: NAME, recorded: "2026-10-14", recordedFrom: "video" });
        assert.equal("episode" in handoff, false);
        assert.doesNotMatch(JSON.stringify(handoff), /Price like you mean it/, "titles live on the BRIMM Ops page");
        assert.deepEqual(handoff.main, { file: `${PROJECT.main}.mp4`, seconds: 11.878, srt: SRT.main });
        assert.deepEqual(handoff.reels.map((r) => [r.n, r.title, r.file, r.seconds, r.fromSuggestion]), [[1, "Know your costs", `${PROJECT["reel 1"]}.mov`, 7.7, 1], [2, "Say it again, better", `${PROJECT["reel 2"]}.mov`, 75, 2]]);
        assert.deepEqual(handoff.reels[0].inMain, { start: 4.1, end: 11.8 });
        assert.equal("suggestions" in handoff, false, "a Final Cut finish writes no Reel suggestions: the record holds none");
        assert.equal(handoff.session, null);
      } else {
        assert.equal(handoffFault(handoff), "");
        assert.deepEqual([handoff.version, handoff.episode.id, handoff.episode.kind, handoff.episode.title, "video" in handoff], [1, ID, "episode", "Price like you mean it", false]);
      }
      t.done();
    }
  });
  it("finishes an episode with no approved title, and its hand-off passes the check", async () => {
    for (const title of [null, { text: "Price it right", from: "claude", approved: false }]) {
      const t = setup();
      handoffVersion(t, 2);
      const found = await asked(t, { ...EDITED, title });
      const result = await finishNow(t.ctx, found);
      assert.equal(result.ok, true, result.failed.join(" "));
      const handoff = handoffIn(found);
      assert.equal(handoffFaultV2(handoff), "");
      assert.doesNotMatch(JSON.stringify(handoff), /Price it right/);
      t.done();
    }
  });
  it("gives a raw video's main.onPicture as the lines of its name titles, in order, and a finished video's none", async () => {
    for (const [kind, written, drawn] of [["episode", "raw", true], ["raw", "raw", true], ["finished", "finished", false]]) {
      const t = setup();
      handoffVersion(t, 2);
      const found = await asked(t, { ...EDITED, kind, main: { ...EDITED.main, texts: TEXTS } });
      const result = await finishNow(t.ctx, found);
      assert.equal(result.ok, true, result.failed.join(" "));
      const handoff = handoffIn(found);
      assert.equal(handoffFaultV2(handoff), "", kind);
      assert.equal(handoff.video.kind, written, kind);
      assert.deepEqual(handoff.main.onPicture, drawn ? ["Sallie Ogden", "Founder, The BRIMM", "Alex Hormozi"] : undefined, kind);
      t.done();
    }
  });
  it("writes a new version's hand-off under its first version's id, above the revision that version's final/ holds, and records it", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    lay(first.folder, "final/Pricing talk, first cut.brimm-ops.json", firstHandoff(2, 3));
    const found = await asked(t, { ...EDITED, versionOf: FIRST });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.video.id, handoff.revision, handoffFaultV2(handoff)], [FIRST, 4, ""]);
    assert.deepEqual(handoff.reels.map((r) => r.n), [1, 2], "numbers the first version's hand-off never gave");
    assert.deepEqual([reread(found).id, reread(found).finished.revision], [ID, 4], "the record keeps its own id, and the revision written");
    t.done();
  });
  it("refuses a new version's hand-off that gives a Reel or suggestion number again which an earlier or a later version's gave, and writes nothing", async () => {
    // The first cut's hand-off gave suggestions 1 and 2 and Reel 2, and the made-up episode, a new version of it, holds Reels 1
    // and 2: numbers never repeat within a video (spec 2026-10-22, section 8), and one given again would be taken on the page
    // for the first cut's. Until a new version's reading numbers on from the highest ever given (Part F), it is refused.
    for (const [where, rel] of [["final/", "final/Pricing talk, first cut.brimm-ops.json"], ["history/", "history/2026-10-21 09.00 Pricing talk, first cut.brimm-ops.json"]]) {
      for (const [label, who] of [[LABEL, SHOWN], [null, SHOWN]]) {
        const t = setup();
        handoffVersion(t, 2);
        const first = firstCut(t);
        lay(first.folder, rel, handoffOf(2, FIRST, 3));
        const found = await asked(t, { ...EDITED, versionOf: FIRST, ...(label ? { label } : {}), ...OPEN });
        const before = episodesTree(t);
        const result = await finishNow(t.ctx, found);
        assert.equal(result.ok, false, where);
        assert.deepEqual(result.failed, [`${who}'s hand-off would give Reel 1 and Reel 2 again: another version of the video gave those numbers already, and a number is never given twice within a video. Ask Jason. Nothing was written.`], where);
        assert.doesNotMatch(besidesShown(result.failed.join(" ")), /Pricing|\.mp4|\.mov/, "no file name, and no name but the one edit.js shows");
        assert.deepEqual(episodesTree(t), before, `${where}: nothing in final/, and the record as it was`);
        t.done();
      }
    }
    // A later version's hand-off, under the same id, is another version's too.
    const t = setup();
    handoffVersion(t, 2);
    const found = await asked(t, { ...EDITED, label: LABEL, ...OPEN });
    const next = later(t, SECOND, ID);
    lay(next.folder, "final/Pricing talk, again.brimm-ops.json", { ...handoffOf(2, ID, 1), reels: [{ ...V2.finished.reels[0], n: 7, fromSuggestion: null }], suggestions: [{ ...V2.finished.suggestions[0], n: 2 }] });
    const result = await finishNow(t.ctx, found);
    assert.deepEqual(result.failed, [`${SHOWN}'s hand-off would give Reel 2 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
    assert.deepEqual(t.inFinal(found), []);
    t.done();
  });
  it("with the setting at 1, writes a new version's hand-off as it always has: under its own id, at its own next revision", async () => {
    const t = setup();
    handoffVersion(t, 1);
    const first = firstCut(t);
    lay(first.folder, "final/Pricing talk, first cut.brimm-ops.json", handoffOf(2, FIRST, 3));
    const found = await asked(t, { ...EDITED, versionOf: FIRST });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.episode.id, handoff.revision, handoffFault(handoff)], [1, ID, 1, ""]);
    t.done();
  });
  it("refuses a new version whose first version Dropbox has not brought to this Mac, by its name as edit.js names it, and writes nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL, ...OPEN });
    // The first version's folder goes from this Mac after finish was asked.
    rmSync(first.folder, { recursive: true });
    const before = episodesTree(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [MISSING]);
    assert.doesNotMatch(besidesShown(result.failed.join(" ")), /Pricing|\.mp4|\.mov/, "no file name");
    assert.deepEqual(episodesTree(t), before, "nothing in final/, and the record as it was");
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), []);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5, "From Final Cut keeps every file");
    t.done();
  });
  it("refuses a new version whose first version names it as its own earlier version, by its name as edit.js names it, and writes nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL, ...OPEN });
    // The first version comes to say it is a version of this one, after finish was asked.
    writeFileSync(recordFile(first.folder, 2), recordText({ ...first.record, rev: 2, versionOf: ID }));
    const before = episodesTree(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [`${SHOWN} and the video it names as its earlier version (${FIRST}) each say they are a version of the other: ask Jason. Nothing was written.`]);
    assert.doesNotMatch(besidesShown(result.failed.join(" ")), /Pricing|\.mp4|\.mov/, "no file name");
    assert.deepEqual(episodesTree(t), before, "nothing in final/, and the record as it was");
    t.done();
  });
});

describe("finish, again, once the setting says 1 after a finish that wrote version 2", () => {
  it("writes version 2 again under the same id, at the next revision, and asks for no approved title", async () => {
    const t = setup();
    handoffVersion(t, 2);
    // A new version of FIRST, whose final/ holds revision 3: the page holds its hand-off under FIRST's id.
    const first = firstCut(t);
    lay(first.folder, "final/Pricing talk, first cut.brimm-ops.json", firstHandoff(2, 3));
    const found = await asked(t, { ...EDITED, title: null, versionOf: FIRST, label: LABEL });
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    assert.deepEqual([handoffIn(found).version, handoffIn(found).video.id, handoffIn(found).revision], [2, FIRST, 4]);
    // The setting goes back to 1, and Reel 1 is Shared again.
    handoffVersion(t, 1);
    t.shared(`${PROJECT["reel 1"]}.mov`, 9000, "a longer finished video");
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 9500);
    assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, t.said());
    assert.doesNotMatch(t.said(), /Approve a title/);
    const result = await finishNow(t.ctx, { ...found, record: reread(found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.video.id, handoff.revision, handoffFaultV2(handoff), "episode" in handoff], [2, FIRST, 5, "", false]);
    assert.equal(reread(found).finished.revision, 5);
    t.done();
  });
  it("still writes version 1 over a version 1 hand-off, under the episode's own id", async () => {
    const t = setup();
    handoffVersion(t, 1);
    const found = await asked(t);
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    t.shared(`${PROJECT["reel 1"]}.mov`, 9000, "a longer finished video");
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 9500);
    assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true }), 0, t.said());
    assert.equal((await finishNow(t.ctx, { ...found, record: reread(found) })).ok, true);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.episode.id, handoff.revision, handoffFault(handoff)], [1, ID, 2, ""]);
    t.done();
  });
});

describe("finish, with a loop in the chain that does not run back through the video", () => {
  it("names the circle by the id that is seen again, not the video's own, and writes nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const SECOND_ID = "e-20261012-5b2e77";
    // This video, C, is a new version of A, which is a version of B, which is a version of A: the circle is A and B.
    const a = firstCut(t);
    episodeAs(t, { id: SECOND_ID, name: "2026-10-12 Pricing talk, second cut (Mac Studio)", record: { kind: "raw", versionOf: FIRST } });
    const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL, ...OPEN });
    // A comes to say it is a version of B only after finish was asked.
    writeFileSync(recordFile(a.folder, 2), recordText({ ...a.record, rev: 2, versionOf: SECOND_ID }));
    const before = episodesTree(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [`${SHOWN} is a new version of a video whose earlier versions name each other as earlier versions, in a circle (${FIRST}): ask Jason. Nothing was written.`]);
    assert.doesNotMatch(besidesShown(result.failed.join(" ")), /Pricing|\.mp4|\.mov/, "no file name");
    assert.deepEqual(episodesTree(t), before, "nothing in final/, and the record as it was");
    t.done();
  });
  it("is worded for the video itself only when the circle runs back through it", () => {
    const record = { id: ID, label: LABEL, name: { text: "Pricing talk" }, versionOf: FIRST };
    assert.equal(chainGapWords(record, { id: ID, reason: "loop" }), `${LABEL} and the video it names as its earlier version (${FIRST}) each say they are a version of the other: ask Jason. Nothing was written.`);
    assert.equal(chainGapWords(record, { id: FIRST, reason: "loop" }), `${LABEL} is a new version of a video whose earlier versions name each other as earlier versions, in a circle (${FIRST}): ask Jason. Nothing was written.`);
    assert.equal(chainGapWords(record, { id: "e-20261012-5b2e77", reason: "loop" }), `${LABEL} is a new version of a video whose earlier versions name each other as earlier versions, in a circle (e-20261012-5b2e77): ask Jason. Nothing was written.`);
  });
});

describe("finish, with hand-off version 1, or with no setting", () => {
  it("does not look for a new version's earlier version, writes version 1 under the episode's own id at its own next revision, and spell remakes it as version 1", async () => {
    for (const version of [undefined, 1]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      // The earlier version is not in Episodes at all, and the record is answered (an episode is a raw video, as version 1
      // knows it): version 2 would refuse it.
      const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL });
      assert.equal(chainGap(t.root, reread(found))?.reason, "missing", "the chain has a gap, which version 1 never asks about");
      const result = await finishNow(t.ctx, found);
      assert.equal(result.ok, true, `setting ${version}: ${result.failed.join(" ")}`);
      const handoff = handoffIn(found);
      assert.deepEqual([handoff.version, handoff.episode.id, handoff.revision, handoffFault(handoff)], [1, ID, 1, ""], `setting ${version}`);
      assert.equal(reread(found).finished.revision, 1);
      const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
      assert.equal(r.code, 0, r.text);
      assert.doesNotMatch(r.text, /not on this Mac yet/);
      const again = handoffIn(found);
      assert.deepEqual([again.version, again.episode.id, again.revision, handoffFault(again)], [1, ID, 2, ""], `setting ${version}`);
      assert.match(again.main.srt, /Thank you so much, Sally\./);
      t.done();
    }
  });
});

describe("finish, for a session and for a video not yet answered", () => {
  it("refuses it before anything is waited for, taken, transcribed or copied, as edit.js names it (a session by its session label, a video not answered by its label or else its short id), and leaves final/ and the record as they were", async () => {
    for (const version of [undefined, 1, 2]) {
      for (const [what, kind, words, named] of NOT_YET) {
        for (const label of [LABEL, undefined]) {
          const who = named(label);
          const t = setup();
          if (version) handoffVersion(t, version);
          const found = await asked(t, { ...EDITED, ...(label ? { label } : {}), ...OPEN });
          // What the video is says so only now, as when her answer, or her mark, comes after finish was asked.
          writeFileSync(recordFile(found.folder, found.record.rev), recordText({ ...reread(found), ...kind }));
          const how = `${what}, setting ${version}, ${label ? "labelled" : "no label"}`;
          const before = episodesTree(t);
          const result = await finishNow(t.ctx, found);
          assert.equal(result.ok, false, how);
          assert.deepEqual(result.failed, [words(who)], how);
          assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, `${how}: no file name`);
          assert.deepEqual(t.inFinal(found), [], how);
          assert.deepEqual(episodesTree(t), before, `${how}: the record as it was`);
          assert.deepEqual(t.calls, [], `${how}: no program was run`);
          assert.deepEqual(t.clones, [], how);
          assert.deepEqual(t.opened, [], how);
          assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5, `${how}: From Final Cut keeps every file`);
          t.done();
        }
      }
    }
  });
});

// A video of any kind whose session mark is not cleared is gated as a session is (gate.js gated), and its words must not reach the
// shared folder either: cannotFinish refuses it as it refuses a session, by the gate's predicate (a mark cleared only by her
// click on the dialog is cleared), in the session's words, before anything is read, copied or written (the merge's review, I-1).
describe("finish, for a video of any kind marked a session, not cleared", () => {
  const MARK = { marked: "2026-10-22T10:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
  const CLEARED = { ...MARK, cleared: { at: "2026-10-22T11:00:00-05:00", on: "Mac Studio", to: "finished", confirmed: "dialog" } };
  const TEACHINGS = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } };
  const sessionWords = (who) => `${who} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`;
  const record = (over) => ({ id: ID, label: LABEL, name: { text: NAME, placeholder: false }, ...over });
  it("cannotFinish refuses every kind with a mark that is not cleared, by the gate's predicate, in a session's words, named by its label", () => {
    const marks = [["no cleared at all", MARK], ["cleared: true", { ...MARK, cleared: true }], ["cleared by something but her click", { ...MARK, cleared: { at: "x", on: "Mac Studio", to: "finished", confirmed: "typed" } }], ["a mark that is not an object", "yes"]];
    for (const kind of ["finished", "raw", "short video", "episode"]) {
      for (const [what, mark] of marks) assert.equal(cannotFinish(record({ kind, session: mark })), sessionWords(LABEL), `${kind}: ${what}`);
      assert.equal(cannotFinish(record({ kind, label: undefined, session: MARK })), sessionWords(`a client or group session (${ID.slice(-6)})`), `${kind}: no label`);
      assert.equal(cannotFinish(record({ kind, session: CLEARED })), "", `${kind}: cleared by her click`);
      assert.equal(cannotFinish(record({ kind })), "", `${kind}: no mark`);
    }
  });
  it("cannotFinish keeps its words for a session, cleared or not, and for a video not answered", () => {
    assert.equal(cannotFinish(record({ kind: "session", session: CLEARED, name: { text: "Session, 2026-10-14", placeholder: false } })), sessionWords("Session, 2026-10-14"));
    assert.equal(cannotFinish(record({ kind: "session" })), sessionWords(NAME), "a session with no mark is named by its name, which is its label once F3 has named it");
    assert.equal(cannotFinish(record({ kind: null, session: MARK })), `${LABEL} is not answered yet: say what it is first. Nothing was written.`);
  });
  it("refuses finish at once for a short video whose mark is not cleared, with teachings on, under hand-off version 1: nothing claimed, copied or written, no run started", async () => {
    const t = setup();
    handoffVersion(t, 1);
    writeSettings(t.home, { sessionTeachings: TEACHINGS });
    const found = episodeFor(t, { record: { ...EDITED, kind: "short video", label: LABEL, session: MARK } });
    for (const name of [`${PROJECT.main}.mp4`, `${PROJECT.main}.fcpxmld`, `${PROJECT["reel 1"]}.mov`, `${PROJECT["reel 2"]}.mov`]) t.shared(name, 2000);
    const before = episodesTree(t);
    const r = await command(t, "finish", LABEL, "--yes");
    assert.deepEqual([r.code, r.text], [1, sessionWords(LABEL)]);
    assert.doesNotMatch(r.text, /Pricing|\.mp4|\.mov|Looked in/);
    assert.deepEqual(episodesTree(t), before, "no claim, and the record as it was");
    assert.equal(reread(found).rev, found.record.rev);
    assert.deepEqual(t.inFinal(found), []);
    assert.deepEqual([t.started, t.calls, t.clones, t.opened], [[], [], [], []]);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 4, "From Final Cut keeps every file");
    t.done();
  });
  it("refuses the detached finish of it too, before anything is waited for or copied", async () => {
    for (const version of [undefined, 1, 2]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      const found = await asked(t, { ...EDITED, label: LABEL, ...OPEN });
      // It is marked only after finish was asked, as a short video.
      writeFileSync(recordFile(found.folder, found.record.rev), recordText({ ...reread(found), kind: "short video", session: MARK }));
      const before = episodesTree(t);
      const result = await finishNow(t.ctx, found);
      assert.deepEqual([result.ok, result.failed], [false, [sessionWords(LABEL)]], `setting ${version}`);
      assert.deepEqual(episodesTree(t), before, `setting ${version}: nothing in final/, and the record as it was`);
      assert.deepEqual([t.calls, t.clones], [[], []], `setting ${version}`);
      t.done();
    }
  });
  it("gives the progress panel the name edit.js shows (shownName), as a finish of an answered video begins", async () => {
    // For every record that gets past cannotFinish, shownName is the name the record holds, so this holds before the change too:
    // it pins that the panel is given a name edit.js would say, and not a file's.
    const t = setup();
    const found = await asked(t, { ...EDITED, ...OPEN });
    const began = [];
    const result = await finishNow(t.ctx, found, { progress: { ...noProgress, begin: (name) => began.push(name) } });
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual(began, [NAME]);
    t.done();
  });
});

describe("the hand-off version a finish writes for a video", () => {
  const V1_FILE = JSON.stringify(V1);
  const V2_FILE = JSON.stringify(V2.finished);
  const ON_FILE = "final/a.brimm-ops.json";
  /** A record whose last finish wrote the hand-off at ON_FILE, in a folder where `text` is that file (none when null). */
  const named = (text) => {
    const t = setup();
    const folder = join(t.dir, "an episode");
    mkdirSync(join(folder, "final"), { recursive: true });
    if (text !== null) writeFileSync(join(folder, ON_FILE), text);
    return { t, folder, record: { finished: { revision: 1, at: "2026-10-20T15:20:00-05:00", on: "Mac Studio", handoff: ON_FILE, parts: {} } } };
  };
  it("is 2 when the settings say 2, whatever is on file or not", () => {
    for (const text of [V1_FILE, V2_FILE, "not json", null]) {
      const { t, folder, record } = named(text);
      assert.equal(writesV2For({ handoffVersion: 2 }, folder, record), true);
      assert.equal(writesV2For({ handoffVersion: 2 }, folder, { finished: null }), true);
      t.done();
    }
  });
  it("is 2 with the setting at 1 or none when the hand-off the record names is on file and is version 2", () => {
    const { t, folder, record } = named(V2_FILE);
    for (const settings of [{ handoffVersion: 1 }, {}, undefined]) assert.equal(writesV2For(settings, folder, record), true);
    t.done();
  });
  it("is 1 with the setting at 1 or none when that hand-off is version 1, is not there, or cannot be read, and when the record has no finish", () => {
    for (const text of [V1_FILE, null, "{ not json", "null", "7"]) {
      const { t, folder, record } = named(text);
      for (const settings of [{ handoffVersion: 1 }, {}, undefined]) assert.equal(writesV2For(settings, folder, record), false, `${text} ${JSON.stringify(settings)}`);
      t.done();
    }
    const { t, folder } = named(V2_FILE);
    assert.equal(writesV2For({ handoffVersion: 1 }, folder, { finished: null }), false, "a hand-off in the folder that no finish of the record named is not looked at");
    assert.equal(writesV2For({ handoffVersion: 1 }, folder, {}), false);
    assert.equal(writesV2For({ handoffVersion: 1 }, folder, { finished: { handoff: "" } }), false);
    t.done();
  });
});

describe("spell, after a finish with hand-off version 2", () => {
  /** The made-up episode as a new version of FIRST, whose final/ holds revision 3, finished to version 2 at revision 4. */
  async function finishedAgain(t) {
    handoffVersion(t, 2);
    const first = firstCut(t);
    lay(first.folder, "final/Pricing talk, first cut.brimm-ops.json", firstHandoff(2, 3));
    const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([handoffIn(found).video.id, handoffIn(found).revision], [FIRST, 4]);
    return { first, found };
  }
  it("makes the hand-off again as version 2, under the first version's id, above every revision written for it", async () => {
    const t = setup();
    const { first, found } = await finishedAgain(t);
    const was = handoffIn(found);
    // A hand-off of the first version set aside into its history/ since, at revision 6: the next is above it.
    lay(first.folder, "history/2026-10-21 09.00/final/Pricing talk, first cut.brimm-ops.json", firstHandoff(1, 6));
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /the hand-off is made again as revision 7: drop it on the BRIMM Ops page again\./);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.video.id, handoff.revision, handoffFaultV2(handoff)], [2, FIRST, 7, ""]);
    assert.match(handoff.main.srt, /Thank you so much, Sally\./);
    assert.match(handoff.reels[0].srt, /Thank you so much, Sally\./);
    assert.deepEqual(handoff.reels.map((x) => [x.n, x.title, x.file, x.inMain, x.fromSuggestion]), was.reels.map((x) => [x.n, x.title, x.file, x.inMain, x.fromSuggestion]));
    assert.equal(reread(found).finished.revision, 7);
    t.done();
  });
  it("refuses, by its name as edit.js names it, a hand-off that would give a number again which another version's hand-off gave, and writes nothing; its own earlier revisions give them by right", async () => {
    const t = setup();
    const { first, found } = await finishedAgain(t);
    // The first cut's hand-off of version 1, with its Reels 1 and 3, comes to this Mac set aside in its history/.
    lay(first.folder, "history/2026-10-21 09.00 Pricing talk, first cut.brimm-ops.json", handoffOf(1, FIRST, 2));
    const before = episodesTree(t);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, `${SHOWN}'s hand-off would give Reel 1 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
    assert.deepEqual(episodesTree(t), before, "final/ and the record as they were, and no spelling kept");
    // Its own final/ and history/ hold Reels 1 and 2 already, at revision 4: those it gives again.
    rmSync(join(first.folder, "history"), { recursive: true });
    lay(found.folder, "history/2026-10-22 09.00 Pricing- what to charge-.brimm-ops.json", handoffIn(found));
    const again = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(again.code, 0, again.text);
    assert.deepEqual([handoffIn(found).revision, handoffIn(found).reels.map((x) => x.n)], [5, [1, 2]]);
    t.done();
  });
  it("refuses, by its name as edit.js names it, when the first version's folder has gone from this Mac, and writes nothing", async () => {
    const t = setup();
    const { first, found } = await finishedAgain(t);
    rmSync(first.folder, { recursive: true });
    const before = episodesTree(t);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, MISSING]);
    assert.deepEqual(episodesTree(t), before, "final/ and the record as they were, and no spelling kept");
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
  it("with the setting at 1, makes a version 1 hand-off again as it always has", async () => {
    const t = setup();
    handoffVersion(t, 1);
    const found = await asked(t);
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.episode.id, handoff.episode.title, handoff.revision, handoffFault(handoff)], [1, ID, "Price like you mean it", 2, ""]);
    assert.match(handoff.main.srt, /Thank you so much, Sally\./);
    t.done();
  });
  it("makes a version 1 hand-off again as version 2 once the setting says 2, as a finish would write it", async () => {
    const t = setup();
    const found = await asked(t, { ...EDITED, main: { ...EDITED.main, texts: TEXTS } });
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    assert.equal(handoffIn(found).version, 1);
    handoffVersion(t, 2);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.video.id, handoff.video.kind, handoff.revision, handoffFaultV2(handoff)], [2, ID, "raw", 2, ""]);
    assert.deepEqual(handoff.main.onPicture, ["Sallie Ogden", "Founder, The BRIMM", "Alex Hormozi"]);
    assert.deepEqual(handoff.reels.map((x) => x.fromSuggestion), [1, 2]);
    assert.doesNotMatch(JSON.stringify(handoff), /Price like you mean it/);
    t.done();
  });
  it("never makes a version 2 hand-off again as version 1, even once the setting says 1 again", async () => {
    const t = setup();
    const { found } = await finishedAgain(t);
    handoffVersion(t, 1);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.version, handoff.video.id, handoff.revision, handoffFaultV2(handoff)], [2, FIRST, 5, ""]);
    t.done();
  });
});

// Where a video's next hand-off goes (handoffTarget), which every hand-off writer asks, from one reading of Episodes: whether it
// is version 2, why it cannot be written, if it cannot, its id and its revision.
describe("where a video's next hand-off goes", () => {
  /** The made-up first version, handed off as version 2 at revision 3, and a new version of it, which once handed itself off as
      version 1 under its own id at revision 2 (before the switch), as its record says. */
  const versions = (t) => {
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    const next = later(t, SECOND, ID, { finished: { revision: 2, at: "2026-10-21T10:00:00-05:00", on: "Mac Studio" } });
    lay(next.folder, "final/b.brimm-ops.json", handoffOf(1, SECOND, 2));
    return { old, next };
  };
  it("is, for version 1, the episode's own id at its own next revision, and refuses nothing, with or without a gap", () => {
    for (const settings of [{}, { handoffVersion: 1 }, undefined]) {
      const t = setup();
      const { old, next } = versions(t);
      assert.deepEqual(handoffTarget({ root: t.root, settings }, next), { v2: false, refusal: "", id: SECOND, revision: 3, taken: [] });
      rmSync(old.folder, { recursive: true });
      assert.deepEqual(handoffTarget({ root: t.root, settings }, next), { v2: false, refusal: "", id: SECOND, revision: 3, taken: [] }, "version 1 never asks for the chain");
      t.done();
    }
  });
  it("is, for version 2, the first version's id, one above every revision written for it, with the numbers its other versions gave", () => {
    const t = setup();
    const { next } = versions(t);
    // The first version's hand-off gave suggestions 1 and 2, and Reel 2.
    assert.deepEqual(handoffTarget({ root: t.root, settings: { handoffVersion: 2 } }, next), { v2: true, refusal: "", id: ID, revision: 4, taken: [1, 2] });
    assert.equal(nextRevision(t.root, next), 4);
    t.done();
  });
  it("refuses, for version 2, a gap in the chain, by the video's label, and gives no id, no revision and no number", () => {
    const t = setup();
    const { old, next } = versions(t);
    rmSync(old.folder, { recursive: true });
    const record = { ...next.record, label: LABEL };
    assert.deepEqual(handoffTarget({ root: t.root, settings: { handoffVersion: 2 } }, { ...next, record }), { v2: true, refusal: chainGapWords(record, { id: ID, reason: "missing" }), id: null, revision: null, taken: [] });
    t.done();
  });
  it("is version 2 for a video whose last hand-off on file is version 2, whatever the setting says, and its own numbers are not taken", () => {
    const t = setup();
    const { next } = versions(t);
    lay(next.folder, "final/c.brimm-ops.json", { ...handoffOf(2, ID, 4), suggestions: [], reels: [{ ...V2.finished.reels[0], n: 5, fromSuggestion: null }] });
    const record = { ...next.record, finished: { ...next.record.finished, revision: 4, handoff: "final/c.brimm-ops.json" } };
    assert.deepEqual(handoffTarget({ root: t.root, settings: { handoffVersion: 1 } }, { ...next, record }), { v2: true, refusal: "", id: ID, revision: 5, taken: [1, 2] });
    t.done();
  });
  it("writes nothing and calls nothing", () => {
    const t = setup();
    const { next } = versions(t);
    const tree = () => listAll(t.dir).map((rel) => [rel, statSync(join(t.dir, rel)).size, statSync(join(t.dir, rel)).mtimeMs]);
    const before = tree();
    for (const settings of [{}, { handoffVersion: 2 }]) handoffTarget({ root: t.root, settings }, next);
    assert.deepEqual(tree(), before);
    assert.deepEqual([t.clones, t.calls, t.opened], [[], [], []]);
    t.done();
  });
});

// A session's words are kept out of the shared folder, and its hand-off redacts what the page holds for its id (spec 2026-10-22,
// sections 2 and 8). A hand-off of another version of the same video, under the same id, would rise above the session's revision
// and bring those words back. So no hand-off of a video that is not a session is written while any version of it, earlier or
// later, is a session whose mark is not cleared (one with no mark at all among them): the video is named as edit.js names it
// (episode.js shownName), by its label when it is itself gated, and never by a file's name.
describe("a hand-off of a video one of whose versions is a client or group session", () => {
  const MARK = { marked: "2026-10-22T10:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
  const CLEARED = { ...MARK, cleared: { at: "2026-10-22T11:00:00-05:00", on: "Mac Studio", to: "finished", confirmed: "dialog" } };
  /** A session by its kind with no mark, by its kind with a mark not cleared, and by a mark not cleared alone. */
  const SESSIONS = [["a session with no mark", { kind: "session" }], ["a session whose mark is not cleared", { kind: "session", session: MARK }], ["a video marked a session, not cleared", { kind: "finished", session: MARK }]];
  const refusedAs = (who) => `${who} is a version of a client or group session: ask Jason. Nothing was written.`;
  /** The made-up episode, finish asked of it with Final Cut's files in From Final Cut, as a new version of FIRST, or as the first
      version of a video that SECOND is a later version of. `as` lays the session's fields on that other version, after finish
      was asked. */
  async function askedBeside(t, { earlier, as, label = LABEL }) {
    handoffVersion(t, 2);
    const first = earlier ? firstCut(t) : null;
    const found = await asked(t, { ...EDITED, ...(earlier ? { versionOf: FIRST } : {}), ...(label ? { label } : {}), ...OPEN });
    if (earlier) writeFileSync(recordFile(first.folder, 2), recordText({ ...first.record, rev: 2, ...as }));
    else later(t, SECOND, ID, as);
    return found;
  }
  it("is refused by the detached finish, when an earlier or a later version is such a session, and nothing is written", async () => {
    for (const earlier of [true, false]) {
      for (const [what, as] of SESSIONS) {
        for (const [label, who] of [[LABEL, SHOWN], [null, SHOWN]]) {
          const t = setup();
          const how = `${earlier ? "earlier" : "later"}: ${what}, ${label}`;
          const found = await askedBeside(t, { earlier, as, label });
          const before = episodesTree(t);
          const result = await finishNow(t.ctx, found);
          assert.equal(result.ok, false, how);
          assert.deepEqual(result.failed, [refusedAs(who)], how);
          assert.doesNotMatch(besidesShown(result.failed.join(" ")), /Pricing|\.mp4|\.mov/, `${how}: no file name, and no name but the one edit.js shows`);
          assert.deepEqual(episodesTree(t), before, `${how}: nothing in final/, and every record as it was`);
          assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), [], how);
          t.done();
        }
      }
    }
  });
  it("is refused too when the session's mark is only in a conflicted copy of the record of an earlier or a later version, as the gate holds such a video", async () => {
    for (const earlier of [true, false]) {
      for (const [what, as] of SESSIONS) {
        const t = setup();
        const how = `${earlier ? "earlier" : "later"}: ${what}`;
        handoffVersion(t, 2);
        const first = earlier ? firstCut(t) : null;
        const found = await asked(t, { ...EDITED, ...(earlier ? { versionOf: FIRST } : {}), label: LABEL, ...OPEN });
        const other = earlier ? first : later(t, SECOND, ID);
        writeFileSync(join(other.folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...other.record, ...as }));
        const before = episodesTree(t);
        const target = handoffTarget({ root: t.root, settings: t.ctx.settings }, found);
        assert.equal(target.refusal, refusedAs(SHOWN), how);
        const result = await finishNow(t.ctx, found);
        assert.deepEqual([result.ok, result.failed], [false, [refusedAs(SHOWN)]], how);
        assert.deepEqual(episodesTree(t), before, `${how}: nothing in final/, and every record as it was`);
        t.done();
      }
    }
  });
  it("is refused by the quick part at once, before it looks in any folder, prints a part line or takes a claim", async () => {
    for (const earlier of [true, false]) {
      for (const [what, as] of SESSIONS) {
        const t = setup();
        handoffVersion(t, 2);
        if (earlier) firstCut(t, as);
        const found = episodeFor(t, { record: { ...EDITED, ...(earlier ? { versionOf: FIRST } : {}), label: LABEL } });
        if (!earlier) later(t, SECOND, ID, as);
        for (const name of [`${PROJECT.main}.mp4`, `${PROJECT.main}.fcpxmld`, `${PROJECT["reel 1"]}.mov`, `${PROJECT["reel 2"]}.mov`]) t.shared(name, 2000);
        const how = `${earlier ? "earlier" : "later"}: ${what}`;
        assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 1, how);
        assert.deepEqual(t.said().split("\n"), [refusedAs(SHOWN)], how);
        assert.deepEqual(t.started, [], how);
        assert.equal(reread(found).rev, found.record.rev, `${how}: no claim was written`);
        t.done();
      }
    }
  });
  it("is refused by spell, when an earlier or a later version became such a session after the finish, and nothing is written", async () => {
    for (const earlier of [true, false]) {
      for (const [what, as] of SESSIONS) {
        const t = setup();
        handoffVersion(t, 2);
        const first = earlier ? firstCut(t) : null;
        const found = await asked(t, { ...EDITED, ...(earlier ? { versionOf: FIRST } : {}), label: LABEL });
        assert.equal((await finishNow(t.ctx, found)).ok, true);
        if (earlier) writeFileSync(recordFile(first.folder, 2), recordText({ ...first.record, rev: 2, ...as }));
        else later(t, SECOND, ID, as);
        const how = `${earlier ? "earlier" : "later"}: ${what}`;
        const before = episodesTree(t);
        const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
        assert.deepEqual([r.code, r.text], [1, refusedAs(SHOWN)], how);
        assert.deepEqual(episodesTree(t), before, `${how}: final/ and the record as they were, and no spelling kept`);
        t.done();
      }
    }
  });
  it("names the video by its label, as edit.js names it, when it is itself marked a session, not cleared: cannotFinish refuses it first, as a session", async () => {
    const MARKED = { kind: "finished", session: MARK };
    const sessionWords = (who) => `${who} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`;
    for (const [label, who] of [[LABEL, LABEL], [null, `a client or group session (${ID.slice(-6)})`]]) {
      const t = setup();
      handoffVersion(t, 2);
      const found = await asked(t, { ...EDITED, ...(label ? { label } : {}), ...OPEN });
      // It is marked only after finish was asked.
      writeFileSync(recordFile(found.folder, found.record.rev), recordText({ ...reread(found), ...MARKED }));
      const before = episodesTree(t);
      const result = await finishNow(t.ctx, found);
      assert.deepEqual([result.ok, result.failed], [false, [sessionWords(who)]], who);
      assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, `${who}: no name`);
      assert.deepEqual(episodesTree(t), before, `${who}: nothing in final/, and the record as it was`);
      // The quick part refuses it so too, at once.
      const said = t.said().split("\n").length;
      assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true, noHandEdits: ["reel 2"] }), 1, who);
      assert.deepEqual(t.said().split("\n").slice(said), [sessionWords(who)], who);
      t.done();
    }
  });
  it("is written as ever once the session is cleared, and for a session's own record nothing is refused here", async () => {
    const t = setup();
    const found = await askedBeside(t, { earlier: false, as: { kind: "finished", session: CLEARED } });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([handoffIn(found).video.id, handoffIn(found).revision], [ID, 1]);
    // A session's own hand-off (its empty revision, Part F) is the session's: another version being one too refuses nothing.
    const session = later(t, THIRD, ID, { kind: "session", session: MARK });
    assert.deepEqual(handoffTarget({ root: t.root, settings: t.ctx.settings }, session), { v2: true, refusal: "", id: ID, revision: 2, taken: [1, 2] });
    t.done();
  });
  it("is not looked for in version 1, which is under the episode's own id", async () => {
    const t = setup();
    handoffVersion(t, 1);
    const found = await asked(t, { ...EDITED, label: LABEL });
    later(t, SECOND, ID, { kind: "session" });
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.deepEqual([handoffIn(found).version, handoffIn(found).episode.id], [1, ID]);
    t.done();
  });
});

// Numbers of suggestions and Reels never repeat within a video, across asking again, a corrected kind and a new version (spec
// 2026-10-22, section 8): a new reading numbers on from the highest ever given for the video's id (highestNumberOf).
describe("the highest number ever given to a suggestion or a Reel of a video", () => {
  /** A list of Reel candidates as the import or `ask` writes it, its `highest` and its candidates' numbers given. */
  const reelsList = (highest, ns) => ({ format: "brimm-video reels", version: 1, video: "Talk.mp4", by: "import", made: "2026-10-22T09:30:00-05:00", highest, candidates: ns.map((n) => ({ n, ranges: [{ start: n, end: n + 1, crop: { x: 0, y: 0, w: 1, h: 1 } }] })) });
  /** A Reel of a record, numbered `n`. */
  const reelOf = (n) => ({ n, status: "candidate", from: n, to: n + 1, title: "", why: "", files: [], pushed: [] });
  it("is 0 for a video none was given, and then the highest of its hand-offs, records and lists of candidates, of every version", () => {
    const t = setup();
    const old = original(t);
    const next = later(t, SECOND, ID);
    const newest = later(t, THIRD, SECOND);
    const all = () => [old, next, newest].map((found) => highestNumberOf(t.root, found.record));
    assert.deepEqual(all(), [0, 0, 0]);
    // A hand-off for the id in the first version's final/: suggestions 1 and 2, Reel 2.
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 1));
    assert.deepEqual(all(), [2, 2, 2]);
    // A hand-off of version 1 for the id set aside in its history/: Reels 1 and 3.
    lay(old.folder, "history/2026-10-21 09.00 a.brimm-ops.json", handoffOf(1, ID, 2));
    assert.deepEqual(all(), [3, 3, 3]);
    // The newest version's record holds Reel 5.
    writeFileSync(recordFile(newest.folder, 2), recordText({ ...newest.record, rev: 2, reels: [reelOf(5)] }));
    assert.deepEqual(all(), [5, 5, 5]);
    // The middle version's reels.json gave up to 7, and holds candidate 6.
    writeFileSync(join(next.folder, "reels.json"), JSON.stringify(reelsList(7, [6])));
    assert.deepEqual(all(), [7, 7, 7]);
    // A reels.json set aside in the first version's history/, at any depth, gave up to 9; and one whose candidate is above its
    // `highest`, 11.
    lay(old.folder, "history/2026-10-21 09.00/reels.json", reelsList(9, []));
    assert.deepEqual(all(), [9, 9, 9]);
    lay(newest.folder, "history/2026-10-22 09.00 reels.json", reelsList(0, [11]));
    assert.deepEqual(all(), [11, 11, 11]);
    t.done();
  });
  it("counts a session's items too: those of its hand-offs, and those of its teachings, in its folder and set aside in history/", () => {
    const t = setup();
    const old = original(t);
    const next = later(t, SECOND, ID);
    const all = () => [old, next].map((found) => highestNumberOf(t.root, found.record));
    /** A session's teachings as its reading writes them, its lists numbered so. */
    const teachings = (principles, recurring, ideas) => ({ format: "brimm-video teachings", version: 1, principles: principles.map((n) => ({ n, name: "A principle" })), recurringPrinciples: recurring.map((n) => ({ n, text: "A point." })), reelIdeas: ideas.map((n) => ({ n, idea: "An idea", words: "Words.", refilm: true, principle: null })), dropped: [] });
    lay(old.folder, "Session, 2026-10-22.principles.json", teachings([1, 2], [3], [4]));
    assert.deepEqual(all(), [4, 4]);
    lay(next.folder, "history/2026-10-22T10-00-00-05-00 Session, 2026-10-22.principles.json", teachings([5], [], []));
    assert.deepEqual(all(), [5, 5]);
    // A session's hand-off for the id: its principles, recurring principles and Reels to film.
    const session = { ...V2.session, video: { ...V2.session.video, id: ID }, session: { principles: [{ ...V2.session.session.principles[0], n: 6 }], recurringPrinciples: [{ n: 8, text: "A point." }], reelsToFilm: [{ n: 7, idea: "An idea", words: "Words.", why: "", principle: null }] } };
    lay(old.folder, "final/Session, 2026-10-22.brimm-ops.json", session);
    assert.deepEqual(all(), [8, 8]);
    // What is not a session's teachings is passed over.
    lay(old.folder, "Other.principles.json", { format: "something else", principles: [{ n: 90 }] });
    lay(old.folder, "Broken.principles.json", "{ not json");
    assert.deepEqual(all(), [8, 8]);
    t.done();
  });
  it("counts the numbers a client's agreement was noted for, so that no new item takes one (F8b fix 4)", () => {
    const t = setup();
    const mark = { marked: "2026-10-22T10:00:00-05:00", on: "Mac Studio", teachings: "asked", cleared: null };
    const old = original(t, { kind: "session", session: { ...mark, agreed: [{ n: 3, at: "2026-10-22" }, { n: 7, at: "2026-10-22" }] } });
    assert.equal(highestNumberOf(t.root, old.record), 7);
    // A later version of the video numbers on from it too.
    const next = later(t, SECOND, ID);
    assert.equal(highestNumberOf(t.root, next.record), 7);
    // A session with no agreement and no file holding a number has none to count.
    const bare = episodeAs(t, { id: "e-20261023-0a0a0a", name: "2026-10-23 Another talk (Mac Studio)", record: { kind: "session", session: mark } });
    assert.equal(highestNumberOf(t.root, bare.record), 0);
    t.done();
  });
  it("is what numbersTakenWords and handoffTarget's `taken` hold a session's items to as well (F7 fix 8)", () => {
    // A session's hand-off giving principle 1, recurring principle 2 and Reel idea 3 again is refused, in plain words.
    const record = { id: ID, kind: "session", name: { text: "Session, 2026-10-22", placeholder: false }, session: { marked: "2026-10-22T10:00:00-05:00", cleared: null } };
    const handoff = { session: { principles: [{ n: 1 }, { n: 5 }], recurringPrinciples: [{ n: 2 }], reelsToFilm: [{ n: 3 }] } };
    assert.equal(numbersTakenWords(record, handoff, [1, 2, 3]), "Session, 2026-10-22's hand-off would give principle 1, recurring principle 2 and Reel idea 3 again: another version of the video gave those numbers already, and a number is never given twice within a video. Ask Jason. Nothing was written.");
    assert.equal(numbersTakenWords(record, handoff, [4, 6]), "");
    // Another version's session hand-off under the id: its items' numbers are taken.
    const t = setup();
    const old = original(t);
    const next = later(t, SECOND, ID);
    const session = { ...V2.session, video: { ...V2.session.video, id: ID }, reels: [], session: { principles: [{ ...V2.session.session.principles[0], n: 6 }], recurringPrinciples: [{ n: 8, text: "A point." }], reelsToFilm: [{ n: 7, idea: "An idea", words: "Words.", why: "", principle: null }] } };
    lay(old.folder, "final/Session, 2026-10-22.brimm-ops.json", session);
    const v2 = { root: t.root, settings: { ...t.ctx.settings, handoffVersion: 2 } };
    assert.deepEqual(handoffTarget(v2, next).taken, [6, 7, 8]);
    t.done();
  });
  it("takes nothing from another video, and passes over what cannot be read", () => {
    const t = setup();
    const old = original(t, { reels: [reelOf(2)] });
    const other = episodeAs(t, { id: "e-20261023-0a0a0a", name: "2026-10-23 Another talk (Mac Studio)", record: { kind: "finished", reels: [reelOf(40)] } });
    writeFileSync(join(other.folder, "reels.json"), JSON.stringify(reelsList(50, [41])));
    lay(other.folder, "final/b.brimm-ops.json", handoffOf(2, other.record.id, 1));
    lay(old.folder, "final/c.brimm-ops.json", { ...handoffOf(2, SECOND, 1), reels: [{ ...V2.finished.reels[0], n: 60, fromSuggestion: null }] });
    writeFileSync(join(old.folder, "reels.json"), "{ not json");
    lay(old.folder, "history/x reels.json", { highest: "12", candidates: "none" });
    assert.equal(highestNumberOf(t.root, old.record), 2);
    assert.equal(highestNumberOf(t.root, other.record), 50);
    t.done();
  });
  it("writes nothing and calls nothing", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 1));
    writeFileSync(join(old.folder, "reels.json"), JSON.stringify(reelsList(7, [6])));
    const next = later(t, SECOND, ID);
    const tree = () => listAll(t.dir).map((rel) => [rel, statSync(join(t.dir, rel)).size, statSync(join(t.dir, rel)).mtimeMs]);
    const before = tree();
    assert.equal(highestNumberOf(t.root, next.record), 7);
    assert.deepEqual(tree(), before);
    assert.deepEqual([t.clones, t.calls, t.opened], [[], [], []]);
    t.done();
  });
});

// A video's id on the BRIMM Ops page never changes across its revisions (spec 2026-10-22, section 8), and a session's words are
// redacted by it. When a video handed off as version 2 under one id is linked since to an earlier version, its versions lead to
// another id: a hand-off under that one would start the video afresh on the page. That is refused, naming the video as edit.js
// names it.
describe("a hand-off of a video whose versions now lead to another id than the one it went to the page under", () => {
  const moved = (from, to) => `${SHOWN} went to the BRIMM Ops page under ${from}, but its versions now lead to ${to}: ask Jason. Nothing was written.`;
  it("is refused by spell, by the quick part of finish at once, and by its detached part, and nothing is written", async () => {
    const t = setup();
    handoffVersion(t, 2);
    firstCut(t);
    const found = await asked(t, { ...EDITED, label: LABEL });
    assert.equal((await finishNow(t.ctx, found)).ok, true);
    assert.equal(handoffIn(found).video.id, ID);
    // Her answer is given again: the video is a new version of the first cut.
    const now = reread(found);
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, versionOf: FIRST }));
    const before = episodesTree(t);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, moved(ID, FIRST)]);
    const said = t.said().split("\n").length;
    t.shared(`${PROJECT["reel 1"]}.mov`, 9000, "a longer finished video");
    assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true }), 1);
    assert.deepEqual(t.said().split("\n").slice(said), [moved(ID, FIRST)], "at once: no part line, no folder");
    assert.deepEqual(episodesTree(t), before, "final/ and the record as they were");
    // A hand-off set aside into history/ is one the page holds as well. The detached part refuses it too.
    const t2 = setup();
    handoffVersion(t2, 2);
    firstCut(t2);
    const found2 = await asked(t2, { ...EDITED, versionOf: FIRST, label: LABEL, ...OPEN });
    lay(found2.folder, "history/2026-10-21 09.00 Pricing- what to charge-.brimm-ops.json", handoffOf(2, ID, 1));
    const before2 = episodesTree(t2);
    const result = await finishNow(t2.ctx, found2);
    assert.deepEqual(result.failed, [moved(ID, FIRST)]);
    assert.deepEqual(episodesTree(t2), before2);
    // A hand-off of version 1, under the episode's own id as version 1 always was, is not one it went to the page under as
    // version 2.
    rmSync(join(found2.folder, "history"), { recursive: true });
    lay(found2.folder, "history/2026-10-21 09.00 Pricing- what to charge-.brimm-ops.json", { ...handoffOf(1, ID, 1), reels: [] });
    assert.equal((await finishNow(t2.ctx, found2)).ok, true);
    t.done();
    t2.done();
  });
});

// The hand-offs read for a video's id are those of the folders of its versions, and of any folder whose record this Mac cannot
// read yet (one Dropbox is still bringing over, which may be a version of it): not every folder in Episodes, whose finished
// ones she may have made online-only, and which a read would bring back down.
describe("the folders whose hand-offs are read for a video", () => {
  it("are its versions' and those with no whole record, and no other video's", () => {
    const t = setup();
    const old = original(t);
    lay(old.folder, "final/a.brimm-ops.json", handoffOf(2, ID, 3));
    const next = later(t, SECOND, ID);
    lay(next.folder, "history/b.brimm-ops.json", handoffOf(2, ID, 4));
    const v2 = { root: t.root, settings: { handoffVersion: 2 } };
    assert.deepEqual([nextRevision(t.root, old), handoffTarget(v2, old).revision], [5, 5]);
    // A folder with no record yet, and one whose record cannot be read, each holding a hand-off for the id: they still count.
    const coming = join(t.root, "Episodes", "2026-10-21 Pricing talk, coming (Mac Studio)");
    lay(coming, "final/c.brimm-ops.json", { ...handoffOf(2, ID, 6), suggestions: [{ ...V2.finished.suggestions[0], n: 8 }], reels: [] });
    const broken = join(t.root, "Episodes", "2026-10-21 Pricing talk, broken (Mac Studio)");
    mkdirSync(join(broken, "record"), { recursive: true });
    writeFileSync(join(broken, "record", "1.json"), "{ not a record");
    lay(broken, "history/d.brimm-ops.json", handoffOf(1, ID, 7));
    assert.deepEqual([nextRevision(t.root, old), handoffTarget(v2, old).revision], [8, 8]);
    assert.deepEqual(handoffTarget(v2, next).taken, [1, 2, 3, 8], "their numbers are taken too");
    // Another video's folder holds a hand-off for the id (which only a link since moved could leave there): it is not read.
    const other = episodeAs(t, { id: THIRD, name: "2026-10-22 Another talk (Mac Studio)", record: { kind: "finished" } });
    lay(other.folder, "final/e.brimm-ops.json", { ...handoffOf(2, ID, 9), suggestions: [], reels: [{ ...V2.finished.reels[0], n: 9, fromSuggestion: null }] });
    assert.deepEqual([nextRevision(t.root, old), handoffTarget(v2, old).revision, highestNumberOf(t.root, old.record)], [8, 8, 8]);
    assert.deepEqual(handoffTarget(v2, next).taken, [1, 2, 3, 8]);
    t.done();
  });
});

// spell on a finished video spells its final transcripts and makes its hand-off again. A client or group session's, and a video
// not yet answered, it refuses at once, as finish does (finish.js cannotFinish), before any file in final/ is named or read:
// a second line behind the gate every command passes (Part F). The gate comes first, and refuses spell for both in its own words
// (gate.js), before anything of the episode but its records is read.
describe("spell, for a finished video that is now a session or not answered", () => {
  /** The gate's words for spell, for each of NOT_YET. */
  const GATE_SAYS = { "a client or group session": "This is a client or group session: that is not done for one.", "a video not yet answered": "This video is waiting for its answer: say what it is first." };
  it("refuses it at once, in the gate's words, before any file in final/ is named or read, and writes nothing", async () => {
    for (const version of [undefined, 1, 2]) {
      for (const [what, kind] of NOT_YET) {
        for (const label of [LABEL, null]) {
          const t = setup();
          if (version) handoffVersion(t, version);
          const found = await asked(t, { ...EDITED, ...(label ? { label } : {}) });
          assert.equal((await finishNow(t.ctx, found)).ok, true);
          // What the video is says so only now, as after her answer was given again, or the session was marked.
          const now = reread(found);
          writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...kind }));
          // final/ goes, so that a spelling which looked in it would name what it did not find there.
          rmSync(join(found.folder, "final"), { recursive: true });
          const how = `${what}, setting ${version}, ${label ? "labelled" : "no label"}`;
          const before = episodesTree(t);
          const started = t.started.length;
          const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
          assert.deepEqual([r.code, r.text], [1, GATE_SAYS[what]], how);
          assert.doesNotMatch(r.text, /final\/|Pricing|\.mp4|\.mov|\.srt/, `${how}: no file named`);
          assert.deepEqual(episodesTree(t), before, `${how}: the record as it was, and no spelling kept`);
          assert.deepEqual(t.started.slice(started), [], `${how}: nothing started, nothing brought over`);
          t.done();
        }
      }
    }
  });
});

// ...and behind the gate: a session whose mark she cleared with her click on the dialog is no longer gated, so the gate lets spell
// through for it, and cannotFinish is the only line left (M-1 of the merge's review).
describe("spell, for a finished video that is now a session whose mark she cleared", () => {
  const CLEARED = { marked: "2026-10-22T10:00:00-05:00", on: "Mac Studio", teachings: null, cleared: { at: "2026-10-22T11:00:00-05:00", on: "Mac Studio", to: "finished", confirmed: "dialog" } };
  it("is refused in cannotFinish's words, before any file in final/ is named or read, and nothing is written", async () => {
    for (const version of [undefined, 1, 2]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      const found = await asked(t, { ...EDITED, label: LABEL });
      assert.equal((await finishNow(t.ctx, found)).ok, true);
      // It is a session now, as after a corrected answer, and its mark was cleared: the gate lets any command through for it.
      const now = reread(found);
      writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, kind: "session", name: { text: "Session, 2026-10-14", placeholder: false }, session: CLEARED }));
      // final/ goes, so that a spelling which looked in it would name what it did not find there.
      rmSync(join(found.folder, "final"), { recursive: true });
      const how = `setting ${version}`;
      const before = episodesTree(t);
      const started = t.started.length;
      const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
      assert.deepEqual([r.code, r.text], [1, NOT_YET[0][2]("Session, 2026-10-14")], how);
      assert.doesNotMatch(r.text, /final\/|Pricing|\.mp4|\.mov|\.srt/, `${how}: no file named`);
      assert.deepEqual(episodesTree(t), before, `${how}: the record as it was, and no spelling kept`);
      assert.deepEqual(t.started.slice(started), [], `${how}: nothing started, nothing brought over`);
      t.done();
    }
  });
});

// A finished video's Reel suggestions as its hand-off holds them: the whole video is kept, so each is one stretch of the video's own
// clock, its candidate's range, to the hundredth of a second and within the video (the raw video's, which suggestionsOnClock maps
// through its cuts by its words, is another matter).
describe("suggestionsFrom: a finished video's Reel suggestions for its hand-off", () => {
  const c = (n, start, end, over = {}) => ({ n, ranges: [{ start, end }], first: "Welcome to the", last: "so much, Sallie Ogdin", reason: "It stands alone.", point: "A point.", ...over });
  it("gives each candidate as one stretch, to the hundredth of a second, as the hand-off's other times are", () => {
    const { list, left } = suggestionsFrom({ candidates: [c(1, 1.234, 4.999), c(4, 10.005, 12.5)], seconds: 23.423 });
    assert.deepEqual(left, []);
    assert.deepEqual(list, [
      { n: 1, start: 1.23, end: 5, stretches: [{ start: 1.23, end: 5 }], first: "Welcome to the", last: "so much, Sallie Ogdin", why: "It stands alone.", point: "A point." },
      { n: 4, start: 10.01, end: 12.5, stretches: [{ start: 10.01, end: 12.5 }], first: "Welcome to the", last: "so much, Sallie Ogdin", why: "It stands alone.", point: "A point." }
    ]);
  });
  it("clamps an end that runs past the video to the video's length, to the hundredth", () => {
    const { list } = suggestionsFrom({ candidates: [c(1, 20, 23.5), c(2, 20, 23.423)], seconds: 23.423 });
    assert.deepEqual(list.map((x) => [x.start, x.end, x.stretches[0].end]), [[20, 23.42, 23.42], [20, 23.42, 23.42]]);
  });
  it("leaves out one whose times are no stretch of the video, saying so, and keeps the others", () => {
    const { list, left } = suggestionsFrom({ candidates: [c(1, 24, 30), c(2, 23.42, 25), c(3, -1, 4), c(4, 5, 5.001), c(5, 2, 6)], seconds: 23.423 });
    // Past the end; starting where the video ends; starting before it; shorter than a hundredth of a second.
    assert.deepEqual(list.map((x) => x.n), [5]);
    assert.deepEqual(left, [1, 2, 3, 4].map((n) => `Suggestion ${n} is left out of the hand-off: its times are not a stretch of the video.`));
  });
  it("passes over, without a word, one the record dropped and one with no stretch", () => {
    const { list, left } = suggestionsFrom({ candidates: [c(1, 1, 4), c(2, 5, 8), { ...c(3, 0, 0), ranges: [] }, c(4, 9, 12)], dropped: [2], seconds: 23.423 });
    assert.deepEqual([list.map((x) => x.n), left], [[1, 4], []]);
  });
  it("spells the first and last words with the show's names and the episode's spellings, and not the reason or the point", () => {
    const { list } = suggestionsFrom({ candidates: [c(1, 1, 4, { first: "Sally says", last: "so much, Sallie Ogdin", reason: "Sallie Ogdin says it.", point: "Ogdin" })], spellings: [["Ogdin", "Ogden"]], seconds: 23.423 });
    assert.deepEqual([list[0].first, list[0].last, list[0].why, list[0].point], ["Sallie says", "so much, Sallie Ogden", "Sallie Ogdin says it.", "Ogdin"]);
  });
  it("leaves out one with no first words, no last words, no reason or no point, saying which, since the page needs all four", () => {
    const { list, left } = suggestionsFrom({ candidates: [c(1, 1, 4, { first: " " }), c(2, 5, 8, { last: "" }), c(3, 9, 12, { reason: undefined }), c(4, 13, 16, { point: "" }), c(5, 17, 20)], seconds: 23.423 });
    assert.deepEqual(list.map((x) => x.n), [5]);
    assert.deepEqual(left, ["first words", "last words", "reason", "point"].map((what, i) => `Suggestion ${i + 1} is left out of the hand-off: it has no ${what}.`));
  });
});

// A finished video's or an iPhone clip's hand-off, once its spellings are answered (spec 2026-10-22, section 3): written in the
// shape finish writes (record.finished, the transcripts in final/, the hand-off last), from the import's own captions, with no
// Final Cut, no render and no transcriber. handoffTarget is asked first, then the hand-off is built and checked, then
// numbersTakenWords; cannotFinish refuses a session and an unanswered video before any folder is looked in.
describe("finishFinished: the hand-off of a finished video or an iPhone clip whose spellings are answered", () => {
  const SHOT = "Talk";
  const CAPTIONS = "1\n00:00:01,000 --> 00:00:04,000\n Welcome to the show.\n\n2\n00:00:05,000 --> 00:00:09,000\n Thank you so much, Sallie.\n\n";
  /** The made-up recording as an answered finished video (or `record`'s kind), its import's captions beside it. */
  const video = (t, record = {}, captions = CAPTIONS) => {
    const found = episodeAs(t, { id: ID, name: "2026-10-22 Talk (Mac Studio)", record: { kind: "finished", label: LABEL, ...(captions !== null ? { files: { [`${SHOT}.srt`]: Buffer.byteLength(captions) } } : {}), ...record } });
    if (captions !== null) writeFileSync(join(found.folder, `${SHOT}.srt`), captions);
    return found;
  };
  /** A Reel suggestion as a reading writes it into reels.json, and the file, put beside the captions. */
  const CANDIDATE = { n: 1, start: 1, end: 4, ranges: [{ start: 1, end: 4 }], seconds: 3, title: "", reason: "It stands alone.", point: "A point.", first: "Welcome to the show", last: "to the show", preview: null };
  const reelsOf = (found, candidates = [CANDIDATE]) => writeFileSync(join(found.folder, "reels.json"), JSON.stringify({ format: "brimm-video reels", version: 2, video: "Talk.mp4", by: "read", made: "2026-10-22T09:00:00-05:00", highest: Math.max(0, ...candidates.map((c) => c.n)), candidates }));
  /** The programs it ran: none but `open`. */
  const ran = (t) => t.calls.map((c) => c.cmd);
  it("writes final/ and record.finished as finish does, the hand-off last, shows it in Finder, and runs nothing else", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t);
    const done = await finishFinished(t.ctx, found, { record: { ...found.record, spellings: [["Sallie", "Sally"]] } });
    assert.deepEqual([done.ok, done.revision, done.handoff], [true, 1, "final/Talk.brimm-ops.json"]);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", "Talk.brimm-ops.json"), "utf8"));
    assert.deepEqual([handoff.version, handoff.revision, handoff.video.id, handoff.video.kind, handoffFaultV2(handoff)], [2, 1, ID, "finished", ""]);
    assert.match(handoff.main.srt, /Thank you so much, Sally\./, "the episode's spellings are in the captions");
    assert.deepEqual(t.inFinal(found), ["Talk.brimm-ops.json", "Talk.srt", "Talk.transcript.txt"]);
    const intoFinal = t.clones.map(([, to]) => to).filter((to) => to.startsWith(join(found.folder, "final") + "/"));
    assert.equal(intoFinal[intoFinal.length - 1], join(found.folder, "final", "Talk.brimm-ops.json"), "the hand-off is copied in last");
    const record = reread(found);
    assert.deepEqual([record.finished.revision, record.finished.on, record.finished.handoff, Object.keys(record.finished.parts)], [1, "Mac Studio", "final/Talk.brimm-ops.json", ["main"]]);
    assert.deepEqual(record.finished.parts.main.spellings, [["Sallie", "Sally"]]);
    assert.deepEqual(Object.keys(record.files).filter((rel) => rel.startsWith("final/")).sort(), ["final/Talk.brimm-ops.json", "final/Talk.srt", "final/Talk.transcript.txt"]);
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(found.folder, "final", "Talk.brimm-ops.json")] }]);
    t.done();
  });
  it("writes the record it is found with when it is given no other: finishFinished(ctx, found)", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, {});
    writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1, spellings: [["Sallie", "Sally"]] }));
    const now = { ...found, record: reread(found) };
    const done = await finishFinished(t.ctx, now);
    assert.deepEqual([done.ok, done.revision], [true, 1]);
    assert.deepEqual(reread(found).finished.parts.main.spellings, [["Sallie", "Sally"]]);
    assert.match(readFileSync(join(found.folder, "final", "Talk.srt"), "utf8"), /Thank you so much, Sally\./);
    t.done();
  });
  it("is the same for an iPhone clip, whose hand-off holds no suggestions and no Reels", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, { kind: "short video" });
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.equal(done.ok, true, done.why);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", "Talk.brimm-ops.json"), "utf8"));
    assert.deepEqual([handoff.video.kind, "suggestions" in handoff, "reels" in handoff, handoffFaultV2(handoff)], ["short video", false, false, ""]);
    t.done();
  });
  it("says it waits, and writes and runs nothing, when this Mac does not hand off version 2", async () => {
    for (const version of [undefined, 1]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      const found = video(t);
      const before = episodesTree(t);
      assert.deepEqual(await finishFinished(t.ctx, found, { record: found.record }), { waits: true });
      assert.deepEqual(episodesTree(t), before);
      assert.deepEqual(t.calls, []);
      t.done();
    }
  });
  it("refuses a session and a video not yet answered at once, in cannotFinish's words, before any file is looked at", async () => {
    for (const [what, kind, who] of [NOT_YET[0], NOT_YET[1]].map(([w, k, say, named]) => [w, k, { say, named }])) {
      for (const version of [undefined, 1, 2]) {
        const t = setup();
        if (version) handoffVersion(t, version);
        const found = video(t, kind, null);
        // Neither its captions nor its folder are there: a refusal that looked for them would say so.
        const record = { ...found.record };
        rmSync(found.folder, { recursive: true });
        const done = await finishFinished(t.ctx, { ...found, record }, { record });
        assert.deepEqual(done, { why: cannotFinish(record) }, `${what}, setting ${version}`);
        assert.equal(done.why, who.say(who.named(record.label)));
        assert.deepEqual(t.calls, []);
        t.done();
      }
    }
  });
  it("refuses a raw video: its hand-off comes at its finish", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, { kind: "raw" });
    const before = episodesTree(t);
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.deepEqual(done, { why: `${SHOT} is a raw video: its hand-off is made when it is finished in Final Cut. Nothing was written.` });
    assert.deepEqual(episodesTree(t), before);
    t.done();
  });
  it("refuses with handoffTarget's words, and writes nothing, on a gap in the chain of the video's versions, by the video's name", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, { versionOf: FIRST });
    const before = episodesTree(t);
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.deepEqual(done, { why: chainGapWords(found.record, { id: FIRST, reason: "missing" }) });
    assert.deepEqual(episodesTree(t), before);
    assert.deepEqual(t.calls, []);
    t.done();
  });
  it("asks handoffTarget before it looks for the captions: a gap in the chain is said even when there are none", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, { versionOf: FIRST }, null);
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.deepEqual(done, { why: chainGapWords(found.record, { id: FIRST, reason: "missing" }) });
    t.done();
  });
  it("refuses, and writes nothing, a hand-off that gives a number again which another version of the video gave", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    lay(first.folder, "final/Talk, first cut.brimm-ops.json", handoffOf(2, FIRST, 3));
    const found = video(t, { versionOf: FIRST });
    reelsOf(found);
    const before = episodesTree(t);
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.deepEqual(done, { why: `${SHOT}'s hand-off would give suggestion 1 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.` });
    assert.deepEqual(episodesTree(t), before);
    assert.deepEqual(t.calls, []);
    t.done();
  });
  it("asks for the captions to be brought over when they are not whole here", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, {});
    t.ctx.isWhole = (path) => !path.endsWith("Talk.srt");
    assert.deepEqual(await finishFinished(t.ctx, found, { record: found.record }), { coming: ["Talk.srt"] });
    assert.deepEqual(t.inFinal(found), []);
    t.done();
  });
  it("refuses a video with no captions of the import, and captions the BRIMM Ops page cannot read, writing nothing", async () => {
    for (const [captions, why] of [[null, `${SHOT} has no captions from the import to hand off. Nothing was written.`], ["", `The hand-off could not be written: The main video's captions cannot be read. Nothing was written.`]]) {
      const t = setup();
      handoffVersion(t, 2);
      const found = video(t, {}, captions);
      const before = episodesTree(t);
      assert.deepEqual(await finishFinished(t.ctx, found, { record: found.record }), { why });
      assert.deepEqual(episodesTree(t), before);
      t.done();
    }
  });
  it("lets go the claim this Mac holds, as finish does", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t, { editing: { by: "Mac Studio", since: "2026-10-22T09:00:00-05:00" } });
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    assert.equal(reread(found).editing, null);
    t.done();
  });
  it("leaves another Mac's claim as it is: the command that asks has refused already when another Mac holds the episode", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const held = { by: "Sallie's laptop", since: "2026-10-22T09:00:00-05:00" };
    const found = video(t, { editing: held });
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    assert.deepEqual(reread(found).editing, held);
    t.done();
  });
  it("refuses a hand-off made as another kind than the video is now, writing nothing: it waits for its new reading", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t);
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    const now = { ...found, record: { ...reread(found), kind: "short video" } };
    const before = episodesTree(t);
    assert.deepEqual(await finishFinished(t.ctx, now, { record: now.record }), { why: `${SHOT}'s hand-off was made as another kind than it is now: it waits for its new reading. Nothing was written.` });
    assert.deepEqual(episodesTree(t), before);
    t.done();
  });
  it("refuses when Dropbox undid this Mac's last change to the episode, writing nothing, and goes through when it is said again", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t);
    acceptRev(t.home, ID, found.record.rev + 3);
    const before = episodesTree(t);
    assert.deepEqual(await finishFinished(t.ctx, found, { record: found.record }), { why: `Dropbox undid this Mac's last change to ${SHOT}. Say it again. Nothing was written.` });
    assert.deepEqual(episodesTree(t), before);
    assert.deepEqual(t.calls, []);
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    t.done();
  });
  it("refuses a hand-off made again that would give a number again which another version of the video has given since, writing nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    const found = video(t, { versionOf: FIRST });
    reelsOf(found);
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    // The first version's hand-off, with suggestions 1 and 2, comes to this Mac after this one was written.
    lay(first.folder, "final/Talk, first cut.brimm-ops.json", handoffOf(2, FIRST, 3));
    const now = { ...found, record: reread(found) };
    const before = episodesTree(t);
    t.calls.length = 0;
    const done = await finishFinished(t.ctx, now, { record: { ...now.record, spellings: [["Sallie", "Sally"]] } });
    assert.deepEqual(done, { why: `${SHOT}'s hand-off would give suggestion 1 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.` });
    assert.deepEqual(episodesTree(t), before);
    assert.deepEqual(t.calls, []);
    t.done();
  });
  it("makes the hand-off again when the one on file is gone, as the next revision, with no bring", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t);
    assert.equal((await finishFinished(t.ctx, found, { record: found.record })).ok, true);
    rmSync(join(found.folder, "final", "Talk.brimm-ops.json"));
    const now = { ...found, record: reread(found) };
    const done = await finishFinished(t.ctx, now, { record: now.record });
    assert.deepEqual([done.ok, done.revision, done.same], [true, 2, false]);
    assert.equal(JSON.parse(readFileSync(join(found.folder, "final", "Talk.brimm-ops.json"), "utf8")).revision, 2);
    t.done();
  });

  it("writes nothing into final/ that the record could not then take: the files go out again, and the hand-off is not shown", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = video(t);
    // The other Mac writes the next record while this one copies the hand-off in.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("Talk.brimm-ops.json")) writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1 }));
    };
    const done = await finishFinished(t.ctx, found, { record: found.record });
    assert.equal(done.ok, undefined);
    assert.match(done.why, /Nothing was written: this episode changed on the other Mac: open it again\./);
    assert.deepEqual(t.inFinal(found), []);
    assert.deepEqual(t.calls, []);
    t.done();
  });
});

const LEGACY_ADD = '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If the main video shows captions on screen, they keep the old spelling until it is shown in Final Cut, Shared and finished again.';
// A short video as today's import makes one is shown in Final Cut, and finished there: its spell says what every Final Cut video's
// says, with the way to see it, and what is kept until it is Shared again.
describe("spell, after a finish, for a short video as today's import makes one", () => {
  it("says what a Final Cut video's spell says: the way to see it in Final Cut, and the hand-off made again", async () => {
    for (const version of [undefined, 2]) {
      const t = setup();
      if (version) handoffVersion(t, version);
      const found = await asked(t, { ...EDITED, kind: "short video" });
      assert.equal((await finishNow(t.ctx, found)).ok, true);
      const add = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
      assert.deepEqual([add.code, add.text], [0, LEGACY_ADD]);
      const drop = await command(t, "spell", FOLDER, "drop", "Sallie");
      assert.equal(drop.code, 0, drop.text);
      assert.match(drop.text, /^"Sallie" is as the transcriber writes it again\. Say "show it in Final Cut" to see it\. /);
      t.done();
    }
  });
});

describe("the README, of version 1's revision", () => {
  it("says that a version 1 hand-off's revision is above the ones set aside into history/ too, which came with the settings unchanged", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const v1 = readme.split("\n").find((line) => line.startsWith("**The hand-off**, `final/<name>.brimm-ops.json`, version 1"));
    assert.ok(v1, "the README's paragraph on version 1");
    assert.match(v1, /`revision`[^.]*`history\/`/);
    assert.match(v1, /settings unchanged/);
  });
});
