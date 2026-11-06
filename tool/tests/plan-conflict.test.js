// A conflicted plan is not a dead end (the final review, fix 2). Once Sallie's laptop runs Studio, both Macs write a plan's record (`set`, `agreed`,
// the open of a HeyGen project, the join), and Dropbox keeps a conflicted copy when they write one at once. The guide says "sort out the conflict"
// for it, so `resolve` must run for a plan, as it does for a video: it shows both sides, she keeps one, and the plan goes on. Nothing here runs a
// real program: the programs are stand-ins (tests/episodes.js), and each test has a folder of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { conflictedCopies, readEpisode, recordFile, recordText } from "../episode.js";
import { fileSafe } from "../names.js";
import { localDay } from "../shared/text.js";
import { setup } from "./episodes.js";
import { planFilesFrom } from "../plan.js";

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
    assert.deepEqual([kept.code, kept.text], [0, "Kept B. The plan's files are written from it. The other is set aside in history/."], kept.text);
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

/** The same, with the record's two sides made by `change` (each a function of the plan's record, giving its own). */
async function conflictedBy(t, a, b) {
  assert.equal((await on(depsOf(t), "plan", "new", TITLE)).code, 0);
  assert.equal((await on(depsOf(t), "plan", TITLE, "set", ...SHOT, "--line", "The first line.", "--line", "The second line.")).code, 0);
  const folder = join(t.root, "Episodes", nameOf(t));
  const first = readEpisode(folder).record;
  const side = (change, on) => ({ ...change(first), rev: 3, writer: { commit: "c709b57", on } });
  writeFileSync(recordFile(folder, 3), recordText(side(a, "Mac Studio")));
  writeFileSync(join(folder, "record", COPY), recordText(side(b, "Sallie's laptop")));
  return folder;
}
const withPlanned = (more) => (r) => ({ ...r, planned: { ...r.planned, ...more } });
const filesNow = (folder) => Object.fromEntries(["video guide.md", "shot list.md", "teleprompter.txt"].map((n) => [n, readFileSync(join(folder, n), "utf8")]));

describe("resolve, for a plan: plain lines and the plan's files", () => {
  it("says a differing teleprompter line as two quoted lines, the lines that differ only, shortened to 120 characters, and no braces", async () => {
    const t = setup();
    const long = "x".repeat(300);
    const folder = await conflictedBy(t, withPlanned({ lines: ["The first line.", "Second, mine."] }), withPlanned({ lines: ["The first line.", long] }));
    const r = await on(depsOf(t), "resolve", TITLE);
    assert.equal(r.code, 0, r.text);
    const at = r.said.indexOf("The script is different:");
    assert.ok(at > 0, r.text);
    assert.equal(r.said[at + 1], 'A: "Second, mine."', r.text);
    assert.equal(r.said[at + 2], `B: "${"x".repeat(119)}…"`, r.text);
    assert.ok(!r.text.includes("The first line."), r.text);
    assert.ok(!/[{}]/.test(r.text), r.text);
    assert.ok(folder);
    t.done();
  });
  it("says a difference of the cues, of the shots and of the title as one plain line each", async () => {
    const t = setup();
    const cue = { n: 1, kind: "graphic", seconds: 4, words: "x", show: "y", style: null };
    const one = { n: 1, kind: "talking", what: "Open." };
    const folder = await conflictedBy(t, (r) => ({ ...r, planned: { ...r.planned, title: "Title A", cues: [cue], shots: [one] } }), (r) => ({ ...r, planned: { ...r.planned, title: "Title B", cues: [cue, { ...cue, n: 2 }], shots: [one, { ...one, n: 2 }, { ...one, n: 3 }] } }));
    const r = await on(depsOf(t), "resolve", folder.split("/").pop());
    assert.equal(r.code, 0, r.text);
    for (const line of ["The graphic cues are different: A has 1, B has 2.", "The shots are different: A has 1, B has 3.", 'The title is different: A says "Title A", B says "Title B".']) assert.ok(r.said.some((s) => s.trim() === line), `${line}\n${r.text}`);
    assert.ok(!/[{}]/.test(r.text), r.text);
    t.done();
  });
  it("after --keep B the plan's files are what planFilesFrom(B) makes, the record lists their sizes, and episodes says nothing wrong", async () => {
    const t = setup();
    const folder = await conflictedBy(t, withPlanned({ lines: ["The first line.", "Mine."] }), withPlanned({ lines: ["The first line.", "Hers, a longer line."] }));
    await on(depsOf(t), "resolve", nameOf(t));
    const kept = await on(depsOf(t), "resolve", nameOf(t), "--keep", "B");
    assert.deepEqual([kept.code, kept.text], [0, "Kept B. The plan's files are written from it. The other is set aside in history/."], kept.text);
    const record = readEpisode(folder).record;
    const want = planFilesFrom(record);
    assert.deepEqual(filesNow(folder), want);
    assert.ok(want["teleprompter.txt"].includes("Hers, a longer line."));
    for (const [name, text] of Object.entries(want)) assert.equal(record.files[name], Buffer.byteLength(text));
    const listed = await on(light(t), "episodes");
    assert.equal(listed.code, 0, listed.text);
    assert.ok(listed.text.includes(TITLE), listed.text);
    assert.ok(!/not right|not as the record|is short|is missing|not the \d+ the record/i.test(listed.text), listed.text);
    t.done();
  });
  it("--keep A leaves the files that already match A as they are, with no write", async () => {
    const t = setup();
    const folder = await conflictedBy(t, (r) => r, withPlanned({ lines: ["The first line.", "Hers."] }));
    const before = ["video guide.md", "shot list.md", "teleprompter.txt"].map((n) => statSync(join(folder, n)).ino);
    await on(depsOf(t), "resolve", nameOf(t));
    const kept = await on(depsOf(t), "resolve", nameOf(t), "--keep", "A");
    assert.equal(kept.code, 0, kept.text);
    assert.deepEqual(["video guide.md", "shot list.md", "teleprompter.txt"].map((n) => statSync(join(folder, n)).ino), before);
    assert.deepEqual(filesNow(folder), planFilesFrom(readEpisode(folder).record));
    t.done();
  });
  it("a refused record write leaves the files as they were", async () => {
    const t = setup();
    const folder = await conflictedBy(t, withPlanned({ lines: ["The first line.", "Mine."] }), withPlanned({ lines: ["The first line.", "Hers, a longer line."] }));
    await on(depsOf(t), "resolve", nameOf(t));
    const before = filesNow(folder);
    // The other Mac writes record 4 while the copy is being set aside: the record write is refused.
    const deps = depsOf(t);
    const clone = deps.clone;
    deps.clone = (from, to) => {
      clone(from, to);
      if (to.includes("/history/") && !existsSync(recordFile(folder, 4))) writeFileSync(recordFile(folder, 4), recordText({ ...readEpisode(folder, { pastCopies: true }).record, rev: 4 }));
    };
    const r = await on(deps, "resolve", nameOf(t), "--keep", "B");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /^Nothing was written, and nothing deleted: /);
    assert.deepEqual(filesNow(folder), before);
    t.done();
  });
  it("says so plainly when the files cannot be put back after a refused record write, and never claims nothing was written", async () => {
    const t = setup();
    const folder = await conflictedBy(t, withPlanned({ lines: ["The first line.", "Mine."] }), withPlanned({ lines: ["The first line.", "Hers, a longer line."] }));
    await on(depsOf(t), "resolve", nameOf(t));
    const deps = depsOf(t);
    const clone = deps.clone;
    let puts = 0;
    deps.clone = (from, to) => {
      // Every put-back of the teleprompter script is refused: only the first clone into it (the keep's own write) goes through.
      if (to.includes("teleprompter.txt") && ++puts >= 2) throw new Error("the disk said no");
      clone(from, to);
      if (to.includes("/history/") && !existsSync(recordFile(folder, 4))) writeFileSync(recordFile(folder, 4), recordText({ ...readEpisode(folder, { pastCopies: true }).record, rev: 4 }));
    };
    const r = await on(deps, "resolve", nameOf(t), "--keep", "B");
    assert.equal(r.code, 1, r.text);
    assert.ok(!r.text.includes("Nothing was written"), r.text);
    assert.match(r.text, /^The record was not changed \(.*\), but the plan's files may not match it: teleprompter\.txt\. The next "episodes" names any that is wrong\. Say "sort out the conflict" again to put them right; if it still says a file is not whole, ask Jason/, r.text);
    t.done();
  });
});
