# Gotchas

Mistakes made or nearly made on Studio, and how not to repeat them. Seeded on 2026-11-10 from Jason's project memory.

## The live Mac Studio

- **The Mac Studio's import runs from its main checkout.** Never `cd` into it or switch its branch: work in a worktree, and run that checkout's scripts by absolute path. Pull it (`git pull --ff-only`) only on Jason's yes, and only while no import or run is at work (check `status` and the pending folder first). After a pull that changes her folder's files, re-write it with `node tool/settings.js studio --node /opt/homebrew/bin/node`.
- **A new file in a drop folder starts the tool.** Never save test footage or originals in a drop folder (the default is `~/BRIMM Video Work/Drop`).
- **A dropped copy of the same recording becomes a new episode.** Studio has no delete command.
- **`brew upgrade node` loses macOS's Files and Folders answer**: Homebrew's node is ad-hoc signed, so its identity is its cdhash and its path is the versioned Cellar path. The launch agent then stopped importing with no word to anyone; #48 added the notice. Check it at the next upgrade (B1).
- **A folder written by older code is "out of date", not "changed"**: nothing changes until `settings.js studio` re-writes it, and a chat already open keeps its old settings.
- **A user-scope MCP server (`~/.mcp.json`) makes any Claude Code session under `~` write `.claude/settings.local.json`**, which Studio's strict-lock check flags. Add one only with `claude mcp add --scope local` in a project.
- **The HyperFrames app updates itself about six times a day**; its "Automatic updates" switch gates installing while away.

## The HyperFrames app

- **It never loads a project's `.claude/settings.json`**: only the project's notes, the app's own `--disallowedTools` and the user's `~/.claude/settings.json` apply there.
- **It transcribes every video it opens, in the cloud** (ElevenLabs' `scribe-v2`, in `.hyperframes/transcripts/`), even when `transcript.json` is there. A session clip must not be opened in the app.
- **Its agent may move the recording**: adding a 3-second title card, it set the a-roll to `data-start="3"`. Read the a-roll's placement from `index.html`; never assume the recording's clock is the timeline's.
- **Storyboard first**: the agent may put a change on its Storyboard and leave `index.html` alone until "Build the video", so an export before that lacks the change.
- **Going back**: asked to go back, the agent may remove a change with a new forward change, so `history --json` marks nothing undone. The project's rules point it to `hyperframes history undo --who claude`.
- **Its transcript says "Brim"**: the house spellings belong in `brimm/spellings.json` too.
- **Its exports land in `~/Downloads`**, which on the Mac Studio is a link into Dropbox.
- **`hyperframes open` opens a project only once the app is past its welcome question.** `"opened": true` means only that macOS's `open -b` handed the folder over. In a new account (spike S6, 2026-11-10) the app sat on "What do you want to make?" and only listed the project under "On this Mac, not imported yet". Past it (check 5, Studio Test, 2026-11-11), the app opened each project at once, whether it was quit or open on its home screen, and imported it as a link back to `~/BRIMM Video Work` (in `~/.hyperframes-studio`, its default projects folder), as on the Mac Studio. So the setup and the Getting Started guide say to answer it once.
- **With two copies of HyperFrames on a Mac** (one in `/Applications`, one in `~/Applications`, the same id), macOS picks which one `open -b` starts: in Studio Test it started the `/Applications` copy while the app was quit (check 5, 2026-11-11). Both share the account's settings and HeyGen sign-in.
- **The HeyGen command line never reads the app's sign-in**: only `HEYGEN_API_KEY`, `HYPERFRAMES_API_KEY`, `HEYGEN_ACCESS_TOKEN` or `~/.heygen/credentials`. The app needs a HeyGen sign-in on first run (spike S6).

## Pictures, sound and fonts

- **The Mac Studio's ffmpeg has no `zscale`.** HDR goes through VideoToolbox; frames from it skip ffmpeg's autorotate, so the chain must rotate after `hwdownload`. The frames leave labelled `bt2020nc` and match Apple's only through what ffmpeg does at the encoder: check any chain change against Apple's own still.
- **A working copy's key is the raw's size and time**, so copies made before a change to the look keep the old picture until they are taken away and made again.
- **fontsource's Josefin Sans woff2 files name their family "Josefin Sans Thin"**: use the Google Fonts TTFs wherever the app reads a font file itself (a brand kit).
- **The first caption can start at 0:00 in a silent lead-in**; `lib.js`'s silence finder only sees 5 s or more (fixed in #23 so captions never start in a silence).
- **Changing `normalWords` (`tool/handoff.js`) breaks every stored fingerprint** (`versions.js` `fingerprintOf`).

## Dropbox and Finder

- **Dropbox may bring back part of a trashed folder minutes later**: check a minute or two after a move to the Trash that the folder stays gone.
- **Free space**: the Move to Studio app's look under-counts (purgeable space); HyperFrames' doctor and Studio's guide said about twice as much.
- **On this macOS, `cp -X` and `ditto --noqtn` keep the quarantine flag**; only a redirect copy drops it. Zip with `ditto --norsrc --noextattr`, or `._` files get in.

## Signing and the Mac app

- **Signing on the Mac Studio (Command Line Tools, no Xcode) needed Apple's Developer ID G2 intermediate imported by hand.** Open Keychain Access from Apps; importing with iCloud selected hangs it (-25294).
- **The Move to Studio app clones Studio at the commit it was built from**: a code fix means rebuilding the app.
- **Claude Code keeps its sign-in in the keychain under the account's name, which it reads from `USER`.** An environment built from scratch must pass `USER` (and `LOGNAME`): the setup's `claudeEnv` had only `HOME`, `PATH` and `LANG`, so the setup signed in and read one keychain entry and Terminal another, and `claude auth logout` in Terminal left the setup signed in (check 3, Studio Test, 2026-11-10).
- **macOS's `script` exits at once when its input is a socket** ("tcgetattr/ioctl: Operation not supported on socket"). Node's stdio pipes are socketpairs, and on macOS a named FIFO is one too; a shell `|` pipe works. The setup's sign-in feeds `script` through `cat` and a shell pipe (#62, 2026-11-10).
- **The Code tab's `/status` shows no version** (Claude takes it as a question). The installer's print shows Claude Code's version.

## Git, CI and pull requests

- **CI runs that "fail" in about 50 s with 0 jobs are GitHub not starting them**: re-run.
- **Stacked PRs must be retargeted to `main` after each merge**; branches are not deleted on merge.
- **Each merge of main into a PR branch** regenerates `tool/tests/fixtures/today-says.json` (`cd tool && UPDATE_TODAY=1 node --test tests/edit-labels.test.js`, help-only) and updates the architecture spec's Status line.
- **The repo is public**: committed docs leave out the Dropbox account label, absolute local paths, client names, keys and tokens.

## Writing by-hand checks

- **Placeholders broke nearly every step** (2026-11-02): write each command whole, one action per step, with the exact output to expect or each possible output and what to do next.
- **Every command starts with the `cd` into Studio's `tool` folder**: `node edit.js` fails from the repo's top folder.
- **Say where output appears**: Studio's notices are Mac notifications titled "BRIMM unedited video" (hidden if Script Editor's notifications are off), never Terminal output; `guide "<video>" tell` waits in Terminal instead.
- **A video opened straight in HyperFrames is not an episode**: a check that needs one says how to make it from the drop folder.
- **Several sessions publish the By-Hand Checks page**: change only your own group, and re-read the live page before each publish. Subagents report their steps to the coordinator and never publish the page.

## From past reviews (harvested 2026-11-10)

Lessons from the repo's review notes, the 5 Nov team review, the Mac app reviews and the build ledgers (25 files). "Times" counts how often a finding came up. Open ones are also in `progress.md`, "Open from past reviews".

### Security and privacy

- **Lesson:** A guard on a client's material is checked at every later step (join, copy, move into `media/`), not only when the item arrives, and every guard fails closed.
  - **Why:** A footage part escaped the session hold once its match was answered later as a session, and was still joined and copied; `mayGoIn` was not fail-closed for a part in a conflicted episode. Fixed (`partHeld`).
  - **Source:** HyperFrames-led path ledger (2026-11-04). **Times:** 6.
- **Lesson:** Text built for Claude or Sallie (results, errors, logs, test pins) is cleaned of gated file names before it is built, with a leak test and a control.
  - **Why:** A failed join's result printed raw part names, and a test pinned the raw name. Fixed (`lateClean`).
  - **Source:** HyperFrames-led path ledger (2026-11-04). **Times:** 3.
- **Lesson:** `BRIMM_VIDEO_HOME` (or any override that moves state) gates the real home's sensitive places too, and a set-but-empty or relative value is refused, never quietly dropped.
  - **Why:** Its first version gated only the scratch copies of `~/.ssh`, Keychains and Dropbox: a Critical, found in review. A quiet fallback would point a test at live state.
  - **Source:** HyperFrames-led path ledger (2026-11-05); team review, reliability (2026-11-05). **Times:** 4.
- **Lesson:** A scratch-home test or check can still poke the real launch agent (`afterJoin` kickstarts `com.thebrimm.unedited`): keep tests away from it or say they touch it.
  - **Why:** H7's scratch joins kickstarted the live agent; harmless that time.
  - **Source:** `docs/superpowers/notes/2026-11-05-h7-findings.md`. **Times:** 1.
- **Lesson:** Claude Code's sandbox is not a secret store: test each layer (permission rules, sandbox, hook) on its own, and never take an environment variable, session id or process mark as proof of confinement.
  - **Why:** K0 found process arguments readable through libproc, the app's environment reaching every sandboxed command, hard links reading gated files, WebFetch reaching 127.0.0.1, a `Read()` deny not stopping `cat`, `nice`/`env -u` escaping, `SANDBOX_RUNTIME` removable, session ids rewritable by a hook, and no Glob/Grep tools in 2.1.308.
  - **Source:** `docs/superpowers/notes/2026-10-26-lock-k0-findings.md`. **Times:** 13.
- **Lesson:** A narrow `denyRead` of the tool's folders needs `allowRead` for its temp folder, shell snapshots and app data, or every `cat` and `node` fails; heredocs stay broken, so use the Write tool.
  - **Source:** lock K0 findings (2026-10-26). **Times:** 1.
- **Lesson:** Words withdrawn from BRIMM Ops are cleared in every copy (the second backup place, and Dropbox's version history by hand), and the withdraw tool says loudly when it stopped early.
  - **Why:** It returned early with no local `backups/` and exited 0 when the second place was unset; Dropbox keeps old versions 30 to 180 days. Fixed in the Ops round.
  - **Source:** review-changes ledger (2026-11-05/06). **Times:** 4.
- **Lesson:** Agent-written text in a project (HTML, words on the picture) is data, and a bare "yes" never confirms content she hasn't seen.
  - **Why:** The first `--yes` handed off words she never saw; now only shown lines are taken.
  - **Source:** build-plan ledger, PR 8 (2026-10-29). **Times:** 2.

### Data and records

- **Lesson:** Open any file another program or Dropbox writes the safe way: refuse links and named pipes, open non-blocking, `fstat` type and size before reading.
  - **Why:** Pipes or swapped-in links in a project, Downloads or history hung `guide`, `finish` and the words reader, or read past caps. Fixed with one shared helper.
  - **Source:** build-plan ledger, PRs 8, 10, 11, 15, 16 (2026-10-29). **Times:** 5.
- **Lesson:** Before deleting her files, re-check the path at the delete, compare by device and inode, recurse only into real folders, and refuse when the folder may hold the only copy.
  - **Why:** On the case-insensitive disk a folder named two ways lost a session clip's media; a project swapped for a link led `rm` into a decoy.
  - **Source:** build-plan ledger, PR 15 (2026-10-29). **Times:** 3.
- **Lesson:** Order versions by the shared record's listing, never by file times or a Mac's clock, and a late check never re-puts a record another Mac wrote in the window.
  - **Why:** Two Criticals: a Mac behind Dropbox deleted the other Mac's newer snapshot; a late check put a hand-off back over another Mac's spelling.
  - **Source:** build-plan ledger, PRs 9 and 11 (2026-10-29). **Times:** 3.
- **Lesson:** Never delete-then-copy, and check before moving: build the new beside the old, swap, put the old back on failure, and say truthfully what is where.
  - **Why:** A failed hand-off clone left no hand-off; set-aside work sat only under `set aside/` while she read "nothing was deleted"; `plan … set` wrote files ahead of a refused record.
  - **Source:** build-plan ledger (PRs 9, 11, 18); HyperFrames-led path and review-changes ledgers. **Times:** 8.
- **Lesson:** A new record layout uses a version older code reads as "newer, leave alone", checked against the real old code.
  - **Why:** At layout 4 the old import reused a plan's folder and deleted its `record/`; plans stay at layout 5.
  - **Source:** HyperFrames-led path ledger (2026-11-03 to 05). **Times:** 4.
- **Lesson:** Resolving a conflict rewrites everything that follows from the kept record (the plan's files, history), files first and record last, setting old files aside.
  - **Why:** After `resolve --keep B` the teleprompter kept A's text; a conflicted plan was a dead end.
  - **Source:** H7 findings; HyperFrames-led path and review-changes ledgers (2026-11-04 to 06). **Times:** 5.
- **Lesson:** Don't apply a Dropbox-damage size check to a file a person edits by hand.
  - **Why:** A mark typed in TextEdit autosaved into `teleprompter.txt` and made the plan "Not right". Fixed: her script opens as a copy.
  - **Source:** H7 findings; team review (ux, reliability, arch, 2026-11-05). **Times:** 4.
- **Lesson:** Rewording display text never changes a stored or matched string, and exceptions are decided by file or field, never by matching a printed sentence.
  - **Why:** Status steps are stored and read by older code; R5's script exception matched `problem.startsWith(…)`, which R4c's rewording would have broken.
  - **Source:** review-changes ledger (2026-11-05/06). **Times:** 5.
- **Lesson:** Transcript and cue times are on the timeline's clock, and a cue whose anchor is cut is placed by its own words, at every site that places it.
  - **Why:** A 3 s title card made every line 3 s early; cue placement repeated at three call sites needed a parity test.
  - **Source:** build-plan ledger (2026-10-30); HyperFrames-led path and Final Cut ledgers. **Times:** 6.
- **Lesson:** Give the app's agent whole cut ranges by time, not word ids.
  - **Why:** Pause cuts have no word ids, so the opening never reached `cut-suggestions.json` (check 77); a first fix cut missed speech, so it was bounded to under 1.5 s.
  - **Source:** check-83 ledger; review-changes ledger (2026-11-06). **Times:** 3.
- **Lesson:** Whisper invents closing phrases in quiet tails, so ownership of the last stretch of sound is decided explicitly, case by case.
  - **Why:** The closing-words fix took three rounds (a real "Bye." after a breath, a long caption starting early, a word at the edge). Merged as #43.
  - **Source:** review-changes ledger (2026-11-06). **Times:** 3.
- **Lesson:** Start a word halfway into the transcriber's time, never earlier than its cut-plan phrase, and keep `-nfa` (flash attention silently drops DTW times).
  - **Why:** Words after a pause started in the pause (median 0.12 s, p90 0.44 s); A0 had measured the `.srt` path, not Studio's DTW one.
  - **Source:** `word-times-findings.md` (2026-10-28). **Times:** 1.
- **Lesson:** Match a stored item (an export, a late-wait entry) by identity and time, never by name or size alone.
  - **Why:** An old export in Downloads blocked a second finish or went out stale; late-wait entries matched by size only.
  - **Source:** build-plan ledger (PR 7); review-changes ledger. **Times:** 4.
- **Lesson:** Settings that name a checkout never decide which code runs: resolve from the running file (`thisCheckout()`).
  - **Why:** Detached runs launched brimm-video's `edit.js` (help, exit 2, no lock) and records named the wrong commit (#22).
  - **Source:** build-plan ledger (2026-10-30). **Times:** 2.

### Architecture

- **Lesson:** One place answers each question (a refusal sequence, a name, a path, a parser); a copy gets a drift or parity test.
  - **Why:** Repeated copies: `joinFor`/`joinRun`, two `plainName`s, two `launchctl print` parsers, `modelPath`, `ruleOpts`, `writerOf`, `secureLink`, `thousandth`, `MOST_OFFERS`, `bareFileName`.
  - **Source:** every ledger; Mac app reviews; H7 findings. **Times:** 20.
- **Lesson:** Every mode-dependent line that names a program, a person or an install step goes through one helper (`lookerOf`, `repairLine`, `forThisMac`).
  - **Why:** About 15 lines named node, Jason or `install.sh` on an installed Mac (#58); about 20 more still do.
  - **Source:** Mac app review findings and fixes (2026-11-09/10). **Times:** 4.
- **Lesson:** Break import cycles when they are made, by moving shared helpers to a leaf module; a module two others need never imports `edit.js`.
  - **Why:** `footage.js`↔`plan.js`, `reel-candidates.js`↔`reels.js`; `app.js` can't import `edit.js`.
  - **Source:** HyperFrames-led path and Final Cut ledgers; review-changes plan. **Times:** 7.
- **Lesson:** When a feature is deleted, move the kept parts' tests first and pin the kept exports.
  - **Why:** F7 had to move `ask`'s kept tests (the only cover of `makePreviews`' sound map) out of a file it deleted; three kept branches lost tests until review.
  - **Source:** Final Cut retired ledger (2026-11-06). **Times:** 4.
- **Lesson:** Re-check a plan against the newest main before building, and drop tasks a merge already did.
  - **Why:** Phase 5's plan ignored #58: Task 3 would have duplicated the access-wording API.
  - **Source:** `phase-5-plan-review.md` (2026-11-10). **Times:** 2.
- **Lesson:** A safety check fails toward "busy", never "idle", on error.
  - **Why:** `busy.js`'s catch-all and stdin read answered idle; Importants, fixed.
  - **Source:** Phase 4 ledger; Phase 5 plan review. **Times:** 3.
- **Lesson:** `busy.js` checks every folder a lock can live in, by its exact name (16 hex), not a wildcard.
  - **Source:** Mac app review findings and fixes. **Times:** 4.
- **Lesson:** Rules the app's agent must obey go in the project's notes, and one owner makes each thing (Studio makes Reels; the notes tell the agent never to).
  - **Why:** The app put its own Reel project in `~/.hyperframes-studio` with a whole-original copy; settings deny rules were inert there.
  - **Source:** build-plan ledger (PR 5); HyperFrames-led path ledger; team review. **Times:** 7.

### Testing

- **Lesson:** Write the failing test first and show it failing on the old code; a test that passes at once is a pin, not a fix.
  - **Why:** Builders wrote code first again and again; several new tests passed on the base because the path could not produce the new words. Mutation and revert checks proved real coverage.
  - **Source:** every ledger (2026-10-28 to 11-10). **Times:** 40+.
- **Lesson:** Mutation-check each risky rule (remove it, see a test fail); reviewers run new tests against a copy of the old code.
  - **Why:** Mutation runs found unpinned rules in PRs 9, 11, 16 and H4 (62 mutants).
  - **Source:** build-plan and HyperFrames-led path ledgers; Mac app reviews. **Times:** 8.
- **Lesson:** Test the real path she takes, not an inner function that only fires in a race, and never write "no run can reach this" without trying.
  - **Why:** R1d's `notWholeYet` showed only in a race; a "unreachable" `NEWER` wrap in `finish.js` was reproduced.
  - **Source:** review-changes ledger; Mac app review fixes; build-plan ledger. **Times:** 5.
- **Lesson:** `guard.test.js` and other timing tests flake under load: re-run the file alone before believing a red.
  - **Why:** The SIGHUP/SIGTERM watchdog test failed under load many times (once on CI) and passed alone every time.
  - **Source:** build-plan, HyperFrames-led path, review-changes and Final Cut ledgers. **Times:** 14.
- **Lesson:** Stand-ins don't cover the real programs: list what is owed by hand (real ffmpeg, `sips`, the app, the launch agent) and run it.
  - **Why:** H7 and Phase 1's real runs found what the suite couldn't.
  - **Source:** every ledger; team review, reliability. **Times:** 8.
- **Lesson:** No test reads the real temp folder, home, `launchctl` or installer environment.
  - **Why:** `printOnly` set no HOME (Important, fixed); a real-`launchctl` check is still open on Phase 5.
  - **Source:** Mac app review fixes; Phase 5 ledger. **Times:** 3.
- **Lesson:** A test's title says what it asserts, and a test that compares code with itself pins nothing.
  - **Source:** every ledger; H7 findings. **Times:** 11.
- **Lesson:** The coordinator runs the whole suite on the final commit after each merge and compares counts.
  - **Why:** A merge-resolution slip was caught only by another PR's tests.
  - **Source:** build-plan ledger; Phase 4 and review-fixes ledgers. **Times:** 9.

### Deployment

- **Lesson:** When Studio and BRIMM Ops share words (the guide's quotes, button names), change both in the same step and publish together.
  - **Why:** Studio's guide quoted a button the published page didn't have yet; R4a's rename needed a matching Ops commit.
  - **Source:** review-changes and HyperFrames-led path ledgers; build-plan ledger. **Times:** 20.
- **Lesson:** Merge one PR at a time, merge main into the next, regenerate generated files, rerun the suite, and check the final tree equals the tested head.
  - **Why:** PRs 8 to 11 clashed in README, plan, spec and `edit.js`.
  - **Source:** build-plan ledger (2026-10-29, 11-02). **Times:** 5.
- **Lesson:** The auto-mode classifier may block a pull on a live Mac as a production deploy: wait for Jason's own run.
  - **Source:** HyperFrames-led path ledger (check 69). **Times:** 1.
- **Lesson:** The app's Export dialog starts on Cloud since its 4 Nov update: tell her to pick "This Mac" right before exporting.
  - **Source:** HyperFrames-led path ledger; team review (ux, reliability, flow). **Times:** 5.

### UI (her words)

- **Lesson:** Every line she reads is true at that moment: no promise of a retry that can't help, an action the gate refuses, a time already past, or "being made" when nothing started.
  - **Why:** 12+ fixes in the build plan alone; "ready about 17:06" opened at 17:17 because it ignored the late check.
  - **Source:** build-plan, HyperFrames-led path and review-changes ledgers; team review; H7 findings. **Times:** 25.
- **Lesson:** Say what happened and what she can try; "Ask Jason" only where nothing is hers to try, never raw JSON or builder words ("late check", "Not right").
  - **Source:** team review (ux); H7 findings; review-changes plan and ledger. **Times:** 11.
- **Lesson:** Never print a path or a command for her to type: give her the phrase to say.
  - **Source:** HyperFrames-led path ledger (`refs use`). **Times:** 2.
- **Lesson:** Ask each question once and check every state has a way forward (brute-force the guide's states).
  - **Why:** "Session?" was asked up to three times and "Done?" up to five; brute-force runs found stages with no next step.
  - **Source:** team review (flow, ux); build-plan ledger. **Times:** 6.
- **Lesson:** A by-hand check's words match what the code really prints: run it against real output before publishing the page.
  - **Source:** every ledger; H7 findings. **Times:** 7.

### AI and prompting

- **Lesson:** Card order and card text come from Studio's own output, not the model's paraphrase: the skill asks a card again exactly as printed and never rewords a declined one.
  - **Why:** The chat improvised after a declined card, ran `footage` before the not-a-session card, called drop times "filming times", and wrote "Reel" for "real".
  - **Source:** team review (ux, reliability, arch, flow); H7 findings; review-changes plan. **Times:** 10.
- **Lesson:** Keep the skill's rows short and cap them by characters, from one shared constant; each command on one line.
  - **Why:** The line cap was raised four times (to 270) and is repeated in three tests; a multi-line command was refused by the guard.
  - **Source:** every ledger; review-changes plan. **Times:** 8.
