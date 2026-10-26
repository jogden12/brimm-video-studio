// Chats that hold a session's words (held.js; design 2026-10-26, section 5; R7, R9, R27): the marks edit.js writes, the sessions
// after all, which chats are held (by id, by their claude process, by a time, and forks by a held chat's message uuids), and the
// files a session's words are handed over in. Each test has a home of its own, with a space and an apostrophe in it; `ps` is a
// stand-in table.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { HELD_REFUSED, HELD_NARROWED, wordsFolder, markChat, untiedMark, noteAfterAll, afterAllNoted, afterAllTimes, chatHeld, writeWords, safeName, clearOldWords } from "../held.js";
import { heldFolder } from "../scan.js";
import { processTable } from "../chain.js";
import { claudeDirName } from "../places.js";
import { APP_ARGS, SESSION, chatChain, psText } from "./open-world.js";

const OTHER = "22222222-3333-4444-8555-666666666666";
const THIRD = "33333333-4444-4555-8666-777777777777";
const LSTART = "Mon Oct 26 09:00:00 2026";
const ID = "e-20261026-a1b2c3";
const at = (text) => Date.parse(text);

/** A home of its own, her folder's projects folder in it, and a transcript there for a chat (`talk`). */
function world() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-held-")));
  const home = join(dir, "Sallie's home");
  const folder = join(home, "BRIMM Video Studio");
  const projects = join(home, ".claude", "projects", claudeDirName(folder));
  mkdirSync(projects, { recursive: true });
  const path = (id) => join(projects, `${id}.jsonl`);
  const text = (lines) => lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line)) + "\n").join("");
  return {
    dir,
    home,
    folder,
    path,
    talk: (id, lines) => {
      writeFileSync(path(id), text(lines));
      return path(id);
    },
    more: (id, lines, end = "\n") => appendFileSync(path(id), text(lines).slice(0, end === "\n" ? undefined : -1)),
    held: (id, more = {}) => chatHeld({ home, sessionId: id, transcriptPath: path(id), claude: null, ...more }),
    marks: () => (existsSync(heldFolder(home)) ? readdirSync(heldFolder(home)).filter((n) => n.startsWith("mark-")) : []),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A line of a chat's transcript: a message with its uuid and time. */
const line = (uuid, timestamp = "2026-10-26T10:00:00.000Z") => ({ type: "user", uuid, timestamp, message: { role: "user", content: "x" } });

const table = (args) => processTable(chatChain({ args }));

describe("chats that hold a session's words", () => {
  it("says what a held chat is told, in the design's words", () => {
    assert.equal(HELD_REFUSED, "This chat holds a session's words, so it can only run brimm-video now. Start a new chat for anything else.");
    assert.equal(HELD_NARROWED, "This chat holds a session's words, so it can't do that here. Start a new chat for it.");
    assert.equal(wordsFolder("/Users/s"), "/Users/s/Library/Application Support/BRIMM Video Words");
  });
  it("writes a mark with the chat's id and its claude process, tied when CLAUDE_PID is that process", () => {
    const w = world();
    const now = at("2026-10-26T10:30:00.000Z");
    assert.deepEqual(markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now }), { tied: true });
    const [name] = w.marks();
    assert.match(name, new RegExp(`^mark-${now}-[0-9a-f]{6}\\.json$`));
    const file = join(heldFolder(w.home), name);
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { at: "2026-10-26T10:30:00.000Z", session: SESSION, claude: { pid: 700, start: LSTART }, tied: true });
    assert.equal(statSync(file).mode & 0o777, 0o600);
    w.done();
  });
  it("writes an untied mark when CLAUDE_PID is not the claude above, or the id is missing or not a chat's id", () => {
    const w = world();
    const t = table(APP_ARGS(w.folder, w.home));
    const now = at("2026-10-26T10:30:00.000Z");
    for (const [env, session] of [[{ CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "701" }, SESSION], [{ CLAUDE_PID: "700" }, null], [{ CLAUDE_CODE_SESSION_ID: "../x", CLAUDE_PID: "700" }, "../x"], [{ CLAUDE_CODE_SESSION_ID: SESSION }, SESSION]]) {
      assert.deepEqual(markChat({ home: w.home, env, table: t, pid: 900, now }), { tied: false }, JSON.stringify(env));
    }
    const noClaude = processTable(psText([[1, 0, "/sbin/launchd"], [800, 1, "/bin/zsh"], [900, 800, "node edit.js"]]));
    assert.deepEqual(markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: noClaude, pid: 900, now }), { tied: false });
    const marks = w.marks().map((n) => JSON.parse(readFileSync(join(heldFolder(w.home), n), "utf8")));
    assert.equal(marks.length, 5);
    assert.ok(marks.every((m) => m.tied === false));
    assert.deepEqual(marks.map((m) => m.session).sort(), [SESSION, SESSION, SESSION, "../x", null].sort());
    assert.equal(marks.filter((m) => m.claude === null).length, 1);
    w.done();
  });
  it("throws when it cannot write a mark", () => {
    const w = world();
    mkdirSync(dirname(heldFolder(w.home)), { recursive: true });
    writeFileSync(heldFolder(w.home), "a file where the folder goes");
    assert.throws(() => markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: Date.now() }));
    assert.throws(() => untiedMark({ home: w.home, now: Date.now() }));
    w.done();
  });
  it("holds a chat by its id, by its claude process, and every chat begun before an untied mark", () => {
    const w = world();
    w.talk(SESSION, [line("a-1", "2026-10-26T10:00:00.000Z")]);
    w.talk(OTHER, [line("b-1", "2026-10-26T11:00:00.000Z")]);
    w.talk(THIRD, [line("c-1", "2026-10-26T12:30:00.000Z")]);
    assert.deepEqual([w.held(SESSION), w.held(OTHER), w.held(THIRD)], [false, false, false]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.deepEqual([w.held(SESSION), w.held(OTHER), w.held(THIRD)], [true, false, false]);
    assert.equal(w.held(OTHER, { claude: { pid: 700, start: "Mon Oct 26 09:00:01 2026" } }), false);
    assert.equal(w.held(OTHER, { claude: { pid: 701, start: LSTART } }), false);
    assert.equal(w.held(OTHER, { claude: { pid: 700, start: LSTART } }), true);
    assert.equal(w.held(OTHER, { claude: { pid: 701, start: LSTART } }), true, "held once, its own uuids, kept then, hold it after");
    untiedMark({ home: w.home, now: at("2026-10-26T12:00:00.000Z") });
    assert.deepEqual([w.held(OTHER), w.held(THIRD)], [true, false]);
    w.talk(SESSION.replace("1111", "4444"), [line("d-1", "2026-10-26T11:59:59.000Z")]);
    assert.equal(w.held(SESSION.replace("1111", "4444")), true, "begun before the untied mark");
    untiedMark({ home: w.home, now: at("2026-10-26T12:30:00.000Z") });
    assert.equal(w.held(THIRD), true, "a time at the transcript's start holds it");
    w.done();
  });
  it("holds every chat begun before a session after all, and before a second session after all of the same video", () => {
    const w = world();
    w.talk(SESSION, [line("a-1", "2026-10-26T10:30:00.000Z")]);
    w.talk(OTHER, [line("b-1", "2026-10-26T12:30:00.000Z")]);
    noteAfterAll({ home: w.home, id: ID, revision: 1, at: "2026-10-26T10:00:00.000Z" });
    assert.deepEqual([w.held(SESSION), w.held(OTHER)], [false, false]);
    assert.deepEqual([afterAllNoted(w.home, ID, 1), afterAllNoted(w.home, ID, 2)], [true, false]);
    noteAfterAll({ home: w.home, id: ID, revision: 2, at: "2026-10-26T11:00:00.000Z" });
    assert.deepEqual([w.held(SESSION), w.held(OTHER)], [true, false]);
    assert.deepEqual([...afterAllTimes(w.home)], [[ID, "2026-10-26T11:00:00.000Z"]]);
    assert.equal(afterAllNoted(w.home, ID, 2), true);
    w.done();
  });
  it("loses no note when two runs note sessions after all at once", () => {
    const w = world();
    const when = "2026-10-26T11:00:00.000Z";
    const other = "e-20261026-d4e5f6";
    noteAfterAll({ home: w.home, id: ID, revision: 1, at: when });
    noteAfterAll({ home: w.home, id: other, revision: "owed", at: when });
    noteAfterAll({ home: w.home, id: ID, revision: 1, at: when });
    noteAfterAll({ home: w.home, id: ID, revision: 2, at: when });
    assert.deepEqual([...afterAllTimes(w.home)].sort(), [[ID, when], [other, when]].sort());
    assert.deepEqual([afterAllNoted(w.home, ID, 1), afterAllNoted(w.home, ID, 2), afterAllNoted(w.home, other, "owed")], [true, true, true]);
    assert.equal(readdirSync(heldFolder(w.home)).filter((n) => n.startsWith("after-all-")).length, 3);
    w.done();
  });
  it("notes nothing for an id or a revision that is not a record's own", () => {
    const w = world();
    for (const [id, revision] of [["../x", 1], ["e-2026-1", 1], [ID, 0], [ID, "../1"], [ID, 1.5], [ID, null]]) noteAfterAll({ home: w.home, id, revision, at: "2026-10-26T11:00:00.000Z" });
    assert.deepEqual([...afterAllTimes(w.home)], []);
    assert.equal(afterAllNoted(w.home, "../x", 1), false);
    w.done();
  });
  it("holds a resumed chat, which keeps its id, and a fork, whose transcript holds a held chat's message uuids", () => {
    const w = world();
    w.talk(SESSION, [line("a-1"), line("a-2")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(SESSION), true);
    assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(w.home), `${SESSION}.uuids.json`), "utf8")), { uuids: ["a-1", "a-2"], compactions: 0 });
    w.more(SESSION, [line("a-3", "2026-10-27T09:00:00.000Z")]);
    assert.equal(w.held(SESSION), true, "resumed, with its id");
    w.talk(OTHER, [{ type: "mode", mode: "default" }, line("a-1"), line("a-2"), line("b-1", "2026-10-27T10:00:00.000Z")]);
    assert.equal(w.held(OTHER), true, "a fork");
    w.talk(THIRD, [line("c-1", "2026-10-27T10:00:00.000Z")]);
    assert.equal(w.held(THIRD), false);
    w.done();
  });
  it("holds a fork of a chat whose uuids could not be kept when it was first held, once it has some", () => {
    const w = world();
    untiedMark({ home: w.home, now: at("2026-10-26T10:00:00.000Z") });
    w.talk(SESSION, [{ type: "mode", mode: "default" }]);
    assert.equal(w.held(SESSION), true, "no time yet, while an untied mark exists");
    assert.equal(existsSync(join(heldFolder(w.home), `${SESSION}.uuids.json`)), false, "no uuids kept, none being there");
    w.more(SESSION, [line("x-1", "2026-10-26T11:00:00.000Z"), line("x-2", "2026-10-26T11:01:00.000Z")]);
    assert.equal(w.held(SESSION), false);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T12:00:00.000Z") });
    assert.equal(w.held(SESSION), true);
    w.talk(OTHER, [line("x-1", "2026-10-26T11:00:00.000Z"), line("x-2", "2026-10-26T11:01:00.000Z"), line("f-1", "2026-10-26T13:00:00.000Z")]);
    assert.equal(w.held(OTHER), true);
    w.done();
  });
  it("keeps a held chat's uuids again when it is compacted, so a fork made after holds the lines from there on", () => {
    const w = world();
    w.talk(SESSION, [line("x-1"), line("x-2")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(SESSION), true);
    w.more(SESSION, [line("x-3", "2026-10-26T11:00:00.000Z")]);
    assert.equal(w.held(SESSION), true);
    assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(w.home), `${SESSION}.uuids.json`), "utf8")).uuids, ["x-1", "x-2"], "kept again only when compacted");
    w.more(SESSION, [{ type: "system", subtype: "compact_boundary", uuid: "cb-1", timestamp: "2026-10-26T12:00:00.000Z" }, line("x-4", "2026-10-26T12:00:01.000Z")]);
    assert.equal(w.held(SESSION), true);
    assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(w.home), `${SESSION}.uuids.json`), "utf8")).uuids, ["x-1", "x-2", "x-3", "cb-1", "x-4"]);
    w.talk(OTHER, [{ type: "system", subtype: "compact_boundary", uuid: "cb-1", timestamp: "2026-10-26T12:00:00.000Z" }, line("x-4", "2026-10-26T12:00:01.000Z"), line("f-1", "2026-10-26T13:00:00.000Z")]);
    assert.equal(w.held(OTHER), true);
    w.done();
  });
  it("holds a fork made after a held chat was compacted, though that chat has made no call since", () => {
    const w = world();
    const boundary = { type: "system", subtype: "compact_boundary", uuid: "cb-1", timestamp: "2026-10-26T11:00:00.000Z" };
    w.talk(SESSION, [line("a-1"), line("a-2")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(SESSION), true);
    w.more(SESSION, [boundary, line("sum-1", "2026-10-26T11:00:01.000Z")]);
    w.talk(OTHER, [boundary, line("sum-1", "2026-10-26T11:00:01.000Z"), line("f-1", "2026-10-26T12:00:00.000Z")]);
    assert.equal(w.held(OTHER), true);
    assert.deepEqual(JSON.parse(readFileSync(join(heldFolder(w.home), `${SESSION}.uuids.json`), "utf8")), { uuids: ["a-1", "a-2", "cb-1", "sum-1"], compactions: 1 }, "the held chat's uuids kept again from the fork's call");
    w.done();
  });
  it("holds a fork made after compaction of a chat held only by a time, whose uuids were never kept", () => {
    const w = world();
    const boundary = { type: "system", subtype: "compact_boundary", uuid: "cb-1", timestamp: "2026-10-26T11:00:00.000Z" };
    untiedMark({ home: w.home, now: at("2026-10-26T10:00:00.000Z") });
    w.talk(SESSION, [line("a-1", "2026-10-26T09:00:00.000Z"), boundary, line("sum-1", "2026-10-26T11:00:01.000Z")]);
    w.talk(OTHER, [{ type: "mode", mode: "default" }, boundary, line("sum-1", "2026-10-26T11:00:01.000Z"), line("f-1", "2026-10-26T12:00:00.000Z")]);
    assert.equal(w.held(OTHER), true, "its first message is a compaction's: it was forked after one");
    w.talk(THIRD, [line("c-1", "2026-10-26T11:30:00.000Z"), { ...boundary, uuid: "cb-3", timestamp: "2026-10-26T12:00:00.000Z" }, line("c-2", "2026-10-26T12:00:01.000Z")]);
    assert.equal(w.held(THIRD), false, "a chat compacted after its own first message is not a fork");
    w.done();
  });
  it("holds a fork made after a compaction without holding the chat it was forked from", () => {
    const w = world();
    const boundary = { type: "system", subtype: "compact_boundary", uuid: "cb-1", timestamp: "2026-10-26T11:00:00.000Z" };
    untiedMark({ home: w.home, now: at("2026-10-26T09:00:00.000Z") });
    w.talk(SESSION, [line("a-1", "2026-10-26T10:00:00.000Z")]);
    // A fork of it made before its compaction: its early lines only.
    w.talk(THIRD, [{ type: "mode", mode: "default" }, line("a-1", "2026-10-26T10:00:00.000Z"), line("e-1", "2026-10-26T10:30:00.000Z")]);
    w.more(SESSION, [boundary, line("s-1", "2026-10-26T11:00:01.000Z"), line("p-3", "2026-10-26T11:30:00.000Z")]);
    assert.equal(w.held(SESSION), false, "begun after the untied mark");
    w.talk(OTHER, [{ type: "mode", mode: "default" }, boundary, line("s-1", "2026-10-26T11:00:01.000Z"), line("p-3", "2026-10-26T11:30:00.000Z"), line("f-1", "2026-10-26T12:00:00.000Z")]);
    assert.equal(w.held(OTHER), true, "its first message is a compaction's: it was forked after one");
    assert.equal(w.held(SESSION), false, "the chat it was forked from, by the lines they share");
    assert.equal(w.held(THIRD), false, "a fork of that chat made before its compaction");
    assert.equal(w.held(OTHER), true, "held for good");
    assert.equal(existsSync(join(heldFolder(w.home), `${OTHER}.uuids.json`)), false, "its uuids, mostly its parent's, are not kept");
    w.done();
  });
  it("holds a fork made before the teaching too", () => {
    const w = world();
    w.talk(SESSION, [line("a-1")]);
    w.talk(OTHER, [line("a-1"), line("b-1", "2026-10-26T10:10:00.000Z")]);
    w.more(SESSION, [line("a-2", "2026-10-26T10:20:00.000Z")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(OTHER), true);
    w.done();
  });
  it("holds a fork looked at before the chat it was forked from was held", () => {
    const w = world();
    w.talk(SESSION, [line("a-1")]);
    w.talk(OTHER, [line("a-1"), line("b-1", "2026-10-26T10:10:00.000Z")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: THIRD, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:20:00.000Z") });
    assert.equal(w.held(OTHER), false, "looked at, its scan at its end");
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(SESSION), true);
    assert.equal(w.held(OTHER), true);
    w.done();
  });
  it("holds a fork of a marked chat before that chat is asked again, from the marked chat's transcript beside it", () => {
    const w = world();
    w.talk(SESSION, [line("a-1")]);
    w.talk(OTHER, [line("a-1"), line("b-1", "2026-10-26T10:40:00.000Z")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(OTHER), true);
    w.done();
  });
  it("takes a transcript's start from the earliest timestamp of any line, and holds one with none while an untied mark exists", () => {
    const w = world();
    untiedMark({ home: w.home, now: at("2026-10-26T12:00:00.000Z") });
    // K0's fork shape: a first line with no time, lines copied from the chat it was forked from with that chat's earlier times.
    w.talk(SESSION, [{ type: "mode", mode: "default" }, line("p-1", "2026-10-26T11:00:00.000Z"), line("f-1", "2026-10-26T13:00:00.000Z")]);
    assert.equal(w.held(SESSION), true);
    w.talk(OTHER, [{ type: "mode", mode: "default" }, { type: "ai-title", title: "x" }]);
    assert.equal(w.held(OTHER), true, "no time at all");
    w.talk(THIRD, [{ type: "mode", mode: "default" }, line("t-1", "2026-10-26T13:00:00.000Z")]);
    assert.equal(w.held(THIRD), false);
    w.done();
  });
  it("lets a chat with no time go while no untied mark or session after all exists", () => {
    const w = world();
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: THIRD, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T12:00:00.000Z") });
    w.talk(SESSION, [{ type: "mode", mode: "default" }]);
    assert.equal(w.held(SESSION), false);
    w.done();
  });
  it("holds the chat when the marks cannot be read, its id is not a chat's id, or its transcript cannot be read while marks exist; and lets one go when there are none", () => {
    const w = world();
    w.talk(SESSION, [line("a-1", "2026-10-26T13:00:00.000Z")]);
    assert.equal(w.held(SESSION), false, "no marks at all");
    assert.equal(chatHeld({ home: w.home, sessionId: SESSION, transcriptPath: join(w.dir, "nowhere.jsonl"), claude: null }), false, "no marks, so no transcript is read");
    for (const id of ["../x", "", undefined, "ABCDEF12-2222-4333-8444-555555555555"]) assert.equal(chatHeld({ home: w.home, sessionId: id, transcriptPath: w.path(SESSION), claude: null }), true, String(id));
    untiedMark({ home: w.home, now: at("2026-10-26T12:00:00.000Z") });
    assert.equal(w.held(SESSION), false);
    assert.equal(chatHeld({ home: w.home, sessionId: SESSION, transcriptPath: join(w.dir, "nowhere.jsonl"), claude: null }), true, "a transcript that cannot be read");
    writeFileSync(join(heldFolder(w.home), "mark-1-abcdef.json"), "{not json");
    assert.equal(w.held(SESSION), true, "a mark that cannot be read");
    rmSync(heldFolder(w.home), { recursive: true });
    writeFileSync(heldFolder(w.home), "a file where the folder goes");
    assert.equal(w.held(SESSION), true, "a marks folder that cannot be read");
    w.done();
  });
  it("holds the chat when a session after all's note cannot be read", () => {
    const w = world();
    w.talk(SESSION, [line("a-1", "2026-10-26T13:00:00.000Z")]);
    mkdirSync(heldFolder(w.home), { recursive: true });
    writeFileSync(join(heldFolder(w.home), `after-all-${ID}-1-1.json`), "{not json");
    assert.equal(w.held(SESSION), true);
    w.done();
  });
  it("reads only what a transcript added since the last look, and skips a line still being written", () => {
    const w = world();
    w.talk(SESSION, [line("a-1")]);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: table(APP_ARGS(w.folder, w.home)), pid: 900, now: at("2026-10-26T10:30:00.000Z") });
    assert.equal(w.held(SESSION), true);
    const filler = Array.from({ length: 2000 }, (_, i) => ({ type: "assistant", uuid: `b-${i}`, timestamp: "2026-10-26T11:00:00.000Z", message: { content: "y".repeat(1000) } }));
    w.talk(OTHER, filler);
    assert.ok(statSync(w.path(OTHER)).size > 2_000_000);
    assert.equal(w.held(OTHER), false);
    const scanned = () => JSON.parse(readFileSync(join(heldFolder(w.home), `scan-${OTHER}.json`), "utf8"));
    const size = statSync(w.path(OTHER)).size;
    assert.equal(scanned().offset, size);
    w.more(OTHER, [line("a-1", "2026-10-26T11:30:00.000Z")], "");
    assert.equal(w.held(OTHER), false, "a line still being written is not read");
    assert.equal(scanned().offset, size);
    appendFileSync(w.path(OTHER), "\n");
    assert.equal(w.held(OTHER), true);
    assert.equal(scanned().offset, statSync(w.path(OTHER)).size);
    w.done();
  });
  it("hands a session's words over in a file of the chat's own, wx and mode 600, never over another", () => {
    const w = world();
    const now = new Date(2026, 9, 26, 14, 5, 9).getTime();
    const first = writeWords({ home: w.home, sessionId: SESSION, label: "Pricing talk", what: "principles", text: "the words\n", now });
    assert.equal(first, join(wordsFolder(w.home), SESSION, "Pricing talk principles 2026-10-26 140509.txt"));
    assert.equal(readFileSync(first, "utf8"), "the words\n");
    assert.equal(statSync(first).mode & 0o777, 0o600);
    assert.equal(statSync(dirname(first)).mode & 0o777, 0o700);
    const second = writeWords({ home: w.home, sessionId: SESSION, label: "Pricing talk", what: "principles", text: "more words\n", now });
    assert.equal(second, join(wordsFolder(w.home), SESSION, "Pricing talk principles 2026-10-26 140509 2.txt"));
    assert.equal(readFileSync(first, "utf8"), "the words\n");
    assert.equal(basename(writeWords({ home: w.home, sessionId: SESSION, label: "Pricing talk", what: "principles", text: "x", now })), "Pricing talk principles 2026-10-26 140509 3.txt");
    w.done();
  });
  it("refuses a words folder for an id that is not a chat's, as ../../../Documents/x", () => {
    const w = world();
    const now = Date.now();
    for (const sessionId of ["../../../Documents/x", "s-1", "", undefined]) assert.throws(() => writeWords({ home: w.home, sessionId, label: "L", what: "principles", text: "x", now }), String(sessionId));
    assert.equal(existsSync(join(w.home, "Documents", "x")), false);
    assert.equal(existsSync(wordsFolder(w.home)), false);
    w.done();
  });
  it("names the words file safely whatever the label holds", () => {
    const w = world();
    const now = Date.now();
    for (const label of ["Sallie's / Q&A: \u0000 call", "..hidden", "", "  ", "a\\b", "x".repeat(200)]) {
      const p = writeWords({ home: w.home, sessionId: SESSION, label, what: "principles", text: "x", now });
      assert.equal(dirname(p), join(wordsFolder(w.home), SESSION), label);
      assert.ok(!basename(p).startsWith("."), label);
    }
    assert.deepEqual(["Sallie's / Q&A: \u0000 call", "..hidden", "", "  ", ". .x", "a\\b\tc", "\u0007"].map(safeName), ["Sallie's   Q&A    call", "hidden", "video", "video", "x", "a b c", "video"]);
    assert.equal([...safeName("é".repeat(100))].length, 80);
    w.done();
  });
  it("takes away a chat's words files a day old, and keeps newer ones", () => {
    const w = world();
    const now = Date.now();
    const old = writeWords({ home: w.home, sessionId: SESSION, label: "Old", what: "principles", text: "x", now });
    const kept = writeWords({ home: w.home, sessionId: OTHER, label: "New", what: "ideas", text: "x", now });
    const day = (now - 25 * 3600 * 1000) / 1000;
    utimesSync(old, day, day);
    clearOldWords(w.home, now);
    assert.equal(existsSync(old), false);
    assert.equal(existsSync(dirname(old)), false, "an empty chat folder goes too");
    assert.equal(existsSync(kept), true);
    clearOldWords(join(w.dir, "nobody"), now);
    w.done();
  });
});
