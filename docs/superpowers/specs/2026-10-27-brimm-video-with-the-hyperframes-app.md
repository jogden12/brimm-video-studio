# brimm-video with the HyperFrames app: the workflows, re-imagined

- **Date:** 2026-10-27.
- **Status:** a proposal for Jason. Nothing in it is decided, built or installed. Section 9 lists what needs his yes.
- **Jason's direction,** word for word, is in `docs/requirements.md` under "Decisions", "The HyperFrames app (2026-10-27)". In short:
  - the HyperFrames Mac app already does the editing: graphics, cuts and Reels;
  - brimm-video should keep what BRIMM Ops needs;
  - from a session, brimm-video may find clips of Sallie with learnings, and some may become Reels.
  - **Revised the same day:**
    - for teachings, the client's words may be left in, perhaps with their permission first;
    - sessions should be kept out of AI training;
    - a session is analysed when it is dropped in, and Claude suggests clips with their times;
    - nothing of a session goes to HyperFrames by default. Sallie can override that, but only after confirming either that the client consents to their words being used, or that a clip is Sallie alone, with the client's identity taken out where possible.
  - Section 5 is written to the revision.
- **What it replaces:** where this differs from the architecture of 2026-10-26 (`2026-10-26-claude-video-editing-architecture.md`), this wins once Jason says yes. That design's rules and decisions still stand:
  - drafts only;
  - the privacy classes;
  - Josefin Sans;
  - the music library;
  - labelling generated media;
  - the two rule changes.
- **Facts about the app** come from HyperFrames' own docs, read on 2026-10-26 at commit 9ebc1f8. See "Sources".

## 1. The split: what the app does, what brimm-video keeps

| Job | Who does it | Why |
|---|---|---|
| Cutting: retakes, filler, pauses, order | **The HyperFrames app.** Its Script panel shows every word, offers the agent's suggested cuts (Keep all, Cut all, or one by one), and cuts words like a document | It does this better, and Sallie sees it |
| Captions, titles, lower thirds, cards, logo, b-roll, music | **The app,** with a BRIMM brand kit, its 91 caption styles, and its agent | The same |
| Reels | **The app:** a 9:16 project made from a stretch of the words | The same |
| Versions | **The app's history.** Every change is an entry with who made it and a label, and the agent can list them, show what each changed, undo one or go back to one (`hyperframes history`) | Jason's ask of 2026-10-27, already built |
| The agent in the app | **Claude Code,** signed in with Sallie's Claude account. The app lets you pick it | She talks to the same Claude in her chat and in the app |
| Intake | **brimm-video,** as built: the drop folder, the question of what a video is, the privacy class, filing in Dropbox | BRIMM Ops and privacy depend on it |
| Transcript with word times | **brimm-video,** on the Mac (whisper.cpp) | The hand-off needs it, and a session's is never made anywhere else |
| Making the app's project | **brimm-video:** a HyperFrames project for each video or clip, then `npx hyperframes open` | Sallie never sets one up by hand |
| The hand-off to BRIMM Ops | **brimm-video,** after the export: the final transcript, the kind, the Reels' words, a session's principles | BRIMM Ops takes it as now |
| Client sessions | **brimm-video,** with Claude's reading under the training gate. Nothing of a session reaches the app unless Sallie confirms consent or a Sallie-alone clip (section 5) | The app sends audio to HeyGen, which may train on it (section 7) |

**Retired, once the app path is proven** (with Jason's yes, one pull request each):
- brimm-video's rough-cut render;
- its Reel making (`reel.js`, `reframe.js`);
- its graphics commands (`layers.js`, `styles.js`, `graphic`, `card make`);
- the Final Cut push as the main path. Final Cut stays optional, fed by the app's MOV export.
- From the 2026-10-26 plan: the edit record, the render planner, the brand kit in the repo, the ffmpeg overlay path (H1 to H5), and brimm-video's own versioning.

## 2. Where Sallie works

| Place | What she does there |
|---|---|
| **Her Claude chat** (her BRIMM Video Studio folder) | Says what a video is. Approves a session's learnings and picks its clips. Says "open it in HyperFrames". Says "hand it off" |
| **The HyperFrames app** | Everything about how the video looks and is cut: typing to the agent, pointing or drawing on the picture, cutting words in the Script panel, picking caption styles, exporting |

`npx hyperframes open`, run from her chat's session, opens the project in the app, and the app's chat carries on that conversation. Back in her chat, `npx hyperframes catch-up` lists what happened in the app: what she asked, what was done, which files changed.

## 3. A raw, unedited video (the OBSBOT, with retakes)

1. **She drops it**, as today. brimm-video makes, on the Mac:
   - a working copy at a constant frame rate;
   - the transcript with word times;
   - the spellings.

   It says "Ready".
2. **In her chat** she answers the card: "raw with retakes".
3. **brimm-video makes the project** in `~/BRIMM Video Work/<episode>/app/`, on the Mac's own disk. It holds:
   - the working copy;
   - `transcript.json` from the local transcript;
   - brimm-video's cut plan, as suggestions;
   - a brief for the agent (section 7).

   It picks the BRIMM brand kit for the project and opens it in the app.
4. **In the app**, the Script panel shows every word. The agent's suggested cuts sit at the top: Keep all, Cut all, or one at a time. Then she asks, for example:
   - "My name when I start."
   - "A title card before the first point."
   - "Quiet music under it."
   - "Make the title smaller", drawing a circle round it.

   Each request is one entry in the project's history.
5. **Versions.**
   - "What have we changed?" lists the history entries, newest first, each with its label.
   - "Go back to before the music" restores to an entry.
   - "Use the title from earlier, but not those graphics": the agent looks at the files at that entry and brings back only the title.
6. **Reels.** "Make Reel 2 from 'the real reason' to the end of that point" makes a 9:16 project from those words, in a caption style from the Captions panel, in the brand's colours.
7. **Export.** Export on **This Mac**, 1080p or 4K, as an MP4. The Reels are 9:16. The app saves each to Downloads, named after the project with the date and time.
8. **"Hand it off"** (in the app's chat or hers). brimm-video's `finish`:
   1. takes the project's newest exports from Downloads, by the project's name;
   2. transcribes each on the Mac for its final transcript;
   3. writes the hand-off, version 2, into the episode's `final/` folder in Dropbox.

   BRIMM Ops takes it as now. Nothing is posted.

## 4. iPhone clips, 1 to 5 minutes

1. **She AirDrops it to the Mac and drops it.** brimm-video:
   - sees it is a phone clip from its QuickTime tags (`com.apple.quicktime.make` and `model`);
   - makes a working copy in standard colour (HDR, which iPhones record by default, is converted) at a constant frame rate;
   - transcribes it on the Mac.
2. **In her chat:** "iPhone clip".
3. **brimm-video makes the project** at the clip's own shape, usually 9:16, with the brand kit, and opens it in the app. Several clips can go into one project: "put these three together".
4. **In the app:**
   - "Tighten it."
   - "Captions in the BRIMM style."
   - "A title card at the start, and the end card."
   - Or a video she likes, as a **reference video** whose cuts and captions the app copies.
5. **Export** a 9:16 MP4, then **"hand it off".** It goes to BRIMM Ops as a short video, and BRIMM Ops writes its post text: hooks, the Instagram caption, a YouTube Shorts title and a LinkedIn post. Nothing is posted.

A horizontal phone clip becomes upright in the app: the agent crops it in a 9:16 project.

## 5. Client and group sessions (Zoom)

Written to Jason's revision of 2026-10-27, word for word in the requirements.

### The rules

1. **Kept out of AI training.** A session is read only by Claude, and only on an account whose training setting is off.
   - Today's training gate already checks the account before any session reading.
   - Sallie's folder also turns off the two ways a chat's transcript can be uploaded for review: Claude Code's `/feedback` command, and its "share your transcript" survey.
   - Zoom, HeyGen, Higgsfield and OpenRouter never get a session, except a clip under rule 4.
   - "Kept out of training", below, says what each service does.
2. **Client words in teachings.** Claude may read the client's words with Sallie's, for teachings.
   - Every other speaker's name is replaced by "Participant 1", "Participant 2" and so on, as today's reading does.
   - Decision 5 asks whether this waits for the client's permission. If it does, a session whose client has not agreed is read with Sallie's words only, and the client's names are replaced.
3. **Consent is recorded on the Mac,** in the episode's record, with its date and what it covers. There are two kinds:
   - **teachings:** the client agreed that their session may be read by Claude;
   - **use:** the client agreed that a clip with their words or picture may be used.

   One clause in her client agreement could cover every future session. Consent is never sent anywhere.
4. **Nothing of a session goes to HyperFrames by default.** Sallie can override that, per clip, only after confirming one of two things:
   - **the client consents** to their words being used (a "use" consent, recorded); or
   - **the clip is Sallie alone,** confirmed after she has watched the version with the client's identity taken out.

   **The full recording** goes only on her explicit ask, and only with a "use" consent.

### The workflow

1. **She drops the Zoom download.** brimm-video knows a Zoom download by its file names, and treats it as a session at once, the safer of the two mistakes. She can correct it ("that's an interview, not a session"). Any other file asks the card as today, where a session is offered and never guessed.
2. **Analysed at once, on the Mac first:**
   - the transcript with word times;
   - who spoke when, from Zoom's own transcript with its speaker names, or from each participant's audio file in a local recording;
   - the names brimm-video can see (`sessions.js`);
   - faces in sampled frames;
   - text on screen (Apple's on-device Vision), since Zoom shows names on tiles.
3. **Then Claude reads it,** in the same run, under rule 1. With a "teachings" consent, or if Jason decides none is needed, it reads the whole transcript with the other speakers renamed. Otherwise it reads Sallie's words only. It writes:
   - **teachings:** BRIMM business principles with no client names, recurring principles, and Reel ideas;
   - **clip suggestions,** each with:
     - a start and an end on the recording's clock;
     - the point it makes;
     - a working title;
     - whether it is **Sallie alone** or **with the client**.
4. **brimm-video cuts each suggested clip on the Mac** into the episode's `clips/`, and makes a version with the client's identity taken out, as far as it can:
   - **spoken client names muted,** by their word times, and shown as `[client]` in the clip's captions;
   - **names on screen blurred,** where Vision finds them;
   - **the picture taken from Zoom's active-speaker view,** never the gallery view, so other participants' tiles are left out;
   - **a clip where another face still shows is marked** "shows someone else".
5. **In her chat** she sees the list: each clip's title, times, "Sallie alone" or "with the client", and what was taken out. "Show me 3" opens that clip on the Mac in QuickTime Player. She approves the teachings, as today, and they go to BRIMM Ops with no transcript.
6. **To HyperFrames, only when she asks, one clip at a time** ("send clip 3 to HyperFrames"):
   - **Sallie alone:** brimm-video asks her to confirm that she has watched it and that it is just her. Then the version with the identity taken out becomes a project of its own.
   - **With the client:** it asks her to confirm the client's "use" consent, and records it if it is new. Then the clip becomes a project of its own.
   - Each project holds that clip and its words only, nothing else of the session. It opens in the app like an iPhone clip.
   - **In the app,** the clip is edited from brimm-video's own transcript, not the Script panel's HeyGen transcription, unless Jason has opted the HeyGen account out of training (decision 6).
7. **"Film it again"** stays an option for any clip idea. Zoom sends 720p at most, so an upright crop of a call is soft, and filming again often looks better.

### Kept out of training: what each service does

Read on 2026-10-27; check the current terms before relying on them.

| Service | Does it train on what it is given? | What this design does |
|---|---|---|
| **Claude** (Sallie's Pro or Max account, Claude Code included) | Only when the account allows it. With training off, data is kept 30 days and not trained on. Feedback sent with `/feedback` may be used to improve the product. A transcript shared through the session survey is never used for training. Team, Enterprise and API accounts are not trained on by default | The training gate checks the account before every session reading. Sallie's folder turns off `/feedback` and the survey (`DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`). A Team account or an API key would make it the default rather than a setting |
| **Zoom** | Its terms say it does not use audio, video or chat to train its own or others' AI (changed in 2023). Its AI Companion features ask their own consent | Sessions are recorded without AI Companion summaries, unless Jason decides otherwise |
| **HeyGen** (the app's Script panel, Share and the cloud) | Its privacy policy says it may use what you give it to train its models. Enterprise customers are excluded by default; others can opt out by email | No session clip uses those features until Jason has asked HeyGen to opt the account out (decision 6) |
| **HyperFrames**, rendering on the Mac | Sends no project or video content. Its telemetry is off | As in H0 |
| **Higgsfield** | Uses uploaded content to improve its models | Never gets a session |

## 6. Finished videos from her editor

Unchanged: Reel suggestions, the spellings, then the hand-off. A Reel she wants from a finished video goes to the app as a project of its own, made from that stretch, like an iPhone clip.

## 7. Guardrails in the app

- **The agent.** Claude Code, signed in with Sallie's Claude account, with the app's **Auto** access, never **Full access**.
- **Each project's brief and settings.** brimm-video writes them into each project it makes:
  - drafts only;
  - export on This Mac only, never Cloud;
  - never Share with "Anyone with the link";
  - no generated people, and never a generated Sallie, face or voice: no HeyGen avatars or HeyGen voices of her (Jason, 2026-10-26).
  - A0 checks whether the app's agent follows them.
- **Share for review.** It uploads the export to HeyGen. Allowed only as "Only people you invite", and for a session clip only with the client's "use" consent and after HeyGen's training opt-out. Posting stays forbidden: Sallie posts herself.
- **Cloud rendering** stays off, since it uploads the project.
- **The Script panel sends the video's audio to HeyGen to transcribe it** (the app's own docs).
  - Allowed only for videos meant for posting: one named tool, the 2026-10-26 rule.
  - For a session clip, only after HeyGen's training opt-out (section 5). A0 checks whether the panel can use brimm-video's own transcript instead.
- **HeyGen's paid parts are not used** without Jason's yes: Video 1 clips, voices, avatars and the cloud.
- **A HeyGen sign-in is needed** for brand kits and the Script panel. The account itself is free.

## 8. What happens to the 2026-10-26 plan and to H0

- **Kept:**
  - the decisions: privacy classes, drafts only, Josefin Sans, the music library, labelling, the two rule changes;
  - Final Cut as an option;
  - OpenRouter for pictures.
  - Higgsfield waits: the app's own b-roll (the Script panel's **Add > B-roll shot**, and HeyGen Video 1) may be enough. Decided after A0.
- **Dropped, if Jason says yes:**
  - the edit record and the render planner;
  - the brand kit in the repo;
  - the ffmpeg overlay path;
  - Claude driving Final Cut's screen (the app exports MOV instead);
  - brimm-video's own versioning (the app's history instead).
- **H0.**
  - Steps 0 to 4 are done and still useful: HyperFrames runs on the Mac Studio, and Josefin Sans works in it.
  - Steps 5 to 8 test brimm-video's own renderer, which this design drops. So H0 stops at step 4, and A0 runs instead.

## 9. Decisions for Jason

1. **The split** of section 1: the app edits; brimm-video does intake, projects, sessions and the hand-off.
2. **Installing the HyperFrames app** on the Mac Studio for A0, and later on Sallie's laptop.
3. **HeyGen accounts** (free) for Sallie and Jason, and the BRIMM brand kit in their HeyGen workspace.
4. **The Script panel's transcription by HeyGen** for videos meant for posting. The other option: only if A0 shows the panel cannot use brimm-video's own transcript.
5. **A client's permission for teachings.** Is it needed before Claude reads a session with the client's words? If yes, a session without it is read with Sallie's words only. A clause in her client agreement could cover every future session.
6. **HeyGen's training opt-out.** Jason emails HeyGen to opt the account out of training. Until then, no session clip uses the Script panel, Share or the cloud.
7. **Share links:** invited people only.
8. **Higgsfield:** wait until A0 shows whether the app's b-roll is enough.
9. **H0:** stop after step 4, and run A0 instead.
10. **Zoom downloads treated as sessions** the moment they are dropped, with Sallie able to correct one.

## 10. Build order

| Step | What | Done when |
|---|---|---|
| **A0. The app test** (by hand, Mac Studio, Jason's own recording) | See the list below | Jason's verdict on each, with times |
| **B1. Projects** | brimm-video makes a project for a raw video and an iPhone clip, and opens it | Tests on fixtures; one by hand |
| **B2. The hand-off from the app** | `finish` from the app's exports: the final transcript and hand-off version 2 | Tests; one by hand into BRIMM Ops |
| **S1. Session reading at the drop** | Zoom downloads taken as sessions; the consent records; Claude's reading under the training gate, whole or Sallie's words only by consent; clip suggestions with times; the feedback switches in her folder | Tests that a session without the needed consent sends no client word, and that no request leaves without the gate |
| **S2. Session clips** | Cutting the suggested clips; taking out what identifies the client (muted names, blurred text, the active-speaker picture, faces marked); the two confirmations; the clip's project | Tests; one by hand with Jason's own made-up call |
| **R. Retire** | What the app does, one pull request at a time | Each on Jason's yes |

**A0, the app test,** checks each of these:

1. Install the app, and sign in to HeyGen.
2. Connect Claude Code as the app's agent.
3. Build the BRIMM brand kit: colours, Josefin Sans' files, logos, rules and the brand guide PDF.
4. Open a project made by hand from a test recording, with a `transcript.json` and a brief, using `npx hyperframes open`.
5. The Script panel: does it use `transcript.json`, or always HeyGen?
6. The suggested cuts.
7. A lower third and a title card from the kit.
8. Captions.
9. A Reel, then exports at 1080p and 9:16, with times.
10. `npx hyperframes catch-up`.
11. `npx hyperframes history`: list, show and restore.
12. Whether the agent follows the project's brief and settings.

Every test of brimm-video's own code writes a failing test first, as the repo's rules say. No test calls the app, HeyGen or `claude`.

## Sources

Read on 2026-10-26 unless marked otherwise. A vendor's page is its own claim, not a measurement.

- **HyperFrames docs** in [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) at commit 9ebc1f8:
  - `docs/studio-app/index.mdx`: free, with a HeyGen sign-in; an agent on your computer;
  - `connect-your-agent.mdx`: Claude Code among the agents, billed by Anthropic; Auto or Full access;
  - `existing-project.mdx`: `npx hyperframes open` and `catch-up`;
  - `workspace.mdx`: the Script panel, its suggested cuts, and its audio sent to HeyGen to transcribe; 91 caption styles; the `#` tools;
  - `brand-kits.mdx`: colours, logos, fonts, rules; needs sign-in; the kit's files copied into the project;
  - `export.mdx`: This Mac or the cloud (the project uploaded); MP4, WebM or MOV; saved to Downloads;
  - `share.mdx`: the review link uploads the export to HeyGen; who can open it;
  - `edit-with-the-agent.mdx`: point, draw, comment; the timeline by hand; undo;
  - `faq.mdx`: the project stays on the computer when rendered locally; the agent sends prompts to its own provider;
  - `packages/cli.mdx`: `history`, with list, show, undo, restore and peek.
- **Zoom's separate audio for each participant** (local recording): [Sonix's guide](https://help.sonix.ai/en/articles/5520629-how-to-separate-speakers-in-zoom-and-set-up-multitrack-transcription-in-sonix) and [a university's guide](https://kb.plu.edu/105197), from search summaries read on 2026-10-27. Whether cloud downloads include the separate files is not confirmed. The tool already reads Zoom's cloud transcript with its speakers (`tool/reading.js`).
- **Apple's on-device tools:**
  - [NaturalLanguage, `NLTagScheme.nameType`](https://developer.apple.com/documentation/naturallanguage/nltagscheme/nametype) (names of people, places and organisations);
  - [Vision, `VNRecognizeTextRequest`](https://developer.apple.com/documentation/vision/vnrecognizetextrequest) (text in a picture).
  - Both run on the Mac. Not re-read for this proposal.
- **This repo:**
  - `docs/requirements.md`;
  - the designs of 2026-10-22 and 2026-10-26;
  - `tool/teachings.js` and `tool/reading.js`: today's session reading sends the meeting's transcript with the other speakers' names replaced. Jason's revision of 2026-10-27 allows that for teachings, perhaps with the client's permission first (decision 5).
- **Anthropic's data usage for Claude Code:** [code.claude.com/docs/en/data-usage](https://code.claude.com/docs/en/data-usage), read directly on 2026-10-27. It covers the training choice on Free, Pro and Max (including Claude Code), 30-day retention with training off, `/feedback`, the transcript-share survey and its switches, and commercial accounts not trained on.
- **HeyGen:**
  - its [privacy policy](https://heygen.com/privacy): input may be used to train its models;
  - its [security page](https://www.heygen.com/security): enterprise data excluded by default, others may opt out by email.
  - Both from search summaries on 2026-10-27; read them before relying on this.
- **Zoom:** its 2023 terms change not to use audio, video or chat to train AI, for example [Full Fact's check](https://fullfact.org/online/zoom-terms-train-ai-audio-facial-recognition/). From search summaries on 2026-10-27; check Zoom's current terms.
