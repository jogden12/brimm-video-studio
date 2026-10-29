// `free "<episode>"`: taking an episode's working copy and renders away from Sallie's chat (plan PR 15; architecture 2026-10-27,
// sections 6.1, 6.2 and 7.4). edit.js is only the wiring here. It finds the episode through the gate, takes no flag, says the old
// spelling `free "<episode>" library` is held back, and gives the rest to free.js, which free.test.js tests on its own. These
// tests run all of it through editMain, on a project that `app` really made (project.js's writer, with the stand-in for the
// pinned command line), so that a path `free` names is the path the writer wrote; and they run `app` afterwards, which puts the
// video back (app.js). Nothing here touches the real home, Dropbox or Downloads, and no test runs HyperFrames, the app or ffmpeg.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { HELD } from "../gate.js";
import { recordFile, recordText } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { workCopyKey, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { FOLDER, NAME, episodeAs, listAll, reread } from "./episodes.js";
import { episode } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|workcopy/;
/** A command as Claude runs it, and a check that every line it said, whichever way it ended, is plain. */
async function plain(deps, ...words) {
  const r = await on(deps, ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}

const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
const RAW = { version: 3, kind: "raw", answer: ANSWERED };
const UNANSWERED_RECORD = { version: 3, kind: null, answer: ANSWER, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
const LEFT_RECORD = { ...UNANSWERED_RECORD, answer: { ...ANSWER, state: "not for brimm-video" } };
const SESSION_RECORD = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-20", session: SESSION_MARK };
const CLEARED_RECORD = { ...SESSION_RECORD, session: { ...SESSION_MARK, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } };
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT_ALONE = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const HERS = { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" };
const WORKING_COPY = "the working copy's bytes";
const OPEN = "It's open in HyperFrames.";
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
const NOTHING = `There is nothing to take away for ${NAME} on this Mac.`;
const HELD_BACK = "Deleting an episode's Final Cut library by command comes in a later version. To free space now, use Final Cut's File > Delete Generated Library Files.";

/** What the stand-in wrote down of each run of the pinned command line on this Mac. */
function runsOf(t) {
  const log = join(t.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}
/** A folder's whole contents as { path from it: text, or "dir", or "-> where a link leads" }. */
function treeOf(dir) {
  const out = {};
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isSymbolicLink()) out[relative(dir, path)] = `-> ${readlinkSync(path)}`;
      else if (entry.isDirectory()) {
        out[relative(dir, path)] = "dir";
        walk(path);
      } else out[relative(dir, path)] = readFileSync(path, "utf8");
    }
  };
  walk(dir);
  return out;
}

/** The made-up recording (phase4.js), answered as `record` says, with this Mac set up for the app (`set`) and the working copy of its
    video made already, and the pinned command line the stand-in: as edit-app.test.js has it. */
function world({ set = true, record = RAW } = {}) {
  const { t, found } = episode(record);
  if (set) writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, WORKING_COPY);
  writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: WORKING_COPY.length }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  const downloads = join(t.home, "Downloads");
  return { t, found, raw, rawFile: join(found.folder, "Pricing talk.mp4"), paths, work: episodeWork(t.home, FOLDER), downloads, exported: join(downloads, "Pricing- what to charge- main 3fa9c1_2026-10-20_16-00.mp4") };
}

/** The made-up episode with its project really made by `app` and then worked in as the app and its agent do: a composition, the app's
    history, renders (with the note an export leaves), and an export in a stand-in Downloads and one in the episode's final/. */
async function worked(options) {
  const w = world(options);
  assert.equal((await on(w.t.ctx.deps, "app", FOLDER)).code, 0);
  const [project] = reread(w.found).app.projects;
  const at = join(w.work, project.name);
  for (const [file, text] of Object.entries({ "compositions/title.html": "<div>Three pricing mistakes</div>", ".hyperframes/app-history.jsonl": "{}\n", ".hyperframes/transcripts/t.json": "{}", "renders/draft.mp4": "a draft render", "renders/draft_2026-10-20_16-00.meta.json": "{}", "renders/frames/0001.png": "a frame" })) {
    mkdirSync(dirname(join(at, file)), { recursive: true });
    writeFileSync(join(at, file), text);
  }
  mkdirSync(w.downloads, { recursive: true });
  writeFileSync(w.exported, "an export in Downloads");
  mkdirSync(join(w.found.folder, "final"), { recursive: true });
  writeFileSync(join(w.found.folder, "final", "Pricing talk main.mp4"), "an export in final");
  w.t.started.length = 0;
  return { ...w, project, at };
}

describe("free: the command", () => {
  it("is one of edit.js's commands and its usage is in the help; with no episode it says the help and ends with 2, taking nothing", async () => {
    assert.ok(COMMAND_NAMES.includes("free"));
    const lines = HELP.split("\n");
    const at = lines.findIndex((line) => line.startsWith('  node edit.js free "<episode>"'));
    assert.ok(at >= 0, "the help has the usage line of free");
    assert.match(lines[at], /^ {2}node edit\.js free "<episode>" {9}take away/);
    const w = await worked();
    const before = treeOf(w.work);
    const r = await on(w.t.ctx.deps, "free");
    assert.deepEqual([r.code, r.said, treeOf(w.work)], [2, [HELP], before]);
    w.t.done();
  });
  it("takes no flag: one nobody built is not taken for a dry run, and nothing is taken", async () => {
    const w = await worked();
    const before = [treeOf(w.work), reread(w.found).rev];
    for (const flag of ["--dry-run", "--yes", "--now", "--library"]) {
      const r = await on(w.t.ctx.deps, "free", FOLDER, flag);
      assert.deepEqual([r.code, r.said], [2, [HELP]], flag);
    }
    assert.deepEqual([treeOf(w.work), reread(w.found).rev], before);
    w.t.done();
  });
  it("says the old spelling, a Final Cut library, is held back, with or without --yes, and takes nothing: it is not gated, and names no episode in what it says", async () => {
    const w = await worked();
    const before = treeOf(w.work);
    for (const more of [[], ["--yes"]]) {
      const r = await on(w.t.ctx.deps, "free", FOLDER, "library", ...more);
      assert.deepEqual([r.code, r.said], [1, [HELD_BACK]], more.join(" "));
    }
    assert.deepEqual(treeOf(w.work), before);
    const unanswered = world({ record: UNANSWERED_RECORD });
    assert.deepEqual((await on(unanswered.t.ctx.deps, "free", FOLDER, "library")).said, [HELD_BACK]);
    w.t.done();
    unanswered.t.done();
  });
});

describe("free: the gate asks first, in its own words", () => {
  it("refuses a video not yet answered, a video left alone and a session not cleared, whether or not this Mac is set up, and takes nothing", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [LEFT_RECORD, LEFT_ALONE], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      for (const set of [true, false]) {
        const { t, found, work } = world({ record, set });
        const before = [listAll(found.folder), treeOf(work)];
        const r = await plain(t.ctx.deps, "free", FOLDER);
        assert.deepEqual([r.code, r.said], [1, [why]], `${record.label} ${set}`);
        assert.deepEqual([reread(found).rev, listAll(found.folder), treeOf(work), t.started, t.calls], [1, ...before, [], []], `${record.label} ${set}`);
        for (const given of [FOLDER, "Pricing", "talk", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
        t.done();
      }
    }
  });
  it("refuses a session whether this Mac's training gate is on or off: free is in no list", async () => {
    const { t } = world({ record: SESSION_RECORD });
    const taught = { ...t.ctx.deps, settings: { ...t.ctx.settings, app: "hyperframes", sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    assert.deepEqual((await on(taught, "free", FOLDER)).said, [NOT_FOR_SESSION]);
    t.done();
  });
  it("refuses a video held beside a session, as every command outside the first list is", async () => {
    const OLD = "e-20261010-a0a0a0";
    const { t, found } = world({ record: { ...RAW, versionOf: OLD } });
    episodeAs(t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
    const r = await on(t.ctx.deps, "free", FOLDER);
    assert.deepEqual([r.code, r.said, reread(found).rev], [1, [HELD], 1]);
    t.done();
  });
  it("runs for an answered raw video, an iPhone clip, a finished video and a session whose mark was cleared", async () => {
    for (const [what, record] of [["a raw video", RAW], ["an iPhone clip", { ...RAW, kind: "short video" }], ["a finished video", { ...RAW, kind: "finished" }], ["a session whose mark was cleared", CLEARED_RECORD]]) {
      const { t, paths } = world({ record });
      const bytes = WORKING_COPY.length + readFileSync(paths.facts).length;
      const r = await plain(t.ctx.deps, "free", FOLDER);
      assert.deepEqual([r.code, r.said], [0, [`Took away the video made for HyperFrames for ${NAME}. That gave back ${bytes} bytes on this Mac.`]], what);
      assert.equal(existsSync(paths.dir), false, what);
      t.done();
    }
  });
  it("is refused for a record of a newer layout, in the words every command has for one, with 1", async () => {
    const { t, found } = world();
    writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: 5, id: found.record.id, rev: 2, kind: "podcast" }));
    const r = await on(t.ctx.deps, "free", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`That is an episode a newer brimm-video wrote (${found.record.id.slice(-6)}). Jason has a newer brimm-video. Ask him to update this Mac.`]]);
    t.done();
  });
});

describe("free: an episode HyperFrames was opened on", () => {
  it("takes the video and the renders of the project app made, and the folder of copies, and nothing else; says so in her words", async () => {
    const w = await worked();
    const before = treeOf(w.work);
    const around = [treeOf(w.downloads), listAll(w.found.folder), reread(w.found)];
    const r = await plain(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said[0].startsWith(`Took away the video made for HyperFrames and what HyperFrames rendered for ${NAME}. That gave back `) && r.said[0].endsWith(" on this Mac."), r.said[0]);
    assert.deepEqual(r.said.slice(1), ["Its HyperFrames project, and everything done in it, stays.", `Say "open ${NAME} in HyperFrames" when you want it again: the video is made again then.`]);
    const after = treeOf(w.work);
    const gone = Object.keys(before).filter((rel) => !(rel in after)).sort();
    assert.deepEqual(gone, [
      `${w.project.name}/media/recording.mp4`, `${w.project.name}/renders`, `${w.project.name}/renders/draft.mp4`, `${w.project.name}/renders/draft_2026-10-20_16-00.meta.json`,
      `${w.project.name}/renders/frames`, `${w.project.name}/renders/frames/0001.png`, ...Object.keys(before).filter((rel) => rel.startsWith("working copy"))
    ].sort());
    for (const [rel, text] of Object.entries(after)) assert.equal(before[rel], text, rel);
    // Every file the writer made for the project but its video is still there: the whole file list, but for that one.
    assert.ok(Object.keys(after).filter((rel) => rel.startsWith(`${w.project.name}/`)).length >= 15);
    for (const stays of ["index.html", "meta.json", "transcript.json", "CLAUDE.md", "AGENTS.md", "brimm/facts.json", "brimm/cut-suggestions.json", ".claude/settings.json", "vendor/gsap.min.js", "compositions/title.html", ".hyperframes/app-history.jsonl", ".hyperframes/transcripts/t.json", "node_modules/.bin/hyperframes"]) assert.ok(`${w.project.name}/${stays}` in after, stays);
    // The exports, the episode in Dropbox and its record stay as they were.
    assert.deepEqual([treeOf(w.downloads), listAll(w.found.folder), reread(w.found)], around);
    assert.equal(readFileSync(w.exported, "utf8"), "an export in Downloads");
    w.t.done();
  });
  it("writes no record, takes no claim and starts nothing, and a second time it says there is nothing to take away", async () => {
    const w = await worked();
    const record = reread(w.found);
    const r = await on(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(w.found).rev, reread(w.found).editing, reread(w.found).app, w.t.started], [record.rev, record.editing, record.app, []]);
    const again = await plain(w.t.ctx.deps, "free", FOLDER);
    assert.deepEqual([again.code, again.said], [0, [NOTHING]]);
    w.t.done();
  });
  it("needs no setting: a Mac whose app was turned off after the project was made still frees it", async () => {
    const w = await worked();
    writeSettings(w.t.home, { app: "off" });
    const r = await on(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(existsSync(join(w.at, "media", "recording.mp4")), false);
    w.t.done();
  });
  it("refuses while HyperFrames is running, and takes nothing", async () => {
    const w = await worked();
    const before = treeOf(w.work);
    const asked = [];
    const r = await plain({ ...w.t.ctx.deps, running: async (name) => (asked.push(name), name === "HyperFrames") }, "free", FOLDER);
    assert.deepEqual([r.code, r.said, asked, treeOf(w.work)], [1, ["Quit HyperFrames first, then ask again. Nothing was taken away."], ["HyperFrames"], before]);
    w.t.done();
  });
  it("refuses while the other Mac has the episode, in the words of the commands that change one, and takes nothing", async () => {
    const w = await worked();
    const record = reread(w.found);
    writeFileSync(recordFile(w.found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, editing: HERS }));
    const before = treeOf(w.work);
    const r = await plain(w.t.ctx.deps, "free", FOLDER);
    assert.deepEqual([r.code, r.said, treeOf(w.work)], [1, [`Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`], before]);
    w.t.done();
  });
  it("refuses while the working copy is being made, and while any other run is at work, and takes nothing", async () => {
    for (const [lock, command, words] of [
      [workCopyLockOf, "workcopy", `The video for HyperFrames is being made for ${NAME}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`],
      [lockOf, "finish", `Something is still at work on ${NAME}. Say "how far is it?", and ask again when it is done. Nothing was taken away.`]
    ]) {
      const w = await worked();
      assert.equal(takeEpisodeLock(lock(w.t.home, FOLDER), command, () => true).taken, true);
      const before = treeOf(w.work);
      const r = await plain({ ...w.t.ctx.deps, alive: (pid) => pid === process.pid }, "free", FOLDER);
      assert.deepEqual([r.code, r.said, treeOf(w.work)], [1, [words], before], command);
      w.t.done();
    }
  });
  it("says there is nothing to take away for a finished video that has no project, and for one that was never opened in HyperFrames", async () => {
    const finished = world({ record: { ...RAW, kind: "finished" } });
    rmSync(finished.paths.dir, { recursive: true });
    const r = await plain(finished.t.ctx.deps, "free", FOLDER);
    assert.deepEqual([r.code, r.said], [0, [NOTHING]]);
    finished.t.done();
    const never = world();
    rmSync(never.paths.dir, { recursive: true });
    assert.deepEqual((await on(never.t.ctx.deps, "free", FOLDER)).said, [NOTHING]);
    never.t.done();
  });
  it("does not take a project made for an earlier kind out of the record: it is freed like the other, and its text files stay", async () => {
    const w = await worked();
    assert.equal((await on(w.t.ctx.deps, "kind", NAME, "clip", "--private", "no", "--again")).code, 0);
    const kept = reread(w.found).app.projects[0];
    assert.equal(kept.state, "kept for an earlier kind");
    const r = await plain(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(existsSync(join(w.work, kept.name, "media", "recording.mp4")), false);
    assert.equal(existsSync(join(w.work, kept.name, "index.html")), true);
    assert.deepEqual(reread(w.found).app.projects, [kept]);
    w.t.done();
  });
});

describe("free, then app: the video is made again, and the same project is opened", () => {
  /** The `workcopy` run that `app` asked for, run as it would run: the command it was started as, in a world of stand-ins. */
  async function madeAgain(t, since) {
    const asked = t.started.slice(since).map(([, args]) => args.slice(1)).filter((args) => args[0] === "workcopy");
    assert.deepEqual(asked, [["workcopy", "--now", FOLDER]]);
    const made = await on(t.ctx.deps, ...asked[0]);
    assert.equal(made.code, 0, made.text);
  }
  it("asks for the working copy once and says it is being made, opens nothing and writes no record; then puts the video back, opens the same project and makes no second", async () => {
    const w = await worked();
    const first = reread(w.found).app.projects[0];
    const tree = treeOf(join(w.work, w.project.name));
    assert.equal((await on(w.t.ctx.deps, "free", FOLDER)).code, 0);
    const freed = reread(w.found);
    const runs = runsOf(w.t).length;

    const asked = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([asked.code, asked.said], [0, [`The video for HyperFrames is being made. Say "open ${NAME} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`]]);
    assert.deepEqual([reread(w.found).app, w.t.started.map(([, args]) => args.slice(1))], [freed.app, [["workcopy", "--now", FOLDER]]]);
    assert.equal(runsOf(w.t).length, runs, "the app was not asked to open a project with no video");
    assert.equal(existsSync(join(w.at, "media", "recording.mp4")), false);

    await madeAgain(w.t, 0);

    const back = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([back.code, back.said], [0, [`The video HyperFrames was given for ${NAME} had been taken away; it is back in the project.`, OPEN, BUTTONS]]);
    assert.equal(readFileSync(join(w.at, "media", "recording.mp4"), "utf8"), "a part of a Story");
    const copies = readdirSync(w.paths.dir);
    assert.deepEqual(copies, [`${w.raw.size}-${Math.floor(w.raw.mtimeMs)}.json`], "the copy was moved into the project, and its facts stay beside it");
    // The same project: one entry, one more time opened, the new copy's size; every other file of the project as it was.
    const [after, ...others] = reread(w.found).app.projects;
    assert.deepEqual(others, []);
    assert.deepEqual([after.name, after.key, after.state, after.opened.length, after.workingCopy.bytes], [first.name, first.key, "opened", first.opened.length + 1, "a part of a Story".length]);
    const now = treeOf(join(w.work, w.project.name));
    for (const [rel, text] of Object.entries(tree)) if (!rel.startsWith("renders") && rel !== "media/recording.mp4") assert.equal(now[rel], text, rel);
    assert.deepEqual(runsOf(w.t).slice(runs).map((run) => run.args), [["open", join(w.work, first.name), "--json"]]);
    assert.deepEqual(readdirSync(w.work).filter((name) => name.startsWith("Pricing")), [first.name], "no second project was made");

    // Said again, it opens as before and moves nothing.
    const again = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    assert.equal(readFileSync(join(w.at, "media", "recording.mp4"), "utf8"), "a part of a Story");
    w.t.done();
  });
  it("says the project cannot be opened when the recording has changed since it was made, asks for no copy and opens nothing", async () => {
    const w = await worked();
    await on(w.t.ctx.deps, "free", FOLDER);
    const later = new Date("2026-10-28T08:00:00-04:00");
    utimesSync(w.rawFile, later, later);
    const runs = runsOf(w.t).length;
    const rev = reread(w.found).rev;
    const r = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The recording of ${NAME} has changed since its HyperFrames project was made, and the video that project was made from has been taken away, so it can't be opened. Ask Jason.`]]);
    assert.deepEqual([w.t.started, runsOf(w.t).length, reread(w.found).rev, existsSync(join(w.at, "media", "recording.mp4"))], [[], runs, rev, false]);
    w.t.done();
  });
  it("does not put back a copy that is not the project's size, and leaves it where it is", async () => {
    const w = await worked();
    await on(w.t.ctx.deps, "free", FOLDER);
    await on(w.t.ctx.deps, "app", FOLDER);
    await madeAgain(w.t, 0);
    const facts = JSON.parse(readFileSync(w.paths.facts, "utf8"));
    writeFileSync(w.paths.facts, JSON.stringify({ ...facts, width: 640, height: 360 }));
    const runs = runsOf(w.t).length;
    const r = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The video made again for ${NAME} isn't the size or length of the one its HyperFrames project was made with, so it wasn't put back. Ask Jason.`]]);
    assert.deepEqual([existsSync(w.paths.video), existsSync(join(w.at, "media", "recording.mp4")), runsOf(w.t).length], [true, false, runs]);
    w.t.done();
  });
  it("opens a project whose video is there as it was, and says the recording changed only then", async () => {
    const w = await worked();
    const later = new Date("2026-10-28T08:00:00-04:00");
    utimesSync(w.rawFile, later, later);
    const r = await plain(w.t.ctx.deps, "app", FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`The recording of ${NAME} has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.`, OPEN, BUTTONS]]);
    w.t.done();
  });
});
