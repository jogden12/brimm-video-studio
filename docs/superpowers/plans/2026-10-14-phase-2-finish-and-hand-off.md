# Phase 2, finish and hand-off: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At the end of an edit, Sallie (or Jason) says "finish the episode". brimm-video finds what Final Cut Shared and exported for the episode, asks what it must, and then, detached, transcribes each finished video again, cuts Story parts from the finished Reels, copies everything into the episode's `final/` folder by the Dropbox rule, and writes one hand-off file for BRIMM Ops. Before that, a title can be approved, Reels picked, and a picked Reel pushed to Final Cut as an upright project, so that the hand-off can hold finished Reels before phase 3.

**Architecture:** Six small pure modules first, none of which needs phase 1a: the title in Claude's request (`notes.js`), the hand-off (`handoff.js`) and its contract fixture, the final transcript (`final-transcript.js`), where a finished Reel is cut into Story parts (`reframe.js`), and an episode's parts and the files Final Cut made of each (`parts.js`). Then the commands, in `edit.js`, on phase 1a's modules (names, settings, the Dropbox rule, the record, detached runs, `pushPart`): `name`, `title`, `reel pick|drop`, `push reel <n>`, `finish` (the quick foreground part, which looks and asks), `finish --now` (the detached part, `finish.js`), `status` for a finish, and `free library`.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no npm packages. ffprobe, ffmpeg and whisper.cpp as the import uses them, stood in for in every test.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md` on `main` (e5b5017): section 5 ("The finish") and the phase 2 row of section 7; section 1 for the folders, the Dropbox rule and the record; section 2 for project names; section 4 for detached runs and `push`.

**Status:** Written 2026-10-14 by builder C, for the lead's approval. No code is written until the lead says "approved". Part 1 (Tasks 1 to 6) needs nothing from phase 1a and is built first. Part 2 (Tasks 7 to 12) is built on builder A's phase 1a modules, once they are on `main`, or on A's pushed branch if the lead says to stack on it; until then Part 2's tests are written against the names below and wait. Part 1's tasks carry their whole code and tests. Part 2's tasks carry their code where it does not depend on how 1a's test helpers and `finish.js`'s internals turn out, and otherwise each test by its name and what it asserts, and `finish.js` by its eleven steps: those are written in full against 1a's merged code, test first, with nothing added beyond what is listed.

**After the review of PR #7** (2026-10-14, the lead's 12 fixes and phase 0's renamed copy): Part 1's code and tests as merged are the reference, and where they differ from the code blocks of Tasks 1 to 6 below, the merged code wins. What changed: `inMain` takes the tightest stretch (end at the earliest place the last matched word can be, start at the latest the first can be, a stray first or last word left out) and is kept within the main's length (`inMain(reelWords, mainWords, reelSeconds, mainSeconds)`); `lookFor` looks in From Final Cut and the released files together and takes the Share of the highest version pushed, keeps a part from the last finish unless something newer is there, asks only when two different files are of the highest version or a `--take` names no Share of the part, names the taken video's project in the export question, compares names in NFC, tells a never-pushed part to be shown first, and names a Share Final Cut renamed ("<project> 1"); the order is Share, Final Cut's notice that it is done, then File > Export XML…, then "finish"; `storyCuts` takes `words: null` as none; a title keeps quotation marks inside it; spellings apply to caption text alone.

**Reused from the architect's drafts** (branch `drafts/plans-1a-2-1b`, 03bd414, not merged): `contract.md`'s module, function and file names, as builder A confirmed them on 2026-10-14 (below); `decisions-2.md`'s E1 (title), E2 (records), E3 (the attended part), E4 (the worker), E5 (the hand-off), E6 (offers), E7 (`status`), E8 (tests) and E9 (review focus), each updated here to the merged design. What changed from them, and why, is in "Rulings".

## What phase 1a provides, as builder A confirmed it (2026-10-14)

Part 2 calls these and nothing else of 1a. If A's merged code names one differently, only the call changes.

- `names.js`: `fileSafe(text)`, `shortId(id)`, `projectName({ name, part, v, id })` (`part` is `"main"` or `{ reel: n }`).
- `settings.js`: `readSettings(home)`, `fromFinalCutFolder(home)` (`~/BRIMM Video Work/From Final Cut`), `episodeWork(home, folder)` (`~/BRIMM Video Work/<folder>`), `libraryFor(home, folder)`.
- `dropbox.js`: `cloneIn(from, to, opts)` (files only; `to` must not exist; refuses across disks; no byte copy), `replaceIn(from, to, opts)` (deletes `to`, then `cloneIn`), `lateCheck(entries, opts) → problems[]` (immediate: the caller waits `LATE_CHECK_MS`, 900000, after its last copy), `isWhole(path, { stat })`, `textWriter({ work, clone, log, keep })`. Entries are `{ from, to, bytes }`.
- `episode.js`: `readEpisode(folder) → { record, file } | { why }` (stops on a conflicted copy), `writeEpisode(folder, record, { expectRev, writeText, writer, home })` (throws code `CHANGED` when the other Mac wrote meanwhile), `filesProblems(folder, record, { stat })`, `localStamp(date)`.
- `detached.js`: `startDetached(ctx, { command, folder, args })` (spawns `node <checkout>/tool/edit.js <command> --now <args…>` detached and returns), `runDetached({ home, folder, command, keepAwake, alive, now }, work)` (one lock per episode; `caffeinate`; awaits `work() → { ok, made, failed, next }`; writes `<command>.result.json`), `readResult(home, folder, command)`, `runningCommand(home, folder, alive) → command | ""`.
- `portable.js`: `relativeMedia(xml, …)`, `mediaIn(xml, from)`.
- `edit.js`: `findEpisode` + `readEpisode` give `found = { folder, name, record }`; `pushPart(ctx, found, { part, xml, noHandEdits })` does the guard, the version, the project name, the stored timeline in `edit/`, the local copy, `pushed[]`, the record and `ctx.openApp`. `ctx = { settings, machine, root, episodes, home, say, now, today, openApp, run, wait, writeText, clone, start, running }`.
- The record (section 1, exact fields). `record.reels[i]` at the import: `{ n, status: "candidate", from, to, title, why, files, pushed: [] }`, where `files` are basenames at the episode folder's top level (`<stem>.reel-<n>.mp4`, `<stem>.reel-<n>.srt`, Story parts). A short video has `reels: []`. `pushed[]` entries are `{ v, at, on, file, project }`.
- The import writes `title: { text, from: "claude", approved: false }` from the cut plan's `claude.title` (Task 1 puts it there), or `null`.

## Global Constraints

- Node 22 or later. No npm packages. `cd tool && node --test` runs every test.
- Write a failing test first, then the code (CLAUDE.md).
- The tool drafts. It never posts, sends or publishes anything. The hand-off is a file, shown in Finder, that a person drops on the BRIMM Ops page.
- Nothing is written in place inside Dropbox (spec section 1, the rule): every file reaches the episode folder by 1a's `cloneIn` or `replaceIn`, from the run's own folder or from `~/BRIMM Video Work/`. No rename or move inside Dropbox, no byte copy into it. The late check runs at least 15 minutes after the last copy.
- Final Cut's Shares and File > Export XML… both save into one local folder, `~/BRIMM Video Work/From Final Cut/`, told apart by type: `.mov` `.mp4` `.m4v` are finished videos, `.fcpxmld` `.fcpxml` are exports. Files are found by the project names recorded at each push, never by the episode's current name.
- No test runs the real `claude`, ffprobe, ffmpeg, whisper, `cp -c`, `open`, `pgrep` or Final Cut. Every test works in its own temp folder, with its own home and root: never the real `~/BRIMM Video Work`, Dropbox or progress folder.
- Nothing is installed on a Mac and no launch agent is changed. The installer is run only with `--print`. The lead deploys.
- Work in this worktree (`claude/upbeat-sammet-4d317b`). The main checkout stays on `main`. Never read a `.env` file. Made-up clips only.
- Match the code around it: plain-English JSDoc comments, messages in whole sentences, the person's words in the person's terms.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings (where the spec leaves something open; for the lead to approve)

1. **The title (E1).** Claude's request asks for `"title"`: one on-screen title for the whole video, at most eight words. `readNotes` gives `title` only when the reply has a usable one, so a reply without it is read as before and today's tests stand. The cut plan's `claude` holds it; the import (1a) writes it into the record.
2. **`name` is built here,** though the spec's table puts it in phase 4: the hand-off carries the name, and `finish` refuses a placeholder name.
3. **`title`** (E2): `--approve` locks it; a later change needs `--change`, which says BRIMM Ops may already have the old one. At most 12 words, one line.
4. **`reel pick|drop`** set `status` only. A finished Reel is neither picked nor dropped again. Picking says to push it ("show reel 2 in Final Cut"). Phase 3 (builder B) adds the Reel's own project to pick, behind the same functions.
5. **`push reel <n>` until phase 3** pushes the clip the import cut, whole, as an upright project with its captions (`reel.js`, `reelTimeline`, the seam builder B replaces). Through 1a's `pushPart`, so the guard, versions and project names are the main video's.
6. **`finish` asks; it never guesses** (E3, updated). Without `--yes` it says what it found and what it needs. With `--yes` it starts only when nothing is left to ask. It asks when more than one file fits a part (`--take "<part>=<file>"`), when a picked Reel has no Shared video (Share it, or `--without "reel <n>"`), and, for each part whose newest export is older than its Shared video, or that has none, for File > Export XML… of that project; for a part never exported, `--no-hand-edits "<part>"` is the answer. The main video is never left out. The spec makes the export a question, not a warning (decisions E3.3 said a warning): it is what keeps the hand work.
7. **Where a part comes from:** `From Final Cut/` first; with nothing there, the episode's `edit/from-final-cut/` (what `release` copied in on the other Mac, phase 1b); with nothing there either, the part is kept from the last finish (`final/`), with its transcripts.
8. **Checks** (spec 5, step 4): the shape is a stop for that part (a Reel is upright; the main has the raw video's shape, read from the cut plan's `facts`). The first words and the length are information, written in the result for a person to check by eye: a hand trim at the start changes the first words, and the project name with the episode's short id already ties the file to the part.
9. **Story parts in phase 2:** a preset's job (phase 4) will say which Reels go to Stories. Until then every finished Reel longer than 60 seconds gets Story parts, as the import's clips do today.
10. **`pull` in phase 2:** none. Exports are copied into `final/` as records of the hand work; making one the base is phase 5.
11. **Copies:** into `final/`, by the rule: each finished video under its Shared name, its `.srt`, `.transcript.txt` and `.words.json`, its Story parts, its export (a `.fcpxmld` bundle file by file), then the hand-off. Files of a replaced part stay in `final/`; the record and the hand-off name the current ones. After a clean late check, the files this finish took from `From Final Cut/` are deleted there (spec 5, step 7).
12. **The offers** (E6, updated): render files are freed by the person, through Final Cut's File > Delete Generated Library Files. `free "<episode>" library` deletes the episode's local library only when the spec's three conditions hold (every part has an export newer than its Shared video or had no hand edits; every media path in those exports is inside the episode folder; Final Cut is not running), says what it would delete and its size, and deletes only with `--yes`, and only inside `~/BRIMM Video Work/<folder>/`.

## Review Focus

The inputs most likely to bite a person, each pinned by a test in the task that owns it:

1. **Share still writing the file when the detached part starts** (its size still growing, or ffprobe failing on a file with no index yet). A person expects the finish to wait, and after ten minutes to stop in plain words, never to transcribe half a file. Task 10.
2. **Two Shares of one part.** Of different versions (main v4 and v5, here or released), the highest version is taken; two different files of the highest version are asked about, never picked in silence. Task 6 and Task 9.
3. **An episode name with characters a file cannot hold** ("Pricing: what to charge?"). A person expects the files found by the recorded project names ("Pricing- what to charge- main v5 3fa9c1") and the hand-off to carry the name as given. Task 3 (the fixture) and Task 6.
4. **A second finish after one Reel changed.** A person expects only that Reel transcribed again, every other part kept as it was, and the hand-off's revision up by one. Task 10.
5. **A Reel whose words the main video cut, and an hour-long main.** A person expects no `inMain` for the first, and the search to take well under a second for the second. Task 2.

---

## File structure

| File | What it is for | Task |
|---|---|---|
| `tool/notes.js` | Claude's request asks for a title; `readNotes` reads it; the notes show it | 1 |
| `tool/unedited.js` | The cut plan's `claude` keeps the title; `soundOf` exported for `reel.js` | 1, 8 |
| `tool/handoff.js` (new) | Hand-off version 1: build, check, text; `inMain` | 2 |
| `tool/tests/handoff.test.js` (new) | Its tests and the contract tests | 2, 3 |
| `tool/tests/fixtures/handoff-v1.json`, `handoff-v1-short-video.json` (new) | The contract, copied to brimm-operations for L7 | 3 |
| `tool/final-transcript.js` (new) | A finished video's transcript, made again as the transcript tool makes one | 4 |
| `tool/reframe.js` | `storyCuts`: where a finished Reel is cut into Story parts | 5 |
| `tool/parts.js` (new) | An episode's parts, the files Final Cut made of each, what to ask; `firstWordsMatch` | 6 |
| `tool/edit.js` | `name`, `title`, `reel pick|drop`, `push reel`, `finish`, `finish --now`, `free library` | 7, 8, 9, 10, 11 |
| `tool/reel.js` (new) | `reelTimeline`: the timeline pushed for a Reel until phase 3 | 8 |
| `tool/finish.js` (new) | The detached part of `finish` | 10 |
| `tool/tests/*.test.js` (new, one per module) | Their tests | each |
| `README.md` | "Finishing an episode": the From Final Cut folder, the BRIMM final Share, what `finish` does, the hand-off | 12 |

---

# Part 1: nothing from phase 1a

### Task 1: Claude recommends a title at the import

**Files:**
- Modify: `tool/notes.js` (TASK, `readNotes`, `notesText`)
- Modify: `tool/unedited.js` (the `claude` object written into the cut plan)
- Test: `tool/tests/notes.test.js`, `tool/tests/unedited.test.js`

**Interfaces:**
- Produces: `readNotes(reply).title` (a string of one to eight words, present only when the reply gave one); the cut plan's `claude.title`. Builder A's import reads `claude.title` for the record's `title`.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/notes.test.js`, in its `describe` for `readNotes` (REPLY and READ are that file's):

```js
  it("reads the title Claude recommends for the whole video, on one line, at most eight words, without quotation marks", () => {
    assert.equal(readNotes(JSON.stringify({ ...REPLY, title: "  Know your costs  " })).title, "Know your costs");
    assert.equal(readNotes(JSON.stringify({ ...REPLY, title: '"Price like\nyou mean it"' })).title, "Price like you mean it");
    assert.equal(readNotes(JSON.stringify({ ...REPLY, title: "one two three four five six seven eight nine ten" })).title, "one two three four five six seven eight");
  });
  it("gives no title, and finds nothing wrong, when the reply has none or an empty one", () => {
    assert.deepEqual(readNotes(JSON.stringify(REPLY)), { ...READ, problems: [] });
    assert.deepEqual(readNotes(JSON.stringify({ ...REPLY, title: " " })), { ...READ, problems: [] });
  });
  it("leaves out a title that is not text, and says so", () => {
    const read = readNotes(JSON.stringify({ ...REPLY, title: ["Know", "your", "costs"] }));
    assert.equal("title" in read, false);
    assert.deepEqual(read.problems, ['"title" in its reply is not text, so it was left out.']);
  });
```

And in its `describe` for `notesRequest`:

```js
  it("asks for one title for the whole video, of at most eight words", () => {
    assert.match(notesRequest(PLAN, { video: "talk.mov", duration: 23.4 }), /- "title": one title to put on screen for the whole video, at most eight words/);
  });
```

And for `notesText`:

```js
  it("puts the title Claude recommends first, under a heading of its own", () => {
    const text = notesText({ ...READ, title: "Know your costs", problems: [] }, PLAN, []);
    assert.match(text, /\n\nIts title for the video\nKnow your costs\n\n/);
  });
```

Add to `tool/tests/unedited.test.js`, beside the tests that read the cut plan's `claude`:

```js
  it("keeps the title Claude recommends in the cut plan, for the record", async () => {
    const t = setup({ claude: [answers({ ...REPLY, title: "Know your costs" })] });
    await uneditedFile(t.video, t.deps);
    assert.equal(JSON.parse(readFileSync(t.out("cut-plan.json"), "utf8")).claude.title, "Know your costs");
  });
  it("writes no title into the cut plan when Claude gave none", async () => {
    const t = setup({ claude: [answers(REPLY)] });
    await uneditedFile(t.video, t.deps);
    assert.equal("title" in JSON.parse(readFileSync(t.out("cut-plan.json"), "utf8")).claude, false);
  });
```

(`t.video`, `t.out` and `t.deps` are whatever that file's `setup()` calls them; match the neighbouring tests.)

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/notes.test.js tests/unedited.test.js`
Expected: FAIL: `title` is undefined, and the request has no `"title"` line.

- [ ] **Step 3: Write the code**

In `tool/notes.js`, add to `TASK`, after the `"clips"` line:

```js
  `- "title": one title to put on screen for the whole video, at most ${TITLE_WORDS} words, in plain words with no quotation marks and no emoji. An empty text when nothing fits.`
```

with, above `TASK`:

```js
/** How many words the title Claude recommends may have: a hook on screen is read in a glance. */
const TITLE_WORDS = 8;
```

In `readNotes`, before `return read;`:

```js
  // The title is the one thing a reply may leave out without a word: replies from before it was asked for are whole.
  if (typeof data.title === "string") {
    const title = oneLine(data.title).replace(/^["'“‘]+|["'”’]+$/g, "").split(" ").filter(Boolean).slice(0, TITLE_WORDS).join(" ");
    if (title) read.title = title;
  } else if (data.title !== undefined) read.problems.push('"title" in its reply is not text, so it was left out.');
```

and say so in its JSDoc: "`title`, when the reply gives one, is the on-screen title Claude recommends for the whole video, on one line, at most eight words."

In `notesText`, put first in `under`:

```js
    ["Its title for the video", read.title ? [oneLine(read.title)] : []],
```

In `tool/unedited.js`, where the cut plan's `claude` is made:

```js
      const claude = read ? { ...(read.title ? { title: read.title } : {}), decisions: read.decisions, graphics: read.graphics, ignored, clips: cut.map(/* as now */) } : null;
```

and add "the title it recommends for the whole video" to the comment above it and to the README's `<name>.cut-plan.json` row (Task 12 does the README).

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS, every test, the old ones unchanged.

- [ ] **Step 5: Commit**

```bash
git add tool/notes.js tool/unedited.js tool/tests/notes.test.js tool/tests/unedited.test.js
git commit -m "Ask Claude for a title for the whole video, and keep it in the cut plan"
```

---

### Task 2: `handoff.js`, the hand-off file version 1

**Files:**
- Create: `tool/handoff.js`
- Test: `tool/tests/handoff.test.js`

**Interfaces:**
- Produces, from `tool/handoff.js`:
  - `FORMAT = "brimm-video hand-off"`, `VERSION = 1`
  - `buildHandoff({ record, revision, made, madeOn, commit, main, reels }) → object`: `main = { file, seconds, srt }`, each reel `{ n, title, file, seconds, inMain, srt }` (`inMain` null or `{ start, end }`)
  - `handoffText(handoff) → string` (two-space JSON and a final newline)
  - `handoffFault(handoff) → "" | why`
  - `normalWords(words) → [{ w, start, end }]` (one entry per normalised token)
  - `inMain(reelWords, mainWords, reelSeconds) → { start, end } | null`
- Words everywhere are `{ w, start, end }` in seconds, as `wordsOf` (cuts.js) gives them.

- [ ] **Step 1: Write the failing test**

Create `tool/tests/handoff.test.js`:

```js
// The hand-off file, version 1: what brimm-video gives BRIMM Ops at the end of an edit, and where a Reel's words fall in the
// finished main video. The contract tests, against the fixture builder D copies to brimm-operations, are at the end.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHandoff, handoffText, handoffFault, normalWords, inMain } from "../handoff.js";

const round = (t) => Math.round(t * 1000) / 1000;
/** Words said evenly from `start` to `end`, as the word pass gives them. */
export const spread = (text, start, end) => {
  const said = text.trim().split(/\s+/);
  const each = (end - start) / said.length;
  return said.map((w, i) => ({ w, start: round(start + each * i), end: round(start + each * (i + 1)) }));
};

describe("normalWords", () => {
  it("matches words whatever their case and punctuation, and a number however it is written", () => {
    assert.deepEqual(normalWords([{ w: "Three,", start: 1, end: 1.2 }, { w: "3.", start: 2, end: 2.1 }, { w: "Sallie's", start: 3, end: 3.4 }]).map((x) => x.w), ["3", "3", "sallies"]);
  });
  it("gives each part of a word the word's times, and leaves out what has no letter or number", () => {
    assert.deepEqual(normalWords([{ w: "well-known", start: 1, end: 2 }, { w: "—", start: 2, end: 2.1 }]), [{ w: "well", start: 1, end: 2 }, { w: "known", start: 1, end: 2 }]);
  });
});

describe("inMain", () => {
  const MAIN = [...spread("Welcome to the show. Today we are going to talk about pricing.", 0, 3.9), ...spread("So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 4.1, 11.8)];
  it("finds where a Reel's words fall in the finished main video, to the hundredth of a second", () => {
    assert.deepEqual(inMain(spread("So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 0, 7.7), MAIN, 7.7), { start: 4.1, end: 11.8 });
  });
  it("finds them when the main lost a word or two of the Reel's, at least 90 in 100 of them in order", () => {
    const reel = spread("So the first thing you need to do is know your costs. It is very, very, very important. Thank you so much, Sallie.", 0, 8);
    assert.deepEqual(inMain(reel, MAIN, 8), { start: 4.1, end: 11.8 });
  });
  it("gives nothing when fewer than 90 in 100 of the Reel's words are found there", () => {
    assert.equal(inMain(spread("Welcome to the show. Today we are... Let me do that again.", 0, 4.78), MAIN, 4.78), null);
  });
  it("gives nothing when the words are found only spread over more than one and a half times the Reel's length", () => {
    const far = [...spread("So the first thing you need to do", 0, 3), ...spread("other words ".repeat(40), 3, 40), ...spread("is know your costs", 40, 42)];
    assert.equal(inMain(spread("So the first thing you need to do is know your costs", 0, 4), far, 4), null);
  });
  it("gives nothing for a Reel or a main with no words", () => {
    assert.equal(inMain([], MAIN, 5), null);
    assert.equal(inMain(spread("Know your costs", 0, 2), [], 2), null);
  });
  it("searches an hour of talk in well under a second", () => {
    const talk = "and so we talk about the business and the money and the people who work in it ".repeat(300);
    const said = "So the first thing you need to do is know your costs. It is very, very important.";
    const reel = spread(said, 0, 30);
    const main = [...spread(talk, 0, 1800), ...spread(said, 1800, 1830), ...spread(talk, 1830, 3600)];
    const began = Date.now();
    assert.deepEqual(inMain(reel, main, 30), { start: 1800, end: 1830 });
    assert.ok(Date.now() - began < 1000, `it took ${Date.now() - began} ms`);
  });
});

describe("buildHandoff and handoffFault", () => {
  const RECORD = { version: 1, id: "e-20261014-3fa9c1", rev: 12, kind: "episode", video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "video" }, name: { text: "Pricing: what to charge?", placeholder: false }, title: { text: "Price like you mean it", from: "person", approved: true } };
  const GIVEN = { record: RECORD, revision: 1, made: "2026-10-20T15:02:11-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "a main v5 3fa9c1.mp4", seconds: 11.878, srt: "1\n00:00:00,000 --> 00:00:03,250\n Welcome.\n\n" }, reels: [{ n: 3, title: "Hook", file: "a reel 3 v1 3fa9c1.mp4", seconds: 4.78, inMain: null, srt: "1\n00:00:00,000 --> 00:00:04,780\n Hello.\n\n" }] };
  it("writes the spec's fields in the spec's order, and leaves inMain out when it was not found", () => {
    const h = buildHandoff(GIVEN);
    assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "episode", "main", "reels"]);
    assert.deepEqual(Object.keys(h.episode), ["id", "kind", "name", "recorded", "recordedFrom", "title"]);
    assert.deepEqual(Object.keys(h.reels[0]), ["n", "title", "file", "seconds", "srt"]);
    assert.equal(h.madeBy, "brimm-video c709b57");
    assert.equal(h.episode.name, "Pricing: what to charge?");
    assert.equal(handoffFault(h), "");
  });
  it("gives a title only when it is approved", () => {
    assert.equal(buildHandoff({ ...GIVEN, record: { ...RECORD, kind: "short video", title: { ...RECORD.title, approved: false } }, reels: [] }).episode.title, null);
  });
  it("finds what is wrong with a hand-off, in plain words", () => {
    const h = buildHandoff(GIVEN);
    assert.match(handoffFault({ ...h, version: 2 }), /version 1/);
    assert.match(handoffFault({ ...h, revision: 0 }), /revision/);
    assert.match(handoffFault({ ...h, made: "2026-10-20 15:02" }), /made/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, id: "pricing" } }), /id/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, title: null } }), /title/);
    assert.match(handoffFault({ ...h, main: { ...h.main, srt: "Hello" } }), /main.*captions/);
    assert.match(handoffFault({ ...h, reels: [{ ...h.reels[0], inMain: { start: 5, end: 4 } }] }), /Reel 3/);
    assert.match(handoffFault({ ...h, reels: [h.reels[0], h.reels[0]] }), /Reel 3.*twice/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, kind: "short video" } }), /short video.*no Reels/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/handoff.test.js`
Expected: FAIL with "Cannot find module '../handoff.js'".

- [ ] **Step 3: Write the code**

Create `tool/handoff.js`:

```js
// The hand-off file, version 1: what brimm-video gives BRIMM Ops at the end of an edit, in one file that a person drops on
// the BRIMM Ops page. It holds the episode's final transcript, and each finished Reel with its transcript and its on-screen
// title (spec section 5). Its tests, and the fixture in tests/fixtures that brimm-operations keeps a copy of, are the
// contract between the two: change neither without changing both.
// Nothing here touches a disk or runs a program.
import { tidyTranscript } from "./shared/transcript.js";
import { tokens } from "./shared/text.js";

export const FORMAT = "brimm-video hand-off";
export const VERSION = 1;

/** How many of a Reel's words must be found in the main video, in order, for the hand-off to say where they fall, and how much
    longer than the Reel the stretch of the main they are found in may be. */
const IN_MAIN_SHARE = 0.9;
const IN_MAIN_REACH = 1.5;

/** The hand-off, in the spec's order. `record` is the episode's record; `main` and each of `reels` say what was finished:
    the file's name in final/, its length in seconds and its captions as the transcript tool writes them. `title` is the
    approved title, and null when there is none. A Reel's `inMain` is left out when its words were not found in the main. */
export function buildHandoff({ record, revision, made, madeOn, commit, main, reels = [] }) {
  const title = record.title && record.title.approved ? record.title.text : null;
  return {
    format: FORMAT,
    version: VERSION,
    revision,
    made,
    madeOn,
    madeBy: `brimm-video ${commit}`,
    episode: { id: record.id, kind: record.kind, name: record.name.text, recorded: record.video.recorded, recordedFrom: record.video.recordedFrom, title },
    main: { file: main.file, seconds: main.seconds, srt: main.srt },
    reels: reels.map((r) => ({ n: r.n, title: r.title, file: r.file, seconds: r.seconds, ...(r.inMain ? { inMain: r.inMain } : {}), srt: r.srt }))
  };
}

/** The file's text: JSON set in by two spaces, with a line break at the end. */
export const handoffText = (handoff) => JSON.stringify(handoff, null, 2) + "\n";

const text = (v) => typeof v === "string" && v.trim() !== "";
const seconds = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
/** Captions the BRIMM Ops page can read: tidyTranscript, the page's own reader, makes lines of them. */
const captions = (srt) => text(srt) && /-->/.test(srt) && tidyTranscript(srt).startsWith("[");

/** What is wrong with a hand-off, in plain words, or "" when nothing is. The first fault found is the one given. */
export function handoffFault(h) {
  if (!h || h.format !== FORMAT) return `It is not a ${FORMAT}.`;
  if (h.version !== VERSION) return `It is version ${h.version}, and this reads version ${VERSION}.`;
  if (!Number.isInteger(h.revision) || h.revision < 1) return "Its revision is not a whole number from 1.";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(h.made))) return "The time it was made is not a local time with its offset.";
  if (!text(h.madeOn) || !/^brimm-video \S+$/.test(String(h.madeBy))) return "It does not say which Mac and which brimm-video made it.";
  const e = h.episode || {};
  if (!/^e-\d{8}-[0-9a-f]{6}$/.test(String(e.id))) return "The episode's id is not an id brimm-video gives.";
  if (e.kind !== "episode" && e.kind !== "short video") return "The episode's kind is neither an episode nor a short video.";
  if (!text(e.name)) return "The episode has no name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.recorded)) || !["video", "import"].includes(e.recordedFrom)) return "The day it was recorded, or where that day was read from, is missing.";
  if (e.title !== null && !text(e.title)) return "The title is neither words nor null.";
  if (e.kind === "episode" && e.title === null) return "An episode needs its approved title.";
  const m = h.main || {};
  if (!text(m.file) || !seconds(m.seconds)) return "The main video has no file or no length.";
  if (!captions(m.srt)) return "The main video's captions cannot be read.";
  if (!Array.isArray(h.reels)) return "Its Reels are not a list.";
  if (e.kind === "short video" && h.reels.length) return "A short video has no Reels.";
  const seen = new Set();
  for (const r of h.reels) {
    const which = `Reel ${r && r.n}`;
    if (!Number.isInteger(r.n) || r.n < 1) return "A Reel's number is not a whole number from 1.";
    if (seen.has(r.n)) return `${which} is in it twice.`;
    seen.add(r.n);
    if (!text(r.title) || !text(r.file) || !seconds(r.seconds)) return `${which} has no title, no file or no length.`;
    if (!captions(r.srt)) return `${which}'s captions cannot be read.`;
    if (r.inMain !== undefined) {
      const { start, end } = r.inMain || {};
      if (!(typeof start === "number" && typeof end === "number" && start >= 0 && end > start && end <= m.seconds + 0.01)) return `${which}'s place in the main video is not a stretch of it.`;
    }
  }
  return "";
}

/** Numbers said as words, written as the transcriber writes them in figures, so that "three" and "3" are one word. */
const NUMBERS = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000" };

/** Words as they are matched: lower case, without punctuation, numbers in figures. A word of two parts ("well-known") is two
    words, each with the word's times. What has no letter or figure in it is left out. */
export const normalWords = (words) => words.flatMap((word) => tokens(word.w).map((w) => ({ w: NUMBERS[w] || w, start: word.start, end: word.end })));

/** The most of `a`'s words found in `b` in the same order, not all side by side, and the places in `b` of the first and the
    last of them. */
function inOrder(a, b) {
  const t = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
  }
  let [i, j, first, last] = [a.length, b.length, -1, -1];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      if (last < 0) last = j - 1;
      first = j - 1;
      i -= 1;
      j -= 1;
    } else if (t[i - 1][j] >= t[i][j - 1]) i -= 1;
    else j -= 1;
  }
  return { count: t[a.length][b.length], first, last };
}

const hundredths = (t) => Math.round(t * 100) / 100;

/** Where a finished Reel's words fall in the finished main video, as {start, end} in seconds of the main, or null. They fall
    there when at least 90 in 100 of the Reel's words are found in the main in the same order, inside one stretch no longer
    than one and a half times the Reel. A stretch is tried from each place in the main where one of the Reel's first words is
    said: the first of those words that must be found. */
export function inMain(reelWords, mainWords, reelSeconds) {
  const reel = normalWords(reelWords).map((x) => x.w);
  const main = normalWords(mainWords);
  if (!reel.length || !main.length) return null;
  const need = Math.ceil(reel.length * IN_MAIN_SHARE);
  const opening = new Set(reel.slice(0, reel.length - need + 1));
  const reach = reelSeconds * IN_MAIN_REACH;
  let best = null;
  for (let k = 0; k < main.length; k++) {
    if (!opening.has(main[k].w)) continue;
    let end = k;
    while (end + 1 < main.length && main[end + 1].end - main[k].start <= reach) end += 1;
    const found = inOrder(reel, main.slice(k, end + 1).map((x) => x.w));
    if (found.count >= need && (!best || found.count > best.count)) best = { count: found.count, first: k + found.first, last: k + found.last };
    if (best && best.count === reel.length) break;
  }
  return best ? { start: hundredths(main[best.first].start), end: hundredths(main[best.last].end) } : null;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tool && node --test tests/handoff.test.js`
Expected: PASS. If the hour-long search is slow, keep only the first place of each run of candidate places within the reach whose stretch is the same: the search is already bounded by the Reel's first words.

- [ ] **Step 5: Commit**

```bash
git add tool/handoff.js tool/tests/handoff.test.js
git commit -m "Write the hand-off file, version 1, and find where a Reel's words fall in the main video"
```

---

### Task 3: The contract fixture

**Files:**
- Create: `tool/tests/fixtures/handoff-v1.json`, `tool/tests/fixtures/handoff-v1-short-video.json`
- Test: `tool/tests/handoff.test.js`

**Interfaces:**
- Consumes: Task 2's `buildHandoff`, `handoffText`, `handoffFault`, `inMain`; `tidyTranscript` from `tool/shared/transcript.js` (the page's own reader).
- Produces: the two fixtures, the contract builder D copies into brimm-operations for L7.

The made-up episode is the made-up recording of `tests/fixtures.js`, finished: its main video is what the rough cut keeps (11.878 seconds), Reel 1 is "So the first thing … Sallie" (in the main, so it has `inMain`), and Reel 3 is the opening with its retake (cut from the main, so it has none). The name has characters a file name cannot hold.

- [ ] **Step 1: Write the fixtures and the failing test**

Create `tool/tests/fixtures/handoff-v1.json`:

```json
{
  "format": "brimm-video hand-off",
  "version": 1,
  "revision": 1,
  "made": "2026-10-20T15:02:11-05:00",
  "madeOn": "Mac Studio",
  "madeBy": "brimm-video c709b57",
  "episode": {
    "id": "e-20261014-3fa9c1",
    "kind": "episode",
    "name": "Pricing: what to charge?",
    "recorded": "2026-10-14",
    "recordedFrom": "video",
    "title": "Price like you mean it"
  },
  "main": {
    "file": "Pricing- what to charge- main v5 3fa9c1.mp4",
    "seconds": 11.878,
    "srt": "1\n00:00:00,000 --> 00:00:03,250\n Welcome to the show. Today we are going to talk about\n\n2\n00:00:03,250 --> 00:00:03,900\n pricing.\n\n3\n00:00:04,100 --> 00:00:06,700\n So the first thing you need to do is know your\n\n4\n00:00:06,700 --> 00:00:11,800\n costs. It is very, very important. Thank you so much, Sallie.\n\n"
  },
  "reels": [
    {
      "n": 1,
      "title": "Know your costs",
      "file": "Pricing- what to charge- reel 1 v1 3fa9c1.mp4",
      "seconds": 7.7,
      "inMain": {
        "start": 4.1,
        "end": 11.8
      },
      "srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n2\n00:00:02,600 --> 00:00:07,700\n costs. It is very, very important. Thank you so much, Sallie.\n\n"
    },
    {
      "n": 3,
      "title": "Say it again, better",
      "file": "Pricing- what to charge- reel 3 v2 3fa9c1.mp4",
      "seconds": 4.78,
      "srt": "1\n00:00:00,000 --> 00:00:04,780\n Welcome to the show. Today we are... Let me do that again.\n\n"
    }
  ]
}
```

Create `tool/tests/fixtures/handoff-v1-short-video.json`:

```json
{
  "format": "brimm-video hand-off",
  "version": 1,
  "revision": 2,
  "made": "2026-10-21T09:30:00-05:00",
  "madeOn": "Sallie's laptop",
  "madeBy": "brimm-video c709b57",
  "episode": {
    "id": "e-20261015-0b7d2e",
    "kind": "short video",
    "name": "Know your costs",
    "recorded": "2026-10-15",
    "recordedFrom": "import",
    "title": null
  },
  "main": {
    "file": "Know your costs main v2 0b7d2e.mp4",
    "seconds": 7.7,
    "srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n2\n00:00:02,600 --> 00:00:07,700\n costs. It is very, very important. Thank you so much, Sallie.\n\n"
  },
  "reels": []
}
```

Add to `tool/tests/handoff.test.js`:

```js
import { readFileSync } from "node:fs";
import { tidyTranscript } from "../shared/transcript.js";
import { captionsOf } from "../lib.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
/** The words of captions, said evenly over each caption, as the word pass would time them. */
const wordsOfSrt = (srt) => captionsOf(srt).flatMap((c) => spread(c.text, c.start, c.end));

describe("the contract with BRIMM Ops (fixtures/handoff-v1.json, copied to brimm-operations for L7)", () => {
  const sent = JSON.parse(fixture("handoff-v1.json"));
  const RECORD = { version: 1, id: "e-20261014-3fa9c1", rev: 12, kind: "episode", video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "video" }, name: { text: "Pricing: what to charge?", placeholder: false }, title: { text: "Price like you mean it", from: "person", approved: true } };
  const [mainSrt, reel1, reel3] = [sent.main.srt, sent.reels[0].srt, sent.reels[1].srt];
  const MAIN_WORDS = wordsOfSrt(mainSrt);

  it("is what brimm-video writes for the made-up episode, byte for byte", () => {
    const made = buildHandoff({
      record: RECORD, revision: 1, made: "2026-10-20T15:02:11-05:00", madeOn: "Mac Studio", commit: "c709b57",
      main: { file: "Pricing- what to charge- main v5 3fa9c1.mp4", seconds: 11.878, srt: mainSrt },
      reels: [
        { n: 1, title: "Know your costs", file: "Pricing- what to charge- reel 1 v1 3fa9c1.mp4", seconds: 7.7, inMain: inMain(wordsOfSrt(reel1), MAIN_WORDS, 7.7), srt: reel1 },
        { n: 3, title: "Say it again, better", file: "Pricing- what to charge- reel 3 v2 3fa9c1.mp4", seconds: 4.78, inMain: inMain(wordsOfSrt(reel3), MAIN_WORDS, 4.78), srt: reel3 }
      ]
    });
    assert.equal(handoffText(made), fixture("handoff-v1.json"));
  });
  it("writes the short video's hand-off byte for byte: no title, no Reels", () => {
    const short = JSON.parse(fixture("handoff-v1-short-video.json"));
    const record = { ...RECORD, id: "e-20261015-0b7d2e", kind: "short video", video: { ...RECORD.video, recorded: "2026-10-15", recordedFrom: "import" }, name: { text: "Know your costs", placeholder: false }, title: null };
    const made = buildHandoff({ record, revision: 2, made: "2026-10-21T09:30:00-05:00", madeOn: "Sallie's laptop", commit: "c709b57", main: { file: "Know your costs main v2 0b7d2e.mp4", seconds: 7.7, srt: short.main.srt }, reels: [] });
    assert.equal(handoffText(made), fixture("handoff-v1-short-video.json"));
  });
  it("passes its own check, both of them", () => {
    assert.equal(handoffFault(sent), "");
    assert.equal(handoffFault(JSON.parse(fixture("handoff-v1-short-video.json"))), "");
  });
  it("has captions that the BRIMM Ops page's own reader turns into timed lines, every one", () => {
    for (const name of ["handoff-v1.json", "handoff-v1-short-video.json"]) {
      const h = JSON.parse(fixture(name));
      for (const srt of [h.main.srt, ...h.reels.map((r) => r.srt)]) {
        const lines = tidyTranscript(srt).split("\n");
        assert.ok(lines.length >= 1 && lines.every((line) => /^\[\d+:\d{2}\] \S/.test(line)), `${name}: ${lines.join(" / ")}`);
      }
    }
  });
  it("says where Reel 1 falls in the main, and nothing for Reel 3, whose retake the main cut", () => {
    assert.deepEqual(sent.reels[0].inMain, { start: 4.1, end: 11.8 });
    assert.equal("inMain" in sent.reels[1], false);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd tool && node --test tests/handoff.test.js`
Expected: PASS when Task 2 is right. If a byte-for-byte test fails, the difference is in the code or in the fixture: the fixture is the contract and is changed only on purpose, with the lead told.

- [ ] **Step 3: Commit, push, and tell the lead**

```bash
git add tool/tests/fixtures/handoff-v1.json tool/tests/fixtures/handoff-v1-short-video.json tool/tests/handoff.test.js
git commit -m "Add the hand-off contract fixtures, for BRIMM Ops to read"
git push -u origin claude/upbeat-sammet-4d317b
```

Message the lead ("Page version 3 and footer"): the fixtures are final at `tool/tests/fixtures/handoff-v1.json` and `handoff-v1-short-video.json` on this branch, with the commit, so builder D can copy them.

---

### Task 4: The final transcript, made again

**Files:**
- Create: `tool/final-transcript.js`
- Test: `tool/tests/final-transcript.test.js`

**Interfaces:**
- Consumes: `ffmpegArgs`, `whisperArgs`, `silenceArgs`, `silences`, `dropSilent`, `spellNames`, `stampedText`, `captionCount` (lib.js); `wordArgs`, `wordsOf` (cuts.js); `lastLine` (run.js).
- Produces: `spelled(text, spellings) → string`; `finalTranscript(video, work, { run, tools, model, spellings }) → Promise<{ srt, txt, words, untimed, wav } | { why }>`. `words` is `[{ w, start, end }]`, or null with `untimed` saying why. `wav` is the 16 kHz sound in `work`, for Task 10's pauses.

- [ ] **Step 1: Write the failing test**

Create `tool/tests/final-transcript.test.js`:

```js
// A finished video's transcript, made again as the transcript tool makes one: its own pass for the captions, with its silence
// filter and the show's and the episode's spellings, and the word pass for the times. Stand-ins for ffmpeg and the
// transcriber write what the real ones wrote of the made-up recording in fixtures.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalTranscript, spelled } from "../final-transcript.js";
import { stampedText } from "../lib.js";
import { wordsOf } from "../cuts.js";
import { SRT, TOLD } from "./fixtures.js";

const TOOLS = { ffmpeg: "FFMPEG", whisper: "WHISPER" };
/** Stand-ins: ffmpeg writes the sound and prints `silence`; the transcriber writes SRT, and with -ojf TOLD too, unless told
    the word pass dies. */
function stand({ silence = "", wordPass = "ok", plain = "ok", srt = SRT, sound = "ok" } = {}) {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "FFMPEG" && args.includes("pcm_s16le")) {
      if (sound !== "ok") return { code: 1, stderr: "Invalid data found when processing input\n" };
      writeFileSync(args[args.length - 1], "RIFF");
      return { code: 0, stderr: "" };
    }
    if (cmd === "FFMPEG") return { code: 0, stderr: silence };
    const base = args[args.indexOf("-of") + 1];
    if (args.includes("-ojf")) {
      if (wordPass === "dies") return { code: 134, stderr: "", signal: "SIGABRT" };
      writeFileSync(base + ".json", JSON.stringify(TOLD));
      writeFileSync(base + ".srt", srt);
      return { code: 0, stderr: "" };
    }
    if (plain !== "ok") return { code: 1, stderr: "whisper_init: failed to load model\n" };
    writeFileSync(base + ".srt", srt);
    return { code: 0, stderr: "" };
  };
  return { calls, deps: { run, tools: TOOLS, model: "MODEL" } };
}
const work = () => mkdtempSync(join(tmpdir(), "brimm-final-"));

describe("finalTranscript", () => {
  it("writes the captions with the transcript tool's own pass, and the word times with the word pass", async () => {
    const s = stand();
    const made = await finalTranscript("/v/main.mp4", work(), s.deps);
    const passes = s.calls.filter((c) => c.cmd === "WHISPER");
    assert.equal(passes.length, 2);
    assert.ok(passes[0].args.includes("-osrt") && !passes[0].args.includes("-ojf"));
    assert.ok(passes[1].args.includes("-ojf"));
    assert.equal(made.srt, SRT.replace("Sally", "Sallie"));
    assert.equal(made.txt, stampedText(made.srt));
    assert.deepEqual(made.words, wordsOf(TOLD));
    assert.equal(made.untimed, "");
  });
  it("leaves out a caption written over a long silence, as the transcript tool does", async () => {
    const silence = "[silencedetect @ 0x1] silence_start: 11\n[silencedetect @ 0x1] silence_end: 15 | silence_duration: 4\n";
    const made = await finalTranscript("/v/main.mp4", work(), stand({ silence }).deps);
    assert.doesNotMatch(made.srt, /So the\.\.\./);
    assert.match(made.srt, /^1\n/);
  });
  it("spells the episode's own words as the episode says, after the show's", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), { ...stand().deps, spellings: [["pricing", "Pricing"], ["Sallie", "Sallie Ogden"]] });
    assert.match(made.srt, / Pricing\./);
    assert.match(made.srt, /Thank you so much, Sallie Ogden\./);
    assert.ok(made.words.some((w) => w.w === "Pricing."));
  });
  it("uses the plain pass alone when the word pass dies, and says the word times are missing", async () => {
    const made = await finalTranscript("/v/main.mp4", work(), stand({ wordPass: "dies" }).deps);
    assert.equal(made.words, null);
    assert.equal(made.untimed, "the transcriber could not time the words (it was killed by SIGABRT)");
    assert.equal(made.srt, SRT.replace("Sally", "Sallie"));
  });
  it("says why there is no transcript, in plain words", async () => {
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ sound: "bad" }).deps), { why: "the sound could not be read from it (Invalid data found when processing input)" });
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ plain: "bad" }).deps), { why: "the transcriber stopped (whisper_init: failed to load model)" });
    assert.deepEqual(await finalTranscript("/v/main.mp4", work(), stand({ srt: "" }).deps), { why: "the transcriber found no speech in it" });
  });
});

describe("spelled", () => {
  it("changes whole words only, as they are written", () => {
    assert.equal(spelled("Sally and Sallyanne", []), "Sallie and Sallyanne");
    assert.equal(spelled("the BRIM and the brim", [["BRIM", "BRIMM"]]), "the BRIMM and the brim");
    assert.equal(spelled("a (b)", [["(b)", "c"], ["", "x"]]), "a (b)");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/final-transcript.test.js`
Expected: FAIL with "Cannot find module '../final-transcript.js'".

- [ ] **Step 3: Write the code**

Create `tool/final-transcript.js`:

```js
// The transcript of a finished video, made again, as the transcript tool makes one (spec section 5, step 5; Jason's answer
// 1): the transcriber's own pass writes the captions, without the ones written over a long silence and with the show's and
// the episode's spellings. Those captions go into the hand-off. The word pass writes the time of every word. On some
// recordings the word pass dies, every time: the captions are then the plain pass's alone, and `untimed` says so.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, stampedText, captionCount } from "./lib.js";
import { wordArgs, wordsOf } from "./cuts.js";
import { lastLine } from "./run.js";

/** Why a program ended badly, in plain words. One that was killed gave no reason of its own. */
const reasonOf = (ended) => (ended.signal ? `it was killed by ${ended.signal}` : lastLine(ended.stderr));
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A text with the show's names spelled the way they are spelled, and then the episode's own: each [wrong, right] pair is a
    whole word, matched as it is written. A pair whose wrong word is not a word of letters and figures is passed over. */
export function spelled(text, spellings = []) {
  let out = spellNames(text);
  for (const [wrong, right] of spellings) {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u.test(String(wrong || ""))) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped(wrong)}(?![\\p{L}\\p{N}])`, "gu"), right);
  }
  return out;
}

/** Transcribe a finished video again, in the folder `work`: {srt, txt, words, untimed, wav}, or {why} there is no transcript.
    `deps` gives the programs (`run`, `tools`, `model`) and the episode's `spellings`. */
export async function finalTranscript(video, work, { run, tools, model, spellings = [] }) {
  mkdirSync(work, { recursive: true });
  const wav = join(work, "sound.wav");
  const a = await run(tools.ffmpeg, ffmpegArgs(video, wav));
  if (a.code !== 0 || !existsSync(wav)) return { why: `the sound could not be read from it (${lastLine(a.stderr)})` };
  const plain = join(work, "plain");
  const b = await run(tools.whisper, whisperArgs({ model, wav, outBase: plain }));
  if (b.code !== 0) return { why: `the transcriber stopped (${reasonOf(b)})` };
  const written = existsSync(plain + ".srt") ? readFileSync(plain + ".srt", "utf8") : "";
  const heard = captionCount(written) ? await run(tools.ffmpeg, silenceArgs(wav), { keep: 1000000 }) : null;
  const silent = heard && heard.code === 0 ? silences(heard.stderr) : [];
  const srt = spelled(dropSilent(written, silent).srt, spellings);
  if (!captionCount(srt)) return { why: "the transcriber found no speech in it" };
  const timed = join(work, "timed");
  const c = await run(tools.whisper, wordArgs({ model, wav, outBase: timed }));
  let words = null;
  let untimed = "";
  if (c.code !== 0) untimed = `the transcriber could not time the words (${reasonOf(c)})`;
  else {
    try {
      words = wordsOf(JSON.parse(readFileSync(timed + ".json", "utf8")), { silent }).map((word) => ({ ...word, w: spelled(word.w, spellings) }));
    } catch (e) {
      words = null;
    }
    if (!words || !words.length) {
      words = null;
      untimed = "the transcriber wrote no times for the words";
    }
  }
  return { srt, txt: stampedText(srt), words, untimed, wav };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tool && node --test tests/final-transcript.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/final-transcript.js tool/tests/final-transcript.test.js
git commit -m "Make a finished video's transcript again, as the transcript tool makes one"
```

---

### Task 5: Where a finished Reel is cut into Story parts

**Files:**
- Modify: `tool/reframe.js` (add `storyCuts`; import `framesASecond` from cuts.js)
- Test: `tool/tests/reframe.test.js`

**Interfaces:**
- Produces: `storyCuts(length, { pauses, words, fps }) → [{ start, end }]` on the Reel's own clock. Task 10 cuts each part with `clipArgs({ video, start, end, crop: null, out })`.

- [ ] **Step 1: Write the failing test**

Add to `tool/tests/reframe.test.js`:

```js
describe("storyCuts", () => {
  const words = (pairs) => pairs.map(([start, end]) => ({ w: "word", start, end }));
  it("leaves a Reel of a minute or less whole", () => {
    assert.deepEqual(storyCuts(60, { fps: "30/1" }), [{ start: 0, end: 60 }]);
  });
  it("cuts at the last pause edge in the 15 seconds before the minute", () => {
    assert.deepEqual(storyCuts(75, { pauses: [[40, 41], [50, 51.2]], words: words([[51.2, 74]]), fps: "30/1" }), [{ start: 0, end: 51.2 }, { start: 51.2, end: 75 }]);
  });
  it("cuts in the middle of the widest gap between words when no pause is heard there, as under music", () => {
    assert.deepEqual(storyCuts(75, { words: words([[44, 46], [46.1, 52], [53, 58], [58.2, 74]]), fps: "30/1" }), [{ start: 0, end: 52.5 }, { start: 52.5, end: 75 }]);
  });
  it("cuts at the minute, on the picture before it, when there is neither", () => {
    assert.deepEqual(storyCuts(75, { fps: "30/1" }), [{ start: 0, end: 60 }, { start: 60, end: 75 }]);
    const [first] = storyCuts(75, { fps: "30000/1001" });
    assert.equal(first.end, 1798 / (30000 / 1001));
  });
  it("never cuts where no word comes after, so no part is silence alone", () => {
    assert.deepEqual(storyCuts(61, { pauses: [[59, 61]], words: words([[0, 59]]), fps: "30/1" }), [{ start: 0, end: 60 }, { start: 60, end: 61 }]);
  });
  it("cuts a long Reel into parts of at most a minute each, each counted from the last cut", () => {
    const parts = storyCuts(130, { fps: "30000/1001" });
    assert.equal(parts.length, 3);
    for (const p of parts) assert.ok(p.end - p.start <= 60, JSON.stringify(p));
    assert.equal(parts[2].end, 130);
  });
});
```

(and add `storyCuts` to that file's import from `../reframe.js`).

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/reframe.test.js`
Expected: FAIL: `storyCuts` is not exported.

- [ ] **Step 3: Write the code**

In `tool/reframe.js`, change the import to `import { QUALITY, encodeArgs, framesASecond } from "./cuts.js";` and add after `storyParts`:

```js
/** Where to cut a finished Reel into the parts of a Story, each {start, end} in seconds of the Reel, at most 60 seconds long
    (spec section 5, step 6). A part ends at the last pause edge (where a pause starts or ends) in the 15 seconds before its
    60 second mark. When no pause is heard there, as when music plays under the voice, it ends in the middle of the widest
    gap between two words there. With neither, it ends at the mark. A cut is made only where a word starts after it, so no
    part is silence alone. Every cut is moved back to the start of the picture it falls in, `fps` being the frame rate as
    ffprobe gives it, so a part cut on whole pictures is never longer than 60 seconds. A Reel of 60 seconds or less is one
    part. `pauses` are [start, end] pairs and `words` {w, start, end}, both on the Reel's own clock. */
export function storyCuts(length, { pauses = [], words = [], fps = "" } = {}) {
  const rate = framesASecond(fps);
  const onPicture = (t) => (rate ? Math.floor(t * rate + 1e-6) / rate : t);
  const lastWord = words.length ? Math.max(...words.map((w) => w.start)) : Infinity;
  const parts = [];
  let from = 0;
  while (length - from > STORY_MAX) {
    const mark = from + STORY_MAX;
    const usable = (t) => t > from && t >= mark - STORY_REACH && t <= mark && t <= lastWord;
    const edges = pauses.flat().filter(usable);
    const gaps = words.slice(1).map((w, i) => ({ at: (words[i].end + w.start) / 2, wide: w.start - words[i].end })).filter((g) => g.wide > 0 && usable(g.at));
    const widest = gaps.reduce((best, g) => (!best || g.wide > best.wide ? g : best), null);
    const cut = onPicture(edges.length ? Math.max(...edges) : widest ? widest.at : mark);
    parts.push({ start: from, end: cut });
    from = cut;
  }
  parts.push({ start: from, end: length });
  return parts;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tool && node --test tests/reframe.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reframe.js tool/tests/reframe.test.js
git commit -m "Find where a finished Reel is cut into the parts of a Story"
```

---

### Task 6: `parts.js`, an episode's parts and the files Final Cut made of each

**Files:**
- Create: `tool/parts.js`
- Test: `tool/tests/parts.test.js`

**Interfaces:**
- Produces, from `tool/parts.js`:
  - `partsOf(record) → [{ key, label, reel?, projects, last }]`: `key` is `"main"` or `"reel <n>"`; `projects` are the project names recorded at each push of that part, oldest first; `last` is its last `pushed` entry or null. The main always; each Reel whose `status` is `"picked"` or `"finished"`.
  - `kindOf(name) → "video" | "export" | ""`
  - `lookFor(parts, { fromFinalCut, released, finished }, answers) → { parts: [{ key, label, video, export, kept }], asks: string[], stops: string[], looked: string }`. `fromFinalCut` and `released` are `{ dir, files: [{ name, bytes, mtimeMs }] }`; `finished` is the record's `finished` or null. Each part's `video` and `export` are `{ where: "From Final Cut" | "the other Mac", dir, name, bytes, mtimeMs }` or null; `kept` is true for a part kept from the last finish. `answers` is `{ take: { [key]: name }, noHandEdits: [key], without: [key] }`.
  - `firstWordsMatch(expected, heard) → boolean`

- [ ] **Step 1: Write the failing test**

Create `tool/tests/parts.test.js`:

```js
// An episode's parts (its main video and its picked Reels), the files Final Cut made of each, found by the project names
// recorded at each push, and what finish must ask before it starts. Plain data: no disk.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { partsOf, kindOf, lookFor, firstWordsMatch } from "../parts.js";

const push = (v, project, at = "2026-10-20T10:00:00-05:00") => ({ v, at, on: "Mac Studio", file: `edit/x.v${v}.mac-studio.fcpxml`, project });
const RECORD = {
  kind: "episode",
  name: { text: "Pricing: what to charge?", placeholder: false },
  main: { pushed: [push(4, "Pricing- what to charge- main v4 3fa9c1"), push(5, "Pricing- what to charge- main v5 3fa9c1")] },
  reels: [
    { n: 1, status: "picked", pushed: [push(1, "Pricing- what to charge- reel 1 v1 3fa9c1")] },
    { n: 2, status: "dropped", pushed: [] },
    { n: 3, status: "candidate", pushed: [] }
  ],
  finished: null
};
const file = (name, mtimeMs = 1000, bytes = 5000) => ({ name, bytes, mtimeMs });
const MAIN5 = "Pricing- what to charge- main v5 3fa9c1";
const REEL1 = "Pricing- what to charge- reel 1 v1 3fa9c1";
const NONE = { take: {}, noHandEdits: [], without: [] };
const folders = (fromFinalCut, released = []) => ({ fromFinalCut: { dir: "/h/From Final Cut", files: fromFinalCut }, released: { dir: "/e/edit/from-final-cut", files: released }, finished: null });

describe("partsOf", () => {
  it("is the main video and each Reel picked or finished, with the project names of its pushes", () => {
    const parts = partsOf(RECORD);
    assert.deepEqual(parts.map((p) => p.key), ["main", "reel 1"]);
    assert.deepEqual(parts[0].projects, ["Pricing- what to charge- main v4 3fa9c1", MAIN5]);
    assert.equal(parts[1].last.v, 1);
  });
  it("is the main video alone for a short video", () => {
    assert.deepEqual(partsOf({ ...RECORD, kind: "short video", reels: [] }).map((p) => p.key), ["main"]);
  });
});

describe("kindOf", () => {
  it("tells a finished video from an export by its ending, and passes over the rest", () => {
    assert.deepEqual(["a.mov", "a.MP4", "a.m4v", "a.fcpxmld", "a.fcpxml", "a.mp4.partial", "a.txt", ".a.mp4"].map(kindOf), ["video", "video", "video", "export", "export", "", "", ""]);
  });
});

describe("lookFor", () => {
  it("takes each part's Shared video and its export by the recorded project names, and asks nothing when the export is newer", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000), file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 2500), file("Another episode main v1 9a8b7c.mp4"), file(`${MAIN5} 2.mp4`)]), NONE);
    assert.deepEqual(got.asks, []);
    assert.deepEqual(got.stops, []);
    assert.equal(got.parts[0].video.name, `${MAIN5}.mp4`);
    assert.equal(got.parts[1].export.name, `${REEL1}.fcpxmld`);
  });
  it("passes over an empty file and one still being written under a temporary name", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000, 0), file(`${MAIN5}.mp4.partial`)]), NONE);
    assert.deepEqual(got.parts, []);
    assert.match(got.stops[0], /main video/);
  });
  it("asks which is final when two Shares fit one part, and takes the one named", () => {
    const shares = [file(`${MAIN5}.mp4`, 3000), file("Pricing- what to charge- main v4 3fa9c1.mp4", 2000), file(`${MAIN5}.fcpxmld`, 4000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)];
    const asked = lookFor(partsOf(RECORD), folders(shares), NONE);
    assert.equal(asked.asks.length, 1);
    assert.match(asked.asks[0], /main video.*two.*Pricing- what to charge- main v4 3fa9c1\.mp4.*Pricing- what to charge- main v5 3fa9c1\.mp4/s);
    const told = lookFor(partsOf(RECORD), folders(shares), { ...NONE, take: { main: `${MAIN5}.mp4` } });
    assert.deepEqual(told.asks, []);
    assert.equal(told.parts[0].video.name, `${MAIN5}.mp4`);
  });
  it("asks for File > Export XML… when the export is older than the Shared video, naming the project", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 1000), file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 1000)]), NONE);
    assert.equal(got.parts.length, 2);
    assert.match(got.asks.find((a) => a.includes("Reel 1")), /File > Export XML… on "Pricing- what to charge- reel 1 v1 3fa9c1"/);
    assert.ok(got.asks.every((a) => !/no hand edits/.test(a)));
  });
  it("takes 'no hand edits' as the answer for a part never exported", () => {
    const shares = [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000), file(`${REEL1}.mov`, 2000)];
    assert.match(lookFor(partsOf(RECORD), folders(shares), NONE).asks[0], /Reel 1.*never exported.*no hand edits/s);
    assert.deepEqual(lookFor(partsOf(RECORD), folders(shares), { ...NONE, noHandEdits: ["reel 1"] }).asks, []);
  });
  it("asks about a picked Reel with no Shared video, and leaves it out when told to", () => {
    const shares = [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000)];
    assert.match(lookFor(partsOf(RECORD), folders(shares), NONE).asks[0], /Reel 1.*no Shared video.*leave it out/s);
    const left = lookFor(partsOf(RECORD), folders(shares), { ...NONE, without: ["reel 1"] });
    assert.deepEqual(left.asks, []);
    assert.deepEqual(left.parts.map((p) => p.key), ["main"]);
  });
  it("stops when the main video has no Shared video anywhere, and says where it looked and for which names", () => {
    const got = lookFor(partsOf(RECORD), folders([]), { ...NONE, without: ["main"] });
    assert.match(got.stops[0], /main video.*Share/);
    assert.match(got.looked, /From Final Cut.*Pricing- what to charge- main v5 3fa9c1\.mov/s);
  });
  it("takes a part from what the other Mac released when nothing is newer here, and keeps a part finished before", () => {
    const finished = { revision: 1, parts: { "reel 1": { file: `final/${REEL1}.mov`, noHandEdits: true } } };
    const got = lookFor(partsOf(RECORD), { ...folders([], [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000)]), finished }, NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].video.where, "the other Mac");
    assert.equal(got.parts[1].kept, true);
  });
});

describe("firstWordsMatch", () => {
  it("is true when at least four of the six first words expected are heard, in order, near the start", () => {
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "Welcome to the show today we are going to talk"), true);
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "Okay. Welcome to the show, today we"), true);
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "So the first thing you need to do"), false);
  });
  it("needs every expected word when fewer than six are expected", () => {
    assert.equal(firstWordsMatch("Know your costs", "Know your costs."), true);
    assert.equal(firstWordsMatch("Know your costs", "Know your price"), false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/parts.test.js`
Expected: FAIL with "Cannot find module '../parts.js'".

- [ ] **Step 3: Write the code**

Create `tool/parts.js`:

```js
// An episode's parts, its main video and its picked Reels, and the files Final Cut made of each: the finished videos it
// Shared and the timelines exported with File > Export XML…, both saved into one local folder, From Final Cut (spec section
// 1, rule 6). A file is an episode's when its name, up to the ending, is a project name recorded at one of the episode's
// pushes (spec section 2), never by the episode's current name, which may have changed since. And what finish must ask
// before it can start (spec section 5, steps 1 and 2). Plain data: nothing here touches a disk.
import { extname } from "node:path";
import { tokens } from "./shared/text.js";

const VIDEOS = [".mov", ".mp4", ".m4v"];
const EXPORTS = [".fcpxmld", ".fcpxml"];

/** What a file in From Final Cut is by its ending: a finished video, an export, or neither. A name that starts with a dot is
    neither: macOS and Final Cut keep their own such files. */
export function kindOf(name) {
  const n = String(name);
  if (n.startsWith(".")) return "";
  const end = extname(n).toLowerCase();
  return VIDEOS.includes(end) ? "video" : EXPORTS.includes(end) ? "export" : "";
}
const stem = (name) => String(name).slice(0, String(name).length - extname(String(name)).length);

/** The parts of an episode: the main video, and each Reel picked or finished. A short video has the main alone. */
export function partsOf(record) {
  const named = (pushed) => (Array.isArray(pushed) ? pushed : []).map((p) => p.project).filter(Boolean);
  const last = (pushed) => (Array.isArray(pushed) && pushed.length ? pushed[pushed.length - 1] : null);
  const main = { key: "main", label: "the main video", projects: named(record.main && record.main.pushed), last: last(record.main && record.main.pushed) };
  const reels = record.kind === "short video" ? [] : (record.reels || []).filter((r) => r.status === "picked" || r.status === "finished");
  return [main, ...reels.map((r) => ({ key: `reel ${r.n}`, label: `Reel ${r.n}`, reel: r.n, projects: named(r.pushed), last: last(r.pushed) }))];
}

/** The files in one folder listing that are a part's, of one kind: whole (more than nothing), and named for a project
    recorded at one of its pushes. */
const fitting = (place, part, kind) => place.files.filter((f) => f.bytes > 0 && kindOf(f.name) === kind && part.projects.includes(stem(f.name))).map((f) => ({ ...f, dir: place.dir }));
const newest = (files) => files.reduce((best, f) => (!best || f.mtimeMs > best.mtimeMs ? f : best), null);
const listed = (files) => files.map((f) => f.name).sort().join(", ");

/** What each part is taken from, and what to ask before finish can start. A part's video comes from From Final Cut first,
    then from what the other Mac released into the episode (`released`), and is otherwise kept from the last finish. When
    more than one video fits a part in one place, the person names the final one (`answers.take`). A picked Reel with no
    video is asked about, and left out when the person says so (`answers.without`). The main video is never left out. For
    each part with a new video, its newest export must be newer than that video: a part never exported may instead be
    answered "no hand edits since it was shown" (`answers.noHandEdits`). `asks` are questions; `stops` are what finish
    cannot get past by an answer; `looked` says where it looked and for which names. */
export function lookFor(parts, { fromFinalCut, released, finished }, answers) {
  const { take = {}, noHandEdits = [], without = [] } = answers || {};
  const asks = [];
  const stops = [];
  const out = [];
  for (const part of parts) {
    if (part.key !== "main" && without.includes(part.key)) continue;
    const places = [[fromFinalCut, "From Final Cut"], [released, "the other Mac"]];
    let video = null;
    let exported = null;
    for (const [place, where] of places) {
      const videos = fitting(place, part, "video");
      if (!videos.length) continue;
      const named = take[part.key] ? videos.find((f) => f.name === take[part.key]) : null;
      if (videos.length > 1 && !named) {
        asks.push(`For ${part.label} there are ${videos.length === 2 ? "two" : videos.length} Shared videos in ${where === "From Final Cut" ? "From Final Cut" : "what the other Mac released"}: ${listed(videos)}. Which is the final one?`);
        video = { pending: true };
        break;
      }
      video = { ...(named || videos[0]), where };
      // The export that keeps a video's hand work is the export of the same project.
      exported = newest(fitting(place, part, "export").filter((f) => stem(f.name) === stem(video.name)));
      if (exported) exported = { ...exported, where };
      break;
    }
    // A part waiting on the person's answer is given no file until it has one.
    if (video && video.pending) continue;
    if (!video) {
      const before = finished && finished.parts && finished.parts[part.key];
      if (before) {
        out.push({ ...part, video: null, export: null, kept: true });
        continue;
      }
      if (part.key === "main") stops.push("The main video has not been Shared from Final Cut. Share it into From Final Cut, in BRIMM Video Work, and say finish again.");
      else asks.push(`${part.label} has no Shared video. Share it from Final Cut into From Final Cut, or say to leave it out of this finish.`);
      continue;
    }
    const project = part.projects[part.projects.length - 1] || part.label;
    if (exported && exported.mtimeMs < video.mtimeMs) asks.push(`${part.label}'s export is older than its Shared video. In Final Cut, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut.`);
    else if (!exported && !noHandEdits.includes(part.key)) asks.push(`${part.label} was never exported. If you changed it by hand in Final Cut, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut. If you made no hand edits since it was shown, say so.`);
    out.push({ ...part, video, export: exported, kept: false });
  }
  const names = parts.flatMap((p) => p.projects.slice(-1).flatMap((n) => VIDEOS.map((e) => n + e)));
  const looked = `Looked in ${fromFinalCut.dir} and ${released.dir} for: ${names.join(", ")}.`;
  return { parts: out, asks, stops, looked };
}

/** Does a finished video start with the words its part is expected to start with? At least four of the six first words
    expected (or every one, when fewer are expected) must be among its first twenty words, in the same order. A hand trim at
    the start changes them, so a "no" is for a person to check by eye, and stops nothing. */
export function firstWordsMatch(expected, heard) {
  const want = tokens(expected).slice(0, 6);
  const got = tokens(heard).slice(0, 20);
  let at = 0;
  let found = 0;
  for (const w of want) {
    const k = got.indexOf(w, at);
    if (k !== -1) {
      found += 1;
      at = k + 1;
    }
  }
  return want.length > 0 && found >= Math.min(4, want.length);
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tool && node --test tests/parts.test.js`
Expected: PASS. Adjust only wording in the code, never what a test asks, to make a wording test pass.

- [ ] **Step 5: Commit**

```bash
git add tool/parts.js tool/tests/parts.test.js
git commit -m "Find an episode's finished videos and exports by the project names of its pushes"
```

---

# Part 2: on phase 1a's modules

Part 2 starts when builder A's `names.js`, `settings.js`, `dropbox.js`, `episode.js`, `detached.js`, `portable.js` and `edit.js` are on `main` (rebase on it), or on A's pushed branch if the lead says to stack. Every test builds its own home and root in a temp folder, writes an episode with 1a's `newEpisode` and `writeEpisode`, and gives `ctx.clone` a stand-in (a plain copy: GitHub's Ubuntu runner has no `cp -c`), as 1a's own tests do. A helper at the top of `tool/tests/edit-finish.test.js`, `episodeFor(t, { record })`, makes one episode folder and returns `found`; `t.ctx` is a ctx with `say` collecting lines, `now` fixed, `run` a stand-in for the programs, `openApp`, `start` and `running` recording their calls.

### Task 7: `name`, `title`, `reel pick|drop`

**Files:**
- Modify: `tool/edit.js` (commands and their lines in the help)
- Test: `tool/tests/edit-records.test.js`

**Interfaces:**
- Consumes: 1a's `writeEpisode`, `findEpisode`, `readEpisode`.
- Produces: `nameEpisode(ctx, found, words)`, `titleEpisode(ctx, found, { words, approve, change })`, `pickReels(ctx, found, ns)`, `dropReels(ctx, found, ns)`, each → `Promise<0 | 1>`. The command lines: `name "<episode>" "<name>"`, `title "<episode>" [--words "<words>"] [--approve] [--change]`, `reel pick|drop "<episode>" <n>…`.

- [ ] **Step 1: Write the failing tests**

Create `tool/tests/edit-records.test.js` with these cases (each writes one record and reads the next back with `readEpisode`):

```js
  it("names the episode as it is given, and renames nothing", async () => {
    const t = setup(); const found = episodeFor(t);
    assert.equal(await nameEpisode(t.ctx, found, "  Pricing: what to charge? "), 0);
    const { record } = readEpisode(found.folder);
    assert.deepEqual(record.name, { text: "Pricing: what to charge?", placeholder: false });
    assert.equal(record.rev, found.record.rev + 1);
    assert.deepEqual(readdirSync(dirname(found.folder)), [basename(found.folder)]);
    assert.match(t.said(), /It is called "Pricing: what to charge\?" now\. Nothing was renamed\./);
  });
  it("refuses an empty name", async () => { /* nameEpisode(…, "  ") → 1, no new record */ });
  it("shows the title, who gave it and whether it is approved", async () => { /* titleEpisode(ctx, found, {}) → 0; says 'The title is "Know your costs", recommended by Claude, not yet approved.' */ });
  it("approves Claude's title, and the person's words in its place", async () => {
    /* --approve → { text: "Know your costs", from: "claude", approved: true }; --words "Price like you mean it" --approve on a fresh one → from "person", approved */
  });
  it("refuses to change an approved title without --change, and says BRIMM Ops may have it when changed", async () => {
    /* --words "New" --approve on an approved one → 1 and says '--change'; with change → 0 and says 'BRIMM Ops may already have the old title, so change it there too.' */
  });
  it("refuses a title of more than 12 words or more than one line", async () => { /* → 1 each */ });
  it("picks and drops Reels by number, and says how to show a picked one", async () => {
    /* pickReels(ctx, found, [1, 3]) → statuses picked; says 'Reel 1 is picked. Say "show reel 1 in Final Cut" to have it pushed.'; dropReels([2]) → dropped */
  });
  it("refuses a Reel that is not there, a finished one, and any Reel of a short video", async () => { /* → 1, no new record, plain sentences */ });
  it("writes nothing when the other Mac changed the episode meanwhile", async () => {
    /* a record of rev+1 written behind found's back → 1, says 'this episode changed on the other Mac: open it again' */
  });
```

The bodies marked as comments are written out in full in the test file, in the form of the first case: call the command, check its exit code, check the newest record with `readEpisode`, check what was said with `t.said()`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-records.test.js`
Expected: FAIL: the commands are not exported.

- [ ] **Step 3: Write the code**

In `tool/edit.js`:

```js
/** Write the episode's next record, as `record`, and say `done`. When the other Mac wrote meanwhile, nothing is written and
    the person is told to open it again. Resolves 0 when written, 1 when not. */
async function save(ctx, found, record, done) {
  try {
    writeEpisode(found.folder, record, { expectRev: found.record.rev, writeText: ctx.writeText, writer: ctx.writer, home: ctx.home });
  } catch (e) {
    if (e.code !== "CHANGED") throw e;
    ctx.say(`Nothing was written: ${e.message}.`);
    return 1;
  }
  ctx.say(done);
  return 0;
}
const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};
const oneLine = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

/** Record the episode's name as it is given (spec section 1, "The episode's name"). Nothing is renamed: the folder keeps its
    name, and a project keeps the name it was pushed with. */
export async function nameEpisode(ctx, found, words) {
  const text = oneLine(words);
  if (!text) return refuse(ctx, "Say the name to give the episode.");
  return save(ctx, found, { ...found.record, name: { text, placeholder: false } }, `It is called "${text}" now. Nothing was renamed.`);
}

/** How many words a title on screen may have, when a person gives it. */
const TITLE_MOST = 12;

/** Show the episode's title, or set and approve it (spec section 4, `title`). Claude's recommended title is approved as it
    is, or a person's words take its place. An approved title is locked: changing it needs `change`, because BRIMM Ops may
    already have it. */
export async function titleEpisode(ctx, found, { words, approve = false, change = false } = {}) {
  const now = found.record.title;
  if (words == null && !approve) {
    ctx.say(now ? `The title is "${now.text}", ${now.from === "claude" ? "recommended by Claude" : "given by a person"}, ${now.approved ? "approved" : "not yet approved"}.` : "There is no title yet. Say the words to put on screen.");
    return 0;
  }
  if (now && now.approved && !change) return refuse(ctx, `The title "${now.text}" is approved already. To change it, say to change it (--change): BRIMM Ops may already have it.`);
  if (words != null && /[\r\n]/.test(words)) return refuse(ctx, "A title is one line.");
  const text = words == null ? (now ? now.text : "") : oneLine(words);
  if (!text) return refuse(ctx, "There is no title to approve. Say the words to put on screen.");
  if (text.split(" ").length > TITLE_MOST) return refuse(ctx, `A title is at most ${TITLE_MOST} words, and that is ${text.split(" ").length}.`);
  const title = { text, from: words == null ? now.from : "person", approved: approve };
  const changed = change && now && now.approved && now.text !== text ? " BRIMM Ops may already have the old title, so change it there too." : "";
  return save(ctx, found, { ...found.record, title }, `The title is "${text}"${approve ? ", approved" : ", not yet approved"}.${changed}`);
}

/** Mark Reels picked or dropped, by their numbers. A record only: phase 3 also writes a picked Reel's project here. */
async function markReels(ctx, found, ns, status) {
  const { record } = found;
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  if (!ns.length) return refuse(ctx, "Say which Reels, by their numbers.");
  const reels = (record.reels || []).map((r) => ({ ...r }));
  for (const n of ns) {
    const reel = reels.find((r) => r.n === n);
    if (!reel) return refuse(ctx, `There is no Reel ${n}. The Reels are ${reels.map((r) => r.n).join(", ") || "none"}.`);
    if (reel.status === "finished") return refuse(ctx, `Reel ${n} is finished: it is in the hand-off already.`);
    reel.status = status;
  }
  const said = ns.map((n) => (status === "picked" ? `Reel ${n} is picked. Say "show reel ${n} in Final Cut" to have it pushed.` : `Reel ${n} is dropped.`));
  return save(ctx, found, { ...record, reels }, said.join(" "));
}
export const pickReels = (ctx, found, ns) => markReels(ctx, found, ns, "picked");
export const dropReels = (ctx, found, ns) => markReels(ctx, found, ns, "dropped");
```

and in `editMain`'s dispatch, beside 1a's commands, the four lines (`name`, `title`, `reel pick`, `reel drop`) that find the episode with 1a's `findEpisode`, read it, and call these; the help names them.

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-records.test.js
git commit -m "Name an episode, approve its title, and pick or drop its Reels, as records"
```

---

### Task 8: `push reel <n>`, the clip the import cut, as an upright project

**Files:**
- Create: `tool/reel.js`
- Modify: `tool/unedited.js` (export `soundOf`), `tool/edit.js`
- Test: `tool/tests/reel.test.js`

**Interfaces:**
- Consumes: `probeArgs`, `factsOf`, `roughRate` (cuts.js); `captionsOf` (lib.js); `fcpxml`, `checkFcpxml` (fcpxml.js); `soundOf` (unedited.js); 1a's `relativeMedia`, `isWhole`, `pushPart`.
- Produces: `reelTimeline(found, reel, ctx) → Promise<{ xml } | { why }>` (builder B's seam: phase 3 replaces its body); `pushReel(ctx, found, n, { noHandEdits }) → Promise<0 | 1>`; the command line `push "<episode>" reel <n> [--no-hand-edits]`, in the order 1a's `push … main` takes.

- [ ] **Step 1: Write the failing tests**

Create `tool/tests/reel.test.js`. The stand-in ffprobe writes `probed({ picture: { width: 1080, height: 1920 }, duration: "7.700000" })` from fixtures.js. Cases:

```js
  it("makes the clip the import cut into an upright timeline, whole, with its captions on the clip's own clock", async () => {
    /* episode with reels[0] = { n: 1, status: "picked", files: ["Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"], pushed: [] }
       and those two files in the folder; reelTimeline → { xml }; checkFcpxml(xml, facts) is []; one asset-clip of 7.7 s;
       the format is 1080x1920; captionsOf(srt).length captions; the media named relative to edit/ ("../Pricing%20talk.reel-1.mp4");
       no import-options (no library) */
  });
  it("says why there is no timeline: no clip cut, a clip not yet whole, a clip ffprobe cannot read", async () => { /* { why } each */ });
  it("pushes a picked Reel through the main video's push, as part { reel: n }", async () => {
    /* pushReel(ctx, found, 1, {}) → 0; the record's reels[0].pushed[0].project is "Pricing talk reel 1 v1 <short id>";
       edit/reel-1.v1.<slug>.fcpxml exists; ctx.openApp was called once with the local copy */
  });
  it("refuses a Reel that is not picked, and any Reel of a short video", async () => { /* → 1 */ });
  it("keeps the guard: a second push of the Reel needs --no-hand-edits", async () => { /* second pushReel → 1; with noHandEdits → 0, v2 */ });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/reel.test.js`
Expected: FAIL with "Cannot find module '../reel.js'".

- [ ] **Step 3: Write the code**

In `tool/unedited.js`, `function soundOf` becomes `export function soundOf` (no other change).

Create `tool/reel.js`:

```js
// The timeline brimm-video pushes to Final Cut for a Reel (spec section 7, phase 2). Until phase 3 writes a Reel's own
// project, it is the clip the import cut, whole: upright already, each stretch cropped on the speaker, with its captions on
// the clip's own clock. This is the one function phase 3 replaces.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeArgs, factsOf, roughRate } from "./cuts.js";
import { captionsOf } from "./lib.js";
import { lastLine } from "./run.js";
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { soundOf } from "./unedited.js";
import { relativeMedia } from "./portable.js";
import { isWhole } from "./dropbox.js";

/** The stored timeline of a Reel, as text that names its media relative to the episode's edit/ folder and no library:
    {xml}, or {why} there is none, in plain words. */
export async function reelTimeline(found, reel, ctx) {
  const files = Array.isArray(reel.files) ? reel.files : [];
  const video = files.find((f) => /\.reel-\d+\.mp4$/i.test(f));
  const srt = files.find((f) => /\.reel-\d+\.srt$/i.test(f));
  if (!video) return { why: `Reel ${reel.n} has no clip: the import could not cut it.` };
  const at = join(found.folder, video);
  if (!existsSync(at) || !isWhole(at)) return { why: `Dropbox is still bringing ${video} over. Say it again when it is done.` };
  const work = mkdtempSync(join(ctx.tmpDir || tmpdir(), "brimm-reel-"));
  try {
    const out = join(work, "facts.json");
    const probe = await ctx.run(ctx.tools.ffprobe, probeArgs(at, out));
    const printed = probe.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
    const facts = printed ? factsOf(printed) : null;
    if (!facts || !facts.height) return { why: `${video} could not be read (${lastLine(probe.stderr)}).` };
    const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...soundOf(printed) };
    const captions = srt && existsSync(join(found.folder, srt)) ? captionsOf(readFileSync(join(found.folder, srt), "utf8")) : [];
    const whole = fcpxml({ video: at, facts: said, ranges: [{ start: 0, end: facts.duration }], captions, project: `reel ${reel.n}`, event: found.name });
    const wrong = checkFcpxml(whole, said);
    if (wrong.length) return { why: `its timeline did not pass its own check (${wrong.join(" ")})` };
    return { xml: relativeMedia(whole, { from: join(found.folder, "edit"), episode: found.folder }).xml };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
```

In `tool/edit.js`:

```js
/** Push a picked Reel to Final Cut: its timeline (reelTimeline), through the push every part shares, with its guard. */
export async function pushReel(ctx, found, n, { noHandEdits = false } = {}) {
  const { record } = found;
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const reel = (record.reels || []).find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  if (reel.status !== "picked" && reel.status !== "finished") return refuse(ctx, `Reel ${n} is not picked. Pick it first.`);
  const made = await reelTimeline(found, reel, ctx);
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, found, { part: { reel: n }, xml: made.xml, noHandEdits });
}
```

If 1a's `ctx` has no `tools`, `editMain` adds `tools: findPrograms()` (unedited.js) to it, here and for `finish --now`.

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reel.js tool/unedited.js tool/edit.js tool/tests/reel.test.js
git commit -m "Push a picked Reel to Final Cut as an upright project of the clip the import cut"
```

---

### Task 9: `finish`, the quick part that looks and asks

**Files:**
- Modify: `tool/edit.js`
- Test: `tool/tests/edit-finish.test.js`

**Interfaces:**
- Consumes: Task 6's `partsOf`, `lookFor`; 1a's `filesProblems`, `fromFinalCutFolder`, `episodeWork`, `runningCommand`, `startDetached`.
- Produces: `finishEpisode(ctx, found, answers) → Promise<0 | 1>`; the command line `finish "<episode>" [--yes] [--take "<part>=<file>"]… [--no-hand-edits "<part>"]… [--without "reel <n>"]…`; the file `~/BRIMM Video Work/<folder>/finish.asked.json` = `{ version: 1, at, rev, parts: [{ key, label, reel, video, export, kept, noHandEdits }] }`, which Task 10 reads.

- [ ] **Step 1: Write the failing tests**

In `tool/tests/edit-finish.test.js` (a temp home with `From Final Cut/`, a temp root with one episode), cases:

```js
  it("says what it found for each part and what it is taken for, and starts nothing without a yes", async () => {
    /* main v5 Shared and exported after; reel 1 Shared and answered no hand edits → 0; says each part's file and where;
       ends 'Say "yes, finish it" to start.'; t.started is [] */
  });
  it("starts the detached part with a yes, writes what it was told, and returns at once", async () => {
    /* answers.yes → 0; t.started is [{ command: "finish", folder: found.name, args: [] }]; finish.asked.json holds the parts
       with their files, bytes and times, and the record's rev; says "Started. The panel shows how far it is." */
  });
  it("asks, and starts nothing even with a yes, while anything is left to ask", async () => { /* two Shares of main → 1 question, t.started [] */ });
  it("refuses a placeholder name, a title not approved, a file missing from the episode, and a finish already running", async () => {
    /* each → 1 and its sentence: "Give the episode its name first…", "Approve a title first.", the file named, "finish is running for this episode. Say \"how far is it?\"" */
  });
  it("lets a short video finish without a title", async () => { /* kind "short video", title null → 0 */ });
  it("makes the From Final Cut folder when it is not there, and says where it looked", async () => { /* → stops with looked line; folder exists after */ });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-finish.test.js`
Expected: FAIL: `finishEpisode` is not exported.

- [ ] **Step 3: Write the code**

In `tool/edit.js`:

```js
/** The files of one folder, each {name, bytes, mtimeMs}: none when the folder is not there. An export bundle is a folder,
    and counts by its own time. */
function listing(dir) {
  try {
    return readdirSync(dir).map((name) => {
      const s = statSync(join(dir, name));
      return { name, bytes: s.isDirectory() ? 1 : s.size, mtimeMs: s.mtimeMs };
    });
  } catch (e) {
    return [];
  }
}

/** finish, the quick part (spec section 5, steps 1 and 2): find the finished files and the exports, say what each is taken
    for, and ask what it must. With `answers.yes` and nothing left to ask, start the detached part and return at once. */
export async function finishEpisode(ctx, found, answers = {}) {
  const { record } = found;
  const stops = [];
  if (record.name && record.name.placeholder) stops.push(`Give the episode its name first: it is still called "${record.name.text}", from the video's file name.`);
  if (record.kind !== "short video" && !(record.title && record.title.approved)) stops.push("Approve a title first.");
  stops.push(...filesProblems(found.folder, record, {}));
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) stops.push(`${running} is running for this episode. Say "how far is it?"`);
  const here = fromFinalCutFolder(ctx.home);
  mkdirSync(here, { recursive: true });
  const released = join(found.folder, "edit", "from-final-cut");
  const looked = lookFor(partsOf(record), { fromFinalCut: { dir: here, files: listing(here) }, released: { dir: released, files: listing(released) }, finished: record.finished }, answers);
  for (const part of looked.parts) {
    ctx.say(part.kept ? `${capital(part.label)}: kept as the last finish made it.` : `${capital(part.label)}: ${part.video.name}, from ${part.video.where}${part.export ? `, with its export ${part.export.name}` : (answers.noHandEdits || []).includes(part.key) ? ", with no hand edits" : ""}.`);
  }
  for (const line of [...looked.stops, ...stops]) ctx.say(line);
  for (const line of looked.asks) ctx.say(line);
  if (looked.stops.length || stops.length) {
    ctx.say(looked.looked);
    return 1;
  }
  if (looked.asks.length || !answers.yes) {
    if (!looked.asks.length) ctx.say('Say "yes, finish it" to start.');
    return 0;
  }
  const asked = { version: 1, at: localStamp(ctx.now()), rev: record.rev, parts: looked.parts.map((p) => ({ key: p.key, label: p.label, reel: p.reel, projects: p.projects, video: p.video, export: p.export, kept: p.kept, noHandEdits: (answers.noHandEdits || []).includes(p.key) })) };
  const work = episodeWork(ctx.home, found.name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "finish.asked.json"), JSON.stringify(asked, null, 2) + "\n");
  startDetached(ctx, { command: "finish", folder: found.name, args: [] });
  ctx.say("Started. The panel shows how far it is.");
  return 0;
}
```

(`capital` as in unedited.js; `finish.asked.json` is on this Mac's own disk, in `~/BRIMM Video Work/<folder>/`, so it is written with `writeFileSync`, not by the Dropbox rule.) The dispatch reads `--yes`, each `--take "<part>=<file>"` into `answers.take`, each `--no-hand-edits` and `--without` into their lists, and `finish … --now` goes to Task 10.

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-finish.test.js
git commit -m "Finish an episode, the quick part: find what Final Cut made, say it, and ask"
```

---

### Task 10: `finish --now`, the detached part

**Files:**
- Create: `tool/finish.js`
- Modify: `tool/edit.js` (`finish … --now` runs it inside 1a's `runDetached`)
- Test: `tool/tests/finish.test.js`

**Interfaces:**
- Consumes: Tasks 2 to 6; 1a's `cloneIn`, `replaceIn`, `lateCheck`, `LATE_CHECK_MS`, `readEpisode`, `writeEpisode`, `fileSafe`, `localStamp`, `runDetached`; `probeArgs`, `factsOf`, `pauseArgs`, `pausesOf` (cuts.js); `clipArgs`, `storyCuts`, `STORY_MAX` (reframe.js); `captionsOf` (lib.js); the progress reporter (progress.js).
- Produces: `finishNow(ctx, found, deps) → Promise<{ ok, made, failed, next }>`, the `work()` that 1a's `runDetached` awaits. Its steps for the panel: "Waiting for Final Cut's files", "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode", "Checking the copies".

The steps, in order (spec section 5, steps 3 to 9):

1. Read `finish.asked.json`; re-read the record; when its `rev` is not the asked one, stop: "The episode changed since finish was asked. Say finish again."
2. **Wait until each new file is whole**: two equal sizes `LOOK_MS` (5 s) apart, and ffprobe reads it with a length. Up to ten minutes; then stop: "<file> is still being written by Final Cut. Say finish again when its Share is done." Nothing is transcribed before this passes.
3. **Check each**: its shape (a Reel upright; the main the raw video's shape, from `<stem>.cut-plan.json`'s `facts`): a wrong shape stops that part's finish, and so the whole hand-off, naming the file. Its length against the last push's timeline, and its first words (step 4's transcript) against the part's expected words (the cut plan's first kept phrase, for a Reel the first kept phrase from its `from`): information, in the result's "to check by eye".
4. **Transcribe each changed file again** (`finalTranscript`, with the record's `spellings`), in the run's own folder. A part whose file has the same bytes and time as `finished.parts[key].source` keeps its transcripts from `final/`, read back. A kept part keeps its own.
5. **Story parts** for each finished Reel longer than 60 seconds: pauses from `pauseArgs` on its sound, words from step 4, `storyCuts`, each part cut with `clipArgs({ video, start, end, crop: null, out })` into the run's folder as `<file stem>.story-<k>.mp4`.
6. **`inMain`** for each Reel against the main's words, kept within the main's length (or, with no word times, the words of their captions spread over each caption), and the hand-off: `buildHandoff` with `revision` = the last `finished.revision` + 1 (or 1), `made` = `localStamp(now)`, `madeOn` = this Mac, `commit` = this checkout's short commit; refused if `handoffFault` finds anything.
7. **Copy into `final/` by the rule**, from the run's folder and from where each file was found: each video under its Shared name, `<stem>.srt`, `.transcript.txt`, `.words.json` (when timed), the Story parts, the export (a `.fcpxmld` file by file, a plain `.fcpxml` whole), and the hand-off last, as `final/<fileSafe(name)>.brimm-ops.json`. A name already in `final/` goes in by `replaceIn`; every other by `cloneIn`.
8. **Write the record**: `finished = { revision, at, on, handoff, parts: { [key]: { file, bytes, source: { bytes, mtimeMs }, export | noHandEdits } } }`, each finished Reel `status: "finished"` and `final: { file, seconds }`, `files` gains each file copied in, and `editing` is let go when this Mac held it. On `CHANGED`, the files stay in `final/` and the result says to finish again.
9. **Show the hand-off** in Finder (`ctx.run("/usr/bin/open", ["-R", <hand-off>])`).
10. **The late check**: wait until `LATE_CHECK_MS` after the last copy (the panel says when), then `lateCheck`. When it finds nothing wrong, delete from `From Final Cut/` the files this finish took from there. When it finds something, keep them, and the result says what.
11. **The result**: `{ ok, made, failed, next }`; `next` holds what to check by eye, and the offers: "To save space on this Mac, make the episode's folder online-only: in Finder, Control-click it and choose Make online-only." and "Final Cut's render files can be freed with File > Delete Generated Library Files." and, when every part kept its edit in an export or had no hand edits, "Say 'free the space of <name>' to delete its Final Cut library on this Mac."

- [ ] **Step 1: Write the failing tests**

Create `tool/tests/finish.test.js` with stand-ins for ffprobe (facts by file: main 1280x720 11.878 s, Reels 1080x1920), ffmpeg (sound, silences, pauses, a Story part written), the transcriber (main and Reel captions from the fixture of Task 3), `open` and `clone`, a clock whose `wait` moves time on without waiting, and an episode with one main and two picked Reels, one of them 75 seconds long. Cases:

```js
  it("finishes an episode: final/ holds each video, its transcripts, the Story parts, the export and the hand-off", async () => {
    /* finishNow → ok; listing of final/ is exactly the expected names; the hand-off passes handoffFault, its revision is 1,
       its main.srt is the stand-in's, Reel 2 (75 s) has two Story parts in final/; the record's finished.revision is 1 and
       each Reel's status "finished"; open -R was run on the hand-off */
  });
  it("copies every file into Dropbox by the rule, and none by any other way", async () => {
    /* every file under final/ came through ctx.clone (the stand-in records from → to); no rename into the root */
  });
  it("waits for a file Final Cut is still writing, and transcribes it only when it is whole", async () => {
    /* the main grows for three looks, then settles: the transcriber's first call comes after the last look */
  });
  it("stops after ten minutes of a file still growing, in plain words, and copies nothing", async () => {
    /* → ok false; failed[0] '… is still being written by Final Cut. Say finish again when its Share is done.'; final/ empty */
  });
  it("stops when a Reel is wide or the main is upright, naming the file, and writes no hand-off", async () => { /* … */ });
  it("says, for a person to check, a file whose first words or length are not what was pushed, and finishes all the same", async () => { /* … */ });
  it("on a second finish, transcribes only the Reel that changed, keeps the rest, and raises the revision", async () => {
    /* first finish; then a new Share of reel 1 only; second finishNow → the transcriber ran for reel 1 alone; the hand-off's
       revision is 2 and its main.srt the same as before */
  });
  it("deletes from From Final Cut what it copied in, only after a clean late check 15 minutes after the last copy", async () => {
    /* the clock shows the wait was at least 900000 ms after the last clone; the From Final Cut files are gone; with lateCheck
       stood in to find a problem, they stay and next says so */
  });
  it("writes the files and leaves the record alone when the other Mac changed the episode meanwhile", async () => { /* CHANGED → failed names it */ });
  it("refuses to start when the episode changed since finish was asked", async () => { /* rev differs → ok false, nothing copied */ });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/finish.test.js`
Expected: FAIL with "Cannot find module '../finish.js'".

- [ ] **Step 3: Write the code**

Create `tool/finish.js` with `finishNow` doing the eleven steps above, one small function each: `asked(ctx, found)`, `waitForFiles(entries, deps)`, `shapeFault(part, facts, raw)`, `transcribe(part, work, deps)`, `storyFiles(reel, made, work, deps)`, `handoffFor(found, made, deps)`, `copyIn(found, list, deps)`, `recordFinish(found, made, deps)`, `lateAndTidy(entries, taken, deps)`. Every program is reached through `deps.run` and every copy into Dropbox through 1a's `cloneIn`/`replaceIn` with `ctx.clone`. Each step tells the progress reporter its name, and each encode of a Story part passes `progress.encoding(seconds).args`, as the import's encodes do. Nothing is thrown out of `finishNow`: a failure becomes `{ ok: false, failed: [why] }`, the run's own folder is removed at the end, and what was copied into `final/` stays.

In `tool/edit.js`, `finish "<episode>" --now` runs:

```js
return runDetached({ home: ctx.home, folder: found.name, command: "finish", keepAwake: ctx.keepAwake, alive: ctx.alive, now: ctx.now }, () => finishNow(ctx, found, { progress: ctx.progress }));
```

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/finish.js tool/edit.js tool/tests/finish.test.js
git commit -m "Finish an episode, the detached part: transcribe again, cut Story parts, copy into final/ and write the hand-off"
```

---

### Task 11: `status` for a finish, and `free library`

**Files:**
- Modify: `tool/edit.js`
- Test: `tool/tests/edit-finish.test.js`

**Interfaces:**
- Consumes: 1a's `status`, `readResult`, `libraryFor`, `mediaIn`; `ctx.running(name)` (real: `pgrep -x`).
- Produces: `freeLibrary(ctx, found, { yes }) → Promise<0 | 1>`; the command line `free "<episode>" library [--yes]`.

- [ ] **Step 1: Write the failing tests**

```js
  it("status shows a finish that is running by its progress, and one that ended by its result and its offers", async () => { /* … */ });
  it("free library says what it would delete and how large it is, and deletes only with a yes", async () => { /* … */ });
  it("free library refuses an episode not finished, a part with neither an export nor 'no hand edits', an export naming media outside the episode, and Final Cut running; and deletes nothing", async () => { /* … */ });
  it("free library never deletes anything outside ~/BRIMM Video Work/<episode folder>/", async () => {
    /* libraryFor stood in to give a path outside → refuses, and that path is still there */
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-finish.test.js`
Expected: FAIL.

- [ ] **Step 3: Write the code**

`status`: when 1a's `status` already prints any command's result whole, add only the finish's `next` lines; otherwise print `readResult(home, folder, "finish")`'s `made`, `failed` and `next`.

`freeLibrary`:

```js
/** Delete an episode's Final Cut library on this Mac, to free space (spec section 5, step 9). Only when the episode is
    finished; every part's edit is kept in an export copied into final/, or the part had no hand edits; every media path in
    those exports is inside the episode folder; and Final Cut is not running. Without `yes` it says what it would delete,
    and how large it is. It deletes only inside this Mac's work folder for the episode. */
export async function freeLibrary(ctx, found, { yes = false } = {}) {
  const { finished } = found.record;
  if (!finished) return refuse(ctx, "It is not finished yet, so its library holds work kept nowhere else.");
  const parts = Object.entries(finished.parts || {});
  const unkept = parts.filter(([, p]) => !p.export && !p.noHandEdits).map(([key]) => key);
  if (unkept.length) return refuse(ctx, `The hand work of ${unkept.join(" and ")} is kept only in the library: export it first.`);
  for (const [key, p] of parts.filter(([, p]) => p.export)) {
    const outside = exportMedia(found.folder, p.export).filter((path) => !path.includes(`/Episodes/${found.name}/`));
    if (outside.length) return refuse(ctx, `The export of ${key} uses media outside the episode folder (${outside[0]}). Copy it into media/ first.`);
  }
  if (await ctx.running("Final Cut Pro")) return refuse(ctx, "Quit Final Cut Pro first.");
  const work = episodeWork(ctx.home, found.name);
  const library = libraryFor(ctx.home, found.name);
  if (!resolve(library).startsWith(resolve(work) + "/")) return refuse(ctx, "Its library is not in this Mac's work folder for the episode, so it is left alone.");
  if (!existsSync(library)) return refuse(ctx, "There is no library of it on this Mac.");
  const size = sizeOf(library);
  if (!yes) {
    ctx.say(`This deletes ${library}, ${gigabytes(size)}. Its edits are kept in final/. Say yes to delete it.`);
    return 0;
  }
  rmSync(library, { recursive: true, force: true });
  ctx.say(`Deleted its Final Cut library on this Mac, ${gigabytes(size)}.`);
  return 0;
}
```

with `exportMedia(folder, file)` reading the export copied into `final/` (a bundle's `Info.fcpxml`, or the `.fcpxml`) and giving 1a's `mediaIn` of it as decoded paths, `sizeOf` summing the bundle's files, and `gigabytes` writing "4.2 GB".

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-finish.test.js
git commit -m "Show a finish in status, and free an episode's Final Cut library when its edits are kept"
```

---

### Task 12: README, help, and what is checked by hand

**Files:**
- Modify: `README.md`, `tool/edit.js` (help)
- Test: `tool/tests/edit-records.test.js` (the help names each phase 2 command)

- [ ] **Step 1: Write the failing test**

```js
  it("names every phase 2 command in its help", async () => {
    const help = await helpText();
    for (const words of ["name", "title", "reel pick", "reel drop", "push \"<episode>\" reel", "finish", "free \"<episode>\" library"]) assert.ok(help.includes(words), words);
  });
```

- [ ] **Step 2: Run it to see it fail, then write the help lines; run every test; it passes.**

- [ ] **Step 3: The README**

A new section, "Finishing an episode", after 1a's episode sections, in the README's own voice:
- The one folder on each Mac, `~/BRIMM Video Work/From Final Cut/`, for Shares and File > Export XML… both, and why it is on the Mac's own disk.
- The "BRIMM final" Share destination, set up once on each Mac: Format Video and Audio, Video Codec H.264, each project keeping its own size; made the default, so Command-E is this Share; after Next, save into `From Final Cut`.
- The order, once for each part (the lead's ruling, now in the spec): Share into `From Final Cut`, and wait for Final Cut's notice that it is done; then click in its timeline, File > Export XML…, save into `From Final Cut`; then "finish the episode".
- What `finish` says and asks, and what it does detached (the list of section 5), where the files go (`final/`), and the hand-off, shown in Finder, to drop on the BRIMM Ops page. A link to the fixtures as the contract.
- `name`, `title`, `reel pick|drop`, `push … reel <n>` (the clip the import cut, until phase 3), `free … library`.
- The cut plan's `claude.title` in the `<name>.cut-plan.json` row.
- What has not been tried: no real episode has been finished yet (below).

- [ ] **Step 4: Commit and push**

```bash
git add README.md tool/edit.js tool/tests/edit-records.test.js
git commit -m "Say in the README and the help how an episode is finished and handed off"
git push
```

Then open the pull request to `main` and message the lead its number. The lead reviews and merges.

---

## After the code: checked by hand (each with Jason's yes, after the lead deploys)

On the Mac Studio, on one real episode, once 1a is installed there:

1. The "BRIMM final" Share destination and the `From Final Cut` folder set up (README).
2. `title … --approve`, `reel pick` of one Reel, `push … reel <n>`: the Reel opens in Final Cut, upright, with its captions.
3. The main and the Reel exported (File > Export XML…) and Shared into `From Final Cut`; "finish the episode": what it says, the questions, then the detached run to its end in the panel.
4. `final/` holds what Task 10 says; the late check passed 15 minutes later, and `From Final Cut` was emptied of what it took.
5. The main `.srt` from the hand-off given to the BRIMM Ops page, which reads it as it reads a transcript today; and, once builder D's reader is published, the hand-off file dropped on the page.
6. Phase 0's open facts this rests on: Share's file name is the project's name (Task 6 matches by it); whether Share writes under a temporary name (Task 10 waits on size and ffprobe either way).
