// A plan is filmed on one Mac (Phase 3, the local working folder; L4; the ruling for L4). A planned record with no footage is on no Mac. The first `footage` answer
// for it on a Mac with a drop folder of its own writes two records: the plan's first, adding `local: { on: <this Mac> }` (layout 6, still a plan), then the part's. A
// run stopped between them leaves a plan marked local with no part, which is harmless: the answer is said again. A video answered as footage on another Mac for a
// plan already on this one is refused and nothing is written, and that Mac's planned card never offers the plan. `footage … voiceover` and `plan … voice` there say
// the one line of an episode kept on another Mac. A plan whose footage began before the switch has no `local` and goes the old way.
// Nothing here runs a real program or touches Dropbox: each test has a root and homes of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { isPlannedRecord, readEpisode, recordFile, recordText } from "../episode.js";
import { ON_OTHER_MAC } from "../where.js";
import { footageCards, plannedOffers } from "../footage.js";
import { setup, episodeAs, reread, listAll } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const STUDIO = "Mac Studio";
const MACBOOK = "Jason's MacBook";
const TITLE = "Too many SKUs";
const SHOTS = ["--shot", "talking | Open on the problem, to the camera.", "--shot", "b-roll | Sallie at her desk sorting invoices.", "--line", "Too many SKUs will sink a small shop."];
const labelOf = (n) => `Video of 4 Nov, 0${n}:00 (Mac Studio)`;
const WAITING = { state: "needs your answer", guess: "raw", seen: "wide, 0:20, no retakes", came: "camera", match: null };

/** The Mac Studio (a drop folder of its own) and Jason's MacBook (a drop folder in Dropbox), on one root. */
function world() {
  const t = setup();
  const studio = { ...t.ctx.deps, rand: () => 0.25, settings: { ...t.ctx.settings, import: "light", handoffVersion: 2, drop: "Drop", dropPath: join(t.home, "BRIMM Video Work", "Drop") } };
  const macbookHome = join(t.dir, "home-macbook");
  mkdirSync(macbookHome, { recursive: true });
  const macbook = { ...t.ctx.deps, home: macbookHome, rand: () => 0.25, settings: { version: 1, machine: MACBOOK, root: t.root, checkout: "/checkout", import: "light", handoffVersion: 2, drop: "Drop" } };
  return { t, studio, macbook };
}
/** A video waiting for her answer, number `n`. */
const video = (t, n) => episodeAs(t, { id: `e-20261104-a${String(n).repeat(5)}`, name: `2026-11-04 Drop ${n} (Mac Studio)`, record: { version: 3, kind: null, label: labelOf(n), answer: WAITING } });
/** A plan made on the Mac Studio, its package set; `local` is what its record says of where it is filmed. */
async function plan(w, { title = TITLE, local = null, route = "script" } = {}) {
  const r = await on(w.studio, "plan", "new", title, ...(route === "explainer" ? ["--explainer"] : []));
  assert.equal(r.code, 0, r.text);
  const s = await on(w.studio, "plan", title, "set", ...(route === "explainer" ? ["--line", "Why SKUs sink you."] : SHOTS));
  assert.equal(s.code, 0, s.text);
  const folder = join(w.t.root, "Episodes", listAll(join(w.t.root, "Episodes")).find((rel) => rel.endsWith("record/0001.json") && rel.includes("Too many")).split("/")[0]);
  const record = readEpisode(folder).record;
  if (local) writeFileSync(recordFile(folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, version: 6, local }));
  return { folder, id: record.id };
}
const planNow = (p) => readEpisode(p.folder).record;

describe("footage, on a Mac with a drop folder of its own", () => {
  it("writes the plan's record first, adding local.on, and then the part's; the plan is still a plan, at layout 6", async () => {
    const w = world();
    const p = await plan(w);
    const found = video(w.t, 1);
    const before = w.t.clones.length;
    const r = await on(w.studio, "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.equal(r.code, 0, r.text);
    const now = planNow(p);
    assert.deepEqual([now.rev, now.version, now.local, isPlannedRecord(now)], [3, 6, { on: STUDIO }, true]);
    assert.equal(reread(found).partOf.id, p.id);
    // The plan's record went in before the part's.
    assert.deepEqual(w.t.clones.slice(before).map(([, to]) => to), [recordFile(p.folder, 3), recordFile(found.folder, 2)]);
    w.t.done();
  });
  it("writes the plan's record once: a second part finds it marked", async () => {
    const w = world();
    const p = await plan(w);
    video(w.t, 1);
    video(w.t, 2);
    assert.equal((await on(w.studio, "footage", labelOf(1), TITLE, "talking", "--client", "no")).code, 0);
    const second = await on(w.studio, "footage", labelOf(2), TITLE, "b-roll", "--client", "no");
    assert.equal(second.code, 0, second.text);
    assert.equal(planNow(p).rev, 3);
    w.t.done();
  });
  it("a footage answer stopped after the plan's record and before the part's: the plan is local and still a plan, and the answer can be said again", async () => {
    const w = world();
    const p = await plan(w);
    const found = video(w.t, 1);
    // The part's record cannot be written: the clone refuses it.
    const clone = w.studio.clone;
    w.studio.clone = (from, to) => {
      if (to === recordFile(found.folder, 2)) throw new Error("the disk is full");
      return clone(from, to);
    };
    const first = await on(w.studio, "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.equal(first.code, 1);
    const now = planNow(p);
    assert.deepEqual([now.local, isPlannedRecord(now), now.planned.filmed], [{ on: STUDIO }, true, null]);
    assert.equal(reread(found).partOf, undefined);
    w.studio.clone = clone;
    const again = await on(w.studio, "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.equal(again.code, 0, again.text);
    assert.equal(reread(found).partOf.id, p.id);
    assert.equal(planNow(p).rev, 3, "the plan is marked once");
    w.t.done();
  });
  it("leaves a plan whose footage began before the switch as it was: no local, the old way", async () => {
    const w = world();
    const p = await plan(w);
    video(w.t, 1);
    video(w.t, 2);
    // The first part was answered on a Mac still on a drop folder in Dropbox.
    assert.equal((await on(w.macbook, "footage", labelOf(1), TITLE, "talking", "--client", "no")).code, 0);
    assert.equal((await on(w.studio, "footage", labelOf(2), TITLE, "b-roll", "--client", "no")).code, 0);
    assert.equal(planNow(p).local, undefined);
    assert.equal(planNow(p).rev, 2);
    w.t.done();
  });
});

describe("footage, for a plan kept on another Mac", () => {
  it("is refused with one line, and nothing is written", async () => {
    const w = world();
    const p = await plan(w, { local: { on: STUDIO } });
    const found = video(w.t, 1);
    const before = Object.fromEntries(listAll(w.t.dir).map((rel) => [rel, readFileSync(join(w.t.dir, rel), "utf8")]));
    const r = await on(w.macbook, "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is filmed on the Mac Studio: drop its footage there. Nothing was changed.`]]);
    assert.deepEqual(Object.fromEntries(listAll(w.t.dir).map((rel) => [rel, readFileSync(join(w.t.dir, rel), "utf8")])), before);
    assert.equal(reread(found).partOf, undefined);
    assert.equal(planNow(p).rev, 3);
    w.t.done();
  });
  it("is not offered on that Mac's planned card, and plannedOffers leaves it out", async () => {
    const w = world();
    const p = await plan(w, { local: { on: STUDIO } });
    const record = planNow(p);
    assert.equal(plannedOffers([record], { picture: true, sound: true, machine: MACBOOK }).length, 0);
    assert.equal(plannedOffers([record], { picture: true, sound: true, machine: STUDIO }).length, 1);
    assert.equal(plannedOffers([record], { picture: true, sound: true }).length, 1);
    const waiting = { ...video(w.t, 1).record };
    assert.deepEqual(footageCards({ record: waiting, label: labelOf(1), records: [record], machine: MACBOOK }), []);
    assert.equal(footageCards({ record: waiting, label: labelOf(1), records: [record], machine: STUDIO }).length, 2);
    w.t.done();
  });
  it("plan … voice for a plan kept on another Mac says the one line of an episode kept there, and starts nothing", async () => {
    const w = world();
    const p = await plan(w, { local: { on: STUDIO } });
    const before = planNow(p).rev;
    const r = await on(w.macbook, "plan", TITLE, "voice");
    assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC(TITLE, STUDIO)]]);
    assert.deepEqual([planNow(p).rev, w.t.started], [before, []]);
    w.t.done();
  });
  it("footage … voiceover for an explainer kept on another Mac says the one line of an episode kept there", async () => {
    const w = world();
    const p = await plan(w, { local: { on: STUDIO }, route: "explainer" });
    const sound = episodeAs(w.t, { id: "e-20261104-a1111b", name: "2026-11-04 Voice (Mac Studio)", record: { version: 3, kind: null, label: labelOf(1), answer: { ...WAITING, seen: "sound only, 0:20", came: "sound" } } });
    const before = planNow(p).rev;
    const r = await on(w.macbook, "footage", labelOf(1), TITLE, "voiceover", "--not-a-session");
    assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC(TITLE, STUDIO)]]);
    assert.equal(planNow(p).rev, before);
    assert.equal(reread(sound).partOf, undefined);
    w.t.done();
  });
});
