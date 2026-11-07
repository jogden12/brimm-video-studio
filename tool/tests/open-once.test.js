// Open it once (Phase 3, the local working folder; L7; design D3). On an episode kept on this Mac nothing asks her to wait or to say a thing twice:
// her answer to `kind` is written at once, with no claim waited for, and starts the reading and the copy; "open it in HyperFrames" said while the
// copy is being made starts a detached `app --when-ready`, which waits (holding neither the episode's lock nor anything she does) for the copy and
// then opens the project by itself, or, when the copy failed, posts a notice and opens nothing. An episode from before the switch keeps its claim and
// its words. Nothing here runs a real program: the pinned command line is the stand-in, and the copy is made by hand.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLAIM_WAIT_MS, editMain } from "../edit.js";
import { lockOf, readResult, resultFile, takeEpisodeLock } from "../detached.js";
import { whenReadyLockOf } from "../app.js";
// The buttons line is said in her chat when HyperFrames is to open by itself: the detached run that opens it speaks to the log alone (B0-F8).
const BUTTONS = "In HyperFrames, share only with people you invite, and export on This Mac: the Export dialog may start on Cloud. The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now.";
import { COPY_STEP } from "../guide.js";
import { addRates, progressFolder } from "../progress.js";
import { episodeFilesFolder, episodeWork, writeSettings } from "../settings.js";
import { workCopyLockOf } from "../workcopy.js";
import { clockAt } from "../unedited.js";
import { RAW, atWork, world } from "./workcopy-world.js";
import { setup, episodeFor, listAll, reread, FOLDER, NAME } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
const WAITING = { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null }, label: LABEL };
const LOCAL = { version: 6, local: { on: "Mac Studio" } };
const STILL = (name) => `Claude is still reading ${name}. A notice will come on this Mac when it is done: then say "what did Claude find?"`;
const BEING_MADE = (when) => `Its video for HyperFrames is being made. HyperFrames opens it by itself ${when}.`;
const WHEN_READY = ["app", "--when-ready", FOLDER];
const argsOf = (t) => t.started.map(([, args]) => args.slice(1));
const standInLog = (t) => join(t.home, "hyperframes-stand-in.log");

/** The made-up raw video kept on this Mac: its files in video/, as the import of a Mac with a drop folder of its own leaves them; the app is on. */
function kept() {
  const w = world({ record: { ...RAW, ...LOCAL } });
  const { t, found } = w;
  const own = episodeFilesFolder(t.home, FOLDER);
  mkdirSync(own, { recursive: true });
  for (const rel of listAll(found.folder).filter((r) => !r.startsWith("record/"))) renameSync(join(found.folder, rel), join(own, rel));
  writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  t.notices = [];
  t.ctx.deps.notify = (text) => t.notices.push(text);
  return w;
}
function madeCopy(paths) {
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, "the working copy's bytes");
  writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: "the working copy's bytes".length }));
}
/** A run of `app --when-ready` at work on the made-up episode now, as a live process holds it. */
function whenReadyAtWork(t) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  assert.equal(takeEpisodeLock(whenReadyLockOf(t.home, FOLDER), "when-ready", () => true).taken, true);
  t.ctx.deps.alive = (pid) => pid === process.pid;
}

describe("kind: an answer for a video kept on this Mac", () => {
  const answered = async (record) => {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    const found = episodeFor(t, { record: { ...WAITING, ...record } });
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    return { t, found, r };
  };
  it("writes its record once, waits for no claim, and starts the reading and the copy", async () => {
    const { t, found, r } = await answered(LOCAL);
    assert.deepEqual([r.code, r.said], [0, [STILL(LABEL)]]);
    assert.equal(t.waits.includes(CLAIM_WAIT_MS), false);
    assert.deepEqual([reread(found).rev, reread(found).kind, reread(found).editing], [2, "raw", null]);
    assert.deepEqual(argsOf(t), [["read", "--now", FOLDER, "--kind", "raw", "--rev", "2"], ["workcopy", "--now", FOLDER]]);
    t.done();
  });
  it("an episode from before the switch still claims the video and waits for the claim", async () => {
    const { t, found, r } = await answered({});
    assert.equal(r.code, 0, r.text);
    assert.equal(t.waits.includes(CLAIM_WAIT_MS), true);
    assert.equal(reread(found).rev, 3);
    t.done();
  });
});

describe("app, while the video for HyperFrames of a video kept on this Mac is being made", () => {
  it("says HyperFrames opens it by itself, starts one app --when-ready, and claims nothing; a second app says the same and starts nothing", async () => {
    const { t, found } = kept();
    atWork(t, "workcopy");
    const first = await on(t.ctx.deps, "app", FOLDER);
    assert.deepEqual([first.code, first.said], [0, [BEING_MADE("when it is ready"), BUTTONS]]);
    assert.deepEqual(argsOf(t), [WHEN_READY]);
    assert.deepEqual([reread(found).rev, reread(found).editing, t.waits.includes(CLAIM_WAIT_MS)], [1, null, false]);
    // The run started takes a lock of its own: a second request finds it and starts none.
    whenReadyAtWork(t);
    const second = await on(t.ctx.deps, "app", FOLDER);
    assert.deepEqual([second.code, second.said], [0, [BEING_MADE("when it is ready"), BUTTONS]]);
    assert.equal(argsOf(t).length, 1);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("names the time it opens when this Mac has measured the speed of making one", async () => {
    const { t } = kept();
    atWork(t, "workcopy");
    addRates(progressFolder(t.home), { [COPY_STEP]: 0.1 });
    const r = await on(t.ctx.deps, "app", FOLDER);
    // 0.1 seconds of work for each second of the video's 23.423.
    assert.deepEqual(r.said, [BEING_MADE(`about ${clockAt(t.now() + 0.1 * 23.423 * 1000)}`), BUTTONS]);
    t.done();
  });
  it("an episode from before the switch is told what it was: to say it again", async () => {
    const { t } = world({ record: RAW });
    writeSettings(t.home, { app: "hyperframes" });
    t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    atWork(t, "workcopy");
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.match(r.text, /^The video for HyperFrames is being made\. Say "open .* in HyperFrames" again when it is done/);
    assert.deepEqual(argsOf(t), []);
    t.done();
  });
});

describe("app --when-ready", () => {
  const run = (t) => on(t.ctx.deps, "app", "--when-ready", FOLDER);
  it("waits without the episode's lock for the copy, then makes the project and opens the app once", async () => {
    const { t, found, paths } = kept();
    atWork(t, "workcopy");
    const seen = [];
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      seen.push({ episodeLock: existsSync(lockOf(t.home, FOLDER)), mine: existsSync(whenReadyLockOf(t.home, FOLDER)) });
      // The copy is done: its video and facts are there and its lock is let go.
      madeCopy(paths);
      rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
    };
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(seen, [{ episodeLock: false, mine: true }]);
    const project = reread(found).app.projects[0];
    assert.deepEqual([project.key, project.state], ["main", "opened"]);
    assert.equal(existsSync(join(episodeWork(t.home, FOLDER), project.name)), true);
    const opens = readFileSync(standInLog(t), "utf8").trim().split("\n").map((line) => JSON.parse(line)).filter((x) => x.args[0] === "open");
    assert.equal(opens.length, 1);
    assert.deepEqual(t.notices, []);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    assert.equal(existsSync(whenReadyLockOf(t.home, FOLDER)), false);
    t.done();
  });
  it("opens nothing and posts the notice when the copy failed", async () => {
    const { t, found } = kept();
    atWork(t, "workcopy");
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
    };
    const r = await run(t);
    assert.equal(r.code, 1);
    assert.deepEqual(t.notices, [`The video for HyperFrames of ${NAME} couldn't be made. Say "open ${NAME} in HyperFrames" to try again; if it says this again, ask Jason.`]);
    assert.equal(existsSync(standInLog(t)), false);
    assert.equal(reread(found).app, undefined);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("does not hold the episode's lock while it waits, so free and the other commands are not refused for it", async () => {
    const { t } = kept();
    atWork(t, "workcopy");
    const wait = t.ctx.deps.wait;
    let freed;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
      freed = await on(t.ctx.deps, "free", FOLDER);
    };
    await run(t);
    assert.equal(freed.code, 0, freed.text);
    assert.doesNotMatch(freed.text, /running|being made|isn't|not /i);
    t.done();
  });
  it("B0-F26 the lock that ended was a Reel's copy: the main video's copy is asked for once, and not called failed", async () => {
    const { t } = kept();
    atWork(t, "workcopy");
    const wait = t.ctx.deps.wait;
    let turns = 0;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      turns += 1;
      if (turns === 1) rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
    };
    await run(t);
    assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 1, JSON.stringify(argsOf(t)));
    t.done();
  });
  it("B0-F27 a copy that failed and ended just before this run began is taken as decided at once, not waited for the copy's whole limit", async () => {
    const { t } = kept();
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(resultFile(t.home, FOLDER, "workcopy"), JSON.stringify({ version: 1, command: "workcopy", started: t.now() - 3000, ended: t.now() - 1000, ok: false, made: [], failed: ["no room"], next: "" }));
    const r = await run(t);
    assert.equal(r.code, 1);
    assert.ok(t.waits.length < 5, `${t.waits.length} waits`);
    assert.equal(t.notices.length, 1);
    t.done();
  });
  it("started just after the copy was asked for, it waits for the copy's run to be seen rather than posting the notice at once", async () => {
    const { t, paths } = kept();
    let turns = 0;
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      turns += 1;
      // Nothing at work on the first look: the copy's run has not taken its lock yet. It does, then it ends with the copy made.
      if (turns === 1) atWork(t, "workcopy");
      if (turns === 2) {
        madeCopy(paths);
        rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
      }
      assert.deepEqual(t.notices, []);
    };
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.equal(turns, 2);
    assert.deepEqual(t.notices, []);
    t.done();
  });
  it("a copy that is made while another run still holds the episode at the limit is not called unmade: she is told to ask again", async () => {
    const { t, paths } = kept();
    madeCopy(paths);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER), "read", () => true).taken, true);
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const r = await run(t);
    assert.equal(r.code, 1);
    assert.deepEqual(t.notices, [`The video for HyperFrames of ${NAME} is made, but it could not open by itself yet. Say "open ${NAME} in HyperFrames".`]);
    t.done();
  });
  it("posts the whole refusal when the project could not be opened", async () => {
    const { t, paths } = kept();
    madeCopy(paths);
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "not-installed" }));
    const r = await run(t);
    assert.equal(r.code, 1);
    const failed = readResult(t.home, FOLDER, "app").failed;
    assert.ok(failed.length >= 1);
    assert.deepEqual(t.notices, [failed.join(" ")]);
    t.done();
  });
  it("shows one open in 'how far is it?', not two", async () => {
    const { t, paths } = kept();
    madeCopy(paths);
    assert.equal((await run(t)).code, 0);
    const said = (await on(t.ctx.deps, "status")).text;
    assert.equal((said.match(/opening it in HyperFrames/g) || []).length, 1, said);
    assert.doesNotMatch(said, /waiting to open it/);
    t.done();
  });
  it("a local app with the video made says nothing of the other Mac when this Mac is offline", async () => {
    const { t, paths } = kept();
    madeCopy(paths);
    t.ctx.deps.online = async () => false;
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.doesNotMatch(r.text, /offline|other Mac/i);
    t.done();
  });
  it("B0-F29 names no video's file when no episode fits the folder it was started for", async () => {
    const { t } = kept();
    const r = await on(t.ctx.deps, "app", "--when-ready", "2026-10-20 Jane Doe couples session (Mac Studio)");
    assert.doesNotMatch(r.text, /Jane Doe|couples session/);
    t.done();
  });
  it("is for a video kept on this Mac: any other is told the help and nothing is done", async () => {
    const { t } = world({ record: RAW });
    writeSettings(t.home, { app: "hyperframes" });
    const r = await on(t.ctx.deps, "app", "--when-ready", FOLDER);
    assert.equal(r.code, 2);
    assert.equal(t.waits.length, 0);
    t.done();
  });
});
