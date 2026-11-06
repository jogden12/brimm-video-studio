// Claude's reading of a video, once Sallie has said what it is (spec 2026-10-22, section 2, "What the answer does" and "The one
// Claude call", and section 3): `kind` starts it detached as `read --now <folder> --kind <kind> --rev <rev>`, and the run asks
// Claude once with that kind's request, then writes what it read by the rule. A finished video gets Reel suggestions and
// spellings; a raw one gets cut decisions, notes, graphic ideas, Reel suggestions and spellings, and its rough cut rendered as
// version 0; an iPhone clip gets spellings, a line on what it is and up to three graphic cues, all kept in its record (its cut plan
// is left as the import wrote it). A session is read only for its teachings (F7's own tests).
// Then reels.json at version 2, whose candidates have no crops yet, and the readers that need crops, which refuse one.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and Claude, ffprobe, ffmpeg,
// QuickTime Player and the notice are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { editMain, pickReels } from "../edit.js";
import { episodeFault, isFromPlan, localStamp, newPlannedEpisode, recordFile, recordText } from "../episode.js";
import { episodeWork, pendingFolder, writeSettings } from "../settings.js";
import { readResult, resultFile } from "../detached.js";
import { finishLate, lateCheckLockOf, readPendings, takeLateCheckLock, writePending } from "../filing.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, roughCaptions, keptSpans, roughCutArgs, streamsOf } from "../cuts.js";
import { applyDecisions } from "../notes.js";
import { graphicCuesAsk } from "../graphic-cues.js";
import { requestFor } from "../readings.js";
import { stretchesOf } from "../reframe.js";
import { CLAUDE_MODEL, AGAIN_MS } from "../unedited.js";
import { readReels, reelsFile, previewSteps, REELS_VERSION } from "../reels.js";
import { READ_LOOK_MS, READ_HOLD_MS } from "../reading.js";
import { LATE_CHECK_MS, lateCheck } from "../dropbox.js";
import { removeStatus, writeStatus } from "../importing.js";
import { READ_POLL_MS } from "../edit.js";
import { sessionLabel } from "../kinds.js";
import { TOLD, PAUSES, SRT, probed } from "./fixtures.js";
import { setup, episodeFor, episodeAs, reread, listAll, FOLDER, ID } from "./episodes.js";
import { rawProbe } from "./phase4.js";
import { OWN_COMMIT, WITHOUT_COMMIT } from "./own-checkout.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

// --- The made-up recording, imported lightly and answered ---

const AT = "2026-10-20T15:00:00-05:00";
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
const VIDEO = "Pricing talk.mp4";
const NAME = "Pricing talk";
const HEARD = pausesOf(PAUSES);
const WORDS = wordsOf(TOLD);
const RULES = cutPlan(phrasesOf(WORDS, HEARD), { duration: 23.423, pauses: HEARD });
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
/** The plan as the light import writes it: the rules' alone, with the pauses ffmpeg heard. */
const PLAN = { version: 1, video: VIDEO, facts: FACTS, phrases: RULES.phrases, ranges: RULES.ranges, kept: RULES.kept, cut: RULES.cut, pauses: HEARD, by: "rules" };
const ROUGH = roughCaptions(RULES.phrases, keptSpans(RULES.ranges, FACTS.fps));
/** The files a light import puts in the episode's folder. */
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
/** Her answer, as `kind` writes it, with this Mac's claim kept on the record for the reading. */
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const answered = (kind, over = {}) => ({ version: 3, kind, answer: ANSWERED, label: LABEL, editing: { by: "Mac Studio", since: AT }, ...over });

/** What `claude auth status` prints on this Mac, and the account the record keeps of it. */
const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
const ACCOUNT = "sallie@example.com (BRIMM)";

/** Claude Code as a stand-in: `claude auth status` says the account, and a call prints `reply` as its result. Each request it is
    given goes into `asks`. `ended` stands for a call that does not work. */
const claudeOf = (reply, asks, ended = null) => (args, asked) => {
  if (args.includes("auth")) return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
  asks.push(asked.input);
  if (ended) return ended;
  return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: typeof reply === "string" ? reply : JSON.stringify(reply) }) };
};

const FINISHED_REPLY = {
  suggestions: [
    { from: "p4", to: "p9", first: "Welcome to the show", last: "so much, Sallie", why: "It is the whole talk in brief.", point: "Know what it costs you." },
    { from: "p7", to: "p8", first: "So the first thing", last: "very, very important", why: "It makes one point.", point: "Costs come first." },
    { from: "p9", to: "p2", first: "", last: "", why: "It runs backwards.", point: "" }
  ],
  spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }, { heard: "Ogden", spelled: "Ogden", why: "Already right." }]
};
const RAW_REPLY = {
  decisions: [{ id: "p6", keep: true, why: "The false start leads into the point." }],
  notes: "Open on the welcome.",
  graphicCues: [{ id: "p7", words: "know your costs", kind: "graphic", show: "A chart of what it costs", seconds: 4 }],
  clips: [{ from: "p4", to: "p5", hook: "What this is about", why: "It says what the talk is about.", point: "Pricing is the subject." }],
  spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }]
};
/** The graphic cues of that reply as the cut plan keeps them: numbered, each with the phrase it was written for. */
const RAW_CUES = [{ n: 1, words: "know your costs", kind: "graphic", show: "A chart of what it costs", seconds: 4, style: null, phrase: "p7" }];
const CLIP_REPLY = {
  spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }],
  about: "A clip about knowing your costs.",
  graphicCues: [{ id: "p7", words: "know your costs", kind: "graphic", show: "A chart of what it costs", seconds: 4 }]
};
const REPLIES = { finished: FINISHED_REPLY, raw: RAW_REPLY, "short video": CLIP_REPLY };

/** A Mac with the made-up recording imported lightly and answered as `kind`, its record with `over` laid on it, and Claude
    Code, ffprobe, ffmpeg, QuickTime Player and the notice as stand-ins. `reply` is what Claude replies. */
function reading(kind, { over = {}, reply = REPLIES[kind], ended = null, files = LIGHT_FILES } = {}) {
  const asks = [];
  const notices = [];
  const t = setup({ programs: { FFPROBE: rawProbe, CLAUDE: claudeOf(reply, asks, ended) } });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  t.ctx.deps.notify = (text) => notices.push(text);
  const found = episodeFor(t, { record: answered(kind, over), files });
  return { t, found, asks, notices };
}

/** The detached run `kind` starts, as it starts it. */
const readArgs = (kind, rev = 1) => ["read", "--now", FOLDER, "--kind", kind, "--rev", String(rev)];

/** Every file in the episode's folder, with its bytes. */
const snapshot = (found) => Object.fromEntries(listAll(found.folder).map((rel) => [rel, readFileSync(join(found.folder, rel), "utf8")]));

/** Have the stand-in wait do `then` on every wait of `ms` milliseconds, before it has moved the clock. */
const onWaits = (t, ms, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (asked) => {
    if (asked === ms) await then();
    await wait(asked);
  };
};

/** The calls of Claude Code that asked Claude something (not `auth status`). */
const calls = (t) => t.calls.filter((c) => c.cmd === "CLAUDE" && !c.args.includes("auth"));

/** The renders folder of the made-up episode on this Mac, and the rough cut's file there. */
const renderOf = (t) => join(episodeWork(t.home, FOLDER), "renders", `${NAME} – version 0.mp4`);

// The words a person reads.
const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
const SESSION_LATER = "A session is read only for its teachings, which come in a later step.";
const NOTICE = `Claude has read ${NAME}: say "what did Claude find?"`;
/** What every command that would need a Reel a reading suggested says of it on a Mac that is not set up for HyperFrames: Reels are made
    in HyperFrames, so brimm-video cannot make it on this Mac, and she is to ask Jason. `them` is "Reels", "Reel 3" or "Reels 3 and 4".
    Never "make it first": nothing here makes one. OpusClip is no longer used (Jason, 2 November 2026). */
const ELSEWHERE = (them) => `brimm-video cannot make ${them} on this Mac: Reels are made in HyperFrames, and this Mac isn't set up for HyperFrames yet. Ask Jason.`;
const NOT_MADE = (n) => ELSEWHERE(`Reel ${n}`);

/** A crop-less stretch as a reading writes it, from `start` to `end` in seconds of the video, on the video's picture grid. */
const stretchOf = (start, end) => stretchesOf(keptSpans([{ start, end, keep: true }], FACTS.fps));

describe("read: a detached command only", () => {
  it("prints the help and ends 2 without --now, and is not in the help", async () => {
    const { t } = reading("finished");
    const r = await on(t.ctx.deps, "read", FOLDER, "--kind", "finished", "--rev", "1");
    assert.equal(r.code, 2);
    assert.match(r.said[0], /^The command line for episodes on this Mac\./);
    assert.doesNotMatch(r.text, /node edit\.js read/);
    assert.deepEqual([calls(t), reread({ folder: join(t.root, "Episodes", FOLDER) }).rev], [[], 1]);
    t.done();
  });
  it("prints the help and ends 2 when its kind or rev is missing or is not what it takes", async () => {
    const { t } = reading("finished");
    for (const argv of [["--now", FOLDER], ["--now", FOLDER, "--kind", "finished"], ["--now", FOLDER, "--rev", "1"], ["--now", FOLDER, "--kind", "podcast", "--rev", "1"], ["--now", FOLDER, "--kind", "finished", "--rev", "x"]]) {
      const r = await on(t.ctx.deps, "read", ...argv);
      assert.equal(r.code, 2, argv.join(" "));
    }
    assert.deepEqual(calls(t), []);
    t.done();
  });
});

describe("read, a finished video", () => {
  it("asks Claude once with the finished request, and writes the suggestions, reels.json at version 2 and the offers, and no plan", async () => {
    const { t, found, asks, notices } = reading("finished");
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 0, r.text);
    // One request, the finished one, of the plan as the import wrote it and the video's file and length.
    assert.deepEqual(asks, [requestFor("finished", PLAN, { video: VIDEO, duration: 23.423 })]);
    assert.deepEqual(calls(t)[0].args.slice(0, 3), ["-p", "--model", CLAUDE_MODEL]);
    const record = reread(found);
    assert.equal(record.rev, 2);
    // Read at the moment Claude replied: nothing was waited for before it.
    assert.deepEqual(record.reading, { kind: "finished", model: CLAUDE_MODEL, at: localStamp(new Date(Date.parse(AT))), on: "Mac Studio", account: ACCOUNT, outcome: "read" });
    // The spellings are offers, for her to answer: none is applied to the episode yet.
    assert.deepEqual(record.offers.spellings, FINISHED_REPLY.spellings);
    assert.deepEqual(record.spellings, []);
    // Two suggestions are whole; the third runs backwards and is left out. Each keeps the whole video: its stretch is its phrases'
    // own times, from the first's start to the last's end, on the video's clock.
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.equal(reels.version, 2);
    assert.equal(reels.by, "read");
    assert.equal(reels.highest, 2);
    assert.deepEqual(reels.candidates.map((c) => [c.n, c.ranges, c.title, c.reason, c.point, c.first, c.last, c.preview]), [
      [1, stretchOf(6.07, 21.097), "", "It is the whole talk in brief.", "Know what it costs you.", "Welcome to the show", "so much, Sallie", null],
      [2, stretchOf(13.583, 19.022), "", "It makes one point.", "Costs come first.", "So the first thing", "very, very important", null]
    ]);
    assert.ok(reels.candidates.every((c) => c.ranges.every((range) => !("crop" in range))));
    assert.deepEqual(record.reels.map((reel) => [reel.n, reel.status, reel.title, reel.files]), [[1, "candidate", "", []], [2, "candidate", "", []]]);
    assert.ok(existsSync(join(found.folder, "Pricing talk.reel-suggestions.txt")));
    assert.equal(record.files["reels.json"], statSync(join(found.folder, "reels.json")).size);
    // No plan of its own: the import's files are as it left them, and nothing is rendered or made into a timeline.
    const after = snapshot(found);
    for (const [rel, text] of Object.entries(before)) if (!rel.startsWith("record/")) assert.equal(after[rel], text, rel);
    assert.ok(!existsSync(join(found.folder, "edit")));
    assert.ok(!existsSync(renderOf(t)));
    assert.deepEqual(t.calls.filter((c) => c.cmd === "FFMPEG"), []);
    assert.deepEqual(t.opened, []);
    // Put in by the rule, with its late check, and the notice once it is in.
    assert.ok(t.clones.some(([, to]) => to === join(found.folder, "reels.json")));
    assert.ok(t.waits.includes(LATE_CHECK_MS));
    assert.deepEqual(notices, [NOTICE]);
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, true, result.failed.join(" | "));
    assert.match(result.next, /what did Claude find\?/);
    t.done();
  });
  it("starts at once, whatever late check of the import is still to come: it only adds files", async () => {
    const { t, found, asks } = reading("finished");
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 60000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 0, r.text);
    assert.equal(asks.length, 1);
    assert.ok(!t.waits.includes(READ_LOOK_MS));
    t.done();
  });
  it("keeps the account as \"\" when claude auth status cannot be read, and reads all the same", async () => {
    const { t, found } = reading("finished");
    const claude = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => (cmd === "CLAUDE" && args.includes("auth") ? { code: 1, stderr: "not signed in", stdout: "" } : claude(cmd, args, asked));
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.equal(reread(found).reading.account, "");
    t.done();
  });
  it("leaves out of the offers a spelling the episode has already", async () => {
    const { t, found } = reading("finished", { over: { spellings: [["Sally", "Sallie"]] } });
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.deepEqual(reread(found).offers.spellings.map((s) => s.heard), ["Ogden"]);
    t.done();
  });
});

describe("read, an iPhone clip", () => {
  const SAYS = `Claude says it is: A clip about knowing your costs. Say "what did Claude find?"`;
  it("says its line on what the clip is with what it found: in the reading's result, in status, and in kind's own wait (final fix 11)", async () => {
    const { t } = reading("short video");
    assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
    assert.equal(readResult(t.home, FOLDER, "read").next, SAYS);
    const status = await on(t.ctx.deps, "status");
    assert.ok(status.said.includes(`${FOLDER}: read ended 0 minutes ago. Made: a line on what the clip is, 1 spelling to check. ${SAYS}`), status.text);
    t.done();
    // Answered on the card, its reading started by kind and waited for in the foreground, as the Mac would run it.
    const u = reading("short video", { over: { kind: null, answer: { state: "needs your answer", guess: "clip", seen: "upright, 0:23", came: "phone", match: null }, editing: null } });
    let run = null;
    u.t.ctx.deps.start = (cmd, args) => {
      run = on(u.t.ctx.deps, ...args.slice(1));
    };
    const wait = u.t.ctx.deps.wait;
    u.t.ctx.deps.wait = async (ms) => {
      if (ms === READ_POLL_MS && run) await run;
      await wait(ms);
    };
    const kind = await on(u.t.ctx.deps, "kind", LABEL, "clip", "--private", "no");
    assert.deepEqual([kind.code, kind.said], [0, [`${LABEL}: read ended 0 minutes ago. Made: a line on what the clip is, 1 spelling to check. ${SAYS}`]]);
    u.t.done();
  });
  it("takes the names of the clip's file out of its line", async () => {
    const { t } = reading("short video", { reply: { ...CLIP_REPLY, about: "Pricing talk, a clip about costs." } });
    assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
    assert.equal(readResult(t.home, FOLDER, "read").next, `Claude says it is: the video, a clip about costs. Say "what did Claude find?"`);
    t.done();
  });
  it("says only what it found when Claude gave no line on what the clip is", async () => {
    const { t } = reading("short video", { reply: { ...CLIP_REPLY, about: "" } });
    assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
    assert.equal(readResult(t.home, FOLDER, "read").next, 'Say "what did Claude find?"');
    t.done();
  });
  it("writes the spellings as offers and its line on what the clip is, and no suggestions", async () => {
    const { t, found, asks, notices } = reading("short video");
    const r = await on(t.ctx.deps, ...readArgs("short video"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(asks, [requestFor("short video", PLAN, { video: VIDEO, duration: 23.423 })]);
    const record = reread(found);
    assert.deepEqual(record.offers.spellings, CLIP_REPLY.spellings);
    assert.equal(record.reading.about, CLIP_REPLY.about);
    assert.equal(record.reading.kind, "short video");
    assert.ok(!existsSync(join(found.folder, "reels.json")));
    assert.ok(!existsSync(join(found.folder, "Pricing talk.reel-suggestions.txt")));
    assert.deepEqual(record.reels, []);
    assert.deepEqual(notices, [NOTICE]);
    t.done();
  });
  it("writes its record as the checkout this code is in, with no commit given and the settings naming a folder that is no checkout", { skip: WITHOUT_COMMIT }, async () => {
    const { t, found } = reading("short video");
    t.ctx.deps.commit = undefined;
    writeSettings(t.home, { checkout: "/elsewhere/BRIMM video" });
    const r = await on(t.ctx.deps, ...readArgs("short video"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(reread(found).writer, { commit: OWN_COMMIT, on: "Mac Studio" });
    t.done();
  });
  describe("and its graphic cues (PR H2)", () => {
    const PLAN_FILE = "Pricing talk.cut-plan.json";
    /** Four cues, each for a phrase of the made-up plan: only three are kept. */
    const FOUR = [["p3", "let me do that again"], ["p5", "talk about pricing"], ["p7", "know your costs"], ["p8", "very very important"]].map(([id, words]) => ({ id, words, kind: "words", show: `The words ${words} on screen.`, seconds: 3 }));

    it("asks for them, three at most, in the line a raw video's request has", async () => {
      const { t, asks } = reading("short video");
      assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
      assert.equal(asks.length, 1);
      assert.ok(asks[0].split("\n").includes(graphicCuesAsk(3)));
      t.done();
    });
    it("keeps the three of four that it keeps in its record as reading.graphicCues, numbered from 1, each with the phrase it was written for", async () => {
      const { t, found } = reading("short video", { reply: { ...CLIP_REPLY, graphicCues: FOUR } });
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 0, r.text);
      assert.deepEqual(reread(found).reading.graphicCues, FOUR.slice(0, 3).map((c, i) => ({ n: i + 1, words: c.words, kind: "words", show: c.show, seconds: 3, style: null, phrase: c.id })));
      t.done();
    });
    it("keeps none when Claude gave none, or gave only what cannot be used", async () => {
      for (const graphicCues of [undefined, [], [{ id: "p7", words: "", kind: "graphic", show: "", seconds: 4 }], "none"]) {
        const { t, found } = reading("short video", { reply: { spellings: CLIP_REPLY.spellings, about: CLIP_REPLY.about, ...(graphicCues === undefined ? {} : { graphicCues }) } });
        const r = await on(t.ctx.deps, ...readArgs("short video"));
        assert.equal(r.code, 0, r.text);
        assert.deepEqual(reread(found).reading.graphicCues, [], `graphicCues: ${JSON.stringify(graphicCues) ?? "(none)"}`);
        assert.deepEqual(readResult(t.home, FOLDER, "read").made, ["a line on what the clip is", "1 spelling to check"]);
        t.done();
      }
    });
    it("keeps them with its spellings and its line on what the clip is, in the one record write its reading already makes", async () => {
      const { t, found, notices } = reading("short video");
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 0, r.text);
      const record = reread(found);
      assert.equal(record.rev, 2, "one record write");
      assert.deepEqual(record.reading, { kind: "short video", model: CLAUDE_MODEL, at: localStamp(new Date(Date.parse(AT))), on: "Mac Studio", account: ACCOUNT, outcome: "read", about: CLIP_REPLY.about, graphicCues: RAW_CUES });
      assert.deepEqual(record.offers.spellings, CLIP_REPLY.spellings);
      assert.deepEqual(notices, [NOTICE]);
      t.done();
    });
    it("says the same as before of what it made, and nothing of the cues", async () => {
      const { t } = reading("short video");
      assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
      const result = readResult(t.home, FOLDER, "read");
      assert.deepEqual([result.ok, result.made, result.failed], [true, ["a line on what the clip is", "1 spelling to check"], []]);
      t.done();
    });
    it("writes no cut plan, and nothing but the record: the plan, the cut log and every other file are as the import left them, nothing is set aside in history/, and only the record is put in", async () => {
      const { t, found } = reading("short video");
      const before = snapshot(found);
      const was = reread(found);
      assert.equal((await on(t.ctx.deps, ...readArgs("short video"))).code, 0);
      const after = snapshot(found);
      const files = (shot) => Object.fromEntries(Object.entries(shot).filter(([rel]) => !rel.startsWith("record/")));
      assert.deepEqual(files(after), files(before));
      assert.equal(after[PLAN_FILE], LIGHT_FILES[PLAN_FILE], "the plan is the rules', as the import wrote it");
      assert.ok(!("claude" in JSON.parse(after[PLAN_FILE])));
      assert.deepEqual(Object.keys(after).filter((rel) => rel.startsWith("history/")), []);
      assert.deepEqual(t.clones.map(([, to]) => to), [recordFile(found.folder, 2)]);
      assert.deepEqual(reread(found).files, was.files, "the record lists the files it listed");
      t.done();
    });
    it("does not wait for the import's late check, which does not look at the record: it asks at once, with the check still to come, and leaves the plan the check looks at as it is", async () => {
      const { t, found, asks } = reading("short video");
      pendingFor(t, found);
      const before = snapshot(found);
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 0, r.text);
      assert.equal(asks.length, 1);
      assert.ok(!t.waits.includes(READ_LOOK_MS), "no look at the import");
      assert.ok(!t.waits.includes(LATE_CHECK_MS), "no late check of its own");
      assert.deepEqual(reread(found).reading.graphicCues, RAW_CUES);
      const files = (shot) => Object.fromEntries(Object.entries(shot).filter(([rel]) => !rel.startsWith("record/")));
      assert.deepEqual(files(snapshot(found)), files(before));
      t.done();
    });
    it("puts nothing in when the record changed while Claude was asked (the rev it was started from is expected), and says so in the words of a record-only write", async () => {
      const asks = [];
      const { t, found, notices } = reading("short video");
      claudeDoing(t, CLIP_REPLY, asks, { then: () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, name: { text: "Pricing, renamed", placeholder: false } })) });
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 1);
      assert.equal(reread(found).rev, 2);
      assert.equal(reread(found).reading, undefined, "the record that is there is the other Mac's, without the reading");
      assert.deepEqual(notices, []);
      assert.deepEqual(readResult(t.home, FOLDER, "read").failed, ["Nothing was written: this episode changed while Claude read it."]);
      t.done();
    });
    it("keeps the record as it was, and writes nothing of the cues, when Claude cannot be asked", async () => {
      const { t, found } = reading("short video", { ended: ERRED });
      const before = snapshot(found);
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 1);
      assert.deepEqual(snapshot(found), before);
      t.done();
    });
    it("never puts a word of a cue into its log or its result", async () => {
      const SECRET = /Zebra|Quokka/;
      const { t } = reading("short video", { reply: { ...CLIP_REPLY, graphicCues: [{ id: "p7", words: "know your costs Zebra", kind: "words", show: "Quokka on screen", seconds: 3 }] } });
      const r = await on(t.ctx.deps, ...readArgs("short video"));
      assert.equal(r.code, 0, r.text);
      for (const what of [r.text, readFileSync(resultFile(t.home, FOLDER, "read"), "utf8").replace(/Claude says it is: [^"]*\. /, "")]) assert.doesNotMatch(what, SECRET);
      t.done();
    });
  });
  it("has no Reels, which the list of Reels says as drop and push say it, naming no file", async () => {
    const { t, found } = reading("short video");
    for (const words of [["reels", FOLDER, "--no-play"], ["reel", "drop", FOLDER, "1"], ["push", FOLDER, "reel", "1"]]) {
      const r = await on(t.ctx.deps, ...words);
      assert.deepEqual([r.code, r.said], [1, ["A short video has no Reels."]], words.join(" "));
    }
    assert.equal(reread(found).rev, 1);
    t.done();
  });
});

describe("read, a video made from a plan (PR H5b)", () => {
  /** The plan, kept whole in the record of the video its footage made (episode.js isFromPlan): the record is at layout 5. */
  const planned = () => ({
    ...newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: "Pricing talk", route: "script", voice: null, writer: { commit: "c709b57", on: "Mac Studio" } }).planned,
    set: AT, shots: [{ n: 1, kind: "talking", what: "Open." }], cues: [{ n: 1, words: "know your costs", kind: "words", show: "Her title.", seconds: 3, style: null }], lines: ["Know your costs."], filmed: { at: AT, parts: [ID] }
  });
  it("reads it as it reads a raw video: its plan stays whole in its record, and its cues are the guide's, which the reading does not change", async () => {
    const { t, found, asks } = reading("raw", { over: { version: 5, planned: planned() } });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(asks.length, 1);
    const record = reread(found);
    assert.deepEqual([record.kind, record.reading.kind, isFromPlan(record), record.rev], ["raw", "raw", true, found.record.rev + 1]);
    assert.deepEqual(record.planned, planned());
    assert.equal(episodeFault(record), "");
    // The reading kept its own cues in the cut plan, as for any raw video; the project is made from the guide's.
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8")).claude.graphicCues, RAW_CUES);
    t.done();
  });
});

describe("read, a raw video", () => {
  it("changes the plan by Claude's decisions with the pauses the import kept, and writes its cut log and the rough cut's captions again", async () => {
    const { t, found, asks } = reading("raw");
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(asks, [requestFor("raw", PLAN, { video: VIDEO, duration: 23.423 })]);
    const plan = JSON.parse(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"));
    const withPauses = applyDecisions(PLAN, RAW_REPLY.decisions, HEARD).plan;
    // With the pauses, the long pause beside the phrase Claude kept is shortened; without them it would be kept whole.
    assert.notDeepEqual(withPauses.ranges, applyDecisions(PLAN, RAW_REPLY.decisions, undefined).plan.ranges);
    assert.deepEqual(plan.ranges, JSON.parse(JSON.stringify(withPauses.ranges)));
    assert.deepEqual(plan.pauses, HEARD);
    assert.equal(plan.by, "rules and Claude");
    assert.deepEqual(plan.claude.decisions, RAW_REPLY.decisions);
    assert.deepEqual(plan.claude.graphicCues, RAW_CUES);
    assert.equal("graphics" in plan.claude, false);
    assert.deepEqual(Object.keys(plan.claude), ["decisions", "graphicCues", "ignored", "clips"]);
    assert.match(readFileSync(join(found.folder, "Pricing talk.cut-plan.txt"), "utf8"), /^The times here are the recording's own, from its start\.\nClaude read this plan and changed it in 1 place\./);
    const rough = roughCaptions(withPauses.phrases, keptSpans(withPauses.ranges, FACTS.fps));
    assert.equal(readFileSync(join(found.folder, "Pricing talk.rough-cut.srt"), "utf8"), rough);
    assert.notEqual(rough, ROUGH);
    assert.match(readFileSync(join(found.folder, "Pricing talk.edit-notes.txt"), "utf8"), /Open on the welcome\./);
    t.done();
  });
  it("renders the rough cut as version 0 on this Mac, opens it, and keeps the timeline it was made from as edit/main.v0.fcpxml", async () => {
    const { t, found, notices } = reading("raw");
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    const plan = applyDecisions(PLAN, RAW_REPLY.decisions, HEARD).plan;
    // The rough cut, made by today's ffmpeg arguments into BRIMM Video Work, never into Dropbox.
    const render = renderOf(t);
    assert.ok(existsSync(render));
    const made = t.calls.filter((c) => c.cmd === "FFMPEG");
    assert.equal(made.length, 1);
    const asked = made[0].args;
    assert.deepEqual(asked.slice(0, -1), roughCutArgs(join(found.folder, VIDEO), asked[asked.length - 1], { ranges: plan.ranges, fps: FACTS.fps, streams: streamsOf(probed({ sound: { sample_rate: "48000", channels: 2 } })) }).slice(0, -1));
    assert.ok(!listAll(found.folder).some((rel) => rel.endsWith(".mp4") && rel !== VIDEO));
    assert.deepEqual(t.opened, [["QuickTime Player", render]]);
    // The record holds it as rendered version 0 of the main video, made from the timeline kept in edit/.
    const record = reread(found);
    assert.deepEqual(record.main.pushed, [{ v: 0, how: "render", at: record.main.pushed[0].at, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: record.main.pushed[0].opened }]);
    assert.ok(record.main.pushed[0].opened, "it says when it opened");
    const v0 = readFileSync(join(found.folder, "edit", "main.v0.fcpxml"), "utf8");
    assert.match(v0, /src="\.\.\/Pricing%20talk\.mp4"/);
    assert.equal(record.files["edit/main.v0.fcpxml"], Buffer.byteLength(v0));
    // Its suggestions, crop-less, in reels.json at version 2, numbered from 1.
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.equal(reels.version, 2);
    assert.deepEqual(reels.candidates.map((c) => [c.n, c.title, c.hook, c.point, c.preview]), [[1, "", "What this is about", "Pricing is the subject.", null]]);
    assert.deepEqual(record.offers.spellings, RAW_REPLY.spellings);
    assert.equal(record.reading.kind, "raw");
    assert.deepEqual(notices, [NOTICE]);
    t.done();
  });
  it("still puts in what it read when the rough cut cannot be made, with no version 0, and says so", async () => {
    const { t, found } = reading("raw");
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => (cmd === "FFMPEG" ? { code: 1, stderr: "Conversion failed!" } : run(cmd, args, asked));
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    const record = reread(found);
    assert.deepEqual([record.rev, record.main.pushed, record.reading.kind, t.opened], [2, [], "raw", []]);
    assert.ok(!existsSync(renderOf(t)));
    assert.ok(existsSync(join(found.folder, "edit", "main.v0.fcpxml")));
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8")).ranges, JSON.parse(JSON.stringify(applyDecisions(PLAN, RAW_REPLY.decisions, HEARD).plan.ranges)));
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, false);
    assert.ok(result.failed.some((f) => /^The rough cut could not be made: ffmpeg stopped \(Conversion failed!\)\.$/.test(f)), result.failed.join(" | "));
    t.done();
  });
  it("waits, asking and replacing nothing, while the other Mac's import of the video is at work (its late check is not this Mac's to keep in step), and reads it once the check is made", async () => {
    const { t, found, asks } = reading("raw");
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    elsewhereAtWork(t);
    const before = snapshot(found);
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      assert.deepEqual(snapshot(found), before, `look ${looks}: nothing is replaced while the late check holds it`);
      assert.deepEqual(asks, [], `look ${looks}: Claude is not asked yet`);
      // The import makes its late check at the third look, and takes its pending check away.
      if (looks === 3) checkMade(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(looks, 3);
    assert.equal(asks.length, 1);
    assert.notEqual(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"), before["Pricing talk.cut-plan.json"]);
    t.done();
  });
  it("refuses at once, asking and writing nothing, when the late check found a problem", async () => {
    const { t, found, asks } = reading("raw");
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 20 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt", problem: "Pricing talk.srt is not whole in Dropbox." });
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual([asks, snapshot(found), t.waits], [[], before, []]);
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, false);
    assert.match(result.failed[0], /^The late check of this episode's import found a problem: Pricing talk\.srt is not whole in Dropbox\./);
    t.done();
  });
  it("stops, asking nothing, when the record's kind changed while it waited for the late check", async () => {
    const { t, found, asks } = reading("raw");
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    elsewhereAtWork(t);
    onWaits(t, READ_LOOK_MS, () => {
      // She said it is finished after all, on this Mac, and the import made its late check.
      writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, kind: "finished" }));
      checkMade(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual([asks, reread(found).rev], [[], 2]);
    assert.match(readResult(t.home, FOLDER, "read").failed[0], /^Pricing talk is no longer answered as raw with retakes, so Claude did not read it\./);
    t.done();
  });
});

// A reading is written by the code that runs it, so its record names the checkout this code is in (filing.js thisCheckout), not the
// one this Mac's settings name: those may be another brimm-video's. A finished or a raw video's reading puts the record in with its
// files (unedited.js intoEpisode), where an iPhone clip's, above, writes the record alone. No commit is given, as none is on a Mac.
describe("read, the commit its record names as the one that wrote it", () => {
  for (const kind of ["finished", "raw"]) {
    it(`is the checkout this code is in, for a ${kind} video, with the settings naming a folder that is no checkout`, { skip: WITHOUT_COMMIT }, async () => {
      const { t, found } = reading(kind);
      t.ctx.deps.commit = undefined;
      writeSettings(t.home, { checkout: "/elsewhere/BRIMM video" });
      const r = await on(t.ctx.deps, ...readArgs(kind));
      assert.equal(r.code, 0, r.text);
      assert.deepEqual(reread(found).writer, { commit: OWN_COMMIT, on: "Mac Studio" });
      t.done();
    });
  }
});

describe("read refuses, asking Claude nothing and writing nothing", () => {
  /** What a refusal leaves: nothing asked, the record as it was, and a result in `words`. */
  const refused = async (t, found, argv, words, deps = t.ctx.deps) => {
    const before = snapshot(found);
    const r = await on(deps, ...argv);
    assert.equal(r.code, 1, r.text);
    assert.deepEqual([calls(t), snapshot(found)], [[], before]);
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, false);
    if (words instanceof RegExp) assert.match(result.failed.join(" "), words);
    else assert.deepEqual(result.failed, [words]);
    return result;
  };
  it("a record that no longer says the kind it was started for", async () => {
    const { t, found } = reading("raw");
    await refused(t, found, readArgs("finished"), /^Pricing talk is no longer answered as finished by your editor, so Claude did not read it\./);
    t.done();
  });
  it("a record whose answer Dropbox undid: its rev is below the one it was started for", async () => {
    const { t, found } = reading("finished");
    await refused(t, found, readArgs("finished", 3), /^Dropbox undid the answer for Pricing talk, so Claude did not read it\./);
    t.done();
  });
  it("a record another Mac has open", async () => {
    const { t, found } = reading("finished", { over: { editing: { by: "Sallie's laptop", since: AT } } });
    await refused(t, found, readArgs("finished"), /^Sallie's laptop has Pricing talk open, so Claude did not read it\./);
    t.done();
  });
  it("a record with a session mark, once the training gate lets read through, named by its label", async () => {
    const { t, found } = reading("finished", { over: { session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } } });
    const deps = { ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } } } };
    const result = await refused(t, found, readArgs("finished"), new RegExp(`^${LABEL.replace(/[()]/g, "\\$&")} is marked a client or group session, so Claude did not read it\\.`), deps);
    assert.doesNotMatch(JSON.stringify(result), /Pricing talk/);
    t.done();
  });
  it("a session, which is read only for its teachings, and whose files are never named", async () => {
    const session = sessionLabel("2026-10-14");
    const { t, found } = reading("finished", { over: { kind: "session", name: { text: session, placeholder: false }, session: { marked: AT, on: "Mac Studio", teachings: "asked", cleared: null }, editing: null } });
    const deps = { ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } } } };
    // Read as another kind, it is refused as a session; read as a session (F7, tests/edit-session-mark.test.js), only for an ask
    // its record says when it was made.
    for (const [kind, words] of [["finished", SESSION_LATER], ["session", `${session}'s teachings were not asked for, so Claude did not read it. Nothing was changed.`]]) {
      const result = await refused(t, found, readArgs(kind), words, deps);
      assert.doesNotMatch(JSON.stringify(result), /Pricing talk/);
    }
    t.done();
  });
  it("on a Mac whose readings are off", async () => {
    const { t, found } = reading("finished");
    await refused(t, found, readArgs("finished"), READINGS_OFF, { ...t.ctx.deps, settings: { ...t.ctx.settings, readings: false } });
    t.done();
  });
  it("on a Mac without Claude Code", async () => {
    const { t, found } = reading("finished");
    t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "" };
    await refused(t, found, readArgs("finished"), /^Claude Code is not installed on this Mac/);
    t.done();
  });
});

describe("read, when Claude cannot be asked", () => {
  it("tries twice, changes nothing, and says why without a word of what Claude Code printed", async () => {
    const SECRET = "Zebra Quokka";
    const { t, found, asks, notices } = reading("finished", { ended: { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", is_error: true, result: `${SECRET} could not go on` }) } });
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 1);
    assert.equal(asks.length, 2);
    assert.deepEqual([snapshot(found), notices], [before, []]);
    const result = readResult(t.home, FOLDER, "read");
    assert.match(result.failed.join(" "), /Claude could not read it: Claude Code gave an error\./);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(SECRET));
    assert.doesNotMatch(r.text, new RegExp(SECRET));
    t.done();
  });
});

describe("read never quotes Claude's reply or the transcript in its log or its result", () => {
  it("for each kind, with a reply whose every text holds words of its own", async () => {
    const SECRET = /Zebra|Quokka/;
    const TRANSCRIPT = /Welcome|costs|important/;
    const odd = (reply) => JSON.parse(JSON.stringify(reply).replace(/"(why|point|notes|idea|hook|about|first|last|spelled)":"([^"]*)"/g, '"$1":"$2 Zebra Quokka"'));
    for (const kind of ["finished", "raw", "short video"]) {
      const { t } = reading(kind, { reply: { ...odd(REPLIES[kind]), decisions: [{ id: "p99", keep: false, why: "Zebra" }], clips: [...(REPLIES[kind].clips || []), { from: "Quokka", to: "p5", hook: "Zebra", why: "Zebra" }] } });
      const r = await on(t.ctx.deps, ...readArgs(kind));
      assert.equal(r.code, 0, r.text);
      // An iPhone clip's one line on what it is, which is for her, is the only words of the reply its result holds (final fix 11).
      const about = kind === "short video" ? `Claude says it is: ${odd(REPLIES[kind]).about.replace(/\.$/, "")}. ` : "";
      const result = readFileSync(resultFile(t.home, FOLDER, "read"), "utf8");
      if (about) assert.ok(result.includes(about), result);
      for (const what of [r.text, result.replace(about, "")]) {
        assert.doesNotMatch(what, SECRET, `${kind}: ${what}`);
        assert.doesNotMatch(what, TRANSCRIPT, `${kind}: ${what}`);
      }
      t.done();
    }
  });
});

describe("read numbers its suggestions on from the highest number ever given to the video", () => {
  /** A hand-off for the video `id`, as the BRIMM Ops page holds one: its suggestions' and Reels' numbers up to 4. */
  const handoff = (id) => ({ format: "brimm-ops handoff", version: 2, revision: 1, video: { id, kind: "finished" }, suggestions: [{ n: 1 }, { n: 2 }], reels: [{ n: 4, fromSuggestion: null }] });
  const lay = (folder, rel, value) => {
    mkdirSync(dirname(join(folder, rel)), { recursive: true });
    writeFileSync(join(folder, rel), JSON.stringify(value));
  };
  it("a new version of a video whose first version's hand-off gave numbers up to 4 numbers its first suggestion 5", async () => {
    const OLD = "e-20261010-0b0b0b";
    const { t, found } = reading("finished", { over: { versionOf: OLD } });
    const old = episodeAs(t, { id: OLD, name: "2026-10-10 Pricing talk (Mac Studio)", record: { kind: "finished", answer: ANSWERED, label: "Video of 10 Oct, 09:00 (Mac Studio)" } });
    lay(old.folder, "final/Pricing talk.brimm-ops.json", handoff(OLD));
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.deepEqual([reels.candidates.map((c) => c.n), reels.highest], [[5, 6], 6]);
    assert.deepEqual(reread(found).reels.map((reel) => reel.n), [5, 6]);
    t.done();
  });
  it("a reading in the same folder, after its old reels.json and hand-off were set aside into history/, starts at 5 too", async () => {
    const { t, found } = reading("finished");
    lay(found.folder, "history/2026-10-21 09.00 reels.json", { format: "brimm-video reels", version: 1, video: VIDEO, by: "import", made: AT, highest: 3, candidates: [] });
    lay(found.folder, "history/2026-10-21 09.00 Pricing talk.brimm-ops.json", handoff(ID));
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    const reels = JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8"));
    assert.deepEqual([reels.candidates.map((c) => c.n), reels.highest], [[5, 6], 6]);
    t.done();
  });
});

// --- reels.json version 2: candidates with no crops yet ---

/** A candidate as a reading writes it: its stretch, and no crop, no preview and no title. */
const UNCROPPED = { n: 3, start: 6.07, end: 21.097, ranges: [{ start: 6.07, end: 21.097 }], seconds: 15.027, fits: { fits: true }, title: "", reason: "It is the whole talk in brief.", point: "", words: "", phrases: [], preview: null };
/** A candidate as the import writes it: its stretch with its crop. */
const CROPPED = { ...UNCROPPED, n: 2, ranges: [{ start: 6.07, end: 21.097, crop: { x: 0, y: 0, w: 405, h: 720, found: true } }], title: "Know your costs" };

describe("reels.json version 2", () => {
  it("is written at version 2 when a candidate has no crop, and at version 1, as today, when every one has its crop", () => {
    assert.equal(REELS_VERSION, 2);
    assert.equal(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED] }).version, 2);
    assert.equal(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [CROPPED, UNCROPPED] }).version, 2);
    assert.equal(reelsFile({ video: VIDEO, by: "import", made: AT, candidates: [CROPPED] }).version, 1);
    assert.equal(reelsFile({ video: VIDEO, by: "import", made: AT, candidates: [], none: "Claude was not asked" }).version, 1);
  });
  it("reads back a candidate with no crops", () => {
    const text = JSON.stringify(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED], highest: 4 }));
    const read = readReels(text);
    assert.ok(read.reels, read.why);
    assert.deepEqual(read.reels.candidates, [UNCROPPED]);
    assert.equal(read.reels.highest, 4);
  });
  it("is refused by an older reader in the words it has always used for a newer one", () => {
    const text = JSON.stringify(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED] }));
    assert.deepEqual(readReels(text, { known: 1 }), { why: "it was written by a newer brimm-video. Ask Jason to update this Mac." });
  });
  it("still needs every crop at version 1", () => {
    const text = JSON.stringify({ ...reelsFile({ video: VIDEO, by: "import", made: AT, candidates: [CROPPED] }), candidates: [UNCROPPED] });
    assert.deepEqual(readReels(text), { why: "candidate 1 in it cannot be read" });
  });
});

describe("a Reel with no crops yet, which every reader that needs crops refuses", () => {
  /** An answered finished video whose reels.json holds Reel 3, crop-less, and whose record holds it as `status`. */
  const listed = (status) => {
    const { t, found } = reading("finished", { over: { reels: [{ n: 3, status, from: 6.07, to: 21.097, title: "", why: "", files: [], pushed: [] }] }, files: { ...LIGHT_FILES, "reels.json": JSON.stringify(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED] })) } });
    return { t, found };
  };
  // No command picks a Reel any more (plan PR 5: `app … reel <n>` picks the one it opens), but `pickReels` stays for the Final Cut
  // Reel path until the retirement's wave 5, and it refuses a Reel that is not made as it always did.
  it("pickReels", async () => {
    const { t, found } = listed("candidate");
    assert.equal(await pickReels(t.ctx, { ...found, record: reread(found) }, [3]), 1);
    assert.equal(t.said(), NOT_MADE(3));
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("push … reel", async () => {
    const { t, found } = listed("picked");
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "3");
    assert.deepEqual([r.code, r.said], [1, [NOT_MADE(3)]]);
    assert.deepEqual([reread(found).rev, t.opened, readdirSync(found.folder).includes("edit")], [1, [], false]);
    t.done();
  });
  it("previewSteps", () => {
    assert.throws(() => previewSteps({ video: "/v/raw.mov", ranges: UNCROPPED.ranges, out: "/w/preview.mp4", fps: FACTS.fps, duration: 23.423, work: "/w", size: { width: 1280, height: 720 }, n: 3 }), { message: NOT_MADE(3) });
  });
  it("pickReels of several, naming each that cannot be made, and picking none", async () => {
    const two = [{ n: 3, status: "candidate", from: 6.07, to: 21.097, title: "", why: "", files: [], pushed: [] }, { n: 4, status: "candidate", from: 6.07, to: 21.097, title: "", why: "", files: [], pushed: [] }];
    const { t, found } = reading("finished", { over: { reels: two }, files: { ...LIGHT_FILES, "reels.json": JSON.stringify(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED, { ...UNCROPPED, n: 4 }] })) } });
    assert.equal(await pickReels(t.ctx, { ...found, record: reread(found) }, [3, 4]), 1);
    assert.equal(t.said(), ELSEWHERE("Reels 3 and 4"));
    assert.deepEqual([reread(found).rev, reread(found).reels.map((x) => x.status)], [1, ["candidate", "candidate"]]);
    t.done();
  });
  it("captions, a title or a graphic on it, a style or a cut: never sent to pick it first, whatever the record says of it", async () => {
    for (const status of ["candidate", "picked"]) {
      const { t, found } = listed(status);
      for (const words of [["captions", FOLDER, "reel", "3", "on"], ["text", FOLDER, "reel", "3"], ["graphic", FOLDER, "reel", "3"], ["preset", FOLDER, "reel", "3", "--look", "bright"], ["cut", FOLDER, "remove", "reel", "3", "--words", "welcome"], ["title", FOLDER, "reel", "3"], ["title", FOLDER, "reel", "3", "--words", "Say it again"]]) {
        const r = await on(t.ctx.deps, ...words);
        assert.deepEqual([r.code, r.said], [1, [NOT_MADE(3)]], `${status}: ${words.join(" ")}`);
      }
      assert.equal(reread(found).rev, 1);
      t.done();
    }
  });
  it("says nowhere to make it first", async () => {
    const { t } = listed("candidate");
    // It is never told to make Reel 3 (or to make it) first; that brimm-video "cannot make Reel 3 on this Mac" is not such a word.
    for (const words of [["reel", "drop", FOLDER, "3"], ["push", FOLDER, "reel", "3"], ["captions", FOLDER, "reel", "3", "on"]]) assert.doesNotMatch((await on(t.ctx.deps, ...words)).text, /(?<!cannot )make Reel \d|make it|first/);
    t.done();
  });
});

describe("the Reel suggestions of a video she has answered, which brimm-video cannot make yet", () => {
  const list = JSON.stringify(reelsFile({ video: VIDEO, by: "read", made: AT, candidates: [UNCROPPED] }));
  it("are listed, then that brimm-video cannot make them on this Mac, which is not set up for HyperFrames", async () => {
    for (const kind of ["finished", "raw"]) {
      const { t } = reading(kind, { over: { reels: [{ n: 3, status: "candidate", from: 6.07, to: 21.097, title: "", why: "", files: [], pushed: [] }] }, files: { ...LIGHT_FILES, "reels.json": list } });
      const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /^Reel suggestions of /);
      assert.equal(r.said[1], ELSEWHERE("Reels"), kind);
      assert.equal(r.said.length, 2, r.text);
      t.done();
    }
  });
  it("say that brimm-video cannot make them only for a suggestion she has not dropped", async () => {
    const { t } = reading("finished", { over: { reels: [{ n: 3, status: "dropped", from: 6.07, to: 21.097, title: "", why: "", files: [], pushed: [] }] }, files: { ...LIGHT_FILES, "reels.json": list } });
    const r = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.said.length, 1, r.text);
    assert.doesNotMatch(r.text, /cannot make Reel|on this Mac/);
    t.done();
  });
  it("are never offered to a session: the gate refuses it before anything is listed", async () => {
    const { t } = reading("finished", { over: { kind: "session", session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } }, files: { ...LIGHT_FILES, "reels.json": list } });
    for (const words of [["reels", FOLDER, "--no-play"], ["reel", "drop", FOLDER, "3"], ["push", FOLDER, "reel", "3"], ["captions", FOLDER, "reel", "3", "on"]]) {
      const r = await on(t.ctx.deps, ...words);
      assert.equal(r.code, 1, r.text);
      assert.doesNotMatch(r.text, /cannot make Reel|on this Mac|Reel suggestions/, words.join(" "));
    }
    t.done();
  });
});

// --- Fix round 1 (the reviews of F5) ---

/** A pending late check of this Mac's for the made-up episode, due 10 minutes from now, with `over` laid on it. */
const pendingFor = (t, found, over = {}) => writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt", ...over });
/** The other Mac's import of the made-up video, at work: a hold the late check of this Mac's own does not make the reading's to keep in
    step (plan R1c), so the reading waits for it as it always did. */
const elsewhereAtWork = (t) => writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 4242, import: "z9", video: VIDEO, bytes: 13, seconds: 23.423, step: "Importing", at: new Date(t.now()).toISOString() }, (to, text) => writeFileSync(to, text));
/** The late check made, as the import makes it: the pending check taken away, and the status of an import at work with it. */
const checkMade = (t) => {
  rmSync(join(pendingFolder(t.home), `${ID}.json`), { force: true });
  removeStatus(t.root, VIDEO, "Sallie's laptop", "z9");
};
/** What the record says once the other Mac took the video over and answered it a client or group session. */
const sessionOver = (rev, by = "Sallie's laptop") => ({ rev, kind: "session", name: { text: sessionLabel("2026-10-14"), placeholder: false }, session: { marked: AT, on: by, teachings: null, cleared: null }, editing: { by, since: AT } });
/** Claude Code as a stand-in whose call does `then(n)` on its nth call before it replies, and whose `auth status` does
    `onAuth()`; each request goes into `asks`. */
const claudeDoing = (t, reply, asks, { then = () => {}, onAuth = () => {}, first = null } = {}) => {
  const run = t.ctx.deps.run;
  t.ctx.deps.run = async (cmd, args, asked) => {
    if (cmd !== "CLAUDE") return run(cmd, args, asked);
    t.calls.push({ cmd, args, cwd: asked && asked.cwd });
    if (args.includes("auth")) {
      await onAuth(args, asked);
      return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
    }
    asks.push(asked.input);
    await then(asks.length);
    if (first && asks.length === 1) return first;
    return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", is_error: false, result: JSON.stringify(reply) }) };
  };
};
const ERRED = { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", is_error: true, result: "it could not go on" }) };
const READ_ALREADY = `${NAME} was read already for this answer. Nothing was asked of Claude.`;

describe("read's result, written once what it read is in (fix 1)", () => {
  it("lets kind, waiting in the foreground, say what Claude found before the late check, and status say the run is still at work", async () => {
    const waitingAnswer = { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera", match: null };
    const { t, found, notices } = reading("finished", { over: { kind: null, answer: waitingAnswer, editing: null } });
    // The late check of what the reading put in waits until the test lets it go; kind's polls let the run go on meanwhile.
    let release;
    const held = new Promise((done) => {
      release = done;
    });
    const wait = t.ctx.deps.wait;
    t.ctx.deps.wait = async (ms) => {
      if (ms === LATE_CHECK_MS) await held;
      if (ms === READ_POLL_MS) await new Promise((done) => setImmediate(done));
      await wait(ms);
    };
    t.ctx.deps.alive = (pid) => pid === process.pid;
    let run = null;
    t.ctx.deps.start = (cmd, args) => {
      run = editMain(args.slice(1), { ...t.ctx.deps, say: () => {} });
    };
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.text);
    const said = r.said[r.said.length - 1];
    assert.match(said, new RegExp(`^${LABEL.replace(/[()]/g, "\\$&")}: read put in what it made [^;]+ ago; the late check of its copies is still to come\\. Made: Reel suggestions 1 to 2, 2 spellings to check\\.`), said);
    assert.match(said, /Say "what did Claude find\?"$/);
    assert.deepEqual(notices, [NOTICE]);
    const early = readResult(t.home, FOLDER, "read");
    assert.equal(early.early, true);
    // status, meanwhile: the run is still at work, and what it put in is said.
    const status = await on(t.ctx.deps, "status");
    assert.ok(status.said.includes(`${FOLDER}: read is running.`), status.text);
    assert.ok(status.said.some((line) => line.startsWith(`${FOLDER}: read put in what it made`) && line.includes("still to come")), status.text);
    // A conflicted copy of reels.json lands before the late check: the late check's result adds what it found, and only that.
    writeFileSync(join(found.folder, "reels (Sallie's laptop's conflicted copy 2026-10-20).json"), "{}");
    release();
    assert.equal(await run, 1);
    const final = readResult(t.home, FOLDER, "read");
    assert.equal(final.early, undefined);
    assert.equal(final.started, early.started);
    assert.deepEqual(final.made, early.made);
    assert.deepEqual(final.failed.slice(0, early.failed.length), early.failed);
    assert.ok(final.failed.slice(early.failed.length).some((f) => /^reels\.json has a conflicted copy in the episode/.test(f)), final.failed.join(" | "));
    t.done();
  });
});

describe("read reads the record again right before every call to Claude (fix 2, fix 6)", () => {
  it("before the second try, after the record became a session during the first", async () => {
    const asks = [];
    const { t, found } = reading("finished");
    claudeDoing(t, FINISHED_REPLY, asks, { first: ERRED, then: (n) => n === 1 && writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), ...sessionOver(2) })) });
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 1);
    assert.equal(asks.length, 1);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [SESSION_LATER]);
    assert.equal(reread(found).rev, 2);
    t.done();
  });
  it("after the account is read, for a finished video and an iPhone clip alike", async () => {
    for (const kind of ["finished", "short video"]) {
      const asks = [];
      const { t, found } = reading(kind);
      claudeDoing(t, REPLIES[kind], asks, { onAuth: () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), ...sessionOver(2) })) });
      const r = await on(t.ctx.deps, ...readArgs(kind));
      assert.equal(r.code, 1, kind);
      assert.deepEqual([asks.length, reread(found).rev], [0, 2], kind);
      assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [SESSION_LATER], kind);
      t.done();
    }
  });
  it("and refuses a newer record Dropbox is still bringing over, while a raw reading waited for the late check", async () => {
    const { t, found, asks } = reading("raw");
    pendingFor(t, found);
    elsewhereAtWork(t);
    onWaits(t, READ_LOOK_MS, () => {
      // The other Mac's session answer after a take-over: only the start of record 2 is here yet.
      writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), ...sessionOver(2) }).slice(0, 40));
      checkMade(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.equal(asks.length, 0);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [`Dropbox is still bringing a newer record of ${NAME} over, so Claude did not read it.`]);
    t.done();
  });
  it("and puts nothing in when the record changed while Claude was asked (intoEpisode's expected rev)", async () => {
    const asks = [];
    const { t, found, notices } = reading("finished");
    claudeDoing(t, FINISHED_REPLY, asks, { then: () => writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, name: { text: "Pricing, renamed", placeholder: false } })) });
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 1);
    assert.equal(reread(found).rev, 2);
    assert.ok(!existsSync(join(found.folder, "reels.json")));
    assert.deepEqual(notices, []);
    assert.ok(readResult(t.home, FOLDER, "read").failed.some((f) => /changed on the other Mac meanwhile/.test(f)), readResult(t.home, FOLDER, "read").failed.join(" | "));
    t.done();
  });
});

describe("read waits for the import's late check whenever it would replace a file that check looks at (fix 3)", () => {
  /** A finished video the full import filed, with its late check to come on this Mac: reels.json is an entry of the check. */
  const fullImport = () => {
    const IMPORT_REELS =JSON.stringify(reelsFile({ video: VIDEO, by: "import", made: AT, candidates: [{ n: 1, start: 6.07, end: 21.097, ranges: [{ start: 6.07, end: 21.097, crop: { x: 0, y: 0, w: 405, h: 720, found: true } }], seconds: 15.027, fits: { fits: true }, title: "Know your costs", reason: "r", point: "", words: "", phrases: [], preview: null }] }), null, 2) + "\n";
    const world = reading("finished", { over: { version: 2, kind: "finished" }, files: { ...LIGHT_FILES, "reels.json": IMPORT_REELS } });
    const { t, found } = world;
    const workCopy = join(t.work, "reels.json");
    writeFileSync(workCopy, IMPORT_REELS);
    const entries = [{ from: workCopy, to: join(found.folder, "reels.json"), bytes: Buffer.byteLength(IMPORT_REELS) }];
    pendingFor(t, found, { work: t.work, entries, lastCopy: t.now() - 60000 });
    return { ...world, IMPORT_REELS, entries };
  };
  it("a finished reading of a video the full import filed waits, while the other Mac's import is at work, for the late check that still watches its reels.json", async () => {
    const { t, found, asks, IMPORT_REELS, entries } = fullImport();
    elsewhereAtWork(t);
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      assert.equal(readFileSync(join(found.folder, "reels.json"), "utf8"), IMPORT_REELS, "reels.json is the import's while its check is to come");
      assert.equal(asks.length, 0);
      if (looks === 2) {
        // The import makes its late check, which finds reels.json as it put it, and takes its pending check away.
        assert.deepEqual(lateCheck(entries, { clone: (from, to) => writeFileSync(to, readFileSync(from)), sameDisk: () => true }), []);
        checkMade(t);
      }
    });
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 0, r.text);
    assert.equal(looks, 2);
    const now = readFileSync(join(found.folder, "reels.json"), "utf8");
    assert.equal(JSON.parse(now).by, "read");
    assert.equal(reread(found).files["reels.json"], Buffer.byteLength(now));
    t.done();
  });
  it("a finished reading of a video the full import filed reads at once while this Mac's own check is to come, and reels.json leaves the check", async () => {
    const { t, found, asks } = fullImport();
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([asks.length, t.waits.includes(READ_LOOK_MS)], [1, false]);
    assert.equal(JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).by, "read");
    assert.deepEqual(readPendingsOf(t).entries, []);
    t.done();
  });
});

describe("resolve never prints the account a reading kept (fix 4)", () => {
  it("shows the reading row without it", async () => {
    const { t, found } = reading("finished");
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    const theirs = { ...reread(found), writer: { commit: "c709b57", on: "Sallie's laptop" } };
    delete theirs.reading;
    writeFileSync(join(found.folder, "record", "0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText(theirs));
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.doesNotMatch(r.text, /sallie@example\.com|account/i);
    assert.ok(r.said.some((line) => /Reading/.test(line) && /finished/.test(line)), r.text);
    t.done();
  });
});

describe("one reading for each answer (fix 5)", () => {
  it("refuses a second reading of the same answer, asking and replacing nothing", async () => {
    const { t, found, asks } = reading("raw");
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs("raw", 0));
    assert.equal(r.code, 1);
    assert.deepEqual([asks.length, snapshot(found)], [1, before]);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [READ_ALREADY]);
    t.done();
  });
  it("reads a video answered again since its last reading", async () => {
    const { t, asks } = reading("finished", { over: { reading: { kind: "raw", model: CLAUDE_MODEL, at: "2026-10-19T09:00:00-05:00", on: "Mac Studio", account: "", outcome: "read" } } });
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.equal(asks.length, 1);
    t.done();
  });
});

describe("read gives up waiting for an import at work after READ_HOLD_MS (fix 6, fix 11)", () => {
  /** The status of an import of the video at work on the other Mac, written as of now. */
  const importing = (t) => writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 2, import: "x1", video: VIDEO, bytes: 13, seconds: 23.423, step: "Waiting for the late check", at: localStamp(new Date(t.now())) }, (to, text) => writeFileSync(to, text));
  it("waits while it is at work, and reads once it is done", async () => {
    const { t, asks } = reading("raw");
    importing(t);
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      if (looks < 3) importing(t);
      else rmSync(join(t.root, "Episodes", ".importing"), { recursive: true, force: true });
    });
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    assert.deepEqual([looks, asks.length], [3, 1]);
    t.done();
  });
  it("and says why, asking nothing, when it is still at work after READ_HOLD_MS", async () => {
    const { t, asks } = reading("raw");
    importing(t);
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      if (looks > READ_HOLD_MS / READ_LOOK_MS + 5) throw new Error("it waited past READ_HOLD_MS");
      importing(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual([looks, asks.length], [READ_HOLD_MS / READ_LOOK_MS, 0]);
    assert.match(readResult(t.home, FOLDER, "read").failed[0], /^The import of this episode has not finished on Sallie's laptop yet: it is at "Waiting for the late check"\./);
    t.done();
  });
});

describe("the raw reading's version 0 (fix 7, fix 8, fix 9)", () => {
  it("holds Claude's graphic cues on its timeline as ideas, each at the moment its words start", async () => {
    const { t, found } = reading("raw");
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    // "know" of "know your costs" is said at 15.3 seconds, which is picture 459.
    assert.match(readFileSync(join(found.folder, "edit", "main.v0.fcpxml"), "utf8"), /<marker start="459459\/30000s" duration="[^"]*" value="Graphic idea: A chart of what it costs"/);
    t.done();
  });
  it("lists Claude's graphic cues in its notes under its ideas for graphics, at the time the words they go with are said, and those words", async () => {
    const { t, found } = reading("raw");
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    const notes = readFileSync(join(found.folder, "Pricing talk.edit-notes.txt"), "utf8");
    // p7 starts at 0:13, and "know" of "know your costs" is said at 15.3 seconds.
    assert.match(notes, /\n\nIts ideas for graphics\n0:15  "know your costs"  \|  A chart of what it costs\n\n/);
    t.done();
  });
  it("has a marker for a cue placed in kept words, on the take she keeps when the words are said twice, and none for a cue that is not found or sits in a cut", async () => {
    // "Welcome to the show" is said twice, and the rules cut the first take (p1): the cue names that take, which is cut, and is on the
    // one that is kept. "the moon landing" is never said; p3 is cut by the rules.
    const cue = (id, words, show) => ({ id, words, kind: "words", show, seconds: 3 });
    const reply = { ...RAW_REPLY, graphicCues: [cue("p1", "Welcome to the show", "The show's name."), cue("p9", "the moon landing", "The moon."), cue("p3", "do that again", "A slow zoom."), RAW_REPLY.graphicCues[0]] };
    const { t, found } = reading("raw", { reply });
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    const xml = readFileSync(join(found.folder, "edit", "main.v0.fcpxml"), "utf8");
    assert.deepEqual([...xml.matchAll(/<marker start="([^"]*)"[^>]*value="(Graphic idea[^"]*)"/g)].map((m) => `${m[1]} ${m[2]}`), ["182182/30000s Graphic idea: The show's name.", "459459/30000s Graphic idea: A chart of what it costs"]);
    // The notes tell each by where it is placed: listed at the time its words are said, in a cut, or not found.
    const notes = readFileSync(join(found.folder, "Pricing talk.edit-notes.txt"), "utf8");
    assert.match(notes, /Its ideas for graphics\n0:06  "Welcome to the show"  \|  The show's name\.\n0:15  "know your costs"  \|  A chart of what it costs\n\n/);
    assert.match(notes, /What could not be used from its reply\nGraphic idea 2: its words, "the moon landing", were not found in the video: The moon\.\nAn idea for a graphic sits on words that are cut, at 0:04: A slow zoom\.\n/);
    t.done();
  });
  it("opens the rough cut only once what it read is in the episode", async () => {
    const { t, found } = reading("raw");
    const opened = [];
    t.ctx.deps.openApp = (app, file) => opened.push([app, file, reread(found).rev]);
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    assert.deepEqual(opened, [["QuickTime Player", renderOf(t), 2]]);
    t.done();
  });
  it("when the put fails after the render: opens nothing, posts no notice, and says where the rough cut is kept", async () => {
    const { t, found, notices } = reading("raw");
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => {
      // The other Mac renames it while the rough cut is made.
      if (cmd === "FFMPEG") writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, name: { text: "Pricing, renamed", placeholder: false } }));
      return run(cmd, args, asked);
    };
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual([t.opened, notices, reread(found).rev], [[], [], 2]);
    assert.ok(existsSync(renderOf(t)));
    const result = readResult(t.home, FOLDER, "read");
    assert.equal(result.ok, false);
    assert.ok(result.failed.includes(`The rough cut of ${NAME} is kept on this Mac, in BRIMM Video Work, as "${NAME} – version 0.mp4".`), result.failed.join(" | "));
    assert.doesNotMatch(JSON.stringify(result), new RegExp(FOLDER.replace(/[()]/g, "\\$&")));
    t.done();
  });
  it("sets the import's plan and its cut log aside in history/ before the first reading replaces them", async () => {
    const { t, found } = reading("raw");
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    const aside = listAll(found.folder).filter((rel) => rel.startsWith("history/"));
    assert.equal(aside.length, 2, aside.join(", "));
    const of = (ending) => readFileSync(join(found.folder, aside.find((rel) => rel.endsWith(ending))), "utf8");
    assert.equal(of(" Pricing talk.cut-plan.json"), LIGHT_FILES["Pricing talk.cut-plan.json"]);
    assert.equal(of(" Pricing talk.cut-plan.txt"), LIGHT_FILES["Pricing talk.cut-plan.txt"]);
    for (const rel of aside) assert.equal(reread(found).files[rel], statSync(join(found.folder, rel)).size, rel);
    t.done();
  });
});

describe("fix 10 and fix 11", () => {
  it("names a clip it left out by Claude's own numbering, and numbers the suggestions with no gap, on from the highest given", async () => {
    const reply = { ...RAW_REPLY, clips: [{ from: "zz", to: "p5", hook: "h", why: "w" }, { from: "p4", to: "p5", hook: "What this is about", why: "It says it.", point: "Pricing." }, { from: "p7", to: "p9", hook: "Costs", why: "One point.", point: "Costs." }] };
    const { t, found } = reading("raw", { reply });
    mkdirSync(join(found.folder, "history"), { recursive: true });
    writeFileSync(join(found.folder, "history", "2026-10-19 reels.json"), JSON.stringify({ format: "brimm-video reels", version: 1, video: VIDEO, by: "import", made: AT, highest: 4, candidates: [] }));
    assert.equal((await on(t.ctx.deps, ...readArgs("raw"))).code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).candidates.map((c) => c.n), [5, 6]);
    const text = readFileSync(join(found.folder, "Pricing talk.reel-suggestions.txt"), "utf8");
    assert.match(text, /- Claude's clip 1 was left out: the plan has no phrase "zz"\./);
    assert.doesNotMatch(text, /(^|\n)- Clip \d/);
    t.done();
  });
  it("numbers on with no gap past a suggestion that comes to less than one picture", async () => {
    const tiny = { id: "p10", start: 22.0, end: 22.005, keep: true, kind: "keep", why: "", text: "Bye.", words: [] };
    const plan = { ...PLAN, phrases: [...PLAN.phrases, tiny] };
    const reply = { ...FINISHED_REPLY, suggestions: [{ from: "p10", to: "p10", why: "Short.", point: "" }, FINISHED_REPLY.suggestions[0]] };
    const { t, found } = reading("finished", { reply, files: { ...LIGHT_FILES, "Pricing talk.cut-plan.json": JSON.stringify(plan, null, 2) + "\n" } });
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).candidates.map((c) => [c.n, c.reason]), [[1, "It is the whole talk in brief."]]);
    t.done();
  });
  it("refuses a preview of a candidate with no crops, numbered or not", () => {
    assert.throws(() => previewSteps({ video: "/v/raw.mov", ranges: UNCROPPED.ranges, out: "/w/preview.mp4", fps: FACTS.fps, duration: 23.423, work: "/w", size: { width: 1280, height: 720 } }), { message: ELSEWHERE("Reels") });
  });
  it("reads the account in the run's own empty folder, with no settings file read", async () => {
    const asks = [];
    let seen = null;
    const { t } = reading("finished");
    claudeDoing(t, FINISHED_REPLY, asks, { onAuth: (args, asked) => {
      seen = { args, cwd: asked.cwd, inIt: readdirSync(asked.cwd) };
    } });
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.deepEqual(seen.args, ["--setting-sources", "", "auth", "status", "--json"]);
    assert.deepEqual(seen.inIt, []);
    t.done();
  });
  it("checks again, after the late check, that readings are on", async () => {
    const { t, found, asks } = reading("raw");
    pendingFor(t, found);
    elsewhereAtWork(t);
    onWaits(t, READ_LOOK_MS, () => {
      writeSettings(t.home, { readings: false });
      checkMade(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.equal(asks.length, 0);
    assert.deepEqual(readResult(t.home, FOLDER, "read").failed, [READINGS_OFF]);
    t.done();
  });
  it("is asked a second time when the first try fails, and reads", async () => {
    const asks = [];
    const { t, found } = reading("finished");
    claudeDoing(t, FINISHED_REPLY, asks, { first: ERRED });
    assert.equal((await on(t.ctx.deps, ...readArgs("finished"))).code, 0);
    assert.equal(asks.length, 2);
    assert.ok(t.waits.includes(AGAIN_MS));
    assert.equal(reread(found).reading.outcome, "read");
    t.done();
  });
  it("never puts the account in its log or its result", async () => {
    const { t } = reading("finished");
    const r = await on(t.ctx.deps, ...readArgs("finished"));
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.text + readFileSync(resultFile(t.home, FOLDER, "read"), "utf8"), /sallie@example\.com/);
    t.done();
  });
  it("refuses --kind session for a video that is not one", async () => {
    const { t, asks } = reading("finished");
    const r = await on(t.ctx.deps, ...readArgs("session"));
    assert.equal(r.code, 1);
    assert.deepEqual([asks.length, readResult(t.home, FOLDER, "read").failed], [0, [`${NAME} is no longer answered as a client or group session, so Claude did not read it. Nothing was changed.`]]);
    t.done();
  });
});

// --- Plan R1c: a raw reading starts at once when this Mac's own late check of the import is still to come, and takes the files it
// replaces out of that check, under the lock the check also takes ---

const mineAlive = (pid) => pid === process.pid;
/** What the light import's late check names for the made-up episode: the video, its captions, its transcript, its words and the four
    files a raw reading replaces, and its first record, each with a work copy in `t.work` as the import made it. Writes this Mac's
    pending check (over: `over`), and gives back its entries. */
function lightPending(t, found, over = {}) {
  const names = [VIDEO, "Pricing talk.srt", "Pricing talk.transcript.txt", "Pricing talk.words.json", "Pricing talk.cut-plan.json", "Pricing talk.cut-plan.txt", "Pricing talk.rough-cut.srt", "Pricing talk.rough-cut.transcript.txt", "record/0001.json"];
  const entries = names.map((rel) => {
    const from = join(t.work, rel.replace("/", "~"));
    writeFileSync(from, readFileSync(join(found.folder, rel)));
    return { from, to: join(found.folder, rel), bytes: statSync(from).size };
  });
  pendingFor(t, found, { work: t.work, drop: join(t.work, "drop.mp4"), entries, ...over });
  return entries;
}
const REPLACED_BY_RAW = ["Pricing talk.cut-plan.json", "Pricing talk.cut-plan.txt", "Pricing talk.rough-cut.srt", "Pricing talk.rough-cut.transcript.txt"];
const readPendingsOf = (t) => readPendings(t.home).find((p) => p.id === ID);
const lockOfCheck = (t) => lateCheckLockOf(t.home, FOLDER);

describe("a raw reading starts at once while this Mac's own late check is to come (R1c)", () => {
  it("16. reads at once, with no look at the import, and takes the files it replaced out of the check, which then passes and leaves the reading's files as they are", async () => {
    const { t, found, asks } = reading("raw");
    const entries = lightPending(t, found);
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(asks.length, 1);
    assert.ok(!t.waits.includes(READ_LOOK_MS), "no look at the import");
    const pending = readPendingsOf(t);
    assert.deepEqual(pending.entries, entries.filter((e) => !REPLACED_BY_RAW.some((n) => e.to.endsWith(n))));
    assert.deepEqual(pending.entries.map((e) => basename(e.to)).sort(), ["0001.json", "Pricing talk.mp4", "Pricing talk.srt", "Pricing talk.transcript.txt", "Pricing talk.words.json"]);
    assert.equal("reading" in pending, false);
    assert.equal(existsSync(lockOfCheck(t)), false);
    const reads = snapshot(found);
    const done = finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, log: () => {} });
    assert.equal(done.ok, true, done.problems.join(" | "));
    assert.deepEqual(snapshot(found), reads, "each file the reading put in is still the reading's, byte for byte");
    t.done();
  });
  it("17. holds the late check's lock while it puts its files in", async () => {
    const { t, found } = reading("raw");
    lightPending(t, found);
    t.ctx.deps.alive = mineAlive;
    const clone = t.ctx.deps.clone;
    const asked = [];
    t.ctx.deps.clone = (from, to) => {
      if (to.startsWith(found.folder) && !asked.length) asked.push(takeLateCheckLock(t.home, FOLDER, "late check", mineAlive));
      clone(from, to);
    };
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(asked, [null]);
    t.done();
  });
  it("18. puts its files in as before, with no lock and no mark, when the import's check is made while Claude reads", async () => {
    const { t, found, asks } = reading("raw");
    lightPending(t, found);
    claudeDoing(t, RAW_REPLY, asks, { then: () => checkMade(t) });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).rev, 2);
    assert.equal(readPendingsOf(t), undefined);
    assert.equal(existsSync(lockOfCheck(t)), false);
    t.done();
  });
  it("19. puts nothing in, and says the problem and the kept rough cut, when the import's check finds a problem while Claude reads", async () => {
    const { t, found, asks } = reading("raw");
    const entries = lightPending(t, found);
    const PROBLEM = "Pricing talk.srt is not whole in Dropbox.";
    claudeDoing(t, RAW_REPLY, asks, { then: () => pendingFor(t, found, { work: t.work, entries, problem: PROBLEM }) });
    const before = snapshot(found);
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual(snapshot(found), before);
    const result = readResult(t.home, FOLDER, "read");
    assert.deepEqual(result.failed, [
      `The late check of this episode's import found a problem: ${PROBLEM} Once it is put right, say "try it again" for ${VIDEO} on Mac Studio, then say this again.`,
      `The rough cut of ${NAME} is kept on this Mac, in BRIMM Video Work, as "${basename(renderOf(t))}".`
    ]);
    assert.equal(existsSync(lockOfCheck(t)), false);
    assert.equal("reading" in readPendingsOf(t), false);
    t.done();
  });
  it("20. leaves the import's check as it was when a put fails half-way", async () => {
    const { t, found } = reading("raw");
    const entries = lightPending(t, found);
    const clone = t.ctx.deps.clone;
    let n = 0;
    t.ctx.deps.clone = (from, to) => {
      if (to.startsWith(found.folder) && (n += 1) === 3) throw new Error("the disk said no");
      clone(from, to);
    };
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.equal(reread(found).rev, 1);
    assert.deepEqual(readPendingsOf(t).entries, entries);
    assert.equal("reading" in readPendingsOf(t), false);
    assert.equal(existsSync(lockOfCheck(t)), false);
    t.done();
  });
  it("21. waits as today when a file is not as the import filed it, and reads once it is", async () => {
    const { t, found, asks } = reading("raw");
    lightPending(t, found);
    const srt = join(found.folder, "Pricing talk.srt");
    writeFileSync(srt, "short");
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      assert.equal(asks.length, 0);
      writeFileSync(srt, LIGHT_FILES["Pricing talk.srt"]);
      checkMade(t);
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([looks, asks.length], [1, 1]);
    t.done();
  });
});
