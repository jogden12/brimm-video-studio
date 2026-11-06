# BRIMM Video Studio and BRIMM Ops: the review changes, the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie waits less, answers fewer questions, meets one name and plain words, and keeps her script safe. Phase 1 builds the quick fixes of Jason's change list. Phases 2 and 3 and the posting track are outlined only.

**Architecture:** No new subsystem. Phase 1 changes words, order and a few small rules inside Studio's existing modules, and one page flow in BRIMM Ops. The one new module in Studio is `tool/late-wait.js` (where the late check's due time is read, shared by `app.js`, `guide.js`, `edit.js`). The one new module in BRIMM Ops is `app/tools/second-copy.js`. The hand-off file, its fixtures and `madeBy` do not change.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages) in both repositories. BRIMM Ops builds one HTML file with `node build.js`.

**Spec:** Jason's change list of 5 Nov 2026 (published as https://claude.ai/artifact/Nrv9VMy8AgX9tGG78YyHf1; the copy is `CHANGE-LIST.md` in the review's notes folder `~/Library/Application Support/Claude/side-session-notes/local_cf396f88-dcff-4c95-91e6-1f77aa69803f/team-review-2026-11-05/`). His answers are on https://claude.ai/artifact/5Z8GNkqKe68PcNctRWNnMv. The findings, with file and line, are in the same folder: `arch.md`, `flow.md`, `ux.md`, `reliability.md`; and in `docs/superpowers/notes/2026-11-05-h7-findings.md` on this branch. Each builder gets copies in the plan's workspace. Task ids below (R1a and so on) number the change list's items 1 to 8; item 9 is a by-hand check, not a task.

**Not here:**
- Item 9, the trial of Studio's cuts against TimeBolt or Descript. It is a by-hand check, later. An install needs Jason's yes.
- Sallie's laptop (checks 41 to 48), #35's merge (check 69) and check 70's tidy. By hand.
- H7's Appendix A and B minors, except those named in a task. They wait for a later round (ruling 10).
- Merging either branch. Neither merges, and nothing is pushed, until Jason says so after real-world testing of the current version.

---

## The order

Where the work happens:
- **Studio:** worktree `/Users/jasonogden/Claude Code/brimm-video-studio/.claude/worktrees/studio-review-changes`, branch `claude/studio-review-changes` (cut from #35's tip, 709b4e9). Tests: `cd tool && node --test`.
- **BRIMM Ops:** worktree `/Users/jasonogden/Claude Code/BRIMM operations/.claude/worktrees/ops-review-changes`, branch `claude/ops-review-changes` (cut from main 10d04fa, no upstream; never pushed to main). Tests: `cd app && node --test`.

| Task | What | Repo | Size | Needs |
|---|---|---|---|---|
| R1b | The HyperFrames copy, a Reel's video and a join's video start from the run's own local copy | Studio | M | none |
| R2 | The chat's skill: five rules and H7's slips | Studio | M | none |
| R8a | A branded word-by-word caption style, in the project's notes | Studio | S | none |
| O1 | BRIMM Ops takes a hand-off with one press (R7a) | Ops | M | none |
| O3 | A BRIMM Ops backup before every publish, in a second place (R6c) | Ops | S | Jason's answer to Question 2 |
| R1a | "Ready about" says the wait, everywhere | Studio | S | R1b |
| R3 | One yes at hand-off | Studio | M | R2 |
| R5 | Her script opens as a copy to read | Studio | M | R3 |
| R6a | Sorting out a conflict rewrites the plan's files and speaks plainly | Studio | M | none |
| R6b | "How far is it?" tells of a failed footage copy | Studio | S | none |
| R8b | A line on each Reel pick: why it will hold attention | Studio | M | none |
| R7b | Studio's guide quotes the page's new button (R7b) | Studio | S | O1, R1a |
| O2 | "BRIMM Video Studio" on every screen of the page (R4b) | Ops | M | O1 |
| O4 | A one-page "first week" card in her guide (R6d) | Ops | S | O2 |
| R4a | "BRIMM Video Studio" on every Studio screen | Studio | M | R3, R5 |
| R4c | Plain words for "Not right", "late check" and "ask Jason" | Studio | M | R4a |
| R1c | The reading starts at once too | Studio | L | Jason's yes to Question 1 |

**What runs at the same time, and what waits**

- **Wave A, all at once** (no shared files): R1b, R2, R8a in Studio; O1 and O3 in Ops.
  - R1b: `late-wait.js` (new), `workcopy.js`, `edit.js` (`waitForImport`, the `workcopy` run, :4108-4290).
  - R2: `tool/studio/SKILL.md` and its twin `SKILL-open.md` only.
  - R8a: `project.js` (`brimmRules`) and `project.test.js` only.
  - O1: Ops `views.js`, `app.js`, `main.js`, their tests, and the guide's hand-off steps.
  - O3: Ops `CLAUDE.md`, `README.md`, `app/tools/`.
- **Wave B, after A** (these can run together when they take different files):
  - R1a after R1b (same functions as R1b: `app.js` `readyAt`, `guide.js` `copyStep`, `join.js` `afterJoin`).
  - R3 after R2 (both rewrite parts of `SKILL.md`, and `SKILL-open.md`).
  - R5 after R3 (the skill again, and `edit.js` `plan`).
  - R6a, R6b and R8b have no partner but `edit.js`, and they touch different functions (`resolveIn` :3496, `status` :1952, `reels` :3914 and `reelsText`). They may run beside R1a, R3 and R5 if the coordinator merges one at a time and runs the whole suite after each. If a merge conflicts in `edit.js`, they go one after another.
  - O2 after O1 (`views.js` and the guide HTML).
  - R7b after O1 and R1a (it needs the page's final button words, and `guide.js` is R1a's too).
- **Wave C, last**, one at a time: O4 after O2 (the guide HTML again). R4a after every Studio task that adds or changes a string, since it touches about 20 files. R4c after R4a (`edit.js`, `guide.js`, `app.js`, `footage.js` strings).
- **R1c** waits for Jason's answer. If he says yes it runs after R1a and before R4a.

**Hot spots:** `tool/edit.js` (7,646 lines), `tool/guide.js`, `tool/studio/SKILL.md` with `SKILL-open.md`. One builder at a time on the skill (R2, then R3, then R5, then R4a). Every skill change goes into both files; `studio.test.js:176-180` checks their shared lines, and the cap on the skill's length (the earlier plan's ruling 9) is read from the tests, not guessed.

**Regenerated files the project keeps:**
- `tests/fixtures/today-says.json`: `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command's lines as it did before labels" tests/edit-labels.test.js`. Regenerate only in a task that changes `HELP` (R5 adds a `plan` subcommand; R4a may touch `HELP`'s names). Then read `git diff`: only help lines may change, never a command's printed lines.
- `tests/readings.test.js:36-38`: sha256 of `notesRequest` and the one for `ASK.graphicCues`. R8b changes the ask on purpose; it updates the hash and says so in its commit.
- `tests/contract.test.js`: pins the hand-off fixtures. No task here touches them. If it fails, stop.
- A change to the skill, to `CLAUDE.md` or to `settings.js` text makes her folder read "out of date" on a Mac until `settings.js studio` writes it again, on Jason's yes. This branch is not on any Mac, so nothing happens now. The merge checklist (a later by-hand check) must say so.

---

## Global Constraints

- **Branches:** Studio on `claude/studio-review-changes`, Ops on `claude/ops-review-changes`. Neither merges, and nothing is pushed, without Jason's yes. Builders work in their own worktrees cut from the branch tip, never in `~/Claude Code/brimm-video-studio` itself (the live checkout on main) or in `.claude/worktrees/studio-pr4-app` (draft PR #35's).
- **Posting.** The rule changed on this branch (024fbbd, Jason's yes on 5 Nov): the tools post only what Sallie has approved, through BRIMM Ops and her scheduler. Nothing in Phase 1 posts or adds a way to post: that is the posting track's, with its own design. Studio itself never posts, sends or publishes anything.
- **Never read a `.env` file.** Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes. The installer runs only with `--print`.
- **Write a failing test first, then the code.** The suite passes whole before each commit: `cd tool && node --test` (Studio), `cd app && node --test` (Ops).
- **No test calls the real `claude`, HyperFrames, HeyGen or Dropbox.** Use the stand-ins: `tests/stand-ins/hyperframes.mjs` and the worlds in `tests/*.js` (`workcopy-world.js`, `guide-world.js`, `phase4.js`, `checking-world.js`), and Ops' `app/tests/standins/`.
- **The contract with BRIMM Ops does not change:** `handoff.js`, `handoff-v2.js`, their fixtures (`tests/fixtures/handoff-*.json`), `tool/shared/`, `lib.js`, `run.js`, and `madeBy` = `brimm-video <commit>`. Ops' `HANDOFF_FORMAT` = `"brimm-video hand-off"` stays too. A name change (R4a, O2) never touches these.
- **`tool/guide.js` quotes the page's buttons** (pinned in `tests/guide.test.js:18-24`; Ops pins "Take revision" in `app/tests/views.test.js`). A button renamed in one repository is renamed in the other in the same round: O1 and R7b together.
- **Her chat stays Studio.** A new command lives in its own module and `edit.js` only wires it. In the same commit it gets: an `ASKED` entry (`edit-gate.test.js`); `TODAY_ASKED` and `walkWords` entries (`edit-labels.test.js`); a README row (`part-f-fixes.test.js`); a decision about its gate list (`gate.test.js`). The guard and her folder's settings are not widened.
- **Sessions stay out.** Nothing new prints a session's label, words or file name. A gated video is named by its label only (`gate.js`, `cleanFor`).
- **Words:** short sentences, no path, flag or command name in what she is told (the skill's own rule). The name on screen is "BRIMM Video Studio". Each task lists the exact words.
- **Words, skill and README together:** a change to the skill updates every test that pins its sentences, in the same commit. A change to `HELP` regenerates `today-says.json` as above.
- **Ops build:** modules use only the forms `CLAUDE.md` allows (`import { a } from "./x.js";`, `export const|function|class`). `node build.js` must pass. Publishing needs Jason's yes and a backup first (O3).
- **Commits** end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A late check is never skipped** (R1b). The local copy is used only while this Mac still owes the check for that video, the file is the one that came in (same size, and `sameFile` of the pending), and it is whole. Otherwise the run waits as today. The check itself is still made by the import.
2. **A work copy made from the local file keeps the key of the Dropbox file** (R1b): `workCopyKey({bytes, mtimeMs})` of the episode's own video. If the key differed, the project would say "The recording of … has changed" (`app.js` `recordingChanged`).
3. **A declined card is asked again word for word** (R2, R3). A model is never asked to reword. The test reads the skill text for the rule and for the absence of any "is that the answer you want" wording.
4. **The one press never takes what the page would refuse** (O1). Older revision, same revision, another video, a session's id, a withdrawn episode, a YouTube-link twin: each still refuses in the words it has today, and nothing is saved.
5. **A kept side of a conflict leaves nothing "Not right"** (R6a). After `resolve --keep B`, `episodes` lists no problem for the plan's files, and a refused record write leaves the files as they were.
6. **A session never shows in the new words** (R3, R4a, R6b, O2). The hand-off question, the status line and the notice for a gated video name its label only.

## How each task is built

- **The builder:** one Sonnet builder per task, test first, in its own worktree cut from the branch tip. It reads this task's section, Global Constraints and Review Focus.
- **The review:** a fresh read-only reviewer for each task. A Critical or Important finding gets one fix pass by the builder, test first. A Minor goes into the ledger.
- **The coordinator:** reads every diff that touches `edit.js`, the skill or the contract files; runs the whole suite of the repository; merges in the order above; keeps the ledger `.superpowers/sdd/2026-11-05-review-changes-plan/progress.md`.
- **A pre-flight scan** before a wave, as in the earlier plan: for each pair of tasks, what one produces and the other consumes. The pairs here: R1b to R1a (`localSource`, `lateWaitFor`), O1 to R7b (the button words), R4a to R4c (`STUDIO_NAME`), R3 to R5 (the skill's lines).

---

## Phase 1

### R1b. The copy, the Reel's video and the join start from the local copy

**Goal:** The video for HyperFrames, a Reel's video and a joined video are made from the file this Mac already holds, so none waits fifteen minutes for Dropbox's check, while the check still happens behind them.

**Evidence:** `arch.md` finding 1 and option 1b; `flow.md` F1 to F3.

**Files:**
- Create `tool/late-wait.js` and `tool/tests/late-wait.test.js`.
- Modify `tool/edit.js`:
  - `waitForImport` (:4124): when the hold waits, look for a local source first.
  - The `workcopy` run (:4240-4290): pass the source to `makeWorkCopy`.
  - `lateCheckAt` (:5466) moves to `late-wait.js`; `edit.js` imports it (R1a needs it from `app.js`, which cannot import `edit.js`).
- Modify `tool/workcopy.js`: `makeWorkCopy` (:706) takes `from` (path to read) and keeps `video` as the identity (:728-732).
- Modify `tool/join.js` only if the test below shows the joined video's pending lacks a usable entry (`pendingFor` call at :512).
- Tests: `late-wait.test.js` (new), `edit-workcopy.test.js`, `edit-workcopy-reel.test.js`, `workcopy.test.js`, `join.test.js`.

**Interfaces.** Produces:
- `localSource(ctx, record) -> { path } | null` in `tool/late-wait.js`. It reads this Mac's pending check for the record (`readPendings(ctx.home)`, same id, machine and root as `lateCheckAt`), no `problem`, and returns the pending's `drop` file when `sameFile(pending.drop, pending.dropFile)`, it exists, `isWhole`, and its size equals `record.video.bytes`. For a joined video (the drop is `work/not in a drop folder`, which does not exist) it returns the entry of `pending.entries` whose `from` exists, is whole, has the video's name as its `to`, and has `record.video.bytes`. Otherwise null.
- `lateCheckAt(ctx, record) -> ms | null` moved unchanged.
- `makeWorkCopy({ …, video, from })`: `video` gives the key and the name; `from`, when given, is read instead.

**Failing tests first:**
- `late-wait.test.js`: (a) a pending with a whole drop file of the right size gives that file; (b) a drop file of another size gives null; (c) a drop file that is not the imported one (`sameFile` false) gives null; (d) a pending with `problem` gives null; (e) no pending gives null; (f) a joined video's entry is found; (g) `lateCheckAt` gives the same answers as before (copy its old cases from `edit-guide*.test.js` if any).
- `edit-workcopy.test.js`: "a raw video whose late check is owed is copied at once": a hold that waits plus a local source starts the copy with no `wait` call and no wait step in the panel; the copy's `from` is the drop file; the key is the Dropbox file's (`workCopyKey` of `stat(episode video)`), not the drop file's mtime. "Without a local source it waits as before" (the existing cases stay). "A hold that does not wait (a failed import, a problem found) still ends the run" (local source or not).
- `edit-workcopy-reel.test.js`: the same for a Reel's video (`kinds = REEL_COPY_KINDS`).
- `join.test.js`: after a join the copy of the joined video is made with no wait.
- `workcopy.test.js`: `from` is read and `video` keys it; with no `from`, nothing changes.

**Steps:**
- [ ] Write the tests above; run `cd tool && node --test tests/late-wait.test.js tests/edit-workcopy.test.js tests/edit-workcopy-reel.test.js tests/workcopy.test.js tests/join.test.js`; they fail.
- [ ] Create `late-wait.js` with `localSource` and move `lateCheckAt` into it.
- [ ] `waitForImport`: before the loop sleeps, call `localSource`; on a hit, return `{ record, from: path }` and log `"<name>: the video for HyperFrames is made from the copy this Mac holds, while Dropbox's check of its copies goes on."` (log only). The hold's stops (failed, problem, stopped) still win.
- [ ] The `workcopy` run passes `held.from` to `makeWorkCopy` as `from`.
- [ ] `makeWorkCopy`: read `from` when given; the key, the paths and the "recording changed" check use `video`'s stat.
- [ ] If the late check passes while the copy runs, the open file is still read to its end (an unlinked file stays readable). Add a test with a stand-in that removes the drop file mid-run.
- [ ] Run the whole suite: `cd tool && node --test`. Expected: all pass.
- [ ] Commit.

**Words Sallie sees:** none new. The panel's wait step ("Waiting for the import to check its copies") no longer shows when the local copy is used.

**Contract touched:** none.

**Does not do:** a raw video's reading still waits (see Question 1 and R1c). So for a raw episode and for a joined video, "open it in HyperFrames" still says "Claude is still reading it" until the reading is done. R1b removes the wait for an iPhone clip (its reading does not wait), a finished video's Reel and every copy that is asked for while no reading runs.

**Check:** `cd tool && node --test`.

---

### R1a. "Ready about" says the wait, everywhere

**Goal:** Every time Studio says when something will be ready, the time includes any wait for Dropbox's check that is left.

**Files:**
- `tool/app.js`: `readyAt` (:99-101) and `stillReading` (:103, used at :491 and :495).
- `tool/guide.js`: `copyStep` (:342-345) and the reading's step text; `guide.js` gets the due time as a fact from `edit.js` (the facts object it already reads).
- `tool/join.js`: `afterJoin` (:568-583) notice and the log line at :517.
- `tool/edit.js`: where it builds the guide's facts, and `ranLine` for the copy's result.
- Tests: `app.test.js`, `edit-guide-app.test.js`, `guide.test.js`, `join.test.js`.

**Interfaces.** Consumes `lateCheckAt(ctx, record)` and `localSource` from R1b (`tool/late-wait.js`). Produces `lateWaitFor(ctx, record) -> ms | null`: `lateCheckAt` when the copy would still wait (no `localSource`, or a reading that replaces files is to run), else null.

**Failing tests first:**
- `app.test.js`: with a pending check due at 17:15 and no local source, `readyAt` says `It is ready about 17:26, in 11 minutes, after Dropbox has checked its copies at 17:15.` With a local source, the old sentence. With no measured speed and a due check: `Dropbox checks its copies at 17:15 first.`
- `stillReading` for a raw video whose reading waits: `Claude is still reading it, and starts at 17:15, when Dropbox has checked its copies. …` plus the old ending.
- `guide.test.js`: `copyStep` carries the same time.
- `join.test.js`: the notice after a join says when it opens, `Ready: "X" is made from its footage. It opens in HyperFrames about 17:26. In Claude, say "what's next?"`, and the run's log line (join.js:517) is now also in the result's `made` text for `guide … tell`.

**Steps:**
- [ ] Write the tests; run them; they fail.
- [ ] Add `lateWaitFor` to `late-wait.js`.
- [ ] Thread it into `readyAt`, `stillReading`, `copyStep`, `afterJoin`.
- [ ] Whole suite. Commit.

**Words Sallie sees:**
- `The video for HyperFrames is being made. It is ready about 17:26, in 11 minutes, after Dropbox has checked its copies at 17:15. Say "open X in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`
- `Claude is still reading it. It starts at 17:15, when Dropbox has checked its copies. Say "open X in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.`
- `Ready: "X" is made from its footage. It opens in HyperFrames about 17:26. In Claude, say "what's next?"`

**Contract touched:** none. `guide.js` lines before `opsStep` change; the page's steps do not.

**Check:** `cd tool && node --test`.

---

### R1c. The reading starts at once too (Jason: "Yes, build it now", 5 Nov)

**Goal:** On the Mac that imported a raw video, Claude's reading starts as soon as she answers, not when the import's late check is made. When the reading puts its files in, it takes them out of that check, under a lock the check also takes. So the check never puts the import's older file back over the reading's, and every other file of the import is still checked. A raw episode then opens in HyperFrames about fifteen minutes sooner, less the time she took to answer.

**Evidence:** `arch.md` finding 1 and option 1b ("Let the reading keep the late check's entries in step"). `flow.md` F1 and F4: the wait before Claude reads is 13 of the 21 minutes before the edit.

**Why it waits today, in the code:**
- `dropbox.js` `lateCheck` (:89-110) judges a file by its size alone (:93). A file of another size than its entry is put in again from the import's work copy, whoever wrote it.
- A raw reading replaces four files that the light import's pending names: `<stem>.cut-plan.json`, `<stem>.cut-plan.txt`, `<stem>.rough-cut.srt` and `<stem>.rough-cut.transcript.txt`. The full import's pending also names `edit/main.v0.fcpxml`, `<stem>.edit-notes.txt` and `reels.json`. So `reading.js` (:296-311) waits on `importHold` (`unedited.js` :1707) while the check is owed.
- Only the import's run makes the check: `filing.js` `finishDue` (:604-612) and its loop (:705-730), from this Mac's pending file (`writePending` :367, `readPendings` :375). Nothing locks the pending today. Nothing else writes it but `noteProblem` (:499-513), inside the check.

**Files:**
- `tool/filing.js`:
  - New: `lateCheckLockOf`, `takeLateCheckLock`, `releaseLateCheckLock`, `settleReading`, `LOCK_AGAIN_MS`.
  - `finishDue` (:604-612): each due check takes the lock, and is put off while a reading holds it. Under the lock it reads the pending again, settles a reading's mark, and gives the fresh pending to `finishLate`. It returns how many checks it put off.
  - The wait loop (:705-730): when `finishDue(false)` put one off, it waits `LOCK_AGAIN_MS` before it looks again.
  - The per-minute timer (:663-673) is unchanged, but for what `finishDue` now does.
  - `finishLate`, `noteProblem`, `pendingFor`, `writePending` and `readPendings` are unchanged. Once a reading has taken the cut plan's text out of the check, `noteProblem` finds no entry for it and writes nothing (:503-504).
  - New imports: `takeEpisodeLock` and `releaseEpisodeLock` from `detached.js`, `episodeWork` from `settings.js`, `recordNumbers` from `episode.js`. `detached.js` imports `caffeinate` and `thisCheckout` from `filing.js`. Each is used only when called, as `filing.js` says of `kinds.js` at :21, so the cycle costs nothing at load.
- `tool/late-wait.js` (R1b's module; R1a adds `lateWaitFor` to it):
  - New: `ownCheckOnly`, `readingWaitsUntil`, `keepCheckInStep`, `LOCK_LOOK_MS`, `LOCK_WAIT_MS`.
  - R1a's `lateWaitFor`: its clause "a reading that replaces files is to run" holds only while `readingWaitsUntil(ctx, record)` is not null. (If R1a named things otherwise, follow its names.)
- `tool/reading.js`:
  - New `asFiled(folder, record)`: every file the record's `files` lists, the video among them, is in the folder at its listed size. False when the record lists none.
  - `readEpisodeNow`'s hold loop (:296-311): before it waits or stops, it breaks and reads now when `ownCheckOnly(ctx, record) && asFiled(found.folder, record)`, with a log line.
  - `written` (:437-597): `keepCheckInStep` right before `intoEpisode` (:588); `end({ put: true })` first thing in the `onPut` it gives `intoEpisode`; `end({ put: false })` after `intoEpisode` returns, and in a `finally`. Two failed lines (Words, below).
  - The header comment (:7-10) and `readEpisodeNow`'s comment (:255-257): what a reading waits for now.
- `tool/edit.js`:
  - `answerKind` (:5954): `holdsUntil` comes from `readingWaitsUntil(ctx, wrote.record)`, in place of `lateCheckAt`. Its words at :5966 stay, for a reading that still waits.
  - `guideReading` (:6877): `due` comes from `readingWaitsUntil(ctx, r)`.
- `README.md`: the `kind` row (:278, "a raw video's reading waits for the import's late check"), the `guide` row (:317, "While a raw video's reading waits for the import's late check"), and `late-wait.js`'s row.
- Not changed: `dropbox.js`; `unedited.js` (`intoEpisode`, `importHold`); `join.js`; `workcopy.js`; `guide.js`; the skill; `app.js` (it changes only through `lateWaitFor`).
- Tests: `late-wait.test.js`, `filing.test.js`, `reading.test.js`, `edit-kind.test.js`, `edit-guide.test.js`, and R1a's cases in `app.test.js`.

**Interfaces.**

Consumes: R1b's `lateCheckAt(ctx, record)` (`late-wait.js`); R1a's `lateWaitFor(ctx, record)`; `importHold` (`unedited.js`); `readPendings`, `writePending` (`filing.js`); `readStatuses`, `holdsVideo`, `importState` (`importing.js`); `takeEpisodeLock`, `releaseEpisodeLock` (`detached.js`); `readEpisode`, `recordNumbers` (`episode.js`); `intoEpisode`'s `onPut`, as it is.

Produces:
- The pending file (this Mac's own disk; its version stays 1) may hold `reading: { pid, at, to }`. It says a reading of this Mac is putting in the files at `to`: absolute paths, each one an entry's `to`. It is written under the lock before the first file goes in, and taken away when the reading lets the lock go. `readPendings` reads it as any other field.
- `filing.js`:
  - `lateCheckLockOf(home, name) -> path`: `<BRIMM Video Work>/<episode folder>/late-check.lock`, beside `episode.lock` (`detached.js` `lockOf`). `name` is the pending's `name`, the episode's folder, which is the reading's `found.name`.
  - `takeLateCheckLock(home, name, command, alive) -> { file, text } | null`: makes the folder, then calls `takeEpisodeLock`. null while a live run holds it, or while another run takes it over. Throws when it cannot be made: that is an error of the check, as a file that cannot be looked at is today.
  - `releaseLateCheckLock(held)`: `releaseEpisodeLock(held.file, held.text)`.
  - `settleReading(pending, { home, log }) -> { pending } | { later: true }`. A pending with no mark comes back as it is. For one with a mark, the record in force is read (`readEpisode(pending.folder)`). With no whole record, one a newer brimm-video wrote, or a record file above it still coming (`recordNumbers`): `{ later: true }`, and nothing is written. Otherwise each entry the mark does not name is kept, and so is each it names whose file the record lists at the entry's `bytes`; the rest go. The pending is written whole without the mark, and given back.
  - `LOCK_AGAIN_MS = 10 * 1000`.
- `late-wait.js`:
  - `ownCheckOnly(ctx, record) -> boolean`: this Mac owes the late check of the record's import (a pending of `ctx.machine`, of `ctx.root`, with the record's id), with no problem; and every status of the video (its file and size) that holds it (`holdsVideo`) is this Mac's and at work (`importState` "running"). A video joined from parts has no status, so its pending alone decides.
  - `readingWaitsUntil(ctx, record) -> ms | null`: null when `ownCheckOnly`; else `lateCheckAt(ctx, record)`.
  - `keepCheckInStep(ctx, { name, record, paths }, { wait, log }) -> Promise<{ none: true } | { why } | { end }>`:
    - With no pending of this Mac for the record, or none of whose entries' `to` is among `paths`: `{ none: true }`. No lock is taken and nothing is written.
    - Otherwise it takes the lock (command "read"). While the import's check holds it, it tries again every `LOCK_LOOK_MS` (by `wait`), for `LOCK_WAIT_MS` in all; then `{ why }`.
    - Under the lock it reads the pending again. Gone (the check was made): it lets the lock go, `{ none: true }`. A problem: it lets the lock go, `{ why: importHold(...).why }`. Otherwise it writes the pending whole with `reading: { pid: process.pid, at: ctx.now(), to }`, where `to` is the entries' `to` that are among `paths`, and gives `{ end }`.
    - `end({ put })` runs once, whatever happens. Under the lock it reads the pending again. With `put`, it takes out of `entries` each entry whose `to` the mark names. With or without, it takes the mark away, writes the pending whole and lets the lock go. A write that fails is logged and leaves the mark, for `settleReading`; the lock goes all the same.
  - `LOCK_LOOK_MS = 1000`, `LOCK_WAIT_MS = 2 * 60 * 1000`.

**What each side does, in order.** The reviewer checks every step against the lock.
- The reading: the hold loop sees `ownCheckOnly && asFiled` → Claude is asked, the rough cut is rendered → `keepCheckInStep` (lock, mark) → `intoEpisode` puts each file in and writes the record → its `onPut`: `end({ put: true })` (the entries out, the mark and the lock gone), then the rough cut opens, the notice goes out, the early result is written → 15 minutes later `intoEpisode`'s own late check looks at every file it put in, as today.
  - When a put fails, or the record cannot be written: `intoEpisode` puts the import's files back, waits its 15 minutes, checks what it put back, and returns `{ put: false }` → `end({ put: false })` leaves the entries as they were. The lock is held through that wait, so the import's check is put off for those 15 minutes. It is not skipped.
- The import: `finishDue` → for each due pending, `takeLateCheckLock(…, "late check", alive)`.
  - null: the check is put off. It is not added to `checked`, and the log says so once in the run.
  - Taken: the pending is read again (`readPendings`, by id). Gone: the lock is let go. With a mark: `settleReading`. `{ later }`: the pending is added to `checked` (the next run tries again), the log says so once, and the lock is let go. Otherwise: `checked.add`, then `finishLate(fresh)`, and the lock is let go in a `finally`.
  - The loop: `if (finishDue(false)) await wait(LOCK_AGAIN_MS)`. It never loops without a wait.

**Failing tests first.**

`late-wait.test.js` (R1b's file). A home and root of the test's own, from `setup()` and `episodeFor()` in `episodes.js`, with `writePending` and `writeStatus`. Each test gives `ctx.alive`, since the world's own says every process is gone.
1. `ownCheckOnly` is true with this Mac's pending and no status; true with this Mac's import status at work ("Waiting for its late check"); false with the other Mac's status of the video at work; false with a failed or a problem status; false with a pending that found a problem; false with no pending (this Mac's status alone); false with another Mac's or another root's pending.
2. `readingWaitsUntil` is null in the first two cases of 1, and `lateCheckAt` in the others.
3. `keepCheckInStep` with no pending gives `{ none }`: no lock file, and the pending folder as it was. With a pending none of whose entries is among `paths`: `{ none }`, the pending byte for byte as it was, and no lock file.
4. A pending with entries for the video, the srt, the words, the record and the four files a raw reading replaces gives `{ end }`. The lock file holds this pid and "read". The mark names exactly the four `to`. After `end({ put: true })`: those four entries are gone; the others are as they were (`from`, `to`, `bytes`); there is no mark and no lock file; every other field (`drop`, `dropFile`, `lastCopy`, `label`) is as it was.
5. After `end({ put: false })`: the entries as they were, no mark, no lock file. A second `end` changes nothing.
6. The lock held by a live process: `wait` is called with `LOCK_LOOK_MS`, and the lock is taken once it is freed at the third look. Held for `LOCK_WAIT_MS`: `{ why }` in the exact words below, and nothing is written.
7. The lock left by a dead process is taken at once, with no wait.
8. The pending has found a problem by the time the lock is taken: `{ why }` with `importHold`'s words, the lock let go, nothing written.
9. `end` whose write fails (the pending folder made read-only): the lock is let go, the mark stays, and the log says so.

`filing.test.js`, in "the wait for late checks", with its `world` and `holdCheck` helpers (the test helper is named `holdCheck`; rename it only if it gets in the way). The run is given `alive`.
10. "A check due while a reading holds its lock is put off: no file is put back, it waits LOCK_AGAIN_MS between tries, and it is made once the lock is let go." The entry's file is the reading's, at another size. The lock is taken with `takeLateCheckLock(…, "read")`, and `alive` is true for this pid. At the second wait, the stand-in does what `end({ put: true })` does. Then: the reading's file is as it was; `LOCK_AGAIN_MS` was waited twice, and the number of looks is bounded; the pending and the status are gone.
11. "A mark left by a reading that stopped after its record was written is settled by the record: the reading's file is left as it is, and the rest is checked." The record lists the reading's size for the marked file. Another entry's file is missing, with its work copy there. The lock was left by a dead pid. Then: the marked file is as the reading left it; the missing one is put in again; the pending is gone.
12. "A mark left by a reading that stopped before its record keeps every entry, and the import's file is put back." The record lists the import's size; the marked file is at the reading's size. Then the import's bytes are back.
13. "A mark whose record cannot be read (a conflicted copy) waits for the next run." The run ends, the pending keeps its mark, and the log says so once.
14. "The per-minute timer puts off a check whose lock a reading holds, and throws nothing" (in test 37's world).
15. The existing first test (a pending folder that cannot be written) passes as it is: the lock is in the episode's own folder in BRIMM Video Work.

`reading.test.js`, with `reading("raw")`, `pendingFor(t, found, over)` given entries whose work copies are in `t.work`, `claudeDoing` and `onWaits`.
16. "Reads a raw video at once while this Mac's own late check of the import is still to come, and takes the files it replaced out of that check." No `READ_LOOK_MS` wait, and Claude is asked once. Afterwards the pending holds the entries the test gave for the video, the srt, the transcript, the words and the record, and none for the cut plan, the cut log, or the rough cut's captions and transcript. There is no mark and no lock file. Then `finishLate(pending, …)`, with the clone and same-disk stand-ins, passes, and each file the reading put in is still the reading's, byte for byte.
17. "Holds the late check's lock while it puts its files in." At the first clone into the episode, the clone stand-in asks `takeLateCheckLock` as the import would, with `alive` true for this pid, and gets null.
18. "The import's check is made while Claude reads (the pending is taken away): the reading puts its files in as before, with no lock and no mark."
19. "The import's check finds a problem while Claude reads: nothing is put in, the result says the problem, and the rough cut's kept line follows."
20. "A put that fails half-way leaves the import's check as it was." A clone stand-in fails at the third file. After the run, the pending's entries deep-equal those before, with no mark and no lock file.
21. "Waits as today when a file is not as the import filed it." This Mac's pending, and the srt shorter than the record lists: it waits `READ_LOOK_MS`. The stand-in check puts the srt right and takes the pending away, and then it reads.
22. The tests that pin today's wait keep their meaning with a hold that is not this Mac's own: the other Mac's status at work, or a file not as filed. These are :514, :545, :920 and :1150. The fix-3 test (:948, a finished reading of the full import's `reels.json`) becomes "reads at once, and reels.json leaves the check", with a waiting twin given the other Mac's status.

`edit-kind.test.js`, with its `owe(t, ago)`:
23. "A raw answer while this Mac's own late check is still to come is waited for as one with no check": `waitForReading`'s words (`Claude is still reading <name>. A notice will come on this Mac when it is done: then say "what did Claude find?"`), with the read and copy runs started.
24. The tests at :777-785 and :884-913 that use `owe` take (23)'s words. The one with the other Mac's import at work (:914-924) keeps `Answered. Claude reads it at …`.

`edit-guide.test.js`:
25. :188-217: with this Mac's own pending the step is "reading" (`Claude is reading it. A notice comes when it is done; then say "what did Claude find?".`), with no time. With the other Mac's import at work, it is "reading-later", as today.

R1a's `app.test.js` cases: with this Mac's own pending, `stillReading` is the sentence with no start time.

**Steps:**
- [ ] Read `filing.js` whole, and `intoEpisode` and `importHold` in `unedited.js`.
- [ ] Write the tests above. Run `cd tool && node --test tests/late-wait.test.js tests/filing.test.js tests/reading.test.js tests/edit-kind.test.js tests/edit-guide.test.js tests/app.test.js`. They fail.
- [ ] `filing.js`: the lock's helpers; `settleReading`; `finishDue` under the lock, with the pending read again; the loop's `LOCK_AGAIN_MS` wait; the log lines.
- [ ] `late-wait.js`: `ownCheckOnly`, `readingWaitsUntil`, `keepCheckInStep`; R1a's `lateWaitFor` through `readingWaitsUntil`.
- [ ] `reading.js`: `asFiled`; the hold loop's start at once; `written` around `intoEpisode`, with a `try`/`finally` so the lock always goes; the failed lines; the comments.
- [ ] `edit.js`: `answerKind` and `guideReading` through `readingWaitsUntil`.
- [ ] The README rows.
- [ ] Run the whole suite: `cd tool && node --test`. Expected: all pass.
- [ ] Commit.
- [ ] For the merge checklist (the coordinator's): pull this onto a Mac only while no import is at work there (`status` lists none), so that no import run of the earlier code is alive to make a check without the lock.

**Words Sallie sees:**
- New. When the import's check holds the lock for two minutes, the reading's result says: `The import was still checking its copies of <name> in Dropbox after two minutes, so nothing Claude read was put in.` It is followed, as for any reading that put nothing in, by `The rough cut of <name> is kept on this Mac, in BRIMM Video Work, as "<file>".` when the rough cut was made, and by the next step `Nothing was changed. Say what it is again, with --again, to have Claude read it.` (`reading.js` `AGAIN`, as today).
- When the late check found a problem while Claude read: `importHold`'s words, as today: `The late check of this episode's import found a problem: <problem>. Once it is put right, say "try it again" for <video> on <Mac>, then say this again.`, with the kept line.
- Nothing else is new. For a raw reading that starts at once, `kind` says what it says when nothing holds a raw reading (`waitForReading`); the guide says its "reading" step; `app` says its old `stillReading` (R1a's start time only while the reading waits).
- In the log only (not her words; a light import's video is named by its label, as in `finishLate`'s lines):
  - `<named>: Claude reads it now, while the import's late check of its copies is still to come.`
  - `<who>: its late check waits a moment: a reading is putting its files in.`
  - `<who>: a reading stopped while it put its files in. Its late check leaves out <n> file(s) the record says are the reading's.`
  - `<who>: its late check waits for the next run: a reading stopped while it put its files in, and the episode's record cannot be read now.`

**Contract touched:** none. The pending file is this Mac's own, in Application Support. The status files, the record and the hand-off do not change.

**Does not do:**
- The other Mac's reading of a video this Mac imported still waits for this Mac's check (its status), as today. Only this Mac can keep its own pending in step.
- The project still opens only once the read run ends, 15 minutes after the reading's files go in. That run holds the episode's lock until `intoEpisode` returns (`detached.js` :204), and `app` makes no project while it does (`app.js` :488). See the question for Jason.
- `importHold` does not change. The copy (R1b), `ask`, `--from-plan` and every other hold stay as they are.
- `dropbox.js`, `intoEpisode` and its own late check, `LATE_CHECK_MS` and a pending's due time do not change.
- An iPhone clip's and a session's readings do not change: they never waited. A finished video's reading that replaces the full import's `reels.json` goes the same way as a raw one. No Mac does the full import now: both use the light import.

**Risks:**
- An import run of the earlier code, still alive at the upgrade, makes its check without the lock. It reads the pending again before each check, so it can miss only the seconds of a reading's put. The merge line above closes this.
- While a reading holds the lock, the import's check waits. This is seconds as a rule; 15 minutes when the reading's put fails (`intoEpisode` waits before it returns); and as long as a hung reading holds it. The drop file and the status stay that long. Nothing is skipped.
- A reading killed during its own 15-minute wait leaves its files unchecked, as it does today. More of the episode now rests on that check, since the files it replaced leave the import's.
- `kind` and the guide judge by `ownCheckOnly` alone. When a file is not as filed, they say Claude is reading while the run waits for the check. This is rare: a file Dropbox damaged within minutes of the import.
- The render now runs beside the import of the next video and beside R1b's copy. Each may be slower.
- Each test that pins today's wait needs a hold that is not this Mac's own. A test changed wrongly would hide a real wait.
- Found while designing, not R1c's: a join writes no status, so the other Mac cannot know that the joined video's check is owed. An `ask` or a reading there within the 15 minutes is not held.

**Review Focus** (for a reviewer who has read `filing.js` end to end):
1. No put-back over a reading's file. Walk each order of `finishDue` and the reading's put: before the lock, inside it, after it; the reading killed inside it, before and after its record; `end`'s write failing. At each point, say which entries the check holds and which file is on disk.
2. `finishDue` reads the pending again under the lock and gives that object to `finishLate`, which writes it back on a problem. Never the one `mine()` read before the lock.
3. A check put off is never in `checked`, and the loop waits `LOCK_AGAIN_MS`. One that cannot be settled is in `checked` and waits for the next run, so the run can still end.
4. The mark names only entries among the reading's own paths, and `end({ put: true })` takes out exactly those. The entries of the video (R1b's `localSource` reads it), the record, the srt and the words stay.
5. The reading starts at once only for this Mac's own pending (id, machine, root), with no problem, with only this Mac's statuses at work, and with the files as filed. Every other hold waits exactly as today.
6. The lock goes on every path: success, failure and a throw. It is taken over only from a dead process. It lives in the episode's own work folder, not the pending folder.
7. No new word names a file, a path, a flag or a session. The log names a light import's video by its label.
8. `importHold` is unchanged, and so is everything R1b does.

**Check:** `cd tool && node --test`.

**Size:** L. About 250 lines of code and 25 tests, of which about 8 change tests that pin today's wait.

---

#### Rulings for R1c

1. **The reading takes the files it replaces out of the import's late check. It does not re-point the check at them,** as the outline's step 1 did.
   - Reason: the import's check judges by size alone (`dropbox.js` :93), never by the record. Pointed at the reading's files, it would put them back over anything that changes them within its window. Her correction (`kind … --again`, which no hold stops) takes the reading's files out and puts the rules' plan back; so does a second reading. The reading's own late check (`intoEpisode` `ownLateCheck`) already checks each of its files 15 minutes after the put, judges by the record and the other Mac's claim, and is what checks every reading's files today. Re-pointing would also need the reading's work copies kept in the import's run folder: the reading's folder goes when it ends (`reading.js` :391-393), and `clearRuns` spares only a pending's `work`. And it would need the check's due time moved to the reading's put, or the check comes too soon for the reading's files; that keeps the drop file, the status and the other Mac's hold that much longer.
   - Cost if wrong: a reading run killed during its own 15-minute wait leaves its files unchecked, exactly as today.
2. **A lock both sides take, in the episode's own folder in BRIMM Video Work** (`late-check.lock`, beside `episode.lock`), taken with `detached.js` `takeEpisodeLock`.
   - Reason: reading the pending again before each put-back still leaves milliseconds in which the reading's file lands. Only a lock makes "never" true. `takeEpisodeLock` takes a dead run's lock safely (its takeover guard); `run.js` `takeLock` does not. The episode's work folder, not the pending folder, so that a pending folder that cannot be written (`filing.test.js` :138) changes nothing.
   - Cost if wrong: a check put off for as long as a hung reading holds the lock.
3. **The pending keeps a mark while the reading puts its files in. The import settles a mark it meets by the record in force.**
   - Reason: a reading killed between writing its record and taking its files out of the pending, or whose write failed, must not have its files put back (it finished). One killed before its record must not leave its half-put files where the import's check no longer looks (it did not finish). The record tells the two apart: once the reading's record is in, it lists each file at the reading's size.
   - Cost if wrong: a mark whose record cannot be read waits for the next run.
4. **The reading starts at once only when the one hold is this Mac's own pending check** (no problem; every status of the video that holds it is this Mac's import at work), **and every file the record lists is there at its listed size.** Otherwise it waits exactly as today.
   - Reason: the other Mac's pending is on that Mac's disk. A file not as filed is what the check is there to put right before Claude reads it. This includes "owed, past its time, with no import at work", where today the reading stops and says "try it again". Now the reading goes on, and the check is made at the next run.
   - Cost if wrong: in those cases she waits as today.
5. **`importHold` does not change.**
   - Reason: only the reading keeps the pending in step. The copy (R1b), `ask`, `--from-plan` and the other Mac keep their holds.
   - Cost: none.
6. **The render reads the episode's video, as today, not the drop file.** (The outline said "reads from the local copy".)
   - Reason: on the Mac that imported it, the video is a fresh clone on this Mac's disk. `asFiled` checks its size, the reading checks it is whole, and `sameVideo` checks its facts. An open file stays readable if Dropbox takes it away.
   - Cost if wrong: a rough cut not made, said as today.
7. **`kind` treats a raw reading that starts at once like one with nothing to wait for** (`waitForReading`, up to 90 seconds), so there are no new words.
   - Reason: one behaviour for "the reading starts now", in words that exist.
   - Cost: her chat may wait up to 90 seconds, and most raw readings then end with "Claude is still reading … A notice will come …".
8. **A pending's due time and `LATE_CHECK_MS` do not change.**
   - Reason: the import's check still checks only files the import put in, 15 minutes after it put them.
   - Cost: none.
9. **The late-check test worlds are `filing.test.js` ("the wait for late checks") and `reading.test.js` (`reading()` and `pendingFor`), not `checking-world.js`,** which is the finish's.
   - Reason: it corrects the outline's "Test with `checking-world.js`".
   - Cost: none.
10. **It is pulled onto a Mac only while no import is at work there.**
    - Reason: an import run of the earlier code, still alive, would make its check without the lock.
    - Cost: one line in the merge checklist.

---

### R1d. The project opens once Claude's files are in (Jason: "Yes, build R1d too", 5 Nov)

**Goal:** `app` makes a raw episode's HyperFrames project, and a Reel's project, as soon as Claude's reading is in the record and the files the project reads are at the sizes that record lists. The reading's own late check still runs behind, 15 minutes after the reading put its files in. That check is never skipped or weakened: the read run keeps the episode's lock through it, so every command that writes into the episode still waits for it, as today. Only the making of a project, which reads, no longer waits.

**Evidence:**
- `app.js` :488-497: `makeProject` says "Claude is still reading it" while a `read` run holds the episode's lock. `app-reel.js` does the same at :119, :213 and :288.
- The read run holds that lock until `intoEpisode` returns (`detached.js` :204). `intoEpisode` returns only after its own late check: `onPut` at `unedited.js` :1671, the wait at :1673, the check at :1674.
- So the project waits 15 minutes after the reading's notice. `h7-raw`: "the read run waits for its copies' late check (about 15 minutes), then the open worked". `h7-reel`: "once the read's late check … were done".
- The guide already says the reading is done once its record is in (`edit.js` `guideReading` :6876), so `guide` and `app` disagree for those 15 minutes.
- The precedent: `spell` lets a spelling through while the read run waits for its own check, "but only once the record holds the current reading" (`edit.js` :4942-4946). So do a session's decisions (`sessionBusy` :6577-6589).

**What may run while the reading's own check is still owed (the read run alive, its reading in the record):**
- New with R1d: `app` for the main video (its project is made and opened) and `app … reel <n>` (made, or its video put back).
- As today:
  - the video for HyperFrames and a Reel's video, which run under their own lock (R1b makes them from the local copy);
  - HyperFrames itself, her edits and her export;
  - commands that write only the record: the spellings card (`spell`), the name, a title, a Reel's pick or drop;
  - `show me the Reels`, `what did Claude find?`, `status`, `guide`, `episodes`.

**What still waits for it** (each is refused until the read run ends; the words are under Words):
- the hand-off: the first one, a second one, the Reels' (`finish`; `edit.js` :2565-2568);
- handing the edit over (`release`; :2880-2881);
- asking Claude again for Reels (`ask`; :3979-3981);
- a new answer (`kind … --again`; :5613-5614);
- the Final Cut commands (`layerStart`; :4326-4327);
- `free` (`free.js` :296);
- any new detached run on the episode: `bring`, `read`, another `finish`.

**If the reading's check later finds a file short or missing after the project was made:**
- The check puts the file in again from the reading's own work copy (`intoEpisode` `ownLateCheck`, unchanged). Those are the bytes the project was made from: the project read the file at the size the record lists. The project holds its own copies, so nothing changes for her. The log says what was put back.
- If the check cannot put it back (the work copy gone, a conflicted copy, the other Mac's claim, a clone that fails):
  - The read run ends with that problem in its result. "How far is it?" says `<name>: read ended … ago. Made: …. Not done: <the problem>.` (`ranLine`, as today).
  - The file is then not as the record lists. `episodes` names it, and the hand-off is refused in its existing words: `<name> is not whole in Dropbox: <file> is missing.` (`edit.js` :2563-2564).
  - Her project, her edits and her export stay as they are. Jason puts the file right, as for any problem a reading's check finds today.

**Files:**
- `tool/episode.js`: `currentReading(record)` moves here from `edit.js` (:4470-4478), word for word, and is exported. `app.js` and `late-wait.js` cannot import `edit.js`.
- `tool/late-wait.js` (R1b's module): new `projectWaits` and `readingCheckAt`.
- `tool/app.js`:
  - `makeProject` (:478-526): `projectWaits` decides the "still reading" stops at :488-497. While it says "verify", the three files read from the episode's folder go through `readListed`. A file not at its listed size makes nothing and says the new line.
  - New exported `readListed`, and the new line `notWholeYet(name)`.
- `tool/app-reel.js`:
  - `reelWhy` (:117-127): any Reel passes only while the reading is not in the record (`projectWaits` "reading"). Once it is in, the record judges, as at any other time.
  - `makeReel` (:204-268) and `putReelVideoBack` (:275-…): the "still reading" stops (:213, :288) through `projectWaits`. In "verify", the words, `reels.json` (`suggestion`, :129) and the cut plan through `readListed`, and the Reel's line `reelNotWholeYet(n, name)`.
- `tool/edit.js`:
  - `currentReading` is imported from `episode.js`.
  - `stoppedWords` (:2211-2214): a branch for the read run at its own check (`readingCheckAt`).
  - `askRefusal` (:3976-3984): its running stop goes through `stoppedWords`.
- `README.md`: the `app` row (:282, "nothing is made while Claude's reading of the episode is still at work …") and the `app … reel` row (:285, the same).
- Not changed: `reading.js`, `unedited.js` (`intoEpisode` and its check), `detached.js`, `dropbox.js`, `filing.js`, `guide.js`, `free.js`, `project.js`, the skill.
- Tests: `late-wait.test.js`, `app.test.js`, `edit-app.test.js`, `app-reel.test.js`, `edit-app-reel.test.js`, `edit-checking-refusals.test.js`, `reading.test.js`.

**Interfaces.**

Consumes:
- From R1b's `tool/late-wait.js`: the module itself, as the home both `app.js` and `edit.js` can import.
- From R1c: this Mac's pending check of the import (`readPendings`, by id, machine and root), which says a late check of the import's files may still be owed after the reading is in. R1d takes neither R1c's `late-check.lock` nor the episode's lock (ruling 3).
- `runningCommand`, `runningRun`, `readResult` (`detached.js`); `LATE_CHECK_MS` (`dropbox.js`); `kindOf` (`episode.js`); the read run's early result (`runDetached`'s `early`: `{ early: true, pid, ended }`, written at the end of the reading's `onPut`, `reading.js` :564).

Produces:
- `episode.js` `currentReading(record) -> reading | null`, moved unchanged.
- `late-wait.js` `projectWaits(ctx, { name, record }) -> "reading" | "verify" | ""`:
  - "reading": a live `read` run holds the episode's lock (`runningCommand(ctx.home, name, ctx.alive) === "read"`), and `currentReading(record)` is null;
  - "verify": that run holds it with the reading in the record; or no read run, and this Mac has a pending check of the record's import (R1c), with or without a problem;
  - "" otherwise, as today.
- `late-wait.js` `readingCheckAt(ctx, { name, record }) -> ms | null`: when the run holding the episode's lock is `read` (`runningRun`), `currentReading(record)` is set, and the `read` result is that run's early one (`early === true`, `pid` the run's): `ended + LATE_CHECK_MS`. Otherwise null.
- `app.js` `readListed(folder, record, rel) -> { text } | { absent: true } | { notWhole: rel }`: reads the file whole, then compares the bytes read (not a look before) with `record.files[rel]` when the record lists it. Missing, or another size: `notWhole`. A file the record does not list is read as today: `{ text }`, or `{ absent }` when it is not there.

**Failing tests first.**

`late-wait.test.js` (a home of the test's own; a lock taken with `takeEpisodeLock(lockOf(...), command, ...)`; `ctx.alive` given; an early result written with `resultFile`):
1. `projectWaits`:
   - "reading" with a live `read` lock and a record whose reading is older than its answer, or has none;
   - "verify" with the live `read` lock and a record whose current reading is in;
   - "verify" with no run and this Mac's pending of the record;
   - "" with no run and no pending; with a live lock of another command; with a `read` lock whose process is gone.
2. `readingCheckAt`:
   - the early result of the live read run gives `ended + LATE_CHECK_MS`;
   - an early result of another pid gives null; no early result gives null; a final (not early) result gives null; no current reading gives null.

`app.test.js` (its `episode(c)` world and `atWork(e)` helper; the record given a current reading and `files` listing the words, `reels.json` and the plan at their sizes):
3. "Makes the project while the reading's own check is still to come, once the reading is in the record and the files are at the sizes it lists." Said: `It's open in HyperFrames.` and the buttons line. The project is made from the reading's plan and `reels.json`. The read lock is untouched.
4. "Makes nothing while a file it reads is not the size the record lists": `reels.json` shorter than listed. Said: the new line, exactly. Nothing is written, and the code is 0. Then the file is put right and asked again: made.
5. "Judges the bytes it read": the record lists the cut plan at one byte more than the file holds. The new line is said, and no project is written. A unit test of `readListed` shows the comparison is of the text read (its byte length), with no `statSync` before the read.
6. "With this Mac's late check of the import still owed and no read run (R1c), the files are checked the same way": `words.json` short, giving the new line.
7. The existing "while Claude is still reading" tests (:343-…) keep a record with no current reading, and say `STILL` as today.

`edit-app.test.js` (its `world()` and `readingAtWork(t)`; the record with a current reading):
8. "Claims, makes and opens the project while the read run is at its own late check." Said: `[OPEN, BUTTONS]`; the record at the claim's rev plus one, with the project "opened"; `episode.lock` still the read run's.
9. The existing :713-… tests (a record with no reading) keep `STILL`.

`app-reel.test.js` and `edit-app-reel.test.js` (their worlds; a raw and a finished record whose current reading lists `reels.json`):
10. In the window, `app … reel 9` is refused `There is no Reel 9. The Reels are 1, 2.` by the record (today any number passes while the read run is at work).
11. In the window, Reel 2's video is asked for when it is not made, and its project is made when it is: no `STILL`.
12. In the window, with `reels.json` shorter than listed: the Reel's new line, exactly; nothing asked for or made.
13. Putting a Reel's video back in the window goes ahead (no `STILL`).
14. The existing `STILL` tests (`app-reel.test.js` :98-…, `edit-app-reel.test.js` :455) keep a record with no current reading.

`edit-checking-refusals.test.js`, a new describe with `guide-world.js`'s `guideWorld()` (a raw episode read by Claude: `READ(kind)` at `AT`), a live `read` lock and that run's early result at `ended`:
15. The hand-off (`finish`, asked as "hand it off") says `Claude's reading is written, and Studio checks Dropbox's copies at <clockAt(ended + LATE_CHECK_MS)>. Say "hand it off" again then.`
16. `release` says `Claude's reading of <name> is written, and Studio checks Dropbox's copies at <time>. Hand it over then. Nothing was handed over.`
17. A new answer (`kind … --again`) says `Claude's reading of <name> is written, and Studio checks Dropbox's copies at <time>. Say it again then.`
18. `ask` (and the end of `show me the Reels`) says `Claude's reading of <name> is written, and Studio checks Dropbox's copies at <time>. Say it again then.`
19. With no early result of that run, each says its generic words as today. `free` says its own words as today.

`reading.test.js`, the fix-1 world (:850-894; the read run held at its `LATE_CHECK_MS` wait by a promise):
20. "While the read run waits for its own late check, `app` makes the project": with the app's stand-ins as `edit-app.test.js` gives them. When the promise is let go, the run's check finds every file as it put it, and the final result is ok.

**Steps:**
- [ ] Read `app.js` `makeProject` and `openInApp`, `app-reel.js` :100-330, `edit.js` `stoppedWords` and its callers, and `intoEpisode` from :1631 to its end.
- [ ] Write the tests above. Run `cd tool && node --test tests/late-wait.test.js tests/app.test.js tests/edit-app.test.js tests/app-reel.test.js tests/edit-app-reel.test.js tests/edit-checking-refusals.test.js tests/reading.test.js`. They fail.
- [ ] Move `currentReading` to `episode.js`; import it in `edit.js`. Run the suite: nothing else changes.
- [ ] `late-wait.js`: `projectWaits`, `readingCheckAt`.
- [ ] `app.js`: `readListed`, `notWholeYet`, and `makeProject` through `projectWaits`.
- [ ] `app-reel.js`: `reelWhy`, `makeReel`, `putReelVideoBack`; `reelNotWholeYet`.
- [ ] `edit.js`: the `stoppedWords` branch; `askRefusal` through it.
- [ ] The README rows.
- [ ] Run the whole suite: `cd tool && node --test`. Expected: all pass.
- [ ] Commit.

**Words Sallie sees:**
- New, `app` in the window when a file it reads is not at its listed size: `Some files of <name> are not whole in Dropbox yet, so its HyperFrames project wasn't made. Say "open <name> in HyperFrames" again in a few minutes; if it says this again, ask Jason.`
- New, `app … reel <n>`, the same case: `Some files of <name> are not whole in Dropbox yet, so the project of Reel <n> wasn't made. Say "open Reel <n> of <name> in HyperFrames" again in a few minutes; if it says this again, ask Jason.`
- Changed: every stop that goes through `stoppedWords` (and `ask`'s), while the read run is at its own check with its reading in and its early result written, says `Claude's reading<of> is written, and Studio checks Dropbox's copies at <HH:MM>. <again>`. The sentence mirrors the finish's own. The time is the early result's `ended` plus 15 minutes, as the clock shows it (`clockAt`). Examples:
  - the hand-off: `Claude's reading is written, and Studio checks Dropbox's copies at 17:41. Say "hand it off" again then.`
  - `release`: `Claude's reading of Pricing talk is written, and Studio checks Dropbox's copies at 17:41. Hand it over then. Nothing was handed over.`
  - a new answer, and `ask`: `Claude's reading of Pricing talk is written, and Studio checks Dropbox's copies at 17:41. Say it again then.`
- Unchanged:
  - `free`: `Something is still at work on <name>. Say "how far is it?", and ask again when it is done. Nothing was taken away.`
  - `app` before the reading is in: `Claude is still reading it. …`
  - the opening lines, and "how far is it?".

**Contract touched:** none. In the window `app` writes only the record into Dropbox (the claim and the project's entry), as it does at any other time. The project and the copies are on this Mac's disk.

**Does not do:**
- It does not change the reading's own check: where it runs, when, what it judges by, or the lock its run holds. Nothing that writes into the episode goes on before that check, but the record-only commands that go on today.
- It does not check sizes outside the window, when no check of the episode's files is owed on this Mac. That stays as today.
- The guide does not say that a reading's check found a problem (it says nothing today either). The hand-off's refusal and "how far is it?" do.
- Nothing changes on the other Mac. Its `app` is refused by this Mac's claim, as today.
- A session gets no project, as today.
- `free`'s line stays generic: `free.js` cannot use `stoppedWords`.

**Risks:**
- A project made in the window holds the reading's files as read. If the reading's check then cannot put a Dropbox copy right, the project is right and the episode is not: the hand-off is refused until Jason puts it right. Before R1d she could not have had the project yet.
- A file that went back to an older version of exactly the same size would pass the size check. The late check itself has the same blind spot, and judges by size too.
- The new stop line needs the run's early result. Without it the stop says its generic words, as today.
- Moving `currentReading` touches every use in `edit.js`. A missed import fails at load, loudly.
- The tests that pin `STILL` must keep a record with no current reading, or they would pass for the wrong reason.

**Review Focus:**
1. No writer gets through. Only `app` and `app-reel`'s "still reading" stops change, and only once the record holds the current reading. Every other `runningCommand` check keeps its effect; only its words change, and only through `stoppedWords` and `askRefusal`.
2. The size check is made on the bytes read, after reading them, against the record `app` was given after the claim, for each file that record lists. An unlisted file is read as today.
3. The reading's own check is untouched: `intoEpisode`, `runDetached`, and the episode's lock, held until the check is made.
4. "verify" also holds while this Mac owes the import's check (R1c), so `words.json` is checked too.
5. `reelWhy`'s "any Reel" holds only while the reading is not in the record.
6. In the window `app` writes into Dropbox only the record. The project is written on this Mac's disk.
7. No new word names a path, a flag or a command. The time is the early result's `ended` plus `LATE_CHECK_MS`.

**Check:** `cd tool && node --test`.

**Size:** M. About 120 lines of code and 20 tests, of which about 6 change tests that pin today's stops.

---

#### Rulings for R1d

1. **"Claude's files are in" means the record in force holds the current reading** (`currentReading`), as `spell` already judges it. It does not mean the early result.
   - Reason: `intoEpisode` writes the record only after every file is in, and the sizes the check uses come from that record. The early result is written milliseconds later, and is used only for the time in the words.
   - Cost if wrong: none; the two are milliseconds apart.
2. **While a check of the episode's files may still be owed on this Mac, `app` checks each file it reads, after reading it, against the size the record lists.** "Owed" means the read run at its own check, or this Mac's pending check of the import (R1c). Outside that, it reads as today.
   - Reason: the late check judges by size. Checking the bytes read, not a look before, leaves no gap for a put-back in progress. Outside the window the check has been made, and when it failed the hand-off refuses.
   - Cost if wrong: a project refused for a file Dropbox damaged for a moment. She says it again.
3. **`app` takes no lock**: neither R1c's `late-check.lock` nor the episode's.
   - Reason: it only reads. A read checked afterwards can only refuse, never take a wrong file. A lock would only make her wait on a writer.
   - Cost: none.
4. **The read run keeps the episode's lock through its own check**, so every writer waits as today.
   - Reason: that check judges by the record and the other Mac's claim, and puts the reading's files back. A writer let through could meet it half-way. Letting the lock go early would weaken it.
   - Cost: the hand-off, `release`, `ask`, `free` and a new answer still wait up to 15 minutes after Claude's notice (see the question).
5. **The stops that wait for the reading's check say when it is made**, through `stoppedWords`, as a finish's check is said; `ask`'s refusal goes through it too.
   - Reason: with R1d she can reach these in the window. "read is running" names a command, and gives no time.
   - Cost: one branch in `stoppedWords`. `free`'s line stays generic.
6. **`currentReading` moves from `edit.js` to `episode.js`.**
   - Reason: `app.js` and `late-wait.js` need it and cannot import `edit.js`.
   - Cost: one import line.
7. **A project made in the window is not made again when the reading's check later puts a file back.**
   - Reason: the bytes are the same, and the project holds its own copies. When the check cannot put a file back, the project stays, and the hand-off's existing refusal stops the episode until Jason puts it right.
   - Cost if wrong: none to her project; the episode needs Jason, as today.

---

### R2. The chat's skill

**Goal:** The chat asks Studio's cards exactly as printed, in the right order, with short rules, and uses Studio's words.

**Evidence:** `h7-findings.md` "To fix in Studio's words and the chat"; `flow.md` F5 ("real slips"); `arch.md` finding 4.

**Files:** `tool/studio/SKILL.md` and `tool/studio/SKILL-open.md` (the twin for an open-lock Mac; the same change in both). Tests that pin the skill: `studio.test.js` (:152-400, :1189-1202), `studio-open.test.js`, `behind-open.test.js`, `edit-labels.test.js`, `guide-leftovers-pins.test.js`, `finish-reels-pins.test.js`, `guide-reels-pins.test.js`, `set-aside-pins.test.js`.

**Failing tests first** (in `studio.test.js`, for both files; each reads the skill text):
- "A declined card is asked again as Studio printed it": the skill says, in one sentence, `If she declines or leaves a card, ask the same card again exactly as Studio printed it; never ask a card of your own, and never ask whether that is her answer.` The text holds no `Is that the answer`.
- "A voiceover's not-a-session card comes right after its planned card": the `voiceover` rule says to run `footage "<label>" "<title>" voiceover`, ask the card it prints, and only then run `footage` again with the flag; the words `before any other command` appear in it.
- "Commands go on one line": a rule `Put each command on one line; never break it with a line break or a backslash.`
- "A video's label is its drop time": a rule `A video's label is when she dropped it. Never say when she filmed it.`
- "A spelling as printed": H7's chat wrote "Reel" for the spelling "reel" (a heard word). A rule `Show a spelling as Studio printed it, letters and capitals as they are.`
- "Talking parts": a rule `Call a part by the label Studio printed; never "the second talking part".`
- "Long rows become short rules": no line of either skill is longer than 600 characters, and no table row longer than 400 (the builder sets the numbers from what the longest line becomes; the test pins them). The rows split are the long "She says / Run" rows of "What she says, and what to run" (:72-115) and the cards' rows (:20-51).
- "The twin holds the same rules": the existing shared-lines test lists the new sentences.

**Steps:**
- [ ] Write the tests; run `cd tool && node --test tests/studio.test.js tests/studio-open.test.js`; they fail.
- [ ] Edit `SKILL.md`: add the six rules where the cards are described (:20-51); split the rows that run past the cap into a short row plus a short bullet rule each (keep every command and its guard sentence word for word).
- [ ] Make the same edits in `SKILL-open.md`.
- [ ] Update every other test that pins a moved sentence.
- [ ] Whole suite. Commit.

**Words Sallie sees:** none by Studio. The chat's behaviour changes.

**Contract touched:** none. Does not change `guide.js`.

**Check:** `cd tool && node --test`.

---

### R3. One yes at hand-off

**Goal:** When she has exported, the chat finds the export and asks one question, "I found your export. Hand it off?", and her yes starts the hand-off.

**Evidence:** `flow.md` F5 and F6; `edit.js:2672`; `SKILL.md:63`, `:110`, `:168-170`.

**Files:**
- `tool/edit.js` `finishEpisode` (:2560-2700): the closing line at :2672.
- `tool/finish-reels.js` (:73 `START`), for the Reels' hand-off.
- `tool/guide.js`: the step that offers "Shall I hand it off?".
- `tool/studio/SKILL.md`, `SKILL-open.md`: line 63 (`Shall I hand it off?`), 110, 168-170.
- Tests: `finish*.test.js`, `edit-finish*.test.js` that pin `Say "yes, hand it off" to start.`, `guide.test.js`, `studio.test.js`.

**Interfaces.** Produces `HAND_OFF_ASK = "I found your export. Hand it off?"` and `REELS_ASK = "I found your Reels' exports. Hand off the Reels?"` exported from `tool/finish.js` (next to `START`).

**Failing tests first:**
- A `finish` with her exports found and no questions open ends with the line `Hand-off question: I found your export. Hand it off?` and not with `Say "yes, hand it off" to start.`; with questions open it prints them and no hand-off question.
- The Reels' version prints the Reels' question.
- The skill says: when the guide says she has exported, run `finish` at once (it changes nothing), tell her in plain words what it found for each part and the words on the picture, then ask `Hand-off question` on one `AskUserQuestion` with the answers "Yes" and "Not yet"; "Yes" runs `finish … --yes` with the answers it asked for; never ask "Shall I hand it off?" first. The old sentence `Never add --yes before she has said yes to what finish just said` stays.
- `guide.test.js`: the guide's step says `You have exported it. Say "hand it off" and I will check what you exported.`

**Steps:**
- [ ] Write the tests; run `cd tool && node --test tests/finish*.test.js tests/guide.test.js tests/studio.test.js`; they fail.
- [ ] Change the printed line in `edit.js` and `finish-reels.js` to the new constants; keep the Final Cut line `Say "yes, finish it" to start.` for now (R-Phase 2 removes it).
- [ ] Change the guide's step and the skill (both files).
- [ ] Update the pinned tests. Whole suite. Commit.

**Words Sallie sees:**
- Chat, one question: `I found your export. Hand it off?` (Yes / Not yet). For Reels: `I found your Reels' exports. Hand off the Reels?`
- Guide step: `You have exported it. Say "hand it off" and I will check what you exported.`

**Contract touched:** `guide.js` words before the page's steps. The page's buttons are not touched here.

**Check:** `cd tool && node --test`.

---

### R5. Her script opens as a copy to read

**Goal:** She reads her script from a copy that cannot change the plan. Changes go through the chat, which saves them to the plan.

**Evidence:** `ux.md` F3 ("Not right" trap) and option B; `h7-findings.md` answer 3; `arch.md` finding 7 and option 7a.

**Files:**
- Create `tool/plan-script.js` and `tool/tests/plan-script.test.js`. It holds `openScriptCopy(ctx, found, record) -> 0 | 1` and `scriptHandEdited(folder, record) -> boolean`.
- `tool/edit.js` `plan` (:7454): a new word `script` (`plan "<title>" script`) calls it. `HELP` (:137) gets one line.
- `tool/edit.js` `episodes` lines (:1016-1042): a hand-edited `teleprompter.txt` gets its own plain line (see R4c for the other "Not right" lines).
- `tool/studio/script.md` and `SKILL.md`/`SKILL-open.md`: the route says "read it from `plan … script`" and "changes come through her; never ask her to edit the file".
- Tests: `plan-script.test.js` (new), `edit-labels.test.js` (`TODAY_ASKED`, `walkWords`), `edit-gate.test.js` (`ASKED`), `part-f-fixes.test.js` (README row), `gate.test.js` (gate list), `studio.test.js` (skill and script.md pins).

**Interfaces.** Reuses `showCopy` (edit.js:3183-3209) for the read-only copy in this Mac's work folder, opened in TextEdit, and the `plan.js` `teleprompterText` writer. Produces `plan "<title>" script`.

**Failing tests first:**
- `plan "T" script` makes a copy in the episode's work folder (never in Dropbox), marks it read-only (mode 0444), opens it with `ctx.openApp("TextEdit", copy)`, and says `Opened the script for "T" in TextEdit. It is a copy to read. To change it, tell me the change here.` Opening it twice replaces the earlier copy.
- The copy holds exactly the plan's `teleprompterText(record.planned.lines)`.
- A plan that is not made yet, or dropped, says why in the words the other `plan` subcommands use.
- When `teleprompter.txt` in the plan's folder is not the size the record lists, `episodes` says `The script file of "T" was changed outside the chat. Tell me the changes you want and I will save them to the plan.` and does not say "Not right".
- `scriptHandEdited` is false for a missing file (that is a different problem and keeps its line).
- Skill pin: the script route says to open the script with `plan "<title>" script`, and says `Never ask her to edit the script file; take her changes here and save them with plan … set.`

**Steps:**
- [ ] Write the tests; run `cd tool && node --test tests/plan-script.test.js tests/edit-labels.test.js tests/edit-gate.test.js tests/part-f-fixes.test.js tests/gate.test.js`; they fail.
- [ ] Create `plan-script.js`; wire `plan … script` in `edit.js`; add the `HELP` line.
- [ ] `episodes`: the plain line for the script.
- [ ] Skill, `script.md`, README row, `ASKED`, `TODAY_ASKED`, `walkWords`, gate-list decision (it prints nothing of a session; it is for planned episodes only, so it is not gated).
- [ ] Regenerate `today-says.json` (help only), read `git diff`.
- [ ] Whole suite. Commit.

**Words Sallie sees:** as in the tests above.

**Contract touched:** none.

**Check:** `cd tool && node --test`.

---

### R6a. Sorting out a conflict

**Goal:** Keeping one side of a conflicted plan puts that side's files back, and Studio shows the difference in plain lines, not JSON.

**Evidence:** `ux.md` F3 (conflict); `reliability.md` (`h7-conflict`); `arch.md` option 7b.

**Files:**
- `tool/edit.js` `resolveIn` (:3496-3700), its `show()` (:3548-3575) and the keep step after :3590.
- `tool/plan.js`: add `planFilesFrom(record) -> { "guide.md": text, … }` if the file texts are not already made from a record by one function (`plan.js:225-231` has the builder; reuse it).
- `tool/episode.js`: `recordDifferences` (where it lives; :690 neighbourhood) returns names and two values.
- Tests: `edit-resolve*.test.js` (find with `ls tests | grep resolve`), `plan.test.js`.

**Failing tests first:**
- A conflicted plan record (two copies differ in one teleprompter line): the show lists `The script is different:` and then only the lines that differ, `A: "…"` and `B: "…"`, each shortened to 120 characters with `…`; no `{` or `}` appears in the output.
- A conflict of the cues, of the shots and of the title are each said as one plain line: `The graphic cues are different: A has 5, B has 6.`
- After `--keep B` the plan's files in the folder equal what `planFilesFrom(B)` makes, and the record lists their sizes (as `plan … set` does), and `episodes` says nothing wrong about them.
- A refused record write (stand-in `expectRev` failure) leaves the files as they were. If the files cannot be rewritten, the record is not changed (files first by the rule, record last; an unchanged record stays valid).
- `--keep A` leaves the files that already match A as they are (no write).

**Steps:**
- [ ] Write the tests; run `cd tool && node --test tests/edit-resolve*.test.js tests/plan.test.js`; they fail.
- [ ] `recordDifferences`: for the `planned` object, compare field by field and return plain pairs; `show()` prints those.
- [ ] The keep step: for a plan record, write `planFilesFrom(kept)` by the Dropbox rule (made outside, cloned in, never over a file), then the record last.
- [ ] Whole suite. Commit.

**Words Sallie sees:**
- `The script is different. A says: "…". B says: "…".`
- `The graphic cues are different: A has 5, B has 6.`
- After the keep: `Kept B. The plan's files are written from it.`

**Contract touched:** none.

**Check:** `cd tool && node --test`.

---

### R6b. "How far is it?" tells of a failed footage copy

**Goal:** `status` says when a footage copy failed, and what she can do first.

**Files:** `tool/edit.js` `status` (:1952-2030) and `ranLine`; `tool/app.js` `footageNotMade` (:726-731) is the existing reader of the run's result, exported for `status`. Also (H7): `status` calls an explainer's voice "making the video from its footage": the words come from `ranLine`/`guide.js` `FOOTAGE_STAGES`; give the explainer its own line.

**Failing tests first** (`edit-status-workcopy.test.js`):
- A result with `footageFailed: ["The footage for shot 2 could not be made: …"]` makes `status` say `Some of the footage for "T" could not be made. Say "open T in HyperFrames" again; if it says so again, ask Jason.` A "Dropbox is still bringing" failure is not said (it passes by itself).
- A running copy has not left its result: nothing is said (the existing rule).
- A gated video is named by its label only.
- An explainer's voice: `T: its voice is being taken in.`

**Steps:** write tests; fail; export `footageFailed` reader from `app.js`; use it in `status`; whole suite; commit.

**Words Sallie sees:** as above.

**Contract touched:** none.

**Check:** `cd tool && node --test`.

---

### R8a. A branded word-by-word caption style

**Goal:** Every main video and Reel project's notes carry one caption style: word by word, in Josefin Sans, in BRIMM's colours.

**Files:** `tool/project.js` `brimmRules` (:406 area) gets a rule labelled `Captions.` after `Graphic cues.`; `ABOUT` (:431) is unchanged. `tool/brand/brand.md` is read for the colours and the typeface; the rule quotes them (navy, sand, mist; Josefin Sans from Google Fonts). Tests: `project.test.js` (:469-479, the rule labels lists).

**Failing tests first:**
- Main and Reel label lists hold `Captions.` right after `Graphic cues.`; a session clip's list is unchanged.
- The rule's text holds `one word at a time`, `Josefin Sans`, and the colour names from `brand.md`; the word "BRIMM" is in capitals in it; and it says the Reel's clear areas (top 14%, bottom 35%) stay clear.
- CLAUDE.md and AGENTS.md of a project are the same text (the existing test).

**Steps:** tests; fail; add the rule; whole suite; commit.

**Words Sallie sees:** none by Studio. The agent in the app follows the rule.

**Contract touched:** none.

**Check:** `cd tool && node --test`.

---

### R8b. A line on each Reel pick: why it will hold attention

**Goal:** Each Reel Claude suggests carries one sentence on why a viewer will keep watching, and Studio shows it.

**Evidence:** `notes.js:56` `ASK.clips` and `readNotes` (:192), `readings.js:43` `SUGGESTIONS` (:160), `reels.js` `reelEntries` (:258) keeps `why`.

**Files:** `tool/notes.js` (`ASK.clips`), `tool/readings.js` (`SUGGESTIONS`), `tool/edit.js` `reelsText` (the listing), `tool/reels.js`. No new field and no `reels.json` version: the existing `why` is asked for in the new sense (ruling 9).

**Failing tests first:**
- `notes.test.js` and `readings.test.js`: the clips' and the suggestions' ask says `"why" is one sentence on why a viewer keeps watching: the hook, the turn or the promise that holds them.`
- `readings.test.js:36-38`: the sha256 values change; update them with the new text, and the commit says so.
- `edit-reels*.test.js`: `reelsText` prints under each candidate `Why it holds attention: <why>`; a candidate without a `why` prints no such line.
- A Reel read before this change (its `why` is the old kind of reason) still prints, under the same heading.

**Steps:** tests; fail; reword the asks; print the line; update hashes; whole suite; commit.

**Words Sallie sees:** `Why it holds attention: <Claude's sentence>`

**Contract touched:** none. BRIMM Ops reads `suggestions[].why`? Check `app/src/handoff.js`: if it reads `why`, its tests use fixtures that do not change.

**Check:** `cd tool && node --test`.

---

### R4a. "BRIMM Video Studio" on every Studio screen

**Goal:** Sallie sees one name for the tool on every Studio screen.

**Evidence:** `ux.md` F4. About 150 occurrences of "brimm-video" in `tool/*.js`, most in comments and code.

**Files (the screens):**
- `tool/unedited.js:2270`, the notice title `"BRIMM unedited video"`.
- `tool/progress.swift:106`, the panel title `"BRIMM video"`. (A Swift file: the test checks the text of the source; the panel is rebuilt at the next install, on Jason's yes.)
- `tool/dialog.js:30`, the dialog title `"brimm-video"`.
- `tool/studio/SKILL.md`, `SKILL-open.md`, `CLAUDE.md`, `CLAUDE-open.md` in `tool/studio/`: "brimm-video" in what the chat says to her (`Jason has a newer brimm-video` and others).
- `tool/guide.js`, `edit.js`, `settings.js`, `finish.js`, `footage.js`, `reading.js`, `sessions.js`, `teachings.js`, `gate.js`, `reveal.js` and the rest: only strings she is shown.
- Create `tool/name.js` with `export const STUDIO_NAME = "BRIMM Video Studio";` so a screen's name is one constant.
- Tests: `unedited.test.js`, `dialog.test.js`, `progress` swift pin (find with `grep -ln "progress.swift" tests`), `studio.test.js`, `guide.test.js`, and a new `names.test.js`.

**Stays as it is:** `madeBy` (`brimm-video <commit>`), `HANDOFF_FORMAT`, the env names (`BRIMM_VIDEO_HOME`), the folder names, code comments, the launch agent's label, and text that names the old tool on purpose (a laptop that is still on brimm-video).

**Failing tests first:**
- `names.test.js` is a guard: it walks the strings her screens print (a list in the test of each function and constant that prints, the way `edit-labels.test.js` walks commands) and fails if one holds "brimm-video" or "BRIMM video" or "unedited video". It holds an allow-list for `madeBy` and the one old-tool sentence.
- `unedited.test.js`: the notice's title is `BRIMM Video Studio`. `dialog.test.js`: the dialog's title is `BRIMM Video Studio`.
- The skill pins: `Jason has a newer BRIMM Video Studio; ask him to update this Mac when it suits.`
- `contract.test.js` passes unchanged (the proof that `madeBy` was not touched).

**Steps:** tests; fail; add `name.js`; change the strings listed; run `git grep -n "brimm-video" -- tool ':!tool/tests'` and read each hit: a screen string changes, a comment or an id stays; whole suite; commit.

**Words Sallie sees:** the notice, the panel window and the dialog are titled "BRIMM Video Studio". The chat says "BRIMM Video Studio".

**Contract touched:** the name on screen only. Ops' O2 does the page's side.

**Check:** `cd tool && node --test`.

---

### R4c. Plain words for "Not right", "late check" and "ask Jason"

**Goal:** Each message tells her what happened and what she can try first. "Ask Jason" stays only where nothing is hers to try.

**Evidence:** `ux.md` F3; `edit.js:1016-1042`, `:885`, `:1932`; "Ask Jason" appears 40 times in `edit.js`, 6 in `guide.js`, 3 in `footage.js`, 2 in `app.js`.

**Files:** `tool/edit.js` (:885, :1016-1042, :1932), `tool/episode.js` `filesProblems` (:675-693), `tool/guide.js`, `tool/footage.js`, `tool/app.js` (the `noWords`, `notWhole`, `FOOTAGE_NOT_MADE`, `FOOTAGE_NOT_IN` lines), `tool/app.js` order of lines (H7: "Ask Jason" came before "It's open in HyperFrames"; "Its footage is still being made" and "It's open" together). Tests that pin the old words.

**The rule for "Ask Jason":** the builder writes a table in the ledger of every hit with the word "Ask Jason" or "ask Jason": the hit, whether she can try something first (say it again, wait a few minutes, open the app first, check Dropbox), and the new line. A line changes only when there is something to try. A line stays when it is about setup, the lock, a newer Studio, a file that is gone for good, or anything privacy-related. The builder pins each changed line with a test.

**Exact words for the three named:**
- File problems (`filesProblems` through `episodes`): missing: `A file of this video is missing: X. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason.`; short: `A file of this video is not all here yet: X. Dropbox is still bringing it. Ask again in a few minutes.`; a different size: `A file of this video is not the one Studio saved: X. If you changed it, tell me what you changed. If not, tell Jason.`
- "Late check" in her status lines: `Dropbox is still checking the copies of X.` and `Dropbox found a problem with a copy of X.` and for :1932 `put in what it made 0 minutes ago; Dropbox's check of its copies is still to come`.
- `app`: `Some of its footage could not be made for HyperFrames.` comes after `It's open in HyperFrames.`; the first line says `Say "open X in HyperFrames" again in a few minutes. If it says this again, tell Jason.`

**Failing tests first:** each changed message has a test asserting the new words and, in `names.test.js` style, a guard test that no line of a listed set holds `late check` or `Not right:`. The tests that pin the old words are changed in the same commit.

**Steps:** write the ledger table; tests; fail; change; whole suite; commit.

**Contract touched:** none. `guide.js` words before the page's steps only.

**Check:** `cd tool && node --test`.

---

### R7b. Studio's guide quotes the page's new button

**Goal:** The guide tells her the buttons the page now has.

**Files:** `tool/guide.js` `opsText` (:112-120) and its `taken` step; `tests/guide.test.js:18-24` and `edit-guide*.test.js` that quote the buttons. Matches O1.

**Failing tests first:** the first-take step reads: `Drag the hand-off onto Episodes. If the page says it is a new episode, press "Add the episode and take the hand-off". If it opens an episode, press "Take the hand-off".` The later-revision step is unchanged (`press "Take revision N in place of revision M"`).

**Steps:** tests; fail; change; whole suite; commit.

**Contract touched:** yes: the page's button words. Done in step with O1 and O2. The coordinator tells the BRIMM Ops branch the exact string.

**Check:** `cd tool && node --test`.

---

### O1. BRIMM Ops takes a hand-off with one press (R7a)

**Goal:** A hand-off dropped on the Episodes list says which episode and revision it is, and one press adds the episode and takes it.

**Evidence:** `ux.md` F5; `app/src/app.js` `listDrop` (:793-810), `addFromDrop` (:1794-1803), `createEpisode` (:419-463), `takeHandoff` (:683-750); `views.js` `listDropCard` (:96-103), `handoffForm` (:205-233).

Today a new video takes three presses: "Add it as a new episode", "Add the episode", "Take the hand-off". The title is already filled from the file (`addFromDrop`).

**Files (Ops worktree):**
- `app/src/views.js`: `listDropCard` (new card words and button), `handoffForm` (a line that names the episode).
- `app/src/app.js`: new `addAndTake()`; `listDropOf` (:54) keeps the hand-off's `revision`, `kind` and `name`.
- `app/src/main.js`: the action `addAndTake` (next to `addFromDrop` at :204).
- Tests: `app/tests/app.test.js`, `app/tests/views.test.js`, `app/tests/handoff.test.js` (matching untouched), `app/tests/forms.test.js` if the title field is used.
- `docs/guide/brimm-ops-guide.html` lines 417-421 and 476: the button steps (O2 does the names; O1 changes the steps).

**Interfaces.** Produces `app.addAndTake() -> Promise<{ ok, id?, n? }>`. It does what `addFromDrop` + `createEpisode` + the open of the new episode + `takeHandoff` do, in order, and stops at the first refusal with the message the page already has for it. Consumes `readHandoff`, `matchHandoff`, `videoHolder`.

**Failing tests first:**
- `views.test.js`: a list drop of a new video shows `This is a new episode: “Name”, revision 1.` and one button, `Add the episode and take the hand-off`. A later revision of a video an episode holds still opens that episode with `Take revision 3 in place of revision 2`, and now the form's summary reads `This is revision 3 of “Pricing”. The episode has revision 2.`
- `app.test.js`: with a new hand-off dropped, `addAndTake()` makes the episode with the file's name as its title, takes the hand-off, and ends with the episode open, its transcript saved, and the Reels synced. One call; the state holds no form.
- It refuses, saves nothing and says the usual words for: the same revision (an episode holds it already, so the list would have opened that episode instead; test the race by adding it between the drop and the press), a session's id older than the library's, a YouTube-link twin (opens the existing episode, as today), a withdrawn episode.
- If the episode's records have not loaded when the press comes, it waits for them (up to the page's own load) rather than saying "still loading".
- The old `addFromDrop` + `createEpisode` path still works (the New episode button's form is unchanged).

**Steps:**
- [ ] Write the tests; run `cd app && node --test tests/app.test.js tests/views.test.js`; they fail.
- [ ] Add `addAndTake` to `app.js` by composing `createEpisode` and `takeHandoff`; await the open episode's `loaded` state.
- [ ] Views and `main.js` wiring.
- [ ] The guide HTML steps (417-421, 476): `Drag the hand-off onto Episodes. If the page says it is a new episode, press “Add the episode and take the hand-off”. If it opens an episode, press “Take the hand-off”, or “Take revision 3 in place of revision 2” for a later revision.`
- [ ] `cd app && node --test && node build.js`. Expected: all pass; `dist/index.html` is built (not published).
- [ ] Commit.

**Words Sallie sees:** as above.

**Contract touched:** yes. The button `Add the episode and take the hand-off` replaces `Add it as a new episode` + `Add the episode` in the hand-off steps. `Take the hand-off` and `Take revision N in place of revision M` stay. R7b changes Studio's `guide.js` in step. The hand-off file, `HANDOFF_FORMAT` and the fixtures do not change.

**Check:** `cd app && node --test && node build.js`.

---

### O2. "BRIMM Video Studio" on every screen of the page (R4b)

**Goal:** The page says "BRIMM Video Studio" wherever Sallie reads "brimm-video".

**Files:** `app/src/views.js` (:222, :245, :278, :279, :313, :318, :534, :654, :693, :761, :786), `app/src/app.js` (:627, :664, :683, :836 comments stay), `app/src/handoff.js` (:22-25, :338: the messages), `app/src/main.js:173`; tests `views.test.js` (23 hits), `handoff.test.js` (27), `app.test.js` (16), `principles.test.js`, `rules.test.js`, `records.test.js`, `writing.test.js`, `withdraw.test.js`; `docs/guide/brimm-ops-guide.html` (:117, :269, :463, :533, :742-744, :775, :836).

**Stays as it is:** `HANDOFF_FORMAT = "brimm-video hand-off"` (`handoff.js:10`; the file's value); code comments; the text sent to Claude as instructions (`instructions.js`: :80, :82, :119, :256; `rules.js:85`), because her drafts are not in "brimm-video" words and the prompts are pinned by tests (ruling 6); the sentence in the guide that says the older tool is "brimm-video" on a Mac not yet switched (:836, :742).

**Failing tests first:** a guard `app/tests/names.test.js` renders each view that held the old name (the list drop card, the hand-off form, the Reels card, the library) and fails on `brimm-video` (case-insensitive) outside an allow-list that holds only the format value. The pinned message tests change to the new words.

**Steps:** tests; fail; replace; `cd app && node --test && node build.js`; commit.

**Words Sallie sees:** e.g. `A hand-off from BRIMM Video Studio, revision 2`, `Reels from BRIMM Video Studio`, `This hand-off was made by a newer BRIMM Video Studio (version 3). This page reads …. Ask Jason to update the page.`

**Contract touched:** the page's visible names. Studio's `guide.js` quotes `Reels from brimm-video` in `LATE_REELS` (:100-105, :127-130): R7b changes it to `Reels from BRIMM Video Studio` in the same round.

**Check:** `cd app && node --test && node build.js`.

---

### O3. A BRIMM Ops backup before every publish, in a second place (R6c)

**Goal:** Every publish is preceded by a dated backup, copied to a second place, and the rule is written down.

**Evidence:** `reliability.md` (no backup after 23 Oct; `backups/` not in git, one Mac); `arch.md` finding 6, options 6a and 6b.

**Files (Ops worktree):**
- `CLAUDE.md` ("The published page"): the rule `Before every publish: back up BRIMM Ops (README, "Backing up"), copy the backup to the second place, and say the date in chat.`
- `README.md` ("Backing up", "After each publish").
- Create `app/tools/second-copy.js` and `app/tests/second-copy.test.js`.
- `app/tools/withdraw-backups.js`: must also reach the second place (see below).

**Interfaces.** Produces `node app/tools/second-copy.js <date> [<second place>]`: copies `backups/<date>/` to the second place, byte for byte, never over a file, and prints counts only (never a word of a record). The second place comes from Jason's answer to Question 2 and is read from an environment variable `BRIMM_OPS_SECOND_COPY` when no argument is given.

**Failing tests first:** (stand-in folders in a temp dir)
- It copies every file of a backup into `<place>/<date>/` and prints `Copied N files of the backup of <date> to the second place.`
- It refuses to write over a file that is there.
- It prints no file content and no episode title.
- It refuses when `backups/<date>/` does not exist, and when the second place is inside the repo.
- `withdraw-backups.js` replaces the withdrawn words in the second place too (its tests: a backup in `backups/` and its copy in the second place both lose the words). Without this, a withdrawn client's words would survive in the second copy.

**Steps:** tests; fail; write the tool; extend the withdraw tool; write the rule in `CLAUDE.md` and `README.md`; `cd app && node --test`; commit.

**Words Sallie sees:** none.

**Contract touched:** none. A session reads session words only into files (the existing rule); the second place receives files, never chat text.

**Check:** `cd app && node --test`.

---

### O4. A one-page "first week" card in her guide (R6d)

**Goal:** The guide opens with one page that holds what she needs in her first week.

**Evidence:** `ux.md` option A of the guide's length; the guide is 849 lines.

**Files:** `docs/guide/brimm-ops-guide.html` only: a new section `<section id="first-week">` before `The whole path` (:162), with a link to each long part. No code. The Studio half of the guide (in the Studio repo) is out of scope here; the card points to it by name.

**Content (the builder drafts, Jason reads):** five things, one line each: how a video gets to Studio; where to say "I have a video"; the one hand-off to the page; Write what's next, approve, copy; who to tell when something is not right. Buttons are quoted from O1 and O2.

**Failing test:** if the guide has a test, extend it; otherwise a new `app/tests/guide-card.test.js` reads the HTML and checks that `#first-week` comes before `#path`, holds at most 250 words, and quotes only buttons that appear in `app/src/views.js` (it extracts the quoted button words and greps the views). This is the nearest thing to a cross-repository check that this round allows.

**Steps:** test; fail; write the card; `cd app && node --test`; commit.

**Contract touched:** quotes the page's buttons: wait for O1 and O2.

**Check:** `cd app && node --test`.

---

## Phase 2: Final Cut retired (outline only)

**Goal:** Studio no longer writes or reads Final Cut files. The seven Final Cut commands and about 2,700 lines go. `graphic` becomes only the base of #35's `graphic … ideas`.

**Modules (from `arch.md` finding 3 and architecture spec section 10, waves 2 to 6):** `fcpxml.js` (446), `layers.js` (169), `captions.js` (103), `pictures.js` (58), `styles.js` (221), `timeline.js` (269), `recut.js` (130), `reel.js` (108), `projects.js` (29), `portable.js` (103), most of `reels.js` (448) and `cuts.js` (636). Commands: `push`, `cut`, `captions`, `text`, `graphic` (keep `graphic … ideas`), `logo`, `preset`. In `edit.js`: the `COMMANDS` table (:7573), `finishEpisode`'s Final Cut branch (:2602-2640), `release`'s Final Cut guard. In the skill: "The guard", "The release question", "By hand in Final Cut" and the rows. In `guide.js`: the Final Cut stages (`viaApp` :37 area).

**Order:**
1. Pin what stays: `graphic … ideas`, `reels` listing, `cuts.js`'s cue and spans that #35's `graphic-cues.js` and `cut-suggestions` use. A test lists the exports that survive.
2. Take out the commands and their tests, one wave at a time (the spec's waves), whole suite after each.
3. Take the Final Cut branch out of `finishEpisode`, `guide.js`, `release` (which Phase 3 removes anyway).
4. Skill, README, `HELP`; regenerate `today-says.json` (help only).
5. The by-hand checks that name Final Cut are retired on the By-Hand page.

**Risks:** `cuts.js` and `reels.js` are shared with the HyperFrames path (suggested cuts, Reel candidates); a deletion that looks dead may not be. The older episodes' records hold Final Cut fields (`pushed`, `main.pushed`): a record is never rewritten, so the readers of those fields stay as read-only (`shownLine`). Her laptop's brimm-video still uses Final Cut; this branch ships only after the laptop has moved.

**Questions for Jason (later):** do old episodes' Final Cut libraries in `~/BRIMM Video Work` get a clean-up step? Does `free` keep freeing them?

## Phase 3: the local working folder (outline only)

**Goal:** Drops and the working folder are local. Only the edited export goes to Dropbox. Records and the hand-off file still go through Dropbox. Nothing waits for Dropbox.

**Modules (from `arch.md` section 5):** `settings.js` (`dropFolder`, `episodesFolder`, `importingFolder`, `workFolder`), `install.sh` (`WatchPaths`, the doctor), `switch.js`, `home.js`; the gated places (`places.js:72`, `never.js`, `studio.js`, `open-lock.js`); intake (`unedited.js`, `filing.js`, `importing.js`, `dropbox.js`); the record (`episode.js`, `kinds.js`, `versions.js`); `finish.js`, `exports.js`, `finish-check.js`; `release`, snapshots, take-over (`edit.js`: "other Mac" 90 times, "claim" 157, "bring" 104); `guide.js` (`Make online-only`, `Make available offline`); `free`.

**Order:**
1. A design note with Jason's answers on the record's layout, the "keep" mark and the AirDrop path. No code before it.
2. A second root in `settings.js`; every gated list learns it (privacy first, with tests that a session's raw video in the local folder is gated like Dropbox's).
3. Intake local: no clone, no `readThrough`, no late check for local files. The import's status files local.
4. The record stops listing local files and their sizes. A layout number rises. Writers first, readers tolerant.
5. `final/` keeps the export's check; nothing waits for it.
6. Remove `release`, snapshots and take-over; the guide loses the two Finder steps.
7. The "keep" mark: a raw video goes to Dropbox only when she marks it.
8. "Drop it, and it runs until it needs her": the import, the reading and the copy chain, with a notice only when she is needed.

**Risks:** her laptop's old brimm-video reads the same Episodes, so the new layout ships only after her laptop has moved. The raw video's only second copy is Dropbox today (`arch.md` finding 2): "keep" and a clean-up rule must exist before the move. A phone dropping into the folder goes (AirDrop or recording on the Mac instead). R1b and R1c become unnecessary for new videos and are removed then.

**Questions for Jason (later):** where a kept raw video is filed in Dropbox; how long a local raw video stays before a clean-up offer; whether the export's check in `final/` may fail loudly.

## The posting track (outline only; mostly BRIMM Ops)

**Order:**
1. **The rule first: done.** Jason approved the new wording on 5 Nov (questionnaire question 22). It is committed in step: Studio 024fbbd, BRIMM Ops 0b57033.
2. **The research report is in** (`posting-research.md` in the review's notes folder). Buffer and Later post YouTube Shorts only and have no Claude connector; Metricool has an official one (YouTube full episodes and Shorts, Instagram Reels, Facebook video). The design waits for Jason's answers to questionnaire questions 23 to 26 (the scheduler, the video's route, its size, a connector test).
3. Then: BRIMM Ops sends an episode's approved set to her scheduler through a connector in her own Claude, so no keys live in our code. She approves the set once; each piece goes at its planned time. YouTube, Instagram and Facebook first. Posts drawn from a session keep the rule: approved principles only, no client names.
4. Drafts as a Google Doc for her editor.

**Modules (Ops):** `app/src/writing.js` and `drafts.js` (the pieces), `review.js` (approval), `capabilities.json` (a new capability may be needed), `rules.js`, `views.js`, `main.js`. The Studio side changes only if the hand-off carries planned times (that would touch the contract).

**Risks:** a post cannot be unsent; a client's name in a post is a privacy breach; the capability list is restated at every publish (a capability left out is taken away); a connector's own terms.

**Questions to settle in the design:** Buffer or Later; which connector (Zapier, which she uses, or the scheduler's own); whether the scheduler can post a full YouTube episode with its title and description; where she sets the planned times; what she sees when a post fails.

---

## Rulings made in this plan, for Jason to check

1. **The local source is this Mac's own pending check's file** (R1b): the imported file in the drop folder while it is still the one that came in, or a joined video's work copy. Not the other Mac's, and not a file whose size differs. Reason: it is the file the late check itself puts back from, so it is the same bytes. Cost if wrong: the copy waits as today.
2. **The work copy's key comes from the Dropbox file** (R1b), so the project never says the recording changed. Cost if wrong: one wrong warning per project.
3. **`lateCheckAt` moves to `tool/late-wait.js`** (R1b), because `app.js` cannot import `edit.js`. Cost: one import line in `edit.js`.
4. **The hand-off question is a line Studio prints** (R3): `Hand-off question: I found your export. Hand it off?`, asked on one card with "Yes" and "Not yet". Studio's words are fixed; the chat does not word it (the same rule as the planned card).
5. **The page's one-press button is "Add the episode and take the hand-off"** (O1, R7b). "Take the hand-off" and "Take revision N in place of revision M" stay. The New episode form and its "Add the episode" stay for an episode made by hand.
6. **"BRIMM Video Studio" is a screen name; the prompts to Claude are not screens** (O2). `instructions.js` and `rules.js` text stays as it is, because tests pin it and she never reads it. `madeBy`, `HANDOFF_FORMAT`, ids, folder names and comments stay.
7. **The script copy is `plan "<title>" script`** (R5): a read-only copy in this Mac's work folder, opened in TextEdit. A hand-edited file gets its own plain line. Studio does not read her marks back; she tells the chat.
8. **Keeping a side rewrites the plan's files, then the record** (R6a), by the Dropbox rule. A refused write changes nothing.
9. **"Why it holds attention" reuses the field `why`** (R8b). No new field, no `reels.json` version. Reels read before this change print their old reason under the same heading.
10. **H7's Appendix A and B minors are not in this round,** except `app`'s line order and `status`'s explainer wording (R4c, R6b). They are listed in the ledger for a later round. Reason: the change list names none of them.
11. **Phase 2 comes after Phase 1 on this branch, and Phase 3 after Phase 2.** Phase 3 ships only after her laptop has moved to Studio. R1b, R1c and R1a's wait words are then removed with the wait.
12. **No cross-repository check this round** (the change list excludes it). The nearest guard is each repository's own pin of the other's words: `guide.test.js:18-24` in Studio and `views.test.js` and `guide-card.test.js` in Ops. The coordinator compares the button words by hand at each wave's end.

## Questions for Jason

1. **Should Claude's reading of a raw video also start at once (R1c)?** Today it waits for Dropbox's check, and the project will not open while it reads. So R1b alone does not shorten a raw episode's wait; it shortens a clip's, a Reel's and the copy's.
   - (a) No. Leave the reading's wait, and say the time honestly (R1a). Phase 3 removes the wait later.
   - (b) Yes, build R1c (size L, careful work in `reading.js` and `filing.js`). A raw episode then opens about fifteen minutes sooner, now.
   - (c) Yes, but only after Phase 2 (Final Cut retired), when `edit.js` is smaller.
2. **Where does the second copy of a BRIMM Ops backup go (O3)?** It holds every record, including sessions' principles.
   - (a) A private folder in your own Dropbox, not shared with Sallie.
   - (b) iCloud Drive, in your account.
   - (c) An external disk you keep, copied by hand after the session makes the backup.
   - (A private GitHub repository is not offered: the rules say not to put session words in git.)
