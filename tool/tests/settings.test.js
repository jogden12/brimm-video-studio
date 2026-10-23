// This Mac's own settings for episodes: which Mac it is, where BRIMM Video is on it, and where its checkout of brimm-video is.
// And the folders found from them. Each test has a home folder of its own, made for it
// and removed after: nothing here touches this Mac's own settings, BRIMM Video Work or Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFolder, studioFiles } from "../studio.js";
import { settingsFile, dropFolder, episodesFolder, importingFolder, workFolder, fromFinalCutFolder, runsFolder, episodeWork, pushedFolder, libraryFor, writtenFile, pendingFolder, machineFault, settingsFault, readSettings, writeSettings, settingsMain, lightImport, teachingsOn, teachingsLapsed } from "../settings.js";

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
  it("keeps its work in Final Cut in BRIMM Video Work, outside Dropbox: what Final Cut saves, the runs' own folders, and a folder, a library and the pushed copies for each episode", () => {
    assert.equal(workFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work");
    assert.equal(fromFinalCutFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work/From Final Cut");
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

describe("the switch's settings", () => {
  const BASE = { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT };
  const TEACHINGS = { on: true, at: "2026-10-22T20:00:00-04:00", accounts: { cli: "a@b.c", app: "a@b.c" } };
  it("keep every field a later write does not write", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    writeSettings(t.home, { import: "light", handoffVersion: 2, sessionTeachings: TEACHINGS, later: { x: 1 } });
    writeSettings(t.home, t.given);
    const s = readSettings(t.home).settings;
    assert.equal(s.import, "light");
    assert.equal(s.handoffVersion, 2);
    assert.equal(s.sessionTeachings.accounts.cli, "a@b.c");
    assert.deepEqual(s.later, { x: 1 });
    t.done();
  });
  it("change only the fields a write names, and keep the order of the file: the four first, then the rest", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    writeSettings(t.home, { import: "light" });
    writeSettings(t.home, { machine: "Sallie's laptop" });
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), `{
  "version": 1,
  "machine": "Sallie's laptop",
  "root": "${ROOT}",
  "checkout": "${CHECKOUT}",
  "import": "light"
}
`);
    t.done();
  });
  it("ignore a field given as undefined, and take sessionTeachings to null when it is told", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    writeSettings(t.home, { import: undefined, sessionTeachings: null });
    const s = readSettings(t.home).settings;
    assert.equal(s.import, "light");
    assert.equal(s.sessionTeachings, null);
    t.done();
  });
  it("are not made whole by a write of some fields when there is no file: the Mac, the path and the checkout are needed", () => {
    const t = setup();
    assert.throws(() => writeSettings(t.home, { import: "light" }), { message: "a Mac's name cannot be empty" });
    assert.ok(readSettings(t.home).why.startsWith("This Mac has no settings for episodes"));
    t.done();
  });
  it("start from the settings given when the file there is not JSON, or holds no object", () => {
    const t = setup();
    mkdirSync(dirname(settingsFile(t.home)), { recursive: true });
    for (const text of ["", "{", "not json", "[]", "null", '"settings"', "7"]) {
      writeFileSync(settingsFile(t.home), text);
      writeSettings(t.home, t.given);
      assert.deepEqual(readSettings(t.home), { settings: BASE }, text);
    }
    t.done();
  });
  it("are not written over, and say why, when the file there holds settings that will not do: the switch's fields are not lost", () => {
    const t = setup();
    mkdirSync(dirname(settingsFile(t.home)), { recursive: true });
    const cases = [
      [{ ...BASE, import: "ligth", sessionTeachings: TEACHINGS, later: 1 }, /import/],
      [{ ...BASE, handoffVersion: 3, import: "light" }, /hand-off/],
      [{ ...BASE, sessionTeachings: { ...TEACHINGS, accounts: {} } }, /teachings from sessions/],
      [{ ...BASE, version: 2, import: "light" }, /version 1/]
    ];
    for (const [held, why] of cases) {
      const text = JSON.stringify(held);
      writeFileSync(settingsFile(t.home), text);
      assert.throws(() => writeSettings(t.home, t.given), { message: why }, text);
      assert.equal(readFileSync(settingsFile(t.home), "utf8"), text, text);
      assert.deepEqual(readdirSync(dirname(settingsFile(t.home))), ["settings.json"], text);
    }
    t.done();
  });
  it("are mended by a write that gives what the file there had wrong or lacked, and keep the rest", () => {
    const t = setup();
    mkdirSync(dirname(settingsFile(t.home)), { recursive: true });
    writeFileSync(settingsFile(t.home), JSON.stringify({ ...BASE, import: "ligth", handoffVersion: 2, later: 1 }));
    writeSettings(t.home, { import: "light" });
    assert.deepEqual(readSettings(t.home), { settings: { ...BASE, import: "light", handoffVersion: 2, later: 1 } });
    writeFileSync(settingsFile(t.home), JSON.stringify({ version: 1, machine: "Mac Studio", sessionTeachings: TEACHINGS }));
    writeSettings(t.home, { root: ROOT, checkout: CHECKOUT });
    assert.deepEqual(readSettings(t.home), { settings: { ...BASE, sessionTeachings: TEACHINGS } });
    t.done();
  });
  it("are not written, and the file is left as it was, when a field of the switch will not do", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    const before = readFileSync(settingsFile(t.home), "utf8");
    assert.throws(() => writeSettings(t.home, { import: "heavy" }), { message: /import/ });
    assert.throws(() => writeSettings(t.home, { handoffVersion: 3 }), { message: /hand-off/ });
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.deepEqual(readdirSync(dirname(settingsFile(t.home))), ["settings.json"]);
    t.done();
  });
  it("have fields of the switch that are checked, in plain words, only when they are there", () => {
    assert.match(settingsFault({ ...BASE, import: "heavy" }), /import/);
    assert.match(settingsFault({ ...BASE, readings: "off" }), /readings/);
    assert.match(settingsFault({ ...BASE, readings: null }), /readings/);
    assert.match(settingsFault({ ...BASE, handoffVersion: 3 }), /hand-off/);
    assert.match(settingsFault({ ...BASE, handoffVersion: "2" }), /hand-off/);
    assert.match(settingsFault({ ...BASE, drop: "Elsewhere" }), /drop folder/);
    assert.match(settingsFault({ ...BASE, drop: "drop" }), /drop folder/);
    assert.equal(settingsFault({ ...BASE, import: "light", readings: false, handoffVersion: 2, drop: "Drop" }), "");
    assert.equal(settingsFault({ ...BASE, import: "full", readings: true, handoffVersion: 1, drop: "Unedited Video" }), "");
    assert.equal(settingsFault(BASE), "");
  });
  it("have a sessionTeachings that is off (absent, null or false), or whole: on, when it was turned on, and the two accounts", () => {
    assert.equal(settingsFault({ ...BASE, sessionTeachings: null }), "");
    assert.equal(settingsFault({ ...BASE, sessionTeachings: false }), "");
    assert.equal(settingsFault({ ...BASE, sessionTeachings: TEACHINGS }), "");
    const bad = [true, "on", [], {}, { ...TEACHINGS, on: false }, { ...TEACHINGS, on: "yes" }, { ...TEACHINGS, at: undefined }, { ...TEACHINGS, at: "yesterday" },
      { ...TEACHINGS, at: 1 }, { ...TEACHINGS, accounts: undefined }, { ...TEACHINGS, accounts: { cli: "a@b.c" } }, { ...TEACHINGS, accounts: { cli: "a@b.c", app: "" } },
      { ...TEACHINGS, accounts: { cli: " ", app: "a@b.c" } }, { ...TEACHINGS, accounts: { cli: 1, app: "a@b.c" } }];
    for (const sessionTeachings of bad) assert.match(settingsFault({ ...BASE, sessionTeachings }), /teachings from sessions/, JSON.stringify(sessionTeachings));
  });
  it("still refuse what they refused before", () => {
    assert.match(settingsFault({ ...BASE, version: 2 }), /version 1/);
    assert.match(settingsFault({ ...BASE, machine: ".x" }), /start with a dot/);
    assert.match(settingsFault({ ...BASE, root: "x" }), /BRIMM Video is not a whole path/);
    assert.match(settingsFault({ ...BASE, checkout: "x" }), /checkout of brimm-video is not a whole path/);
  });
  it("are a light import only when import says light", () => {
    assert.equal(lightImport({ ...BASE, import: "light" }), true);
    for (const s of [BASE, { ...BASE, import: "full" }, undefined, null]) assert.equal(lightImport(s), false);
  });
  it("have teachings from sessions that lapse 90 days after Jason turned them on", () => {
    const s = { ...BASE, sessionTeachings: TEACHINGS };
    assert.equal(teachingsOn(s, Date.parse("2026-10-22T20:00:00-04:00")), true);
    assert.equal(teachingsOn(s, Date.parse("2027-01-19T20:00:00-05:00")), true);
    assert.equal(teachingsOn(s, Date.parse("2027-01-21T20:00:00-05:00")), false);
    // The moment the 90 days are over, to the millisecond.
    const end = Date.parse("2026-10-22T20:00:00-04:00") + 90 * 24 * 60 * 60 * 1000;
    assert.equal(teachingsOn(s, end - 1), true);
    assert.equal(teachingsOn(s, end), false);
    assert.equal(teachingsOn(s, new Date(end - 1)), true);
  });
  it("have teachings from sessions off when the time they were turned on is later than now: a clock set back is not trusted", () => {
    const s = { ...BASE, sessionTeachings: TEACHINGS };
    const at = Date.parse(TEACHINGS.at);
    assert.equal(teachingsOn(s, at), true);
    assert.equal(teachingsOn(s, at - 1), false);
    assert.equal(teachingsOn(s, at - 24 * 60 * 60 * 1000), false);
    assert.equal(teachingsOn(s, new Date(at - 1)), false);
  });
  it("say the teachings lapsed only once 90 days have passed since a whole setting turned them on", () => {
    const s = { ...BASE, sessionTeachings: TEACHINGS };
    const end = Date.parse("2026-10-22T20:00:00-04:00") + 90 * 24 * 60 * 60 * 1000;
    assert.equal(teachingsLapsed(s, end - 1), false);
    assert.equal(teachingsLapsed(s, end), true);
    assert.equal(teachingsLapsed(s, new Date(end + 1)), true);
    // Turned on later than now is off, not lapsed; and a setting that is off or not whole has nothing to lapse.
    assert.equal(teachingsLapsed(s, Date.parse(TEACHINGS.at) - 1), false);
    for (const off of [BASE, { ...BASE, sessionTeachings: null }, { ...BASE, sessionTeachings: { ...TEACHINGS, on: false } }, { ...BASE, sessionTeachings: { ...TEACHINGS, accounts: { cli: "a@b.c" } } }, undefined]) {
      assert.equal(teachingsLapsed(off, end + 1), false, JSON.stringify(off));
    }
  });
  it("have teachings from sessions off unless they are there, on, and whole", () => {
    const now = Date.parse("2026-10-23T09:00:00-04:00");
    for (const s of [BASE, { ...BASE, sessionTeachings: null }, { ...BASE, sessionTeachings: { ...TEACHINGS, on: false } }, { ...BASE, sessionTeachings: { ...TEACHINGS, at: "yesterday" } },
      { ...BASE, sessionTeachings: { ...TEACHINGS, accounts: { cli: "a@b.c" } } }, { ...BASE, sessionTeachings: false }, undefined, null]) {
      assert.equal(teachingsOn(s, now), false, JSON.stringify(s));
    }
  });
  it("name the drop folder Unedited Video until the switch names Drop", () => {
    assert.equal(dropFolder("/r", "Mac Studio"), "/r/Unedited Video/Mac Studio");
    assert.equal(dropFolder("/r", "Mac Studio", "Drop"), "/r/Drop/Mac Studio");
    assert.equal(dropFolder("/r", "Mac Studio", undefined), "/r/Unedited Video/Mac Studio");
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
  it("writes her folder for Claude from this Mac's settings and the node it is given, says where, and ends with 0", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    assert.equal(t.asked("studio", "--node", "/opt/homebrew/bin/node"), 0);
    // The folder as the disk has it, which is the folder Claude Code runs in.
    const folder = realpathSync.native(studioFolder(t.home));
    assert.deepEqual(t.said, [`Written: ${folder}`]);
    assert.deepEqual(readFileSync(join(folder, ".claude", "settings.json"), "utf8"), studioFiles({ checkout: CHECKOUT, node: "/opt/homebrew/bin/node", folder })[".claude/settings.json"]);
    assert.ok(existsSync(join(folder, "Pictures")));
    t.done();
  });
  it("writes no folder for Claude, and ends with 2, without this Mac's settings or a whole path to node", () => {
    const t = setup();
    assert.equal(t.asked("studio", "--node", "/opt/homebrew/bin/node"), 2);
    assert.match(t.said.join("\n"), /^This Mac has no settings for episodes .* Jason runs install\.sh --machine on it\.$/);
    writeSettings(t.home, t.given);
    for (const argv of [["studio"], ["studio", "--node"], ["studio", "--node", "node"], ["studio", "/opt/homebrew/bin/node"], ["studio", "--node", "/opt/homebrew/bin/node", "more"]]) {
      t.said.length = 0;
      assert.equal(t.asked(...argv), 2, argv.join(" "));
      assert.match(t.said[0], /^This Mac's settings for episodes/, argv.join(" "));
    }
    assert.equal(existsSync(studioFolder(t.home)), false);
    t.done();
  });
  it("says how it is used, and ends with 0, when it is asked to", () => {
    const t = setup();
    assert.equal(t.asked("--help"), 0);
    assert.match(t.said[0], /node settings\.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to brimm-video>"/);
    assert.match(t.said[0], /node settings\.js show/);
    assert.match(t.said[0], /node settings\.js studio --node "<path to node>"/);
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

describe("node settings.js set and sessions", () => {
  const AT = new Date("2026-10-22T20:00:00-04:00");
  /** A Mac with settings, and the command line told what time it is. */
  function mac() {
    const t = setup();
    writeSettings(t.home, t.given);
    return { ...t, run: (...argv) => settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), now: AT }) };
  }
  const unchanged = (t) => assert.deepEqual(readSettings(t.home), { settings: { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT } });

  it("set changes the settings it is told, keeps the rest, says what changed, and ends with 0", () => {
    const t = mac();
    // The light import and the Drop folder are written here as a later brimm-video would: set refuses them until they are built.
    writeSettings(t.home, { import: "light", drop: "Drop", later: { x: 1 } });
    assert.equal(t.run("set", "--import", "full", "--readings", "off", "--handoff", "2", "--drop", "Unedited Video"), 0);
    assert.deepEqual(t.said, [
      "The import is now full (it was light).",
      "Readings are now off (they were on).",
      "The hand-off version is now 2 (it was 1).",
      "The drop folder is now Unedited Video (it was Drop).",
      `Written: ${settingsFile(t.home)}`
    ]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "full", readings: false, handoffVersion: 2, drop: "Unedited Video", later: { x: 1 } });
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "1", "--readings", "on"), 0);
    // Each change is said in the order it was told.
    assert.deepEqual(t.said, ["The hand-off version is now 1 (it was 2).", "Readings are now on (they were off).", `Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "full", readings: true, handoffVersion: 1, drop: "Unedited Video", later: { x: 1 } });
    t.done();
  });
  it("set takes one setting alone, in any order, and says so when nothing changes", () => {
    const t = mac();
    assert.equal(t.run("set", "--import", "full"), 0);
    assert.deepEqual(t.said, ["The import is full already."]);
    unchanged(t);
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "2"), 0);
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "2", "--readings", "off"), 0);
    assert.deepEqual(t.said, ["The hand-off version is 2 already.", "Readings are now off (they were on).", `Written: ${settingsFile(t.home)}`]);
    t.done();
  });
  it("set says the drop folder is Unedited Video already on a Mac whose settings name none, and changes nothing", () => {
    // A Mac set up before the switch has no drop field: its drop folder is Unedited Video.
    const t = mac();
    const before = readFileSync(settingsFile(t.home), "utf8");
    assert.equal("drop" in readSettings(t.home).settings, false);
    assert.equal(t.run("set", "--drop", "Unedited Video"), 0);
    assert.deepEqual(t.said, ["The drop folder is Unedited Video already."]);
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    unchanged(t);
    t.done();
  });
  it("set refuses a value that will not do, says what the setting takes, changes nothing, and ends with 1", () => {
    const t = mac();
    for (const [argv, said] of [
      [["--import", "heavy"], "Not changed: --import takes light or full."],
      [["--readings", "true"], "Not changed: --readings takes on or off."],
      [["--handoff", "3"], "Not changed: --handoff takes 1 or 2."],
      [["--handoff", "constructor"], "Not changed: --handoff takes 1 or 2."],
      [["--drop", "Elsewhere"], 'Not changed: --drop takes Drop or "Unedited Video".'],
      [["--import", "light", "--drop", "drop"], 'Not changed: --drop takes Drop or "Unedited Video".']
    ]) {
      t.said.length = 0;
      assert.equal(t.run("set", ...argv), 1, argv.join(" "));
      assert.deepEqual(t.said, [said], argv.join(" "));
    }
    unchanged(t);
    t.done();
  });
  it("set refuses the light import until her chat's question is built, and the Drop folder until it is, changes nothing, and ends with 1", () => {
    // Parts F and D take these refusals away.
    const t = mac();
    const LIGHT = "The light import needs the question in her chat, which is not built yet.";
    const DROP = "The Drop folder is not built yet.";
    for (const [argv, said] of [
      [["--import", "light"], LIGHT],
      [["--drop", "Drop"], DROP],
      [["--readings", "off", "--import", "light"], LIGHT],
      [["--drop", "Drop", "--handoff", "2"], DROP]
    ]) {
      t.said.length = 0;
      assert.equal(t.run("set", ...argv), 1, argv.join(" "));
      assert.deepEqual(t.said, [said], argv.join(" "));
    }
    unchanged(t);
    t.done();
  });
  it("set says how it is used, changes nothing, and ends with 2, when it is asked wrongly", () => {
    const t = mac();
    for (const argv of [["set"], ["set", "--import"], ["set", "light"], ["set", "--machine", "Elsewhere"], ["set", "--import", "light", "more"], ["set", "--cli-account", "a@b.c"]]) {
      t.said.length = 0;
      assert.equal(t.run(...argv), 2, argv.join(" "));
      assert.equal(t.said.length, 1, argv.join(" "));
      assert.match(t.said[0], /^This Mac's settings for episodes/, argv.join(" "));
    }
    unchanged(t);
    t.done();
  });
  it("set and sessions change nothing, and end with 2, on a Mac with no settings", () => {
    const t = setup();
    const run = (...argv) => settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), now: AT });
    assert.equal(run("set", "--readings", "off"), 2);
    assert.equal(run("sessions", "--teachings", "off"), 2);
    assert.deepEqual(t.said, [1, 2].map(() => `This Mac has no settings for episodes (${settingsFile(t.home)}). Jason runs install.sh --machine on it.`));
    assert.equal(existsSync(settingsFile(t.home)), false);
    t.done();
  });

  it("sessions turns teachings on with the two accounts and the time, says so, keeps the rest, and ends with 0", () => {
    const t = mac();
    writeSettings(t.home, { import: "light" });
    assert.equal(t.run("sessions", "--teachings", "on", "--cli-account", "jason@example.com", "--app-account", "sallie@example.com"), 0);
    const teachings = readSettings(t.home).settings.sessionTeachings;
    // The time is written as episodes write theirs: a local time with its offset.
    assert.match(teachings.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
    assert.equal(Date.parse(teachings.at), AT.getTime());
    assert.deepEqual(teachings, { on: true, at: teachings.at, accounts: { cli: "jason@example.com", app: "sallie@example.com" } });
    assert.equal(readSettings(t.home).settings.import, "light");
    assert.equal(teachingsOn(readSettings(t.home).settings, AT.getTime() + 89 * 86400000), true);
    assert.equal(teachingsOn(readSettings(t.home).settings, AT.getTime() + 91 * 86400000), false);
    assert.equal(t.said.length, 3);
    assert.match(t.said[0], /^Teachings from sessions are on from 2026-10-2\dT.*, for 90 days \(until 2027-01-2\d\)\.$/);
    assert.equal(t.said[1], "The claude command is signed in to jason@example.com; the Code tab shows sallie@example.com.");
    assert.equal(t.said[2], `Written: ${settingsFile(t.home)}`);
    t.done();
  });
  it("sessions turns them on again, for another 90 days, when they are on", () => {
    const t = mac();
    t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c");
    const later = new Date(AT.getTime() + 80 * 86400000);
    assert.equal(settingsMain(["sessions", "--teachings", "on", "--cli-account", "c@d.e", "--app-account", "a@b.c"], { home: t.home, say: () => {}, now: later }), 0);
    const s = readSettings(t.home).settings;
    assert.equal(Date.parse(s.sessionTeachings.at), later.getTime());
    assert.equal(s.sessionTeachings.accounts.cli, "c@d.e");
    t.done();
  });
  it("sessions turns teachings off, says so, and says so when they were off already", () => {
    const t = mac();
    assert.equal(t.run("sessions", "--teachings", "off"), 0);
    assert.deepEqual(t.said, ["Teachings from sessions were off already."]);
    unchanged(t);
    t.said.length = 0;
    t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c");
    t.said.length = 0;
    assert.equal(t.run("sessions", "--teachings", "off"), 0);
    assert.deepEqual(t.said, ["Teachings from sessions are off.", `Written: ${settingsFile(t.home)}`]);
    assert.equal(readSettings(t.home).settings.sessionTeachings, null);
    assert.equal(teachingsOn(readSettings(t.home).settings, AT.getTime()), false);
    t.done();
  });
  it("sessions says teachings were off already, and changes nothing, when the file has them as false", () => {
    const t = mac();
    writeSettings(t.home, { sessionTeachings: false });
    assert.equal(t.run("sessions", "--teachings", "off"), 0);
    assert.deepEqual(t.said, ["Teachings from sessions were off already."]);
    assert.equal(readSettings(t.home).settings.sessionTeachings, false);
    t.said.length = 0;
    assert.equal(t.run("show"), 0);
    assert.ok(t.said.every((line) => !line.includes("Teachings")));
    t.said.length = 0;
    assert.equal(t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c"), 0);
    assert.equal(teachingsOn(readSettings(t.home).settings, AT.getTime()), true);
    t.done();
  });
  it("write stops, says why, and leaves the file alone when the settings there will not do, as install.sh needs", () => {
    const t = mac();
    writeSettings(t.home, { import: "light" });
    t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c");
    const file = settingsFile(t.home);
    const text = readFileSync(file, "utf8").replace('"light"', '"ligth"');
    writeFileSync(file, text);
    t.said.length = 0;
    assert.equal(t.run("write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT), 1);
    assert.deepEqual(t.said, ['This Mac\'s settings could not be written (the import must be "full" or "light").']);
    assert.equal(readFileSync(file, "utf8"), text);
    t.done();
  });
  it("sessions refuses a blank account, turns nothing on, and ends with 1", () => {
    const t = mac();
    assert.equal(t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", " "), 1);
    assert.equal(t.run("sessions", "--teachings", "on", "--cli-account", "", "--app-account", "a@b.c"), 1);
    assert.deepEqual(t.said, Array(2).fill("Not changed: teachings need both accounts, the one the claude command is signed in to and the one the Code tab shows."));
    unchanged(t);
    t.done();
  });
  it("sessions says how it is used, changes nothing, and ends with 2, when it is asked wrongly", () => {
    const t = mac();
    const wrongly = [
      ["sessions"],
      ["sessions", "--teachings"],
      ["sessions", "--teachings", "maybe"],
      ["sessions", "--teachings", "on"],
      ["sessions", "--teachings", "on", "--cli-account", "a@b.c"],
      ["sessions", "--teachings", "on", "--app-account", "a@b.c"],
      ["sessions", "--teachings", "off", "--cli-account", "a@b.c", "--app-account", "a@b.c"],
      ["sessions", "--cli-account", "a@b.c", "--app-account", "a@b.c"],
      ["sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c", "--import", "light"]
    ];
    for (const argv of wrongly) {
      t.said.length = 0;
      assert.equal(t.run(...argv), 2, argv.join(" "));
      assert.equal(t.said.length, 1, argv.join(" "));
      assert.match(t.said[0], /^This Mac's settings for episodes/, argv.join(" "));
    }
    unchanged(t);
    t.done();
  });

  it("write, as install.sh runs it, keeps the settings of the switch", () => {
    const t = mac();
    writeSettings(t.home, { import: "light", handoffVersion: 2 });
    t.run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c");
    const before = readSettings(t.home).settings;
    assert.deepEqual([before.import, before.handoffVersion, before.sessionTeachings.on], ["light", 2, true]);
    t.said.length = 0;
    assert.equal(t.run("write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT), 0);
    assert.deepEqual(t.said, [`Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, before);
    t.said.length = 0;
    assert.equal(t.run("write", "--machine", "Sallie's laptop", "--root", ROOT, "--checkout", CHECKOUT), 0);
    assert.deepEqual(readSettings(t.home).settings, { ...before, machine: "Sallie's laptop" });
    t.done();
  });
  it("show says the settings of the switch when there are some, and the drop folder the switch names", () => {
    const t = mac();
    writeSettings(t.home, { import: "light", readings: false, handoffVersion: 2, drop: "Drop" });
    t.run("sessions", "--teachings", "on", "--cli-account", "jason@example.com", "--app-account", "sallie@example.com");
    const at = readSettings(t.home).settings.sessionTeachings.at;
    t.said.length = 0;
    assert.equal(t.run("show"), 0);
    assert.deepEqual(t.said.slice(1), [
      "  This Mac:  Mac Studio",
      `  BRIMM Video:  ${ROOT}`,
      `  Its drop folder:  ${ROOT}/Drop/Mac Studio`,
      `  Episodes:  ${ROOT}/Episodes`,
      `  brimm-video, run from:  ${CHECKOUT}`,
      `  Work in Final Cut:  ${t.home}/BRIMM Video Work`,
      `  From Final Cut:  ${t.home}/BRIMM Video Work/From Final Cut`,
      "  Import:  light",
      "  Readings:  off",
      "  Hand-off version:  2",
      `  Teachings from sessions:  on, turned on ${at} (the claude command: jason@example.com; the Code tab: sallie@example.com)`
    ]);
    // After the 90 days it says they have lapsed.
    t.said.length = 0;
    assert.equal(settingsMain(["show"], { home: t.home, say: (line) => t.said.push(line), now: new Date(AT.getTime() + 91 * 86400000) }), 0);
    assert.equal(t.said.at(-1), `  Teachings from sessions:  lapsed, turned on ${at} (the claude command: jason@example.com; the Code tab: sallie@example.com)`);
    t.done();
  });
  it("--help says how set and sessions are used", () => {
    const t = setup();
    assert.equal(t.asked("--help"), 0);
    assert.match(t.said[0], /node settings\.js set \[--import light\|full\] \[--readings on\|off\] \[--handoff 1\|2\] \[--drop Drop\|"Unedited Video"\]/);
    assert.match(t.said[0], /node settings\.js sessions --teachings on --cli-account <email> --app-account <email>/);
    assert.match(t.said[0], /node settings\.js sessions --teachings off/);
    t.done();
  });
  it("runs set and sessions from the command line, in the home folder HOME names", () => {
    const t = mac();
    const run = (...argv) => spawnSync(process.execPath, [SETTINGS, ...argv], { encoding: "utf8", env: { HOME: t.home, PATH: process.env.PATH } });
    const set = run("set", "--readings", "off");
    assert.deepEqual([set.status, set.stdout, set.stderr], [0, `Readings are now off (they were on).\nWritten: ${settingsFile(t.home)}\n`, ""]);
    const on = run("sessions", "--teachings", "on", "--cli-account", "a@b.c", "--app-account", "a@b.c");
    assert.equal(on.status, 0);
    assert.equal(teachingsOn(readSettings(t.home).settings, Date.now()), true);
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
