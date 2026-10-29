// The take-over of an episode edited in HyperFrames, on the other Mac (plan PR 11; architecture 2026-10-27, sections 4.7, 5.6, 7.3 and F12):
// `app "<episode>"` and `app "<episode>" reel <n>` rebuild a project whose folder is not on this Mac from the snapshot that `release`
// (edit-release-app.test.js) put in the episode, make the link into this Mac's own toolchain, and make the video again; they refuse the
// project of a Mac that has not handed it over. Two Macs share one root here, Mac Studio and Sallie's laptop, each with its own home.
// edit.js is only the wiring; app.js and app-reel.js (and snapshot.js, snapshot.test.js) do the work. No test runs HyperFrames, the app,
// HeyGen or `claude`: the pinned command line is the stand-in of tests/stand-ins/hyperframes.mjs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NOT_SET_UP } from "../app.js";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { localStamp, shown } from "../episode.js";
import { handOver } from "../hand-over.js";
import { PIN, cliPath } from "../hyperframes.js";
import { projectChange } from "../exports.js";
import { settingsText } from "../project.js";
import { MARKER, readMarker } from "../snapshot.js";
import { NAME } from "./episodes.js";
import { ZONE } from "./exports-world.js";
import {
  COPY_TEXT, FOLDER, GUIDANCE as GUIDANCE_PATH, HELD, MAIN, REEL2, REEL_COPY_TEXT, T1, entry, exportOf, filesBelow, listAll, madeCopy, madeReelCopy, ms, reread, takeOverWorld, textOf
} from "./snapshot-world.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|workcopy|reels\.json/;
/** `app` as Claude runs it, and a check that every line it said, whichever way it ended, is plain. */
async function app(deps, ...words) {
  const r = await on(deps, "app", ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}
const release = (deps) => on(deps, "release", FOLDER);
/** What the stand-in wrote down of each run of the pinned command line on a Mac. */
function runsOf(mac) {
  const log = join(mac.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

const OPEN = "It's open in HyperFrames.";
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
/** The moment of the first release as the words give it, in the zone the code is given: 15:00 on 2026-10-20 in UTC-5. */
const WHEN = ZONE.text(Date.parse("2026-10-20T20:00:00Z"));
const THERE = (on, of = "") => `The HyperFrames project for ${of}${NAME} is on ${on}, and ${on} has not handed it over yet. On ${on}, say "I'm done with it for now", then say it again here. If that can't be done, ask Jason.`;
const REBUILT = (of = "", by = "Mac Studio") => `The HyperFrames project for ${of}${NAME} is rebuilt on this Mac from what ${by} handed over at ${WHEN}. What HyperFrames kept of its history stays on ${by}.`;
const MAKING = `The video for HyperFrames is being made. Say "open ${NAME} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
const BACK = `The video for ${NAME} was made again, and it is in the project.`;
const SNAPSHOT_LESS = new Set(["media/recording.mp4", ".claude/settings.json", ".hyperframes/app-history.jsonl", ".hyperframes/history-id", "renders/old.mp4", "snapshots/frame.png", ".thumbnails/t.jpg", ".DS_Store"]);

/** Everything that a refusal leaves as it was: the record, the episode's folder, Sallie's laptop's work folder, what was started and waited for. */
const stateOf = (w) => ({ rev: reread(w.found).rev, editing: reread(w.found).editing, folder: listAll(w.found.folder), laptop: listAll(w.b.work), started: [...w.t.started], waits: [...w.t.waits], runs: runsOf(w.b) });

describe("app: a project of the other Mac that has not been handed over (group I)", () => {
  it("is refused in words that say what to do, with or without --take-over, before anything is claimed, brought or made", async () => {
    for (const more of [[], ["--take-over"]]) {
      const w = takeOverWorld({ projects: ["main"] });
      const before = stateOf(w);
      const r = await app(w.b.deps, FOLDER, ...more);
      assert.deepEqual([r.code, r.said], [1, [THERE("Mac Studio")]], more.join(" "));
      assert.deepEqual(stateOf(w), before, more.join(" "));
      assert.equal(existsSync(join(w.b.work, MAIN)), false);
      w.t.done();
    }
  });
  it("is refused the same for a Reel, naming it, and a take-over does not change it", async () => {
    for (const more of [[], ["--take-over"]]) {
      const w = takeOverWorld();
      const before = stateOf(w);
      const r = await app(w.b.deps, FOLDER, "reel", "2", ...more);
      assert.deepEqual([r.code, r.said], [1, [THERE("Mac Studio", "Reel 2 of ")]], more.join(" "));
      assert.deepEqual(stateOf(w), before, more.join(" "));
      w.t.done();
    }
  });
  it("is not given way by a snapshot of another project of the episode: the main project's does not rebuild a Reel", async () => {
    const projects = [entry("main"), entry("reel 2")];
    const w = takeOverWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    const before = stateOf(w);
    const r = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [THERE("Mac Studio", "Reel 2 of ")]]);
    assert.deepEqual(stateOf(w), before);
    w.t.done();
  });
  it("comes after the settings: a Mac not set up for HyperFrames says so, and the other Mac's project is not asked about", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    w.b.deps.settings = { ...w.b.deps.settings, app: undefined };
    assert.deepEqual((await app(w.b.deps, FOLDER)).said, [NOT_SET_UP]);
    w.t.done();
  });
});

describe("app: the claim, when the other Mac handed a project over (group J)", () => {
  it("is open's, when the other Mac has the episode open again after it handed it over: a plain app is refused in open's words, and a take-over takes it over", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    assert.equal((await on(w.t.ctx.deps, "open", FOLDER)).code, 0);
    const since = shown(reread(w.found).editing.since);
    const theirs = `Mac Studio has ${NAME} open, since ${since}. Say "take it over" to open it here; anything not handed over stays on Mac Studio.`;
    const refused = await app(w.b.deps, FOLDER);
    assert.deepEqual([refused.code, refused.said], [1, [theirs]]);
    assert.deepEqual((await on(w.b.deps, "open", FOLDER)).said, [theirs], "open gives the same answer for the same claim");
    assert.equal(existsSync(join(w.b.work, MAIN)), false);
    const taken = await app(w.b.deps, FOLDER, "--take-over");
    assert.deepEqual([taken.code, taken.said], [0, [`Taken over from Mac Studio, who had it since ${since}.`, REBUILT(), MAKING]]);
    assert.equal(reread(w.found).editing.by, "Sallie's laptop");
    assert.ok(existsSync(join(w.b.work, MAIN, "index.html")));
    w.t.done();
  });
  it("claims an episode the other Mac released, with no take-over, once the files it handed over are here", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [REBUILT(), MAKING]]);
    assert.deepEqual([reread(w.found).editing.by, reread(w.found).rev], ["Sallie's laptop", 3]);
    w.t.done();
  });
  it("waits for the snapshot to arrive before it claims or rebuilds: the files are brought over first, and it says to say it again", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    w.b.deps.isWhole = (path) => !path.includes("app-snapshot");
    const r = await app(w.b.deps, FOLDER);
    const count = Object.keys(reread(w.found).files).filter((rel) => rel.startsWith("app-snapshot/")).length;
    assert.deepEqual([r.code, r.said], [0, [`Still arriving from Mac Studio: ${count} files. Dropbox is bringing them over; say "open ${NAME} in HyperFrames" again when it is done.`]]);
    assert.equal(w.t.started.length, 1);
    assert.deepEqual(w.t.started[0][1].slice(1, 4), ["bring", "--now", FOLDER]);
    assert.deepEqual(w.t.started[0][1].slice(-2), ["--asked-by", "app"]);
    assert.equal(existsSync(join(w.b.work, MAIN)), false);
    assert.equal(reread(w.found).editing, null);
    w.t.done();
  });
  it("says a Reel's own words to say again while the snapshot arrives", async () => {
    const w = takeOverWorld();
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    w.b.deps.isWhole = (path) => !path.includes("app-snapshot");
    const r = await app(w.b.deps, FOLDER, "reel", "2");
    assert.equal(r.said[0].endsWith(`say "open Reel 2 of ${NAME} in HyperFrames" again when it is done.`), true, r.text);
    assert.deepEqual(w.t.started[0][1].slice(-2), ["--asked-by", "app reel 2"]);
    w.t.done();
  });
});

describe("app: the project is rebuilt from the snapshot (group K)", () => {
  /** Mac Studio's main project, handed over, and Sallie's laptop's first `app`. */
  async function rebuilt(options = {}) {
    const w = takeOverWorld(options);
    const a = await release(w.t.ctx.deps);
    assert.equal(a.code, 0, a.text);
    return { w, first: await app(w.b.deps, FOLDER) };
  }
  it("makes the project on Sallie's laptop from exactly the snapshot, with the files' times, a settings file made again and a link into its own toolchain", async () => {
    const { w, first } = await rebuilt({ projects: ["main"] });
    assert.deepEqual([first.code, first.said], [0, [REBUILT(), MAKING]]);
    const dir = join(w.b.work, MAIN);
    const rels = Object.keys(HELD).sort();
    assert.deepEqual(filesBelow(dir), [...rels, ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    for (const rel of rels) {
      assert.equal(textOf(join(dir, rel)), HELD[rel], rel);
      assert.equal(statSync(join(dir, rel)).mtimeMs, ms(13, 40), `${rel} has the time it had`);
    }
    assert.equal(textOf(join(dir, ".claude", "settings.json")), settingsText("main"));
    assert.equal(lstatSync(join(dir, "node_modules", ".bin", "hyperframes")).isSymbolicLink(), true);
    assert.equal(readlinkSync(join(dir, "node_modules", ".bin", "hyperframes")), cliPath(w.b.home));
    w.t.done();
  });
  it("leaves out the video, the renders and the app's history, makes no half-built folder, and puts no project into Dropbox", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    const imported = listAll(w.found.folder).filter((rel) => !rel.startsWith("record/"));
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    const dir = join(w.b.work, MAIN);
    for (const rel of ["media", "renders", ".hyperframes", "snapshots", ".thumbnails", ".DS_Store"]) assert.equal(existsSync(join(dir, rel)), false, rel);
    assert.deepEqual(readdirSync(w.b.work).filter((name) => name.endsWith(".part")), []);
    // The episode in Dropbox holds what it held after the release, and the claim's records: no project file, no new folder.
    const files = listAll(w.found.folder).filter((rel) => !rel.startsWith("record/"));
    assert.deepEqual(files.filter((rel) => !rel.startsWith("app-snapshot/")), imported);
    assert.deepEqual(readdirSync(join(w.found.folder, "app-snapshot")), [T1]);
    assert.ok(w.t.clones.every(([, to]) => to.startsWith(`${w.found.folder}/`)), "everything put into Dropbox went into the episode's folder");
    w.t.done();
  });
  it("is written whole or not at all, beside its place: the words name no path, and the project is on this Mac's own disk", async () => {
    const { w, first } = await rebuilt({ projects: ["main"] });
    for (const line of first.said) assert.doesNotMatch(line, PLAIN, line);
    assert.ok(join(w.b.work, MAIN).startsWith(w.b.home), "in Sallie's laptop's home");
    assert.ok(!join(w.b.work, MAIN).startsWith(w.t.root), "not in Dropbox");
    w.t.done();
  });
  it("asks for the working copy once, says it is being made, and writes no record for the project yet: the app is not asked", async () => {
    const { w } = await rebuilt({ projects: ["main"] });
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER]]);
    assert.deepEqual(runsOf(w.b), []);
    assert.deepEqual(reread(w.found).app.projects.map((p) => [p.key, p.on, p.opened.length, p.state]), [["main", "Mac Studio", 1, "opened"]]);
    w.t.done();
  });
  it("says what was left out when the assets were too big to hand over", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    writeFileSync(join(w.dirOf("main"), "assets", "interview.mov"), "x");
    truncateSync(join(w.dirOf("main"), "assets", "interview.mov"), 60 * 1024 * 1024);
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [REBUILT(), "Its assets (pictures, music and fonts) were too big to hand over, so they are not in it.", MAKING]]);
    assert.equal(existsSync(join(w.b.work, MAIN, "assets")), false);
    w.t.done();
  });
  it("names no Mac for a snapshot this Mac took itself: a project of its own whose folder is gone is rebuilt too, and what HyperFrames kept stays behind", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    rmSync(w.dirOf("main"), { recursive: true });
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`The HyperFrames project for ${NAME} is rebuilt on this Mac from the snapshot taken at ${WHEN}. What HyperFrames kept of its history stays behind.`, MAKING]]);
    assert.deepEqual(filesBelow(w.dirOf("main")), [...Object.keys(HELD), ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    w.t.done();
  });
  it("makes the project again as before when a Mac's own folder is gone and nothing was handed over", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    madeCopy({ home: w.t.home }, w.found);
    rmSync(w.dirOf("main"), { recursive: true });
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN, BUTTONS]]);
    assert.ok(existsSync(join(w.dirOf("main"), "media", "recording.mp4")));
    w.t.done();
  });
});

describe("app: the video, made again (group L)", () => {
  it("puts the working copy into the rebuilt project when it is made, says so, opens the app on the project and writes the record", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    const paths = madeCopy(w.b, w.found);
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [BACK, OPEN, BUTTONS]]);
    const dir = join(w.b.work, MAIN);
    assert.equal(textOf(join(dir, "media", "recording.mp4")), COPY_TEXT);
    assert.equal(existsSync(paths.video), false, "the copy is moved in, not copied");
    assert.deepEqual(runsOf(w.b).map((run) => run.args), [["open", dir, "--json"]], "the app is asked once, by the project's absolute path");
    const project = reread(w.found).app.projects[0];
    assert.deepEqual([project.key, project.on, project.opened.length, project.state, project.workingCopy], ["main", "Mac Studio", 2, "opened", { bytes: COPY_TEXT.length, seconds: 23.423, fps: 30 }]);
    // The project's files are as the rebuild made them, but for the video.
    assert.deepEqual(filesBelow(dir), [...Object.keys(HELD), ".claude/settings.json", MARKER, "media/recording.mp4", "node_modules/.bin/hyperframes"].sort());
    w.t.done();
  });
  it("opens it as it opens any project once the video is in, and asks for nothing again", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    const starts = w.t.started.length;
    const again = await app(w.b.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    assert.equal(w.t.started.length, starts);
    assert.equal(reread(w.found).app.projects[0].opened.length, 3);
    w.t.done();
  });
  it("keeps PR 15's words for a copy that is not the project's: another size or length, and a recording that has changed", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    const paths = madeCopy(w.b, w.found, { width: 1920, height: 1080 });
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The video made again for ${NAME} isn't the size or length of the one its HyperFrames project was made with, so it wasn't put back. Ask Jason.`]]);
    assert.equal(existsSync(paths.video), true, "left where it is");
    assert.equal(existsSync(join(w.b.work, MAIN, "media", "recording.mp4")), false);
    utimesSync(join(w.found.folder, "Pricing talk.mp4"), 1, 1);
    const changed = await app(w.b.deps, FOLDER);
    assert.deepEqual([changed.code, changed.said], [1, [`The recording of ${NAME} has changed since its HyperFrames project was made, and the video that project was made from has been taken away, so it can't be opened. Ask Jason.`]]);
    w.t.done();
  });
});

describe("app … reel: a Reel project is rebuilt from the snapshot, and its video made again (group M)", () => {
  const AGAIN = `open Reel 2 of ${NAME} in HyperFrames`;
  const OF = "Reel 2 of ";
  const MAKING_REEL = `The video for Reel 2 is being made. Say "${AGAIN}" again when it is done; "how far is it?" shows how far it has got.`;
  const BACK_REEL = `The video for Reel 2 of ${NAME} was made again, and it is in the project.`;
  /** Mac Studio's projects, handed over, and Sallie's laptop's first `app … reel 2`. */
  async function rebuilt(options = {}) {
    const w = takeOverWorld(options);
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    return { w, first: await app(w.b.deps, FOLDER, "reel", "2") };
  }
  it("makes the Reel's project on Sallie's laptop from the snapshot, with its face track, asks for the Reel's video once, and says so", async () => {
    const { w, first } = await rebuilt();
    assert.deepEqual([first.code, first.said], [0, [REBUILT(OF), MAKING_REEL]]);
    const dir = join(w.b.work, REEL2);
    assert.deepEqual(filesBelow(dir), [...Object.keys(HELD), ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    for (const rel of Object.keys(HELD)) {
      assert.equal(textOf(join(dir, rel)), textOf(join(w.dirOf("reel 2"), rel)), rel);
      assert.equal(statSync(join(dir, rel)).mtimeMs, ms(13, 40), rel);
    }
    assert.equal(readlinkSync(join(dir, "node_modules", ".bin", "hyperframes")), cliPath(w.b.home));
    assert.equal(existsSync(join(w.b.work, MAIN)), false, "the main project is not made by asking for a Reel");
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER, "--reel", "2"]]);
    assert.deepEqual(runsOf(w.b), []);
    w.t.done();
  });
  it("puts the Reel's video in when it is made, says so, opens the app on the project, and keeps the Reel picked and the project's entry as it was but for the time opened", async () => {
    const { w } = await rebuilt();
    const copy = madeReelCopy(w.b, w.found);
    const r = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [BACK_REEL, OPEN, BUTTONS]]);
    const dir = join(w.b.work, REEL2);
    assert.equal(textOf(join(dir, "media", "recording.mp4")), REEL_COPY_TEXT);
    assert.equal(existsSync(copy.video), false);
    const record = reread(w.found);
    const project = record.app.projects.find((p) => p.key === "reel 2");
    assert.deepEqual([project.on, project.opened.length, project.state, project.fromSuggestion], ["Mac Studio", 2, "opened", 2]);
    assert.equal(record.reels.find((reel) => reel.n === 2).status, "picked");
    assert.deepEqual(runsOf(w.b).map((run) => run.args), [["open", dir, "--json"]]);
    w.t.done();
  });
  it("does not put in a video that does not start where the project's Reel starts, or is not its size or length: it is left, and she is told", async () => {
    const { w } = await rebuilt();
    const STRETCH = { n: 2, start: 400, end: 410 };
    const there = madeReelCopy(w.b, w.found, 2, { stretch: STRETCH });
    const tail = `isn't the size or length of the one its HyperFrames project was made with, so it wasn't put back. Ask Jason.`;
    const moved = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([moved.code, moved.said], [1, [`The video made again for Reel 2 of ${NAME} ${tail}`]]);
    assert.equal(existsSync(there.video), true);
    const sized = madeReelCopy(w.b, w.found, 2, { width: 1080, height: 1920 });
    const wrong = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([wrong.code, wrong.said], [1, [`The video made again for Reel 2 of ${NAME} ${tail}`]]);
    assert.equal(existsSync(sized.video), true);
    assert.equal(existsSync(join(w.b.work, REEL2, "media", "recording.mp4")), false);
    w.t.done();
  });
  it("says that a video is being made already, and asks for none, while a run is at work on the episode; and that Claude is still reading while it is", async () => {
    const { w } = await rebuilt();
    mkdirSync(w.b.work, { recursive: true });
    writeFileSync(join(w.b.work, "episode.lock"), JSON.stringify({ pid: 4242, command: "workcopy" }));
    writeFileSync(join(w.b.work, "workcopy.lock"), JSON.stringify({ pid: 4242, command: "workcopy" }));
    w.b.deps.alive = (pid) => pid === 4242;
    const starts = w.t.started.length;
    const busy = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([busy.code, busy.said], [0, [`A video for HyperFrames is being made already, and they are made one at a time. Say "${AGAIN}" again when it is done; "how far is it?" shows how far it has got.`]]);
    rmSync(join(w.b.work, "workcopy.lock"));
    writeFileSync(join(w.b.work, "episode.lock"), JSON.stringify({ pid: 4242, command: "read" }));
    const reading = await app(w.b.deps, FOLDER, "reel", "2");
    assert.deepEqual([reading.code, reading.said], [0, [`Claude is still reading it. Say "${AGAIN}" again when it has finished; "how far is it?" shows how far it has got.`]]);
    assert.equal(w.t.started.length, starts, "nothing was asked for");
    w.t.done();
  });
  it("puts a video back into a Reel project of this Mac's own whose video was taken away, as it does for the main video's", async () => {
    const w = takeOverWorld({ over: { editing: null } });
    rmSync(join(w.dirOf("reel 2"), "media", "recording.mp4"));
    const first = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([first.code, first.said], [0, [MAKING_REEL]]);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER, "--reel", "2"]]);
    madeReelCopy({ home: w.t.home }, w.found);
    const second = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([second.code, second.said], [0, [BACK_REEL, OPEN, BUTTONS]]);
    assert.equal(textOf(join(w.dirOf("reel 2"), "media", "recording.mp4")), REEL_COPY_TEXT);
    w.t.done();
  });
  it("opens a Reel project that has its video as it was, and asks for nothing", async () => {
    const w = takeOverWorld({ over: { editing: null } });
    const r = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [OPEN, BUTTONS]]);
    assert.deepEqual(w.t.started, []);
    w.t.done();
  });
});

describe("app: a project that cannot be rebuilt (group N)", () => {
  it("says so in words, makes no folder and no half-built one, keeps the claim, and tries again at the next ask", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    let seen = 0;
    const real = (await import("node:fs"));
    w.b.deps.app = { ...w.b.deps.app, fs: { ...real, copyFileSync: (...args) => (++seen === 4 ? (() => { throw new Error("the disk is full"); })() : real.copyFileSync(...args)) } };
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for ${NAME} could not be rebuilt on this Mac. Ask Jason.`]]);
    assert.deepEqual(w.b.work && existsSync(w.b.work) ? readdirSync(w.b.work) : [], []);
    assert.equal(reread(w.found).editing.by, "Sallie's laptop");
    w.b.deps.app = { node: process.execPath, guidance: GUIDANCE_PATH };
    const again = await app(w.b.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [REBUILT(), MAKING]]);
    w.t.done();
  });
  it("takes nothing but the files of a project from a snapshot: not a path that leaves it, a .env, a name with a dot, media, node_modules, or a settings file of its own", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    // Files the other Mac's snapshot should never hold, listed in the record as a Mac or a person might write them.
    const base = join(w.found.folder, "app-snapshot", T1, MAIN);
    const extra = { ".env": "SECRET=1", ".claude/settings.json": '{"permissions":{"allow":["Bash(*)"]}}', "media/recording.mp4": "a video", "node_modules/x/index.js": "x", ".hyperframes/history-id": "id", "renders/r.mp4": "r" };
    const listed = {};
    for (const [rel, text] of Object.entries(extra)) {
      mkdirSync(join(base, rel, ".."), { recursive: true });
      writeFileSync(join(base, rel), text);
      listed[`app-snapshot/${T1}/${MAIN}/${rel}`] = Buffer.byteLength(text);
    }
    const now = reread(w.found);
    writeFileSync(join(w.found.folder, "record", "0003.json"), JSON.stringify({ ...now, rev: 3, files: { ...now.files, ...listed }, released: { ...now.released, files: { ...now.released.files, ...listed } } }, null, 2) + "\n");
    const r = await app(w.b.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [REBUILT(), MAKING]]);
    assert.deepEqual(filesBelow(join(w.b.work, MAIN)), [...Object.keys(HELD), ".claude/settings.json", MARKER, "node_modules/.bin/hyperframes"].sort());
    assert.equal(textOf(join(w.b.work, MAIN, ".claude", "settings.json")), settingsText("main"), "made again from the pin's table, not the snapshot's");
    assert.ok(reread(w.found).files[`app-snapshot/${T1}/${MAIN}/.env`] > 0, "the record did list the files it should not");
    w.t.done();
  });
});

describe("app: a project older than its snapshot is neither opened nor handed over (group O)", () => {
  const OLDER = `The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`;
  /** Mac Studio releases; Sallie's laptop takes over, rebuilds, makes the video, changes a composition, and releases. Mac Studio's folder is
      then older than the snapshot. */
  async function worked() {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    const changed = join(w.b.work, MAIN, "compositions", "title-card.html");
    writeFileSync(changed, "<div>Pricing, in a new way</div>");
    utimesSync(changed, new Date(ms(16, 0)), new Date(ms(16, 0)));
    await w.t.ctx.deps.wait(60000);
    const handed = await release(w.b.deps);
    assert.equal(handed.code, 0, handed.text);
    return w;
  }
  it("is not opened on the Mac that came back to it: it says so, asks for no video, opens nothing, and leaves the folder as it was", async () => {
    const w = await worked();
    const before = filesBelow(w.dirOf("main"));
    const starts = w.t.started.length;
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [OLDER]]);
    assert.deepEqual(filesBelow(w.dirOf("main")), before);
    assert.deepEqual(runsOf({ home: w.t.home }), []);
    assert.equal(w.t.started.length, starts, "no video is asked for");
    w.t.done();
  });
  it("is put right, until a way is built, by moving the older folder away by hand: the project is then rebuilt from the other Mac's newer snapshot, with what it changed", async () => {
    const w = await worked();
    assert.deepEqual((await app(w.t.ctx.deps, FOLDER)).said, [OLDER]);
    renameSync(w.dirOf("main"), join(w.t.dir, "older copy of the project"));
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.said[0], /^The HyperFrames project for Pricing: what to charge\? is rebuilt on this Mac from what Sallie's laptop handed over at \d{4}-\d{2}-\d{2} \d{2}:\d{2}\. What HyperFrames kept of its history stays on Sallie's laptop\.$/);
    assert.equal(textOf(join(w.dirOf("main"), "compositions", "title-card.html")), "<div>Pricing, in a new way</div>");
    madeCopy({ home: w.t.home }, w.found);
    const opened = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([opened.code, opened.said], [0, [BACK, OPEN, BUTTONS]]);
    w.t.done();
  });
  it("is not handed over again by that Mac, whatever it was told before: nothing is written", async () => {
    const w = await worked();
    const folders = readdirSync(join(w.found.folder, "app-snapshot"));
    await app(w.t.ctx.deps, FOLDER);
    const rev = reread(w.found).rev;
    const r = await release(w.t.ctx.deps);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't handed over again. Nothing was handed over. Ask Jason.`]]);
    assert.deepEqual([readdirSync(join(w.found.folder, "app-snapshot")), reread(w.found).rev], [folders, rev]);
    w.t.done();
  });
  it("is the same for a Reel project: Sallie's laptop rebuilds and changes it and hands it over, and Mac Studio's older one is not opened", async () => {
    const w = takeOverWorld();
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER, "reel", "2");
    madeReelCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER, "reel", "2")).code, 0);
    const changed = join(w.b.work, REEL2, "compositions", "title-card.html");
    writeFileSync(changed, "<div>Pricing, in a new way</div>");
    utimesSync(changed, new Date(ms(16, 0)), new Date(ms(16, 0)));
    await w.t.ctx.deps.wait(60000);
    assert.equal((await release(w.b.deps)).code, 0);
    const starts = w.t.started.length;
    const r = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for Reel 2 of ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`]]);
    assert.equal(w.t.started.length, starts);
    // The main project of this Mac, which the other Mac never had, is not older than any snapshot.
    const main = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([main.code, main.said], [0, [OPEN, BUTTONS]]);
    w.t.done();
  });
  it("is, for a project with no marker, opened when it is as new as the snapshot, within 2 seconds, or newer, and not when it is more than 2 seconds older", async () => {
    for (const [lag, code] of [[0, 0], [1900, 0], [2100, 1], [60000, 1]]) {
      const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
      assert.equal((await release(w.t.ctx.deps)).code, 0);
      rmSync(join(w.dirOf("main"), MARKER));
      const there = join(w.found.folder, "app-snapshot", T1, MAIN, "index.html");
      utimesSync(there, new Date(ms(13, 40) + lag), new Date(ms(13, 40) + lag));
      const r = await app(w.t.ctx.deps, FOLDER);
      assert.equal(r.code, code, `${lag}: ${r.text}`);
      assert.equal(r.said.includes(OLDER), code === 1, `${lag}`);
      w.t.done();
    }
  });
  it("is not judged by the times of its files when its marker names the newest snapshot: it is the one that handed it over", async () => {
    for (const lag of [0, 60000, 24 * 3600 * 1000]) {
      const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
      assert.equal((await release(w.t.ctx.deps)).code, 0);
      const there = join(w.found.folder, "app-snapshot", T1, MAIN, "index.html");
      utimesSync(there, new Date(ms(13, 40) + lag), new Date(ms(13, 40) + lag));
      const r = await app(w.t.ctx.deps, FOLDER);
      assert.equal(r.code, 0, `${lag}: ${r.text}`);
      w.t.done();
    }
  });
  it("counts a new file the snapshot does not hold as newer: the project is opened", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    rmSync(join(w.dirOf("main"), MARKER));
    const there = join(w.found.folder, "app-snapshot", T1, MAIN, "index.html");
    utimesSync(there, new Date(ms(15, 0)), new Date(ms(15, 0)));
    writeFileSync(join(w.dirOf("main"), "compositions", "end-card.html"), "<div>The end</div>");
    utimesSync(join(w.dirOf("main"), "compositions", "end-card.html"), new Date(ms(16, 0)), new Date(ms(16, 0)));
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said.at(-1)], [0, BUTTONS]);
    w.t.done();
  });
  it("does not stand in the way of a project that has never been handed over: no snapshot, no question", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN, BUTTONS]]);
    w.t.done();
  });
});

describe("app and release: which project is older goes by the marker, not by the clocks or the files (the review of PR 11, I1)", () => {
  const OLDER = `The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`;
  const OLDER_HANDING = `The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't handed over again. Nothing was handed over. Ask Jason.`;
  /** Mac Studio releases; Sallie's laptop takes over, rebuilds, makes the video, does `change` to the project, and releases. Gives the world
      and the folder name of each snapshot, the laptop's last. */
  async function laptopWorked(change, { behind = 0 } = {}) {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    change(join(w.b.work, MAIN));
    await w.t.ctx.deps.wait(60000);
    if (behind) w.b.deps.now = () => w.t.now() - behind;
    const handed = await release(w.b.deps);
    assert.equal(handed.code, 0, handed.text);
    return { w, snapshots: readdirSync(join(w.found.folder, "app-snapshot")).sort() };
  }
  const listedTimes = (w) => [...new Set(Object.keys(reread(w.found).files).filter((rel) => rel.startsWith("app-snapshot/")).map((rel) => rel.split("/")[1]))];
  it("when the other Mac only deleted a file: Mac Studio's project is not opened and not handed over, and the file does not come back", async () => {
    const { w } = await laptopWorked((dir) => rmSync(join(dir, "compositions", "title-card.html")));
    const [, second] = listedTimes(w);
    assert.equal(`app-snapshot/${second}/${MAIN}/compositions/title-card.html` in reread(w.found).files, false, "the laptop's snapshot has no such file");
    const opened = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([opened.code, opened.said], [1, [OLDER]]);
    const handed = await release(w.t.ctx.deps);
    assert.deepEqual([handed.code, handed.said], [1, [OLDER_HANDING]]);
    assert.equal(`app-snapshot/${second}/${MAIN}/compositions/title-card.html` in reread(w.found).files, false);
    w.t.done();
  });
  it("when the other Mac's clock is ten minutes behind: its snapshot is named before the first, is the newest all the same, and Mac Studio's project is older", async () => {
    const { w, snapshots } = await laptopWorked((dir) => {
      const edited = join(dir, "compositions", "title-card.html");
      writeFileSync(edited, "<div>Pricing, in a new way</div>");
      utimesSync(edited, new Date(ms(13, 30)), new Date(ms(13, 30)));
    }, { behind: 10 * 60 * 1000 });
    assert.deepEqual(snapshots.length, 2);
    assert.equal(snapshots[0] < T1, true, "the laptop's snapshot sorts before Mac Studio's by its name");
    assert.deepEqual(listedTimes(w), [T1, snapshots[0]], "and the record lists it last");
    const opened = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([opened.code, opened.said], [1, [OLDER]]);
    // Rebuilt from the newest, Mac Studio has what the laptop changed.
    renameSync(w.dirOf("main"), join(w.t.dir, "older copy of the project"));
    const rebuilt = await app(w.t.ctx.deps, FOLDER);
    assert.equal(rebuilt.code, 0, rebuilt.text);
    assert.equal(textOf(join(w.dirOf("main"), "compositions", "title-card.html")), "<div>Pricing, in a new way</div>");
    w.t.done();
  });
  it("does not take a file dated in the future for the project's last change: a rebuilt file is given the moment of the rebuild at most", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    const future = new Date("2026-12-01T00:00:00Z");
    utimesSync(join(w.dirOf("main"), "compositions", "title-card.html"), future, future);
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    const made = join(w.b.work, MAIN);
    assert.equal(lstatSync(join(made, "compositions", "title-card.html")).mtimeMs <= w.t.now(), true);
    assert.equal(projectChange(made) <= w.t.now(), true, "so an export made after the rebuild is not older than the last change");
    assert.equal(lstatSync(join(made, "index.html")).mtimeMs, ms(13, 40), "a file with an ordinary time keeps it");
    w.t.done();
  });
  it("names the snapshot a project was rebuilt from in its marker, with the Mac that made it; and the Mac that hands a project over names its own", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    assert.deepEqual(readMarker(w.dirOf("main")), { snapshot: T1, by: "Mac Studio" });
    await app(w.b.deps, FOLDER);
    assert.deepEqual(readMarker(join(w.b.work, MAIN)), { snapshot: T1, by: "Mac Studio" });
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    await w.t.ctx.deps.wait(60000);
    assert.equal((await release(w.b.deps)).code, 0);
    const second = readdirSync(join(w.found.folder, "app-snapshot")).sort().at(-1);
    assert.equal(second > T1, true);
    assert.deepEqual(readMarker(join(w.b.work, MAIN)), { snapshot: second, by: "Sallie's laptop" });
    w.t.done();
  });
  it("with no marker, goes by the times of the files as before: a project made here and never handed over is not refused for being new, and is for being old", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    rmSync(join(w.dirOf("main"), MARKER));
    const stamp = new Date(ms(13, 40) - 60000);
    for (const rel of Object.keys(HELD)) utimesSync(join(w.dirOf("main"), rel), stamp, stamp);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [OLDER]]);
    w.t.done();
  });
});

describe("finish on the other Mac, after a take-over (group P)", () => {
  it("finds the export the first Mac handed over, takes it without asking whether to export again, and says where it came from", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { reels: [] } });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    const r = await on(w.b.deps, "finish", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [`The main video: ${main.name}, from what the other Mac released, exported 2026-10-20 13:56.`, 'Say "yes, hand it off" to start.']);
    w.t.done();
  });
  it("would ask whether to export again if the rebuilt project's files had lost their times: which is why they keep them", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { reels: [] } });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    for (const rel of Object.keys(HELD)) utimesSync(join(w.b.work, MAIN, rel), new Date(ms(17, 0)), new Date(ms(17, 0)));
    const r = await on(w.b.deps, "finish", FOLDER);
    assert.match(r.said[0], new RegExp(`^The main video's newest export, ${main.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, began at 2026-10-20 13:56, before you last changed it in HyperFrames, at 2026-10-20 17:00\\.`));
    w.t.done();
  });
});

describe("what the take-over leaves as it was (group Q)", () => {
  it("makes no project when `open` takes the episode over: it claims, and `app` is what rebuilds", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    assert.equal((await on(w.t.ctx.deps, "open", FOLDER)).code, 0);
    const r = await on(w.b.deps, "open", FOLDER, "--take-over");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(w.found).editing.by, "Sallie's laptop");
    assert.equal(existsSync(join(w.b.work, MAIN)), false);
    assert.ok(COMMAND_NAMES.includes("app") && COMMAND_NAMES.includes("open"));
    w.t.done();
  });
  it("starts the project's history afresh: what was done in HyperFrames says nothing yet, claims nothing and writes no record", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    const rev = reread(w.found).rev;
    const r = await app(w.b.deps, FOLDER, "what-happened");
    assert.deepEqual([r.code, r.said, reread(w.found).rev], [0, [`Nothing has been done in HyperFrames on ${NAME} yet.`], rev]);
    w.t.done();
  });
  it("says every line of the whole take-over without a path, a flag or a command's name, for an episode named with an accent and a quote", async () => {
    const name = 'Café: "pricing" talk';
    const w = takeOverWorld({ projects: ["main", "reel 2"], name });
    const lines = [];
    const run = async (deps, ...argv) => lines.push(...(await app(deps, ...argv)).said);
    const done = await release(w.t.ctx.deps);
    lines.push(...done.said);
    await run(w.b.deps, FOLDER);
    await run(w.b.deps, FOLDER, "reel", "2");
    madeCopy(w.b, w.found);
    madeReelCopy(w.b, w.found);
    await run(w.b.deps, FOLDER);
    await run(w.b.deps, FOLDER, "reel", "2");
    assert.ok(lines.some((line) => line.includes(name)), "the name is said");
    for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
    w.t.done();
  });
});

describe("release: the other Mac's newer snapshot is never dropped, and an older state never handed over after it (C1)", () => {
  /** Mac Studio releases at T1; Sallie's laptop takes over, rebuilds, makes the video, changes a composition and releases a minute later.
      The record Mac Studio then has lists the laptop's snapshot after its own. Gives the world, the laptop's snapshot's folder name and
      the folders of the episode's snapshots. */
  async function handedBack(options = { projects: ["main"] }) {
    const w = takeOverWorld(options);
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    const changed = join(w.b.work, MAIN, "compositions", "title-card.html");
    writeFileSync(changed, "<div>Pricing, in a new way</div>");
    utimesSync(changed, new Date(ms(16, 0)), new Date(ms(16, 0)));
    await w.t.ctx.deps.wait(60000);
    const handed = await release(w.b.deps);
    assert.equal(handed.code, 0, handed.text);
    const folders = readdirSync(join(w.found.folder, "app-snapshot")).sort();
    return { w, T2: folders.at(-1), folders };
  }
  const listedUnder = (w, time) => Object.keys(reread(w.found).files).filter((rel) => rel.startsWith(`app-snapshot/${time}/`));
  it("does not hand over its older project, nor drop or delete the laptop's newer snapshot, while that snapshot is not all here", async () => {
    const { w, T2, folders } = await handedBack();
    assert.equal(folders.length, 2);
    rmSync(join(w.found.folder, "app-snapshot", T2, MAIN, "index.html"));
    const listed = listedUnder(w, T2);
    const before = stateOf(w);
    const r = await release(w.t.ctx.deps);
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /Nothing was handed over\./);
    assert.deepEqual(stateOf(w), before, "no record is written and nothing is put in or taken out of the episode");
    assert.deepEqual(readdirSync(join(w.found.folder, "app-snapshot")).sort(), folders);
    assert.deepEqual(listedUnder(w, T2), listed, "the record still lists every file of the laptop's snapshot");
    w.t.done();
  });
  it("is refused by handOver itself while the newest snapshot of a project is not whole here, in words that name the Mac that handed it over", async () => {
    const { w, T2 } = await handedBack();
    rmSync(join(w.found.folder, "app-snapshot", T2, MAIN, "index.html"));
    const record = reread(w.found);
    const got = await handOver(w.t.ctx, { found: { ...w.found, record }, record }, { running: async () => false });
    assert.deepEqual(got, { refused: `Dropbox is still bringing what Sallie's laptop handed over of ${NAME}. Say it again when it is done. Nothing was handed over.` });
    w.t.done();
  });
  it("does not excuse a copy of an export that the laptop made and Dropbox has not brought: it is waited for, and stays listed", async () => {
    const w = takeOverWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    await app(w.b.deps, FOLDER);
    madeCopy(w.b, w.found);
    assert.equal((await app(w.b.deps, FOLDER)).code, 0);
    mkdirSync(join(w.b.work, MAIN, "renders"), { recursive: true });
    const made = exportOf({ ...w, downloads: join(w.b.home, "Downloads"), dirOf: () => join(w.b.work, MAIN) }, "main");
    await w.t.ctx.deps.wait(60000);
    const handed = await release(w.b.deps);
    assert.equal(handed.code, 0, handed.text);
    const rel = `edit/from-hyperframes/${made.name}`;
    assert.equal(rel in reread(w.found).files, true, "the laptop listed its export");
    rmSync(join(w.found.folder, rel));
    const before = stateOf(w);
    const r = await release(w.t.ctx.deps);
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /is not whole in Dropbox/);
    assert.match(r.text, /Nothing was handed over\./);
    assert.deepEqual(stateOf(w), before);
    assert.equal(rel in reread(w.found).files, true, "the record still lists what the laptop handed over");
    w.t.done();
  });
});

describe("what pins the words (group S)", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const rowOf = (start) => readme.split("\n").filter((line) => line.startsWith(start));
  const usage = (head) => {
    const lines = HELP.split("\n");
    const at = lines.indexOf(head);
    assert.ok(at >= 0, head);
    let end = at + 1;
    while (end < lines.length && lines[end].startsWith(" ".repeat(40))) end++;
    return lines.slice(at + 1, end).map((line) => line.trim());
  };
  it("has the help say what release hands over of a HyperFrames project, and what app and app … reel make of one the other Mac handed over, each description from column 40", () => {
    const release = usage('  node edit.js release "<episode>" [--no-hand-edits | --hand-edits-stay]').join(" ");
    for (const words of ["For its HyperFrames projects it also copies a snapshot of each one's files, so that the other Mac can rebuild it (not its video, renders or history), and the newest export of each; HyperFrames must be quit, and a project too big for that is refused"]) assert.ok(release.includes(words), words);
    const app = usage('  node edit.js app "<episode>" [--take-over]').join(" ");
    for (const words of ["A project the other Mac made is rebuilt here from the snapshot it handed over, and its video made again; what HyperFrames kept of its history stays on that Mac. One it has not handed over is refused."]) assert.ok(app.includes(words), words);
    const reel = usage('  node edit.js app "<episode>" reel <n> [--take-over]').join(" ");
    assert.ok(reel.includes("A Reel project the other Mac made is rebuilt from its snapshot, as above."), reel);
  });
  it("has the README say it in the rows of release, app and app … reel, and in a paragraph of its own on handing a project over", () => {
    const [release] = rowOf("| `release \"<episode>\"");
    assert.ok(release.includes("a snapshot of each and the newest export of each"), release);
    const [app] = rowOf("| `app \"<episode>\" [--take-over]`");
    for (const words of ["has no snapshot listed in the record", "has not handed it over", "On <Mac>, say \"I'm done with it for now\", then say it again here. If that can't be done, ask Jason.", "rebuilds a project whose folder is not on this Mac from the snapshot, whichever Mac made it", "is older than the newest snapshot", "The video for <name> was made again, and it is in the project."]) assert.ok(app.includes(words), words);
    const [reel] = rowOf("| `app \"<episode>\" reel <n> [--take-over]`");
    for (const words of ["that has no snapshot listed in the record", "is rebuilt from it, as the main project is", "starts where the project's `brimm/facts.json` says the Reel starts"]) assert.ok(reel.includes(words), words);
    const [paragraph] = readme.split("\n").filter((line) => line.startsWith("**Handing a HyperFrames project over**"));
    for (const words of ["`app-snapshot/<time>/<project name>/`", "`media/`", "`node_modules/`", "`renders/` and `snapshots/`", "any name that starts with a dot at any depth", "`assets/` while it weighs at most 50 MB", "more than 100 MB of files is refused in words", "`edit/from-hyperframes/`", "HyperFrames must be quit first", "two newest snapshots that are whole", "more than 2 seconds older", "`open` is unchanged"]) assert.ok(paragraph.includes(words), words);
  });
});
