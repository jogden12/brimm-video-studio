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
import { CLAIM_WAIT_MS, WHEN_READY_GRACE_MS, editMain } from "../edit.js";
import { lockOf, readResult, resultFile, takeEpisodeLock } from "../detached.js";
import { mediaOf, opensAfterSpellingsOf, whenReadyLockOf } from "../app.js";
import { localStamp, recordFile, recordText } from "../episode.js";
// The buttons line is said in her chat when HyperFrames is to open by itself: the detached run that opens it speaks to the log alone (B0-F8).
const BUTTONS = "In HyperFrames, share only with people you invite, and export on This Mac: the Export dialog may start on Cloud. The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now.";
import { COPY_STEP } from "../guide.js";
import { addRates, progressFolder } from "../progress.js";
import { episodeFilesFolder, episodeWork, exportsWords, writeSettings } from "../settings.js";
import { workCopyLockOf } from "../workcopy.js";
import { clockAt } from "../unedited.js";
import { CLIP, RAW, atWork, world } from "./workcopy-world.js";
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
const READING_SAID = "Claude is still reading it. Once Claude has read it, its video is made and you have answered the spellings card, HyperFrames opens it by itself.";
const WHEN_READY = ["app", "--when-ready", FOLDER];
const argsOf = (t) => t.started.map(([, args]) => args.slice(1));
const standInLog = (t) => join(t.home, "hyperframes-stand-in.log");

/** The made-up raw video kept on this Mac: its files in video/, as the import of a Mac with a drop folder of its own leaves them; the app is on. */
const READ_AT = "2026-10-20T16:00:00-05:00";
const READING = { kind: "raw", model: "m", at: READ_AT, on: "Mac Studio", account: "", outcome: "read" };
const ANSWER_OF_IT = { reading: READ_AT, at: READ_AT, on: "Mac Studio", applied: [], left: [] };
/** The spellings card of the reading: answered (the default: a video opens by itself once it is), still to answer, or (null) no reading in the record at all. */
const card = (answered, kind = "raw") => answered === null ? {} : ({ reading: { ...READING, kind }, offers: { spellings: [], ...(answered ? { answered: ANSWER_OF_IT } : {}) } });
function kept({ answered = true, base = RAW } = {}) {
  const w = world({ record: { ...base, ...LOCAL, ...card(answered, base.kind) } });
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

/** The token the copy asked for last was given (--asked <n>), or null. */
const askedOf = (t) => {
  const asks = argsOf(t).filter((a) => a[0] === "workcopy" && a.includes("--asked"));
  return asks.length ? Number(asks[asks.length - 1][asks[asks.length - 1].indexOf("--asked") + 1]) : null;
};
/** The result a run of a copy leaves (workcopy.result.json), as runDetached writes it: tagged with the copy and, when asked with one, the token. */
function mainResult(t, { ok, asked, copy = "main", endedAgo = 0, early } = {}) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  writeFileSync(resultFile(t.home, FOLDER, "workcopy"), JSON.stringify({ version: 1, command: "workcopy", copy, ...(asked !== undefined ? { asked } : {}), started: t.now() - endedAgo - 3000, ended: t.now() - endedAgo, ok, made: [], failed: ok ? [] : ["no room"], next: "", ...(early ? { early: true } : {}) }));
}

describe("kind: an answer for a video kept on this Mac", () => {
  const answered = async (record) => {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    const found = episodeFor(t, { record: { ...WAITING, ...record } });
    // A video kept on this Mac has its recording in video/ (B1-F12: an answer is refused when the recording is in neither place).
    if (record.local) {
      const own = episodeFilesFolder(t.home, FOLDER);
      mkdirSync(own, { recursive: true });
      writeFileSync(join(own, found.record.video.file), "the recording");
    }
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
  it("B1-F22 on a Mac with an exports folder of its own, she is also told where to export, in both forms of the line", async () => {
    for (const reading of [false, true]) {
      const { t } = kept({ answered: reading ? null : true });
      const exportsPath = join(t.home, "Exports");
      mkdirSync(exportsPath, { recursive: true });
      writeSettings(t.home, { exportsPath });
      t.ctx.settings = { ...t.ctx.settings, exportsPath };
      atWork(t, "workcopy");
      if (reading) atWork(t, "read");
      const r = await on(t.ctx.deps, "app", FOLDER);
      assert.equal(r.code, 0, r.text);
      const into = exportsWords(t.ctx.settings, t.home);
      assert.ok(into, "the picked folder is named");
      assert.deepEqual(r.said, [reading ? READING_SAID : BEING_MADE("when it is ready"), BUTTONS, `Export it on This Mac, into ${into}.`]);
      t.done();
    }
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
  const runAsked = (t, token) => on(t.ctx.deps, "app", "--when-ready", FOLDER, "--asked", String(token));
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
  it("B1-F3 the Reel's copy ended with a result (made or failed): the main copy is asked for with a token of its own, nothing is posted, and the project opens when that token's result is ok", async () => {
    for (const reelOk of [true, false]) {
      const { t, found, paths } = kept();
      atWork(t, "workcopy");
      const wait = t.ctx.deps.wait;
      let turns = 0;
      t.ctx.deps.wait = async (ms) => {
        await wait(ms);
        turns += 1;
        if (turns === 1) {
          rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
          mainResult(t, { ok: reelOk, copy: "reel" });
        }
        // The main copy's run, asked for after the Reel's ended, takes its lock one look later, and makes the copy the look after that.
        if (turns === 3) atWork(t, "workcopy");
        if (turns === 5) {
          madeCopy(paths);
          mainResult(t, { ok: true, asked: askedOf(t) });
          rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
        }
      };
      const r = await run(t);
      assert.equal(r.code, 0, `reel ${reelOk}: ${r.text}`);
      assert.deepEqual(t.notices, [], `reel ${reelOk}`);
      assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 1, JSON.stringify(argsOf(t)));
      assert.equal(reread(found).app.projects[0].state, "opened");
      t.done();
    }
  });
  it("T1 a Reel's copy is at work when she asks, it ends ok with the main copy not made, and a failed main result from 5 s earlier is on disk: the main copy is asked for with its own token, no notice, and it opens on that token's ok result", async () => {
    const { t, found, paths } = kept();
    mainResult(t, { ok: false, copy: "main", endedAgo: 5000 });
    atWork(t, "workcopy");
    const wait = t.ctx.deps.wait;
    let turns = 0;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      turns += 1;
      if (turns === 1) {
        rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
        mainResult(t, { ok: true, copy: "reel" });
      }
      if (turns === 2) {
        assert.equal(askedOf(t) !== null, true, JSON.stringify(argsOf(t)));
        atWork(t, "workcopy");
      }
      if (turns === 4) {
        madeCopy(paths);
        mainResult(t, { ok: true, asked: askedOf(t) });
        rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
      }
      assert.deepEqual(t.notices, []);
    };
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 1, JSON.stringify(argsOf(t)));
    assert.equal(reread(found).app.projects[0].state, "opened");
    t.done();
  });
  it("T2 app asked with token T, and a failed main result without T that ended 5 s before when-ready began is on disk: it is not the answer, and T's ok result with the copy made opens the project", async () => {
    const { t, found, paths } = kept();
    const token = t.now();
    mainResult(t, { ok: false, copy: "main", endedAgo: 5000 });
    const wait = t.ctx.deps.wait;
    let turns = 0;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      turns += 1;
      if (turns === 1) atWork(t, "workcopy");
      if (turns === 2) {
        madeCopy(paths);
        mainResult(t, { ok: true, asked: token });
        rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
      }
      assert.deepEqual(t.notices, []);
    };
    const r = await runAsked(t, token);
    assert.equal(r.code, 0, r.text);
    assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 0, JSON.stringify(argsOf(t)));
    assert.equal(reread(found).app.projects[0].state, "opened");
    t.done();
  });
  it("T2b a failed result that is early, a Reel's, or the main's with another token is not the answer to the token", async () => {
    for (const odd of [{ early: true }, { copy: "reel" }, { asked: 1 }]) {
      const { t } = kept();
      const token = t.now();
      mainResult(t, { ok: false, asked: token, ...odd });
      const r = await runAsked(t, token);
      // Not answered: the ask goes unanswered for its grace, then the one own ask is made, and then the notice follows.
      assert.equal(r.code, 1);
      assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 1, JSON.stringify(odd));
      assert.equal(t.notices.length, 1);
      t.done();
    }
  });
  it("T3 the token's own result failed: exactly one notice and no own ask", async () => {
    const { t, found } = kept();
    const token = t.now();
    mainResult(t, { ok: false, asked: token });
    const r = await runAsked(t, token);
    assert.equal(r.code, 1);
    assert.deepEqual(t.notices, [`The video for HyperFrames of ${NAME} couldn't be made. Say "open ${NAME} in HyperFrames" to try again; if it says this again, ask Jason.`]);
    assert.deepEqual(argsOf(t), []);
    assert.equal(existsSync(standInLog(t)), false);
    assert.equal(reread(found).app, undefined);
    t.done();
  });
  it("T5 the run asked for never shows (no lock, no result): after the grace when-ready makes its one own ask, and when that never shows either, the notice follows its grace", async () => {
    const { t } = kept();
    const token = t.now();
    const began = t.now();
    const askedAt = [];
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      if (argsOf(t).length && askedAt.length === 0) askedAt.push(t.now());
    };
    const r = await runAsked(t, token);
    assert.equal(r.code, 1);
    assert.deepEqual(argsOf(t).map((a) => a.slice(0, 3)), [["workcopy", "--now", FOLDER]]);
    assert.equal(askedOf(t) !== null && askedOf(t) !== token, true);
    assert.ok(askedAt[0] - began >= WHEN_READY_GRACE_MS && askedAt[0] - began <= WHEN_READY_GRACE_MS + 2000, `${askedAt[0] - began}`);
    assert.ok(t.now() - askedAt[0] >= WHEN_READY_GRACE_MS - 2000, "the own ask has a grace of its own");
    assert.equal(t.notices.length, 1);
    t.done();
  });
  it("T6 no token, a main copy at work ends ok before the next look: the project opens and nothing is asked for", async () => {
    const { t, found, paths } = kept();
    atWork(t, "workcopy");
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      madeCopy(paths);
      mainResult(t, { ok: true });
      rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
    };
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(argsOf(t), []);
    assert.deepEqual(t.notices, []);
    assert.equal(reread(found).app.projects[0].state, "opened");
    t.done();
  });
  it("T7 openByItself gives when-ready the token only when its request for the copy started a run", async () => {
    const { t } = kept();
    const first = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(first.code, 0, first.text);
    const token = askedOf(t);
    assert.equal(token, t.now());
    assert.deepEqual(argsOf(t), [["workcopy", "--now", FOLDER, "--asked", String(token)], ["app", "--when-ready", FOLDER, "--asked", String(token)]]);
    t.done();
    // A copy already at work: nothing is asked for, so the run gets no token.
    const w = kept();
    atWork(w.t, "workcopy");
    await on(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual(argsOf(w.t), [WHEN_READY]);
    w.t.done();
  });
  it("a --when-ready that is given anything but the folder, or the folder and --asked with a whole number, is the help and nothing is done", async () => {
    for (const given of [["--asked"], ["--asked", "x"], ["--asked", "1.5"], ["--asked", "5", "extra"], ["extra"]]) {
      const { t } = kept();
      const r = await on(t.ctx.deps, "app", "--when-ready", FOLDER, ...given);
      assert.equal(r.code, 2, given.join(" "));
      assert.equal(t.waits.length, 0);
      t.done();
    }
  });
  it("B1-F13 with the reading and the copy both at work, she is told it opens after the reading, not at the copy's time", async () => {
    const { t } = kept({ answered: null });
    atWork(t, "workcopy");
    atWork(t, "read");
    addRates(progressFolder(t.home), { [COPY_STEP]: 0.1 });
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, new RegExp(READING_SAID.replace(/[.,]/g, "\\$&")), r.text);
    assert.doesNotMatch(r.text, /about \d/);
    t.done();
  });
  it("B1-F4 the reading ended without a reading in the record: nothing opens and the notice says so; with the reading written, HyperFrames opens once", async () => {
    for (const failed of [true, false]) {
      const { t, found, paths } = kept({ answered: null });
      madeCopy(paths);
      atWork(t, "read");
      const wait = t.ctx.deps.wait;
      t.ctx.deps.wait = async (ms) => {
        await wait(ms);
        rmSync(lockOf(t.home, FOLDER), { force: true });
        writeFileSync(resultFile(t.home, FOLDER, "read"), JSON.stringify({ version: 1, command: "read", started: t.now() - 3000, ended: t.now(), ok: !failed, made: [], failed: failed ? ["Claude stopped"] : [], next: "" }));
        if (!failed) {
          const record = reread(found);
          writeFileSync(recordFile(found.folder, 2), recordText({ ...record, rev: 2, ...card(true) }));
        }
      };
      const r = await run(t);
      if (failed) {
        assert.equal(r.code, 1, r.text);
        assert.deepEqual(t.notices, [`Claude's reading of ${NAME} did not finish, so HyperFrames did not open it. Say "how far is it?" to see why.`]);
        assert.equal(existsSync(standInLog(t)), false);
        assert.equal(reread(found).app, undefined);
      } else {
        assert.equal(r.code, 0, r.text);
        assert.deepEqual(t.notices, []);
        assert.equal(readFileSync(standInLog(t), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.args[0] === "open").length, 1);
      }
      t.done();
    }
  });
  it("B1-F3 a failure of the main copy's own run, with the token it was asked with, is the answer: the notice is posted and no second copy is asked for", async () => {
    const { t } = kept();
    const token = t.now();
    mainResult(t, { ok: false, asked: token, endedAgo: 1000 });
    const r = await runAsked(t, token);
    assert.equal(r.code, 1);
    assert.equal(t.notices.length, 1);
    assert.equal(argsOf(t).filter((a) => a[0] === "workcopy").length, 0);
    t.done();
  });
  it("B0-F28 while Claude is still reading, she is told it opens by itself, not to say it again, whether the copy is made or not", async () => {
    for (const made of [false, true]) {
      const { t, paths } = kept({ answered: null });
      if (made) madeCopy(paths);
      atWork(t, "read");
      const r = await on(t.ctx.deps, "app", FOLDER);
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, new RegExp(READING_SAID.replace(/[.,]/g, "\\$&")), `made ${made}: ${r.text}`);
      assert.doesNotMatch(r.text, /again/);
      assert.ok(argsOf(t).some((a) => a[1] === "--when-ready"), JSON.stringify(argsOf(t)));
      t.done();
    }
  });
  it("B0-F27 a copy that failed with the token it was asked with is taken as decided at once, not waited for the copy's whole limit", async () => {
    const { t } = kept();
    const token = t.now() - 4000;
    mainResult(t, { ok: false, asked: token, endedAgo: 1000 });
    const r = await runAsked(t, token);
    assert.equal(r.code, 1);
    assert.ok(t.waits.length < 5, `${t.waits.length} waits`);
    assert.equal(t.notices.length, 1);
    t.done();
  });
  it("started just after the copy was asked for, it waits for the copy's run to be seen rather than posting the notice at once", async () => {
    const { t, paths } = kept();
    const token = t.now();
    let turns = 0;
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      turns += 1;
      // Nothing at work on the first look: the copy's run has not taken its lock yet. It does, then it ends with the copy made.
      if (turns === 1) atWork(t, "workcopy");
      if (turns === 2) {
        madeCopy(paths);
        mainResult(t, { ok: true, asked: token });
        rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
      }
      assert.deepEqual(t.notices, []);
    };
    const r = await runAsked(t, token);
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

// A video kept on this Mac opens in HyperFrames by itself only once she has answered its spellings card (Jason, 7 Nov 2026): a project's words and
// spellings are written once, when it is made, so spellings answered later never reach its captions.
describe("opening by itself waits for the spellings card", () => {
  const run = (t) => on(t.ctx.deps, "app", "--when-ready", FOLDER);
  const markerOf = (t) => opensAfterSpellingsOf(t.home, FOLDER);
  const marked = (t) => existsSync(markerOf(t));
  const putMarker = (t) => {
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(markerOf(t), JSON.stringify({ at: t.now() }));
  };
  const opensOf = (t) => (existsSync(standInLog(t)) ? readFileSync(standInLog(t), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.args[0] === "open") : []);
  const ALONE = "It opens in HyperFrames by itself in a moment.";
  const WAITS = "It opens once its spellings card is answered.";
  const ASKED_EARLY = "Its video for HyperFrames is being made. HyperFrames opens it by itself once it is made and you have answered the spellings card.";
  const looksAt = (t) => t.waits.filter((ms) => ms === 500).length;

  it("S1 the copy is made and the card is not answered: nothing opens, no notice, the marker is written, and the result says it opens once the card is answered", async () => {
    const { t, paths } = kept({ answered: false });
    madeCopy(paths);
    const r = await run(t);
    assert.equal(r.code, 1, r.text);
    assert.equal(existsSync(standInLog(t)), false);
    assert.deepEqual(t.notices, []);
    assert.equal(marked(t), true);
    assert.equal(Number.isFinite(JSON.parse(readFileSync(markerOf(t), "utf8")).at), true);
    assert.deepEqual(readResult(t.home, FOLDER, "when-ready").failed, [WAITS]);
    assert.equal(existsSync(whenReadyLockOf(t.home, FOLDER)), false);
    t.done();
  });
  it("S2 the card is answered between the marker and the read again that follows it (the deps.marked seam): it opens, and the marker is gone", async () => {
    const { t, found, paths } = kept({ answered: false });
    madeCopy(paths);
    let answered = false;
    // The seam right after the marker is in place: her answer lands then, after the first read and before the read again.
    t.ctx.deps.marked = () => {
      answered = true;
      const record = reread(found);
      writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, ...card(true) }));
    };
    const r = await run(t);
    assert.equal(answered, true, "the marker was written");
    assert.equal(r.code, 0, r.text);
    assert.equal(opensOf(t).length, 1);
    assert.equal(marked(t), false);
    assert.deepEqual(t.notices, []);
    t.done();
  });
  it("S3 her answer to the card of a kept video with the marker removes the marker, starts app --when-ready with no token, and says it opens in a moment", async () => {
    const { t } = kept({ answered: false });
    putMarker(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(marked(t), false);
    assert.deepEqual(argsOf(t), [WHEN_READY]);
    assert.equal(argsOf(t)[0].includes("--asked"), false);
    assert.equal(r.said[r.said.length - 1], ALONE);
    t.done();
  });
  it("S4 her answer with no marker starts nothing and adds no line", async () => {
    const { t } = kept({ answered: false });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(argsOf(t), []);
    assert.doesNotMatch(r.text, /in a moment/);
    t.done();
  });
  it("S5 a when-ready run holds its lock: the answer waits for it, 500 ms at a time, up to 10 s; freed after two looks it starts one, held past 10 s it starts none; both say the line", async () => {
    for (const freed of [true, false]) {
      const { t } = kept({ answered: false });
      putMarker(t);
      whenReadyAtWork(t);
      const wait = t.ctx.deps.wait;
      let turns = 0;
      t.ctx.deps.wait = async (ms) => {
        await wait(ms);
        turns += 1;
        // M4: the marker is the sign until the start is decided.
        assert.equal(marked(t), true, "the marker is still on disk while the answer waits");
        if (freed && turns === 2) rmSync(whenReadyLockOf(t.home, FOLDER), { force: true });
      };
      const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
      assert.equal(r.code, 0, r.text);
      assert.equal(marked(t), false);
      assert.equal(r.said[r.said.length - 1], ALONE, `freed ${freed}`);
      if (freed) {
        assert.deepEqual(argsOf(t), [WHEN_READY]);
        assert.equal(looksAt(t), 2);
      } else {
        assert.deepEqual(argsOf(t), []);
        assert.ok(looksAt(t) >= 19 && looksAt(t) <= 20, `${looksAt(t)} looks`);
      }
      t.done();
    }
  });
  /** The main project made, as the record keeps it, with its video in it (`video`) or without (after `free`). */
  const projectMade = (t, found, { video, raw }) => {
    const record = reread(found);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, app: { toolchain: "0.8.208", projects: [{ key: "main", name: "Mine already", madeAt: READ_AT, on: "Mac Studio", from: { file: reread(found).video.file, bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) }, workingCopy: { bytes: 24, seconds: 23.423, fps: 30 }, opened: [READ_AT], handover: false, fromSuggestion: null, state: "opened" }] } }));
    const dir = join(episodeWork(t.home, FOLDER), "Mine already");
    mkdirSync(join(dir, "brimm"), { recursive: true });
    writeFileSync(join(dir, "brimm", "facts.json"), JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720 }));
    if (video) {
      mkdirSync(dirname(join(dir, mediaOf(reread(found)))), { recursive: true });
      writeFileSync(join(dir, mediaOf(reread(found))), "the video in the project");
    }
  };
  it("S6 (point 1) a run started when the main project holds its video ends at once: no copy asked for, nothing opened, no notice, ok, and any marker removed", async () => {
    const { t, found, raw } = kept({ answered: false });
    projectMade(t, found, { video: true, raw });
    putMarker(t);
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.equal(existsSync(standInLog(t)), false);
    assert.deepEqual(t.notices, []);
    assert.deepEqual(argsOf(t), []);
    assert.equal(marked(t), false);
    const ended = readResult(t.home, FOLDER, "when-ready");
    assert.deepEqual([ended.ok, ended.made, ended.failed], [true, [], []]);
    assert.equal(readResult(t.home, FOLDER, "app"), null);
    t.done();
  });
  it("I1 after `free` the project is on disk without its video: the copy is made again, the card is not answered, and it opens and puts the video back, with no marker", async () => {
    const { t, found, paths, raw } = kept({ answered: false });
    projectMade(t, found, { video: false, raw });
    madeCopy(paths);
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.equal(opensOf(t).length, 1);
    assert.equal(marked(t), false);
    assert.equal(existsSync(join(episodeWork(t.home, FOLDER), "Mine already", mediaOf(reread(found)))), true);
    assert.deepEqual(t.notices, []);
    t.done();
  });
  it("M5 a direct app on a kept video whose copy is made and whose card is not answered opens at once (unchanged)", async () => {
    const { t, found, paths } = kept({ answered: false });
    madeCopy(paths);
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(opensOf(t).length, 1);
    assert.equal(reread(found).app.projects[0].state, "opened");
    t.done();
  });
  it("I2 a leftover marker: a direct app that opens the project removes it, and the answer then starts no run and says no line", async () => {
    const { t, paths } = kept({ answered: false });
    madeCopy(paths);
    putMarker(t);
    const opened = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(opened.code, 0, opened.text);
    assert.equal(marked(t), false);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(argsOf(t), []);
    assert.doesNotMatch(r.text, /in a moment/);
    t.done();
  });
  it("I2b the marker is still there and the project holds its video: the answer starts nothing and says no line, and the marker goes", async () => {
    const { t, found, raw } = kept({ answered: false });
    projectMade(t, found, { video: true, raw });
    putMarker(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(argsOf(t), []);
    assert.doesNotMatch(r.text, /in a moment/);
    assert.equal(marked(t), false);
    t.done();
  });
  it("R1 the marker appears while the answer is being saved (after the peek found none): the open is still started, and the last line is the opens line", async () => {
    const { t } = kept({ answered: false });
    t.ctx.deps.saved = () => putMarker(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(argsOf(t), [WHEN_READY]);
    assert.equal(r.said[r.said.length - 1], ALONE);
    assert.equal(marked(t), false);
    t.done();
  });
  it("M1 a kept iPhone clip whose answer has the marker is not asked how to go on: no clip line, and the last line is the opens line", async () => {
    const without = kept({ answered: false, base: CLIP });
    const plain = await on(without.t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.match(plain.text, /open it in HyperFrames|hand it off|Handing it off/i, plain.text);
    without.t.done();
    const { t } = kept({ answered: false, base: CLIP });
    putMarker(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /open it in HyperFrames|hand it off|Handing it off/i);
    assert.equal(r.said[r.said.length - 1], ALONE);
    assert.deepEqual(argsOf(t), [WHEN_READY]);
    t.done();
  });
  it("S7 readings are off on this Mac: there is no card, so it opens with the record unanswered, as before, and writes no marker", async () => {
    const { t, paths } = kept({ answered: false });
    writeSettings(t.home, { app: "hyperframes", readings: false });
    t.ctx.settings = { ...t.ctx.settings, readings: false };
    madeCopy(paths);
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.equal(opensOf(t).length, 1);
    assert.equal(marked(t), false);
    t.done();
  });
  it("S8 what she is told when she asks early, word for word: still reading; unanswered; answered; readings off", async () => {
    const said = async (setting, { answered = true, reading = false, off = false }) => {
      const { t } = kept({ answered: reading ? null : answered });
      if (off) {
        writeSettings(t.home, { app: "hyperframes", readings: false });
        t.ctx.settings = { ...t.ctx.settings, readings: false };
      }
      atWork(t, "workcopy");
      if (reading) atWork(t, "read");
      const r = await on(t.ctx.deps, "app", FOLDER);
      t.done();
      return r.said;
    };
    assert.deepEqual(await said("reading", { reading: true }), ["Claude is still reading it. Once Claude has read it, its video is made and you have answered the spellings card, HyperFrames opens it by itself.", BUTTONS]);
    assert.deepEqual(await said("reading, unanswered", { reading: true, answered: false }), ["Claude is still reading it. Once Claude has read it, its video is made and you have answered the spellings card, HyperFrames opens it by itself.", BUTTONS]);
    assert.deepEqual(await said("unanswered", { answered: false }), [ASKED_EARLY, BUTTONS]);
    assert.deepEqual(await said("answered", {}), [BEING_MADE("when it is ready"), BUTTONS]);
    assert.deepEqual(await said("readings off", { answered: false, off: true }), [BEING_MADE("when it is ready"), BUTTONS]);
  });
  it("S9 the whole path: asked while the copy is at work, the copy is made and the card is not answered (nothing opens, the marker waits), then her answer starts it and it opens", async () => {
    const { t, found, paths } = kept({ answered: false });
    atWork(t, "workcopy");
    const first = await on(t.ctx.deps, "app", FOLDER);
    assert.deepEqual(first.said, [ASKED_EARLY, BUTTONS]);
    assert.deepEqual(argsOf(t), [WHEN_READY]);
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      await wait(ms);
      madeCopy(paths);
      rmSync(workCopyLockOf(t.home, FOLDER), { force: true });
    };
    const early = await run(t);
    t.ctx.deps.wait = wait;
    assert.equal(early.code, 1, early.text);
    assert.equal(existsSync(standInLog(t)), false);
    assert.equal(marked(t), true);
    assert.deepEqual(t.notices, []);
    const answer = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(answer.code, 0, answer.text);
    assert.equal(marked(t), false);
    assert.deepEqual(argsOf(t), [WHEN_READY, WHEN_READY]);
    // The run it started:
    const later = await run(t);
    assert.equal(later.code, 0, later.text);
    assert.equal(opensOf(t).length, 1);
    assert.equal(reread(found).app.projects[0].state, "opened");
    assert.deepEqual(t.notices, []);
    t.done();
  });
});
