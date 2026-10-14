**Where an unedited-video workflow would run, and how it fits BRIMM Ops as it stands (2026-10-13)**

Nothing was changed. Nothing under `~/Library/CloudStorage/` was read or listed, and the landing page was not opened for this question. No `claude -p` run was made, because it would spend usage.

## Found on this Mac (read-only checks)

- This is the Mac Studio ("JCO mac studio", M1 Max, 32 GB). It has ffmpeg and ffprobe 9.0.2, whisper-cli 1.9.5 with the large-v3-turbo model, Node 26.11.1 and Claude Code 2.1.296.
- `claude auth status` reports a claude.ai sign-in on a "max" plan (Jason's). Whether it is Max 5x or 20x is not verified.
- `/Applications` holds Final Cut Pro 12.4, Motion 6.4, Compressor 5.4, iMovie and Claude.app. CapCut, DaVinci Resolve and Premiere are not there.
- The launch agent `com.thebrimm.transcribe` is installed and watches two Dropbox folders: "BRIMM VIDEO Transfer" and "Zoom Video Transfer" inside it (`~/Library/LaunchAgents/com.thebrimm.transcribe.plist`).
- Its log shows the 72-minute Zoom recording done in 3 minutes, with 1,251 captions.

## 1. What the transcript tool would have to change

**What it does today**

- Every watched folder is treated the same. `parseArgs` knows only `--watch`, `--out` and `--model` (`transcribe/transcribe.js:251-264`), and each folder runs through the same `transcribeFile` with the same settings (`transcribe.js:218`, `228-249`).
- Per file it takes the sound out as 16 kHz mono and discards the picture (`-vn`, `transcribe/lib.js:46`).
- It runs whisper with `-ml 60 -sow -osrt` (`lib.js:49`), so there is one time per caption line.
- It finds silences of 5 seconds or more at −45 dB (`lib.js:52`) and uses them only to drop captions written over silence (`lib.js:72-87`). The silence list is not saved.
- It respells Sally as Sallie (`lib.js:90-93`).
- It writes `<name>.srt` and `<name>.transcript.txt` (`lib.js:22-25`, `transcribe.js:145-148`) and moves the video with both into a dated folder (`transcribe.js:71-100`).
- The plain-text file keeps whole seconds only (`app/src/transcript.js:32`, `:64`).

**What an edit plan needs that it does not write**

- **A folder kind.** A new flag (for example `--watch-raw`) in `parseArgs`, carried per folder, and written into the plist by `install.sh:52-82`.
  - A folder inside the main one works, as the Zoom one does: "The tool looks only at the files directly in a watched folder, never in a folder inside it" (`README.md:75`).
  - Re-running `install.sh` replaces the folder list (`README.md:75`), so it needs Jason's yes (`CLAUDE.md:43`).
- **A time for every word.** This whisper-cli has `-ml 1`, `-oj`/`-ojf` (JSON) and `-dtw MODEL` (`whisper-cli --help`).
  - The README calls word-level timestamps experimental (https://github.com/ggml-org/whisper.cpp).
  - The 60-character `.srt` must then be built from the words, or whisper run twice.
  - Word-time accuracy on her footage is not verified.
- **Pauses as a file, and finer.** Today only silences of 5 seconds or more are found, and nothing is kept. Retake gaps need roughly 0.5 to 1 second.
  - `--vad` exists but needs a separate model download (same README), which needs Jason's yes.
- **Facts about the picture.** There is no ffprobe call today. A cut list or Final Cut file needs duration, frame rate, frame size, rotation and start timecode.
- **Stills.** None are written. ffmpeg can write them.
- **Kept and cut ranges.** No such file exists. It would be new, written by rules (pauses, repeated sentences), by Claude, or both.
- **A unit larger than one file.** Today one video gets one dated folder (`lib.js:36-43`). A shoot of several takes or clips has no home, and subfolders are never read (`transcribe.js:208`).

**What works against it**

- Whisper tends to leave out fillers and stutters, so retakes show as pauses and repeated sentences, not as "um". This is not verified on her footage.
- Runs are serial under a lock (`transcribe.js:159-223`), so a slow Claude step would hold up later videos.
- The done-banner shows only on the Mac Studio (`transcribe.js:278-281`).
- The tests would need a stand-in for Claude as well (`CLAUDE.md:31`, `:39`).
- The tool runs from the checked-out `main` (`README.md:91`), so a merge is a deploy.

## 2. Four ways Claude could write the plan and the post text

**Sizes for one hour of speech.** These are my estimates, made by re-shaping the repo's two 23-minute fixture transcripts (142 to 155 words a minute). They are not measured on whisper's real output.

| Form | Size per hour |
|---|---|
| Caption lines, as today | 60–63 KiB |
| One start time per word | 112–121 KiB |
| Start and end per word | 175–190 KiB |
| An `.srt` with one word per caption | 345–376 KiB |
| Whisper-style JSON | about 1.4–1.5 MiB |

### (i) In the BRIMM Ops page, on Sallie's plan

**What `sample` takes** (contract 0.2.75 type definitions, `/private/tmp/claude-501/bundled-skills/2.1.295/c2e0ae6275dc712fb7de08d333c80a1f/artifact-capabilities/0.2.75/sample.d.ts`):

- Text up to 262,144 bytes in total (`:145`, `:226`, `:559-562`).
- Images only if the page declares `sample: {images: true}`: JPEG, PNG, WebP or GIF, each up to 20 MB, 10,000 px a side and 64 megapixels, downsized to about 1.2 megapixels (`:320-336`).
- How many images per call is given only at run time by `limits()`: not verified.
- No sound or video. About five minutes per round (`:70-75`). It spends the viewer's own usage (`:45-48`).
- The page cannot fetch files, so she would pick each still by hand.

**The page's own limits:**

- `MAX_PROMPT_BYTES = 262144` (`app/src/instructions.js:13`).
- `MAX_CHARS = 200000` (`app/src/transcript.js:4`).
- `MAX_RECORD_BYTES = 255000` (`app/src/app.js:19-20`).
- It accepts `.txt`, `.vtt` and `.srt` (`app/src/views.js:185`).
- A request today carries 13 to 20 KB besides the transcript (`docs/research/2026-10-09-package-test.md:52-54`).

**Does an hour of raw footage fit?**

- Yes with one start time per word: about 140 of 256 KiB.
- `MAX_CHARS` stops it near 1 hour 40 minutes.
- With start and end times, about one hour is the ceiling.
- The per-word `.srt` and the JSON do not fit.
- Raw footage runs longer than the finished episode, and a multi-clip shoot does not fit one record.

**It is not drop-in.** I ran the page's own reader on a word-per-line sample:

- `indexTranscript` (`transcript.js:111`) turned `0:00.3 your` into `3 your`, and the quote search failed.
- `tidyTranscript` flattened a one-word `.srt` to whole seconds (`transcript.js:32`).

**A smaller route.** The page keeps the caption-size transcript, Claude names the first and last words of each kept range, and code on the Mac looks up the word times. The page already does this for clips (`docs/requirements.md:249`).

**What it costs and breaks:**

- $0 beyond her plan.
- A new kind of record means a backup and a raised `LAYOUT_VERSION` (`CLAUDE.md:49`), then a publish with Jason's yes (`CLAUDE.md:16`).
- Images change the declared capabilities (`CLAUDE.md:48`).
- She carries the file in by hand (`README.md:81`) and the plan out by hand.
- The download allowlist has no `.fcpxml`, `.xml`, `.srt` or `.edl` (`downloads.d.ts:20-22` in the same folder). A plan leaves as `.json`, `.txt` or `.csv`.
- "The page does nothing while it is closed" (`docs/superpowers/specs/2026-10-09-brimm-ops-page-and-episode-package-design.md:140`).
- Her plan's limit is unknown (`package-test.md:98`), and answers above 13,000 characters are untested (`package-test.md:99`).
- The help-centre warning stands (`docs/requirements.md:271`).

**What fits already:**

- She wants item 5 in "A page" (`requirements.md:197`).
- The page already has "The raw recording" as a source (`transcript.js:10`) and writes post text from it. Chapters are withheld (`instructions.js:106-108`) and clip times are marked as raw-recording times (`instructions.js:123`).

### (ii) `claude -p` started by the launch agent, nobody present

- **How it runs.** `-p` runs once and exits. It takes stdin up to 10 MB, `--json-schema`, `--tools ""` or `--allowedTools`, and `--permission-mode dontAsk` (https://code.claude.com/docs/en/headless). `--permission-prompts none` denies anything that would ask.
- **Sign-in.** It uses the stored `/login` subscription login from the macOS Keychain, unless an API key or other credential outranks it. `claude setup-token` makes a one-year subscription token for scripts, used as `CLAUDE_CODE_OAUTH_TOKEN`, which can only make model requests (https://code.claude.com/docs/en/authentication).
- **`--bare`.** It never reads the login or that token and needs an API key. The headless page says bare will become the default for `-p` in a future release, which would break a login-based job.
- **May a subscription login be used this way?** Yes, as of this week. The help article says `claude -p` and the Agent SDK under a plan sign-in still draw on plan limits, and that a planned move to a separate credit was paused on 2026-06-15 (https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan).
  - The legal page says plan limits assume ordinary individual use, and bars third-party products from offering Claude sign-in (https://code.claude.com/docs/en/legal-and-compliance).
  - Jason's own script on his own Mac is within that, by my reading.
- **Not verified.** Whether a launchd job reads the Keychain login without a prompt. The docs name only SSH as a locked case.

**What it costs and breaks:**

- $0, but on Jason's plan, not Sallie's.
- It fails when his limit is hit or the login expires. The docs warn about this for unattended runs.
- Transcript text and stills leave the Mac, against `transcribe.js:2` ("Nothing leaves the machine.") and `install.sh:14`.
- A token placed in the plist is a secret on disk.
- It may only write files. A database write needs "Jason's yes in chat first" (`CLAUDE.md:16`).
- Without `--bare` it loads this repo's CLAUDE.md and Jason's plugins and connectors, unless restricted.

### (iii) The Claude API with a key

- Max plans now include a monthly API credit: $100 on Max 5x, $200 on Max 20x.
  - It is claimed by linking a Console organization, with no payment method needed.
  - Requests stop when it runs out, it does not roll over, and it is never charged to the plan.
  - It covers the API, and the Agent SDK and `claude -p` when run with that organization's key.
  - Sources: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers and https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans.
- Prices per million tokens are $2 in and $10 out for Sonnet 5.5, and $4 and $20 for Opus 5.5 (https://platform.claude.com/docs/en/about-claude/pricing).
- My estimate is $0.50 to $1.50 per hour of raw footage for the plan plus the package. This is not measured.

**What it breaks:**

- "There are no secrets in this project, and none are added to the repo" (`CLAUDE.md:12`). The requirements foresee this: "A web app holds a key, so the rule that this project has no secrets changes then" (`requirements.md:270`).
- It has the same "leaves the Mac" change as (ii).
- It is the only route that survives the bare-mode default and does not touch anyone's plan limits.

### (iv) By hand in Claude Code or the Claude desktop app, files prepared by the tool

- This is what L1 already says: "on a Mac that has the footage, through Claude Code or the Claude desktop app" (`requirements.md:251`).
- **Cost.** $0. It uses interactive plan limits: Jason's on the Mac Studio, or Sallie's on her own Mac, where the Dropbox folder also syncs.
- **Breaks.** Nothing in the rules. A person sees each request, and a write into the page can get Jason's yes then. The spec already describes this pattern for research (spec `:437`).
- **Weakness.** It needs a person each time. Sallie is not technical and wants drafts in a page (`requirements.md:197`). Which Mac and app she would use is not known.
- **A middle path.** A local scheduled task in the desktop app runs on a timer (one minute at the least), only while the app is open and the Mac is awake, with a permission mode per task (https://code.claude.com/docs/en/desktop-scheduled-tasks). It is a timer, not a folder trigger.

## 3. Rules such a workflow touches

**`CLAUDE.md`**

- `:11` "The page drafts. It never posts, sends or enrolls anyone, and nothing in this repo may add that." A "ready to post" suite must stop at a file.
- `:12` "There are no secrets in this project, and none are added to the repo." Touched by (iii) and by a token in (ii).
- `:14` "The page never deletes a record." By extension, cut footage is never deleted.
- `:16` "Publishing, inviting someone and writing to the page's database all need Jason's yes in chat first."
- `:31` "Write a failing test first, then the code."
- `:35` "It is separate from the page".
- `:42` "the page and the tool cannot disagree about a `.srt`." A words file needs the same shared reader.
- `:43` "Nothing is installed on a Mac, and no launch agent is added, without Jason's yes in chat first." Covers a third folder, a VAD model, and any new program.
- `:48` The capabilities list. Images change it.
- `:49` "Before any change to the layout of the records: take a backup … and raise `LAYOUT_VERSION`".

**`docs/requirements.md`**

- `:7` Jason's preferences come first.
- `:21` "the future features further down have no place in this order yet."
- `:29-31` Workflow 5 takes "Your podcast or YouTube transcript" and produces text pieces and "short-video selections", not edits.
- `:36` "Follow-up reels, and standalone thumbnails or graphics."
- `:241` "Held for later. Nothing here is being built".
- `:245` "held by Jason, 2026-10-13. It may end up being a separate app or workflow, not a part of BRIMM Ops."
- `:247` "The plan is shown as a storyboard before anything is rendered."
- `:252` "Claude cannot watch video, so it cannot judge which take had better energy. A look such as "moody" works only after it is defined once… B-roll needs a folder of her clips… The output is a file she reviews and posts herself."
- `:253` "A first test would need: a final-cut episode file… and a choice of which use comes first."
- `:267` "the transcript tool on the Mac Studio stays the working path", against `:268`, "the Mac Studio leaves the workflow".
- `:281` "Whether a client recording may go to a transcription service."

**`README.md`**

- `:3` "It never posts, sends or enrolls anyone."
- `:56` "nothing leaves the machine".

## 4. Who edits, and in which program

**Recorded**

- "An editor does the editing and the thumbnails. She also uses CapCut, OpusClip, and Instagram Edits… She uploads to Frame.io, and her editor delivers each episode back in a new shared folder, with the thumbnail" (`requirements.md:169`).
- Clips are "work she does today in OpusClip and CapCut" (`:249`).
- She posts "By hand in each app" (`:170`).
- "When she records, she works from a full script" (`:221`).
- On cameras: "I switched from using the Osbot camera…" (`:168`).
- Video goes grainy "right after the video is edited, maybe after the editor takes it" (`:232`).
- She wants a Sallie-only video from Zoom (`:233`).

**Not known**

- The editor's program: "The editor's software is not verified" (`docs/research/2026-10-13-cloud-transcription/skeptic-review.md:44`).
- Whether Sallie has or would use Final Cut. It is on the Mac Studio only, as far as checked.
- Who would open a Final Cut file.
- Which Mac she uses (`requirements.md:281`).
- Who else can open the Dropbox folder (`skeptic-review.md:55`).
- Her Claude plan and its limits (`package-test.md:98`).
- What her raw footage is: camera, one file or many, length, where it lives.
- Whether her fonts, colours, caption style or a b-roll folder exist as files.

## 5. Questions only Jason or Sallie can answer, most important first

1. **Who cuts from the plan, and in which program?** Sallie in CapCut, the editor in theirs, or Jason in Final Cut on the Mac Studio. This decides whether the output is a readable cut list, a Final Cut file, or a brief for the editor.
2. **What is "unedited video"?** A scripted solo episode in one long take with retakes, a Zoom interview, or a reel shot as several phone clips. Also how long it runs and how many files per shoot. This decides the unit of work and whether route (i) fits.
3. **Whose plan writes when nobody is present?** May Jason's Max login be used by a launch agent, or will he claim the API credit and keep a key on the Mac, changing `CLAUDE.md:12`? Or does Claude stay on Sallie's plan or by hand?
4. **May raw-footage text and stills go to Claude automatically?** Does that include client calls? Or is the new folder for episodes only?
5. **Where does she receive it?** In the page (`requirements.md:197`), which needs a hand-carried file or a write approved each time, or as files in the dated folder.
6. **Is L1's hold lifted?** Is this part of this repo or a separate app (`requirements.md:245`), and where does it sit against workflows 2, 3, 4 and 9 (`:12-21`)?
7. **Is her script available as a file for each recording?** It would let takes be matched to script lines.
8. **What defines "the look"?** Do brand assets and b-roll exist as files (`requirements.md:252`)?
9. **Which Mac and Claude app would she use by hand, and on what plan?**
10. **Where do raw files stay, for how long, and who can open that folder?**
11. **Which real raw recording can be the first test?** One that the editor has already cut would give the editor's actual kept and cut ranges to compare against.