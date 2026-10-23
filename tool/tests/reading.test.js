// Claude's reading of a video, once Sallie has said what it is (spec 2026-10-22, section 2, "What the answer does" and "The one
// Claude call", and section 3): `kind` starts it detached as `read --now <folder> --kind <kind> --rev <rev>`, and the run asks
// Claude once with that kind's request, then writes what it read by the rule. A finished video gets Reel suggestions and
// spellings; a raw one gets cut decisions, notes, graphic ideas, Reel suggestions and spellings, and its rough cut rendered as
// version 0; an iPhone clip gets spellings and a line on what it is. A session is read only for its teachings (a later step).
// Then reels.json at version 2, whose candidates have no crops yet, and the readers that need crops, which refuse one.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and Claude, ffprobe, ffmpeg,
// QuickTime Player and the notice are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { localStamp, recordFile, recordText } from "../episode.js";
import { episodeWork, pendingFolder } from "../settings.js";
import { readResult, resultFile } from "../detached.js";
import { writePending } from "../filing.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, roughCaptions, keptSpans, roughCutArgs, streamsOf } from "../cuts.js";
import { applyDecisions } from "../notes.js";
import { requestFor } from "../readings.js";
import { stretchesOf } from "../reframe.js";
import { CLAUDE_MODEL } from "../unedited.js";
import { readReels, reelsFile, previewSteps, REELS_VERSION } from "../reels.js";
import { READ_LOOK_MS } from "../reading.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { sessionLabel } from "../kinds.js";
import { TOLD, PAUSES, SRT, probed } from "./fixtures.js";
import { setup, episodeFor, episodeAs, reread, listAll, FOLDER, ID } from "./episodes.js";
import { rawProbe } from "./phase4.js";

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
  if (args[0] === "auth") return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
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
  graphics: [{ id: "p7", idea: "A chart of what it costs" }],
  clips: [{ from: "p4", to: "p5", hook: "What this is about", why: "It says what the talk is about.", point: "Pricing is the subject." }],
  spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }]
};
const CLIP_REPLY = { spellings: [{ heard: "Sally", spelled: "Sallie", why: "It is her name." }], about: "A clip about knowing your costs." };
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
const calls = (t) => t.calls.filter((c) => c.cmd === "CLAUDE" && c.args[0] !== "auth");

/** The renders folder of the made-up episode on this Mac, and the rough cut's file there. */
const renderOf = (t) => join(episodeWork(t.home, FOLDER), "renders", `${NAME} – version 0.mp4`);

// The words a person reads.
const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
const SESSION_LATER = "A session is read only for its teachings, which come in a later step.";
const NOTICE = `Claude has read ${NAME}: say "what did Claude find?"`;
const NOT_MADE = (n) => `Reel ${n} is not made yet: say "make Reel ${n}" first.`;

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
    t.ctx.deps.run = async (cmd, args, asked) => (cmd === "CLAUDE" && args[0] === "auth" ? { code: 1, stderr: "not signed in", stdout: "" } : claude(cmd, args, asked));
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
    assert.deepEqual(plan.claude.graphics, RAW_REPLY.graphics);
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
  it("waits, asking and replacing nothing, while the import's late check still holds the video, and reads it once the check is made", async () => {
    const { t, found, asks } = reading("raw");
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: VIDEO, bytes: 13, seconds: 23.423, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "Pricing talk.cut-plan.txt" });
    const before = snapshot(found);
    let looks = 0;
    onWaits(t, READ_LOOK_MS, () => {
      looks += 1;
      assert.deepEqual(snapshot(found), before, `look ${looks}: nothing is replaced while the late check holds it`);
      assert.deepEqual(asks, [], `look ${looks}: Claude is not asked yet`);
      // The import makes its late check at the third look, and takes its pending check away.
      if (looks === 3) rmSync(join(pendingFolder(t.home), `${ID}.json`));
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
    onWaits(t, READ_LOOK_MS, () => {
      // She said it is finished after all, on this Mac, and the import made its late check.
      writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, kind: "finished" }));
      rmSync(join(pendingFolder(t.home), `${ID}.json`), { force: true });
    });
    const r = await on(t.ctx.deps, ...readArgs("raw"));
    assert.equal(r.code, 1);
    assert.deepEqual([asks, reread(found).rev], [[], 2]);
    assert.match(readResult(t.home, FOLDER, "read").failed[0], /^Pricing talk is no longer answered as raw with retakes, so Claude did not read it\./);
    t.done();
  });
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
  it("a session, which is read only for its teachings, in a later step, and whose files are never named", async () => {
    const session = sessionLabel("2026-10-14");
    const { t, found } = reading("finished", { over: { kind: "session", name: { text: session, placeholder: false }, session: { marked: AT, on: "Mac Studio", teachings: "asked", cleared: null }, editing: null } });
    const deps = { ...t.ctx.deps, settings: { ...t.ctx.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: ACCOUNT, app: ACCOUNT } } } };
    for (const kind of ["session", "finished"]) {
      const result = await refused(t, found, readArgs(kind), SESSION_LATER, deps);
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
      const result = readFileSync(resultFile(t.home, FOLDER, "read"), "utf8");
      for (const what of [r.text, result]) {
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
  it("reel pick", async () => {
    const { t, found } = listed("candidate");
    const r = await on(t.ctx.deps, "reel", "pick", FOLDER, "3");
    assert.deepEqual([r.code, r.said], [1, [NOT_MADE(3)]]);
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
});
