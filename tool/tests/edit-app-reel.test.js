// `app "<episode>" reel <n>`: opening a Reel of an episode in the HyperFrames app from Sallie's chat (plan PR 5; architecture 2026-10-27,
// sections 4.1 step 10, 4.3, 6.1, 6.2, 6.3 and 7.1), and the commands that meet Reels made there: `title`, `reels` and `reel`.
// edit.js is only the wiring here. It finds the episode through the gate, refuses what the record alone refuses, makes the claim and
// the bring that `open` and `app` make (one function, claimAndBring), and gives the episode to app-reel.js's openReelInApp, which
// app-reel.test.js tests on its own. These tests run all of it through editMain, with the stand-in for the pinned command line
// (tests/stand-ins/hyperframes.mjs), so no test runs HyperFrames, the app, HeyGen or `claude`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLAIM_WAIT_MS, COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { NOT_SET_UP } from "../app.js";
import { openReelWords, reelStretch } from "../app-reel.js";
import { clockText } from "../clock.js";
import { HELD } from "../gate.js";
import { lockOf, readResult, takeEpisodeLock } from "../detached.js";
import { layoutOf, localStamp, recordFile, recordText } from "../episode.js";
import { PIN } from "../hyperframes.js";
import { notMadeWords } from "../reels.js";
import { episodeWork, writeSettings } from "../settings.js";
import { reelCopyKey, reelCopyPaths, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { probed } from "./fixtures.js";
import { FOLDER, NAME, episodeAs, listAll, reread } from "./episodes.js";
import { episode, episodeFiles } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|workcopy|reels\.json/;
/** `app` as Claude runs it, once the words are given; and a check that every line it said, whichever way it ended, is plain. */
async function app(deps, ...words) {
  const r = await on(deps, "app", ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}
/** What the stand-in wrote down of each run of the pinned command line on this Mac. */
function runsOf(t) {
  const log = join(t.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

const START = Date.parse("2026-10-20T15:00:00-05:00");
const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
const RAW = { version: 3, kind: "raw", answer: ANSWERED };
const FINISHED = { ...RAW, kind: "finished" };
const UNANSWERED_RECORD = { version: 3, kind: null, answer: ANSWER, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
const LEFT_RECORD = { ...UNANSWERED_RECORD, answer: { ...ANSWER, state: "not for brimm-video" } };
const SESSION_RECORD = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-20", session: SESSION_MARK };
const CLEARED_RECORD = { ...SESSION_RECORD, session: { ...SESSION_MARK, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } };
const HERS = { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" };

const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT_ALONE = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const NO_COMMAND_LINE = "HyperFrames' command line isn't on this Mac yet: ask Jason.";
const OPEN = "It's open in HyperFrames.";
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
const THEIRS = `Sallie's laptop has ${NAME} open, since 2026-10-20 14:00. Say "take it over" to open it here; anything not handed over stays on Sallie's laptop.`;
const REEL_COPY = "the Reel's bytes";
const PROJECT = "Pricing- what to charge- reel 2 3fa9c1";
const AGAIN = openReelWords(2, NAME);
const MAKING = `The video for Reel 2 is being made. Say "${AGAIN}" again when it is done; "how far is it?" shows how far it has got.`;
const STILL = `Claude is still reading it. Say "${AGAIN}" again when it has finished; "how far is it?" shows how far it has got.`;
/** What is said while a video is being made already and Reel 2's is not started: the run at work holds the one lock, so it may be
    this Reel's own (its faces are being looked for) or the main video's or another Reel's. */
const BUSY = `A video for HyperFrames is being made already, and they are made one at a time. Say "${AGAIN}" again when it is done; "how far is it?" shows how far it has got.`;

/** The made-up recording (phase4.js: its words, its cut plan and its Reel candidates, as the import files them, Reel 2 not picked),
    answered as `record` says. `set`: this Mac's settings turn the app on. `copy`: the Reel's video is made already (and `faces`, the
    faces found in it). `open`: how the stand-in answers `open`. The pinned command line is the stand-in, given to `app` through the
    deps. */
function world({ set = true, copy = true, faces = false, open = "opened", record = RAW } = {}) {
  const { t, found } = episode(record, {}, episodeFiles({ picked: false }));
  if (set) writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open }));
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const { stretch } = reelStretch(found.folder, 2);
  const paths = reelCopyPaths(t.home, FOLDER, 2, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, stretch));
  const seconds = Math.round((stretch.end - stretch.start) * 1000) / 1000;
  if (copy) {
    mkdirSync(dirname(paths.video), { recursive: true });
    writeFileSync(paths.video, REEL_COPY);
    writeFileSync(paths.facts, JSON.stringify({ seconds, fps: 30, width: 1280, height: 720, bytes: REEL_COPY.length, stretch }));
    if (faces) writeFileSync(paths.faces, JSON.stringify({ every: 2, stills: [{ file: "0001.jpg", faces: [{ x: 0.4, y: 0.2, w: 0.2, h: 0.3 }] }] }));
  }
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  return { t, found, raw, paths, stretch, seconds, work: episodeWork(t.home, FOLDER) };
}
const made = (stretch) => `Reel 2 is made: the recording from ${clockText(stretch.start)} to ${clockText(stretch.end)}.`;

/** Have the stand-in wait do `then` on the claim's wait, as Dropbox would bring a change across meanwhile. */
const duringTheWait = (t, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (ms) => {
    await wait(ms);
    if (ms === CLAIM_WAIT_MS) then();
  };
};

describe("app … reel: the command", () => {
  it("is app's, with its usage in the help beside app's own; with a Reel and no number, or no episode, it says the help and ends with 2, claiming nothing", async () => {
    assert.ok(COMMAND_NAMES.includes("app"));
    const lines = HELP.split("\n");
    const at = lines.indexOf('  node edit.js app "<episode>" reel <n> [--take-over]');
    assert.ok(at > lines.indexOf('  node edit.js app "<episode>" [--take-over]'), "the help has the usage line of a Reel");
    assert.match(lines[at + 1], /^ {40}make Reel <n>/);
    for (const argv of [[FOLDER, "reel"], ["reel", "2"], []]) {
      const { t, found } = world();
      const r = await on(t.ctx.deps, "app", ...argv);
      assert.deepEqual([r.code, r.said, reread(found).rev, t.waits, t.started, runsOf(t)], [2, [HELP], 1, [], [], []], argv.join(" "));
      t.done();
    }
  });
  it("takes `reel` and the number in any case, and the number as it is typed", async () => {
    for (const words of [["Reel", "2"], ["REEL", "02"]]) {
      const { t } = world();
      const r = await app(t.ctx.deps, FOLDER, ...words);
      assert.deepEqual([r.code, r.said.at(-2)], [0, OPEN], words.join(" "));
      t.done();
    }
  });
  it("finds the episode by the words before `reel`, several as one, as every command does", async () => {
    const { t, found } = world();
    const r = await app(t.ctx.deps, "Pricing", "talk", "reel", "2");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(reread(found).app.projects.map((p) => p.key), ["reel 2"]);
    t.done();
  });
});

describe("app … reel: the gate asks first, in its own words", () => {
  it("refuses a video not yet answered, a video left alone and a session not cleared, whether or not this Mac is set up, and does nothing", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [LEFT_RECORD, LEFT_ALONE], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      for (const set of [true, false]) {
        const { t, found } = world({ record, set });
        const before = listAll(found.folder);
        const r = await app(t.ctx.deps, FOLDER, "reel", "2");
        assert.deepEqual([r.code, r.said], [1, [why]], `${record.label} ${set}`);
        assert.deepEqual([reread(found).rev, listAll(found.folder), t.started, t.calls, t.waits, runsOf(t)], [1, before, [], [], [], []], `${record.label} ${set}`);
        for (const given of [FOLDER, "Pricing", "talk", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
        t.done();
      }
    }
  });
  it("refuses a session whether this Mac's training gate is on or off: app is in no list, and a Reel of it is the gate's", async () => {
    const { t, found } = world({ record: SESSION_RECORD });
    const taught = { ...t.ctx.deps, settings: { ...t.ctx.settings, app: "hyperframes", sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    const r = await app(taught, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, reread(found).rev, runsOf(t)], [1, [NOT_FOR_SESSION], 1, []]);
    t.done();
  });
  it("refuses a video held beside a session, as every command outside the first list is", async () => {
    const OLD = "e-20261010-a0a0a0";
    const { t, found } = world({ record: { ...RAW, versionOf: OLD } });
    episodeAs(t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, reread(found).rev, runsOf(t)], [1, [HELD], 1, []]);
    t.done();
  });
  it("runs for an answered raw video, a finished video, which has no main project but has Reels, and a session whose mark was cleared", async () => {
    for (const [what, record] of [["a raw video", RAW], ["a finished video", FINISHED], ["a session whose mark was cleared", CLEARED_RECORD]]) {
      const { t, found, stretch } = world({ record });
      const r = await app(t.ctx.deps, FOLDER, "reel", "2");
      assert.deepEqual([r.code, r.said], [0, [made(stretch), OPEN, BUTTONS]], what);
      assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.state, p.fromSuggestion]), [["reel 2", "opened", 2]], what);
      t.done();
    }
  });
  it("says an iPhone clip has no Reels, past the gate and before it looks at this Mac's settings, claiming and bringing nothing", async () => {
    for (const set of [true, false]) {
      const { t, found } = world({ record: { ...RAW, kind: "short video" }, set });
      const r = await app(t.ctx.deps, FOLDER, "reel", "2");
      assert.deepEqual([r.code, r.said, reread(found).rev, reread(found).editing, t.waits, t.started, runsOf(t)], [1, ["A short video has no Reels."], 1, null, [], [], []], String(set));
      t.done();
    }
  });
});

describe("app … reel: this Mac must be set up, and have the command line", () => {
  it("says this Mac isn't set up for HyperFrames, past the gate, and claims nothing", async () => {
    for (const settings of [{}, { app: "off" }]) {
      const { t, found } = world({ set: false });
      writeSettings(t.home, settings);
      const r = await app(t.ctx.deps, FOLDER, "reel", "2");
      assert.deepEqual([r.code, r.said], [1, [NOT_SET_UP]], JSON.stringify(settings));
      assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).app, t.waits, t.started, runsOf(t)], [1, null, undefined, [], [], []], JSON.stringify(settings));
      t.done();
    }
  });
  it("says the command line isn't on this Mac, once it is set up, and claims nothing", async () => {
    const { t, found } = world();
    delete t.ctx.deps.app;
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [NO_COMMAND_LINE]]);
    assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).app, t.waits, t.started, runsOf(t)], [1, null, undefined, [], [], []]);
    t.done();
  });
});

describe("app … reel: a Reel the record does not list, or has finished, is refused before anything is claimed", () => {
  it("says there is no such Reel, and which there are", async () => {
    for (const [number, said] of [["9", "There is no Reel 9. The Reels are 1, 2."], ["0", "There is no Reel 0. The Reels are 1, 2."]]) {
      const { t, found } = world();
      const r = await app(t.ctx.deps, FOLDER, "reel", number);
      assert.deepEqual([r.code, r.said], [1, [said]], number);
      assert.deepEqual([reread(found).rev, reread(found).editing, t.waits, t.started, runsOf(t)], [1, null, [], [], []], number);
      t.done();
    }
    const none = world();
    const base = reread(none.found);
    writeFileSync(recordFile(none.found.folder, 2), recordText({ ...base, rev: 2, reels: [] }));
    assert.deepEqual((await app(none.t.ctx.deps, FOLDER, "reel", "1")).said, ["There is no Reel 1. The Reels are none."]);
    none.t.done();
  });
  it("says a finished Reel is in the hand-off already, and does not make it again", async () => {
    const { t, found } = world();
    const base = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...base, rev: 2, reels: base.reels.map((r) => (r.n === 2 ? { ...r, status: "finished" } : r)) }));
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, reread(found).rev, t.waits, t.started, runsOf(t)], [1, ["Reel 2 is finished: it is in the hand-off already."], 2, [], [], []]);
    t.done();
  });
  it("picks a dropped Reel again, and opens the project of a finished one that has one", async () => {
    const { t, found } = world();
    const base = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...base, rev: 2, reels: base.reels.map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r)) }));
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    assert.equal(reread(found).reels.find((r) => r.n === 2).status, "picked");
    const finished = reread(found);
    writeFileSync(recordFile(found.folder, finished.rev + 1), recordText({ ...finished, rev: finished.rev + 1, reels: finished.reels.map((r) => (r.n === 2 ? { ...r, status: "finished" } : r)) }));
    const again = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    assert.equal(reread(found).reels.find((r) => r.n === 2).status, "finished");
    t.done();
  });
});

describe("app … reel: the claim and the bring are open's, and she is sent back to the Reel", () => {
  it("claims the episode, makes the Reel's project from its video, opens the app on it, and records the project and the Reel picked, in one write after the claim", async () => {
    const { t, found, raw, paths, work, stretch, seconds } = world();
    const before = listAll(found.folder);
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [made(stretch), OPEN, BUTTONS]]);
    const record = reread(found);
    // The claim, then the project: two records.
    assert.deepEqual([record.rev, record.version, layoutOf(record)], [3, 4, 4]);
    assert.deepEqual(record.editing, { by: "Mac Studio", since: localStamp(new Date(START)) });
    assert.deepEqual([t.waits, t.started], [[CLAIM_WAIT_MS], []]);
    const later = localStamp(new Date(START + CLAIM_WAIT_MS));
    assert.deepEqual(record.app, {
      toolchain: PIN.version,
      projects: [{
        key: "reel 2", name: PROJECT, madeAt: later, on: "Mac Studio",
        from: { file: "Pricing talk.mp4", bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) },
        workingCopy: { bytes: REEL_COPY.length, seconds, fps: 30 }, opened: [later], handover: false, fromSuggestion: 2, state: "opened"
      }]
    });
    assert.deepEqual(record.reels.map((reel) => [reel.n, reel.status]), [[1, "candidate"], [2, "picked"]]);
    const project = join(work, PROJECT);
    assert.equal(readFileSync(join(project, "media", "recording.mp4"), "utf8"), REEL_COPY);
    assert.ok(!existsSync(paths.video) && existsSync(paths.facts), "the Reel's video was moved in and its facts stay");
    assert.ok(JSON.parse(readFileSync(join(project, "transcript.json"), "utf8")).length > 0, "the Reel's own words");
    assert.deepEqual(listAll(found.folder).filter((file) => !before.includes(file)), ["record/0002.json", "record/0003.json"]);
    assert.deepEqual(record.files, found.record.files);
    assert.deepEqual(runsOf(t).map((run) => run.args), [["open", project, "--json"]]);
    t.done();
  });
  it("keeps the main project's entry, and `app` for the main video keeps the Reel's", async () => {
    const { t, found } = world();
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    // The main project needs the working copy of the whole video: made as the job would make it.
    const raw = statSync(join(found.folder, "Pricing talk.mp4"));
    const main = workCopyPaths(t.home, FOLDER, `${raw.size}-${Math.floor(raw.mtimeMs)}`);
    writeFileSync(main.video, "the working copy's bytes");
    writeFileSync(main.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: 24 }));
    assert.equal((await app(t.ctx.deps, FOLDER)).code, 0);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.state, p.fromSuggestion]), [["reel 2", "opened", 2], ["main", "opened", null]]);
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.opened.length]), [["main", 1], ["reel 2", 2]]);
    t.done();
  });
  it("opens the same Reel's project again when it is said again, without a second claim, video or project", async () => {
    const { t, found, work } = world();
    await app(t.ctx.deps, FOLDER, "reel", "2");
    const made1 = readdirSync(work).sort();
    const again = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    const record = reread(found);
    assert.deepEqual(readdirSync(work).sort(), made1);
    assert.deepEqual([record.rev, t.waits, t.started], [4, [CLAIM_WAIT_MS], []]);
    assert.deepEqual(record.app.projects.map((p) => [p.name, p.opened.length, p.state]), [[PROJECT, 2, "opened"]]);
    t.done();
  });
  it("is refused while the other Mac has the episode, in open's words, and does nothing; a take-over works as app's", async () => {
    const { t, found } = world({ record: { ...RAW, editing: HERS } });
    const refused = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([refused.code, refused.said], [1, [THEIRS]]);
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, [THEIRS], "open gives the same answer for the same claim");
    assert.deepEqual([reread(found).rev, reread(found).editing.by, reread(found).app, t.waits, t.started, runsOf(t)], [1, "Sallie's laptop", undefined, [], [], []]);
    const taken = await app(t.ctx.deps, FOLDER, "reel", "2", "--take-over");
    assert.equal(taken.code, 0, taken.text);
    assert.equal(taken.said[0], "Taken over from Sallie's laptop, who had it since 2026-10-20 14:00.");
    assert.deepEqual([reread(found).editing.by, reread(found).app.projects.map((p) => p.state)], ["Mac Studio", ["opened"]]);
    t.done();
  });
  it("brings the files that are not whole here before anything else, and says to say it again with the Reel's words; a bring app starts for the video says its own", async () => {
    const { t, found } = world();
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    const coming = (again) => `Dropbox is bringing 1 file of ${NAME} over to this Mac. Say "${again}" again when it is done; "how far is it?" shows how far it has got.`;
    assert.deepEqual([r.code, r.said], [0, [coming(AGAIN)]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--asked-by", "app reel 2"]]);
    assert.deepEqual([reread(found).rev, t.waits, runsOf(t)], [1, [], []]);
    assert.deepEqual((await app(t.ctx.deps, FOLDER)).said, [coming(`open ${NAME} in HyperFrames`)]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)).at(-1), ["bring", "--now", FOLDER, "--asked-by", "app"]);
    t.done();
  });
  it("brings the files for a take-over, and says to take it over again, as open does", async () => {
    const { t } = world({ record: { ...RAW, editing: HERS } });
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await app(t.ctx.deps, FOLDER, "reel", "2", "--take-over");
    assert.deepEqual([r.code, r.said], [0, [`Dropbox is bringing 1 file of ${NAME} over to this Mac. Say "take it over" again when it is done; "how far is it?" shows how far it has got.`]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--take-over", "--asked-by", "app reel 2"]]);
    t.done();
  });
  it("ends the bring it started by telling her to open that Reel, once every file is here or when one did not come", async () => {
    for (const [fails, next] of [[false, `Every file of ${NAME} is here. Say "${AGAIN}" again.`], [true, `Some files of ${NAME} are not here yet. Say "${AGAIN}" to try again.`]]) {
      const { t } = world();
      let brought = false;
      t.ctx.deps.isWhole = (path) => brought || !path.endsWith("Pricing talk.mp4");
      t.ctx.deps.readAll = async () => {
        if (fails) throw Object.assign(new Error("no space left"), { code: "ENOSPC" });
        brought = true;
      };
      await app(t.ctx.deps, FOLDER, "reel", "2");
      await on(t.ctx.deps, ...t.started[0][1].slice(1));
      const result = readResult(t.home, FOLDER, "bring");
      assert.equal(result.next, next);
      assert.doesNotMatch(result.next, PLAIN);
      t.done();
    }
  });
  it("keeps app's own words for the main video's bring, and a bring told another asker, or none, says open's", async () => {
    const { t } = world();
    let brought = false;
    t.ctx.deps.isWhole = (path) => brought || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async () => {
      brought = true;
    };
    await on(t.ctx.deps, "bring", "--now", FOLDER, "--asked-by", "app");
    assert.equal(readResult(t.home, FOLDER, "bring").next, `Every file of ${NAME} is here. Say "open ${NAME} in HyperFrames" again.`);
    for (const asked of ["app reel", "app reel 0", "app reel x", "app reel 2 3", "open reel 2", "reel 2"]) {
      brought = false;
      await on(t.ctx.deps, "bring", "--now", FOLDER, "--asked-by", asked);
      assert.equal(readResult(t.home, FOLDER, "bring").next, `Every file of ${NAME} is here. Say "open ${NAME}".`, asked);
    }
    t.done();
  });
  it("stops with the claim's own words when Dropbox undid it, saying the Reel to say again, and goes through the next time", async () => {
    const { t, found } = world();
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
    });
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [`Dropbox undid this Mac's claim on ${NAME}. Say "${AGAIN}" again.`]]);
    assert.deepEqual([reread(found).rev, reread(found).editing, runsOf(t)], [1, null, []]);
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    t.done();
  });
});

describe("app … reel: the Reel's video", () => {
  it("is asked for when there is none, once; she is told to say it again when it is done, and nothing is waited for", async () => {
    const { t, found } = world({ copy: false });
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [MAKING]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER, "--reel", "2"]]);
    // The claim was made, as app's is; no project was, and the app was not asked.
    assert.deepEqual([reread(found).editing.by, reread(found).app, runsOf(t), existsSync(join(episodeWork(t.home, FOLDER), PROJECT))], ["Mac Studio", undefined, [], false]);
    t.done();
  });
  it("starts no second copy while one is being made, a Reel's or the video's: they share a lock. It does not say Reel 2's is being made, but that a video is", async () => {
    const { t } = world({ copy: false });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(workCopyLockOf(t.home, FOLDER), "workcopy", () => true).taken, true);
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, t.started], [0, [BUSY], []]);
    t.done();
  });
  it("writes no project while the run that made the video is still at work, as it is while it looks for the faces, and makes it when the run has ended", async () => {
    const { t, found, paths, work } = world({ faces: true });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(workCopyLockOf(t.home, FOLDER), "workcopy", () => true).taken, true);
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const waiting = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([waiting.code, waiting.said, t.started, runsOf(t), existsSync(join(work, PROJECT))], [0, [BUSY], [], [], false]);
    assert.equal(readFileSync(paths.video, "utf8"), REEL_COPY, "the video is where the finder is reading it");
    // The claim was made, as app's is, and no project was recorded.
    assert.deepEqual([reread(found).editing.by, reread(found).app], ["Mac Studio", undefined]);
    rmSync(workCopyLockOf(t.home, FOLDER));
    const opened = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.equal(opened.code, 0, opened.text);
    assert.ok(existsSync(join(work, PROJECT, "brimm", "face-track.json")), "the faces the run found are in the project");
    t.done();
  });
  it("is made by the run it asked for, and the project is then made from what that run made: the key it looks for is the key the run wrote", async () => {
    // The stand-ins answer for ffprobe by what is asked about: the recording is 23.423 seconds, what is cut from it is the Reel's.
    const { t, stretch, paths, work } = world({ copy: false });
    const seconds = stretch.end - stretch.start + 0.02;
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE") {
        const file = args[args.length - 1];
        writeFileSync(args[args.indexOf("-o") + 1], probed({ sound: { sample_rate: "48000", channels: 2 }, ...(file.includes("/.runs/") ? { duration: seconds.toFixed(6) } : {}) }));
        return { code: 0, stderr: "" };
      }
      return run(cmd, args, asked);
    };
    t.ctx.deps.runGuarded = async (cmd, args) => {
      writeFileSync(args[args.length - 1], "THE REEL CUT FROM THE RECORDING");
      return { code: 0, signal: null, stderr: "", overMemory: false, outOfTime: false, peak: 0, stopped: "" };
    };
    const first = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([first.code, first.said], [0, [MAKING]]);
    // The run `app` started, run as its detached run would run it.
    const [, args] = t.started[0];
    const cut = await on(t.ctx.deps, ...args.slice(1));
    assert.equal(cut.code, 0, cut.text);
    assert.ok(existsSync(paths.video) && existsSync(paths.facts), "the run wrote the files app looks for");
    const second = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([second.code, second.said], [0, [made(stretch), OPEN, BUTTONS]]);
    assert.equal(readFileSync(join(work, PROJECT, "media", "recording.mp4"), "utf8"), "THE REEL CUT FROM THE RECORDING");
    assert.deepEqual(t.started.length, 1, "the video was asked for once");
    t.done();
  });
  it("is not asked for, and nothing is made, while Claude is still reading: she is told to say it again", async () => {
    const { t, found } = world({ copy: false });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER), "read", () => true).taken, true);
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, t.started, runsOf(t), reread(found).app], [0, [STILL], [], [], undefined]);
    t.done();
  });
  it("says the words of the episode are not on this Mac, ending with 1, and makes and asks for nothing", async () => {
    const { t, found } = world();
    rmSync(join(found.folder, "Pricing talk.words.json"));
    const base = reread(found);
    const { files } = base;
    delete files["Pricing talk.words.json"];
    writeFileSync(recordFile(found.folder, 2), recordText({ ...base, rev: 2, files }));
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, t.started, runsOf(t)], [1, [`The words of ${NAME} are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason.`], [], []]);
    t.done();
  });
  it("says a suggestion that is no longer in the list is no Reel, with the Reels there are", async () => {
    const { t, found } = world({ copy: false });
    const at = join(found.folder, "reels.json");
    const reels = JSON.parse(readFileSync(at, "utf8"));
    writeFileSync(at, JSON.stringify({ ...reels, candidates: reels.candidates.filter((c) => c.n !== 2) }));
    // The list changed as a reading changes it, with the record listing its new size.
    const base = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...base, rev: 2, files: { ...base.files, "reels.json": statSync(at).size } }));
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said, t.started, runsOf(t)], [1, ["There is no Reel 2. The Reels are 1."], [], []]);
    t.done();
  });
});

describe("app … reel: the project, the record and the app", () => {
  it("offers the face positions in the project only when the Reel's video has some beside it", async () => {
    const withFaces = world({ faces: true });
    await app(withFaces.t.ctx.deps, FOLDER, "reel", "2");
    assert.ok(existsSync(join(withFaces.work, PROJECT, "brimm", "face-track.json")));
    const without = world();
    await app(without.t.ctx.deps, FOLDER, "reel", "2");
    assert.ok(!existsSync(join(without.work, PROJECT, "brimm", "face-track.json")));
    withFaces.t.done();
    without.t.done();
  });
  it("keeps the project when HyperFrames will not open, records no time it opened, and still marks the Reel picked", async () => {
    for (const [open, words] of [["not-installed", "HyperFrames isn't installed on this Mac: ask Jason."], ["open-failed", "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]]) {
      const { t, found, stretch } = world({ open });
      const r = await app(t.ctx.deps, FOLDER, "reel", "2");
      assert.deepEqual([r.code, r.said], [1, [made(stretch), words]], open);
      assert.deepEqual(reread(found).app.projects.map((p) => [p.state, p.opened]), [["made", []]], open);
      assert.equal(reread(found).reels.find((reel) => reel.n === 2).status, "picked", open);
      t.done();
    }
  });
  it("ends with 1 when the record cannot be written, after the project is made and the app has opened, and the next try takes the project it left", async () => {
    const { t, found, work } = world();
    const write = t.ctx.deps.clone;
    // The claim is written; the record with the project is not.
    let writes = 0;
    t.ctx.deps.clone = (from, to) => {
      writes += 1;
      if (writes > 1) throw new Error("the record cannot be written");
      write(from, to);
    };
    const failed = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
    t.ctx.deps.clone = write;
    assert.equal(failed.code, 1, failed.text);
    assert.ok(existsSync(join(work, PROJECT, "index.html")));
    assert.equal(reread(found).app, undefined);
    const r = await app(t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [OPEN, BUTTONS]]);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.state]), [["reel 2", "opened"]]);
    t.done();
  });
});

describe("app … reel: a Reel project that is on another Mac is not made again here (plan PR 11 brings the snapshot)", () => {
  const THERE = (on) => `The HyperFrames project for Reel 2 of ${NAME} is on ${on}, with everything done in it, so it can't be opened on this Mac yet. Ask Jason.`;
  const madeOn = (on) => ({
    ...RAW, version: 4,
    app: { toolchain: PIN.version, projects: [{
      key: "reel 2", name: PROJECT, madeAt: "2026-10-19T10:00:00-05:00", on, from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
      workingCopy: { bytes: REEL_COPY.length, seconds: 7, fps: 30 }, opened: ["2026-10-19T10:05:00-05:00"], handover: false, fromSuggestion: 2, state: "opened"
    }] }
  });
  it("is refused in words that name the Mac, with or without --take-over, and claims, brings, asks for and makes nothing", async () => {
    for (const more of [[], ["--take-over"]]) {
      const { t, found } = world({ record: madeOn("Sallie's laptop"), copy: false });
      const r = await app(t.ctx.deps, FOLDER, "reel", "2", ...more);
      assert.deepEqual([r.code, r.said], [1, [THERE("Sallie's laptop")]], more.join(" "));
      assert.deepEqual([reread(found).rev, reread(found).editing, t.waits, t.started, runsOf(t)], [1, null, [], [], []], more.join(" "));
      t.done();
    }
  });
  it("is opened when its folder is on this Mac, and made again, under its own name, when this Mac made it and the folder is gone; another Reel is not asked about it", async () => {
    const here = world({ record: madeOn("Sallie's laptop") });
    mkdirSync(join(here.work, PROJECT, "brimm"), { recursive: true });
    writeFileSync(join(here.work, PROJECT, "index.html"), "<html></html>");
    assert.equal((await app(here.t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    here.t.done();
    const mine = world({ record: madeOn("Mac Studio") });
    const r = await app(mine.t.ctx.deps, FOLDER, "reel", "2");
    assert.equal(r.code, 0, r.text);
    assert.ok(existsSync(join(mine.work, PROJECT, "index.html")));
    mine.t.done();
    const other = world({ record: madeOn("Sallie's laptop") });
    const second = await app(other.t.ctx.deps, FOLDER, "reel", "1");
    assert.equal(second.code, 0, second.text);
    other.t.done();
  });
});

/** The made-up episode with its Reel suggestions as a reading writes them (reels.json version 2): no crop, no preview, no title. The
    record lists the new size of the list. */
function suggested(opts = {}) {
  const w = world(opts);
  const at = join(w.found.folder, "reels.json");
  const reels = JSON.parse(readFileSync(at, "utf8"));
  writeFileSync(at, JSON.stringify({ ...reels, version: 2, candidates: reels.candidates.map((c) => ({ ...c, ranges: c.ranges.map(({ crop, ...range }) => range), preview: null, title: "" })) }));
  const base = reread(w.found);
  writeFileSync(recordFile(w.found.folder, 2), recordText({ ...base, rev: 2, files: { ...base.files, "reels.json": statSync(at).size } }));
  return w;
}

describe("title: a Reel that HyperFrames opened has a title on screen", () => {
  const NOT_MADE = (n) => `Reel ${n} isn't made yet. Say "${openReelWords(n, NAME)}" to make it.`;
  it("shows and sets the title of a Reel `app` made, which `title` refused when nobody had made it", async () => {
    const { t, found } = suggested();
    assert.equal((await on(t.ctx.deps, "title", FOLDER, "reel", "2")).code, 1, "nobody has made it yet");
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    const shown = await on(t.ctx.deps, "title", FOLDER, "reel", "2");
    assert.deepEqual([shown.code, shown.said], [0, [`Reel 2's title on screen is "Know your costs".`]], "Claude's hook, until she says otherwise");
    const set = await on(t.ctx.deps, "title", FOLDER, "reel", "2", "--words", "Say it again, better");
    assert.deepEqual([set.code, set.said], [0, [`Reel 2's title on screen is "Say it again, better".`]]);
    assert.equal(reread(found).reels.find((r) => r.n === 2).title, "Say it again, better");
    assert.deepEqual((await on(t.ctx.deps, "title", FOLDER, "reel", "2")).said, [`Reel 2's title on screen is "Say it again, better".`]);
    t.done();
  });
  it("still refuses a Reel nobody made: with the way to make it on a Mac set up for HyperFrames, and as it did on one that is not", async () => {
    const { t, found } = suggested();
    const r = await on(t.ctx.deps, "title", FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [NOT_MADE(2)]]);
    assert.doesNotMatch(r.text, PLAIN);
    const setting = await on(t.ctx.deps, "title", FOLDER, "reel", "2", "--words", "Say it again, better");
    assert.deepEqual([setting.code, setting.said, reread(found).rev], [1, [NOT_MADE(2)], 2]);
    const off = suggested({ set: false });
    const elsewhere = await on(off.t.ctx.deps, "title", FOLDER, "reel", "2");
    assert.deepEqual([elsewhere.code, elsewhere.said], [1, [notMadeWords(2)]]);
    t.done();
    off.t.done();
  });
  it("says there is no such Reel for a number the record does not list, as before", async () => {
    const { t } = suggested();
    assert.deepEqual((await on(t.ctx.deps, "title", FOLDER, "reel", "9")).said, ["There is no Reel 9."]);
    t.done();
  });
});

describe("reels: how to make one", () => {
  const MAKE_ONE = `To make one, say "${openReelWords(1, NAME)}", with the number of the one you want.`;
  it("ends the list of an answered video, on a Mac set up for HyperFrames, with how to make one, and not with the line that sends her to OpusClip", async () => {
    const { t } = suggested();
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.equal(r.code, 0, r.text);
    assert.match(r.said[0], /^Reel suggestions of /);
    assert.equal(r.said.at(-1), MAKE_ONE);
    assert.doesNotMatch(r.text, /OpusClip|cannot make Reels/);
    assert.doesNotMatch(r.said.at(-1), PLAIN);
    t.done();
  });
  it("says it of the one suggestion that is not dropped, in the singular, and names none that she dropped", async () => {
    const { t, found } = suggested();
    const base = reread(found);
    writeFileSync(recordFile(found.folder, 3), recordText({ ...base, rev: 3, reels: base.reels.map((r) => (r.n === 1 ? { ...r, status: "dropped" } : r)) }));
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.equal(r.said.at(-1), `To make it, say "${openReelWords(2, NAME)}".`);
    t.done();
  });
  it("says nothing of making one when she has dropped every suggestion", async () => {
    const { t, found } = suggested();
    const base = reread(found);
    writeFileSync(recordFile(found.folder, 3), recordText({ ...base, rev: 3, reels: base.reels.map((r) => ({ ...r, status: "dropped" })) }));
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.match(r.said.at(-1), /Dropped\./);
    assert.doesNotMatch(r.text, /To make|OpusClip/);
    t.done();
  });
  it("sends her to OpusClip, as it always did, on a Mac that is not set up for HyperFrames", async () => {
    const { t } = suggested({ set: false });
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.equal(r.said.at(-1), notMadeWords());
    assert.doesNotMatch(r.text, /To make/);
    t.done();
  });
  it("says nothing of making one for a video whose Reels are not suggestions, which brimm-video still makes in Final Cut", async () => {
    const { t } = world({ set: true });
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.doesNotMatch(r.text, /To make|OpusClip/);
    t.done();
  });
});

describe("push and the changes on a Reel: one HyperFrames opened is a project there, not a timeline in Final Cut", () => {
  const IN_HYPERFRAMES = `Reel 2 is a project in HyperFrames, not in Final Cut: say "${AGAIN}" to work on it there.`;
  const FINAL_CUT_WORDS = [["push", FOLDER, "reel", "2"], ["captions", FOLDER, "reel", "2", "on"], ["text", FOLDER, "reel", "2"], ["graphic", FOLDER, "reel", "2"], ["preset", FOLDER, "reel", "2", "--look", "bright"], ["cut", FOLDER, "remove", "reel", "2", "--words", "welcome"]];
  it("says so for `push` and for each change on a Reel, in place of sending her to OpusClip, and writes and opens nothing", async () => {
    const { t, found } = suggested();
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    const before = [reread(found).rev, listAll(found.folder), t.opened];
    for (const words of FINAL_CUT_WORDS) {
      const r = await on(t.ctx.deps, ...words);
      assert.deepEqual([r.code, r.said], [1, [IN_HYPERFRAMES]], words.join(" "));
      assert.doesNotMatch(r.text, PLAIN);
    }
    assert.deepEqual([reread(found).rev, listAll(found.folder), t.opened], before);
    t.done();
  });
  it("says so of a Reel she has dropped since, which is still a project there", async () => {
    const { t } = suggested();
    assert.equal((await app(t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    assert.equal((await on(t.ctx.deps, "reel", "drop", FOLDER, "2")).code, 0);
    assert.deepEqual((await on(t.ctx.deps, "push", FOLDER, "reel", "2")).said, [IN_HYPERFRAMES]);
    t.done();
  });
  it("still sends her where it did for a Reel nobody has opened, on a Mac set up for HyperFrames or not", async () => {
    for (const set of [true, false]) {
      const { t } = suggested({ set });
      for (const words of FINAL_CUT_WORDS) {
        const r = await on(t.ctx.deps, ...words);
        assert.deepEqual([r.code, r.said], [1, [notMadeWords(2)]], `${set} ${words.join(" ")}`);
      }
      t.done();
    }
  });
});

describe("push and the changes on a Reel not picked: she is told how a Reel is picked now that `reel pick` is gone", () => {
  const NOT_PICKED = (n) => `Reel ${n} is not picked.`;
  it("says on a Mac set up for HyperFrames that opening it picks it, and on one that is not that nothing picks a Reel", async () => {
    // Reel 2 of the made-up episode has crops (the import's candidate), so it is not one nobody has made: it is just not picked.
    for (const [set, then] of [[true, `Opening it in HyperFrames picks it: say "${AGAIN}".`], [false, "Nothing on this Mac picks a Reel any more: ask Jason."]]) {
      const { t } = world({ set });
      for (const words of [["push", FOLDER, "reel", "2"], ["captions", FOLDER, "reel", "2", "on"]]) {
        const r = await on(t.ctx.deps, ...words);
        assert.deepEqual([r.code, r.said], [1, [`${NOT_PICKED(2)} ${then}`]], `${set} ${words.join(" ")}`);
        assert.doesNotMatch(r.text, /Pick it first|reel pick/);
      }
      t.done();
    }
  });
});

describe("reel: pick is gone, and drop stays", () => {
  it("is the help and 2 for `reel pick`, whatever it is given, and writes nothing", async () => {
    for (const words of [["pick", FOLDER, "1"], ["pick", FOLDER, "1", "2"], ["pick", FOLDER], ["pick"], ["pick", "14", "--client-agreed"]]) {
      const { t, found } = world();
      const r = await on(t.ctx.deps, "reel", ...words);
      assert.deepEqual([r.code, r.said, reread(found).rev, t.started], [2, [HELP], 1, []], words.join(" "));
      t.done();
    }
  });
  it("names `reel drop` in the help, and no `reel pick`", () => {
    assert.ok(HELP.includes('  node edit.js reel drop "<episode>" <n>…'));
    assert.ok(!/reel pick|pick\|drop/.test(HELP));
  });
  it("drops Reels by number as before, and refuses as before a Reel that is not there, a finished one, none named and a short video", async () => {
    const { t, found } = world();
    const r = await on(t.ctx.deps, "reel", "drop", FOLDER, "1");
    assert.deepEqual([r.code, r.said], [0, ["Reel 1 is dropped."]]);
    assert.equal(reread(found).reels.find((reel) => reel.n === 1).status, "dropped");
    assert.deepEqual((await on(t.ctx.deps, "reel", "drop", FOLDER, "9")).said, ["There is no Reel 9. The Reels are 1, 2."]);
    assert.deepEqual((await on(t.ctx.deps, "reel", "drop", FOLDER)).said, ["Say which Reels, by their numbers."]);
    t.done();
  });
  it("drops a Reel HyperFrames opened, and leaves its project and its entry as they are", async () => {
    const { t, found, work } = world();
    await app(t.ctx.deps, FOLDER, "reel", "2");
    const r = await on(t.ctx.deps, "reel", "drop", FOLDER, "2");
    assert.deepEqual([r.code, r.said], [0, ["Reel 2 is dropped."]]);
    assert.deepEqual([reread(found).reels.find((reel) => reel.n === 2).status, reread(found).app.projects.map((p) => p.key), existsSync(join(work, PROJECT, "index.html"))], ["dropped", ["reel 2"], true]);
    t.done();
  });
  it("still takes a client's agreement to a session's Reel: `reel \"<label>\" <n> --client-agreed`", async () => {
    const { t } = world();
    const r = await on(t.ctx.deps, "reel", FOLDER, "2", "--client-agreed");
    assert.notEqual(r.code, 2, r.text);
    assert.notDeepEqual(r.said, [HELP]);
    t.done();
  });
});
