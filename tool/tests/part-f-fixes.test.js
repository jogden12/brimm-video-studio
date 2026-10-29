// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { COMMAND_NAMES, HELP, SHOWN_MARKER, editMain } from "../edit.js";
import { readEpisode, recordFile, recordText } from "../episode.js";
import { handoffTarget } from "../finish.js";
import { episodeWork, workFolder, writeSettings } from "../settings.js";
import { askBlocked } from "../unedited.js";
import { HELD as HELD_WORDS, UNANSWERED, UNSCOPED, heldGateFor } from "../gate.js";
import { setup, episodeFor, episodeAs, reread, listAll, FOLDER, ID } from "./episodes.js";

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
        // An iPhone clip is edited in HyperFrames if at all, so it is not said to be "not edited in Final Cut" (plan PR 7, item 4).
        [{ handoffVersion: 2 }, {}, kind === "short video" ? 'Pricing talk\'s hand-off is written once its spellings are answered. Say "show me the spellings".' : 'Pricing talk is not edited in Final Cut: its hand-off is written once its spellings are answered. Say "show me the spellings".'],
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

describe("a raw reading on a Mac the video is not on yet (item 6)", () => {
  const NOT_HERE = 'Video of 14 Oct, 09:12 (Mac Studio) is a raw video of 2.0 GB that is not on this Mac yet: reading it here brings it all over first, which may take a while. Say "read it here" to go on, or leave it for the Mac Studio.';
  /** The made-up video, imported on the Mac Studio, as her laptop sees it: online-only, its video not whole there. */
  function online(t, record, settings = {}) {
    const found = episodeFor(t, { record: { version: 3, label: LABEL, video: { file: "Pricing talk.mp4", bytes: 2 * 1024 ** 3, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "video" }, ...record }, files: LIGHT });
    const deps = { ...t.ctx.deps, settings: { ...t.ctx.settings, machine: "Sallie's laptop", ...settings }, isWhole: (path) => !path.endsWith("Pricing talk.mp4") };
    return { found, deps };
  }
  const WAITING = { kind: null, answer: { state: "needs your answer", guess: "raw", seen: "", came: "camera", match: null } };
  it("refuses without --here, writing nothing and claiming nothing, so that the other Mac may answer it", async () => {
    for (const [what, record, argv] of [["a first answer", WAITING, [LABEL, "raw", "--private", "no"]], ["an answer again", { kind: "finished", answer: ANSWERED, editing: null }, [LABEL, "raw", "--private", "no", "--again"]]]) {
      const t = setup();
      const { found, deps } = online(t, record);
      const r = await on(deps, "kind", ...argv);
      assert.deepEqual([r.code, r.said], [1, [NOT_HERE.replace("Video of 14 Oct, 09:12 (Mac Studio)", record.kind ? "Pricing talk" : LABEL)]], what);
      assert.deepEqual([reread(found).rev, t.started, t.waits], [1, [], []], what);
      t.done();
    }
  });
  it("answers and reads it here with --here, as before", async () => {
    const t = setup();
    const { found, deps } = online(t, WAITING);
    const r = await on(deps, "kind", LABEL, "raw", "--private", "no", "--here");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "raw");
    assert.deepEqual(t.started.map(([, args]) => args.slice(1, 3)), [["read", "--now"]]);
    t.done();
  });
  it("asks nothing of a raw video whole on this Mac, of another kind, or on a Mac whose readings are off", async () => {
    for (const [what, kind, more] of [["finished", "finished", {}], ["clip", "clip", {}], ["readings off", "raw", { readings: false }]]) {
      const t = setup();
      const { found, deps } = online(t, WAITING, more);
      const r = await on(deps, "kind", LABEL, kind, "--private", "no");
      assert.ok(!r.said.includes(NOT_HERE), `${what}: ${r.text}`);
      assert.notEqual(reread(found).kind, null, what);
      t.done();
    }
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, label: LABEL, ...WAITING }, files: LIGHT });
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "raw");
    t.done();
  });
});

describe("resolve never clears a session mark, nor takes back an answer, by keeping the other side (item 14)", () => {
  const SESSION = { kind: "session", answer: { ...ANSWERED, private: "yes" }, name: { text: SESSION_NAME, placeholder: false }, session: markOf(null), editing: null };
  // The other Mac's take-over, written on the claim before the mark: no mark, and the name it had.
  const FINISHED = { kind: "finished", answer: ANSWERED, session: undefined, name: { text: "Pricing talk", placeholder: true }, editing: { by: "Sallie's laptop", since: AT } };
  const WAITING = { kind: null, answer: { state: "needs your answer", guess: "raw", seen: "", came: "camera", match: null } };
  /** The made-up video with `inForce` on its record, and Dropbox's conflicted copy of that record holding `copy`. */
  function conflicted(t, inForce, copy) {
    const found = episodeFor(t, { record: { version: 3, label: LABEL, ...inForce }, files: LIGHT });
    const rel = "record/0001 (Sallie's laptop's conflicted copy 2026-10-20).json";
    writeFileSync(join(found.folder, rel), recordText({ ...found.record, ...copy }));
    return { found, rel };
  }
  const MARKS = `One side marks ${SESSION_NAME} a client or group session: keep that side; the mark is cleared only by her click (say "clear the session mark").`;
  const ANSWERS = (who) => `One side has ${who} answered: keep that side; an answer is changed only by saying what it is again.`;
  for (const [what, inForce, copy, keep, said, words] of [
    ["the session in force, the copy a take-over of its claim", SESSION, FINISHED, "B", MARKS, SESSION_NAME],
    ["the copy the session, the record in force another kind", FINISHED, SESSION, "A", MARKS, SESSION_NAME],
    ["the copy answered, the record in force waiting for its answer", WAITING, FINISHED, "A", ANSWERS(LABEL), LABEL]
  ]) {
    it(`refuses, with the record, history/ and the copy as they were: ${what}`, async () => {
      const t = setup();
      const { found, rel } = conflicted(t, inForce, copy);
      const shown = await on(t.ctx.deps, "resolve", words);
      assert.equal(shown.code, 0, shown.text);
      const before = readFileSync(join(found.folder, rel), "utf8");
      const r = await on(t.ctx.deps, "resolve", words, "--keep", keep);
      assert.deepEqual([r.code, r.said], [1, [said]]);
      assert.deepEqual([readdirSync(join(found.folder, "record")).sort(), existsSync(join(found.folder, "history")), readFileSync(join(found.folder, rel), "utf8")], [["0001 (Sallie's laptop's conflicted copy 2026-10-20).json", "0001.json"], false, before]);
      assert.doesNotMatch(r.text, /Pricing/);
      // The other side is kept as before.
      const other = await on(t.ctx.deps, "resolve", words, "--keep", keep === "A" ? "B" : "A");
      assert.equal(other.code, 0, other.text);
      t.done();
    });
  }
  it("shows what each side is, and whether it is marked, in words that name nothing", async () => {
    const t = setup();
    conflicted(t, FINISHED, SESSION);
    const r = await on(t.ctx.deps, "resolve", SESSION_NAME);
    assert.ok(r.said.includes("  What it is: A: finished by your editor; B: a client or group session"), r.text);
    assert.ok(r.said.includes("  Its session mark: A: none; B: marked, not cleared"), r.text);
    assert.doesNotMatch(r.text, /Pricing/);
    t.done();
  });
});

// --- Items 1 and 15: a session mark follows a video's other versions, held as sessions (fail closed) ---

const OLD = "e-20261010-a0a0a0";
const OLD_FOLDER = "2026-10-10 Coaching Jane Doe (Mac Studio)";
const HELD = "This video is a version of a client or group session: answer it as a session too, or ask Jason.";
const STILL_HELD = "Another version of it is still marked a client or group session, so it is held as one, and Claude reads nothing of it: once that mark is cleared too, say what it is again.";
/** Put `text` at `rel` in `folder`. */
const lay = (folder, rel, text) => {
  mkdirSync(dirname(join(folder, rel)), { recursive: true });
  writeFileSync(join(folder, rel), text);
};
/** A version 2 hand-off of the video whose first id is `id`, at `revision`. */
const handoff2 = (id, revision) => JSON.stringify({ format: "brimm-video hand-off", version: 2, revision, video: { id } });
/** The older video A, finished and handed off as version 2 (revision 1) under its own id, its final/ holding its transcripts, named
    for a client; and its later version B (the made-up episode), finished and handed off under A's id (revision 2). `aOver` and
    `bOver` are laid on their records. */
function twoVersions(t, { aOver = {}, bOver = {} } = {}) {
  writeSettings(t.home, { handoffVersion: 2 });
  const older = episodeAs(t, { id: OLD, name: OLD_FOLDER, record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Coaching Jane Doe", placeholder: false }, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Coaching Jane Doe.brimm-ops.json", parts: {} }, ...aOver } });
  lay(older.folder, "final/Coaching Jane Doe.brimm-ops.json", handoff2(OLD, 1));
  lay(older.folder, "final/Talk.srt", "1\n00:00:00,000 --> 00:00:02,000\nJane Doe told me her prices\n");
  lay(older.folder, "final/Talk.transcript.txt", "[0:00] Jane Doe told me her prices\n");
  lay(older.folder, "Talk.transcript.txt", "[0:00] Jane Doe told me her prices\n");
  const newer = episodeFor(t, {
    record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, versionOf: OLD, editing: null, name: { text: "Pricing talk", placeholder: true }, finished: { revision: 2, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} }, ...bOver },
    files: { "Pricing talk.mp4": "v", "Pricing talk.cut-plan.json": "{}", "final/Pricing talk.brimm-ops.json": handoff2(OLD, 2), "final/Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nJane Doe told me her prices\n", "final/Pricing talk.transcript.txt": "[0:00] Jane Doe told me her prices" }
  });
  return { older, newer };
}
/** What final/ of `found` holds. */
const finalOf = (found) => listAll(join(found.folder, "final"));
/** A line said of A, held: by its short id, as it has no label. */
const A = "a video (a0a0a0)";

describe("a session mark follows the video's other versions: each is held as a session until answered as one (items 1, 15)", () => {
  it("lets run for a video held as a session only what runs for a video not yet answered, and the commands that name none", () => {
    assert.equal(HELD_WORDS, HELD);
    for (const name of COMMAND_NAMES) assert.equal(heldGateFor(name), [...UNSCOPED, ...UNANSWERED].includes(name) ? "" : HELD, name);
    assert.deepEqual(COMMAND_NAMES.filter((name) => !heldGateFor(name)).sort(), ["behind", "episodes", "guide", "kind", "leave", "release", "resolve", "retry", "show", "status", "which"]);
  });
  it("B marked while A is handed off: names A to answer too, writes nothing into A's folder, and holds A as a session", async () => {
    const t = setup();
    const { older, newer } = twoVersions(t);
    const aFinal = finalOf(older);
    const r = await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`${SESSION_NAME} has another version, held as a client or group session until it is answered as one: answer ${A} as a session too.`), r.text);
    assert.deepEqual(finalOf(newer), [`${SESSION_NAME}.brimm-ops.json`]);
    // Spec 1: nothing is written into another version's folder.
    assert.deepEqual([finalOf(older), reread(older).rev], [aFinal, 1]);
    // A is held: found by its short id and named so, never by its folder or its name; nothing of its words reaches the chat.
    const words = await on(t.ctx.deps, "show", "Coaching Jane Doe", "transcript");
    assert.equal(words.code, 1);
    assert.doesNotMatch(words.text, /told me/);
    const shown = await on(t.ctx.deps, "show", "a0a0a0", "transcript");
    assert.deepEqual([shown.code, shown.said], [0, [`Opened ${A}'s transcript in TextEdit on this Mac.`]]);
    const spell = await on(t.ctx.deps, "spell", "a0a0a0", "add", "Jane", "Jayne");
    assert.deepEqual([spell.code, spell.said], [1, [HELD]]);
    for (const [command, ...rest] of [["finish"], ["push"], ["title"], ["ask"], ["teachings"], ["name", "Another name"]]) {
      const refused = await on(t.ctx.deps, command, "a0a0a0", ...rest);
      assert.deepEqual([refused.code, refused.said], [1, [HELD]], command);
    }
    const again = await on(t.ctx.deps, "kind", "a0a0a0", "finished", "--private", "no", "--again");
    assert.deepEqual([again.code, again.said], [1, [`${A} is a version of a client or group session: answer it as a session too, or ask Jason. Nothing was written.`]]);
    const episodes = await on(t.ctx.deps, "episodes");
    assert.ok(episodes.said.includes(`  ${A}: a version of a client or group session, of 0:10, id a0a0a0`), episodes.text);
    // Only what she said is said back of it.
    for (const r2 of [r, words, shown, spell, again, episodes]) assert.doesNotMatch(r2.text.replace('"Coaching Jane Doe"', ""), SECRET);
    assert.equal(reread(older).rev, 1);
    t.done();
  });
  it("A's own kind … session --again then sweeps A's final/, and names no version still to answer", async () => {
    const t = setup();
    const { older } = twoVersions(t);
    assert.equal((await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again")).code, 0);
    const r = await on(t.ctx.deps, "kind", "a0a0a0", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    const record = reread(older);
    assert.deepEqual([record.kind, record.session.cleared], ["session", null]);
    assert.deepEqual(finalOf(older), [`${record.name.text}.brimm-ops.json`]);
    assert.doesNotMatch(r.text, /another version|other versions/);
    assert.doesNotMatch(r.text, SECRET);
    t.done();
  });
  it("A marked while B is handed off: names B by its label to answer too, and holds B, whose own answer sweeps its final/", async () => {
    const t = setup();
    const { older, newer } = twoVersions(t);
    const bFinal = finalOf(newer);
    const r = await on(t.ctx.deps, "kind", "Coaching Jane Doe", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    const label = reread(older).name.text;
    assert.ok(r.said.includes(`${label} has another version, held as a client or group session until it is answered as one: answer ${LABEL} (3fa9c1) as a session too.`), r.text);
    assert.deepEqual([finalOf(newer), reread(newer).rev], [bFinal, 1]);
    const shown = await on(t.ctx.deps, "show", LABEL, "transcript");
    assert.equal(shown.code, 1, shown.text);
    assert.doesNotMatch(shown.text, /told me/);
    assert.deepEqual((await on(t.ctx.deps, "spell", LABEL, "add", "Jane", "Jayne")).said, [HELD]);
    assert.equal((await on(t.ctx.deps, "show", "Pricing talk", "transcript")).code, 1, "not found by its name");
    const own = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--again");
    assert.equal(own.code, 0, own.text);
    assert.deepEqual(finalOf(newer), [`${reread(newer).name.text}.brimm-ops.json`]);
    t.done();
  });
  it("names a video in the drop folder that a video held as a session holds by its size alone, in episodes and retry, as a gated one's", async () => {
    const t = setup();
    twoVersions(t, { bOver: { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: markOf(null), name: { text: SESSION_NAME, placeholder: false } } });
    // A's video is still in the drop folder: the file a client's name may be in.
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mp4"), "v");
    const episodes = await on(t.ctx.deps, "episodes");
    assert.ok(episodes.said.some((line) => line.startsWith("  A video of 1 bytes, in the Mac Studio's drop folder, for ")), episodes.text);
    const retry = await on(t.ctx.deps, "retry", "nothing fits this");
    assert.deepEqual(retry.said, ['No video in this Mac\'s drop folder fits "nothing fits this". It holds: a video of 1 bytes.']);
    const named = await on(t.ctx.deps, "retry", "Talk");
    assert.equal(named.code, 1, named.text);
    assert.match(named.text, /a video \(a0a0a0\)/);
    for (const r of [episodes, retry]) assert.doesNotMatch(r.text, /Talk\.mp4|Jane|Coaching/);
    assert.doesNotMatch(named.text, /Jane|Coaching/);
    t.done();
  });
  it("holds a newer version of a session, and an older one whose newer version is marked; clearing that mark lifts it", async () => {
    const MARKED = { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: markOf(null), name: { text: "Session, 2026-10-10", placeholder: false } };
    for (const [what, aOver, bOver, held, said] of [
      ["a newer version of a session", MARKED, {}, () => "Pricing talk", LABEL],
      ["an older one whose newer version is marked", {}, { ...MARKED, name: { text: SESSION_NAME, placeholder: false } }, (t) => "Coaching Jane Doe", A]
    ]) {
      const t = setup();
      const { older, newer } = twoVersions(t, { aOver, bOver });
      const session = aOver.kind ? older : newer;
      const other = aOver.kind ? newer : older;
      const id = other.record.id.slice(-6);
      assert.deepEqual((await on(t.ctx.deps, "spell", id, "add", "Jane", "Jayne")).said, [HELD], what);
      assert.equal((await on(t.ctx.deps, "spell", held(t), "add", "Jane", "Jayne")).code, 1, `${what}: not found by its name`);
      assert.ok((await on(t.ctx.deps, "episodes")).said.some((line) => line.startsWith(`  ${said}: a version of a client or group session`)), what);
      // Her click on the dialog clears the session's mark: then the other is held no more.
      const cleared = readEpisode(session.folder).record;
      writeFileSync(recordFile(session.folder, cleared.rev + 1), recordText({ ...cleared, rev: cleared.rev + 1, kind: "finished", session: markOf(CLICKED) }));
      const spell = await on(t.ctx.deps, "spell", id, "add", "Jane", "Jayne");
      assert.notDeepEqual(spell.said, [HELD], `${what}: ${spell.text}`);
      t.done();
    }
  });
});

describe("two sessions not cleared in one video's versions: each mark can be cleared (item 17)", () => {
  const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
  /** edit.js with a stand-in osascript that clicks "Clear it". */
  const clicking = (t) => ({ ...t.ctx.deps, run: async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? CLEAR_IT : t.ctx.deps.run(cmd, args, opts)) });
  it("clears one by her click, holds it as a session while the other is marked, reads nothing of it, and lets the other be cleared", async () => {
    const t = setup();
    const MARKED = (name) => ({ kind: "session", answer: { ...ANSWERED, private: "yes" }, session: markOf(null), name: { text: name, placeholder: false } });
    const { older, newer } = twoVersions(t, { aOver: MARKED("Session, 2026-10-10"), bOver: MARKED(SESSION_NAME) });
    const first = await on(clicking(t), "kind", SESSION_NAME, "finished", "--private", "no", "--again", "--clear-session");
    assert.equal(first.code, 0, first.text);
    assert.ok(first.said.includes(`${SESSION_NAME}: the session mark is cleared, by your click. It is now finished by your editor.`), first.text);
    assert.ok(first.said.includes("Another version of it is still marked a client or group session, so it is held as one, and Claude reads nothing of it: once that mark is cleared too, say what it is again."), first.text);
    assert.deepEqual([reread(newer).kind, reread(newer).session.cleared.confirmed, t.started], ["finished", "dialog", []]);
    // Held as a session while the other is marked: nothing else runs for it, and no hand-off of it is written.
    assert.deepEqual((await on(t.ctx.deps, "spell", LABEL, "add", "Jane", "Jayne")).said, [HELD]);
    assert.match(handoffTarget({ root: t.root, settings: { handoffVersion: 2 } }, { folder: newer.folder, record: reread(newer) }).refusal, /is a version of a client or group session: ask Jason/);
    // The other mark is cleared too: then neither is held.
    const second = await on(clicking(t), "kind", "Session, 2026-10-10", "finished", "--private", "no", "--again", "--clear-session");
    assert.equal(second.code, 0, second.text);
    assert.equal(reread(older).session.cleared.confirmed, "dialog");
    assert.notDeepEqual((await on(t.ctx.deps, "spell", "Pricing talk", "add", "Jane", "Jayne")).said, [HELD]);
    t.done();
  });
});

describe("a waiting video whose import matched a video since marked a session, or a version of one (item 2)", () => {
  const MATCHED = "This video holds most of the words of a client or group session: answer it as a session, or ask Jason.";
  const WAITS = { version: 3, kind: null, label: LABEL, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera", match: OLD } };
  const SESSION_OLD = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, name: { text: "Session, 2026-10-10", placeholder: false }, label: "Video of 10 Oct, 09:12 (Mac Studio)", session: markOf(null) };
  /** The match as the session itself, and as a video one of whose later versions is the session. */
  const worlds = [
    ["the match is a session", (t) => episodeAs(t, { id: OLD, name: OLD_FOLDER, record: SESSION_OLD })],
    ["the match's version set holds one", (t) => {
      episodeAs(t, { id: OLD, name: OLD_FOLDER, record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Coaching Jane Doe", placeholder: false } } });
      episodeAs(t, { id: "e-20261012-b1b1b1", name: "2026-10-12 Another (Mac Studio)", record: { ...SESSION_OLD, label: "Video of 12 Oct, 09:12 (Mac Studio)", name: { text: "Session, 2026-10-12", placeholder: false }, versionOf: OLD } });
    }]
  ];
  for (const [what, world] of worlds) {
    it(`refuses any answer but a session, writing nothing and reading nothing, and the card says it may be a session's new version: ${what}`, async () => {
      const t = setup();
      t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
      world(t);
      const found = episodeFor(t, { record: WAITS, files: LIGHT });
      const episodes = await on(t.ctx.deps, "episodes");
      const card = episodes.said.slice(episodes.said.indexOf(`  ${LABEL}: a video waiting for your answer, of 0:23, id 3fa9c1`));
      assert.deepEqual(card.slice(0, 5), [`  ${LABEL}: a video waiting for your answer, of 0:23, id 3fa9c1`, "    Seen: wide, 0:23, no retakes", "    Came: from a camera", "    Guess: finished by your editor", "    Maybe a new version of a client or group session."], episodes.text);
      assert.doesNotMatch(episodes.text, SECRET);
      for (const kind of ["finished", "raw", "clip"]) {
        const r = await on(t.ctx.deps, "kind", LABEL, kind, "--private", "no");
        assert.deepEqual([r.code, r.said], [1, [MATCHED]], kind);
      }
      assert.deepEqual([reread(found).rev, t.started, t.waits], [1, [], []]);
      const session = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
      assert.equal(session.code, 0, session.text);
      assert.equal(reread(found).kind, "session");
      t.done();
    });
  }
});

describe("\"it was a session after all\" with a listed file of final/ that is not on this Mac (item 3)", () => {
  const COMING = "Dropbox is still bringing Session, 2026-10-14's earlier files over to this Mac: say your answer again in a minute. Nothing was changed.";
  const ASK = `${COMING} Ask Jason if it does not come.`;
  /** The probe's video: finished and handed off, its final/ listing captions that were deleted by hand. */
  function gone(t) {
    const found = handedOff(t);
    rmSync(join(found.folder, "final", "Pricing talk.srt"));
    return found;
  }
  it("writes the mark at once, sets aside what is here, owes what is not, and sweeps it once it comes; after the first refusal it says to ask Jason", async () => {
    const t = setup();
    const found = gone(t);
    const first = await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(first.code, 0, first.text);
    assert.deepEqual(first.said, [
      `${SESSION_NAME}: marked a client or group session. Ask her whether she wants its teachings (principles and Reel ideas) or the transcript only.`,
      `The empty session revision of ${SESSION_NAME} is written as revision 2 and shown in Finder: drop it on the BRIMM Ops page.`,
      `Dropbox is still bringing some of ${SESSION_NAME}'s earlier files over to this Mac: say your answer again in a minute, and they are set aside too.`
    ]);
    let record = reread(found);
    assert.deepEqual([record.kind, record.session.emptyRevision, "final/Pricing talk.srt" in record.files], ["session", 2, true]);
    assert.deepEqual(finalOf(found), [`${SESSION_NAME}.brimm-ops.json`]);
    // The gate holds it at once.
    assert.deepEqual((await on(t.ctx.deps, "show", SESSION_NAME, "transcript")).said, [`${SESSION_NAME} has no transcript yet.`]);
    // Said again while it is not here: refused, then pointed to Jason.
    const second = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([second.code, second.said], [1, [COMING]]);
    const third = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([third.code, third.said], [1, [ASK]]);
    assert.equal(reread(found).rev, record.rev);
    // It comes: the same answer sweeps it into history/, and no second empty revision is written.
    writeFileSync(join(found.folder, "final", "Pricing talk.srt"), "1\n00:00:00,000 --> 00:00:02,000\nHello\n");
    const fourth = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.equal(fourth.code, 0, fourth.text);
    record = reread(found);
    assert.deepEqual([finalOf(found), "final/Pricing talk.srt" in record.files, record.session.emptyRevision, record.finished.revision], [[`${SESSION_NAME}.brimm-ops.json`], false, 2, 2]);
    assert.ok(listAll(join(found.folder, "history")).some((rel) => rel.endsWith(" Pricing talk.srt")));
    // Nothing is owed now: the answer again is a session already.
    const fifth = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([fifth.code, fifth.said], [1, [`${SESSION_NAME} is a client or group session already.`]]);
    t.done();
  });
  it("says to ask Jason after the first refusal of a correction to another kind too, which waits for the file", async () => {
    const t = setup();
    gone(t);
    const NOT = "Dropbox is still bringing Pricing talk's earlier files over to this Mac: say your answer again in a minute. Nothing was changed.";
    assert.deepEqual((await on(t.ctx.deps, "kind", "Pricing talk", "raw", "--private", "no", "--again")).said, [NOT]);
    assert.deepEqual((await on(t.ctx.deps, "kind", "Pricing talk", "raw", "--private", "no", "--again")).said, [`${NOT} Ask Jason if it does not come.`]);
    t.done();
  });
});

describe("the README's rows for the commands of the fork (item 7)", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  /** The rows of the README's tables whose command cell starts with `command`. */
  const rowsOf = (command) => readme.split("\n").filter((line) => line.startsWith("|") && new RegExp(`^\\|(?: "[^|]*" \\|)? \`${command}[ \`]`).test(line));
  it("has a row for every command the help gives", () => {
    const given = COMMAND_NAMES.filter((name) => HELP.includes(`node edit.js ${name} `) || HELP.includes(`node edit.js ${name}\n`));
    assert.ok(given.length >= 25, given.join(" "));
    // `finish` has a section of its own, and `ideas` shares the row of `principles`.
    for (const name of given.filter((n) => !["finish", "ideas"].includes(n))) assert.ok(rowsOf(name).length, `the README has no row for ${name}`);
    assert.ok(rowsOf("principles").some((row) => row.includes('`ideas "<session>"')));
  });
  it("gives kind every flag of its usage, and the rows of leave, which, a client's agreement and retry's label", () => {
    const [kind] = rowsOf("kind");
    for (const flag of ["--private yes\\|no", "--version-of <id>\\|none", "--not-a-session", "--again", "--clear-session", "--here"]) assert.ok(kind.includes(flag), flag);
    assert.match(rowsOf("leave")[0], /not for brimm-video/);
    assert.match(rowsOf("which")[0], /clone/);
    assert.ok(rowsOf("reel").some((row) => row.startsWith('| `reel "<label>" <n> --client-agreed` |')));
    assert.match(rowsOf("retry")[0], /by the label a light import's status gives it/);
  });
});

// --- The second wave ---

describe("a session mark on a new version whose import matched its earlier version can be cleared (item 22)", () => {
  const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
  it("answers it a new version of the video it matched, marks it a session, and clears the mark by her click", async () => {
    const t = setup();
    writeSettings(t.home, { handoffVersion: 2 });
    episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const found = episodeFor(t, { record: { version: 3, kind: null, label: LABEL, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera", match: OLD } }, files: LIGHT });
    const dialogs = [];
    const clicking = { ...t.ctx.deps, run: async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? (dialogs.push(args), CLEAR_IT) : t.ctx.deps.run(cmd, args, opts)) };
    const answered = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--version-of", "a0a0a0");
    assert.equal(answered.code, 0, answered.text);
    assert.equal(reread(found).versionOf, OLD);
    const marked = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--again");
    assert.equal(marked.code, 0, marked.text);
    const label = reread(found).name.text;
    const cleared = await on(clicking, "kind", label, "finished", "--private", "no", "--again", "--clear-session");
    assert.equal(cleared.code, 0, cleared.text);
    assert.ok(cleared.said.includes(`${label}: the session mark is cleared, by your click. It is now finished by your editor.`), cleared.text);
    assert.equal(dialogs.length, 1);
    assert.deepEqual([reread(found).kind, reread(found).session.cleared.confirmed], ["finished", "dialog"]);
    t.done();
  });
});

describe("the empty revision says its words went to Claude when a reading's files are listed but not here (item 23)", () => {
  it("at the answer, and when an owed revision is written later", async () => {
    const t = setup();
    // Claude's notes from before the switch, which the record lists and Dropbox has not brought.
    const found = handedOff(t, { files: { "Pricing talk.edit-notes.txt": "notes" } });
    rmSync(join(found.folder, "Pricing talk.edit-notes.txt"));
    const r = await on(t.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`The empty session revision of ${SESSION_NAME} is written as revision 2 and shown in Finder. ${GONE}`), r.text);
    t.done();
    // Owed: its earlier version is not on this Mac yet, so the revision waits; once it comes, the same answer writes it, and says so.
    const u = setup();
    const MISSING = "e-20261001-aaaaaa";
    const owed = handedOff(u, { over: { versionOf: MISSING }, files: { "Pricing talk.edit-notes.txt": "notes", "final/Pricing talk.brimm-ops.json": handoff2(MISSING, 1) } });
    rmSync(join(owed.folder, "Pricing talk.edit-notes.txt"));
    const first = await on(u.ctx.deps, "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(reread(owed).session.emptyRevision, "owed", first.text);
    episodeAs(u, { id: MISSING, name: "2026-10-01 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const later = await on(u.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.equal(later.code, 0, later.text);
    assert.ok(later.said.includes(`The empty session revision of ${SESSION_NAME} is written as revision 2 and shown in Finder. ${GONE}`), later.text);
    u.done();
  });
});

describe("a clearing whose set-aside fails after her click (item 24)", () => {
  const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
  it("says it was not cleared, and lets go the claim it wrote: the session stays as it was, held by nobody", async () => {
    const t = setup();
    writeSettings(t.home, { handoffVersion: 2 });
    const sessionHandoff = JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID, kind: "session" } });
    const found = episodeFor(t, {
      record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: LABEL, editing: null, name: { text: SESSION_NAME, placeholder: false }, session: markOf(null), finished: { revision: 1, at: AT, on: "Mac Studio", handoff: `final/${SESSION_NAME}.brimm-ops.json`, parts: {} } },
      files: { ...LIGHT, [`final/${SESSION_NAME}.brimm-ops.json`]: sessionHandoff }
    });
    // After her click, history/ cannot be written into.
    const deps = {
      ...t.ctx.deps,
      run: async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? CLEAR_IT : t.ctx.deps.run(cmd, args, opts)),
      clone: (from, to) => {
        if (to.includes("/history/")) throw new Error("the disk refused it");
        return t.ctx.deps.clone(from, to);
      }
    };
    const r = await on(deps, "kind", SESSION_NAME, "finished", "--private", "no", "--again", "--clear-session");
    assert.deepEqual([r.code, r.said.slice(1)], [1, ["Not cleared: its earlier files could not be set aside in history/ (an error)."]]);
    const record = reread(found);
    assert.deepEqual([record.kind, record.session.cleared, record.editing, finalOf(found)], ["session", null, null, [`${SESSION_NAME}.brimm-ops.json`]]);
    assert.ok(!existsSync(join(found.folder, "history")) || listAll(join(found.folder, "history")).length === 0);
    assert.deepEqual(t.started, []);
    t.done();
  });
});

describe("a video held as a session, with no label, is listed with its short id once (item 25)", () => {
  it("in the lists of episodes a command gives, and in a drop folder's line", async () => {
    const t = setup();
    twoVersions(t, { bOver: { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: markOf(null), name: { text: SESSION_NAME, placeholder: false } } });
    const none = await on(t.ctx.deps, "show", "nothing fits this", "transcript");
    assert.deepEqual(none.said, [`No episode fits "nothing fits this". The episodes are: ${SESSION_NAME} (3fa9c1) and a video (a0a0a0).`]);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mp4"), "v");
    const episodes = await on(t.ctx.deps, "episodes");
    assert.ok(episodes.said.some((line) => line.endsWith(": already imported as a video (a0a0a0). It stays in the drop folder until its late check passes, or for a person to delete.")), episodes.text);
    for (const r of [none, episodes]) assert.doesNotMatch(r.text, /\(a0a0a0\) \(a0a0a0\)/);
    // A labelled one keeps its label and its short id, as a gated one is listed.
    const u = setup();
    twoVersions(u, { aOver: { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: markOf(null), name: { text: "Session, 2026-10-10", placeholder: false } } });
    assert.match((await on(u.ctx.deps, "show", "nothing fits this", "transcript")).said[0], new RegExp(`${LABEL.replace(/[()]/g, "\\$&")} \\(3fa9c1\\)`));
    t.done();
    u.done();
  });
});

// --- The third wave ---

describe("clearing a session mark among three versions that matched the same video (item 26)", () => {
  const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
  const BID = "e-20261016-b0b0b0";
  const BLABEL = "Video of 16 Oct, 09:12 (Mac Studio)";
  const MATCHED = "This video holds most of the words of a client or group session: answer it as a session, or ask Jason.";
  const WAITS = (match) => ({ version: 3, kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera", match } });
  const clicking = (t, dialogs = []) => ({ ...t.ctx.deps, run: async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? (dialogs.push(args), CLEAR_IT) : t.ctx.deps.run(cmd, args, opts)) });
  it("clears V by her click though B, another version, is marked: V is held while B's mark stands, and then B is cleared too", async () => {
    const t = setup();
    writeSettings(t.home, { handoffVersion: 2 });
    episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const b = episodeAs(t, { id: BID, name: "2026-10-16 B talk (Mac Studio)", record: { ...WAITS(OLD), label: BLABEL } });
    const v = episodeFor(t, { record: { ...WAITS(OLD), label: LABEL }, files: LIGHT });
    for (const label of [LABEL, BLABEL]) assert.equal((await on(t.ctx.deps, "kind", label, "finished", "--private", "no", "--version-of", "a0a0a0")).code, 0, label);
    const marked = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--again");
    // The mark tells her to answer A and B as sessions too: she answers B so.
    assert.ok(marked.said.some((line) => line.includes(`${BLABEL} (b0b0b0)`)), marked.text);
    assert.equal((await on(t.ctx.deps, "kind", BLABEL, "session", "--private", "yes", "--again")).code, 0);
    const vName = reread(v).name.text;
    const bName = reread(b).name.text;
    const dialogs = [];
    const before = t.started.length;
    const first = await on(clicking(t, dialogs), "kind", vName, "finished", "--private", "no", "--again", "--clear-session");
    assert.deepEqual([first.code, dialogs.length], [0, 1], first.text);
    assert.ok(first.said.includes(STILL_HELD), first.text);
    assert.deepEqual([reread(v).kind, reread(v).session.cleared.confirmed, t.started.slice(before)], ["finished", "dialog", []], "no reading of it is started");
    // Held as a session while B's mark stands: nothing else runs for it, and no hand-off of it is written.
    assert.deepEqual((await on(t.ctx.deps, "spell", LABEL, "add", "Jane", "Jayne")).said, [HELD]);
    assert.match(handoffTarget({ root: t.root, settings: { handoffVersion: 2 } }, { folder: v.folder, record: reread(v) }).refusal, /is a version of a client or group session: ask Jason/);
    const second = await on(clicking(t, dialogs), "kind", bName, "finished", "--private", "no", "--again", "--clear-session");
    assert.deepEqual([second.code, dialogs.length], [0, 2], second.text);
    assert.deepEqual([reread(b).kind, reread(b).session.cleared.confirmed], ["finished", "dialog"]);
    assert.notDeepEqual((await on(t.ctx.deps, "spell", "Pricing talk", "add", "Jane", "Jayne")).said, [HELD]);
    t.done();
  });
  it("refuses a clearing that moves the video out of its versions (--version-of none, or another video): no dialog, no reading, nothing written", async () => {
    const ZID = "e-20261009-e9e9e9";
    const cases = [
      ["B marked, --version-of none", { withB: true }, ["--version-of", "none"]],
      ["B marked, --version-of an unrelated video", { withB: true }, ["--version-of", "e9e9e9"]],
      ["A itself marked, --version-of none", { aMarked: true }, ["--version-of", "none"]],
      ["A itself marked, --version-of an unrelated video", { aMarked: true }, ["--version-of", "e9e9e9"]]
    ];
    for (const [what, { withB = false, aMarked = false }, how] of cases) {
      const t = setup();
      writeSettings(t.home, { handoffVersion: 2 });
      episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
      episodeAs(t, { id: ZID, name: "2026-10-09 Z talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Z talk", placeholder: false } } });
      if (withB) episodeAs(t, { id: BID, name: "2026-10-16 B talk (Mac Studio)", record: { ...WAITS(OLD), label: BLABEL } });
      const v = episodeFor(t, { record: { ...WAITS(OLD), label: LABEL }, files: LIGHT });
      if (aMarked) assert.equal((await on(t.ctx.deps, "kind", "Older talk", "session", "--private", "yes", "--again")).code, 0, what);
      // Answered as sessions from the first: never read, never handed off.
      assert.equal((await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--version-of", "a0a0a0")).code, 0, what);
      if (withB) assert.equal((await on(t.ctx.deps, "kind", BLABEL, "session", "--private", "yes", "--version-of", "a0a0a0")).code, 0, what);
      const record = reread(v);
      const dialogs = [];
      const before = t.started.length;
      const r = await on(clicking(t, dialogs), "kind", record.name.text, "finished", "--private", "no", "--again", "--clear-session", ...how);
      assert.deepEqual([r.code, r.said, dialogs.length, t.started.slice(before), reread(v).rev], [1, [MATCHED], 0, [], record.rev], what);
      t.done();
    }
  });
  it("still refuses an answer, a clearing among them, when the session is in the match's versions and not in the video's own", async () => {
    const t = setup();
    // X is finished; S, a session not cleared, is a version of X. V is a session of its own, whose import matched X.
    const X = "e-20261011-c1c1c1";
    episodeAs(t, { id: X, name: "2026-10-11 X talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "X talk", placeholder: false } } });
    episodeAs(t, { id: "e-20261012-d2d2d2", name: "2026-10-12 S talk (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 12 Oct, 09:12 (Mac Studio)", name: { text: "Session, 2026-10-12", placeholder: false }, session: markOf(null), versionOf: X } });
    const v = episodeFor(t, { record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes", match: X }, label: LABEL, name: { text: SESSION_NAME, placeholder: false }, session: markOf(null), editing: null }, files: LIGHT });
    const dialogs = [];
    const cleared = await on(clicking(t, dialogs), "kind", SESSION_NAME, "finished", "--private", "no", "--again", "--clear-session");
    assert.deepEqual([cleared.code, cleared.said, dialogs.length, reread(v).rev], [1, [MATCHED], 0, 1]);
    // And a first answer that is not a session, of a video waiting whose import matched X (item 2).
    const u = setup();
    episodeAs(u, { id: X, name: "2026-10-11 X talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "X talk", placeholder: false } } });
    episodeAs(u, { id: "e-20261012-d2d2d2", name: "2026-10-12 S talk (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 12 Oct, 09:12 (Mac Studio)", name: { text: "Session, 2026-10-12", placeholder: false }, session: markOf(null), versionOf: X } });
    episodeFor(u, { record: { ...WAITS(X), label: LABEL }, files: LIGHT });
    assert.deepEqual((await on(u.ctx.deps, "kind", LABEL, "finished", "--private", "no")).said, [MATCHED]);
    t.done();
    u.done();
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
