# Phase 8: the rollout (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jason's MacBook, then Sallie's laptop, run BRIMM Video Studio from the app and no longer from a git checkout. Each takeover is proved by hand: it keeps the Mac's name, settings and folders, and the Mac then takes an update from the feed. The old installer (`tool/move-app/`), its tests and the two old setup documents are retired, the three GitHub deploy keys are deleted, and CLAUDE.md, the README and the wiki say how a Mac is set up and updated now.

**Architecture:** Most of this phase is done by hand on two real Macs, so the plan is in three parts, each ending in its own pull request, with the by-hand steps between them. Part 1 is code that is safe before any Mac is touched: one test of the installer's plan for a Mac the old installer set up, two small changes to the setup engine that a takeover needs, the Getting Started guide's line about the copy in Downloads, and the old installer's deletion. Part 2 follows the first MacBook: the new setup document, written from what that Mac showed, takes over the lock-down checks the tests pin. Part 3 follows Sallie's laptop: the guard stops letting node through unquoted, and CLAUDE.md states the rules as they are once no laptop holds a key.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages. zsh for `install.sh` and the build scripts. Markdown for the documents. No Swift change is planned.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`: "Jason's decisions" (the two laptops re-run the new installer and their keys are deleted), part 1's "No git and no deploy key", part 2 (the setup's steps), part 5 (updates) and part 6's CLAUDE.md list. The build plan's row 8 and "Verification", by hand 1 to 7: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`. What earlier phases left for this one: the "Decided" and "Open for Jason" lists of the Phase 2, 5, 6 and 7 plans, and `docs/memory/progress.md`.

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end of each part, on the Mac Studio with `BRIMM_SPARKLE` set, so that the tests that need a Mac and Sparkle run.
- **The tasks of a part are built in order, one at a time.** A part is not started before the by-hand checks it needs have passed.
- **Nothing is changed on either laptop without Jason's yes in chat first**, each time: an install, a takeover, a moved copy, an uninstall, a deleted key, a trashed folder. CLAUDE.md's rule holds as it is written until Task 10 changes it, and for both laptops of this rollout after that.
- **Nothing is installed, signed with the Developer ID, sent to Apple, published, or loaded into launchd by a test or by Claude.** Claude runs `build-app.sh` and `release.sh` with `--print` at any time; a signed build, notarizing and a real `release.sh` only on Jason's yes in chat, each time; publishing with `cf` is Jason's own step.
- **The installer is only ever run with `--print`**, by a test or by hand. No test calls the real `claude`, the HyperFrames app or HeyGen.
- No test writes outside a folder made for it. A test's home is a new folder, never this Mac's home and never a drop folder. Experiments never write into a drop folder.
- **The BRIMM Ops contract.** Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes.
- **Commands stay compatible for one release** (spec, part 5): no `edit.js` command or flag is removed or renamed. Task 9 removes two spellings of node and no command: the bare path, which her skill wrote before Phase 2 and which a folder written on 8 November holds until its takeover, and the word `node`, which no skill ever wrote. It is safe only once every Mac's folder has been written again (check 42).
- **The protocol stays version 1.** Task 3 adds one error code, `root`, to its list. The shell shows it as it shows any stopped run, with Repair offered: Repair is what to choose once Dropbox is back.
- Words a person reads say "BRIMM Video Studio", never "node", "Terminal", "engine" or "Sparkle", and never name an episode's folder or a video's file. The sentences given in this plan are used exactly.
- Never read a `.env` file. Never read a private key: a step that removes a key file names it and never prints it.
- The repo is public: no account label, no absolute local path, no client's name, no team ID and no key in a committed file. The new documents say "a spare account on the Mac Studio", and name no Dropbox account.
- **Every by-hand step goes on the Mac App By-Hand Checks page**, in a Phase 8 group, checks 28 on. Each step names the Mac, the account and whose step it is. Claude cannot reach either laptop: what happened there is read from what Jason pastes into the page (`settings.js show`, the app's "Copy setup summary", a command's output). Before anything is pasted, the home folder is written as `~` and the Dropbox folder as `<Dropbox>`, so that no account's name and no Dropbox label reaches the page. The group is published at Part 1's end and linked from each pull request. Re-read the live page before each publish and change only this group.
- `cf` leaves a `.cloudflare` folder where it is run: add files by name and never add it.
- The Mac Studio's live checkout stays on `main` and is pulled only when nothing is at work, on Jason's yes.
- Comments are plain, full-sentence English, as in the rest of `tool/`.
- The line numbers are as of 34bcf7f, main after pull request 67. Find each one by the grep given.

## How the rollout goes

This is the order every task and check is a part of.

1. **Part 1 is built and merged** (Tasks 1 to 5). It changes no Mac. Task 1's test is green before the first takeover.
2. **Jason's MacBook** (checks 28 to 36). Its settings name a git checkout and carry no dev mark, so the app calls it a takeover: it shows Welcome, Apps, Permissions, Review, Install and Done, asks for no name and no folder, and gives the installer only the Mac's name and its BRIMM Video folder. The MacBook installs **1.0.0-beta.2** from the feed's own zip, is taken over, takes in a first video, and then updates to 1.0.0-beta.3, which is Phase 7's check 27. Phase 6's checks 11 to 15 are done there too. Then its deploy key is deleted.
3. **Part 2 is built and merged** (Tasks 6 to 8, and a fix for anything the MacBook found, test first). **1.0.0-beta.4** is released from it, and the MacBook takes it.
4. **Sallie's laptop** (checks 38 to 41), with Jason beside her. It installs the newest build on the feed, is taken over, has its strict-lock check made again, takes in a first video of Jason's own, and hands off to the BRIMM Ops page. Then its two keys are deleted.
5. **Part 3 is built and merged** (Tasks 9 and 10). **1.0.0-beta.5** carries Task 9, and is the first update Sallie's laptop takes.
6. **Afterwards**, on Jason's yes: the old clones go to the Trash once he no longer wants a way back.

**Before each Install click.** Two things on a laptop still run the 8 November code until the takeover is over, and neither knows anything this phase or Phase 7 built. The first is the old background job: after its last look for work, the installer writes its marker file into the drop folder, which the old job watches, so the old job starts once more before it is taken away. The second is any chat in Claude that was open before: it keeps the old skill and the old guard, and goes on running the clone's code on the same videos. So before Install, on each laptop: every chat in her Claude folder is closed and the Claude app is quit; the drop folder holds nothing but its marker file; and nothing is being exported, copied or AirDropped into it. After Install, the import's log is read for a run by Homebrew's node in that minute.

**A release reaches both laptops at once.** Both run beta builds, so a build is offered to Sallie's laptop the moment its appcast is put, at her next session. From Part 3 on, the MacBook takes a new build by hand from its stapled zip, and passes its checks, before Jason publishes it; and Sallie takes an update when Jason says so (Open for Jason, 1 and 3).

**Going back.** A takeover deletes nothing. The old clone and Homebrew's programs stay, and the clone's own `install.sh` puts the Mac back on it (`./install.sh --print …`, read, then the same without `--print`, on Jason's yes). The 8 November installer does not look whether anything is at work before it takes the job away. So going back is done only with the app quit, every chat closed, the drop folder empty, and nothing at work as the app's own copy says it (its `busy.js idle-why`, pasted). It has never been tried, and it needs the clone, not the key: a key can be deleted as soon as its Mac has passed, and a clone only when no way back is wanted.

## What this phase assumes

Each assumption has one named place to change.

- **Both laptops are takeovers.** `kindOf` (`tool/setup/checks.js:64-73`) calls any settings whose checkout is not an app's copy, and that carry no dev mark, a takeover. Check 28 reads each Mac's settings before anything is opened.
- **Claude Code is where the app looks.** The setup finds it only in the app's own programs, `/usr/bin`, `/bin` and `~/.local/bin`, and this build cannot install it (there is no `tool/claude-code.pin.json`). The MacBook's is in `~/.local/bin` (page check 2). Sallie's was never looked at: check 38 looks first. If hers is Homebrew's alone, Claude Code's own copy is installed there by hand, on Jason's yes, before the app is opened (Open for Jason, 7).
- **A takeover's installer run keeps every setting it is not told.** `settings.js plan` and `write` merge the name, the BRIMM Video folder and the checkout over the file and keep the rest (`tool/settings.js:289-296`). Task 1 pins it for the real `install.sh`; check 32 proves it on each Mac.
- **The feed has what each step needs.** Builds 2 and 3 are live with a delta from 2 to 3, so the MacBook needs no new release. Sallie's laptop can show an update only after a release newer than the build it installs.
- **The Mac Studio uses none of the deploy keys.** Its checkout reaches GitHub over HTTPS with the keychain, and it holds no `brimm_video_studio_deploy`. Deleting the three keys cannot stop its pulls, builds or releases.
- **A beta build sees every item on the feed, and a stable build only the untagged ones** (`tool/update-check.js:100-112`, `tool/studio-app/Sources/Updates.swift:123-129`). A build's channel is its own `build.json`'s, not the Mac's. So this phase releases betas only (Open for Jason, 1).

## Where the spec and the code disagree

Each is settled here for this phase. The spec is corrected with Part 3's pull request, not in a task.

1. **"Retire `tool/move-app/` and its ten `move-app-*` tests"** (build plan). There are twelve files: ten tests, `move-app-harness.js` and `move-app-ties-helpers.js`. All twelve go. One more test outside them reads `move.zsh` (`setup-checks.test.js:341-345`) and goes too.
2. **"Docs: `docs/setup/studio-app.md` replaces `move-to-studio-app.md` and `sallies-laptop.md`."** Nine tests read `sallies-laptop.md`, and `install.sh` prints its path. What they pin that is still true (the two lock-down checks, the open-lock sections, "If something goes wrong", taking a left-behind check agent away) moves into the new document word for word. What they pin that died with the old installer (Final Cut, the brimm-video `git pull`, the by-hand `install.sh --machine "Sallie's laptop"`) is dropped.
3. **"The BRIMM Video in Dropbox step"** (spec, part 2) is not shown on a takeover, a repair or an update, and nothing looks whether the folder in the settings is still there: `install.sh` would make a new, empty one (`install.sh:1214-1215`). Task 3 stops that run.
4. **"After relaunching … says start a new chat"** is said after an update only. A takeover writes her folder again with another node and another checkout, and a chat that was open before keeps the old clone's skill, guard and code, which are all still on the Mac. Task 2 says to close such a chat and start a new one, and checks 31 and 39 close them before Install.
5. **"Correct the stale line that says Sallie's laptop still runs brimm-video"** (spec, CLAUDE.md's list). CLAUDE.md has no such line. The README's banner says it (`README.md:3`), and CLAUDE.md's stale line is the deploy key's (`CLAUDE.md:23`: "one secret … on Sallie's laptop"; there are three keys). Tasks 7 and 10 correct both.
6. **"Claude only runs `--print`, the tests, or `release.sh --print`"** (spec). Phase 7 built it otherwise, on Jason's word: Claude runs a signed build, notarizing and the real `release.sh` on his yes each time, and publishing is his. CLAUDE.md says that (Task 10).
7. **"The person's own click in the app is their yes"** (spec) against "Nothing is installed on a Mac … without Jason's yes in chat first" (CLAUDE.md). Both laptops of this rollout wait for Jason's yes in chat. CLAUDE.md takes the spec's sentence for a later Mac in Task 10.
8. **"Phase 8 drops the bare `node` from `editStart`"** (`progress.md`) against "waits until every Mac's folder is rewritten (after Phase 8)" (Phase 2 plan). Both hold if it is the last code task, after Sallie's laptop is taken over: Task 9.
9. **"The rollout's steps say to trash it, or the app offers to"** (`progress.md`, of the copy left in Downloads). The app offers nothing for a copy in Downloads (`Mover.swift:46-51`). The setup document, the Getting Started guide and the page's steps say it (Tasks 5 and 6).
10. **"A first install … on a clean, non-admin account"** (build plan, by hand 1). Both laptops are takeovers on administrator accounts, and the spare account was never set up to the end. So no fresh setup has run to its end on any Mac, and this phase does not prove one (Open for Jason, 10).
11. **Page check 14 expects "Updates are not part of this build yet."** Every build since Phase 7 opens the check for updates instead. The check is rewritten and done inside check 34.

## Review Focus

1. **A Mac whose BRIMM Video folder is gone is never given a new, empty one.** Covered in Task 3: "a takeover whose BRIMM Video folder is gone cannot go on to Install" and "a repair and an update stop before the installer when the folder is gone".
2. **After a takeover the person is told to close the old chats and start a new one.** Covered in Task 2: "a takeover ends by saying to close the old chats, and a fresh setup does not".
3. **The app's installer plans a Mac the old installer set up without losing a setting.** Covered in Task 1: "the app's copy plans a takeover of a Mac a git checkout set up".
4. **Nothing still reads or names the old installer.** Covered in Task 4: "the old installer and its tests are gone" and "nothing in tool/ names the old installer". Covered in Task 7: "no living document names the old installer or its two setup documents".
5. **The lock-down checks reach the new document word for word.** Covered in Task 6: the nine pins, pointed at `docs/setup/studio-app.md` before it is written.
6. **The guard lets through this Mac's node in quotes and nothing else.** Covered in Task 9: the changed rows of `guard-cases.js`, and "the skill's own line is still allowed on every kind of Mac".

## Files

| File | What it is |
| --- | --- |
| `tool/tests/install.test.js` | Part 1: the installer's plan for a takeover. Part 2: its pins on the setup document. |
| `tool/setup/engine.js`, `checks.js`, `summary.js`, `protocol.js` | A takeover says to close the old chats. A run stops when BRIMM Video's folder is gone. |
| `tool/setup/guide-template.html` | The guide says to open the app from Applications and to trash the copy in Downloads. |
| `tool/move-app/` (deleted), `tool/tests/move-app-*` (deleted) | The old installer and its twelve test files. |
| `tool/tests/old-installer-retired.test.js` (new) | Nothing brings the old installer, or a pointer to it, back. |
| `tool/studio-app/build-app.sh`, `common.zsh`; `tool/tests/studio-app-build.test.js`, `no-xcode-tools.test.js`, `setup-checks.test.js` | They stop naming `move-app`. |
| `docs/setup/studio-app.md` (new); `docs/setup/move-to-studio-app.md`, `sallies-laptop.md` (deleted) | How a Mac is set up with the app, and her folder's lock-down checks. |
| `tool/install.sh` | One printed line names the new document. Nothing else in it changes. |
| `README.md`, `docs/requirements.md`, `docs/wiki/*.md`, `docs/memory/*.md` | What is true once the laptops run the app. |
| `tool/studio-app/AppIcon.icns` (new, on Jason's picture) | The app's icon. |
| `tool/studio.js`, `tool/open-lock.js`; `tool/tests/guard-cases.js`, `studio.test.js`, `guard-open.test.js` | The guard and node's spelling (Part 3, its own pull request). |
| `CLAUDE.md`, the spec | The rules after the rollout (Part 3). |

---

## Part 1: before any Mac is touched

### Task 1: The installer's plan for a Mac the old installer set up

**Files:**
- Test: `tool/tests/install.test.js` (beside `'the app\'s copy refuses a Mac marked "mode": "dev"'`; find it with `grep -n 'refuses a Mac marked' tool/tests/install.test.js`)

**Interfaces:**
- Consumes: that test's own helpers, `dropbox()`, `askWith({ bare, install, settings }, ...args)` giving `{ status, out, err, left, ran, agents }`, and `copy` (`copy.install`, `copy.tools`, `copy.app`, `copy.ran()`).
- Produces: nothing for later tasks. It is the one place the real `install.sh` meets settings shaped like the laptops'.

- [ ] **Step 1: Write the tests.** The settings are written as the tool writes them (as `tests/setup-harness.js` makes a takeover's, with `writeSettings`), so that they hold `version: 1`, and they carry no `mode`. Their `checkout` is a folder made inside the test's own temporary folder that holds a `.git` folder: a clone, and no path with an account's name. Two shapes, each a test of its own:
  - Jason's MacBook: `machine: "Jason's MacBook"`, `root: d.root`, `dropPath` a folder made for the test outside `d.root`, `import: "light"`, `handoffVersion: 2`.
  - Sallie's laptop: `machine: "Sallie's laptop"`, the same, and beside `dropPath` the older `drop: "Drop"`, the strict lock as the settings keep it, and a whole `sessionTeachings` record (take both shapes from `tool/settings.js`).

  `it("the app's copy plans a takeover of a Mac a git checkout set up: exit 0, and nothing changes")` runs `"--print", "--machine", <the name>, "--tools", copy.tools, "--app", copy.app, d.root` for each shape and asserts: `r.status === 0`; `r.out` holds `install.sh`'s own closing line for `--print`; `r.out` names the drop folder given and never the words `Homebrew` or `brew`; `r.out` shows the background job's program as the app's own (`copy.app` followed by `/Contents/MacOS/`) with `--agent`; `r.left` is what was there before; `r.ran`, `r.agents` and `copy.ran()` show that nothing ran. `it("the plan the app's copy makes for that Mac keeps every setting but the checkout")` runs `settings.js plan` as `install.sh` does (find `settings_plan` in `install.sh`) for each shape and asserts that the planned settings equal the given ones with only `checkout` changed, to the copy's `Contents/Resources/Studio`.
- [ ] **Step 2: Run them.** `cd tool && node --test tests/install.test.js`. Expected: both pass against today's code. If either fails for a reason that is not the test's own, the failure is this task's finding: fix `install.sh` or `settings.js` by the smallest change that keeps every other test green, and say in the report what was wrong, since a laptop would have met it.
- [ ] **Step 3: Commit.** `git add tool/tests/install.test.js` (and any fix), message `Studio app phase 8: the app's installer plans a Mac the old installer set up`.

### Task 2: A takeover says to close the old chats and start a new one

**Files:**
- Modify: `tool/setup/engine.js` (`NOTE` and `finish`; find them with `grep -n 'NOTE.takeover' tool/setup/engine.js`)
- Test: `tool/tests/setup-engine.test.js` (the takeover's test and the repair of a takeover; find both with `grep -n 'left as it is' tool/tests/setup-engine.test.js`), `tool/tests/setup-summary.test.js` if its takeover lines list the notes (`grep -n 'left as it is' tool/tests/setup-summary.test.js`)

**Interfaces:**
- Produces: `NOTE.oldChats = "Close every chat in Claude that was open before this, and start a new one so it reads this version."`
- Produces: the order of `done.notes` on a takeover: the notes about folders, `Still to install: …` when an app is missing, `NOTE.takeover`, `NOTE.claude` when Claude did not answer, then `NOTE.oldChats` last. A takeover is never given `NOTE.update` as well, whatever the run's word; an update of any other Mac gets `NOTE.update` as today.

- [ ] **Step 1: Change the tests first.** In the takeover's test the expected notes become `["The older copy of BRIMM Video Studio on this Mac is no longer used, and was left as it is.", "Close every chat in Claude that was open before this, and start a new one so it reads this version."]` for `takeover`, and stay `[]` for `installed`. The repair of a takeover expects its notes as today (`"Still to install: Claude, HyperFrames."`, then the older copy's note) with the new sentence added last. Add `it("a takeover ends by saying to close the old chats, and a fresh setup does not")`: a fresh setup's `done.notes` hold neither sentence about a chat; an update of an installed Mac holds `NOTE.update` and not the new one; a run with the word `update` on a takeover holds the new one once and not `NOTE.update`.
- [ ] **Step 2: Run them, and see them fail.** `cd tool && node --test tests/setup-engine.test.js`.
- [ ] **Step 3: Change `NOTE` and `finish`.** The Getting Started guide takes the same notes, so it says the sentence too.
- [ ] **Step 4: Run the engine's tests, the summary's, the guide's and the stand-in's.** `cd tool && node --test tests/setup-engine.test.js tests/setup-summary.test.js tests/setup-guide.test.js tests/studio-app-fake-engine.test.js`. Expected: pass. (The stand-in engine has no takeover note of its own.)
- [ ] **Step 5: Commit.** Message `Studio app phase 8: a takeover says to close the old chats and start a new one`.

### Task 3: A run stops when BRIMM Video's folder is gone

**Files:**
- Modify: `tool/setup/checks.js` (three new exports), `tool/setup/engine.js` (the `review` step and `renew`), `tool/setup/summary.js` (`reviewSummary`), `tool/setup/protocol.js` (`CODES`)
- Test: `tool/tests/setup-checks.test.js`, `tool/tests/setup-engine.test.js`, `tool/tests/setup-summary.test.js`, `tool/tests/setup-protocol.test.js`

No Swift changes: the shell shows a code it has no case for as a stopped run, with its sentence, its advice and Repair, which is what to choose once Dropbox is back.

**Interfaces:**
- Produces, in `checks.js`, beside `NO_BRIMM_VIDEO`: `export const ROOT_GONE = "BRIMM Video's folder in Dropbox is not where this Mac's settings say it is.";`, `export const ROOT_ADVICE = "Check that Dropbox is open and signed in on this Mac, then try again.";` and `export function rootGone(root)`. `rootGone` asks `statSync` and is true only when nothing is there (`ENOENT`, `ENOTDIR`) or what is there is not a folder. A folder that could not be looked at (`EACCES`, `EPERM`) is not gone: a repair and an update have no Permissions step to say so, and must not stop for it.
- Produces, in `protocol.js`: `CODES` gains `"root"`, after `"settings"`.
- Produces: `reviewSummary` takes `gone` (a boolean). When it is true the summary's `ok` is false, and the one row labelled `BRIMM Video in Dropbox` that it already has holds `ROOT_GONE + " " + ROOT_ADVICE` in place of the folder's words. There is never a second row with that label.

- [ ] **Step 1: Write the failing tests.**
  - `setup-protocol.test.js`: the pinned list of codes gains `root`.
  - `setup-checks.test.js`: `it("rootGone: a folder that is not there is gone, a file is gone, a folder is not, and one that cannot be looked at is not")`. The last case is a folder under a parent whose mode is `000`, put back in a `finally`.
  - `setup-engine.test.js`: `it("a takeover whose BRIMM Video folder is gone cannot go on to Install")`: with `settings: "takeover"` and the Mac's root removed before the run, the review's summary has `ok === false`, and its `BRIMM Video in Dropbox` row holds the two sentences; the review's question offers Check again and no Install; the installer is never called with `--yes`; and nothing is at the root afterwards.
  - `setup-engine.test.js`: `it("a repair and an update stop before the installer when the folder is gone")`: for `run: "repair"` and `run: "update"` on an installed Mac whose root was removed, the exit code is 1, the last event is `{ event: "error", code: "root", message: ROOT_GONE, advice: ROOT_ADVICE, contact: SUPPORT }` (the contact as the other error tests there expect it), `installCalls` is empty, and nothing is at the root afterwards.
  - `setup-engine.test.js`: `it("a fresh setup is not asked about a folder it has not chosen yet")`: a fresh setup ends as it did.
  - `setup-summary.test.js`: `it("a review of a Mac whose folder is gone is not ok, and says so in the one row")`.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Write the code.** In `review`, a held state (`state.kind === "held"`) asks `rootGone(answers.root)` on each pass of its loop and gives it to `reviewSummary`. In `renew`, `rootGone(found.settings.root)` throws `new Ending("root", ROOT_GONE, { advice: ROOT_ADVICE })` before `install` is called, so nothing is staged and the installer never runs.
- [ ] **Step 4: Run** `cd tool && node --test tests/setup-protocol.test.js tests/setup-checks.test.js tests/setup-engine.test.js tests/setup-summary.test.js tests/studio-app-state.test.js`. Expected: pass.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: a run stops when BRIMM Video's folder is gone`.

### Task 4: The old installer is retired

**Files:**
- Create: `tool/tests/old-installer-retired.test.js`
- Delete: `tool/move-app/` (`build-app.sh`, `choose-folder.swift`, `launcher.swift`, `move.zsh`, `open-in-terminal.zsh`) and the twelve `tool/tests/move-app-*` files
- Modify: `tool/tests/setup-checks.test.js` (delete the test `"looks as move.zsh's search_brimm_video looks"`; the four places are pinned by behaviour in the tests above it), `tool/setup/checks.js` (the comment over `brimmVideoFolders`), `tool/tests/studio-app-build.test.js`, `tool/studio-app/build-app.sh`, `tool/studio-app/common.zsh`, `tool/tests/no-xcode-tools.test.js`

**Interfaces:**
- Produces: `old-installer-retired.test.js`, on the pattern of `final-cut-words.test.js`, with a `NAMES` regular expression (`/move-app|Move to Studio|move\.zsh/`) and an `ALLOWED` list of `[file, reason]` pairs that Task 7 adds a documents half to.

- [ ] **Step 1: Write the failing test.** `it("the old installer and its tests are gone")`: there is no `tool/move-app`, and no file in `tool/tests` starts with `move-app-`. `it("nothing in tool/ names the old installer")`: no file of `tool/` but this test has a match for `NAMES`. The files are the ones git has or would add (`git ls-files -z --cached --others --exclude-standard tool`, as `studio-app-build.test.js` lists them), never a walk of the disk, and any path that matches `/(^|\/)\.env(\.|$)/` is passed over before it is opened: no test reads a `.env` file. `ALLOWED` starts empty.
- [ ] **Step 2: Run it, and see it fail.** `cd tool && node --test tests/old-installer-retired.test.js`.
- [ ] **Step 3: Delete and reword.**
  - `git rm -r tool/move-app` and `git rm tool/tests/move-app-*`.
  - `setup-checks.test.js`: delete the one test that reads `../move-app/move.zsh`.
  - `checks.js`: the comment says the four places itself: "looked for in four places, in this order: the top of each Dropbox in ~/Library/CloudStorage, a level below that, the top of each ~/Dropbox*, and a level below that."
  - `studio-app-build.test.js` first: the made-up `tool/move-app/x` goes, and `move-app` leaves its comments, its filter, its test's title and its regular expression. Then `build-app.sh`: the printed step reads `without tests, studio-app or any .env file`, and the removal is `rm -rf $tool/tests || stop "The tests could not be taken out."`. Then `common.zsh`'s comment: "The one Developer ID Application identity in the keychain, found by name, so that nothing secret is in any file."
  - `no-xcode-tools.test.js`: `move-app` leaves `SKIPPED`, and the comment names what is skipped today.
- [ ] **Step 4: Run** `cd tool && node --test tests/old-installer-retired.test.js tests/setup-checks.test.js tests/no-xcode-tools.test.js tests/studio-app-build.test.js` on the Mac Studio (the build's test skips elsewhere). Expected: pass. Then `zsh tool/studio-app/build-app.sh … --print` as its README gives it: it still prints its steps and `Nothing was done.`
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the old installer, Move to Studio, is retired`.

### Task 5: The guide says where the app lives

**Files:**
- Modify: `tool/setup/guide-template.html` (under `<h2>Updates and Repair</h2>`)
- Test: `tool/tests/setup-guide.test.js`

- [ ] **Step 1: Write the failing test.** `it("the guide says to open the app from Applications, and to trash a copy left in Downloads")`: the guide's text holds `Open BRIMM Video Studio from Applications. If a copy of it, or its zip, is still in Downloads, put it in the Trash.`
- [ ] **Step 2: Run it, and see it fail.**
- [ ] **Step 3: Add the sentence** as its own paragraph, first under that heading.
- [ ] **Step 4: Run** `cd tool && node --test tests/setup-guide.test.js tests/studio-app-core.test.js`. Expected: pass, the guide still loading nothing from the network and never saying node or Terminal.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the guide says to open the app from Applications`.

**Part 1's end:** the whole suite on the Mac Studio. The live By-Hand page is read again and its Phase 8 group, checks 28 to 45, is published. Then Jason's yes to push and open the pull request, which links to that page, and his yes to merge.

---

## Part 2: after Jason's MacBook

Needs: checks 28 to 35 passed. Anything they found is fixed first, each as its own commit under the Global Constraints, with its failing test first.

### Task 6: `docs/setup/studio-app.md` takes the old setup documents' place

**Files:**
- Create: `docs/setup/studio-app.md`
- Delete: `docs/setup/sallies-laptop.md`, `docs/setup/move-to-studio-app.md`
- Modify: `tool/install.sh` (one line; find it with `grep -n 'sallies-laptop' tool/install.sh`)
- Test: `tool/tests/install.test.js` (find its readers with `grep -n 'sallies-laptop\|GUIDE' tool/tests/install.test.js`), `tool/tests/edit.test.js`, `tool/tests/unedited.test.js`

**Interfaces:**
- Produces: `docs/setup/studio-app.md` with `## Steps` (numbered from 1 with no gap) followed by `## If something goes wrong`, `## The open lock (for Jason alone)` and `## The open lock (for Sallie)`. Two of its steps keep their titles exactly: `**Check that her Claude folder only runs BRIMM Video:**` and, straight after it, `**Check her Claude folder's open lock:**`. The step after those is `**The first real run:**`.
- Produces: `install.sh` prints `  By hand afterwards:  the setup guide (docs/setup/studio-app.md)`.

The document's sections, in order:
1. **What this is.** The app: signed, notarized, Apple silicon, macOS 13 or later; no git, no key, no Homebrew and no Terminal on the Mac. The Mac Studio is the one exception: a git checkout in dev mode that the app refuses.
2. **How the steps are written.** The steps for a real Mac are on the Mac App By-Hand Checks page. Each names the Mac, the account and whose step it is; what happened on a laptop is read from what is pasted back, with the home folder written as `~` and the Dropbox folder as `<Dropbox>`.
3. **`## Steps`.** Before you start (free disk, a Claude plan with Claude Code, Dropbox signed in to the account BRIMM Video is shared with, whether the account is an administrator's). Getting the app onto the Mac (the zip; macOS asks once; Move to Applications; **then trash the copy in Downloads and its zip, and never unzip a second time beside it**). The setup, step by step, in the app's own words. The Getting Started guide (named, not repeated). The two lock-down checks, moved whole. The first real run, with Jason's own test recording and never her episodes.
4. **A Mac the old installer set up.** Before Install: every chat in her Claude folder closed and the Claude app quit, the drop folder holding nothing but its marker file, nothing being copied into it, and why (the old job and an old chat both run the old code until the takeover is over). What a takeover keeps and changes, as checks 31 and 32 showed it. After it: her folder is written again with the app's own programs, so the strict-lock check is made again, "or step n+1's, on an open-lock laptop"; and if teachings from sessions are on, the account the `claude` command is signed in to is the one that was checked, or teachings are turned off until it is. What is cleared afterwards, each on Jason's yes: the key in GitHub, then the key's files and the `Host` block in `~/.ssh/config`, the old clone once no way back is wanted, and the old installer's leftovers. Homebrew's programs are no longer used by Studio and are left. Going back, and the four things that must hold first (the app quit, every chat closed, the drop folder empty, nothing at work).
5. **Updates.** Claude's one line at the start of a session; "update Studio"; the wait while anything is at work; the held quit; the update finishing when the app is next opened; only signed builds from the feed. After an update that changes her folder, the strict-lock check is made again, "or step n+1's, on an open-lock laptop".
6. **`## If something goes wrong`**, **`## The open lock (for Jason alone)`**, **`## The open lock (for Sallie)`**: moved from `sallies-laptop.md`, with "brimm-video" now "BRIMM Video Studio". Where a line only writes her folder again as it is, it becomes "open BRIMM Video Studio and choose Repair". Where a line changes her lock, her Zoom folder or her web tools (`--lock open`, `--zoom`, `--web open`), Repair cannot do it: the line keeps its command, run in Terminal with the app's own programs, each path in double quotes: `"<the app>/Contents/Resources/node/bin/node" "<the app>/Contents/Resources/Studio/tool/settings.js" studio --node "<that node>" …`. The line that pointed at "Jason has a newer brimm-video" now points at the Updates section. The check agent's removal line stays as it is.
7. **Teachings from sessions**: off until Jason has checked both accounts' training setting; the command, run with the app's own programs as above; and that a takeover keeps the record, so it is looked at again then.
8. **The Mac Studio**, in one paragraph, and **building and releasing**, which points to `tool/studio-app/README.md`.

- [ ] **Step 1: Change the tests first.** Point the nine readers at `docs/setup/studio-app.md`.
  - Keep every pin whose subject is still true: the two titles and that the open-lock step follows the strict one; the open-lock step's words, but for "the deploy key", which no Mac holds; the three sections and their words, with `--lock open`, `--zoom` and `--web open` now pinned in the app's own command; the check agent's removal line; the `Charge $99` strings of `edit.test.js`.
  - The step numbers are read from the document, not written in a test: the strict check is step `n`, the open one `n + 1`, the first real run `n + 2`. `edit.test.js` finds its step by its title, not by "9.". Every "step `n`'s check again" in the document goes on "or step `n + 1`'s, on an open-lock laptop", and it is said at least three times (If something goes wrong, Updates, and the takeover's section).
  - Drop each pin whose subject died with the old installer: Final Cut 12.3; "Switching her laptop"; the by-hand `install.sh --print --machine "Sallie's laptop"` step; the guide's `git pull` lines and the words 'pull as under "Jason has a newer brimm-video", above' (their README half stays, since the Mac Studio still pulls).
  - `install.sh`'s printed line is pinned at the new path.
- [ ] **Step 2: Run them, and see them fail** for want of the document.
- [ ] **Step 3: Write the document, change `install.sh`'s line, and delete the two old documents.** Carry nothing that names a Dropbox account, an absolute path with an account's name, a team ID or a key.
- [ ] **Step 4: Run** `cd tool && node --test tests/install.test.js tests/edit.test.js tests/unedited.test.js`. Expected: pass.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: one setup document for a Mac with the app`.

### Task 7: The README, the wiki and the notes say what is true now

**Files:**
- Modify: `README.md`, `docs/requirements.md` (its pointer to the setup document only), `docs/wiki/architecture.md`, `docs/wiki/documents.md`, `docs/wiki/data-model.md`, `docs/wiki/hyperframes-and-heygen.md`, `docs/wiki/macs.md` (the one line that names her setup document), `docs/memory/gotchas.md`, `docs/memory/progress.md`, `tool/edit.js` (one sentence of a comment)
- Test: `tool/tests/old-installer-retired.test.js` (its documents half), `tool/tests/install.test.js` (its README pins)

- [ ] **Step 1: Write the failing tests.** `it("no living document names the old installer or its two setup documents")`: `README.md`, `CLAUDE.md`, `docs/requirements.md`, `docs/wiki/*.md`, `docs/setup/*.md` and `docs/memory/gotchas.md` have no match for `/move-app|Move to Studio|move-to-studio-app\.md|sallies-laptop\.md/`, but for `ALLOWED` lines, each with its reason: the two dated lines of `docs/wiki/macs.md` that say how each laptop was moved on 8 November, and the one line of `docs/setup/studio-app.md` that names the old installer's app so that it can be found and trashed. Old plans, specs, handoffs and `docs/memory/progress.md`'s dated lines are history and are not read. In the same step, change `install.test.js`'s pins on the README's "Setting a Mac up", "Installed from the app" and "On Sallie's laptop" paragraphs (`grep -n 'README' tool/tests/install.test.js`) to the words Step 3 gives them.
- [ ] **Step 2: Run them, and see them fail.**
- [ ] **Step 3: Change the documents.**
  - `README.md`: the banner (line 3) says every Mac runs Studio, the Mac Studio from this repo's main checkout and every other Mac as the app, set up as `docs/setup/studio-app.md` says. Lines 5, 7 and 9 lose "two Macs" and the pointers to the old documents. "Setting a Mac up" and its Homebrew paragraph say they are the Mac Studio's, in dev mode, where a newer Studio still comes by `git pull`. "Installed from the app" points to the new document. "both Macs" becomes "every Mac". The line about `transcribe/unedited.js` from brimm-operations (stale since 2026-11-03) and "nothing on the PATH is used" are corrected. "What is where" gains rows for `tool/setup/` and `tool/studio-app/`.
  - `docs/wiki/architecture.md`: the section on the Move to Studio app goes; the Mac app's paragraph names `tool/studio-app/`, `tool/setup/`, `set-up.js` and the marker; the phases line says what is on main.
  - `docs/wiki/documents.md`: setting up a Mac is `docs/setup/studio-app.md`; building and releasing is `tool/studio-app/README.md`.
  - `docs/wiki/macs.md`: "Her setup doc is `docs/setup/studio-app.md`." The rest of the page waits for Task 10.
  - `docs/wiki/data-model.md`: the settings' `mode`; `set-up.json` and `updating.json` in the support folder; `build.json` in the app's copy; Sparkle's and the vendor's pins.
  - `docs/wiki/hyperframes-and-heygen.md`: "either Mac" becomes "any Mac".
  - `docs/memory/gotchas.md`: the free-space line and the "clones Studio at the commit it was built from" line are said of the app; the 8 November installer's two gaps (it takes the job away without looking for work, and its job starts when the marker file is written) are added. `docs/memory/progress.md`: Part 1 and the MacBook's checks, and its stale clause about `sallies-laptop.md` goes.
  - `tool/edit.js`: the sentence "On her laptop git reaches GitHub with the deploy key." leaves `behind`'s comment.
- [ ] **Step 4: Run** `cd tool && node --test tests/old-installer-retired.test.js tests/install.test.js`, then the whole suite. Expected: pass.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the README, the wiki and the notes after the first MacBook`.

### Task 8: The app's icon (only once Jason has chosen the picture)

This task is built only if Jason has given the picture by the time Part 2 is built (Open for Jason, 8). Without it, 1.0.0-beta.4 ships with macOS's plain icon, as the builds before it did.

**Files:**
- Create: `tool/studio-app/AppIcon.icns`
- Test: `tool/tests/studio-app-build-info.test.js` (or the file that already tests `build-info.js`'s `CFBundleIconFile`; find it with `grep -ln 'CFBundleIconFile' tool/tests`)

**Interfaces:**
- Consumes: `build-app.sh` already copies `tool/studio-app/AppIcon.icns` into the bundle and passes `--icon` when the file is there, and `build-info.js` writes `CFBundleIconFile` only then. Neither changes.

- [ ] **Step 1: Write the failing test.** `it("the app's icon is an icns file that holds a 1024-pixel picture")`: `tool/studio-app/AppIcon.icns` is there, its first four bytes are `icns`, the length in its header is the file's own size, and it holds an `ic10` entry.
- [ ] **Step 2: Run it, and see it fail.**
- [ ] **Step 3: Make the file by hand**, in a scratch folder outside the repo, from Jason's 1024-pixel PNG: the ten sizes of an `.iconset` with `sips -z`, then `iconutil -c icns`. Copy the result in. No script for it is added to the repo.
- [ ] **Step 4: Run the test and `studio-app-build.test.js`.** Expected: pass. The icon is seen by hand in check 37's build: in Finder, and in the question macOS asks when the app is first opened.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the app's icon`.

**Part 2's end:** the whole suite, Jason's yes to push and open the pull request, his yes to merge, and his yes to pull the Mac Studio's checkout. Then check 37: 1.0.0-beta.4 is built, signed, notarized, released and published as in checks 21, 23 and 24, and the MacBook takes it.

---

## Part 3: after Sallie's laptop

Needs: checks 38 to 42 passed.

### Task 9: The guard lets node through only as this Mac's own, in quotes

This is a change to the lock. It is its own pull request, with its own review of the three places that match a command: `guardDecision` (`tool/studio.js`), and `bashDecision` and `firstWord` (`tool/open-lock.js`).

**Files:**
- Modify: `tool/studio.js` (`editStart` and the comments around it; find it with `grep -n 'editStart' tool/studio.js tool/open-lock.js`), `tool/open-lock.js` (its two calls)
- Test: `tool/tests/guard-cases.js`, `tool/tests/studio.test.js`, `tool/tests/guard-open.test.js`, `tool/tests/edit-show.test.js` (a comment only)

**Interfaces:**
- Produces: `export function editStart({ checkout, node })` gives the one start `"<node>" "<checkout>/tool/edit.js"`, or null when either cannot be quoted. Its `quotedOnly` option is gone, and both of `open-lock.js`'s calls pass none. `plainPath` stays, since `shellWord` uses it for `behind`'s line.

Today the strict guard lets three spellings start a command: this Mac's node in double quotes (the skill's own since Phase 2), the word `node`, and the node's path bare when it is a plain path (the skill's own before Phase 2, so a folder written on 8 November holds it until its takeover). As built here both of the last two go (Open for Jason, 2). If Jason keeps the word `node`, only the bare path goes: `editStart` then gives `(?:node|"<node>")`, `quotedOnly` stays, and the rows for the word `node` below are left as they are.

Once this is on a Mac, a folder that still spells node bare is refused at every command, `behind` among them, so a chat there cannot even say that the folder is out of date. That is why check 42 comes first, on every Mac.

- [ ] **Step 1: Change the cases first.**
  - `guard-cases.js`: the `ALLOWED` row that starts with the word `node` is spelled again with the quoted start (`${EDIT} open "Talk (Sallie's laptop)"`) and stays allowed, since it is the one row whose quoted word holds brackets and an apostrophe. Every `strictOnly` entry made with `run("node")` or `run(NODE)` moves to that row's refused commands. `strictOnly` and `strictStartsOf` then hold nothing the open guard does not allow: take both away and use `openStartsOf` where they were used, and correct the file's header and the comments that speak of what "only today's guard lets through".
  - `studio.test.js`: "matches the checkout and node letter for letter" expects `deny` for the bare path and for the word `node`, and `allow` for `"${node}" "${checkout}/tool/edit.js" episodes`. Its two rows that prove a dot, a brace or a plus is matched as a letter are spelled again with the quoted node, so that they are still refused for that reason and not for their start. The refusal list gains `node "${CHECKOUT}/tool/edit.js" open x`. In "answers allow and deny as a PreToolUse decision", which runs the real hook, the command is spelled `"${process.execPath}" "${THIS_CHECKOUT}/tool/edit.js" episodes` (allow), and the same command with node bare is `deny`.
  - `guard-open.test.js`: "narrows a held chat the same way whichever spelling today's guard lets through" loops over the quoted spelling alone and is named for it; the filter that took the strict-only rows out goes.
  - Add `it("the skill's own line is still allowed on every kind of Mac")`: for a Homebrew node, an nvm node, the app's node in `/Applications` and in the home's Applications, and a home folder with an apostrophe, and for both locks, take the line after "exactly so:" from the files `studioFiles` writes, put `episodes` and then `behind` in place of its command, and assert `allow` from `guardDecision`, from `openDecision`, and through the real hook.
  - `edit-show.test.js`: the test that a pulled Mac with a bare folder is told it is out of date stays, with a comment that this is what Jason sees in Terminal, and that a chat in such a folder is refused.
- [ ] **Step 2: Run them, and see them fail.** `cd tool && node --test tests/studio.test.js tests/guard-open.test.js`.
- [ ] **Step 3: Change `editStart` and its callers**, and every comment and test title that describes three spellings (`grep -n 'bare' tool/studio.js tool/open-lock.js tool/tests/guard-cases.js tool/tests/studio.test.js tool/tests/guard-open.test.js`).
- [ ] **Step 4: Run** those two files, then the whole suite. Expected: pass, the refusals in zsh and bash included.
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the guard lets node through only as this Mac's own, in quotes`.

### Task 10: The rules after the rollout

**Files:**
- Modify: `CLAUDE.md`, `docs/wiki/macs.md`, `docs/memory/progress.md`, `docs/memory/decisions.md`, `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`

Needs: the three keys deleted (checks 29, 36 and 41). These are Jason's rules: he reads each line in the pull request before it merges.

- [ ] **Step 1: CLAUDE.md**, line for line, at about its present length. Every line not named here stays word for word, the installer's `--print` line among them.
  - Stack: "…and is started on each Mac by the launch agent `com.thebrimm.unedited`. BRIMM Video Studio.app installs it on every Mac but the Mac Studio, and its background job is that agent."
  - Run and test, added: "Claude runs `build-app.sh` and `release.sh` with `--print` at any time; a signed build, notarizing and a real `release.sh` only on Jason's yes in chat, each time; publishing with `cf` is Jason's own step." And: "How the tool works: `README.md`, "Unedited video". How a Mac is set up: `docs/setup/studio-app.md`."
  - Rules: "Never read a `.env` file. Only the Mac Studio runs Studio from git, and no Mac holds a deploy key. The update key, the signing identity and the notary login live only in Jason's keychain on the Mac Studio: never print, copy or ask for them."
  - Rules: "Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat first: on the Mac Studio, on Jason's MacBook, on Sallie's laptop, and for any install outside the app. On a Mac the app sets up after this rollout, the person's own click in the app is their yes. Claude never installs anything itself."
  - Rules, new: "Updates come only from signed builds on the feed. A Mac with the app is never updated by a pull, a copied file or a build that did not go through the feed."
  - Rules: "The Mac Studio is the one Mac in dev mode: its launch agent runs from Studio's main checkout, `~/Claude Code/brimm-video-studio`, and the app refuses to take it over. That checkout stays on `main`: work in git worktrees."
  - Rules: the by-hand line gains "Each step names the Mac and the account it is done in, and whose step it is."
  - "on either Mac" becomes "on any Mac", and the wiki's line for `macs.md` says "each Mac".
- [ ] **Step 2: `docs/wiki/macs.md`**: each laptop's section says when the app took it over, the build it runs as that stands, that it is on the beta channel, that its keys were deleted, and that its old clone is kept unused as a way back until Jason trashes it; "every other Mac will run the app's own copy" becomes "runs"; the Mac App By-Hand Checks page is named beside the Studio page.
- [ ] **Step 3: The notes, the spec and the build plan.** `progress.md`: Phase 8 as it stands, with what is left, and what became of the Studio page's old checks for her laptop (41, 43, 46, 47, 48 and 88). `decisions.md`: this phase's calls. The spec gains a dated "(Phase 8: …)" note at the places of items 3 to 7 under "Where the spec and the code disagree". The build plan's row 8 says twelve files and one setup document that also holds the lock-down checks, and its Verification's first line says that no fresh setup has run to its end.
- [ ] **Step 4: Run the whole suite.** Expected: pass (`old-installer-retired.test.js` reads CLAUDE.md and `macs.md`).
- [ ] **Step 5: Commit.** Message `Studio app phase 8: the rules and the notes after the rollout`.

**Part 3's end, in this order:** every chat in her folder closed on each Mac, and check 42 passed on all three; Task 9's pull request and Task 10's merged, each on Jason's yes; the Mac Studio's checkout pulled when nothing is at work, on his yes, and its own strict-lock check made; then check 43, 1.0.0-beta.5.

---

## Final check

- `cd tool && node --test` passes on the Mac Studio with `BRIMM_SPARKLE` set, with `contract.test.js`'s hashes unchanged, at the end of each part.
- `git grep -n 'move-app\|Move to Studio' -- tool README.md CLAUDE.md docs/wiki docs/setup` shows only `old-installer-retired.test.js` and its allowed lines.
- `gh api repos/jogden12/brimm-video-studio/keys` and `gh api repos/jogden12/brimm-video/keys` list none of 169196777, 169203726 and 167644050.
- Each laptop's `settings.js show`, pasted on the page, names the app's own copy as its checkout.

## By hand (on the Mac App By-Hand Checks page, each on Jason's yes)

The page holds each check's whole steps, and says at each step which Mac, which account and whose step it is. Checks 28 and 30 to 36 are Jason's, on his MacBook, in his own account; 38 to 41 are at Sallie's laptop, in her account, with Jason beside her. Claude's steps are on the Mac Studio. Everything pasted has the home folder written as `~` and the Dropbox folder as `<Dropbox>`.

28. **Before the MacBook's takeover.** Nothing changes. Nothing is at work; `settings.js show` and the settings file's hash, pasted; the BRIMM Video folder and its Episodes folder are there (`ls`); the job's program and watched folder; what the old installer left (the clone's commit and `git status --short`, the key's file names, the `Host` block's first line, the Desktop files); Homebrew's `node --version`; where Claude Code is and its version; Login Items and Files and Folders as they are; her folder's two feedback lines.
29. **brimm-video's key, 167644050, is deleted in GitHub** (it is a key of the brimm-video repository, and this closes the Studio page's check 48 on the GitHub side). It waits for nothing: her laptop has not run brimm-video since 8 November. Its files on her laptop go in check 41.
30. **1.0.0-beta.2 onto the MacBook**, downloaded in Safari from the feed's own address. macOS asks once; Move to Applications; then the copy in Downloads and its zip go to the Trash.
31. **The takeover**, after Jason's yes in chat. Before Install: every chat in her Claude folder is closed and the Claude app is quit; the drop folder holds nothing but its marker file (`ls -A`); nothing is being copied into it. Then: Welcome names the older copy; Apps goes on; each of macOS's questions names BRIMM Video Studio (page check 11's first half); Review shows the MacBook's own name and folders and "Moving to this app"; Install ends on Claude answering from the background job; the guide opens with this Mac's name, folders and version (page check 12). After Install: the import's log shows no run by Homebrew's node in that minute, or the page says what it took in; and a new chat is started by hand, since this build does not say so yet.
32. **What the takeover kept and changed** (the build plan's by hand 7). `settings.js show` from the app's own copy is check 28's but for the checkout; the job's program is the app's; `set-up.json` names build 2; her folder's skill spells the app's own programs in quotes, with feedback still off; Login Items and Files and Folders name BRIMM Video Studio (page check 11's second half); no check agent is left.
33. **A first video on the MacBook**, Jason's own test recording: the notice, the card in a Code tab session, and the log showing the app's own programs did the work. Then the test episode and its project go to the Trash.
34. **The update: page check 27**, to 1.0.0-beta.3, with page check 14 rewritten and done inside it: "update Studio" is said once with the app open on its status window (it comes forward on the check) and once with it quit (it opens on the check), which then waits for the stand-in import; the update's two sentences after the relaunch; Login Items and Files and Folders as before, with no new question.
35. **Page checks 13 and 15**, each after Jason's yes in chat, since each changes the job: a moved copy repairs itself; Uninstall stops the job and keeps the data; Repair brings it back.
36. **The MacBook's key**: deleted in GitHub (169196777), then its two files, the Desktop copy and the `Host github-brimm-video-studio` block removed, with the rest of `~/.ssh/config` left byte for byte. It may follow Part 2.
37. **1.0.0-beta.4**, from Part 2. Claude: `--print`, then on Jason's yes the signed build, notarizing and the release. Jason: the keychain's question, and the `cf` lines. Jason, on the MacBook: the update, and her folder's strict-lock check after it.
38. **Before Sallie's laptop's takeover.** As check 28, and first of all where her Claude Code is. If it is not in `~/.local/bin`, Claude Code's own copy is installed there on Jason's yes before the app is opened. Her settings' lock and teachings are noted, and which account the `claude` command is signed in to.
39. **Sallie's laptop: the newest build, and the takeover**, after Jason's yes in chat, as checks 30 to 32, with the same three things before Install. If teachings from sessions are on: after Apps and before Install, `claude auth status` shows the account that was checked, or teachings are turned off until it is. This build stops if BRIMM Video's folder is gone, and says to close the old chats.
40. **Her laptop, working.** Her folder's strict-lock check, made again in a new Code tab session, as the setup document's step says. HyperFrames there, read on screen: its agent on Auto, telemetry off, HeyGen signed in (the Studio page's check 43). A first video of Jason's own (check 46); its hand-off dropped on the BRIMM Ops page on her laptop (check 47), then taken off that page again with none of its text approved; then the test episode goes to the Trash.
41. **Her laptop's keys**: Studio's (169203726) deleted in GitHub; then on the laptop both keys' files, both `Host` blocks and the Desktop copy.
42. **Each Mac's folder spells its node in quotes**, before Task 9 is merged, on the Mac Studio and on each laptop, with every chat in that folder closed first: `grep -n 'exactly so' ~/"BRIMM Video Studio"/.claude/skills/brimm-edit/SKILL.md` shows the node in double quotes, and it is the node that folder's `.claude/settings.json` gives its guard. If a folder spells it bare: on a laptop, open BRIMM Video Studio and choose Repair; on the Mac Studio, on Jason's yes, its `settings.js studio` command as `docs/memory/gotchas.md` gives it.
43. **1.0.0-beta.5**, from Part 3. Before it is published, the MacBook takes it by hand from its stapled zip and passes its strict-lock check. Then Jason publishes it, each laptop takes it on his word, and it is the first update on Sallie's laptop: her folder's strict-lock check is made once more after it.
44. **The old clones and leftovers**, once Jason wants no way back, on his yes: `~/Claude Code/brimm-video-studio` on both laptops, brimm-video's clone on hers, the old installer's app, zip, report and log. To the Trash.
45. **The spike's two files on R2** are deleted with Jason's own `cf` lines (Phase 7's Open 6).

## Decided

These are this plan's rulings. Jason can overrule any of them.

1. **Three parts, four pull requests.** The build plan gives each phase one pull request. This phase waits twice on a real Mac, so each part merges when it is done, and the lock's change (Task 9) has a pull request of its own.
2. **The MacBook installs 1.0.0-beta.2 and updates to 1.0.0-beta.3**, as page check 27 was written. Its takeover runs the engine as released, without Tasks 2 and 3; the page's steps cover both (the old chats are closed before Install and a new one is started after; check 28 shows the folder is there). The first real takeover should not wait for a release.
3. **No code guards the old clone.** A clone on a laptop runs the old code it holds, so nothing built now can stop it taking the Mac back. The steps say never to run anything in it, and it goes to the Trash when no way back is wanted.
4. **`install.sh` changes by one printed line.** Its order on a takeover is left: if her folder cannot be written it ends with 1 after the settings and the job have moved. The Apps step asks for the same Claude Code first, so that is not expected, and check 32 reads her folder on each Mac.
5. **The two lines `install.sh` prints about "the setup guide's" checks stay as they are.** The guide they mean is `docs/setup/studio-app.md`, which now holds them.
6. **The retirement test reads the living documents and not history.** Old plans, specs, handoffs and dated lines of the notes keep their words.
7. **The old Dropbox account label and the absolute paths in older documents are not swept here.** They are outside this phase's files, and git's history keeps them either way.
8. **Phase 6's page check 14 is done inside check 34**, rewritten for a build that has updates.
9. **The sweep of "ask Jason" on an installed Mac stays its own session's work** (the branch `claude/upbeat-mcnulty-2713f1`, twelve commits, not on main). It is not built beside Task 9, since both change the guard's path. Its test will read this phase's new lines when it is brought up to main.
10. **Homebrew is left on both laptops.** Studio no longer uses it, and other things may.

## Open for Jason

Each stands at its recommendation until you answer.

1. **The channel.** A stable build is offered to every beta Mac and, once taken, moves that Mac off the beta channel for good: a build's channel is its own, not the Mac's. *Recommended:* both laptops run beta builds through this phase. That has a cost: a release is offered to Sallie's laptop the moment you publish it, so nothing but your word makes her wait. You take each new build on your MacBook by hand, from its zip, before you publish it, and she takes it when you say. A stable 1.0.0, and a channel that belongs to the Mac so that yours can stay on beta, are a small phase of their own afterwards.
2. **The word `node`.** Phase 2 planned to drop only the bare path. *Recommended:* drop the word `node` too, in the same reviewed change, so that the guard allows one spelling. On a laptop that still has Homebrew, the word would run the app's code under Homebrew's node, which is what the app exists to avoid. No skill writes it.
3. **Who says yes.** *Recommended:* your yes in chat before each laptop's Install click and before checks 35 and 44, and CLAUDE.md takes the spec's sentence (the person's own click) for later Macs, in Task 10.
4. **The old clones.** *Recommended:* keep each for about a week of ordinary use after its takeover, then trash it. Each key is deleted as soon as its laptop has passed, since going back needs the clone and not the key.
5. **Deleting the keys in GitHub.** *Recommended:* you delete them in the repositories' settings. Or Claude does it with `gh` on your yes for each, since `gh` on the Mac Studio is signed in as you; it cannot be undone.
6. **brimm-video's key now.** *Recommended:* yes, as check 29, before anything else.
7. **Claude Code on a Mac that has none where the app looks.** There is no pin, so the app cannot install it. *Recommended:* not in this phase. Check 38 looks on Sallie's laptop, and Claude Code's own installer is run there by hand if needed. The pin is needed before a Mac is set up by someone alone.
8. **An icon.** There is none, so macOS shows its plain one in Finder, the Dock, Login Items and every question it asks. *Recommended:* before Sallie's laptop, as Task 8, from a 1024-pixel picture you choose from the brand kit. The build already takes `tool/studio-app/AppIcon.icns` when it is there.
9. **When the sweep branch lands.** *Recommended:* after Part 3, as its own pull request from its own session.
10. **A fresh setup to the end.** No Mac has had one: both laptops are takeovers, and the spare account has no Dropbox. *Recommended:* not in this phase. It is the one proof still missing before the app goes to a Mac that never had Studio.
11. **The support address.** `admin@growwiththebrimm.com` is what every stopped setup and the guide tell a person to write to. *Recommended:* confirm someone reads it before Sallie's laptop.
12. **The spare account's name in committed documents.** The notes already say "Studio Test". *Recommended:* the new documents say "a spare account on the Mac Studio".
