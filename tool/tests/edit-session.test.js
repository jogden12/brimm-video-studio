// `spell` (phase 4), end to end on the made-up episode, recording what it is asked in the record. The other commands of the session
// (logo, captions, text, graphic, preset and cut) are gone with Final Cut (Phase 2, F7).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { FOLDER, EDITED, reread, setup, episodeFor } from "./episodes.js";
import { recordFile, recordText } from "../episode.js";
import { buildHandoff, handoffText, handoffFault } from "../handoff.js";
import { episodeWork } from "../settings.js";
import { episode, episodeFiles } from "./phase4.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}

describe("spell", () => {
  it("lists, adds and drops the episode's spellings", async () => {
    const { t, found } = episode();
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER), { code: 0, text: "There are no spellings for this episode yet." });
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally"), { code: 0, text: '"Sallie" is spelled "Sally" now.' });
    assert.deepEqual(reread(found).spellings, [["Sallie", "Sally"]]);
    assert.equal(reread(found).version, 2);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie Ogden", "Sally")).text, '"Sallie Ogden" is not one word. Say the one word as the transcriber writes it.');
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
});

describe("spell, while a finish runs", () => {
  it("refuses a change, even before the finish has written its record, and a drop too, and writes nothing", async () => {
    const { t, found } = episode({ spellings: [["Sallie", "Sally"]] });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    const running = { ...t.ctx.deps, alive: (pid) => pid === 4242 };
    for (const ask of [["add", "Brim", "BRIMM"], ["drop", "Sallie"]]) {
      assert.equal((await on(running, "spell", FOLDER, ...ask)).text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.', ask[0]);
    }
    assert.deepEqual([reread(found).rev, reread(found).spellings], [1, [["Sallie", "Sally"]]]);
    // Listing them reads only.
    assert.equal((await on(running, "spell", FOLDER)).code, 0);
    t.done();
  });
});

describe("spell, after a finish", () => {
  const MAIN = "final/Pricing- what to charge- main v1 3fa9c1";
  const REEL = "final/Pricing- what to charge- reel 2 v1 3fa9c1";
  const HANDOFF = "final/Pricing- what to charge-.brimm-ops.json";
  const SRT = "1\n00:00:01,000 --> 00:00:02,000\nThank you so much, Sallie.\n\n";
  /** The episode as a finish leaves it: the transcripts of its main video and of Reel 2, with captions drawn into its picture,
      and the hand-off, in final/; and the record of it, holding `spellings`. */
  const finishedEpisode = (spellings = [], on = "Mac Studio") => {
    const { t, found } = episode();
    const words = JSON.stringify({ video: "m.mov", duration: 2, words: [{ w: "Sallie.", start: 1, end: 2 }] });
    const record = { ...reread(found), title: { text: "Price like you mean it", from: "person", approved: true } };
    const handoff = handoffText(buildHandoff({ record, revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "m.mov", seconds: 9, srt: SRT }, reels: [{ n: 2, title: "Know your costs", file: "r.mov", seconds: 7, srt: SRT }] }));
    mkdirSync(join(found.folder, "final"), { recursive: true });
    for (const stem of [MAIN, REEL]) for (const [rel, text] of [[`${stem}.srt`, SRT], [`${stem}.transcript.txt`, "[00:00:01] Thank you so much, Sallie.\n"], [`${stem}.words.json`, words]]) writeFileSync(join(found.folder, rel), text);
    writeFileSync(join(found.folder, HANDOFF), handoff);
    const part = (stem) => ({ v: 1, file: `${stem}.mov`, bytes: 9, seconds: 9, words: `${stem}.words.json` });
    const finished = { revision: 1, at: "2026-10-20T15:00:00-05:00", on, handoff: HANDOFF, parts: { main: part(MAIN), "reel 2": part(REEL) } };
    writeFileSync(recordFile(found.folder, 2), recordText({ ...record, rev: 2, spellings, finished }));
    return { t, found };
  };
  const text = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
  it("spells the final transcripts with a new spelling, makes the hand-off again as its next revision, and says a Reel's captions on screen keep the old", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.commit = "e72a170";
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Say "open it in HyperFrames" to edit it there, from the recording.');
    for (const stem of [MAIN, REEL]) assert.match(text(found, `${stem}.srt`), /Thank you so much, Sally\./);
    assert.match(text(found, `${MAIN}.transcript.txt`), /Sally\./);
    assert.deepEqual(JSON.parse(text(found, `${MAIN}.words.json`)).words.map((w) => w.w), ["Sally."]);
    const handoff = JSON.parse(text(found, HANDOFF));
    assert.deepEqual([handoff.revision, handoff.madeOn, handoff.madeBy, /Sally\./.test(handoff.main.srt), /Sally\./.test(handoff.reels[0].srt), handoffFault(handoff)], [2, "Mac Studio", "brimm-video e72a170", true, true, ""]);
    const now = reread(found);
    assert.deepEqual([now.finished.revision, now.finished.parts.main.spellings, now.finished.parts["reel 2"].spellings, now.files[HANDOFF]], [2, [["Sallie", "Sally"]], [["Sallie", "Sally"]], Buffer.byteLength(text(found, HANDOFF))]);
    t.done();
  });
  it("leaves final/ as it is while the other Mac's finish has its late check still to come, and says until when", async () => {
    // Sallie's laptop finished at 15:00, as this Mac's clock reads now: its late check of final/ is due 15 minutes after.
    const { t, found } = finishedEpisode([], "Sallie's laptop");
    const before = text(found, `${MAIN}.srt`);
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /^The finish on Sallie's laptop is still checking its copies in final\/, until 2026-10-20 15:17\. Say it again after that\. Nothing was changed\.$/);
    assert.deepEqual([text(found, `${MAIN}.srt`), reread(found).rev, reread(found).spellings], [before, 2, []]);
    t.done();
  });
  it("writes nothing into final/ when Dropbox undid this Mac's last change, and says so first", async () => {
    const { t, found } = finishedEpisode();
    // This Mac names it, and Dropbox takes that record away.
    assert.equal((await on(t.ctx.deps, "name", FOLDER, "Pricing, part one")).code, 0);
    rmSync(join(found.folder, "record", "0003.json"));
    const clones = t.clones.length;
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /Nothing was written\.$/);
    assert.equal(t.clones.length, clones, "nothing is cloned into the episode, not even to put it back");
    assert.doesNotMatch(text(found, `${MAIN}.srt`), /Sally\./);
    t.done();
  });
  it("makes the hand-off again with the episode's name and title as they are since the finish", async () => {
    const { t, found } = finishedEpisode();
    assert.equal((await on(t.ctx.deps, "name", FOLDER, "Pricing, part one")).code, 0);
    assert.equal((await on(t.ctx.deps, "title", FOLDER, "--words", "What to charge, and why", "--approve", "--change")).code, 0);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const handoff = JSON.parse(text(found, HANDOFF));
    assert.deepEqual([handoff.revision, handoff.episode.name, handoff.episode.title, handoffFault(handoff)], [2, "Pricing, part one", "What to charge, and why", ""]);
    t.done();
  });
  it("applies a spelling that holds its own word once, and never again", async () => {
    const { t, found } = finishedEpisode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much, Sallie Ogden\.\n/);
    // A later spelling is applied alone: the one before is held already.
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "much", "much indeed")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much indeed, Sallie Ogden\.\n/);
    assert.doesNotMatch(text(found, HANDOFF), /Ogden Ogden/);
    t.done();
  });
  it("leaves the final transcripts and the revision as they are when the new spelling's word is not in them", async () => {
    const { t, found } = finishedEpisode();
    const before = text(found, HANDOFF);
    assert.match((await on(t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi")).text, /The final transcripts do not have "Hormozy", so they are as they were\.$/);
    assert.deepEqual([reread(found).finished.revision, text(found, HANDOFF), reread(found).spellings], [1, before, [["Hormozy", "Hormozi"]]]);
    // It changed nothing there, so taking it back says nothing of the final transcripts.
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Hormozy")).text, '"Hormozy" is as the transcriber writes it again.');
    t.done();
  });
  it("takes a spelling back, or changes it, and says the final transcripts keep the old one", async () => {
    const { t, found } = finishedEpisode([["Sallie", "Sally"]]);
    const before = text(found, `${MAIN}.srt`);
    // A finish again makes a part's transcripts again only once it is Shared again (finish.js reuses the others).
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).text, '"Sallie" is as the transcriber writes it again. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally". Say "open it in HyperFrames" to edit each there, from the recording.');
    assert.deepEqual([reread(found).spellings, reread(found).finished.revision, text(found, `${MAIN}.srt`)], [[], 1, before]);
    assert.match((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Salli")).text, /The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally"\. Say "open it in HyperFrames" to edit each there, from the recording\.$/);
    t.done();
  });
  it("never spells a part twice after a finish again that reused it, and spells the part it made again afresh", async () => {
    const { t, found } = finishedEpisode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    // A finish again: the main video was not Shared again, so it is reused as it was; Reel 2 is made again, with no spelling.
    const now = reread(found);
    writeFileSync(join(found.folder, `${REEL}.srt`), SRT);
    writeFileSync(join(found.folder, `${REEL}.words.json`), JSON.stringify({ video: "r.mov", duration: 2, words: [{ w: "Sallie.", start: 1, end: 2 }] }));
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, finished: { revision: 3, at: now.finished.at, on: now.finished.on, handoff: HANDOFF, parts: { main: now.finished.parts.main, "reel 2": { v: 2, file: `${REEL}.mov`, bytes: 9, seconds: 9, words: `${REEL}.words.json` } } } }));
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much, Sallie Ogden\.\n/);
    assert.match(text(found, `${REEL}.srt`), /much, Sallie Ogden\.\n/);
    t.done();
  });
  it("brings the final transcripts over first when the folder was made online-only, and changes nothing", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.isWhole = (path) => !path.endsWith(".brimm-ops.json");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).text, "Dropbox is bringing the final transcripts over to this Mac. Say it again when it is done. Nothing was changed.");
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
  it("waits while a finish runs, whose late check would put its own copies back, for an add and a drop", async () => {
    const { t, found } = finishedEpisode([["Sallie", "Sally"]]);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    const rev = reread(found).rev;
    for (const ask of [["add", "much", "much indeed"], ["drop", "Sallie"]]) {
      const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "spell", FOLDER, ...ask);
      assert.equal(r.text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.', ask[0]);
    }
    assert.deepEqual([reread(found).rev, reread(found).spellings], [rev, [["Sallie", "Sally"]]]);
    t.done();
  });
  it("puts each final file back as it was when the record cannot be written", async () => {
    const { t, found } = finishedEpisode();
    const before = text(found, `${MAIN}.srt`);
    // The record is written meanwhile, as by another command: the save is refused.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".brimm-ops.json") && !existsSync(recordFile(found.folder, 3))) writeFileSync(recordFile(found.folder, 3), recordText({ ...reread(found), rev: 3 }));
    };
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 1);
    t.ctx.deps.clone = clone;
    assert.equal(text(found, `${MAIN}.srt`), before);
    t.done();
  });
  it("names a final file that cannot be put back, and says the episode needs Jason", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(".transcript.txt")) throw new Error("cp: the disk is full");
      writeFileSync(to, readFileSync(from));
    };
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 1);
    assert.match(r.text, new RegExp(`${MAIN}\\.transcript\\.txt could not be put back as it was\\. Tell Jason: the episode needs him\\.$`));
    assert.match(text(found, `${MAIN}.srt`), /Sallie\./);
    t.done();
  });
});
