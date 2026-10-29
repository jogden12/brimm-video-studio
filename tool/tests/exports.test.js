// HyperFrames' exports (plan PR 7; architecture 2026-10-27, section 8): how the app names an export and what it records of one, when an
// export began, and when its project last changed (groups A and B of the plan), and, below them, which export a part takes (group C).
// The shapes are A0's (architecture 8.1) with made-up names. The pure functions read no disk; the one that does (projectChange) is run
// on a folder made in the test's own temporary directory. No time here depends on the Mac the test runs on: a zone is given.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lutimesSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadsFolder } from "../settings.js";
import { turnsOf } from "../hyperframes.js";
import { exportNameOf, metaNameOf, metaOf, beganAt, fixedZone, lastChangeOf, projectChange } from "../exports.js";

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
