// This Mac's own settings for episodes: which Mac it is, where BRIMM Video is on it, and where its checkout of brimm-video is.
// And the folders found from them. Each test has a home folder of its own, made for it
// and removed after: nothing here touches this Mac's own settings, BRIMM Video Work or Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { settingsFile, dropFolder, episodesFolder, importingFolder, workFolder, fromFinalCutFolder, backupsFolder, runsFolder, episodeWork, pushedFolder, libraryFor, writtenFile, pendingFolder, machineFault, settingsFault, readSettings, writeSettings, settingsMain } from "../settings.js";

const SETTINGS = fileURLToPath(new URL("../settings.js", import.meta.url));
const ROOT = "/Users/sallie/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video";
const CHECKOUT = "/Users/sallie/brimm-video";

/** One test's home folder, the settings a Mac might be given, and what the command line said. */
function setup() {
  const home = mkdtempSync(join(tmpdir(), "brimm-settings-"));
  const said = [];
  const asked = (...argv) => settingsMain(argv, { home, say: (line) => said.push(line) });
  return { home, said, asked, given: { machine: "Mac Studio", root: ROOT, checkout: CHECKOUT }, done: () => rmSync(home, { recursive: true, force: true }) };
}

describe("where this Mac keeps its settings, and the folders found from them", () => {
  it("keeps its settings in Application Support, on its own disk", () => {
    assert.equal(settingsFile("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/settings.json");
  });
  it("finds its drop folder, the episodes and the status files of imports in BRIMM Video", () => {
    assert.equal(dropFolder(ROOT, "Sallie's laptop"), `${ROOT}/Unedited Video/Sallie's laptop`);
    assert.equal(episodesFolder(ROOT), `${ROOT}/Episodes`);
    assert.equal(importingFolder(ROOT), `${ROOT}/Episodes/.importing`);
  });
  it("keeps its work in Final Cut in BRIMM Video Work, outside Dropbox: what Final Cut saves, the backups, the runs' own folders, and a folder, a library and the pushed copies for each episode", () => {
    assert.equal(workFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work");
    assert.equal(fromFinalCutFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work/From Final Cut");
    assert.equal(backupsFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work/Backups");
    assert.equal(runsFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work/.runs");
    assert.equal(pushedFolder("/Users/sallie", "2026-10-14 Pricing talk"), "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk/pushed");
    assert.equal(episodeWork("/Users/sallie", "2026-10-14 Pricing talk"), "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk");
    assert.equal(libraryFor("/Users/sallie", "2026-10-14 Pricing talk"), "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk/2026-10-14 Pricing talk.fcpbundle");
  });
  it("keeps what this Mac wrote of each record, and the late checks it has still to make, in Application Support", () => {
    assert.equal(writtenFile("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/written.json");
    assert.equal(pendingFolder("/Users/sallie"), "/Users/sallie/Library/Application Support/BRIMM Video/pending");
  });
});

describe("this Mac's settings", () => {
  it("are read back as they were written", () => {
    const t = setup();
    assert.equal(writeSettings(t.home, t.given), settingsFile(t.home));
    assert.deepEqual(readSettings(t.home), { settings: { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT } });
    t.done();
  });
  it("are written whole over the ones before, and leave nothing else beside them", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    writeSettings(t.home, { ...t.given, machine: "Sallie's laptop" });
    assert.deepEqual(readdirSync(dirname(settingsFile(t.home))), ["settings.json"]);
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), `{
  "version": 1,
  "machine": "Sallie's laptop",
  "root": "${ROOT}",
  "checkout": "${CHECKOUT}"
}
`);
    t.done();
  });
  it("are not written, and say why in plain words, when a value will not do", () => {
    const t = setup();
    assert.throws(() => writeSettings(t.home, { ...t.given, machine: "Mac: Studio" }), { message: 'a Mac\'s name cannot hold any of / \\ : * ? " < > |' });
    assert.throws(() => writeSettings(t.home, { ...t.given, root: "BRIMM Video" }), { message: "the path to BRIMM Video is not a whole path" });
    assert.throws(() => writeSettings(t.home, { ...t.given, checkout: "" }), { message: "the path to the checkout of brimm-video is not a whole path" });
    assert.ok(readSettings(t.home).why.startsWith("This Mac has no settings for episodes"));
    t.done();
  });
  it("say there are none when there is no file", () => {
    const t = setup();
    assert.deepEqual(readSettings(t.home), { why: `This Mac has no settings for episodes (${settingsFile(t.home)}).` });
    t.done();
  });
  it("say why they cannot be used when the file will not do", () => {
    const t = setup();
    const file = settingsFile(t.home);
    mkdirSync(dirname(file), { recursive: true });
    const good = { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT };
    assert.equal(settingsFault(good), "");
    const cases = [
      ["{", "it is not JSON"],
      ["[]", "they are not version 1 of brimm-video's settings"],
      [JSON.stringify({ ...good, version: 2 }), "they are not version 1 of brimm-video's settings"],
      [JSON.stringify({ ...good, machine: ".studio" }), "a Mac's name cannot start with a dot"],
      [JSON.stringify({ ...good, root: "Dropbox/BRIMM Video" }), "the path to BRIMM Video is not a whole path"],
      [JSON.stringify({ ...good, checkout: undefined }), "the path to the checkout of brimm-video is not a whole path"]
    ];
    for (const [text, why] of cases) {
      writeFileSync(file, text);
      assert.deepEqual(readSettings(t.home), { why: `This Mac's settings could not be read (${file}: ${why}).` }, text);
    }
    t.done();
  });
  it("keep any field a later version of brimm-video adds, or an earlier draft wrote, such as claudeModel", () => {
    const t = setup();
    mkdirSync(dirname(settingsFile(t.home)), { recursive: true });
    writeFileSync(settingsFile(t.home), JSON.stringify({ version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, claudeModel: "claude-opus-5-5", studio: "/Users/sallie/BRIMM Video Studio" }));
    assert.equal(readSettings(t.home).settings.studio, "/Users/sallie/BRIMM Video Studio");
    assert.equal(readSettings(t.home).settings.claudeModel, "claude-opus-5-5");
    t.done();
  });
});

describe("a Mac's name", () => {
  it("may be any name of 40 characters or fewer that a folder in Dropbox can carry", () => {
    for (const fine of ["Mac Studio", "Sallie's laptop", "Sallie’s MacBook Pro (M4, 2024)", "Studio #2 & co.", "x".repeat(40)]) assert.equal(machineFault(fine), "", fine);
  });
  it("cannot be empty, longer than 40 characters, hold a character Dropbox calls incompatible or a control character, start or end with a space, or start with a dot", () => {
    const cases = [
      ["", "a Mac's name cannot be empty"],
      [undefined, "a Mac's name cannot be empty"],
      ["x".repeat(41), "a Mac's name can be 40 characters long at most"],
      ...["/", "\\", ":", "*", "?", '"', "<", ">", "|"].map((c) => [`Mac${c}Studio`, 'a Mac\'s name cannot hold any of / \\ : * ? " < > |']),
      ["Mac\tStudio", "a Mac's name cannot hold a control character, such as a tab or a line break"],
      ["Mac Studio\n", "a Mac's name cannot hold a control character, such as a tab or a line break"],
      [" Mac Studio", "a Mac's name cannot start or end with a space"],
      ["Mac Studio ", "a Mac's name cannot start or end with a space"],
      [".Mac Studio", "a Mac's name cannot start with a dot"]
    ];
    for (const [name, why] of cases) assert.equal(machineFault(name), why, JSON.stringify(name));
  });
});

describe("node settings.js", () => {
  it("writes the settings it is given, says where, and ends with 0", () => {
    const t = setup();
    assert.equal(t.asked("write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT), 0);
    assert.deepEqual(t.said, [`Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT });
    t.done();
  });
  it("takes what it is given in any order", () => {
    const t = setup();
    assert.equal(t.asked("write", "--checkout", CHECKOUT, "--root", ROOT, "--machine", "Sallie's laptop"), 0);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Sallie's laptop", root: ROOT, checkout: CHECKOUT });
    t.done();
  });
  it("refuses a value that will not do, says why, writes nothing, and ends with 1", () => {
    const t = setup();
    assert.equal(t.asked("write", "--machine", ".x", "--root", ROOT, "--checkout", CHECKOUT), 1);
    assert.equal(t.asked("write", "--machine", "Mac Studio", "--root", "BRIMM Video", "--checkout", CHECKOUT), 1);
    assert.deepEqual(t.said, ["Not written: a Mac's name cannot start with a dot.", "Not written: the path to BRIMM Video is not a whole path."]);
    assert.ok(readSettings(t.home).why.startsWith("This Mac has no settings for episodes"));
    t.done();
  });
  it("says so, and ends with 1, when the settings cannot be written", () => {
    const t = setup();
    writeFileSync(join(t.home, "Library"), "a file where a folder should be");
    assert.equal(t.asked("write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT), 1);
    assert.equal(t.said.length, 1);
    assert.match(t.said[0], /^This Mac's settings could not be written \((ENOTDIR|EEXIST)\)\.$/);
    t.done();
  });
  it("says how it is used, writes nothing, and ends with 2, when it is asked wrongly", () => {
    const t = setup();
    const wrongly = [
      [],
      ["what"],
      ["write", "--machine", "Mac Studio", "--root", ROOT],
      ["write", "--machine", "Mac Studio", "--root", ROOT, "--checkout"],
      ["write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT, "--rules-only"],
      ["write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT, "--claude-model", "claude-opus-5-5"],
      ["show", "Mac Studio"]
    ];
    for (const argv of wrongly) {
      t.said.length = 0;
      assert.equal(t.asked(...argv), 2, argv.join(" "));
      assert.equal(t.said.length, 1, argv.join(" "));
      assert.match(t.said[0], /^This Mac's settings for episodes/, argv.join(" "));
    }
    assert.ok(readSettings(t.home).why.startsWith("This Mac has no settings for episodes"));
    t.done();
  });
  it("says how it is used, and ends with 0, when it is asked to", () => {
    const t = setup();
    assert.equal(t.asked("--help"), 0);
    assert.match(t.said[0], /node settings\.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"/);
    assert.match(t.said[0], /node settings\.js show/);
    t.done();
  });
  it("shows the settings and the folders found from them, and ends with 0", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    assert.equal(t.asked("show"), 0);
    assert.deepEqual(t.said, [
      `This Mac's settings, in ${settingsFile(t.home)}:`,
      "  This Mac:  Mac Studio",
      `  BRIMM Video:  ${ROOT}`,
      `  Its drop folder:  ${ROOT}/Unedited Video/Mac Studio`,
      `  Episodes:  ${ROOT}/Episodes`,
      `  brimm-video, run from:  ${CHECKOUT}`,
      `  Work in Final Cut:  ${t.home}/BRIMM Video Work`,
      `  From Final Cut:  ${t.home}/BRIMM Video Work/From Final Cut`
    ]);
    t.done();
  });
  it("says why there are no settings and who sets this Mac up, and ends with 2", () => {
    const t = setup();
    assert.equal(t.asked("show"), 2);
    assert.deepEqual(t.said, [`This Mac has no settings for episodes (${settingsFile(t.home)}). Jason runs install.sh --machine on it.`]);
    t.done();
  });
  it("runs from the command line, in the home folder HOME names", () => {
    const t = setup();
    const run = (...argv) => spawnSync(process.execPath, [SETTINGS, ...argv], { encoding: "utf8", env: { HOME: t.home, PATH: process.env.PATH } });
    const written = run("write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT);
    assert.deepEqual([written.status, written.stdout, written.stderr], [0, `Written: ${settingsFile(t.home)}\n`, ""]);
    const shown = run("show");
    assert.deepEqual([shown.status, shown.stdout.split("\n")[1]], [0, "  This Mac:  Mac Studio"]);
    t.done();
  });
});

describe("node settings.js marker", () => {
  /** A drop folder made for one test, and a clone that copies, as a stand-in for /bin/cp -c. */
  function dropped() {
    const t = setup();
    const drop = join(t.home, "BRIMM Video", "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    const clones = [];
    const clone = (from, to) => {
      clones.push(to);
      writeFileSync(to, readFileSync(from));
    };
    const marked = (...argv) => settingsMain(["marker", ...argv], { home: t.home, say: (line) => t.said.push(line), clone });
    return { ...t, drop, clones, marked, marker: join(drop, ".brimm-watched-by") };
  }
  it("marks a drop folder with this Mac's name, by the rule for writing into Dropbox, and ends with 0", () => {
    const t = dropped();
    assert.equal(t.marked(t.drop, "Mac Studio"), 0);
    assert.deepEqual([readFileSync(t.marker, "utf8"), t.clones, t.said], ["Mac Studio\n", [t.marker], [`Marked: ${t.marker}`]]);
    t.done();
  });
  it("marks it again for the same Mac, by a new file in place of the old one", () => {
    const t = dropped();
    t.marked(t.drop, "Mac Studio");
    assert.equal(t.marked(t.drop, "Mac Studio"), 0);
    assert.deepEqual([readFileSync(t.marker, "utf8"), t.clones.length], ["Mac Studio\n", 2]);
    t.done();
  });
  it("refuses a folder another Mac has marked, says so, changes nothing, and ends with 1", () => {
    const t = dropped();
    writeFileSync(t.marker, "Sallie's laptop\n");
    assert.equal(t.marked(t.drop, "Mac Studio"), 1);
    assert.deepEqual([readFileSync(t.marker, "utf8"), t.clones, t.said], ["Sallie's laptop\n", [], [`The folder ${t.drop} is watched by Sallie's laptop already. A drop folder is watched by one Mac only.`]]);
    t.done();
  });
  it("refuses a name a Mac cannot have, and says how it is used when it is asked wrongly", () => {
    const t = dropped();
    assert.equal(t.marked(t.drop, ".x"), 1);
    assert.equal(t.said[0], "Not marked: a Mac's name cannot start with a dot.");
    assert.equal(t.marked(t.drop), 2);
    assert.equal(t.marked(), 2);
    t.done();
  });
});
