// The parts of app.js that rebuild a project from the other Mac's snapshot, on their own (plan PR 11; architecture 2026-10-27, 4.7 and 5.6):
// which snapshot the record lists of a project, the rebuild and what it says, and whether a project here is older than its snapshot.
// edit-take-over-app.test.js runs all of it through editMain with two Macs; these tests give each function a made-up record and a folder
// in the test's own temporary folder, and no program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ASSETS_NOT_IN, KEPT, olderHere, olderThanSnapshot, projectSnapshot, rebuildHere, rebuiltWords, snapshotNotWhole } from "../app.js";
import { fixedZone } from "../exports.js";

const T = "2026-10-20 20.00.00Z";
const WHEN = "2026-10-20 15:00";
const NAME = "Pricing talk";
const PROJECT = "Pricing talk main 3fa9c1";
const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";

/** A temporary folder that goes when the test does, with the episode's folder in it and a project's folder beside it. */
function world(c, { files = { "index.html": "<html>", "brimm/facts.json": "{}", "assets/fonts/a.woff2": "font" }, project = PROJECT } = {}) {
  const base = mkdtempSync(join(tmpdir(), "brimm-rebuilt-"));
  c.after(() => {
    try {
      chmodSync(join(base, "work", project, "compositions"), 0o755);
    } catch (e) {
      // It was never closed.
    }
    rmSync(base, { recursive: true, force: true });
  });
  const folder = join(base, "episode");
  const listed = {};
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, "app-snapshot", T, project, rel)), { recursive: true });
    writeFileSync(join(folder, "app-snapshot", T, project, rel), text);
    utimesSync(join(folder, "app-snapshot", T, project, rel), new Date("2026-10-20T14:00:00Z"), new Date("2026-10-20T14:00:00Z"));
    listed[`app-snapshot/${T}/${project}/${rel}`] = Buffer.byteLength(text);
  }
  const record = { name: { text: NAME }, files: listed, released: { by: "Mac Studio" }, app: { projects: [{ key: "main", name: project, state: "opened" }] } };
  const said = [];
  const ctx = { machine: "Sallie's laptop", say: (line) => said.push(line), now: () => Date.parse("2026-10-20T21:00:00Z"), deps: { zone: fixedZone(-300) } };
  return { base, folder, record, ctx, said, found: { folder }, dir: join(base, "work", project) };
}

describe("projectSnapshot: which snapshot the record lists of a project", () => {
  it("is the newest that holds the main project in use's files, or the Reel's by its key, and none for a project in none", (c) => {
    const w = world(c);
    const snapshot = projectSnapshot(w.record);
    assert.deepEqual([snapshot.time, snapshot.dir, snapshot.files.map((f) => f.rel)], [T, `app-snapshot/${T}/${PROJECT}`, ["assets/fonts/a.woff2", "brimm/facts.json", "index.html"]]);
    const reel = { ...w.record, app: { projects: [{ key: "reel 2", name: PROJECT, state: "opened" }] } };
    assert.equal(projectSnapshot(reel, "reel 2").time, T);
    assert.equal(projectSnapshot(reel, "reel 3"), null);
    assert.equal(projectSnapshot(reel), null, "no main project");
    assert.equal(projectSnapshot({ ...w.record, app: undefined }), null);
    assert.equal(projectSnapshot({ ...w.record, files: {} }), null);
  });
  it("is asked of the main project in use and not of one kept for an earlier kind, whichever the record lists first", (c) => {
    const w = world(c);
    const kept = { key: "main", name: PROJECT, state: KEPT };
    const inUse = { key: "main", name: "Pricing talk main 2 3fa9c1", state: "opened" };
    assert.equal(projectSnapshot({ ...w.record, app: { projects: [kept, inUse] } }), null, "the project in use has none, the kept one has");
    assert.equal(projectSnapshot({ ...w.record, app: { projects: [inUse, kept] } }), null);
    assert.equal(projectSnapshot({ ...w.record, app: { projects: [kept, { ...inUse, name: PROJECT }] } }).time, T);
  });
  it("is none for a project whose name leads anywhere but to a folder of its own", (c) => {
    const w = world(c);
    for (const name of ["", ".", "..", "a/b", "../x"]) assert.equal(projectSnapshot({ ...w.record, app: { projects: [{ key: "main", name, state: "opened" }] } }), null, JSON.stringify(name));
  });
});

describe("rebuildHere: the project is made and said", () => {
  it("makes the folder, says it is rebuilt from what the other Mac handed over and that the history stays there, and gives {}", (c) => {
    const w = world(c);
    const snapshot = projectSnapshot(w.record);
    const got = rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot, dir: w.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(got, {});
    assert.deepEqual(w.said, [`The HyperFrames project for ${NAME} is rebuilt on this Mac from what Mac Studio handed over at ${WHEN}. What HyperFrames kept of its history stays on Mac Studio.`]);
    assert.ok(existsSync(join(w.dir, "index.html")) && existsSync(join(w.dir, ".claude", "settings.json")));
  });
  it("names a Reel as the other lines name one, and no Mac for a snapshot this Mac took itself, or one the record names none for", (c) => {
    const w = world(c);
    const snapshot = projectSnapshot(w.record);
    assert.equal(rebuiltWords(w.ctx, { record: w.record, snapshot, name: `Reel 2 of ${NAME}` }), `The HyperFrames project for Reel 2 of ${NAME} is rebuilt on this Mac from what Mac Studio handed over at ${WHEN}. What HyperFrames kept of its history stays on Mac Studio.`);
    const own = `The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`;
    assert.equal(rebuiltWords(w.ctx, { record: { ...w.record, released: { by: "Sallie's laptop" } }, snapshot, name: NAME }), own);
    assert.equal(rebuiltWords(w.ctx, { record: { ...w.record, released: null }, snapshot, name: NAME }), own);
    assert.equal(rebuiltWords(w.ctx, { record: { ...w.record, released: { by: "" } }, snapshot, name: NAME }), own);
  });
  it("says the assets are not in it when the snapshot holds none", (c) => {
    const w = world(c, { files: { "index.html": "<html>" } });
    rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(w.said.slice(1), [ASSETS_NOT_IN]);
    assert.equal(ASSETS_NOT_IN, "Its assets (pictures, music and fonts) were too big to hand over, so they are not in it.");
  });
  it("says the snapshot is not whole, and makes nothing, when a file the record lists is gone or short", (c) => {
    for (const spoil of [(f) => rmSync(f), (f) => writeFileSync(f, "<ht")]) {
      const w = world(c);
      spoil(join(w.folder, "app-snapshot", T, PROJECT, "index.html"));
      const got = rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name: NAME }, { cli: CLI });
      assert.deepEqual([got, w.said, existsSync(w.dir)], [{ code: 1 }, [snapshotNotWhole(NAME)], false]);
      assert.equal(snapshotNotWhole(NAME), `The snapshot of the HyperFrames project for ${NAME} is not whole on this Mac, so it wasn't rebuilt. Ask Jason.`);
    }
  });
  it("says it could not be made, leaving no folder, when a step fails", (c) => {
    const w = world(c);
    const fs = { ...nodeFs, copyFileSync: () => { throw new Error("the disk is full"); } };
    const got = rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name: NAME }, { cli: CLI, fs });
    assert.deepEqual([got, w.said, existsSync(w.dir)], [{ code: 1 }, [`The HyperFrames project for ${NAME} could not be rebuilt on this Mac. Ask Jason.`], false]);
    assert.deepEqual(existsSync(join(w.base, "work")) ? readdirSync(join(w.base, "work")) : [], []);
  });
});

describe("olderHere: a project on this Mac that the other Mac has worked on since", () => {
  /** The project's folder with `mtime` as the time of its newest file. */
  function projectAt(w, mtime) {
    mkdirSync(join(w.dir, "compositions"), { recursive: true });
    for (const rel of ["index.html", "brimm/facts.json", "compositions/a.html"]) {
      mkdirSync(dirname(join(w.dir, rel)), { recursive: true });
      writeFileSync(join(w.dir, rel), "x");
      utimesSync(join(w.dir, rel), new Date(mtime), new Date(mtime));
    }
  }
  const SNAP = Date.parse("2026-10-20T14:00:00Z");
  it("is true when its newest file is more than 2 seconds older than the snapshot's, and false when it is as new or newer", (c) => {
    for (const [mtime, older] of [[SNAP - 60000, true], [SNAP - 2100, true], [SNAP - 1900, false], [SNAP, false], [SNAP + 5000, false]]) {
      const w = world(c);
      projectAt(w, mtime);
      assert.equal(olderHere(w.found, { record: w.record, project: w.record.app.projects[0], dir: w.dir }), older, String(mtime - SNAP));
    }
  });
  it("is false when the record lists no snapshot of it, or the snapshot is not whole here, or the project cannot be read: nothing says it is older", (c) => {
    const w = world(c);
    projectAt(w, SNAP - 60000);
    const project = w.record.app.projects[0];
    assert.equal(olderHere(w.found, { record: { ...w.record, files: {} }, project, dir: w.dir }), false);
    rmSync(join(w.folder, "app-snapshot", T, PROJECT, "index.html"));
    assert.equal(olderHere(w.found, { record: w.record, project, dir: w.dir }), false);
    const x = world(c);
    projectAt(x, SNAP - 60000);
    if (process.getuid && process.getuid() !== 0) {
      chmodSync(join(x.dir, "compositions"), 0o000);
      assert.equal(olderHere(x.found, { record: x.record, project: x.record.app.projects[0], dir: x.dir }), false);
      chmodSync(join(x.dir, "compositions"), 0o755);
    }
    assert.equal(olderHere(x.found, { record: x.record, project: x.record.app.projects[0], dir: join(x.base, "none") }), false, "a folder that is not there");
  });
  it("says what it says in words that hold no path", () => {
    assert.equal(olderThanSnapshot(NAME), `The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`);
    assert.equal(olderThanSnapshot(`Reel 2 of ${NAME}`), `The HyperFrames project for Reel 2 of ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`);
  });
});
