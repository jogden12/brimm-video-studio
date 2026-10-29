// `app "<episode>" what-happened` and `app "<episode>" versions`: what was done in the HyperFrames app, from Sallie's chat (plan PR 6;
// architecture 2026-10-27, sections 4.1 step 9, 4.6, 6.2 and 6.3). edit.js is only the wiring here: it takes the verb after the
// episode's words, finds the episode through the gate, says a finished video has no project and that this Mac is not set up (and,
// for `versions`, has no command line), and gives the episode to app-history.js, which tests/app-history.test.js tests on its own.
// These tests run all of it through editMain, with the stand-in for the pinned command line (tests/stand-ins/hyperframes.mjs), so no
// test runs HyperFrames, the app, HeyGen or `claude`. The project each looks at is the one `app` made, with the app's history put
// in it as the app would have written it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { NOT_SET_UP } from "../app.js";
import { HELD } from "../gate.js";
import { PIN } from "../hyperframes.js";
import { episodeWork, writeSettings } from "../settings.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { FOLDER, NAME, episodeAs, listAll, reread } from "./episodes.js";
import { episode } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const fixture = (name) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/${name}`, import.meta.url), "utf8");
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";
const NEW_YORK = "America/New_York";
/** The morning after the day of the history fixtures (27 October, in New York). */
const NEXT_DAY = Date.parse("2026-10-28T12:00:00-04:00");
const FORMS = ["what-happened", "versions"];

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs/;
/** `app` as Claude runs it; and a check that every line it said, whichever way it ended, is plain. */
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
const PINNED_ENV = ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];

const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
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
const NO_PROJECT = `${NAME} was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames.`;
const NOTHING = `Nothing has been done in HyperFrames on ${NAME} yet.`;
const NO_VERSIONS = `${NAME} has no versions in HyperFrames yet.`;
const CANNOT = "I can't list the versions right now; HyperFrames shows its history.";
const WORKING_COPY = "the working copy's bytes";
const THREE = [
  "4:05 pm: you asked What font is the title in?; HyperFrames did It's Josefin Sans, medium weight.",
  "3:52 pm: you asked Add the BRIMM logo in the bottom right corner for the whole video; HyperFrames did I added the logo at the bottom right and kept it on for the whole video.; changed logo.html, brimm-logo.png",
  "3:41 pm: you asked Make the title bigger and move it up a little; HyperFrames did I made the title larger and moved it up about 40 pixels.; changed index.html"
];
const SIX = [
  "4:12 pm: Undid: Make the title bigger and move it up a little (HyperFrames; changed index.html)",
  "4:07 pm: Imported media (you; changed theme-song.mp3)",
  "4:06 pm: Changed outside the app (outside HyperFrames; changed recording.transcript.json)",
  "3:52 pm: recording.mp4 Add the BRIMM logo in the bottom right corner for the whole video (HyperFrames; kept; changed logo.html, brimm-logo.png)",
  "3:47 pm: 1. Remove “um,”: Cut recording.mp4 from 12.4s to 12.8s so the take is clean. (HyperFrames; changed index.html)",
  "3:41 pm: Make the title bigger and move it up a little (HyperFrames; undone; changed index.html)"
];

/** The made-up recording (phase4.js), answered as `record` says, on a Mac set up for the app (`set`) whose working copy is made, with
    the stand-in for the pinned command line given to `app`, answering `history` as `history` says. `tz` is the zone the times are
    told in. */
function world({ set = true, record = RAW, history = "entries" } = {}) {
  const { t, found } = episode(record);
  if (set) writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened", history }));
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, WORKING_COPY);
  writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: WORKING_COPY.length }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE, tz: NEW_YORK };
  return { t, found, work: episodeWork(t.home, FOLDER) };
}
/** The deps of a command asked on the morning after the fixtures' day. */
const later = (t) => ({ ...t.ctx.deps, now: () => NEXT_DAY });
/** Open the episode once, as she does, so that its project is made and recorded; the project's folder and the stand-in's runs so far. */
async function opened(w) {
  const r = await app(w.t.ctx.deps, FOLDER);
  assert.equal(r.code, 0, r.text);
  const [project] = reread(w.found).app.projects;
  return { dir: join(w.work, project.name), project };
}
/** Put the app's history in a project as the app writes it: its turns, and the id its store is kept under. */
function recordedIn(dir, { turns = fixture("app-history.jsonl"), id = true } = {}) {
  mkdirSync(join(dir, ".hyperframes"), { recursive: true });
  if (turns !== null) writeFileSync(join(dir, ".hyperframes", "app-history.jsonl"), turns);
  if (id) writeFileSync(join(dir, ".hyperframes", "history-id"), "c5039b1a-c117-4f32-a8f5-e73e6804dbbe\n");
}
/** What a command must leave as it was: the record whole, this Mac's work folder, the episode's folder, and everything started. */
const state = (w) => ({ record: reread(w.found), work: listAll(w.work), folder: listAll(w.found.folder), waits: w.t.waits, started: w.t.started, runs: runsOf(w.t) });

describe("app … what-happened and app … versions: the usages", () => {
  it("are in the help, after the usage of app, with their descriptions at the column the others have, and are no commands of their own", () => {
    const lines = HELP.split("\n");
    for (const [form, words] of [["what-happened", /^ {40}what was done in HyperFrames on the episode's main video, newest first/], ["versions", /^ {40}the versions HyperFrames has kept of the episode's main video, newest first/]]) {
      const at = lines.indexOf(`  node edit.js app "<episode>" ${form}`);
      assert.ok(at > lines.indexOf('  node edit.js app "<episode>" [--take-over]'), `${form} comes after app`);
      assert.match(lines[at + 1], words);
      assert.ok(at < lines.findIndex((line) => line.startsWith('  node edit.js push "<episode>" [main]')), `${form} comes before push`);
    }
    assert.ok(!COMMAND_NAMES.includes("what-happened") && !COMMAND_NAMES.includes("versions"));
    assert.ok(COMMAND_NAMES.includes("app"));
  });
});

describe("app … what-happened and app … versions: the verb", () => {
  it("is the last word, when another comes before it, quoted or not, and each form runs its own", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir);
    for (const words of [[FOLDER, "what-happened"], [...FOLDER.split(" "), "what-happened"]]) {
      const r = await app(later(w.t), ...words);
      assert.deepEqual([r.code, r.said[0]], [0, `What was done in HyperFrames on ${NAME}, newest first:`], words.join("|"));
    }
    for (const words of [[FOLDER, "versions"], [...FOLDER.split(" "), "versions"]]) {
      const r = await app(later(w.t), ...words);
      assert.deepEqual([r.code, r.said[0]], [0, `The versions of ${NAME} in HyperFrames, newest first:`], words.join("|"));
    }
    w.t.done();
  });
  it("is the episode's words when it is the only word, so that `app versions` looks for an episode of that name and opens nothing", async () => {
    const w = world();
    const before = state(w);
    for (const verb of FORMS) {
      const r = await app(w.t.ctx.deps, verb);
      assert.equal(r.code, 1);
      assert.match(r.said[0], new RegExp(`^No episode fits "${verb}"\\.`));
    }
    assert.deepEqual(state(w), before);
    w.t.done();
  });
  it("is no verb anywhere but last: `app <episode> versions <more>` is an episode of those words, which fits none", async () => {
    const w = world();
    const r = await app(w.t.ctx.deps, FOLDER, "versions", "please");
    assert.equal(r.code, 1);
    assert.match(r.said[0], /^No episode fits "2026-10-14 Pricing talk \(Mac Studio\) versions please"\./);
    w.t.done();
  });
  it("leaves `app <episode>` as it was: it opens", async () => {
    const w = world();
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual(r.said, ["It's open in HyperFrames.", "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes."]);
    w.t.done();
  });
});

describe("app … what-happened and app … versions: the gate asks first, in its own words", () => {
  for (const form of FORMS) {
    it(`refuses ${form} for a video not yet answered, a video left alone and a session not cleared, whether or not this Mac is set up, and does nothing`, async () => {
      for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [LEFT_RECORD, LEFT_ALONE], [SESSION_RECORD, NOT_FOR_SESSION]]) {
        for (const set of [true, false]) {
          const w = world({ record, set });
          const before = state(w);
          const r = await app(w.t.ctx.deps, FOLDER, form);
          assert.deepEqual([r.code, r.said], [1, [why]], `${record.label} ${set}`);
          assert.deepEqual(state(w), before, `${record.label} ${set}`);
          // It names no episode: not its folder, its name or its video's file.
          for (const given of [FOLDER, "Pricing", "talk", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
          w.t.done();
        }
      }
    });
    it(`refuses ${form} for a session whether this Mac's training gate is on or off: app is in no list`, async () => {
      const w = world({ record: SESSION_RECORD });
      const taught = { ...w.t.ctx.deps, settings: { ...w.t.ctx.settings, app: "hyperframes", sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
      const r = await app(taught, FOLDER, form);
      assert.deepEqual([r.code, r.said, runsOf(w.t)], [1, [NOT_FOR_SESSION], []]);
      w.t.done();
    });
    it(`refuses ${form} for a video held beside a session, as every command outside the first list is`, async () => {
      const OLD = "e-20261010-a0a0a0";
      const w = world({ record: { ...RAW, versionOf: OLD } });
      episodeAs(w.t, { id: OLD, name: "2026-10-10 Coaching call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-10", name: { text: "Session, 2026-10-10", placeholder: false }, session: SESSION_MARK } });
      const r = await app(w.t.ctx.deps, FOLDER, form);
      assert.deepEqual([r.code, r.said, runsOf(w.t)], [1, [HELD], []]);
      w.t.done();
    });
    it(`runs ${form} for an answered raw video, an iPhone clip and a session whose mark was cleared`, async () => {
      for (const [what, record] of [["a raw video", RAW], ["an iPhone clip", { ...RAW, kind: "short video" }], ["a session whose mark was cleared", CLEARED_RECORD]]) {
        const w = world({ record });
        const r = await app(w.t.ctx.deps, FOLDER, form);
        assert.deepEqual([r.code, r.said], [0, [form === "versions" ? NO_VERSIONS : NOTHING]], what);
        w.t.done();
      }
    });
    it(`says a finished video has no project for ${form}, in app's words, and does nothing, whether or not this Mac is set up`, async () => {
      for (const set of [true, false]) {
        const w = world({ record: { ...RAW, kind: "finished" }, set });
        const before = state(w);
        const r = await app(w.t.ctx.deps, FOLDER, form);
        assert.deepEqual([r.code, r.said], [1, [NO_PROJECT]], String(set));
        assert.deepEqual(state(w), before, String(set));
        w.t.done();
      }
    });
  }
});

describe("app … what-happened and app … versions: this Mac must be set up, and versions needs the command line", () => {
  it("says this Mac isn't set up for HyperFrames, past the gate, for both, and does nothing", async () => {
    for (const settings of [{}, { app: "off" }]) {
      for (const form of FORMS) {
        const w = world({ set: false });
        writeSettings(w.t.home, settings);
        const before = state(w);
        const r = await app(w.t.ctx.deps, FOLDER, form);
        assert.deepEqual([r.code, r.said], [1, [NOT_SET_UP]], `${form} ${JSON.stringify(settings)}`);
        assert.deepEqual(state(w), before);
        w.t.done();
      }
    }
  });
  it("says the command line isn't on this Mac for versions, and not for what-happened, which reads a file", async () => {
    const w = world();
    delete w.t.ctx.deps.app;
    const before = state(w);
    const versions = await app(w.t.ctx.deps, FOLDER, "versions");
    assert.deepEqual([versions.code, versions.said], [1, [NO_COMMAND_LINE]]);
    const happened = await app(w.t.ctx.deps, FOLDER, "what-happened");
    assert.deepEqual([happened.code, happened.said], [0, [NOTHING]]);
    assert.deepEqual(state(w), before);
    w.t.done();
  });
});

describe("app … what-happened and app … versions: they claim nothing and write nothing", () => {
  it("are not refused by the other Mac's claim, which they do not make, and ignore --take-over", async () => {
    for (const form of FORMS) {
      for (const more of [[], ["--take-over"]]) {
        const w = world({ record: { ...RAW, editing: HERS } });
        const before = state(w);
        const r = await app(w.t.ctx.deps, FOLDER, form, ...more);
        assert.deepEqual([r.code, r.said], [0, [form === "versions" ? NO_VERSIONS : NOTHING]], `${form} ${more.join(" ")}`);
        assert.deepEqual(state(w), before, `${form} ${more.join(" ")}`);
        assert.equal(reread(w.found).editing.by, "Sallie's laptop");
        w.t.done();
      }
    }
  });
  it("neither wait for a claim, bring a file, ask for a working copy nor write a record, once the project is there", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir);
    const before = { ...state(w), project: listAll(dir) };
    for (const form of FORMS) {
      const r = await app(later(w.t), FOLDER, form);
      assert.equal(r.code, 0, form);
    }
    const after = { ...state(w), project: listAll(dir) };
    // The stand-in was asked for the listing, and wrote down how, which is all that changed.
    assert.deepEqual({ ...after, runs: after.runs.slice(0, before.runs.length) }, before);
    assert.equal(after.runs.length, before.runs.length + 1);
    assert.deepEqual([after.record.rev, after.waits, after.started], [before.record.rev, before.waits, before.started]);
    w.t.done();
  });
});

describe("app … what-happened: what was done in the app", () => {
  const HEAD = `What was done in HyperFrames on ${NAME}, newest first:`;
  it("tells the turns in the app's history file newest first, under the day they happened", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir);
    const r = await app(later(w.t), FOLDER, "what-happened");
    assert.deepEqual([r.code, r.said], [0, [HEAD, "Yesterday:", ...THREE.map((line) => `  ${line}`)]]);
    w.t.done();
  });
  it("tells the time in the Mac's own zone when none is given, and the day by the clock it is run on", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir);
    delete w.t.ctx.deps.app.tz;
    const r = await app({ ...w.t.ctx.deps, now: () => Date.parse("2026-10-27T23:00:00Z") }, FOLDER, "what-happened");
    assert.equal(r.code, 0);
    assert.equal(r.said.length, 5);
    assert.match(r.said[1], /^(Today|Yesterday|Tuesday 27 October|Wednesday 28 October):$/);
    assert.match(r.said[2], /^ {2}\d{1,2}:\d\d (am|pm): you asked What font is the title in\?/);
    w.t.done();
  });
  it("tells the newest 10 of many, and how many earlier ones are not shown", async () => {
    const w = world();
    const { dir } = await opened(w);
    const turns = Array.from({ length: 13 }, (_, n) => JSON.stringify({ at: new Date(Date.parse("2026-10-27T15:00:00.000Z") + n * 60000).toISOString(), engine: "claude", asked: `ask ${n}`, did: `did ${n}`, files: [] })).join("\n");
    recordedIn(dir, { turns });
    const r = await app(later(w.t), FOLDER, "what-happened");
    assert.equal(r.code, 0);
    assert.deepEqual([r.said.length, r.said[r.said.length - 1]], [13, "3 earlier requests are not shown."]);
    w.t.done();
  });
  it("says nothing has been done yet, with 0, until the app has written a turn: a project just made, a folder and no file, an empty file", async () => {
    const w = world();
    const { dir } = await opened(w);
    for (const [what, make] of [["a project just made", () => {}], ["a folder and no file", () => mkdirSync(join(dir, ".hyperframes"), { recursive: true })], ["an empty file", () => recordedIn(dir, { turns: "" })]]) {
      make();
      const r = await app(later(w.t), FOLDER, "what-happened");
      assert.deepEqual([r.code, r.said], [0, [NOTHING]], what);
    }
    w.t.done();
  });
  it("says nothing has been done yet when she has not opened the episode in HyperFrames at all, and reads and runs nothing", async () => {
    const w = world();
    const before = state(w);
    const r = await app(w.t.ctx.deps, FOLDER, "what-happened");
    assert.deepEqual([r.code, r.said], [0, [NOTHING]]);
    assert.deepEqual(state(w), before);
    w.t.done();
  });
  it("tells a turn that has a path, a link and a flag in it without them, and says nothing a person could not read", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir, { turns: [
      JSON.stringify({ at: "2026-10-27T19:41:08.000Z", engine: "claude", asked: "Put assets/logos/a.png at the top --now", did: "Done: see [the logo](file:///Users/x/Work/a.png) and **the title**.", files: ["compositions/sub/intro.html", "/abs/path/x.css"] }),
      JSON.stringify({ at: "2026-10-27T19:52:30.000Z", engine: "claude", asked: "Run npx hyperframes check", did: "Ran node and it passed.", files: [] })
    ].join("\n") });
    const r = await app(later(w.t), FOLDER, "what-happened");
    // The second turn is all commands, so it says nothing and is not counted.
    assert.deepEqual(r.said.slice(2), ["  3:41 pm: you asked Put a.png at the top; HyperFrames did Done: see the logo and the title.; changed intro.html, x.css"]);
    w.t.done();
  });
});

describe("app … versions: the versions HyperFrames has kept", () => {
  const HEAD = `The versions of ${NAME} in HyperFrames, newest first:`;
  it("tells the entries the command line lists newest first, under the day they happened, and asks for them once, as it is run", async () => {
    const w = world();
    const { dir } = await opened(w);
    recordedIn(dir);
    const r = await app(later(w.t), FOLDER, "versions");
    assert.deepEqual([r.code, r.said], [0, [HEAD, "Yesterday:", ...SIX.map((line) => `  ${line}`)]]);
    const runs = runsOf(w.t);
    assert.deepEqual(runs.map((run) => run.args[0]), ["open", "history"]);
    assert.deepEqual(runs[1], { args: ["history", "--json", "--limit", "20", "--dir", dir], env: PINNED_ENV });
    w.t.done();
  });
  it("hands nothing over, whatever this Mac's setting and the chat: the command line gets no chat's id", async () => {
    const w = world();
    writeSettings(w.t.home, { appHandover: true });
    // Opened, the chat is handed over (this Mac's setting is on and the chat holds no session's words); listed, it is not.
    w.t.ctx.deps.app.chat = () => ({ sessionId: CHAT, held: false });
    const { dir } = await opened(w);
    recordedIn(dir);
    assert.ok(runsOf(w.t)[0].env.includes("CLAUDE_CODE_SESSION_ID"), "the open is handed the chat");
    const r = await app({ ...later(w.t), env: { LANG: "en_US.UTF-8", CLAUDE_CODE_SESSION_ID: CHAT } }, FOLDER, "versions");
    assert.equal(r.code, 0);
    assert.deepEqual(runsOf(w.t).at(-1).env, PINNED_ENV);
    w.t.done();
  });
  it("says there are no versions yet, with 0, when the command line lists none or the app has recorded no history, and then does not run it", async () => {
    const empty = world({ history: "empty" });
    const { dir } = await opened(empty);
    recordedIn(dir);
    const none = await app(later(empty.t), FOLDER, "versions");
    assert.deepEqual([none.code, none.said, runsOf(empty.t).at(-1).args[0]], [0, [NO_VERSIONS], "history"]);
    empty.t.done();
    const bare = world();
    const made = await opened(bare);
    const runs = runsOf(bare.t).length;
    const before = listAll(made.dir);
    const r = await app(later(bare.t), FOLDER, "versions");
    assert.deepEqual([r.code, r.said, runsOf(bare.t).length, listAll(made.dir)], [0, [NO_VERSIONS], runs, before]);
    bare.t.done();
  });
  it("says it cannot list the versions right now, with 0, when the command line refuses or prints what is not JSON", async () => {
    for (const history of ["fails", "garbled"]) {
      const w = world({ history });
      const { dir } = await opened(w);
      recordedIn(dir);
      const r = await app(later(w.t), FOLDER, "versions");
      assert.deepEqual([r.code, r.said], [0, [CANNOT]], history);
      w.t.done();
    }
  });
});

describe("app … what-happened and app … versions: the README", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const rowOf = (start) => readme.split("\n").filter((line) => line.startsWith(start));
  it("has a row for each, in the form the help gives, that says the words she reads and what it does not do", () => {
    const [happened, ...more] = rowOf('| `app "<episode>" what-happened` |');
    const [versions, ...moreToo] = rowOf('| `app "<episode>" versions` |');
    assert.ok(happened && versions, "the README has a row for each");
    assert.deepEqual([more, moreToo], [[], []]);
    for (const [row, words] of [
      [happened, ["Nothing has been done in HyperFrames on <name> yet.", "claims the episode for no Mac, brings no file, asks for no working copy and writes no record", "`--take-over` is not read", "the last megabyte", "the newest 10 turns", "cut at 200 characters at a word", "Ask Jason."]],
      [versions, ["<name> has no versions in HyperFrames yet.", "I can't list the versions right now; HyperFrames shows its history.", "These are the newest 20; HyperFrames shows any older ones.", "`history --json --limit 20 --dir <project>`", "with no chat's id whatever this Mac's setting", "`.hyperframes/history-id`", "Studio changes no history"]]
    ]) {
      for (const given of words) assert.ok(row.includes(given), given);
    }
    // They come right after the row of `app`, which opens the episode.
    const rows = readme.split("\n");
    const opens = rows.findIndex((line) => line.startsWith('| `app "<episode>" [--take-over]` |'));
    assert.deepEqual([rows[opens + 1] === happened, rows[opens + 2] === versions], [true, true]);
  });
});

describe("app … what-happened and app … versions: a project on another Mac", () => {
  const THERE = (on) => `The HyperFrames project for ${NAME} is on ${on}, with everything done in it, so there is nothing to look at on this Mac. Ask Jason.`;
  const madeOn = (on) => ({
    ...RAW, version: 4,
    app: { toolchain: PIN.version, projects: [{
      key: "main", name: "Pricing- what to charge- main 3fa9c1", madeAt: "2026-10-19T10:00:00-05:00", on, from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
      workingCopy: { bytes: WORKING_COPY.length, seconds: 23.423, fps: 30 }, opened: ["2026-10-19T10:05:00-05:00"], handover: false, fromSuggestion: null, state: "opened"
    }] }
  });
  it("is said, naming that Mac, with 1, and nothing is run, claimed or written, with or without the other Mac's claim", async () => {
    for (const form of FORMS) {
      for (const extra of [{}, { editing: HERS }]) {
        const w = world({ record: { ...madeOn("Sallie's laptop"), ...extra } });
        const before = state(w);
        const r = await app(w.t.ctx.deps, FOLDER, form);
        assert.deepEqual([r.code, r.said], [1, [THERE("Sallie's laptop")]], form);
        assert.deepEqual(state(w), before, form);
        w.t.done();
      }
    }
  });
  it("is looked at when its folder is here, whichever Mac made it", async () => {
    const w = world({ record: madeOn("Sallie's laptop") });
    recordedIn(join(w.work, "Pricing- what to charge- main 3fa9c1"));
    const r = await app(later(w.t), FOLDER, "what-happened");
    assert.deepEqual([r.code, r.said.length], [0, 5]);
    w.t.done();
  });
});
