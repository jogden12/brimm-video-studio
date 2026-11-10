// The sweep (10 November 2026): the lines that send a person to Jason, as an installed Mac says them. An installed Mac has no Jason at hand,
// no install.sh and no Terminal, so such a line names the support contact its build.json names, or ends before those words where it names
// none (build.js saidHere and askWords). A checkout says every line as it always did. Every Mac here is made up in a temp home, and no
// program is real.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { NEWEST_VERSION, recordFile } from "../episode.js";
import { setup, episodeFor, FOLDER, ID } from "./episodes.js";

const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const UNNAMED = { ...INSTALLED, support: "" };
const DEV = { mode: "dev" };
/** What no line of an installed Mac holds. */
const NEVER = /Jason|install\.sh|Terminal|\bnode\b/;

/** A command on the made-up Mac `t`, whose BRIMM Video Studio is `build`. */
async function on(t, build, argv, more = {}) {
  const said = [];
  const code = await editMain(argv, { ...t.ctx.deps, build, ...more, say: (line) => said.push(line) });
  return { code, said };
}
/** The same command on a checkout, on an installed Mac with a support contact, and on one with none: what each says. */
async function thrice(argv, { before = () => {}, more = () => ({}) } = {}) {
  const out = [];
  for (const build of [DEV, INSTALLED, UNNAMED]) {
    const t = setup();
    const made = before(t) || {};
    out.push((await on(t, build, argv, more(t, made))).said);
    t.done();
  }
  for (const line of [...out[1], ...out[2]]) assert.doesNotMatch(line, NEVER, line);
  return out;
}

describe("a command's refusal, on an installed Mac", () => {
  it("names the support contact for a Mac that is not set up for HyperFrames (edit.js refuse)", async () => {
    const [dev, installed, unnamed] = await thrice(["app", FOLDER], { before: (t) => episodeFor(t) });
    assert.deepEqual(dev, ["This Mac isn't set up for HyperFrames yet: ask Jason."]);
    assert.deepEqual(installed, ["This Mac isn't set up for HyperFrames yet: ask help@example.invalid."]);
    assert.deepEqual(unnamed, ["This Mac isn't set up for HyperFrames yet."]);
  });

  it("names the support contact where there is no reference folder (references.js refuse)", async () => {
    const [dev, installed, unnamed] = await thrice(["refs"]);
    assert.deepEqual(dev, ["There's no reference folder on this Mac yet: ask Jason."]);
    assert.deepEqual(installed, ["There's no reference folder on this Mac yet: ask help@example.invalid."]);
    assert.deepEqual(unnamed, ["There's no reference folder on this Mac yet."]);
  });
});

describe("what is said of an episode, on an installed Mac", () => {
  it("says an episode a newer BRIMM Video Studio wrote is for an update, in the list of episodes", async () => {
    const before = (t) => {
      const found = episodeFor(t);
      writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
    };
    const [dev, installed, unnamed] = await thrice(["episodes"], { before });
    assert.equal(dev[1], "  An episode a newer BRIMM Video Studio wrote (3fa9c1): Jason updates this Mac before it is changed here.");
    assert.equal(installed[1], '  An episode a newer BRIMM Video Studio wrote (3fa9c1). Say "update Studio" to update this Mac.');
    assert.equal(unnamed[1], installed[1]);
  });

  it("names the support contact for an episode whose record cannot be read, in the list and when it is asked for", async () => {
    const before = (t) => writeFileSync(join(t.root, "Episodes", FOLDER), "not a folder");
    for (const [argv, at] of [[["episodes"], 1], [["show", FOLDER, "transcript"], 0]]) {
      const [dev, installed, unnamed] = await thrice(argv, { before });
      assert.equal(dev[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read: ask Jason.");
      assert.equal(installed[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read: ask help@example.invalid.");
      assert.equal(unnamed[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read.");
    }
  });
});
