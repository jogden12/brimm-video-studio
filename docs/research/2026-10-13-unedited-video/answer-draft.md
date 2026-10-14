# Unedited-video workflow: can we recreate Claude Creator Studio ourselves?

Source tags: [page] https://paid.tenfoldmarketing.com/claude-creator-studio · [terms] https://paid.tenfoldmarketing.com/claude-creator-studio/terms.html · [checkout] https://paid.tenfoldmarketing.com/claude-creator-studio/checkout.html · [plugin repo] https://github.com/tenfoldmarc/studio-plugin · [free repo] https://github.com/tenfoldmarc/video-edit-skill · [tested here] = measured read-only on the Mac Studio with synthetic speech and test-pattern video, not her footage · file references are in the BRIMM Ops repo.

## 1. Can it be recreated?

Yes for the working method, no for the seller's ready-made library, and what Jason asked for is wider than what they sell. Their product is a Claude Code plugin that turns a few vertical phone clips of one person talking into a finished 9:16 reel [page]. Its steps are transcribe, write a cut list, assemble, caption, render [plugin repo]. Those steps use free tools (ffmpeg, Node, Python, Whisper, HeyGen's HyperFrames renderer) [terms], and most are already on the Mac Studio. We cannot reuse their files: the repository is public but has no licence and the terms forbid copying [plugin repo][terms]. So their 26 effects, 19 caption styles and eight styles would each be our own build. Their product does not watch a folder, write descriptions, hashtags or post text, pick clips from a long episode, or write a Final Cut Pro file [page][plugin repo]; the no-timeline finding rests on the repository's file list only. We have the first three or can add them cheaply. A Final Cut file is realistic but has not yet been opened in Final Cut. What no version can do: see which take looks better, decide the look, supply b-roll, music, fonts or logo, or replace the final watch-through. All video work would run on the Mac Studio; the page takes text only.

## 2. Capability by capability

| Capability | What it is | Build it? | Needs installed or bought | By hand, once | By hand, every video |
|---|---|---|---|---|---|
| **Watch a separate folder** (Jason; seller has none) | A third watched folder marked "raw" that gets the extra outputs below. Today every folder is treated the same (`transcribe/transcribe.js:218`, `251-264`). A folder inside the main one works, as the Zoom one does (`README.md:75`). | Yes | Nothing. Re-running `install.sh` rewrites the folder list, so it needs Jason's yes (`CLAUDE.md:43`). | Make the folder. Decide how a shoot of several clips is grouped: one video gets one dated folder today and subfolders are not read (`transcribe.js:208`, `lib.js:36-43`). | Drop the file in. |
| **Transcribe** (both) | Today's `.srt` and transcript, plus a time for every word, a saved list of pauses, and the picture's length, frame rate and size from ffprobe. One whisper pass can write both the `.srt` and word times [tested here]. With `-nfa -dtw`, word starts were a median 0.07 s off and 76% within 0.1 s; not verified on her footage. About 22% slower: the 72-minute video goes from about 3 minutes to under 4 (extrapolated). Upstream calls word times experimental (https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/README.md). | Yes | Nothing. Optional voice-detection model, 864 KB; its effect is not verified. | Nothing. | Nothing. |
| **Recommend cuts of extra footage and retakes** (Jason; seller's "take picking and dead-air removal") | A list of ranges to keep and cut, each with a reason. None of these ratings is measured on real footage. Long pauses: reliable. "Let me do that again": reliable when transcribed. A line said two or three times: reliable to detect, and she records from a full script (`docs/requirements.md:221`), so takes can be matched to script lines. Mid-sentence false starts: medium. Filler words: low to medium, so they are marked, not cut. | Partly. It finds candidates and proposes the last complete take. It cannot see which take looks better. | Nothing. Optional `brew install auto-editor`, which cuts by loudness only (https://github.com/WyattBlue/auto-editor). | Agree how long a pause counts as a cut. Supply her script as a file if one exists. | Confirm the take for every repeated line. Choose between takes by how they look: Claude can compare one still per take for framing, exposure, blur and whether she faces the camera, not movement or energy. Make or reject every filler cut. Restore any repeat that was deliberate emphasis, a known failure of this method (https://chasejarvis.com/blog/descript-underlord-ai/). |
| **Rough-cut preview** (seller's assembled file) | A low-resolution video of only the kept ranges, made by ffmpeg in one frame-accurate pass with a short sound fade at each join. A 60-minute 1080p source takes about 2.7 minutes, 4K HEVC about 12 [tested here]. Her camera format is not known. | Yes | Nothing. | Nothing. | Watch it. |
| **Captions** (both; seller: 19 styles, word-timed, clear of the face and Instagram's safe zone [page]) | (a) A caption file, which exists today. (b) Styled word-by-word captions burned into the picture. | (a) Done. (b) Partly: a few looks of our own through `.ass` subtitles (font, colours, outline, position, fade, scale "pop", two-to-three-word chunks; https://aegisub.org/docs/latest/ass_tags/), not 19. A rounded pill behind the active word and emoji animation are hard; not verified. | Either `ffmpeg-full`, because this Mac's ffmpeg has no libass or freetype and cannot burn text in [tested here] (https://github.com/Homebrew/homebrew-core/pull/261303). Or nothing, in Final Cut 12.4: import our `.srt`, or use Generate Captions (five animation styles, 9:16 safe area, U.S. English only, a click a file cannot trigger; https://support.apple.com/guide/final-cut-pro/generate-subtitles-automatically-verd6d52c4e8/mac). | Choose the caption look: font, size, colours, outline, position. A paid brand font must be installed on the Mac; ours can use any installed font, while the seller's swaps a paid font for the nearest free one [plugin repo]. | Correct misheard words and names. On the Final Cut route, the import or Generate click. |
| **Graphics** (Jason; seller's FX Pack, 26 effects [page]) | (a) Titles, lower thirds and name cards at the right moment. (b) The seller's effects: short segments built as HTML and rendered by HyperFrames, such as words behind the head. | (a) Yes, inside a Final Cut file: a title points to a Motion template on that Mac and carries the text, font, size and colour. Final Cut ships 495 title templates, 36 of them lower thirds [this Mac]. The id format for a custom template is not verified. (b) Partly: each effect is its own build. | (a) Nothing; Motion 6.4 is installed. (b) HyperFrames, free, Apache-2.0 (https://github.com/heygen-com/hyperframes). | Build the branded lower third and title card once in Motion. Supply the logo as a file; the seller has no logo feature. | Give the real names, figures and labels each graphic shows; the seller requires the same [plugin repo]. Approve where each sits. |
| **Hashtags, description, post text** (Jason; seller does none) | The BRIMM Ops page already drafts titles, descriptions, clips, captions and posts, and already accepts "The raw recording" as a source (`app/src/transcript.js:10`). It holds back chapters and marks clip times as raw-recording times (`app/src/instructions.js:106-108`, `123`). Whether hashtags are a piece today is not stated in the reports. | Yes, mostly exists | Nothing. | Nothing, unless a new kind of record is added: then a backup, a raised `LAYOUT_VERSION` and a publish with Jason's yes (`CLAUDE.md:16`, `:49`). | She adds the transcript file to the page by hand (`README.md:81`), edits, approves, copies out and posts in each app (`docs/requirements.md:170`). |
| **Final Cut Pro files** (Jason; seller has no editor timeline) | An `.fcpxml` that opens as a project with the cuts made, a marker at each removed retake, alternates held in an "audition", captions, titles, b-roll above the main line, music underneath with its level, and a 1080×1920 format. A sample with most of these passed Final Cut 12.4's own format check on this Mac; none has been opened in Final Cut yet. | Yes, with that one open risk | Nothing: Final Cut 12.4, Motion 6.4, Compressor 5.4 and `xmllint` are on the Mac Studio. A small writer of our own in Node fits the no-packages rule better than the libraries found. | Jason's yes to the first import test, which opens Final Cut and makes a test library. Then export one project back out to capture the exact strings for SRT captions, a vertical format and a lower third. | Open the file and choose the library. Check that cuts land on the right words. Export is a human click: neither the file format nor AppleScript can render (https://developer.apple.com/documentation/professional-video-applications/fcpxml-reference). |
| **Polished, ready-to-post video** (Jason; the seller's whole product: an MP4 plus a 720p phone copy [plugin repo]) | The finished file with cuts, captions, graphics and look applied. | Partly. Either through Final Cut, where a person exports, or rendered by ffmpeg plus HyperFrames as the seller does. Their figure is 20 to 45 seconds of render per 10 seconds of reel [plugin repo]. | `ffmpeg-full`, plus HyperFrames for effects. | All the look set-up in the rows below. | The final watch-through from start to finish, notes, and a re-render or fix. Posting by hand: this project must stop at a file (`CLAUDE.md:11`). |
| **Styles** (seller: eight ready-made, plus Look Builder from a reel the buyer likes [page]) | A saved set of colour grade, layout, pace and caption look. By its own notes Look Builder cannot match music, speed ramps, most transitions or 3D, and its grade is browser colour filters with no LUTs [plugin repo]. | Partly. A style of ours is a settings file made once per look. `docs/requirements.md:252` already says a look such as "moody" works only once defined. | Nothing. | Sallie finds examples of each look she wants, saved as reel files or screenshots, or describes it in words. Someone names each look and signs off a test render. Claude reads stills from the examples, not their motion (https://platform.claude.com/docs/en/build-with-claude/vision). Their product needs the same input, and studying a reel from a link needs an Apify account [plugin repo]. | Say which saved look this video uses. |
| **B-roll** (Jason; seller uses only the buyer's own files, already 1080×1920 [plugin repo]) | A folder of her clips plus one index file with a row per clip. ffprobe fills the technical fields, Claude describes each new clip once from two or three stills, then suggests which clip goes over which words. It appears as a connected clip in a Final Cut file or an overlay in the preview. | Partly. Neither ours nor theirs finds or makes b-roll. | Nothing. | Shoot or collect the clips and save them in one folder. Label each by hand: who is in it (Claude will not name people from faces), where, rights and source, usable start and end. | Save and label any new clips. Approve or change each suggested placement. |
| **Music and sound** (seller: stock sound effects under the voice, no music [plugin repo]) | A music bed or sound effects under the voice. A Final Cut file can hold a music clip with its level and ducking. | Partly: placing yes, choosing and owning no. | Licensed music or sound files; no price in the reports. | Choose and license the tracks and save them in a folder. | Pick or approve the track and listen to the level. |
| **Wide to vertical** (on neither list; needed to cut reels from a wide episode, since the seller requires vertical filming) | A 9:16 crop that follows her face. Apple's face detection ran from a Swift script here at 6.5 ms a frame on a blank test frame; not tested on real footage. A fixed crop per kept range is likely enough for a seated solo speaker. Two people on screen needs to know who is speaking, which is unsolved (https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/). | Yes for solo, partly for interviews | Nothing. Final Cut's Smart Conform is the alternative, as a menu command (https://support.apple.com/guide/final-cut-pro/ver8bad7adc6/mac). | Nothing. | Check the framing. |
| **Green Screen and GIF Finder** (seller) | The speaker cut out over the buyer's own background, at about 12 minutes for a 20-second reel after a 105 MB download [plugin repo]. A Giphy or Tenor GIF on a fitting line. | Not researched; treat as no for now | — | Seller's needs the buyer's own background file. | Rights to GIFs are the buyer's [terms]. |
| **Notes round** (seller: a typed note gives a new render in about two minutes; their figure, not verified) | A change request followed by a re-render. | Yes, when a person works with Claude Code on the Mac. The page already lets her edit drafts. | Nothing. | Nothing. | Type the note and watch again. |
| **Long videos** (seller: same cutting at much higher plan usage, Max recommended [page]) | Hour-long recordings. Ours transcribes on the Mac at no plan usage, 72 minutes in 3. An hour of word-timed text fits one page request at about 140 of 256 KiB (estimate, not measured). | Yes; it is our starting point | Nothing. | Nothing. | Nothing. |
| **Set-up and walkthrough videos** (seller: one install line, about 3 GB of downloads, four videos [page][plugin repo]) | Getting the tools on the machine and learning to use them. | Not applicable | The Mac Studio already has ffmpeg, Node, Python, whisper-cli, Claude Code and Final Cut. | Jason is the support; there are no walkthroughs. | Nothing. |

**The manual work in one place**

Once, at set-up:
- **Looks:** Sallie finds or describes examples of each video style she wants, and someone signs off a test render of each.
- **Brand:** caption font, colours and position; any paid font installed; the logo as a file; a lower third and title card built in Motion.
- **B-roll:** clips collected into one folder and labelled with who, where, rights and usable range.
- **Music:** tracks chosen, licensed and saved.
- **Folders:** the raw folder made, and how a multi-clip shoot is grouped.

For every video:
- Drop the file in, and the script if there is one.
- Confirm takes, choosing by how they look; decide filler cuts and deliberate repeats.
- Give names and figures for graphics; approve b-roll placements; pick the look and the music.
- Correct caption words.
- Watch the whole result, then export (on the Final Cut route) and post by hand.
- Carry the transcript into the page, edit, approve and copy out the text.

## 3. What each side has

**We have, and theirs does not:**
- **A folder watcher:** files the video with its transcript unattended.
- **Long recordings:** 72 minutes in 3, transcribed on the Mac with no plan usage.
- **The text package:** titles, descriptions, clips picked from a long episode, captions and posts, in a page a non-technical person uses on her own plan. Theirs runs only inside Claude Code [terms].
- **A route to an editor's timeline:** Final Cut, Motion and Compressor are installed, and the file can leave alternates and markers for a person.
- **Her script:** takes can be matched to script lines.
- **Brand fonts and wide footage:** any installed font, and vertical crops from a wide shot.

**Theirs has, and we would not match soon:**
- **A tested library:** 26 effects, 19 caption styles and eight styles that work as a set, with a picker page [page][plugin repo].
- **Look Builder from a link**, with Apify connected.
- **Green Screen, sound-effect rules and the GIF finder.**
- **A finished MP4 with no editing program and no export click**, plus its own checks of snapshots and final frames [plugin repo].
- **Updates and four walkthrough videos** [page].

## 4. Build order, smallest first

The sizes are my judgement, not figures from the reports. Every install, launch-agent change and publish needs Jason's yes.

| Stage | Size | What is built | What it hands Sallie |
|---|---|---|---|
| 1. Raw folder | Small | A raw-folder kind; word times, pause list and picture facts saved beside today's files. | Raw footage transcribed and filed like episodes. She can already take that transcript to the page as "The raw recording" and get descriptions, posts and clip picks. |
| 2. Cut suggestions | Medium | A readable cut list from pauses, repeated lines and cue phrases; one still per take on a sheet; a low-resolution preview of the kept ranges. Claude's read of false starts is done by hand in Claude Code at first. | A cut list and `.srt` usable in any program including CapCut, and a preview to watch. |
| 3. Final Cut file | Small for the import proof, medium for the writer | A project with the cuts, a marker per removed retake and captions. | A Final Cut project that opens already cut. Useful only if someone cuts in Final Cut. |
| 4. The look | Medium | Caption style, Motion lower third and title card, and `ffmpeg-full` if captions are burned in without Final Cut. | A captioned, branded cut. |
| 5. B-roll and vertical | Medium | The b-roll index and placement suggestions; face-following crop for solo shots. | B-roll already placed for approval, and a vertical version. |
| 6. The suite | Large | Rendering a finished video without an editor (effects, styles, sound), a notes round, and Claude running unattended. | An MP4 to watch and post by hand. |

Stage 6's unattended step changes project rules. Transcript text and stills would leave the Mac, against "Nothing leaves the machine" (`transcribe/transcribe.js:2`). An API key breaks "no secrets" (`CLAUDE.md:12`). A `claude -p` job on Jason's login may break when bare mode becomes the default (https://code.claude.com/docs/en/headless). Cut footage is never deleted at any stage, by extension of `CLAUDE.md:14`.

## 5. Cost: theirs against ours

**Buying theirs**
- **Price:** $67 until 2026-10-15 5 p.m. Eastern, then $97, one payment [terms].
- **Refund:** 7 days by email [terms]. The company named in the terms shows as dissolved on the federal registry (https://ised-isde.canada.ca/cc/lgcy/fdrlCrpDtls.html?corpId=15423082), which bears on how enforceable that is; any provincial registration is not verified.
- **Upsells:** a $97 course tick-box at checkout and a $197 workshop offered after payment, one click and final sale; the card is saved [checkout][terms].
- **Also needed:** a paid Claude plan. The page says Pro covers roughly 10 to 20 short reels a month (not verified) and recommends Max for long videos [page]. Apify is optional; the reports give no price.
- **It still needs** the same style examples, b-roll, fonts and footage rules from the buyer.

**Building ours**
- **Programs:** $0. ffmpeg-full, auto-editor and HyperFrames are free, and Final Cut, Motion and Compressor are installed.
- **Claude in the page or by hand:** $0 beyond Sallie's plan or Jason's Max.
- **Claude unattended by API:** an estimated $0.50 to $1.50 per hour of raw footage (not measured), at $2 in and $10 out per million tokens for Sonnet 5.5 (https://platform.claude.com/docs/en/about-claude/pricing). Max plans include $100 or $200 of API credit a month (https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers).
- **DaVinci Resolve Studio:** $295, only if Resolve were scripted to render; that requirement is from forum posts, not verified on version 21.
- **The real cost is build time.** The reports give no hours, and no prices for music or fonts.

## 6. Questions for Jason, most important first

1. **Who cuts from the plan, and in which program?** This decides the output.
   - Sallie in CapCut: a cut list, an `.srt` and a preview.
   - The editor in their program, which is unknown: a brief, or a timeline file if it reads one.
   - Jason or Sallie in Final Cut on the Mac Studio: a Final Cut file.
2. **What is "unedited video"?**
   - A scripted solo episode in one long take with retakes.
   - A Zoom interview.
   - A reel shot as several phone clips.
   - All three.
3. **Is the hold on L1 lifted, and where does this live** (`docs/requirements.md:245`)?
   - Lifted, built in this repo beside `transcribe/`.
   - Lifted, as a separate app.
   - Still held: stage 1 only.
4. **Who runs Claude for the cut plan?**
   - A person, by hand in Claude Code or the desktop app (no rule changes).
   - The page, on Sallie's plan (a publish and a record-layout change).
   - A launch agent on Jason's Max login.
   - An API key on the Mac using the Max credit (changes the no-secrets rule).
5. **May raw-footage text and stills go to Claude automatically?**
   - Episodes only.
   - Everything in the new folder, client calls included.
   - Nothing automatic; a person sends each one.
6. **Is her script available as a file for each recording?**
   - Always.
   - Sometimes.
   - No.
7. **Do the look's ingredients exist as files** (fonts, colours, logo, caption style, b-roll, music)?
   - Yes.
   - Some.
   - None: a set-up session is needed, starting with Sallie picking example reels.
8. **Buy theirs as well?**
   - No, build only.
   - Yes at $67 before 15 October, to make phone-clip reels now while ours is built for episodes.
   - No purchase; read the public repository for method only.
9. **Which recording is the first test?**
   - One the editor has already cut, so their kept ranges can be compared with ours.
   - A fresh one.
10. **Where does she receive it, and on which Mac?**
    - In the page.
    - As files in the dated Dropbox folder.
    - Both.

Files are in /private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad:
- fcpxml-check/ (sample Final Cut files)
- ccs/ (copies of the seller's pages)