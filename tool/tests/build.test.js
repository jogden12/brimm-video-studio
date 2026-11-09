// build.js tells a Mac with BRIMM Video Studio installed (a build.json beside tool/) from a git checkout, and commitOf reads build.json on the first.
// Each test makes its checkouts in temp folders and removes them; no program is started and nothing is fetched.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_FILE, REPAIR, UPDATE_SAY, brokenLine, buildOf, isInstalled, repairLine } from "../build.js";
import { commitOf, thisCheckout } from "../filing.js";
import { handoffFaultV2 } from "../handoff-v2.js";

const WHOLE = { version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid" };
const BROKEN = { mode: "installed", version: "", build: 0, commit: "", short: "unknown", feed: "", channel: "stable", support: "", broken: true };

const made = [];
/** A made-up checkout: with no build.json, or with `given` written as its build.json (a string as it is, anything else as JSON). */
const checkout = (given) => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-build-"));
  made.push(dir);
  if (given !== undefined) writeFileSync(join(dir, BUILD_FILE), typeof given === "string" ? given : JSON.stringify(given));
  return dir;
};
const aFile = join(checkout(), "a file");
writeFileSync(aFile, "not a folder");
after(() => {
  for (const dir of made) {
    try {
      chmodSync(dir, 0o755);
    } catch (e) {
      // It was never changed, or is gone.
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("whether a Mac has BRIMM Video Studio installed", () => {
  it("is dev mode when the checkout has no build.json", () => assert.deepEqual(buildOf(checkout()), { mode: "dev" }));
  it("is dev mode for a checkout that is no whole path, or is a file", () => {
    for (const c of [undefined, null, "", "relative/x", 7, aFile]) assert.deepEqual(buildOf(c), { mode: "dev" });
  });
  it("reads a whole build.json", () => assert.deepEqual(buildOf(checkout(WHOLE)), { mode: "installed", ...WHOLE, broken: false }));
  it("is installed and broken when build.json is not a JSON object, is a folder, or is a link to nowhere", () => {
    for (const text of ["{", "[]", "null", "\"1.4.2\""]) assert.deepEqual(buildOf(checkout(text)), BROKEN, text);
    const folder = checkout();
    mkdirSync(join(folder, BUILD_FILE));
    assert.deepEqual(buildOf(folder), BROKEN);
    const link = checkout();
    symlinkSync(join(link, "missing.json"), join(link, BUILD_FILE));
    assert.deepEqual(buildOf(link), BROKEN);
  });
  it("empties each field that will not do, and only version, build, short and feed make it broken", () => {
    const cases = [
      [{ version: "1.5" }, { version: "" }, true], [{ build: "142" }, { build: 0 }, true], [{ build: 0 }, { build: 0 }, true], [{ build: 1.5 }, { build: 0 }, true],
      [{ commit: "xyz" }, { commit: "" }, false],
      [{ short: "ABC1234" }, { short: "unknown" }, true], [{ short: "abc12" }, { short: "unknown" }, true], [{ short: "fedcba9" }, { short: "unknown" }, true],
      [{ feed: "http://updates.example.invalid/appcast.xml" }, { feed: "" }, true], [{ feed: "https://updates.example.invalid/appcast.xml?mac=1" }, { feed: "" }, true],
      [{ feed: "https://updates.example.invalid/appcast.xml#x" }, { feed: "" }, true], [{ feed: "https://me:pw@updates.example.invalid/a.xml" }, { feed: "" }, true], [{ feed: "not a url" }, { feed: "" }, true],
      [{ channel: "nightly" }, { channel: "stable" }, false], [{ channel: "beta" }, { channel: "beta" }, false],
      [{ support: "a\u0007b" }, { support: "" }, false], [{ support: "x".repeat(201) }, { support: "" }, false], [{ support: "  help@example.invalid  " }, { support: "help@example.invalid" }, false]
    ];
    for (const [given, want, broken] of cases) assert.deepEqual(buildOf(checkout({ ...WHOLE, ...given })), { mode: "installed", ...WHOLE, ...want, broken }, JSON.stringify(given));
  });
  it("is installed and broken when the checkout cannot be looked in", { skip: process.getuid?.() === 0 }, () => {
    const dir = checkout(WHOLE);
    chmodSync(dir, 0o000);
    try {
      assert.deepEqual(buildOf(dir), BROKEN);
    } finally {
      chmodSync(dir, 0o755);
    }
  });
  it("finds this checkout, a git checkout, in dev mode: a build.json here would turn it into an installed Mac", { skip: !existsSync(join(thisCheckout(), ".git")) }, () => {
    assert.deepEqual(buildOf(thisCheckout()), { mode: "dev" });
  });
  it("gives an installed Mac's commit from build.json, beside a .git too, and starts no program", () => {
    const real = childProcess.spawnSync;
    let spawned = 0;
    childProcess.spawnSync = (...a) => (spawned++, real(...a));
    syncBuiltinESMExports();
    try {
      const dir = checkout(WHOLE);
      mkdirSync(join(dir, ".git"));
      assert.equal(commitOf(dir), "0123456");
      assert.equal(spawned, 0);
      const bad = checkout("{");
      mkdirSync(join(bad, ".git"));
      assert.equal(commitOf(bad), "unknown");
      assert.equal(spawned, 0);
    } finally {
      childProcess.spawnSync = real;
      syncBuiltinESMExports();
    }
  });
  it("makes a madeBy the hand-off contract takes, whole or broken", () => {
    const h = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
    for (const dir of [checkout(WHOLE), checkout("{")]) assert.equal(handoffFaultV2({ ...h, madeBy: `brimm-video ${commitOf(dir)}` }), "");
  });
  it("says to choose Repair, with the support contact when build.json has one", () => {
    assert.equal(repairLine(buildOf(checkout(WHOLE))), "Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid.");
    assert.equal(repairLine(buildOf(checkout({ ...WHOLE, support: "" }))), REPAIR);
    assert.equal(brokenLine(buildOf(checkout("{"))), "This Mac's BRIMM Video Studio cannot read its own build file. Open BRIMM Video Studio and choose Repair.");
    assert.equal(UPDATE_SAY, 'Say "update Studio" to update this Mac.');
    assert.equal(isInstalled(buildOf(checkout(WHOLE))), true);
    for (const b of [{ mode: "dev" }, undefined, null]) assert.equal(isInstalled(b), false);
  });
});
