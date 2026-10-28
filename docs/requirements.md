# BRIMM video: requirements

A living list of what the video editing project should do for Sallie. Add to it and edit it as we go.

- **Source:** Jason's direction of 2026-10-14, below, and the items on video moved here the same day from brimm-operations' requirements (`docs/requirements.md` there, at commit 84a2f61).
- **Last updated:** 2026-10-27.
- **Precedence:** as in brimm-operations, Jason's preferences on this page come first. What Sallie says is input to the design. Where the two disagree, this page wins, and the disagreement is noted, not acted on.
- **Numbering:** the items moved from brimm-operations keep their numbers, so that "L5" means the same thing in both repos.

## Jason's direction

Said on 2026-10-14, word for word:

> video editing should be a separate app/service from BRIMM Operations. open to your suggestions, but I think video editing should be run via Claude code or claude chat. in order for Sallie to be able to do it on her laptop, we will probably have to buy video editing software for it; her laptop does not have final cut pro. it seems like davinci resolve studio would be the best option

## Jason's decisions of 2026-10-25

Said on 2026-10-25, after Sallie's first walkthrough and her notes on it, word for word:

> loosen the lock. the session asks if it is a client session upfront and treats those videos appropriately. the connection to open router is acceptable. this cannot be fully self contained and on machine and still achieve all of the functionality that she wants included.

## Sallie's laptop

A MacBook Pro of November 2024, with an M4 chip and 16 GB of memory. It did not have Final Cut Pro on 2026-10-14; it gets it, as decided below.

## Decisions

- **Which editor Sallie's laptop gets: Final Cut Pro, as on the Mac Studio.** Jason decided it on 2026-10-14 ("Let's stick with final cut pro for now.") and installs it on her laptop, so both Macs use Final Cut Pro. The design's "What this rests on" records the decision; setting her laptop up is `docs/setup/sallies-laptop.md`.
- **The workflows of 2026-10-22.** After his MacBook test stopped at step 2.5 of the test guide, Jason walked through every kind of video with the BRIMM Ops session "Write up the video workflows, user steps marked", and decided the shape below (BRIMM Ops memory, `video-workflow-redesign-2026-10-22`). The design is `docs/superpowers/specs/2026-10-22-brimm-video-light-import-and-fork-design.md`, which supersedes the design of 2026-10-14 where they differ. Nothing of it is built.
- **Her folder's lock, loosened (2026-10-25).** Jason's decisions of 2026-10-25, above, loosen the lock on her folder for Claude. The design is `docs/superpowers/specs/2026-10-26-brimm-video-lock-loosened-design.md`, which replaces section 7 of the design of 2026-10-22 ("Her folder's lock, as an adjustable allowlist") and its phase K. Its phase K1, the open lock, is built behind a per-Mac setting that stays strict on both Macs until Jason opens it after the checks by hand in the Code tab.
- **Two rules of 2026-10-22 changed (2026-10-26).** The proposed architecture of 2026-10-26 (`docs/superpowers/specs/2026-10-26-claude-video-editing-architecture.md`, section 11, decisions 3 and 6) asked about two of the rules below. Jason answered, word for word: "two earlier rules can change". So, as that design proposed:
  - **Footage may leave the Mac, one video at a time.** A video meant for posting may be sent to one named outside tool after a yes for that video, for example Higgsfield to upscale it, or a model on OpenRouter to watch a small copy of it. By default nothing but a prompt Claude wrote leaves the Mac. A client or group session never does.
  - **Claude may drive Final Cut's screen** (Claude Code's computer use), to export finished files and to use Final Cut's own tools. It runs in Jason's sessions first, and is never needed on Sallie's path.
- **The architecture of 2026-10-26: yes, with the render test (H0) as its gate.** After a walk-through of its other open decisions, each with a recommendation, Jason picked on answer cards. Its section 11 holds them in full. In short:
  - **The design:** one edit record per part as the truth, graphics made with HyperFrames, and renders made by brimm-video as the default. If H0 fails, the Swift drawer of the 2026-10-22 design comes back.
  - **HyperFrames** is installed on the Mac Studio for H0, in a scratch folder. Sallie's laptop gets it only after H0 passes, on Jason's yes then.
  - **Higgsfield** is the one source of generated b-roll: its smallest paid plan, bought when that phase starts. Sallie's folder may call only its generation, cost-check and job-status tools.
  - **OpenRouter** stays for pictures only for now.
  - **Typefaces:** Sweet Sans Pro through Adobe Fonts (replaced the same day: see "Fonts come from Adobe Fonts or Google Fonts").
  - **Music:** a library subscription, with Sallie picking the tracks.
  - **Generated media** is labelled for YouTube's disclosure question. No generated people who could pass as real, and never a generated Sallie, face or voice.
  - Nothing of it is built.
- **Fonts come from Adobe Fonts or Google Fonts (2026-10-26).** Jason, word for word: "we will find a replacement font, available either through adobe or google fonts, if needed."
  - Sinthya is on neither, so its replacement script is picked by eye: still open.
  - **Josefin Sans replaces Sweet Sans Pro.** H0's font check on the Mac Studio said MISSING for Sweet Sans Pro: it never became active there, not even in TextEdit. Jason said "lets change it out" and picked Josefin Sans, from Google Fonts, on an answer card from a sheet of five faces set in the guide's three roles.
  - The test is written up as `docs/phase-h0/checklist.md`.
- **Versions with their changes (2026-10-27).** Reading the architecture, Jason said, word for word:

  > versioning is great. as new versions/edits are created, claude should keep track of what was changed or added in each version so that the user could ask for a list of versions so that they can see each version with a list of changes and then either go back to a previous version or request that certain aspects of the version be brought into a new edit. for example, use the title but delete the graphics from version 5 in the new version.

  The architecture's section 4.2, "Versions, and what changed in each", says how. Nothing of it is built.
- **The HyperFrames app (2026-10-27).** Jason, word for word:

  > the hyperframes mac app seems to do everything that we want to do. brimm video, it seems, attempts to do some of the more sophisticated hyperframes functionality but not as well. some aspects of brimm video are needed in order to pass information to Brimm Ops, but the graphics editing, cutting reels, etc all duplicates work that hyperframes can do. re-imagine the brimm video workflow, incorporating direct interaction with the hyperframes app by the user. what would the workflow look like for a raw unedited video and 1-5 minute clips shot on iphone. zoom sessions with clients can also be used, but the full text should never be passed to an ai model. in the case of zoom sessions, brimm video could identify clips of Sallie talking that have important learnings to incorporate as long as client information is stripped out. some of those short clips could even be used for short reels.

  The proposal answering it is `docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`; its section 9 lists what it asks of Jason. Nothing of it is decided or built.

  Jason revised the session part the same day, word for word:

  > revisions: for teachings, client words can be left in. we may need to ask their permission first. can those sessions be excluded from being used for AI model training? those session videos should be analyzed when dropped in, and claude produces clips, or timestamp suggestions for clips, that can be shared with hyperframes. the full video should not be sent there as a default that can be overridden by the user after confirming client consent for their words OR confirmation that the clip is just Sallie speaking (client identities deleted if possible)

  So these replace the first wording's rule that a session's full text is never passed to an AI model:
  - **Teachings:** the client's words may go to Claude for teachings, with no permission needed (decision 5, below). Today's session reading, which sends the meeting's transcript with the other speakers' names replaced, fits this.
  - **Training:** only on an account whose training setting is off, as today's training gate checks.
  - **HyperFrames:** nothing of a session goes there by default. Sallie may override that for a clip, after confirming the client's consent for their words, or that the clip is her alone, with the client's identity taken out where possible.

  The proposal's section 5 is written to this.

  Jason's answers to three of the proposal's decisions, the same day, word for word: "5. no", "6. yes", "10. yes". That is:
  - **5. No client permission is needed** for Claude to read a session's whole transcript for teachings.
  - **6. Jason emails HeyGen** to opt the account out of AI training. Until HeyGen confirms it, no session clip uses HeyGen's features: the Script panel, Share or the cloud.
  - **10. A Zoom download is treated as a session** the moment it is dropped, and Sallie can correct one.

  Then his answers to the rest, word for word: "1. confirmed your assumptions", "2. yes", "3. will upgrade to lowest tier paid account", "4. yes", "5. yes", "6. yes", "7. yes". The chat showed the open decisions numbered 1 to 7, so his 5, 6 and 7 answer the proposal's decisions 7, 8 and 9. That is:
  - **The design is accepted.** The HyperFrames app edits. brimm-video does intake, projects, sessions and the hand-off to BRIMM Ops.
  - **The HyperFrames app is installed on the Mac Studio** for the app test, A0. Sallie's laptop comes after it, on his yes then.
  - **HeyGen on its lowest paid tier,** with the BRIMM brand kit in its workspace.
  - **HeyGen may transcribe videos meant for posting,** in the app's Script panel.
  - **Share links for invited people only.**
  - **Higgsfield waits** until A0 shows whether the app's b-roll is enough.
  - **H0 stops after step 4.** A0, `docs/phase-a0/checklist.md`, runs instead.

## The workflows (2026-10-22)

What brimm-video must do, as Jason decided it on 2026-10-22. The design says how.

- **One drop, a light import.** Each Mac has one drop folder, for every kind of video. On a drop brimm-video makes the transcript, the words with their times, the `.srt`, the cut plan (whose `.txt` is the cut log) and the rough cut's transcript, matches the video against open episodes (a new version of one is a later revision of it), and says "Ready". It asks Claude nothing and renders nothing on a drop: no rough-cut video, no Final Cut file, no Reel previews.
- **The kind is asked before Claude reads anything.** In her Claude chat, Sallie answers one clickable question: finished by her editor, raw with retakes, an iPhone clip, or a client or group session. The guess comes first; a session is always offered and never guessed. Her answer picks what Claude is asked. A wrong answer is corrected by asking again with the right kind.
- **Finished videos** (most of them; her editor keeps long-form): Claude suggests Reels, with times and why, and spellings. No title, no Reels question. The hand-off is written at once, with no Final Cut.
- **Raw videos with retakes** (mainly mid-length ones she does not send to the editor): Claude's cut decisions and Reel suggestions, a rendered rough cut she can watch outside Final Cut, and editing by talking to Claude. Sallie never opens Final Cut; names, titles, the logo and graphics on the main video are easy to add by chat. Nothing is printed on the main video: no running captions.
- **Client and group sessions:** the transcript, and, when she asks for its teachings, BRIMM business principles with no client names, and Reel ideas where Sallie alone speaks, either to film again ("reels to film") or cut from the session with the client's agreement noted. A session is never sent to OpusClip, and no transcript of it goes in a hand-off. Its words go to Claude only when she asks for its teachings, on a Claude account whose training setting is off. She may clear a session mark herself, after a confirming question, and the clearing is logged.
- **iPhone clips** are rare here (they stay path A); one dropped in gets short-video handling.
- **Reels only on request.** "Show me the Reel suggestions" reads a text file; a Reel is made, with its faces and preview, only when she asks. A Reel's words and captions are on its picture.
- **Times in the chat** are on the rough cut's timeline, then on the newest version's. "Show me the transcript" shows the rough cut's transcript with its times.
- **Assets:** a `BRIMM Video/Assets` folder with the brand's logos (never the "with Sallie Holder" marks) and graphics made as needed, by Sallie in Canva or elsewhere, or by Claude in the chat.
- **Zoom:** recordings from Zoom are taken by the same drop, through phase T; `BRIMM VIDEO Transfer` retires after two weeks of both running side by side.
- **Her folder's lock** is an allowlist that can be changed as her work changes, and can admit a connector later. brimm-video never uploads video: OpusClip takes an episode's YouTube link. Option b (her folder sending that link to OpusClip) comes after a test in the Code tab. On her laptop it is to be open (built in K1, off on both Macs until Jason opens it after the checks by hand), but for a fixed never list (2026-10-25): Claude may help with graphics, other programs and named design skills, and with the web once a check in the Code tab shows the app's secrets stay out of her commands. Kept locked: the code and the episode records change only through brimm-video; a session's words never come into her chat but as its approved teachings, and a chat that has them runs brimm-video only; nothing is posted or published. OpusClip's posting tools stay denied.
- **The hand-off, version 2,** shared with BRIMM Ops: kinds for a finished video and a session, no episode title (titles live only on the page), a session's approved principles. A Reel's words on the picture still travel in it.
- **Kept:** the tool drafts and never posts, sends or publishes; no video or sound leaves the Mac. (The second part changed on 2026-10-26: see "Decisions".)

Jason's answers to the design's questions, the same evening:

- **brimm-video renders its own versions:** no to driving Final Cut's screen; yes to the render test first (R0). (The no changed on 2026-10-26: see "Decisions".)
- **Fine edits by chat are a must:** "if sallie can't do fine edits via chat, then she won't use this." Nobody finishes her raw videos in Final Cut.
- **Sending:** "option b is not sending. sending is ok when needed." Posting and publishing stay forbidden. Jason tests OpusClip with an existing clip's YouTube link.
- **A session first handed off as another kind:** the page redacts the earlier words in place.
- **Reels of a finished video** are made both in brimm-video and in OpusClip. Graphics Claude makes are text cards (widened on 2026-10-26: see "Decisions"). Jason adds the logos to the Assets folder himself.
- **The question card** asks a second question ("a private session with a client or a group?") for every video; a finished video's hand-off is written once the spellings are answered; a caption track goes in the final video, and an iPhone clip gets captions drawn on it only when she asks.
- **Jason's MacBook** gets a drop folder of its own once `BRIMM VIDEO Transfer` retires.

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
- 2026-10-22: recorded Jason's workflows of 2026-10-22, decided after his MacBook test and the walkthrough with the BRIMM Ops session "Write up the video workflows, user steps marked": a new section, "The workflows (2026-10-22)", and a line under "Decisions" naming the design that carries them, `docs/superpowers/specs/2026-10-22-brimm-video-light-import-and-fork-design.md`. Nothing is built. L5 below describes the tool as it was built and has not been changed. The same evening, Jason's answers to the design's questions, recorded under that section.
- 2026-10-26: recorded Jason's decisions of 2026-10-25, word for word, under a heading of their own; a line under "Decisions" naming the design that carries them, `docs/superpowers/specs/2026-10-26-brimm-video-lock-loosened-design.md`; and, in the lock's line of "The workflows (2026-10-22)", what opens on her laptop and what stays locked. Its phase K1, the open lock, is built and stays off on both Macs until Jason opens it on her laptop after the checks by hand. Pictures from OpenRouter, and what brimm-video then sends, are recorded with the phase that builds them.
- 2026-10-26: recorded Jason's answer to two questions of the proposed architecture of the same day, `docs/superpowers/specs/2026-10-26-claude-video-editing-architecture.md`: "two earlier rules can change". A line under "Decisions" says what changed: a video meant for posting may go to one named outside tool after a yes for that video, and Claude may drive Final Cut's screen. The two lines of 2026-10-22 they change point to it.
- 2026-10-26: recorded Jason's answers to the architecture's other decisions, picked on answer cards the same day: a line under "Decisions" says what he chose, and the 2026-10-22 answer on text cards points to it. Sinthya's purchase is still open.
- 2026-10-26: recorded Jason's answer on fonts, word for word, under "Decisions": a replacement from Adobe Fonts or Google Fonts, if needed. Sinthya's replacement is still to be picked. Added the render test's checklist, `docs/phase-h0/`.
- 2026-10-26: recorded that Josefin Sans, from Google Fonts, replaces Sweet Sans Pro, after H0's font check on the Mac Studio said MISSING. The H0 checklist and its test files now use Josefin Sans.
- 2026-10-27: recorded Jason's direction on versions, word for word, under "Decisions": a list of versions, each with what changed, going back to one, and bringing parts of one into a new edit. The architecture's section 4.2 says how. Put the font lines after the architecture's own list, where they belong.
- 2026-10-27: recorded Jason's direction on the HyperFrames app, word for word, under "Decisions", with its rule that a session's full text is never passed to an AI model, and the proposal that answers it, `docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`.
- 2026-10-27: recorded Jason's revision of the session rules, word for word, under "Decisions": client words may be left in for teachings, perhaps with permission; sessions kept out of AI training; Claude suggests clips at the drop; nothing of a session goes to HyperFrames unless Sallie confirms consent or a clip of her alone.
- 2026-10-27: recorded Jason's answers to the proposal's decisions 5, 6 and 10, word for word, under "Decisions": no client permission needed for teachings; he asks HeyGen to opt out of training; Zoom downloads are sessions at the drop.
- 2026-10-27: recorded Jason's answers to the rest of the proposal's decisions, word for word, with how his numbers map to the proposal's: the design is accepted, the app is installed on the Mac Studio for A0, HeyGen on its lowest paid tier, HeyGen transcription for videos meant for posting, Share for invited people only, Higgsfield waits, H0 stops after step 4. Added A0's checklist, `docs/phase-a0/`.
