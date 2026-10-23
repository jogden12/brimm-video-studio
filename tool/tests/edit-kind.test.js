// `kind`, `leave` and `which`: Sallie's answer to "what is this video?" (spec 2026-10-22, section 2, "The card" and "What the
// answer does", and "The session mark"). A video imported lightly stays unanswered until she answers a card of two questions;
// `kind` then claims the video as `open` does, records both answers, and starts Claude's reading detached, except for a client or
// group session, which is marked and named by its label and read only when she asks for its teachings. Nothing here runs a real
// program or touches Dropbox: each test has a root and a home of its own, and the detached run `read` (a later task's) is a
// stand-in that is started and asserted, never run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIM_WAIT_MS, contextFor, editMain, findEpisode } from "../edit.js";
import { claimed, localStamp, newEpisode, readEpisode, recordFile, recordText, shownName } from "../episode.js";
import { episodeWork } from "../settings.js";
import { lockOf, resultFile } from "../detached.js";
import { writePending } from "../filing.js";
import { writeStatus } from "../importing.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { sessionLabel } from "../kinds.js";
import { clockAt } from "../unedited.js";
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
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER]]);
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
        assert.deepEqual([r.code, r.said], [1, [ZOOM]], `${came} ${word}`);
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
    assert.deepEqual(record.session, { marked: AFTER_CLAIM, on: "Mac Studio", teachings: null, cleared: null });
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
    // The claim record had neither the kind, nor the mark, nor the name: all three came in the one write that answered.
    const claim = JSON.parse(readFileSync(recordFile(found.folder, 2), "utf8"));
    assert.deepEqual([claim.kind, claim.session, claim.name.text], [null, undefined, "Pricing talk"]);
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
      assert.deepEqual(t.started.map(([cmd, args]) => [cmd, args.slice(1)]), [[process.execPath, ["read", "--now", FOLDER]]], word);
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
  it("gives up after ninety seconds, and says a notice will come", async () => {
    const t = setup();
    waiting(t);
    const r = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no");
    assert.deepEqual([r.code, r.said], [0, [STILL(LABEL)]]);
    assert.equal(t.waits[0], CLAIM_WAIT_MS);
    assert.equal(t.waits.slice(1).every((ms) => ms === 1000), true);
    assert.equal(t.waits.slice(1).reduce((sum, ms) => sum + ms, 0), 90000);
    t.done();
  });
  it("sees a result that comes at the very end of the ninety seconds", async () => {
    const t = setup();
    waiting(t);
    let polls = 0;
    duringWaits(t, 1000, () => {
      polls += 1;
      if (polls === 90) leaveResult(t);
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
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER]]);
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
  it("(b) gives a video never handed off the versionOf her answer names, null when none: --again without it clears an earlier one", async () => {
    const t = setup();
    const { added } = pair(t);
    writeFileSync(recordFile(added.folder, 2), recordText({ ...readEpisode(added.folder).record, rev: 2, kind: "raw", answer: { ...ANSWERED, state: "answered" }, versionOf: ID }));
    const cleared = await on(t.ctx.deps, "kind", LABEL, "finished", "--private", "no", "--again");
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
    assert.deepEqual(t.opened, [["QuickTime Player", join(found.folder, "Pricing talk.mp4")]]);
    untouched(t, found);
    t.done();
  });
  it("says the video is not here yet when Dropbox has not brought it over, opens nothing and brings nothing", async () => {
    const t = setup();
    const found = waiting(t);
    const r = await on({ ...t.ctx.deps, isWhole: () => false }, "which", LABEL);
    assert.deepEqual([r.code, r.said], [1, [NOT_YET]]);
    assert.deepEqual([t.opened, t.started], [[], []]);
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
    assert.deepEqual(t2.opened, [["QuickTime Player", join(answered.folder, "Pricing talk.mp4")]]);
    t.done();
    t2.done();
  });
  it("says why when QuickTime Player could not be opened, with the video named by its label", async () => {
    const t = setup();
    waiting(t);
    const r = await on({ ...t.ctx.deps, openApp: () => { throw new Error("QuickTime Player could not be opened (no such app)"); } }, "which", LABEL);
    assert.deepEqual([r.code, r.said], [1, ["QuickTime Player could not be opened (no such app)"]]);
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
    assert.match(r.text, /^QuickTime Player could not be opened/);
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
  const LEFT = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
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
  it("still lets kind, leave, which and show run for it", async () => {
    const t = setup();
    waiting(t, { answer: { ...ANSWER, state: "not for brimm-video" } });
    for (const [name, ...words] of [["which", LABEL], ["show", LABEL, "plan"], ["leave", LABEL]]) {
      const r = await on(t.ctx.deps, name, ...words);
      assert.ok(!r.text.includes(LEFT), `${name}: ${r.text}`);
    }
    t.done();
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
