// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { HELP, SHOWN_MARKER, editMain } from "../edit.js";
import { recordText } from "../episode.js";
import { handoffTarget } from "../finish.js";
import { episodeWork, workFolder, writeSettings } from "../settings.js";
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

/** The made-up video, finished and handed off as version 2 in final/ (revision 1), with `over` on its record: as a Final Cut
    finish or a spellings card leaves one. Returns `found`. */
function handedOff(t, { over = {}, files = {} } = {}) {
  writeSettings(t.home, { handoffVersion: 2 });
  const handoff = JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID, kind: "finished" } });
  return episodeFor(t, {
    record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} }, ...over },
    files: { "Pricing talk.mp4": "v", "Pricing talk.cut-plan.json": "{}", "final/Pricing talk.brimm-ops.json": handoff, "final/Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n", ...files }
  });
}
/** The session label `kind … session` gives the made-up video. */
const SESSION_NAME = "Session, 2026-10-14";
const GONE = "Its words have already gone to Claude: drop the new revision on the BRIMM Ops page and tell Jason.";

describe("the empty session revision says its words went to Claude only when a reading of it ran (item 12)", () => {
  it("does not say so of a video no reading ran on", async () => {
    const t = setup();
    handedOff(t);
    const r = await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`The empty session revision of ${SESSION_NAME} is written as revision 2 and shown in Finder: drop it on the BRIMM Ops page.`), r.text);
    assert.doesNotMatch(r.text, /gone to Claude/);
    t.done();
  });
  it("says so when the record holds a reading, or the files of one are set aside", async () => {
    const READING = { kind: "finished", model: "claude-x", at: AT, on: "Mac Studio", account: "", outcome: "read" };
    for (const [what, made] of [["a reading in the record", { over: { reading: READING } }], ["Claude's notes from before the switch", { files: { "Pricing talk.edit-notes.txt": "notes" } }], ["Reel suggestions", { files: { "reels.json": "{}" } }]]) {
      const t = setup();
      handedOff(t, made);
      const r = await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
      assert.equal(r.code, 0, `${what}: ${r.text}`);
      assert.ok(r.said.includes(`The empty session revision of ${SESSION_NAME} is written as revision 2 and shown in Finder. ${GONE}`), `${what}: ${r.text}`);
      t.done();
    }
  });
});

/** `behind` on the made-up Mac, with git finding it up to date. */
const behind = (t) => on({ ...t.ctx.deps, run: async () => ({ code: 0, stderr: "", stdout: "0\n" }) }, "behind");
/** Every file and folder under `dir`, by its path from it, sorted. */
const treeOf = (dir) => readdirSync(dir, { recursive: true }).map(String).sort();

describe("behind takes away only what show and which put in shown/, by their marker (item 16)", () => {
  it("leaves a shown/ with no marker, every file the marker does not list, and every other folder and file, as they are", async () => {
    const t = setup();
    const work = workFolder(t.home);
    const marked = join(work, FOLDER, "shown");
    mkdirSync(join(marked, "sub"), { recursive: true });
    for (const name of ["a copy.txt", "hers.txt", "sub/c.txt"]) writeFileSync(join(marked, name), "words");
    writeFileSync(join(marked, SHOWN_MARKER), JSON.stringify({ files: ["a copy.txt", "sub", "../kept.txt", "sub/c.txt", SHOWN_MARKER] }));
    const unmarked = join(work, "2026-10-15 Another (Mac Studio)", "shown");
    mkdirSync(unmarked, { recursive: true });
    writeFileSync(join(unmarked, "x.txt"), "words");
    writeFileSync(join(work, FOLDER, "kept.txt"), "stays");
    mkdirSync(join(work, "2026-10-16 Third (Mac Studio)", "renders"), { recursive: true });
    writeFileSync(join(work, "2026-10-16 Third (Mac Studio)", "renders", "v0.mp4"), "a render");
    const r = await behind(t);
    assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."]);
    assert.ok(!existsSync(join(marked, "a copy.txt")));
    assert.deepEqual(treeOf(marked).filter((n) => n !== SHOWN_MARKER), ["hers.txt", "sub", "sub/c.txt"]);
    assert.deepEqual(treeOf(unmarked), ["x.txt"]);
    assert.equal(readFileSync(join(work, FOLDER, "kept.txt"), "utf8"), "stays");
    assert.ok(existsSync(join(work, "2026-10-16 Third (Mac Studio)", "renders", "v0.mp4")));
    t.done();
  });
  it("takes away the copies show made, and their folder once it is empty", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: null, label: LABEL, answer: { state: "needs your answer", guess: "raw", seen: "", came: "camera", match: null } } });
    writeFileSync(join(found.folder, "Pricing talk.transcript.txt"), "[0:00] Jane Doe's words");
    const shown = join(episodeWork(t.home, FOLDER), "shown");
    assert.equal((await on(t.ctx.deps, "show", LABEL, "transcript")).code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(shown, SHOWN_MARKER), "utf8")).files, [`${LABEL.replace(/:/g, "-")} transcript.txt`]);
    assert.equal((await behind(t)).code, 0);
    assert.ok(!existsSync(shown));
    t.done();
  });
});

describe("which opens a clone named by the video's label, never its file (item 13)", () => {
  /** A video waiting for its answer, as the light import files one. */
  const waiting = (t) => episodeFor(t, { record: { version: 3, kind: null, label: LABEL, answer: { state: "needs your answer", guess: "raw", seen: "", came: "camera", match: null } }, files: LIGHT });
  const CLONE = `${LABEL.replace(/:/g, "-")}.mp4`;
  it("clones the video into BRIMM Video Work's shown/, named by its label, lists it by the marker, and opens the clone: behind takes it away", async () => {
    const t = setup();
    const found = waiting(t);
    const shown = join(episodeWork(t.home, FOLDER), "shown");
    const cloned = [];
    const deps = { ...t.ctx.deps, cloneFile: (from, to) => { cloned.push([from, to]); writeFileSync(to, readFileSync(from)); } };
    const r = await on(deps, "which", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`Opened ${LABEL} in QuickTime Player on this Mac.`]]);
    assert.deepEqual(cloned, [[join(found.folder, "Pricing talk.mp4"), join(shown, CLONE)]]);
    assert.deepEqual(t.opened, [["QuickTime Player", join(shown, CLONE)]]);
    assert.deepEqual(JSON.parse(readFileSync(join(shown, SHOWN_MARKER), "utf8")).files, [CLONE]);
    // Said again, the clone is made again in its place; a copy show made beside it stays.
    writeFileSync(join(shown, "kept transcript.txt"), "words");
    writeFileSync(join(shown, SHOWN_MARKER), JSON.stringify({ files: [CLONE, "kept transcript.txt"] }));
    assert.equal((await on(deps, "which", LABEL)).code, 0);
    assert.deepEqual(t.opened[1], ["QuickTime Player", join(shown, CLONE)]);
    assert.deepEqual(treeOf(shown).sort(), [SHOWN_MARKER, CLONE, "kept transcript.txt"].sort());
    assert.equal((await behind(t)).code, 0);
    assert.ok(!existsSync(shown));
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("opens the video itself when the clone cannot be made, or the video is not here to clone, and says its title bar shows its file's name", async () => {
    const TITLE = "Its copy could not be made, so it opened under its file's name, which QuickTime Player's title bar shows: share no screen while it is open.";
    const ONLINE = "It is online-only on this Mac: Dropbox brings it over first, which may take a few minutes for a long video.";
    for (const [what, deps, said] of [
      ["no clone on this disk", { cloneFile: () => { throw Object.assign(new Error("ENOTSUP: operation not supported"), { code: "ENOTSUP" }); } }, `Opened ${LABEL} in QuickTime Player on this Mac. ${TITLE}`],
      ["not whole here", { isWhole: () => false, cloneFile: () => assert.fail("a video not here is never cloned: that would bring it all over first") }, `Opened ${LABEL} in QuickTime Player on this Mac. ${TITLE} ${ONLINE}`]
    ]) {
      const t = setup();
      const found = waiting(t);
      const r = await on({ ...t.ctx.deps, ...deps }, "which", LABEL);
      assert.deepEqual([r.code, r.said], [0, [said]], what);
      assert.deepEqual(t.opened, [["QuickTime Player", join(found.folder, "Pricing talk.mp4")]], what);
      const shown = join(episodeWork(t.home, FOLDER), "shown");
      assert.ok(!existsSync(join(shown, CLONE)), what);
      t.done();
    }
  });
});

describe("a Zoom download renamed with a client's words is named by its Zoom time alone (item 19)", () => {
  const RENAMED = "GMT20261020-150000_Recording_Jane Doe coaching.mp4";
  const HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";
  /** The made-up Mac, its drop folder holding the renamed download, and the hold the light import writes of it. */
  function held(settings) {
    const t = setup();
    writeSettings(t.home, settings);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, RENAMED), "zoom");
    mkdirSync(join(t.root, "Episodes", ".importing"), { recursive: true });
    writeFileSync(join(t.root, "Episodes", ".importing", `${RENAMED} (Mac Studio) 1.json`), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 1, video: RENAMED, bytes: 4, seconds: null, step: "Held", at: AT, held: HELD, label: "GMT20261020-150000_Recording" }));
    return t;
  }
  it("in episodes and retry, on the Mac that does the light import and on one that does not", async () => {
    for (const settings of [{ import: "light" }, {}]) {
      const t = held(settings);
      const episodes = await on(t.ctx.deps, "episodes");
      assert.ok(episodes.said.some((line) => line.startsWith("  GMT20261020-150000_Recording, in the Mac Studio's drop folder, for ") && line.endsWith(`: ${HELD}`)), `${JSON.stringify(settings)}\n${episodes.text}`);
      for (const said of [RENAMED, "GMT20261020-150000_Recording"]) {
        const retry = await on(t.ctx.deps, "retry", said);
        assert.deepEqual([retry.code, retry.said], [1, [`GMT20261020-150000_Recording is held: ${HELD}`]], `${JSON.stringify(settings)} ${said}`);
      }
      for (const text of [episodes.text]) assert.doesNotMatch(text, SECRET);
      t.done();
    }
  });
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
