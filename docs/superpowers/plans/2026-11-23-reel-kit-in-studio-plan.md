# Reel Kit in Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From an episode part with Sallie on camera, her chat starts a Reel Kit edit (hi-fi, lo-fi or showcase) in the BRIMM style, shows its storyboard in the chat's side panel, and sends the approved edit out either by Reel Kit's own headless render or through the HyperFrames app, back into Studio's exports and `finish`, with the BRIMM Ops hand-off unchanged.

**Architecture:** Studio pins one Reel Kit version (1.2.0) by a fingerprint of its whole folder and installs a dropped download beside its own toolchain, with Reel Kit's Python world, models, HyperFrames 0.8.139 and an `npx` stand-in all pinned and offline after setup. Her chat runs only `edit.js`, so the edit itself runs as a detached headless `claude -p` worker held to the project folder; her chat publishes the worker's storyboard through a narrow opening of the lock for `Artifact` and `ArtifactComments`. A fingerprint of the composition decides whether Reel Kit may render it headless or only the app may export it.

**Tech Stack:** Plain JavaScript in `tool/` (Node 22 or later, no npm packages), zsh only where the installer already is; Reel Kit's Python pipeline run as shipped with uv's Python 3.12; ffmpeg, ffprobe, `claude`, HyperFrames 0.8.139 (Reel Kit's) and 0.8.208 (Studio's), all stood in for in tests.

**Spec:** `docs/superpowers/specs/2026-11-23-reel-kit-in-studio-design.md` (approved by Jason on 2026-11-23: "Approve, plan it"). Read it whole before any task.

## Global Constraints

- Node 22 or later, no npm packages. `cd tool && node --test` runs everything; every test file is flat in `tool/tests/`.
- Write the failing test first and see it fail on the old code. No test runs the real `claude`, the HyperFrames app or command line, Reel Kit's Python scripts, ffmpeg, uv, pip, npm or `curl`: stand-ins print what each would (`tests/stand-ins/`), as `tests/stand-ins/hyperframes.mjs` does today.
- The installer (`install.sh`) runs only with `--print`. `edit.js reelkit install` without `--yes` only prints what it would do. Nothing is installed on a Mac, and no launch agent is changed, without Jason's yes in chat.
- Reel Kit's folder (`KIT`) is read only, never edited, replaced whole on a version change ("Never edit anything in KIT"). The download is read only too: never write into the dropped folder.
- Pinned version: Reel Kit **1.2.0**. Its HyperFrames: **0.8.139**, installed into `~/BRIMM Video Work/.toolchain/hyperframes-0.8.139`, never fetched by npx. Studio's own HyperFrames stays **0.8.208**.
- Everything fetched at run time is pinned by URL and SHA-256 (or npm integrity, or a hash-locked requirements file). After install no Reel Kit command reaches the network: every one runs with `HF_HUB_OFFLINE=1`, `PIP_NO_INDEX=1`, `UV_OFFLINE=1` and HyperFrames' quiet variables (`hyperframes.js` `childEnv`'s `quiet()`).
- `REEL_KIT_HOME` is always set to `~/BRIMM Video Work/.reel-kit/` on every Reel Kit command Studio starts. Nothing of Studio's ever uses `~/reel-kit`.
- Projects live in `~/BRIMM Video Work/<episode>/`, never in Dropbox, never in a drop folder. Reel Kit's render is always run with `--no-deliver`, and Studio clears anything named `<Title> v<n>.mp4` or `<Title> v<n> (phone).mp4` beside the source clip.
- Never `publish`, `cloud`, `lambda` or `cloudrun`. Nothing renders in the cloud. No generator (Higgsfield, ChatCut, ElevenLabs, OpenRouter) is connected to the edit. No yt-dlp run, no `/reel-kit:effect`, no Trials, no Zernio.
- The worker and its card and FX helpers use `claude-opus-5-5`. One worker per Mac at a time.
- `ArtifactData` stays on the never list. Of `Artifact`: `publish` and `open` only, and only for a page Studio staged and a URL Studio recorded. Of `ArtifactComments`: `read`, `reply` (text exactly `On it.`) and `resolve`, only on a recorded URL. Both locks.
- The BRIMM Ops contract does not change: `handoff-v2.js`, `handoff.js`, their fixtures and `contract.test.js` stay byte for byte; `madeBy` stays `brimm-video <commit>`; `tool/shared/`, `lib.js`, `run.js` are not touched.
- Fonts only from Google Fonts or Adobe Fonts; Josefin Sans and Allison from `tool/brand/fonts/` (Google Fonts TTFs, never fontsource). The name on screen is "Sallie Ogden"; the show is "The BRIMM".
- Her words: never print a path or a command for her to type; give the phrase to say, or open the folder in Finder. Every line she reads is true at that moment. Her skill stays under 270 lines.
- The repo is public: no Dropbox account label, absolute local paths, client names, keys or tokens in committed files or fixtures.
- Each task that adds a file or a record updates `docs/wiki/data-model.md` (and `architecture.md`'s module map) in the same commit.
- Leave every "BRIMM Ops page" or artifact reference in other files as it is: another session is sweeping those.

## Review Focus

1. **A download dropped as a macOS zip** (a top-level `__MACOSX/` folder, `._` files, `.DS_Store`, the plugin's own layout with `skills/reel-kit/` inside, or the skill folder alone): a person expects the same version to read with the same fingerprint, whichever way it was dropped. Test in Task 3: `reads the same fingerprint from the folder, its zip, and its zip with __MACOSX`.
2. **A publish whose paths try to leave the staged page** (`../` in `file_path`, a `files` source that is a link out, a `root` above the stage, a staged file swapped for a link after staging): expected refused, every time, in both locks. Tests in Task 12: `refuses a file_path that climbs out of the stage`, `refuses a files source that is a link out`, `refuses a staged file replaced by a link`.
3. **The app opened and nothing changed** (the app writes `.hyperframes/`, its cloud transcripts, history, snapshots): she expects "render it" to still work. Test in Task 17: `opening in the app alone leaves the fingerprint as it was`.
4. **The worker dies mid-step** (the Mac sleeps or restarts, her usage runs out, the process is killed): she expects status to say where it stopped, never "working" for a dead process, and "carry on" to start from that step, never from the start. Tests in Task 10: `a dead worker reads as stopped at its step`, `resume starts from the step it stopped at`.
5. **Her pack in Dropbox missing or half-synced** (Dropbox signed out, BRIMM Video's folder gone, `style.json` not whole): she expects a plain line and nothing made; Studio never makes BRIMM Video's folder, and never quietly edits with the shipped pack while she has her own. Tests in Task 8: `never makes BRIMM Video's folder`, `refuses a pack whose style.json does not read`.

---

## Decisions this plan makes (the spec's "Left to the builder")

1. **How npx finds 0.8.139 offline.** Reel Kit's `common.py` puts `REEL_KIT_HOME/tools/bin` first on `PATH`. Studio writes an `npx` there that runs the pinned `hyperframes.mjs` by absolute path with Studio's node, only when its arguments begin exactly `-y hyperframes@0.8.139`, and refuses anything else with exit 1 and one line on stderr. It never calls the real npx. `tools/bin` also holds links to Studio's `node`, `ffmpeg` and `ffprobe` (or Reel Kit's pinned ffmpeg 9.0.2 when Studio's has no `libvpx-vp9`, which Reel Kit's cutout needs) and `python3` (uv's).
2. **Where a Reel Kit project sits.** `~/BRIMM Video Work/<episode>/<project name>/`, the project name being `project.js` `projectName(...)` of the part with ` Reel Kit v<n>` after it. Reel Kit wants `REEL_KIT_HOME/projects/<slug>`, so that is a symbolic link to the project folder (slug `<episode id's last 6>-<main|reel-n>-v<n>`). `new.py` follows it (it only checks `edit.py` and makes folders with `exist_ok`).
3. **The source clip.** A 4K working copy of the part (`workcopy.js` `makeWorkCopy` with `fourK: true`, and the Reel's `stretch` for a Reel), so a Reel's `KEEP` works inside its own range and Reel Kit gets two 9:16 crops from a 4K take. HDR goes through VideoToolbox as today. Studio links it as `<project>/source/clip.mp4`; nothing is ever in the drop folder.
4. **The worker's tools.** `claude -p --model claude-opus-5-5 --permission-mode dontAsk --strict-mcp-config --disable-slash-commands --setting-sources "" --settings <worker settings> --output-format stream-json --verbose`, with `--allowedTools` and `--disallowedTools` from one table (`reel-kit-worker.js` `WORKER_TOOLS`) and a PreToolUse hook (`tool/reel-kit/worker-guard.mjs`) that answers every call by the same table. The table is the test, as `hyperframes.js`'s command table is.
5. **The status file.** `<project>/studio.json`, written whole (temp then rename) by Studio, never by the worker. The worker writes `<project>/work/worker-status.json` (step, needs), which Studio reads safely and copies in.
6. **What the fingerprint covers.** SHA-256 over the sorted `(path, sha256)` of `edit.py`, `fx/**`, `cards/**` and `public/**`, leaving out `public/snapshots/`, `public/renders/`, `public/.hyperframes/`, `public/CLAUDE.md`, `public/AGENTS.md`, `.DS_Store` and `._*`.
7. **How a render is matched as an export.** Studio writes `<project>/public/renders/<entry name>_<YYYY-MM-DD>_<HH-MM-SS>.meta.json` with `status: "complete"` and `exportedTo` the render in `<project>/renders/`. `exports.js` reads a Reel Kit entry's renders from `<project>/public/`, where the app also writes its own (one helper, `projectDirOf`).
8. **The stand-in for Reel Kit's scripts.** `tests/stand-ins/reel-kit.mjs`, run as `PY`: it reads `KIT/pipeline/<script>.py` from argv and prints and writes what that script would, from `tests/fixtures/reel-kit-1.2.0/` (made-up frames, a small `index.html`, `files.json`, `words.json`), with a scenario variable for failures (`REEL_KIT_STANDIN=qa-fail|no-ready|usage-limit`).
9. **Session clips.** Session videos are not built yet (plan PRs 12 to 14 wait on A0). So Reel Kit refuses any record `gate.js` `gated()` holds, any session, and any footage part `footage.js` `mayGoIn` refuses. When session clips are built, they join the HyperFrames consent gate and the spec's 4b rule; until then the local page (`serve.py`) is only the fallback for a failed publish.
10. **Which Mac is which.** A dev-mode Mac (`build.js`, no `build.json` or `mode: "dev"`: the Mac Studio) installs any well-formed drop beside the one in use and writes the new pin for a pull request. An installed Mac (`mode: "installed"`) installs only the pinned fingerprint.
11. **A second version of one Reel** is a new Reel over the same times (today's `reel` command), then its own Reel Kit edit; R1 holds one Reel Kit edit per part.
12. **Music.** None in R1 (the pack says no music; there is no music library in Studio yet). `SOUND.music` waits for the library.

## Files

New, in `tool/`:

- `reel-kit.pin.json`: the pin (Task 1).
- `reel-kit.js`: the pin read, where everything lives, the folder fingerprint, the environment, the `npx` stand-in's text. Pure but for reading files (Tasks 1, 4).
- `reel-kit/requirements-1.2.0.lock`, `reel-kit/requirements-mp-1.2.0.lock`: hash-locked Python packages (Task 2).
- `reel-kit-drop.js`: reading a dropped download (Task 3).
- `reel-kit-install.js`: the install's plan and stages (Task 5).
- `brand/reel-kit/`: the shipped style pack (Task 7).
- `reel-kit-style.js`: her pack in Dropbox, the copy into `REEL_KIT_HOME/style`, backups, the difference, the brand rules (Task 8).
- `reel-kit-project.js`: a Reel Kit project in an episode, its record entry, its state file, its fingerprint, `projectDirOf` (Tasks 9, 14).
- `reel-kit-worker.js`, `reel-kit/WORKER.md`, `reel-kit/worker-guard.mjs`: the worker (Task 10).
- `storyboard-opening.js`: the lock's narrow opening and the staged pages' registry (Task 12).
- `reel-kit-render.js`: the headless render and its export record (Task 14).
- `app-version.js`: the HyperFrames app's version from `Info.plist` (Task 18).

Changed: `edit.js` (the `reelkit` command, Tasks 6, 11, 13, 14, 16, 17), `gate.js`, `never.js`, `studio/never.json`, `studio.js`, `open-lock.js`, `exports.js`, `studio/SKILL.md`, `studio/SKILL-open.md`, `studio/CLAUDE.md`, `studio/CLAUDE-open.md`, `CLAUDE.md` (front door), `setup/install.js`, `setup/engine.js` (R3), `docs/wiki/*`.

Tests (new): `reel-kit-pin`, `reel-kit-lock`, `reel-kit-drop`, `reel-kit-env`, `reel-kit-install`, `edit-reelkit-install`, `reel-kit-pack`, `reel-kit-style`, `reel-kit-project`, `reel-kit-worker`, `edit-reelkit`, `storyboard-opening`, `edit-reelkit-style`, `reel-kit-render`, `reel-kit-exports`, `reel-kit-app`, `app-version`, `setup-reel-kit`; stand-ins `tests/stand-ins/reel-kit.mjs`, `tests/stand-ins/claude-worker.mjs`, `tests/stand-ins/uv.mjs`; fixtures `tests/fixtures/reel-kit-1.2.0/`.

---

# R1: the Mac Studio

### Task 1: The pin

**Files:**
- Create: `tool/reel-kit.pin.json`, `tool/reel-kit.js`
- Test: `tool/tests/reel-kit-pin.test.js`

**Interfaces:**
- Produces: `pinFrom(text) -> frozen pin`; `PIN`; `kitDir(home, version = PIN.version)` = `<workFolder>/.toolchain/reel-kit-<version>`; `reelKitHome(home)` = `<workFolder>/.reel-kit`; `binDir(home)` = `<reelKitHome>/tools/bin`; `venvPython(home)` = `<reelKitHome>/.venv/bin/python`; `hfDir(home)` = `<workFolder>/.toolchain/hyperframes-<PIN.hyperframes.version>`; `hfCli(home)` = `<hfDir>/node_modules/hyperframes/bin/hyperframes.mjs`; `REQUIRED_PATHS`; `folderFingerprint(dir) -> "sha256-<64 hex>"`.

The pin's keys: `version` ("1.2.0"), `fingerprint`, `required` (`SKILL.md`, `VERSION`, `LICENSE`, `pipeline/`, `setup/`, `kit/`, `fx/LIBRARY.md`, `cards/LIBRARY.md`), `hyperframes` `{ version: "0.8.139", integrity }`, `gsap` `{ version: "3.15.0", url, sha256 }`, `uv` `{ version: "0.12.8", url, sha256 }` (darwin-arm64, from `setup.sh`), `python` (an exact `3.12.<patch>`), `locks` `{ main: { file, sha256 }, mp: { file, sha256 } }`, `models` (the four of `pipeline/models.py`, each `{ name, bytes, url, sha256 }`, copied from it), `whisper` `{ repo: "Systran/faster-whisper-medium", revision, files: [{ path, sha256 }] }`, `ffmpeg` `{ version: "9.0.2", ffmpeg: { url, sha256 }, ffprobe: { url, sha256 } }` (macos-arm64, from `setup.py`).

The fingerprint: every regular file under the folder, by its path relative to the folder (`/`-joined, NFC), sorted by those paths' UTF-8 bytes, `.DS_Store` and `._*` left out; the manifest is one line per file, `<sha256 hex>  <path>\n`; the fingerprint is `sha256-` and the SHA-256 of the manifest. A link anywhere inside refuses the folder (throws).

The real values (`fingerprint`, `integrity`, `revision`, whisper files' hashes, `python` patch) are filled from Jason's 1.2.0 download on the Mac Studio by Claude (by-hand check RK1), never typed from memory.

- [ ] **Step 1: Write the failing tests**

```js
it("refuses a pin whose version is not x.y.z or whose fingerprint is not sha256-<64 hex>", ...) // pinFrom throws
it("refuses a pin missing any of the keys above, or any model without url and sha256", ...)
it("keeps the toolchain and REEL_KIT_HOME in BRIMM Video Work, never ~/reel-kit", () => {
  assert.equal(kitDir("/h"), "/h/BRIMM Video Work/.toolchain/reel-kit-1.2.0");
  assert.equal(reelKitHome("/h"), "/h/BRIMM Video Work/.reel-kit");
  assert.equal(hfDir("/h"), "/h/BRIMM Video Work/.toolchain/hyperframes-0.8.139");
});
it("gives the same fingerprint whatever order the files were written in", ...)
it("leaves out .DS_Store and ._ files, and counts every other file", ...)
it("changes the fingerprint when one byte of one file changes", ...)
it("refuses a folder with a link in it", ...)
it("pins Reel Kit's own HyperFrames, not Studio's", () => assert.notEqual(PIN.hyperframes.version, HF_PIN.version));
```

- [ ] **Step 2: Run them and see them fail**: `cd tool && node --test tests/reel-kit-pin.test.js` → FAIL, `Cannot find module '../reel-kit.js'`.
- [ ] **Step 3: Write `reel-kit.pin.json` (placeholder hashes shaped right, marked in the PR as filled by RK1) and `reel-kit.js`.** `pinFrom` follows `hyperframes.js` `pinFrom` (deepFreeze, throw on a bad shape). `folderFingerprint` streams each file through `createHash("sha256")`.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): the pin and where Reel Kit lives`.

### Task 2: The Python lock files

**Files:**
- Create: `tool/reel-kit/requirements-1.2.0.lock`, `tool/reel-kit/requirements-mp-1.2.0.lock`
- Test: `tool/tests/reel-kit-lock.test.js`

**Interfaces:**
- Consumes: `PIN.locks`.
- Produces: the two files the install's venv stages pass to `uv pip install --require-hashes`.

Made once on the Mac Studio by Claude with the pinned uv (by-hand check RK1): `uv pip compile <KIT>/setup/requirements.txt --python-version 3.12 --python-platform aarch64-apple-darwin --generate-hashes --no-header -o requirements-1.2.0.lock`, and the same for `mediapipe==1.2.2` (the line in `models.py`) into the mp lock.

- [ ] **Step 1: Write the failing tests**

```js
it("locks every package of 1.2.0's requirements.txt by an exact version", ...) // numpy, scipy, pillow, faster-whisper, yt-dlp, opencv-python-headless, onnxruntime, fonttools, pymunk
it("gives every package line at least one --hash=sha256:", ...)
it("locks mediapipe==1.2.2 in the mp lock", ...)
it("matches the pin's sha256 for each lock file", ...)
```

- [ ] **Step 2: Run and see them fail** (no lock files).
- [ ] **Step 3: Add the two lock files** from RK1's run, and their SHA-256 into the pin.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): lock its Python packages by hash`.

### Task 3: Reading a dropped download

**Files:**
- Create: `tool/reel-kit-drop.js`, `tool/tests/fixtures/reel-kit-1.2.0/kit/` (a small made-up kit: the required paths, `VERSION` 1.2.0, a `pipeline/common.py` holding `hyperframes@0.8.139`, a `setup/setup.py` holding `GSAP_VERSION = "3.15.0"`)
- Test: `tool/tests/reel-kit-drop.test.js`

**Interfaces:**
- Consumes: `REQUIRED_PATHS`, `folderFingerprint`, `PIN`.
- Produces: `readDrop(path, { unzip, scratch }) -> { ok: true, kit, version, fingerprint, hyperframes, gsap, requirementsSha } | { ok: false, why }`. `kit` is the folder holding `SKILL.md` (the path itself, or `skills/reel-kit/` inside a plugin folder). A zip is unpacked by `unzip(zip, into)` (in Studio, `/usr/bin/ditto -x -k`) into `scratch` (`<workFolder>/.toolchain/incoming/<random>/`), never beside the zip. `DROP_WHY` holds each refusal's line.

Refusals, one line each, in her words: not a folder or a zip; no `SKILL.md` naming `reel-kit`; a required path missing (named); `VERSION` not x.y.z; no `hyperframes@x.y.z` in `pipeline/common.py`; a link inside; the path is inside a drop folder (`settings.js` `dropFolderOf`) or inside `KIT` already.

- [ ] **Step 1: Write the failing tests**

```js
it("reads the version, fingerprint, HyperFrames pin and GSAP version of the skill folder", ...)
it("finds skills/reel-kit inside the plugin's own folder", ...)
it("reads the same fingerprint from the folder, its zip, and its zip with __MACOSX", ...) // Review Focus 1
it("names the missing path when fx/LIBRARY.md is not there", ...)
it("refuses a download in the drop folder, and writes nothing there", ...)
it("never writes into the dropped folder", ...) // its tree's stamps are the same after
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement `readDrop`.** A zip's `__MACOSX/` top folder is left out by looking for `SKILL.md` only outside it.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): read a dropped Reel Kit download`.

### Task 4: Reel Kit's environment and its `npx`

**Files:**
- Modify: `tool/reel-kit.js`
- Test: `tool/tests/reel-kit-env.test.js`

**Interfaces:**
- Consumes: `hyperframes.js` `childEnv` (its quiet variables).
- Produces: `reelKitEnv({ home, node, base }) -> env` and `npxShim({ node, cli, version }) -> text`.

`reelKitEnv`: `PATH` = `binDir(home)`, `/usr/bin`, `/bin`; `HOME` and `LANG` from `base` (as `childEnv`); `REEL_KIT_HOME` = `reelKitHome(home)`; `HF_HOME` = `<reelKitHome>/hf`; `HF_HUB_OFFLINE=1`, `PIP_NO_INDEX=1`, `UV_OFFLINE=1`, `PYTHONNOUSERSITE=1`; HyperFrames' quiet variables. Nothing of Anthropic's, no proxy, no `CLAUDE_CODE_SESSION_ID`, no `CODEX_*`. Throws on a relative `HOME` or `node`.

`npxShim`: a `/bin/sh` script. If `$1` is `-y` and `$2` is exactly `hyperframes@<version>`, it shifts both and `exec`s `"<node>" "<cli>" "$@"`; anything else prints `This npx runs only HyperFrames <version>.` to stderr and exits 1. Both paths are written in single quotes (`studio.js` `shellWord`).

- [ ] **Step 1: Write the failing tests**

```js
it("always sets REEL_KIT_HOME to BRIMM Video Work's .reel-kit", ...)
it("turns the network sources off and HyperFrames' own calls home off", ...) // the variables above
it("passes nothing of Anthropic's and no proxy from the base", ...)
it("runs the pinned cli for npx -y hyperframes@0.8.139 with the network off", ...) // writes the shim to a temp bin, a stand-in node script as `cli` that prints its argv; PATH has no real npx; asserts the stand-in ran with ["--version"]
it("refuses npx -y hyperframes@latest and npx anything-else", ...) // exit 1, the line
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement both.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): its quiet environment and an npx that serves only the pin`.

### Task 5: The install's plan and stages

**Files:**
- Create: `tool/reel-kit-install.js`, `tool/tests/stand-ins/uv.mjs`
- Test: `tool/tests/reel-kit-install.test.js`

**Interfaces:**
- Consumes: `readDrop`, `PIN`, the paths of Task 1, `reelKitEnv`, `npxShim`, `setup/install.js` `sha256Of`, `runProgram`, `npmArgs`'s pattern, `findPrograms` (Studio's node, ffmpeg, ffprobe).
- Produces: `installPlan({ home, drop, pin, mode }) -> { refused: "" | line, steps: [{ id, words, needed }] }` and `runInstall({ home, drop, plan, programs, run, fetch, progress, signal }) -> { ok, lines, credit }`. Step ids, in order: `kit`, `python`, `venv`, `mp`, `hyperframes`, `chrome`, `gsap`, `models`, `whisper`, `bin`, `check`.

Each stage is skipped when what it makes is already there and matches its pin (said as "here already"); each fetch is checked against its SHA-256 or integrity and taken away on a mismatch; every stage writes into a `.new` folder and renames it into place last; a stage that fails leaves the version in use as it was.

- `kit`: copy `drop.kit` whole into `kitDir(home, drop.version)`, then check its fingerprint again there.
- `python`: uv from `PIN.uv`, then `uv python install <PIN.python>` with `UV_PYTHON_INSTALL_DIR=<reelKitHome>/tools/python`, `UV_PYTHON_PREFERENCE=only-managed`; link `tools/bin/python3`.
- `venv`, `mp`: `uv venv` then `uv pip install --require-hashes --no-deps -r <lock>` into `.venv` and `.venv-mp`; then the `reel-kit.pth` line `models.py` `pth` writes (Studio writes it, pointing at `kitDir/pipeline`).
- `hyperframes`: npm install of `hyperframes@0.8.139` into `hfDir(home)`, `--ignore-scripts`, integrity checked as `install.sh` does for 0.8.208. `chrome`: its `browser ensure` once, in `reelKitEnv` but with the network on.
- `gsap`: checked against Studio's own copy first: when `PIN.gsap.version` is `hyperframes.pin.json`'s `gsap.version`, `tool/vendor/gsap.min.js` is copied; otherwise (1.2.0 wants 3.15.0, Studio has 3.14.2) `PIN.gsap` is fetched. Either way into `<reelKitHome>/vendor/gsap.min.js`, whose first 400 bytes must say `GSAP <version>` (what `setup.py` checks).
- `models`: the four into `<reelKitHome>/models/`. `whisper`: each file at `PIN.whisper.revision` into Hugging Face's cache layout under `HF_HOME` (`hub/models--Systran--faster-whisper-medium/{blobs,snapshots/<revision>,refs/main}`), so `download_model('medium', local_files_only=True)` finds it.
- `bin`: links to Studio's node, ffmpeg, ffprobe (Reel Kit's pinned ffmpeg 9.0.2 instead when `ffmpeg -hide_banner -encoders` has no `libvpx-vp9`), `python3`, and the `npx` of Task 4.
- `check`: `sh <kit>/setup/setup.sh --check` in `reelKitEnv`: it must end `READY` (its own render test runs through the `npx` stand-in). Only then Studio writes `<reelKitHome>/.setup-version` (Reel Kit writes it only without `--check`) and passes on Reel Kit's credit line once.

Studio never runs `setup.sh` or `setup.py` without `--check`: without it they `pip install` unpinned packages and fetch what they like.

- [ ] **Step 1: Write the failing tests**

```js
it("plans every step, saying here already for what matches its pin", ...)
it("runs setup only with --check, and never pip", ...) // the stand-in run log holds no "pip install" and no setup.sh without --check
it("takes a download away whose sha256 is not the pin's, and stops", ...)
it("leaves the version in use as it was when a stage fails", ...) // kitDir(home, "1.1.0") untouched, no reel-kit-1.2.0 left half made
it("writes .setup-version only after READY", ...)
it("passes Reel Kit's credit line on once", ...)
it("links Reel Kit's own ffmpeg when Studio's has no libvpx-vp9", ...)
it("copies Studio's GSAP when the versions match, and fetches the pinned one when they don't", ...)
it("puts faster-whisper medium where local_files_only finds it", ...) // layout paths
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.** `fetch` is `curl -fsSL` through `runProgram` (stood in by tests); nothing here calls the network itself.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): install a pinned Reel Kit beside Studio's toolchain`.

### Task 6: `edit.js reelkit install`

**Files:**
- Modify: `tool/edit.js` (the `reelkit` command and its `install` subcommand; `HELP`; `COMMANDS`), `tool/gate.js` (`reelkit` in `UNSCOPED` for `install` and `style`; see Task 11 for the rest)
- Test: `tool/tests/edit-reelkit-install.test.js`

**Interfaces:**
- Consumes: `readDrop`, `installPlan`, `runInstall`, `build.js` `buildOf`/`isInstalled`.
- Produces: `reelkit install "<path>" [--yes]`; on a dev Mac also `<workFolder>/.toolchain/reel-kit-<version>.pin.json` (the new pin, for Jason's pull request).

- A dev Mac: any well-formed drop is planned; with `--yes` it is installed beside the one in use, the new pin is written, and it says: `Reel Kit <version> is installed beside <in use>. It is used once its pin is merged and its checks pass.` The version in use is always `PIN.version`.
- An installed Mac: a drop whose fingerprint is not `PIN.fingerprint` gets one line, `This Reel Kit hasn't been tested yet: ask Jason.`, and nothing else is done. The pinned one installs on `--yes`.
- Without `--yes`: the plan's steps' words, then `Nothing is installed until Jason says yes.`
- Long work runs detached (`detached.js` `startDetached`), with a Mac-wide lock of its own; `reelkit status` reads its result.

- [ ] **Step 1: Write the failing tests**

```js
it("prints the plan and installs nothing without --yes", ...)
it("on an installed Mac refuses a download that is not the pinned one, in one line", ...)
it("on the dev Mac installs a newer version beside the one in use and writes its pin", ...)
it("keeps using PIN.version after a newer one is installed beside it", ...)
it("never names a path or a command for her to type", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass**, then `UPDATE_TODAY=1 node --test tests/edit-labels.test.js` only if `HELP` changed `today-says.json`.
- [ ] **Step 5: Commit** `feat(reel-kit): take a dropped Reel Kit in from her chat`.

### Task 7: The shipped style pack

**Files:**
- Create: `tool/brand/reel-kit/STYLE.md`, `style.json`, `brand.css`, `board/` (from the Mac Studio's `~/reel-kit/style/`, fonts left out)
- Test: `tool/tests/reel-kit-pack.test.js`

**Interfaces:**
- Produces: the pack `reel-kit-style.js` copies from; `SHIPPED_PACK` (its path) in Task 8.

The fonts are not copied: `style.json`'s font files name `fonts/<file>` as Reel Kit expects, and Task 8's copy puts `tool/brand/fonts/`'s TTFs there.

- [ ] **Step 1: Write the failing tests**

```js
it("uses brand.md's colours: Smoke #F8F7F5, Navy #1F2D42, Sand #C1AD97, #8A7358 on light", ...) // read from brand.md, not typed twice
it("sets Josefin Sans in every role, and Allison only as a hand-built word", ...)
it("names only fonts that tool/brand/fonts holds", ...)
it("names the creator Sallie Ogden, the show The BRIMM, and never Sallie Holder", ...)
it("says calm motion, light sound and no music", ...)
it("holds no absolute path or Dropbox label", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Copy the pack in** (Claude on the Mac Studio, from `~/reel-kit/style/`; read it first, never its `refs/`), mend anything the tests find.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): ship the BRIMM style pack`.

### Task 8: Her pack in Dropbox

**Files:**
- Create: `tool/reel-kit-style.js`
- Test: `tool/tests/reel-kit-style.test.js`

**Interfaces:**
- Consumes: `settings.js` (`root`), `reelKitHome`, Task 7's pack.
- Produces: `SHIPPED_PACK`; `herPack(settings)` = `<root>/Reel Kit style`; `ensureHerPack({ settings }) -> { made, why }`; `syncPack({ settings, home }) -> why` (replaces `<reelKitHome>/style` whole with her pack plus `tool/brand/fonts`); `backupPack({ settings, now }) -> name` (`before <YYYY-MM-DD HH.MM>`); `restorePack({ settings, name })`; `packDiff({ settings }) -> lines`; `packFault(dir) -> "" | line`; `shippedMoved({ settings }) -> boolean`.

- Her pack is made from the shipped one only when BRIMM Video's folder exists and `Reel Kit style/` does not; never otherwise, and an update never writes into it.
- `syncPack` runs before every worker job; it refuses (a line, nothing copied) when her pack is gone while `ensureHerPack` says it was made before (`<reelKitHome>/style-made.json`), so the shipped pack is never used in its place.
- `packFault`: `style.json` must parse and name only Google Fonts or Adobe Fonts families that `tool/brand/fonts` holds or the pack's `fonts/` holds as Google Fonts TTFs; no "Sallie Holder"; colours as Task 7. A changed pack that fails is refused in one line.
- `shippedMoved`: the shipped pack's fingerprint differs from the one her pack was made from (kept in `<root>/Reel Kit style/.made-from`).

- [ ] **Step 1: Write the failing tests**

```js
it("makes her pack from the shipped one the first time", ...)
it("never makes BRIMM Video's folder", ...) // Review Focus 5
it("never writes into her pack on an update", ...)
it("refuses a pack whose style.json does not read", ...) // Review Focus 5
it("refuses to edit with the shipped pack once hers has gone", ...)
it("keeps the old pack as before <date> and can go back to it", ...)
it("says how her pack differs from the shipped one, key by key", ...)
it("refuses a font from neither Google Fonts nor Adobe Fonts", ...)
it("tells when Jason has shipped a new base", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.** Writes into Dropbox go through `dropbox.js`'s writing rule; each copy is made beside and renamed in.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): her style pack in Dropbox`.

### Task 9: A Reel Kit project in an episode

**Files:**
- Create: `tool/reel-kit-project.js`, `tool/tests/stand-ins/reel-kit.mjs`, `tool/tests/fixtures/reel-kit-1.2.0/project/`
- Test: `tool/tests/reel-kit-project.test.js`

**Interfaces:**
- Consumes: `gate.js` `gated`, `sessionNotCleared`; `footage.js` `mayGoIn`; `project.js` `projectName`; `workcopy.js` `makeWorkCopy`, `reelCopyPaths`, `workCopyPaths`; `settings.js` `episodeWork`; `reelKitHome`, `venvPython`, `kitDir`, `reelKitEnv`.
- Produces:
  - `MODES = ["hifi", "lofi", "showcase"]`; `modeOf(word)` (accepts Reel Kit's own synonyms: hifi, hi-fi, high, produced; lofi, lo-fi, low, selfie; showcase, show-off, show off, flex) `-> mode | null`.
  - `startWhy({ record, key, mode, home }) -> "" | line`: refuses a gated record or session; a footage part `mayGoIn` refuses; no mode (`Hi-fi, lo-fi or showcase?`); `main` of a video wider than tall (`Reel Kit makes upright videos only: choose a Reel of it.`); a part with a HyperFrames project entry (`state` not `KEPT`); a part whose Reel Kit edit is queued or at work. A part with an earlier Reel Kit edit gets version `n+1` in a new folder; the entry then names the newest, and the earlier folder stays as it is.
  - `modeLeans(record) -> "lofi" | "hifi" | ""` (an iPhone clip leans lo-fi, a raw sit-down take hi-fi), said, never chosen.
  - `entryOf({ key, name, mode, version, at, machine, fromSuggestion }) -> { key, name, maker: "reel-kit", mode, version, madeAt, on, opened: [], handover: false, state: "made", fromSuggestion }`: the shape of `app.js`'s and `app-reel.js`'s `madeEntry`, so `exports.js` and `finish` take it as they take theirs. Reel Kit's own progress is in the project's `studio.json` (`statusOf`'s states, then `rendered`), never in the record.
  - `projectFolderOf(home, folder, name)`; `slugOf(record, key, version)`; `linkProject(home, slug, dir)` (the link of Decision 2; refuses to replace anything that is not its own link).
  - `stateFile(dir)` = `<dir>/studio.json`; `readState(dir)` (refuses a link, a pipe, an oversize file: the safe-open helper); `writeState(dir, state)` (whole).
  - `scaffold(ctx, { record, key, mode, title }, deps) -> { dir, slug }`: makes the 4K source (Decision 3), links it as `source/clip.mp4`, runs `PY <kit>/pipeline/new.py <slug> "<clip>" "<title>" --mode <mode>` in `reelKitEnv` after `syncPack`.

- [ ] **Step 1: Write the failing tests**

```js
it("asks Hi-fi, lo-fi or showcase? when no mode is given, and never guesses", ...)
it("refuses a session, an unanswered video and a client's part without agreement", ...)
it("refuses the main video of a wide recording", ...)
it("refuses a part that has a HyperFrames project", ...)
it("puts the project in the episode's work folder and links it into REEL_KIT_HOME/projects", ...)
it("cuts a Reel's source to its own times at 4K, and never in the drop folder", ...)
it("runs new.py with the Reel's title word for word", ...) // the stand-in's argv
it("copies her pack in before new.py runs", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement**, and the stand-in `reel-kit.mjs` (Decision 8) for `new.py`.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): a Reel Kit project in the episode`.

### Task 10: The worker

**Files:**
- Create: `tool/reel-kit-worker.js`, `tool/reel-kit/WORKER.md`, `tool/reel-kit/worker-guard.mjs`, `tool/tests/stand-ins/claude-worker.mjs`
- Test: `tool/tests/reel-kit-worker.test.js`

**Interfaces:**
- Consumes: `reelKitEnv`, `venvPython`, `kitDir`, `binDir`, `readState`/`writeState`, `detached.js` `runDetached`, `takeEpisodeLock`'s pattern, `run.js` `isRunning`, `unedited.js` `findPrograms` (the `claude` program).
- Produces:
  - `WORKER_MODEL = "claude-opus-5-5"`.
  - `JOBS`: `edit` (steps `intake`, `cut`, `beats`, `build`, `sound`, `storyboard`, then it stops), `revise` (notes in, `beats`…`storyboard`), `finalize` (after go: `cards`, `build`, `sound`, `ready`), `style` (`style`, `board`).
  - `WORKER_TOOLS({ project, kit, rkHome, bin }) -> { allowed, disallowed }`: allowed `Read`, `Write`, `Edit`, `Glob`, `Grep` inside the project folder (and `Read`/`Glob`/`Grep` of `kit`); `Bash` only for `"<rkHome>/.venv/bin/python" "<kit>/pipeline/<name>.py" "<project>" …` where `<name>` is one of `words cut storyboard build mix cutout matte plate plate_finish track depth fxclip fxsandbox fxlib` (never `trials`, `effect`, `render`), `"<bin>/ffmpeg"`, `"<bin>/ffprobe"`, and `"<bin>/npx" -y hyperframes@0.8.139 check|lint|snapshot` run in `<project>/public` or a card's or effect's folder; `Agent` with `subagent_type` `general-purpose` only. Disallowed: `WebFetch`, `WebSearch`, `Artifact`, `ArtifactComments`, `ArtifactData`, `mcp__*`, `Skill`, `NotebookEdit`, `Monitor`, `SendMessage`, `RemoteTrigger`, the Cron tools, `Workflow`.
  - `workerDecision(input, ctx) -> { decision, reason }`: the hook's answer by that table; a path is judged by its real path (links followed), so a link in the project to outside is refused.
  - `workerArgs({ settingsFile, allowed, disallowed })` (Decision 4); `workerSettings({ checkout, node, project, kit, rkHome, bin })` (the hook, `env` with Studio's feedback variables off, `autoMemoryEnabled: false`).
  - `workerPrompt({ job, project, kit, title, notes, from })`: WORKER.md, the job, the step to start from, the Reel's title, her notes as data (`{beat, text, at}`).
  - `statusOf(dir, alive) -> { state: "queued"|"working"|"stopped"|"storyboard"|"ready"|"failed", step, needs, pid, why }`; a `working` status whose pid is not running reads `stopped` at its step.
  - `macLock(home)` = `~/Library/Application Support/BRIMM Video/reel-kit-worker.lock`; `runJob(ctx, { dir, job }, deps)`: waits in `queued` while another job holds the Mac lock; reads `work/worker-status.json` as it goes; on the stand-in's usage-limit result (`claude`'s `result` event with `subtype` of an error and a usage-limit message, matched by one function, `usageLimited(event)`) ends `stopped` with `why: "usage"`.

WORKER.md is Reel Kit's `SKILL.md` steps 1 to 8 rewritten around Studio's rules: the mode and title come from Studio; no generators and no "generate it" offer (the room is filmed or photographed); no screenshots fetched from the web, only what she drops in; never write outside the project; read the pack's `STYLE.md` and `modes` for the mode; write `NEEDS` word for word into `work/worker-status.json` with the step; `HOOK`'s line is the Reel title Studio gives, word for word; no music unless Studio names a track; stop at the storyboard; card and FX helpers are `general-purpose` agents given Reel Kit's `card-builder` and `fx-builder` briefs with the same limits and the model above; never render (Studio does).

- [ ] **Step 1: Write the failing tests**

```js
it("lets the worker run only the pipeline scripts it names, Studio's ffmpeg and the pinned HyperFrames", ...)
it("refuses the web, MCP, the Artifact tools, trials.py, effect.py and render.py", ...)
it("refuses a Write through a link that leads out of the project", ...)
it("runs claude on Opus with no setting sources but its own and no MCP servers", ...) // workerArgs
it("queues a second job while one runs, and starts it when the first ends", ...)
it("a dead worker reads as stopped at its step", ...) // Review Focus 4
it("stops on her usage limit, says so, and resume starts from the step it stopped at", ...) // Review Focus 4
it("passes her notes as data, never as instructions", ...) // the prompt quotes them in a block marked as her notes
it("copies NEEDS word for word into the status", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement**, with the stand-in `claude-worker.mjs` that plays a scripted run (status writes, tool calls answered by the hook, a usage-limit end).
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): the headless worker and its limits`.

### Task 11: `edit.js reelkit` start, status, notes, go

**Files:**
- Modify: `tool/edit.js`, `tool/gate.js`
- Test: `tool/tests/edit-reelkit.test.js`

**Interfaces:**
- Consumes: Tasks 8 to 10.
- Produces, in her chat (each a word list the strict guard's `WORD` takes):
  - `reelkit start "<episode>" main|reel <n> [reel <n> …] --mode <mode>`: `startWhy` for each, then one detached job per part, queued. Says the mode's lean when it has one, and the time (the worker's steps, said from the status).
  - `reelkit status "<episode>"`: each edit's state, step and time left, and `NEEDS` in Reel Kit's words, with `Drop it in the folder that just opened.` after Studio opens `<project>/from-you/` in Finder (`reveal.js`).
  - `reelkit note "<episode>" <slug> <beat> "<text>"`: appends `{beat, text, at}` to `<project>/storyboard/notes.json` (Reel Kit's own notes file).
  - `reelkit go "<episode>" <slug>`: records her approval (the note `{beat: "all", text: "go"}` too), starts `finalize`.
  - `reelkit revise "<episode>" <slug>`: starts `revise` with the notes since the last version.
  - `reelkit resume "<episode>" <slug>`: resumes a stopped job from its step.
- `gate.js`: `reelkit` is refused for every record `gated()` holds and every session, in the existing order of refusals. Its `install` and `style` words name no episode and pass as `UNSCOPED` commands do.

- [ ] **Step 1: Write the failing tests**

```js
it("asks the mode in one line and starts nothing when none is given", ...)
it("starts several Reels as queued jobs, one running", ...)
it("prints NEEDS in Reel Kit's words and opens the folder for them", ...)
it("writes a note as Reel Kit's {beat, text, at}", ...)
it("refuses every reelkit word for a session and an unanswered video", ...)
it("starts nothing without her go", ...) // go is the only way to finalize
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass**; regenerate `today-says.json` if `HELP` changed it.
- [ ] **Step 5: Commit** `feat(reel-kit): start, follow and approve an edit from her chat`.

### Task 12: The storyboard in the side panel (the lock's narrow opening)

**Files:**
- Create: `tool/storyboard-opening.js`
- Modify: `tool/studio/never.json` (move `Artifact` and `ArtifactComments` from `tools` to a new `narrow` list; `ArtifactData` stays in `tools`), `tool/never.js`, `tool/studio.js` (`guardDecision`), `tool/open-lock.js` (`openDecision`), `tool/edit.js` (`reelkit storyboard`, `reelkit published`)
- Test: `tool/tests/storyboard-opening.test.js`, and new cases in `tests/never.test.js`, `tests/studio.test.js`, `tests/open-lock.test.js`

**Interfaces:**
- Consumes: `readState`, `writeState`, `studio.js` `readable`'s path rules.
- Produces:
  - `NARROW = ["Artifact", "ArtifactComments"]`; `CAPABILITIES = { comments: { composer_only: true } }`.
  - `registryFile(home)` = `~/Library/Application Support/BRIMM Video/storyboards.json` (out of the sandbox's reach): `{ pages: [{ id, kind: "storyboard"|"style-board", stage, files, url, episode, slug }] }`.
  - `stagePage(home, folder, { from, slug, version, kind }) -> { stage, file, files }`: copies `<project>/storyboard/` (or the style board) into her folder's `Storyboards/<slug>/v<n>/` (the Artifact tool takes files only under the chat's working folder), every file `files.json` names and nothing else, each a regular file; registers it.
  - `recordUrl(home, id, url)`: once, the URL a first publish gave; never changed after.
  - `openingDecision(input, { home, folder }) -> { decision: "allow"|"deny", reason }`.
  - `neverCaught` still catches `NARROW` names (so nothing else lets them through); `neverDenyRules` no longer lists them; `guardDecision` and `openDecision` ask `openingDecision` for a `NARROW` name before anything else and take its answer.

`openingDecision` allows only:
- `Artifact` with `action` absent or `publish`: `file_path` is a registered page's `file` (by real path, no link on the way, every file in the stage still a regular file with the size and inode it was staged with); `files`, when given, names exactly that page's files from its stage; `capabilities` absent or exactly `CAPABILITIES`; `url` absent when the page has none recorded, and equal to it when it has; no `type_url`, `asset`, `asset_ids`, `from_url`, `file_paths`, `force`, `pin`, `contract`, `root` outside the stage, `overwrite_unread`. `title`, `description`, `icon`, `label` are let through.
- `Artifact` with `action` `open`, or `quickstart` with `intent: "other"`: `open` only for a recorded URL.
- `ArtifactComments` `read`, `resolve`, and `reply` with `text` exactly `On it.`, each only for a recorded URL. `watch` is refused.
- Everything else of these two tools: deny, with `That is not something this folder does with pages. Ask Jason.` (`list`, `read` of an artifact, `delete`, `pin`, sharing, any URL not recorded, the kept BRIMM Ops page's among them.)

`reelkit storyboard "<episode>" <slug>` stages the newest version and prints, for her chat, what to publish (the staged file and its files, the capabilities), or, when the page has a URL, that URL to publish to. `reelkit published "<episode>" <slug> <url>` records the first URL. Later versions publish to the same URL. Studio never shares.

The fallback, wherever a publish fails: `reelkit storyboard "<episode>" <slug> local` starts Reel Kit's `storyboard/serve.py <project>` detached, on `127.0.0.1:8765` only, and says `Your storyboard is open on this Mac` after opening it in the browser (`open http://127.0.0.1:8765/`). Its notes land in `<project>/storyboard/notes.json`, the same file `reelkit note` writes, so `revise` and `go` read both the same way. One local page runs at a time; a second start stops the first.

- [ ] **Step 1: Write the failing tests** (each in both the strict guard and the open guard)

```js
it("allows a first publish of a staged storyboard with its files and the comments capability", ...)
it("allows a later version only to the URL recorded for it", ...)
it("refuses a publish to any URL not recorded, the kept BRIMM Ops page's among them", ...)
it("refuses read, list, delete, pin, assets and sharing", ...)
it("refuses ArtifactComments on a URL not recorded, and watch on any", ...)
it("refuses a reply that is not exactly On it.", ...)
it("refuses a file_path that climbs out of the stage", ...)          // Review Focus 2
it("refuses a files source that is a link out", ...)                 // Review Focus 2
it("refuses a staged file replaced by a link", ...)                  // Review Focus 2
it("keeps ArtifactData on the never list", ...)
it("leaves Artifact out of the open lock's deny rules and in the never list's catch", ...) // never.test.js, with tests/fixtures/code-tab-tools.json
it("records a page's URL once and never changes it", ...)
it("serves the local page on 127.0.0.1 only, and its go reads as a go", ...) // serve.py stood in; notes.json {beat: "all", text: "go"}
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.** The guard reads the registry with the safe-open helper; any trouble reading it denies.
- [ ] **Step 4: Run them, then `tests/never.test.js`, `tests/studio.test.js`, `tests/open-lock.test.js`, `tests/guard*.test.js` whole, and see them pass.**
- [ ] **Step 5: Commit** `feat(lock): a narrow opening for Reel Kit's storyboards`.

### Task 13: Her style, in chat

**Files:**
- Modify: `tool/edit.js` (`reelkit style`), `tool/reel-kit-worker.js` (the `style` job)
- Test: `tool/tests/edit-reelkit-style.test.js`

**Interfaces:**
- Consumes: Task 8, Task 10's `style` job, Task 12's `stagePage` with `kind: "style-board"`.
- Produces: `reelkit style "<episode or nothing>" show|change "<what she asked>"|yes|back [<name>]|diff|carry`:
  - `show`: her pack's main lines (fonts, colours, motion, sound) and its board, staged for the side panel.
  - `change`: `backupPack`, then the `style` job on a working copy of her pack (onboarding steps 4 and 5), the new board staged; `packFault` refuses a change that breaks a brand rule in one line, and nothing is kept.
  - `yes`: the working copy becomes her pack. `back`: lists `before …` packs, or restores one.
  - `diff`: `packDiff`. `carry`: when `shippedMoved`, carries her changes onto the new base, only after her `yes`.
- A change never alters a video already made (each project has its own `style/` copy).

- [ ] **Step 1: Write the failing tests**

```js
it("keeps the old pack as before <date> before a change", ...)
it("refuses a change that names a font from neither Google Fonts nor Adobe Fonts, and keeps nothing", ...)
it("makes her pack the new one only on yes", ...)
it("leaves an edit already made with the pack it was made with", ...)
it("says when a new base was shipped, and carries her changes only on yes", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): change her style in chat`.

### Task 14: The headless render

**Files:**
- Create: `tool/reel-kit-render.js`
- Modify: `tool/reel-kit-project.js` (`compositionFingerprint`, `projectDirOf`), `tool/edit.js` (`reelkit render`)
- Test: `tool/tests/reel-kit-render.test.js`

**Interfaces:**
- Consumes: `readState`/`writeState`, `reelKitEnv`, `venvPython`, the stand-in `reel-kit.mjs` (`render.py`, `qa.py`).
- Produces:
  - `compositionFingerprint(dir) -> "sha256-<hex>"` (Decision 6).
  - `projectDirOf(work, entry)` = `join(work, entry.name, "public")` for `maker: "reel-kit"`, else `join(work, entry.name)`.
  - `renderWhy(dir, state) -> "" | line`: refuses unless the state is `ready` and `compositionFingerprint(dir) === state.fingerprint`; a changed one says `<Name> was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`
  - `renderReelKit(ctx, { dir, entry }, deps) -> { ok, file, why }`: `PY <kit>/pipeline/render.py <dir> <slug>-v<n> --no-deliver` detached; on a QA failure says so and keeps nothing as an export; on a pass, `sweepCopies` then `writeMeta`, then records the fingerprint after (Reel Kit's own build ran) and the state `rendered`.
  - `sweepCopies(sourceDir, title)`: moves `<Title> v<n>.mp4` and `<Title> v<n> (phone).mp4` beside the source to the Trash (never `rm`), refusing links, by the safe-delete rules.
  - `writeMeta(dir, { name, file, at })` (Decision 7).
- `finalize`'s last step records `state.fingerprint` (Task 10's `ready`).

- [ ] **Step 1: Write the failing tests**

```js
it("renders only an approved edit whose fingerprint still matches", ...)
it("runs render.py with --no-deliver, never without", ...)
it("leaves no copy beside the source clip", ...)
it("writes the meta record exports.js reads, pointing at the render", ...) // metaNameOf and metaOf read it
it("keeps nothing as an export when QA fails, and says so", ...)
it("leaves out snapshots, renders, .hyperframes and the notes from the fingerprint", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): render headless while nothing was changed in the app`.

### Task 15: Exports and `finish`

**Files:**
- Modify: `tool/exports.js` (`exportsFound` uses `projectDirOf`), `tool/edit.js` (the record entry's states through `finish`)
- Test: `tool/tests/reel-kit-exports.test.js`

**Interfaces:**
- Consumes: `projectDirOf`, Task 14's meta record, `finish-reels.js` `nextHandoff`, `lookForExports`.
- Produces: a Reel Kit entry in `record.app.projects` is a part of `finish` like any project: its render is `recorded`, its words come from `final-transcript.js` on the finished video, its on-screen title is Studio's Reel title.

- [ ] **Step 1: Write the failing tests**

```js
it("finds a Reel Kit render as the part's recorded export", ...)
it("finds an app export of a Reel Kit project in its public/renders", ...)
it("hands off a Reel Kit Reel with finish … reels as today", ...)
it("leaves the hand-off's keys and madeBy as the contract names them", ...) // handoffFaultV2 on the made hand-off
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, `tests/contract.test.js` and the `finish*`, `exports*` tests, and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): a Reel Kit edit comes back through finish`.

### Task 16: Her skill and the front door

**Files:**
- Modify: `tool/studio/SKILL.md`, `tool/studio/SKILL-open.md`, `tool/studio/CLAUDE.md`, `tool/studio/CLAUDE-open.md`, `CLAUDE.md` (the front door: one line)
- Test: new cases in `tool/tests/studio.test.js`

**Interfaces:**
- Consumes: every `reelkit` word above.
- Produces: rows in her skill for: asking for a Reel Kit edit (always ask the mode; say the lean), following it, publishing the storyboard as `reelkit storyboard` prints it (Read the staged file first, then publish), reading notes with ArtifactComments and passing each to `reelkit note`, replying `On it.`, her go (`Looks good: render it`, or a comment `Looks good` with beat `all`), revise, the two ways out, her style, a dropped Reel Kit (`reelkit install`), and the local page when a publish fails. The front door's line: a recording with Sallie on camera can go to Reel Kit after its card, beside the HyperFrames project.

- [ ] **Step 1: Write the failing tests**

```js
it("names only reelkit words edit.js has", ...)
it("keeps both skills under 270 lines with the Reel Kit rows in", ...)
it("tells her chat to read a staged page before it publishes it", ...)
it("never tells her chat to share a page", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Write the rows**, each short and on one line.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `docs(studio): her skill learns Reel Kit`.

---

# R2: the app

### Task 17: Open a Reel Kit edit in the app, and the fingerprint refusal

**Files:**
- Modify: `tool/edit.js` (`reelkit app`), `tool/reel-kit-project.js`, `tool/project.js` (export the BRIMM rules' text the notes are made from, if it is not yet)
- Test: `tool/tests/reel-kit-app.test.js`

**Interfaces:**
- Consumes: `app.js` `openOnly` (with `dir` = `<project>/public`), `hyperframes.js` `cliPath`, `compositionFingerprint`, `renderWhy`.
- Produces:
  - `reelkit app "<episode>" <slug>`: only in state `ready` or later; writes `public/CLAUDE.md` and `public/AGENTS.md` with the same BRIMM rules as Studio's own projects plus `This project was made by Reel Kit: leave its timeline and its fx/ and cards/ folders as they are unless Sallie asks.`; opens it; the entry's state `opened`.
  - A project whose fingerprint differs: `reelkit render` and `reelkit revise` refused with the line of Task 14; `reelkit start` on that part makes version `n+1` in a new folder, and the changed one stays as it is.

- [ ] **Step 1: Write the failing tests**

```js
it("opens the project's public folder in the app with BRIMM's notes and the Reel Kit line", ...)
it("opening in the app alone leaves the fingerprint as it was", ...) // Review Focus 3: the stand-in app writes .hyperframes/, renders/, snapshots/
it("refuses a headless render and a rebuild once the app changed it, in one line", ...)
it("starts a new version for further Reel Kit changes, leaving the changed one", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(reel-kit): open an edit in HyperFrames, and keep what she changed there`.

### Task 18: The app's version

**Files:**
- Create: `tool/app-version.js`
- Modify: `tool/edit.js` (`reelkit app` says it), `tool/reel-kit-project.js` (the state records it)
- Test: `tool/tests/app-version.test.js`

**Interfaces:**
- Produces: `appPlists(home)` = `/Applications/HyperFrames.app/Contents/Info.plist` and `<home>/Applications/HyperFrames.app/Contents/Info.plist`; `readAppVersion({ home, run }) -> { version, build, copies: [{ path, version, build }] }` (by `/usr/bin/plutil -convert json -o - <plist>`, stood in; `CFBundleShortVersionString` and `CFBundleVersion`); `appVersionFile(home)` = `~/Library/Application Support/BRIMM Video/app-version.json`; `noteAppVersion(home, seen) -> { changed, was }`.
- When it changed since the last one seen, the next `reelkit app` says one line: `HyperFrames was updated since this project was last opened (<was> to <now>): check that it plays before you change it.` With two copies of different versions it names both.

- [ ] **Step 1: Write the failing tests**

```js
it("reads the version and build from Info.plist", ...)
it("says once when the app's version changed, and not again", ...)
it("names both copies when two HyperFrames apps differ", ...)
it("reads nothing and says nothing when no app is there", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Commit** `feat(app): read the HyperFrames app's version`.

---

# R3: Sallie's laptop

### Task 19: The setup engine installs Reel Kit

Starts only after the Mac app's Phase 8 rollout has reached her laptop.

**Files:**
- Modify: `tool/setup/install.js` (a `stageReelKit` stage), `tool/setup/engine.js` (its line on the Review page and in progress), `tool/setup/summary.js`
- Test: `tool/tests/setup-reel-kit.test.js`

**Interfaces:**
- Consumes: `runInstall` (Task 5) with `mode: "installed"`, `readDrop`.
- Produces: `stageReelKit({ home, tools, progress, signal })`: when `kitDir(home, PIN.version)` holds the pinned fingerprint and anything of Task 5's stages is missing, runs them; otherwise does nothing. The Review page says the disk it takes before the yes (the venv, Python, the models, and tracking and depth, about 400 MB and 100 MB, the first time an effect needs them, from the pin's `bytes`).

- [ ] **Step 1: Write the failing tests**

```js
it("does nothing on a laptop with no Reel Kit dropped in", ...)
it("installs the pinned Reel Kit's Python world and models after the yes", ...)
it("says the disk it takes on Review, before the yes", ...)
it("refuses a Reel Kit whose fingerprint is not the pin's", ...)
```

- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and the `setup-*` tests, and see them pass.**
- [ ] **Step 5: Commit** `feat(setup): install a pinned Reel Kit on her laptop`.

### Task 20: Her guide and skill on the laptop

**Files:**
- Modify: `tool/guide.js`, `tool/studio/SKILL.md` (only if Task 16's rows need a laptop line)
- Test: `tool/tests/guide*.test.js` (new cases)

The guide is part of the BRIMM Ops contract. Its new steps are only the ones before the hand-off (a Reel Kit edit's storyboard, its go, its way out); anything the BRIMM Ops page shows waits for brimm-operations, in step (Open for Jason, 2).

- [ ] **Step 1: Write the failing tests**: `it("gives one next step for each Reel Kit state: storyboard, go, render or app", ...)`, `it("leaves the steps after the hand-off as they are", ...)`.
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and the guide's whole tests, and see them pass.**
- [ ] **Step 5: Commit** `feat(guide): her next step for a Reel Kit edit`.

---

## By-hand checks for Jason

For the By-Hand Checks page, later (not published by this plan). Each says whose step it is and which account; Claude runs the Terminal steps it can reach.

**R1, the Mac Studio, Jason's account**

- **RK1 (Claude):** from the 1.2.0 download, fill the pin: its fingerprint, HyperFrames 0.8.139's npm integrity, faster-whisper medium's revision and file hashes, the exact Python 3.12 patch; make the two lock files with the pinned uv. Paste nothing secret; read no `.env`.
- **RK2 (Claude):** `reelkit install "<download>"` without `--yes`: the plan lists every step, and nothing is written.
- **RK3 (Jason's yes, then Claude):** the real install. Expect READY and the credit line once; note the disk used.
- **RK4 (Claude):** with Wi-Fi off, `npx -y hyperframes@0.8.139 --version` through the stand-in prints 0.8.139; `npx -y hyperframes@latest` is refused; Reel Kit's `setup.sh --check` still says READY.
- **RK5 (Claude):** Studio's ffmpeg has `libvpx-vp9`, or the install linked Reel Kit's own.
- **RK6 (Jason):** his pack in Dropbox is made from the shipped one; `reelkit style show` puts the board in the side panel.
- **RK7 (Jason):** a short vertical clip of his own, hi-fi: the worker runs, the storyboard opens in the side panel; a note on a beat comes back as v2 at the same URL; `Looks good: render it` renders with QA passing; no copy beside the source; `finish` hands it off.
- **RK8 (Claude, in her chat on the Mac Studio):** the lock: a publish to another URL, an Artifact read or list, ArtifactComments on the kept BRIMM Ops page's URL, ArtifactData: each refused with the line.
- **RK9 (Jason):** Reels from a long horizontal recording: two of Studio's suggestions as Reel Kit edits, queued one after the other; `finish … reels` hands both off.
- **RK10 (Jason):** "make the captions bigger": the board, his yes, a `before …` pack kept; going back restores it.
- **RK11 (Claude):** a worker killed mid-step reads as stopped at its step; `reelkit resume` starts from it.
- **RK12 (Jason's yes):** the old `~/reel-kit` (1.0.0, `brimm-1`) to the Trash, its style pack being in the repo.
- **RK13 (Claude):** Reel Kit's `build.py` run twice on the same `edit.py` gives the same fingerprint (Decision 6 depends on it).

**R2, the app**

- **RK14 (Jason):** `reelkit app` opens the edit; opening alone leaves "render it" allowed; a change in the app then refuses it in one line; his export from the app comes back through `finish`.
- **RK15 (Jason):** after a HyperFrames update, the next open says the version line once; it plays.
- **RK16 (Jason):** what the app names a Reel Kit project's export in Downloads (its folder is `public`), so the by-name match is known.

**R3, Sallie's laptop (after Phase 8 reaches it)**

- **RK17 (Jason):** the setup's Review page says the disk; after the yes, Reel Kit is READY there.
- **RK18 (Jason):** a Reel Kit download that is not the pinned one is refused in one line.
- **RK19 (Sallie, with Jason):** her first Reel Kit edit, end to end.

## Open for Jason

1. **Session clips:** this plan refuses every session in Reel Kit until session videos are built (Decision 9). The spec's consent gate and local page for a session's storyboard come with them.
2. **The guide is part of the contract.** R3 changes only the steps before the hand-off; a BRIMM Ops page that shows a Reel Kit edit's steps is a change in step with brimm-operations.
3. **Music:** none in R1 (Decision 12), until there is a music library to pick from.
4. **A second version of one Reel** is a new Reel over the same times, then its own Reel Kit edit (Decision 11).
5. **The pin's PR and the download:** the pin's PR carries the lock files and the pin; the download itself reaches the laptop by hand. Who drops it there: Jason or Sallie?
