// The HyperFrames app's version, read from its Info.plist, so the next `reelkit app` can say it was updated. plutil is stood in:
// no test runs the real one.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appPlists, readAppVersion, appVersionFile, noteAppVersion, appVersionLine } from "../app-version.js";

const HOME = "/Users/sallie";
const SYSTEM = "/Applications/HyperFrames.app/Contents/Info.plist";
const USER = `${HOME}/Applications/HyperFrames.app/Contents/Info.plist`;

/** A stand-in plutil: `plists` maps a plist path to what it holds (an object), and a path not in it is unreadable. */
function plutil(plists) {
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args]);
    const plist = args[args.length - 1];
    if (!(plist in plists)) return { status: 1, stdout: "", stderr: "No such file" };
    return { status: 0, stdout: JSON.stringify(plists[plist]), stderr: "" };
  };
  run.calls = calls;
  return run;
}
const withHome = (fn) => {
  const home = mkdtempSync(join(tmpdir(), "app-version-"));
  try { return fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

describe("app-version", () => {
  it("reads the version and build from Info.plist", () => {
    assert.deepEqual(appPlists(HOME), [SYSTEM, USER]);
    const run = plutil({ [SYSTEM]: { CFBundleShortVersionString: "0.9.4", CFBundleVersion: "941", CFBundleName: "HyperFrames" } });
    const seen = readAppVersion({ home: HOME, run });
    assert.deepEqual(seen, { version: "0.9.4", build: "941", copies: [{ path: SYSTEM, version: "0.9.4", build: "941" }] });
    assert.deepEqual(run.calls[0], ["/usr/bin/plutil", "-convert", "json", "-o", "-", SYSTEM]);
    assert.equal(appVersionFile(HOME), `${HOME}/Library/Application Support/BRIMM Video/app-version.json`);
  });

  it("says once when the app's version changed, and not again", () => {
    withHome((home) => {
      const v1 = { version: "0.9.4", build: "941", copies: [] };
      const v2 = { version: "0.9.5", build: "950", copies: [] };
      assert.deepEqual(noteAppVersion(home, v1), { changed: false, was: "" }, "the first one ever seen is not a change");
      const written = JSON.parse(readFileSync(appVersionFile(home), "utf8"));
      assert.equal(written.version, "0.9.4");
      assert.equal(written.build, "941");
      assert.match(written.at, /^\d{4}-\d\d-\d\dT/);
      assert.deepEqual(noteAppVersion(home, v1), { changed: false, was: "" });
      assert.deepEqual(noteAppVersion(home, v2), { changed: true, was: "0.9.4" });
      assert.deepEqual(noteAppVersion(home, v2), { changed: false, was: "" }, "said once");
      assert.deepEqual(readdirSync(join(appVersionFile(home), "..")), ["app-version.json"], "written whole: no temp file left");
      assert.equal(appVersionLine({ was: "0.9.4", now: "0.9.5", copies: [] }),
        "HyperFrames was updated since this project was last opened (0.9.4 to 0.9.5): check that it plays before you change it.");
      assert.equal(appVersionLine({ was: "", now: "0.9.5", copies: [] }), "");
    });
  });

  it("names both copies when two HyperFrames apps differ", () => {
    const run = plutil({
      [SYSTEM]: { CFBundleShortVersionString: "0.9.5", CFBundleVersion: "950" },
      [USER]: { CFBundleShortVersionString: "0.9.2", CFBundleVersion: "920" },
    });
    const seen = readAppVersion({ home: HOME, run });
    assert.equal(seen.version, "0.9.5", "the /Applications copy is first");
    assert.equal(seen.copies.length, 2);
    const line = appVersionLine({ was: "0.9.4", now: seen.version, copies: seen.copies });
    assert.match(line, /^HyperFrames was updated since this project was last opened \(0\.9\.4 to 0\.9\.5\): check that it plays before you change it\./);
    assert.match(line, /0\.9\.5/);
    assert.match(line, /0\.9\.2/);
    assert.match(line, /two copies/);
    const same = readAppVersion({ home: HOME, run: plutil({
      [SYSTEM]: { CFBundleShortVersionString: "0.9.5", CFBundleVersion: "950" },
      [USER]: { CFBundleShortVersionString: "0.9.5", CFBundleVersion: "950" } }) });
    assert.doesNotMatch(appVersionLine({ was: "0.9.4", now: "0.9.5", copies: same.copies }), /two copies/);
  });

  it("reads the copy in your Applications folder when it is the only one", () => {
    const run = plutil({ [USER]: { CFBundleShortVersionString: "0.9.3", CFBundleVersion: "930" } });
    const seen = readAppVersion({ home: HOME, run });
    assert.deepEqual(seen, { version: "0.9.3", build: "930", copies: [{ path: USER, version: "0.9.3", build: "930" }] });
    assert.deepEqual(run.calls.map((call) => call.at(-1)), [SYSTEM, USER], "/Applications is asked first");
    assert.equal(appVersionLine({ was: "0.9.2", now: seen.version, copies: seen.copies }),
      "HyperFrames was updated since this project was last opened (0.9.2 to 0.9.3): check that it plays before you change it.");
  });

  it("gives plutil five seconds for each copy", () => {
    const options = [];
    readAppVersion({ home: HOME, run: (cmd, args, given) => {
      options.push(given);
      return { status: 1, stdout: "", stderr: "" };
    } });
    assert.deepEqual(options, [{ encoding: "utf8", timeout: 5000 }, { encoding: "utf8", timeout: 5000 }]);
  });

  it("reads nothing and says nothing when no app is there", () => {
    const seen = readAppVersion({ home: HOME, run: plutil({}) });
    assert.deepEqual(seen, { version: "", build: "", copies: [] });
    withHome((home) => {
      assert.deepEqual(noteAppVersion(home, seen), { changed: false, was: "" });
      assert.equal(existsSync(appVersionFile(home)), false, "nothing seen, nothing written");
    });
    assert.equal(appVersionLine({ was: "0.9.4", now: "", copies: [] }), "");
    const junk = readAppVersion({ home: HOME, run: () => ({ status: 0, stdout: "not json", stderr: "" }) });
    assert.deepEqual(junk, { version: "", build: "", copies: [] });
  });
});
