// busy.js keeps the marker of an update under way, updating.json, which is live for two minutes after it was last written.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UPDATING, UPDATING_HOLD_MS, UPDATING_UNTOLD, endUpdating, markUpdating, updatingFile, updatingWhy } from "../busy.js";
import { settingsFile } from "../settings.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = join(TOOL, "tests");
const BUSY = join(TOOL, "busy.js");
const USAGE = "Say: node busy.js idle-why [--launchd -], or node busy.js updating begin, or node busy.js updating end [--look]";

/** Run `body` with a home of its own, removed after. */
function withHome(body) {
  const home = mkdtempSync(join(tmpdir(), "busy-updating-"));
  try {
    return body(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

/** A temp folder of the made-up Mac's own, inside its home, for each run of the command. */
const tempOf = (home) => join(home, "its temp folder");

describe("the marker of an update", () => {
  it("says its sentences and its two minutes", () => {
    assert.equal(UPDATING, "BRIMM Video Studio is being updated on this Mac. Try again once it has finished.");
    assert.equal(UPDATING_UNTOLD, "Whether BRIMM Video Studio is being updated on this Mac could not be told. Open BRIMM Video Studio and choose Repair.");
    assert.equal(UPDATING_HOLD_MS, 120000);
    withHome((home) => assert.equal(updatingFile(home), join(dirname(settingsFile(home)), "updating.json")));
  });

  it("a marker is live for two minutes after it was written, and no longer", () => {
    withHome((home) => {
      const now = Date.parse("2026-11-12T10:00:00.000Z");
      assert.equal(markUpdating({ home, now }), true);
      const file = updatingFile(home);
      assert.equal(Math.round(statSync(file).mtimeMs), now);
      assert.equal(readFileSync(file, "utf8"), `{"version":1,"at":"2026-11-12T10:00:00.000Z"}\n`);
      // Only the marker is left in the support folder: its temp file was renamed into place.
      assert.deepEqual(readdirSync(dirname(file)), ["updating.json"]);
      assert.equal(updatingWhy({ home, now }), UPDATING);
      assert.equal(updatingWhy({ home, now: now + 119000 }), UPDATING);
      assert.equal(updatingWhy({ home, now: now + 121000 }), "");
    });
  });

  it("no marker is not live, and a marker from the far future is not live", () => {
    withHome((home) => {
      const now = Date.parse("2026-11-12T10:00:00.000Z");
      assert.equal(updatingWhy({ home, now }), "");
      assert.equal(markUpdating({ home, now: now + 121000 }), true);
      assert.equal(updatingWhy({ home, now }), "");
      // A marker a little ahead of this Mac's clock is still live.
      assert.equal(markUpdating({ home, now: now + 119000 }), true);
      assert.equal(updatingWhy({ home, now }), UPDATING);
    });
    withHome((home) => {
      // A support folder that is a file holds no marker.
      mkdirSync(join(home, "Library", "Application Support"), { recursive: true });
      writeFileSync(dirname(updatingFile(home)), "x");
      assert.equal(updatingWhy({ home, now: Date.now() }), "");
      assert.equal(markUpdating({ home, now: Date.now() }), false);
    });
  });

  it("a marker that cannot be looked at is not told", { skip: process.getuid?.() === 0 ? "root can read it" : false }, () => {
    withHome((home) => {
      const now = Date.now();
      assert.equal(markUpdating({ home, now }), true);
      const support = dirname(updatingFile(home));
      chmodSync(support, 0o000);
      try {
        assert.equal(updatingWhy({ home, now }), UPDATING_UNTOLD);
        assert.equal(markUpdating({ home, now }), false);
      } finally {
        chmodSync(support, 0o755);
      }
    });
  });

  it("the marker is live by its time, whatever its text", () => {
    withHome((home) => {
      const now = Date.parse("2026-11-12T10:00:00.000Z");
      const file = updatingFile(home);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "x");
      utimesSync(file, new Date(now), new Date(now));
      assert.equal(updatingWhy({ home, now }), UPDATING);
    });
  });

  it("taking the marker away asks for a look, and never throws", () => {
    withHome((home) => {
      const now = Date.now();
      assert.equal(markUpdating({ home, now }), true);
      let kicks = 0;
      endUpdating({ home, kick: () => kicks++ });
      assert.equal(kicks, 1);
      assert.equal(existsSync(updatingFile(home)), false);
      assert.equal(updatingWhy({ home, now }), "");
      endUpdating({
        home,
        kick: () => {
          throw new Error("the job could not be asked");
        },
      });
      endUpdating({ home });
    });
  });
});

describe("node busy.js updating", () => {
  const ask = (home, words) => spawnSync(process.execPath, [BUSY, ...words], { env: { PATH: "/usr/bin:/bin", HOME: home, BRIMM_VIDEO_HOME: home, TMPDIR: tempOf(home) }, encoding: "utf8" });

  it("the command line marks and unmarks", () => {
    withHome((home) => {
      const begun = ask(home, ["updating", "begin"]);
      assert.deepEqual([begun.status, begun.stdout, begun.stderr], [0, "", ""]);
      assert.equal(existsSync(updatingFile(home)), true);
      assert.equal(updatingWhy({ home, now: Date.now() }), UPDATING);
      const ended = ask(home, ["updating", "end"]);
      assert.deepEqual([ended.status, ended.stdout, ended.stderr], [0, "", ""]);
      assert.equal(existsSync(updatingFile(home)), false);
      for (const bad of [["updating"], ["updating", "stop"], ["idle-why", "x"], ["updating", "begin", "x"], []]) {
        const ran = ask(home, bad);
        assert.deepEqual([ran.status, ran.stdout, ran.stderr], [2, "", `${USAGE}\n`], bad.join(" "));
      }
    });
  });

  it("says so and ends 1 when the update could not be marked", () => {
    withHome((home) => {
      mkdirSync(join(home, "Library", "Application Support"), { recursive: true });
      writeFileSync(dirname(updatingFile(home)), "x");
      const begun = ask(home, ["updating", "begin"]);
      assert.deepEqual([begun.status, begun.stdout], [1, "The update could not be marked on this Mac.\n"]);
    });
  });
});

describe("busy-updating.test.js itself", () => {
  it("no test asks this Mac's job to look", () => {
    // The word is built here so that this line does not name it.
    const word = "--" + "look";
    const quoted = [`"${word}"`, `'${word}'`, `\`${word}\``];
    const found = [];
    for (const name of readdirSync(TESTS, { recursive: true })) {
      const file = join(TESTS, name);
      if (!statSync(file).isFile()) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if ((line.includes("busy.js") || line.includes("BUSY")) && quoted.some((q) => line.includes(q))) found.push(`${name}: ${line.trim()}`);
      }
    }
    assert.deepEqual(found, []);
  });

  it("gives every run of the command a TMPDIR and a home of its own", () => {
    const text = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const spawns = text.split("\n").filter((line) => line.includes("spawnSync(") && line.includes("BUSY") && !(line.includes("TMPDIR:") && line.includes("BRIMM_VIDEO_HOME:")));
    assert.deepEqual(spawns, []);
  });
});
