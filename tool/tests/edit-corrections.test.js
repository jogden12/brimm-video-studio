// Correcting a wrong answer (spec 2026-10-22, section 2, "Correcting a wrong answer", and section 1, "Episodes imported before
// this design"): `kind "<video>" <other> --again` sets the earlier reading's files aside into history/ by the rule, and every file
// in final/ with them, and the reading runs again with the new prompt; a raw video starts again from the rules' plan the first
// reading kept in history/. Answered again as a session, the video gets at once an empty session revision of its hand-off, which
// the BRIMM Ops page takes to redact what it had. `ask`, for a video she has answered, is `kind <its kind> --again`. Nothing here
// runs a real program or touches Dropbox: each test has a root and a home of its own, and Claude, ffprobe, ffmpeg, osascript,
// open and QuickTime Player are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { localStamp, readEpisode, recordFile, recordText } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, roughCaptions, keptSpans } from "../cuts.js";
import { stampedText } from "../lib.js";
import { requestFor } from "../readings.js";
import { handoffTarget } from "../finish.js";
import { TOLD, PAUSES, SRT } from "./fixtures.js";
import { setup, episodeFor, episodeAs, reread, listAll, FOLDER, ID } from "./episodes.js";
import { rawProbe } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

// --- The made-up recording, imported lightly, answered and read ---

const AT = "2026-10-20T15:00:00-05:00";
const VIDEO = "Pricing talk.mp4";
const NAME = "Pricing talk";
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
/** The session label the made-up video gets when it is marked one: it was recorded on 2026-10-14. */
const SESSION_NAME = "Session, 2026-10-14";
const HEARD = pausesOf(PAUSES);
const WORDS = wordsOf(TOLD);
const RULES = cutPlan(phrasesOf(WORDS, HEARD), { duration: 23.423, pauses: HEARD });
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
/** The plan as the light import writes it: the rules' alone, with the pauses ffmpeg heard, and its cut log. */
const PLAN = { version: 1, video: VIDEO, facts: FACTS, phrases: RULES.phrases, ranges: RULES.ranges, kept: RULES.kept, cut: RULES.cut, pauses: HEARD, by: "rules" };
const PLAN_TEXT = JSON.stringify(PLAN, null, 2) + "\n";
const LOG_TEXT = planText(RULES, "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it.");
const ROUGH = roughCaptions(RULES.phrases, keptSpans(RULES.ranges, FACTS.fps));
/** The files a light import puts in the episode's folder. */
const LIGHT_FILES = {
  [VIDEO]: "the raw video",
  "Pricing talk.cut-plan.json": PLAN_TEXT,
  "Pricing talk.cut-plan.txt": LOG_TEXT,
  "Pricing talk.words.json": JSON.stringify({ video: VIDEO, duration: 23.423, words: WORDS }, null, 2) + "\n",
  "Pricing talk.srt": SRT,
  "Pricing talk.transcript.txt": "the transcript",
  "Pricing talk.rough-cut.srt": ROUGH,
  "Pricing talk.rough-cut.transcript.txt": stampedText(ROUGH)
};
/** Her answer, as `kind` writes it, with this Mac's claim kept on the record for the reading. */
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const answered = (kind, over = {}) => ({ version: 3, kind, answer: ANSWERED, label: LABEL, editing: { by: "Mac Studio", since: AT }, ...over });
const MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };

const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
/** Claude Code as a stand-in: `claude auth status` says the account, and a call prints `reply` as its result. Each request it is
    given goes into `asks`. */
const claudeOf = (reply, asks) => (args, asked) => {
  if (args.includes("auth")) return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
  asks.push(asked.input);
  return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(reply) }) };
};
/** Four suggestions of a finished video, each whole, and an offer of a spelling. */
const FINISHED_REPLY = {
  suggestions: [
    { from: "p4", to: "p9", first: "Welcome to the show", last: "so much, Sallie", why: "It is the whole talk in brief.", point: "Know what it costs you." },
    { from: "p7", to: "p8", first: "So the first thing", last: "very, very important", why: "It makes one point.", point: "Costs come first." },
    { from: "p4", to: "p5", first: "Welcome to the show", last: "talk about pricing", why: "It says what the talk is about.", point: "Pricing is the subject." },
    { from: "p8", to: "p9", first: "very, very important", last: "so much, Sallie", why: "It closes the talk.", point: "Thanks." }
  ],
  spellings: [{ heard: "Ogdin", spelled: "Ogden", why: "It is her surname." }]
};
const RAW_REPLY = {
  decisions: [{ id: "p6", keep: true, why: "The false start leads into the point." }],
  notes: "Open on the welcome.",
  graphics: [{ id: "p7", idea: "A chart of what it costs" }],
  clips: [{ from: "p4", to: "p5", hook: "What this is about", why: "It says what the talk is about.", point: "Pricing is the subject." }],
  spellings: [{ heard: "Ogdin", spelled: "Ogden", why: "It is her surname." }]
};
const CLIP_REPLY = { spellings: [{ heard: "Ogdin", spelled: "Ogden", why: "It is her surname." }], about: "A clip about knowing your costs." };
const REPLIES = { finished: FINISHED_REPLY, raw: RAW_REPLY, "short video": CLIP_REPLY };

/** This Mac's settings say which version of the hand-off to write. */
function handoffVersion(t, version) {
  writeSettings(t.home, { handoffVersion: version });
  t.ctx.settings = { ...t.ctx.settings, handoffVersion: version };
}

/** A Mac with the made-up recording imported lightly, answered as `kind` and read by the real `read`, Claude a stand-in: the
    reading's files are in the episode. `version` is this Mac's hand-off version (none when null). */
async function readOf(kind, { version = null, over = {}, reply = REPLIES[kind], files = LIGHT_FILES } = {}) {
  const asks = [];
  const t = setup({ programs: { FFPROBE: rawProbe, CLAUDE: claudeOf(reply, asks) } });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  t.ctx.deps.notify = () => {};
  if (version) handoffVersion(t, version);
  const found = episodeFor(t, { record: answered(kind, over), files });
  const r = await on(t.ctx.deps, "read", "--now", FOLDER, "--kind", kind, "--rev", String(found.record.rev));
  assert.equal(r.code, 0, r.text);
  return { t, found, asks };
}

/** Run the reading `kind` started, as its detached run would: the last `read` it started. */
async function readStarted(t) {
  const reads = t.started.map(([, args]) => args.slice(1)).filter((args) => args[0] === "read");
  const r = await on(t.ctx.deps, ...reads[reads.length - 1]);
  assert.equal(r.code, 0, r.text);
  return r;
}

/** Every file in the episode's history/, by its name with the moment it was set aside taken off, and what it holds. */
const historyOf = (found) => listAll(join(found.folder, "history")).map((rel) => [rel.replace(/^\S+ /, ""), readFileSync(join(found.folder, "history", rel), "utf8")]);
/** The names alone, sorted. */
const historyNames = (found) => historyOf(found).map(([name]) => name).sort();
/** Every file in the episode's folder, with what it holds, but its records. */
const snapshot = (found) => Object.fromEntries(listAll(found.folder).filter((rel) => !rel.startsWith("record/")).map((rel) => [rel, readFileSync(join(found.folder, rel), "utf8")]));
/** What final/ holds. */
const finalOf = (found) => listAll(join(found.folder, "final"));
/** The `read` runs started, by their words. */
const readsStarted = (t) => t.started.map(([, args]) => args.slice(1)).filter((args) => args[0] === "read");
/** The calls of open -R, which show a file in Finder. */
const shownInFinder = (t) => t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args);
const STRETCH = /^\S+ /;

// The words a person reads.
const GONE = "Its words have already gone to Claude: drop the new revision on the BRIMM Ops page and tell Jason.";
const OUT = "Its files are out of the shared folder.";
const WAITS_FOR = (id) => `The empty session revision of ${SESSION_NAME} waits for its earlier version (${id}), which is not on this Mac yet: tell Jason. ${OUT}`;
const LOOPS = `The empty session revision of ${SESSION_NAME} waits: its versions name each other: tell Jason. ${OUT}`;
const V1 = `The empty session revision of ${SESSION_NAME} is written once this Mac hands off version 2: ask Jason. ${OUT}`;
const WRITTEN = (n) => `The empty session revision of ${SESSION_NAME} is written as revision ${n} and shown in Finder. ${GONE}`;
const MARK_STAYS = 'This was marked a client or group session. Clearing the mark needs your click on this Mac: say "clear the session mark".';

/** The made-up video answered and read as finished, and handed off as version 2 by her answer to the spellings card. */
async function handedOffFinished() {
  const { t, found, asks } = await readOf("finished", { version: 2 });
  const r = await on(t.ctx.deps, "spell", NAME, "offers", "none");
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(finalOf(found), ["Pricing talk.brimm-ops.json", "Pricing talk.srt", "Pricing talk.transcript.txt"]);
  assert.equal(reread(found).finished.revision, 1);
  return { t, found, asks };
}

describe("kind … --again: the earlier reading set aside", () => {
  it("sets a finished reading's files aside into history/ whole, by the rule, lists them there, and starts the new reading", async () => {
    const { t, found } = await readOf("finished");
    const before = snapshot(found);
    assert.ok(before["reels.json"] && before["Pricing talk.reel-suggestions.txt"]);
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    assert.deepEqual(historyNames(found), ["Pricing talk.reel-suggestions.txt", "reels.json"]);
    for (const [name, text] of historyOf(found)) assert.equal(text, before[name], name);
    for (const rel of listAll(join(found.folder, "history"))) {
      // Cloned in, by the rule, and listed by the record at its size.
      assert.ok(t.clones.some(([, to]) => to === join(found.folder, "history", rel)), rel);
      assert.equal(record.files[`history/${rel}`], Buffer.byteLength(readFileSync(join(found.folder, "history", rel))), rel);
    }
    for (const rel of ["reels.json", "Pricing talk.reel-suggestions.txt"]) {
      assert.ok(!existsSync(join(found.folder, rel)), rel);
      assert.ok(!(rel in record.files), rel);
    }
    // The import's own files stay as they were.
    for (const [rel, text] of Object.entries(LIGHT_FILES)) assert.equal(readFileSync(join(found.folder, rel), "utf8"), text, rel);
    // The reading is let go, so the new one may run, and its suggestions with it; the new reading is started.
    assert.deepEqual([record.kind, record.reading, record.finished, record.reels], ["raw", null, null, []]);
    assert.deepEqual(readsStarted(t), [["read", "--now", FOLDER, "--kind", "raw", "--rev", String(record.rev)]]);
    t.done();
  });
  it("sets a raw reading's own files aside, puts back the rules' plan and cut log the first reading kept, and leaves the rough cut on this Mac", async () => {
    const { t, found } = await readOf("raw");
    const before = snapshot(found);
    const render = join(episodeWork(t.home, FOLDER), "renders", `${NAME} – version 0.mp4`);
    assert.ok(existsSync(render));
    assert.notEqual(before["Pricing talk.cut-plan.json"], PLAN_TEXT);
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    // The rules' plan and cut log are back, as the import wrote them, and listed at their sizes.
    assert.equal(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"), PLAN_TEXT);
    assert.equal(readFileSync(join(found.folder, "Pricing talk.cut-plan.txt"), "utf8"), LOG_TEXT);
    assert.equal(record.files["Pricing talk.cut-plan.json"], Buffer.byteLength(PLAN_TEXT));
    assert.equal(record.files["Pricing talk.cut-plan.txt"], Buffer.byteLength(LOG_TEXT));
    // Set aside: what Claude made of the plan, its cut log, its notes, the rough cut's captions and transcript as it made them, the
    // timeline version 0 was rendered from, and its suggestions. The rules' plan and log the first reading kept stay there, once.
    assert.deepEqual(historyNames(found), [
      "Pricing talk.cut-plan.json", "Pricing talk.cut-plan.json", "Pricing talk.cut-plan.txt", "Pricing talk.cut-plan.txt", "Pricing talk.edit-notes.txt",
      "Pricing talk.reel-suggestions.txt", "Pricing talk.rough-cut.srt", "Pricing talk.rough-cut.transcript.txt", "main.v0.fcpxml", "reels.json"
    ]);
    const kept = Object.fromEntries(historyOf(found).filter(([name]) => !name.startsWith("Pricing talk.cut-plan")));
    for (const [name, text] of Object.entries(kept)) assert.equal(text, before[name === "main.v0.fcpxml" ? "edit/main.v0.fcpxml" : name], name);
    assert.deepEqual(historyOf(found).filter(([name]) => name === "Pricing talk.cut-plan.json").map(([, text]) => text).sort(), [before["Pricing talk.cut-plan.json"], PLAN_TEXT].sort());
    for (const rel of ["edit/main.v0.fcpxml", "Pricing talk.edit-notes.txt", "Pricing talk.rough-cut.srt", "Pricing talk.rough-cut.transcript.txt", "reels.json"]) {
      assert.ok(!existsSync(join(found.folder, rel)), rel);
      assert.ok(!(rel in record.files), rel);
    }
    // Version 0's entry goes with its timeline; the rough cut itself, on this Mac's own disk, stays where it is.
    assert.deepEqual(record.main.pushed, []);
    assert.ok(existsSync(render));
    assert.deepEqual([record.kind, record.reading], ["finished", null]);
    t.done();
  });
  it("reads a raw video answered raw again from the rules' plan, and keeps that plan in history/ once", async () => {
    const { t, found, asks } = await readOf("raw");
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    await readStarted(t);
    // Claude is asked of the rules' plan both times: never of what it made of it the first time.
    assert.deepEqual(asks, [requestFor("raw", PLAN, { video: VIDEO, duration: 23.423 }), requestFor("raw", PLAN, { video: VIDEO, duration: 23.423 })]);
    assert.equal(historyOf(found).filter(([name, text]) => name === "Pricing talk.cut-plan.json" && text === PLAN_TEXT).length, 1);
    assert.equal(historyOf(found).filter(([name, text]) => name === "Pricing talk.cut-plan.txt" && text === LOG_TEXT).length, 1);
    assert.equal(reread(found).reading.kind, "raw");
    t.done();
  });
  it("sets nothing aside twice: answered again before the new reading, it finds nothing more to set aside", async () => {
    const { t, found } = await readOf("raw");
    assert.equal((await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again")).code, 0);
    const once = historyOf(found);
    const rev = reread(found).rev;
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(historyOf(found), once);
    assert.equal(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"), PLAN_TEXT);
    assert.deepEqual([reread(found).rev, reread(found).kind], [rev + 1, "raw"]);
    t.done();
  });
  it("numbers a finished video's new reading on from its hand-off: suggestions 1 to 4 handed off, the new one is 5", async () => {
    const { t, found } = await handedOffFinished();
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", "Pricing talk.brimm-ops.json"), "utf8"));
    assert.deepEqual(handoff.suggestions.map((s) => s.n), [1, 2, 3, 4]);
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    await readStarted(t);
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.equal(reels.candidates[0].n, 5);
    assert.deepEqual(reels.candidates.map((c) => c.n), [5, 6, 7, 8]);
    t.done();
  });
  it("sets every file of final/ aside with its hand-off and lets go the record's finish, so that a spelling does not remake the old hand-off", async () => {
    const { t, found } = await handedOffFinished();
    const before = snapshot(found);
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`${NAME}'s hand-off is set aside in history/: the next one written is its next revision.`), r.text);
    assert.deepEqual(finalOf(found), []);
    const record = reread(found);
    assert.equal(record.finished, null);
    for (const rel of ["final/Pricing talk.brimm-ops.json", "final/Pricing talk.srt", "final/Pricing talk.transcript.txt"]) assert.ok(!(rel in record.files), rel);
    const aside = Object.fromEntries(historyOf(found));
    for (const rel of ["final/Pricing talk.brimm-ops.json", "final/Pricing talk.srt", "final/Pricing talk.transcript.txt"]) assert.equal(aside[rel.slice("final/".length)], before[rel], rel);
    // Before the new reading is in, a spelling is kept and nothing is handed off again.
    const spelled = await on(t.ctx.deps, "spell", NAME, "add", "Ogdin", "Ogden");
    assert.equal(spelled.code, 0, spelled.text);
    assert.deepEqual([finalOf(found), reread(found).finished, shownInFinder(t).length], [[], null, 1]);
    t.done();
  });
  it("sets aside a session's teachings files, as a reading's other files, when a video whose mark she cleared is answered again", async () => {
    const t = setup();
    const teachings = { [`${SESSION_NAME}.principles.json`]: "{\"format\":\"brimm-video teachings\"}\n", [`${SESSION_NAME}.principles.txt`]: "Principles\n", [`${SESSION_NAME}.reel-ideas.txt`]: "Reel ideas\n" };
    const cleared = { ...MARK, teachings: "asked", asked: AT, cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } };
    const found = episodeFor(t, {
      record: answered("finished", { session: cleared, name: { text: SESSION_NAME, placeholder: false }, reading: { kind: "session", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read", principles: `${SESSION_NAME}.principles.json` } }),
      files: { ...LIGHT_FILES, ...teachings }
    });
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(historyNames(found), Object.keys(teachings).sort());
    for (const [name, text] of historyOf(found)) assert.equal(text, teachings[name], name);
    for (const rel of Object.keys(teachings)) assert.ok(!existsSync(join(found.folder, rel)), rel);
    assert.deepEqual([reread(found).reading, reread(found).kind], [null, "raw"]);
    t.done();
  });
  it("sets aside only the text files of a reading of a video imported before this design: never its rough cut, upright version or Reels' clips", async () => {
    const t = setup();
    const old = {
      [VIDEO]: "the raw video",
      "Pricing talk.cut-plan.json": JSON.stringify({ ...PLAN, by: "rules and Claude", claude: { decisions: [], graphics: [], ignored: [], clips: [] } }),
      "Pricing talk.cut-plan.txt": "the cut log",
      "Pricing talk.edit-notes.txt": "Claude's notes",
      "Pricing talk.rough-cut.mp4": "the rough cut",
      "Pricing talk.rough-cut.vertical.mp4": "the upright version",
      "Pricing talk.rough-cut.srt": ROUGH,
      "Pricing talk.rough-cut.transcript.txt": stampedText(ROUGH),
      "Pricing talk.reel-1.mp4": "clip one",
      "previews/reel-2.mp4": "a preview",
      "edit/main.v0.fcpxml": "<fcpxml/>",
      "reels.json": JSON.stringify({ format: "brimm-video reels", version: 1, video: VIDEO, by: "import", made: AT, highest: 2, candidates: [] }) + "\n"
    };
    const found = episodeFor(t, { record: { name: { text: NAME, placeholder: false } }, files: old });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(historyNames(found), ["Pricing talk.edit-notes.txt", "reels.json"]);
    for (const rel of Object.keys(old).filter((rel) => !["Pricing talk.edit-notes.txt", "reels.json"].includes(rel))) assert.equal(readFileSync(join(found.folder, rel), "utf8"), old[rel], rel);
    t.done();
  });
  it("reads through a file to set aside that is not whole on this Mac, and refuses, writing nothing, when it is still not", async () => {
    const { t, found } = await readOf("finished");
    const before = snapshot(found);
    const rev = reread(found).rev;
    const asked = [];
    const r = await on({ ...t.ctx.deps, isWhole: (path) => !path.endsWith("reels.json"), readAll: async (path) => asked.push(path) }, "kind", NAME, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [`Dropbox is still bringing ${NAME}'s earlier files over to this Mac: say your answer again in a minute. Nothing was changed.`]]);
    assert.deepEqual(asked, [join(found.folder, "reels.json")]);
    assert.deepEqual([snapshot(found), reread(found).rev, t.started], [before, rev, []]);
    t.done();
  });
  it("takes its copies back out of history/ and puts the plan back when the record cannot be written", async () => {
    const { t, found } = await readOf("raw");
    const before = snapshot(found);
    const record = reread(found);
    // The other Mac writes the next record while this Mac is setting the files aside.
    const clone = t.ctx.deps.clone;
    let written = false;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (!written && to.includes(`${join(found.folder, "history")}/`)) {
        written = true;
        writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
      }
    };
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, ["Nothing was changed: this episode changed on the other Mac: open it again."]]);
    const after = snapshot(found);
    for (const [rel, text] of Object.entries(before)) assert.equal(after[rel], text, rel);
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
    assert.deepEqual(readsStarted(t), []);
    t.done();
  });
});

describe("kind … --again --clear-session: the session's teachings and hand-off set aside", () => {
  const OSASCRIPT = "/usr/bin/osascript";
  const CLEAR_IT = { code: 0, stdout: "button returned:Clear it\n", stderr: "" };
  it("sets aside its teachings files and every file of final/, lets go its reading and its finish, and starts the new kind's reading", async () => {
    const t = setup();
    const teachings = { [`${SESSION_NAME}.principles.json`]: "{\"format\":\"brimm-video teachings\"}\n", [`${SESSION_NAME}.principles.txt`]: "Principles\n", [`${SESSION_NAME}.reel-ideas.txt`]: "Reel ideas\n" };
    const handoff = { [`final/${SESSION_NAME}.brimm-ops.json`]: "{\"version\":2}\n" };
    const session = {
      version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: LABEL, name: { text: SESSION_NAME, placeholder: false },
      session: { ...MARK, teachings: "asked", asked: AT },
      reading: { kind: "session", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read", principles: `${SESSION_NAME}.principles.json` },
      finished: { revision: 1, at: AT, on: "Mac Studio", handoff: `final/${SESSION_NAME}.brimm-ops.json`, parts: {} }
    };
    const found = episodeFor(t, { record: session, files: { ...LIGHT_FILES, ...teachings, ...handoff } });
    const run = t.ctx.deps.run;
    const deps = { ...t.ctx.deps, run: async (cmd, args, opts) => (cmd === OSASCRIPT ? CLEAR_IT : run(cmd, args, opts)) };
    const r = await on(deps, "kind", SESSION_NAME, "finished", "--private", "no", "--again", "--clear-session");
    assert.equal(r.code, 0, r.text);
    const all = { ...teachings, [`${SESSION_NAME}.brimm-ops.json`]: handoff[`final/${SESSION_NAME}.brimm-ops.json`] };
    assert.deepEqual(historyNames(found), Object.keys(all).sort());
    for (const [name, text] of historyOf(found)) assert.equal(text, all[name], name);
    assert.deepEqual(finalOf(found), []);
    const record = reread(found);
    assert.deepEqual([record.kind, record.reading, record.finished, record.session.cleared.confirmed], ["finished", null, null, "dialog"]);
    for (const rel of [...Object.keys(teachings), ...Object.keys(handoff)]) assert.ok(!(rel in record.files), rel);
    assert.deepEqual(readsStarted(t), [["read", "--now", FOLDER, "--kind", "finished", "--rev", String(record.rev)]]);
    assert.doesNotMatch(r.text, /Pricing/);
    t.done();
  });
});

describe("kind … session --again: the empty session revision", () => {
  it("sets aside every file of final/, writes at once an empty session revision, the next, shows it in Finder, and says its words have gone to Claude", async () => {
    const { t, found } = await handedOffFinished();
    const before = snapshot(found);
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(WRITTEN(2)), r.text);
    assert.doesNotMatch(r.text, /Pricing/);
    const rel = `final/${SESSION_NAME}.brimm-ops.json`;
    assert.deepEqual(finalOf(found), [`${SESSION_NAME}.brimm-ops.json`]);
    const handoff = JSON.parse(readFileSync(join(found.folder, rel), "utf8"));
    const record = reread(found);
    assert.deepEqual(handoff, {
      format: "brimm-video hand-off", version: 2, revision: 2, made: handoff.made, madeOn: "Mac Studio", madeBy: "brimm-video c709b57",
      video: { id: ID, kind: "session", name: SESSION_NAME, recorded: "2026-10-14", recordedFrom: "video" },
      reels: [], session: { principles: [], recurringPrinciples: [], reelsToFilm: [] }
    });
    // Its keys are the contract's, as the page knows a session that replaces what it had.
    const replacing = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-session-replacing.json", import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(handoff), Object.keys(replacing));
    assert.deepEqual(record.finished, { revision: 2, at: handoff.made, on: "Mac Studio", handoff: rel, parts: {} });
    assert.equal(record.files[rel], Buffer.byteLength(readFileSync(join(found.folder, rel))));
    assert.deepEqual([record.kind, record.name.text, record.reading, record.session.emptyRevision, record.editing], ["session", SESSION_NAME, null, 2, null]);
    // Every file final/ held before is in history/, whole, and so are the reading's files.
    const aside = Object.fromEntries(historyOf(found));
    for (const name of ["Pricing talk.brimm-ops.json", "Pricing talk.srt", "Pricing talk.transcript.txt"]) assert.equal(aside[name], before[`final/${name}`], name);
    assert.ok("reels.json" in aside && "Pricing talk.reel-suggestions.txt" in aside);
    assert.deepEqual(shownInFinder(t).slice(-1), [["-R", join(found.folder, rel)]]);
    assert.deepEqual(readsStarted(t), []);
    t.done();
  });
  it("gives the empty revision the first version's id, above every revision written for it in the chain, history/ included", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const OLD = "e-20261010-a0a0a0";
    const older = episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false }, finished: { revision: 1, at: AT, on: "Mac Studio" } } });
    const lay = (folder, rel, text) => {
      mkdirSync(dirname(join(folder, rel)), { recursive: true });
      writeFileSync(join(folder, rel), text);
    };
    lay(older.folder, "final/Older talk.brimm-ops.json", JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: OLD } }));
    lay(older.folder, "history/2026-10-12 Older talk.brimm-ops.json", JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 3, video: { id: OLD } }));
    const found = episodeFor(t, {
      record: answered("finished", { versionOf: OLD, editing: null, finished: { revision: 2, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }),
      files: { ...LIGHT_FILES, "final/Pricing talk.brimm-ops.json": JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 2, video: { id: OLD } }) }
    });
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", `${SESSION_NAME}.brimm-ops.json`), "utf8"));
    assert.deepEqual([handoff.video.id, handoff.revision], [OLD, 4]);
    assert.ok(r.said.includes(WRITTEN(4)), r.text);
    assert.equal(reread(found).versionOf, OLD);
    t.done();
  });
  it("with its earlier version's folder not on this Mac: sets final/ aside and marks it, writes no hand-off and says so; once it is here, the same answer writes it", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const OLD = "e-20261001-aaaaaa";
    const found = episodeFor(t, {
      record: answered("finished", { versionOf: OLD, editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }),
      files: { ...LIGHT_FILES, "final/Pricing talk.brimm-ops.json": JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: OLD } }) }
    });
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(WAITS_FOR(OLD)), r.text);
    assert.deepEqual([finalOf(found), historyNames(found)], [[], ["Pricing talk.brimm-ops.json"]]);
    let record = reread(found);
    assert.deepEqual([record.kind, record.session.marked !== undefined, record.session.emptyRevision, record.finished, record.versionOf], ["session", true, "owed", null, OLD]);
    assert.deepEqual(shownInFinder(t), []);
    // Still not here: said again, and nothing is written.
    const still = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([still.code, still.said], [1, [WAITS_FOR(OLD)]]);
    assert.equal(reread(found).rev, record.rev);
    // The earlier version comes over: the same answer writes the empty revision, above every revision of the id, and sets nothing
    // more aside.
    episodeAs(t, { id: OLD, name: "2026-10-01 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const once = historyOf(found);
    const now = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.equal(now.code, 0, now.text);
    assert.deepEqual(now.said, [WRITTEN(2)]);
    assert.deepEqual(historyOf(found), once);
    record = reread(found);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", `${SESSION_NAME}.brimm-ops.json`), "utf8"));
    assert.deepEqual([handoff.video.id, handoff.revision, record.session.emptyRevision, record.finished.revision], [OLD, 2, 2, 2]);
    assert.equal(shownInFinder(t).length, 1);
    // Written, it is a session already.
    const again = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([again.code, again.said], [1, [`${SESSION_NAME} is a client or group session already.`]]);
    t.done();
  });
  it("writes no hand-off, and says so, when its versions name each other", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const OLD = "e-20261010-a0a0a0";
    episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false }, versionOf: ID } });
    const found = episodeFor(t, {
      record: answered("finished", { versionOf: OLD, editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }),
      files: { ...LIGHT_FILES, "final/Pricing talk.brimm-ops.json": JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: OLD } }) }
    });
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(LOOPS), r.text);
    assert.deepEqual([finalOf(found), reread(found).session.emptyRevision], [[], "owed"]);
    t.done();
  });
  it("writes no hand-off, and says so, when the video went to the page under an id its versions no longer lead to", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const MOVED = "e-20261001-bbbbbb";
    const found = episodeFor(t, {
      record: answered("finished", { editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }),
      files: { ...LIGHT_FILES, "final/Pricing talk.brimm-ops.json": JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: MOVED } }) }
    });
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`The empty session revision of ${SESSION_NAME} is not written: ${SESSION_NAME} went to the BRIMM Ops page under ${MOVED}, but its versions now lead to ${ID}: ask Jason. ${OUT}`), r.text);
    assert.deepEqual([finalOf(found), reread(found).session.emptyRevision], [[], "owed"]);
    t.done();
  });
  it("on a Mac that hands off version 1, writes no hand-off and says it waits for version 2", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [`${SESSION_NAME}: marked a client or group session. Ask her whether she wants its teachings (principles and Reel ideas) or the transcript only.`, V1]);
    assert.deepEqual([finalOf(found), reread(found).session.emptyRevision, shownInFinder(t)], [[], "owed", []]);
    t.done();
  });
  it("is a session answered for the first time with nothing to set aside and no revision owed: as before", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "", came: "camera", match: null }, label: LABEL }, files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [`${SESSION_NAME}: marked a client or group session. Ask her whether she wants its teachings (principles and Reel ideas) or the transcript only.`]);
    assert.deepEqual([reread(found).session, existsSync(join(found.folder, "history"))], [{ marked: localStamp(new Date(t.now())), on: "Mac Studio", teachings: null, cleared: null }, false]);
    t.done();
  });
});

describe("kind … --again and the video a record is a version of (amendment b, as changed)", () => {
  const OLD = "e-20261010-a0a0a0";
  const OLD_NAME = "Older talk";
  /** The earlier version, answered as finished, in a folder of its own. */
  const older = (t, over = {}) => episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: OLD_NAME, placeholder: false }, ...over } });
  it("keeps the versionOf of a video never handed off when --again names none", async () => {
    const t = setup();
    older(t);
    const found = episodeFor(t, { record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).versionOf, OLD);
    t.done();
  });
  it("keeps it on the clearing path too: a session that was a version of A, cleared to finished, stays a version of A", async () => {
    const t = setup();
    older(t);
    const found = episodeFor(t, { record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: LABEL, name: { text: SESSION_NAME, placeholder: false }, session: MARK, versionOf: OLD }, files: LIGHT_FILES });
    const run = t.ctx.deps.run;
    const deps = { ...t.ctx.deps, run: async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? { code: 0, stdout: "button returned:Clear it\n", stderr: "" } : run(cmd, args, opts)) };
    const r = await on(deps, "kind", SESSION_NAME, "finished", "--private", "no", "--again", "--clear-session");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).versionOf], ["finished", OLD]);
    t.done();
  });
  it("clears it with --version-of none for a video never handed off", async () => {
    const t = setup();
    older(t);
    const found = episodeFor(t, { record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again", "--version-of", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).versionOf, null);
    t.done();
  });
  it("refuses --version-of none for a video handed off, in the words of where it has gone, and writes nothing", async () => {
    const t = setup();
    older(t);
    const found = episodeFor(t, { record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false }, finished: { revision: 1, at: AT, on: "Mac Studio" } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again", "--version-of", "none");
    assert.deepEqual([r.code, r.said], [1, [`${NAME} has already gone to the BRIMM Ops page as a version of ${OLD_NAME}: ask Jason.`]]);
    assert.deepEqual([reread(found).rev, reread(found).versionOf, t.started], [1, OLD, []]);
    t.done();
  });
  it("checks the kept link again: a session among the versions of A refuses an answer that is not a session", async () => {
    const t = setup();
    older(t);
    episodeAs(t, { id: "e-20261011-c0c0c0", name: "2026-10-11 A call (Mac Studio)", record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-11", placeholder: false }, label: "Video of 11 Oct, 09:12 (Mac Studio)", versionOf: OLD } });
    const found = episodeFor(t, { record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [`${NAME} would be a version of a client or group session: answer it as a session, or ask Jason. Nothing was written.`]]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("checks the kept link again: versions that name each other refuse it", async () => {
    const t = setup();
    older(t, { versionOf: ID });
    const found = episodeFor(t, { record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [`${NAME} and the video it names as its earlier version (${OLD}) each say they are a version of the other: ask Jason. Nothing was written.`]]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("checks the kept link again: a video that went to the page under another id than its versions lead to now is refused", async () => {
    const t = setup();
    older(t);
    const MOVED = "e-20261001-bbbbbb";
    const found = episodeFor(t, {
      record: answered("raw", { versionOf: OLD, name: { text: NAME, placeholder: false }, finished: { revision: 1, at: AT, on: "Mac Studio" } }),
      files: { ...LIGHT_FILES, "final/Pricing talk.brimm-ops.json": JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: MOVED } }) }
    });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [`${NAME} went to the BRIMM Ops page under ${MOVED}, but its versions now lead to ${OLD}: ask Jason. Nothing was written.`]]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
});

describe("a non-session hand-off waits for the dialog: the record on disk is judged", () => {
  it("refuses, while the record on disk keeps the session mark, a hand-off for the record as it would be written cleared; and goes through once it is written so", () => {
    const t = setup();
    handoffVersion(t, 2);
    const marked = { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, name: { text: SESSION_NAME, placeholder: false }, session: MARK };
    const found = episodeFor(t, { record: marked, files: LIGHT_FILES });
    const cleared = { ...found.record, session: { ...MARK, cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } } };
    const refused = handoffTarget(t.ctx, { folder: found.folder, record: cleared });
    assert.equal(refused.refusal, `${SESSION_NAME} is a version of a client or group session: ask Jason. Nothing was written.`);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...cleared, rev: 2 }));
    assert.deepEqual(handoffTarget(t.ctx, { folder: found.folder, record: readEpisode(found.folder).record }).refusal, "");
    t.done();
  });
  it("keeps the mark of a video answered as another kind without --clear-session: refused, nothing written", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, name: { text: SESSION_NAME, placeholder: false }, session: MARK }, files: LIGHT_FILES });
    // Gated as a session is, it is named by its label.
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [MARK_STAYS]]);
    assert.deepEqual([reread(found).rev, t.started], [1, []]);
    t.done();
  });
});

describe("ask, for a video she has answered", () => {
  it("is kind with its own kind and --again: the earlier reading set aside, and the reading of that kind started", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "ask", NAME);
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    assert.deepEqual(historyNames(found), ["Pricing talk.reel-suggestions.txt", "reels.json"]);
    // Answered again, by her own answer as it was: the same kind, and not private.
    assert.deepEqual([record.kind, record.reading, record.answer.state, record.answer.private], ["finished", null, "answered", "no"]);
    assert.deepEqual(readsStarted(t), [["read", "--now", FOLDER, "--kind", "finished", "--rev", String(record.rev)]]);
    assert.ok(!t.started.some(([, args]) => args[1] === "ask"), JSON.stringify(t.started));
    t.done();
  });
  it("reads an iPhone clip again as a clip", async () => {
    const { t, found } = await readOf("short video");
    const r = await on(t.ctx.deps, "ask", NAME);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(readsStarted(t), [["read", "--now", FOLDER, "--kind", "short video", "--rev", String(reread(found).rev)]]);
    t.done();
  });
  it("keeps the video it is a version of", async () => {
    const { t, found } = await readOf("finished", { over: { versionOf: "e-20261010-a0a0a0" } });
    episodeAs(t, { id: "e-20261010-a0a0a0", name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const r = await on(t.ctx.deps, "ask", NAME);
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).versionOf, "e-20261010-a0a0a0");
    t.done();
  });
  it("asks Claude again for Reels, as it always did, for a video from before this design", async () => {
    const t = setup();
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
    const found = episodeFor(t, { record: { name: { text: NAME, placeholder: false } } });
    const r = await on(t.ctx.deps, "ask", NAME);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["ask", "--now", FOLDER]]);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
});

// --- Fix round 1 (F9b's reviews) ---

/** A hand-off's JSON, of version 2 under `id`, or of version 1 under the episode's id `id`. */
const H2 = (id, revision, extra = {}) => JSON.stringify({ format: "brimm-video hand-off", version: 2, revision, video: { id }, ...extra });
const H1 = (id, revision) => JSON.stringify({ format: "brimm-video hand-off", version: 1, revision, episode: { id } });
/** The made-up video answered as finished and handed off (record.finished naming final/'s hand-off), with `files` in its folder
    besides the import's, its record with `over` laid on it. */
const handedOffWith = (t, files, over = {}) => episodeFor(t, {
  record: answered("finished", { editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} }, ...over }),
  files: { ...LIGHT_FILES, ...files }
});
const COMING = `Dropbox is still bringing ${NAME}'s earlier files over to this Mac: say your answer again in a minute. Nothing was changed.`;
const SESSION_COMING = `Dropbox is still bringing ${SESSION_NAME}'s earlier files over to this Mac: say your answer again in a minute. Nothing was changed.`;

describe("fix round 1: files the record lists that are not on this Mac yet", () => {
  it("1. refuses, writing nothing, while a final/ file the record lists is not here; once Dropbox brings it, sets it aside and lists it no more", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(ID, 1), "final/Pricing talk.transcript.txt": "THE SESSION'S WORDS" });
    rmSync(join(found.folder, "final", "Pricing talk.transcript.txt"));
    const refused = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([refused.code, refused.said], [1, [COMING]]);
    assert.deepEqual([reread(found).rev, existsSync(join(found.folder, "history")), finalOf(found)], [1, false, ["Pricing talk.brimm-ops.json"]]);
    writeFileSync(join(found.folder, "final", "Pricing talk.transcript.txt"), "THE SESSION'S WORDS");
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(finalOf(found), [`${SESSION_NAME}.brimm-ops.json`]);
    assert.deepEqual(Object.keys(reread(found).files).filter((k) => k.startsWith("final/")), [`final/${SESSION_NAME}.brimm-ops.json`]);
    assert.equal(Object.fromEntries(historyOf(found))["Pricing talk.transcript.txt"], "THE SESSION'S WORDS");
    t.done();
  });
  it("1. refuses so too for the hand-off record.finished names, and for a listed file of the reading, that are not here", async () => {
    for (const [gone, files] of [["final/Pricing talk.brimm-ops.json", {}], ["reels.json", { "reels.json": "{}\n" }], [`${SESSION_NAME}.principles.txt`, { [`${SESSION_NAME}.principles.txt`]: "Principles\n" }]]) {
      const t = setup();
      const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H1(ID, 1), ...files });
      rmSync(join(found.folder, gone));
      const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
      assert.deepEqual([r.code, r.said, reread(found).rev, t.started], [1, [COMING], 1, []], gone);
      t.done();
    }
  });
  it("1. sweeps final/ through what it sets aside when an owed revision is written: a file that came over since goes into history/", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const OLD = "e-20261001-aaaaaa";
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(OLD, 1) }, { versionOf: OLD });
    assert.equal((await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again")).code, 0);
    assert.deepEqual(finalOf(found), []);
    // The other Mac's transcript, which Dropbox brings over only now, and is no file the record lists.
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, "final", "Pricing talk.transcript.txt"), "LATE WORDS");
    episodeAs(t, { id: OLD, name: "2026-10-01 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([r.code, r.said], [0, [WRITTEN(2)]]);
    assert.deepEqual(finalOf(found), [`${SESSION_NAME}.brimm-ops.json`]);
    assert.ok(historyOf(found).some(([name, text]) => name === "Pricing talk.transcript.txt" && text === "LATE WORDS"));
    t.done();
  });
  it("1. sweeps such a file out of final/ even while the owed revision still waits, and says it waits", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const OLD = "e-20261001-aaaaaa";
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(OLD, 1) }, { versionOf: OLD });
    assert.equal((await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again")).code, 0);
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, "final", "Pricing talk.transcript.txt"), "LATE WORDS");
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([r.code, r.said], [1, [WAITS_FOR(OLD)]]);
    assert.deepEqual([finalOf(found), reread(found).session.emptyRevision], [[], "owed"]);
    assert.ok(historyOf(found).some(([name, text]) => name === "Pricing talk.transcript.txt" && text === "LATE WORDS"));
    t.done();
  });
});

describe("fix round 1: a final video stays where it is", () => {
  it("2. sets aside final/'s hand-off and text files only: its videos and its export bundle stay, listed, neither cloned nor read through", async () => {
    const t = setup();
    const kept = { "final/Pricing talk.mp4": "THE FINAL VIDEO", "final/Pricing talk.story-1.mp4": "A STORY PART", "final/Pricing talk.fcpxmld/Info.fcpxml": "<fcpxml/>" };
    const texts = { "final/Pricing talk.brimm-ops.json": H1(ID, 1), "final/Pricing talk.srt": "captions", "final/Pricing talk.transcript.txt": "words", "final/Pricing talk.words.json": "{}" };
    const found = handedOffWith(t, { ...kept, ...texts });
    const asked = [];
    const deps = { ...t.ctx.deps, isWhole: (path) => !path.endsWith(".mp4") || !path.includes("/final/"), readAll: async (path) => asked.push(path) };
    const r = await on(deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(historyNames(found), ["Pricing talk.brimm-ops.json", "Pricing talk.srt", "Pricing talk.transcript.txt", "Pricing talk.words.json"]);
    assert.deepEqual(finalOf(found), ["Pricing talk.fcpxmld/Info.fcpxml", "Pricing talk.mp4", "Pricing talk.story-1.mp4"]);
    const record = reread(found);
    for (const rel of Object.keys(kept)) assert.ok(rel in record.files, rel);
    for (const rel of Object.keys(texts)) assert.ok(!(rel in record.files), rel);
    assert.deepEqual(asked, []);
    assert.ok(!t.clones.some(([from]) => from.endsWith(".mp4")), JSON.stringify(t.clones));
    t.done();
  });
});

describe("fix round 1: the empty revision goes only where every hand-off of the video went", () => {
  const OLD = "e-20261010-a0a0a0";
  const older = (t) => episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
  const TOO = (id) => `The empty session revision of ${SESSION_NAME} is not written: ${SESSION_NAME} went to the BRIMM Ops page under ${id} too: ask Jason. ${OUT}`;
  it("3. writes none, and marks it owed, when a hand-off of its own went under another id than its first version's", async () => {
    const t = setup();
    handoffVersion(t, 2);
    older(t);
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H1(ID, 1), "final/Pricing talk.transcript.txt": "secret" }, { versionOf: OLD });
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(TOO(ID)), r.text);
    assert.deepEqual([finalOf(found), reread(found).session.emptyRevision, shownInFinder(t)], [[], "owed", []]);
    assert.doesNotMatch(r.text, /Pricing|Older/);
    // Said again, the same: it waits for Jason.
    const again = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([again.code, again.said], [1, [TOO(ID)]]);
    t.done();
  });
  it("5. writes an owed revision on a Mac whose setting is version 1 when a hand-off of it in history/ is version 2", async () => {
    const t = setup();
    const MISSING = "e-20261001-aaaaaa";
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(MISSING, 1) }, { versionOf: MISSING });
    const first = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.ok(first.said.includes(WAITS_FOR(MISSING)), first.text);
    episodeAs(t, { id: MISSING, name: "2026-10-01 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([r.code, r.said], [0, [WRITTEN(2)]]);
    const handoff = JSON.parse(readFileSync(join(found.folder, "final", `${SESSION_NAME}.brimm-ops.json`), "utf8"));
    assert.deepEqual([handoff.version, handoff.video.id, handoff.revision], [2, MISSING, 2]);
    t.done();
  });
  it("9. refuses --version-of, or none, on a session that owes its revision, and writes nothing", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const MISSING = "e-20261001-aaaaaa";
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(MISSING, 1) }, { versionOf: MISSING });
    older(t);
    assert.equal((await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again")).code, 0);
    const rev = reread(found).rev;
    for (const named of [OLD, "none"]) {
      const r = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again", "--version-of", named);
      assert.deepEqual([r.code, r.said], [1, [`The empty session revision of ${SESSION_NAME} is still owed: say it again without --version-of.`]], named);
      assert.deepEqual([reread(found).rev, reread(found).versionOf], [rev, MISSING], named);
    }
    t.done();
  });
});

describe("fix round 1: --version-of none, and the kept link", () => {
  it("4. lets --version-of none through for a video handed off that is a version of none: nothing changes", async () => {
    const t = setup();
    const found = episodeFor(t, { record: answered("raw", { versionOf: null, name: { text: NAME, placeholder: false }, finished: { revision: 1, at: AT, on: "Mac Studio" } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again", "--version-of", "none");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).versionOf], ["finished", null]);
    t.done();
  });
  it("10. keeps the link of a video handed off, corrected to another kind that is not a session, its set checked and found clear", async () => {
    const t = setup();
    const OLD = "e-20261010-a0a0a0";
    episodeAs(t, { id: OLD, name: "2026-10-10 Older talk (Mac Studio)", record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: "Older talk", placeholder: false } } });
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(OLD, 1) }, { versionOf: OLD });
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).versionOf, reread(found).finished], ["raw", OLD, null]);
    t.done();
  });
  it("10. numbers a corrected reading on from the earlier reading's suggestions, with no hand-off at all", async () => {
    const { t, found } = await readOf("finished");
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).candidates.map((c) => c.n), [1, 2, 3, 4]);
    assert.equal((await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again")).code, 0);
    await readStarted(t);
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).candidates.map((c) => c.n), [5, 6, 7, 8]);
    t.done();
  });
});

describe("fix round 1: what stays, and what is said of a session's files", () => {
  it("6. names what could not be taken out of final/, by what it is, and does not say its files are out of the shared folder", async () => {
    const t = setup();
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H1(ID, 1), "final/Pricing talk.transcript.txt": "secret" });
    chmodSync(join(found.folder, "final"), 0o555);
    let r;
    try {
      r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    } finally {
      chmodSync(join(found.folder, "final"), 0o755);
    }
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.includes(`${SESSION_NAME}: a hand-off and a transcript stayed in final/: they could not be taken out. Tell Jason.`), r.text);
    assert.ok(!r.text.includes(OUT), r.text);
    assert.doesNotMatch(r.text, /Pricing/);
    t.done();
  });
  it("6. sets aside, answered as a session, every file of final/, listed or not, videos and exports too, but for a session's own hand-off", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(ID, 1), "final/Pricing talk.mp4": "THE FINAL VIDEO", "final/Pricing talk.fcpxmld/Info.fcpxml": "<fcpxml/>" });
    writeFileSync(join(found.folder, "final", "Pricing talk.notes.txt"), "unlisted words");
    writeFileSync(join(found.folder, "final", "Old session.brimm-ops.json"), H2(ID, 1, { video: { id: ID, kind: "session" } }));
    const r = await on(t.ctx.deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(finalOf(found), ["Old session.brimm-ops.json", `${SESSION_NAME}.brimm-ops.json`]);
    assert.deepEqual(historyNames(found).filter((n) => !["reels.json", "Pricing talk.reel-suggestions.txt"].includes(n)), ["Info.fcpxml", "Pricing talk.brimm-ops.json", "Pricing talk.mp4", "Pricing talk.notes.txt"]);
    t.done();
  });
  it("7. says a fixed sentence, naming no file and no folder, when a session's files cannot be set aside", async () => {
    const t = setup();
    handoffVersion(t, 2);
    const found = handedOffWith(t, { "final/Pricing talk.brimm-ops.json": H2(ID, 1), "final/Pricing talk.transcript.txt": "secret" });
    const deps = { ...t.ctx.deps, sameDisk: (from, folder) => !String(folder).endsWith("history") };
    const r = await on(deps, "kind", NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([r.code, r.said], [1, ["Nothing was changed: its earlier files could not be set aside in history/ (an error)."]]);
    assert.deepEqual([reread(found).kind, finalOf(found)], ["finished", ["Pricing talk.brimm-ops.json", "Pricing talk.transcript.txt"]]);
    t.done();
  });
});

describe("fix round 1: ask refuses before it sets anything aside", () => {
  it("8. refuses on a Mac whose readings are off, and on one without Claude Code, in ask's words, and sets nothing aside", async () => {
    for (const [over, why] of [[{ readings: false }, "Readings are off on this Mac: ask Jason."], [null, "Claude Code is not installed on this Mac, so Claude cannot be asked."]]) {
      const { t, found } = await readOf("finished");
      if (over) {
        writeSettings(t.home, over);
        t.ctx.settings = { ...t.ctx.settings, ...over };
      } else t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "" };
      const rev = reread(found).rev;
      const r = await on(t.ctx.deps, "ask", NAME);
      assert.deepEqual([r.code, r.said], [1, [why]], why);
      assert.deepEqual([reread(found).rev, existsSync(join(found.folder, "reels.json")), existsSync(join(found.folder, "history")), t.started], [rev, true, false, []], why);
      t.done();
    }
  });
});
