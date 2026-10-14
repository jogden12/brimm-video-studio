// finish, the detached part (finish.js): wait for Final Cut's files, check them, transcribe each finished video again, cut
// Story parts from a finished Reel, copy everything into the episode's final/ by the Dropbox rule, write the hand-off and
// the record, show the hand-off, and after the late check empty From Final Cut of what it took. In a made-up episode
// (episodes.js), with stand-ins for ffprobe, ffmpeg, the transcriber and open.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { handoffFault } from "../handoff.js";
import { recordFile, recordText } from "../episode.js";
import { clearRuns } from "../filing.js";
import { runsFolder } from "../settings.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { fromFinalCutFolder } from "../settings.js";
import { tidyTranscript } from "../shared/transcript.js";
import { setup, episodeFor, reread, EDITED, PROJECT, SRT, FOLDER, partOf } from "./episodes.js";
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
    let t = null;
    let found = null;
    t = setup({ programs: { WHISPER: (args) => {
      if (!wrote && found) {
        wrote = true;
        writeFileSync(recordFile(found.folder, found.record.rev + 1), recordText({ ...found.record, rev: found.record.rev + 1 }));
      }
      const base = args[args.indexOf("-of") + 1];
      writeFileSync(base + ".srt", SRT[partOf(args[args.indexOf("-f") + 1])] || SRT.main);
      return { code: 0, stderr: "" };
    } } });
    found = await asked(t);
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
  it("keeps the files in final/ and leaves the record alone when the other Mac changes the episode while it works", async () => {
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
    assert.match(result.failed.join(" "), /this episode changed on the other Mac: open it again/);
    assert.ok(existsSync(join(found.folder, "final", HANDOFF)));
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), [], "the hand-off is not shown when the record was not written");
    assert.equal(readdirSync(fromFinalCutFolder(t.home)).length, 5, "From Final Cut keeps every file");
    t.done();
  });
});
