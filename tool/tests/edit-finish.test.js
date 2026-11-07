// finish, the quick part that looks and asks before anything starts, in what is not about which export it takes (edit-finish-app.test.js has
// that): what it stops at first (a name, a title, a file missing from the episode, the chain of the video's versions, a finish already
// running), what it refuses at once (a session, a video not yet answered), the command line, and status for a finish. Since Final Cut
// was retired a video is finished only from HyperFrames' exports, so these run in the made-up world of exports-world.js: a raw video with
// a project on disk for the main video and for Reel 2, and their exports in a Downloads folder in the test's own home. An episode from
// the Final Cut days is told it was never opened in HyperFrames (edit-finish-app.test.js, D1).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode, status } from "../edit.js";
import { episodeWork, writeSettings } from "../settings.js";
import { resultFile, readResult } from "../detached.js";
import { setup, episodeFor, episodeAs, reread, EDITED, NOT_YET, FOLDER, ID, NAME } from "./episodes.js";
import { exportOf, fw, world } from "./exports-world.js";

/** The made-up world with both exports in Downloads, on a Mac whose hand-off is in `version`. */
function exported({ version = 2, over = {} } = {}) {
  const w = fw({ handoffVersion: version, over });
  exportOf(w, "main");
  exportOf(w, "reel 2");
  return w;
}

describe("finish, the part that looks and asks", () => {
  it("refuses a placeholder name, a title not approved, a file missing from the episode, and a finish already running", async () => {
    const cases = [
      [2, { name: { text: "Pricing talk", placeholder: true } }, /Give the episode its name first: it is still called "Pricing talk", from the video's file name\./],
      [1, { title: null }, /Approve a title first\./]
    ];
    for (const [version, over, words] of cases) {
      const w = exported({ version, over });
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
      assert.match(w.t.said(), words);
      assert.deepEqual(w.t.started, []);
      w.t.done();
    }
    const missing = exported();
    const listed = Object.keys(missing.found.record.files).find((file) => !file.startsWith("final/"));
    rmSync(join(missing.found.folder, listed));
    assert.equal(await finishEpisode(missing.t.ctx, missing.found, { yes: true }), 1);
    assert.ok(missing.t.said().includes(listed), missing.t.said());
    assert.deepEqual(missing.t.started, []);
    missing.t.done();
    const busy = exported();
    mkdirSync(episodeWork(busy.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(busy.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    busy.t.ctx.alive = (pid) => pid === 4242;
    assert.equal(await finishEpisode(busy.t.ctx, busy.found, { yes: true }), 1);
    assert.match(busy.t.said(), /finish is running for this episode\. Say "how far is it\?"/);
    assert.deepEqual(busy.t.started, []);
    busy.t.done();
  });
  it("with hand-off version 1, still asks for an approved title", async () => {
    const w = exported({ version: 1, over: { title: null } });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /Approve a title first\./);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("looks in no folder of the Final Cut days: nothing is made there, and nothing it says names one", async () => {
    const w = exported();
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0, w.t.said());
    assert.doesNotMatch(w.t.said(), /Final Cut|Share|Looked in/);
    assert.equal(existsSync(join(w.t.home, "BRIMM Video Work", "From Final Cut")), false);
    w.t.done();
  });
});

describe("finish, the part that looks and asks, with hand-off version 2", () => {
  const PLACEHOLDER = { text: "Pricing talk", placeholder: true };
  it("starts a finish with no approved title: titles live on the BRIMM Ops page", async () => {
    for (const title of [null, { text: "Price it right", from: "claude", approved: false }]) {
      const w = exported({ over: { title } });
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
      assert.doesNotMatch(w.t.said(), /Approve a title/);
      assert.equal(w.t.started.length, 1);
      w.t.done();
    }
  });
  it("refuses a placeholder name for a raw video", async () => {
    const w = exported({ over: { name: PLACEHOLDER } });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /Give the episode its name first: it is still called "Pricing talk", from the video's file name\./);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  // An answered video that is not a session is named by its name, as edit.js names it (episode.js shownName), label or none.
  it("refuses a new version whose earlier version is not on this Mac, or names it back, by its name as edit.js names it, and writes nothing", async () => {
    const FIRST = "e-20261010-7c1d2e";
    const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
    const first = (t, record = {}) => episodeAs(t, { id: FIRST, name: "2026-10-10 Pricing talk, first cut (Mac Studio)", record: { kind: "raw", ...record } });
    const missing = new RegExp(`is a new version of a video that is not on this Mac yet \\(${FIRST}\\)\\. Wait for Dropbox to bring it over, then say it again\\. Nothing was written\\.`);
    const loop = new RegExp(`and the video it names as its earlier version \\(${FIRST}\\) each say they are a version of the other: ask Jason\\. Nothing was written\\.`);
    const cases = [[() => {}, { label: LABEL }, missing], [() => {}, {}, missing], [(t) => first(t, { versionOf: ID }), { label: LABEL }, loop]];
    for (const [before, more, words] of cases) {
      const w = exported({ over: { versionOf: FIRST, ...more } });
      before(w.t);
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1, String(words));
      assert.match(w.t.said(), words);
      assert.deepEqual(w.t.started, []);
      assert.equal(reread(w.found).rev, w.found.record.rev, "no claim was written");
      w.t.done();
    }
    // Once it is here, the finish starts.
    const w = exported({ over: { versionOf: FIRST, label: LABEL } });
    first(w.t);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal(w.t.started.length, 1);
    w.t.done();
  });
});

// A video already handed off as version 2 is handed off as version 2 again, whatever the setting says now (a rollback, or the two
// Macs not both switched yet): a version 1 hand-off written over it would move the BRIMM Ops page's id for the video. So the
// quick part asks for what version 2 needs, and refuses what version 2 refuses, by the hand-off on file.
describe("finish, the part that looks and asks, for a video already handed off as version 2, with the setting at 1", () => {
  const FIRST = "e-20261010-7c1d2e";
  const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
  const ON_FILE = "final/Pricing- what to charge-.brimm-ops.json";
  const FIXTURES = { 1: "handoff-v1", 2: "handoff-v2-finished" };
  /** The contract's hand-off of `version`, as the made-up episode's own: under its id, which it went to the page under. */
  const ownHandoff = (version) => {
    const handoff = JSON.parse(readFileSync(new URL(`./fixtures/${FIXTURES[version]}.json`, import.meta.url), "utf8"));
    for (const who of [handoff.episode, handoff.video]) if (who) who.id = ID;
    return JSON.stringify(handoff, null, 2) + "\n";
  };
  /** The made-up video finished before, its hand-off of `version` on file in final/ (none when `version` is not given), the setting at 1,
      and its exports in Downloads. */
  const handedOff = (version, more = {}, text = null) => {
    const finished = { revision: 1, at: "2026-10-20T13:30:00-05:00", on: "Mac Studio", handoff: ON_FILE, parts: {} };
    const w = exported({ version: 1, over: { title: null, finished, ...more } });
    if (version || text !== null) {
      mkdirSync(join(w.found.folder, "final"), { recursive: true });
      writeFileSync(join(w.found.folder, ON_FILE), text !== null ? text : ownHandoff(version));
    }
    return w;
  };
  it("asks for no approved title, since the hand-off it will write is version 2", async () => {
    const w = handedOff(2);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.doesNotMatch(w.t.said(), /Approve a title/);
    assert.equal(w.t.started.length, 1);
    w.t.done();
  });
  it("refuses a new version whose earlier version is not on this Mac, by its name as edit.js names it, as version 2 does", async () => {
    const w = handedOff(2, { versionOf: FIRST, label: LABEL });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), new RegExp(`is a new version of a video that is not on this Mac yet \\(${FIRST}\\)\\. Wait for Dropbox to bring it over, then say it again\\. Nothing was written\\.`));
    assert.deepEqual(w.t.started, []);
    assert.equal(reread(w.found).rev, w.found.record.rev, "no claim was written");
    w.t.done();
  });
  it("still asks for an approved title when the hand-off on file is version 1, is not there, or cannot be read", async () => {
    for (const [version, text] of [[1, null], [null, null], [null, "{ not a hand-off"]]) {
      const w = handedOff(version, {}, text);
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1, `${version} ${text}`);
      assert.match(w.t.said(), /Approve a title first\./);
      assert.deepEqual(w.t.started, []);
      w.t.done();
    }
  });
});

// Version 1 is under the episode's own id, so it never asks whether the chain of the video's versions can be followed: with the
// setting at 1 or none, an answered new version whose earlier version is not on this Mac finishes as it always has.
describe("finish, the part that looks and asks, with hand-off version 1", () => {
  it("does not look for the earlier version of a new version, with the setting at 1 or with none", async () => {
    for (const version of [undefined, 1]) {
      const w = exported({ version: 1, over: { title: { text: "Price it right", from: "person", approved: true }, versionOf: "e-20261010-7c1d2e", label: "Video of 14 Oct, 09:12 (Mac Studio)" } });
      w.t.ctx.settings = { ...w.t.ctx.settings, handoffVersion: version };
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, `setting ${version}: ${w.t.said()}`);
      assert.doesNotMatch(w.t.said(), /not on this Mac yet|each say they are a version of the other/);
      assert.equal(w.t.started.length, 1);
      w.t.done();
    }
  });
});

// A client or group session's own finish comes with its teachings, and a video not yet answered has no kind to finish as. Until
// then a finish would copy a session's main video and its transcripts into final/, in Dropbox, which no session's
// transcript may ever be in (spec 2026-10-22, section 2). So it refuses them at once, in either version of the hand-off, before it
// looks in any folder: no part line, no "Looked in" line and no file name is printed, and no claim is written.
describe("finish, the part that looks and asks, for a session and for a video not yet answered", () => {
  it("refuses it at once, as edit.js names it (a session by its session label, a video not answered by its label or else its short id), and prints no file name, no part line and no folder it looked in", async () => {
    for (const version of [undefined, 1, 2]) {
      for (const [what, kind, words, named] of NOT_YET) {
        for (const label of ["Video of 14 Oct, 09:12 (Mac Studio)", undefined]) {
          const who = named(label);
          const t = setup();
          if (version) {
            writeSettings(t.home, { handoffVersion: version });
            t.ctx.settings = { ...t.ctx.settings, handoffVersion: version };
          }
          const found = episodeFor(t, { record: { ...EDITED, ...kind, ...(label ? { label } : {}) } });
          const how = `${what}, setting ${version}, ${label ? "labelled" : "no label"}`;
          assert.equal(await finishEpisode(t.ctx, found, { yes: true }), 1, how);
          assert.deepEqual(t.said().split("\n"), [words(who)], how);
          assert.doesNotMatch(t.said(), /Pricing|\.mp4|\.mov|Looked in/, how);
          assert.deepEqual(t.started, [], how);
          assert.equal(reread(found).rev, found.record.rev, `${how}: no claim was written`);
          assert.equal(existsSync(join(episodeWork(t.home, FOLDER), "finish.asked.json")), false, how);
          t.done();
        }
      }
    }
  });
});

describe("finish, from the command line", () => {
  it("reads its answers from the words it is run with, starts the detached part, and that part ends with a result", async () => {
    const w = exported();
    assert.equal(await editMain(["finish", "Pricing", "--yes"], w.t.ctx.deps), 0, w.t.said());
    assert.deepEqual(w.t.started[0][1].slice(-3), ["finish", "--now", FOLDER]);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0);
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.equal(result.ok, true, result.failed.join(" "));
    assert.ok(result.made.includes("final/Pricing- what to charge-.brimm-ops.json"));
    w.t.done();
  });
  it("does not take --no-hand-edits any more: an answer about Final Cut's hand edits is not a flag it knows", async () => {
    const w = exported();
    const said = [];
    const code = await editMain(["finish", FOLDER, "--no-hand-edits", "main"], { ...w.t.ctx.deps, say: (line) => said.push(line) });
    assert.equal(w.t.started.length, 0);
    assert.notEqual(code, 0, said.join("\n"));
    w.t.done();
  });
});

describe("status, for a finish", () => {
  it("shows a finish that ended: what it made, what failed, and what it offers", async () => {
    const t = setup();
    episodeFor(t, { record: EDITED });
    const file = resultFile(t.home, FOLDER, "finish");
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, command: "finish", started: Date.parse("2026-10-20T15:00:00-05:00"), ended: Date.parse("2026-10-20T15:25:00-05:00"), ok: true, made: ["final/Pricing- what to charge-.brimm-ops.json"], failed: [], next: "To save space on this Mac, make the episode's folder online-only: in Finder, Control-click it and choose Make online-only." }));
    await status(t.ctx, ["what", "to", "charge"]);
    assert.match(t.said(), /final\/Pricing- what to charge-\.brimm-ops\.json/);
    assert.match(t.said(), /Make online-only/);
    t.done();
  });
});

describe("free library, no command any more", () => {
  it("says the help and ends with 2 from the command line, and deletes nothing", async () => {
    const w = exported();
    mkdirSync(join(w.t.home, "BRIMM Video Work", FOLDER, `${FOLDER}.fcpbundle`, "Render Files"), { recursive: true });
    const said = [];
    assert.equal(await editMain(["free", FOLDER, "library", "--yes"], { ...w.t.ctx.deps, say: (line) => said.push(line) }), 2);
    assert.equal(said.length, 1);
    assert.match(said[0], /^The command line for episodes on this Mac\./);
    assert.ok(existsSync(join(w.t.home, "BRIMM Video Work", FOLDER, `${FOLDER}.fcpbundle`, "Render Files")));
    w.t.done();
  });
});
