# brimm-video: the guide in her Claude folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new edit.js command, `guide`, that tells Sallie the one next step for each video under way, from the drop folder to the last piece of the cascade, and her skill's "## Guide her" section that walks her through it one step at a time.

**Architecture:** `tool/guide.js` is pure: given plain facts about a video and her note, it says the stage, the step in her words, and the BRIMM Ops page's step machine. `tool/guide-note.js` reads and writes her note (`guide.json` in Application Support, written whole, then renamed). edit.js gathers the facts (drop folders, import statuses, records, hand-offs, this Mac's runs) with its own private readers, in one new block before `COMMANDS`, and prints what guide.js says.

**Tech Stack:** Node 22, ES modules, `node:test`, no packages.

**Spec:** `docs/superpowers/specs/2026-10-25-brimm-video-guide-design.md` (and the stage recon, `brimm-video-guide-recon-2026-10-25.md`, in the managing session's notes).

## Global Constraints

- Node 22 or later, no packages. `cd tool && node --test` passes after every task. Write a failing test first, then the code.
- Nothing opens a real app or page in a test: `openApp` and `run` are stand-ins (tests/episodes.js `setup`). No test calls the real `claude` program. Never read a `.env`.
- Never edit or check out `/Users/jasonogden/Claude Code/BRIMM video` itself; work in this worktree. `install.sh` only with `--print` (this plan needs no installer change).
- Keep clear of open PR #40's lines: `tool/edit.js` line 33 and lines 2228–2350 (`lockLoosened`, `behind`); `tool/studio.js`; README line 263 (`behind` row) and 304 ("On Sallie's laptop"); `docs/setup/sallies-laptop.md` lines 41–44, 54 and 67; `tool/tests/episodes.js` (its `setup` deps); `tool/tests/edit-show.test.js`. New tests go in new test files; extra stand-ins are passed as `{ ...t.ctx.deps, x }`. Rebase on `main` once #40 merges.
- It never posts, sends or publishes anything. Opening a page is not posting. The BRIMM Ops page's link is a constant in code, `https://claude.ai/artifact/GCUQPLnSFWZe3VghyaKNtX`, with nothing of a video in it, and never in her skill.
- Nothing the guide prints holds a path, a command name or a flag: places are Finder words (`Dropbox › The BRIMM DB › BRIMM Video › Drop › Sallie's laptop`). A gated video (unanswered, left alone, a session, held as one) is named only as `listedAs` names it, and nothing she said is echoed back.
- Step texts: plain words, under 25 words a sentence. Button labels are the page's own: "Episodes", "Take the hand-off", "Write what’s next" (with U+2019), "Brief", "Before posting", "Not posted yet", "Posted", "This is what is live", "Clip to cut", "New short video from a clip", "Reels", "Principles", "Take the session", "Check it", "Use in drafts", "Withdraw the words and take the session", "About", "Make online-only".
- On a Mac not on the light import (`lightImport(settings)` false), every form of `guide` says exactly `This Mac isn't set up for the guide yet: ask Jason.`, ends with 1, and does nothing else.
- Her note: `~/Library/Application Support/BRIMM Video/guide.json`, this Mac's alone, keyed by the hand-off's id (`finish.js handoffIdIn`), written whole to `guide.json.writing`, then renamed.
- `guide wait` waits 90 seconds at most. A hand-off whose BRIMM Ops steps are not all noted stays under way for 60 days after it was written.
- Her skill stays under 160 lines (tests/studio.test.js); "## Guide her" is at most 30 lines.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **What she says holds a client's name** ("the Jane Doe call"): no line ever repeats it; a video that fits nothing gets the one fixed sentence. Pinned in Task 2 (`findIn`) and Task 4 (`guide "Coaching call Jane Doe"`, and the privacy walk in edit-labels.test.js, extended in Tasks 6–8).
2. **Her note is missing, half-written or not JSON**: it reads as no note, so the steps start at `taken`; and a note that cannot be written is never reported as noted. Pinned in Task 3 and Task 8.
3. **Two versions of one video share a hand-off id** (a new version after the first was taken): one line, the newest hand-off's, with "drop the new one on the same episode". Pinned in Task 4.
4. **During `guide wait` only the time left, or a file's size while it copies in, changes**: that is no change, and it keeps waiting. Pinned in Task 7.
5. **Her note says a later step, but the video turned out to be a session** (it has an empty session revision, `session.emptyRevision`): the withdrawal on Principles comes next whatever was noted, whatever she chose for its teachings, and even once its own hand-off (a later revision under the same id) is written. Once the withdrawal is noted, the session's own steps follow (its teachings choice, the reading, her decisions, "done"), then its own hand-off's (`taken` again, or `checked` when the withdrawal was made with that hand-off, since the page's withdrawal takes the session it was dropped with). Pinned in Tasks 1, 2 and 4. **Jason's call:** a withdrawal not yet noted never ages off the list (60 days applies to every other step).

---

### Task 1: The BRIMM Ops page's steps, and the Finder words (tool/guide.js)

**Files:**
- Create: `tool/guide.js`
- Test: `tool/tests/guide.test.js`

**Interfaces:**
- Consumes: `aboutLeft` (progress.js) and `spokenMac` (kinds.js) are imported here for Task 2; nothing of earlier tasks.
- Produces:
  - `OPS_PAGE: string`, `NOT_SET_UP: string`, `ZOOM_WORDS: string`
  - `dropWords(drop: string | undefined, machine: string): string`
  - `OPS: { episode: string[], "short video": string[], session: string[], withdrawal: string[] }`
  - `noteKindOf(kind: "finished" | "raw" | "short video" | "session"): "episode" | "short video" | "session"`
  - Type `Handoff = { id: string, revision: number, kind: "finished" | "raw" | "short video" | "session", emptyAt: number | null /* a session's empty revision (session.emptyRevision), else null */, at: number /* ms, when written */, file: string /* main.file, "" for a session */ }`
  - Type `Note = { kind: "episode" | "short video" | "session", step: string /* furthest step done */, revision: number /* revision last taken */, at: string /* localStamp */ }`
  - `opsNext(handoff: Handoff, note: Note | undefined): { step: string, again: boolean } | null` (null: every step is noted; at a session's empty revision, its withdrawal is noted and the session's own steps are brimm-video's)
  - `noteAfter(handoff: Handoff, note: Note | undefined, step: string, at: string): Note`
  - `opsText(handoff: Handoff, step: string, again: boolean): string`

- [ ] **Step 1: Write the failing tests**

```js
// tool/tests/guide.test.js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/guide.test.js`
Expected: FAIL, `Cannot find module '…/tool/guide.js'`.

- [ ] **Step 3: Write `tool/guide.js` with the constants, `dropWords`, `OPS`, `noteKindOf`, `opsNext`, `noteAfter` and `opsText`**

A header comment says the file is pure: it reads and writes nothing, and edit.js gives it what it read. `dropWords` joins `"Dropbox", "The BRIMM DB", "BRIMM Video", drop || "Unedited Video", machine` with `" › "`. The rules `opsNext` follows, in order:
- the withdrawal first: while `emptyAt` is an integer and the withdrawal is not noted, the step is `withdrawn`, whatever the hand-off's revision. It is noted when the note is a `session` note and either its `step` is `withdrawn` with `revision >= emptyAt`, or its `revision > emptyAt` (a note can only reach a revision after the empty one through the withdrawal);
- then, at the empty revision itself (`revision === emptyAt`), null: the session's own steps are brimm-video's (Task 2);
- otherwise the family is `noteKindOf(kind)` (`OPS.withdrawal` is only the withdrawal's step list, for Task 3's check of a note's step); its steps are `OPS[family]`;
- the note counts only when its `kind` is `noteKindOf(handoff.kind)` and its `step` is one of the family's steps, or, for a session, `withdrawn`, which counts as `taken` at its revision (the page's "Withdraw the words and take the session" takes the session it was dropped with); otherwise the first step, `again: false`;
- a hand-off revision above the note's `revision` gives `taken`, `again: true`;
- otherwise the step after the note's, or null after the last.

`noteAfter` keeps a counted note's further step when `taken` is noted again (only `revision` and `at` change; a `withdrawn` note, counted as `taken`, is written as `taken`); any other step becomes the note's `step` and keeps a counted note's `revision` (the hand-off's when there was none); `withdrawn` writes `{ kind: "session", step: "withdrawn", revision: handoff.revision }`. `opsText` takes the texts of the test, with the "Make online-only" sentence after `taken` for a `raw` hand-off only, and `posted` worded by family.

- [ ] **Step 4: Run it to see it pass**

Run: `cd tool && node --test tests/guide.test.js`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/guide.js tool/tests/guide.test.js
git commit -m "The guide, task 1: the BRIMM Ops page's steps, her note's rules, and the Finder words

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The one next step for a video, in her words (tool/guide.js)

**Files:**
- Modify: `tool/guide.js`
- Test: `tool/tests/guide.test.js`

**Interfaces:**
- Consumes: Task 1's `opsNext`, `noteAfter`, `opsText`, `ZOOM_WORDS`, `Handoff`, `Note`.
- Produces:
  - Type `VideoFacts` (edit.js fills it in Tasks 4 and 5):
    ```
    { name: string, id: string /* record id, "" for a file in a drop folder */, aliases: string[], at: number /* ms */,
      mac: string /* the other Mac's name where a step says "on that Mac", else "" */,
      drop: null | { here: boolean, state: "arriving" | "importing" | "retry" | "zoom", step: string, left: number | null, total: number | null },
      conflicted: boolean, kind: null | "finished" | "raw" | "short video" | "session", waiting: boolean, heldAsSession: boolean,
      elsewhere: boolean, readingsOff: boolean, reading: "done" | "running" | "failed" | "later" | "none", readsAt: string,
      offersAnswered: boolean, v2: boolean, placeholder: boolean, shownInFinalCut: boolean, finishRunning: boolean,
      shownSinceFinish: boolean,
      session: null | { choice: null | "asked" | "transcript only", teachingsOn: boolean, undecided: number, emptyOwed: boolean },
      handoff: null | Handoff }
    ```
  - Type `Notes = { version: 1, handoffs: { [id: string]: Note }, finished: { [recordId: string]: string } }`
  - Type `Next = { done: true } | { done: false, stage: string, text: string, step: string /* BRIMM Ops step, "" otherwise */, after: string /* for a BRIMM Ops step, what comes once it is noted, "" when nothing does */ }`
  - Type `Item = { facts: VideoFacts, next: Next, folder: string | null, record: object | null }`
  - `OLD_DAYS = 60`, `NOTHING_UNDER_WAY`, `NO_FIT`
  - `nextFor(facts: VideoFacts, notes: Notes, now: number): Next`
  - `ordered(items: Item[]): Item[]`, `findIn(items: Item[], said: string): { item: Item } | { why: string }`
  - `overviewLines({ drop: string, items: Item[], old: number }): string[]`, `videoLines(item: Item): string[]`

- [ ] **Step 1: Write the failing tests**

```js
// added to tool/tests/guide.test.js
import { nextFor, ordered, findIn, overviewLines, videoLines, NOTHING_UNDER_WAY, NO_FIT } from "../guide.js";

const BASE = { name: "Pricing talk (3fa9c1)", id: "e-20261020-3fa9c1", aliases: [], at: 0, mac: "", drop: null, conflicted: false, kind: "finished", waiting: false, heldAsSession: false, elsewhere: false, readingsOff: false, reading: "done", readsAt: "", offersAnswered: true, v2: true, placeholder: false, shownInFinalCut: false, finishRunning: false, shownSinceFinish: false, session: null, handoff: null };
const NONE = { version: 1, handoffs: {}, finished: {} };
const NOW = Date.parse("2026-10-25T12:00:00-05:00");
const DROP = (over) => ({ kind: null, drop: { here: true, state: "arriving", step: "", left: null, total: null, ...over } });
const SESSION = (over) => ({ kind: "session", session: { choice: "asked", teachingsOn: true, undecided: 0, emptyOwed: false, ...over } });
const RAW = (over) => ({ kind: "raw", ...over });
const shown = (n) => (n.done ? { done: true } : { stage: n.stage, text: n.text });
const OFF = "Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.";
const V1 = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
const STAGE_ROWS = [
  [DROP(), "arriving", 'It is coming into your drop folder. Wait for the "Ready" notice.'],
  [{ ...DROP({ here: false }), mac: "Mac Studio" }, "arriving", 'It is in the drop folder of the Mac Studio. Wait for the "Ready" notice on that Mac.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180, total: 360 }), "importing", 'It is being imported, at Writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180 }), "importing", 'It is being imported, at Writing the transcript, about 3 minutes left of this step. Wait for the "Ready" notice.'],
  [{ ...DROP({ here: false, state: "importing", step: "Writing the transcript" }), mac: "Mac Studio" }, "importing", 'It is being imported on the Mac Studio, at Writing the transcript. Wait for the "Ready" notice on that Mac.'],
  [DROP({ state: "retry" }), "retry", 'Its import did not finish. Say "try it again".'],
  [{ ...DROP({ here: false, state: "retry" }), mac: "Sallie's laptop" }, "retry", "Its import did not finish on Sallie's laptop. Say \"try it again\" on that Mac."],
  [DROP({ state: "zoom" }), "zoom", "It is a Zoom download, and those go in Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer. Move it there in Finder."],
  [{ conflicted: true }, "conflicted", 'Dropbox kept two copies of a change to it. Say "sort out the conflict".'],
  [{ kind: null, waiting: true }, "waiting", 'It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
  [{ kind: null, waiting: true, elsewhere: true, mac: "Mac Studio" }, "answering-elsewhere", "It is being answered on the Mac Studio. Carry on there."],
  [{ heldAsSession: true }, "held-session", 'One of its other versions is a client or group session. Say "it was a session after all" for this one too.'],
  [{ elsewhere: true, mac: "Mac Studio", reading: "running" }, "open-elsewhere", "It is open on the Mac Studio. Carry on there, or open it here and take it over."],
  [{ readingsOff: true, reading: "none" }, "readings-off", "Readings are off on this Mac: ask Jason."],
  [{ reading: "running" }, "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [{ reading: "none" }, "reading", 'Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
  [RAW({ reading: "later", readsAt: "10:58" }), "reading-later", "Claude reads it at 10:58, once the import has checked its copies. A notice comes when it is done."],
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/guide.test.js`
Expected: FAIL, `does not provide an export named 'nextFor'`.

- [ ] **Step 3: Add `nextFor`, `ordered`, `findIn`, `overviewLines`, `videoLines`, `OLD_DAYS`, `NOTHING_UNDER_WAY` and `NO_FIT` to `tool/guide.js`**

`nextFor` decides in this order, first match wins (each stage's text is the test's):
1. `drop`: its `state` is the stage (`arriving`, `importing`, `retry`, `zoom`); `here: false` adds " on <spokenMac(mac)>" and "on that Mac" as the rows show; the time is `aboutLeft(total)` + " left in all", else `aboutLeft(left)` + " left of this step", else none.
2. `notes.finished[facts.id]` → done.
3. `conflicted`; then `waiting` (`answering-elsewhere` when `elsewhere`); then `heldAsSession`.
4. A session: `emptyOwed`; a `handoff` whose `opsNext` is not null → ops (rule 6), so a withdrawal not yet noted comes before anything else of a session, transcript only included; a `handoff` whose `opsNext` is null → done, except at the empty revision (`handoff.revision === handoff.emptyAt`, its withdrawal noted), which goes on to the session's own steps that follow; choice `"transcript only"` → done; choice null → `session-choice`, or `session-off` without `teachingsOn`; `elsewhere` → `open-elsewhere` ("Carry on there."); reading `running` → `session-reading`; reading not `done` → `session-off` without `teachingsOn`, `reading-failed` when failed, else `session-reading`; `undecided > 0` → `session-decide`; not `v2` → `waits-v2`; else `session-done`.
5. Any other kind: `elsewhere` without a hand-off → `open-elsewhere`; raw with `finishRunning` → `finish-running`; a `handoff` → `finish-again` for raw with `shownSinceFinish`, else ops; reading not `done` → `readings-off`, `reading` (running), `reading-later`, `reading-failed`, else `reading`; not `offersAnswered` → `spellings`; raw → `name` (placeholder), `show` (not `shownInFinalCut`), `finish`; else `handoff-owed` with `v2`, `waits-v2` without.
6. Ops: `opsNext(handoff, notes.handoffs[handoff.id])`; null → done (rule 4 has the empty revision's exception); `now - handoff.at > OLD_DAYS * 86400000` → done, except for `withdrawn`, which stays under way until it is noted; otherwise `text` is `On the BRIMM Ops page: ` + `opsText`, `step` its word, and `after` what comes once the step is noted, with `notes` given `noteAfter(…, step, "")`: the `opsText` of the step `opsNext` then gives; or, when that is null at the empty revision, the text of the session's own next step (`nextFor` again with those notes, "" when it is done); else "".

`ordered` sorts the `waiting` stage first, then `at` descending, then `name` ascending. `findIn` compares NFC lower-case text with runs of space made one (`spaced`, as edit.js does) against each item's `name` and `aliases`; two or more fits give the "More than one video fits that: … Say which." sentence (names joined "a, b and c"). `overviewLines` and `videoLines` give the lines of the test, leaving out items whose `next.done`.

- [ ] **Step 4: Run them to see them pass**

Run: `cd tool && node --test tests/guide.test.js`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/guide.js tool/tests/guide.test.js
git commit -m "The guide, task 2: each stage's one next step in her words, the order, and the lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Her note on this Mac (tool/guide-note.js)

**Files:**
- Create: `tool/guide-note.js`
- Test: `tool/tests/guide-note.test.js`

**Interfaces:**
- Consumes: the `Note` and `Notes` types (Tasks 1–2); `OPS` (Task 1) for the steps a note may hold.
- Produces: `guideFile(home: string): string`; `readGuideNotes(home: string): Notes`; `writeGuideNotes(home: string, notes: Notes): void`, which throws (with the error's `code`) when it cannot write, and leaves no `.writing` file.

- [ ] **Step 1: Write the failing tests**

```js
// tool/tests/guide-note.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { guideFile, readGuideNotes, writeGuideNotes } from "../guide-note.js";

const EMPTY = { version: 1, handoffs: {}, finished: {} };
const NOTE = { kind: "episode", step: "kit", revision: 2, at: "2026-10-25T12:00:00-05:00" };
const home = () => mkdtempSync(join(tmpdir(), "brimm-guide-"));

describe("her note on this Mac", () => {
  it("is guide.json in Application Support", () => {
    assert.equal(guideFile("/h"), "/h/Library/Application Support/BRIMM Video/guide.json");
  });
  it("reads as no note when it is missing, not JSON, or not a note", () => {
    const h = home();
    assert.deepEqual(readGuideNotes(h), EMPTY);
    mkdirSync(dirname(guideFile(h)), { recursive: true });
    for (const text of ["{ half", "[]", "null", JSON.stringify({ version: 2, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: {} })]) {
      writeFileSync(guideFile(h), text);
      assert.deepEqual(readGuideNotes(h), EMPTY, text);
    }
    rmSync(h, { recursive: true, force: true });
  });
  it("keeps only the entries shaped as a note", () => {
    const h = home();
    mkdirSync(dirname(guideFile(h)), { recursive: true });
    writeFileSync(guideFile(h), JSON.stringify({ version: 1, handoffs: { "e-20261020-3fa9c1": NOTE, "e-20261020-aaaaaa": { ...NOTE, kind: "reel" }, "e-20261020-bbbbbb": { ...NOTE, step: "lunch" }, "e-20261020-cccccc": { ...NOTE, revision: 0 }, "not an id": NOTE }, finished: { "e-20261020-dddddd": "2026-10-25T12:00:00-05:00", "e-20261020-eeeeee": 7 } }));
    assert.deepEqual(readGuideNotes(h), { version: 1, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: { "e-20261020-dddddd": "2026-10-25T12:00:00-05:00" } });
    rmSync(h, { recursive: true, force: true });
  });
  it("is written whole, then renamed, making its folder, and read back as written", () => {
    const h = home();
    const notes = { version: 1, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: {} };
    writeGuideNotes(h, notes);
    assert.deepEqual(readGuideNotes(h), notes);
    writeGuideNotes(h, EMPTY);
    assert.deepEqual(readGuideNotes(h), EMPTY);
    assert.deepEqual(readdirSync(dirname(guideFile(h))), ["guide.json"]);
    rmSync(h, { recursive: true, force: true });
  });
  it("throws when it cannot be written, and leaves nothing half-written", () => {
    const h = home();
    mkdirSync(guideFile(h), { recursive: true });
    writeFileSync(join(guideFile(h), "x"), "");
    assert.throws(() => writeGuideNotes(h, EMPTY), (e) => typeof e.code === "string");
    assert.ok(!existsSync(`${guideFile(h)}.writing`));
    rmSync(h, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/guide-note.test.js`
Expected: FAIL, `Cannot find module '…/tool/guide-note.js'`.

- [ ] **Step 3: Write `tool/guide-note.js`**

`guideFile` is beside `writtenFile` and `seenFile` (settings.js), in its own file so that settings.js is not changed. A note entry is kept when its key is an id (`/^e-\d{8}-[0-9a-f]{6}$/`), its `kind` one of `episode`, `short video`, `session`, its `step` one of `Object.values(OPS).flat()`, its `revision` an integer from 1 and its `at` a time `Date.parse` reads; a `finished` entry when its key is an id and its value such a time. The write is `noteWritten`'s pattern (episode.js:429-445), but does not swallow the error: it removes `${file}.writing` and throws again.

- [ ] **Step 4: Run them to see them pass**

Run: `cd tool && node --test tests/guide-note.test.js`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/guide-note.js tool/tests/guide-note.test.js
git commit -m "The guide, task 3: her note on this Mac, guide.json, read safely and written whole

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `guide` and `guide "<video>"` from the records, registered everywhere

**Files:**
- Modify: `tool/edit.js` (new import lines after line 69; HELP after line 74; a new block before the `COMMANDS` comment at line 5214; `COMMANDS` at line 5216)
- Modify: `tool/gate.js:14` (`UNSCOPED`)
- Modify: `tool/tests/gate.test.js:23`, `tool/tests/part-f-fixes.test.js:457`, `tool/tests/edit-labels.test.js` (`TODAY_ASKED`, after line 116, `ideas: []`, adding a comma to it; `walkWords`, after line 1233), `tool/tests/fixtures/today-says.json` (regenerated)
- Modify: `README.md` (three rows after the `cut` row, line 276)
- Test: `tool/tests/edit-guide.test.js` (new)

**Interfaces:**
- Consumes: Tasks 1–3 (`NOT_SET_UP`, `dropWords`, `nextFor`, `ordered`, `findIn`, `overviewLines`, `videoLines`, `readGuideNotes`); edit.js's own `folders`, `episodeAt`, `listedAs`, `isGated`, `gatedRecord`, `currentReading`, `answerOf`, `revisionOwed`, `lateCheckAt`, `heldElsewhere`, `refuse`, `HELP`; `withShortId`, `gated`, `leftAlone` (gate.js); `writesV2For`, `handoffIdIn`, `linksOf` (finish.js); `sessionReading`, `readTeachings`, `itemsOf`, `ITEM_LISTS` (teachings.js); `runningCommand`, `readResult` (detached.js); `newestIsRender` (timeline.js); `teachingsOn`, `lightImport` (settings.js); `clockAt` (unedited.js); `kindOf as recordKind` (episode.js).
- Produces: `export async function guideCommand(ctx, rest): Promise<0 | 1 | 2>` (registered as `guide`); `function guideItems(ctx): { items: Item[], old: number }`, which Tasks 5–8 use and Task 5 extends.

- [ ] **Step 1: Write the failing tests**

```js
// tool/tests/edit-guide.test.js
// The guide (spec 2026-10-25): its one next step for each video under way, in her words. Each test has a root and a home of its own;
// openApp and run are stand-ins, and nothing opens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { writeGuideNotes } from "../guide-note.js";
import { NOT_SET_UP } from "../guide.js";
import { setup, episodeAs, otherMac } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}
/** This Mac on the light import, its drop folder switched to Drop, handing off version 2; `over` lays other deps on it. */
const light = (t, over = {}) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, ...over });
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: "2026-10-20T08:00:00-05:00", private: "no" };
const READ = (kind) => ({ kind, model: "m", at: "2026-10-20T08:05:00-05:00", on: "Mac Studio", account: "a", outcome: "read" });
const OFFERS = { spellings: [], answered: { reading: "2026-10-20T08:05:00-05:00", at: "2026-10-20T08:06:00-05:00", on: "Mac Studio", applied: [], left: [] } };
const imported = (time) => ({ imported: { on: "Mac Studio", at: `2026-10-20T${time}:00-05:00` } });
const MAIN = (pushed) => ({ preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed });
const MARK = { marked: "2026-10-20T08:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
const VIDEOS = {
  waiting: { id: "e-20261020-aaaaaa", name: "2026-10-20 Coaching call Jane Doe (Mac Studio)", record: { kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00", came: "camera", match: null }, label: "Video of 20 Oct, 09:00 (Mac Studio)", ...imported("09:00") } },
  read: { id: "e-20261020-bbbbbb", name: "2026-10-20 Pricing talk (Mac Studio)", record: { kind: "finished", answer: ANSWERED, reading: READ("finished"), name: { text: "Pricing talk", placeholder: false }, ...imported("12:00") } },
  raw: { id: "e-20261020-cccccc", name: "2026-10-20 Morning talk (Mac Studio)", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Morning talk", placeholder: false }, main: MAIN([{ v: 0, at: "2026-10-20T08:05:00-05:00", on: "Mac Studio", file: "edit/main.v0.fcpxml", how: "render" }]), ...imported("11:00") } },
  session: { id: "e-20261020-dddddd", name: "2026-10-20 Group call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: MARK, ...imported("10:00") } },
  old1: { id: "e-20261014-eeeeee", name: "2026-10-14 Old talk (Mac Studio)" },
  old2: { id: "e-20261015-ffffff", name: "2026-10-15 Older talk (Mac Studio)" },
  archived: { id: "e-20261016-0a0a0a", name: "2026-10-16 Archived (Mac Studio)", record: { archived: { at: "2026-10-17T09:00:00-05:00" } } },
  left: { id: "e-20261020-0b0b0b", name: "2026-10-20 Left (Mac Studio)", record: { kind: null, answer: { state: "not for brimm-video", guess: null, seen: "", came: null, match: null }, label: "Video of 20 Oct, 07:00 (Mac Studio)" } },
  transcript: { id: "e-20261019-0c0c0c", name: "2026-10-19 Team call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 19 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-19", placeholder: false }, session: { ...MARK, teachings: "transcript only" }, ...imported("07:30") } }
};
/** A finished video handed off: its record, and its hand-off (version 2) in final/. */
function handedOff(t, { id = "e-20261020-a1a1a1", name = "2026-10-20 Launch talk (Mac Studio)", text = "Launch talk", kind = "finished", revision = 1, under = id, at = "2026-10-20T13:00:00-05:00", over = {} } = {}) {
  const handoff = `final/${text}.brimm-ops.json`;
  const found = episodeAs(t, { id, name, record: { kind, answer: ANSWERED, reading: READ(kind), offers: OFFERS, name: { text, placeholder: false }, finished: { revision, at, on: "Mac Studio", handoff, parts: {} }, ...imported("12:30"), ...over } });
  mkdirSync(join(found.folder, "final"), { recursive: true });
  writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision, video: { id: under, kind, name: text }, main: { file: `${text}.mov` } }));
  return found;
}
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const TAKE = '  Launch talk (a1a1a1): On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';

describe("guide on a Mac not on the light import", () => {
  it("says only to ask Jason, for every form, ends with 1, and opens, runs and waits for nothing", async () => {
    const t = setup();
    for (const words of [[], ["drop"], ["drop", "zoom"], ["page"], ["wait"], ["X"], ["X", "done", "taken"], ["X", "finished"], ["X", "show"]]) {
      assert.deepEqual(await on(t.ctx.deps, "guide", ...words), { code: 1, said: [NOT_SET_UP] }, words.join(" "));
    }
    assert.deepEqual([t.opened, t.calls, t.waits], [[], [], []]);
    t.done();
  });
});

describe("guide, from the records", () => {
  it("says the drop folder in Finder words, and that nothing is under way", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."] });
    const laptop = setup({ machine: "Sallie's laptop" });
    const r = await on({ ...laptop.ctx.deps, settings: { ...laptop.ctx.settings, import: "light" } }, "guide");
    assert.equal(r.said[0], "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Unedited Video › Sallie's laptop");
    t.done();
    laptop.done();
  });
  it("lists each video under way, waiting for her answer first, then newest first, a gated one by its label, and counts the old ones", async () => {
    const t = setup();
    for (const v of Object.values(VIDEOS)) episodeAs(t, v);
    assert.deepEqual(await on(light(t), "guide"), { code: 0, said: [
      DROP_LINE, "Under way:",
      '  Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.',
      '  Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.',
      '  Morning talk (cccccc): Ask for any changes in your own words, then say "show it in Final Cut".',
      "  Session, 2026-10-20 (dddddd): Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.",
      "2 videos from before the switch are not guided."
    ] });
    t.done();
  });
  it("gives one video's step by its label, name or short id, says a done one is done, and never repeats words that fit none", async () => {
    const t = setup();
    for (const v of Object.values(VIDEOS)) episodeAs(t, v);
    assert.deepEqual(await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)"), { code: 0, said: ['Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.'] });
    assert.equal((await on(light(t), "guide", "Pricing talk")).said[0], 'Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.');
    assert.equal((await on(light(t), "guide", "cccccc")).said[0].split(":")[0], "Morning talk (cccccc)");
    assert.deepEqual(await on(light(t), "guide", "Session, 2026-10-19"), { code: 0, said: ["Session, 2026-10-19 (0c0c0c) is done: nothing is left to do for it."] });
    const NO_FIT = 'No video under way fits that. Say "what\'s next?" to see the ones that are.';
    for (const said of ["Coaching call Jane Doe", "2026-10-20 Coaching call Jane Doe (Mac Studio)", "eeeeee"]) assert.deepEqual(await on(light(t), "guide", said), { code: 1, said: [NO_FIT] }, said);
    t.done();
  });
  it("gives a handed-off video's BRIMM Ops step from her note, the one after it, and drops it after 60 days", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Under way:", TAKE]);
    assert.deepEqual((await on(light(t), "guide", "Launch talk")).said, [TAKE.trim(), 'Then: Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.', "Step: taken"]);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.equal((await on(light(t), "guide")).said[2], '  Launch talk (a1a1a1): On the BRIMM Ops page: Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".');
    const later = light(t, { now: () => Date.parse("2026-12-20T15:00:00-05:00") });
    assert.deepEqual((await on(later, "guide")).said, [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."]);
    t.done();
  });
  it("lists two versions under one hand-off id once, by the newest hand-off: drop the new one on the same episode", async () => {
    const t = setup();
    const first = handedOff(t);
    handedOff(t, { id: "e-20261021-a2a2a2", name: "2026-10-21 Launch talk again (Mac Studio)", text: "Launch talk again", revision: 2, under: first.record.id, at: "2026-10-21T13:00:00-05:00", over: { versionOf: first.record.id } });
    writeGuideNotes(t.home, { version: 1, handoffs: { [first.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual((await on(light(t), "guide")).said, [DROP_LINE, "Under way:", '  Launch talk again (a2a2a2): On the BRIMM Ops page: Drag the new hand-off onto the same episode, then press "Take the hand-off".']);
    t.done();
  });
  it("says a video open, or being answered, on the other Mac is on that Mac; and her note on this Mac does not follow a video there", async () => {
    const t = setup();
    const away = { by: "Sallie's laptop", since: "2026-10-20T12:05:00-05:00" };
    episodeAs(t, { ...VIDEOS.read, record: { ...VIDEOS.read.record, editing: away } });
    episodeAs(t, { ...VIDEOS.waiting, record: { ...VIDEOS.waiting.record, editing: away } });
    assert.equal((await on(light(t), "guide", "Pricing talk")).said[0], "Pricing talk (bbbbbb): It is open on Sallie's laptop. Carry on there, or open it here and take it over.");
    assert.equal((await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)")).said[0], "Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is being answered on Sallie's laptop. Carry on there.");
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.equal((await on(light(t), "guide", "Launch talk")).said.at(-1), "Step: posted");
    // Her laptop: the same root, a home of its own (otherMac), on the light import. The Mac Studio's note is not read there.
    const laptop = otherMac(t);
    const there = { ...laptop.deps, settings: { ...laptop.settings, import: "light", drop: "Drop", handoffVersion: 2 } };
    assert.equal((await on(there, "guide", "Launch talk")).said.at(-1), "Step: taken");
    t.done();
  });
  it("gives a video that was a session after all its withdrawal on Principles first, whatever her note says, and then the session's own step", async () => {
    const t = setup();
    const rel = "final/Session, 2026-10-20.brimm-ops.json";
    const found = episodeAs(t, { ...VIDEOS.session, record: { ...VIDEOS.session.record, session: { ...MARK, emptyRevision: 2 }, finished: { revision: 2, at: "2026-10-20T13:30:00-05:00", on: "Mac Studio", handoff: rel, parts: {} } } });
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, rel), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 2, video: { id: found.record.id, kind: "session", name: "Session, 2026-10-20" } }));
    writeGuideNotes(t.home, { version: 1, handoffs: { [found.record.id]: { kind: "episode", step: "cascade", revision: 1, at: "2026-10-19T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual((await on(light(t), "guide", "Session, 2026-10-20")).said, [
      'Session, 2026-10-20 (dddddd): On the BRIMM Ops page: Choose "Principles", drop the hand-off, and press "Withdraw the words and take the session". Then delete the old backups from "About", and tell Jason.',
      "Then: Its teachings cannot be read on this Mac now: ask Jason, or choose the transcript only.",
      "Step: withdrawn"
    ]);
    t.done();
  });
});
```

The imports later tasks add to this file join these at its top.

And the pinned lists, in the same step:
- `tool/tests/gate.test.js:23`: `assert.deepEqual(UNSCOPED, ["episodes", "status", "behind", "retry", "guide"]);`
- `tool/tests/part-f-fixes.test.js:457`: the sorted list gains `"guide"` after `"episodes"`.
- `tool/tests/edit-labels.test.js` `TODAY_ASKED`: `guide: []`, with the comment "The guide, new since the switch: tests/edit-guide.test.js pins its words."; `walkWords`: `guide: [[], [label]]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-guide.test.js tests/gate.test.js tests/part-f-fixes.test.js tests/edit-labels.test.js`
Expected: FAIL: edit-guide's tests get the help and 2 (`guide` is no command yet); gate.test.js's `UNSCOPED` and part-f-fixes' list of commands the held gate lets through each lack `"guide"`. edit-labels passes still: a key for a command that is not there is never walked.

- [ ] **Step 3: Write `guideItems` and `guideCommand` in `tool/edit.js`, and register `guide`**

- Imports, after line 69: `import { NOT_SET_UP, dropWords, nextFor, ordered, findIn, overviewLines, videoLines } from "./guide.js";` and `import { readGuideNotes } from "./guide-note.js";`.
- `UNSCOPED` (gate.js:14) gains `"guide"`; `COMMANDS` gains `guide: guideCommand`.
- HELP, after the `episodes` lines (line 74), as follows (the description at column 41, as the others):

```
  node edit.js guide ["<video>"]        the one next step for each video under way, in her words: a video waiting for her
                                        answer first, then the newest; this Mac's drop folder in Finder's words; and how
                                        many videos from before the switch are not guided. With a video, its next step,
                                        and for a step on the BRIMM Ops page the step after it. Only on a Mac that does
                                        the light import: on any other, every form says to ask Jason
  node edit.js guide drop [zoom] | page | wait
                                        open this Mac's drop folder in Finder (with zoom, Zoom Video Transfer), open the
                                        BRIMM Ops page in the default browser, or wait up to 90 seconds for a change in
                                        what the guide says
  node edit.js guide "<video>" done <step> | finished | show
                                        note on this Mac that she did its step on the BRIMM Ops page (only the step that
                                        comes next), that she is done with the video, or show in Finder what its step needs
```

  All three usages go in now, so that the help and today's pinned output change once; the forms of the second and third are built in Tasks 6–8, and until then are asked wrongly (the help, 2).
- README, after the `cut` row (line 276), three rows: `` `guide ["<video>"]` ``, `` `guide drop [zoom] \| page \| wait` `` and `` `guide "<video>" done <step> \| finished \| show` ``, each saying what the HELP says, plus: the step texts are guide.js's; her note is `~/Library/Application Support/BRIMM Video/guide.json`, this Mac's alone, keyed by the hand-off's id; the page's link is a constant in code.
- `guideItems(ctx)` reads `readGuideNotes(ctx.home)` and `linksOf(ctx.root)` once, then each folder (`folders`, `episodeAt(ctx, name, links)`), passing over one with no record in force, one a newer brimm-video wrote, an archived one and one left alone (`leftAlone`); one with no `answer` object is counted in `old`. The others' facts (one line each; `r` is `e.inForce`):
  - `name`: `listedAs(ctx, e)` when `isGated(e)`, else `withShortId(r.name.text, r)`; `aliases`: `r.label` (when a string), `r.id`, its last six, `shownName(r)`, and for one not gated `r.name.text` and `e.name`; `at`: `Date.parse(r.imported.at)`.
  - `conflicted`: `e.read.code === "CONFLICTED"`; `kind`: `recordKind(r)`; `waiting`: no kind and `answer.state === "needs your answer"`; `heldAsSession`: `e.held && !gated(r)`.
  - `elsewhere` and `mac`: `heldElsewhere(r, ctx.machine)` and its `by`; `readingsOff`: `ctx.settings.readings === false`; `v2`: `writesV2For(ctx.settings, e.folder, r)`.
  - `reading`: `done` when `currentReading(r)` (a session: `sessionReading(r)`); `running` when `runningCommand(ctx.home, e.name, ctx.alive) === "read"`; `failed` when `readResult(ctx.home, e.name, "read")` has `ok: false` and `result.started >= Date.parse(r.answer.at)` (a session: `>= Date.parse(r.session.asked)`): `started` is milliseconds (detached.js:185), the record's times are ISO text, so they are never compared as they are; `later` for raw when `lateCheckAt(ctx, r)` is not null, with `readsAt: clockAt(thatTime)`; else `none`.
  - `offersAnswered`: `answerOf(r) !== null`; `placeholder`: `r.name.placeholder === true`; `shownInFinalCut`: `r.main.pushed.length > 0 && !newestIsRender(r, "main")`; `finishRunning`: `runningCommand(…) === "finish"`; `shownSinceFinish`: `r.finished` and a push not rendered whose `at` is later than `r.finished.at`.
  - `session` (kind session): `{ choice: r.session.teachings, teachingsOn: teachingsOn(ctx.settings, ctx.now()), undecided, emptyOwed: revisionOwed(r) }`, where `undecided` counts the items of `itemsOf(readTeachings(e.folder, r, ctx.isWhole).teachings, r.session)` with no boolean `approved` across `ITEM_LISTS`, and is 1 when the file is not whole here or cannot be read.
  - `handoff` (when `r.finished`): read `join(e.folder, r.finished.handoff)` only when `ctx.isWhole` says it is whole: `id` `handoffIdIn(h)`, `revision` `h.revision`, `kind` `h.video.kind` (version 2) or `h.episode.kind` with `"episode"` read as `"raw"` (version 1), `file` `h.main.file` or ""; when it cannot be read, `id` is `links.firstOf(r, e.folder)` with `v2`, else `r.id`, `revision` `r.finished.revision`, `kind` `recordKind(r)`, `file` "". `emptyAt`: `r.session.emptyRevision` when it is an integer and the hand-off's `kind` is `session`, else null (it stays on the record when the session's own hand-off, a later revision, is written: finish.js does not change it); `at`: `Date.parse(r.finished.at)`.
  - `drop: null` (Task 5 adds the drop folders' videos).
  Each item is `{ facts, next: nextFor(facts, notes, ctx.now()), folder: e.folder, record: r }`. Of items whose hand-offs share an `id`, only the one with the highest revision is kept (the later `at` on a tie).
- `guideCommand(ctx, rest)`: not `lightImport(ctx.settings)` → `refuse(ctx, NOT_SET_UP)`. No words: `overviewLines({ drop: dropWords(ctx.settings.drop, ctx.machine), items, old })`, 0. One word: `findIn(items, rest[0])`; its `why` is refused with 1, else `videoLines(item)`, 0. Anything else: HELP, 2.

Then regenerate today's pinned output (HELP grew), and check that only the help changed:

Run: `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command" tests/edit-labels.test.js && git diff tests/fixtures/today-says.json`
Expected: every line the diff changes is a copy of the help, now with the three `guide` usages in it, and nothing else.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail (edit-guide, gate, part-f-fixes' README rows, edit-labels' TODAY and walk, studio's spans).

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/gate.js tool/tests/edit-guide.test.js tool/tests/gate.test.js tool/tests/part-f-fixes.test.js tool/tests/edit-labels.test.js tool/tests/fixtures/today-says.json README.md
git commit -m "The guide, task 4: guide and guide \"<video>\", from the records, on a Mac that does the light import

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The drop folders' videos in the guide

**Files:**
- Modify: `tool/edit.js` (`guideItems`, in the guide block)
- Test: `tool/tests/edit-guide.test.js`

**Interfaces:**
- Consumes: Task 4's `guideItems`; edit.js's `dropFolders`, `labelIn`, `capital`; `readStatuses`, `importState` (importing.js); `holdingEpisode`, `readSeen`, `seenKey` (filing.js); `unlabelled` (kinds.js); `progressFolder` (progress.js).
- Produces: items with `facts.drop` set (`id: ""`, `kind: null`), which Tasks 7 and 8 read.

- [ ] **Step 1: Write the failing test**

```js
// added to tool/tests/edit-guide.test.js
import { writeStatus } from "../importing.js";
import { progressFolder } from "../progress.js";

const writeText = (to, text) => writeFileSync(to, text);
const dropIn = (t, mac, name, text = "video") => {
  const dir = join(t.root, "Drop", mac);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text);
};
const statusOf = (t, over) => writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, bytes: 5, seconds: null, step: "Reading the sound", at: "2026-10-20T14:58:00-05:00", ...over }, writeText);

describe("guide, from the drop folders", () => {
  it("names each video waiting there by its label or what it is, says its step, and leaves out one an episode holds", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    dropIn(t, "Mac Studio", "Second.mov");
    statusOf(t, { import: "a1", video: "Second.mov", step: "Writing the transcript", label: "Video of 20 Oct, 14:58 (Mac Studio)", pid: 4242 });
    mkdirSync(progressFolder(t.home), { recursive: true });
    writeFileSync(join(progressFolder(t.home), "4242.json"), JSON.stringify({ version: 1, pid: 4242, video: "Video of 20 Oct, 14:58 (Mac Studio)", step: "Writing the transcript", n: 2, of: 4, percent: 40, left: 180, total: 360, detail: "", started: 0, updated: 0 }));
    dropIn(t, "Mac Studio", "Third.mov");
    statusOf(t, { import: "a2", video: "Third.mov", label: "Video of 20 Oct, 14:00 (Mac Studio)", at: "2026-10-20T14:00:00-05:00", failed: "the sound could not be read" });
    dropIn(t, "Mac Studio", "GMT20261020-140000_Recording.mp4");
    statusOf(t, { import: "a3", video: "GMT20261020-140000_Recording.mp4", label: "GMT20261020-140000_Recording", step: "Held", held: "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer." });
    dropIn(t, "Sallie's laptop", "Other.mov", "other video");
    dropIn(t, "Mac Studio", "Filed.mov");
    statusOf(t, { import: "a4", video: "Filed.mov", step: "Waiting for its late check" });
    episodeAs(t, { ...VIDEOS.waiting, record: { ...VIDEOS.waiting.record, video: { file: "Filed.mov", bytes: 5, seconds: 120, recorded: "2026-10-20", recordedFrom: "import" } } });
    const r = await on(light(t, { alive: (pid) => pid === 4242 }), "guide");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(0, 3), [DROP_LINE, "Under way:", '  Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.']);
    assert.deepEqual(r.said.slice(3).sort(), [
      '  A video of 11 bytes: It is in the drop folder of Sallie\'s laptop. Wait for the "Ready" notice on that Mac.',
      '  A video of 5 bytes: It is coming into your drop folder. Wait for the "Ready" notice.',
      "  GMT20261020-140000_Recording: It is a Zoom download, and those go in Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer. Move it there in Finder.",
      '  Video of 20 Oct, 14:00 (Mac Studio): Its import did not finish. Say "try it again".',
      '  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at Writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'
    ]);
    assert.doesNotMatch(r.said.join("\n"), /Jane|Client|Second|Third|Other|Filed|\.mov|\.mp4/);
    t.done();
  });
  it("says a video being imported, or whose import did not finish, on the other Mac is on that Mac, with no time left from this Mac's panel", async () => {
    const t = setup();
    dropIn(t, "Sallie's laptop", "Other.mov", "other video");
    statusOf(t, { import: "c1", machine: "Sallie's laptop", video: "Other.mov", bytes: 11, step: "Writing the transcript", label: "Video of 20 Oct, 14:50 (Sallie's laptop)", pid: 4343 });
    // A run in this Mac's panel under the same label, alive: its time is this Mac's, never the other Mac's video's.
    mkdirSync(progressFolder(t.home), { recursive: true });
    writeFileSync(join(progressFolder(t.home), "4343.json"), JSON.stringify({ version: 1, pid: 4343, video: "Video of 20 Oct, 14:50 (Sallie's laptop)", step: "Writing the transcript", n: 2, of: 4, percent: 40, left: 180, total: 360, detail: "", started: 0, updated: 0 }));
    dropIn(t, "Sallie's laptop", "Another.mov", "other video");
    statusOf(t, { import: "c2", machine: "Sallie's laptop", video: "Another.mov", bytes: 11, label: "Video of 20 Oct, 14:40 (Sallie's laptop)", at: "2026-10-20T14:40:00-05:00", failed: "the sound could not be read" });
    const r = await on(light(t, { alive: (pid) => pid === 4343 }), "guide");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(2).sort(), [
      "  Video of 20 Oct, 14:40 (Sallie's laptop): Its import did not finish on Sallie's laptop. Say \"try it again\" on that Mac.",
      "  Video of 20 Oct, 14:50 (Sallie's laptop): It is being imported on Sallie's laptop, at Writing the transcript. Wait for the \"Ready\" notice on that Mac."
    ]);
    assert.doesNotMatch(r.said.join("\n"), /Other|Another|\.mov|minute/);
    t.done();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test --test-name-pattern="from the drop folders" tests/edit-guide.test.js`
Expected: FAIL, both tests: in the first, only the drop line, "Under way:" and the waiting video are said; in the second (the other Mac's), only the drop line and "Nothing is under way…".

- [ ] **Step 3: Add the drop folders' videos to `guideItems`**

For each `{ mac, folder }` of `dropFolders(ctx)`, each media file (`isMedia`) that `ctx.stat` finds: its statuses are those of `readStatuses(ctx.root, ctx.now())` for that file and `machine === mac`, a running or held one only at the file's size (as `heldBy` takes them); its state is the first of `failed`/`problem`/`stopped` → `retry`, `held` → `zoom`, `running` → `importing` (with `status.step`), else `arriving`. A file `holdingEpisode` finds an episode for (not `unknown`) is left out unless its state is `retry`. `name`: `labelIn(statuses, video, mac)`, else `capital(unlabelled(video, size))`; `aliases`: the label when there is one; `at`: `readSeen(ctx.home)[seenKey(video, stat)].at` for this Mac's folder, else `stat.ctimeMs`; `here`: `mac === ctx.machine`, and `mac` is set when not `here`. `left` and `total` come only for this Mac's own file (`here`), from the run in `progressFolder(ctx.home)` whose `video` is its label and whose `pid` is `ctx.alive`; for the other Mac's file they are null, whatever this Mac's panel holds. Each such item has `folder: null, record: null`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-guide.test.js
git commit -m "The guide, task 5: the videos in the drop folders, by label or what they are, with the panel's time left

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `guide drop`, `guide drop zoom`, `guide page`, `guide "<video>" show`

**Files:**
- Modify: `tool/edit.js` (`guideCommand`)
- Modify: `tool/tests/edit-labels.test.js` (`walkWords`' `guide` entry)
- Test: `tool/tests/edit-guide.test.js`

**Interfaces:**
- Consumes: Task 4's `guideCommand`, `guideItems`; `OPS_PAGE`, `ZOOM_WORDS`, `dropWords` (Task 1); edit.js's `showInFinder`, `ctx.openApp`; `ctx.deps.run || runProgram`.
- Produces: the forms `drop`, `drop zoom`, `page`, `"<video>" show`.

- [ ] **Step 1: Write the failing tests**

```js
// added to tool/tests/edit-guide.test.js
import { dirname } from "node:path";
import { OPS_PAGE } from "../guide.js";

describe("guide opens a folder, the page, or a file's place in Finder", () => {
  it("opens this Mac's drop folder in Finder and says its Finder words, or why not", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "drop"), { code: 1, said: ["Your drop folder is not there: ask Jason."] });
    mkdirSync(join(t.root, "Drop", "Mac Studio"), { recursive: true });
    assert.deepEqual(await on(light(t), "guide", "drop"), { code: 0, said: ["Opened your drop folder in Finder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio."] });
    assert.deepEqual(t.opened, [["Finder", join(t.root, "Drop", "Mac Studio")]]);
    const broken = light(t, { openApp: () => { throw new Error("Finder could not be opened (/x/y)"); } });
    assert.deepEqual(await on(broken, "guide", "drop"), { code: 1, said: ["Finder could not open your drop folder: ask Jason."] });
    t.done();
  });
  it("opens Zoom Video Transfer, beside BRIMM Video, or says to ask Jason", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "drop", "zoom"), { code: 1, said: ["Zoom Video Transfer is not on this Mac: ask Jason."] });
    const zoom = join(dirname(t.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer");
    mkdirSync(zoom, { recursive: true });
    assert.deepEqual(await on(light(t), "guide", "drop", "zoom"), { code: 0, said: ["Opened Zoom Video Transfer in Finder: Dropbox › The BRIMM DB › BRIMM VIDEO Transfer › Zoom Video Transfer."] });
    assert.deepEqual(t.opened, [["Finder", zoom]]);
    t.done();
  });
  it("opens the BRIMM Ops page, a constant, in the default browser, or says to ask Jason", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "page"), { code: 0, said: ["Opened the BRIMM Ops page in your browser."] });
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: [OPS_PAGE] }]);
    assert.deepEqual(await on(light(t, { run: async () => ({ code: 1, stderr: "no" }) }), "guide", "page"), { code: 1, said: ["The BRIMM Ops page could not be opened: ask Jason."] });
    t.done();
  });
  it("shows in Finder what the step needs: the hand-off, then the video to post; and nothing for a step of brimm-video's", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "show"), { code: 0, said: ["Shown in Finder: the hand-off of Launch talk (a1a1a1)."] });
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    writeFileSync(join(h.folder, "Talk.mp4"), "the video she dropped");
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "show"), { code: 0, said: ["Shown in Finder: the video of Launch talk (a1a1a1), to post."] });
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(h.folder, "final", "Launch talk.brimm-ops.json")] }, { cmd: "/usr/bin/open", args: ["-R", join(h.folder, "Talk.mp4")] }]);
    const raw = handedOff(t, { id: "e-20261020-a3a3a3", name: "2026-10-20 Raw talk (Mac Studio)", text: "Raw talk", kind: "raw" });
    writeGuideNotes(t.home, { version: 1, handoffs: { [raw.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual(await on(light(t), "guide", "Raw talk", "show"), { code: 1, said: ["The video of Raw talk (a3a3a3) is not on this Mac: ask Jason."] });
    writeFileSync(join(raw.folder, "final", "Raw talk.mov"), "its Share");
    assert.equal((await on(light(t), "guide", "Raw talk", "show")).code, 0);
    assert.deepEqual(t.calls.at(-1), { cmd: "/usr/bin/open", args: ["-R", join(raw.folder, "final", "Raw talk.mov")] });
    episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "show"), { code: 1, said: ["There is nothing to show in Finder for Pricing talk (bbbbbb) now."] });
    t.done();
  });
});
```

In `walkWords`, `guide` becomes `[[], [label], [label, "show"], ["drop"], ["drop", "zoom"], ["page"]]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test --test-name-pattern="opens a folder" tests/edit-guide.test.js`
Expected: FAIL: `drop` and `page` fit no video (`No video under way fits that…`), and `show` prints the help with 2.

- [ ] **Step 3: Add the four forms to `guideCommand`**

Before the one-word video form: `["drop"]`, `["drop", "zoom"]`, `["page"]`. The drop folder is `dropFolder(ctx.root, ctx.machine, ctx.settings.drop)`; Zoom Video Transfer is `join(dirname(ctx.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer")`; each is looked for with `ctx.stat` and opened with `ctx.openApp("Finder", folder)`, whose error is never said (it may hold a path), only the test's sentence. The page is `await (ctx.deps.run || runProgram)("/usr/bin/open", [OPS_PAGE])`, and a `code` other than 0 is refused. `[video, "show"]`: the item's `next.stage` must be `ops`; the file is, for step `posted`, `join(folder, "final", handoff.file)` for a raw hand-off, else `join(folder, record.video.file)`; for any other step, `join(folder, record.finished.handoff)`. A file `existsSync` does not find is refused with "The hand-off of …" / "The video of …" "… is not on this Mac: ask Jason."; one it finds goes to `showInFinder(ctx, path)`, and the chat is told only what it is, never its name.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail (edit-labels' walk included: nothing it says holds the client's name).

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-guide.test.js tool/tests/edit-labels.test.js
git commit -m "The guide, task 6: guide drop, drop zoom, page and show, through the stand-ins only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `guide wait`

**Files:**
- Modify: `tool/guide.js` (`WAIT_MS`, `POLL_MS`, `signatureOf`), `tool/edit.js` (`guideCommand`)
- Modify: `tool/tests/edit-labels.test.js` (`walkWords`' `guide` gains `["wait"]`)
- Test: `tool/tests/guide.test.js`, `tool/tests/edit-guide.test.js`

**Interfaces:**
- Consumes: Tasks 4–5's `guideItems`, Task 2's `overviewLines`; `ctx.now`, `ctx.deps.wait` (the stand-in that moves the test's clock).
- Produces: `WAIT_MS = 90000`, `POLL_MS = 5000`, `signatureOf(items: Item[]): string`; the form `wait`.

- [ ] **Step 1: Write the failing tests**

```js
// added to tool/tests/guide.test.js
import { signatureOf, WAIT_MS, POLL_MS } from "../guide.js";
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
});
```

```js
// added to tool/tests/edit-guide.test.js
describe("guide wait", () => {
  /** Have the clock's wait stand-in do `then` once, on the `n`th wait. */
  const onWait = (t, n, then) => {
    let count = 0;
    const wait = t.ctx.deps.wait;
    return async (ms) => {
      await wait(ms);
      if (++count === n) then();
    };
  };
  it("waits in steps of 5 seconds until what the guide says changes, then says it", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    const wait = onWait(t, 2, () => statusOf(t, { import: "b1", video: "Client Jane.mov", label: "Video of 20 Oct, 15:00 (Mac Studio)", at: "2026-10-20T15:00:10-05:00" }));
    const r = await on(light(t, { wait }), "guide", "wait");
    assert.deepEqual(r, { code: 0, said: [DROP_LINE, "Under way:", '  Video of 20 Oct, 15:00 (Mac Studio): It is being imported, at Reading the sound. Wait for the "Ready" notice.'] });
    assert.deepEqual(t.waits, [5000, 5000]);
    t.done();
  });
  it("gives up after 90 seconds, says nothing changed, and says the guide's lines; the time left or a growing file is no change", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    const wait = onWait(t, 3, () => writeFileSync(join(t.root, "Drop", "Mac Studio", "Client Jane.mov"), "a video, still copying in"));
    const r = await on(light(t, { wait }), "guide", "wait");
    assert.equal(r.code, 0);
    assert.equal(r.said[0], "Nothing has changed in 90 seconds.");
    assert.deepEqual(r.said.slice(1, 3), [DROP_LINE, "Under way:"]);
    assert.deepEqual(t.waits, Array(18).fill(5000));
    t.done();
  });
});
```

In `walkWords`, `guide` gains `["wait"]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/guide.test.js tests/edit-guide.test.js`
Expected: FAIL: `signatureOf` is not exported, and `wait` fits no video.

- [ ] **Step 3: Add `WAIT_MS`, `POLL_MS` and `signatureOf` to guide.js, and the `wait` form to `guideCommand`**

`signatureOf` is the JSON of the sorted list, over the items not done, of `[facts.id, next.stage, facts.drop ? facts.drop.step : ""]`: names (which hold a size) and times are left out. `wait`: take the signature of `guideItems(ctx)`, then, while `ctx.now()` is less than `WAIT_MS` after the start, `await wait(Math.min(POLL_MS, what is left))` and read the items again, where `const wait = ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));` as edit.js's other waits have it (lines 4759 and 4793: edit.js has no `sleep`, and every test gives `wait`, so a missing fallback would pass the tests and throw on a real Mac); on a different signature, say the overview and end with 0. At the end of the 90 seconds, say "Nothing has changed in 90 seconds." and then the overview, 0.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/guide.js tool/edit.js tool/tests/guide.test.js tool/tests/edit-guide.test.js tool/tests/edit-labels.test.js
git commit -m "The guide, task 7: guide wait, up to 90 seconds, for a change in what the guide says

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `guide "<video>" done <step>` and `guide "<video>" finished`

**Files:**
- Modify: `tool/edit.js` (`guideCommand`)
- Modify: `tool/tests/edit-labels.test.js` (`walkWords`' `guide` gains `[label, "done", "taken"]`, `[label, "finished"]`)
- Test: `tool/tests/edit-guide.test.js`

**Interfaces:**
- Consumes: Task 1's `noteAfter`; Task 3's `readGuideNotes`, `writeGuideNotes`; Task 4's `guideItems`, `findIn`, `videoLines`; `localStamp` (episode.js).
- Produces: the forms `"<video>" done <step>` and `"<video>" finished`.

- [ ] **Step 1: Write the failing tests**

```js
// added to tool/tests/edit-guide.test.js
import { readGuideNotes, guideFile } from "../guide-note.js";
import { localStamp } from "../episode.js";

const TAKE_TEXT = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
describe("guide notes her word", () => {
  it("notes only the step that comes next, then says the next one", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "done", "posted"), { code: 1, said: [`Not noted: the next step for Launch talk (a1a1a1) is taken. ${TAKE_TEXT}`] });
    assert.ok(!existsSync(guideFile(t.home)));
    const r = await on(light(t), "guide", "Launch talk", "done", "taken");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said.slice(0, 2), ["Noted: Launch talk (a1a1a1), taken.", 'Launch talk (a1a1a1): On the BRIMM Ops page: Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.']);
    assert.equal(r.said.at(-1), "Step: kit");
    assert.deepEqual(readGuideNotes(t.home).handoffs, { [h.record.id]: { kind: "episode", step: "taken", revision: 1, at: localStamp(new Date(t.now())) } });
    // Said again, it is not noted twice.
    assert.equal((await on(light(t), "guide", "Launch talk", "done", "taken")).said[0].startsWith("Not noted: the next step for Launch talk (a1a1a1) is kit."), true);
    t.done();
  });
  it("says a video with the last step noted is done, and the overview leaves it out", async () => {
    const t = setup();
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "live", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    assert.deepEqual(await on(light(t), "guide", "Launch talk", "done", "cascade"), { code: 0, said: ["Noted: Launch talk (a1a1a1), cascade.", "Launch talk (a1a1a1) is done: nothing is left to do for it."] });
    assert.equal((await on(light(t), "guide")).said[1], "Nothing is under way. To start, put the video in your drop folder.");
    t.done();
  });
  it("refuses a step for a video whose next step is brimm-video's, and a note that cannot be written", async () => {
    const t = setup();
    episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "done", "taken"), { code: 1, said: ['Not noted: Pricing talk (bbbbbb) has no step on the BRIMM Ops page now. Claude has read it. Say "what did Claude find?", then answer the spellings card.'] });
    handedOff(t);
    mkdirSync(guideFile(t.home), { recursive: true });
    writeFileSync(join(guideFile(t.home), "x"), "");
    const r = await on(light(t), "guide", "Launch talk", "done", "taken");
    assert.equal(r.code, 1);
    assert.match(r.said.join("\n"), /^Not noted: this Mac's note could not be written \([A-Z]+\)\. Ask Jason\.$/);
    t.done();
  });
  it("takes her word that she is done with a video: it is no longer under way", async () => {
    const t = setup();
    const found = episodeAs(t, VIDEOS.read);
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "finished"), { code: 0, said: ["Pricing talk (bbbbbb) is no longer under way."] });
    assert.deepEqual(readGuideNotes(t.home).finished, { [found.record.id]: localStamp(new Date(t.now())) });
    assert.deepEqual((await on(light(t), "guide", "Pricing talk")).said, ["Pricing talk (bbbbbb) is done: nothing is left to do for it."]);
    dropIn(t, "Mac Studio", "Client Jane.mov");
    assert.deepEqual(await on(light(t), "guide", "A video of 5 bytes", "finished"), { code: 1, said: ["A video of 5 bytes is not imported yet: there is nothing to set aside."] });
    t.done();
  });
});
```

(`existsSync` joins the `node:fs` import of the test file.) In `walkWords`, `guide` gains `[label, "done", "taken"]` and `[label, "finished"]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test --test-name-pattern="notes her word" tests/edit-guide.test.js`
Expected: FAIL: `done` and `finished` print the help and end with 2.

- [ ] **Step 3: Add `done` and `finished` to `guideCommand`**

`[video, "done", step]`: find the item (its `why` refused); a done item → "Not noted: <name> is done: nothing is left to do for it."; a `next.stage` that is not `ops` → "Not noted: <name> has no step on the BRIMM Ops page now. <next.text>"; a word other than `next.step` → "Not noted: the next step for <name> is <next.step>. <next.text>". Otherwise write `{ ...notes, handoffs: { ...notes.handoffs, [handoff.id]: noteAfter(handoff, notes.handoffs[handoff.id], step, localStamp(new Date(ctx.now()))) } }` with `writeGuideNotes`; if it throws, refuse with "Not noted: this Mac's note could not be written (<e.code or "an error">). Ask Jason." Then say "Noted: <name>, <step>." and `videoLines` of that video read again from `guideItems`. `[video, "finished"]`: a drop folder's item (`facts.id === ""`) is refused with "<name> is not imported yet: there is nothing to set aside."; else `finished[facts.id] = localStamp(…)` is written the same way, and it says "<name> is no longer under way." `[video, "done"]` with no step, and any other words, are the help with 2.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-guide.test.js tool/tests/edit-labels.test.js
git commit -m "The guide, task 8: done <step>, only the step that comes next, and finished, on her word

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Her skill's "## Guide her", and the docs

**Files:**
- Modify: `tool/studio/SKILL.md` (the description, line 3; a new section after line 47, before "## What she says, and what to run")
- Modify: `tool/tests/studio.test.js` (the span runs' `run`, its `deps` at lines 439–444; the bare-run list at line 453; a new `it` beside the hand-off rows' test, after line 508)
- Modify: `README.md` (line 16's list of commands; a row after line 17; a line after the "Sallie's card" intro, line 310)
- Modify: `docs/setup/sallies-laptop.md` (a section at the end, after line 71)

**Interfaces:**
- Consumes: every form of `guide` (Tasks 4–8), as her skill runs them.
- Produces: nothing code reads.

- [ ] **Step 1: Write the failing test**

```js
// added to tool/tests/studio.test.js, in the skill's describe
it("guides her one step at a time, a video waiting for her answer first, and takes her word for the BRIMM Ops page", () => {
  const guide = sectionOf(skill, "## Guide her");
  assert.ok(guide.trimEnd().split("\n").length <= 30, `${guide.split("\n").length} lines`);
  for (const words of [
    "run `guide`. Say only the one next step it gives, then ask; never read the list out.",
    "A video waiting for her answer comes first, whatever she said",
    'one `AskUserQuestion`: "Is this video a private session with a client or a group?": "Yes", "No", "It is a Zoom download"',
    "`guide drop zoom`", "`guide drop`", "`guide wait`", "`guide page`", '`guide "<video>"`', '`guide "<video>" show`',
    "held in her drop folder: `guide drop zoom`",
    '"Done?": "Done", "Not yet", "Something\'s different"', '`guide "<video>" done <step>`', '`guide "<video>" finished`',
    '"I posted it"', '"I\'ve done that"', '"guide me"',
    'tell her to choose "Client or group session" and "Yes"',
    "Claude cannot see or press anything on the BRIMM Ops page",
    "isn't set up for the guide yet"
  ]) assert.ok(guide.includes(words), words);
  assert.doesNotMatch(guide, /https?:|claude\.ai/);
});
```

And at line 453, the bare commands run are `["episodes", "behind", "status", "guide"]`.

And in the span runs' `run` (line 439), `deps` gains, after the `--here` line, a light Mac for `guide` alone:

```js
        // The guide works only on a Mac on the light import: anywhere else every form says to ask Jason before its words are
        // read, so a guide span is run on one, where a form edit.js does not take prints the help and ends with 2.
        ...(span.startsWith("guide") ? { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } } : {}),
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/studio.test.js`
Expected: FAIL: `the skill has no section ## Guide her`.

- [ ] **Step 3: Write the section, and the docs**

The description (line 3) gains, after "what is waiting,": " what to do with a new video and what comes next, step by step,". The section, after line 47:

```
## Guide her

When she says she has a video, or asks what to do, what's next, where she was, or for help, or says "guide me": run `guide`. Say only the one next step it gives, then ask; never read the list out.

- Which first: A video waiting for her answer comes first, whatever she said. Then, when she said she has a new video, that one: say in one line how many others are under way, and that "what's next?" picks them up. When she asked what's next or where she was, the newest under way, and the others in one line.
- A new video: ask on one `AskUserQuestion`: "Is this video a private session with a client or a group?": "Yes", "No", "It is a Zoom download". Yes: if its file's name holds the client's name, she renames it first. Then, for Yes or No, `guide drop`: tell her her drop folder is open in Finder, in the words it gives, and to drag the video in.
- A Zoom download, before she drops it or held in her drop folder: `guide drop zoom`, and tell her to drag it there.
- "I've dropped it" / "Is it ready?": `guide wait`, and tell her where it is in one line.
- A video waiting for her answer: the card, as above. If she said "Yes" to the first question in this chat, tell her to choose "Client or group session" and "Yes".
- Any other next step: say it in one or two sentences, offer to do the brimm-video part ("Shall I show it in Final Cut?"), and run it only on her yes, as the table below says.
- A step on the BRIMM Ops page: `guide page` the first time in a session, then `guide "<video>"`, and say its step. Offer to show what it needs in Finder: `guide "<video>" show`. Then ask on one `AskUserQuestion`: "Done?": "Done", "Not yet", "Something's different". Done: `guide "<video>" done <step>`, with the word its Step line gives, and say the next step it prints. Something's different: ask what she sees; if it is not in the walkthrough, tell her to ask Jason.
- "I posted it" / "I've done that": `guide "<video>"` for the video she means (`guide` first, and ask which, if that is unclear); say what is left of its step (such as ticking "Posted"), then ask "Done?" as above.
- "I'm done with it" / "Forget that one": `guide "<video>" finished`.
- Claude cannot see or press anything on the BRIMM Ops page: take her word for each step, and never note a step she has not said is done.
- If it says this Mac isn't set up for the guide yet, tell her so, and to ask Jason; then go on as the rest of this skill says.
```

The docs:
- README line 16 lists `guide` with the commands; a row after line 17: `` | `tool/guide.js`, `tool/guide-note.js` | The guide: the one next step for each video in her words, the BRIMM Ops page's steps, and her note of them on this Mac (`~/Library/Application Support/BRIMM Video/guide.json`) | ``.
- README, after the "Sallie's card" intro (line 310): `Not sure what to do? Say "I have a video" or "what's next?": Claude walks you through it, one step at a time.`
- `docs/setup/sallies-laptop.md`, at the end, "## The guide (2026-10-25)": (1) it works only on a Mac on the light import, so her laptop's switch ("Switching her laptop", above) comes first; until then it says to ask Jason; (2) once its pull request is merged, on each Mac with her folder, pull as under "Jason has a newer brimm-video" above (only when no import is running), then in the checkout run the command `behind` names (`node tool/settings.js studio --node <node>`), then start a new session in her folder (`behind` says her folder is out of date until then); (3) the check: in her folder, say "I have a video": Claude asks whether it is a client or group session, and opens her drop folder in Finder.
  The section holds no git pull in backticks: tests/install.test.js:550–565 takes every line of this guide that holds one as a pull, and requires the check-agent sentences of line 64 on that line. Line 45 (step 11) points to the update the same way.

Then check the skill's length: Run `wc -l tool/studio/SKILL.md`. Expected: under 160.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd tool && node --test`
Expected: PASS, 0 fail. Each `guide` span of the skill runs on a Mac on the light import, with no video under way: `guide wait` waits its 18 steps on the clock stand-in and says nothing changed, `guide page` goes to the `run` stand-in, `guide drop` and `guide drop zoom` find no folder and end with 1, a `<video>` fits none and ends with 1; none prints the help or ends with 2, and each says the same twice. tests/install.test.js's check of every git pull in the setup guide passes too: the new section has none in backticks.

- [ ] **Step 5: Commit**

```bash
git add tool/studio/SKILL.md tool/tests/studio.test.js README.md docs/setup/sallies-laptop.md
git commit -m "The guide, task 9: her skill's Guide her section, and the README and setup notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the merge (not tasks of this plan)

- The managing session adds one line to the BRIMM Video Guide artifact and to "One Video, Start to Finish": "Not sure what to do? Say 'I have a video' or 'what's next?'".
- Deploy as Task 9's setup section says, on each Mac with her folder, her laptop only after its switch.
