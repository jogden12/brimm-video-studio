# Review of claude-reel-editor

Reviewed 2026-10-13 for Jason Ogden, at commit `a416076` of [nicolapocock/claude-reel-editor](https://github.com/nicolapocock/claude-reel-editor), the newest commit then and still the newest on 2026-10-14. Its text files were read; nothing from it was run or installed. The detail, with file and line for each finding, is in `findings.md`.

**Verdict: do not adopt it; borrow from it.** It is a two-day-old Claude Code skill that turns one upright phone clip into one finished reel, with a person approving each step. It does not replace the BRIMM tool, which runs unattended on long recordings, but four of its ideas are worth taking.

## What it is

A Claude Code skill (MIT licence) by Nicola Pocock (@getgitgirl), first published 2026-10-11, five commits by one author, no tests. Claude proposes cuts and graphics, the person approves them on a private Claude Artifact page, then HyperFrames (HeyGen's renderer, Apache-2.0) draws captions and cards in a headless browser and ffmpeg encodes. A brand file, made by a five-minute interview, sets colours, typefaces, caption style and sounds. An optional route builds a CapCut draft.

## Beside the BRIMM tool

| | The reel editor | The BRIMM tool (`transcribe/`) |
|---|---|---|
| How it runs | In a Claude Code chat, a yes for every clip | Unattended, on a watched folder |
| What goes in | One upright phone clip; a reel of 60 s by default | Any recording, long ones included |
| Wide video to upright | Centre crop, no face finding | A crop on the face for each kept stretch |
| Words and graphics in the picture | Yes, drawn by a headless browser | No; caption files instead |
| Review before rendering | Yes, a private Claude page | No |
| Clips from a long recording, Story parts | No | Yes |
| Final Cut Pro file | No | Yes |
| What leaves the computer | A low-resolution copy of the whole clip and its transcript, to the review page; the sound to ElevenLabs if a key is set; usage data to HeyGen's PostHog unless switched off | The transcript's words, to Claude; never the video or its sound |
| Tests | None | 660 |

## What is wrong with it

- **Its cut step fails on the Mac Studio.** `cut.py` uses `-filter_complex_script`, which ffmpeg 9 removed; the Mac Studio's ffmpeg 9.0.2 refuses it (probed). A one-line fix.
- **Sound and picture drift.** They are joined by two separate concat filters, up to a frame apart at each cut: about 95 ms after 50 cuts at 30 frames a second (by the reviewer's model).
- **A short cut word can stay.** The air kept at each cut is taken from the cut word, so cutting a word of 0.3 s or less removes nothing, while its caption goes.
- **A missing review file reads as approval.** If the page's decisions are not found, the proposal is used as if approved, and every tap is dropped silently.
- **Captions are lowercased by default.** Unless the brand file sets a case, "The BRIMM" becomes "the brimm", and there is no option for capitals.
- **Its check is thin.** `qa.py` checks size, length and loudness; its check for clipped words never runs, because no step writes the file it needs.

## Is it safe

Nothing hostile was found: no hidden text, no attempt to steer a reviewer, no sudo, no posting. Its risks are those of a young tool:

- It installs whatever is newest from several places, some with output hidden, including from a script described as a check.
- HyperFrames sends usage data by default, and the README does not say so.
- The review page uploads a copy of the whole raw clip and its transcript to claude.ai, and notes typed on the page become instructions to Claude.
- An optional ElevenLabs key is kept in a `.env` file, which this project's rules never read.

It is safe to try on a made-up clip, in a folder outside this repo, with telemetry switched off and ElevenLabs, CapCut and page sharing left off.

## Why it does not fit Sallie

- Its CapCut route is not available in the United States.
- A Zoom or webcam recording gets a blind centre crop: a 640x360 Zoom file is enlarged more than five times.
- A person must be at the keyboard for every clip.

## Worth taking, in order

1. **Review before rendering, through BRIMM Ops.** She taps phrases to keep or cut and approves each hook; the page hands back a small decisions file for the watched folder, which the tool applies with `applyDecisions`. No video upload.
2. **Its sound clean-up settings.** Every filter it uses is on the Mac Studio. Keep its MIT notice if the values are copied.
3. **A pause threshold from each clip's own background noise**, keeping −35 dB as a floor.
4. **A check after each clip is cut**: length, loudness, and a re-transcription to catch clipped words.
5. **Brand colours named by role** (main, accent, caption) instead of by colour, so a palette change touches one file.

HyperFrames itself is worth it only if Sallie wants moving captions or graphic cards; the author gives three to four minutes a reel.

## How it was checked

Four readers (how it works, safety, code quality, fit with the BRIMM tool) found 106 findings. A fifth tried to refute the 56 of weight high or medium against the code and the pages cited: 49 held, 7 were partly right, none were wrong. Render speed and output quality are the author's claims; nothing was run.

## Since

On 2026-10-14 Jason decided that video editing will be a separate app from BRIMM Ops, run through Claude Code or Claude chat, with editing software bought for Sallie's laptop. Item 1 above assumed the BRIMM Ops page; under that decision the review step belongs in the video app instead.
