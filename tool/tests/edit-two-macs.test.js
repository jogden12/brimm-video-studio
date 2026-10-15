// What the review of PR 21 found when two Macs share an episode: a finish that goes on writing after the other Mac has it, a
// release while a finish runs, an answer that counts after the Mac that gave it has the episode again, a "still arriving"
// that never ends, and a second release that copies everything again. Two Macs share one root here (otherMac); every
// program is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { episodeWork, fromFinalCutFolder } from "../settings.js";
import { readResult } from "../detached.js";
import { claimed, filesProblems, recordFile, recordText } from "../episode.js";
import { setup, episodeFor, reread, otherMac, FOLDER, EDITED, NAME, PROJECT } from "./episodes.js";

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
  it("copies nothing into final/ when the other Mac took the episode over while it ran", async () => {
    const t = setup();
    const found = episodeFor(t, { record: EDITED });
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    // While the finish waits for Final Cut's files, she takes it over.
    const her = otherMac(t);
    const wait = t.ctx.deps.wait;
    let taken = false;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (!taken) {
        taken = true;
        assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
      }
    };
    assert.equal(await editMain(["finish", "--now", FOLDER], t.ctx.deps), 1);
    assert.match(readResult(t.home, FOLDER, "finish").failed.join(" "), /Sallie's laptop has .* open now, so nothing was copied into final\//);
    assert.deepEqual(finalOf(found), []);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    t.done();
  });
});

describe("release, with the other Mac", () => {
  const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  it("refuses while this Mac's finish is running for the episode", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "release", FOLDER, "--no-hand-edits");
    assert.deepEqual([r.code, r.text], [1, `finish is running for ${NAME}. Say "how far is it?", and hand it over when it is done. Nothing was handed over.`]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("refuses when a file the record lists is not whole in Dropbox, and names it", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    rmSync(join(found.folder, "Pricing talk.reel-1.srt"));
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    assert.equal(r.text, `${FOLDER} is not whole in Dropbox: Pricing talk.reel-1.srt is missing. Nothing was handed over.`);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("copies again only a Share or an export that changed, and keeps the ones already there", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    const share = t.shared(`${PROJECT.main}.mov`, 0, "the main video");
    t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    utimesSync(join(share, "..", `${PROJECT.main}.fcpxmld`, "Info.fcpxml"), new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const before = t.clones.length;
    const again = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(again.code, 0, again.text);
    assert.deepEqual(t.clones.slice(before).filter(([, to]) => to.includes("from-final-cut")), [], "nothing was copied again");
    assert.match(again.text, /Copied for the other Mac: nothing\./);
    // A Share made again is copied again, in place of the old copy.
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    writeFileSync(share, "the main video, trimmed by hand");
    utimesSync(share, new Date(Date.parse("2026-10-20T16:00:00-05:00")), new Date(Date.parse("2026-10-20T16:00:00-05:00")));
    const bundle = join(share, "..", `${PROJECT.main}.fcpxmld`);
    utimesSync(join(bundle, "Info.fcpxml"), new Date(Date.parse("2026-10-20T16:01:00-05:00")), new Date(Date.parse("2026-10-20T16:01:00-05:00")));
    const third = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(third.code, 0, third.text);
    assert.equal(readFileSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.mov`), "utf8"), "the main video, trimmed by hand");
    assert.equal(reread(found).files[`edit/from-final-cut/${PROJECT.main}.mov`], statSync(share).size);
    t.done();
  });
  it("when a copy cannot be put in again, lists it no more, says so, and hands nothing over", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    const share = t.shared(`${PROJECT["reel 1"]}.mov`, 0, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    writeFileSync(share, "reel one, longer now");
    utimesSync(share, new Date(Date.parse("2026-10-20T16:00:00-05:00")), new Date(Date.parse("2026-10-20T16:00:00-05:00")));
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(".mov")) throw new Error("cp: the operation could not be completed");
      clone(from, to);
    };
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    const rel = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    assert.match(r.text, new RegExp(`${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} could not be copied again, and its old copy is gone, so the record lists it no more: .* Nothing was handed over: say hand it over again\\.$`));
    const now = reread(found);
    assert.equal(rel in now.files, false);
    assert.equal(now.editing.by, "Mac Studio");
    // The episode opens on this Mac, and a release once the copy can be made puts it back.
    t.ctx.deps.clone = clone;
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal(reread(found).files[rel], statSync(share).size);
    t.done();
  });
});

describe("an answer about hand edits, once the Mac that gave it has the episode again", () => {
  const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  const refusal = "v1 of reel 1 was shown on Mac Studio, and Mac Studio has not said whether it was changed there.";
  it("counts no more when that Mac opens it again, and the other Mac's push after a take-over refuses", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    assert.deepEqual(reread(found).released.answers, {});
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.ok(r.text.startsWith(refusal), r.text);
    t.done();
  });
  it("counts no more after a take-over, even when a Mac that pushed nothing carried it on", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    assert.equal((await on(her.deps, "release", FOLDER)).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.ok(r.text.startsWith(refusal), r.text);
    t.done();
  });
  it("still counts on a plain hand-over, as before", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    assert.equal((await on(her.deps, "push", FOLDER, "reel", "1")).code, 0);
    t.done();
  });
});

describe("still arriving, when the list it waits on is out of date", () => {
  it("waits only for a released file the record still lists at that size", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = reread(found);
    const kept = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    mkdirSync(join(found.folder, "edit", "from-final-cut"), { recursive: true });
    writeFileSync(join(found.folder, kept), "twelve bytes");
    // Released at 9 bytes, and changed here since: the record lists 12, the size it has.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [kept]: 12 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { ...first.files, [kept]: 9 }, answers: {} } }));
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /Still arriving/);
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
  it("is passed over by a take-over, which then goes by the record's own list", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = reread(found);
    const coming = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { [coming]: 9 }, answers: {} } }));
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /Still arriving/);
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
});

describe("the two Macs, as the P1 check found them", () => {
  const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  const refusal = "v1 of reel 1 was shown on Mac Studio, and Mac Studio has not said whether it was changed there.";
  it("drops the answers a Mac gave once it pushes again without opening (T15)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    // Nobody has it open: the Studio pushes Reel 2 again without opening it.
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2", "--no-hand-edits")).code, 0);
    assert.deepEqual(reread(found).released.answers, {});
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.ok(r.text.startsWith(refusal), r.text);
    t.done();
  });
  it("drops this Mac's answers when its finish claims the episode (T8)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    sharedAll(t);
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2")).code, 0);
    assert.deepEqual([reread(found).editing.by, reread(found).released.answers], ["Mac Studio", {}]);
    t.done();
  });
  it("drops the answers when the answering Mac takes the episode back (T9, way B)", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, editing: MINE } });
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    const her = otherMac(t);
    assert.equal((await on(her.deps, "open", FOLDER)).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
    assert.equal((await on(her.deps, "open", FOLDER, "--take-over")).code, 0);
    const r = await on(her.deps, "push", FOLDER, "reel", "1");
    assert.equal(r.code, 1);
    assert.ok(r.text.startsWith(refusal), r.text);
    t.done();
  });
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
  it("does not stop a release for a copy of its own that Dropbox took away, and makes it again (T2)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    t.shared(`${PROJECT["reel 1"]}.mov`, 0, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    rmSync(join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`));
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.equal(readFileSync(join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`), "utf8"), "reel one");
    t.done();
  });
  it("lists what is really there when a copy made again fails after another worked, so a release again goes through (T7, T14)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    const share = t.shared(`${PROJECT.main}.mov`, 0, "main");
    const bundle = t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    const info = join(bundle, "Info.fcpxml");
    utimesSync(info, new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    // Trimmed by hand, Shared and exported again.
    writeFileSync(share, "main, trimmed by hand");
    utimesSync(share, new Date(Date.parse("2026-10-20T16:00:00-05:00")), new Date(Date.parse("2026-10-20T16:00:00-05:00")));
    writeFileSync(info, "<fcpxml>trimmed</fcpxml>");
    utimesSync(info, new Date(Date.parse("2026-10-20T16:01:00-05:00")), new Date(Date.parse("2026-10-20T16:01:00-05:00")));
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith("Info.fcpxml") && to.includes("from-final-cut")) throw new Error("cp: the operation could not be completed");
      clone(from, to);
    };
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 1);
    const rel = `edit/from-final-cut/${PROJECT.main}.mov`;
    assert.equal(reread(found).files[rel], statSync(share).size);
    t.ctx.deps.clone = clone;
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const again = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(again.code, 0, again.text);
    assert.equal((await on(otherMac(t).deps, "open", FOLDER)).code, 0);
    t.done();
  });
  it("copies again an export made again at the same size, and keeps a copy whose size the record does not list (T10, T12)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE } });
    t.shared(`${PROJECT.main}.mov`, 0, "main");
    const bundle = t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    const info = join(bundle, "Info.fcpxml");
    utimesSync(info, new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const size = statSync(info).size;
    writeFileSync(info, "X".repeat(size));
    utimesSync(info, new Date(Date.parse("2026-10-20T16:01:00-05:00")), new Date(Date.parse("2026-10-20T16:01:00-05:00")));
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal(readFileSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxmld`, "Info.fcpxml"), "utf8"), "X".repeat(size));
    t.done();
  });
  it("lets a release go while a bring runs for the episode, which writes no record (finding 4)", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, editing: MINE } });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "bring" }));
    const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
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
  it("refuses a take-over, naming the file, while a file handed over is not here, and claims nothing (T11, the skip kept)", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = reread(found);
    const coming = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" }, files: { ...first.files, [coming]: 9 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { [coming]: 9 }, answers: {} } }));
    const r = await on(t.ctx.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /is not whole in Dropbox:\n  edit\/from-final-cut\/Pricing talk main v2 3fa9c1\.mov is missing/);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    t.done();
  });
  it("keeps a copy whose time Dropbox put to the whole second (T13)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    const share = t.shared(`${PROJECT["reel 1"]}.mov`, 437, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const copy = join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`);
    const whole = new Date(Math.floor(statSync(share).mtimeMs / 1000) * 1000);
    utimesSync(copy, whole, whole);
    const before = t.clones.length;
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.deepEqual(t.clones.slice(before).filter(([, to]) => to.includes("from-final-cut")), []);
    t.done();
  });
  it("copies again a copy the record lists at another size, and makes new copies before copies made again (T12, T19)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    t.shared(`${PROJECT["reel 1"]}.mov`, 0, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    // The record lists the copy at a size it does not have: it is copied again. And a new Share is copied first.
    const now = reread(found);
    const rel = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, files: { ...now.files, [rel]: 99 } }));
    writeFileSync(join(found.folder, rel), "x".repeat(99));
    t.shared(`${PROJECT["reel 2"]}.mov`, 0, "reel two");
    const before = t.clones.length;
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    const made = t.clones.slice(before).map(([, to]) => to).filter((to) => to.includes("from-final-cut"));
    assert.deepEqual(made.map((to) => to.split("/").pop()), [`${PROJECT["reel 2"]}.mov`, `${PROJECT["reel 1"]}.mov`]);
    assert.equal(readFileSync(join(found.folder, rel), "utf8"), "reel one");
    t.done();
  });
  it("drops every answer on a take-over, even ones about parts the Mac taking over did not push (T19)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" }, released: { at: "2026-10-20T13:00:00-05:00", by: "Mac Studio", files: {}, answers: { "reel 1": { v: 1, said: "no changes" } } } } });
    assert.equal((await on(otherMac(t, "Third Mac").deps, "open", FOLDER, "--take-over")).code, 0);
    assert.deepEqual(reread(found).released.answers, {});
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
  it("goes by the newest export whatever its kind: a fresh bundle beside a stale .fcpxml is the one copied (Q2)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    t.shared(`${PROJECT.main}.fcpxml`, 0, "<fcpxml/>");
    t.shared(`${PROJECT.main}.mov`, 30000, "main");
    const bundle = t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    utimesSync(join(bundle, "Info.fcpxml"), new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.ok(existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxmld`, "Info.fcpxml")));
    assert.ok(!existsSync(join(found.folder, "edit", "from-final-cut", `${PROJECT.main}.fcpxml`)));
    t.done();
  });
  it("leaves out an Icon file and dot files deeper in a bundle (Q3)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    t.shared(`${PROJECT.main}.mov`, 0, "main");
    const bundle = t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    utimesSync(join(bundle, "Info.fcpxml"), new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    writeFileSync(join(bundle, "Icon\r"), "");
    mkdirSync(join(bundle, "sub"));
    writeFileSync(join(bundle, "sub", ".DS_Store"), "Finder's own");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.deepEqual(Object.keys(reread(found).files).filter((f) => f.includes(".fcpxmld")), [`edit/from-final-cut/${PROJECT.main}.fcpxmld/Info.fcpxml`]);
    t.done();
  });
  it("checks the newer of two Shares of one version against its export (Q4)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    t.shared(`${PROJECT.main}.mov`, 0, "main, first");
    const bundle = t.shared(`${PROJECT.main}.fcpxmld`, 60000);
    utimesSync(join(bundle, "Info.fcpxml"), new Date(Date.parse("2026-10-20T14:01:00-05:00")), new Date(Date.parse("2026-10-20T14:01:00-05:00")));
    t.shared(`${PROJECT.main}.mp4`, 120000, "main, Shared again");
    const r = await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 1);
    assert.match(r.text, /^The main video's export is older than its Shared video\./);
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
  it("lists what final/ holds in the record in force when a take-over lands while a finish again copies, so neither Mac is stuck (T1)", async () => {
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
    assert.equal((await on(t.ctx.deps, "open", FOLDER, "--take-over")).code, 0);
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
  it("copies again a copy more than 2 seconds older than what it copies (T13, the bound)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    const share = t.shared(`${PROJECT["reel 1"]}.mov`, 437, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const copy = join(found.folder, "edit", "from-final-cut", `${PROJECT["reel 1"]}.mov`);
    const older = new Date(statSync(share).mtimeMs - 2500);
    utimesSync(copy, older, older);
    const before = t.clones.length;
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.deepEqual(t.clones.slice(before).filter(([, to]) => to.includes("from-final-cut")).map(([, to]) => to.split("/").pop()), [`${PROJECT["reel 1"]}.mov`]);
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
  it("copies again, and lists, a copy at its Share's size and time that the record does not list (T12, W16)", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: MINE2 } });
    t.shared(`${PROJECT["reel 1"]}.mov`, 0, "reel one");
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    // Left by an earlier release whose record was never written: there, whole, and listed nowhere.
    const rel = `edit/from-final-cut/${PROJECT["reel 1"]}.mov`;
    const now = reread(found);
    const { [rel]: _gone, ...files } = now.files;
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, files }));
    const before = t.clones.length;
    assert.equal((await on(t.ctx.deps, "release", FOLDER, "--no-hand-edits")).code, 0);
    assert.deepEqual(t.clones.slice(before).map(([, to]) => to).filter((to) => to.includes("from-final-cut")).map((to) => to.split("/").pop()), [`${PROJECT["reel 1"]}.mov`]);
    assert.equal(reread(found).files[rel], 8);
    assert.equal(reread(found).released.files[rel], 8);
    t.done();
  });
});

