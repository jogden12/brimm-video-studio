// Phase 2 ("Final Cut retired"), F5: one Mac edits a video from start to finish. `release`, the hand-over snapshots, the rebuild from a
// snapshot, the set-aside of an older project and `--take-over` are gone; the claim stays, so the other Mac is still refused, in three new
// sentences. Records are never rewritten: an old record from a hand-over still reads. No program is run: every one is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { episodeFault, filesProblems, readEpisode, recordFile, recordText } from "../episode.js";
import { lookForExports, fixedZone } from "../exports.js";
import { PIN } from "../hyperframes.js";
import { episodeWork, writeSettings } from "../settings.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { setup, episodeFor, reread, listAll, EDITED, FOLDER, NAME, PROJECT } from "./episodes.js";
import { episode } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const HERS = { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" };
const WORKING_COPY = "the working copy's bytes";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-20T15:00:00-05:00", private: "no" };
const RAW = { version: 3, kind: "raw", answer: ANSWERED };

/** Run a command of edit.js on a Mac, by its deps: { code, said, text }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** The made-up raw video of phase4.js, answered, with this Mac set up for the app and its working copy made (edit-app.test.js's world). */
function appWorld({ record = RAW } = {}) {
  const { t, found } = episode(record);
  writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, WORKING_COPY);
  writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: WORKING_COPY.length }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  return { t, found, work: episodeWork(t.home, FOLDER) };
}
const madeOn = (on, over = {}) => ({
  ...RAW, version: 4,
  app: { toolchain: PIN.version, projects: [{
    key: "main", name: "Pricing- what to charge- main 3fa9c1", madeAt: "2026-10-19T10:00:00-05:00", on, from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
    workingCopy: { bytes: WORKING_COPY.length, seconds: 23.423, fps: 30 }, opened: ["2026-10-19T10:05:00-05:00"], handover: false, fromSuggestion: null, state: "opened", ...over
  }] }
});

describe("release is no command", () => {
  it("prints the help and ends with 2, and is in no list of commands", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, editing: { by: "Mac Studio", since: HERS.since } } });
    assert.ok(!COMMAND_NAMES.includes("release"));
    const r = await on(t.ctx.deps, "release", FOLDER);
    assert.deepEqual([r.code, r.said], [2, [HELP]]);
    assert.doesNotMatch(HELP, /release|snapshot|--take-over|hand-edits-stay/);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
});

describe("--take-over is no flag", () => {
  it("makes open, app and app … reel print the help and end with 2, and claims nothing", async () => {
    for (const argv of [["open", FOLDER, "--take-over"], ["app", FOLDER, "--take-over"], ["app", FOLDER, "reel", "2", "--take-over"]]) {
      const { t, found } = appWorld({ record: { ...RAW, editing: HERS } });
      const before = listAll(found.folder);
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.said], [2, [HELP]], argv.join(" "));
      assert.deepEqual([reread(found).rev, reread(found).editing, listAll(found.folder), t.started, t.waits], [1, HERS, before, [], []], argv.join(" "));
      t.done();
    }
  });
});

describe("the other Mac's claim", () => {
  it("is told by open, app, title and spell in one sentence, and they write nothing", async () => {
    const held = `Sallie's laptop has ${NAME} open. Carry on there. Nothing was changed.`;
    for (const argv of [["open", FOLDER], ["app", FOLDER], ["title", FOLDER, "--words", "Price it right", "--approve", "--change"], ["spell", FOLDER, "add", "Ogdin", "Ogden"]]) {
      const { t, found } = appWorld({ record: { ...RAW, name: { text: NAME, placeholder: false }, editing: HERS } });
      const before = listAll(found.folder);
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.said.at(-1)], [1, held], argv.join(" "));
      assert.deepEqual([reread(found).rev, reread(found).editing, listAll(found.folder), t.started, t.waits], [1, HERS, before, [], []], argv.join(" "));
      t.done();
    }
  });
  it("is not told with a way to take the episode over", async () => {
    const { t } = appWorld({ record: { ...RAW, editing: HERS } });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.doesNotMatch(r.text, /take it over|take-over|handed over/);
    t.done();
  });
});

describe("a project made on the other Mac", () => {
  it("is told by app in one sentence, with nothing claimed, brought or made, whoever has the episode", async () => {
    for (const extra of [{}, { editing: HERS }]) {
      const { t, found, work } = appWorld({ record: { ...madeOn("Sallie's laptop"), name: { text: NAME, placeholder: false }, ...extra } });
      const before = listAll(found.folder);
      const workBefore = listAll(work);
      const r = await on(t.ctx.deps, "app", FOLDER);
      assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project of ${NAME} is on Sallie's laptop. Carry on there.`]]);
      assert.deepEqual([reread(found).rev, reread(found).editing, listAll(found.folder), listAll(work), t.started, t.waits], [1, extra.editing ?? null, before, workBefore, [], []]);
      t.done();
    }
  });
  it("is told for a Reel's project in the same words, with the Reel named", async () => {
    const { t, found } = appWorld({ record: { ...madeOn("Sallie's laptop", { key: "reel 2", name: "Pricing- what to charge- reel 2 3fa9c1" }), name: { text: NAME, placeholder: false } } });
    const r = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project of Reel 2 of ${NAME} is on Sallie's laptop. Carry on there.`]]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("makes a project of this Mac's own again, under its own name, when its folder is gone and no snapshot is listed", async () => {
    const { t, found, work } = appWorld({ record: madeOn("Mac Studio") });
    const name = "Pricing- what to charge- main 3fa9c1";
    assert.ok(!existsSync(join(work, name)));
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(readFileSync(join(work, name, "media", "recording.mp4"), "utf8"), WORKING_COPY);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.name, p.on, p.state]), [["main", name, "Mac Studio", "opened"]]);
    t.done();
  });
});

describe("an old record from a hand-over still reads", () => {
  const SNAP = "app-snapshot/2026-10-20 20.00.00Z/Pricing- what to charge- main 3fa9c1/index.html";
  const EXPORT = "edit/from-hyperframes/Pricing- what to charge- main 3fa9c1 2026-10-20 13.40.mp4";
  /** An episode whose record lists a hand-over: its files on disk, `released` with its files and answers. */
  function handedOver() {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, version: 4 }, files: { "Pricing talk.mp4": "the raw video", [SNAP]: "<html>a</html>", [EXPORT]: "a video" } });
    const first = readEpisode(found.folder).record;
    const files = { ...first.files };
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files, editing: null, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { [SNAP]: files[SNAP], [EXPORT]: files[EXPORT] }, answers: { main: { v: 5, said: "no changes" } } }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    return { t, found };
  }
  it("is listed by episodes, and passes the record's own checks", async () => {
    const { t, found } = handedOver();
    const record = reread(found);
    assert.equal(episodeFault(record, 4), "");
    assert.deepEqual(filesProblems(found.folder, record), []);
    const r = await on(t.ctx.deps, "episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes(NAME), r.text);
    t.done();
  });
  it("has its snapshot and export files checked as any listed file is", async () => {
    const { t, found } = handedOver();
    writeFileSync(join(found.folder, SNAP), "<html>shorter</html>!!!");
    const problems = filesProblems(found.folder, reread(found));
    assert.equal(problems.length, 1);
    assert.ok(problems[0].startsWith(`${SNAP} is `), problems[0]);
    const open = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(open.code, 1);
    assert.ok(open.text.includes(SNAP), open.text);
    t.done();
  });
  it("shows its difference in resolve, the handed-over file's size included", async () => {
    const { t, found } = handedOver();
    const two = readEpisode(found.folder).record;
    const copy = `${SNAP.replace(".html", "")} (Sallie's laptop's conflicted copy 2026-10-20).html`;
    writeFileSync(join(found.folder, copy), "<html>longer, from the other Mac</html>");
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes("The record in force lists A's size for it."), r.text);
    assert.ok(two.released, "the record still holds released");
    const kept = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(kept.code, 0, kept.text);
    const now = readEpisode(found.folder).record;
    assert.equal(now.released.files[SNAP], now.files[SNAP]);
    t.done();
  });
});

describe("a new record keeps released: null", () => {
  it("is what open's claim and kind's claim write, and what the finish writes", async () => {
    const t = setup();
    const found = episodeFor(t);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    const claimed = reread(found);
    assert.equal(claimed.released, null);
    assert.equal(claimed.editing.by, "Mac Studio");
    assert.equal(episodeFault(claimed, 4), "");
    t.done();
    // The finish's claim (edit-two-macs.test.js's world): the record it writes keeps released: null and has this Mac editing.
    const u = setup();
    const done = episodeFor(u, { record: EDITED });
    u.shared(`${PROJECT.main}.mp4`, 2000);
    u.shared(`${PROJECT.main}.fcpxmld`, 3000);
    u.shared(`${PROJECT["reel 1"]}.mov`, 2000);
    u.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
    u.shared(`${PROJECT["reel 2"]}.mov`, 2000);
    const finished = await on(u.ctx.deps, "finish", FOLDER, "--yes", "--no-hand-edits", "reel 2");
    assert.equal(finished.code, 0, finished.text);
    assert.equal(reread(done).released, null);
    assert.equal(reread(done).editing.by, "Mac Studio");
    assert.equal(episodeFault(reread(done), 4), "");
    u.done();
    const w = appWorld({ record: { ...RAW, kind: null, answer: { ...ANSWERED, state: "needs your answer", guess: "raw" } } });
    const kind = await on(w.t.ctx.deps, "kind", FOLDER, "raw", "--private", "no");
    assert.equal(kind.code, 0, kind.text);
    assert.equal(reread(w.found).released, null);
    assert.ok(reread(w.found).editing, "kind claimed it");
    w.t.done();
  });
});

describe("finish --take with a Mac in it", () => {
  const P = "Pricing- what to charge- main 3fa9c1";
  const part = { key: "main", label: "the main video", project: P, fromSuggestion: null, here: true, mac: "Mac Studio", changed: null, recorded: [], renders: [] };
  const mp4 = { name: `${P} 2026-10-20 13.56.mp4`, bytes: 10, mtimeMs: Date.parse("2026-10-20T13:58:00-04:00") };
  // Nothing is released into the episode any more: the input holds Downloads alone.
  const input = { parts: [part], downloads: { dir: "/Downloads", files: [mp4] }, finished: null, zone: fixedZone(-240) };
  it("is read as a file named \"the other Mac\" or \"this Mac\", which is not there, in the words a missing file gets", () => {
    for (const said of ["the other Mac", "this Mac"]) {
      const got = lookForExports(input, { take: { main: said } });
      assert.deepEqual(got.asks, [`"${said}" is not an export of the main video. The ones there are: ${mp4.name}. Which is the final one?`]);
      assert.deepEqual(got.parts, []);
    }
  });
  it("looks in Downloads alone, and says so", () => {
    const got = lookForExports(input, {});
    assert.equal(got.looked, `Looked in Downloads for exports of: ${P}.`);
    assert.equal(got.parts[0].video.where, "Downloads");
  });
});
