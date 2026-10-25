// The guide's steps on the BRIMM Ops page, her note's rules for them, and the Finder words it says. None of it needs a disk, a
// program or the page.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OPS, OPS_PAGE, NOT_SET_UP, ZOOM_WORDS, dropWords, noteKindOf, opsNext, noteAfter, opsText } from "../guide.js";

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
