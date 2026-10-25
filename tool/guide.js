// The guide in her Claude folder (spec 2026-10-25): where a video has got, from her drop folder to the BRIMM Ops page's cascade,
// and the one next step for it, in her own words. brimm-video cannot see the BRIMM Ops page, so her note on this Mac keeps the
// steps she has done there, by the hand-off's id.
// Everything here is pure: it reads and writes nothing, and edit.js gives it what it read.
import { spokenMac } from "./kinds.js";
import { aboutLeft } from "./progress.js";

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

/** What edit.js reads of a video for the guide (VideoFacts):
    - `name`, as the lists name it; `id`, its record's id ("" for a file in a drop folder); `aliases`, the other words that find
      it (its label, its id, its short id); `at`, when it came (ms); and `mac`, the other Mac's name, where it is held or open
      there ("" otherwise).
    - `drop`, for a file in a drop folder, and null for anything else: { here, state, step, left, total }. `here` is true for this
      Mac's drop folder. `state` is "arriving", "importing", "retry" (its import did not finish) or "zoom" (a Zoom download held
      there). `step` is the panel's step, and `left` and `total` the seconds left of it and in all, null when not known.
    - `conflicted`, when Dropbox kept two copies of a change to it; `kind`, "finished", "raw", "short video", "session", or null
      before she has answered; `waiting`, for her answer; `heldAsSession`, when one of its other versions is a session after all;
      `elsewhere`, when it is open, or being answered, on the other Mac; `readingsOff`, when this Mac reads none.
    - `reading`: "done", "running", "failed", "later" (at `readsAt`, once the import has checked its copies) or "none".
      `offersAnswered`, once the spellings card is answered; `v2`, when this Mac hands off version 2.
    - For a raw video: `placeholder`, while its name is still to be given; `shownInFinalCut`; `finishRunning`; and
      `shownSinceFinish`, when it was shown in Final Cut again since its finish.
    - `session`, for a session, and null for anything else: { choice, teachingsOn, undecided, emptyOwed }. `choice` is null until
      she chooses, then "asked" (its teachings) or "transcript only"; `teachingsOn`, when this Mac can read teachings;
      `undecided`, how many of its items she has still to keep, drop or change; `emptyOwed`, when it was a session after all and
      its empty revision is still to be written.
    - `handoff`, its newest hand-off (as opsNext reads it), or null.
    Her notes on this Mac (Notes): { version: 1, handoffs, finished }: her note on each hand-off, by the hand-off's id, and when
    she said each video was finished (localStamp), by its record's id.
    The next step (Next): { done: true }, or { done: false, stage, text, step, after }. `stage` names where it has got, `text` is
    the step in her words, `step` the BRIMM Ops step's word ("" for any other), and `after` what comes once that step is noted
    ("" when nothing does).
    A video in the guide's lists (Item): { facts, next, folder, record }, its folder and record as edit.js read them, or null. */

/** How long a hand-off stays under way while its BRIMM Ops steps are not all noted: 60 days after it was written. */
export const OLD_DAYS = 60;
const DAY_MS = 86400000;

/** What the overview says with no video under way. */
export const NOTHING_UNDER_WAY = "Nothing is under way. To start, put the video in your drop folder.";
/** What the guide says when no video fits what she said. It never says her words again: they may hold a client's name. */
export const NO_FIT = 'No video under way fits that. Say "what\'s next?" to see the ones that are.';

/** Steps said at more than one stage. */
const READING_FAILED = 'Claude\'s reading of it did not finish. Say "how far is it?" to see why.';
const WAITS_V2 = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
const TEACHINGS_OFF = "Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.";

/** A step that is brimm-video's, or hers, and not the BRIMM Ops page's. */
const toDo = (stage, text) => ({ done: false, stage, text, step: "", after: "" });

/** The step for a file in a drop folder. One in the other Mac's waits on that Mac: its "Ready" notice, or its "try it again". */
function dropNext(drop, mac) {
  const on = drop.here ? "" : ` on ${spokenMac(mac)}`;
  const there = drop.here ? "" : " on that Mac";
  const ready = `Wait for the "Ready" notice${there}.`;
  if (drop.state === "arriving") return toDo("arriving", `${drop.here ? "It is coming into your drop folder." : `It is in the drop folder of ${spokenMac(mac)}.`} ${ready}`);
  if (drop.state === "importing") {
    const left = drop.total != null ? `${aboutLeft(drop.total)} left in all` : drop.left != null ? `${aboutLeft(drop.left)} left of this step` : "";
    return toDo("importing", `It is being imported${on}${drop.step ? `, at ${drop.step}` : ""}${left ? `, ${left}` : ""}. ${ready}`);
  }
  if (drop.state === "retry") return toDo("retry", `Its import did not finish${on}. Say "try it again"${there}.`);
  // A Zoom download. On the other Mac the place it goes is a sentence of its own, to keep each under 25 words.
  return toDo("zoom", drop.here ? `It is a Zoom download, and those go in ${ZOOM_WORDS}. Move it there in Finder.` : `It is a Zoom download${on}. Those go in ${ZOOM_WORDS}. Move it there in Finder${there}.`);
}

/** The BRIMM Ops page's next step for a video's hand-off, in the page's words, with what comes once it is noted. Null when every
    step is noted. Done when the hand-off was written more than OLD_DAYS ago, except for a withdrawal, which stays under way until
    it is noted: until then the page keeps a session's words. Once the withdrawal is noted at the empty revision, what comes is
    the session's own next step, which is brimm-video's. */
function opsStep(facts, notes, now) {
  const handoff = facts.handoff;
  const note = notes.handoffs[handoff.id];
  const next = opsNext(handoff, note);
  if (!next) return null;
  if (next.step !== "withdrawn" && now - handoff.at > OLD_DAYS * DAY_MS) return { done: true };
  const noted = { ...notes, handoffs: { ...notes.handoffs, [handoff.id]: noteAfter(handoff, note, next.step, "") } };
  const then = opsNext(handoff, noted.handoffs[handoff.id]);
  const own = !then && handoff.revision === handoff.emptyAt ? nextFor(facts, noted, now) : null;
  const after = then ? opsText(handoff, then.step, then.again) : own && !own.done ? own.text : "";
  return { done: false, stage: "ops", text: `On the BRIMM Ops page: ${opsText(handoff, next.step, next.again)}`, step: next.step, after };
}

/** The next step for a session. Its hand-off's BRIMM Ops steps come first, so that the withdrawal of a session after all comes
    before anything else of it, transcript only included. At its empty revision, once the withdrawal is noted, its own steps
    follow, until its own hand-off is written. */
function sessionNext(facts, notes, now) {
  const session = facts.session;
  if (session.emptyOwed) return toDo("session-empty-owed", 'Say "it was a session after all" again: its empty revision for the BRIMM Ops page is still to be written.');
  if (facts.handoff) {
    const ops = opsStep(facts, notes, now);
    if (ops) return ops;
    if (facts.handoff.revision !== facts.handoff.emptyAt) return { done: true };
  }
  if (session.choice === "transcript only") return { done: true };
  if (session.choice === null) return session.teachingsOn ? toDo("session-choice", "Choose what you want from it: its teachings, or the transcript only.") : toDo("session-off", TEACHINGS_OFF);
  if (facts.elsewhere) return toDo("open-elsewhere", `It is open on ${spokenMac(facts.mac)}. Carry on there.`);
  const reading = toDo("session-reading", 'Claude is reading its teachings. A notice comes when it is done; then say "what did Claude find?".');
  if (facts.reading === "running") return reading;
  if (facts.reading !== "done") return !session.teachingsOn ? toDo("session-off", TEACHINGS_OFF) : facts.reading === "failed" ? toDo("reading-failed", READING_FAILED) : reading;
  if (session.undecided > 0) return toDo("session-decide", 'Keep, drop or change each of its principles and Reel ideas. Say "show me the principles".');
  if (!facts.v2) return toDo("waits-v2", WAITS_V2);
  return toDo("session-done", 'Every item is decided. Say "done" to write its hand-off.');
}

/** The next step for a finished episode, a raw one or a short video: Claude's reading, the spellings, a raw video's edit and
    finish, then its hand-off's BRIMM Ops steps. */
function videoNext(facts, notes, now) {
  const raw = facts.kind === "raw";
  if (facts.elsewhere && !facts.handoff) return toDo("open-elsewhere", `It is open on ${spokenMac(facts.mac)}. Carry on there, or open it here and take it over.`);
  if (raw && facts.finishRunning) return toDo("finish-running", "Its finish is running. The panel shows how far it is.");
  if (facts.handoff) {
    if (raw && facts.shownSinceFinish) return toDo("finish-again", 'It was shown in Final Cut again since its finish. Share it and Export XML again, then say "finish the episode".');
    return opsStep(facts, notes, now) || { done: true };
  }
  if (facts.reading !== "done") {
    if (facts.readingsOff) return toDo("readings-off", "Readings are off on this Mac: ask Jason.");
    if (facts.reading === "later") return toDo("reading-later", `Claude reads it at ${facts.readsAt}, once the import has checked its copies. A notice comes when it is done.`);
    if (facts.reading === "failed") return toDo("reading-failed", READING_FAILED);
    return toDo("reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".');
  }
  if (!facts.offersAnswered) return toDo("spellings", 'Claude has read it. Say "what did Claude find?", then answer the spellings card.');
  if (raw) {
    if (facts.placeholder) return toDo("name", 'It needs its name before it is finished. Say "call it", then the name.');
    if (!facts.shownInFinalCut) return toDo("show", 'Ask for any changes in your own words, then say "show it in Final Cut".');
    return toDo("finish", 'Trim it by hand in Final Cut. Then Share it with Command-E, and choose File > Export XML…, both into From Final Cut. Then say "finish the episode".');
  }
  return facts.v2 ? toDo("handoff-owed", 'Its hand-off is not written yet. Say "show me the spellings" and answer them again.') : toDo("waits-v2", WAITS_V2);
}

/** The one next step for a video, from what edit.js read of it, her notes on this Mac, and the time now (ms). A file in a drop
    folder first; then a video she said was finished, which is done; then what holds any video up (a conflict, her answer, a
    version that was a session after all); then a session's steps, or any other video's. */
export function nextFor(facts, notes, now) {
  if (facts.drop) return dropNext(facts.drop, facts.mac);
  if (notes.finished[facts.id]) return { done: true };
  if (facts.conflicted) return toDo("conflicted", 'Dropbox kept two copies of a change to it. Say "sort out the conflict".');
  if (facts.waiting) return facts.elsewhere ? toDo("answering-elsewhere", `It is being answered on ${spokenMac(facts.mac)}. Carry on there.`) : toDo("waiting", 'It is waiting for your answer. Say "what\'s waiting?" to see its card.');
  if (facts.heldAsSession) return toDo("held-session", 'One of its other versions is a client or group session. Say "it was a session after all" for this one too.');
  return facts.kind === "session" ? sessionNext(facts, notes, now) : videoNext(facts, notes, now);
}

/** The videos in the order the guide says them: one waiting for her answer first, as only she can answer it; then the newest
    first, and by name when two came at the same moment. */
export const ordered = (items) =>
  [...items].sort((a, b) => Number(b.next.stage === "waiting") - Number(a.next.stage === "waiting") || b.facts.at - a.facts.at || a.facts.name.localeCompare(b.facts.name));

/** A name, or what she said, as they are compared: whatever its case and spacing, and however its accents are written, as edit.js
    compares a label. */
const spaced = (text) => String(text || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

/** The video she means, by its name, its label or its id: { item }, or { why } when none fits, or more than one does. */
export function findIn(items, said) {
  const want = spaced(said);
  const fits = items.filter(({ facts }) => [facts.name, ...facts.aliases].some((name) => spaced(name) === want));
  if (fits.length === 1) return { item: fits[0] };
  if (fits.length > 1) return { why: `More than one video fits that: ${listed(fits.map(({ facts }) => facts.name))}. Say which.` };
  return { why: NO_FIT };
}

/** The overview's lines: this Mac's drop folder in Finder words, each video under way with its next step, and, when there are
    any, how many videos from before the switch it does not guide. */
export function overviewLines({ drop, items, old }) {
  const under = ordered(items.filter(({ next }) => !next.done));
  return [
    `Your drop folder: ${drop}`,
    ...(under.length ? ["Under way:", ...under.map(({ facts, next }) => `  ${facts.name}: ${next.text}`)] : [NOTHING_UNDER_WAY]),
    ...(old > 0 ? [`${old} ${old === 1 ? "video" : "videos"} from before the switch ${old === 1 ? "is" : "are"} not guided.`] : [])
  ];
}

/** One video's lines: its next step, and for a BRIMM Ops step the one after it and the step's word, which she notes it by. */
export function videoLines({ facts, next }) {
  if (next.done) return [`${facts.name} is done: nothing is left to do for it.`];
  const lines = [`${facts.name}: ${next.text}`];
  return next.stage === "ops" ? [...lines, `Then: ${next.after || "that is the last step."}`, `Step: ${next.step}`] : lines;
}
