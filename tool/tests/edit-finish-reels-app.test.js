// finish "<episode>" reels from the project that `app … reel N` makes (plan PR 9, group 12; checked against PR 5's real Reel projects as
// PR 7's edit-finish-app-reel.test.js is): the video her editor finished has its spellings answered through the spellings card, which
// writes its hand-off as revision 1 (finishFinished); Reel 2 is made by `app "<episode>" reel 2` (app-reel.js, with the stand-in for the
// pinned command line), and not as an entry written by hand in the record; it is exported; and `finish … reels` finds the export by the
// names and the records those commands wrote, and hands the Reel off as revision 2. No program runs: the stand-ins answer for the command
// line, ffprobe, ffmpeg and the transcriber, and the home is a temporary folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { editMain } from "../edit.js";
import { reelStretch } from "../app-reel.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { downloadsFolder, episodeWork, writeSettings } from "../settings.js";
import { reelCopyKey, reelCopyPaths } from "../workcopy.js";
import { FOLDER, ID, reread } from "./episodes.js";
import { episode, EPISODE } from "./phase4.js";
import { ZONE, exportOf, ms, named, probeFor } from "./exports-world.js";
import { HANDOFF_REL, REEL2_OPENING, finishedFiles, whisper } from "./reels-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const READING = { kind: "finished", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read" };

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Every file under a folder gets the time `at`, as a project last changed then and not now. */
function settle(dir, at) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) settle(path, at);
    else utimesSync(path, new Date(at), new Date(at));
  }
}

/** The made-up video her editor finished, read by Claude (its record holds the offers of the reading), on a Mac set up for the app that
    hands off version 2. Its spellings are answered through `spell … offers none`, which writes its hand-off as revision 1; then Reel 2 is
    made by `app "<episode>" reel 2`, with the Reel's video made already (workcopy.js), and the project's files are given the time 13:40.
    Gives the world exports-world.js's exportOf takes. */
async function madeByApp() {
  const record = { version: 3, kind: "finished", answer: ANSWERED, reading: READING, offers: { spellings: [] } };
  const { t, found } = episode(record, { FFPROBE: probeFor(), WHISPER: whisper() }, { files: finishedFiles(), record: EPISODE.record });
  writeSettings(t.home, { app: "hyperframes", handoffVersion: 2 });
  t.ctx.settings = { ...t.ctx.settings, app: "hyperframes", handoffVersion: 2 };
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  t.ctx.deps.zone = ZONE;
  const spelled = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
  assert.equal(spelled.code, 0, spelled.text);
  assert.equal(reread(found).finished.revision, 1, spelled.text);
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const { stretch } = reelStretch(found.folder, 2);
  const reel = reelCopyPaths(t.home, FOLDER, 2, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, stretch));
  mkdirSync(dirname(reel.video), { recursive: true });
  writeFileSync(reel.video, "the Reel's bytes");
  writeFileSync(reel.facts, JSON.stringify({ seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, fps: 30, width: 1280, height: 720, bytes: 16, stretch }));
  const made = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
  assert.equal(made.code, 0, made.text);
  const work = episodeWork(t.home, FOLDER);
  const names = Object.fromEntries(reread(found).app.projects.map((p) => [p.key, p.name]));
  for (const name of Object.values(names)) {
    settle(join(work, name), ms(13, 40));
    mkdirSync(join(work, name, "renders"), { recursive: true });
  }
  return { t, found, work, names, downloads: downloadsFolder(t.home), dirOf: (key) => join(work, names[key]), asked: () => JSON.parse(readFileSync(join(work, "finish.asked.json"), "utf8")) };
}

describe("finish … reels from the project `app … reel N` makes of a finished video (PR 5's code and PR 9's)", () => {
  it("has what PR 5 writes: Reel 2's project, made from suggestion 2, the Reel picked, and a hand-off of revision 1 that lists both suggestions and no Reel", async () => {
    const w = await madeByApp();
    const record = reread(w.found);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.fromSuggestion, p.state]), [["reel 2", 2, "opened"]]);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "picked"]]);
    const handoff = JSON.parse(readFileSync(join(w.found.folder, HANDOFF_REL), "utf8"));
    assert.deepEqual([handoff.revision, handoff.video.kind, handoff.suggestions.map((s) => s.n), handoff.reels], [1, "finished", [1, 2], []]);
    w.t.done();
  });
  it("finds Reel 2's export by the names and the record those commands wrote, asks nothing, and hands it off as revision 2 with main and the suggestions as they were", async () => {
    const w = await madeByApp();
    const before = JSON.parse(readFileSync(join(w.found.folder, HANDOFF_REL), "utf8"));
    const reel = exportOf(w, "reel 2");
    const first = await on(w.t.ctx.deps, "finish", FOLDER, "reels");
    assert.deepEqual([first.code, first.said], [0, [`Reel 2: ${named(w.names["reel 2"], "14.03")}, from Downloads, exported 2026-10-20 14:03.`, 'Say "yes, hand off the Reels" to start.']]);
    const started = await on(w.t.ctx.deps, "finish", FOLDER, "reels", "--yes");
    assert.deepEqual([started.code, started.said.at(-1)], [0, "Started. The panel shows how far it is."]);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.project, p.fromSuggestion, p.expected]), [["reel 2", w.names["reel 2"], 2, REEL2_OPENING]]);
    assert.deepEqual(w.asked().base, { handoff: HANDOFF_REL, revision: 1 });
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = JSON.parse(readFileSync(join(found.folder, HANDOFF_REL), "utf8"));
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([handoff.revision, handoff.video.id, handoff.video.kind], [2, ID, "finished"]);
    assert.deepEqual(handoff.main, before.main);
    assert.deepEqual(handoff.suggestions, before.suggestions);
    assert.deepEqual(handoff.reels.map((r) => [r.n, r.title, r.file, r.fromSuggestion, r.inMain]), [[2, "Know your costs", reel.name, 2, { start: 4.1, end: 11.8 }]]);
    const record = reread(w.found);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["reel 2", "finished"]]);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "finished"]]);
    assert.deepEqual(Object.keys(record.finished.parts), ["main", "reel 2"]);
    assert.deepEqual(readdirSync(w.downloads), [], "what it took from Downloads is removed after the late check");
    // A Reel that is in the hand-off is not dropped again, and the form has nothing new to hand off.
    const dropped = await on(w.t.ctx.deps, "reel", "drop", FOLDER, "2");
    assert.deepEqual([dropped.code, dropped.said], [1, ["Reel 2 is finished: it is in the hand-off already."]]);
    const again = await on(w.t.ctx.deps, "finish", FOLDER, "reels");
    assert.equal(again.code, 1);
    assert.match(again.text, /has no Reel exported since its hand-off was made, as revision 2, so there is nothing new to hand off/);
    w.t.done();
  });
});
