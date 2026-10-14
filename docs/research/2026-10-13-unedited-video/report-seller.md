# Claude Creator Studio: what is being sold

Fetched 2026-10-13. The plain address returned the full page, so the tokened address was not used. The skill files I read are instructions written for Claude; I read them as documents and ran none of them.

## Bottom line

- **What it is:** a $67 Claude Code plugin (rising to $97) that turns a few vertical phone clips of one person talking into a finished 9:16 reel as an MP4.
- **What it does not do:** it does not write titles, descriptions, hashtags or post text, does not pick clips out of a long episode, does not watch a folder, and does not hand a timeline to an editing program.
- **What it is built on:** the seller's own free public skill plus free open-source tools.
- **The paid plugin is public:** it sits in a public GitHub repository with no licence, and the seller's terms forbid copying or sharing it. We can read it to learn the method but cannot reuse the files.

Sources are tagged: [page] https://paid.tenfoldmarketing.com/claude-creator-studio, [terms] https://paid.tenfoldmarketing.com/claude-creator-studio/terms.html, [checkout] https://paid.tenfoldmarketing.com/claude-creator-studio/checkout.html, [free guide] https://guides.tenfoldmarketing.com/video-edit, [free repo] https://github.com/tenfoldmarc/video-edit-skill, [plugin repo] https://github.com/tenfoldmarc/studio-plugin.

## Product, price, what the buyer receives

- **Name and seller:** Claude Creator Studio, sold by Ten Fold Marketing (Marc Cleroux, Montreal). [page][terms]
- **Price:** $67 until 2026-10-15 5 p.m. Eastern, then $97. One payment, no subscription. [terms]
- **Refund:** full refund within 7 days by email. [page][terms]
- **What is delivered:** instruction files, scripts, effect templates, sound rules and four walkthrough videos, through a buyer portal with email sign-in. [terms]
- **Form:** a Claude Code plugin called `video-studio` (version 1.22.0, about 28 MB), added as a plugin marketplace from GitHub. [plugin repo]
- **Updates and support:** fixes and new effects arrive as plugin updates; support is by email only. [page]
- **Not included:** no course and no community. [page]
- **Add-ons at checkout:**
  - Go Viral System, a 16-module course, $97, as an optional tick-box. [checkout]
  - Live Build Workshop, $197, offered after payment, charged to the same card with one click, and final sale. [terms]
  - The checkout says the card is saved for later purchases. [checkout]
- **Licence:** one buyer, own and client videos, no sharing or reselling, no end date. [terms]

## Capabilities claimed

| # | Capability | Goes in | Comes out |
|---|---|---|---|
| 1 | Take picking and dead-air removal [page] | Raw clips where lines are repeated | One cut with the cleanest take of each line and pauses removed |
| 2 | Captions, 19 styles [page] | The cut's audio | Word-timed captions kept off the face and inside Instagram's safe zone |
| 3 | Eight ready-made styles [page] | One pick | Grade, layout, pace and captions as a set |
| 4 | Look Builder [page] | A reel the buyer likes (file or link), a screenshot, or a description | A saved personal style used on every later reel |
| 5 | FX Pack, 26 effects [page] | A pick, plus per-effect material | A short rendered segment laid over the reel, for example words behind the head or an app screen behind the speaker |
| 6 | Green Screen [page] | One clip plus the buyer's own background video or picture | Speaker cut out and placed over it |
| 7 | Sound Rules [page] | Nothing | Stock sound effects placed under the voice, or none |
| 8 | GIF Finder [page] | A request for GIFs | A Giphy or Tenor GIF placed on a fitting line |
| 9 | Notes round [page] | A typed note | A new render in about two minutes (seller's figure) |
| 10 | Long videos [page] | A YouTube-length recording | The same dead-air and take cutting, at much higher plan usage |
| 11 | First Reel Setup [page] | One pasted install line | Tools installed, with a repair command |
| 12 | Four walkthrough videos [page] | — | Setup, picking effects and captions, sound, one full edit |

What the plugin's own files add (read from [plugin repo], not from the page):

- **The steps:** transcribe, write a cut list, assemble a clean 30 fps file, re-transcribe, locate the head, build an HTML composition, check snapshots, render, check frames of the final file.
- **Output:** a full-quality MP4, a 720p phone copy, and every earlier version kept.
- **No editor timeline:** no file name in the repository suggests a Final Cut, Premiere or CapCut export. This is from the file list only; I did not read every script.
- **Look Builder's stated limits:** it cannot match music, speed ramps, transitions other than a cut or the zoom-through effect, 3D, or b-roll the buyer did not supply.
- **Grade and motion:** the grade is browser-style colour filters only, with no LUTs or film grain. Motion is limited to a small fixed set of entrances.

## Programs, services, computer

- **Computer:** Mac or Windows, with an internet connection. [terms]
- **Claude:** the Claude desktop app with a paid plan; it runs inside Claude Code. [page][terms]
  - The page says Pro handles roughly 10 to 20 short reels a month, and recommends Max for long videos.
- **Named tools:** ffmpeg, Node.js, Python and HyperFrames. [terms]
  - HyperFrames is HeyGen's Apache-2.0 renderer that turns HTML into video: https://github.com/heygen-com/hyperframes.
- **Transcriber:** Whisper [page], run locally through faster-whisper [free repo].
  - The free skill names English-only models. Whether the paid plugin switches models for other languages is not verified.
- **Optional:** an Apify account, needed to study a reel from a link and to pull the buyer's own reels. [plugin repo][free guide]
- **Not used or required:** Remotion, any editing program, any stock or music library.
- **First-run downloads:** about 3 GB of tools in total, plus about 105 MB for the cleaner background cutout. [plugin repo]
- **Speed on Apple Silicon:** [plugin repo]
  - Render: 20 to 45 seconds per 10 seconds of reel, up to 80 with effects.
  - Clean cutout: about 1.2 seconds per frame, so about 12 minutes for a 20-second reel.

## What the buyer sets up or supplies by hand

- **Filming:** vertical, ideally 4K, camera still for each setup, lines repeated until right. [free guide]
- **Folders:** where clips land and where projects live. [plugin repo]
- **Style:** one pick in a local picker page, or reference reels (as files, unless Apify is connected), or a description. [plugin repo]
- **Fonts:** only the open-licence fonts it ships or can fetch; a paid brand font is replaced by the nearest match. [plugin repo]
- **B-roll:** the buyer's own files, already 1080x1920, placed in a project folder. It neither finds nor generates b-roll. [plugin repo]
- **Material for specific effects:** [plugin repo]
  - Reel cover images, at least four.
  - A screen recording or picture.
  - A background video or picture for Green Screen.
  - Real figures, labels, steps, names, or the comment keyword.
- **Footage that qualifies:** many effects need a wide or medium shot, a still camera, or a clear wall. The plugin skips an effect that fails its footage check. [plugin repo]
- **Music:** none is added. [plugin repo]
- **Logos:** no logo feature appears anywhere.
- **Rights:** the buyer is responsible for rights to GIFs, sounds, footage and fonts. [terms]

## Proof shown, and what is not promised

- **Demos:** [page]
  - A 25-second reel said to be cut from five phone clips, shown beside one raw clip.
  - A Green Screen before and after (22 seconds).
  - Four effect clips.
  - I did not watch the videos; this is from their captions and descriptions.
- **Testimonials:** five named email replies and three unnamed. The page says they come from people using the skill the Studio is built on, which is the free one. [page]
- **Not promised:** [terms]
  - No views, followers, sales or income.
  - No guarantee it runs without errors on every machine or that every render succeeds.
  - Liability is capped at the price paid.
- **No trial.** [page]

## Independent information

- **Reviews:** none found. The product launched 2026-10-04, per the page's own source.
- **Free skill** [free repo]:
  - Created 2026-10-01, 16 stars, no licence. It does three looks and uses the same engine. This is first-hand and reliable.
  - One unmerged outside fix, open since 2026-10-09, reports a transcription crash on Windows PCs with an NVIDIA card. Whether the paid plugin shares the bug is not verified.
- **Paid plugin** [plugin repo]: public since 2026-10-09, with ten commits that are mostly update tests.
- **Seller's GitHub:** 62 public repositories, the largest at 829 stars. He ships real, working skills.
- **Community:** a paid Skool group, 78 members at $59 a month (https://www.skool.com/ten-fold). This is from an automated summary of the page; medium trust.
- **Legal entity:** the terms name 15423082 Canada Inc.
  - The federal registry shows it dissolved for non-compliance on 2026-05-10, with 2024 and 2025 filings overdue: https://ised-isde.canada.ca/cc/lgcy/fdrlCrpDtls.html?corpId=15423082.
  - Its registered address there differs from the one in the terms.
  - This bears only on how enforceable the refund promise is. Any provincial registration is not verified.

## Claims not verifiable from the page

- That the demo reels were made entirely by Claude with no editor.
- The two-minute re-render and the 10 to 20 reels a month on Pro.
- The 40 hours of building.
- The identities behind the testimonials and the 4x views claim.
- The 107k followers in the checkout copy.
- That Windows works well; the free skill's README calls Windows support new and lightly tested.
- The LUT testimonial: one reply praises using several LUTs, but the plugin's own notes say the grade has no LUTs.
- The founders deadline: the page source shows it was set on 2026-10-10 to end 2026-10-15, and the visible copy says both 7 days and 5 days.

## This Mac

"JCO mac studio" (M1 Max, macOS 27.0.1) already has ffmpeg 9.0.2, Node 26.11.1, Python 3.13.0, whisper-cli and Claude Code. Final Cut Pro, Motion and Compressor are installed; DaVinci Resolve and CapCut are not. Nothing was installed or changed.

Working copies of the fetched pages are in `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/ccs/`.