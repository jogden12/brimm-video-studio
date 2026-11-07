// The finish of a video kept on this Mac, and the check of its copies made behind it (Phase 3, L5): the finish ends once its hand-off is
// written, the launch agent checks Dropbox's copies 15 minutes later from a pending on this Mac's disk, and every writer into final/ takes the check's
// lock. Names L5 adds are reached through a namespace import.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as filing from "../filing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { markChecking, problemFlagged } from "../finish-check.js";
import { readResult } from "../detached.js";
import { episodeWork, pendingFolder } from "../settings.js";
import { FOLDER, ID, reread } from "./episodes.js";
import { agentRun, finalPending, finishRun, localExported } from "./local-world.js";
import { exportOf, whisper } from "./exports-world.js";
import { finishEpisode } from "../edit.js";
import { recordFile } from "../episode.js";
import { on, seeing } from "./checking-world.js";
import { guideWorld } from "./guide-world.js";
import { lockOf, takeEpisodeLock } from "../detached.js";

const checkingFile = (w) => join(episodeWork(w.t.home, FOLDER), "finish.checking.json");

describe("the finish of a video kept on this Mac (L5)", () => {
  it("L1 ends once its hand-off is written", async () => {
    const w = await localExported("raw");
    const R = reread(w.found).rev;
    const clone = w.t.ctx.deps.clone;
    const seenBefore = [];
    w.t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(`record/${String(R + 1).padStart(4, "0")}.json`)) {
        const p = finalPending(w, 1);
        seenBefore.push(Boolean(p && p.record && p.record.to === to && p.copied === undefined));
      }
      clone(from, to);
    };
    assert.equal(await finishRun(w), 0, w.t.said());
    assert.deepEqual(seenBefore, [true]);
    const p = finalPending(w, 1);
    assert.equal(p.copied, true);
    assert.equal(p.rev, R + 1);
    assert.equal(p.revision, 1);
    assert.deepEqual(p.took.map((t) => [t.key, t.place]).sort(), [["main", "Downloads"], ["reel 2", "Downloads"]]);
    assert.equal(w.t.waits.includes(LATE_CHECK_MS), false);
    assert.deepEqual(w.t.kicks, ["kickstart"]);
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.equal(result === null || result.ok !== false, true);
    assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), "episode.lock")), false);
    assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), "late-check.lock")), false);
    assert.ok(existsSync(p.work));
    assert.ok(existsSync(checkingFile(w)));
    assert.equal(JSON.parse(readFileSync(checkingFile(w), "utf8")).revision, 1);
    for (const t of p.took) assert.ok(existsSync(t.path), t.path);
    assert.equal(problemFlagged(w.t.home, FOLDER), false);
    assert.ok(!w.t.said().includes("online-only"));
    w.t.done();
  });

  it("L2 asks the agent to run only when it is not running, and a kick that fails fails nothing", async () => {
    let w = await localExported("raw");
    w.t.ctx.deps.agentRunning = () => true;
    assert.equal(await finishRun(w), 0);
    assert.deepEqual(w.t.kicks, []);
    w.t.done();
    w = await localExported("raw");
    w.t.ctx.deps.kickstart = () => { throw new Error("x"); };
    assert.equal(await finishRun(w), 0, w.t.said());
    assert.ok(w.t.said().includes("Pricing: what to charge?: the launch agent could not be asked to make the check of its copies (an error). It is made when the Mac's import next runs."), w.t.said());
    w.t.done();
  });

  it("L3 then the agent makes the check behind", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const p = finalPending(w, 1);
    const exports = p.took.map((t) => t.path);
    const r = await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    for (const path of exports) assert.equal(existsSync(path), false, path);
    assert.equal(finalPending(w, 1), null);
    assert.equal(existsSync(p.work), false);
    assert.equal(existsSync(checkingFile(w)), false);
    assert.ok(r.logs.some((l) => l.includes("the check of its copies in final/ passed")), r.logs.join("|"));
    w.t.done();
  });

  it("L4 a finish killed after its pending is written still has its check made", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const p = finalPending(w, 1);
    const { copied, ...rest } = p;
    filing.writePending(w.t.home, rest);
    rmSync(join(episodeWork(w.t.home, FOLDER), "finish.result.json"), { force: true });
    const lost = p.entries.find((e) => e.to.endsWith(".mp4"));
    rmSync(lost.to);
    await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    assert.ok(existsSync(lost.to));
    for (const t of p.took) assert.equal(existsSync(t.path), false);
    w.t.done();
  });

  it("L11 a record write that fails takes the finish's pending away", async () => {
    const w = await localExported("raw");
    const R = reread(w.found).rev;
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(`record/${String(R + 1).padStart(4, "0")}.json`)) throw new Error("Dropbox is not there");
      clone(from, to);
    };
    assert.equal(await finishRun(w), 1);
    assert.deepEqual(filing.readPendingsOf(w.t.home, "final"), []);
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.ok(result.failed.some((l) => l.startsWith("The files are in final/, but the record was not written:")), JSON.stringify(result));
    assert.deepEqual(w.t.kicks, []);
    assert.deepEqual(readdirSync(join(w.t.home, "BRIMM Video Work", ".runs")).filter((n) => n.startsWith("finish-")), []);
    w.t.done();
  });

  it("L12 a pending that cannot be written stops the finish before its record", async () => {
    const w = await localExported("raw");
    const dir = join(pendingFolder(w.t.home), "final");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o555);
    try {
      assert.equal(await finishRun(w), 1);
    } finally {
      chmodSync(dir, 0o755);
    }
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.ok(result.failed.some((l) => l.startsWith("The files are in final/, but the record was not written: the check of its copies could not be kept on this Mac.")), JSON.stringify(result));
    assert.deepEqual(w.t.kicks, []);
    assert.deepEqual(filing.readPendingsOf(w.t.home, "final"), []);
    assert.ok(!existsSync(recordFile(w.found.folder, reread(w.found).rev + 1)));
    w.t.done();
  });

  const SPELL = ["spell", FOLDER, "add", "Sallie", "Sally"];
  const clockAt = (ms) => new Date(ms).toTimeString().slice(0, 5);
  const finished = async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    return w;
  };
  const THIS = (pid) => pid === process.pid;

  it("L5 a spelling right after a hand-off writes the next revision at once", async () => {
    const w = await finished();
    const p = finalPending(w, 1);
    const handoff = p.entries.find((e) => e.to.endsWith(".brimm-ops.json")).to;
    const r = await on(seeing(w), ...SPELL);
    assert.equal(r.code, 0, r.text);
    assert.ok(/made again as revision 2/.test(r.text), r.text);
    assert.doesNotMatch(r.text, /Studio checks Dropbox's copies at/);
    const after = finalPending(w, 1);
    assert.equal(after.entries.some((e) => e.to === handoff), false);
    assert.ok(after.entries.some((e) => e.to.endsWith(".mp4")));
    assert.equal("reading" in after, false);
    assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), "late-check.lock")), false);
    assert.equal(w.t.waits.includes(LATE_CHECK_MS), false);
    await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    for (const t of p.took) assert.equal(existsSync(t.path), false, t.path);
    w.t.done();
  });

  it("L8 a writer waits for the check's lock, never for the check", async () => {
    const w = await finished();
    const lock = filing.takeLateCheckLock(w.t.home, FOLDER, "late check", THIS);
    let n = 0;
    const waits = [];
    const r = await on(seeing(w, { wait: async (ms) => { waits.push(ms); n += 1; if (n === 3) filing.releaseLateCheckLock(lock); } }), ...SPELL);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(waits, [filing.LOCK_LOOK_MS, filing.LOCK_LOOK_MS, filing.LOCK_LOOK_MS]);
    w.t.done();
  });

  it("L9 a writer gives up after two minutes of the check's lock, and changes nothing", async () => {
    const w = await finished();
    const lock = filing.takeLateCheckLock(w.t.home, FOLDER, "late check", THIS);
    const before = reread(w.found);
    const p = finalPending(w, 1);
    const r = await on(seeing(w, { wait: async () => {} }), ...SPELL);
    assert.equal(r.code, 1);
    assert.equal(r.text, "Studio was still checking Dropbox's copies of Pricing: what to charge? after two minutes, so nothing was changed. Say it again in a minute.");
    assert.equal(reread(w.found).rev, before.rev);
    assert.deepEqual(finalPending(w, 1), p);
    filing.releaseLateCheckLock(lock);
    writeFileSync(join(episodeWork(w.t.home, FOLDER), "late-check.lock"), JSON.stringify({ pid: 999999, command: "late check", nonce: "d" }));
    const dead = await on(seeing(w, { wait: async () => assert.fail("no wait") }), ...SPELL);
    assert.equal(dead.code, 0, dead.text);
    w.t.done();
  });

  it("L16 a command a run stops on a local episode never says when Studio checks", async () => {
    const w = await finished();
    assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", THIS).taken, true);
    const r = await on(seeing(w), ...SPELL);
    assert.equal(r.code, 1);
    assert.equal(r.text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.');
    w.t.done();
  });

  it("L17 status says when Studio checks a local episode's copies while no finish is at work, that it is late once it is, and a problem when one was found", async () => {
    const w = await finished();
    const p = finalPending(w, 1);
    const due = JSON.parse(readFileSync(checkingFile(w), "utf8")).due;
    const first = await on(seeing(w), "status");
    assert.ok(first.said.includes(`${FOLDER}: the hand-off is written. Studio checks Dropbox's copies at ${clockAt(due)}, and then takes the export out of Downloads.`), first.text);
    const late = await on(seeing(w, { now: () => due + 6 * 60000 }), "status");
    assert.ok(late.said.includes(`${FOLDER}: the hand-off is written. Studio's check of Dropbox's copies was due at ${clockAt(due)}, and is made as soon as it can be. The export stays in Downloads until then.`), late.text);
    assert.equal(late.said.some((l) => l.includes("Studio checks Dropbox's copies at")), false);
    const problem = "Pricing- what to charge-.brimm-ops.json in final/ is not whole in Dropbox (it is not there), and its copy on this Mac is gone, so it could not be put back.";
    filing.writePending(w.t.home, { ...p, problem });
    const found = await on(seeing(w), "status");
    assert.ok(found.said.includes(`${FOLDER}: the check of its copies in Dropbox found a problem: ${problem} The exports stay in Downloads. Ask Jason.`), found.text);
    assert.equal(found.said.some((l) => l.includes("Studio checks Dropbox's copies at")), false);
    w.t.done();
  });

  it("L21 a spelling right after a hand-off puts back the captions Dropbox cut short, and is said again", async () => {
    const SAID = "A copy of Pricing: what to charge? in final/ was not whole in Dropbox, so it is put back, and nothing was changed. Say it again in a minute.";
    for (const how of ["short", "same size", "gone"]) {
      const w = await finished();
      const p = finalPending(w, 1);
      const srtEntry = p.entries.find((e) => e.to.endsWith(".srt"));
      const text = readFileSync(srtEntry.to, "utf8");
      if (how === "short") writeFileSync(srtEntry.to, text.slice(0, text.indexOf("\n\n") + 2));
      else if (how === "same size") writeFileSync(srtEntry.to, text.replace("Welcome", "Welcomf"));
      else rmSync(srtEntry.to);
      const rev = reread(w.found).rev;
      const first = await on(seeing(w), ...SPELL);
      assert.equal(first.code, 1, `${how}: ${first.text}`);
      assert.equal(first.text, SAID, how);
      assert.equal(readFileSync(srtEntry.to, "utf8"), text, how);
      assert.equal(reread(w.found).rev, rev);
      assert.ok(finalPending(w, 1).entries.some((e) => e.to === srtEntry.to));
      assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), "late-check.lock")), false);
      const again = await on(seeing(w), ...SPELL);
      assert.equal(again.code, 0, `${how}: ${again.text}`);
      assert.ok(readFileSync(srtEntry.to, "utf8").includes("Sally"), how);
      w.t.done();
    }
  });

  it("L24 a command after Dropbox lost the finish's record puts that record back first, and builds on it", async () => {
    const w = await finished();
    const p = finalPending(w, 1);
    const text = readFileSync(p.record.from, "utf8");
    rmSync(p.record.to);
    const r = await on(seeing(w), ...SPELL);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /Dropbox undid/);
    assert.equal(readFileSync(p.record.to, "utf8"), text);
    assert.equal(reread(w.found).rev, p.rev + 1);
    assert.ok(readFileSync(join(w.t.home, "Library", "Logs", "brimm-video.log"), "utf8").includes("its record"));
    const check = await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    assert.deepEqual(check.notices, []);
    for (const t of p.took) assert.equal(existsSync(t.path), false);
    w.t.done();
  });

  it("L25 a spelling that takes an entry out of a check with a problem asks the agent to run, and status goes on saying the problem", async () => {
    const w = await finished();
    assert.deepEqual(w.t.kicks, ["kickstart"]);
    const p = finalPending(w, 1);
    const mp4 = p.entries.find((e) => e.to.endsWith("main.mp4") || e.to.endsWith(".mp4"));
    rmSync(mp4.to);
    rmSync(mp4.from);
    const first = await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 1 });
    assert.equal(first.notices.length, 1);
    assert.equal(problemFlagged(w.t.home, FOLDER), true);
    assert.ok(finalPending(w, 1).problem);
    const r = await on(seeing(w), ...SPELL);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(w.t.kicks, ["kickstart", "kickstart"]);
    const after = finalPending(w, 1);
    assert.equal(typeof after.told, "number");
    assert.ok(after.wasProblem);
    assert.equal("problem" in after, false);
    const status = await on(seeing(w), "status");
    assert.ok(status.said.some((l) => l.startsWith(`${FOLDER}: the check of its copies in Dropbox found a problem: `) && l.includes("A change since may have put it right, and Studio checks them again in a few minutes.")), status.text);
    const second = await agentRun(w, { at: p.lastCopy + LATE_CHECK_MS + 2000 });
    assert.deepEqual(second.notices, []);
    assert.ok(finalPending(w, 1).problem);
    w.t.done();
  });

  it("L26 resolve of a local episode asks the agent to run while a check of its copies is owed", async () => {
    const w = await finished();
    const p = finalPending(w, 1);
    const srt = p.entries.find((e) => e.to.endsWith(".srt")).to;
    const copy = srt.replace(/\.srt$/, " (Sallie's laptop's conflicted copy 2026-11-06).srt");
    writeFileSync(copy, readFileSync(srt, "utf8").slice(0, 8));
    assert.equal((await on(seeing(w), "resolve", FOLDER)).code, 0);
    const kept = await on(seeing(w), "resolve", FOLDER, "--keep", "B");
    assert.equal(kept.code, 0, kept.text);
    assert.deepEqual(w.t.kicks, ["kickstart", "kickstart"]);
    w.t.done();
  });

  /** The main video exported again (a new name), and finish asked again: the quick part asks for the words it shows, then takes the yes. */
  const askedAgain = async (w, parts = ["main"]) => {
    for (const part of parts) exportOf(w, part, { start: [14, 30, 0] });
    const found = { ...w.found, record: reread(w.found) };
    assert.equal(await finishEpisode(w.t.ctx, found, {}), 0, w.t.said());
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
  };

  it("L6 a second hand-off right after the first takes what it replaces out of the first's check, and both are made", async () => {
    const w = await finished();
    const first = finalPending(w, 1);
    const handoff = first.entries.find((e) => e.to.endsWith(".brimm-ops.json")).to;
    await askedAgain(w);
    assert.equal(await finishRun(w), 0, w.t.said());
    const one = finalPending(w, 1);
    const two = finalPending(w, 2);
    assert.ok(one && two);
    assert.equal(one.entries.some((e) => e.to === handoff), false);
    const r = await agentRun(w, { at: two.lastCopy + LATE_CHECK_MS + 1 });
    assert.equal(finalPending(w, 1), null);
    assert.equal(finalPending(w, 2), null);
    assert.ok(r.logs.some((l) => l.includes("no longer holds")), r.logs.join("|"));
    for (const t of two.took) assert.equal(existsSync(t.path), false, t.path);
    w.t.done();
  });

  it("L10 a second finish gives up after two minutes of the check's lock, and copies nothing", async () => {
    const w = await finished();
    const before = finalPending(w, 1);
    await askedAgain(w);
    const lock = filing.takeLateCheckLock(w.t.home, FOLDER, "late check", THIS);
    assert.equal(await finishRun(w, seeing(w, { wait: async () => {} })), 1);
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.ok(result.failed.includes('Studio was still checking Dropbox\'s copies of Pricing: what to charge? after two minutes, so nothing was copied into final/. Say "hand it off" again.'), JSON.stringify(result.failed));
    assert.equal(finalPending(w, 2), null);
    assert.deepEqual(finalPending(w, 1), before);
    filing.releaseLateCheckLock(lock);
    w.t.done();
  });

  it("L19 an episode from before the switch is finished as today", async () => {
    const w = guideWorld({ kind: "raw", projects: ["main", "reel 2"], programs: { WHISPER: whisper() } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    assert.equal(await finishRun(w), 0, w.t.said());
    assert.equal(w.t.waits.includes(LATE_CHECK_MS), true);
    assert.deepEqual(filing.readEveryPending(w.t.home), []);
    assert.deepEqual(w.t.kicks, []);
    assert.ok(readResult(w.t.home, FOLDER, "finish").next.includes("online-only"));
    assert.equal(existsSync(checkingFile(w)), false);
    w.t.done();
  });

  it("L23 a second finish that reuses the main video puts back its captions Dropbox cut short, and is said again", async () => {
    const SAID = 'A copy of Pricing: what to charge? in final/ was not whole in Dropbox, so it is put back, and nothing was copied into final/. Say "hand it off" again.';
    const w = await finished();
    const p = finalPending(w, 1);
    const srt = p.entries.find((e) => e.to.endsWith("main.srt") || (e.to.endsWith(".srt") && !e.to.includes("reel")));
    const text = readFileSync(srt.to, "utf8");
    exportOf(w, "reel 2", { start: [14, 30, 0] });
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, {}), 0, w.t.said());
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0, w.t.said());
    writeFileSync(srt.to, text.slice(0, text.indexOf("\n\n") + 2));
    assert.equal(await finishRun(w), 1);
    const result = readResult(w.t.home, FOLDER, "finish");
    assert.ok(result.failed.includes(SAID), JSON.stringify(result.failed));
    assert.equal(readFileSync(srt.to, "utf8"), text);
    assert.equal(finalPending(w, 2), null);
    w.t.done();
  });

  it("a second raw finish asked after Dropbox lost a copy in final/ puts the copy back first, and is said again (coordinator's ruling)", async () => {
    const w = await finished();
    const p = finalPending(w, 1);
    const mp4 = p.entries.find((e) => e.to.endsWith(".mp4"));
    rmSync(mp4.to);
    exportOf(w, "main", { start: [14, 30, 0] });
    const found = { ...w.found, record: reread(w.found) };
    const code = await finishEpisode(w.t.ctx, found, {});
    assert.equal(code, 1, w.t.said());
    assert.ok(w.t.said().includes('was not whole in Dropbox, so it is put back, and nothing was changed. Say "hand it off" again.'), w.t.said());
    assert.equal(existsSync(mp4.to), true);
    assert.ok(!w.t.said().includes("is not whole in Dropbox:"));
    w.t.done();
  });
});
