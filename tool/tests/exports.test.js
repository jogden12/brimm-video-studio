// HyperFrames' exports (plan PR 7; architecture 2026-10-27, section 8): how the app names an export and what it records of one, when an
// export began, and when its project last changed (groups A and B of the plan), and, below them, which export a part takes (group C).
// The shapes are A0's (architecture 8.1) with made-up names. The pure functions read no disk; the one that does (projectChange) is run
// on a folder made in the test's own temporary directory. No time here depends on the Mac the test runs on: a zone is given.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lutimesSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadsFolder, episodeWork } from "../settings.js";
import { turnsOf } from "../hyperframes.js";
import { exportNameOf, metaNameOf, metaOf, beganAt, fixedZone, lastChangeOf, projectChange, lookForExports, exportsFound, isExportOf, shapeFault, soundFault, colourNote } from "../exports.js";

const MAIN = "Pricing- what to charge- main 3fa9c1";
const fixture = (name) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/exports/${name}`, import.meta.url), "utf8");
/** A fixture's text, with the folder its exports went to filled in. */
const filled = (name) => fixture(name).replace("<DOWNLOADS>", "/Users/sallie/Downloads");

describe("exports: where the app puts its exports", () => {
  it("is the Downloads folder of the home it is given", () => {
    assert.equal(downloadsFolder("/Users/sallie"), "/Users/sallie/Downloads");
  });
});

describe("A1. exportNameOf: an export's name, as the app makes it", () => {
  it("reads the project's name, the day, the time and the ending", () => {
    assert.deepEqual(exportNameOf(`${MAIN} 2026-10-20 13.56.mp4`), { project: MAIN, date: "2026-10-20", time: "13:56", ending: "mp4", copy: 0 });
    assert.deepEqual(exportNameOf("BRIMM Video Explainer Reel 2026-10-28 15.20.mp4"), { project: "BRIMM Video Explainer Reel", date: "2026-10-28", time: "15:20", ending: "mp4", copy: 0 });
  });
  it("reads .mov, .m4v and .webm too, and capitals in the ending", () => {
    for (const ending of ["mov", "m4v", "webm"]) assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56.${ending}`).ending, ending);
    assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56.MP4`).ending, "mp4");
    assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56.Mov`).ending, "mov");
  });
  it("reads the number the system adds to a copy as a copy mark", () => {
    assert.deepEqual(exportNameOf(`${MAIN} 2026-10-20 13.56 (1).mp4`), { project: MAIN, date: "2026-10-20", time: "13:56", ending: "mp4", copy: 1 });
    assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56 (12).mov`).copy, 12);
  });
  it("is none for a name the app does not make: a colon in the time, seconds, no date, a part of a download, a hidden file, a bare project name", () => {
    for (const name of [
      `${MAIN} 2026-10-20 13:56.mp4`, `${MAIN} 2026-10-20 13.56.12.mp4`, `${MAIN} 13.56.mp4`, `${MAIN} 2026-10-20.mp4`,
      `${MAIN} 2026-10-20 13.56.mp4.partial`, `${MAIN} 2026-10-20 13.56.mp4.crdownload`, `${MAIN} 2026-10-20 13.56.mp4.download`,
      `.${MAIN} 2026-10-20 13.56.mp4`, `${MAIN}.mp4`, `${MAIN} 2026-10-20 13.56.txt`, `${MAIN} 2026-10-20 13.56`, "2026-10-20 13.56.mp4", "", " 2026-10-20 13.56.mp4"
    ]) assert.equal(exportNameOf(name), null, name);
  });
  it("is none for a day or a time that cannot be one", () => {
    for (const when of ["2026-13-20 13.56", "2026-10-32 13.56", "2026-00-10 13.56", "2026-10-20 24.00", "2026-10-20 13.60", "2026-10-20 25.10"]) assert.equal(exportNameOf(`${MAIN} ${when}.mp4`), null, when);
  });
  it("is none for a copy Dropbox kept of a file changed on two Macs, which is not an export", () => {
    assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56 (Jason Ogden's conflicted copy 2026-10-20).mp4`), null);
    assert.equal(exportNameOf(`${MAIN} 2026-10-20 13.56 (Case Conflict).mp4`), null);
  });
  it("takes anything it is given that is not text for no name", () => {
    for (const odd of [undefined, null, 7, {}]) assert.equal(exportNameOf(odd), null);
  });
});

describe("A2. exportNameOf: names are compared composed", () => {
  it("reads a name written decomposed as the composed project", () => {
    const decomposed = "Café talk main 3fa9c1 2026-10-20 13.56.mp4";
    assert.equal(exportNameOf(decomposed).project, "Café talk main 3fa9c1");
    assert.equal(exportNameOf("Café talk main 3fa9c1 2026-10-20 13.56.mp4").project, exportNameOf(decomposed).project);
  });
  it("never takes one project's name for another that begins with it", () => {
    assert.equal(exportNameOf("X main 3fa9c1 2026-10-20 13.56.mp4").project, "X main 3fa9c1");
    assert.equal(exportNameOf("X main 2 3fa9c1 2026-10-20 13.56.mp4").project, "X main 2 3fa9c1");
    assert.notEqual(exportNameOf("X main 2 3fa9c1 2026-10-20 13.56.mp4").project, "X main 3fa9c1");
  });
});

describe("A3. the app's records of an export", () => {
  it("metaNameOf reads a record's name as the project and the moment the export began, to the second", () => {
    assert.deepEqual(metaNameOf(`${MAIN}_2026-10-20_13-56-40.meta.json`), { project: MAIN, date: "2026-10-20", time: "13:56:40" });
  });
  it("metaNameOf takes the project from the last underscores, since a project's name may hold some", () => {
    assert.deepEqual(metaNameOf("My_talk main 3fa9c1_2026-10-20_13-56-40.meta.json"), { project: "My_talk main 3fa9c1", date: "2026-10-20", time: "13:56:40" });
  });
  it("metaNameOf reads a name written decomposed as the composed one", () => {
    assert.equal(metaNameOf("Café main 3fa9c1_2026-10-20_13-56-40.meta.json").project, "Café main 3fa9c1");
  });
  it("metaNameOf is none for a name with no seconds, another ending, or an impossible time", () => {
    for (const name of [`${MAIN}_2026-10-20_13-56.meta.json`, `${MAIN}_2026-10-20_13-56-40.meta.txt`, `${MAIN}_2026-10-20_13-56-40.mp4`, `${MAIN}_2026-10-20_25-56-40.meta.json`, `${MAIN}_2026-10-20_13-56-61.meta.json`, `${MAIN}_2026-13-20_13-56-40.meta.json`, `_2026-10-20_13-56-40.meta.json`, `${MAIN} 2026-10-20 13.56.meta.json`]) {
      assert.equal(metaNameOf(name), null, name);
    }
  });
  it("metaOf reads A0's records: complete, where the file went, the format and the shape", () => {
    assert.deepEqual(metaOf(filled("main.meta.json")), { complete: true, exportedTo: `/Users/sallie/Downloads/${MAIN} 2026-10-20 13.56.mp4`, format: "mp4", resolution: "landscape" });
    assert.deepEqual(metaOf(filled("reel.meta.json")), { complete: true, exportedTo: "/Users/sallie/Downloads/Pricing- what to charge- reel 2 3fa9c1 2026-10-20 14.03.mp4", format: "mp4", resolution: "portrait" });
  });
  it("metaOf takes a record that says it failed as not complete, with no file", () => {
    assert.deepEqual(metaOf(fixture("failed.meta.json")), { complete: false, exportedTo: null, format: "mp4", resolution: "landscape" });
  });
  it("metaOf takes a missing status as complete, and a status that is not 'complete' (or not text) as not", () => {
    const base = JSON.parse(filled("main.meta.json"));
    const { status: _status, ...none } = base;
    assert.equal(metaOf(JSON.stringify(none)).complete, true);
    for (const status of ["failed", "running", "cancelled", "", 7, null, ["complete"]]) assert.equal(metaOf(JSON.stringify({ ...base, status })).complete, false, JSON.stringify(status));
    assert.equal(metaOf(JSON.stringify({ ...base, status: "complete" })).complete, true);
  });
  it("metaOf takes an exportedTo that is missing, relative or not text for none, so the file is looked for by its name", () => {
    const base = JSON.parse(filled("main.meta.json"));
    for (const exportedTo of [undefined, "", "Downloads/x.mp4", "./x.mp4", "~/Downloads/x.mp4", 7, null, ["/a.mp4"], {}]) {
      assert.equal(metaOf(JSON.stringify({ ...base, exportedTo })).exportedTo, null, JSON.stringify(exportedTo));
    }
  });
  it("metaOf is not troubled by other keys, a missing settings, or a fingerprint, and does not carry the fingerprint", () => {
    const base = JSON.parse(filled("main.meta.json"));
    const { settings: _settings, fingerprint: _fingerprint, ...bare } = base;
    assert.deepEqual(metaOf(JSON.stringify({ ...bare, engine: "local", something: { new: true } })), { complete: true, exportedTo: base.exportedTo, format: "", resolution: "" });
    assert.deepEqual(Object.keys(metaOf(JSON.stringify(base))).sort(), ["complete", "exportedTo", "format", "resolution"]);
  });
  it("metaOf is none for text that is not JSON, or not an object", () => {
    for (const text of ["", "not json", "[]", "null", "7", '"complete"', "{", undefined, null]) assert.equal(metaOf(text), null, String(text));
  });
});

describe("A4. when an export began", () => {
  const utc4 = fixedZone(-240);
  const utc9 = fixedZone(540);
  it("is to the second when a record's name gives the seconds, and says it is exact", () => {
    assert.deepEqual(beganAt({ date: "2026-10-20", time: "13:56:40" }, utc4), { ms: Date.UTC(2026, 9, 20, 17, 56, 40), exact: true });
  });
  it("is the start of its minute when only a file's name gives it, and says it is not exact", () => {
    assert.deepEqual(beganAt({ date: "2026-10-20", time: "13:56" }, utc4), { ms: Date.UTC(2026, 9, 20, 17, 56, 0), exact: false });
  });
  it("is another moment in another zone, so that no test depends on the Mac it runs on", () => {
    assert.equal(beganAt({ date: "2026-10-20", time: "13:56:40" }, utc9).ms, Date.UTC(2026, 9, 20, 4, 56, 40));
    assert.notEqual(beganAt({ date: "2026-10-20", time: "13:56:40" }, utc9).ms, beganAt({ date: "2026-10-20", time: "13:56:40" }, utc4).ms);
  });
  it("is said in the zone's own words, to the minute", () => {
    assert.equal(utc4.text(Date.UTC(2026, 9, 20, 17, 56, 40)), "2026-10-20 13:56");
    assert.equal(utc9.text(Date.UTC(2026, 9, 20, 17, 56, 40)), "2026-10-21 02:56");
  });
});

describe("B1. the project's last change", () => {
  const at = (seconds) => Date.UTC(2026, 9, 20, 18, 0, 0) + seconds * 1000;
  it("is the newest file change outside names that start with a dot, node_modules, renders and snapshots, at any depth", () => {
    const files = [
      { path: "index.html", mtimeMs: at(10) }, { path: "compositions/lower-third.html", mtimeMs: at(30) },
      { path: ".hyperframes/video-state.json", mtimeMs: at(900) }, { path: "renders/old.mp4", mtimeMs: at(900) }, { path: "snapshots/frame.png", mtimeMs: at(900) },
      { path: "node_modules/.bin/hyperframes", mtimeMs: at(900) }, { path: "compositions/.cache/x.json", mtimeMs: at(900) }, { path: "assets/renders/clip.mp4", mtimeMs: at(900) },
      { path: ".thumbnails/a.jpg", mtimeMs: at(900) }
    ];
    assert.equal(lastChangeOf({ files, turns: [] }), at(30));
  });
  it("counts a change to index.html or in compositions/", () => {
    assert.equal(lastChangeOf({ files: [{ path: "index.html", mtimeMs: at(5) }], turns: [] }), at(5));
    assert.equal(lastChangeOf({ files: [{ path: "compositions/title.html", mtimeMs: at(7) }], turns: [] }), at(7));
  });
  it("counts the last turn of app-history.jsonl when it is later than the files", () => {
    const turns = turnsOf(fixture("../app-history.jsonl"));
    const last = Date.parse("2026-10-27T20:05:02.000Z");
    assert.equal(lastChangeOf({ files: [{ path: "index.html", mtimeMs: last - 60000 }], turns }), last);
    assert.equal(lastChangeOf({ files: [{ path: "index.html", mtimeMs: last + 60000 }], turns }), last + 60000);
  });
  it("passes over a turn whose date is not a date, and a line that is not JSON", () => {
    const turns = turnsOf('not json\n{"at":"yesterday","did":"x"}\n{"at":"2026-10-27T19:41:08.000Z","did":"y"}\n');
    assert.equal(lastChangeOf({ files: [], turns }), Date.parse("2026-10-27T19:41:08.000Z"));
    assert.equal(lastChangeOf({ files: [], turns: [{ at: "yesterday" }, { at: 7 }, null] }), null);
  });
  it("is null with no files and no turns: unknown, and not zero", () => {
    assert.equal(lastChangeOf({ files: [], turns: [] }), null);
    assert.equal(lastChangeOf({ files: [{ path: ".hyperframes/a.json", mtimeMs: at(1) }, { path: "renders/a.mp4", mtimeMs: at(1) }], turns: [] }), null);
  });
  describe("on a project folder", () => {
    const made = () => {
      const dir = mkdtempSync(join(tmpdir(), "brimm-exports-"));
      const put = (rel, seconds, text = "x") => {
        mkdirSync(join(dir, rel, ".."), { recursive: true });
        writeFileSync(join(dir, rel), text);
        utimesSync(join(dir, rel), new Date(at(seconds)), new Date(at(seconds)));
      };
      return { dir, put };
    };
    it("reads the files and the app's history of the folder, as the plain function does", () => {
      const { dir, put } = made();
      put("index.html", 10);
      put("compositions/title.html", 40);
      put("media/recording.mp4", 5);
      put("renders/Pricing_2026-10-20_13-56-40.mp4", 500);
      put("renders/Pricing_2026-10-20_13-56-40.meta.json", 500);
      put(".hyperframes/video-state.json", 600);
      put("node_modules/hyperframes/x.js", 700);
      assert.equal(projectChange(dir), at(40));
      put(".hyperframes/app-history.jsonl", 800, `{"at":${JSON.stringify(new Date(at(120)).toISOString())},"engine":"claude","asked":"a","did":"b","files":[]}\n`);
      assert.equal(projectChange(dir), at(120));
      rmSync(dir, { recursive: true, force: true });
    });
    it("is null for a folder that is not on this Mac, and for one with nothing that counts", () => {
      const { dir, put } = made();
      assert.equal(projectChange(join(dir, "not here")), null);
      put("renders/a.mp4", 10);
      assert.equal(projectChange(dir), null);
      rmSync(dir, { recursive: true, force: true });
    });
    it("does not follow a link, and a link itself counts for its own time", () => {
      const { dir, put } = made();
      const elsewhere = mkdtempSync(join(tmpdir(), "brimm-exports-elsewhere-"));
      writeFileSync(join(elsewhere, "newer.txt"), "x");
      utimesSync(join(elsewhere, "newer.txt"), new Date(at(900)), new Date(at(900)));
      put("index.html", 10);
      symlinkSync(elsewhere, join(dir, "linked"));
      lutimesSync(join(dir, "linked"), new Date(at(20)), new Date(at(20)));
      assert.equal(projectChange(dir), at(20), "the file behind the link is not looked at");
      rmSync(dir, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    });
    it("reads only the last megabyte of a long history, as the command line's catch-up does", () => {
      const { dir, put } = made();
      put("index.html", 10);
      const old = `{"at":${JSON.stringify(new Date(at(5000)).toISOString())},"engine":"claude","asked":"old","did":"x","files":[]}\n`;
      const filler = `{"at":"2026-10-01T00:00:00.000Z","engine":"claude","asked":"${"a".repeat(990)}","did":"x","files":[]}\n`.repeat(1100);
      put(".hyperframes/app-history.jsonl", 100, old + filler);
      assert.equal(projectChange(dir), at(10), "the one old turn that is later than the files lies before the last megabyte");
      rmSync(dir, { recursive: true, force: true });
    });
  });
});

// --- Group C: which export a part takes (lookForExports, plain data) ---

const zone = fixedZone(-300);
/** A moment on 2026-10-20, in the zone of the made-up records (UTC-5). */
const ms = (hours, minutes, seconds = 0) => zone.ms(2026, 10, 20, hours, minutes, seconds);
const P_MAIN = MAIN;
const P_REEL2 = "Pricing- what to charge- reel 2 3fa9c1";
const DOWNLOADS = "/h/Downloads";
const RELEASED = "/e/edit/from-hyperframes";
/** A file as a listing of a folder gives it. */
const file = (name, over = {}) => ({ name, bytes: 5000, mtimeMs: ms(14, 0), ...over });
/** A file found by the app's own record of an export: where it is, and when the record says the export began, to the second. */
const recorded = (name, over = {}) => ({ name, dir: DOWNLOADS, where: "Downloads", bytes: 5000, mtimeMs: ms(14, 0), began: { ms: ms(13, 56, 40), exact: true }, ...over });
/** A part of the episode as exportsFound gives it: the main project, changed at 13:40, on this Mac. */
const main = (over = {}) => ({ key: "main", label: "the main video", project: P_MAIN, fromSuggestion: undefined, here: true, mac: "Mac Studio", changed: ms(13, 40), recorded: [], renders: [], ...over });
const reel2 = (over = {}) => main({ key: "reel 2", label: "Reel 2", reel: 2, project: P_REEL2, fromSuggestion: 2, ...over });
const found = (parts, downloads = [], released = [], finished = null) => ({ zone, parts, downloads: { dir: DOWNLOADS, files: downloads }, released: { dir: RELEASED, files: released }, finished });
const NONE = {};
const named = (project, when, ending = "mp4") => `${project} 2026-10-20 ${when}.${ending}`;
/** What the last finish made of a part: its export's size and time, and the project it came from. */
const FINISHED_AT = "2026-10-20T14:10:00-05:00";
const finishedWith = (key, over = {}) => ({ revision: 1, at: FINISHED_AT, on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { [key]: { file: `final/${key}.mp4`, bytes: 5000, seconds: 10, source: { bytes: 5000, mtimeMs: ms(14, 0) }, project: key === "main" ? P_MAIN : P_REEL2, ...over } } });

describe("C1. which export: the newest that began after the project's last change", () => {
  it("takes it for the main project and for Reel 2, asks nothing, and says what it took", () => {
    const got = lookForExports(found([main(), reel2()], [
      file(named(P_MAIN, "13.50")), file(named(P_MAIN, "13.56")), file(named(P_REEL2, "14.03")), file("Another episode main 9a8b7c 2026-10-20 13.56.mp4")
    ]), NONE);
    assert.deepEqual([got.asks, got.stops, got.mentions], [[], [], []]);
    assert.deepEqual(got.parts.map((p) => [p.key, p.video.name, p.video.where, p.kept]), [["main", named(P_MAIN, "13.56"), "Downloads", false], ["reel 2", named(P_REEL2, "14.03"), "Downloads", false]]);
    assert.deepEqual(got.parts.map((p) => p.line), [
      `The main video: ${named(P_MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`,
      `Reel 2: ${named(P_REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`
    ]);
    assert.deepEqual(got.parts[0].video, { name: named(P_MAIN, "13.56"), dir: DOWNLOADS, where: "Downloads", bytes: 5000, mtimeMs: ms(14, 0), began: { ms: ms(13, 56), exact: false } });
    assert.equal(got.looked, `Looked in Downloads and in what the other Mac released for exports of: ${P_MAIN}, ${P_REEL2}.`);
  });
  it("gives a part what the plan needs of it: its project, its Reel's number, the suggestion it came from, no Final Cut export", () => {
    const got = lookForExports(found([main(), reel2()], [file(named(P_MAIN, "13.56")), file(named(P_REEL2, "14.03"))]), NONE);
    assert.deepEqual(got.parts.map((p) => [p.key, p.label, p.reel, p.project, p.projects, p.fromSuggestion, p.export]), [
      ["main", "the main video", undefined, P_MAIN, [P_MAIN], undefined, null],
      ["reel 2", "Reel 2", 2, P_REEL2, [P_REEL2], 2, null]
    ]);
  });
  it("takes of three exports after the change the one that began last, and an export of the other folder as well", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.50")), file(named(P_MAIN, "13.52"))], [file(named(P_MAIN, "13.58"), { bytes: 7000 })]), NONE);
    assert.deepEqual([got.asks, got.parts[0].video.name, got.parts[0].video.where, got.parts[0].line], [[], named(P_MAIN, "13.58"), "the other Mac", `The main video: ${named(P_MAIN, "13.58")}, from what the other Mac released, exported 2026-10-20 13:58.`]);
  });
  it("reads a file the system numbered as a copy for an export of the project, and asks when it is beside the original of its minute", () => {
    const alone = lookForExports(found([main()], [file(`${P_MAIN} 2026-10-20 13.56 (1).mp4`)]), NONE);
    assert.deepEqual([alone.asks, alone.parts.map((p) => p.video.name)], [[], [`${P_MAIN} 2026-10-20 13.56 (1).mp4`]]);
    const both = lookForExports(found([main()], [file(named(P_MAIN, "13.56")), file(`${P_MAIN} 2026-10-20 13.56 (1).mp4`)]), NONE);
    assert.equal(both.asks.length, 1);
    assert.match(both.asks[0], /^For the main video there are two exports that began at 2026-10-20 13:56: /);
  });
  it("takes a file of no other project's: a name for another project, or an empty file, is none of the part's", () => {
    const got = lookForExports(found([main()], [file(named("Another episode main 9a8b7c", "13.56")), file(named(P_MAIN, "13.57"), { bytes: 0 }), file("notes.txt"), file("Pricing- what to charge- main 3fa9c1.mp4")]), NONE);
    assert.deepEqual(got.parts, []);
    assert.equal(got.stops.length, 1);
  });
});

describe("C2. which export: by the app's own record first", () => {
  it("finds an export whose name matches no project when its record names it, in another folder too", () => {
    const got = lookForExports(found([main({ recorded: [recorded("final.mp4", { dir: "/h/Desktop", where: "another folder" })] })]), NONE);
    assert.deepEqual([got.asks, got.stops], [[], []]);
    assert.deepEqual([got.parts[0].video.name, got.parts[0].video.where, got.parts[0].video.dir], ["final.mp4", "another folder", "/h/Desktop"]);
    assert.equal(got.parts[0].line, "The main video: final.mp4, from another folder, exported 2026-10-20 13:56.");
  });
  it("counts a file found both by its record and by its name once, and takes the record's seconds", () => {
    const name = named(P_MAIN, "13.56");
    const got = lookForExports(found([main({ changed: ms(13, 56, 30), recorded: [recorded(name)] })], [file(name)]), NONE);
    assert.deepEqual([got.asks, got.parts.length, got.parts[0].video.began], [[], 1, { ms: ms(13, 56, 40), exact: true }]);
  });
  it("asks when a recorded export and a file found by its name began in the same minute, the record's seconds notwithstanding: the minute is what she sees", () => {
    const got = lookForExports(found([main({ recorded: [recorded("final.mp4", { began: { ms: ms(13, 56, 40), exact: true } })] })], [file(named(P_MAIN, "13.56"))]), NONE);
    assert.deepEqual(got.asks, [`For the main video there are two exports that began at 2026-10-20 13:56: ${named(P_MAIN, "13.56")}, final.mp4. Which is the final one?`]);
  });
});

describe("C3. an export older than the project's last change", () => {
  const OLDER = (when, changed) => `The main video's newest export, ${named(P_MAIN, when)}, began at 2026-10-20 13:${when.slice(3)}, before you last changed it in HyperFrames, at 2026-10-20 ${changed}. Export it again from HyperFrames on This Mac, or say that export is the final one.`;
  it("asks, and chooses nothing for that part, while the others are chosen", () => {
    const got = lookForExports(found([main({ changed: ms(14, 30) }), reel2()], [file(named(P_MAIN, "13.56")), file(named(P_REEL2, "14.03"))]), NONE);
    assert.deepEqual(got.asks, [OLDER("13.56", "14:30")]);
    assert.deepEqual(got.parts.map((p) => p.key), ["reel 2"]);
    assert.deepEqual(got.stops, []);
  });
  it("lets a record's seconds decide: begun at 13:56:40 and changed ten seconds later is older, and the same second is not", () => {
    const at = (changed) => lookForExports(found([main({ changed, recorded: [recorded(named(P_MAIN, "13.56"))] })]), NONE);
    assert.equal(at(ms(13, 56, 50)).asks.length, 1);
    assert.equal(at(ms(13, 56, 40)).asks.length, 0);
    assert.equal(at(ms(13, 56, 40) + 800).asks.length, 0, "a change in the same second, a little after, is a save as the export began");
    assert.equal(at(ms(13, 56, 41)).asks.length, 1);
  });
  it("gives a file's name alone the benefit of its minute, and a change in a later minute is older", () => {
    const at = (changed) => lookForExports(found([main({ changed })], [file(named(P_MAIN, "13.56"))]), NONE);
    assert.equal(at(ms(13, 56, 50)).asks.length, 0);
    assert.equal(at(ms(13, 56, 59) + 900).asks.length, 0);
    assert.equal(at(ms(13, 57, 0)).asks.length, 1);
  });
  it("takes it when she says it is the final one, and says so", () => {
    const got = lookForExports(found([main({ changed: ms(14, 30) })], [file(named(P_MAIN, "13.56"))]), { final: ["main"] });
    assert.deepEqual([got.asks, got.parts.length], [[], 1]);
    assert.equal(got.parts[0].line, `The main video: ${named(P_MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56. HyperFrames changed after it, and you said it is final.`);
  });
  it("says nothing more of an export that is not older, whatever she said", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56"))]), { final: ["main"] });
    assert.equal(got.parts[0].line, `The main video: ${named(P_MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`);
  });
  it("asks nothing when the project's last change is not known", () => {
    const got = lookForExports(found([main({ changed: null })], [file(named(P_MAIN, "13.56"))]), NONE);
    assert.deepEqual([got.asks, got.parts.length], [[], 1]);
  });
});

describe("C4. two exports of one minute, and a file she names", () => {
  const TWO = `For the main video there are two exports that began at 2026-10-20 13:56: ${named(P_MAIN, "13.56", "mov")}, ${named(P_MAIN, "13.56")}. Which is the final one?`;
  it("asks which is final when two different files began in one minute, and chooses nothing", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56")), file(named(P_MAIN, "13.56", "mov"))]), NONE);
    assert.deepEqual([got.asks, got.parts], [[TWO], []]);
  });
  it("says where each is when one name is in both places and the two differ", () => {
    const name = named(P_MAIN, "13.56");
    const got = lookForExports(found([main()], [file(name, { bytes: 5000 })], [file(name, { bytes: 6000 })]), NONE);
    assert.deepEqual(got.asks, [`For the main video there are two exports that began at 2026-10-20 13:56: ${name} on this Mac, ${name} from the other Mac. Which is the final one?`]);
  });
  it("takes one file once when the same export is in both places, from Downloads", () => {
    const name = named(P_MAIN, "13.56");
    const got = lookForExports(found([main()], [file(name)], [file(name)]), NONE);
    assert.deepEqual([got.asks, got.parts[0].video.where], [[], "Downloads"]);
  });
  it("is answered by a file's name, and by 'this Mac' or 'the other Mac'", () => {
    const name = named(P_MAIN, "13.56");
    const byName = lookForExports(found([main()], [file(named(P_MAIN, "13.56")), file(named(P_MAIN, "13.56", "mov"))]), { take: { main: named(P_MAIN, "13.56", "mov") } });
    assert.deepEqual([byName.asks, byName.parts[0].video.name], [[], named(P_MAIN, "13.56", "mov")]);
    const places = found([main()], [file(name, { bytes: 5000 })], [file(name, { bytes: 6000 })]);
    assert.deepEqual([lookForExports(places, { take: { main: "this Mac" } }).parts[0].video.where, lookForExports(places, { take: { main: "the other Mac" } }).parts[0].video.where], ["Downloads", "the other Mac"]);
    assert.deepEqual(lookForExports(places, { take: { main: name } }).asks, [`${name} is both on this Mac and from the other Mac, and they differ. Say which: this Mac, or the other Mac.`]);
  });
  it("takes a file she names whatever it is called and however old, with no check against the project's last change", () => {
    const got = lookForExports(found([main({ changed: ms(14, 59) })], [file("my final cut.mp4", { mtimeMs: ms(9, 0) }), file(named(P_MAIN, "13.56"))], [file("from the laptop.mov")]), { take: { main: "my final cut.mp4" } });
    assert.deepEqual([got.asks, got.parts[0].video.name, got.parts[0].video.began], [[], "my final cut.mp4", null]);
    assert.equal(got.parts[0].line, "The main video: my final cut.mp4, from Downloads, the file you named.");
    assert.equal(lookForExports(found([main()], [], [file("from the laptop.mov")]), { take: { main: "from the laptop.mov" } }).parts[0].line, "The main video: from the laptop.mov, from what the other Mac released, the file you named.");
  });
  it("asks again when the name she gives is none of the files, and lists the exports of the part", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56")), file("holiday.mp4")]), { take: { main: "final.mp4" } });
    assert.deepEqual(got.asks, [`"final.mp4" is not an export of the main video. The ones there are: ${named(P_MAIN, "13.56")}. Which is the final one?`]);
    assert.deepEqual(got.parts, []);
    const none = lookForExports(found([main()], []), { take: { main: "final.mp4" } });
    assert.deepEqual(none.asks, ['"final.mp4" is not an export of the main video. There is none there. Which is the final one?']);
  });
  it("never takes a WebM she names", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56", "webm"))]), { take: { main: named(P_MAIN, "13.56", "webm") } });
    assert.deepEqual(got.parts, []);
    assert.equal(got.asks.length, 1);
  });
});

describe("C5. a part with no export", () => {
  const REEL_NONE = "Reel 2 has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name.";
  const MAIN_NONE = 'The main video has no export yet. Export it from HyperFrames on This Mac, as MP4, then say "hand it off" again. If HyperFrames is still exporting it, say it again when the export is done.';
  it("asks of a Reel project whether to leave it out, and goes on with the others", () => {
    const got = lookForExports(found([main(), reel2()], [file(named(P_MAIN, "13.56"))]), NONE);
    assert.deepEqual([got.asks, got.stops, got.parts.map((p) => p.key)], [[REEL_NONE], [], ["main"]]);
  });
  it("leaves it out when she says to, and nothing is asked", () => {
    const got = lookForExports(found([main(), reel2()], [file(named(P_MAIN, "13.56"))]), { without: ["reel 2"] });
    assert.deepEqual([got.asks, got.parts.map((p) => p.key)], [[], ["main"]]);
  });
  it("keeps a Reel the last finish finished when she says to leave it out, as lookFor keeps one, and the hand-off still holds it", () => {
    const got = lookForExports(found([main(), reel2()], [file(named(P_MAIN, "13.56"))], [], finishedWith("reel 2")), { without: ["reel 2"] });
    assert.deepEqual(got.parts.map((p) => [p.key, p.kept, p.video]), [["main", false, got.parts[0].video], ["reel 2", true, null]]);
    assert.equal(got.parts[1].line, "Reel 2: kept as the last finish made it.");
  });
  it("is never left out for the main video: it stops, saying where it looked", () => {
    const got = lookForExports(found([main(), reel2()], [file(named(P_REEL2, "14.03"))]), { without: ["main"] });
    assert.deepEqual(got.stops, [MAIN_NONE]);
    assert.equal(got.looked, `Looked in Downloads and in what the other Mac released for exports of: ${P_MAIN}, ${P_REEL2}.`);
  });
  it("says of a main project on the other Mac, with nothing released, that its exports are there", () => {
    const got = lookForExports(found([main({ here: false, changed: null, mac: "Sallie's laptop" })], []), NONE);
    assert.deepEqual(got.stops, ["The main video's HyperFrames project is on Sallie's laptop, so its exports are there. Finish it on that Mac."]);
  });
});

describe("C6. what is passed over, and what is only mentioned", () => {
  it("mentions a WebM of the part when it has no MP4 or MOV, and still stops", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56", "webm"))]), NONE);
    assert.deepEqual(got.mentions, [`${named(P_MAIN, "13.56", "webm")} is a WebM, which is not taken: export it again as MP4.`]);
    assert.equal(got.stops.length, 1);
    assert.deepEqual(got.parts, []);
  });
  it("says nothing of a WebM that began before the export that is taken", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.50", "webm")), file(named(P_MAIN, "13.54"))]), NONE);
    assert.deepEqual([got.mentions, got.parts.length], [[], 1]);
  });
  it("mentions a WebM that began after the export that is taken, so that she does not think it is the one", () => {
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56", "webm")), file(named(P_MAIN, "13.54"))]), NONE);
    assert.deepEqual(got.mentions, [`${named(P_MAIN, "13.56", "webm")} is a WebM, which is not taken: export it again as MP4.`]);
    assert.equal(got.parts[0].video.name, named(P_MAIN, "13.54"));
  });
  it("mentions a render in the project's renders/ that no record names, and does not take it", () => {
    const render = "Pricing- what to charge- main 3fa9c1_2026-10-20_13-58-02.mp4";
    const got = lookForExports(found([main({ renders: [file(render, { dir: "/w/project/renders" })] })]), NONE);
    assert.deepEqual(got.mentions, [`The main video's project has a video that HyperFrames' own render made, ${render}. It is not an export, so it is not taken. Export it from HyperFrames, or tell me its file name to use it.`]);
    assert.deepEqual(got.parts, []);
    assert.equal(got.stops.length, 1);
  });
  it("takes that render when she names it, and says it is HyperFrames' own render", () => {
    const render = "Pricing- what to charge- main 3fa9c1_2026-10-20_13-58-02.mp4";
    const got = lookForExports(found([main({ renders: [file(render, { dir: "/w/project/renders" })] })]), { take: { main: render } });
    assert.deepEqual([got.asks, got.mentions, got.parts[0].video.where, got.parts[0].video.dir], [[], [], "renders", "/w/project/renders"]);
    assert.equal(got.parts[0].line, `The main video: ${render}, HyperFrames' own render, the file you named.`);
  });
  it("says nothing of a render when the part has an export", () => {
    const got = lookForExports(found([main({ renders: [file("Pricing- what to charge- main 3fa9c1_2026-10-20_13-58-02.mp4", { dir: "/w/project/renders" })] })], [file(named(P_MAIN, "13.56"))]), NONE);
    assert.deepEqual(got.mentions, []);
  });
});

describe("C7. a part the last finish took", () => {
  const BEFORE = (key) => finishedWith(key);
  it("is kept when its export is the one the last finish took, the same size and time", () => {
    const got = lookForExports(found([main({ changed: ms(13, 40) })], [file(named(P_MAIN, "13.56"), { bytes: 5000, mtimeMs: ms(14, 0) })], [], BEFORE("main")), NONE);
    assert.deepEqual([got.asks, got.parts.map((p) => [p.kept, p.video, p.line])], [[], [[true, null, "The main video: kept as the last finish made it."]]]);
  });
  it("is kept when no export is left, since the last finish removed the one it took", () => {
    const got = lookForExports(found([main({ changed: ms(13, 40) })], [], [], BEFORE("main")), NONE);
    assert.deepEqual([got.asks, got.stops, got.parts.map((p) => p.kept)], [[], [], [true]]);
  });
  it("is made again from an export newer than the one it took, or the same name with other bytes", () => {
    const newer = lookForExports(found([main()], [file(named(P_MAIN, "14.05"), { bytes: 6000 })], [], BEFORE("main")), NONE);
    assert.deepEqual([newer.parts[0].kept, newer.parts[0].video.name], [false, named(P_MAIN, "14.05")]);
    const changed = lookForExports(found([main()], [file(named(P_MAIN, "13.56"), { bytes: 5001 })], [], BEFORE("main")), NONE);
    assert.equal(changed.parts[0].kept, false);
  });
  it("asks when the project changed after the last finish and there is no new export, and keeps the part when she says it is final", () => {
    const ask = "The main video's project changed in HyperFrames, at 2026-10-20 14:20, after the last hand-off. Export it again from HyperFrames on This Mac, or say the last hand-off is final.";
    const asked = lookForExports(found([main({ changed: ms(14, 20) })], [], [], BEFORE("main")), NONE);
    assert.deepEqual([asked.asks, asked.parts], [[ask], []]);
    const final = lookForExports(found([main({ changed: ms(14, 20) })], [], [], BEFORE("main")), { final: ["main"] });
    assert.deepEqual([final.asks, final.parts.map((p) => p.kept)], [[], [true]]);
  });
  it("asks the same of an export that is no newer than the change, when it is the one the last finish took", () => {
    const got = lookForExports(found([main({ changed: ms(14, 20) })], [file(named(P_MAIN, "13.56"))], [], BEFORE("main")), NONE);
    assert.match(got.asks[0], /^The main video's newest export, .*, began at 2026-10-20 13:56, before you last changed it in HyperFrames, at 2026-10-20 14:20\./);
  });
  it("keeps a Reel the last finish finished that has no project in the record, so that it stays in the hand-off", () => {
    const before = BEFORE("main");
    const finished = { ...before, parts: { ...before.parts, "reel 3": { file: "final/r3.mov", bytes: 7, seconds: 7.7, source: { bytes: 7, mtimeMs: ms(13, 0) }, export: "final/r3.fcpxmld" }, "reel 1": { file: "final/r1.mov", bytes: 7, seconds: 7.7, source: { bytes: 7, mtimeMs: ms(13, 0) }, noHandEdits: true } } };
    const got = lookForExports(found([main()], [file(named(P_MAIN, "13.56"))], [], finished), { without: ["reel 3"] });
    assert.deepEqual(got.parts.map((p) => [p.key, p.label, p.reel, p.kept]), [["main", "the main video", undefined, true], ["reel 1", "Reel 1", 1, true], ["reel 3", "Reel 3", 3, true]]);
    assert.deepEqual(got.parts.slice(1).map((p) => p.line), ["Reel 1: kept as the last finish made it.", "Reel 3: kept as the last finish made it."]);
    assert.deepEqual([got.asks, got.stops], [[], []]);
  });
  it("leaves a Reel the last finish finished to the Final Cut look when it is told so: the main video went that way, and keeps it once", () => {
    const before = BEFORE("main");
    const finished = { ...before, parts: { ...before.parts, "reel 1": { file: "final/r1.mov", bytes: 7, seconds: 7.7, source: { bytes: 7, mtimeMs: ms(13, 0) }, noHandEdits: true } } };
    const got = lookForExports(found([reel2()], [file(named(P_REEL2, "14.03"))], [], finished), NONE, { rest: false });
    assert.deepEqual(got.parts.map((p) => p.key), ["reel 2"]);
    assert.deepEqual(lookForExports(found([reel2()], [file(named(P_REEL2, "14.03"))], [], finished), NONE).parts.map((p) => p.key), ["reel 2", "reel 1"]);
  });
  it("is not kept when it was taken from Final Cut (its record has no project), or from another project of the same episode", () => {
    const fromFinalCut = { revision: 1, at: FINISHED_AT, on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { main: { file: "final/x.mp4", bytes: 5000, seconds: 10, source: { bytes: 5000, mtimeMs: ms(14, 0) }, export: "final/x.fcpxmld" } } };
    assert.equal(lookForExports(found([main()], [], [], fromFinalCut), NONE).stops.length, 1);
    assert.equal(lookForExports(found([main()], [], [], finishedWith("main", { project: "Pricing- what to charge- main 2 3fa9c1" })), NONE).stops.length, 1);
  });
});

describe("C8. a project that is on the other Mac", () => {
  it("takes the newest released export without checking it against the project, and says it could not be checked", () => {
    const got = lookForExports(found([main({ here: false, changed: null, mac: "Sallie's laptop" })], [], [file(named(P_MAIN, "13.56")), file(named(P_MAIN, "13.20"))]), NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].line, `The main video: ${named(P_MAIN, "13.56")}, from what the other Mac released. Its project is on Sallie's laptop, so the export could not be checked against it.`);
  });
});

// --- exportsFound: what the folders and the app's records hold, read from the disk ---

describe("C2 (on a disk). exportsFound: the projects of the record, their records, and the folders an export can be in", () => {
  const EPISODE = "2026-10-20 Pricing talk (Mac Studio)";
  /** A home with the episode's folders in it, the way the tool lays them out. */
  const made = () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-exports-home-"));
    const folder = join(home, "Episodes", EPISODE);
    const downloads = downloadsFolder(home);
    mkdirSync(downloads, { recursive: true });
    mkdirSync(join(folder, "edit", "from-hyperframes"), { recursive: true });
    const work = episodeWork(home, EPISODE);
    const project = (name) => {
      const dir = join(work, name);
      mkdirSync(join(dir, "renders"), { recursive: true });
      return dir;
    };
    const put = (path, seconds, text = "an export") => {
      writeFileSync(path, text);
      utimesSync(path, new Date(ms(14, 0, seconds)), new Date(ms(14, 0, seconds)));
    };
    const asked = (record, over = {}) => exportsFound({ home, name: EPISODE, folder, record, zone, ...over });
    return { home, folder, downloads, work, project, put, asked, done: () => rmSync(home, { recursive: true, force: true }) };
  };
  const entry = (key, name, over = {}) => ({ key, name, state: "opened", on: "Mac Studio", fromSuggestion: key === "main" ? null : 2, ...over });
  const recordOf = (...projects) => ({ app: { toolchain: "0.8.208", projects }, finished: null });
  /** A record of the app's, A0's fixture with the file it names filled in. */
  const meta = (fixtureName, where) => filled(fixtureName).replace("/Users/sallie/Downloads", where);

  it("gives the main project in use first and the Reel projects by number, and leaves out a project kept for an earlier kind", () => {
    const w = made();
    const got = w.asked(recordOf(entry("reel 10", "P reel 10 3fa9c1"), entry("reel 2", P_REEL2), entry("main", "P main 2 3fa9c1", { state: "kept for an earlier kind" }), entry("main", P_MAIN, { state: "made" })));
    assert.deepEqual(got.input.parts.map((p) => [p.key, p.label, p.reel, p.project, p.fromSuggestion]), [
      ["main", "the main video", undefined, P_MAIN, null], ["reel 2", "Reel 2", 2, P_REEL2, 2], ["reel 10", "Reel 10", 10, "P reel 10 3fa9c1", 2]
    ]);
    assert.equal(got.unreadable, false);
    w.done();
  });
  it("gives nothing for a record with no projects, and passes the last finish on", () => {
    const w = made();
    assert.deepEqual(w.asked({}).input.parts, []);
    const finished = { revision: 1, at: FINISHED_AT, on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: {} };
    assert.equal(w.asked({ app: { toolchain: "0.8.208", projects: [] }, finished }).input.finished, finished);
    w.done();
  });
  it("says whether a project's folder is on this Mac, who made it, and when it last changed", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    w.put(join(dir, "index.html"), 30);
    const got = w.asked(recordOf(entry("main", P_MAIN, { on: "Sallie's laptop" }), entry("reel 2", P_REEL2)));
    assert.deepEqual(got.input.parts.map((p) => [p.here, p.mac, p.changed]), [[true, "Sallie's laptop", ms(14, 0, 30)], [false, "Mac Studio", null]]);
    w.done();
  });
  it("takes a project name that leads nowhere a folder is for a folder that is not here", () => {
    const w = made();
    mkdirSync(join(w.work, "..", "elsewhere"), { recursive: true });
    const got = w.asked(recordOf(entry("main", "../elsewhere"), entry("reel 2", "a/b")));
    assert.deepEqual(got.input.parts.map((p) => p.here), [false, false]);
    w.done();
  });
  it("finds an export by its record: the file it names, at the second its name gives, in Downloads", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    const export_ = join(w.downloads, `${P_MAIN} 2026-10-20 13.56.mp4`);
    w.put(export_, 200, "twelve bytes");
    writeFileSync(join(dir, "renders", `${P_MAIN}_2026-10-20_13-56-40.meta.json`), meta("main.meta.json", w.downloads));
    const [part] = w.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(part.recorded, [{ name: `${P_MAIN} 2026-10-20 13.56.mp4`, dir: w.downloads, where: "Downloads", bytes: 12, mtimeMs: ms(14, 0, 200), began: { ms: ms(13, 56, 40), exact: true } }]);
    assert.deepEqual(part.renders, []);
    w.done();
  });
  it("names the folder an export went to when it is not Downloads, and when Downloads is a link, the link's own path", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    const desktop = join(w.home, "Desktop");
    mkdirSync(desktop);
    w.put(join(desktop, "final.mp4"), 10);
    writeFileSync(join(dir, "renders", `${P_MAIN}_2026-10-20_13-56-40.meta.json`), meta("main.meta.json", desktop).replace(/[^/"]+2026-10-20 13\.56\.mp4/, "final.mp4"));
    const [part] = w.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(part.recorded.map((r) => [r.name, r.dir, r.where]), [["final.mp4", desktop, "another folder"]]);
    w.done();
    // Downloads as a link into Dropbox, as on the Mac Studio, and the record naming the folder behind the link.
    const link = made();
    rmSync(link.downloads, { recursive: true });
    const real = join(link.home, "Dropbox", "Mac", "Downloads");
    mkdirSync(real, { recursive: true });
    symlinkSync(real, link.downloads);
    const linked = link.project(P_MAIN);
    link.put(join(real, `${P_MAIN} 2026-10-20 13.56.mp4`), 10);
    writeFileSync(join(linked, "renders", `${P_MAIN}_2026-10-20_13-56-40.meta.json`), meta("main.meta.json", real));
    const [seen] = link.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(seen.recorded.map((r) => [r.dir, r.where]), [[link.downloads, "Downloads"]]);
    link.done();
  });
  it("passes over a record that says it failed, one whose file is gone, one that names no file, one whose file is no video, and a name it cannot read", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    const meta_ = (name, text) => writeFileSync(join(dir, "renders", name), text);
    meta_(`${P_MAIN}_2026-10-20_13-01-00.meta.json`, fixture("failed.meta.json"));
    meta_(`${P_MAIN}_2026-10-20_13-02-00.meta.json`, meta("main.meta.json", w.downloads).replace("13.56.mp4", "13.02.mp4"));
    meta_(`${P_MAIN}_2026-10-20_13-03-00.meta.json`, JSON.stringify({ status: "complete" }));
    w.put(join(w.downloads, "notes.txt"), 5);
    meta_(`${P_MAIN}_2026-10-20_13-04-00.meta.json`, JSON.stringify({ status: "complete", exportedTo: join(w.downloads, "notes.txt") }));
    w.put(join(w.downloads, `${P_MAIN} 2026-10-20 13.05.mp4`), 5);
    meta_(`${P_MAIN}_13-05.meta.json`, JSON.stringify({ status: "complete", exportedTo: join(w.downloads, `${P_MAIN} 2026-10-20 13.05.mp4`) }));
    meta_(`${P_MAIN}_2026-10-20_13-06-00.meta.json`, "not json at all");
    const [part] = w.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(part.recorded, []);
    w.done();
  });
  it("passes over a record's file that is a folder, and counts a WebM it names for what it is", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    mkdirSync(join(w.downloads, "folder.mp4"));
    writeFileSync(join(dir, "renders", `${P_MAIN}_2026-10-20_13-01-00.meta.json`), JSON.stringify({ status: "complete", exportedTo: join(w.downloads, "folder.mp4") }));
    w.put(join(w.downloads, `${P_MAIN} 2026-10-20 13.02.webm`), 5);
    writeFileSync(join(dir, "renders", `${P_MAIN}_2026-10-20_13-02-00.meta.json`), JSON.stringify({ status: "complete", exportedTo: join(w.downloads, `${P_MAIN} 2026-10-20 13.02.webm`) }));
    const [part] = w.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(part.recorded.map((r) => r.name), [`${P_MAIN} 2026-10-20 13.02.webm`]);
    w.done();
  });
  it("lists the videos in the project's renders/ that no record names, and not the ones a record names, nor the records", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    const exported = join(dir, "renders", "kept-here.mp4");
    w.put(exported, 5);
    w.put(join(dir, "renders", `${P_MAIN}_2026-10-20_13-58-02.mp4`), 6);
    w.put(join(dir, "renders", "notes.txt"), 7);
    w.put(join(dir, "renders", ".hidden.mp4"), 7);
    writeFileSync(join(dir, "renders", `${P_MAIN}_2026-10-20_13-56-40.meta.json`), JSON.stringify({ status: "complete", exportedTo: exported }));
    const [part] = w.asked(recordOf(entry("main", P_MAIN))).input.parts;
    assert.deepEqual(part.renders.map((r) => [r.name, r.dir]), [[`${P_MAIN}_2026-10-20_13-58-02.mp4`, join(dir, "renders")]]);
    assert.deepEqual(part.recorded.map((r) => [r.name, r.where]), [["kept-here.mp4", "another folder"]]);
    w.done();
  });
  it("reads no render-outputs.json: with or without it, the same is found", () => {
    const w = made();
    const dir = w.project(P_MAIN);
    w.put(join(w.downloads, `${P_MAIN} 2026-10-20 13.56.mp4`), 5);
    const without = w.asked(recordOf(entry("main", P_MAIN)));
    mkdirSync(join(dir, ".hyperframes"));
    writeFileSync(join(dir, ".hyperframes", "render-outputs.json"), fixture("render-outputs.json"));
    assert.deepEqual(w.asked(recordOf(entry("main", P_MAIN))).input.parts, without.input.parts);
    w.done();
  });
  it("lists the videos in Downloads and in what the other Mac released, with their sizes and times, and no other file", () => {
    const w = made();
    for (const name of ["a.mp4", "b.MOV", "c.m4v", "d.webm", "e.txt", ".f.mp4", "g.mp4.partial", "h"]) w.put(join(w.downloads, name), 5, "12345");
    mkdirSync(join(w.downloads, "i.mp4"));
    w.put(join(w.folder, "edit", "from-hyperframes", `${P_MAIN} 2026-10-20 13.56.mp4`), 9, "123456");
    const got = w.asked(recordOf(entry("main", P_MAIN))).input;
    assert.deepEqual(got.downloads.files.map((f) => f.name).sort(), ["a.mp4", "b.MOV", "c.m4v", "d.webm"]);
    assert.deepEqual(got.downloads.files.find((f) => f.name === "a.mp4"), { name: "a.mp4", bytes: 5, mtimeMs: ms(14, 0, 5) });
    assert.deepEqual([got.downloads.dir, got.released.dir], [w.downloads, join(w.folder, "edit", "from-hyperframes")]);
    assert.deepEqual(got.released.files, [{ name: `${P_MAIN} 2026-10-20 13.56.mp4`, bytes: 6, mtimeMs: ms(14, 0, 9) }]);
    w.done();
  });
  it("takes a Downloads folder that is not there, and a folder of released exports that is not there, for empty", () => {
    const w = made();
    rmSync(w.downloads, { recursive: true });
    rmSync(join(w.folder, "edit"), { recursive: true });
    const got = w.asked(recordOf(entry("main", P_MAIN)));
    assert.deepEqual([got.unreadable, got.input.downloads.files, got.input.released.files], [false, [], []]);
    w.done();
  });
  it("says so when this Mac will not let the tool look in Downloads", () => {
    const w = made();
    for (const code of ["EPERM", "EACCES"]) {
      const readdir = (dir, ...more) => {
        if (dir === w.downloads) throw Object.assign(new Error(`${code}: operation not permitted`), { code });
        return readdirSync(dir, ...more);
      };
      const got = w.asked(recordOf(entry("main", P_MAIN)), { readdir });
      assert.deepEqual([got.unreadable, got.input.downloads.files], [true, []], code);
    }
    w.done();
  });
});

describe("E4. the checks of an export (shapeFault, soundFault, colourNote)", () => {
  const upright = { width: 1080, height: 1920 };
  const wide = { width: 1920, height: 1080 };
  it("says a Reel is upright, and names the file when it is not", () => {
    assert.equal(shapeFault({ reel: 2 }, "A.mp4", upright, wide), "");
    assert.equal(shapeFault({ reel: 2 }, "A.mp4", wide, wide), "A.mp4 is wider than it is tall, and a Reel is upright.");
    assert.equal(shapeFault({ reel: 2 }, "A.mp4", { width: 1080, height: 1080 }, wide), "A.mp4 is square, and a Reel is upright.");
  });
  it("gives the main video the raw video's shape, a wide one's wide and an upright clip's upright", () => {
    assert.equal(shapeFault({ key: "main" }, "A.mp4", wide, wide), "");
    assert.equal(shapeFault({ key: "main" }, "A.mp4", upright, upright), "");
    assert.equal(shapeFault({ key: "main" }, "A.mp4", upright, wide), "A.mp4 is upright, and the main video has the raw video's shape: wider than it is tall.");
    assert.equal(shapeFault({ key: "main" }, "A.mp4", wide, upright), "A.mp4 is wider than it is tall, and the main video has the raw video's shape: upright.");
  });
  it("asks nothing of the main video's shape when the raw video's is not known", () => {
    for (const raw of [null, undefined, {}, { width: 0, height: 0 }]) assert.equal(shapeFault({ key: "main" }, "A.mp4", upright, raw), "");
  });
  it("wants sound, and says how to get it", () => {
    assert.equal(soundFault({ sound: true }, "A.mp4"), "");
    assert.equal(soundFault({ sound: false }, "A.mp4"), "A.mp4 has no sound. Export it again from HyperFrames with its sound.");
    assert.equal(soundFault(null, "A.mp4"), "A.mp4 has no sound. Export it again from HyperFrames with its sound.");
  });
  it("says nothing of BT.709, and nothing of tags that are not HDR", () => {
    assert.equal(colourNote({ primaries: "bt709", transfer: "bt709" }, "A.mp4"), "");
    assert.equal(colourNote({ primaries: "smpte170m", transfer: "smpte170m" }, "A.mp4"), "");
    assert.equal(colourNote({ primaries: "bt2020", transfer: "bt709" }, "A.mp4"), "");
    assert.equal(colourNote({ primaries: "bt709", transfer: "" }, "A.mp4"), "");
  });
  it("mentions a file with no colour tags, and goes on", () => {
    assert.equal(colourNote(null, "A.mp4"), "A.mp4 has no colour tags: check by eye that its colours look right.");
  });
  it("names HDR colour, HLG or PQ with BT.2020, and what to do if it looks wrong", () => {
    const hdr = "A.mp4 is tagged as HDR colour, which most players show washed out: check it by eye, and export it again in standard colour if it looks wrong.";
    assert.equal(colourNote({ primaries: "bt2020", transfer: "arib-std-b67" }, "A.mp4"), hdr);
    assert.equal(colourNote({ primaries: "bt2020", transfer: "smpte2084" }, "A.mp4"), hdr);
  });
  it("holds no path, no flag and no command name in what it says", () => {
    for (const text of [shapeFault({ reel: 1 }, "A 2026-10-20 13.56.mp4", wide, wide), soundFault(null, "A.mp4"), colourNote(null, "A.mp4"), colourNote({ primaries: "bt2020", transfer: "smpte2084" }, "A.mp4")]) assert.doesNotMatch(text, /\/|--|~|\bedit\.js\b|\bnode\b/, text);
  });
});

describe("E6. isExportOf: a name the app makes for the project", () => {
  it("is true for the project's export names, composed or decomposed, with a copy mark and any ending that is read", () => {
    assert.equal(isExportOf(`${MAIN} 2026-10-20 13.56.mp4`, MAIN), true);
    assert.equal(isExportOf(`${MAIN} 2026-10-20 13.56 (1).mov`, MAIN), true);
    assert.equal(isExportOf("Café talk main 3fa9c1 2026-10-20 13.56.mp4".normalize("NFD"), "Café talk main 3fa9c1"), true);
    assert.equal(isExportOf("Café talk main 3fa9c1 2026-10-20 13.56.mp4", "Café talk main 3fa9c1".normalize("NFD")), true);
  });
  it("is false for another project's name, a name the app does not make, and a project that only begins the same", () => {
    assert.equal(isExportOf(`${MAIN} 2026-10-20 13.56.mp4`, "Pricing- what to charge- reel 2 3fa9c1"), false);
    assert.equal(isExportOf("final.mp4", MAIN), false);
    assert.equal(isExportOf(`${MAIN} 2.mp4`, MAIN), false);
    assert.equal(isExportOf(`${MAIN} 2 2026-10-20 13.56.mp4`, MAIN), false);
    assert.equal(isExportOf(`${MAIN} 2026-10-20 13.56.mp4`, ""), false);
    assert.equal(isExportOf(null, MAIN), false);
  });
});
