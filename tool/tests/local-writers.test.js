// The other writers into final/ of a video kept on this Mac, and the check behind them (Phase 3, L5): the Reels of a finished video, a correction
// (`kind … --again`), `resolve`, the spellings' hand-off of a finished video, and a session's hand-off. Names L5 adds are reached through a namespace import.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { recordFile } from "../episode.js";
import { join } from "node:path";
import * as filing from "../filing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { finishEpisode } from "../edit.js";
import { FOLDER, reread } from "./episodes.js";
import { on, seeing } from "./checking-world.js";
import { exportOf } from "./exports-world.js";
import { finishedWorld, HANDOFF_REL } from "./reels-world.js";
import { agentRun, finalPending, finishRun, localExported, makeLocal } from "./local-world.js";

const THIS = (pid) => pid === process.pid;
const asked = (w, answers) => finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, answers);
/** The made-up finished video with Reels 1 and 2 as projects, kept on this Mac. */
async function localFinished() {
  const w = await finishedWorld({ projects: ["reel 1", "reel 2"] });
  makeLocal(w);
  return w;
}
const handoffPath = (w) => join(w.found.folder, HANDOFF_REL);

describe("the writers into final/ of a video kept on this Mac (L5)", () => {
  it("L7 the Reels of a finished video handed off twice at once are both checked", async () => {
    const w = await localFinished();
    exportOf(w, "reel 2");
    assert.equal(await asked(w, { reels: true, yes: true, without: ["reel 1"] }), 0, w.t.said());
    assert.equal(await finishRun(w), 0, w.t.said());
    exportOf(w, "reel 1");
    assert.equal(await asked(w, { reels: true, yes: true }), 0, w.t.said());
    assert.equal(await finishRun(w), 0, w.t.said());
    const [two, three] = [finalPending(w, 2), finalPending(w, 3)];
    assert.ok(two && three);
    assert.equal(two.entries.some((e) => e.to === handoffPath(w)), false);
    assert.equal(three.entries.some((e) => e.to === handoffPath(w)), true);
    await agentRun(w, { at: three.lastCopy + LATE_CHECK_MS + 1 });
    for (const t of [...two.took, ...three.took]) assert.equal(existsSync(t.path), false, t.path);
    assert.deepEqual(filing.readPendingsOf(w.t.home, "final"), []);
    w.t.done();
  });

  it("L27 the spellings' hand-off of a finished video puts back a copy of its last Reels' hand-off that Dropbox lost or changed, before its refusals, and is said again", async () => {
    const words = (done) => `A copy of Pricing: what to charge? in final/ was not whole in Dropbox, so it is put back, and ${done}. Say it again in a minute.`;
    const ready = async () => {
      const w = await localFinished();
      exportOf(w, "reel 2");
      assert.equal(await asked(w, { reels: true, yes: true, without: ["reel 1"] }), 0, w.t.said());
      assert.equal(await finishRun(w), 0, w.t.said());
      return { w, p: finalPending(w, 2) };
    };
    const SPELL = ["spell", FOLDER, "add", "Sallie", "Sally"];
    const reelSrt = (p) => p.entries.find((e) => e.to.endsWith(".srt") && /reel/i.test(e.to));
    // (a) the hand-off removed
    {
      const { w, p } = await ready();
      const text = readFileSync(p.entries.find((e) => e.to === handoffPath(w)).from, "utf8");
      rmSync(handoffPath(w));
      const r = await on(seeing(w), ...SPELL);
      assert.equal(r.code, 1, r.text);
      assert.match(r.text, /was not whole in Dropbox, so it is put back, and nothing was written\. Say it again in a minute\.$/);
      assert.equal(readFileSync(handoffPath(w), "utf8"), text);
      assert.equal((await on(seeing(w), ...SPELL)).code, 0);
      w.t.done();
    }
    // (b) Reel 2's captions cut short; (c) one letter changed at the same size
    for (const how of ["short", "same size"]) {
      const { w, p } = await ready();
      const e = reelSrt(p);
      const text = readFileSync(e.to, "utf8");
      writeFileSync(e.to, how === "short" ? text.slice(0, text.indexOf("\n\n") + 2) : text.replace(/[A-Za-z]/, (c) => (c === "z" ? "y" : "z")));
      const r = await on(seeing(w), ...SPELL);
      assert.equal(r.code, 1, `${how}: ${r.text}`);
      assert.match(r.text, /was not whole in Dropbox, so it is put back, and nothing was written\. Say it again in a minute\.$/, how);
      assert.equal(readFileSync(e.to, "utf8"), text, how);
      assert.equal((await on(seeing(w), ...SPELL)).code, 0, how);
      w.t.done();
    }
    // (d) Reel 1 exported and the hand-off removed: the Reels' quick part puts it back first.
    {
      const { w, p } = await ready();
      const text = readFileSync(p.entries.find((e) => e.to === handoffPath(w)).from, "utf8");
      rmSync(handoffPath(w));
      exportOf(w, "reel 1");
      const rev = reread(w.found).rev;
      assert.equal(await asked(w, { reels: true }), 1);
      assert.match(w.t.said(), /was not whole in Dropbox, so it is put back, and nothing was changed\. Say "hand off the Reels" again\./);
      assert.equal(readFileSync(handoffPath(w), "utf8"), text);
      assert.equal(reread(w.found).rev, rev);
      assert.equal(await asked(w, { reels: true, yes: true }), 0, w.t.said());
      assert.equal(await finishRun(w), 0, w.t.said());
      w.t.done();
    }
    void words;
  });
});

describe("the writers take the check's lock on a local episode (L5, L13)", () => {
  /** A live "late check" lock, let go at the second LOCK_LOOK_MS wait: the deps to run a command with, and the waits it made. */
  const locked = (w) => {
    const lock = filing.takeLateCheckLock(w.t.home, FOLDER, "late check", THIS);
    const waits = [];
    const base = w.t.ctx.deps.wait;
    const deps = seeing(w, { wait: async (ms) => { waits.push(ms); if (waits.length === 2) filing.releaseLateCheckLock(lock); await base(ms); } });
    return { deps, waits };
  };

  it("B0-F21 a video becoming a session is told the check is busy without its name or a folder", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    filing.takeLateCheckLock(w.t.home, FOLDER, "late check", THIS);
    const r = await on(seeing(w, { alive: THIS }), "kind", FOLDER, "session", "--private", "yes", "--again");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /^Studio was still checking Dropbox's copies after two minutes, so nothing was changed\./);
    assert.doesNotMatch(r.text, /Pricing|final\//);
    w.t.done();
  });
  it("L13(a) the spellings' hand-off of a finished video, through importHandoff", async () => {
    const w = await localFinished();
    exportOf(w, "reel 2");
    assert.equal(await asked(w, { reels: true, yes: true, without: ["reel 1"] }), 0, w.t.said());
    assert.equal(await finishRun(w), 0, w.t.said());
    const before = finalPending(w, 2);
    assert.ok(before.entries.some((e) => e.to === handoffPath(w)));
    const { deps, waits } = locked(w);
    const r = await on(deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(waits, [filing.LOCK_LOOK_MS, filing.LOCK_LOOK_MS]);
    assert.equal(finalPending(w, 2).entries.some((e) => e.to === handoffPath(w)), false);
    w.t.done();
  });

  it("L13(b) kind … --again takes what it sets aside out of the check, and the check leaves the exports for the parts it still holds", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const before = finalPending(w, 1);
    const { deps, waits } = locked(w);
    const r = await on(deps, "kind", FOLDER, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(waits.slice(0, 2), [filing.LOCK_LOOK_MS, filing.LOCK_LOOK_MS]);
    const after = finalPending(w, 1);
    assert.equal(after.entries.some((e) => /\.(brimm-ops\.json|srt|transcript\.txt)$/.test(e.to)), false, JSON.stringify(after.entries.map((e) => e.to)));
    assert.equal(after.entries.some((e) => e.to.endsWith(".mp4")), true);
    const log = await agentRun(w, { at: before.lastCopy + LATE_CHECK_MS + 1 });
    for (const t of before.took) assert.equal(existsSync(t.path), true, t.path);
    assert.ok(log.logs.some((l) => l.includes("no longer holds")), log.logs.join("|"));
    assert.equal(log.logs.some((l) => l.includes("could not be looked at")), false);
    w.t.done();
  });

  it("L13(c) resolve keeping B of a copy in final/ takes B's path out of the check, whatever B's size", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const p = finalPending(w, 1);
    const srt = p.entries.find((e) => e.to.endsWith(".srt")).to;
    const copy = srt.replace(/\.srt$/, " (Sallie's laptop's conflicted copy 2026-11-06).srt");
    writeFileSync(copy, "b side of the captions\n");
    assert.equal((await on(seeing(w), "resolve", FOLDER)).code, 0);
    const { deps, waits } = locked(w);
    const r = await on(deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(waits, [filing.LOCK_LOOK_MS, filing.LOCK_LOOK_MS]);
    assert.equal(finalPending(w, 1).entries.some((e) => e.to === srt), false);
    await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    assert.equal(readFileSync(srt, "utf8"), "b side of the captions\n");
    w.t.done();
  });

  it("L14 a video answered as a session after all right after its hand-off: its check puts nothing back into final/ and deletes nothing in Downloads", async () => {
    for (const lostRecord of [false, true]) {
      const w = await localExported("raw");
      assert.equal(await finishRun(w), 0, w.t.said());
      const p = finalPending(w, 1);
      const r = await on(seeing(w), "kind", FOLDER, "session", "--private", "yes", "--again");
      assert.equal(r.code, 0, r.text);
      if (lostRecord) rmSync(recordFile(w.found.folder, reread(w.found).rev), { force: true });
      await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
      for (const t of p.took) assert.equal(existsSync(t.path), true, t.path);
      const left = p.entries.filter((e) => !e.to.endsWith("brimm-ops.json")).filter((e) => existsSync(e.to));
      assert.deepEqual(left.map((e) => e.to), [], `lostRecord ${lostRecord}`);
      w.t.done();
    }
  });
});
