**Skeptic review of the unedited-video answer (2026-10-13)**

All checks were read-only. I wrote one test file, `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/skeptic/audition-vertical.fcpxml`. Nothing was installed, and nothing under CloudStorage was read.

## 1. Claims the reports do not support

- **"Passed Final Cut 12.4's own format check."** It is `xmllint` against the DTD file inside the app, not Final Cut's importer. I re-ran it:
  - `sample.fcpxml` exits 0, and so does `bad-time.fcpxml`, whose times are off-frame.
  - The sample has no audition and no 1080×1920 format, the two features the row leads with. My test file with both exits 0.
  - The same file carries the unverified `SRT?captionFormat=SRT.en` role and passes, because the DTD declares the caption role as free text (line 554). The DTD cannot confirm that string.
- **"Yes, with that one open risk."** The fcp report lists at least five:
  - the SRT role string;
  - the custom Motion template id;
  - the Basic Lower Third id, which is inferred;
  - Dropbox online-only media;
  - whether 12.4 reads all the DTD versions.
- **Graphics "(a) Yes."** This rests on two of those unverified ids. The template must also exist on whichever Mac opens the file.
- **Wide to vertical "Yes for solo."** The face detector ran only on a blank frame, so it has never found a face here.
- **Retake ratings of "reliable."** The only test audio was the Mac's synthetic voice.
  - The seller's own cutting notes (`ccs/studio/…references_cutting.md:16-19`) say Whisper word times run 0.1 to 0.3 s off and that it can invent a word at a cut. They re-check each cut with an 0.08 s silence pass.
  - Our tool drops invented words only in silences of 5 s or more (`transcribe/lib.js:52`). Retake pauses are shorter.
- **Word times at "22% slower", by hand "Nothing."** The answer omits three things from the cutting report: `-nfa` changed the text (1,160 words against 1,172), one sentence start moved 6.7 s, and the worst word was 1.09 s off. A single pass would therefore change the `.srt` the page already depends on.
- **Section 3, "We have."** Three of the six items are unbuilt: the Final Cut route, script matching, and brand fonts with vertical crops.
- **"Programs: $0."**
  - **Final Cut:** holds as far as I can tell. The App Store ids match the one-time-purchase listings as I remember them (not verified against Apple).
  - **HyperFrames:** brings headless Chrome and npm packages, against the repo's no-packages habit.
  - **`ffmpeg-full`:** `brew info ffmpeg-full` shows "Not installed", keg-only, with 47 dependencies including `whisper.cpp`, which the live tool uses.
- **"We cannot reuse their files."** True without buying. The saved terms (`ccs/terms.txt:104-111`) let a buyer adjust templates and settings for their own use.
  - They also bar lending the copy or access to anyone; each user needs their own purchase.
  - Every `[plugin repo]` fact in the answer was read from a paid product without buying it.
- **"$67 until 15 October."** The seller report found the timer was set on 10-10 and the page shows both 5 and 7 days. Treat it as marketing.
- **Max API credit.** The amounts are right. Anthropic's page lists Claude Code as not covered and the Agent SDK as covered, so whether a `claude -p` job on a key draws on it is not verified. New subscribers wait 7 days (https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers).
- **Hashtags "not stated."** They exist today: at most 3, at the end of the YouTube description or Instagram caption (`app/src/rules.js:7`, `app/src/instructions.js:59`).

Three claims I confirmed:
- The ffmpeg here has no `subtitles`, `ass` or `drawtext` filter (`ffmpeg -filters`, `-buildconf`).
- Final Cut's scripting dictionary has only `get` (`/Applications/Final Cut Pro.app/Contents/Resources/ProEditor.sdef`).
- Bare mode will become the default for `-p` (https://code.claude.com/docs/en/headless).

## 2. Where "yes" breaks

- **Final Cut file (stage 3).**
  - **Nobody to open it:** nobody is known to cut in Final Cut; it is on Jason's Mac Studio only.
  - **Media path:** `media-rep src` is an absolute path on that Mac. Videos are filed in Dropbox, so the project opens offline on any other Mac and needs relinking.
  - **Library location:** Apple says not to keep libraries with third-party cloud storage (https://support.apple.com/en-us/105044, read from a search summary, not the page itself). "Choose the library" therefore has a wrong answer in the very folder she is working in.
  - **Frame rate:** Zoom and phone files are often variable frame rate (not verified on hers), and FCPXML wants one frame duration. The seller avoids this by re-encoding to 30 fps and re-transcribing.
  - **Audio offset:** `lib.js:46` extracts audio without handling a stream start offset, which would shift every cut by that offset (not verified on her files).
- **Cut suggestions (stage 2).**
  - It depends on Whisper writing every repeat, which is untested on real speech.
  - There is no screen where Sallie confirms a take. The page cannot show video or read the Mac's disk, so "confirm" means Jason in Claude Code or editing a text file.
  - CapCut has no cut-list import, so she would redo each cut by timecode. The useful hand-off is a full-quality pre-cut MP4, which the answer offers only as a low-resolution preview.
- **The suite (stage 6).** It rebuilds what the seller sells for $67: HyperFrames, effects, head location and render checks. Unattended Claude also rests on launchd reading the Keychain, which is not verified.

## 3. Manual work left out or shrunk

- **Take confirmation is the edit.** An hour of scripted footage may hold dozens of repeated lines. No time saving is estimated anywhere.
- **Watching.** "Watch it" for an hour of footage is an hour, per round.
- **Caption proofing.** The 72-minute file had 1,251 captions.
- **Motion work.** A branded lower third with settable text needs Motion skill neither of them is recorded as having.
- **B-roll.** No library is known to exist. Labelling 100 clips by hand is hours.
- **Storage.** This Mac has 252 GiB free (`df -h`). 4K HEVC at 46 Mbit is about 21 GB an hour, and "never deleted" adds previews and versions. Dropbox quota is not mentioned.
- **Upkeep.** Homebrew already removed caption filters from ffmpeg once, in January. Final Cut updates can change template ids. The repo's test-first rule roughly doubles each stage.
- **Tuning.** Pause length and the −45 dB floor need setting on her room and microphone, not "Nothing."

## 4. Stages not useful alone

- **Stage 1.** It hands Sallie nothing new. A raw video dropped in today's folder is already transcribed, and the page has had "The raw recording" since 2026-10-10 (`app/src/transcript.js:10`, commit 61d3bae). Word times only matter if a machine makes the cut; a human editor works fine from caption-line times.
- **Stage 3.** It is useless until someone cuts in Final Cut.
- **Stage 5.** It is useless until a b-roll folder exists.

## 5. Where a non-technical person trips

- **Folders:** three watched folders, and a multi-clip shoot scatters into one dated folder per clip.
- **Files:** the dated folder would hold eight or more files, of which the page accepts only `.srt`, `.vtt` or `.txt`.
- **Final Cut dialogs:** library choice, missing media, missing effect or font, the frame-boundary warning, and export settings.
- **Approvals:** every "approve" step lives in Claude Code.

## 6. Simpler ways nobody listed

- **OpusClip's official Claude connector.** She already uses OpusClip.
  - From a chat it clips a long video, styles captions, cuts fillers and pauses, trims and exports.
  - Sources can be a Dropbox or Zoom link or an upload.
  - It needs an OpusClip Pro Beta, Max or Business plan; hers is unknown.
  - Its post and schedule tools return an approval link rather than acting.
  - It cannot join non-adjacent moments into one clip.
  - Sources: https://help.opus.pro/api-reference/claude-connector, https://www.opus.pro/blog/claude-video-editing-tutorial.
- **Descript.** Remove Retakes in a text editor she could use, plus timeline export to Final Cut FCPXML carrying trims, captions and markers, on the Creator plan and up (https://help.descript.com/export-and-share/timeline-exports). That is stages 2 and 3 bought; price not checked.
- **DaVinci Resolve IntelliScript.** It builds a timeline from a plain-text script, with the best take on track one and alternates on disabled tracks (https://documents.blackmagicdesign.com/SupportNotes/DaVinci_Resolve_20_New_Features_Guide.pdf, read from a search summary). It fits "works from a full script." Forum users report misses.
- **CapCut's own tools.** Transcript-based editing, filler removal and auto reframe; CapCut's pages disagree on which need Pro (https://www.capcut.com/tools/filler-words).
- **auto-editor.** It already writes a Final Cut file of silence cuts, so the import proof needs no writer of ours.
- **An editor's brief.** A new page piece listing retakes and best takes at caption-line times, posted with the Frame.io upload.
- **Buy the seller's pack.** $67, 7-day refund, for Jason to run on the Mac Studio. Their free skill is a $0 test of the method on one of her clips.

Final Cut itself has no silence, filler or retake removal through 12.4 (https://support.apple.com/102825).

## 7. What I would tell Jason differently

Do not start the build order. First spend an hour with what exists: drop one real raw recording into today's folder and read the transcript to see whether her retakes appear in the words at all. Then answer who cuts and in which program, because that decides everything after. For reels, turn on the OpusClip connector in Sallie's Claude, or buy the $67 pack for you to run, rather than rebuilding 26 effects. For retakes in long episodes, try Descript or Resolve's script matching for a month before writing our own. Build only what nobody sells: the raw-recording text package, which already works, an editor's brief piece on the page, and perhaps a full-quality pre-cut MP4 for CapCut. Write the Final Cut file only if you yourself will sit at the Mac Studio as editor. Treat "the suite" as a learning project with no date, not as something Sallie is waiting on.