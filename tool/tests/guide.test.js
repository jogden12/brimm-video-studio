// The guide's steps on the BRIMM Ops page, her note's rules for them, and the Finder words it says; then each video's one next
// step in her words, and the guide's lists. None of it needs a disk, a program or the page.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OPS, OPS_PAGE, NOT_SET_UP, ZOOM_WORDS, dropWords, noteKindOf, opsNext, noteAfter, opsText } from "../guide.js";
import { nextFor, ordered, findIn, overviewLines, videoLines, NOTHING_UNDER_WAY, NO_FIT, signatureOf, WAIT_MS, POLL_MS } from "../guide.js";
import { readyIn, roughIn, READING_STEPS, apart, COMING } from "../guide.js";

const AT = "2026-10-25T12:00:00-05:00";
const LATER = "2026-10-26T09:00:00-05:00";
const HANDOFF = (over = {}) => ({ id: "e-20261020-3fa9c1", revision: 1, kind: "finished", emptyAt: null, at: Date.parse("2026-10-20T13:00:00-05:00"), file: "Talk.mp4", ...over });
const NOTE = (over = {}) => ({ kind: "episode", step: "taken", revision: 1, at: AT, ...over });
const OPS_TEXTS = {
  taken: 'Drag the hand-off onto Episodes, then press "Take the hand-off".',
  takenAgain: 'Drag the new hand-off onto the same episode, then press "Take the hand-off".',
  online: ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".',
  sessionTaken: 'Choose "Principles", drop the hand-off, then press "Take the session".',
  sessionAgain: 'Choose "Principles", drop the new hand-off, then press "Take the session".',
  kit: 'Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.',
  posted: 'Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".',
  live: 'Correct the form to what is live, then press "This is what is live".',
  cascade: 'Press "Write what’s next". Approve and copy the newsletter section, then the Instagram pieces, then the LinkedIn posts. The ideas for YouTube are suggestions for YouTube Studio. Cut each "Clip to cut" in OpusClip. Then make it a short video with "New short video from a clip", on the episode\'s "Reels" card.',
  posttext: 'Press "Write what’s next", and pick the hook and the YouTube Short title. Approve and copy the caption, the Short\'s title and description, and the LinkedIn post.',
  postedShort: "Post it on Instagram, and as a YouTube Short.",
  checked: 'Check each principle marked "Check it", then press "Use in drafts".',
  // "the hand-off", not "the empty session revision": once the session's own hand-off is written, final/ holds that one in its place.
  withdrawn: 'Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.'
};

describe("the guide's constants and Finder words", () => {
  it("are the design's", () => {
    assert.equal(OPS_PAGE, "https://claude.ai/artifact/GCUQPLnSFWZe3VghyaKNtX");
    assert.equal(NOT_SET_UP, "This Mac isn't set up for the guide yet: ask Jason.");
    assert.equal(dropWords("Drop", "Sallie's laptop"), "Dropbox › The BRIMM DB › BRIMM Video › Drop › Sallie's laptop");
    assert.equal(dropWords(undefined, "Sallie's laptop"), "Dropbox › The BRIMM DB › BRIMM Video › Unedited Video › Sallie's laptop");
    assert.equal(ZOOM_WORDS, "Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer");
  });
});

describe("the BRIMM Ops page's steps", () => {
  it("are the design's, by what the hand-off is", () => {
    assert.deepEqual(OPS, { episode: ["taken", "kit", "posted", "live", "cascade"], "short video": ["taken", "posttext", "posted"], session: ["taken", "checked"], withdrawal: ["withdrawn"] });
    assert.deepEqual(["finished", "raw", "short video", "session"].map(noteKindOf), ["episode", "episode", "short video", "session"]);
  });
  it("come next from her note: the first with none, the one after the step noted, taken again for a higher revision, none at the end", () => {
    const next = (step, again = false) => ({ step, again });
    for (const [handoff, note, want] of [
      [HANDOFF(), undefined, next("taken")],
      [HANDOFF({ kind: "short video" }), undefined, next("taken")],
      [HANDOFF({ kind: "session" }), undefined, next("taken")],
      [HANDOFF({ kind: "session", emptyAt: 1 }), undefined, next("withdrawn")],
      [HANDOFF(), NOTE({ step: "kit" }), next("posted")],
      [HANDOFF(), NOTE({ step: "cascade" }), null],
      [HANDOFF({ kind: "short video" }), NOTE({ kind: "short video", step: "posted" }), null],
      [HANDOFF({ kind: "session" }), NOTE({ kind: "session", step: "checked" }), null],
      [HANDOFF({ revision: 2 }), NOTE({ step: "kit" }), next("taken", true)],
      // Its kind changed: the note is set aside, and the steps start again for the new kind.
      [HANDOFF({ kind: "session" }), NOTE({ step: "cascade" }), next("taken")],
      [HANDOFF({ revision: 3 }), NOTE({ kind: "session", step: "checked", revision: 2 }), next("taken")],
      // A session after all: the withdrawal, whatever was noted, until it is noted at or after its empty revision.
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 2 }), NOTE({ step: "cascade" }), next("withdrawn")],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 2 }), NOTE({ kind: "session", step: "checked", revision: 2 }), next("withdrawn")],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 2 }), NOTE({ kind: "session", step: "withdrawn", revision: 2 }), null],
      [HANDOFF({ kind: "session", emptyAt: 3, revision: 3 }), NOTE({ kind: "session", step: "withdrawn", revision: 2 }), next("withdrawn")],
      // Its own hand-off (revision 3) written before the withdrawal was noted: still the withdrawal first.
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), NOTE({ step: "cascade" }), next("withdrawn")],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), undefined, next("withdrawn")],
      // After the withdrawal, its own hand-off's steps. The page's withdrawal takes the session it was dropped with, so a noted
      // withdrawal counts as taken at its revision: the empty one's brings the new hand-off back as taken, again; its own, checked.
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), NOTE({ kind: "session", step: "withdrawn", revision: 2 }), next("taken", true)],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), NOTE({ kind: "session", step: "withdrawn", revision: 3 }), next("checked")],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), NOTE({ kind: "session", step: "checked", revision: 3 }), null]
    ]) assert.deepEqual(opsNext(handoff, note), want, JSON.stringify([handoff, note]));
  });
  it("notes a step: taken again keeps the steps after it as noted, at the new revision", () => {
    assert.deepEqual(noteAfter(HANDOFF(), undefined, "taken", AT), NOTE());
    assert.deepEqual(noteAfter(HANDOFF(), NOTE(), "kit", LATER), NOTE({ step: "kit", at: LATER }));
    assert.deepEqual(noteAfter(HANDOFF({ revision: 2 }), NOTE({ step: "kit" }), "taken", LATER), NOTE({ step: "kit", revision: 2, at: LATER }));
    assert.deepEqual(opsNext(HANDOFF({ revision: 2 }), noteAfter(HANDOFF({ revision: 2 }), NOTE({ step: "kit" }), "taken", LATER)), { step: "posted", again: false });
    assert.deepEqual(noteAfter(HANDOFF({ kind: "session" }), NOTE({ step: "cascade" }), "taken", LATER), { kind: "session", step: "taken", revision: 1, at: LATER });
    assert.deepEqual(noteAfter(HANDOFF({ kind: "session", emptyAt: 2, revision: 2 }), NOTE({ step: "cascade" }), "withdrawn", LATER), { kind: "session", step: "withdrawn", revision: 2, at: LATER });
    assert.deepEqual(noteAfter(HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), NOTE({ step: "cascade" }), "withdrawn", LATER), { kind: "session", step: "withdrawn", revision: 3, at: LATER });
    const own = HANDOFF({ kind: "session", emptyAt: 2, revision: 3 });
    const taken = noteAfter(own, NOTE({ kind: "session", step: "withdrawn", revision: 2 }), "taken", LATER);
    assert.deepEqual(taken, { kind: "session", step: "taken", revision: 3, at: LATER });
    assert.deepEqual(opsNext(own, taken), { step: "checked", again: false });
  });
  it("says each step in the page's own words", () => {
    const T = OPS_TEXTS;
    for (const [handoff, step, again, want] of [
      [HANDOFF(), "taken", false, T.taken],
      [HANDOFF({ kind: "short video" }), "taken", false, T.taken],
      [HANDOFF({ kind: "raw" }), "taken", false, T.taken + T.online],
      [HANDOFF(), "taken", true, T.takenAgain],
      [HANDOFF({ kind: "raw" }), "taken", true, T.takenAgain + T.online],
      [HANDOFF({ kind: "session" }), "taken", false, T.sessionTaken],
      [HANDOFF({ kind: "session" }), "taken", true, T.sessionAgain],
      [HANDOFF(), "kit", false, T.kit],
      [HANDOFF(), "posted", false, T.posted],
      [HANDOFF(), "live", false, T.live],
      [HANDOFF(), "cascade", false, T.cascade],
      [HANDOFF({ kind: "short video" }), "posttext", false, T.posttext],
      [HANDOFF({ kind: "short video" }), "posted", false, T.postedShort],
      [HANDOFF({ kind: "session" }), "checked", false, T.checked],
      [HANDOFF({ kind: "session", emptyAt: 1 }), "withdrawn", false, T.withdrawn],
      [HANDOFF({ kind: "session", emptyAt: 2, revision: 3 }), "withdrawn", false, T.withdrawn]
    ]) assert.equal(opsText(handoff, step, again), want, `${handoff.kind} ${step} ${again}`);
  });
});

const BASE = { name: "Pricing talk (3fa9c1)", id: "e-20261020-3fa9c1", aliases: [], at: 0, mac: "", drop: null, conflicted: false, kind: "finished", waiting: false, heldAsSession: false, elsewhere: false, readingsOff: false, reading: "done", readsAt: "", roughAt: "", offersAnswered: true, v2: true, placeholder: false, shownInFinalCut: false, finishRunning: false, shownSinceFinish: false, session: null, handoff: null };
const NONE = { version: 1, handoffs: {}, finished: {} };
const NOW = Date.parse("2026-10-25T12:00:00-05:00");
const DROP = (over) => ({ kind: null, drop: { here: true, state: "arriving", step: "", left: null, total: null, readyAt: "", ...over } });
const SESSION = (over) => ({ kind: "session", session: { choice: "asked", teachingsOn: true, undecided: 0, emptyOwed: false, ...over } });
const RAW = (over) => ({ kind: "raw", ...over });
const shown = (n) => (n.done ? { done: true } : { stage: n.stage, text: n.text });
const OFF = "Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.";
const V1 = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
const STAGE_ROWS = [
  [DROP(), "arriving", 'It is coming into your drop folder. Wait for the "Ready" notice.'],
  [{ ...DROP({ here: false }), mac: "Mac Studio" }, "arriving", 'It is in the drop folder of the Mac Studio. Wait for the "Ready" notice on that Mac.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180, total: 360 }), "importing", 'It is being imported, at writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180 }), "importing", 'It is being imported, at writing the transcript, about 3 minutes left of this step. Wait for the "Ready" notice.'],
  [{ ...DROP({ here: false, state: "importing", step: "Writing the transcript" }), mac: "Mac Studio" }, "importing", 'It is being imported on the Mac Studio, at writing the transcript. Wait for the "Ready" notice on that Mac.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180, total: 360, readyAt: "15:06" }), "importing", 'It is being imported, at writing the transcript, about 6 minutes left in all. Ready about 15:06. Wait for the "Ready" notice.'],
  [DROP({ state: "importing", step: "Filing", left: 120, readyAt: "15:02" }), "importing", 'It is being imported, at filing, about 2 minutes left of this step. Ready about 15:02. Wait for the "Ready" notice.'],
  [DROP({ state: "retry" }), "retry", 'Its import did not finish. Say "try it again".'],
  [{ ...DROP({ here: false, state: "retry" }), mac: "Sallie's laptop" }, "retry", "Its import did not finish on Sallie's laptop. Say \"try it again\" on that Mac."],
  [DROP({ state: "zoom" }), "zoom", "It is a Zoom download, and those go in Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer. Move it there in Finder."],
  // Not in the plan's rows: a Zoom download in the other Mac's drop folder, and an import whose step is not known yet.
  [{ ...DROP({ here: false, state: "zoom" }), mac: "Mac Studio" }, "zoom", "It is a Zoom download on the Mac Studio. Those go in Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer. Move it there in Finder on that Mac."],
  [DROP({ state: "importing" }), "importing", 'It is being imported. Wait for the "Ready" notice.'],
  [{ conflicted: true }, "conflicted", 'Dropbox kept two copies of a change to it. Say "sort out the conflict".'],
  [{ kind: null, waiting: true }, "waiting", 'It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
  [{ kind: null, waiting: true, elsewhere: true, mac: "Mac Studio" }, "answering-elsewhere", "It is being answered on the Mac Studio. Carry on there."],
  [{ heldAsSession: true }, "held-session", 'One of its other versions is a client or group session. Say "it was a session after all" for this one too.'],
  [{ elsewhere: true, mac: "Mac Studio", reading: "running" }, "open-elsewhere", "It is open on the Mac Studio. Carry on there, or open it here and take it over."],
  [{ readingsOff: true, reading: "none" }, "readings-off", "Readings are off on this Mac: ask Jason."],
  [{ reading: "running" }, "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [{ reading: "none" }, "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [RAW({ reading: "later", readsAt: "10:58" }), "reading-later", "Claude starts reading it about 10:58, once the import has checked its copies. A notice comes when it is done."],
  [RAW({ reading: "later", readsAt: "10:58", roughAt: "11:15" }), "reading-later", "Claude starts reading it about 10:58, once the import has checked its copies. Its rough cut is ready about 11:15. A notice comes when it is done."],
  [{ reading: "failed" }, "reading-failed", 'Claude\'s reading of it did not finish. Say "how far is it?" to see why.'],
  [{ offersAnswered: false }, "spellings", 'Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
  [{ v2: false }, "waits-v2", V1],
  [{ kind: "short video" }, "handoff-owed", 'Its hand-off is not written yet. Say "show me the spellings" and answer them again.'],
  [RAW({ finishRunning: true, placeholder: true }), "finish-running", "Its finish is running. The panel shows how far it is."],
  [RAW({ placeholder: true }), "name", 'It needs its name before it is finished. Say "call it", then the name.'],
  [RAW(), "show", 'Ask for any changes in your own words, then say "show it in Final Cut".'],
  [RAW({ shownInFinalCut: true }), "finish", 'Trim it by hand in Final Cut. Then Share it with Command-E, and choose File > Export XML…, both into From Final Cut. Then say "finish the episode".'],
  [RAW({ shownInFinalCut: true, shownSinceFinish: true, handoff: { id: "e-20261020-3fa9c1", revision: 1, kind: "raw", emptyAt: null, at: NOW, file: "Talk.mov" } }), "finish-again", 'It was shown in Final Cut again since its finish. Share it and Export XML again, then say "finish the episode".'],
  [SESSION({ choice: null }), "session-choice", "Choose what you want from it: its teachings, or the transcript only."],
  [SESSION({ choice: null, teachingsOn: false }), "session-off", OFF],
  [SESSION({ emptyOwed: true }), "session-empty-owed", 'Say "it was a session after all" again: its empty revision for the BRIMM Ops page is still to be written.'],
  [{ ...SESSION(), elsewhere: true, mac: "Mac Studio" }, "open-elsewhere", "It is open on the Mac Studio. Carry on there."],
  [{ ...SESSION(), reading: "running" }, "session-reading", 'Claude is reading its teachings. A notice comes when it is done; then say "what did Claude find?".'],
  [{ ...SESSION({ teachingsOn: false }), reading: "none" }, "session-off", OFF],
  [{ ...SESSION(), reading: "failed" }, "reading-failed", 'Claude\'s reading of it did not finish. Say "how far is it?" to see why.'],
  [SESSION({ undecided: 3 }), "session-decide", 'Keep, drop or change each of its principles and Reel ideas. Say "show me the principles".'],
  [SESSION(), "session-done", 'Every item is decided. Say "done" to write its hand-off.'],
  [{ ...SESSION(), v2: false }, "waits-v2", V1]
];
const OPS_HANDOFF = { id: "e-20261020-3fa9c1", revision: 1, kind: "finished", emptyAt: null, at: Date.parse("2026-10-20T13:00:00-05:00"), file: "Talk.mp4" };

describe("the next step for a video", () => {
  it("is the one its stage gives, in her words", () => {
    for (const [over, stage, text] of STAGE_ROWS) assert.deepEqual(shown(nextFor({ ...BASE, ...over }, NONE, NOW)), { stage, text }, JSON.stringify(over));
  });
  it("is a BRIMM Ops step once its hand-off is written, with the step after it", () => {
    const n = nextFor({ ...BASE, handoff: OPS_HANDOFF }, NONE, NOW);
    assert.deepEqual(n, { done: false, stage: "ops", text: `On the BRIMM Ops page: ${OPS_TEXTS.taken}`, step: "taken", after: OPS_TEXTS.kit });
    const last = nextFor({ ...BASE, handoff: OPS_HANDOFF }, { ...NONE, handoffs: { [OPS_HANDOFF.id]: { kind: "episode", step: "live", revision: 1, at: "2026-10-24T09:00:00-05:00" } } }, NOW);
    assert.deepEqual([last.step, last.after], ["cascade", ""]);
    // Not in the plan's test: the page's step is hers on this Mac too, while the video is open on the other one.
    assert.equal(nextFor({ ...BASE, elsewhere: true, mac: "Mac Studio", handoff: OPS_HANDOFF }, NONE, NOW).stage, "ops");
  });
  it("is none for a video that is done: transcript only, finished by her word, every step noted, or a hand-off 60 days old", () => {
    const sixty = OPS_HANDOFF.at + 60 * 86400000;
    for (const [over, notes, now] of [
      [SESSION({ choice: "transcript only" }), NONE, NOW],
      [{ offersAnswered: false }, { ...NONE, finished: { [BASE.id]: "2026-10-24T09:00:00-05:00" } }, NOW],
      [{ handoff: OPS_HANDOFF }, { ...NONE, handoffs: { [OPS_HANDOFF.id]: { kind: "episode", step: "cascade", revision: 1, at: "2026-10-24T09:00:00-05:00" } } }, NOW],
      [{ handoff: OPS_HANDOFF }, NONE, sixty + 1]
    ]) assert.deepEqual(nextFor({ ...BASE, ...over }, notes, now), { done: true }, JSON.stringify(over));
    assert.equal(nextFor({ ...BASE, handoff: OPS_HANDOFF }, NONE, sixty).done, false);
  });
  it("is a step that nothing noted can skip, though she said the video was finished: a conflict, her answer, a version held as a session, a session's empty revision, its withdrawal", () => {
    const FINISHED = { ...NONE, finished: { [BASE.id]: "2026-10-24T09:00:00-05:00" } };
    const EMPTY = { ...OPS_HANDOFF, revision: 2, kind: "session", emptyAt: 2, file: "" };
    const WITHDRAW = { stage: "ops", text: `On the BRIMM Ops page: ${OPS_TEXTS.withdrawn}` };
    for (const [over, want] of [
      [{ conflicted: true }, { stage: "conflicted", text: 'Dropbox kept two copies of a change to it. Say "sort out the conflict".' }],
      [{ kind: null, waiting: true }, { stage: "waiting", text: 'It is waiting for your answer. Say "what\'s waiting?" to see its card.' }],
      [{ kind: null, waiting: true, elsewhere: true, mac: "Mac Studio" }, { stage: "answering-elsewhere", text: "It is being answered on the Mac Studio. Carry on there." }],
      [{ heldAsSession: true }, { stage: "held-session", text: 'One of its other versions is a client or group session. Say "it was a session after all" for this one too.' }],
      [SESSION({ emptyOwed: true }), { stage: "session-empty-owed", text: 'Say "it was a session after all" again: its empty revision for the BRIMM Ops page is still to be written.' }],
      [{ ...SESSION(), handoff: EMPTY }, WITHDRAW],
      [{ ...SESSION({ choice: "transcript only" }), handoff: { ...EMPTY, revision: 3 } }, WITHDRAW]
    ]) assert.deepEqual(shown(nextFor({ ...BASE, ...over }, FINISHED, NOW)), want, JSON.stringify(over));
    // Once the withdrawal is noted, her word that the video is finished holds again, as it does for any other step.
    const withdrawn = { ...FINISHED, handoffs: { [EMPTY.id]: { kind: "session", step: "withdrawn", revision: 2, at: "2026-10-24T10:00:00-05:00" } } };
    assert.deepEqual(nextFor({ ...BASE, ...SESSION({ choice: null }), handoff: EMPTY }, withdrawn, NOW), { done: true });
    assert.deepEqual(nextFor({ ...BASE, ...SESSION(), handoff: { ...EMPTY, revision: 3 } }, withdrawn, NOW), { done: true });
  });
  it("for a session after all: the withdrawal first, whatever was noted or chosen and however old; then its own steps; then its own hand-off's", () => {
    const EMPTY = { id: "e-20261020-3fa9c1", revision: 2, kind: "session", emptyAt: 2, at: Date.parse("2026-10-20T13:00:00-05:00"), file: "" };
    const OWN = { ...EMPTY, revision: 3 };
    const noted = (step, revision = 2) => ({ ...NONE, handoffs: { [EMPTY.id]: { kind: "session", step, revision, at: "2026-10-21T09:00:00-05:00" } } });
    const episodeNote = { ...NONE, handoffs: { [EMPTY.id]: { kind: "episode", step: "cascade", revision: 1, at: "2026-10-19T09:00:00-05:00" } } };
    const WITHDRAW = { stage: "ops", text: `On the BRIMM Ops page: ${OPS_TEXTS.withdrawn}` };
    const CHOOSE = "Choose what you want from it: its teachings, or the transcript only.";
    const sixty = EMPTY.at + 60 * 86400000;
    for (const [over, notes, now, want] of [
      [{ ...SESSION(), handoff: EMPTY }, NONE, NOW, WITHDRAW],
      [{ ...SESSION({ choice: "transcript only" }), handoff: EMPTY }, NONE, NOW, WITHDRAW],
      [{ ...SESSION(), handoff: EMPTY }, episodeNote, NOW, WITHDRAW],
      [{ ...SESSION(), handoff: EMPTY }, NONE, sixty + 1, WITHDRAW],
      [{ ...SESSION({ choice: null }), handoff: EMPTY }, noted("withdrawn"), NOW, { stage: "session-choice", text: CHOOSE }],
      [{ ...SESSION({ undecided: 2 }), handoff: EMPTY }, noted("withdrawn"), NOW, { stage: "session-decide", text: 'Keep, drop or change each of its principles and Reel ideas. Say "show me the principles".' }],
      [{ ...SESSION({ choice: "transcript only" }), handoff: EMPTY }, noted("withdrawn"), NOW, { done: true }],
      [{ ...SESSION(), handoff: OWN }, episodeNote, NOW, WITHDRAW],
      [{ ...SESSION(), handoff: OWN }, noted("withdrawn"), NOW, { stage: "ops", text: `On the BRIMM Ops page: ${OPS_TEXTS.sessionAgain}` }],
      [{ ...SESSION(), handoff: OWN }, noted("withdrawn", 3), NOW, { stage: "ops", text: `On the BRIMM Ops page: ${OPS_TEXTS.checked}` }]
    ]) assert.deepEqual(shown(nextFor({ ...BASE, ...over }, notes, now)), want, JSON.stringify([over, notes, now]));
    // What comes once the withdrawal is noted is the session's own next step, not "the last step".
    assert.equal(nextFor({ ...BASE, ...SESSION({ choice: null }), handoff: EMPTY }, NONE, NOW).after, CHOOSE);
  });
  it("says every text in sentences under 25 words, with no path or flag", () => {
    const texts = [...STAGE_ROWS.map(([, , text]) => text), ...Object.values(OPS_TEXTS)];
    for (const text of texts) {
      assert.doesNotMatch(text, /\/|\\|--|\.js\b/, text);
      for (const sentence of text.split(/(?<=[.;])\s+/)) assert.ok(sentence.split(/\s+/).length < 25, sentence);
    }
  });
});

describe("the guide's lists", () => {
  const item = (name, over = {}, next = { done: false, stage: "spellings", text: "T.", step: "", after: "" }) => ({ facts: { ...BASE, name, ...over }, next, folder: null, record: null });
  const waiting = { done: false, stage: "waiting", text: "W.", step: "", after: "" };
  it("puts a video waiting for her answer first, then the newest first", () => {
    const items = [item("Old", { at: 1 }), item("Asked", { at: 0 }, waiting), item("New", { at: 3 }), item("Same B", { at: 2 }), item("Same A", { at: 2 })];
    assert.deepEqual(ordered(items).map((i) => i.facts.name), ["Asked", "New", "Same A", "Same B", "Old"]);
  });
  it("finds a video by its name, label or id, whatever its case and spacing, and never repeats what was said", () => {
    const items = [
      item("Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa)", { aliases: ["Video of 20 Oct, 09:00 (Mac Studio)", "e-20261020-aaaaaa", "aaaaaa"] }),
      item("Pricing talk (bbbbbb)", { aliases: ["Pricing talk", "bbbbbb"] }),
      item("Pricing talk (cccccc)", { aliases: ["Pricing talk", "cccccc"] })
    ];
    assert.equal(findIn(items, "video of 20 oct,  09:00 (mac studio)").item, items[0]);
    assert.equal(findIn(items, "bbbbbb").item, items[1]);
    assert.equal(findIn(items, "Pricing talk (cccccc)").item, items[2]);
    assert.deepEqual(findIn(items, "Pricing talk"), { why: "More than one video fits that: Pricing talk (bbbbbb) and Pricing talk (cccccc). Say which." });
    assert.deepEqual(findIn(items, "Coaching call Jane Doe"), { why: NO_FIT });
    assert.equal(NO_FIT, 'No video under way fits that. Say "what\'s next?" to see the ones that are.');
  });
  it("say the drop folder first, then what is under way, then how many videos from before the switch are not guided", () => {
    const drop = "Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
    assert.deepEqual(overviewLines({ drop, items: [item("Old", { at: 1 }), item("Asked", { at: 0 }, waiting), item("Done", {}, { done: true })], old: 2 }), [
      `Your drop folder: ${drop}`, "Under way:", "  Asked: W.", "  Old: T.", "2 videos from before the switch are not guided."
    ]);
    assert.deepEqual(overviewLines({ drop, items: [], old: 1 }), [`Your drop folder: ${drop}`, NOTHING_UNDER_WAY, "1 video from before the switch is not guided."]);
    assert.equal(NOTHING_UNDER_WAY, "Nothing is under way. To start, put the video in your drop folder.");
  });
  it("say one video's step, and for a BRIMM Ops step the one after it and its word", () => {
    assert.deepEqual(videoLines(item("A (aaaaaa)")), ["A (aaaaaa): T."]);
    assert.deepEqual(videoLines(item("A (aaaaaa)", {}, { done: true })), ["A (aaaaaa) is done: nothing is left to do for it."]);
    assert.deepEqual(videoLines(item("A (aaaaaa)", {}, { done: false, stage: "ops", text: "On the BRIMM Ops page: K.", step: "kit", after: "P." })), ["A (aaaaaa): On the BRIMM Ops page: K.", "Then: P.", "Step: kit"]);
    assert.deepEqual(videoLines(item("A (aaaaaa)", {}, { done: false, stage: "ops", text: "On the BRIMM Ops page: C.", step: "cascade", after: "" })), ["A (aaaaaa): On the BRIMM Ops page: C.", "Then: that is the last step.", "Step: cascade"]);
  });
});

describe("the times the guide gives", () => {
  it("are from the panel's run and this Mac's speeds, and none while one is not known", () => {
    assert.deepEqual(READING_STEPS, ["Asking Claude", "Making the rough cut"]);
    assert.equal(readyIn({ left: 180, total: 360, n: 2, of: 4 }), 360);
    assert.equal(readyIn({ left: 120, total: null, n: 4, of: 4 }), 120);
    assert.equal(readyIn({ left: 120, total: null, n: 2, of: 4 }), null);
    assert.equal(readyIn({ left: null, total: null, n: 4, of: 4 }), null);
    assert.equal(readyIn({ left: 30, total: null, n: null, of: null }), null);
    assert.equal(roughIn({ "Asking Claude": 0.31, "Making the rough cut": 0.12 }, 2400), 1032);
    assert.equal(roughIn({ "Asking Claude": 0.31 }, 2400), null);
    assert.equal(roughIn({ "Asking Claude": 0.31, "Making the rough cut": 0.12 }, undefined), null);
    assert.equal(roughIn({}, 2400), null);
  });
});

describe("the names of videos with no label yet", () => {
  it("tell apart two of one size by when they came, and by a number when that is the same minute; never by a file's name", () => {
    const v = (name, at, aliases = []) => ({ name, at, aliases });
    assert.deepEqual(apart([v("A video of 5 bytes", 1), v("A video of 5 bytes", 2), v("A video of 9 bytes", 3), v("Video of 20 Oct, 14:58 (Mac Studio)", 4, ["Video of 20 Oct, 14:58 (Mac Studio)"])], (ms) => `t${ms}`).map((x) => x.name),
      ["A video of 5 bytes that came at t1", "A video of 5 bytes that came at t2", "A video of 9 bytes", "Video of 20 Oct, 14:58 (Mac Studio)"]);
    assert.deepEqual(apart([v("A video of 5 bytes", 2), v("A video of 5 bytes", 1), v("A video of 5 bytes", 1)], () => "14:58").map((x) => x.name),
      ["A video of 5 bytes that came at 14:58 (3)", "A video of 5 bytes that came at 14:58 (1)", "A video of 5 bytes that came at 14:58 (2)"]);
  });
});

describe("what counts as a change while the guide waits", () => {
  it("is a video come or gone, a stage or an import's step, never the time left or a size", () => {
    const at = (over, next = { done: false, stage: "importing", text: "x", step: "", after: "" }) => ({ facts: { ...BASE, id: "", name: "A video of 5 bytes", ...DROP({ state: "importing", step: "Reading the sound", left: 60, total: 300 }), ...over }, next, folder: null, record: null });
    const base = signatureOf([at({})]);
    assert.equal([WAIT_MS, POLL_MS].join(), "90000,5000");
    assert.equal(signatureOf([at({ name: "A video of 1.2 GB", drop: { here: true, state: "importing", step: "Reading the sound", left: 10, total: 100 } })]), base);
    assert.notEqual(signatureOf([at({ drop: { here: true, state: "importing", step: "Writing the transcript", left: 10, total: 100 } })]), base);
    assert.notEqual(signatureOf([at({}), at({})]), base);
    assert.notEqual(signatureOf([at({}, { done: false, stage: "arriving", text: "x", step: "", after: "" })]), base);
  });
  it("waits only while a video is coming in, being imported or being read", () => {
    assert.deepEqual(COMING, ["arriving", "importing", "reading-later", "reading", "session-reading"]);
  });
});
