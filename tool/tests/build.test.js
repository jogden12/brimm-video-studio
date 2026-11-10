// build.js tells a Mac with BRIMM Video Studio installed (a build.json beside tool/) from a git checkout, and commitOf reads build.json on the first.
// Each test makes its checkouts in temp folders and removes them; no program is started and nothing is fetched.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_FILE, NEWER_SAY, REPAIR, VERSION, UPDATE_SAY, saidHere, askWords, brokenLine, buildOf, forThisMac, isInstalled, repairLine } from "../build.js";
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
      [{ feed: "https://updates.example.invalid/appcast.xml#x" }, { feed: "" }, true],
      [{ feed: "https://updates.example.invalid/appcast.xml?" }, { feed: "" }, true], [{ feed: "https://updates.example.invalid/appcast.xml#" }, { feed: "" }, true], [{ feed: "https://me:pw@updates.example.invalid/a.xml" }, { feed: "" }, true], [{ feed: "not a url" }, { feed: "" }, true],
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
    childProcess.spawnSync = () => (spawned++, { status: 1, stdout: "" });
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
  it("exports the version form it checks", () => {
    assert.equal(VERSION.test("1.4.2"), true);
    assert.equal(VERSION.test("1.4.2-beta.1"), true);
    assert.equal(VERSION.test("1.4"), false);
  });
  it("says to choose Repair, with the support contact when build.json has one", () => {
    assert.equal(repairLine(buildOf(checkout(WHOLE))), "Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid.");
    assert.equal(repairLine(buildOf(checkout({ ...WHOLE, support: "" }))), REPAIR);
    assert.equal(brokenLine(buildOf(checkout("{"))), "This Mac's BRIMM Video Studio cannot read its own build file. Open BRIMM Video Studio and choose Repair.");
    assert.equal(UPDATE_SAY, 'Say "update Studio" to update this Mac.');
    assert.equal(isInstalled(buildOf(checkout(WHOLE))), true);
    for (const b of [{ mode: "dev" }, undefined, null]) assert.equal(isInstalled(b), false);
  });
  it("gives a record's NEWER error again in the update's words on an installed Mac, and every other error as it is (review finding 2)", () => {
    // episode.js knows no build, so its own words name Jason: "Jason has a newer BRIMM Video Studio. Ask him to update this Mac."
    const newer = Object.assign(new Error("Jason has a newer BRIMM Video Studio. Ask him to update this Mac."), { code: "NEWER" });
    const installed = buildOf(checkout(WHOLE));
    const told = forThisMac(newer, installed);
    assert.equal(NEWER_SAY, 'the episode was written by a newer BRIMM Video Studio. Say "update Studio" to update this Mac.');
    assert.equal(told.message, NEWER_SAY);
    assert.equal(told.code, "NEWER");
    assert.equal(told instanceof Error, true);
    assert.doesNotMatch(told.message, /Jason|install\.sh|Terminal|node/);
    // A checkout keeps episode.js's own words: Jason is at hand there.
    for (const b of [buildOf(checkout()), { mode: "dev" }, undefined, null]) assert.equal(forThisMac(newer, b), newer);
    // Nothing else is touched, installed or not.
    const changed = Object.assign(new Error("The episode changed on the other Mac."), { code: "CHANGED" });
    for (const e of [changed, new Error("EACCES"), "a plain string", undefined, null]) assert.equal(forThisMac(e, installed), e);
  });

  it("gives the words that send a person to Jason as they are on a checkout, with the support contact in his place on an installed Mac, and takes them out where it names none (the sweep)", () => {
    const installed = buildOf(checkout(WHOLE));
    const unnamed = buildOf(checkout({ ...WHOLE, support: "" }));
    const table = [
      // [the checkout's words, what stands where no one is named, with a support contact, with none]
      [" Ask Jason.", undefined, " Ask help@example.invalid.", ""],
      [": ask Jason.", ".", ": ask help@example.invalid.", "."],
      [" If it says this again, tell Jason.", undefined, " If it says this again, tell help@example.invalid.", ""],
      [", or ask Jason.", ".", ", or ask help@example.invalid.", "."],
      [": ask Jason to put it back.", ".", ": ask help@example.invalid to put it back.", "."]
    ];
    for (const [dev, bare, named, none] of table) {
      for (const b of [buildOf(checkout()), { mode: "dev" }, undefined, null]) assert.equal(bare === undefined ? askWords(b, dev) : askWords(b, dev, bare), dev);
      assert.equal(bare === undefined ? askWords(installed, dev) : askWords(installed, dev, bare), named);
      assert.equal(bare === undefined ? askWords(unnamed, dev) : askWords(unnamed, dev, bare), none);
      assert.doesNotMatch(named + none, /Jason|install\.sh|Terminal|node/);
    }
  });

  it("gives a line that ends by sending a person to Jason as an installed Mac says it, by its last words alone, and every line as it is on a checkout (the sweep)", () => {
    const installed = buildOf(checkout(WHOLE));
    const unnamed = buildOf(checkout({ ...WHOLE, support: "" }));
    const S = "help@example.invalid";
    const table = [
      // [how a checkout's line ends, with a support contact, with none]
      ["It could not be made again. Ask Jason.", `It could not be made again. Ask ${S}.`, "It could not be made again."],
      ["A number is never given twice. Ask Jason. Nothing was written.", `A number is never given twice. Ask ${S}. Nothing was written.`, "A number is never given twice. Nothing was written."],
      ["Readings are off on this Mac: ask Jason.", `Readings are off on this Mac: ask ${S}.`, "Readings are off on this Mac."],
      ["Its versions lead to e-20261104-a11111: ask Jason. Nothing was written.", `Its versions lead to e-20261104-a11111: ask ${S}. Nothing was written.`, "Its versions lead to e-20261104-a11111. Nothing was written."],
      ["Answer it as a session too, or ask Jason.", `Answer it as a session too, or ask ${S}.`, "Answer it as a session too."],
      ["Answer it as a session, or ask Jason. Nothing was written.", `Answer it as a session, or ask ${S}. Nothing was written.`, "Answer it as a session. Nothing was written."],
      ["Say it again in a few minutes. If it says this again, tell Jason.", `Say it again in a few minutes. If it says this again, tell ${S}.`, "Say it again in a few minutes."],
      ['Say "open Talk in HyperFrames" to try again; if it says this again, ask Jason.', `Say "open Talk in HyperFrames" to try again; if it says this again, ask ${S}.`, 'Say "open Talk in HyperFrames" to try again.'],
      ["Dropbox is bringing it back. If it does not come, tell Jason.", `Dropbox is bringing it back. If it does not come, tell ${S}.`, "Dropbox is bringing it back."],
      ["Say B. If that is not what you want, tell Jason.", `Say B. If that is not what you want, tell ${S}.`, "Say B."],
      ["Try once more. If it still won't, tell Jason.", `Try once more. If it still won't, tell ${S}.`, "Try once more."],
      ["Its versions name each other: tell Jason.", `Its versions name each other: tell ${S}.`, "Its versions name each other."],
      ["They could not be taken out. Tell Jason.", `They could not be taken out. Tell ${S}.`, "They could not be taken out."],
      ["It could not be put back as it was. Tell Jason: the episode needs him.", `It could not be put back as it was. Tell ${S}: the episode needs help.`, "It could not be put back as it was."],
      ["It is kept at /a/b: ask Jason to put it back.", `It is kept at /a/b: ask ${S} to put it back.`, "It is kept at /a/b."],
      ["It was turned on more than 90 days ago on this Mac: ask Jason to check the training setting again.", `It was turned on more than 90 days ago on this Mac: ask ${S} to check the training setting again.`, "It was turned on more than 90 days ago on this Mac."],
      ["Claude runs only BRIMM Video Studio's own commands. Ask Jason for anything else.", `Claude runs only BRIMM Video Studio's own commands. Ask ${S} for anything else.`, "Claude runs only BRIMM Video Studio's own commands."],
      ["Close it in HyperFrames, and ask Jason what to do with it.", `Close it in HyperFrames, and ask ${S} what to do with it.`, "Close it in HyperFrames."],
      ["Drop the new revision on the BRIMM Ops page and tell Jason.", `Drop the new revision on the BRIMM Ops page and tell ${S}.`, "Drop the new revision on the BRIMM Ops page."],
      ['Say "sort out the conflict" again to put them right; if it still says a file is not whole, tell Jason the episode\'s name.', `Say "sort out the conflict" again to put them right; if it still says a file is not whole, tell ${S} the episode's name.`, 'Say "sort out the conflict" again to put them right.'],
      ["It could not be sorted out: EIO. A conflict needs Jason: tell him the episode's name.", `It could not be sorted out: EIO. A conflict needs ${S}: tell them the episode's name.`, "It could not be sorted out: EIO."],
      ["It is signed in to another account than the one Jason checked: ask Jason.", `It is signed in to another account than the one that was checked: ask ${S}.`, "It is signed in to another account than the one that was checked."],
      ["Dropbox keeps it there and in its history. Jason removes it by hand if he wants.", "Dropbox keeps it there and in its history. It can be removed there by hand.", "Dropbox keeps it there and in its history. It can be removed there by hand."]
    ];
    for (const [dev, named, bare] of table) {
      for (const b of [buildOf(checkout()), { mode: "dev" }, undefined, null]) assert.equal(saidHere(dev, b), dev);
      assert.equal(saidHere(dev, installed), named);
      assert.equal(saidHere(dev, unnamed), bare);
      assert.doesNotMatch(named + bare, /Jason|install\.sh|Terminal|\bnode\b|\bhim\b/);
    }
    // Only a line's last words are looked at: a name or a sentence a person said, earlier in the line, is never changed.
    for (const line of ['"Ask Jason." is a video of 3 minutes.', "Ask Jason. Then say it again.", "The words of Ask Jason are not on this Mac yet.", "Nothing here names him.", ""]) {
      assert.equal(saidHere(line, installed), line);
      assert.equal(saidHere(line, unnamed), line);
    }
    // What is no line is given back as it is.
    for (const other of [undefined, null, 3]) assert.equal(saidHere(other, installed), other);
  });
});
