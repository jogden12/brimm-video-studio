# BRIMM Video Studio for clients: design

**Status:** a proposal, 2026-11-25, from Jason's answers in chat. Nothing is built. It belongs in its own repository once there is one (section 14); it is here until then.

## 1. What it is

A Claude plugin (project instructions, skills and a few small scripts) that Sallie offers her clients under The BRIMM's name. A client installs it in their own Claude Code or Cowork on their own Mac. It takes their own video, unedited, a rough cut or already edited, and helps them make:

1. **A polished long-form video**, with graphics and subtitles.
2. **Shorter clips from it**, with graphics and subtitles, cropped to vertical for Reels when needed.

At the end it writes a **hand-off pack**: the finished files and everything known about them, written so that any AI can do the content work that follows. A separate skill in the same plugin, the **content cascade**, does that work in Claude: drafts of posts, captions, titles, descriptions and a newsletter. Nothing is ever posted.

It is a new product built from what Studio knows. Studio itself, its Macs, its live checkout and its contract with BRIMM Ops do not change (section 14).

## 2. Decisions so far (Jason, 2026-11-25)

| | Decision |
|---|---|
| Where it runs | Claude Cowork or Claude Code, in the first version. |
| Machines | Mac only, for now. |
| The editor | HyperFrames. The HyperFrames app is recommended, not required: it lets the client preview the whole video and change it. |
| Client sessions | Out for now; maybe a later update. This is for the client's own video content. |
| The name | It carries The BRIMM's name. |
| The content cascade | Its own skill. |
| Reel Kit | It may be incorporated: its licence is MIT (section 9). Its strength is its effects and graphics. If needed, The BRIMM could build its own set to replace it later. |

## 3. What it leaves out

Everything in Studio that exists to run Sallie's two Macs: the launch agent and drop folders, the light import's watch, Dropbox and the multi-Mac rules (`where.js`, `put-here.js`, `originals.js`, `switch.js`), the Mac app and its updates, `install.sh`, the strict and open locks on her folder and their guards, the card receipts, the training gate and everything about sessions, the guide's BRIMM Ops steps, and the hand-off contract (`handoff-v2.js`, `handoff.js`, `madeBy`).

The client's Claude does the reading itself, in the conversation. There is no separate `claude -p` call as in `reading.js`.

## 4. How a client uses it

1. **Set up, once.** The setup skill checks the Mac and installs what is missing, asking first (section 7).
2. **Their brand, once.** An interview writes their brand profile (section 6).
3. **Bring in a video.** They name a file. Claude reads its facts, transcribes it, and asks one card: unedited (with retakes), a rough cut, or edited.
   - Unedited: Claude proposes a rough cut (pauses and retakes taken out, whole phrases only) and shows it before going on.
   - A rough cut or edited: the cut is theirs; Claude only tidies the start and end if asked.
4. **The long-form video.** Claude proposes graphics and on-screen words with their times, a title and chapters, and builds the HyperFrames project with the brand, the subtitles and the graphics. The client previews and changes it in the HyperFrames app (or Claude renders a preview with the command line), then exports.
5. **Clips.** Claude suggests clips with the reason for each. For each one the client picks, it makes a clip project: cut at whole phrases, cropped to vertical when it is for Reels, with subtitles, a title and graphics. A clip can instead be a Reel Kit edit (hi-fi, lo-fi or showcase), the mode always asked.
6. **Finish.** Claude collects the exports, transcribes each finished file again for its subtitles, and writes the hand-off pack (section 10).
7. **The content cascade.** In the same Claude, or with the pack dropped into another AI (section 11).

## 5. The plugin's parts

Skills are prose; the scripts do the work that must be exact. Scripts are plain JavaScript for Node 22 or later with no npm packages, as Studio's are, and each is a command line that prints JSON.

| Skill | What it does | Drawn from in Studio |
|---|---|---|
| `setup` | Checks and installs the tools, with the client's yes; checks again after an update. | `install.sh`, `build.js`'s program finding, Reel Kit's own setup skill |
| `brand` | The brand interview; writes and changes the brand profile. | `tool/brand/brand.md`, the brand rules in `project.js` |
| `bring-in` | Facts, transcript, the card, the rough cut for an unedited video. | `filing.js`, `cuts.js`, `closing.js`, `spelling.js`, `sentences.js`, `kinds.js` |
| `long-form` | Graphics, on-screen words, title, chapters; the main project; preview and export. | `reading.js`, `readings.js`, `graphic-cues.js`, `on-screen.js`, `on-timeline.js`, `project.js`, `workcopy.js`, `plan*.js` |
| `clips` | Clip suggestions, clip projects, the vertical crop; Reel Kit edits. | `reel-candidates.js`, `reframe.js`, `app-reel.js`, `reel-kit-*.js` |
| `finish` | Exports back, the final transcripts, the hand-off pack. | `exports.js`, `final-transcript.js`, `suggestions-in-main.js`, `finish*.js` |
| `content-cascade` | Drafts from a hand-off pack, in the client's voice. | BRIMM Ops' post writing (in brimm-operations), the Short video format in `docs/requirements.md` |

A front door, as in Studio's `CLAUDE.md`, sits in the plugin's instructions. A script, an idea with notes, or a bare idea leads to a plan for a video they will film (`front-door.js`, `plan-script.js`, `tool/studio/script.md`). A recording goes to `bring-in`.

The scripts (`scripts/`), each test-first: `facts` (ffprobe), `transcribe` (word times), `rough-cut` (pauses and retakes to a cut list), `workcopy` (the HyperFrames-ready copy), `project` (writes a HyperFrames project from a plan), `crop` (a vertical crop from face positions), `srt`, `exports` (finds and matches exports) and `pack` (writes the hand-off pack and checks it).

## 6. The client's brand profile

One file, `brand.md` in their work folder, written by the `brand` skill and read by every project and by the cascade:

- Name on screen, business name, the people who appear.
- Colours, with names and hex values.
- Typefaces from Google Fonts or Adobe Fonts only, with weights for sentences, lines and headlines.
- A logo, if they have one.
- Their voice: how they speak, words they use and avoid, their audience, their offers and calls to action.
- Their platforms and what each is for.
- Their rules: what they never want on screen, and AI-generated people or voices (warn first, and label as YouTube asks).

Reel Kit keeps its own style pack (`reel-kit-style`). The `brand` skill writes that too from the same answers, so the client answers once.

## 7. Their Mac and the tools

- **The work folder:** `~/BRIMM Studio Projects` (a working name), one folder per video. It must not be `~/BRIMM Video Work`: on Sallie's and Jason's Macs that is Studio's, and anyone at The BRIMM who tries the plugin would share it. It must not be in Dropbox, iCloud or `~/Movies`.
- **Tools, installed by the setup skill with the client's yes:** Homebrew if missing, ffmpeg, whisper with a pinned model, Node 22 or later, Google Chrome for HyperFrames, the pinned HyperFrames command line (run by its path, never through `npx` fetching the latest), and Reel Kit's own install. The HyperFrames app is recommended and downloaded by the client.
- **Pins:** HyperFrames, the whisper model and Reel Kit are pinned by version and hash, as in Studio (`hyperframes.pin.json`, `whisper-model.pin.json`, `reel-kit.pin.json`). An update of the plugin moves a pin, never the client's Mac on its own.
- **One transcriber or two:** Studio uses whisper.cpp with `large-v3-turbo`; Reel Kit uses faster-whisper `medium` in its own Python. Using Reel Kit's for both saves the client a download of about 1.6 GB. Check C5 decides.

## 8. HyperFrames

Each project carries rules for the agent, from Studio's `docs/phase-a0/brief.md`, made general:

- A draft only: never post or publish. Never `publish`, `cloud`, `lambda`, `cloudrun`, `auth` or `feedback`. Renders on this Mac only. Telemetry off.
- Sharing from the app only with "Only people you invite", never "Anyone with the link".
- AI-generated people: warn before an AI avatar, lip-sync, or an AI-generated version of the client, their face or their voice. Every AI-generated voice or person is labelled as altered or synthetic on YouTube.
- The brand is the client's brand profile.
- The words and times are in `transcript.json`; do not transcribe again.
- Cut whole phrases at pauses, never in the middle of a word. Versions are `hyperframes history`.

What Studio learned that applies here:

- The app starts its agent with only the user's own settings, so a project's `.claude/settings.json` does nothing there: the project's notes are what guide it (`docs/wiki/hyperframes-and-heygen.md`).
- The app transcribes every video it opens in the cloud (ElevenLabs). The setup skill tells the client so.
- The app asks for a HeyGen sign-in when it first opens. Whether a free HeyGen account is enough is check C4.
- HyperFrames' Chrome can't run inside Claude Code's sandbox (RK21, `docs/superpowers/notes/2026-11-23-reel-kit-build-ledger.md`). A client with the sandbox turned on needs renders run outside it. Check C2.

**Subtitles:** BRIMM's own rule draws no captions on a wide main video. A client chooses: drawn on the picture, a separate `.srt` for YouTube, or both. A clip always has them drawn, out of the top 14% and bottom 35% of an upright frame.

## 9. Reel Kit

**What its licence allows.** Reel Kit 1.2.0 (Justyn Berkovits, `github.com/justynberk/reel-kit`) is MIT: use, copy, change, sell and sublicense are allowed, as long as its copyright and licence notice go with every copy. Its 20 sound effects are synthesized from scratch and dedicated to the public domain (CC0, `audio/SFX.md`). Its effects and cards use the style's fonts (`--font-display`, `--font-text` and the rest), not fonts of their own. Its Trials app has its own MIT licence. MIT gives no right to the name "Reel Kit": the client's product says it includes Reel Kit, by Justyn Berkovits, and does not present it as The BRIMM's.

**What it downloads at install, under their own licences, to confirm before release:** the MediaPipe face, hand and pose models; Depth Anything V2 Small; faster-whisper `medium`; a static ffmpeg build; its Python packages. These are fetched onto the client's Mac by Reel Kit's install, not shipped in the plugin. Depth Anything V2's larger models carry a non-commercial licence; only Small is pinned, and its licence is part of the check.

**How it comes in.** Recommended: a pinned copy inside the plugin, unchanged, with its `LICENSE`, so the client installs one thing at one known version. The other way, asking the client to install Reel Kit's own plugin, leaves its version to them. A copy can later become The BRIMM's own fork, or its own set of effects, without the client noticing.

**What it gives the clips:** the effects and cards (67 effects), the storyboard before a render, and its tracking (`pipeline/track.py`). The tracking can also give the simple clip's vertical crop its face positions, in place of Studio's Mac-only `faces.swift`.

**What Studio learned:** Reel Kit runs its own HyperFrames (0.8.139) beside the main one, and its worker needs care with sandboxes (`docs/memory/gotchas.md`; the RK21 entries in the ledger). Its preview videos in `fx/*/preview.mp4` are for choosing effects; they are not The BRIMM's to use in its own marketing.

## 10. The hand-off pack

One folder per video, `<video>/handoff/`, written last by `finish`:

```
START HERE.md        what this is, and what to make from it (below)
brand-voice.md       a copy of the brand profile's voice, audience, offers and platforms
main/                the finished video, its .srt, chapters, title options, the on-screen words
clips/<n>/           each clip, its .srt, its title, its hook, why it was picked, where it sits in the main video
facts.json           the same, for tools: files, lengths, times, titles; checked by `pack`
```

`START HERE.md` is written for any AI, with no plugin present:

- What the video is about, in a paragraph, and who it is for.
- What to draft for each platform in the brand profile, by name.
- The rules: draft only, never post or schedule; use only what is in this pack; keep the client's voice; no names or details of anyone but the client unless the pack says they agreed; label AI-generated media where a platform asks.
- Where each draft goes, so a person can check it before anything is used.

Nothing goes in the pack that the client has not approved: each clip's title and hook, and the main title, are marked approved by their choice in the `finish` card.

## 11. The content cascade skill

It takes a hand-off pack and writes drafts into `handoff/drafts/`, one file per platform and piece, in the client's voice. It reads `START HERE.md` as any AI would, so the same rules hold in Claude and elsewhere. What it drafts follows BRIMM Ops' post writing for a Short video: on-screen hook options, an Instagram caption with hashtags, a YouTube Shorts title and description, a LinkedIn post (`docs/requirements.md`, 2026-10-13). It adds the long-form video's YouTube title, description and chapters, and a newsletter. It never posts, schedules or sends. If a scheduler is connected in the client's Claude, it may offer to hand over only what the client approves, piece by piece, as BRIMM Ops does for Sallie. Whether it offers this at all is an open question (section 16).

## 12. Rules the plugin carries

From Studio's `CLAUDE.md`, made the client's:

- The tools draft; nothing is posted, sent or published by the plugin.
- Nothing is installed on the client's Mac without their yes, in the chat, for each install.
- Never read a `.env` file.
- Projects live in the work folder, never in a synced or watched folder.
- No cloud renders. HyperFrames telemetry off.
- Fonts only from Google Fonts or Adobe Fonts. Generated media is labelled for YouTube's disclosure.

## 13. Tests

- Scripts: test first, `node --test`, no packages. No test runs ffmpeg, whisper, HyperFrames, Reel Kit or `claude`: stand-ins print what each would, as Studio's `tests/stand-ins/` do. Studio's fixtures for ffprobe and whisper output (`tests/fixtures.js`) and HyperFrames' help text can be carried over.
- Skills: sample transcripts with the answers expected (a raw talk with retakes, an edited talk, a short phone clip), run as plugin evals (`claude plugin eval`).
- The pack: `pack` checks its own output, and a fixture pack is fed to the cascade skill in an eval.
- A clean Mac, by hand, before each release: install, set up, one video through to a pack.

## 14. Where it lives

A new repository, which Jason creates, with this spec moved into it. It borrows from Studio by copying, each copy naming its source in its first line as Studio's copies from brimm-operations do. Studio's contract with BRIMM Ops, its fixtures and its live checkout on the Mac Studio are untouched; nothing here changes `handoff-v2.js`, `handoff.js`, the guide or `madeBy`.

## 15. Checks before building

By hand on a Mac, written up on a page for Jason with a place for his results:

- **C1. Cowork:** can it run ffmpeg, whisper, the HyperFrames command line and Chrome on the Mac's own files, and open the HyperFrames app? If not, the first version is Claude Code only.
- **C2. Claude Code's sandbox:** with it on, and with it off, does a HyperFrames render run from a plugin's script?
- **C3. A plugin from a repository:** installing, updating and removing it from a marketplace repository, and what a client needs to reach it.
- **C4. The HyperFrames app:** does a free HeyGen account open, preview and export a project Claude made?
- **C5. One transcriber:** are Reel Kit's faster-whisper word times good enough for the rough cut and the subtitles?
- **C6. The vertical crop:** does Reel Kit's tracking give a steady crop for a simple clip?

Not by hand: confirming the licences of the models and packages Reel Kit downloads (section 9).

## 16. Build order

1. The checks (section 15).
2. `setup`, `brand`, `bring-in`, with their scripts.
3. `long-form`, through to an export.
4. `clips`: the simple clip first, then Reel Kit edits.
5. `finish`, the pack, and `content-cascade`.
6. A pilot with one or two of Sallie's clients; then how clients get it.

## 17. Open questions

- **The name:** "BRIMM Video Studio" is also the name of Sallie's own app. A different name for clients avoids mixing them up in support, on the Mac and in this repository's documents. The plugin's id is undecided (not `brimm-video`, which is in the BRIMM Ops contract).
- **How clients get it and pay for it:** a public or private marketplace repository, licence terms for clients, support, and how updates reach them.
- **Apple silicon only?** Reel Kit's pins are for Apple silicon (`uv-aarch64-apple-darwin`, arm64 ffmpeg).
- **The cascade and schedulers:** draft only, or also hand approved drafts to a connected scheduler.
- **Planned videos:** whether the front door's planning (a script she'll film, or an explainer) is in the first version or comes later.
