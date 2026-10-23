// A client or group session, once she has marked it (spec 2026-10-22, section 2, "The session mark" and "The training gate";
// section 3, "Client or group session"; section 8, the session's hand-off). Nothing of it goes to Claude until she asks for its
// teachings and Jason's training gate is on: then `teachings` claims it and starts one detached reading, which replaces every
// speaker but her before the call, reads the reply for principles and Reel ideas, takes out every field that holds a name
// brimm-video can see, and writes what is left. She keeps, changes or drops each item in her chat (`principles`, `ideas`), and
// `finish` writes the session's hand-off of what she approved, never a transcript.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and Claude Code, QuickTime
// Player, Finder and the notice are stand-ins. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIM_WAIT_MS, READ_POLL_MS, editMain } from "../edit.js";
import { episodeFault, localStamp, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { settingsFile, writeSettings } from "../settings.js";
import { readResult, resultFile, lockOf, takeEpisodeLock, releaseEpisodeLock } from "../detached.js";
import { requestFor } from "../readings.js";
import { replaceSpeakers, EDITS } from "../sessions.js";
import { HOST } from "../shared/show.js";
import { CLAUDE_MODEL } from "../unedited.js";
import { sameAccount, teachingsWhy, herWordsName, OTHER_ACCOUNT } from "../teachings.js";
import { setup, listAll } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

// --- The made-up session ---

const ID = "e-20261020-77ab12";
const SHORT = ID.slice(-6);
/** The file she dropped is named for the client, and so is the episode's folder. */
const VIDEO = "Quillon Marsh.mp4";
const STEM = "Quillon Marsh";
const FOLDER = "2026-10-20 Quillon Marsh (Mac Studio)";
/** The session's label, as `kind … session` names it in the mark's own write. */
const LABEL = "Session, 2026-10-20";
/** What must never be in a line, a log, a result, a request's file name, or a file a session's reading or hand-off writes. */
const SECRET = /\b(quillon|marsh|brandvale|jorund|pell)\b/i;
/** When she marked it, and when she asked for its teachings: before the clock of episodes.js's setup. */
const MARKED = "2026-10-20T14:00:00-05:00";
const ASKED = "2026-10-20T14:30:00-05:00";
/** The clock of episodes.js's setup, as a record keeps a moment. */
const NOW = localStamp(new Date(Date.parse("2026-10-20T15:00:00-05:00")));

/** The words of the session, as the import's plan holds them: the client's name and her business are said in it. */
const PHRASES = [
  { id: "p1", start: 0, end: 4, keep: true, text: "Welcome back, everyone, to the group call." },
  { id: "p2", start: 4.5, end: 9, keep: true, text: "So Quillon asked about pricing last week." },
  { id: "p3", start: 9.5, end: 15, keep: true, text: "Your price is a message, and Brandvale knows it." },
  { id: "p4", start: 15.5, end: 20, keep: true, text: "Say the price first, then stop talking." },
  { id: "p5", start: 20.5, end: 26, keep: true, text: "We post on Instagram, as The BRIMM always has." }
];
const PLAN = { version: 1, video: VIDEO, facts: { duration: 26, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 }, phrases: PHRASES, ranges: [{ start: 0, end: 26, keep: true }], kept: 26, cut: 0, pauses: [], by: "rules" };
/** The files a light import puts in the episode's folder. */
const FILES = {
  [VIDEO]: "the recording",
  [`${STEM}.cut-plan.json`]: JSON.stringify(PLAN, null, 2) + "\n",
  [`${STEM}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\nWelcome back, everyone, to the group call.\n\n",
  [`${STEM}.transcript.txt`]: "[0:00] Welcome back, everyone, to the group call.\n"
};
/** The meeting's own transcript, which a person named for the client: her lines, and the client's. */
const VTT = [
  "WEBVTT", "",
  "1", "00:00:00.000 --> 00:00:04.000", "Sallie Ogden: Welcome back, everyone, to the group call.", "",
  "2", "00:00:04.500 --> 00:00:09.000", "Jorund Pell: So Quillon asked about pricing last week.", "",
  "3", "00:00:09.500 --> 00:00:15.000", "Sallie Ogden: Your price is a message, and Brandvale knows it.", ""
].join("\n");
const VTT_FILE = `${STEM}.vtt`;
/** A meeting transcript in which she alone speaks: no speaker is replaced. */
const VTT_HERS = ["WEBVTT", "", "1", "00:00:00.000 --> 00:00:04.000", "Sallie Ogden: Welcome back, everyone, to the group call.", ""].join("\n");

/** Claude's reply: three principles, two recurring principles and three Reel ideas, some of whose fields hold a name. */
const REPLY = {
  frameworks: [
    {
      name: "Price the outcome", category: "pricing",
      description: "As The BRIMM teaches, and as Sallie says on Instagram, charge for what the work changes.",
      steps: ["Name the result the buyer wants.", "Ask Quillon what it is worth."], red_flags: ["Pricing by the hour."], green_flags: ["A price said in one sentence."],
      decision_criteria: ["Does the price say what the work is worth?"], example_application: "A baker prices a wedding cake by the celebration it serves.",
      verbatim_key_phrases: ["Your price is a message."], source_context: "Early on, when the group talked about raising prices."
    },
    {
      name: "Say the price first", category: "sales", description: "Name the number early, then stop talking.", steps: ["Say it.", "Stop talking."], red_flags: [], green_flags: [],
      decision_criteria: ["Has the buyer heard the number?"], example_application: "As Brandvale did, say the number in the first call.", verbatim_key_phrases: [], source_context: "Near the end, after Marsh spoke."
    },
    {
      name: "Quillon's rule", category: "operations", description: "Check one number each week.", steps: [], red_flags: [], green_flags: [], decision_criteria: [],
      example_application: "A shop owner watches one number every Monday.", verbatim_key_phrases: [], source_context: "In the middle."
    }
  ],
  recurring_principles: ["Price is a message.", "Ask Marsh first."],
  reel_ideas: [
    { idea: "Why price is a message", words: "Your price has already told them how much to expect.", why: "It stands alone.", refilm: true, principle: 1 },
    { from: "p4", to: "p4", idea: "Say it first", words: "Say the price first, then stop talking.", why: "It is short.", refilm: false, principle: 2 },
    { idea: "One number", words: "Quillon would say it best.", why: "A quick tip.", refilm: true, principle: 3 }
  ]
};
/** What the name check takes out of REPLY, as the result and her chat say it. */
const TAKEN_OUT = [
  "Principle 1's steps, entry 2: it held a name brimm-video can see.",
  "Principle 2's example_application: it held a name brimm-video can see.",
  "Principle 2's source_context: it held a name brimm-video can see.",
  "Principle 3's name: it held a name brimm-video can see.",
  "Recurring principle 2's text: it held a name brimm-video can see.",
  "Reel idea 3's words: it held a name brimm-video can see."
];

/** What `claude auth status` prints on this Mac, and the account Jason checked. */
const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
const ACCOUNT = "sallie@example.com (BRIMM)";
/** The training gate as `settings.js sessions --teachings on` writes it, five days before the clock. */
const TAUGHT = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } };

// The words a person reads.
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const LAPSED = "Teachings from sessions were turned on more than 90 days ago on this Mac: ask Jason to check the training setting again.";
const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
const TRANSCRIPT_ONLY = `${LABEL}: its transcript stays on this Mac. Nothing goes to Claude.`;
const CHECK = "brimm-video took out the names it could see. Check these for anything about the client.";
const FOR_HER = "(for you only: not sent to the page)";
const V1_WAITS = "A session's hand-off is written once this Mac hands off version 2: ask Jason.";
/** What `name` says of a session name holding `word`, a name brimm-video can see (fix round 2: the word that tripped it). */
const NAME_HOLDS = (word) => `That name holds "${word}", a name brimm-video can see in this session: give it another.`;
const STILL = `Claude is still reading ${LABEL}. A notice will come on this Mac when it is done: then say "what did Claude find?"`;

const ANSWER = { state: "answered", guess: null, seen: "wide, 0:26", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: MARKED, private: "yes" };
const MARK = { marked: MARKED, on: "Mac Studio", teachings: null, cleared: null };
/** The record of the session as `kind … session` leaves it: answered, marked, named by its label, the claim let go. */
const SESSION = { version: 3, kind: "session", answer: ANSWER, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: LABEL, placeholder: false }, session: MARK, editing: null };
/** The record once `teachings` has asked for them on this Mac, which holds the claim for the reading. */
const ASKED_OVER = { session: { ...MARK, teachings: "asked", asked: ASKED }, editing: { by: "Mac Studio", since: ASKED } };

/** A Mac with the made-up session on it, its record with `over` laid on it, `files` in its folder, Claude Code a stand-in that
    replies `reply` and says it is signed in as `status` (null: it cannot say), and settings laid on this Mac's settings file:
    the training gate on, unless `taught` says otherwise. { t, found, asks, notices, state }: `state` may be changed by a test
    (its reply, its status, `onAuth`, done when `auth status` is asked, and `onAsk`, which may give the call's result itself). */
function sessionMac({ over = {}, files = FILES, reply = REPLY, status = STATUS, taught = TAUGHT, settings = {} } = {}) {
  const asks = [];
  const notices = [];
  const state = { reply, status, onAuth: () => {}, onAsk: () => null };
  const t = setup({
    programs: {
      CLAUDE: (args, asked) => {
        if (args.includes("auth")) {
          state.onAuth();
          return state.status ? { code: 0, stderr: "", stdout: JSON.stringify(state.status) } : { code: 1, stderr: "Not signed in.", stdout: "" };
        }
        asks.push(asked.input);
        return state.onAsk(asks.length) || { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(state.reply) }) };
      }
    }
  });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.notify = (text) => notices.push(text);
  writeSettings(t.home, { ...(taught ? { sessionTeachings: taught } : {}), ...settings });
  const folder = join(t.root, "Episodes", FOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(folder, name, ".."), { recursive: true });
    writeFileSync(join(folder, name), text);
    sizes[name] = Buffer.byteLength(text);
  }
  const first = newEpisode({ id: ID, machine: "Mac Studio", at: "2026-10-20T10:00:00-05:00", video: { file: VIDEO, bytes: sizes[VIDEO], seconds: 26, created: null }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" }, files: sizes });
  writeFileSync(recordFile(folder, 1), recordText({ ...first, rev: 1, ...SESSION, video: { ...first.video, recorded: "2026-10-20", recordedFrom: "video" }, ...over }));
  return { t, found: { folder, name: FOLDER, record: readEpisode(folder).record }, asks, notices, state };
}

/** The episode's newest record, read again. */
const reread = (found) => readEpisode(found.folder).record;
/** The detached reading `teachings` starts, as it starts it. */
const readArgs = (rev) => ["read", "--now", FOLDER, "--kind", "session", "--rev", String(rev)];
/** The calls of Claude Code that asked Claude something (not `auth status`), and those that asked its account. */
const calls = (t) => t.calls.filter((c) => c.cmd === "CLAUDE" && !c.args.includes("auth"));
const authCalls = (t) => t.calls.filter((c) => c.cmd === "CLAUDE" && c.args.includes("auth"));
/** Every file in the episode's folder, with its bytes. */
const snapshot = (found) => Object.fromEntries(listAll(found.folder).map((rel) => [rel, readFileSync(join(found.folder, rel), "utf8")]));
/** A file of the episode, read. */
const fileOf = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
/** The teachings files a reading of the session writes, by its name. */
const TEACHINGS_JSON = `${LABEL}.principles.json`;
const TEACHINGS_TXT = `${LABEL}.principles.txt`;
const IDEAS_TXT = `${LABEL}.reel-ideas.txt`;
const HANDOFF = `final/${LABEL}.brimm-ops.json`;

/** The made-up session read once for its teachings, as `teachings` and its detached reading leave it: { t, found, asks, … }. */
async function readSession(options = {}) {
  const mac = sessionMac({ ...options, over: { ...ASKED_OVER, ...(options.over || {}) } });
  const r = await on(mac.t.ctx.deps, ...readArgs(1));
  assert.equal(r.code, 0, r.text);
  return { ...mac, read: r };
}

/** Every key path in a JSON value, as "a.b[].c", each list's entries read as one. */
const keyPaths = (v, at = "") => (Array.isArray(v) ? v.flatMap((x) => keyPaths(x, `${at}[]`)) : v !== null && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [`${at}.${k}`, ...keyPaths(x, `${at}.${k}`)]) : []);
const CONTRACT = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-session.json", import.meta.url), "utf8"));

describe("the session mark: kind … session", () => {
  it("names the video by its session label in the mark's own write", async () => {
    const { t, found } = sessionMac({ over: { kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:26", came: "camera", match: null }, session: undefined, name: { text: STEM, placeholder: true } } });
    const r = await on(t.ctx.deps, "kind", "Video of 20 Oct, 10:00 (Mac Studio)", "session", "--private", "yes");
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    assert.deepEqual([record.kind, record.name, record.session.teachings, record.editing], ["session", { text: LABEL, placeholder: false }, null, null]);
    assert.doesNotMatch(r.text, SECRET);
    t.done();
  });
});

describe("the training gate's words, and the account", () => {
  it("says off, lapsed, or nothing, by this Mac's settings and the clock", () => {
    const now = Date.parse("2026-10-20T15:00:00-05:00");
    assert.equal(teachingsWhy({}, now), TEACHINGS_OFF);
    assert.equal(teachingsWhy({ sessionTeachings: null }, now), TEACHINGS_OFF);
    assert.equal(teachingsWhy({ sessionTeachings: TAUGHT }, now), "");
    assert.equal(teachingsWhy({ sessionTeachings: { ...TAUGHT, at: "2026-07-01T09:00:00-05:00" } }, now), LAPSED);
    // Turned on later than now: the clock was set back, and the 90 days cannot be told. That is off, not lapsed.
    assert.equal(teachingsWhy({ sessionTeachings: { ...TAUGHT, at: "2026-11-01T09:00:00-05:00" } }, now), TEACHINGS_OFF);
  });
  it("takes an account as the one Jason checked only by the same email, and the same organisation when he recorded one", () => {
    assert.equal(sameAccount(ACCOUNT, ACCOUNT), true);
    assert.equal(sameAccount("Sallie@Example.com (BRIMM)", ACCOUNT), true);
    assert.equal(sameAccount(ACCOUNT, "sallie@example.com"), true);
    assert.equal(sameAccount("sallie@example.com (Other)", ACCOUNT), false);
    assert.equal(sameAccount("sallie@example.com", ACCOUNT), false);
    assert.equal(sameAccount("jason@example.com (BRIMM)", ACCOUNT), false);
    assert.equal(sameAccount("", ACCOUNT), false);
    assert.equal(sameAccount(ACCOUNT, undefined), false);
  });
});

describe("teachings refuses, in this order, asking Claude nothing and writing nothing", () => {
  /** What a refusal leaves: `words` said with 1, nothing asked, started or written. */
  const refused = async (mac, words, argv = ["teachings", LABEL]) => {
    const before = snapshot(mac.found);
    const r = await on(mac.t.ctx.deps, ...argv);
    assert.deepEqual([r.code, r.said], [1, [words]]);
    assert.deepEqual([calls(mac.t), mac.t.started, snapshot(mac.found)], [[], [], before]);
    return r;
  };
  it("with the training gate off on this Mac", async () => {
    const mac = sessionMac({ taught: null });
    await refused(mac, TEACHINGS_OFF);
    assert.deepEqual(authCalls(mac.t), []);
    mac.t.done();
  });
  it("with the gate turned on 90 days ago or more, in words of its own", async () => {
    const mac = sessionMac({ taught: { ...TAUGHT, at: "2026-07-01T09:00:00-05:00" }, settings: { readings: false } });
    await refused(mac, LAPSED);
    assert.deepEqual(authCalls(mac.t), []);
    mac.t.done();
  });
  it("when the claude command is signed in to another account than the one Jason checked, or cannot say which", async () => {
    for (const status of [{ ...STATUS, email: "jason@example.com" }, { ...STATUS, orgName: "Another" }, null]) {
      const mac = sessionMac({ status, settings: { readings: false } });
      await refused(mac, OTHER_ACCOUNT);
      assert.equal(authCalls(mac.t).length, 1);
      mac.t.done();
    }
  });
  it("for words it does not take, with the help and 2", async () => {
    const mac = sessionMac();
    const r = await on(mac.t.ctx.deps, "teachings", LABEL, "--now");
    assert.equal(r.code, 2);
    assert.match(r.said[0], /^The command line for episodes on this Mac\./);
    assert.deepEqual([calls(mac.t), authCalls(mac.t), mac.t.started, reread(mac.found).rev], [[], [], [], 1]);
    mac.t.done();
  });
  it("with readings off on this Mac", async () => {
    const mac = sessionMac({ settings: { readings: false } });
    await refused(mac, READINGS_OFF);
    mac.t.done();
  });
  it("for a video that is not a session", async () => {
    const mac = sessionMac({ over: { kind: "finished", session: undefined, name: { text: "Pricing talk", placeholder: false }, answer: { ...ANSWER, private: "no" } } });
    await refused(mac, "Pricing talk is not a client or group session: teachings are read only from one.", ["teachings", "Pricing talk"]);
    mac.t.done();
  });
  it("while another Mac has it", async () => {
    const mac = sessionMac({ over: { editing: { by: "Sallie's laptop", since: MARKED } } });
    await refused(mac, `Sallie's laptop has ${LABEL} open, so its teachings were not asked for. Say it again once it is let go there.`);
    mac.t.done();
  });
});

describe("teachings --transcript-only", () => {
  it("records her answer, says nothing goes to Claude, and is let through with the training gate off", async () => {
    const mac = sessionMac({ taught: null });
    const r = await on(mac.t.ctx.deps, "teachings", LABEL, "--transcript-only");
    assert.deepEqual([r.code, r.said], [0, [TRANSCRIPT_ONLY]]);
    const record = reread(mac.found);
    assert.deepEqual([record.rev, record.session.teachings, record.kind], [2, "transcript only", "session"]);
    assert.equal(episodeFault(record), "");
    assert.deepEqual([calls(mac.t), authCalls(mac.t), mac.t.started], [[], [], []]);
    mac.t.done();
  });
  it("lets a later teachings run the reading once the gate is on", async () => {
    const mac = sessionMac({ taught: null });
    await on(mac.t.ctx.deps, "teachings", LABEL, "--transcript-only");
    writeSettings(mac.t.home, { sessionTeachings: TAUGHT });
    const r = await on(mac.t.ctx.deps, "teachings", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(mac.found).session.teachings, "asked");
    assert.equal(mac.t.started.length, 1);
    mac.t.done();
  });
});

describe("teachings: the claim, her ask, and the reading started", () => {
  it("claims the session as kind does, records the ask, and starts the session's reading of that record", async () => {
    const mac = sessionMac();
    const r = await on(mac.t.ctx.deps, "teachings", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [STILL]);
    // The claim (rev 2), CLAIM_WAIT_MS for the other Mac's to come across, then her ask (rev 3), under the claim.
    assert.ok(mac.t.waits.includes(CLAIM_WAIT_MS));
    const record = reread(mac.found);
    const at = localStamp(new Date(Date.parse("2026-10-20T15:00:00-05:00") + CLAIM_WAIT_MS));
    assert.equal(record.rev, 3);
    assert.deepEqual(record.session, { ...MARK, teachings: "asked", asked: at });
    assert.deepEqual(record.editing.by, "Mac Studio");
    assert.equal(episodeFault(record), "");
    assert.deepEqual(mac.t.started.map(([, args]) => args.slice(1)), [readArgs(3)]);
    assert.deepEqual(calls(mac.t), []);
    assert.doesNotMatch(r.text, SECRET);
    mac.t.done();
  });
  it("does not claim again a session this Mac holds", async () => {
    const mac = sessionMac({ over: { editing: { by: "Mac Studio", since: MARKED } } });
    const r = await on(mac.t.ctx.deps, "teachings", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(mac.found).rev, 2);
    assert.ok(!mac.t.waits.includes(CLAIM_WAIT_MS));
    assert.deepEqual(mac.t.started.map(([, args]) => args.slice(1)), [readArgs(2)]);
    mac.t.done();
  });
  it("waits in the foreground for the reading, as kind does, and says what Claude found", async () => {
    const mac = sessionMac();
    const { t } = mac;
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      if (ms === READ_POLL_MS) await new Promise((done) => setImmediate(done));
      await wait(ms);
    };
    t.ctx.deps.alive = (pid) => pid === process.pid;
    let run = null;
    t.ctx.deps.start = (cmd, args) => {
      run = editMain(args.slice(1), { ...t.ctx.deps, say: () => {} });
    };
    const r = await on(t.ctx.deps, "teachings", LABEL);
    assert.equal(r.code, 0, r.text);
    await run;
    const said = r.said[r.said.length - 1];
    assert.match(said, new RegExp(`^${LABEL}: read `), said);
    assert.match(said, /Made: 3 principles, 2 recurring principles, 3 Reel ideas\./, said);
    assert.doesNotMatch(r.text, SECRET);
    assert.equal(calls(t).length, 1);
    t.done();
  });
});

describe("read --kind session: the session's one reading", () => {
  it("asks Claude once, with the session's request of the plan's words and no file name, the gate and the account checked first", async () => {
    const { t, found, asks, read } = await readSession();
    assert.deepEqual(asks, [requestFor("session", PLAN, { duration: 26 })]);
    assert.doesNotMatch(asks[0], /Quillon Marsh|\.mp4/);
    assert.deepEqual(calls(t)[0].args.slice(0, 3), ["-p", "--model", CLAUDE_MODEL]);
    // The account is read right before the call, and kept in the record, never said.
    assert.equal(authCalls(t).length, 1);
    assert.equal(reread(found).reading.account, ACCOUNT);
    assert.doesNotMatch(read.text + readFileSync(resultFile(t.home, FOLDER, "read"), "utf8"), /sallie@example\.com/);
    t.done();
  });
  it("writes its principles and Reel ideas under the session's name, with what the name check left, and no reels.json", async () => {
    const { t, found, notices } = await readSession();
    const record = reread(found);
    assert.equal(record.rev, 2);
    assert.deepEqual(record.reading, { kind: "session", model: CLAUDE_MODEL, at: NOW, on: "Mac Studio", account: ACCOUNT, outcome: "read", principles: TEACHINGS_JSON });
    assert.equal(episodeFault(record), "");
    for (const rel of [TEACHINGS_JSON, TEACHINGS_TXT, IDEAS_TXT]) {
      assert.ok(existsSync(join(found.folder, rel)), rel);
      assert.equal(record.files[rel], Buffer.byteLength(fileOf(found, rel)), rel);
      assert.doesNotMatch(fileOf(found, rel), SECRET, rel);
    }
    for (const rel of ["reels.json", `${STEM}.reel-suggestions.txt`]) assert.ok(!existsSync(join(found.folder, rel)), rel);
    assert.equal(record.offers, undefined);
    const kept = JSON.parse(fileOf(found, TEACHINGS_JSON));
    assert.deepEqual(kept.principles.map((p) => [p.n, p.name]), [[1, "Price the outcome"], [2, "Say the price first"], [3, undefined]]);
    assert.deepEqual(kept.principles[0].steps, ["Name the result the buyer wants."]);
    // Her show's names and the platforms she speaks of are nobody's name: they do not trip the check.
    assert.equal(kept.principles[0].description, REPLY.frameworks[0].description);
    assert.equal(kept.principles[0].source_context, REPLY.frameworks[0].source_context);
    assert.equal("example_application" in kept.principles[1], false);
    // With no speaker labels, no words are known to be hers.
    assert.deepEqual(kept.principles.map((p) => p.verbatim_key_phrases), [[], [], []]);
    assert.deepEqual(kept.recurringPrinciples, [{ n: 1, text: "Price is a message." }, { n: 2 }]);
    assert.deepEqual(kept.reelIdeas.map((r) => [r.n, r.idea, r.refilm, r.principle]), [[1, "Why price is a message", true, 1], [2, "Say it first", false, 2], [3, "One number", true, 3]]);
    assert.deepEqual(kept.dropped.map((d) => `${d.field}: ${d.why}.`), TAKEN_OUT);
    assert.deepEqual(notices, [`Claude has read ${LABEL}: say "what did Claude find?"`]);
    t.done();
  });
  it("says what it took out as field and why, never the names, and nothing of the reply in its log or result", async () => {
    const { t, read } = await readSession();
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, true);
    assert.deepEqual(result.made, ["3 principles", "2 recurring principles", "3 Reel ideas"]);
    for (const line of TAKEN_OUT) assert.ok(result.failed.includes(line), `${line}\n${result.failed.join("\n")}`);
    const all = read.text + "\n" + readFileSync(resultFile(t.home, FOLDER, "read"), "utf8");
    assert.doesNotMatch(all, SECRET);
    for (const words of ["Price the outcome", "baker", "Your price is a message"]) assert.ok(!all.includes(words), words);
    t.done();
  });
  it("replaces every speaker of the meeting's transcript but her, and asks with that text alone, keeping her own key phrases", async () => {
    const files = { ...FILES, [VTT_FILE]: VTT };
    const reply = { ...REPLY, frameworks: [{ ...REPLY.frameworks[0], verbatim_key_phrases: ["Your price is a message.", "As Jorund said, price it."], example_application: "As Jorund put it, a baker prices by the celebration." }, ...REPLY.frameworks.slice(1)] };
    const { t, found, asks } = await readSession({ files, reply });
    const speakers = replaceSpeakers(VTT, HOST).text;
    assert.match(speakers, /Participant 1: So Quillon asked/);
    assert.deepEqual(asks, [requestFor("session", PLAN, { duration: 26, speakers })]);
    assert.doesNotMatch(asks[0], /Jorund|Pell/);
    const kept = JSON.parse(fileOf(found, TEACHINGS_JSON));
    // The speaker the tool replaced is a name it can see: a key phrase that names him is taken out, her own is kept.
    assert.deepEqual(kept.principles[0].verbatim_key_phrases, ["Your price is a message."]);
    assert.ok(kept.dropped.some((d) => d.field === "Principle 1's verbatim_key_phrases, entry 2"));
    // A speaker's name in a principle's example takes that field out, and the result says so, by the field alone.
    assert.equal("example_application" in kept.principles[0], false);
    assert.ok(readResult(t.home, FOLDER, "read").failed.includes("Principle 1's example_application: it held a name brimm-video can see."));
    for (const rel of listAll(found.folder).filter((r) => !r.startsWith("record/") && r !== VTT_FILE && !r.startsWith(STEM))) assert.doesNotMatch(fileOf(found, rel), SECRET, rel);
    t.done();
  });
  it("gives no speakers when the meeting's transcript names nobody but her, and keeps no key phrases then", async () => {
    const { found, asks, t } = await readSession({ files: { ...FILES, [VTT_FILE]: VTT_HERS } });
    assert.deepEqual(asks, [requestFor("session", PLAN, { duration: 26 })]);
    assert.deepEqual(JSON.parse(fileOf(found, TEACHINGS_JSON)).principles[0].verbatim_key_phrases, []);
    t.done();
  });
  it("tells her lines from the others' by the host this Mac's settings name", async () => {
    const files = { ...FILES, [VTT_FILE]: VTT };
    const { asks, t } = await readSession({ files, settings: { host: "Sallie Jane Ogden" } });
    assert.deepEqual(asks, [requestFor("session", PLAN, { duration: 26, speakers: replaceSpeakers(VTT, "Sallie Jane Ogden").text })]);
    t.done();
  });
  it("checks the names a person gave the video before it was a session, and takes no spelling of the record as no one's", async () => {
    // Before it was marked, it was answered raw and named for the client (record 1); a spelling she gave then names her business.
    const reply = { ...REPLY, frameworks: [{ ...REPLY.frameworks[0], description: "As Ossery learned, charge for the outcome." }, ...REPLY.frameworks.slice(1)] };
    const mac = sessionMac({ reply, over: { ...ASKED_OVER, spellings: [["Brandville", "Brandvale"]] } });
    const session = reread(mac.found);
    writeFileSync(recordFile(mac.found.folder, 1), recordText({ ...session, kind: "raw", session: undefined, name: { text: "Ossery pricing chat", placeholder: false }, answer: { ...ANSWER, private: "no" }, editing: null }));
    writeFileSync(recordFile(mac.found.folder, 2), recordText({ ...session, rev: 2 }));
    const r = await on(mac.t.ctx.deps, ...readArgs(2));
    assert.equal(r.code, 0, r.text);
    const kept = JSON.parse(fileOf(mac.found, TEACHINGS_JSON));
    assert.equal("description" in kept.principles[0], false);
    assert.ok(kept.dropped.some((d) => d.field === "Principle 2's example_application"), "a spelling of the record does not leave its words out");
    assert.doesNotMatch(r.text + readFileSync(resultFile(mac.t.home, FOLDER, "read"), "utf8"), /Ossery|Brandvale/);
    mac.t.done();
  });
  it("says so when the transcriber capitalised the recording throughout, so its capitalised words were not checked", async () => {
    const SKIPPED = "The transcriber wrote this recording with capitals throughout, so brimm-video did not check its capitalised words for names: only the speakers' names and the file's name were checked.";
    const shouted = { ...PLAN, phrases: [{ id: "p1", start: 0, end: 9, keep: true, text: "Welcome Back Everyone To The Group Call Where We Talk About Pricing For Your Business And How To Set It Right Every Single Time." }, ...PHRASES.slice(1)] };
    const { t } = await readSession({ files: { ...FILES, [`${STEM}.cut-plan.json`]: JSON.stringify(shouted) } });
    assert.ok(readResult(t.home, FOLDER, "read").failed.includes(SKIPPED));
    const r = await on(t.ctx.deps, "principles", LABEL);
    assert.ok(r.said.includes(SKIPPED), r.text);
    t.done();
  });
  it("numbers every list on from the highest number ever given to the video, each Reel idea's principle with it", async () => {
    const reels = { format: "brimm-video reels", version: 2, video: VIDEO, by: "read", made: MARKED, highest: 7, candidates: [] };
    const { found, t } = await readSession({ files: { ...FILES, "reels.json": JSON.stringify(reels) } });
    const kept = JSON.parse(fileOf(found, TEACHINGS_JSON));
    assert.deepEqual(kept.principles.map((p) => p.n), [8, 9, 10]);
    assert.deepEqual(kept.recurringPrinciples.map((r) => r.n), [8, 9]);
    assert.deepEqual(kept.reelIdeas.map((r) => [r.n, r.principle]), [[8, 8], [9, 9], [10, 10]]);
    assert.deepEqual(kept.dropped.map((d) => d.field), ["Principle 8's steps, entry 2", "Principle 9's example_application", "Principle 9's source_context", "Principle 10's name", "Recurring principle 9's text", "Reel idea 10's words"]);
    t.done();
  });
  it("is one reading for each ask: a second run for the same ask is refused, and nothing is asked", async () => {
    const { t, found, asks } = await readSession();
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs(2));
    assert.equal(r.code, 1);
    assert.deepEqual([asks.length, snapshot(found)], [1, before]);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [`${LABEL} was read already since its teachings were asked for. Nothing was asked of Claude.`]);
    t.done();
  });
  it("is refused for a session whose teachings were not asked for, or whose answer was the transcript only", async () => {
    for (const session of [MARK, { ...MARK, teachings: "transcript only" }, { ...MARK, teachings: "asked" }]) {
      const mac = sessionMac({ over: { session, editing: { by: "Mac Studio", since: MARKED } } });
      const r = await on(mac.t.ctx.deps, ...readArgs(1));
      assert.equal(r.code, 1);
      assert.deepEqual([calls(mac.t), readResult(mac.t.home, FOLDER, "read").failed], [[], [`${LABEL}'s teachings were not asked for, so Claude did not read it. Nothing was changed.`]], JSON.stringify(session));
      mac.t.done();
    }
  });
  it("checks the gate, the account and readings again right before the call, and asks nothing when one has changed", async () => {
    const cases = [
      [TEACHINGS_OFF, (mac) => writeSettings(mac.t.home, { sessionTeachings: null })],
      [OTHER_ACCOUNT, (mac) => (mac.state.status = { ...STATUS, email: "jason@example.com" })],
      [READINGS_OFF, (mac) => writeSettings(mac.t.home, { readings: false })]
    ];
    for (const [words, change] of cases) {
      const mac = sessionMac({ over: ASKED_OVER });
      mac.state.onAuth = () => change(mac);
      const before = snapshot(mac.found);
      const r = await on(mac.t.ctx.deps, ...readArgs(1));
      assert.equal(r.code, 1, words);
      assert.deepEqual([calls(mac.t), snapshot(mac.found), readResult(mac.t.home, FOLDER, "read").failed], [[], before, [words]], words);
      mac.t.done();
    }
  });
  it("sets the earlier teachings aside into history/ when they are asked for again, and numbers on from them", async () => {
    const { t, found, asks, state } = await readSession();
    const first = { json: fileOf(found, TEACHINGS_JSON), txt: fileOf(found, TEACHINGS_TXT), ideas: fileOf(found, IDEAS_TXT) };
    // She decided some, then asked for the teachings again.
    await on(t.ctx.deps, "principles", LABEL, "keep", "1");
    const asked = localStamp(new Date(t.now()));
    const record = reread(found);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, session: { ...record.session, asked } }));
    await t.ctx.deps.wait(2000);
    state.reply = { ...REPLY, frameworks: [REPLY.frameworks[0]], recurring_principles: ["Decide once."], reel_ideas: [] };
    const r = await on(t.ctx.deps, ...readArgs(record.rev + 1));
    assert.equal(r.code, 0, r.text);
    assert.equal(asks.length, 2);
    const history = readdirSync(join(found.folder, "history")).sort();
    const aside = (ending) => history.find((name) => name.endsWith(`${LABEL}${ending}`));
    assert.equal(readFileSync(join(found.folder, "history", aside(".principles.json")), "utf8"), first.json);
    assert.equal(readFileSync(join(found.folder, "history", aside(".principles.txt")), "utf8"), first.txt);
    assert.equal(readFileSync(join(found.folder, "history", aside(".reel-ideas.txt")), "utf8"), first.ideas);
    const kept = JSON.parse(fileOf(found, TEACHINGS_JSON));
    assert.deepEqual([kept.principles.map((p) => p.n), kept.recurringPrinciples.map((p) => p.n)], [[4], [4]]);
    // Her decisions were of the earlier items: none is carried to the new ones.
    const now = reread(found);
    assert.equal(now.session.decided, undefined);
    assert.equal(episodeFault(now), "");
    t.done();
  });
});

describe("read --kind session, asked again while the earlier teachings are not on this Mac", () => {
  it("brings them over first, and asks nothing while Dropbox is still bringing them, naming no file", async () => {
    const { t, found, asks } = await readSession();
    const record = reread(found);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, session: { ...record.session, asked: localStamp(new Date(t.now())) } }));
    await t.ctx.deps.wait(2000);
    const brought = [];
    t.ctx.deps.isWhole = (path) => !path.endsWith(TEACHINGS_TXT);
    t.ctx.deps.readAll = async (path) => brought.push(path);
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs(record.rev + 1));
    assert.equal(r.code, 1);
    assert.deepEqual([asks.length, brought, snapshot(found)], [1, [join(found.folder, TEACHINGS_TXT)], before]);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [`Dropbox is still bringing its earlier teachings over to this Mac, so Claude did not read ${LABEL}.`]);
    assert.equal(readResult(t.home, FOLDER, "read").next, "Nothing was changed. Ask for its teachings again to have Claude read it.");
    t.done();
  });
});

describe("principles and ideas: what Claude read, for her to decide", () => {
  it("prints each principle, its example and key phrases first, with the check line, what was taken out, and what is decided", async () => {
    const { t } = await readSession();
    const r = await on(t.ctx.deps, "principles", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said[0], `${LABEL}: 3 principles and 2 recurring principles, from Claude's reading of 2026-10-20.`);
    assert.equal(r.said[1], CHECK);
    for (const line of TAKEN_OUT.filter((l) => !l.startsWith("Reel"))) assert.ok(r.said.includes(`Taken out: ${line}`), line);
    const at = r.said.indexOf("Principle 1: Price the outcome (pricing). Not decided yet.");
    assert.ok(at > 1, r.text);
    assert.deepEqual(r.said.slice(at + 1, at + 3), ["  Example: A baker prices a wedding cake by the celebration it serves.", "  Key phrases: none"]);
    assert.ok(r.said.includes(`  Where it came up ${FOR_HER}: Early on, when the group talked about raising prices.`), r.text);
    assert.ok(r.said.includes("Principle 3: (taken out) (operations). Not decided yet."), r.text);
    assert.ok(r.said.includes("Recurring principle 1: Price is a message. Not decided yet."), r.text);
    assert.ok(r.said.includes("Recurring principle 2: (taken out). Not decided yet."), r.text);
    assert.doesNotMatch(r.text, SECRET);
    t.done();
  });
  it("prints each Reel idea, whether it is filmed again or cut from the session, and the principle it shows", async () => {
    const { t } = await readSession();
    const r = await on(t.ctx.deps, "ideas", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said[0], `${LABEL}: 3 Reel ideas, from Claude's reading of 2026-10-20.`);
    assert.equal(r.said[1], CHECK);
    assert.ok(r.said.includes("Taken out: Reel idea 3's words: it held a name brimm-video can see."), r.text);
    assert.ok(r.said.includes("Reel idea 1: Why price is a message. To film again; it shows principle 1. Not decided yet."), r.text);
    assert.ok(r.said.includes("Reel idea 2: Say it first. To cut from the session, once the client agrees; it shows principle 2. Not decided yet."), r.text);
    assert.ok(r.said.includes("  Words: Your price has already told them how much to expect."), r.text);
    assert.doesNotMatch(r.text, SECRET);
    t.done();
  });
  it("keeps, drops and changes items by her command, each in one record write, and says what is left to decide", async () => {
    const { t, found } = await readSession();
    const rev = reread(found).rev;
    const kept = await on(t.ctx.deps, "principles", LABEL, "keep", "1", "2");
    assert.deepEqual([kept.code, kept.said], [0, [`${LABEL}: principles 1 and 2 kept.`, "Still to decide: principle 3; recurring principles 1 and 2; Reel ideas 1, 2 and 3."]]);
    assert.equal(reread(found).rev, rev + 1);
    const dropped = await on(t.ctx.deps, "principles", LABEL, "drop", "3");
    assert.deepEqual(dropped.said, [`${LABEL}: principle 3 dropped.`, "Still to decide: recurring principles 1 and 2; Reel ideas 1, 2 and 3."]);
    const edited = await on(t.ctx.deps, "principles", LABEL, "edit", "2", "--example_application", "A florist names her price in the first call.");
    assert.deepEqual(edited.said, [`${LABEL}: principle 2 changed and kept.`, "Still to decide: recurring principles 1 and 2; Reel ideas 1, 2 and 3."]);
    await on(t.ctx.deps, "principles", LABEL, "recurring", "keep", "1");
    await on(t.ctx.deps, "principles", LABEL, "recurring", "drop", "2");
    await on(t.ctx.deps, "ideas", LABEL, "keep", "1,2");
    const last = await on(t.ctx.deps, "ideas", LABEL, "edit", "3", "--words", "One number, every Monday.");
    assert.deepEqual(last.said, [`${LABEL}: Reel idea 3 changed and kept.`, "Every item is decided: finish it to write its hand-off."]);
    const record = reread(found);
    assert.equal(record.rev, rev + 7);
    assert.deepEqual(record.session.decided, { principles: { 1: "kept", 2: "kept", 3: "dropped" }, recurringPrinciples: { 1: "kept", 2: "dropped" }, reelIdeas: { 1: "kept", 2: "kept", 3: "kept" } });
    assert.deepEqual(record.session.edits, { principles: { 2: { example_application: "A florist names her price in the first call." } }, reelIdeas: { 3: { words: "One number, every Monday." } } });
    assert.equal(episodeFault(record), "");
    // The listing shows what she decided, and her change.
    const listing = await on(t.ctx.deps, "principles", LABEL);
    assert.ok(listing.said.includes("Principle 1: Price the outcome (pricing). Kept."), listing.text);
    assert.ok(listing.said.includes("Principle 2: Say the price first (sales). Kept, as you changed it."), listing.text);
    assert.ok(listing.said.includes("  Example: A florist names her price in the first call."), listing.text);
    assert.ok(listing.said.includes("Principle 3: (taken out) (operations). Dropped."), listing.text);
    t.done();
  });
  it("refuses what cannot be done, in plain words, and writes nothing", async () => {
    const { t, found } = await readSession();
    const before = snapshot(found);
    for (const [argv, words] of [
      [["principles", LABEL, "keep", "9"], "There is no 9 in this list."],
      [["principles", LABEL, "keep"], "Say which numbers: keep 1 3."],
      [["principles", LABEL, "edit", "1", "--steps", "x"], "--steps cannot be changed here: change name, category, description or example_application."],
      [["principles", LABEL, "recurring", "edit", "1", "--name", "x"], "--name cannot be changed here: change text."],
      [["ideas", LABEL, "edit", "1", "--principle", "2"], "--principle cannot be changed here: change idea, words or why."],
      [["ideas", LABEL, "keep", "4"], "There is no 4 in this list."]
    ]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.said], [1, [words]], argv.join(" "));
    }
    assert.deepEqual(snapshot(found), before);
    t.done();
  });
  it("says there is nothing to decide before Claude has read the session, and is refused with the gate off", async () => {
    const mac = sessionMac();
    for (const command of ["principles", "ideas"]) {
      const r = await on(mac.t.ctx.deps, command, LABEL);
      assert.deepEqual([r.code, r.said], [1, [`${LABEL} has no teachings yet: Claude has not read it.`]], command);
    }
    writeSettings(mac.t.home, { sessionTeachings: null });
    for (const command of ["principles", "ideas"]) assert.deepEqual((await on(mac.t.ctx.deps, command, LABEL)).said, [TEACHINGS_OFF], command);
    mac.t.done();
  });
});

describe("finish, for a session: its own hand-off of what she approved", () => {
  /** The made-up session read, and every item decided as the hand-off test wants. */
  async function decided({ settings = { handoffVersion: 2 } } = {}) {
    const mac = await readSession({ settings });
    const { t } = mac;
    for (const argv of [["principles", LABEL, "keep", "1", "2"], ["principles", LABEL, "drop", "3"], ["principles", LABEL, "recurring", "keep", "1"], ["principles", LABEL, "recurring", "drop", "2"], ["ideas", LABEL, "keep", "1", "2"], ["ideas", LABEL, "drop", "3"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.equal(r.code, 0, `${argv.join(" ")}: ${r.text}`);
    }
    return mac;
  }
  it("refuses under hand-off version 1, writing nothing", async () => {
    for (const [handoff, settings] of [[1, { handoffVersion: 1 }], [undefined, {}]]) {
      const mac = await decided({ settings });
      const before = snapshot(mac.found);
      const rev = reread(mac.found).rev;
      const r = await on(mac.t.ctx.deps, "finish", LABEL);
      assert.deepEqual([r.code, r.said], [1, [V1_WAITS]], String(handoff));
      assert.deepEqual([snapshot(mac.found), reread(mac.found).rev], [before, rev]);
      mac.t.done();
    }
  });
  it("refuses while an item is undecided, in the words of each", async () => {
    const mac = await readSession({ settings: { handoffVersion: 2 } });
    await on(mac.t.ctx.deps, "principles", LABEL, "keep", "1");
    const before = snapshot(mac.found);
    const r = await on(mac.t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 1);
    assert.ok(r.said.includes("Principle 2 is not decided yet: keep it or drop it."), r.text);
    assert.ok(r.said.includes("Reel idea 3 is not decided yet: keep it or drop it."), r.text);
    assert.deepEqual(snapshot(mac.found), before);
    mac.t.done();
  });
  it("refuses a kept item whose required field the name check took out, until she changes it or drops it", async () => {
    const mac = await readSession({ settings: { handoffVersion: 2 } });
    const { t, found } = mac;
    for (const argv of [["principles", LABEL, "keep", "1", "2", "3"], ["principles", LABEL, "recurring", "keep", "1", "2"], ["ideas", LABEL, "keep", "1", "2", "3"]]) await on(t.ctx.deps, ...argv);
    const before = snapshot(found);
    const r = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, [
      "Principle 3's name held a name brimm-video took out: give it another name, or drop it.",
      "Recurring principle 2's text held a name brimm-video took out: say it another way, or drop it.",
      "Reel idea 3's words held a name brimm-video took out: say it another way, or drop it."
    ]);
    assert.deepEqual(snapshot(found), before);
    await on(t.ctx.deps, "principles", LABEL, "edit", "3", "--name", "Check one number");
    await on(t.ctx.deps, "principles", LABEL, "recurring", "drop", "2");
    await on(t.ctx.deps, "ideas", LABEL, "drop", "3");
    const done = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(done.code, 0, done.text);
    const handoff = JSON.parse(fileOf(found, HANDOFF));
    assert.deepEqual(handoff.session.principles.map((p) => [p.n, p.name]), [[1, "Price the outcome"], [2, "Say the price first"], [3, "Check one number"]]);
    t.done();
  });
  it("writes the session's hand-off of approved items only, with the contract's keys, no source_context, no transcript and no file name", async () => {
    const mac = await decided();
    const { t, found } = mac;
    const r = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 0, r.text);
    // Only the hand-off in final/: no transcript of the session, no captions.
    assert.deepEqual(t.inFinal(found), [`${LABEL}.brimm-ops.json`]);
    const text = fileOf(found, HANDOFF);
    const handoff = JSON.parse(text);
    assert.doesNotMatch(text, SECRET);
    assert.doesNotMatch(text, /\.mp4|\.srt|source_context|Welcome back/);
    assert.deepEqual([handoff.version, handoff.revision, handoff.video, "main" in handoff, "suggestions" in handoff, handoff.reels], [2, 1, { id: ID, kind: "session", name: LABEL, recorded: "2026-10-20", recordedFrom: "video" }, false, false, []]);
    const contract = new Set(keyPaths(CONTRACT));
    for (const path of keyPaths(handoff)) assert.ok(contract.has(path), `${path} is not a key of the contract`);
    assert.deepEqual(handoff.session.principles.map((p) => p.n), [1, 2]);
    assert.deepEqual(handoff.session.principles[0], {
      n: 1, name: "Price the outcome", category: "pricing", description: REPLY.frameworks[0].description, steps: ["Name the result the buyer wants."], red_flags: ["Pricing by the hour."],
      green_flags: ["A price said in one sentence."], decision_criteria: ["Does the price say what the work is worth?"], example_application: REPLY.frameworks[0].example_application, verbatim_key_phrases: []
    });
    // A field the name check took out is written empty, as the page reads a missing one.
    assert.equal(handoff.session.principles[1].example_application, "");
    assert.deepEqual(handoff.session.recurringPrinciples, [{ n: 1, text: "Price is a message." }]);
    // Only a kept Reel idea to film again is in it; one to cut from the session waits for the client's agreement.
    assert.deepEqual(handoff.session.reelsToFilm, [{ n: 1, idea: "Why price is a message", words: "Your price has already told them how much to expect.", why: "It stands alone.", principle: 1 }]);
    // The record says it is handed off, the claim is let go, and it is shown in Finder through the program runner.
    const record = reread(found);
    assert.deepEqual([record.finished.revision, record.finished.handoff, record.editing], [1, HANDOFF, null]);
    assert.equal(record.files[HANDOFF], Buffer.byteLength(text));
    assert.equal(episodeFault(record), "");
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args), [["-R", join(found.folder, HANDOFF)]]);
    assert.deepEqual(r.said, [`${LABEL}: its hand-off is written, revision 1, with 2 principles, 1 recurring principle and 1 Reel idea to film. It is shown in Finder: drop it on the BRIMM Ops page.`]);
    assert.doesNotMatch(r.text, SECRET);
    t.done();
  });
  it("runs the name check again on what she changed, and leaves out what it takes, saying so", async () => {
    const mac = await decided();
    const { t, found } = mac;
    // `edit` refuses such words (fix 2): a change that holds one only reaches the finish as the record holds it by another way.
    const refused = await on(t.ctx.deps, "principles", LABEL, "edit", "1", "--description", "Ask Quillon what the work is worth to him.");
    assert.equal(refused.code, 1);
    const record = reread(found);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, session: { ...record.session, edits: { principles: { 1: { description: "Ask Quillon what the work is worth to him." } } } } }));
    const r = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said[0], "Taken out of the hand-off: Principle 1's description: it held a name brimm-video can see.");
    const handoff = JSON.parse(fileOf(found, HANDOFF));
    assert.equal(handoff.session.principles[0].description, "");
    assert.doesNotMatch(JSON.stringify(handoff) + r.text, SECRET);
    t.done();
  });
  it("gives a Reel idea no principle when the principle it shows is not in the hand-off", async () => {
    const mac = await readSession({ settings: { handoffVersion: 2 } });
    const { t, found } = mac;
    for (const argv of [["principles", LABEL, "drop", "1", "3"], ["principles", LABEL, "keep", "2"], ["principles", LABEL, "recurring", "drop", "1", "2"], ["ideas", LABEL, "keep", "1"], ["ideas", LABEL, "drop", "2", "3"]]) await on(t.ctx.deps, ...argv);
    const r = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(JSON.parse(fileOf(found, HANDOFF)).session.reelsToFilm.map((i) => [i.n, i.principle]), [[1, null]]);
    t.done();
  });
  it("writes the next revision when she finishes it again", async () => {
    const mac = await decided();
    const { t, found } = mac;
    await on(t.ctx.deps, "finish", LABEL);
    await on(t.ctx.deps, "principles", LABEL, "drop", "2");
    const r = await on(t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 0, r.text);
    const handoff = JSON.parse(fileOf(found, HANDOFF));
    assert.deepEqual([handoff.revision, handoff.session.principles.map((p) => p.n), reread(found).finished.revision], [2, [1], 2]);
    assert.deepEqual(t.inFinal(found), [`${LABEL}.brimm-ops.json`]);
    t.done();
  });
  it("refuses while its teachings are not whole on this Mac, or another Mac has it, writing nothing", async () => {
    const mac = await decided();
    const { t, found } = mac;
    const before = snapshot(found);
    const brought = [];
    t.ctx.deps.isWhole = (path) => !path.endsWith(TEACHINGS_JSON);
    t.ctx.deps.readAll = async (path) => brought.push(path);
    const coming = await on(t.ctx.deps, "finish", LABEL);
    assert.deepEqual(brought, [join(found.folder, TEACHINGS_JSON)]);
    assert.deepEqual([coming.code, coming.said], [1, ["Dropbox is still bringing its teachings, or the words they are checked against, over to this Mac: say it again in a minute."]]);
    t.ctx.deps.isWhole = () => true;
    const record = reread(found);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, editing: { by: "Sallie's laptop", since: MARKED } }));
    const held = await on(t.ctx.deps, "finish", LABEL);
    assert.deepEqual([held.code, held.said], [1, [`Sallie's laptop has ${LABEL} open, so its hand-off was not written. Say it again once it is let go there.`]]);
    assert.ok(!existsSync(join(found.folder, "final")));
    assert.deepEqual(Object.keys(snapshot(found)).filter((rel) => !rel.startsWith("record/")), Object.keys(before).filter((rel) => !rel.startsWith("record/")));
    t.done();
  });
  it("refuses a session Claude has not read, writing nothing", async () => {
    const mac = sessionMac({ settings: { handoffVersion: 2 } });
    const r = await on(mac.t.ctx.deps, "finish", LABEL);
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} has no teachings to hand off yet: Claude has not read it. Nothing was written.`]]);
    assert.ok(!existsSync(join(mac.found.folder, "final")));
    mac.t.done();
  });
});

describe("name, for a session: checked against the names brimm-video can see", () => {
  it("refuses a name that holds one, from the file, the words or a speaker, with the gate off too, and writes nothing", async () => {
    const mac = sessionMac({ taught: null, files: { ...FILES, [VTT_FILE]: VTT } });
    const before = snapshot(mac.found);
    for (const [words, word] of [["Quillon pricing", "Quillon"], ["The Brandvale call", "Brandvale"], ["Talk with Marsh", "Marsh"], ["Pell on pricing", "Pell"]]) {
      const r = await on(mac.t.ctx.deps, "name", LABEL, words);
      assert.deepEqual([r.code, r.said], [1, [NAME_HOLDS(word)]], words);
    }
    assert.deepEqual(snapshot(mac.found), before);
    mac.t.done();
  });
  it("gives it another name otherwise, which the files of its next reading are named by", async () => {
    const mac = sessionMac();
    const r = await on(mac.t.ctx.deps, "name", LABEL, "Pricing deep dive");
    assert.deepEqual([r.code, r.said], [0, ['It is called "Pricing deep dive" now. Nothing was renamed.']]);
    const record = reread(mac.found);
    assert.equal(record.name.text, "Pricing deep dive");
    writeFileSync(recordFile(mac.found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, ...ASKED_OVER }));
    const read = await on(mac.t.ctx.deps, ...readArgs(record.rev + 1));
    assert.equal(read.code, 0, read.text);
    assert.ok(existsSync(join(mac.found.folder, "Pricing deep dive.principles.json")));
    assert.equal(reread(mac.found).reading.principles, "Pricing deep dive.principles.json");
    mac.t.done();
  });
});

// --- Fix round 1 ---

/** The made-up session read, and every item decided: principles 1 and 2 kept, 3 dropped; recurring 1 kept, 2 dropped; Reel
    ideas 1 and 2 kept, 3 dropped. */
async function decidedSession({ settings = { handoffVersion: 2 }, ...options } = {}) {
  const mac = await readSession({ settings, ...options });
  for (const argv of [["principles", LABEL, "keep", "1", "2"], ["principles", LABEL, "drop", "3"], ["principles", LABEL, "recurring", "keep", "1"], ["principles", LABEL, "recurring", "drop", "2"], ["ideas", LABEL, "keep", "1", "2"], ["ideas", LABEL, "drop", "3"]]) {
    const r = await on(mac.t.ctx.deps, ...argv);
    assert.equal(r.code, 0, `${argv.join(" ")}: ${r.text}`);
  }
  return mac;
}
/** Write the next record of the made-up session by hand, its newest with `over` laid on it. */
const writeOver = (found, over) => {
  const record = reread(found);
  writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, ...over }));
};
const FILES_NAME = "That is the name of the video's file: give the session another name.";
const EDIT_HOLDS = (word) => `Those words hold "${word}", a name brimm-video can see in this session: say it another way.`;
const NAME_FILES_AT_FINISH = "This session's name is the name of its video's file: give it another name first. Nothing was written.";
const NAME_HOLDS_AT_FINISH = (word) => `This session's name holds "${word}", a name brimm-video can see in it: give it another name first. Nothing was written.`;
/** The client's names in her own words: in lowercase, as a plural, a possessive, and joined by a dot; each with the word a
    refusal names. */
const HER_FORMS = [["quillon's way", "quillon"], ["Quillons way", "Quillon"], ["the brandvale way", "brandvale"], ["brandvale’s way", "brandvale"], ["ask.quillon", "quillon"], ["MARSH first", "MARSH"]];

describe("fix 1: a session's name is never its file's", () => {
  it("refuses at name the video's file name or stem, in any case or form, with the gate off too", async () => {
    const mac = sessionMac({ taught: null });
    const before = snapshot(mac.found);
    for (const words of ["quillon marsh", "Quillon Marsh", "QUILLON MARSH", "quillon marsh.mp4", "Quillon Marsh.MP4", "quillon-marsh", "quillon_marsh", "QuillonMarsh"]) {
      const r = await on(mac.t.ctx.deps, "name", LABEL, words);
      assert.deepEqual([r.code, r.said], [1, [FILES_NAME]], words);
    }
    assert.deepEqual(snapshot(mac.found), before);
    mac.t.done();
  });
  it("refuses at finish a name written by hand that is the file's, in any form, writing no hand-off and saying nothing of it", async () => {
    for (const text of ["quillon marsh", "quillon marsh.mp4", "Quillon-Marsh"]) {
      const mac = await decidedSession();
      writeOver(mac.found, { name: { text, placeholder: false } });
      const before = snapshot(mac.found);
      const r = await on(mac.t.ctx.deps, "finish", SHORT);
      assert.deepEqual([r.code, r.said], [1, [NAME_FILES_AT_FINISH]], text);
      assert.deepEqual([snapshot(mac.found), existsSync(join(mac.found.folder, "final"))], [before, false], text);
      mac.t.done();
    }
  });
  it("refuses at finish a name written by hand that holds a name in her lowercase", async () => {
    const mac = await decidedSession();
    writeOver(mac.found, { name: { text: "quillon's pricing", placeholder: false } });
    const r = await on(mac.t.ctx.deps, "finish", SHORT);
    assert.equal(r.code, 1);
    // The refusal says back the word of hers that tripped it (fix round 2), and nothing else of the name.
    assert.deepEqual(r.said, [NAME_HOLDS_AT_FINISH("quillon")]);
    assert.equal(existsSync(join(mac.found.folder, "final")), false);
    mac.t.done();
  });
  it("writes the hand-off under the name it holds, and names its file by that same name", async () => {
    const mac = await decidedSession();
    await on(mac.t.ctx.deps, "name", LABEL, "Pricing deep dive");
    const r = await on(mac.t.ctx.deps, "finish", "Pricing deep dive");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(mac.t.inFinal(mac.found), ["Pricing deep dive.brimm-ops.json"]);
    assert.equal(JSON.parse(fileOf(mac.found, "final/Pricing deep dive.brimm-ops.json")).video.name, "Pricing deep dive");
    mac.t.done();
  });
});

describe("fix 2: her own words are checked whatever their case", () => {
  it("refuses at name a name in lowercase, plural, possessive or dotted forms", async () => {
    const mac = sessionMac();
    for (const [words, word] of [...HER_FORMS, ["jorund"]]) {
      const r = await on(mac.t.ctx.deps, "name", LABEL, words);
      if (words === "jorund") assert.equal(r.code, 0, "no meeting transcript: no speaker to see");
      else assert.deepEqual([r.code, r.said], [1, [NAME_HOLDS(word)]], words);
      if (r.code === 0) writeOver(mac.found, { name: { text: LABEL, placeholder: false } });
    }
    mac.t.done();
  });
  it("refuses at edit, for each field she may change of each list, her words holding a name in any of those forms, writing nothing", async () => {
    const { t, found } = await readSession();
    const before = snapshot(found);
    const lists = [["principles", [], EDITS.principles], ["principles", ["recurring"], EDITS.recurringPrinciples], ["ideas", [], EDITS.reelIdeas]];
    for (const [command, prefix, fields] of lists) {
      for (const field of fields) {
        for (const [words, word] of HER_FORMS) {
          const r = await on(t.ctx.deps, command, LABEL, ...prefix, "edit", "1", `--${field}`, words);
          assert.deepEqual([r.code, r.said], [1, [EDIT_HOLDS(word)]], `${command} ${prefix} ${field} ${words}`);
        }
      }
    }
    assert.deepEqual(snapshot(found), before);
    // Words that hold none are taken.
    const ok = await on(t.ctx.deps, "principles", LABEL, "edit", "1", "--name", "Price what it changes");
    assert.equal(ok.code, 0, ok.text);
    t.done();
  });
  it("checks again at finish what is written of her changes, and refuses one that holds a name in her lowercase", async () => {
    const mac = await decidedSession();
    const session = reread(mac.found).session;
    writeOver(mac.found, { session: { ...session, edits: { principles: { 1: { description: "ask quillon what it is worth" } } } } });
    const before = snapshot(mac.found);
    const r = await on(mac.t.ctx.deps, "finish", LABEL);
    assert.deepEqual([r.code, r.said], [1, ["Principle 1's description, as you changed it, holds \"quillon\", a name brimm-video can see: say it another way, or drop it."]]);
    assert.deepEqual(snapshot(mac.found), before);
    mac.t.done();
  });
  it("refuses at finish a kept item whose required field, as she changed it, the name check takes out there", async () => {
    const mac = await decidedSession();
    const session = reread(mac.found).session;
    writeOver(mac.found, { session: { ...session, edits: { principles: { 2: { name: "Quillon's way" } } } } });
    const r = await on(mac.t.ctx.deps, "finish", LABEL);
    assert.deepEqual([r.code, r.said], [1, ["Principle 2's name held a name brimm-video took out: give it another name, or drop it."]]);
    assert.equal(existsSync(join(mac.found.folder, "final")), false);
    mac.t.done();
  });
});

describe("fix 3 and 4: the backstop before each try", () => {
  it("refuses when this Mac's settings cannot be read right before the call, asking nothing", async () => {
    for (const change of [(home) => writeFileSync(settingsFile(home), '{"version": 1, "sessionTeachings": nu'), (home) => rmSync(settingsFile(home))]) {
      const mac = sessionMac({ over: ASKED_OVER });
      mac.state.onAuth = () => change(mac.t.home);
      const r = await on(mac.t.ctx.deps, ...readArgs(1));
      assert.equal(r.code, 1);
      assert.deepEqual([calls(mac.t), readResult(mac.t.home, FOLDER, "read").failed], [[], [`This Mac's settings cannot be read now, so Claude did not read ${LABEL}: ask Jason.`]]);
      mac.t.done();
    }
  });
  it("reads the account again before the second try, and asks nothing more when it has changed", async () => {
    const mac = sessionMac({ over: ASKED_OVER });
    mac.state.onAsk = (n) => {
      if (n > 1) return null;
      mac.state.status = { ...STATUS, email: "jason@example.com" };
      return { code: 1, stderr: "it stopped", stdout: "" };
    };
    const r = await on(mac.t.ctx.deps, ...readArgs(1));
    assert.equal(r.code, 1);
    assert.deepEqual([calls(mac.t).length, authCalls(mac.t).length], [1, 2]);
    assert.deepEqual(readResult(mac.t.home, FOLDER, "read").failed, [OTHER_ACCOUNT]);
    assert.equal(reread(mac.found).reading, undefined);
    mac.t.done();
  });
});

describe("fix 5: the organisation Jason recorded", () => {
  it("is compared when he recorded one, whatever its case, and any is taken when he recorded the email alone", async () => {
    for (const [cli, org, starts] of [["sallie@example.com (BRIMM)", "Another", false], ["sallie@example.com (BRIMM)", "brimm", true], ["Sallie@Example.com", "Another", true]]) {
      const mac = sessionMac({ status: { ...STATUS, orgName: org }, taught: { ...TAUGHT, accounts: { cli, app: ACCOUNT } } });
      const r = await on(mac.t.ctx.deps, "teachings", LABEL);
      assert.equal(mac.t.started.length, starts ? 1 : 0, `${cli} / ${org}: ${r.text}`);
      if (!starts) assert.deepEqual(r.said, [OTHER_ACCOUNT]);
      mac.t.done();
    }
  });
});

describe("fix 6: a name she spelled is a name brimm-video can see", () => {
  it("takes out what Claude wrote of it, and refuses her words holding it; the show's own spellings are no one's", async () => {
    const reply = { ...REPLY, frameworks: [{ ...REPLY.frameworks[0], example_application: "As Kestrell does with her shop, and as Sallie says." }, ...REPLY.frameworks.slice(1)] };
    const { t, found } = await readSession({ reply, over: { spellings: [["kestrel", "Kestrell"], ["Sally", "Sallie"]] } });
    const kept = JSON.parse(fileOf(found, TEACHINGS_JSON));
    assert.equal("example_application" in kept.principles[0], false);
    assert.equal(kept.principles[0].description, REPLY.frameworks[0].description);
    const r = await on(t.ctx.deps, "principles", LABEL, "edit", "1", "--example_application", "As kestrel does.");
    assert.deepEqual([r.code, r.said], [1, [EDIT_HOLDS("kestrel")]]);
    t.done();
  });
});

describe("fix 7: only the record decides", () => {
  it("takes no `approved` written in the teachings file for her decision", async () => {
    const mac = await readSession({ settings: { handoffVersion: 2 } });
    const teachings = JSON.parse(fileOf(mac.found, TEACHINGS_JSON));
    for (const key of ["principles", "recurringPrinciples", "reelIdeas"]) teachings[key] = teachings[key].map((item) => ({ ...item, approved: true }));
    writeFileSync(join(mac.found.folder, TEACHINGS_JSON), JSON.stringify(teachings));
    const listing = await on(mac.t.ctx.deps, "principles", LABEL);
    assert.ok(listing.said.includes("Principle 1: Price the outcome (pricing). Not decided yet."), listing.text);
    const r = await on(mac.t.ctx.deps, "finish", LABEL);
    assert.equal(r.code, 1);
    assert.ok(r.said.includes("Principle 1 is not decided yet: keep it or drop it."), r.text);
    assert.equal(existsSync(join(mac.found.folder, "final")), false);
    mac.t.done();
  });
});

describe("fix 9: her answer of the transcript only, while the reading of her ask waits", () => {
  it("is recorded, and the reading then asks Claude nothing", async () => {
    const mac = sessionMac({ over: ASKED_OVER });
    const { t } = mac;
    t.ctx.deps.alive = (pid) => pid === process.pid;
    let release;
    const held = new Promise((done) => (release = done));
    let whole = false;
    t.ctx.deps.isWhole = (path) => whole || !path.endsWith(".cut-plan.json");
    t.ctx.deps.readAll = async () => {
      await held;
      whole = true;
    };
    const reading = on(t.ctx.deps, ...readArgs(1));
    await new Promise((done) => setTimeout(done, 50));
    const no = await on(t.ctx.deps, "teachings", LABEL, "--transcript-only");
    assert.deepEqual([no.code, no.said], [0, [TRANSCRIPT_ONLY]]);
    release();
    const r = await reading;
    assert.equal(r.code, 1);
    assert.deepEqual([calls(t), reread(mac.found).session.teachings], [[], "transcript only"]);
    t.done();
  });
});

describe("fix 10: a session renamed since its last hand-off", () => {
  it("sets the earlier hand-off aside into history/ when it writes the next under the new name", async () => {
    const mac = await decidedSession();
    const { t, found } = mac;
    await on(t.ctx.deps, "finish", LABEL);
    const first = fileOf(found, HANDOFF);
    await on(t.ctx.deps, "name", LABEL, "Pricing deep dive");
    const r = await on(t.ctx.deps, "finish", "Pricing deep dive");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.inFinal(found), ["Pricing deep dive.brimm-ops.json"]);
    const aside = readdirSync(join(found.folder, "history")).filter((name) => name.endsWith(`${LABEL}.brimm-ops.json`));
    assert.equal(aside.length, 1);
    assert.equal(readFileSync(join(found.folder, "history", aside[0]), "utf8"), first);
    const record = reread(found);
    assert.equal(HANDOFF in record.files, false);
    assert.equal(record.files[`history/${aside[0]}`], Buffer.byteLength(first));
    assert.deepEqual([record.finished.revision, record.finished.handoff], [2, "final/Pricing deep dive.brimm-ops.json"]);
    assert.equal(episodeFault(record), "");
    t.done();
  });
});

describe("fix 11: her name by default, files read through, and the branches not tested yet", () => {
  it("takes the host's full name as hers when this Mac's settings name none: a label of her first name and more is a participant", async () => {
    const vtt = ["WEBVTT", "", "1", "00:00:00.000 --> 00:00:04.000", "Sallie's iPhone: Welcome back, everyone, to the group call.", ""].join("\n");
    const { asks, t } = await readSession({ files: { ...FILES, [VTT_FILE]: vtt } });
    const speakers = replaceSpeakers(vtt, HOST).text;
    assert.match(speakers, /Participant 1: Welcome back/);
    assert.deepEqual(asks, [requestFor("session", PLAN, { duration: 26, speakers })]);
    t.done();
  });
  it("reads through the teachings, the plan or the meeting transcript that Dropbox has not brought yet, before principles, ideas, finish and name", async () => {
    const mac = await decidedSession();
    const { t, found } = mac;
    const here = new Set();
    const brought = [];
    t.ctx.deps.isWhole = (path) => here.has(path) || ![TEACHINGS_JSON, `${STEM}.cut-plan.json`].some((rel) => path.endsWith(rel));
    t.ctx.deps.readAll = async (path) => {
      brought.push(path.slice(found.folder.length + 1));
      here.add(path);
    };
    assert.equal((await on(t.ctx.deps, "principles", LABEL)).code, 0);
    assert.deepEqual(brought, [TEACHINGS_JSON]);
    here.clear();
    brought.length = 0;
    assert.equal((await on(t.ctx.deps, "name", LABEL, "Pricing deep dive")).code, 0);
    assert.deepEqual(brought, [`${STEM}.cut-plan.json`]);
    here.clear();
    brought.length = 0;
    const r = await on(t.ctx.deps, "finish", "Pricing deep dive");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(brought.sort(), [`${STEM}.cut-plan.json`, TEACHINGS_JSON].sort());
    t.done();
  });
  it("refuses her decisions and her answer while another Mac has the session, and her decisions while a run is at work on it", async () => {
    const { t, found } = await readSession();
    writeOver(found, { editing: { by: "Sallie's laptop", since: MARKED } });
    const before = snapshot(found);
    const kept = await on(t.ctx.deps, "principles", LABEL, "keep", "1");
    assert.deepEqual([kept.code, kept.said], [1, [`Sallie's laptop has ${LABEL} open, so nothing was decided. Say it again once it is let go there.`]]);
    const only = await on(t.ctx.deps, "teachings", LABEL, "--transcript-only");
    assert.deepEqual([only.code, only.said], [1, [`Sallie's laptop has ${LABEL} open, so her answer was not recorded. Say it again once it is let go there.`]]);
    assert.deepEqual(snapshot(found), before);
    writeOver(found, { editing: { by: "Mac Studio", since: MARKED } });
    t.ctx.deps.alive = (pid) => pid === process.pid;
    const lock = lockOf(t.home, FOLDER);
    for (const [command, words] of [["finish", [1, [`finish is running for ${LABEL} (${SHORT}) already. Say it again when it has finished.`]]], ["read", [0, [`${LABEL}: principle 1 kept.`]]]]) {
      const took = takeEpisodeLock(lock, command, () => true);
      const r = await on(t.ctx.deps, "principles", LABEL, "keep", "1");
      assert.deepEqual([r.code, r.said.slice(0, 1)], [words[0], words[1]], command);
      releaseEpisodeLock(lock, took.text);
    }
    t.done();
  });
  it("says why the claim teachings makes did not hold, in its own words", async () => {
    const cases = [
      ["undone", (mac) => rmSync(recordFile(mac.found.folder, 2)), `Dropbox undid this Mac's claim on ${LABEL}. Say it again.`],
      ["held", (mac) => writeOver(mac.found, { editing: { by: "Sallie's laptop", since: MARKED } }), `Sallie's laptop has ${LABEL} open, so its teachings were not asked for. Say it again once it is let go there.`],
      ["changed", (mac) => writeOver(mac.found, { title: null }), `${LABEL} changed meanwhile: say it again.`]
    ];
    for (const [what, change, words] of cases) {
      const mac = sessionMac();
      const wait = mac.t.ctx.deps.wait;
      mac.t.ctx.deps.wait = async (ms) => {
        await wait(ms);
        if (ms === CLAIM_WAIT_MS) change(mac);
      };
      const r = await on(mac.t.ctx.deps, "teachings", LABEL);
      assert.deepEqual([r.code, r.said], [1, [words]], what);
      assert.deepEqual(mac.t.started, [], what);
      mac.t.done();
    }
  });
});

// --- Fix round 2 ---

/** A session whose transcript says, as a real one does, ordinary words both with a capital mid-sentence and in lowercase, and the
    client's name with a capital alone. */
const SAID_BOTH_WAYS = [
  { id: "p1", start: 0, end: 5, keep: true, text: "So we talked about it, and I post Reels on Instagram every week, and Stories too." },
  { id: "p2", start: 5.5, end: 10, keep: true, text: "We went Live on Friday, and at Christmas we sell more." },
  { id: "p3", start: 10.5, end: 15, keep: true, text: "The Reel format works, my Business coach said so, and we use a Price sheet." },
  { id: "p4", start: 15.5, end: 26, keep: true, text: "So Quillon asked whether to film reels, post stories, go live, or make a reel about the price of your business." }
];
const BOTH_WAYS_FILES = { ...FILES, [`${STEM}.cut-plan.json`]: JSON.stringify({ ...PLAN, phrases: SAID_BOTH_WAYS }, null, 2) + "\n" };

describe("fix round 2, 1: a word the transcript says in lowercase too is ordinary in her words", () => {
  it("takes her ordinary words in lowercase, and refuses the client's name, never said in lowercase, in any case, saying the word", async () => {
    const { t, found } = await readSession({ files: BOTH_WAYS_FILES });
    for (const words of ["film three reels", "a reel about pricing", "post stories", "go live", "price sheet", "your business"]) {
      const named = await on(t.ctx.deps, "name", LABEL, words);
      assert.equal(named.code, 0, `${words}: ${named.text}`);
      writeOver(found, { name: { text: LABEL, placeholder: false } });
      const edited = await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", words);
      assert.equal(edited.code, 0, `${words}: ${edited.text}`);
    }
    for (const [words, word] of [["quillon's reels", "quillon"], ["Quillon pricing", "Quillon"], ["QUILLON live", "QUILLON"]]) {
      assert.deepEqual((await on(t.ctx.deps, "name", LABEL, words)).said, [NAME_HOLDS(word)], words);
      assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", words)).said, [EDIT_HOLDS(word)], words);
    }
    // A word the transcript says with a capital alone counts in any case; one it says both ways only with its capital.
    assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", "a christmas offer")).said, [EDIT_HOLDS("christmas")]);
    assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", "Film Reels")).said, [EDIT_HOLDS("Reels")]);
    t.done();
  });
});

describe("fix round 2, 1 (and from its probe): a plural possessive, and marks no one sees", () => {
  it("are read through: the quillons' shop, and a name with a soft hyphen or a zero-width space in it", async () => {
    const { t } = await readSession();
    for (const [words, word] of [["the quillons' shop", "quillon"], ["the quillons’ shop", "quillon"], ["ask quil\u00adlon", "quillon"], ["ask quil\u200blon", "quillon"]]) {
      assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", words)).said, [EDIT_HOLDS(word)], words);
    }
    t.done();
  });
});

describe("fix round 2, 2: a name of several words, joined", () => {
  it("is refused in her words, letters only and in any case", async () => {
    const { t } = await readSession({ files: { ...FILES, [VTT_FILE]: VTT } });
    for (const [words, word] of [["quillonmarsh", "quillonmarsh"], ["QUILLONMARSH", "QUILLONMARSH"], ["@quillonmarsh", "quillonmarsh"], ["quillonmarsh pricing", "quillonmarsh"], ["ask jorundpell", "jorundpell"], ["Jorund-Pell", "Jorund"]]) {
      assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", words)).said, [EDIT_HOLDS(word)], words);
    }
    assert.deepEqual((await on(t.ctx.deps, "name", LABEL, "quillonmarsh pricing")).said, [NAME_HOLDS("quillonmarsh")]);
    t.done();
  });
});

describe("fix round 2, 3: a spelling of the host's or the show's own name", () => {
  it("makes no name of either side", async () => {
    const reply = { ...REPLY, frameworks: [{ ...REPLY.frameworks[0], description: "As Sally says, charge for what the work changes." }, ...REPLY.frameworks.slice(1)] };
    const { t, found } = await readSession({ reply, over: { spellings: [["Sally", "Sallie"]] } });
    assert.equal(JSON.parse(fileOf(found, TEACHINGS_JSON)).principles[0].description, "As Sally says, charge for what the work changes.");
    assert.equal((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", "As Sally says, sally forth.")).code, 0);
    t.done();
  });
});

describe("fix round 2, 4: a name the session's files cannot be named from", () => {
  it("is refused at name, writing nothing", async () => {
    const mac = sessionMac();
    const before = snapshot(mac.found);
    for (const words of [".pricing notes", " .pricing", "..."]) {
      const r = await on(mac.t.ctx.deps, "name", LABEL, words);
      assert.deepEqual([r.code, r.said], [1, ["That name cannot name the session's files: give it another."]], words);
    }
    assert.deepEqual(snapshot(mac.found), before);
    mac.t.done();
  });
});

describe("fix round 2, 5: a video file named like the session's label", () => {
  it("lets the label itself be its name: the finish writes the hand-off, and name gives the label back", async () => {
    for (const file of ["Session 2026-10-20.mp4", "session_2026_10_20.mov"]) {
      const stem = file.replace(/\.[^.]+$/, "");
      const files = { [file]: "the recording", [`${stem}.cut-plan.json`]: JSON.stringify({ ...PLAN, video: file }, null, 2) + "\n" };
      const mac = await decidedSession({ files, over: { video: { file, bytes: 13, seconds: 26, recorded: "2026-10-20", recordedFrom: "video" } } });
      const r = await on(mac.t.ctx.deps, "finish", LABEL);
      assert.equal(r.code, 0, `${file}: ${r.text}`);
      assert.deepEqual(mac.t.inFinal(mac.found), [`${LABEL}.brimm-ops.json`]);
      await on(mac.t.ctx.deps, "name", LABEL, "Pricing deep dive");
      const back = await on(mac.t.ctx.deps, "name", "Pricing deep dive", LABEL);
      assert.equal(back.code, 0, `${file}: ${back.text}`);
      mac.t.done();
    }
  });
});

describe("fix round 2, 6: her answer of the transcript only, while Claude reads", () => {
  it("is what the reading's result says, and nothing it read is kept", async () => {
    const mac = sessionMac({ over: ASKED_OVER });
    const { t, found } = mac;
    let answered = null;
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, opts) => {
      if (cmd === "CLAUDE" && !args.includes("auth")) answered = await on(t.ctx.deps, "teachings", LABEL, "--transcript-only");
      return run(cmd, args, opts);
    };
    const r = await on(t.ctx.deps, ...readArgs(1));
    assert.deepEqual([answered.code, r.code], [0, 1]);
    const result = readResult(t.home, FOLDER, "read");
    assert.deepEqual([result.made, result.failed, result.next], [[], [`You asked for the transcript only of ${LABEL} while Claude read it, so nothing it read was kept.`], ""]);
    assert.deepEqual([reread(found).session.teachings, reread(found).reading], ["transcript only", undefined]);
    for (const rel of [TEACHINGS_JSON, TEACHINGS_TXT, IDEAS_TXT]) assert.equal(existsSync(join(found.folder, rel)), false, rel);
    t.done();
  });
});

describe("fix round 2, 7: the earlier hand-off set aside, when the record cannot be written", () => {
  it("takes its copy out of history/ again, and leaves the earlier hand-off in final/", async () => {
    const mac = await decidedSession();
    const { t, found } = mac;
    await on(t.ctx.deps, "finish", LABEL);
    const first = fileOf(found, HANDOFF);
    await on(t.ctx.deps, "name", LABEL, "Pricing deep dive");
    // The other Mac writes the next record while the new hand-off is put in.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("Pricing deep dive.brimm-ops.json")) writeOver(found, { title: null });
    };
    const r = await on(t.ctx.deps, "finish", "Pricing deep dive");
    assert.deepEqual([r.code, r.said], [1, ["Nothing was written: this episode changed on the other Mac: open it again."]]);
    assert.deepEqual(t.inFinal(found), [`${LABEL}.brimm-ops.json`]);
    assert.equal(fileOf(found, HANDOFF), first);
    assert.deepEqual(readdirSync(join(found.folder, "history")).filter((name) => name.endsWith(".brimm-ops.json")), []);
    t.done();
  });
});

// --- Fix round 3 ---

describe("fix round 3, 1: a name of several words the transcript alone says, joined", () => {
  it("is refused in her words, letters only and in any case, though no file or speaker holds it", async () => {
    const file = "Zed Thorn.mp4";
    const phrases = [...PHRASES.slice(0, 4), { id: "p5", start: 20.5, end: 26, keep: true, text: "Then my client Quillon Marsh asked about it." }];
    const files = { [file]: "the recording", "Zed Thorn.cut-plan.json": JSON.stringify({ ...PLAN, video: file, phrases }, null, 2) + "\n" };
    const { t } = await readSession({ files, over: { video: { file, bytes: 13, seconds: 26, recorded: "2026-10-20", recordedFrom: "video" } } });
    for (const [words, word] of [["@quillonmarsh", "quillonmarsh"], ["QUILLONMARSH", "QUILLONMARSH"], ["ask quillonmarsh", "quillonmarsh"]]) {
      assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", words)).said, [EDIT_HOLDS(word)], words);
    }
    assert.deepEqual((await on(t.ctx.deps, "name", LABEL, "quillonmarsh notes")).said, [NAME_HOLDS("quillonmarsh")]);
    // Words side by side that are not both names, and ordinary words joined, are taken.
    assert.equal((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", "myclient pricing")).code, 0);
    t.done();
  });
});

describe("fix round 3, 2: pins", () => {
  it("refuses in lowercase a name a file holds, though the transcript also says the word in lowercase", async () => {
    const phrases = [...PHRASES.slice(0, 4), { id: "p5", start: 20.5, end: 26, keep: true, text: "We met the Marsh team, then walked by the marsh." }];
    const { t } = await readSession({ files: { ...FILES, [`${STEM}.cut-plan.json`]: JSON.stringify({ ...PLAN, phrases }, null, 2) + "\n" } });
    assert.deepEqual((await on(t.ctx.deps, "ideas", LABEL, "edit", "1", "--words", "a walk by the marsh")).said, [EDIT_HOLDS("marsh")]);
    t.done();
  });
  it("refuses at finish a name written by hand that cannot name the session's files", async () => {
    const mac = await decidedSession();
    writeOver(mac.found, { name: { text: ".pricing notes", placeholder: false } });
    const before = snapshot(mac.found);
    const r = await on(mac.t.ctx.deps, "finish", SHORT);
    assert.deepEqual([r.code, r.said], [1, ["This session's name cannot name its files: give it another name first. Nothing was written."]]);
    assert.deepEqual([snapshot(mac.found), existsSync(join(mac.found.folder, "final"))], [before, false]);
    mac.t.done();
  });
});

describe("fix round 3, 3: a session's name is 100 characters at most", () => {
  it("is refused longer at name, and at finish when written by hand, writing nothing", async () => {
    const long = "Pricing ".repeat(13).trim();
    assert.equal([...long].length, 103);
    const mac = await decidedSession();
    const before = snapshot(mac.found);
    const r = await on(mac.t.ctx.deps, "name", LABEL, long);
    assert.deepEqual([r.code, r.said], [1, ["That name is longer than 100 characters: give a shorter one."]]);
    assert.deepEqual(snapshot(mac.found), before);
    assert.equal((await on(mac.t.ctx.deps, "name", LABEL, long.slice(0, 100))).code, 0);
    writeOver(mac.found, { name: { text: long, placeholder: false } });
    const done = await on(mac.t.ctx.deps, "finish", SHORT);
    assert.deepEqual([done.code, done.said], [1, ["This session's name is longer than 100 characters: give it a shorter one first. Nothing was written."]]);
    assert.equal(existsSync(join(mac.found.folder, "final")), false);
    mac.t.done();
  });
});

describe("fix round 3, 4: herWordsName needs the names it checks against", () => {
  it("throws when it is not given them whole, rather than passing every word", () => {
    for (const hers of [undefined, null, {}, { strict: [] }, { strict: [], lenient: [] }, { strict: "Quillon", lenient: [], joined: [] }]) {
      assert.throws(() => herWordsName("quillon", hers), /herWordsName/, JSON.stringify(hers));
    }
    assert.equal(herWordsName("quillon", { strict: ["Quillon"], lenient: [], joined: [] }), "quillon");
    assert.equal(herWordsName("pricing", { strict: ["Quillon"], lenient: [], joined: [] }), "");
  });
});
