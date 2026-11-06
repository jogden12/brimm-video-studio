// `footage` and `plan … agreed` (PR H5a; design 2026-11-04, H5): a dropped video is answered as footage for a planned video, and a client's agreement
// to being shown in it is noted on a dialog only she can press. This is safety code, and the tests here are its proof:
//   - a part is answered only by her cards (the planned card and the part card): on a Mac whose lock is open, under Claude Code, `footage` writes
//     nothing without a receipt of each, and never takes a Zoom download, a video that holds a session's words, or one held beside a session;
//   - a part that shows a client stays out of a project until she has clicked "They agreed" (`planned.consent`, footage.js mayGoIn), and what she
//     typed is in agreements.txt on this Mac, mode 0600, and nowhere else: not in a record, a log, a line said or a file of Dropbox;
//   - a part is kept out of the lists, refused by `kind` and `leave`, and taken back by `footage … none` until its plan is filmed.
// Nothing here runs a real program: osascript is a stand-in that answers as the real one prints, and each test has a root and a home of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { episodeFault, isPart, isPlannedRecord, localStamp, readEpisode, recordFile, recordText, writeEpisode } from "../episode.js";
import { footageAsked, mayGoIn, partsOf } from "../footage.js";
import { CLIENT_Q, NO_RECEIPT, PLANNED_Q, SHOT_Q, cardOf, expectedAnswers, footageOption, formOf, partCardOf, plannedCardOf, sessionByFollowUp, writeReceipt } from "../receipts.js";
import { fileSafe } from "../names.js";
import { episodeWork, runsFolder } from "../settings.js";
import { guardDecision } from "../studio.js";
import { localDay } from "../shared/text.js";
import { CHECKOUT, EDIT, NODE } from "./guard-cases.js";
import { setup, episodeAs, reread, listAll } from "./episodes.js";
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
/** This Mac on the light import, as the guide needs it. */
const light = (t, over = {}) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, ...over });

const TITLE = "Too many SKUs";
const SHORT = "400000";
const PLAN_ID = `e-${localDay(new Date("2026-10-20T15:00:00-05:00")).replaceAll("-", "")}-${SHORT}`;
const dayOf = (t) => localDay(new Date(t.now()));
const atOf = (t) => localStamp(new Date(t.now()));
const nameOf = (t, title = TITLE) => `${dayOf(t)} ${fileSafe(title)} (Mac Studio)`;
const folderOf = (t, title = TITLE) => join(t.root, "Episodes", nameOf(t, title));
const planOf = (t, title = TITLE) => readEpisode(folderOf(t, title)).record;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayText = (day) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

/** The shots of the made-up plan: two b-roll (2 and 5), one screen recording (4) and two talking, as the brief's own words have them. */
const SHOT_ARGS = [
  "--shot", "talking | Open on the problem, to the camera.",
  "--shot", "b-roll | Sallie at her desk sorting invoices.",
  "--shot", "talking | Why it matters, to the camera.",
  "--shot", "screen | Her dashboard, scrolling the SKU list.",
  "--shot", "b-roll | A coaching session.",
  "--line", "Too many SKUs will sink a small shop."
];
/** A plan with one shot of each kind that shows footage. */
const ONE_EACH = ["--shot", "talking | Open to the camera.", "--shot", "b-roll | Her desk.", "--shot", "screen | Her dashboard.", "--line", "One."];

/** A planned script made on this Mac, its package set, in a world of its own: its folder. `rand` makes its id. */
async function planned(t, { title = TITLE, shots = SHOT_ARGS, set = true, rand = 0.25 } = {}) {
  const r = await on(depsOf(t, { rand: () => rand }), "plan", "new", title);
  assert.equal(r.code, 0, r.text);
  if (set) {
    const s = await on(depsOf(t), "plan", title, "set", ...shots);
    assert.equal(s.code, 0, s.text);
  }
  return folderOf(t, title);
}

const WAITING = { state: "needs your answer", guess: "raw", seen: "wide, 0:20, no retakes", came: "camera", match: null };
const SILENT = { state: "needs your answer", guess: null, seen: "upright, 0:08, no sound", came: "phone", match: null };
const SILENT_VIDEO = { file: "Sorting invoices.mov", bytes: 5, seconds: 8, recorded: "2026-11-04", recordedFrom: "import", sound: false };
const labelOf = (n) => `Video of 4 Nov, 0${n}:00 (Mac Studio)`;
const idOf = (n) => `e-20261104-a${String(n).repeat(5)}`;
/** A video dropped and waiting for her answer: number `n`, with its label and id, in a folder of its own. */
function video(t, n, { silent = false, answer = {}, over = {} } = {}) {
  return episodeAs(t, {
    id: idOf(n),
    name: `2026-11-04 Drop ${n} (Mac Studio)`,
    record: { version: 3, kind: null, label: labelOf(n), answer: { ...(silent ? SILENT : WAITING), ...answer }, ...(silent ? { video: { ...SILENT_VIDEO, file: `Drop ${n}.mov` } } : {}), ...over }
  });
}

/** A client or group session whose mark is not cleared, as `kind` writes one: gated, and named by its label. */
const SESSION_RECORD = {
  version: 3, kind: "session", label: "Video of 20 Oct, 09:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false },
  answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-20T15:00:00-05:00", private: "yes" },
  session: { marked: "2026-10-20T15:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null }
};
/** A video that was answered, a version of the session: the gate holds it as a session (heldGateFor). */
const HELD_RECORD = { version: 3, kind: "finished", versionOf: "e-20261020-5e5510", name: { text: "A later talk", placeholder: false }, answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: "2026-10-20T15:00:00-05:00", private: "no" } };

/** Every file of the test's folders, whole, by its path: the records, the episodes, the home, the root. */
const snapshot = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));
/** Nothing was written, claimed, started or logged: every file as it was, and no lock left. */
function unchanged(t, before, why = "") {
  assert.deepEqual(snapshot(t), before, why);
  assert.deepEqual([t.started], [[]], why);
}
/** The lock a run holds for the video from before its write to after it. */
const lockOf = (t, name) => join(episodeWork(t.home, name), "answer.lock");

/** A receipt of each card, for the video called `label`, made footage as `kind` (the part card's answer) for the plan `title`. */
function receipts(t, { label, title = TITLE, kind = "B-roll", client = "No", ago = 0, offered, also = [] } = {}) {
  writeReceipt(t.home, { at: t.now() - ago, label, form: "planned", answers: { [PLANNED_Q(label)]: footageOption(title) }, offered: offered ?? [footageOption(title), ...also.map(footageOption), "No"] });
  writeReceipt(t.home, { at: t.now() - ago, label, form: "part", answers: { [SHOT_Q(label)]: kind, [CLIENT_Q(label)]: client } });
}
/** Every receipt the video called `label` could hold on an open-lock Mac under Claude Code, were its card asked: her answers on the card for each kind `kind`
    is told (with the not-a-session card's too, and a session's by that card alone), and the planned card and the part card. The receipts `kind` would take
    for any kind a card offers are all here, so a refusal of `kind` that stands with them all in place is not for want of one. */
function everyReceipt(t, label) {
  const offered = cardOf({ label, guess: null, maybe: null }).questions[0].options[0].label;
  const write = (form, answers, more = {}) => writeReceipt(t.home, { at: t.now(), label, form, answers, ...more });
  for (const stored of ["finished", "raw", "short video", "session"]) {
    for (const notASession of [false, true]) {
      for (const one of expectedAnswers({ label, stored, notASession, came: null, offered })) write(one.form, one.answers, one.offered === undefined ? {} : { offered: one.offered });
    }
  }
  for (const one of sessionByFollowUp({ label, came: null })) write(one.form, one.answers);
  receipts(t, { label });
}

/** What `footage` says when it is done, by its parts. */
const DONE = (label, what, extra = "") => `${label} is footage for "${TITLE}": ${what}.${extra} When all its footage is in, say "that's all the footage for ${TITLE}".`;
const CLIENT = " It shows a client, so it stays out of the HyperFrames project until you confirm they agreed.";
const FOOTAGE_REFUSED_BY = (name, title = TITLE) => `${name} is footage for "${title}". Say "that's not footage for ${title}" first.`;

describe("footage: a dropped video answered as footage for a planned video", () => {
  it("makes a talking part: the video's own record gets the answer \"part\" and what it is footage for, in one write, at layout 5", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const plan = planOf(t);
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.deepEqual([r.code, r.said], [0, [DONE(labelOf(1), "talking to the camera")]]);
    const now = reread(found);
    assert.deepEqual([now.rev, now.version, now.kind], [2, 5, null]);
    assert.deepEqual(now.partOf, { id: PLAN_ID, as: "talking", shot: null, client: false });
    // The answer is the one `kind` writes: who, where, when, and no private session, with the import's own facts as they were.
    assert.deepEqual(now.answer, { ...WAITING, state: "part", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" });
    assert.equal(episodeFault(now), "");
    assert.equal(isPart(now), true);
    // It claims nothing, and writes nothing but its own next record: the plan's record is not written for a part.
    assert.equal(now.editing, null);
    assert.deepEqual(listAll(found.folder), ["record/0001.json", "record/0002.json"]);
    assert.deepEqual(planOf(t), plan);
    const wrote = Object.keys(snapshot(t)).filter((rel) => !(rel in before));
    assert.deepEqual(wrote, [`BRIMM Video/Episodes/${found.name}/record/0002.json`]);
    assert.deepEqual(existsSync(lockOf(t, found.name)), false);
    t.done();
  });
  it("puts the record in by the rule, as the next record with the rev it was read at, and never over a file", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const before = t.clones.length;
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const made = t.clones.slice(before);
    assert.deepEqual(made.map(([, to]) => to), [recordFile(found.folder, 2)]);
    assert.ok(made.every(([from]) => from.startsWith(runsFolder(t.home))), "made in a folder of this Mac's own");
    t.done();
  });
  it("makes a b-roll part for the shot she names, and a screen recording for the one shot of its kind, with no sound, and says so", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2);
    const broll = await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2");
    assert.deepEqual([broll.code, broll.said], [0, [DONE(labelOf(1), "the b-roll for shot 2. It goes in with no sound")]]);
    const screen = await on(depsOf(t), "footage", labelOf(2), TITLE, "screen", "--client", "no");
    assert.deepEqual([screen.code, screen.said], [0, [DONE(labelOf(2), "the screen recording for shot 4. It goes in with no sound")]]);
    assert.deepEqual(reread({ folder: join(t.root, "Episodes", "2026-11-04 Drop 1 (Mac Studio)") }).partOf, { id: PLAN_ID, as: "b-roll", shot: 2, client: false });
    assert.deepEqual(reread({ folder: join(t.root, "Episodes", "2026-11-04 Drop 2 (Mac Studio)") }).partOf, { id: PLAN_ID, as: "screen", shot: 4, client: false });
    t.done();
  });
  it("adds that a video that shows a client stays out of the HyperFrames project until the client agreed", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "5");
    assert.deepEqual([r.code, r.said], [0, [DONE(labelOf(1), "the b-roll for shot 5. It goes in with no sound", CLIENT)]]);
    assert.deepEqual(reread(found).partOf, { id: PLAN_ID, as: "b-roll", shot: 5, client: true });
    // The plan holds no agreement: nothing was noted.
    assert.equal(Object.hasOwn(planOf(t).planned, "consent"), false);
    t.done();
  });
  it("takes the one shot of its kind when the plan has one, with or without --shot", async () => {
    const t = setup();
    await planned(t, { shots: ONE_EACH });
    video(t, 1);
    video(t, 2);
    assert.equal((await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no")).said[0], DONE(labelOf(1), "the b-roll for shot 2. It goes in with no sound"));
    assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "screen", "--client", "no", "--shot", "3")).said[0], DONE(labelOf(2), "the screen recording for shot 3. It goes in with no sound"));
    t.done();
  });
  it("finds the plan by its title, in any case and spacing, by the name she gave it, and by the string its title was made with when it holds a code", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2);
    video(t, 3);
    await on(depsOf(t), "name", TITLE, "Why SKUs sink you");
    for (const [n, said] of [[1, "too   many skus"], [2, "Why SKUs sink you"], [3, TITLE]]) {
      const r = await on(depsOf(t), "footage", labelOf(n), said, "talking", "--client", "no");
      assert.equal(r.code, 0, `${said}: ${r.text}`);
    }
    t.done();
    const u = setup();
    await on(depsOf(u), "plan", "new", "Make %2410k %22fast%22 | 100%25");
    await on(depsOf(u), "plan", "Make %2410k %22fast%22 | 100%25", "set", "--shot", "talking | Open.", "--line", "One.");
    video(u, 1);
    const r = await on(depsOf(u), "footage", labelOf(1), "Make %2410k %22fast%22 | 100%25", "talking", "--client", "no");
    assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)} is footage for "Make $10k "fast" | 100%": talking to the camera. When all its footage is in, say "that's all the footage for Make $10k "fast" | 100%".`]]);
    u.done();
  });
  it("writes nothing, and does not say the video is footage, when its record cannot be written", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    chmodSync(join(found.folder, "record"), 0o555);
    try {
      const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
      assert.equal(r.code, 1);
      assert.ok(r.said.length === 1 && r.said[0].startsWith("Nothing was written: "), r.text);
      assert.ok(!r.text.includes("is footage for"), r.text);
    } finally {
      chmodSync(join(found.folder, "record"), 0o755);
    }
    assert.deepEqual([reread(found).rev, partsOf(t.root, PLAN_ID)], [1, []]);
    t.done();
  });
  it("names no file of the video in anything it says, when the file is named for a client", async () => {
    const t = setup();
    await planned(t);
    video(t, 1, { silent: true, over: { video: { ...SILENT_VIDEO, file: "Hamilton Quayle call.mov" }, name: { text: "Hamilton Quayle call", placeholder: true } } });
    const asks = [["footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2"], ["footage", labelOf(1), "none"], ["footage", labelOf(1), "Nothing", "talking", "--client", "no"], ["episodes"], ["plan", TITLE],
      ["footage", labelOf(1), TITLE, "talking", "--client", "no"], ["footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "5"], ["plan", TITLE, "agreed", labelOf(1)], ["plan", TITLE]];
    for (const ask of asks) {
      const r = await on(depsOf(t), ...ask);
      assert.doesNotMatch(r.text, /hamilton|quayle/i, `${ask.join(" ")}\n${r.text}`);
    }
    t.done();
  });
  it("is the help, with 2, for anything it is not told whole, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    const before = snapshot(t);
    for (const words of [[], [labelOf(1)], [labelOf(1), TITLE], [labelOf(1), TITLE, "talking"], [labelOf(1), TITLE, "talking", "--client"], [labelOf(1), TITLE, "talking", "--client", "maybe"], [labelOf(1), TITLE, "voiceover", "--client", "no"],
      [labelOf(1), TITLE, "b-roll", "--client", "no", "--shot"], [labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "two"], [labelOf(1), TITLE, "talking", "--client", "no", "--zzz"], [labelOf(1), "none", "--client", "no"], [labelOf(1), "none", "extra"]]) {
      const r = await on(depsOf(t), "footage", ...words);
      assert.deepEqual([r.code, r.text], [2, HELP], words.join(" "));
    }
    unchanged(t, before);
    t.done();
  });
});

describe("footage, the shot", () => {
  it("asks which shot a b-roll video shows when the plan has two, listing them, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no");
    assert.deepEqual([r.code, r.said], [1, ["Which b-roll shot is it? Shot 2: Sallie at her desk sorting invoices. Shot 5: A coaching session. Say it again with its number."]]);
    unchanged(t, before);
    t.done();
  });
  it("refuses a shot of another kind, and one that is not in the shot list, in words", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    const before = snapshot(t);
    for (const [words, why] of [
      [["b-roll", "--shot", "3"], `Shot 3 of "${TITLE}" is talking to the camera, not b-roll.`],
      [["b-roll", "--shot", "4"], `Shot 4 of "${TITLE}" is a screen recording, not b-roll.`],
      [["screen", "--shot", "2"], `Shot 2 of "${TITLE}" is b-roll, not a screen recording.`],
      [["b-roll", "--shot", "9"], `"${TITLE}" has no shot 9 in its shot list.`],
      [["talking", "--shot", "1"], "A talking part has no shot: Studio puts the talking parts in order by their words."]]) {
      const r = await on(depsOf(t), "footage", labelOf(1), TITLE, words[0], "--client", "no", ...words.slice(1));
      assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
    }
    unchanged(t, before);
    t.done();
  });
  it("refuses a shot that has its footage already, naming the video that has it, and takes another shot of that kind", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2);
    assert.equal((await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2")).code, 0);
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "2");
    assert.deepEqual([r.code, r.said], [1, [`Shot 2 of "${TITLE}" has its footage already: ${labelOf(1)}.`]]);
    unchanged(t, before);
    assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "5")).code, 0);
    t.done();
    // The only shot of its kind, taken already, is refused without --shot too.
    const u = setup();
    await planned(u, { shots: ONE_EACH });
    video(u, 1);
    video(u, 2);
    await on(depsOf(u), "footage", labelOf(1), TITLE, "screen", "--client", "no");
    const same = await on(depsOf(u), "footage", labelOf(2), TITLE, "screen", "--client", "no");
    assert.deepEqual([same.code, same.said], [1, [`Shot 3 of "${TITLE}" has its footage already: ${labelOf(1)}.`]]);
    u.done();
  });
  it("frees a shot when its video is taken back", async () => {
    const t = setup();
    await planned(t, { shots: ONE_EACH });
    video(t, 1);
    video(t, 2);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no");
    assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no")).code, 1);
    assert.equal((await on(depsOf(t), "footage", labelOf(1), "none")).code, 0);
    assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no")).code, 0);
    t.done();
  });
  it("says a plan has no shot of the kind when its shot list has none", async () => {
    const t = setup();
    await planned(t, { shots: ["--shot", "talking | Open to the camera.", "--line", "One."] });
    video(t, 1);
    const before = snapshot(t);
    for (const [kind, noun] of [["b-roll", "b-roll"], ["screen", "screen recording"]]) {
      const r = await on(depsOf(t), "footage", labelOf(1), TITLE, kind, "--client", "no");
      assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" has no ${noun} shot in its shot list.`]], kind);
    }
    unchanged(t, before);
    t.done();
  });
});

describe("footage, what it refuses", () => {
  /** The refusal is whole: 1, only these words, and no file or record is changed. */
  async function refused(t, words, why, deps = depsOf(t)) {
    const before = snapshot(t);
    const r = await on(deps, ...words);
    assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
    unchanged(t, before, words.join(" "));
  }
  const ASK = (n, ...more) => ["footage", labelOf(n), TITLE, "talking", "--client", "no", ...more];
  it("refuses a plan that is not there, is not set, was dropped or filmed, is an explainer, or is one of two with the same title", async () => {
    const t = setup();
    await planned(t, { set: false });
    video(t, 1);
    await refused(t, ["footage", labelOf(1), "Nothing like it", "talking", "--client", "no"], `There's no planned video called "Nothing like it" waiting for its footage.`);
    await refused(t, ASK(1), `The plan for "${TITLE}" isn't made yet: its guide, its shot list and its teleprompter script come first.`);
    await on(depsOf(t), "plan", TITLE, "set", ...SHOT_ARGS);
    assert.equal((await on(depsOf(t), "plan", TITLE, "drop")).code, 0);
    await refused(t, ASK(1), `There's no planned video called "${TITLE}" waiting for its footage.`);
    t.done();
    // Filmed (the join, PR H5b): a time, and the object the join writes.
    for (const filmed of ["2026-10-20T15:00:00-05:00", { at: "2026-10-20T15:00:00-05:00", parts: [] }]) {
      const u = setup();
      const folder = await planned(u);
      video(u, 1);
      const record = planOf(u);
      writeEpisode(folder, { ...record, planned: { ...record.planned, filmed } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: u.home });
      await refused(u, ASK(1), `There's no planned video called "${TITLE}" waiting for its footage.`);
      u.done();
    }
    // An explainer waits for a voice, and has no footage.
    const v = setup();
    await on(depsOf(v), "plan", "new", "Why SKUs", "--explainer");
    await on(depsOf(v), "plan", "Why SKUs", "set", "--cue", "graphic | 4 | too many | A stack of boxes.", "--line", "One.");
    video(v, 1);
    await refused(v, ["footage", labelOf(1), "Why SKUs", "talking", "--client", "no"], `There's no planned video called "Why SKUs" waiting for its footage.`);
    v.done();
    // Two plans of one title, which two Macs can make before Dropbox brings one across, are told apart by nobody here.
    const w = setup();
    const first = await planned(w);
    video(w, 1);
    const copy = join(w.root, "Episodes", `${nameOf(w)}-2`);
    mkdirSync(join(copy, "record"), { recursive: true });
    writeFileSync(recordFile(copy, planOf(w).rev), recordText({ ...planOf(w), id: "e-20261104-bbbbbb" }));
    assert.ok(existsSync(first));
    await refused(w, ASK(1), `More than one planned video is called "${TITLE}": ask Jason.`);
    w.done();
  });
  it("refuses a Zoom download, by how it came and by its file's name, and a session's words, however she answers", async () => {
    const t = setup();
    await planned(t);
    video(t, 1, { answer: { came: "zoom" } });
    video(t, 2, { over: { video: { file: "GMT20261013-142933_Recording_gvo_1280x720.mp4", bytes: 1, seconds: 10, recorded: "2026-11-04", recordedFrom: "import" } } });
    await refused(t, ASK(1), `${labelOf(1)} came from Zoom, and a Zoom download is never footage.`);
    await refused(t, ASK(2), `${labelOf(2)} came from Zoom, and a Zoom download is never footage.`);
    t.done();
  });
  it("refuses a video whose words are most of a client or group session's, and one held beside a session, and says to ask Jason", async () => {
    const SESSION = SESSION_RECORD;
    const t = setup();
    await planned(t);
    episodeAs(t, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION });
    video(t, 1, { answer: { match: "e-20261020-5e5510" } });
    await refused(t, ASK(1), `${labelOf(1)} holds most of the words of a client or group session, so it is never footage. Ask Jason.`);
    t.done();
    // A session that names the waiting video as the video it is a new version of holds it beside the session.
    const u = setup();
    await planned(u);
    video(u, 1);
    episodeAs(u, { id: "e-20261020-5e5511", name: "2026-10-20 A later session (Mac Studio)", record: { ...SESSION, versionOf: idOf(1) } });
    await refused(u, ASK(1), `${labelOf(1)} holds most of the words of a client or group session, so it is never footage. Ask Jason.`);
    u.done();
  });
  it("refuses a video that is answered already, in the kind's words, and a video that is footage for a plan already", async () => {
    const KINDS = [["finished", "finished by your editor"], ["raw", "raw with retakes"], ["short video", "an iPhone clip"], ["session", "a client or group session"]];
    for (const [kind, said] of KINDS) {
      const t = setup();
      await planned(t);
      const session = kind === "session" ? { session: { marked: "2026-10-20T15:00:00-05:00", on: "Mac Studio", teachings: null, cleared: { at: "2026-10-20T15:00:00-05:00", on: "Mac Studio", to: "finished", confirmed: "dialog" } } } : {};
      video(t, 1, { over: { kind, answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: atOf(t), private: kind === "session" ? "yes" : "no" }, name: { text: "A talk", placeholder: false }, ...session } });
      await refused(t, ASK(1), `A talk is answered already: it is ${said}.`);
      t.done();
    }
    const u = setup();
    await planned(u);
    await planned(u, { title: "Why SKUs sink you", rand: 0.3 });
    video(u, 1);
    assert.equal((await on(depsOf(u), "footage", labelOf(1), TITLE, "talking", "--client", "no")).code, 0);
    await refused(u, ["footage", labelOf(1), "Why SKUs sink you", "talking", "--client", "no"], `${labelOf(1)} is footage for "${TITLE}" already. To change that, say "that's not footage for ${TITLE}" first.`);
    await refused(u, ASK(1, "--shot", "1"), `${labelOf(1)} is footage for "${TITLE}" already. To change that, say "that's not footage for ${TITLE}" first.`);
    u.done();
  });
  it("refuses a video that is sound alone, or that the import could not look at, as it cannot be footage", async () => {
    const t = setup();
    await planned(t);
    video(t, 1, { answer: { came: "sound", seen: "sound only, 0:20, no retakes", guess: null } });
    video(t, 2, { answer: { seen: "sound only, 0:20", came: null } });
    video(t, 3, { answer: { seen: "", came: null, guess: null } });
    await refused(t, ASK(1), `${labelOf(1)} is sound alone, so it can't be footage.`);
    await refused(t, ASK(2), `${labelOf(2)} is sound alone, so it can't be footage.`);
    await refused(t, ASK(3), `${labelOf(3)} could not be read when it was imported, so it can't be footage.`);
    t.done();
  });
  it("refuses a video with no sound as a talking part, and a video that shows a client as one, in words", async () => {
    const t = setup();
    await planned(t);
    video(t, 1, { silent: true });
    video(t, 2);
    await refused(t, ASK(1), `${labelOf(1)} has no sound, so it can't be a talking part: it is b-roll or a screen recording.`);
    await refused(t, ["footage", labelOf(2), TITLE, "talking", "--client", "yes"], "A talking part is you talking to the camera. A video that shows a client is b-roll or a screen recording.");
    // A video with no sound that shows a client is told the first.
    await refused(t, ["footage", labelOf(1), TITLE, "talking", "--client", "yes"], `${labelOf(1)} has no sound, so it can't be a talking part: it is b-roll or a screen recording.`);
    t.done();
  });
  it("refuses a video the other Mac is answering, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    video(t, 1, { over: { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } } });
    await refused(t, ASK(1), `${labelOf(1)} is being answered on Sallie's laptop. Nothing was changed.`);
    t.done();
  });
  it("refuses the video it is told of when the video is not there, the plan being a plan and not a video", async () => {
    const t = setup();
    await planned(t);
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", "Nothing like it", TITLE, "talking", "--client", "no");
    assert.deepEqual([r.code, r.said[0].startsWith("No episode fits")], [1, true]);
    // A plan is no video: the gate says it has no footage yet.
    const plan = await on(depsOf(t), "footage", TITLE, TITLE, "talking", "--client", "no");
    assert.deepEqual([plan.code, plan.said], [1, [`"${TITLE}" is a planned video, and it isn't made from its footage yet.`]]);
    unchanged(t, before);
    t.done();
  });
  it("says that another answer is being written when it holds the video's lock already, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const lock = lockOf(t, found.name);
    mkdirSync(episodeWork(t.home, found.name), { recursive: true });
    const text = JSON.stringify({ pid: 4242, command: "kind" });
    writeFileSync(lock, text);
    const r = await on(depsOf(t, { alive: (pid) => pid === 4242 }), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.deepEqual([r.code, r.said], [1, [`Another answer for ${labelOf(1)} is being written on this Mac: say it again in a moment.`]]);
    assert.deepEqual([reread(found).rev, readFileSync(lock, "utf8")], [1, text], "its lock is left alone");
    t.done();
  });
});

describe("the receipts and the sessions", () => {
  const ASK = (n, ...more) => ["footage", labelOf(n), TITLE, "b-roll", "--client", "no", "--shot", "2", ...more];
  /** What a refusal for want of her cards prints: NO_RECEIPT and the two cards, this plan among the plans offered, as `episodes` prints them. */
  const cardsFor = (label, titles = [TITLE]) => [
    NO_RECEIPT,
    `    Planned card: ${JSON.stringify(plannedCardOf({ label, offers: titles.map(footageOption) }))}`,
    `    Part card: ${JSON.stringify(partCardOf({ label }))}`
  ];
  async function refusedFor(t, deps, words, said) {
    const before = snapshot(t);
    const r = await on(deps, ...words);
    assert.deepEqual([r.code, r.said], [1, said], words.join(" "));
    unchanged(t, before, words.join(" "));
  }
  it("writes nothing on an open-lock Mac under Claude Code without her receipts of the planned card and the part card, and prints both cards", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    await refusedFor(t, open(t), ASK(1), cardsFor(labelOf(1)));
    // One card is not both.
    writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: footageOption(TITLE) }, offered: [footageOption(TITLE), "No"] });
    await refusedFor(t, open(t), ASK(1), cardsFor(labelOf(1)));
    t.done();
    const u = setup();
    await planned(u);
    video(u, 1);
    writeReceipt(u.home, { at: u.now(), label: labelOf(1), form: "part", answers: { [SHOT_Q(labelOf(1))]: "B-roll", [CLIENT_Q(labelOf(1))]: "No" } });
    await refusedFor(u, open(u), ASK(1), cardsFor(labelOf(1)));
    u.done();
  });
  it("writes it with both receipts, and the cards it prints are the very cards `episodes` prints", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const listed = (await on(open(t), "episodes")).said.filter((line) => /^ {4}(Planned|Part) card: /.test(line));
    assert.deepEqual(listed, cardsFor(labelOf(1)).slice(1));
    receipts(t, { label: labelOf(1) });
    const r = await on(open(t), ...ASK(1));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(reread(found).partOf, { id: PLAN_ID, as: "b-roll", shot: 2, client: false });
    t.done();
  });
  it("refuses a receipt of another plan, another kind of shot, another client answer, another video, one an hour old, and offers naming a plan dropped since", async () => {
    const OTHER = "Why SKUs sink you";
    // Each is a world of its own: a receipt stays good for an hour, so one scenario's would answer the next.
    for (const [what, make] of [
      ["another plan", (t) => receipts(t, { label: labelOf(1), title: OTHER, also: [TITLE] })],
      ["another kind of shot", (t) => receipts(t, { label: labelOf(1), kind: "A screen recording" })],
      ["another client answer", (t) => receipts(t, { label: labelOf(1), client: "Yes" })],
      ["another video's", (t) => receipts(t, { label: labelOf(2) })],
      ["an hour old", (t) => receipts(t, { label: labelOf(1), ago: 60 * 60 * 1000 })],
      ["a plan dropped since offered", (t) => receipts(t, { label: labelOf(1), also: ["A plan dropped since"] })],
      ["the planned card answered No", (t) => {
        writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: "No" }, offered: [footageOption(TITLE), "No"] });
        writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "part", answers: { [SHOT_Q(labelOf(1))]: "B-roll", [CLIENT_Q(labelOf(1))]: "No" } });
      }]]) {
      const t = setup();
      await planned(t);
      await planned(t, { title: OTHER, rand: 0.3 });
      const found = video(t, 1);
      video(t, 2);
      make(t);
      const before = snapshot(t);
      const r = await on(open(t), ...ASK(1));
      assert.equal(r.code, 1, `${what}: ${r.text}`);
      assert.equal(r.said[0], NO_RECEIPT, what);
      unchanged(t, before, what);
      assert.equal(reread(found).rev, 1, what);
      t.done();
    }
    // Her receipts for the right plan, the right kind and her right answers, from a card that offered both plans.
    const t = setup();
    await planned(t);
    await planned(t, { title: OTHER, rand: 0.3 });
    video(t, 1);
    receipts(t, { label: labelOf(1), also: [OTHER] });
    assert.equal((await on(open(t), ...ASK(1))).code, 0);
    t.done();
  });
  it("prints a fourth plan among the offers when it was named: the two newest and it, newest first", async () => {
    const t = setup();
    const titles = ["Plan one", "Plan two", "Plan three", "Plan four"];
    for (const [i, title] of titles.entries()) {
      const folder = await planned(t, { title, rand: 0.1 * (i + 1), shots: ONE_EACH });
      const record = readEpisode(folder).record;
      writeEpisode(folder, { ...record, planned: { ...record.planned, at: `2026-10-${10 + i}T09:00:00-05:00` } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    }
    video(t, 1);
    // Four plans wait; `episodes` offers the three newest, and a plan older than those that is named is among the offers, last.
    const listed = (await on(open(t), "episodes")).said.find((line) => line.startsWith("    Planned card: "));
    assert.deepEqual(JSON.parse(listed.slice("    Planned card: ".length)).questions[0].options.map((o) => o.label), [...titles.slice(1).reverse().map(footageOption), "No"]);
    const oldest = await on(open(t), "footage", labelOf(1), "Plan one", "talking", "--client", "no");
    assert.deepEqual(oldest.said.slice(1, 2), [`    Planned card: ${JSON.stringify(plannedCardOf({ label: labelOf(1), offers: ["Plan four", "Plan three", "Plan one"].map(footageOption) }))}`]);
    const newest = await on(open(t), "footage", labelOf(1), "Plan four", "talking", "--client", "no");
    assert.deepEqual(newest.said.slice(1, 2), [`    Planned card: ${JSON.stringify(plannedCardOf({ label: labelOf(1), offers: ["Plan four", "Plan three", "Plan two"].map(footageOption) }))}`]);
    // The receipt of a card that offered the plan she named, with every plan on it still offered, answers it.
    receipts(t, { label: labelOf(1), title: "Plan one", offered: undefined, also: [], kind: "Talking to the camera" });
    writeReceipt(t.home, { at: t.now(), label: labelOf(1), form: "planned", answers: { [PLANNED_Q(labelOf(1))]: footageOption("Plan one") }, offered: [footageOption("Plan four"), footageOption("Plan three"), footageOption("Plan one"), "No"] });
    assert.equal((await on(open(t), "footage", labelOf(1), "Plan one", "talking", "--client", "no")).code, 0);
    t.done();
  });
  it("asks for no receipt in Terminal, on a strict Mac or one whose Claude Code is not named, or when CLAUDECODE is not 1", async () => {
    const mac = [
      ["in Terminal", (t) => open(t, { env: {} })], ["CLAUDECODE not 1", (t) => open(t, { env: { CLAUDECODE: "0" } })], ["no Claude Code named", (t) => open(t, { minimum: null })],
      ["settings with no lock", (t) => depsOf(t, { env: { CLAUDECODE: "1" } })], ["settings strict", (t) => open(t, { settings: { ...t.ctx.settings, lock: "strict" } })]
    ];
    for (const [what, deps] of mac) {
      const t = setup();
      await planned(t);
      const found = video(t, 1);
      const r = await on(deps(t), ...ASK(1));
      assert.equal(r.code, 0, `${what}: ${r.text}`);
      assert.equal(isPart(reread(found)), true, what);
      t.done();
    }
  });
  it("refuses a Zoom download, a session's match and a video held beside a session with every receipt in place, in their own words", async () => {
    const SESSION = SESSION_RECORD;
    const t = setup();
    await planned(t);
    episodeAs(t, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION });
    video(t, 1, { answer: { came: "zoom" } });
    video(t, 2, { answer: { match: "e-20261020-5e5510" } });
    video(t, 3);
    episodeAs(t, { id: "e-20261020-5e5511", name: "2026-10-20 A later session (Mac Studio)", record: { ...SESSION, versionOf: idOf(3) } });
    for (const n of [1, 2, 3]) receipts(t, { label: labelOf(n) });
    const ZOOM = `${labelOf(1)} came from Zoom, and a Zoom download is never footage.`;
    const HOLDS = (n) => `${labelOf(n)} holds most of the words of a client or group session, so it is never footage. Ask Jason.`;
    for (const [n, why] of [[1, ZOOM], [2, HOLDS(2)], [3, HOLDS(3)]]) await refusedFor(t, open(t), ASK(n), [why]);
    // And on a Mac that asks for none, or in Terminal: the same.
    for (const [n, why] of [[1, ZOOM], [2, HOLDS(2)], [3, HOLDS(3)]]) await refusedFor(t, open(t, { env: {} }), ASK(n), [why]);
    t.done();
  });
  it("writes nothing for a session not cleared, in the gate's words, with every receipt in place", async () => {
    const t = setup();
    await planned(t);
    episodeAs(t, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION_RECORD });
    receipts(t, { label: "Session, 2026-10-20" });
    for (const deps of [open(t), depsOf(t)]) await refusedFor(t, deps, ["footage", "Session, 2026-10-20", TITLE, "b-roll", "--client", "no", "--shot", "2"], ["This is a client or group session: that is not done for one."]);
    t.done();
  });
  it("writes nothing for a video held as a session, though it is answered, in the gate's words, with every receipt in place", async () => {
    const t = setup();
    await planned(t);
    episodeAs(t, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION_RECORD });
    video(t, 1, { over: { ...HELD_RECORD, label: labelOf(1) } });
    receipts(t, { label: labelOf(1) });
    const HELD = "This video is a version of a client or group session: answer it as a session too, or ask Jason.";
    for (const deps of [open(t), depsOf(t), open(t, { env: {} })]) await refusedFor(t, deps, ASK(1), [HELD]);
    t.done();
  });
  it("writes nothing for a plan, which is no video, with every receipt in place", async () => {
    const t = setup();
    await planned(t);
    receipts(t, { label: TITLE });
    for (const deps of [open(t), depsOf(t)]) await refusedFor(t, deps, ["footage", TITLE, TITLE, "b-roll", "--client", "no", "--shot", "2"], [`"${TITLE}" is a planned video, and it isn't made from its footage yet.`]);
    t.done();
  });
});

describe("footage … none, taking a part back", () => {
  it("lets a part wait for its answer again, cards and all, until its plan is filmed", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2");
    assert.equal(partsOf(t.root, PLAN_ID).length, 1);
    const plan = planOf(t);
    const r = await on(depsOf(t), "footage", labelOf(1), "none");
    assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)} is no longer footage for "${TITLE}": it waits for its answer again.`]]);
    const now = reread(found);
    assert.deepEqual([now.rev, now.version, now.kind, Object.hasOwn(now, "partOf")], [3, 5, null, false]);
    assert.deepEqual(now.answer, WAITING);
    assert.equal(isPart(now), false);
    assert.equal(episodeFault(now), "");
    assert.deepEqual(partsOf(t.root, PLAN_ID), []);
    assert.deepEqual(planOf(t), plan, "the plan's record is not written for it");
    // It is listed again, with its cards, as a video waiting for its answer.
    const listed = (await on(depsOf(t), "episodes")).said;
    assert.ok(listed.some((line) => line.startsWith(`  ${labelOf(1)}: a video waiting for your answer`)), listed.join("\n"));
    assert.ok(listed.some((line) => line.startsWith("    Planned card: ")) && listed.some((line) => line.startsWith("    Card: ")), listed.join("\n"));
    t.done();
  });
  it("needs no receipt, as leaving a video needs none, and says it is no footage when the video is none", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const r = await on(open(t), "footage", labelOf(1), "none");
    assert.equal(r.code, 0, r.text);
    const before = snapshot(t);
    const not = await on(depsOf(t), "footage", labelOf(2), "none");
    assert.deepEqual([not.code, not.said], [1, [`${labelOf(2)} is not footage for a planned video.`]]);
    unchanged(t, before);
    t.done();
  });
  it("is refused once the plan is made from its footage: it is Jason's to fix", async () => {
    const t = setup();
    const folder = await planned(t);
    video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const record = planOf(t);
    writeEpisode(folder, { ...record, planned: { ...record.planned, filmed: { at: atOf(t), parts: [] } } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", labelOf(1), "none");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is made from its footage already: ask Jason.`]]);
    unchanged(t, before);
    t.done();
  });
  it("takes back a part of a plan that was dropped, and leaves the client's agreement in the plan as it was", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "2");
    // A plan with footage is not dropped by `plan … drop` (PR H5b, ruling 2): this one was dropped by a brimm-video before that, or by the other Mac.
    const before = planOf(t);
    writeEpisode(folderOf(t), { ...before, archived: { at: atOf(t) } }, { expectRev: before.rev, writeText: (to, text) => writeFileSync(to, text), writer: before.writer, home: t.home });
    const plan = planOf(t);
    const r = await on(depsOf(t), "footage", labelOf(1), "none");
    assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)} is no longer footage for "${TITLE}": it waits for its answer again.`]]);
    assert.deepEqual(planOf(t), plan);
    t.done();
  });
  it("takes back a part of a plan that is not on this Mac, in words that name none", async () => {
    const t = setup();
    const found = video(t, 1);
    const record = reread(found);
    writeEpisode(found.folder, { ...record, answer: { ...record.answer, state: "part", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" }, partOf: { id: "e-20261104-ccccc1", as: "talking", shot: null, client: false } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    const r = await on(depsOf(t), "footage", labelOf(1), "none");
    assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)} is no longer footage for a planned video: it waits for its answer again.`]]);
    t.done();
  });
});

// --- A client's agreement ---

const OSASCRIPT = "/usr/bin/osascript";
const TYPED = "Zebedee Quayle of Quayle Widgets, 21 October";
const TYPED_WORDS = /zebedee|quayle|widgets/i;
const agreed = (text = TYPED) => ({ code: 0, stdout: `button returned:They agreed, text returned:${text}\n`, stderr: "" });
const CANCELED = { code: 1, stdout: "", stderr: "execution error: User canceled. (-128)" };
const UNREADABLE = { code: 0, stdout: "", stderr: "" };
const OUT_OF_TIME = { code: 1, signal: "SIGKILL", outOfTime: true, stderr: "" };
const NOT_NOTED = "Not noted:";
const NOT_AGREED = "The footage is not agreed.";

/** Run edit.js with a stand-in for osascript that answers `answer` (a reply, or a function that gives or throws one), and records what it was
    asked, and what had been said and the plan's record number when it was asked. `during` is done inside the dialog, as another Mac's work is. */
function dialogs(t, answer, { during, ...deps } = {}) {
  const asked = [];
  const said = [];
  const run = async (cmd, args, opts) => {
    if (cmd !== OSASCRIPT) return t.ctx.deps.run(cmd, args, opts);
    asked.push({ cmd, args, opts, saidBefore: [...said], planRev: planOf(t).rev, waitsBefore: [...t.waits] });
    if (during) await during();
    return typeof answer === "function" ? answer() : answer;
  };
  return {
    asked,
    said,
    async ask(...argv) {
      const from = said.length;
      const code = await editMain(argv, { ...depsOf(t), ...deps, run, say: (line) => said.push(line) });
      const lines = said.slice(from);
      return { code, said: lines, text: lines.join("\n") };
    }
  };
}
const noteOf = (t, folderName = nameOf(t)) => join(episodeWork(t.home, folderName), "agreements.txt");
const logOf = (t) => join(t.home, "Library", "Logs", "brimm-video.log");
/** Where what she typed is: the paths of the files that hold it (in their text or their name), and the lines said. */
function whereTyped(t, d) {
  const files = listAll(t.dir).filter((rel) => TYPED_WORDS.test(rel) || TYPED_WORDS.test(readFileSync(join(t.dir, rel), "utf8")));
  const elsewhere = [JSON.stringify(t.started), JSON.stringify(t.calls.filter((c) => c.cmd !== OSASCRIPT)), JSON.stringify(t.opened)].filter((text) => TYPED_WORDS.test(text));
  return { files, said: d.said.filter((line) => TYPED_WORDS.test(line)), elsewhere };
}

/** The made-up plan with one b-roll part that shows a client (the video number 1) and one that does not (number 2), and a talking part (number 3). */
async function clientWorld() {
  const t = setup();
  const folder = await planned(t);
  const found = [1, 2, 3].map((n) => video(t, n, { silent: n !== 3 }));
  assert.equal((await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "2")).code, 0);
  assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "5")).code, 0);
  assert.equal((await on(depsOf(t), "footage", labelOf(3), TITLE, "talking", "--client", "no")).code, 0);
  return { t, folder, found };
}
const AGREE = (n = 1, planned = TITLE) => ["plan", planned, "agreed", labelOf(n)];

describe("plan … agreed: asking on a dialog Claude cannot press", () => {
  it("tells her to click, then shows one dialog that names the video and asks who agreed to being shown in the footage, with a field and Cancel and They agreed", async () => {
    const { t } = await clientWorld();
    const d = dialogs(t, agreed());
    const r = await d.ask(...AGREE());
    assert.equal(r.code, 0, r.text);
    assert.equal(d.asked.length, 1);
    assert.equal(r.said[0], `A dialog is open on this Mac for ${labelOf(1)}: type who agreed and when, then click "They agreed". Return presses Cancel.`);
    assert.deepEqual(d.asked[0].saidBefore, [r.said[0]], "she is told before the dialog opens");
    const script = d.asked[0].args[1];
    assert.ok(script.includes(`${labelOf(1)}\n\nWho agreed to being shown in this footage for \\"${TITLE}\\", and when?`), script);
    assert.ok(script.includes('buttons {"Cancel", "They agreed"} default button 1') && script.includes('default answer ""'), script);
    assert.equal(d.asked[0].opts.limit, 60000);
    t.done();
  });
  it("notes the agreement after her click: the line in agreements.txt (mode 0600), the part's id, label and day in the plan, and the tool log", async () => {
    const { t, found } = await clientWorld();
    const d = dialogs(t, agreed());
    const r = await d.ask(...AGREE());
    const day = dayOf(t);
    assert.deepEqual(r.said.slice(1), [`${labelOf(1)}: the client's agreement is noted, on ${dayText(day)}. Who agreed is kept on this Mac only, and the footage goes into the HyperFrames project.`]);
    // The note first, on this Mac's own disk: when, the video by its label and its id, and what she typed.
    const note = noteOf(t);
    assert.equal(readFileSync(note, "utf8"), `${atOf(t)} ${labelOf(1)} (${idOf(1)}): ${TYPED}\n`);
    assert.equal(statSync(note).mode & 0o777, 0o600);
    // Then one record write: the plan holds { id, label, at } and nothing she typed.
    const plan = planOf(t);
    assert.deepEqual(plan.planned.consent, [{ id: idOf(1), label: labelOf(1), at: day }]);
    assert.equal(isPlannedRecord(plan), true);
    assert.equal(episodeFault(plan), "");
    assert.deepEqual(Object.keys(plan.planned.consent[0]).sort(), ["at", "id", "label"]);
    // The log names the plan's id and the label, and says only that it was noted.
    assert.equal(readFileSync(logOf(t), "utf8"), `${atOf(t)} ${PLAN_ID} (${labelOf(1)}): a client's agreement to footage was noted by a click on this Mac's dialog.\n`);
    // What she typed is in that note and nowhere else.
    assert.deepEqual(whereTyped(t, { said: [...d.said] }), { files: [`home/BRIMM Video Work/${nameOf(t)}/agreements.txt`], said: [], elsewhere: [] });
    // The part itself is as it was: the agreement is the plan's.
    assert.equal(reread(found[0]).rev, 2);
    assert.deepEqual(existsSync(lockOf(t, nameOf(t))), false);
    t.done();
  });
  it("makes a note that was open to others readable by her alone, and adds to what it held", async () => {
    const { t } = await clientWorld();
    mkdirSync(episodeWork(t.home, nameOf(t)), { recursive: true });
    writeFileSync(noteOf(t), "an older line\n");
    chmodSync(noteOf(t), 0o644);
    assert.equal(statSync(noteOf(t)).mode & 0o777, 0o644);
    const r = await dialogs(t, agreed()).ask(...AGREE());
    assert.equal(r.code, 0, r.text);
    assert.equal(statSync(noteOf(t)).mode & 0o777, 0o600);
    assert.equal(readFileSync(noteOf(t), "utf8"), `an older line\n${atOf(t)} ${labelOf(1)} (${idOf(1)}): ${TYPED}\n`);
    t.done();
  });
  it("says so when the tool log cannot be written, and the agreement stands", async () => {
    const { t } = await clientWorld();
    // A file where the log's folder is to be.
    mkdirSync(join(t.home, "Library"), { recursive: true });
    writeFileSync(join(t.home, "Library", "Logs"), "not a folder");
    const r = await dialogs(t, agreed()).ask(...AGREE());
    assert.deepEqual([r.code, r.said.slice(1)], [0, [
      `${labelOf(1)}: the client's agreement is noted, on ${dayText(dayOf(t))}. Who agreed is kept on this Mac only, and the footage goes into the HyperFrames project.`,
      "The log on this Mac could not be written: the record holds the agreement."
    ]]);
    assert.deepEqual(planOf(t).planned.consent.map((c) => c.id), [idOf(1)]);
    assert.equal(whereTyped(t, r).files.length, 1, "what she typed is in the note alone");
    t.done();
  });
  it("lets the part go into a project only once her click has noted the client's agreement", async () => {
    const { t } = await clientWorld();
    const parts = () => Object.fromEntries(partsOf(t.root, PLAN_ID).map((p) => [p.record.label, mayGoIn(p, planOf(t).planned)]));
    // Before her click: the part that shows a client stays out, the others may go in.
    assert.deepEqual(parts(), { [labelOf(1)]: false, [labelOf(2)]: true, [labelOf(3)]: true });
    for (const answer of [CANCELED, UNREADABLE, OUT_OF_TIME, agreed(""), agreed("   "), agreed("​")]) {
      await dialogs(t, answer).ask(...AGREE());
      assert.deepEqual(parts(), { [labelOf(1)]: false, [labelOf(2)]: true, [labelOf(3)]: true }, JSON.stringify(answer));
    }
    // Her click, with something typed, lets that part in, and no other.
    assert.equal((await dialogs(t, agreed()).ask(...AGREE())).code, 0);
    assert.deepEqual(parts(), { [labelOf(1)]: true, [labelOf(2)]: true, [labelOf(3)]: true });
    t.done();
  });
  it("says the Reel's words for Cancel, a dialog out of time, an unreadable dialog and nothing typed, and writes nothing", async () => {
    for (const [what, answer, why] of [
      ["Cancel", CANCELED, `${NOT_NOTED} the footage is not agreed.`],
      ["out of time", OUT_OF_TIME, `${NOT_NOTED} the dialog was not answered within a minute, so it was closed. ${NOT_AGREED}`],
      ["unreadable", UNREADABLE, `${NOT_NOTED} The dialog's answer could not be read. ${NOT_AGREED}`],
      ["nothing typed", agreed(""), `${NOT_NOTED} nothing was typed. ${NOT_AGREED}`],
      ["only spaces", agreed("  \n\t "), `${NOT_NOTED} nothing was typed. ${NOT_AGREED}`],
      ["only invisible characters", agreed("​​"), `${NOT_NOTED} nothing was typed. ${NOT_AGREED}`]]) {
      const { t } = await clientWorld();
      const before = snapshot(t);
      const d = dialogs(t, answer);
      const r = await d.ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [why]], what);
      assert.deepEqual([snapshot(t), existsSync(noteOf(t)), existsSync(logOf(t)), existsSync(lockOf(t, nameOf(t)))], [before, false, false, false], what);
      t.done();
    }
  });
  it("refuses before any dialog a video that is not footage for the plan, one that shows no client, and ends 0 on one agreed already", async () => {
    const { t } = await clientWorld();
    await planned(t, { title: "Why SKUs sink you", rand: 0.3 });
    video(t, 4);
    const before = snapshot(t);
    const d = dialogs(t, agreed());
    // Not footage for this plan: another plan's, or none, or a video that is not there.
    for (const [words, why] of [
      [AGREE(4), `${labelOf(4)} is not footage for "${TITLE}".`],
      [AGREE(1, "Why SKUs sink you"), `${labelOf(1)} is not footage for "Why SKUs sink you".`],
      [AGREE(2), `${labelOf(2)} shows no client, so no agreement is needed.`],
      [AGREE(3), `${labelOf(3)} shows no client, so no agreement is needed.`],
      [["plan", TITLE, "agreed", "Nothing like it"], `That video is not footage for "${TITLE}".`]]) {
      const r = await d.ask(...words);
      assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
    }
    assert.deepEqual([d.asked.length, snapshot(t)], [0, before]);
    // Agreed once, it is agreed: said, and no dialog.
    assert.equal((await dialogs(t, agreed()).ask(...AGREE())).code, 0);
    const again = dialogs(t, agreed());
    const r = await again.ask(...AGREE());
    assert.deepEqual([r.code, r.said, again.asked.length], [0, [`${labelOf(1)}'s client agreed already, on ${dayText(dayOf(t))}.`], 0]);
    t.done();
  });
  it("refuses before any dialog a part whose episode Dropbox has kept a conflicted copy in, and one a newer BRIMM Video Studio wrote, and writes nothing", async () => {
    const { t } = await clientWorld();
    const folder = join(t.root, "Episodes", "2026-11-04 Drop 1 (Mac Studio)");
    const record = readEpisode(folder, { pastCopies: true }).record;
    writeFileSync(join(folder, "record", `0002 (Sallie's laptop's conflicted copy 2026-11-04).json`), recordText({ ...record }));
    const before = snapshot(t);
    const d = dialogs(t, agreed());
    const r = await d.ask(...AGREE());
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /conflicted copy/);
    assert.doesNotMatch(r.text, /Hamilton|Drop 1/);
    assert.deepEqual([d.asked.length, snapshot(t)], [0, before]);
    t.done();
    const u = (await clientWorld()).t;
    const newer = join(u.root, "Episodes", "2026-11-04 Drop 1 (Mac Studio)");
    writeFileSync(recordFile(newer, 3), JSON.stringify({ version: 6, id: idOf(1), rev: 3, kind: "podcast" }));
    const e = dialogs(u, agreed());
    const s = await e.ask(...AGREE());
    assert.equal(s.code, 1, s.text);
    assert.equal(e.asked.length, 0);
    assert.equal(existsSync(noteOf(u)), false);
    u.done();
  });
  it("finds the video by its label, its id, its short id, or its label and short id, and the plan by the string its title was made with", async () => {
    const { t } = await clientWorld();
    for (const said of [labelOf(1).toLowerCase(), idOf(1), idOf(1).slice(-6), `${labelOf(1)} (${idOf(1).slice(-6)})`]) {
      const d = dialogs(t, CANCELED);
      const r = await d.ask("plan", TITLE, "agreed", said);
      assert.equal(d.asked.length, 1, said);
      assert.equal(r.said[0].startsWith(`A dialog is open on this Mac for ${labelOf(1)}:`), true, said);
    }
    t.done();
  });
  it("refuses a plan that was dropped, a video that is a plan's, and the words it does not know, in the plan's words", async () => {
    const { t } = await clientWorld();
    const d = dialogs(t, agreed());
    for (const words of [["plan", TITLE, "agreed"], ["plan", TITLE, "agreed", labelOf(1), "extra"], ["plan", TITLE, "agreed", labelOf(1), "--zzz"], ["plan", TITLE, "agree", labelOf(1)]]) {
      assert.equal((await d.ask(...words)).code, 2, words.join(" "));
    }
    // A plan with footage is not dropped by `plan … drop` (PR H5b, ruling 2): this one was dropped by the other Mac, or by a brimm-video before that.
    const record = planOf(t);
    writeEpisode(folderOf(t), { ...record, archived: { at: atOf(t) } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    const r = await d.ask(...AGREE());
    assert.deepEqual([r.code, r.said, d.asked.length], [1, [`The plan for "${TITLE}" was dropped.`], 0]);
    t.done();
  });
  it("is refused for a video not yet answered, a session or a plan in the gate's own words when the plan named is no plan", async () => {
    const t = setup();
    video(t, 1);
    const d = dialogs(t, agreed());
    const r = await d.ask("plan", labelOf(1), "agreed", labelOf(1));
    assert.deepEqual([r.code, r.said, d.asked.length], [1, ["This video is waiting for its answer: say what it is first."], 0]);
    t.done();
  });
  it("reads the plan and the part again after her click, and writes nothing when either changed meanwhile", async () => {
    // The plan changed on the other Mac while the dialog was open.
    {
      const { t, folder } = await clientWorld();
      const during = () => {
        const record = planOf(t);
        writeEpisode(folder, { ...record, planned: { ...record.planned, lines: ["Changed."] } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
      };
      const d = dialogs(t, agreed(), { during });
      const r = await d.ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} ${TITLE} changed on the other Mac meanwhile. Say it again.`]]);
      assert.deepEqual([existsSync(noteOf(t)), Object.hasOwn(planOf(t).planned, "consent")], [false, false]);
      t.done();
    }
    // The part was taken back while it was open.
    {
      const { t } = await clientWorld();
      const d = dialogs(t, agreed(), { during: () => on(depsOf(t), "footage", labelOf(1), "none") });
      const r = await d.ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} ${labelOf(1)} changed meanwhile. Say it again.`]]);
      assert.deepEqual([existsSync(noteOf(t)), Object.hasOwn(planOf(t).planned, "consent")], [false, false]);
      t.done();
    }
    // The part was made footage again as one that shows no client.
    {
      const { t } = await clientWorld();
      const during = async () => {
        await on(depsOf(t), "footage", labelOf(1), "none");
        await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2");
      };
      const r = await dialogs(t, agreed(), { during }).ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} ${labelOf(1)} changed meanwhile. Say it again.`]]);
      assert.equal(existsSync(noteOf(t)), false);
      t.done();
    }
    // The part was taken back and made footage again, still showing a client: a new record, and not the one she was asked about.
    {
      const { t } = await clientWorld();
      const during = async () => {
        await on(depsOf(t), "footage", labelOf(1), "none");
        await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "2");
      };
      const r = await dialogs(t, agreed(), { during }).ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} ${labelOf(1)} changed meanwhile. Say it again.`]]);
      assert.deepEqual([existsSync(noteOf(t)), Object.hasOwn(planOf(t).planned, "consent")], [false, false]);
      t.done();
    }
  });
  it("refuses a record file still coming over, and a change Dropbox undid, before it writes the note", async () => {
    {
      const { t, folder } = await clientWorld();
      const d = dialogs(t, agreed(), { during: () => writeFileSync(recordFile(folder, planOf(t).rev + 1), '{"version":5,"id"') });
      const r = await d.ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} Dropbox is still bringing this episode's record over: say it again in a moment.`]]);
      assert.equal(existsSync(noteOf(t)), false);
      t.done();
    }
    {
      const { t } = await clientWorld();
      const d = dialogs(t, agreed(), { during: () => writeFileSync(join(t.home, "Library", "Application Support", "BRIMM Video", "written.json"), JSON.stringify({ [PLAN_ID]: planOf(t).rev + 5 })) });
      const r = await d.ask(...AGREE());
      assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} Dropbox undid this Mac's last change to ${TITLE}. Say it again.`]]);
      assert.equal(existsSync(noteOf(t)), false);
      t.done();
    }
  });
  it("writes no record when the note cannot be written, and says the record could not be made when the note was", async () => {
    const { t } = await clientWorld();
    const work = episodeWork(t.home, nameOf(t));
    mkdirSync(work, { recursive: true });
    mkdirSync(join(work, "agreements.txt"));
    const r = await dialogs(t, agreed()).ask(...AGREE());
    assert.deepEqual([r.code, r.said.slice(1)], [1, [`${NOT_NOTED} the note could not be written on this Mac. ${NOT_AGREED}`]]);
    assert.equal(Object.hasOwn(planOf(t).planned, "consent"), false);
    assert.ok(!whereTyped(t, r).said.length);
    t.done();
    const u = (await clientWorld()).t;
    const d = dialogs(u, agreed());
    // A record that cannot be written leaves the note, and says the footage is not agreed.
    const folder = folderOf(u);
    chmodSync(join(folder, "record"), 0o555);
    try {
      const failed = await d.ask(...AGREE());
      assert.equal(failed.code, 1);
      assert.equal(failed.said.at(-1), "The footage is not agreed: the note of who agreed is on this Mac only. Say it again.");
      assert.equal(existsSync(noteOf(u)), true);
      assert.equal(Object.hasOwn(planOf(u).planned, "consent"), false);
    } finally {
      chmodSync(join(folder, "record"), 0o755);
    }
    u.done();
  });
  it("says another answer is being written when the plan's lock is held, before any dialog", async () => {
    const { t } = await clientWorld();
    mkdirSync(episodeWork(t.home, nameOf(t)), { recursive: true });
    const text = JSON.stringify({ pid: 4242, command: "plan" });
    writeFileSync(lockOf(t, nameOf(t)), text);
    const d = dialogs(t, agreed(), { alive: (pid) => pid === 4242 });
    const r = await d.ask(...AGREE());
    assert.deepEqual([r.code, r.said, d.asked.length], [1, [`Another answer for ${TITLE} is being written on this Mac: say it again in a moment.`], 0]);
    assert.equal(readFileSync(lockOf(t, nameOf(t)), "utf8"), text, "its lock is left alone");
    t.done();
  });
  it("notes each client's agreement apart: two parts, two lines in the note and two in the plan", async () => {
    const { t } = await clientWorld();
    assert.equal((await on(depsOf(t), "footage", labelOf(2), "none")).code, 0);
    assert.equal((await on(depsOf(t), "footage", labelOf(2), TITLE, "screen", "--client", "yes")).code, 0);
    assert.equal((await dialogs(t, agreed("Client one, 1 Nov")).ask(...AGREE(1))).code, 0);
    assert.equal((await dialogs(t, agreed("Client two, 2 Nov")).ask(...AGREE(2))).code, 0);
    assert.deepEqual(planOf(t).planned.consent.map((c) => c.id), [idOf(1), idOf(2)]);
    assert.equal(readFileSync(noteOf(t), "utf8"), `${atOf(t)} ${labelOf(1)} (${idOf(1)}): Client one, 1 Nov\n${atOf(t)} ${labelOf(2)} (${idOf(2)}): Client two, 2 Nov\n`);
    t.done();
  });
});

describe("a client's part stays out until her click", () => {
  it("is a part that shows a client, kept out of a project until the plan holds her click for it: the agreement is for that part alone", async () => {
    const { t } = await clientWorld();
    // A second part that shows a client, from a video that came later.
    video(t, 4, { silent: true });
    assert.equal((await on(depsOf(t), "footage", labelOf(4), TITLE, "screen", "--client", "yes")).code, 0);
    const may = () => Object.fromEntries(partsOf(t.root, PLAN_ID).map((p) => [p.record.label, mayGoIn(p, planOf(t).planned)]));
    assert.deepEqual(may(), { [labelOf(1)]: false, [labelOf(2)]: true, [labelOf(3)]: true, [labelOf(4)]: false });
    assert.equal((await dialogs(t, agreed("Jane, today")).ask(...AGREE(1))).code, 0);
    assert.deepEqual(may(), { [labelOf(1)]: true, [labelOf(2)]: true, [labelOf(3)]: true, [labelOf(4)]: false });
    t.done();
  });
  it("does not let in a part made footage again, with a client, by an agreement noted for another part, or a part answered as showing none", async () => {
    const { t } = await clientWorld();
    await dialogs(t, agreed()).ask(...AGREE(1));
    // Taken back and made footage again for the same plan, showing a client, it is the same video, whose agreement stands.
    assert.equal((await on(depsOf(t), "footage", labelOf(1), "none")).code, 0);
    assert.equal((await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "yes", "--shot", "2")).code, 0);
    const part = partsOf(t.root, PLAN_ID).find((p) => p.record.label === labelOf(1));
    assert.equal(mayGoIn(part, planOf(t).planned), true);
    // Another video, shown the same way, has no agreement: its id is not in the plan.
    video(t, 5, { silent: true });
    await on(depsOf(t), "footage", labelOf(5), TITLE, "screen", "--client", "yes");
    const other = partsOf(t.root, PLAN_ID).find((p) => p.record.label === labelOf(5));
    assert.equal(mayGoIn(other, planOf(t).planned), false);
    t.done();
  });
  it("keeps what she typed in agreements.txt alone: not in the plan's record or any record, not in the log, a line said, a result or a file of Dropbox", async () => {
    const { t } = await clientWorld();
    const d = dialogs(t, agreed());
    const r = await d.ask(...AGREE());
    assert.equal(r.code, 0, r.text);
    const where = whereTyped(t, { said: [...d.said] });
    assert.deepEqual(where.files, [`home/BRIMM Video Work/${nameOf(t)}/agreements.txt`]);
    assert.deepEqual([where.said, where.elsewhere], [[], []]);
    // Nothing of Dropbox (the root) holds it, and the home's only holder is the note.
    assert.deepEqual(listAll(t.root).filter((rel) => TYPED_WORDS.test(readFileSync(join(t.root, rel), "utf8"))), []);
    t.done();
  });
});

describe("kind, leave and the gate, with a part and a video with no sound", () => {
  it("refuses kind and leave for a part, in the words that say how to take it back, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const before = snapshot(t);
    const why = FOOTAGE_REFUSED_BY(labelOf(1));
    for (const words of [["kind", labelOf(1), "finished", "--private", "no"], ["kind", labelOf(1), "raw", "--private", "no", "--again"], ["kind", labelOf(1), "clip", "--private", "no"], ["kind", labelOf(1), "session", "--private", "yes"],
      ["kind", labelOf(1), "finished", "--private", "no", "--not-a-session"], ["kind", labelOf(1), "finished", "--private", "no", "--clear-session"], ["leave", labelOf(1)]]) {
      for (const deps of [depsOf(t), open(t)]) {
        const r = await on(deps, ...words);
        assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
      }
    }
    unchanged(t, before);
    assert.equal(reread(found).rev, 2);
    t.done();
  });
  it("names the plan in that refusal as every line names it, and a part of a plan that is not on this Mac without naming one", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    await on(depsOf(t), "name", TITLE, "Why SKUs sink you");
    assert.deepEqual((await on(depsOf(t), "leave", labelOf(1))).said, [FOOTAGE_REFUSED_BY(labelOf(1), "Why SKUs sink you")]);
    t.done();
    const u = setup();
    const found = video(u, 2);
    const record = reread(found);
    writeEpisode(found.folder, { ...record, answer: { ...record.answer, state: "part", by: "Mac Studio", on: "Mac Studio", at: atOf(u), private: "no" }, partOf: { id: "e-20261104-ccccc1", as: "talking", shot: null, client: false } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: u.home });
    assert.deepEqual((await on(depsOf(u), "leave", labelOf(2))).said, [`${labelOf(2)} is footage for a planned video. Say "that's not footage" first.`]);
    u.done();
  });
  // The three Macs `kind` and `leave` tell apart: a strict one, Terminal (no Claude Code named), and an open lock under Claude Code, the only one that asks for receipts.
  const MACS = [
    ["a strict Mac", (t) => open(t, { settings: { ...t.ctx.settings, lock: "strict" } })],
    ["Terminal", (t) => open(t, { env: {} })],
    ["an open-lock Mac under Claude Code", (t) => open(t)]
  ];
  it("gives a video with no sound no kind at all, session included, on every Mac and before any receipt is looked at, and says what it can be", async () => {
    const WHY = `${labelOf(1)} has no sound, so Claude can't read it: it can only be footage for a planned video. Or say "leave it".`;
    const ANSWERS = [
      ["finished", "--private", "no"], ["raw", "--private", "no"], ["clip", "--private", "no"], ["session", "--private", "yes"],
      ["raw", "--private", "no", "--again"], ["session", "--private", "yes", "--again"], ["finished", "--private", "no", "--version-of", "none"],
      ["raw", "--private", "no", "--not-a-session"], ["finished", "--private", "no", "--clear-session"], ["raw", "--private", "no", "--here"]
    ];
    const t = setup();
    const found = video(t, 1, { silent: true });
    // Before any receipt is looked at: the open-lock Mac has none, and is not told to ask for a card that was never printed for this video.
    let before = snapshot(t);
    for (const words of ANSWERS) {
      const r = await on(open(t), "kind", labelOf(1), ...words);
      assert.deepEqual([r.code, r.said], [1, [WHY]], `no receipt: ${words.join(" ")}`);
    }
    unchanged(t, before);
    // And not for want of one: with every receipt it could have, on every Mac, nothing is answered.
    everyReceipt(t, labelOf(1));
    before = snapshot(t);
    for (const [what, deps] of MACS) {
      for (const words of ANSWERS) {
        const r = await on(deps(t), "kind", labelOf(1), ...words);
        assert.deepEqual([r.code, r.said], [1, [WHY]], `${what}: ${words.join(" ")}`);
      }
    }
    unchanged(t, before);
    assert.deepEqual([reread(found).rev, reread(found).kind, reread(found).answer.state], [1, null, "needs your answer"]);
    t.done();
  });
  it("lets a video with no sound be left, as any video waiting is, on every Mac and with no receipt", async () => {
    for (const [what, deps] of MACS) {
      const t = setup();
      const found = video(t, 1, { silent: true });
      const r = await on(deps(t), "leave", labelOf(1));
      assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)}: left. It is not asked about again.`]], what);
      assert.equal(reread(found).answer.state, "not for brimm-video", what);
      assert.equal(reread(found).kind, null, what);
      t.done();
    }
  });
  it("lets footage run for a video left alone, as a video waiting, and for a part, to take it back", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1, { silent: true });
    await on(depsOf(t), "leave", labelOf(1));
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "b-roll", "--client", "no", "--shot", "2");
    assert.equal(r.code, 0, r.text);
    assert.equal(isPart(reread(found)), true);
    t.done();
  });
  it("leaves a part to the commands that open a video waiting: which, show and resolve run, and every other is refused as waiting", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    for (const words of [["open", labelOf(1)], ["app", labelOf(1)], ["finish", labelOf(1)], ["ask", labelOf(1)], ["reels", labelOf(1)], ["spell", labelOf(1)], ["plan", labelOf(1)]]) {
      const r = await on(depsOf(t), ...words);
      assert.deepEqual([r.code, r.said], [1, ["This video is waiting for its answer: say what it is first."]], words.join(" "));
    }
    t.done();
  });
});

describe("episodes, and the cards under a video waiting for its answer (PR H5a)", () => {
  /** The lines under the video called `label`, up to the next line not indented four spaces. */
  function under(said, label) {
    const at = said.findIndex((line) => line.startsWith(`  ${label}: `));
    assert.ok(at >= 0, said.join("\n"));
    const lines = [];
    for (let i = at + 1; i < said.length && said[i].startsWith("    "); i++) lines.push(said[i]);
    return lines;
  }
  const PLANNED = (label, titles) => `    Planned card: ${JSON.stringify(plannedCardOf({ label, offers: titles.map(footageOption) }))}`;
  const PART = (label) => `    Part card: ${JSON.stringify(partCardOf({ label }))}`;
  it("prints the planned card and the part card before the card, under a video that a plan is offered to", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    const lines = under((await on(depsOf(t), "episodes")).said, labelOf(1));
    assert.deepEqual(lines.slice(0, 5), ["    Seen: wide, 0:20, no retakes", "    Came: from a camera", "    Guess: raw with retakes", PLANNED(labelOf(1), [TITLE]), PART(labelOf(1))]);
    assert.match(lines[5], /^ {4}Card: \{/);
    assert.equal(lines.length, 6);
    // The lines parse back to the very cards, as the fixed forms.
    assert.deepEqual(formOf(JSON.parse(lines[3].slice("    Planned card: ".length)).questions), { label: labelOf(1), form: "planned" });
    assert.deepEqual(formOf(JSON.parse(lines[4].slice("    Part card: ".length)).questions), { label: labelOf(1), form: "part" });
    t.done();
  });
  it("prints none when no plan waits: a plan whose package is not set, a dropped plan, a filmed one and an explainer", async () => {
    const t = setup();
    video(t, 1);
    const none = async (why) => {
      const lines = under((await on(depsOf(t), "episodes")).said, labelOf(1));
      assert.deepEqual(lines.filter((line) => /^ {4}(Planned|Part) card/.test(line)), [], why);
      assert.ok(lines.some((line) => line.startsWith("    Card: ")), why);
    };
    await none("no plan at all");
    await planned(t, { set: false });
    await none("a plan not set");
    await on(depsOf(t), "plan", TITLE, "set", ...SHOT_ARGS);
    assert.equal(under((await on(depsOf(t), "episodes")).said, labelOf(1)).filter((line) => /^ {4}(Planned|Part) card/.test(line)).length, 2);
    await on(depsOf(t), "plan", TITLE, "drop");
    await none("a dropped plan");
    const filmed = await planned(t, { title: "Filmed plan", rand: 0.3 });
    const record = readEpisode(filmed).record;
    writeEpisode(filmed, { ...record, planned: { ...record.planned, filmed: atOf(t) } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    await none("a filmed plan");
    await on(depsOf(t, { rand: () => 0.4 }), "plan", "new", "An explainer", "--explainer");
    await on(depsOf(t), "plan", "An explainer", "set", "--cue", "graphic | 4 | too many | A stack of boxes.", "--line", "One.");
    await none("an explainer");
    t.done();
  });
  it("offers the three newest of four plans, newest first", async () => {
    const t = setup();
    const titles = ["Plan one", "Plan two", "Plan three", "Plan four"];
    for (const [i, title] of titles.entries()) {
      const folder = await planned(t, { title, rand: 0.1 * (i + 1), shots: ONE_EACH });
      const record = readEpisode(folder).record;
      writeEpisode(folder, { ...record, planned: { ...record.planned, at: `2026-10-${10 + i}T09:00:00-05:00` } }, { expectRev: record.rev, writeText: (to, text) => writeFileSync(to, text), writer: record.writer, home: t.home });
    }
    video(t, 1);
    const lines = under((await on(depsOf(t), "episodes")).said, labelOf(1));
    assert.ok(lines.includes(PLANNED(labelOf(1), ["Plan four", "Plan three", "Plan two"])), lines.join("\n"));
    t.done();
  });
  it("prints none for a Zoom download, a video whose Maybe line is a session's, one held beside a session, or one with no picture", async () => {
    const SESSION = SESSION_RECORD;
    const t = setup();
    await planned(t);
    episodeAs(t, { id: "e-20261020-5e5510", name: "2026-10-20 A session (Mac Studio)", record: SESSION });
    video(t, 1, { answer: { came: "zoom", guess: null } });
    video(t, 2, { answer: { match: "e-20261020-5e5510" } });
    video(t, 3);
    episodeAs(t, { id: "e-20261020-5e5511", name: "2026-10-20 A later session (Mac Studio)", record: { ...SESSION, versionOf: idOf(3) } });
    video(t, 4, { answer: { came: "sound", seen: "sound only, 0:20, no retakes", guess: null } });
    video(t, 5);
    const said = (await on(depsOf(t), "episodes")).said;
    for (const n of [1, 2, 3, 4]) assert.deepEqual(under(said, labelOf(n)).filter((line) => /^ {4}(Planned|Part) card/.test(line)), [], labelOf(n));
    assert.deepEqual(under(said, labelOf(5)).filter((line) => /^ {4}(Planned|Part) card/.test(line)), [PLANNED(labelOf(5), [TITLE]), PART(labelOf(5))]);
    t.done();
  });
  it("prints No sound in place of the card for a video with no sound, with the cards of the plans it is offered to before it", async () => {
    const NO_SOUND = "    No sound: it can only be footage for a planned video.";
    const t = setup();
    video(t, 1, { silent: true });
    const alone = under((await on(depsOf(t), "episodes")).said, labelOf(1));
    assert.deepEqual(alone, ["    Seen: upright, 0:08, no sound", "    Came: from an iPhone", NO_SOUND]);
    await planned(t);
    const lines = under((await on(depsOf(t), "episodes")).said, labelOf(1));
    assert.deepEqual(lines, ["    Seen: upright, 0:08, no sound", "    Came: from an iPhone", PLANNED(labelOf(1), [TITLE]), PART(labelOf(1)), NO_SOUND]);
    assert.ok(!lines.some((line) => line.startsWith("    Card")));
    t.done();
  });
  it("lists a part nowhere: not in episodes, and not in the guide", async () => {
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const said = (await on(depsOf(t), "episodes")).said;
    assert.ok(!said.some((line) => line.includes(labelOf(1))), said.join("\n"));
    assert.ok(said.some((line) => line.startsWith(`  ${labelOf(2)}: a video waiting for your answer`)));
    const guide = (await on(light(t), "guide")).said.join("\n");
    assert.ok(!guide.includes(labelOf(1)), guide);
    t.done();
  });
});

describe("plan, the footage a plan has, and the guide (PR H5a)", () => {
  it("says the plan with a line for each part, and as it did with none", async () => {
    const t = setup();
    await planned(t);
    const none = (await on(depsOf(t), "plan", TITLE)).said;
    video(t, 1);
    video(t, 2);
    video(t, 3);
    video(t, 4);
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "2");
    await on(depsOf(t), "footage", labelOf(3), TITLE, "screen", "--client", "yes");
    await on(depsOf(t), "footage", labelOf(4), TITLE, "b-roll", "--client", "yes", "--shot", "5");
    await dialogs(t, agreed()).ask(...AGREE(4));
    const said = (await on(depsOf(t), "plan", TITLE)).said;
    assert.deepEqual(said.slice(0, none.length), none);
    assert.deepEqual(said.slice(none.length), [
      `Footage: ${labelOf(1)}, talking to the camera.`,
      `Footage: ${labelOf(2)}, b-roll for shot 2.`,
      `Footage: ${labelOf(3)}, a screen recording for shot 4. It shows a client, and waits for their agreement.`,
      `Footage: ${labelOf(4)}, b-roll for shot 5. It shows a client, who agreed on ${dayText(dayOf(t))}.`
    ]);
    t.done();
  });
  it("tells her what footage is in, and what it is waiting for, in the guide; with none, as it did", async () => {
    const t = setup();
    await planned(t);
    const FILM = "Film it to its shot list, then drop the files in your drop folder. To read the teleprompter script, say 'show me the script': it opens as a copy to read, and changes come through the chat.";
    assert.deepEqual((await on(light(t), "guide", TITLE)).said, [`${TITLE} (${SHORT}): ${FILM}`]);
    for (const n of [1, 2, 3, 4, 5]) video(t, n, { silent: n > 2 });
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    const one = (await on(light(t), "guide", TITLE)).said;
    assert.deepEqual(one, [`${TITLE} (${SHORT}): Its footage so far: 1 talking part. When it is all in, say "that's all the footage".`]);
    await on(depsOf(t), "footage", labelOf(2), TITLE, "talking", "--client", "no");
    await on(depsOf(t), "footage", labelOf(3), TITLE, "screen", "--client", "yes");
    await on(depsOf(t), "footage", labelOf(4), TITLE, "b-roll", "--client", "no", "--shot", "2");
    await on(depsOf(t), "footage", labelOf(5), TITLE, "b-roll", "--client", "yes", "--shot", "5");
    const all = (await on(light(t), "guide", TITLE)).said;
    assert.deepEqual(all, [
      `${TITLE} (${SHORT}): Its footage so far: 2 talking parts, 1 screen recording and 2 b-roll clips. When it is all in, say "that's all the footage".`,
      `${labelOf(3)} shows a client: it stays out until you say "the client agreed".`,
      `${labelOf(5)} shows a client: it stays out until you say "the client agreed".`
    ]);
    // Once she has clicked for one, its line goes.
    await dialogs(t, agreed()).ask(...AGREE(3));
    assert.deepEqual((await on(light(t), "guide", TITLE)).said, [all[0], all[2]]);
    // The overview says the same, under the plan.
    const overview = (await on(light(t), "guide")).said;
    assert.ok(overview.includes(`  ${TITLE} (${SHORT}): Its footage so far: 2 talking parts, 1 screen recording and 2 b-roll clips. When it is all in, say "that's all the footage".`), overview.join("\n"));
    assert.ok(overview.includes(`    ${labelOf(5)} shows a client: it stays out until you say "the client agreed".`), overview.join("\n"));
    // Taken back, a plan with none is told to film it again.
    for (const n of [1, 2, 3, 4, 5]) await on(depsOf(t), "footage", labelOf(n), "none");
    assert.deepEqual((await on(light(t), "guide", TITLE)).said, [`${TITLE} (${SHORT}): ${FILM}`]);
    t.done();
  });
  it("tells each plan of one pass its own footage, and the wait for a client's agreement under the plan whose part it is", async () => {
    const t = setup();
    await planned(t);
    await planned(t, { title: "Why prices", rand: 0.5, shots: ONE_EACH });
    for (const n of [1, 2, 3]) video(t, n, { silent: n > 1 });
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    await on(depsOf(t), "footage", labelOf(2), "Why prices", "b-roll", "--client", "yes");
    await on(depsOf(t), "footage", labelOf(3), "Why prices", "screen", "--client", "no");
    const FIRST = `${TITLE} (${SHORT}): Its footage so far: 1 talking part. When it is all in, say "that's all the footage".`;
    const SECOND = `Why prices (800000): Its footage so far: 1 screen recording and 1 b-roll clip. When it is all in, say "that's all the footage".`;
    const WAIT = `${labelOf(2)} shows a client: it stays out until you say "the client agreed".`;
    assert.deepEqual((await on(light(t), "guide", TITLE)).said, [FIRST]);
    assert.deepEqual((await on(light(t), "guide", "Why prices")).said, [SECOND, WAIT]);
    const overview = (await on(light(t), "guide")).said;
    assert.ok(overview.includes(`  ${FIRST}`), overview.join("\n"));
    assert.ok(overview.includes(`  ${SECOND}`), overview.join("\n"));
    assert.equal(overview.filter((line) => line.includes("shows a client")).length, 1, overview.join("\n"));
    assert.equal(overview[overview.indexOf(`  ${SECOND}`) + 1], `    ${WAIT}`, overview.join("\n"));
    t.done();
  });
});

describe("the words of a footage command, through the guard (PR H5a)", () => {
  const decision = (tail) => guardDecision({ tool_name: "Bash", tool_input: { command: `${EDIT} ${tail}` } }, { checkout: CHECKOUT, node: NODE }).decision;
  const LABEL = labelOf(1);
  it("lets footage and a client's agreement through as Claude runs them, with a plan's title written in codes, and refuses the raw marks", () => {
    assert.equal(decision(`footage "${LABEL}" "Too many SKUs" talking --client no`), "allow");
    assert.equal(decision(`footage "${LABEL}" "Too many SKUs" b-roll --client yes --shot 2`), "allow");
    assert.equal(decision(`footage "${LABEL}" "Too many SKUs" screen --client no`), "allow");
    assert.equal(decision(`footage "${LABEL}" none`), "allow");
    assert.equal(decision(`plan "Too many SKUs" agreed "${LABEL}"`), "allow");
    assert.equal(decision(`footage "${LABEL}" "Make %2410k %22fast%22 %7C 100%25" talking --client no`), "allow");
    assert.equal(decision(`footage "${LABEL}" "Make $10k" talking --client no`), "deny");
    assert.equal(decision(`footage "${LABEL}" "She said "no"" talking --client no`), "deny");
  });
});

describe("the words of footage in the help and the lists (PR H5a)", () => {
  it("has the help give footage its two forms and plan its agreed form, with every flag", () => {
    for (const usage of ['node edit.js footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]', 'node edit.js footage "<video>" none', 'node edit.js plan "<planned>" agreed "<video>"']) assert.ok(HELP.includes(usage), usage);
    assert.ok(COMMAND_NAMES.includes("footage"));
  });
  it("is read by footageAsked as the help says", () => {
    assert.deepEqual(footageAsked(["V", "P", "b-roll"], { client: ["no"], shot: ["2"] }).shot, 2);
  });
  it("says nothing she reads with a path, a flag or the name of a command in it", async () => {
    const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|\bfootage "|\bplan "/;
    const t = setup();
    await planned(t);
    video(t, 1);
    video(t, 2, { silent: true });
    const said = [];
    for (const ask of [["footage", labelOf(1), TITLE, "talking", "--client", "no"], ["footage", labelOf(1), "none"], ["footage", labelOf(2), TITLE, "b-roll", "--client", "no"], ["footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "2"], ["footage", labelOf(2), TITLE, "talking", "--client", "no"], ["plan", TITLE], ["footage", labelOf(2), "none"]]) {
      said.push(...(await on(depsOf(t), ...ask)).said);
    }
    for (const line of said) assert.ok(!PLAIN.test(line), line);
    t.done();
  });
  it("leaves the readdir of Episodes as it found it: nothing is made but records", async () => {
    const t = setup();
    await planned(t);
    const found = video(t, 1);
    const before = readdirSync(join(t.root, "Episodes")).sort();
    await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.deepEqual(readdirSync(join(t.root, "Episodes")).sort(), before);
    assert.deepEqual(readdirSync(join(found.folder, "record")).sort(), ["0001.json", "0002.json"]);
    t.done();
  });
});
