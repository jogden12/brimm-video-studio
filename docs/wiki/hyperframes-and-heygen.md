# HyperFrames and HeyGen

The background to `CLAUDE.md`'s rules for the HyperFrames app and HeyGen: who decided what, when, and what the checks found. Moved here and filled in on 2026-11-10.

## Decisions behind the rules

- **HeyGen's tools are open, and nothing blocks them on either Mac** (Jason, 2026-11-04, after A1). Each project's notes warn before an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice, which The BRIMM doesn't use for now. A session clip's notes keep the old line: no session clip uses HeyGen's features. A stock HeyGen voice is fine, with YouTube's altered or synthetic label. Never propose a settings block for generated content again: it would not hold in the app.
- **The app starts its agent with only the user's own settings** (A1, 2026-11-04). It runs `claude --print … --permission-mode auto --setting-sources user --settings {its own} --allowedTools mcp__hf_media --mcp-config {hf_media} --add-dir <project>`, so a project's `.claude/settings.json` has no effect in the app (A1 check 55: two denies in it were both ignored). Only the project's notes, the app's own `--disallowedTools` and the user's `~/.claude/settings.json` apply. The notes are what guide the agent there.
- **The app's agent has its own HeyGen tools**: an MCP server, `hf_media`, with about 30 tools (voiceover, voice cloning, avatar video, lip-sync, video and image generation, music, render, upload, stock voices). The agent uses these in place of the command line; a stock voice lands in `assets/` as `HeyGen voice <id>.wav`.
- **Projects Studio makes live in `~/BRIMM Video Work`**; the app's own projects folder is in Dropbox (Jason, 2026-11-05; see `macs.md`).
- **The handover into the app stays off** (`appHandover`): in A0, handed over from a Claude Code session, the agent listed the brand kit's rules and not the project's notes; opened from a new chat, it read the notes and refused a cloud render and a public link, quoting them.
- **Session clips**: no session clip uses HeyGen's features (the Script panel, Share, the cloud) until HeyGen confirms the training opt-out, which Jason is asking for. Plan PRs 12 to 14 (session videos) wait on it.

## What A0 found (2026-10-28)

Results: `~/BRIMM Video Work/A0 app test/results.md` (outside the repo).

- **The app transcribes every video it opens, in the cloud**: its transcripts in `.hyperframes/transcripts/` record ElevenLabs' `scribe-v2`, even when `transcript.json` is there. Fine for videos meant for posting; a session clip must not be opened in the app.
- **Exports** go to `~/Downloads` by default (a Dropbox link on the Mac Studio); the Export dialog has a folder dropdown. Each export leaves `renders/<project>_<date>_<time>.meta.json` with `exportedTo` and a fingerprint.
- **Reels** made in the app are their own projects, with a copy of the whole original video.
- **History**: without a handover the app still writes `.hyperframes/app-history.jsonl`; `catch-up` and `history` work while the app has the project open. The agent writes its own cut proposals into `brimm/cut-suggestions.json`.
- **HeyGen sign-in**: the command line takes a key only from `HEYGEN_API_KEY`, `HYPERFRAMES_API_KEY`, `HEYGEN_ACCESS_TOKEN` or `~/.heygen/credentials`; it never reads the app's sign-in. Studio's projects blank the three variables.
- Still untested: `history begin` while the app is open (item 13).

## What the by-hand checks of 2026-10-30 showed

- **Storyboard first**: the agent can put a change on its Storyboard and leave `index.html` alone until "Build the video".
- **The recording moves**: adding a title card, the agent set the a-roll to `data-start="3"`. Studio reads the placement from `index.html`.
- **Chips**: an attached ability is stored in `asked` as U+E000 + encodeURIComponent(JSON `{t, id, name}`) + U+E001; Studio shows it as `#<name>`.
- **Going back** may be a new forward change, so `history --json` marks nothing undone; the project's rules point the agent to `hyperframes history undo --who claude`.

## Updates

The app updates itself about six times a day (`~/Library/Logs/HyperFrames/update.log`); its "Automatic updates" switch (`auto-update.json`, absent means off) gates installing while away. Studio pins the command line it runs itself (`tool/hyperframes.pin.json`).
