# Phase T: the transcript tool moves into brimm-video, and each shared file gets one owner. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** brimm-operations' transcript tool runs from brimm-video on the Mac Studio and Jason's MacBook, doing exactly what it does today; the fix for Dropbox placeholders exists once, in brimm-video; and every file the two repos share has one owner, with a test in each repo that notices when a copy falls out of step. BRIMM Ops is then the page only.

**Architecture:** First the placeholder fix lands: PR #31, built in a session of its own, makes brimm-video's `readThrough` read a file through with python3, as brimm-operations PR 29's `bringDown` does. Phase T waits for it and builds none of it (Task 1). Then the tool moves as it is (Task 2): `tool/transcribe.js` beside `unedited.js`, sharing one `lib.js`, `run.js` and `dropbox.js`, with its own installer, under the same launch agent label, folders, log, model and lock, so each Mac switches in either direction with one installer run. Its 207 tests move with it, and lose their duplicates afterwards (Task 3). BRIMM Ops keeps owning `text.js`, `answers.js`, `transcript.js` and the show's two names; brimm-video owns the hand-off fixtures and a new `.srt` fixture; each repo checks the copies the other takes from it by sha256 (Tasks 4 and 5). Each Mac is switched by hand with Jason (Task 6), and after a week of real use a session in brimm-operations removes `transcribe/` (Task 8).

**Tech Stack:** Node 22 or later (ESM, `node:test`, `node:crypto`), zsh installers, launchd, `/usr/bin/python3 -I` with ctypes for `setiopolicy_np`. No packages, as now.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`: phase T's row in the phases table, "What this rests on" (the move, and the three changes asked of brimm-operations), and section 5's hand-off. Where this plan departs from phase T's row, ruling 2 says so.

**When:** after the review of PRs #23 to #30 is finished (the session "Review brimm-video PRs #23–#30 with Jason"). Written on 2026-10-20 against brimm-video `main` at `ac87420` and brimm-operations `main` at `ced8fe5`. Nothing here is built, merged, pushed or installed, and no launch agent is touched, without Jason's yes in chat.

## Global Constraints

- The tools draft. Nothing here posts, sends or publishes.
- Never read a `.env` file. No secret is added: no token in either repo's CI, no second key on Sallie's laptop.
- Nothing is installed on a Mac and no launch agent is added or changed without Jason's yes in chat. Installers run with `--print` in tests and by hand; without it only in Task 6, after the yes.
- Write a failing test first, then the code. Before each commit, run the whole suite in a checkout (a worktree, not a `git archive` copy: one brimm-video test reads the checkout's commit): `cd tool && node --test`, all pass, 0 fail.
- No test runs the real ffmpeg, transcriber, `claude`, `launchctl` or Final Cut, and no test writes into Dropbox. A session that runs real ffmpeg gives it a memory and time watchdog on a detached process group.
- Never use or change the main checkout `~/Claude Code/BRIMM video` from a session: it runs the launch agents and stays on `main`. Work in worktrees. Scratch copies of a tree are made with `git archive`.
- A brimm-video session reads brimm-operations and never changes it, and the other way round (both CLAUDE.md files say so). Tasks 5 and 8 are written for a session opened in brimm-operations.
- Never rebase or force-push a PR branch; merge `main` into it.
- Match the code around it: comments in full plain sentences, messages a person reads in plain words, exit codes 0, 1 and 2 as now.

## What was checked on 2026-10-20

- **brimm-video's placeholder fix is PR #31,** "Read a Dropbox placeholder through with python3, which turns downloads on for itself" (https://github.com/jogden12/brimm-video/pull/31), opened at 16:45 UTC from the branch `claude/busy-chebyshev-4d1df6` by the session "Dropbox placeholder fix for brimm-video's readThrough", which the PR review session started at 16:27 UTC. It is open and not merged. It keeps `readThrough`'s name and its promise in `dropbox.js`, and has python3 read the file through with downloads turned on for itself (`setiopolicy_np(3, 0, 2)`), saying how far it has got on standard output, and given up after 2 minutes with nothing read. It changes `dropbox.js` and its tests, one line of `unedited.test.js` and one paragraph of the README. Before it, GitHub had no branch or PR for the bug (its newest branches were of 2026-10-15), and nor did this Mac.
- **brimm-operations `main` (`ced8fe5`) holds PR 29** (`3a5eeff`, merged 15:43 UTC). `transcribe/` changed twice since `84a2f61`: the move of video editing (`19c897f`, which also took `captionsOf` out of its `lib.js`) and PR 29. Its tests, run here in a `git archive` copy: 207 pass (129 in `transcribe.test.js`, 66 in `lib.test.js`, 12 in `install.test.js`). The page's: 953 (PR 29's count).
- **The Mac Studio's agent**, from its plist: `com.thebrimm.transcribe` runs `/opt/homebrew/bin/node "~/Claude Code/BRIMM operations/transcribe/transcribe.js" --watch "<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer" --watch "<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer"`, with the same two folders as WatchPaths, RunAtLoad, and the log `~/Library/Logs/brimm-transcribe.log`. `<Dropbox>` is `~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden`. Once PR 29 was pulled it transcribed the iPhone video that had failed on 2026-10-15 (the log, 15:48 UTC). `com.thebrimm.unedited` watches `<Dropbox>/The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio` only.
- **The page's copies are in step.** `tool/shared/text.js`, `answers.js` and `transcript.js` are brimm-operations `main`'s `app/src/` files byte for byte after their first line, and `show.js` holds `instructions.js`'s two lines as they are. `tool/lib.js` and `tool/run.js` differ from `transcribe/` only as section 2 says.
- **The hand-off fixtures are not.** brimm-video #16 named the finished videos `.mov` on 2026-10-14, after brimm-operations had copied the fixtures at `ab72782`; its copies still say `.mp4`. The page reads `file` as text, so nothing broke, and no test noticed.
- **Sallie's laptop does not run the transcript tool.** Its guide (`docs/setup/sallies-laptop.md`, and #28's version of it) clones brimm-video only and installs `com.thebrimm.unedited` only. Nothing there clones brimm-operations.
- **Jason's MacBook** (from the brief, not checked from here) runs `com.thebrimm.transcribe` from a brimm-operations checkout on `The BRIMM DB/BRIMM VIDEO MacBook` since 2026-10-15. Whether it has a brimm-video checkout is not known (Open question 1).
- **CI.** brimm-video's runs `node --test` in `tool/` on every push and pull request. brimm-operations' runs only for changes to `app/**`, `transcribe/**`, `seed/**`, the brief and the workflow, with the transcript tool's tests as a step of their own.

## 1. Inventory, and the owner of each file afterwards

### brimm-operations' `transcribe/` (at `ced8fe5`)

| File | What it is | Afterwards |
|---|---|---|
| `transcribe.js` (723 lines) | The tool: arrival, bringing a placeholder down, transcription, filing, Zoom calls, the lock, the command line | brimm-video's `tool/transcribe.js` (Task 2). Its `runProgram`, `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning` and `takeLock` are `tool/run.js`'s; its `isWhole` is `tool/dropbox.js`'s; its `bringDown` gives way to `dropbox.js`'s `readThrough` as PR #31 makes it (Tasks 1 and 2) |
| `lib.js` (271) | Its rules | One `tool/lib.js` (Task 2): the shared rules are there already, and the Zoom rules, `waiting` and `isDayName` join them |
| `install.sh` (216) | The installer of `com.thebrimm.transcribe` | `tool/install-transcribe.sh` (Task 2) |
| `package.json` | Its name, ESM, Node 22 or later | Not carried: `tool/package.json` says the same |
| `tests/transcribe.test.js` (129 tests) | The tool end to end, with stand-ins | `tool/tests/transcribe.test.js` (Task 2), but for the five tests of `bringDown` and of `runProgram`'s `quiet`, which are not carried (ruling 5); duplicates out in Task 3 |
| `tests/lib.test.js` (66) | The rules | Into `tool/tests/lib.test.js` (Tasks 2 and 3); 20 are there already word for word, and one more with brimm-video's extra asserts |
| `tests/install.test.js` (12) | The installer, with `--print` | `tool/tests/install-transcribe.test.js` (Task 2) |
| All of `transcribe/`, from Task 2 to Task 8 | | Stays in brimm-operations unchanged, only as the way back, until Task 8 removes it |

### What in brimm-operations refers to it

| Where | What it says | Afterwards (Task 8, unless said) |
|---|---|---|
| `.github/workflows/app-tests.yml` | `transcribe/**` in both path lists; the step "Run the transcript tool's tests" in `transcribe/` | Both path entries and the step removed |
| `CLAUDE.md`, "The transcript tool" | How to test it; that it reads captions with the page's `tidyTranscript`; nothing installed without Jason's yes | Task 5 adds the rule for copies and the freeze; Task 8 makes it a short "brimm-video" section: video editing and the transcript tool live there, and are not added back |
| `README.md`, "What is where" | The `transcribe/` row | Row removed |
| `README.md`, "The transcript tool" (lines 54–122) | Setting it up, using it, Zoom calls, placeholders | Moves to brimm-video's README (Task 2). Here a short "Transcripts from brimm-video": where a video is dropped, that its `.srt` goes into the page by "Choose a file", and a link to brimm-video |
| `README.md`, "Video editing" | "This repo keeps the transcript tool, which feeds the page" | "This repo keeps the page only", with its Short video format |
| `README.md`, "Setting up on another Mac" | `cd transcribe && node --test`; the transcript tool's bullet; python3 | Those lines removed (git still needs Xcode's command line tools) |
| `docs/requirements.md`, line 302 | "It moves to brimm-video too … Until it moves, it keeps watching the YouTube and Zoom folders as today." | "Moved to brimm-video on <date>", and a dated line under "Changes" |
| `docs/requirements.md` lines 37, 261, 321 and 324; `docs/research/2026-10-13-cloud-transcription/` (4 files); `docs/superpowers/plans/2026-10-14-l7-brimm-video-hand-off.md` | What was true then | Unchanged: they are history |
| `app/` | Nothing in it imports `transcribe/`. `transcribe/` imports `app/src/text.js` (`localDay`) and `app/src/transcript.js` (`tidyTranscript`, and `hasStamps` in its tests) | Nothing changes; the moved tool imports brimm-video's copies |

### brimm-video's copies, and its code that does one job twice

| Where | Job | Its twin | Afterwards |
|---|---|---|---|
| `tool/shared/text.js`, `answers.js`, `transcript.js` | The page's helpers, reading Claude's replies, reading an `.srt` (`tidyTranscript`) | brimm-operations' `app/src/` files (the same bytes after line 1) | Owner: BRIMM Ops. brimm-video keeps copies under the guard (Tasks 4 and 5) |
| `tool/shared/show.js` | The show's and the host's names | `app/src/instructions.js`, its `SHOW` and `HOST` lines | The same |
| `tool/lib.js` | The rules both tools follow | `transcribe/lib.js` | Owner: brimm-video, one file (Task 2) |
| `tool/run.js` | Running a program, finding the programs, the folder lock | The same code in `transcribe.js`, which since PR 29 also has `runProgram`'s `quiet` | Owner: brimm-video. `quiet` is not carried: only `bringDown` used it |
| `tool/dropbox.js` `isWhole` | Is a file here whole, or a placeholder | `transcribe.js` `isWhole`, the same code | brimm-video's, once |
| `tool/dropbox.js` `readThrough`, used by `unedited.js` (the import's arrival check) and `edit.js` (`bring`) | Bring a placeholder down | `transcribe.js` `bringDown` (PR 29) | PR #31 rebuilds it to read with python3 as `bringDown` does (Task 1), and it is the one copy. Today it reads with node, and a program a launch agent starts has downloads off, so its read fails with "Resource deadlock avoided" (EDEADLK), as the transcript tool's did |
| `transcribeFile`, `unedited.js` `workOn`, `final-transcript.js` `finalTranscript` | Sound, captions, the silence filter, the spellings, the `.txt` | Each other | Three callers of `lib.js`'s steps, kept apart (ruling 11) |
| The arrival loops in `transcribeFile`, `workOn` and `finish.js` | Wait until a file has arrived | Each other | Kept apart (ruling 11) |
| `tool/install.sh` and `tool/install-transcribe.sh` | Find the programs, write and load a plist, fetch the model, refuse the other tool's folders | Each other | Two scripts (ruling 6); their shared shell lines are not made one file now |
| `tool/tests/fixtures/handoff-v1.json`, `handoff-v1-short-video.json` | The hand-off's contract | brimm-operations' `app/tests/handoff/` (stale, `.mp4`) | Owner: brimm-video. brimm-operations copies them again, under the guard (Task 5) |

## Rulings

1. **Same label, folders, log, model and lock.** The label stays `com.thebrimm.transcribe`; each Mac keeps its folders, in their order; the log stays `~/Library/Logs/brimm-transcribe.log`; the model stays `~/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin`; the lock stays `<temp folder>/brimm-transcribe-<sha1 of the folder>.lock`; dated folders, `.failed.txt` notes and file names stay. Why: an installer replaces the agent of its own label in one stop and start, so no folder is ever watched by two agents on one Mac; `tool/install.sh` already reads this label's plist to refuse its folders; and each copy understands what the other left in a folder, so going back is one installer run.
2. **The move changes nothing the tool does.** Only lines that name a path change ("Run tool/install-transcribe.sh to set this Mac up."), and the words of one reason (ruling 5). Phase T's row also puts the tool "under the Dropbox rule and writing the progress file". Both change what it does in a synced folder or on the screen, so each waits until after the week of real use, as a task of its own with its own yes (Open question 2). So does mapping the first sound ffmpeg can read, which the import does for iPhone videos and the transcript tool does not: `ffmpegArgs` given no stream gives brimm-operations' arguments exactly.
3. **One `tool/lib.js`:** brimm-video's, with its optional sound stream in `ffmpegArgs` and its `captionsOf`, plus the transcript tool's own rules word for word, with their comments and private helpers: `zoomCall`, `isLocal`, `callKind`, `callName`, `callTag`, `waiting`, `isDayName`, `soundOf`, `companions`, `localRecordings`, `mayBeTranscript`, `TRANSCRIPT_BYTES`, `filedIn`, `zoomCalls`, `callNotes`, `looseTranscripts`, `lastCaptionEnd`, `lengthArgs`, `lengthOf`, `pairTranscripts`, `setSettled`. This is phase T's "sharing one `lib.js` and `run.js`".
4. **`tool/transcribe.js` holds only what is its own.** It imports `runProgram`, `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning` and `takeLock` from `run.js`, `isWhole` and `readThrough` from `dropbox.js`, and `localDay` from `shared/text.js`. Each of those pairs is the same code today but for comments, and but for `runProgram`'s `quiet`, which only `bringDown` used and which is not carried.
5. **`readThrough` is the one way to bring a placeholder down.** PR #31 rebuilds it (Task 1) to work as PR 29's `bringDown` does: `/usr/bin/python3 -I` turns downloads on for itself alone (`setiopolicy_np(3, 0, 2)`), reads the file through saying how far it has got, and is given up after 2 minutes with nothing coming. It keeps its name and its promise, which rejects with the reason, so the import and `bring` call it as before. The transcript tool's `bringDown` is not carried: `transcribe.js` keeps its `{ ok, why }` with an adapter of one line, `(file) => readThrough(file).then(() => ({ ok: true }), (e) => ({ ok: false, why: e.message }))`. Its reasons read as before ("Resource deadlock avoided", "spawn /usr/bin/python3 ENOENT") but for a stall: the note then says "Dropbox sent nothing of it for 2 minutes, so it was given up" where it said "nothing of it came for 2 minutes". Each caller keeps its own policy: the import asks once a run and keeps looking; `bring` lists what could not be read; the transcript tool leaves a note. python3 comes with Xcode's command line tools, which both Macs have for git (brimm-video's installer checks for them).
6. **A second installer, `tool/install-transcribe.sh`, not a mode of `install.sh`.** The transcript installer and its 12 tests move as they are, PR #26 is reworking `install.sh`, and each script keeps refusing the other tool's folders, as both do today. Its plist runs `<checkout>/tool/transcribe.js`.
7. **Tests move whole, then lose their duplicates.** Task 2 adds exactly 202 of the 207 (the five of `bringDown` and `quiet` stay behind, ruling 5) and 2 new ones, so the move can be counted. Task 3 then removes, by a written list, the moved tests that brimm-video already has.
8. **The drift guard is a pair of hash tests** (section 3).
9. **The hand-off stays as it is.** `final/<name>.brimm-ops.json`, `format` "brimm-video hand-off", `version` 1, with its fixtures `tool/tests/fixtures/handoff-v1.json` and `handoff-v1-short-video.json` here and copies in brimm-operations' `app/tests/handoff/`. Nothing in this plan changes a byte that `finish` writes or the page reads, and the hand-off stays the two apps' only link: the transcript tool's `.srt` reaches the page as today, when Sallie gives it to the form. The only fixture work is brimm-operations copying the two fixtures again (they name `.mov` since brimm-video #16), and the guard on them.
10. **One new contract fixture,** as phase T's row asks: `tool/tests/fixtures/transcript-v1.srt` and `transcript-v1.transcript.txt`, the two files the transcript tool writes for a made-up video. brimm-video tests that the tool writes exactly them; brimm-operations tests that the page makes the `.txt` of the `.srt`.
11. **The three transcriptions and the arrival loops stay apart.** They already share every step through `lib.js`, and what differs differs on purpose: the import's word pass and sound stream, the finish's episode spellings, the transcript tool's filing and notes. Folding them is a change of behaviour, and touches `final-transcript.js`, which PRs #29 and #30 change.
12. **Sallie's laptop gets no transcript agent here** (Open question 3).

## 2. One copy of the shared runtime code

| What | brimm-video now | brimm-operations now | The one copy | Settled by |
|---|---|---|---|---|
| `runProgram` | `keep`, `out`, `input`, `cwd`, `limit` | The same, and `quiet` (`wentQuiet`), since PR 29 | `run.js`, without `quiet` | Only `bringDown` used `quiet`, and it is not carried |
| `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning`, `takeLock` | `run.js` | `transcribe.js` | `run.js` | The same code; Task 2 imports them |
| `isWhole` | `dropbox.js` | `transcribe.js` | `dropbox.js` | The same code but for a comment |
| Bringing a placeholder down | `readThrough`: node's `createReadStream`, rejects; EDEADLK under a launch agent | `bringDown`: python3 with downloads on, `{ ok, why }` | `readThrough`, in `dropbox.js`, as PR #31 makes it | Task 1 (PR #31), and Task 2's adapter |
| `ffmpegArgs` | An optional sound stream | None | brimm-video's | Given no stream it gives brimm-operations' arguments (an existing test); the transcript tool keeps calling it so |
| `captionsOf` | Here | Taken out at `19c897f`: only video editing used it | Kept | — |
| The Zoom rules, `waiting`, `isDayName` | Not here | `lib.js` | `lib.js` | Task 2, word for word |
| `isMedia`, `outputsFor`, `dayFolder`, `whisperArgs`, `silenceArgs`, `silences`, `dropSilent`, `spellNames`, `PROMPT`, `stampedText`, `captionCount`, `settled` | `lib.js` | `lib.js` | `lib.js` | The same code |
| `tidyTranscript` (which `stampedText` uses) and `localDay` | `shared/` | `app/src/` | BRIMM Ops' | The guard (section 3) |

## 3. How drift is caught

**Chosen: a hash test in each repo, and each copy's first line naming the commit and the hash it was copied at.**

| Way | | Why |
|---|---|---|
| Hash tests | Chosen | No access from one private repo to the other, no package, no secret and no network: it runs in both CIs and on Sallie's laptop, which has brimm-video only. brimm-operations' test sits in `app/tests/`, which the page's build never reads, so the build's rules (only `import { a } from "./file.js";` and `export const`, `function` or `class`) are untouched |
| A git submodule | No | The page's build takes only `./file.js` imports, so its modules stay in `app/src/` whatever happens. brimm-video would carry all of private brimm-operations: Sallie's laptop would need a second key (today the one secret is her read-only brimm-video key), each CI a token, and `git pull` alone would no longer update the code the launch agents run |
| A git-URL package | No | Neither repo has packages or an install step; `npm install` on a Mac is an install, with the same key and token problems |
| A sync script | Not now | It copies but notices nothing, and needs a brimm-operations checkout. The tests' failure messages print the hash and the first line to write, which is most of what it would save |

**In brimm-operations,** `app/tests/copied-by-brimm-video.test.js` (Task 5) lists what brimm-video copies, each with `sha256` and `copied`, the brimm-video commit whose copy has that hash, or `"not yet"`:

```js
const COPIED = [
  { file: "app/src/text.js", there: "tool/shared/text.js", sha256: "d5bfa663…", copied: "<commit>" },
  { file: "app/src/answers.js", there: "tool/shared/answers.js", sha256: "dbb9f014…", copied: "<commit>" },
  { file: "app/src/transcript.js", there: "tool/shared/transcript.js", sha256: "7abcc5d6…", copied: "<commit>" },
  { file: "app/src/instructions.js", lines: ["SHOW", "HOST"], there: "tool/shared/show.js", sha256: "7cd9890a…", copied: "<commit>" }
];
```

One test for each: the file's hash now equals `sha256`. For `instructions.js` it is the hash of its lines that begin `export const SHOW = ` and `export const HOST = `, each with its newline, in file order. A failure prints the new hash and says: set it here with `copied: "not yet"`, and ask Jason for a session in brimm-video to copy the file. An entry that says `"not yet"` is a `todo` test, so every run says a copy is behind, without failing CI, until its brimm-video commit is named.

**In brimm-video,** each file in `tool/shared/` begins:

```
// Copied from brimm-operations app/src/transcript.js at commit 84a2f61, sha256 7abcc5d6…. Kept in step: README, "Copies kept in step by hand".
// Copied from brimm-operations app/src/instructions.js (its SHOW and HOST lines) at commit 84a2f61, sha256 7cd9890a…. Kept in step: README, "Copies kept in step by hand".
```

and `tool/tests/shared.test.js` checks that every byte after line 1 hashes to the hash line 1 names, so a copy edited here fails. A copy and its source are in step when the two hashes are equal and brimm-operations' table names the brimm-video commit.

**The other way round,** for what brimm-video owns, `tool/tests/copied-by-brimm-operations.test.js` (Task 4) has the same shape for `fixtures/handoff-v1.json`, `handoff-v1-short-video.json`, `transcript-v1.srt` and `transcript-v1.transcript.txt`, with `copied` naming the brimm-operations commit. brimm-operations' copies keep naming brimm-video's commit in their test's comment, as `handoff.test.js` does today ("copied from brimm-video main at ab72782").

**Today's sha256:**

| File | Here (brimm-video) | There (brimm-operations) |
|---|---|---|
| `text.js` (copy after line 1; source) | `d5bfa6631b1c5aaf000b003f707ab6da335d2ef53f3e5180caa2c33effe88a5a` | the same |
| `answers.js` | `dbb9f0143e82e507d77d8b90047b8a054c759e07a2ce8de28214789083405abb` | the same |
| `transcript.js` | `7abcc5d6ee630a107a9ad7afe5449b06229ddcbeb3fd7c415c45698cebdb4f72` | the same |
| The `SHOW` and `HOST` lines | `7cd9890a0e33118403d2c915730d9f9a5224f4662dab50e9ed5494a6205320ed` | the same |
| `handoff-v1.json` | `4b455492c55673619658a84a9c0f537583976685d109731eadb84b80c97a818a` | `441e4420f6b6067c08352784b345a815f8a321a5af7944d62a1cb752cfad176a` (stale) |
| `handoff-v1-short-video.json` | `6b00b04c6905fa4aaea44b71fed15d3106baf22acd1a55342819e4ddace2b522` | `f793d5fac70c91f40f6d194d40d6f01b6845f36e69f76f209b92874c666233c8` (stale) |

None of #22 to #30 changes these files, so the values hold unless one of the repos changes them before Task 4.

## 4. Ordering against the open PRs

The review session rehearsed merging in the order 19 (merged since), 24, 25, 26, 27, 28, 22, 23, 29, 30. This plan needs nothing that any of them builds; what they share with it is text.

| PR | What it changes | With this plan |
|---|---|---|
| #22, plan for the 1b follow-ups (docs) | A new plan file | Independent |
| #23, plan for phase 4 (docs) | A new plan file; it plans nothing in `lib.js`, `run.js`, `dropbox.js` or `shared/` | Independent |
| #24, `open` refuses a held episode | `edit.js` (`open`, `bring`), `detached.js`; tests that give `bring` a `readAll` that resolves nothing or throws ENOSPC | Independent: neither PR #31 nor this plan changes `edit.js`, and `readThrough` still rejects, as those tests expect |
| #25, her guard's single quotes | `studio.js` | Independent |
| #26, the installer's check agent | `install.sh`, `unedited.js`, the README, the guide; a test that `install.sh --remove` leaves `com.thebrimm.transcribe.plist` alone | Merge first: Tasks 2 and 4 edit the README. Task 2 adds `install-transcribe.sh` and leaves `install.sh` alone (ruling 6) |
| #27, resolve and release | `edit.js`, `episode.js` | Independent |
| #28, as-built documents | The README, the requirements, the guide, plan 1b, the spec | Merge first: Tasks 2, 4 and 9 edit the README, the requirements and the spec's phase T row |
| #29, phase 4's pure modules | New modules; `final-transcript.js`, `fcpxml.js` | Independent: this plan leaves `final-transcript.js` alone (ruling 11), and `lib.js` keeps the `stampedText` it imports |
| #30, phase 4's commands (based on `claude/phase-3-reels-part-2`; retarget to `main` first) | `edit.js`, `unedited.js`, the README and more; imports `captionsOf` and `stampedText` from `lib.js` | Conflicts with Tasks 2 and 4 on the README. Whichever lands second merges `main` in and resolves; `lib.js` keeps both exports |

PR #31's order against these is for its own session to settle (it changes the README and `unedited.test.js`, as #26 and #30 do). Phase T's Tasks 2 to 9 start once #31 has merged.

## Review Focus

1. A placeholder met by the import or by `bring`, from a launch agent or a detached run: python3 reads it through with downloads on and the work goes on, and one that stalls is given up after 2 minutes, in plain words. (PR #31's tests; Task 1 confirms what merged.)
2. A run killed in the middle of a video at the switch: nothing is moved before its transcript is whole, and the next run takes over the lock of the gone process and does the video again. (The moved test "takes over at once from a run that is no longer there, and from one that has held the folder for half a day", and Task 6's check that nothing is running first.)
3. One folder watched by two agents: on one Mac, each installer refuses the other's folders; across Macs, each keeps its own list. (The moved installer tests; Task 6, step 7.)
4. A change in brimm-operations to a page module that brimm-video copies, made with no word to brimm-video: brimm-operations' test fails at once, and while its table says "not yet" every run shows a todo. (Tasks 4 and 5, each seen failing first.)
5. Going back during the week: the old installer writes back the old plist, and the folders need nothing. (Task 6: the printed plists compared with the kept copy; the moved tests that check the agent's arguments.)

## Files

| File | Task | What |
|---|---|---|
| `tool/dropbox.js` and its tests | 1 | Changed by PR #31, not by this plan |
| `tool/run.js` | 2 | Its header no longer says it is a copy |
| `tool/transcribe.js`, `tool/install-transcribe.sh` | 2 | The tool and its installer, moved |
| `tool/lib.js` | 2 | The transcript tool's rules join |
| `tool/shared/*.js` | 4 | Line 1 names the commit and the hash |
| `tool/tests/transcribe.test.js`, `install-transcribe.test.js` | 2, 3, 4 | Moved; two new tests; duplicates out; the `.srt` fixture's test |
| `tool/tests/transcribe-lib.test.js` | 2, 3 | Moved, then folded into `lib.test.js` |
| `tool/tests/shared.test.js`, `copied-by-brimm-operations.test.js` | 4 | The guard, this side |
| `tool/tests/fixtures/transcript-v1.srt`, `transcript-v1.transcript.txt` | 4 | The `.srt` contract |
| `README.md`, `CLAUDE.md`, `docs/requirements.md`, the spec | 2, 4, 9 | As each task says |
| brimm-operations: `app/tests/copied-by-brimm-video.test.js`, `app/tests/handoff/`, `app/tests/handoff.test.js`, `CLAUDE.md` | 5 | The guard, that side, and the fixtures copied again |
| brimm-operations: `transcribe/`, the workflow, `README.md`, `CLAUDE.md`, `docs/requirements.md` | 8 | The removal |

---

### Task 0: Before starting

- [ ] **Step 1:** The review is finished: read its note in the shared notes folder, and `gh pr list --repo jogden12/brimm-video --state all --limit 12`. Write down which of #22 to #30 merged, and `main`'s head.
- [ ] **Step 2:** Jason has answered Open question 1.
- [ ] **Step 3:** `transcribe/` has not changed since PR 29: `gh api "repos/jogden12/brimm-operations/commits?path=transcribe&per_page=1" --jq '.[0].sha[0:7]'` prints `3a5eeff`. If it prints another, its changes are carried into Tasks 1 and 2 the same way.
- [ ] **Step 4:** Baselines. brimm-video, in a worktree: `cd tool && node --test`, all pass; write the count down as N0. brimm-operations, in a worktree there or a `git archive` copy of `transcribe` and `app/src`: `cd app && node --test` (953 at `ced8fe5`) and `cd transcribe && node --test` (207).

### Task 1: The placeholder fix lands (PR #31; phase T waits for it)

brimm-video's fix for the placeholder bug is PR #31 (https://github.com/jogden12/brimm-video/pull/31), "Read a Dropbox placeholder through with python3, which turns downloads on for itself", built by the session "Dropbox placeholder fix for brimm-video's readThrough" on the branch `claude/busy-chebyshev-4d1df6` (worktree `.claude/worktrees/busy-chebyshev-4d1df6`). Phase T builds none of it, and never works in that worktree or on that branch. This PR's first commit (`2d5f0c6`) had a full Task 1 for building the fix another way; it stays in this PR's history only to compare with.

- [ ] **Step 1: Wait until Jason has merged PR #31:** `gh pr view 31 --repo jogden12/brimm-video --json state,mergeCommit`. Pulling it onto each Mac is that PR's own step, not this plan's.
- [ ] **Step 2: Check that what merged is what Tasks 2 and 3 assume,** as PR #31 stood at 16:45 UTC on 2026-10-20:
  - `readThrough(path, { spawn, quietMs })` in `dropbox.js` resolves once python3 has read the file through. It rejects with python3's last line on standard error ("Resource deadlock avoided"), with the spawn error's message ("spawn /usr/bin/python3 ENOENT"), or, once `READ_QUIET_MS` (2 minutes) passes with nothing read, with "Dropbox sent nothing of it for 2 minutes, so it was given up";
  - `run.js` has no `quiet`, and `unedited.js` and `edit.js` call `readThrough` as before;
  - its tests in `dropbox.test.js` cover python3 with `-I` and the file as an argument of its own, a read that keeps coming, a stall, python3's reason, python3 missing, and the Mac's own python3 on a real file.

  If it merged in another shape, Task 2 fits its adapter (ruling 5) and the moved tests' imports to what merged, and the transcript tool still does what it does today: a file that does not come down gets its note, with the reason.
- [ ] **Step 3: Baseline.** In a worktree on `main` with PR #31: `cd tool && node --test`, all pass; write the count down as N1.

### Task 2 (brimm-video): The transcript tool moves in, unchanged

**Files:** Create `tool/transcribe.js`, `tool/install-transcribe.sh`, `tool/tests/transcribe.test.js`, `tool/tests/transcribe-lib.test.js`, `tool/tests/install-transcribe.test.js`. Modify `tool/lib.js`, `tool/run.js` (header), `README.md`, `CLAUDE.md`, `docs/requirements.md`.

**Interfaces:**
- Consumes: `readThrough` and `isWhole` (`dropbox.js`), as Task 1 step 2 found them; `localDay` (`shared/text.js`); `tidyTranscript` (`shared/transcript.js`, through `stampedText`).
- Produces: `tool/transcribe.js` exports `transcribeFile`, `transcribeFolder`, `transcribeFolders`, `parseArgs` and `main(argv, { find = findTools, log } = {})`, where `log` defaults to the stamped line on standard output it writes today; the two parameters are new, so a test can give it missing programs and read what it says. `tool/lib.js` exports ruling 3's names as well as its own.

- [ ] **Step 1: Copy the tests,** reading brimm-operations only: `git -C ~/"Claude Code/BRIMM operations" show ced8fe5:transcribe/tests/transcribe.test.js > tool/tests/transcribe.test.js`, and the same for `lib.test.js` (as `transcribe-lib.test.js`) and `install.test.js` (as `install-transcribe.test.js`). Change only:
  - each file's first line, `// Moved from brimm-operations transcribe/tests/<name> at commit ced8fe5 on <date>.`, with the old first lines after it;
  - `transcribe.test.js`'s import: `{ transcribeFile, transcribeFolder, transcribeFolders, parseArgs, main }` from `../transcribe.js` (`main` for step 2's test), `{ findTools, lockFile, runProgram, isRunning }` from `../run.js`, `{ isWhole }` from `../dropbox.js`; and leave out the describe "asking Dropbox for a file" and the two tests of `quiet` in "running a program": five tests of code that is not carried (ruling 5), whose ground PR #31's tests of `readThrough` cover;
  - `transcribe-lib.test.js`: `../../app/src/transcript.js` becomes `../shared/transcript.js`;
  - `install-transcribe.test.js`: `../install.sh` becomes `../install-transcribe.sh`, and the three texts that say where unedited video is set up read as step 4 words them.
- [ ] **Step 2: Add two tests** to `transcribe.test.js`. The first passes at once: it pins what the tool already does, as phase T's row asks.

```js
// in "a folder"
it("leaves a folder inside the watched one alone when it is not named for a day, as BRIMM Video would be", async () => {
  // the watched folder holds "BRIMM Video/Unedited Video/Mac Studio/talk.mp4" and an empty "2026-10-13"
  assert.deepEqual(results, []);
  assert.deepEqual(readdirSync(join(t.dir, "BRIMM Video/Unedited Video/Mac Studio")), ["talk.mp4"]);
  assert.ok(!t.calls.some((c) => c.args.some((a) => String(a).includes("BRIMM Video"))));
});
// in "before it starts"
it("says how to set the Mac up when a program is missing", async () => {
  const lines = [];
  assert.equal(await main(["--watch", "/in"], { find: () => ({ missing: ["ffmpeg is not installed."] }), log: (l) => lines.push(l) }), 2);
  assert.deepEqual(lines, ["ffmpeg is not installed.", "Run tool/install-transcribe.sh to set this Mac up."]);
});
```

- [ ] **Step 3: Run them to see them fail:** `cd tool && node --test tests/transcribe.test.js tests/transcribe-lib.test.js tests/install-transcribe.test.js`. Expected: they fail to load (no `../transcribe.js`, no `../install-transcribe.sh`, and `lib.js` has no `zoomCall`).
- [ ] **Step 4: Move the code.**
  - `tool/transcribe.js` from `ced8fe5:transcribe/transcribe.js`: ruling 4's imports; the definitions now in `run.js` and `dropbox.js` deleted, with `MODEL_NAME`, `STALE_LOCK_MS`, `SF_DATALESS`, `fileFlags`, `READ_QUIET_MS` and the python script; `bringDown` replaced by ruling 5's adapter, which `transcribeFile` takes when `deps.bringDown` is not given; the header says where it came from ("Moved from brimm-operations transcribe/transcribe.js at commit ced8fe5 on <date>. Its history before that is there.") and that `install-transcribe.sh` sets it up; `main`'s line "Run tool/install-transcribe.sh to set this Mac up."; `main`'s two new parameters. Keep the `#!/usr/bin/env node` line, and mode 755.
  - `tool/lib.js`: ruling 3's rules added, word for word with their comments. Its header says it holds the rules of both tools; the "Copied in part" line goes.
  - `tool/run.js`: the "Copied in part" line goes. "The lock is the one both tools take, so the two never work on one folder at the same time."
  - `tool/install-transcribe.sh` from `ced8fe5:transcribe/install.sh`, mode 755. Its usage lines name `./install-transcribe.sh`. "Unedited video is set up with install.sh, beside this one." in the header; in the message for `--unedited` and `--rules-only`, "Unedited video is set up with install.sh, beside this one. This sets up the transcript tool only."; at the end of the refusal, "The launch agent for unedited video is set up with install.sh, beside this one." `HERE` is the same code, so the plist names `tool/transcribe.js`. The label, log, model, default folder and the refusal itself do not change.
- [ ] **Step 5: Run the three files, then the whole suite.** Expected: the three pass; `cd tool && node --test` all pass, 0 fail, N1 + 204 (202 moved, 2 new). Write N1 + 204 in the commit, and name the five tests left behind.
- [ ] **Step 6: Documents.**
  - README: "What is where" gains `tool/transcribe.js` and `tool/install-transcribe.sh`. A section "The transcript tool", made from brimm-operations' README section of that name, with this repo's paths (`cd tool && ./install-transcribe.sh --print "<folder>"`; its tests are among `cd tool && node --test`; the Mac runs it straight from this folder, so it stays on `main`). In "Copies kept in step by hand", `lib.js` and `run.js` are this repo's own now, and the sentence on `ffmpegArgs` becomes a known difference in the new section: the transcript tool does not map a sound stream yet. "Where this came from" gains the move.
  - CLAUDE.md: "Today it holds one tool" becomes two: the unedited-video tool and the transcript tool (`tool/transcribe.js`, moved from brimm-operations on <date>). The command block gains `cd tool && ./install-transcribe.sh --print "<folder>"`. The rule on the launch agent names both agents. "Experiments never write into a watched Dropbox folder: a new file there starts a tool." The line on copies names `tool/shared/` only.
  - `docs/requirements.md`: a dated line under "Changes", naming brimm-operations' workflow 5 note (2026-10-13) as where the transcript tool came from.
- [ ] **Step 7: Commit and open the PR.** `git commit -m "The transcript tool moves in from brimm-operations, unchanged (phase T): transcribe.js, its installer and its tests"`. Nothing changes in brimm-operations: its 207 and 953 still pass there.

### Task 3 (brimm-video): One copy of each test

**Files:** Modify `tool/tests/transcribe.test.js`, `tool/tests/lib.test.js`. Delete `tool/tests/transcribe-lib.test.js`.

- [ ] **Step 1: List the duplicates.** A moved test is a duplicate when a test of the same function elsewhere has the same name and either the same body or a body that holds every assert of the moved one. Expected, as counted on 2026-10-20, to be confirmed pair by pair with `diff`:
  - `transcribe-lib.test.js` against `lib.test.js`: 20 the same, and "has ffmpeg take the sound out as the kind of file the transcriber reads, never asking a question", which brimm-video's holds with its three asserts for a sound stream;
  - `transcribe.test.js` against `run.test.js`: 17 the same (the three of `findTools` and fourteen of "running a program").

  That is 38. The installers' tests are not compared: they test two different scripts. The two sets of `isWhole` tests have different names, and both stay.
- [ ] **Step 2:** Write down the names doubled before: `grep -ho 'it("[^"]*"' tool/tests/*.js | sort | uniq -d`.
- [ ] **Step 3:** Remove the duplicates. Move what is left of `transcribe-lib.test.js` (the Zoom rules, `waiting`, `isDayName`) into `lib.test.js`, in its own describe blocks, and delete `transcribe-lib.test.js`.
- [ ] **Step 4:** The same `grep`: none of the listed names is doubled any more, and each is still there once. `cd tool && node --test`: all pass, 0 fail, the count down by exactly the number listed (expected N1 + 166).
- [ ] **Step 5: Commit,** with the list in its body: `git commit -m "One copy of each test of the shared code: 38 moved tests brimm-video already had"`.

### Task 4 (brimm-video): The guard on this side, and the `.srt` contract

**Files:** Modify `tool/shared/text.js`, `answers.js`, `transcript.js` and `show.js` (line 1 only), `tool/tests/transcribe.test.js`, `README.md`, `CLAUDE.md`. Create `tool/tests/shared.test.js`, `tool/tests/copied-by-brimm-operations.test.js`, `tool/tests/fixtures/transcript-v1.srt`, `tool/tests/fixtures/transcript-v1.transcript.txt`.

**Interfaces:**
- Produces: a copy's line 1, `// Copied from brimm-operations <path>[ (its SHOW and HOST lines)] at commit <7 to 40 hex>, sha256 <64 hex>. Kept in step: README, "Copies kept in step by hand".`; the hash rule (every byte after line 1's newline here; on the other side, the whole file, or the matched lines each with its newline); the table `{ file, there, sha256, copied }`.

- [ ] **Step 1: Write the failing tests.**

```js
// shared.test.js: one test for each of text.js, answers.js, transcript.js and show.js
it(`${name} names the commit and the hash it was copied at, and is still that copy`, () => {
  const text = readFileSync(file, "utf8");
  const first = text.slice(0, text.indexOf("\n") + 1);
  const m = /^\/\/ Copied from brimm-operations (app\/src\/\S+\.js)(?: \(its SHOW and HOST lines\))? at commit ([0-9a-f]{7,40}), sha256 ([0-9a-f]{64})\. /.exec(first);
  assert.ok(m, first);
  const now = sha256(text.slice(first.length));
  assert.equal(now, m[3], `${name} was changed here, or line 1 is out of date: the rest of the file has sha256 ${now}`);
});
// copied-by-brimm-operations.test.js
const COPIED = [
  { file: "fixtures/handoff-v1.json", there: "app/tests/handoff/handoff-v1.json", sha256: "4b455492…", copied: "not yet" },
  { file: "fixtures/handoff-v1-short-video.json", there: "app/tests/handoff/handoff-v1-short-video.json", sha256: "6b00b04c…", copied: "not yet" },
  { file: "fixtures/transcript-v1.srt", there: "app/tests/handoff/transcript-v1.srt", sha256: "<its hash>", copied: "not yet" },
  { file: "fixtures/transcript-v1.transcript.txt", there: "app/tests/handoff/transcript-v1.transcript.txt", sha256: "<its hash>", copied: "not yet" }
];
for (const c of COPIED) {
  it(`${c.file} is as brimm-operations last copied it`, { todo: c.copied === "not yet" && `brimm-operations has not copied ${c.file} yet` }, () => {
    // on a mismatch: `${c.file} changed: set sha256 "${now}" and copied "not yet" here, and ask Jason for a session in brimm-operations to copy it to ${c.there}`
  });
}
// transcribe.test.js, in "one video"
it("writes the transcript fixtures, the files brimm-operations reads as the tool's", async () => {
  // the stand-in transcriber writes three captions: a "Thank you." that the stand-in ffmpeg hears as silence, and two with words, one of them "Sally"
  assert.equal(readFileSync(r.srt, "utf8"), fixture("transcript-v1.srt"));
  assert.equal(readFileSync(r.txt, "utf8"), fixture("transcript-v1.transcript.txt"));
  assert.equal(stampedText(fixture("transcript-v1.srt")), fixture("transcript-v1.transcript.txt"));
});
```

- [ ] **Step 2: Run them to see them fail.** Expected: each line 1 is in the old form, and the fixtures are not there.
- [ ] **Step 3:** Write the fixtures from what the test's run writes, checked by eye (the captions numbered again, "Sallie", no "Thank you."); each copy's line 1, with section 3's hashes, which equal brimm-operations `main`'s; the table's hashes.
- [ ] **Step 4: Run the whole suite.** Expected: all pass, 0 fail, and `todo 4` until Task 5's commit is named.
- [ ] **Step 5: Documents.** The README's "Copies kept in step by hand" says what BRIMM Ops owns and brimm-video copies (the four), and what brimm-video owns and brimm-operations copies (the four fixtures); the hash rule; what each repo's test does; how a copy is taken (`git -C ~/"Claude Code/BRIMM operations" show <commit>:app/src/transcript.js`, then `shasum -a 256`); and that a session in one repo never changes the other, so Jason is asked for a session there. CLAUDE.md's line on copies says the same in one sentence.
- [ ] **Step 6: Commit and open the PR.**

### Task 5 (a session opened in brimm-operations): Session A, its side of the guard

After Task 4 merges, and best before Task 6, because it also freezes `transcribe/`. Steps for that session:

- [ ] **Step 1:** Read section 3 and rulings 9 and 10 of this plan, and brimm-video's README section "Copies kept in step by hand", from brimm-video `main`, reading only.
- [ ] **Step 2: The fixtures.** Copy brimm-video `main`'s `tool/tests/fixtures/handoff-v1.json`, `handoff-v1-short-video.json`, `transcript-v1.srt` and `transcript-v1.transcript.txt` into `app/tests/handoff/`. The comment in `handoff.test.js` names the commit: "copied from brimm-video main at <commit> (tool/tests/fixtures/)", and says the folder holds brimm-video's contract fixtures: the hand-off's and the transcript tool's. A test beside them: "reads the transcript tool's .srt as the tool's own text says it": `tidyTranscript(srt) + "\n"` equals the `.txt`. `cd app && node --test`: the hand-off tests still pass with the `.mov` names.
- [ ] **Step 3: The guard.** `app/tests/copied-by-brimm-video.test.js` as section 3 shows it, with today's hashes, and `copied` naming brimm-video's Task 4 commit. See it fail first: change one character of one hash, run it, read the message, and put the character back.
- [ ] **Step 4: CLAUDE.md,** "The transcript tool": "brimm-video copies `app/src/text.js`, `answers.js`, `transcript.js` and the `SHOW` and `HOST` lines of `instructions.js`. When one of them changes, `app/tests/copied-by-brimm-video.test.js` fails: set its new hash with `copied: "not yet"`, and ask Jason for a session in brimm-video to copy it." And: "`transcribe/` moved to brimm-video on <date> (`tool/transcribe.js`). It stays here unchanged, only as the way back, until it is removed. A fix to the transcript tool goes to brimm-video."
- [ ] **Step 5: Tests.** `cd app && node --test` (953 and the new ones, 0 fail), `node build.js` (writes `dist/index.html`), `cd transcribe && node --test` (207). Open the PR; its CI runs, because `app/` changed. Jason merges.
- [ ] **Step 6 (back in brimm-video, one line each):** `copied-by-brimm-operations.test.js` names that brimm-operations commit for the four fixtures, and the todos go.

### Task 6 (Jason, one Mac at a time): The switch

Needs Tasks 1 and 2 merged into brimm-video `main`. The Mac Studio first; the MacBook once at least one real video has gone through on the Mac Studio. Sallie's laptop: nothing (ruling 12). Jason's yes in chat for each Mac, after its step 4.

| | Mac Studio | Jason's MacBook |
|---|---|---|
| Folders, in this order | `<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer`, then `<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer`; `<Dropbox>` is `~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden` | `<Dropbox>/The BRIMM DB/BRIMM VIDEO MacBook`, exactly as its plist has it (step 1) |
| Runs now | `~/Claude Code/BRIMM operations/transcribe/transcribe.js` | `transcribe/transcribe.js` in its brimm-operations checkout (step 1) |
| Will run | `~/Claude Code/BRIMM video/tool/transcribe.js`: the checkout that runs `com.thebrimm.unedited`, on `main` | `tool/transcribe.js` in a brimm-video checkout on `main`, worked on only through worktrees from then on. With none there, `git clone https://github.com/jogden12/brimm-video.git ~/"Claude Code/BRIMM video"` under Jason's own GitHub sign-in (no deploy key) |
| The other agent | `com.thebrimm.unedited` on `<Dropbox>/The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio`, which is neither folder | None expected (step 7 checks) |
| The real check | The next real Zoom download in `Zoom Video Transfer`, and the next YouTube video in `BRIMM VIDEO Transfer` | The next real video in `BRIMM VIDEO MacBook` |

- [ ] **Step 1: What it runs now, kept.** `plutil -p ~/Library/LaunchAgents/com.thebrimm.transcribe.plist`, and write its folders down in order. Keep a copy outside `LaunchAgents`, where launchd never loads it: `cp ~/Library/LaunchAgents/com.thebrimm.transcribe.plist ~/"Library/Application Support/BRIMM Transcribe/com.thebrimm.transcribe.plist.before-move"`.
- [ ] **Step 2: Nothing in the middle of a video.** Ask Sallie not to drop anything for the few minutes of the switch. All of these hold, or wait and look again:
  - `launchctl list | grep com.thebrimm`: the first column is `-` for `com.thebrimm.transcribe`, and on the Mac Studio for `com.thebrimm.unedited` too, before step 3's pull (it can wait up to 15 minutes for an import's late check);
  - `pgrep -fl transcribe.js` prints nothing;
  - `tail -n 6 ~/Library/Logs/brimm-transcribe.log` ends with "Looked in the folder: nothing is waiting." for each folder;
  - nothing waits in a watched folder (this reads the old copy's own rules, and changes nothing):

```bash
node --input-type=module -e 'const { waiting, zoomCalls } = await import(process.argv[1]); const { readdirSync } = await import("node:fs"); for (const d of process.argv.slice(2)) { const n = readdirSync(d); console.log(d, waiting(n), zoomCalls(n).map((c) => c.call)); }' "<the brimm-operations checkout>/transcribe/lib.js" "<folder 1>" "<folder 2>"
```

  Expected: `[] []` after each folder.
- [ ] **Step 3: The code.** `git -C ~/"Claude Code/BRIMM video" pull` (it stays on `main`), then `cd ~/"Claude Code/BRIMM video/tool" && node --test`: all pass.
- [ ] **Step 4: Printed first.** `./install-transcribe.sh --print "<folder 1>" "<folder 2>"` (the MacBook has one folder), with the folders exactly as step 1 wrote them down. Read: the label `com.thebrimm.transcribe`; the program `…/BRIMM video/tool/transcribe.js`; the same folders, in the same order, after `--watch` and in WatchPaths; the log `~/Library/Logs/brimm-transcribe.log`; the model "here already"; the programs "none, they are all here". The printed plist differs from the kept copy only in the path to `transcribe.js`.
- [ ] **Step 5: Jason's yes, then the switch:** `./install-transcribe.sh --yes "<folder 1>" "<folder 2>"`. It stops the old agent and starts the new one under the same label, and the new one looks at its folders once, straight away.
- [ ] **Step 6: Check.** `plutil -extract ProgramArguments json -o - ~/Library/LaunchAgents/com.thebrimm.transcribe.plist` names brimm-video's `transcribe.js`; the log's newest lines are the new run's "Folder: …" and "Looked in the folder: …"; `launchctl print gui/$(id -u)/com.thebrimm.transcribe | grep "last exit code"` says 0. If the log says a folder could not be read, allow node in System Settings, Privacy & Security, Files and Folders (it is the same node, so it should not ask).
- [ ] **Step 7: No folder watched twice.** `for l in com.thebrimm.transcribe com.thebrimm.unedited; do plutil -extract WatchPaths json -o - ~/Library/LaunchAgents/$l.plist 2>/dev/null; echo; done`: no folder is in both lists, and no unedited folder is inside a transcript folder (each installer refuses both on its own Mac). Across Macs, by hand: the Mac Studio's list and the MacBook's share no folder, and neither names a folder inside `BRIMM Video/`.
- [ ] **Step 8: Real use.** The real check in the table: the transcript is in a new dated folder, and its `.srt`, given to the page with "Choose a file", reads as before.

**Going back during the week,** while brimm-operations still has `transcribe/`:
1. Step 2's checks.
2. `cd "<the brimm-operations checkout>/transcribe" && ./install.sh --print "<folder 1>" "<folder 2>"`: the printed plist is the kept copy.
3. Jason's yes, then `./install.sh --yes "<folder 1>" "<folder 2>"`. The folders need nothing: both copies use the same dated folders, notes, lock and log.
4. The fault is fixed in brimm-video, and the switch is made again from step 1.

After Task 8 there is no old copy: the way back is `git revert` of the faulty commit on brimm-video `main`, then `git pull` on each Mac. The agent does not change.

### Task 7: A week of real use

- [ ] Each day, on each Mac: any new "failed." line in the log is one the old tool would have written too; every video that landed was filed; no `.failed.txt` is left unexplained.
- [ ] The week counts from the MacBook's switch (Open question 5).
- [ ] At its end, Jason's yes for Task 8.

### Task 8 (a session opened in brimm-operations): Session B, `transcribe/` removed

- [ ] **Step 1: Check** that both Macs run brimm-video's copy (Task 6 step 6's `plutil` line on each; Jason reads the MacBook's), and that nothing outside `transcribe/` uses it: `git grep -n "transcribe/" -- app seed` prints nothing.
- [ ] **Step 2:** `git rm -r transcribe`.
- [ ] **Step 3: CI.** In `.github/workflows/app-tests.yml`, remove `"transcribe/**"` from `push.paths` and from `pull_request.paths`, and the step "Run the transcript tool's tests".
- [ ] **Step 4: Documents,** as section 1's second table says: the README ("What is where"; "The transcript tool" becomes "Transcripts from brimm-video"; "Video editing"; "Setting up on another Mac"), CLAUDE.md ("The transcript tool" becomes "brimm-video", keeping the rule on copies), and `docs/requirements.md` (line 302, and "Changes"). History stays as it is.
- [ ] **Step 5: Tests.** `cd app && node --test` (all pass, the guard among them) and `node build.js`. Open the PR; its CI runs, because the workflow changed, and passes with no transcript step.
- [ ] **Step 6:** Once Jason merges: `git -C "<the brimm-operations checkout>" pull` on each Mac. No agent runs from it now. The session brings its own memory notes on the transcript tool up to date.

### Task 9 (brimm-video): After the removal

- [ ] README and CLAUDE.md: brimm-operations' `transcribe/` is gone (<date>), and the way back is a revert here.
- [ ] The spec's phase T row, as built: its pull requests, moved unchanged, and what waits (ruling 2).
- [ ] The kept `.before-move` plists on each Mac may go, on Jason's word.
- [ ] `cd tool && node --test`: all pass. Commit and open the PR.

## 5. Tests at each step

| After | brimm-video, `cd tool && node --test` | brimm-operations, `cd app && node --test` | brimm-operations, `cd transcribe && node --test` |
|---|---|---|---|
| Task 0 | N0, all pass | 953 | 207 |
| Task 1 (PR #31 merged) | N1, all pass | 953 | 207 |
| Task 2 | N1 + 204 (202 moved, 2 new), all pass | 953 | 207 |
| Task 3 | N1 + 166 (38 duplicates out), all pass | 953 | 207 |
| Task 4 | Plus the guard's and the fixture's tests, all pass, `todo 4` | 953 | 207 |
| Task 5 | The todos go | 953, plus the guard's and the fixtures' tests | 207 |
| Task 6 | All pass in each Mac's checkout, before its switch | — | — |
| Task 8 | — | All pass | Gone, with its CI step |
| Task 9 | All pass | — | — |

Every brimm-video count is taken in a checkout: in a `git archive` copy one test, "is the short commit the checkout is at", fails by design. Counts after #24 to #30 merge differ from today's; what must hold is all pass, 0 fail, and the differences above.

## Open questions for Jason

1. **Your MacBook:** does it have a brimm-video checkout (where, and on `main`?), and does it run `com.thebrimm.unedited`? If there is no checkout, Task 6 clones one there.
2. **Phase T in the spec also puts the transcript tool under the Dropbox rule and has it write the progress file.** This plan moves it unchanged and leaves both for after the week, each with its own yes. Is that the order you want?
3. **Sallie's laptop** does not run the transcript tool, so her YouTube and Zoom transcripts still come from your Macs. Leave it so for now (recommended), or add it after the week?
4. **Two fixes the move does not make:** iPhone videos (the import takes the first sound ffmpeg can read, beside Apple's APAC; the transcript tool does not), and PR 29's open point (a Zoom call's length is asked of a file that may still be a placeholder). After the week, each as its own task?
5. **The week of real use:** from the MacBook's switch, the later one (recommended), or from the Mac Studio's?
6. **The two brimm-operations sessions:** session A right after Task 4 merges, and session B after the week (recommended). Who opens them?
