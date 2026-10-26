// The one check of her folder's lock (loosened.js), which `behind` makes and, under the open lock, the guard too (design 2026-10-26,
// section 6, "One check of the lock, made by both"). PR #40's own tests of it are tests/edit-show.test.js's, through `behind`; these
// call it as the module it now is. Each test has a home of its own, and managed folders of its own, so this Mac's are never read.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStudio } from "../studio.js";
import { LOCK_CHANGED, lockLoosened } from "../loosened.js";
import { LOCK_CHANGED as SAID_BY_EDIT } from "../edit.js";

describe("the lock check, in loosened.js", () => {
  it("is the check behind makes: a settings.local.json in her folder gives PR #40's line, and nothing loosened gives none", () => {
    const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-loosened-")));
    const home = join(dir, "home");
    const checkout = join(dir, "checkout");
    mkdirSync(home, { recursive: true });
    const folder = writeStudio(home, { checkout, node: "/opt/homebrew/bin/node" });
    const deps = { cwd: folder, env: {}, managedDir: join(dir, "managed"), managedPrefs: join(dir, "managed-preferences"), user: "sallie" };
    assert.deepEqual(lockLoosened({ home, checkout, deps }), []);
    writeFileSync(join(folder, ".claude", "settings.local.json"), "{}");
    assert.deepEqual(lockLoosened({ home, checkout, deps }), ["(Jason: her folder has a .claude/settings.local.json of its own, which can loosen the lock. Its contents are not shown here.)"]);
    assert.equal(LOCK_CHANGED, "This folder's lock is changed on this Mac: ask Jason before going on.");
    assert.equal(SAID_BY_EDIT, LOCK_CHANGED);
    rmSync(dir, { recursive: true, force: true });
  });
});
