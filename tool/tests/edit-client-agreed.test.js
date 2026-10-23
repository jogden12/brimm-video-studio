// `reel "<label>" <n> --client-agreed` (spec 2026-10-22, section 2, "Clearing it, and a client's agreement"): a Reel is cut from a
// client or group session only once she has noted, on a macOS dialog Claude cannot press, that the client agreed. The dialog asks
// who agreed and when. What she types goes into one file on this Mac, ~/BRIMM Video Work/<episode>/agreements.txt, and nowhere
// else: the record keeps only that the agreement was noted, and its day (`session.agreed`), which lets gate.js pass
// `reel "<label>" make <n>`. Nothing here runs a real program: osascript is a stand-in that is asked and answers as the real one
// prints, and each test has a root and a home of its own, under the temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { dialogScript } from "../dialog.js";
import { gateFor } from "../gate.js";
import { episodeFault, localStamp, recordFile, recordText } from "../episode.js";
import { episodeWork, settingsFile, writeSettings, writtenFile } from "../settings.js";
import { lockOf } from "../detached.js";
import { TEACHINGS_FORMAT } from "../teachings.js";
import { localDay } from "../shared/text.js";
import { setup, episodeFor, reread, listAll, FOLDER, ID } from "./episodes.js";

const AT = "2026-10-20T15:00:00-05:00";
const OSASCRIPT = "/usr/bin/osascript";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "yes" };
const MARK = { marked: AT, on: "Mac Studio", teachings: "asked", asked: AT, cleared: null };
const SESSION_NAME = "Session, 2026-10-14";
/** The file the session's reading wrote its teachings in, in the episode's folder. */
const TEACHINGS_NAME = `${SESSION_NAME}.principles.json`;
const READING = { kind: "session", model: "claude-test", at: AT, on: "Mac Studio", account: "sallie@example.com (BRIMM)", outcome: "ok", principles: TEACHINGS_NAME };
const ACCOUNT = "sallie@example.com (BRIMM)";
/** The training gate as `settings.js sessions --teachings on` writes it, five days before the clock. */
const TAUGHT = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } };
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const LAPSED = "Teachings from sessions were turned on more than 90 days ago on this Mac: ask Jason to check the training setting again.";
const TEACHINGS_COMING = "Dropbox is still bringing its teachings over to this Mac: say it again in a minute.";
const REEL_NOT_AGREED = "A Reel is cut from a session only once you have noted the client's agreement.";

/** Six Reel ideas, as the reading wrote them: 1 and 6 are to be filmed again, and 2 to 5 are cut from the session. */
const idea = (n, refilm) => ({ n, from: "p1", to: "p2", idea: `Idea ${n}`, words: "Say the price first.", why: "It is short.", refilm, principle: null });
const IDEAS = [idea(1, true), idea(2, false), idea(3, false), idea(4, false), idea(5, false), idea(6, true)];
/** Her decisions: 1, 2 and 3 kept, 5 dropped, 4 and 6 not decided yet. */
const DECIDED = { reelIdeas: { 1: "kept", 2: "kept", 3: "kept", 5: "dropped" } };
const teachingsText = (ideas) => JSON.stringify({ format: TEACHINGS_FORMAT, version: 1, made: "2026-10-20", principles: [], recurringPrinciples: [], reelIdeas: ideas, dropped: [] });
/** The made-up episode, a client or group session whose teachings she has decided: its file is "Pricing talk.mp4", a client's
    name for the tests, and it is named by its session label. */
const SESSION = { version: 3, kind: "session", answer: ANSWERED, session: { ...MARK, decided: DECIDED }, name: { text: SESSION_NAME, placeholder: false }, label: "Video of 14 Oct, 09:00 (Mac Studio)", reading: READING };
const secret = /pricing/i;

/** What she types, a client's name, and what must be in agreements.txt and nowhere else. */
const TYPED = "Zebedee Quayle of Quayle Widgets, 21 October";
const TYPED_WORDS = /zebedee|quayle|widgets/i;

// The words a person reads, and the dialog's.
/** What she is told as the dialog opens: it names the video by its label. */
const OPEN = (n = 2) => `A dialog is open on this Mac for ${SESSION_NAME}: type who agreed to Reel ${n} and when, then click "They agreed". Return presses Cancel.`;
/** The dialog's text: the label on a line of its own, a blank line, and the question. */
const QUESTION = (n = 2) => `${SESSION_NAME}\n\nWho agreed to Reel ${n} being cut from this session, and when?`;
const NOTED = (n, day) => `${SESSION_NAME}: Reel ${n}'s agreement is noted, on ${day}. Who agreed is kept on this Mac only.`;
const NOT_NOTED = "Not noted: the Reel is not agreed.";
const NOTHING_TYPED = "Not noted: nothing was typed. The Reel is not agreed.";
const TIMED_OUT = "Not noted: the dialog was not answered within a minute, so it was closed. The Reel is not agreed.";
const NOT_WRITTEN = "Not noted: the note could not be written on this Mac. The Reel is not agreed.";
const RECORD_FAILED = "The Reel is not agreed: the note of who agreed is on this Mac only. Say it again.";
const LOG_FAILED = "The log on this Mac could not be written: the record holds the agreement.";
const NOT_A_SESSION = (name) => `${name} is not a client or group session: a client's agreement is noted only for a Reel cut from one.`;
const NO_IDEA = (n) => `${SESSION_NAME} has no Reel idea ${n}.`;
const REFILM = (n) => `Reel idea ${n} of ${SESSION_NAME} is to be filmed again, not cut from the session: no client's agreement is needed.`;
const NOT_KEPT = (n) => `Reel idea ${n} of ${SESSION_NAME} is not kept: keep it first.`;
const CHANGED = `Not noted: ${SESSION_NAME} changed on the other Mac meanwhile. Say it again.`;

// What the stand-in osascript prints, as the real one does (dialog.test.js).
const agreed = (text = TYPED) => ({ code: 0, stdout: `button returned:They agreed, text returned:${text}\n`, stderr: "" });
const CANCELED = { code: 1, stdout: "", stderr: "execution error: User canceled. (-128)" };
const UNREADABLE = { code: 0, stdout: "", stderr: "" };
/** What runProgram gives of a program it killed at its limit: no output, and it says it was out of time. */
const OUT_OF_TIME = { code: 1, signal: "SIGKILL", outOfTime: true, stderr: "" };

/** The words she says. */
const agree = (n = 2, label = SESSION_NAME) => ["reel", label, String(n), "--client-agreed"];

/** A Mac with the made-up session on it, decided, with its teachings in its folder, and the training gate on unless `taught` says
    otherwise. `over` is laid on its record, `decided` and `agreedTo` on its mark, and `ideas` and `files` on what the folder holds. */
function agreeMac({ over = {}, decided = DECIDED, agreedTo, ideas = IDEAS, files = {}, taught = TAUGHT } = {}) {
  const t = setup();
  if (taught) writeSettings(t.home, { sessionTeachings: taught });
  const session = { ...MARK, decided, ...(agreedTo ? { agreed: agreedTo } : {}) };
  const found = episodeFor(t, { files: { "Pricing talk.mp4": "the raw video", [TEACHINGS_NAME]: teachingsText(ideas), ...files }, record: { ...SESSION, session, ...over } });
  return { t, found };
}

/** Run edit.js with a stand-in for osascript that answers `answer` (a reply, or a function that gives or throws one), and
    records what it was asked, and what had been said and the record's number when it was asked. `during` is done inside the
    dialog, as the other Mac's work is while it is open. Other deps are laid over this Mac's. */
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

/** Where this Mac keeps who agreed, and its tool log. */
const noteOf = (t) => join(episodeWork(t.home, FOLDER), "agreements.txt");
const logOf = (t) => join(t.home, "Library", "Logs", "brimm-video.log");
/** Every file of the test's folders, whole, by its path: the record, the episode, the home, the root. */
const snapshot = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));
/** Nothing was written, claimed, started or logged, and no note was made: every file as it was. */
function unchanged(t, before, why = "") {
  assert.deepEqual(snapshot(t), before, why);
  assert.deepEqual([t.started, t.waits, existsSync(noteOf(t)), existsSync(logOf(t))], [[], [], false, false], why);
}
/** Where what she typed is: the paths of the files that hold it (in their text or their name), and the lines said. */
function whereTyped(t, d) {
  const files = listAll(t.dir).filter((rel) => TYPED_WORDS.test(rel) || TYPED_WORDS.test(readFileSync(join(t.dir, rel), "utf8")));
  const elsewhere = [JSON.stringify(t.started), JSON.stringify(t.calls), JSON.stringify(t.opened)].filter((text) => TYPED_WORDS.test(text));
  return { files, said: d.said.filter((line) => TYPED_WORDS.test(line)), elsewhere };
}
const NOTE_REL = (t) => noteOf(t).slice(t.dir.length + 1);

describe("reel --client-agreed: asking on a dialog Claude cannot press", () => {
  it("tells her to click, then shows one dialog that names the video and asks who agreed to Reel n, with a field and the buttons Cancel and They agreed", async () => {
    const { t, found } = agreeMac();
    const d = dialogs(t, found, agreed());
    const r = await d.ask(...agree(2));
    assert.equal(r.code, 0, r.text);
    assert.equal(d.asked.length, 1);
    const [call] = d.asked;
    assert.deepEqual([call.cmd, call.args.length, call.args[0]], [OSASCRIPT, 2, "-e"]);
    assert.equal(call.args[1], dialogScript(QUESTION(2), { buttons: ["Cancel", "They agreed"], answer: true }));
    // The script holds the label on a line of its own, a blank line, the question with the Reel's number, a field to type in
    // that is empty to start with, and the two buttons, with Cancel the default: a stray Return cancels. It names no file.
    assert.ok(call.args[1].includes(`"${SESSION_NAME}\n\nWho agreed to Reel 2 being cut from this session, and when?"`), call.args[1]);
    assert.ok(call.args[1].includes('default answer ""'), call.args[1]);
    assert.ok(call.args[1].includes('buttons {"Cancel", "They agreed"} default button 1'), call.args[1]);
    assert.doesNotMatch(call.args[1], secret);
    assert.doesNotMatch(call.args[1], /\.mp4/);
    // It said to click, naming the video, before the dialog opened, and nothing was claimed or written by then.
    assert.deepEqual([call.saidBefore, call.revBefore, call.waitsBefore], [[OPEN(2)], 1, []]);
    t.done();
  });
  it("asks about the Reel she names", async () => {
    const { t, found } = agreeMac();
    const d = dialogs(t, found, agreed());
    await d.ask(...agree(3));
    assert.equal(d.asked[0].args[1], dialogScript(QUESTION(3), { buttons: ["Cancel", "They agreed"], answer: true }));
    assert.equal(d.asked[0].saidBefore[0], OPEN(3));
    t.done();
  });
  it("shows the dialog through this Mac's own run, for a minute at most", async () => {
    const { t, found } = agreeMac();
    const d = dialogs(t, found, agreed());
    await d.ask(...agree(2));
    assert.equal(d.asked[0].opts.limit, 60000);
    assert.ok(d.asked[0].opts.out > 0, JSON.stringify(d.asked[0].opts));
    t.done();
  });
});

describe("reel --client-agreed: noting it on her click", () => {
  it("writes the note on this Mac, then the record, says it, and logs it; the gate then lets the Reel be made", async () => {
    const { t, found } = agreeMac();
    const day = localDay(new Date(t.now()));
    const at = localStamp(new Date(t.now()));
    assert.equal(gateFor("reel", reread(found), { teachingsOn: true, said: SESSION_NAME }, [SESSION_NAME, "make", "2"]), REEL_NOT_AGREED);
    const d = dialogs(t, found, agreed());
    const r = await d.ask(...agree(2));
    assert.deepEqual([r.code, r.said], [0, [OPEN(2), NOTED(2, day)]]);
    // The note: one line, her words and the Reel, in a file only she can read, on this Mac's disk, not in the episode's folder.
    assert.equal(readFileSync(noteOf(t), "utf8"), `${at} Reel 2: ${TYPED}\n`);
    assert.equal(statSync(noteOf(t)).mode & 0o777, 0o600);
    assert.equal(noteOf(t), join(t.home, "BRIMM Video Work", FOLDER, "agreements.txt"));
    assert.equal(existsSync(join(found.folder, "agreements.txt")), false);
    // The record: one write, which holds that the agreement was noted, and its day, and no word of who.
    const record = reread(found);
    assert.deepEqual([record.rev, record.kind, record.session.agreed], [2, "session", [{ n: 2, at: day }]]);
    assert.deepEqual(record.session, { ...MARK, decided: DECIDED, agreed: [{ n: 2, at: day }] });
    assert.deepEqual([record.name, record.reading, record.editing], [SESSION.name, READING, null]);
    assert.equal(episodeFault(record), "");
    // No claim, no wait, no reading: it is a note.
    assert.deepEqual([t.waits, t.started], [[], []]);
    // The log says that it was noted, by id and label, and never what she typed.
    assert.equal(readFileSync(logOf(t), "utf8"), `${at} ${ID} (${SESSION_NAME}): a client's agreement to Reel 2 was noted by a click on this Mac's dialog.\n`);
    // The gate lets the Reel be cut now, and only that Reel.
    assert.equal(gateFor("reel", record, { teachingsOn: true, said: SESSION_NAME }, [SESSION_NAME, "make", "2"]), "");
    assert.equal(gateFor("render", record, { teachingsOn: true, said: SESSION_NAME }, [SESSION_NAME, "reel", "2"]), "");
    assert.equal(gateFor("reel", record, { teachingsOn: true, said: SESSION_NAME }, [SESSION_NAME, "make", "3"]), REEL_NOT_AGREED);
    // What she typed is in the note and nowhere else: not a line said, a file of the episode or the home, a record, or a call.
    assert.deepEqual(whereTyped(t, d), { files: [NOTE_REL(t)], said: [], elsewhere: [] });
    assert.doesNotMatch(r.text, secret);
    t.done();
  });
  it("adds the agreement to a second Reel as a second line and a second entry", async () => {
    const { t, found } = agreeMac();
    const day = localDay(new Date(t.now()));
    const at = localStamp(new Date(t.now()));
    const other = "Mr Blenkinsop, by telephone, 22 October";
    assert.equal((await dialogs(t, found, agreed()).ask(...agree(2))).code, 0);
    const d = dialogs(t, found, agreed(other));
    const r = await d.ask(...agree(3));
    assert.deepEqual([r.code, r.said], [0, [OPEN(3), NOTED(3, day)]]);
    assert.equal(readFileSync(noteOf(t), "utf8"), `${at} Reel 2: ${TYPED}\n${at} Reel 3: ${other}\n`);
    assert.equal(statSync(noteOf(t)).mode & 0o777, 0o600);
    const record = reread(found);
    assert.deepEqual([record.rev, record.session.agreed], [3, [{ n: 2, at: day }, { n: 3, at: day }]]);
    assert.equal(readFileSync(logOf(t), "utf8").split("\n").filter(Boolean).length, 2);
    assert.equal(episodeFault(record), "");
    t.done();
  });
  it("writes what she typed as one line, each line break and tab one space, trimmed", async () => {
    const { t, found } = agreeMac();
    const at = localStamp(new Date(t.now()));
    const r = await dialogs(t, found, agreed("\tZebedee\tQuayle,\r\n21 October\nby telephone \n")).ask(...agree(2));
    assert.equal(r.code, 0, r.text);
    assert.equal(readFileSync(noteOf(t), "utf8"), `${at} Reel 2: Zebedee Quayle,  21 October by telephone\n`);
    t.done();
  });
  it("adds to a note that is there, and makes it hers alone", async () => {
    const { t, found } = agreeMac();
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(noteOf(t), "an earlier line\n", { mode: 0o644 });
    chmodSync(noteOf(t), 0o644);
    const at = localStamp(new Date(t.now()));
    assert.equal((await dialogs(t, found, agreed()).ask(...agree(2))).code, 0);
    assert.equal(readFileSync(noteOf(t), "utf8"), `an earlier line\n${at} Reel 2: ${TYPED}\n`);
    assert.equal(statSync(noteOf(t)).mode & 0o777, 0o600);
    t.done();
  });
  it("notes it all the same when the log cannot be written: the record holds the agreement", async () => {
    const { t, found } = agreeMac();
    const day = localDay(new Date(t.now()));
    // A file where the log's folder is to be.
    mkdirSync(join(t.home, "Library"), { recursive: true });
    writeFileSync(join(t.home, "Library", "Logs"), "not a folder");
    const r = await dialogs(t, found, agreed()).ask(...agree(2));
    assert.deepEqual([r.code, r.said], [0, [OPEN(2), NOTED(2, day), LOG_FAILED]]);
    assert.deepEqual(reread(found).session.agreed, [{ n: 2, at: day }]);
    assert.equal(readFileSync(noteOf(t), "utf8").endsWith(`Reel 2: ${TYPED}\n`), true);
    t.done();
  });
});

describe("reel --client-agreed: nothing changes unless she clicked They agreed with something typed", () => {
  const answers = [
    ["Cancel", CANCELED, NOT_NOTED],
    ["Escape, which ends the script as Cancel does", { code: 1, stdout: "", stderr: "0:62: execution error: User canceled. (-128)\n" }, NOT_NOTED],
    ["Cancel printed as a button", { code: 0, stdout: "button returned:Cancel, text returned:Zebedee Quayle\n", stderr: "" }, NOT_NOTED],
    ["nothing typed", agreed(""), NOTHING_TYPED],
    ["only spaces typed", agreed("   "), NOTHING_TYPED],
    ["only a tab and line breaks typed", agreed("\t\r\n \n"), NOTHING_TYPED],
    ["a reply that is no button", UNREADABLE, "Not noted: The dialog's answer could not be read. The Reel is not agreed."],
    ["a click with no text", { code: 0, stdout: "button returned:They agreed\n", stderr: "" }, "Not noted: The dialog's answer could not be read. The Reel is not agreed."],
    ["a button that was not shown", { code: 0, stdout: "button returned:Agreed, text returned:Zebedee Quayle\n", stderr: "" }, "Not noted: The dialog's answer could not be read. The Reel is not agreed."],
    ["osascript ended with an error", { code: 2, stdout: "", stderr: "not allowed to send keystrokes" }, "Not noted: The dialog could not be shown (osascript ended with code 2). The Reel is not agreed."],
    ["osascript not starting", () => { throw new Error("spawn /usr/bin/osascript ENOENT"); }, "Not noted: The dialog could not be shown. The Reel is not agreed."]
  ];
  it("says so in a line of its own after the line that says the dialog is open, and writes nothing, for each way the dialog can end", async () => {
    for (const [what, answer, ending] of answers) {
      const { t, found } = agreeMac();
      const before = snapshot(t);
      const d = dialogs(t, found, answer);
      const r = await d.ask(...agree(2));
      assert.deepEqual([r.code, r.said], [1, [OPEN(2), ending]], what);
      assert.equal(d.asked.length, 1, what);
      unchanged(t, before, what);
      assert.equal(reread(found).rev, 1, what);
      assert.deepEqual(reread(found).session.agreed, undefined, what);
      assert.doesNotMatch(r.text, secret, what);
      assert.deepEqual(whereTyped(t, d), { files: [], said: [], elsewhere: [] }, what);
      t.done();
    }
  });
  it("says the dialog was closed after a minute, and writes nothing, whatever the killed run printed", async () => {
    for (const answer of [OUT_OF_TIME, { ...agreed(), outOfTime: true }]) {
      const { t, found } = agreeMac();
      const before = snapshot(t);
      const d = dialogs(t, found, answer);
      const r = await d.ask(...agree(2));
      assert.deepEqual([r.code, r.said], [1, [OPEN(2), TIMED_OUT]]);
      assert.equal(d.asked[0].opts.limit, 60000);
      unchanged(t, before);
      assert.deepEqual(whereTyped(t, d), { files: [], said: [], elsewhere: [] });
      t.done();
    }
  });
});

describe("reel --client-agreed: refused before any dialog, in this order", () => {
  /** The refusal, `words` said with `code`, with the dialog never shown and nothing written, claimed, started or logged. */
  async function refused(mac, words, { argv = agree(2), code = 1, deps = {} } = {}) {
    const { t, found } = mac;
    const before = snapshot(t);
    const d = dialogs(t, found, agreed(), deps);
    const r = await d.ask(...argv);
    assert.deepEqual([r.code, r.said], [code, words], argv.join(" "));
    assert.equal(d.asked.length, 0, argv.join(" "));
    unchanged(t, before, argv.join(" "));
    return r;
  }
  it("for a video that fits no episode", async () => {
    const mac = agreeMac();
    const d = dialogs(mac.t, mac.found, agreed());
    const before = snapshot(mac.t);
    const r = await d.ask(...agree(2, "Session, 2026-01-01"));
    assert.equal(r.code, 1);
    assert.match(r.text, /^No episode fits /);
    assert.equal(d.asked.length, 0);
    unchanged(mac.t, before);
    mac.t.done();
  });
  it("for a video that is no client or group session: a finished video, and a session whose mark is cleared", async () => {
    const finished = agreeMac({ over: { kind: "finished", session: undefined, reading: undefined, answer: { ...ANSWERED, private: "no" }, name: { text: "Talk with a friend", placeholder: false } } });
    await refused(finished, [NOT_A_SESSION("Talk with a friend")], { argv: agree(2, "Talk with a friend") });
    finished.t.done();
    const cleared = agreeMac({ over: { name: { text: "Talk with a friend", placeholder: false }, session: { ...MARK, decided: DECIDED, cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } } } });
    await refused(cleared, [NOT_A_SESSION("Talk with a friend")], { argv: agree(2, "Talk with a friend") });
    cleared.t.done();
  });
  it("with the training gate off on this Mac, or lapsed, in the gate's words", async () => {
    const off = agreeMac({ taught: null });
    await refused(off, [TEACHINGS_OFF]);
    off.t.done();
    const lapsed = agreeMac({ taught: { ...TAUGHT, at: "2026-07-01T09:00:00-05:00" } });
    await refused(lapsed, [LAPSED]);
    lapsed.t.done();
  });
  it("while Claude has read nothing of the session", async () => {
    const mac = agreeMac({ over: { reading: undefined } });
    await refused(mac, [`${SESSION_NAME} has no teachings yet: Claude has not read it.`]);
    mac.t.done();
  });
  it("while Dropbox is still bringing its teachings over, and shows the dialog once it has", async () => {
    const coming = agreeMac();
    await refused(coming, [TEACHINGS_COMING], { deps: { isWhole: (path) => !path.endsWith(".principles.json"), readAll: async () => {} } });
    coming.t.done();
    // Read through, the file is whole, and the dialog is shown as for any other.
    const brought = agreeMac();
    let whole = false;
    const d = dialogs(brought.t, brought.found, agreed(), { isWhole: (path) => whole || !path.endsWith(".principles.json"), readAll: async () => { whole = true; } });
    const r = await d.ask(...agree(2));
    assert.deepEqual([r.code, d.asked.length], [0, 1], r.text);
    brought.t.done();
  });
  it("when the teachings cannot be read", async () => {
    const mac = agreeMac({ files: { [TEACHINGS_NAME]: "this is not json" } });
    await refused(mac, [`${SESSION_NAME}'s teachings cannot be read (it is not JSON).`]);
    mac.t.done();
  });
  it("for a Reel idea the session has not got", async () => {
    for (const n of [7, 9, 100]) {
      const mac = agreeMac();
      await refused(mac, [NO_IDEA(n)], { argv: agree(n) });
      mac.t.done();
    }
  });
  it("for a Reel idea that is to be filmed again, whether or not it is kept", async () => {
    for (const n of [1, 6]) {
      const mac = agreeMac();
      await refused(mac, [REFILM(n)], { argv: agree(n) });
      mac.t.done();
    }
  });
  it("for a Reel idea that is not kept: dropped, or not decided yet", async () => {
    for (const n of [4, 5]) {
      const mac = agreeMac();
      await refused(mac, [NOT_KEPT(n)], { argv: agree(n) });
      mac.t.done();
    }
  });
  it("says it was agreed already, on its day, and ends well, with no dialog and nothing written", async () => {
    const mac = agreeMac({ agreedTo: [{ n: 2, at: "2026-10-19" }, { n: 3, at: "2026-10-20" }] });
    await refused(mac, [`Reel idea 2 of ${SESSION_NAME} was agreed already, on 2026-10-19.`], { code: 0 });
    await refused(mac, [`Reel idea 3 of ${SESSION_NAME} was agreed already, on 2026-10-20.`], { argv: agree(3), code: 0 });
    mac.t.done();
  });
  it("while the other Mac has it open, or a run is at work on it, in the words of the other session commands", async () => {
    const theirs = agreeMac({ over: { editing: { by: "Sallie's laptop", since: AT } } });
    await refused(theirs, [`Sallie's laptop has ${SESSION_NAME} open, so nothing was noted. Say it again once it is let go there.`]);
    theirs.t.done();
    const running = agreeMac();
    mkdirSync(episodeWork(running.t.home, FOLDER), { recursive: true });
    writeFileSync(lockOf(running.t.home, FOLDER), JSON.stringify({ pid: 4242, command: "push" }));
    const before = snapshot(running.t);
    const d = dialogs(running.t, running.found, agreed(), { alive: (pid) => pid === 4242 });
    const r = await d.ask(...agree(2));
    assert.equal(r.code, 1);
    assert.equal(r.said.length, 1);
    assert.match(r.said[0], /^push is running for .* already\. Say it again when it has finished\.$/);
    assert.doesNotMatch(r.text, secret);
    assert.deepEqual([d.asked.length, snapshot(running.t), existsSync(noteOf(running.t))], [0, before, false]);
    running.t.done();
  });
  it("names what is wrong first when several things are: each check comes before the next", async () => {
    // No teachings are read before the gate; no idea before the teachings; a Reel to film again before one not kept; a Reel not
    // kept before one agreed already; one agreed already before the other Mac's claim.
    const noReading = agreeMac({ over: { reading: undefined, editing: { by: "Sallie's laptop", since: AT } } });
    await refused(noReading, [`${SESSION_NAME} has no teachings yet: Claude has not read it.`]);
    noReading.t.done();
    const unkeptRefilm = agreeMac({ decided: { reelIdeas: {} }, agreedTo: [{ n: 6, at: "2026-10-19" }] });
    await refused(unkeptRefilm, [REFILM(6)], { argv: agree(6) });
    unkeptRefilm.t.done();
    const unkeptAgreed = agreeMac({ agreedTo: [{ n: 4, at: "2026-10-19" }], over: { editing: { by: "Sallie's laptop", since: AT } } });
    await refused(unkeptAgreed, [NOT_KEPT(4)], { argv: agree(4) });
    unkeptAgreed.t.done();
    const agreedBusy = agreeMac({ agreedTo: [{ n: 2, at: "2026-10-19" }], over: { editing: { by: "Sallie's laptop", since: AT } } });
    await refused(agreedBusy, [`Reel idea 2 of ${SESSION_NAME} was agreed already, on 2026-10-19.`], { code: 0 });
    agreedBusy.t.done();
  });
});

describe("reel --client-agreed: after her click it checks again, and writes nothing if anything has changed", () => {
  /** What stopped it after her click: the dialog was shown, the line said, `words` (a text, or a pattern) said after it, and
      nothing was noted, written or logged. */
  async function stopped(mac, words, during, { n = 2, deps = {} } = {}) {
    const { t, found } = mac;
    const d = dialogs(t, found, agreed(), { during, ...deps });
    const r = await d.ask(...agree(n));
    assert.equal(r.code, 1, r.text);
    assert.equal(r.said.length, 2, r.text);
    assert.equal(r.said[0], OPEN(n));
    if (typeof words === "string") assert.equal(r.said[1], words);
    else assert.match(r.said[1], words);
    assert.equal(d.asked.length, 1);
    assert.deepEqual([existsSync(noteOf(t)), existsSync(logOf(t)), t.started, t.waits, reread(found).session.agreed], [false, false, [], [], undefined]);
    assert.doesNotMatch(r.text, secret);
    assert.deepEqual(whereTyped(t, d), { files: [], said: [], elsewhere: [] });
    return r;
  }
  it("when the record changed on the other Mac while the dialog was open", async () => {
    const mac = agreeMac();
    const { t, found } = mac;
    await stopped(mac, CHANGED, () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, writer: { commit: "c709b57", on: "Sallie's laptop" } })));
    // The other Mac's record stands, and this Mac wrote none on top of it.
    assert.deepEqual([reread(found).rev, reread(found).writer.on], [2, "Sallie's laptop"]);
    assert.deepEqual(listAll(found.folder).filter((rel) => rel.startsWith("record/")), ["record/0001.json", "record/0002.json"]);
    t.done();
  });
  it("when the idea was dropped meanwhile: the record changed, and that is what it says", async () => {
    const mac = agreeMac();
    const { found } = mac;
    await stopped(mac, CHANGED, () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, session: { ...reread(found).session, decided: { reelIdeas: { ...DECIDED.reelIdeas, 2: "dropped" } } } })));
    mac.t.done();
  });
  it("when this Mac's training gate was turned off, or lapsed, meanwhile", async () => {
    const off = agreeMac();
    await stopped(off, `Not noted: ${TEACHINGS_OFF}`, () => writeSettings(off.t.home, { sessionTeachings: null }));
    off.t.done();
    const lapsed = agreeMac();
    await stopped(lapsed, `Not noted: ${LAPSED}`, () => writeSettings(lapsed.t.home, { sessionTeachings: { ...TAUGHT, at: "2026-07-01T09:00:00-05:00" } }));
    lapsed.t.done();
  });
  it("when the settings cannot be read any more: the gate is then taken as off", async () => {
    const mac = agreeMac();
    const { t } = mac;
    await stopped(mac, `Not noted: ${TEACHINGS_OFF}`, () => writeFileSync(settingsFile(t.home), "{ not json"));
    t.done();
  });
  it("when the teachings no longer hold the idea, or now say it is to be filmed again, or cannot be read", async () => {
    const gone = agreeMac();
    await stopped(gone, `Not noted: ${NO_IDEA(2)}`, () => writeFileSync(join(gone.found.folder, TEACHINGS_NAME), teachingsText(IDEAS.filter((i) => i.n !== 2))));
    gone.t.done();
    const refilm = agreeMac();
    await stopped(refilm, `Not noted: ${REFILM(2)}`, () => writeFileSync(join(refilm.found.folder, TEACHINGS_NAME), teachingsText(IDEAS.map((i) => (i.n === 2 ? { ...i, refilm: true } : i)))));
    refilm.t.done();
    const broken = agreeMac();
    await stopped(broken, `Not noted: ${SESSION_NAME}'s teachings cannot be read (it is not JSON).`, () => writeFileSync(join(broken.found.folder, TEACHINGS_NAME), "{ not json"));
    broken.t.done();
  });
  it("when a run started at work on the session while the dialog was open", async () => {
    const mac = agreeMac();
    const { t } = mac;
    await stopped(mac, /^Not noted: push is running for .* already\. Say it again when it has finished\.$/, () => {
      mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
      writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "push" }));
    }, { deps: { alive: (pid) => pid === 4242 } });
    t.done();
  });
});

describe("reel --client-agreed: when it cannot be written", () => {
  it("says the note could not be written, and does not write the record, when the folder for the note is a file", async () => {
    const { t, found } = agreeMac();
    mkdirSync(join(t.home, "BRIMM Video Work"), { recursive: true });
    writeFileSync(episodeWork(t.home, FOLDER), "not a folder");
    const before = snapshot(t);
    const d = dialogs(t, found, agreed());
    const r = await d.ask(...agree(2));
    assert.deepEqual([r.code, r.said], [1, [OPEN(2), NOT_WRITTEN]]);
    assert.deepEqual([snapshot(t), existsSync(logOf(t)), reread(found).rev, reread(found).session.agreed], [before, false, 1, undefined]);
    assert.deepEqual(whereTyped(t, d), { files: [], said: [], elsewhere: [] });
    t.done();
  });
  it("says the same when agreements.txt is a folder", async () => {
    const { t, found } = agreeMac();
    mkdirSync(noteOf(t), { recursive: true });
    const r = await dialogs(t, found, agreed()).ask(...agree(2));
    assert.deepEqual([r.code, r.said], [1, [OPEN(2), NOT_WRITTEN]]);
    assert.deepEqual([existsSync(logOf(t)), reread(found).rev, reread(found).session.agreed], [false, 1, undefined]);
    t.done();
  });
  it("says its own words and then that the Reel is not agreed, when the record cannot be written after the note", async () => {
    const { t, found } = agreeMac();
    const at = localStamp(new Date(t.now()));
    // Dropbox undid this Mac's last change to the session while the dialog was open: save refuses to write over it.
    const d = dialogs(t, found, agreed(), {
      during: () => {
        mkdirSync(join(writtenFile(t.home), ".."), { recursive: true });
        writeFileSync(writtenFile(t.home), JSON.stringify({ [ID]: 9 }));
      }
    });
    const r = await d.ask(...agree(2));
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, [OPEN(2), `Dropbox undid this Mac's last change to ${SESSION_NAME}. Say it again. Nothing was written.`, RECORD_FAILED]);
    // The note was made first, on this Mac only; the record is as it was, and nothing is logged.
    assert.equal(readFileSync(noteOf(t), "utf8"), `${at} Reel 2: ${TYPED}\n`);
    assert.deepEqual([reread(found).rev, reread(found).session.agreed, existsSync(logOf(t))], [1, undefined, false]);
    assert.deepEqual(whereTyped(t, d), { files: [NOTE_REL(t)], said: [], elsewhere: [] });
    t.done();
  });
});

describe("reel --client-agreed: the form, and today's reel", () => {
  it("takes exactly three words, a label, digits and --client-agreed, before today's pick and drop", async () => {
    const { t, found } = agreeMac({ over: { kind: "finished", session: undefined, reading: undefined, answer: { ...ANSWERED, private: "no" }, name: { text: "Talk with a friend", placeholder: false } } });
    const d = dialogs(t, found, agreed());
    // Three words in this form are this command's: here it says the video is no session.
    const r = await d.ask("reel", "Talk with a friend", "2", "--client-agreed");
    assert.deepEqual([r.code, r.said], [1, [NOT_A_SESSION("Talk with a friend")]]);
    // Every other form is today's: the help, or a pick or a drop.
    for (const words of [["Talk with a friend", "--client-agreed"], ["Talk with a friend", "two", "--client-agreed"], ["Talk with a friend", "2", "--client-agree"], ["Talk with a friend", "2"], ["Talk with a friend", "2", "--client-agreed", "3"], ["--client-agreed", "Talk with a friend", "2"], ["Talk with a friend", "make", "2"]]) {
      const other = await d.ask("reel", ...words);
      assert.deepEqual([other.code, other.said.length, other.said[0].startsWith("The command line for episodes")], [2, 1, true], words.join(" "));
    }
    // `reel pick 14 --client-agreed` is today's pick of an episode called "14", not this: it says what `reel pick 14` says.
    for (const what of ["pick", "drop"]) {
      const flagged = await d.ask("reel", what, "14", "--client-agreed");
      const plain = await d.ask("reel", what, "14");
      assert.deepEqual([flagged.code, flagged.said], [plain.code, plain.said], what);
      assert.deepEqual(flagged.said, ["Say which Reels, by their numbers."], what);
    }
    assert.equal(d.asked.length, 0);
    t.done();
  });
  it("leaves a number that is not a Reel's, which the gate refuses for a session, to the gate", async () => {
    const { t, found } = agreeMac();
    const before = snapshot(t);
    const d = dialogs(t, found, agreed());
    for (const n of ["0", "007"]) {
      const r = await d.ask("reel", SESSION_NAME, n, "--client-agreed");
      assert.deepEqual([r.code, r.said], [1, [REEL_NOT_AGREED]], n);
    }
    assert.equal(d.asked.length, 0);
    unchanged(t, before);
    t.done();
  });
  it("is in the help, under reel's line: for a client or group session, the dialog on this Mac, and that who agreed stays here", async () => {
    const { t } = agreeMac();
    const said = [];
    assert.equal(await editMain(["--help"], { ...t.ctx.deps, say: (line) => said.push(line) }), 0);
    const help = said.join("\n");
    const at = help.indexOf('node edit.js reel "<label>" <n> --client-agreed');
    assert.ok(at > help.indexOf("node edit.js reel pick|drop") && at < help.indexOf("node edit.js reels "), help);
    const entry = help.slice(at, help.indexOf("node edit.js reels "));
    assert.match(entry, /client or group session/);
    assert.match(entry, /dialog on this Mac/);
    assert.match(entry, /kept Reel idea/);
    assert.match(entry, /Who agreed\s+stays on this Mac/);
    t.done();
  });
});
