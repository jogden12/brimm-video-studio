// `update` (Phase 3, Task 6): on an installed Mac it opens the app's own check for updates (Sparkle's window takes over), and in a
// git checkout it says how that Mac is updated and runs nothing. /usr/bin/open is a stand-in that writes its calls down.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { UNSCOPED } from "../gate.js";
import { setup } from "./episodes.js";

const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const CHECKING = "BRIMM Video Studio is checking for updates: its own window takes over from here. Once it has updated and opened again, start a new chat.";
const DEV = "This Mac runs BRIMM Video Studio from a git checkout, so it is not updated from here. Ask Jason to update it when it suits. (Jason: when no import is at work, pull main in the checkout.)";

/** `update` with `words` after it on the made-up Mac `t`, `build` its build, and `answer` what /usr/bin/open gives back. */
async function on(t, build, answer = { code: 0, stderr: "" }, words = []) {
  const said = [];
  const runs = [];
  const limits = [];
  const deps = { ...t.ctx.deps, run: async (cmd, args, asked) => { runs.push([cmd, ...args]); limits.push(asked?.limit); return answer; }, say: (x) => said.push(x) };
  if (build) deps.build = build;
  const code = await editMain(["update", ...words], deps);
  return { code, said, runs, limits };
}

describe("update", () => {
  it("on an installed Mac opens the app's check for updates, and says its window takes over", async () => {
    const t = setup();
    const r = await on(t, INSTALLED);
    assert.deepEqual(r.runs, [["/usr/bin/open", "brimm-video-studio://check-for-updates"]]);
    assert.deepEqual(r.limits, [10000]);
    assert.deepEqual([r.code, r.said], [0, [CHECKING]]);
    t.done();
  });
  it("says how to check by hand when the app cannot be opened", async () => {
    const t = setup();
    const r = await on(t, INSTALLED, { code: 1, stderr: "No application knows how to open URL" });
    assert.deepEqual([r.code, r.said], [1, ["BRIMM Video Studio could not be opened to check for updates. Open it from the Applications folder and choose Check for Updates…. If that does not help, ask help@example.invalid."]]);
    t.done();
  });
  it("says the same when the open ran out of time", async () => {
    const t = setup();
    const r = await on(t, INSTALLED, { code: 0, outOfTime: true });
    assert.deepEqual([r.code, r.said], [1, ["BRIMM Video Studio could not be opened to check for updates. Open it from the Applications folder and choose Check for Updates…. If that does not help, ask help@example.invalid."]]);
    t.done();
  });
  it("ends at the menu item when the build file names no support contact", async () => {
    const t = setup();
    const r = await on(t, { ...INSTALLED, support: "" }, { code: 1, stderr: "" });
    assert.deepEqual([r.code, r.said], [1, ["BRIMM Video Studio could not be opened to check for updates. Open it from the Applications folder and choose Check for Updates…."]]);
    t.done();
  });
  it("in a git checkout says how that Mac is updated, and runs nothing", async () => {
    for (const build of [{ mode: "dev" }, null]) {
      const t = setup();
      const r = await on(t, build);
      assert.deepEqual([r.code, r.said], [0, [DEV]]);
      assert.deepEqual(r.runs, []);
      t.done();
    }
  });
  it("takes no words: any after it change nothing", async () => {
    const t = setup();
    const r = await on(t, INSTALLED, { code: 0, stderr: "" }, ["now", "please"]);
    assert.deepEqual(r.runs, [["/usr/bin/open", "brimm-video-studio://check-for-updates"]]);
    assert.deepEqual([r.code, r.said], [0, [CHECKING]]);
    t.done();
  });
  it("is listed wherever edit.js's commands are", () => {
    assert.ok(COMMAND_NAMES.includes("update"));
    assert.ok(HELP.includes("  node edit.js update "));
    assert.ok(UNSCOPED.includes("update"));
    const row = readFileSync(new URL("../../README.md", import.meta.url), "utf8").split("\n").find((l) => l.startsWith("| `tool/edit.js`"));
    assert.ok(row.includes("`update`"));
  });
});
