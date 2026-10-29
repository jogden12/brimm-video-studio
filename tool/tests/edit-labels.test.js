// Labels, not file names, in everything Sallie's chat sees (spec 2026-10-22, section 1, "Unanswered and session videos are
// named by a neutral label"). Everything edit.js prints goes into her chat, which is Claude, and a video's file is often named
// for a client ("Coaching call Jane Doe.mov"), as are its episode's folder and its folder in BRIMM Video Work. So a video not yet
// answered, and a client or group session whose mark is not cleared, are named by their label in every line a command says, in
// the log, in a status file and in a result file. Today's records, on a Mac whose import is not the light one, print as they
// always did: the first test here pins that, line for line.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and the programs are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { COMMAND_NAMES, contextFor, editMain, findEpisode } from "../edit.js";
import { newEpisode, readEpisode, recordFile, recordText, shownName } from "../episode.js";
import { episodeWork, fromFinalCutFolder, workFolder, writeSettings } from "../settings.js";
import { readStatuses, writeStatus } from "../importing.js";
import { readResult, resultFile, runDetached } from "../detached.js";
import { sessionLabel, withoutNames } from "../kinds.js";
import { fileSafe } from "../names.js";
import { cardOf as cardFor } from "../receipts.js";
import { uneditedFolder, uneditedFolders } from "../unedited.js";
import { noProgress } from "../progress.js";
import { probed, TOLD, SRT, PAUSES } from "./fixtures.js";
import { setup, episodeFor, FOLDER, NAME } from "./episodes.js";
import { episode } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, said }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

/** Write a text file whole, as the rule's text writer would. */
const writeText = (to, text) => writeFileSync(to, text);

/** The clock of episodes.js's setup, as the record keeps a moment. */
const AT = "2026-10-20T15:00:00-05:00";

/** The deps every command here is run with: the made-up Mac's (episodes.js), with stand-ins for what is left of the Mac's own:
    the free space on its disk, the launch agent, git, and whether Final Cut is running. */
const depsOf = (t) => ({
  ...t.ctx.deps,
  statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 }),
  kickstart: () => {},
  agentRunning: () => false,
  running: async () => false,
  run: async (cmd, args, asked) => (cmd === "/usr/bin/git" ? { code: 0, stdout: "0\n", stderr: "" } : t.ctx.deps.run(cmd, args, asked))
});

// --- Today's records, on a Mac whose import is not the light one ---

/** The second episode of today: a short video, named, with nothing pushed. */
const SHORT_FOLDER = "2026-10-15 Pricing short (Mac Studio)";

/** Today's Mac, with its import set to `setting` ("full", or undefined for none): the made-up episode (phase4.js), a short video
    beside it, a video waiting in the drop folder whose import failed, the other Mac's import running, a late check that found a
    problem, what a bring left for the episode, and its library on this Mac. */
function today(setting) {
  const { t } = episode();
  if (setting) writeSettings(t.home, { import: setting });
  const short = join(t.root, "Episodes", SHORT_FOLDER);
  mkdirSync(join(short, "record"), { recursive: true });
  const record = newEpisode({ id: "e-20261015-0a1b2c", machine: "Mac Studio", at: "2026-10-15T09:00:00-05:00", video: { file: "Pricing short.mov", bytes: 5, seconds: 40, created: null }, kind: "short video", writer: { commit: "c709b57", on: "Mac Studio" } });
  writeFileSync(recordFile(short, 1), recordText({ ...record, rev: 1, name: { text: "Pricing in a minute", placeholder: false } }));
  const drop = join(t.root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  writeFileSync(join(drop, "Pricing talk again.mov"), "video");
  writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9x", video: "Pricing talk again.mov", bytes: 5, seconds: null, step: "Writing the transcript", at: "2026-10-20T14:00:00-05:00", failed: "the transcriber stopped (Pricing talk again.mov: Invalid data)" }, writeText);
  writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 2, import: "a1b2", video: "Other talk.mov", bytes: 9, seconds: 60, step: "Writing the transcript", at: "2026-10-20T14:58:00-05:00" }, writeText);
  writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 3, import: "c3d4", video: "Third talk.mov", bytes: 9, seconds: 60, step: "Late check", at: "2026-10-20T13:00:00-05:00", problem: "Third talk.srt is not whole in Dropbox." }, writeText);
  const work = episodeWork(t.home, FOLDER);
  mkdirSync(join(work, `${FOLDER}.fcpbundle`), { recursive: true });
  writeFileSync(join(work, `${FOLDER}.fcpbundle`, "CurrentVersion.flexolibrary"), "a library");
  const ended = Date.parse(AT) - 2 * 60 * 60 * 1000;
  writeFileSync(resultFile(t.home, FOLDER, "bring"), JSON.stringify({ version: 1, command: "bring", started: ended - 60000, ended, ok: false, made: ["Pricing talk.srt"], failed: ["Pricing talk.mp4 is still not whole"], next: `Some files of ${NAME} are not here yet. Say "open ${NAME}" to try again.` }));
  return t;
}

/** What each command is given on today's Mac, as Claude runs it: by the episode's folder, by its name, with no words, and for the
    commands that name a video or more than one episode, by those. Every command is here, so that one added later is pinned. */
const TODAY_ASKED = {
  episodes: [[]],
  // Commands of the switch, new with it: there is no output of today's to pin, and tests/edit-kind.test.js pins their words. `read`
  // is a detached run's alone, which `kind` starts: tests/reading.test.js pins it, and that without --now it is an unknown use.
  kind: [],
  leave: [],
  which: [],
  read: [],
  // `workcopy` is a detached run's alone too, which `kind` and `app` start: tests/edit-workcopy.test.js pins it.
  workcopy: [],
  open: [[FOLDER], [NAME], [], ["Pricing"], ["nothing fits this"]],
  push: [[FOLDER], [], [FOLDER, "reel", "2"]],
  bring: [["--now", FOLDER], []],
  status: [[], [FOLDER], ["Pricing"], [NAME]],
  retry: [["Pricing talk again.mov"], ["pricing talk again"], ["Nothing here"], []],
  name: [[FOLDER, "A new name"], [FOLDER], []],
  title: [[FOLDER], [FOLDER, "--words", "Price like you mean it", "--approve"], []],
  reel: [["drop", FOLDER, "1"], []],
  reels: [[FOLDER, "--no-play"], []],
  ask: [[FOLDER], ["--now", FOLDER], []],
  finish: [[FOLDER], ["--now", FOLDER], []],
  release: [[FOLDER], []],
  show: [[FOLDER, "transcript"], [FOLDER, "plan"], []],
  behind: [[]],
  resolve: [[FOLDER], []],
  free: [[FOLDER, "library"], []],
  spell: [[FOLDER], []],
  logo: [[FOLDER, "on"], []],
  captions: [[FOLDER, "reel", "2", "on"], []],
  text: [[FOLDER], []],
  graphic: [[FOLDER], []],
  preset: [[FOLDER], []],
  cut: [[FOLDER, "remove", "--words", "x"], []],
  // A session's commands, new with the switch: tests/edit-session-mark.test.js pins their words.
  teachings: [],
  principles: [],
  ideas: [],
  // The guide, new since the switch: tests/edit-guide.test.js pins its words.
  guide: [],
  // The app, new with Studio: tests/edit-app.test.js pins its words, and tests/edit-app-history.test.js those of `app … what-happened`
  // and `app … versions`. The walk below runs both for a video waiting for its answer and for a session.
  app: []
};

/** What every command of TODAY_ASKED says on today's Mac with its import set to `setting`, each on a Mac of its own, by
    "<command> <words…>", with the test's folder written as <dir> so that it reads the same in every run. */
async function todaySays(setting) {
  const says = {};
  for (const name of COMMAND_NAMES) {
    for (const words of TODAY_ASKED[name]) {
      const t = today(setting);
      const r = await on(depsOf(t), name, ...words);
      const pid = new RegExp(String.raw`(?<!\d)${process.pid}(?!\d)`, "g");
      says[[name, ...words].join(" ")] = [r.code, ...r.said.map((line) => line.split(t.dir).join("<dir>").replace(pid, "<pid>"))];
      t.done();
    }
  }
  return says;
}

/** What today's Mac said, before labels: written once from the code as it was, and read back here. */
const TODAY_FILE = new URL("./fixtures/today-says.json", import.meta.url);

describe("today's records, on a Mac whose import is not the light one", () => {
  it("has the words of every command here, so that one added later is pinned too", () => {
    for (const name of COMMAND_NAMES) assert.ok(name in TODAY_ASKED, `${name}: give it its words in TODAY_ASKED`);
  });
  it("prints every command's lines as it did before labels, with no import setting and with the full import", async () => {
    // UPDATE_TODAY=1 writes the file again from the code as it is now: only for a change to today's output that is meant.
    if (process.env.UPDATE_TODAY === "1") writeFileSync(TODAY_FILE, JSON.stringify(await todaySays(undefined), null, 2) + "\n");
    const before = JSON.parse(readFileSync(TODAY_FILE, "utf8"));
    for (const setting of [undefined, "full"]) assert.deepEqual(await todaySays(setting), before, String(setting));
  });
});

// --- A video imported lightly from a file named for a client ---

/** The file a client's coaching call was saved as, and what the light import makes of it. */
const VIDEO = "Coaching call Jane Doe.mov";
const STEM = "Coaching call Jane Doe";
const LIGHT_FOLDER = `2026-10-20 ${STEM} (Mac Studio)`;
const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
/** A second video of the same client, waiting in the drop folder, whose import failed: its status carries its label. */
const SECOND = "Coaching call Jane Doe part 2.mov";
const SECOND_LABEL = "Video of 20 Oct, 14:00 (Mac Studio)";
/** The session's label, as F3 names a session in the same write as its mark. */
const SESSION = sessionLabel("2026-10-20");
/** What must never be in a line the chat, the log, a status file or a result file sees of such a video. */
const SECRET = /jane|coaching/i;

const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "yes" };
/** What a record of a client or group session holds over the video's own, as F3 writes it: the kind, the mark not cleared, and
    the session's label for its name. */
const SESSION_OVER = { kind: "session", answer: ANSWERED, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null }, name: { text: SESSION, placeholder: false } };
/** A video answered as another kind whose session mark is not cleared, as when a session is answered again as finished: gated
    as a session is, and named by its label, but not a session to finish.js cannotFinish, so finish runs for it. */
const MARKED_OVER = { ...SESSION_OVER, kind: "finished" };
/** This Mac's settings with the training gate on, as Jason's check of both accounts leaves it. */
const TEACHINGS = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } };

/** Import `video` lightly from the Mac Studio's drop folder in t's root, as the launch agent does when this Mac's settings say
    import light: ffprobe, ffmpeg and the transcriber are stand-ins that read the made-up recording of fixtures.js, two minutes
    long, Claude is not on the Mac, and the clock moves only when the run waits, so its late check is made in the same run.
    `script.fail` makes a step fail as a real program would, naming the file: "probe", "sound" or "whisper"; `script.before`
    is called with each program and its arguments before the stand-in answers; and `script.deps` are laid over the deps. Gives
    back what the import logged and noticed, and its deps. */
async function importLightly(t, video = VIDEO, script = {}) {
  const drop = join(t.root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  writeFileSync(join(drop, video), "video");
  const logs = [];
  const notes = [];
  const at = Date.parse("2026-10-20T15:00:00");
  let clock = at;
  const named = `${join(drop, video)}: Invalid data found when processing input\n`;
  const run = async (cmd, args) => {
    if (script.before) script.before(cmd, args);
    if (cmd === "FFPROBE") {
      if (script.fail === "probe") return { code: 1, stderr: named };
      writeFileSync(args[args.indexOf("-o") + 1], probed({ duration: "120.000000" }));
      return { code: 0, stderr: "" };
    }
    if (cmd === "FFMPEG") {
      const filter = args.includes("-af") ? args[args.indexOf("-af") + 1] : "";
      if (filter.includes("silencedetect=noise=-45dB")) return { code: 0, stderr: "" };
      if (filter.includes("silencedetect=noise=-35dB")) return { code: 0, stderr: PAUSES };
      if (script.fail === "sound") return { code: 1, stderr: named };
      writeFileSync(args[args.length - 1], "RIFF");
      return { code: 0, stderr: "" };
    }
    if (script.fail === "whisper") return { code: 3, stderr: `error: failed to read ${join(drop, video)}\n` };
    const base = args[args.indexOf("-of") + 1];
    writeFileSync(`${base}.srt`, SRT);
    if (args.includes("-ojf")) writeFileSync(`${base}.json`, JSON.stringify(TOLD));
    return { code: 0, stderr: "" };
  };
  for (const d of ["tmp", "locks"]) mkdirSync(join(t.dir, d), { recursive: true });
  const deps = {
    run, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "", claude: "" }, model: "/models/model.bin",
    tmpDir: join(t.dir, "tmp"), lockDir: join(t.dir, "locks"), home: t.home, today: () => "2026-10-20", rand: () => 0.5, rulesOnly: true,
    settings: { version: 1, machine: "Mac Studio", root: t.root, checkout: "/checkout", import: "light" }, light: true,
    now: () => new Date(at), clock: () => clock, wait: async (ms) => { clock += ms; }, notify: (text) => notes.push(text), log: (line) => logs.push(line),
    clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, commit: "abc1234", keepAwake: () => {}, progress: noProgress,
    isWhole: () => true, alive: () => false, ...(script.deps || {})
  };
  await uneditedFolder(drop, deps);
  return { logs, notes, deps, drop };
}

/** The episode a light import made of `video`, in t's root. */
const lightFolder = (t, video = VIDEO) => join(t.root, "Episodes", `2026-10-20 ${video.replace(/\.[^.]*$/, "")} (Mac Studio)`);

/** Write the next record of the episode in `folder`: the one there with `over` laid on it. */
function rewrite(folder, over) {
  const { record } = readEpisode(folder, { pastCopies: true });
  writeFileSync(recordFile(folder, record.rev + 1), recordText({ ...record, ...over, rev: record.rev + 1 }));
  return readEpisode(folder, { pastCopies: true }).record;
}

/** A light import's status of `video` that failed, as the Part L code wrote one: its label, and why, with the file's path in it. */
function failedStatus(t, video = SECOND, label = SECOND_LABEL) {
  const drop = join(t.root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  if (!existsSync(join(drop, video))) writeFileSync(join(drop, video), "video");
  writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9x", video, bytes: statSync(join(drop, video)).size, seconds: null, step: "Reading the sound", at: "2026-10-20T14:00:00-05:00", label, failed: `the sound could not be read from the file (${join(drop, video)}: Invalid data found when processing input)` }, writeText);
}

/** A result a run left for the episode in `folder` before it was answered, as bring writes one, naming the files it brought by
    the video's own name. */
function oldResult(t, folder = LIGHT_FOLDER, command = "bring") {
  const ended = Date.parse(AT) - 2 * 60 * 60 * 1000;
  mkdirSync(episodeWork(t.home, folder), { recursive: true });
  writeFileSync(resultFile(t.home, folder, command), JSON.stringify({ version: 1, command, started: ended - 60000, ended, ok: false, made: [`${STEM}.transcript.txt`], failed: [`${STEM}.words.json could not be read (EIO)`], next: `Every file of ${STEM} is here. Say "open ${STEM}".` }));
}

/** This Mac's library of the episode in `folder`, as a push makes it in BRIMM Video Work. */
function library(t, folder = LIGHT_FOLDER) {
  const bundle = join(episodeWork(t.home, folder), `${folder}.fcpbundle`);
  mkdirSync(bundle, { recursive: true });
  writeFileSync(join(bundle, "CurrentVersion.flexolibrary"), "a library");
}

/** This Mac doing the light import, with the made-up episode of phase4.js answered as a finished video beside a video imported
    lightly from VIDEO, and around it: a second video of the client's waiting in the drop folder whose import failed, a result a
    bring left before, and a library on this Mac. Gives back t, what the import logged and noticed, and the new episode's id. */
async function lightMac() {
  const { t } = episode({ version: 3, kind: "finished", answer: ANSWERED });
  writeSettings(t.home, { import: "light" });
  const imported = await importLightly(t);
  failedStatus(t);
  oldResult(t);
  library(t);
  return { t, ...imported, id: readEpisode(lightFolder(t)).record.id };
}

/** Every result file in this Mac's BRIMM Video Work, by its path, with what it holds. */
function resultsIn(home) {
  const found = new Map();
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const n of names) {
      if (n.isDirectory()) walk(join(dir, n.name));
      else if (n.name.endsWith(".result.json")) found.set(join(dir, n.name), readFileSync(join(dir, n.name), "utf8"));
    }
  };
  walk(workFolder(home));
  return found;
}

describe("shownName", () => {
  const base = newEpisode({ id: "e-20261020-a1b2c3", machine: "Mac Studio", at: "2026-10-20T15:00:00-05:00", video: { file: VIDEO, bytes: 5, seconds: 120, created: null }, kind: null, writer: { commit: "c", on: "Mac Studio" }, answer: ANSWER, label: LABEL });
  it("is the label of a video not yet answered, or left alone, and never its file's name", () => {
    assert.equal(shownName(base), LABEL);
    assert.equal(shownName({ ...base, answer: { ...ANSWER, state: "not for brimm-video" } }), LABEL);
  });
  it("names a video not yet answered that has no label by its short id alone", () => {
    for (const label of [undefined, ""]) assert.equal(shownName({ ...base, label }), "a video not yet answered (a1b2c3)");
  });
  it("is the name of a session, which F3 sets to the session's label in the same write as its mark", () => {
    assert.equal(shownName({ ...base, ...SESSION_OVER }), SESSION);
  });
  it("is the name of an answered video, and of a record from before the switch, as today", () => {
    assert.equal(shownName({ ...base, kind: "finished", answer: ANSWERED }), STEM);
    assert.equal(shownName({ ...base, kind: "episode", name: { text: "Pricing talk", placeholder: false } }), "Pricing talk");
  });
  it("keeps the label's own moment, and is never made again from when the record says it was imported", () => {
    assert.equal(shownName({ ...base, imported: { on: "Mac Studio", at: "2026-10-21T09:30:00-05:00" } }), LABEL);
  });
});

/** An episode of a client's video in t's root, as a light import files one (with its transcript beside it), with `over` laid on
    its first record: by default not yet answered. */
function clientEpisode(t, { folder = LIGHT_FOLDER, video = VIDEO, id = "e-20261020-a1b2c3", label = LABEL, over = {} } = {}) {
  const at = join(t.root, "Episodes", folder);
  mkdirSync(join(at, "record"), { recursive: true });
  const stem = video.replace(/\.[^.]*$/, "");
  const files = { [video]: "video", [`${stem}.transcript.txt`]: "[0:00] Hello." };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(at, name), text);
  const sizes = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, Buffer.byteLength(text)]));
  const first = newEpisode({ id, machine: "Mac Studio", at: "2026-10-20T15:00:00-05:00", video: { file: video, bytes: 5, seconds: 120, created: null }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" }, files: sizes, answer: ANSWER, label });
  writeFileSync(recordFile(at, 1), recordText({ ...first, rev: 1, ...over }));
  return { folder: at, name: folder, record: readEpisode(at, { pastCopies: true }).record };
}

/** A ctx of this Mac (episodes.js), with its import set to `setting`, for findEpisode with no command: as in a helper. */
const ctxOf = (t, setting = "light") => contextFor({ ...t.ctx.deps, settings: { ...t.ctx.settings, ...(setting ? { import: setting } : {}) } });

/** What `say` says of `lines` once a command the gate keeps open (`command`) has found the episode named `said`, with ctx.asked set
    as editMain sets it: the lines through the filter of the names of the video found (findEpisode, hideNames). The settings are
    this Mac's, with the import light and the training gate on. */
function saidAfterFinding(t, said, lines, command = "release") {
  const out = [];
  const settings = { ...t.ctx.settings, import: "light", sessionTeachings: TEACHINGS };
  const ctx = { ...contextFor({ ...t.ctx.deps, say: (line) => out.push(line), settings }), asked: { command, words: [said] } };
  const found = findEpisode(ctx, said);
  assert.ok(found.folder, found.why);
  for (const line of lines) ctx.say(line);
  return out;
}

/** Put a conflicted copy of the record in `folder` beside its record of the same number, holding `over` laid on that record. */
function conflictedRecord(folder, over = {}) {
  const { record } = readEpisode(folder, { pastCopies: true });
  writeFileSync(join(folder, `record/${String(record.rev).padStart(4, "0")} (Sallie's laptop's conflicted copy 2026-10-20).json`), recordText({ ...record, ...over }));
}

describe("findEpisode, for a video named by its label", () => {
  it("finds it by its label, whatever its case and spacing, by its id and short id, and by its folder's name", () => {
    const t = setup();
    const e = clientEpisode(t);
    const ctx = ctxOf(t);
    for (const said of [LABEL, "video of 20 oct,  15:00 (mac studio)", ` ${LABEL} `, "e-20261020-a1b2c3", "a1b2c3", LIGHT_FOLDER]) assert.equal(findEpisode(ctx, said).name, e.name, said);
    t.done();
  });
  it("finds a session by its label, as its name holds it", () => {
    const t = setup();
    const e = clientEpisode(t, { over: SESSION_OVER });
    assert.equal(findEpisode(ctxOf(t), SESSION).name, e.name);
    assert.equal(findEpisode(ctxOf(t), "session, 2026-10-20").name, e.name);
    t.done();
  });
  it("tells labels numbered on this Mac apart: one with \" (2)\" fits only its own video, and the bare label only the first", () => {
    const t = setup();
    const first = clientEpisode(t);
    const second = clientEpisode(t, { folder: `2026-10-20 ${STEM} 2 (Mac Studio)`, video: `${STEM} 2.mov`, id: "e-20261020-d4e5f6", label: `${LABEL} (2)` });
    const ctx = ctxOf(t);
    assert.equal(findEpisode(ctx, LABEL).name, first.name);
    assert.equal(findEpisode(ctx, `${LABEL} (2)`).name, second.name);
    assert.ok(findEpisode(ctx, `${LABEL} (3)`).why);
    t.done();
  });
  it("names a gated video by its label and short id in the lists of episodes it says, and an answered one by its folder, as today", () => {
    const t = setup();
    clientEpisode(t);
    clientEpisode(t, { folder: `2026-10-19 Group session Acme (Mac Studio)`, video: "Group session Acme.mov", id: "e-20261019-0c0c0c", over: SESSION_OVER });
    clientEpisode(t, { folder: "2026-10-18 Pricing talk (Mac Studio)", video: "Pricing talk.mov", id: "e-20261018-0d0d0d", over: { kind: "finished", answer: ANSWERED } });
    const ctx = ctxOf(t);
    assert.equal(findEpisode(ctx, "nothing fits this").why, `No episode fits "nothing fits this". The episodes are: ${LABEL} (a1b2c3), ${SESSION} (0c0c0c) and 2026-10-18 Pricing talk (Mac Studio).`);
    // A gated video is never found by words of its folder or its name: "2026" fits the answered episode alone.
    assert.equal(findEpisode(ctx, "2026").name, "2026-10-18 Pricing talk (Mac Studio)");
    t.done();
  });
  it("names a conflicted episode by the label of a gated record, read past the copies or a copy's own, and one a newer brimm-video wrote by its short id", () => {
    const t = setup();
    const e = clientEpisode(t);
    conflictedRecord(e.folder, { label: "Video B" });
    const answered = clientEpisode(t, { folder: "2026-10-19 Call with Joe Bloggs (Mac Studio)", video: "Call with Joe Bloggs.mov", id: "e-20261019-0c0c0c", over: { kind: "finished", answer: ANSWERED } });
    // The other Mac marked it a session, and this Mac answered it finished, at once.
    conflictedRecord(answered.folder, SESSION_OVER);
    const newer = clientEpisode(t, { folder: "2026-10-18 Call with Ann Other (Mac Studio)", video: "Call with Ann Other.mov", id: "e-20261018-0d0d0d", over: { version: 9 } });
    conflictedRecord(newer.folder);
    const why = findEpisode(ctxOf(t), "nothing fits this").why;
    assert.equal(why, `No episode fits "nothing fits this". The episodes are: ${LABEL} (a1b2c3), ${SESSION} (0c0c0c) and an episode a newer brimm-video wrote (0d0d0d).`);
    assert.doesNotMatch(why, /Bloggs \(Mac|Ann Other|2026-10-1/);
    t.done();
  });
  it("names an episode folder with no record that can be read by its day and Mac alone, on a Mac that does the light import", () => {
    const t = setup();
    // A file where an episode's folder should be: its folder cannot be read as one.
    writeFileSync(join(t.root, "Episodes", LIGHT_FOLDER), "not a folder");
    assert.equal(findEpisode(ctxOf(t), "nothing fits this").why, `No episode fits "nothing fits this". The episodes are: an episode of 2026-10-20 from the Mac Studio whose record cannot be read.`);
    assert.equal(findEpisode(ctxOf(t, "full"), "nothing fits this").why, `No episode fits "nothing fits this". The episodes are: ${LIGHT_FOLDER}.`, "as today with the light import off");
    t.done();
  });
});

describe("a command the gate lets through, for a gated video", () => {
  it("names an episode with a conflicted copy by its label, and its copies without the video's name", async () => {
    for (const command of [["show", LABEL, "transcript"], ["release", LABEL]]) {
      const t = setup();
      writeSettings(t.home, { import: "light" });
      const e = clientEpisode(t);
      writeFileSync(join(e.folder, `${STEM} (Sallie's laptop's conflicted copy 2026-10-20).transcript.txt`), "[0:00] Hello again.");
      const r = await on(t.ctx.deps, ...command);
      assert.equal(r.code, 1, r.said.join("\n"));
      assert.match(r.said[0], new RegExp(`^${LABEL.replace(/[()]/g, "\\$&")} \\(a1b2c3\\): Dropbox has kept a conflicted copy in this episode: the video \\(Sallie's laptop's conflicted copy 2026-10-20\\)\\.transcript\\.txt\\.`));
      assert.doesNotMatch(r.said.join("\n"), SECRET);
      t.done();
    }
  });
  it("names an episode whose record cannot be read by its day and Mac, on a Mac that does the light import, and as today without it", async () => {
    const t = setup();
    writeFileSync(join(t.root, "Episodes", LIGHT_FOLDER), "not a folder");
    writeSettings(t.home, { import: "light" });
    assert.deepEqual((await on(t.ctx.deps, "show", LIGHT_FOLDER, "transcript")).said, ["An episode of 2026-10-20 from the Mac Studio whose record cannot be read: ask Jason."]);
    writeSettings(t.home, { import: "full" });
    assert.match((await on(t.ctx.deps, "show", LIGHT_FOLDER, "transcript")).said[0], new RegExp(`^${LIGHT_FOLDER.replace(/[()]/g, "\\$&")}: the folder ${LIGHT_FOLDER.replace(/[()]/g, "\\$&")} could not be read`));
    t.done();
  });
  it("release names it by its label, and so does another Mac's claim on it", async () => {
    const t = setup();
    clientEpisode(t);
    assert.deepEqual((await on(t.ctx.deps, "release", LABEL)).said, [`This Mac does not have ${LABEL} open, so there is nothing to hand over.`]);
    const u = setup();
    clientEpisode(u, { over: { editing: { by: "Sallie's laptop", since: AT } } });
    assert.deepEqual((await on(u.ctx.deps, "release", LABEL)).said, [`Sallie's laptop has ${LABEL} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`]);
    t.done();
    u.done();
  });
  it("resolve names it by its label, and says only that its name, label or video differ, never what they hold", async () => {
    const t = setup();
    const e = clientEpisode(t);
    conflictedRecord(e.folder, { label: "Video of 20 Oct, 15:01 (Mac Studio)", name: { text: "Jane's call", placeholder: false }, video: { ...e.record.video, file: "Jane again.mov" } });
    const r = await on(t.ctx.deps, "resolve", LABEL);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(r.said[0], `Dropbox kept two versions of record/0001.json in ${LABEL}:`);
    for (const what of ["Name", "Label", "Video"]) assert.ok(r.said.includes(`  ${what}: they differ.`), r.said.join("\n"));
    assert.doesNotMatch(r.said.join("\n"), /Jane|15:01|Coaching/);
    t.done();
  });
  it("keeps every line of a scoped command free of the video's names: finish is refused at once for a session, and for a video marked one", async () => {
    // With the training gate on, the gate lets finish through for either. A session's own finish (F7) refuses it at once on a Mac
    // that hands off version 1; a video of another kind marked one is refused at once, by its label, before finish looks in any
    // folder for what Final Cut made (finish.js cannotFinish, which reads a mark by the gate's predicate).
    const t = setup();
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(t, { over: SESSION_OVER });
    const refused = await on(t.ctx.deps, "finish", SESSION);
    assert.deepEqual([refused.code, refused.said], [1, ["A session's hand-off is written once this Mac hands off version 2: ask Jason."]]);
    const u = setup();
    writeSettings(u.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(u, { over: MARKED_OVER });
    const r = await on(u.ctx.deps, "finish", LABEL);
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`]]);
    assert.doesNotMatch(r.said.join("\n"), SECRET);
    t.done();
    u.done();
  });
});

describe("episodes, on a Mac that does the light import", () => {
  /** What `episodes` says on t's Mac. */
  const listing = async (t) => (await on(depsOf(t), "episodes")).said;
  it("names a video waiting for its answer and a session by their labels, what each is, its length and short id, and no folder", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t, { over: { title: { text: "Jane's breakthrough", from: "claude", approved: false } } });
    clientEpisode(t, { folder: "2026-10-19 Group session Acme (Mac Studio)", video: "Group session Acme.mov", id: "e-20261019-0c0c0c", over: SESSION_OVER });
    clientEpisode(t, { folder: "2026-10-18 Pricing talk (Mac Studio)", video: "Pricing talk.mov", id: "e-20261018-0d0d0d", over: { kind: "finished", answer: ANSWERED } });
    const said = await listing(t);
    assert.deepEqual(said.slice(0, 8), [
      "Episodes, newest first:",
      `  ${LABEL}: a video waiting for your answer, of 2:00, id a1b2c3`,
      "    Seen: wide, 2:00, 3 retakes",
      "    Came: from a camera",
      "    Guess: raw with retakes",
      `    Card: ${JSON.stringify(cardFor({ label: LABEL, guess: "raw", maybe: null }))}`,
      `  ${SESSION}: a client or group session, of 2:00, id 0c0c0c`,
      "  Pricing talk (a placeholder name): an episode of 2:00, in 2026-10-18 Pricing talk (Mac Studio), id 0d0d0d"
    ]);
    assert.doesNotMatch(said.join("\n"), /Jane|Coaching|Acme/);
    t.done();
  });
  it("lists a video left alone, not for brimm-video, apart, under its own heading", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t, { over: { answer: { ...ANSWER, state: "not for brimm-video" } } });
    const said = await listing(t);
    assert.deepEqual(said.slice(0, 3), ["Left alone, not for brimm-video:", `  ${LABEL}: a video of 2:00, id a1b2c3`, "On this Mac:"]);
    t.done();
  });
  it("names a gated episode with a conflicted copy by its label, and its files that are not right without the video's name; a newer one by its id", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const e = clientEpisode(t);
    conflictedRecord(e.folder);
    rmSync(join(e.folder, `${STEM}.transcript.txt`));
    // And one a newer brimm-video wrote, with a conflicted copy of its own: by its short id alone, read past the copy.
    const newer = clientEpisode(t, { folder: "2026-10-18 Call with Ann Other (Mac Studio)", video: "Call with Ann Other.mov", id: "e-20261018-0d0d0d", over: { version: 9 } });
    conflictedRecord(newer.folder);
    const said = await listing(t);
    assert.equal(said[1], `  ${LABEL}: a video waiting for your answer, of 2:00, id a1b2c3`);
    assert.deepEqual(said.slice(2, 6), ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes", `    Card: ${JSON.stringify(cardFor({ label: LABEL, guess: "raw", maybe: null }))}`]);
    assert.match(said[6], /^ {4}Not right: Dropbox has kept a conflicted copy in this episode: record\/0001 \(Sallie's laptop's conflicted copy 2026-10-20\)\.json\./);
    assert.ok(said.includes("  An episode a newer brimm-video wrote (0d0d0d): Jason updates this Mac before it is changed here."), said.join("\n"));
    assert.doesNotMatch(said.join("\n"), /Jane|Coaching|Ann Other/);
    t.done();
  });
  it("names a folder with no record that can be read by its day and Mac", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    writeFileSync(join(t.root, "Episodes", LIGHT_FOLDER), "not a folder");
    assert.deepEqual((await listing(t)).slice(0, 2), ["Episodes, newest first:", "  An episode of 2026-10-20 from the Mac Studio whose record cannot be read: ask Jason."]);
    t.done();
  });
  it("names each video waiting in a drop folder by its label, or by its size, and never by its file, with its held reason free of names", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    failedStatus(t);
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Call with Joe Bloggs.mov"), "a video of a client");
    mkdirSync(join(t.root, "Unedited Video", "Sallie's laptop"), { recursive: true });
    writeFileSync(join(t.root, "Unedited Video", "Sallie's laptop", "GMT20261013-142933_Recording_gvo_1280x720.mp4"), "zoom");
    const said = await listing(t);
    const at = said.indexOf("Waiting in the drop folders:");
    assert.deepEqual(said.slice(at, at + 4), [
      "Waiting in the drop folders:",
      "  A video of 19 bytes, in the Mac Studio's drop folder, for 0 minutes",
      `  ${SECOND_LABEL}, in the Mac Studio's drop folder, for 0 minutes: its import failed on Mac Studio: the sound could not be read from the file (a file: Invalid data found when processing input). Say "try it again" to import it again.`,
      "  A Zoom download of 4 bytes, in Sallie's laptop's drop folder, for 0 minutes"
    ]);
    assert.doesNotMatch(said.join("\n"), /Jane|Coaching|Bloggs/);
    t.done();
  });
  it("says a video waiting there that a gated episode holds is imported already, by that episode's label", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    const said = await listing(t);
    assert.ok(said.includes(`  A video of 5 bytes, in the Mac Studio's drop folder, for 0 minutes: already imported as ${LABEL} (a1b2c3). It stays in the drop folder until its late check passes, or for a person to delete.`), said.join("\n"));
    t.done();
  });
  it("names this Mac's library of a gated episode by its label, an answered one's as today, and one of no episode here by its day and Mac", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t, { over: SESSION_OVER });
    clientEpisode(t, { folder: "2026-10-18 Pricing talk (Mac Studio)", video: "Pricing talk.mov", id: "e-20261018-0d0d0d", over: { kind: "finished", answer: ANSWERED } });
    for (const folder of [LIGHT_FOLDER, "2026-10-18 Pricing talk (Mac Studio)", "2026-10-17 Call with Joe Bloggs (Mac Studio)"]) library(t, folder);
    const said = await listing(t);
    const at = said.indexOf("On this Mac:");
    assert.deepEqual(said.slice(at, at + 4), ["On this Mac:", "  The library of an episode of 2026-10-17 from the Mac Studio whose record cannot be read: 9 bytes", "  2026-10-18 Pricing talk (Mac Studio).fcpbundle: 9 bytes", `  The library of ${SESSION} (a1b2c3): 9 bytes`]);
    t.done();
  });
});

// --- The card's facts: what `episodes` prints for her skill to read, word for word (spec 2026-10-22, section 2, "The card") ---

describe("episodes, the card's facts of a video waiting for its answer", () => {
  /** The label line of the video here, and below it the lines indented four spaces: what `episodes` says of the video. */
  const cardOf = async (t, label = LABEL) => {
    const said = (await on(depsOf(t), "episodes")).said;
    const at = said.indexOf(said.find((line) => line.startsWith(`  ${label}: `)));
    const lines = [];
    // The card itself (`    Card: …`), which receipts.test.js pins, is left out: these are the facts above it.
    for (let i = at + 1; i < said.length && said[i].startsWith("    "); i++) if (!said[i].startsWith("    Card")) lines.push(said[i]);
    return { said, at, lines };
  };
  /** A finished, raw, short or unanswered video that the walked video's words matched, in the folder of its own day. */
  const TARGET = { folder: "2026-10-18 Pricing talk (Mac Studio)", video: "Pricing talk.mov", id: "e-20261018-0d0d0d", label: "Video of 18 Oct, 09:30 (Mac Studio)" };
  const NAMED = { text: "Pricing talk", placeholder: false };
  /** The Maybe line a match on TARGET says, with `kind` words after the id (none when `kind` is ""). */
  const maybe = (name, kind) => `    Maybe a new version of: ${name} (id 0d0d0d)${kind ? `, ${kind}` : ""}`;
  /** An unanswered video whose answer is ANSWER with `answer` laid on it, in a Mac of its own that does the light import. */
  function waiting(answer = {}, ...more) {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const e = clientEpisode(t, { over: { answer: { ...ANSWER, ...answer } } });
    for (const extra of more) clientEpisode(t, extra);
    return { t, e };
  }
  it("says what was seen, how it came and the guess, each under the video's line, indented four spaces, in that order", async () => {
    const { t } = waiting();
    const { said } = await cardOf(t);
    assert.deepEqual(said.slice(0, 5), [
      "Episodes, newest first:",
      `  ${LABEL}: a video waiting for your answer, of 2:00, id a1b2c3`,
      "    Seen: wide, 2:00, 3 retakes",
      "    Came: from a camera",
      "    Guess: raw with retakes"
    ]);
    t.done();
  });
  it("says how it came in the words of each way", async () => {
    const { t, e } = waiting();
    for (const [came, words] of [["camera", "from a camera"], ["phone", "from an iPhone"], ["zoom", "as a Zoom download"], ["sound", "as sound alone"]]) {
      rewrite(e.folder, { answer: { ...ANSWER, came } });
      assert.ok((await cardOf(t)).lines.includes(`    Came: ${words}`), `${came}: ${(await cardOf(t)).lines.join("\n")}`);
    }
    t.done();
  });
  it("says the guess in the words of each kind guessKind stores", async () => {
    const { t, e } = waiting();
    for (const [guess, words] of [["finished", "finished by your editor"], ["raw", "raw with retakes"], ["clip", "an iPhone clip"]]) {
      rewrite(e.folder, { answer: { ...ANSWER, guess } });
      assert.ok((await cardOf(t)).lines.includes(`    Guess: ${words}`), `${guess}: ${(await cardOf(t)).lines.join("\n")}`);
    }
    t.done();
  });
  it("leaves out a line for what is not given: no seen, no way it came, no guess, no match", async () => {
    // The match names an answered video on this Mac, so that the Maybe line is said unless the match is none.
    const { t, e } = waiting({}, { ...TARGET, over: { kind: "finished", answer: ANSWERED, name: NAMED } });
    const starts = { seen: "    Seen: ", came: "    Came: ", guess: "    Guess: ", match: "    Maybe a new version of: " };
    const empty = { seen: "", came: null, guess: null, match: null };
    rewrite(e.folder, { answer: { ...ANSWER, match: TARGET.id } });
    assert.deepEqual((await cardOf(t)).lines.map((line) => line.slice(0, line.indexOf(":") + 2)), Object.values(starts));
    for (const key of Object.keys(starts)) {
      rewrite(e.folder, { answer: { ...ANSWER, match: TARGET.id, [key]: empty[key] } });
      const { lines } = await cardOf(t);
      for (const [other, start] of Object.entries(starts)) assert.equal(lines.some((line) => line.startsWith(start)), other !== key, `${key} left out, ${other}: ${lines.join("\n")}`);
    }
    rewrite(e.folder, { answer: { ...ANSWER, seen: "", came: null, guess: null, match: null } });
    assert.deepEqual((await cardOf(t)).lines, []);
    t.done();
  });
  it("says what was seen only in the shape seenLine makes, on one line, and nothing else that the record holds", async () => {
    const { t, e } = waiting();
    for (const seen of ["wide, 42:10, 2 retakes", "upright, 5:00, no retakes", "sound only, 30:00, 1 retake", "wide, 1:02:05", "wide, 0:45, 12 retakes"]) {
      rewrite(e.folder, { answer: { ...ANSWER, seen } });
      assert.ok((await cardOf(t)).lines.includes(`    Seen: ${seen}`), seen);
    }
    // A record may hold any text as what was seen, a conflicted copy that was never checked included: a line break would forge the
    // card's lines, and a file's name has no place in it.
    for (const seen of ["wide\n    Maybe a new version of: Forged (id 000000), raw with retakes", "wide, 2:00, 3 retakes\n", "wide, 2:00\nGuess: raw", "wide, 2:00, 3 retakes\r", "Coaching call Jane Doe.mov", "wide, 2:00, 3 retakes and more", " wide, 2:00", "tall, 2:00", "wide, 2:00, -1 retakes"]) {
      rewrite(e.folder, { answer: { ...ANSWER, seen } });
      const { said, lines } = await cardOf(t);
      assert.deepEqual(lines, ["    Came: from a camera", "    Guess: raw with retakes"], JSON.stringify(seen));
      assert.doesNotMatch(said.join("\n"), /Forged|000000|Jane|Coaching/, JSON.stringify(seen));
    }
    t.done();
  });
  it("leaves out the line of a guess that it has no words for, as a word of an object is not one", async () => {
    for (const guess of ["constructor", "toString", "session"]) {
      const { t } = waiting({ guess });
      assert.deepEqual((await cardOf(t)).lines, ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera"], guess);
      t.done();
    }
  });
  it("says a match that is finished by the editor, raw (before the switch too), or a short video, with its kind in words", async () => {
    const { t } = waiting({ match: TARGET.id });
    for (const [over, kind] of [
      [{ kind: "finished", answer: ANSWERED }, "finished by your editor"],
      [{ kind: "raw", answer: ANSWERED }, "raw with retakes"],
      [{ kind: "episode", answer: undefined }, "raw with retakes"],
      [{ kind: "short video", answer: ANSWERED }, "an iPhone clip"]
    ]) {
      const target = clientEpisode(t, { ...TARGET, over: { ...over, name: NAMED } });
      const { lines } = await cardOf(t);
      assert.deepEqual(lines, ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes", maybe("Pricing talk", kind)]);
      rmSync(target.folder, { recursive: true, force: true });
    }
    t.done();
  });
  it("leaves out the Maybe line when the match is not answered: not yet, left alone, with no label, or the video itself", async () => {
    // `kind --version-of` takes an answered video alone, so her card does not offer any other.
    const cases = [
      ["a video not answered yet", [TARGET], TARGET.id],
      ["a video left alone", [{ ...TARGET, over: { answer: { ...ANSWER, state: "not for brimm-video" } } }], TARGET.id],
      ["a video not answered, with no label", [{ ...TARGET, label: "" }], TARGET.id],
      ["the video itself", [], "e-20261020-a1b2c3"]
    ];
    for (const [what, extra, match] of cases) {
      const { t } = waiting({ match }, ...extra);
      const { said, lines } = await cardOf(t);
      assert.ok(!said.some((line) => line.includes("Maybe a new version of")), `${what}: ${said.join("\n")}`);
      assert.equal(said.some((line) => line.includes("0d0d0d")), extra.length > 0, `${what} is listed: ${said.join("\n")}`);
      assert.deepEqual(lines, ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"], what);
      t.done();
    }
  });
  it("says the match by its name and short id, found by its record alone, and not by its folder or its file", async () => {
    // The match's folder and file are named for a client, and its name is a name she gave it.
    const { t } = waiting({ match: "e-20261018-0d0d0d" }, { folder: "2026-10-18 Coaching call Jane Doe again (Mac Studio)", video: "Coaching call Jane Doe again.mov", id: "e-20261018-0d0d0d", over: { kind: "finished", answer: ANSWERED, name: NAMED } });
    const { said, lines } = await cardOf(t);
    assert.ok(lines.includes(maybe("Pricing talk", "finished by your editor")), lines.join("\n"));
    assert.ok(!lines.join("\n").match(SECRET), lines.join("\n"));
    assert.ok(said.length > lines.length);
    t.done();
  });
  it("leaves out the whole Maybe line when the match names no record, or a record it cannot read, or one not answered anywhere, and says only that it may be a session's for a session", async () => {
    const sessionMark = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
    const cleared = { ...sessionMark, cleared: { at: AT, on: "Mac Studio", to: "a client", confirmed: "dialog" } };
    const asSession = { name: { text: SESSION, placeholder: false } };
    // The match's folder and file are named for a client, and its name is still the file's (a placeholder): the one name that would
    // give the client away if the line were said.
    const CLIENT = { ...TARGET, folder: "2026-10-18 Coaching call Jane Doe (Mac Studio)", video: "Coaching call Jane Doe.mov" };
    const stem = { text: "Coaching call Jane Doe", placeholder: true };
    const { t } = waiting({ match: TARGET.id });
    // Each case: what the match is, its record laid on a finished video's, whether `episodes` lists it (an archived video is not),
    // and whether it is a session not cleared, which the card says it may be a new version of, naming none (final fix 2).
    const cases = [
      ["no record with that id", null, false, false],
      ["a session, its mark not cleared", { kind: "session", answer: ANSWERED, session: sessionMark, ...asSession }, true, true],
      ["a session with no mark at all", { kind: "session", answer: ANSWERED, ...asSession }, true, true],
      // A session whose mark she cleared is no longer gated: it is listed as an answered video is, by its folder, as it always was.
      ["a session, its mark cleared", { kind: "session", answer: ANSWERED, session: cleared, ...asSession }, true, false, TARGET],
      ["a finished video marked a session, not cleared", { kind: "finished", answer: ANSWERED, session: sessionMark, name: stem }, true, true],
      ["an archived video", { kind: "finished", answer: ANSWERED, archived: { at: AT }, name: stem }, false, false],
      ["a video a newer brimm-video wrote", { kind: "finished", answer: ANSWERED, version: 9, name: stem }, true, false]
    ];
    const SESSIONS_LINE = "    Maybe a new version of a client or group session.";
    const noMaybe = (said, what, base, session = false) => {
      assert.ok(!said.some((line) => line.includes("Maybe a new version of") && line !== SESSIONS_LINE), `${what}: ${said.join("\n")}`);
      assert.equal(said.includes(SESSIONS_LINE), session, `${what}: ${said.join("\n")}`);
      if (base === CLIENT) assert.doesNotMatch(said.join("\n"), SECRET, what);
    };
    for (const [what, over, listed, session, base = CLIENT] of cases) {
      const target = over ? clientEpisode(t, { ...base, over }) : null;
      const { lines, said } = await cardOf(t);
      noMaybe(said, what, base, session);
      assert.equal(said.some((line) => line.includes("0d0d0d")), listed, `${what}: ${said.join("\n")}`);
      assert.deepEqual(lines, ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes", ...(session ? [SESSIONS_LINE] : [])], what);
      if (target) rmSync(target.folder, { recursive: true, force: true });
    }
    // The same of an episode with a conflicted copy, where the record in force is read past the copy: archived in force; a copy that
    // is a session not cleared; and a copy that is not answered, or that was left alone, beside an answered video in force, whose
    // own line then names it by its label, as the gate does for any record of an episode, so that no line may name it by its name.
    const withCopy = async (what, over, copy, listed, base = CLIENT, session = false) => {
      const target = clientEpisode(t, { ...base, over });
      conflictedRecord(target.folder, copy);
      const { said } = await cardOf(t);
      noMaybe(said, what, base, session);
      assert.ok(said.some((line) => line.startsWith(`  ${CLIENT.label}: `)) === listed, `${what}: ${said.join("\n")}`);
      rmSync(target.folder, { recursive: true, force: true });
    };
    const answered = { kind: "finished", answer: ANSWERED, name: stem };
    // (An answered video that is not gated is listed by its folder, a conflicted one too, as it always was: so this one is not client-named.)
    await withCopy("an archived video with a conflicted copy", { ...answered, name: NAMED, archived: { at: AT } }, { archived: null }, false, TARGET);
    await withCopy("a finished video with a session's conflicted copy", answered, { kind: "session", session: sessionMark, ...asSession }, false, CLIENT, true);
    await withCopy("a finished video with a conflicted copy not answered", answered, { kind: null, answer: ANSWER }, true);
    await withCopy("a raw video with a conflicted copy left alone", { ...answered, kind: "raw" }, { kind: null, answer: { ...ANSWER, state: "not for brimm-video" } }, true);
    t.done();
  });
  it("says only that it may be a session's new version when the match's other versions hold a session not cleared, as `kind` takes only a session for it", async () => {
    // A is finished and answered; S is a session, its mark not cleared, that is a version of A; B waits, and its words matched A.
    const sessionMark = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
    const cleared = { ...sessionMark, cleared: { at: AT, on: "Mac Studio", to: "a client", confirmed: "dialog" } };
    const A = { ...TARGET, over: { kind: "finished", answer: ANSWERED, name: NAMED } };
    const S = { folder: "2026-10-19 Group session Acme (Mac Studio)", video: "Group session Acme.mov", id: "e-20261019-0c0c0c", label: "Video of 19 Oct, 10:00 (Mac Studio)" };
    const asSession = { kind: "session", answer: ANSWERED, name: { text: SESSION, placeholder: false }, versionOf: TARGET.id };
    const lines = ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"];
    const said = async (t) => (await cardOf(t)).lines;
    // The control: with A alone, and with a later version of A that is no session, A is offered.
    const { t } = waiting({ match: TARGET.id }, A);
    assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
    const later = clientEpisode(t, { ...S, over: { kind: "finished", answer: ANSWERED, name: NAMED, versionOf: TARGET.id } });
    assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
    rmSync(later.folder, { recursive: true, force: true });
    // S, a session not cleared, among A's versions: A is not offered, and nothing of S is said under B but that B may be a new
    // version of a session (final fix 2).
    const SESSIONS_LINE = "    Maybe a new version of a client or group session.";
    const session = clientEpisode(t, { ...S, over: { ...asSession, session: sessionMark } });
    const { lines: without, said: all } = await cardOf(t);
    assert.deepEqual(without, [...lines, SESSIONS_LINE]);
    assert.ok(!all.some((line) => line.includes("Maybe a new version of") && line !== SESSIONS_LINE), all.join("\n"));
    // ...and kind takes no answer for B but a session.
    const refused = await on(depsOf(t), "kind", LABEL, "finished", "--private", "no", "--version-of", "0d0d0d");
    assert.deepEqual([refused.code, refused.said], [1, ["This video holds most of the words of a client or group session: answer it as a session, or ask Jason."]]);
    // The same when its mark is only in a conflicted copy of a record that says it is finished.
    rmSync(session.folder, { recursive: true, force: true });
    const copy = clientEpisode(t, { ...S, over: { kind: "finished", answer: ANSWERED, name: NAMED, versionOf: TARGET.id } });
    assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
    conflictedRecord(copy.folder, { kind: "session", session: sessionMark, name: { text: SESSION, placeholder: false } });
    assert.deepEqual(await said(t), [...lines, SESSIONS_LINE]);
    rmSync(copy.folder, { recursive: true, force: true });
    // A session whose mark she cleared is no longer held, and does not stop it; and a session that is a version of something else does not.
    const done = clientEpisode(t, { ...S, over: { ...asSession, session: cleared } });
    assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
    rmSync(done.folder, { recursive: true, force: true });
    const other = clientEpisode(t, { ...S, over: { ...asSession, session: sessionMark, versionOf: undefined } });
    assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
    rmSync(other.folder, { recursive: true, force: true });
    t.done();
  });
  it("leaves out the Maybe line when the match's chain has a gap or a loop, or holds the waiting video itself, as `kind --version-of` refuses such a target", async () => {
    // B waits, and its words matched A. `kind --version-of A` is refused when A's chain cannot be followed to its first (an episode not
    // on this Mac, or a loop), and when A is already a version of B (answerWhy: links.gapOf, links.chainOf).
    const A = { ...TARGET, over: { kind: "finished", answer: ANSWERED, name: NAMED } };
    const C = { folder: "2026-10-17 Older talk (Mac Studio)", video: "Older talk.mov", id: "e-20261017-5c5c5c", label: "Video of 17 Oct, 09:00 (Mac Studio)" };
    const OLDER = { kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } };
    const WAITING_ID = "e-20261020-a1b2c3";
    const lines = ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"];
    const said = async (t) => (await cardOf(t)).lines;
    const kindRefused = async (t) => (await on(depsOf(t), "kind", LABEL, "finished", "--private", "no", "--version-of", "0d0d0d")).said.join("\n");
    // The control: A a version of an episode that is here, and that of another, offers A.
    {
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: C.id } }, { ...C, over: OLDER });
      assert.deepEqual(await said(t), [...lines, maybe("Pricing talk", "finished by your editor")]);
      t.done();
    }
    // A gap: A is a version of an episode this Mac does not have.
    {
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: "e-20261001-9f9f9f" } });
      assert.deepEqual(await said(t), lines);
      assert.match(await kindRefused(t), /is a new version of a video that is not on this Mac yet/);
      t.done();
    }
    // A loop: A is a version of C, which is a version of A.
    {
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: C.id } }, { ...C, over: { ...OLDER, versionOf: TARGET.id } });
      assert.deepEqual(await said(t), lines);
      assert.match(await kindRefused(t), /each say they are a version of the other/);
      t.done();
    }
    // A longer loop, A to C to D to C: A's own chain ends in a circle it is not in.
    {
      const D = { folder: "2026-10-16 Oldest talk (Mac Studio)", video: "Oldest talk.mov", id: "e-20261016-6d6d6d", label: "Video of 16 Oct, 09:00 (Mac Studio)" };
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: C.id } }, { ...C, over: { ...OLDER, versionOf: D.id } }, { ...D, over: { ...OLDER, versionOf: C.id } });
      assert.deepEqual(await said(t), lines);
      assert.match(await kindRefused(t), /in a circle/);
      t.done();
    }
    // The waiting video itself in A's chain: A is a version of B (a video that was matched to B's words, say, and answered since).
    {
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: WAITING_ID } });
      assert.deepEqual(await said(t), lines);
      assert.match(await kindRefused(t), /is already a version of it/);
      t.done();
    }
    // ...or further back in it: A is a version of C, which is a version of B.
    {
      const { t } = waiting({ match: TARGET.id }, { ...A, over: { ...A.over, versionOf: C.id } }, { ...C, over: { ...OLDER, versionOf: WAITING_ID } });
      assert.deepEqual(await said(t), lines);
      assert.match(await kindRefused(t), /is already a version of it/);
      t.done();
    }
  });
  it("says nothing of the card under a video she answered, left alone, or a session, whatever its answer holds", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const held = { guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null };
    clientEpisode(t, { over: { kind: "finished", answer: { ...ANSWERED, ...held } } });
    clientEpisode(t, { folder: "2026-10-19 Group session Acme (Mac Studio)", video: "Group session Acme.mov", id: "e-20261019-0c0c0c", label: "Video of 19 Oct, 10:00 (Mac Studio)", over: { ...SESSION_OVER, answer: { ...ANSWERED, ...held } } });
    clientEpisode(t, { folder: "2026-10-17 Left alone (Mac Studio)", video: "Left alone.mov", id: "e-20261017-0b0b0b", label: "Video of 17 Oct, 10:00 (Mac Studio)", over: { answer: { ...ANSWER, state: "not for brimm-video" } } });
    const said = (await on(depsOf(t), "episodes")).said;
    assert.ok(!said.some((line) => /^ {4}(Seen|Came|Guess|Maybe a new version of):/.test(line)), said.join("\n"));
    assert.ok(said.includes("Left alone, not for brimm-video:"), said.join("\n"));
    t.done();
  });
  it("puts the card's lines before anything else under the video's line, and the video's other lines stay", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const e = clientEpisode(t);
    conflictedRecord(e.folder);
    rmSync(join(e.folder, `${STEM}.transcript.txt`));
    const { said, at } = await cardOf(t);
    assert.deepEqual(said.slice(at, at + 4), [`  ${LABEL}: a video waiting for your answer, of 2:00, id a1b2c3`, "    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"]);
    assert.match(said[at + 4], /^ {4}Card: \{/);
    assert.match(said[at + 5], /^ {4}Not right: Dropbox has kept a conflicted copy in this episode/);
    t.done();
  });
  it("is the same on a Mac whose import is not the light one, for a video waiting for its answer", async () => {
    const t = setup();
    clientEpisode(t);
    const { lines } = await cardOf(t);
    assert.deepEqual(lines, ["    Seen: wide, 2:00, 3 retakes", "    Came: from a camera", "    Guess: raw with retakes"]);
    t.done();
  });
});

describe("a gated record with no label, named by its short id once", () => {
  // shownName names a gated record that has no label by its short id ("a client or group session (0c0c0c)"): a list, or the line of
  // a video an episode holds, that says the short id after the name says it once.
  const UNLABELLED_SESSION = { kind: "session", answer: ANSWERED, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
  it("is listed once by its short id among the episodes a command names", () => {
    const t = setup();
    clientEpisode(t, { folder: "2026-10-19 Group session Acme (Mac Studio)", video: "Group session Acme.mov", id: "e-20261019-0c0c0c", label: "", over: UNLABELLED_SESSION });
    clientEpisode(t, { folder: "2026-10-18 Pricing talk (Mac Studio)", video: "Pricing talk.mov", id: "e-20261018-0d0d0d", over: { kind: "finished", answer: ANSWERED } });
    const why = findEpisode(ctxOf(t), "nothing fits this").why;
    assert.equal(why, 'No episode fits "nothing fits this". The episodes are: a client or group session (0c0c0c) and 2026-10-18 Pricing talk (Mac Studio).');
    t.done();
  });
  it("is said once by its short id as what holds a video waiting in the drop folder", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t, { label: "", over: UNLABELLED_SESSION });
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    const said = (await on(depsOf(t), "episodes")).said;
    assert.ok(said.includes("  A video of 5 bytes, in the Mac Studio's drop folder, for 0 minutes: already imported as a client or group session (a1b2c3). It stays in the drop folder until its late check passes, or for a person to delete."), said.join("\n"));
    assert.doesNotMatch(said.join("\n"), SECRET);
    t.done();
  });
});

describe("a video in the drop folder whose episode has a conflicted copy, or cannot be read, on a Mac whose import is not the light one", () => {
  // What holds a video is found past the conflicted copies Dropbox keeps of an episode's records, as edit.js finds the episode the
  // gate holds by any of them; and a video whose holder cannot be told, since Episodes or an episode's records cannot be read, is
  // never named by its file: it may be a session's.
  const UNLABELLED_SESSION = { kind: "session", answer: ANSWERED, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
  const HELD = "a client or group session (a1b2c3)";
  /** A session with no label, whose mark is not cleared, holds the client's video, which waits in this Mac's drop folder. */
  const sessionHolding = (t) => {
    const e = clientEpisode(t, { label: "", over: UNLABELLED_SESSION });
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    return e;
  };
  /** The lines `episodes` says of the drop folders, from their heading to the next heading. */
  const waitingIn = (said) => {
    const at = said.indexOf("Waiting in the drop folders:");
    const end = said.findIndex((line, i) => i > at && !line.startsWith("  "));
    return at < 0 ? [] : said.slice(at, end < 0 ? undefined : end);
  };
  it("episodes and retry name it as the session's video, read past a conflicted copy of its record", async () => {
    const t = setup();
    conflictedRecord(sessionHolding(t).folder);
    const said = (await on(depsOf(t), "episodes")).said;
    assert.deepEqual(waitingIn(said), ["Waiting in the drop folders:", `  A video of 5 bytes, in the Mac Studio's drop folder, for 0 minutes: already imported as ${HELD}. It stays in the drop folder until its late check passes, or for a person to delete.`]);
    assert.doesNotMatch(said.join("\n"), SECRET);
    const none = await on(depsOf(t), "retry", "nothing fits this");
    assert.deepEqual(none.said, ['No video in this Mac\'s drop folder fits "nothing fits this". It holds: a video of 5 bytes.']);
    const named = await on(depsOf(t), "retry", VIDEO);
    assert.deepEqual([named.code, named.said], [1, [`A video of 5 bytes in this Mac's drop folder is already imported as ${HELD}. It stays in the drop folder until its late check passes, or for a person to delete.`]]);
    t.done();
  });
  it("episodes and retry name it by what it is and its size when the episode's records, or Episodes, cannot be read", async () => {
    for (const which of ["record", "Episodes"]) {
      const t = setup();
      const e = sessionHolding(t);
      const shut = which === "record" ? join(e.folder, "record") : join(t.root, "Episodes");
      chmodSync(shut, 0o000);
      try {
        const said = (await on(depsOf(t), "episodes")).said;
        assert.deepEqual(waitingIn(said), ["Waiting in the drop folders:", "  A video of 5 bytes, in the Mac Studio's drop folder, for 0 minutes"], which);
        const none = await on(depsOf(t), "retry", "nothing fits this");
        assert.deepEqual(none.said, ['No video in this Mac\'s drop folder fits "nothing fits this". It holds: a video of 5 bytes.'], which);
        assert.doesNotMatch([...waitingIn(said), ...none.said].join("\n"), SECRET);
      } finally {
        chmodSync(shut, 0o755);
      }
      t.done();
    }
  });
  it("names it by its file as today when an episode that cannot be read is not named for it: only one that could be its makes it untold", async () => {
    const t = setup();
    const e = clientEpisode(t, { folder: "2026-10-19 Budget (Mac Studio)", video: "Budget.mov", id: "e-20261019-0c0c0c", over: { kind: "finished", answer: ANSWERED } });
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mov"), "video");
    const shut = join(e.folder, "record");
    chmodSync(shut, 0o000);
    try {
      assert.deepEqual(waitingIn((await on(depsOf(t), "episodes")).said), ["Waiting in the drop folders:", "  Talk.mov, in Mac Studio's, for 0 minutes"]);
      assert.deepEqual((await on(depsOf(t), "retry", "nothing fits this")).said, ['No video in this Mac\'s drop folder fits "nothing fits this". It holds: Talk.mov.']);
    } finally {
      chmodSync(shut, 0o755);
    }
    t.done();
  });
  it("names it by its file as today when an episode that can be read holds it and is answered, or nothing holds it", async () => {
    const t = setup();
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, "Talk.mov"), "video");
    const said = (await on(depsOf(t), "episodes")).said;
    assert.deepEqual(waitingIn(said), ["Waiting in the drop folders:", "  Talk.mov, in Mac Studio's, for 0 minutes"]);
    // Held by an answered episode, with a conflicted copy of its record: by its file, and the episode by its folder, as today.
    const e = clientEpisode(t, { folder: "2026-10-18 Talk (Mac Studio)", video: "Talk.mov", id: "e-20261018-0d0d0d", label: "", over: { kind: "finished", answer: ANSWERED } });
    conflictedRecord(e.folder);
    const held = (await on(depsOf(t), "episodes")).said;
    assert.deepEqual(waitingIn(held), ["Waiting in the drop folders:", "  Talk.mov, in Mac Studio's, for 0 minutes: already imported as 2026-10-18 Talk (Mac Studio). It stays in the drop folder until its late check passes, or for a person to delete."]);
    t.done();
  });
});

describe("the import statuses, status and retry, of a light import", () => {
  it("name a labelled status by its label, with no path or file name in why it failed", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    failedStatus(t);
    const line = `  ${SECOND_LABEL}: its import failed on Mac Studio: the sound could not be read from the file (a file: Invalid data found when processing input)`;
    for (const argv of [["episodes"], ["status"], ["status", SECOND_LABEL]]) {
      const r = await on(depsOf(t), ...argv);
      assert.ok(r.said.includes(line), `${argv.join(" ")}: ${r.said.join("\n")}`);
      assert.doesNotMatch(r.said.join("\n"), SECRET);
    }
    t.done();
  });
  it("retry takes the label for the file, and names the video by it", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    failedStatus(t);
    const r = await on(depsOf(t), "retry", SECOND_LABEL.toLowerCase());
    assert.deepEqual([r.code, r.said], [0, [`${SECOND_LABEL} is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is.`]]);
    assert.deepEqual(readStatuses(t.root), []);
    t.done();
  });
  it("retry names what the drop folder holds by labels and sizes alone when nothing fits", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    failedStatus(t);
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Call with Joe Bloggs.mov"), "a video of a client");
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "GMT20261013-142933_Recording_gvo_1280x720.mp4"), "zoom");
    const r = await on(depsOf(t), "retry", "nothing fits this");
    assert.deepEqual(r.said, [`No video in this Mac's drop folder fits "nothing fits this". It holds: a video of 19 bytes, ${SECOND_LABEL} and a Zoom download of 4 bytes.`]);
    t.done();
  });
  it("retry names a Zoom download held in the drop folder as one, with why, and not by its file", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const ZOOM = "GMT20261013-142933_Recording_gvo_1280x720.mp4";
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, ZOOM), "zoom");
    writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, video: ZOOM, bytes: 4, seconds: null, step: "Held", at: AT, held: "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer." }, writeText);
    const r = await on(depsOf(t), "retry", ZOOM);
    assert.deepEqual([r.code, r.said], [1, ["A Zoom download of 4 bytes in this Mac's drop folder is held: Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer."]]);
    t.done();
  });
  it("retry of a video a gated episode holds names that episode by its label, and the video by it too", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    // Its import stopped on this Mac before its late check: its status, with its label, is still there.
    writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9x", video: VIDEO, bytes: 5, seconds: 120, step: "Filing", at: "2026-10-20T13:00:00-05:00", label: LABEL }, writeText);
    const r = await on(depsOf(t), "retry", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`${LABEL} is imported, as ${LABEL} (a1b2c3). Its import stopped on this Mac, and has no late check left to make here, so the status that held the episode is taken away.`]]);
    // With no status left, the video in the drop folder is named by what it is and its size, and the episode by its label.
    const again = await on(depsOf(t), "retry", VIDEO);
    assert.deepEqual([again.code, again.said], [1, [`A video of 5 bytes in this Mac's drop folder is already imported as ${LABEL} (a1b2c3). It stays in the drop folder until its late check passes, or for a person to delete.`]]);
    t.done();
  });
});

describe("status, and the result files of detached runs, for a gated video", () => {
  it("names a result by the label and short id, with no file or folder named from the video", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t);
    oldResult(t);
    const r = await on(depsOf(t), "status");
    // What a run left before the video was gated says what to say next by its name: that is dropped, and so is its folder.
    assert.deepEqual(r.said, [`${LABEL} (a1b2c3): bring ended 2 hours ago. Made: the video.transcript.txt. Not done: the video.words.json could not be read (EIO).`]);
    t.done();
  });
  it("names the result the gate leaves for a refused --now run by the label and short id", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t);
    assert.equal((await on(depsOf(t), "bring", "--now", LIGHT_FOLDER)).code, 1);
    const r = await on(depsOf(t), "status", LABEL);
    assert.deepEqual(r.said, [`${LABEL} (a1b2c3): bring ended 0 minutes ago. Not done: This video is waiting for its answer: say what it is first.`]);
    t.done();
  });
  it("writes no name of the video into the result of a finish that ends for a session, even in the error it meets letting go this Mac's claim", async () => {
    // A session's finish is refused at once (finish.js cannotFinish): the words of that name only its label. What can still hold a
    // name is the error of the claim's let-go, which the quick part took for the finish: the record cannot be written, and the
    // error names the episode's folder, as a path does. The result's `clean` takes that out; without it this test fails.
    const t = setup();
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(t, { over: { ...SESSION_OVER, editing: { by: "Mac Studio", since: AT } } });
    mkdirSync(episodeWork(t.home, LIGHT_FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, LIGHT_FOLDER), "finish.asked.json"), JSON.stringify({ version: 1, at: AT, rev: 1, claimed: true, parts: [{ key: "main", label: "the main video", projects: [], video: { name: `${STEM} main v1 a1b2c3.mov`, where: "this Mac" }, export: null, kept: false, noHandEdits: false }] }));
    const clone = (from, to) => {
      if (to.includes("/record/")) throw new Error(`${to} could not be cloned: it is not on the same disk`);
      copyFileSync(from, to);
    };
    await on({ ...depsOf(t), clone }, "finish", "--now", LIGHT_FOLDER);
    const result = readResult(t.home, LIGHT_FOLDER, "finish");
    assert.ok(result && result.failed.length === 2, JSON.stringify(result));
    assert.equal(result.failed[0], `${SESSION} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`);
    assert.match(result.failed[1], /^This Mac still has the episode open: it could not be let go \(/);
    assert.match(result.failed[1], /the video/, "the folder's name in the error was put as the video");
    assert.doesNotMatch(readFileSync(resultFile(t.home, LIGHT_FOLDER, "finish"), "utf8"), SECRET);
    t.done();
  });
});

describe("the light import's log, status files and notices", () => {
  it("name the video by its label and its episode by its id, never by its file or folder", async () => {
    const t = setup();
    const { logs, notes } = await importLightly(t);
    const { record } = readEpisode(lightFolder(t));
    assert.ok(logs.includes(`${LABEL}: filed into Episodes as ${record.id}.`), logs.join("\n"));
    assert.ok(logs.some((line) => line.startsWith(`${LABEL}: the late check passed`)), logs.join("\n"));
    for (const line of [...logs, ...notes]) assert.doesNotMatch(line, SECRET);
    t.done();
  });
  it("keep the file's name out of the log when ffprobe fails naming it, and the import goes on without what it would have read", async () => {
    const t = setup();
    const { logs, notes } = await importLightly(t, VIDEO, { fail: "probe" });
    assert.equal(readEpisode(lightFolder(t)).record.label, LABEL);
    for (const line of [...logs, ...notes]) assert.doesNotMatch(line, SECRET);
    t.done();
  });
  it("keep the file's name out of the log and the failed status when ffmpeg or the transcriber fails naming it", async () => {
    for (const fail of ["sound", "whisper"]) {
      const t = setup();
      const { logs, notes } = await importLightly(t, VIDEO, { fail });
      const statuses = readStatuses(t.root).map(({ status }) => status);
      assert.equal(statuses.length, 1, fail);
      assert.equal(statuses[0].label, LABEL, fail);
      assert.ok(statuses[0].failed, fail);
      assert.doesNotMatch(statuses[0].failed, /\//, `${fail}: ${statuses[0].failed}`);
      for (const line of [...logs, ...notes, statuses[0].failed]) assert.doesNotMatch(line, SECRET, fail);
      t.done();
    }
  });
  it("ends a light import whose words cannot be written in a failed status, free of names, and files nothing", async () => {
    const t = setup();
    // Something is where the run writes the video's words in its own folder, so that they cannot be written there.
    const before = (cmd, args) => {
      if (cmd === "FFPROBE") mkdirSync(join(dirname(args[args.indexOf("-o") + 1]), "made", `${STEM}.words.json`), { recursive: true });
    };
    const { logs, notes } = await importLightly(t, VIDEO, { before });
    const statuses = readStatuses(t.root).map(({ status }) => status);
    assert.deepEqual(statuses.map((s) => [s.label, s.failed]), [[LABEL, "the work stopped (EISDIR)"]]);
    assert.equal(existsSync(join(lightFolder(t), "record")), false);
    assert.ok(logs.includes(`${LABEL}: failed. the work stopped (EISDIR).`), logs.join("\n"));
    for (const line of [...logs, ...notes]) assert.doesNotMatch(line, SECRET);
    t.done();
  });
  it("ends an import whose record cannot be filed in a failed status, free of paths and names", async () => {
    const t = setup();
    const { logs, notes } = await importLightly(t, VIDEO, { deps: { clone: (from, to) => {
      if (to.endsWith(".json") && to.includes("/record/")) throw new Error(`${to} could not be cloned: it is not on the same disk`);
      copyFileSync(from, to);
    } } });
    const statuses = readStatuses(t.root).map(({ status }) => status);
    assert.equal(statuses.length, 1);
    assert.match(statuses[0].failed, /^it could not be filed into Episodes: /);
    assert.doesNotMatch(statuses[0].failed, /\//, statuses[0].failed);
    for (const line of [...logs, ...notes, statuses[0].failed]) assert.doesNotMatch(line, SECRET);
    t.done();
  });
  it("keeps names out of the problem a late check finds, in its status and its log", async () => {
    const t = setup();
    const srt = join(lightFolder(t), `${STEM}.rough-cut.srt`);
    let filed = false;
    const clone = (from, to) => (filed && to === srt ? writeFileSync(to, "1\n") : copyFileSync(from, to));
    let clock = 0;
    const { logs, notes } = await importLightly(t, VIDEO, { deps: { clone, wait: async (ms) => {
      clock += ms;
      if (ms === 60000 && !filed) {
        filed = true;
        writeFileSync(srt, "1\n");
      }
    }, clock: () => Date.parse("2026-10-20T15:00:00") + clock } });
    const statuses = readStatuses(t.root).map(({ status }) => status);
    assert.equal(statuses.length, 1);
    assert.ok(statuses[0].problem, JSON.stringify(statuses[0]));
    assert.doesNotMatch(statuses[0].problem, /\//, statuses[0].problem);
    for (const line of [...logs, ...notes, statuses[0].problem]) assert.doesNotMatch(line, SECRET);
    t.done();
  });
});

describe("the light import's match of a new version", () => {
  /** A light import of Talk.mov, its record then written as `over` says, and the same words dropped again as Talk again.mov:
      the episode the new drop's card offers, or null. */
  async function matchAfter(over) {
    const t = setup();
    await importLightly(t, "Talk.mov");
    const folder = lightFolder(t, "Talk.mov");
    rewrite(folder, over);
    await importLightly(t, "Talk again.mov");
    const match = readEpisode(lightFolder(t, "Talk again.mov")).record.answer.match;
    const id = readEpisode(folder).record.id;
    t.done();
    return { match, id };
  }
  it("offers an answered episode with the same words", async () => {
    const { match, id } = await matchAfter({ kind: "finished", answer: ANSWERED });
    assert.equal(match, id);
  });
  it("never offers an archived episode, or a session, by its kind or its mark", async () => {
    for (const over of [{ kind: "finished", answer: ANSWERED, archived: { at: AT } }, SESSION_OVER, { kind: "finished", answer: ANSWERED, session: SESSION_OVER.session }]) {
      assert.equal((await matchAfter(over)).match, null, JSON.stringify(over));
    }
  });
});

describe("the walk: every command, for a video imported lightly from a file named for a client", () => {
  /** What each command is given, as Claude runs it, with `label` where the episode goes: and with no words. The detached runs are
      given the episode's folder, as edit.js starts them, and the label too. Every command is here: nothing is left out of the
      walk. `open 2026` fits the answered episode alone, since a gated one is never found by words, and `open nothing fits this`
      has the list of episodes said. */
  const walkWords = (label) => ({
    episodes: [[]],
    kind: [[label, "finished", "--private", "no"], [label, "session", "--private", "yes"], [label, "raw", "--private", "no", "--again"], []],
    leave: [[label], []],
    which: [[label], []],
    read: [["--now", LIGHT_FOLDER, "--kind", "finished", "--rev", "1"], ["--now", label, "--kind", "session", "--rev", "1"], [label], []],
    workcopy: [["--now", LIGHT_FOLDER], ["--now", label], [label], []],
    open: [[label], [], ["2026"], ["nothing fits this"]],
    push: [[label], [label, "reel", "1"], []],
    bring: [["--now", LIGHT_FOLDER], ["--now", label], []],
    status: [[], [label]],
    retry: [[SECOND_LABEL], [label], []],
    name: [[label, "A new name"], []],
    title: [[label], [label, "--words", "A title", "--approve"], []],
    reel: [["drop", label, "1"], [label, "1", "--client-agreed"], []],
    reels: [[label, "--no-play"], []],
    ask: [[label], ["--now", LIGHT_FOLDER], []],
    finish: [[label], ["--now", LIGHT_FOLDER], []],
    release: [[label], []],
    show: [[label, "transcript"], [label, "notes"], [label, "plan"], []],
    behind: [[]],
    resolve: [[label], [label, "--keep", "B"], []],
    free: [[label, "library"], []],
    spell: [[label], [label, "add", "Jane", "Jayne"], []],
    logo: [[label, "on"], []],
    captions: [[label, "reel", "1", "on"], []],
    text: [[label], []],
    graphic: [[label], []],
    preset: [[label], []],
    cut: [[label, "remove", "--words", "x"], []],
    teachings: [[label], [label, "--transcript-only"], []],
    principles: [[label], [label, "keep", "1"], [label, "recurring", "drop", "1"], []],
    ideas: [[label], [label, "edit", "1", "--words", "x"], []],
    guide: [[], [label], [label, "show"], [label, "done", "taken"], [label, "finished"], [label, "tell"], ["drop"], ["drop", "zoom"], ["page"], ["wait"]],
    app: [[label], [label, "what-happened"], [label, "versions"], [label, "reel", "1"], [], ["2026"], ["nothing fits this"]]
  });
  it("has every command's words, so a command added later is walked", () => {
    for (const name of COMMAND_NAMES) assert.ok(name in walkWords(LABEL), `${name}: give it its words in walkWords`);
  });
  it("names it by its label in all it says, logs and writes, waiting for its answer, then as a session with teachings off and on", async () => {
    const w = await lightMac();
    for (const line of [...w.logs, ...w.notes]) assert.doesNotMatch(line, SECRET, `the import: ${line}`);
    // Her card's match is another video of the same client, not answered yet, whose own file and folder are named for the client too:
    // it is named by its label alone wherever it is named, and it is not offered (only an answered video is, in the Maybe line).
    const TARGET_LABEL = "Video of 18 Oct, 09:30 (Mac Studio)";
    clientEpisode(w.t, { folder: "2026-10-18 Coaching call Jane Doe again (Mac Studio)", video: "Coaching call Jane Doe again.mov", id: "e-20261018-0e0e0e", label: TARGET_LABEL });
    rewrite(lightFolder(w.t), { answer: { ...readEpisode(lightFolder(w.t)).record.answer, match: "e-20261018-0e0e0e" } });
    // Each command starts from the Mac as it is now: what one wrote is taken away again before the next.
    const snap = mkdtempSync(join(tmpdir(), "brimm-labels-"));
    const save = () => {
      for (const d of ["BRIMM Video", "home"]) {
        rmSync(join(snap, d), { recursive: true, force: true });
        cpSync(join(w.t.dir, d), join(snap, d), { recursive: true });
      }
    };
    const restore = () => {
      for (const d of ["BRIMM Video", "home"]) {
        rmSync(join(w.t.dir, d), { recursive: true, force: true });
        cpSync(join(snap, d), join(w.t.dir, d), { recursive: true });
      }
    };
    save();
    const short = w.id.slice(-6);
    const light = { version: 1, machine: "Mac Studio", root: w.t.root, checkout: "/checkout", import: "light" };
    const walks = [
      ["waiting for its answer", LABEL, depsOf(w.t), () => {}],
      ["a session, teachings off", SESSION, depsOf(w.t), () => rewrite(lightFolder(w.t), SESSION_OVER)],
      ["a session, teachings on", SESSION, { ...depsOf(w.t), settings: { ...light, sessionTeachings: TEACHINGS } }, () => {}]
    ];
    const seen = {};
    for (const [state, label, deps, make] of walks) {
      restore();
      make();
      save();
      for (const name of COMMAND_NAMES) {
        for (const words of walkWords(label)[name]) {
          restore();
          const before = resultsIn(w.t.home);
          const r = await on(deps, name, ...words);
          const asked = `${state}: ${[name, ...words].join(" ")}`;
          seen[asked] = r.said;
          // Of the words given, only `spell … add "Jane"` holds the secret, as Sallie might say it: the gate refuses it before it is
          // read, so nothing of it comes back either.
          assert.doesNotMatch(r.said.join("\n"), SECRET, `${asked}\n${r.said.join("\n")}`);
          for (const [file, text] of resultsIn(w.t.home)) if (before.get(file) !== text) assert.doesNotMatch(text, SECRET, `${asked}: ${file}`);
        }
      }
    }
    // The video is named by its label wherever it is named, and the answered episode beside it as today.
    const episodes = seen["waiting for its answer: episodes"];
    assert.ok(episodes.includes(`  ${LABEL}: a video waiting for your answer, of 2:00, id ${short}`), episodes.join("\n"));
    assert.ok(episodes.includes(`  ${NAME}: an episode of 0:23, in ${FOLDER}, id 3fa9c1`), episodes.join("\n"));
    assert.ok(episodes.includes(`  The library of ${LABEL} (${short}): 9 bytes`), episodes.join("\n"));
    assert.ok(!seen["waiting for its answer: open 2026"].some((line) => line.includes(LABEL)), seen["waiting for its answer: open 2026"].join("\n"));
    assert.deepEqual(seen["waiting for its answer: open nothing fits this"], [`No episode fits "nothing fits this". The episodes are: ${LABEL} (${short}), ${TARGET_LABEL} (0e0e0e) and ${FOLDER}.`]);
    // Her card's facts are printed with the video's line, and the match, not answered, is not offered; it is listed by its label.
    const at = episodes.indexOf(`  ${LABEL}: a video waiting for your answer, of 2:00, id ${short}`);
    assert.ok(/^ {4}Seen: \S/.test(episodes[at + 1]), episodes.join("\n"));
    assert.ok(episodes.includes(`  ${TARGET_LABEL}: a video waiting for your answer, of 2:00, id 0e0e0e`), episodes.join("\n"));
    assert.ok(!episodes.some((line) => line.includes("Maybe a new version of")), episodes.join("\n"));
    assert.deepEqual(seen[`waiting for its answer: release ${LABEL}`], [`This Mac does not have ${LABEL} open, so there is nothing to hand over.`]);
    assert.deepEqual(seen[`a session, teachings off: release ${SESSION}`], [`This Mac does not have ${SESSION} open, so there is nothing to hand over.`]);
    assert.ok(seen["a session, teachings off: episodes"].includes(`  ${SESSION}: a client or group session, of 2:00, id ${short}`));
    assert.ok(seen["waiting for its answer: status"].some((line) => line.startsWith(`${LABEL} (${short}): bring ended`)), seen["waiting for its answer: status"].join("\n"));
    rmSync(snap, { recursive: true, force: true });
    w.t.done();
  });
});

// --- Fix round 1 ---

const WAITING = "This video is waiting for its answer: say what it is first.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";

/** Have `fs[name]` refuse every path under `under` with EACCES, as a full disk or a folder that cannot be written does, while
    `work` runs: the ES modules' own bindings of fs follow the replacement. The error names the path, as Node's own does. */
async function refusing(name, under, work, only = () => true) {
  const real = fs[name];
  fs[name] = (path, ...rest) => {
    if (String(path).startsWith(under) && only(String(path))) throw Object.assign(new Error(`EACCES: permission denied, ${name === "mkdirSync" ? "mkdir" : "open"} '${path}'`), { code: "EACCES", errno: -13, path: String(path) });
    return real(path, ...rest);
  };
  syncBuiltinESMExports();
  try {
    return await work();
  } finally {
    fs[name] = real;
    syncBuiltinESMExports();
  }
}

/** The paths readFileSync is given while `work` runs. */
async function readsDuring(work) {
  const real = fs.readFileSync;
  const paths = [];
  fs.readFileSync = (path, ...rest) => {
    paths.push(String(path));
    return real(path, ...rest);
  };
  syncBuiltinESMExports();
  try {
    await work();
  } finally {
    fs.readFileSync = real;
    syncBuiltinESMExports();
  }
  return paths;
}

describe("a Mac whose own import is not light, beside one that imports lightly (fix 1)", () => {
  /** Sallie's laptop, with no import setting, while the Mac Studio imports lightly into the same BRIMM Video: the client's video
      filed as an episode and still in the Mac Studio's drop folder for its late check, its status saying so with its label. */
  function laptop() {
    const t = setup({ machine: "Sallie's laptop" });
    clientEpisode(t);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9w", video: VIDEO, bytes: 5, seconds: 120, step: "Waiting for its late check", at: "2026-10-20T14:59:00-05:00", label: LABEL }, writeText);
    return t;
  }
  it("names the other Mac's waiting videos by their labels, or their sizes, and never by their files", async () => {
    const t = laptop();
    failedStatus(t);
    // One held by the gated episode, whose status is gone; and one no import has seen yet, which is named as today.
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Call with Joe Bloggs.mov"), "video");
    clientEpisode(t, { folder: "2026-10-19 Call with Joe Bloggs (Mac Studio)", video: "Call with Joe Bloggs.mov", id: "e-20261019-0c0c0c", label: "Video of 19 Oct, 10:00 (Mac Studio)" });
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Pricing talk again.mov"), "video");
    const said = (await on(depsOf(t), "episodes")).said;
    const at = said.indexOf("Waiting in the drop folders:");
    assert.deepEqual(said.slice(at, at + 5), [
      "Waiting in the drop folders:",
      "  A video of 5 bytes, in the Mac Studio's drop folder, for 0 minutes: already imported as Video of 19 Oct, 10:00 (Mac Studio) (0c0c0c). It stays in the drop folder until its late check passes, or for a person to delete.",
      `  ${SECOND_LABEL}, in the Mac Studio's drop folder, for 0 minutes: its import failed on Mac Studio: the sound could not be read from the file (a file: Invalid data found when processing input). Say "try it again" to import it again.`,
      `  ${LABEL}, in the Mac Studio's drop folder, for 0 minutes: already imported as ${LABEL} (a1b2c3). It stays in the drop folder until its late check passes, or for a person to delete.`,
      "  Pricing talk again.mov, in Mac Studio's, for 0 minutes"
    ]);
    assert.doesNotMatch(said.join("\n"), /Jane|Coaching|Bloggs/);
    t.done();
  });
  it("retry names a video of its own drop folder by its label, or by its size when a gated episode holds it, and the rest as today", async () => {
    const t = setup({ machine: "Sallie's laptop" });
    const drop = join(t.root, "Unedited Video", "Sallie's laptop");
    mkdirSync(drop, { recursive: true });
    clientEpisode(t);
    for (const name of [VIDEO, SECOND, "Pricing talk again.mov"]) writeFileSync(join(drop, name), "video");
    writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 1, import: "k3j9x", video: SECOND, bytes: 5, seconds: null, step: "Reading the sound", at: AT, label: SECOND_LABEL, failed: "the sound could not be read" }, writeText);
    const r = await on(depsOf(t), "retry", "nothing fits this");
    assert.deepEqual(r.said, [`No video in this Mac's drop folder fits "nothing fits this". It holds: ${SECOND_LABEL}, a video of 5 bytes and Pricing talk again.mov.`]);
    t.done();
  });
  it("walks every command there with nothing of the client's names in what it says or writes", async () => {
    const t = setup({ machine: "Sallie's laptop" });
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED } });
    // The Mac Studio imports the client's video lightly, from its own home, into the BRIMM Video both Macs share.
    const studio = join(t.dir, "studio");
    const imported = await importLightly(t, VIDEO, { deps: { home: studio } });
    for (const line of [...imported.logs, ...imported.notes]) assert.doesNotMatch(line, SECRET, line);
    const { record } = readEpisode(lightFolder(t));
    // Its late check is still to come, so the video is in the Mac Studio's drop folder, and its status says so; a second failed
    // there, and a third is being imported.
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    writeFileSync(join(drop, VIDEO), "video");
    writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9w", video: VIDEO, bytes: 5, seconds: 120, step: "Waiting for its late check", at: "2026-10-20T14:59:00-05:00", label: LABEL }, writeText);
    failedStatus(t);
    writeFileSync(join(drop, `${STEM} part 3.mov`), "video");
    writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9z", video: `${STEM} part 3.mov`, bytes: 5, seconds: null, step: "Writing the transcript", at: "2026-10-20T14:58:00-05:00", label: "Video of 20 Oct, 14:58 (Mac Studio)" }, writeText);
    // This Mac brought its files over once, before it was a video waiting for its answer, and has a library of it.
    oldResult(t);
    library(t);
    const label = record.label;
    for (const name of COMMAND_NAMES) {
      // `kind` and `leave` would answer the video the commands after them are walked for, so they are given words that do not.
      const words = { episodes: [[]], status: [[], [label]], behind: [[]], retry: [[SECOND_LABEL], [label]], free: [[]], kind: [[label], [label, "finished"], ["nothing fits this", "raw", "--private", "no"]], leave: [["nothing fits this"], []] }[name] || [[label], ["--now", LIGHT_FOLDER], []];
      for (const given of words) {
        const before = resultsIn(t.home);
        const r = await on(depsOf(t), name, ...given);
        assert.doesNotMatch(r.said.join("\n"), SECRET, `${name} ${given.join(" ")}\n${r.said.join("\n")}`);
        for (const [file, text] of resultsIn(t.home)) if (before.get(file) !== text) assert.doesNotMatch(text, SECRET, `${name}: ${file}`);
      }
    }
    const episodes = (await on(depsOf(t), "episodes")).said;
    assert.ok(episodes.includes(`  ${LABEL}: a video waiting for your answer, of 2:00, id ${record.id.slice(-6)}`), episodes.join("\n"));
    t.done();
  });
});

describe("an error that leaves a command for a gated video (fix 2)", () => {
  it("is said through the names' filter, as the work stopping, and the command ends with 1", async () => {
    // A video marked a session, not cleared, is gated as a session is, and the gate lets `kind` run for it: the lock it takes on
    // this Mac's own disk first needs BRIMM Video Work, which cannot be made. (Its finish is refused before it makes anything, by
    // finish.js cannotFinish, which reads a mark by the gate's predicate.)
    const t = setup();
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(t, { over: MARKED_OVER });
    const r = await refusing("mkdirSync", workFolder(t.home), () => on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again"));
    assert.equal(r.code, 1);
    assert.equal(r.said[r.said.length - 1], "The work stopped (EACCES).");
    assert.doesNotMatch(r.said.join("\n"), SECRET);
    t.done();
  });
  it("leaves a command for an episode of today exactly as today: thrown", async () => {
    // A record of the switch's layout says only the work stopped, as a gated one does (final fix 20).
    const t = setup();
    episodeFor(t);
    await refusing("mkdirSync", workFolder(t.home), () => assert.rejects(on(t.ctx.deps, "finish", FOLDER), (err) => err.code === "EACCES" && err.message.includes("From Final Cut")));
    t.done();
  });
  it("ends a detached run that cannot make its folder in BRIMM Video Work with no name of the video, and no rejection", async () => {
    for (const argv of [["bring", "--now", LABEL], ["bring", "--now", LIGHT_FOLDER], ["ask", "--now", LIGHT_FOLDER]]) {
      const t = setup();
      writeSettings(t.home, { import: "light" });
      clientEpisode(t);
      mkdirSync(workFolder(t.home), { recursive: true });
      const r = await refusing("mkdirSync", workFolder(t.home), () => on(t.ctx.deps, ...argv));
      assert.deepEqual([r.code, r.said], [1, [WAITING, "The work stopped (EACCES)."]], argv.join(" "));
      t.done();
    }
  });
  it("runDetached says its own errors through `clean`: the folder it could not make, and the result it could not write", async () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-labels-run-"));
    const clean = (text) => withoutNames(text, [LIGHT_FOLDER], [], { paths: false });
    const run = (more = {}) => runDetached({ home, folder: LIGHT_FOLDER, command: "bring", alive: () => false, keepAwake: () => {}, clean, ...more }, async () => ({ ok: true, made: [], failed: [], next: "" }));
    mkdirSync(workFolder(home), { recursive: true });
    await refusing("mkdirSync", workFolder(home), () => assert.rejects(run(), (err) => err.code === "EACCES" && !SECRET.test(err.message)));
    await refusing("writeFileSync", workFolder(home), () => assert.rejects(run(), (err) => err.code === "EACCES" && !SECRET.test(err.message)), (path) => path.includes(".result.json"));
    // With no `clean`, as for every other episode, the error is Node's own, as today.
    await refusing("mkdirSync", workFolder(home), () => assert.rejects(runDetached({ home, folder: LIGHT_FOLDER, command: "bring", alive: () => false, keepAwake: () => {} }, async () => ({ ok: true })), (err) => err.message.includes(LIGHT_FOLDER)));
    rmSync(home, { recursive: true, force: true });
  });
  it("the light import's top level logs why its work on a folder stopped with no name of a video in it", async () => {
    const t = setup();
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, VIDEO), "video");
    const logs = [];
    const deps = {
      run: async () => ({ code: 1, stderr: "" }), tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "", claude: "" }, model: "/m", home: t.home, lockDir: join(t.dir, "locks"),
      settings: { version: 1, machine: "Mac Studio", root: t.root, checkout: "/checkout", import: "light" }, light: true, log: (line) => logs.push(line), wait: async () => {}, alive: () => false,
      // Something nobody foresaw, which names the video's file, stops the folder's work.
      keepAwake: () => {
        throw new Error(`${join(drop, VIDEO)} could not be kept awake`);
      }
    };
    assert.equal(await uneditedFolders([drop], deps), 1);
    assert.ok(logs.some((line) => line.startsWith("The work on this folder stopped (")), logs.join("\n"));
    for (const line of logs) assert.doesNotMatch(line, SECRET, line);
    t.done();
  });
});

describe("the names a gated video had before (fix 3)", () => {
  it("keeps a name she gave it, in its file-safe form, and the projects pushed by it, out of a session's lines", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    const folder = join(t.root, "Episodes", "2026-10-20 IMG_4411 (Mac Studio)");
    mkdirSync(join(folder, "record"), { recursive: true });
    writeFileSync(join(folder, "IMG_4411.MOV"), "video");
    const base = newEpisode({ id: "e-20261020-a1b2c3", machine: "Mac Studio", at: AT, video: { file: "IMG_4411.MOV", bytes: 5, seconds: 120, created: null }, kind: "raw", writer: { commit: "c709b57", on: "Mac Studio" }, files: { "IMG_4411.MOV": 5 }, answer: ANSWERED });
    const project = "Jane Doe- her pricing main v1 a1b2c3";
    const raw = { ...base, rev: 1, name: { text: "Jane Doe: her pricing", placeholder: false }, main: { ...base.main, pushed: [{ v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project, asked: null }] } };
    writeFileSync(recordFile(folder, 1), recordText(raw));
    writeFileSync(recordFile(folder, 2), recordText({ ...raw, ...SESSION_OVER, rev: 2 }));
    for (const name of [`${project}.mov`, `${project} 2.mov`]) writeFileSync(join(fromFinalCutFolder(t.home), name), "a finished video");
    for (const argv of [["finish", SESSION], ["release", SESSION], ["resolve", SESSION]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.doesNotMatch(r.said.join("\n"), /Jane|pricing/i, `${argv.join(" ")}\n${r.said.join("\n")}`);
    }
    t.done();
  });
});

// What a gated video's names are, as secretsOf takes them from its records, pinned directly (F3b, I-2): findEpisode resolves it
// for a command the gate keeps open, with ctx.asked set as editMain sets it, and every line the command says after holds none of
// its names. The test of "fix 3" above does not reach it any more: finish refuses a session before it names anything.
describe("the names of a gated video, taken out of every line a command says after it finds the video (F3b, I-2)", () => {
  const GIVEN = "Jane Doe: her pricing";
  const PROJECT = "Acme Corp intake main v1 a1b2c3";
  const CLIENT_FOLDER = "2026-10-20 Client intake notes (Mac Studio)";
  /** A session (or `over`) in a folder named for none of its other names: its video IMG_4411.MOV, a name she gave it once, and a
      project it was pushed to Final Cut as. Gives back what `say` says of `lines` once `command` has found it. */
  function saying(lines, { words = SESSION, over = SESSION_OVER, command = "release" } = {}) {
    const t = setup();
    const folder = join(t.root, "Episodes", CLIENT_FOLDER);
    mkdirSync(join(folder, "record"), { recursive: true });
    writeFileSync(join(folder, "IMG_4411.MOV"), "video");
    const base = newEpisode({ id: "e-20261020-a1b2c3", machine: "Mac Studio", at: AT, video: { file: "IMG_4411.MOV", bytes: 5, seconds: 120, created: null }, kind: "raw", writer: { commit: "c709b57", on: "Mac Studio" }, files: { "IMG_4411.MOV": 5 }, answer: ANSWERED });
    const raw = { ...base, rev: 1, name: { text: GIVEN, placeholder: false }, main: { ...base.main, pushed: [{ v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: PROJECT, asked: null }] } };
    writeFileSync(recordFile(folder, 1), recordText(raw));
    writeFileSync(recordFile(folder, 2), recordText({ ...raw, ...over, rev: 2 }));
    const said = saidAfterFinding(t, words, lines, command);
    t.done();
    return said;
  }
  it("takes out the name she gave it before, in its file-safe form too, the projects it was pushed as, its folder's name and its video's", () => {
    const said = saying([
      `Named ${GIVEN}.`,
      `Named ${fileSafe(GIVEN)}.`,
      `Pushed as ${PROJECT}.`,
      `Kept in ${CLIENT_FOLDER}.`,
      "Made from IMG_4411.MOV.",
      "Made from IMG_4411.",
      `${SESSION}: kept as it is.`
    ]);
    assert.deepEqual(said, [
      "Named the video.",
      "Named the video.",
      "Pushed as the video.",
      "Kept in the video.",
      "Made from the video.",
      "Made from the video.",
      `${SESSION}: kept as it is.`
    ]);
  });
  it("takes them out for a video marked a session, not cleared, whatever its kind, and for one not yet answered", () => {
    for (const over of [{ ...MARKED_OVER, label: LABEL }, { kind: null, answer: ANSWER, label: LABEL }]) {
      const said = saying([`Named ${fileSafe(GIVEN)}, pushed as ${PROJECT}, kept in ${CLIENT_FOLDER}.`], { words: LABEL, over });
      assert.deepEqual(said, ["Named the video, pushed as the video, kept in the video."], JSON.stringify(over));
    }
  });
});

describe("findEpisode takes back what its lists say (fix 4)", () => {
  it("finds a gated video by \"<label> (<short id>)\", whatever its case and spacing", () => {
    const t = setup();
    const first = clientEpisode(t);
    const second = clientEpisode(t, { folder: "2026-10-20 Intake Bob Roe (Mac Studio)", video: "Intake Bob Roe.mov", id: "e-20261020-d4e5f6" });
    const ctx = ctxOf(t);
    assert.equal(findEpisode(ctx, LABEL).why, `More than one episode fits "${LABEL}": ${LABEL} (d4e5f6) and ${LABEL} (a1b2c3). Say which.`);
    assert.equal(findEpisode(ctx, `${LABEL} (a1b2c3)`).name, first.name);
    assert.equal(findEpisode(ctx, ` video of 20 oct,  15:00 (mac studio) (D4E5F6)`).name, second.name);
    t.done();
  });
});

describe("resolve, for a gated video (fix 5)", () => {
  it("says only which of its fields differ, but for who has it open, its finish, its hand-over, how far it was shown and its files' sizes", async () => {
    const t = setup();
    const e = clientEpisode(t, { over: { ...SESSION_OVER, title: { text: "Jane says no to the discount", from: "claude", approved: false }, spellings: [["jane", "Jane"]] } });
    conflictedRecord(e.folder, { title: { text: "Jane's other title", from: "person", approved: true }, spellings: [["jane", "Jayne"]], editing: { by: "Sallie's laptop", since: AT } });
    const r = await on(t.ctx.deps, "resolve", SESSION);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.ok(r.said.includes("  Who has it open: A: nobody; B: Sallie's laptop"), r.said.join("\n"));
    assert.ok(r.said.includes("  Title: they differ."), r.said.join("\n"));
    assert.ok(r.said.includes("  Spellings: they differ."), r.said.join("\n"));
    assert.doesNotMatch(r.said.join("\n"), /Jane|Jayne|discount/);
    t.done();
  });
});

describe("a gated video is found by its label and ids alone (fix 6)", () => {
  it("is never found by words in its folder or its name, by a command or by status", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    clientEpisode(t);
    oldResult(t);
    const release = await on(depsOf(t), "release", "jane");
    assert.deepEqual(release.said, [`No episode fits "jane". The episodes are: ${LABEL} (a1b2c3).`]);
    failedStatus(t);
    assert.deepEqual((await on(depsOf(t), "status", "jane")).said, ["Nothing is running, and nothing is waiting."]);
    // By its label, status finds both.
    assert.equal((await on(depsOf(t), "status", SECOND_LABEL)).said.length, 2);
    t.done();
  });
});

describe("the say filter's names (fix 7)", () => {
  it("leaves the gate's words and the tool's own whole for a video whose file is named 1, a, Main or Session", async () => {
    for (const stem of ["1", "a", "Main", "Session"]) {
      const t = setup();
      writeSettings(t.home, { import: "light" });
      clientEpisode(t, { folder: `2026-10-20 ${stem} (Mac Studio)`, video: `${stem}.mov` });
      assert.deepEqual((await on(t.ctx.deps, "open", LABEL)).said, [WAITING], stem);
      assert.deepEqual((await on(t.ctx.deps, "release", LABEL)).said, [`This Mac does not have ${LABEL} open, so there is nothing to hand over.`], stem);
      t.done();
      const u = setup();
      clientEpisode(u, { folder: `2026-10-20 ${stem} (Mac Studio)`, video: `${stem}.mov`, over: SESSION_OVER });
      assert.deepEqual((await on(u.ctx.deps, "open", SESSION)).said, [NOT_FOR_SESSION], stem);
      u.done();
    }
  });
  it("leaves a path that is not the video's readable, and keeps the net on for a session whose name is its file's", async () => {
    // A session whose name is its file's: its own finish (F7) refuses it at once on a Mac that hands off version 1, naming nothing;
    // and under version 2 for that name, naming nothing either (F7 fix 1).
    const t = setup();
    writeSettings(t.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(t, { over: { ...SESSION_OVER, name: { text: STEM, placeholder: true } } });
    const refused = await on(t.ctx.deps, "finish", LABEL);
    assert.deepEqual([refused.code, refused.said], [1, ["A session's hand-off is written once this Mac hands off version 2: ask Jason."]]);
    writeSettings(t.home, { handoffVersion: 2 });
    const unread = await on(t.ctx.deps, "finish", LABEL);
    assert.deepEqual([unread.code, unread.said], [1, ["This session's name is the name of its video's file: give it another name first. Nothing was written."]]);
    // A video marked a session, not cleared, whose name is its file's: a command the gate keeps open that says a path of this Mac's
    // own, and the name of the file, says the path whole and the name as "the video".
    const u = setup();
    writeSettings(u.home, { import: "light", sessionTeachings: TEACHINGS });
    clientEpisode(u, { over: { ...MARKED_OVER, name: { text: STEM, placeholder: true } } });
    const said = saidAfterFinding(u, LABEL, [`Looked in ${fromFinalCutFolder(u.home)} for ${STEM}.`, `${LABEL}: kept.`]);
    assert.deepEqual(said, [`Looked in ${fromFinalCutFolder(u.home)} for the video.`, `${LABEL}: kept.`]);
    t.done();
    u.done();
  });
});

describe("shownName fails closed (fix 9)", () => {
  const base = newEpisode({ id: "e-20261020-a1b2c3", machine: "Mac Studio", at: AT, video: { file: VIDEO, bytes: 5, seconds: 120, created: null }, kind: "raw", writer: { commit: "c", on: "Mac Studio" }, answer: ANSWERED, label: LABEL });
  const marked = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
  it("names a record of another kind with a session mark not cleared by its label, or as a session by its short id", () => {
    assert.equal(shownName({ ...base, session: marked }), LABEL);
    assert.equal(shownName({ ...base, label: undefined, session: marked }), "a client or group session (a1b2c3)");
    assert.equal(shownName({ ...base, session: { ...marked, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } }), STEM);
  });
  it("never names a session by a name that is still its file's", () => {
    assert.equal(shownName({ ...base, ...SESSION_OVER, name: { text: STEM, placeholder: true } }), LABEL);
    assert.equal(shownName({ ...base, ...SESSION_OVER, label: undefined, name: { text: STEM, placeholder: false } }), "a client or group session (a1b2c3)");
  });
});

describe("the edges of fix round 1 (fix 10)", () => {
  it("names the folder of a detached run whose episode is gone by its day and Mac alone", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED } });
    for (const command of ["bring", "ask", "finish"]) {
      const r = await on(t.ctx.deps, command, "--now", LIGHT_FOLDER);
      assert.deepEqual(r.said, [`No episode fits an episode of 2026-10-20 from the Mac Studio whose record cannot be read. The episodes are: ${FOLDER}.`], command);
    }
    t.done();
  });
  it("reads no record of a gated video's history that is not whole on this Mac", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const e = clientEpisode(t);
    rewrite(e.folder, { label: LABEL });
    const reads = await readsDuring(() => on({ ...t.ctx.deps, isWhole: (path) => !path.endsWith("/record/0001.json") }, "release", LABEL));
    assert.ok(!reads.some((path) => path.endsWith("/record/0001.json")), reads.join("\n"));
    t.done();
  });
});
