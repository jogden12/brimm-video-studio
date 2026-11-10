# Decisions

Choices made for Studio, newest first within each heading, with who decided and why. A decision here is settled: reopen it only with Jason. The rules every session must follow are in `CLAUDE.md`; this file says where they came from. Seeded on 2026-11-10 from Jason's project memory and the old `CLAUDE.md`.

## What Studio is for

- **Studio drafts; BRIMM Ops may post what Sallie approves** (Jason, 2026-11-05, review questionnaire Q1: "I want to develop this into a system that will post for the user"). Studio itself never posts, sends or publishes. BRIMM Ops may hand an episode's approved set to her scheduler (Buffer or Later) through a connector in her own Claude, each piece at its planned time; she approves an episode's set once; YouTube, Instagram and Facebook first; the posting track runs beside Studio's work. Why: posting by hand is where her work stalls. Any test that actually posts needs Jason's yes each time.
- **The HyperFrames Mac app does the editing; Studio does everything around it** (design accepted 2026-10-27, `docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`). Why: the app edits with an agent, and Studio keeps the import, the readings and the hand-off it already had as brimm-video.
- **Final Cut retired from Studio** (Jason, 2026-11-06: "Retire it now"). Final Cut can still open HyperFrames' MOV export by hand.
- **OpusClip is no longer used** (Jason, 2026-11-02). Reels are made in Studio, in the HyperFrames app, and handed off. Studio never sends Sallie to OpusClip; its posting tools stay in `tool/studio/never.json`. Done in #29, in step with BRIMM Ops page version 10.
- **The hand-off keeps the name `brimm-video <commit>`** in `madeBy`: the contract names it, so the new name appears only in documents and package names.

## Where files live (Phase 3, the local working folder, merged #47 on 2026-11-07)

- **Only records, the hand-off from `final/` and `Original files` go through Dropbox** (Jason, 2026-11-05: "the working folder is local, and the export folder is on dropbox. the video file does not hit dropbox until it is edited and ready to post"). Why: every copy into Dropbox carried a 15-minute late check, which held up each edit.
- **Edits are never handed between Macs**: each video is edited start to finish on the Mac that took it in (`release` is gone).
- **Each Mac picks its own drop folder and exports folder.** A drop folder may be anywhere, with a warning (never a refusal) for a cloud folder; an exports folder may be anywhere, cloud fine. Default drop folder: `~/BRIMM Video Work/Drop`.
- **After the hand-off every recording moves right away into the episode's `Original files` in Dropbox**, and the Mac's copy is deleted only once Dropbox says it is uploaded. A footage part's recording goes into its own episode's folder. Parts that show a client move too; only sessions stay out of Dropbox.
- **Episodes filed before the switch keep the old Dropbox way**, waits included, until each is handed off. The old Dropbox-wait code can go once neither Mac has such an episode (the Mac Studio had none from 2026-11-09).
- **A kept video opens in HyperFrames by itself only once its spellings card is answered** (marker `opens-after-spellings.json`).
- **Projects Studio makes stay in `~/BRIMM Video Work`; the app's own projects folder is in Dropbox** (Jason, 2026-11-05; #37). Opening a Studio project in the app puts a link in the app's folder; the files stay local.

## HyperFrames and HeyGen

- **Warn, never block, generated content** (Jason, 2026-11-04, after A1). HeyGen's tools stay open on both Macs; each project's notes warn before an AI avatar, lip-sync, or an AI-generated Sallie (face or voice). A stock HeyGen voice is fine, with YouTube's altered or synthetic label. Why: the app never loads a project's settings, so a settings block would not hold anyway, and Jason wants the tools left for later. Never propose a settings block for generated content again.
- **Rules that must hold in the app go in the project's notes**, since the app starts its agent with `--setting-sources user` (A1, 2026-11-04).
- **The handover from a Claude Code session into the app stays off**: handed over, the agent read the brand kit's rules and not the project's notes (A0, 2026-10-28).
- **Session clips stay out of HyperFrames by default**, since the app transcribes every video it opens in the cloud (A0, 2026-10-28). Plan PRs 12 to 14 (session videos) wait on this.

## Pictures and the brand

- **HDR goes through VideoToolbox** (`scale_vt`, Jason's choice; #9, 2026-10-29), since the Mac Studio's ffmpeg has no `zscale`. The look is "Mild (Q1)" (Jason, 2026-11-02; #25): an 8-bit `lutyuv` S-curve and colour gain, contrast 0.30, colour 1.12, then `limiter`s. Why: Apple's own HLG→SDR curve looked washed out in a bright room.
- **Josefin Sans replaces Sweet Sans Pro**, which never became active on the Mac Studio; **Allison replaces the script Sinthya** (Jason, 2026-10-28: "use allison to replace sinthya"). Fonts come only from Adobe Fonts or Google Fonts. The brand kit takes the Google Fonts TTFs.

## Naming in the code

- **A cue is a "graphic cue"** in code, since `cuts.js` already uses "cue" for a spoken start-over (HyperFrames-led path, #35, 2026-11-05).
- **A video with no sound takes no kind; a silent talking part is never joined; a failed join's result names no part** (#35).
- **Teleprompter changes come through `plan … set` in her chat**, never by editing the file; a client's agreement stands when footage is taken back; a left-alone video may be footage (Jason, 2026-11-05; `docs/superpowers/notes/2026-11-05-h7-findings.md`).
- **Studio's own folders follow `BRIMM_VIDEO_HOME`, while Claude Code's own files are read from the real HOME**, since macOS keeps the sign-in in the real home's keychain.

## Her folder

- **Her folder turns off `/feedback` and the transcript-share survey** (#38, 2026-11-05) in the strict lock's settings. The open lock writes no `env` on purpose (its `openBroken` takes any `env` as a change); adding the two variables there is a design call for Jason before an open lock is named.

## The Mac app (design and plan approved 2026-11-09)

- **BRIMM Video Studio.app replaces Move to Studio.app**: no Terminal, any Mac, Sparkle updates, a Getting Started PDF. One PR per phase (Jason, 2026-11-09).
- **Updates come from `updates.thebrimminsights.com`** (an R2 bucket, `brimm-studio-updates`), chosen over growwiththebrimm.com, whose DNS is elsewhere. Jason makes and backs up the Sparkle signing key himself; its private half is never in chat or the repo.
- **Notarizing sends the app to Apple**, so it stays out of the repo's scripts; Jason says yes to each build, notarize and staple.

## How the work is done

- **Every by-hand step goes on the Studio By-Hand Checks page** (Jason, 2026-10-28), and **Claude runs every Terminal step it can reach** (Jason, 2026-11-02, after placeholders broke nearly every step). Jason is asked only for what needs a person, one plain instruction at a time, with nothing to edit or paste. Why: he follows the steps at the Mac, away from the chat.
- **Delete test footage as we go** (Jason, 2026-11-07): once no check needs a test video, move its episode folder, work folder and HyperFrames link to the Trash; save the raw original first in `~/BRIMM Video Work/Saved test recordings` (local, never Dropbox or a drop folder). Sallie's real videos are never test footage.
- **Agents and sessions run on the cheapest model that fits** (Jason, 2026-11-10: "I will select the model for the main chat; delegate to cheaper models for appropriate sub tasks and sessions"). Haiku for mechanical one-file work, Sonnet for builders, fixers, writing and task reviews, Opus for integration-heavy builds and whole-branch reviews; Fable only when Jason asks. Never fork for work a cheaper fresh agent can do.
- **One coordinating session; Jason's yes gates every merge, push, change on a Mac and BRIMM Ops guide line**, each time. Merge one PR at a time, with a merge commit, CI green. A blanket yes covers only the batch it was given for.
- **Jason uses Studio once the by-hand checks pass; final touches follow from what they find** (2026-10-29).
