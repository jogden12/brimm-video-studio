# Progress

Where Studio stands. Last brought up to date on 2026-11-11 (main at 268d10c). Dated lines say what was true then; check `git log` and the By-Hand Checks page before relying on them.

## Done

- **Studio forked from brimm-video** at the tag `brimm-video-v1` (2026-10-27). brimm-video keeps running wherever a Mac has not moved.
- **The build plan of 2026-10-27**: plan PRs 4 to 11 and 15 to 18 merged by 2026-10-29 (#6 to #21), then the by-hand fixes #22 to #34.
- **The HyperFrames-led path** (graphic cues, planned videos, footage parts and the join, explainers, the reference folder): #35, 2026-11-05, with by-hand checks 57 to 70.
- **The app's projects folder in Dropbox** (#37, 2026-11-06) and **her folder turning off `/feedback`** (#38, 2026-11-05).
- **Final Cut retired** (2026-11-06).
- **Phase 3, the local working folder** (#47, 2026-11-07); checks 94 to 100 passed on 2026-11-08.
- **The import folder access notice** (#48, 2026-11-08), in step with brimm-operations #43.
- **The Move to Studio app**, notarized; Jason's MacBook (check 80) and Sallie's laptop (checks 74, 41 to 45) moved to Studio on 2026-11-08. The Mac Studio moved on 2026-11-03 (check 40).
- **The Mac app, Phases 0 to 4** merged on 2026-11-09 (#53 to #57); spikes S1 to S4 and S7 passed. **Review fixes** #58 merged on 2026-11-10.
- **This memory system** (`docs/memory/`, `docs/wiki/`), 2026-11-10.
- **The Mac app, Phase 5 (the setup engine)** merged on 2026-11-10 (#61), and **its sign-in fix** (#62, c979291: macOS's `script` refuses node's pipes). In Studio Test on 2026-11-10: spike S5 passed (check 108; Claude Code signs in with no Terminal), S6 passed (check 109; the HyperFrames app runs, plays and exports on This Mac with no Homebrew), and Phase 5's check 3 passed (the setup's own sign-in takes a pasted code with a newline, the link comes through whole, and nothing is left running after a cancel). Check 3 found that the setup's sign-in was kept apart from Terminal's (no `USER`; see `gotchas.md`): fixed by #63 (8fbcc0a), and on 2026-11-11 check 4 passed (one sign-in for the setup and Terminal) and check 5 passed (`hyperframes open` opens the project once the app is past its welcome question). The Mac Studio's live checkout was pulled to 8fbcc0a the same day, and then to 268d10c. **The setup and the Getting Started guide say to answer HyperFrames' welcome question once** (#64, 268d10c, what check 5 found).

## In progress (2026-11-11)

- **The Mac app, Phase 6 (the app and its build)** is built on the branch `app-development-phase-6` (2026-11-11), to `docs/superpowers/plans/2026-11-09-studio-mac-app-phase-6-plan.md`: its fifteen tasks, a whole-branch review, and one wave of fixes for what the review found. It is pushed, as pull request #65, and not merged. By hand, on 2026-11-11: check 6 (the vendor build) passed on its first real run, and `build-app.sh` made its first real build the same day (the stand-in build, unsigned). Check 7 is under way: its first look at the windows found nine things, which Task 16 fixes (the stand-in let Continue through on the Apps page, a long page opened at its bottom, Done's buttons were cut short, a finished line still drew its bar, the stand-in's guide was a three-line sample, the page after Uninstall had no button and did not say it was a stand-in, the status window never offered the stand-in's guide, and a fault read as if it were about its step). Checks 8 to 15 are not done. The build's decisions are in the plan's "Decided", 23 to 46; the plan's nine open questions stand at their recommendations until Jason answers them.
- **A sweep of the lines that still name Jason, `install.sh` or node on an installed Mac**, in its own session.

## Next, and waiting on Jason

- **Sallie's laptop**: check 46 (a first video, Jason's own recording), 47 (the BRIMM Ops page on her laptop), 48 (delete brimm-video's old GitHub deploy key, on his yes), the open boxes of checks 41 and 43; check 88 was never confirmed.
- **The Mac app**: Jason's yes to merge Phase 6's pull request (#65); the Phase 6 plan's "Open for Jason" (the bundle ID, Claude Code's pin, the first version, the feed's address, ffmpeg's source zip, the Claude button, an icon, when to sign, a macOS CI job); Phase 6's by-hand checks, on the Mac App By-Hand Checks page (check 6 passed; check 7 is under way; checks 8 to 15 are not done); the Phase 5 plan's open questions that are still open.
- **Calls from the build plan**: `finish`'s NEVER_OPENED line on a Mac with the app off; whether `free` takes a Reel's video; a toolchain lock file; whether the "One Video, Start to Finish" page is retired.
- **The import notice**: item 3 ("I allowed it" → look); B1 at the next `brew upgrade node`; a signed helper later.
- **Her folder**: whether the open lock writes the feedback `env` (when an open lock is named).
- **Blocked**: plan PRs 12 to 14 (session videos) wait on A0 items 2 and 5 and on D5 with brimm-operations. Read `~/BRIMM Video Work/A0 app test/results.md` first.
- **Deferred minors** (final touches): a stray `.new` after a kill; `exports.js`'s own `plainName` copy; an empty `set aside/` after a failed move; an export only in an older `renders/`.
- **Carried forward for the Mac app**: Phase 6 ships the transcriber as `whisper-cli` and makes every zip with `ditto --norsrc --noextattr` (both in its plan); `install.sh` has no check of its own for a `:` in `--tools` (the engine refuses it); Phase 8 drops the bare `node` from `editStart`. (The retry cap after exit 75, the npm notifier, the docker line, the DAMAGED advice and the one `launchctl print` parser were done in Phase 5.)
- **Later**: remove the old Dropbox-wait code once Sallie's laptop has no episode from before the switch; `docs/setup/sallies-laptop.md` still describes brimm-video.

## Open from past reviews (harvested 2026-11-10)

Most serious first. Sources are in `gotchas.md`, "From past reviews".

- **High:** K0's by-hand list for the lock is still unchecked (folder trust, `--add-dir`, `/sandbox` "No sandbox", `failIfUnavailable`, two chats at once, forks, a Keychain item, `launchctl kickstart`, `osascript`). Only matters once an open lock is named, but nothing proves the lock there yet.
- **Medium:**
  - `lib.js`'s silence finder needs 5 s, so a shorter closing quiet is missed; it is a copy shared with brimm-operations, so the fix is its own PR in step.
  - Lock liveness is judged by pid alone (a reused pid can keep a check put off).
  - No "nothing has run for N hours" signal when the launch agent never woke (a restart before a drop leaves a video untouched, silently).
  - Nothing reads the HyperFrames app's own version: warn in `behind` when it changes, and keep an "after an app update" check.
  - Files copied by hand between the repos (`tool/shared/`, `lib.js`, `run.js`) and the Ops page's button words have no drift test; only the five v2 fixtures are hash-pinned (v1's are not).
  - The installed Mac's privacy list naming each program is proven only for the launch agent (S4); `access.js` depends on it.
  - A stopped setup stage can still rename a file mid-hash (Phase 5, Task 8 carried to 13). (`claude auth login` outliving a cancel was ruled out by check 3 on 2026-11-10.)
  - A session clip re-answered after its reading wrongly says to drop it on BRIMM Ops.
  - Retake detection has never been tested on real speech (only a synthetic voice).
  - Pin everything fetched at run time (the toolchain lock file call).
- **Low:** the remaining copied helpers; the `footage.js`↔`plan.js` cycle; the skill's line cap repeated in three tests; `edit.js` (about 7,600 lines) and `workOn`'s about 20 branches; the hand-off re-transcribing each export; "after HH:MM" past times and estimate nits; same-stem HEIC and JPEG sharing a project file; b-roll and screen parts can't be taken back after a join; an explainer's voice can't change after `plan new`; a failed join gives no next step; the guide keeps saying "drag the hand-off" after the page took it; a real-`launchctl` read in a Phase 5 test; README line 28 ("nothing on the PATH is used") is wrong; about 25 named test gaps in Phases 4 and 5 and about 70 in H7's Appendix A.
