// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { HELP, SHOWN_MARKER, editMain } from "../edit.js";
import { readEpisode, recordFile, recordText } from "../episode.js";
import { handoffTarget } from "../finish.js";
import { episodeWork, workFolder, writeSettings } from "../settings.js";
import { askBlocked } from "../unedited.js";
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
