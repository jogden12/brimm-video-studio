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
