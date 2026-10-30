// The episode import's own steps that need no video: whether a watched folder is this Mac's drop folder, what kind of
// episode a video makes, which folder in Episodes it goes into, and which brimm-video wrote its record. The import itself, with
// stand-ins for every program, is in unedited.test.js. Each test has a temp folder of its own; nothing touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { episodeMode, episodeKind, findFolder, commitOf, thisCheckout, importEpisodes, clearRuns, clearCrashes, heldBy, dueAt } from "../filing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { newEpisode, recordFile, recordText } from "../episode.js";
import { readStatuses, writeStatus } from "../importing.js";
import { zoomTimeOf } from "../kinds.js";
import { OWN_CHECKOUT, OWN_COMMIT, WITHOUT_COMMIT } from "./own-checkout.js";

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
  it("is, for the checkout this code is in, the folder above tool/: no setting names it", () => {
    assert.equal(thisCheckout(), OWN_CHECKOUT);
  });
  it("is, for the checkout this code is in, the commit git says there", { skip: WITHOUT_COMMIT }, () => {
    assert.equal(commitOf(thisCheckout()), OWN_COMMIT);
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

  /** A test's own BRIMM Video and home, with this Mac's drop folder holding `names`, each of the bytes "the bytes of <name>". */
  function world(names) {
    const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
    const home = join(dir, "home");
    const root = join(dir, "BRIMM Video");
    const folder = join(root, "Unedited Video", "Mac Studio");
    mkdirSync(folder, { recursive: true });
    for (const name of names) writeFileSync(join(folder, name), `the bytes of ${name}`);
    const statuses = () => readStatuses(root).map(({ status }) => status);
    return { dir, home, root, folder, statuses, done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  /** A late check this Mac holds of `video`, imported into its own episode, `lastCopy` milliseconds from the epoch: the pending
      check, kept on this Mac's disk, and the episode with its record. The one file the check looks at is whole in the episode,
      unless `whole` is false, and then it is not there, and nor is its work copy. Gives back the pending, as it was written. */
  function holdCheck(w, video, lastCopy, { whole = true } = {}) {
    const id = `e-20261027-${video.slice(0, 1).toLowerCase()}00001`;
    const folder = join(w.root, "Episodes", `2026-10-27 ${video} (Mac Studio)`);
    mkdirSync(join(folder, "record"), { recursive: true });
    const bytes = Buffer.byteLength(`the bytes of ${video}`);
    const record = { ...newEpisode({ id, machine: "Mac Studio", at: "2026-10-27T09:00:00-05:00", video: { file: video, bytes, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: "Mac Studio" } }), rev: 1 };
    writeFileSync(recordFile(folder, 1), recordText(record));
    const to = join(folder, `${video}.rough-cut.mp4`);
    if (whole) writeFileSync(to, "whole");
    const pending = { version: 1, id, name: `2026-10-27 ${video} (Mac Studio)`, folder, video, bytes, seconds: 120, drop: join(w.folder, video), work: join(w.dir, "work", id), entries: [{ from: join(w.dir, "work", id, "cut"), to, bytes: 5 }], lastCopy, root: w.root, machine: "Mac Studio", importId: "k3j9x", planTxt: `${video}.cut-plan.txt` };
    const pendings = join(w.home, "Library", "Application Support", "BRIMM Video", "pending");
    mkdirSync(pendings, { recursive: true });
    writeFileSync(join(pendings, `${id}.json`), JSON.stringify(pending));
    return { ...pending, pendingFile: join(pendings, `${id}.json`) };
  }

  it("36. says in the status of an import waiting for its late check when the check is due: lastCopy plus LATE_CHECK_MS", async () => {
    const w = world([]);
    const L = Date.parse("2026-10-27T10:00:00");
    const X = holdCheck(w, "X.mov", L);
    let now = L + 60 * 1000;
    const seen = [];
    // A minute into the wait, the status is read; the wait then runs on until the check is due, which makes it.
    const wait = async () => {
      seen.push(...w.statuses());
      now = dueAt(X) + 1;
    };
    await importEpisodes(w.folder, { episode: { root: w.root, machine: "Mac Studio", home: w.home }, clock: () => now, wait, clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, keepAwake: () => {}, log: () => {} }, async () => assert.fail("nothing is waiting"));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].step, "Waiting for its late check");
    assert.equal(seen[0].due, L + LATE_CHECK_MS);
    assert.deepEqual([w.statuses(), existsSync(X.pendingFile)], [[], false]);
    w.done();
  });
  it("36. gives the status of a check that found a problem no due", async () => {
    const w = world([]);
    const L = Date.parse("2026-10-27T10:00:00");
    // Its file is not in the episode and has no work copy: the check finds a problem, and says so in the status it writes.
    const X = holdCheck(w, "X.mov", L, { whole: false });
    const deps = { episode: { root: w.root, machine: "Mac Studio", home: w.home }, clock: () => dueAt(X) + 1, wait: async () => {}, clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, keepAwake: () => {}, log: () => {} };
    await importEpisodes(w.folder, deps, async () => assert.fail("nothing is waiting"));
    const [status, ...others] = w.statuses();
    assert.equal(others.length, 0);
    assert.equal(status.step, "Late check");
    assert.match(status.problem, /is not whole/);
    assert.equal("due" in status, false);
    w.done();
  });
  it("37. makes a late check that has come due at the per-minute timer while another video imports, and then passes over the drop file the check took out", async () => {
    // B is imported first, and takes a long time. X is a video this Mac imported before: its check is pending, and its drop file
    // is still in the folder, so its episode holds it. The check comes due while B imports.
    const w = world(["B.mov", "X.mov"]);
    const L = Date.parse("2026-10-27T10:00:00");
    const X = holdCheck(w, "X.mov", L);
    writeStatus(w.root, { version: 1, machine: "Mac Studio", pid: process.pid, import: "k3j9x", video: "X.mov", bytes: X.bytes, seconds: 120, step: "Waiting for its late check", at: new Date().toISOString(), due: dueAt(X) }, (to, text) => writeFileSync(to, text));
    let now = L + 60 * 1000;
    let tick = null;
    const imported = [];
    let during = null;
    const importOne = async (name) => {
      imported.push(name);
      if (name === "B.mov") {
        // A long import: the timer fires once X's check is due, and goes on before B's import ends.
        now = dueAt(X) + 1000;
        tick();
        await Promise.resolve();
        during = { status: w.statuses().filter((s) => s.video === "X.mov").length, dropFile: existsSync(join(w.folder, "X.mov")), pending: existsSync(X.pendingFile) };
      }
      return { ok: true, name };
    };
    const deps = { episode: { root: w.root, machine: "Mac Studio", home: w.home }, clock: () => now, wait: async () => {}, clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, keepAwake: () => {}, log: () => {}, every: (fn) => { tick = fn; return 1; }, cancel: () => {} };
    const results = await importEpisodes(w.folder, deps, importOne);
    assert.deepEqual(during, { status: 0, dropFile: false, pending: false });
    assert.deepEqual(imported, ["B.mov"]);
    assert.deepEqual(results, [{ ok: true, name: "B.mov" }]);
    assert.deepEqual([w.statuses(), readdirSync(w.folder)], [[], ["B.mov"]]);
    w.done();
  });
  it("37. logs a late check that cannot be made at the per-minute timer, and throws nothing, so the import of the other video goes on", async () => {
    const w = world(["B.mov"]);
    const L = Date.parse("2026-10-27T10:00:00");
    const { pendingFile, ...pending } = holdCheck(w, "X.mov", L);
    // A folder that cannot be searched is where one of X's episode's files should be, so that looking at the file throws
    // (EACCES), and does not say that the file is not there.
    const locked = join(w.dir, "locked");
    mkdirSync(locked);
    writeFileSync(pendingFile, JSON.stringify({ ...pending, entries: [{ ...pending.entries[0], to: join(locked, "X.mov.rough-cut.mp4") }] }));
    chmodSync(locked, 0o000);
    try {
      let now = L + 60 * 1000;
      let tick = null;
      const imported = [];
      const logs = [];
      let ticked = null;
      const importOne = async (name) => {
        imported.push(name);
        // A long import: the timer fires once X's check is due. An uncaught throw in a timer would end the whole import process.
        now = dueAt(pending) + 1000;
        assert.doesNotThrow(() => tick());
        ticked = { pending: existsSync(pendingFile), dropFile: existsSync(join(w.folder, "X.mov")) };
        await Promise.resolve();
        return { ok: true, name };
      };
      const deps = { episode: { root: w.root, machine: "Mac Studio", home: w.home }, clock: () => now, wait: async () => {}, clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, keepAwake: () => {}, log: (line) => logs.push(line), every: (fn) => { tick = fn; return 1; }, cancel: () => {} };
      const results = await importEpisodes(w.folder, deps, importOne);
      assert.deepEqual(imported, ["B.mov"]);
      assert.deepEqual(results, [{ ok: true, name: "B.mov" }]);
      assert.deepEqual(logs.filter((line) => line.includes("late check")), ["The late check of a video waiting for it could not be made (EACCES). The next run makes it again."]);
      // Nothing of X's was put away, so that the next run's look makes its check again.
      assert.deepEqual(ticked, { pending: true, dropFile: false });
      assert.equal(existsSync(pendingFile), true);
    } finally {
      chmodSync(locked, 0o700);
      w.done();
    }
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
      // Its label is its Zoom time alone, the part of its name Zoom's own names match (final fix 19).
      assert.deepEqual(status, { version: 1, machine: "Mac Studio", pid: process.pid, video: status.video, bytes: bytesOf(status.video), seconds: null, step: "Held", held: HELD, label: zoomTimeOf(status.video) });
      assert.ok(Number.isFinite(Date.parse(at)), at);
    }
    for (const name of ZOOM) assert.equal(t.logs.filter((line) => line === `${zoomTimeOf(name)}: ${HELD}`).length, 1, t.logs.join("\n"));
    t.done();
  });
  it("36. are held by a status that carries no due, which only a status waiting for a late check does", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    const [status, ...others] = t.statuses();
    assert.equal(others.length, 0);
    assert.deepEqual([status.step, "due" in status], ["Held", false]);
    t.done();
  });
  it("name a Zoom download renamed with a client's words after Zoom's own name by its Zoom time alone, in the log and the status (final fix 19)", async () => {
    const RENAMED = "GMT20261020-150000_Recording_Jane Doe coaching.mp4";
    const t = drop([RENAMED]);
    await t.run();
    assert.equal(zoomTimeOf(RENAMED), "GMT20261020-150000_Recording");
    assert.deepEqual(t.imported, []);
    assert.deepEqual(t.statuses().map((s) => [s.video, s.label, s.held]), [[RENAMED, "GMT20261020-150000_Recording", HELD]]);
    assert.ok(t.logs.includes(`GMT20261020-150000_Recording: ${HELD}`), t.logs.join("\n"));
    assert.doesNotMatch(t.logs.join("\n"), /jane|coaching/i);
    // It leaves the folder: the status goes, and the log names it so too.
    rmSync(join(t.folder, RENAMED));
    await t.run();
    assert.deepEqual(t.statuses(), []);
    assert.doesNotMatch(t.logs.join("\n"), /jane|coaching/i);
    t.done();
  });
  it("are held by the status for the next run too, which says so again", async () => {
    const t = drop([ZOOM[0]]);
    await t.run();
    t.logs.length = 0;
    await t.run();
    assert.deepEqual(t.imported, []);
    assert.deepEqual(t.logs.filter((line) => line.startsWith(`${zoomTimeOf(ZOOM[0])}:`)), [`${zoomTimeOf(ZOOM[0])}: ${HELD}`]);
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
    assert.ok(t.logs.includes(`${zoomTimeOf(ZOOM[0])}: ${HELD}`), t.logs.join("\n"));
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

describe("heldBy, for a video whose episode has a conflicted copy of its record", () => {
  it("finds the episode past the copy, so the import holds the video, and names a session with no label by its short id once", () => {
    // Before, readEpisode stopped at the copy, nothing held the video, and the import would have imported it again.
    const root = join(mkdtempSync(join(tmpdir(), "brimm-held-")), "BRIMM Video");
    const folder = join(root, "Episodes", "2026-10-22 Coaching call Jane Doe (Mac Studio)");
    mkdirSync(join(folder, "record"), { recursive: true });
    const at = "2026-10-22T10:00:00-04:00";
    const record = {
      ...newEpisode({ id: "e-20261022-3fa9c1", machine: "Mac Studio", at, video: { file: "Coaching call Jane Doe.mp4", bytes: 5, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: "Mac Studio" } }),
      rev: 1, version: 3, kind: "session",
      answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at, private: "yes" },
      session: { marked: at, on: "Mac Studio", teachings: null, cleared: null }
    };
    writeFileSync(recordFile(folder, 1), recordText(record));
    writeFileSync(join(folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-22).json"), recordText(record));
    assert.equal(heldBy({ root, video: "Coaching call Jane Doe.mp4", bytes: 5 }), "already imported as a client or group session (3fa9c1). It stays in the drop folder until its late check passes, or for a person to delete.");
    rmSync(dirname(root), { recursive: true, force: true });
  });
});
