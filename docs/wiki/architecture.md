# Architecture

How Studio is put together, from the code on `main` (6636327, 2026-11-10). The design behind it is `docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md`, which is older than the code in places (see the end). Files and records are in `data-model.md`.

## The shape

Studio is `tool/`: about 37,000 lines of plain JavaScript (`"type": "module"`, Node 22 or later, no npm packages), a few Swift helpers and zsh scripts. The HyperFrames Mac app does the editing; Studio does everything around it:

1. A launch agent imports each video dropped in a Mac's drop folder.
2. Sallie's Claude chat, in her folder `~/BRIMM Video Studio`, runs `edit.js` commands: answer the video's card, read it with Claude, make the HyperFrames project, open it in the app.
3. She edits and exports in the app.
4. `finish` takes the exports back, makes the final transcript, files everything in the episode's `final/` folder in Dropbox and writes the hand-off file, which a person drops on the BRIMM Ops page.

## Entry points

| File | How it runs | What it does |
|---|---|---|
| `tool/unedited.js` | The launch agent `com.thebrimm.unedited` runs `node unedited.js --watch <folder>` when something lands in a watched folder (WatchPaths); also `node unedited.js <file>`. Log: `~/Library/Logs/brimm-video.log`. | The import. Holds `CLAUDE_MODEL`, `CLAUDE_ARGS`, `findPrograms`. |
| `tool/edit.js` | Run by her chat (about 7,200 lines; `COMMANDS` near the end, `HELP` near the top). | Her command line: `episodes, guide, kind, leave, which, read, workcopy, join, open, app, bring, status, retry, look, name, title, reel, reels, ask, finish, show, behind, update, resolve, free, spell, graphic, teachings, principles, ideas, refs, plan, footage`. Long work starts detached (`detached.js`: one run per episode, an episode lock, `caffeinate`, a result file `status` reads); hidden `--now` forms are the detached halves. Every command that names an episode goes through `gate.js` first. |
| `tool/settings.js` | `node settings.js write|plan|set|sessions|show|marker|studio …` | The Mac's settings (`~/Library/Application Support/BRIMM Video/settings.json`); `studio` writes her folder through `studio.js`. |
| `tool/install.sh` | zsh; only ever with `--print` unless Jason says yes. | Watches folders, writes the agent and settings (`--machine`), installs the pinned HyperFrames CLI and Chrome, the whisper model, and (dev mode) ffmpeg, whisper-cpp and node through Homebrew. `--tools`/`--app` are installed mode (the Mac app's own programs, no Homebrew or Xcode tools). A real run exits 75 when `busy.js` says something is at work. Also writes a one-shot `com.thebrimm.claude-check` agent. |
| `tool/busy.js` | `node busy.js idle-why` | What is at work: the agent's job, an import lock, an episode command, a video being made ready. |
| `tool/access.js` | CLI | The import's notes on macOS folder access (a node update loses the grant). |
| `tool/build-helpers.js` | `node build-helpers.js <folder>` | Compiles the Swift helpers as `brimm-<name>`. |

Libraries with no CLI of their own: `studio.js` (her folder: strict lock and open lock), `guide.js` (her one next step per video, as far as the BRIMM Ops page's steps; reached by `edit.js guide`), `run.js`, `build.js` (installed or dev mode), `update-check.js` (reads the Sparkle appcast at most once a day; sends nothing about the Mac).

## The pipeline

1. **Drop.** Each Mac watches its own drop folder (default `~/BRIMM Video Work/Drop`, marked with the Mac's name; `settings.js` `dropPath`, `switch.js`). The older Dropbox `Drop/` is still an option. `importing.js` writes status files; `progress.js` and `progress.swift` drive the progress panel.
2. **Import (the light import, the only one).** `unedited.js` with `filing.js`: ffprobe for facts, ffmpeg for sound and pauses, whisper.cpp for captions and word times; the rules in `cuts.js`, `closing.js`, `spelling.js`, `lib.js`. Nothing goes to Claude at import. The episode's record (`record/0001.json`, `episode.js`) is written last. From a local drop the video's files stay on the Mac (`put-here.js`, `where.js`) and only the record goes to Dropbox. A video is named by its label (`kinds.js`) until she answers its card. A Zoom download is a session (`sessions.js`, `teachings.js`, `held.js`).
3. **The card and the reading.** `edit.js kind "<video>" finished|raw|clip|session --private yes|no` records her answer (`receipts.js`) and starts `read --now`. `reading.js` with `readings.js` and `notes.js` makes one `claude -p` call (tried twice), the request on stdin. The results go in the record: Reel suggestions, spellings, graphic cues (`graphic-cues.js`), notes; a raw video's rough cut is rendered. `reel-candidates.js` and `reframe.js` (with `faces.swift`) handle Reel crops.
4. **Working copy.** `workcopy.js` makes the app-ready video: at most 1920 on the longer side, H.264 High 8-bit, BT.709, constant frame rate, AAC 48 kHz. HDR goes through VideoToolbox, then `hdrLook`. ffmpeg runs under `guard.js` (a memory and time watchdog; not her folder's guard).
5. **HyperFrames project.** `project.js` writes the project itself (not `hyperframes init`): `index.html`, GSAP from `tool/vendor/`, `transcript.json`, the suggestions, the notes (`CLAUDE.md`, `AGENTS.md`) and the brand (`tool/brand/`), in `~/BRIMM Video Work/<episode>/`. `hyperframes.js` holds the pinned CLI's rules: which commands the agent may run, which only `edit.js` may, and which are denied. `on-timeline.js` and `on-screen.js` put captions on the timeline and words on the picture.
6. **The app.** `app.js` (`edit.js app "<episode>" [reel <n>]`, `app-reel.js`) opens the main video or a Reel in the app. `app-history.js` reads what was done there (`.hyperframes/app-history.jsonl`, read only). `free.js` gives the room back. Planned videos: `plan.js`, `plan-script.js`, `plan-project.js`, `footage.js`, `join.js`, `explainer.js`.
7. **Exports back.** `exports.js` finds the app's exports (Downloads and the Mac's exports folder) and matches them to projects through `renders/*.meta.json`.
8. **Finish.** `edit.js finish "<episode>"` asks what it must and writes `finish.asked.json`; the detached `finish.js` then waits for whole exports, runs `final-transcript.js` (whisper again, on the finished video), cuts Stories from long Reels, copies into the episode's `final/` (the hand-off last), shows the hand-off in Finder, and does the late check 15 minutes or more later before deleting matching files from Downloads. `finish … reels` (`finish-reels.js`) makes the hand-off's next revision. `suggestions-in-main.js` places Reel suggestions on the exported video.
9. **Hand-off.** `handoff-v2.js` (version 2, writes only the keys the contract names) and `handoff.js` (version 1, still read by the page) make `*.brimm-ops.json`. `madeBy` is `brimm-video <commit>` (`filing.js` `commitOf`, from `build.json` in installed mode).
10. **Originals.** `originals.js` copies a kept video's recordings into the episode's `Original files/` in Dropbox; the Mac's copy goes only when Dropbox's is whole, the record lists it, and Dropbox reports it uploaded (`uploaded.swift`, `online-only.swift`, `read-through.swift`).

## Module map (`tool/`)

- **Entry and wiring:** `edit.js`, `unedited.js`, `install.sh`, `settings.js`, `studio.js`, `access.js`, `busy.js`, `detached.js`, `is-main.js` (a main check that survives links), `home.js` (Studio's home, `BRIMM_VIDEO_HOME`), `name.js`, `build.js`, `update-check.js`, `versions.js` (version fingerprints), `clock.js` (her given times on the raw clock), `video-clock.js` (the HyperFrames clock).
- **Import and episode:** `filing.js` (import steps, pendings, the late check, `commitOf`), `importing.js`, `episode.js` (the record, layout, claims), `where.js`, `put-here.js`, `dropbox.js` (the Dropbox writing rule), `switch.js`, `kinds.js`, `names.js`, `cuts.js`, `closing.js` (invented endings), `late-wait.js`, `progress.js`.
- **Reading:** `reading.js`, `readings.js`, `notes.js`, `reel-candidates.js`, `reframe.js`, `graphic-cues.js`, `spelling.js`, `sentences.js`.
- **Sessions and the lock:** `sessions.js`, `teachings.js`, `gate.js`, `held.js`, `dialog.js` (a dialog only her click answers), `scan.js`, `chain.js` (the process chain, Claude Code's flags), `loosened.js`, `open-lock.js`, `never.js`, `places.js`, `fetchable.js`, `receipts.js`, `reveal.js`, `sandboxed.js` (edit.js is not inside Claude Code's sandbox).
- **Project and HyperFrames:** `hyperframes.js`, `project.js`, `workcopy.js`, `app.js`, `app-reel.js`, `app-history.js`, `exports.js`, `on-screen.js`, `on-timeline.js`, `references.js` (the Dropbox References folder, read only), `free.js`.
- **Planned videos:** `plan.js`, `plan-script.js`, `plan-project.js`, `footage.js`, `join.js`, `explainer.js`.
- **Finish and hand-off:** `finish.js`, `finish-check.js`, `finish-ended.js`, `finish-reels.js`, `finish-time.js`, `final-transcript.js`, `suggestions-in-main.js`, `handoff.js`, `handoff-v2.js`, `originals.js`.
- **Guide:** `guide.js`, `guide-note.js` (her done-steps note). Part of the BRIMM Ops contract.
- **Mac app support:** `build.js`, `build-helpers.js`, `helpers.js` (`HELPERS`: faces, progress, uploaded, online-only, read-through), `update-check.js`, `busy.js`.
- **Swift helpers** (compiled as `brimm-<name>` in installed mode; run with `swift` in dev): `faces.swift`, `progress.swift`, `uploaded.swift`, `online-only.swift`, `read-through.swift`.
- **Copies from brimm-operations** (each names its source in its first line; kept in step by hand): `lib.js` (from `transcribe/lib.js`), `run.js` (from `transcribe/transcribe.js`: the program runner and lock), `shared/answers.js`, `shared/transcript.js`, `shared/show.js`, `shared/text.js` (from its `app/src/`).
- **Other:** `brand/` (brand.md, fonts), `vendor/gsap.min.js`, `hyperframes.pin.json`, `whisper-model.pin.json`.

## Her folder (`tool/studio/`)

What `studio.js` writes into `~/BRIMM Video Studio`:

- `CLAUDE.md` and `SKILL.md` (the brimm-edit skill), and `CLAUDE-open.md`, `SKILL-open.md` for the open lock; `{{NODE}}` and `{{CHECKOUT}}` are filled in. `script.md`: from a script to a plan.
- **Strict lock** (every Mac today): `edit.js` only; `guard.sh`/`guard.mjs` runs before every tool call and blocks anything else (it exits 2 if node can't run, which blocks the call); editing and web tools denied.
- **Open lock** (named by `OPEN_LOCK_CLAUDE`, still `null`): the sandbox on with `edit.js` the one command outside it, the never list and gated places denied, `~/BRIMM Video Workshop` the only writable place.
- `receipt.sh`/`receipt.mjs`: a hook after each card (AskUserQuestion) that writes a receipt; it never blocks.
- `never.json` (tools and servers her chat may never use, OpusClip's posting tools among them), `allow.json` (skills and tools allowed), `app-flags.json`, `environment.json` (environment variables kept from her chat, tokens among them).

## The Move to Studio app (`tool/move-app/`)

`build-app.sh --out <folder> [--sign] [--any-commit]` builds "Move to Studio.app" (it refuses uncommitted changes and never notarizes; it prints the steps). `launcher.swift` is the program, `open-in-terminal.zsh` opens Terminal on `move.zsh` (the y/n move for a laptop), `choose-folder.swift` the folder picker. It clones Studio at the commit it was built from. Doc: `docs/setup/move-to-studio-app.md`. The Mac app retires it in Phase 8.

## The Mac app (BRIMM Video Studio.app)

Design: `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`; phases: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`. One signed, notarized app (Apple silicon, macOS 13 or later) carrying Studio's `tool/` (from `git archive`), `build.json`, node and npm, static ffmpeg and ffprobe, whisper-cli, the compiled helpers and Sparkle 2. Setup is a SwiftUI assistant driving a Node engine over JSON lines, which drives `install.sh --yes`. The background job keeps the label `com.thebrimm.unedited`, with the app in `--agent` mode as its program. Updates come through Sparkle from `updates.thebrimminsights.com`; `edit.js behind` shows the notice and `edit.js update` opens the app's update check. Only the Mac Studio stays a git checkout (`"mode": "dev"`).

Phases: 0 spikes; 1 runs without git or Xcode tools; 2 quotes `{{NODE}}`; 3 the two modes and the update check; 4 `install.sh --tools/--app`, `idleWhy`, the pinned whisper model; 5 the setup engine (`tool/setup/`); 6 the app and its build (`tool/studio-app/`); 7 Sparkle and safe updates; 8 rollout, retiring `move-app/`. Phases 0 to 4 are on main; `spikes/2026-11-09-studio-mac-app/` holds the spikes' throwaway scripts (outside `tool/`, so `git archive` skips them).

## External programs

- **ffmpeg, ffprobe:** found by `findPrograms` (node's own folder, then PATH, then Homebrew's), or only from `--tools` in installed mode.
- **whisper:** `whisper-cli`, with `ggml-large-v3-turbo.bin` pinned by URL revision and SHA-256 in `whisper-model.pin.json`.
- **claude:** `claude -p --model claude-opus-5-5 --tools "" --strict-mcp-config --disable-slash-commands --no-session-persistence --setting-sources "" --output-format json`, the request on stdin (`unedited.js` `CLAUDE_ARGS`). `GUARD_CLAUDE` is the lowest Claude Code version the folder's guard accepts.
- **HyperFrames CLI:** pinned in `hyperframes.pin.json` (version 0.8.208, sha512 integrity, GSAP 3.14.2), installed with npm into `~/BRIMM Video Work/.toolchain/hyperframes-<version>` and run by absolute path, never through npx. Its command table is checked against the pinned help text in `tests/fixtures/hyperframes-0.8.208/`.

## Tests

- `cd tool && node --test` (or `npm test`): about 230 `*.test.js` files, flat in `tool/tests/`, with helpers (`*-world.js` build temporary roots and homes, `fixtures.js` holds made-up ffprobe and whisper output), `fixtures/` and `stand-ins/`.
- Programs are stood in, never run: every command takes a context with `run`, `tools`, `spawn`, so tests pass fakes; `tests/stand-ins/hyperframes.mjs` answers for the pinned CLI from fixtures. Installer tests use `--print` only.
- `contract.test.js` pins the SHA-256 of the five version 2 fixtures (made by `tests/fixtures/make-handoff-v2.mjs`) and checks them with `handoffFaultV2`. A changed hash is a contract change.
- `fixtures/today-says.json` pins `edit.js`'s printing of old records: `UPDATE_TODAY=1 node --test tests/edit-labels.test.js`, only for a deliberate change.
- Policy tests: `layout.test.js`, `no-xcode-tools.test.js`, `no-hard-link.test.js`, `final-cut-gone.test.js`, `load-each.test.js`.
- CI: `.github/workflows/tests.yml`, on push and pull request, Ubuntu, Node 24, `node --test` in `tool/`.

## Where the 2026-10-27 architecture spec is out of date

- Its Status line still says "a proposal"; it is built.
- It treats Final Cut as live. Final Cut was retired on 2026-11-06: `fcpxml.js`, `clips.js` and the other Final Cut modules and commands are gone (`final-cut-gone.test.js`).
- Its drop folder is in Dropbox. Since Phase 3 each Mac watches a local drop folder, keeps a video's files on its own disk until the hand-off (`where.js`, layout 6), and `originals.js` moves the recordings to Dropbox afterwards.
- It assumes Homebrew installs everything; installed mode (`build.js`, `--tools`, `--app`) and the Mac app design supersede that.
- It predates planned videos and explainers, the open lock modules and `busy.js`.
