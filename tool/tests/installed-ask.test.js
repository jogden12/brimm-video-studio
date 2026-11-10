// The sweep (10 November 2026): the lines that send a person to Jason, as an installed Mac says them. An installed Mac has no Jason at hand,
// no install.sh and no Terminal, so such a line names the support contact its build.json names, or ends before those words where it names
// none (build.js saidHere and askWords). A checkout says every line as it always did. Every Mac here is made up in a temp home, and no
// program is real.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { editMain } from "../edit.js";
import { setup, episodeFor, FOLDER } from "./episodes.js";

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
