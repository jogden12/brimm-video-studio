// The episode import's own steps that need no video: whether a watched folder is this Mac's drop folder, what kind of
// episode a video makes, which folder in Episodes it goes into, and which brimm-video wrote its record. The import itself, with
// stand-ins for every program, is in unedited.test.js. Each test has a temp folder of its own; nothing touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { episodeMode, episodeKind, findFolder, commitOf, importEpisodes, clearRuns, clearCrashes, heldBy } from "../filing.js";
import { newEpisode, recordFile, recordText } from "../episode.js";
import { readStatuses, writeStatus } from "../importing.js";

const ROOT = "/Users/jasonogden/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video";
const SETTINGS = { version: 1, machine: "Mac Studio", root: ROOT, checkout: "/Users/jasonogden/Claude Code/BRIMM video" };
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

describe("whether a watched folder is this Mac's drop folder", () => {
  it("is, when this Mac has settings and the folder is its own drop folder, however the path is written", () => {
    assert.equal(episodeMode(`${ROOT}/Unedited Video/Mac Studio`, SETTINGS), true);
    assert.equal(episodeMode(`${ROOT}/Unedited Video/Mac Studio/`, SETTINGS), true);
    assert.equal(episodeMode(`${ROOT}/Unedited Video/../Unedited Video/Mac Studio`, SETTINGS), true);
  });
  it("is not, with no settings, or for another folder, such as today's or the other Mac's", () => {
    assert.equal(episodeMode(`${ROOT}/Unedited Video/Mac Studio`, null), false);
    assert.equal(episodeMode("/Users/jasonogden/Dropbox/BRIMM VIDEO Transfer/Unedited Video Transfer", SETTINGS), false);
    assert.equal(episodeMode(`${ROOT}/Unedited Video/Sallie's laptop`, SETTINGS), false);
  });
  // A Mac whose settings say Drop watches Drop/<Mac>. If the import still took the old folder for the drop folder, it would file
  // each video the old way, renaming it into a folder for the day inside Dropbox, which the rule for Dropbox forbids.
  it("is, when this Mac's settings name Drop, for Drop/<this Mac>, and no longer for Unedited Video/<this Mac>", () => {
    const drop = { ...SETTINGS, drop: "Drop" };
    assert.equal(episodeMode(`${ROOT}/Drop/Mac Studio`, drop), true);
    assert.equal(episodeMode(`${ROOT}/Drop/Mac Studio/`, drop), true);
    assert.equal(episodeMode(`${ROOT}/Unedited Video/Mac Studio`, drop), false);
    assert.equal(episodeMode(`${ROOT}/Drop/Sallie's laptop`, drop), false);
  });
  it("is as it was when the settings name Unedited Video or no drop folder: Drop/<this Mac> is then no drop folder of this Mac's", () => {
    for (const settings of [SETTINGS, { ...SETTINGS, drop: "Unedited Video" }]) {
      assert.equal(episodeMode(`${ROOT}/Unedited Video/Mac Studio`, settings), true);
      assert.equal(episodeMode(`${ROOT}/Drop/Mac Studio`, settings), false);
    }
  });
});

describe("the kind of episode a video makes", () => {
  const facts = (width, height, duration) => ({ width, height, duration });
  it("is an episode when its picture is wider than it is tall and it lasts 90 seconds or more", () => {
    assert.equal(episodeKind(facts(1280, 720, 1834)), "episode");
    assert.equal(episodeKind(facts(1920, 1080, 90)), "episode");
  });
  it("is a short video when it is upright or square, or shorter than 90 seconds", () => {
    assert.equal(episodeKind(facts(1080, 1920, 600)), "short video");
    assert.equal(episodeKind(facts(1080, 1080, 300)), "short video");
    assert.equal(episodeKind(facts(1280, 720, 60)), "short video");
  });
  it("is an episode when it has no picture, as a recording of sound alone", () => {
    assert.equal(episodeKind(facts(0, 0, 30)), "episode");
  });
});

describe("the folder in Episodes a video goes into", () => {
  /** One test's Episodes folder. `folder` makes a folder in it, with files by their sizes, and a whole first record when
      `record` is true. */
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    const episodes = join(dir, "Episodes");
    mkdirSync(episodes);
    const folder = (name, { files = {}, record = false } = {}) => {
      mkdirSync(join(episodes, name));
      for (const [file, bytes] of Object.entries(files)) {
        mkdirSync(dirname(join(episodes, name, file)), { recursive: true });
        writeFileSync(join(episodes, name, file), "x".repeat(bytes));
      }
      if (record) {
        const r = { ...newEpisode({ id: "e-20261014-3fa9c1", machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: "Talk.mp4", bytes: 5, seconds: 23.4, created: null }, kind: "episode", writer: { commit: "abc1234", on: "Mac Studio" } }), rev: 1 };
        mkdirSync(join(episodes, name, "record"));
        writeFileSync(recordFile(join(episodes, name), 1), recordText(r));
      }
    };
    return { episodes, folder, done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  const asked = { video: "Talk.mp4", bytes: 5, machine: "Mac Studio", day: "2026-10-14" };
  it("is a new folder named for the day, the video and this Mac", () => {
    const t = setup();
    assert.deepEqual(findFolder(t.episodes, asked), { name: "2026-10-14 Talk (Mac Studio)", reused: false });
    t.done();
  });
  it("is the next free name when an episode of that name is there", () => {
    const t = setup();
    t.folder("2026-10-14 Talk (Mac Studio)", { files: { "Talk.mp4": 5 }, record: true });
    assert.deepEqual(findFolder(t.episodes, asked), { name: "2026-10-14 Talk (Mac Studio)-2", reused: false });
    t.done();
  });
  it("is the folder of an import of this video by this Mac that stopped before its record, whatever its day", () => {
    const t = setup();
    t.folder("2026-10-13 Talk (Mac Studio)", { files: { "Talk.mp4": 5, "Talk.srt": 3, "record/0001.json": 4 } });
    assert.deepEqual(findFolder(t.episodes, asked), { name: "2026-10-13 Talk (Mac Studio)", reused: true });
    t.done();
  });
  it("is the folder of a stopped import that had not yet put the video in", () => {
    const t = setup();
    t.folder("2026-10-14 Talk (Mac Studio)-2", { files: { "Talk.srt": 3 } });
    assert.deepEqual(findFolder(t.episodes, asked), { name: "2026-10-14 Talk (Mac Studio)-2", reused: true });
    t.done();
  });
  it("is never a stopped import of another video of that name, the other Mac's folder, or one with a whole record", () => {
    const t = setup();
    t.folder("2026-10-14 Talk (Mac Studio)", { files: { "Talk.mp4": 9 } });
    t.folder("2026-10-14 Talk (Sallie's laptop)", { files: { "Talk.mp4": 5 } });
    assert.deepEqual(findFolder(t.episodes, asked), { name: "2026-10-14 Talk (Mac Studio)-2", reused: false });
    t.done();
  });
});

describe("which brimm-video wrote a record", () => {
  it("is the short commit the checkout is at", () => {
    assert.match(commitOf(REPO), /^[0-9a-f]{7,}$/);
  });
  it("is unknown when the folder is not a checkout", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    assert.equal(commitOf(dir), "unknown");
    assert.equal(commitOf(join(dir, "not there")), "unknown");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the wait for late checks", () => {
  it("checks each pending late check once in a run, so one that cannot be put away never holds the run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    const home = join(dir, "home");
    const root = join(dir, "BRIMM Video");
    const drop = join(root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    const pending = join(home, "Library", "Application Support", "BRIMM Video", "pending");
    mkdirSync(pending, { recursive: true });
    // A late check that is due, of a file that is whole, whose pending file cannot be taken away: its folder is read-only.
    const to = join(dir, "whole.txt");
    writeFileSync(to, "whole");
    writeFileSync(join(pending, "e-20261013-000001.json"), JSON.stringify({ version: 1, id: "e-20261013-000001", name: "x", folder: dir, video: "x.mov", bytes: 5, seconds: 1, drop: join(drop, "x.mov"), work: join(dir, "work"), entries: [{ from: to, to, bytes: 5 }], lastCopy: 0, root, machine: "Mac Studio", planTxt: "x.cut-plan.txt" }));
    chmodSync(pending, 0o555);
    let waits = 0;
    const deps = { episode: { root, machine: "Mac Studio", home }, clock: () => 10 ** 13, wait: async () => { waits += 1; }, keepAwake: () => {}, log: () => {} };
    const results = await importEpisodes(drop, deps, async () => assert.fail("nothing is waiting"));
    chmodSync(pending, 0o755);
    assert.deepEqual([results, waits], [[], 0]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("what the lead's review of PR 11 found in the runs' own folders", () => {
  it("4. takes away the folders of runs that stopped, and keeps those of a live run and those a late check still needs", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    const home = join(dir, "home");
    const runs = join(home, "BRIMM Video Work", ".runs");
    for (const name of ["99999999-1", "99999998-2", `${process.pid}-3`, "push-99999997-4", "notes"]) mkdirSync(join(runs, name), { recursive: true });
    const pending = { version: 1, id: "e-20261013-000001", work: join(runs, "99999998-2"), entries: [], lastCopy: 0 };
    const pendings = join(home, "Library", "Application Support", "BRIMM Video", "pending");
    mkdirSync(pendings, { recursive: true });
    writeFileSync(join(pendings, "e-20261013-000001.json"), JSON.stringify(pending));
    clearRuns(home, (pid) => pid === process.pid);
    assert.deepEqual(readdirSync(runs).sort(), [`${process.pid}-3`, "99999998-2", "notes"].sort());
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Zoom's files in a light drop folder, held until phase Z", () => {
  const HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";
  /** A recording and the separate sound and picture of a meeting, as Zoom names them. */
  const ZOOM = ["GMT20261013-142933_Recording_gvo_1280x720.mp4", "audio1449382767.m4a", "video1449382767.mp4"];
  const bytesOf = (name) => Buffer.byteLength(`the bytes of ${name}`);
  /** A test's own BRIMM Video, with this Mac's drop folder holding `names`, and one run of the import of it: `run()`. The
      import "imports" each video it takes by noting its name in `imported`, and leaves it where it is. `light` is what the run
      is told (`deps.light`): true, false, or null for nothing. */
  function drop(names, { light = true } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    const home = join(dir, "home");
    const root = join(dir, "BRIMM Video");
    const folder = join(root, "Unedited Video", "Mac Studio");
    mkdirSync(folder, { recursive: true });
    for (const name of names) writeFileSync(join(folder, name), `the bytes of ${name}`);
    const logs = [];
    const imported = [];
    const deps = { episode: { root, machine: "Mac Studio", home }, ...(light === null ? {} : { light }), clock: () => Date.parse("2026-10-23T10:00:00"), wait: async () => {}, keepAwake: () => {}, log: (line) => logs.push(line), clone: (from, to) => copyFileSync(from, to), sameDisk: () => true };
    const run = () => importEpisodes(folder, deps, async (name) => {
      imported.push(name);
      return { ok: true, name };
    });
    const statuses = () => readStatuses(root).map((s) => s.status);
    return { dir, home, root, folder, logs, imported, deps, run, statuses, done: () => rmSync(dir, { recursive: true, force: true }) };
  }

  it("are not imported: each stays where it is, its status says why, and the log says so once however often the folder is looked at", async () => {
    const t = drop([...ZOOM, "Talk.mov"]);
    const results = await t.run();
    assert.deepEqual(t.imported, ["Talk.mov"]);
    assert.deepEqual(results.filter((r) => r.held).map((r) => [r.ok, r.name, r.held]).sort(), ZOOM.map((name) => [true, name, HELD]).sort());
    assert.deepEqual(readdirSync(t.folder).sort(), [...ZOOM, "Talk.mov"].sort());
    const held = t.statuses().filter((s) => ZOOM.includes(s.video)).sort((a, b) => a.video.localeCompare(b.video));
    assert.equal(held.length, 3);
    for (const { at, ...status } of held) {
      assert.deepEqual(status, { version: 1, machine: "Mac Studio", pid: process.pid, video: status.video, bytes: bytesOf(status.video), seconds: null, step: "Held", held: HELD });
      assert.ok(Number.isFinite(Date.parse(at)), at);
    }
    for (const name of ZOOM) assert.equal(t.logs.filter((line) => line === `${name}: ${HELD}`).length, 1, t.logs.join("\n"));
    t.done();
  });
  it("are held by the status for the next run too, which says so again", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    t.logs.length = 0;
    await t.run();
    assert.deepEqual(t.imported, []);
    assert.deepEqual(t.logs.filter((line) => line.startsWith(`${ZOOM[0]}:`)), [`${ZOOM[0]}: ${HELD}`]);
    assert.equal(t.statuses().length, 1);
    t.done();
  });
  it("are the only files held: any other name is imported, even one that holds a Zoom name", async () => {
    const names = ["Talk.mov", "My GMT20261013-142933_Recording.mp4", "audio12.m4a", "video1449382767.mov"];
    const t = drop(names);
    await t.run();
    assert.deepEqual(t.imported.sort(), [...names].sort());
    assert.deepEqual(t.statuses(), []);
    t.done();
  });
  it("are imported as any video is when the setting is off or absent, and nothing is written about them", async () => {
    for (const light of [false, null]) {
      const t = drop(ZOOM, { light });
      const results = await t.run();
      assert.deepEqual(t.imported.sort(), [...ZOOM].sort(), String(light));
      assert.deepEqual([results.filter((r) => r.held), t.statuses(), existsSync(join(t.root, "Episodes", ".importing"))], [[], [], false], String(light));
      t.done();
    }
  });
  it("lose their status when the file leaves the folder or is another file, or when the setting is turned off", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    assert.equal(t.statuses().length, 1);
    // The file is put in BRIMM VIDEO Transfer: nothing says it is held any more.
    rmSync(join(t.folder, ZOOM[0]));
    await t.run();
    assert.deepEqual(t.statuses(), []);
    // A recording of that name put in the folder is held, by its own status.
    writeFileSync(join(t.folder, ZOOM[0]), "another recording");
    await t.run();
    assert.deepEqual(t.statuses().map((s) => s.bytes), [17]);
    // Another file of that name, of another size, is held by its own status and not by the old one.
    writeFileSync(join(t.folder, ZOOM[0]), "a third recording, a longer one");
    t.logs.length = 0;
    await t.run();
    assert.deepEqual(t.statuses().map((s) => s.bytes), [31]);
    assert.ok(t.logs.includes(`${ZOOM[0]}: ${HELD}`), t.logs.join("\n"));
    // Taken lightly no more, it is imported as before, and the status that held it is gone.
    t.deps.light = false;
    await t.run();
    assert.deepEqual([t.statuses(), t.imported], [[], [ZOOM[0]]]);
    t.done();
  });
  it("keep their status through the next run of this Mac, which is no crash's to take away", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    // The run that wrote it is gone, and the status is old: a crash's status goes then, but not a hold's.
    const cleared = clearCrashes({ root: t.root, machine: "Mac Studio", now: Date.parse("2026-10-23T12:00:00"), alive: () => false, pid: 1 });
    assert.deepEqual([cleared, t.statuses().map((s) => s.held)], [[], [HELD]]);
    t.done();
  });
  it("are said to be held, by the status, to whoever asks why the video is not imported, whichever Mac wrote it", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    assert.equal(heldBy({ root: t.root, video: ZOOM[0], bytes: bytesOf(ZOOM[0]) }), HELD);
    // Another recording of that name, of another size, is not held by it, and nor is another video.
    assert.equal(heldBy({ root: t.root, video: ZOOM[0], bytes: 1 }), "");
    assert.equal(heldBy({ root: t.root, video: "Talk.mov", bytes: bytesOf(ZOOM[0]) }), "");
    // The other Mac's status is there for this Mac to read, as it is for the person asking on either.
    writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 1, video: ZOOM[1], bytes: 7, seconds: null, step: "Held", at: "2026-10-23T10:00:00-04:00", held: HELD }, (to, text) => writeFileSync(to, text));
    assert.equal(heldBy({ root: t.root, video: ZOOM[1], bytes: 7 }), HELD);
    t.done();
  });
});
