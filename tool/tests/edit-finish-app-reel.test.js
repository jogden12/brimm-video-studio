// finish from the projects that `app` and `app … reel N` make (plan PR 7, checked against PR 5 once it was merged): the main project is made
// by app.js (PR 4) and the Reel's by app-reel.js (PR 5), through edit.js with the stand-in for the pinned command line, and not as an entry
// written by hand in the record. What exportsFound reads (`app.projects[]` with `fromSuggestion`, and the Reel's entry in `record.reels`) is
// what those commands wrote, and finish must find the exports of those projects by it, hand the Reel off, and leave a Reel out that she
// dropped after it was made (review I3). No program runs: the stand-ins answer for the command line, ffprobe, ffmpeg and the transcriber.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { editMain, finishEpisode } from "../edit.js";
import { reelStretch } from "../app-reel.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { downloadsFolder, episodeWork, writeSettings } from "../settings.js";
import { reelCopyKey, reelCopyPaths, workCopyKey, workCopyPaths } from "../workcopy.js";
import { FOLDER, reread } from "./episodes.js";
import { episode, episodeFiles } from "./phase4.js";
import { MAIN, REEL2, ZONE, exportOf, ms, named, probeFor, whisper } from "./exports-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const REEL2_OPENING = "So the first thing you need to do is know your costs.";
// The project `app` makes has nothing on its picture yet, so finish asks what is on it (plan PR 8): she says there is nothing.
const NONE_FOUND = "I found no words on the main video's picture. Say what is on screen, or say that nothing is.";
const NOTHING = { noOnScreen: true };

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Every file under a folder gets the time `at`, as a project last changed then and not now (the made-up Mac's clock is the test's). */
function settle(dir, at) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) settle(path, at);
    else utimesSync(path, new Date(at), new Date(at));
  }
}

/** The made-up recording (phase4.js, Reel 2 a candidate, as the import files it), on a Mac set up for the app, with the working copies the
    detached runs would have made for the main video and for Reel 2 (workcopy.js), and then the main project made by `app "<episode>"` and
    Reel 2's by `app "<episode>" reel 2`: PR 4's code and PR 5's, with the stand-in for the pinned command line. Each project's files are
    given the time 13:40, so that an export made after it is newer. Gives the world exports-world.js's exportOf takes. */
async function madeByApp() {
  const { t, found } = episode({ version: 3, kind: "raw", answer: ANSWERED }, { FFPROBE: probeFor(), WHISPER: whisper() }, episodeFiles({ picked: false }));
  writeSettings(t.home, { app: "hyperframes", handoffVersion: 2 });
  t.ctx.settings = { ...t.ctx.settings, app: "hyperframes", handoffVersion: 2 };
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  t.ctx.deps.zone = ZONE;
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const copy = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  mkdirSync(dirname(copy.video), { recursive: true });
  writeFileSync(copy.video, "the working copy's bytes");
  writeFileSync(copy.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: 24 }));
  const { stretch } = reelStretch(found.folder, 2);
  const reel = reelCopyPaths(t.home, FOLDER, 2, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, stretch));
  mkdirSync(dirname(reel.video), { recursive: true });
  writeFileSync(reel.video, "the Reel's bytes");
  writeFileSync(reel.facts, JSON.stringify({ seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, fps: 30, width: 1280, height: 720, bytes: 16, stretch }));
  const mainRun = await on(t.ctx.deps, "app", FOLDER);
  assert.equal(mainRun.code, 0, mainRun.text);
  const reelRun = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
  assert.equal(reelRun.code, 0, reelRun.text);
  const work = episodeWork(t.home, FOLDER);
  const names = Object.fromEntries(reread(found).app.projects.map((p) => [p.key, p.name]));
  for (const name of Object.values(names)) {
    settle(join(work, name), ms(13, 40));
    // The app makes renders/ in a project when it first exports, and leaves its record of each export there (A0).
    mkdirSync(join(work, name, "renders"), { recursive: true });
  }
  return { t, found, work, names, downloads: downloadsFolder(t.home), dirOf: (key) => join(work, names[key]), asked: () => JSON.parse(readFileSync(join(work, "finish.asked.json"), "utf8")) };
}
const record = (w) => reread(w.found);

describe("finish from the projects `app` and `app … reel N` make (PR 4's code and PR 5's)", () => {
  it("has the projects PR 4 and PR 5 write: the main project and Reel 2's, which was a candidate and is picked, made from suggestion 2", async () => {
    const w = await madeByApp();
    const projects = record(w).app.projects;
    assert.deepEqual(projects.map((p) => [p.key, p.name, p.fromSuggestion, p.state]), [["main", MAIN, null, "opened"], ["reel 2", REEL2, 2, "opened"]]);
    assert.deepEqual(record(w).reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "picked"]]);
    w.t.done();
  });
  it("finds the export of each project by the names PR 4 and PR 5 gave them, takes the Reel the HyperFrames way, and hands it off with the main video", async () => {
    const w = await madeByApp();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, {}), 0, w.t.said());
    assert.deepEqual(w.t.said().split("\n"), [
      `The main video: ${named(MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`,
      `Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`,
      NONE_FOUND
    ]);
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, { yes: true, ...NOTHING }), 0, w.t.said());
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.project, p.fromSuggestion, p.expected]), [["main", MAIN, null, ""], ["reel 2", REEL2, 2, REEL2_OPENING]]);
    const found = { ...w.found, record: record(w) };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([handoff.main.file, handoff.reels.map((r) => [r.n, r.title, r.file, r.fromSuggestion])], [main.name, [[2, "Know your costs", reel.name, 2]]]);
    assert.deepEqual(record(w).app.projects.map((p) => [p.key, p.state]), [["main", "finished"], ["reel 2", "finished"]]);
    assert.deepEqual(record(w).reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "finished"]]);
    assert.deepEqual(readdirSync(w.downloads), [], "what it took from Downloads is removed after the late check");
    w.t.done();
  });
  it("asks for the Reel's export when there is none, as for any Reel project, and the main video's is taken all the same", async () => {
    const w = await madeByApp();
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, {}), 0);
    assert.equal(w.t.said().split("\n")[1], "Reel 2 has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name.");
    w.t.done();
  });
  it("leaves out a Reel she dropped after it was made, with `reel drop`: not asked for, not handed off, and still dropped", async () => {
    const w = await madeByApp();
    const dropped = await on(w.t.ctx.deps, "reel", "drop", FOLDER, "2");
    assert.equal(dropped.code, 0, dropped.text);
    assert.deepEqual(record(w).reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "dropped"]]);
    // Without an export of it, nothing is asked of it.
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [`The main video: ${named(MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`, NONE_FOUND]);
    // With an old export of it in Downloads, it is not handed off either.
    const reel = exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, { yes: true, ...NOTHING }), 0, w.t.said());
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main"]);
    const result = await finishNow(w.t.ctx, { ...w.found, record: record(w) });
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = JSON.parse(readFileSync(join(w.found.folder, "final", HANDOFF), "utf8"));
    assert.deepEqual(handoff.reels, []);
    assert.deepEqual(record(w).reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "dropped"]]);
    assert.deepEqual(record(w).app.projects.map((p) => [p.key, p.state]), [["main", "finished"], ["reel 2", "opened"]]);
    assert.deepEqual(readdirSync(w.downloads), [reel.name], "its export in Downloads is not touched");
    w.t.done();
  });
  it("takes a Reel again that she dropped and then made again, which PR 5's `app … reel N` picks again", async () => {
    const w = await madeByApp();
    assert.equal((await on(w.t.ctx.deps, "reel", "drop", FOLDER, "2")).code, 0);
    const again = await on(w.t.ctx.deps, "app", FOLDER, "reel", "2");
    assert.equal(again.code, 0, again.text);
    assert.deepEqual(record(w).reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "picked"]]);
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: record(w) }, { yes: true, ...NOTHING }), 0, w.t.said());
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main", "reel 2"]);
    w.t.done();
  });
});
