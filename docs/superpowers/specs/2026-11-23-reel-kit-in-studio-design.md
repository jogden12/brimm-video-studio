# Reel Kit in Studio: design

- **Status:** a proposal, for Jason's approval. Nothing of it is built.
- **Date:** 2026-11-23.
- **Source:** Jason's answers in the Code tab on 2026-11-23, quoted below.

## Why

Reel Kit (Justyn Berkovits, MIT, `github.com/justynberk/reel-kit`) takes one talking-head clip and turns it into a finished vertical video. Its effects, data cards and sound are built to a creator's style pack, and its pipeline checks lip sync at both ends. Studio has none of that. Studio has what Reel Kit lacks: any video at the drop, episodes, client sessions handled safely, the HyperFrames app for editing by hand, and the hand-off to BRIMM Ops.

Jason wants both. He likes Reel Kit's pre-built animations and graphics, and he likes having HyperFrames in the process, "so that I can view and edit the video before exporting it for posting".

## What Jason decided (2026-11-23)

Word for word:

> let's do path 1. with brimm video studio, I definitely want to keep the integration with BRIMM Ops. Also, I like being able to drop in any kind of video. the features that I definitely want to incorporate from Reel Kit are: 1. the motion graphics, data cards, edit modes, automated pipeline (as an option), headless hyperframes render so that hyperframes doesn't have to open (as an option), style pack system (I think I've already created a BRIMM Style Guide that has been uploaded into BVS (BRIMM Video Studio), sound design, and A/B trials.

> Sallie on her laptop, but test on the Mac Studio first. leave trials posting out; that should be handled in BRIMM Ops eventually.

> [the app exports anything she changed]: yes, the app exports anything she changed

> B, pin it like HyperFrames

After the builder check, word for word:

> unblock published artifacts in Studio's chat window so that a side panel can open with storyboard from Reel Kit. Style changes should be available in chat also, not just updating the repo.

> 1. go with your draft [the storyboard always comes before a render]
> 2. A Reel Kit edit basically ends up doing the same thing as the original Studio workflow except that hyperframes does not open; the user reviews the storyboard in claude. long form horizontal videos should be able to be cut into several Reel length and format videos either by invoking Reel Kit and letting it automate more of the process or by starting the original workflow by sending a project to hyperframes.
> 3. Reel kit updates will be done manually by user downloading and then dropping into a BRIMM Video Studio session
> 4. A/B testing should be its own section in BRIMM Ops. the page would show all content for each version with a link to the local video (or folder) so that each can be accessed easily. basic instructions for how to A/B test could be included with a dropdown so that they can be easily hidden if not needed. these are BRIMM Ops features

"Path 1" means Studio keeps intake, the front door, sessions and the hand-off, and Reel Kit does the edit. Approach B is below.

## Goals

1. From any episode part with Sallie talking on camera, she can ask for a Reel Kit edit in one of its three modes: hi-fi, lo-fi or showcase. It is built in the BRIMM style pack and uses Reel Kit's effects, cards and sound design. A long horizontal video can be cut into several Reels this way, as well as by the HyperFrames workflow of today.
2. She sees a storyboard in the side panel of her Claude chat before anything renders, leaves notes on it, and says when it's good. Nothing ever renders without that.
3. She can change her style in her chat.
4. Then she picks one of two ways out. Reel Kit renders the video without opening HyperFrames, or Studio opens the project in the HyperFrames app for her to look at, change and export.
5. Either way the finished file comes back through Studio's exports and `finish`, and the hand-off to BRIMM Ops is exactly what it is today. Jason: "A Reel Kit edit basically ends up doing the same thing as the original Studio workflow except that hyperframes does not open".
6. One exact Reel Kit version is pinned and checked, the same way HyperFrames is. What passes on the Mac Studio is what reaches Sallie's laptop.

## Non-goals (for now)

- **Trials posting.** Jason: "leave trials posting out; that should be handled in BRIMM Ops eventually". Reel Kit's Trials app, Zernio and its key are not installed or run anywhere in Studio.
- **A/B tests.** Jason: "A/B testing should be its own section in BRIMM Ops ... these are BRIMM Ops features". Its description for a BRIMM Ops session is `docs/handoffs/2026-11-23-ab-tests-for-brimm-ops.md`. Marking two Reels as versions of one test is a contract change, made later in step with brimm-operations. Until then, two Reel Kit versions of one Reel go through `finish` as two Reels.
- **New effects from someone else's video** (`/reel-kit:effect <link>`). It downloads videos from links with yt-dlp. Left out of the first version. (My call.)
- **Generated imagery and generated sound.** Reel Kit uses Higgsfield, ChatCut or ElevenLabs only when one is connected. Higgsfield waits until A0, and OpenRouter is for pictures only. So no generator is connected to the edit. Effects that want the empty room behind Sallie take five filmed seconds of it, or a photo from the same spot, never a generated one.
- **Porting Reel Kit into Studio's JavaScript.** Its Python pipeline is used as shipped.

## Anti-goals: a failure even if it works

- A Reel Kit rebuild or headless render that wipes out or bypasses what Sallie changed in the app.
- Anything written into a Mac's drop folder. A new file there starts the import. Reel Kit's own render copies the finished video "next to the source clip", so Studio must make sure the source it hands Reel Kit is never in the drop folder.
- A Reel Kit update reaching her laptop that nobody tested on the Mac Studio.
- Anything posted or published by Studio, or by the edit Studio starts.
- A client session clip reaching Reel Kit without the consent Studio already asks for before a clip goes to HyperFrames.

## Constraints (from CLAUDE.md and the code)

- **Her chat runs `edit.js` and nothing else** (the strict lock, every Mac today; `tool/studio/guard.mjs`). Reel Kit expects its session to run Python, write `edit.py`, start helper agents and publish a storyboard. None of that can happen in her chat.
- **Artifacts are on her never list today** (`tool/studio/never.json`: `Artifact`, `ArtifactComments`, `ArtifactData`), for a reason that still holds: the BRIMM Ops page is a claude.ai artifact, and it holds sessions' principles (`docs/superpowers/specs/2026-10-26-brimm-video-lock-loosened-design.md`, decision 11 and question 12). Jason now opens publishing for storyboards (section 4b). Reading, listing, deleting and data stay refused, so her chat can never reach the Ops page.
- Nothing is installed on a Mac, and no launch agent is changed, without Jason's yes in chat. The installer runs only with `--print` otherwise.
- Write a failing test first. No test runs the real `claude`, HyperFrames, Python pipeline or ffmpeg. Stand-ins answer, as for HyperFrames today (`tests/stand-ins/hyperframes.mjs`).
- Projects live in `~/BRIMM Video Work`, never in Dropbox or a watched folder.
- HyperFrames telemetry is off. Never `publish`, `cloud`, `lambda` or `cloudrun`. Nothing renders in the cloud.
- Pin everything fetched at run time (an open item from past reviews). Reel Kit's `setup/requirements.txt` is unpinned (`numpy>=1.26` and so on). It fetches uv, Python 3.12, ffmpeg, Node, GSAP, a faster-whisper model, MediaPipe (about 390 MB) and a depth model (99 MB) the first time each is needed.
- Reel Kit hard-codes `npx -y hyperframes@0.8.139` in `pipeline/common.py` and `setup/setup.py`. Its folder is replaced on every update, so nothing in it is ever edited (its own rule: "Never edit anything in KIT").
- The BRIMM Ops contract (hand-off files, `madeBy`, the guide, the shared copies) does not change.
- Every by-hand step for Jason goes on a By-Hand Checks artifact page.

## What exists today

- **Reel Kit 1.0.0 was set up on the Mac Studio on 2026-11-05**, in `~/reel-kit`: `.venv`, `vendor/gsap.min.js`, a style pack and one test project, `projects/brimm-1`, with renders v1, v2, v4 and v6. The installed plugin is 1.0.0. Jason's download of 1.2.0 (`~/…/Downloads/reel-kit-plugin-1.2.0`, 44 MB, 574 files) adds 27 effects built from the footage itself: cutout, tracking, depth and the empty room.
- **The BRIMM style pack** is `~/reel-kit/style/`: `STYLE.md`, `style.json`, `brand.css`, `fonts/`, `board/`. Creator Sallie Ogden, growwiththebrimm.com; Josefin Sans in every role; Smoke `#F8F7F5`, Navy `#1F2D42`, Sand `#C1AD97` (`#8A7358` on light); calm motion, light sound, no music; Allison only as a hand-built word on a plain ground. It is outside the repo, so Studio does not know about it yet.
- **Studio pins HyperFrames 0.8.208** (`tool/hyperframes.pin.json`, sha512, GSAP 3.14.2). It installs it with npm into `~/BRIMM Video Work/.toolchain/hyperframes-<version>`, runs it by absolute path and never through npx, with telemetry and the rest turned off by its environment (`tool/hyperframes.js`).
- **Studio writes its own HyperFrames projects** (`project.js`) and opens them in the app (`app.js`, `app-reel.js`). It reads what was done there (`app-history.js`) and takes the exports back through `renders/*.meta.json` (`exports.js`).
- **Nothing reads the HyperFrames app's own version.** That is an open item from past reviews, and the app updates several times a week (Jason).

## Approaches

- **A. Use the Reel Kit plugin as it is**, with Studio's instructions telling her session when to hand a clip over. Least work, and updates arrive by themselves. But an untested update can change her edits mid-week, on top of an app that changes several times a week. Her own account needs the plugin. And her strict lock would block it anyway.
- **B. Studio pins one Reel Kit version and installs it itself.** Jason's pick. One exact version, checked by hash, installed by Studio's own setup and updated through Studio's own updates. Each new Reel Kit version is a small pull request and a check on the Mac Studio.
- **C. Copy Reel Kit into the repo.** The same as B with a 44 MB, 574-file copy in git, which makes it harder to see what changed between versions.
- **Port it into Studio's JavaScript** ("path 2"). Ruled out earlier: a large rewrite, and no more Reel Kit updates.

## The design

### 1. The pin

`tool/reel-kit.pin.json`, alongside `hyperframes.pin.json`:

- Reel Kit's version (1.2.0) and one fingerprint of its whole folder (SHA-256 of every file, by path, in a fixed order; `.DS_Store` ignored). Its `LICENSE` stays with it, and its credit line is passed on once after setup, as Reel Kit asks.
- **Where it comes from: a person drops it in.** Jason: "Reel kit updates will be done manually by user downloading and then dropping into a BRIMM Video Studio session". The download (a folder or its zip) is dragged into a Studio chat, never into the drop folder, and an `edit.js` command takes its path. `justynberk/reel-kit` is not public on GitHub (it answers "not found"), so there is nothing for Studio to fetch anyway.
  - **On the Mac Studio** (Jason, testing a new version): Studio reads the version, checks that the files Studio relies on are there (`SKILL.md`, `pipeline/`, `setup/`, `kit/`, `fx/LIBRARY.md`, `cards/LIBRARY.md`), notes its HyperFrames pin and its requirements, and installs it beside the version in use, without replacing it. It writes the new pin for a pull request. The new version is used only once that pull request is merged and its by-hand checks pass.
  - **On Sallie's laptop**: Studio installs a dropped Reel Kit only when its fingerprint is the pinned one. Any other version gets one line: it hasn't been tested yet, ask Jason. That is what keeps "test on the Mac Studio first" true when updates come by hand.
- **Its HyperFrames: 0.8.139**, with npm integrity, installed into `~/BRIMM Video Work/.toolchain/hyperframes-0.8.139` the same way Studio installs its own 0.8.208. Reel Kit's `npx -y hyperframes@0.8.139` must find that copy, not fetch one. How to make npx find it is left to the builder (a `PATH` folder with an `npx` that serves only that exact spelling, or npm's cache filled from the pinned tarball). It must be proven by a test with the network off.
- **Its Python world locked**: Python 3.12 through uv (version and hash, as `setup.sh` already pins uv), and the packages from `requirements.txt` resolved once into a lock file with hashes. Studio builds `.venv` from that lock before Reel Kit's setup runs, so the setup finds everything present.
- **Its models**: the faster-whisper model, MediaPipe's and the depth model, each by URL and SHA-256 (as `whisper-model.pin.json` does for Studio's own model).
- GSAP: Reel Kit's version, checked against Studio's `tool/vendor/` copy.

Bumping Reel Kit is a pull request that changes this file. It runs the stand-in tests, then passes the Mac Studio's by-hand checks before any build carries the new pin to Sallie. The download itself still reaches her by hand.

### 2. Where it lives on a Mac

- `KIT`: `~/BRIMM Video Work/.toolchain/reel-kit-<version>/`. Read only, never edited, replaced whole on a version change.
- `REEL_KIT_HOME`: `~/BRIMM Video Work/.reel-kit/`. Its `.venv`, `tools/`, `models/`, `vendor/` and `style/`. Its `style/` is always her pack from Dropbox (section 3), copied in before each run or linked; the builder picks, and a test proves Reel Kit never reads the shipped pack while she has her own. Every Reel Kit command Studio starts sets `REEL_KIT_HOME` to it. Each Reel Kit project goes in the episode's own folder in `~/BRIMM Video Work`, or is linked from it if Reel Kit insists on `HOME/projects/`. The builder picks whichever keeps one episode's files together and outside Dropbox.
- The old `~/reel-kit` (1.0.0, `brimm-1`) is not used by Studio. Its style pack moves into the repo (below). The rest goes to the Trash on Jason's yes, under the rule to delete test footage as we go.
- Every Reel Kit command runs with Studio's quiet environment for HyperFrames (telemetry, update check, skills download and background install off: `hyperframes.js`). On the network it reaches only the pinned downloads at setup.

### 3. The BRIMM style pack: shipped in the repo, changed in her chat

- **The shipped pack:** `tool/brand/reel-kit/` holds `STYLE.md`, `style.json`, `brand.css` and the board, taken from `~/reel-kit/style/`. Fonts are not copied twice; the pack points at `tool/brand/fonts/` (Google Fonts TTFs, not fontsource). A test checks its colours and fonts against `tool/brand/brand.md`, so the two cannot drift. The "name on screen is Sallie Ogden" and "The BRIMM" spellings hold.
- **Her pack:** Jason: "Style changes should be available in chat also, not just updating the repo." Her working pack lives in BRIMM Video's folder in Dropbox (`Reel Kit style/`). It survives a reinstall, and the Mac Studio sees the same pack when Jason tests with her style. It starts as a copy of the shipped pack. An update never overwrites it. Each Reel Kit project copies it in when it is made, as Reel Kit already does, so a change never alters a video already made. (My call: Dropbox rather than one Mac, so her style is backed up and the same everywhere she works.)
- **Changing it in chat:** she asks in her chat ("make the captions bigger", "use more sand"). `edit.js` hands it to the worker (section 4), which runs Reel Kit's own onboarding steps 4 and 5, "change my style", on her pack. It shows the style board in the side panel (section 4b) for her yes, and keeps the old pack as `Reel Kit style/before <date>/` so she can go back. A change that would break a brand rule (a font from neither Adobe Fonts nor Google Fonts, a "with Sallie Holder" mark) is refused in one line.
- **Showing the difference:** her chat can say how her pack differs from the shipped one. When Jason ships a new base, Studio says so and offers to carry her changes onto it, but never does it without her yes.
- 1.2.0's optional `headshot.jpg` waits until Sallie gives one.

### 4. The edit runs as its own worker

Her chat can only run `edit.js`, so the Reel Kit edit runs as a detached worker that `edit.js` starts, like the other long jobs (`detached.js`):

- A headless Claude Code run (`claude -p`, Studio's pinned model) working in the Reel Kit project folder. It follows Studio's own Reel Kit instructions, `tool/reel-kit/WORKER.md`: Reel Kit's `SKILL.md` steps 1 to 8, rewritten around Studio's rules. Those rules: no generators; the room filmed or photographed, never generated; no source screenshots fetched from the web, only what she supplies; never write outside the project; the fingerprint (section 7); stop at the storyboard. It also runs her style changes (section 3).
- Its tools are limited to that folder and the pinned programs. Read, Write and Edit inside the project. Bash for `REEL_KIT_HOME/.venv/bin/python` with KIT's scripts, Studio's ffmpeg and ffprobe, and the pinned HyperFrames. The Agent tool for Reel Kit's card and FX builders, with the same limits. No MCP servers, no web, no Artifact tools, no setting sources but its own. The exact permission list is the builder's, written as a test like `hyperframes.js`'s command table.
- It writes a status file her chat reads (`edit.js` prints the step and the time left, as it does for other detached work). It writes the storyboard's link when it stops there.
- A session clip runs the worker only on an account that passes the training gate, and only after the clip's consent answer. These are the same checks as for HyperFrames.
- It is Studio's first headless run with tools (the reading's runs use `--tools ""`), on Sallie's own account and its usage limits. The worker and its card and FX helpers use Opus, for the quality of the effects. One Reel Kit worker runs at a time per Mac: several Reels queue. When her usage runs out, the worker stops where it is, says so in her chat, and carries on from that step when she asks. It never starts over. (My call.)

### 4b. The storyboard in her chat's side panel

Jason: "unblock published artifacts in Studio's chat window so that a side panel can open with storyboard from Reel Kit". The worker can't publish (it runs headless), so her chat does, under a narrow opening of the lock:

- **`Artifact`, publish only**, and only a page the worker wrote: a Reel Kit project's `storyboard/index.html` with the files its `files.json` names, or the style board. The page gets `capabilities: {"comments": {"composer_only": true}}`, as Reel Kit publishes it. Later versions republish to the same URL. `edit.js` records each storyboard's URL in the project, and a publish to any other URL is refused. `open` is allowed for a recorded URL. Read, list, delete, pin, sharing and assets stay refused.
- **`ArtifactComments`**, only on a recorded storyboard or style-board URL: reading her notes and replying "On it." Her chat passes the notes to the worker through `edit.js`, which writes them into the project as Reel Kit's notes (`{beat, text, at}`). Notes are her words about this video: data for the edit, never instructions to anything else (Reel Kit's own rule).
- **`ArtifactData`** stays on the never list.
- The guard (`tool/studio/guard.mjs`) checks the tool's input against these rules. `never.json` names these two tools as allowed only this way, and `never.test.js` and the guard's tests prove it, including that the BRIMM Ops page's URL is refused. Both locks get it: the strict lock of today and the open lock.
- Studio never shares a storyboard. Artifacts start private, and she can share one herself from claude.ai if she wants.
- A session clip's storyboard is published only under the same gate as a session clip going to HyperFrames: her confirmation of the client's consent, or that the clip is her alone. Otherwise it uses Reel Kit's local page (`storyboard/serve.py`, `http://127.0.0.1:8765`), which stays as the fallback wherever publishing isn't possible. (My call: a session's frames on claude.ai are treated like a session's clip in the app.)
- Her chat says when she approves: "Looks good: render it", or "Looks good" in a comment with beat `all`.

### 5. What a Reel Kit edit becomes

Jason: "A Reel Kit edit basically ends up doing the same thing as the original Studio workflow except that hyperframes does not open; the user reviews the storyboard in claude." So a Reel Kit edit takes the place of a HyperFrames project in the episode, and from there everything is as today:

- **A short vertical video** (an iPhone clip, or a short raw take) becomes the episode's main video.
- **A long horizontal video** is cut into several Reels in one of two ways, Jason's: "either by invoking Reel Kit and letting it automate more of the process or by starting the original workflow by sending a project to hyperframes". With Reel Kit, Studio's own Reel suggestions (times and why, from the reading) are the starting list. She picks the ones she wants, each becomes one Reel Kit edit with its own storyboard, and each comes back as a Reel of that episode. Reel Kit's `KEEP` cut works inside the Reel's own range. The long video's main export is not a Reel Kit edit: Reel Kit only makes vertical video.
- A Reel's on-screen title is Reel Kit's hook line, using Studio's Reel title word for word. `finish` takes its words from the exported video's final transcript, as it does today for the app's exports. (My call.)
- A session clip can be one of these only after its consent answer, as today.

### 6. Her commands (via `edit.js`, names left to the builder)

- **Start**: an episode, a part or a Reel (or several Reels at once), and a mode. The mode is always asked, never guessed (Reel Kit's rule). Studio may say which mode fits the kind: an iPhone clip leans lo-fi, a raw sit-down take leans hi-fi.
- **Storyboard**: publishes it to the side panel (section 4b). She leaves a note on any beat.
- **Revise**: restarts the worker with her notes, and it shows the next storyboard version.
- **Style**: shows her pack, changes it (section 3), or goes back to an earlier one.
- **Install**: takes a dropped Reel Kit download (section 1).
- **Out, two ways** (section 7): render it, or open it in the app.
- What Reel Kit asks of her (its `NEEDS`: a screen recording, a photo, five seconds of the empty room) is shown in her chat in Reel Kit's exact wording. She drops what it asks for into a place Studio names. Not the drop folder: the builder picks where, inside the episode's folder.

The front door (`CLAUDE.md`, her skill) learns one more line: a recording with Sallie on camera can go to Reel Kit after its card, as an option beside the HyperFrames project.

### 7. Who touched it last decides how it leaves

When the storyboard is approved, the worker builds the HyperFrames project, and Studio records a fingerprint of its composition files.

- **Render it (no app):** allowed only while the fingerprint still matches. Reel Kit's `render.py` renders on its own HyperFrames 0.8.139, the version its effects are proven on, and runs its QA (cut sheets, lip sync within 2 frames, −14 LUFS). Studio then treats the output as an export: it writes the `renders/*.meta.json` that `exports.js` matches. It moves or deletes the copies Reel Kit puts "next to the source clip", so none is left anywhere but the renders.
- **Open it in the app:** Studio opens the project with `app.js`. It writes the project's notes (`CLAUDE.md`, `AGENTS.md`) with BRIMM's rules, as for its own projects, plus one line: this project was made by Reel Kit, so leave its timeline and `fx/` and `cards/` folders as they are unless asked. Jason: "the app exports anything she changed". Once the fingerprint differs, Studio refuses a headless render and a Reel Kit rebuild of that project, and says why in one line. Further Reel Kit changes start a new version, and the app's history keeps the one she changed.
- Whichever way it leaves, `finish` runs as it does today: the final transcript made on the Mac, the Reel's words and on-screen title, the hand-off. No contract change.

### 8. The app's version

Studio starts reading the HyperFrames app's version from its `Info.plist`, records it in each Reel Kit project when the project is opened, and remembers the last one seen. When the version changes, the next open of a Reel Kit project says so in one line and asks her to check that it plays. That check also goes on Jason's By-Hand Checks page for the Mac Studio. This closes the open item "Nothing reads the HyperFrames app's own version" for Reel Kit projects, and Studio's own projects can use the same reading.

### 9. Sound

Reel Kit's own SFX library and `mix.py` (−14 LUFS, always under the voice), at the pack's "light" density. No music by default. When Sallie picks a track from the music library, it goes in as `SOUND.music`. Music still comes only from that library, with Sallie picking.

## Phases

- **R1, the Mac Studio, by hand.** The pin and the dropped install, the style pack (shipped and hers), the worker, the storyboard in the side panel (the lock's narrow opening), the headless render, the fingerprint and the exports, on Jason's own clip: a short vertical one, then Reels from a long horizontal one. The install runs for real only on his yes. Its by-hand checks go on a By-Hand Checks page.
- **R2, the app.** Open in the app, the notes, the fingerprint refusal, the app's version.
- **R3, Sallie's laptop.** The Mac app's setup engine (`tool/setup/`) installs Reel Kit's Python world and models once a pinned download has been dropped in, behind the same yes. Her guide (`guide.js`) and her skill learn the new steps. It comes after the Phase 8 rollout reaches her laptop. The disk cost is said up front: the venv, Python, the models, and tracking and depth (about 400 MB and 100 MB) the first time an effect needs them.
- **Later, in BRIMM Ops and in step with it:** A/B tests (`docs/handoffs/2026-11-23-ab-tests-for-brimm-ops.md`), Trials posting. **Later, here:** new effects from other videos.

## Left to the builder

- How npx finds the pinned 0.8.139 offline (section 1).
- Where a Reel Kit project sits inside the episode's folder, and the command names.
- The worker's exact permission list and its status file's shape.
- Which composition files the fingerprint covers (at least `index.html`, `fx/`, `cards/`, `public/`, and whatever the app writes there).
- How Reel Kit's render output is matched as an export, and how its copies next to the source are cleared.
- How to stand in for Reel Kit's Python scripts in tests (a stand-in that prints what each script would print, as for HyperFrames).

## Open for Jason

Nothing that changes what gets built. The builder check's questions were answered on 2026-11-23 (quoted at the top). The calls marked "My call" are for Jason to check while reading:

1. Two Reel Kit versions of one Reel go through `finish` as two Reels until BRIMM Ops has A/B tests.
2. New effects from someone else's video are left out of the first version.
3. Her working style pack lives in BRIMM Video's folder in Dropbox, not on one Mac.
4. A session clip's storyboard is published only under the HyperFrames consent gate, and otherwise stays on the local page.
5. A Reel's on-screen title is the hook line with Studio's title word for word, and its words come from the export's final transcript.
6. The worker and its helpers use Opus, one worker at a time, and stop and resume when her usage runs out.
