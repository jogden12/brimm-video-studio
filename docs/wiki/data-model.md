# Data model

Every file and record Studio reads or writes, from the code on `main` (6636327, 2026-11-10). Paths in code are under `tool/`. How the parts fit: `architecture.md`.

## The hand-off file (the contract with BRIMM Ops)

`*.brimm-ops.json`, written last into the episode's `final/` folder and dropped by hand on the BRIMM Ops page. JSON indented by two spaces, a line break at the end (`handoffText`). `format` is always `"brimm-video hand-off"`. brimm-operations keeps copies of the fixtures in `tool/tests/fixtures/`; `contract.test.js` pins their hashes. Change the writer, its check or a fixture only together with brimm-operations.

### Version 2 (`tool/handoff-v2.js`: `buildHandoffV2`, checked by `handoffFaultV2`)

Keys in this order, and no others: the check refuses any key the contract does not name.

| Key | Shape |
|---|---|
| `format`, `version` (2), `revision` | `revision`: a whole number from 1, rising across versions and formats |
| `made` | local time with its offset, `YYYY-MM-DDTHH:MM:SS±HH:MM` |
| `madeOn`, `madeBy` | the Mac's name; `brimm-video <commit>` |
| `video` | `{ id, kind, name, recorded, recordedFrom }`: `id` `e-YYYYMMDD-<6 hex>` (the first version's id, kept by later versions); `kind` `finished`, `raw`, `session` or `short video` (a record kept as `episode` is written `raw`); `recorded` a day; `recordedFrom` `video` or `import`. No title: titles live on the page. |
| `main` | not for a session. `{ file, seconds, srt, onPicture? }`: the file's name in `final/`, its length, its captions. `onPicture` (the words drawn on the picture, in order) only for a raw or short video, and left out when empty. |
| `suggestions` | a finished or raw video's only, left out when none: `[{ n, start, end, stretches: [{start, end}], first, last, why, point }]`, on the final main video's clock, to the hundredth of a second. A finished video's suggestion is one stretch. A suggestion is kept only when 70 in 100 of its words survive the cut (`suggestionsOnClock`, `KEPT_IN_100`). |
| `reels` | not for a short video. `[{ n, title, file, seconds, inMain?, srt, fromSuggestion }]`; `title` may be empty but must be there; `fromSuggestion` is the suggestion's number (and then equals `n`) or `null` for a Reel from times she gave (a fresh number). A session's Reel has no `inMain` and carries `clientAgreed` (the day the client's agreement was noted, never who), and its `fromSuggestion` is `null`. |
| `session` | `null` unless a session. A session: `{ principles, recurringPrinciples, reelsToFilm }`, only what Sallie approved. Principle: `{ n, name, category?, description?, steps?, red_flags?, green_flags?, decision_criteria?, example_application?, verbatim_key_phrases? }`; fields the name check took out are left out; `source_context` is never written. Recurring: `{ n, text }`. Reel idea: `{ n, idea, words?, why?, principle }` (`principle` a principle's number or `null`). A session's hand-off has no `main` and no transcript. |

### Version 1 (`tool/handoff.js`: `buildHandoff`, `handoffFault`; still read by the page)

`{ format, version: 1, revision, made, madeOn, madeBy, episode: { id, kind: "episode"|"short video", name, recorded, recordedFrom, title }, main: { file, seconds, srt }, reels: [{ n, title, file, seconds, inMain?, srt }] }`. An episode needs its approved title; a short video has no Reels. `inMain` is where a Reel's words fall in the main video (90 in 100 of them found in order, within 1.5 times the Reel's length).

`normalWords` (in `handoff.js`) also makes the words that `versions.js` fingerprints: change it and every stored fingerprint matches nothing.

## The Mac's settings

`~/Library/Application Support/BRIMM Video/settings.json` (`settings.js`; written `.writing` then renamed, unknown fields kept; `install.sh --machine` calls `settings.js write`).

- Required: `version: 1`, `machine` (the Mac's name, at most 40 characters, file-safe), `root` (Dropbox's `BRIMM Video`), `checkout` (where `tool/` is).
- Optional: `import` (`light`), `readings`, `handoffVersion` (1 or 2), `drop` (`Drop` or `Unedited Video`), `dropPath` (the Mac's own drop folder: the Mac is "local"), `exportsPath` (else `~/Downloads`), `sessionTeachings` (on for 90 days), `lock` (`strict` or `open`), `web` (`held` or `open`), `zoomFolder`, `proxyPort`, `studioNode`, `studioAllow`, `userDeny`, `app` (`hyperframes` or `off`), `appHandover`.

Beside it, each written `.writing` then renamed: `written.json` (the last record each episode was written at, to see Dropbox undo a write), `seen.json`, `pending/` (late checks owed: the import's own, `record/`, `final/`, `original/`), `importing/` (status files, local Macs), `access.json`, `guide.json` (her guide's done steps, by hand-off), `update-check.json`, `lock-cache.json` (the guard's cached lock check, 30 s), `progress/`, `receipts/`, `held/`. A session's words for one chat: `~/Library/Application Support/BRIMM Video Words/<chatId>/`, cleared after a day. Logs: `~/Library/Logs/brimm-video.log`, `brimm-video-claude-check.log`.

Environment: `BRIMM_VIDEO_HOME` (Studio's home instead of `HOME`, absolute only; programs it starts get the real `HOME`), `BRIMM_WHISPER_MODEL`; `install.sh` only: `BRIMM_AGENT_PATH`, `BRIMM_HOMEBREW_DIRS`, `BRIMM_CLAUDE`. No code reads `BRIMM_DB`: read the root from settings.json.

## Folders

**Dropbox `BRIMM Video/`** (the settings' `root`). Nothing there is written in place, renamed or moved: files are made whole in a run folder, then cloned in with `/bin/cp -c` (`dropbox.js`), and checked again 15 minutes later (the late check).

- `Episodes/<YYYY-MM-DD> <video name> (<Mac>)/` (`names.js episodeFolderName`, `-2` on a clash): `record/NNNN.json`, `final/` (the finished files and the hand-off), `history/`, `Original files/` (the recordings, after the hand-off), `previews/reel-<n>.mp4`, a plan's `video guide.md`, `shot list.md` and `teleprompter.txt`. An episode from a Dropbox drop also keeps its video and transcript files here.
- `Episodes/.importing/`: import status files for a Mac with a Dropbox drop.
- `Drop/<Mac>/` or `Unedited Video/<Mac>/`: a Dropbox drop folder, marked `.brimm-watched-by`.
- `References/` (pictures she adds; Studio only reads them), `Assets/Logos/`.
- The HyperFrames app's own projects folder (`HyperFrames`) is beside these; no code reads it.

**`~/BRIMM Video Work/`** (local, never in Dropbox):

- `Drop/`: the default local drop folder.
- `.runs/`: run scratch; the import lock `brimm-transcribe-<hash>.lock`.
- `.toolchain/hyperframes-<version>/`: the pinned HyperFrames CLI.
- `<episode folder>/`: `video/` (on a local Mac, the episode's own files: the recording, its `.srt`, `.words.json`, `.cut-plan.json`, `reels.json`; `.import.json`, `.put.json`, `history/`), `working copy/<bytes>-<mtimeMs>.mp4` with a facts `.json` (Reels, footage and voice have their own names), one folder per HyperFrames project, `renders/`, `put back/`, and the locks and markers below.
- `Saved test recordings/`: test originals kept by hand; no code uses it.

## The episode record

`Episodes/<folder>/record/NNNN.json` (`episode.js`). Never overwritten: each change is a new file with the next number, and the record is the highest-numbered file that reads whole. `writeEpisode` refuses a stale write (`NEWER`, `CONFLICTED`, `CHANGED`); a Dropbox conflicted copy stops everything.

- **Id:** `e-YYYYMMDD-<6 hex>`; the short id is the 6 hex (`fbb80c`).
- **Layouts** (`version`): 1 base; 2 layers; 3 the switch (kinds, answer, reading, session); 4 `app`; 5 `planned`, `partOf`; 6 `local`. A Mac on older code reads a newer layout as `newer` and never writes it.
- **Base:** `id`, `rev` (the file's number), `writer {commit, on}`, `kind` (`episode`, `short video`, `finished`, `raw`, `session`, or `null` while unanswered, a part or a plan), `video {file, bytes, seconds, recorded, recordedFrom, sound?}`, `imported`, `name {text, placeholder}`, `title {text, from, approved}`, `editing`, `released`, `archived`, `files`, `spellings` (`[heard, meant]` pairs), `main {cuts, texts, graphics, …}`, `brand`, `reels [{n, status: candidate|picked|dropped|finished, from, to, title, …}]`, `finished {revision, at, on}`.
- **Layout 3:** `answer {state: needs your answer|answered|not for brimm-video|part|planned, guess, came: camera|phone|zoom|sound, by, on, at, private}`, `label`, `fingerprint`, `versionOf`, `session {marked, teachings, cleared, decided, edits, agreed: [{n, at}], …}`, `reading {kind, model, at, on, account, outcome, …}`, `offers {spellings, answered}`, `principles` (the teachings file's name).
- **Layout 4:** `app {toolchain, projects: [{key: main|reel N|clip N, name, madeAt, on, from, workingCopy, opened, handover, fromSuggestion, state: made|opened|exported|finished|kept for an earlier kind}]}`.
- **Layout 5:** `planned {route: script|explainer, title, voice: sallie|heygen|null, cues, shots, lines, filmed, consent, project}` (a plan has `video: null`); `partOf {id, as: talking|screen|b-roll|voiceover, shot, client}`.
- **Layout 6:** `local {on: <Mac>, original}`. Only `record/`, `final/`, `history/`, `Original files/` and a plan's three files are in Dropbox; everything else stays on the Mac named in `on` (`where.js filePlace`).
- **Kinds** (`kinds.js`): the import guesses `clip`, `raw` or `finished`; it came from `zoom`, `sound`, `phone` or `camera`. Upright, square or under 90 seconds is a `short video`.

Import status files (`importing.js`): `"<video> (<Mac>) <importId> <n>.json"`, `{version, machine, pid, video, bytes, seconds, step, at, failed?, problem?, …}`, stale after 10 minutes.

## Transcripts and readings

- From the import, named after the video: `.srt`, `.transcript.txt`, `.words.json` (`[{w, start, end}]` in seconds), `.cut-plan.json` (`phrases`, `ranges` with kinds `keep`, `retake`, `false start`, `cue`), `.cut-plan.txt`, `.rough-cut.srt`, `.rough-cut.transcript.txt`; after a raw video's reading, `.edit-notes.txt`.
- `reels.json` (`reel-candidates.js`): `{format: "brimm-video reels", version, candidates: [{n, ranges [{start, end, crop?}], title, reason, why, point, phrases}]}`.
- A session's teachings (`teachings.js`): `<name>.principles.json` (`format: "brimm-video teachings"`: `principles`, `recurringPrinciples`, `reelIdeas`), with `.principles.txt` and `.reel-ideas.txt`. Other speakers' names are taken out (`sessions.js`). Her choices live in the record's `session.decided` and `session.edits`.
- The reading (`reading.js`): one Claude call, its result in `record.reading` and `record.offers.spellings`; the earlier cut plan is set aside in `history/`.

## The HyperFrames project Studio writes

`~/BRIMM Video Work/<episode folder>/<project>/` (`project.js`), written whole in a run folder and moved into place, the working copy last:

- `index.html`, `meta.json`, `hyperframes.json`, `package.json`, `transcript.json` (`[{text, start, end, id}]`, spelled), `CLAUDE.md` and `AGENTS.md` (the same notes), `vendor/gsap.min.js`, `assets/fonts/`, `assets/logos/`, `media/recording.mp4` (or `media/voiceover.m4a` for an explainer in her voice; footage as `media/b-roll-N.mp4`), `node_modules/.bin/hyperframes` (a link to the pinned CLI).
- `.claude/settings.json` (`hyperframes.js settingsFor`): `permissions.deny` (the pin's denied commands; a clip adds the web tools) and `env` (HyperFrames' telemetry, skills, update and install checks off; `/feedback` and the survey off; the HeyGen key variables blanked). The app ignores this file; the command line honours it.
- `brimm/`: `facts.json`, `cut-suggestions.json` and `reel-suggestions.json` (main only), `graphic-cues.json` (kinds `graphic`, `words`, `b-roll`, `screen`), `face-track.json` (a Reel), `spellings.json` (the house `brim` → `BRIMM` first), `brand.md`, `teleprompter.txt` (an explainer), `references/`.

What the app writes and Studio reads back:

- `.hyperframes/app-history.jsonl` (`app-history.js`): one JSON a line, `{at, engine, asked, did, files}`; only the last 1 MB is read. `history --json` through the pinned CLI gives the versions.
- `.hyperframes/transcripts/`: the app's own cloud transcripts (Studio does not use them).
- `renders/<project>_<YYYY-MM-DD>_<HH-MM-SS>.meta.json` (with `exportedTo`) beside each export; the exports themselves land in Downloads or the Mac's exports folder (`mp4`, `mov`, `m4v` taken).
- `index.html`: where the recording sits on the timeline (`data-start`, `data-duration`, `data-playback-start`/`data-media-start`, `data-playback-rate`; `on-timeline.js`).

## Locks, receipts and markers (all on the Mac's disk)

- In an episode's work folder: `episode.lock` (`{pid, command, nonce}`: one detached run per episode) with `<command>.result.json`; `when-ready.lock`, `late-check.lock`, `workcopy.lock`, `answer.lock`; markers `opens-after-spellings.json`, `finish.asked.json`, `finish.checking.json`, `finish.problem.json`, `resolve.shown.json`, `shown/`.
- `receipts/receipt-<ms>-<6 hex>.json` (`{at, label, form, answers, offered?}`), written after each card by `studio/receipt.sh`; good for an hour.
- `held/` (`held.js`, `scan.js`): marks that hold a session's chat, and the scan's state.
- `busy.js` reads the locks and the launch agent; it writes nothing.
- Atomic writes go through `<file>.writing` then a rename.

## Pins

- `tool/hyperframes.pin.json`: `{version, integrity, gsap: {version, integrity}}` (0.8.208, GSAP 3.14.2).
- `tool/whisper-model.pin.json`: `{url, sha256}` for `ggml-large-v3-turbo.bin`, kept in `~/Library/Application Support/BRIMM Transcribe/`.
- `tool/reel-kit.pin.json` (read by `reel-kit.js` `pinFrom`, which refuses any key missing or misshaped): Reel Kit 1.2.0.
- `tool/reel-kit/requirements-1.2.0.lock` and `tool/reel-kit/requirements-mp-1.2.0.lock` (the pin's `locks.main` and `locks.mp`, each with its SHA-256): every Python package of Reel Kit 1.2.0, exact version and `--hash=sha256:` lines, made once with `uv pip compile --python-version 3.12 --python-platform aarch64-apple-darwin --generate-hashes --no-header --no-annotate` from the kit's `setup/requirements.txt` (main) and from `mediapipe==1.2.2` (mp, its own venv). The install passes each to `uv pip install --require-hashes`. `tests/reel-kit-lock.test.js` reads them; no test runs uv.
  - `version`, and `fingerprint` (`sha256-<64 hex>`): the SHA-256 of a manifest of every regular file in the skill folder (`skills/reel-kit/` of the plugin download), one line `<sha256>  <path>\n` per file, paths relative, `/`-joined, NFC, sorted by their UTF-8 bytes, `.DS_Store` and `._*` left out. A link inside refuses the folder.
  - `required`: the files and folders (ending `/`) Studio relies on in it (`REQUIRED_PATHS`).
  - `license`: its licence's file name (`LICENSE`). It stays with Reel Kit: 1.2.0 keeps it in the plugin folder above the skill folder, so it is not in `required` or the fingerprint.
  - `hyperframes` `{version, integrity}`: Reel Kit's own HyperFrames (0.8.139, npm integrity), kept in `~/BRIMM Video Work/.toolchain/hyperframes-0.8.139`, beside Studio's 0.8.208.
  - `gsap`, `uv` (darwin-arm64) `{version, url, sha256}`; `python`: the exact 3.12 patch the pinned uv installs.
  - `locks` `{main, mp}`, each `{file, sha256}`: the hash-locked requirements files (in `tool/reel-kit/`).
  - `models`: the four of Reel Kit's `pipeline/models.py`, each `{name, bytes, sources: [{url, sha256}, ...]}`, every source in its order (the pose model's "latest" and then its version-1 fallback).
  - `whisper` `{repo, revision, files: [{path, sha256}]}`: faster-whisper medium at a pinned commit.
  - `ffmpeg` `{version, ffmpeg: {url, sha256}, ffprobe: {url, sha256}}`: the static macos-arm64 9.0.2 zips of Reel Kit's `setup.py`, used only when Studio's ffmpeg has no `libvpx-vp9`.
  - Where it lives: KIT in `~/BRIMM Video Work/.toolchain/reel-kit-<version>/` (read only), `REEL_KIT_HOME` in `~/BRIMM Video Work/.reel-kit/` (`tools/bin`, `.venv`). Never `~/reel-kit`.
- A dropped Reel Kit download (read by `reel-kit-drop.js` `readDrop`, never written into): a folder or a zip, of the skill folder or of the plugin folder holding it at `skills/reel-kit/` (with `LICENSE` beside `skills/`). A zip is unpacked into `~/BRIMM Video Work/.toolchain/incoming/<16 hex>/` (the result's `scratch`, which the caller takes away), and its `__MACOSX/` top folder is never looked in. What it reads: `SKILL.md`'s front matter (`name: reel-kit`), `VERSION` (x.y.z), the one `hyperframes@x.y.z` in `pipeline/common.py`, the `GSAP_VERSION = "x.y.z"` line of `setup/setup.py`, and the SHA-256 of `setup/requirements.txt`; the pin's `required` must all be there, and `LICENSE` in the skill folder or the plugin folder. It gives back `{ok, kit, version, fingerprint, hyperframes, gsap, requirementsSha, license, scratch?}` or `{ok: false, why, scratch?}`, `why` a line of `DROP_WHY`. A download in a drop folder, or anywhere in `.toolchain/` (KIT), is refused before it is read. The tests' made-up kit is `tool/tests/fixtures/reel-kit-1.2.0/kit/`.
- An installed Reel Kit (made by `reel-kit-install.js` `runInstall`, stage by stage in `reel-kit-stages.js`, swapped by `reel-kit-swap.js`; nothing else writes them). Each piece is built under `<name>.new` beside the one in use and swapped in, the old one set aside under `<name>.old` until Reel Kit's own `setup.sh --check` ends `READY`, then taken away; if any stage fails or is stopped every swap is undone and every `.new` taken away, so the version in use is as it was. A run first puts back a `.old` whose target is missing and takes away any other `.old` or `.new`. Studio's stamp `.studio-pin.json` (the pin values a piece was made from) says "here already" without running anything.
  - In `~/BRIMM Video Work/.toolchain/`: `reel-kit-<version>/` (KIT: the drop's skill folder copied whole, its fingerprint checked again after the copy), `reel-kit-<version>.LICENSE` (the drop's licence, beside KIT so its fingerprint stays the drop's), `hyperframes-0.8.139/` (npm `--ignore-scripts`, kept only when its `package.json` version, its `package-lock.json` integrity and its program are the pin's).
  - In `~/BRIMM Video Work/.reel-kit/` (`REEL_KIT_HOME`): `tools/uv/uv` (from the pinned tarball), `tools/python/` (uv's Python 3.12, `UV_PYTHON_PREFERENCE=only-managed`, no links in `~/.local/bin`; stamp `{uv, uvSha256, python, interpreter}`), `.venv/` and `.venv-mp/` (`uv venv --relocatable`, then `uv pip install --require-hashes --no-deps -r <lock>`; `lib/python3.12/site-packages/reel-kit.pth` holds KIT's `pipeline` path; stamp `{lock, python, pipeline, relocatable}`), `vendor/gsap.min.js` (Studio's own `tool/vendor/gsap.min.js` when the pin's GSAP is hyperframes.pin.json's, else the pin's download; its first 400 bytes say `GSAP <version>`), `models/<name>` (the four, each the first source whose SHA-256 matches), `hf/hub/models--Systran--faster-whisper-medium/` (`blobs/<sha256>`, `snapshots/<revision>/<path>` a relative link to its blob, `refs/main` the revision: where `download_model('medium', local_files_only=True)` looks), `tools/ffmpeg-9.0.2/` (`ffmpeg` and `ffprobe` from the pinned zips, only when Studio's ffmpeg has no `libvpx-vp9`; stamp the zips' SHA-256), `tools/bin/` (links `node`, `ffmpeg`, `ffprobe`, `python3`, and `npx`, a 0755 file of `npxShim`) and `.setup-version` (`<version>\n`, written only after `READY`).
  - A drop's `scratch` is taken away when the run ends, only when it is a real folder inside `.toolchain/incoming/`.

## Her folder (`~/BRIMM Video Studio`)

Written by `studio.js` (`node settings.js studio --node <node>`): `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/brimm-edit/SKILL.md` and `script.md`, empty `Pictures/` and `Scripts/`.

- **Strict lock** (`settingsOf`): only `Bash("<node>" "<checkout>/tool/edit.js" *)` allowed; Edit, Write, NotebookEdit, WebFetch, WebSearch, every MCP tool, Monitor, RemoteTrigger and SendMessage denied; bypass and auto modes disabled; `env` turns off `/feedback` and the survey; a PreToolUse hook on every tool runs `tool/studio/guard.sh`, and a failure blocks.
- **Open lock** (`openSettingsOf`, only when `lock` is `open` and `OPEN_LOCK_CLAUDE` is named; it is `null`, so every Mac is strict): the sandbox with no network, `~/BRIMM Video Workshop` the one writable place, the never list and gated places denied, auto memory off, the card receipt hook.
- `loosened.js` checks at each session start that her folder has no `settings.local.json` and the lock still holds.

## Her guide (`tool/guide.js`)

One next step per video: `{done: true}` or `{done: false, stage, text, step, after}`. Stages run from `arriving` and `importing` through the card, the reading, `spellings`, the copy, `in-app`, `exported` and `finish-running` to `ops`, the BRIMM Ops page's steps (`OPS`): a finished or raw video `taken, kit, posted, live, cascade`; a short video `taken, posttext, posted`; a session `taken, checked`. A hand-off with steps left stays under way for 60 days. `guide.js` is part of the contract: a new stage lands in step with the BRIMM Ops session.
