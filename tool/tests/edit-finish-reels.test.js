// finish "<episode>" reels, the quick part (plan PR 9, groups 1 to 6; architecture 2026-10-27, 4.3 and 8.7): the Reels of a video her editor
// finished, made in HyperFrames and exported, are found, asked about and started for a hand-off that is the next revision of the one the
// video has. edit.js finds the episode through the gate, refuses what the record and the hand-off on file refuse, finds each Reel's export
// as PR 7 does (exports.js), and starts the detached part (finish-reels-now.test.js). These tests run it in reels-world.js's world,
// through finishEpisode and through editMain, with stand-ins for every program: nothing here touches the real Downloads folder, Dropbox or
// BRIMM Video Work.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { episodeWork } from "../settings.js";
import { finishFinished } from "../finish.js";
import { HELD, LEFT } from "../gate.js";
import { DOWNLOADS_UNREADABLE } from "../exports.js";
import { recordFile, recordText } from "../episode.js";
import { BRINGING, START, missingWords, noHandoffWords, noReelWords, nothingNewWords, otherKindWords, rawWords, unusableWords } from "../finish-reels.js";
import { FOLDER, NAME, episodeAs, episodeFor, listAll, reread, setup } from "./episodes.js";
import { PIN } from "../hyperframes.js";
import { REEL1, REEL2, changeAt, entry, exportOf, named } from "./exports-world.js";
import { HANDOFF_REL, REEL2_OPENING, finishedWorld } from "./reels-world.js";

const AT = "2026-10-20T15:00:00-05:00";
const worlds = [];
/** The finished video of reels-world.js, kept until the tests are done. */
async function W(opts) {
  const w = await finishedWorld(opts);
  worlds.push(w);
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});
const linesOf = (w) => (w.t.said() === "" ? [] : w.t.said().split("\n"));
/** finish asked for the Reels with `answers`, once, as the episode is now: its code, and the lines it said. */
async function ask(w, answers = {}) {
  const had = linesOf(w).length;
  const code = await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, ...answers });
  return { code, lines: linesOf(w).slice(had) };
}
/** A command of edit.js by its deps: its code, and what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}
/** The record written again with `change` laid over it, as a command of another Mac, or of the app, would leave it. */
function rewrite(w, change) {
  const now = reread(w.found);
  writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...(typeof change === "function" ? change(now) : change) }));
}
/** The episode's folder as it is: every file in it, to see that a refusal changed none. */
const tree = (w) => listAll(w.found.folder);
const started = (w) => w.t.started.map(([, args]) => args.slice(-3));

describe("1. the form: finish <episode> reels", () => {
  it("is asked by the folder and by words of the name, and says what it found for each Reel and what to say to start", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    for (const argv of [[FOLDER, "reels"], ["Pricing", "reels"], ["Pricing", "talk", "Reels"]]) {
      const r = await on(w.t.ctx.deps, "finish", ...argv);
      assert.deepEqual([r.code, r.said], [0, [`Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`, START]], argv.join(" "));
    }
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json"))], [[], false], "asking starts nothing and writes nothing");
  });
  it("takes `reels` after its flags too, and an episode called reels as any episode", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const flagged = await on(w.t.ctx.deps, "finish", FOLDER, "--yes", "reels");
    assert.equal(flagged.code, 0, flagged.said.join("\n"));
    assert.deepEqual(started(w), [["finish", "--now", FOLDER]]);
    const none = await on(w.t.ctx.deps, "finish", "reels");
    assert.deepEqual([none.code, none.said[0].startsWith('No episode fits "reels".')], [1, true]);
  });
  it("is not what `finish <episode>` does: that says the hand-off is written already, and sends a video whose Reels were made to this form", async () => {
    const WRITTEN = `${NAME}'s hand-off is written already, as revision 1: a spelling changed writes its next revision.`;
    const w = await W();
    exportOf(w, "reel 2");
    const plain = await on(w.t.ctx.deps, "finish", FOLDER);
    assert.deepEqual([plain.code, plain.said], [1, [`${WRITTEN} Its Reels are added after you export them from HyperFrames: say "hand off the Reels".`]]);
    assert.deepEqual(started(w), []);
    // A video with no Reel project, or whose only Reel project is kept for an earlier kind, is told what it was told.
    for (const over of [undefined, { app: { toolchain: PIN.version, projects: [entry("reel 2", { state: "kept for an earlier kind" })] } }]) {
      const none = await W({ projects: over ? ["reel 2"] : [], ...(over ? { over } : {}) });
      const said = await on(none.t.ctx.deps, "finish", FOLDER);
      assert.deepEqual([said.code, said.said], [1, [WRITTEN]]);
    }
  });
});

describe("2. the gate", () => {
  const ANSWER = { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera" };
  const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "yes" };
  const SESSION = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
  const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
  const WAITING = "This video is waiting for its answer: say what it is first.";
  const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
  const taught = (t) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } });

  it("refuses a video not yet answered, one she left alone and a session not cleared with teachings off, in the gate's words, and starts and writes nothing", async () => {
    const records = [
      [{ version: 3, kind: null, answer: ANSWER, label: LABEL }, WAITING],
      [{ version: 3, kind: null, answer: { ...ANSWER, state: "not for brimm-video" }, label: LABEL }, LEFT],
      [{ version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-20", session: SESSION }, TEACHINGS_OFF]
    ];
    for (const [record, words] of records) {
      const t = setup();
      const found = episodeFor(t, { record });
      const before = listAll(found.folder);
      const r = await on(t.ctx.deps, "finish", FOLDER, "reels");
      assert.deepEqual([r.code, r.said, t.started, t.calls, listAll(found.folder)], [1, [words], [], [], before], words);
      t.done();
    }
  });
  it("refuses a session not cleared, with teachings on, in cannotFinish's words, naming it by its label: the session's own hand-off is not written", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-20", session: SESSION } });
    const before = listAll(found.folder);
    const r = await on(taught(t), "finish", FOLDER, "reels");
    assert.deepEqual([r.code, r.said], [1, ["Session, 2026-10-20 is a client or group session: brimm-video cannot finish a session yet. Nothing was written."]]);
    assert.deepEqual([t.started, t.calls, listAll(found.folder)], [[], [], before]);
    t.done();
  });
  it("refuses a video held beside a session, in the gate's words", async () => {
    const OLD = "e-20261010-a0a0a0";
    const w = await W();
    episodeAs(w.t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION } });
    rewrite(w, { versionOf: OLD });
    const before = tree(w);
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "reels");
    assert.deepEqual([r.code, r.said, w.t.started, tree(w)], [1, [HELD], [], before]);
  });
  it("runs for a session whose mark was cleared, which is an ordinary finished video by then", async () => {
    const w = await W({ over: { session: { ...SESSION, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } } });
    exportOf(w, "reel 2");
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "reels");
    assert.deepEqual([r.code, r.said.at(-1)], [0, START]);
  });
});

describe("3. the refusals: each ends with 1 and claims, writes and starts nothing", () => {
  /** Asked, and checked to have changed nothing but what `started` says. */
  async function refused(w, words, { starts = [] } = {}) {
    const before = tree(w);
    const rev = reread(w.found).rev;
    const r = await ask(w, { yes: true });
    assert.deepEqual([r.code, r.lines], [1, words], words.join(" "));
    assert.deepEqual([started(w), tree(w), reread(w.found).rev, existsSync(join(w.work, "finish.asked.json"))], [starts, before, rev, false], words.join(" "));
  }
  it("says a short video has no Reels", async () => {
    await refused(await W({ handoff: false, over: { kind: "short video" } }), ["A short video has no Reels."]);
  });
  it("says a raw video's Reels are handed off with its main video", async () => {
    await refused(await W({ handoff: false, over: { kind: "raw" } }), [rawWords(NAME)]);
  });
  it("says who has the episode open when another Mac does", async () => {
    const w = await W();
    rewrite(w, { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
    await refused(w, [`Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`]);
  });
  it("says the hand-off waits for version 2 on a Mac that hands off version 1", async () => {
    await refused(await W({ handoff: false, handoffVersion: 1 }), [`${NAME}'s hand-off is written from its spellings once this Mac hands off version 2: ask Jason.`]);
  });
  it("says the hand-off is written once the spellings are answered when there is none yet, and never writes the first", async () => {
    const w = await W({ handoff: false });
    exportOf(w, "reel 2");
    await refused(w, [noHandoffWords(NAME)]);
    assert.equal(existsSync(join(w.found.folder, "final")), false);
  });
  it("says it waits for the new reading when the hand-off was made as another kind than the video is now", async () => {
    const w = await W();
    rewrite(w, (now) => ({ finished: { ...now.finished, parts: { main: { ...now.finished.parts.main, kind: "short video" } } } }));
    await refused(w, [otherKindWords(NAME)]);
  });
  it("says the hand-off cannot be used when it cannot be read, or is not a version 2 hand-off of a finished video", async () => {
    for (const text of ["not json", JSON.stringify({ format: "brimm-video hand-off", version: 1, revision: 1 })]) {
      const w = await W();
      writeFileSync(join(w.found.folder, HANDOFF_REL), text);
      await refused(w, [unusableWords(NAME)]);
    }
  });
  it("says the hand-off is not there, and to ask Jason, when it is gone from the folder, and starts no bring: there is nothing to bring over (the review's I2)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rmSync(join(w.found.folder, HANDOFF_REL));
    // As the Mac's own check has it, a file that is not there is not whole: it used to be taken for one Dropbox was bringing.
    w.t.ctx.isWhole = (path) => existsSync(path);
    await refused(w, [missingWords(NAME)]);
  });
  it("asks Dropbox to bring the hand-off over when it is not whole here, once, and says to say it again", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    w.t.ctx.isWhole = (path) => !path.endsWith(".brimm-ops.json");
    const before = tree(w);
    const r = await ask(w, { yes: true });
    assert.deepEqual([r.code, r.lines, tree(w)], [1, [BRINGING], before]);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(-4)), [["bring", "--now", FOLDER, HANDOFF_REL]], "it brings the hand-off over, once");
    // While the bring runs, asking again says the same and starts no second one.
    mkdirSync(episodeWork(w.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(w.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "bring" }));
    w.t.ctx.alive = (pid) => pid === 4242;
    const again = await ask(w, { yes: true });
    assert.deepEqual([again.code, again.lines, w.t.started.length], [1, [BRINGING], 1]);
  });
  it("says no Reel is made yet when the record has no Reel project", async () => {
    await refused(await W({ projects: [] }), [noReelWords(NAME)]);
  });
  it("says there is nothing new when every Reel is kept as the last finish made it, and when the only Reel was dropped", async () => {
    const w = await W();
    rewrite(w, (now) => ({ finished: { ...now.finished, parts: { ...now.finished.parts, "reel 2": { file: `final/${named(REEL2, "14.03")}`, bytes: 8, seconds: 75, source: { bytes: 8, mtimeMs: 1 }, project: REEL2 } } } }));
    await refused(w, [`Reel 2: kept as the last finish made it.`, nothingNewWords(NAME, 1)]);
    const dropped = await W();
    rewrite(dropped, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r)) }));
    const export_ = exportOf(dropped, "reel 2");
    await refused(dropped, [nothingNewWords(NAME, 1)]);
    assert.deepEqual(readdirSync(dropped.downloads), [export_.name], "the export of a Reel she dropped is not touched");
  });
  it("says a finish is running for the episode, as PR 7 does", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    mkdirSync(episodeWork(w.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(w.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    w.t.ctx.alive = (pid) => pid === 4242;
    const r = await ask(w, { yes: true });
    assert.equal(r.code, 1);
    assert.ok(r.lines.includes('finish is running for this episode. Say "how far is it?"'), r.lines.join("\n"));
    assert.deepEqual(w.t.started, []);
  });
  it("says a file of the episode is not whole in Dropbox, and that this Mac does not let it look in Downloads, as PR 7 does", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    writeFileSync(join(w.found.folder, "Pricing talk.srt"), "short");
    const gone = await ask(w, { yes: true });
    assert.equal(gone.code, 1);
    assert.match(gone.lines.join("\n"), /is not whole in Dropbox: .*Pricing talk\.srt/);
    const locked = await W();
    locked.t.ctx.deps.readdir = () => {
      throw Object.assign(new Error("not allowed"), { code: "EPERM" });
    };
    const r = await ask(locked, { yes: true });
    assert.deepEqual([r.code, r.lines], [1, [DOWNLOADS_UNREADABLE]]);
  });
  it("says what a gap in the chain of the video's versions, or a version that is a session, says, as every hand-off writer does", async () => {
    const w = await W();
    rewrite(w, { versionOf: "e-20261010-7c1d2e" });
    exportOf(w, "reel 2");
    const r = await ask(w, { yes: true });
    assert.deepEqual([r.code, r.lines], [1, [`${NAME} is a new version of a video that is not on this Mac yet (e-20261010-7c1d2e). Wait for Dropbox to bring it over, then say it again. Nothing was written.`]]);
  });
});

describe("4. what it finds", () => {
  it("says what it found for each Reel and none for a main video, and asks about a Reel with no export: leave it out, or tell its file name", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    const NO_EXPORT = "Reel 1 has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name.";
    const r = await ask(w);
    assert.deepEqual(r.lines, [`Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`, NO_EXPORT]);
    assert.equal(r.code, 0);
    const answered = await ask(w, { yes: true });
    assert.deepEqual([answered.code, answered.lines.at(-1)], [0, NO_EXPORT]);
    assert.deepEqual(w.t.started, [], "a question left to answer starts nothing");
    const without = await ask(w, { yes: true, without: ["reel 1"] });
    assert.equal(without.code, 0, without.lines.join("\n"));
    assert.deepEqual(started(w), [["finish", "--now", FOLDER]]);
  });
  it("asks and answers as PR 7 does: an export older than the project's last change (--final), and a file she names (--take)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    changeAt(w, "reel 2", [14, 30, 0]);
    const older = await ask(w);
    assert.deepEqual(older.lines, [`Reel 2's newest export, ${named(REEL2, "14.03")}, began at 2026-10-20 14:03, before you last changed it in HyperFrames, at 2026-10-20 14:30. Export it again from HyperFrames on This Mac, or say that export is the final one.`]);
    const final = await ask(w, { final: ["reel 2"] });
    assert.deepEqual(final.lines, [`Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03. HyperFrames changed after it, and you said it is final.`, START]);
    const named_ = exportOf(w, "reel 2", { name: "my reel.mp4", record: false });
    const taken = await ask(w, { final: ["reel 2"], take: { "reel 2": "my reel.mp4" } });
    assert.equal(taken.lines[0], `Reel 2: ${named_.name}, from Downloads, the file you named.`);
  });
  it("keeps a Reel the last finish took when its export is gone, beside a Reel that is new", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    rewrite(w, (now) => ({ finished: { ...now.finished, parts: { ...now.finished.parts, "reel 2": { file: `final/${named(REEL2, "14.03")}`, bytes: 8, seconds: 75, source: { bytes: 8, mtimeMs: 1 }, project: REEL2 } } } }));
    exportOf(w, "reel 1");
    const r = await ask(w);
    assert.deepEqual(r.lines, [`Reel 1: ${named(REEL1, "14.00")}, from Downloads, exported 2026-10-20 14:00.`, "Reel 2: kept as the last finish made it.", START]);
  });
  it("asks for the title on screen of a Reel that has none, with the suggestion's first words", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) }));
    const r = await ask(w);
    assert.deepEqual(r.lines.slice(1), [`Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`]);
  });
  it("leaves out a Reel picked that has no project, and says so; and stops on a project whose Reel the record does not hold", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 1 ? { ...r, status: "picked" } : r)) }));
    const left = await ask(w);
    assert.deepEqual(left.lines, [`Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`, 'Reel 1 is picked but has no HyperFrames project, so it is left out. Say "make Reel 1" to make one.', START]);
    rewrite(w, (now) => ({ reels: now.reels.filter((r) => r.n !== 2) }));
    const stopped = await ask(w, { yes: true });
    assert.equal(stopped.code, 1);
    assert.ok(stopped.lines.includes("The record has no Reel 2 for its HyperFrames project: ask Jason."), stopped.lines.join("\n"));
  });
  it("mentions a WebM and never takes it", async () => {
    const w = await W();
    const webm = exportOf(w, "reel 2", { ending: "webm", record: false });
    const r = await ask(w);
    assert.ok(r.lines.includes(`${webm.name} is a WebM, which is not taken: export it again as MP4.`), r.lines.join("\n"));
    assert.ok(r.lines.some((line) => line.startsWith("Reel 2 has no export.")), r.lines.join("\n"));
  });
});

describe("5. what it starts", () => {
  it("with a yes writes what it was told on this Mac's disk, with the hand-off it is made from and a part for each Reel and none for main, claims the episode, and starts the detached part once", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    const reel1 = exportOf(w, "reel 1");
    const reel2 = exportOf(w, "reel 2");
    const had = reread(w.found).rev;
    const r = await ask(w, { yes: true });
    assert.deepEqual([r.code, r.lines.at(-1)], [0, "Started. The panel shows how far it is."]);
    assert.deepEqual(started(w), [["finish", "--now", FOLDER]]);
    const asked = w.asked();
    assert.deepEqual([asked.version, asked.source, asked.rev, asked.claimed], [1, "hyperframes", had + 1, true]);
    assert.deepEqual(asked.base, { handoff: HANDOFF_REL, revision: 1 });
    assert.deepEqual(asked.parts.map((p) => [p.key, p.label, p.reel, p.project, p.fromSuggestion, p.export, p.kept]), [
      ["reel 1", "Reel 1", 1, REEL1, 1, null, false],
      ["reel 2", "Reel 2", 2, REEL2, 2, null, false]
    ]);
    assert.deepEqual(asked.parts.map((p) => p.expected), ["Welcome to the show", REEL2_OPENING]);
    assert.deepEqual(asked.parts.map((p) => p.video.name), [reel1.name, reel2.name]);
    assert.equal(reread(w.found).editing.by, "Mac Studio");
  });
  it("does not claim an episode this Mac has open already, and says nothing of Final Cut", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } });
    const had = reread(w.found).rev;
    const r = await ask(w, { yes: true });
    assert.equal(r.code, 0);
    assert.deepEqual([w.asked().rev, w.asked().claimed], [had, undefined]);
    assert.ok(!/Final Cut|Share/.test(r.lines.join("\n")));
  });
  it("starts nothing and writes nothing while a question is left, even with a yes", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    const before = tree(w);
    const r = await ask(w, { yes: true });
    assert.equal(r.code, 0);
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json")), tree(w), reread(w.found).editing ?? null], [[], false, before, null]);
  });
});

describe("6. numbers: a Reel number is never given twice within a video", () => {
  const FIRST = "e-20261010-7c1d2e";
  /** The made-up finished video as a new version of an earlier one (`FIRST`), whose hand-off is written first with no suggestion and no
      Reel, so that the numbers are free then; and the earlier version's folder. */
  async function version() {
    const w = await W({ suggestions: false, handoff: false, over: { versionOf: FIRST } });
    const first = episodeAs(w.t, { id: FIRST, name: "2026-10-10 Pricing talk, first cut (Mac Studio)", record: { kind: "raw" } });
    const done = await finishFinished(w.t.ctx, w.found, { record: w.found.record });
    assert.equal(done.ok, true, done.why);
    return { w, first };
  }
  /** A hand-off of that earlier version that gave Reel `n`, laid in its final/ afterwards, as one Dropbox brings over later. */
  function gave(first, n) {
    const srt = "1\n00:00:00,000 --> 00:00:02,000\n Hi.\n\n";
    const handoff = { format: "brimm-video hand-off", version: 2, revision: 7, made: "2026-10-10T10:00:00-05:00", madeOn: "Mac Studio", madeBy: "brimm-video c709b57", video: { id: FIRST, kind: "raw", name: "Pricing talk", recorded: "2026-10-10", recordedFrom: "video" }, main: { file: "x.mp4", seconds: 10, srt }, reels: [{ n, title: "t", file: "r.mp4", seconds: 5, srt, fromSuggestion: null }], session: null };
    mkdirSync(join(first.folder, "final"), { recursive: true });
    writeFileSync(join(first.folder, "final", "Pricing talk, first cut.brimm-ops.json"), JSON.stringify(handoff));
  }
  it("refuses a Reel whose number another version of the video gave under the same id, before anything is waited for, and writes nothing", async () => {
    const { w, first } = await version();
    gave(first, 2);
    exportOf(w, "reel 2");
    const before = tree(w);
    const r = await ask(w, { yes: true });
    assert.deepEqual([r.code, r.lines], [1, [`${NAME}'s hand-off would give Reel 2 again: another version of the video gave that number already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]]);
    assert.deepEqual([w.t.started, tree(w), existsSync(join(w.work, "finish.asked.json"))], [[], before, false]);
  });
  it("goes on with a number the other version did not give", async () => {
    const { w, first } = await version();
    gave(first, 5);
    exportOf(w, "reel 2");
    const r = await ask(w, { yes: true });
    assert.equal(r.code, 0, r.lines.join("\n"));
    assert.deepEqual(started(w), [["finish", "--now", FOLDER]]);
  });
});
