// The gate in edit.js: every command that names an episode is checked against the episode's record before the command reads or
// does anything else, for a video not yet answered and for a client or group session whose mark is not cleared. Nothing here
// runs a real program or touches Dropbox: the root is made for each test, and the programs are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { COMMAND_NAMES, contextFor, editMain, findEpisode } from "../edit.js";
import { UNANSWERED, UNSCOPED } from "../gate.js";
import { RECORD_VERSION, readEpisode, recordFile, recordText } from "../episode.js";
import { lockOf, readResult } from "../detached.js";
import { setup, episodeFor, reread, listAll, FOLDER, ID } from "./episodes.js";
import { episode } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, text, said }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const AT = "2026-10-20T15:00:00-05:00";
const WAITING = "This video is waiting for its answer: say what it is first.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const REEL_NOT_AGREED = "A Reel is cut from a session only once you have noted the client's agreement.";
const REFUSALS = [WAITING, NOT_FOR_SESSION, TEACHINGS_OFF, REEL_NOT_AGREED];

const ANSWER = { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "yes" };
/** The record of a video not yet answered, a session whose mark is not cleared, one that is cleared, and a finished video. */
const UNANSWERED_RECORD = { version: 3, kind: null, answer: ANSWER, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
const SESSION_RECORD = { version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-20", session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
const CLEARED_RECORD = { ...SESSION_RECORD, session: { ...SESSION_RECORD.session, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } };
const FINISHED_RECORD = { version: 3, kind: "finished", answer: ANSWERED };
const LEFT_RECORD = { version: 3, kind: null, answer: { ...ANSWER, state: "not for brimm-video" }, label: "Video of 20 Oct, 15:00 (Mac Studio)" };

/** This Mac's deps with the training gate turned on, as Jason's check of both accounts leaves it, a few days before the clock. */
const taught = (t) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } });

/** What each command is given to name the made-up episode, as Claude runs it. `free` names none: it says it is held back. */
const ASKED = {
  open: [FOLDER], push: [FOLDER], bring: ["--now", FOLDER], name: [FOLDER, "A new name"], title: [FOLDER], reel: ["pick", FOLDER, "1"], reels: [FOLDER, "--no-play"],
  ask: [FOLDER], finish: [FOLDER], release: [FOLDER], show: [FOLDER, "transcript"], resolve: [FOLDER], spell: [FOLDER], logo: [FOLDER, "on"],
  captions: [FOLDER, "reel", "1", "on"], text: [FOLDER], graphic: [FOLDER], preset: [FOLDER], cut: [FOLDER, "remove", "--words", "x"]
};
const NAMES_NO_EPISODE = ["free"];
/** The commands that name an episode, each of COMMAND_NAMES but those that name none. */
const SCOPED = COMMAND_NAMES.filter((name) => !UNSCOPED.includes(name) && !NAMES_NO_EPISODE.includes(name));

/** The paths readFileSync is given while `work` runs. The ES modules' own bindings of fs follow the replacement. */
async function readDuring(work) {
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

/** Every file in the episode's folder, at any depth, as paths from it. */
const filesIn = (found) => listAll(found.folder);

describe("the gate walks every command that names an episode", () => {
  it("has the argv of every such command here, so that a command added later is walked", () => {
    for (const name of SCOPED) assert.ok(name in ASKED, `${name} names an episode: give it its words in ASKED, or the gate is not tried on it`);
  });
  it("refuses each but the first list's for a video not yet answered, in its words, with 1, and starts nothing", async () => {
    for (const name of SCOPED) {
      const t = setup();
      const found = episodeFor(t, { record: UNANSWERED_RECORD });
      const before = filesIn(found);
      const r = await on(taught(t), name, ...ASKED[name]);
      if (UNANSWERED.includes(name)) assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
      else {
        assert.deepEqual([r.code, r.said], [1, [WAITING]], name);
        assert.deepEqual([t.started, t.calls, reread(found).rev, filesIn(found)], [[], [], 1, before], name);
      }
      t.done();
    }
  });
  it("refuses a video left alone ('not for brimm-video') as it does one waiting", async () => {
    for (const name of SCOPED.filter((n) => !UNANSWERED.includes(n))) {
      const t = setup();
      episodeFor(t, { record: LEFT_RECORD });
      const r = await on(t.ctx.deps, name, ...ASKED[name]);
      assert.deepEqual([r.code, r.said], [1, [WAITING]], name);
      t.done();
    }
  });
  it("refuses each but the second list's for a session whose mark is not cleared, with teachings off, and starts nothing", async () => {
    for (const name of SCOPED) {
      const t = setup();
      const found = episodeFor(t, { record: SESSION_RECORD });
      const before = filesIn(found);
      const r = await on(t.ctx.deps, name, ...ASKED[name]);
      if (["show", "release", "resolve", "name"].includes(name)) assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
      else {
        const why = ["finish", "reel"].includes(name) ? TEACHINGS_OFF : NOT_FOR_SESSION;
        assert.deepEqual([r.code, r.said], [1, [why]], name);
        assert.deepEqual([t.started, t.calls, reread(found).rev, filesIn(found)], [[], [], 1, before], name);
      }
      t.done();
    }
  });
  it("refuses a session's finish and reel in the words of the training gate while this Mac's is off, and lets finish through once it is on", async () => {
    const t = setup();
    episodeFor(t, { record: SESSION_RECORD });
    assert.deepEqual((await on(t.ctx.deps, "finish", FOLDER)).said, [TEACHINGS_OFF]);
    const finish = await on(taught(t), "finish", FOLDER);
    assert.ok(!REFUSALS.some((why) => finish.text.includes(why)), finish.text);
    t.done();
  });
  it("refuses a session's reel pick and drop, today's reel, with teachings on, as a Reel she has not agreed to", async () => {
    const t = setup();
    episodeFor(t, { record: SESSION_RECORD });
    for (const words of [["pick", FOLDER, "1"], ["drop", FOLDER, "1"]]) {
      assert.deepEqual((await on(taught(t), "reel", ...words)).said, [REEL_NOT_AGREED], words.join(" "));
    }
    t.done();
  });
  it("lets a session through the commands of its list, with teachings on or off", async () => {
    for (const name of ["show", "release", "resolve", "name"]) {
      for (const deps of [(t) => t.ctx.deps, taught]) {
        const t = setup();
        episodeFor(t, { record: SESSION_RECORD });
        const r = await on(deps(t), name, ...ASKED[name]);
        assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
        t.done();
      }
    }
  });
  it("lets a finished video, a record from before the switch and a cleared session through every command", async () => {
    for (const [what, record] of [["finished", FINISHED_RECORD], ["kind episode", {}], ["kind short video", { kind: "short video" }], ["cleared session", CLEARED_RECORD]]) {
      for (const name of SCOPED) {
        const { t } = episode(record);
        const r = await on(t.ctx.deps, name, ...ASKED[name]);
        assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${what} ${name}: ${r.text}`);
        t.done();
      }
    }
  });
  it("leaves the commands that name no episode, and free, alone", async () => {
    const t = setup();
    episodeFor(t, { record: UNANSWERED_RECORD });
    const free = await on(t.ctx.deps, "free", FOLDER, "library");
    assert.ok(!REFUSALS.some((why) => free.text.includes(why)), free.text);
    for (const ask of [["episodes"], ["status"], ["status", FOLDER], ["status", "Pricing"], ["behind"]]) {
      const r = await on({ ...t.ctx.deps, run: async () => ({ code: 0, stderr: "", stdout: "0\n" }) }, ...ask);
      assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${ask.join(" ")}: ${r.text}`);
    }
    t.done();
  });
});

describe("the gate refuses before the command reads anything", () => {
  /** An unanswered episode whose every file but its record is a folder, so that any read of one would fail or say something else. */
  function unreadable(record = UNANSWERED_RECORD) {
    const t = setup();
    const found = episodeFor(t, { record });
    for (const rel of filesIn(found).filter((f) => !f.startsWith("record/"))) {
      rmSync(join(found.folder, rel));
      mkdirSync(join(found.folder, rel));
    }
    return { t, found };
  }
  it("reads no file of the episode but its record, and says the gate's words, for open, ask and push", async () => {
    for (const ask of [["open", FOLDER], ["ask", FOLDER], ["push", FOLDER], ["finish", FOLDER], ["spell", FOLDER], ["reels", FOLDER], ["title", FOLDER]]) {
      const { t, found } = unreadable();
      let r;
      const reads = await readDuring(async () => {
        r = await on(t.ctx.deps, ...ask);
      });
      assert.deepEqual([r.code, r.said], [1, [WAITING]], ask.join(" "));
      assert.ok(reads.some((path) => path.endsWith("/record/0001.json")), "the spy sees the record read");
      for (const path of reads) assert.ok(/\/record\/\d{4}\.json$/.test(path) || path.startsWith(t.home), `${ask.join(" ")} read ${path}`);
      assert.deepEqual([t.started, t.calls, reread(found).rev], [[], [], 1], ask.join(" "));
      t.done();
    }
  });
  it("reads no file of the episode but its record for a session either", async () => {
    for (const ask of [["open", FOLDER], ["ask", FOLDER], ["push", FOLDER], ["reels", FOLDER]]) {
      const { t, found } = unreadable(SESSION_RECORD);
      let r;
      const reads = await readDuring(async () => {
        r = await on(t.ctx.deps, ...ask);
      });
      assert.deepEqual([r.code, r.said], [1, [NOT_FOR_SESSION]], ask.join(" "));
      for (const path of reads) assert.ok(/\/record\/\d{4}\.json$/.test(path) || path.startsWith(t.home), `${ask.join(" ")} read ${path}`);
      assert.deepEqual([t.started, t.calls, reread(found).rev], [[], [], 1], ask.join(" "));
      t.done();
    }
  });
  it("names no episode in what it says: not its folder, its name, or its video's file", async () => {
    for (const record of [UNANSWERED_RECORD, SESSION_RECORD]) {
      const t = setup();
      episodeFor(t, { record });
      const r = await on(t.ctx.deps, "open", FOLDER);
      assert.equal(r.code, 1);
      for (const given of [FOLDER, "Pricing", "talk", "mp4"]) assert.ok(!r.text.includes(given), `${given} in ${r.text}`);
      t.done();
    }
  });
});

describe("the gate, wherever a command names its episode", () => {
  it("refuses 'reel pick <episode> 1' on a video not yet answered, which names it second", async () => {
    const t = setup();
    const found = episodeFor(t, { record: UNANSWERED_RECORD });
    const r = await on(t.ctx.deps, "reel", "pick", FOLDER, "1");
    assert.deepEqual([r.code, r.said, reread(found).rev], [1, [WAITING], 1]);
    t.done();
  });
  it("refuses 'open' with an unquoted name of several words on a video not yet answered", async () => {
    const t = setup();
    episodeFor(t, { record: UNANSWERED_RECORD });
    const r = await on(t.ctx.deps, "open", "Pricing", "talk");
    assert.deepEqual([r.code, r.said], [1, [WAITING]]);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("refuses 'ask --now <folder>', the detached run's way in, on a video not yet answered and on a session, asking Claude nothing", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      const t = setup();
      const found = episodeFor(t, { record });
      t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
      const r = await on(t.ctx.deps, "ask", "--now", FOLDER);
      assert.deepEqual([r.code, r.said, t.calls.filter((c) => c.cmd === "CLAUDE").length, reread(found).rev], [1, [why], 0, 1]);
      t.done();
    }
  });
  it("refuses the other detached runs' way in: bring --now and finish --now", async () => {
    for (const [record, name, why] of [[UNANSWERED_RECORD, "bring", WAITING], [SESSION_RECORD, "bring", NOT_FOR_SESSION], [UNANSWERED_RECORD, "finish", WAITING], [SESSION_RECORD, "finish", TEACHINGS_OFF]]) {
      const t = setup();
      const found = episodeFor(t, { record });
      const r = await on(t.ctx.deps, name, "--now", FOLDER);
      assert.deepEqual([r.code, r.said, t.calls, readResult(t.home, FOLDER, name), reread(found).rev], [1, [why], [], null, 1], name);
      t.done();
    }
  });
  it("lets finish --now through for a session once the training gate is on", async () => {
    const t = setup();
    episodeFor(t, { record: SESSION_RECORD });
    const r = await on(taught(t), "finish", "--now", FOLDER);
    assert.ok(!REFUSALS.some((why) => r.text.includes(why)), r.text);
    t.done();
  });
  it("is not applied by findEpisode when the ctx has no command, as in tests and the commands' own helpers", () => {
    const t = setup();
    episodeFor(t, { record: UNANSWERED_RECORD });
    const ctx = contextFor({ ...t.ctx.deps, say: () => {} });
    assert.equal(findEpisode(ctx, FOLDER).name, FOLDER);
    assert.equal(findEpisode({ ...ctx, asked: { command: "open", words: [FOLDER] } }, FOLDER).why, WAITING);
    assert.equal(findEpisode({ ...ctx, asked: { command: "status", words: [FOLDER] } }, FOLDER).name, FOLDER, "status names no episode, so it is never gated");
    t.done();
  });
  it("lets 'resolve' sort out an episode whose record is unanswered, and shows the two sides of its conflict", async () => {
    const t = setup();
    const found = episodeFor(t, { record: UNANSWERED_RECORD });
    const first = readEpisode(found.folder).record;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, label: "Video A" }));
    writeFileSync(join(found.folder, "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...first, rev: 2, label: "Video B" }));
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, [WAITING]);
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /Say which to keep: A or B\.$/);
    t.done();
  });
});

describe("the gate, an episode with a conflicted copy", () => {
  /** Record 2 is answered as a finished video, and the copy Dropbox kept of it on the other Mac is a video not yet answered, or the reverse. */
  function conflict(inForce, copy) {
    const t = setup();
    const found = episodeFor(t, { record: FINISHED_RECORD });
    const first = readEpisode(found.folder).record;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, ...inForce }));
    writeFileSync(join(found.folder, "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...first, rev: 2, ...copy }));
    return { t, found };
  }
  it("checks every record it knows for it: a copy not answered refuses open, and resolve runs", async () => {
    const { t } = conflict({}, UNANSWERED_RECORD);
    const opened = await on(t.ctx.deps, "open", FOLDER);
    assert.deepEqual([opened.code, opened.said], [1, [WAITING]]);
    const resolved = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(resolved.code, 0, resolved.text);
    assert.match(resolved.text, /Say which to keep: A or B\.$/);
    t.done();
  });
  it("checks the record in force as well: a record in force not answered, and a copy finished, refuses open", async () => {
    const { t } = conflict(UNANSWERED_RECORD, {});
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, [WAITING]);
    t.done();
  });
  it("refuses a session's copy for the commands a session is refused", async () => {
    const { t } = conflict({}, SESSION_RECORD);
    assert.deepEqual((await on(t.ctx.deps, "ask", FOLDER)).said, [NOT_FOR_SESSION]);
    assert.deepEqual((await on(t.ctx.deps, "reel", "pick", FOLDER, "1")).said, [TEACHINGS_OFF]);
    t.done();
  });
  it("says what it always said when every record it knows for it passes", async () => {
    const { t } = conflict({}, { name: { text: "Test B", placeholder: false } });
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1);
    assert.match(r.text, /Dropbox has kept a conflicted copy in this episode/);
    t.done();
  });
});

describe("the gate, a record of a layout newer than this brimm-video's", () => {
  const NEWER = `That is an episode a newer brimm-video wrote (${ID.slice(-6)}). Jason has a newer brimm-video. Ask him to update this Mac.`;
  /** A newer brimm-video's record 2, of what kind this one cannot say. */
  function newer() {
    const t = setup();
    const found = episodeFor(t);
    writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
    return t;
  }
  it("is refused by every command that names an episode, in today's words, whatever its kind says", async () => {
    for (const name of SCOPED.filter((n) => n !== "show")) {
      const t = newer();
      const r = await on(t.ctx.deps, name, ...ASKED[name]);
      assert.deepEqual([r.code, r.said], [1, [NEWER]], name);
      t.done();
    }
  });
  it("keeps the code show ended with, 0, for a record of a newer layout", async () => {
    const t = newer();
    const r = await on(t.ctx.deps, "show", FOLDER, "transcript");
    assert.deepEqual([r.code, r.said], [0, [NEWER]]);
    t.done();
  });
  it("is not refused for status, which names no episode", async () => {
    const t = newer();
    const r = await on(t.ctx.deps, "status", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.ok(!r.text.includes(NEWER), r.text);
    t.done();
  });
});

describe("ask, with another run at work on the episode, is gated before the run is looked at", () => {
  /** An episode with a command running for it on this Mac: its lock names a live run. */
  function busy(record) {
    const t = setup();
    episodeFor(t, { record });
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "finish", nonce: "x" }));
    return { t, deps: { ...t.ctx.deps, alive: () => true, tools: { ...t.ctx.deps.tools, claude: "CLAUDE" } } };
  }
  it("is told, for a finished video, that the run is at work: the lock is read", async () => {
    const { t, deps } = busy(FINISHED_RECORD);
    const r = await on(deps, "ask", "Pricing talk");
    assert.deepEqual([r.code, r.said], [1, [`finish is running for ${FOLDER} already. Say it again when it has finished.`]]);
    t.done();
  });
  it("is given the gate's words first, for a video not yet answered and for a session, and the folder is named nowhere", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      const { t, deps } = busy(record);
      for (const said of ["Pricing talk", FOLDER]) {
        const r = await on(deps, "ask", said);
        assert.deepEqual([r.code, r.said], [1, [why]], said);
        assert.ok(!r.text.includes(FOLDER) && !r.text.includes("running"), r.text);
      }
      assert.deepEqual([t.started, existsSync(lockOf(t.home, FOLDER))], [[], true]);
      t.done();
    }
  });
});
