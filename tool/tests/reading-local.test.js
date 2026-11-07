// Claude's reading of an episode kept on this Mac (Phase 3, the local working folder; L4; design D1, D4). A reading of a local episode starts at once: its
// files are in the episode's video/ folder on this Mac, so the import's late check holds nothing and no look is waited for. What it read goes into video/
// (putHere): the files it replaces are set aside in video/history/, the record is written last, and nothing but the record goes into Dropbox. A raw
// reading renders the rough cut into the episode's work folder as it does for any episode. A session's teachings go the same way.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and Claude, ffprobe, ffmpeg, QuickTime Player and the
// notice are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { layoutOf, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { episodeFilesFolder, episodeWork, pendingFolder, writeSettings } from "../settings.js";
import { readResult } from "../detached.js";
import { readPendings, lateCheckLockOf } from "../filing.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, roughCaptions, keptSpans } from "../cuts.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { READ_LOOK_MS } from "../reading.js";
import { TOLD, PAUSES, SRT } from "./fixtures.js";
import { setup, listAll } from "./episodes.js";
import { rawProbe } from "./phase4.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const AT = "2026-10-20T15:00:00-05:00";
const ID = "e-20261014-3fa9c1";
const FOLDER = "2026-10-14 Pricing talk (Mac Studio)";
const VIDEO = "Pricing talk.mp4";
const NAME = "Pricing talk";
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
const HEARD = pausesOf(PAUSES);
const WORDS = wordsOf(TOLD);
const RULES = cutPlan(phrasesOf(WORDS, HEARD), { duration: 23.423, pauses: HEARD });
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
const PLAN = { version: 1, video: VIDEO, facts: FACTS, phrases: RULES.phrases, ranges: RULES.ranges, kept: RULES.kept, cut: RULES.cut, pauses: HEARD, by: "rules" };
const ROUGH = roughCaptions(RULES.phrases, keptSpans(RULES.ranges, FACTS.fps));
const LIGHT_FILES = {
  [VIDEO]: "the raw video",
  "Pricing talk.cut-plan.json": JSON.stringify(PLAN, null, 2) + "\n",
  "Pricing talk.cut-plan.txt": planText(RULES, "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it."),
  "Pricing talk.words.json": JSON.stringify({ video: VIDEO, duration: 23.423, words: WORDS }, null, 2) + "\n",
  "Pricing talk.srt": SRT,
  "Pricing talk.transcript.txt": "the transcript",
  "Pricing talk.rough-cut.srt": ROUGH,
  "Pricing talk.rough-cut.transcript.txt": "the rough cut's transcript"
};
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
const ACCOUNT = "sallie@example.com (BRIMM)";
const RAW_REPLY = {
  decisions: [{ id: "p6", keep: true, why: "The false start leads into the point." }],
  notes: "Open on the welcome.",
  graphicCues: [{ id: "p7", words: "know your costs", kind: "graphic", show: "A chart of what it costs", seconds: 4 }],
  clips: [{ from: "p4", to: "p5", hook: "What this is about", why: "It says what the talk is about.", point: "Pricing is the subject." }],
  spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }]
};
const NOTICE = `Claude has read ${NAME}: say "what did Claude find?"`;

/** A Mac with the made-up recording filed on it as a Mac with a drop folder of its own files one: its files in video/, its record (kept here) in Episodes. */
function mac({ kind = "raw", over = {}, files = LIGHT_FILES, reply = RAW_REPLY, settings = {} } = {}) {
  const asks = [];
  const notices = [];
  const t = setup({
    programs: {
      FFPROBE: rawProbe,
      CLAUDE: (args, asked) => {
        if (args.includes("auth")) return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
        asks.push(asked.input);
        return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(reply) }) };
      }
    }
  });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  t.ctx.deps.notify = (text) => notices.push(text);
  if (Object.keys(settings).length) writeSettings(t.home, settings);
  const folder = join(t.root, "Episodes", FOLDER);
  const own = episodeFilesFolder(t.home, FOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(own, rel)), { recursive: true });
    writeFileSync(join(own, rel), text);
    sizes[rel] = Buffer.byteLength(text);
  }
  const first = newEpisode({ id: ID, machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: VIDEO, bytes: sizes[VIDEO], seconds: 23.423, created: "2026-10-14T09:00:00-05:00" }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" }, files: sizes, local: { on: "Mac Studio" } });
  const next = { ...first, rev: 1, kind, answer: ANSWERED, label: LABEL, editing: { by: "Mac Studio", since: AT }, ...over };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next) }));
  return { t, found: { folder, name: FOLDER, record: readEpisode(folder).record }, own, asks, notices };
}

const readArgs = (kind, rev = 1) => ["read", "--now", FOLDER, "--kind", kind, "--rev", String(rev)];
const reread = (found) => readEpisode(found.folder).record;
const texts = (dir) => Object.fromEntries(listAll(dir).map((rel) => [rel, readFileSync(join(dir, rel), "utf8")]));

describe("a raw reading of an episode kept on this Mac", () => {
  it("reads at once: no look is waited for, no lock is taken, no mark is made, no pending is written, and no wait is of the late check", async () => {
    const { t, found, notices } = mac();
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.waits.filter((ms) => ms === READ_LOOK_MS || ms === LATE_CHECK_MS), []);
    assert.equal(existsSync(lateCheckLockOf(t.home, FOLDER)), false);
    assert.deepEqual(readPendings(t.home), []);
    assert.equal(existsSync(pendingFolder(t.home)) ? readdirSync(pendingFolder(t.home)).length : 0, 0);
    assert.deepEqual(notices, [NOTICE]);
    assert.equal(reread(found).reading.kind, "raw");
    t.done();
  });
  it("puts what it read into video/, the replaced files into video/history/, writes the record last, and writes nothing else into Dropbox", async () => {
    const { t, found, own } = mac();
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    const plan = JSON.parse(readFileSync(join(own, "Pricing talk.cut-plan.json"), "utf8"));
    assert.equal(plan.by, "rules and Claude");
    assert.match(readFileSync(join(own, "Pricing talk.edit-notes.txt"), "utf8"), /Open on the welcome\./);
    assert.ok(existsSync(join(own, "reels.json")));
    // The import's plan and its cut log are in video/history/: the reading's own set-aside, and what the put replaced.
    const aside = listAll(join(own, "history"));
    assert.ok(aside.some((rel) => rel.endsWith(" Pricing talk.cut-plan.json")), aside.join(", "));
    assert.ok(aside.some((rel) => rel.endsWith(" Pricing talk.cut-plan.txt")), aside.join(", "));
    // The record lists the files it put in, never one in history/, and it is the last thing written: nothing else is in Episodes/<folder>.
    const record = reread(found);
    assert.equal(record.rev, 2);
    for (const rel of ["Pricing talk.cut-plan.json", "Pricing talk.edit-notes.txt", "reels.json"]) assert.equal(record.files[rel], statSync(join(own, rel)).size, rel);
    assert.deepEqual(Object.keys(record.files).filter((rel) => rel.startsWith("history/")), []);
    assert.deepEqual(listAll(found.folder).filter((rel) => !rel.startsWith("record/")), []);
    assert.equal(t.clones[t.clones.length - 1][1], join(found.folder, "record", "0002.json"));
    // The rough cut is rendered into the episode's work folder, in renders/, as for any episode, and listed nowhere.
    assert.ok(existsSync(join(episodeWork(t.home, FOLDER), "renders", `${NAME} – version 0.mp4`)));
    assert.ok(!listAll(own).some((rel) => rel.endsWith(".mp4") && rel !== VIDEO));
    assert.deepEqual(t.opened.map((o) => o[0]), ["QuickTime Player"]);
    assert.equal(readResult(t.home, FOLDER, "read").ok, true);
    t.done();
  });
  it("a refused record write puts the earlier files back, byte for byte, and says to say it again", async () => {
    const { t, found, own } = mac();
    const before = texts(own);
    // The other Mac's record lands while Claude is asked.
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => {
      const out = await run(cmd, args, asked);
      if (cmd === "CLAUDE" && !args.includes("auth")) writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2 }));
      return out;
    };
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual(texts(own), before);
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, false);
    assert.equal(result.next, "Nothing was changed. Tell me what it is again, and Claude reads it again.");
    t.done();
  });
});

describe("the AGAIN line", () => {
  it("is said in her words when nothing could be put in: Tell me what it is again, and Claude reads it again", async () => {
    const { t } = mac({ reply: "not json at all" });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.equal(readResult(t.home, FOLDER, "read").next, "Nothing was changed. Tell me what it is again, and Claude reads it again.");
    t.done();
  });
});

describe("a reading stopped between its renames and its record", () => {
  it("is undone by the next put: video/ holds the files the record lists, at its sizes", async () => {
    const { t, found, own } = mac();
    // A put that stopped: its journal names the renames, the new plan is in place, the record is not written.
    const planAt = join(own, "Pricing talk.cut-plan.json");
    const before = readFileSync(planAt, "utf8");
    mkdirSync(join(own, "history"), { recursive: true });
    writeFileSync(join(own, "history", "2026-10-20T15-00-00-05-00 Pricing talk.cut-plan.json"), before);
    writeFileSync(planAt, JSON.stringify({ ...PLAN, by: "a stopped put" }, null, 2) + "\n");
    writeFileSync(join(own, ".Pricing talk.cut-plan.json.1.put"), "left half-written");
    writeFileSync(join(own, ".put.json"), JSON.stringify({ rev: 1, entries: [{ rel: "Pricing talk.cut-plan.json", tmp: ".Pricing talk.cut-plan.json.1.put", was: "history/2026-10-20T15-00-00-05-00 Pricing talk.cut-plan.json" }] }));
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, JSON.stringify(readResult(t.home, FOLDER, "read")));
    assert.equal(existsSync(join(own, ".put.json")), false);
    const record = reread(found);
    for (const [rel, bytes] of Object.entries(record.files)) assert.equal(statSync(join(own, rel)).size, bytes, rel);
    t.done();
  });
});

describe("ask, Claude asked again for Reels, of an episode kept on this Mac", () => {
  it("puts the new list into video/, writes the record last, and writes nothing else into Dropbox", async () => {
    const { t, found, own } = mac({ kind: "finished", over: { name: { text: NAME, placeholder: false } } });
    t.ctx.deps.tools = { ...t.ctx.deps.tools, swift: "SWIFT" };
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => (cmd === "SWIFT" ? { code: 0, stderr: "", stdout: "[]" } : run(cmd, args, asked));
    t.ctx.deps.runGuarded = async (cmd, args) => ({ ...(await t.ctx.deps.run(cmd, args)), overMemory: false, outOfTime: false, peak: 0, stopped: "" });
    assert.equal(await editMain(["ask", "--now", FOLDER], t.ctx.deps), 0, JSON.stringify(readResult(t.home, FOLDER, "ask")));
    assert.ok(existsSync(join(own, "reels.json")));
    assert.deepEqual(listAll(found.folder).filter((rel) => !rel.startsWith("record/")), []);
    const record = reread(found);
    assert.equal(record.rev, 2);
    assert.equal(record.files["reels.json"], statSync(join(own, "reels.json")).size);
    assert.ok(record.reels.length > 0);
    assert.deepEqual(t.waits.filter((ms) => ms === LATE_CHECK_MS), []);
    assert.deepEqual(readPendings(t.home), []);
    t.done();
  });
});

// --- A local session ---

const SID = "e-20261020-77ab12";
const SFOLDER = "2026-10-20 Quillon Marsh (Mac Studio)";
const SVIDEO = "Quillon Marsh.mp4";
const STEM = "Quillon Marsh";
const LABEL_S = "Session, 2026-10-20";
const SPHRASES = [
  { id: "p1", start: 0, end: 4, keep: true, text: "Welcome back, everyone, to the group call." },
  { id: "p2", start: 4.5, end: 9, keep: true, text: "So the first thing is pricing." },
  { id: "p3", start: 9.5, end: 15, keep: true, text: "Your price is a message." }
];
const SPLAN = { version: 1, video: SVIDEO, facts: { duration: 26, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 }, phrases: SPHRASES, ranges: [{ start: 0, end: 26, keep: true }], kept: 26, cut: 0, pauses: [], by: "rules" };
const SFILES = {
  [SVIDEO]: "the recording",
  [`${STEM}.cut-plan.json`]: JSON.stringify(SPLAN, null, 2) + "\n",
  [`${STEM}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\nWelcome back, everyone, to the group call.\n\n",
  [`${STEM}.transcript.txt`]: "[0:00] Welcome back, everyone, to the group call.\n"
};
const SREPLY = {
  frameworks: [{ name: "Price the outcome", category: "pricing", description: "Charge for what the work changes.", steps: ["Name the result."], red_flags: [], green_flags: [], decision_criteria: [], example_application: "A baker prices a cake by the celebration.", verbatim_key_phrases: [], source_context: "Early on." }],
  recurring_principles: ["Price is a message."],
  reel_ideas: [{ idea: "Why price is a message", words: "Your price is a message.", why: "It stands alone.", refilm: false, principle: 1 }]
};
const TAUGHT = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } };
const MARKED = "2026-10-20T14:00:00-05:00";
const ASKED = "2026-10-20T14:30:00-05:00";

function sessionMac() {
  const asks = [];
  const t = setup({
    programs: {
      CLAUDE: (args, asked) => {
        if (args.includes("auth")) return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
        asks.push(asked.input);
        return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(t.reply) }) };
      }
    }
  });
  t.reply = SREPLY;
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.notify = () => {};
  writeSettings(t.home, { sessionTeachings: TAUGHT });
  const folder = join(t.root, "Episodes", SFOLDER);
  const own = episodeFilesFolder(t.home, SFOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [rel, text] of Object.entries(SFILES)) {
    mkdirSync(dirname(join(own, rel)), { recursive: true });
    writeFileSync(join(own, rel), text);
    sizes[rel] = Buffer.byteLength(text);
  }
  const first = newEpisode({ id: SID, machine: "Mac Studio", at: "2026-10-20T10:00:00-05:00", video: { file: SVIDEO, bytes: sizes[SVIDEO], seconds: 26, created: null }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" }, files: sizes, local: { on: "Mac Studio" } });
  const answer = { state: "answered", guess: null, seen: "wide, 0:26", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: MARKED, private: "yes" };
  const next = {
    ...first, rev: 1, kind: "session", answer, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: LABEL_S, placeholder: false },
    session: { marked: MARKED, on: "Mac Studio", teachings: "asked", asked: ASKED, cleared: null }, editing: { by: "Mac Studio", since: ASKED }
  };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next), video: { ...first.video, recorded: "2026-10-20", recordedFrom: "video" } }));
  return { t, found: { folder, name: SFOLDER, record: readEpisode(folder).record }, own, asks };
}
const sreadArgs = (rev) => ["read", "--now", SFOLDER, "--kind", "session", "--rev", String(rev)];

describe("a session of this Mac, read for its teachings", () => {
  it("writes nothing under Episodes/<folder> but its record, and does not wait", async () => {
    const { t, found, own } = sessionMac();
    const r = await on(t.ctx.deps, ...sreadArgs(1));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(listAll(found.folder).filter((rel) => !rel.startsWith("record/")), []);
    assert.deepEqual(t.waits.filter((ms) => ms === LATE_CHECK_MS || ms === READ_LOOK_MS), []);
    assert.deepEqual(readPendings(t.home), []);
    assert.ok(existsSync(join(own, `${LABEL_S}.principles.json`)));
    assert.equal(reread(found).reading.principles, `${LABEL_S}.principles.json`);
    t.done();
  });
  it("read twice leaves nothing in Episodes/<folder>/history/, and its earlier teachings are in video/history/, not in its record", async () => {
    const { t, found, own } = sessionMac();
    assert.equal((await on(t.ctx.deps, ...sreadArgs(1))).code, 0);
    const first = readFileSync(join(own, `${LABEL_S}.principles.json`), "utf8");
    const record = reread(found);
    // She asked for them again.
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, session: { ...record.session, asked: "2026-10-20T15:00:30-05:00" } }));
    await t.ctx.deps.wait(2000);
    t.reply = { ...SREPLY, recurring_principles: ["Decide once."] };
    const r = await on(t.ctx.deps, ...sreadArgs(record.rev + 1));
    assert.equal(r.code, 0, r.text);
    assert.equal(existsSync(join(found.folder, "history")), false);
    const aside = listAll(join(own, "history"));
    const old = aside.find((rel) => rel.endsWith(`${LABEL_S}.principles.json`));
    assert.ok(old, aside.join(", "));
    assert.equal(readFileSync(join(own, "history", old), "utf8"), first);
    const now = reread(found);
    assert.deepEqual(Object.keys(now.files).filter((rel) => rel.startsWith("history/")), []);
    assert.doesNotMatch(JSON.stringify(now), /Price is a message\.\"/);
    assert.deepEqual(listAll(found.folder).filter((rel) => !rel.startsWith("record/")), []);
    t.done();
  });
});
