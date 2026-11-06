# BRIMM Video Studio

Video for The BRIMM, run through Claude Code or Claude chat, apart from BRIMM Ops. Jason Ogden owns the repo. The HyperFrames Mac app does the editing. Studio does everything around it: it takes a video in, reads it, makes the app's project, takes the exports back, and writes BRIMM Ops its hand-off file, all for a person to check.

Studio began as brimm-video: its history up to c666508, which is the tag `brimm-video-v1` (42a39a3, what ran on the Mac Studio on 2026-10-27) and the late-check groundwork merged after it. brimm-video itself keeps running for Sallie until Jason switches each Mac. The code here is still brimm-video's, and is changed step by step.

- What it must do: `docs/requirements.md`. Jason's preferences there win over Sallie's comments.
- The design, accepted on 2026-10-27: `docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`. The architecture and the workflows: `docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md`. The build plan: `docs/superpowers/plans/2026-10-27-brimm-video-studio-build-plan.md`. The handoffs: `docs/handoffs/`.
- How the tool works today and how it is set up: `README.md`, "Unedited video".

## Rules that are never broken

- The tools draft, and post only what Sallie has approved. Studio itself never posts, sends or publishes anything. BRIMM Ops may hand an episode's approved set to her scheduler, through a connector in her own Claude, each piece at its planned time. Nothing goes out that she hasn't approved, and a post drawn from a session carries only approved principles, with no client names. HyperFrames still never publishes or renders in the cloud. (Jason, 5 November 2026; see the requirements' "Decisions".)
- Never read a `.env` file. The project's one secret is a read-only deploy key on Sallie's laptop, kept only in her `~/.ssh` (never in the repo or Dropbox); Jason revokes it in the repo's GitHub settings when it is no longer needed. Until her laptop is switched to Studio, the key there is brimm-video's; Studio gets its own then.
- Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat first.
- Write a failing test first, then the code.
- Since 2026-11-03 the Mac Studio's launch agent, `com.thebrimm.unedited`, runs from Studio's main checkout, `~/Claude Code/brimm-video-studio`. Studio's installer kept that label and replaced brimm-video's agent in place, on Jason's yes. That checkout stays on `main`: work in git worktrees. Sallie's laptop runs brimm-video's agent until it is moved to Studio.
- Experiments never write into the watched Dropbox folder: a new file there starts the tool.
- Final Cut Pro's library, where Final Cut is still used, is in `~/BRIMM Video Work`, because `~/Movies` on the Mac Studio is a link into Dropbox.

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

## HeyGen and the app

- HeyGen is on its lowest paid tier.
- The Script panel may transcribe videos meant for posting.
- Share is for invited people only.
- Never render in the cloud.
- HeyGen's tools are open, and nothing blocks them on either Mac (Jason, 2026-11-04). Each project's notes warn before an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice, which The BRIMM doesn't use for now. A session clip's notes keep the old line: no session clip uses HeyGen's features. A stock HeyGen voice is fine, with YouTube's altered or synthetic label.
- The app's agent is Claude Code with Auto access, never Full.

## HyperFrames

- Projects live in `~/BRIMM Video Work`, never in Dropbox or a watched folder.
- Telemetry is off.
- Never `publish`, `cloud`, `lambda` or `cloudrun`.
- Each project carries BRIMM's rules for the agent (`docs/phase-a0/brief.md`, `settings.json`).
- The app starts its agent with only the user's own settings (--setting-sources user), so a project's .claude/settings.json has no effect in the app: the notes are what guide the agent there (A1, 2026-11-04).

## The brand

The brand is The BRIMM's brand guide: its colours (navy, sand, mist and the rest). The typeface is Josefin Sans (Google Fonts) in place of Sweet Sans Pro, which never became active on the Mac Studio. Fonts come only from Adobe Fonts or Google Fonts. A replacement for the script Sinthya is still to be picked. The name on screen is Sallie Ogden.

## Elsewhere

- Versions are the app's history (`npx hyperframes history`).
- Music comes from a library, with Sallie picking.
- Generated media is labelled for YouTube's disclosure.
- OpenRouter is for pictures only. Higgsfield waits until A0.

## Working on the tool

```
cd tool && node --test                       # every test. Needs Node 22 or later, no packages
cd tool && ./install.sh --print "<folder>"   # what the installer would do. It changes nothing
```

- The installer is only ever run with `--print`, by a test or by hand, unless Jason has said yes in chat.
- No test calls the real `claude` program, the HyperFrames app or HeyGen: a stand-in says what each would print.
- `tool/shared/`, `tool/lib.js` and `tool/run.js` are copies from brimm-operations, each named in its first line, and are kept in step by hand.
- Every by-hand step for Jason goes into an artifact: what to do on a Mac, the commands to run, and a place for his results, which the session reads back. A pull request or a chat message links to it and never holds the steps alone (Jason, 2026-10-28).

## Both Macs

Both Macs edit in the HyperFrames app (A0 installs it on the Mac Studio first; Sallie's laptop follows, on Jason's yes). Final Cut Pro stays optional, fed by the app's MOV export; whether Studio still writes Final Cut files is Jason's call. Sallie's laptop is set up by `docs/setup/sallies-laptop.md`, which still describes brimm-video until a later step updates it. Moving it to Studio is checks 40 to 48 on the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT); the Mac Studio's own move, check 40, was done on 2026-11-03. Her guide is the BRIMM Ops guide (https://claude.ai/artifact/Vu5JmADhftiEsPz4KYN4e4). The BRIMM Video Guide it replaced was retired on 2026-11-03: its link points to the BRIMM Ops guide. Her laptop has been on brimm-video's light import since 2026-10-26, with its drop folder at `Drop/Sallie's laptop`.
