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
import { exportOf } from "./exports-world.js";
import { finishEpisode } from "../edit.js";
import { recordFile } from "../episode.js";
import { on, seeing } from "./checking-world.js";

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
});
