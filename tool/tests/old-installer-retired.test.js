// The old installer, Move to Studio, was retired in Phase 8: BRIMM Video Studio.app sets a Mac up in its place. This checks that its
// folder and its tests are gone, and that no file of tool/ but this one still names it. The files are the ones git has or would add,
// never a walk of the disk, and a .env file is passed over before it is opened: no test reads one. What may still name it is in ALLOWED,
// each with its reason; nothing is added to make this pass.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** tool/, the folder this test's folder is in. */
const TOOL = fileURLToPath(new URL("..", import.meta.url));
/** This test's own path from tool/: it names the old installer to look for it. */
const SELF = "tests/old-installer-retired.test.js";
/** The old installer's folder, its name and its script. */
const NAMES = /move-app|Move to Studio|move\.zsh/;
/** A .env file, by its path, which is passed over before it is opened. */
const ENV = /(^|\/)\.env(\.|$)/;

/** [file relative to tool/, why it may still name the old installer]. */
const ALLOWED = [];

/** The files of tool/ that git has or would add, as paths from tool/, that are on the disk. */
function toolFiles() {
  const listed = spawnSync("git", ["-C", TOOL, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  return listed.stdout.split("\0").filter((p) => p && !ENV.test(p) && existsSync(join(TOOL, p)));
}

describe("the old installer is retired", () => {
  it("the old installer and its tests are gone", () => {
    assert.equal(existsSync(join(TOOL, "move-app")), false, "tool/move-app is still there");
    assert.deepEqual(readdirSync(join(TOOL, "tests")).filter((name) => name.startsWith("move-app-")), []);
  });

  it("nothing in tool/ names the old installer", () => {
    const found = [];
    for (const file of toolFiles()) {
      if (file === SELF || ALLOWED.some(([allowed]) => allowed === file)) continue;
      readFileSync(join(TOOL, file), "utf8").split("\n").forEach((text, i) => {
        if (NAMES.test(text)) found.push(`${file}:${i + 1}: ${text.trim().slice(0, 110)}`);
      });
    }
    assert.deepEqual(found, []);
  });
});
