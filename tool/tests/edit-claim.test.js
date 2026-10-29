// The claim (phase 1b): `open` writes which Mac is editing an episode, waits for Dropbox to bring the change across, and
// reads it again; a Mac takes an episode over only when told to; and the commands that write refuse while the other Mac
// has it. Two Macs share one root here, each with a home of its own (otherMac). Nothing touches Dropbox, Final Cut or a
// program: every program is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, CLAIM_WAIT_MS } from "../edit.js";
import { claimed, filesProblems, localStamp, recordFile, recordText, shown } from "../episode.js";
import { readResult } from "../detached.js";
import { setup, episodeFor, reread, otherMac, listAll, FOLDER, EDITED, NAME, PROJECT } from "./episodes.js";

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
  it("refuses when the other Mac has it, and takes it over when told to", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    const refused = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(refused.code, 1);
    assert.equal(refused.text, `Sallie's laptop has Pricing talk open, since 2026-10-20 14:00. Say "take it over" to open it here; anything not handed over stays on Sallie's laptop.`);
    assert.equal(reread(found).rev, 1);
    const taken = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(taken.code, 0, taken.text);
    assert.match(taken.text, /^Taken over from Sallie's laptop, who had it since 2026-10-20 14:00\.\n/);
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
  it("stops when the other Mac took it over during the wait", async () => {
    const t = setup();
    const found = episodeFor(t);
    // Her take-over comes after this Mac's claim, as the record after it.
    duringTheWait(t, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...claimed(mine, "Sallie's laptop", "2026-10-20T15:00:10-05:00"), rev: mine.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1);
    assert.equal(r.text, `Sallie's laptop opened Pricing talk at the same time, and it is theirs. Say "take it over" if they are done with it.`);
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
  it("on a take-over, stops when the other Mac claimed it again during the wait", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    duringTheWait(t, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...claimed(mine, "Sallie's laptop", "2026-10-20T15:00:10-05:00"), rev: mine.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 1);
    assert.ok(r.text.endsWith(`Sallie's laptop opened Pricing talk at the same time, and it is theirs. Say "take it over" if they are done with it.`), r.text);
    t.done();
  });
  it("on a take-over, stops, naming the conflict, when the other Mac wrote the same record number during the wait", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    const copy = "0002 (Sallie's laptop's conflicted copy 2026-10-20).json";
    duringTheWait(t, () => {
      const first = { ...reread(found), rev: 1 };
      writeFileSync(join(found.folder, "record", copy), recordText({ ...first, rev: 2, name: { text: "Hers", placeholder: false }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 1);
    assert.ok(r.text.split("\n").some((line) => line.startsWith(`${FOLDER}: Dropbox has kept a conflicted copy in this episode: record/${copy}.`)), r.text);
    t.done();
  });
  it("says still arriving, starts bring, and claims nothing, when released files are not here yet", async () => {
    const t = setup();
    const found = episodeFor(t);
    const share = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [share]: 9 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { ...first.files, [share]: 9 } } }));
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Still arriving from Sallie's laptop: 1 file. Dropbox is bringing them over; say "open Pricing talk" again when it is done.`);
    assert.equal(reread(found).rev, 2);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, share]]);
    assert.deepEqual(t.waits, []);
    t.done();
  });
  it("refuses at once, and brings nothing, when the other Mac has it and its files are not here", async () => {
    const theirs = `Sallie's laptop has Pricing talk open, since 2026-10-20 14:00. Say "take it over" to open it here; anything not handed over stays on Sallie's laptop.`;
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
  it("on a take-over, brings the files that are not whole here, claims nothing until they are, and says to take it over again", async () => {
    // The take-over goes past the refusal, but a file not whole on this Mac is still brought over first. What it says next
    // is to take it over again, not to open it: a plain open would refuse, and she would be asked a second time (the review
    // of the follow-ups plan, P8).
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    let read = false;
    t.ctx.deps.isWhole = (path) => read || !path.endsWith("Pricing talk.mp4");
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.deepEqual([r.code, r.text], [0, `Dropbox is bringing 1 file of Pricing talk over to this Mac. Say "take it over" again when it is done; "how far is it?" shows how far it has got.`]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--take-over"]]);
    assert.deepEqual([reread(found).rev, reread(found).editing.by, t.waits], [1, "Sallie's laptop", []]);
    // The run it started says the same when it is done, for "how far is it?" to read out, in this session or a later one, but
    // only while the claim she said to take over stands: it keeps whose claim that was. Otherwise it says to open it.
    t.ctx.deps.readAll = async () => {
      read = true;
    };
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    const brought = readResult(t.home, FOLDER, "bring");
    assert.deepEqual([brought.ok, brought.made, brought.next], [true, ["Pricing talk.mp4"], `Every file of Pricing talk is here. Say "open Pricing talk".`]);
    assert.deepEqual(brought.takeOver, { by: "Sallie's laptop", since: HERS.since, next: `Every file of Pricing talk is here. Say "take it over" again.` });
    assert.match((await on(t.ctx.deps, "status")).text, /bring ended .* ago\. Made: Pricing talk\.mp4\. Every file of Pricing talk is here\. Say "take it over" again\.$/);
    // Taken over again, with the files whole now: it is claimed, and nothing more is asked.
    const again = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(again.code, 0, again.text);
    assert.match(again.text, /^Taken over from Sallie's laptop, who had it since 2026-10-20 14:00\./);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [2, "Mac Studio"]);
    t.done();
  });
  it("on a take-over, says why when the files it brought are not all here, and to open it, not to take it over again", async () => {
    // A bring that failed would most likely fail again the same way: a full disk, Dropbox paused, the Mac offline. Were it to
    // say to take it over again, the skill would do so without asking her, and start the same bring again, round after round,
    // and she would not hear why (review #24-2). So it says why, and to open it, as any bring that failed does: a plain open
    // refuses, and she is asked again.
    const full = async () => {
      throw Object.assign(new Error("no space left"), { code: "ENOSPC" });
    };
    for (const [readAll, why] of [[async () => {}, "Pricing talk.mp4 is still not whole"], [full, "Pricing talk.mp4 could not be read (ENOSPC)"]]) {
      const t = setup();
      const found = episodeFor(t, { record: { editing: HERS } });
      t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
      t.ctx.deps.readAll = readAll;
      assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
      assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 1);
      const brought = readResult(t.home, FOLDER, "bring");
      assert.deepEqual([brought.ok, brought.failed, brought.next], [false, [why], `Some files of Pricing talk are not here yet. Say "open Pricing talk" to try again.`]);
      assert.equal(brought.takeOver, undefined);
      const howFar = (await on(t.ctx.deps, "status")).text;
      assert.match(howFar, new RegExp(`Not done: ${why.replace(/[.()]/g, "\\$&")}\\. Some files of Pricing talk are not here yet\\. Say "open Pricing talk" to try again\\.$`));
      assert.doesNotMatch(howFar, /take it over/);
      // As it says: a plain open refuses, starts nothing, and she is asked again.
      const plain = await on(t.ctx.deps, "open", FOLDER);
      assert.equal(plain.code, 1, plain.text);
      assert.match(plain.text, /^Sallie's laptop has Pricing talk open, since 2026-10-20 14:00\. Say "take it over"/);
      assert.equal(t.started.length, 1);
      assert.deepEqual([reread(found).rev, reread(found).editing.by], [1, "Sallie's laptop"]);
      t.done();
    }
  });
  it("has \"how far is it?\" stop saying to take it over again once it is taken over, and when the other Mac opens it again later", async () => {
    // The bring of a take-over says to take it over again, and the skill then does so without asking her. Its result stays on
    // this Mac after the take-over is done: a line that still said so when the other Mac had it again would have the skill take
    // it from the Mac editing it, and nobody asked her (the fold's check of P8).
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    let read = false;
    t.ctx.deps.isWhole = (path) => read || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async () => {
      read = true;
    };
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    const taken = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(taken.code, 0, taken.text);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [2, "Mac Studio"]);
    // Taken over: this Mac has it, and nothing is to be taken over. It says to open it, as any bring does.
    const done = (await on(t.ctx.deps, "status")).text;
    assert.doesNotMatch(done, /take it over/);
    assert.match(done, /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    // Days later Sallie's laptop has it again, a claim she has not been asked about: still no take-over, and an open refuses.
    const mine = reread(found);
    writeFileSync(recordFile(found.folder, 3), recordText({ ...claimed(mine, "Sallie's laptop", "2026-10-22T09:00:00-05:00"), rev: 3, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const later = (await on(t.ctx.deps, "status")).text;
    assert.doesNotMatch(later, /take it over again/);
    assert.match(later, /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    const plain = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(plain.code, 1, plain.text);
    assert.match(plain.text, /^Sallie's laptop has Pricing talk open, since 2026-10-22 09:00\. Say "take it over"/);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [3, "Sallie's laptop"]);
    t.done();
  });
  it("has \"how far is it?\" say to take it over again while her claim stands, and not once she has let it go or opened it again", async () => {
    // She said yes to taking over Sallie's laptop's claim, and the files came, but it was not taken over. A change of hers that
    // keeps the claim leaves it to be taken over; a claim of hers made since is one she was not asked about.
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    let read = false;
    t.ctx.deps.isWhole = (path) => read || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async () => {
      read = true;
    };
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    const first = reread(found);
    const hers = (rev, editing) => writeFileSync(recordFile(found.folder, rev), recordText({ ...first, rev, editing, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const howFar = async () => (await on(t.ctx.deps, "status")).text;
    // A change of hers, with the same claim: still to be taken over.
    hers(2, HERS);
    assert.match(await howFar(), /Every file of Pricing talk is here\. Say "take it over" again\.$/);
    // A claim of another Mac's, even since the same time, is not the one she was asked about.
    hers(3, { ...HERS, by: "Jason's laptop" });
    assert.match(await howFar(), /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    // Back to her claim, and then she let it go: nothing to take over, and a plain open goes through.
    hers(4, HERS);
    hers(5, null);
    assert.match(await howFar(), /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    // She opened it again: a claim of hers she was not asked about. It says to open it, and an open refuses.
    hers(6, { by: "Sallie's laptop", since: "2026-10-22T09:00:00-05:00" });
    const later = await howFar();
    assert.doesNotMatch(later, /take it over again/);
    assert.match(later, /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 1);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [6, "Sallie's laptop"]);
    t.done();
  });
  it("has \"how far is it?\" stop saying to take it over again once a plain open has asked her again, with the claim the same", async () => {
    // Her yes is for that once. A plain open that refuses has her asked again, and she may say no: were the yes she gave
    // before still to count, "how far is it?" would have the skill take the episode over unasked, against her last answer,
    // for as long as the other Mac's claim stood, through every push made there (review #24-1).
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    let read = false;
    t.ctx.deps.isWhole = (path) => read || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async () => {
      read = true;
    };
    const howFar = async () => (await on(t.ctx.deps, "status")).text;
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    assert.match(await howFar(), /Say "take it over" again\.$/);
    // A day later she says to open it: it refuses, with the claim she said yes to before, and she is asked again.
    const asked = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(asked.code, 1, asked.text);
    assert.match(asked.text, /^Sallie's laptop has Pricing talk open, since 2026-10-20 14:00\. Say "take it over"/);
    const after = await howFar();
    assert.doesNotMatch(after, /take it over/);
    assert.match(after, /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    // A change of hers that keeps the claim, as a push does, brings the old yes back no more.
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.doesNotMatch(await howFar(), /take it over/);
    // She says yes again: taken over, with the files here now, and nothing more is asked.
    const yes = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(yes.code, 0, yes.text);
    assert.match(yes.text, /^Taken over from Sallie's laptop, who had it since 2026-10-20 14:00\./);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [3, "Mac Studio"]);
    t.done();
  });
  it("has \"how far is it?\" say to open it, not to take it over again, when she was asked again while the bring was at work", async () => {
    // The bring was started on her yes, and she was asked again, by a plain open that refused, before it ended: the result it
    // leaves after that is not to bring the old yes back.
    const t = setup();
    episodeFor(t, { record: { editing: HERS } });
    let read = false;
    const asked = [];
    t.ctx.deps.isWhole = (path) => read || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async () => {
      asked.push((await on(t.ctx.deps, "open", FOLDER)).code);
      read = true;
    };
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    assert.deepEqual(asked, [1]);
    const howFar = (await on(t.ctx.deps, "status")).text;
    assert.doesNotMatch(howFar, /take it over/);
    assert.match(howFar, /Every file of Pricing talk is here\. Say "open Pricing talk"\.$/);
    t.done();
  });
  it("has \"how far is it?\" say to open it when the other Mac's claim changed after her yes, so she is asked about the new one", async () => {
    // Her yes was to the claim since 14:00. Before the bring started, Sallie's laptop opened it again, since 14:30: the bring
    // takes over that newer claim, which she was never asked about, so the skill must not take it over unasked.
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, editing: { by: "Sallie's laptop", since: "2026-10-20T14:30:00-05:00" } }));
    t.ctx.deps.isWhole = () => true;
    assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, "--take-over")).code, 0);
    const howFar = (await on(t.ctx.deps, "status")).text;
    assert.doesNotMatch(howFar, /take it over/);
    assert.match(howFar, /Say "open Pricing talk"\.$/);
    t.done();
  });
  it("says to open it again, not to take it over, when --take-over is given and no other Mac has it", async () => {
    // Nobody had it, so nothing was taken over: a plain open goes through when the files are here.
    const t = setup();
    episodeFor(t);
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.deepEqual([r.code, r.text], [0, `Dropbox is bringing 1 file of Pricing talk over to this Mac. Say "open Pricing talk" again when it is done; "how far is it?" shows how far it has got.`]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER]]);
    t.done();
  });
  it("refuses, and says nothing of still arriving, when the Mac that handed it over has opened it again", async () => {
    const t = setup();
    const found = episodeFor(t);
    const share = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    const first = reread(found);
    // Sallie's laptop handed it over with a Share that is not here yet, then opened it again: claimed() keeps `released`.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, editing: HERS, files: { ...first.files, [share]: 9 }, released: { at: "2026-10-20T13:30:00-05:00", by: "Sallie's laptop", files: { ...first.files, [share]: 9 } } }));
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text, `Sallie's laptop has Pricing talk open, since 2026-10-20 14:00. Say "take it over" to open it here; anything not handed over stays on Sallie's laptop.`);
    assert.doesNotMatch(r.text, /Still arriving/);
    assert.deepEqual(t.started, []);
    assert.equal(reread(found).rev, 2);
    t.done();
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
  it("on a take-over, says Dropbox undid the claim, not that the other Mac has it, when the record is back to theirs after the wait", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
    });
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 1, r.text);
    // She said to take it over, and the record is back to the one she said it of: so it says to take it over again, since a
    // plain open would refuse and ask her a second time (the review of the follow-ups plan, P8).
    assert.equal(r.text.split("\n").pop(), `Dropbox undid this Mac's claim on Pricing talk. Say "take it over" again.`);
    assert.doesNotMatch(r.text, /at the same time/);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    // As it says: taken over again, it goes through, and does not say again that Dropbox undid a change.
    const again = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(again.code, 0, again.text);
    assert.doesNotMatch(again.text, /undid/);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [2, "Mac Studio"]);
    t.done();
  });
  it("on a take-over Dropbox undid, says to open it, not to take it over, when nobody has it now, and waits for what she handed over", async () => {
    // In the same moments as the take-over, Sallie's laptop handed the episode over, with a Share that is not here yet, and
    // Dropbox kept her record in place of this Mac's claim. Nobody has it now: there is nothing to take over, and the next
    // open is to wait for the Share, not to call it missing (review #24-4).
    const t = setup();
    const found = episodeFor(t, { record: { editing: HERS } });
    const share = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
      const first = reread(found);
      const files = { ...first.files, [share]: 9 };
      writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, editing: null, files, released: { at: "2026-10-20T15:00:05-05:00", by: "Sallie's laptop", files }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text.split("\n").pop(), `Dropbox undid this Mac's claim on Pricing talk. Say "open Pricing talk" again.`);
    assert.deepEqual([reread(found).rev, reread(found).editing], [2, null]);
    // A take-over of a record nobody has open is a plain open: both wait for the Share, and claim nothing yet.
    const still = `Still arriving from Sallie's laptop: 1 file. Dropbox is bringing them over; say "open Pricing talk" again when it is done.`;
    for (const flags of [[], ["--take-over"]]) {
      const again = await on(t.ctx.deps, "open", FOLDER, ...flags);
      assert.deepEqual([again.code, again.text], [0, still]);
    }
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, share], ["bring", "--now", FOLDER, share]]);
    assert.equal(reread(found).rev, 2);
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
    const held = `Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`;
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
  it("is seen by the other Mac: when this Mac has opened it, hers refuses until she takes it over", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const her = otherMac(t);
    const refused = await on(her.deps, "open", FOLDER);
    assert.equal(refused.code, 1);
    assert.ok(refused.text.startsWith(`Mac Studio has Pricing talk open, since ${shown(localStamp(new Date(Date.parse("2026-10-20T15:00:00-05:00"))))}.`), refused.text);
    assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    assert.ok(!existsSync(join(found.folder, "record", "0004.json")));
    t.done();
  });
});

describe("release", () => {
  const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  /** The made-up episode as this Mac edited it, with this Mac editing it now. */
  const editedHere = (t, more = {}) => episodeFor(t, { record: { ...EDITED, editing: MINE, ...more } });
  /** A Share and its export in this Mac's From Final Cut: the Share `share` ms after the clock's start, the export `exported`
      ms after it, its bundle and its Info.fcpxml alike. */
  const sharedWithExport = (t, project, share, exported) => {
    const video = t.shared(`${project}.mov`, share);
    const bundle = t.shared(`${project}.fcpxmld`, exported);
    const when = new Date(Date.parse("2026-10-20T14:00:00-05:00") + exported);
    utimesSync(join(bundle, "Info.fcpxml"), when, when);
    return { video, bundle };
  };
  it("refuses on a Mac that does not have it", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    // Nobody has it open, and this Mac pushed none of its parts last: there is nothing of its own to hand over.
    const none = await on(otherMac(t).deps, "release", FOLDER);
    assert.deepEqual([none.code, none.text], [1, `This Mac does not have ${NAME} open, so there is nothing to hand over.`]);
    assert.equal(reread(found).rev, 1);
    t.done();
    const u = setup();
    const held = episodeFor(u, { record: { ...EDITED, editing: HERS } });
    const hers = await on(u.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.deepEqual([hers.code, hers.text], [1, `Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`]);
    assert.equal(reread(held).rev, 1);
    u.done();
  });
  it("asks about hand edits when this Mac pushed, and writes nothing until answered", async () => {
    const t = setup();
    const found = editedHere(t);
    const r = await on(t.ctx.deps, "release", FOLDER);
    assert.equal(r.code, 1);
    assert.equal(r.text, `Did you change anything in Final Cut since it was last shown (main v5, reel 1 v1 and reel 2 v1)? Say "no changes" to hand it over, or "hand it over anyway" if your changes should stay on this Mac.`);
    assert.deepEqual([reread(found).rev, reread(found).editing.by], [1, "Mac Studio"]);
    t.done();
  });
  it("lets it go with the answers, copies the Share and the export, lists them, and says to keep the Mac open", async () => {
    const t = setup();
    const found = editedHere(t);
    sharedWithExport(t, PROJECT.main, 0, 60000);
    writeFileSync(join(found.folder, ".DS_Store"), "Finder's own");
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    const after = reread(found);
    assert.equal(after.editing, null);
    assert.deepEqual({ ...after.released, at: "" }, { at: "", by: "Mac Studio", files: after.files, answers: { main: { v: 5, said: "no changes" }, "reel 1": { v: 1, said: "no changes" }, "reel 2": { v: 1, said: "no changes" } } });
    const video = `edit/from-final-cut/${PROJECT.main}.mov`;
    const info = `edit/from-final-cut/${PROJECT.main}.fcpxmld/Info.fcpxml`;
    for (const rel of [video, info]) {
      assert.ok(existsSync(join(found.folder, rel)), rel);
      assert.equal(after.files[rel], statSync(join(found.folder, rel)).size, rel);
    }
    assert.ok(!(".DS_Store" in after.files));
    // Every file the record listed before is listed still, at its size.
    for (const [rel, bytes] of Object.entries(found.record.files)) assert.equal(after.files[rel], bytes, rel);
    const order = t.clones.map(([, to]) => to);
    assert.ok(order.findIndex((to) => to.endsWith(".mov")) < order.findIndex((to) => to.endsWith("Info.fcpxml")), order.join("\n"));
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: ${PROJECT.main}.mov and ${PROJECT.main}.fcpxmld. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    t.done();
  });
  it("keeps the changes on this Mac when told so, and says so to the other Mac", async () => {
    const t = setup();
    const found = editedHere(t);
    sharedWithExport(t, PROJECT.main, 0, 60000);
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--hand-edits-stay")).code, 0);
    assert.deepEqual(reread(found).released.answers.main, { v: 5, said: "changes stay on Mac Studio" });
    t.done();
  });
  it("refuses when a part's export is older than its Share, and writes nothing", async () => {
    const t = setup();
    const found = editedHere(t);
    sharedWithExport(t, PROJECT.main, 60000, 0);
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    assert.equal(r.text, `The main video's export is older than its Shared video. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${PROJECT.main}", and save it into From Final Cut. Then hand it over again. Nothing was handed over.`);
    assert.equal(reread(found).rev, 1);
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut")));
    t.done();
  });
  it("checks the newest version's Share against that version's newest export, as finish does", async () => {
    const t = setup();
    const found = editedHere(t);
    // v4's Share has a fresh export; v5's Share was made again after its export.
    sharedWithExport(t, "Pricing- what to charge- main v4 3fa9c1", 0, 60000);
    sharedWithExport(t, PROJECT.main, 120000, 90000);
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    assert.match(r.text, new RegExp(`^The main video's export is older than its Shared video\\. .* on "${PROJECT.main}", `));
    assert.equal(reread(found).rev, 1);
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut")));
    t.done();
  });
  it("goes by the newest of two exports of one project, and copies that one alone", async () => {
    const t = setup();
    const found = editedHere(t);
    // An export bundle made before the Share, and an .fcpxml made after it.
    sharedWithExport(t, PROJECT.main, 60000, 0);
    const fresh = t.shared(`${PROJECT.main}.fcpxml`, 120000, "<fcpxml/>");
    assert.ok(existsSync(fresh));
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.ok(existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxml`)));
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxmld`)));
    t.done();
  });
  it("leaves out the files of an export bundle that Dropbox never syncs", async () => {
    const t = setup();
    const found = editedHere(t);
    const { bundle } = sharedWithExport(t, PROJECT.main, 0, 60000);
    writeFileSync(join(bundle, ".DS_Store"), "Finder's own");
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    const listed = Object.keys(reread(found).files).filter((f) => f.includes(".fcpxmld"));
    assert.deepEqual(listed, [`edit/from-final-cut/${PROJECT.main}.fcpxmld/Info.fcpxml`]);
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxmld`, ".DS_Store")));
    t.done();
  });
  it("hands over an episode nobody has open when this Mac pushed a part last, asking first", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    const asked = await on(t.ctx.deps, "release", FOLDER);
    assert.equal(asked.code, 1);
    assert.match(asked.text, /^Did you change anything in Final Cut since it was last shown/);
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).editing, reread(found).released.by, reread(found).released.answers.main], [null, "Mac Studio", { v: 5, said: "no changes" }]);
    t.done();
  });
  it("refuses a Share with no export when there were changes, as finish would ask", async () => {
    const t = setup();
    editedHere(t);
    t.shared(`${PROJECT.main}.mov`, 0);
    const r = await on(t.ctx.deps, "release", FOLDER, "--hand-edits-stay");
    assert.equal(r.code, 1);
    assert.match(r.text, /^The main video was never exported\. .* Then hand it over again\. Nothing was handed over\.$/);
    t.done();
  });
  it("leaves out a Share still being written, and names it", async () => {
    const t = setup();
    const found = editedHere(t);
    const video = t.shared(`${PROJECT["reel 1"]}.mov`, 0);
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (ms === 5000) t.grow(video, 10);
    };
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: nothing. Not copied yet, still being written: ${PROJECT["reel 1"]}.mov. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`)));
    t.done();
  });
  /** Reel 1 as the other Mac left it: v1 shown here, then v2 shown on Sallie's laptop, the part's newest push. */
  const reelOneHers = () => {
    const v2 = { v: 2, at: "2026-10-20T12:00:00-05:00", on: "Sallie's laptop", file: "edit/x.v2.sallies-laptop.fcpxml", project: "Pricing- what to charge- reel 1 v2 3fa9c1" };
    return [{ ...EDITED.reels[0], pushed: [...EDITED.reels[0].pushed, v2] }, ...EDITED.reels.slice(1)];
  };
  it("copies nothing of a part the other Mac pushed last", async () => {
    const t = setup();
    const found = editedHere(t, { reels: reelOneHers() });
    sharedWithExport(t, PROJECT.main, 0, 60000);
    // This Mac's Share of reel 1's v1, and an export of it older than the Share: neither is this Mac's to hand over now.
    sharedWithExport(t, PROJECT["reel 1"], 60000, 0);
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(listAll(join(found.folder, "edit", "from-final-cut")), [`${PROJECT.main}.fcpxmld/Info.fcpxml`, `${PROJECT.main}.mov`]);
    assert.deepEqual(Object.keys(reread(found).files).filter((rel) => rel.includes("reel 1")), []);
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: ${PROJECT.main}.mov and ${PROJECT.main}.fcpxmld. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    t.done();
  });
  it("lists no more a copy of its own that Dropbox took away, of a part the other Mac has pushed since, and she does not wait for it (the review of the plan, P1 and P7)", async () => {
    const t = setup();
    const found = editedHere(t);
    const copy = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    // This Mac Shares reel 1's v1 and hands the episode over: the copy is made and listed.
    t.shared(`${PROJECT["reel 1"]}.mov`, 0, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.ok(copy in reread(found).files);
    // Her laptop opens it, pushes reel 1's v2, and hands it back.
    const her = otherMac(t);
    for (const argv of [["open", FOLDER], ["push", FOLDER, "reel", "1"], ["release", FOLDER, "--no-hand-edits"]]) {
      const r = await on(her.deps, ...argv);
      assert.equal(r.code, 0, `${argv.join(" ")}\n---\n${r.text}`);
    }
    // This Mac opens it again, and then Dropbox takes its copy of reel 1's v1 away.
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    rmSync(join(found.folder, copy));
    // Reel 1 is hers now, so this release does not make the copy again: the record lists it no more, and says so.
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: nothing. Gone from Dropbox, so no longer listed for the other Mac: ${PROJECT["reel 1"]}.mov. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    const after = reread(found);
    assert.ok(!existsSync(join(found.folder, copy)));
    assert.deepEqual([copy in after.files, copy in after.released.files], [false, false]);
    assert.deepEqual(filesProblems(found.folder, after), []);
    // Her laptop opens it: nothing is still arriving, and it is hers.
    const opened = await on(her.deps, "open", FOLDER);
    assert.equal(opened.code, 0, opened.text);
    assert.doesNotMatch(opened.text, /Still arriving/);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    t.done();
  });
  it("refuses a listed copy of a part the other Mac pushed last that is there but not whole, naming it, as any other file", async () => {
    const t = setup();
    // An earlier hand-over copied reel 1's v1 Share, when this Mac had pushed reel 1 last. The record lists it, and what is
    // there is short: it is not gone, so it is not this release's to stop listing.
    const found = editedHere(t, { reels: reelOneHers() });
    const copy = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [copy]: 16 } }));
    t.shared(`${PROJECT["reel 1"]}.mov`, 0);
    mkdirSync(join(found.folder, "edit", "from-final-cut"), { recursive: true });
    writeFileSync(join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`), "a finished");
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    assert.equal(r.text, `${FOLDER} is not whole in Dropbox: ${copy} is short: 10 bytes of 16. Nothing was handed over.`);
    assert.equal(reread(found).rev, 2);
    t.done();
  });
  it("refuses a listed copy the other Mac made that is missing here, naming it, since it may still be arriving or be hers (the review of the plan, P1 and P7)", async () => {
    const t = setup();
    // Her laptop pushed reel 1's v2 and copied its Share at a hand-over. The record lists that copy, and it is not here yet.
    // Only a copy made from this Mac's own From Final Cut is this release's to stop listing; hers is checked as any other
    // file, so the release stops, and her copy stays listed.
    const found = editedHere(t, { reels: reelOneHers() });
    const hers = "edit/from-final-cut/Pricing- what to charge- reel 1 v2 3fa9c1.mov";
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [hers]: 16 } }));
    sharedWithExport(t, PROJECT.main, 0, 60000);
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text, `${FOLDER} is not whole in Dropbox: ${hers} is missing. Nothing was handed over.`);
    const after = reread(found);
    assert.equal(after.rev, 2);
    assert.equal(after.files[hers], 16);
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut")));
    t.done();
  });
  it("lists no more a copy Dropbox took away of an older export, since this release copies only the newest export (PR 21's W15)", async () => {
    const t = setup();
    // An earlier hand-over copied the main video's export bundle. The record lists it, and it is gone; an .fcpxml of the same
    // project, made since, is the export this release copies.
    const found = editedHere(t);
    const copy = `edit/from-final-cut/${PROJECT.main}.fcpxmld/Info.fcpxml`;
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [copy]: 200 } }));
    sharedWithExport(t, PROJECT.main, 0, 60000);
    t.shared(`${PROJECT.main}.fcpxml`, 120000, "<fcpxml/>");
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: ${PROJECT.main}.mov and ${PROJECT.main}.fcpxml. Gone from Dropbox, so no longer listed for the other Mac: ${PROJECT.main}.fcpxmld. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    const after = reread(found);
    assert.deepEqual(listAll(join(found.folder, "edit", "from-final-cut")), [`${PROJECT.main}.fcpxml`, `${PROJECT.main}.mov`]);
    assert.ok(!(copy in after.files));
    assert.deepEqual(filesProblems(found.folder, after), []);
    t.done();
  });
  it("lists no more a copy Dropbox took away of a Share still being written, and names it both ways", async () => {
    const t = setup();
    // An earlier hand-over copied reel 1's Share. The record lists it, and it is gone; Final Cut is writing the Share again.
    const found = editedHere(t);
    const copy = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [copy]: 16 } }));
    const video = t.shared(`${PROJECT["reel 1"]}.mov`, 0);
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (ms === 5000) t.grow(video, 10);
    };
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `${NAME} is handed over. Copied for the other Mac: nothing. Not copied yet, still being written: ${PROJECT["reel 1"]}.mov. Gone from Dropbox, so no longer listed for the other Mac: ${PROJECT["reel 1"]}.mov. Keep this Mac open and online until Dropbox shows the folder is up to date.`);
    assert.ok(!(copy in reread(found).files));
    assert.deepEqual(filesProblems(found.folder, reread(found)), []);
    t.done();
  });
  it("keeps the first Mac's answer when a Mac that pushed nothing releases it", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: HERS, released: { at: "2026-10-20T13:00:00-05:00", by: "Mac Studio", files: {}, answers: { "reel 1": { v: 1, said: "no changes" } } } } });
    const her = otherMac(t);
    const r = await on(her.deps, "release", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).released.by, reread(found).released.answers], ["Sallie's laptop", { "reel 1": { v: 1, said: "no changes" } }]);
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
  it("on the other Mac after a take-over, a push refuses because no answer was carried", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.equal(r.text, `v1 of reel 1 was shown on Mac Studio, and Mac Studio has not said whether it was changed there. Ask whoever used it on Mac Studio. If it was not changed, or to start again from v1 without those changes, say "go ahead without Mac Studio's changes".`);
    assert.doesNotMatch(r.text, /Did you change v1/);
    assert.equal(reread(found).reels[0].pushed.length, 1);
    // Only its own flag lifts it (ruling 7): her "no hand edits" is about her own Final Cut, never about Mac Studio's.
    const rev = reread(found).rev;
    const noEdits = await on(her.deps, "push", FOLDER, "reel", "1", "--no-hand-edits");
    assert.deepEqual([noEdits.code, noEdits.text], [1, r.text]);
    assert.equal(reread(found).rev, rev);
    const without = await on(her.deps, "push", FOLDER, "reel", "1", "--without-other-macs-changes");
    assert.equal(without.code, 0, without.text);
    assert.deepEqual(reread(found).reels[0].pushed.map((p) => [p.v, p.on]), [[1, "Mac Studio"], [2, "Sallie's laptop"]]);
    assert.equal(reread(found).reels[0].pushed[1].answer, "without Mac Studio's changes since v1");
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
