// A conflicted plan is not a dead end (the final review, fix 2). Once Sallie's laptop runs Studio, both Macs write a plan's record (`set`, `agreed`,
// the open of a HeyGen project, the join), and Dropbox keeps a conflicted copy when they write one at once. The guide says "sort out the conflict"
// for it, so `resolve` must run for a plan, as it does for a video: it shows both sides, she keeps one, and the plan goes on. Nothing here runs a
// real program: the programs are stand-ins (tests/episodes.js), and each test has a folder of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { conflictedCopies, readEpisode, recordFile, recordText } from "../episode.js";
import { fileSafe } from "../names.js";
import { localDay } from "../shared/text.js";
import { setup } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
const depsOf = (t, over = {}) => ({ ...t.ctx.deps, rand: () => 0.25, ...over });
const light = (t) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } });
const TITLE = "Too many SKUs";
const SHOT = ["--shot", "talking | Open on the problem, to the camera."];
const nameOf = (t) => `${localDay(new Date(t.now()))} ${fileSafe(TITLE)} (Mac Studio)`;
const COPY = "0003 (Sallie's laptop's conflicted copy 2026-11-04).json";

/** A plan whose record both Macs then wrote as record 3: this Mac set one line, Sallie's laptop another. Dropbox kept the laptop's as a conflicted copy. */
async function conflicted(t) {
  assert.equal((await on(depsOf(t), "plan", "new", TITLE)).code, 0);
  assert.equal((await on(depsOf(t), "plan", TITLE, "set", ...SHOT, "--line", "The first line.")).code, 0);
  const folder = join(t.root, "Episodes", nameOf(t));
  const first = readEpisode(folder).record;
  const plan = (lines, on) => ({ ...first, rev: 3, planned: { ...first.planned, lines }, writer: { commit: "c709b57", on } });
  writeFileSync(recordFile(folder, 3), recordText(plan(["Line from the Mac Studio."], "Mac Studio")));
  writeFileSync(join(folder, "record", COPY), recordText(plan(["Line from the laptop."], "Sallie's laptop")));
  return folder;
}

describe("resolve, for a plan", () => {
  it("shows both sides of a plan's record conflict, in plain words, and changes nothing", async () => {
    const t = setup();
    const folder = await conflicted(t);
    const before = readdirSync(join(folder, "record")).sort();
    const r = await on(depsOf(t), "resolve", TITLE);
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said[0].startsWith("Dropbox kept two versions of record/0003.json in "), r.text);
    assert.ok(r.text.includes("A: the record in force (record 3, written on Mac Studio)") && r.text.includes("B: the copy written on Sallie's laptop"), r.text);
    assert.match(r.text, /\nSay which to keep: A or B\.$/);
    assert.ok(!r.text.includes("isn't made from its footage"), r.text);
    assert.deepEqual(readdirSync(join(folder, "record")).sort(), before);
    t.done();
  });
  it("lets her keep the laptop's side, and the plan goes on: it reads, it is changed, and the guide no longer asks to sort out a conflict", async () => {
    const t = setup();
    const folder = await conflicted(t);
    assert.match((await on(light(t), "guide")).text, /sort out the conflict/);
    assert.equal((await on(depsOf(t), "resolve", nameOf(t))).code, 0);
    const kept = await on(depsOf(t), "resolve", nameOf(t), "--keep", "B");
    assert.deepEqual([kept.code, kept.text], [0, "Kept B of record/0003.json. The other is set aside in history/."], kept.text);
    assert.deepEqual(conflictedCopies(folder), []);
    assert.deepEqual(readEpisode(folder).record.planned.lines, ["Line from the laptop."]);
    const shown = await on(depsOf(t), "plan", TITLE);
    assert.equal(shown.code, 0, shown.text);
    assert.doesNotMatch((await on(light(t), "guide")).text, /sort out the conflict/);
    const more = await on(depsOf(t), "plan", TITLE, "set", ...SHOT, "--line", "A line after it.");
    assert.equal(more.code, 0, more.text);
    assert.deepEqual(readEpisode(folder).record.planned.lines, ["A line after it."]);
    t.done();
  });
  it("keeps this Mac's side just the same", async () => {
    const t = setup();
    const folder = await conflicted(t);
    await on(depsOf(t), "resolve", nameOf(t));
    assert.equal((await on(depsOf(t), "resolve", nameOf(t), "--keep", "A")).code, 0);
    assert.deepEqual(readEpisode(folder).record.planned.lines, ["Line from the Mac Studio."]);
    assert.deepEqual(conflictedCopies(folder), []);
    t.done();
  });
  it("refuses to keep a plan over the video it was made into, as it refuses to take back an answer, in words that fit a plan", async () => {
    const t = setup();
    const folder = await conflicted(t);
    // The laptop's copy is the plan made into its video by the join: it has a kind, a video and its plan kept.
    const first = readEpisode(folder, { pastCopies: true }).record;
    const made ={ ...first, rev: 3, kind: "raw", video: { file: "Too many SKUs.mov", bytes: 16, seconds: 120, recorded: "2026-11-04", recordedFrom: "import" }, files: { ...first.files, "Too many SKUs.mov": 16 }, writer: { commit: "c709b57", on: "Sallie's laptop" } };
    writeFileSync(join(folder, "record", COPY), recordText(made));
    await on(depsOf(t), "resolve", nameOf(t));
    const r = await on(depsOf(t), "resolve", nameOf(t), "--keep", "A");
    assert.equal(r.code, 1, r.text);
    assert.equal(r.text, `One side has "${TITLE}" made from its footage: keep that side; a plan is made from its footage once.`);
    assert.equal(conflictedCopies(folder).length, 1, "nothing was kept or deleted");
    t.done();
  });
});
