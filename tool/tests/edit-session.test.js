// The session's commands (phase 4), end to end on the made-up episode: spell, logo, captions, text, graphic, preset and
// cut, each recording what it is asked in the record, and the next push showing it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { pushedFolder } from "../settings.js";
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
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
/** The copy the newest push handed to Final Cut. */
const handed = (t, kind) => {
  const names = readdirSync(pushedFolder(t.home, FOLDER)).filter((n) => n.startsWith(`${kind}.v`)).sort();
  return readFileSync(join(pushedFolder(t.home, FOLDER), names[names.length - 1]), "utf8");
};
/** A PNG's first bytes, of a size, as a picture in her Pictures folder. */
const picture = (t, name, width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  const dir = join(t.home, "BRIMM Video Studio", "Pictures");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), b);
};

describe("the session's commands, while the other Mac has the episode", () => {
  it("each refuses a change, says who has it, and writes nothing, a picture included", async () => {
    const asks = [
      ["spell", FOLDER, "add", "Sallie", "Sally"],
      ["logo", FOLDER, "on", "--picture", "logo.png"],
      ["captions", FOLDER, "reel", "2", "off"],
      ["text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden"],
      ["graphic", FOLDER, "add", "chart.png", "--at", "0:01"],
      ["preset", FOLDER, "--look", "bright"],
      ["cut", FOLDER, "remove", "--words", "know your costs"]
    ];
    for (const ask of asks) {
      const { t, found } = episode({ editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
      picture(t, "logo.png", 600, 300);
      picture(t, "chart.png", 1600, 900);
      const r = await on(t.ctx.deps, ...ask);
      assert.deepEqual([r.code, r.text], [1, 'Sallie\'s laptop has Pricing: what to charge? open. Open it here first (say "take it over" if they are done with it). Nothing was changed.'], ask[0]);
      assert.equal(reread(found).rev, 1, ask[0]);
      assert.equal(existsSync(join(found.folder, "media")), false, ask[0]);
      t.done();
    }
  });
  it("still list what there is: spellings, texts, graphics, ideas and the preset", async () => {
    const lists = [
      ["spell", FOLDER],
      ["text", FOLDER],
      ["graphic", FOLDER],
      ["graphic", FOLDER, "ideas"],
      ["preset", FOLDER]
    ];
    for (const ask of lists) {
      const { t } = episode({ editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
      assert.equal((await on(t.ctx.deps, ...ask)).code, 0, ask.join(" "));
      t.done();
    }
  });
});

describe("the timeline a command names", () => {
  it("is a Reel however its word is written, and a word not understood is refused, never taken for the main video", async () => {
    const { t, found } = episode();
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "Reel", "2", "--words", "know your costs")).text, /^Taken out of Reel 2: /);
    for (const ask of [["cut", FOLDER, "remove", "reel", "two", "--words", "very important"], ["text", FOLDER, "reel", "2", "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden"]]) {
      const r = await on(t.ctx.deps, ...ask);
      assert.equal(r.code, 1, `${ask.join(" ")}: ${r.text}`);
      assert.match(r.text, /is not understood there: name the timeline last, as main or reel 2\.$/, ask.join(" "));
    }
    assert.deepEqual([reread(found).main.cuts, reread(found).main.texts, reread(found).reels.find((r) => r.n === 2).cuts.length], [[], [], 1]);
    t.done();
  });
});

describe("finish, once the session has asked for more since a part was shown", () => {
  it("asks for the part to be shown and Shared again, and starts nothing", async () => {
    const { t, found } = episode({ title: { text: "Price it right", from: "person", approved: true } }, {}, episodeFiles({ picked: false }));
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    const { project } = reread(found).main.pushed[0];
    t.shared(`${project}.mp4`, 2000);
    t.shared(`${project}.fcpxmld`, 3000);
    const again = /The main video has changes asked for since v1 was shown in Final Cut/;
    assert.doesNotMatch((await on(t.ctx.deps, "finish", FOLDER)).text, again);
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden", "--no-hand-edits")).code, 0);
    const r = await on(t.ctx.deps, "finish", FOLDER, "--yes");
    assert.match(r.text, /\nThe main video has changes asked for since v1 was shown in Final Cut: say "show it in Final Cut", Share it again, and then finish\./);
    assert.deepEqual(t.started, []);
    t.done();
  });
});

describe("words she quotes, once the episode spells them", () => {
  it("are found as the captions she watches spell them, a spelling of several words included", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "costs", "costs, Alex Hormozi")).code, 0);
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at-words", "thank you so much Sally", "--line", "Sallie Ogden")).code, 0);
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at-words", "know your costs Alex Hormozi", "--line", "Alex Hormozi")).code, 0);
    assert.deepEqual(reread(found).main.texts.map((x) => x.at), [19.414, 15.3]);
    t.done();
  });
  it("find a cut by its words as they are spelled", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "important", "vital")).code, 0);
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--words", "very vital")).text, /^Kept in the main video: "It is very, very important\."/);
    assert.deepEqual(reread(found).main.cuts.map((c) => c.keep), [true]);
    t.done();
  });
});

describe("spell", () => {
  it("lists, adds and drops the episode's spellings, and the next push's captions take them", async () => {
    const { t, found } = episode();
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER), { code: 0, text: "There are no spellings for this episode yet." });
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally"), { code: 0, text: '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).spellings, [["Sallie", "Sally"]]);
    assert.equal(reread(found).version, 2);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match(handed(t, "main"), /Thank you so much, Sally\./);
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
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling until it is shown in Final Cut, Shared and finished again.');
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
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Hormozy")).text, '"Hormozy" is as the transcriber writes it again. Say "show it in Final Cut" to see it.');
    t.done();
  });
  it("takes a spelling back, or changes it, in the timelines, and says the final transcripts keep the old one", async () => {
    const { t, found } = finishedEpisode([["Sallie", "Sally"]]);
    const before = text(found, `${MAIN}.srt`);
    // A finish again makes a part's transcripts again only once it is Shared again (finish.js reuses the others).
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again.');
    assert.deepEqual([reread(found).spellings, reread(found).finished.revision, text(found, `${MAIN}.srt`)], [[], 1, before]);
    assert.match((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Salli")).text, /The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again\.$/);
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

describe("logo", () => {
  it("asks for the logo's picture once, copies it into media/ by the rule, and the push shows it top right on the main video", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on")).text, 'Say which picture in the Pictures folder is the logo (--picture "<name>").');
    picture(t, "BRIMM logo.png", 600, 300);
    assert.deepEqual(await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "BRIMM logo.png"), { code: 0, text: 'The logo is on on the main video. Say "show it in Final Cut" to see it.' });
    const now = reread(found);
    assert.deepEqual([now.brand, now.main.logo, now.files["media/BRIMM logo.png"]], [{ logo: "media/BRIMM logo.png" }, true, 33]);
    assert.ok(existsSync(join(found.folder, "media", "BRIMM logo.png")));
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "video").every((v) => v.name === "brimm logo 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "off")).code, 0);
    assert.equal(reread(found).main.logo, false);
    t.done();
  });
  it("leaves a Reel's logo for the brand templates", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "reel", "2")).text, "A Reel's logo comes with the brand templates, later. The logo is on the main video.");
    t.done();
  });
  it("refuses a path for a picture, a picture that is not there, and a link in the Pictures folder, and copies nothing", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "../../.ssh/id.png")).code, 1);
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "gone.png")).text, 'There is no picture called "gone.png" in the Pictures folder (BRIMM Video Studio, Pictures). Put it there first.');
    picture(t, "real.png", 600, 300);
    symlinkSync(join(t.home, "BRIMM Video Studio", "Pictures", "real.png"), join(t.home, "BRIMM Video Studio", "Pictures", "link.png"));
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "link.png")).text, '"link.png" in the Pictures folder is not a picture file of its own. Put the picture itself there.');
    assert.equal(existsSync(join(found.folder, "media")), false);
    t.done();
  });
  it("uses the same picture again without a second copy, and refuses a file that is not a PNG or a JPEG inside", async () => {
    const { t, found } = episode();
    picture(t, "logo.png", 600, 300);
    for (let i = 0; i < 2; i++) assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "logo.png")).code, 0);
    assert.deepEqual(readdirSync(join(found.folder, "media")), ["logo.png"]);
    assert.deepEqual([reread(found).brand, reread(found).rev], [{ logo: "media/logo.png" }, 3]);
    writeFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "notes.png"), "these are words, not a picture");
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "notes.png")).text, '"notes.png" cannot be read as a PNG or a JPEG picture.');
    assert.deepEqual(readdirSync(join(found.folder, "media")), ["logo.png"]);
    t.done();
  });
  it("refuses another picture of a name already in the episode, of the same size too, and takes back one it copied when the record cannot be written", async () => {
    const { t, found } = episode();
    picture(t, "logo.png", 600, 300);
    mkdirSync(join(found.folder, "media"), { recursive: true });
    const other = readFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "logo.png"));
    other[30] = 7;
    writeFileSync(join(found.folder, "media", "logo.png"), other);
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "logo.png")).text, 'Another picture called "logo.png" is in this episode already. Give yours another name in the Pictures folder.');
    picture(t, "BRIMM logo.png", 600, 300);
    // The record is written meanwhile, as by another command: the save is refused, and the picture taken out again.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2 }));
    const stale = { ...t.ctx.deps, isWhole: t.ctx.deps.isWhole };
    const clone = t.ctx.deps.clone;
    stale.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("BRIMM logo.png")) writeFileSync(recordFile(found.folder, 3), recordText({ ...reread(found), rev: 3 }));
    };
    assert.equal((await on(stale, "logo", FOLDER, "on", "--picture", "BRIMM logo.png")).code, 1);
    assert.equal(existsSync(join(found.folder, "media", "BRIMM logo.png")), false);
    assert.equal(reread(found).brand, undefined);
    t.done();
  });
});

describe("captions", () => {
  it("are on a Reel unless turned off, and the main video's follow its caption style", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2")).code, 0);
    assert.ok(tags(handed(t, "reel-2"), "title").some((x) => x.role === "BRIMM captions"));
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "reel", "2", "off")).code, 0);
    assert.equal(reread(found).reels.find((r) => r.n === 2).captions, false);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2", "--no-hand-edits")).code, 0);
    assert.ok(!tags(handed(t, "reel-2"), "title").some((x) => x.role === "BRIMM captions"));
    // Its title on screen stays: only the captions were turned off.
    assert.ok(tags(handed(t, "reel-2"), "title").some((x) => x.name === "brimm hook 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "main", "on")).text, "The main video's captions follow its caption style: say which (preset --captions).");
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "reel", "1", "on")).text, "Reel 1 is not picked. Nothing on this Mac picks a Reel any more: ask Jason.");
    t.done();
  });
});

describe("a Reel cut as a clip, before Reels had projects of their own", () => {
  it("is shown as before when the record asks for something on it, and the push says what is not shown", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, spellings: [["Hormozy", "Hormozi"]] } });
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "1", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /\nReel 1 was cut as a clip before Reels had projects of their own, so what was asked for on it is not shown\. Change it by hand in Final Cut\./);
    t.done();
  });
  it("refuses what would be laid over it, which nothing can be, rather than keep it and show nothing", async () => {
    const t = setup();
    episodeFor(t, { record: EDITED });
    const asks = [
      ["captions", FOLDER, "reel", "1", "off"],
      ["text", FOLDER, "add", "lower-third", "reel", "1", "--at", "0:01", "--line", "x"],
      ["preset", FOLDER, "reel", "1", "--look", "warm"]
    ];
    for (const argv of asks) {
      assert.equal((await on(t.ctx.deps, ...argv)).text, "Reel 1 was cut as a clip before Reels had projects of their own, so brimm-video cannot change it: make this change by hand in Final Cut.", argv.join(" "));
    }
    t.done();
  });
});

describe("a short video's main video", () => {
  it("draws its captions from the first push, as its job says, and the same after a spelling", async () => {
    const { t } = episode({ kind: "short video", reels: [] });
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.role === "BRIMM captions"));
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits")).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.role === "BRIMM captions" && x.name.includes("caption")));
    t.done();
  });
});

describe("text", () => {
  it("puts a name over a role on the main video at a time on it, and the push shows it on the lower third", async () => {
    const { t, found } = episode();
    const r = await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden", "--line", "Founder, The BRIMM");
    assert.deepEqual(r, { code: 0, text: 'Name title t1 on the main video as it is now at 0:05, for 4 seconds: "Sallie Ogden", "Founder, The BRIMM". Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).main.texts, [{ id: "t1", kind: "lower-third", at: 14.415, for: 4, lines: ["Sallie Ogden", "Founder, The BRIMM"] }]);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.name === "brimm text t1 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "drop", "t1")).code, 0);
    assert.deepEqual(reread(found).main.texts, []);
    t.done();
  });
  it("asks the guard before reading a time on a timeline shown before, and reads it on the version shown", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden")).text, /^Did you change v1 of .* in Final Cut since it was shown\? Say "no changes" to go on\./);
    assert.match((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden", "--no-hand-edits")).text, /^Name title t1 on main v1 at 0:05,/);
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:40", "--line", "x", "--no-hand-edits")).text, "0:40 is after the end of main v1, which is 0:09 long.");
    t.done();
  });
});

describe("graphic", () => {
  it("uses a picture already in the episode again without a second copy, refuses one that is not a picture, and takes back one it copied when the record cannot be written", async () => {
    const { t, found } = episode();
    picture(t, "chart.png", 1600, 900);
    for (const at of ["0:01", "0:05"]) assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "--at", at, "--place", "lower")).code, 0);
    assert.deepEqual([readdirSync(join(found.folder, "media")), reread(found).main.graphics.map((g) => g.picture)], [["chart.png"], ["media/chart.png", "media/chart.png"]]);
    writeFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "notes.png"), "these are words, not a picture");
    assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "add", "notes.png", "--at", "0:01")).text, '"notes.png" cannot be read as a PNG or a JPEG picture.');
    picture(t, "photo.png", 1080, 1350);
    const stale = { ...t.ctx.deps };
    stale.clone = (from, to) => {
      t.ctx.deps.clone(from, to);
      if (to.endsWith("photo.png")) writeFileSync(recordFile(found.folder, reread(found).rev + 1), recordText({ ...reread(found), rev: reread(found).rev + 1 }));
    };
    assert.equal((await on(stale, "graphic", FOLDER, "add", "photo.png", "--at", "0:01")).code, 1);
    assert.deepEqual([readdirSync(join(found.folder, "media")), reread(found).main.graphics.length], [["chart.png"], 2]);
    t.done();
  });
  it("puts a picture from her Pictures folder in a Reel's corner at the words said, for their length", async () => {
    const { t, found } = episode();
    picture(t, "chart.png", 1600, 900);
    const r = await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "reel", "2", "--at-words", "know your costs", "--place", "corner");
    assert.deepEqual(r, { code: 0, text: 'Graphic g1, chart.png, corner, on Reel 2 as it is now at 0:02, for 1 second. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).reels.find((x) => x.n === 2).graphics, [{ id: "g1", picture: "media/chart.png", at: 15.3, for: 1, place: "corner" }]);
    t.done();
  });
  it("says how little of a wide picture shows full in a Reel", async () => {
    const { t } = episode();
    picture(t, "chart.png", 1600, 900);
    assert.match((await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "reel", "2", "--at", "0:01")).text, /only about 32% of it shows: say --place lower to show it whole\./);
    t.done();
  });
  it("offers Claude's ideas for graphics as places on the timeline, numbered, each with its start and end", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "ideas")).text, [
      "Claude's ideas for graphics on the main video: 1, with times on the main video as it is now.",
      'Idea 1, 0:04 to 0:07: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".'
    ].join("\n"));
    t.done();
  });
});

describe("preset", () => {
  it("says what a timeline has and what there is, and takes a job with its own style and look", async () => {
    const { t, found } = episode();
    assert.match((await on(t.ctx.deps, "preset", FOLDER)).text, /^The main video is a full episode, with file only captions and the natural look\. \(Its default\.\)\nJobs: full episode, solo clip/);
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "reel", "2", "--job", "teaching-clip", "--captions", "bold")).code, 0);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).preset, { job: "teaching-clip", captions: "bold", look: "natural" });
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "--look", "sepia")).text, '"sepia" is not a look. The looks are: natural, bright, warm, moody.');
    // Until Jason's check gives Final Cut's preset for a look, it is recorded, and the push says so (C9 fills them in: the test
    // gives its own, so it holds either way).
    t.ctx.deps.lookPresets = {};
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "--look", "moody")).code, 0);
    assert.match((await on(t.ctx.deps, "push", FOLDER)).text, /\nMoody is recorded\. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one\.\n/);
    // Once it is known, the push puts it on every clip of the main video, at its Mix, and says nothing of it. The made-up
    // recording has 720 lines, so its Mix is at 75% (rule 6).
    t.ctx.deps.lookPresets = { moody: { name: "Warmer Vintage with Dark Blacks", uid: ".../Warmer Vintage with Dark Blacks.moef", mixKey: "9999/999/1/100/101" } };
    const r = await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /Moody was applied at 75% strength: the recording has 720 lines\./);
    const xml = handed(t, "main");
    assert.deepEqual(tags(xml, "effect").filter((e) => e.name === "Warmer Vintage with Dark Blacks"), [{ id: tags(xml, "effect").find((e) => e.name === "Warmer Vintage with Dark Blacks").id, name: "Warmer Vintage with Dark Blacks", uid: ".../Warmer Vintage with Dark Blacks.moef" }]);
    assert.equal(tags(xml, "filter-video").length, tags(xml, "asset-clip").length);
    assert.deepEqual([...new Set(tags(xml, "param").filter((p) => p.name === "Mix").map((p) => p.value))], ["0.375"]);
    t.done();
  });
});

describe("cut", () => {
  it("takes whole phrases out of the main video at a pause, says so, and the push leaves them out", async () => {
    const { t, found } = episode();
    const r = await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "today we are going");
    assert.equal(r.text, 'Taken out of the main video: "Welcome to the show. Today we are going to talk about pricing." (0:06 to 0:10 of the recording, whole phrases, at a pause). A cut on the main video does not reach a Reel over the same words. Say "show it in Final Cut" to see it.');
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: false, from: 6.07, to: 9.638 }]);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.equal(tags(handed(t, "main"), "asset-clip").length, 2);
    t.done();
  });
  it("takes out words that run across a join, to the phrase of the last word she says", async () => {
    const { t, found } = episode();
    // "talk about pricing" ends the first kept piece, and "so the first thing" starts the next.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "talk about pricing so the first thing")).text, /^Taken out of the main video: "Welcome to the show\. Today we are going to talk about pricing\. .*So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).main.cuts.map((c) => [c.from, c.to]), [[6.07, 16.33]]);
    t.done();
  });
  it("takes out a stretch by its times on the timeline she watched, to its very end, and refuses it reversed or with no end", async () => {
    // The main video runs 9.198 s, which its clock shows as 0:09: the end, read to the second, is still the end.
    for (const end of ["9.198", "0:10"]) {
      const { t, found } = episode();
      assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", end)).text, /^Taken out of the main video: "So the first thing you need to do is know your costs\. It is very, very important\. Thank you so much, Sallie\." \(0:14 to 0:21 of the recording/);
      assert.deepEqual(reread(found).main.cuts.map((c) => [c.from, c.to]), [[13.583, 21.097]]);
      // Now 3.968 s long, which reads 0:04 to the second: a time past it is said to the tenth.
      assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:05")).text, "0:04 is after the end of the main video as it is now, which is 0:03.9 long.");
      t.done();
    }
    const { t: t2, found: found2 } = episode();
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:07", "--to", "0:05")).text, "A cut ends after it starts: 0:05 is not after 0:07 on the main video as it is now.");
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:07")).text, "Say where the cut ends too (--to 0:12).");
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:11")).text, "0:11 is after the end of the main video as it is now, which is 0:09 long.");
    assert.deepEqual(reread(found2).main.cuts, []);
    t2.done();
  });
  it("refuses a cut that would take out all of a timeline, and writes nothing", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:00", "--to", "0:09")).text, "That would take out all of the main video. Say a shorter stretch.");
    assert.deepEqual(reread(found).main.cuts, []);
    t.done();
  });
  it("keeps what was cut at the join nearest a time on the timeline she watched, and says what it kept", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    // Read on a timeline shown before, a time asks the guard first, and nothing is written until it is answered.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:07")).text, /^Did you change v1 of Pricing: what to charge\? in Final Cut since it was shown\?/);
    assert.deepEqual(reread(found).main.cuts, []);
    // On main v1, 0:07 is beside the join where "It is very, very important." was cut.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:07", "--no-hand-edits")).text, /^Kept in the main video: "It is very, very important\." \(0:17 to 0:19 of the recording/);
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: true, from: 17.246, to: 19.022 }]);
    // 0:09 is beside it too, and beside a join where only a pause was cut: that one never counts.
    for (const at of ["0:07", "0:09"]) assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", at, "--no-hand-edits")).text, '"It is very, very important." is kept on main v1 already.', at);
    // 0:02 lies between the joins at 0:00 and 0:04, where words were cut at each: neither is guessed.
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:02", "--no-hand-edits")).text, 'There are 2 places near 0:02 on main v1 where words were cut: at 0:00, "Welcome to the show. Today…", and at 0:04, "So the..." Say the words that were cut (--words), or a time nearer one of them.');
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep")).text, 'Say what to keep: the words that were cut (--words "very important"), or the time on the timeline where they were cut (--at 12:30).');
    assert.equal(reread(found).main.cuts.length, 1);
    t.done();
  });
  it("keeps again what a cut took out since she watched it, and never the cut beside it", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:06", "--no-hand-edits")).text, /^Taken out of the main video: "So the first thing you need to do is know your costs\."/);
    // 0:05 on main v1 is in what that cut took out: it is that cut that is kept again, not "So the..." at the join beside it.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:05", "--no-hand-edits")).text, /^Kept in the main video: "So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).main.cuts.map((c) => [c.keep, c.from, c.to]), [[false, 13.583, 16.33], [true, 13.583, 16.33]]);
    t.done();
  });
  it("keeps again what a cut took out at the very time it was cut at, the breath beside its words included", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:06", "--no-hand-edits")).code, 0);
    // On main v1, 0:04 is in the breath kept before "So the first thing...", which that cut took out with it.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:04", "--no-hand-edits")).text, /^Kept in the main video: "So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).main.cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("keeps what was cut before a pushed timeline's first clip, at 0:00 on it, though the clip starts a frame early", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "today we are going")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    // Main v1 starts on the frame at 13.380 s, before its kept piece's 13.383: 0:00 is on what it keeps, beside the cut there.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:00", "--no-hand-edits")).text, /^Kept in the main video: ".*Today we are going to talk about pricing\. /);
    assert.deepEqual(reread(found).main.cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("keeps what a cut took from a Reel's start, at 0:00 on it", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "reel", "2", "--words", "know your costs")).code, 0);
    // What was cut before its first piece is a cut at 0:00, within the Reel's own stretch: her cut, and Claude's beside it.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--at", "0:00")).text, /^Kept in Reel 2: "So the first thing you need to do is know your costs\. It is very, very important\."/);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("asks what to take out when it is given neither words nor times", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove")).text, 'Say what to take out: the words (--words "know your costs"), or where it starts and ends on the timeline (--at 0:04 --to 0:09).');
    assert.deepEqual(reread(found).main.cuts, []);
    t.done();
  });
  it("keeps words cut from a Reel within its stretch, though they are said again outside it", async () => {
    const { t, found } = episode();
    // "So the" is said in the false start before Reel 2's stretch, and again in the line the Reel starts with.
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "reel", "2", "--words", "know your costs")).code, 0);
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--words", "So the")).text, /^Kept in Reel 2: "So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("keeps what the plan cut, by its words", async () => {
    const { t, found } = episode();
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--words", "very important")).text, /^Kept in the main video: "It is very, very important\." \(0:17 to 0:19 of the recording/);
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: true, from: 17.246, to: 19.022 }]);
    t.done();
  });
  it("takes Claude's graphic idea for the words a cut took out off the next push, and puts it back when they are kept again", async () => {
    const { t } = episode();
    const ideas = () => tags(handed(t, "main"), "marker").filter((m) => m.value.startsWith("Graphic idea"));
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "know your costs")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.deepEqual(ideas(), []);
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--words", "know your costs")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal(ideas().length, 1);
    t.done();
  });
  it("leaves out of the next push a name title whose moment a cut took out, and says so", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden")).code, 0);
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "Welcome to the show")).code, 0);
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.equal(r.code, 0);
    assert.match(r.text, /\nThe name title t1 \("Sallie Ogden"\) is in what is cut now, so it is not shown\./);
    assert.ok(!tags(handed(t, "main"), "title").some((x) => x.name === "brimm text t1 3fa9c1"));
    t.done();
  });
  it("refuses what is outside a Reel's stretch", async () => {
    const { t } = episode();
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--words", "Let me do that again")).text, /^That is outside Reel 2's stretch of the recording/);
    t.done();
  });
});
