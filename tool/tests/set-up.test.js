// The record of the build that set this Mac up (tool/set-up.js): set-up.json in Studio's support folder, written whole and read back,
// and whether the app's own build has yet to finish an update. Each test's home is a folder made for it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { settingsFile } from "../settings.js";
import { UNFINISHED, readSetUp, setUpFile, unfinished, unfinishedBy, writeSetUp } from "../set-up.js";

const BUILD = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "", broken: false };

/** Runs `check` with a home made for it, and takes it away. */
function withHome(check) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "brimm-set-up-")));
  try {
    return check(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe("the record of the build that set this Mac up", () => {
  it("a record is written whole and read back", () => {
    withHome((home) => {
      assert.equal(setUpFile(home), join(dirname(settingsFile(home)), "set-up.json"));
      assert.equal(writeSetUp(home, BUILD), true);
      assert.equal(readFileSync(setUpFile(home), "utf8"), '{"version":1,"build":142,"app":"1.4.2"}\n');
      assert.equal(readSetUp(home), 142);
      assert.deepEqual(readdirSync(dirname(setUpFile(home))), ["set-up.json"]);
      assert.equal(writeSetUp(home, { ...BUILD, build: 150, version: "1.5.0" }), true);
      assert.equal(readSetUp(home), 150);
      assert.deepEqual(readdirSync(dirname(setUpFile(home))), ["set-up.json"]);
    });
  });

  it("no record, a record that is not JSON and a record with no whole build number are each read as none", () => {
    withHome((home) => {
      assert.equal(readSetUp(home), null);
      mkdirSync(dirname(setUpFile(home)), { recursive: true });
      for (const text of ["{", "", "null", "[142]", '"142"', '{"version":1}', '{"version":1,"build":"142"}', '{"version":1,"build":142.5}', '{"version":1,"build":0}', '{"version":1,"build":-3}']) {
        writeFileSync(setUpFile(home), text);
        assert.equal(readSetUp(home), null, text);
      }
    });
  });

  it("a record that cannot be written gives false, and throws nothing", () => {
    withHome((home) => {
      // A file where the support folder would be: nothing can be made inside it.
      mkdirSync(dirname(dirname(setUpFile(home))), { recursive: true });
      writeFileSync(dirname(setUpFile(home)), "");
      assert.equal(writeSetUp(home, BUILD), false);
    });
  });

  it("an update is unfinished only on an installed, readable build whose record is another's", () => {
    withHome((home) => {
      assert.equal(UNFINISHED, "BRIMM Video Studio was updated on this Mac. Open it once so it finishes the update, then start a new chat.");
      assert.equal(unfinished(home, BUILD), true, "no record");
      writeSetUp(home, { ...BUILD, build: 141, version: "1.4.1" });
      assert.equal(unfinished(home, BUILD), true, "another build's record");
      assert.equal(unfinished(home, { mode: "dev" }), false, "a checkout");
      assert.equal(unfinished(home, { ...BUILD, version: "", build: 0, broken: true }), false, "a build file that cannot be read");
      writeSetUp(home, BUILD);
      assert.equal(unfinished(home, BUILD), false, "this build's record");
    });
  });

  it("the rule of an unfinished update, given the record's build: one rule for unfinished and the status", () => {
    assert.equal(unfinishedBy(null, BUILD), true, "no record");
    assert.equal(unfinishedBy(141, BUILD), true, "another build's record");
    assert.equal(unfinishedBy(142, BUILD), false, "this build's record");
    assert.equal(unfinishedBy(null, { mode: "dev" }), false, "a checkout");
    assert.equal(unfinishedBy(null, { ...BUILD, version: "", build: 0, broken: true }), false, "a build file that cannot be read");
    assert.equal(unfinishedBy(0, { ...BUILD, version: "", build: 0, broken: true }), false, "a broken build and a record of 0");
  });
});
