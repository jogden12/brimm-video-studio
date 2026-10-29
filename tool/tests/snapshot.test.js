// What a HyperFrames project's snapshot holds, how it is named and found in an episode's record, and when a project is older than it
// (architecture 2026-10-27, sections 4.7, 7.3 and F12; plan PR 11, groups A and B). The module reads a project's folder and the
// record's list of files; it runs no program and writes nothing here but the project it rebuilds. Every folder is a temporary one.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fsModule from "node:fs";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cliPath } from "../hyperframes.js";
import { projectFiles, settingsText, writeProject } from "../project.js";
import {
  ASSETS_MOST, BEHIND_MS, MARKER, SNAPSHOTS_KEPT, SNAPSHOT_DIR, SNAPSHOT_MOST, behindSnapshot, holds, keptSnapshots, momentText, notSynced, olderThan, readMarker, rebuildProject, snapshotFiles, snapshotOf, snapshotStats, snapshotsOf,
  timeName, timeOf, writeMarker
} from "../snapshot.js";

const GUIDANCE = readFileSync(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url), "utf8");

/** A temporary folder that goes when the test does. */
function scratch(c) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-snapshot-"));
  c.after(() => {
    try {
      chmodSync(join(dir, "project", "unreadable"), 0o755);
    } catch (e) {
      // There was none.
    }
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
const put = (dir, rel, text = "x") => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
};
const relsOf = (got) => got.files.map((f) => f.rel);

/** What `app` writes for a main video (project.js), in a folder of its own: the input is the one project.test.js gives. */
function madeProject(dir, over = {}) {
  const from = join(dir, "..", `${Math.random()}.mp4`);
  writeFileSync(from, "the working copy");
  const files = projectFiles({
    kind: "main", name: "Pricing talk", part: "main", id: "e-20261014-3fa9c1", facts: { seconds: 6, fps: 30, width: 1920, height: 1080, bytes: 16 },
    words: [{ w: "Pricing", start: 0.5, end: 1.1 }, { w: "matters.", start: 1.2, end: 1.9 }], spellings: [], plan: { by: "rules", phrases: [] }, reels: [],
    guidance: GUIDANCE, video: from, cli: cliPath("/Users/sallie"), logos: [], createdAt: "2026-10-28T15:00:00.000Z", ...over
  });
  writeProject(dir, files);
  return files;
}

describe("a snapshot's files (7.3)", () => {
  it("are the project's files but media, node_modules, renders, snapshots and the names that start with a dot: a main project made by `app` holds exactly its file set less three, and the app's own compositions and assets", (c) => {
    const dir = join(scratch(c), "Pricing talk main 3fa9c1");
    const made = madeProject(dir);
    // What the app and its assistant add: a composition, an asset, and their own folders.
    put(dir, "compositions/title-card.html", "<div>Pricing</div>");
    put(dir, "assets/brand-kit/mark.png", "png");
    put(dir, ".hyperframes/app-history.jsonl", "{}");
    put(dir, ".hyperframes/history-id", "id");
    put(dir, "renders/Pricing talk main 3fa9c1_2026-10-28_15-16-40.meta.json", "{}");
    put(dir, "snapshots/frame.png", "png");
    put(dir, ".thumbnails/t.jpg", "jpg");
    put(dir, ".transcode-cache/c.mp4", "mp4");
    put(dir, ".DS_Store", "");
    const got = snapshotFiles(dir);
    const expected = [...made.keys()].filter((path) => ![".claude/settings.json", "media/recording.mp4", "node_modules/.bin/hyperframes"].includes(path));
    assert.deepEqual(relsOf(got), [...expected, "compositions/title-card.html", "assets/brand-kit/mark.png"].sort());
    assert.ok(relsOf(got).includes("brimm/facts.json") && relsOf(got).includes("CLAUDE.md") && relsOf(got).includes("vendor/gsap.min.js"));
    // The three it leaves out of the set are not there, and nothing of the dot-named, whatever the depth.
    for (const rel of relsOf(got)) {
      assert.ok(!rel.split("/").some((name) => name.startsWith(".")), rel);
      assert.ok(!/^(?:media|node_modules|renders|snapshots)\//.test(rel), rel);
    }
  });
  it("is the same for a Reel: its face track goes with it when it has one", (c) => {
    const dir = join(scratch(c), "Pricing talk reel 2 3fa9c1");
    madeProject(dir, { kind: "reel", part: { reel: 2 }, stretch: { start: 0.4, end: 4 }, faces: { every: 2, stills: [{ file: "0001.jpg", faces: [{ x: 0.4, y: 0.2, w: 0.2, h: 0.3 }] }] }, plan: undefined });
    const got = relsOf(snapshotFiles(dir));
    assert.ok(got.includes("brimm/face-track.json"));
    assert.ok(!got.includes("brimm/cut-suggestions.json") && !got.includes("brimm/reel-suggestions.json"));
  });
  it("leaves out a folder of one of those names only at the project's top level: deeper it is the project's own", (c) => {
    const dir = scratch(c);
    put(dir, "media/recording.mp4");
    put(dir, "compositions/media/clip.html");
    put(dir, "assets/renders/card.png");
    put(dir, "compositions/node_modules/x.js");
    put(dir, "renders/a.mp4");
    put(dir, "node_modules/.bin/hyperframes");
    put(dir, "snapshots/s.png");
    assert.deepEqual(relsOf(snapshotFiles(dir)), ["assets/renders/card.png", "compositions/media/clip.html", "compositions/node_modules/x.js"]);
  });
  it("leaves out any name that starts with a dot at any depth, a .env among them, since Dropbox does not sync such names and the other Mac would wait for them", (c) => {
    const dir = scratch(c);
    for (const rel of [".env", ".env.local", ".claude/settings.json", "brimm/.hidden.json", "compositions/.DS_Store", "assets/.cache/x.png", ".hyperframes/history-id"]) put(dir, rel);
    put(dir, "index.html");
    assert.deepEqual(relsOf(snapshotFiles(dir)), ["index.html"]);
  });
  it("neither follows nor lists a link: a link to a file, a link to a folder, and a link to a place outside", (c) => {
    const base = scratch(c);
    const dir = join(base, "project");
    put(dir, "index.html");
    put(base, "outside/secret.txt", "not the project's");
    symlinkSync(join(base, "outside", "secret.txt"), join(dir, "linked.txt"));
    symlinkSync(join(base, "outside"), join(dir, "compositions"));
    symlinkSync("index.html", join(dir, "same.html"));
    assert.deepEqual(relsOf(snapshotFiles(dir)), ["index.html"]);
  });
  it("gives each file as { rel, bytes, mtimeMs } in path order, and the total of what it lists", (c) => {
    const dir = scratch(c);
    put(dir, "b/two.txt", "22");
    put(dir, "a.txt", "1");
    put(dir, "b/one.txt", "333");
    utimesSync(join(dir, "a.txt"), new Date("2026-10-20T14:00:00Z"), new Date("2026-10-20T14:00:00Z"));
    const got = snapshotFiles(dir);
    assert.deepEqual(got.files.map((f) => [f.rel, f.bytes]), [["a.txt", 1], ["b/one.txt", 3], ["b/two.txt", 2]]);
    assert.equal(got.files[0].mtimeMs, Date.parse("2026-10-20T14:00:00Z"));
    assert.equal(got.bytes, 6);
    assert.deepEqual(got.assets, { any: false, bytes: 0, left: false });
  });
  it("carries assets while they are small: at the limit they go, one byte over they are left out whole, fonts and all, and the rest goes on", (c) => {
    const dir = scratch(c);
    put(dir, "index.html", "<html>");
    put(dir, "assets/fonts/a.woff2", "12345");
    put(dir, "assets/music.mp3", "123456");
    const at = snapshotFiles(dir, { assetsMost: 11 });
    assert.deepEqual(relsOf(at), ["assets/fonts/a.woff2", "assets/music.mp3", "index.html"]);
    assert.deepEqual(at.assets, { any: true, bytes: 11, left: false });
    const over = snapshotFiles(dir, { assetsMost: 10 });
    assert.deepEqual(relsOf(over), ["index.html"]);
    assert.deepEqual(over.assets, { any: true, bytes: 11, left: true });
    assert.equal(over.bytes, 6, "the total counts what is listed");
  });
  it("sets its limits at 50 MB for assets and 100 MB for the whole, two snapshots kept, and 2 seconds for a project to be older", (c) => {
    assert.deepEqual([ASSETS_MOST, SNAPSHOT_MOST, SNAPSHOTS_KEPT, BEHIND_MS, SNAPSHOT_DIR], [50 * 1024 * 1024, 100 * 1024 * 1024, 2, 2000, "app-snapshot"]);
    const dir = scratch(c);
    put(dir, "index.html");
    put(dir, "assets/at-the-limit.mov");
    truncateSync(join(dir, "assets", "at-the-limit.mov"), ASSETS_MOST);
    assert.equal(snapshotFiles(dir).assets.left, false);
    truncateSync(join(dir, "assets", "at-the-limit.mov"), ASSETS_MOST + 1);
    assert.equal(snapshotFiles(dir).assets.left, true);
  });
  it("is { unreadable } for a folder that is not there, a file, a link to a folder, and a folder or a part of it that cannot be read", (c) => {
    const base = scratch(c);
    put(base, "file.txt");
    mkdirSync(join(base, "real"));
    symlinkSync(join(base, "real"), join(base, "link"));
    for (const dir of [join(base, "none"), join(base, "file.txt"), join(base, "link")]) assert.deepEqual(snapshotFiles(dir), { unreadable: true }, dir);
    if (process.getuid && process.getuid() !== 0) {
      put(base, "project/index.html");
      put(base, "project/unreadable/x.txt");
      chmodSync(join(base, "project", "unreadable"), 0o000);
      assert.deepEqual(snapshotFiles(join(base, "project")), { unreadable: true }, "part of a project that cannot be read is no half snapshot");
      chmodSync(join(base, "project", "unreadable"), 0o755);
    }
  });
});

describe("holds: the paths a snapshot has, and a rebuild takes", () => {
  it("takes a relative path of plain names that is not under a left-out folder at the top and starts no name with a dot", () => {
    for (const rel of ["index.html", "brimm/facts.json", "compositions/media/x.html", "assets/fonts/a.woff2"]) assert.equal(holds(rel), true, rel);
    for (const rel of ["", "/index.html", "../index.html", "a/../b", "a//b", "a/./b", ".env", ".claude/settings.json", "a/.hidden", "media/recording.mp4", "node_modules/.bin/hyperframes", "renders/a.mp4", "snapshots/s.png", "media", 5, null, undefined]) assert.equal(holds(rel), false, String(rel));
  });
  it("leaves out the names Dropbox never syncs: Finder's Icon\r with the names that start with a dot, one list for the snapshot and the Final Cut copies (the review of PR 11, M2)", (c) => {
    for (const name of [".DS_Store", ".env", ".hyperframes", "Icon\r"]) assert.equal(notSynced(name), true, JSON.stringify(name));
    for (const name of ["Icon", "icon\r", "Icon\r.png", "index.html", "a.b"]) assert.equal(notSynced(name), false, JSON.stringify(name));
    for (const rel of ["Icon\r", "assets/Icon\r", "assets/Icon\r/x.png"]) assert.equal(holds(rel), false, JSON.stringify(rel));
    const dir = scratch(c);
    put(dir, "index.html");
    put(dir, "Icon\r");
    put(dir, "assets/Icon\r");
    put(dir, "assets/fonts/a.woff2");
    assert.deepEqual(relsOf(snapshotFiles(dir)), ["assets/fonts/a.woff2", "index.html"]);
  });
});

describe("a snapshot's name (7.3)", () => {
  it("is the moment in UTC, to the second: 2026-10-20 20.00.00Z", () => {
    assert.equal(timeName(Date.parse("2026-10-20T15:00:00-05:00")), "2026-10-20 20.00.00Z");
    assert.equal(timeName(Date.parse("2026-01-02T03:04:05Z")), "2026-01-02 03.04.05Z");
  });
  it("is read back to the second, and nothing else is read: a local time, a missing Z, a day that is not one, a colon", () => {
    assert.equal(timeOf("2026-10-20 20.00.00Z"), Date.parse("2026-10-20T20:00:00Z"));
    for (const name of ["2026-10-20 20.00.00", "2026-10-20 15.00.00-05.00", "2026-02-30 20.00.00Z", "2026-10-20 25.00.00Z", "2026-10-20 20:00:00Z", "yesterday", "", "2026-10-20 20.00Z", null, 5]) assert.equal(timeOf(name), null, String(name));
  });
  it("sorts as the moments do, whatever the zone", () => {
    const names = [Date.parse("2026-11-01T05:30:00Z"), Date.parse("2026-11-01T06:30:00Z"), Date.parse("2026-10-31T23:59:59Z")].map(timeName);
    assert.deepEqual([...names].sort(), [names[2], names[0], names[1]]);
  });
});

describe("the snapshots an episode's record lists (7.3)", () => {
  const T1 = "2026-10-20 20.00.00Z";
  const T2 = "2026-10-21 09.30.00Z";
  const MAIN = "Pricing talk main 3fa9c1";
  const REEL = "Pricing talk reel 2 3fa9c1";
  const listed = {
    "Pricing talk.mp4": 10, "record/0001.json": 5,
    [`app-snapshot/${T1}/${MAIN}/index.html`]: 100, [`app-snapshot/${T1}/${MAIN}/brimm/facts.json`]: 50,
    [`app-snapshot/${T2}/${MAIN}/index.html`]: 110, [`app-snapshot/${T2}/${REEL}/index.html`]: 20, [`app-snapshot/${T2}/${REEL}/brimm/facts.json`]: 30,
    "edit/from-hyperframes/Pricing talk main 3fa9c1 2026-10-20 13.56.mp4": 9
  };
  it("are found by their paths, newest first, each with the files it holds for each project", () => {
    const got = snapshotsOf(listed);
    assert.deepEqual(got.map((s) => s.time), [T2, T1]);
    assert.deepEqual(got[0].ms, Date.parse("2026-10-21T09:30:00Z"));
    assert.deepEqual(got[0].projects[MAIN], [{ rel: "index.html", bytes: 110 }]);
    assert.deepEqual(got[0].projects[REEL], [{ rel: "brimm/facts.json", bytes: 30 }, { rel: "index.html", bytes: 20 }]);
    assert.deepEqual(got[1].projects[MAIN], [{ rel: "brimm/facts.json", bytes: 50 }, { rel: "index.html", bytes: 100 }]);
  });
  it("pass over a path that is not under app-snapshot/<time>/<name>/<file>: other places, a time that is not one, an empty name, a name or file that leaves the folder, and no file", () => {
    const odd = {
      "app-snapshot/index.html": 1, [`app-snapshot/${T1}`]: 1, [`app-snapshot/${T1}/${MAIN}`]: 1, "app-snapshot/yesterday/P/index.html": 1,
      [`app-snapshot/${T1}//index.html`]: 1, [`app-snapshot/${T1}/../x/index.html`]: 1, [`app-snapshot/${T1}/${MAIN}/../../x.html`]: 1, [`app-snapshot/${T1}/${MAIN}//x.html`]: 1,
      [`other/${T1}/${MAIN}/index.html`]: 1
    };
    assert.deepEqual(snapshotsOf(odd), []);
    assert.deepEqual(snapshotsOf({}), []);
    assert.deepEqual(snapshotsOf(undefined), []);
  });
  it("name the newest snapshot that holds a project's files, with where it is, and none for a project in none", () => {
    const main = snapshotOf(listed, MAIN);
    assert.deepEqual([main.time, main.dir, main.files], [T2, `app-snapshot/${T2}/${MAIN}`, [{ rel: "index.html", bytes: 110 }]]);
    const reel = snapshotOf(listed, REEL);
    assert.deepEqual([reel.time, reel.dir], [T2, `app-snapshot/${T2}/${REEL}`]);
    assert.equal(snapshotOf(listed, "Pricing talk reel 3 3fa9c1"), null);
    assert.equal(snapshotOf({ [`app-snapshot/${T1}/${MAIN}/index.html`]: 1 }, REEL), null);
    assert.equal(snapshotOf({}, MAIN), null);
  });
  it("never take one project for another whose name it begins: \"main\" is not \"main 2\"", () => {
    const files = { [`app-snapshot/${T1}/Pricing talk main 2 3fa9c1/index.html`]: 5 };
    assert.equal(snapshotOf(files, "Pricing talk main 3fa9c1"), null);
    assert.equal(snapshotOf(files, "Pricing talk main 2 3fa9c1").files.length, 1);
    assert.equal(snapshotOf({ [`app-snapshot/${T1}/${MAIN}/index.html`]: 5 }, "Pricing talk main 3fa9c1/index.html"), null);
  });
  it("order the snapshots by the record's own order of listing, not by the clock that named them: the one listed last is the newest (the review of PR 11, I1)", () => {
    // The laptop's clock is behind: its snapshot, listed after Mac Studio's, is named a quarter of an hour before it.
    const behind = { [`app-snapshot/${T2}/${MAIN}/index.html`]: 1, [`app-snapshot/${T1}/${MAIN}/index.html`]: 2 };
    assert.deepEqual(snapshotsOf(behind).map((s) => s.time), [T1, T2]);
    assert.equal(snapshotOf(behind, MAIN).time, T1);
    // A file of an earlier snapshot listed again after a later one's does not move it: a snapshot stands where its first file does.
    const apart = { [`app-snapshot/${T2}/${MAIN}/index.html`]: 1, [`app-snapshot/${T1}/${MAIN}/index.html`]: 2, [`app-snapshot/${T2}/${MAIN}/brimm/facts.json`]: 3 };
    assert.deepEqual(snapshotsOf(apart).map((s) => s.time), [T1, T2]);
    assert.deepEqual(keptSnapshots({ ...behind, [`app-snapshot/2026-10-22 08.00.00Z/${MAIN}/index.html`]: 5 }, () => true), { keep: ["2026-10-22 08.00.00Z", T1], drop: [T2] });
  });
  it("keep the two newest that are whole: every file listed for a snapshot there at its size; the others, older or not whole, are named to go", () => {
    const three = { ...listed, [`app-snapshot/2026-10-22 08.00.00Z/${MAIN}/index.html`]: 7 };
    const all = () => true;
    assert.deepEqual(keptSnapshots(three, all), { keep: ["2026-10-22 08.00.00Z", T2], drop: [T1] });
    assert.deepEqual(keptSnapshots(listed, all), { keep: [T2, T1], drop: [] });
    // One that is not whole is dropped when a newer one is whole: nothing is arriving that it could become whole by.
    const short = (path, bytes) => !(path.includes(T2) && path.endsWith("brimm/facts.json")) || bytes !== 30;
    assert.deepEqual(keptSnapshots(three, short), { keep: ["2026-10-22 08.00.00Z", T1], drop: [T2] });
    // But one newer than the newest whole one is never dropped: it is the other Mac's, still on its way (the review of PR 11, C1). It is kept
    // beside the two newest that are whole, and is not counted among them.
    const missing = (path) => !path.includes("2026-10-22 08.00.00Z");
    assert.deepEqual(keptSnapshots(three, missing), { keep: ["2026-10-22 08.00.00Z", T2, T1], drop: [] });
    const four = { [`app-snapshot/2026-10-19 08.00.00Z/${MAIN}/index.html`]: 3, ...three, [`app-snapshot/2026-10-23 08.00.00Z/${MAIN}/index.html`]: 9 };
    const twoNew = (path) => !path.includes("2026-10-22 08.00.00Z") && !path.includes("2026-10-23 08.00.00Z");
    assert.deepEqual(keptSnapshots(four, twoNew), { keep: ["2026-10-23 08.00.00Z", "2026-10-22 08.00.00Z", T2, T1], drop: ["2026-10-19 08.00.00Z"] });
    assert.deepEqual(keptSnapshots({}, all), { keep: [], drop: [] });
    assert.deepEqual(keptSnapshots({ [`app-snapshot/${T1}/${MAIN}/index.html`]: 1 }, all), { keep: [T1], drop: [] });
  });
});

describe("a snapshot as it is in the episode's folder", () => {
  const T = "2026-10-20 20.00.00Z";
  const MAIN = "Pricing talk main 3fa9c1";
  /** The episode's folder with the snapshot's files in it, and the record's list of them. */
  function episodeWith(c, files = { "index.html": "<html>", "brimm/facts.json": "{}" }) {
    const folder = scratch(c);
    const listed = {};
    for (const [rel, text] of Object.entries(files)) {
      put(folder, `app-snapshot/${T}/${MAIN}/${rel}`, text);
      listed[`app-snapshot/${T}/${MAIN}/${rel}`] = Buffer.byteLength(text);
    }
    return { folder, snapshot: snapshotOf(listed, MAIN) };
  }
  it("gives each file's size and time, in the record's order, when every file is there at the size the record lists", (c) => {
    const { folder, snapshot } = episodeWith(c);
    utimesSync(join(folder, snapshot.dir, "index.html"), new Date("2026-10-20T14:00:00Z"), new Date("2026-10-20T14:00:00Z"));
    const got = snapshotStats(folder, snapshot);
    assert.deepEqual(got.map((f) => [f.rel, f.bytes]), [["brimm/facts.json", 2], ["index.html", 6]]);
    assert.equal(got[1].mtimeMs, Date.parse("2026-10-20T14:00:00Z"));
  });
  it("is null when a file is missing or short or long, is not a file, or is a link", (c) => {
    for (const spoil of [
      (dir) => rmSync(join(dir, "index.html")),
      (dir) => writeFileSync(join(dir, "index.html"), "<ht"),
      (dir) => writeFileSync(join(dir, "index.html"), "<html>and more"),
      (dir) => {
        rmSync(join(dir, "index.html"));
        mkdirSync(join(dir, "index.html"));
      },
      (dir) => {
        rmSync(join(dir, "index.html"));
        symlinkSync(join(dir, "brimm", "facts.json"), join(dir, "index.html"));
      }
    ]) {
      const { folder, snapshot } = episodeWith(c);
      spoil(join(folder, snapshot.dir));
      assert.equal(snapshotStats(folder, snapshot), null);
    }
  });
});

describe("a project rebuilt from a snapshot (4.7, F12)", () => {
  const T = "2026-10-20 20.00.00Z";
  const MAIN = "Pricing talk main 3fa9c1";
  const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";
  const FILES = { "index.html": "<html>", "brimm/facts.json": '{"seconds":6}', "compositions/title.html": "<div>", "assets/fonts/a.woff2": "font" };
  /** The episode's folder with a snapshot in it, the record's list, and the folder the project is to be made in. */
  function episodeWith(c, files = FILES) {
    const base = scratch(c);
    const folder = join(base, "episode");
    const listed = {};
    for (const [rel, text] of Object.entries(files)) {
      put(folder, `app-snapshot/${T}/${MAIN}/${rel}`, text);
      utimesSync(join(folder, "app-snapshot", T, MAIN, rel), new Date("2026-10-20T13:40:00Z"), new Date("2026-10-20T13:40:00Z"));
      listed[`app-snapshot/${T}/${MAIN}/${rel}`] = Buffer.byteLength(text);
    }
    return { base, folder, listed, snapshot: snapshotOf(listed, MAIN), dir: join(base, "work", MAIN) };
  }
  it("is made of the snapshot's files with the times they had, a settings file made again and a link to the Mac's own toolchain, and nothing else", (c) => {
    const e = episodeWith(c);
    const got = rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI });
    assert.deepEqual(got, { assetsLeft: false });
    assert.deepEqual(readdirSync(e.dir, { recursive: true }).filter((rel) => !lstatSync(join(e.dir, rel)).isDirectory()).sort(), [...Object.keys(FILES), ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    for (const [rel, text] of Object.entries(FILES)) {
      assert.equal(readFileSync(join(e.dir, rel), "utf8"), text);
      assert.equal(lstatSync(join(e.dir, rel)).mtimeMs, Date.parse("2026-10-20T13:40:00Z"), rel);
    }
    assert.equal(readFileSync(join(e.dir, ".claude", "settings.json"), "utf8"), settingsText("main"));
    assert.equal(readlinkSync(join(e.dir, "node_modules", ".bin", "hyperframes")), CLI);
    assert.deepEqual(readdirSync(join(e.base, "work")), [MAIN], "no half-built folder is left beside it");
  });
  it("writes the marker: the snapshot it was made from and the Mac that made that snapshot (the review of PR 11, I1)", (c) => {
    const e = episodeWith(c);
    rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI, by: "Mac Studio" });
    assert.deepEqual(readMarker(e.dir), { snapshot: T, by: "Mac Studio" });
    const other = episodeWith(c);
    rebuildProject({ folder: other.folder, snapshot: other.snapshot, dir: other.dir, cli: CLI });
    assert.deepEqual(readMarker(other.dir), { snapshot: T, by: "" });
  });
  it("does not let a file dated after the moment of the rebuild stand for the project's last change: its time is the rebuild's, and the others keep theirs", (c) => {
    const e = episodeWith(c);
    const future = join(e.folder, "app-snapshot", T, MAIN, "compositions", "title.html");
    utimesSync(future, new Date("2026-12-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));
    const now = Date.parse("2026-10-20T20:30:00Z");
    rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI, now });
    assert.equal(lstatSync(join(e.dir, "compositions", "title.html")).mtimeMs, now);
    assert.equal(lstatSync(join(e.dir, "index.html")).mtimeMs, Date.parse("2026-10-20T13:40:00Z"));
  });
  it("writes nothing in the episode's folder", (c) => {
    const e = episodeWith(c);
    const before = readdirSync(e.folder, { recursive: true }).sort();
    rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI });
    assert.deepEqual(readdirSync(e.folder, { recursive: true }).sort(), before);
  });
  it("says the assets were left out when the snapshot holds none of them", (c) => {
    const e = episodeWith(c, { "index.html": "<html>" });
    assert.deepEqual(rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI }), { assetsLeft: true });
  });
  it("takes none of what a snapshot does not hold, however the record lists it, and makes its own settings file whatever the snapshot's says", (c) => {
    const foreign = { ".env": "SECRET=1", ".claude/settings.json": '{"permissions":{"allow":["Bash(*)"]}}', "media/recording.mp4": "v", "node_modules/x/index.js": "x", ".hyperframes/history-id": "i", "renders/r.mp4": "r", "snapshots/s.png": "s" };
    const e = episodeWith(c, { ...FILES, ...foreign });
    const got = rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI });
    assert.deepEqual(got, { assetsLeft: false });
    const made = readdirSync(e.dir, { recursive: true }).filter((rel) => !lstatSync(join(e.dir, rel)).isDirectory()).sort();
    assert.deepEqual(made, [...Object.keys(FILES), ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    assert.equal(readFileSync(join(e.dir, ".claude", "settings.json"), "utf8"), settingsText("main"));
  });
  it("is { why: \"not whole\" } when a file the record lists is not here, is short, is not a file, or when the snapshot holds nothing a snapshot holds, and makes nothing", (c) => {
    for (const spoil of [
      (e) => rmSync(join(e.folder, "app-snapshot", T, MAIN, "index.html")),
      (e) => writeFileSync(join(e.folder, "app-snapshot", T, MAIN, "index.html"), "<h"),
      (e) => {
        rmSync(join(e.folder, "app-snapshot", T, MAIN, "index.html"));
        mkdirSync(join(e.folder, "app-snapshot", T, MAIN, "index.html"));
      }
    ]) {
      const e = episodeWith(c);
      spoil(e);
      assert.deepEqual(rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI }), { why: "not whole" });
      assert.equal(existsSync(e.dir), false);
    }
    const nothing = episodeWith(c, { ".env": "x", "media/recording.mp4": "v" });
    assert.deepEqual(rebuildProject({ folder: nothing.folder, snapshot: nothing.snapshot, dir: nothing.dir, cli: CLI }), { why: "not whole" });
  });
  it("is { why: \"could not\" } when the folder cannot be made or is there already, and leaves no folder of its own, and a folder that is there is left alone", (c) => {
    const e = episodeWith(c);
    const failing = { ...fsModule, copyFileSync: () => { throw new Error("the disk is full"); } };
    assert.deepEqual(rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI }, { fs: failing }), { why: "could not" });
    assert.equal(existsSync(e.dir), false);
    assert.deepEqual(existsSync(join(e.base, "work")) ? readdirSync(join(e.base, "work")) : [], []);
    put(e.base, `work/${MAIN}/theirs.txt`, "kept");
    assert.deepEqual(rebuildProject({ folder: e.folder, snapshot: e.snapshot, dir: e.dir, cli: CLI }), { why: "could not" });
    assert.deepEqual(readdirSync(e.dir), ["theirs.txt"]);
  });
});

describe("a project's marker: which snapshot it was last rebuilt from or handed over as (the review of PR 11, I1)", () => {
  const T1 = "2026-10-20 20.00.00Z";
  const T2 = "2026-10-20 20.01.00Z";
  const MAIN = "Pricing talk main 3fa9c1";
  const at = (ms) => ({ mtimeMs: ms });
  const BASE = Date.parse("2026-10-20T14:00:00Z");
  /** The newest snapshot the record lists, as snapshotOf gives it, and the folder it is in. */
  function episodeWith(c, time = T2) {
    const folder = scratch(c);
    put(folder, `app-snapshot/${time}/${MAIN}/index.html`, "<html>");
    utimesSync(join(folder, "app-snapshot", time, MAIN, "index.html"), new Date(BASE), new Date(BASE));
    return { folder, newest: snapshotOf({ [`app-snapshot/${time}/${MAIN}/index.html`]: 6 }, MAIN), dir: join(folder, "work", MAIN) };
  }
  it("is a dot-file in the project's folder, written whole beside it and read back, and a snapshot never holds it", (c) => {
    const dir = join(scratch(c), "project");
    put(dir, "index.html", "<html>");
    assert.equal(readMarker(dir), null);
    writeMarker(dir, T1, "Mac Studio");
    assert.equal(MARKER.startsWith("."), true);
    assert.deepEqual(readMarker(dir), { snapshot: T1, by: "Mac Studio" });
    assert.deepEqual(readdirSync(dir).sort(), [MARKER, "index.html"]);
    assert.deepEqual(relsOf(snapshotFiles(dir)), ["index.html"]);
    writeMarker(dir, T2, "");
    assert.deepEqual(readMarker(dir), { snapshot: T2, by: "" });
    assert.equal(holds(MARKER), false);
  });
  it("is none when it is not there, is not JSON, or names no snapshot: the project counts as having never been handed over", (c) => {
    const dir = join(scratch(c), "project");
    for (const text of ["", "not json", "[]", "null", '{"snapshot":5}', '{"snapshot":"yesterday"}', '{"by":"Mac Studio"}']) {
      put(dir, MARKER, text);
      assert.equal(readMarker(dir), null, text);
    }
    put(dir, MARKER, '{"snapshot":"2026-10-20 20.00.00Z","by":5}');
    assert.deepEqual(readMarker(dir), { snapshot: T1, by: "" });
  });
  it("makes a project older when it names another snapshot than the newest listed, whatever the times of its files say", (c) => {
    const e = episodeWith(c);
    put(e.dir, "index.html", "<html>");
    utimesSync(join(e.dir, "index.html"), new Date(BASE + 3600 * 1000), new Date(BASE + 3600 * 1000));
    writeMarker(e.dir, T1, "Mac Studio");
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), true, "a project an hour newer by its files is older by its marker");
    writeMarker(e.dir, T2, "Sallie's laptop");
    utimesSync(join(e.dir, "index.html"), new Date(BASE - 3600 * 1000), new Date(BASE - 3600 * 1000));
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), false, "a project an hour older by its files is current by its marker");
  });
  it("makes a project older when it names a snapshot the record lists no more", (c) => {
    const e = episodeWith(c);
    put(e.dir, "index.html", "<html>");
    writeMarker(e.dir, "2026-10-19 08.00.00Z", "Mac Studio");
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), true);
  });
  it("falls back to the times of the files when there is no marker, and when it is none", (c) => {
    const e = episodeWith(c);
    put(e.dir, "index.html", "<html>");
    const stamp = (ms) => utimesSync(join(e.dir, "index.html"), new Date(ms), new Date(ms));
    stamp(BASE - 60000);
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), true);
    stamp(BASE - BEHIND_MS + 100);
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), false);
    stamp(BASE - 60000);
    put(e.dir, MARKER, "garbage");
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), true);
  });
  it("is never older when the record lists no snapshot of the project, or the snapshot is not whole here and there is no marker, or the project cannot be read", (c) => {
    const e = episodeWith(c);
    put(e.dir, "index.html", "<html>");
    assert.equal(olderThan(null, e.dir, { folder: e.folder }), false);
    writeMarker(e.dir, T1, "Mac Studio");
    assert.equal(olderThan(null, e.dir, { folder: e.folder }), false);
    rmSync(join(e.dir, MARKER));
    rmSync(join(e.folder, "app-snapshot", T2, MAIN, "index.html"));
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder }), false);
    assert.equal(olderThan(e.newest, join(e.dir, "nowhere"), { folder: e.folder }), false);
  });
  it("is told by the files the caller has already listed when it is given them, and they are not listed again", (c) => {
    const e = episodeWith(c);
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder, local: { files: [at(BASE - 60000)] } }), true);
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder, local: { files: [at(BASE)] } }), false);
    assert.equal(olderThan(e.newest, e.dir, { folder: e.folder, local: { unreadable: true } }), false);
  });
});

describe("a moment as she is told it", () => {
  it("is the zone's text when it is given one, and this Mac's own clock to the minute otherwise", () => {
    assert.equal(momentText(Date.parse("2026-10-20T20:00:00Z"), { text: (ms) => `at ${ms}` }), `at ${Date.parse("2026-10-20T20:00:00Z")}`);
    const ms = new Date(2026, 9, 20, 15, 5).getTime();
    assert.equal(momentText(ms), "2026-10-20 15:05");
    assert.equal(momentText(ms, undefined), "2026-10-20 15:05");
    assert.equal(momentText(ms, {}), "2026-10-20 15:05");
  });
});

describe("a project older than a snapshot (4.7)", () => {
  const at = (ms) => ({ mtimeMs: ms });
  const T = Date.parse("2026-10-20T14:00:00Z");
  it("is one whose newest file is more than 2 seconds older than the snapshot's newest", () => {
    assert.equal(behindSnapshot([at(T)], [at(T + 2001)]), true);
    assert.equal(behindSnapshot([at(T)], [at(T + 2000)]), false, "within 2 seconds is as new");
    assert.equal(behindSnapshot([at(T)], [at(T)]), false);
    assert.equal(behindSnapshot([at(T + 5000)], [at(T)]), false, "newer is not older");
  });
  it("counts the newest of all the project's files, so a new file the snapshot does not hold makes the project newer", () => {
    assert.equal(behindSnapshot([at(T - 9000), at(T + 3000)], [at(T), at(T - 5000)]), false);
    assert.equal(behindSnapshot([at(T - 9000), at(T - 8000)], [at(T), at(T - 5000)]), true);
  });
  it("is older when it holds no file, and never when the snapshot holds none or its times are not known", () => {
    assert.equal(behindSnapshot([], [at(T)]), true);
    assert.equal(behindSnapshot([at(T)], []), false);
    assert.equal(behindSnapshot([], []), false);
    assert.equal(behindSnapshot([{ mtimeMs: Number.NaN }], [at(T)]), true);
    assert.equal(behindSnapshot([at(T)], [{ mtimeMs: Number.NaN }]), false);
    assert.equal(behindSnapshot(null, [at(T)]), true);
    assert.equal(behindSnapshot([at(T)], null), false);
  });
});

describe("nothing here writes into the folders it reads", () => {
  it("leaves the project as it was, down to the times of its files", (c) => {
    const dir = scratch(c);
    put(dir, "index.html", "<html>");
    put(dir, "brimm/facts.json", "{}");
    const before = readdirSync(dir, { recursive: true }).sort().map((rel) => [rel, lstatSync(join(dir, rel)).mtimeMs]);
    snapshotFiles(dir);
    snapshotFiles(dir, { assetsMost: 0 });
    assert.deepEqual(readdirSync(dir, { recursive: true }).sort().map((rel) => [rel, lstatSync(join(dir, rel)).mtimeMs]), before);
    assert.ok(existsSync(join(dir, "index.html")));
  });
});
