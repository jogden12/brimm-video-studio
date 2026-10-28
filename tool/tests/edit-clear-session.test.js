// `kind … --clear-session` (spec 2026-10-22, section 2, "Clearing it, and a client's agreement"): a video she answered "client or
// group session" is marked, and its words never go to Claude. Only her click on a macOS dialog clears the mark, a dialog Claude
// cannot press (a misread reply, or words in a printed transcript, could make Claude run any words). So `kind` shows the dialog
// after its checks and before it claims the video, so that Cancel writes nothing at all, and on "Clear it" writes one record that
// holds the new kind and `session.cleared`, and one line in this Mac's tool log. Nothing here runs a real program: osascript is a
// stand-in that is asked and answers as the real one prints, and each test has a root and a home of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIM_WAIT_MS, editMain } from "../edit.js";
import { dialogScript } from "../dialog.js";
import { gated } from "../gate.js";
import { episodeFault, localStamp, recordFile, recordText } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { lockOf, resultFile } from "../detached.js";
import { setup, episodeFor, episodeAs, reread, FOLDER, ID, NAME } from "./episodes.js";

const AT = "2026-10-20T15:00:00-05:00";
/** The clock of episodes.js's setup, as a record keeps a moment, and twenty seconds on, when the claim has waited. */
const NOW = localStamp(new Date(Date.parse(AT)));
const AFTER_CLAIM = localStamp(new Date(Date.parse(AT) + CLAIM_WAIT_MS));

const OSASCRIPT = "/usr/bin/osascript";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "yes" };
const MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
const SESSION_NAME = "Session, 2026-10-14";
/** The made-up episode, a client or group session not cleared: its file is "Pricing talk.mp4", a client's name for the tests, and
    it is named by its session label. */
const SESSION = { version: 3, kind: "session", answer: ANSWERED, session: MARK, name: { text: SESSION_NAME, placeholder: false }, label: "Video of 14 Oct, 09:00 (Mac Studio)" };
const secret = /pricing/i;

// The words a person reads, and the dialog's.
/** What she is told as the dialog opens: it names the video by its label. */
const CLICK = (label = SESSION_NAME) => `A dialog is open on this Mac for ${label}: click "Clear it" to clear its session mark, or Cancel.`;
const NOT_CLEARED = "Not cleared: the session mark stays.";
/** The spec's sentence, word for word; the dialog's text is the label on a line of its own, a blank line, and this. */
const SENTENCE = "This was marked a client or group session. Clearing it lets Claude read its words and lets its transcript go to the BRIMM Ops page. Clear it?";
const DIALOG = (label = SESSION_NAME) => `${label}\n\n${SENTENCE}`;
const TOO_LONG = "Not cleared: the dialog was open too long for this to finish in time. Say it again, and click within a minute.";
const LOG_FAILED = "The log on this Mac could not be written: the record holds the clearing.";
const TIMED_OUT = "Not cleared: the dialog was not answered within a minute, so it was closed. The session mark stays.";
/** What runProgram gives of a program it killed at its limit: no output, and it says it was out of time. */
const OUT_OF_TIME = { code: 1, signal: "SIGKILL", outOfTime: true, stderr: "" };
const UNREADABLE_MARK = (label) => `${label}'s session mark cannot be read: ask Jason.`;
const SESSION_TARGET = "That video is a client or group session, so this new version is one too: answer it as a session.";
const RUNNING = /^Not cleared: read is running for .* already\. Say it again when it has finished\.$/;
const WITH_SESSION = "A session mark is cleared by answering what the video really is: finished, raw or clip.";
const MARK_STAYS = 'This was marked a client or group session. Clearing the mark needs your click on this Mac: say "clear the session mark".';
const NO_MARK = (name) => `${name} has no session mark to clear.`;
const SESSION_SET = (name) => `${name} would be a version of a client or group session: answer it as a session, or ask Jason. Nothing was written.`;
const CLEARED = (name, kind) => `${name}: the session mark is cleared, by your click. It is now ${kind}.`;

// What the stand-in osascript prints, as the real one does (dialog.test.js).
const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
const CANCELED = { code: 1, stdout: "", stderr: "execution error: User canceled. (-128)" };
const UNREADABLE = { code: 0, stdout: "", stderr: "" };

/** The kinds she can clear a session into: the word, how the record keeps it, and how it is said. */
const KINDS = [["finished", "finished", "finished by your editor"], ["raw", "raw", "raw with retakes"], ["clip", "short video", "an iPhone clip"]];

/** The made-up episode as a session, with `over` laid on its record. */
const sessionOf = (t, over = {}) => episodeFor(t, { record: { ...SESSION, ...over } });

/** Run edit.js with a stand-in for osascript that answers `answer` (a reply, or a function that gives or throws one), and
    records what it was asked, and what had been said, the record's number and the waits so far when it was asked. `during` is done
    inside the dialog, as the other Mac's work is while it is open. Other deps are laid over this Mac's. */
function dialogs(t, found, answer, { during, ...deps } = {}) {
  const asked = [];
  const said = [];
  const run = async (cmd, args, opts) => {
    if (cmd !== OSASCRIPT) return t.ctx.deps.run(cmd, args, opts);
    asked.push({ cmd, args, opts, saidBefore: [...said], revBefore: reread(found).rev, waitsBefore: [...t.waits] });
    if (during) await during();
    return typeof answer === "function" ? answer() : answer;
  };
  return {
    asked,
    said,
    async ask(...argv) {
      const from = said.length;
      const code = await editMain(argv, { ...t.ctx.deps, ...deps, run, say: (line) => said.push(line) });
      const lines = said.slice(from);
      return { code, said: lines, text: lines.join("\n") };
    }
  };
}

/** The clearing she asks for: the session's name, what it really is, and the flags. */
const clearing = (kind, ...more) => ["kind", SESSION_NAME, kind, "--private", "no", "--again", "--clear-session", ...more];

/** Every record of the episode, whole, by its file's name. */
const recordsOf = (found) => readdirSync(join(found.folder, "record")).map((name) => [name, readFileSync(join(found.folder, "record", name), "utf8")]);
/** This Mac's tool log, as a detached run writes it. */
const logOf = (t) => join(t.home, "Library", "Logs", "brimm-video.log");
const answerLock = (t) => join(episodeWork(t.home, FOLDER), "answer.lock");
/** The result a `read` run leaves, as runDetached writes one: the reading is done by the time it is looked for. */
function leaveResult(t) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  writeFileSync(resultFile(t.home, FOLDER, "read"), JSON.stringify({ version: 1, command: "read", started: t.now() - 5000, ended: t.now(), ok: true, made: ["notes.txt"], failed: [], next: "" }));
}
/** Have the stand-in wait do `then` on every wait of `ms` milliseconds, after it has moved the clock. */
const duringWaits = (t, ms, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (asked) => {
    await wait(asked);
    if (asked === ms) await then();
  };
};

/** Nothing was written, claimed, started or logged, and no lock is left: the records as they were. */
function unchanged(t, found, before, why = "") {
  assert.deepEqual(recordsOf(found), before, why);
  assert.deepEqual([t.started, t.waits, existsSync(logOf(t)), existsSync(answerLock(t))], [[], [], false, false], why);
}

describe("kind --clear-session: asking on a dialog Claude cannot press", () => {
  it("tells her to click, shows one dialog that names the video and has her words and the buttons Cancel and Clear it, before anything is written", async () => {
    const t = setup();
    const found = sessionOf(t);
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(d.asked.length, 1);
    const [call] = d.asked;
    assert.deepEqual([call.cmd, call.args.length, call.args[0]], [OSASCRIPT, 2, "-e"]);
    assert.equal(call.args[1], dialogScript(DIALOG(), { buttons: ["Cancel", "Clear it"] }));
    // The script holds the video's label on a line of its own, a blank line, the spec's sentence word for word, and the two buttons,
    // and Cancel is the default button: a stray Return cancels. It names no file, which is a client's.
    assert.ok(call.args[1].includes(`"${SESSION_NAME}\n\n${SENTENCE}"`), call.args[1]);
    assert.ok(call.args[1].includes('buttons {"Cancel", "Clear it"} default button 1'), call.args[1]);
    assert.doesNotMatch(call.args[1], secret);
    // It said to click, naming the video, before the dialog opened, and the record was as she found it: no claim, no wait.
    assert.deepEqual([call.saidBefore, call.revBefore, call.waitsBefore], [[CLICK()], 1, []]);
    t.done();
  });
  it("writes nothing when she clicks Cancel, or the answer is not her click on Clear it: no claim, no log, no reading", async () => {
    // What she is then told: for Cancel the mark stays, and for a dialog that gave no click, why, in dialog.js's words.
    const READ = "Not cleared: The dialog's answer could not be read. The session mark stays.";
    const answers = [
      ["Cancel", CANCELED, NOT_CLEARED],
      ["Escape, which ends the script as Cancel does", { code: 1, stdout: "", stderr: "0:62: execution error: User canceled. (-128)\n" }, NOT_CLEARED],
      ["a reply that is no button", UNREADABLE, READ],
      ["Cancel printed as a button", { code: 0, stdout: "button returned:Cancel\n", stderr: "" }, NOT_CLEARED],
      ["a button that was not shown", { code: 0, stdout: "button returned:Clear\n", stderr: "" }, READ],
      ["osascript ended with an error", { code: 2, stdout: "", stderr: "not allowed to send keystrokes" }, "Not cleared: The dialog could not be shown (osascript ended with code 2). The session mark stays."],
      ["osascript not starting", () => { throw new Error("spawn /usr/bin/osascript ENOENT"); }, "Not cleared: The dialog could not be shown. The session mark stays."]
    ];
    for (const [what, answer, told] of answers) {
      const t = setup();
      const found = sessionOf(t);
      const before = recordsOf(found);
      const d = dialogs(t, found, answer);
      const r = await d.ask(...clearing("raw"));
      assert.deepEqual([r.code, r.said], [1, [CLICK(), told]], what);
      assert.equal(d.asked.length, 1, what);
      unchanged(t, found, before, what);
      assert.deepEqual([reread(found).rev, gated(reread(found)), reread(found).session.cleared], [1, true, null], what);
      assert.doesNotMatch(r.text, secret, what);
      t.done();
    }
  });
  it("clears the mark on her click: one write holding the new kind, the answer again, and the mark cleared by the dialog", async () => {
    for (const [word, kept, said] of KINDS) {
      const t = setup();
      // This Mac's app is on, so the working copy is asked for beside the reading (and only then).
      writeSettings(t.home, { app: "hyperframes" });
      const found = sessionOf(t, { session: { ...MARK, teachings: "transcript only" } });
      duringWaits(t, 1000, () => leaveResult(t));
      const d = dialogs(t, found, CLEAR_IT);
      const r = await d.ask("kind", SESSION_NAME, word, "--private", "no", "--again", "--clear-session");
      assert.equal(r.code, 0, `${word}: ${r.text}`);
      const record = reread(found);
      assert.deepEqual([record.kind, record.rev], [kept, 3], word);
      assert.deepEqual(record.session, { marked: AT, on: "Mac Studio", teachings: "transcript only", cleared: { at: AFTER_CLAIM, on: "Mac Studio", to: kept, confirmed: "dialog" } }, word);
      assert.deepEqual(record.answer, { ...ANSWERED, state: "answered", by: "Mac Studio", on: "Mac Studio", at: AFTER_CLAIM, private: "no" }, word);
      assert.deepEqual([record.name, record.label, record.versionOf], [{ text: SESSION_NAME, placeholder: false }, SESSION.label, null], word);
      assert.equal(gated(record), false, word);
      // The claim stays, as for every answer that is not a session: the reading runs under it.
      assert.deepEqual(record.editing, { by: "Mac Studio", since: NOW }, word);
      // The claim was one write, and the clearing the next and last: nothing was cleared before her click.
      const claim = JSON.parse(readFileSync(recordFile(found.folder, 2), "utf8"));
      assert.deepEqual([claim.kind, claim.session.cleared, claim.editing.by], ["session", null, "Mac Studio"], word);
      assert.deepEqual(readdirSync(join(found.folder, "record")), ["0001.json", "0002.json", "0003.json"], word);
      // The reading is started as for any answer, under the kind, and its result is said.
      // A session cleared as a raw video or an iPhone clip is an ordinary one: its working copy is started beside the reading.
      assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER, "--kind", kept, "--rev", "3"], ...(kept === "finished" ? [] : [["workcopy", "--now", FOLDER]])], word);
      assert.deepEqual(r.said, [CLICK(), CLEARED(SESSION_NAME, said), `${SESSION_NAME}: read ended 0 minutes ago. Made: notes.txt.`], word);
      assert.doesNotMatch(r.text, secret, word);
      t.done();
    }
  });
  it("keeps the claim it has, and does not wait, when this Mac has the video open already", async () => {
    const t = setup();
    const since = "2026-10-20T14:00:00-05:00";
    const found = sessionOf(t, { editing: { by: "Mac Studio", since } });
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...clearing("finished"));
    assert.deepEqual(r.said.slice(0, 2), [CLICK(), CLEARED(SESSION_NAME, "finished by your editor")]);
    const record = reread(found);
    assert.deepEqual([record.rev, record.kind, record.editing.since, record.session.cleared.to, t.waits.includes(CLAIM_WAIT_MS)], [2, "finished", since, "finished", false]);
    t.done();
  });
  it("says the answer is kept and no reading is started when this Mac's settings say readings are off", async () => {
    const t = setup();
    const found = sessionOf(t);
    const d = dialogs(t, found, CLEAR_IT, { settings: { ...t.ctx.settings, readings: false } });
    const r = await d.ask(...clearing("raw"));
    assert.deepEqual([r.code, r.said], [0, [CLICK(), CLEARED(SESSION_NAME, "raw with retakes"), `${SESSION_NAME}: answered. Readings are off on this Mac: ask Jason.`]]);
    assert.deepEqual([reread(found).kind, gated(reread(found)), t.started], ["raw", false, []]);
    t.done();
  });
});

describe("kind --clear-session: every way the dialog ends prints a line of its own, after the line that says it is open", () => {
  /** What the dialog's run is given by edit.js: a limit of a minute, and the printing of the answer to read. */
  const givenALimit = (d) => {
    assert.equal(d.asked.length, 1);
    assert.equal(d.asked[0].opts.limit, 60000);
    assert.ok(d.asked[0].opts.out > 0, JSON.stringify(d.asked[0].opts));
  };
  /** The lines she is shown: the line that says the dialog is open, and then at once the ending's own line (not the reading's). */
  const endsWith = (r, ending) => assert.deepEqual(r.said.slice(0, 2), [CLICK(), ending]);
  it("ending: her click on Clear it, which is followed by the cleared line", async () => {
    const t = setup();
    const found = sessionOf(t);
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    endsWith(r, CLEARED(SESSION_NAME, "raw with retakes"));
    givenALimit(d);
    t.done();
  });
  it("ending: her click on Clear it, when the clearing is then refused, which is followed by a line that says it was not cleared", async () => {
    const t = setup();
    const found = sessionOf(t);
    const d = dialogs(t, found, CLEAR_IT, {
      alive: (pid) => pid === 4242,
      during: () => {
        mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
        writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" }));
      }
    });
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 1);
    assert.equal(r.said.length, 2);
    assert.match(r.said[1], RUNNING);
    assert.equal(r.said[0], CLICK());
    givenALimit(d);
    t.done();
  });
  it("ending: Cancel, which is followed by 'Not cleared: the session mark stays.'", async () => {
    const t = setup();
    const found = sessionOf(t);
    const before = recordsOf(found);
    const d = dialogs(t, found, CANCELED);
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, [CLICK(), NOT_CLEARED]);
    givenALimit(d);
    unchanged(t, found, before);
    t.done();
  });
  it("ending: the dialog never opening, which is followed by 'Not cleared: <why> The session mark stays.'", async () => {
    // osascript failing, osascript not found (runProgram's 127 for a program that cannot start), a run that throws, and an answer that is no button.
    const endings = [
      [{ code: 2, stdout: "", stderr: "not allowed to send keystrokes" }, "Not cleared: The dialog could not be shown (osascript ended with code 2). The session mark stays."],
      [{ code: 127, stderr: "spawn /usr/bin/osascript ENOENT" }, "Not cleared: The dialog could not be shown (osascript ended with code 127). The session mark stays."],
      [() => { throw new Error("spawn /usr/bin/osascript ENOENT"); }, "Not cleared: The dialog could not be shown. The session mark stays."],
      [UNREADABLE, "Not cleared: The dialog's answer could not be read. The session mark stays."]
    ];
    for (const [answer, ending] of endings) {
      const t = setup();
      const found = sessionOf(t);
      const before = recordsOf(found);
      const d = dialogs(t, found, answer);
      const r = await d.ask(...clearing("raw"));
      assert.equal(r.code, 1, ending);
      assert.deepEqual(r.said, [CLICK(), ending]);
      givenALimit(d);
      unchanged(t, found, before, ending);
      t.done();
    }
  });
  it("ending: a timeout, when the dialog was not answered within a minute, which is followed by a line that says it was closed", async () => {
    const t = setup();
    const found = sessionOf(t);
    const before = recordsOf(found);
    const d = dialogs(t, found, OUT_OF_TIME);
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, [CLICK(), TIMED_OUT]);
    givenALimit(d);
    // Nothing is written: the record is byte-identical, there is no claim, no log line, no reading, and no lock is left.
    unchanged(t, found, before);
    assert.equal(gated(reread(found)), true);
    t.done();
  });
  it("ending: a timeout, whatever the killed run printed before it was closed: a click it seems to hold clears nothing", async () => {
    const t = setup();
    const found = sessionOf(t);
    const before = recordsOf(found);
    const d = dialogs(t, found, { ...CLEAR_IT, outOfTime: true });
    const r = await d.ask(...clearing("raw"));
    assert.deepEqual([r.code, r.said], [1, [CLICK(), TIMED_OUT]]);
    unchanged(t, found, before);
    t.done();
  });
});

describe("kind --clear-session: the log", () => {
  it("writes one line to this Mac's tool log, made if it is missing, naming the episode by its id and its label alone", async () => {
    const t = setup();
    const found = sessionOf(t);
    assert.equal(existsSync(join(t.home, "Library", "Logs")), false);
    assert.equal((await dialogs(t, found, CLEAR_IT).ask(...clearing("raw"))).code, 0);
    assert.equal(readFileSync(logOf(t), "utf8"), `${AFTER_CLAIM} ${ID} (${SESSION_NAME}): the session mark was cleared by a click on this Mac's dialog; it is now raw with retakes.\n`);
    assert.doesNotMatch(readFileSync(logOf(t), "utf8"), secret);
    t.done();
  });
  it("adds to the log a detached run writes, and leaves what is there", async () => {
    const t = setup();
    const found = sessionOf(t);
    mkdirSync(join(t.home, "Library", "Logs"), { recursive: true });
    writeFileSync(logOf(t), "an earlier line\n");
    assert.equal((await dialogs(t, found, CLEAR_IT).ask(...clearing("clip"))).code, 0);
    assert.equal(readFileSync(logOf(t), "utf8"), `an earlier line\n${AFTER_CLAIM} ${ID} (${SESSION_NAME}): the session mark was cleared by a click on this Mac's dialog; it is now an iPhone clip.\n`);
    t.done();
  });
  it("clears the mark all the same when the log cannot be written: the record holds it", async () => {
    const t = setup();
    const found = sessionOf(t);
    // A file where the log's folder is to be.
    mkdirSync(join(t.home, "Library"), { recursive: true });
    writeFileSync(join(t.home, "Library", "Logs"), "not a folder");
    const r = await dialogs(t, found, CLEAR_IT).ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(gated(reread(found)), false);
    // She is told, once, and it does not fail the command.
    assert.deepEqual(r.said.slice(0, 3), [CLICK(), CLEARED(SESSION_NAME, "raw with retakes"), LOG_FAILED]);
    assert.equal(r.said.filter((line) => line === LOG_FAILED).length, 1);
    t.done();
  });
});

describe("kind --clear-session: refused before any dialog", () => {
  /** The refusal, `words` in order, with the dialog never shown and nothing written, claimed, started or logged. */
  async function refused(t, found, argv, words, why) {
    const before = recordsOf(found);
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...argv);
    assert.deepEqual([r.code, r.said], [1, words], why);
    assert.equal(d.asked.length, 0, why);
    unchanged(t, found, before, why);
  }
  it("says a session mark is cleared by answering what the video really is, for a session answer", async () => {
    for (const argv of [clearing("session"), ["kind", SESSION_NAME, "session", "--private", "yes", "--again", "--clear-session"], ["kind", SESSION_NAME, "session", "--private", "yes", "--clear-session"], ["kind", SESSION_NAME, "session", "--private", "no", "--clear-session"]]) {
      const t = setup();
      const found = sessionOf(t);
      await refused(t, found, argv, [WITH_SESSION], argv.join(" "));
      t.done();
    }
  });
  it("says it is answered already, in today's words, without --again", async () => {
    const t = setup();
    const found = sessionOf(t);
    await refused(t, found, ["kind", SESSION_NAME, "raw", "--private", "no", "--clear-session"], [`${SESSION_NAME} is answered already: it is a client or group session. To change it, answer again with --again.`]);
    t.done();
  });
  it("says there is no mark to clear on a video that is no session, one whose mark is cleared already, and one not answered", async () => {
    const cleared = { ...MARK, cleared: { at: AT, on: "Mac Studio", to: "raw", confirmed: "dialog" } };
    const cases = [
      ["a finished video", { version: 3, kind: "finished", answer: { ...ANSWERED, private: "no" }, name: { text: NAME, placeholder: false } }, NAME],
      ["a video from before the switch", { name: { text: NAME, placeholder: false } }, NAME],
      ["a session whose mark is cleared", { ...SESSION, session: cleared, name: { text: "Talk with a friend", placeholder: false } }, "Talk with a friend"],
      ["a video not yet answered", { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide", came: "camera", match: null }, label: "Video of 14 Oct, 09:00 (Mac Studio)" }, "Video of 14 Oct, 09:00 (Mac Studio)"]
    ];
    for (const [what, record, name] of cases) {
      const t = setup();
      const found = episodeFor(t, { record });
      await refused(t, found, ["kind", name, "raw", "--private", "no", "--again", "--clear-session"], [NO_MARK(name)], what);
      t.done();
    }
  });
  it("refuses a session whose mark cannot be read, which would show the dialog and then fail at the write", async () => {
    // A record of kind session with no mark at all, or a null one, is a session not cleared to the gate, and has no mark to clear.
    for (const over of [{ session: undefined }, { session: null }]) {
      const t = setup();
      const found = sessionOf(t, over);
      assert.equal(gated(reread(found)), true);
      await refused(t, found, clearing("raw"), [UNREADABLE_MARK(SESSION_NAME)], JSON.stringify(over));
      t.done();
    }
  });
  it("refuses a video the other Mac has, and a detached run at work on it, in today's words", async () => {
    const t = setup();
    const found = sessionOf(t, { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
    await refused(t, found, clearing("raw"), [`${SESSION_NAME} is being answered on Sallie's laptop. Nothing was changed.`]);
    t.done();
    const u = setup();
    const at = sessionOf(u);
    mkdirSync(episodeWork(u.home, FOLDER), { recursive: true });
    writeFileSync(lockOf(u.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" }));
    const before = recordsOf(at);
    const d = dialogs(u, at, CLEAR_IT, { alive: (pid) => pid === 4242 });
    const r = await d.ask(...clearing("raw"));
    assert.deepEqual([r.code, d.asked.length, recordsOf(at), u.started, u.waits], [1, 0, before, [], []]);
    assert.match(r.text, /^read is running for .* already\. Say it again when it has finished\.$/);
    assert.doesNotMatch(r.text, secret);
    u.done();
  });
  it("clears a session that came from Zoom without asking whether it is one", async () => {
    const t = setup();
    const found = sessionOf(t, { answer: { ...ANSWERED, came: "zoom" } });
    // Her click says it is not one, so the question is not asked; without --clear-session the mark stays.
    const stays = dialogs(t, found, CLEAR_IT);
    const kept = await stays.ask("kind", SESSION_NAME, "raw", "--private", "no", "--again");
    assert.deepEqual([kept.code, kept.said, stays.asked.length], [1, [MARK_STAYS], 0]);
    const cleared = await dialogs(t, found, CLEAR_IT).ask(...clearing("raw"));
    assert.equal(cleared.code, 0, cleared.text);
    assert.equal(gated(reread(found)), false);
    t.done();
  });
  it("leaves the refusal of a session answered as another kind as it is, with no dialog, without --clear-session", async () => {
    for (const word of ["finished", "raw", "clip"]) {
      const t = setup();
      const found = sessionOf(t);
      await refused(t, found, ["kind", SESSION_NAME, word, "--private", "no", "--again"], [MARK_STAYS], word);
      t.done();
    }
  });
});

describe("kind --clear-session: the versions around the video", () => {
  const ELSEWHERE = "e-20261011-bbbbbb";
  const OTHER = "e-20261012-d4d4d4";
  const FINISHED_FIELDS = { version: 3, kind: "finished", answer: { ...ANSWERED, private: "no" } };
  const FINISHED = { revision: 1, at: AT, on: "Mac Studio" };
  /** Another episode on this Mac: a video answered as finished, unless `over` makes it another. */
  const video = (t, id, name, over = {}) => episodeAs(t, { id, name, record: { ...FINISHED_FIELDS, name: { text: name.replace(/^[\d-]+ | \(Mac Studio\)$/g, ""), placeholder: false }, label: `Video of ${id}`, ...over } });
  /** Another episode that is a session not cleared. */
  const otherSession = (t, id, name, over = {}) => video(t, id, name, { kind: "session", answer: ANSWERED, session: MARK, ...over });
  const refuses = async (t, found, argv, words) => {
    const before = recordsOf(found);
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...argv);
    assert.deepEqual([r.code, r.said, d.asked.length], [1, words, 0]);
    unchanged(t, found, before);
  };

  it("refuses a version of a video whose other versions hold a session not cleared, with no dialog", async () => {
    const t = setup();
    const found = sessionOf(t);
    video(t, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    otherSession(t, OTHER, "2026-10-12 Another (Mac Studio)", { versionOf: ELSEWHERE });
    await refuses(t, found, clearing("raw", "--version-of", ELSEWHERE), [SESSION_SET(SESSION_NAME)]);
    t.done();
  });
  it("refuses it when another session not cleared is a later version of this one", async () => {
    const t = setup();
    const found = sessionOf(t);
    otherSession(t, OTHER, "2026-10-12 Another (Mac Studio)", { versionOf: ID });
    video(t, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    await refuses(t, found, clearing("raw", "--version-of", ELSEWHERE), [SESSION_SET(SESSION_NAME)]);
    t.done();
  });
  it("does not take this session itself for the one in the set: it is the one being cleared", async () => {
    const t = setup();
    // It is already a version of the finished video, and the set it is in holds no other session.
    const found = sessionOf(t, { versionOf: ELSEWHERE });
    video(t, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    const r = await dialogs(t, found, CLEAR_IT).ask(...clearing("raw", "--version-of", ELSEWHERE));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).versionOf, gated(reread(found))], ["raw", ELSEWHERE, false]);
    t.done();
    // And another session in that set still refuses it.
    const u = setup();
    const there = sessionOf(u, { versionOf: ELSEWHERE });
    video(u, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    otherSession(u, OTHER, "2026-10-12 Another (Mac Studio)", { versionOf: ELSEWHERE });
    await refuses(u, there, clearing("raw", "--version-of", ELSEWHERE), [SESSION_SET(SESSION_NAME)]);
    u.done();
  });
  it("clears a session already handed off, which keeps the version it is of, and while another session is in that set holds it as one", async () => {
    const t = setup();
    const found = sessionOf(t, { versionOf: ELSEWHERE, finished: FINISHED });
    video(t, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    const r = await dialogs(t, found, CLEAR_IT).ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).versionOf], ["raw", ELSEWHERE]);
    t.done();
    // Each mark is cleared by a click of its own (final fix 17): the one cleared is held as a session while the other is marked,
    // and Claude reads nothing of it.
    const u = setup();
    const there = sessionOf(u, { versionOf: ELSEWHERE, finished: FINISHED });
    video(u, ELSEWHERE, "2026-10-11 Elsewhere (Mac Studio)");
    otherSession(u, OTHER, "2026-10-12 Another (Mac Studio)", { versionOf: ELSEWHERE });
    const held = await dialogs(u, there, CLEAR_IT).ask(...clearing("raw"));
    assert.deepEqual([held.code, held.said.slice(1)], [0, [`${SESSION_NAME}: the session mark is cleared, by your click. It is now raw with retakes.`, "Another version of it is still marked a client or group session, so it is held as one, and Claude reads nothing of it: once that mark is cleared too, say what it is again."]]);
    assert.deepEqual([reread(there).kind, reread(there).versionOf, reread(there).session.cleared.confirmed, u.started], ["raw", ELSEWHERE, "dialog", []]);
    u.done();
  });
});

describe("kind --clear-session: the mark cleared meanwhile", () => {
  const clearedBy = (mark, on) => ({ ...mark, cleared: { at: AFTER_CLAIM, on, to: "raw", confirmed: "dialog" } });
  const CHANGED = `Not cleared: ${SESSION_NAME} changed meanwhile: say your answer again.`;
  it("is refused after the claim, and the claim let go, when the record read again shows the mark cleared", async () => {
    const t = setup();
    const found = sessionOf(t);
    // While the claim waits, the other Mac's clearing is what the slot of this Mac's claim holds, with the claim on it.
    duringWaits(t, CLAIM_WAIT_MS, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev), recordText({ ...mine, kind: "raw", session: clearedBy(MARK, "Sallie's laptop") }));
    });
    const d = dialogs(t, found, CLEAR_IT);
    const r = await d.ask(...clearing("raw"));
    assert.deepEqual([r.code, r.said], [1, [CLICK(), `Not cleared: ${NO_MARK(SESSION_NAME)}`]]);
    // No second clearing is written. This Mac's claim is let go again, in one write, and the other Mac's clearing stands.
    assert.deepEqual(readdirSync(join(found.folder, "record")), ["0001.json", "0002.json", "0003.json"]);
    assert.deepEqual([reread(found).session.cleared.on, reread(found).editing, t.started, existsSync(logOf(t)), d.asked.length], ["Sallie's laptop", null, [], false, 1]);
    t.done();
  });
  it("writes nothing when the other Mac cleared it while the dialog was open: the record is not the one she was asked about", async () => {
    for (const editing of [null, { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" }]) {
      const t = setup();
      const found = sessionOf(t, { editing });
      const d = dialogs(t, found, CLEAR_IT, {
        during: () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, kind: "raw", session: clearedBy(MARK, "Sallie's laptop"), writer: { commit: "c709b57", on: "Sallie's laptop" } }))
      });
      const r = await d.ask(...clearing("raw"));
      assert.deepEqual([r.code, r.said], [1, [CLICK(), CHANGED]], String(editing));
      assert.deepEqual([readdirSync(join(found.folder, "record")), reread(found).session.cleared.on, t.started, t.waits, existsSync(logOf(t))], [["0001.json", "0002.json"], "Sallie's laptop", [], [], false], String(editing));
      t.done();
    }
  });
});

describe("kind --clear-session: what changed while the dialog was open (the claim held or not)", () => {
  const HELD = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
  const ELSEWHERE = "e-20261011-bbbbbb";
  it("is refused, before the claim or the write, when a detached run starts on the episode meanwhile", async () => {
    for (const editing of [null, HELD]) {
      const t = setup();
      const found = sessionOf(t, { editing });
      const before = recordsOf(found);
      const d = dialogs(t, found, CLEAR_IT, {
        alive: (pid) => pid === 4242,
        during: () => {
          mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
          writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" }));
        }
      });
      const r = await d.ask(...clearing("raw"));
      assert.equal(r.code, 1, String(editing));
      assert.equal(r.said[0], CLICK());
      assert.match(r.said[1], RUNNING, String(editing));
      assert.equal(r.said.length, 2);
      assert.doesNotMatch(r.text, secret);
      assert.deepEqual([recordsOf(found), gated(reread(found)), t.started, t.waits, existsSync(logOf(t))], [before, true, [], [], false], String(editing));
      t.done();
    }
  });
  it("is refused when the video it is a new version of is marked a session meanwhile, and nothing is copied or cleared", async () => {
    for (const editing of [null, HELD]) {
      const t = setup();
      const found = sessionOf(t, { editing });
      const target = episodeAs(t, { id: ELSEWHERE, name: "2026-10-11 Elsewhere (Mac Studio)", record: { version: 3, kind: "finished", answer: { ...ANSWERED, private: "no" }, name: { text: "Elsewhere", placeholder: false }, label: "Video of 11 Oct", spellings: [["Sally", "Sallie"]] } });
      const before = recordsOf(found);
      const d = dialogs(t, found, CLEAR_IT, {
        during: () => writeFileSync(recordFile(target.folder, 2), recordText({ ...reread(target), rev: 2, kind: "session", answer: ANSWERED, session: MARK }))
      });
      const r = await d.ask(...clearing("raw", "--version-of", ELSEWHERE));
      assert.deepEqual([r.code, r.said], [1, [CLICK(), `Not cleared: ${SESSION_TARGET}`]], String(editing));
      assert.deepEqual([recordsOf(found), gated(reread(found)), reread(found).spellings, t.started, t.waits, existsSync(logOf(t))], [before, true, [], [], [], false], String(editing));
      t.done();
    }
  });
  it("is refused, before the claim is written, when she clicked too late for the claim's wait to finish within the command's time", async () => {
    const t = setup();
    const found = sessionOf(t);
    const before = recordsOf(found);
    // The command began at the clock's start; the dialog stays open 85 seconds, and the claim would wait 20 more.
    const d = dialogs(t, found, CLEAR_IT, { during: () => t.ctx.deps.wait(85000) });
    const r = await d.ask(...clearing("raw"));
    assert.deepEqual([r.code, r.said], [1, [CLICK(), TOO_LONG]]);
    assert.deepEqual([recordsOf(found), gated(reread(found)), t.started, t.waits, existsSync(logOf(t)), existsSync(answerLock(t))], [before, true, [], [85000], false, false]);
    t.done();
  });
  it("clears all the same when she clicks as late as 80 seconds in, which is the last the claim's wait fits", async () => {
    const t = setup();
    const found = sessionOf(t);
    const d = dialogs(t, found, CLEAR_IT, { during: () => t.ctx.deps.wait(80000) });
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([gated(reread(found)), t.waits.filter((ms) => ms === CLAIM_WAIT_MS).length], [false, 1]);
    t.done();
  });
  it("does not refuse a late click when this Mac holds the claim already: there is no claim to wait for", async () => {
    const t = setup();
    const found = sessionOf(t, { editing: HELD });
    const d = dialogs(t, found, CLEAR_IT, { during: () => t.ctx.deps.wait(85000) });
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, gated(reread(found)), t.waits.includes(CLAIM_WAIT_MS)], ["raw", false, false]);
    t.done();
  });
});

describe("kind --clear-session: a refusal after her click", () => {
  it("lets this Mac's claim go again and says it was not cleared, when a detached run starts during the claim's wait", async () => {
    const t = setup();
    const found = sessionOf(t);
    duringWaits(t, CLAIM_WAIT_MS, () => {
      mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
      writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" }));
    });
    const d = dialogs(t, found, CLEAR_IT, { alive: (pid) => pid === 4242 });
    const r = await d.ask(...clearing("raw"));
    assert.equal(r.code, 1);
    assert.equal(r.said[0], CLICK());
    assert.match(r.said[r.said.length - 1], RUNNING);
    assert.doesNotMatch(r.text, secret);
    // The record is the session it was, nobody has it, and the claim was one write and the letting go of it another.
    const record = reread(found);
    assert.deepEqual([record.kind, gated(record), record.editing, record.session.cleared, record.rev], ["session", true, null, null, 3]);
    assert.deepEqual([t.started, existsSync(logOf(t)), existsSync(answerLock(t))], [[], false, false]);
    t.done();
  });
  it("says it was not cleared when the other Mac took the video during the claim wait, and leaves the claim that is not this Mac's", async () => {
    const t = setup();
    const found = sessionOf(t);
    duringWaits(t, CLAIM_WAIT_MS, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...mine, rev: mine.rev + 1, editing: { by: "Sallie's laptop", since: "2026-10-20T15:00:10-05:00" }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await dialogs(t, found, CLEAR_IT).ask(...clearing("raw"));
    assert.deepEqual(r.said.slice(1), [`Not cleared: ${SESSION_NAME} is being answered on Sallie's laptop. Nothing was changed.`]);
    assert.deepEqual([r.code, reread(found).editing.by, gated(reread(found))], [1, "Sallie's laptop", true]);
    t.done();
  });
});

describe("kind --clear-session: where it is said and what the record may hold", () => {
  it("is in the help: the usage line and one sentence", async () => {
    const said = [];
    assert.equal(await editMain(["--help"], { say: (line) => said.push(line) }), 0);
    const help = said.join("\n");
    assert.match(help.replace(/\n\s+/g, " "), /\[--not-a-session\] \[--again\] \[--clear-session\] \[--here\] her answer/);
    assert.match(help.replace(/\n\s+/g, " "), /--clear-session, with --again and what the video really is, clears a session mark: it asks on a dialog on this Mac, and only her click clears it/);
  });
  it("is refused by the record's check unless the mark was cleared by a click on the dialog, with a Mac and a kind", () => {
    const t = setup();
    const record = reread(sessionOf(t));
    const cleared = { at: AFTER_CLAIM, on: "Mac Studio", to: "raw", confirmed: "dialog" };
    assert.equal(episodeFault({ ...record, kind: "raw", session: { ...MARK, cleared } }), "");
    for (const bad of [{ ...cleared, confirmed: "chat" }, { ...cleared, confirmed: "typed" }, { ...cleared, confirmed: undefined }, { ...cleared, to: undefined }, { ...cleared, to: "" }, { ...cleared, on: undefined }, { ...cleared, at: "later" }, true, "dialog"]) {
      assert.match(episodeFault({ ...record, kind: "raw", session: { ...MARK, cleared: bad } }), /session/, JSON.stringify(bad));
    }
    t.done();
  });
});
