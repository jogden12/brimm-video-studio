// `resolve` of a record that two Macs wrote (Phase 3, the local working folder; L4). The rows say where each side keeps the episode's files in plain words (`Kept on: A: the
// Mac Studio; B: Jason's MacBook`, never raw JSON). Keeping a side whose `local` differs from the other's (another Mac, or none) is refused with "A conflict needs Jason" when
// either side lists a file kept on a Mac, since the files of the other side would be left behind; and for a plan, whose parts are kept on the Mac its record names, keeping the
// side that names the other Mac is refused too. Sides that keep the files in one place are kept as before.
// Nothing here touches Dropbox: the root is made for each test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { layoutOf, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { episodeFilesFolder } from "../settings.js";
import { setup, listAll } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
const STUDIO = "Mac Studio";
const MACBOOK = "Jason's MacBook";
const FOLDER = "2026-10-20 Pricing talk (Mac Studio)";
const COPY = "record/0002 (Jason's MacBook's conflicted copy 2026-10-20).json";
const WRITER = { commit: "c709b57", on: STUDIO };
const NEEDS_JASON = "A conflict needs Jason: tell him the episode's name.";

/** An episode whose record 2 was written on both Macs: A (in force) keeps `a` as its `local` and B (the copy) keeps `b`; each as `base` says. */
function conflict(t, { a, b, plan = false }) {
  const folder = join(t.root, "Episodes", FOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const first = plan
    ? { ...newPlannedEpisode({ id: "e-20261020-cccccc", machine: STUDIO, at: "2026-10-20T07:00:00-05:00", title: "Too many SKUs", route: "script", voice: null, writer: WRITER }), rev: 1 }
    : newEpisode({ id: "e-20261020-3fa9c1", machine: STUDIO, at: "2026-10-20T09:00:00-05:00", video: { file: "IMG_0042.mov", bytes: 13, seconds: 42, created: null }, kind: "raw", writer: WRITER, files: { "IMG_0042.mov": 13 }, answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: STUDIO, at: "2026-10-20T09:30:00-05:00", private: "no" } });
  const side = (local, who, name) => {
    const next = { ...first, rev: 2, name: { text: name, placeholder: false }, writer: { commit: "c709b57", on: who }, ...(local ? { local: { on: local } } : {}) };
    return recordText({ ...next, version: layoutOf(next) });
  };
  // The recording is where the record in force keeps it, on this Mac or in Dropbox.
  if (!plan) {
    const own = episodeFilesFolder(t.home, FOLDER);
    mkdirSync(own, { recursive: true });
    writeFileSync(join(own, "IMG_0042.mov"), "the recording");
    writeFileSync(join(folder, "IMG_0042.mov"), "the recording");
  }
  writeFileSync(recordFile(folder, 1), recordText({ ...first, rev: 1, version: layoutOf(first) }));
  writeFileSync(recordFile(folder, 2), side(a, STUDIO, "Test A"));
  writeFileSync(join(folder, COPY), side(b, MACBOOK, "Test B"));
  return folder;
}
const snapshot = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));
async function keep(deps, side) {
  await on(deps, "resolve", FOLDER);
  return on(deps, "resolve", FOLDER, "--keep", side);
}

describe("resolve, a record whose sides keep the files in different places", () => {
  it("says where each side is kept in plain words", async () => {
    const t = setup();
    conflict(t, { a: STUDIO, b: MACBOOK });
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes(`  Kept on: A: the Mac Studio; B: ${MACBOOK}`), r.text);
    assert.doesNotMatch(r.text, /"on"|\{/);
    t.done();
  });
  it("says Dropbox for a side that keeps its files there", async () => {
    const t = setup();
    conflict(t, { a: STUDIO, b: null });
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.ok(r.text.includes("  Kept on: A: the Mac Studio; B: Dropbox"), r.text);
    t.done();
  });
  it("refuses to keep either side when they keep the files on different Macs, writing nothing", async () => {
    for (const side of ["A", "B"]) {
      const t = setup();
      conflict(t, { a: STUDIO, b: MACBOOK });
      const r = await keep(t.ctx.deps, side);
      const before = snapshot(t);
      assert.equal(r.code, 1, side);
      assert.ok(r.text.endsWith(NEEDS_JASON), r.text);
      assert.deepEqual(snapshot(t), before);
      assert.equal(existsSync(join(t.root, "Episodes", FOLDER, "history")), false);
      assert.equal(readEpisode(join(t.root, "Episodes", FOLDER), { pastCopies: true }).record.rev, 2);
      t.done();
    }
  });
  it("refuses to keep either side when one keeps the files on a Mac and the other in Dropbox", async () => {
    for (const [a, b] of [[STUDIO, null], [null, STUDIO]]) {
      for (const side of ["A", "B"]) {
        const t = setup();
        conflict(t, { a, b });
        const r = await keep(t.ctx.deps, side);
        assert.equal(r.code, 1, `${a} ${b} ${side}`);
        assert.ok(r.text.endsWith(NEEDS_JASON), r.text);
        t.done();
      }
    }
  });
  it("keeps a side as before when both keep the files on one Mac", async () => {
    const t = setup();
    const folder = conflict(t, { a: STUDIO, b: STUDIO });
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 0, r.text);
    assert.equal(readEpisode(folder).record.name.text, "Test B");
    t.done();
  });
  it("keeps a side when both are on one Mac and only one has the recording's original noted (local.original)", async () => {
    const t = setup();
    const folder = conflict(t, { a: STUDIO, b: STUDIO });
    const copy = join(folder, COPY);
    const b = JSON.parse(readFileSync(copy, "utf8"));
    writeFileSync(copy, recordText({ ...b, local: { on: STUDIO, original: { file: "IMG_0042.mov", bytes: 13, mtimeMs: 1 } } }));
    const r = await keep(t.ctx.deps, "A");
    assert.equal(r.code, 0, r.text);
    t.done();
  });
  it("keeps a side as before when neither keeps its files on a Mac", async () => {
    const t = setup();
    const folder = conflict(t, { a: null, b: null });
    const r = await keep(t.ctx.deps, "A");
    assert.equal(r.code, 0, r.text);
    assert.equal(readEpisode(folder).record.name.text, "Test A");
    t.done();
  });
  it("keeps either side of a plan that two Macs marked as filmed on different Macs when it has no part yet: it lists no file of its own on a Mac, and the side kept says where it is filmed", async () => {
    for (const [side, on] of [["A", STUDIO], ["B", MACBOOK]]) {
      const t = setup();
      const folder = conflict(t, { a: STUDIO, b: MACBOOK, plan: true });
      const r = await keep(t.ctx.deps, side);
      assert.equal(r.code, 0, `${side}: ${r.text}`);
      assert.equal(readEpisode(folder).record.local.on, on);
      t.done();
    }
  });
  it("refuses to keep the side of a plan that says another Mac than the one its part is kept on, whose footage would be left behind, and keeps the side that says the part's Mac", async () => {
    for (const [side, ok] of [["A", true], ["B", false]]) {
      const t = setup();
      const folder = conflict(t, { a: STUDIO, b: MACBOOK, plan: true });
      part(t, "e-20261020-cccccc", STUDIO);
      const r = await keep(t.ctx.deps, side);
      assert.equal(r.code, ok ? 0 : 1, `${side}: ${r.text}`);
      if (!ok) {
        assert.ok(r.text.endsWith(NEEDS_JASON), r.text);
        assert.equal(readEpisode(folder, { pastCopies: true }).record.rev, 2);
        assert.deepEqual(readdirSync(join(folder, "record")).filter((n) => n.startsWith("0003")), []);
      } else assert.equal(readEpisode(folder).record.local.on, STUDIO);
      t.done();
    }
  });
  it("refuses to keep the side of a plan that says no Mac when its part is kept on one", async () => {
    const t = setup();
    conflict(t, { a: STUDIO, b: null, plan: true });
    part(t, "e-20261020-cccccc", STUDIO);
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1, r.text);
    assert.ok(r.text.endsWith(NEEDS_JASON), r.text);
    t.done();
  });
});

/** A dropped video answered as footage for the plan `of`, kept on `on`. */
function part(t, of, on) {
  const folder = join(t.root, "Episodes", "2026-11-04 Drop 1 (Mac Studio)");
  mkdirSync(join(folder, "record"), { recursive: true });
  const made = newEpisode({
    id: "e-20261104-a11111", machine: STUDIO, at: "2026-11-04T09:00:00-05:00", video: { file: "Take 1.mov", bytes: 5, seconds: 60, created: null, sound: false }, kind: null, writer: WRITER, files: { "Take 1.mov": 5 },
    label: "Video of 4 Nov, 01:00 (Mac Studio)", answer: { state: "part", guess: null, seen: "wide, 1:00", came: "camera", match: null, by: STUDIO, on: STUDIO, at: "2026-11-04T09:30:00-05:00", private: "no" }, local: { on }
  });
  const next = { ...made, rev: 1, partOf: { id: of, as: "b-roll", shot: 2, client: false } };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next) }));
}
