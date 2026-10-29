// The guide's steps on the BRIMM Ops page, her note's rules for them, and the Finder words it says; then each video's one next
// step in her words, and the guide's lists. None of it needs a disk, a program or the page.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OPS, OPS_PAGE, NOT_SET_UP, ZOOM_WORDS, dropWords, noteKindOf, opsNext, noteAfter, opsText } from "../guide.js";
import { nextFor, ordered, findIn, overviewLines, videoLines, NOTHING_UNDER_WAY, NO_FIT, signatureOf, WAIT_MS, POLL_MS } from "../guide.js";
import { readyIn, roughIn, READING_STEPS, apart, COMING } from "../guide.js";
import { APP_NOT_SET_UP, COPY_STEP, copyIn } from "../guide.js";
import { NOT_SET_UP as APP_SAYS } from "../app.js";
import { TELL_MS, TELL_POLL_MS, trailOf, follow, told, stillLine } from "../guide.js";
import { WORK_COPY_STEP } from "../workcopy.js";

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

const BASE = { name: "Pricing talk (3fa9c1)", id: "e-20261020-3fa9c1", aliases: [], at: 0, mac: "", drop: null, conflicted: false, kind: "finished", waiting: false, heldAsSession: false, elsewhere: false, readingsOff: false, reading: "done", readsAt: "", roughAt: "", offersAnswered: true, v2: true, app: true, placeholder: false, shownInFinalCut: false, finishRunning: false, shownSinceFinish: false, session: null, handoff: null, source: null };
const NONE = { version: 1, handoffs: {}, finished: {} };
const NOW = Date.parse("2026-10-25T12:00:00-05:00");
const DROP = (over) => ({ kind: null, drop: { here: true, state: "arriving", step: "", left: null, total: null, readyAt: "", ...over } });
const SESSION = (over) => ({ kind: "session", session: { choice: "asked", teachingsOn: true, undecided: 0, emptyOwed: false, ...over } });
const RAW = (over) => ({ kind: "raw", ...over });
/** A raw video on the HyperFrames way (plan PR 10): the record picks the way, as finish's does (edit.js finishWay). Its way is "unopened" until
    a project is in use here, then "hyperframes". A raw video with no `way`, or on the Final Cut way, keeps the Final Cut stages. */
const APP = (over) => ({ kind: "raw", way: "unopened", ...over });
/** The main project in use, here: whether the app opened it, the time of the last turn in the app's history in words, and whether it
    has an export that began after its last change. */
const PROJECT = (over) => ({ opened: true, last: "", exported: false, ...over });
const CLIP = (over) => ({ kind: "short video", way: "clip", ...over });
const shown = (n) => (n.done ? { done: true } : { stage: n.stage, text: n.text });
const OFF = "Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.";
/** What `app` says on a Mac whose settings have the app off, which the guide says in its place (plan PR 17). */
const APP_OFF = "This Mac isn't set up for HyperFrames yet: ask Jason.";
const V1 = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
/** What a video says that the gate holds as a session, though its kind is a raw video's, a clip's or a finished video's (a Dropbox conflict or a
    hand edit leaves one): how to clear the mark (plan PR 10, review I2). */
const MARK = 'It is held as a client or group session. If it is not one, say "clear the session mark".';
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
  // A step that opens with Claude's name keeps its capital mid-sentence, as unedited.js clause() keeps it.
  [DROP({ state: "importing", step: "Claude's notes" }), "importing", 'It is being imported, at Claude\'s notes. Wait for the "Ready" notice.'],
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
  // A finished video's hand-off is written when its spellings are answered; an iPhone clip's is not (plan PR 7, F5): it is edited in
  // HyperFrames and exported, or handed off as it is, and on a Mac that hands off version 1 it waits for version 2.
  [{ kind: "finished" }, "handoff-owed", 'Its hand-off is not written yet. Say "show me the spellings" and answer them again.'],
  [{ kind: "short video" }, "clip-next", 'Open it in HyperFrames to edit it, then export it on this Mac and say "hand it off". Or say "hand it off" to hand it off as it is.'],
  // Review, minor 2: a clip opened in HyperFrames and exported is handed off in version 1 too, so only handing it off as it is waits for
  // version 2 on a Mac that hands off version 1; and the offer of HyperFrames is left out where this Mac's settings have the app off.
  [{ kind: "short video", v2: false }, "clip-next", 'Open it in HyperFrames to edit it, then export it on this Mac and say "hand it off". Handing it off as it is waits until this Mac hands off version 2: ask Jason.'],
  [{ kind: "short video", app: false }, "clip-next", 'Say "hand it off" to hand it off as it is.'],
  [{ kind: "short video", app: false, v2: false }, "waits-v2", V1],
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
  [{ ...SESSION(), v2: false }, "waits-v2", V1],
  // The HyperFrames way (plan PR 10). What comes first is as it was: the reading, the spellings, the name.
  [APP({ reading: "running", copy: { left: 90, usual: null } }), "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [APP({ offersAnswered: false, copy: { left: 90, usual: null } }), "spellings", 'Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
  [APP({ placeholder: true, copy: { left: 90, usual: null } }), "name", 'It needs its name before it is finished. Say "call it", then the name.'],
  // The video for HyperFrames being made: how long is left when the panel says, else how long it usually takes, else no time.
  [APP({ copy: { left: 180, usual: 240 } }), "making-copy", 'The video for HyperFrames is being made, about 3 minutes left. Say "open it in HyperFrames" when it is done.'],
  [APP({ copy: { left: 20, usual: null } }), "making-copy", 'The video for HyperFrames is being made, less than a minute left. Say "open it in HyperFrames" when it is done.'],
  [APP({ copy: { left: null, usual: 240 } }), "making-copy", 'The video for HyperFrames is being made. It usually takes about 4 minutes. Say "open it in HyperFrames" when it is done.'],
  [APP({ copy: { left: null, usual: null } }), "making-copy", 'The video for HyperFrames is being made. Say "open it in HyperFrames" when it is done.'],
  [CLIP({ copy: { left: 120, usual: null } }), "making-copy", 'The video for HyperFrames is being made, about 2 minutes left. Say "open it in HyperFrames" when it is done.'],
  // On a Mac whose settings have the app off nothing opens a project, so a clip is not told to open one.
  [CLIP({ copy: { left: null, usual: null }, app: false, v2: false }), "waits-v2", V1],
  [APP({ way: "hyperframes", project: PROJECT(), elsewhere: true, mac: "Mac Studio" }), "open-elsewhere", "It is open on the Mac Studio. Carry on there, or open it here and take it over."],
  // Open it: no project and no copy at work, or a project the app never opened.
  [APP(), "open-app", 'Say "open it in HyperFrames" to edit it there.'],
  [APP({ way: "hyperframes" }), "open-app", 'Say "open it in HyperFrames" to edit it there.'],
  [APP({ way: "hyperframes", project: PROJECT({ opened: false }) }), "open-app", 'Say "open it in HyperFrames" to edit it there.'],
  [APP({ way: "hyperframes", project: PROJECT({ opened: false }), copy: { left: 30, usual: null } }), "open-app", 'Say "open it in HyperFrames" to edit it there.'],
  // On a Mac whose settings have the app off nothing opens a project: `app` says this Mac isn't set up, whatever state the project is in, so the guide says
  // that where it would say to open it, or that its video is being made (plan PR 17; the review of PR 10, M2). The reading, the spellings, the name, the other
  // Mac's claim and a finish at work come first, as they did; a project here that the app opened is in HyperFrames, and an export is an export.
  [APP({ app: false }), "app-off", APP_OFF],
  [APP({ way: "hyperframes", app: false }), "app-off", APP_OFF],
  [APP({ way: "hyperframes", app: false, project: PROJECT({ opened: false }) }), "app-off", APP_OFF],
  [APP({ way: "hyperframes", app: false, copy: { left: 180, usual: 240 } }), "app-off", APP_OFF],
  [CLIP({ way: "hyperframes", app: false }), "app-off", APP_OFF],
  [APP({ app: false, reading: "running" }), "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [APP({ app: false, offersAnswered: false }), "spellings", 'Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
  [APP({ app: false, placeholder: true }), "name", 'It needs its name before it is finished. Say "call it", then the name.'],
  [APP({ way: "hyperframes", app: false, elsewhere: true, mac: "Mac Studio" }), "open-elsewhere", "It is open on the Mac Studio. Carry on there, or open it here and take it over."],
  [APP({ way: "hyperframes", app: false, finishRunning: true }), "finish-running", "Its finish is running. The panel shows how far it is."],
  [APP({ way: "hyperframes", app: false, project: PROJECT({ last: "today at 3:41 pm" }) }), "in-app", 'Edit it in HyperFrames. Your last request there was today at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [APP({ way: "hyperframes", app: false, project: PROJECT({ exported: true }) }), "exported", 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.'],
  // In HyperFrames: the time of the last turn in the app's history when there is one.
  [APP({ way: "hyperframes", project: PROJECT({ last: "today at 3:41 pm" }) }), "in-app", 'Edit it in HyperFrames. Your last request there was today at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [APP({ way: "hyperframes", project: PROJECT({ last: "yesterday at 3:41 pm" }) }), "in-app", 'Edit it in HyperFrames. Your last request there was yesterday at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [APP({ way: "hyperframes", project: PROJECT({ last: "on Tuesday 13 October at 3:41 pm" }) }), "in-app", 'Edit it in HyperFrames. Your last request there was on Tuesday 13 October at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [APP({ way: "hyperframes", project: PROJECT() }), "in-app", 'Edit it in HyperFrames. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [APP({ way: "hyperframes", project: PROJECT(), copy: { left: 30, usual: null } }), "in-app", 'Edit it in HyperFrames. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  // Exported: before in-app, whether or not the record lists a time the app opened it.
  [APP({ way: "hyperframes", project: PROJECT({ exported: true, last: "today at 3:41 pm" }) }), "exported", 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.'],
  [APP({ way: "hyperframes", project: PROJECT({ opened: false, exported: true }) }), "exported", 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.'],
  // An iPhone clip: in HyperFrames only once the app has opened its project; before, the offer of PR 7's F5 stands.
  [CLIP({ way: "hyperframes", project: PROJECT({ last: "today at 3:41 pm" }) }), "in-app", 'Edit it in HyperFrames. Your last request there was today at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
  [CLIP({ way: "hyperframes", project: PROJECT({ exported: true }) }), "exported", 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.'],
  [CLIP({ project: PROJECT({ opened: false }) }), "clip-next", 'Open it in HyperFrames to edit it, then export it on this Mac and say "hand it off". Or say "hand it off" to hand it off as it is.'],
  [CLIP({ v2: false }), "clip-next", 'Open it in HyperFrames to edit it, then export it on this Mac and say "hand it off". Handing it off as it is waits until this Mac hands off version 2: ask Jason.'],
  [CLIP({ app: false, v2: false }), "waits-v2", V1],
  // A finish at work is said of an iPhone clip too, since it is finished from its export now.
  [CLIP({ finishRunning: true }), "finish-running", "Its finish is running. The panel shows how far it is."],
  [CLIP({ way: "hyperframes", project: PROJECT({ exported: true }), finishRunning: true }), "finish-running", "Its finish is running. The panel shows how far it is."],
  [APP({ way: "hyperframes", project: PROJECT({ exported: true }), finishRunning: true }), "finish-running", "Its finish is running. The panel shows how far it is."],
  // A video the gate holds as a session, though its kind is not one: it is told how to clear the mark, and nothing of HyperFrames or Final Cut,
  // whatever else the facts hold (plan PR 10, review I2).
  [RAW({ gated: true }), "session-mark", MARK],
  [CLIP({ gated: true }), "session-mark", MARK],
  [{ kind: "finished", gated: true }, "session-mark", MARK],
  [{ kind: "finished", gated: true, v2: false }, "session-mark", MARK],
  [RAW({ gated: true, way: "final cut", shownInFinalCut: true }), "session-mark", MARK],
  [APP({ gated: true }), "session-mark", MARK],
  [APP({ gated: true, way: "hyperframes", project: PROJECT({ exported: true, last: "today at 3:41 pm" }) }), "session-mark", MARK],
  [APP({ gated: true, copy: { left: 90, usual: 120 } }), "session-mark", MARK],
  [CLIP({ gated: true, way: "hyperframes", project: PROJECT() }), "session-mark", MARK],
  [RAW({ gated: true, reading: "running" }), "session-mark", MARK],
  [RAW({ gated: true, reading: "failed" }), "session-mark", MARK],
  [RAW({ gated: true, offersAnswered: false }), "session-mark", MARK],
  [RAW({ gated: true, placeholder: true }), "session-mark", MARK],
  // A finished video whose hand-off is written, with a Reel exported from HyperFrames that the hand-off does not hold (plan PR 16): it comes ahead
  // of the BRIMM Ops page's steps, names the Reels together, and is a finish at work's when one runs.
  [{ handoff: HANDOFF(), reelsExported: [2] }, "reels-exported", 'You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.'],
  [{ handoff: HANDOFF(), reelsExported: [1, 3] }, "reels-exported", 'You have exported Reel 1 and Reel 3 from HyperFrames. Say "hand off the Reels" to add them to the hand-off.'],
  [{ handoff: HANDOFF(), reelsExported: [1, 2, 3] }, "reels-exported", 'You have exported Reel 1, Reel 2 and Reel 3 from HyperFrames. Say "hand off the Reels" to add them to the hand-off.'],
  [{ handoff: HANDOFF(), reelsExported: [2], finishRunning: true }, "finish-running", "Its finish is running. The panel shows how far it is."],
  // The Final Cut way keeps its stages, whatever else the facts hold.
  [RAW({ way: "final cut", copy: { left: 90, usual: null } }), "show", 'Ask for any changes in your own words, then say "show it in Final Cut".'],
  [RAW({ way: "final cut", shownInFinalCut: true }), "finish", 'Trim it by hand in Final Cut. Then Share it with Command-E, and choose File > Export XML…, both into From Final Cut. Then say "finish the episode".'],
  [RAW({ way: "final cut", shownInFinalCut: true, shownSinceFinish: true, handoff: { id: "e-20261020-3fa9c1", revision: 1, kind: "raw", emptyAt: null, at: NOW, file: "Talk.mov" } }), "finish-again", 'It was shown in Final Cut again since its finish. Share it and Export XML again, then say "finish the episode".']
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

describe("the next step on the HyperFrames way (plan PR 10)", () => {
  const handoffOf = (kind) => ({ ...OPS_HANDOFF, kind });
  it("never sends a video on the HyperFrames way to Final Cut, and leaves the Final Cut way its three stages", () => {
    for (const over of [
      APP(), APP({ copy: { left: 90, usual: 120 } }), APP({ way: "hyperframes" }), APP({ way: "hyperframes", project: PROJECT() }), APP({ way: "hyperframes", project: PROJECT({ exported: true }) }),
      APP({ placeholder: true }),
      // Shown in Final Cut, before or since a finish, is nothing to a video that goes the other way.
      APP({ shownInFinalCut: true }), APP({ way: "hyperframes", project: PROJECT(), shownInFinalCut: true, shownSinceFinish: true }),
      APP({ way: "hyperframes", shownInFinalCut: true, shownSinceFinish: true, handoff: handoffOf("raw") })
    ]) {
      const n = nextFor({ ...BASE, ...over }, NONE, NOW);
      assert.doesNotMatch(n.text, /Final Cut|Share|Export XML/, JSON.stringify(over));
      assert.ok(!["show", "finish", "finish-again"].includes(n.stage), `${n.stage}: ${JSON.stringify(over)}`);
    }
    // The Final Cut way, named or not given at all, keeps all three, with whatever else the facts hold of a project.
    for (const way of ["final cut", undefined]) {
      assert.equal(nextFor({ ...BASE, ...RAW({ way }) }, NONE, NOW).stage, "show", String(way));
      assert.equal(nextFor({ ...BASE, ...RAW({ way, shownInFinalCut: true }) }, NONE, NOW).stage, "finish", String(way));
      assert.equal(nextFor({ ...BASE, ...RAW({ way, shownInFinalCut: true, shownSinceFinish: true, handoff: handoffOf("raw") }) }, NONE, NOW).stage, "finish-again", String(way));
    }
    // An iPhone clip, a finished video and a session never had them.
    for (const over of [CLIP(), CLIP({ way: "hyperframes", project: PROJECT() }), { kind: "finished", way: "finished" }]) assert.doesNotMatch(nextFor({ ...BASE, ...over }, NONE, NOW).text, /Final Cut/, JSON.stringify(over));
  });
  it("shows none of the new stages once a hand-off is written: the BRIMM Ops page's step comes, as it did", () => {
    for (const [over, kind] of [
      [APP({ way: "hyperframes", project: PROJECT({ exported: true }) }), "raw"], [APP({ way: "hyperframes", project: PROJECT() }), "raw"], [APP({ copy: { left: 5, usual: null } }), "raw"],
      [CLIP({ way: "hyperframes", project: PROJECT({ exported: true }) }), "short video"], [CLIP({ copy: { left: 5, usual: null } }), "short video"]
    ]) {
      const n = nextFor({ ...BASE, ...over, handoff: handoffOf(kind) }, NONE, NOW);
      assert.deepEqual([n.stage, n.step], ["ops", "taken"], JSON.stringify(over));
    }
  });
  it("says on a Mac whose settings have the app off what `app` says there, in the words `app` has, and that is no stage to wait for (plan PR 17; the review of PR 10, M2)", () => {
    assert.equal(APP_NOT_SET_UP, APP_SAYS);
    assert.equal(APP_NOT_SET_UP, APP_OFF);
    assert.ok(!COMING.includes("app-off"));
    // A video of the HyperFrames way is told to open it where this Mac is set up for the app, and where it is not that it is not.
    for (const over of [APP(), APP({ way: "hyperframes" }), APP({ way: "hyperframes", project: PROJECT({ opened: false }) }), APP({ copy: { left: 90, usual: null } }), CLIP({ way: "hyperframes" })]) {
      const on = nextFor({ ...BASE, ...over, app: true }, NONE, NOW);
      const off = nextFor({ ...BASE, ...over, app: false }, NONE, NOW);
      assert.ok(["making-copy", "open-app"].includes(on.stage), `${on.stage}: ${JSON.stringify(over)}`);
      assert.deepEqual([off.stage, off.text], ["app-off", APP_OFF], JSON.stringify(over));
      assert.doesNotMatch(off.text, /open it in HyperFrames/);
    }
    // A hand-off written is the BRIMM Ops page's step on either Mac: the page needs no app.
    const written = nextFor({ ...BASE, ...APP({ way: "hyperframes", app: false }), handoff: handoffOf("raw") }, NONE, NOW);
    assert.deepEqual([written.stage, written.step], ["ops", "taken"]);
  });
  it("puts the reading, the spellings and a raw video's name before the new stages, and a conflict, her answer and the other Mac's claim before them all", () => {
    const copying = { copy: { left: 90, usual: null }, project: null };
    const stages = (over) => nextFor({ ...BASE, ...APP({ ...copying, ...over }) }, NONE, NOW).stage;
    assert.equal(stages({}), "making-copy");
    assert.equal(stages({ placeholder: true }), "name");
    assert.equal(stages({ offersAnswered: false }), "spellings");
    assert.equal(stages({ reading: "failed" }), "reading-failed");
    assert.equal(stages({ reading: "running" }), "reading");
    assert.equal(stages({ elsewhere: true, mac: "Mac Studio" }), "open-elsewhere");
    assert.equal(stages({ conflicted: true }), "conflicted");
    assert.equal(stages({ finishRunning: true }), "finish-running");
  });
  it("tells a video the gate holds as a session how to clear the mark, with nothing of HyperFrames or Final Cut, after a written hand-off's steps and before the reading's", () => {
    for (const over of [RAW({ gated: true }), CLIP({ gated: true }), { kind: "finished", gated: true }, APP({ gated: true, way: "hyperframes", project: PROJECT({ exported: true }) }), RAW({ gated: true, shownInFinalCut: true, way: "final cut" })]) {
      const n = nextFor({ ...BASE, ...over }, NONE, NOW);
      assert.deepEqual([n.stage, n.text], ["session-mark", MARK], JSON.stringify(over));
      assert.doesNotMatch(n.text, /HyperFrames|Final Cut/);
    }
    // A conflict, her answer, the other Mac's claim and a finish at work come first, as they do for every video.
    assert.equal(nextFor({ ...BASE, ...RAW({ gated: true, conflicted: true }) }, NONE, NOW).stage, "conflicted");
    assert.equal(nextFor({ ...BASE, ...RAW({ gated: true, elsewhere: true, mac: "Mac Studio" }) }, NONE, NOW).stage, "open-elsewhere");
    assert.equal(nextFor({ ...BASE, ...RAW({ gated: true, finishRunning: true }) }, NONE, NOW).stage, "finish-running");
    // A hand-off written is the BRIMM Ops page's step, as it was.
    const written = nextFor({ ...BASE, ...RAW({ gated: true }), handoff: handoffOf("raw") }, NONE, NOW);
    assert.deepEqual([written.stage, written.step], ["ops", "taken"]);
    // A session is a session's: its own steps, not this one.
    assert.notEqual(nextFor({ ...BASE, ...SESSION({ choice: null }), gated: true }, NONE, NOW).stage, "session-mark");
  });
  it("is the same for a Reel's project: a project here is the main video's, and a copy at work beside it is not said", () => {
    assert.equal(nextFor({ ...BASE, ...APP({ way: "hyperframes", project: PROJECT(), copy: { left: 90, usual: null } }) }, NONE, NOW).stage, "in-app");
  });
});

describe("the next step for a finished video's Reels (plan PR 16)", () => {
  const REEL_2 = 'You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.';
  const FINISHED_BY_HER = { ...NONE, finished: { [BASE.id]: "2026-10-24T09:00:00-05:00" } };
  const noted = (step, revision = 1) => ({ ...NONE, handoffs: { [OPS_HANDOFF.id]: { kind: "episode", step, revision, at: "2026-10-24T09:00:00-05:00" } } });
  /** A finished video with its hand-off written and a Reel exported from HyperFrames that the hand-off does not hold. */
  const waiting = (over = {}) => ({ ...BASE, handoff: OPS_HANDOFF, reelsExported: [2], ...over });
  it("comes ahead of every step on the BRIMM Ops page, of the step that comes back for a newer revision, and of done", () => {
    const sixty = OPS_HANDOFF.at + 60 * 86400000;
    for (const [what, facts, notes, now] of [
      ["no step noted", waiting(), NONE, NOW],
      ["taken", waiting(), noted("taken"), NOW],
      ["kit", waiting(), noted("kit"), NOW],
      ["posted", waiting(), noted("posted"), NOW],
      ["live", waiting(), noted("live"), NOW],
      ["every step noted", waiting(), noted("cascade"), NOW],
      ["a newer revision, taken again", waiting({ handoff: { ...OPS_HANDOFF, revision: 2 } }), noted("kit"), NOW],
      ["a hand-off 61 days old", waiting(), NONE, sixty + 1],
      ["a hand-off 61 days old with every step noted", waiting(), noted("cascade"), sixty + 1]
    ]) assert.deepEqual(shown(nextFor(facts, notes, now)), { stage: "reels-exported", text: REEL_2 }, what);
    // Its words are not a step of the page's: they note none, and show nothing.
    const n = nextFor(waiting(), NONE, NOW);
    assert.deepEqual([n.done, n.step, n.after], [false, "", ""]);
  });
  it("has the page's steps back once the Reels are in the hand-off, or when none is exported", () => {
    for (const over of [{ reelsExported: [] }, { reelsExported: undefined }, { reelsExported: null }]) {
      const n = nextFor(waiting(over), NONE, NOW);
      assert.deepEqual([n.stage, n.step], ["ops", "taken"], JSON.stringify(over));
    }
    const again = nextFor(waiting({ reelsExported: [], handoff: { ...OPS_HANDOFF, revision: 2 } }), noted("kit"), NOW);
    assert.deepEqual([again.stage, again.step, again.text], ["ops", "taken", `On the BRIMM Ops page: ${OPS_TEXTS.takenAgain}`]);
  });
  it("comes after a drop folder, a conflict, her answer and a version held as a session, as every stage of a video does", () => {
    for (const [over, stage] of [[{ conflicted: true }, "conflicted"], [{ kind: null, waiting: true }, "waiting"], [{ heldAsSession: true }, "held-session"]]) {
      assert.equal(nextFor(waiting(over), NONE, NOW).stage, stage, JSON.stringify(over));
    }
    assert.equal(nextFor({ ...waiting(), ...DROP(), handoff: null }, NONE, NOW).stage, "arriving");
  });
  it("is not ahead of her word that the video is finished: it stays done, and she can set the video aside (ruling 1)", () => {
    assert.deepEqual(nextFor(waiting(), FINISHED_BY_HER, NOW), { done: true });
    assert.deepEqual(nextFor(waiting({ reelsExported: [1, 2] }), { ...FINISHED_BY_HER, handoffs: noted("kit").handoffs }, NOW), { done: true });
    // The stage is not one that nothing noted can skip: her word is taken while a Reel waits.
    assert.equal(nextFor(waiting(), NONE, NOW).done, false);
  });
  it("is not said when the gate holds the video, when the other Mac has it open, or when no hand-off is written", () => {
    // A video the gate holds as a session keeps the page's step of a hand-off that is written, as it did, and is told nothing of Reels.
    const held = nextFor(waiting({ gated: true }), NONE, NOW);
    assert.deepEqual([held.stage, held.step], ["ops", "taken"]);
    const away = nextFor(waiting({ elsewhere: true, mac: "Mac Studio" }), NONE, NOW);
    assert.deepEqual([away.stage, away.step], ["ops", "taken"]);
    const none = nextFor(waiting({ handoff: null }), NONE, NOW);
    assert.equal(none.stage, "handoff-owed");
    assert.equal(nextFor(waiting({ handoff: null, offersAnswered: false }), NONE, NOW).stage, "spellings");
  });
  it("names only whole Reel numbers: what is no number in the fact is left out, and none left is no stage (review F7)", () => {
    assert.deepEqual(shown(nextFor(waiting({ reelsExported: [2, "3", null, 1.5, NaN, undefined, {}] }), NONE, NOW)), { stage: "reels-exported", text: REEL_2 });
    for (const none of [["x"], [null, undefined], [1.5, NaN], "2", { 0: 2, length: 1 }]) {
      const n = nextFor(waiting({ reelsExported: none }), NONE, NOW);
      assert.deepEqual([n.stage, n.step], ["ops", "taken"], JSON.stringify(none));
    }
  });
  it("is a finished video's alone: a raw video, an iPhone clip and a session ignore it", () => {
    for (const over of [
      APP({ way: "hyperframes", project: PROJECT(), handoff: { ...OPS_HANDOFF, kind: "raw" } }),
      CLIP({ way: "hyperframes", project: PROJECT(), handoff: { ...OPS_HANDOFF, kind: "short video" } }),
      { ...SESSION(), handoff: { ...OPS_HANDOFF, kind: "session" } }
    ]) {
      const n = nextFor({ ...BASE, ...over, reelsExported: [2] }, NONE, NOW);
      assert.notEqual(n.stage, "reels-exported", JSON.stringify(over));
    }
  });
  it("is a finish at work's stage while one runs, where a Reel waits, and the page's step where none does (ruling 4)", () => {
    const running = nextFor(waiting({ finishRunning: true }), NONE, NOW);
    assert.deepEqual(shown(running), { stage: "finish-running", text: "Its finish is running. The panel shows how far it is." });
    const quiet = nextFor(waiting({ finishRunning: true, reelsExported: [] }), NONE, NOW);
    assert.deepEqual([quiet.stage, quiet.step], ["ops", "taken"]);
  });
  it("needs nothing of the guide's waits: it is not among the stages something is on its way at, and a video passing from it to the page's step is a change", () => {
    assert.ok(!COMING.includes("reels-exported"));
    const at = (over) => ({ facts: waiting(over), next: nextFor(waiting(over), NONE, NOW), folder: null, record: null });
    assert.notEqual(signatureOf([at({})]), signatureOf([at({ reelsExported: [] })]));
    assert.equal(signatureOf([at({})]), signatureOf([at({ reelsExported: [1, 2] })]));
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
  it("give the working copy's time from the speed progress.js learned for its step, and none while the speed or the length is not known", () => {
    assert.equal(COPY_STEP, "Making the video for HyperFrames");
    assert.equal(COPY_STEP, WORK_COPY_STEP);
    assert.equal(copyIn({ [COPY_STEP]: 0.1 }, 2400), 240);
    assert.equal(copyIn({ [COPY_STEP]: 0.0999 }, 2400), 240);
    assert.equal(copyIn({ [COPY_STEP]: 0.1, "Asking Claude": 0.31 }, 600), 60);
    for (const [rates, seconds] of [[{}, 2400], [{ [COPY_STEP]: 0.1 }, undefined], [{ [COPY_STEP]: 0.1 }, 0], [{ [COPY_STEP]: 0.1 }, -5], [{ [COPY_STEP]: 0 }, 2400], [{ [COPY_STEP]: "fast" }, 2400], [{ [COPY_STEP]: null }, 2400], [{ "Asking Claude": 0.31 }, 2400]]) assert.equal(copyIn(rates, seconds), null, JSON.stringify([rates, seconds]));
    // The reading's two steps are as they were: the rough cut is made until wave 2 stops the reading making one.
    assert.deepEqual(READING_STEPS, ["Asking Claude", "Making the rough cut"]);
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
  it("waits only while a video is coming in, being imported, being read or having its video for HyperFrames made", () => {
    assert.deepEqual(COMING, ["arriving", "importing", "reading-later", "reading", "session-reading", "making-copy"]);
  });
  it("sees a video pass from the video for HyperFrames being made to its being opened, and not the time left", () => {
    const at = (over) => ({ facts: { ...BASE, ...APP(over) }, next: nextFor({ ...BASE, ...APP(over) }, NONE, NOW), folder: null, record: null });
    const making = signatureOf([at({ copy: { left: 90, usual: 120 } })]);
    assert.equal(signatureOf([at({ copy: { left: 30, usual: null } })]), making);
    assert.notEqual(signatureOf([at({})]), making);
    assert.notEqual(signatureOf([at({ way: "hyperframes", project: PROJECT() })]), signatureOf([at({})]));
    assert.notEqual(signatureOf([at({ way: "hyperframes", project: PROJECT({ exported: true }) })]), signatureOf([at({ way: "hyperframes", project: PROJECT() })]));
  });
});

describe("what guide tell says", () => {
  const JANE = { mac: "Mac Studio", file: "Client Jane.mov", bytes: 5 };
  const at = (facts) => ({ facts, next: nextFor(facts, NONE, NOW), folder: null, record: null });
  const arriving = at({ ...BASE, id: "", name: "A video of 5 bytes", source: JANE, ...DROP() });
  const importing = at({ ...arriving.facts, name: "Video of 20 Oct, 15:00 (Mac Studio)", aliases: ["Video of 20 Oct, 15:00 (Mac Studio)"], ...DROP({ state: "importing", step: "Reading the sound" }) });
  const retry = at({ ...arriving.facts, ...DROP({ state: "retry" }) });
  const waiting = at({ ...BASE, name: "Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1)", kind: null, waiting: true, reading: "none", source: JANE });
  const reading = at({ ...BASE, reading: "none" });
  const later = at({ ...BASE, ...RAW({ reading: "later", readsAt: "10:58" }) });
  const read = at({ ...BASE, offersAnswered: false });
  const failed = at({ ...BASE, reading: "failed" });
  const sessionReading = at({ ...BASE, ...SESSION(), reading: "running" });
  const sessionRead = at({ ...BASE, ...SESSION({ undecided: 2 }) });
  const ops = at({ ...BASE, handoff: OPS_HANDOFF });
  const done = at({ ...BASE, ...SESSION({ choice: "transcript only" }) });
  it("waits up to 60 minutes, looking every 15 seconds, and follows a video from its drop folder into Episodes by its file, which it never says", () => {
    assert.deepEqual([TELL_MS, TELL_POLL_MS], [3600000, 15000]);
    const ep = at({ ...BASE, id: "e-20261020-aaaaaa", source: JANE, at: 2 });
    const older = at({ ...BASE, id: "e-20261014-bbbbbb", source: JANE, at: 1 });
    const ID = "e-20261020-aaaaaa";
    assert.deepEqual(trailOf(arriving.facts), { ...JANE, growing: true, came: 0 });
    assert.deepEqual(trailOf(importing.facts), { ...JANE, growing: false, came: 0 });
    assert.deepEqual(trailOf(ep.facts), { id: ID, ...JANE });
    assert.deepEqual(trailOf(reading.facts), { id: BASE.id });
    // In a drop folder by its Mac and file, whose size grows while it comes in.
    const grown = at({ ...arriving.facts, source: { ...JANE, bytes: 9 } });
    assert.deepEqual(follow(trailOf(arriving.facts), [ep, grown]), { item: grown, trail: { ...JANE, bytes: 9, growing: true, came: 0 } });
    // Out of it, by the newest answered video that holds a file of that name and size; then by its id, with its file.
    assert.deepEqual(follow(JANE, [older, ep]), { item: ep, trail: { id: ID, ...JANE } });
    assert.equal(follow({ ...JANE, bytes: 9 }, [older, ep]), null);
    // A file still coming in when last seen may grow and be filed before the next look: then a larger one, filed since it came.
    const ep9 = at({ ...ep.facts, source: { ...JANE, bytes: 9 } });
    assert.deepEqual(follow({ ...JANE, growing: true, came: 2 }, [older, ep9]), { item: ep9, trail: { id: ID, ...JANE, bytes: 9 } });
    assert.equal(follow({ ...JANE, bytes: 9, growing: true, came: 0 }, [ep]), null);
    assert.equal(follow({ ...JANE, growing: true, came: 2 }, [at({ ...older.facts, source: { ...JANE, bytes: 9 } })]), null);
    // A file of that name in the other Mac's drop folder is another video.
    assert.equal(follow({ ...JANE, mac: "Sallie's laptop" }, [grown]), null);
    assert.deepEqual(follow({ id: ID, ...JANE }, [older, ep]), { item: ep, trail: { id: ID, ...JANE } });
    assert.deepEqual(follow({ id: ID }, [older, ep]), { item: ep, trail: { id: ID } });
    assert.equal(follow({ id: "e-20261020-cccccc" }, [ep]), null);
    // By its id, until the import of its file, at its size, did not finish: then by that file in its drop folder.
    assert.deepEqual(follow({ id: ID, ...JANE }, [ep, retry]), { item: retry, trail: { id: ID, ...JANE } });
    assert.equal(follow({ id: ID, ...JANE }, [ep, arriving]).item, ep);
    assert.equal(follow({ id: ID, ...JANE }, [ep, at({ ...retry.facts, source: { ...JANE, bytes: 9 } })]).item, ep);
    assert.equal(follow({ id: ID }, [ep, retry]).item, ep);
  });
  it("says in one line that it is ready, that Claude has read it, or its next step; and nothing while it is still on its way", () => {
    for (const [was, seen, now, want] of [
      [arriving, arriving, arriving, null],
      [arriving, arriving, importing, null],
      [later, later, reading, null],
      [arriving, importing, null, 'Video of 20 Oct, 15:00 (Mac Studio) is not under way any more. Say "what\'s next?" to see the ones that are.'],
      [importing, importing, waiting, 'Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1): It is ready. It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
      [importing, importing, reading, 'Pricing talk (3fa9c1): It is ready. Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
      [importing, importing, retry, 'A video of 5 bytes: Its import did not finish. Say "try it again".'],
      [reading, reading, read, 'Pricing talk (3fa9c1): Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
      [sessionReading, sessionReading, sessionRead, 'Pricing talk (3fa9c1): Claude has read it. Keep, drop or change each of its principles and Reel ideas. Say "show me the principles".'],
      [reading, reading, failed, 'Pricing talk (3fa9c1): Claude\'s reading of it did not finish. Say "how far is it?" to see why.'],
      // Nothing on its way: its next step at once, as the guide says it.
      [waiting, waiting, waiting, 'Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1): It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
      [read, read, read, 'Pricing talk (3fa9c1): Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
      [ops, ops, ops, 'Pricing talk (3fa9c1): On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".'],
      [retry, retry, retry, 'A video of 5 bytes: Its import did not finish. Say "try it again".'],
      [done, done, done, "Pricing talk (3fa9c1) is done: nothing is left to do for it."]
    ]) assert.equal(told(was, seen, now), want, JSON.stringify([was.next.stage, now && now.next.stage]));
    assert.equal(stillLine(arriving), 'A video of 5 bytes: It is still on its way after 60 minutes. It is coming into your drop folder. Wait for the "Ready" notice.');
  });
  it("keeps waiting while the video for HyperFrames is made, and says the next step in one line when it is done", () => {
    const making = at({ ...BASE, ...APP({ copy: { left: 90, usual: null } }) });
    const later = at({ ...BASE, ...APP({ copy: { left: 30, usual: null } }) });
    const open = at({ ...BASE, ...APP() });
    const editing = at({ ...BASE, ...APP({ way: "hyperframes", project: PROJECT({ last: "today at 3:41 pm" }) }) });
    const stage = (item) => item.next.stage;
    assert.deepEqual([making, later, open, editing].map(stage), ["making-copy", "making-copy", "open-app", "in-app"]);
    for (const [was, seen, now, want] of [
      [making, making, making, null],
      [making, making, later, null],
      [making, later, open, 'Pricing talk (3fa9c1): Say "open it in HyperFrames" to edit it there.'],
      [making, making, editing, 'Pricing talk (3fa9c1): Edit it in HyperFrames. Your last request there was today at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
      [making, making, null, 'Pricing talk (3fa9c1) is not under way any more. Say "what\'s next?" to see the ones that are.'],
      // A video with nothing on its way gets its next step at once.
      [open, open, open, 'Pricing talk (3fa9c1): Say "open it in HyperFrames" to edit it there.'],
      [editing, editing, editing, 'Pricing talk (3fa9c1): Edit it in HyperFrames. Your last request there was today at 3:41 pm. When you are done, export it on This Mac, as MP4, then say "hand it off".']
    ]) assert.equal(told(was, seen, now), want, JSON.stringify([stage(was), stage(seen), now && stage(now)]));
    // Past an hour it is still on its way, with its step.
    assert.equal(stillLine(making), 'Pricing talk (3fa9c1): It is still on its way after 60 minutes. The video for HyperFrames is being made, about 2 minutes left. Say "open it in HyperFrames" when it is done.');
    // It is followed by its id, as every video in Episodes is.
    assert.deepEqual(trailOf(making.facts), { id: BASE.id });
  });
});
