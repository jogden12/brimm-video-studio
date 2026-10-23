// The spellings card, and the hand-off that follows it (spec 2026-10-22, section 3, "Finished by the editor" and "iPhone clip"):
// after the reading (F5), a finished video or an iPhone clip holds Claude's spelling offers in its record. `spell … offers`
// shows them as one numbered card, and takes the answer: all, some or none. Once they are answered, none included, the hand-off
// is written, version 2, into final/, in the shape `finish` writes (record.finished, and the transcripts in final/), with no
// Final Cut, no render and no transcriber; a later `spell` remakes it as the next revision. With this Mac's settings at
// handoff version 1 the answer is kept and the hand-off waits for the switch. A raw video's answer is kept and nothing is
// written. `spell … add` takes several pairs at once, written as one change.
// Nothing here runs a real program or touches Dropbox: Claude Code, ffprobe, ffmpeg, the transcriber, QuickTime Player, the
// notice and `open` are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { localStamp, recordFile } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, roughCaptions, keptSpans, planText } from "../cuts.js";
import { TOLD, PAUSES } from "./fixtures.js";
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
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
const VIDEO = "Pricing talk.mp4";
const NAME = "Pricing talk";
const HANDOFF = "Pricing talk.brimm-ops.json";
const HEARD = pausesOf(PAUSES);
const WORDS = wordsOf(TOLD);
const RULES = cutPlan(phrasesOf(WORDS, HEARD), { duration: 23.423, pauses: HEARD });
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
const PLAN = { version: 1, video: VIDEO, facts: FACTS, phrases: RULES.phrases, ranges: RULES.ranges, kept: RULES.kept, cut: RULES.cut, pauses: HEARD, by: "rules" };
/** The captions the import wrote of the recording: the transcriber's own pass, with the show's names spelled (unedited.js
    spellNames), so it holds the words Claude offers to spell. */
const IMPORT_SRT = "1\n00:00:06,070 --> 00:00:07,040\n Welcome to the show.\n\n2\n00:00:19,414 --> 00:00:21,097\n Thank you so much, Sallie Ogdin.\n\n3\n00:00:21,200 --> 00:00:23,000\n Pricing is the subject, and pricing needs costs.\n\n";
/** The files a light import puts in the episode's folder. */
const LIGHT_FILES = {
  [VIDEO]: "the raw video",
  "Pricing talk.cut-plan.json": JSON.stringify(PLAN, null, 2) + "\n",
  "Pricing talk.cut-plan.txt": planText(RULES, "The times here are the recording's own, from its start.\nThis plan is the rules' alone: Claude has not read it."),
  "Pricing talk.words.json": JSON.stringify({ video: VIDEO, duration: 23.423, words: WORDS }, null, 2) + "\n",
  "Pricing talk.srt": IMPORT_SRT,
  "Pricing talk.transcript.txt": "the transcript",
  "Pricing talk.rough-cut.srt": roughCaptions(RULES.phrases, keptSpans(RULES.ranges, FACTS.fps)),
  "Pricing talk.rough-cut.transcript.txt": "the rough cut's transcript"
};
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const answered = (kind, over = {}) => ({ version: 3, kind, answer: ANSWERED, label: LABEL, editing: { by: "Mac Studio", since: AT }, ...over });

const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
/** Claude Code as a stand-in: `claude auth status` says the account, and a call prints `reply` as its result. */
const claudeOf = (reply) => (args) => {
  if (args.includes("auth")) return { code: 0, stderr: "", stdout: JSON.stringify(STATUS) };
  return { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(reply) }) };
};

/** What Claude replies for a finished video: three suggestions, the third with no reason to give, and three spellings, the
    second of which cannot be kept (it is spelled that way already). */
const SPELLINGS = [
  { heard: "Ogdin", spelled: "Ogden", why: "It is her surname." },
  { heard: "Sallie", spelled: "Sallie", why: "Already right." },
  { heard: "pricing", spelled: "Pricing", why: "It is the subject." }
];
const FINISHED_REPLY = {
  suggestions: [
    { from: "p4", to: "p9", first: "Welcome to the show", last: "so much, Sallie Ogdin", why: "It is the whole talk in brief.", point: "Know what it costs you." },
    { from: "p7", to: "p8", first: "So the first thing", last: "very, very important", why: "It makes one point.", point: "Costs come first." },
    { from: "p5", to: "p6", first: "", last: "", why: "", point: "A reason is missing." }
  ],
  spellings: SPELLINGS
};
const CLIP_REPLY = { spellings: SPELLINGS, about: "A clip about knowing your costs." };
const REPLIES = { finished: FINISHED_REPLY, "short video": CLIP_REPLY };

/** This Mac's settings say which version of the hand-off to write. */
function handoffVersion(t, version) {
  writeSettings(t.home, { handoffVersion: version });
  t.ctx.settings = { ...t.ctx.settings, handoffVersion: version };
}

/** A Mac with the made-up recording imported lightly, answered as `kind`, and read by the real `read` with Claude as a stand-in:
    its record then holds the offers. `version` is this Mac's hand-off version (none when null). The calls made so far are
    forgotten, so that what a test then sees is what it did. */
async function readOf(kind, { version = 2, over = {}, reply = REPLIES[kind], files = LIGHT_FILES } = {}) {
  const t = setup({ programs: { FFPROBE: rawProbe, CLAUDE: claudeOf(reply) } });
  t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  t.ctx.deps.notify = () => {};
  if (version) handoffVersion(t, version);
  const found = episodeFor(t, { record: answered(kind, over), files });
  const r = await on(t.ctx.deps, "read", "--now", FOLDER, "--kind", kind, "--rev", String(found.record.rev));
  assert.equal(r.code, 0, r.text);
  assert.ok(reread(found).offers, "the reading left its offers in the record");
  t.calls.length = 0;
  return { t, found };
}

/** A raw video, read: the record holds the reading's offers, as F5 leaves them, and no plan was made of them here. */
function rawRead({ version = 2, over = {} } = {}) {
  const t = setup({ programs: { FFPROBE: rawProbe } });
  if (version) handoffVersion(t, version);
  const found = episodeFor(t, { record: answered("raw", { offers: { spellings: SPELLINGS }, reading: { kind: "raw", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read" }, ...over }), files: LIGHT_FILES });
  return { t, found };
}

// What a person reads.
const CARD_TAIL = 'Say which to apply: "all", "none", or their numbers, as in 1 3.';
const OGDEN = '"Ogdin" as "Ogden"';
const PRICING = '"pricing" as "Pricing"';
const SAME_FAULT = '"Sallie" is spelled that way already.';
const WAITS = "The hand-off is written once this Mac hands off version 2: ask Jason.";
/** What a finished video's first hand-off says of the suggestion Claude gave no reason for. */
const LEFT3 = "Suggestion 3 is left out of the hand-off: it has no reason.";
const WRITTEN = (n) => `The hand-off is written as revision ${n} and shown in Finder: drop it on the BRIMM Ops page.`;

/** One of the contract's fixtures, which BRIMM Ops keeps a copy of. */
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/handoff-v2-${name}.json`, import.meta.url), "utf8"));
/** The hand-off a spell wrote into final/. */
const handoffIn = (found) => JSON.parse(readFileSync(join(found.folder, "final", HANDOFF), "utf8"));
/** What a file in the episode's folder holds. */
const text = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
/** Every file in Episodes, with its size and time: what a refusal leaves as it was. */
const tree = (t) => listAll(join(t.root, "Episodes")).map((rel) => [rel, statSync(join(t.root, "Episodes", rel)).size, statSync(join(t.root, "Episodes", rel)).mtimeMs]);
/** The programs the hand-off must not have needed. */
const programs = (t) => t.calls.map((c) => c.cmd);

describe("spell … offers, with no answer: the card", () => {
  it("prints Claude's offers as one numbered card, marks the one that cannot be kept, and writes and runs nothing", async () => {
    const { t, found } = await readOf("finished");
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [
      `Claude offers these spellings for ${NAME}:`,
      '1. "Ogdin" as "Ogden": It is her surname.',
      `2. "Sallie" as "Sallie" cannot be kept. ${SAME_FAULT}`,
      '3. "pricing" as "Pricing": It is the subject.',
      CARD_TAIL
    ]);
    assert.deepEqual(tree(t), before);
    assert.deepEqual(t.calls, []);
    assert.equal(reread(found).spellings.length, 0);
    t.done();
  });
  it("numbers each offer by its place in the record, so that a spelling added meanwhile changes no number", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden Smith")).code, 0);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.match(r.said[1], /^1\. "Ogdin" as "Ogden" cannot be kept\. You have "Ogdin" spelled "Ogden Smith" already\.$/);
    assert.match(r.said[3], /^3\. "pricing" as "Pricing"/);
    assert.equal(reread(found).offers.answered, undefined);
    t.done();
  });
  it("says so when Claude offered none, and that answering none goes on", async () => {
    const { t } = await readOf("finished", { reply: { ...FINISHED_REPLY, spellings: [] } });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.deepEqual(r.said, [`Claude offered no spellings for ${NAME}.`, "Answer none to go on."]);
    t.done();
  });
  it("says that Claude has not read the video yet, for one with no reading", async () => {
    const t = setup();
    const found = episodeFor(t, { record: answered("finished"), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.deepEqual([r.code, r.text], [1, `Claude has not read ${NAME} yet, so it has offered no spellings.`]);
    assert.equal(reread(found).rev, found.record.rev);
    t.done();
  });
  it("is refused by the gate for a video not yet answered, by its label, before it says a word of the video", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide", came: "camera", match: null }, label: LABEL, offers: { spellings: SPELLINGS } }, files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.deepEqual([r.code, r.text], [1, "This video is waiting for its answer: say what it is first."]);
    t.done();
  });
  it("is refused for a session whose mark she cleared, in the words finish uses, before a file is looked at", async () => {
    const t = setup();
    const CLEARED = { marked: AT, on: "Mac Studio", teachings: null, cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } };
    episodeFor(t, { record: answered("session", { name: { text: "Session, 2026-10-14", placeholder: false }, session: CLEARED, offers: { spellings: SPELLINGS }, reading: { kind: "session", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read" } }), files: LIGHT_FILES });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.deepEqual([r.code, r.text], [1, "Session, 2026-10-14 is a client or group session: brimm-video cannot finish a session yet. Nothing was written."]);
    t.done();
  });
});

describe("spell … offers none, for a finished video, with this Mac handing off version 2", () => {
  it("writes the hand-off once, version 2, kind finished, in the shape finish writes, with no Final Cut, no render and no transcriber", async () => {
    const { t, found } = await readOf("finished");
    const rev = reread(found).rev;
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `No spelling applied. ${LEFT3} ${WRITTEN(1)}`);
    const handoff = handoffIn(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([handoff.format, handoff.version, handoff.revision, handoff.madeOn, handoff.madeBy], ["brimm-video hand-off", 2, 1, "Mac Studio", "brimm-video c709b57"]);
    assert.deepEqual(handoff.video, { id: ID, kind: "finished", name: NAME, recorded: "2026-10-14", recordedFrom: "video" });
    // The main video is the dropped file, its length, and the import's captions as they are.
    assert.deepEqual(handoff.main, { file: VIDEO, seconds: 23.423, srt: IMPORT_SRT });
    assert.deepEqual(handoff.reels, []);
    assert.equal(handoff.session, null);
    assert.equal("title" in handoff.video || "episode" in handoff, false);
    // Its keys are the contract's, in the contract's order.
    const contract = fixture("finished");
    assert.deepEqual([Object.keys(handoff), Object.keys(handoff.video), Object.keys(handoff.main), Object.keys(handoff.suggestions[0]), Object.keys(handoff.suggestions[0].stretches[0])], [Object.keys(contract), Object.keys(contract.video), Object.keys(contract.main), Object.keys(contract.suggestions[0]), Object.keys(contract.suggestions[0].stretches[0])]);
    // finish's shape: the transcripts beside the hand-off in final/, and the record says what was finished.
    assert.deepEqual(listAll(join(found.folder, "final")), [HANDOFF, "Pricing talk.srt", "Pricing talk.transcript.txt"]);
    assert.equal(text(found, "final/Pricing talk.srt"), IMPORT_SRT);
    assert.match(text(found, "final/Pricing talk.transcript.txt"), /^\[0:06\] /);
    const record = reread(found);
    assert.deepEqual(record.finished, {
      revision: 1, at: localStamp(new Date(t.now())), on: "Mac Studio", handoff: `final/${HANDOFF}`,
      parts: { main: { v: 0, file: "final/Pricing talk.mp4", bytes: found.record.video.bytes, seconds: 23.423, spellings: [], noHandEdits: true, import: true } }
    });
    for (const rel of [HANDOFF, "Pricing talk.srt", "Pricing talk.transcript.txt"]) assert.equal(record.files[`final/${rel}`], statSync(join(found.folder, "final", rel)).size, rel);
    assert.deepEqual(record.spellings, []);
    assert.equal(record.offers.answered.reading, record.reading.at);
    assert.deepEqual([record.offers.answered.applied, record.offers.answered.left, record.offers.answered.on], [[], ["Ogdin", "Sallie", "pricing"], "Mac Studio"]);
    assert.equal(record.rev, rev + 1, "one record for the answer");
    // Shown in Finder through the program runner, and nothing else run: no ffmpeg, no ffprobe, no transcriber, no Claude.
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(found.folder, "final", HANDOFF)] }]);
    assert.deepEqual(t.opened, []);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("gives the suggestions in seconds on the file's clock, one stretch each, and leaves out one with no reason, saying so", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    const handoff = handoffIn(found);
    const reels = JSON.parse(text(found, "reels.json"));
    assert.deepEqual(reels.candidates.map((c) => c.n), [1, 2, 3]);
    assert.deepEqual(handoff.suggestions, reels.candidates.slice(0, 2).map((c) => ({
      n: c.n, start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100, stretches: [{ start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100 }],
      first: c.first, last: c.last, why: c.reason, point: c.point
    })));
    assert.match(r.text, /Suggestion 3 is left out of the hand-off: it has no reason\./);
    assert.deepEqual(handoff.suggestions.map((x) => x.n), [1, 2]);
    t.done();
  });
  it("leaves the video, its plan and its reels.json as they were", async () => {
    const { t, found } = await readOf("finished");
    const before = Object.fromEntries(listAll(found.folder).filter((rel) => !rel.startsWith("record/")).map((rel) => [rel, text(found, rel)]));
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    for (const [rel, was] of Object.entries(before)) assert.equal(text(found, rel), was, rel);
    t.done();
  });
  it("lets go the claim this Mac took for the reading, as finish does", async () => {
    const { t, found } = await readOf("finished");
    assert.equal(reread(found).editing.by, "Mac Studio");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    assert.equal(reread(found).editing, null);
    t.done();
  });
});

describe("spell … offers all, or some, for a finished video", () => {
  it("applies every offer that can be kept, says why the other cannot, and writes the hand-off with the spellings in its captions and suggestions", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN} and ${PRICING}. Not kept: ${SAME_FAULT} ${LEFT3} ${WRITTEN(1)}`);
    const record = reread(found);
    assert.deepEqual(record.spellings, [["Ogdin", "Ogden"], ["pricing", "Pricing"]]);
    assert.deepEqual([record.offers.answered.applied, record.offers.answered.left], [["Ogdin", "pricing"], ["Sallie"]]);
    const handoff = handoffIn(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.match(handoff.main.srt, /Thank you so much, Sallie Ogden\./);
    assert.match(handoff.main.srt, /Pricing is the subject, and Pricing needs costs\./);
    assert.doesNotMatch(handoff.main.srt, /Ogdin|pricing/);
    assert.equal(text(found, "final/Pricing talk.srt"), handoff.main.srt);
    assert.match(text(found, "final/Pricing talk.transcript.txt"), /Ogden/);
    // The suggestion that closed on "Ogdin" closes on "Ogden".
    assert.equal(handoff.suggestions[0].last, "so much, Sallie Ogden");
    assert.deepEqual(record.finished.parts.main.spellings, [["Ogdin", "Ogden"], ["pricing", "Pricing"]]);
    t.done();
  });
  it("applies the offers whose numbers are named, and leaves the rest", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "3");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Spelled now, in every caption: ${PRICING}. ${LEFT3} ${WRITTEN(1)}`);
    assert.deepEqual(reread(found).spellings, [["pricing", "Pricing"]]);
    assert.deepEqual(reread(found).offers.answered.left, ["Ogdin", "Sallie"]);
    assert.match(handoffIn(found).main.srt, /Thank you so much, Sallie Ogdin\./);
    t.done();
  });
  it("takes the numbers as separate words or with commas, in any order, each once, and applies them in the card's order", async () => {
    for (const words of [["3", "1"], ["1,", "3"], ["1,3"], ["3", "1", "1"]]) {
      const { t, found } = await readOf("finished");
      const r = await on(t.ctx.deps, "spell", FOLDER, "offers", ...words);
      assert.equal(r.code, 0, `${words.join(" ")}: ${r.text}`);
      assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden"], ["pricing", "Pricing"]], words.join(" "));
      t.done();
    }
  });
  it("refuses, writing nothing, a number that is not an offer, a number whose offer cannot be kept, and words that are not an answer", async () => {
    const { t, found } = await readOf("finished");
    const before = tree(t);
    const says = [
      [["4"], "There is no offer 4: the offers are 1 to 3."],
      [["0"], 'Say which to apply: "all", "none", or their numbers, as in 1 3.'],
      [["1", "7"], "There is no offer 7: the offers are 1 to 3."],
      [["2"], `Offer 2 cannot be kept. ${SAME_FAULT} Nothing was written.`],
      [["some"], 'Say which to apply: "all", "none", or their numbers, as in 1 3.'],
      [["all", "1"], 'Say which to apply: "all", "none", or their numbers, as in 1 3.'],
      [["none", "2"], 'Say which to apply: "all", "none", or their numbers, as in 1 3.']
    ];
    for (const [words, says_] of says) {
      const r = await on(t.ctx.deps, "spell", FOLDER, "offers", ...words);
      assert.deepEqual([r.code, r.text], [1, says_], words.join(" "));
      assert.deepEqual(tree(t), before, `${words.join(" ")}: nothing was written`);
    }
    assert.deepEqual(t.calls, []);
    assert.equal(reread(found).offers.answered, undefined);
    t.done();
  });
  it("keeps her own spelling of a word, and does not use Claude's offer for it", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden Smith")).code, 0);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /Not kept: You have "Ogdin" spelled "Ogden Smith" already\. "Sallie" is spelled that way already\./);
    assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden Smith"], ["pricing", "Pricing"]]);
    t.done();
  });
});

describe("spell … offers, once answered", () => {
  it("shows the answer on the card, and refuses a second answer, writing nothing", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "1")).code, 0);
    const before = tree(t);
    const card = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.equal(card.code, 0);
    assert.deepEqual(card.said, [
      `Claude's spellings for ${NAME} were answered on ${localStamp(new Date(t.now())).slice(0, 16).replace("T", " ")}:`,
      '1. "Ogdin" as "Ogden": applied.',
      '2. "Sallie" as "Sallie": left.',
      '3. "pricing" as "Pricing": left.'
    ]);
    const again = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.deepEqual([again.code, again.text], [1, `The spellings Claude offered for ${NAME} were answered already. To spell a word another way, say it with spell add; to take one back, spell drop.`]);
    assert.deepEqual(tree(t), before);
    assert.equal(handoffIn(found).revision, 1);
    t.done();
  });
});

describe("spell … offers, after a reading made again", () => {
  it("shows the offers of the new reading as not yet answered, since an answer is of one reading", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "1")).code, 0);
    // The video is read again (F9 sets the old reading aside): the record holds a reading of another moment and its own offers.
    const now = reread(found);
    writeFileSync(recordFile(found.folder, now.rev + 1), JSON.stringify({ ...now, rev: now.rev + 1, finished: null, reading: { ...now.reading, at: "2026-10-21T10:00:00-05:00" }, offers: { ...now.offers, spellings: [SPELLINGS[2]] } }));
    const card = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.deepEqual(card.said, [`Claude offers these spellings for ${NAME}:`, '1. "pricing" as "Pricing": It is the subject.', CARD_TAIL]);
    t.done();
  });
});

describe("a later spell, once the hand-off is written", () => {
  it("remakes it as the next revision, in the shape saveSpellings gives it, with the spelling in the final transcripts", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    t.calls.length = 0;
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Ogdin" is spelled "Ogden" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again.');
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.revision, handoff.video.id, handoff.video.kind, handoffFaultV2(handoff)], [2, ID, "finished", ""]);
    assert.match(handoff.main.srt, /Thank you so much, Sallie Ogden\./);
    assert.equal(handoff.suggestions[0].last, "so much, Sallie Ogden");
    assert.equal(text(found, "final/Pricing talk.srt"), handoff.main.srt);
    const record = reread(found);
    assert.equal(record.finished.revision, 2);
    assert.deepEqual(record.finished.parts.main.spellings, [["Ogdin", "Ogden"]]);
    t.done();
  });
  it("takes a dropped spelling out of the final transcripts, since the import's captions are still there to make them from", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "1")).code, 0);
    assert.match(handoffIn(found).main.srt, /Ogden/);
    const r = await on(t.ctx.deps, "spell", FOLDER, "drop", "Ogdin");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Ogdin" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again.');
    const handoff = handoffIn(found);
    assert.equal(handoff.revision, 2);
    assert.equal(handoff.main.srt, IMPORT_SRT);
    assert.equal(text(found, "final/Pricing talk.srt"), IMPORT_SRT);
    assert.equal(handoff.suggestions[0].last, "so much, Sallie Ogdin");
    assert.deepEqual(reread(found).finished.parts.main.spellings, []);
    t.done();
  });
  it("changes a spelling in the final transcripts to the new one", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "1")).code, 0);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden Jr")).code, 0);
    assert.match(handoffIn(found).main.srt, /Thank you so much, Sallie Ogden Jr\./);
    assert.doesNotMatch(handoffIn(found).main.srt, /Ogdin|Ogden\./);
    assert.equal(handoffIn(found).revision, 2);
    t.done();
  });
});

describe("a later spell that changes none of the hand-off's words", () => {
  it("records the spelling and leaves the hand-off as it is, at its revision, and shows nothing again", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    const handoff = text(found, `final/${HANDOFF}`);
    const rev = reread(found).rev;
    t.calls.length = 0;
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "zzz", "Zzz");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"zzz" is spelled "Zzz" now, in every caption. The final transcripts and the hand-off are as they were.');
    assert.equal(text(found, `final/${HANDOFF}`), handoff);
    const record = reread(found);
    assert.deepEqual([record.rev, record.finished.revision, record.spellings, record.finished.parts.main.spellings], [rev + 1, 1, [["zzz", "Zzz"]], []]);
    assert.deepEqual(t.calls, []);
    t.done();
  });
});

describe("spell … add, with several pairs", () => {
  it("writes them as one change: one record, and, after the hand-off, one revision", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    const rev = reread(found).rev;
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "pricing", "Pricing", "costs", "Costs");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, 'Spelled now, in every caption: "Ogdin" as "Ogden", "pricing" as "Pricing" and "costs" as "Costs". The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again.');
    assert.equal(reread(found).rev, rev + 1, "one record for the three");
    assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden"], ["pricing", "Pricing"], ["costs", "Costs"]]);
    assert.equal(handoffIn(found).revision, 2, "one revision for the three");
    assert.match(handoffIn(found).main.srt, /Sallie Ogden\./);
    assert.match(handoffIn(found).main.srt, /needs Costs\./);
    t.done();
  });
  it("takes each pair after its own \"add\" too, as the command line is written", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "add", "pricing", "Pricing");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden"], ["pricing", "Pricing"]]);
    t.done();
  });
  it("keeps the last of two pairs for one word", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "Ogdin", "Ogden O")).code, 0);
    assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden O"]]);
    t.done();
  });
  it("refuses all of them, writing nothing, when one cannot be kept, saying which", async () => {
    const { t, found } = await readOf("finished");
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "two words", "Two Words", "pricing", "Pricing");
    assert.deepEqual([r.code, r.text], [1, '"two words" is not one word. Say the one word as the transcriber writes it.']);
    assert.deepEqual(tree(t), before);
    const odd = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "pricing");
    assert.deepEqual([odd.code, odd.text], [1, 'Say how "pricing" is spelled, in one to four words.']);
    assert.deepEqual(tree(t), before);
    t.done();
  });
  it("keeps a single pair's words for a raw video as they were", async () => {
    const { t } = rawRead();
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.equal(r.text, '"Ogdin" is spelled "Ogden" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.');
    const many = await on(t.ctx.deps, "spell", FOLDER, "add", "pricing", "Pricing", "costs", "Costs");
    assert.equal(many.text, 'Spelled now, in every timeline\'s captions: "pricing" as "Pricing" and "costs" as "Costs". Say "show it in Final Cut" to see it.');
    t.done();
  });
  it("before the offers are answered, only records them: no hand-off", async () => {
    const { t, found } = await readOf("finished");
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden", "pricing", "Pricing");
    assert.equal(r.code, 0, r.text);
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.equal(reread(found).finished, null);
    assert.deepEqual(t.calls, []);
    t.done();
  });
});

describe("spell … offers, for an iPhone clip", () => {
  it("writes the hand-off, kind short video, with its main video and no suggestions and no Reels", async () => {
    const { t, found } = await readOf("short video");
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. ${WRITTEN(1)}`);
    const handoff = handoffIn(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(handoff.video, { id: ID, kind: "short video", name: NAME, recorded: "2026-10-14", recordedFrom: "video" });
    assert.equal(handoff.main.file, VIDEO);
    assert.match(handoff.main.srt, /Sallie Ogden\./);
    assert.deepEqual(["suggestions" in handoff, "reels" in handoff, handoff.session], [false, false, null]);
    const contract = fixture("short-video");
    assert.deepEqual([Object.keys(handoff), Object.keys(handoff.video), Object.keys(handoff.main)], [Object.keys(contract), Object.keys(contract.video), Object.keys(contract.main).filter((key) => key !== "onPicture")]);
    assert.deepEqual(listAll(join(found.folder, "final")), [HANDOFF, "Pricing talk.srt", "Pricing talk.transcript.txt"]);
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(found.folder, "final", HANDOFF)] }]);
    t.done();
  });
});

describe("spell … offers, for a raw video", () => {
  it("records the spellings and the answer and writes no hand-off", async () => {
    const { t, found } = rawRead();
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. Its hand-off is made when it is finished.`);
    const record = reread(found);
    assert.deepEqual(record.spellings, [["Ogdin", "Ogden"]]);
    assert.deepEqual([record.offers.answered.applied, record.finished], [["Ogdin"], null]);
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.deepEqual(t.calls, []);
    t.done();
  });
});

describe("spell … offers, with this Mac handing off version 1", () => {
  it("records the spellings and the answer, says the hand-off waits for the switch, and writes nothing in final/", async () => {
    for (const version of [1, null]) {
      const { t, found } = await readOf("finished", { version });
      const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
      assert.equal(r.code, 0, r.text);
      assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. ${WAITS}`);
      const record = reread(found);
      assert.deepEqual(record.spellings, [["Ogdin", "Ogden"]]);
      assert.deepEqual([record.offers.answered.applied, record.finished], [["Ogdin"], null]);
      assert.equal(existsSync(join(found.folder, "final")), false);
      assert.deepEqual(t.calls, []);
      // The card, asked for again, says what is still to come.
      const card = await on(t.ctx.deps, "spell", FOLDER, "offers");
      assert.equal(card.said[card.said.length - 1], WAITS);
      t.done();
    }
  });
  it("writes the hand-off at the first spell once this Mac hands off version 2, and again for the same answer", async () => {
    const { t, found } = await readOf("finished", { version: 1 });
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    assert.equal(existsSync(join(found.folder, "final")), false);
    handoffVersion(t, 2);
    const again = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(again.code, 0, again.text);
    assert.equal(again.text, `The spellings Claude offered for ${NAME} were answered already. ${LEFT3} ${WRITTEN(1)}`);
    assert.equal(handoffIn(found).revision, 1);
    assert.equal(reread(found).finished.revision, 1);
    t.done();
  });
  it("writes the hand-off with a spelling added after the switch, as the first", async () => {
    const { t, found } = await readOf("finished", { version: 1 });
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    handoffVersion(t, 2);
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `"Ogdin" is spelled "Ogden" now, in every caption. ${LEFT3} ${WRITTEN(1)}`);
    assert.match(handoffIn(found).main.srt, /Sallie Ogden\./);
    t.done();
  });
});

describe("spell … offers, where the hand-off would go", () => {
  const FIRST = "e-20261010-7c1d2e";
  const SHOWN = NAME;
  /** The first version, answered as finished, with a hand-off of version 2 for `id` at `revision` that gave `suggestions` and
      `reels`' numbers. */
  const firstCut = (t, { suggestions = [], reels = [], revision = 3, record = {} } = {}) => {
    const first = episodeAs(t, { id: FIRST, name: "2026-10-10 Pricing talk, first cut (Mac Studio)", record: { kind: "finished", ...record } });
    const handoff = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
    mkdirSync(join(first.folder, "final"), { recursive: true });
    writeFileSync(join(first.folder, "final", "Pricing talk, first cut.brimm-ops.json"), JSON.stringify({ ...handoff, revision, video: { ...handoff.video, id: FIRST }, suggestions, reels }, null, 2) + "\n");
    return first;
  };
  it("writes a new version's first hand-off under the first version's id, one above that folder's revision, and records it", async () => {
    const { t, found } = await readOf("finished", { over: { versionOf: FIRST } });
    const first = firstCut(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `No spelling applied. ${LEFT3} ${WRITTEN(4)}`);
    const handoff = handoffIn(found);
    assert.deepEqual([handoff.video.id, handoff.revision, handoffFaultV2(handoff)], [FIRST, 4, ""]);
    assert.deepEqual([reread(found).id, reread(found).finished.revision], [ID, 4], "the record keeps its own id, and the revision written");
    assert.ok(existsSync(first.folder));
    t.done();
  });
  it("refuses, by the video's name, when the first version's folder is not on this Mac, and writes nothing: no spelling, no record, no final/", async () => {
    const { t, found } = await readOf("finished", { over: { versionOf: FIRST } });
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.deepEqual([r.code, r.text], [1, `${SHOWN} is a new version of a video that is not on this Mac yet (${FIRST}). Wait for Dropbox to bring it over, then say it again. Nothing was written.`]);
    assert.deepEqual(tree(t), before);
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.deepEqual(reread(found).spellings, []);
    assert.equal(reread(found).offers.answered, undefined);
    assert.deepEqual(t.calls, []);
    t.done();
  });
  it("refuses when a version of the video is a client or group session, and writes nothing", async () => {
    const { t, found } = await readOf("finished", { over: { versionOf: FIRST } });
    firstCut(t, { record: { kind: "session" } });
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.deepEqual([r.code, r.text], [1, `${SHOWN} is a version of a client or group session: ask Jason. Nothing was written.`]);
    assert.deepEqual(tree(t), before);
    assert.equal(reread(found).offers.answered, undefined);
    t.done();
  });
  it("refuses a hand-off that would give a number again which another version's hand-off gave, and writes nothing", async () => {
    const { t, found } = await readOf("finished", { over: { versionOf: FIRST } });
    // The first version's hand-off gave suggestions 1 and 2, which the reading, made before it came, numbered again.
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
    firstCut(t, { suggestions: fixture.suggestions, reels: [] });
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.deepEqual([r.code, r.text], [1, `${SHOWN}'s hand-off would give suggestion 1 and suggestion 2 again: another version of the video gave those numbers already, and a number is never given twice within a video. Ask Jason. Nothing was written.`]);
    assert.deepEqual(tree(t), before);
    assert.deepEqual(reread(found).spellings, []);
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  it("still records the answer under version 1, whatever the chain: it asks for no chain", async () => {
    const { t, found } = await readOf("finished", { version: 1, over: { versionOf: FIRST } });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, new RegExp(WAITS.replace(/[.]/g, "\\.")));
    assert.ok(reread(found).offers.answered);
    t.done();
  });
});

describe("spell … offers, when the hand-off cannot be made or the record cannot be written", () => {
  it("writes nothing when the import left no captions in the episode", async () => {
    const { [`${NAME}.srt`]: gone, ...without } = LIGHT_FILES;
    const { t, found } = await readOf("finished", { files: without });
    const before = tree(t);
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.deepEqual([r.code, r.text], [1, `${NAME} has no captions from the import to hand off. Nothing was written.`]);
    assert.deepEqual(tree(t), before);
    assert.equal(reread(found).offers.answered, undefined);
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  it("starts Dropbox bringing over captions the record lists that are not on this Mac at all yet, and writes nothing", async () => {
    const { t, found } = await readOf("finished");
    rmSync(join(found.folder, "Pricing talk.srt"));
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.deepEqual([r.code, r.text], [1, "Dropbox is bringing the import's captions over to this Mac. Say it again when it is done. Nothing was changed."]);
    assert.equal(t.started.length, 1);
    assert.equal(reread(found).offers.answered, undefined);
    t.done();
  });
  it("starts Dropbox bringing the captions over, and writes nothing, when they are not whole here yet", async () => {
    const { t, found } = await readOf("finished");
    t.ctx.deps.isWhole = (path) => !path.endsWith("Pricing talk.srt");
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.deepEqual([r.code, r.text], [1, "Dropbox is bringing the import's captions over to this Mac. Say it again when it is done. Nothing was changed."]);
    assert.equal(t.started.length, 1);
    assert.equal(reread(found).offers.answered, undefined);
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  it("starts Dropbox bringing over the final transcripts a later spell is to replace, when they are not whole here, and changes nothing", async () => {
    const { t, found } = await readOf("finished");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "none")).code, 0);
    const before = tree(t);
    t.ctx.deps.isWhole = (path) => !path.endsWith("final/Pricing talk.srt");
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.deepEqual([r.code, r.text], [1, "Dropbox is bringing the import's captions over to this Mac. Say it again when it is done. Nothing was changed."]);
    assert.equal(t.started.length, 1);
    assert.deepEqual(tree(t), before);
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
  it("takes its files out of final/ again when the record cannot be written, and keeps no answer", async () => {
    const { t, found } = await readOf("finished");
    // The record is written meanwhile, as by another command: the save is refused.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(HANDOFF)) writeFileSync(join(found.folder, "record", `${String(reread(found).rev + 1).padStart(4, "0")}.json`), JSON.stringify({ ...reread(found), rev: reread(found).rev + 1 }));
    };
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /Nothing was written: this episode changed on the other Mac: open it again\./);
    assert.deepEqual(listAll(join(found.folder, "final")), []);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "/usr/bin/open"), [], "the hand-off is not shown when it was not kept");
    t.done();
  });
});

describe("spell, while a reading or a finish is still at work", () => {
  const lock = (t, command) => {
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command }));
    return { ...t.ctx.deps, alive: (pid) => pid === 4242 };
  };
  it("lets the card be answered while the reading's late check of its copies is still to come, since that check touches none of what an answer writes", async () => {
    const { t, found } = await readOf("finished");
    const deps = lock(t, "read");
    const r = await on(deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(handoffIn(found).revision, 1);
    t.done();
  });
  it("still refuses while a finish runs, and while a reading runs for a video that has no reading yet", async () => {
    const { t, found } = await readOf("finished");
    const before = tree(t);
    const r = await on(lock(t, "finish"), "spell", FOLDER, "offers", "none");
    assert.equal(r.text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.');
    assert.deepEqual(tree(t), before);
    // Printing the card reads only.
    assert.equal((await on(lock(t, "finish"), "spell", FOLDER, "offers")).code, 0);
    assert.equal(reread(found).offers.answered, undefined);
    t.done();
  });
});

describe("the help", () => {
  it("names the several pairs of add and the offers", async () => {
    const { t } = rawRead();
    const r = await on(t.ctx.deps, "spell");
    assert.equal(r.code, 2);
    assert.match(r.text, /node edit\.js spell "<episode>" \[add "<as heard>" "<as spelled>" \[add …\]… \| drop "<as heard>" \| offers \[all \| none \| <n> <n>…\]\]/);
    t.done();
  });
});
