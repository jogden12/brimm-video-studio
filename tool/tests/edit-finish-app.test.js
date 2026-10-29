// finish from HyperFrames' exports, the part that looks and asks (plan PR 7, group D; architecture 2026-10-27, sections 4.1, 8.1): which way
// finish goes for a video, what it says of each part, what it asks and where it stops, and what it writes down for the detached part.
// It runs in the made-up world of exports-world.js: a raw video with a project on disk for the main video and for Reel 2, a Downloads
// folder in the test's own home, and the app's records of the exports a test makes. No program is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { localStamp, recordFile, recordText } from "../episode.js";
import { DOWNLOADS_UNREADABLE, NEVER_OPENED } from "../exports.js";
import { finishNow } from "../finish.js";
import { reelsFile } from "../reels.js";
import { episodeWork, writeSettings } from "../settings.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { EPISODE } from "./phase4.js";
import { FOUND, MAIN, REEL2, TAKEN, changeAt, entry, exportOf, ms, named, world } from "./exports-world.js";

/** Nothing she reads holds a path, a flag, or the name of a command. */
const PLAIN = /\/|--|~|\bedit\.js\b|\bnode\b|\bnpx\b/;
const plain = (lines) => {
  for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
};
/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
const REEL2_OPENING = "So the first thing you need to do is know your costs.";
const MAIN_LINE = `The main video: ${named(MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`;
const REEL_LINE = `Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`;
const START = 'Say "yes, hand it off" to start.';
/** The made-up recording's Reels, with Reel 2's title changed. */
const reelsWith = (title) => EPISODE.record.reels.map((r) => (r.n === 2 ? { ...r, title } : r));

describe("D1. finish goes the way the record says", () => {
  it("goes the HyperFrames way for a raw video with a main project in use, and says nothing of Final Cut", async () => {
    const w = world();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, FOUND, START]);
    plain(w.t.said().split("\n"));
    w.t.done();
  });
  it("goes the Final Cut way, untouched, for a raw video with pushes and no project, on a Mac set up for the app too", async () => {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    t.ctx.settings = { ...t.ctx.settings, app: "hyperframes" };
    const found = episodeFor(t, { record: EDITED });
    t.shared(`${PROJECT.main}.mp4`, 2000);
    t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    assert.equal(await finishEpisode(t.ctx, found, { without: ["reel 1", "reel 2"] }), 0);
    assert.match(t.said(), /The main video: Pricing- what to charge- main v5 3fa9c1\.mp4, from From Final Cut, with its export Pricing- what to charge- main v5 3fa9c1\.fcpxmld\./);
    assert.match(t.said(), /Say "yes, finish it" to start\.$/);
    t.done();
  });
  it("stops a raw video that was never opened in HyperFrames, on a Mac set up for the app, in HyperFrames' words", async () => {
    const w = world({ projects: null });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.deepEqual(w.t.said().split("\n"), [NEVER_OPENED]);
    assert.deepEqual([w.t.started, reread(w.found).rev], [[], 1]);
    plain([NEVER_OPENED]);
    w.t.done();
  });
  it("stops that video in Final Cut's words on a Mac that is not set up for the app, as it always did", async () => {
    const w = world({ projects: null, set: false });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    const lines = w.t.said().split("\n");
    assert.equal(lines[0], 'The main video was never shown in Final Cut. Say "show it in Final Cut" first, then Share it.');
    assert.match(lines.at(-1), /^Looked in /);
    w.t.done();
  });
  it("takes a project kept for an earlier kind for no project in use", async () => {
    const w = world({ projects: null, over: { version: 4, app: { toolchain: "0.8.208", projects: [{ ...entry("main"), state: "kept for an earlier kind" }] } } });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.deepEqual(w.t.said().split("\n"), [NEVER_OPENED]);
    w.t.done();
  });
});

describe("D2. what finish says of a part, and what it starts", () => {
  it("says the export it took for each part, then what is passed over, and with nothing left to ask and no yes starts nothing", async () => {
    const w = world();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    exportOf(w, "main", { start: [13, 50, 0], ending: "webm", record: false });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, FOUND, START]);
    assert.deepEqual([w.t.started, reread(w.found).rev, existsSync(join(w.work, "finish.asked.json"))], [[], 1, false]);
    w.t.done();
  });
  it("mentions a WebM she exported last, which it does not take", async () => {
    const w = world({ projects: ["main"] });
    exportOf(w, "main");
    exportOf(w, "main", { start: [13, 58, 0], ending: "webm", record: false });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n").slice(0, 3), [MAIN_LINE, `${named(MAIN, "13.58", "webm")} is a WebM, which is not taken: export it again as MP4.`, "Reel 2 is picked but has no HyperFrames project, so it is left out. Say \"make Reel 2\" to make one."]);
    w.t.done();
  });
  it("with a yes writes what it was told on this Mac's disk, claims the episode, starts the detached part once, and returns at once", async () => {
    const w = world();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.equal(w.t.started.length, 1);
    assert.deepEqual(w.t.started[0][1].slice(-3), ["finish", "--now", FOLDER]);
    const asked = w.asked();
    assert.deepEqual([asked.version, asked.source, asked.rev, asked.claimed], [1, "hyperframes", w.found.record.rev + 1, true]);
    assert.equal(reread(w.found).editing.by, "Mac Studio");
    assert.deepEqual(asked.parts.map((p) => [p.key, p.label, p.reel, p.project, p.projects, p.fromSuggestion, p.expected, p.export, p.kept, p.noHandEdits]), [
      ["main", "the main video", undefined, MAIN, [MAIN], null, "", null, false, false],
      ["reel 2", "Reel 2", 2, REEL2, [REEL2], 2, REEL2_OPENING, null, false, false]
    ]);
    assert.deepEqual(asked.parts[0].video, { name: main.name, dir: w.downloads, where: "Downloads", bytes: statSync(main.path).size, mtimeMs: statSync(main.path).mtimeMs });
    assert.deepEqual(asked.parts[1].video, { name: reel.name, dir: w.downloads, where: "Downloads", bytes: statSync(reel.path).size, mtimeMs: statSync(reel.path).mtimeMs });
    assert.match(w.t.said(), /Started\. The panel shows how far it is\.$/);
    w.t.done();
  });
  it("writes a part kept from the last finish with no file, and starts the finish all the same", async () => {
    const finished = { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { "reel 2": { file: "final/r2.mp4", bytes: 5, seconds: 75, source: { bytes: 5, mtimeMs: 1 }, project: REEL2 } } };
    const w = world({ over: { finished } });
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.t.said().split("\n").slice(0, 2), [MAIN_LINE, "Reel 2: kept as the last finish made it."]);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.kept, p.video && p.video.name]), [["main", false, named(MAIN, "13.56")], ["reel 2", true, null]]);
    assert.equal(w.t.started.length, 1);
    w.t.done();
  });
  it("lets the claim stand when another Mac does not hold it, and does not claim an episode this Mac already holds", async () => {
    const w = world({ over: { editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    const asked = w.asked();
    assert.deepEqual([asked.rev, asked.claimed], [w.found.record.rev, undefined]);
    w.t.done();
  });
});

describe("D2. the answers: take, final and without", () => {
  it("is told an older export is the final one, and takes it, saying so", async () => {
    const w = world({ projects: ["main"], over: { reels: [] } });
    exportOf(w, "main", { start: [13, 56, 40] });
    changeAt(w, "main", [14, 30, 0]);
    const asked = await on(w.t.ctx.deps, "finish", FOLDER);
    assert.equal(asked.code, 0);
    assert.match(asked.text, /^The main video's newest export, .*, began at 2026-10-20 13:56, before you last changed it in HyperFrames, at 2026-10-20 14:30\. Export it again from HyperFrames on This Mac, or say that export is the final one\./);
    assert.deepEqual(w.t.started, []);
    const told = await on(w.t.ctx.deps, "finish", FOLDER, "--final", "main", "--yes");
    assert.equal(told.code, 0, told.text);
    assert.equal(told.said[0], `${MAIN_LINE} HyperFrames changed after it, and you said it is final.`);
    assert.equal(w.t.started.length, 1);
    w.t.done();
  });
  it("is told a file by its name, whatever it is called", async () => {
    const w = world({ projects: ["main"] });
    writeFileSync(join(w.downloads, "my own export.mp4"), "mine");
    const told = await on(w.t.ctx.deps, "finish", FOLDER, "--take", "main=my own export.mp4", "--yes");
    assert.equal(told.code, 0, told.text);
    assert.equal(told.said[0], "The main video: my own export.mp4, from Downloads, the file you named.");
    assert.equal(w.asked().parts[0].video.name, "my own export.mp4");
    w.t.done();
  });
  it("is told to leave a Reel out, and goes on without it", async () => {
    const w = world();
    exportOf(w, "main");
    const asked = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(asked.code, 0);
    assert.deepEqual(asked.said, [MAIN_LINE, TAKEN, "Reel 2 has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name."]);
    assert.deepEqual(w.t.started, []);
    const told = await on(w.t.ctx.deps, "finish", FOLDER, "--without", "reel 2", "--yes");
    assert.equal(told.code, 0, told.text);
    assert.equal(w.t.started.length, 1);
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main"]);
    w.t.done();
  });
  it("takes the Final Cut answer about hand edits for nothing", async () => {
    const w = world({ projects: ["main"] });
    exportOf(w, "main");
    const told = await on(w.t.ctx.deps, "finish", FOLDER, "--no-hand-edits", "main", "--yes");
    assert.equal(told.code, 0, told.text);
    assert.equal(w.asked().parts[0].noHandEdits, false);
    w.t.done();
  });
});

describe("D3. what finish refuses, and Downloads", () => {
  it("refuses while the other Mac has the episode open, in the words it has always used", async () => {
    const w = world({ over: { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } } });
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /^Sallie's laptop has Pricing: what to charge\? open\. Open it here first/);
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json"))], [[], false]);
    w.t.done();
  });
  it("asks for the raw video's name first when it is still its file's", async () => {
    const w = world({ over: { name: { text: "Pricing talk", placeholder: true } } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /Give the episode its name first: it is still called "Pricing talk", from the video's file name\./);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("refuses a file of the episode that is not whole in Dropbox, and a finish already running", async () => {
    const w = world();
    exportOf(w, "main");
    exportOf(w, "reel 2");
    rmSync(join(w.found.folder, "Pricing talk.srt"));
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /is not whole in Dropbox: .*Pricing talk\.srt/);
    const busy = world();
    exportOf(busy, "main");
    exportOf(busy, "reel 2");
    mkdirSync(episodeWork(busy.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(busy.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    busy.t.ctx.alive = (pid) => pid === 4242;
    assert.equal(await finishEpisode(busy.t.ctx, busy.found, { yes: true }), 1);
    assert.match(busy.t.said(), /finish is running for this episode\. Say "how far is it\?"/);
    assert.deepEqual(busy.t.started, []);
    w.t.done();
    busy.t.done();
  });
  it("asks what a Reel's title on screen says when it has none, naming its first words", async () => {
    const w = world({ over: { reels: reelsWith("") } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.equal(w.t.said().split("\n").at(-1), `Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("stops when this Mac will not let the tool look in Downloads, in plain words, and starts nothing", async () => {
    for (const code of ["EPERM", "EACCES"]) {
      const w = world();
      exportOf(w, "main");
      const readdir = w.t.ctx.deps.readdir;
      w.t.ctx.deps.readdir = (dir, ...more) => {
        if (dir === w.downloads) throw Object.assign(new Error(`${code}: operation not permitted`), { code });
        return (readdir || readdirSync)(dir, ...more);
      };
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1, code);
      assert.deepEqual(w.t.said().split("\n"), [DOWNLOADS_UNREADABLE], code);
      assert.deepEqual([w.t.started, reread(w.found).rev], [[], 1], code);
      plain([DOWNLOADS_UNREADABLE]);
      w.t.done();
    }
  });
  it("takes a home with no Downloads folder for one with nothing in it", async () => {
    const w = world({ projects: ["main"], over: { reels: [] } });
    rmSync(w.downloads, { recursive: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /^The main video has no export yet\./);
    w.t.done();
  });
  it("stops, saying where it looked, when the main video has no export", async () => {
    const w = world();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    const lines = w.t.said().split("\n");
    assert.equal(lines[1], 'The main video has no export yet. Export it from HyperFrames on This Mac, as MP4, then say "hand it off" again. If HyperFrames is still exporting it, say it again when the export is done.');
    assert.equal(lines.at(-1), `Looked in Downloads and in what the other Mac released for exports of: ${MAIN}, ${REEL2}.`);
    assert.deepEqual(w.t.started, []);
    plain(lines.slice(0, 2));
    w.t.done();
  });
});

describe("D4. a Reel's place in the record", () => {
  it("refuses a Reel project with no Reel in the record, and starts nothing", async () => {
    const w = world({ over: { reels: [] } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /The record has no Reel 2 for its HyperFrames project: ask Jason\./);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("leaves out a Reel that is picked and has no project, and says so", async () => {
    const w = world({ projects: ["main"] });
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.t.said().split("\n").slice(0, 2), [MAIN_LINE, 'Reel 2 is picked but has no HyperFrames project, so it is left out. Say "make Reel 2" to make one.']);
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main"]);
    w.t.done();
  });
  it("says nothing of a Reel that is a candidate and not picked", async () => {
    const w = world({ projects: ["main"], over: { reels: EPISODE.record.reels.map((r) => ({ ...r, status: "candidate" })) } });
    exportOf(w, "main");
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, FOUND, START]);
    w.t.done();
  });
  // Review I3: a Reel dropped after its project was made (`reel drop 2`) is no part of a finish: it is not asked for, and an export of
  // it left in Downloads is not handed off, which would flip the Reel from dropped to finished.
  const DROPPED = EPISODE.record.reels.map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r));
  it("asks nothing of a Reel that has a project and was dropped, with or without an export of it", async () => {
    const without = world({ over: { reels: DROPPED } });
    exportOf(without, "main");
    assert.equal(await finishEpisode(without.t.ctx, without.found, {}), 0);
    assert.deepEqual(without.t.said().split("\n"), [MAIN_LINE, FOUND, START]);
    without.t.done();
    const w = world({ over: { reels: DROPPED } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.t.said().split("\n").slice(0, 1), [MAIN_LINE]);
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main"]);
    w.t.done();
  });
  it("leaves a dropped Reel dropped in the record when the episode is finished, and hands off the main video alone", async () => {
    const w = world({ over: { reels: DROPPED } });
    exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) });
    assert.equal(result.ok, true, result.failed.join(" "));
    const record = reread(w.found);
    assert.deepEqual(record.reels.map((r) => [r.n, r.status]), [[1, "candidate"], [2, "dropped"]]);
    assert.deepEqual(Object.keys(record.finished.parts), ["main"]);
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.state]), [["main", "finished"], ["reel 2", "opened"]]);
    assert.equal(existsSync(reel.path), true, "its export in Downloads is not touched");
    w.t.done();
  });
  it("still refuses a Reel project the record holds no Reel for at all, dropped or not", async () => {
    const w = world({ over: { reels: EPISODE.record.reels.filter((r) => r.n !== 2) } });
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /The record has no Reel 2 for its HyperFrames project: ask Jason\./);
    w.t.done();
  });
  // Review, minor 4: in an episode whose main video went the Final Cut way, a Reel with a project is still a Reel of HyperFrames': the stop for
  // a Reel the record does not hold, and the words a Reel with no title is expected to start with, are decided by the part, not the episode.
  const FC_MAIN = { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }] };
  const sharedMain = (w) => {
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  };
  it("refuses a Reel project the record holds no Reel for, in an episode whose main video went the Final Cut way too", async () => {
    const w = world({ projects: ["reel 2"], over: { main: FC_MAIN, reels: EPISODE.record.reels.filter((r) => r.n !== 2) } });
    sharedMain(w);
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.match(w.t.said(), /The record has no Reel 2 for its HyperFrames project: ask Jason\./);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("asks the title of such a Reel with the suggestion's first words, as for a raw video, and not the cut plan's", async () => {
    const candidate = { n: 2, start: 13.38, end: 21.287, ranges: [{ start: 13.38, end: 21.287 }], seconds: 7.907, title: "", reason: "It makes one point.", point: "Know your costs.", first: "So the first thing you need", last: "know your costs", words: "So the first thing you need to do is know your costs.", phrases: ["p7"], preview: null };
    const w = world({ projects: ["reel 2"], over: { main: FC_MAIN, reels: reelsWith("") } });
    const list = JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "read", made: "2026-10-20T12:00:00-05:00", candidates: [candidate] }));
    writeFileSync(join(w.found.folder, "reels.json"), list);
    const base = reread(w.found);
    writeFileSync(recordFile(w.found.folder, base.rev + 1), recordText({ ...base, rev: base.rev + 1, files: { ...base.files, "reels.json": Buffer.byteLength(list) } }));
    sharedMain(w);
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, {}), 0);
    assert.equal(w.t.said().split("\n").at(-1), 'Reel 2 has no title on screen. Say what it says: it starts "So the first thing you need".');
    w.t.done();
  });
  it("leaves a dropped Reel with a project out of a Final Cut episode's finish too, beside the Reels made in HyperFrames", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = world({ projects: ["reel 2"], over: { reels: DROPPED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.asked().parts.map((p) => p.key), ["main"]);
    w.t.done();
  });
});

describe("D5. a Reel made by `app … reel N`, in the record as plan PR 5 writes it", () => {
  it("has the names project.js gives the made-up episode's projects, which `app` and `app … reel 2` record", () => {
    assert.deepEqual([MAIN, REEL2], ["Pricing- what to charge- main 3fa9c1", "Pricing- what to charge- reel 2 3fa9c1"]);
  });
  /** The project entry `app "<episode>" reel 2` leaves once the app has opened it (app-reel.js madeEntry, then openProjectInApp): made
      from the recording as it is, the Reel's video its working copy, `fromSuggestion` the Reel's number, the state "opened". */
  const madeByApp = (found, over = {}) => {
    const raw = statSync(join(found.folder, "Pricing talk.mp4"));
    return {
      key: "reel 2", name: REEL2, madeAt: "2026-10-20T13:05:00-05:00", on: "Mac Studio",
      from: { file: "Pricing talk.mp4", bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) },
      workingCopy: { bytes: 19, seconds: 7.907, fps: 30 }, opened: ["2026-10-20T13:05:10-05:00"], handover: false, fromSuggestion: 2, state: "opened", ...over
    };
  };
  it("takes such a Reel the HyperFrames way, from its project's export, and not as a Reel picked with no Share", async () => {
    const w = world({ projects: ["main"] });
    // The record as `app … reel 2` writes it: the Reel's project beside the main video's, and the Reel marked picked.
    const base = reread(w.found);
    writeFileSync(recordFile(w.found.folder, base.rev + 1), recordText({ ...base, rev: base.rev + 1, app: { ...base.app, projects: [...base.app.projects, madeByApp(w.found)] }, reels: base.reels.map((r) => (r.n === 2 ? { ...r, status: "picked" } : r)) }));
    mkdirSync(join(w.dirOf("reel 2"), "renders"), { recursive: true });
    writeFileSync(join(w.dirOf("reel 2"), "index.html"), "<html></html>");
    utimesSync(join(w.dirOf("reel 2"), "index.html"), new Date(ms(13, 40)), new Date(ms(13, 40)));
    exportOf(w, "main");
    exportOf(w, "reel 2");
    const found = { ...w.found, record: reread(w.found) };
    assert.equal(await finishEpisode(w.t.ctx, found, { yes: true }), 0);
    assert.deepEqual(w.t.said().split("\n").slice(0, 2), [MAIN_LINE, REEL_LINE]);
    assert.doesNotMatch(w.t.said(), /picked but has no HyperFrames project|Shared|Final Cut/);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.project, p.fromSuggestion, p.kept, p.video && p.video.where]), [["main", MAIN, null, false, "Downloads"], ["reel 2", REEL2, 2, false, "Downloads"]]);
    assert.equal(w.t.started.length, 1);
    w.t.done();
  });
  it("takes a Reel made but never opened (state made, no time opened) the same way", async () => {
    const w = world({ projects: ["main", "reel 2"], over: { app: { toolchain: "0.8.208", projects: [entry("main")] } } });
    const base = reread(w.found);
    writeFileSync(recordFile(w.found.folder, base.rev + 1), recordText({ ...base, rev: base.rev + 1, app: { ...base.app, projects: [...base.app.projects, madeByApp(w.found, { opened: [], state: "made" })] } }));
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, FOUND, START]);
    w.t.done();
  });
  it("asks the title of a Reel that `app … reel 2` added to the record from a reading's suggestion, which has none: it starts with the suggestion's first words", async () => {
    // The entry reelEntries makes of a reading's candidate (title "", no preview), marked picked, and the list that candidate came from.
    const candidate = { n: 2, start: 13.38, end: 21.287, ranges: [{ start: 13.38, end: 21.287 }], seconds: 7.907, title: "", reason: "It makes one point.", point: "Know your costs.", first: "So the first thing you need", last: "know your costs", words: "So the first thing you need to do is know your costs.", phrases: ["p7"], preview: null };
    const entryOf = { n: 2, status: "picked", from: candidate.start, to: candidate.end, title: "", why: candidate.reason, files: [], pushed: [] };
    const w = world({ over: { reels: [entryOf] } });
    const list = JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "read", made: "2026-10-20T12:00:00-05:00", candidates: [candidate] }));
    writeFileSync(join(w.found.folder, "reels.json"), list);
    const base = reread(w.found);
    writeFileSync(recordFile(w.found.folder, base.rev + 1), recordText({ ...base, rev: base.rev + 1, files: { ...base.files, "reels.json": Buffer.byteLength(list) } }));
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { yes: true }), 0);
    assert.equal(w.t.said().split("\n").at(-1), 'Reel 2 has no title on screen. Say what it says: it starts "So the first thing you need".');
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
  it("takes it the same way for an episode whose main video went the Final Cut way, and asks for no Share of it", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = world({ projects: ["reel 2"], over: { main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    const reel = exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [
      `The main video: ${PROJECT.main}.mp4, from From Final Cut, with its export ${PROJECT.main}.fcpxmld.`, REEL_LINE, 'Say "yes, finish it" to start.'
    ]);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    const asked = w.asked();
    assert.equal(asked.source, undefined);
    assert.deepEqual(asked.parts.map((p) => [p.key, p.project, p.video.where, p.video.name, p.export && p.export.name]), [
      ["main", undefined, "From Final Cut", `${PROJECT.main}.mp4`, `${PROJECT.main}.fcpxmld`], ["reel 2", REEL2, "Downloads", reel.name, null]
    ]);
    assert.deepEqual([asked.parts[1].fromSuggestion, asked.parts[1].expected], [2, REEL2_OPENING]);
    w.t.done();
  });
  it("keeps a Reel the last finish finished in a Final Cut episode, once, whether or not other Reels were made in HyperFrames", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const reelPush = { v: 1, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v1.mac-studio.fcpxml", project: PROJECT["reel 1"] };
    const finished = { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { main: { v: 5, file: `final/${PROJECT.main}.mp4`, bytes: 5, seconds: 10, source: { bytes: 5, mtimeMs: 1 }, noHandEdits: true }, "reel 1": { v: 1, file: `final/${PROJECT["reel 1"]}.mov`, bytes: 5, seconds: 7, source: { bytes: 5, mtimeMs: 1 }, noHandEdits: true } } };
    const w = world({ projects: ["reel 2"], over: { finished, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: pushes }, reels: [{ ...EPISODE.record.reels[0], status: "finished", pushed: [reelPush] }, EPISODE.record.reels[1]] } });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.kept]), [["main", true], ["reel 1", true], ["reel 2", false]]);
    w.t.done();
  });
  it("stops a raw video that has a Reel project and no main project, in the words for a main video never opened, whether or not this Mac is set up", async () => {
    for (const set of [true, false]) {
      const w = world({ projects: ["reel 2"], set });
      exportOf(w, "reel 2");
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1, String(set));
      assert.deepEqual(w.t.said().split("\n"), [NEVER_OPENED], String(set));
      assert.deepEqual(w.t.started, [], String(set));
      w.t.done();
    }
  });
});
