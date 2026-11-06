// What the review of PR 21 found when two Macs share an episode: a finish that goes on writing after the other Mac has it, and
// the things a finish does for the claim. (The release, the take-over and the "still arriving" wait are gone: Phase 2, F5.) Two Macs
// share one root here (otherMac); every program is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { episodeWork, fromFinalCutFolder } from "../settings.js";
import { readResult } from "../detached.js";
import { claimed, filesProblems, recordFile, recordText } from "../episode.js";
import { setup, episodeFor, reread, otherMac, FOLDER, EDITED, PROJECT } from "./episodes.js";

/** Run a command of edit.js on a Mac, by its deps: { code, text }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
/** Final Cut's files at the end of the made-up edit, as finish's own tests have them. */
function sharedAll(t) {
  t.shared(`${PROJECT.main}.mp4`, 2000);
  t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
  t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
}
const MINE2 = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
const finalOf = (found) => (existsSync(join(found.folder, "final")) ? readdirSync(join(found.folder, "final"), { recursive: true }) : []);

describe("finish, with the other Mac", () => {
  it("claims an episode nobody has open when it starts, so the other Mac cannot open it while it runs", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    const r = await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).rev, reread(found).editing && reread(found).editing.by], [2, "Mac Studio"]);
    assert.equal(JSON.parse(readFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), "utf8")).rev, 2);
    const her = otherMac(t);
    const refused = await on(her.deps, "open", FOLDER);
    assert.equal(refused.code, 1);
    assert.match(refused.text, /^Mac Studio has /);
    // The finish then lets the claim go, as it always has.
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0, readResult(t.home, FOLDER, "finish").failed.join(" "));
    assert.equal(reread(found).editing, null);
    t.done();
  });
  it("copies nothing into final/ when the other Mac claimed the episode while it ran", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    // While the finish waits for Final Cut's files, her Mac claims the episode (Dropbox brings her record across).
    const wait = t.ctx.deps.wait;
    let taken = false;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (!taken) {
        taken = true;
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...claimed(now, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: now.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
      }
    };
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /Sallie's laptop has .* open now, so nothing was copied into final\//);
    assert.deepEqual(finalOf(found), []);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    t.done();
  });
});

describe("the two Macs, as the P1 check found them", () => {
  const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  const refusal = "v1 of reel 1 was shown on Mac Studio, and Mac Studio has not said whether it was changed there.";
  it("lets its claim go when the finish it started fails, and says so (T4)", async () => {
    const t = setup({ programs: { WHISPER: () => ({ code: 3, stderr: "error: failed to initialize whisper context" }) } });
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    assert.equal(reread(found).editing.by, "Mac Studio");
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.equal(reread(found).editing, null);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /The episode is let go again, as it was before the finish\./);
    t.done();
  });
  it("lets its claim go when the finish never takes its lock (T17)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "bring" }));
    const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "finish", "--now", FOLDER);
    assert.equal(r.code, 1);
    assert.match(r.text, /The episode is let go again, as it was before the finish\./);
    assert.equal(reread(found).editing, null);
    t.done();
  });
  it("shows no hand-off in Finder when the record of the finish could not be written (T18)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    const clone = t.ctx.deps.clone;
    let wrote = false;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!wrote && to.endsWith(".brimm-ops.json")) {
        wrote = true;
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, name: { text: "Changed meanwhile", placeholder: false } }));
      }
    };
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /the record was not written/);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), []);
    t.done();
  });
  it("copies nothing into final/ again at its late check once the other Mac has the episode (T20)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    const her = otherMac(t);
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      // At the late check's wait, she opens it, and a copy in final/ goes missing.
      if (ms > 60000 && reread(found).finished && !reread(found).editing) {
        assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
        rmSync(join(found.folder, "final", `${PROJECT["reel 1"]}.srt`), { force: true });
      }
    };
    await editMain(["finish", "--now", FOLDER], t.ctx.deps);
    assert.equal(existsSync(join(found.folder, "final", `${PROJECT["reel 1"]}.srt`)), false);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /Sallie's laptop has .* open now, so it was not copied in again/);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    t.done();
  });
  it("lists what final/ holds when a finish's copy made again fails, so a finish again goes through (T3)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    // Main Shared again after a trim, under the same name, and the finish asked again.
    writeFileSync(join(fromFinalCutFolder(t.home), `${PROJECT.main}.mp4`), "main, trimmed by hand, a little longer");
    utimesSync(join(fromFinalCutFolder(t.home), `${PROJECT.main}.mp4`), new Date(Date.parse("2026-10-20T16:00:00-05:00")), new Date(Date.parse("2026-10-20T16:00:00-05:00")));
    t.shared(`${PROJECT.main}.fcpxmld`, 2 * 3600000 + 60000);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(`final/${PROJECT.main}.mp4`)) throw new Error("cp: clonefile failed");
      clone(from, to);
    };
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /The record lists what final\/ holds now\. Say finish again\./);
    assert.deepEqual(filesProblems(found.folder, reread(found)), []);
    assert.equal(reread(found).editing, null);
    t.done();
  });
  it("writes no record over a take-over that lands while the finish copies into final/, and says so (T1)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    const her = otherMac(t);
    const clone = t.ctx.deps.clone;
    let taken = false;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!taken && to.endsWith(".brimm-ops.json")) {
        taken = true;
        const now = reread(found);
        writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...claimed(now, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: now.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
      }
    };
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /^Sallie's laptop took .* over while finish was copying into final\/, so the finish is not in the record\./);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    assert.ok(her);
    t.done();
  });
  it("writes no claim when this Mac already has the episode it finishes (T19)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    assert.equal(JSON.parse(readFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), "utf8")).rev, 1);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("leaves a result naming the conflict when finish's claim met the other Mac's open as a conflicted copy (T6)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    const mine = reread(found);
    const copy = `${String(mine.rev).padStart(4, "0")} (Sallie's laptop's conflicted copy 2026-10-20).json`;
    writeFileSync(join(found.folder, "record", copy), recordText({ ...claimed({ ...mine, editing: null }, "Sallie's laptop", "2026-10-20T15:00:05-05:00"), rev: mine.rev, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    const result = readResult(t.home, FOLDER, "finish");
    assert.ok(result && !result.ok, JSON.stringify(result));
    assert.match(result.failed.join(" "), /Dropbox has kept a conflicted copy in this episode: record\/.*Say "sort out the conflict"/s);
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  /** A finish, then the main video trimmed by hand and Shared again under the same name, and a finish asked again. */
  async function refinish(t) {
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    t.shared(`${PROJECT.main}.mp4`, 5000, "main, trimmed by hand, longer now");
    t.shared(`${PROJECT.main}.fcpxmld`, 6000);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    return found;
  }
  /** At the hand-off's copy into final/, the last one, the record is changed as `change` says. */
  function atHandOff(t, found, change) {
    const clone = t.ctx.deps.clone;
    let done = false;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!done && to.endsWith(".brimm-ops.json")) {
        done = true;
        change(reread(found));
      }
    };
    return () => (t.ctx.deps.clone = clone);
  }
  it("lists what final/ holds in the record in force when the other Mac's claim lands while a finish again copies, so neither Mac is stuck (T1)", async () => {
    const t = setup();
    const found = await refinish(t);
    const back = atHandOff(t, found, (now) => writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...claimed(now, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: now.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } })));
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    back();
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /^Sallie's laptop took .* over while finish was copying into final\/, so the finish is not in the record\. The record lists what final\/ holds now, and no finish: the next finish makes every part again/);
    assert.deepEqual(filesProblems(found.folder, reread(found)), []);
    assert.deepEqual([reread(found).editing.by, reread(found).finished], ["Sallie's laptop", null]);
    // final/ mixes two finishes now: none is "kept as the last finish made it", so her finish asks for her own Shares.
    const hers = await on(otherMac(t).deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2");
    assert.equal(hers.code, 1);
    assert.doesNotMatch(hers.text, /kept as the last finish made it/);
    assert.match(hers.text, /^The main video has not been Shared from Final Cut\./);
    // She lets it go, and this Mac opens it again.
    const letGo = reread(found);
    writeFileSync(recordFile(found.folder, letGo.rev + 1), recordText({ ...letGo, editing: null, rev: letGo.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const again = await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2");
    assert.equal(again.code, 0, again.text);
    assert.doesNotMatch(again.text, /kept as the last finish made it/);
    t.done();
  });
  it("lists what final/ holds when the record changed only by the time a finish again writes it, so a finish again goes through (T1)", async () => {
    const t = setup();
    const found = await refinish(t);
    const back = atHandOff(t, found, (now) => {
      const hers = { ...claimed(now, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: now.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } };
      writeFileSync(recordFile(found.folder, now.rev + 1), recordText(hers));
      writeFileSync(recordFile(found.folder, now.rev + 2), recordText({ ...hers, rev: now.rev + 2, editing: null }));
    });
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    back();
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /the record was not written: .*\. The record lists what final\/ holds now, and no finish: .* Say finish again\./);
    assert.deepEqual(filesProblems(found.folder, reread(found)), []);
    assert.equal(reread(found).finished, null);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    t.done();
  });
  it("does not tell this Mac it still has the episode when the other Mac's take-over is on its way at the record write (t1-5)", async () => {
    const t = setup();
    const found = await refinish(t);
    const back = atHandOff(t, found, (now) => {
      const text = recordText({ ...claimed(now, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: now.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } });
      writeFileSync(recordFile(found.folder, now.rev + 1), text.slice(0, 60));
    });
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    back();
    const failed = readResult(t.home, FOLDER, "finish").failed.join(" ");
    assert.doesNotMatch(failed, /This Mac still has the episode open/);
    assert.match(failed, /The record could not be written to list what final\/ holds now: .*\. If the episode then says it is not whole in Dropbox, that needs Jason\./);
    assert.match(failed, /The episode changed on the other Mac while finish ran, so nothing was let go here: say open to see who has it now\./);
    t.done();
  });
  it("says which file is out of step, and that a conflict needs Jason, when a side kept leaves the files unlike its record (round 2, D: W1, W8)", async () => {
    const t = setup();
    const found = await refinish(t);
    const asked = reread(found);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    const mine = reread(found);
    // Her take-over, written on the record the finish was asked at, arrives as a conflicted copy of the finish's record.
    const copy = `${String(mine.rev).padStart(4, "0")} (Sallie's laptop's conflicted copy 2026-10-20).json`;
    writeFileSync(join(found.folder, "record", copy), recordText({ ...claimed(asked, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: mine.rev, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.equal((await on(t.ctx.deps, "resolve", FOLDER)).code, 0);
    const kept = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(kept.code, 1, kept.text);
    assert.match(kept.text, /^Kept B of record\/0005\.json\. The other is set aside in history\/\.\nThe files are not as the record now lists them: final\/Pricing- what to charge- main v5 3fa9c1\.mp4 is 33 bytes, not the 16 the record lists\. Once Dropbox has finished, say "open" again; if it still says a file is not whole, a conflict needs Jason: tell him the episode's name\.$/);
    t.done();
  });
  it("says nothing more after a keep that leaves the files as the record lists them (round 2, D)", async () => {
    const t = setup();
    const found = await refinish(t);
    const asked = reread(found);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    const mine = reread(found);
    const copy = `${String(mine.rev).padStart(4, "0")} (Sallie's laptop's conflicted copy 2026-10-20).json`;
    writeFileSync(join(found.folder, "record", copy), recordText({ ...claimed(asked, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: mine.rev, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.equal((await on(t.ctx.deps, "resolve", FOLDER)).code, 0);
    const kept = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "A");
    assert.equal(kept.code, 0, kept.text);
    assert.equal(kept.text, "Kept A of record/0005.json. The other is set aside in history/.");
    t.done();
  });
  it("names a file out of step after a keep whose copy could not be deleted too (round 2, D)", async () => {
    const t = setup();
    const found = await refinish(t);
    const asked = reread(found);
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 0);
    const mine = reread(found);
    const copy = `${String(mine.rev).padStart(4, "0")} (Sallie's laptop's conflicted copy 2026-10-20).json`;
    const copyPath = join(found.folder, "record", copy);
    writeFileSync(copyPath, recordText({ ...claimed(asked, "Sallie's laptop", "2026-10-20T15:10:00-05:00"), rev: mine.rev, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.equal((await on(t.ctx.deps, "resolve", FOLDER)).code, 0);
    // The copy is held: a folder of its name cannot be deleted by rmSync without recursive.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(`${String(mine.rev + 1).padStart(4, "0")}.json`)) {
        rmSync(copyPath);
        mkdirSync(copyPath);
        writeFileSync(join(copyPath, "held"), "x");
      }
    };
    const kept = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    t.ctx.deps.clone = clone;
    assert.equal(kept.code, 1, kept.text);
    assert.match(kept.text, /the copy could not be deleted yet .*\nThe files are not as the record now lists them: final\/Pricing- what to charge- main v5 3fa9c1\.mp4 is 33 bytes, not the 16 the record lists\./s);
    t.done();
  });
});

