// The one check of her folder's lock (loosened.js), which `behind` makes and, under the open lock, the guard too (design 2026-10-26,
// section 6, "One check of the lock, made by both"). PR #40's own tests of it are tests/edit-show.test.js's, through `behind`; these
// call it as the module it now is. Each test has a home of its own, and managed folders of its own, so this Mac's are never read.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeStudio } from "../studio.js";
import { LOCK_CHANGED, listeners, lockLoosened } from "../loosened.js";
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
  it("asks lsof what listens on a port, with LC_ALL=C alone, and takes only a clean answer", () => {
    // `spawn` stands in for spawnSync: no test runs lsof.
    const calls = [];
    const listening = "node    4242 sallie   21u  IPv4 0x1      0t0  TCP 127.0.0.1:47123 (LISTEN)\n";
    assert.equal(listeners(47123, (...args) => (calls.push(args), { status: 0, stdout: listening, stderr: "" })), listening);
    assert.deepEqual(calls, [["/usr/sbin/lsof", ["-nP", "-iTCP:47123", "-sTCP:LISTEN"], { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 }]]);
    // Nothing listens: lsof ends with 1 and says nothing.
    assert.equal(listeners(47123, () => ({ status: 1, stdout: "", stderr: "" })), "");
    // Ending with 1 with a warning, or anything else, is not known.
    assert.equal(listeners(47123, () => ({ status: 1, stdout: "", stderr: "lsof: WARNING: can't stat() nfs file system /Volumes/x\n" })), null);
    assert.equal(listeners(47123, () => ({ status: 1, stdout: listening, stderr: "" })), null);
    assert.equal(listeners(47123, () => ({ status: 2, stdout: "", stderr: "" })), null);
    // Not run, refused, or stopped at its timeout.
    assert.equal(listeners(47123, () => ({ error: Object.assign(new Error("spawnSync /usr/sbin/lsof ENOENT"), { code: "ENOENT" }), status: null, stdout: null, stderr: null })), null);
    assert.equal(listeners(47123, () => ({ error: Object.assign(new Error("spawnSync /usr/sbin/lsof ETIMEDOUT"), { code: "ETIMEDOUT" }), status: null, signal: "SIGTERM", stdout: "", stderr: "" })), null);
    assert.equal(listeners(47123, () => { throw Object.assign(new Error("EPERM"), { code: "EPERM" }); }), null);
  });
});
