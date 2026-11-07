# BRIMM Video Studio: Final Cut retired (Phase 2 of the review changes), the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio no longer makes, reads or talks about Final Cut. The seven Final Cut commands, the full import, `release` with its snapshots and take-over, and about 4,000 lines of code (about 12,000 with their tests) go. `graphic "<episode>" ideas` stays, now with times on the video HyperFrames shows.

**Architecture:** Mostly deletion, in the order of the accepted design's retirement waves (architecture spec, section 10), re-derived from the code at 6cdf48b. Three kept things are rewired first so the deletions leave nothing dangling: the Reel candidates move out of `reels.js`, the finish's first-words check moves out of `parts.js`, and the two commands that print times (`graphic … ideas`, `reels`) read the video's own clock instead of a Final Cut timeline. One new small module, `tool/video-clock.js`. The record's layout, the hand-off file, its fixtures and `madeBy` do not change.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages).

**Spec:** Jason's change list of 5 Nov 2026, Phase 2, "Retire the Final Cut path" (https://claude.ai/artifact/Nrv9VMy8AgX9tGG78YyHf1; copy `CHANGE-LIST.md` in `~/Library/Application Support/Claude/side-session-notes/local_cf396f88-dcff-4c95-91e6-1f77aa69803f/team-review-2026-11-05/`). His answers on https://claude.ai/artifact/5Z8GNkqKe68PcNctRWNnMv: `finalcut` = "Retire it now"; `release` = r1 ("each video is edited start to finish on one Mac … This will not happen"). Jason, 6 Nov: Sallie isn't using brimm-video now, so Phase 2 does not wait for her laptop; all testing and deployment happen on the Mac Studio. The retirement waves: `docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md` section 10 (lines ~866-911) and F1 (lines ~89-114). The review's finding: `arch.md` finding 3 in the notes folder. Phase 1's plan, for its constraints and rulings: `docs/superpowers/plans/2026-11-05-review-changes-plan.md`.

**Not here:**
- Phase 3 (the local working folder): its own plan, `docs/superpowers/plans/2026-11-06-local-working-folder-plan.md`, which builds on this one.
- `clock.js`: kept whole (spec section 10; `handoff-v2.js`, the contract, imports it), even where a function of it falls out of use.
- Final Cut libraries already on the Mac Studio: never touched by code. A by-hand check counts them; Jason deletes by hand if he wants.
- Phase 1's parked Minors (M2, M6, M7, `reading.js`'s AGAIN words): Phase 3 takes M2 and M7 and the AGAIN words, where its code meets them (see that plan). M6 stays parked.
- Merging. Nothing merges, and nothing is pushed, without Jason's yes.

Line numbers are at 6cdf48b (Phase 1's tip). Each task moves them; a builder finds code by its function's name.

---

## The order

**Where the work happens:** Studio, a worktree of its own per builder, cut from the branch `claude/studio-final-cut-retired`, which is cut from `claude/studio-review-changes` at 6cdf48b (Phase 1, draft PR #40). If #40 merges first, the branch is cut from main instead. Tests: `cd tool && node --test`.

| Task | What | Size | Needs |
|---|---|---|---|
| F1 | Pin what stays; move the Reel candidates and the first-words check out | M | none |
| F2 | Times on the video's own clock (`graphic … ideas`, `reels`) | M | F1 |
| F3 | The reading makes no rough-cut video and no Final Cut file | M | F1; Jason's answer to Question 2 |
| F4 | The full import goes | L | F3 |
| F5 | `release`, the snapshots and the take-over go | L | F1 |
| F6 | The finish and the guide without Final Cut; `parts.js` goes | M-L | F5 |
| F7 | The seven commands and the Final Cut modules go | L | F2, F4, F6 |
| F8 | The words, the docs, the installer and the settings | M | F7 |

**Waves.**
- **A:** F1 alone. It changes import lines in about 20 files.
- **B, after A:** F2, F3 and F5 in parallel worktrees, merged one at a time with the whole suite after each. Then F4, after F3.
- **C:** F6 after F5. Then F7 after F2, F4 and F6. Then F8.

**Pre-flight: tasks that share files** (what one produces and the other consumes):

| Pair | Shared | Rule |
|---|---|---|
| F1 → every task | the import lines of `reels.js`'s users; `firstWordsMatch` | F1 first. Later tasks import from `reel-candidates.js` and `exports.js` |
| F2 / F7 | `edit.js` `graphic` (5327-5406) | F2 carves `ideas` out into its own handler; F7 deletes the rest of `graphic` |
| F3 / F4 | `unedited.js` `roughCut` (385-405), which `reading.js` `renderRough` (720-739) calls | F4 after F3. If Jason keeps the rough cut (Question 2), F4 keeps `roughCut` and `roughCutArgs` |
| F3 / F6 | `guide.js` (F3: `READING_STEPS`, `roughIn`; F6: the Final Cut stages) | different functions; merged one at a time |
| F5 / F6 | `edit.js` `finishEpisode` and `exports.js` (F5: `--take "<part>=this Mac \| the other Mac"`; F6: the Final Cut branch 2666-2693) | F6 after F5 |
| F5 / F7 | `edit.js` `newestPushes` (2895-2900), used by `withoutOwnAnswers` and `releaseEpisode` | F5 removes the `released.answers` handling; F7 removes the pushes |
| F4 / F7 | `graphic-cues.js` `cueMarkers`, `reels.js`, `fcpxml.js`, `projects.js` | F7 after F4 |
| F6 / F7 | `parts.js`, `freeLibrary` | F6 deletes them; F7 never meets them |
| every task | README rows, the skill's rows, `HELP`, `today-says.json` | one builder at a time on the skill (F5, then F7, then F8); `today-says.json` regenerated only in a task that changes `HELP`, and `git diff` shows only help lines and the removed commands' keys |

**Hot spots:** `tool/edit.js` (7,833 lines), `tool/unedited.js`, the two skill files. Every skill change goes into both `tool/studio/SKILL.md` and `SKILL-open.md`; `studio.test.js` checks their shared lines.

**Regenerated and pinned files:**
- `tests/fixtures/today-says.json`: `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command's lines as it did before labels" tests/edit-labels.test.js`. Then `git diff`: only help lines change, and the keys of a removed command go.
- `tests/contract.test.js` pins the hand-off fixtures. No task touches them. If it fails, stop.
- A change to the skill or `settings.js` text makes her folder "out of date" on a Mac until `settings.js studio` writes it again, on Jason's yes. The merge's by-hand check says so.

---

## Global Constraints

- **Branches:** work on `claude/studio-final-cut-retired`, in builders' own worktrees. Never in `~/Claude Code/brimm-video-studio` (the Mac Studio's live checkout, on main), never in the `studio-review-changes` worktree or a draft PR's branch. Nothing merges or is pushed without Jason's yes.
- **Posting:** Studio itself never posts, sends or publishes anything. Nothing here adds a way to.
- **Never read a `.env` file.** Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes. The installer runs only with `--print`.
- **Write a failing test first, then the code.** The whole suite passes before each commit: `cd tool && node --test`.
- **No test calls the real `claude`, HyperFrames, HeyGen, Final Cut or Dropbox.** Use the stand-ins and worlds in `tool/tests/`.
- **The contract with BRIMM Ops does not change:** `handoff.js`, `handoff-v2.js`, `tests/fixtures/handoff-*.json`, `tool/shared/`, `lib.js`, `run.js`, `madeBy` = `brimm-video <commit>`, `guide.js`'s quotes of the page's buttons.
- **Records are never rewritten.** Every field an old record holds stays readable and valid: `main.pushed` and `reels[].pushed` (lists), `main.texts`, `graphics`, `cuts`, `preset`, `logo`, `captions`, `libraries`, `released`, `editing`. `episodeFault` (`episode.js`) is not narrowed. New records keep writing `editing` and `released: null` as today, because the laptop's old brimm-video checks them (`episode.js:448-449`).
- **Stored values keep their words.** A status step, an answer state or a record field is never renamed; only what is printed changes.
- **Her chat stays Studio.** A command that goes leaves: its `COMMANDS` entry, its `HELP` lines, its `ASKED` entry (`edit-gate.test.js`), its `TODAY_ASKED` and `walkWords` entries (`edit-labels.test.js`), its README row (`part-f-fixes.test.js`), its gate-list entry (`gate.test.js`), its `WALK` entry (`edit-refs.test.js`) and its skill rows, in the same commit.
- **Sessions stay out.** Nothing new prints a session's label beyond the label, its words or a file name.
- **Words:** short sentences, no path, flag or command name in what she is told. The name on screen is "BRIMM Video Studio".
- **Commits** end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the builder's own model line).

## Review Focus

1. **`graphic … ideas` keeps working, and its times match HyperFrames.** For a raw video, an iPhone clip, a plan's video and a Reel (`ideas reel 2`), it lists Claude's cues with times on the video's own clock, the same seconds the project's `brimm/graphic-cues.json` gives each cue (`said at … s`). A record that still lists a rough-cut render or a Final Cut push changes nothing in the times. (F2's tests.)
2. **An episode from the Final Cut days still reads.** A record with `main.pushed` "push" entries, `edit/main.v1.mac-studio.fcpxml` in `files`, and `texts`, `graphics`, `cuts`, `preset` in `main`: `episodes`, `guide`, `open`, `app` (which makes a project from the recording), `spell`, `resolve`, `kind --again` and a finish from a HyperFrames export all work, and none calls it broken. (F6's and F7's tests.)
3. **The finish's first-words check still runs** for every HyperFrames part, from `part.expected`, after `firstWordsMatch` moves. (F1's and F6's tests.)
4. **A record Studio writes stays readable by older code.** A new raw episode's record after Claude's reading, and every record `open`, `kind` and `finish` write, carries `editing` and `released: null` and passes `episodeFault` at layout 4. (F3's and F5's tests.)
5. **Nothing she is told names Final Cut**, except the one line for an episode edited there before (F6), allow-listed. (F8's guard.)

## How each task is built

- **The builder:** one Sonnet builder per task, test first, in its own Agent worktree cut from the branch tip. It reads its task, the Global Constraints and the Review Focus.
- **The review:** a fresh read-only reviewer per task. A Critical or Important finding gets one fix pass, test first. A Minor goes into the ledger.
- **The coordinator:** reads every diff that touches `edit.js`, the skill or the contract files; runs the whole suite; runs `node tool/tests/unused-exports.mjs` (F1) after each merge; merges in the order above; keeps the ledger `.superpowers/sdd/2026-11-06-final-cut-retired-plan/progress.md`.

---

## Phase 2

### F1. Pin what stays, and move the kept halves out

**Goal:** Every export a kept module uses is pinned by a test, and the two kept things that live in doomed modules move out first. No behaviour changes.

**Evidence:** `reels.js` is imported by app-reel.js:60, app.js:78, edit.js:78 and :104, finish.js:32, reading.js:33, reel.js:11, timeline.js:17, suggestions-in-main.js:15, unedited.js:62 (spec F1 and section 10, wave 1: the candidates half stays, the previews and `reelProject` retire). `firstWordsMatch` (parts.js:163-176) is used for HyperFrames parts at finish.js:865 (`part.expected`), so it cannot go with `parts.js` (spec section 10, "Finishing": `exports.js` "does `parts.js`'s job … with `firstWordsMatch`").

**Files:**
- Create `tool/reel-candidates.js`: moved from `reels.js`, word for word: `REELS_FILE`, `readReels`, `reelsFile`, `reelEntries`, `mergeCandidates`, `reelCandidates`, `reelsText`, `uncropped`, `notMadeWords`, and the private helpers only they use. `reels.js` keeps `previewSteps`, `previewLimits`, `previewPath`, `reelProject`, `REEL_FRAME`, `GUESSED`.
- Modify the importers above to take the candidates from `reel-candidates.js` (unedited.js:62 is split between the two).
- Move `firstWordsMatch` into `tool/exports.js`; finish.js:17 imports it from there; parts.js keeps no copy.
- Tests: split `reels.test.js` into `reel-candidates.test.js` (the candidates' cases, moved unchanged) and `reels.test.js` (the previews'); move `firstWordsMatch`'s cases from `parts.test.js` to `exports.test.js`; change imports in app-reel.test.js, edit-finish-app.test.js, exports-world.js, phase4.js, reading.test.js, reel.test.js, reels-world.js, unedited.test.js, timeline.test.js.
- Create `tool/tests/kept-exports.test.js` and `tool/tests/unused-exports.mjs`.

**Interfaces.** Produces:
- `tool/reel-candidates.js` with the nine exports above, signatures unchanged.
- `exports.js` `firstWordsMatch(expected, opening) -> boolean`, unchanged.
- `tests/kept-exports.test.js`: one named import per kept export a kept module uses, each asserted `!== undefined`. The list: `reel-candidates.js` (nine), `exports.js` `firstWordsMatch`, `clock.js` (`keptWords`, `lengthOf`, `timelineAt`, `clockText`), `graphic-cues.js` (every name imported at app-reel.js:56, app.js:75, edit.js:98, join.js:14, plan.js:21, plan-project.js:10, readings.js:15, notes.js:13, project.js:40), `cuts.js` (every name imported by filing, final-transcript, finish, join, on-timeline, notes, reading, reframe, workcopy, unedited), `reframe.js` (every name imported by finish, notes, reading, readings, reel-candidates, unedited, except `needsReframe`).
- `tests/unused-exports.mjs`: `node tool/tests/unused-exports.mjs` prints one line `<module>: <export>` for each export of `tool/*.js` that no other `tool/*.js` imports (tests are not counted), then a line `Imports of files that are not there: <n>` with each one. Not a test (its name does not match `node --test`'s patterns).

**Failing tests first:**
- `kept-exports.test.js` fails at load: `reel-candidates.js` is not there, and `exports.js` has no `firstWordsMatch`.

**Steps:**
- [ ] Write `kept-exports.test.js`; run `cd tool && node --test tests/kept-exports.test.js`; it fails.
- [ ] Create `reel-candidates.js` by moving the code; change every import.
- [ ] Move `firstWordsMatch` and its cases.
- [ ] Split `reels.test.js`; change the tests' imports. No assertion changes: `git diff -U0 tool/tests | grep '^[-+]\s*assert'` shows only moved lines.
- [ ] Write `unused-exports.mjs`; run it; save its output in the ledger as the baseline.
- [ ] Whole suite. Commit.

**Words Sallie sees:** none. **Contract touched:** none. **Size:** M (moves only).

---

### F2. Times on the video's own clock

**Goal:** `graphic "<episode>" ideas` and `reels` print times on the video as HyperFrames shows it, so neither needs a Final Cut timeline, the rough cut or `timeline.js`.

**Evidence:**
- `clockFor` (timeline.js:252-268) reads the newest version shown on this Mac: the rough-cut render ("main v0", which `reading.js` lists in `main.pushed` at :563-575) or a Final Cut push, else "the main video as it is now" (the plan's kept pieces, cuts applied). For a finished video, a session or a clip, "the video".
- `clockRead` (edit.js:4566-4576) calls it for `graphic … ideas` (:5345); `reels` calls it at :4110.
- A HyperFrames project holds the whole recording and Claude's cues on the recording's own clock (`brimm/graphic-cues.json`, "clock: recording"; H7 check 58 expects `said at … s`). So today a raw video's ideas are listed on the rough cut's clock, which differs from the project's.
- What `ideas` needs (edit.js mapper): `flagsOf`, `episodeFor`, `hasFinalCut`, a clock, `ideasFor` (5302), `graphicIdeas` (5277), `wordsOnTimeline` (5255), `ideaWhere` (5309), `ideaSaid` (5311), `ideaLine` (5314), `noIdeas` (5323), `ideasAsk` (5325); the Reel refusals of `layerStart` (4527-4531).

**Files:**
- Create `tool/video-clock.js` and `tool/tests/video-clock.test.js`.
- `tool/edit.js`: the `ideas` branch of `graphic` (5339-5359) becomes `graphicIdeas`'s own handler, reached from `graphic` before `layerStart`; it keeps the Reel refusals (as `reelPartWhy(record, n)`, moved from `layerStart` 4527-4531); `clockRead` reads `videoClock`; `reels` (4104-4118) reads `videoClock`; `sayElsewhere` (4578-4582) has nothing to say and goes from `reels`.
- Tests: `edit-graphic-ideas.test.js`, `edit-reels*.test.js` (find with `ls tool/tests | grep reels`), `edit-session.test.js` (60-65, 486-489).

**Interfaces.** Produces `tool/video-clock.js`:
- `videoClock(found, ctx, part = "main") -> { clock, on, words } | { coming, bring } | { why }`.
  - `words`: the video's words from its `<stem>.words.json` (the record's `files` lists it; a plan's video uses the joined video's), spelled by `record.spellings` with the speller `clockFor` uses today (`spellWords`, moved here from timeline.js).
  - `clock`: one piece over the whole video, in the shape `clockOfRanges` returns, so `clockText` and `timelineAt` read it unchanged.
  - `on`: `"the video"` for the main video; `"Reel <n>"` for `{ reel: n }`, whose clock starts at the suggestion's start in `reels.json` and runs to its end.
  - `coming`/`bring`: the words file is listed but not whole on this Mac (`ctx.isWhole`), as `clockFor` says of a version's file.
  - `why`: no words file, or a Reel number `reels.json` does not hold, in `layerStart`'s words for that case.

**Failing tests first:**
- `video-clock.test.js`: a raw episode's words give a clock whose `timelineAt` of 12.4 s is 12.4 s; Reel 1 at 30-75 s gives 11.0 s for a word at 41.0 s and `on` "Reel 1"; a record whose `main.pushed` lists a v0 render and a v1 push gives the same answer as one with none; a words file not whole gives `{ coming: "<stem>.words.json" }`.
- `edit-graphic-ideas.test.js`:
  - "lists a raw video's cues with times on the video": the head line ends `with times on the video.`, and cue 1's line has its time at 0:12 in `ideaWhere`'s form, for a cue whose words are said at 12.4 s.
  - "needs no Final Cut file": with `edit/main.v0.fcpxml` neither in the folder nor in the record, the cues are listed (today: `edit/main.v0.fcpxml is not in the episode's folder.`).
  - "a Reel's cues from the Reel's start": `graphic "<id>" ideas reel 1` lists `with times on Reel 1.`
  - "Dropbox still bringing the words": `Dropbox is still bringing <stem>.words.json over to this Mac. Say it again when it is done.`, and a `bring` is started as `clockRead` starts one.
  - The existing cases that expect `main v0` or `the main video as it is now` now expect `the video`; the `--idea` add cases (167, 383) are left for F7.
- `edit-reels*.test.js`: a raw video's Reel suggestions are listed with times on the video, with no line about the other Mac's newer version.

**Steps:**
- [ ] Tests; run `cd tool && node --test tests/video-clock.test.js tests/edit-graphic-ideas.test.js tests/edit-session.test.js` and the reels files; they fail.
- [ ] `video-clock.js`; move `spellWords`.
- [ ] The `ideas` handler and `reelPartWhy`; `clockRead` and `reels` through `videoClock`.
- [ ] Whole suite. Commit.

**Words Sallie sees:** `Claude's ideas for graphics on <part>: N, with times on the video.` (and `… on Reel <n>.`); a plan's video: `The graphics of its video guide: N, with times on the video.` Nothing else new.

**Contract touched:** none. **Size:** M.

---

### F3. The reading makes no rough-cut video and no Final Cut file

**Goal:** Claude's reading of a raw video writes its cut plan, notes, Reel suggestions and the rough cut's captions and transcript, and nothing for Final Cut: no `edit/main.v0.fcpxml`, no rendered rough cut, no `main.pushed` entry, no QuickTime window. The reading ends minutes sooner. (Question 2: if Jason keeps the rough-cut video, F3 keeps the render, its record entry and the QuickTime window, and removes only the Final Cut file and `timelineFor`.)

**Evidence:** reading.js: `written`'s raw branch (497-557) writes `edit/main.v0.fcpxml` through `timelineFor(… build: true)` at 531-535 and renders at 536-538 (`renderRough` 720-739, into `~/BRIMM Video Work/<episode>/renders/<name> – version 0.mp4`); the record gets `main.pushed: [{ v: 0, how: "render", file: "edit/main.v0.fcpxml", opened }]` (563-575); `onPut` opens the render in QuickTime (578-587). No HyperFrames module reads any of them (Final Cut mapper: project.js, app.js, workcopy.js, exports.js and guide.js have no read of `fcpxml`, `rough-cut` or `.v0`). The rough cut's time is estimated in guide.js `READING_STEPS` (239, "Making the rough cut") and `roughIn` (250-254), and in edit.js `roughAt` (6147-6150, 7054-7062) and `answerKind`'s `Its rough cut is ready about` (6147-6149). Spec section 10, wave 2.

**Files:** `tool/reading.js` (the branch above, `renderRough`, `onPut`'s open, imports 39 and 41); `tool/guide.js` (239, 250-254, 446); `tool/edit.js` (6147-6150, 7054-7062 and `guideFacts`' use of `roughAt`); `README.md` (the reading's rows); tests `reading.test.js`, `edit-kind.test.js`, `edit-guide*.test.js`, `guide.test.js`, `progress*.test.js` if a step name is pinned.

**Keeps:** `<stem>.rough-cut.srt` and `<stem>.rough-cut.transcript.txt` (cheap text; the light import writes them too, unedited.js:983-985; `show … transcript` reads the latter until a project is in use, edit.js:3169-3175); the notes, the cut plan, `reels.json`, the history copies (501-507).

**Failing tests first:**
- `reading.test.js`, "a raw reading writes no rough-cut video and no Final Cut file": after `reading("raw")`, nothing under the episode's `renders/`, no `edit/` in the episode, `record.main.pushed` deep-equals what it was before, `record.files` has no `edit/main.v0.fcpxml`, the `openApp` stand-in is never called, and the result is ok with the cut plan and the notes in `made`.
- "still writes the rough cut's captions and transcript", from the reading's plan.
- `edit-kind.test.js`: a raw answer's line has no `Its rough cut is ready about`.
- `guide.test.js`: the reading's estimate has no rough-cut step.
- The R1c tests that expect the kept line (`The rough cut of <name> is kept on this Mac…`) no longer do; each keeps its `AGAIN` line.
- `episodeFault` passes the new record at layout 4, with `editing` and `released: null`.

**Steps:** tests; fail; change `reading.js`, `guide.js`, `edit.js`; README rows; whole suite; commit.

**Words Sallie sees:** gone: `The rough cut of <name> is kept on this Mac, in BRIMM Video Work, as "<file>".` and `Its rough cut is ready about <time>.` Nothing new: the reading's notice is as today.

**Contract touched:** none. **Size:** M.

---

### F4. The full import goes

**Goal:** Every run of the import is the light import: the drop folder's, any watched folder's, and a single file's. The rough cut, the upright version, the clips, the previews, Claude at the import, the Final Cut file and `--from-plan` go.

**Evidence:** unedited.js: `stepsFor` (291-294); the full branch of `workOn` (988-1150: Claude 996-998, rough cut 1030-1047, upright 1056-1069 with `upright` 466-492, previews 1072-1082 with `makePreviews` 576-622, clips `cutClips` 537-575 and `cutPiece` 516, Final Cut file 1089-1107 with `finalCut` 636-640, notes 1110-1117, `reels.json` 1155-1158); `--from-plan` (`videosFromPlan` 1920, `remakeVideos` 2012-2084, `LIGHT_REFUSAL` 1893). Watched folders and single files run the full import whatever the setting says (unedited.js:44-45). Both Macs are on the light import (README:7, :269, :361; the Mac Studio's settings say `"import": "light"` since 25 Oct; her laptop since 26 Oct). `needsReframe` is used at unedited.js 523, 892, 1059, 2039, 2065; `uprightQuality` only inside reframe.js (112, 187). Spec section 10, wave 3.

**Files:** `tool/unedited.js`; `tool/reframe.js` (`needsReframe`, `uprightQuality` and what only they use); `tool/reels.js` (the previews); `tool/cuts.js` (`roughCutArgs` and what only it uses, unless Question 2 keeps the rough cut); `tool/filing.js` (`fileEpisode`'s `fcpxml` argument, 122/135/156, and the `edit/` folder); `tool/settings.js` (`set --import full` refused); `tool/install.sh` (`--import full` refused); `README.md` "Unedited video" (75-227), rewritten for the light import; tests: `unedited.test.js` (the full import's describes, about 564-755, 756-887, 1446-1714, 1715-1794, 1795-2083, 3079-3237, 3238-3797, 4459-4501), `install.test.js`, `settings.test.js`, `edit-labels.test.js` (`today()` 60-80 and the describe at 157 that builds a full-import Mac), `reframe.test.js`, `reels.test.js`.

**Ruling:** `lightImport(settings)` keeps its meaning for the rest of the tool (a Mac whose settings don't say light is still "not set up" for the guide). Only the import's own code stops branching on it.

**Failing tests first:**
- `unedited.test.js`, "a single file is imported lightly": `unedited.js <file>` writes `.srt`, `.transcript.txt`, `.words.json`, `.cut-plan.txt`, `.cut-plan.json`, `.rough-cut.srt` and `.rough-cut.transcript.txt` beside it, and no `.mp4`, `.fcpxml`, `.edit-notes.txt` or `reel-*` file; the `claude` stand-in is never called.
- "a watched folder that is not the drop folder is imported lightly", the same.
- "`--from-plan` is gone": it prints `--from-plan is gone: the import makes no videos now.` and ends 2.
- `settings.test.js`: `settings.js set --import full` prints `The full import is gone: this Mac imports lightly.`, writes nothing, ends 2.
- `install.test.js`: `install.sh --print --import full …` prints the same sentence and changes nothing.

**Steps:** tests; fail; delete; rewrite the README section; whole suite; commit. Run `unused-exports.mjs`: no export of `reframe.js`, `reels.js` or `cuts.js` that F7 does not delete is newly unused.

**Words Sallie sees:** none (the import's banners and steps of the light import are unchanged). Jason's: the two refusals above.

**Contract touched:** none. **Size:** L (about 1,200 lines of code and 2,000 of tests go).

---

### F5. `release`, the snapshots and the take-over go

**Goal:** One Mac edits a video from start to finish. `release`, the hand-over snapshots, the rebuild from a snapshot, the set-aside of an older project and `--take-over` go. The claim stays, so the other Mac is still refused.

**Why in Phase 2** (ruling 1): `release`'s Final Cut half holds `parts.js` (`kindOf`) and the From Final Cut copies, which F6 and F7 delete; deleting `release` whole is less work than cutting it in two, and Jason decided on 5 Nov that it goes ("This will not happen"). It does not depend on the local folder.

**Evidence** (two-Mac mapper):
- `release` (edit.js:3875-3884), `releaseEpisode` (2910-3094), `removeSnapshots` (3102-3145), `projectOf` (2902-2903), `listing` (2476-2490, also the finish's Final Cut branch: F6 removes that use).
- The take-over: `claimAndBring` (1347-1430: 1360-1366, 1367, 1370-1375, 1393, 1401-1402), `yesFile`/`keepYes`/`forgetYes`/`yesOf` (1224-1247), `nextOf`'s take-over branch (1964-1971), `bring`'s `--take-over` (1904, 1921), `olderWords` (1508-1531), `detached.js` 161-163 and 211.
- The rebuild and set-aside: `app.js` `rebuildHere` (628-657), `openInApp` (905-942), `olderHere`/`asideWords`/`olderMarked` (663-685), `quitWords` (172-181), the words at 119, 132-156, 187-192; `app-reel.js` 391-427; `snapshot.js` (567 lines) and `hand-over.js` (234) whole.
- `exports.js`: the `released` input, `FROM["the other Mac"]` (187), `placeOf` (189), `RELEASED_FOLDER` (376), `exportsToCarry` (513-532), `--take "<part>=this Mac | the other Mac"` (283-303, the ask at 294-303, the line at 365); edit.js 2809-2848.
- `gate.js` 16-17 and 173 (`release` among the unanswered video's commands). `heldText` (episode.js:729-733) says `say "take it over"`.
- Skill: SKILL.md 3, 96, 129, 150-167, 227, 231-238, 258 (SKILL-open.md the same, 6 lines up). README: 283, 284, 287, 289, 325-333, 437, 443, 445.
- Warnings: the `handover` of the chat-to-app hand-over (`hyperframes.js` 8, 104, 132-133, 227-339; `app.js` 46, 193, 365-367, 472, 871-997, 1013-1027; `settings.js` 17-20, 289-306; `episode.js` 211) is NOT this and stays. `releaseEpisodeLock` (detached.js:155) is the lock's, and stays.

**Keeps:** the claim (`editing`, `claimed`, `heldElsewhere`, `claimHeld`, `claimAndWait` for `kind` and `teachings`, `CLAIM_WAIT_MS`); `released: null` in every new record; the readers of an old record's `released` (`recordDifferences` 3483-3507, `resolveIn` 3732-3744, `episodeFault`); `filesUnder` (also used at 6319 and 6444); `projectOnAnotherMac` (app.js:270-276, used by app-history.js 175 and 218 and edit.js 7605), with the refusal below; an old record's snapshot files and `edit/from-hyperframes/` files stay listed and checked as any listed file.

**Files:** the above; tests: delete `edit-release-app.test.js` (795), `edit-take-over-app.test.js` (831), `edit-set-aside-app.test.js` (1016), `snapshot.test.js` (1103), `snapshot-world.js` (147), `app-rebuilt.test.js` (500), `set-aside-pins.test.js` (218); change `edit-claim.test.js`, `edit-two-macs.test.js`, `exports.test.js`, `exports-words.test.js`, `detached.test.js`, `guide.test.js` (guide.js:427), `edit-app*.test.js`, `studio.test.js`, `studio-open.test.js`, and the command tables (Global Constraints).

**Failing tests first:**
- "release is no command": `node edit.js release "<ep>"` prints `HELP` and ends 2; `COMMAND_NAMES` has no `release`.
- "`--take-over` is no flag": `open`, `app`, `app … reel 2` with it print `HELP` and end 2, and nothing is claimed.
- "the other Mac's claim": `open`, `app`, `title`, `spell` on an episode with `editing.by` "Sallie's laptop" say `Sallie's laptop has <name> open. Carry on there. Nothing was changed.` and write nothing.
- "a project made on the other Mac": `app` says `The HyperFrames project of <name> is on <Mac>. Carry on there.` and claims nothing.
- "an old record from a hand-over still reads": a record with `released` (files, answers) and `app-snapshot/<time>/…` and `edit/from-hyperframes/…` in `files`: `episodes` lists it, `filesProblems` checks those files as any other, `resolve` shows its difference, and the record passes `episodeFault`.
- "a project whose folder is gone is made again under its own name" (app.js 264-266), with no snapshot.
- "a new record keeps `released: null`": the records `open`'s claim, `kind`'s claim and the finish write each have `released === null`.
- `finish --take "main=the other Mac"` is read as a file named "the other Mac", which is not there, in the words a missing file gets today.

**Steps:** tests; fail; delete and rewrite; skill, README, tables, `today-says.json` (help only); whole suite; `unused-exports.mjs` shows nothing left of `snapshot.js` or `hand-over.js`; commit.

**Words Sallie sees:**
- `heldText`: `<Mac> has <name> open. Carry on there. Nothing was changed.`
- The guide, for an episode open on the other Mac (guide.js:427): `It is open on <Mac>. Carry on there.`
- `app` for a project on the other Mac: `The HyperFrames project of <name> is on <Mac>. Carry on there.`

**Contract touched:** none (`guide.js` changes only a step before the page's steps). **Size:** L (about 1,500 lines of code and 4,600 of tests go).

---

### F6. The finish and the guide without Final Cut; `parts.js` goes

**Goal:** A video is finished only from HyperFrames' exports. The guide has no Final Cut stage. An episode from the Final Cut days is treated as a raw video not yet opened in HyperFrames.

**Evidence:**
- finish.js: the `!part.app` branches at 771, 863, 918, 995, 1178, 1188; `expectedWords` (143-150, used only at 863; `cutPhrases` import 19); `WAITING["final cut"]` (50); `whole()`'s Final Cut sentence (133); `finishFinished`'s (1392); titles from `onPictureOf(record)` for a Final Cut part (917-918).
- finish-check.js `PLACES` (23): "From Final Cut".
- edit.js: `finishWay` (2500-2510, "final cut" at 2508, `partsOf` at 2507); `finishEpisode`'s Final Cut branch (2666-2693: `fromFinalCutFolder`, `partsOf`, `lookFor`, `listing`, `askedOf` 2680); `finish --no-hand-edits "<part>"` (`askedPart` 2760; HELP 269-285); `freeLibrary` (2856-2893) with `programRunning`, `librarySize` (2851-2854), reached by no command; `free … library` (`LIBRARY_HELD_BACK` 3886-3889, 3905); `episodes`' libraries block (1151-1164) and `folderSize` (853-875); `guideFacts`' `shownInFinalCut` (7255) and `shownSinceFinish` (7260); HELP 157.
- guide.js: stages `finish-again` (432), `show` (456), `finish` (457); `viaApp` (338).
- `parts.js` (176): `partsOf`, `lookFor`, `kindOf` (F5 removed its last user), `unkeptParts`.
- `settings.js` `fromFinalCutFolder` (55).

**Ruling 2:** an episode with Final Cut pushes and no HyperFrames project in use is "unopened": the guide tells her to open it in HyperFrames, and `app` makes its project from the recording. Its Final Cut edits are not carried over; the guide says so once.

**Files:** the above; `parts.js` deleted; tests: `finish.test.js` (48-60 and its Final Cut cases), `edit-finish.test.js` (the `free library` cases from 368, the Final Cut finish), `parts.test.js` (deleted), `guide.test.js`, `edit-guide*.test.js`, `edit-episodes*.test.js` (the libraries block), `finish-check` tests.

**Failing tests first:**
- `finish.test.js`: "a HyperFrames part whose export opens with other words than `part.expected` is asked about", as today, with `firstWordsMatch` from `exports.js`.
- `edit-finish.test.js`: an old Final Cut episode (a v1 push, no project): `finish` says the "unopened" words; with a project and an export in Downloads it finishes from the export; a Share in From Final Cut is never looked at.
- `guide.test.js`: that episode's step is `It was edited in Final Cut before. Studio doesn't use Final Cut now: say "open it in HyperFrames" to edit it there, from the recording.`, and no stage of any other episode names Final Cut.
- `episodes`: a `.fcpbundle` in BRIMM Video Work is not listed.
- `free "<ep>" library` prints `HELP` and ends 2.

**Steps:** tests; fail; change; delete `parts.js`; README rows (finish 409-451 for From Final Cut, `free`); whole suite; commit.

**Words Sallie sees:** the guide line above (the one Final Cut line her words keep, allow-listed in F8). Gone: every "From Final Cut" and "Share" line of the finish, and `Final Cut's render files can be freed with File > Delete Generated Library Files.`

**Contract touched:** none. **Size:** M-L.

---

### F7. The seven commands and the Final Cut modules go

**Goal:** `push`, `cut`, `captions`, `text`, `graphic` (but `ideas`), `logo` and `preset` go, with every module only they used.

**Evidence** (edit.js mapper):
- Commands: `push` (1837-1870), `pushVersion` (1872-1891), `pushPart` (1696-1790), `guardOf` (1792-1835), `pushReel` (2455-2474); `logo` (5177-5203), `captions` (5205-5219), `text` (5221-5249), `graphic` but `ideas` (5327-5406), `preset` (5408-5429), `cut` (5431-5516).
- Helpers: the layer block (4496-4632: `partFrom`, `partLabel`, `withPart`, `nextId`, `lengthText`, `SHOW_IT`, `layerStart`, `momentFrom`, `timelineRead`, `lengthFrom`, `pictureFrom`, `saveWithPicture`), `ideaPlace` (5320), `inHyperFramesWords`/`notPickedWords` (2441-2453), `markReels`' picked path (2358-2416) and `pickReels` (2421), `newestPushes` (2895-2900), `shownLine` (1068-1076), the spellings' Final Cut sentences (`everShownInFinalCut` 4786 and the `allFinalCut` branches 4802-4899, 5010; `SHOW_IT` in `spell` 5151 and 5174; `presetOf` 5014).
- Imports: settings.js `pushedFolder`, `libraryFor` (70); portable.js (76); names.js `eventName`, `projectName` (77); reel.js (82); timeline.js (93); clock.js `momentOf`, `cutNear`, `wordsAt`, `secondsOf`, `rawAt`, `lengthOf`, `FRAME_SLACK` (94, `cut` only); pictures.js (95); layers.js (101); styles.js (102); recut.js (103); `REEL_FRAME` (104).
- Modules deleted: `fcpxml.js` (446), `layers.js` (169), `captions.js` (103), `pictures.js` (58), `styles.js` (221), `timeline.js` (269), `recut.js` (130), `reel.js` (108), `projects.js` (29), `portable.js` (103), `reels.js` (what F1 and F4 left). Also `graphic-cues.js` `cueMarkers` (397-399), `settings.js` `pushedFolder` (65) and `libraryFor` (67), and the `names.js`, `cuts.js` and `clock.js`-importing code that `unused-exports.mjs` then shows unused, except `clock.js` itself (kept whole).

**Keeps:** `clock.js` whole; `reframe.js`'s kept parts; `graphic … ideas` (F2); `reel drop` and `reel "<label>" <n> --client-agreed`; every old record field readable (Global Constraints); `recordDifferences`, `earlierFiles` (6313), `textInFinal`/`whatInFinal` (6253-6313), which know old Final Cut files.

**Files:** the above; tests: delete `fcpxml.test.js` (697), `fcpxml-layers.test.js` (139), `layers.test.js` (104), `captions.test.js` (68), `pictures.test.js` (43), `styles.test.js` (131), `timeline.test.js` (886), `recut.test.js` (99), `reel.test.js` (2101), `projects.test.js` (19), `portable.test.js` (186), what is left of `reels.test.js`; change `edit.test.js` (328-510, 995-1065), `edit-graphic-ideas.test.js` (167, 383), the spellings' tests, `clock.test.js` (its fcpxml import), `edit-records.test.js` (`pickReels`); rewrite `tests/phase4.js` with no `mainProject`, `relativeMedia` or `previewPath` and no `edit/main.v0.fcpxml` in its episode's files (31 files use it); the command tables, `today-says.json` (15 keys go).

**Failing tests first:**
- "the seven are no commands": `push`, `cut`, `captions`, `text`, `logo`, `preset`, and `graphic "<ep>" add …`, each print `HELP` and end 2.
- "an old record with Final Cut layers still reads": a record whose `main` holds `texts`, `graphics`, `cuts`, `preset`, `logo` and a v1 push: `episodes`, `guide`, `open`, `app`, `spell`, `graphic … ideas` and `resolve` all work, and it passes `episodeFault`.
- "a spelling says nothing of Final Cut": `spell … add` on a raw video with a project prints no "Final Cut", "timeline" or "show it".
- `phase4.js`'s episode has no Final Cut file, and the 31 files that use it pass.

**Steps:** tests; fail; delete; tables, README rows, skill rows (SKILL.md 106-111, 122-123 and the twin), `today-says.json`; whole suite; `unused-exports.mjs` shows no line for a deleted module's former users; commit.

**Words Sallie sees:** the spellings' replies keep only their HyperFrames sentences. Nothing new.

**Contract touched:** none. **Size:** L (about 2,300 lines of code and 5,000 of tests go).

---

### F8. The words, the docs, the installer and the settings

**Goal:** No doc, setting or screen describes Final Cut as part of Studio, and a guard keeps her words free of it.

**Files:**
- `tool/studio/SKILL.md` and `SKILL-open.md`: what is left of Final Cut ("Not ready yet", 239-244: the logo and look bullets, the hand-edit bullet, the "Delete Generated Library Files" tip; "By hand in Final Cut", 246-250; the description at line 3; "The guard", 222-230).
- `CLAUDE.md` (repo): "Both Macs" ("Final Cut Pro stays optional …; whether Studio still writes Final Cut files is Jason's call") and the rule "Final Cut Pro's library … is in `~/BRIMM Video Work`" become one line: Studio retired Final Cut on <the merge's date>; Final Cut can still open HyperFrames' MOV export by hand.
- `README.md`: 5, 7, 9; the module table (18, 27, 42); the Episodes layout (249-255); "Showing a timeline in Final Cut" (333-341); "The guard" (345); "Reel candidates" (393-394); what is left of the finish (409-451).
- `docs/requirements.md`: a line under "Decisions", dated, quoting Jason's "Retire it now".
- `tool/install.sh`: the Final Cut check (73-76, 608-630), `$WORK/From Final Cut` (581, 712, 899, 904), the "Done" text (975-983), the header (21, 90-92).
- `tool/settings.js` `show` (659-660): "Work in Final Cut" becomes "Work folder"; the "From Final Cut" line goes.
- Kept, ruling 3: `places.js` keeps its `Movies/Final Cut Backups` entry (75, 112). A deny rule in her folder costs nothing.
- Create `tool/tests/final-cut-words.test.js`.

**Failing tests first:**
- `final-cut-words.test.js`: walks the string literals of `tool/*.js` and `tool/studio/*.md` the way `studio-name.test.js` does, and fails on "Final Cut", "Share it", "push" as a command, or "fcpxml" in a string she can be shown; the allow-list holds F6's guide line and the readers of old records (`textInFinal`, `whatInFinal`, `recordDifferences`), which never print those words for a new episode.
- `install.test.js`: `--print` has no Final Cut line and makes no From Final Cut folder.
- `settings.test.js`: `settings.js show` prints `Work folder:` and no `From Final Cut`.
- `studio.test.js`: the twin skills share the new lines, and no row names a removed command.

**Steps:** tests; fail; change; regenerate `today-says.json` if `HELP` changed (help only); whole suite; commit.

**Words Sallie sees:** none new. **Contract touched:** none. **Size:** M.

---

## By hand, on the Mac Studio

For the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT), a new group "Phase 2: Final Cut retired", numbered after the last check on the page (74 today). Claude runs every Terminal step on the Mac Studio, reads the output and writes the answers; Jason does only what is on screen, one plain instruction at a time. Each check starts on his yes in chat. Use only Jason's own recordings, never Sallie's or a client's. `… edit.js <command>` stands for `node "$HOME/Claude Code/brimm-video-studio/tool/edit.js" <command>` (Claude runs the live checkout's scripts by absolute path and never `cd`s into it); `<id>` and `<label>` are read from `episodes` and written in. The page writes every command in full, with no placeholder left.

**P2-1. What Final Cut left on the Mac Studio.** *(Before the merge. Nothing is deleted.)*
1. Claude counts the Final Cut libraries and their size, without listing their names (an unanswered video's folder name can carry a client's name):
   `ls -d "$HOME/BRIMM Video Work"/*/*.fcpbundle 2>/dev/null | wc -l` and `du -shc "$HOME/BRIMM Video Work"/*/*.fcpbundle 2>/dev/null | tail -1`. Prints a number, then `<size>	total`.
2. Claude does the same for From Final Cut: `ls -A "$HOME/BRIMM Video Work/From Final Cut" 2>/dev/null | wc -l` and `du -sh "$HOME/BRIMM Video Work/From Final Cut" 2>/dev/null`.
3. Jason answers in chat: keep them, or delete them by hand later in Finder. Studio never deletes them.
- Answers: the two counts and sizes; Jason's choice.

**P2-2. The merge, and Studio brought up to date.** *(On Jason's yes at each step.)*
1. Claude checks nothing is importing: `launchctl list | grep com.thebrimm`. Every line starts with `-`.
2. Claude checks no late check is owed and no finish is checking: `ls -A "$HOME/Library/Application Support/BRIMM Video/pending" | wc -l` prints `0`, and `node "$HOME/Claude Code/brimm-video-studio/tool/edit.js" status` lists no run at work.
3. On Jason's yes, Claude merges #40 and then this phase's pull request on GitHub (`gh pr merge`).
4. Jason, in Terminal (Claude's guard refuses git in the live checkout): `git -C "$HOME/Claude Code/brimm-video-studio" pull --ff-only`. Prints `Fast-forward` and the files.
5. Claude checks the commit: `git -C "$HOME/Claude Code/brimm-video-studio" log --oneline -1` (read only).
6. On Jason's yes, Claude writes her folder again: `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" studio --node "$(command -v node)"`. Prints `Written:` and her folder's path.
- Answers: what each step printed.

**P2-3. A recording of yours, from drop to hand-off, with no Final Cut.**
1. Jason: drag a short recording of his own (one or two minutes, landscape) into Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio.
2. Claude: `… edit.js episodes` shows it waiting; Jason tells Claude it is raw, no session; Claude: `… edit.js kind "<label>" raw --private no`.
3. Claude: `… edit.js guide "<id>" tell`. Expect: read by Claude. With F3 as planned, no QuickTime window opens and no rough-cut line is said.
4. Claude: `… edit.js graphic "<id>" ideas`. Expect: `… with times on the video.`
5. Claude: `… edit.js app "<id>"`. Expect `It's open in HyperFrames.` and the buttons line.
6. Jason, in HyperFrames: ask "What graphics does Studio suggest?". Expect its cues; one cue's time matches step 4's (the same second).
7. Jason: Export, This Mac. Claude: `… edit.js finish "<id>"`, then on Jason's yes `… --yes`. Expect the hand-off written and shown in Finder.
8. Jason: drag the hand-off onto the BRIMM Ops page's Episodes. Optional; it adds a test episode there for good.
- Answers: what steps 3, 4, 5 and 7 printed; whether the times matched; how long from the answer to "read".

**P2-4. An episode from the Final Cut days.** *(Only if the Mac Studio has one: an episode of Jason's own that was pushed to Final Cut, from before 27 Oct. Claude finds one by its record, without listing names: an episode whose `main.pushed` holds a "push". If none, skipped.)*
1. Claude: `… edit.js guide "<id>"`. Expect: `It was edited in Final Cut before. Studio doesn't use Final Cut now: say "open it in HyperFrames" to edit it there, from the recording.`
2. Claude: `… edit.js app "<id>"`. Expect the project made from the recording and opened. Jason: look that HyperFrames shows the whole recording.
- Answers: what steps 1 and 2 said.

**P2-5. The page's Final Cut checks retired.** Claude marks as skipped, with the note "retired with Final Cut in Phase 2": `pr10-final-cut`, and every step of the `pr11` group (`release`, the rebuild, a big project, the two Macs) and the `pr18` group (set-aside). Nothing to run.

---

## Rulings made in this plan, for Jason to check

1. **`release`, the snapshots and the take-over go in Phase 2 (F5), not Phase 3.** Reason: `release`'s Final Cut half holds `parts.js` and the From Final Cut copies, which Phase 2 deletes; removing `release` whole is less work than cutting it in two; you decided on 5 Nov that it goes, and it does not need the local folder. Cost if wrong: until Phase 3, no episode can move between the Macs, which you said will not happen.
2. **An episode edited in Final Cut before is opened in HyperFrames from its recording** (F6). Its Final Cut edits are not carried over, and the guide says so once. Cost if wrong: such an episode is edited again from the start, or finished in Final Cut by hand and dropped as a finished video.
3. **Her folder's lock keeps its "Final Cut Backups" entry** (F8). A deny rule costs nothing. Cost: none.
4. **Times are on the video HyperFrames shows** (F2), not on the rough cut. They then match the project's own cue file. Cost if wrong: an old episode's times move by the length of its cuts.
5. **The full import goes, and every run is light** (F4), including a single file run by hand. Cost if wrong: making a rough cut, an upright version or clips at the import needs the old code back.
6. **`clock.js` is kept whole**, as the accepted design says, even where a function of it is no longer used. Cost: a few unused lines.

## Questions for Jason

Asked one at a time, in this order, on a page he answers in (the coordinator's), never only in chat. Phase 3's plan has two more.

1. **Is brimm-video still switched on on Sallie's laptop?** Her laptop has run brimm-video's import, watching her drop folder in Dropbox, since 26 October; nothing in the repo says it was turned off. Phase 2 changes nothing her old tool reads. Phase 3 changes the record's layout, so its plan keeps every field her old tool checks either way.
   - (a) It's off, or the laptop is put away.
   - (b) It may still be on. Then, when you're next at her laptop, Claude gives you one step to turn it off until her move (on your yes).
   - (c) Not sure: treat it as on.
2. **After Claude reads a raw video, Studio makes a rough-cut video and opens it in QuickTime. HyperFrames doesn't use it. Keep it?**
   - (a) Let it go with Final Cut (as the accepted design planned). Claude's reading finishes a few minutes sooner, and she watches the cuts in HyperFrames.
   - (b) Keep it. F3 then removes only the Final Cut file.
