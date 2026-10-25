// The guide in her Claude folder (spec 2026-10-25): where a video has got, from her drop folder to the BRIMM Ops page's cascade,
// and the one next step for it, in her own words. brimm-video cannot see the BRIMM Ops page, so her note on this Mac keeps the
// steps she has done there, by the hand-off's id.
// Everything here is pure: it reads and writes nothing, and edit.js gives it what it read.

/** The BRIMM Ops page, which `guide page` opens in her browser. */
export const OPS_PAGE = "https://claude.ai/artifact/GCUQPLnSFWZe3VghyaKNtX";

/** All that every form of `guide` says, and does, on a Mac still on the old import. There Claude reads every video as it lands,
    a session's whole words too, so the guide never sends her to that drop folder. */
export const NOT_SET_UP = "This Mac isn't set up for the guide yet: ask Jason.";

/** A folder as she finds it in Finder: each folder on the way to it, after the one it is in. */
const finderWords = (...folders) => folders.join(" › ");

/** This Mac's drop folder in Finder words, from the drop folder its settings name (settings.drop) and the Mac's name:
    "Dropbox › The BRIMM DB › BRIMM Video › Drop › Sallie's laptop". On a Mac whose settings name none, it is still the old
    folder, Unedited Video. */
export const dropWords = (drop, machine) => finderWords("Dropbox", "The BRIMM DB", "BRIMM Video", drop || "Unedited Video", machine);

/** Where a Zoom download goes, in Finder words: Zoom Video Transfer, in BRIMM VIDEO Transfer, beside BRIMM Video. */
export const ZOOM_WORDS = finderWords("Dropbox", "The BRIMM DB", "BRIMM VIDEO Transfer", "Zoom Video Transfer");

/** The BRIMM Ops page's steps, in order, by what the hand-off is: a finished or raw episode, an iPhone clip (a short video), or a
    session. The withdrawal is the one step of a video that was a session after all: its empty session revision dropped on
    Principles, to withdraw the words the page had, then the old backups deleted. It comes before the session's own steps, and
    its list is here so that a step her note holds can be checked against it. */
export const OPS = {
  episode: ["taken", "kit", "posted", "live", "cascade"],
  "short video": ["taken", "posttext", "posted"],
  session: ["taken", "checked"],
  withdrawal: ["withdrawn"]
};

/** What her note keeps a hand-off as, which picks its steps: "episode" for a finished or a raw one, and otherwise its own kind,
    "short video" or "session". */
export const noteKindOf = (kind) => (kind === "finished" || kind === "raw" ? "episode" : kind);

/** A hand-off, as edit.js reads it for the guide: { id, revision, kind, emptyAt, at, file }. `id` is the id it goes out under,
    `revision` its number, and `kind` "finished", "raw", "short video" or "session". `emptyAt` is, for a session, the revision
    that was its empty one (session.emptyRevision), and null for anything else. `at` is when it was written (ms), and `file` its
    main video's file (main.file), "" for a session.
    Her note on it: { kind, step, revision, at }. `kind` is what the note keeps it as (noteKindOf), `step` the furthest step she
    has done, `revision` the revision she last took, and `at` when she said so (localStamp). */

/** Whether the withdrawal of a session after all is noted: by a session's note that holds the withdrawal at or after the empty
    revision, or that is for a revision after it, which a note can only come to through the withdrawal. */
const withdrawn = (handoff, note) =>
  Boolean(note) && note.kind === "session" && ((note.step === "withdrawn" && note.revision >= handoff.emptyAt) || note.revision > handoff.emptyAt);

/** The step her note holds, as the hand-off's steps count it, or null when the note does not count. It counts only for the same
    kind of hand-off, with one of that kind's steps. A noted withdrawal counts as the session taken at its revision: the page's
    "Withdraw the words and take the session" takes the session it was dropped with. */
function notedStep(handoff, note) {
  const family = noteKindOf(handoff.kind);
  if (!note || note.kind !== family) return null;
  if (OPS[family].includes(note.step)) return note.step;
  return family === "session" && note.step === "withdrawn" ? "taken" : null;
}

/** The BRIMM Ops page's next step for a hand-off, from her note on it: { step, again }, `again` when it is taken again for a
    newer revision. Null when every step is noted.
    A session after all has its withdrawal first, whatever is noted and whatever revision the hand-off is at, until it is noted;
    at its empty revision itself there is nothing more for the page, as the session's own steps are brimm-video's until its own
    hand-off is written. Otherwise a note that does not count (none, or one of another kind of hand-off) starts the steps again at
    the first; a revision newer than the one noted brings back "taken", again; and after that comes the step after the one
    noted. */
export function opsNext(handoff, note) {
  if (Number.isInteger(handoff.emptyAt)) {
    if (!withdrawn(handoff, note)) return { step: "withdrawn", again: false };
    if (handoff.revision === handoff.emptyAt) return null;
  }
  const steps = OPS[noteKindOf(handoff.kind)];
  const done = notedStep(handoff, note);
  if (done === null) return { step: steps[0], again: false };
  if (handoff.revision > note.revision) return { step: "taken", again: true };
  const after = steps[steps.indexOf(done) + 1];
  return after ? { step: after, again: false } : null;
}

/** Her note once she has done `step` for a hand-off, at `at` (localStamp). The withdrawal is noted at the hand-off's revision.
    "taken" again keeps the further step of a note that counts, at the new revision, so that the steps after it stay as noted (a
    noted withdrawal, which counts as taken, is written as taken). Any other step is noted at the revision of a note that counts,
    or the hand-off's when there is none. */
export function noteAfter(handoff, note, step, at) {
  if (step === "withdrawn") return { kind: "session", step, revision: handoff.revision, at };
  const kind = noteKindOf(handoff.kind);
  const done = notedStep(handoff, note);
  if (step === "taken") return { kind, step: done ?? step, revision: handoff.revision, at };
  return { kind, step, revision: done === null ? handoff.revision : note.revision, at };
}

/** What follows taking a raw episode, which was edited in Final Cut: freeing the space its folder takes on this Mac. */
const ONLINE_ONLY = ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".';

/** Each step in the page's own words, by what the hand-off is (noteKindOf) where it matters. The labels are the page's own
    buttons and cards. */
const SAYS = {
  taken: (family, again) =>
    family === "session"
      ? `Choose "Principles", drop the ${again ? "new " : ""}hand-off, then press "Take the session".`
      : again
        ? 'Drag the new hand-off onto the same episode, then press "Take the hand-off".'
        : 'Drag the hand-off onto Episodes, then press "Take the hand-off".',
  kit: () => 'Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.',
  posted: (family) =>
    family === "short video"
      ? "Post it on Instagram, and as a YouTube Short."
      : 'Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".',
  live: () => 'Correct the form to what is live, then press "This is what is live".',
  cascade: () =>
    'Press "Write what’s next". Approve and copy the newsletter section, then the Instagram pieces, then the LinkedIn posts. The ideas for YouTube are suggestions for YouTube Studio. Cut each "Clip to cut" in OpusClip. Then make it a short video with "New short video from a clip", on the episode\'s "Reels" card.',
  posttext: () => 'Press "Write what’s next", and pick the hook and the YouTube Short title. Approve and copy the caption, the Short\'s title and description, and the LinkedIn post.',
  checked: () => 'Check each principle marked "Check it", then press "Use in drafts".',
  // "the hand-off", not "the empty session revision": once the session's own hand-off is written, final/ holds that one in its place.
  withdrawn: () => 'Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.'
};

/** A BRIMM Ops step for a hand-off, in the page's own words: `again` when it is taken again for a newer revision. Taking a raw
    episode ends with freeing its space in Dropbox. */
export function opsText(handoff, step, again) {
  const family = noteKindOf(handoff.kind);
  const text = SAYS[step](family, again);
  return step === "taken" && handoff.kind === "raw" ? text + ONLINE_ONLY : text;
}
