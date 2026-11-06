// The claim (phase 1b): `open` writes which Mac is editing an episode, waits for Dropbox to bring the change across, and
// reads it again; the other Mac is refused, in one sentence (nothing is taken over or handed over, Phase 2 F5); and the commands that
// write refuse while the other Mac has it. Two Macs share one root here, each with a home of its own (otherMac). Nothing touches Dropbox, Final Cut or a
// program: every program is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, CLAIM_WAIT_MS } from "../edit.js";
import { claimed, localStamp, recordFile, recordText, shown } from "../episode.js";
import { setup, episodeFor, reread, otherMac, EDITED, FOLDER, NAME } from "./episodes.js";

/** Run a command of edit.js on a Mac, by its deps: { code, text }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
const HERS = { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" };
/** The record files in an episode's folder. */
const records = (found) => readdirSync(join(found.folder, "record")).sort();
/** Have the stand-in wait do `then` on the claim's wait, as Dropbox would bring the other Mac's change across meanwhile. */
const duringTheWait = (t, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (ms) => {
    await wait(ms);
    if (ms === CLAIM_WAIT_MS) then();
  };
};

describe("the claim", () => {
  it("open writes the claim, waits twenty seconds, reads again, and shows the episode", async () => {
    const t = setup();
    const found = episodeFor(t);
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 0, r.text);
    // The claim is made at the clock's start, written as this Mac's own time.
    assert.deepEqual(reread(found).editing, { by: "Mac Studio", since: localStamp(new Date(Date.parse("2026-10-20T15:00:00-05:00"))) });
    assert.equal(reread(found).rev, 2);
    assert.equal(t.waits.filter((ms) => ms === CLAIM_WAIT_MS).length, 1);
    // The wait is twenty seconds, whatever the constant is called (the review of PR 21, finding 28).
    assert.deepEqual(t.waits, [20000]);
    assert.match(r.text, /^Pricing talk \(a placeholder name\): an episode of /);
    t.done();
  });
  it("open on the Mac that has it writes nothing new and does not wait", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).rev, t.waits], [1, []]);
    t.done();
  });
  it("refuses when the other Mac has it, in one sentence, and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    const refused = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(refused.code, 1);
    assert.equal(refused.text, "Sallie's laptop has Pricing talk open. Carry on there. Nothing was changed.");
    assert.equal(reread(found).rev, 1);
    assert.deepEqual([t.waits, t.started], [[], []]);
    t.done();
  });
  it("stops when the other Mac took it over during the wait", async () => {
    const t = setup();
    const found = episodeFor(t);
    // Her claim comes after this Mac's, as the record after it.
    duringTheWait(t, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...claimed(mine, "Sallie's laptop", "2026-10-20T15:00:10-05:00"), rev: mine.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1);
    assert.equal(r.text, `Sallie's laptop opened Pricing talk at the same time, and it is theirs. Carry on there.`);
    assert.deepEqual(records(found), ["0001.json", "0002.json", "0003.json"]);
    t.done();
  });
  it("stops, naming the conflict, when both Macs wrote the same record number", async () => {
    const t = setup();
    const found = episodeFor(t);
    const copy = "0002 (Sallie's laptop's conflicted copy 2026-10-20).json";
    duringTheWait(t, () => {
      const first = { ...reread(found), rev: 1 };
      writeFileSync(join(found.folder, "record", copy), recordText({ ...claimed(first, "Sallie's laptop", "2026-10-20T15:00:05-05:00"), rev: 2, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1);
    assert.ok(r.text.startsWith(`${FOLDER}: Dropbox has kept a conflicted copy in this episode: record/${copy}.`), r.text);
    assert.deepEqual(records(found), ["0001.json", "0002.json", copy].sort());
    t.done();
  });
  it("refuses at once, and brings nothing, when the other Mac has it and its files are not here", async () => {
    const theirs = "Sallie's laptop has Pricing talk open. Carry on there. Nothing was changed.";
    // Online-only on this Mac, as an episode is on the Mac that is not editing it: the raw video is not whole here.
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.deepEqual([r.code, r.text], [1, theirs]);
    assert.deepEqual(t.started, []);
    assert.deepEqual([reread(found).rev, t.waits], [1, []]);
    t.done();
    // A file the record lists is missing in Dropbox: the claim is still said first, not the missing file.
    const u = setup();
    const short = episodeFor(u, { record: { editing: HERS } });
    rmSync(join(short.folder, "Pricing talk.reel-1.srt"));
    const s = await on(u.ctx.deps, "open", FOLDER);
    assert.deepEqual([s.code, s.text], [1, theirs]);
    assert.deepEqual(u.started, []);
    u.done();
  });
  it("says Dropbox undid the claim when its own claim is gone after the wait, and the next open goes through", async () => {
    const t = setup();
    const found = episodeFor(t);
    // Dropbox takes this Mac's record write away during the wait, once: the newest record is the first again, with no claim.
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
    });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text, `Dropbox undid this Mac's claim on Pricing talk. Say "open Pricing talk" again.`);
    assert.doesNotMatch(r.text, /The other Mac|at the same time/);
    assert.deepEqual([reread(found).rev, reread(found).editing], [1, null]);
    // Said once: the next open claims it, and does not say again that Dropbox undid a change.
    const again = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(again.code, 0, again.text);
    assert.doesNotMatch(again.text, /undid/);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [2, "Mac Studio"]);
    t.done();
  });
  it("says Dropbox undid the claim when the record after the wait is at this Mac's rev with nobody editing it", async () => {
    const t = setup();
    const found = episodeFor(t);
    // Dropbox kept the other Mac's record 2, a change of hers with no claim in it, in place of this Mac's claim, and kept no
    // conflicted copy: the record is not older than the one this Mac wrote, but nobody is editing it.
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
      const first = reread(found);
      writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, editing: null, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text, `Dropbox undid this Mac's claim on Pricing talk. Say "open Pricing talk" again.`);
    assert.doesNotMatch(r.text, /at the same time/);
    assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).writer.on], [2, null, "Sallie's laptop"]);
    // As it says: the next open claims it, after her record.
    const again = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(again.code, 0, again.text);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [3, "Mac Studio"]);
    t.done();
  });
  it("warns when this Mac seems offline, and still claims", async () => {
    const t = setup();
    const found = episodeFor(t);
    t.ctx.deps.online = async () => false;
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^This Mac seems to be offline: the other Mac will not see that you have it until this one is back online\.$/m);
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
  it("name, title, a Reel's title, reel drop, push and finish refuse while the other Mac has it, and write nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: HERS } });
    const held = `Sallie's laptop has ${NAME} open. Carry on there. Nothing was changed.`;
    for (const argv of [["name", FOLDER, "Pricing"], ["title", FOLDER, "--words", "Price it right", "--approve", "--change"], ["title", FOLDER, "reel", "1", "--words", "Costs first"],
      ["reel", "drop", FOLDER, "2"], ["push", FOLDER], ["push", FOLDER, "reel", "1", "--no-hand-edits"], ["finish", FOLDER], ["finish", FOLDER, "--yes"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.text.split("\n").pop()], [1, held], argv.join(" "));
    }
    assert.equal(reread(found).rev, 1);
    assert.deepEqual(t.opened, []);
    // Shown, a title changes nothing, and is shown whoever has the episode.
    assert.equal((await on(t.ctx.deps, "title", FOLDER)).code, 0);
    assert.equal((await on(t.ctx.deps, "title", FOLDER, "reel", "1")).code, 0);
    t.done();
  });
  it("lets an episode nobody has open be changed without opening it first, as before", async () => {
    const t = setup();
    const found = episodeFor(t);
    const r = await on(t.ctx.deps, "name", FOLDER, "Pricing");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).name.text, reread(found).editing], ["Pricing", null]);
    t.done();
  });
  it("episodes says who is editing", async () => {
    const t = setup();
    episodeFor(t, { record: { editing: HERS } });
    const r = await on(t.ctx.deps, "episodes");
    assert.match(r.text, /\n {4}Editing: Sallie's laptop, since 2026-10-20 14:00\n/);
    t.done();
  });
  it("is seen by the other Mac: when this Mac has opened it, hers refuses, and the claim stays this Mac's", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const her = otherMac(t);
    const refused = await on(her.deps, "open", FOLDER);
    assert.equal(refused.code, 1);
    assert.equal(refused.text, "Mac Studio has Pricing talk open. Carry on there. Nothing was changed.");
    assert.equal(reread(found).editing.by, "Mac Studio");
    assert.ok(!existsSync(join(found.folder, "record", "0003.json")));
    t.done();
  });
});

describe("the guard, with the other Mac's answer", () => {
  /** The made-up episode as Mac Studio handed it over, with `answers`. */
  const handedOver = (t, answers) => episodeFor(t, { record: { ...EDITED, released: { at: "2026-10-20T13:00:00-05:00", by: "Mac Studio", files: {}, answers } } });
  it("on the other Mac, a push asks nothing when the first Mac said no changes at that version", async () => {
    const t = setup();
    const found = handedOver(t, { "reel 1": { v: 1, said: "no changes" } });
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 0, r.text);
    const pushed = reread(found).reels[0].pushed;
    assert.deepEqual([pushed.length, pushed[1].v, pushed[1].on], [2, 2, "Sallie's laptop"]);
    t.done();
  });
  it("on the other Mac, a push refuses when the first Mac said its changes stay there, even with --no-hand-edits", async () => {
    const t = setup();
    const found = handedOver(t, { "reel 1": { v: 1, said: "changes stay on Mac Studio" } });
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    const stay = `The changes to v1 of reel 1 stay on Mac Studio, in its Final Cut library: Mac Studio said so when it handed this over. Finish that part on Mac Studio, or start again from v1 without them (say "go ahead without Mac Studio's changes").`;
    for (const flags of [[], ["--no-hand-edits"]]) {
      const r = await on(her.deps, "push", FOLDER, "reel", "1", ...flags);
      assert.deepEqual([r.code, r.text], [1, stay], flags.join(" "));
    }
    assert.equal(reread(found).reels[0].pushed.length, 1);
    const r = await on(her.deps, "push", FOLDER, "reel", "1", "--without-other-macs-changes");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(reread(found).reels[0].pushed.map((p) => [p.v, p.on]), [[1, "Mac Studio"], [2, "Sallie's laptop"]]);
    t.done();
  });
  it("on the other Mac, takes no answer given for an older version", async () => {
    const t = setup();
    const v2 = { v: 2, at: "2026-10-20T12:00:00-05:00", on: "Mac Studio", file: "edit/x.v2.mac-studio.fcpxml", project: "Pricing- what to charge- reel 1 v2 3fa9c1" };
    const found = episodeFor(t, { record: { ...EDITED, reels: [{ ...EDITED.reels[0], pushed: [...EDITED.reels[0].pushed, v2] }, ...EDITED.reels.slice(1)], released: { at: "2026-10-20T13:00:00-05:00", by: "Mac Studio", files: {}, answers: { "reel 1": { v: 1, said: "no changes" } } } } });
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.match(r.text, /^v2 of reel 1 was shown on Mac Studio, and Mac Studio has not said whether it was changed there\./);
    assert.equal(reread(found).reels[0].pushed.length, 2);
    t.done();
  });
  it("on the Mac that pushed last, asks as before", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Did you change v1 of /);
    t.done();
  });
});
