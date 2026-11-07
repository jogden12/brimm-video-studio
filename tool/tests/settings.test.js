// This Mac's own settings for episodes: which Mac it is, where BRIMM Video is on it, and where its checkout of brimm-video is.
// And the folders found from them. Each test has a home folder of its own, made for it
// and removed after: nothing here touches this Mac's own settings, BRIMM Video Work or Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFolder, studioFiles, openSettingsOf, workshopFolder, ALLOW_DEFAULT } from "../studio.js";
import { claudeDirName, realOf } from "../places.js";
import { chatHeld } from "../held.js";
import { heldFolder } from "../scan.js";
import { settingsFile, dropFolder, episodesFolder, importingFolder, workFolder, runsFolder, episodeWork, writtenFile, pendingFolder, machineFault, settingsFault, readSettings, writeSettings, settingsMain, lightImport, teachingsOn, teachingsLapsed, SETTABLE, WRITTEN, lockOf, webOf, appOf, appHandoverOn, zoomFolderOf, studioAllowOf, proxyPortOf, studioNodeOf, effectiveLock, factsOf, isLocal, defaultDropFolder, dropFolderOf, episodeFilesFolder, importingFolderOf, statusFoldersOf, exportsFolderOf, exportsWords, cloudFolder, folderWords, dropFolderFault, exportsFolderFault, needsFilesAccess, transcriptFolders } from "../settings.js";
import { isMedia } from "../lib.js";
import { watched } from "./watched-fs.js";
import { newEpisode, recordFile, recordText } from "../episode.js";
import { writePending } from "../filing.js";

const SETTINGS = fileURLToPath(new URL("../settings.js", import.meta.url));
/** What Jason does about a setting in the file that will not do, as settings.js says it. */
const MEND_SETTING = "Jason puts that setting right by hand, or runs install.sh --machine on it, which writes this Mac's name, BRIMM Video and the checkout every time, the import, the hand-off version and the drop folder when told --import, --handoff or --drop, and readings off with --rules-only.";
const ROOT = "/Users/sallie/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video";
const CHECKOUT = "/Users/sallie/BRIMM Video Studio";

/** Whether the test's folders are on a disk whose names are not case-sensitive, as a Mac's own disk is unless it was made otherwise. */
const caseBlind = (() => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-case-"));
  try {
    mkdirSync(join(dir, "Case"));
    return existsSync(join(dir, "CASE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

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
  it("keeps its work in Final Cut in BRIMM Video Work, outside Dropbox: what Final Cut saves, the runs' own folders, and a folder for each episode", () => {
    assert.equal(workFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work");
    assert.equal(runsFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Work/.runs");
    assert.equal(episodeWork("/Users/sallie", "2026-10-14 Pricing talk"), "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk");
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
    assert.throws(() => writeSettings(t.home, { ...t.given, checkout: "" }), { message: "the path to the checkout of BRIMM Video Studio is not a whole path" });
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
      ["[]", "they are not version 1 of BRIMM Video Studio's settings"],
      [JSON.stringify({ ...good, version: 2 }), "they are not version 1 of BRIMM Video Studio's settings"],
      [JSON.stringify({ ...good, machine: ".studio" }), "a Mac's name cannot start with a dot"],
      [JSON.stringify({ ...good, root: "Dropbox/BRIMM Video" }), "the path to BRIMM Video is not a whole path"],
      [JSON.stringify({ ...good, checkout: undefined }), "the path to the checkout of BRIMM Video Studio is not a whole path"]
    ];
    for (const [text, why] of cases) {
      writeFileSync(file, text);
      assert.deepEqual(readSettings(t.home), { why: `This Mac's settings could not be read (${file}: ${why}).` }, text);
    }
    t.done();
  });
  it("keep any field a later version of BRIMM Video Studio adds, or an earlier draft wrote, such as claudeModel", () => {
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
  it("check the editing app and the handover of her chat to it, only when they are there", () => {
    assert.match(settingsFault({ ...BASE, app: "final cut" }), /editing app/);
    assert.match(settingsFault({ ...BASE, app: true }), /editing app/);
    assert.match(settingsFault({ ...BASE, appHandover: "on" }), /handed to the app/);
    assert.equal(settingsFault({ ...BASE, app: "hyperframes", appHandover: true }), "");
    assert.equal(settingsFault({ ...BASE, app: "off", appHandover: false }), "");
  });
  it("say the editing app is HyperFrames, and her chat is handed to it, only when this Mac's settings turn them on", () => {
    assert.equal(appOf(BASE), "");
    assert.equal(appOf({ ...BASE, app: "off" }), "");
    assert.equal(appOf({ ...BASE, app: "hyperframes" }), "hyperframes");
    assert.equal(appHandoverOn(BASE), false);
    assert.equal(appHandoverOn({ ...BASE, appHandover: false }), false);
    assert.equal(appHandoverOn({ ...BASE, appHandover: true }), true);
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
    assert.match(settingsFault({ ...BASE, checkout: "x" }), /checkout of BRIMM Video Studio is not a whole path/);
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

describe("this Mac's lock settings (the open lock, K1)", () => {
  const good = { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT };
  it("keeps the lock strict, the web tools held and Zoom's folder in Documents when the settings say nothing", () => {
    assert.deepEqual([lockOf({}), lockOf({ lock: "open" }), lockOf(undefined), webOf({}), webOf({ web: "open" })], ["strict", "open", "strict", "held", "open"]);
    assert.equal(zoomFolderOf({}, "/Users/sallie"), "/Users/sallie/Documents/Zoom");
    assert.equal(zoomFolderOf({ zoomFolder: "/Users/sallie/Zoom recordings" }, "/Users/sallie"), "/Users/sallie/Zoom recordings");
    assert.deepEqual([studioAllowOf({}), proxyPortOf({}), studioNodeOf({}), studioNodeOf(undefined)], [[], null, null, null]);
    assert.deepEqual([proxyPortOf({ proxyPort: 47123 }), studioNodeOf({ studioNode: "/opt/homebrew/bin/node" })], [47123, "/opt/homebrew/bin/node"]);
    assert.equal(settingsFault({ ...good, lock: "strict", web: "held", zoomFolder: "/Users/sallie/Documents/Zoom", proxyPort: 47123, studioNode: "/opt/homebrew/bin/node", studioAllow: [] }), "");
  });
  it("refuses a lock, a web setting, a Zoom folder, a proxy port or a node that will not do", () => {
    for (const [more, why] of [[{ lock: "loose" }, 'the lock must be "strict" or "open"'], [{ web: "on" }, 'the web tools must be "held" or "open"'], [{ zoomFolder: "Zoom" }, "the Zoom folder is not a whole path"], [{ proxyPort: 80 }, "the proxy port must be a whole number from 1024 to 65535"], [{ proxyPort: 47123.5 }, "the proxy port must be a whole number from 1024 to 65535"], [{ studioNode: "node" }, "the node her folder was written with is not a whole path"]])
      assert.equal(settingsFault({ ...good, ...more }), why);
  });
  it("keeps an entry her folder allows only when it is typed and exact, and never one on the never list", () => {
    const WHY = "an entry her folder allows must be a skill by its name, a connector's tool by its exact name, or a tool the never list does not hold";
    const id = "mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__";
    for (const ok of [{ type: "skill", name: "theme-factory" }, { type: "mcp-tool", name: id + "list_designs" }, { type: "tool", name: "CronCreate" }, { type: "tool", name: "CronDelete" }, { type: "tool", name: "CronList" }]) assert.equal(settingsFault({ ...good, studioAllow: [ok] }), "");
    for (const bad of [{ type: "skill", name: "../x" }, { type: "mcp-tool", name: "mcp__PDF_Tools__fill_pdf" }, { type: "mcp-tool", name: id + "*" }, { type: "mcp-tool", name: id + "send_invoice" }, { type: "tool", name: "Monitor" }, { type: "tool", name: "NotebookEdit" }, { type: "tool", name: "Workflow" }, { type: "tool", name: "Artifact" }, { type: "tool", name: "Read(~/.ssh/id)" }, { type: "tool", name: "Read" + "(x)" }, { type: "tool", name: "cronCreate" }, { type: "tool", name: "Cron Create" }, ...["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill", "Agent", "Task", "SendUserFile", "WebFetch", "WebSearch", "AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch", "ReadMcpResourceTool", "ListMcpResourcesTool", "ReadMcpResourceDirTool"].map((name) => ({ type: "tool", name })), { type: "plugin", name: "x" }, "brimm-edit"])
      assert.equal(settingsFault({ ...good, studioAllow: [bad] }), WHY, JSON.stringify(bad));
    assert.equal(settingsFault({ ...good, studioAllow: { type: "skill", name: "theme-factory" } }), WHY);
  });
  it("takes a lock, web, Zoom folder, proxy port, node or allowed list of null as not set, and shows none of them", () => {
    const unset = { lock: null, web: null, zoomFolder: null, proxyPort: null, studioNode: null, studioAllow: null };
    assert.equal(settingsFault({ ...good, ...unset }), "");
    assert.deepEqual([lockOf(unset), webOf(unset), zoomFolderOf(unset, "/Users/sallie"), studioAllowOf(unset), proxyPortOf(unset), studioNodeOf(unset)], ["strict", "held", "/Users/sallie/Documents/Zoom", [], null, null]);
    const t = setup();
    writeSettings(t.home, t.given);
    assert.equal(t.asked("show"), 0);
    const today = [...t.said];
    t.said.length = 0;
    writeSettings(t.home, unset);
    assert.equal(t.asked("show"), 0);
    assert.deepEqual(t.said, today);
    t.done();
  });
  it("shows the lock, the web tools, Zoom's folder, the entries allowed and the proxy port, each only when it is set", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    assert.equal(t.asked("show"), 0);
    const today = [...t.said];
    t.said.length = 0;
    writeSettings(t.home, { lock: "open", web: "held", zoomFolder: join(t.home, "Zoom recordings"), proxyPort: 47123, studioAllow: [{ type: "skill", name: "theme-factory" }], studioNode: "/opt/homebrew/bin/node" });
    assert.equal(t.asked("show"), 0);
    assert.deepEqual(t.said, [
      ...today,
      "  Her folder's lock:  open",
      "  The web tools:  held",
      `  Zoom's recordings:  ${t.home}/Zoom recordings`,
      "  Also allowed in her folder:  skill theme-factory",
      "  Her folder's proxy port:  47123"
    ]);
    t.done();
  });
});

describe("node settings.js studio, for both locks (the open lock, K1)", () => {
  const NODE = "/opt/homebrew/bin/node";
  const MINIMUM = "2.1.308";
  const NOT_YET = 'Not changed: the open lock waits for the checks by hand in the Code tab (the design\'s "By hand before K1 ships"). Her folder keeps the strict lock.';
  /** One test's made-up Mac: BRIMM Video and Claude Code's temp folder inside its home, never this Mac's own. `run(minimum, …argv)`
      runs settings.js with that minimum, the made-up temp folder and uid, and a stand-in that picks port 47123 and counts its calls. */
  function studioWorld() {
    const t = setup();
    const root = join(t.home, "Dropbox", "The BRIMM DB", "BRIMM Video");
    const tmp = join(t.home, "tmp");
    mkdirSync(root, { recursive: true });
    mkdirSync(tmp);
    writeSettings(t.home, { ...t.given, root });
    let ports = 0;
    const run = (openMinimum, ...argv) => {
      t.said.length = 0;
      return settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), openMinimum, tmp, uid: 502, freePort: () => {
        ports += 1;
        return 47123;
      } });
    };
    const folder = () => realpathSync.native(studioFolder(t.home));
    const written = () => readFileSync(join(folder(), ".claude", "settings.json"), "utf8");
    const settings = () => readSettings(t.home).settings;
    const facts = () => factsOf(t.home, settings(), { tmp, uid: 502 });
    return { ...t, root, tmp, run, ports: () => ports, folder, written, settings, facts };
  }

  it("writes her folder with the strict lock unless this Mac's settings say open", () => {
    const t = studioWorld();
    const before = readFileSync(settingsFile(t.home), "utf8");
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()}`]);
    assert.equal(t.written(), studioFiles({ checkout: CHECKOUT, node: NODE, folder: t.folder() })[".claude/settings.json"]);
    // A strict write leaves this Mac's settings as they were: no lock, no node, no port.
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(existsSync(workshopFolder(t.home)), false);
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "strict"), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()}`]);
    assert.deepEqual([t.settings().lock, t.settings().studioNode, t.settings().proxyPort], ["strict", undefined, undefined]);
    assert.equal(t.written(), studioFiles({ checkout: CHECKOUT, node: NODE, folder: t.folder() })[".claude/settings.json"]);
    assert.equal(t.ports(), 0);
    t.done();
  });
  it("writes the strict folder for settings that say open while no Claude Code is named for the open lock", () => {
    const t = studioWorld();
    writeSettings(t.home, { lock: "open" });
    const before = readFileSync(settingsFile(t.home), "utf8");
    assert.equal(t.run(null, "studio", "--node", NODE), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()}`]);
    assert.equal(t.written(), studioFiles({ checkout: CHECKOUT, node: NODE, folder: t.folder() })[".claude/settings.json"]);
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(existsSync(workshopFolder(t.home)), false);
    assert.deepEqual([effectiveLock({ lock: "open" }, null), effectiveLock({ lock: "open" }), effectiveLock({ lock: "open" }, MINIMUM), effectiveLock({}, MINIMUM), effectiveLock(undefined, MINIMUM)], ["strict", "strict", "open", "strict", "strict"]);
    t.done();
  });
  it("refuses the open lock, writing nothing, until the Claude Code it was checked on is named", () => {
    const t = studioWorld();
    const before = readFileSync(settingsFile(t.home), "utf8");
    assert.equal(t.run(null, "studio", "--node", NODE, "--lock", "open", "--web", "open", "--zoom", join(t.home, "Zoom")), 1);
    assert.equal(t.said.at(-1), NOT_YET);
    const s = readSettings(t.home).settings;
    assert.deepEqual([s.lock, s.web, s.zoomFolder, s.studioNode], [undefined, undefined, undefined, undefined]);
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(existsSync(workshopFolder(t.home)), false);
    assert.equal(existsSync(studioFolder(t.home)), false);
    t.done();
  });
  it("writes the open lock, the workshop and a proxy port picked once, when the minimum is named", () => {
    const t = studioWorld();
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "open"), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()} (the open lock)`]);
    assert.deepEqual([t.settings().lock, t.settings().proxyPort, t.settings().studioNode], ["open", 47123, NODE]);
    assert.deepEqual(t.facts(), { home: t.home, root: t.root, uid: 502, tmp: realOf(t.tmp), zoomFolder: join(t.home, "Documents", "Zoom"), dropFolder: join(t.root, "Unedited Video", "Mac Studio"), port: 47123, web: "held", allow: ALLOW_DEFAULT });
    const files = studioFiles({ checkout: CHECKOUT, node: NODE, folder: t.folder(), lock: "open", facts: t.facts() });
    for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(t.folder(), name), "utf8"), text, name);
    assert.equal(statSync(workshopFolder(t.home)).mode & 0o777, 0o700);
    assert.equal(t.ports(), 1);
    // Written again, the lock in effect is open from the settings, and the port is the one stored.
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()} (the open lock)`]);
    assert.equal(t.ports(), 1);
    assert.equal(t.written(), files[".claude/settings.json"]);
    // Another node is recorded as the one her folder was written with.
    assert.equal(t.run(MINIMUM, "studio", "--node", "/usr/local/bin/node"), 0);
    assert.equal(t.settings().studioNode, "/usr/local/bin/node");
    t.done();
  });
  it("writes an untied mark and takes away old command output when it first writes the open lock, and neither when the folder is open already", () => {
    const t = studioWorld();
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE), 0);
    const own = join(t.tmp, "claude-502", claudeDirName(t.folder()));
    const chat = "11111111-2222-4333-8444-555555555555";
    const output = join(own, chat, "tasks", "a.output");
    const elsewhere = join(t.tmp, "claude-502", "-another-folder", chat, "tasks", "b.output");
    for (const file of [output, elsewhere, join(own, chat, "tasks", "keep.txt")]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "x");
    }
    const marks = () => (existsSync(heldFolder(t.home)) ? readdirSync(heldFolder(t.home)).filter((n) => n.startsWith("mark-")) : []);
    assert.deepEqual(marks(), []);
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "open"), 0);
    assert.equal(marks().length, 1);
    assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(t.home), marks()[0]), "utf8")), { at: JSON.parse(readFileSync(join(heldFolder(t.home), marks()[0]), "utf8")).at, session: null, claude: null, tied: false });
    assert.deepEqual([existsSync(output), existsSync(elsewhere), existsSync(join(own, chat, "tasks", "keep.txt"))], [false, true, true]);
    const projects = join(t.home, ".claude", "projects", claudeDirName(t.folder()));
    mkdirSync(projects, { recursive: true });
    writeFileSync(join(projects, `${chat}.jsonl`), `${JSON.stringify({ type: "user", uuid: "u-1", timestamp: "2026-01-01T00:00:00.000Z" })}\n`);
    assert.equal(chatHeld({ home: t.home, sessionId: chat, transcriptPath: join(projects, `${chat}.jsonl`), claude: null }), true);
    writeFileSync(output, "x");
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE), 0);
    assert.equal(marks().length, 1);
    assert.equal(existsSync(output), true);
    // Strict again while no Claude Code is named for the open lock, then open again: chats of the strict time are held too.
    assert.equal(t.run(null, "studio", "--node", NODE), 0);
    assert.deepEqual(t.said, [`Written: ${t.folder()}`]);
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE), 0);
    assert.equal(marks().length, 2);
    assert.equal(existsSync(output), false);
    t.done();
  });
  it("writes the open lock first on a Mac with no folder for Claude with an untied mark too, and not at all when it cannot write one", () => {
    const t = studioWorld();
    mkdirSync(dirname(heldFolder(t.home)), { recursive: true });
    writeFileSync(heldFolder(t.home), "a file where the folder goes");
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "open"), 1);
    assert.match(t.said.at(-1), /^The folder for Claude could not be written \(the chats before the open lock could not be marked: /);
    assert.equal(existsSync(studioFolder(t.home)), false);
    assert.equal(existsSync(workshopFolder(t.home)), false);
    assert.equal(t.settings().lock, undefined);
    rmSync(heldFolder(t.home));
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "open"), 0);
    assert.equal(readdirSync(heldFolder(t.home)).filter((n) => n.startsWith("mark-")).length, 1);
    t.done();
  });
  it("keeps the web tools held until told --web open, and adds an allowed entry once, by its type and exact name", () => {
    const t = studioWorld();
    const allowed = () => JSON.parse(t.written()).permissions;
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--lock", "open"), 0);
    assert.ok(!allowed().allow.includes("WebFetch") && !allowed().allow.includes("WebSearch"));
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--web", "open"), 0);
    assert.equal(t.settings().web, "open");
    assert.deepEqual(allowed().allow.slice(-2), ["WebFetch", "WebSearch"]);
    for (let i = 0; i < 2; i++) assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--allow", "skill", "brand-review"), 0);
    assert.deepEqual(t.settings().studioAllow, [{ type: "skill", name: "brand-review" }]);
    assert.ok(allowed().deny.includes("CronCreate"));
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--allow", "tool", "CronCreate", "--web", "held"), 0);
    assert.deepEqual(t.settings().studioAllow, [{ type: "skill", name: "brand-review" }, { type: "tool", name: "CronCreate" }]);
    assert.ok(!allowed().deny.includes("CronCreate") && allowed().deny.includes("CronList"));
    assert.ok(!allowed().allow.includes("WebFetch"));
    assert.deepEqual(t.facts().allow, [...ALLOW_DEFAULT, { type: "skill", name: "brand-review" }, { type: "tool", name: "CronCreate" }]);
    // Told on a strict Mac, the settings are written, and the folder stays strict.
    const s = studioWorld();
    assert.equal(s.run(MINIMUM, "studio", "--node", NODE, "--web", "open", "--zoom", join(s.home, "Zoom recordings")), 0);
    assert.deepEqual([s.settings().web, s.settings().zoomFolder, s.settings().lock], ["open", join(s.home, "Zoom recordings"), undefined]);
    assert.equal(s.written(), studioFiles({ checkout: CHECKOUT, node: NODE, folder: s.folder() })[".claude/settings.json"]);
    s.done();
    t.done();
  });
  it("prints the folder's settings for a lock without writing anything", () => {
    const t = studioWorld();
    const before = readFileSync(settingsFile(t.home), "utf8");
    const folder = realOf(studioFolder(t.home));
    assert.equal(t.run(null, "studio", "--node", NODE, "--lock", "open", "--print"), 0);
    assert.equal(t.said.length, 1);
    const facts = { ...factsOf(t.home, { ...t.settings(), lock: "open" }, { tmp: t.tmp, uid: 502 }), port: "<port>" };
    assert.deepEqual(JSON.parse(t.said[0]), openSettingsOf({ checkout: CHECKOUT, node: NODE, folder, facts }));
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--print"), 0);
    assert.deepEqual(JSON.parse(t.said[0]), JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE, folder })[".claude/settings.json"]));
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(existsSync(studioFolder(t.home)), false);
    assert.equal(existsSync(workshopFolder(t.home)), false);
    t.done();
  });
  it("prints, with no --lock, the lock her folder would really get, and never picks a port to print", () => {
    const t = studioWorld();
    writeSettings(t.home, { lock: "open" });
    const folder = realOf(studioFolder(t.home));
    const strict = JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE, folder })[".claude/settings.json"]);
    assert.equal(t.run(null, "studio", "--node", NODE, "--print"), 0);
    assert.deepEqual(JSON.parse(t.said[0]), strict);
    assert.equal(t.run(null, "studio", "--node", NODE, "--lock", "open", "--print"), 0);
    assert.deepEqual(JSON.parse(t.said[0]).sandbox.network, { deniedDomains: ["*"], httpProxyPort: "<port>", socksProxyPort: "<port>" });
    assert.equal(t.run(MINIMUM, "studio", "--node", NODE, "--print"), 0);
    assert.equal(JSON.parse(t.said[0]).sandbox.network.httpProxyPort, "<port>");
    assert.equal(t.run(null, "studio", "--node", NODE, "--lock", "strict", "--print"), 0);
    assert.deepEqual(JSON.parse(t.said[0]), strict);
    writeSettings(t.home, { proxyPort: 47200 });
    assert.equal(t.run(null, "studio", "--node", NODE, "--lock", "open", "--print"), 0);
    assert.deepEqual(JSON.parse(t.said[0]).sandbox.network, { deniedDomains: ["*"], httpProxyPort: 47200, socksProxyPort: 47200 });
    assert.equal(t.ports(), 0);
    assert.equal(existsSync(studioFolder(t.home)), false);
    t.done();
  });
  it("refuses a studio line that will not do", () => {
    const t = studioWorld();
    const before = readFileSync(settingsFile(t.home), "utf8");
    for (const argv of [["studio"], ["studio", "--node"], ["studio", "--node", "node"], ["studio", "/opt/homebrew/bin/node"], ["studio", "--node", NODE, "more"], ["studio", "--lock", "open", "--node", NODE], ["studio", "--node", NODE, "--allow", "skill"], ["studio", "--node", NODE, "--lock"]]) {
      assert.equal(t.run(MINIMUM, ...argv), 2, argv.join(" "));
      assert.match(t.said[0], /^This Mac's settings for episodes/, argv.join(" "));
    }
    for (const [argv, why] of [
      [["--lock", "maybe"], 'the lock must be "strict" or "open"'],
      [["--web", "on"], 'the web tools must be "held" or "open"'],
      [["--allow", "mcp-tool", "mcp__PDF_Tools__fill_pdf"], "an entry her folder allows must be a skill by its name, a connector's tool by its exact name, or a tool the never list does not hold"],
      [["--allow", "plugin", "x"], "an entry her folder allows must be a skill by its name, a connector's tool by its exact name, or a tool the never list does not hold"],
      [["--zoom", "Zoom"], "the Zoom folder is not a whole path"]
    ]) {
      assert.equal(t.run(MINIMUM, "studio", "--node", NODE, ...argv), 1, argv.join(" "));
      assert.deepEqual(t.said, [`Not written: ${why}.`]);
    }
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(existsSync(studioFolder(t.home)), false);
    assert.equal(t.ports(), 0);
    t.done();
  });
  it("says how studio is used, with every option", () => {
    const t = setup();
    assert.equal(t.asked("--help"), 0);
    assert.ok(t.said[0].includes('node settings.js studio --node "<path to node>" [--lock strict|open] [--web held|open] [--zoom "<folder>"]'));
    assert.ok(t.said[0].includes("[--allow skill|mcp-tool|tool <name>]… [--print]"));
    t.done();
  });
});

describe("node settings.js user-deny: her user settings' Read deny rules (question 5, R24)", () => {
  /** One test's made-up Mac: BRIMM Video and Claude Code's temp folder in its home, never this Mac's own, and `run(…argv)`. */
  function userWorld({ lock = "open", minimum = "2.1.308" } = {}) {
    const t = setup();
    const home = realpathSync.native(t.home);
    const root = join(home, "Dropbox", "The BRIMM DB", "BRIMM Video");
    const tmp = join(home, "tmp");
    mkdirSync(root, { recursive: true });
    mkdirSync(tmp);
    // Her user settings get the rules only under the open lock (whole-branch review I2): this Mac's settings say open, and the
    // Claude Code version it was checked on is named, unless a test says otherwise.
    writeSettings(home, { ...t.given, root, ...(lock ? { lock } : {}) });
    const run = (...argv) => {
      t.said.length = 0;
      return settingsMain(argv, { home, say: (line) => t.said.push(line), openMinimum: minimum, tmp, uid: 502 });
    };
    const user = join(home, ".claude", "settings.json");
    const settings = () => readSettings(home).settings;
    /** The Read deny rules her folder's open settings have, for this Mac: the ones her user settings are to hold too. */
    const folderReads = () => openSettingsOf({ checkout: CHECKOUT, node: "/opt/homebrew/bin/node", folder: join(home, "BRIMM Video Studio"), facts: factsOf(home, settings(), { tmp, uid: 502 }) }).permissions.deny.filter((rule) => rule.startsWith("Read("));
    return { ...t, home, root, run, user, settings, folderReads };
  }

  it("adds the Read deny rules to her user settings once, keeps everything else in them, and notes that it did", () => {
    const t = userWorld();
    const want = t.folderReads();
    // Every gated place's rules, in both spellings, and the .env rules: some by hand.
    for (const rule of [`Read(/${join(t.root, "Episodes")}/**)`, `Read(//System/Volumes/Data${join(t.root, "Episodes")}/**)`, `Read(/${join(t.home, ".ssh")}/**)`, `Read(/${join(t.home, ".claude.json")})`, "Read(**/.env)", "Read(**/.env.*)"]) assert.ok(want.includes(rule), rule);
    assert.ok(!want.some((rule) => rule.includes(`${join(t.root, "Assets")}`)), "Assets is not kept from Claude");
    mkdirSync(dirname(t.user), { recursive: true });
    const hers = { model: "opus", permissions: { allow: ["Bash(ls:*)"], deny: ["Read(//Users/sallie/private/**)", want[3]], defaultMode: "default" }, hooks: { Stop: [] }, enabledPlugins: { "a@b": true } };
    writeFileSync(t.user, JSON.stringify(hers));
    for (let i = 0; i < 2; i++) {
      assert.equal(t.run("user-deny"), 0);
      assert.deepEqual(t.said, [`Written: ~/.claude/settings.json (${want.length} deny rules for the places only BRIMM Video Studio reads)`]);
      const now = JSON.parse(readFileSync(t.user, "utf8"));
      assert.deepEqual(now, { ...hers, permissions: { ...hers.permissions, deny: [...hers.permissions.deny, ...want.filter((rule) => rule !== want[3])] } });
    }
    assert.equal(t.settings().userDeny, true);
    // No file is left beside it, and a Mac with no user settings gets a file of the rules alone.
    assert.deepEqual(readdirSync(dirname(t.user)), ["settings.json"]);
    rmSync(t.user);
    assert.equal(t.run("user-deny"), 0);
    assert.deepEqual(JSON.parse(readFileSync(t.user, "utf8")), { permissions: { deny: want } });
    t.done();
  });
  it("writes through a link to her user settings, leaving the link where it is", () => {
    const t = userWorld();
    const elsewhere = join(t.home, "dotfiles", "claude-settings.json");
    mkdirSync(dirname(elsewhere), { recursive: true });
    mkdirSync(dirname(t.user), { recursive: true });
    writeFileSync(elsewhere, JSON.stringify({ model: "opus" }));
    symlinkSync(elsewhere, t.user);
    assert.equal(t.run("user-deny"), 0);
    assert.ok(lstatSync(t.user).isSymbolicLink());
    assert.deepEqual(JSON.parse(readFileSync(elsewhere, "utf8")), { model: "opus", permissions: { deny: t.folderReads() } });
    t.done();
  });
  it("keeps the mode her user settings had when it rewrites them, and gives a file it makes 0600 (earlier note d)", () => {
    const t = userWorld();
    mkdirSync(dirname(t.user), { recursive: true });
    for (const mode of [0o600, 0o640, 0o644]) {
      writeFileSync(t.user, JSON.stringify({ model: "opus" }));
      chmodSync(t.user, mode);
      assert.equal(t.run("user-deny"), 0);
      assert.equal(statSync(t.user).mode & 0o777, mode, mode.toString(8));
    }
    // Through a link, the file it leads to keeps its mode.
    const elsewhere = join(t.home, "dotfiles", "claude-settings.json");
    mkdirSync(dirname(elsewhere), { recursive: true });
    writeFileSync(elsewhere, JSON.stringify({ model: "opus" }));
    chmodSync(elsewhere, 0o600);
    rmSync(t.user);
    symlinkSync(elsewhere, t.user);
    assert.equal(t.run("user-deny"), 0);
    assert.equal(statSync(elsewhere).mode & 0o777, 0o600);
    // A file that was not there is made 0600.
    rmSync(t.user);
    assert.equal(t.run("user-deny"), 0);
    assert.equal(statSync(t.user).mode & 0o777, 0o600);
    t.done();
  });
  it("refuses user settings that are not a JSON object, changing nothing", () => {
    const t = userWorld();
    mkdirSync(dirname(t.user), { recursive: true });
    const before = readFileSync(settingsFile(t.home), "utf8");
    for (const text of ["not JSON", "[1, 2]", "null", '{"permissions": []}', '{"permissions": {"deny": "Read(x)"}}', '{"permissions": {"deny": [1]}}']) {
      writeFileSync(t.user, text);
      assert.equal(t.run("user-deny"), 1, text);
      assert.deepEqual(t.said, ["Her user settings could not be read as JSON, so nothing was added: Jason puts them right by hand."], text);
      assert.equal(readFileSync(t.user, "utf8"), text);
      assert.deepEqual(readdirSync(dirname(t.user)), ["settings.json"]);
    }
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    assert.equal(t.settings().userDeny, undefined);
    // Asked wrongly, or with no settings of this Mac's to find the places by, it writes nothing either.
    assert.equal(t.run("user-deny", "--now"), 2);
    assert.match(t.said[0], /^This Mac's settings for episodes/);
    rmSync(settingsFile(t.home));
    rmSync(t.user);
    assert.equal(t.run("user-deny"), 2);
    assert.equal(existsSync(t.user), false);
    t.done();
  });
  it("adds nothing on a Mac whose lock in effect is strict: settings that say strict or none, or open with no version checked (whole-branch review I2)", () => {
    const NOT_OPEN = "Not changed: her user settings get these deny rules only under the open lock, which waits for the checks by hand.";
    for (const [what, options] of [["strict settings", { lock: "strict" }], ["no lock set", { lock: null }], ["open, but no version checked", { minimum: null }]]) {
      const t = userWorld(options);
      mkdirSync(dirname(t.user), { recursive: true });
      const hers = JSON.stringify({ model: "opus", permissions: { deny: ["Read(//Users/sallie/private/**)"] } });
      writeFileSync(t.user, hers);
      const before = readFileSync(settingsFile(t.home), "utf8");
      assert.equal(t.run("user-deny"), 1, what);
      assert.deepEqual(t.said, [NOT_OPEN], what);
      assert.equal(readFileSync(t.user, "utf8"), hers, what);
      assert.deepEqual(readdirSync(dirname(t.user)), ["settings.json"], what);
      assert.equal(readFileSync(settingsFile(t.home), "utf8"), before, what);
      assert.equal(t.settings().userDeny, undefined, what);
      // Nor does it make the file on a Mac with none.
      rmSync(t.user);
      assert.equal(t.run("user-deny"), 1, what);
      assert.equal(existsSync(t.user), false, what);
      t.done();
    }
  });
  it("takes the note that her user settings were given the rules only as true or false", () => {
    const good = { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT };
    assert.equal(settingsFault({ ...good, userDeny: true }), "");
    assert.equal(settingsFault({ ...good, userDeny: false }), "");
    assert.equal(settingsFault({ ...good, userDeny: "yes" }), "the note of her user settings' deny rules must be true or false");
  });
  it("is named in --help", () => {
    const said = [];
    settingsMain(["--help"], { say: (line) => said.push(line) });
    assert.match(said.join("\n"), /\n {2}node settings\.js user-deny {2,}add/);
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
    assert.ok(existsSync(join(folder, "Scripts")), "Scripts/ is made beside Pictures/, for the scripts she puts there (PR H4)");
    assert.ok(existsSync(join(folder, ".claude", "skills", "brimm-edit", "script.md")), "script.md is written beside SKILL.md");
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
    assert.match(t.said[0], /node settings\.js write --machine "<this Mac>" --root "<path to BRIMM Video>" --checkout "<path to BRIMM Video Studio>"/);
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
      `  Exports from HyperFrames, looked for in:  ${t.home}/Downloads`,
      `  Episodes:  ${ROOT}/Episodes`,
      `  References:  ${ROOT}/References`,
      `  BRIMM Video Studio, run from:  ${CHECKOUT}`,
      `  Work folder:  ${t.home}/BRIMM Video Work`
    ]);
    assert.ok(!t.said.join("\n").includes("Final Cut"), "show names no Final Cut");
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
    // The Drop folder is written here as the installer would write it: set never changes the drop folder, which the installer
    // switches.
    writeSettings(t.home, { import: "full", drop: "Drop", later: { x: 1 } });
    assert.equal(t.run("set", "--import", "light", "--readings", "off", "--handoff", "2", "--drop", "Drop"), 0);
    assert.deepEqual(t.said, [
      "The import is now light (it was full).",
      "Readings are now off (they were on).",
      "The hand-off version is now 2 (it was 1).",
      "The drop folder is Drop already.",
      `Written: ${settingsFile(t.home)}`
    ]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "light", readings: false, handoffVersion: 2, drop: "Drop", later: { x: 1 } });
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "1", "--readings", "on"), 0);
    // Each change is said in the order it was told.
    assert.deepEqual(t.said, ["The hand-off version is now 1 (it was 2).", "Readings are now on (they were off).", `Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "light", readings: true, handoffVersion: 1, drop: "Drop", later: { x: 1 } });
    t.done();
  });
  it("set takes one setting alone, in any order, and says so when nothing changes", () => {
    const t = mac();
    assert.equal(t.run("set", "--readings", "on"), 0);
    assert.deepEqual(t.said, ["Readings are on already."]);
    unchanged(t);
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "2"), 0);
    t.said.length = 0;
    assert.equal(t.run("set", "--handoff", "2", "--readings", "off"), 0);
    assert.deepEqual(t.said, ["The hand-off version is 2 already.", "Readings are now off (they were on).", `Written: ${settingsFile(t.home)}`]);
    t.done();
  });
  it("set turns the editing app and the handover of her chat on and off, and show says them", () => {
    const t = mac();
    assert.equal(t.run("set", "--app", "hyperframes", "--app-handover", "on"), 0);
    assert.deepEqual(t.said, ["The editing app is now hyperframes (it was off).", "Handing her chat to the app is now on (it was off).", `Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, app: "hyperframes", appHandover: true });
    t.said.length = 0;
    assert.equal(t.run("show"), 0);
    assert.deepEqual(t.said.slice(-2), ["  The editing app:  hyperframes", "  Her chat handed to the app:  on"]);
    t.said.length = 0;
    assert.equal(t.run("set", "--app-handover", "off", "--app", "off"), 0);
    assert.deepEqual(t.said, ["Handing her chat to the app is now off (it was on).", "The editing app is now off (it was hyperframes).", `Written: ${settingsFile(t.home)}`]);
    t.said.length = 0;
    assert.equal(t.run("set", "--app", "final-cut"), 1);
    assert.deepEqual(t.said, ["Not changed: --app takes hyperframes or off."]);
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
      [["--import", "heavy"], "Not changed: --import takes light."],
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
  const SWITCHED = (to) => `The drop folder is switched by the installer, which makes the new folder, marks it and points the import at it, after it has checked the old one. To see what it would do: ./install.sh --print --machine "Mac Studio" --drop ${to} "${ROOT}"`;
  it("set refuses a change of the drop folder alone, beside other settings and beside the light import, changes nothing, and ends with 1", () => {
    // Part F refused Drop here "until it is built". Part D built it, and the installer switches it: set says so, and changes
    // nothing, the light import told with it included.
    const t = mac();
    const DROP = SWITCHED("Drop");
    for (const argv of [["--drop", "Drop"], ["--drop", "Drop", "--handoff", "2"], ["--import", "light", "--drop", "Drop"], ["--drop", "Drop", "--import", "light"]]) {
      t.said.length = 0;
      assert.equal(t.run("set", ...argv), 1, argv.join(" "));
      assert.deepEqual(t.said, [DROP], argv.join(" "));
    }
    unchanged(t);
    t.done();
  });
  it("set refuses to change the drop folder, in either direction, says the installer switches it and how to see what it would do, changes nothing, and ends with 1", () => {
    // set wrote the setting with no check of the old folder, no new folder, no marker and no change to the launch agent: the agent
    // went on watching the old folder, and the import then skipped every video it found there.
    const t = mac();
    assert.equal(t.run("set", "--drop", "Drop"), 1);
    assert.deepEqual(t.said, [SWITCHED("Drop")]);
    unchanged(t);
    // Whatever else it is told in the same line is not changed either.
    t.said.length = 0;
    assert.equal(t.run("set", "--readings", "off", "--drop", "Drop", "--handoff", "2"), 1);
    assert.deepEqual(t.said, [SWITCHED("Drop")]);
    unchanged(t);
    // And back: the other direction is the installer's too, and says its own words for the folder.
    writeSettings(t.home, { drop: "Drop" });
    const before = readFileSync(settingsFile(t.home), "utf8");
    t.said.length = 0;
    assert.equal(t.run("set", "--drop", "Unedited Video"), 1);
    assert.deepEqual(t.said, [SWITCHED('"Unedited Video"')]);
    assert.equal(readFileSync(settingsFile(t.home), "utf8"), before);
    t.done();
  });
  it("set says the drop folder is Drop already when it is, and changes the others told with it", () => {
    const t = mac();
    writeSettings(t.home, { drop: "Drop" });
    assert.equal(t.run("set", "--drop", "Drop", "--readings", "off"), 0);
    assert.deepEqual(t.said, ["The drop folder is Drop already.", "Readings are now off (they were on).", `Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, drop: "Drop", readings: false });
    t.done();
  });
  it("set writes the light import, now that the question in her chat is built, says so, and ends with 0", () => {
    // Part F took its refusal away: the card she answers in her chat (her skill, F10).
    const t = mac();
    assert.equal(t.run("set", "--import", "light"), 0);
    assert.deepEqual(t.said, ["The import is now light.", `Written: ${settingsFile(t.home)}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "light" });
    assert.equal(lightImport(readSettings(t.home).settings), true);
    t.said.length = 0;
    assert.equal(t.run("set", "--readings", "off", "--import", "light"), 0);
    assert.deepEqual(t.said, ["Readings are now off (they were on).", "The import is light already.", `Written: ${settingsFile(t.home)}`]);
    t.said.length = 0;
    // The full import is gone: it is refused in words, and nothing is written (the Phase 2 tests below pin that).
    assert.equal(t.run("set", "--import", "full"), 2);
    assert.deepEqual(t.said, ["The full import is gone: this Mac imports lightly."]);
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
    assert.deepEqual(t.said, [`This Mac's settings could not be written (the import must be "full" or "light"). ${MEND_SETTING}`]);
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

  it("write, as install.sh runs it, keeps the settings of the switch", async () => {
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
    // Another Mac's name moves the drop folder watched, so the old one is looked at first (here it is not there), and it ends later.
    assert.equal(await t.run("write", "--machine", "Sallie's laptop", "--root", ROOT, "--checkout", CHECKOUT), 0);
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
      `  Exports from HyperFrames, looked for in:  ${t.home}/Downloads`,
      `  Episodes:  ${ROOT}/Episodes`,
      `  References:  ${ROOT}/References`,
      `  BRIMM Video Studio, run from:  ${CHECKOUT}`,
      `  Work folder:  ${t.home}/BRIMM Video Work`,
      "  Import:  light",
      "  Readings:  off",
      "  Hand-off version:  2",
      `  Teachings from sessions:  on, turned on ${at} (the claude command: (not shown); the Code tab: (not shown))`
    ]);
    // After the 90 days it says they have lapsed.
    t.said.length = 0;
    assert.equal(settingsMain(["show"], { home: t.home, say: (line) => t.said.push(line), now: new Date(AT.getTime() + 91 * 86400000) }), 0);
    assert.equal(t.said.at(-1), `  Teachings from sessions:  lapsed, turned on ${at} (the claude command: (not shown); the Code tab: (not shown))`);
    t.done();
  });
  it("show says the teachings are off, not lapsed, when they were turned on later than now: the clock was set back, as the gate reads it", () => {
    const t = mac();
    t.run("sessions", "--teachings", "on", "--cli-account", "jason@example.com", "--app-account", "sallie@example.com");
    const at = readSettings(t.home).settings.sessionTeachings.at;
    const states = [];
    for (const days of [-1, 0, 89, 90, 91]) {
      const said = [];
      assert.equal(settingsMain(["show"], { home: t.home, say: (line) => said.push(line), now: new Date(Date.parse(at) + days * 86400000) }), 0);
      states.push(said.at(-1));
    }
    const shown = (state) => `  Teachings from sessions:  ${state}, turned on ${at} (the claude command: (not shown); the Code tab: (not shown))`;
    assert.deepEqual(states, [shown("off"), shown("on"), shown("on"), shown("lapsed"), shown("lapsed")]);
    t.done();
  });
  it("show says neither account the teachings were turned on for: what it prints may reach a chat", () => {
    const t = mac();
    t.run("sessions", "--teachings", "on", "--cli-account", "jason@example.com (Ogden Studio Org)", "--app-account", "sallie@example.com");
    for (const now of [AT, new Date(AT.getTime() + 91 * 86400000)]) {
      const said = [];
      assert.equal(settingsMain(["show"], { home: t.home, say: (line) => said.push(line), now }), 0);
      assert.ok(said.some((line) => line.startsWith("  Teachings from sessions:  ")), said.join("\n"));
      for (const account of ["jason@example.com", "sallie@example.com", "Ogden Studio Org"]) assert.ok(!said.join("\n").includes(account), account);
    }
    // From the command line too.
    const shown = spawnSync(process.execPath, [SETTINGS, "show"], { encoding: "utf8", env: { HOME: t.home, PATH: process.env.PATH } });
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /\(the claude command: \(not shown\); the Code tab: \(not shown\)\)/);
    for (const account of ["jason@example.com", "sallie@example.com"]) assert.ok(!shown.stdout.includes(account), account);
    t.done();
  });
  it("--help says how set and sessions are used", () => {
    const t = setup();
    assert.equal(t.asked("--help"), 0);
    assert.match(t.said[0], /node settings\.js set \[--import light\] \[--readings on\|off\] \[--handoff 1\|2\] \[--drop Drop\|"Unedited Video"\]/);
    // What set refuses is said: a change of the drop folder, which the installer switches. Nothing is said to be not built yet:
    // the light import and the Drop folder are both built, and the light import is not refused.
    assert.match(t.said[0], /It does not change the drop folder: it is switched by the installer/);
    assert.match(t.said[0], /A change of it is refused, and nothing is changed: it says the installer's line/);
    assert.doesNotMatch(t.said[0], /not built|until it is built/);
    assert.doesNotMatch(t.said[0], /light[^\n]*(refused|not built)|(refused|not built)[^\n]*light/);
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
    const drop = join(t.home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB", "BRIMM Video", "Unedited Video", "Mac Studio");
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

describe("node settings.js write and plan, with the settings of the switch", () => {
  const AT = new Date("2026-10-23T10:00:00-04:00");
  const ADVICE = "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again.";
  const LATE = "A video that is already imported leaves the old folder once its late check has passed: run this again after that.";
  const KEPT = "Delete each of these from the old folder by hand, then run this again.";
  /** When a status was written that an import left behind when it stopped: more than 10 minutes before the time of these tests. */
  const STOPPED = new Date(AT.getTime() - 30 * 60000).toISOString();
  // An import at work on a video makes its late check from the video in the old folder, so it is to be waited for and left there.
  const RUNNING = "Wait for each of these imports to finish, then run this again: leave the video in the old folder, which its late check needs.";
  // A late check that found a problem restores from the video in the old folder, so its advice is to leave the video there.
  const PROBLEM_HERE = "Try each of these again with retry, which makes its late check again from the video in the old folder: leave the video there, and run this again once the check has passed.";
  const PROBLEM_GONE = "A late check needs its video: where the video is no longer in the old folder, the check cannot be made again, and Jason looks at it.";
  /** What is said of a video an episode holds, that this Mac's import will not take out of the old folder: no late check is owed. */
  const KEPT_LINE = (name) => `  ${name}: already imported, and nothing of this Mac's import will take it out of the old folder: its late check has passed, or it is a copy of an imported video.`;
  /** The late check this Mac still owes the episode that holds `video`, as the import keeps it, and when it is due. */
  const lastCopy = Date.parse("2026-10-23T09:50:00-04:00");
  const due = new Date(lastCopy + 15 * 60000).toTimeString().slice(0, 5);
  const owe = (t, folder, video, bytes, drop) => writePending(t.home, { version: 1, id: `e-${video}`, name: folder, folder: join(t.root, "Episodes", folder), video, bytes, seconds: 120, drop: join(drop, video), work: "/nowhere", entries: [], lastCopy, root: t.root, machine: "Mac Studio", planTxt: "x.cut-plan.txt" });
  /** A Mac with settings, `held` over them, whose BRIMM Video is a folder of its own in the test's home folder, with Episodes and
      its status files. `told` is what install.sh tells write and plan of this Mac. `drop(name)` is its drop folder in `name`'s
      parent, made; `video(folder, name)` puts a video there; `status(video, more, machine)` is a status file of an import, as one
      writes it; `episode(folder, video, bytes, label, over)` is an episode that holds a video, its record's fields `over` put over
      what the import writes. */
  function mac(held = {}) {
    const t = setup();
    const root = join(t.home, "BRIMM Video");
    mkdirSync(join(root, "Episodes", ".importing"), { recursive: true });
    writeSettings(t.home, { machine: "Mac Studio", root, checkout: CHECKOUT, ...held });
    const run = async (...argv) => settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), now: AT });
    const folder = (parent = "Unedited Video", machine = "Mac Studio") => {
      mkdirSync(join(root, parent, machine), { recursive: true });
      return join(root, parent, machine);
    };
    const status = (video, more = {}, machine = "Mac Studio") => writeFileSync(join(root, "Episodes", ".importing", `${video} (${machine}) 1.json`), JSON.stringify({ version: 1, machine, pid: 4242, video, bytes: 5, seconds: 120, step: "Making the rough cut", at: AT.toISOString(), ...more }));
    const episode = (name, video, bytes, label, over = {}) => {
      const path = join(root, "Episodes", name);
      mkdirSync(join(path, "record"), { recursive: true });
      const record = { ...newEpisode({ id: "e-20261022-000001", machine: "Mac Studio", at: "2026-10-22T10:00:00-04:00", video: { file: video, bytes, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: "Mac Studio" }, label }), rev: 1, ...over };
      writeFileSync(recordFile(path, 1), recordText(record));
    };
    const told = ["--machine", "Mac Studio", "--root", root, "--checkout", CHECKOUT];
    return { ...t, root, run, folder, status, episode, told, file: settingsFile(t.home), held: () => readFileSync(settingsFile(t.home), "utf8") };
  }
  const put = (folder, name, bytes = "video") => writeFileSync(join(folder, name), bytes);

  it("plan says the settings it would write, whole, as JSON, with the switch's settings and every field it keeps, and writes nothing", async () => {
    const t = mac({ import: "light", readings: false, handoffVersion: 2, later: { x: 1 } });
    const before = t.held();
    assert.equal(await t.run("plan", ...t.told, "--drop", "Drop"), 0);
    // The settings, then, each on a line of its own for the installer to read without parsing JSON, the import it would be, and the
    // drop folder as it is and as it would be.
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Unedited Video", "The drop folder will be: Drop", `The exports folder will be: ${t.home}/Downloads`, `The old drop folder: ${dropFolder(t.root, "Mac Studio")}`]);
    assert.deepEqual(JSON.parse(t.said[0]), { version: 1, machine: "Mac Studio", root: t.root, checkout: CHECKOUT, import: "light", readings: false, handoffVersion: 2, later: { x: 1 }, drop: "Drop" });
    assert.equal(t.held(), before);
    // It is what write then writes, to the letter.
    const planned = t.said[0];
    t.said.length = 0;
    assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 0);
    assert.deepEqual(t.said, [`Written: ${t.file}`]);
    assert.equal(t.held(), `${planned}\n`);
    t.done();
  });
  it("plan does not show the emails of the accounts the teachings were checked on, and write, which writes them as they are, keeps them", async () => {
    // The installer shows what plan prints, and shows no account's email anywhere else.
    const t = mac({ import: "full" });
    t.run("sessions", "--teachings", "on", "--cli-account", "jason@example.com", "--app-account", "sallie@example.com");
    const at = readSettings(t.home).settings.sessionTeachings.at;
    t.said.length = 0;
    const before = t.held();
    assert.equal(await t.run("plan", ...t.told, "--readings", "off"), 0);
    const shown = JSON.parse(t.said[0]);
    assert.deepEqual(shown.sessionTeachings, { on: true, at, accounts: { cli: "(not shown)", app: "(not shown)" } });
    assert.ok(!/@|example\.com/.test(t.said.join("\n")), t.said.join("\n"));
    assert.equal(t.held(), before);
    // What write writes is unchanged: the accounts as they were, and everything else plan printed.
    t.said.length = 0;
    assert.equal(await t.run("write", ...t.told, "--readings", "off"), 0);
    const written = readSettings(t.home).settings;
    assert.deepEqual(written.sessionTeachings.accounts, { cli: "jason@example.com", app: "sallie@example.com" });
    assert.deepEqual({ ...written, sessionTeachings: shown.sessionTeachings }, shown);
    // With no teachings, or off, there is nothing to hide, and plan prints the settings as they are.
    const off = mac();
    assert.equal(await off.run("plan", ...off.told), 0);
    assert.equal(JSON.parse(off.said[0]).sessionTeachings, undefined);
    off.done();
    t.done();
  });
  it("plan gives the settings of a Mac with no settings as they would be written, with what is told and nothing more", async () => {
    const t = setup();
    const run = async (...argv) => settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), now: AT });
    const told = ["--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT];
    assert.equal(await run("plan", ...told), 0);
    assert.equal(t.said[0], JSON.stringify({ version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT }, null, 2));
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Unedited Video", "The drop folder will be: Unedited Video", `The exports folder will be: ${t.home}/Downloads`]);
    t.said.length = 0;
    assert.equal(await run("plan", ...told, "--readings", "off", "--handoff", "2", "--import", "light", "--drop", "Unedited Video"), 0);
    assert.deepEqual(JSON.parse(t.said[0]), { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, readings: false, handoffVersion: 2, import: "light", drop: "Unedited Video" });
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Unedited Video", "The drop folder will be: Unedited Video", `The exports folder will be: ${t.home}/Downloads`]);
    assert.equal(existsSync(settingsFile(t.home)), false);
    t.done();
  });
  it("plan says the drop folder the file names as the one it is now, and as it will be, so that a Mac on Drop run again stays on it", async () => {
    const t = mac({ drop: "Drop", later: "\u0000" });
    assert.equal(await t.run("plan", ...t.told), 0);
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Drop", "The drop folder will be: Drop", `The exports folder will be: ${t.home}/Downloads`]);
    assert.equal(JSON.parse(t.said[0]).later, "\u0000");
    t.said.length = 0;
    // Told the other, it says both, and the old folder's whole path, which the installer names as the one left.
    assert.equal(await t.run("plan", ...t.told, "--drop", "Unedited Video"), 0);
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Drop", "The drop folder will be: Unedited Video", `The exports folder will be: ${t.home}/Downloads`, `The old drop folder: ${dropFolder(t.root, "Mac Studio", "Drop")}`]);
    t.done();
  });
  it("write writes the settings of the switch it is told, keeps every other setting, says so, and leaves a setting it is not told as it was", async () => {
    const t = mac({ import: "full", readings: false, later: { x: 1 } });
    assert.equal(await t.run("write", ...t.told, "--handoff", "2", "--drop", "Drop"), 0);
    assert.deepEqual(t.said, [`Written: ${t.file}`]);
    assert.deepEqual(readSettings(t.home).settings, { version: 1, machine: "Mac Studio", root: t.root, checkout: CHECKOUT, import: "full", readings: false, later: { x: 1 }, handoffVersion: 2, drop: "Drop" });
    // Told off, readings are off; not told, they are as the file has them, on or off: never turned on by a run that names nothing.
    t.said.length = 0;
    assert.equal(await t.run("write", ...t.told, "--readings", "on"), 0);
    assert.equal(readSettings(t.home).settings.readings, true);
    assert.equal(await t.run("write", ...t.told), 0);
    assert.equal(readSettings(t.home).settings.readings, true);
    t.done();
  });
  it("write and plan take the light import as set does, now that her chat's question is built: plan says it, and write writes it", async () => {
    // Part F built the question in her chat and took set's refusal of the light import away; write and plan refused it by the same
    // code, which is gone, and take it too.
    const t = mac();
    const before = t.held();
    for (const more of [["--import", "light"], ["--drop", "Drop", "--import", "light", "--readings", "off"]]) {
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, ...more), 0, `plan ${more.join(" ")}`);
      assert.equal(JSON.parse(t.said[0]).import, "light", `plan ${more.join(" ")}`);
      assert.equal(t.held(), before);
    }
    assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Unedited Video", "The drop folder will be: Drop", `The exports folder will be: ${t.home}/Downloads`, `The old drop folder: ${dropFolder(t.root, "Mac Studio")}`]);
    // write writes what plan printed, to the letter, with the drop folder and readings told with it.
    const planned = t.said[0];
    t.said.length = 0;
    assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--import", "light", "--readings", "off"), 0);
    assert.deepEqual(t.said, [`Written: ${t.file}`]);
    assert.equal(t.held(), `${planned}\n`);
    assert.equal(lightImport(readSettings(t.home).settings), true);
    // The same on a Mac that has no settings yet: write makes them, with the light import.
    const none = setup();
    assert.equal(await settingsMain(["write", "--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT, "--import", "light"], { home: none.home, say: (line) => none.said.push(line) }), 0);
    assert.deepEqual(none.said, [`Written: ${settingsFile(none.home)}`]);
    assert.deepEqual(readSettings(none.home).settings, { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "light" });
    none.done();
    t.done();
  });
  it("write and plan refuse a value that will not do, naming the option and what it takes, and write nothing", async () => {
    const t = mac();
    const before = t.held();
    for (const command of ["plan", "write"]) {
      for (const [more, said] of [
        [["--drop", "Elsewhere"], 'Not written: --drop takes Drop or "Unedited Video".'],
        [["--import", "heavy"], "Not written: --import takes light."],
        [["--handoff", "3"], "Not written: --handoff takes 1 or 2."],
        [["--readings", "maybe"], "Not written: --readings takes on or off."]
      ]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, ...more), 1, `${command} ${more.join(" ")}`);
        assert.deepEqual(t.said, [said]);
        assert.equal(t.held(), before);
      }
    }
    t.done();
  });
  it("write and plan say how they are used, and write nothing, when asked wrongly: an option with no value, or one they do not know", async () => {
    const t = mac();
    const before = t.held();
    for (const command of ["plan", "write"]) {
      for (const more of [["--drop"], ["--import", "light", "--handoff"], ["--rules-only"], ["--clone", "x"], ["--drop", "Drop", "Drop"]]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, ...more), 2, `${command} ${more.join(" ")}`);
        assert.equal(t.said.length, 1);
        assert.match(t.said[0], /^This Mac's settings for episodes/);
      }
      t.said.length = 0;
      assert.equal(await t.run(command, "--machine", "Mac Studio", "--root", t.root, "--drop", "Drop"), 2, command);
    }
    assert.equal(t.held(), before);
    t.done();
  });
  it("write and plan stop, and say why, when the settings in the file will not do and what is told does not mend them", async () => {
    const t = mac();
    writeFileSync(t.file, t.held().replace('"version": 1', '"version": 1, "import": "ligth"'));
    const before = t.held();
    for (const command of ["plan", "write"]) {
      t.said.length = 0;
      assert.equal(await t.run(command, ...t.told, "--drop", "Drop"), 1, command);
      // And what to do about it, as `show` says it.
      assert.deepEqual(t.said, [`This Mac's settings could not be written (the import must be "full" or "light"). ${MEND_SETTING}`]);
      assert.equal(t.held(), before);
    }
    // What is told mends it.
    t.said.length = 0;
    assert.equal(await t.run("write", ...t.told, "--import", "light"), 0);
    assert.equal(readSettings(t.home).settings.import, "light");
    t.done();
  });

  describe("when the drop folder changes, the old one", () => {
    const OLD = (t) => join(t.root, "Unedited Video", "Mac Studio");
    const HEAD = "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:";
    /** What both commands say of the same Mac with the same folders, and that neither wrote anything. */
    const refused = async (t, ...more) => {
      const before = t.held();
      const said = [];
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, ...more), 1, command);
        said.push([...t.said]);
        assert.equal(t.held(), before, command);
      }
      assert.deepEqual(said[0], said[1]);
      return said[0];
    };
    const allowed = async (t, ...more) => {
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, ...more), 0, t.said.join("\n"));
      assert.equal(JSON.parse(t.said[0]).drop, more[more.indexOf("--drop") + 1]);
    };
    it("is no hindrance when it is empty, or holds only the marker and Finder's files, or does not exist", async () => {
      const t = mac();
      await allowed(t, "--drop", "Drop");
      const old = t.folder();
      for (const name of [".brimm-watched-by", ".DS_Store", "Icon\r", "notes.txt", "Talk.mov.part", "Talk.mov.download"]) put(old, name);
      await allowed(t, "--drop", "Drop");
      t.done();
    });
    it("refuses while it holds a video, and names each by what it is and its size, whatever the import, and says what to do", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov");
      put(old, "Budget.MP4");
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      // Once it is taken out, the switch goes through, and write writes.
      rmSync(join(old, "Talk.mov"));
      rmSync(join(old, "Budget.MP4"));
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 0);
      assert.equal(readSettings(t.home).settings.drop, "Drop");
      t.done();
    });
    it("is not looked at when the drop folder does not change, whatever it holds", async () => {
      const t = mac();
      put(t.folder(), "Talk.mov");
      // Not told, told what it is already, and told Unedited Video when the file says none: it stays as it is.
      await t.run("plan", ...t.told);
      assert.equal(JSON.parse(t.said.at(-5)).drop, undefined);
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Unedited Video"), 0);
      assert.deepEqual(t.said, [`Written: ${t.file}`]);
      put(t.folder("Drop"), "Early.mov");
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 1);
      t.said.length = 0;
      rmSync(join(OLD(t), "Talk.mov"));
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 0);
      // On Drop already, told Drop again: the old folder is not looked at though it holds a video.
      put(t.folder(), "Stray.mov");
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 0);
      assert.equal(await t.run("write", ...t.told), 0);
      t.done();
    });
    it("does not hinder the switch because the new folder holds videos", async () => {
      const t = mac();
      put(t.folder("Drop"), "Early.mov");
      await allowed(t, "--drop", "Drop");
      t.done();
    });
    it("is Drop when the switch goes back to Unedited Video: that one is looked at then", async () => {
      const t = mac({ drop: "Drop" });
      put(t.folder("Drop"), "Talk.mov");
      put(t.folder(), "Old.mov");
      assert.deepEqual(await refused(t, "--drop", "Unedited Video"), [`Not written: the drop folder would change from Drop to Unedited Video, and work is not finished in the old one:`, `  A video of 5 bytes: waits in ${t.folder("Drop")}.`, ADVICE]);
      t.done();
    });
    it("is the Unedited Video folder of a Mac with no settings file too, which a first run with --drop looks at", async () => {
      const t = setup();
      const root = join(t.home, "BRIMM Video");
      mkdirSync(join(root, "Unedited Video", "Mac Studio"), { recursive: true });
      put(join(root, "Unedited Video", "Mac Studio"), "Talk.mov");
      const argv = ["write", "--machine", "Mac Studio", "--root", root, "--checkout", CHECKOUT, "--drop", "Drop"];
      assert.equal(await settingsMain(argv, { home: t.home, say: (line) => t.said.push(line), now: AT }), 1);
      assert.equal(t.said[0], HEAD);
      assert.equal(existsSync(settingsFile(t.home)), false);
      t.done();
    });
    it("refuses while an import of this Mac failed or its late check found a problem, naming it by its video's file name, and by its label when it has one, and never by the status file's name", async () => {
      const t = mac();
      t.status("Talk.mov", { failed: "the transcriber stopped on Talk.mov" });
      t.status("Budget.mov", { problem: "Budget.rough-cut.mp4 is short" });
      t.status("Light.mov", { failed: "the sound could not be read", label: "Video of 22 Oct, 10:40 (Mac Studio)" });
      const gone = join(t.root, "Episodes", ".importing");
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [
        HEAD,
        `  Video of 22 Oct, 10:40 (Mac Studio): its import failed, and its video is not in the old folder now: only its status file, in ${gone}, holds this, and a person takes it away by hand.`,
        `  1 import failed, and its video is not in the old folder now: only its status file, in ${gone}, holds this, and a person takes it away by hand.`,
        ADVICE,
        // A late check's problem is not a failed import: its own line and its own advice, and no word of its status file.
        "  1 late check found a problem, and its video is not in the old folder now.",
        PROBLEM_GONE
      ]);
      assert.ok(!said.slice(said.indexOf(ADVICE) + 1).some((line) => /status file|by hand|take the video out/.test(line)), said.join("\n"));
      // What a status says of why, which may hold a file's name, and the status files' own names are not said.
      assert.ok(!said.join("\n").includes("transcriber") && !said.join("\n").includes("(Mac Studio) 1.json") && !said.join("\n").includes("Light.mov"), said.join("\n"));
      t.done();
    });
    it("says of a late check that found a problem, while its video is in the old folder, to try it again with retry and to leave the video there: the check restores from it", async () => {
      // Taking the video out could lose the only intact copy, and the refusal would never clear: each run writes the status again.
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.status("Budget.mov", { problem: "Budget.rough-cut.mp4 is short" });
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, "  1 late check found a problem, and its video is still in the old folder.", PROBLEM_HERE]);
      assert.ok(!said.some((line) => /take the video out|delete/.test(line)), said.join("\n"));
      // A failed import keeps its own advice, after its own lines, and the problem has its own after its own.
      put(old, "Talk.mov", "12345");
      t.status("Talk.mov", { failed: "the sound could not be read" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  1 import failed, and its video is still in the old folder.", ADVICE, "  1 late check found a problem, and its video is still in the old folder.", PROBLEM_HERE]);
      t.done();
    });
    it("says of a late check that found a problem whose video is gone that it needs the video and that Jason looks at it, both when there are some of each", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.status("Budget.mov", { problem: "Budget.rough-cut.mp4 is short" });
      t.status("Talk.mov", { problem: "Talk.rough-cut.mp4 is short" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  2 late checks found a problem, of which 1 has the video still in the old folder.", PROBLEM_HERE, PROBLEM_GONE]);
      t.done();
    });
    it("names a video that is there once, whether it is waiting or its import failed, and says what to do for it", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov");
      t.status("Talk.mov", { failed: "the transcriber stopped" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  1 import failed, and its video is still in the old folder.", "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again."]);
      t.done();
    });
    it("leaves alone what is not this Mac's, or is not trouble: another Mac's failed import, an import at work, one that stopped, a video held on purpose", async () => {
      const t = mac();
      t.status("Theirs.mov", { failed: "the sound could not be read" }, "Sallie's laptop");
      t.status("Mine.mov", {}, "Mac Studio");
      t.status("Stopped.mov", { at: new Date(AT.getTime() - 30 * 60000).toISOString() });
      t.status("Zoom.mp4", { held: "a Zoom download, which waits for its other files" });
      await allowed(t, "--drop", "Drop");
      t.done();
    });
    it("names a waiting video by the label of this Mac's status for it, or of the episode that holds it", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      put(old, "Budget.mov", "123456");
      // The import of Talk.mov stopped (a crash left its status): it waits, and is named by the label its status carries.
      t.status("Talk.mov", { bytes: 5, label: "Video of 20 Oct, 15:00 (Mac Studio)", at: STOPPED });
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, "Video of 21 Oct, 09:00 (Mac Studio)");
      // The video an episode holds is imported already: it has a line of its own, and its own advice, after the lines of work.
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  Video of 20 Oct, 15:00 (Mac Studio): waits in ${old}.`, ADVICE, KEPT_LINE("Video of 21 Oct, 09:00 (Mac Studio)"), KEPT]);
      t.done();
    });
    it("says of a video whose import is at work now, in this Mac's own status for it, that it is being imported, and to wait and run the installer again: never to take it out", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      t.status("Talk.mov", { bytes: 5, step: "Making the rough cut" });
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, "  1 video is being imported now.", RUNNING]);
      assert.ok(!said.some((line) => /take the video out|delete|waits in/.test(line)), said.join("\n"));
      t.done();
    });
    it("names a video whose import is at work by its label when the status has one", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      t.status("Talk.mov", { bytes: 5, label: "Video of 23 Oct, 09:40 (Mac Studio)" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  Video of 23 Oct, 09:40 (Mac Studio): it is being imported now.", RUNNING]);
      t.done();
    });
    it("counts videos whose import is at work under the light import when they have no label, and names none", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4", "12345");
      t.status("Coaching call Jane Doe.mp4", { bytes: 5 });
      const one = await refused(t, "--drop", "Drop");
      assert.deepEqual(one, [HEAD, "  1 video is being imported now.", RUNNING]);
      put(old, "Sales call Acme Ltd.mov", "123456");
      t.status("Sales call Acme Ltd.mov", { bytes: 6 });
      const two = await refused(t, "--drop", "Drop");
      assert.deepEqual(two, [HEAD, "  2 videos are being imported now.", RUNNING]);
      // With a label it is named by it, and the others still counted.
      t.status("Sales call Acme Ltd.mov", { bytes: 6, label: "Video of 23 Oct, 09:40 (Mac Studio)" });
      const labelled = await refused(t, "--drop", "Drop");
      assert.deepEqual(labelled, [HEAD, "  Video of 23 Oct, 09:40 (Mac Studio): it is being imported now.", "  1 video is being imported now.", RUNNING]);
      assert.ok(!/Jane|Doe|Acme|Coaching|Sales/.test([...one, ...two, ...labelled].join("\n")), [...one, ...two, ...labelled].join("\n"));
      t.done();
    });
    it("follows the lines of an import at work with its own advice, after the lines of work and with its own apart from theirs", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      put(old, "Budget.mov", "123456");
      t.status("Budget.mov", { bytes: 6 });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE, "  1 video is being imported now.", RUNNING]);
      t.done();
    });
    it("leaves as they are a video whose import stopped, another Mac's import at work, and a video an episode holds, whatever its status says", async () => {
      const t = mac();
      const old = t.folder();
      // A stopped import (a crash left it) is a video that waits: this Mac's next run imports it again.
      put(old, "Talk.mov", "12345");
      t.status("Talk.mov", { bytes: 5, at: new Date(AT.getTime() - 30 * 60000).toISOString() });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      // Another Mac's import at work is not this Mac's, and a status of another recording of the name (another size) is not this video's.
      put(old, "Budget.mov", "123456");
      t.status("Budget.mov", { bytes: 6 }, "Sallie's laptop");
      t.status("Budget.mov", { bytes: 99 });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 6 bytes: waits in ${old}.`, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      // An episode that holds the video says what the video is: imported.
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      t.status("Budget.mov", { bytes: 6 });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE, KEPT_LINE("A video of 6 bytes"), KEPT]);
      t.done();
    });
    it("says a video an episode holds, when this Mac owes it a late check, is imported and its late check is still to come, and to run the installer again after it", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, "  1 video is already imported, and its late check is still to come.", LATE]);
      assert.ok(!said.some((line) => /take|delete|retry/.test(line)), said.join("\n"));
      t.done();
    });
    it("finds the late check this Mac owes whatever way the root is spelt in it: a trailing slash, or a path that goes round", async () => {
      // filing.js and unedited.js compare roots by resolve(), and the pending late check holds the root as the import was given it.
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      // And through a link to BRIMM Video, compared by its real path as the folders are.
      const link = join(t.home, "Link to BRIMM Video");
      symlinkSync(t.root, link);
      for (const spelt of [`${t.root}/`, `${t.root}/../BRIMM Video`, link]) {
        writePending(t.home, { version: 1, id: "e-20261022-000001", name: "2026-10-20 Budget (Mac Studio)", folder: join(t.root, "Episodes", "2026-10-20 Budget (Mac Studio)"), video: "Budget.mov", bytes: 6, seconds: 120, drop: join(old, "Budget.mov"), work: "/nowhere", entries: [], lastCopy, root: spelt, machine: "Mac Studio", planTxt: "x.cut-plan.txt" });
        assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  1 video is already imported, and its late check is still to come.", LATE], spelt);
      }
      t.done();
    });
    it("says a video an episode holds, when this Mac owes it no late check, is imported and that nothing of its import will take it out: a person deletes it by hand, then runs the installer again", async () => {
      // Its late check passed, or it is a copy of an imported video: filing.js leaves such a video for a person to delete. Saying its
      // late check is still to come would be a refusal that doing what it says could never clear.
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, KEPT_LINE("A video of 6 bytes"), KEPT]);
      assert.ok(!said.some((line) => /still to come|retry/.test(line)), said.join("\n"));
      // Deleted by hand, the switch goes through.
      rmSync(join(old, "Budget.mov"));
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop"), 0);
      t.done();
    });
    it("under the light import counts an imported video owed a late check that has no label, and names a kept one by what it is and its size, never by its file", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4", "12345");
      t.episode("2026-10-22 Coaching (Mac Studio)", "Coaching call Jane Doe.mp4", 5);
      owe(t, "2026-10-22 Coaching (Mac Studio)", "Coaching call Jane Doe.mp4", 5, old);
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  1 video is already imported, and its late check is still to come.", LATE]);
      put(old, "Sales call Acme Ltd.mov", "123456");
      t.episode("2026-10-22 Sales call (Mac Studio)", "Sales call Acme Ltd.mov", 6);
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, "  1 video is already imported, and its late check is still to come.", LATE, KEPT_LINE("A video of 6 bytes"), KEPT]);
      put(old, "Pricing call Acme Ltd.mov", "1234567");
      t.episode("2026-10-22 Pricing call (Mac Studio)", "Pricing call Acme Ltd.mov", 7);
      const two = await refused(t, "--drop", "Drop");
      assert.deepEqual(two, [HEAD, "  1 video is already imported, and its late check is still to come.", LATE, KEPT_LINE("A video of 7 bytes"), KEPT_LINE("A video of 6 bytes"), KEPT]);
      assert.ok(!/Jane|Doe|Acme|Coaching|Sales|Pricing/.test([...said, ...two].join("\n")), [...said, ...two].join("\n"));
      t.done();
    });
    // A video an episode holds whose record the gate holds (gate.js gated: a video not yet answered, or a session not cleared) is
    // named as edit.js names such a record (episode.js shownName), by its label or else its short id, whatever this Mac's import:
    // never by its file, nor by its episode's folder, and never counted. The folders here hold the client's name to show that.
    const ANSWER = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-22T10:00:00-04:00", private: "yes" };
    const SESSION_HELD = { version: 3, kind: "session", answer: ANSWER, session: { marked: "2026-10-22T10:00:00-04:00", on: "Mac Studio", teachings: null, cleared: null } };
    const UNANSWERED = { version: 3, kind: null, answer: { state: "needs your answer", guess: null, seen: "", came: null } };
    const CLIENT = /Jane|Doe|Coaching/;
    it("names a video a session with no label holds by its short id, owed a late check or kept, and never by its file", async () => {
      for (const owed of [true, false]) {
        const t = mac();
        const old = t.folder();
        put(old, "Coaching call Jane Doe.mp4", "12345");
        t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "", SESSION_HELD);
        if (owed) owe(t, "2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, old);
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, owed
          ? [HEAD, `  a client or group session (000001): already imported; its late check is still to come (due at ${due}).`, LATE]
          : [HEAD, KEPT_LINE("a client or group session (000001)"), KEPT], owed ? "owed" : "kept");
        assert.ok(!CLIENT.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    it("names a video a gated record holds by its label when it has one, and a video not yet answered with none by its short id, under either import, never counting it", async () => {
      for (const held of [{}, { import: "full" }, { import: "light" }]) {
        const t = mac(held);
        const old = t.folder();
        put(old, "Coaching call Jane Doe.mp4", "12345");
        t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "", UNANSWERED);
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, [HEAD, KEPT_LINE("a video not yet answered (000001)"), KEPT], JSON.stringify(held));
        t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "Video of 22 Oct, 10:00 (Mac Studio)", SESSION_HELD);
        const labelled = await refused(t, "--drop", "Drop");
        assert.deepEqual(labelled, [HEAD, KEPT_LINE("Video of 22 Oct, 10:00 (Mac Studio)"), KEPT], JSON.stringify(held));
        assert.ok(!CLIENT.test([...said, ...labelled].join("\n")), [...said, ...labelled].join("\n"));
        t.done();
      }
    });
    it("names a late check's problem of a video a session with no label holds by its short id, under either import, and does not count it", async () => {
      for (const held of [{}, { import: "light" }]) {
        const t = mac(held);
        const old = t.folder();
        put(old, "Coaching call Jane Doe.mp4", "12345");
        t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "", SESSION_HELD);
        t.status("Coaching call Jane Doe.mp4", { problem: "Coaching call Jane Doe.rough-cut.mp4 is short" });
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, [HEAD, "  a client or group session (000001): it was copied in, but its late check found a problem.", PROBLEM_HERE], JSON.stringify(held));
        assert.ok(!CLIENT.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    // A video held by an answered record one of whose other versions is a session not cleared is held as a session (edit.js
    // gatedAsOf, through finish.js linksOf), and is named as edit.js names such a record: by its label, else as "a video" with its
    // short id, whatever this Mac's import, and never by its file.
    const FINISHED = { version: 3, kind: "finished", answer: { ...ANSWER, private: "no" } };
    const SESSION_BESIDE = (cleared = null) => ({ ...SESSION_HELD, id: "e-20261022-000002", versionOf: "e-20261022-000001", session: { ...SESSION_HELD.session, cleared } });
    it("names a video an answered record holds, while a session not cleared is beside it, by its label or as a video with its short id, owed or kept, under either import", async () => {
      for (const held of [{}, { import: "light" }]) {
        for (const owed of [true, false]) {
          const t = mac(held);
          const old = t.folder();
          put(old, "Coaching call Jane Doe.mp4", "12345");
          t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "", FINISHED);
          t.episode("2026-10-23 Coaching call Jane Doe again (Mac Studio)", "Coaching call Jane Doe again.mp4", 9, "", SESSION_BESIDE());
          if (owed) owe(t, "2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, old);
          const said = await refused(t, "--drop", "Drop");
          const what = `${JSON.stringify(held)} ${owed ? "owed" : "kept"}`;
          assert.deepEqual(said, owed
            ? [HEAD, `  a video (000001): already imported; its late check is still to come (due at ${due}).`, LATE]
            : [HEAD, KEPT_LINE("a video (000001)"), KEPT], what);
          // With a label, by the label.
          t.episode("2026-10-22 Coaching call Jane Doe (Mac Studio)", "Coaching call Jane Doe.mp4", 5, "Video of 22 Oct, 10:00 (Mac Studio)", FINISHED);
          const labelled = await refused(t, "--drop", "Drop");
          assert.deepEqual(labelled.slice(0, 2), [HEAD, owed
            ? `  Video of 22 Oct, 10:00 (Mac Studio): already imported; its late check is still to come (due at ${due}).`
            : KEPT_LINE("Video of 22 Oct, 10:00 (Mac Studio)")], what);
          assert.ok(!CLIENT.test([...said, ...labelled].join("\n")), [...said, ...labelled].join("\n"));
          t.done();
        }
      }
    });
    it("names a video an answered record holds by what it is and its size once the session beside it is cleared, or when none is", async () => {
      const cleared = { at: "2026-10-23T10:00:00-04:00", on: "Mac Studio", to: "finished", confirmed: "dialog" };
      for (const beside of [SESSION_BESIDE(cleared), null]) {
        const t = mac();
        const old = t.folder();
        put(old, "Talk.mov", "12345");
        t.episode("2026-10-22 Talk (Mac Studio)", "Talk.mov", 5, "", FINISHED);
        if (beside) t.episode("2026-10-23 Talk again (Mac Studio)", "Talk again.mov", 9, "", beside);
        assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, KEPT_LINE("A video of 5 bytes"), KEPT], beside ? "cleared" : "none");
        t.done();
      }
    });
    // The old drop folder is the one the file names, in its own BRIMM Video, of its own Mac, whatever this run is told: a switch
    // told with a new --root or --machine would otherwise look at the wrong folder, and leave a video unwatched in the old one.
    // And a new --root or --machine alone, the drop folder named the same, moves the folder watched as a switch does.
    it("looks at the folder the file names, of its Mac in its BRIMM Video, when the run is told another BRIMM Video or another Mac", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      const elsewhere = join(t.home, "Elsewhere", "BRIMM Video");
      mkdirSync(join(elsewhere, "Episodes", ".importing"), { recursive: true });
      const moved = (root, machine) => `Not written: the drop folder would change from ${old} to ${dropFolder(root, machine, "Drop")}, and work is not finished in the old one:`;
      const movedSame = (root, machine) => `Not written: the drop folder would change from ${old} to ${dropFolder(root, machine)}, and work is not finished in the old one:`;
      assert.deepEqual(await refused(t, "--root", elsewhere, "--drop", "Drop"), [moved(elsewhere, "Mac Studio"), `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      assert.deepEqual(await refused(t, "--machine", "Mac Mini", "--drop", "Drop"), [moved(t.root, "Mac Mini"), `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      assert.deepEqual(await refused(t, "--root", elsewhere), [movedSame(elsewhere, "Mac Studio"), `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      assert.deepEqual(await refused(t, "--machine", "Mac Mini"), [movedSame(t.root, "Mac Mini"), `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      // The new folder holding a video does not stop it, and the old one empty lets it through.
      mkdirSync(dropFolder(elsewhere, "Mac Studio", "Drop"), { recursive: true });
      put(dropFolder(elsewhere, "Mac Studio", "Drop"), "New.mov");
      rmSync(join(old, "Talk.mov"));
      await allowed(t, "--root", elsewhere, "--drop", "Drop");
      assert.equal(await t.run("plan", ...t.told, "--root", elsewhere), 0);
      t.done();
    });
    it("takes the same BRIMM Video reached by a link for the same, by its real path: no move, and a switch is said by the folder's name", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      const link = join(t.home, "Link to BRIMM Video");
      symlinkSync(t.root, link);
      // Told the link, the drop folder named the same: the same folder, not looked at, as when nothing changes.
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, "--root", link), 0, t.said.join("\n"));
      // Told the link and Drop: a switch of the drop folder alone, said as one.
      assert.deepEqual(await refused(t, "--root", link, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      t.done();
    });
    it("takes a link to the same BRIMM Video for the same though no drop folder is there yet: the Mac and the drop folder named the same, nothing moves", async () => {
      // With no drop folder yet its real path cannot be found, so the roots are compared, which are there, with the Mac and the
      // drop folder's name: a failed import of this Mac, its video gone, does not stop a run that changes nothing.
      const t = mac();
      t.status("Talk.mov", { failed: "x" });
      const link = join(t.home, "Link to BRIMM Video");
      symlinkSync(t.root, link);
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, "--root", link), 0, t.said.join("\n"));
      assert.ok(!t.said.some((line) => line.startsWith("The old drop folder: ")), t.said.join("\n"));
      t.done();
    });
    it("matches the statuses and late checks of the file's Mac, in its BRIMM Video, when the run is told another Mac", async () => {
      const t = mac();
      const old = t.folder();
      t.status("Budget.mov", { failed: "x" });
      assert.deepEqual(await refused(t, "--machine", "Mac Mini", "--drop", "Drop"), [
        `Not written: the drop folder would change from ${old} to ${dropFolder(t.root, "Mac Mini", "Drop")}, and work is not finished in the old one:`,
        "  1 import failed, and its video is not in the old folder now: only its status file, in " + join(t.root, "Episodes", ".importing") + ", holds this, and a person takes it away by hand.",
        ADVICE
      ]);
      t.done();
    });
    // What holds a video is found past a conflicted copy of its records, as edit.js finds the episode the gate holds by any of them
    // (G1a); a video whose holder cannot be told, since an episode's records cannot be read, is named by what it is and its size,
    // under either import (G1b); and a late check this Mac owes for a video makes it one to wait for, whatever holds it (G1c).
    const JD_FOLDER = "2026-10-22 Coaching call Jane Doe (Mac Studio)";
    const JD = "Coaching call Jane Doe.mp4";
    /** A conflicted copy of the first record of the episode `folder`, as Dropbox keeps one beside it. */
    const copyOf = (t, folder) => {
      const record = join(t.root, "Episodes", folder, "record");
      writeFileSync(join(record, "0001 (Sallie's laptop's conflicted copy 2026-10-22).json"), readFileSync(join(record, "0001.json"), "utf8"));
    };
    it("names a video a session with no label holds, read past a conflicted copy of its record, by its short id, owed or kept", async () => {
      for (const owed of [true, false]) {
        const t = mac();
        const old = t.folder();
        put(old, JD, "12345");
        t.episode(JD_FOLDER, JD, 5, "", SESSION_HELD);
        copyOf(t, JD_FOLDER);
        if (owed) owe(t, JD_FOLDER, JD, 5, old);
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, owed
          ? [HEAD, `  a client or group session (000001): already imported; its late check is still to come (due at ${due}).`, LATE]
          : [HEAD, KEPT_LINE("a client or group session (000001)"), KEPT], owed ? "owed" : "kept");
        assert.ok(!CLIENT.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    it("names a video waiting in the old folder by what it is and its size, never by its file, whatever the file says of the import (L1d)", async () => {
      for (const held of [{}, { import: "full" }, { import: "light" }]) {
        const t = mac(held);
        const old = t.folder();
        put(old, JD, "12345");
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE], JSON.stringify(held));
        assert.ok(!CLIENT.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    it("names a video whose holder cannot be told by what it is and its size, under either import, and one owed a late check is one to wait for", async () => {
      for (const held of [{}, { import: "light" }]) {
        const t = mac(held);
        const old = t.folder();
        put(old, JD, "12345");
        t.episode(JD_FOLDER, JD, 5, "", SESSION_HELD);
        const shut = join(t.root, "Episodes", JD_FOLDER, "record");
        chmodSync(shut, 0o000);
        const said = [];
        try {
          said.push(...(await refused(t, "--drop", "Drop")));
          assert.deepEqual(said, [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE], JSON.stringify(held));
          owe(t, JD_FOLDER, JD, 5, old);
          const owed = await refused(t, "--drop", "Drop");
          assert.deepEqual(owed, [HEAD, `  A video of 5 bytes: already imported; its late check is still to come (due at ${due}).`, LATE], JSON.stringify(held));
          said.push(...owed);
        } finally {
          chmodSync(shut, 0o755);
        }
        assert.ok(!CLIENT.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    it("keeps a late check that found a problem a problem, with its advice, though this Mac owes it the check: it is tried again with retry", async () => {
      // A problem's late check stays owed (filing.js keeps it for the next run), so owed-first would hide every problem: Z1's line
      // and advice stay, and they never say to take the video out.
      for (const held of [{}, { import: "light" }]) {
        const t = mac(held);
        const old = t.folder();
        put(old, "Budget.mov", "123456");
        t.status("Budget.mov", { bytes: 6, problem: "Budget.rough-cut.mp4 is short" });
        owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, [HEAD, "  1 late check found a problem, and its video is still in the old folder.", PROBLEM_HERE], JSON.stringify(held));
        assert.ok(!said.some((line) => /take the video out|delete|still to come/.test(line)), said.join("\n"));
        t.done();
      }
    });
    it("under the light import names a waiting or kept video that has no label by what it is and its size, so that Jason can tell which to take out or delete, and lists two alike apart", async () => {
      // Their advice takes a file out of the old folder: a count does not say which. Failed, problem, owed and running stay counted.
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4", "12345");
      put(old, "Pricing call Acme Ltd.mov", "123456");
      put(old, "Sales call Acme Ltd.mov", "123456");
      t.episode("2026-10-22 Pricing call Acme Ltd (Mac Studio)", "Pricing call Acme Ltd.mov", 6);
      t.episode("2026-10-22 Sales call Acme Ltd (Mac Studio)", "Sales call Acme Ltd.mov", 6);
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE, KEPT_LINE("A video of 6 bytes"), KEPT_LINE("A video of 6 bytes"), KEPT]);
      assert.ok(!/Jane|Doe|Acme|Coaching|Pricing|Sales/.test(said.join("\n")), said.join("\n"));
      t.done();
    });
    it("under the light import says of a counted failed import whose video is gone what clears it: only its status file holds it, and a person takes it away", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      const status = join(t.root, "Episodes", ".importing");
      t.status("Coaching call Jane Doe.mp4", { failed: "x" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  1 import failed, and its video is not in the old folder now: only its status file, in ${status}, holds this, and a person takes it away by hand.`, ADVICE]);
      put(old, "Sales call Acme Ltd.mov", "12345");
      t.status("Sales call Acme Ltd.mov", { failed: "x" });
      t.status("Pricing call Acme Ltd.mov", { failed: "x" });
      const said = await refused(t, "--drop", "Drop");
      assert.deepEqual(said, [HEAD, `  3 imports failed, of which 1 has the video still in the old folder; of each whose video is gone, only its status file, in ${status}, holds it, and a person takes it away by hand.`, ADVICE]);
      assert.ok(!/Jane|Doe|Acme|Coaching|Pricing|Sales/.test(said.join("\n")), said.join("\n"));
      t.done();
    });
    it("tells a video's holder unknown only when an episode that cannot be read is named for that video, by this Mac or another", async () => {
      // An episode that cannot be read, named for another video, does not stop this one being named quietly; one named for it,
      // by either Mac, could be a session's, and it is named by what it is and its size.
      for (const [folder, said] of [["2026-10-19 Budget (Mac Studio)", "A video of 5 bytes"], ["2026-10-22 Talk (Sallie's laptop)", "A video of 5 bytes"], ["2026-10-22 Talk (Mac Studio)-2", "A video of 5 bytes"]]) {
        const t = mac();
        const old = t.folder();
        put(old, "Talk.mov", "12345");
        t.episode(folder, folder.includes("Budget") ? "Budget.mov" : "Talk.mov", 5, "", FINISHED);
        const shut = join(t.root, "Episodes", folder, "record");
        chmodSync(shut, 0o000);
        try {
          assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  ${said}: waits in ${old}.`, ADVICE], folder);
          // Owed a late check: named, with its time, when its holder is unknown; counted, with none, when it is not.
          owe(t, folder, "Talk.mov", 5, old);
          assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, folder.includes("Budget") ? "  1 video is already imported, and its late check is still to come." : `  ${said}: already imported; its late check is still to come (due at ${due}).`, LATE], folder);
        } finally {
          chmodSync(shut, 0o755);
        }
        t.done();
      }
    });
    it("says a video this Mac owes a late check is one to wait for before a failed import of it, and never to take it out", async () => {
      // An owed late check is made from the video in the old folder: a failed status of it is waited for as the check is.
      for (const status of [{ failed: "the sound could not be read" }]) {
        for (const held of [{}, { import: "light" }]) {
          const t = mac(held);
          const old = t.folder();
          put(old, "Budget.mov", "123456");
          t.status("Budget.mov", { bytes: 6, ...status });
          owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
          const said = await refused(t, "--drop", "Drop");
          const what = `${Object.keys(status)[0]} ${JSON.stringify(held)}`;
          assert.deepEqual(said, [HEAD, "  1 video is already imported, and its late check is still to come.", LATE], what);
          assert.ok(!said.some((line) => /take the video out|delete/.test(line)), said.join("\n"));
          t.done();
        }
      }
    });
    it("says a video this Mac owes a late check is one to wait for whatever holds it: no episode, or an import at work on it too", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      const OWED = [HEAD, "  1 video is already imported, and its late check is still to come.", LATE];
      assert.deepEqual(await refused(t, "--drop", "Drop"), OWED);
      t.status("Budget.mov", { bytes: 6 });
      assert.deepEqual(await refused(t, "--drop", "Drop"), OWED);
      t.done();
    });
    it("names a video an answered record that is not a session holds by what it is and its size, owed a late check or kept", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, "", { version: 3, kind: "finished", answer: { ...ANSWER, private: "no" } });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, KEPT_LINE("A video of 6 bytes"), KEPT]);
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, "  1 video is already imported, and its late check is still to come.", LATE]);
      t.done();
    });
    it("follows each kind of line with the advice for it alone: work, an imported video to wait for, one to delete, and what could not be read", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov", "12345");
      put(old, "Budget.mov", "123456");
      put(old, "Old.mov", "1234567");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      t.episode("2026-10-19 Old (Mac Studio)", "Old.mov", 7);
      const importing = join(t.root, "Episodes", ".importing");
      chmodSync(importing, 0o000);
      try {
        assert.deepEqual(await refused(t, "--drop", "Drop"), [
          HEAD,
          `  A video of 5 bytes: waits in ${old}.`,
          ADVICE,
          "  1 video is already imported, and its late check is still to come.",
          LATE,
          KEPT_LINE("A video of 7 bytes"),
          KEPT,
          `  The import status files, in ${importing}, could not be read (EACCES), so whether an import failed is not known.`,
          READABLE
        ]);
      } finally {
        chmodSync(importing, 0o755);
      }
      t.done();
    });
    it("under the light import names a waiting video that has no label by what it is and its size, and never by its file: its name may be a client's", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4");
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      put(old, "Sales call Acme Ltd.mov");
      const two = await refused(t, "--drop", "Drop");
      assert.deepEqual(two, [HEAD, `  A video of 5 bytes: waits in ${old}.`, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      // With a label, by the label: from this Mac's status, or from the episode that holds the video.
      t.status("Coaching call Jane Doe.mp4", { bytes: 5, label: "Video of 22 Oct, 10:40 (Mac Studio)", at: STOPPED });
      put(old, "Coaching call Jane Doe.mp4", "12345");
      t.episode("2026-10-22 Sales call (Mac Studio)", "Sales call Acme Ltd.mov", 5, "Video of 22 Oct, 11:00 (Mac Studio)");
      put(old, "Sales call Acme Ltd.mov", "12345");
      const labelled = await refused(t, "--drop", "Drop");
      assert.deepEqual(labelled, [HEAD, `  Video of 22 Oct, 10:40 (Mac Studio): waits in ${old}.`, ADVICE, KEPT_LINE("Video of 22 Oct, 11:00 (Mac Studio)"), KEPT]);
      for (const said of [...two, ...labelled]) assert.ok(!/Jane Doe|Acme/.test(said), said);
      t.done();
    });
    it("under the light import counts a failed import or a late check's problem that has no label too, and does not name its video, whether the video is there or not", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4");
      t.status("Coaching call Jane Doe.mp4", { failed: "the sound of Coaching call Jane Doe.mp4 could not be read" });
      t.status("Sales call Acme Ltd.mov", { problem: "Sales call Acme Ltd.rough-cut.mp4 is short" });
      t.status("Sales review Acme Ltd.mov", { failed: "ffprobe" });
      t.status("Labelled.mov", { failed: "ffprobe", label: "Video of 22 Oct, 10:40 (Mac Studio)" });
      const said = await refused(t, "--drop", "Drop");
      const gone = `, and its video is not in the old folder now: only its status file, in ${join(t.root, "Episodes", ".importing")}, holds this, and a person takes it away by hand`;
      // Counted apart by whether the video is still in the old folder, which decides what is to be done: no names.
      assert.deepEqual(said, [HEAD, `  Video of 22 Oct, 10:40 (Mac Studio): its import failed${gone}.`, `  2 imports failed, of which 1 has the video still in the old folder; of each whose video is gone, only its status file, in ${join(t.root, "Episodes", ".importing")}, holds it, and a person takes it away by hand.`, ADVICE, "  1 late check found a problem, and its video is not in the old folder now.", PROBLEM_GONE]);
      assert.ok(!/Jane|Doe|Acme|Coaching|Sales/.test(said.join("\n")), said.join("\n"));
      // The video that is there with a status that is counted is not counted again as a video that waits.
      assert.ok(!said.some((line) => /wait/.test(line)), said.join("\n"));
      t.done();
    });
    it("under the light import says, of counted failed imports and problems, how many have their video still in the old folder, one by one and all of them or none", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "A.mov");
      t.status("A.mov", { failed: "x" });
      t.status("Gone.mov", { failed: "x" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  2 imports failed, of which 1 has the video still in the old folder; of each whose video is gone, only its status file, in ${join(t.root, "Episodes", ".importing")}, holds it, and a person takes it away by hand.`, ADVICE]);
      put(old, "B.mov");
      t.status("B.mov", { failed: "x" });
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  3 imports failed, of which 2 have the video still in the old folder; of each whose video is gone, only its status file, in ${join(t.root, "Episodes", ".importing")}, holds it, and a person takes it away by hand.`, ADVICE]);
      rmSync(join(old, "A.mov"));
      rmSync(join(old, "B.mov"));
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  3 imports failed, of which none have the video still in the old folder; of each whose video is gone, only its status file, in ${join(t.root, "Episodes", ".importing")}, holds it, and a person takes it away by hand.`, ADVICE]);
      const one = mac({ import: "light" });
      put(one.folder(), "C.mov");
      one.status("C.mov", { failed: "x" });
      assert.deepEqual(await refused(one, "--drop", "Drop"), [HEAD, "  1 import failed, and its video is still in the old folder.", "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again."]);
      one.status("D.mov", { problem: "y" });
      one.status("E.mov", { problem: "y" });
      put(one.folder(), "E.mov");
      assert.deepEqual(await refused(one, "--drop", "Drop"), [HEAD, "  1 import failed, and its video is still in the old folder.", ADVICE, "  2 late checks found a problem, of which 1 has the video still in the old folder.", PROBLEM_HERE, PROBLEM_GONE]);
      one.done();
      t.done();
    });
    it("names a video that has no label the same whether the file says full or light", async () => {
      // A file that says "full" is read as before and one that says "light" is as it is; told --import light over either, no video is named by its file.
      for (const [held, told] of [[{ import: "full" }, "light"], [{ import: "light" }, "light"]]) {
        const t = mac(held);
        put(t.folder(), "Coaching call Jane Doe.mp4");
        const said = await refused(t, "--drop", "Drop", "--import", told);
        assert.ok(!said.join("\n").includes("Jane Doe"), said.join("\n"));
        assert.equal(said[1], `  A video of 5 bytes: waits in ${t.folder()}.`, told);
        t.done();
      }
    });
    const READABLE = "Make each readable (macOS asks whether node may read Dropbox: Allow it), then run this again.";
    const HEAD_UNREAD = "Not written: the drop folder would change from Unedited Video to Drop, and the old one could not be looked at:";
    it("refuses when the late checks this Mac owes cannot be read, and says no imported video is one to delete then: which still wait for one is not known", async () => {
      // An unread folder of late checks would read as none owed, and every imported video would be said to be one to delete.
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      t.episode("2026-10-20 Budget (Mac Studio)", "Budget.mov", 6);
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      chmodSync(pendingFolder(t.home), 0o000);
      try {
        const said = await refused(t, "--drop", "Drop");
        // Its own words: the old folder was read, and the late checks are kept on this Mac's own disk, not in Dropbox.
        assert.deepEqual(said, [
          "Not written: the drop folder would change from Unedited Video to Drop, and the late checks this Mac still owes could not be read:",
          `  The late checks this Mac still owes, kept on this Mac in ${pendingFolder(t.home)}, could not be read (EACCES): the old folder was read, but which of its videos still wait for a late check is not known.`,
          "Make that folder readable again (it is on this Mac's own disk, not in Dropbox), then run this again."
        ]);
        assert.ok(!said.some((line) => /Delete|take the video out/.test(line)), said.join("\n"));
      } finally {
        chmodSync(pendingFolder(t.home), 0o755);
      }
      t.done();
    });
    it("says of late checks that cannot be read that the old folder was read only when it was", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Budget.mov", "123456");
      owe(t, "2026-10-20 Budget (Mac Studio)", "Budget.mov", 6, old);
      chmodSync(old, 0o000);
      chmodSync(pendingFolder(t.home), 0o000);
      try {
        assert.deepEqual(await refused(t, "--drop", "Drop"), [
          HEAD_UNREAD,
          `  The old folder, ${old}, could not be read (EACCES), so what it holds is not known.`,
          READABLE,
          `  The late checks this Mac still owes, kept on this Mac in ${pendingFolder(t.home)}, could not be read (EACCES), so which videos still wait for a late check is not known.`,
          "Make that folder readable again (it is on this Mac's own disk, not in Dropbox), then run this again."
        ]);
      } finally {
        chmodSync(old, 0o755);
        chmodSync(pendingFolder(t.home), 0o755);
      }
      t.done();
    });
    it("refuses when the old folder cannot be read, and says so with the code and the folder's own path: only a folder that is not there is empty", async () => {
      const t = mac({ import: "light" });
      const old = t.folder();
      put(old, "Coaching call Jane Doe.mp4");
      chmodSync(old, 0o000);
      try {
        const said = await refused(t, "--drop", "Drop");
        assert.deepEqual(said, [HEAD_UNREAD, `  The old folder, ${old}, could not be read (EACCES), so what it holds is not known.`, READABLE]);
        assert.ok(!/Jane|Doe/.test(said.join("\n")), said.join("\n"));
      } finally {
        chmodSync(old, 0o755);
      }
      // Readable again, the video that is there is what stops it.
      assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE]);
      t.done();
    });
    it("refuses when the status files cannot be read: what is not known is not taken for none", async () => {
      const t = mac();
      const importing = join(t.root, "Episodes", ".importing");
      t.status("Talk.mov", { failed: "the sound could not be read" });
      chmodSync(importing, 0o000);
      try {
        assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD_UNREAD, `  The import status files, in ${importing}, could not be read (EACCES), so whether an import failed is not known.`, READABLE]);
      } finally {
        chmodSync(importing, 0o755);
      }
      t.done();
    });
    it("says what could not be read beside what holds the switch, when both are so", async () => {
      const t = mac();
      const old = t.folder();
      put(old, "Talk.mov");
      const importing = join(t.root, "Episodes", ".importing");
      chmodSync(importing, 0o000);
      try {
        assert.deepEqual(await refused(t, "--drop", "Drop"), [HEAD, `  A video of 5 bytes: waits in ${old}.`, ADVICE, `  The import status files, in ${importing}, could not be read (EACCES), so whether an import failed is not known.`, READABLE]);
      } finally {
        chmodSync(importing, 0o755);
      }
      t.done();
    });
    it("refuses, and names no part of a client's file name, when a video in the old folder cannot be looked at: a link that goes round in a circle", async () => {
      for (const light of [true, false]) {
        const t = mac(light ? { import: "light" } : {});
        const old = t.folder();
        // stat of it fails with ELOOP, which once escaped the check as an unhandled rejection with a stack trace holding the path.
        symlinkSync("Coaching call Jane Doe.mp4", join(old, "Coaching call Jane Doe.mp4"));
        const said = await refused(t, "--drop", "Drop");
        // Its size cannot be told, so it is named by what it is alone.
        assert.deepEqual(said, [HEAD, `  A video: waits in ${old}.`, ADVICE]);
        assert.ok(!/Jane|Doe/.test(said.join("\n")), said.join("\n"));
        t.done();
      }
    });
    it("says only a plain line with the error's code when the look itself fails, never its message, which may hold a path: nothing is written and no rejection escapes", async () => {
      const t = mac({ import: "light" });
      put(t.folder(), "Coaching call Jane Doe.mp4");
      const before = t.held();
      // A time that cannot be read throws from inside the look, with a message that holds a client's file name.
      const boom = { valueOf: () => { throw Object.assign(new Error("/x/Unedited Video/Mac Studio/Coaching call Jane Doe.mp4: boom"), { code: "EBOOM" }); } };
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        const code = await settingsMain([command, ...t.told, "--drop", "Drop"], { home: t.home, say: (line) => t.said.push(line), now: boom });
        assert.deepEqual([code, t.said], [1, ["The old drop folder could not be looked at (EBOOM), so nothing was written."]], command);
        assert.equal(t.held(), before);
      }
      // With no code, it says there was an error, and nothing more.
      const bare = { valueOf: () => { throw new Error("Coaching call Jane Doe.mp4"); } };
      t.said.length = 0;
      assert.equal(await settingsMain(["plan", ...t.told, "--drop", "Drop"], { home: t.home, say: (line) => t.said.push(line), now: bare }), 1);
      assert.deepEqual(t.said, ["The old drop folder could not be looked at (an error), so nothing was written."]);
      t.done();
    });
  });
});

describe("what set, sessions, show and studio say when this Mac's settings cannot be used", () => {
  const PLAIN = (t) => `This Mac has no settings for episodes (${settingsFile(t.home)}). Jason runs install.sh --machine on it.`;
  /** What each of the four says, with the settings file as it is, and how it ended. */
  const said = (t) => ["set --readings off", "sessions --teachings off", "show", "studio --node /opt/homebrew/bin/node"].map((line) => {
    t.said.length = 0;
    const code = settingsMain(line.split(" "), { home: t.home, say: (l) => t.said.push(l), now: new Date("2026-10-23T10:00:00-04:00") });
    return [code, t.said.join("\n")];
  });
  it("is what install.sh --machine does, when there are none, or the file is not JSON: it makes them, or mends the file", () => {
    const t = setup();
    for (const [code, text] of said(t)) assert.deepEqual([code, text], [2, PLAIN(t)]);
    mkdirSync(dirname(settingsFile(t.home)), { recursive: true });
    writeFileSync(settingsFile(t.home), "{ not json");
    for (const [code, text] of said(t)) assert.deepEqual([code, text], [2, `This Mac's settings could not be read (${settingsFile(t.home)}: it is not JSON). Jason runs install.sh --machine on it.`]);
    t.done();
  });
  it("is, when a setting in the file is wrong, to put it right by hand, or with the installer's option for it when it has one", () => {
    const t = setup();
    writeSettings(t.home, t.given);
    writeFileSync(settingsFile(t.home), readFileSync(settingsFile(t.home), "utf8").replace('"version": 1', '"version": 1, "import": "ligth"'));
    for (const [code, text] of said(t)) {
      assert.equal(code, 2);
      assert.equal(text, `This Mac's settings could not be read (${settingsFile(t.home)}: the import must be "full" or "light"). Jason puts that setting right by hand, or runs install.sh --machine on it, which writes this Mac's name, BRIMM Video and the checkout every time, the import, the hand-off version and the drop folder when told --import, --handoff or --drop, and readings off with --rules-only.`);
    }
    t.done();
  });
  it("is, when the file cannot be read at all, to put the file right by hand: the installer does not mend that", () => {
    const t = setup();
    mkdirSync(settingsFile(t.home), { recursive: true });
    for (const [code, text] of said(t)) {
      assert.equal(code, 2);
      assert.equal(text, `This Mac's settings could not be read (${settingsFile(t.home)}: EISDIR). Jason puts that file right by hand.`);
    }
    t.done();
  });
});

describe("what --help says of write, plan and set", () => {
  /** Each command's own part of the help: its line, and the lines after it up to the next command's. */
  const HELP_OF = (command) => {
    const t = setup();
    settingsMain(["--help"], { home: t.home, say: (line) => t.said.push(line) });
    t.done();
    const blocks = t.said[0].split(/\n(?=  node settings\.js )/).filter((b) => b.startsWith("  node settings.js "));
    return blocks.filter((b) => b.startsWith(`  node settings.js ${command} `) || b.startsWith(`  node settings.js ${command}\n`)).join("\n");
  };
  it("names each option set takes, and each that write and plan take, and no option that none of them takes", () => {
    const options = (text) => [...new Set(text.match(/--[a-z-]+/g) || [])].sort();
    const written = [...Object.keys(WRITTEN), ...Object.keys(SETTABLE), "--drop-folder", "--switch-back"].sort();
    assert.deepEqual(options(HELP_OF("set")), Object.keys(SETTABLE).sort());
    assert.deepEqual(options(HELP_OF("write")), written);
    assert.deepEqual(options(HELP_OF("plan")), written);
    // Each value an option takes, as set refuses it, is in the line that names the option.
    for (const [option, { takes }] of Object.entries(SETTABLE)) {
      const values = takes.replace(/ or /g, "|");
      for (const command of ["set", "write", "plan"]) assert.ok(HELP_OF(command).includes(`[${option} ${values}]`), `${command}: ${option} ${values}`);
    }
  });
  it("says what plan and write do beyond set: plan writes nothing, and write looks at the old drop folder first", () => {
    const help = HELP_OF("plan").replace(/\s+/g, " ");
    assert.ok(help.includes("Nothing is written."), help);
    const write = HELP_OF("write").replace(/\s+/g, " ");
    assert.ok(write.includes("old drop folder"), write);
  });
  it("says of set that it does not change the drop folder: the installer switches it", () => {
    const set = HELP_OF("set").replace(/\s+/g, " ");
    assert.ok(set.includes("does not change the drop folder: it is switched by the installer"), set);
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    assert.ok(readme.includes("`node settings.js set` never changes the drop folder"), "README.md");
  });
  it("is told by the README: every kind of line the refusal of a switch has, and an old node counting as none", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const paragraph = readme.split("\n").find((line) => line.startsWith("**Switching a Mac's drop folder.**"));
    assert.ok(paragraph, "README's Switching a Mac's drop folder");
    for (const said of [
      "a video an episode already holds, which this Mac still owes a late check, is said to be already imported, with when the check is due, and to run the installer again after it",
      "one it owes none (the check passed, or it is a copy of an imported video) is said to be one nothing of its import will take out, for a person to delete by hand before the installer is run again",
      "an old folder or status files that cannot be read (macOS asks whether node may read Dropbox), or this Mac's own late checks (on its own disk), refuse too, with the error's code",
      "a late check this Mac owes comes first, whatever holds the video and before a failed import of it",
      "a node older than 22 counts as no node when the settings are to be checked",
      "try a late check that found a problem again with `retry` and leave its video in the old folder, since the check is made again from that video",
      "a video whose import is at work now is said to be being imported, to wait for it and run the installer again, and to leave its video in the old folder"
    ]) assert.ok(paragraph.includes(said), `${said}\n---\n${paragraph}`);
  });
  it("says which folders a picked drop folder and an exports folder may not be, and that macOS may ask about reading a drop folder, in the help and the README (L1c)", () => {
    const write = HELP_OF("write").replace(/\s+/g, " ");
    assert.ok(write.includes("not BRIMM Video's folders, BRIMM VIDEO Transfer, BRIMM VIDEO MacBook, BRIMM Video Work (but for Drop in it), her chat's folders, Zoom's, Downloads or the exports folder; nor one that holds a video already, which would be imported at once, or cannot be read, unless it is the one this Mac watches now."), write);
    assert.ok(write.includes("--exports-folder says where HyperFrames' exports are looked for besides Downloads, a cloud folder too: never the drop folder, a folder inside it or one that holds it, whether the drop folder is in Dropbox or on this Mac; and not Episodes, References, Drop or Unedited Video in BRIMM Video, BRIMM Video Work, BRIMM VIDEO Transfer, BRIMM VIDEO MacBook, a folder the transcript tool watches, her chat's folders, Zoom's, Studio's settings folder or a drop folder a Mac has marked, nor a folder inside one."), write);
    const plan = HELP_OF("plan").replace(/\s+/g, " ");
    assert.ok(plan.includes("whether macOS may ask about reading it"), plan);
    assert.doesNotMatch(plan, /asks once/);
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const paragraph = readme.split("\n").find((line) => line.startsWith("**A drop folder of a Mac's own.**"));
    assert.ok(paragraph, "README's A drop folder of a Mac's own");
    for (const clause of [
      "a warning when it is in Dropbox, iCloud Drive or another cloud folder, that every video dropped there goes up to that cloud, a client or group session's recording too;",
      "the Files and Folders question, which macOS may ask again after node is updated, and may ask of the app her chat runs in too, for a folder under Desktop or Documents, in iCloud Drive or another cloud folder, or on another disk;",
      "Studio's settings folder",
      "when it holds a video already, as the import counts them, a file still arriving as the video it will be (Finder's own files and the marker are none), which would be imported as soon as the folder is watched, or cannot be read, unless it is the folder this Mac watches now;"
    ]) assert.ok(paragraph.includes(clause), clause);
  });
  it("is as the header of settings.js says, for each of the three: the line that names the command and its options is the same", () => {
    const top = readFileSync(SETTINGS, "utf8").split("\n").filter((l) => l.startsWith("//   node settings.js ")).map((l) => l.slice(3));
    for (const command of ["write", "plan", "set"]) {
      const help = HELP_OF(command).split("\n")[0];
      assert.ok(top.includes(help), `${help}\n---\n${top.join("\n")}`);
    }
  });
});

describe("a Mac's own drop folder, picked (Phase 3, L1)", () => {
  const AT = new Date("2026-11-06T10:00:00-05:00");
  const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marked = (mac, at) => `the exports folder cannot be a drop folder, and ${mac} has marked ${at} as its own (its marker, .brimm-watched-by, stays there when that Mac moves to another drop folder)`;
  const ONE = "the drop folder holds a video already, which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the video out first";
  const TWO = "the drop folder holds 2 videos already, which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the videos out first";
  const markedAbove = (mac, at) => `the exports folder cannot be inside a drop folder, and ${mac} has marked ${at}, which holds it, as its own (its marker, .brimm-watched-by, stays there when that Mac moves to another drop folder)`;
  /** A Mac whose BRIMM Video is in a made-up Dropbox in its home folder, with the folders a drop folder may be picked in. */
  function mac(held = {}, { transcripts } = {}) {
    const t = setup();
    const home = realpathSync(t.home);
    const root = join(home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB", "BRIMM Video");
    for (const d of [join(root, "Episodes", ".importing"), join(home, "Desktop"), join(home, "Documents", "Zoom"), join(home, "Downloads"), join(home, "BRIMM Video Work")]) mkdirSync(d, { recursive: true });
    writeSettings(home, { machine: "Mac Studio", root, checkout: CHECKOUT, import: "light", ...held });
    const clones = [];
    // The transcript tool's launch agent, by its file's ending and the folders it lists, given as a function of { home, root } (L1c).
    const lists = {};
    for (const [ending, folders] of Object.entries(transcripts ? transcripts({ home, root }) : {})) {
      const file = join(home, "Library", "LaunchAgents", `com.thebrimm.transcribe${ending}`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "x");
      lists[file] = folders;
    }
    const plutilAsked = [];
    const plutil = (program, args, options) => {
      plutilAsked.push([program, ...args, options]);
      return Object.hasOwn(lists, args.at(-1)) ? { status: 0, stdout: JSON.stringify(lists[args.at(-1)]) } : { status: 1, stdout: "" };
    };
    const run = async (...argv) => settingsMain(argv, { home, say: (line) => t.said.push(line), now: AT, plutil, clone: (from, to) => { clones.push(to); writeFileSync(to, readFileSync(from)); } });
    const told = ["--machine", "Mac Studio", "--root", root, "--checkout", CHECKOUT];
    const folder = (parent, machine = "Mac Studio") => {
      mkdirSync(join(root, parent, machine), { recursive: true });
      return join(root, parent, machine);
    };
    return { ...t, home, root, run, told, folder, clones, plutilAsked, file: settingsFile(home), held: () => readFileSync(settingsFile(home), "utf8"), read: () => readSettings(home).settings, desktop: join(home, "Desktop", "Drop") };
  }

  describe("the settings and the helpers", () => {
    it("takes dropPath and exportsPath as whole paths, and dropPath with any import setting (every import is light)", () => {
      const base = { version: 1, machine: "Mac Studio", root: ROOT, checkout: CHECKOUT, import: "light" };
      assert.equal(settingsFault({ ...base, dropPath: "/Users/s/Desktop/Drop", exportsPath: "/Users/s/Exports" }), "");
      assert.equal(settingsFault({ ...base, dropPath: "Desktop/Drop" }), "the path to the drop folder is not a whole path");
      assert.equal(settingsFault({ ...base, exportsPath: "Exports" }), "the path to the exports folder is not a whole path");
      // L1b: every import is light, so a drop folder of its own needs no import setting.
      assert.equal(settingsFault({ ...base, dropPath: "/Users/s/Drop", import: "full" }), "");
      assert.equal(settingsFault({ ...base, dropPath: "/Users/s/Drop", import: undefined }), "");
      assert.equal(settingsFault({ ...base, dropPath: null, exportsPath: null, import: "full" }), "");
    });
    it("is local when the settings hold a dropPath, and finds the folders from them", () => {
      const home = "/Users/s";
      const plain = { version: 1, machine: "Mac Studio", root: "/r", checkout: "/c", drop: "Drop" };
      const local = { ...plain, import: "light", dropPath: "/Users/s/Desktop/Drop" };
      assert.deepEqual([isLocal(plain), isLocal(local), isLocal({ ...plain, dropPath: null })], [false, true, false]);
      assert.equal(defaultDropFolder(home), "/Users/s/BRIMM Video Work/Drop");
      assert.equal(dropFolderOf(local, home), "/Users/s/Desktop/Drop");
      assert.equal(dropFolderOf(plain, home), "/r/Drop/Mac Studio");
      assert.equal(dropFolderOf({ ...plain, drop: undefined }, home), "/r/Unedited Video/Mac Studio");
      assert.equal(episodeFilesFolder(home, "2026-11-06 Talk (Mac Studio)"), "/Users/s/BRIMM Video Work/2026-11-06 Talk (Mac Studio)/video");
      assert.equal(importingFolderOf(local, home), "/Users/s/Library/Application Support/BRIMM Video/importing");
      assert.equal(importingFolderOf(plain, home), "/r/Episodes/.importing");
      assert.deepEqual(statusFoldersOf(local, home), ["/Users/s/Library/Application Support/BRIMM Video/importing", "/r/Episodes/.importing"]);
      assert.deepEqual(statusFoldersOf(plain, home), ["/r/Episodes/.importing"]);
      assert.equal(exportsFolderOf(plain, home), "/Users/s/Downloads");
      assert.equal(exportsFolderOf({ ...plain, exportsPath: "/Users/s/Exports" }, home), "/Users/s/Exports");
    });
    it("names the cloud folder a path is in, by its real path", () => {
      const t = mac();
      const lib = join(t.home, "Library");
      for (const d of [join(lib, "CloudStorage", "Dropbox-X", "In"), join(lib, "CloudStorage", "GoogleDrive-X", "In"), join(lib, "Mobile Documents", "com~apple~CloudDocs", "In"), join(t.home, "Dropbox", "In"), join(t.home, "Documents", "In"), join(t.home, "BRIMM Video Work", "Drop")]) mkdirSync(d, { recursive: true });
      assert.equal(cloudFolder(join(lib, "CloudStorage", "Dropbox-X", "In"), t.home), "Dropbox");
      assert.equal(cloudFolder(join(t.home, "Dropbox", "In"), t.home), "Dropbox");
      assert.equal(cloudFolder(join(lib, "Mobile Documents", "com~apple~CloudDocs", "In"), t.home), "iCloud Drive");
      assert.equal(cloudFolder(join(t.home, "Desktop", "Drop"), t.home), "iCloud Drive, if it keeps Desktop & Documents");
      assert.equal(cloudFolder(join(t.home, "Documents", "In"), t.home), "iCloud Drive, if it keeps Desktop & Documents");
      assert.equal(cloudFolder(join(lib, "CloudStorage", "GoogleDrive-X", "In"), t.home), "a cloud folder");
      assert.equal(cloudFolder(join(t.home, "BRIMM Video Work", "Drop"), t.home), "");
      // A link into one is the target's.
      symlinkSync(join(lib, "CloudStorage", "Dropbox-X", "In"), join(t.home, "BRIMM Video Work", "link"));
      assert.equal(cloudFolder(join(t.home, "BRIMM Video Work", "link"), t.home), "Dropbox");
      t.done();
    });
    it("says macOS may ask whether node may read a folder under Desktop or Documents, in iCloud Drive or a folder in ~/Library/CloudStorage, or on another disk (L1c, X3)", () => {
      const t = mac();
      const lib = join(t.home, "Library");
      for (const d of [join(lib, "CloudStorage", "GoogleDrive-X", "My Drive", "Drop"), join(lib, "CloudStorage", "OneDrive-Personal", "Drop"), join(lib, "CloudStorage", "Dropbox-X", "The BRIMM DB", "In"), join(lib, "Mobile Documents", "com~apple~CloudDocs", "Drop"), join(t.home, "Documents", "In"), join(t.home, "BRIMM Video Work", "Drop")]) mkdirSync(d, { recursive: true });
      symlinkSync(join(lib, "CloudStorage", "GoogleDrive-X", "My Drive", "Drop"), join(t.home, "BRIMM Video Work", "link"));
      for (const p of [join(lib, "CloudStorage", "GoogleDrive-X", "My Drive", "Drop"), join(lib, "CloudStorage", "OneDrive-Personal", "Drop"), join(lib, "CloudStorage", "Dropbox-X", "The BRIMM DB", "In"), join(lib, "Mobile Documents", "com~apple~CloudDocs", "Drop"), join(t.home, "Desktop", "Drop"), join(t.home, "Documents", "In"), "/Volumes/Big/Drop", join(t.home, "BRIMM Video Work", "link")]) assert.equal(needsFilesAccess(p, t.home), true, p);
      for (const p of [join(t.home, "BRIMM Video Work", "Drop"), join(t.home, "Movies", "Drop")]) assert.equal(needsFilesAccess(p, t.home), false, p);
      t.done();
    });
    it("reads the folders the transcript tool's launch agent lists, from its file and from that file turned off, through plutil, and lists none it cannot read (L1c, finding 8)", () => {
      const t = mac();
      const dir = join(t.home, "Library", "LaunchAgents");
      mkdirSync(dir, { recursive: true });
      const on = join(dir, "com.thebrimm.transcribe.plist");
      const off = join(dir, "com.thebrimm.transcribe.plist.off");
      const asked = [];
      const says = (answers) => (program, args, options) => {
        asked.push([program, ...args, options]);
        const answer = answers[args.at(-1)];
        if (answer instanceof Error) throw answer;
        return answer ?? { status: 1, stdout: "" };
      };
      assert.deepEqual(transcriptFolders(t.home, says({})), []);
      assert.deepEqual(asked, []);
      writeFileSync(on, "x");
      writeFileSync(off, "x");
      const answered = { [on]: { status: 0, stdout: JSON.stringify(["/Users/s/The BRIMM DB/BRIMM VIDEO Transfer", "/Users/s/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer"]) }, [off]: { status: 0, stdout: JSON.stringify(["/Users/s/BRIMM Transcripts", "Relative", 3]) } };
      assert.deepEqual(transcriptFolders(t.home, says(answered)), ["/Users/s/The BRIMM DB/BRIMM VIDEO Transfer", "/Users/s/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer", "/Users/s/BRIMM Transcripts"]);
      assert.deepEqual(asked, [on, off].map((file) => ["/usr/bin/plutil", "-extract", "WatchPaths", "json", "-o", "-", "--", file, { encoding: "utf8", timeout: 5000 }]));
      // The drop folder's refusal in install.sh reads the file that is on alone, so settings.js's count passes over only those.
      assert.deepEqual(transcriptFolders(t.home, says(answered), { off: false }), ["/Users/s/The BRIMM DB/BRIMM VIDEO Transfer", "/Users/s/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer"]);
      for (const answer of [{ status: 1, stdout: "" }, { status: null, error: new Error("ETIMEDOUT"), stdout: "" }, new Error("ENOENT"), { status: 0, stdout: "not JSON" }, { status: 0, stdout: '{"WatchPaths":["/x"]}' }]) {
        assert.deepEqual(transcriptFolders(t.home, says({ [on]: answer, [off]: answer })), []);
      }
      t.done();
    });
    it("reads a launch agent's file turned off with the Mac's own plutil (L1c, finding 8)", { skip: process.platform !== "darwin" ? "plutil is a Mac's" : false }, () => {
      const t = mac();
      const dir = join(t.home, "Library", "LaunchAgents");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "com.thebrimm.transcribe.plist.off"), '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Label</key><string>com.thebrimm.transcribe</string><key>WatchPaths</key><array><string>/Users/s/R&amp;D Transfer</string><string>/Users/s/BRIMM Transcripts</string></array></dict></plist>\n');
      assert.deepEqual(transcriptFolders(t.home), ["/Users/s/R&D Transfer", "/Users/s/BRIMM Transcripts"]);
      t.done();
    });
    it("says a folder in Finder's words", () => {
      assert.equal(folderWords("/Users/s/BRIMM Video Work/Drop", "/Users/s"), "BRIMM Video Work › Drop, in your home folder");
      assert.equal(folderWords("/Users/s/Library/CloudStorage/Dropbox-X/The BRIMM DB/In", "/Users/s"), "Dropbox › The BRIMM DB › In");
      assert.equal(folderWords("/Volumes/Big/Drop", "/Users/s"), "Big › Drop");
      assert.equal(folderWords("/Users/s/Library/Mobile Documents/com~apple~CloudDocs/Exports", "/Users/s"), "iCloud Drive › Exports");
      assert.equal(folderWords("/Volumes/Backup/Exports", "/Users/s"), "Backup › Exports");
      // A home folder on another disk is still the home folder; a folder beside it on that disk is named by the disk (L1b fix 2).
      assert.equal(folderWords("/Volumes/Data/Users/s/Movies/Exports", "/Volumes/Data/Users/s"), "Movies › Exports, in your home folder");
      assert.equal(folderWords("/Volumes/Data/Users/s/Library/Mobile Documents/com~apple~CloudDocs/Exports", "/Volumes/Data/Users/s"), "iCloud Drive › Exports");
      assert.equal(folderWords("/Volumes/Data/Shared/Exports", "/Volumes/Data/Users/s"), "Data › Shared › Exports");
    });
    it("says the exports folder in Finder's words only when it is not Downloads, told apart by its real path (L1b fix 2)", () => {
      const t = mac();
      const s = JSON.parse(t.held());
      const downloads = join(t.home, "Downloads");
      assert.equal(exportsWords(s, t.home), "");
      assert.equal(exportsWords({ ...s, exportsPath: downloads }, t.home), "");
      // A link to Downloads is Downloads.
      symlinkSync(downloads, join(t.home, "Desktop", "Get"));
      assert.equal(exportsWords({ ...s, exportsPath: join(t.home, "Desktop", "Get") }, t.home), "");
      assert.equal(exportsWords({ ...s, exportsPath: join(t.home, "Movies", "Exports") }, t.home), "Movies › Exports, in your home folder");
      // Downloads itself a link, as on the Mac Studio: the folder it leads to is Downloads.
      const linked = mac();
      const real = join(linked.home, "Library", "CloudStorage", "Dropbox-X", "Mac", "Downloads");
      mkdirSync(real, { recursive: true });
      rmSync(join(linked.home, "Downloads"), { recursive: true });
      symlinkSync(real, join(linked.home, "Downloads"));
      assert.equal(exportsWords({ ...s, exportsPath: real }, linked.home), "");
      assert.equal(exportsWords({ ...s, exportsPath: join(linked.home, "Downloads") }, linked.home), "");
      linked.done();
      t.done();
    });
    it("takes Downloads spelt in another letter case for Downloads, on a disk whose names are not case-sensitive (L1b fix 2)", { skip: caseBlind ? false : "the test's disk tells letter case apart" }, () => {
      const t = mac();
      const s = JSON.parse(t.held());
      assert.equal(exportsWords({ ...s, exportsPath: join(t.home, "downloads") }, t.home), "");
      assert.equal(exportsWords({ ...s, exportsPath: join(t.home, "DOWNLOADS") }, t.home), "");
      t.done();
    });
  });

  describe("dropFolderFault", () => {
    it("refuses the folders of BRIMM Video, of Work, of her chat, of Zoom, Downloads and the exports folder, and what is not whole or has no parent", () => {
      const t = mac();
      const { home, root } = t;
      const exports = join(home, "Exports", "HF");
      for (const d of [join(exports, "in"), join(root, "Drop", "Mac Studio"), join(root, "Unedited Video"), join(root, "References"), join(root, "Drop", "Sallie's laptop"), join(root, "Drop", "Jason's MacBook"), join(home, "BRIMM Video Work", "2026-11-06 Talk (Mac Studio)"), join(home, "BRIMM Video Studio", "Drop"), join(home, "BRIMM Video Workshop"), join(home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB", "In")]) mkdirSync(d, { recursive: true });
      const facts = { home, root, exports, zoom: join(home, "Documents", "Zoom") };
      const fault = (path) => dropFolderFault(path, facts);
      for (const [what, path] of [
        ["BRIMM Video itself", root], ["a folder in Episodes", join(root, "Episodes", "x")], ["Mac Studio's old drop folder", join(root, "Drop", "Mac Studio")],
        ["her laptop's drop folder", join(root, "Drop", "Sallie's laptop")], ["Jason's MacBook's", join(root, "Drop", "Jason's MacBook")], ["Unedited Video", join(root, "Unedited Video")],
        ["References", join(root, "References")], ["Work", join(home, "BRIMM Video Work")], ["an episode's folder", join(home, "BRIMM Video Work", "2026-11-06 Talk (Mac Studio)")],
        ["her chat's folder", join(home, "BRIMM Video Studio", "Drop")], ["the workshop", join(home, "BRIMM Video Workshop")], ["Zoom's folder", join(home, "Documents", "Zoom")], ["Zoom's parent", join(home, "Documents")],
        ["Downloads", join(home, "Downloads")], ["the exports folder", exports], ["a folder in it", join(exports, "in")], ["its parent", join(home, "Exports")],
        ["a relative path", "Desktop/Drop"], ["one whose parent is not there", join(home, "Nowhere", "Drop")], ["her home folder", home], ["a folder that holds BRIMM Video", join(home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB")]
      ]) assert.notEqual(fault(path), "", what);
      assert.equal(fault(join(home, "Desktop", "Drop")), "");
      assert.equal(fault(join(home, "BRIMM Video Work", "Drop")), "");
      assert.equal(fault(join(home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB", "In")), "");
      // Said in plain words, naming what it is, and with no path.
      assert.equal(fault("Desktop/Drop"), "the drop folder must be a whole path");
      assert.equal(fault(join(home, "Nowhere", "Drop")), "the folder that is to hold the drop folder is not there");
      assert.equal(fault(join(root, "Episodes", "x")), "the drop folder cannot be Episodes in BRIMM Video, or inside it, or hold it");
      assert.equal(fault(join(home, "Downloads")), "the drop folder cannot be Downloads, or inside it, or hold it");
      t.done();
    });
    it("refuses any folder in BRIMM Video, Assets and a new folder included, by dropFolderFault, write and plan", async () => {
      const t = mac();
      const inside = [join(t.root, "Assets"), join(t.root, "Assets", "In"), join(t.root, "Inbox")];
      mkdirSync(join(t.root, "Assets", "In"), { recursive: true });
      const facts = { home: t.home, root: t.root, exports: join(t.home, "Downloads"), zoom: join(t.home, "Documents", "Zoom") };
      const before = t.held();
      for (const path of inside) {
        assert.equal(dropFolderFault(path, facts), "the drop folder cannot be BRIMM Video, or inside it, or hold it", path);
        for (const command of ["plan", "write"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, "--drop-folder", path), 1, `${command} ${path}`);
          assert.deepEqual(t.said, ["Not written: the drop folder cannot be BRIMM Video, or inside it, or hold it."]);
        }
      }
      assert.equal(t.held(), before);
      t.done();
    });
    it("refuses a folder that holds a video already, counted as the import counts them, a file still arriving as the video it will be, but not the folder this Mac watches now (L1c, X1)", () => {
      const t = mac();
      const facts = { home: t.home, root: t.root, exports: join(t.home, "Downloads"), zoom: join(t.home, "Documents", "Zoom"), machine: "Mac Studio" };
      const desktop = join(t.home, "Desktop");
      for (const [name, text] of [[".DS_Store", "x"], [".localized", ""], [".brimm-watched-by", "Mac Studio\n"], ["notes.txt", "n"], ["notes.txt.part", "n"], [".Hidden.mov.part", "n"], ["Talk.rough-cut.mp4", "v"], ["Done.mov", "v"], ["Done.cut-plan.json", "{}"]]) writeFileSync(join(desktop, name), text);
      mkdirSync(join(desktop, "Folder"));
      writeFileSync(join(desktop, "Folder", "Inside.mov"), "v");
      assert.equal(dropFolderFault(desktop, facts), "");
      writeFileSync(join(desktop, "Family birthday.mov"), "v");
      assert.equal(dropFolderFault(desktop, facts), ONE);
      writeFileSync(join(desktop, "voice memo.m4a"), "v");
      assert.equal(dropFolderFault(desktop, facts), TWO);
      symlinkSync(desktop, join(t.home, "Linked"));
      for (const current of [desktop, join(t.home, "Linked"), ...(caseBlind ? [join(t.home, "desktop")] : [])]) assert.equal(dropFolderFault(desktop, { ...facts, current }), "", current);
      assert.equal(dropFolderFault(join(t.home, "Linked"), { ...facts, current: desktop }), "");
      assert.equal(dropFolderFault(desktop, { ...facts, current: join(desktop, "Folder") }), TWO);
      writeFileSync(join(t.home, "Downloads", "Clip.mov"), "v");
      assert.equal(dropFolderFault(join(t.home, "Downloads"), facts), "the drop folder cannot be Downloads, or inside it, or hold it");
      assert.equal(dropFolderFault(join(desktop, "New"), facts), "");
      t.done();
    });
    it("counts a video still arriving, which the import takes once it has, as the video it will be (L1c, X1)", () => {
      const t = mac();
      const facts = { home: t.home, root: t.root };
      [".part", ".download", ".crdownload", ".tmp"].forEach((ending, i) => {
        assert.equal(isMedia(`Clip.mov${ending}`), false);
        const make = (name, ...files) => {
          mkdirSync(join(t.home, `${name} ${i}`));
          for (const f of files) writeFileSync(join(t.home, `${name} ${i}`, f), "v");
          return join(t.home, `${name} ${i}`);
        };
        assert.equal(dropFolderFault(make("Arriving", `Clip.mov${ending}`), facts), ONE, ending);
        assert.equal(dropFolderFault(make("Both", "Clip.mov", `Clip.mov${ending}`), facts), ONE, ending);
        assert.equal(dropFolderFault(make("Two", `Clip.mov${ending}`, `Talk.m4a${ending}`), facts), TWO, ending);
      });
      mkdirSync(join(t.home, "Safari", "Clip.mov.download"), { recursive: true });
      assert.equal(dropFolderFault(join(t.home, "Safari"), facts), ONE);
      t.done();
    });
    it("refuses a drop folder or an exports folder named with a . or .. part, which node and macOS may take for two folders, and takes a slash at the end (L1c, X1)", () => {
      const t = mac();
      const { home, root } = t;
      mkdirSync(join(home, "In"));
      const facts = { home, root };
      const DOTS = "the drop folder must be named by a whole path with no . or .. in it";
      for (const p of [`${home}/Nowhere/../In`, `${home}/./In`, `${home}/In/.`, `${home}/Desktop/..`]) {
        assert.equal(dropFolderFault(p, facts), DOTS, p);
        assert.equal(dropFolderFault(p, { ...facts, current: p }), DOTS, p);
        assert.equal(dropFolderFault(p, { ...facts, current: join(home, "In") }), DOTS, p);
      }
      for (const p of [`${home}/In/`, join(home, "Desktop", ".Drop"), join(home, "Desktop", "..Drop")]) assert.equal(dropFolderFault(p, facts), "", p);
      assert.equal(exportsFolderFault(`${home}/Nowhere/../Exports`, { home, root, drop: join(home, "In") }), "the exports folder must be named by a whole path with no . or .. in it");
      assert.equal(exportsFolderFault(`${home}/Exports/`, { home, root, drop: join(home, "In") }), "");
      t.done();
    });
    it("does not count, nor read, a folder another Mac has marked, or one the transcript tool lists: install.sh refuses each next, in its own words (L1c, X1)", () => {
      const t = mac();
      const jasons = join(dirname(t.root), "In");
      const listed = join(t.home, "BRIMM Transcripts");
      mkdirSync(jasons, { recursive: true });
      mkdirSync(listed);
      writeFileSync(join(jasons, ".brimm-watched-by"), "Jason's MacBook\n");
      for (const f of ["Talk one.mov", "Talk two.mov"]) writeFileSync(join(jasons, f), "v");
      writeFileSync(join(listed, "Board call.m4a"), "v");
      symlinkSync(listed, join(t.home, "Linked"));
      const facts = { home: t.home, root: t.root, exports: join(t.home, "Downloads"), zoom: join(t.home, "Documents", "Zoom") };
      assert.equal(dropFolderFault(jasons, { ...facts, machine: "Sallie's laptop" }), "");
      assert.equal(dropFolderFault(jasons, { ...facts, machine: "Jason's MacBook" }), TWO);
      assert.equal(dropFolderFault(jasons, facts), TWO);
      writeFileSync(join(jasons, ".brimm-watched-by"), "");
      assert.equal(dropFolderFault(jasons, { ...facts, machine: "Sallie's laptop" }), "");
      for (const transcripts of [[listed], [join(t.home, "Linked")], ...(caseBlind ? [[join(t.home, "brimm transcripts")]] : [])]) assert.equal(dropFolderFault(listed, { ...facts, machine: "Mac Studio", transcripts }), "", transcripts.join());
      for (const transcripts of [[], [t.home], [join(listed, "Sub")]]) assert.equal(dropFolderFault(listed, { ...facts, machine: "Mac Studio", transcripts }), ONE);
      t.done();
    });
    it("refuses a folder it may not read, as one not known to hold no video, but not the folder this Mac watches now (L1c, X1)", { skip: process.getuid?.() === 0 ? "root can read it" : false }, () => {
      const t = mac();
      const shut = join(t.home, "Desktop", "Shut");
      mkdirSync(shut);
      chmodSync(shut, 0o000);
      try {
        assert.equal(dropFolderFault(shut, { home: t.home, root: t.root }), "the drop folder could not be read (EACCES), so what it holds is not known. Make it readable (in System Settings, under Privacy & Security, Files and Folders, allow the app this runs in, if it was refused), then run this again");
        assert.equal(dropFolderFault(shut, { home: t.home, root: t.root, current: shut }), "");
      } finally {
        chmodSync(shut, 0o755);
        t.done();
      }
    });
    it("refuses BRIMM VIDEO Transfer and BRIMM VIDEO MacBook, beside BRIMM Video, and a folder in either, empty and with no launch agent of the transcript tool (L1c, finding 8)", () => {
      const t = mac();
      const db = dirname(t.root);
      mkdirSync(join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), { recursive: true });
      mkdirSync(join(db, "BRIMM VIDEO MacBook"));
      const facts = { home: t.home, root: t.root };
      const cannot = (name) => `the drop folder cannot be ${name}, or inside it, or hold it`;
      const paths = [[join(db, "BRIMM VIDEO Transfer"), "BRIMM VIDEO Transfer"], [join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), "BRIMM VIDEO Transfer"], [join(db, "BRIMM VIDEO Transfer", "New"), "BRIMM VIDEO Transfer"], [join(db, "BRIMM VIDEO MacBook"), "BRIMM VIDEO MacBook"], [join(db, "brimm video macbook", "In"), "BRIMM VIDEO MacBook"], ...(caseBlind ? [[join(db, "brimm video transfer"), "BRIMM VIDEO Transfer"]] : [])];
      for (const [p, name] of paths) assert.equal(dropFolderFault(p, facts), cannot(name), p);
      assert.equal(dropFolderFault(join(db, "In"), facts), "");
      t.done();
    });
    it("takes the real path: a link to Downloads is Downloads", () => {
      const t = mac();
      symlinkSync(join(t.home, "Downloads"), join(t.home, "Desktop", "Get"));
      assert.equal(dropFolderFault(join(t.home, "Desktop", "Get"), { home: t.home, root: t.root, exports: join(t.home, "Downloads"), zoom: join(t.home, "Documents", "Zoom") }), "the drop folder cannot be Downloads, or inside it, or hold it");
      t.done();
    });
  });

  describe("exportsFolderFault (L1c, X2 and finding 8)", () => {
    it("refuses this Mac's drop folder and a folder nested with it; BRIMM Video's four folders, Work, the transcript tool's folders, her chat's and Zoom's, or a folder in one; a drop folder a Mac has marked, or a folder in one; and takes the rest, a cloud folder and BRIMM Video's other folders too", () => {
      const t = mac();
      const { home, root } = t;
      const db = dirname(root);
      const work = join(home, "BRIMM Video Work", "Drop");
      const picked = t.desktop;
      const zoom = join(home, "Documents", "Zoom");
      const listed = join(home, "Transcripts");
      const mark = (folder, text) => { mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, ".brimm-watched-by"), text); };
      mark(join(root, "Drop", "Sallie's laptop"), "Sallie's laptop\n");
      mark(join(root, "Drop", "Mac Studio"), "Mac Studio\n");
      mark(join(db, "In"), "Jason's MacBook\n");
      mark(join(db, "Blank"), "");
      mark(join(db, "Odd"), "a/b\n");
      mark(join(home, "Movies", "Old Drop"), "Mac Studio\n");
      for (const d of [picked, join(root, "Episodes", "x"), join(root, "Unedited Video", "Mac Studio"), join(root, "References"), join(root, "Assets"), join(root, "HyperFrames"), work, join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), join(db, "BRIMM VIDEO MacBook"), listed, join(home, "BRIMM Video Studio", "Pictures"), join(home, "BRIMM Video Workshop")]) mkdirSync(d, { recursive: true });
      symlinkSync(join(root, "Episodes"), join(home, "Desktop", "Episodes link"));
      symlinkSync(join(root, "Drop", "Sallie's laptop"), join(home, "Desktop", "Into hers"));
      const fault = (p, drop = picked) => exportsFolderFault(p, { home, root, drop, zoom, transcripts: [listed] });
      const cannot = (what) => `the exports folder cannot be ${what}, or inside it`;
      const NESTED = "the drop folder cannot be the exports folder, or inside it, or hold it";
      const same = (paths, why) => { for (const p of paths) assert.equal(fault(p), why, p); };
      assert.equal(fault("Exports"), "the exports folder must be a whole path");
      same([picked, join(picked, "in"), join(home, "Desktop"), home], NESTED);
      same([join(root, "Episodes"), join(root, "Episodes", "x"), join(home, "Desktop", "Episodes link"), ...(caseBlind ? [join(root, "episodes")] : [])], cannot("Episodes in BRIMM Video"));
      same([join(root, "References"), join(root, "References", "HF")], cannot("References in BRIMM Video"));
      same([join(root, "Drop"), join(root, "Drop", "Sallie's laptop"), join(root, "Drop", "Mac Studio"), join(root, "Drop", "Exports"), join(home, "Desktop", "Into hers")], cannot("Drop in BRIMM Video"));
      same([join(root, "Unedited Video"), join(root, "Unedited Video", "Mac Studio")], cannot("Unedited Video in BRIMM Video"));
      same([work, join(work, "Exports")], cannot("Drop in BRIMM Video Work"));
      // The coordinator's ruling: Work itself and every folder in it (an episode's video/ among them), and the settings folder.
      same([join(home, "BRIMM Video Work"), join(home, "BRIMM Video Work", "2026-11-06 Talk (Mac Studio)", "video")], cannot("BRIMM Video Work"));
      same([join(home, "Library", "Application Support", "BRIMM Video"), join(home, "Library", "Application Support", "BRIMM Video", "importing")], cannot("Studio's settings folder"));
      same([join(db, "BRIMM VIDEO Transfer"), join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), ...(caseBlind ? [join(db, "brimm video transfer", "HF")] : [])], cannot("BRIMM VIDEO Transfer"));
      same([join(db, "BRIMM VIDEO MacBook"), join(db, "BRIMM VIDEO MacBook", "HF")], cannot("BRIMM VIDEO MacBook"));
      same([listed, join(listed, "HF")], cannot("a folder the transcript tool watches"));
      same([join(home, "BRIMM Video Studio"), join(home, "BRIMM Video Studio", "Pictures")], cannot("BRIMM Video Studio"));
      same([join(home, "BRIMM Video Workshop", "HF")], cannot("BRIMM Video Workshop"));
      same([zoom, join(zoom, "2026-11-06 Call")], cannot("Zoom's recordings"));
      assert.equal(fault(join(db, "In")), marked("Jason's MacBook", join(db, "In")));
      assert.equal(fault(join(db, "In", "Exports")), markedAbove("Jason's MacBook", join(db, "In")));
      assert.equal(fault(join(db, "Blank")), marked("a Mac", join(db, "Blank")));
      assert.equal(fault(join(db, "Odd")), marked("a Mac", join(db, "Odd")));
      assert.equal(fault(join(home, "Movies", "Old Drop")), marked("Mac Studio", join(home, "Movies", "Old Drop")));
      symlinkSync(join(db, "In"), join(home, "Desktop", "To Jason's"));
      assert.equal(fault(join(home, "Desktop", "To Jason's", "HF")), markedAbove("Jason's MacBook", join(db, "In")));
      mkdirSync(join(home, "Library", "Mobile Documents", "com~apple~CloudDocs"), { recursive: true });
      mkdirSync(join(home, "Library", "CloudStorage", "GoogleDrive-X"), { recursive: true });
      mkdirSync(join(db, "Exports"));
      same([join(home, "Downloads"), join(home, "Movies"), join(home, "Documents"), join(home, "Exports", "HF"), join(db, "Exports"), join(db, "BRIMM Video Exports"), db, root, join(root, "Assets"), join(root, "HyperFrames"), join(root, "Exports"), join(home, "Library", "Mobile Documents", "com~apple~CloudDocs", "Exports"), join(home, "Library", "CloudStorage", "GoogleDrive-X", "Exports")], "");
      // A marker in the Downloads folder is never looked for: macOS would ask the app the installer runs in about it.
      writeFileSync(join(home, "Downloads", ".brimm-watched-by"), "Jason's MacBook\n");
      same([join(home, "Downloads"), join(home, "Downloads", "HF")], "");
      assert.equal(fault(join(root, "Drop", "Mac Studio"), join(root, "Drop", "Mac Studio")), NESTED);
      assert.equal(fault(join(root, "Drop"), join(root, "Drop", "Mac Studio")), NESTED);
      assert.equal(fault(root, join(root, "Drop", "Mac Studio")), NESTED);
      assert.equal(fault(join(root, "Drop", "Sallie's laptop"), join(root, "Drop", "Mac Studio")), cannot("Drop in BRIMM Video"));
      assert.equal(fault(join(home, "BRIMM Video Work"), work), NESTED);
      assert.equal(exportsFolderFault(join(zoom, "In"), { home, root, drop: picked }), cannot("Zoom's recordings"));
      assert.equal(exportsFolderFault(listed, { home, root, drop: picked }), "");
      t.done();
    });
  });

  describe("write and plan", () => {
    it("write --drop-folder writes dropPath, and leaves drop as it was", async () => {
      const t = mac({ drop: "Drop" });
      assert.equal(await t.run("write", ...t.told, "--import", "light", "--drop-folder", t.desktop), 0, t.said.join("\n"));
      assert.deepEqual(t.said, [`Written: ${t.file}`]);
      assert.equal(t.read().dropPath, t.desktop);
      assert.equal(t.read().drop, "Drop");
      t.done();
    });
    it("write --exports-folder writes exportsPath, and takes only a whole path", async () => {
      const t = mac();
      assert.equal(await t.run("write", ...t.told, "--exports-folder", join(t.home, "Desktop")), 0);
      assert.equal(t.read().exportsPath, join(t.home, "Desktop"));
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--exports-folder", "Exports"), 1);
      assert.deepEqual(t.said, ['Not written: --exports-folder takes "<whole path>".']);
      t.done();
    });
    it("refuses a drop folder while the Dropbox one holds a video, in the words of heldInOld, and writes nothing", async () => {
      const t = mac({ drop: "Drop" });
      const old = t.folder("Drop");
      writeFileSync(join(old, "Talk.mov"), "video");
      const before = t.held();
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, "--drop-folder", t.desktop), 1, command);
        assert.equal(t.said[0], `Not written: the drop folder would change from Drop to ${t.desktop}, and work is not finished in the old one:`);
        assert.equal(t.said[1], `  A video of 5 bytes: waits in ${old}.`);
        assert.equal(t.held(), before);
      }
      t.done();
    });
    it("takes a drop folder of its own whatever the file says of the import (L1b)", async () => {
      const t = mac({ import: "full" });
      const before = t.held();
      // Phase 2: --import full is refused outright, whatever else is told, and nothing is written.
      assert.equal(await t.run("write", ...t.told, "--import", "full", "--drop-folder", t.desktop), 2);
      assert.deepEqual(t.said, ["The full import is gone: this Mac imports lightly."]);
      assert.equal(t.held(), before);
      t.said.length = 0;
      // A file that still says "full" takes a drop folder of its own, and keeps what it said.
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", t.desktop), 0);
      assert.ok(t.said.includes("The import will be: light"), t.said.join("\n"));
      assert.ok(!t.said.includes("The import will be: full"));
      assert.equal(t.held(), before);
      assert.equal(await t.run("write", ...t.told, "--drop-folder", t.desktop), 0);
      assert.equal(t.read().dropPath, t.desktop);
      assert.equal(t.read().import, "full");
      // show says what the file holds, though plan says the import will be light (the coordinator's ruling, L1b fix 2).
      t.said.length = 0;
      assert.equal(await t.run("show"), 0);
      assert.ok(t.said.includes("  Import:  full"), t.said.join("\n"));
      assert.ok(!t.said.includes("  Import:  light"));
      // A file with no import setting takes one too, and still has none.
      const none = mac();
      const bare = JSON.parse(none.held());
      delete bare.import;
      writeFileSync(none.file, JSON.stringify(bare, null, 2) + "\n");
      assert.equal(await none.run("write", ...none.told, "--drop-folder", none.desktop), 0);
      assert.equal(none.read().dropPath, none.desktop);
      assert.equal(none.read().import, undefined);
      const local = mac({ dropPath: join(t.home, "Desktop", "Drop") });
      assert.equal(await local.run("write", ...local.told, "--import", "full"), 2);
      assert.deepEqual(local.said, ["The full import is gone: this Mac imports lightly."]);
      local.done();
      none.done();
      t.done();
    });
    it("refuses a drop folder the faults refuse, and the two ways of naming one together", async () => {
      const t = mac();
      const before = t.held();
      assert.equal(await t.run("write", ...t.told, "--drop-folder", join(t.home, "Downloads")), 1);
      assert.deepEqual(t.said, ["Not written: the drop folder cannot be Downloads, or inside it, or hold it."]);
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop-folder", t.desktop, "--drop", "Drop"), 1);
      assert.deepEqual(t.said, ["Not written: name the drop folder by --drop-folder or by --drop, not both."]);
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--switch-back"), 1);
      assert.deepEqual(t.said, ['Not written: --switch-back goes with --drop Drop or --drop "Unedited Video".']);
      assert.equal(t.held(), before);
      t.done();
    });
    it("refuses an exports folder that is, is inside or holds the drop folder, whichever drop folder it is, and writes nothing (L1b fix 2)", async () => {
      // The guide and the open tell her to export into the exports folder: one the import watches would take every export as a new video.
      const NOT = ["Not written: the drop folder cannot be the exports folder, or inside it, or hold it."];
      /** plan and write, told `argv` on the Mac `t`, each refused in those words, with the file as it was. */
      const refused = async (t, argv) => {
        const before = t.held();
        for (const command of ["plan", "write"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, ...argv), 1, `${command} ${argv.join(" ")}`);
          assert.deepEqual(t.said, NOT, `${command} ${argv.join(" ")}`);
          assert.equal(t.held(), before, `${command} ${argv.join(" ")}`);
        }
      };
      // Drop/Mac Studio in Dropbox, a folder inside it and the folder that holds it.
      const shapes = (root) => [join(root, "Drop", "Mac Studio"), join(root, "Drop", "Mac Studio", "Exports"), join(root, "Drop")];
      // A Mac on Drop/Mac Studio, told such an exports folder.
      const plain = mac({ drop: "Drop" });
      plain.folder("Drop");
      for (const exports of shapes(plain.root)) await refused(plain, ["--exports-folder", exports]);
      // A Mac on Unedited Video whose exports folder is such a folder, moved onto Drop; and the same told in one write.
      const unedited = mac();
      for (const exports of shapes(unedited.root)) {
        await refused(unedited, ["--drop", "Drop", "--exports-folder", exports]);
        writeSettings(unedited.home, { exportsPath: exports });
        await refused(unedited, ["--drop", "Drop"]);
      }
      // A Mac with a drop folder of its own whose exports folder is such a folder, going back to Drop.
      const local = mac({ drop: "Drop" });
      mkdirSync(local.desktop, { recursive: true });
      for (const exports of shapes(local.root)) {
        writeSettings(local.home, { dropPath: local.desktop, exportsPath: exports });
        await refused(local, ["--drop", "Drop", "--switch-back"]);
      }
      // An exports folder apart from the drop folder is taken, by each of them.
      const apart = join(plain.home, "Movies", "Exports");
      plain.said.length = 0;
      assert.equal(await plain.run("plan", ...plain.told, "--exports-folder", apart), 0, plain.said.join("\n"));
      writeSettings(unedited.home, { exportsPath: join(unedited.home, "Movies", "Exports") });
      unedited.said.length = 0;
      assert.equal(await unedited.run("plan", ...unedited.told, "--drop", "Drop"), 0, unedited.said.join("\n"));
      writeSettings(local.home, { exportsPath: join(local.home, "Movies", "Exports") });
      local.said.length = 0;
      assert.equal(await local.run("plan", ...local.told, "--drop", "Drop", "--switch-back"), 0, local.said.join("\n"));
      for (const t of [plain, unedited, local]) t.done();
    });
    it("on a Mac with a drop folder of its own, --drop is refused without --switch-back, and takes dropPath away with it", async () => {
      const t = mac({ drop: "Drop" });
      mkdirSync(t.desktop, { recursive: true });
      writeSettings(t.home, { dropPath: t.desktop });
      const before = t.held();
      for (const command of ["plan", "write"]) {
        for (const drop of ["Drop", "Unedited Video"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, "--drop", drop), 1, command);
          assert.deepEqual(t.said, [`Not written: this Mac's drop folder is ${t.desktop}, on this Mac. To go back to a drop folder in Dropbox, give --switch-back as well.`]);
          assert.equal(t.held(), before);
        }
      }
      // While the picked folder holds a video, going back is refused.
      writeFileSync(join(t.desktop, "Talk.mov"), "video");
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 1);
      assert.equal(t.said[0], `Not written: the drop folder would change from ${t.desktop} to Drop, and work is not finished in the old one:`);
      assert.equal(t.said[1], `  A video of 5 bytes: waits in ${t.desktop}.`);
      assert.equal(t.held(), before);
      rmSync(join(t.desktop, "Talk.mov"));
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 0, t.said.join("\n"));
      const after = t.read();
      assert.equal(Object.hasOwn(after, "dropPath"), false);
      assert.equal(after.drop, "Drop");
      t.done();
    });
    it("H1 a pending of a kind is not an import's: a switch back from the picked folder is not refused for it (L5)", async () => {
      const t = mac({ drop: "Drop" });
      mkdirSync(t.desktop, { recursive: true });
      writeSettings(t.home, { dropPath: t.desktop });
      for (const kind of ["record", "final", "original"]) {
        const dir = join(pendingFolder(t.home), kind);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, kind === "final" ? "e-20261106-ab0001-1.json" : "e-20261106-ab0001.json"), JSON.stringify({ version: 1, kind, id: "e-20261106-ab0001", name: "x", folder: "/x", root: t.root, machine: "Mac Studio", revision: 1, rev: 2, entries: [], took: [], work: null, lastCopy: 1, video: "Talk.mov", bytes: 5 }));
      }
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, "--drop", "Drop", "--switch-back"), 0, t.said.join("\n"));
      // The same pendings name a failed import's video, and still say nothing: only the import's own pending is read there.
      writeFileSync(join(t.desktop, "Talk.mov"), "video");
      const own = importingFolderOf({ root: t.root, dropPath: t.desktop }, t.home);
      mkdirSync(own, { recursive: true });
      writeFileSync(join(own, "Talk.mov (Mac Studio) 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, video: "Talk.mov", bytes: 5, seconds: 120, step: "Filing", at: AT.toISOString(), failed: "it could not be filed into Episodes" }));
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 1);
      assert.deepEqual(t.said.slice(0, 3), [`Not written: the drop folder would change from ${t.desktop} to Drop, and work is not finished in the old one:`, "  1 import failed, and its video is still in the old folder.", "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again."]);
      rmSync(join(t.desktop, "Talk.mov"));
      rmSync(join(own, "Talk.mov (Mac Studio) 1.json"));
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 0, t.said.join("\n"));
      t.done();
    });
    it("a switch back from a picked folder reads the local status folder: a failed import there is refused in the words of the old folder's work, and nothing is written (Phase 3, L3)", async () => {
      const t = mac({ drop: "Drop" });
      mkdirSync(t.desktop, { recursive: true });
      writeSettings(t.home, { dropPath: t.desktop });
      writeFileSync(join(t.desktop, "Talk.mov"), "video");
      const own = importingFolderOf({ root: t.root, dropPath: t.desktop }, t.home);
      mkdirSync(own, { recursive: true });
      writeFileSync(join(own, "Talk.mov (Mac Studio) 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, video: "Talk.mov", bytes: 5, seconds: 120, step: "Filing", at: AT.toISOString(), failed: "it could not be filed into Episodes" }));
      const before = t.held();
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 1);
      assert.deepEqual(t.said.slice(0, 3), [`Not written: the drop folder would change from ${t.desktop} to Drop, and work is not finished in the old one:`, "  1 import failed, and its video is still in the old folder.", "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again."]);
      assert.equal(t.held(), before);
      // With the video gone, only its status file in the local folder holds the failed import, and the line says where.
      rmSync(join(t.desktop, "Talk.mov"));
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--drop", "Drop", "--switch-back"), 1);
      assert.equal(t.said[1], `  1 import failed, and its video is not in the old folder now: only its status file, in ${own}, holds this, and a person takes it away by hand.`);
      assert.equal(t.held(), before);
      t.done();
    });
    it("leaves a run with no drop option on a Mac with a drop folder of its own as it is, whatever the folder holds", async () => {
      const t = mac();
      mkdirSync(t.desktop, { recursive: true });
      writeSettings(t.home, { dropPath: t.desktop });
      writeFileSync(join(t.desktop, "Talk.mov"), "video");
      assert.equal(await t.run("write", ...t.told), 0, t.said.join("\n"));
      assert.equal(t.read().dropPath, t.desktop);
      t.done();
    });
    it("plan says its lines after the JSON, in order, each optional line only when it applies", async () => {
      const t = mac({ drop: "Drop" });
      const old = t.folder("Drop");
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", t.desktop), 0, t.said.join("\n"));
      assert.equal(JSON.parse(t.said[0]).dropPath, t.desktop);
      assert.deepEqual(t.said.slice(1), [
        "The import will be: light", "The drop folder is now: Drop", `The drop folder will be: ${t.desktop}`, `The exports folder will be: ${t.home}/Downloads`,
        "The drop folder is in a cloud folder: iCloud Drive, if it keeps Desktop & Documents", "The drop folder needs Files and Folders access", `The old drop folder: ${old}`
      ]);
      // A drop folder in no cloud folder, not under Desktop or Documents: no cloud line and no access line.
      t.said.length = 0;
      const work = join(t.home, "BRIMM Video Work", "Drop");
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", work, "--exports-folder", join(t.home, "Desktop")), 0, t.said.join("\n"));
      assert.deepEqual(t.said.slice(1), ["The import will be: light", "The drop folder is now: Drop", `The drop folder will be: ${work}`, `The exports folder will be: ${t.home}/Desktop`, `The old drop folder: ${old}`]);
      // A Mac not switched says the four.
      const plain = mac();
      assert.equal(await plain.run("plan", ...plain.told), 0);
      assert.deepEqual(plain.said.slice(1), ["The import will be: light", "The drop folder is now: Unedited Video", "The drop folder will be: Unedited Video", `The exports folder will be: ${plain.home}/Downloads`]);
      plain.done();
      t.done();
    });
    it("names a waiting video by what it is and its size, never by its file, on a switch to or from a drop folder of its own, whatever the file says of the import (L1b fix 2)", async () => {
      // Every import is light: a video waiting in the old folder may be a session, and its file's name a client's.
      for (const setting of ["full", undefined, "light"]) {
        const t = mac({ drop: "Drop", import: setting });
        if (setting === undefined) {
          const bare = JSON.parse(t.held());
          delete bare.import;
          writeFileSync(t.file, JSON.stringify(bare, null, 2) + "\n");
        }
        const old = t.folder("Drop");
        writeFileSync(join(old, "Jane Doe coaching session.mp4"), "video");
        const before = t.held();
        for (const command of ["plan", "write"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, "--drop-folder", t.desktop), 1, `${command} ${setting}`);
          assert.equal(t.said[0], `Not written: the drop folder would change from Drop to ${t.desktop}, and work is not finished in the old one:`);
          assert.equal(t.said[1], `  A video of 5 bytes: waits in ${old}.`, `${command} ${setting}`);
          assert.ok(!t.said.some((line) => /jane|coaching/i.test(line)), t.said.join("\n"));
          assert.equal(t.held(), before);
        }
        // And back: a Mac with a drop folder of its own going back to Dropbox, while a video waits in its own folder.
        rmSync(join(old, "Jane Doe coaching session.mp4"));
        mkdirSync(t.desktop, { recursive: true });
        writeSettings(t.home, { dropPath: t.desktop });
        writeFileSync(join(t.desktop, "Jane Doe coaching session.mp4"), "video");
        const local = t.held();
        for (const command of ["plan", "write"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, "--drop", "Drop", "--switch-back"), 1, `${command} ${setting} back`);
          assert.equal(t.said[1], `  A video of 5 bytes: waits in ${t.desktop}.`, `${command} ${setting} back`);
          assert.ok(!t.said.some((line) => /jane|coaching/i.test(line)), t.said.join("\n"));
          assert.equal(t.held(), local);
        }
        t.done();
      }
    });
    it("plan names a drop folder in Dropbox, and says macOS may ask whether node may read it (L1c, X3)", async () => {
      const t = mac();
      const dropbox = join(t.home, "Library", "CloudStorage", "Dropbox-X", "The BRIMM DB", "In");
      mkdirSync(dirname(dropbox), { recursive: true });
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", dropbox), 0, t.said.join("\n"));
      assert.ok(t.said.includes("The drop folder is in a cloud folder: Dropbox"), t.said.join("\n"));
      assert.ok(t.said.includes("The drop folder needs Files and Folders access"), t.said.join("\n"));
      t.done();
    });
    it("plan says a drop folder in iCloud Drive or in a folder in ~/Library/CloudStorage needs Files and Folders access, right after its cloud line (L1c, X3)", async () => {
      const t = mac();
      const lib = join(t.home, "Library");
      for (const [path, name] of [[join(lib, "CloudStorage", "GoogleDrive-X", "My Drive", "Drop"), "a cloud folder"], [join(lib, "CloudStorage", "OneDrive-Personal", "Drop"), "a cloud folder"], [join(lib, "CloudStorage", "Dropbox-X", "The BRIMM DB", "In"), "Dropbox"], [join(lib, "Mobile Documents", "com~apple~CloudDocs", "Drop"), "iCloud Drive"]]) {
        mkdirSync(dirname(path), { recursive: true });
        t.said.length = 0;
        assert.equal(await t.run("plan", ...t.told, "--drop-folder", path), 0, t.said.join("\n"));
        const at = t.said.indexOf(`The drop folder is in a cloud folder: ${name}`);
        assert.ok(at > 0, t.said.join("\n"));
        assert.equal(t.said[at + 1], "The drop folder needs Files and Folders access");
      }
      t.done();
    });
    it("refuses a picked folder that holds a video already, in plan and in write, and writes nothing; with its videos out it is taken (L1c, X1)", async () => {
      const t = mac({ drop: "Drop" });
      const desktop = join(t.home, "Desktop");
      mkdirSync(join(t.home, "Music"));
      for (const f of ["Family birthday.mov", "voice memo.m4a", "notes.txt"]) writeFileSync(join(desktop, f), "x");
      writeFileSync(join(t.home, "Music", "Song.mp3"), "x");
      const before = t.held();
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, "--drop-folder", desktop), 1, command);
        assert.deepEqual(t.said, [`Not written: ${TWO}.`]);
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, "--drop-folder", join(t.home, "Music")), 1, command);
        assert.deepEqual(t.said, [`Not written: ${ONE}.`]);
        assert.equal(t.held(), before);
      }
      assert.deepEqual(readdirSync(desktop).sort(), ["Family birthday.mov", "notes.txt", "voice memo.m4a"]);
      rmSync(join(desktop, "Family birthday.mov"));
      rmSync(join(desktop, "voice memo.m4a"));
      assert.equal(await t.run("write", ...t.told, "--drop-folder", desktop), 0, t.said.join("\n"));
      assert.equal(t.read().dropPath, desktop);
      t.done();
    });
    it("takes again the folder this Mac watches now while a video waits in it: named again, through a link, or kept while only the exports folder changes, by plan, write and set (L1c, X1)", async () => {
      for (const where of [["Desktop", "Drop"], ["BRIMM Video Work", "Drop"]]) {
        const t = mac();
        const own = join(t.home, ...where);
        mkdirSync(own, { recursive: true });
        writeFileSync(join(own, "Talk.mov"), "v");
        writeSettings(t.home, { dropPath: own });
        symlinkSync(own, join(t.home, "Linked"));
        for (const argv of [["--drop-folder", own], ["--drop-folder", join(t.home, "Linked")], ["--exports-folder", join(t.home, "Exports")], ["--drop-folder", own, "--exports-folder", join(t.home, "Exports")]]) {
          for (const command of ["plan", "write"]) {
            t.said.length = 0;
            assert.equal(await t.run(command, ...t.told, ...argv), 0, `${command} ${argv.join(" ")}: ${t.said.join("\n")}`);
          }
        }
        assert.equal(t.read().dropPath, own);
        assert.equal(t.read().exportsPath, join(t.home, "Exports"));
        t.said.length = 0;
        assert.equal(await t.run("set", "--exports-folder", join(t.home, "Exports 2")), 0, t.said.join("\n"));
        assert.deepEqual(readdirSync(own), ["Talk.mov"]);
        t.done();
      }
    });
    it("takes each MacBook's move: Sallie's laptop from Drop › Sallie's laptop with the transcript tool turned off, Jason's MacBook set up fresh, and a Mac that keeps its drop folder in Dropbox, each with an exports folder in Dropbox (L1c)", async () => {
      const told = (t, machine) => ["--machine", machine, "--root", t.root, "--checkout", CHECKOUT, "--import", "light", "--handoff", "2"];
      const shared = (t) => { const d = join(dirname(t.root), "HyperFrames exports"); mkdirSync(d, { recursive: true }); return d; };
      const t = mac({ machine: "Sallie's laptop", drop: "Drop", handoffVersion: 2 }, { transcripts: ({ root }) => ({ ".plist.off": [join(dirname(root), "BRIMM VIDEO Transfer")] }) });
      const hers = t.folder("Drop", "Sallie's laptop");
      writeFileSync(join(hers, ".brimm-watched-by"), "Sallie's laptop\n");
      writeFileSync(join(hers, ".DS_Store"), "x");
      mkdirSync(join(dirname(t.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer"), { recursive: true });
      for (const exports of [shared(t), join(t.home, "Downloads")]) {
        for (const command of ["plan", "write"]) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...told(t, "Sallie's laptop"), "--drop-folder", join(t.home, "BRIMM Video Work", "Drop"), "--exports-folder", exports), 0, `${command}: ${t.said.join("\n")}`);
        }
        assert.equal(t.read().dropPath, join(t.home, "BRIMM Video Work", "Drop"));
        assert.equal(t.read().exportsPath, exports);
        writeSettings(t.home, { drop: "Drop" }, ["dropPath"]);
      }
      assert.deepEqual(readdirSync(shared(t)), []);
      t.done();
      const j = mac({}, { transcripts: ({ root }) => ({ ".plist": [join(dirname(root), "BRIMM VIDEO MacBook")] }) });
      mkdirSync(join(dirname(j.root), "BRIMM VIDEO MacBook"), { recursive: true });
      rmSync(j.file);
      assert.equal(await j.run("write", ...told(j, "Jason's MacBook"), "--drop-folder", j.desktop, "--exports-folder", shared(j)), 0, j.said.join("\n"));
      assert.equal(j.read().machine, "Jason's MacBook");
      assert.equal(j.read().dropPath, j.desktop);
      j.done();
      const k = mac({ machine: "Sallie's laptop", drop: "Drop" });
      writeFileSync(join(k.folder("Drop", "Sallie's laptop"), ".brimm-watched-by"), "Sallie's laptop\n");
      assert.equal(await k.run("write", ...told(k, "Sallie's laptop"), "--drop", "Drop", "--exports-folder", shared(k)), 0, k.said.join("\n"));
      assert.equal(k.read().exportsPath, shared(k));
      k.done();
    });
    it("takes again the folder this Mac watches now named in other letter case, on a disk whose names are not case-sensitive, and names no old folder (L1c)", { skip: caseBlind ? false : "the test's disk tells letter case apart" }, async () => {
      const t = mac();
      const own = join(t.home, "Desktop", "Drop");
      mkdirSync(own, { recursive: true });
      writeFileSync(join(own, "Talk.mov"), "v");
      writeSettings(t.home, { dropPath: own });
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", join(t.home, "desktop", "drop")), 0, t.said.join("\n"));
      assert.ok(!t.said.some((l) => l.startsWith("The old drop folder:")), t.said.join("\n"));
      assert.equal(await t.run("write", ...t.told, "--drop-folder", join(t.home, "desktop", "drop")), 0, t.said.join("\n"));
      assert.deepEqual(readdirSync(own), ["Talk.mov"]);
      t.done();
    });
    it("asks no real path of ~/Documents/Zoom when the exports folder is Downloads or in Dropbox, which macOS could answer with a question about Documents (L1c)", async () => {
      const t = mac({ drop: "Drop" });
      t.folder("Drop");
      const zoom = join(t.home, "Documents", "Zoom");
      const dropbox = join(dirname(t.root), "HyperFrames exports");
      mkdirSync(dropbox, { recursive: true });
      for (const argv of [[], ["--exports-folder", dropbox]]) {
        const { result, calls } = await watched(() => t.run("plan", ...t.told, ...argv), { names: ["existsSync", "statSync", "lstatSync", "readdirSync", "readFileSync", "realpathSync"] });
        assert.equal(result, 0, t.said.join("\n"));
        assert.deepEqual(calls.filter(({ path }) => path === zoom || path.startsWith(`${zoom}/`)), [], argv.join(" "));
      }
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, "--exports-folder", join(zoom, "Call")), 1);
      assert.deepEqual(t.said, ["Not written: the exports folder cannot be Zoom's recordings, or inside it."]);
      t.done();
    });
    it("takes the Mac Studio's switch at P3-3: Drop in BRIMM Video Work, made or not, with Downloads, a link into Dropbox, as the exports folder, while the transcript tool watches BRIMM VIDEO Transfer (L1c)", async () => {
      for (const made of [false, true]) {
        const t = mac({ drop: "Drop", handoffVersion: 2 }, { transcripts: ({ root }) => ({ ".plist": [join(dirname(root), "BRIMM VIDEO Transfer"), join(dirname(root), "BRIMM VIDEO Transfer", "Zoom Video Transfer")] }) });
        const old = t.folder("Drop");
        writeFileSync(join(old, ".brimm-watched-by"), "Mac Studio\n");
        writeFileSync(join(old, ".DS_Store"), "x");
        mkdirSync(join(dirname(t.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer"), { recursive: true });
        mkdirSync(join(t.home, "BRIMM Video Studio"));
        const dropbox = join(t.home, "Library", "CloudStorage", "Dropbox-X", "Downloads");
        mkdirSync(dropbox, { recursive: true });
        rmSync(join(t.home, "Downloads"), { recursive: true });
        symlinkSync(dropbox, join(t.home, "Downloads"));
        const target = join(t.home, "BRIMM Video Work", "Drop");
        if (made) { mkdirSync(target); writeFileSync(join(target, ".DS_Store"), "x"); }
        const argv = [...t.told, "--drop-folder", target, "--exports-folder", join(t.home, "Downloads"), "--import", "light", "--handoff", "2"];
        assert.equal(await t.run("plan", ...argv), 0, t.said.join("\n"));
        assert.deepEqual(t.said.slice(t.said.findIndex((l) => l.startsWith("The import will be"))), ["The import will be: light", "The drop folder is now: Drop", `The drop folder will be: ${target}`, `The exports folder will be: ${join(t.home, "Downloads")}`, `The old drop folder: ${old}`]);
        assert.equal(await t.run("write", ...argv), 0, t.said.join("\n"));
        assert.equal(t.read().dropPath, target);
        assert.equal(t.read().exportsPath, join(t.home, "Downloads"));
        t.said.length = 0;
        assert.equal(await t.run("write", ...t.told), 0, t.said.join("\n"));
        t.done();
      }
    });
    it("refuses in plan and write an exports folder exportsFolderFault refuses, on every path: told alone on a Mac whose drop folder is in Dropbox, with --drop, beside a picked drop folder, and kept under --switch-back (L1c, X2 and finding 8)", async () => {
      const t = mac({ drop: "Drop" }, { transcripts: ({ home }) => ({ ".plist.off": [join(home, "BRIMM Transcripts")] }) });
      const { home, root } = t;
      const db = dirname(root);
      const own = t.folder("Drop");
      writeFileSync(join(own, ".brimm-watched-by"), "Mac Studio\n");
      const hers = t.folder("Drop", "Sallie's laptop");
      writeFileSync(join(hers, ".brimm-watched-by"), "Sallie's laptop\n");
      const jasons = join(db, "In");
      mkdirSync(jasons);
      writeFileSync(join(jasons, ".brimm-watched-by"), "Jason's MacBook\n");
      for (const d of [join(root, "Episodes"), join(root, "References"), join(db, "BRIMM VIDEO Transfer"), join(db, "BRIMM VIDEO MacBook"), join(home, "BRIMM Transcripts", "HF"), join(home, "BRIMM Video Studio"), join(home, "BRIMM Video Workshop"), join(home, "BRIMM Video Work", "Drop")]) mkdirSync(d, { recursive: true });
      const cannot = (what) => `the exports folder cannot be ${what}, or inside it`;
      const before = t.held();
      const NESTED = "the drop folder cannot be the exports folder, or inside it, or hold it";
      const cases = [
        [["--exports-folder", own], NESTED], [["--drop", "Drop", "--exports-folder", join(own, "Exports")], NESTED], [["--exports-folder", hers], cannot("Drop in BRIMM Video")],
        [["--exports-folder", join(root, "Episodes")], cannot("Episodes in BRIMM Video")], [["--exports-folder", join(root, "References")], cannot("References in BRIMM Video")],
        [["--drop-folder", t.desktop, "--exports-folder", join(home, "BRIMM Video Work", "Drop")], cannot("Drop in BRIMM Video Work")],
        [["--exports-folder", join(home, "BRIMM Video Work")], cannot("BRIMM Video Work")],
        [["--exports-folder", join(db, "BRIMM VIDEO Transfer")], cannot("BRIMM VIDEO Transfer")], [["--exports-folder", join(db, "BRIMM VIDEO MacBook")], cannot("BRIMM VIDEO MacBook")],
        [["--exports-folder", join(home, "BRIMM Transcripts", "HF")], cannot("a folder the transcript tool watches")],
        [["--exports-folder", join(home, "BRIMM Video Studio")], cannot("BRIMM Video Studio")], [["--exports-folder", join(home, "BRIMM Video Workshop")], cannot("BRIMM Video Workshop")], [["--exports-folder", join(home, "Documents", "Zoom")], cannot("Zoom's recordings")],
        [["--drop-folder", t.desktop, "--exports-folder", jasons], marked("Jason's MacBook", jasons)], [["--drop-folder", join(home, "BRIMM Video Work", "Drop"), "--exports-folder", join(jasons, "HF")], markedAbove("Jason's MacBook", jasons)]
      ];
      for (const command of ["plan", "write"]) {
        for (const [argv, why] of cases) {
          t.said.length = 0;
          assert.equal(await t.run(command, ...t.told, ...argv), 1, `${command} ${argv.join(" ")}`);
          assert.deepEqual(t.said, [`Not written: ${why}.`], `${command} ${argv.join(" ")}`);
          assert.equal(t.held(), before);
        }
      }
      const local = mac({ drop: "Drop" });
      mkdirSync(local.desktop, { recursive: true });
      writeSettings(local.home, { dropPath: local.desktop, exportsPath: local.root });
      local.said.length = 0;
      assert.equal(await local.run("plan", ...local.told), 0, local.said.join("\n"));
      const kept = local.held();
      for (const command of ["plan", "write"]) {
        local.said.length = 0;
        assert.equal(await local.run(command, ...local.told, "--drop", "Drop", "--switch-back"), 1);
        assert.deepEqual(local.said, [`Not written: ${NESTED}.`]);
        assert.equal(local.held(), kept);
      }
      assert.equal(await local.run("write", ...local.told, "--drop", "Drop", "--switch-back", "--exports-folder", join(local.home, "Downloads")), 0, local.said.join("\n"));
      assert.equal(local.read().dropPath, undefined);
      assert.equal(local.read().exportsPath, join(local.home, "Downloads"));
      local.done();
      t.done();
    });
    it("refuses in plan and write, with nothing new told, an exports folder kept from before that a Mac has marked since, or that the transcript tool lists, and Downloads by the same rules when none is kept, and names the folder it refuses; another told with it mends it (L1c, X2 and finding 8)", async () => {
      const t = mac({ drop: "Drop" });
      const db = dirname(t.root);
      const shared = join(db, "Shared");
      mkdirSync(shared);
      writeSettings(t.home, { exportsPath: shared });
      assert.equal(await t.run("write", ...t.told), 0, t.said.join("\n"));
      writeFileSync(join(shared, ".brimm-watched-by"), "Jason's MacBook\n");
      const kept = t.held();
      const kind = `The exports folder is ${shared}, kept from before: name another with --exports-folder.`;
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told), 1, command);
        assert.deepEqual(t.said, [`Not written: ${marked("Jason's MacBook", shared)}.`, kind]);
        assert.equal(t.held(), kept);
      }
      t.said.length = 0;
      assert.equal(await t.run("plan", ...t.told, "--exports-folder", shared), 1);
      assert.deepEqual(t.said, [`Not written: ${marked("Jason's MacBook", shared)}.`]);
      t.said.length = 0;
      assert.equal(await t.run("write", ...t.told, "--exports-folder", join(t.home, "Downloads")), 0, t.said.join("\n"));
      t.done();
      for (const ending of [".plist", ".plist.off"]) {
        const u = mac({ drop: "Drop" }, { transcripts: ({ home }) => ({ [ending]: [join(home, "Exports")] }) });
        mkdirSync(join(u.home, "Exports"));
        writeSettings(u.home, { exportsPath: join(u.home, "Exports") });
        assert.equal(await u.run("plan", ...u.told), 1, ending);
        assert.deepEqual(u.said, ["Not written: the exports folder cannot be a folder the transcript tool watches, or inside it.", `The exports folder is ${u.home}/Exports, kept from before: name another with --exports-folder.`]);
        u.done();
      }
      const d = mac({ drop: "Drop" });
      const jasons = join(dirname(d.root), "In");
      mkdirSync(jasons);
      writeFileSync(join(jasons, ".brimm-watched-by"), "Jason's MacBook\n");
      rmSync(join(d.home, "Downloads"), { recursive: true });
      symlinkSync(jasons, join(d.home, "Downloads"));
      assert.equal(await d.run("plan", ...d.told), 1);
      assert.deepEqual(d.said, [`Not written: ${marked("Jason's MacBook", jasons)}.`, `The exports folder is ${d.home}/Downloads, as none is set: name another with --exports-folder.`]);
      d.done();
    });
    it("looks inside Downloads at nothing, in plan and write, when it is the exports folder: macOS would ask the app the installer runs in about it (L1c, X2)", async () => {
      const t = mac({ drop: "Drop" });
      t.folder("Drop");
      const dl = join(t.home, "Downloads");
      writeFileSync(join(dl, "Clip.mov"), "v");
      const NAMES = ["existsSync", "statSync", "lstatSync", "readdirSync", "readFileSync", "realpathSync"];
      for (const [command, argv] of [["plan", t.told], ["write", t.told], ["plan", [...t.told, "--drop-folder", t.desktop]], ["write", [...t.told, "--drop-folder", join(t.home, "BRIMM Video Work", "Drop")]]]) {
        const { result, calls } = await watched(() => t.run(command, ...argv), { names: NAMES });
        assert.equal(result, 0, `${command}: ${t.said.join("\n")}`);
        assert.deepEqual(calls.filter(({ name, path }) => path.startsWith(`${dl}/`) || (name === "readdirSync" && path === dl)), [], command);
      }
      t.done();
    });
    it("refuses in plan, write and set a drop folder or an exports folder named with a . or .. part, and writes nothing (L1c, X1)", async () => {
      const t = mac({ drop: "Drop" });
      mkdirSync(join(t.home, "In"));
      const before = t.held();
      for (const command of ["plan", "write"]) {
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, "--drop-folder", `${t.home}/Nowhere/../In`), 1);
        assert.deepEqual(t.said, ["Not written: the drop folder must be named by a whole path with no . or .. in it."]);
        t.said.length = 0;
        assert.equal(await t.run(command, ...t.told, "--exports-folder", `${t.home}/Nowhere/../Exports`), 1);
        assert.deepEqual(t.said, ["Not written: the exports folder must be named by a whole path with no . or .. in it."]);
        assert.equal(t.held(), before);
      }
      t.said.length = 0;
      assert.equal(await t.run("set", "--exports-folder", `${t.home}/x/../Exports`), 1);
      assert.deepEqual(t.said, ["Not changed: the exports folder must be named by a whole path with no . or .. in it."]);
      assert.equal(t.held(), before);
      assert.equal(await t.run("plan", ...t.told, "--drop-folder", `${t.home}/In/`), 0);
      t.done();
    });
  });

  describe("set, show and mark", () => {
    it("show says the drop folder as a path alone, and where the exports are looked for", async () => {
      const t = mac();
      writeSettings(t.home, { dropPath: t.desktop });
      t.said.length = 0;
      assert.equal(await t.run("show"), 0);
      assert.ok(t.said.includes(`  Its drop folder:  ${t.home}/Desktop/Drop`), t.said.join("\n"));
      assert.ok(t.said.includes(`  Exports from HyperFrames, looked for in:  ${t.home}/Downloads`));
      writeSettings(t.home, { exportsPath: join(t.home, "Desktop") });
      t.said.length = 0;
      await t.run("show");
      assert.ok(t.said.includes(`  Exports from HyperFrames, looked for in:  ${t.home}/Desktop`));
      const plain = mac({ drop: "Drop" });
      await plain.run("show");
      assert.ok(plain.said.includes(`  Its drop folder:  ${plain.root}/Drop/Mac Studio`));
      plain.done();
      t.done();
    });
    it("set refuses --drop-folder on every Mac, and --drop on one with a drop folder of its own, with the installer's line and nothing written", async () => {
      for (const local of [false, true]) {
        const t = mac();
        if (local) writeSettings(t.home, { dropPath: t.desktop });
        const before = t.held();
        for (const argv of [["--drop-folder", t.desktop], ...(local ? [["--drop", "Drop"]] : [])]) {
          t.said.length = 0;
          assert.equal(await t.run("set", ...argv), 1, argv.join(" "));
          assert.equal(t.said.length, 1);
          assert.match(t.said[0], /^The drop folder is switched by the installer, which makes the new folder, marks it and points the import at it, after it has checked the old one\. To see what it would do: \.\/install\.sh --print --machine "Mac Studio" /);
          assert.equal(t.held(), before);
        }
        t.done();
      }
    });
    it("set --exports-folder refuses a folder that is, holds or is inside the drop folder, on a Mac with its own and on one without, and writes nothing", async () => {
      const own = mac();
      mkdirSync(own.desktop, { recursive: true });
      writeSettings(own.home, { dropPath: own.desktop });
      const plain = mac({ drop: "Drop" });
      const dropbox = plain.folder("Drop");
      for (const [t, drop] of [[own, own.desktop], [plain, dropbox]]) {
        mkdirSync(join(drop, "in"), { recursive: true });
        const before = t.held();
        for (const path of [drop, join(drop, "in"), dirname(drop)]) {
          t.said.length = 0;
          assert.equal(await t.run("set", "--exports-folder", path), 1, path);
          assert.deepEqual(t.said, ["Not changed: the drop folder cannot be the exports folder, or inside it, or hold it."], path);
          assert.equal(t.held(), before);
        }
        t.said.length = 0;
        assert.equal(await t.run("set", "--exports-folder", join(t.home, "Exports")), 0, t.said.join("\n"));
        t.done();
      }
    });
    it("set --exports-folder refuses what exportsFolderFault refuses, on a Mac with its own drop folder and on one without, and writes nothing (L1c, X2 and finding 8)", async () => {
      const own = mac({}, { transcripts: ({ home }) => ({ ".plist.off": [join(home, "BRIMM Transcripts")] }) });
      mkdirSync(own.desktop, { recursive: true });
      writeFileSync(join(own.desktop, "Talk.mov"), "v");
      writeSettings(own.home, { dropPath: own.desktop });
      const plain = mac({ drop: "Drop" }, { transcripts: ({ home }) => ({ ".plist": [join(home, "BRIMM Transcripts")] }) });
      for (const t of [own, plain]) {
        const db = dirname(t.root);
        const hers = t.folder("Drop", "Sallie's laptop");
        writeFileSync(join(hers, ".brimm-watched-by"), "Sallie's laptop\n");
        mkdirSync(join(db, "In"), { recursive: true });
        writeFileSync(join(db, "In", ".brimm-watched-by"), "Jason's MacBook\n");
        for (const d of [join(t.root, "Episodes", "x"), join(t.root, "References"), join(t.root, "Unedited Video"), join(t.home, "BRIMM Video Work", "Drop"), join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), join(db, "BRIMM VIDEO MacBook"), join(t.home, "BRIMM Transcripts"), join(t.home, "BRIMM Video Studio"), join(t.home, "BRIMM Video Workshop")]) mkdirSync(d, { recursive: true });
        const cannot = (what) => `the exports folder cannot be ${what}, or inside it`;
        const before = t.held();
        for (const [path, why] of [
          [hers, cannot("Drop in BRIMM Video")], [join(t.root, "Episodes", "x"), cannot("Episodes in BRIMM Video")], [join(t.root, "References"), cannot("References in BRIMM Video")], [join(t.root, "Unedited Video"), cannot("Unedited Video in BRIMM Video")],
          [join(t.home, "BRIMM Video Work", "Drop"), cannot("Drop in BRIMM Video Work")], [join(t.home, "BRIMM Video Work"), cannot("BRIMM Video Work")], [join(t.home, "Library", "Application Support", "BRIMM Video"), cannot("Studio's settings folder")],
          [join(db, "BRIMM VIDEO Transfer", "Zoom Video Transfer"), cannot("BRIMM VIDEO Transfer")], [join(db, "BRIMM VIDEO MacBook"), cannot("BRIMM VIDEO MacBook")], [join(t.home, "BRIMM Transcripts"), cannot("a folder the transcript tool watches")],
          [join(t.home, "BRIMM Video Studio"), cannot("BRIMM Video Studio")], [join(t.home, "BRIMM Video Workshop"), cannot("BRIMM Video Workshop")], [join(t.home, "Documents", "Zoom"), cannot("Zoom's recordings")], [join(db, "In"), marked("Jason's MacBook", join(db, "In"))]
        ]) {
          t.said.length = 0;
          assert.equal(await t.run("set", "--exports-folder", path), 1, path);
          assert.deepEqual(t.said, [`Not changed: ${why}.`], path);
          assert.equal(t.held(), before);
        }
        t.said.length = 0;
        assert.equal(await t.run("set", "--exports-folder", join(db, "Exports")), 0, t.said.join("\n"));
        assert.equal(t.read().exportsPath, join(db, "Exports"));
      }
      assert.deepEqual(readdirSync(own.desktop), ["Talk.mov"]);
      own.done();
      plain.done();
    });
    it("set --exports-folder writes exportsPath", async () => {
      const t = mac();
      assert.equal(await t.run("set", "--exports-folder", join(t.home, "Desktop")), 0, t.said.join("\n"));
      assert.deepEqual(t.said, [`The exports folder is now ${t.home}/Desktop (it was Downloads).`, `Written: ${t.file}`]);
      assert.equal(t.read().exportsPath, join(t.home, "Desktop"));
      t.said.length = 0;
      assert.equal(await t.run("set", "--exports-folder", "Exports"), 1);
      assert.deepEqual(t.said, ['Not changed: --exports-folder takes "<whole path>".']);
      t.done();
    });
    it("marks a folder in a cloud folder by the rule, and any other plainly, whole and then renamed", async () => {
      const t = mac();
      const other = join(t.home, "BRIMM Video Work", "Drop");
      const cloud = join(t.home, "Library", "CloudStorage", "Dropbox-X", "In");
      mkdirSync(other, { recursive: true });
      mkdirSync(cloud, { recursive: true });
      assert.equal(await t.run("marker", other, "Mac Studio"), 0);
      assert.deepEqual([t.clones, readFileSync(join(other, ".brimm-watched-by"), "utf8"), readdirSync(other)], [[], "Mac Studio\n", [".brimm-watched-by"]]);
      assert.equal(await t.run("marker", other, "Mac Studio"), 0);
      assert.deepEqual(t.clones, []);
      assert.equal(await t.run("marker", cloud, "Mac Studio"), 0);
      assert.deepEqual(t.clones, [join(cloud, ".brimm-watched-by")]);
      // Another Mac's marker is still refused.
      writeFileSync(join(other, ".brimm-watched-by"), "Sallie's laptop\n");
      t.said.length = 0;
      assert.equal(await t.run("marker", other, "Mac Studio"), 1);
      assert.match(t.said[0], new RegExp(escaped("watched by Sallie's laptop already")));
      t.done();
    });
    it("gives the facts of a Mac its drop folder, for the gated places", () => {
      const s = { version: 1, machine: "Mac Studio", root: "/r", checkout: "/c", import: "light", dropPath: "/Users/s/Desktop/Drop" };
      assert.equal(factsOf("/Users/s", s, { tmp: "/tmp", uid: 1 }).dropFolder, "/Users/s/Desktop/Drop");
      assert.equal(factsOf("/Users/s", { ...s, dropPath: undefined }, { tmp: "/tmp", uid: 1 }).dropFolder, "/r/Unedited Video/Mac Studio");
    });
  });
});

describe("the full import is gone (Phase 2, F4)", () => {
  it("set --import full prints that the full import is gone, writes nothing and ends 2; the same of plan and write", async () => {
    const t = setup();
    writeSettings(t.home, { ...t.given, import: "light" });
    const before = JSON.stringify(readSettings(t.home));
    const GONE = "The full import is gone: this Mac imports lightly.";
    assert.equal(settingsMain(["set", "--import", "full", "--readings", "off"], { home: t.home, say: (line) => t.said.push(line), now: new Date("2026-10-22T20:00:00-04:00") }), 2);
    assert.deepEqual(t.said, [GONE]);
    assert.equal(JSON.stringify(readSettings(t.home)), before);
    for (const command of ["plan", "write"]) {
      t.said.length = 0;
      const told = ["--machine", "Mac Studio", "--root", ROOT, "--checkout", CHECKOUT, "--import", "full"];
      assert.equal(await settingsMain([command, ...told], { home: t.home, say: (line) => t.said.push(line), now: new Date("2026-10-22T20:00:00-04:00") }), 2, command);
      assert.deepEqual(t.said, [GONE], command);
      assert.equal(JSON.stringify(readSettings(t.home)), before, command);
    }
    t.done();
  });
});
