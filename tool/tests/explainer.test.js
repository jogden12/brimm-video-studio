// The explainer (PR H6; design 2026-11-04, H6): a planned video made of graphics and words over a voice, with no video of her. The voice is hers,
// dropped as sound alone and answered on the planned card (`footage … voiceover`), or a stock HeyGen voice the app's agent makes in the plan's
// HyperFrames project, which she says is done (`plan … voice`). Either way the plan becomes a short video whose video is its voice, and goes on in
// HyperFrames as any short video does.
// Nothing here runs a real program: ffprobe, ffmpeg, the transcriber and the HyperFrames command line are stand-ins that answer as the real ones print,
// and each test has a folder of its own under the temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { editMain } from "../edit.js";
import { episodeFault, isFromPlan, isPart, isPlannedRecord, layoutOf, localStamp, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { readResult } from "../detached.js";
import { finishLate, readPendings } from "../filing.js";
import { voiceCopyArgs, voiceCopyFacts, voiceCopyPaths, workCopyDir, workCopyKey } from "../workcopy.js";
import { probed } from "./fixtures.js";
import { footageAsked, footageCounts, mayGoIn, partLine, plannedOffers, waitsForClient } from "../footage.js";
import { onMac, voiceIn, voiceSeconds } from "../explainer.js";
import { PIN } from "../hyperframes.js";
import { nextFor } from "../guide.js";
import { changedSince } from "../app.js";
import { FONTS, explainerHtml, projectFiles } from "../project.js";

import { NO_RECEIPT, PLANNED_Q, cardOf, footageOption, formOf, notSessionCardOf, plannedCardOf, receiptFrom, voiceoverOption, writeReceipt } from "../receipts.js";
import { fileSafe } from "../names.js";
import { downloadsFolder, episodeWork, writeSettings } from "../settings.js";
import { localDay } from "../shared/text.js";
import { setup, episodeAs, reread, listAll, toldOf } from "./episodes.js";
import { MINIMUM } from "./open-world.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** The deps every command here is run with: the made-up Mac's, with an id for a plan that is the same every time (400000) unless one is given. */
const depsOf = (t, over = {}) => ({ ...t.ctx.deps, rand: () => 0.25, ...over });
/** This Mac with its lock open and Claude Code named for it, run under Claude Code: the one place a receipt is asked for. */
const open = (t, over = {}) => depsOf(t, { settings: { ...t.ctx.settings, lock: "open" }, minimum: MINIMUM, env: { CLAUDECODE: "1" }, ...over });

const WRITER = { commit: "c709b57", on: "Mac Studio" };
const AT = "2026-11-04T09:12:00-05:00";
const TITLE = "Why SKUs sink you";
const OTHER = "Too many SKUs";
const dayOf = (t) => localDay(new Date(t.now()));
const atOf = (t) => localStamp(new Date(t.now()));
const planIdOf = (t, short = "400000") => `e-${dayOf(t).replaceAll("-", "")}-${short}`;
const nameOf = (t, title = TITLE) => `${dayOf(t)} ${fileSafe(title)} (Mac Studio)`;
const folderOf = (t, title = TITLE) => join(t.root, "Episodes", nameOf(t, title));
const planOf = (t, title = TITLE) => readEpisode(folderOf(t, title)).record;
const labelOf = (n) => `Video of 4 Nov, 0${n}:00 (Mac Studio)`;
const idOf = (n) => `e-20261104-a${String(n).repeat(5)}`;

const CUES = ["--cue", "graphic | 4 | too many SKUs | A stack of product boxes that keeps growing until it topples.", "--cue", "words | 3 | count what you sell | Count what you sell, each week."];
const LINES = ["--line", "Too many SKUs will sink a small shop before it ever finds its footing.", "--line", "The first thing you need to do is count what you actually sell each week."];

/** An explainer planned on this Mac: `voice` is "sallie", "heygen" or null (none chosen yet), and `set` whether its package is made. Its folder. */
async function explainer(t, { title = TITLE, voice = "sallie", set = true, rand = 0.25 } = {}) {
  const made = await on(depsOf(t, { rand: () => rand }), "plan", "new", title, "--explainer", ...(voice ? ["--voice", voice] : []));
  assert.equal(made.code, 0, made.text);
  if (set) {
    const saved = await on(depsOf(t), "plan", title, "set", ...CUES, ...LINES);
    assert.equal(saved.code, 0, saved.text);
  }
  return folderOf(t, title);
}
/** A script planned on this Mac, its package set. Its folder. */
async function script(t, { title = OTHER, rand = 0.3 } = {}) {
  assert.equal((await on(depsOf(t, { rand: () => rand }), "plan", "new", title)).code, 0);
  const saved = await on(depsOf(t), "plan", title, "set", "--shot", "talking | Open to the camera.", "--line", "One.");
  assert.equal(saved.code, 0, saved.text);
  return folderOf(t, title);
}

const SOUND_ONLY = { state: "needs your answer", guess: null, seen: "sound only, 3:02", came: "sound", match: null };
const PICTURE = { state: "needs your answer", guess: "raw", seen: "upright, 0:08", came: "phone", match: null };
/** A recording of sound alone, dropped and waiting for her answer: number `n`, with its label and id, in a folder of its own. */
function memo(t, n, { answer = {}, over = {}, video = {} } = {}) {
  return episodeAs(t, {
    id: idOf(n), name: `2026-11-04 Drop ${n} (Mac Studio)`,
    record: { version: 3, kind: null, label: labelOf(n), answer: { ...SOUND_ONLY, ...answer }, video: { file: `Voice ${n}.m4a`, bytes: 5, seconds: 182, recorded: "2026-11-04", recordedFrom: "import", ...video }, ...over }
  });
}
/** A video with a picture, dropped and waiting for her answer. */
const clip = (t, n, over = {}) => memo(t, n, { answer: PICTURE, video: { file: `Clip ${n}.mov`, seconds: 8 }, over });

/** A plan, whole, at rev 1: a record the pure functions are given. */
const plan = ({ id = "e-20261104-3fa9c1", title = OTHER, at = AT, route = "explainer", voice = null, planned = {}, ...over } = {}) => {
  const made = newPlannedEpisode({ id, machine: "Mac Studio", at, title, route, voice, writer: WRITER });
  return { ...made, rev: 1, planned: { ...made.planned, set: at, lines: ["One."], ...planned }, ...over };
};

describe("plannedOffers, a video of sound alone (PR H6)", () => {
  const SOUND = { picture: false, sound: true };
  it("offers each explainer whose voice is hers or not chosen yet, whose package is set and that is not filmed, as The voiceover for its title", () => {
    const offers = plannedOffers([plan({ voice: "sallie" }), plan({ id: "e-20261104-4aa9c2", title: TITLE, voice: null })], SOUND);
    assert.deepEqual(offers.map((o) => o.option), [voiceoverOption(OTHER), voiceoverOption(TITLE)]);
    assert.equal(voiceoverOption(TITLE), 'The voiceover for "Why SKUs sink you"');
    assert.deepEqual(Object.keys(offers[0]).sort(), ["option", "record"]);
    assert.equal(offers[0].record.id, "e-20261104-3fa9c1");
  });
  it("offers a HeyGen explainer to nothing, nor a script, a plan whose package is not set, a plan filmed or dropped, or a record that only claims to be a plan", () => {
    assert.deepEqual(plannedOffers([plan({ voice: "heygen" })], SOUND), []);
    assert.deepEqual(plannedOffers([plan({ route: "script" })], SOUND), []);
    assert.deepEqual(plannedOffers([plan({ planned: { set: null } })], SOUND), []);
    assert.deepEqual(plannedOffers([plan({ planned: { filmed: AT } }), plan({ planned: { filmed: { at: AT, parts: [] } } }), plan({ archived: { at: AT } })], SOUND), []);
    assert.deepEqual(plannedOffers([{ ...plan(), version: 4 }, { ...plan(), kind: "raw" }, { ...plan(), planned: { ...plan().planned, route: "podcast" } }], SOUND), []);
  });
  it("offers a video with a picture no explainer, whatever its sound, and a file that has neither a picture nor a sound nothing", () => {
    for (const sound of [true, false]) assert.deepEqual(plannedOffers([plan({ voice: "sallie" })], { picture: true, sound }), [], String(sound));
    assert.deepEqual(plannedOffers([plan()], { picture: false, sound: false }), []);
    assert.deepEqual(plannedOffers([plan()], { picture: null, sound: true }), []);
  });
  it("offers a script to a video with a picture and an explainer to sound alone, and never both to one video", () => {
    const records = [plan({ route: "script", title: "A script", planned: { shots: [{ n: 1, kind: "talking", what: "Open." }] } }), plan({ title: TITLE })];
    assert.deepEqual(plannedOffers(records, { picture: true, sound: true }).map((o) => o.option), [footageOption("A script")]);
    assert.deepEqual(plannedOffers(records, SOUND).map((o) => o.option), [voiceoverOption(TITLE)]);
  });
  it("offers at most three, newest first by the moment they were planned, named as every line names a plan", () => {
    const four = ["One", "Two", "Three", "Four"].map((title, i) => plan({ id: `e-20261104-aa${i}${i}${i}${i}`, title, at: `2026-11-04T0${i + 1}:00:00-05:00` }));
    assert.deepEqual(plannedOffers(four, SOUND).map((o) => o.option), [voiceoverOption("Four"), voiceoverOption("Three"), voiceoverOption("Two")]);
    assert.deepEqual(plannedOffers([plan({ name: { text: "Why SKUs sink you", placeholder: false } })], SOUND).map((o) => o.option), [voiceoverOption(TITLE)]);
    for (const bad of [null, undefined, "x", 3, {}]) assert.deepEqual(plannedOffers(bad, SOUND), []);
  });
});

describe("the planned card, with both kinds of answer (PR H6)", () => {
  it("is found by formOf when it offers a voiceover, or footage, or both, and then No", () => {
    for (const offers of [[voiceoverOption(TITLE)], [footageOption(OTHER)], [footageOption(OTHER), voiceoverOption(TITLE)], [voiceoverOption("A"), voiceoverOption("B"), footageOption("C")]]) {
      assert.deepEqual(formOf(plannedCardOf({ label: labelOf(1), offers }).questions), { label: labelOf(1), form: "planned" }, offers.join(" | "));
    }
  });
  it("is not found when an answer is neither kind, there are none or four, or No is not last", () => {
    const ask = (answers) => ({ questions: [{ question: PLANNED_Q(labelOf(1)), header: "Planned", multiSelect: false, options: answers.map((label) => ({ label, description: "" })) }] });
    for (const answers of [["The voiceover of \"A\"", "No"], ["Footage for \"A\"", "The voiceover for \"B\"", "Voiceover for \"C\"", "No"], ["No"], [voiceoverOption("A"), voiceoverOption("B"), voiceoverOption("C"), voiceoverOption("D"), "No"], ["No", voiceoverOption("A")]]) {
      assert.equal(formOf(ask(answers).questions), null, answers.join(" | "));
    }
  });
  it("makes a receipt of her answer, and keeps every answer it offered, in order, as it does for footage", () => {
    const label = labelOf(1);
    const questions = plannedCardOf({ label, offers: [voiceoverOption(TITLE)] }).questions;
    const got = receiptFrom({ hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_response: { questions, answers: { [PLANNED_Q(label)]: voiceoverOption(TITLE) } } }, 1000);
    assert.deepEqual(got, { at: 1000, label, form: "planned", answers: { [PLANNED_Q(label)]: voiceoverOption(TITLE) }, offered: [voiceoverOption(TITLE), "No"] });
  });
});

describe("episodes, under a video of sound alone (PR H6)", () => {
  const cardLines = (label, titles) => [
    `    Planned card: ${JSON.stringify(plannedCardOf({ label, offers: titles.map(voiceoverOption) }))}`,
    `    Card: ${JSON.stringify(cardOf({ label, guess: null, maybe: null }))}`,
    `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label, came: "sound" }))}`
  ];
  const linesOf = (r, label) => r.said.slice(r.said.findIndex((line) => line.startsWith(`  ${label}:`)) + 1).filter((line) => line.startsWith("    "));
  it("prints the planned card with the explainers that wait for a voice, before the card and the card if it is not a session, and no part card", async () => {
    const t = setup();
    await explainer(t);
    await script(t);
    memo(t, 1);
    const lines = linesOf(await on(depsOf(t), "episodes"), labelOf(1));
    assert.deepEqual(lines, ["    Seen: sound only, 3:02", "    Came: as sound alone", ...cardLines(labelOf(1), [TITLE])]);
    assert.ok(!lines.some((line) => line.startsWith("    Part card: ")));
    t.done();
  });
  it("prints the card the receipt is of: the planned card is the one formOf finds, and its answer names the explainer", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1);
    const planned = linesOf(await on(depsOf(t), "episodes"), labelOf(1)).find((line) => line.startsWith("    Planned card: "));
    assert.deepEqual(formOf(JSON.parse(planned.slice("    Planned card: ".length)).questions), { label: labelOf(1), form: "planned" });
    t.done();
  });
  it("prints none for a recording that came from Zoom, or when no explainer waits for a voice (a HeyGen one, a script, one whose package is not set)", async () => {
    const t = setup();
    await explainer(t, { voice: "heygen" });
    await script(t);
    await explainer(t, { title: "Not set yet", set: false, rand: 0.35 });
    memo(t, 1);
    memo(t, 2, { answer: { came: "zoom" } });
    const r = await on(depsOf(t), "episodes");
    for (const n of [1, 2]) assert.ok(!linesOf(r, labelOf(n)).some((line) => line.startsWith("    Planned card: ")), labelOf(n));
    t.done();
  });
  it("prints none for a video that has a picture, nor the explainer's card: such a video is offered a script's footage alone", async () => {
    const t = setup();
    await explainer(t);
    clip(t, 1);
    const lines = linesOf(await on(depsOf(t), "episodes"), labelOf(1));
    assert.ok(!lines.some((line) => line.startsWith("    Planned card: ")), lines.join("\n"));
    t.done();
  });
});

describe("footage … voiceover: sound alone answered as the voiceover of an explainer (PR H6)", () => {
  const SAID = (label, title = TITLE) => `${label} is the voiceover for "${title}". It is being taken in now. A notice comes when it is ready.`;
  const ASK = (n, ...more) => ["footage", labelOf(n), TITLE, "voiceover", ...more];
  /** Every file of the test's folders, whole, by its path. */
  const snapshot = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));
  const unchanged = (t, before, why = "") => {
    assert.deepEqual(snapshot(t), before, why);
    assert.deepEqual(t.started, [], why);
  };
  const SESSION_QUESTION = (label) => notSessionCardOf({ label, came: "sound" }).questions[0].question;
  /** Her two answers: the planned card (the voiceover of `title`) and the not-a-session card ("It is not a session"). */
  function receipts(t, { label, title = TITLE, ago = 0, offered, answer = "It is not a session", also = [] } = {}) {
    writeReceipt(t.home, { at: t.now() - ago, label, form: "planned", answers: { [PLANNED_Q(label)]: voiceoverOption(title) }, offered: offered ?? [voiceoverOption(title), ...also.map(voiceoverOption), "No"] });
    writeReceipt(t.home, { at: t.now() - ago, label, form: "not-a-session", answers: { [SESSION_QUESTION(label)]: answer } });
  }

  it("makes the voiceover part: the video's own record gets the answer part and what it is the voiceover for, in one write, at layout 5, and starts the run with that one part", async () => {
    const t = setup();
    await explainer(t);
    const found = memo(t, 1);
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [0, [SAID(labelOf(1))]]);
    const now = reread(found);
    assert.deepEqual([now.rev, now.version, now.kind], [2, 5, null]);
    assert.deepEqual(now.partOf, { id: planIdOf(t), as: "voiceover", shot: null, client: null });
    assert.deepEqual(now.answer, { ...SOUND_ONLY, state: "part", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" });
    assert.equal(episodeFault(now), "");
    assert.equal(isPart(now), true);
    assert.equal(now.editing, null);
    assert.deepEqual(listAll(found.folder), ["record/0001.json", "record/0002.json"]);
    // The run is the join, on the plan's folder, with that one part.
    assert.equal(t.started.length, 1);
    assert.deepEqual(t.started[0][1].slice(1), ["join", "--now", nameOf(t), "--parts", now.id]);
    // The plan had a voice already, and is not written.
    assert.equal(planOf(t).rev, 2, "the plan's own record is its second: the package was set");
    assert.deepEqual(Object.keys(snapshot(t)).filter((rel) => !(rel in before)), [`BRIMM Video/Episodes/${found.name}/record/0002.json`]);
    t.done();
  });
  it("sets the plan's voice to sallie when it had none, in a write of its own, and leaves a voice it has", async () => {
    const t = setup();
    await explainer(t, { voice: null });
    const found = memo(t, 1);
    assert.equal(planOf(t).planned.voice, null);
    const rev = planOf(t).rev;
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [0, [SAID(labelOf(1))]]);
    assert.deepEqual([planOf(t).planned.voice, planOf(t).rev, reread(found).rev], ["sallie", rev + 1, 2]);
    assert.equal(episodeFault(planOf(t)), "");
    assert.ok(isPlannedRecord(planOf(t)), "the plan is a plan still: the run makes it a video");
    t.done();
  });
  it("refuses an explainer read by a HeyGen voice, in words, and writes nothing", async () => {
    const t = setup();
    await explainer(t, { voice: "heygen" });
    memo(t, 1);
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is read by a HeyGen voice, so it takes no voiceover.`]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses a script, in words: it takes footage, and no voiceover", async () => {
    const t = setup();
    await script(t, { title: TITLE });
    memo(t, 1);
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is a script: it takes footage, and no voiceover.`]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses a video that has a picture: a voiceover is sound alone", async () => {
    const t = setup();
    await explainer(t);
    clip(t, 1);
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`${labelOf(1)} has a picture: a voiceover is sound alone.`]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses a recording with no sound at all, though it has no picture: a voiceover is a voice", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1, { video: { sound: false } });
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`${labelOf(1)} has no sound, so it can't be a voiceover.`]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses a plan whose package is not made yet, a plan nobody planned, and a title two plans have", async () => {
    const t = setup();
    await explainer(t, { set: false });
    memo(t, 1);
    const before = snapshot(t);
    assert.deepEqual((await on(depsOf(t), ...ASK(1, "--not-a-session"))).said, [`The plan for "${TITLE}" isn't made yet: its guide and its teleprompter script come first.`]);
    assert.deepEqual((await on(depsOf(t), "footage", labelOf(1), "Nothing like it", "voiceover", "--not-a-session")).said, [`There's no planned video called "Nothing like it" waiting for its voiceover.`]);
    unchanged(t, before);
    t.done();
  });
  it("needs --not-a-session for a recording of sound alone, on every Mac: without it, kind's words and its card, and nothing is written", async () => {
    const ASK_IF_SESSION = "Ask first whether it is a client or group session: it came from Zoom, or is sound alone. Then answer again with --not-a-session.";
    for (const deps of [(t) => depsOf(t), (t) => open(t)]) {
      const t = setup();
      await explainer(t);
      memo(t, 1);
      const before = snapshot(t);
      const r = await on(deps(t), ...ASK(1));
      assert.deepEqual([r.code, r.said], [1, [ASK_IF_SESSION, `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: labelOf(1), came: "sound" }))}`]]);
      unchanged(t, before);
      t.done();
    }
  });
  it("takes no --client, no --shot and no other flag, and is the help for them", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1);
    const before = snapshot(t);
    for (const flags of [["--client", "no"], ["--shot", "2"], ["--not-a-session", "--client", "no"], ["--now"]]) {
      const r = await on(depsOf(t), ...ASK(1, ...flags));
      assert.equal(r.code, 2, flags.join(" "));
    }
    unchanged(t, before);
    t.done();
  });
  it("takes no voiceover for a plan that has one: a second is refused, naming the first, until it is taken back", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1);
    memo(t, 2);
    assert.equal((await on(depsOf(t), ...ASK(1, "--not-a-session"))).code, 0);
    t.started.length = 0;
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(2, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" has its voiceover already: ${labelOf(1)}. To change it, say "that's not footage for ${TITLE}" first.`]]);
    unchanged(t, before, "nothing more");
    t.done();
  });
  it("never takes a Zoom download, a recording that holds a session's words, or one held beside a session", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1, { answer: { came: "zoom" } });
    const before = snapshot(t);
    const zoom = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([zoom.code, zoom.said], [1, [`${labelOf(1)} came from Zoom, and a Zoom download is never footage.`]]);
    unchanged(t, before);
    t.done();
    const u = setup();
    await explainer(u);
    const SESSION = { version: 3, kind: "session", label: "Session, 2026-10-20", name: { text: "Session, 2026-10-20", placeholder: false }, answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-20T15:00:00-05:00", private: "yes" }, session: { marked: "2026-10-20T15:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null } };
    episodeAs(u, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION });
    memo(u, 1, { answer: { match: "e-20261020-5e5510" } });
    memo(u, 2);
    episodeAs(u, { id: "e-20261020-5e5511", name: "2026-10-20 A later session (Mac Studio)", record: { ...SESSION, versionOf: idOf(2) } });
    const held = snapshot(u);
    for (const n of [1, 2]) {
      const r = await on(depsOf(u), ...ASK(n, "--not-a-session"));
      assert.deepEqual([r.code, r.said], [1, [`${labelOf(n)} holds most of the words of a client or group session, so it is never footage. Ask Jason.`]], labelOf(n));
    }
    unchanged(u, held);
    u.done();
  });
  it("refuses a recording that is answered already, or is footage already, in the words it has always had", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1, { over: { kind: "raw", answer: { state: "answered", guess: null, seen: "sound only, 3:02", came: "sound", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" } } });
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    // An answered video is named by its name, as every line names it (the label names a video that waits).
    assert.deepEqual([r.code, r.said], [1, ["Talk is answered already: it is raw with retakes."]]);
    t.done();
  });
  it("refuses while the other Mac is answering the recording", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1, { over: { editing: { by: "Sallie's laptop", since: AT } } });
    const before = snapshot(t);
    const r = await on(depsOf(t), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`${labelOf(1)} is being answered on Sallie's laptop. Nothing was changed.`]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses while a run is at work on the plan, as kind and the join do, and writes nothing", async () => {
    const t = setup();
    await explainer(t);
    memo(t, 1);
    mkdirSync(episodeWork(t.home, nameOf(t)), { recursive: true });
    writeFileSync(join(episodeWork(t.home, nameOf(t)), "episode.lock"), JSON.stringify({ pid: 4242, command: "join", nonce: "x" }));
    const before = snapshot(t);
    const r = await on(depsOf(t, { alive: () => true }), ...ASK(1, "--not-a-session"));
    assert.deepEqual([r.code, r.said], [1, [`join is running for ${nameOf(t)} already. Say it again when it has finished.`]]);
    unchanged(t, before);
    t.done();
  });

  describe("her receipts, on an open-lock Mac under Claude Code", () => {
    /** What a refusal for want of her cards prints: NO_RECEIPT and the planned card and the card if it is not a session, as `episodes` prints them. */
    const cardsFor = (label, titles = [TITLE]) => [
      NO_RECEIPT,
      `    Planned card: ${JSON.stringify(plannedCardOf({ label, offers: titles.map(voiceoverOption) }))}`,
      `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label, came: "sound" }))}`
    ];
    it("writes nothing without a receipt of the planned card and of the not-a-session card, and prints both cards", async () => {
      const t = setup();
      await explainer(t);
      memo(t, 1);
      const before = snapshot(t);
      const none = await on(open(t), ...ASK(1, "--not-a-session"));
      assert.deepEqual([none.code, none.said], [1, cardsFor(labelOf(1))]);
      unchanged(t, before);
      // One card is not both.
      writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: voiceoverOption(TITLE) }, offered: [voiceoverOption(TITLE), "No"] });
      const withOne = snapshot(t);
      assert.deepEqual((await on(open(t), ...ASK(1, "--not-a-session"))).said, cardsFor(labelOf(1)));
      unchanged(t, withOne);
      t.done();
      const u = setup();
      await explainer(u);
      memo(u, 1);
      writeReceipt(u.home, { at: u.now(), label: labelOf(1), form: "not-a-session", answers: { [SESSION_QUESTION(labelOf(1))]: "It is not a session" } });
      assert.deepEqual((await on(open(u), ...ASK(1, "--not-a-session"))).said, cardsFor(labelOf(1)));
      u.done();
    });
    it("writes it with both receipts, and the cards it prints are the very cards `episodes` prints", async () => {
      const t = setup();
      await explainer(t);
      const found = memo(t, 1);
      const listed = (await on(open(t), "episodes")).said.filter((line) => /^ {4}(Planned card|Card if not a session): /.test(line));
      assert.deepEqual(listed, cardsFor(labelOf(1)).slice(1));
      receipts(t, { label: labelOf(1) });
      const r = await on(open(t), ...ASK(1, "--not-a-session"));
      assert.deepEqual([r.code, r.said], [0, [SAID(labelOf(1))]]);
      assert.deepEqual(reread(found).partOf, { id: planIdOf(t), as: "voiceover", shot: null, client: null });
      t.done();
    });
    it("refuses a receipt of another plan, of the footage answer for the plan, of \"It is a client or group session\", of another video, one an hour old, and offers naming a plan dropped since", async () => {
      for (const [what, make] of [
        ["another plan", (t) => receipts(t, { label: labelOf(1), title: OTHER, also: [TITLE] })],
        ["the card answered No", (t) => {
          writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: "No" }, offered: [voiceoverOption(TITLE), "No"] });
          writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "not-a-session", answers: { [SESSION_QUESTION(labelOf(1))]: "It is not a session" } });
        }],
        ["a footage answer", (t) => {
          writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: footageOption(TITLE) }, offered: [footageOption(TITLE), "No"] });
          writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "not-a-session", answers: { [SESSION_QUESTION(labelOf(1))]: "It is not a session" } });
        }],
        ["it is a session", (t) => receipts(t, { label: labelOf(1), answer: "It is a client or group session" })],
        ["another video's", (t) => receipts(t, { label: labelOf(2) })],
        ["an hour old", (t) => receipts(t, { label: labelOf(1), ago: 60 * 60 * 1000 })],
        ["a plan dropped since offered", (t) => receipts(t, { label: labelOf(1), also: ["A plan dropped since"] })]
      ]) {
        const t = setup();
        await explainer(t);
        memo(t, 1);
        memo(t, 2);
        make(t);
        const before = snapshot(t);
        const r = await on(open(t), ...ASK(1, "--not-a-session"));
        assert.equal(r.code, 1, `${what}: ${r.text}`);
        assert.equal(r.said[0], NO_RECEIPT, what);
        unchanged(t, before, what);
        t.done();
      }
      // Her receipts for the right plan and her right answers, from a card that offered another plan as well, are good.
      const t = setup();
      await explainer(t);
      await explainer(t, { title: OTHER, rand: 0.3 });
      memo(t, 1);
      receipts(t, { label: labelOf(1), also: [OTHER] });
      assert.equal((await on(open(t), ...ASK(1, "--not-a-session"))).code, 0);
      t.done();
    });
    it("asks no receipt in Terminal, nor on a strict Mac, where no Claude Code is named for the lock", async () => {
      for (const deps of [(t) => depsOf(t, { env: {} }), (t) => depsOf(t, { settings: { ...t.ctx.settings, lock: "open" }, minimum: MINIMUM, env: {} }), (t) => depsOf(t, { env: { CLAUDECODE: "1" } })]) {
        const t = setup();
        await explainer(t);
        memo(t, 1);
        const r = await on(deps(t), ...ASK(1, "--not-a-session"));
        assert.equal(r.code, 0, r.text);
        t.done();
      }
    });
  });
});

describe("a voiceover is a part like the rest (PR H6)", () => {
  it("is a part with no shot and no client: counted as a voiceover, said as the voiceover, and never waiting for a client's agreement", () => {
    const part = { name: "x", folder: "/x", record: { id: idOf(1), label: labelOf(1), kind: null, answer: { state: "part" }, partOf: { id: "e-20261104-3fa9c1", as: "voiceover", shot: null, client: null } } };
    assert.equal(footageCounts([part]), "1 voiceover");
    assert.equal(partLine(part, {}), `Footage: ${labelOf(1)}, the voiceover.`);
    assert.equal(mayGoIn(part, {}), false, "fails closed: only footage that shows no client goes into a project");
    assert.equal(waitsForClient(part, {}), false, "yet it waits for no client's agreement (the guide's client line is made of this; see the fix-round test)");
  });
  it("is asked as a third word that takes the one flag --not-a-session, and no other", () => {
    assert.deepEqual(footageAsked(["v", "Why", "voiceover"], {}), { form: "set", video: "v", planned: "Why", as: "voiceover", client: null, shot: null, notASession: false });
    assert.deepEqual(footageAsked(["v", "Why", "VOICEOVER"], { "not-a-session": true }), { form: "set", video: "v", planned: "Why", as: "voiceover", client: null, shot: null, notASession: true });
    for (const flags of [{ client: ["no"] }, { shot: ["2"] }, { "not-a-session": true, client: ["no"] }, { now: true }]) assert.equal(footageAsked(["v", "Why", "voiceover"], flags), null, JSON.stringify(flags));
    // The other kinds do not take it.
    assert.equal(footageAsked(["v", "Why", "talking"], { client: ["no"], "not-a-session": true }), null);
    assert.equal(footageAsked(["v", "Why", "voiceover", "more"], {}), null);
  });
});

// --- Step 2: the page, the sound's copy and the voice a project plays ---

describe("voiceIn, the sound a HyperFrames project's page plays from its assets/ (PR H6)", () => {
  const page = (...audios) => `<!doctype html><html><body><div id="root" data-composition-id="main" data-start="0" data-duration="60">${audios.join("\n")}</div></body></html>`;
  const clipOf = (src, extra = "") => `<audio id="voice" src="${src}" data-start="0" data-duration="30" data-track-index="0" ${extra}></audio>`;
  it("gives the one sound file of assets/ the page's audio plays", () => {
    assert.deepEqual(voiceIn(page(clipOf("assets/HeyGen voice 4f2a.wav"))), { src: "assets/HeyGen voice 4f2a.wav" });
  });
  it("reads a name written with its spaces as %20, a leading ./ and doubled slashes, and gives it as the file's own path", () => {
    assert.deepEqual(voiceIn(page(clipOf("assets/HeyGen%20voice%204f2a.wav"))), { src: "assets/HeyGen voice 4f2a.wav" });
    assert.deepEqual(voiceIn(page(clipOf("./assets//voice.wav"))), { src: "assets/voice.wav" });
  });
  it("gives one source, once, when the app split its clip into several audio elements that play the same file", () => {
    const split = page(clipOf("assets/voice.wav", 'data-media-start="0"'), clipOf("assets/voice.wav", 'data-media-start="30" data-start="30"'), clipOf("assets/voice.wav", 'data-start="60"'));
    assert.deepEqual(voiceIn(split), { src: "assets/voice.wav" });
  });
  it("lists the sources, in the order the page plays them, when it plays two different files", () => {
    assert.deepEqual(voiceIn(page(clipOf("assets/one.wav"), clipOf("assets/two.mp3"), clipOf("assets/one.wav"))), { several: ["assets/one.wav", "assets/two.mp3"] });
  });
  it("reads the source of an audio element written as a <source> inside it", () => {
    assert.deepEqual(voiceIn(page('<audio id="v" data-start="0" data-duration="9"><source src="assets/voice.wav" type="audio/wav"></audio>')), { src: "assets/voice.wav" });
  });
  it("says none for a page that plays nothing from assets/: no audio, a <video> alone, a file in media/, an address on the network, a file outside the project", () => {
    for (const html of [
      page(),
      page('<video id="a-roll" src="assets/clip.mp4" data-start="0" data-duration="9"></video>'),
      page(clipOf("media/voiceover.m4a")),
      page(clipOf("https://example.com/assets/voice.wav")),
      page(clipOf("/assets/voice.wav")),
      page(clipOf("assets/../media/voice.wav")),
      page(clipOf("../assets/voice.wav")),
      page('<audio id="empty"></audio>'),
      "",
      "not a page"
    ]) assert.deepEqual(voiceIn(html), { none: true }, html.slice(0, 60));
    for (const nothing of [null, undefined, 5, {}]) assert.deepEqual(voiceIn(nothing), { none: true });
  });
  it("counts only the files of assets/ when the page plays others too", () => {
    assert.deepEqual(voiceIn(page(clipOf("media/voiceover.m4a"), clipOf("assets/voice.wav"), clipOf("https://example.com/x.wav"))), { src: "assets/voice.wav" });
  });
  it("is not led astray by a comment, a script or a style that holds an audio tag", () => {
    const html = `<html><head><style>/* <audio src="assets/style.wav"> */</style></head><body><!-- <audio src="assets/comment.wav"></audio> --><script>const x = '<audio src="assets/script.wav"></audio>';</script>${clipOf("assets/real.wav")}</body></html>`;
    assert.deepEqual(voiceIn(html), { src: "assets/real.wav" });
  });
});

describe("explainerHtml, the page of an explainer (PR H6)", () => {
  const facts = { seconds: 182.12, width: 1080, height: 1920, fps: 30 };
  const AUDIO = '<audio id="voiceover" src="media/voiceover.m4a" data-start="0" data-duration="182.12" data-track-index="0" data-volume="1"></audio>';
  it("holds the one audio element of the voiceover, exactly as the app plays it, and no video", () => {
    const html = explainerHtml(facts, { voiceover: true });
    assert.equal(html.split(AUDIO).length - 1, 1, "the audio element, once");
    assert.equal((html.match(/<audio\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<video\b/);
  });
  it("holds no media element at all without the voiceover: it is made as long as the facts say, for a voice not yet made", () => {
    for (const html of [explainerHtml(facts), explainerHtml(facts, {}), explainerHtml(facts, { voiceover: false })]) {
      assert.doesNotMatch(html, /<audio\b|<video\b|<source\b/);
      assert.match(html, /data-duration="182.12"/);
    }
  });
  it("is upright, 1080 by 1920, whatever the facts say of the voice: the composition, the viewport, the body and the resolution", () => {
    for (const odd of [facts, { seconds: 60, width: 1920, height: 1080 }, { seconds: 60 }]) {
      const html = explainerHtml(odd, { voiceover: true });
      assert.match(html, /<html lang="en" data-resolution="portrait">/);
      assert.match(html, /<meta name="viewport" content="width=1080, height=1920" \/>/);
      assert.match(html, /data-width="1080"\s+data-height="1920"/);
      assert.match(html, /width: 1080px;\s+height: 1920px;/);
    }
  });
  it("has the mist background, the brand's fonts from the project's own folder and GSAP from its vendor/, and loads nothing from the network", () => {
    const html = explainerHtml(facts, { voiceover: true });
    assert.match(html, /background: #E8E3DA;/);
    for (const font of FONTS) assert.ok(html.includes(`url("assets/fonts/${font.file}")`), font.file);
    assert.ok(html.includes('<script src="vendor/gsap.min.js"></script>'));
    assert.doesNotMatch(html, /https?:\/\//);
    assert.ok(html.includes('font-family: "Josefin Sans", sans-serif;'));
  });
  it("is one composition called main, as long as the voice, with one paused timeline registered under it", () => {
    const html = explainerHtml(facts, { voiceover: true });
    assert.match(html, /data-composition-id="main"\s+data-start="0"\s+data-duration="182.12"/);
    assert.ok(html.includes('window.__timelines["main"] = tl;') && html.includes("gsap.timeline({ paused: true })"));
  });
  it("writes the length to the thousandth, with no trailing zeros, and refuses facts with no length", () => {
    assert.match(explainerHtml({ seconds: 10.0004 }, { voiceover: true }), /data-duration="10"/);
    assert.match(explainerHtml({ seconds: 61.2346 }), /data-duration="61.235"/);
    for (const bad of [{}, { seconds: 0 }, { seconds: -3 }, { seconds: "x" }, null, undefined]) assert.throws(() => explainerHtml(bad, { voiceover: true }), /seconds/);
  });
});

describe("planned.project, the HyperFrames project of a HeyGen explainer before its voice is taken in (PR H6)", () => {
  const PROJECT = { name: "Why SKUs sink you main 3fa9c1", madeAt: AT, on: "Mac Studio", opened: [AT] };
  const withProject = (project, over = {}) => {
    const made = plan({ voice: "heygen", title: TITLE, ...over });
    return { ...made, planned: { ...made.planned, project } };
  };
  it("is { name, madeAt, on, opened } and nothing else: the record stays whole, and it is still a plan", () => {
    const record = withProject(PROJECT);
    assert.equal(episodeFault(record), "");
    assert.equal(isPlannedRecord(record), true);
    assert.equal(episodeFault(withProject({ ...PROJECT, opened: [] })), "", "made, never opened");
    assert.equal(episodeFault(withProject({ ...PROJECT, opened: [AT, "2026-11-04T10:00:00-05:00"] })), "");
  });
  it("belongs to a HeyGen explainer alone: a script, an explainer in her voice and one with no voice chosen have none", () => {
    for (const over of [{ route: "script" }, { voice: "sallie" }, { voice: null }]) assert.notEqual(episodeFault(withProject(PROJECT, over)), "", JSON.stringify(over));
  });
  it("is refused when it is another shape: a missing key, one more, a name that leads out of its folder, opened that is no list of times", () => {
    for (const bad of [
      { name: PROJECT.name, madeAt: AT, on: "Mac Studio" }, { ...PROJECT, extra: 1 }, { ...PROJECT, name: "" }, { ...PROJECT, name: "a/b" }, { ...PROJECT, name: "a\\b" }, { ...PROJECT, name: ".." },
      { ...PROJECT, madeAt: "yesterday" }, { ...PROJECT, on: "" }, { ...PROJECT, opened: "now" }, { ...PROJECT, opened: ["soon"] }, { ...PROJECT, opened: [AT, 5] }, "main", [], null
    ]) {
      if (bad === null) continue;
      assert.notEqual(episodeFault(withProject(bad)), "", JSON.stringify(bad));
    }
  });
});

describe("the gate lets app run for a plan (PR H6)", () => {
  it("has app in the planned list beside plan, name and join, and in no other list", async () => {
    const { PLANNED, UNANSWERED, SESSION_TAUGHT, FOOTAGE, gateFor, noFootageWhy } = await import("../gate.js");
    assert.deepEqual(PLANNED, ["plan", "name", "join", "app"]);
    for (const list of [UNANSWERED, SESSION_TAUGHT, FOOTAGE]) assert.ok(!list.includes("app"), "app is on no list of a video not yet answered, a session or footage");
    assert.equal(gateFor("app", plan(), {}), "");
    // The words it refuses every other plan in are the gate's own, which app says too for a plan it will not open.
    assert.equal(noFootageWhy(plan({ title: TITLE })), `"${TITLE}" is a planned video, and it isn't made from its footage yet.`);
    assert.equal(gateFor("open", plan({ title: TITLE }), {}), noFootageWhy(plan({ title: TITLE })));
  });
});

describe("projectFiles, an explainer's project (PR H6)", () => {
  const WORDS = [
    { w: "Too", start: 0.5, end: 0.8 }, { w: "many", start: 0.8, end: 1.1 }, { w: "SKUs", start: 1.1, end: 1.6 }, { w: "will", start: 1.7, end: 1.9 }, { w: "sink", start: 1.9, end: 2.3 },
    { w: "a", start: 2.4, end: 2.5 }, { w: "small", start: 2.5, end: 2.9 }, { w: "shop.", start: 2.9, end: 3.4 }
  ];
  const GUIDANCE = readFileSync(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url), "utf8");
  const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";
  const COPY = "/Users/sallie/BRIMM Video Work/E/working copy/1234-5678.m4a";
  const TELEPROMPTER = "Too many SKUs will sink a small shop.\n\nCount what you sell.\n";
  const CUE_LIST = [
    { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null },
    { n: 2, words: "never said at all", kind: "words", show: "Words.", seconds: 3, style: null }
  ];
  const base = { kind: "main", name: "Why SKUs sink you", part: "main", id: "2026-11-04-mac-studio-3fa9c1", spellings: [["SKU", "SKU"]], plan: null, short: true, guidance: GUIDANCE, cli: CLI, logos: [], createdAt: "2026-11-04T15:00:00.000Z", graphicCues: CUE_LIST };
  const hers = (over = {}) => ({ ...base, words: WORDS, video: COPY, facts: { seconds: 3.4, width: 1080, height: 1920, fps: 30, bytes: 99, sound: true }, explainer: { voice: "sallie", teleprompter: TELEPROMPTER }, ...over });
  const heygen = (over = {}) => ({ ...base, words: [], facts: { seconds: 12, width: 1080, height: 1920, fps: 30 }, explainer: { voice: "heygen", teleprompter: TELEPROMPTER }, ...over });
  const EXPLAINER_RULE = "- **This explainer.** It is graphics and words on screen over a voice, with no video of her. Keep it upright, 1080 by 1920: it is exported and handed off at that size.";
  const VOICE_RULE = "- **Its voice.** A stock HeyGen voice she chooses reads it. When she has chosen one, make it with the app's voice tool from `brimm/teleprompter.txt`, word for word, put it on the timeline from the start, and make the composition as long as the voice.";
  const HEYGEN_WORDS = "- **The words.** There are none yet: they are the voice's, in the app's transcript beside it in `assets/` once it is made. Never transcribe again.";
  const REFERENCES = " Files in `brimm/references/` are style references she chose: follow their look, and never copy what is in them.";
  const HEYGEN_CUES = `- **Graphic cues.** Studio's suggested graphics are in \`brimm/graphic-cues.json\`, each with the words it goes with and no times yet. Once the voice is made, place each on its words in the voice's transcript, then offer them to her, one at a time or all together, and build only the ones she takes: each short (its \`seconds\`), in the brand, with things and words and never people. Tell her of a cue whose words the voice does not say, and place it only where she says. Never add a graphic she has not taken.${REFERENCES}`;
  const HERS_CUES = `- **Graphic cues.** Studio's suggested graphics are in \`brimm/graphic-cues.json\`, each tied to the words it goes with: word ids and times on the voiceover's clock. After the cuts, offer them to her, one at a time or all together, and build only the ones she takes: each short (its \`seconds\`), in the brand, with things and words and never people. A cue with no \`at\` was not found in her words: tell her, and place it only where she says. Never add a graphic she has not taken.${REFERENCES}`;
  const AI_PEOPLE_START = "- **AI-generated people.** HeyGen's tools are open.";
  const lines = (files, path) => files.get(path).split("\n");
  const json = (files, path) => JSON.parse(files.get(path));

  it("holds, for her voice, the page, the voiceover moved in last, her words, the teleprompter script and the usual files, and no recording.mp4", () => {
    const files = projectFiles(hers());
    assert.deepEqual([...files.keys()].sort(), [
      ".claude/settings.json", "AGENTS.md", "CLAUDE.md", "assets/fonts/Allison-Regular.ttf", "assets/fonts/josefin-sans-latin-300-normal.woff2", "assets/fonts/josefin-sans-latin-400-italic.woff2",
      "assets/fonts/josefin-sans-latin-400-normal.woff2", "assets/fonts/josefin-sans-latin-500-normal.woff2", "brimm/brand.md", "brimm/cut-suggestions.json", "brimm/facts.json", "brimm/graphic-cues.json",
      "brimm/reel-suggestions.json", "brimm/spellings.json", "brimm/teleprompter.txt", "hyperframes.json", "index.html", "media/voiceover.m4a", "meta.json", "node_modules/.bin/hyperframes",
      "package.json", "transcript.json", "vendor/gsap.min.js"
    ]);
    assert.deepEqual(files.get("media/voiceover.m4a"), { move: COPY });
    assert.equal(files.get("brimm/teleprompter.txt"), TELEPROMPTER);
    assert.equal(files.get("index.html"), explainerHtml(hers().facts, { voiceover: true }));
    assert.deepEqual([...files.keys()].slice(-1), ["AGENTS.md"]);
    assert.ok(![...files.keys()].some((path) => path.startsWith("media/recording")), "no recording.mp4");
  });
  it("holds, for a HeyGen voice, the same with no media at all: a page with no audio, no words, and no voiceover to move in", () => {
    const files = projectFiles(heygen());
    assert.ok(![...files.keys()].some((path) => path.startsWith("media/")), [...files.keys()].join(" "));
    assert.equal(files.get("index.html"), explainerHtml(heygen().facts));
    assert.deepEqual(json(files, "transcript.json"), []);
    assert.equal(files.get("brimm/teleprompter.txt"), TELEPROMPTER);
    assert.deepEqual(json(files, "brimm/cut-suggestions.json"), { version: 1, clock: "recording", suggestions: [] });
  });
  it("needs no video of the project for a HeyGen voice, and an absolute path of the voiceover's copy for her own", () => {
    assert.doesNotThrow(() => projectFiles(heygen({ video: undefined })));
    assert.throws(() => projectFiles(hers({ video: "media/x.m4a" })), /video must be an absolute path/);
    assert.throws(() => projectFiles(hers({ video: undefined })), /video must be an absolute path/);
  });
  it("puts her words in transcript.json, spelled as she spells them, and places the cues on them; a cue her words do not hold has no place", () => {
    const files = projectFiles(hers());
    assert.deepEqual(json(files, "transcript.json").map((w) => w.text), WORDS.map((w) => w.w));
    const cues = json(files, "brimm/graphic-cues.json");
    assert.equal(cues.clock, "recording");
    assert.deepEqual(cues.cues.map((c) => [c.n, c.kind, c.at === null ? null : c.at.from]), [[1, "graphic", "w0"], [2, "words", null]]);
    // Its place is the times its first and last words have in transcript.json, which is the same list.
    const transcript = json(files, "transcript.json");
    assert.deepEqual(cues.cues[0].at, { from: "w0", to: "w2", start: transcript[0].start, end: transcript[2].end });
  });
  it("gives a HeyGen project every cue with no place yet, in the order given", () => {
    const cues = json(projectFiles(heygen()), "brimm/graphic-cues.json");
    assert.deepEqual(cues.cues.map((c) => [c.n, c.kind, c.at]), [[1, "graphic", null], [2, "words", null]]);
  });
  it("tells the agent, for her voice, that this explainer is graphics and words over a voice, upright, and that its cues are on the voiceover's clock", () => {
    const notes = projectFiles(hers()).get("CLAUDE.md");
    const rules = notes.split("\n");
    assert.ok(rules.includes(EXPLAINER_RULE), "EXPLAINER_RULE");
    assert.ok(rules.includes(HERS_CUES), "the cue rule, on the voiceover's clock");
    assert.ok(!notes.includes("on the recording's clock, so add the recording's `data-start`"), "H1's words about the recording's clock are gone");
    assert.ok(!rules.includes(VOICE_RULE) && !rules.includes(HEYGEN_WORDS) && !rules.includes(HEYGEN_CUES));
    assert.ok(rules.includes("- **The words.** Every word said, with its time and its id, is in `transcript.json`, made on this Mac. Use it, and never transcribe again."));
    assert.ok(rules.some((line) => line.startsWith(AI_PEOPLE_START)), "the warning before an AI avatar stays");
    // It comes right after the cue rule, and the rule for footage cues, which an explainer has none of, is not there.
    assert.equal(rules[rules.indexOf(HERS_CUES) + 1], EXPLAINER_RULE);
    assert.ok(!notes.includes("**Footage cues.**"));
    // A short video has no Reels, and its notes say so.
    assert.ok(rules.some((line) => line.startsWith("- **No new projects.** Never make a Reel")));
    assert.ok(!rules.some((line) => line.startsWith("- **Reels.**")));
  });
  it("tells the agent, for a HeyGen voice, what the project is before the voice: the explainer, its voice, no words yet and no times", () => {
    const notes = projectFiles(heygen()).get("CLAUDE.md");
    const rules = notes.split("\n");
    for (const line of [EXPLAINER_RULE, VOICE_RULE, HEYGEN_WORDS, HEYGEN_CUES]) assert.ok(rules.includes(line), line.slice(0, 40));
    assert.equal(rules[rules.indexOf(HEYGEN_CUES) + 1], EXPLAINER_RULE);
    assert.equal(rules[rules.indexOf(EXPLAINER_RULE) + 1], VOICE_RULE);
    assert.ok(!rules.includes("- **The words.** Every word said, with its time and its id, is in `transcript.json`, made on this Mac. Use it, and never transcribe again."));
    assert.ok(!notes.includes("each tied to the words it goes with") && !notes.includes("A cue with no `at` was not found"));
    // The warning before an AI avatar stays, and a stock voice needs none: the rule is the one every main video has, which HeyGen's voice rule only adds to.
    assert.ok(rules.some((line) => line.startsWith(AI_PEOPLE_START) && line.includes("A stock HeyGen voice is fine without the warning")));
  });
  it("says what each file of an explainer is in its notes and its facts, and its clock", () => {
    const notes = projectFiles(hers()).get("CLAUDE.md");
    assert.ok(notes.includes("  - `media/voiceover.m4a`: the voiceover: her voice, made ready for HyperFrames and not cut."));
    assert.ok(notes.includes("  - `brimm/teleprompter.txt`: the teleprompter script: the words the voice reads, as she wrote them."));
    assert.ok(notes.includes("- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/voiceover.m4a`, which is the voiceover's own: nothing was cut from it."));
    assert.ok(!notes.includes("media/recording.mp4"));
    const facts = json(projectFiles(hers()), "brimm/facts.json");
    assert.deepEqual([facts.kind, facts.seconds, facts.width, facts.height, facts.fps], ["main", 3.4, 1080, 1920, 30]);
    assert.equal(facts.files["media/voiceover.m4a"], "the voiceover: her voice, made ready for HyperFrames and not cut");
    assert.equal(facts.files["brimm/teleprompter.txt"], "the teleprompter script: the words the voice reads, as she wrote them");
    const heygenNotes = projectFiles(heygen()).get("CLAUDE.md");
    assert.ok(heygenNotes.includes("- **Its clock.** There is no voice yet, so no time is on a clock: the times of `transcript.json` and `brimm/` come with the voice, on its own clock."));
  });
  it("gives a project that is not an explainer none of this: the same file set and the same notes as before", () => {
    const plain = { ...base, explainer: undefined, words: WORDS, video: COPY.replace(".m4a", ".mp4"), facts: { seconds: 3.4, width: 1920, height: 1080, fps: 30, bytes: 99 } };
    const files = projectFiles(plain);
    assert.ok(files.has("media/recording.mp4") && !files.has("media/voiceover.m4a") && !files.has("brimm/teleprompter.txt"));
    assert.ok(!files.get("CLAUDE.md").includes("This explainer"));
    // A Reel and a clip are given no explainer, whatever they are handed.
    for (const kind of ["reel", "clip"]) {
      const odd = projectFiles({ ...plain, kind, ...(kind === "reel" ? { part: { reel: 2 }, stretch: { start: 1, end: 3 } } : { clip: 1 }), explainer: { voice: "sallie", teleprompter: TELEPROMPTER } });
      assert.ok(!odd.has("brimm/teleprompter.txt") && !odd.get("CLAUDE.md").includes("This explainer"), kind);
    }
  });
  it("refuses an explainer of another voice or with no teleprompter text, which would leave the notes saying what is not so", () => {
    for (const bad of [{ voice: "robot", teleprompter: "x" }, { voice: "sallie" }, { voice: "sallie", teleprompter: 5 }, "sallie", [], { teleprompter: "x" }]) {
      assert.throws(() => projectFiles(hers({ explainer: bad })), /explainer/, JSON.stringify(bad));
    }
  });
});

describe("voiceCopyArgs, the sound of a voice made ready for HyperFrames (PR H6)", () => {
  const argv = voiceCopyArgs("/in/Voice memo.m4a", "/work/1234-5678.m4a", { streams: { video: null, audio: 0, unreadable: [] } });
  const at = (flag) => argv[argv.indexOf(flag) + 1];
  it("takes the sound alone: no picture, the sound stream by its number, no subtitles or data", () => {
    assert.ok(argv.includes("-vn") && argv.includes("-sn") && argv.includes("-dn"));
    assert.equal(at("-i"), "/in/Voice memo.m4a");
    assert.deepEqual(argv.reduce((maps, a, i) => (a === "-map" ? [...maps, argv[i + 1]] : maps), []), ["0:0"]);
    assert.equal(argv[argv.length - 1], "/work/1234-5678.m4a");
    for (const flag of ["-vf", "-c:v", "-crf", "-preset", "-pix_fmt"]) assert.ok(!argv.includes(flag), flag);
  });
  it("writes AAC at 48 kHz, as every video the tool makes has its sound", () => {
    assert.equal(at("-c:a"), "aac");
    assert.equal(at("-ar"), "48000");
  });
  it("puts the sound on the file's own clock, with silence where it has none, so that a time in the words is a time in the copy", () => {
    assert.equal(at("-af"), "aresample=async=1:first_pts=0");
    for (const flag of ["-ss", "-t", "-to", "-itsoffset"]) assert.ok(!argv.includes(flag), flag);
  });
  it("is run without asking anything, loudly only about errors, and over a file of its own", () => {
    assert.deepEqual(argv.slice(0, 5), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"]);
    assert.equal(at("-f"), "mp4");
  });
  it("maps the number it is given: a sound that is not the first stream, in a file that has a cover picture", () => {
    const other = voiceCopyArgs("/a.m4a", "/b.m4a", { streams: { video: 1, audio: 2, unreadable: [] } });
    assert.deepEqual(other.reduce((maps, a, i) => (a === "-map" ? [...maps, other[i + 1]] : maps), []), ["0:2"]);
  });
  it("is null for a file with no sound this Mac's ffmpeg can read, and for streams it was not given", () => {
    assert.equal(voiceCopyArgs("/a.m4a", "/b.m4a", { streams: { video: null, audio: null, unreadable: ["apple_apac"] } }), null);
    assert.equal(voiceCopyArgs("/a.m4a", "/b.m4a", {}), null);
    assert.equal(voiceCopyArgs("/a.m4a", "/b.m4a"), null);
  });
});

// --- Step 3: the voice made a video, its copy, and its project ---

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE_FILE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const SPOKEN = "Too many SKUs will sink a small shop before it ever finds its footing. The first thing you need to do is count what you actually sell each week.";
/** The captions the transcriber writes of a voice that says the plan's words: each line of the script a caption. */
const VOICE_SRT = "1\n00:00:00,000 --> 00:00:04,000\nToo many SKUs will sink a small shop before it ever finds its footing.\n\n2\n00:00:04,000 --> 00:00:09,000\nThe first thing you need to do is count what you actually sell each week.\n";
/** What ffprobe prints of a recording of sound alone: AAC at 48 kHz, no picture, `seconds` long. */
const VOICE_PROBE = (seconds = "182.000000", sound = { codec_name: "aac", sample_rate: "48000", channels: 2 }) => probed({ picture: null, sound, duration: seconds });
/** What ffprobe prints of a recording with a picture and a sound. */
const PICTURE_PROBE = probed({ picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p" }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2 }, duration: "60.000000" });

/** A folder for one test with the programs' stand-ins: ffprobe prints what `script.probes` has for the file's name (a voice of `script.seconds` seconds
    otherwise), ffmpeg writes the file it is told to, and the transcriber is the made-up recording's. Each program asked is written down in `t.calls`;
    the launch agent is asked through `t.kicks`. This Mac is set up for HyperFrames, whose command line is the stand-in, which opens a project. */
function world(script = {}) {
  const t = setup({
    ...(script.machine ? { machine: script.machine } : {}),
    programs: {
      // The transcriber writes the captions of the voice, as it does of the made-up recording: the same words, said evenly over each caption.
      WHISPER: (args) => {
        const base = args[args.indexOf("-of") + 1];
        writeFileSync(`${base}.srt`, VOICE_SRT);
        if (args.includes("-ojf")) writeFileSync(`${base}.json`, JSON.stringify(toldOf(VOICE_SRT)));
        return { code: 0, stderr: "" };
      },
      FFPROBE: (args) => {
        const name = args[args.length - 1].split("/").pop();
        if ((script.fails || []).includes(name)) return { code: 1, stderr: "moov atom not found\n" };
        // A copy of the voice (<size>-<time>.m4a) is as long as `script.copySeconds` says, the voice's own length otherwise.
        const printed = (script.probes || {})[name] ?? VOICE_PROBE(/^\d+-\d+\.m4a$/.test(name) && script.copySeconds ? script.copySeconds : script.seconds);
        writeFileSync(args[args.indexOf("-o") + 1], printed);
        return { code: 0, stderr: "" };
      },
      FFMPEG: (args) => {
        const out = args[args.length - 1];
        if (out !== "-") writeFileSync(out, args.includes("pcm_s16le") ? "RIFF" : "a voice copy");
        return { code: 0, stderr: "" };
      }
    }
  });
  writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE_FILE };
  const kicks = [];
  t.kicks = kicks;
  t.ctx.deps.kickstart = () => kicks.push("kickstart");
  return t;
}
/** What the stand-in command line was run with on this Mac, one run each. */
const runsOf = (t) => (existsSync(join(t.home, "hyperframes-stand-in.log")) ? readFileSync(join(t.home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
const workOf = (t, title = TITLE) => episodeWork(t.home, nameOf(t, title));
const READY = (title = TITLE) => `Ready: "${title}" has its voice. In Claude, say "what's next?"`;
/** The files a light import leaves of a recording called `stem`, by their names. */
const LIGHT_NAMES = (stem) => ["srt", "transcript.txt", "words.json", "cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt"].map((e) => `${stem}.${e}`);
/** The files a light import holds of a recording called `stem` that says `words`. */
const LIGHT = (stem, words) => ({
  [`${stem}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.m4a`, duration: 182, words: words.map((w, i) => ({ w, start: i * 0.4, end: i * 0.4 + 0.3 })) }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.m4a` }),
  [`${stem}.cut-plan.txt`]: "The cut plan.\n",
  [`${stem}.rough-cut.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.rough-cut.transcript.txt`]: "[0:00] words\n"
});
/** A recording of sound alone dropped and answered as the voiceover of the plan: its episode folder with the recording and its light import's files,
    its record at layout 5 as a part. Returns what partsOf lists of it. */
function voicePart(t, n, { stem = `Voice ${n}`, words = SPOKEN.split(" "), record = {}, files = true } = {}) {
  const name = `2026-11-04 Drop ${n} (Mac Studio)`;
  const folder = join(t.root, "Episodes", name);
  mkdirSync(join(folder, "record"), { recursive: true });
  const held = { [`${stem}.m4a`]: `voice ${n}`, ...(files ? LIGHT(stem, words) : {}) };
  for (const [rel, text] of Object.entries(held)) writeFileSync(join(folder, rel), text);
  const sizes = Object.fromEntries(Object.entries(held).map(([rel, text]) => [rel, Buffer.byteLength(text)]));
  const made = newEpisode({
    id: idOf(n), machine: "Mac Studio", at: "2026-11-04T09:00:00-05:00", video: { file: `${stem}.m4a`, bytes: sizes[`${stem}.m4a`], seconds: 182, created: null }, kind: null, writer: WRITER,
    files: sizes, label: labelOf(n), fingerprint: `fp${n}`, answer: { ...SOUND_ONLY }
  });
  const next = { ...made, rev: 2, version: 5, answer: { ...made.answer, state: "part", by: "Mac Studio", on: "Mac Studio", at: `2026-11-04T09:3${n}:00-05:00`, private: "no" }, partOf: { id: planIdOf(t), as: "voiceover", shot: null, client: null }, ...record };
  writeFileSync(recordFile(folder, 2), recordText(next));
  return { name, folder, record: readEpisode(folder).record };
}
/** Every file of the test's folders, whole, by its path. */
const treeOf = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));

describe("the join run, with a voiceover: the plan made its video from its voice (PR H6)", () => {
  /** The run `footage … voiceover` and `plan … join` start, as the detached run runs it. */
  const joinRun = (t, ids, over = {}) => on(depsOf(t, over), "join", "--now", nameOf(t), "--parts", ids.join(","));
  const resultOf = (t) => readResult(t.home, nameOf(t), "join");
  const COULD_NOT = (why) => `The voice of "${TITLE}" couldn't be taken in: ${why}.`;

  it("makes the plan its video: the voiceover and its light import's files are cloned in under their own names, and the record is written last as a short video whose video is the voiceover", async () => {
    const t = world();
    const folder = await explainer(t, { voice: null });
    const one = voicePart(t, 1);
    const plan = planOf(t);
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(listAll(folder), ["Voice 1.m4a", ...LIGHT_NAMES("Voice 1"), "record/0001.json", "record/0002.json", "record/0003.json", "teleprompter.txt", "video guide.md"].sort());
    for (const rel of ["Voice 1.m4a", ...LIGHT_NAMES("Voice 1")]) assert.equal(readFileSync(join(folder, rel), "utf8"), readFileSync(join(one.folder, rel), "utf8"), rel);
    const now = readEpisode(folder).record;
    assert.deepEqual([now.rev, now.version, now.kind, now.id, now.name], [3, 5, "short video", plan.id, plan.name]);
    assert.equal(episodeFault(now), "");
    assert.deepEqual([isPlannedRecord(now), isFromPlan(now), layoutOf(now)], [false, true, 5]);
    assert.deepEqual(now.video, { file: "Voice 1.m4a", bytes: 7, seconds: 182, recorded: dayOf(t), recordedFrom: "import" });
    assert.equal(now.fingerprint, "fp1");
    assert.deepEqual(now.answer, { state: "answered", guess: null, seen: "sound only, 3:02", came: "sound", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" });
    // The plan is kept as it was, but for its voice, which a voiceover makes hers when it had none, and when it was filmed, and of which part.
    assert.deepEqual(now.planned, { ...plan.planned, voice: "sallie", filmed: { at: atOf(t), parts: [one.record.id] } });
    assert.deepEqual([now.editing, now.archived, now.finished, now.reading, now.app], [null, null, null, undefined, undefined]);
    t.done();
  });
  it("is a short video whatever the voice is: a recording of sound alone is a raw episode to the import's rule, and an hour of it is one still", async () => {
    for (const seconds of ["182.000000", "3700.000000"]) {
      const t = world({ seconds });
      await explainer(t);
      const one = voicePart(t, 1);
      assert.equal((await joinRun(t, [one.record.id])).code, 0);
      assert.equal(planOf(t).kind, "short video", seconds);
      t.done();
    }
  });
  it("keeps the late check on this Mac, for the video and the files put in, under a drop file that is nobody's", async () => {
    const t = world();
    const folder = await explainer(t);
    const one = voicePart(t, 1);
    await joinRun(t, [one.record.id]);
    const [pending] = readPendings(t.home);
    const now = planOf(t);
    assert.deepEqual([pending.id, pending.name, pending.folder, pending.machine, pending.video, pending.label], [now.id, nameOf(t), folder, "Mac Studio", "Voice 1.m4a", TITLE]);
    assert.ok(!pending.drop.startsWith(one.folder) && !pending.drop.startsWith(t.root), pending.drop);
    assert.deepEqual(pending.entries.map((e) => e.to.slice(folder.length + 1)).sort(), ["Voice 1.m4a", ...LIGHT_NAMES("Voice 1"), "record/0003.json"].sort());
    t.done();
  });
  it("starts Claude's reading of the video as a short video, asks for the working copy, asks the launch agent to make the late check, and posts its notice", async () => {
    const t = world();
    await explainer(t);
    const one = voicePart(t, 1);
    t.started.length = 0;
    await joinRun(t, [one.record.id], { settings: { ...t.ctx.settings, app: "hyperframes" } });
    const rev = planOf(t).rev;
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", nameOf(t), "--kind", "short video", "--rev", String(rev)], ["workcopy", "--now", nameOf(t)]]);
    assert.deepEqual(t.notices, [READY()]);
    assert.deepEqual(t.kicks, ["kickstart"]);
    assert.deepEqual([resultOf(t).ok, resultOf(t).failed, resultOf(t).command], [true, [], "join"]);
    t.done();
  });
  it("stops, in words, a voiceover that has no sound this Mac can read, before anything is filed: a video with no sound takes no kind (the plan's ruling 22)", async () => {
    for (const [what, probe] of [["no sound at all", VOICE_PROBE("182.000000", null)], ["only a sound this Mac cannot read", VOICE_PROBE("182.000000", { codec_name: "apple_apac" })]]) {
      const t = world({ probes: { "Voice 1.m4a": probe } });
      await explainer(t);
      const one = voicePart(t, 1);
      const before = treeOf(t);
      const r = await joinRun(t, [one.record.id]);
      assert.equal(r.code, 1, what);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(`${labelOf(1)} has no sound, so it can't be a voiceover`)], what);
      const after = treeOf(t);
      assert.deepEqual(Object.keys(after).filter((rel) => !(rel in before)), [`home/BRIMM Video Work/${nameOf(t)}/join.result.json`], what);
      assert.deepEqual([planOf(t).kind, readPendings(t.home), t.notices, t.started], [null, [], [], []], what);
      assert.equal(readdirSync(join(t.home, "BRIMM Video Work", ".runs")).filter((n) => n.startsWith("join-")).length, 0, "the run's own folder is gone");
      t.done();
    }
  });
  it("stops a voiceover that has a picture, and one ffprobe cannot read, in words, and leaves the plan as it was", async () => {
    for (const [probes, fails, why] of [[{ "Voice 1.m4a": PICTURE_PROBE }, [], `${labelOf(1)} has a picture: a voiceover is sound alone`], [{}, ["Voice 1.m4a"], `${labelOf(1)} could not be read as a sound`]]) {
      const t = world({ probes, fails });
      await explainer(t);
      const one = voicePart(t, 1);
      const plan = planOf(t);
      assert.equal((await joinRun(t, [one.record.id])).code, 1, why);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(why)], why);
      assert.deepEqual([planOf(t), readPendings(t.home)], [plan, []], why);
      t.done();
    }
  });
  it("refuses, as `plan … join` does, a plan with no voiceover, a voiceover held by a conflict, and parts that are not its voiceover: the words are joinCase's", async () => {
    const t = world();
    await explainer(t);
    const none = await joinRun(t, [idOf(1)]);
    assert.equal(none.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`"${TITLE}" has no voiceover yet: a video needs one`)]);
    const one = voicePart(t, 1);
    voicePart(t, 2);
    assert.equal((await joinRun(t, [one.record.id])).code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`"${TITLE}" has more than one voiceover: ${labelOf(1)}, ${labelOf(2)}. Take the others back, each with "that's not footage for ${TITLE}"`)]);
    t.done();
    const u = world();
    await explainer(u);
    const only = voicePart(u, 1);
    assert.equal((await joinRun(u, [idOf(2)])).code, 1);
    assert.deepEqual(readResult(u.home, nameOf(u), "join").failed, [COULD_NOT(`Those aren't the voiceover of "${TITLE}". It is: ${labelOf(1)}`)]);
    writeFileSync(join(only.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(only.record));
    assert.equal((await joinRun(u, [only.record.id])).code, 1);
    assert.ok(readResult(u.home, nameOf(u), "join").failed[0].includes("Dropbox has kept a conflicted copy"), readResult(u.home, nameOf(u), "join").failed[0]);
    u.done();
  });
  it("is then a video of its own: a second `plan … join` says it is made already", async () => {
    const t = world();
    await explainer(t);
    const one = voicePart(t, 1);
    await joinRun(t, [one.record.id]);
    assert.deepEqual((await on(depsOf(t), "plan", TITLE, "join")).said, [`"${TITLE}" is made from its footage already.`]);
    t.done();
  });
  it("is started by `plan … join` for an explainer with its voiceover, who is told in words, and the run takes the one voiceover", async () => {
    const t = world();
    await explainer(t);
    const one = voicePart(t, 1);
    const said = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([said.code, said.said], [0, [`The voiceover of "${TITLE}" is being taken in. A notice comes when it is ready.`]]);
    assert.deepEqual(t.started[0][1].slice(1), ["join", "--now", nameOf(t), "--parts", one.record.id]);
    const named = await on(depsOf(t), "plan", TITLE, "join", labelOf(1));
    assert.deepEqual(named.said, [`The voiceover of "${TITLE}" is being taken in. A notice comes when it is ready.`]);
    const wrong = await on(depsOf(t), "plan", TITLE, "join", "Nothing like it");
    assert.deepEqual([wrong.code, wrong.said], [1, [`Those aren't the voiceover of "${TITLE}". It is: ${labelOf(1)}.`]]);
    t.done();
  });
});

/** An explainer in her voice, made its video by the join run, its late check passed, so that nothing waits for the import: its folder and its part. */
async function madeExplainer(t, { title = TITLE, voice = "sallie", words } = {}) {
  const folder = await explainer(t, { title, voice });
  const one = voicePart(t, 1, words ? { words } : {});
  const joined = await on(depsOf(t), "join", "--now", nameOf(t, title), "--parts", one.record.id);
  assert.equal(joined.code, 0, joined.text);
  const [pending] = readPendings(t.home);
  const checked = finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true });
  assert.deepEqual(checked.problems, []);
  t.started.length = 0;
  return { folder, one };
}
const copiesOf = (t, title = TITLE) => {
  try {
    return readdirSync(workCopyDir(t.home, nameOf(t, title))).sort();
  } catch (e) {
    return [];
  }
};

describe("mediaOf and videoIn, the video a project holds (PR H6)", () => {
  const fromPlan = (voice, route = "explainer") => {
    const made = plan({ route, voice, title: TITLE });
    return { ...made, kind: "short video", video: { file: "Voice 1.m4a", bytes: 5, seconds: 182, recorded: "2026-11-04", recordedFrom: "import" }, answer: { state: "answered", guess: null, seen: "sound only, 3:02", came: "sound", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" }, planned: { ...made.planned, filmed: { at: AT, parts: [] } } };
  };
  it("is media/voiceover.m4a for an explainer in her voice, none for one in a HeyGen voice, and media/recording.mp4 for any other record", async () => {
    const { mediaOf, videoIn } = await import("../app.js");
    assert.equal(mediaOf(fromPlan("sallie")), "media/voiceover.m4a");
    assert.equal(mediaOf(fromPlan(null)), "media/voiceover.m4a", "an explainer whose voice was never chosen is hers");
    assert.equal(mediaOf(fromPlan("heygen")), null);
    for (const other of [fromPlan(null, "script"), { kind: "raw", video: { file: "a.mov" } }, { kind: "short video" }, plan({ voice: "sallie" }), plan({ voice: "heygen" }), null, undefined, {}]) assert.equal(mediaOf(other), "media/recording.mp4", JSON.stringify(other)?.slice(0, 50));
    assert.equal(videoIn("/work/P", fromPlan("sallie")), join("/work/P", "media", "voiceover.m4a"));
    assert.equal(videoIn("/work/P", { kind: "raw" }), join("/work/P", "media", "recording.mp4"));
    assert.equal(videoIn("/work/P"), join("/work/P", "media", "recording.mp4"), "a Reel's project has none of this: its video is the recording's");
    assert.equal(videoIn("/work/P", fromPlan("heygen")), null, "a project with no media has no video to put back or take away");
  });
});

describe("app, for an explainer in her voice: the project from sound (PR H6)", () => {
  const BUTTONS = "In HyperFrames, share only with people you invite, and export on This Mac: the Export dialog may start on Cloud. The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now.";
  const PROJECT = "Why SKUs sink you main 400000";
  const treeIn = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((rel) => [rel, statSync(join(dir, rel)).isFile() ? readFileSync(join(dir, rel), "utf8") : null]));
  /** The explainer made its video, its voice copied for HyperFrames, and `app` asked: the world after, and what app said. */
  async function opened() {
    const t = world();
    const made = await madeExplainer(t);
    assert.equal((await on(depsOf(t), "workcopy", "--now", nameOf(t))).code, 0);
    const r = await on(depsOf(t), "app", TITLE);
    return { t, ...made, r, project: join(workOf(t), PROJECT) };
  }
  it("makes the project from the voice's copy, moves the copy in as media/voiceover.m4a, opens it, and records it as a short video's main project", async () => {
    const { t, r, project } = await opened();
    assert.deepEqual([r.code, r.said], [0, ["It's open in HyperFrames.", BUTTONS]]);
    const tree = treeIn(project);
    assert.equal(tree["media/voiceover.m4a"], "a voice copy");
    assert.ok(!("media/recording.mp4" in tree), "no recording");
    assert.deepEqual(copiesOf(t).filter((n) => n.endsWith(".m4a")), [], "the copy was moved in, not copied");
    assert.equal(tree["index.html"], explainerHtml({ seconds: 182 }, { voiceover: true }));
    assert.equal(tree["brimm/teleprompter.txt"], "Too many SKUs will sink a small shop before it ever finds its footing.\n\nThe first thing you need to do is count what you actually sell each week.\n");
    const now = planOf(t);
    assert.equal(episodeFault(now), "");
    assert.deepEqual(now.app.projects.map((p) => [p.key, p.name, p.on, p.state, p.opened, p.handover, p.fromSuggestion]), [["main", PROJECT, "Mac Studio", "opened", [atOf(t)], false, null]]);
    assert.deepEqual(now.app.projects[0].workingCopy, { bytes: 12, seconds: 182, fps: 30 });
    assert.deepEqual(now.app.projects[0].from.file, "Voice 1.m4a");
    assert.deepEqual(runsOf(t).map((run) => run.args), [["open", project, "--json"]]);
    t.done();
  });
  it("puts the voiceover's words in transcript.json and the guide's cues on them, graphic and words cues alone, each at its own place", async () => {
    const { t, project } = await opened();
    const words = JSON.parse(readFileSync(join(project, "transcript.json"), "utf8"));
    assert.deepEqual(words.map((w) => w.text), SPOKEN.split(" "));
    const cues = JSON.parse(readFileSync(join(project, "brimm", "graphic-cues.json"), "utf8"));
    assert.equal(cues.clock, "recording");
    assert.deepEqual(cues.cues.map((c) => [c.n, c.kind, c.words, c.at !== null]), [[1, "graphic", "too many SKUs", true], [2, "words", "count what you sell", true]]);
    assert.deepEqual([cues.cues[0].at.from, cues.cues[0].at.to], ["w0", "w2"]);
    // The cut suggestions are the rules' own, as for any short video, from the import's plan.
    assert.deepEqual(JSON.parse(readFileSync(join(project, "brimm", "cut-suggestions.json"), "utf8")).suggestions, []);
    t.done();
  });
  it("tells the agent what it is in its notes: an explainer, upright, with the cues on the voiceover's clock, and no footage rule", async () => {
    const { t, project } = await opened();
    const notes = readFileSync(join(project, "CLAUDE.md"), "utf8");
    assert.equal(notes, readFileSync(join(project, "AGENTS.md"), "utf8"));
    for (const line of ["- **This explainer.** It is graphics and words on screen over a voice, with no video of her. Keep it upright, 1080 by 1920: it is exported and handed off at that size.",
      "- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/voiceover.m4a`, which is the voiceover's own: nothing was cut from it."]) assert.ok(notes.split("\n").includes(line), line);
    assert.ok(notes.includes("word ids and times on the voiceover's clock. After the cuts"));
    assert.ok(!notes.includes("Footage cues") && !notes.includes("media/recording.mp4"));
    t.done();
  });
  it("opens it again as it is, with one more time in the record, and makes nothing", async () => {
    const { t, project } = await opened();
    const before = treeIn(project);
    const again = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([again.code, again.said], [0, ["It's open in HyperFrames.", BUTTONS]]);
    assert.deepEqual(treeIn(project), before);
    assert.equal(planOf(t).app.projects[0].opened.length, 2);
    t.done();
  });
  it("asks for the voice's copy when it is not made, and says so, as for a video's: nothing is made until it is", async () => {
    const t = world();
    await madeExplainer(t);
    const r = await on(depsOf(t), "app", TITLE);
    assert.equal(r.code, 0, r.text);
    assert.match(r.said[0], /^The video for HyperFrames is being made\./);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", nameOf(t)]]);
    assert.equal(existsSync(join(workOf(t), PROJECT)), false);
    assert.deepEqual(planOf(t).app, undefined);
    t.done();
  });
  it("takes the voice away with `free`, and puts it back at the next open from a copy made again, as a video's is", async () => {
    const { t, project } = await opened();
    const freed = await on(depsOf(t), "free", TITLE);
    assert.equal(freed.code, 0, freed.text);
    assert.equal(existsSync(join(project, "media", "voiceover.m4a")), false);
    assert.deepEqual(copiesOf(t), []);
    assert.match(freed.said.join("\n"), /Took away the video made for HyperFrames/);
    // The next open asks for the copy again, and the one after puts it in.
    const asked = await on(depsOf(t), "app", TITLE);
    assert.equal(asked.code, 0, asked.text);
    assert.match(asked.said[0], /^The video for HyperFrames is being made\./);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)).at(-1), ["workcopy", "--now", nameOf(t)]);
    assert.equal((await on(depsOf(t), "workcopy", "--now", nameOf(t))).code, 0);
    const back = await on(depsOf(t), "app", TITLE);
    assert.equal(back.code, 0, back.text);
    assert.equal(back.said[0], `The video for ${TITLE} was made again, and it is in the project.`);
    assert.equal(readFileSync(join(project, "media", "voiceover.m4a"), "utf8"), "a voice copy");
    t.done();
  });
  it("is not changed by an export being older than the voice put back: the voiceover's own time is no edit of the project", async () => {
    const { lastChangeOf } = await import("../exports.js");
    assert.equal(lastChangeOf({ files: [{ path: "media/voiceover.m4a", mtimeMs: 9e12 }, { path: "media/recording.mp4", mtimeMs: 9e12 }, { path: "index.html", mtimeMs: 5 }] }), 5);
    assert.equal(lastChangeOf({ files: [{ path: "media/other.m4a", mtimeMs: 9e12 }] }), 9e12);
  });
});

describe("voiceCopyPaths and voiceCopyFacts, the copy of a voice (PR H6)", () => {
  it("puts the copy in the folder of the working copies as <key>.m4a, with its facts beside it as <key>.json", () => {
    const key = workCopyKey({ bytes: 5, mtimeMs: 1234 });
    const paths = voiceCopyPaths("/home", "2026-11-04 Why (Mac Studio)", key);
    assert.deepEqual(paths, { dir: workCopyDir("/home", "2026-11-04 Why (Mac Studio)"), video: join(paths.dir, "5-1234.m4a"), facts: join(paths.dir, "5-1234.json") });
    for (const bad of ["", "x", "5-1234-4k", "5-1234.m4a", undefined]) assert.throws(() => voiceCopyPaths("/home", "a", bad), /key/, String(bad));
    assert.throws(() => voiceCopyPaths("/home", "../x", key), /own folder/);
  });
  it("says the copy's length, size and the page's own size and rate, and that it has sound: the facts every working copy's project is checked against", () => {
    assert.deepEqual(voiceCopyFacts(VOICE_PROBE("182.400000"), 4096), { seconds: 182.4, bytes: 4096, width: 1080, height: 1920, fps: 30, sound: true });
  });
  it("is null for a file with no length, no sound, or a picture: what ffmpeg wrote is a sound alone", () => {
    assert.equal(voiceCopyFacts("not JSON", 1), null);
    assert.equal(voiceCopyFacts(VOICE_PROBE("182.000000", null), 1), null);
    assert.equal(voiceCopyFacts(PICTURE_PROBE, 1), null);
    assert.equal(voiceCopyFacts(probed({ picture: null, sound: { codec_name: "aac" }, duration: "0" }), 1), null);
  });
});

describe("workcopy, for an explainer in her voice: the sound alone (PR H6)", () => {
  const WORKCOPY = (t) => ["workcopy", "--now", nameOf(t)];
  it("makes <key>.m4a of the voiceover, with its facts beside it, by the sound-only arguments, and says it is done", async () => {
    const t = world();
    const { folder } = await madeExplainer(t);
    const raw = statSync(join(folder, "Voice 1.m4a"));
    const key = workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs });
    const r = await on(depsOf(t), ...WORKCOPY(t));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copiesOf(t), [`${key}.json`, `${key}.m4a`]);
    const dir = workCopyDir(t.home, nameOf(t));
    assert.equal(readFileSync(join(dir, `${key}.m4a`), "utf8"), "a voice copy");
    assert.deepEqual(JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8")), { seconds: 182, bytes: 12, width: 1080, height: 1920, fps: 30, sound: true });
    // ffmpeg was asked once, for the sound alone, over a file of the run's own named as the copy is.
    const asked = t.calls.filter((c) => c.cmd === "FFMPEG");
    assert.equal(asked.length, 1);
    assert.ok(asked[0].args.includes("-vn") && !asked[0].args.includes("-vf"), asked[0].args.join(" "));
    assert.equal(asked[0].args.at(-1).split("/").pop(), `${key}.m4a`);
    assert.ok(asked[0].args.at(-1).startsWith(join(t.home, "BRIMM Video Work", ".runs")), "made in the run's own folder, then put in place whole");
    assert.deepEqual(readResult(t.home, nameOf(t), "workcopy").failed, []);
    t.done();
  });
  it("makes it once: the copy is there already the second time, and no footage is made for it (an explainer has none)", async () => {
    const t = world();
    await madeExplainer(t);
    assert.equal((await on(depsOf(t), ...WORKCOPY(t))).code, 0);
    const before = t.calls.filter((c) => c.cmd === "FFMPEG").length;
    assert.equal((await on(depsOf(t), ...WORKCOPY(t))).code, 0);
    assert.equal(t.calls.filter((c) => c.cmd === "FFMPEG").length, before, "made already");
    assert.equal(copiesOf(t).filter((n) => n.startsWith("footage-")).length, 0);
    t.done();
  });
  it("takes away the copy made for an earlier version of the voice, by its whole name, and leaves nothing else", async () => {
    const t = world();
    await madeExplainer(t);
    const dir = workCopyDir(t.home, nameOf(t));
    mkdirSync(dir, { recursive: true });
    for (const stale of ["9-9.m4a", "9-9.json", "9-9-4k.mp4", "notes.txt"]) writeFileSync(join(dir, stale), "old");
    assert.equal((await on(depsOf(t), ...WORKCOPY(t))).code, 0);
    // Every copy of another key goes, a 4K video's among them (one copy of an episode is kept), and a file that is no copy's by its whole name stays.
    assert.deepEqual(copiesOf(t).filter((n) => !/^\d+-\d+\.(m4a|json)$/.test(n) || n.startsWith("9-")), ["notes.txt"]);
    t.done();
  });
  it("refuses, in words, a voice that has no sound this Mac can read and a copy that came out the wrong length, and leaves no copy", async () => {
    const script = { probes: {} };
    const t = world(script);
    await madeExplainer(t);
    const failed = async () => {
      const r = await on(depsOf(t), ...WORKCOPY(t));
      assert.equal(r.code, 1, r.text);
      return readResult(t.home, nameOf(t), "workcopy").failed;
    };
    script.probes["Voice 1.m4a"] = VOICE_PROBE("182.000000", null);
    assert.deepEqual(await failed(), ["It can't be used: there is no sound in it."]);
    script.probes["Voice 1.m4a"] = VOICE_PROBE("182.000000", { codec_name: "apple_apac" });
    assert.deepEqual(await failed(), ["It can't be used: its sound is in a form this Mac can't read."]);
    delete script.probes["Voice 1.m4a"];
    script.copySeconds = "40.000000";
    assert.deepEqual(await failed(), ["It can't be used: what was made came out the wrong length."]);
    assert.deepEqual(copiesOf(t), []);
    assert.equal(readdirSync(join(t.home, "BRIMM Video Work", ".runs")).filter((n) => n.startsWith("workcopy-")).length, 0, "the run's own folder is gone");
    t.done();
  });
  it("is the voiceover's copy for a video of any kind a copy is made for: a short video, and asks nothing of a Reel or 4K", async () => {
    const t = world();
    await madeExplainer(t);
    const fourK = await on(depsOf(t), ...WORKCOPY(t), "--4k");
    assert.equal(fourK.code, 0, fourK.text);
    assert.ok(copiesOf(t).every((n) => !n.includes("-4k")), copiesOf(t).join(" "));
    t.done();
  });
});

// --- A HeyGen voice: the plan's project before the voice, the voice said to be done, and the voice taken in ---

const HEYGEN_PROJECT = "Why SKUs sink you main 400000";
const BUTTONS_SAID = "In HyperFrames, share only with people you invite, and export on This Mac: the Export dialog may start on Cloud. The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now.";
/** Every file of a project folder with its text, by its path (a folder is null). */
const projectTree = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((rel) => [rel, statSync(join(dir, rel)).isFile() ? readFileSync(join(dir, rel), "utf8") : null]));
/** What the app's agent does in the project when it makes the voice: the file saved into assets/ and the page playing it. Gives the project's folder. */
function voiceMade(t, { name = "HeyGen voice 1.wav", audio, extra = {} } = {}) {
  const dir = join(workOf(t), HEYGEN_PROJECT);
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "assets", name), "a heygen voice");
  for (const [rel, text] of Object.entries(extra)) writeFileSync(join(dir, rel), text);
  const tag = audio ?? `<audio id="voice" src="assets/${name.replaceAll(" ", "%20")}" data-start="0" data-duration="12" data-track-index="0" data-volume="1"></audio>`;
  writeFileSync(join(dir, "index.html"), readFileSync(join(dir, "index.html"), "utf8").replace("</body>", `${tag}\n  </body>`));
  return dir;
}
/** A HeyGen explainer planned, its package set and its project made and opened by `app`: its folder and its project's. */
async function heygenOpened(t, over = {}) {
  const folder = await explainer(t, { voice: "heygen", ...over });
  const r = await on(depsOf(t), "app", TITLE);
  assert.equal(r.code, 0, r.text);
  return { folder, dir: join(workOf(t), HEYGEN_PROJECT) };
}
/** The plan's record written once more, as the other Mac or Dropbox might leave it: the next number, whatever `change` makes of the plan. */
function rewritten(folder, change) {
  const { record } = readEpisode(folder);
  const next = change({ ...record, rev: record.rev + 1 });
  writeFileSync(recordFile(folder, next.rev), recordText(next));
  return next;
}
const GATE_SAYS = (title) => `"${title}" is a planned video, and it isn't made from its footage yet.`;

describe("onMac and voiceSeconds, the small words of a HeyGen explainer's project (PR H6)", () => {
  it("names a Mac as a person does: the Mac Studio, and a name that is her own as it is", () => {
    assert.equal(onMac("Mac Studio"), "the Mac Studio");
    assert.equal(onMac("Mac mini"), "the Mac mini");
    assert.equal(onMac("Sallie's laptop"), "Sallie's laptop");
    assert.equal(onMac("Studio Mac"), "Studio Mac");
  });
  it("is the script's length at 150 words a minute, to the next whole second, and at least ten seconds", () => {
    const words = (n) => [Array.from({ length: n }, () => "word").join(" ")];
    assert.equal(voiceSeconds(words(28)), 12, "28 words are 11.2 seconds");
    assert.equal(voiceSeconds(words(25)), 10, "25 words are exactly 10");
    assert.equal(voiceSeconds(words(26)), 11, "26 words are 10.4");
    assert.equal(voiceSeconds(words(450)), 180);
    assert.equal(voiceSeconds(words(3)), 10, "at least ten seconds");
    assert.equal(voiceSeconds([]), 10);
    assert.equal(voiceSeconds(["One two.", "Three four five", ""]), 10);
    assert.equal(voiceSeconds(["a ".repeat(100).trim(), "b ".repeat(100).trim(), "c ".repeat(100).trim()]), 120, "lines add up, a paragraph each");
  });
});

describe("app, for a planned HeyGen explainer: its project, with no media (PR H6)", () => {
  it("makes an upright project from the package, with no media, opens it, and writes it into the plan in one write", async () => {
    const t = world();
    await explainer(t, { voice: "heygen" });
    const before = planOf(t);
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [0, ["It's open in HyperFrames.", BUTTONS_SAID]]);
    const dir = join(workOf(t), HEYGEN_PROJECT);
    const tree = projectTree(dir);
    assert.deepEqual(Object.keys(tree).filter((rel) => rel === "media" || rel.startsWith("media/")), [], "no media at all");
    // 28 words at 150 a minute are 11.2 seconds: the page is as long as that, to the next whole second.
    assert.equal(tree["index.html"], explainerHtml({ seconds: 12 }));
    assert.deepEqual(JSON.parse(tree["transcript.json"]), []);
    assert.equal(tree["brimm/teleprompter.txt"], "Too many SKUs will sink a small shop before it ever finds its footing.\n\nThe first thing you need to do is count what you actually sell each week.\n");
    const cues = JSON.parse(tree["brimm/graphic-cues.json"]);
    assert.deepEqual(cues.cues.map((c) => [c.n, c.kind, c.words, c.seconds, c.at]), [[1, "graphic", "too many SKUs", 4, null], [2, "words", "count what you sell", 3, null]]);
    const facts = JSON.parse(tree["brimm/facts.json"]);
    assert.deepEqual([facts.kind, facts.seconds, facts.width, facts.height, facts.fps], ["main", 12, 1080, 1920, 30]);
    const notes = tree["CLAUDE.md"];
    assert.equal(notes, tree["AGENTS.md"]);
    for (const line of ["- **Its voice.** A stock HeyGen voice she chooses reads it.", "- **The words.** There are none yet:", "- **This explainer.** It is graphics and words on screen over a voice"]) assert.ok(notes.split("\n").some((l) => l.startsWith(line)), line);
    // One write: the plan is still a plan, with its project in it and nothing else changed.
    const now = planOf(t);
    assert.equal(episodeFault(now), "");
    assert.deepEqual([now.rev, isPlannedRecord(now), now.kind, now.app, now.editing], [before.rev + 1, true, null, undefined, before.editing]);
    assert.deepEqual(now.planned, { ...before.planned, project: { name: HEYGEN_PROJECT, madeAt: atOf(t), on: "Mac Studio", opened: [atOf(t)] } });
    assert.deepEqual(runsOf(t).map((run) => run.args), [["open", dir, "--json"]]);
    // Nothing is claimed, brought or asked for: a plan has no video to copy.
    assert.deepEqual([t.started, t.notices, copiesOf(t)], [[], [], []]);
    t.done();
  });
  it("makes the page as long as the script at 150 words a minute, and at least ten seconds", async () => {
    for (const [lines, seconds] of [[["--line", "Count what you sell."], 10], [["--line", "a ".repeat(150).trim(), "--line", "b ".repeat(150).trim(), "--line", "c ".repeat(150).trim()], 180]]) {
      const t = world();
      await explainer(t, { voice: "heygen", set: false });
      assert.equal((await on(depsOf(t), "plan", TITLE, "set", ...CUES, ...lines)).code, 0);
      assert.equal((await on(depsOf(t), "app", TITLE)).code, 0);
      const tree = projectTree(join(workOf(t), HEYGEN_PROJECT));
      assert.equal(tree["index.html"], explainerHtml({ seconds }), String(seconds));
      assert.equal(JSON.parse(tree["brimm/facts.json"]).seconds, seconds);
      t.done();
    }
  });
  it("opens it again as the app's agent left it, with one more time in the plan: nothing is made again, and the voice it made is not touched", async () => {
    const t = world();
    const { dir } = await heygenOpened(t);
    voiceMade(t);
    const before = projectTree(dir);
    const rev = planOf(t).rev;
    const again = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([again.code, again.said], [0, ["It's open in HyperFrames.", BUTTONS_SAID]]);
    assert.deepEqual(projectTree(dir), before);
    const now = planOf(t);
    assert.deepEqual([now.rev, now.planned.project.opened, now.planned.project.madeAt], [rev + 1, [atOf(t), atOf(t)], atOf(t)]);
    assert.equal(episodeFault(now), "");
    assert.deepEqual(runsOf(t).map((run) => run.args), [["open", dir, "--json"], ["open", dir, "--json"]]);
    t.done();
  });
  it("keeps the project it made when the app did not open, with no time, and ends 1 with the command line's words", async () => {
    const t = world();
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "open-failed" }));
    await explainer(t, { voice: "heygen" });
    const r = await on(depsOf(t), "app", TITLE);
    assert.equal(r.code, 1, r.text);
    assert.ok(!r.said.includes(BUTTONS_SAID), "the buttons are named when the app opened");
    const now = planOf(t);
    assert.deepEqual(now.planned.project, { name: HEYGEN_PROJECT, madeAt: atOf(t), on: "Mac Studio", opened: [] });
    assert.ok(existsSync(join(workOf(t), HEYGEN_PROJECT, "index.html")));
    // The next open finds it and opens it, once the app can.
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    assert.deepEqual((await on(depsOf(t), "app", TITLE)).said, ["It's open in HyperFrames.", BUTTONS_SAID]);
    assert.deepEqual(planOf(t).planned.project.opened, [atOf(t)]);
    t.done();
  });
  it("takes the folder a run left as the project it is, when the project was made and the plan could not be written", async () => {
    const t = world();
    const { folder, dir } = await heygenOpened(t);
    voiceMade(t);
    const kept = projectTree(dir);
    // The plan as it was before the project: the write was lost.
    const { record } = readEpisode(folder);
    const { project: _gone, ...planned } = record.planned;
    writeFileSync(recordFile(folder, record.rev), recordText({ ...record, planned }));
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [0, ["It's open in HyperFrames.", BUTTONS_SAID]]);
    assert.deepEqual(projectTree(dir), kept, "the folder was not made again");
    assert.deepEqual(planOf(t).planned.project, { name: HEYGEN_PROJECT, madeAt: atOf(t), on: "Mac Studio", opened: [atOf(t)] });
    t.done();
  });
  it("refuses a script, an explainer in her voice and one with no voice chosen in the gate's words, on a Mac set up for the app or not, and makes and writes nothing", async () => {
    for (const [what, title, make] of [["a script", OTHER, (t) => script(t)], ["her voice", TITLE, (t) => explainer(t, { voice: "sallie" })], ["no voice chosen", TITLE, (t) => explainer(t, { voice: null })]]) {
      for (const made of [world, setup]) {
        const t = made();
        await make(t);
        const before = treeOf(t);
        const r = await on(depsOf(t), "app", title);
        assert.deepEqual([r.code, r.said], [1, [GATE_SAYS(title)]], what);
        assert.deepEqual(treeOf(t), before, what);
        assert.deepEqual([t.started, t.opened, t.notices, runsOf(t)], [[], [], [], []], what);
        t.done();
      }
    }
  });
  it("refuses a HeyGen explainer whose package is not set yet, in words, and makes nothing", async () => {
    const t = world();
    await explainer(t, { voice: "heygen", set: false });
    const before = treeOf(t);
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [1, [`The plan for "${TITLE}" isn't made yet: its guide and its teleprompter script come first.`]]);
    assert.deepEqual([treeOf(t), runsOf(t)], [before, []]);
    t.done();
  });
  it("says this Mac is not set up for the app, for a HeyGen explainer ready for its project, as it does of any video", async () => {
    const t = setup();
    await explainer(t, { voice: "heygen" });
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [1, ["This Mac isn't set up for HyperFrames yet: ask Jason."]]);
    t.done();
  });
  it("answers what-happened, versions and a Reel of a plan in the gate's words: a plan has no history and no Reels", async () => {
    const t = world();
    await heygenOpened(t);
    const before = treeOf(t);
    for (const args of [[TITLE, "what-happened"], [TITLE, "versions"], [TITLE, "reel", "1"]]) {
      const r = await on(depsOf(t), "app", ...args);
      assert.deepEqual([r.code, r.said], [1, [GATE_SAYS(TITLE)]], args.join(" "));
    }
    assert.deepEqual(treeOf(t), before);
    t.done();
  });
  it("refuses a project made on another Mac, naming it, and makes and opens nothing here", async () => {
    const t = world();
    const folder = await explainer(t, { voice: "heygen" });
    rewritten(folder, (plan) => ({ ...plan, planned: { ...plan.planned, project: { name: HEYGEN_PROJECT, madeAt: AT, on: "Sallie's laptop", opened: [AT] } } }));
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [1, ["Its HyperFrames project is on Sallie's laptop: open it there."]]);
    // The Mac Studio is said as a person says it, when this Mac is the other one.
    const u = world();
    const there = await explainer(u, { voice: "heygen" });
    rewritten(there, (plan) => ({ ...plan, planned: { ...plan.planned, project: { name: HEYGEN_PROJECT, madeAt: AT, on: "Mac Studio", opened: [AT] } } }));
    const laptop = await on(depsOf(u, { settings: { ...u.ctx.settings, machine: "Sallie's laptop" } }), "app", TITLE);
    assert.deepEqual([laptop.code, laptop.said], [1, ["Its HyperFrames project is on the Mac Studio: open it there."]]);
    assert.deepEqual([existsSync(join(workOf(t), HEYGEN_PROJECT)), existsSync(join(workOf(u), HEYGEN_PROJECT)), runsOf(t), runsOf(u)], [false, false, [], []]);
    t.done();
    u.done();
  });
  it("says its project is not on this Mac when the plan has it and the folder is gone, and does not make it again: its voice is made in it", async () => {
    const t = world();
    const { dir } = await heygenOpened(t);
    rmSync(dir, { recursive: true });
    const rev = planOf(t).rev;
    const r = await on(depsOf(t), "app", TITLE);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for ${TITLE} is not on this Mac, and its HeyGen voice is made in it, so it can't be made again here. Ask Jason.`]]);
    assert.deepEqual([existsSync(dir), planOf(t).rev], [false, rev]);
    t.done();
  });
});

describe("plan … voice, the HeyGen voice said to be done (PR H6)", () => {
  const START = `The HeyGen voice of "${TITLE}" is being taken in. A notice comes when it is ready.`;
  const say = (t) => on(depsOf(t), "plan", TITLE, "voice");
  it("starts the run that takes the voice in, for the one voice the project's page plays, and writes nothing", async () => {
    const t = world();
    const { folder } = await heygenOpened(t);
    voiceMade(t);
    const before = treeOf(t);
    t.started.length = 0;
    const r = await say(t);
    assert.deepEqual([r.code, r.said], [0, [START]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["join", "--now", nameOf(t), "--voice"]]);
    assert.deepEqual(treeOf(t), before);
    assert.ok(folder);
    t.done();
  });
  it("takes a name written with %20 and one source played by several clips as the one voice", async () => {
    const t = world();
    await heygenOpened(t);
    const clip = (start) => `<audio src="assets/HeyGen%20voice%201.wav" data-start="${start}" data-duration="6" data-track-index="0"></audio>`;
    voiceMade(t, { audio: `${clip(0)}${clip(6)}` });
    assert.deepEqual((await say(t)).said, [START]);
    t.done();
  });
  it("refuses a script, an explainer in her voice and one with none chosen: they are not read by a HeyGen voice", async () => {
    for (const [title, make] of [[OTHER, (t) => script(t)], [TITLE, (t) => explainer(t, { voice: "sallie" })], [TITLE, (t) => explainer(t, { voice: null })]]) {
      const t = world();
      await make(t);
      const r = await on(depsOf(t), "plan", title, "voice");
      assert.deepEqual([r.code, r.said], [1, [`"${title}" isn't read by a HeyGen voice.`]]);
      assert.deepEqual(t.started, []);
      t.done();
    }
  });
  it("refuses a HeyGen explainer with no project yet, and one whose project was made on another Mac", async () => {
    const t = world();
    const folder = await explainer(t, { voice: "heygen" });
    assert.deepEqual((await say(t)).said, [`"${TITLE}" has no HyperFrames project yet: say "open it in HyperFrames" first.`]);
    rewritten(folder, (plan) => ({ ...plan, planned: { ...plan.planned, project: { name: HEYGEN_PROJECT, madeAt: AT, on: "Sallie's laptop", opened: [AT] } } }));
    assert.deepEqual((await say(t)).said, ["Its HyperFrames project is on Sallie's laptop: say it there."]);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("refuses a page that plays no voice, more than one sound, or a file that is not in assets, and a project that is gone", async () => {
    const t = world();
    const { dir } = await heygenOpened(t);
    assert.deepEqual((await say(t)).said, ["Its HyperFrames project plays no HeyGen voice yet: have one made there first."]);
    voiceMade(t, { audio: '<audio src="assets/one.wav"></audio><audio src="assets/two.wav"></audio>' });
    assert.deepEqual((await say(t)).said, ["Its HyperFrames project plays more than one sound: keep one voice there, then say it again."]);
    writeFileSync(join(dir, "index.html"), readFileSync(join(dir, "index.html"), "utf8").replace(/<audio src="assets\/one[^]*<\/audio>\n/, '<audio src="assets/missing.wav"></audio>\n'));
    assert.deepEqual((await say(t)).said, ["Its HyperFrames project plays a voice that isn't in its assets: have one made there again."]);
    rmSync(dir, { recursive: true });
    assert.deepEqual((await say(t)).said, ["Its HyperFrames project is not on this Mac any more, so its voice can't be taken in. Ask Jason."]);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("takes no more words and no flag", async () => {
    const t = world();
    await heygenOpened(t);
    for (const args of [[TITLE, "voice", "extra"], [TITLE, "voice", "--cue", "x"]]) assert.equal((await on(depsOf(t), "plan", ...args)).code, 2, args.join(" "));
    t.done();
  });
});

describe("the join run with --voice: the HeyGen voice taken in (PR H6)", () => {
  const run = (t, over = {}) => on(depsOf(t, over), "join", "--now", nameOf(t), "--voice");
  const resultOf = (t) => readResult(t.home, nameOf(t), "join");
  const COULD_NOT = (why) => `The voice of "${TITLE}" couldn't be taken in: ${why}.`;
  it("copies the voice out of the project, takes it in, and files it as the plan's video: a short video whose main project is the HyperFrames project", async () => {
    const t = world();
    const { folder, dir } = await heygenOpened(t);
    voiceMade(t);
    const plan = planOf(t);
    const kept = projectTree(dir);
    const r = await run(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(projectTree(dir), kept, "copied out of the project, not moved");
    const now = readEpisode(folder).record;
    assert.equal(episodeFault(now), "");
    assert.deepEqual([now.kind, now.id, now.rev, isFromPlan(now), isPlannedRecord(now)], ["short video", plan.id, plan.rev + 1, true, false]);
    assert.equal(now.video.file, "HeyGen voice 1.wav");
    assert.ok(existsSync(join(folder, "HeyGen voice 1.wav")));
    for (const rel of ["HeyGen voice 1.srt", "HeyGen voice 1.words.json"]) assert.ok(existsSync(join(folder, rel)), rel);
    assert.deepEqual(JSON.parse(readFileSync(join(folder, "HeyGen voice 1.words.json"), "utf8")).words.map((w) => w.w).slice(0, 3), ["Too", "many", "SKUs"]);
    assert.equal(now.planned.voice, "heygen");
    assert.equal(now.planned.project, undefined, "the project moved out of the plan");
    assert.deepEqual(now.planned.filmed, { at: atOf(t), parts: [] });
    assert.deepEqual(now.answer, { state: "answered", guess: null, seen: now.answer.seen, came: now.answer.came, by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" });
    const [main] = now.app.projects;
    assert.equal(now.app.toolchain, PIN.version);
    assert.equal(now.app.projects.length, 1);
    assert.deepEqual([main.key, main.name, main.madeAt, main.on, main.opened, main.handover, main.fromSuggestion, main.state], ["main", HEYGEN_PROJECT, plan.planned.project.madeAt, "Mac Studio", plan.planned.project.opened, false, null, "opened"]);
    const size = statSync(join(folder, "HeyGen voice 1.wav")).size;
    assert.deepEqual(main.workingCopy, { bytes: size, seconds: 182, fps: 30 });
    assert.deepEqual([main.from.file, main.from.bytes], ["HeyGen voice 1.wav", size]);
    assert.equal(changedSince(main, { found: { folder }, record: now }), false, "the voice is the one the project was made with");
    t.done();
  });
  it("asks for Claude's reading, for its spellings, and for no working copy, asks the launch agent to make the late check, and posts its notice; its late check is kept", async () => {
    const t = world();
    await heygenOpened(t);
    voiceMade(t);
    t.started.length = 0;
    await run(t);
    const rev = planOf(t).rev;
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", nameOf(t), "--kind", "short video", "--rev", String(rev)]]);
    assert.deepEqual(t.notices, [READY()]);
    assert.deepEqual(t.kicks, ["kickstart"]);
    assert.equal(readPendings(t.home).length, 1);
    assert.deepEqual([resultOf(t).ok, resultOf(t).failed, resultOf(t).command], [true, [], "join"]);
    t.done();
  });
  it("refuses, in the words `plan … voice` uses, what the run finds changed: no voice, two, a project gone, a voice already in", async () => {
    const t = world();
    const { dir } = await heygenOpened(t);
    let r = await run(t);
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("Its HyperFrames project plays no HeyGen voice yet: have one made there first")]);
    voiceMade(t);
    assert.equal((await run(t)).code, 0);
    r = await run(t);
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`"${TITLE}" has its voice already`)]);
    t.done();
    const u = world();
    const there = await heygenOpened(u);
    rmSync(there.dir, { recursive: true });
    assert.equal((await on(depsOf(u), "join", "--now", nameOf(u), "--voice")).code, 1);
    assert.deepEqual(readResult(u.home, nameOf(u), "join").failed, [COULD_NOT("Its HyperFrames project is not on this Mac any more, so its voice can't be taken in. Ask Jason")]);
    u.done();
    assert.ok(dir);
  });
  it("stops a voice that has a picture, no sound or cannot be read, before anything is filed, and leaves the plan and the project as they were", async () => {
    for (const [probes, fails, why] of [
      [{ "HeyGen voice 1.wav": PICTURE_PROBE }, [], "the voice has a picture: a voice is sound alone"],
      [{ "HeyGen voice 1.wav": VOICE_PROBE("12.000000", null) }, [], "the voice has no sound"],
      [{}, ["HeyGen voice 1.wav"], "the voice could not be read as a sound"]
    ]) {
      const t = world({ probes, fails });
      const { folder, dir } = await heygenOpened(t);
      voiceMade(t);
      const plan = planOf(t);
      const kept = projectTree(dir);
      assert.equal((await run(t)).code, 1, why);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(why)], why);
      assert.deepEqual([planOf(t), projectTree(dir), readPendings(t.home), listAll(folder).includes("HeyGen voice 1.wav")], [plan, kept, [], false], why);
      t.done();
    }
  });
  it("is the help with --parts as well, or with neither", async () => {
    const t = world();
    await heygenOpened(t);
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--voice", "--parts", "a")).code, 2);
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t))).code, 2);
    t.done();
  });
});

describe("the guide, for an explainer (PR H6)", () => {
  const NOTES = { version: 1, handoffs: {}, finished: {} };
  const NOW = Date.parse("2026-11-04T12:00:00-05:00");
  const plan = (planned) => ({ name: "Why SKUs sink you (400000)", id: "e-20261104-400000", kind: null, waiting: false, planned });
  const OPEN = 'Say "open it in HyperFrames" to make it there. Then ask there for a HeyGen voice to read the teleprompter script.';
  const VOICE = 'In HyperFrames, have a HeyGen voice read the teleprompter script. Then say "the HeyGen voice is done".';
  const step = (stage, text) => ({ done: false, stage, text, step: "", after: "" });
  it("tells a HeyGen explainer whose package is set to open its project, and once it has one to have the voice made there; before the package, film as it was", () => {
    assert.deepEqual(nextFor(plan({ route: "explainer", voice: "heygen", set: true, project: false }), NOTES, NOW), step("heygen-open", OPEN));
    assert.deepEqual(nextFor(plan({ route: "explainer", voice: "heygen", set: true, project: true }), NOTES, NOW), step("heygen-voice", VOICE));
    assert.equal(nextFor(plan({ route: "explainer", voice: "heygen", set: false, project: false }), NOTES, NOW).stage, "film");
    assert.equal(nextFor(plan({ route: "explainer", voice: "sallie", set: true, project: false }), NOTES, NOW).stage, "film");
    assert.equal(nextFor(plan({ route: "explainer", voice: null, set: true }), NOTES, NOW).stage, "film");
  });
  it("says its voice is being taken in, or could not be, for an explainer of either voice, as a script says of its footage", () => {
    for (const voice of ["sallie", "heygen"]) {
      assert.deepEqual(nextFor(plan({ route: "explainer", voice, set: true, project: true, joining: true }), NOTES, NOW), step("joining", "Its voice is being taken in. A notice comes when it is ready."), voice);
      assert.deepEqual(nextFor(plan({ route: "explainer", voice, set: true, project: true, joinFailed: true }), NOTES, NOW), step("join-failed", 'Its voice could not be taken in. Say "how far is it?" to see why.'), voice);
    }
    assert.equal(nextFor(plan({ route: "script", voice: null, joining: true }), NOTES, NOW).text, "Its footage is being made into one video. A notice comes when it is ready.");
  });
  it("sends a made explainer to the app after its spellings, and never offers it as it is, where an iPhone clip is offered both", () => {
    const made = (over) => ({ name: "Why (400000)", id: "e-20261104-400000", kind: "short video", waiting: false, reading: "done", offersAnswered: true, app: true, v2: true, way: "", project: null, copy: null, explainer: false, ...over });
    assert.match(nextFor(made({}), NOTES, NOW).text, /Or say "hand it off" to hand it off as it is/);
    for (const over of [{ explainer: true }, { explainer: true, way: "unopened" }, { explainer: true, way: "hyperframes" }]) {
      const next = nextFor(made(over), NOTES, NOW);
      assert.deepEqual([next.stage, next.text], ["open-app", 'Say "open it in HyperFrames" to edit it there.']);
    }
    const opened = nextFor(made({ explainer: true, project: { opened: true, last: "", exported: false } }), NOTES, NOW);
    assert.equal(opened.stage, "in-app");
    assert.equal(nextFor(made({ explainer: true, project: { opened: true, last: "", exported: true } }), NOTES, NOW).stage, "exported");
  });
  it("reads it from the record: the guide of a real HeyGen plan goes from open to voice as its project is made, and a made one goes to the app", async () => {
    const lightOf = (t) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } });
    const t = world();
    await explainer(t, { voice: "heygen" });
    const line = async () => (await on(lightOf(t), "guide", TITLE)).said;
    assert.deepEqual(await line(), [`${TITLE} (400000): ${OPEN}`]);
    assert.equal((await on(depsOf(t), "app", TITLE)).code, 0);
    assert.deepEqual(await line(), [`${TITLE} (400000): ${VOICE}`]);
    // A run that could not take the voice in (its file is gone from the project) leaves the plan a plan, and the guide says so.
    voiceMade(t);
    assert.equal((await on(depsOf(t), "plan", TITLE, "voice")).code, 0);
    rmSync(join(workOf(t), HEYGEN_PROJECT, "assets", "HeyGen voice 1.wav"));
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--voice")).code, 1);
    assert.deepEqual(await line(), [`${TITLE} (400000): Its voice could not be taken in. Say "how far is it?" to see why.`]);
    t.done();
  });
});

describe("the hand-off of an explainer (PR H6)", () => {
  const YOUTUBE = "It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content.";
  const EXPORT = 'An explainer is made in HyperFrames: export it there, then say "hand it off".';
  /** A HeyGen explainer whose voice is taken in, and its spellings answered: a short video whose project is in use. */
  async function madeHeygen(t) {
    const { folder } = await heygenOpened(t);
    voiceMade(t);
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--voice")).code, 0);
    return folder;
  }
  it("tells an explainer in a HeyGen voice, ending what finish found, to mark it altered or synthetic on YouTube", async () => {
    const t = world();
    await madeHeygen(t);
    const r = await on(depsOf(t), "finish", TITLE);
    assert.ok(r.said.includes(YOUTUBE), r.text);
    assert.equal(r.said.filter((line) => line === YOUTUBE).length, 1);
    t.done();
  });
  it("says nothing of YouTube for an explainer in her voice, or for a video that is no explainer", async () => {
    const t = world();
    await madeExplainer(t);
    assert.ok(!(await on(depsOf(t), "finish", TITLE)).said.includes(YOUTUBE));
    t.done();
  });
  it("hands an explainer off as it is never: it is made in HyperFrames, and exported there", async () => {
    // An explainer in her voice that was never opened in the app is a clip to `finish`, which would hand a clip off as it is: not this one, with or without the words.
    for (const words of [[], ["--as-it-is"]]) {
      const t = world();
      await madeExplainer(t);
      const r = await on(depsOf(t, { settings: { ...t.ctx.settings, handoffVersion: 2 } }), "finish", TITLE, ...words);
      assert.deepEqual([r.code, r.said], [1, [EXPORT]], words.join(" "));
      t.done();
    }
    // One in a HeyGen voice has its project opened: it looks for the export, and a hand-off as it is is not what it offers.
    const u = world();
    await madeHeygen(u);
    const r = await on(depsOf(u), "finish", TITLE, "--as-it-is");
    assert.ok(!r.said.some((line) => /Handed off as it is/.test(line)), r.text);
    u.done();
  });
});

describe("H6 fix round 1", () => {
  const lightOf = (t) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } });
  it("never has a voiceover waiting for a client's agreement: not by waitsForClient, and not in the guide while the run is at work or after it failed", async () => {
    const { waitsForClient } = await import("../footage.js");
    const t = world({ probes: { "Voice 1.m4a": VOICE_PROBE("182.000000", null) } });
    await explainer(t);
    const one = voicePart(t, 1);
    const part = { name: one.name, folder: one.folder, record: one.record };
    assert.equal(waitsForClient(part, planOf(t).planned), false);
    // A talking part that shows a client and has no agreement still waits, as it did.
    assert.equal(waitsForClient({ ...part, record: { ...part.record, partOf: { id: part.record.partOf.id, as: "talking", shot: null, client: true } } }, planOf(t).planned), true);
    // The run fails (no sound): the guide of the plan says its step and no client line.
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--parts", one.record.id)).code, 1);
    const after = await on(lightOf(t), "guide", TITLE);
    assert.deepEqual(after.said, [`${TITLE} (400000): Its voice could not be taken in. Say "how far is it?" to see why.`]);
    assert.ok(!after.text.includes("shows a client"), after.text);
    t.done();
  });
  it("leaves a failed run's result and status without the part's file name (ruling 4)", async () => {
    const t = world({ probes: { "Voice 1.m4a": VOICE_PROBE("182.000000", null) } });
    await explainer(t);
    const one = voicePart(t, 1);
    await on(depsOf(t), "join", "--now", nameOf(t), "--parts", one.record.id);
    const file = readFileSync(join(t.home, "BRIMM Video Work", nameOf(t), "join.result.json"), "utf8");
    assert.ok(!file.includes("Voice 1"), file);
    const said = (await on(depsOf(t), "status")).text;
    assert.ok(!said.includes("Voice 1"), said);
    t.done();
  });
  it("finds the export of a made HeyGen explainer, and ends with the YouTube line; and refuses --as-it-is in the exact words", async () => {
    const t = world();
    await explainer(t, { voice: "heygen" });
    assert.equal((await on(depsOf(t), "app", TITLE)).code, 0);
    voiceMade(t);
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--voice")).code, 0);
    const dir = join(workOf(t), HEYGEN_PROJECT);
    // The app's export: the file in Downloads, ending two minutes after it began, and the record it leaves in the project's renders/.
    const downloads = downloadsFolder(t.home);
    mkdirSync(downloads, { recursive: true });
    mkdirSync(join(dir, "renders"), { recursive: true });
    const day = dayOf(t);
    const began = Date.parse(`${day}T13:56:40-05:00`);
    const file = join(downloads, `${HEYGEN_PROJECT} ${day} 13.56.mp4`);
    writeFileSync(file, "the export");
    utimesSync(file, new Date(began + 120000), new Date(began + 120000));
    const meta = JSON.parse(readFileSync(new URL("./fixtures/hyperframes-0.8.208/exports/main.meta.json", import.meta.url), "utf8").replace("<DOWNLOADS>", downloads));
    meta.exportedTo = file;
    writeFileSync(join(dir, "renders", `${HEYGEN_PROJECT}_${day}_13-56-40.meta.json`), JSON.stringify(meta));
    const r = await on(depsOf(t), "finish", TITLE);
    assert.ok(!r.said.some((l) => /no export yet|not an export/.test(l)), r.text);
    assert.ok(r.said.some((l) => l.includes(`${HEYGEN_PROJECT} ${day} 13.56.mp4`)), r.text);
    assert.equal(r.said.at(-1) === "It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content." || r.said.includes("It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content."), true, r.text);
    t.done();
    const u = world();
    await madeExplainer(u);
    const refused = await on(depsOf(u, { settings: { ...u.ctx.settings, handoffVersion: 2 } }), "finish", TITLE, "--as-it-is");
    assert.deepEqual([refused.code, refused.said], [1, ['An explainer is made in HyperFrames: export it there, then say "hand it off".']]);
    u.done();
  });
  it("takes the voice only from the project's own assets: a symlinked assets folder is refused, in words, and nothing is started", async () => {
    const t = world();
    const { dir } = await heygenOpened(t);
    const elsewhere = join(t.dir, "elsewhere");
    mkdirSync(elsewhere, { recursive: true });
    writeFileSync(join(elsewhere, "HeyGen voice 1.wav"), "not from the project");
    symlinkSync(elsewhere, join(dir, "assets-real"));
    rmSync(join(dir, "assets"), { recursive: true, force: true });
    symlinkSync(elsewhere, join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), readFileSync(join(dir, "index.html"), "utf8").replace("</body>", '<audio src="assets/HeyGen%20voice%201.wav"></audio></body>'));
    const r = await on(depsOf(t), "plan", TITLE, "voice");
    assert.deepEqual([r.code, r.said], [1, ["Its HyperFrames project plays a voice from outside its own assets: have one made there again."]]);
    assert.deepEqual(t.started, []);
    assert.equal((await on(depsOf(t), "join", "--now", nameOf(t), "--voice")).code, 1);
    assert.ok(!existsSync(join(t.root, "Episodes", nameOf(t), "HeyGen voice 1.wav")));
    t.done();
  });
});
