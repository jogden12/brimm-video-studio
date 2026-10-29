// The parts of app.js that rebuild a project from the other Mac's snapshot, on their own (plan PR 11; architecture 2026-10-27, 4.7 and 5.6):
// which snapshot the record lists of a project, the rebuild and what it says, and whether a project here is older than its snapshot.
// edit-take-over-app.test.js runs all of it through editMain with two Macs; these tests give each function a made-up record and a folder
// in the test's own temporary folder, and no program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ASSETS_NOT_IN, KEPT, copyFits, olderHere, olderMarked, olderThanSnapshot, plainName, projectSnapshot, quitWords, rebuildHere, rebuiltWords, snapshotNotWhole } from "../app.js";
import { fixedZone } from "../exports.js";
import { ASIDE_DIR, timeName, writeMarker } from "../snapshot.js";

const T = "2026-10-20 20.00.00Z";
const WHEN = "2026-10-20 15:00";
const NAME = "Pricing talk";
const PROJECT = "Pricing talk main 3fa9c1";
const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";

/** A temporary folder that goes when the test does, with the episode's folder in it and a project's folder beside it. */
function world(c, { files = { "index.html": "<html>", "brimm/facts.json": "{}", "assets/fonts/a.woff2": "font" }, project = PROJECT, maker = "Mac Studio" } = {}) {
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
  // The record's own revisions say who listed the snapshot first (snapshot.js listedBy): `maker`, or nobody's when it is null.
  if (maker !== null) {
    mkdirSync(join(folder, "record"), { recursive: true });
    for (const [n, files, by] of [[1, {}, "Mac Studio"], [2, listed, maker]]) writeFileSync(join(folder, "record", `000${n}.json`), JSON.stringify({ rev: n, files, writer: { commit: "c709b57", on: by } }));
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
    assert.equal(rebuiltWords(w.ctx, { snapshot, name: `Reel 2 of ${NAME}`, by: "Mac Studio" }), `The HyperFrames project for Reel 2 of ${NAME} is rebuilt on this Mac from what Mac Studio handed over at ${WHEN}. What HyperFrames kept of its history stays on Mac Studio.`);
    const own = `The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`;
    assert.equal(rebuiltWords(w.ctx, { snapshot, name: NAME, by: "Sallie's laptop" }), own);
    assert.equal(rebuiltWords(w.ctx, { snapshot, name: NAME, by: "" }), own);
    assert.equal(rebuiltWords(w.ctx, { snapshot, name: NAME }), own);
  });
  it("names the Mac that made the snapshot, as the record's revisions give it, and not the Mac that released last (the review of PR 11, M5)", (c) => {
    // Mac Studio made this project's snapshot; the record's last release was the laptop's, of other projects.
    const w = world(c, { maker: "Mac Studio" });
    const record = { ...w.record, released: { by: "Sallie's laptop" } };
    rebuildHere(w.ctx, { found: w.found, record, snapshot: projectSnapshot(record), dir: w.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(w.said.slice(0, 1), [`The HyperFrames project for ${NAME} is rebuilt on this Mac from what Mac Studio handed over at ${WHEN}. What HyperFrames kept of its history stays on Mac Studio.`]);
    // And the other way: this Mac made it, while the record's last release was the other Mac's.
    const mine = world(c, { maker: "Sallie's laptop" });
    const other = { ...mine.record, released: { by: "Mac Studio" } };
    rebuildHere(mine.ctx, { found: mine.found, record: other, snapshot: projectSnapshot(other), dir: mine.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(mine.said.slice(0, 1), [`The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`]);
    // The record's revisions are not there: no Mac is named.
    const nobody = world(c, { maker: null });
    rebuildHere(nobody.ctx, { found: nobody.found, record: nobody.record, snapshot: projectSnapshot(nobody.record), dir: nobody.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(nobody.said.slice(0, 1), [`The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`]);
  });
  it("says the assets are not in it when the snapshot holds the note that says they were left out, and says nothing of them otherwise", (c) => {
    const w = world(c, { files: { "index.html": "<html>", "assets/left-out.txt": "left out" } });
    rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(w.said.slice(1), [ASSETS_NOT_IN]);
    assert.equal(ASSETS_NOT_IN, "Its assets (pictures, music and video) were too big to hand over, so they are not in it.");
    const none = world(c, { files: { "index.html": "<html>" } });
    rebuildHere(none.ctx, { found: none.found, record: none.record, snapshot: projectSnapshot(none.record), dir: none.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(none.said.slice(1), []);
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

// --- An older project folder is set aside, and the project rebuilt (plan PR 18) ---

const OLDER_FILES = { "index.html": "<html>older", "compositions/second.html": "<div>mine", "media/recording.mp4": "the working copy", ".hyperframes/app-history.jsonl": "{}", "renders/old.mp4": "a render" };
const T0 = "2026-10-20 19.00.00Z";
/** `world` with the older project in its place in the work folder, last handed over as T0, and where it is to be set aside to. */
function olderWorld(c, over = {}) {
  const w = world(c, over);
  for (const [rel, text] of Object.entries(OLDER_FILES)) {
    mkdirSync(dirname(join(w.dir, rel)), { recursive: true });
    writeFileSync(join(w.dir, rel), text);
  }
  writeMarker(w.dir, T0, "Mac Studio");
  const aside = join(w.base, "work", ASIDE_DIR, `${PROJECT} ${timeName(w.ctx.now())}`);
  const treeOf = () => Object.fromEntries(readdirSync(w.dir, { recursive: true }).sort().map((rel) => [rel, lstatSync(join(w.dir, rel)).isDirectory() ? "dir" : readFileSync(join(w.dir, rel), "utf8")]));
  return { ...w, aside, before: treeOf(), ino: lstatSync(w.dir).ino };
}
const askFor = (w, name = NAME, deps = { cli: CLI }) => rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name, older: true }, deps);
const STUCK_FS = (w) => ({ ...nodeFs, renameSync: (from, to) => (to === w.dir ? (() => { throw new Error("EACCES: permission denied"); })() : nodeFs.renameSync(from, to)) });

describe("rebuildHere, given an older folder to set aside (plan PR 18)", () => {
  const SET_ASIDE = (name) => `The older HyperFrames project for ${name} was set aside on this Mac, and nothing was deleted.`;
  const REBUILT = (name, by = "Mac Studio") => `The HyperFrames project for ${name} is rebuilt on this Mac from what ${by} handed over at ${WHEN}. What HyperFrames kept of its history stays on ${by}.`;
  it("sets the older folder aside, rebuilds the project in its place, and says that first and then what it says of any rebuild, giving where the older folder went", (c) => {
    const w = olderWorld(c);
    const got = askFor(w);
    assert.deepEqual(got, { aside: w.aside });
    assert.deepEqual(w.said, [SET_ASIDE(NAME), REBUILT(NAME)]);
    assert.equal(w.aside, join(w.base, "work", "set aside", `${PROJECT} 2026-10-20 21.00.00Z`), "named by the project and the moment of the clock it is given");
    assert.equal(lstatSync(w.aside).ino, w.ino, "the very folder");
    assert.equal(readFileSync(join(w.aside, "compositions", "second.html"), "utf8"), "<div>mine");
    assert.equal(readFileSync(join(w.aside, "media", "recording.mp4"), "utf8"), "the working copy");
    assert.equal(readFileSync(join(w.dir, "index.html"), "utf8"), "<html>");
    assert.equal(existsSync(join(w.dir, "compositions", "second.html")), false);
    assert.equal(existsSync(join(w.dir, "media")), false);
  });
  it("names a Reel as its other lines name one, and says the assets were left out after the rebuilt line", (c) => {
    const w = olderWorld(c, { files: { "index.html": "<html>", "assets/left-out.txt": "left out" } });
    assert.deepEqual(askFor(w, `Reel 2 of ${NAME}`), { aside: w.aside });
    assert.deepEqual(w.said, [SET_ASIDE(`Reel 2 of ${NAME}`), REBUILT(`Reel 2 of ${NAME}`), ASSETS_NOT_IN]);
  });
  it("names no Mac for a snapshot this Mac took itself, as a rebuild does", (c) => {
    const w = olderWorld(c, { maker: "Sallie's laptop" });
    askFor(w);
    assert.deepEqual(w.said, [SET_ASIDE(NAME), `The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`]);
  });
  it("leaves the older folder where it was, and says so, when the snapshot is not whole", (c) => {
    for (const spoil of [(f) => rmSync(f), (f) => writeFileSync(f, "<ht")]) {
      const w = olderWorld(c);
      spoil(join(w.folder, "app-snapshot", T, PROJECT, "index.html"));
      assert.deepEqual(askFor(w), { code: 1 });
      assert.deepEqual(w.said, [`The snapshot of the HyperFrames project for ${NAME} is not whole on this Mac, so the older project was left where it was. Ask Jason.`]);
      assert.equal(lstatSync(w.dir).ino, w.ino);
      assert.equal(readFileSync(join(w.dir, "index.html"), "utf8"), "<html>older");
      assert.equal(existsSync(join(w.base, "work", ASIDE_DIR)), false);
    }
  });
  it("leaves the older folder where it was, and says so, when a write fails", (c) => {
    const w = olderWorld(c);
    const fs = { ...nodeFs, copyFileSync: () => { throw new Error("the disk is full"); } };
    assert.deepEqual(askFor(w, NAME, { cli: CLI, fs }), { code: 1 });
    assert.deepEqual(w.said, [`The HyperFrames project for ${NAME} could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.`]);
    assert.equal(lstatSync(w.dir).ino, w.ino);
    assert.deepEqual(readdirSync(join(w.base, "work")), [PROJECT], "nothing of its own is left");
  });
  it("puts the older folder back when the rebuilt project cannot take its place, and says it was left where it was", (c) => {
    const w = olderWorld(c);
    const fs = { ...nodeFs, renameSync: (from, to) => (to === w.dir && from !== w.aside ? (() => { throw new Error("EACCES: permission denied"); })() : nodeFs.renameSync(from, to)) };
    assert.deepEqual(askFor(w, NAME, { cli: CLI, fs }), { code: 1 });
    assert.deepEqual(w.said, [`The HyperFrames project for ${NAME} could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.`]);
    assert.equal(lstatSync(w.dir).ino, w.ino);
    assert.equal(readFileSync(join(w.dir, "compositions", "second.html"), "utf8"), "<div>mine");
  });
  it("says that the older project was set aside, and nothing deleted, when even putting it back fails", (c) => {
    const w = olderWorld(c);
    assert.deepEqual(askFor(w, NAME, { cli: CLI, fs: STUCK_FS(w) }), { code: 1 });
    assert.deepEqual(w.said, [`The older HyperFrames project for ${NAME} was set aside on this Mac and nothing was deleted, but the rebuilt one could not be put in its place. Ask Jason.`]);
    assert.equal(lstatSync(w.aside).ino, w.ino);
    assert.equal(readFileSync(join(w.aside, "compositions", "second.html"), "utf8"), "<div>mine");
  });
  it("moves nothing, and says it could not, when no name is free to set it aside under", (c) => {
    const w = olderWorld(c);
    for (let second = 0; second < 100; second++) mkdirSync(join(w.base, "work", ASIDE_DIR, `${PROJECT} ${timeName(w.ctx.now() + second * 1000)}`), { recursive: true });
    assert.deepEqual(askFor(w), { code: 1 });
    assert.deepEqual(w.said, [`The HyperFrames project for ${NAME} could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.`]);
    assert.equal(lstatSync(w.dir).ino, w.ino);
  });
  it("is the rebuild it was when it is not given an older folder: nothing is set aside, and the words are the rebuild's alone", (c) => {
    const w = world(c);
    const got = rebuildHere(w.ctx, { found: w.found, record: w.record, snapshot: projectSnapshot(w.record), dir: w.dir, name: NAME }, { cli: CLI });
    assert.deepEqual(got, {});
    assert.deepEqual(w.said, [REBUILT(NAME)]);
    assert.equal(existsSync(join(w.base, "work", ASIDE_DIR)), false);
  });
});

describe("olderMarked: an older project by its marker's word alone (plan PR 18)", () => {
  /** The newest snapshot is T; the project's marker names `time`, when it is given one. */
  function markedAs(c, time, { old = false } = {}) {
    const w = world(c);
    mkdirSync(w.dir, { recursive: true });
    writeFileSync(join(w.dir, "index.html"), "x");
    if (old) utimesSync(join(w.dir, "index.html"), new Date("2020-01-01T00:00:00Z"), new Date("2020-01-01T00:00:00Z"));
    if (time) writeMarker(w.dir, time, "Mac Studio");
    return w;
  }
  const ask = (w, record = w.record) => olderMarked(w.found, { record, project: w.record.app.projects[0], dir: w.dir });
  it("is true when the marker names another snapshot than the newest the record lists, or one it lists no more", (c) => {
    assert.equal(ask(markedAs(c, T0)), true);
    assert.equal(ask(markedAs(c, "2026-10-01 08.00.00Z")), true);
  });
  it("is false for the newest, and for a project with no marker however old its files are: only the marker's word counts", (c) => {
    assert.equal(ask(markedAs(c, T)), false);
    const bare = markedAs(c, null, { old: true });
    assert.equal(ask(bare), false);
    assert.equal(olderHere(bare.found, { record: bare.record, project: bare.record.app.projects[0], dir: bare.dir }), true, "which olderHere takes for older, to refuse it");
  });
  it("is false when the record lists no snapshot of the project", (c) => {
    const w = markedAs(c, T0);
    assert.equal(ask(w, { ...w.record, files: {} }), false);
  });
  it("goes by the snapshots the record lists of the project: older for one it lists that is not the newest, and for one dropped that was named before them; not for one it never listed that is named after the newest, which may be newer work", (c) => {
    const w = markedAs(c, T);
    const second = "2026-10-20 20.05.00Z";
    const listed = { ...w.record, files: { ...w.record.files, [`app-snapshot/${second}/${PROJECT}/index.html`]: 6 } };
    assert.equal(ask(w, listed), true, "T is listed, and the second is listed after it");
    writeMarker(w.dir, "2026-10-20 18.00.00Z", "Mac Studio");
    assert.equal(ask(w, listed), true, "dropped, and named before both");
    writeMarker(w.dir, "2026-10-21 08.00.00Z", "Mac Studio");
    assert.equal(ask(w, listed), false, "never listed, and named after both");
    assert.equal(ask(w), false, "never listed, and named after the only one the record lists");
    writeMarker(w.dir, "2026-10-20 20.02.00Z", "Mac Studio");
    assert.equal(ask(w, listed), false, "never listed, and named between the two");
    writeMarker(w.dir, second, "Mac Studio");
    assert.equal(ask(w, listed), false, "the newest");
  });
});

describe("quitWords: whether HyperFrames must be quit before an older folder is set aside (plan PR 18)", () => {
  const QUIT = "Quit HyperFrames first, so that the older project can be set aside, then say it again. Nothing was changed.";
  const CANT_TELL = "I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was changed.";
  it("is nothing when HyperFrames is not running, and asks for the program by the name it runs as", async () => {
    const asked = [];
    assert.equal(await quitWords(async (name) => (asked.push(name), false)), "");
    assert.equal(await quitWords(() => false), "", "an answer that is not a promise");
    assert.deepEqual(asked, ["HyperFrames"]);
  });
  it("tells her to quit it when it is running, in release's and free's words", async () => {
    assert.equal(await quitWords(async () => true), QUIT);
    assert.equal(await quitWords(() => true), QUIT);
  });
  it("says it cannot tell for anything that is not a plain no or yes: a throw, a rejection, null, nothing, text, and no way to ask", async () => {
    for (const running of [() => { throw new Error("pgrep is not here"); }, async () => { throw new Error("stopped"); }, async () => null, async () => undefined, async () => "no", async () => 0, undefined, null]) assert.equal(await quitWords(running), CANT_TELL, String(running));
  });
});

describe("plainName: a set-aside folder is no project's folder (plan PR 18)", () => {
  it("refuses the set-aside folder's name in any case, as the volume takes them for one, and still takes the names it took", () => {
    for (const name of ["set aside", "Set Aside", "SET ASIDE"]) assert.equal(plainName(name), false, name);
    for (const name of ["Pricing talk main 3fa9c1", "set aside 2", "my set aside", "set  aside", "reel 2", "a b"]) assert.equal(plainName(name), true, name);
    for (const name of ["", ".", "..", "a/b", "a\0b", undefined, null, 7]) assert.equal(plainName(name), false, String(name));
    assert.equal(ASIDE_DIR, "set aside");
  });
});

describe("copyFits: a working copy against the project's own facts, the check every video put back has (plan PR 15, PR 18)", () => {
  const was = { seconds: 23, width: 1280, height: 720 };
  const made = { seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: 16 };
  it("gives what the record keeps of the copy when its picture is the project's, its length is within a second of the project's and the file is as large as its facts say", () => {
    assert.deepEqual(copyFits({ was, made, size: 16 }), { workingCopy: { bytes: 16, seconds: 23.423, fps: 30 } });
    assert.deepEqual(copyFits({ was, made: { ...made, seconds: 24 }, size: 16 }), { workingCopy: { bytes: 16, seconds: 24, fps: 30 } }, "a second either way is the job's own allowance");
    assert.deepEqual(copyFits({ was, made: { ...made, seconds: 22 }, size: 16 }).workingCopy.seconds, 22);
    assert.deepEqual(copyFits({ was, made: { ...made, fps: "30000/1001" }, size: 16 }).workingCopy.fps, "30000/1001");
  });
  it("says `other` for a copy of another width, height or length, or for a Reel that starts elsewhere", () => {
    for (const over of [{ width: 1920 }, { height: 1080 }, { seconds: 24.01 }, { seconds: 21.99 }]) assert.deepEqual(copyFits({ was, made: { ...made, ...over }, size: 16 }), { no: "other" }, JSON.stringify(over));
    assert.deepEqual(copyFits({ was, made, size: 16, starts: false }), { no: "other" });
    assert.deepEqual(copyFits({ was, made, size: 16, starts: true }), { workingCopy: { bytes: 16, seconds: 23.423, fps: 30 } });
  });
  it("says `project` when the project's own facts say nothing usable of its picture and length", () => {
    for (const none of [null, undefined, {}, { seconds: 0, width: 1280, height: 720 }, { seconds: 23, width: 0, height: 720 }, { seconds: 23, width: 1280 }, "text"]) assert.deepEqual(copyFits({ was: none, made, size: 16 }), { no: "project" }, JSON.stringify(none));
  });
  it("says `copy` when the copy's facts say nothing the record can keep, or the file is not as large as they say, or is not there", () => {
    for (const none of [null, undefined, {}, { ...made, bytes: -1 }, { ...made, fps: 0 }, { ...made, seconds: 0 }, { ...made, width: undefined }]) assert.deepEqual(copyFits({ was, made: none, size: 16 }), { no: "copy" }, JSON.stringify(none));
    for (const size of [15, 17, 0, undefined]) assert.deepEqual(copyFits({ was, made, size }), { no: "copy" }, String(size));
  });
  it("judges in this order: the project's facts, the copy's, the picture and length, and last the size, as PR 15 words them", () => {
    assert.deepEqual(copyFits({ was: null, made: null, size: 1 }), { no: "project" });
    assert.deepEqual(copyFits({ was, made: null, size: 1 }), { no: "copy" });
    assert.deepEqual(copyFits({ was, made: { ...made, width: 1920 }, size: 1 }), { no: "other" }, "another picture, and a size that is wrong too, is the picture's");
  });
});
