// The claim (phase 1b): `open` writes which Mac is editing an episode, waits for Dropbox to bring the change across, and
// reads it again; a Mac takes an episode over only when told to; and the commands that write refuse while the other Mac
// has it. Two Macs share one root here, each with a home of its own (otherMac). Nothing touches Dropbox, Final Cut or a
// program: every program is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, CLAIM_WAIT_MS } from "../edit.js";
import { claimed, localStamp, recordFile, recordText, shown } from "../episode.js";
import { setup, episodeFor, reread, otherMac, FOLDER, EDITED, NAME, PROJECT } from "./episodes.js";

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
  it("name, title, a Reel's title, reel pick and drop, push and finish refuse while the other Mac has it, and write nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: HERS } });
    const held = `Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`;
    for (const argv of [["name", FOLDER, "Pricing"], ["title", FOLDER, "--words", "Price it right", "--approve", "--change"], ["title", FOLDER, "reel", "1", "--words", "Costs first"],
      ["reel", "pick", FOLDER, "3"], ["reel", "drop", FOLDER, "2"], ["push", FOLDER], ["push", FOLDER, "reel", "1", "--no-hand-edits"], ["finish", FOLDER], ["finish", FOLDER, "--yes"]]) {
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
