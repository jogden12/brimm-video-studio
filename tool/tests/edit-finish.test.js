// finish, the quick part that looks and asks before anything starts; status for a finish; and free library. In a made-up
// episode (episodes.js), with Final Cut's files made up in a From Final Cut folder of the test's own home.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode, freeLibrary, status, titleEpisode } from "../edit.js";
import { episodeWork, fromFinalCutFolder, libraryFor } from "../settings.js";
import { resultFile, readResult } from "../detached.js";
import { setup, episodeFor, reread, EDITED, PROJECT, FOLDER } from "./episodes.js";

/** Final Cut's files at the end of the made-up edit: each part Shared, the main and Reel 1 exported after their Shares, and
    Reel 2 never exported. */
function sharedAll(t) {
  t.shared(`${PROJECT.main}.mp4`, 2000);
  t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
  t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
}

describe("finish, the part that looks and asks", () => {
  it("says what it found for each part and what it is taken for, and starts nothing without a yes", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal(await finishEpisode(t.ctx, found, { noHandEdits: ["reel 2"] }), 0);
    const said = t.said();
    assert.match(said, /The main video: Pricing- what to charge- main v5 3fa9c1\.mp4, from From Final Cut, with its export Pricing- what to charge- main v5 3fa9c1\.fcpxmld\./);
    assert.match(said, /Reel 1: Pricing- what to charge- reel 1 v1 3fa9c1\.mov, from From Final Cut, with its export Pricing- what to charge- reel 1 v1 3fa9c1\.fcpxmld\./);
    assert.match(said, /Reel 2: Pricing- what to charge- reel 2 v1 3fa9c1\.mov, from From Final Cut, with no hand edits\./);
    assert.match(said, /Say "yes, finish it" to start\.$/);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("starts the detached part with a yes, writes what it was told on this Mac's disk, and returns at once", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
    assert.equal(t.started.length, 1);
    assert.deepEqual(t.started[0][1].slice(-3), ["finish", "--now", FOLDER]);
    const asked = JSON.parse(readFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), "utf8"));
    // An episode nobody has open is claimed for this Mac while the finish runs, as the record after the one it was asked at.
    assert.equal(asked.rev, found.record.rev + 1);
    assert.equal(reread(found).editing.by, "Mac Studio");
    assert.deepEqual(asked.parts.map((p) => [p.key, p.video.name, p.export && p.export.name, p.noHandEdits]), [
      ["main", `${PROJECT.main}.mp4`, `${PROJECT.main}.fcpxmld`, false],
      ["reel 1", `${PROJECT["reel 1"]}.mov`, `${PROJECT["reel 1"]}.fcpxmld`, false],
      ["reel 2", `${PROJECT["reel 2"]}.mov`, null, true]
    ]);
    assert.match(t.said(), /Started\. The panel shows how far it is\./);
    t.done();
  });
  it("asks which Share is final when two files are of the highest version, and starts nothing even with a yes while anything is left to ask", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    t.shared("Pricing- what to charge- main v4 3fa9c1.mp4", 1000);
    t.shared(`${PROJECT.main}.mov`, 2100);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
    assert.match(t.said(), /For the main video there are two Shared videos of v5: .*main v5 3fa9c1\.mov, .*main v5 3fa9c1\.mp4\. Which is the final one\?/);
    assert.deepEqual(t.started, []);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"], take: { main: `${PROJECT.main}.mp4` } }), 0);
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("asks for an export of a part changed since its last export, and of a part never exported", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 1000);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true }), 0);
    assert.match(t.said(), /Reel 1's export is older than its Shared video\. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "Pricing- what to charge- reel 1 v1 3fa9c1", and save it into From Final Cut\./);
    assert.match(t.said(), /Reel 2 was never exported\..*If you made no hand edits since it was shown, say so\./s);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("asks what a finished Reel's title says when it has none, naming it by its number and its first words, and starts nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, reels: EDITED.reels.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) } });
    sharedAll(t);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
    assert.match(t.said(), /Reel 2 has no title on screen\. Say what it says: it starts "Welcome to the show\."\./);
    assert.deepEqual(t.started, []);
    assert.equal(await titleEpisode(t.ctx, found, { reel: 2, words: "Say it again, better" }), 0);
    assert.equal(reread(found).reels[1].title, "Say it again, better");
    assert.equal(await finishEpisode(t.ctx, { ...found, record: reread(found) }, { yes: true, noHandEdits: ["reel 2"] }), 0);
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("takes an export to be as new as the later of its bundle's time and its Info.fcpxml's, since saving over a bundle may not touch the folder", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    const bundle = t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 1000);
    const later = new Date(Date.parse("2026-10-20T14:00:00-05:00") + 3000);
    utimesSync(join(bundle, "Info.fcpxml"), later, later);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0);
    assert.doesNotMatch(t.said(), /Reel 1's export is older/);
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("refuses a placeholder name, a title not approved, a file missing from the episode, and a finish already running", async () => {
    const cases = [
      [{ ...EDITED, name: { text: "Pricing talk", placeholder: true } }, /Give the episode its name first: it is still called "Pricing talk", from the video's file name\./],
      [{ ...EDITED, title: { ...EDITED.title, approved: false } }, /Approve a title first\./]
    ];
    for (const [record, words] of cases) {
      const t = setup();
      sharedAll(t);
      assert.equal(await finishEpisode(t.ctx, episodeFor(t, { record }), { yes: true, noHandEdits: ["reel 2"] }), 1);
      assert.match(t.said(), words);
      assert.deepEqual(t.started, []);
      t.done();
    }
    const missing = setup();
    const found = episodeFor(missing, { record: EDITED });
    rmSync(join(found.folder, "Pricing talk.reel-1.srt"));
    sharedAll(missing);
    assert.equal(await finishEpisode(missing.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 1);
    assert.match(missing.said(), /Pricing talk\.reel-1\.srt/);
    missing.done();
    const busy = setup();
    const held = episodeFor(busy, { record: EDITED });
    sharedAll(busy);
    mkdirSync(episodeWork(busy.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(busy.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    busy.ctx.alive = (pid) => pid === 4242;
    assert.equal(await finishEpisode(busy.ctx, held, { yes: true, noHandEdits: ["reel 2"] }), 1);
    assert.match(busy.said(), /finish is running for this episode\. Say "how far is it\?"/);
    assert.deepEqual(busy.started, []);
    busy.done();
  });
  it("lets a short video finish without a title, and with no Reels", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, kind: "short video", title: null, reels: [] } });
    t.shared(`${PROJECT.main}.mp4`, 2000);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["main"] }), 0);
    assert.equal(t.started.length, 1);
    t.done();
  });
  it("makes the From Final Cut folder when it is not there, and says where it looked for the main video", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    rmSync(fromFinalCutFolder(t.home), { recursive: true });
    assert.equal(await finishEpisode(t.ctx, found, { yes: true }), 1);
    assert.ok(existsSync(fromFinalCutFolder(t.home)));
    assert.match(t.said(), /The main video has not been Shared from Final Cut\./);
    assert.match(t.said(), /Looked in .*From Final Cut.* for: .*Pricing- what to charge- main v5 3fa9c1\.mov/s);
    t.done();
  });
});

describe("finish, from the command line", () => {
  it("reads its answers from the words it is run with, starts the detached part, and that part ends with a result", async () => {
    const t = setup();
    episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal(await editMain(["finish", "Pricing", "--yes", "--no-hand-edits", "reel 2", "--take", `main=${PROJECT.main}.mp4`], t.ctx.deps), 0);
    assert.deepEqual(t.started[0][1].slice(-3), ["finish", "--now", FOLDER]);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    const result = readResult(t.home, FOLDER, "finish");
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(result.made.includes("final/Pricing- what to charge-.brimm-ops.json"));
    t.done();
  });
});

describe("status, for a finish", () => {
  it("shows a finish that ended: what it made, what failed, and what it offers", async () => {
    const t = setup();
    episodeFor(t, { record: EDITED });
    const file = resultFile(t.home, FOLDER, "finish");
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, command: "finish", started: Date.parse("2026-10-20T15:00:00-05:00"), ended: Date.parse("2026-10-20T15:25:00-05:00"), ok: true, made: ["final/Pricing- what to charge-.brimm-ops.json"], failed: [], next: "Final Cut's render files can be freed with File > Delete Generated Library Files." }));
    await status(t.ctx, ["what", "to", "charge"]);
    assert.match(t.said(), /final\/Pricing- what to charge-\.brimm-ops\.json/);
    assert.match(t.said(), /File > Delete Generated Library Files/);
    t.done();
  });
});

describe("free library, held back from this version", () => {
  it("refuses from the command line in plain words, and deletes nothing", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, finished: { revision: 1, at: "2026-10-20T15:20:00-05:00", on: "Mac Studio", parts: {} } } });
    const library = libraryFor(t.home, FOLDER);
    mkdirSync(join(library, "Render Files"), { recursive: true });
    assert.equal(await editMain(["free", FOLDER, "library", "--yes"], t.ctx.deps), 1);
    assert.match(t.said(), /Deleting an episode's Final Cut library by command comes in a later version\. To free space now, use Final Cut's File > Delete Generated Library Files\./);
    assert.ok(existsSync(join(library, "Render Files")));
    t.done();
  });
});

describe("free library", () => {
  /** A finished episode: each part's edit kept in an export in final/, or no hand edits; and its library on this Mac. */
  function finished(t, { parts, src } = {}) {
    const found = episodeFor(t, {
      record: {
        ...EDITED,
        libraries: { "Mac Studio": `${FOLDER}.fcpbundle` },
        reels: EDITED.reels.map((r) => (r.n <= 2 ? { ...r, status: "finished" } : r)),
        finished: { revision: 1, at: "2026-10-20T15:20:00-05:00", on: "Mac Studio", parts: parts || { main: { v: 5, file: `final/${PROJECT.main}.mp4`, export: `final/${PROJECT.main}.fcpxmld` }, "reel 1": { v: 1, file: `final/${PROJECT["reel 1"]}.mov`, noHandEdits: true }, "reel 2": { v: 1, file: `final/${PROJECT["reel 2"]}.mov`, noHandEdits: true } } }
      }
    });
    mkdirSync(join(episodeWork(t.home, FOLDER), "pushed"), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "pushed", "main.v5.mac-studio.fcpxml"), "<fcpxml/>");
    writeFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), "{}");
    const bundle = join(found.folder, "final", `${PROJECT.main}.fcpxmld`);
    mkdirSync(bundle, { recursive: true });
    writeFileSync(join(bundle, "Info.fcpxml"), `<fcpxml version="1.11"><resources><asset id="r1"><media-rep src="file://${encodeURI(src || join(found.folder, "Pricing talk.mp4"))}"/></asset></resources></fcpxml>\n`);
    const library = libraryFor(t.home, FOLDER);
    mkdirSync(join(library, "Render Files"), { recursive: true });
    writeFileSync(join(library, "Render Files", "render.mov"), "x".repeat(2048));
    return { found, library };
  }
  it("says what it would delete and how large it is, and deletes only with a yes", async () => {
    const t = setup();
    const { found, library } = finished(t);
    assert.equal(await freeLibrary(t.ctx, found, {}), 0);
    assert.ok(existsSync(library));
    assert.match(t.said(), /This deletes .*\.fcpbundle, .*Its edits are kept in final\/\. Say yes to delete it\./);
    assert.equal(await freeLibrary(t.ctx, found, { yes: true }), 0);
    assert.equal(existsSync(library), false);
    assert.match(t.said(), /Deleted its Final Cut library on this Mac/);
    // Only the library goes: what else this Mac keeps for the episode stays.
    assert.ok(existsSync(join(episodeWork(t.home, FOLDER), "pushed", "main.v5.mac-studio.fcpxml")));
    assert.ok(existsSync(join(episodeWork(t.home, FOLDER), "finish.asked.json")));
    // The record no longer names a library on this Mac, so the next push makes a new one and names it there.
    assert.equal(reread(found).libraries["Mac Studio"], undefined);
    t.done();
  });
  it("keeps the library while any part pushed on this Mac has hand work kept nowhere else, and names that part", async () => {
    const left = setup();
    const { found: out, library: kept } = finished(left, { parts: { main: { v: 5, file: `final/${PROJECT.main}.mp4`, export: `final/${PROJECT.main}.fcpxmld` }, "reel 1": { v: 1, file: `final/${PROJECT["reel 1"]}.mov`, noHandEdits: true } } });
    assert.equal(await freeLibrary(left.ctx, out, { yes: true }), 1);
    assert.match(left.said(), /The hand work of Reel 2 is kept only in the library/);
    assert.ok(existsSync(kept));
    left.done();
    const later = setup();
    const { found, library } = finished(later);
    const pushedAgain = { ...found.record, main: { ...found.record.main, pushed: [...found.record.main.pushed, { v: 6, at: "2026-10-21T10:00:00-05:00", on: "Mac Studio", file: "edit/main.v6.mac-studio.fcpxml", project: "Pricing- what to charge- main v6 3fa9c1" }] } };
    assert.equal(await freeLibrary(later.ctx, { ...found, record: pushedAgain }, { yes: true }), 1);
    assert.match(later.said(), /The hand work of the main video is kept only in the library/);
    assert.ok(existsSync(library));
    later.done();
  });
  it("frees the library when a part not finished was pushed only on the other Mac, whose library this is not", async () => {
    const t = setup();
    const { found, library } = finished(t);
    const elsewhere = { ...found.record, reels: found.record.reels.map((r) => (r.n === 3 ? { ...r, status: "picked", pushed: [{ v: 1, at: "2026-10-21T10:00:00-05:00", on: "Sallie's laptop", file: "edit/reel-3.v1.sallies-laptop.fcpxml", project: "Pricing- what to charge- reel 3 v1 3fa9c1" }] } : r)) };
    assert.equal(await freeLibrary(t.ctx, { ...found, record: elsewhere }, { yes: true }), 0);
    assert.equal(existsSync(library), false);
    t.done();
  });
  it("refuses an episode not finished, a part whose edit is kept nowhere else, an export naming media outside the episode, and Final Cut running; and deletes nothing", async () => {
    const t = setup();
    const notYet = episodeFor(t, { record: EDITED });
    assert.equal(await freeLibrary(t.ctx, notYet, { yes: true }), 1);
    assert.match(t.said(), /It is not finished yet/);
    t.done();
    const cases = [
      [{ parts: { main: { v: 5, file: `final/${PROJECT.main}.mp4` } } }, /The hand work of the main video, Reel 1 and Reel 2 is kept only in the library: finish it with its export, or say it had no hand edits, first\./],
      [{ src: "/Users/sallie/Desktop/b-roll.mov" }, /The export of main uses media outside the episode folder \(\/Users\/sallie\/Desktop\/b-roll\.mov\)\. Copy it into media\/ first\./]
    ];
    for (const [given, words] of cases) {
      const c = setup();
      const { found, library } = finished(c, given);
      assert.equal(await freeLibrary(c.ctx, found, { yes: true }), 1);
      assert.match(c.said(), words);
      assert.ok(existsSync(library));
      c.done();
    }
    const open = setup();
    const { found, library } = finished(open);
    open.ctx.deps.running = async (app) => app === "Final Cut Pro";
    assert.equal(await freeLibrary(open.ctx, found, { yes: true }), 1);
    assert.match(open.said(), /Quit Final Cut Pro first\./);
    assert.ok(existsSync(library));
    open.done();
  });
  it("frees the library when a real export names a Final Cut template outside the episode, as phase 0's A7 does", async () => {
    const t = setup();
    const { found, library } = finished(t);
    // A7's export, as Final Cut 12.4 wrote it, with its video's path made the test episode's.
    const a7 = readFileSync(new URL("./fixtures/phase-0-a7-template.fcpxml", import.meta.url), "utf8");
    const video = `file://${encodeURI(join(found.folder, "Pricing talk.mp4"))}`;
    writeFileSync(join(found.folder, "final", `${PROJECT.main}.fcpxmld`, "Info.fcpxml"), a7.replace(/src="file:\/\/\/Users\/[^"]*Phase%20test\.mov"/, `src="${video}"`));
    assert.match(a7, /<effect [^>]*src="file:\/\/\/Users\/[^"]*Motion%20Templates\.localized/);
    assert.equal(await freeLibrary(t.ctx, found, { yes: true }), 0, t.said());
    assert.equal(existsSync(library), false);
    t.done();
  });
  it("never deletes anything outside this Mac's work folder for the episode", async () => {
    const t = setup();
    const { found } = finished(t);
    const outside = libraryFor(t.home, "../outside");
    mkdirSync(outside, { recursive: true });
    assert.equal(await freeLibrary(t.ctx, { ...found, name: "../outside" }, { yes: true }), 1);
    assert.match(t.said(), /Its library is not in this Mac's work folder for the episode, so it is left alone\./);
    assert.ok(existsSync(outside));
    t.done();
  });
});
