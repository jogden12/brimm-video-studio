# Full handoff for a new session: BRIMM Video Studio, and what the late-check work leaves

- **Date:** 2026-10-27, evening.
- **From:** the session "The shorter wait: reading during the late check (D3)", which built D3 as far as Task 9 of 16 and was then told to stop for the redesign. It works from the worktree `/Users/jasonogden/Claude Code/BRIMM video/.claude/worktrees/late-check-overlap-build-7f23d3`.
- **For:** the new session that continues, whether it starts BRIMM Video Studio or picks up brimm-video's open work.
- **Nothing here is acted on without Jason's yes** where a step says so. This repo's `CLAUDE.md` rules hold, every one (section 6).
- **What this document is:** this cover (sections 1 to 7, what happened to the late-check work and where everything is), then two appendices copied verbatim: **Appendix A**, the studio handoff of `claude/zealous-bell-esuqck`; **Appendix B**, the retirement note of the late-check work.

## 0. Read in this order

1. This cover, sections 1 to 7.
2. **Appendix A**, the studio handoff, and the design documents its section 0 names (read them with `git show`; they change nothing).
3. Appendix B only if you touch the late-check work (sections 3 and 4 say whether you should).

## 1. Where things stand (27 Oct 2026, evening)

- **The redesign is accepted.** The HyperFrames app does the editing; BRIMM Video Studio (a new repo, `brimm-video-studio`) keeps intake, the on-Mac transcript, the project maker, client sessions and everything BRIMM Ops needs. Appendix A has all of it.
- **brimm-video keeps running for Sallie** until the Studio replaces it, on Jason's yes. The launch agent `com.thebrimm.unedited` runs `tool/unedited.js` from the main checkout, which stays on `main` (42a39a3, tagged `brimm-video-v1`). Nothing in this cover changes what runs there.
- **Every brimm-video session was told to stop and save WIP.** Per the redesign session's own report, all local branches were pushed as `archive/2026-10-27/*` and nothing is left only on the Mac Studio. Verify with the read-only commands of Appendix A, section 3, part A, before you rely on it.
- **Open pull requests, left as they are** (no new pull requests; Jason merges, one at a time, merge commits): #46 D9, D10, D11 (versions of a session, the CLAUDE.md rule, the one-file refusal); #47 and #49 phase V's pure tasks (the draw list and render's ffmpeg; fine edits); #48 lock K1's lab fixes.
- **Open for Jason:** A0, the HyperFrames app test, by hand (`docs/phase-a0/checklist.md` on the design branch); where the Studio repo is made and when (Appendix A, section 6); the name clash between Sallie's folder `~/BRIMM Video Studio` and "HyperFrames Studio"; D7 (which logo, the fonts), Q2 (word edges), Q4 (match looks by eye), and what Sallie wants OpenRouter for.
- **The account's monthly spend limit was hit on 27 Oct** during the late-check build: the opus subagent was refused first (Task 8), a sonnet one worked for two more tasks, then sonnet was refused too (Task 10). The weekly limit resets at 7pm America/New_York. Check before you start a large job; nothing was routed around it.

## 2. The late-check work (D3) in one paragraph

Sallie's note 3 (25 Oct) asked to shorten the 15-minute wait between a raw video's import and Claude's reading of it. That wait is the import's Dropbox late check, which holds the reading. Jason's decision D3 (27 Oct): let Claude's reading and the rough cut run during the check and hold back only the final write into Episodes; leave the check itself alone. A design (`claude/late-check-overlap`, 82a60cb, 39 tests) and a 16-task plan were written and built by subagents, test first, to Task 9. Jason then **retired it with the redesign, but documented** (his words, 27 Oct), and asked that **Tasks 1 to 4 be completed**, which is what section 3 reports.

| Part | Where | State |
|---|---|---|
| **Tasks 1 to 4**: the groundwork that stands alone | branch `claude/late-check-groundwork` (4e4df21), from main 42a39a3 | **Complete, suite green, no PR open** (section 3) |
| Tasks 5 to 9: the reading overlap itself | branch `claude/late-check-overlap-build-7f23d3` (6bd9b7a) | **Retired, never to be merged as it stands** (section 4) |
| Tasks 10 to 16: the other Mac's rules, stop notices, `kind`/`status`/guide words, docs, final review | not built | **Retired** |
| The design and the plan | on the retired branch, `docs/superpowers/specs/2026-10-25-brimm-video-reading-during-late-check-design.md` and `docs/superpowers/plans/2026-10-27-reading-during-late-check.md`, each with a status line | documented |

## 3. Tasks 1 to 4: completed, and what to do with them

**Branch `claude/late-check-groundwork`**, pushed, six commits on top of main 42a39a3 (`git log --oneline origin/main..origin/claude/late-check-groundwork`). Full suite: **3749 pass, 0 fail** (`cd tool && node --test`, about two minutes; main alone is 3718, so 31 tests are new). No pull request is open.

| Commit | Task | What it does |
|---|---|---|
| aa8c5c9 | 1 | `importHold` says its `state` (`running`, `due`, `owed`, `stopped`, `failed`, `problem`, `""`) and takes an `importing` input; its `why` and `waits` are byte for byte as before, so `ask` and `--from-plan` read what they read. `tests/episodes.js` stubs `agentRunning` so no test calls `launchctl` |
| f612f59 | 2 | `importing.js`: `statusesOf`, `isStatusFileOf`, `dueOf` (a status's `due`, only when a finite number); `statusFault` unchanged |
| 893222d | 3 | the import's "Waiting for its late check" status carries `due` (the check's time, in milliseconds); **the per-minute timer also makes late checks that have come due while another video imports** (before, a long import held the first video's check until it ended); the loop passes over a drop file that a check took out, instead of importing or failing it |
| ef9c4ec | 3 | a late check that throws inside that timer is logged, not thrown (an uncaught throw in a timer would end the import in the middle of another video) |
| 3f73538 | 4 | `progress.js`: `addRates`, the rates file written through a name of the process's own and read again before writing (two writers at once used to be able to lose every rate) |
| 4e4df21 | 1 to 4 | the review's minor findings: the timer's log line gives only an error's code and says the next run makes the check again; `statusFault`'s comment names `due`; the rates test pins the file left; `importHold`'s state is pinned with its import at work over a running, failed, problem and stopped hold |

**What Sallie sees:** nothing new. The live gain is that a video's late check is made on time even while a long video imports, and the rates file can no longer be lost. Tasks 1 and 2 and the `due` field are groundwork that nothing in live code reads yet; they are what a revived reading overlap would stand on. `LATE_CHECK_MS`, `lateCheck`, `finishLate` and `dropbox.js` are untouched (`git diff origin/main -- tool/dropbox.js` is empty).

**Review:** Tasks 1 to 6 were reviewed together, read-only, by a fresh reviewer: approved, no Critical or Important finding (`review-batch-1-6.md` in the notes folder). Its minor findings for Tasks 1 to 4 are fixed in 4e4df21.

**Next steps, each on Jason's yes:**

1. **Open a pull request** from `claude/late-check-groundwork` into brimm-video's `main`. Jason merges, one at a time, with a merge commit; the main checkout is pulled only on his yes. The body: the table above, the 3749-pass suite, and that the launch agent runs only what is on its checkout, so nothing changes on the Mac Studio until he pulls it.
2. **Decide where it lands.** brimm-video's `main` is what Sallie's Mac Studio runs, so the timer fix helps her at once. The Studio repo is to be made from the tag `brimm-video-v1` (42a39a3, Appendix A section 6), which does not have these commits: after the merge, bring them into `brimm-video-studio` (a cherry-pick of the six commits, or its merge of brimm-video's `main`). Under the handoff's section 5 table, `filing.js`, `importing.js`, `unedited.js` and `progress.js` are all **kept**, so the changes belong there too.
3. A new session may keep these six commits as they are: the commit messages start "Reading during the late check:" and "Late-check groundwork:".

## 4. Tasks 5 to 9: on the retired branch, and what to do if they are ever revived

- **Branch `claude/late-check-overlap-build-7f23d3`** (6bd9b7a on origin; also under `archive/2026-10-27/` at an earlier commit). It holds Tasks 1 to 9 as they were built, the plan, the design copy and the retirement note (`docs/superpowers/retired/2026-10-27-reading-during-late-check.md`, Appendix B). Its suite passes (3841), but **do not merge it or run it**: without Task 10 the final write on the Mac that did not import is weaker than today (a one-look gap in the importing Mac's status lets it through).
- **Tasks 5 to 9** are `timelineFor` taking the kept captions and words (`timeline.js`, which the handoff retires), `overlap.js`, the reading asking Claude at once with only the final `intoEpisode` waiting, the inputs taken once and compared before the write, and the rough cut made again when the video came back. They serve the raw reading and the rough-cut render, whose place before the HyperFrames project exists is Jason's call. Under the handoff's section 5 table the whole of D3 is **unsure**; Tasks 1 to 4 are the part to keep.
- **To revive it**, only on Jason's yes: finish Tasks 10 to 16 of the plan in order. Task 10's algorithm is in `task-10-context.md` in the notes folder (keep `latestDue` and `previous`, set `previous = result.seen` at every look with null included, wait 90 seconds after a look that met rules 1, 3 and 4, treat an unreadable status file as a running import, judge rule 4 by size). Then the read-only review of every write path, the whole suite and the pull request. Things the build found, so you need not find them again:
  - the design's line numbers are those of `acec307`: find a function or test by name;
  - the guide already shows a live raw reading as "later", which the plan replaces with "running" carrying a time and a new "stopped" state;
  - tests pin `read`'s start arguments exactly (`edit-kind.test.js`, `edit-corrections.test.js`), `noticeOf`'s shape (`studio.test.js`), and the skill sentence in `SKILL.md` and its twin `SKILL-open.md`;
  - `tests/episodes.js` needed an `agentRunning` stub; `guideReading` runs on every `guide wait` look, so do not call `launchctl` there unless a pending check exists.
- **Deferred minor findings of Tasks 6 to 9:** `overlap.js` should default its array arguments to `[]`; the final compare's failure words repeat "so what Claude read was not put in." beside the shared "What Claude read was not put in."; a failed rough-cut remake leaves the first render in `~/BRIMM Video Work` (not in Dropbox, not in the record).

## 5. Where everything is

| What | Where |
|---|---|
| This worktree | `/Users/jasonogden/Claude Code/BRIMM video/.claude/worktrees/late-check-overlap-build-7f23d3`, now checked out on `claude/late-check-groundwork`; the retired branch is a ref, not a checkout |
| The main checkout (the launch agent runs it) | `/Users/jasonogden/Claude Code/BRIMM video`: do not switch its branch, commit on it, or pull it without Jason's yes |
| The studio handoff and its design documents | branch `claude/zealous-bell-esuqck` on origin (read with `git show`, Appendix A section 0) |
| The late-check design and plan | on the retired branch (section 2's table) |
| Session notes of the late-check work | `/Users/jasonogden/Library/Application Support/Claude/side-session-notes/local_3cfbe129-2310-4d94-9f78-c4977c732a2a/`: `late-check-overlap-handover-2026-10-27.md` (the stop-time hand-over), `late-check-overlap-reverify-2026-10-27.md` (every line of the design checked against main), `late-check-overlap-sdd/` (the ledger, the task briefs, every implementer's report, the batch review, the controller's rulings), and this document |
| Sibling notes of the same project | `.../side-session-notes/local_9c1cd33f-0347-4f7e-9a0e-463d48af2d9c/` (the demo runbook, the guide recon, Sallie's notes triage, the redesign reviews) |
| Jason's decisions and the project memory | `/Users/jasonogden/.claude/projects/-Users-jasonogden-Claude-Code-BRIMM-video/memory/` (`MEMORY.md` is the index): `studio-redesign-2026-10-27`, `decisions-2026-10-27`, `late-check-overlap-retired-2026-10-27`, `merge-when-green-2026-10-25`, `main-freeze-2026-10`, `mac-studio-video-setup` |
| Requirements | `docs/requirements.md`: Jason's preferences win over Sallie's comments |

## 6. Rules that still bind (the repo's `CLAUDE.md`)

- The tool drafts. It never posts, sends or publishes anything, and nothing in the repo may add that.
- Never read a `.env`. The project's one secret is the read-only deploy key on Sallie's laptop, kept only in her `~/.ssh`.
- Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat first.
- A failing test first, then the code.
- The launch agent `com.thebrimm.unedited` runs `tool/unedited.js` straight from the main checkout: keep that checkout on `main`, work in git worktrees.
- Experiments never write into the watched Dropbox folder: a new file there starts the tool.
- Final Cut Pro's library for the tool is in `~/BRIMM Video Work`.
- `install.sh` is only ever run with `--print`, unless Jason has said yes in chat. No test calls the real `claude`: a stand-in says what it would print. `tool/shared/`, `tool/lib.js` and `tool/run.js` are copies from brimm-operations, kept in step by hand.
- Merges are Jason's, one at a time, merge commits; stacked branches are retargeted before a base is deleted.
- Commit messages end with a blank line and the `Co-Authored-By:` line the session's reminder gives.

## 7. How the late-check work was run (for a session that wants to repeat the method)

A plan with tasks of test names and exact strings, run by one fresh subagent per task (sonnet; opus for the delicate restructure until it was refused), a ledger file recording commits and rulings, a read-only reviewer for a batch of the small tasks, and the controller reading each risky diff itself. The suite is `cd tool && node --test` (Node 22, no packages, about two minutes). Subagents must not run in parallel on one worktree, and each must be told never to touch the main checkout.

---

# Appendix A: the studio handoff, verbatim

Copied unchanged from `origin/claude/zealous-bell-esuqck:docs/handoffs/2026-10-27-brimm-video-studio-handoff.md` (branch tip 4915c32 when this document was made). Where it says "Appendix" or a section number of its own, it means its own sections.

# Handoff: from brimm-video to BRIMM Video Studio

- **Date:** 2026-10-27.
- **From:** the design session in Claude Code on the web, branch `claude/zealous-bell-esuqck` of `jogden12/brimm-video`.
- **For:** every Claude Code session working on brimm-video on the Mac Studio, and the new session that starts the redesign.
- **Nothing here is acted on without Jason's yes** where a step says so. This repo's `CLAUDE.md` rules still hold, every one.

## 0. Read the documents without changing your checkout

The documents are on the branch `claude/zealous-bell-esuqck`, not yet on `main`. Read them with `git show`, which changes nothing:

```
git fetch origin claude/zealous-bell-esuqck
git show origin/claude/zealous-bell-esuqck:docs/handoffs/2026-10-27-brimm-video-studio-handoff.md
git show origin/claude/zealous-bell-esuqck:docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md
git show origin/claude/zealous-bell-esuqck:docs/requirements.md
```

They are:
- **The design**, accepted by Jason on 2026-10-27, every decision answered: `docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`.
- **Jason's words,** recorded as he wrote them: `docs/requirements.md`, under "Decisions", the entries of 2026-10-26 and 2026-10-27.
- **The architecture of 2026-10-26:** `docs/superpowers/specs/2026-10-26-claude-video-editing-architecture.md`. The design of 2026-10-27 wins where they differ; its decisions still stand.
- **H0, the render test:** `docs/phase-h0/`. It stopped after step 4. What it showed still holds: HyperFrames runs on the Mac Studio, and Josefin Sans works in it.
- **A0, the HyperFrames app test,** for Jason to run by hand next: `docs/phase-a0/checklist.md`.

## 1. What changed, in one paragraph

**The editing moves to the HyperFrames app** (HeyGen's HyperFrames Studio, a Mac app, with Claude Code as its agent and a BRIMM brand kit). That covers cuts, captions, titles, lower thirds, graphics, Reels and versions.

**The new application, BRIMM Video Studio** (repo `brimm-video-studio`), keeps the rest:
- **intake:** the drop folder, the question of what a video is, privacy, filing in Dropbox;
- **the on-Mac transcript** with word times;
- **making the app's projects** (`npx hyperframes open`);
- **client sessions;**
- **everything BRIMM Ops needs** (section 4).

The 2026-10-26 plan's own renderer, edit record, brand kit in the repo, ffmpeg overlay path and versioning are dropped. So are brimm-video's Reel making, graphics commands and rough-cut render, once the app path is proven.

## 2. If you are a session already working on brimm-video

1. **Stop at the next safe point.** Start nothing new.
2. **Save your work on your own branch:**
   - Run `git status` first. Never add a `.env`, a key, or a big media file.
   - Commit, with "WIP:" at the start of the message.
   - Push your branch: `git push -u origin <your branch>`.
   - Never commit to `main`, never merge, and open no new pull requests. Leave open ones as they are.
3. **Reply to Jason:**
   - your branch, and your worktree's path;
   - what you were doing, and how far you got;
   - whether it is **kept**, **retired** or **unsure** under the table in section 5.
4. **Then stop.** Do not change `main`, the launch agent `com.thebrimm.unedited`, Sallie's laptop, or anything in Dropbox.

## 3. Save brimm-video as it is, pushed or not (with Jason's yes)

The brimm-video now on the Mac Studio keeps running for Sallie until BRIMM Video Studio replaces it, on Jason's yes. Some of its work may not be on GitHub yet, so this saves everything first, then marks what runs. One session does it, or Jason by hand. Every push here needs his yes.

`REPO` is the checkout the launch agent runs. Change it if it is elsewhere.

```
REPO="$HOME/Claude Code/BRIMM video"
git -C "$REPO" fetch origin
```

**A. See what is not on GitHub** (this reads only):

```
git -C "$REPO" status --short --branch
git -C "$REPO" worktree list
git -C "$REPO" for-each-ref --format='%(refname:short)  ->  %(upstream:short) %(upstream:track)' refs/heads
git -C "$REPO" log --branches --not --remotes --oneline --decorate
git -C "$REPO" stash list
git -C "$REPO" worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r w; do echo "== $w"; git -C "$w" status --short --branch; done
```

Write down what each prints. A branch with no upstream, or "ahead", has commits only on this Mac. A worktree whose status lists files has work not committed.

**B. Commit the work in each worktree.** A worktree's own session does this (section 2). For a worktree whose session is gone, Jason looks at its `git status` and says yes, then:

```
git -C "<worktree>" add -A
git -C "<worktree>" commit -m "WIP: saved before BRIMM Video Studio (2026-10-27)"
```

Never do this in `$REPO` itself. Its `.claude/worktrees/` hold other checkouts, and the launch agent runs it on `main`.

**C. The main checkout's own uncommitted changes, if part A showed any.** Do not commit them and do not switch its branch, since the launch agent runs it. Save them as a patch, with a list of the untracked files, and tell Jason:

```
git -C "$REPO" diff > "$HOME/BRIMM Video Work/brimm-video-main-uncommitted-2026-10-27.patch"
git -C "$REPO" status --short > "$HOME/BRIMM Video Work/brimm-video-main-status-2026-10-27.txt"
```

**D. Put every local branch on GitHub under an archive name.** This touches no real branch. Each local branch, `main` included, is pushed as `archive/2026-10-27/<its name>`:

```
git -C "$REPO" push origin 'refs/heads/*:refs/heads/archive/2026-10-27/*'
```

**E. Tag what runs:**

```
git -C "$REPO" rev-parse main origin/main
git -C "$REPO" tag -a brimm-video-v1 main -m "brimm-video as it ran on the Mac Studio before BRIMM Video Studio (2026-10-27)"
git -C "$REPO" push origin brimm-video-v1
```

The first line shows whether the local `main`, which is what runs, differs from GitHub's. The tag is made on the local `main`, so it holds what really runs, and pushing it carries those commits to GitHub.

**F. Check that nothing is left only on this Mac:**

```
git -C "$REPO" fetch origin
git -C "$REPO" log --branches --not --remotes --oneline
```

It should print nothing. Stashes are not pushed: if part A listed any, tell Jason before anything is deleted.

**Going back** is then `git checkout brimm-video-v1`, or any `archive/2026-10-27/…` branch. Nothing is deleted, on the Mac or on GitHub.

## 4. The contract with BRIMM Ops: must not break

BRIMM Video Studio still hands its work to BRIMM Ops (Jason, 2026-10-27). These carry over exactly. Change any of them only together with brimm-operations, in step:

- **The hand-off file**:
  - `tool/handoff-v2.js` (version 2, for a finished video, a raw video, a session or an iPhone clip);
  - `tool/handoff.js` (version 1, still read by the page);
  - their fixtures in `tool/tests/fixtures/`, which brimm-operations keeps copies of.

  Their tests and fixtures are the contract: "change neither without changing both". The BRIMM Ops page refuses a session's hand-off with a key it does not know.
- **The copies from brimm-operations,** each named in its first line and kept in step by hand: `tool/shared/` (`text.js`, `answers.js`, `transcript.js`, `show.js`), `tool/lib.js` and `tool/run.js`. `transcript.js` is how BRIMM Ops reads an `.srt`.
- **The guide** (`tool/guide.js`, `tool/guide-note.js`): Sallie's next step for each video, as far as the BRIMM Ops page's steps.
- **What goes in a hand-off:**
  - the final transcript (`.srt`), made on the Mac;
  - the kind;
  - each Reel's words and its on-screen title;
  - a session's approved principles, with no client names, and never its transcript.

  The page writes the post text from these. Nothing is posted.
- **New in the design:** `finish` takes the app's exports (the app saves them to Downloads, named after the project) instead of Final Cut's Shares. The hand-off it writes is unchanged.

## 5. What carries over, and what retires

From each module's first line. A session building BRIMM Video Studio checks each by its code and tests before moving or removing anything. Retiring is one pull request at a time, on Jason's yes, after A0 and the app path work.

| Area | Modules | In BRIMM Video Studio |
|---|---|---|
| Intake and records | `unedited.js` (the watcher), `filing.js`, `importing.js`, `dropbox.js`, `episode.js`, `names.js`, `kinds.js`, `versions.js`, `settings.js`, `switch.js`, `install.sh`, `detached.js`, `progress.js`, `progress.swift` | **Kept.** `unedited.js` loses its rough-cut, upright and clip steps. `kinds.js` takes a Zoom download as a session at the drop (decision 10) |
| Transcript | `cuts.js` (probe, transcriber arguments, cut plan), `spelling.js`, `final-transcript.js`, `lib.js`, `run.js` | **Kept.** The cut plan goes to the app's project as suggestions. `cuts.js`'s render parts retire |
| Claude's readings | `readings.js`, `reading.js`, `notes.js` | **Kept,** with the session reading changed (next row) |
| Sessions | `sessions.js`, `teachings.js`, `gate.js`, `dialog.js` | **Kept and changed** to the design's section 5. Read at the drop under the training gate: the whole transcript, other speakers renamed, no client permission needed (decision 5). Clip suggestions with times. The client's "use" consent recorded through `dialog.js`. Client identity taken out of clips. Nothing to HyperFrames without Sallie's confirmation. No HeyGen features for a session clip until HeyGen confirms the opt-out |
| BRIMM Ops | `handoff.js`, `handoff-v2.js`, `shared/`, `guide.js`, `guide-note.js` | **Kept, unchanged** (section 4) |
| Finishing | `finish.js`, `parts.js` | **Kept and changed:** from the app's exports, not Final Cut's |
| Sallie's folder | `studio.js`, `edit.js`, `gate.js`, `guard.js` | **Kept.** `edit.js`'s commands are slimmed. Her folder's allowlist gains the project maker, `npx hyperframes open` and `catch-up` |
| Picture checks | `faces.swift` | **Kept,** for the session clip check. Apple's on-device text reading (Vision) is added there |
| Editing that the app now does | `captions.js`, `layers.js`, `pictures.js`, `styles.js`, `timeline.js`, `recut.js`, `clock.js`, `reel.js`, `reframe.js`, `projects.js` | **Retire** after the app path works |
| Reels at the import | `reels.js` | **Changed:** the Reel suggestions with their times are kept, to pass to the app; the making retires |
| Final Cut | `fcpxml.js`, `portable.js`, the push and its guard | **Unsure.** Final Cut stays optional, fed by the app's MOV export. Whether brimm-video still writes FCPXML is Jason's call |

## 6. Making `brimm-video-studio`

Recommended: a new private repo, `jogden12/brimm-video-studio`, started from brimm-video's full history at the tag. Its tests and `git blame` come along, and brimm-video stays untouched as the way back, still running for Sallie.

1. **Jason** makes the empty private repo on GitHub, with no README.
2. **A session with access to both repos,** on Jason's yes:

   ```
   cd "$HOME/Claude Code"
   git clone https://github.com/jogden12/brimm-video.git brimm-video-studio
   cd brimm-video-studio
   git remote rename origin brimm-video
   git remote add origin https://github.com/jogden12/brimm-video-studio.git
   git fetch brimm-video --tags
   git checkout -B main brimm-video-v1
   git push -u origin main
   git push origin brimm-video-v1
   git push origin brimm-video/claude/zealous-bell-esuqck:refs/heads/design-2026-10-27
   ```

   Then open a pull request of `design-2026-10-27` into `main`, which brings the design documents in, for Jason to merge.
3. **The first pull request in the new repo** renames the project to BRIMM Video Studio, in the README, `CLAUDE.md` and `package.json`. It also adds the new rules of section 7 to `CLAUDE.md`.
4. **Two things stay on brimm-video until Jason switches them:**
   - **the launch agent** `com.thebrimm.unedited`. BRIMM Video Studio gets its own launch agent, under a new label, on his yes;
   - **Sallie's laptop,** whose read-only deploy key is brimm-video's. The new repo gets its own key when her laptop is switched (`docs/setup/sallies-laptop.md`).

**A name to settle with Jason:**
- **Sallie's Claude folder is already `~/BRIMM Video Studio`** (`tool/studio.js`). It could stay as the new application's front door, which fits the name, or be renamed.
- **HeyGen's app is called "HyperFrames Studio",** so the two names sit close together.

## 7. Rules for BRIMM Video Studio

Every rule in this repo's `CLAUDE.md` carries over:
- drafts only;
- never read a `.env`;
- nothing installed without Jason's yes;
- a failing test first;
- the launch agent's checkout stays on `main`, with work done in worktrees;
- experiments never write into the watched Dropbox folder;
- Final Cut's library in `~/BRIMM Video Work`.

Added by the decisions of 2026-10-26 and 2026-10-27:

**Sessions**
- A Zoom download is a session at the drop. Sallie can correct one.
- Claude reads a session only on an account whose training setting is off, under the training gate. It reads the whole transcript with the other speakers renamed. No client permission is needed for teachings.
- Her folder turns off `/feedback` and the transcript-share survey (`DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`).
- Nothing of a session goes to HyperFrames by default. A clip goes only after Sallie confirms the client's "use" consent, or confirms that the clip is her alone, with the client's identity taken out where possible. The full recording goes only with that consent and on her explicit ask.
- No session clip uses HeyGen's features (the Script panel, Share, the cloud) until HeyGen confirms the training opt-out, which Jason is asking for.
- Higgsfield never gets a session.

**HeyGen and the app**
- HeyGen is on its lowest paid tier.
- The Script panel may transcribe videos meant for posting.
- Share is for invited people only.
- Never render in the cloud.
- No HeyGen avatars, voices or Video 1 clips without Jason's yes, and never a generated Sallie, face or voice.
- The app's agent is Claude Code with Auto access, never Full.

**HyperFrames**
- Projects live in `~/BRIMM Video Work`, never in Dropbox or a watched folder.
- Telemetry is off.
- Never `publish`, `cloud`, `lambda` or `cloudrun`.
- Each project carries BRIMM's rules for the agent (`docs/phase-a0/brief.md`, `settings.json`).

**The brand**
- The brand guide's colours.
- Josefin Sans (Google Fonts) in place of Sweet Sans Pro, which never became active on the Mac Studio.
- Fonts only from Adobe Fonts or Google Fonts. A replacement for the script Sinthya is still to be picked.
- The name on screen is Sallie Ogden.

**Elsewhere**
- Versions are the app's history (`npx hyperframes history`).
- Music comes from a library, with Sallie picking.
- Generated media is labelled for YouTube's disclosure.
- OpenRouter is for pictures only. Higgsfield waits until A0.

## 8. The first work, in order

1. **A0** (Jason, by hand): `docs/phase-a0/checklist.md`. Its answers decide how the projects carry BRIMM's rules, and whether the Script panel needs HeyGen.
2. **Saving brimm-video** (section 3), then **making `brimm-video-studio`** (section 6), each on Jason's yes.
3. **A written plan, then B1:** brimm-video's project maker, for a raw video and an iPhone clip, with `npx hyperframes open`. Failing tests first; no test calls the app, HeyGen or `claude`.
4. **B2:** `finish` from the app's exports, writing the hand-off of section 4 unchanged.
5. **S1 and S2:** sessions, as the design's section 5 and the rules above say.
6. **R:** retire what the app does, one pull request at a time.

Each is a pull request, merged by Jason.

## 9. What not to do

- **Your checkout:** don't switch the main checkout's branch or commit on its `main`.
- **Machines:** don't stop or change the launch agent, and don't touch Sallie's laptop.
- **Installs:** don't install the HyperFrames app or anything else without Jason's yes. A0's install is his own, by hand.
- **Deleting:** don't delete a branch, a worktree, a stash, a tag or a file in Dropbox.
- **Sessions:** don't send any session content anywhere new.


---

# Appendix B: the late-check work, retirement note, verbatim

Copied unchanged from `claude/late-check-overlap-build-7f23d3:docs/superpowers/retired/2026-10-27-reading-during-late-check.md` (branch tip 6bd9b7a). Section 3 of the cover has the next steps for Tasks 1 to 4.

# Reading during the late check (D3): retired with the redesign, 27 Oct 2026

**Status: retired, documented, never merged.** Jason decided on 27 Oct 2026 to retire it with the BRIMM Video Studio redesign (the HyperFrames app does the editing; see `docs/handoffs/2026-10-27-brimm-video-studio-handoff.md` on `claude/zealous-bell-esuqck`). This branch, `claude/late-check-overlap-build-7f23d3`, is a snapshot of what was built. **Do not merge it as it stands**: on the Mac that did not import the video, the final write is weaker than today until Task 10, which was not built, lands (a one-look gap in the importing Mac's status lets the write through).

## What it was for

Sallie's note 3 of 25 Oct: "Shorten the 15 minute buffer time between dropping video and beginning processing." The wait is the import's Dropbox late check, 15 minutes after its last copy, which holds Claude's reading of a raw video (it replaces files the check looks at). Jason's decision D3 (27 Oct): let Claude's reading and its rough cut run during the check, hold back only the final write into Episodes until the check passes, and leave the late check itself alone (`LATE_CHECK_MS`, `lateCheck`, the rule for writing into Dropbox). A 40-minute video's results would have come about 13 minutes sooner.

- Design: `docs/superpowers/specs/2026-10-25-brimm-video-reading-during-late-check-design.md` (written against `acec307`, reviewed three ways, 39 tests).
- Plan: `docs/superpowers/plans/2026-10-27-reading-during-late-check.md` (16 tasks, re-verified against main 42a39a3).

## The three open questions, as ruled

Jason had not answered them separately; each took the design's recommendation.

1. The import's per-minute timer also makes due late checks while another video imports: **yes**.
2. On the Mac that did not import: the design's **four rules** (the check's time passed plus two minutes; no status at two looks 90 seconds apart; no unreadable status file; the files it touches here at their sizes).
3. `READ_LIMIT_MS`: **2 hours** of looks in all.

## Built (Tasks 1 to 9, as they stood on this branch; suite 3841 pass, 0 fail at 546716b, main was 3718)

| Task | Commit | What it does |
|---|---|---|
| 1 | 48b58d4 | `importHold` says its `state` (`running`, `due`, `owed`, `stopped`, `failed`, `problem`, `""`) and takes `importing`; `why` and `waits` unchanged |
| 2 | c2c9ed9 | `statusesOf`, `isStatusFileOf`, `dueOf` in `importing.js` |
| 3 | d1d3ad2, eaadddf | the "Waiting for its late check" status carries `due`; the import's per-minute timer makes due checks while another video imports (a throw there is logged); the loop passes over a drop file a check took out |
| 4 | 19efbc6 | `addRates`: the rates written through a name of the process's own and read again before writing |
| 5 | e8a5638 | `timelineFor` takes the kept `.srt` and words |
| 6 | 799331f | `tool/overlap.js`: the pure rules (`lookKind`, `startStops`, `checkTimeOf`, `estimateOf`, `otherMacLook`, the reading's note) |
| 7 | 28a39d4 | `reading.js` asks Claude at once; everything is made in the run's own folder and in `~/BRIMM Video Work`; only the final `intoEpisode` waits for the hold, with looks counted, not timed, and two limits |
| 8 | a02be58 | the reading's inputs taken once at their listed sizes, kept, compared byte for byte before the write |
| 9 | 546716b | the rough cut made again when the video came back or the first make failed while the hold was on |

Before the write nothing reaches the episode folder: the new tests assert the scratch root is byte for byte as before at every look. A read-only review of Tasks 1 to 6 found no Critical or Important issue; Tasks 7 to 9 were not reviewed by a reviewer.

## Not built (Tasks 10 to 16)

- **Task 10, the four rules on the Mac that did not import.** Its 15 tests were written first and committed red as 1331340 (reverted in 9e3646f; they stay in history). The algorithm is in the session notes' `task-10-context.md`: keep `latestDue` and `previous` across looks, set `previous = result.seen` at every look (null included), wait 90 seconds after a look that met rules 1, 3 and 4, treat an unreadable status file as a running import, and judge rule 4 by size for every file the write replaces and every input taken.
- Task 11: the stop notice (`Claude's reading of <name> was not put in: say "how far is it?"`), `read --quiet-until`, the new next-step words.
- Task 12: a raw reading adds its measured times to the rates.
- Task 13: `kind`'s three new lines and `kind --again` refused while the import holds one of its files.
- Task 14: `status` lines from the note, and the guide's `running` with a time and a new `stopped` state (the guide's "later" goes).
- Task 15: docs. Task 16: the whole suite, the read-only review of every write path, the PR.

## What is worth keeping: Tasks 1 to 4, completed

Jason asked on 27 Oct that Tasks 1 to 4 be completed. They are, on their own branch, **`claude/late-check-groundwork`**: cut from main 42a39a3, the five commits (48b58d4, c2c9ed9, d1d3ad2, eaadddf, 19efbc6) cherry-picked and the review's minor findings fixed in one more commit (4e4df21); the whole suite passes (3749, main alone 3718); no pull request is open yet, and opening one is Jason's yes. They stand on their own in kept modules (`unedited.js`, `importing.js`, `filing.js`, `progress.js`):
- the timer making due checks fixes a real fault: a long import used to hold the first video's check until it ended;
- the loop no longer imports a drop file that a check just took out;
- the rates file could be lost by two writers at once, and no longer can;
- `importHold`'s `state`, `statusesOf`, `dueOf` and the status's `due` are groundwork that no live code reads yet.

The full handoff for the next session, `docs/handoffs/2026-10-27-brimm-video-studio-full-handoff.md` on that branch, says what to do with them (section 3 of its cover).

Tasks 5 and 9 and the rough cut's timing sit in code the handoff retires (`timeline.js`, the rough-cut render). Tasks 6 to 8 serve the raw reading, whose place before the HyperFrames project exists is Jason's call. Under the handoff's section 5 this work as a whole is **unsure**; Tasks 1 to 4 are the part to keep.

## Deferred minor findings

`filing.js` timer's log line falls back to `e.message` and says "next look" (it is the next run); `statusFault`'s comment omits `due`; `overlap.js` arrays should default to `[]`; T38's last assertion is weak; the final compare's failure words repeat "so what Claude read was not put in." beside the shared `NOT_PUT`; `importing: true` over `running`, `failed` and `problem` is untested.

## Where the rest is

The session notes folder `local_3cfbe129-2310-4d94-9f78-c4977c732a2a/` holds `late-check-overlap-handover-2026-10-27.md`, `late-check-overlap-reverify-2026-10-27.md` (every line of the design checked against main) and `late-check-overlap-sdd/` (the ledger, task briefs, implementer reports, the batch review, the controller's rulings). The build stopped at the monthly spend limit of the account (weekly limit resets 7pm America/New_York), and then at the redesign.
