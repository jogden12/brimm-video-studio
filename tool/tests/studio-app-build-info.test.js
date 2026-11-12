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
const KEY = "A".repeat(43) + "=";
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

  it("a version with a pre-release part goes on the beta channel, and only such a version does", () => {
    const SENTENCE = "A version with a pre-release part goes on the beta channel, and only such a version does (--channel).";
    assert.equal(buildJson({ ...GOOD, version: "1.0.0-beta.2", channel: "stable" }).fault, SENTENCE);
    assert.equal(buildJson({ ...GOOD, version: "1.0.0", channel: "beta" }).fault, SENTENCE);
    assert.equal(typeof buildJson({ ...GOOD, version: "1.0.0-beta.2", channel: "beta" }).text, "string");
    assert.equal(typeof buildJson({ ...GOOD, version: "1.0.0", channel: "stable" }).text, "string");
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    const refused = run("json", "--version", "1.0.0-beta.2", "--build", "3", "--commit", COMMIT, "--channel", "stable");
    assert.equal(refused.status, 2);
    assert.equal(refused.stdout, "");
    assert.equal(refused.stderr, `${SENTENCE}\n`);
  });

  it("the Info.plist names the app, its scheme and macOS 13", () => {
    const text = infoPlist({ version: "1.0.0-beta.1", build: 3, publicKey: KEY });
    const pairs = [
      ["CFBundleExecutable", APP_NAME], ["CFBundleName", APP_NAME], ["CFBundleDisplayName", APP_NAME], ["CFBundleIdentifier", BUNDLE_ID],
      ["CFBundlePackageType", "APPL"], ["CFBundleInfoDictionaryVersion", "6.0"], ["CFBundleShortVersionString", "1.0.0-beta.1"], ["CFBundleVersion", "3"],
      ["LSMinimumSystemVersion", MIN_MACOS], ["CFBundleURLName", BUNDLE_ID],
      ["NSDownloadsFolderUsageDescription", USAGE], ["NSDesktopFolderUsageDescription", USAGE], ["NSDocumentsFolderUsageDescription", USAGE], ["NSFileProviderDomainUsageDescription", USAGE],
    ];
    for (const [key, value] of pairs) assert.ok(entry(text, key).replace(/\s+/g, "").startsWith(`<key>${key}</key><string>${value}</string>`.replace(/\s+/g, "")), key);
    assert.match(text.replace(/\s+/g, ""), new RegExp(`<key>CFBundleURLSchemes</key><array><string>${URL_SCHEME}</string></array>`));
    assert.match(text.replace(/\s+/g, ""), /<key>NSHighResolutionCapable<\/key><true\/>/);
    assert.ok(!text.includes("LSUIElement"));
    assert.ok(!text.includes("CFBundleIconFile"));
    assert.match(infoPlist({ version: "1.0.0", build: 1, icon: true, publicKey: KEY }).replace(/\s+/g, ""), /<key>CFBundleIconFile<\/key><string>AppIcon<\/string>/);
    assert.equal(infoPlist({ version: "2.3.4", build: 9, publicKey: KEY }).includes("<string>2.3.4</string>"), true);
  });

  it("plutil -lint passes on the Info.plist", { skip: process.platform !== "darwin" && "plutil is the Mac's" }, () => {
    const root = mkdtempSync(join(tmpdir(), "build-info-"));
    try {
      writeFileSync(join(root, "Info.plist"), infoPlist({ version: "1.0.0-beta.1", build: 3, icon: true, publicKey: KEY }));
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
    const plist = run("plist", "--version", "1.0.0-beta.1", "--build", "3", "--public-key", KEY, "--icon");
    assert.equal(plist.status, 0);
    assert.equal(plist.stdout, infoPlist({ version: "1.0.0-beta.1", build: 3, icon: true, publicKey: KEY }));
    const bad = run("json", "--version", "1.0", "--build", "3", "--commit", COMMIT, "--channel", "beta");
    assert.equal(bad.status, 2);
    assert.equal(bad.stdout, "");
    assert.match(bad.stderr, /version/);
    const missing = run("plist", "--build", "3", "--public-key", KEY);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /version/);
    assert.equal(run("nonsense").status, 2);
  });

  it("an option it does not know is a fault that never repeats what was typed, which may be a stray value", () => {
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    const faults = [];
    for (const stray of ["--secret-word-123", "a-pasted-code-987"]) {
      for (const which of ["json", "plist"]) {
        const made = run(which, "--version", "1.0.0", "--build", "3", ...(which === "plist" ? ["--public-key", KEY] : []), stray);
        assert.equal(made.status, 2, made.stderr);
        assert.equal(made.stdout, "");
        assert.ok(!made.stderr.includes(stray), made.stderr);
        assert.match(made.stderr, /option/);
        faults.push(made.stderr);
      }
    }
    assert.equal(new Set(faults).size, 1, "the same words, whatever was typed");
  });

  it("json and plist refuse a version and a build in the same words", () => {
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    const json = (version, build) => run("json", "--version", version, "--build", build, "--commit", COMMIT, "--channel", "beta");
    const plist = (version, build) => run("plist", "--version", version, "--build", build, "--public-key", KEY);
    for (const [version, build] of [["1.0", "3"], ["1.0.0", "0"], ["1.0.0", "1.5"], ["1.0.0", "x"]]) {
      const a = json(version, build);
      const b = plist(version, build);
      assert.equal(a.status, 2);
      assert.equal(b.status, 2);
      assert.equal(a.stderr, b.stderr, `${version} ${build}`);
      assert.ok(a.stderr.length > 1);
    }
    assert.equal(plist("1.0.0", "1.5").stderr, `${buildJson({ ...GOOD, build: 1.5 }).fault}\n`);
  });

  it("the Info.plist carries the feed, the key and the five switches", { skip: process.platform !== "darwin" && "plutil is the Mac's" }, () => {
    const root = mkdtempSync(join(tmpdir(), "build-info-"));
    try {
      const file = join(root, "Info.plist");
      writeFileSync(file, infoPlist({ version: "1.0.0-beta.2", build: 4, publicKey: KEY }));
      const lint = spawnSync("/usr/bin/plutil", ["-lint", file], { encoding: "utf8" });
      assert.equal(lint.status, 0, lint.stdout + lint.stderr);
      const raw = (key) => {
        const ran = spawnSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", file], { encoding: "utf8" });
        assert.equal(ran.status, 0, `${key}: ${ran.stderr}`);
        return ran.stdout.trim();
      };
      const expected = [
        ["CFBundleShortVersionString", "1.0.0-beta.2"], ["CFBundleVersion", "4"], ["SUFeedURL", FEED], ["SUPublicEDKey", KEY],
        ["SUEnableAutomaticChecks", "false"], ["SUAutomaticallyUpdate", "false"], ["SUAllowsAutomaticUpdates", "false"],
        ["SUEnableSystemProfiling", "false"], ["SUVerifyUpdateBeforeExtraction", "true"],
      ];
      for (const [key, value] of expected) assert.equal(raw(key), value, key);
      // The switches are booleans, not strings that say true or false.
      for (const key of ["SUEnableAutomaticChecks", "SUAutomaticallyUpdate", "SUAllowsAutomaticUpdates", "SUEnableSystemProfiling", "SUVerifyUpdateBeforeExtraction"]) {
        const type = spawnSync("/usr/bin/plutil", ["-type", key, file], { encoding: "utf8" });
        assert.equal(type.stdout.trim(), "bool", key);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a plist is never made without a public key, and the fault never repeats what was typed", () => {
    const FAULT = "The update key's public half (--public-key) is not one that can be used.";
    const bad = [undefined, "", "A".repeat(43), `${KEY} `, `${KEY}\n`, "B".repeat(42) + "==", "c2VjcmV0LXdvcmQtMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=", 42];
    for (const publicKey of bad) {
      assert.deepEqual(infoPlist({ version: "1.0.0-beta.2", build: 4, publicKey }), { fault: FAULT }, String(publicKey));
    }
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    const none = run("plist", "--version", "1.0.0-beta.2", "--build", "4");
    assert.equal(none.status, 2);
    assert.equal(none.stdout, "");
    assert.equal(none.stderr, `${FAULT}\n`);
    for (const typed of ["secret-word-123", "a-pasted-code-987", KEY.slice(1)]) {
      const made = run("plist", "--version", "1.0.0-beta.2", "--build", "4", "--public-key", typed);
      assert.equal(made.status, 2);
      assert.equal(made.stdout, "");
      assert.equal(made.stderr, `${FAULT}\n`);
      assert.ok(!made.stderr.includes(typed));
    }
  });

  it("a bad version or build is refused before the key, in json's words", () => {
    const versionFault = buildJson({ ...GOOD, version: "1.0" }).fault;
    const buildFault = buildJson({ ...GOOD, build: 0 }).fault;
    assert.deepEqual(infoPlist({ version: "1.0", build: 0 }), { fault: versionFault });
    assert.deepEqual(infoPlist({ version: "1.0.0", build: 0 }), { fault: buildFault });
    assert.deepEqual(infoPlist({ version: "1.0", build: 3, publicKey: KEY }), { fault: versionFault });
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8" });
    assert.equal(run("plist", "--version", "1.0", "--build", "0").stderr, `${versionFault}\n`);
    assert.equal(run("plist", "--version", "1.0.0", "--build", "0").stderr, `${buildFault}\n`);
    assert.equal(run("plist", "--version", "1.0.0", "--build", "x", "--public-key", "nonsense").stderr, `${buildFault}\n`);
  });
});
