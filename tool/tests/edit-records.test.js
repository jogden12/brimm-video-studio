// The commands of phase 2 that write the record and nothing else: an episode's name, its title, and which Reels are picked
// or dropped. Each writes the next record by phase 1a's writeEpisode, in a made-up episode (episodes.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { nameEpisode, titleEpisode, pickReels, dropReels, editMain } from "../edit.js";
import { RECORD_VERSION, recordFile, recordText } from "../episode.js";
import { writtenFile } from "../settings.js";
import { setup, episodeFor, reread, EDITED, FOLDER } from "./episodes.js";
import { OWN_COMMIT } from "./own-checkout.js";

describe("name", () => {
  it("names the episode as it is given, and renames nothing", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal(await nameEpisode(t.ctx, found, "  Pricing: what to charge? "), 0);
    const record = reread(found);
    assert.deepEqual(record.name, { text: "Pricing: what to charge?", placeholder: false });
    assert.equal(record.rev, found.record.rev + 1);
    assert.deepEqual(readdirSync(dirname(found.folder)), [basename(found.folder)]);
    assert.match(t.said(), /It is called "Pricing: what to charge\?" now\. Nothing was renamed\./);
    t.done();
  });
  it("refuses an empty name, and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal(await nameEpisode(t.ctx, found, "  "), 1);
    assert.equal(reread(found).rev, found.record.rev);
    assert.match(t.said(), /Say the name to give the episode\./);
    t.done();
  });
  it("writes nothing when the other Mac changed the episode meanwhile", async () => {
    const t = setup();
    const found = episodeFor(t);
    writeFileSync(recordFile(found.folder, found.record.rev + 1), JSON.stringify({ ...found.record, rev: found.record.rev + 1 }));
    assert.equal(await nameEpisode(t.ctx, found, "Pricing"), 1);
    assert.match(t.said(), /this episode changed on the other Mac: open it again/);
    t.done();
  });
});

describe("what every record command does first", () => {
  it("writes the record by the rule, as a clone", async () => {
    const t = setup();
    const found = episodeFor(t);
    await nameEpisode(t.ctx, found, "Pricing");
    assert.ok(t.clones.some(([, to]) => to === recordFile(found.folder, found.record.rev + 1)));
    t.done();
  });
  it("names the checkout this code is in as the record's writer, with no commit given and the settings naming a folder that is no checkout", async () => {
    const commands = [(t, found) => nameEpisode(t.ctx, found, "Pricing"), (t, found) => titleEpisode(t.ctx, found, { words: "Hello", approve: true }), (t, found) => pickReels(t.ctx, found, [1])];
    for (const command of commands) {
      const t = setup();
      t.ctx.deps.commit = undefined;
      t.ctx.settings = { ...t.ctx.settings, checkout: "/elsewhere/BRIMM video" };
      const found = episodeFor(t, { record: { reels: EDITED.reels } });
      assert.equal(await command(t, found), 0, t.said());
      assert.deepEqual(reread(found).writer, { commit: OWN_COMMIT, on: "Mac Studio" });
      t.done();
    }
  });
  it("says what Dropbox took away, and writes nothing, when this Mac's last change was undone; once, as 1a's commands do", async () => {
    const commands = [(t, found) => nameEpisode(t.ctx, found, "Pricing"), (t, found) => titleEpisode(t.ctx, found, { words: "Hello", approve: true }), (t, found) => pickReels(t.ctx, found, [1])];
    for (const command of commands) {
      const t = setup();
      const found = episodeFor(t, { record: { reels: EDITED.reels } });
      mkdirSync(join(writtenFile(t.home), ".."), { recursive: true });
      writeFileSync(writtenFile(t.home), JSON.stringify({ [found.record.id]: found.record.rev + 3 }));
      assert.equal(await command(t, found), 1);
      assert.match(t.said(), /Dropbox undid this Mac's last change to Pricing talk\. Say it again\. Nothing was written\./);
      assert.equal(reread(found).rev, found.record.rev);
      assert.equal(await command(t, found), 0, "said once, the next try goes ahead");
      t.done();
    }
  });
  it("ends with 1 on a record of a newer layout", async () => {
    const t = setup();
    const found = episodeFor(t);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, version: RECORD_VERSION + 1, rev: 2 }));
    assert.equal(await editMain(["name", FOLDER, "Pricing"], t.ctx.deps), 1);
    assert.equal(await editMain(["title", FOLDER, "--words", "Hello"], t.ctx.deps), 1);
    assert.equal(await editMain(["reel", "drop", FOLDER, "1"], t.ctx.deps), 1);
    assert.equal(await editMain(["finish", FOLDER], t.ctx.deps), 1);
    assert.equal(await editMain(["free", FOLDER, "library"], t.ctx.deps), 1);
    assert.match(t.said(), /Ask him to update this Mac\./);
    t.done();
  });
});

describe("title", () => {
  const claudes = { title: { text: "Know your costs", from: "claude", approved: false } };
  it("shows the title, who gave it and whether it is approved", async () => {
    const t = setup();
    assert.equal(await titleEpisode(t.ctx, episodeFor(t, { record: claudes }), {}), 0);
    assert.match(t.said(), /The title is "Know your costs", recommended by Claude, not yet approved\./);
    t.done();
  });
  it("says there is none yet when Claude gave none", async () => {
    const t = setup();
    assert.equal(await titleEpisode(t.ctx, episodeFor(t), {}), 0);
    assert.match(t.said(), /There is no title yet\. Say the words to put on screen\./);
    t.done();
  });
  it("approves Claude's title as it is", async () => {
    const t = setup();
    const found = episodeFor(t, { record: claudes });
    assert.equal(await titleEpisode(t.ctx, found, { approve: true }), 0);
    assert.deepEqual(reread(found).title, { text: "Know your costs", from: "claude", approved: true });
    assert.match(t.said(), /The title is "Know your costs", approved\./);
    t.done();
  });
  it("puts a person's words in its place, approved or not", async () => {
    const t = setup();
    const found = episodeFor(t, { record: claudes });
    assert.equal(await titleEpisode(t.ctx, found, { words: " Price like  you mean it " }), 0);
    assert.deepEqual(reread(found).title, { text: "Price like you mean it", from: "person", approved: false });
    const again = { ...found, record: reread(found) };
    assert.equal(await titleEpisode(t.ctx, again, { approve: true }), 0);
    assert.deepEqual(reread(found).title, { text: "Price like you mean it", from: "person", approved: true });
    t.done();
  });
  it("refuses to change an approved title without --change, and says BRIMM Ops may have the old one when it is changed", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { title: { ...claudes.title, approved: true } } });
    assert.equal(await titleEpisode(t.ctx, found, { words: "Price like you mean it", approve: true }), 1);
    assert.match(t.said(), /The title "Know your costs" is approved already\. To change it, say to change it \(--change\): BRIMM Ops may already have it\./);
    assert.equal(await titleEpisode(t.ctx, found, { words: "Price like you mean it", approve: true, change: true }), 0);
    assert.deepEqual(reread(found).title, { text: "Price like you mean it", from: "person", approved: true });
    assert.match(t.said(), /BRIMM Ops may already have the old title, so change it there too\./);
    t.done();
  });
  it("sets a Reel's title on screen, shows it, and refuses a Reel that is not there", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { reels: EDITED.reels } });
    assert.equal(await titleEpisode(t.ctx, found, { reel: 2, words: "  Say it   again, better " }), 0);
    assert.equal(reread(found).reels[1].title, "Say it again, better");
    assert.match(t.said(), /Reel 2's title on screen is "Say it again, better"\./);
    assert.equal(await titleEpisode(t.ctx, { ...found, record: reread(found) }, { reel: 2 }), 0);
    assert.match(t.said(), /Reel 2's title on screen is "Say it again, better"\./);
    assert.equal(await titleEpisode(t.ctx, found, { reel: 9, words: "Hello" }), 1);
    assert.match(t.said(), /There is no Reel 9\./);
    t.done();
  });
  it("takes a Reel's title from the command line, after the episode", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { reels: EDITED.reels } });
    assert.equal(await editMain(["title", "Pricing", "reel", "2", "--words", "Say it again, better"], t.ctx.deps), 0);
    assert.equal(reread(found).reels[1].title, "Say it again, better");
    t.done();
  });
  it("approves a title from the command line only when told to", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal(await editMain(["title", "Pricing", "--words", "Price like you mean it"], t.ctx.deps), 0);
    assert.deepEqual(reread(found).title, { text: "Price like you mean it", from: "person", approved: false });
    assert.equal(await editMain(["title", "Pricing", "--approve"], t.ctx.deps), 0);
    assert.equal(reread(found).title.approved, true);
    t.done();
  });
  it("refuses a title of more than 12 words, or of more than one line, and one with no words to approve", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal(await titleEpisode(t.ctx, found, { words: "one two three four five six seven eight nine ten eleven twelve thirteen" }), 1);
    assert.equal(await titleEpisode(t.ctx, found, { words: "Price like\nyou mean it" }), 1);
    assert.equal(await titleEpisode(t.ctx, found, { approve: true }), 1);
    assert.equal(reread(found).rev, found.record.rev);
    assert.match(t.said(), /A title is at most 12 words, and that is 13\./);
    assert.match(t.said(), /A title is one line\./);
    assert.match(t.said(), /There is no title to approve\./);
    t.done();
  });
});

// No command picks a Reel by this any more (plan PR 5): `app … reel <n>` marks the Reel it opens picked (tests/edit-app-reel.test.js).
// `pickReels` stays, with `markReels` it shares with `reel drop`, for the Final Cut Reel path and these tests until the retirement's
// wave 5 takes that path away.
describe("pickReels and reel drop", () => {
  it("picks and drops Reels by number, and says how to show a picked one in Final Cut", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { reels: EDITED.reels.map((r) => ({ ...r, status: "candidate" })) } });
    assert.equal(await pickReels(t.ctx, found, [1, 3]), 0);
    assert.deepEqual(reread(found).reels.map((r) => r.status), ["picked", "candidate", "picked"]);
    assert.match(t.said(), /Reel 1 is picked\. Say "show reel 1 in Final Cut" to have it pushed\. Reel 3 is picked\./);
    assert.equal(await dropReels(t.ctx, { ...found, record: reread(found) }, [3]), 0);
    assert.deepEqual(reread(found).reels.map((r) => r.status), ["picked", "candidate", "dropped"]);
    assert.match(t.said(), /Reel 3 is dropped\./);
    t.done();
  });
  it("keeps every other field of a Reel as it was", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { reels: [{ ...EDITED.reels[2], later: { x: 1 } }] } });
    await pickReels(t.ctx, found, [3]);
    assert.deepEqual(reread(found).reels[0], { ...EDITED.reels[2], later: { x: 1 }, status: "picked" });
    t.done();
  });
  it("refuses a Reel that is not there, a finished one, none named, and any Reel of a short video; and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { reels: [{ ...EDITED.reels[0], status: "finished" }, EDITED.reels[2]] } });
    assert.equal(await pickReels(t.ctx, found, [9]), 1);
    assert.match(t.said(), /There is no Reel 9\. The Reels are 1, 3\./);
    assert.equal(await dropReels(t.ctx, found, [1]), 1);
    assert.match(t.said(), /Reel 1 is finished: it is in the hand-off already\./);
    assert.equal(await pickReels(t.ctx, found, []), 1);
    assert.match(t.said(), /Say which Reels, by their numbers\./);
    const short = setup();
    const video = episodeFor(short, { record: { kind: "short video", reels: [] } });
    assert.equal(await pickReels(short.ctx, video, [1]), 1);
    assert.match(short.said(), /A short video has no Reels\./);
    assert.equal(reread(found).rev, found.record.rev);
    t.done();
    short.done();
  });
});

describe("the help", () => {
  it("names every command of phase 2", async () => {
    const lines = [];
    assert.equal(await editMain(["--help"], { say: (line) => lines.push(line) }), 0);
    const help = lines.join("\n");
    for (const words of ["edit.js name", "edit.js title", 'reel drop "<episode>"', "reel <n>", "edit.js finish"]) assert.ok(help.includes(words), words);
    assert.ok(!help.includes("reel pick"), "a Reel is picked by making it: there is no reel pick");
    // free takes an episode's working copy and renders away (plan PR 15); its old spelling, a Final Cut library, is held back, and is no usage.
    assert.ok(help.includes('edit.js free "<episode>"'), "free is in the help");
    assert.ok(!/edit\.js free "<episode>" library/.test(help), "free library is held back from this version, and is not offered");
  });
});
