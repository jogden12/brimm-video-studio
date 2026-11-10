# BRIMM Video Studio

Video for The BRIMM, run through Claude Code or Claude chat, apart from BRIMM Ops. Jason Ogden owns the repo. The HyperFrames Mac app does the editing. Studio does everything around it: it takes a video in, reads it, makes the app's project, takes the exports back, and writes BRIMM Ops its hand-off file, all for a person to check. It began as brimm-video, and its code is still brimm-video's, changed step by step. What it must do: `docs/requirements.md`; Jason's preferences there win over Sallie's comments.

## Stack

Plain JavaScript in `tool/` (Node 22 or later, no npm packages), a few Swift helpers and zsh scripts. It runs ffmpeg, whisper-cli, the `claude` program and the pinned HyperFrames command line, and is started on each Mac by the launch agent `com.thebrimm.unedited`. A Mac app, BRIMM Video Studio.app, is being built to install it.

## Run and test

```
cd tool && node --test                       # every test. Needs Node 22 or later, no packages
cd tool && ./install.sh --print "<folder>"   # what the installer would do. It changes nothing
```

- The installer is only ever run with `--print`, by a test or by hand, unless Jason has said yes in chat.
- No test calls the real `claude` program, the HyperFrames app or HeyGen: a stand-in says what each would print.
- How the tool works today and how it is set up: `README.md`, "Unedited video".

## Rules that are never broken

- The tools draft, and post only what Sallie has approved. Studio itself never posts, sends or publishes anything. BRIMM Ops may hand an episode's approved set to her scheduler, through a connector in her own Claude, each piece at its planned time. Nothing goes out that she hasn't approved, and a post drawn from a session carries only approved principles, with no client names. HyperFrames still never publishes or renders in the cloud.
- Never read a `.env` file. The project's one secret is a read-only deploy key on Sallie's laptop, kept only in her `~/.ssh` (never in the repo or Dropbox); Jason revokes it in the repo's GitHub settings when it is no longer needed.
- Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat first.
- Write a failing test first, then the code.
- The Mac Studio's launch agent runs from Studio's main checkout, `~/Claude Code/brimm-video-studio`. That checkout stays on `main`: work in git worktrees.
- Experiments never write into a Mac's drop folder: a new file there starts the tool (and `~/Movies` on the Mac Studio is a link into Dropbox).
- Every by-hand step for Jason goes into an artifact: what to do on a Mac, the commands to run, and a place for his results, which the session reads back. A pull request or a chat message links to it and never holds the steps alone.

## The contract with BRIMM Ops (never broken)

BRIMM Ops takes Studio's hand-off file. These carry over exactly. Change any of them only together with brimm-operations, in step.

- The hand-off file: `tool/handoff-v2.js` (version 2) and `tool/handoff.js` (version 1, still read by the page), and their fixtures in `tool/tests/fixtures/`, which brimm-operations keeps copies of. Their tests and fixtures are the contract: change neither without changing both. `tool/tests/contract.test.js` pins the fixtures' hashes.
- The tool's name inside the hand-off stays `brimm-video <commit>` (`madeBy`): the contract names it. Renaming it is a contract change, so this project's new name appears in documents and package names, not there.
- The copies from brimm-operations, each named in its first line and kept in step by hand: `tool/shared/`, `tool/lib.js` and `tool/run.js`.
- The guide (`tool/guide.js`, `tool/guide-note.js`): Sallie's next step for each video, as far as the BRIMM Ops page's steps.
- What goes in a hand-off: the final transcript (`.srt`), made on the Mac; the kind; each Reel's words and its on-screen title; a session's approved principles, with no client names, and never its transcript. The page writes the post text from these, and posts only the set she approves, through her scheduler.

## Sessions (clients and groups)

- A Zoom download is a session at the drop. Sallie can correct one.
- Claude reads a session only on an account whose training setting is off, under the training gate. It reads the whole transcript with the other speakers renamed. No client permission is needed for teachings.
- Her folder turns off `/feedback` and the transcript-share survey (`DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`).
- Nothing of a session goes to HyperFrames by default. A clip goes only after Sallie confirms the client's "use" consent, or confirms that the clip is her alone, with the client's identity taken out where possible. The full recording goes only with that consent and on her explicit ask.
- No session clip uses HeyGen's features (the Script panel, Share, the cloud) until HeyGen confirms the training opt-out, which Jason is asking for.
- Higgsfield never gets a session.

## HeyGen and the HyperFrames app

- HeyGen is on its lowest paid tier. The Script panel may transcribe videos meant for posting. Share is for invited people only. Never render in the cloud.
- HeyGen's tools are open, and nothing blocks them on either Mac. Each project's notes warn before an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice, which The BRIMM doesn't use for now. A session clip's notes keep the old line: no session clip uses HeyGen's features. A stock HeyGen voice is fine, with YouTube's altered or synthetic label.
- The app's agent is Claude Code with Auto access, never Full.
- Projects Studio makes live in `~/BRIMM Video Work`, never in Dropbox or a watched folder. The app's own projects folder is in Dropbox and is not watched.
- HyperFrames telemetry is off. Never `publish`, `cloud`, `lambda` or `cloudrun`.
- Each project carries BRIMM's rules for the agent (`docs/phase-a0/brief.md`, `settings.json`). The app starts its agent with only the user's own settings, so a project's `.claude/settings.json` has no effect in the app: the notes are what guide the agent there.

## The brand and media

- The brand is The BRIMM's brand guide: its colours (navy, sand, mist and the rest). The typeface is Josefin Sans (Google Fonts) in place of Sweet Sans Pro. Fonts come only from Adobe Fonts or Google Fonts. The script is Allison (Google Fonts) in place of Sinthya (`tool/brand/brand.md`). The name on screen is Sallie Ogden.
- Versions are the app's history (`npx hyperframes history`). Music comes from a library, with Sallie picking. Generated media is labelled for YouTube's disclosure. OpenRouter is for pictures only. Higgsfield waits until A0.

## Wiki and memory

- `docs/wiki/architecture.md`: how Studio is put together: entry points, the pipeline, the module map, tests, the Mac app.
- `docs/wiki/data-model.md`: every file and record Studio reads and writes, the hand-off's shape among them.
- `docs/wiki/macs.md`: both Macs, the live checkout, drop and exports folders, Sallie's laptop, the By-Hand Checks page and her guide.
- `docs/wiki/hyperframes-and-heygen.md`: the decisions and findings behind the rules for the app and HeyGen.
- `docs/wiki/documents.md`: where the requirements, specs, plans and handoffs are, and where Studio came from.
- `docs/memory/`: decisions (choices and why), gotchas (mistakes not to repeat), progress (done, in progress, next). Read `progress.md` and `gotchas.md` at the start of a session; update them before ending one.
