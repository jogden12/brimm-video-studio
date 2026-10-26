// A session's words, by file (design 2026-10-26, section 5, "A chat that holds a session's words keeps today's lock" and "Another
// chat's command output"; R7, R8, R9). When edit.js is about to say anything drawn from a session's words (`teachings`,
// `principles`, `ideas`, a session's Reel and finish: SESSION_TAUGHT beyond SESSION), under Claude Code (CLAUDECODE=1) on a Mac
// where her folder is, it first marks the chat (held.js markChat), on a strict Mac as on an open one. On an open-lock Mac it then
// says none of it: every line goes into a file only that chat's Read reaches (held.js writeWords), and the chat is told its label
// and the file. A detached run is not under Claude Code (spawnDetached takes CLAUDECODE out of its environment), and is never
// marked; a foreground `--now` that Claude typed is. A video found a session after all is noted wherever its record is read.
// Each test is a made-up Mac of its own (episodes.js), with stand-ins for `ps`, Claude Code, osascript and Finder; the runner's own
// environment is never taken for the chat's.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { spawnDetached, takeEpisodeLock, releaseEpisodeLock, lockOf } from "../detached.js";
import { recordFile, recordText } from "../episode.js";
import { heldFolder } from "../scan.js";
import { wordsFolder } from "../held.js";
import { readSettings, writeSettings } from "../settings.js";
import { studioFolder } from "../studio.js";
import { TEACHINGS_FORMAT } from "../teachings.js";
import { setup, episodeFor, reread, FOLDER, ID } from "./episodes.js";
import { APP_ARGS, MINIMUM, SESSION, chatChain } from "./open-world.js";

/** Run a command of edit.js by its deps: { code, said, text }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

// The words a person reads.
const MARK_FAILED = "This chat could not be marked as holding a session's words, so they are not shown here: ask Jason.";
const IN_A_FILE = "a session's words are in a file for this chat alone";

// --- The made-up session, its teachings read ---

const AT = "2026-10-20T15:00:00-05:00";
const DAY = 24 * 3600 * 1000;
/** The session's label, as `kind … session` names it. */
const LABEL = "Session, 2026-10-14";
/** The stand-in for a principle's key phrases, word for word from the session. */
const KEY = "KEY PHRASE 4417";
const ACCOUNT = "sallie@example.com (BRIMM)";
const TAUGHT = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } };
const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
const OSASCRIPT = "/usr/bin/osascript";
const TEACHINGS_NAME = `${LABEL}.principles.json`;
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "yes" };
const READING = { kind: "session", model: "claude-test", at: AT, on: "Mac Studio", account: ACCOUNT, outcome: "ok", principles: TEACHINGS_NAME };
const PRINCIPLE = { n: 1, name: "Price the outcome", category: "pricing", description: "Charge for what the work changes.", steps: ["Name the result the buyer wants."], red_flags: [], green_flags: [], decision_criteria: [], example_application: "A baker prices a cake by the day it serves.", verbatim_key_phrases: [KEY], source_context: "Early on." };
const IDEA = { n: 1, from: "p1", to: "p1", idea: "Say it first", words: `${KEY}, then stop.`, why: "It is short.", refilm: false, principle: 1 };
const TEACHINGS = { format: TEACHINGS_FORMAT, version: 1, made: "2026-10-20", principles: [PRINCIPLE], recurringPrinciples: [], reelIdeas: [IDEA], dropped: [] };
const PLAN = { version: 1, video: "Pricing talk.mp4", facts: { duration: 4, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 }, phrases: [{ id: "p1", start: 0, end: 4, keep: true, text: "Say the price first." }], ranges: [{ start: 0, end: 4, keep: true }], kept: 4, cut: 0, by: "rules" };
/** The session as her decisions leave it: principle 1 and Reel idea 1 kept. */
const SESSION_RECORD = {
  version: 3, kind: "session", answer: ANSWERED, label: "Video of 14 Oct, 09:00 (Mac Studio)", name: { text: LABEL, placeholder: false },
  session: { marked: AT, on: "Mac Studio", teachings: "asked", asked: AT, cleared: null, decided: { principles: { 1: "kept" }, reelIdeas: { 1: "kept" } } },
  reading: READING, editing: null
};
const SESSION_FILES = { "Pricing talk.mp4": "the raw video", "Pricing talk.cut-plan.json": JSON.stringify(PLAN), [TEACHINGS_NAME]: JSON.stringify(TEACHINGS) };

/** Her chat's environment: under Claude Code, with its id and its claude's pid. */
const CHAT = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" };

/** A Mac with her folder, the training gate on, version 2 hand-offs, and one episode: the session unless `record` says otherwise.
    Claude Code and osascript are stand-ins (she types who agreed and clicks "They agreed"); `ps` is a stand-in that counts its calls
    and gives her chat's chain, edit.js (900) ← zsh ← the app's claude (700). */
function wordsMac({ record = SESSION_RECORD, files = SESSION_FILES, studio = true } = {}) {
  const t = setup({
    programs: {
      CLAUDE: (args) => (args.includes("auth") ? { code: 0, stderr: "", stdout: JSON.stringify(STATUS) } : { code: 1, stderr: "not asked here", stdout: "" }),
      [OSASCRIPT]: () => ({ code: 0, stdout: "button returned:They agreed, text returned:A client, 21 October\n", stderr: "" })
    }
  });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.notify = () => {};
  writeSettings(t.home, { sessionTeachings: TAUGHT, handoffVersion: 2 });
  if (studio) mkdirSync(studioFolder(t.home), { recursive: true });
  const found = episodeFor(t, { record, files });
  const ps = { calls: 0 };
  /** This Mac's deps with the lock `lock` in its settings and Claude Code's version named, under her chat's environment. */
  const deps = (lock = "open", more = {}) => ({
    ...t.ctx.deps,
    settings: { ...readSettings(t.home).settings, lock },
    minimum: MINIMUM,
    env: CHAT,
    pid: 900,
    ps: () => {
      ps.calls += 1;
      return chatChain({ args: APP_ARGS(studioFolder(t.home), t.home) });
    },
    ...more
  });
  return { t, found, ps, deps };
}

/** The marks in the held folder of `home`, by their file names, oldest first; and each mark as written. */
const markNames = (home) => (existsSync(heldFolder(home)) ? readdirSync(heldFolder(home)).filter((name) => name.startsWith("mark-")).sort() : []);
const marksOf = (home) => markNames(home).map((name) => JSON.parse(readFileSync(join(heldFolder(home), name), "utf8")));
/** The notes of a session after all in the held folder of `home`, by their file names. */
const notesIn = (home) => (existsSync(heldFolder(home)) ? readdirSync(heldFolder(home)).filter((name) => name.startsWith("after-all-")).sort() : []);
/** The words files of the chat `id`. */
const wordsFiles = (home, id = SESSION) => (existsSync(join(wordsFolder(home), id)) ? readdirSync(join(wordsFolder(home), id)).sort() : []);
/** The words file a line names, after checking the line is the one the chat is told: the label, and a file in this chat's folder. */
function handedOver(home, line, label = LABEL) {
  assert.match(line, /^.+: a session's words are in a file for this chat alone: .+\.txt$/);
  const file = line.split(": ").at(-1);
  assert.equal(line, `${label}: ${IN_A_FILE}: ${file}`);
  assert.equal(dirname(file), join(wordsFolder(home), SESSION));
  return file;
}

describe("a session's words, by file", () => {
  it("writes the mark, then a session's principles into a file for this chat alone, and prints only its label and the file", async () => {
    const { t, deps } = wordsMac();
    const home = t.home;
    const r = await on(deps(), "principles", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said.length, 1); assert.match(r.said[0], /^.+: a session's words are in a file for this chat alone: .+\.txt$/);
    const file = r.said[0].split(": ").at(-1);
    assert.ok(readFileSync(file, "utf8").includes("KEY PHRASE 4417")); assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.ok(!r.said.join("\n").includes("KEY PHRASE"));
    const markFile = join(heldFolder(home), markNames(home)[0]);
    const mark = marksOf(home)[0]; assert.deepEqual([mark.session, mark.tied], [SESSION, true]); assert.ok(statSync(markFile).mtimeMs <= statSync(file).mtimeMs);
    // The file is in this chat's own folder, and holds what the chat would have been shown.
    assert.equal(handedOver(home, r.said[0]), file);
    assert.deepEqual(marksOf(home).length, 1);
    assert.deepEqual(mark.claude && mark.claude.pid, 700);
    const plain = await on(t.ctx.deps, "principles", LABEL);
    assert.equal(readFileSync(file, "utf8"), `${plain.said.join("\n")}\n`);
    t.done();
  });

  it("does the same for ideas, teachings, and a session's Reel and finish lines", async () => {
    const cases = [
      ["ideas", ["ideas", LABEL], KEY],
      ["teachings", ["teachings", LABEL], `Claude is still reading ${LABEL}.`],
      ["reel", ["reel", LABEL, "1", "--client-agreed"], "Reel 1's agreement is noted"],
      ["finish", ["finish", LABEL], `${LABEL}: its hand-off is written, revision 1`]
    ];
    for (const [what, argv, holds] of cases) {
      const { t, deps } = wordsMac();
      const r = await on(deps(), ...argv);
      assert.equal(r.said.length, 1, `${what}: ${r.text}`);
      const file = handedOver(t.home, r.said[0]);
      const text = readFileSync(file, "utf8");
      assert.ok(text.includes(holds), `${what}: ${text}`);
      assert.match(file, new RegExp(` ${what} \\d{4}-\\d{2}-\\d{2} \\d{6}\\.txt$`), what);
      assert.equal(statSync(file).mode & 0o777, 0o600, what);
      assert.ok(!r.text.includes("KEY PHRASE"), what);
      assert.deepEqual(marksOf(t.home).map((m) => [m.session, m.tied]), [[SESSION, true]], what);
      t.done();
    }
  });

  it("prints as today without CLAUDECODE, and on a strict-lock Mac, where it still marks the chat under Claude Code", async () => {
    const { t, deps, ps } = wordsMac();
    const today = await on(t.ctx.deps, "principles", LABEL);
    assert.equal(today.code, 0, today.text);
    assert.ok(today.text.includes(KEY));
    // Open, but not under Claude Code (Jason's own run in Terminal): as today, and no mark.
    const terminal = await on(deps("open", { env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" } }), "principles", LABEL);
    assert.deepEqual([terminal.code, terminal.said], [0, today.said]);
    assert.deepEqual([markNames(t.home), ps.calls, existsSync(wordsFolder(t.home))], [[], 0, false]);
    // Strict, under Claude Code: as today, and the chat is marked.
    const strict = await on(deps("strict"), "principles", LABEL);
    assert.deepEqual([strict.code, strict.said], [0, today.said]);
    assert.deepEqual(marksOf(t.home).map((m) => [m.session, m.tied]), [[SESSION, true]]);
    assert.equal(existsSync(wordsFolder(t.home)), false);
    // With OPEN_LOCK_CLAUDE not named, settings that say open are strict: as today, and marked.
    const unnamed = await on(deps("open", { minimum: null }), "principles", LABEL);
    assert.deepEqual([unnamed.code, unnamed.said], [0, today.said]);
    assert.equal(marksOf(t.home).length, 2);
    assert.equal(existsSync(wordsFolder(t.home)), false);
    // Without her folder on this Mac, nothing is marked.
    const bare = wordsMac({ studio: false });
    const nofolder = await on(bare.deps("strict"), "principles", LABEL);
    assert.deepEqual([nofolder.code, nofolder.said], [0, today.said]);
    assert.deepEqual([markNames(bare.t.home), bare.ps.calls], [[], 0]);
    bare.t.done();
    t.done();
  });

  it("refuses, showing nothing, when the chat cannot be marked, has no id, or has an id that is not a chat's", async () => {
    const cases = [
      ["cannot be marked", (t) => {
        mkdirSync(dirname(heldFolder(t.home)), { recursive: true });
        writeFileSync(heldFolder(t.home), "not a folder");
        return CHAT;
      }],
      ["no id", () => ({ CLAUDECODE: "1", CLAUDE_PID: "700" })],
      ["an id that is not a chat's", () => ({ ...CHAT, CLAUDE_CODE_SESSION_ID: "../../../Documents/x" })]
    ];
    for (const [what, make] of cases) {
      const { t, found, deps } = wordsMac();
      const env = make(t);
      const r = await on(deps("open", { env }), "principles", LABEL);
      // CLAUDE_CODE_SESSION_ID "../../../Documents/x" → MARK_FAILED, code 1, nothing written under <home>/Documents
      assert.deepEqual([r.code, r.said], [1, [MARK_FAILED]], what);
      assert.equal(existsSync(wordsFolder(t.home)), false, what);
      assert.equal(existsSync(join(t.home, "Documents")), false, what);
      assert.ok(!r.text.includes("KEY PHRASE"), what);
      // The command ends there: her decision is not written.
      const before = reread(found);
      const drop = await on(deps("open", { env }), "principles", LABEL, "drop", "1");
      assert.deepEqual([drop.code, drop.said, reread(found)], [1, [MARK_FAILED], before], what);
      t.done();
    }
  });

  it("prints an ordinary video's words as today, and marks nothing", async () => {
    const ordinary = { version: 3, kind: "finished", answer: { ...ANSWERED, private: "no" }, label: "Video of 14 Oct, 09:00 (Mac Studio)", name: { text: "Pricing talk", placeholder: false } };
    const { t, deps, ps } = wordsMac({ record: ordinary, files: { "Pricing talk.mp4": "the raw video", "Pricing talk.transcript.txt": "THE VIDEO'S WORDS\n" } });
    for (const argv of [["show", "Pricing talk", "transcript"], ["principles", "Pricing talk"], ["ideas", "Pricing talk"]]) {
      const today = await on(t.ctx.deps, ...argv);
      const r = await on(deps(), ...argv);
      assert.deepEqual([r.code, r.said], [today.code, today.said], argv.join(" "));
    }
    assert.ok((await on(deps(), "show", "Pricing talk", "transcript")).text.includes("THE VIDEO'S WORDS"));
    assert.deepEqual([markNames(t.home), ps.calls, existsSync(wordsFolder(t.home))], [[], 0, false]);
    t.done();
  });

  it("leaves a detached run, started without CLAUDECODE, and the reading's own run unmarked", async () => {
    // deps.env {} for the run startDetached launches; and spawnDetached's child environment holds no CLAUDECODE (a stand-in spawn records it)
    const { t, deps } = wordsMac();
    const asked = await on(deps(), "teachings", LABEL);
    assert.equal(asked.said.length, 1, asked.text);
    assert.equal(markNames(t.home).length, 1);
    const reads = t.started.map(([, args]) => args.slice(1)).filter((args) => args[0] === "read");
    assert.equal(reads.length, 1);
    assert.deepEqual(reads[0].slice(0, 3), ["read", "--now", FOLDER]);
    // The reading, as spawnDetached starts it: not under Claude Code.
    await on(deps("open", { env: {} }), ...reads[0]);
    assert.equal(markNames(t.home).length, 1);
    // The reading's own run says nothing to a chat, and is never marked, even under Claude Code.
    await on(deps(), ...reads[0]);
    assert.equal(markNames(t.home).length, 1);
    // A finish started detached is not under Claude Code: not marked.
    await on(deps("open", { env: {} }), "finish", "--now", FOLDER);
    assert.equal(markNames(t.home).length, 1);
    // spawnDetached starts its run with CLAUDECODE taken out of the environment, and the rest kept.
    const spawned = [];
    const spawn = (cmd, args, opts) => {
      spawned.push({ cmd, args, opts });
      return { on: () => {}, unref: () => {} };
    };
    spawnDetached("/opt/homebrew/bin/node", ["/x/tool/edit.js", "read", "--now", FOLDER], { log: join(t.dir, "logs", "brimm-video.log"), spawn, env: { ...CHAT, PATH: "/usr/bin:/bin", HOME: t.home } });
    assert.equal(spawned.length, 1);
    assert.deepEqual([spawned[0].cmd, spawned[0].args, spawned[0].opts.detached], ["/opt/homebrew/bin/node", ["/x/tool/edit.js", "read", "--now", FOLDER], true]);
    assert.deepEqual(spawned[0].opts.env, { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700", PATH: "/usr/bin:/bin", HOME: t.home });
    t.done();
  });

  it("marks and hands over a foreground run Claude typed with --now, which is under Claude Code", async () => {
    const { t, deps } = wordsMac();
    // A reading is at work on the session, so the finish says so, and that is all it says.
    const lock = lockOf(t.home, FOLDER);
    mkdirSync(dirname(lock), { recursive: true });
    const took = takeEpisodeLock(lock, "read", () => true);
    const r = await on(deps("open", { alive: (pid) => pid === process.pid }), "finish", "--now", FOLDER);
    releaseEpisodeLock(lock, took.text);
    assert.equal(r.said.length, 1, r.text);
    const file = handedOver(t.home, r.said[0]);
    assert.match(readFileSync(file, "utf8"), /^read is running for .+ already\./);
    assert.deepEqual(marksOf(t.home).map((m) => [m.session, m.tied]), [[SESSION, true]]);
    t.done();
  });

  it("takes away this chat's words files a day old at its next command", async () => {
    const { t, deps } = wordsMac();
    const first = await on(deps(), "principles", LABEL);
    const old = handedOver(t.home, first.said[0]);
    const second = await on(deps(), "ideas", LABEL);
    const fresh = handedOver(t.home, second.said[0]);
    const dayOld = new Date(t.now() - DAY - 1000);
    utimesSync(old, dayOld, dayOld);
    const hourOld = new Date(t.now() - 3600 * 1000);
    utimesSync(fresh, hourOld, hourOld);
    // Not under Claude Code: nothing is taken away.
    await on(deps("open", { env: {} }), "episodes");
    assert.deepEqual([existsSync(old), existsSync(fresh)], [true, true]);
    // Its next command under Claude Code takes the day-old file away, and keeps the other.
    await on(deps(), "episodes");
    assert.deepEqual([existsSync(old), existsSync(fresh)], [false, true]);
    // Once its last file is a day old, the chat's folder goes too.
    utimesSync(fresh, dayOld, dayOld);
    await on(deps("strict"), "episodes");
    assert.equal(existsSync(join(wordsFolder(t.home), SESSION)), false);
    t.done();
  });

  it("notes a session after all when kind answers an answered video as a session, and when this Mac first reads one the other Mac answered, through episodes", async () => {
    // the other Mac's record with session.emptyRevision set; `episodes` alone (no command naming it) writes held/after-all-<id>-<rev>-<ms>.json once;
    // a second episodes writes none; a record with a later emptyRevision is noted again
    {
      const finished = { version: 3, kind: "finished", answer: { ...ANSWERED, private: "no" }, label: "Video of 14 Oct, 09:00 (Mac Studio)", name: { text: "Pricing talk", placeholder: false }, editing: null };
      const t = setup();
      const found = episodeFor(t, { record: finished });
      assert.deepEqual(notesIn(t.home), []);
      const r = await on(t.ctx.deps, "kind", ID, "session", "--private", "yes", "--again");
      assert.equal(r.code, 0, r.text);
      const record = reread(found);
      assert.equal(record.session.emptyRevision, "owed");
      const notes = notesIn(t.home);
      assert.equal(notes.length, 1, notes.join(" "));
      assert.match(notes[0], new RegExp(`^after-all-${ID}-owed-\\d+\\.json$`));
      const note = JSON.parse(readFileSync(join(heldFolder(t.home), notes[0]), "utf8"));
      assert.deepEqual([note.id, note.revision], [ID, "owed"]);
      assert.ok(Date.parse(note.at) >= Date.parse(record.session.marked), note.at);
      t.done();
    }
    {
      const t = setup();
      const other = { version: 3, kind: "session", answer: { ...ANSWERED, by: "Sallie's laptop", on: "Sallie's laptop" }, label: "Video of 14 Oct, 09:00 (Mac Studio)", name: { text: LABEL, placeholder: false }, session: { marked: AT, on: "Sallie's laptop", teachings: null, cleared: null, emptyRevision: 2 }, editing: null };
      const found = episodeFor(t, { record: other });
      assert.deepEqual(notesIn(t.home), []);
      const seen = t.now();
      assert.equal((await on(t.ctx.deps, "episodes")).code, 0);
      assert.deepEqual(notesIn(t.home), [`after-all-${ID}-2-${seen}.json`]);
      assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(t.home), notesIn(t.home)[0]), "utf8")), { id: ID, revision: 2, at: new Date(seen).toISOString() });
      // Read again: noted already.
      await t.ctx.deps.wait(60000);
      await on(t.ctx.deps, "episodes");
      assert.equal(notesIn(t.home).length, 1);
      // A later empty revision of it, written on the other Mac: noted again, at the time it is first read here.
      const now = reread(found);
      writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, session: { ...now.session, emptyRevision: 3 } }));
      const later = t.now();
      await on(t.ctx.deps, "episodes");
      assert.deepEqual(notesIn(t.home), [`after-all-${ID}-2-${seen}.json`, `after-all-${ID}-3-${later}.json`]);
      t.done();
    }
  });
});
