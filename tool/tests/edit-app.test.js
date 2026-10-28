// `app "<episode>"`: opening an episode's main video in the HyperFrames app from Sallie's chat (plan PR 4; architecture 2026-10-27,
// sections 4.1, 6.1, 6.2 and 7.2). edit.js is only the wiring here. It finds the episode through the gate, says whether this Mac is
// set up for the app and has its command line, makes the claim and the bring that `open` makes (one function, claimAndBring), and
// gives the episode to app.js's openInApp, which app.test.js tests on its own. These tests run all of it through editMain, with the
// stand-in for the pinned command line (tests/stand-ins/hyperframes.mjs), so no test runs HyperFrames, the app, HeyGen or `claude`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLAIM_WAIT_MS, COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { NOT_SET_UP } from "../app.js";
import { HELD } from "../gate.js";
import { lockOf, readResult } from "../detached.js";
import { layoutOf, localStamp, recordFile, recordText } from "../episode.js";
import { PIN, cliPath } from "../hyperframes.js";
import { episodeWork, writeSettings } from "../settings.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { FOLDER, NAME, episodeAs, listAll, reread } from "./episodes.js";
import { episode } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs/;
/** `app` as Claude runs it, once the words are given; and a check that every line it said, whichever way it ended, is plain. */
async function app(deps, ...words) {
  const r = await on(deps, "app", ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}

/** What the stand-in wrote down of each run of the pinned command line on this Mac: its arguments and the names of its environment. */
function runsOf(t) {
  const log = join(t.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}
/** The names of the variables the pinned command line is run with (hyperframes.js childEnv): no chat's id among them. */
const PINNED_ENV = ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];

const START = Date.parse("2026-10-20T15:00:00-05:00");
const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
/** The records the gate decides by: an answered raw video, a video not yet answered, one left alone, a session whose mark is not
    cleared, and one that is. */
const RAW = { version: 3, kind: "raw", answer: ANSWERED };
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
/** What `open` and `app` say, for the same claim, when the other Mac has the episode. */
const THEIRS = `Sallie's laptop has ${NAME} open, since 2026-10-20 14:00. Say "take it over" to open it here; anything not handed over stays on Sallie's laptop.`;
const WORKING_COPY = "the working copy's bytes";

/** The made-up recording (phase4.js: its words, its cut plan and its Reel candidates, as the import files them), answered as `record`
    says. `set`: this Mac's settings turn the app on. `copy`: the working copy of its video is made already. `open`: how the stand-in
    answers `open` (opened, not-installed or open-failed). The pinned command line is the stand-in, given to `app` through the deps. */
function world({ set = true, copy = true, open = "opened", record = RAW } = {}) {
  const { t, found } = episode(record);
  if (set) writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open }));
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  if (copy) {
    mkdirSync(dirname(paths.video), { recursive: true });
    writeFileSync(paths.video, WORKING_COPY);
    writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: WORKING_COPY.length }));
  }
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  return { t, found, raw, paths, work: episodeWork(t.home, FOLDER) };
}

/** Have the stand-in wait do `then` on the claim's wait, as Dropbox would bring a change across meanwhile. */
const duringTheWait = (t, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (ms) => {
    await wait(ms);
    if (ms === CLAIM_WAIT_MS) then();
  };
};

describe("app: the command", () => {
  it("is one of edit.js's commands, its usage is in the help, and with no episode it says the help and ends with 2, claiming nothing", async () => {
    assert.ok(COMMAND_NAMES.includes("app"));
    const lines = HELP.split("\n");
    const at = lines.indexOf('  node edit.js app "<episode>" [--take-over]');
    assert.ok(at >= 0, "the help has the usage line of app");
    assert.match(lines[at + 1], /^ {40}open the episode's main video in HyperFrames, making its project first/);
    const { t, found } = world();
    const r = await on(t.ctx.deps, "app");
    assert.deepEqual([r.code, r.said, reread(found).rev, t.waits, runsOf(t)], [2, [HELP], 1, [], []]);
    t.done();
  });
});

describe("app: the gate asks first, in its own words", () => {
  it("refuses a video not yet answered, a video left alone and a session not cleared, whether or not this Mac is set up, and does nothing", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [LEFT_RECORD, LEFT_ALONE], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      for (const set of [true, false]) {
        const { t, found } = world({ record, set });
        const before = listAll(found.folder);
        const r = await app(t.ctx.deps, FOLDER);
        assert.deepEqual([r.code, r.said], [1, [why]], `${record.label} ${set}`);
        assert.deepEqual([reread(found).rev, listAll(found.folder), t.started, t.calls, t.waits, runsOf(t)], [1, before, [], [], [], []], `${record.label} ${set}`);
        // It names no episode: not its folder, its name or its video's file.
        for (const given of [FOLDER, "Pricing", "talk", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
        t.done();
      }
    }
  });
  it("refuses a session whether this Mac's training gate is on or off: app is in no list", async () => {
    const { t, found } = world({ record: SESSION_RECORD });
    const taught = { ...t.ctx.deps, settings: { ...t.ctx.settings, app: "hyperframes", sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    const r = await app(taught, FOLDER);
    assert.deepEqual([r.code, r.said, reread(found).rev, runsOf(t)], [1, [NOT_FOR_SESSION], 1, []]);
    t.done();
  });
  it("refuses a video held beside a session, as every command outside the first list is", async () => {
    const OLD = "e-20261010-a0a0a0";
    const { t, found } = world({ record: { ...RAW, versionOf: OLD } });
    episodeAs(t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said, reread(found).rev, runsOf(t)], [1, [HELD], 1, []]);
    t.done();
  });
  it("runs for an answered raw video, an iPhone clip and a session whose mark was cleared", async () => {
    for (const [what, record] of [["a raw video", RAW], ["an iPhone clip", { ...RAW, kind: "short video" }], ["a session whose mark was cleared", CLEARED_RECORD]]) {
      const { t, found } = world({ record });
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [0, [OPEN]], what);
      assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.state]), [["main", "opened"]], what);
      t.done();
    }
  });
});

describe("app: after a correction of the kind, the next main project is another folder (architecture 4.8)", () => {
  const KEPT = "kept for an earlier kind";
  /** Every file of a project's folder, by its path, with what it holds: to see that the kept project is as it was. */
  const treeOf = (dir) => Object.fromEntries(listAll(dir).map((rel) => [rel, readFileSync(join(dir, rel), "utf8")]));
  /** She answers the episode `word` again (kind … --again), and the working copy's run that `kind` asked for is run as it would run. */
  async function corrected(t, word) {
    const before = t.started.length;
    const kind = await on(t.ctx.deps, "kind", NAME, word, "--private", "no", "--again");
    assert.equal(kind.code, 0, kind.text);
    const asked = t.started.slice(before).map(([, args]) => args.slice(1)).filter((args) => args[0] === "workcopy");
    assert.deepEqual(asked, [["workcopy", "--now", FOLDER]], "kind asked for a new working copy: the project that held the last is kept");
    const made = await on(t.ctx.deps, ...asked[0]);
    assert.equal(made.code, 0, made.text);
    return kind;
  }
  it("makes \"main 2\" for the new kind, records it as the main project, and keeps the first as it was, in the record and on disk", async () => {
    const { t, found, work } = world();
    assert.equal((await app(t.ctx.deps, FOLDER)).code, 0);
    const [first] = reread(found).app.projects;
    assert.equal(first.name, "Pricing- what to charge- main 3fa9c1");
    const firstTree = treeOf(join(work, first.name));
    const kind = await corrected(t, "clip");
    assert.ok(kind.said.includes(`Its HyperFrames project, made when it was answered as raw with retakes, is kept as it was. Say "open ${NAME} in HyperFrames" to make a new one.`));
    assert.deepEqual(reread(found).app.projects, [{ ...first, state: KEPT }]);
    // She says it, and app makes the next project: its name is the first no project of the record has.
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    const second = join(work, "Pricing- what to charge- main 2 3fa9c1");
    assert.equal(readFileSync(join(second, "media", "recording.mp4"), "utf8"), "a part of a Story");
    assert.equal(JSON.parse(readFileSync(join(second, "meta.json"), "utf8")).name, "Pricing- what to charge- main 2 3fa9c1");
    const projects = reread(found).app.projects;
    assert.deepEqual(projects.map((p) => [p.key, p.name, p.state, p.opened.length]), [["main", first.name, KEPT, 1], ["main", "Pricing- what to charge- main 2 3fa9c1", "opened", 1]]);
    assert.deepEqual(projects[0], { ...first, state: KEPT });
    // The first project is as it was, every file of it, and the stand-in opened each in its turn.
    assert.deepEqual(treeOf(join(work, first.name)), firstTree);
    assert.deepEqual(runsOf(t).map((run) => run.args), [["open", join(work, first.name), "--json"], ["open", second, "--json"]]);
    t.done();
  });
  it("makes \"main 3\" after the next correction, and asking again opens that one and makes no other", async () => {
    const { t, found, work } = world();
    await app(t.ctx.deps, FOLDER);
    await corrected(t, "clip");
    await app(t.ctx.deps, FOLDER);
    await corrected(t, "raw");
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    const names = ["Pricing- what to charge- main 3fa9c1", "Pricing- what to charge- main 2 3fa9c1", "Pricing- what to charge- main 3 3fa9c1"];
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.state]), [[names[0], KEPT], [names[1], KEPT], [names[2], "opened"]]);
    const made = readdirSync(work).sort();
    const again = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said, readdirSync(work).sort()], [0, [OPEN], made]);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.opened.length]), [[names[0], 1], [names[1], 1], [names[2], 2]]);
    t.done();
  });
  it("adopts the folder a run left at the \"main 2\" name when its record was not written, and writes nothing over it", async () => {
    const { t, found, work } = world();
    await app(t.ctx.deps, FOLDER);
    const [first] = reread(found).app.projects;
    await corrected(t, "clip");
    // The run that makes "main 2" gets as far as the app and cannot write the record: the folder is there, the record does not know it.
    const second = join(work, "Pricing- what to charge- main 2 3fa9c1");
    const rev = reread(found).rev;
    const write = t.ctx.deps.clone;
    t.ctx.deps.clone = () => {
      throw new Error("the record cannot be written");
    };
    // (Not through the helper that checks every line for a path: what a record that cannot be written says names the record's folder.)
    const failed = await on(t.ctx.deps, "app", FOLDER);
    t.ctx.deps.clone = write;
    assert.equal(failed.code, 1, failed.text);
    assert.ok(existsSync(join(second, "index.html")));
    assert.equal(reread(found).rev, rev, "the record was not written");
    const before = [readdirSync(work).sort(), treeOf(second)];
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual([readdirSync(work).sort(), treeOf(second)], before, "nothing was written over the folder that was there");
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.state]), [[first.name, KEPT], ["Pricing- what to charge- main 2 3fa9c1", "opened"]]);
    t.done();
  });
});

describe("app: a finished video is not edited in HyperFrames (architecture 4.3)", () => {
  const FINISHED = { ...RAW, kind: "finished" };
  const NO_PROJECT = `${NAME} was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames.`;
  it("lets the gate through and then says it has no project, and stops: the words are app's own, not the gate's", async () => {
    const { t } = world({ record: FINISHED });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [NO_PROJECT]]);
    for (const gate of [WAITING, LEFT_ALONE, NOT_FOR_SESSION, HELD]) assert.notEqual(r.said[0], gate);
    t.done();
  });
  it("claims nothing, brings nothing, asks for no working copy and writes no record, with the working copy made or not", async () => {
    for (const copy of [true, false]) {
      const { t, found, work } = world({ record: FINISHED, copy });
      const before = [listAll(found.folder), listAll(work)];
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [NO_PROJECT]], `copy ${copy}`);
      // No wait for a claim, no detached run (no bring, no working copy), no run of the command line, and the record as it was.
      assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).app, t.waits, t.started, runsOf(t)], [1, null, undefined, [], [], []], `copy ${copy}`);
      assert.deepEqual([listAll(found.folder), listAll(work)], before, `copy ${copy}`);
      t.done();
    }
  });
  it("brings nothing of a video that is not whole on this Mac yet, which a raw video's app brings first", async () => {
    const { t, found } = world({ record: FINISHED });
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said, t.started, reread(found).rev], [1, [NO_PROJECT], [], 1]);
    t.done();
  });
  it("says it before it looks at this Mac's settings and its command line, since nothing about this Mac changes it", async () => {
    for (const [what, set, withCli] of [["not set up", false, true], ["no command line", true, false], ["neither", false, false]]) {
      const { t, found } = world({ record: FINISHED, set });
      if (!withCli) delete t.ctx.deps.app;
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [NO_PROJECT]], what);
      assert.deepEqual([reread(found).rev, t.waits, t.started, runsOf(t)], [1, [], [], []], what);
      t.done();
    }
  });
  it("says it also for the other Mac's episode, which it does not claim, and for the take-over it is asked", async () => {
    for (const more of [[], ["--take-over"]]) {
      const { t, found } = world({ record: { ...FINISHED, editing: HERS } });
      const r = await app(t.ctx.deps, FOLDER, ...more);
      assert.deepEqual([r.code, r.said], [1, [NO_PROJECT]], more.join(" "));
      assert.deepEqual([reread(found).rev, reread(found).editing.by, t.waits, t.started, runsOf(t)], [1, "Sallie's laptop", [], [], []], more.join(" "));
      t.done();
    }
  });
  it("names the video by its name, as app's other lines do", async () => {
    const { t } = world({ record: { ...FINISHED, name: { text: "Budget talk", placeholder: false } } });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual(r.said, ["Budget talk was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames."]);
    t.done();
  });
  it("is said of a finished video alone: a raw video and an iPhone clip are opened, and a session not cleared is the gate's", async () => {
    for (const [record, code, said] of [[RAW, 0, [OPEN]], [{ ...RAW, kind: "short video" }, 0, [OPEN]], [SESSION_RECORD, 1, [NOT_FOR_SESSION]]]) {
      const { t } = world({ record });
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [code, said], String(record.kind));
      t.done();
    }
  });
});

describe("app: this Mac must be set up, and have the command line", () => {
  it("says this Mac isn't set up for HyperFrames, past the gate, and claims nothing", async () => {
    assert.equal(NOT_SET_UP, "This Mac isn't set up for HyperFrames yet: ask Jason.");
    for (const settings of [{}, { app: "off" }]) {
      const { t, found } = world({ set: false });
      writeSettings(t.home, settings);
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [NOT_SET_UP]], JSON.stringify(settings));
      assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).app, t.waits, t.started, runsOf(t)], [1, null, undefined, [], [], []], JSON.stringify(settings));
      t.done();
    }
  });
  it("says the command line isn't on this Mac, once it is set up, and claims nothing", async () => {
    const { t, found } = world();
    delete t.ctx.deps.app;
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [NO_COMMAND_LINE]]);
    assert.deepEqual([reread(found).rev, reread(found).editing, reread(found).app, t.waits, t.started, runsOf(t)], [1, null, undefined, [], [], []]);
    t.done();
  });
  it("runs the command line pinned in this Mac's toolchain folder when none is given", async () => {
    const { t, found, work } = world();
    // The toolchain's file is a one-line module that runs the stand-in, which is run by its own path, so that it finds its fixtures.
    mkdirSync(dirname(cliPath(t.home)), { recursive: true });
    writeFileSync(cliPath(t.home), `import ${JSON.stringify(pathToFileURL(STAND_IN).href)};\n`);
    t.ctx.deps.app = { node: process.execPath, guidance: GUIDANCE };
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual(runsOf(t), [{ args: ["open", join(work, reread(found).app.projects[0].name), "--json"], env: PINNED_ENV }]);
    t.done();
  });
});

describe("app: the claim and the bring are open's", () => {
  it("claims the episode, makes its project from the working copy, opens the app on it, and records it at layout 4", async () => {
    const { t, found, raw, paths, work } = world();
    const before = listAll(found.folder);
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    const record = reread(found);
    // The claim, then the project: two records, the claim at the start and the project when the claim's twenty seconds are over.
    assert.deepEqual([record.rev, record.version, layoutOf(record)], [3, 4, 4]);
    assert.deepEqual(record.editing, { by: "Mac Studio", since: localStamp(new Date(START)) });
    assert.deepEqual([t.waits, t.started], [[CLAIM_WAIT_MS], []]);
    const later = localStamp(new Date(START + CLAIM_WAIT_MS));
    assert.deepEqual(record.app, {
      toolchain: PIN.version,
      projects: [{
        key: "main", name: "Pricing- what to charge- main 3fa9c1", madeAt: later, on: "Mac Studio",
        from: { file: "Pricing talk.mp4", bytes: raw.size, modified: localStamp(new Date(raw.mtimeMs)) },
        workingCopy: { bytes: WORKING_COPY.length, seconds: 23.423, fps: 30 }, opened: [later], handover: false, fromSuggestion: null, state: "opened"
      }]
    });
    // The project is in this Mac's own folder, made from the working copy, which was moved in. The episode's folder in Dropbox got
    // the two records and nothing else, and its list of files is as it was.
    const project = join(work, record.app.projects[0].name);
    assert.equal(readFileSync(join(project, "media", "recording.mp4"), "utf8"), WORKING_COPY);
    assert.ok(existsSync(join(project, "index.html")));
    assert.ok(!existsSync(paths.video) && existsSync(paths.facts));
    assert.deepEqual(listAll(found.folder).filter((file) => !before.includes(file)), ["record/0002.json", "record/0003.json"]);
    assert.deepEqual(record.files, found.record.files);
    assert.deepEqual(runsOf(t), [{ args: ["open", project, "--json"], env: PINNED_ENV }]);
    t.done();
  });
  it("opens the same project again when it is said again, without a second claim or a second project", async () => {
    const { t, found, work } = world();
    await app(t.ctx.deps, FOLDER);
    const made = readdirSync(work).sort();
    const again = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [OPEN]]);
    const record = reread(found);
    assert.deepEqual(readdirSync(work).sort(), made);
    assert.deepEqual([record.rev, t.waits, t.started], [4, [CLAIM_WAIT_MS], []]);
    assert.deepEqual(record.app.projects.map((p) => [p.name, p.opened.length, p.state]), [["Pricing- what to charge- main 3fa9c1", 2, "opened"]]);
    assert.deepEqual(runsOf(t).map((run) => run.args[0]), ["open", "open"]);
    t.done();
  });
  it("is refused while the other Mac has the episode, in open's words, and does nothing", async () => {
    const { t, found } = world({ record: { ...RAW, editing: HERS } });
    const refused = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([refused.code, refused.said], [1, [THEIRS]]);
    // open gives the same answer for the same claim.
    const opened = await on(t.ctx.deps, "open", FOLDER);
    assert.deepEqual([opened.code, opened.said], [1, [THEIRS]]);
    assert.deepEqual([reread(found).rev, reread(found).editing.by, reread(found).app, t.waits, t.started, runsOf(t)], [1, "Sallie's laptop", undefined, [], [], []]);
    t.done();
  });
  it("takes the episode over from the other Mac with --take-over, as open --take-over does, and opens it", async () => {
    const { t, found } = world({ record: { ...RAW, editing: HERS } });
    const taken = await app(t.ctx.deps, FOLDER, "--take-over");
    assert.deepEqual([taken.code, taken.said], [0, ["Taken over from Sallie's laptop, who had it since 2026-10-20 14:00.", OPEN]]);
    const record = reread(found);
    assert.deepEqual([record.rev, record.editing.by, record.app.projects.map((p) => p.state), t.waits], [3, "Mac Studio", ["opened"], [CLAIM_WAIT_MS]]);
    t.done();
  });
  it("says what is wrong with the episode's files, in open's words, and opens nothing", async () => {
    const { t, found } = world();
    writeFileSync(join(found.folder, "Pricing talk.srt"), "x");
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${FOLDER} is not whole in Dropbox:`, `  Pricing talk.srt is short: 1 bytes of ${found.record.files["Pricing talk.srt"]}`, `It is not opened. Say "what's waiting?" to see the episodes.`]]);
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, r.said, "open gives the same answer for the same files");
    assert.deepEqual([reread(found).rev, t.waits, t.started, runsOf(t)], [1, [], [], []]);
    t.done();
  });
  it("brings the files that are not whole here before anything else, and says to say it again in its own words, as open says it in its", async () => {
    const { t, found } = world();
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await app(t.ctx.deps, FOLDER);
    const coming = (again) => `Dropbox is bringing 1 file of ${NAME} over to this Mac. Say "${again}" again when it is done; "how far is it?" shows how far it has got.`;
    assert.deepEqual([r.code, r.said], [0, [coming(`open ${NAME} in HyperFrames`)]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--asked-by", "app"]]);
    assert.deepEqual([reread(found).rev, t.waits, runsOf(t)], [1, [], []]);
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, [coming(`open ${NAME}`)]);
    // The bring open starts is told nothing of who asked: its words stay open's own.
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--asked-by", "app"], ["bring", "--now", FOLDER]]);
    t.done();
  });
  it("brings the files for a take-over, and says to take it over again, as open does", async () => {
    const { t, found } = world({ record: { ...RAW, editing: HERS } });
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
    const r = await app(t.ctx.deps, FOLDER, "--take-over");
    assert.deepEqual([r.code, r.said], [0, [`Dropbox is bringing 1 file of ${NAME} over to this Mac. Say "take it over" again when it is done; "how far is it?" shows how far it has got.`]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--take-over", "--asked-by", "app"]]);
    assert.deepEqual([reread(found).rev, reread(found).editing.by, t.waits, runsOf(t)], [1, "Sallie's laptop", [], []]);
    t.done();
  });
  it("waits for the files the other Mac handed over, and claims nothing until they are here", async () => {
    const { t, found } = world();
    const share = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [share]: 9 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { ...first.files, [share]: 9 } } }));
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`Still arriving from Sallie's laptop: 1 file. Dropbox is bringing them over; say "open ${NAME} in HyperFrames" again when it is done.`]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, share, "--asked-by", "app"]]);
    assert.deepEqual([reread(found).rev, t.waits, runsOf(t)], [2, [], []]);
    t.done();
  });
  it("stops with the claim's own words when Dropbox undid it, and goes through the next time", async () => {
    const { t, found } = world();
    let undid = false;
    duringTheWait(t, () => {
      if (undid) return;
      undid = true;
      rmSync(recordFile(found.folder, 2));
    });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`Dropbox undid this Mac's claim on ${NAME}. Say "open ${NAME} in HyperFrames" again.`]]);
    assert.deepEqual([reread(found).rev, reread(found).editing, runsOf(t)], [1, null, []]);
    const again = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [OPEN]]);
    t.done();
  });
  it("stops, saying whose it is, when the other Mac claimed the episode during the wait", async () => {
    const { t, found } = world();
    duringTheWait(t, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...mine, rev: mine.rev + 1, editing: { by: "Sallie's laptop", since: "2026-10-20T15:00:10-05:00" }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`Sallie's laptop opened ${NAME} at the same time, and it is theirs. Say "take it over" if they are done with it.`]]);
    assert.deepEqual(runsOf(t), []);
    t.done();
  });
  it("warns that the other Mac cannot see the claim when this Mac seems offline, and goes on", async () => {
    const { t } = world();
    t.ctx.deps.online = async () => false;
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, ["This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.", OPEN]]);
    t.done();
  });
});

describe("app: what the bring it starts says when it is done", () => {
  /** What `bring` says to say next, and what it made, as the result it leaves holds them. */
  const nextOf = (t) => readResult(t.home, FOLDER, "bring");
  /** The bring `app` started, run as its detached run would run it: the words it was started with, after the program and the file. */
  async function runStarted(t, which = 0) {
    const [, args] = t.started[which];
    return on(t.ctx.deps, ...args.slice(1));
  }
  /** Files not whole here until a bring has read them: the raw video. `readAll` is the bring's reading of one file to its end. */
  function offline(t, { fails = false } = {}) {
    const read = [];
    let brought = false;
    t.ctx.deps.isWhole = (path) => brought || !path.endsWith("Pricing talk.mp4");
    t.ctx.deps.readAll = async (path) => {
      read.push(path);
      if (fails) throw Object.assign(new Error("no space left"), { code: "ENOSPC" });
      brought = true;
    };
    return read;
  }
  it("says to open it in HyperFrames again, not to open it, once every file is here, so that her next words run app and not open", async () => {
    const { t } = world();
    offline(t);
    await app(t.ctx.deps, FOLDER);
    assert.equal((await runStarted(t)).code, 0);
    const result = nextOf(t);
    assert.deepEqual([result.ok, result.made, result.failed], [true, ["Pricing talk.mp4"], []]);
    assert.equal(result.next, `Every file of ${NAME} is here. Say "open ${NAME} in HyperFrames" again.`);
    assert.doesNotMatch(result.next, PLAIN);
    // "How far is it?" says it, as the result left it.
    const howFar = (await on(t.ctx.deps, "status")).text;
    assert.ok(howFar.endsWith(`Made: Pricing talk.mp4. Every file of ${NAME} is here. Say "open ${NAME} in HyperFrames" again.`), howFar);
    t.done();
  });
  it("says to open it in HyperFrames to try again, not to open it, when a file did not come", async () => {
    const { t } = world();
    const read = offline(t, { fails: true });
    await app(t.ctx.deps, FOLDER);
    assert.equal((await runStarted(t)).code, 1);
    assert.equal(read.length, 1);
    const result = nextOf(t);
    assert.deepEqual([result.ok, result.failed], [false, ["Pricing talk.mp4 could not be read (ENOSPC)"]]);
    assert.equal(result.next, `Some files of ${NAME} are not here yet. Say "open ${NAME} in HyperFrames" to try again.`);
    assert.doesNotMatch(result.next, PLAIN);
    t.done();
  });
  it("keeps open's own words for a bring open starts, exactly", async () => {
    const { t } = world();
    offline(t);
    await on(t.ctx.deps, "open", FOLDER);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER]]);
    assert.equal((await runStarted(t)).code, 0);
    assert.equal(nextOf(t).next, `Every file of ${NAME} is here. Say "open ${NAME}".`);
    t.done();
    const u = world();
    offline(u.t, { fails: true });
    await on(u.t.ctx.deps, "open", FOLDER);
    await runStarted(u.t);
    assert.equal(nextOf(u.t).next, `Some files of ${NAME} are not here yet. Say "open ${NAME}" to try again.`);
    u.t.done();
  });
  it("keeps what a take-over says next, to take it over again, and says app's words for the plain next", async () => {
    const { t } = world({ record: { ...RAW, editing: HERS } });
    offline(t);
    await app(t.ctx.deps, FOLDER, "--take-over");
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "--take-over", "--asked-by", "app"]]);
    assert.equal((await runStarted(t)).code, 0);
    const result = nextOf(t);
    assert.deepEqual(result.takeOver, { by: "Sallie's laptop", since: HERS.since, next: `Every file of ${NAME} is here. Say "take it over" again.` });
    assert.equal(result.next, `Every file of ${NAME} is here. Say "open ${NAME} in HyperFrames" again.`);
    // While her yes to the take-over stands, "how far is it?" says to take it over again, as it says it of open's.
    assert.match((await on(t.ctx.deps, "status")).text, /Say "take it over" again\.$/);
    t.done();
  });
  it("brings only the files it was given, and not the words that tell it who asked", async () => {
    const { t, found } = world();
    const share = "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov";
    const first = reread(found);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [share]: 9 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Sallie's laptop", files: { ...first.files, [share]: 9 } } }));
    let brought = false;
    t.ctx.deps.isWhole = (path) => brought || !path.endsWith(".mov");
    const read = [];
    t.ctx.deps.readAll = async (path) => {
      read.push(path);
      brought = true;
    };
    await app(t.ctx.deps, FOLDER);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, share, "--asked-by", "app"]]);
    assert.equal((await runStarted(t)).code, 0);
    assert.deepEqual([read, nextOf(t).made], [[join(found.folder, share)], [share]]);
    assert.equal(nextOf(t).next, `Every file of ${NAME} is here. Say "open ${NAME} in HyperFrames" again.`);
    t.done();
  });
  it("takes any other asker, or none, for open: only app has words of its own", async () => {
    for (const asked of [["--asked-by", "open"], ["--asked-by", "push"], ["--asked-by"], ["--asked-by", ""]]) {
      const { t } = world();
      offline(t);
      assert.equal((await on(t.ctx.deps, "bring", "--now", FOLDER, ...asked)).code, 0, asked.join(" "));
      assert.equal(nextOf(t).next, `Every file of ${NAME} is here. Say "open ${NAME}".`, asked.join(" "));
      t.done();
    }
  });
});

describe("app: a project that is on another Mac is not made again here (plan PR 11 brings the snapshot)", () => {
  const KEPT = "kept for an earlier kind";
  const PROJECT_NAME = "Pricing- what to charge- main 3fa9c1";
  const THERE = (on) => `${NAME}'s HyperFrames project is on ${on}, with everything done in it, so it can't be opened on this Mac yet. Ask Jason.`;
  /** The record of an episode whose main project was made on `on` (layout 4), as the record keeps it; `over` changes the project. */
  const madeOn = (on, over = {}) => ({
    ...RAW, version: 4,
    app: { toolchain: PIN.version, projects: [{
      key: "main", name: PROJECT_NAME, madeAt: "2026-10-19T10:00:00-05:00", on, from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
      workingCopy: { bytes: WORKING_COPY.length, seconds: 23.423, fps: 30 }, opened: ["2026-10-19T10:05:00-05:00"], handover: false, fromSuggestion: null, state: "opened", ...over
    }] }
  });
  /** What a refusal must leave as it was: the record whole, this Mac's work folder, the episode's folder, and everything started. */
  const state = (t, found, work) => ({ record: reread(found), work: listAll(work), folder: listAll(found.folder), waits: t.waits, started: t.started, runs: runsOf(t) });
  it("refuses, naming that Mac and saying to ask Jason, and does nothing: no claim, no bring, no working copy, no project, no record written", async () => {
    for (const [what, extra] of [["an episode nobody has open", {}], ["an episode the other Mac has open", { editing: HERS }]]) {
      const { t, found, work } = world({ record: { ...madeOn("Sallie's laptop"), ...extra } });
      const before = state(t, found, work);
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [THERE("Sallie's laptop")]], what);
      assert.deepEqual(state(t, found, work), before, what);
      assert.equal(before.record.rev, 1, what);
      assert.ok(!existsSync(join(work, PROJECT_NAME)), `${what}: no project is made`);
      t.done();
    }
  });
  it("refuses a take-over as well, with the claim as it was: the other Mac keeps the episode, and nothing is brought or made", async () => {
    for (const [what, extra] of [["an episode nobody has open", {}], ["an episode the other Mac has open", { editing: HERS }]]) {
      const { t, found, work } = world({ record: { ...madeOn("Sallie's laptop"), ...extra } });
      const before = state(t, found, work);
      const r = await app(t.ctx.deps, FOLDER, "--take-over");
      assert.deepEqual([r.code, r.said], [1, [THERE("Sallie's laptop")]], what);
      assert.deepEqual(state(t, found, work), before, what);
      assert.deepEqual([reread(found).editing, t.started, t.waits, runsOf(t)], [extra.editing ?? null, [], [], []], what);
      t.done();
    }
  });
  it("refuses before it looks at the files, so that nothing is brought over for a project it will not open, and before the working copy is asked for", async () => {
    for (const copy of [true, false]) {
      const { t, found } = world({ record: madeOn("Sallie's laptop"), copy });
      t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said, t.started, reread(found).rev], [1, [THERE("Sallie's laptop")], [], 1], `copy ${copy}`);
      t.done();
    }
  });
  it("names the Mac the project was made on, and the video as app's other lines name it", async () => {
    const { t } = world({ record: { ...madeOn("Mac mini"), name: { text: "Budget talk", placeholder: false } } });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual(r.said, ["Budget talk's HyperFrames project is on Mac mini, with everything done in it, so it can't be opened on this Mac yet. Ask Jason."]);
    t.done();
  });
  it("comes after the settings and the command line: a Mac not set up, or without the command line, says so first", async () => {
    const off = world({ record: madeOn("Sallie's laptop"), set: false });
    assert.deepEqual((await app(off.t.ctx.deps, FOLDER)).said, [NOT_SET_UP]);
    off.t.done();
    const bare = world({ record: madeOn("Sallie's laptop") });
    delete bare.t.ctx.deps.app;
    assert.deepEqual((await app(bare.t.ctx.deps, FOLDER)).said, [NO_COMMAND_LINE]);
    bare.t.done();
  });
  it("makes this Mac's own project again, under its own name, when its folder is gone: the record keeps one entry, opened now", async () => {
    const { t, found, work } = world({ record: madeOn("Mac Studio") });
    assert.ok(!existsSync(join(work, PROJECT_NAME)));
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.equal(readFileSync(join(work, PROJECT_NAME, "media", "recording.mp4"), "utf8"), WORKING_COPY);
    const later = localStamp(new Date(START + CLAIM_WAIT_MS));
    assert.deepEqual(reread(found).app.projects.map((p) => [p.key, p.name, p.on, p.madeAt, p.opened, p.state]), [["main", PROJECT_NAME, "Mac Studio", later, [later], "opened"]]);
    t.done();
  });
  it("opens a project of the other Mac's whose folder is on this Mac, as it opens any whose folder is here", async () => {
    const { t, found, work } = world({ record: madeOn("Sallie's laptop") });
    mkdirSync(join(work, PROJECT_NAME), { recursive: true });
    writeFileSync(join(work, PROJECT_NAME, "index.html"), "<html></html>");
    // The recording is as the project was made from it (its size and its time), so nothing is said of it.
    const made = Date.parse("2026-10-14T09:00:00-05:00") / 1000;
    utimesSync(join(found.folder, "Pricing talk.mp4"), made, made);
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.on, p.opened.length, p.state]), [[PROJECT_NAME, "Sallie's laptop", 2, "opened"]]);
    t.done();
  });
  it("is not asked of a project kept for an earlier kind, which is none in use: the next one is made, as \"main 2\"", async () => {
    const { t, found, work } = world({ record: madeOn("Sallie's laptop", { state: KEPT }) });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.on, p.state]), [[PROJECT_NAME, "Sallie's laptop", KEPT], ["Pricing- what to charge- main 2 3fa9c1", "Mac Studio", "opened"]]);
    assert.ok(existsSync(join(work, "Pricing- what to charge- main 2 3fa9c1", "index.html")));
    t.done();
  });
});

describe("app: Claude's reading is not finished (architecture 4.1)", () => {
  const STILL = `Claude is still reading ${NAME}. Say "open ${NAME} in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.`;
  /** The reading (`read`, a detached run) at work on the made-up episode now: it holds the episode's lock, and its process is alive. */
  function readingAtWork(t, command = "read") {
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command }));
    t.ctx.deps.alive = (pid) => pid === 4242;
  }
  it("claims the episode, makes no project and opens nothing while `read` is at work: it says Claude is still reading and ends with 0", async () => {
    const { t, found, paths, work } = world();
    readingAtWork(t);
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [STILL]]);
    // The claim is open's (the record at rev 2) and nothing more is written: no project in the record or in the work folder, nothing run.
    const record = reread(found);
    assert.deepEqual([record.rev, record.editing.by, record.app, runsOf(t), t.started], [2, "Mac Studio", undefined, [], []]);
    assert.deepEqual(readdirSync(work).sort(), ["episode.lock", "working copy"]);
    assert.ok(existsSync(paths.video), "the working copy is where it was, not moved into a project");
    t.done();
  });
  it("makes the project when it is said again after the reading has ended, and the claim is not made twice", async () => {
    const { t, found, work } = world();
    readingAtWork(t);
    await app(t.ctx.deps, FOLDER);
    t.ctx.deps.alive = () => false;
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.state]), [["Pricing- what to charge- main 3fa9c1", "opened"]]);
    assert.ok(existsSync(join(work, "Pricing- what to charge- main 3fa9c1", "index.html")));
    assert.deepEqual([reread(found).rev, t.waits], [3, [CLAIM_WAIT_MS]]);
    t.done();
  });
  it("asks for the working copy when there is none, as it does without a reading, and says only that Claude is reading", async () => {
    const { t, found } = world({ copy: false });
    readingAtWork(t);
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [STILL]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER]]);
    assert.deepEqual([reread(found).app, runsOf(t)], [undefined, []]);
    t.done();
  });
  it("opens a project made before while `read` is at work: only a new project waits for the reading", async () => {
    const { t, found, work } = world();
    assert.equal((await app(t.ctx.deps, FOLDER)).code, 0);
    const made = readdirSync(work).sort();
    readingAtWork(t);
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [OPEN]]);
    assert.deepEqual(readdirSync(work).sort(), [...made, "episode.lock"].sort());
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.opened.length, p.state]), [["Pricing- what to charge- main 3fa9c1", 2, "opened"]]);
    assert.deepEqual(runsOf(t).map((run) => run.args[0]), ["open", "open"]);
    t.done();
  });
  it("makes the project as before when no reading is at work: a lock a dead run left, and another command at work, stop nothing", async () => {
    for (const [what, alive, command] of [["a reading that died", () => false, "read"], ["a bring", (pid) => pid === 4242, "bring"]]) {
      const { t, found, work } = world();
      readingAtWork(t, command);
      t.ctx.deps.alive = alive;
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [0, [OPEN]], what);
      assert.deepEqual(reread(found).app.projects.map((p) => p.state), ["opened"], what);
      assert.ok(existsSync(join(work, reread(found).app.projects[0].name, "index.html")), what);
      t.done();
    }
  });
});

describe("app: the project, and what is said and recorded of it", () => {
  it("asks for the working copy when there is none, says it is being made, and keeps the claim it made", async () => {
    const { t, found } = world({ copy: false });
    const r = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`The video for HyperFrames is being made. Say "open ${NAME} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER]]);
    // Claimed, as the plan orders it (the claim, then the copy), and no project is recorded or opened.
    assert.deepEqual([reread(found).rev, reread(found).editing.by, reread(found).app, runsOf(t)], [2, "Mac Studio", undefined, []]);
    t.done();
  });
  it("opens the project from the working copy the run it asked for made, and asks for none again: the copy's key is the one app looks for", async () => {
    const { t, found, work } = world({ copy: false });
    const asked = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([asked.code, asked.said.length], [0, 1]);
    const [, args] = t.started[0];
    // The run `app` started is run as it would run, with ffprobe and ffmpeg's stand-ins; it makes the copy where app looks for it.
    const made = await on(t.ctx.deps, ...args.slice(1));
    assert.equal(made.code, 0, made.text);
    const opened = await app(t.ctx.deps, FOLDER);
    assert.deepEqual([opened.code, opened.said], [0, [OPEN]]);
    assert.deepEqual(t.started.map(([, more]) => more.slice(1)), [["workcopy", "--now", FOLDER]]);
    const project = join(work, reread(found).app.projects[0].name);
    assert.equal(readFileSync(join(project, "media", "recording.mp4"), "utf8"), "a part of a Story");
    t.done();
  });
  it("keeps the project and says why when HyperFrames will not open, with no time it was opened in the record", async () => {
    for (const [open, words] of [["not-installed", "HyperFrames isn't installed on this Mac: ask Jason."], ["open-failed", "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]]) {
      const { t, found, work } = world({ open });
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [words]], open);
      const record = reread(found);
      assert.deepEqual(record.app.projects.map((p) => [p.state, p.opened]), [["made", []]], open);
      assert.ok(existsSync(join(work, record.app.projects[0].name, "index.html")), open);
      assert.equal(record.rev, 3, open);
      t.done();
    }
  });
  it("hands her chat to the app only when this Mac's setting is on and the chat holds no session's words", async () => {
    const asked = async (handover, chat) => {
      const { t, found } = world();
      if (handover) writeSettings(t.home, { appHandover: true });
      t.ctx.deps.app.chat = () => chat;
      const r = await app(t.ctx.deps, FOLDER);
      const run = runsOf(t)[0];
      const out = [r.code, r.said, run.env.includes("CLAUDE_CODE_SESSION_ID"), reread(found).app.projects[0].handover];
      t.done();
      return out;
    };
    assert.deepEqual(await asked(true, { sessionId: CHAT, held: false }), [0, ["It's open in HyperFrames, and it picks up this conversation."], true, true]);
    assert.deepEqual(await asked(true, { sessionId: CHAT, held: true }), [0, ["It's open in HyperFrames. It starts a new conversation.", "This chat has held a client or group session's words, so it stays here."], false, false]);
    assert.deepEqual(await asked(false, { sessionId: CHAT, held: false }), [0, [OPEN], false, false]);
  });
  it("hands her chat over for a session whose mark was cleared, which is an ordinary video of its new kind (a session not cleared is the gate's)", async () => {
    // A mark cleared by her click on a video answered as raw, as `kind … --clear-session` leaves the record, and on one that still says session.
    for (const [what, record] of [["cleared, answered as a raw video", { ...RAW, session: CLEARED_RECORD.session }], ["cleared, the record still saying session", CLEARED_RECORD]]) {
      const { t, found } = world({ record });
      writeSettings(t.home, { appHandover: true });
      t.ctx.deps.app.chat = () => ({ sessionId: CHAT, held: false });
      const r = await app(t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [0, ["It's open in HyperFrames, and it picks up this conversation."]], what);
      assert.equal(runsOf(t)[0].env.includes("CLAUDE_CODE_SESSION_ID"), true, what);
      assert.equal(reread(found).app.projects[0].handover, true, what);
      t.done();
    }
  });
});
