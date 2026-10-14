// The episode import's own steps that need no video: whether a watched folder is this Mac's drop folder, what kind of
// episode a video makes, which folder in Episodes it goes into, and which brimm-video wrote its record. The import itself, with
// stand-ins for every program, is in unedited.test.js. Each test has a temp folder of its own; nothing touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { episodeMode, episodeKind, findFolder, commitOf, importEpisodes } from "../filing.js";
import { newEpisode, recordFile, recordText } from "../episode.js";

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
