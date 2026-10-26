// `kind`, `leave` and `which`: Sallie's answer to "what is this video?" (spec 2026-10-22, section 2, "The card" and "What the
// answer does", and "The session mark"). A video imported lightly stays unanswered until she answers a card of two questions;
// `kind` then claims the video as `open` does, records both answers, and starts Claude's reading detached, except for a client or
// group session, which is marked and named by its label and read only when she asks for its teachings. Nothing here runs a real
// program or touches Dropbox: each test has a root and a home of its own, and the detached run `read` (a later task's) is a
// stand-in that is started and asserted, never run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { CLAIM_WAIT_MS, contextFor, editMain, findEpisode } from "../edit.js";
import { askBlocked, clockAt } from "../unedited.js";
import { claimed, localStamp, newEpisode, readEpisode, recordFile, recordText, shownName } from "../episode.js";
import { episodeWork } from "../settings.js";
import { lockOf, resultFile } from "../detached.js";
import { chainGapWords } from "../finish.js";
import { writePending } from "../filing.js";
import { writeStatus } from "../importing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { sessionLabel } from "../kinds.js";
import { notSessionCardOf } from "../receipts.js";
import { setup, episodeFor, reread, otherMac, FOLDER, ID, NAME } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const AT = "2026-10-20T15:00:00-05:00";
/** The clock of episodes.js's setup, as a record keeps a moment, and twenty seconds on, when the claim has waited. */
const NOW = localStamp(new Date(Date.parse(AT)));
const AFTER_CLAIM = localStamp(new Date(Date.parse(AT) + CLAIM_WAIT_MS));
const LABEL = "Video of 20 Oct, 15:00 (Mac Studio)";
const SHORT = ID.slice(-6);

const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 2:00, 3 retakes", came: "camera", match: null };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
/** A video not yet answered, as a light import leaves one (the made-up episode's, named by its label). */
const WAITING = { version: 3, kind: null, answer: ANSWER, label: LABEL };
const MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };

// The words a person reads.
const BOTH = "Say both answers: what it is, and whether it is a private session (--private yes or no).";
const DISAGREE = "Those two answers disagree: say again whether it is a private session.";
const ZOOM = "Ask first whether it is a client or group session: it came from Zoom, or is sound alone. Then answer again with --not-a-session.";
const MARKED = 'This was marked a client or group session. Clearing the mark needs your click on this Mac: say "clear the session mark".';
const LEFT_WORDS = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
const NOT_YET = "The video is not on this Mac yet: Dropbox is still bringing it over. Say it again in a minute.";
const SESSION_NEXT = "Ask her whether she wants its teachings (principles and Reel ideas) or the transcript only.";
const STILL = (name) => `Claude is still reading ${name}. A notice will come on this Mac when it is done: then say "what did Claude find?"`;

/** The made-up episode, waiting for its answer, with `over` laid on its record. */
const waiting = (t, over = {}) => episodeFor(t, { record: { ...WAITING, ...over } });

/** This Mac's deps with its settings changed by `over`. */
const withSettings = (t, over) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, ...over } });

/** Have the stand-in wait do `then` on every wait of `ms` milliseconds, after it has moved the clock. */
const duringWaits = (t, ms, then) => {
  const wait = t.ctx.deps.wait;
  t.ctx.deps.wait = async (asked) => {
    await wait(asked);
    if (asked === ms) await then();
  };
};

/** The result a `read` run leaves for the made-up episode, as runDetached writes one, with `over` laid on it. */
function leaveResult(t, over = {}) {
  mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
  const result = { version: 1, command: "read", started: t.now() - 5000, ended: t.now(), ok: true, made: ["notes.txt"], failed: [], next: "", ...over };
  writeFileSync(resultFile(t.home, FOLDER, "read"), JSON.stringify(result));
  return result;
}

/** A second episode on this Mac, in a folder of its own, beside the made-up one: unanswered, with a label, unless `over` says
    otherwise. */
const OTHER_ID = "e-20261020-a1b2c3";
const OTHER_FOLDER = "2026-10-20 Coaching call (Mac Studio)";
function addEpisode(t, { folder = OTHER_FOLDER, id = OTHER_ID, file = "Coaching call.mov", created = "2026-10-20T14:00:00-05:00", over = {} } = {}) {
  const dir = join(t.root, "Episodes", folder);
  mkdirSync(join(dir, "record"), { recursive: true });
  writeFileSync(join(dir, file), "video");
  const first = newEpisode({ id, machine: "Mac Studio", at: AT, video: { file, bytes: 5, seconds: 120, created }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" }, files: { [file]: 5 } });
  writeFileSync(recordFile(dir, 1), recordText({ ...first, rev: 1, ...WAITING, ...over }));
  return { folder: dir, name: folder, record: readEpisode(dir).record };
}

/** The words a detached `read` is started with: the folder, and the kind and rev the answer's record holds. */
const readArgs = (kind, rev) => ["read", "--now", FOLDER, "--kind", kind, "--rev", String(rev)];
/** The lock `kind` and `leave` hold for an episode on this Mac, in its work folder. */
const answerLock = (t) => join(episodeWork(t.home, FOLDER), "answer.lock");
/** What every Mac's `alive` says in these tests: only the processes named, and always this one. */
const aliveIs = (...pids) => (pid) => pids.includes(pid);

/** What changed in the record, and what started: nothing. */
const untouched = (t, found, rev = 1) => assert.deepEqual([reread(found).rev, t.started, t.waits], [rev, [], []]);

describe("kind: both answers, and agreeing", () => {
  it("says to give both, with 2, when the kind or --private is missing or is not what it takes, and writes and starts nothing", async () => {
    const t = setup();
    const found = waiting(t);
    for (const argv of [[], [LABEL], [LABEL, "finished"], [LABEL, "--private", "no"], [LABEL, "finished", "--private"], [LABEL, "finished", "--private", "maybe"], [LABEL, "podcast", "--private", "no"], [LABEL, "finished", "--private", "no", "--private", "yes"]]) {
      const r = await on(t.ctx.deps, "kind", ...argv);
      assert.deepEqual([r.code, r.said], [2, [BOTH]], argv.join(" "));
    }
    untouched(t, found);
    t.done();
  });
  it("says again whether it is a private session, with 1, when the answers disagree, and writes and starts nothing", async () => {
    const t = setup();
    const found = waiting(t);
    for (const argv of [["finished", "--private", "yes"], ["raw", "--private", "yes"], ["clip", "--private", "yes"], ["session", "--private", "no"]]) {
      const r = await on(t.ctx.deps, "kind", LABEL, ...argv);
      assert.deepEqual([r.code, r.said], [1, [DISAGREE]], argv.join(" "));
    }
    untouched(t, found);
    t.done();
  });
  it("takes the kind and the answer in any case, and the label as several words", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on(t.ctx.deps, "kind", ...LABEL.split(" "), "Finished", "--private", "NO");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "finished");
    t.done();
  });
  it("records each kind as it is kept: clip as a short video, and the answer with who, where, when and the privacy", async () => {
    for (const [word, kept, priv] of [["finished", "finished", "no"], ["raw", "raw", "no"], ["clip", "short video", "no"], ["session", "session", "yes"]]) {
      const t = setup();
      const found = waiting(t);
      const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", priv);
      assert.equal(r.code, 0, `${word}: ${r.text}`);
      const record = reread(found);
      assert.equal(record.kind, kept, word);
      assert.deepEqual(record.answer, { ...ANSWER, state: "answered", by: "Mac Studio", on: "Mac Studio", at: AFTER_CLAIM, private: priv }, word);
      assert.equal(record.version, 3);
      t.done();
    }
  });
  it("finds the video by its folder's name and its id as well as its label, as the gate lets any such record be found", async () => {
    for (const said of [FOLDER, ID, SHORT, `${LABEL} (${SHORT})`]) {
      const t = setup();
      const found = waiting(t);
      const r = await on(t.ctx.deps, "kind", said, "finished", "--private", "no");
      assert.equal(r.code, 0, `${said}: ${r.text}`);
      assert.equal(reread(found).kind, "finished", said);
      t.done();
    }
  });
});

describe("kind: an answered video, and the wrong answer for how it came", () => {
  /** What each kind is called to her when it is answered already. */
  const WORDS = { finished: "finished by your editor", raw: "raw with retakes", "short video": "an iPhone clip", episode: "raw with retakes" };
  it("refuses an answered record without --again, in its words, and writes nothing", async () => {
    for (const [kind, word] of Object.entries(WORDS)) {
      const t = setup();
      const found = episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, name: { text: NAME, placeholder: false } } });
      const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no");
      assert.deepEqual([r.code, r.said], [1, [`${NAME} is answered already: it is ${word}. To change it, answer again with --again.`]], kind);
      untouched(t, found);
      t.done();
    }
  });
  it("refuses a record from before the switch, which has no answer at all, in the same words, and answers it with --again", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { name: { text: NAME, placeholder: false } } });
    const refused = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no");
    assert.deepEqual([refused.code, refused.said], [1, [`${NAME} is answered already: it is raw with retakes. To change it, answer again with --again.`]]);
    untouched(t, found);
    const again = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again");
    assert.equal(again.code, 0, again.text);
    const record = reread(found);
    assert.deepEqual([record.kind, record.answer.state, record.answer.private, record.answer.came], ["finished", "answered", "no", null]);
    assert.equal(readEpisode(found.folder).record.rev, 3);
    t.done();
  });
  it("answers an answered record again with --again: the claim, the new answer, and the reading", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    assert.deepEqual([record.kind, record.rev, record.answer.at, record.answer.by], ["raw", 3, AFTER_CLAIM, "Mac Studio"]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [readArgs("raw", 3)]);
    t.done();
  });
  it("answers a video left alone as an unanswered one, without --again", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).answer.state], ["finished", "answered"]);
    t.done();
  });
  it("refuses a video that came from Zoom or is sound alone, answered as anything but a session, without --not-a-session", async () => {
    for (const came of ["zoom", "sound"]) {
      const t = setup();
      const found = waiting(t, { answer: { ...ANSWER, guess: null, came } });
      for (const word of ["raw", "finished", "clip"]) {
        const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", "no");
        assert.deepEqual([r.code, r.said], [1, [ZOOM, `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: LABEL, came }))}`]], `${came} ${word}`);
      }
      untouched(t, found);
      const given = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--not-a-session");
      assert.equal(given.code, 0, given.text);
      assert.equal(reread(found).kind, "raw");
      t.done();
    }
  });
  it("lets a video from Zoom be answered as a session with no more said", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, guess: null, came: "zoom" } });
    const r = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "session");
    t.done();
  });
  it("asks about Zoom only for a video that came so: a camera's is answered as raw at once", async () => {
    const t = setup();
    const found = waiting(t);
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no")).code, 0);
    assert.equal(reread(found).kind, "raw");
    t.done();
  });
});

describe("kind: a session answered again", () => {
  const SESSION_NAME = "Session, 2026-10-20";
  const SESSION = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: SESSION_NAME, placeholder: false }, label: LABEL };
  it("refuses a session not cleared answered as anything else, in the words of the click on the dialog, and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: SESSION });
    for (const word of ["finished", "raw", "clip"]) {
      const r = await on(t.ctx.deps, "kind", SESSION_NAME, word, "--private", "no", "--again");
      assert.deepEqual([r.code, r.said], [1, [MARKED]], word);
    }
    untouched(t, found);
    t.done();
  });
  it("says a session answered again as a session is one already", async () => {
    const t = setup();
    const found = episodeFor(t, { record: SESSION });
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "session", "--private", "yes", "--again");
    assert.deepEqual([r.code, r.said], [1, [`${SESSION_NAME} is a client or group session already.`]]);
    untouched(t, found);
    t.done();
  });
  it("says it is answered already, for a session, without --again", async () => {
    const t = setup();
    const found = episodeFor(t, { record: SESSION });
    const r = await on(t.ctx.deps, "kind", SESSION_NAME, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${SESSION_NAME} is answered already: it is a client or group session. To change it, answer again with --again.`]]);
    untouched(t, found);
    t.done();
  });
});

describe("kind: a session whose mark she cleared", () => {
  const CLEARED = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: LABEL, name: { text: "Talk with a friend", placeholder: false }, session: { ...MARK, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } };
  it("is answered like any other answered video: with --again, as another kind", async () => {
    const t = setup();
    const found = episodeFor(t, { record: CLEARED });
    const refused = await on(t.ctx.deps, "kind", "Talk with a friend", "raw", "--private", "no");
    assert.equal(refused.text, "Talk with a friend is answered already: it is a client or group session. To change it, answer again with --again.");
    const r = await on(t.ctx.deps, "kind", "Talk with a friend", "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).name.text, reread(found).session.cleared.confirmed], ["raw", "Talk with a friend", "dialog"]);
    t.done();
  });
  it("is marked again, not cleared, when it is answered again as a session", async () => {
    const t = setup();
    const found = episodeFor(t, { record: CLEARED });
    const r = await on(t.ctx.deps, "kind", "Talk with a friend", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    // Its words may have gone to Claude while its mark was cleared: an empty session revision is owed the BRIMM Ops page, which this
    // Mac, handing off version 1, does not write yet (F9b).
    assert.deepEqual(record.session, { marked: AFTER_CLAIM, on: "Mac Studio", teachings: null, cleared: null, emptyRevision: "owed" });
    assert.equal(record.name.text, sessionLabel(record.video.recorded));
    t.done();
  });
});

describe("kind: the claim", () => {
  it("writes the claim, waits twenty seconds, reads again, and then writes the answer, with the claim left on the record", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.text);
    // The claim is the second record, with nothing answered; the answer is the third, and the claim stays on it.
    const claim = JSON.parse(readFileSync(recordFile(found.folder, 2), "utf8"));
    assert.deepEqual([claim.kind, claim.editing, claim.answer.state], [null, { by: "Mac Studio", since: NOW }, "needs your answer"]);
    const record = reread(found);
    assert.deepEqual([record.rev, record.kind, record.editing], [3, "finished", { by: "Mac Studio", since: NOW }]);
    assert.equal(t.waits[0], 20000);
    t.done();
  });
  it("writes only the answer, and does not wait, when this Mac has the video open already", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false }, editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).rev, reread(found).editing.since, t.waits.includes(CLAIM_WAIT_MS)], [2, "2026-10-20T14:00:00-05:00", false]);
    t.done();
  });
  it("refuses at once, and starts no run, when the other Mac has it", async () => {
    const t = setup();
    const found = waiting(t, { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} is being answered on Sallie's laptop. Nothing was changed.`]]);
    untouched(t, found);
    t.done();
  });
  it("keeps the claim on the record after the answer, so that the other Mac's answer is refused until it lets go", async () => {
    const t = setup();
    const found = waiting(t);
    const laptop = otherMac(t);
    const first = await on(laptop.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(first.code, 0, first.text);
    assert.equal(reread(found).editing.by, "Sallie's laptop");
    const started = t.started.length;
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, ["Pricing talk is being answered on Sallie's laptop. Nothing was changed."]]);
    assert.deepEqual([t.started.length, reread(found).kind], [started, "finished"]);
    // It lets go, as today, and the other Mac's answer then goes through.
    assert.equal((await on(laptop.deps, "release", LABEL)).code, 0);
    const after = await on(t.ctx.deps, "kind", "Pricing talk", "raw", "--private", "no", "--again");
    assert.equal(after.code, 0, after.text);
    assert.equal(reread(found).kind, "raw");
    t.done();
  });
  it("stops, and starts no run, when the other Mac claimed it during the wait", async () => {
    const t = setup();
    const found = waiting(t);
    duringWaits(t, CLAIM_WAIT_MS, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...claimed(mine, "Sallie's laptop", "2026-10-20T15:00:10-05:00"), rev: mine.rev + 1, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} is being answered on Sallie's laptop. Nothing was changed.`]]);
    assert.deepEqual([t.started, reread(found).kind, reread(found).rev], [[], null, 3]);
    t.done();
  });
  it("stops, naming the conflict, when both Macs wrote the same record number", async () => {
    const t = setup();
    const found = waiting(t);
    const copy = "0002 (Sallie's laptop's conflicted copy 2026-10-20).json";
    duringWaits(t, CLAIM_WAIT_MS, () => {
      const first = { ...reread(found), rev: 1 };
      writeFileSync(join(found.folder, "record", copy), recordText({ ...claimed(first, "Sallie's laptop", "2026-10-20T15:00:05-05:00"), rev: 2, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 1);
    assert.ok(r.text.includes("Dropbox has kept a conflicted copy in this episode"), r.text);
    // A video not yet answered is named by its label, never by its folder.
    assert.ok(r.text.startsWith(`${LABEL} (${SHORT}): `), r.text);
    assert.ok(!r.text.includes(FOLDER), r.text);
    assert.deepEqual([t.started, readEpisode(found.folder, { pastCopies: true }).record.kind], [[], null]);
    t.done();
  });
  it("says Dropbox undid this Mac's claim, and starts no run, when the claim is gone after the wait; the next try goes through", async () => {
    const t = setup();
    const found = waiting(t);
    let undid = false;
    duringWaits(t, CLAIM_WAIT_MS, () => {
      if (undid) return;
      undid = true;
      writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, editing: null, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 1, r.text);
    assert.equal(r.said[r.said.length - 1], `Dropbox undid this Mac's claim on ${LABEL}. Say your answer again.`);
    assert.deepEqual([t.started, reread(found).kind], [[], null]);
    const again = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(again.code, 0, again.text);
    assert.equal(reread(found).kind, "finished");
    t.done();
  });
  it("refuses while a detached run is at work on the episode, and starts no run", async () => {
    const t = setup();
    const found = waiting(t);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" }));
    const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "kind", LABEL, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [1, [`read is running for ${LABEL} (${SHORT}) already. Say it again when it has finished.`]]);
    untouched(t, found);
    t.done();
  });
  it("lists the videos by their labels when none fits, and not by their files", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", "nothing fits this", "raw", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`No episode fits "nothing fits this". The episodes are: ${LABEL} (${SHORT}).`]]);
    t.done();
  });
});

describe("kind: a client or group session", () => {
  /** The day the made-up video was recorded, which a session's label is made from. */
  const dayOf = (t) => readEpisode(join(t.root, "Episodes", FOLDER)).record.video.recorded;
  it("writes the mark and the name in the same write as the answer, and says what to ask her; nothing is started", async () => {
    const t = setup();
    const found = waiting(t);
    const label = sessionLabel(dayOf(t));
    const r = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    assert.deepEqual([r.code, r.said], [0, [`${label}: marked a client or group session. ${SESSION_NEXT}`]]);
    const record = reread(found);
    assert.deepEqual(record.session, { marked: AFTER_CLAIM, on: "Mac Studio", teachings: null, cleared: null });
    assert.deepEqual(record.name, { text: label, placeholder: false });
    assert.deepEqual([record.kind, record.answer.state, record.answer.private], ["session", "answered", "yes"]);
    // The claim record had neither the kind, nor the mark, nor the name: all three came in the one write that answered, which is
    // the third record and the last. The video is let go in it too: no reading runs under a session's claim.
    const claim = JSON.parse(readFileSync(recordFile(found.folder, 2), "utf8"));
    assert.deepEqual([claim.kind, claim.session, claim.name.text], [null, undefined, "Pricing talk"]);
    assert.deepEqual(readdirSync(join(found.folder, "record")), ["0001.json", "0002.json", "0003.json"]);
    const answered = JSON.parse(readFileSync(recordFile(found.folder, 3), "utf8"));
    assert.deepEqual([answered.kind, answered.answer.state, answered.session, answered.name, answered.editing], ["session", "answered", record.session, record.name, null]);
    assert.deepEqual([t.started, t.opened], [[], []]);
    assert.deepEqual(t.waits, [CLAIM_WAIT_MS]);
    t.done();
  });
  it("is then a session to the gate and to the finder: found by its new name, and every command but its few refused", async () => {
    const t = setup();
    const found = waiting(t);
    const label = sessionLabel(dayOf(t));
    await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    const ctx = contextFor({ ...t.ctx.deps, say: () => {} });
    assert.equal(findEpisode(ctx, label).name, FOLDER);
    assert.equal(shownName(reread(found)), label);
    // Words of its file's name find nothing: it is a session.
    assert.ok(findEpisode(ctx, "Pricing").why);
    for (const [name, ...words] of [["ask", label], ["open", label], ["reels", label], ["finish", label]]) {
      const r = await on(t.ctx.deps, name, ...words);
      assert.equal(r.code, 1, name);
      assert.ok(!r.text.includes("Pricing"), `${name}: ${r.text}`);
    }
    assert.equal((await on(t.ctx.deps, "ask", label)).text, "This is a client or group session: that is not done for one.");
    // Nothing the chat is told afterwards holds its file's name, its folder's or the name it had.
    for (const argv of [["episodes"], ["status"], ["status", label]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.doesNotMatch(r.text, /Pricing/, argv.join(" "));
    }
    assert.ok((await on(t.ctx.deps, "episodes")).said.includes(`  ${label}: a client or group session, of 0:23, id ${SHORT}`));
    t.done();
  });
  it("numbers a second session of the same day, and leaves the first its own label", async () => {
    const t = setup();
    const first = waiting(t);
    const other = "Video of 14 Oct, 09:30 (Mac Studio)";
    const second = addEpisode(t, { created: "2026-10-14T09:30:00-05:00", over: { label: other } });
    const label = sessionLabel(dayOf(t));
    assert.equal(readEpisode(second.folder).record.video.recorded, dayOf(t));
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes")).code, 0);
    assert.equal((await on(t.ctx.deps, "kind", other, "session", "--private", "yes")).code, 0);
    assert.equal(reread(first).name.text, label);
    assert.equal(readEpisode(second.folder).record.name.text, `${label} (2)`);
    t.done();
  });
  it("starts nothing even when readings are on and the training gate is on: its reading starts with the teachings", async () => {
    const t = setup();
    waiting(t);
    const teachings = { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } };
    const r = await on(withSettings(t, { sessionTeachings: teachings, readings: true }), "kind", LABEL, "session", "--private", "yes");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("says the same of a session on a Mac whose readings are off: marked, and no reading to refuse", async () => {
    const t = setup();
    waiting(t);
    const r = await on(withSettings(t, { readings: false }), "kind", LABEL, "session", "--private", "yes");
    assert.match(r.text, /: marked a client or group session\. /);
    assert.doesNotMatch(r.text, /Readings are off/);
    t.done();
  });
  it("names it by its label in what it says, and not by its file", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    assert.doesNotMatch(r.text, /Pricing/);
    t.done();
  });
});

describe("kind: the reading", () => {
  it("starts one detached run named read, on the episode's folder, for a finished video, a clip and a raw video", async () => {
    for (const word of ["finished", "clip", "raw"]) {
      const t = setup();
      waiting(t);
      const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", "no");
      assert.equal(r.code, 0, `${word}: ${r.text}`);
      assert.deepEqual(t.started.map(([cmd, args]) => [cmd, args.slice(1)]), [[process.execPath, readArgs(word === "clip" ? "short video" : word, 3)]], word);
      assert.equal(t.started[0][1][0], "/checkout/tool/edit.js");
      t.done();
    }
  });
  it("waits in the foreground for its result, about once a second, and says what it found when it comes", async () => {
    const t = setup();
    waiting(t);
    let polls = 0;
    duringWaits(t, 1000, () => {
      polls += 1;
      if (polls === 5) leaveResult(t, { made: ["notes.txt", "reels.json"], next: 'Say "what did Claude find?"' });
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [`${LABEL}: read ended 0 minutes ago. Made: notes.txt, reels.json. Say "what did Claude find?"`]]);
    assert.deepEqual(t.waits, [CLAIM_WAIT_MS, 1000, 1000, 1000, 1000, 1000]);
    t.done();
  });
  it("does not wait at all when the result is there as soon as the run is started", async () => {
    const t = setup();
    waiting(t);
    const start = t.ctx.deps.start;
    t.ctx.deps.start = (cmd, args) => {
      start(cmd, args);
      leaveResult(t);
    };
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.waits, [CLAIM_WAIT_MS]);
    t.done();
  });
  it("says what the run could not do, as status does, with 1, when the reading failed", async () => {
    const t = setup();
    waiting(t);
    duringWaits(t, 1000, () => leaveResult(t, { ok: false, made: [], failed: ["Claude could not be asked"] }));
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${LABEL}: read ended 0 minutes ago. Not done: Claude could not be asked.`]]);
    t.done();
  });
  it("gives up when the wait for the claim and the wait for the reading together make a hundred seconds, and says a notice will come", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [STILL(LABEL)]]);
    assert.equal(t.waits[0], CLAIM_WAIT_MS);
    assert.equal(t.waits.slice(1).every((ms) => ms === 1000), true);
    assert.equal(t.waits.slice(1).reduce((sum, ms) => sum + ms, 0), 80000);
    assert.equal(t.waits.reduce((sum, ms) => sum + ms, 0), 100000);
    t.done();
  });
  it("waits ninety seconds for the reading when it made no wait for the claim: this Mac has the video open already", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false }, editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" } } });
    const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [0, [STILL(NAME)]]);
    assert.deepEqual([t.waits.length, t.waits.reduce((sum, ms) => sum + ms, 0)], [90, 90000]);
    t.done();
  });
  it("sees a result that comes at the very end of the time it waits", async () => {
    const t = setup();
    waiting(t);
    let polls = 0;
    duringWaits(t, 1000, () => {
      polls += 1;
      if (polls === 80) leaveResult(t);
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [`${LABEL}: read ended 0 minutes ago. Made: notes.txt.`]]);
    t.done();
  });
  it("does not take an older reading's result for this one's", async () => {
    const t = setup();
    waiting(t);
    leaveResult(t, { ended: t.now() - 60 * 60 * 1000, started: t.now() - 61 * 60 * 1000 });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [STILL(LABEL)]]);
    t.done();
  });
  it("records the answer and starts nothing when this Mac's settings say readings are off", async () => {
    for (const word of ["finished", "raw", "clip"]) {
      const t = setup();
      const found = waiting(t);
      const r = await on(withSettings(t, { readings: false }), "kind", LABEL, word, "--private", "no");
      assert.deepEqual([r.code, r.said], [0, [`${LABEL}: answered. ${READINGS_OFF}`]], word);
      assert.equal(reread(found).kind, word === "clip" ? "short video" : word);
      assert.equal(reread(found).answer.state, "answered");
      assert.deepEqual(t.started, []);
      // The wait for the claim is made, but there is no wait for a reading.
      assert.deepEqual(t.waits, [CLAIM_WAIT_MS]);
      t.done();
    }
  });
  it("says the same, by its name, of a video answered again on a Mac whose readings are off", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    const r = await on(withSettings(t, { readings: false }), "kind", NAME, "raw", "--private", "no", "--again");
    assert.deepEqual([r.code, r.said], [0, [`${NAME}: answered. ${READINGS_OFF}`]]);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("reads as today when readings are on, or the setting is not there", async () => {
    for (const over of [{}, { readings: true }]) {
      const t = setup();
      waiting(t);
      await on(withSettings(t, over), "kind", LABEL, "finished", "--private", "no");
      assert.equal(t.started.length, 1, JSON.stringify(over));
      t.done();
    }
  });
});

describe("kind: a raw reading waits for the import's late check", () => {
  /** A late check this Mac owes of the made-up episode, last copied `ago` milliseconds before the clock. */
  function owe(t, ago, over = {}) {
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: join(t.root, "Episodes", FOLDER), video: "Pricing talk.mp4", bytes: 1, seconds: 120, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - ago, root: t.root, machine: "Mac Studio", planTxt: "x.txt", ...over });
  }
  it("says when Claude reads it, starts the detached run, and does not wait for it, while this Mac's pending late check is due later", async () => {
    const t = setup();
    waiting(t);
    owe(t, 5 * 60 * 1000);
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    const due = clockAt(Date.parse(AT) - 5 * 60 * 1000 + LATE_CHECK_MS);
    assert.deepEqual([r.code, r.said], [0, [`Answered. Claude reads it at ${due}, when the import has checked its copies.`]]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [readArgs("raw", 3)]);
    assert.deepEqual(t.waits, [CLAIM_WAIT_MS]);
    t.done();
  });
  it("says the time of a check that is already due as the time now, since the import makes it within a minute", async () => {
    const t = setup();
    waiting(t);
    owe(t, 40 * 60 * 1000);
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual(r.said, [`Answered. Claude reads it at ${clockAt(t.now())}, when the import has checked its copies.`]);
    t.done();
  });
  it("says the latest time it can be, while an import of either Mac is still at work on the video", async () => {
    const t = setup();
    const found = waiting(t);
    const bytes = found.record.video.bytes;
    writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 7, import: "k3j9x", video: "Pricing talk.mp4", bytes, seconds: 120, step: "Waiting for its late check", at: AT, label: LABEL }, (to, text) => writeFileSync(to, text));
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual(r.said, [`Answered. Claude reads it at ${clockAt(Date.parse(AT) + CLAIM_WAIT_MS + LATE_CHECK_MS)}, when the import has checked its copies.`]);
    assert.equal(t.started.length, 1);
    assert.deepEqual(t.waits, [CLAIM_WAIT_MS]);
    t.done();
  });
  it("reads a finished video or a clip at once while the late check is still owed: they only add files", async () => {
    for (const word of ["finished", "clip"]) {
      const t = setup();
      waiting(t);
      owe(t, 5 * 60 * 1000);
      const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", "no");
      assert.deepEqual(r.said, [STILL(LABEL)], word);
      assert.equal(t.started.length, 1, word);
      t.done();
    }
  });
  it("reads a raw video at once, with the wait, when no late check holds it", async () => {
    const t = setup();
    waiting(t);
    owe(t, 5 * 60 * 1000, { id: "e-20261001-aaaaaa" });
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual(r.said, [STILL(LABEL)]);
    t.done();
  });
  it("says nothing of a late check that found a problem: its hold is not one that clears by itself", async () => {
    const t = setup();
    waiting(t);
    owe(t, 40 * 60 * 1000, { problem: "Pricing talk.srt is not whole in Dropbox." });
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual(r.said, [STILL(LABEL)]);
    t.done();
  });
});

describe("kind --version-of", () => {
  /** The made-up episode answered as a finished video with a spelling, and a new video beside it waiting. */
  function pair(t, over = {}) {
    const target = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false }, spellings: [["Sally", "Sallie"]], ...over } });
    const added = addEpisode(t);
    return { target, added };
  }
  const answer = (t, ...more) => on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", ...more);
  it("sets versionOf to the video's id, by id or short id, and carries the spellings she confirmed on it", async () => {
    for (const id of [ID, SHORT]) {
      const t = setup();
      const { added } = pair(t);
      const r = await answer(t, "--version-of", id);
      assert.equal(r.code, 0, `${id}: ${r.text}`);
      const record = readEpisode(added.folder).record;
      assert.deepEqual([record.versionOf, record.spellings], [ID, [["Sally", "Sallie"]]], id);
      t.done();
    }
  });
  it("keeps the new video's own spelling of a word the old one spelled another way", async () => {
    const t = setup();
    const { added } = pair(t);
    writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, spellings: [["Sally", "Sal"], ["Jon", "John"]] }));
    assert.equal((await answer(t, "--version-of", ID)).code, 0);
    assert.deepEqual(readEpisode(added.folder).record.spellings, [["Sally", "Sal"], ["Jon", "John"]]);
    t.done();
  });
  it("sets versionOf only when her answer says so: the import's guess is never taken", async () => {
    const t = setup();
    const { added } = pair(t);
    writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, answer: { ...ANSWER, match: ID } }));
    assert.equal((await answer(t)).code, 0);
    assert.deepEqual([readEpisode(added.folder).record.versionOf, readEpisode(added.folder).record.spellings], [null, []]);
    t.done();
  });
  it("refuses an id that names no answered, not archived video on this Mac, in plain words, and writes nothing", async () => {
    const t = setup();
    const { added } = pair(t);
    const unanswered = "e-20261019-dddddd";
    addEpisode(t, { folder: "2026-10-19 Another (Mac Studio)", id: unanswered, file: "Another.mov", over: { label: "Video of 19 Oct, 10:00 (Mac Studio)" } });
    const left = "e-20261018-eeeeee";
    addEpisode(t, { folder: "2026-10-18 Left (Mac Studio)", id: left, file: "Left.mov", over: { label: "Video of 18 Oct, 10:00 (Mac Studio)", answer: { ...ANSWER, state: "not for brimm-video" } } });
    for (const id of ["e-20261099-ffffff", "ffffff", unanswered, "dddddd", left, "eeeeee", "3fa9c"]) {
      const r = await answer(t, "--version-of", id);
      assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${id}.`]], id);
    }
    assert.deepEqual([readEpisode(added.folder).record.rev, t.started, t.waits], [1, [], []]);
    t.done();
  });
  it("refuses an archived video", async () => {
    const t = setup();
    const { added } = pair(t, { archived: { at: AT } });
    const r = await answer(t, "--version-of", ID);
    assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${ID}.`]]);
    assert.equal(readEpisode(added.folder).record.rev, 1);
    t.done();
  });
  it("takes the id from this Mac's records alone: the video itself is not one it can be a version of", async () => {
    const t = setup();
    const { added } = pair(t);
    const self = await answer(t, "--version-of", OTHER_ID);
    assert.deepEqual([self.code, self.said], [1, [`No answered video on this Mac has the id ${OTHER_ID}.`]]);
    assert.equal(readEpisode(added.folder).record.rev, 1);
    // An answered video answered again is not a version of itself either.
    const own = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again", "--version-of", SHORT);
    assert.deepEqual([own.code, own.said], [1, [`${NAME} cannot be a version of itself.`]]);
    t.done();
  });
  it("asks for the id when --version-of is given with none", async () => {
    const t = setup();
    const { added } = pair(t);
    for (const argv of [["--version-of", ""], ["--version-of"]]) {
      const r = await answer(t, ...argv);
      assert.deepEqual([r.code, r.said], [2, ["Say the id of the video this is a new version of."]], argv.join(" "));
    }
    assert.equal(readEpisode(added.folder).record.rev, 1);
    t.done();
  });
  it("refuses a session not cleared as the video this is a version of, unless this is a session too", async () => {
    const t = setup();
    const { added } = pair(t, { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-14", placeholder: false }, label: "Video of 14 Oct, 09:12 (Mac Studio)" });
    const refused = await answer(t, "--version-of", ID);
    assert.deepEqual([refused.code, refused.said], [1, ["That video is a client or group session, so this new version is one too: answer it as a session."]]);
    assert.equal(readEpisode(added.folder).record.rev, 1);
    const allowed = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--version-of", ID);
    assert.equal(allowed.code, 0, allowed.text);
    assert.equal(readEpisode(added.folder).record.versionOf, ID);
    t.done();
  });
  it("lets a session cleared by her click be the video this is a version of", async () => {
    const t = setup();
    const { added } = pair(t, { kind: "finished", session: { ...MARK, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } });
    const r = await answer(t, "--version-of", ID);
    assert.equal(r.code, 0, r.text);
    assert.equal(readEpisode(added.folder).record.versionOf, ID);
    t.done();
  });
  it("(b) gives a video answered for the first time no versionOf unless her answer names one: null", async () => {
    const t = setup();
    const { added } = pair(t);
    assert.equal((await answer(t)).code, 0);
    assert.equal(readEpisode(added.folder).record.versionOf, null);
    t.done();
  });
  it("(b, as changed in F9b) gives a video never handed off the versionOf her answer names: --again without it keeps the one it has, --version-of none clears it", async () => {
    const t = setup();
    const { added } = pair(t);
    writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, kind: "raw", answer: { ...ANSWERED, state: "answered" }, versionOf: ID }));
    const kept = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again");
    assert.equal(kept.code, 0, kept.text);
    assert.equal(readEpisode(added.folder).record.versionOf, ID);
    const cleared = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again", "--version-of", "none");
    assert.equal(cleared.code, 0, cleared.text);
    assert.equal(readEpisode(added.folder).record.versionOf, null);
    const named = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--again", "--version-of", ID);
    assert.equal(named.code, 0, named.text);
    assert.equal(readEpisode(added.folder).record.versionOf, ID);
    t.done();
  });
  describe("(c) a video already handed off", () => {
    const FINISHED = { revision: 1, at: AT, on: "Mac Studio" };
    /** The target and a new video answered as raw, handed off as a version of the target unless `versionOf` says otherwise. */
    function handedOff(t, { versionOf = ID, finished = FINISHED, files = {} } = {}) {
      const { added } = pair(t);
      writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, kind: "raw", answer: { ...ANSWERED, state: "answered" }, versionOf, finished }));
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(added.folder, path, ".."), { recursive: true });
        writeFileSync(join(added.folder, path), text);
      }
      return added;
    }
    const again = (t, ...more) => on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again", ...more);
    it("keeps its versionOf on --again, and its spellings", async () => {
      const t = setup();
      const added = handedOff(t);
      const r = await again(t);
      assert.equal(r.code, 0, r.text);
      assert.deepEqual([readEpisode(added.folder).record.versionOf, readEpisode(added.folder).record.kind], [ID, "finished"]);
      t.done();
    });
    it("accepts --version-of naming the same id", async () => {
      const t = setup();
      const added = handedOff(t);
      const r = await again(t, "--version-of", SHORT);
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(added.folder).record.versionOf, ID);
      t.done();
    });
    it("refuses --version-of naming another id, in words that say where it has gone, and writes nothing", async () => {
      const t = setup();
      const added = handedOff(t);
      const third = "e-20261011-bbbbbb";
      addEpisode(t, { folder: "2026-10-11 Older (Mac Studio)", id: third, file: "Older.mov", over: { kind: "finished", answer: ANSWERED, label: "Video of 11 Oct, 09:00 (Mac Studio)" } });
      const r = await again(t, "--version-of", third);
      assert.deepEqual([r.code, r.said], [1, [`Coaching call has already gone to the BRIMM Ops page as a version of ${NAME}: ask Jason.`]]);
      assert.deepEqual([readEpisode(added.folder).record.rev, readEpisode(added.folder).record.versionOf, t.started, t.waits], [2, ID, [], []]);
      t.done();
    });
    it("refuses any --version-of for a video handed off as one of its own, in the words for that", async () => {
      const t = setup();
      const added = handedOff(t, { versionOf: null });
      const r = await again(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [`Coaching call has already gone to the BRIMM Ops page as a video of its own: ask Jason.`]]);
      assert.equal(readEpisode(added.folder).record.rev, 2);
      t.done();
    });
    it("knows a video was handed off by a hand-off in its final/ or its history/, whatever its record says", async () => {
      for (const path of ["final/Talk.brimm-ops.json", "history/2026-10-20 15-00/Talk.brimm-ops.json"]) {
        const t = setup();
        const added = handedOff(t, { versionOf: null, finished: null, files: { [path]: "{}" } });
        const r = await again(t, "--version-of", ID);
        assert.equal(r.code, 1, path);
        assert.match(r.text, /has already gone to the BRIMM Ops page as a video of its own: ask Jason\.$/, path);
        assert.equal(readEpisode(added.folder).record.rev, 2);
        t.done();
      }
    });
    it("lets a video with no hand-off anywhere be given another id: it is not one handed off", async () => {
      const t = setup();
      const added = handedOff(t, { versionOf: null, finished: null, files: { "final/Talk.srt": "x", "history/Talk.mov": "x" } });
      const r = await again(t, "--version-of", ID);
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(added.folder).record.versionOf, ID);
      t.done();
    });
  });
});

describe("leave", () => {
  it("marks a video not for brimm-video, with who, where and when, says so, and asks nothing more", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on(t.ctx.deps, "leave", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`${LABEL}: left. It is not asked about again.`]]);
    const record = reread(found);
    assert.deepEqual(record.answer, { ...ANSWER, state: "not for brimm-video", by: "Mac Studio", on: "Mac Studio", at: NOW });
    assert.deepEqual([record.kind, record.rev, t.started, t.waits], [null, 2, [], []]);
    t.done();
  });
  it("lists it in `episodes` apart, and not among the videos waiting for an answer", async () => {
    const t = setup();
    waiting(t);
    addEpisode(t, { over: { label: "Video of 20 Oct, 15:30 (Mac Studio)" } });
    const before = (await on(t.ctx.deps, "episodes")).said;
    assert.ok(before.some((line) => line.includes("a video waiting for your answer")), before.join("\n"));
    await on(t.ctx.deps, "leave", LABEL);
    const after = (await on(t.ctx.deps, "episodes")).said;
    const heading = after.findIndex((line) => line.startsWith("Left alone, not for brimm-video"));
    assert.ok(heading > 0, after.join("\n"));
    assert.equal(after[heading + 1], `  ${LABEL}: a video of 0:23, id ${SHORT}`);
    assert.equal(after.filter((line) => line.includes(`${LABEL}:`) && line.includes("waiting for your answer")).length, 0, after.join("\n"));
    assert.equal(after.filter((line) => line.includes("a video waiting for your answer")).length, 1, after.join("\n"));
    t.done();
  });
  it("refuses an answered video, in plain words, and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "raw", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    const r = await on(t.ctx.deps, "leave", NAME);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} is answered already: leave is for a video still waiting for its answer.`]]);
    untouched(t, found);
    t.done();
  });
  it("refuses a session, which is answered", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-14", placeholder: false }, label: LABEL } });
    const r = await on(t.ctx.deps, "leave", "Session, 2026-10-14");
    assert.deepEqual([r.code, r.said], [1, ["Session, 2026-10-14 is answered already: leave is for a video still waiting for its answer."]]);
    untouched(t, found);
    t.done();
  });
  it("refuses while the other Mac is answering it", async () => {
    const t = setup();
    const found = waiting(t, { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
    const r = await on(t.ctx.deps, "leave", LABEL);
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} is being answered on Sallie's laptop. Nothing was changed.`]]);
    untouched(t, found);
    t.done();
  });
  it("says a video left already is, and writes nothing more", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    const r = await on(t.ctx.deps, "leave", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`${LABEL} is left already. It is not asked about again.`]]);
    untouched(t, found);
    t.done();
  });
  it("lets a left video be answered later by kind, without --again", async () => {
    const t = setup();
    const found = waiting(t);
    await on(t.ctx.deps, "leave", LABEL);
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([reread(found).kind, reread(found).answer.state], ["raw", "answered"]);
    t.done();
  });
  it("names the video by its label, and finds it by its label alone", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "leave", "Pricing talk");
    assert.equal(r.code, 1);
    assert.ok(!r.text.includes("Pricing talk."), r.text);
    t.done();
  });
});

describe("which", () => {
  it("opens the video in QuickTime Player on this Mac, and says so, and nothing else about it", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on(t.ctx.deps, "which", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`Opened ${LABEL} in QuickTime Player on this Mac.`]]);
    // A clone, named by its label, in BRIMM Video Work: QuickTime Player's title bar shows the name of the file it opens (final fix 13).
    assert.deepEqual(t.opened, [["QuickTime Player", join(episodeWork(t.home, FOLDER), "shown", `${LABEL.replace(/:/g, "-")}.mp4`)]]);
    untouched(t, found);
    t.done();
  });
  it("opens a video that is not whole on this Mac anyway, and says Dropbox brings it over first: it is online-only here", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on({ ...t.ctx.deps, isWhole: () => false }, "which", LABEL);
    assert.deepEqual([r.code, r.said], [0, [`Opened ${LABEL} in QuickTime Player on this Mac. Its copy could not be made, so it opened under its file's name, which QuickTime Player's title bar shows: share no screen while it is open. It is online-only on this Mac: Dropbox brings it over first, which may take a few minutes for a long video.`]]);
    assert.deepEqual([t.opened, t.started], [[["QuickTime Player", join(found.folder, "Pricing talk.mp4")]], []]);
    untouched(t, found);
    t.done();
  });
  it("opens the video of a session by its label, and of an answered video by its name", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-14", placeholder: false }, label: LABEL } });
    const r = await on(t.ctx.deps, "which", "Session, 2026-10-14");
    assert.deepEqual([r.code, r.said], [0, ["Opened Session, 2026-10-14 in QuickTime Player on this Mac."]]);
    const t2 = setup();
    const answered = episodeFor(t2, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    assert.deepEqual((await on(t2.ctx.deps, "which", NAME)).said, [`Opened ${NAME} in QuickTime Player on this Mac.`]);
    assert.deepEqual(t2.opened, [["QuickTime Player", join(episodeWork(t2.home, basename(answered.folder)), "shown", `${NAME.replace(/[:?]/g, "-")}.mp4`)]]);
    t.done();
    t2.done();
  });
  it("says why when QuickTime Player could not be opened, with the video named by its label", async () => {
    const t = setup();
    waiting(t);
    const r = await on({ ...t.ctx.deps, openApp: () => { throw new Error("QuickTime Player could not be opened (no such app)"); } }, "which", LABEL);
    assert.deepEqual([r.code, r.said], [1, [`${LABEL}: QuickTime Player could not be opened (no such app)`]]);
    t.done();
  });
  it("says nothing of the video's file or folder when QuickTime Player's own words name them", async () => {
    const t = setup();
    const found = waiting(t);
    const named = () => {
      throw new Error(`QuickTime Player could not be opened (The file ${join(found.folder, "Pricing talk.mp4")} does not exist.)`);
    };
    const r = await on({ ...t.ctx.deps, openApp: named }, "which", LABEL);
    assert.equal(r.code, 1);
    assert.doesNotMatch(r.text, /Pricing/);
    assert.match(r.text, new RegExp(`^${LABEL.replace(/[()]/g, "\\$&")}: QuickTime Player could not be opened`));
    t.done();
  });
  it("finds a video by its label alone, never by words of its file", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "which", "Pricing");
    assert.equal(r.code, 1);
    assert.deepEqual(t.opened, []);
    t.done();
  });
});

describe("a video left alone, in the gate's own words", () => {
  const LEFT = LEFT_WORDS;
  it("is refused by ask and by open in words that do not say it is waiting for its answer", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    for (const name of ["ask", "open", "reels", "push", "finish", "name"]) {
      const words = name === "name" ? [LABEL, "A name"] : [LABEL];
      const r = await on(t.ctx.deps, name, ...words);
      assert.deepEqual([r.code, r.said], [1, [LEFT]], name);
    }
    untouched(t, found);
    t.done();
  });
  it("still lets which, show, leave and kind run for it, and they do what they do", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    const which = await on(t.ctx.deps, "which", LABEL);
    assert.deepEqual([which.code, which.said, t.opened.length], [0, [`Opened ${LABEL} in QuickTime Player on this Mac.`], 1]);
    // show prints nothing of it: it opens a read-only copy on this Mac (F9b), here of none, since it has no cut log.
    const show = await on(t.ctx.deps, "show", LABEL, "plan");
    assert.deepEqual([show.code, show.said], [1, [`${LABEL} has no cut plan yet.`]]);
    const leave = await on(t.ctx.deps, "leave", LABEL);
    assert.deepEqual([leave.code, leave.said], [0, [`${LABEL} is left already. It is not asked about again.`]]);
    assert.equal(reread(found).rev, 1);
    const kind = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(kind.code, 0, kind.text);
    assert.deepEqual([reread(found).kind, reread(found).answer.state], ["finished", "answered"]);
    t.done();
  });
  it("has askBlocked and show's words say so too, not that it waits for its answer", () => {
    const left = { kind: null, answer: { state: "not for brimm-video" }, label: LABEL };
    const asked = (record) => askBlocked({ folder: "/none", record, root: "/none", home: "/none", machine: "Mac Studio" });
    assert.deepEqual(asked(left), { why: LEFT_WORDS });
    assert.deepEqual(asked({ ...left, answer: { state: "needs your answer" } }), { why: "This video is waiting for its answer: say what it is first." });
  });
  it("says a video waiting for its answer is waiting, as before", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "ask", LABEL);
    assert.deepEqual(r.said, ["This video is waiting for its answer: say what it is first."]);
    t.done();
  });
  it("leaves a detached run's result in the same words", async () => {
    const t = setup();
    waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    const r = await on(t.ctx.deps, "ask", "--now", FOLDER);
    assert.deepEqual([r.code, r.said], [1, [LEFT]]);
    const result = JSON.parse(readFileSync(resultFile(t.home, FOLDER, "ask"), "utf8"));
    assert.deepEqual(result.failed, [LEFT]);
    assert.ok(existsSync(resultFile(t.home, FOLDER, "ask")));
    t.done();
  });
});

describe("kind and leave: one answer at a time on a Mac (fix round 1, 1)", () => {
  /** A `kind` for the same video started on this Mac inside the first one's wait for the claim: its { code, said }. */
  async function nested(t, first, second) {
    let inner = null;
    let fired = false;
    duringWaits(t, CLAIM_WAIT_MS, async () => {
      if (fired) return;
      fired = true;
      inner = await on(t.ctx.deps, "kind", LABEL, ...second);
    });
    const outer = await on(t.ctx.deps, "kind", LABEL, ...first);
    return { outer, inner };
  }
  const BUSY = `Another answer for ${LABEL} is being written on this Mac: say it again in a moment.`;
  it("refuses a second answer started while the first waits for its claim: finished, then a session, writes the first alone and starts one reading", async () => {
    const t = setup();
    const found = waiting(t);
    const { outer, inner } = await nested(t, ["finished", "--private", "no"], ["session", "--private", "yes"]);
    assert.deepEqual([inner.code, inner.said], [1, [BUSY]]);
    assert.equal(outer.code, 0, outer.text);
    const record = reread(found);
    assert.deepEqual([record.kind, record.session, record.rev], ["finished", undefined, 3]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [readArgs("finished", 3)]);
    t.done();
  });
  it("refuses a second answer started while a session is being marked: the session is marked and nothing is read", async () => {
    const t = setup();
    const found = waiting(t);
    const { outer, inner } = await nested(t, ["session", "--private", "yes"], ["finished", "--private", "no"]);
    assert.deepEqual([inner.code, inner.said], [1, [BUSY]]);
    assert.equal(outer.code, 0, outer.text);
    assert.deepEqual([reread(found).kind, reread(found).session.cleared, t.started], ["session", null, []]);
    t.done();
  });
  it("refuses the same answer twice, and starts one reading", async () => {
    const t = setup();
    const found = waiting(t);
    const { outer, inner } = await nested(t, ["raw", "--private", "no"], ["raw", "--private", "no"]);
    assert.deepEqual([inner.code, inner.said], [1, [BUSY]]);
    assert.equal(outer.code, 0, outer.text);
    assert.deepEqual([reread(found).rev, t.started.length], [3, 1]);
    t.done();
  });
  it("refuses a leave started inside an answer's wait, and an answer started inside a leave's", async () => {
    const t = setup();
    const found = waiting(t);
    let inner = null;
    duringWaits(t, CLAIM_WAIT_MS, async () => {
      inner = await on(t.ctx.deps, "leave", LABEL);
    });
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no")).code, 0);
    assert.deepEqual([inner.code, inner.said], [1, [BUSY]]);
    assert.equal(reread(found).kind, "raw");
    // A leave takes the lock for the whole of its run, however short: an answer started as it writes is refused.
    const t2 = setup();
    const found2 = waiting(t2);
    const clone = t2.ctx.deps.clone;
    let started = null;
    t2.ctx.deps.clone = (from, to) => {
      if (!started) started = on(t2.ctx.deps, "kind", LABEL, "finished", "--private", "no");
      clone(from, to);
    };
    assert.equal((await on(t2.ctx.deps, "leave", LABEL)).code, 0);
    const during = await started;
    assert.deepEqual([during.code, during.said], [1, [BUSY]]);
    assert.deepEqual([reread(found2).kind, reread(found2).answer.state], [null, "not for brimm-video"]);
    assert.ok(!existsSync(answerLock(t2)));
    t.done();
    t2.done();
  });
  it("lets go of its lock when it ends, however it ends", async () => {
    const t = setup();
    waiting(t);
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no")).code, 0);
    assert.ok(!existsSync(answerLock(t)), "after an answer");
    // Answered already: refused after the lock was taken.
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no")).code, 1);
    assert.ok(!existsSync(answerLock(t)), "after a refusal");
    t.done();
  });
  it("takes over a lock left by a run that is gone", async () => {
    const t = setup();
    const found = waiting(t);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(answerLock(t), JSON.stringify({ pid: 4242, command: "kind", nonce: "left behind" }));
    const r = await on({ ...t.ctx.deps, alive: aliveIs() }, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "finished");
    assert.ok(!existsSync(answerLock(t)));
    t.done();
  });
  it("refuses while another process that is running holds it, and changes and starts nothing", async () => {
    const t = setup();
    const found = waiting(t);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(answerLock(t), JSON.stringify({ pid: 4242, command: "kind", nonce: "alive" }));
    for (const argv of [["kind", LABEL, "finished", "--private", "no"], ["leave", LABEL]]) {
      const r = await on({ ...t.ctx.deps, alive: aliveIs(4242) }, ...argv);
      assert.deepEqual([r.code, r.said], [1, [BUSY]], argv[0]);
    }
    untouched(t, found);
    assert.ok(existsSync(answerLock(t)), "the other run's lock stays");
    t.done();
  });
  it("refuses when the record read again after the wait is not the claim it wrote: it changed meanwhile", async () => {
    const t = setup();
    const found = waiting(t);
    // The record after the claim is written on by a change that keeps the claim: it is no longer the one written.
    duringWaits(t, CLAIM_WAIT_MS, () => {
      const mine = reread(found);
      writeFileSync(recordFile(found.folder, mine.rev + 1), recordText({ ...mine, rev: mine.rev + 1, answer: { ...mine.answer, state: "not for brimm-video" }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    });
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} changed meanwhile: say your answer again.`]]);
    assert.deepEqual([reread(found).kind, reread(found).answer.state, reread(found).rev, t.started], [null, "not for brimm-video", 3, []]);
    t.done();
  });
  it("looks again just before it writes: a run that came to work on the episode in the wait stops the answer", async () => {
    const t = setup();
    const found = waiting(t);
    duringWaits(t, CLAIM_WAIT_MS, () => {
      mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
      writeFileSync(lockOf(t.home, FOLDER), JSON.stringify({ pid: 4242, command: "bring" }));
    });
    const r = await on({ ...t.ctx.deps, alive: aliveIs(4242) }, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`bring is running for ${LABEL} (${SHORT}) already. Say it again when it has finished.`]]);
    assert.deepEqual([reread(found).kind, reread(found).rev, t.started], [null, 2, []]);
    t.done();
  });
  it("looks again just before it starts the reading: a record written on its answer stops the run", async () => {
    const t = setup();
    const found = waiting(t);
    // Dropbox brings the other Mac's next record the moment this Mac's answer is in place.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("0003.json")) writeFileSync(recordFile(found.folder, 4), recordText({ ...JSON.parse(readFileSync(to, "utf8")), rev: 4, kind: "raw", writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    };
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [`${LABEL} changed meanwhile: say your answer again.`]]);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("starts the reading with the kind and the rev of the answer's record, so that its run can refuse a record that no longer says them", async () => {
    const t = setup();
    const found = waiting(t);
    await on(t.ctx.deps, "kind", LABEL, "clip", "--private", "no");
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER, "--kind", "short video", "--rev", "3"]]);
    assert.equal(reread(found).rev, 3);
    t.done();
  });
});

describe("kind: a session lets the video go (fix round 1, 2)", () => {
  it("leaves the video with nobody editing it, so that the other Mac's name and release are not refused for the claim", async () => {
    const t = setup();
    const found = waiting(t);
    const laptop = otherMac(t);
    const marked = await on(laptop.deps, "kind", LABEL, "session", "--private", "yes");
    assert.equal(marked.code, 0, marked.text);
    const label = reread(found).name.text;
    assert.equal(reread(found).editing, null);
    const released = await on(t.ctx.deps, "release", label);
    assert.deepEqual(released.said, [`This Mac does not have ${label} open, so there is nothing to hand over.`]);
    const named = await on(t.ctx.deps, "name", label, "A name of her own");
    assert.equal(named.code, 0, named.text);
    t.done();
  });
  it("keeps the claim on every other kind, as before: the reading runs under it", async () => {
    const t = setup();
    const found = waiting(t);
    await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
});

describe("kind: the version it is of, and how it came (fix round 1, 4 to 6)", () => {
  const SESSION_OF = { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-14", placeholder: false }, label: "Video of 14 Oct, 09:12 (Mac Studio)" };
  it("refuses a kept versionOf, of a video handed off, that names a video since marked a session, unless this is a session too", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    const added = addEpisode(t);
    writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, kind: "raw", answer: { ...ANSWERED }, versionOf: ID, finished: { revision: 1, at: AT, on: "Mac Studio" } }));
    // The older video is marked a session afterwards.
    const older = readEpisode(join(t.root, "Episodes", FOLDER)).record;
    writeFileSync(recordFile(join(t.root, "Episodes", FOLDER), 2), recordText({ ...older, rev: 2, ...SESSION_OF }));
    // It is held as a session from then on (final fix 1): named and found by its label, and answered only as one.
    const refused = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--again");
    assert.deepEqual([refused.code, refused.said], [1, [`${LABEL} is a version of a client or group session: answer it as a session too, or ask Jason. Nothing was written.`]]);
    assert.deepEqual([readEpisode(added.folder).record.rev, t.started, t.waits], [2, [], []]);
    const allowed = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--again");
    assert.equal(allowed.code, 0, allowed.text);
    assert.equal(readEpisode(added.folder).record.versionOf, ID);
    t.done();
  });
  it("refuses a short id that two answered videos have, and takes the whole id of either", async () => {
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
    const other = "e-20261012-3fa9c1";
    addEpisode(t, { folder: "2026-10-12 Elsewhere (Mac Studio)", id: other, file: "Elsewhere.mov", over: { kind: "raw", answer: ANSWERED, label: "Video of 12 Oct, 09:00 (Mac Studio)" } });
    // An unanswered video with the same short id does not make it ambiguous.
    addEpisode(t, { folder: "2026-10-11 Third (Mac Studio)", id: "e-20261011-3fa9c1", file: "Third.mov", over: { label: "Video of 11 Oct, 09:00 (Mac Studio)" } });
    const added = addEpisode(t);
    const ambiguous = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--version-of", "3fa9c1");
    assert.deepEqual([ambiguous.code, ambiguous.said], [1, ["More than one video on this Mac has the short id 3fa9c1: say its whole id."]]);
    assert.deepEqual([readEpisode(added.folder).record.rev, t.waits], [1, []]);
    for (const id of [ID, other]) {
      const t2 = setup();
      episodeFor(t2, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false } } });
      addEpisode(t2, { folder: "2026-10-12 Elsewhere (Mac Studio)", id: other, file: "Elsewhere.mov", over: { kind: "raw", answer: ANSWERED, label: "Video of 12 Oct, 09:00 (Mac Studio)" } });
      const there = addEpisode(t2);
      assert.equal((await on(t2.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--version-of", id)).code, 0, id);
      assert.equal(readEpisode(there.folder).record.versionOf, id);
      t2.done();
    }
    t.done();
  });
  it("asks whether it is a session of a pre-switch record whose video has a Zoom download's name, answered again as anything else", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { video: { file: "GMT20261013-142933_Recording_1280x720.mp4", bytes: 1, seconds: 23, recorded: "2026-10-14", recordedFrom: "video" }, files: {}, name: { text: "Coaching", placeholder: false } } });
    for (const word of ["raw", "finished", "clip"]) {
      const r = await on(t.ctx.deps, "kind", "Coaching", word, "--private", "no", "--again");
      assert.deepEqual([r.code, r.said], [1, [ZOOM, `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: "Coaching", came: null }))}`]], word);
    }
    untouched(t, found);
    const given = await on(t.ctx.deps, "kind", "Coaching", "raw", "--private", "no", "--again", "--not-a-session");
    assert.equal(given.code, 0, given.text);
    t.done();
  });
  it("asks whether it is a session when the import could not read how the video came (came null), until she has answered", async () => {
    const t = setup();
    const found = waiting(t, { answer: { ...ANSWER, came: null, guess: null, seen: "" } });
    const r = await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no");
    assert.deepEqual([r.code, r.said], [1, [ZOOM, `    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: LABEL, came: null }))}`]]);
    untouched(t, found);
    assert.equal((await on(t.ctx.deps, "kind", LABEL, "raw", "--private", "no", "--not-a-session")).code, 0);
    // Answered, it is not asked again: she was asked.
    const again = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again");
    assert.equal(again.code, 0, again.text);
    assert.equal(reread(found).kind, "finished");
    t.done();
  });
  it("does not ask of a pre-switch record with an ordinary name, answered again twice", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { name: { text: NAME, placeholder: false } } });
    assert.equal((await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again")).code, 0);
    assert.equal((await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again")).code, 0);
    assert.equal(reread(found).kind, "raw");
    t.done();
  });
});

describe("kind: as open does it, and the time it takes (fix round 1, 7 and 10)", () => {
  it("warns, as open does, that the other Mac will not see the claim when this Mac seems to be offline, and still claims", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on({ ...t.ctx.deps, online: async () => false }, "kind", LABEL, "finished", "--private", "no");
    assert.equal(r.said[0], "This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).kind, "finished");
    t.done();
  });
  it("says nothing of being offline when it is online, or when it made no claim", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.ok(!r.text.includes("offline"), r.text);
    t.done();
  });
  it("lets the names of a video go once it is answered as anything but a session, so that the result line reads as status would", async () => {
    const t = setup();
    waiting(t);
    duringWaits(t, 1000, () => leaveResult(t, { made: ["Pricing talk.edit-notes.txt"] }));
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [`${LABEL}: read ended 0 minutes ago. Made: Pricing talk.edit-notes.txt.`]]);
    t.done();
  });
  it("keeps them from a session's lines", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes");
    assert.doesNotMatch(r.text, /Pricing/);
    t.done();
  });
});

// --- F3b: the chain rules for --version-of and --again, once hand-offs exist ---

describe("kind --version-of, and the links around it (F3b)", () => {
  const SESSION_FIELDS = { kind: "session", answer: { ...ANSWERED, private: "yes" }, session: MARK, name: { text: "Session, 2026-10-14", placeholder: false } };
  const FINISHED = { revision: 1, at: AT, on: "Mac Studio" };
  const HANDED = "e-20261018-c3c3c3";
  const ELSEWHERE = "e-20261011-bbbbbb";
  const ANOTHER = "e-20261012-d4d4d4";
  /** The made-up episode (ID, NAME), answered as a finished video, with `over` laid on its record. */
  const first = (t, over = {}) => episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, name: { text: NAME, placeholder: false }, ...over } });
  /** Another answered video on this Mac, in a folder of its own, with a label of its own unless `over` gives one. */
  const answeredVideo = (t, { id, folder, file, over = {} }) => addEpisode(t, { id, folder, file, over: { kind: "finished", answer: ANSWERED, label: `Video of ${id}`, ...over } });
  /** The words of rule (a). */
  const LOOP = (label, name) => `${label} cannot be a version of ${name}: ${name} is already a version of it.`;
  /** The words of rule (d): the video that was handed off, the later one, is named first; the video being answered is what it is a
      version of. */
  const GONE = (handed, name) => `${handed} has already gone to the BRIMM Ops page as a version of ${name}: ask Jason.`;
  /** The words of rule (e). */
  const SESSION_SET = (label) => `${label} would be a version of a client or group session: answer it as a session, or ask Jason. Nothing was written.`;
  /** The words for a video held as a session already, one of whose versions is a session not cleared (final fix 1): found by its
      label or short id, named by its label, or with none as "a video (<short id>)". */
  const HELD_AS = (name) => `${name} is a version of a client or group session: answer it as a session too, or ask Jason. Nothing was written.`;
  const MINE = `a video (${ID.slice(-6)})`;
  /** Nothing was written, no claim was made, and nothing was started: the record `found` as it was. */
  const writesNothing = (t, found, rev = 1) => assert.deepEqual([readEpisode(found.folder).record.rev, t.started, t.waits], [rev, [], []]);
  /** Write the next record of the episode in `found`: the one there with `over` laid on it. */
  const rewrite = (found, over) => {
    const { record } = readEpisode(found.folder);
    writeFileSync(recordFile(found.folder, record.rev + 1), recordText({ ...record, ...over, rev: record.rev + 1 }));
  };
  const answer = (t, ...more) => on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", ...more);

  describe("(a) a video cannot be a version of one that is already a version of it", () => {
    it("refuses a target whose chain holds the video, directly, by id or short id, and writes nothing, not even a claim", async () => {
      for (const named of [ID, SHORT]) {
        const t = setup();
        first(t, { versionOf: OTHER_ID });
        const added = addEpisode(t);
        const r = await answer(t, "--version-of", named);
        assert.deepEqual([r.code, r.said], [1, [LOOP(LABEL, NAME)]], named);
        writesNothing(t, added);
        t.done();
      }
    });
    it("refuses it through other versions: a target that is a version of a version of the video", async () => {
      const t = setup();
      first(t, { versionOf: ELSEWHERE });
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: OTHER_ID } });
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [LOOP(LABEL, NAME)]]);
      writesNothing(t, added);
      t.done();
    });
    it("refuses it for an answered video answered again, in the words that name it by its name", async () => {
      const t = setup();
      first(t, { versionOf: OTHER_ID });
      const added = addEpisode(t, { over: { kind: "raw", answer: ANSWERED } });
      const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again", "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [LOOP("Coaching call", NAME)]]);
      writesNothing(t, added);
      t.done();
    });
    it("says a video is not a version of itself in the words it has always had, not in these", async () => {
      const t = setup();
      first(t);
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", OTHER_ID);
      assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${OTHER_ID}.`]]);
      const own = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again", "--version-of", SHORT);
      assert.deepEqual([own.code, own.said], [1, [`${NAME} cannot be a version of itself.`]]);
      writesNothing(t, added);
      t.done();
    });
    it("lets a target through whose chain does not hold the video, however long it is", async () => {
      const t = setup();
      first(t, { versionOf: ELSEWHERE });
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ANOTHER } });
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(added.folder).record.versionOf, ID);
      t.done();
    });
    it("checks again on the record read after the claim wait: a target linked to the video meanwhile stops the answer", async () => {
      const t = setup();
      const target = first(t);
      const added = addEpisode(t);
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(target, { versionOf: OTHER_ID }));
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [LOOP(LABEL, NAME)]]);
      const record = readEpisode(added.folder).record;
      assert.deepEqual([record.rev, record.kind, record.versionOf ?? null, t.started], [2, null, null, []], "only the claim was written");
      t.done();
    });
  });

  describe("(d) a video a handed-off video's chain passes through keeps the version it is of", () => {
    /** The old video (ID), the video answered (R, OTHER_ID) as a version of it, and a later version of R (H) that was handed
        off: by its record unless `by` says where its hand-off is. */
    function chain(t, { by = null, rOver = {}, hOver = {} } = {}) {
      const old = first(t);
      const r = addEpisode(t, { over: { kind: "finished", answer: ANSWERED, versionOf: ID, ...rOver } });
      const h = answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { versionOf: OTHER_ID, ...(by ? {} : { finished: FINISHED }), ...hOver } });
      if (by) {
        mkdirSync(join(h.folder, by, ".."), { recursive: true });
        writeFileSync(join(h.folder, by), "{}");
      }
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov" });
      return { old, r, h };
    }
    const again = (t, ...more) => on(t.ctx.deps, "kind", OTHER_ID, "finished", "--private", "no", "--again", ...more);
    it("refuses --version-of naming another video, with the handed-off video named, and writes nothing, not even a claim", async () => {
      const t = setup();
      const { r } = chain(t);
      const refused = await again(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", "Coaching call")]]);
      writesNothing(t, r);
      assert.equal(readEpisode(r.folder).record.versionOf, ID);
      t.done();
    });
    it("refuses --version-of none, which clears the version it is of (--again alone keeps it, F9b)", async () => {
      const t = setup();
      const { r } = chain(t);
      const refused = await again(t, "--version-of", "none");
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", "Coaching call")]]);
      writesNothing(t, r);
      t.done();
    });
    it("refuses it when the hand-off is a file in the later version's final/ or its history/, whatever its record says", async () => {
      for (const by of ["final/Talk.brimm-ops.json", "history/2026-10-20 15-00/final/Talk.brimm-ops.json"]) {
        const t = setup();
        const { r } = chain(t, { by });
        const refused = await again(t, "--version-of", ELSEWHERE);
        assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", "Coaching call")]], by);
        writesNothing(t, r);
        t.done();
      }
    });
    it("refuses it for a handed-off video further along the chain, and for one that is not the nearest", async () => {
      const t = setup();
      const { r } = chain(t, { hOver: { finished: null } });
      // A later version of the later version was the one handed off.
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-19 Fourth cut (Mac Studio)", file: "Fourth cut.mov", over: { versionOf: HANDED, finished: FINISHED } });
      const refused = await again(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Fourth cut", "Coaching call")]]);
      writesNothing(t, r);
      t.done();
    });
    it("names the first of the handed-off videos, by their folders' names, when more than one chain passes through it", async () => {
      const t = setup();
      const { r } = chain(t);
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-09 Second cut (Mac Studio)", file: "Second cut.mov", over: { versionOf: OTHER_ID, finished: FINISHED } });
      const refused = await again(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Second cut", "Coaching call")]]);
      writesNothing(t, r);
      t.done();
    });
    it("refuses it for a video not yet answered that a handed-off video's chain ends at, answered with a version", async () => {
      const t = setup();
      first(t);
      const r = addEpisode(t);
      answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { versionOf: OTHER_ID, finished: FINISHED } });
      const refused = await answer(t, "--version-of", ID);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", LABEL)]]);
      writesNothing(t, r);
      t.done();
    });
    it("lets the same version be named again, and --again that changes only the answer, as nothing is re-linked", async () => {
      const t = setup();
      const { r } = chain(t);
      const same = await again(t, "--version-of", ID);
      assert.equal(same.code, 0, same.text);
      assert.deepEqual([readEpisode(r.folder).record.versionOf, readEpisode(r.folder).record.kind], [ID, "finished"]);
      const u = setup();
      const none = chain(u, { rOver: { versionOf: null } });
      const kept = await on(u.ctx.deps, "kind", OTHER_ID, "raw", "--private", "no", "--again");
      assert.equal(kept.code, 0, kept.text);
      assert.deepEqual([readEpisode(none.r.folder).record.versionOf, readEpisode(none.r.folder).record.kind], [null, "raw"]);
      t.done();
      u.done();
    });
    it("lets a video be re-linked that no handed-off video's chain passes through", async () => {
      // A later version that was not handed off.
      const t = setup();
      const { r } = chain(t, { hOver: { finished: null } });
      assert.equal((await again(t, "--version-of", ELSEWHERE)).code, 0);
      assert.equal(readEpisode(r.folder).record.versionOf, ELSEWHERE);
      t.done();
      // A handed-off video whose chain goes elsewhere.
      const u = setup();
      const apart = chain(u, { hOver: { versionOf: ELSEWHERE } });
      assert.equal((await again(u, "--version-of", ELSEWHERE)).code, 0);
      assert.equal(readEpisode(apart.r.folder).record.versionOf, ELSEWHERE);
      u.done();
    });
    it("leaves F3's words for a video handed off itself, even when a handed-off video's chain passes through it too", async () => {
      const t = setup();
      const { r } = chain(t, { rOver: { finished: FINISHED } });
      const refused = await again(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [`Coaching call has already gone to the BRIMM Ops page as a version of ${NAME}: ask Jason.`]]);
      writesNothing(t, r);
      t.done();
    });
    it("checks again on the record read after the claim wait: a version handed off meanwhile stops the answer", async () => {
      const t = setup();
      const { r, h } = chain(t, { hOver: { finished: null } });
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(h, { finished: FINISHED }));
      const refused = await again(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", "Coaching call")]]);
      const record = readEpisode(r.folder).record;
      assert.deepEqual([record.rev, record.versionOf, t.started], [2, ID, []], "only the claim was written");
      t.done();
    });
  });

  describe("(e) a non-session answer cannot make a video a version of a video whose versions hold a session", () => {
    /** Another version of the made-up video (ID) that is a session not cleared, as `over` lays it on a record. */
    const sessionOf = (t, over, id = ELSEWHERE) => answeredVideo(t, { id, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { label: "Video of 11 Oct, 09:00 (Mac Studio)", ...SESSION_FIELDS, ...over } });
    it("refuses a target one of whose later versions is a session not cleared, and writes nothing, not even a claim", async () => {
      const t = setup();
      first(t);
      sessionOf(t, { versionOf: ID });
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [SESSION_SET(LABEL)]]);
      writesNothing(t, added);
      t.done();
    });
    it("refuses one of whose earlier versions is, and one beside it that is a version of the same video", async () => {
      const earlier = setup();
      first(earlier, { versionOf: ELSEWHERE });
      sessionOf(earlier, {});
      const a = addEpisode(earlier);
      assert.deepEqual((await answer(earlier, "--version-of", ID)).said, [SESSION_SET(LABEL)]);
      writesNothing(earlier, a);
      earlier.done();
      const beside = setup();
      first(beside, { versionOf: ANOTHER });
      answeredVideo(beside, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      sessionOf(beside, { versionOf: ANOTHER });
      const b = addEpisode(beside);
      assert.deepEqual((await answer(beside, "--version-of", ID)).said, [SESSION_SET(LABEL)]);
      writesNothing(beside, b);
      beside.done();
    });
    it("takes a session by its kind alone, and by its mark alone, of any other kind", async () => {
      const marks = [["its kind, no mark", { session: undefined }], ["its mark, kind finished", { kind: "finished" }], ["its mark, kind raw", { kind: "raw" }], ["its mark, kind short video", { kind: "short video" }]];
      for (const [what, over] of marks) {
        const t = setup();
        first(t);
        sessionOf(t, { versionOf: ID, ...over });
        const added = addEpisode(t);
        const r = await answer(t, "--version-of", ID);
        assert.deepEqual([r.code, r.said], [1, [SESSION_SET(LABEL)]], what);
        writesNothing(t, added);
        t.done();
      }
    });
    it("names the video being answered by its label, and says no word of its file, which is a client's", async () => {
      const t = setup();
      first(t);
      sessionOf(t, { versionOf: ID });
      // The video is itself a client's: it is named by its label, and no word of its file is said.
      const added = addEpisode(t, { file: "Coaching call Jane Doe.mov", folder: "2026-10-20 Coaching call Jane Doe (Mac Studio)" });
      const r = await answer(t, "--version-of", SHORT);
      assert.deepEqual([r.code, r.said], [1, [SESSION_SET(LABEL)]]);
      assert.doesNotMatch(r.text, /Jane|Coaching/);
      writesNothing(t, added);
      t.done();
    });
    it("lets a session cleared by her click be in the set, a session answer be one, and a version of a set with none", async () => {
      const cleared = setup();
      first(cleared);
      sessionOf(cleared, { versionOf: ID, session: { ...MARK, cleared: { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" } } });
      const a = addEpisode(cleared);
      assert.equal((await answer(cleared, "--version-of", ID)).code, 0);
      assert.equal(readEpisode(a.folder).record.versionOf, ID);
      cleared.done();
      const asSession = setup();
      first(asSession);
      sessionOf(asSession, { versionOf: ID });
      const b = addEpisode(asSession);
      const r = await on(asSession.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--version-of", ID);
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(b.folder).record.versionOf, ID);
      asSession.done();
      const none = setup();
      first(none);
      answeredVideo(none, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ID } });
      addEpisode(none);
      assert.equal((await answer(none, "--version-of", ID)).code, 0);
      none.done();
    });
    it("does not take a video not yet answered, at the head of the set, for a session", async () => {
      const t = setup();
      first(t, { versionOf: ELSEWHERE });
      addEpisode(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { label: "Video of 11 Oct, 09:00 (Mac Studio)" } });
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(added.folder).record.versionOf, ID);
      t.done();
    });
    it("leaves F3's words for a target that is itself a session", async () => {
      const t = setup();
      first(t, SESSION_FIELDS);
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, ["That video is a client or group session, so this new version is one too: answer it as a session."]]);
      writesNothing(t, added);
      t.done();
    });
    it("checks again on the record read after the claim wait: a version marked a session meanwhile stops the answer", async () => {
      const t = setup();
      first(t);
      const other = answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ID } });
      const added = addEpisode(t);
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(other, SESSION_FIELDS));
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [SESSION_SET(LABEL)]]);
      const record = readEpisode(added.folder).record;
      assert.deepEqual([record.rev, record.kind, record.versionOf ?? null, t.started], [2, null, null, []], "only the claim was written");
      t.done();
    });
  });

  describe("(e) from the other end: a session that is a later version of the video answered", () => {
    it("refuses a non-session --again --version-of that would bring a session into the target's set through the video's own later versions", async () => {
      const t = setup();
      const mine = first(t, { kind: "raw" });
      // S is a session, a new version of the video (allowed: a session may be a version of anything).
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { ...SESSION_FIELDS, label: "Video of 11 Oct", versionOf: ID } });
      const other = answeredVideo(t, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      const r = await on(t.ctx.deps, "kind", ID.slice(-6), "finished", "--private", "no", "--again", "--version-of", ANOTHER);
      assert.deepEqual([r.code, r.said], [1, [HELD_AS(MINE)]]);
      writesNothing(t, mine);
      assert.equal(readEpisode(mine.folder).record.versionOf ?? null, null);
      assert.equal(readEpisode(other.folder).record.rev, 1);
      t.done();
    });
    it("reaches a session further down the video's own later versions, and lets a session answer, and a video with none, through", async () => {
      const t = setup();
      first(t, { kind: "raw" });
      answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { versionOf: ID } });
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { ...SESSION_FIELDS, label: "Video of 11 Oct", versionOf: HANDED } });
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      const refused = await on(t.ctx.deps, "kind", ID.slice(-6), "finished", "--private", "no", "--again", "--version-of", ANOTHER);
      assert.deepEqual([refused.code, refused.said], [1, [HELD_AS(MINE)]]);
      // A session answer may be a version of anything.
      const session = await on(t.ctx.deps, "kind", ID.slice(-6), "session", "--private", "yes", "--again", "--version-of", ANOTHER);
      assert.equal(session.code, 0, session.text);
      t.done();
      const u = setup();
      first(u, { kind: "raw" });
      answeredVideo(u, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ID } });
      answeredVideo(u, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      const fine = await on(u.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again", "--version-of", ANOTHER);
      assert.equal(fine.code, 0, fine.text);
      u.done();
    });
    it("checks again after the claim wait: a session that became a later version of the video meanwhile stops the answer", async () => {
      const t = setup();
      first(t, { kind: "raw" });
      const s = answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: SESSION_FIELDS });
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(s, { versionOf: ID }));
      const r = await on(t.ctx.deps, "kind", NAME, "finished", "--private", "no", "--again", "--version-of", ANOTHER);
      assert.deepEqual([r.code, r.said], [1, [HELD_AS(NAME)]]);
      t.done();
    });
  });

  describe("(e) and a session mark that only a conflicted copy of a version's record holds", () => {
    it("refuses a non-session answer whose target's set holds such a version, and lets a session answer through", async () => {
      const t = setup();
      first(t);
      const s = answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ID } });
      writeFileSync(join(s.folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...readEpisode(s.folder).record, ...SESSION_FIELDS, label: "Video of 11 Oct" }));
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [SESSION_SET(LABEL)]]);
      writesNothing(t, added);
      const session = await on(t.ctx.deps, "kind", LABEL, "session", "--private", "yes", "--version-of", ID);
      assert.equal(session.code, 0, session.text);
      t.done();
    });
    it("takes a later version of the video answered, which has one, as such a session too", async () => {
      const t = setup();
      first(t, { kind: "raw" });
      const s = answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { versionOf: ID } });
      writeFileSync(join(s.folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), recordText({ ...readEpisode(s.folder).record, ...SESSION_FIELDS, label: "Video of 11 Oct" }));
      answeredVideo(t, { id: ANOTHER, folder: "2026-10-12 Another (Mac Studio)", file: "Another.mov" });
      const r = await on(t.ctx.deps, "kind", ID.slice(-6), "finished", "--private", "no", "--again", "--version-of", ANOTHER);
      assert.deepEqual([r.code, r.said], [1, [HELD_AS(MINE)]]);
      t.done();
    });
  });

  describe("(d) compares the link the walk follows", () => {
    it("refuses --version-of naming the stale link of an unanswered video that a handed-off video's chain ends at: the walk ignores it, so the answer moves that video", async () => {
      const t = setup();
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov" });
      // R is unanswered but holds a versionOf, which the walk does not follow (an answered record's is).
      const r = addEpisode(t, { over: { versionOf: ELSEWHERE } });
      answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { versionOf: OTHER_ID, finished: FINISHED } });
      const refused = await answer(t, "--version-of", ELSEWHERE);
      assert.deepEqual([refused.code, refused.said], [1, [GONE("Third cut", LABEL)]]);
      writesNothing(t, r);
      t.done();
    });
    it("lets it be answered with no --version-of, which moves nothing: the walk does not follow the stale link", async () => {
      const t = setup();
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov" });
      const r = addEpisode(t, { over: { versionOf: ELSEWHERE } });
      answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { versionOf: OTHER_ID, finished: FINISHED } });
      const fine = await answer(t);
      assert.equal(fine.code, 0, fine.text);
      assert.equal(readEpisode(r.folder).record.versionOf, null);
      t.done();
    });
  });

  describe("a target whose chain cannot be followed", () => {
    it("refuses a target that is in a loop with a session, in the chain gap's words, and writes nothing", async () => {
      const t = setup();
      first(t, { versionOf: ELSEWHERE });
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { ...SESSION_FIELDS, label: "Video of 11 Oct", versionOf: ID } });
      const added = addEpisode(t);
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [chainGapWords(readEpisode(join(t.root, "Episodes", FOLDER)).record, { id: ID, reason: "loop" })]]);
      assert.match(r.text, /each say they are a version of the other: ask Jason\. Nothing was written\.$/);
      writesNothing(t, added);
      t.done();
    });
    it("refuses a target one of whose earlier versions is not on this Mac yet, in the same words, whatever the answer", async () => {
      for (const word of ["finished", "session"]) {
        const t = setup();
        first(t, { versionOf: "e-20261001-aaaaaa" });
        const added = addEpisode(t);
        const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", word === "session" ? "yes" : "no", "--version-of", ID);
        assert.deepEqual([r.code, r.said], [1, [`${NAME} is a new version of a video that is not on this Mac yet (e-20261001-aaaaaa). Wait for Dropbox to bring it over, then say it again. Nothing was written.`]], word);
        writesNothing(t, added);
        t.done();
      }
    });
  });

  describe("the version a handed-off video keeps", () => {
    it("is checked as (e) checks a target: a kept version whose set holds a session refuses a non-session answer, and a session answer goes through", async () => {
      const t = setup();
      first(t);
      answeredVideo(t, { id: ELSEWHERE, folder: "2026-10-11 Elsewhere (Mac Studio)", file: "Elsewhere.mov", over: { ...SESSION_FIELDS, label: "Video of 11 Oct", versionOf: ID } });
      const h = answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { kind: "raw", versionOf: ID, finished: FINISHED } });
      // It is held as a session: found by its label, and answered only as one (final fix 1).
      const refused = await on(t.ctx.deps, "kind", `Video of ${HANDED}`, "finished", "--private", "no", "--again");
      assert.deepEqual([refused.code, refused.said], [1, [HELD_AS(`Video of ${HANDED}`)]]);
      assert.deepEqual([readEpisode(h.folder).record.rev, t.started, t.waits], [1, [], []]);
      const named = await on(t.ctx.deps, "kind", `Video of ${HANDED}`, "raw", "--private", "no", "--again", "--version-of", ID);
      assert.deepEqual([named.code, named.said], [1, [HELD_AS(`Video of ${HANDED}`)]]);
      const session = await on(t.ctx.deps, "kind", `Video of ${HANDED}`, "session", "--private", "yes", "--again");
      assert.equal(session.code, 0, session.text);
      t.done();
    });
    it("lets it be answered again when the set holds no session", async () => {
      const t = setup();
      first(t);
      const h = answeredVideo(t, { id: HANDED, folder: "2026-10-18 Third cut (Mac Studio)", file: "Third cut.mov", over: { kind: "raw", versionOf: ID, finished: FINISHED } });
      const r = await on(t.ctx.deps, "kind", "Third cut", "finished", "--private", "no", "--again");
      assert.equal(r.code, 0, r.text);
      assert.equal(readEpisode(h.folder).record.versionOf, ID);
      t.done();
    });
  });

  describe("the target, looked up again after the claim wait", () => {
    it("is refused when it was archived meanwhile, in the words of the first look, and nothing but the claim is written", async () => {
      const t = setup();
      const target = first(t);
      const added = addEpisode(t);
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(target, { archived: { at: AT } }));
      const r = await answer(t, "--version-of", ID);
      assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${ID}.`]]);
      assert.deepEqual([readEpisode(added.folder).record.rev, readEpisode(added.folder).record.versionOf ?? null, t.started], [2, null, []]);
      t.done();
    });
    it("is refused when it is no longer answered", async () => {
      const t = setup();
      const target = first(t);
      const added = addEpisode(t);
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(target, { kind: null, answer: ANSWER }));
      const r = await answer(t, "--version-of", SHORT);
      assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${SHORT}.`]]);
      assert.deepEqual([readEpisode(added.folder).record.versionOf ?? null, t.started], [null, []]);
      t.done();
    });
    it("is refused for a non-session answer when it was marked a session meanwhile, and not for a session", async () => {
      for (const word of ["finished", "session"]) {
        const t = setup();
        const target = first(t);
        const added = addEpisode(t);
        duringWaits(t, CLAIM_WAIT_MS, () => rewrite(target, SESSION_FIELDS));
        const r = await on(t.ctx.deps, "kind", LABEL, word, "--private", word === "session" ? "yes" : "no", "--version-of", ID);
        if (word === "session") {
          assert.equal(r.code, 0, r.text);
          assert.equal(readEpisode(added.folder).record.versionOf, ID);
        } else {
          assert.deepEqual([r.code, r.said], [1, ["That video is a client or group session, so this new version is one too: answer it as a session."]]);
          assert.deepEqual([readEpisode(added.folder).record.versionOf ?? null, t.started], [null, []]);
        }
        t.done();
      }
    });
    it("gives the spellings it holds after the wait, not the ones it held at the first look", async () => {
      const t = setup();
      const target = first(t, { spellings: [["Sally", "Sallie"]] });
      const added = addEpisode(t);
      duringWaits(t, CLAIM_WAIT_MS, () => rewrite(target, { spellings: [["Sally", "Sallie"], ["Jon", "John"]] }));
      const r = await answer(t, "--version-of", ID);
      assert.equal(r.code, 0, r.text);
      assert.deepEqual(readEpisode(added.folder).record.spellings, [["Sally", "Sallie"], ["Jon", "John"]]);
      t.done();
    });
  });
});
