// The app's names, its build.json and its Info.plist, from tool/studio-app/build-info.js (Phase 6, Task 1).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOf } from "../build.js";
import { CHECK_FOR_UPDATES_URL } from "../edit.js";
import { APP_NAME, BUNDLE_ID, FEED, MIN_MACOS, SUPPORT, URL_SCHEME, buildJson, infoPlist } from "../studio-app/build-info.js";

const FILE = fileURLToPath(new URL("../studio-app/build-info.js", import.meta.url));
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const GOOD = { version: "1.0.0-beta.1", build: 3, commit: COMMIT, channel: "beta" };
const USAGE = "BRIMM Video Studio looks in this folder for new videos and for the videos HyperFrames exports.";

/** The text of the plist's key `name` and the value after it, as `<key>name</key>` and what follows. */
const entry = (text, name) => text.slice(text.indexOf(`<key>${name}</key>`));

describe("build-info.js", () => {
  it("the build.json it writes is one buildOf reads whole", () => {
    const made = buildJson(GOOD);
    assert.equal(typeof made.text, "string");
    assert.ok(made.text.endsWith("\n"));
    assert.deepEqual(Object.keys(JSON.parse(made.text)), ["version", "build", "commit", "short", "feed", "channel", "support"]);
    const root = mkdtempSync(join(tmpdir(), "build-info-"));
    try {
      mkdirSync(join(root, "tool"));
      writeFileSync(join(root, "build.json"), made.text);
      assert.deepEqual(buildOf(root), { mode: "installed", version: "1.0.0-beta.1", build: 3, commit: COMMIT, short: "0123456", feed: FEED, channel: "beta", support: SUPPORT, broken: false });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a version, build, commit or channel it cannot take is a fault that names the option", () => {
    const cases = [
      [{ version: "1.0" }, "version", "1.0"],
      [{ build: 0 }, "build", "0"],
      [{ build: 1.5 }, "build", "1.5"],
      [{ commit: COMMIT.slice(1) }, "commit", COMMIT.slice(1)],
      [{ channel: "nightly" }, "channel", "nightly"],
    ];
    for (const [change, option, value] of cases) {
      const made = buildJson({ ...GOOD, ...change });
      assert.equal(made.text, undefined);
      assert.match(made.fault, new RegExp(option));
      // Whatever the value, the fault is the same words: it holds the option's name and never the value.
      assert.equal(made.fault, buildJson({ ...GOOD, [option]: `${value}-other` }).fault, `${option}: the fault changes with the value`);
      if (value.length > 4) assert.ok(!made.fault.includes(value), `${option}: the fault holds the value`);
    }
  });

  it("the Info.plist names the app, its scheme and macOS 13", () => {
    const text = infoPlist({ version: "1.0.0-beta.1", build: 3 });
    const pairs = [
      ["CFBundleExecutable", APP_NAME], ["CFBundleName", APP_NAME], ["CFBundleDisplayName", APP_NAME], ["CFBundleIdentifier", BUNDLE_ID],
      ["CFBundlePackageType", "APPL"], ["CFBundleInfoDictionaryVersion", "6.0"], ["CFBundleShortVersionString", "1.0.0"], ["CFBundleVersion", "3"],
      ["LSMinimumSystemVersion", MIN_MACOS], ["CFBundleURLName", BUNDLE_ID],
      ["NSDownloadsFolderUsageDescription", USAGE], ["NSDesktopFolderUsageDescription", USAGE], ["NSDocumentsFolderUsageDescription", USAGE], ["NSFileProviderDomainUsageDescription", USAGE],
    ];
    for (const [key, value] of pairs) assert.ok(entry(text, key).replace(/\s+/g, "").startsWith(`<key>${key}</key><string>${value}</string>`.replace(/\s+/g, "")), key);
    assert.match(text.replace(/\s+/g, ""), new RegExp(`<key>CFBundleURLSchemes</key><array><string>${URL_SCHEME}</string></array>`));
    assert.match(text.replace(/\s+/g, ""), /<key>NSHighResolutionCapable<\/key><true\/>/);
    assert.ok(!text.includes("LSUIElement"));
    assert.ok(!text.includes("CFBundleIconFile"));
    assert.match(infoPlist({ version: "1.0.0", build: 1, icon: true }).replace(/\s+/g, ""), /<key>CFBundleIconFile<\/key><string>AppIcon<\/string>/);
    assert.equal(infoPlist({ version: "2.3.4", build: 9 }).includes("<string>2.3.4</string>"), true);
  });

  it("plutil -lint passes on the Info.plist", { skip: process.platform !== "darwin" && "plutil is the Mac's" }, () => {
    const root = mkdtempSync(join(tmpdir(), "build-info-"));
    try {
      writeFileSync(join(root, "Info.plist"), infoPlist({ version: "1.0.0-beta.1", build: 3, icon: true }));
      const ran = spawnSync("/usr/bin/plutil", ["-lint", join(root, "Info.plist")], { encoding: "utf8" });
      assert.equal(ran.status, 0, ran.stdout + ran.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the scheme is the one edit.js opens", () => {
    assert.equal(new URL(CHECK_FOR_UPDATES_URL).protocol, URL_SCHEME + ":");
  });

  it("the command line prints the text, or the fault with 2", () => {
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    const json = run("json", "--version", "1.0.0-beta.1", "--build", "3", "--commit", COMMIT, "--channel", "beta");
    assert.equal(json.status, 0);
    assert.equal(json.stdout, buildJson(GOOD).text);
    const plist = run("plist", "--version", "1.0.0-beta.1", "--build", "3", "--icon");
    assert.equal(plist.status, 0);
    assert.equal(plist.stdout, infoPlist({ version: "1.0.0-beta.1", build: 3, icon: true }));
    const bad = run("json", "--version", "1.0", "--build", "3", "--commit", COMMIT, "--channel", "beta");
    assert.equal(bad.status, 2);
    assert.equal(bad.stdout, "");
    assert.match(bad.stderr, /version/);
    const missing = run("plist", "--build", "3");
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /version/);
    assert.equal(run("nonsense").status, 2);
  });
});
