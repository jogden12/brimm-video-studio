# Phase T: the transcript tool moves into brimm-video, and each shared file gets one owner. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** brimm-operations' transcript tool runs from brimm-video on the Mac Studio, with Jason's MacBook as a standby, doing what it does today; the fix for Dropbox placeholders exists once, in brimm-video; and every file the two repos share has one owner, with the spec's contract fixtures keeping the page and the tools agreeing. BRIMM Ops is then the page only.

**Architecture:** The placeholder fix is in (PR #31; Task 1 is done). The tool then moves as it is (Task 2): `tool/transcribe.js` beside `unedited.js`, sharing one `lib.js`, `run.js` and `dropbox.js`, with its own installer, under the same launch agent label, folders, log, model and lock, so each Mac switches in either direction with one installer run. 202 of its 207 tests move with it, and lose their duplicates afterwards (Task 3). As the spec says, what keeps the two repos in step is the contract: the two hand-off fixtures and a new `.srt` pair, which brimm-video owns and pins and brimm-operations copies and reads; `tool/shared/` becomes brimm-video's own (Tasks 4 and 5). Each Mac is switched by hand with Jason (Task 6), and after a week of real use a session in brimm-operations removes `transcribe/` (Task 8). Then come the gaps the move leaves, each with its own yes: the Dropbox rule and the progress file (Task 10), an iPhone video's sound (Task 11), and a Zoom call's length asked of a placeholder (Task 12).

**Tech Stack:** Node 22 or later (ESM, `node:test`, `node:crypto`), zsh installers, launchd, and `/usr/bin/python3 -I` through `readThrough`. No packages, as now.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`: phase T's row in the phases table (line 460), "What this rests on" (line 35, where the tool runs, and line 36, the three changes asked of brimm-operations), section 5's hand-off, and section 6 (keeping the Macs the same). Where this plan departs from phase T's row, ruling 2 says so.

**When:** written on 2026-10-20, and revised on 2026-10-21 after a review, with Jason's decisions (the last section), against brimm-video `main` at `0700809` and brimm-operations `main` at `ced8fe5`. The tasks run in the order 2 to 10, then 11 and 12. Nothing here is built, merged, pushed or installed, and no launch agent is touched, without Jason's yes in chat.

## Global Constraints

- The tools draft. Nothing here posts, sends or publishes.
- Never read a `.env` file. No secret is added: no token in either repo's CI, no second key on Sallie's laptop.
- Nothing is installed on a Mac, and no launch agent is added, changed, turned on or turned off, without Jason's yes in chat. Installers run with `--print` in tests and by hand; without it only in Task 6 and the README's "When away", after the yes.
- Write a failing test first, then the code. Before each commit, run the whole suite in a checkout (a worktree, not a `git archive` copy: one brimm-video test reads the checkout's commit): `cd tool && node --test`, all pass, 0 fail.
- No test runs the real ffmpeg, transcriber, `claude`, `launchctl` or Final Cut, and no test writes into Dropbox. A session that runs real ffmpeg gives it a memory and time watchdog on a detached process group.
- The main checkout `~/Claude Code/BRIMM video` runs both launch agents and stays on `main`. A session never edits, commits or switches branches there; it is only pulled, on `main`, on Jason's yes, with nothing at work (ruling 14). Work is done in worktrees, and scratch copies of a tree are made with `git archive`.
- A brimm-video session reads brimm-operations and never changes it; work there is done in a session opened there, on Jason's say-so. Task 2 writes this into brimm-video's CLAUDE.md, and brimm-operations' CLAUDE.md already says the same of brimm-video. Tasks 5 and 8 are such sessions.
- Never rebase or force-push a PR branch; merge `main` into it.
- Match the code around it: comments in full plain sentences, messages a person reads in plain words, exit codes 0, 1 and 2 as now.

## What was checked on 2026-10-21

- **brimm-video `main` is `0700809`.** Every PR from #22 to #31, and #33, is merged; #32 is this plan, and no other PR is open. The whole suite passes in a checkout: 1685 tests (N1).
- **The placeholder fix is in:** PR #31 merged on 2026-10-20 as `e04f9be`, in the shape Task 2 assumes (Task 1).
- **brimm-operations `main` is `ced8fe5`,** and `transcribe/` last changed at PR 29 (`3a5eeff`). Its tests, run in a `git archive` copy on 2026-10-20: 207 pass (129 in `transcribe.test.js`, 66 in `lib.test.js`, 12 in `install.test.js`). The page's: 953 (PR 29's count).
- **The Mac Studio's agents,** from their plists: `com.thebrimm.transcribe` runs `/opt/homebrew/bin/node "~/Claude Code/BRIMM operations/transcribe/transcribe.js" --watch "<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer" --watch "<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer"`, with the same two folders as WatchPaths, RunAtLoad, and the log `~/Library/Logs/brimm-transcribe.log`; `<Dropbox>` is `~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden`. `com.thebrimm.unedited` runs `~/Claude Code/BRIMM video/tool/unedited.js` on `<Dropbox>/The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio` only.
- **The page's modules and brimm-video's copies are the same.** `tool/shared/text.js`, `answers.js` and `transcript.js` are brimm-operations' `app/src/` files byte for byte after their first line, and `show.js` holds `instructions.js`'s two lines as they are. `tool/lib.js`, `tool/run.js` and `tool/dropbox.js` are `transcribe/`'s code but as section 2 says.
- **The hand-off fixtures are not.** brimm-video #16 named the finished videos `.mov` on 2026-10-14, after brimm-operations had copied the fixtures at `ab72782`; its copies still say `.mp4`. The page reads `file` as text, so nothing broke, and no test noticed.
- **Sallie's laptop does not run the transcript tool.** Its guide (`docs/setup/sallies-laptop.md`) clones brimm-video only and installs `com.thebrimm.unedited` only.
- **Jason's MacBook** runs `com.thebrimm.transcribe` from a brimm-operations checkout on `The BRIMM DB/BRIMM VIDEO MacBook` since 2026-10-15 (from the brief, not checked from here). Jason keeps it "only for when traveling or the mac studio is down" (ruling 13).
- **CI.** brimm-video's runs `node --test` in `tool/` on every push and pull request. brimm-operations' runs only for changes to `app/**`, `transcribe/**`, `seed/**`, the brief and the workflow, with the transcript tool's tests as a step of their own.

## 1. Inventory, and the owner of each file afterwards

### brimm-operations' `transcribe/` (at `ced8fe5`)

| File | What it is | Afterwards |
|---|---|---|
| `transcribe.js` (723 lines) | The tool: arrival, bringing a placeholder down, transcription, filing, Zoom calls, the lock, the command line | brimm-video's `tool/transcribe.js` (Task 2). Its `runProgram`, `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning` and `takeLock` are `tool/run.js`'s; its `isWhole` is `tool/dropbox.js`'s; its `bringDown` becomes a wrapper of `dropbox.js`'s `readThrough` (ruling 5) |
| `lib.js` (271) | Its rules | One `tool/lib.js` (Task 2): the shared rules are there already, and the Zoom rules, `waiting` and `isDayName` join them |
| `install.sh` (216) | The installer of `com.thebrimm.transcribe` | `tool/install-transcribe.sh` (Task 2), which also refuses a folder inside `BRIMM Video/` or one that holds it (ruling 6) |
| `package.json` | Its name, ESM, Node 22 or later | Not carried: `tool/package.json` says the same |
| `tests/transcribe.test.js` (129 tests) | The tool end to end, with stand-ins | `tool/tests/transcribe.test.js` (Task 2), but for the five tests of PR 29's `bringDown` and of `runProgram`'s `quiet`, which are not carried (ruling 5); duplicates out in Task 3 |
| `tests/lib.test.js` (66) | The rules | Into `tool/tests/lib.test.js` (Tasks 2 and 3); 20 are there already word for word, and one more with brimm-video's extra asserts |
| `tests/install.test.js` (12) | The installer, with `--print` | `tool/tests/install-transcribe.test.js` (Task 2) |
| All of `transcribe/`, from Task 2 to Task 8 | | Stays in brimm-operations unchanged (Task 5 freezes it), only as the way back, until Task 8 removes it |

### What in brimm-operations refers to it

| Where | What it says | Afterwards (Task 8, unless said) |
|---|---|---|
| `.github/workflows/app-tests.yml` | `transcribe/**` in both path lists; the step "Run the transcript tool's tests" in `transcribe/` | Both path entries and the step removed |
| `CLAUDE.md`, "The transcript tool" | How to test it; that it reads captions with the page's `tidyTranscript`; nothing installed without Jason's yes | Task 5 adds the freeze, the line on the contract fixtures, and the line on the show's and the host's names; Task 8 makes it a short "brimm-video" section: video editing and the transcript tool live there, and are not added back |
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
| `tool/shared/text.js`, `answers.js`, `transcript.js` | The page's helpers, reading Claude's replies, reading an `.srt` (`tidyTranscript`) | brimm-operations' `app/src/` files (the same bytes after line 1) | brimm-video's own copies from Task 4 (section 3): line 1 says so, and nothing keeps them in step by hand. The page and the tools agree through the contract fixtures |
| `tool/shared/show.js` | The show's and the host's names | `app/src/instructions.js`, its `SHOW` and `HOST` lines | The same; brimm-operations' CLAUDE.md asks its sessions to tell Jason if either name changes (Task 5) |
| `tool/lib.js` | The rules both tools follow | `transcribe/lib.js` | Owner: brimm-video, one file (Task 2) |
| `tool/run.js` | Running a program, finding the programs, the folder lock | The same code in `transcribe.js`, which since PR 29 also has `runProgram`'s `quiet` | Owner: brimm-video. `quiet` is not carried: only PR 29's `bringDown` used it |
| `tool/dropbox.js` `isWhole` | Is a file here whole, or a placeholder | `transcribe.js` `isWhole`, the same code | brimm-video's, once |
| `tool/dropbox.js` `readThrough`, used by `unedited.js` (the import's arrival check) and `edit.js` (`bring`) | Bring a placeholder down | `transcribe.js` `bringDown` (PR 29) | The one copy: #31 made it read with python3, as PR 29's `bringDown` does. `transcribe.js` keeps the name `bringDown` for a wrapper of it (ruling 5) |
| `transcribeFile`, `unedited.js` `workOn`, `final-transcript.js` `finalTranscript` | Sound, captions, the silence filter, the spellings, the `.txt` | Each other | Three callers of `lib.js`'s steps, kept apart (ruling 11) |
| The arrival loops in `transcribeFile`, `workOn` and `finish.js` | Wait until a file has arrived | Each other | Kept apart (ruling 11) |
| `tool/install.sh` and `tool/install-transcribe.sh` | Find the programs, write and load a plist, fetch the model, refuse the other tool's folders | Each other | Two scripts (ruling 6); their shared shell lines are not made one file now |
| `tool/tests/fixtures/handoff-v1.json`, `handoff-v1-short-video.json` | The hand-off's contract | brimm-operations' `app/tests/handoff/` (stale, `.mp4`) | Owner: brimm-video, which pins their hashes (Task 4). brimm-operations copies them again (Task 5) |

## Rulings

1. **Same label, folders, log, model and lock.** The label stays `com.thebrimm.transcribe`; each Mac keeps its folders, in their order; the log stays `~/Library/Logs/brimm-transcribe.log`; the model stays `~/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin`; the lock stays `<temp folder>/brimm-transcribe-<sha1 of the folder>.lock`; dated folders, `.failed.txt` notes and file names stay. Why: an installer replaces the agent of its own label in one stop and start, so no folder is ever watched by two agents on one Mac; `tool/install.sh` already reads this label's plist to refuse its folders; and each copy understands what the other left in a folder, so going back is one installer run.
2. **The move changes nothing the tool does, but for three things.** Lines that name a path ("Run tool/install-transcribe.sh to set this Mac up."). The words of one reason: a file Dropbox does not bring down for 2 minutes gets "Dropbox sent nothing of it for 2 minutes, so it was given up" in its note, where it said "nothing of it came for 2 minutes" (ruling 5). And `install-transcribe.sh` refuses a folder inside `BRIMM Video/` or one that holds it, as phase T's row asks the tool to leave `BRIMM Video/` alone (ruling 6). Phase T's row also puts the tool "under the Dropbox rule and writing the progress file". Until Task 10 it still writes `<name>.srt.writing` and renames it, and moves a finished video into a dated folder, inside Dropbox: what Dropbox undid for the import on 2026-10-14. Jason accepted that gap until Task 10, after Task 8, with its own yes. Two more gaps wait: the first sound ffmpeg can read, which the import takes for iPhone videos and the transcript tool does not (Task 11); and a Zoom call's length, asked of a sound file that may still be a placeholder (Task 12, PR 29's open point). Task 2 writes the three gaps into `docs/requirements.md`, and the first as a known limit in the README's section on the transcript tool.
3. **One `tool/lib.js`:** brimm-video's, with its optional sound stream in `ffmpegArgs` and its `captionsOf`, plus the transcript tool's own rules word for word, with their comments and private helpers: `zoomCall`, `isLocal`, `callKind`, `callName`, `callTag`, `waiting`, `isDayName`, `soundOf`, `companions`, `localRecordings`, `mayBeTranscript`, `TRANSCRIPT_BYTES`, `filedIn`, `zoomCalls`, `callNotes`, `looseTranscripts`, `lastCaptionEnd`, `lengthArgs`, `lengthOf`, `pairTranscripts`, `setSettled`. This is phase T's "sharing one `lib.js` and `run.js`".
4. **`tool/transcribe.js` holds only what is its own.** It imports `runProgram`, `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning` and `takeLock` from `run.js`, `isWhole` and `readThrough` from `dropbox.js`, and `localDay` from `shared/text.js`. Each is the same code as its twin today but for comments, and but for `runProgram`'s `quiet`, which only PR 29's `bringDown` used and which is not carried.
5. **`bringDown` stays, as `transcribe.js`'s wrapper of `readThrough`.** `export async function bringDown(file, { read = readThrough } = {})` resolves `{ ok: true }` once `read` has read the file through, or `{ ok: false, why }` with the message `read` rejected with; it never rejects. So `transcribeFile`'s call, `(deps.bringDown || bringDown)(file)`, and its notes stay as they were. `readThrough` (#31) does the work as PR 29's `bringDown` did: `/usr/bin/python3 -I` turns downloads on for itself alone (`setiopolicy_np(3, 0, 2)`), reads the file through saying how far it has got, and is given up after 2 minutes with nothing read. The reasons read as before ("Resource deadlock avoided", "spawn /usr/bin/python3 ENOENT"), but for a stall (ruling 2). The import and `bring` keep calling `readThrough` as they do. python3 comes with Xcode's command line tools, which both Macs have for git (brimm-video's installer checks for them).
6. **A second installer, `tool/install-transcribe.sh`, not a mode of `install.sh`.** The transcript installer and its 12 tests move as they are, and each script keeps refusing the other tool's folders, as both do today: `install.sh` refuses a folder that `com.thebrimm.transcribe` watches, and `BRIMM Video` inside one; `install-transcribe.sh` refuses a folder that `com.thebrimm.unedited` watches. It gains one refusal (ruling 2): a folder inside `BRIMM Video/`, or one that holds a `BRIMM Video` folder. Its plist runs `<checkout>/tool/transcribe.js`.
7. **Tests move whole, then lose their duplicates.** Task 2 adds exactly 202 of the 207 (the five of PR 29's `bringDown` and of `quiet` stay behind) and 7 new ones, so the move can be counted. Task 3 then removes, by a written list, the 38 moved tests that brimm-video already has.
8. **The contract fixtures keep the two repos in step,** as the spec says (section 3). No test in either repo hashes a copied module.
9. **The hand-off stays as it is.** `final/<name>.brimm-ops.json`, `format` "brimm-video hand-off", `version` 1, with its fixtures `tool/tests/fixtures/handoff-v1.json` and `handoff-v1-short-video.json` here and copies in brimm-operations' `app/tests/handoff/`. Nothing in this plan changes a byte that `finish` writes or the page reads, and the hand-off stays the two apps' only link: the transcript tool's `.srt` reaches the page as today, when Sallie gives it to the form. The only fixture work is brimm-operations copying the two hand-off fixtures again (they name `.mov` since brimm-video #16) and the new `.srt` pair, and brimm-video pinning the four.
10. **One new contract fixture,** as phase T's row asks: `tool/tests/fixtures/transcript-v1.srt` and `transcript-v1.transcript.txt`, the two files the transcript tool writes for a made-up video. brimm-video tests that the tool writes exactly them; brimm-operations tests that the page makes the `.txt` of the `.srt`.
11. **The three transcriptions and the arrival loops stay apart.** They already share every step through `lib.js`, and what differs differs on purpose: the import's word pass and sound stream, the finish's episode spellings, the transcript tool's filing and notes. Folding them is a change of behaviour.
12. **Sallie's laptop stays without the transcript tool** (Jason, 2026-10-21). When Jason is away, she drops YouTube videos and Zoom downloads into `BRIMM VIDEO MacBook` (the README's "When away").
13. **Jason's MacBook is a standby,** kept "only for when traveling or the mac studio is down" (Jason, 2026-10-21). It gets a brimm-video clone on `main` (Task 6, on his yes). Its `com.thebrimm.transcribe` is normally off: on with `./install-transcribe.sh --yes "<Dropbox>/The BRIMM DB/BRIMM VIDEO MacBook"`, off with `./install-transcribe.sh --remove`, each after `--print`, on Jason's yes, with ruling 14's checks. It watches only `BRIMM VIDEO MacBook`, never the Mac Studio's folders, so no video is ever transcribed on both Macs. One real video goes through it during the week (Task 7). CLAUDE.md and the README (Task 2) and the spec (Task 9) name it.
14. **The pull rule, now that one checkout runs two agents.** The main checkout is pulled, on `main`, only on Jason's yes and only when neither tool is at work: `launchctl list | grep com.thebrimm` shows `-` in the first column for both labels, and `pgrep -fl "transcribe.js|unedited.js"` prints nothing. The same holds on the MacBook while its agent is on. Task 2 writes this into the README and CLAUDE.md, and Task 9 into the spec's section 6.

## 2. One copy of the shared runtime code

| What | brimm-video now | brimm-operations now | The one copy | Settled by |
|---|---|---|---|---|
| `runProgram` | `keep`, `out`, `input`, `cwd`, `limit` | The same, and `quiet` (`wentQuiet`), since PR 29 | `run.js`, without `quiet` | Only PR 29's `bringDown` used `quiet` |
| `findTools`, `lastLine`, `sizeOnDisk`, `lockFile`, `isRunning`, `takeLock` | `run.js` | `transcribe.js` | `run.js` | The same code; Task 2 imports them |
| `isWhole` | `dropbox.js` | `transcribe.js` | `dropbox.js` | The same code but for a comment |
| Bringing a placeholder down | `readThrough` (#31, `e04f9be`): python3 with downloads on; rejects with the reason | `bringDown`: python3 with downloads on; `{ ok, why }` | `readThrough`, in `dropbox.js` | `transcribe.js`'s `bringDown` wraps it (ruling 5) |
| `ffmpegArgs` | An optional sound stream | None | brimm-video's | Given no stream it gives brimm-operations' arguments (an existing test); the transcript tool keeps calling it so until Task 11 |
| `captionsOf` | Here | Taken out at `19c897f`: only video editing used it | Kept | — |
| The Zoom rules, `waiting`, `isDayName` | Not here | `lib.js` | `lib.js` | Task 2, word for word |
| `isMedia`, `outputsFor`, `dayFolder`, `whisperArgs`, `silenceArgs`, `silences`, `dropSilent`, `spellNames`, `PROMPT`, `stampedText`, `captionCount`, `settled` | `lib.js` | `lib.js` | `lib.js` | The same code |
| `tidyTranscript` (which `stampedText` uses) and `localDay` | `shared/` | `app/src/` | Each repo's own: `tool/shared/` is brimm-video's from Task 4 | The contract fixtures (section 3) |

## 3. How the page and the tools stay in step

**Chosen by Jason on 2026-10-21, as the spec says (line 36, "the `.srt` fixture that replaces today's shared code"): the contract fixtures.** What must agree is what crosses from one app to the other: the hand-off and the `.srt`. brimm-video owns four fixtures, writes them from its own code and pins their hashes; brimm-operations keeps copies and tests its reader on them. `tool/shared/` becomes brimm-video's own, and nothing keeps it in step by hand.

| Way | | Why |
|---|---|---|
| The contract fixtures | Chosen | They test the one thing that must hold, that the page reads what brimm-video writes. No access from one private repo to the other, no package, no secret and no network; Sallie's laptop needs brimm-video only; the page's build (only `import { a } from "./file.js";` and `export const`, `function` or `class`) is untouched. A change to the page's modules costs nothing here unless it changes how the page reads a fixture, which brimm-operations' own test then shows |
| Hash tests of the copied modules, in both repos (this plan's first version) | No | Each change in brimm-operations to one of the four files would cost a failing CI there, a copy session here and a second change there; and its table would have to name brimm-video `main`'s squash commit, not a branch's |
| A git submodule | No | The page's build takes only `./file.js` imports, so its modules stay in `app/src/` whatever happens. brimm-video would carry all of private brimm-operations: Sallie's laptop would need a second key (today the one secret is her read-only brimm-video key), each CI a token, and `git pull` alone would no longer update the code the launch agents run |
| A git-URL package | No | Neither repo has packages or an install step; `npm install` on a Mac is an install, with the same key and token problems |
| A sync script | No | It copies but notices nothing, and needs a brimm-operations checkout |

**The four fixtures:**

| In brimm-video's `tool/tests/fixtures/` | Written by | Copied to brimm-operations' | Read there by |
|---|---|---|---|
| `handoff-v1.json` | The hand-off (`finish`); its contract since #7 | `app/tests/handoff/` | `readHandoff`, with `tidyTranscript` on every `srt` |
| `handoff-v1-short-video.json` | The same, for a short video | `app/tests/handoff/` | The same |
| `transcript-v1.srt` | The transcript tool, for a made-up video (Task 4) | `app/tests/handoff/` | `tidyTranscript` |
| `transcript-v1.transcript.txt` | The same | `app/tests/handoff/` | The `.srt`'s test: `tidyTranscript(srt) + "\n"` equals it |

**What each repo does.**
- brimm-video: `tool/tests/contract.test.js` pins the sha256 of each of the four. One that changes fails with: "`<file>` changed. brimm-operations keeps a copy of it: ask Jason for a session there to copy it again, then set its hash here to `<new>`." A change to the hand-off's shape is a new version anyway (spec section 5).
- brimm-operations: its copies, with the brimm-video commit they came from named in `handoff.test.js`'s comment (as today: "copied from brimm-video main at ab72782"), and its tests on them: the hand-off tests it has, and the `.srt` test (Task 5). A change to the page that reads a fixture differently fails there, and its session tells Jason.
- The show's and the host's names are the one thing that crosses the other way (brimm-video names them in what it asks Claude). brimm-operations' CLAUDE.md asks its sessions to tell Jason if either changes (Task 5).
- Line 1 of each file in `tool/shared/`, from Task 4:

```
// From brimm-operations app/src/transcript.js at commit 84a2f61; brimm-video's own since <date>. The page and the tools agree through the contract fixtures (README, "The contract with BRIMM Ops").
// From brimm-operations app/src/instructions.js (its SHOW and HOST lines) at commit 84a2f61; brimm-video's own since <date>. brimm-operations' sessions tell Jason if either name changes there.
```

**Today's sha256 of the two hand-off fixtures:** `handoff-v1.json` `4b455492c55673619658a84a9c0f537583976685d109731eadb84b80c97a818a` here, and `441e4420f6b6067c08352784b345a815f8a321a5af7944d62a1cb752cfad176a` there (stale); `handoff-v1-short-video.json` `6b00b04c6905fa4aaea44b71fed15d3106baf22acd1a55342819e4ddace2b522` here, and `f793d5fac70c91f40f6d194d40d6f01b6845f36e69f76f209b92874c666233c8` there (stale). The `.srt` pair's hashes come with Task 4.

## Review Focus

1. A placeholder in a watched transcript folder: `bringDown` asks `readThrough`, and a file that does not come down gets its note, with `readThrough`'s reason. (Task 2's four tests of `bringDown`, the moved stall test through the real wrapper, and #31's tests of `readThrough`.)
2. A run killed in the middle of a video at the switch: nothing is moved before its transcript is whole, and the next run takes over the lock of the gone process and does the video again. (The moved test "takes over at once from a run that is no longer there, and from one that has held the folder for half a day", and Task 6's check that nothing is at work first.)
3. One folder watched by two agents, or a transcript folder that reaches into `BRIMM Video/`: on one Mac, each installer refuses the other's folders, and `install-transcribe.sh` a folder inside `BRIMM Video/` or one that holds it; across Macs, the Mac Studio's list and the MacBook's share no folder. (The moved installer tests and Task 2's new one; Task 6, step 7.)
4. A change to what crosses between the apps: a fixture changed in brimm-video fails `contract.test.js`, whose message says brimm-operations keeps a copy; a change to the page's reader that reads the tool's `.srt` differently fails the fixture test in brimm-operations. (Tasks 4 and 5, each seen failing first.)
5. Going back during the week: the old installer writes back the old plist, and the folders need nothing. (Task 6: the printed plists compared with the kept copy; the moved tests that check the agent's arguments.)

## Files

| File | Task | What |
|---|---|---|
| `tool/transcribe.js`, `tool/install-transcribe.sh` | 2 | The tool and its installer, moved; `bringDown` as a wrapper; the installer's new refusal |
| `tool/lib.js`, `tool/run.js`, `tool/dropbox.js` | 2 | The transcript tool's rules join `lib.js`; `run.js`'s header no longer says it is a copy; one comment each in `dropbox.js` and `lib.js` |
| `tool/tests/transcribe.test.js`, `install-transcribe.test.js` | 2, 3, 4 | Moved; seven new tests; duplicates out; the `.srt` fixture's test |
| `tool/tests/transcribe-lib.test.js` | 2, 3 | Moved, then folded into `lib.test.js` |
| `tool/tests/install.test.js` | 2 | One comment |
| `tool/shared/*.js` | 4 | Line 1: brimm-video's own |
| `tool/tests/contract.test.js`, `tool/tests/fixtures/transcript-v1.srt`, `transcript-v1.transcript.txt` | 4 | The contract, this side |
| `README.md`, `CLAUDE.md`, `docs/requirements.md` | 2, 4, 9 | As each task says |
| The spec, this project's memory notes | 9 | As Task 9 says |
| brimm-operations: `app/tests/handoff/`, `app/tests/handoff.test.js`, `CLAUDE.md` | 5 | The fixtures copied again, the `.srt` test, the freeze and the two lines |
| brimm-operations: `transcribe/`, the workflow, `README.md`, `CLAUDE.md`, `docs/requirements.md` | 8 | The removal |
| `tool/transcribe.js` and its tests, `README.md`, `docs/requirements.md` | 10, 11, 12 | The gaps, each with its own yes |

---

### Task 0: Before starting

- [ ] **Step 1:** `main` has not changed under this plan since `0700809`: `git log --oneline 0700809..origin/main -- tool/dropbox.js tool/lib.js tool/run.js tool/shared tool/tests/fixtures tool/install.sh README.md CLAUDE.md docs/requirements.md` lists nothing, or each change it lists is carried into the tasks it touches.
- [ ] **Step 2:** Every question is answered. On 2026-10-21 none was open (the last section); a new one is answered before starting.
- [ ] **Step 3:** `transcribe/` has not changed since PR 29: `gh api "repos/jogden12/brimm-operations/commits?path=transcribe&per_page=1" --jq '.[0].sha[0:7]'` prints `3a5eeff`. If it prints another, its changes are carried into Task 2 the same way.
- [ ] **Step 4:** Baselines. brimm-video, in a worktree: `cd tool && node --test`, all pass (N1, 1685 at `0700809`). brimm-operations, in a worktree there or a `git archive` copy of `transcribe` and `app/src`: `cd app && node --test` (953) and `cd transcribe && node --test` (207).

### Task 1: The placeholder fix (PR #31): done

- [x] Merged on 2026-10-20 as `e04f9be`, built in the session "Dropbox placeholder fix for brimm-video's readThrough". Checked on 2026-10-21 against what Task 2 assumes: `readThrough(path, { spawn, quietMs })` in `dropbox.js` resolves once python3 has read the file through, and rejects with python3's last line on standard error ("Resource deadlock avoided"), with the spawn error's message ("spawn /usr/bin/python3 ENOENT"), or, once `READ_QUIET_MS` (2 minutes) passes with nothing read, with "Dropbox sent nothing of it for 2 minutes, so it was given up". `run.js` has no `quiet`, and `unedited.js` and `edit.js` call `readThrough` as before. Its tests cover python3 with `-I` and the file as an argument of its own, a read that keeps coming, a stall, python3's reason, python3 missing, and the Mac's own python3 on a real file.
- [x] N1 = 1685, all pass, in a checkout at `0700809`.

### Task 2 (brimm-video): The transcript tool moves in

**Files:** Create `tool/transcribe.js`, `tool/install-transcribe.sh`, `tool/tests/transcribe.test.js`, `tool/tests/transcribe-lib.test.js`, `tool/tests/install-transcribe.test.js`. Modify `tool/lib.js`, `tool/run.js` (header), `tool/dropbox.js` and `tool/tests/install.test.js` (one comment each), `README.md`, `CLAUDE.md`, `docs/requirements.md`.

**Interfaces:**
- Consumes: `readThrough` and `isWhole` (`dropbox.js`), as Task 1 found them; `localDay` (`shared/text.js`); `tidyTranscript` (`shared/transcript.js`, through `stampedText`).
- Produces: `tool/transcribe.js` exports `transcribeFile`, `transcribeFolder`, `transcribeFolders`, `parseArgs`, `bringDown(file, { read = readThrough } = {})` → `Promise<{ ok: true } | { ok: false, why: string }>`, and `main(argv, { find = findTools, log } = {})`, where `log` defaults to the stamped line on standard output it writes today; `main`'s two parameters are new, so a test can give it missing programs and read what it says. `tool/lib.js` exports ruling 3's names as well as its own.

- [ ] **Step 1: Copy the tests,** reading brimm-operations only: `git -C ~/"Claude Code/BRIMM operations" show ced8fe5:transcribe/tests/transcribe.test.js > tool/tests/transcribe.test.js`, and the same for `lib.test.js` (as `transcribe-lib.test.js`) and `install.test.js` (as `install-transcribe.test.js`). Change only:
  - each file's first line, `// Moved from brimm-operations transcribe/tests/<name> at commit ced8fe5 on <date>.`, with the old first lines after it;
  - `transcribe.test.js`'s import: `{ transcribeFile, transcribeFolder, transcribeFolders, parseArgs, bringDown, main }` from `../transcribe.js`, `{ findTools, lockFile, runProgram, isRunning }` from `../run.js`, `{ isWhole }` from `../dropbox.js`;
  - leave out the describe "asking Dropbox for a file" and the two tests of `quiet` in "running a program": five tests of code that is not carried, whose ground #31's tests of `readThrough` and step 2's tests of the wrapper cover;
  - the stall test, "leaves a note, and reads no sound, when Dropbox does not bring it down", goes through the real wrapper with a read that stalls as `readThrough` does: `bringDown: (f) => bringDown(f, { read: () => Promise.reject(new Error("Dropbox sent nothing of it for 2 minutes, so it was given up")) })`, and its note's reason is that text;
  - `transcribe-lib.test.js`: `../../app/src/transcript.js` becomes `../shared/transcript.js`;
  - `install-transcribe.test.js`: `../install.sh` becomes `../install-transcribe.sh`, and the three texts that say where unedited video is set up read as step 4 words them.
- [ ] **Step 2: Add seven tests.** The fifth passes at once: it pins what the tool already does, as phase T's row asks.

```js
// transcribe.test.js, a describe "bringing a placeholder down": each read is a stand-in, and no python3 is run
it("resolves ok once the file has been read through", async () => {
  const read = [];
  assert.deepEqual(await bringDown("/v/iphone.MP4", { read: async (f) => { read.push(f); } }), { ok: true });
  assert.deepEqual(read, ["/v/iphone.MP4"]);
});
it("gives python3's reason when the file cannot be read", async () => {
  assert.deepEqual(await bringDown("/v/a.mp4", { read: () => Promise.reject(new Error("Resource deadlock avoided")) }), { ok: false, why: "Resource deadlock avoided" });
});
it("gives the reason when python3 cannot be started", async () => {
  const gone = Object.assign(new Error("spawn /usr/bin/python3 ENOENT"), { code: "ENOENT" });
  assert.deepEqual(await bringDown("/v/a.mp4", { read: () => Promise.reject(gone) }), { ok: false, why: "spawn /usr/bin/python3 ENOENT" });
});
it("gives the reason when nothing of it comes for two minutes", async () => {
  const stall = new Error("Dropbox sent nothing of it for 2 minutes, so it was given up");
  assert.deepEqual(await bringDown("/v/a.mp4", { read: () => Promise.reject(stall) }), { ok: false, why: stall.message });
});
// transcribe.test.js, in "a folder"
it("leaves a folder inside the watched one alone when it is not named for a day, as BRIMM Video would be", async () => {
  // the watched folder holds "BRIMM Video/Unedited Video/Mac Studio/talk.mp4" and an empty "2026-10-13"
  assert.deepEqual(results, []);
  assert.deepEqual(readdirSync(join(t.dir, "BRIMM Video/Unedited Video/Mac Studio")), ["talk.mp4"]);
  assert.ok(!t.calls.some((c) => c.args.some((a) => String(a).includes("BRIMM Video"))));
});
// transcribe.test.js, in "before it starts"
it("says how to set the Mac up when a program is missing", async () => {
  const lines = [];
  assert.equal(await main(["--watch", "/in"], { find: () => ({ missing: ["ffmpeg is not installed."] }), log: (l) => lines.push(l) }), 2);
  assert.deepEqual(lines, ["ffmpeg is not installed.", "Run tool/install-transcribe.sh to set this Mac up."]);
});
// install-transcribe.test.js
it("refuses a folder inside BRIMM Video, and one that holds it: that folder is the unedited-video tool's", () => {
  // the second is a folder made for the test, with a folder named "BRIMM Video" in it
  for (const folder of ["/Volumes/Work/The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio", holding]) {
    const r = ask("--print", folder);
    assert.equal(r.code, 2);
    assert.match(r.out, /BRIMM Video belongs to the unedited-video tool/);
    changedNothing(r);
  }
});
```

- [ ] **Step 3: Run them to see them fail:** `cd tool && node --test tests/transcribe.test.js tests/transcribe-lib.test.js tests/install-transcribe.test.js`. Expected: they fail to load (no `../transcribe.js`, no `../install-transcribe.sh`, and `lib.js` has no `zoomCall`).
- [ ] **Step 4: Move the code.**
  - `tool/transcribe.js` from `ced8fe5:transcribe/transcribe.js`: ruling 4's imports; the definitions now in `run.js` and `dropbox.js` deleted, with `MODEL_NAME`, `STALE_LOCK_MS`, `SF_DATALESS`, `fileFlags`, `READ_QUIET_MS` and the python script; `bringDown` rewritten as ruling 5's wrapper, with its comment saying why the name stays; the header says where it came from ("Moved from brimm-operations transcribe/transcribe.js at commit ced8fe5 on <date>. Its history before that is there.") and that `install-transcribe.sh` sets it up; `main`'s line "Run tool/install-transcribe.sh to set this Mac up."; `main`'s two new parameters. Keep the `#!/usr/bin/env node` line, and mode 755.
  - `tool/lib.js`: ruling 3's rules added, word for word with their comments. Its header says it holds the rules of both tools; the "Copied in part" line goes.
  - `tool/run.js`: the "Copied in part" line goes. "The lock is the one both tools take, so the two never work on one folder at the same time."
  - `tool/install-transcribe.sh` from `ced8fe5:transcribe/install.sh`, mode 755. Its usage lines name `./install-transcribe.sh`. "Unedited video is set up with install.sh, beside this one." in the header; in the message for `--unedited` and `--rules-only`, "Unedited video is set up with install.sh, beside this one. This sets up the transcript tool only."; at the end of the refusal, "The launch agent for unedited video is set up with install.sh, beside this one." The new refusal, beside the old one, for a folder one of whose folders is named `BRIMM Video`, or that holds a folder of that name: "A folder for transcripts is never inside BRIMM Video, or one that holds it: <folder>. BRIMM Video belongs to the unedited-video tool, which install.sh, beside this one, sets up." `HERE` is the same code, so the plist names `tool/transcribe.js`. The label, log, model, default folder and the old refusal do not change.
- [ ] **Step 5: Run the three files, then the whole suite.** Expected: the three pass; `cd tool && node --test` all pass, 0 fail, N1 + 209 (202 moved, 7 new; 1894 at `0700809`). Write the count in the commit, and name the five tests left behind.
- [ ] **Step 6: Documents.**
  - README: line 3 says it holds two tools: the one for unedited video, and the transcript tool (moved from brimm-operations on <date>), which runs on the Mac Studio, with Jason's MacBook as a standby. Line 15's row for `tool/` names both tools and their installers, and "What is where" gains `tool/transcribe.js` and `tool/install-transcribe.sh`. A section "The transcript tool", made from brimm-operations' README section of that name with this repo's paths (`cd tool && ./install-transcribe.sh --print "<folder>"`; its tests are among `cd tool && node --test`; the Mac runs it straight from this folder, so it stays on `main`), with ruling 2's known limit: until Task 10 it renames inside Dropbox, as the import no longer does. A section "When away" (rulings 12 and 13): on Jason's MacBook, with ruling 14's checks and on his yes, `git pull`, then `./install-transcribe.sh --print "<Dropbox>/The BRIMM DB/BRIMM VIDEO MacBook"` and `--yes` with the same folder turn its transcript agent on; Sallie then drops YouTube videos and Zoom downloads into `BRIMM VIDEO MacBook` in place of `BRIMM VIDEO Transfer`; back home, `./install-transcribe.sh --remove` there turns it off, and anything left in `BRIMM VIDEO MacBook` is moved by hand into `BRIMM VIDEO Transfer`. Ruling 14's pull rule, where the README tells how to update. In "Copies kept in step by hand", `lib.js` and `run.js` are this repo's own now, and the sentence on `ffmpegArgs` becomes a known difference in the new section (no sound stream is mapped until Task 11). "Where this came from" (line 385) gains the move and loses "The transcript tool stays in brimm-operations."
  - CLAUDE.md: "Today it holds one tool" becomes two, the unedited-video tool and the transcript tool (`tool/transcribe.js`, moved from brimm-operations on <date>). "Both Macs" names Jason's MacBook as a standby for transcripts only (README, "When away"). The command block gains `cd tool && ./install-transcribe.sh --print "<folder>"`. The rule on the launch agent names both agents and ruling 14's pull rule. "Experiments never write into a watched Dropbox folder: a new file there starts a tool." The line on copies names `tool/shared/` only. A new rule: "A session here reads brimm-operations and never changes it; work there is done in a session opened there, on Jason's say-so."
  - `docs/requirements.md`: a dated line under "Changes", naming brimm-operations' workflow 5 note (2026-10-13) as where the transcript tool came from, and the three gaps of ruling 2 (Tasks 10, 11 and 12).
  - Comments: `dropbox.js` line 151 says the transcript tool brings a placeholder down with `readThrough` too, through its `bringDown`; `lib.js` line 40 says the arguments without a stream are "as the transcript tool asks for them"; `install.test.js` line 187 says the transcript tool's installer is `install-transcribe.sh`, beside `install.sh`.
- [ ] **Step 7: Commit and open the PR.** `git commit -m "The transcript tool moves in from brimm-operations, unchanged (phase T): transcribe.js, its installer and its tests"`. Nothing changes in brimm-operations: its 207 and 953 still pass there.

### Task 3 (brimm-video): One copy of each test

**Files:** Modify `tool/tests/transcribe.test.js`, `tool/tests/lib.test.js`. Delete `tool/tests/transcribe-lib.test.js`.

- [ ] **Step 1: List the duplicates.** A moved test is a duplicate when a test of the same function elsewhere has the same name and either the same body or a body that holds every assert of the moved one. Expected, as counted on 2026-10-20 and confirmed on 2026-10-21, to be checked pair by pair with `diff`:
  - `transcribe-lib.test.js` against `lib.test.js`: 20 the same, and "has ffmpeg take the sound out as the kind of file the transcriber reads, never asking a question", which brimm-video's holds with its three asserts for a sound stream;
  - `transcribe.test.js` against `run.test.js`: 17 the same (the three of `findTools` and fourteen of "running a program").

  That is 38. The installers' tests are not compared: they test two different scripts. The two sets of `isWhole` tests have different names, and both stay.
- [ ] **Step 2:** Write down the names doubled before: `grep -ho 'it("[^"]*"' tool/tests/*.js | sort | uniq -d`.
- [ ] **Step 3:** Remove the duplicates. Move what is left of `transcribe-lib.test.js` (the Zoom rules, `waiting`, `isDayName`) into `lib.test.js`, in its own describe blocks, and delete `transcribe-lib.test.js`.
- [ ] **Step 4:** The same `grep`: none of the listed names is doubled any more, and each is still there once. `cd tool && node --test`: all pass, 0 fail, N1 + 171 (1856 at `0700809`).
- [ ] **Step 5: Commit,** with the list in its body: `git commit -m "One copy of each test of the shared code: 38 moved tests brimm-video already had"`.

### Task 4 (brimm-video): The contract on this side

**Files:** Modify `tool/shared/text.js`, `answers.js`, `transcript.js` and `show.js` (line 1 only), `tool/tests/transcribe.test.js`, `README.md`, `CLAUDE.md`. Create `tool/tests/contract.test.js`, `tool/tests/fixtures/transcript-v1.srt`, `tool/tests/fixtures/transcript-v1.transcript.txt`.

**Interfaces:**
- Produces: the four fixtures and their pinned sha256 (section 3); line 1 of each file in `tool/shared/`, as section 3 shows it.

- [ ] **Step 1: Write the failing tests.**

```js
// contract.test.js: one test for each fixture
const PINNED = {
  "handoff-v1.json": "4b455492c55673619658a84a9c0f537583976685d109731eadb84b80c97a818a",
  "handoff-v1-short-video.json": "6b00b04c6905fa4aaea44b71fed15d3106baf22acd1a55342819e4ddace2b522",
  "transcript-v1.srt": "<its hash>",
  "transcript-v1.transcript.txt": "<its hash>"
};
for (const [name, pinned] of Object.entries(PINNED)) {
  it(`${name} is as brimm-operations last copied it`, () => {
    const now = sha256(readFileSync(fixture(name)));
    assert.equal(now, pinned, `${name} changed. brimm-operations keeps a copy of it: ask Jason for a session there to copy it again, then set its hash here to ${now}.`);
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

- [ ] **Step 2: Run them to see them fail.** Expected: the two `.srt` fixtures are not there, and their hashes are not pinned.
- [ ] **Step 3:** Write the fixtures from what the test's run writes, checked by eye (the captions numbered again, "Sallie", no "Thank you."), and pin their hashes. Line 1 of each file in `tool/shared/`, as section 3 shows it.
- [ ] **Step 4: Run the whole suite.** Expected: all pass, 0 fail, N1 + 176 (1861 at `0700809`).
- [ ] **Step 5: Documents.** The README's "Copies kept in step by hand" becomes "The contract with BRIMM Ops": the four fixtures, who writes and who reads each, the pinned hashes and what to do when one changes; that `tool/shared/` is brimm-video's own since <date>; and the show's and the host's names. CLAUDE.md's line on copies: "`tool/shared/` holds brimm-video's own copies of BRIMM Ops modules. The contract with BRIMM Ops is the four fixtures in `tool/tests/fixtures/` (README, "The contract with BRIMM Ops")."
- [ ] **Step 6: Commit and open the PR.** Once Jason merges it, the phase T session offers session A (Task 5) as a card.

### Task 5 (session A, in brimm-operations): The fixtures copied, the `.srt` test, and the freeze

Jason starts this session in `~/Claude Code/BRIMM operations` from the card the phase T session offers once Task 4 has merged; it opens a PR there. It is a precondition of Task 6. Steps for that session:

- [ ] **Step 1:** Read section 3 and rulings 9 and 10 of this plan, and brimm-video's README section "The contract with BRIMM Ops", from brimm-video `main`, reading only.
- [ ] **Step 2: The `.srt` test first.** In `app/tests/handoff.test.js`: "reads the transcript tool's .srt as the tool's own text says it": `tidyTranscript(srt) + "\n"` equals the `.txt`, read from `app/tests/handoff/transcript-v1.srt` and `transcript-v1.transcript.txt`. Run it: it fails, because the files are not there.
- [ ] **Step 3: The fixtures.** Copy brimm-video `main`'s `tool/tests/fixtures/handoff-v1.json`, `handoff-v1-short-video.json`, `transcript-v1.srt` and `transcript-v1.transcript.txt` into `app/tests/handoff/`. The comment in `handoff.test.js` names the commit, "copied from brimm-video main at <commit> (tool/tests/fixtures/)", and says the folder holds brimm-video's contract fixtures, which are copied again when brimm-video changes them and never edited here. `cd app && node --test`: the new test and the hand-off tests pass, with the `.mov` names.
- [ ] **Step 4: CLAUDE.md,** "The transcript tool": "`transcribe/` moved to brimm-video on <date> (`tool/transcribe.js`). It stays here unchanged, only as the way back, until it is removed; a fix to the transcript tool goes to brimm-video." And: "brimm-video keeps its own copies of `text.js`, `answers.js`, `transcript.js` and the show's and the host's names. If `SHOW` or `HOST` changes in `instructions.js`, tell Jason: brimm-video names them in what it asks Claude."
- [ ] **Step 5: Tests.** `cd app && node --test` (954: 953 and the new one, 0 fail), `node build.js` (writes `dist/index.html`), `cd transcribe && node --test` (207). Open the PR; its CI runs, because `app/` changed. Jason merges.

### Task 6 (Jason, one Mac at a time): The switch

Needs Tasks 2 to 5 merged. A session on that Mac runs it with Jason in chat; on the MacBook, a session there, or Jason himself. The Mac Studio first; the MacBook during the week (Task 7). Sallie's laptop: nothing (ruling 12). Two yeses from Jason for each Mac: before step 3 (the pull or the clone) and before step 5 (the switch).

| | Mac Studio | Jason's MacBook (a standby, ruling 13) |
|---|---|---|
| Folders, in this order | `<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer`, then `<Dropbox>/The BRIMM DB/BRIMM VIDEO Transfer/Zoom Video Transfer`; `<Dropbox>` is `~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden` | `<Dropbox>/The BRIMM DB/BRIMM VIDEO MacBook` only, exactly as its plist has it (step 1) |
| Runs now | `~/Claude Code/BRIMM operations/transcribe/transcribe.js` | `transcribe/transcribe.js` in its brimm-operations checkout (step 1) |
| Will run | `~/Claude Code/BRIMM video/tool/transcribe.js`: the checkout that runs `com.thebrimm.unedited`, on `main` | `tool/transcribe.js` in a brimm-video clone on `main`: `git clone https://github.com/jogden12/brimm-video.git ~/"Claude Code/BRIMM video"` under Jason's own GitHub sign-in (no deploy key), if none is there; worked on only through worktrees from then on |
| The other agent | `com.thebrimm.unedited` on `<Dropbox>/The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio`, which is neither folder | None expected (step 7 checks) |
| Afterwards | The agent stays on | Off once its real video is through (step 8); on again only when Jason travels or the Mac Studio is down (README, "When away") |
| The real check | The next real Zoom download in `Zoom Video Transfer`, and the next YouTube video in `BRIMM VIDEO Transfer` | One real video in `BRIMM VIDEO MacBook`, during the week |

- [ ] **Step 1: What it runs now, kept.** `plutil -p ~/Library/LaunchAgents/com.thebrimm.transcribe.plist`, and write its folders down in order. Keep a copy outside `LaunchAgents`, where launchd never loads it: `cp ~/Library/LaunchAgents/com.thebrimm.transcribe.plist ~/"Library/Application Support/BRIMM Transcribe/com.thebrimm.transcribe.plist.before-move"`.
- [ ] **Step 2: Nothing at work** (ruling 14). Ask Sallie not to drop anything for the few minutes of the switch. All of these hold, or wait and look again:
  - `launchctl list | grep com.thebrimm`: the first column is `-` for `com.thebrimm.transcribe`, and on the Mac Studio for `com.thebrimm.unedited` too (it can wait up to 15 minutes for an import's late check);
  - `pgrep -fl "transcribe.js|unedited.js"` prints nothing;
  - `tail -n 6 ~/Library/Logs/brimm-transcribe.log` ends with "Looked in the folder: nothing is waiting." for each folder;
  - nothing waits in a watched folder (this reads the old copy's own rules, and changes nothing):

```bash
node --input-type=module -e 'const { waiting, zoomCalls } = await import(process.argv[1]); const { readdirSync } = await import("node:fs"); for (const d of process.argv.slice(2)) { const n = readdirSync(d); console.log(d, waiting(n), zoomCalls(n).map((c) => c.call)); }' "<the brimm-operations checkout>/transcribe/lib.js" "<folder 1>" "<folder 2>"
```

  Expected: `[] []` after each folder.
- [ ] **Step 3: Jason's first yes, then the code.** On the Mac Studio, `git -C ~/"Claude Code/BRIMM video" pull` (it stays on `main`); on the MacBook, the clone in the table, or that pull if a clone is there. Then `cd ~/"Claude Code/BRIMM video/tool" && node --test`: all pass.
- [ ] **Step 4: Printed first.** `./install-transcribe.sh --print "<folder 1>" "<folder 2>"` (the MacBook has one folder), with the folders exactly as step 1 wrote them down. Read: the label `com.thebrimm.transcribe`; the program `…/BRIMM video/tool/transcribe.js`; the same folders, in the same order, after `--watch` and in WatchPaths; the log `~/Library/Logs/brimm-transcribe.log`; the model "here already"; the programs "none, they are all here". The printed plist differs from the kept copy only in the path to `transcribe.js`. On the Mac Studio also `./install.sh --print --machine "Mac Studio" "<Dropbox>/The BRIMM DB/BRIMM Video"`: it shows its own agent as it is, and refuses nothing.
- [ ] **Step 5: Jason's second yes, then the switch:** `./install-transcribe.sh --yes "<folder 1>" "<folder 2>"`. It stops the old agent and starts the new one under the same label, and the new one looks at its folders once, straight away.
- [ ] **Step 6: Check.** `plutil -extract ProgramArguments json -o - ~/Library/LaunchAgents/com.thebrimm.transcribe.plist` names brimm-video's `transcribe.js`; the log's newest lines are the new run's "Folder: …" and "Looked in the folder: …"; `launchctl print gui/$(id -u)/com.thebrimm.transcribe | grep "last exit code"` says 0. If the log says a folder could not be read, allow node in System Settings, Privacy & Security, Files and Folders (it is the same node, so it should not ask).
- [ ] **Step 7: No folder watched twice.** `for l in com.thebrimm.transcribe com.thebrimm.unedited; do plutil -extract WatchPaths json -o - ~/Library/LaunchAgents/$l.plist 2>/dev/null; echo; done`: no folder is in both lists, and no unedited folder is inside a transcript folder. On one Mac the installers refuse those cases: `install.sh` a transcript folder, and `BRIMM Video` inside one; `install-transcribe.sh` an unedited folder, and a folder inside `BRIMM Video/` or one that holds it. Across Macs, by hand: the Mac Studio's list and the MacBook's share no folder, and neither names a folder inside `BRIMM Video/`.
- [ ] **Step 8: Real use.** The real check in the table: the transcript is in a new dated folder, and its `.srt`, given to the page with "Choose a file", reads as before. On the MacBook, once its video is through: with step 2's checks and on Jason's yes, `./install-transcribe.sh --print --remove`, then `./install-transcribe.sh --remove`. Its agent is off until he is away.

**Going back during the week,** while brimm-operations still has `transcribe/`:
1. Step 2's checks.
2. `cd "<the brimm-operations checkout>/transcribe" && ./install.sh --print "<folder 1>" "<folder 2>"`: the printed plist is the kept copy.
3. Jason's yes, then `./install.sh --yes "<folder 1>" "<folder 2>"`. The folders need nothing: both copies use the same dated folders, notes, lock and log.
4. The fault is fixed in brimm-video, and the switch is made again from step 1.

After Task 8 there is no old copy: the way back is `git revert` of the faulty commit on brimm-video `main`, then `git pull` on each Mac, by ruling 14. The agent does not change.

### Task 7: A week of real use

- [ ] The week counts from the Mac Studio's switch (Jason, 2026-10-21).
- [ ] Each day, on the Mac Studio: any new "failed." line in the log is one the old tool would have written too; every video that landed was filed; no `.failed.txt` is left unexplained.
- [ ] During the week, the MacBook's switch and its one real video (Task 6), then its agent off again.
- [ ] At its end, Jason's yes for Task 8, and the phase T session offers session B as a card.

### Task 8 (session B, in brimm-operations): `transcribe/` removed

Jason starts this session in `~/Claude Code/BRIMM operations` from the card the phase T session offers after the week, on his yes; it opens a PR there.

- [ ] **Step 1: Check** that the Mac Studio runs brimm-video's copy (Task 6 step 6's `plutil` line), that the MacBook's agent is off or runs brimm-video's (Jason reads it), and that nothing outside `transcribe/` uses it: `git grep -n "transcribe/" -- app seed` prints nothing.
- [ ] **Step 2:** `git rm -r transcribe`.
- [ ] **Step 3: CI.** In `.github/workflows/app-tests.yml`, remove `"transcribe/**"` from `push.paths` and from `pull_request.paths`, and the step "Run the transcript tool's tests".
- [ ] **Step 4: Documents,** as section 1's second table says: the README ("What is where"; "The transcript tool" becomes "Transcripts from brimm-video"; "Video editing"; "Setting up on another Mac"), CLAUDE.md ("The transcript tool" becomes "brimm-video", keeping Task 5's lines on the fixtures and the two names), and `docs/requirements.md` (line 302, and "Changes"). History stays as it is.
- [ ] **Step 5: Tests.** `cd app && node --test` (all pass) and `node build.js`. Open the PR; its CI runs, because the workflow changed, and passes with no transcript step.
- [ ] **Step 6:** Once Jason merges: `git -C "<the brimm-operations checkout>" pull` on each Mac. No agent runs from it now. The session brings its own memory notes on the transcript tool up to date.

### Task 9 (brimm-video): After the removal

- [ ] README and CLAUDE.md: brimm-operations' `transcribe/` is gone (<date>), and the way back is a revert here.
- [ ] The spec: phase T's row as built (its pull requests; moved unchanged; what waits, Tasks 10 to 12); line 35, which says the tool runs on the Mac Studio only, names Jason's MacBook as its standby; section 6's "Jason pulls updates on both Macs … only when no import is running" (line 438) becomes ruling 14's rule.
- [ ] This project's memory notes: `mac-studio-video-setup.md` (the transcript agent is brimm-video's now, and the MacBook a standby) and `brimm-operations-link.md` (the transcript tool moved; `tool/shared/` is brimm-video's own; the contract fixtures).
- [ ] The kept `.before-move` plists on each Mac may go, on Jason's word.
- [ ] `cd tool && node --test`: all pass. Commit and open the PR.

### Task 10 (brimm-video, its own yes): The transcript tool under the Dropbox rule, writing the progress file

After Task 8. Until it is done the tool writes in place in synced folders (ruling 2): `<name>.srt.writing` and `<name>.transcript.txt.writing` renamed to their names, `.failed.txt` notes written there, an old `.transcribing` folder cleared there, and a finished video and its transcripts moved into a dated folder (`moveToDay`, `fileAway`, `fileCall` and `joinCall` each rename).

- [ ] **Step 1: A design note, added to this plan, for Jason's yes.** How filing works under the rule as `dropbox.js` states it: each file made whole on this Mac's own disk and cloned in (`cloneIn`, `textWriter`); a video and its transcripts cloned into the dated folder, and the video taken out of the watched folder only after the late check (`LATE_CHECK_MS`) finds the copies whole, as the import does; what holds a folder meanwhile, so that the next run does not take the video again; and the progress file each video's run writes, as `unedited.js` does through `progress.js`.
- [ ] **Step 2: The failing tests the note names,** at least: no `.writing` name ever appears in a watched folder; nothing in a watched folder is renamed (a stand-in `move` that fails the test if it is called there); a finished video leaves the watched folder only after the late check finds its copies whole; a run cut short before the late check leaves the video where it was, and the next run finishes it; a Zoom call's set and its late files the same; each video's run writes the progress file with its steps.
- [ ] **Step 3:** The code. The README's known limit and the gap in `docs/requirements.md` go.
- [ ] **Step 4: By hand on the Mac Studio, on Jason's yes:** one real YouTube video and one Zoom download through it, and the late check's line in the log.

### Task 11 (brimm-video, its own yes): An iPhone video's sound

After Task 10. The transcript tool asks ffprobe what is in a file, and has ffmpeg take the first sound it can read, as the import does (`streamsOf` in `cuts.js`, and `ffmpegArgs`' stream). It finds ffprobe beside ffmpeg (Homebrew installs both).

- [ ] **Step 1: The failing tests.** With a stand-in ffprobe that lists Apple's APAC first and AAC second, ffmpeg is given `-map 0:<the AAC's index>`. With APAC alone, the note says "its sound is in a form this Mac's ffmpeg cannot read (apac)", as the import's does. With no answer from ffprobe, ffmpeg is asked as today, with no `-map`.
- [ ] **Step 2:** The code. The known difference in the README and the gap in `docs/requirements.md` go.
- [ ] **Step 3: By hand, on Jason's yes:** one iPhone video with Apple's spatial sound.

### Task 12 (brimm-video, its own yes): A Zoom call's length, asked of a placeholder

After Task 10. Before `lengthOf` asks ffmpeg how long a waiting call's sound is, a sound file that is not whole is brought down with `bringDown`; when it does not come, the length stays unknown, as it is today for a file ffmpeg cannot read, and the log says why.

- [ ] **Step 1: The failing tests:** "asks Dropbox for a call's sound file before asking how long it is, when it is not here whole", and "gives a call whose sound does not come down no length, and says why in the log".
- [ ] **Step 2:** The code. The gap in `docs/requirements.md` goes.

## 4. Tests at each step

| After | brimm-video, `cd tool && node --test` | brimm-operations, `cd app && node --test` | brimm-operations, `cd transcribe && node --test` |
|---|---|---|---|
| Task 1 (done) | N1 = 1685 at `0700809`, all pass | 953 | 207 |
| Task 2 | N1 + 209 (202 moved, 7 new), all pass | 953 | 207 |
| Task 3 | N1 + 171 (38 duplicates out), all pass | 953 | 207 |
| Task 4 | N1 + 176 (four pinned fixtures, one fixture test), all pass | 953 | 207 |
| Task 5 | — | 954 (the `.srt` test) | 207 |
| Task 6 | All pass in each Mac's checkout, before its switch | — | — |
| Task 8 | — | All pass | Gone, with its CI step |
| Task 9 | All pass | — | — |
| Tasks 10 to 12 | Plus their tests, all pass | — | — |

Every brimm-video count is taken in a checkout: in a `git archive` copy one test, "is the short commit the checkout is at", fails by design. If `main` moves on before a task, its counts move with it; what must hold is all pass, 0 fail, and the differences above.

## Jason's decisions, 2026-10-21

From the review of this plan's first version, taken one at a time. The six questions it asked:

1. **Jason's MacBook** is a standby, kept "only for when traveling or the mac studio is down": a brimm-video clone there (Task 6, on his yes), its agent normally off, watching only `BRIMM VIDEO MacBook` (ruling 13).
2. **The Dropbox rule and the progress file** come after the move, as Task 10, after Task 8, with their own yes; meanwhile the gap is written down (ruling 2).
3. **Sallie's laptop** stays without the transcript tool; when Jason is away, she drops into `BRIMM VIDEO MacBook` (ruling 12).
4. **An iPhone video's sound and a Zoom call's length** are Tasks 11 and 12, after Task 10.
5. **The week of real use** counts from the Mac Studio's switch.
6. **The brimm-operations sessions:** the phase T session offers session A (after Task 4 merges) and session B (after the week, on Jason's yes for Task 8) as cards; Jason starts each in `~/Claude Code/BRIMM operations`, and each opens a PR there.

And from the review's findings: `bringDown` stays as the wrapper, with its tests first (ruling 5); the contract fixtures in place of the hash tests, as the spec says (section 3); two yeses per Mac (Task 6); the pull rule (ruling 14); `install-transcribe.sh`'s refusal of `BRIMM Video/` (ruling 6); `install.sh --print` beside it on the Mac Studio (Task 6); and the leftover lines in the README, the comments, the spec and the memory notes (Tasks 2 and 9).

No question is open.
