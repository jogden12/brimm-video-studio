// finish, the detached part (finish.js): wait for Final Cut's files, check them, transcribe each finished video again, cut
// Story parts from a finished Reel, copy everything into the episode's final/ by the Dropbox rule, write the hand-off and
// the record, show the hand-off, and after the late check empty From Final Cut of what it took. In a made-up episode
// (episodes.js), with stand-ins for ffprobe, ffmpeg, the transcriber and open.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow, expectedWords, lastRevision, chainOf, chainGap, chainGapWords, nextRevision, handoffIdOf, handoffTarget, highestNumberOf, writesV2For } from "../finish.js";
import { handoffFault } from "../handoff.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { recordFile, recordText } from "../episode.js";
import { clearRuns } from "../filing.js";
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
/** The label a light import gives the made-up episode, which names it in every refusal. */
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
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
const MISSING = `${LABEL} is a new version of a video that is not on this Mac yet (${FIRST}). Wait for Dropbox to bring it over, then say it again. Nothing was written.`;

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
      for (const [label, who] of [[LABEL, LABEL], [null, "This video"]]) {
        const t = setup();
        handoffVersion(t, 2);
        const first = firstCut(t);
        lay(first.folder, rel, handoffOf(2, FIRST, 3));
        const found = await asked(t, { ...EDITED, versionOf: FIRST, ...(label ? { label } : {}), ...OPEN });
        const before = episodesTree(t);
        const result = await finishNow(t.ctx, found);
        assert.equal(result.ok, false, where);
        assert.deepEqual(result.failed, [`${who}'s hand-off would give Reel 1 and Reel 2 again: another version of the video gave those numbers already, and a number is never given twice within a video. Ask Jason. Nothing was written.`], where);
        assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, "no name");
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
    assert.deepEqual(result.failed, [`${LABEL}'s hand-off would give Reel 2 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
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
  it("refuses a new version whose first version Dropbox has not brought to this Mac, by its label, and writes nothing", async () => {
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
    assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, "no file name");
    assert.deepEqual(episodesTree(t), before, "nothing in final/, and the record as it was");
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), []);
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5, "From Final Cut keeps every file");
    t.done();
  });
  it("refuses a new version whose first version names it as its own earlier version, by its label, and writes nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const first = firstCut(t);
    const found = await asked(t, { ...EDITED, versionOf: FIRST, label: LABEL, ...OPEN });
    // The first version comes to say it is a version of this one, after finish was asked.
    writeFileSync(recordFile(first.folder, 2), recordText({ ...first.record, rev: 2, versionOf: ID }));
    const before = episodesTree(t);
    const result = await finishNow(t.ctx, found);
    assert.equal(result.ok, false);
    assert.deepEqual(result.failed, [`${LABEL} and the video it names as its earlier version (${FIRST}) each say they are a version of the other: ask Jason. Nothing was written.`]);
    assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, "no file name");
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
    assert.deepEqual(result.failed, [`${LABEL} is a new version of a video whose earlier versions name each other as earlier versions, in a circle (${FIRST}): ask Jason. Nothing was written.`]);
    assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, "no file name");
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
  it("refuses it before anything is waited for, taken, transcribed or copied, by its label or else as 'This video', and leaves final/ and the record as they were", async () => {
    for (const version of [undefined, 1, 2]) {
      for (const [what, kind, words] of NOT_YET) {
        for (const [label, who] of [[LABEL, LABEL], [undefined, "This video"]]) {
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
  it("refuses, by its label, a hand-off that would give a number again which another version's hand-off gave, and writes nothing; its own earlier revisions give them by right", async () => {
    const t = setup();
    const { first, found } = await finishedAgain(t);
    // The first cut's hand-off of version 1, with its Reels 1 and 3, comes to this Mac set aside in its history/.
    lay(first.folder, "history/2026-10-21 09.00 Pricing talk, first cut.brimm-ops.json", handoffOf(1, FIRST, 2));
    const before = episodesTree(t);
    const r = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, `${LABEL}'s hand-off would give Reel 1 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
    assert.deepEqual(episodesTree(t), before, "final/ and the record as they were, and no spelling kept");
    // Its own final/ and history/ hold Reels 1 and 2 already, at revision 4: those it gives again.
    rmSync(join(first.folder, "history"), { recursive: true });
    lay(found.folder, "history/2026-10-22 09.00 Pricing- what to charge-.brimm-ops.json", handoffIn(found));
    const again = await command(t, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(again.code, 0, again.text);
    assert.deepEqual([handoffIn(found).revision, handoffIn(found).reels.map((x) => x.n)], [5, [1, 2]]);
    t.done();
  });
  it("refuses, by its label, when the first version's folder has gone from this Mac, and writes nothing", async () => {
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
// later, is a session whose mark is not cleared (one with no mark at all among them): the video is named by its label, else
// "This video", never by its name.
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
        for (const [label, who] of [[LABEL, LABEL], [null, "This video"]]) {
          const t = setup();
          const how = `${earlier ? "earlier" : "later"}: ${what}, ${who}`;
          const found = await askedBeside(t, { earlier, as, label });
          const before = episodesTree(t);
          const result = await finishNow(t.ctx, found);
          assert.equal(result.ok, false, how);
          assert.deepEqual(result.failed, [refusedAs(who)], how);
          assert.doesNotMatch(result.failed.join(" "), /Pricing|\.mp4|\.mov/, `${how}: no name`);
          assert.deepEqual(episodesTree(t), before, `${how}: nothing in final/, and every record as it was`);
          assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), [], how);
          t.done();
        }
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
        assert.deepEqual(t.said().split("\n"), [refusedAs(LABEL)], how);
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
        assert.deepEqual([r.code, r.text], [1, refusedAs(LABEL)], how);
        assert.deepEqual(episodesTree(t), before, `${how}: final/ and the record as they were, and no spelling kept`);
        t.done();
      }
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
// another id: a hand-off under that one would start the video afresh on the page. That is refused, by the video's label.
describe("a hand-off of a video whose versions now lead to another id than the one it went to the page under", () => {
  const moved = (from, to) => `${LABEL} went to the BRIMM Ops page under ${from}, but its versions now lead to ${to}: ask Jason. Nothing was written.`;
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
// a second line behind the gate every command passes (Part F).
describe("spell, for a finished video that is now a session or not answered", () => {
  it("refuses it at once, by its label or else as 'This video', before any file in final/ is named or read, and writes nothing", async () => {
    for (const version of [undefined, 1, 2]) {
      for (const [what, kind, words] of NOT_YET) {
        for (const [label, who] of [[LABEL, LABEL], [null, "This video"]]) {
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
          assert.deepEqual([r.code, r.text], [1, words(who)], how);
          assert.doesNotMatch(r.text, /final\/|Pricing|\.mp4|\.mov|\.srt/, `${how}: no file named`);
          assert.deepEqual(episodesTree(t), before, `${how}: the record as it was, and no spelling kept`);
          assert.deepEqual(t.started.slice(started), [], `${how}: nothing started, nothing brought over`);
          t.done();
        }
      }
    }
  });
});
