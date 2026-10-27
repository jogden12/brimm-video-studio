# brimm-video with the HyperFrames app: the workflows, re-imagined

- **Date:** 2026-10-27.
- **Status:** a proposal for Jason. Nothing in it is decided, built or installed. Section 9 lists what needs his yes.
- **Jason's direction,** word for word, is in `docs/requirements.md` under "Decisions", "The HyperFrames app (2026-10-27)". In short:
  - the HyperFrames Mac app already does the editing: graphics, cuts and Reels;
  - brimm-video should keep what BRIMM Ops needs;
  - a client session's full text never goes to an AI model;
  - from a session, brimm-video may find clips of Sallie with learnings, client details taken out, and some may become Reels.
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
| Transcript with word times | **brimm-video,** on the Mac (whisper.cpp) | The hand-off needs it, and it is the only transcript a session ever gets |
| Making the app's project | **brimm-video:** a HyperFrames project for each video or clip, then `npx hyperframes open` | Sallie never sets one up by hand |
| The hand-off to BRIMM Ops | **brimm-video,** after the export: the final transcript, the kind, the Reels' words, a session's principles | BRIMM Ops takes it as now |
| Client sessions | **brimm-video, on the Mac, all of it.** Only cleared clips ever reach the app (section 5) | The app sends audio to HeyGen to transcribe it (section 7) |

**Retired, once the app path is proven** (with Jason's yes, one pull request each):
- brimm-video's rough-cut render;
- its Reel making (`reel.js`, `reframe.js`);
- its graphics commands (`layers.js`, `styles.js`, `graphic`, `card make`);
- the Final Cut push as the main path. Final Cut stays optional, fed by the app's MOV export.
- From the 2026-10-26 plan: the edit record, the render planner, the brand kit in the repo, the ffmpeg overlay path (H1 to H5), and brimm-video's own versioning.

## 2. Where Sallie works

| Place | What she does there |
|---|---|
| **Her Claude chat** (her BRIMM Video Studio folder) | Says what a video is. Asks for a session's learnings. Says "open it in HyperFrames". Says "hand it off" |
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

**The rules first.**
- **The full text never goes to an AI service:** not Claude, not HeyGen, not the app's agent.
- **The recording never goes into a HyperFrames project.**
- **What may leave the Mac,** only after Sallie's yes:
  - short excerpts of Sallie's own words, with client details taken out on the Mac;
  - clips of Sallie alone, checked, with the client's agreement noted.
- **Until then, only tools that run on the Mac and send nothing:**
  - whisper.cpp, for the transcript;
  - Zoom's own transcript, for who spoke when (Zoom already holds the recording);
  - Apple's on-device name finder (NaturalLanguage);
  - Apple's on-device text reading (Vision), for the picture check.
- **How this reads Jason's words:** "never passed to an AI model" is read as "never to an AI service off the Mac". whisper.cpp and Apple's two tools are AI models too, but they run on the Mac and send nothing. Decision 5 asks Jason to confirm this reading.

**The workflow.**

1. **She drops the Zoom download.** That is either:
   - a cloud recording: the video, the sound, and Zoom's transcript with each line's speaker; or
   - a local recording made with Zoom's "Record a separate audio file for each participant" turned on.

   In her chat she answers "client or group session". That answer is never guessed, as today.
2. **On the Mac, with nothing sent anywhere:**
   1. **Who spoke when:** from the speaker names in Zoom's transcript, or from her own audio track. Only Sallie's stretches are kept. A session with neither gets its transcript only: no learnings, no clips.
   2. **Excerpts:** her stretches are cut into excerpts at pauses, about 20 to 90 seconds each.
   3. **Client details are taken out of her words.** Each is replaced by `[client]`, `[company]`, `[place]` or `[amount]`:
      - every name brimm-video can see: the participants, the meeting's title, the file names (`sessions.js` does this today);
      - names of people, places and companies found by Apple's on-device name finder;
      - email addresses, phone numbers, web addresses and money amounts.
   4. **She reviews them on a page on her screen,** not in the chat. It shows every excerpt exactly as it would be sent, numbered, with what was taken out marked. In her chat she answers with numbers only:
      - "send all but 4 and 7";
      - "take 'bakery' out of 3".

      No words of the session pass through her chat before this point.
3. **Claude reads only the excerpts she sent,** under today's training gate (the account's training setting off). It writes two things:
   - **the learnings:** BRIMM business principles, with no client names;
   - **Reel candidates:** excerpts that stand alone as one point, 20 to 60 seconds long.
4. **The learnings** come to her chat to approve, as principles do today. They then go to BRIMM Ops in a hand-off of kind session, with no transcript.
5. **A session clip becomes a Reel only when she asks,** one clip at a time:
   1. **The picture check, on the Mac.** The clip is cut from Zoom's active-speaker view, never the gallery. brimm-video samples its frames and refuses the clip if a second face shows (`faces.swift`, as today), or if on-screen text holds a client's name (Zoom shows names on tiles).
   2. **The client's agreement is noted,** with its date, as the 2026-10-22 design asks.
   3. **Then the clip alone becomes a HyperFrames project:** the clip and its cleared words, nothing else of the session. It opens in the app like an iPhone clip.
      - From here it is a video meant for posting, so the app's transcription by HeyGen is allowed for it, after her yes. That is the 2026-10-26 rule: one named tool.
   4. **Or "film it again":** the idea becomes a Reel to film, as today. Zoom sends 720p at most, so an upright crop of a call is soft, and filming again often looks better.
6. **Nothing else of the session ever leaves the Mac.**

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
- **Share for review.** It uploads the export to HeyGen. Allowed only as "Only people you invite", and never for a session clip without the client's agreement. Posting stays forbidden: Sallie posts herself.
- **Cloud rendering** stays off, since it uploads the project.
- **The Script panel sends the video's audio to HeyGen to transcribe it** (the app's own docs).
  - Allowed only for videos meant for posting: one named tool, the 2026-10-26 rule.
  - Never for a session. A0 checks whether the panel can use brimm-video's own transcript instead.
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
5. **The session rule as read in section 5:**
   - no AI service off the Mac ever gets a session's text;
   - on-Mac transcription and name finding are allowed;
   - Sallie's excerpts, with client details taken out, go to Claude only after her yes on the page on her screen.
6. **Share links:** invited people only.
7. **Higgsfield:** wait until A0 shows whether the app's b-roll is enough.
8. **H0:** stop after step 4, and run A0 instead.

## 10. Build order

| Step | What | Done when |
|---|---|---|
| **A0. The app test** (by hand, Mac Studio, Jason's own recording) | See the list below | Jason's verdict on each, with times |
| **B1. Projects** | brimm-video makes a project for a raw video and an iPhone clip, and opens it | Tests on fixtures; one by hand |
| **B2. The hand-off from the app** | `finish` from the app's exports: the final transcript and hand-off version 2 | Tests; one by hand into BRIMM Ops |
| **S1. Session excerpts** | Sallie's stretches only; the on-Mac scrub; the page on her screen; Claude reads only what she sent | Tests that no client word and no other speaker's word can reach a request |
| **S2. Session clips** | The picture check, the agreement, the clip's project | Tests; one by hand with Jason's own made-up call |
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
  - `tool/teachings.js` and `tool/reading.js`: today's session reading sends the meeting's transcript with the other speakers' names replaced, which the rule of 2026-10-27 no longer allows.
