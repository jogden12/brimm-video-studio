# BRIMM video: requirements

A living list of what the video editing project should do for Sallie. Add to it and edit it as we go.

- **Source:** Jason's direction of 2026-10-14, below, and the items on video moved here the same day from brimm-operations' requirements (`docs/requirements.md` there, at commit 84a2f61).
- **Last updated:** 2026-10-15.
- **Precedence:** as in brimm-operations, Jason's preferences on this page come first. What Sallie says is input to the design. Where the two disagree, this page wins, and the disagreement is noted, not acted on.
- **Numbering:** the items moved from brimm-operations keep their numbers, so that "L5" means the same thing in both repos.

## Jason's direction

Said on 2026-10-14, word for word:

> video editing should be a separate app/service from BRIMM Operations. open to your suggestions, but I think video editing should be run via Claude code or claude chat. in order for Sallie to be able to do it on her laptop, we will probably have to buy video editing software for it; her laptop does not have final cut pro. it seems like davinci resolve studio would be the best option

## Sallie's laptop

A MacBook Pro of November 2024, with an M4 chip and 16 GB of memory. It did not have Final Cut Pro on 2026-10-14; it gets it, as decided below.

## Decisions

- **Which editor Sallie's laptop gets: Final Cut Pro, as on the Mac Studio.** Jason decided it on 2026-10-14 ("Let's stick with final cut pro for now.") and installs it on her laptop, so both Macs use Final Cut Pro. The design's "What this rests on" records the decision; setting her laptop up is `docs/setup/sallies-laptop.md`.

## The items moved from brimm-operations

Moved on 2026-10-14. They were written in brimm-operations, where the tool was in `transcribe/`. The paths in them are this repo's, where it is in `tool/`. The README and the research they name are this repo's too.

### L1. Editing video with Claude

- **Status:** the second use below, a freshly filmed video, was built on 2026-10-13 as L5: a tool on the Mac Studio, separate from BRIMM Ops. The first use, finished reels from an episode’s final cut and the clips the page picks, is still held.
- **Where it came from:** an Instagram reel Jason shared, in which a creator hands Claude raw footage and gets back an edited reel, and asks for changes in a sentence ("make it moody", "tighter cut, bigger captions").
- **How it would work:** the footage is transcribed with a time for every word. Claude reads the words and a few still frames and writes an edit plan: what to cut, the hook, the captions, the title and the look. The plan is shown as a storyboard before anything is rendered. A change is asked for in a sentence and changes the plan. Ordinary video tools on a Mac then cut, reframe and caption the video. This is a reading of the reel, not of the creator's own walkthrough.
- **Two uses:**
  - Clips from an episode. BRIMM Ops already picks five to eight clips for each episode, with times, first and last words, a hook and a caption. From the final cut and those picks it would produce finished vertical reels. This is work she does today in OpusClip and CapCut.
  - A freshly filmed reel. Raw takes in, a cleaned and captioned reel out. The page's "New reel to film" scripts would help match her takes to the script.
- **Where it would run:** on a Mac that has the footage, through Claude Code or the Claude desktop app. It cannot run inside BRIMM Ops, which cannot run video tools or take large files.
- **Limits:** Claude cannot watch video, so it cannot judge which take had better energy. A look such as "moody" works only after it is defined once, with her fonts, colours and caption style. B-roll needs a folder of her clips. Reframing an interview to vertical is harder than a solo episode. The output is a file she reviews and posts herself.
- **A first test would need:** a final-cut episode file, ffmpeg and a transcriber installed on the Mac, and a choice of which use comes first.

### L5. Unedited video

Jason asked for a workflow for unedited video: a watched folder, a transcript, suggested cuts of extra footage and retakes, and "everything needed for Sallie to edit, caption, hashtag, write description or post text". Later the same day he added an upright version for Instagram Reels when a video is horizontal, and shorter clips for Reels and Stories. The aim he named is a video editing suite that writes Final Cut Pro files for polished, ready-to-post videos.

- **Status:** built on 2026-10-13 on Jason’s instruction, in two parts. Neither has met real unedited footage yet: everything was tried on made-up recordings spoken by the Mac’s own voice.
- **The video tool, on the Mac Studio.** `tool/unedited.js` watches the folder `Unedited Video Transfer`. For each video it writes a transcript with a time for every word, a cut plan (retakes, false starts, spoken cues to start over, long pauses), a rough cut to watch, captions that match the rough cut, an upright version for Instagram when the video is wider than it is tall, and a Final Cut Pro project file with the cuts made, the captions, and a marker at each join. Claude then reads the plan through Claude Code on the Mac’s own account: it may cut or keep more, writes notes for the editor with ideas for graphics, and picks short clips, which the tool cuts for Reels and Stories. The video and its sound never leave the Mac; the words of the transcript do, when Claude is asked. The README has the detail, under "Unedited video".
- **What stays in BRIMM Ops.** The Short video format, which is the post text the BRIMM Ops page writes. An episode’s format there can be Short video, beside Solo and Interview. She gives it the rough cut’s transcript, the file ending `.rough-cut.srt`. A short video has one section, Post text: three on-screen hook options, an Instagram caption with hashtags, three titles and a description for the YouTube Short, and a LinkedIn post. No record changes shape. Published on 2026-10-13 in version 6 of the page. That part of L5 stays in brimm-operations' requirements, and is not this project's.
- **What stays manual:** deciding the look, b-roll, music, choosing a take by how it looks, making titles and graphics, the final watch-through, and posting. Claude reads the words and never sees the picture, so every cut is for a person to check.
- **Not part of this:** captions burned into the picture (the caption files are the subtitles), b-roll, music, titles and graphics in the Final Cut file, Stories text, scheduling and posting.
- **The research:** `docs/research/2026-10-13-unedited-video/`. Read the skeptic’s review beside the draft answer: it names cheaper things to try first.

### L6. Presets for the video tool

- **Status:** researched on 2026-10-13 on Jason’s instruction. Nothing is built.
- **What Jason asked:** which popular video editing styles and settings could be grouped into presets. After the first draft he decided the presets are to be combinable: a job, a caption style and a look.
- **What the research gives:** a video gets one choice from each of three short lists, over one brand kit that is never picked. Jobs: Full episode, Solo clip, Interview clip, Teaching clip, As filmed. Caption styles: File only, Plain, Boxed, Bold, Signature. Looks: Natural, Bright, Warm, Moody. Each job names a default style and look. Ten rules that the tool applies by itself keep every pick valid.
- **The brand:** the brand guide’s, by Jason’s decision of 2026-10-13: “the website should follow the brand guide but doesnt always.” The brand kit holds the guide’s colours (navy, fog, light gray, dew, sand, dune, mist, smoke) and typefaces (Sweet Sans Pro, and the script Sinthya). The website’s deep green, cream and Bodoni Moda are what the site shows, not brand values.
- **To build first, when it is built:** one test project made by hand in Final Cut Pro, then Full episode, Plain on Solo clip, the looks Bright and Moody, Bold.
- **What it waits on:** which of the guide’s typefaces to buy and where (Jason will pay for those chosen, 2026-10-14), and whether the guide’s alternates, Varela and then Lucida Grande, may stand in until the font files are here; whether the guide, made in February 2022, is still the newest; Jason’s yes to copy the logo’s files beside the tool (either mark will do, kept as an editable setting, 2026-10-14); a choice of how words get into the picture (this Mac’s ffmpeg cannot draw text); a real recording to judge every value on.
- **The research:** `docs/research/2026-10-13-video-presets/`. Read `presets.md`. It ends with 25 questions for Jason and Sallie.

## Changes

The lines up to the first version of this page were written in brimm-operations, as they stand there, where the tool was `transcribe/`. Only the parts of them about L1, L5 and L6 are here.

- 2026-10-13: added the section "Future features" on Jason's instruction, with L1 (editing video with Claude, held, and possibly a separate app or workflow).
- 2026-10-13: added L5 (unedited video) and built its part in BRIMM Ops on Jason's instruction: a third format, Short video, for which the page writes the post text (on-screen hook options, an Instagram caption with hashtags, a YouTube Shorts title and description, and a LinkedIn post). It is published only when the page is next published. The video tool is described in the README.
- 2026-10-13: brought L5 up to date. The video tool for unedited video is built (`transcribe/unedited.js`, a watched folder on the Mac Studio): a transcript with a time for every word, a cut plan, a rough cut, an upright version, short clips, a Final Cut Pro project file, and Claude’s notes for the editor. The Short video format was published in version 6. Updated L1’s status to point to it. The research is in `docs/research/2026-10-13-unedited-video/`.
- 2026-10-13: added L6 (presets for the video tool) on Jason’s instruction: research only, in `docs/research/2026-10-13-video-presets/`. The presets are combinable, as he asked: a job, a caption style and a look.
- 2026-10-13: recorded under L6 that The BRIMM’s brand guide and the website give two different brands, after Jason pointed to the brand assets. The comparison is `docs/research/2026-10-13-video-presets/brand-guide.md`.
- 2026-10-13: recorded under L6 Jason’s decision that the brand guide is the brand (“the website should follow the brand guide but doesnt always”). The research now follows the guide in every brand value, and L6 says what the presets wait on: the licences and files of the guide’s two typefaces, the name on screen and the logo.
- 2026-10-13: corrected L6 after two more checks of the preset research, which raised 18 problems, all real and all corrected in `presets.md`. The research now ends with 25 questions, and the presets also wait on whether the brand guide of February 2022 is still the newest.
- 2026-10-13: Jason settled the name on screen: Sallie Ogden. Recorded in the brand kit of the preset research. The guide’s two logos that say Holder are not used in a video.
- 2026-10-14: recorded Jason’s answers in the preset research: he will pay for the typefaces chosen; either logo mark will do, kept as an editable setting; anything that still says Sallie Holder is disregarded.
- 2026-10-14: saved the review of the public repo claude-reel-editor (a Claude Code skill that edits reels) in `docs/research/2026-10-13-claude-reel-editor/`, on Jason’s instruction.
- 2026-10-14: first version of this page, in the new repo brimm-video, on Jason's decision that video editing is a project of its own, separate from BRIMM Operations and run through Claude Code or Claude chat. Recorded his direction word for word, Sallie's laptop, and the open decision on her editor. Moved in L1, L5 and L6 from brimm-operations at commit 84a2f61, with their change lines. The tool moved from `transcribe/` there to `tool/` here. L5 now says that the Short video format, the post text the BRIMM Ops page writes, stays in BRIMM Ops.
- 2026-10-14: built phase 1a of the design: episodes on the Mac Studio alone. A video dropped in `BRIMM Video/Unedited Video/Mac Studio/` is imported into its own folder in `BRIMM Video/Episodes/`, every file put into Dropbox as a clone and checked again 15 minutes later, and `tool/edit.js` lists, opens and shows episodes in Final Cut Pro. Described in the README, under "Episodes".
- 2026-10-15: closed the decision on Sallie's editor, as Jason made it on 2026-10-14: Final Cut Pro on both Macs. "Open decisions" is now "Decisions", and "Sallie's laptop" says it had no Final Cut Pro on 2026-10-14 and gets it.
