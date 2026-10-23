// The gate in edit.js: every command that names an episode is checked against the episode's record before the command reads or
// does anything else, for a video not yet answered and for a client or group session whose mark is not cleared. Nothing here
// runs a real program or touches Dropbox: the root is made for each test, and the programs are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { COMMAND_NAMES, contextFor, editMain, findEpisode } from "../edit.js";
import { UNANSWERED, UNSCOPED } from "../gate.js";
import { RECORD_VERSION, readEpisode, recordFile, recordText } from "../episode.js";
import { episodeWork } from "../settings.js";
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
const LEFT_ALONE = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const REEL_NOT_AGREED = "A Reel is cut from a session only once you have noted the client's agreement.";
const PENDING = "Dropbox is still bringing this episode's record over: say it again in a moment.";
const NOT_SHOWN_WAITING = "Its words are not shown in the chat while it waits for its answer.";
const NOT_SHOWN_LEFT = "Its words are not shown in the chat: you said to leave this video.";
const NOT_SHOWN_SESSION = "A client or group session's words are not shown in the chat.";
/** The gate's own refusals, and with them what `show` itself holds back from a record the gate lets it run for. */
const GATE_REFUSALS = [WAITING, LEFT_ALONE, NOT_FOR_SESSION, TEACHINGS_OFF, REEL_NOT_AGREED, PENDING];
const REFUSALS = [...GATE_REFUSALS, NOT_SHOWN_WAITING, NOT_SHOWN_LEFT, NOT_SHOWN_SESSION];

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
  kind: [FOLDER, "finished", "--private", "no"], leave: [FOLDER], which: [FOLDER], read: ["--now", FOLDER, "--kind", "finished", "--rev", "1"],
  open: [FOLDER], push: [FOLDER], bring: ["--now", FOLDER], name: [FOLDER, "A new name"], title: [FOLDER], reel: ["pick", FOLDER, "1"], reels: [FOLDER, "--no-play"],
  ask: [FOLDER], finish: [FOLDER], release: [FOLDER], show: [FOLDER, "transcript"], resolve: [FOLDER], spell: [FOLDER], logo: [FOLDER, "on"],
  captions: [FOLDER, "reel", "1", "on"], text: [FOLDER], graphic: [FOLDER], preset: [FOLDER], cut: [FOLDER, "remove", "--words", "x"],
  teachings: [FOLDER], principles: [FOLDER], ideas: [FOLDER]
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
      if (UNANSWERED.includes(name)) assert.ok(!GATE_REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
      else {
        assert.deepEqual([r.code, r.said], [1, [WAITING]], name);
        assert.deepEqual([t.started, t.calls, reread(found).rev, filesIn(found)], [[], [], 1, before], name);
      }
      t.done();
    }
  });
  it("refuses a video left alone ('not for brimm-video') as it does one waiting, in words that do not say it waits for its answer", async () => {
    for (const name of SCOPED.filter((n) => !UNANSWERED.includes(n))) {
      const t = setup();
      episodeFor(t, { record: LEFT_RECORD });
      const r = await on(t.ctx.deps, name, ...ASKED[name]);
      assert.deepEqual([r.code, r.said], [1, [LEFT_ALONE]], name);
      t.done();
    }
  });
  it("refuses each but the second list's for a session whose mark is not cleared, with teachings off, and starts nothing", async () => {
    for (const name of SCOPED) {
      const t = setup();
      const found = episodeFor(t, { record: SESSION_RECORD });
      const before = filesIn(found);
      const r = await on(t.ctx.deps, name, ...ASKED[name]);
      if (["kind", "leave", "which", "show", "release", "resolve", "name"].includes(name)) assert.ok(!GATE_REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
      else {
        const why = ["finish", "reel", "read", "teachings", "principles", "ideas"].includes(name) ? TEACHINGS_OFF : NOT_FOR_SESSION;
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
    for (const name of ["kind", "leave", "which", "show", "release", "resolve", "name"]) {
      for (const deps of [(t) => t.ctx.deps, taught]) {
        const t = setup();
        episodeFor(t, { record: SESSION_RECORD });
        const r = await on(deps(t), name, ...ASKED[name]);
        assert.ok(!GATE_REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
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
        r = await on({ ...t.ctx.deps, settings: t.ctx.settings }, ...ask);
      });
      assert.deepEqual([r.code, r.said], [1, [WAITING]], ask.join(" "));
      assert.ok(reads.some((path) => path.endsWith("/record/0001.json")), "the spy sees the record read");
      for (const path of reads) assert.ok(/\/record\/\d{4}\.json$/.test(path), `${ask.join(" ")} read ${path}`);
      assert.deepEqual([t.started, t.calls, reread(found).rev], [[], [], 1], ask.join(" "));
      t.done();
    }
  });
  it("reads no file of the episode but its record for a session either", async () => {
    for (const ask of [["open", FOLDER], ["ask", FOLDER], ["push", FOLDER], ["reels", FOLDER]]) {
      const { t, found } = unreadable(SESSION_RECORD);
      let r;
      const reads = await readDuring(async () => {
        r = await on({ ...t.ctx.deps, settings: t.ctx.settings }, ...ask);
      });
      assert.deepEqual([r.code, r.said], [1, [NOT_FOR_SESSION]], ask.join(" "));
      assert.ok(reads.some((path) => path.endsWith("/record/0001.json")), "the spy sees the record read");
      for (const path of reads) assert.ok(/\/record\/\d{4}\.json$/.test(path), `${ask.join(" ")} read ${path}`);
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
  it("refuses 'open' with an unquoted label of several words on a video not yet answered, which words of its folder never find", async () => {
    const t = setup();
    episodeFor(t, { record: UNANSWERED_RECORD });
    const r = await on(t.ctx.deps, "open", ...UNANSWERED_RECORD.label.split(" "));
    assert.deepEqual([r.code, r.said], [1, [WAITING]]);
    // Words of its folder, which are its file's, find nothing (F2): what is said names it by its label alone.
    const words = await on(t.ctx.deps, "open", "Pricing", "talk");
    assert.deepEqual([words.code, words.said], [1, [`No episode fits "Pricing talk". The episodes are: ${UNANSWERED_RECORD.label} (3fa9c1).`]]);
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
      assert.deepEqual([r.code, r.said, t.calls, reread(found).rev], [1, [why], [], 1], name);
      t.done();
    }
  });
  it("leaves a result in the gate's words when a detached run is refused, as a run that failed does, naming no folder or file", async () => {
    for (const [record, name, why, argv] of [[UNANSWERED_RECORD, "bring", WAITING, ["--now", FOLDER]], [SESSION_RECORD, "bring", NOT_FOR_SESSION, ["--now", FOLDER]], [UNANSWERED_RECORD, "finish", WAITING, ["--now", FOLDER]],
      [SESSION_RECORD, "finish", TEACHINGS_OFF, ["--now", FOLDER]], [UNANSWERED_RECORD, "ask", WAITING, ["--now", FOLDER]], [SESSION_RECORD, "ask", NOT_FOR_SESSION, ["--now", FOLDER]]]) {
      const t = setup();
      const found = episodeFor(t, { record });
      const r = await on(t.ctx.deps, name, ...argv);
      const result = readResult(t.home, FOLDER, name);
      assert.deepEqual([r.code, r.said, result && result.ok, result && result.failed, result && result.made], [1, [why], false, [why], []], `${name} ${why}`);
      assert.deepEqual([existsSync(join(episodeWork(t.home, FOLDER), "episode.lock")), reread(found).rev], [false, 1], "the lock is let go");
      const text = readFileSync(join(episodeWork(t.home, FOLDER), `${name}.result.json`), "utf8");
      for (const given of [FOLDER, "Pricing", "mp4"]) assert.ok(!text.includes(given), `${given} in ${text}`);
      t.done();
    }
  });
  it("leaves no result when no episode was found, or the command is not one the gate ended", async () => {
    const t = setup();
    episodeFor(t, { record: UNANSWERED_RECORD });
    assert.equal((await on(t.ctx.deps, "ask", "--now", "No such episode")).code, 1);
    assert.equal((await on(t.ctx.deps, "bring", "--now", "No such episode")).code, 1);
    assert.deepEqual([readResult(t.home, FOLDER, "ask"), readResult(t.home, FOLDER, "bring")], [null, null]);
    t.done();
  });
  it("lets go the claim a refused finish --now's quick part took, as its other refusal does, and says so", async () => {
    const t = setup();
    // The quick part claimed the episode for this Mac (rev 1 is the claim), and the record has since become a session.
    const found = episodeFor(t, { record: { ...SESSION_RECORD, editing: { by: "Mac Studio", since: AT } } });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), JSON.stringify({ version: 1, at: AT, rev: 1, claimed: true, parts: [] }));
    const r = await on(t.ctx.deps, "finish", "--now", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [TEACHINGS_OFF, "The episode is let go again, as it was before the finish."]]);
    assert.equal(reread(found).editing, null);
    assert.deepEqual(readResult(t.home, FOLDER, "finish").failed, [TEACHINGS_OFF]);
    t.done();
  });
  it("lets go no claim for a finish --now that was not started by a claim, or whose claim is another Mac's", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...SESSION_RECORD, editing: { by: "Sallie's laptop", since: AT } } });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "finish.asked.json"), JSON.stringify({ version: 1, at: AT, rev: 1, claimed: true, parts: [] }));
    const r = await on(t.ctx.deps, "finish", "--now", FOLDER);
    assert.deepEqual([r.code, r.said, reread(found).editing && reread(found).editing.by], [1, [TEACHINGS_OFF], "Sallie's laptop"]);
    t.done();
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
  it("asks a copy that is shaped as a record though it says no kind, and refuses it: it fails closed", async () => {
    const t = setup();
    const found = episodeFor(t, { record: FINISHED_RECORD });
    const first = readEpisode(found.folder).record;
    const { kind, ...kindless } = first;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2 }));
    writeFileSync(join(found.folder, "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...kindless, rev: 2 }));
    assert.equal("kind" in JSON.parse(readFileSync(join(found.folder, "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), "utf8")), false);
    assert.deepEqual((await on(t.ctx.deps, "open", FOLDER)).said, [WAITING]);
    assert.equal((await on(t.ctx.deps, "resolve", FOLDER)).code, 0);
    t.done();
  });
  it("leaves alone a copy that is not a record at all: not an object, or with no id or version", async () => {
    for (const copy of ["{}", "[]", "7", '{"id":"e-20261014-3fa9c1"}', '{"version":3}', '{"kind":null}']) {
      const t = setup();
      const found = episodeFor(t, { record: FINISHED_RECORD });
      writeFileSync(join(found.folder, "record/0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), copy);
      const r = await on(t.ctx.deps, "open", FOLDER);
      assert.equal(r.code, 1);
      assert.match(r.text, /^2026-10-14 Pricing talk \(Mac Studio\): Dropbox has kept a conflicted copy in this episode/, copy);
      t.done();
    }
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
      for (const said of [record.label, FOLDER]) {
        const r = await on(deps, "ask", said);
        assert.deepEqual([r.code, r.said], [1, [why]], said);
        assert.ok(!r.text.includes(FOLDER) && !r.text.includes("running"), r.text);
      }
      assert.deepEqual([t.started, existsSync(lockOf(t.home, FOLDER))], [[], true]);
      t.done();
    }
  });
});

describe("show, which prints a file of an episode into the chat", () => {
  const WORDS = { transcript: "Hello Jane Doe of Acme, this is the transcript.", notes: "Notes: Jane Doe of Acme said the budget is tight.", plan: "Cut plan: keep Jane Doe's pause." };
  const ENDING = { transcript: ".transcript.txt", notes: ".edit-notes.txt", plan: ".cut-plan.txt" };
  /** An episode with its three files, each holding distinctive words. */
  function shown(record) {
    const t = setup();
    const found = episodeFor(t, { record });
    for (const kind of Object.keys(WORDS)) writeFileSync(join(found.folder, `Pricing talk${ENDING[kind]}`), `${WORDS[kind]}\n`);
    return { t, found };
  }
  it("prints a finished video's transcript, notes and plan as it always did", async () => {
    for (const record of [FINISHED_RECORD, {}, CLEARED_RECORD]) {
      const { t } = shown(record);
      for (const kind of Object.keys(WORDS)) assert.deepEqual((await on(t.ctx.deps, "show", FOLDER, kind)).said, [WORDS[kind]], kind);
      t.done();
    }
  });
  it("prints nothing of a video waiting for its answer, or one left alone, and starts no bring, in words that name no episode", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, NOT_SHOWN_WAITING], [LEFT_RECORD, NOT_SHOWN_LEFT]]) {
      const { t, found } = shown(record);
      for (const kind of Object.keys(WORDS)) {
        const r = await on(t.ctx.deps, "show", FOLDER, kind);
        assert.deepEqual([r.code, r.said, t.started], [1, [why], []], kind);
        assert.ok(!r.text.includes("Jane") && !r.text.includes(FOLDER), r.text);
      }
      assert.equal(reread(found).rev, 1);
      t.done();
    }
  });
  it("prints nothing of a session whose mark is not cleared, with this Mac's training gate on or off", async () => {
    for (const deps of [(t) => t.ctx.deps, taught]) {
      const { t } = shown(SESSION_RECORD);
      for (const kind of Object.keys(WORDS)) {
        const r = await on(deps(t), "show", FOLDER, kind);
        assert.deepEqual([r.code, r.said, t.started], [1, [NOT_SHOWN_SESSION], []], kind);
        assert.ok(!r.text.includes("Jane") && !r.text.includes(FOLDER), r.text);
      }
      t.done();
    }
  });
  it("starts no bring for a file that is not whole yet, which it does for a finished video", async () => {
    for (const [record, started] of [[UNANSWERED_RECORD, 0], [SESSION_RECORD, 0], [FINISHED_RECORD, 1]]) {
      const { t } = shown(record);
      await on({ ...t.ctx.deps, isWhole: () => false }, "show", FOLDER, "transcript");
      assert.equal(t.started.length, started, JSON.stringify(record.kind));
      t.done();
    }
  });
  it("stays in the gate's lists: the gate lets it through, and show's own refusal is what holds the words back", async () => {
    assert.ok(UNANSWERED.includes("show"));
    const { t } = shown(UNANSWERED_RECORD);
    assert.equal(findEpisode({ ...t.ctx, asked: { command: "show", words: [FOLDER, "transcript"] } }, FOLDER).name, FOLDER);
    t.done();
  });
});

describe("reel, which a session passes only with the words of a Reel she has agreed to", () => {
  it("refuses 'reel pick <digits> --client-agreed' and 'reel drop <episode> 1 --client-agreed' for a session with the training gate on", async () => {
    const t = setup();
    episodeFor(t, { record: SESSION_RECORD });
    for (const words of [["pick", "3fa9c1", "--client-agreed"], ["drop", "3fa9c1", "--client-agreed"], ["drop", FOLDER, "1", "--client-agreed"], ["pick", FOLDER, "1", "--client-agreed"]]) {
      const r = await on(taught(t), "reel", ...words);
      assert.deepEqual([r.code, r.said], [1, [REEL_NOT_AGREED]], words.join(" "));
    }
    // Digits that are words of its folder, which are its file's, do not find a session at all (F2).
    for (const words of [["pick", "14", "--client-agreed"], ["pick", "2026", "--client-agreed"], ["drop", "14", "--client-agreed"]]) {
      const r = await on(taught(t), "reel", ...words);
      assert.deepEqual([r.code, r.said], [1, [`No episode fits "${words[1]}". The episodes are: ${SESSION_RECORD.label} (3fa9c1).`]], words.join(" "));
    }
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("counts the words when the first is the word findEpisode was asked, as '<label> <n> --client-agreed' and '<label> make <n>' are", async () => {
    const t = setup();
    episodeFor(t, { record: { ...SESSION_RECORD, session: { ...SESSION_RECORD.session, agreed: [{ n: 2, at: AT.slice(0, 10) }] } } });
    const ctx = contextFor({ ...taught(t), say: () => {} });
    const asked = (command, words, said) => findEpisode({ ...ctx, asked: { command, words } }, said);
    assert.equal(asked("reel", [FOLDER, "2", "--client-agreed"], FOLDER).name, FOLDER);
    assert.equal(asked("reel", [FOLDER, "make", "2"], FOLDER).name, FOLDER);
    assert.equal(asked("reel", [FOLDER, "make", "3"], FOLDER).why, REEL_NOT_AGREED);
    assert.equal(asked("render", [FOLDER, "reel", "2"], FOLDER).name, FOLDER);
    assert.equal(asked("reel", ["--now", FOLDER, "make", "2"], FOLDER).name, FOLDER);
    // The episode was asked for by another word than the first: the first is a verb of today's reel, not the label. (By its
    // short id: words of its folder do not find a session, F2.)
    assert.equal(asked("reel", ["pick", "3fa9c1", "--client-agreed"], "3fa9c1").why, REEL_NOT_AGREED);
    assert.equal(asked("reel", [FOLDER, "make", "2"], "3fa9c1").why, REEL_NOT_AGREED);
    t.done();
  });
});

describe("the gate, a record Dropbox is still bringing over", () => {
  const PENDING_FILE = (found, n = 2, text = '{"version":3,"id"') => writeFileSync(recordFile(found.folder, n), text);
  /** This Mac with the light import turned on. */
  const light = (t) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light" } });
  it("refuses every command that names an episode, on a Mac that does the light import, while a record above the one read is not whole", async () => {
    for (const name of SCOPED) {
      const t = setup();
      const found = episodeFor(t, { record: {} });
      PENDING_FILE(found);
      const r = await on(light(t), name, ...ASKED[name]);
      assert.deepEqual([r.code, r.said, t.started], [1, [PENDING], []], name);
      t.done();
    }
  });
  it("refuses them on a record of the switch's layout, though this Mac does not do the light import", async () => {
    for (const record of [FINISHED_RECORD, SESSION_RECORD, CLEARED_RECORD, UNANSWERED_RECORD]) {
      for (const name of ["open", "ask", "show", "resolve", "release", "push"]) {
        const t = setup();
        const found = episodeFor(t, { record });
        PENDING_FILE(found);
        const r = await on(t.ctx.deps, name, ...ASKED[name]);
        assert.deepEqual([r.code, r.said, t.started], [1, [PENDING], []], `${record.kind} ${name}`);
        t.done();
      }
    }
  });
  it("refuses a finished video that is being corrected to a session while the record that says so is not whole, as it does one that this code rejects", async () => {
    for (const next of ['{"version":3,"id"', JSON.stringify({ version: 3, rev: 2, id: "bad id", kind: "session" }), ""]) {
      const t = setup();
      const found = episodeFor(t, { record: FINISHED_RECORD });
      PENDING_FILE(found, 2, next);
      const r = await on(t.ctx.deps, "ask", FOLDER);
      assert.deepEqual([r.code, r.said, t.calls.filter((c) => c.cmd === "CLAUDE").length], [1, [PENDING], 0]);
      t.done();
    }
  });
  it("does not refuse the commands that name no episode", async () => {
    const t = setup();
    const found = episodeFor(t, { record: FINISHED_RECORD });
    PENDING_FILE(found);
    const r = await on(t.ctx.deps, "status", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.ok(!r.text.includes(PENDING), r.text);
    t.done();
  });
  it("does not refuse once the record above is whole, and it is the one read", async () => {
    const t = setup();
    const found = episodeFor(t, { record: FINISHED_RECORD });
    const first = readEpisode(found.folder).record;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2 }));
    const r = await on(light(t), "open", FOLDER);
    assert.ok(!REFUSALS.some((why) => r.text.includes(why)), r.text);
    t.done();
  });
  it("changes nothing with today's settings and today's records: a record above the one read that is not whole is passed over as before", async () => {
    for (const record of [{}, { kind: "short video" }]) {
      for (const name of SCOPED) {
        const { t, found } = episode(record);
        PENDING_FILE(found, 2, "{");
        const r = await on(t.ctx.deps, name, ...ASKED[name]);
        assert.ok(!REFUSALS.some((why) => r.text.includes(why)), `${name}: ${r.text}`);
        t.done();
      }
    }
  });
  it("is refused after the newer layout's words when the record read is a newer brimm-video's", async () => {
    const t = setup();
    const found = episodeFor(t);
    writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
    PENDING_FILE(found, 3, "{");
    const r = await on(light(t), "open", FOLDER);
    assert.deepEqual(r.said, [`That is an episode a newer brimm-video wrote (${ID.slice(-6)}). Jason has a newer brimm-video. Ask him to update this Mac.`]);
    t.done();
  });
  it("counts a conflicted copy of a record as the record, not as one above it", async () => {
    const t = setup();
    const found = episodeFor(t, { record: FINISHED_RECORD });
    const first = readEpisode(found.folder).record;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2 }));
    writeFileSync(join(found.folder, "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...first, rev: 2 }));
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.match(r.text, /Dropbox has kept a conflicted copy/);
    t.done();
  });
});
