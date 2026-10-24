// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { mkdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { HELP, editMain } from "../edit.js";
import { recordText } from "../episode.js";
import { handoffTarget } from "../finish.js";
import { writeSettings } from "../settings.js";
import { askBlocked } from "../unedited.js";
import { setup, episodeFor, episodeAs, reread, FOLDER, ID } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** Have the fs function `name` refuse, as a disk that will not let it, every path under `under` that `only` takes, while `work` runs:
    an error nobody foresaw, whose message names the path. */
async function refusing(name, under, work, only = () => true) {
  const real = fs[name];
  fs[name] = (path, ...rest) => {
    if (String(path).startsWith(under) && only(String(path))) throw Object.assign(new Error(`EACCES: permission denied, ${name.replace(/Sync$/, "")} '${path}'`), { code: "EACCES", errno: -13, path: String(path) });
    return real(path, ...rest);
  };
  syncBuiltinESMExports();
  try {
    return await work();
  } finally {
    fs[name] = real;
    syncBuiltinESMExports();
  }
}

/** A video in this Mac's drop folder, named for a client. */
const CLIENT_VIDEO = "Coaching call Jane Doe.mov";
/** What must never be in a line: the client's name. */
const SECRET = /jane|coaching/i;

describe("an error nobody foresaw, on a Mac that does the light import (item 8)", () => {
  it("says only the work stopped, with its code, for a command that names no episode, as retry", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, CLIENT_VIDEO), "video");
    const r = await refusing("statSync", drop, () => on(t.ctx.deps, "retry", CLIENT_VIDEO));
    assert.deepEqual([r.code, r.said], [1, ["The work stopped (EACCES)."]]);
    assert.doesNotMatch(r.text.replace(CLIENT_VIDEO, ""), SECRET);
    t.done();
  });
  it("is thrown as today with the light import off", async () => {
    const t = setup();
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, CLIENT_VIDEO), "video");
    await refusing("statSync", drop, () => assert.rejects(on(t.ctx.deps, "retry", CLIENT_VIDEO), (err) => err.code === "EACCES" && err.message.includes(CLIENT_VIDEO)));
    t.done();
  });
});

/** The clock of episodes.js's setup, as the record keeps a moment. */
const AT = "2026-10-20T15:00:00-05:00";
/** Her answer, as `kind` records it for a video that is not a session. */
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
/** The label a light import gives the made-up video. */
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
/** A light import's files of the made-up video: the video and its plan, and no timeline of its own (edit/main.v0.fcpxml). */
const LIGHT = { "Pricing talk.mp4": "the video", "Pricing talk.cut-plan.json": "{}", "Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n", "Pricing talk.transcript.txt": "[0:00] Hello" };

describe("push of a video that has no timeline in Final Cut, and an error nobody foresaw for a record of the switch (item 20)", () => {
  it("refuses a finished video, and an iPhone clip she answered, in plain words, before any timeline is read", async () => {
    for (const [kind, what] of [["finished", "a finished video"], ["short video", "an iPhone clip"]]) {
      const t = setup();
      episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: LABEL }, files: LIGHT });
      for (const argv of [["push", "Pricing talk"], ["push", "Pricing talk", "main", "--no-hand-edits"]]) {
        const r = await on(t.ctx.deps, ...argv);
        assert.deepEqual([r.code, r.said], [1, [`Pricing talk has no timeline to show in Final Cut: ${what} is not edited here.`]], `${kind}: ${argv.join(" ")}`);
      }
      assert.deepEqual(t.opened, []);
      t.done();
    }
  });
  it("says only that the work stopped for a record of the switch, on a Mac whose import is not the light one: no path, no stack", async () => {
    // A raw video she answered, whose timeline Dropbox never brought: reading it fails in a way nobody foresaw.
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "raw", answer: ANSWERED, label: LABEL }, files: LIGHT });
    const r = await on(t.ctx.deps, "push", "Pricing talk");
    assert.deepEqual([r.code, r.said], [1, ["The work stopped (ENOENT)."]]);
    assert.equal(reread({ folder: join(t.root, "Episodes", FOLDER) }).rev, 1);
    t.done();
  });
});

/** A session mark, as `kind … session` writes it, with `cleared` as given. */
const markOf = (cleared) => ({ marked: AT, on: "Mac Studio", teachings: null, cleared });
/** A mark cleared by her click on the dialog: the one clearing the gate takes. */
const CLICKED = { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" };
/** Marks that are not cleared by her click, though each says something under `cleared`. */
const NOT_CLICKED = [true, "no", 1, {}, { at: AT, on: "Mac Studio", to: "finished" }, { ...CLICKED, confirmed: "typed" }];

describe("one rule for a session not cleared: the gate's (item 9)", () => {
  it("has askBlocked refuse a video whose mark says cleared in any way but her click", () => {
    const record = { kind: "finished", answer: ANSWERED, label: LABEL, video: { file: "Pricing talk.mp4" } };
    const asked = (session) => askBlocked({ folder: "/none", record: { ...record, session }, root: "/none", home: "/none", machine: "Mac Studio" });
    for (const cleared of NOT_CLICKED) assert.deepEqual(asked(markOf(cleared)), { why: "This is a client or group session: Claude reads it only for its teachings." }, JSON.stringify(cleared));
    assert.notDeepEqual(asked(markOf(CLICKED)), { why: "This is a client or group session: Claude reads it only for its teachings." });
  });
  it("has handoffTarget refuse a video one of whose versions has a conflicted copy marking it a session not cleared by her click", () => {
    for (const cleared of [...NOT_CLICKED, CLICKED]) {
      const t = setup();
      const first = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL } });
      const later = episodeAs(t, { id: "e-20261022-b2b2b2", name: "2026-10-22 Talk (Mac Studio)", record: { kind: "finished", answer: ANSWERED, label: "Video of 22 Oct, 09:12 (Mac Studio)", versionOf: ID } });
      // The copy is never checked as a record is: Dropbox wrote it.
      writeFileSync(join(later.folder, "record/0001 (Sallie's laptop's conflicted copy 2026-10-22).json"), recordText({ ...later.record, session: markOf(cleared) }));
      const target = handoffTarget({ root: t.root, settings: { handoffVersion: 2 } }, { folder: first.folder, record: first.record });
      if (cleared === CLICKED) assert.equal(target.refusal, "", "a mark cleared by her click");
      else assert.equal(target.refusal, "Pricing talk is a version of a client or group session: ask Jason. Nothing was written.", JSON.stringify(cleared));
      t.done();
    }
  });
});

describe("the Final Cut finish of a kind a version 1 hand-off cannot hold (item 4)", () => {
  it("refuses a finished video at once on a Mac that hands off version 1, before any part is looked for or anything is run", async () => {
    for (const settings of [{ handoffVersion: 1 }, {}]) {
      const t = setup();
      writeSettings(t.home, settings);
      const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL }, files: LIGHT });
      // A Share of its main video waits in From Final Cut, which a finish would take.
      t.shared("Pricing- what to charge- main v5 3fa9c1.mov");
      for (const argv of [["finish", "Pricing talk"], ["finish", "Pricing talk", "--yes"]]) {
        const r = await on(t.ctx.deps, ...argv);
        assert.deepEqual([r.code, r.said], [1, ["Pricing talk's hand-off is written from its spellings once this Mac hands off version 2: ask Jason."]], `${JSON.stringify(settings)} ${argv.join(" ")}`);
      }
      assert.deepEqual([t.calls, t.started, reread(found).rev], [[], [], 1]);
      t.done();
    }
  });
});

describe("finish of a video that is not edited in Final Cut (item 5)", () => {
  const FINISHED = { revision: 2, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} };
  for (const [kind, what] of [["finished", "a finished video"], ["short video", "an iPhone clip she answered"]]) {
    it(`says of ${what} that its hand-off comes from its spellings, or is written already, or waits for version 2, and names no folder`, async () => {
      for (const [settings, over, said] of [
        [{ handoffVersion: 2 }, {}, 'Pricing talk is not edited in Final Cut: its hand-off is written once its spellings are answered. Say "show me the spellings".'],
        [{ handoffVersion: 2 }, { finished: FINISHED }, "Pricing talk's hand-off is written already, as revision 2: a spelling changed writes its next revision."],
        [{ handoffVersion: 1 }, {}, "Pricing talk's hand-off is written from its spellings once this Mac hands off version 2: ask Jason."]
      ]) {
        const t = setup();
        writeSettings(t.home, settings);
        const found = episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: LABEL, ...over }, files: LIGHT });
        for (const argv of [["finish", "Pricing talk"], ["finish", "Pricing talk", "--yes"]]) {
          const r = await on(t.ctx.deps, ...argv);
          assert.deepEqual([r.code, r.said], [1, [said]], `${kind} ${JSON.stringify(settings)} ${JSON.stringify(over)} ${argv.join(" ")}`);
          assert.ok(!r.text.includes(t.dir), r.text);
        }
        assert.deepEqual([t.calls, t.started, reread(found).rev], [[], [], 1]);
        t.done();
      }
    });
  }
});

describe("a command's name is one of edit.js's own (item 21)", () => {
  it("prints the help and ends with 2 for a name every object has, as for any word that is no command", async () => {
    const t = setup();
    for (const word of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
      const r = await on(t.ctx.deps, word, "Pricing talk");
      assert.deepEqual([r.code, r.text], [2, HELP], word);
    }
    t.done();
  });
});
