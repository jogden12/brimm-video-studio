# Phase 4: install.sh in installed mode (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `install.sh` sets a Mac up from BRIMM Video Studio.app's own copy of Studio. Every program comes from the app (`--tools <bin>`), and the background job is the app's own program in `--agent` mode (`--app <bundle>`). Homebrew is never looked for or run. A real run stops while anything is at work (`idleWhy()`). The transcriber's model is downloaded at a pinned revision and kept only when its SHA-256 is the pin's. A run from the git checkout, with neither option, is as it is today but for the pinned model.

**Architecture:** Two new options decide the mode, and they are checked before anything else. `--tools` makes `find_program` look only in that folder, and drops every Homebrew and Xcode line. `--app` changes one function, `agent_program`, which writes the first `ProgramArguments` of both launch agents, and adds `AssociatedBundleIdentifiers`. A `build.json` beside `tool/` must go with `--tools`, and a git checkout must not. A new `tool/busy.js` holds `idleWhy()`. The installer asks it through node, telling it what `launchctl print` said, in `--print` and once more right before a real run touches the Mac. A new `tool/whisper-model.pin.json` holds the model's address at one revision and its SHA-256, read with sed as the HyperFrames pin is.

**Tech Stack:** zsh, Node 22 or later, ES modules, `node:test`, no packages. `plutil` and `/bin/zsh` on macOS.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, parts 1, 4 and 5 ("Updating safely"). It is on the branch `app-development-phase-0`, not on this one: read it with `git show app-development-phase-0:docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`. The build plan's row 4 is in `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`, and the spikes are in `spikes/2026-11-09-studio-mac-app/README.md` (S3, S4). Both are on that branch too.

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end.
- Node 22 or later, and no packages.
- **The installer is only ever run with `--print`**, by a test (`askWith` asserts it) or by hand. Lines that act in a real run are read, or are run alone in zsh with stand-ins, as `tests/install.test.js` already does ("its lines, read, not run"; "its own lines run alone in zsh").
- No test downloads anything, installs anything, loads a launch agent, or asks the real launchd. Every `launchctl` a test reaches is the PATH stand-in. `busy.js`'s `launchdPid` is tested with a `run` stand-in. No test calls the real `claude`, HyperFrames, HeyGen, `npm` or `curl`.
- **Dev mode** means no `--tools`. In dev mode every line and the launch agent's text are byte for byte as they are today, with one exception: the model's summary line and its download (Task 1). The existing install tests pass unchanged, except the three this plan names: the model test (:267), the check-agent writer test (:399), and the harness's `launchctl` stand-in (Task 5).
- **Installed mode** means `--tools`. It never runs `brew` or looks for it, and never takes a program from the PATH or Homebrew's folders. `xcode-select` is never asked. Every program comes from `--tools`.
- The model pin, exactly (Task 1). The address is `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo.bin` and the SHA-256 is `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69`.
- Exit codes: 0 when it is done, or for a print. 1 when a real run fails. 2 when it refuses. 75 when a real run in installed mode stops because something is at work (sysexits' `EX_TEMPFAIL`, "try again later").
- **No line names an episode's folder.** Its name can carry a client's name. `idleWhy` names a command, never the folder.
- The labels stay `com.thebrimm.unedited` and `com.thebrimm.claude-check`. The log stays `~/Library/Logs/brimm-video.log`.
- **The BRIMM Ops contract.** Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes. `busy.js` reads `run.js`'s text in a test, and never edits it.
- Never read a `.env` file.
- Comments and messages are plain, full-sentence English, as in the rest of `tool/`.
- The line numbers are as of ec15a41. Find each one by the grep given.

## What this phase assumes of the spikes

S3 and S4 have not been run. Where Phase 4 rests on them it takes the design's assumption, and keeps it in one named place that a later change can swap.

- **S3 (node, signed, in the bundle).**
  - Assumed: every program is in one folder, node's own. That folder holds node, npm, ffmpeg, ffprobe, whisper-cli, and the compiled helpers (`helpers.js` `ownBin`, Phase 1). `--tools` names it.
  - The list is one array, `TOOLS_PROGRAMS` in install.sh, plus `helpers.js`'s `HELPERS`.
  - The folder's place in the bundle is not fixed here: it must only be inside the `--app` bundle. The tests use S3's `Contents/Resources/node/bin`.
  - The HyperFrames command line is still installed by that node's npm, as today. If S3 finds that npm or sharp cannot run under the hardened runtime, that step changes in Phase 5 or 6, not here.
- **S4 (the background job through the app).**
  - `agent_program` is the one function to change.
  - Assumed: `ProgramArguments` is `<app>/Contents/MacOS/<CFBundleExecutable>`, then `--agent`, then unedited.js's own arguments (`--rules-only`, `--watch <folder>`, or `--check-claude --until <time>`). The app starts its own node, the one in `--tools`, on its own `tool/unedited.js`, the one beside this install.sh. It passes its environment on unchanged, since `unedited.js --check-claude` reads `XPC_SERVICE_NAME`.
  - `AssociatedBundleIdentifiers` is the bundle's `CFBundleIdentifier`.
  - The plist names no node and no script, so editing its arguments cannot lend the app's macOS grants to another program.
  - Phase 6 builds `--agent` to this. If S4 fails, the engine passes `--tools` without `--app`, and the job is `<tools>/node <tool>/unedited.js` (Task 3).
- **S5 (signing in with no Terminal).** Claude Code's lines keep their Terminal words in this phase. Phase 5 words them once S5 is known.

## Review Focus

1. **The app's path always has spaces, and may sit in a folder whose name has `&`, `<` or `>`.** The plist must read back exactly what was given, and every zsh use must be quoted. Covered in Task 4: "an app in a folder whose name has spaces, & and < >…".
2. **A video dropped while the setup downloads the model or the toolchain.** The real run checks again right before it touches the Mac, and stops with 75. Covered in Task 5: "stops the real run with 75…" and "its own lines, run alone in zsh…".
3. **A lock left by a crash, whose process is gone or which is half a day old.** It must never hold up a repair or an update. Covered in Task 2: "…for half a day at most" and the dead-process cases.
4. **A download that is not the model**, such as a Wi-Fi sign-in page or a cut-short file. It is not kept, the `.part` is taken away, and the installer says so. Covered in Task 1: "keeps a download only when its SHA-256 is the pin's…".
5. **The two kinds mixed.** That is the app's copy run by hand without `--tools`, a git checkout run with `--tools`, or an older copy's install.sh run with a newer app's `--app`. Each is refused before anything is changed. Covered in Task 3: "refuses --tools from a git checkout…", and in Task 4: "refuses an app that is not whole…".

## Files

| File | What changes |
|---|---|
| `tool/whisper-model.pin.json` (new) | the model's address at one revision, and its SHA-256 |
| `tool/busy.js` (new) | `idleWhy`, `pidFromPrint`, `launchdPid`, and the `idle-why` command. Phase 7 adds the `updating.json` marker to this file |
| `tool/install.sh` | the options, the mode checks, `find_program`, the installed summary lines, `agent_program`, `agent_bundle`, `idle_why`, the pinned download, the help |
| `README.md` | one paragraph, "Installed from the app." |
| Tests | new: `busy.test.js`. Changed: `install.test.js` (the harness, new `describe`s, the tests at :267 and :399) |

---

### Task 1: the transcriber's model, pinned

**Files:**
- Create: `tool/whisper-model.pin.json`
- Modify: `tool/install.sh`:
  - the model's names (`grep -n '^MODEL' tool/install.sh`, :107-109);
  - the help's sentence about the model (:67-68);
  - a refusal right after the `--remove` block (`grep -n 'if \[\[ "\$mode" == "remove" \]\]; then'`, :426-445);
  - the summary's model line (`grep -n '  Model:  '`, :872);
  - the download (`grep -n 'if \[\[ ! -f "\$MODEL" \]\]; then'`, :968-978);
  - a new function `model_sha256`, beside `toolchain_holds`.
- Modify: `tool/tests/install.test.js`. Move `valueOf` and `functionOf` from inside `describe("the installer's own text")` (:439-450) to the top level, unchanged, so that the new `describe`s can use them. Add `PINNED` at the top level, next to `MODEL`.

**Interfaces:**
- Produces:
  - `tool/whisper-model.pin.json`, exactly this:
    ```json
    {
      "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo.bin",
      "sha256": "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69"
    }
    ```
    The values were read on 2026-11-09 from two places, and they agree:
    - Hugging Face's own record of that revision of `ggerganov/whisper.cpp`, which is `main` since 2024-10-29: the file's LFS `oid`, for 1,624,555,275 bytes.
    - `shasum -a 256` of the Mac Studio's own model.

    Jason said yes to them on 2026-11-09 (Decided, 1). Phase 5's engine reads the same file.
  - In install.sh, `MODEL_PIN="$HERE/whisper-model.pin.json"`, and `MODEL_URL` and `MODEL_SHA256` read from it with sed. Read them as `HYPERFRAMES_VERSION` is read, taking only the pin's own two-space-indented lines.
  - `model_sha256 FILE` prints FILE's SHA-256 as lowercase hex, read by `$node` with `node:crypto`. It reads the file as a stream, since the model is 1.6 GB. When the file cannot be read, it prints nothing and ends non-zero.

**Decisions:**
- **When the pin will do.** `MODEL_URL` must match `^https://huggingface\.co/ggerganov/whisper\.cpp/resolve/[0-9a-f]{40}/ggml-large-v3-turbo\.bin$`, and `MODEL_SHA256` must match `^[0-9a-f]{64}$`.
- **When it is checked.** The pin is checked right after the `--remove` block, in folder mode and with `--machine`, whether or not the model is here, since a model already here is checked against it too (Decided, 2).
- **A pin that will not do is refused.** `WHY` (the tests' name for it) is this line:
  `The pin of the transcriber's model, tool/whisper-model.pin.json, does not hold its address on Hugging Face at one revision and its SHA-256, so the installer changed nothing.`
  It is followed by a blank line and `Nothing was changed.`, and the run ends with 2.
- **A model already here is checked against the pin** (Jason, 2026-11-09; Decided, 2). It takes about 3 seconds, by `model_sha256`. The summary's model line is the first of these that holds:
  - the model is not here:
    `` `  Model:  to download, about 1.6 GB, to ${MODEL}, from ${MODEL_URL}, and kept only when its SHA-256 is the pin's, ${MODEL_SHA256} (tool/whisper-model.pin.json)` ``
  - `$node` cannot be run yet (dev mode, before Homebrew's node is installed):
    `  Model:  here; its SHA-256 is checked against the pin's once node is installed`
  - its SHA-256 is the pin's: `  Model:  here already, and its SHA-256 is the pin's`
  - otherwise:
    `` `  Model:  here, but its SHA-256 is not the pin's, so the pinned one is downloaded, about 1.6 GB, from ${MODEL_URL}, and replaces it only when its SHA-256 is the pin's, ${MODEL_SHA256} (tool/whisper-model.pin.json)` ``
- **The download.**
  - The block's first line becomes `if [[ ! -f "$MODEL" || "$(model_sha256 "$MODEL" || true)" != "$MODEL_SHA256" ]]; then`. The real run reaches it after node is installed, so a model already here is checked there too.
  - Keep `curl -L --fail --progress-bar -o "$MODEL.part" "$MODEL_URL"` word for word: two tests find it.
  - In place of the size check, run `model_sha256 "$MODEL.part"`. `stat -f %z` goes.
  - When the answer is not `MODEL_SHA256`, take `$MODEL.part` away, say this, and end with 1. A model that was already here is left as it was:
    `` `The model downloaded is not the one tool/whisper-model.pin.json pins: its SHA-256 is ${got:-one that could not be read}, and the pin's is ${MODEL_SHA256}. It may not have downloaded whole. It was not kept. Run this again.` ``
  - When it is the pin's, `mv "$MODEL.part" "$MODEL"`. This replaces a model that was here only after the new one has passed the check.
- **The help's sentence** becomes "downloads the transcriber's model once (about 1.6 GB) when it is not here, at the revision tool/whisper-model.pin.json pins, and keeps it only when its SHA-256 is the pin's,". The rest of that paragraph stays as it is.

- [ ] **Step 1: Write the failing tests.**
  - At the top level, add `const PINNED = JSON.parse(readFileSync(join(HERE, "whisper-model.pin.json"), "utf8"));`.
  - Change the test at :267, "says whether the transcriber's model is here…":
    - The missing model's line becomes `` `\n  Model:  to download, about 1.6 GB, to ${missing.home}/${MODEL}, from ${PINNED.url}, and kept only when its SHA-256 is the pin's, ${PINNED.sha256} (tool/whisper-model.pin.json)\n` ``.
    - The model that is here is the harness's stand-in, which is not the pinned model. Its line becomes `` `\n  Model:  here, but its SHA-256 is not the pin's, so the pinned one is downloaded, about 1.6 GB, from ${PINNED.url}, and replaces it only when its SHA-256 is the pin's, ${PINNED.sha256} (tool/whisper-model.pin.json)\n` ``.
    - The rest of the test is unchanged.
    - Any other test that holds `Model:  here already` changes the same way. Find them with `grep -n 'here already' tool/tests/*.js`.
  - Add a new `describe("the transcriber's model, pinned (Studio app phase 4)", { skip: notAMac }, …)` with these tests:
    - `"pins the model at one revision of Hugging Face's whisper.cpp, by its SHA-256, under the name run.js and the installer give it"`:
      - `Object.keys(PINNED).sort()` deep-equals `["sha256", "url"]`;
      - `PINNED.url` matches the address pattern above, and `PINNED.sha256` matches `/^[0-9a-f]{64}$/`;
      - `basename(PINNED.url)` equals `run.js`'s `MODEL_NAME` (read from its text with `/const MODEL_NAME = "([^"]+)";/`), and equals `basename(MODEL)`;
      - install.sh's text holds no `resolve/main`.
    - `"checks a model already here against the pin: here already when its SHA-256 is the pin's, downloaded again when it is not"`:
      - Make a copy of the tool as the test at :1121 does, and give its pin `PINNED.url` and the SHA-256 of `"the model, made for the test"`.
      - With the model file holding those words, the out holds `"\n  Model:  here already, and its SHA-256 is the pin's\n"`.
      - With it holding `"another model"`, the out holds the "here, but its SHA-256 is not the pin's" line, naming `PINNED.url` and that SHA-256.
      - Both end with 0, and `changedNothing(r)`.
    - `"refuses, before it changes anything, a pin it cannot read an address at one revision and a SHA-256 from, whether or not the model is here"`:
      - Make a copy of the tool as the test at :1121 does.
      - Give the copy's pin each of these in turn: no file; `""`; `"url and sha"`; the address at `resolve/main/`; the address on `huggingface.co.example.invalid`; the address with `http:`; a SHA-256 cut to 63 characters; a SHA-256 in capitals; `{ "sha256": … }` alone.
      - Ask `--print "/Volumes/Work/Unedited video"`, and `--print --machine "Mac Studio" <root>`.
      - Each gives `[status, out]` deep-equal to `[2, WHY + "\n\nNothing was changed.\n"]`, and `[left, ran]` deep-equal to `[[], ""]`.
      - With `files: [MODEL]` and no pin file, it refuses in the same way.
    - `"tells the model's SHA-256 as node reads it (the function alone, in zsh)"`, `{ skip: noZsh }`:
      - Write a file with `"made for the test\n"`.
      - Run `` `node="${process.execPath}"\n${functionOf("model_sha256")}model_sha256 "<file>"` `` in zsh.
      - The stdout is `createHash("sha256")` of those bytes, as hex, with a newline, and the status is 0.
      - For a missing file, the stdout is `""` and the status is not 0.
    - `"keeps a download only when its SHA-256 is the pin's: a page that is not the model, or a cut-short file, is taken away and said (its own lines, run alone in zsh)"`, `{ skip: noZsh }`:
      - The block is the text from `\nif [[ ! -f "$MODEL" || "$(model_sha256 "$MODEL" || true)" != "$MODEL_SHA256" ]]; then\n` to its own `\nfi\n`.
      - A stand-in `curl` first on the PATH writes `$GIVES` (from its environment) into the file after `-o`, and writes its arguments into `curl-asked`.
      - The script is `set -euo pipefail`, then `MODEL_DIR`, `MODEL` (`$MODEL_DIR/ggml-large-v3-turbo.bin`), `MODEL_URL=PINNED.url`, `MODEL_SHA256` and `node`, then `functionOf("say")`, `functionOf("model_sha256")`, the block, and `print -r -- "went on"`.
      - With `GIVES="<html><body>Sign in to the Wi-Fi</body></html>"` and `MODEL_SHA256=PINNED.sha256`:
        - the status is 1, and the stdout holds `It was not kept. Run this again.`;
        - neither `$MODEL` nor `$MODEL.part` is there;
        - `curl-asked` is `` `-L --fail --progress-bar -o ${MODEL}.part ${PINNED.url}` ``.
      - With `GIVES="the model, made for the test"` and `MODEL_SHA256` set to its SHA-256:
        - the status is 0, and the stdout ends `"went on\n"`;
        - `$MODEL` holds `GIVES`, and there is no `.part`.
      - With `$MODEL` already holding `"another model"`, and `MODEL_SHA256` the SHA-256 of `GIVES`:
        - with `GIVES` the Wi-Fi page and `MODEL_SHA256` the pin's: the status is 1, `$MODEL` still holds `"another model"`, and there is no `.part`;
        - with `GIVES="the model, made for the test"` and `MODEL_SHA256` its SHA-256: the status is 0, and `$MODEL` holds `GIVES`.
      - With `$MODEL` already holding `GIVES`, and `MODEL_SHA256` its SHA-256: the status is 0, the stdout is `"went on\n"`, and there is no `curl-asked`.
    - `"says in its help that the model is downloaded at the pinned revision, and kept only when its SHA-256 is the pin's"`: `ask("--print", "--help")`, with the white space folded, holds the sentence above.
- [ ] **Step 2: Run `cd tool && node --test tests/install.test.js`.** Expected: FAIL in the new tests and at :267, since the pin file is not there.
- [ ] **Step 3: Write the pin and the code** to the decisions above.
- [ ] **Step 4: Run `cd tool && node --test tests/install.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** Jason said yes to the pin's values on 2026-11-09. `git add tool/whisper-model.pin.json tool/install.sh tool/tests/install.test.js`, then `git commit -m "Studio app phase 4: the transcriber's model is downloaded at a pinned revision, and kept only when its SHA-256 is the pin's"`. Add the Co-Authored-By line from the session's attribution to every commit in this plan.

---

### Task 2: `busy.js` and `idleWhy`

**Files:**
- Create: `tool/busy.js`
- Test: `tool/tests/busy.test.js`

**Interfaces:**
- Consumes:
  - `workFolder` and `runsFolder` (settings.js);
  - `lockOf`, `whenReadyLockOf` and `runningRun` (detached.js);
  - `isRunning` (run.js), and `lockFile` in the tests;
  - `studioHome` and `homeRefusal` (home.js);
  - `isMain` (is-main.js).
- Produces:
  - `AGENT_LABEL = "com.thebrimm.unedited"`.
  - `RUNS_LOCK_STALE_MS = 43200000`. This is run.js's `STALE_LOCK_MS`, which run.js does not export and which is not edited.
  - `pidFromPrint(printed: string) -> number | null`. It gives the number on the first line that is `pid = N`, with any white space before it, when N is above 0. A line `parent pid = N` is not one.
  - `launchdPid({ run = spawnSync, uid = process.getuid() } = {}) -> number | null`. It runs `` run("/bin/launchctl", ["print", `gui/${uid}/${AGENT_LABEL}`], { encoding: "utf8" }) ``. On status 0 it gives `pidFromPrint(stdout)`, and otherwise `null`.
  - `idleWhy({ home = studioHome(), agentPid = launchdPid(), alive = isRunning, now = Date.now() } = {}) -> string`. It gives `""` when nothing is at work, and otherwise the first line below that applies. It never throws.
  - A command, `node busy.js idle-why [--launchd -]`, guarded by `isMain(import.meta.url)` so that `load-each.test.js` can load the file.

**What is at work, in this order:**
1. **The background job.** `agentPid` is a whole number above 0.
2. **An import's lock.** A file `brimm-transcribe-*.lock` in `runsFolder(home)`, taken in name order. It counts when all of these hold:
   - its text, trimmed, is all digits, and gives a pid above 0;
   - `alive(pid)` is true;
   - its `mtimeMs` is less than `RUNS_LOCK_STALE_MS` before `now`.
   This is the rule `run.js`'s `takeLock` uses to tell a live lock from one that a dead run left.
3. **An episode's command.** For each folder directly in `workFolder(home)`, in name order: `runningRun(home, name, alive)`.
4. **A video being made ready.** The same folders: `runningRun(home, name, alive, whenReadyLockOf(home, name))`.

A folder that cannot be listed counts as holding nothing, as `edit.js`'s `noRunAtWork` counts a lock it cannot read.

**The lines:**
- `` `The import is at work: its background job, com.thebrimm.unedited, is running (process ${pid}).` ``
- `` `An import is at work: it holds its lock (process ${pid}).` ``
- An episode's command:
  - when the command is plain (`/^[a-z][a-z-]{0,39}$/`): `` `A command is at work on an episode: ${command} (process ${pid}).` ``;
  - otherwise: `` `A command is at work on an episode (process ${pid}).` ``.
- `` `A video is being made ready for HyperFrames (process ${pid}).` ``

**The command:**
- After the script, the words are exactly `idle-why` or `idle-why --launchd -`:
  - `idle-why` asks launchd itself (`launchdPid()`);
  - `idle-why --launchd -` takes the pid from what `launchctl print` said, read from standard input with `pidFromPrint`. Empty input means the job is not loaded.
- When something is at work, it prints the line and a newline, and ends with 1. When nothing is, it prints nothing and ends with 0.
- Any other words: it says `Say: node busy.js idle-why [--launchd -]` on standard error, and ends with 2.
- A `BRIMM_VIDEO_HOME` that `homeRefusal` refuses: it says its words on standard error, and ends with 2.

- [ ] **Step 1: Write the failing tests** in `tool/tests/busy.test.js`.
  - Each test gets its own temp home (`mkdtempSync`), removed in `finally`.
  - `alive = (pid) => pid === 4321`.
  - These are the tests:
  - `"is idle when nothing is at work, and when BRIMM Video Work is not there or is a file"`: each of these gives `""`, with `agentPid: null`:
    - an empty home;
    - a home whose `BRIMM Video Work` is a file.
  - `"says the background job is at work while launchd names its process"`:
    - `agentPid: 4321` gives `"The import is at work: its background job, com.thebrimm.unedited, is running (process 4321)."`;
    - `agentPid: null` gives `""`.
  - `"reads launchd's process number from what launchctl print says"`:
    - `pidFromPrint("gui/501/com.thebrimm.unedited = {\n\tactive count = 1\n\tpid = 4321\n\tstate = running\n}\n") === 4321`;
    - each of `"\tstate = not running\n"`, `""`, `"\tpid = 0\n"` and `"\tparent pid = 99\n"` gives `null`;
    - `launchdPid` with a `run` stand-in that keeps its calls, `uid: 501`, and `{ status: 0, stdout: "\tpid = 77\n" }` gives 77. The calls deep-equal `[["/bin/launchctl", "print", "gui/501/com.thebrimm.unedited"]]`;
    - with `{ status: 113, stdout: "" }` it gives `null`.
  - `"says an import holds its lock while its process lives, for half a day at most"`:
    - Write `"4321"` at `lockFile("/Volumes/Work/Drop", runsFolder(home))`. This pins the name that run.js gives the lock.
    - It gives `"An import is at work: it holds its lock (process 4321)."`;
    - it gives `""` with `alive: () => false`;
    - it gives `""` once `utimesSync` puts its time `RUNS_LOCK_STALE_MS + 1000` ms before `now`;
    - it gives `""` when the lock's text is `"x"`.
  - `"says an episode's command is at work by the command alone, never by the episode's folder"`:
    - Write `{ pid: 4321, command: "finish", nonce: "n" }` at `lockOf(home, "2026-11-09 Jane Client session Mac Studio")`.
    - It gives `"A command is at work on an episode: finish (process 4321)."`, and the line does not match `/Jane|Client/`;
    - with `command: "rm -rf ~"` it gives `"A command is at work on an episode (process 4321)."`;
    - with `alive: () => false` it gives `""`.
  - `"says a video is being made ready for HyperFrames while its when-ready lock is held"`: `whenReadyLockOf(home, "2026-11-09 a video Mac Studio")` holding `{ pid: 4321, command: "app" }` gives `"A video is being made ready for HyperFrames (process 4321)."`.
  - `"says the first thing at work: the background job, then an import's lock, then an episode's command, then a video being made ready"`:
    - with all four at once, the line is the background job's;
    - then, with `agentPid: null`, the lock's;
    - then, with the lock taken away, the command's;
    - then, with `episode.lock` taken away, the when-ready line.
  - `"keeps run.js's half day"`: `RUNS_LOCK_STALE_MS === 43200000`, and `run.js`'s text holds `"const STALE_LOCK_MS = 12 * 3600 * 1000;"`.
  - `"as a command, reads what launchctl printed from its standard input, says why and ends 1 when something is at work, and says nothing and ends 0 when nothing is"`:
    - Run `spawnSync(process.execPath, [<busy.js>, "idle-why", "--launchd", "-"], { input, env: { PATH: "/usr/bin:/bin", HOME: home, BRIMM_VIDEO_HOME: home }, encoding: "utf8" })`.
    - `input: "\tpid = 4321\n"` gives `[status, stdout]` deep-equal to `[1, "The import is at work: its background job, com.thebrimm.unedited, is running (process 4321).\n"]`.
    - `input: ""` gives `[0, ""]`.
    - `input: ""` with a runs lock holding `String(process.pid)` gives `` [1, `An import is at work: it holds its lock (process ${process.pid}).\n`] ``.
    - The words `["idle-why", "--what"]` and `["idle"]` each give status 2, with `stderr` holding `Say: node busy.js idle-why [--launchd -]`.
- [ ] **Step 2: Run `cd tool && node --test tests/busy.test.js`.** Expected: FAIL, since `../busy.js` is not found.
- [ ] **Step 3: Write `tool/busy.js`** to the rules above. Start it with a comment that says what it is for (design 5, "Updating safely"), and that Phase 7 adds the `updating.json` marker here.
- [ ] **Step 4: Run `cd tool && node --test tests/busy.test.js tests/load-each.test.js tests/studio-name.test.js tests/plain-words.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/busy.js tool/tests/busy.test.js`, then `git commit -m "Studio app phase 4: busy.js idleWhy says what is at work: the background job, an import's lock, an episode's command, a video made ready"`.

---

### Task 3: `--tools`, the app's own programs

**Files:**
- Modify: `tool/install.sh`:
  - the parsing (`grep -n 'case "\$arg" in'`, :160-193) and the refusals after it (:194-235);
  - a block for the kind of Studio this is, right after the `--remove` block and before Task 1's pin check;
  - `find_program` (:238-246);
  - `AGENT_PATH` (:95);
  - `brew=` (:645);
  - the summary: the Swift line (:709-712), the Xcode and Homebrew lines (:724-729), the HDR line's missing case (:762), `By hand afterwards` (:858), and `Programs to install with Homebrew` (:871);
  - the help.
- Modify: `tool/tests/install.test.js`: add the helpers `appCopy` and `HDR_LISTS`, import `HELPERS` from `../helpers.js`, and add a new `describe`.

**Interfaces:**
- Consumes: `CHECKOUT` (`${HERE:h}`). The build file's name is `build.json`, as `build.js` `BUILD_FILE` has it.
- Produces, in install.sh:
  - `tools`: the folder after `--tools`, by its real path (`${…:A}`), or `""` in dev mode. Every installed-mode branch tests `[[ -n "$tools" ]]`.
  - `app_given`: the word after `--app`, kept as given. Task 4 checks it and uses it.
  - `TOOLS_PROGRAMS=(node npm ffmpeg ffprobe whisper-cli)`.
  - The helpers, read with sed from `helpers.js`'s line `export const HELPERS = [...]`, each named `brimm-<name>`.
  - `DAMAGED="This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair."`
  - `find_program` looks only in `$tools` when that is set.
  - `AGENT_PATH="${BRIMM_AGENT_PATH:-$tools:/usr/bin:/bin}"` in installed mode, set once `$tools` is known. Dev mode's line is as it is.
  - `brew=""` in installed mode. `brew` is never looked for there.

**The parsing, and the refusals of the options.** These come after the existing refusals and before `uname`, in this order. Each is one line and exit 2, as the switch's are.
1. `--tools` or `--app` with nothing after it, or with an option after it. This goes through `switch_missing`, so it is said first, with the switch's own. The options are never put in `switch_options`, which settings.js is told.
   - `Say which folder after --tools, as --tools "<path>".`
   - `Say which app after --app, as --app "<path>".`
2. `--remove` with either:
   `--remove stops the watching and changes no settings, so it does not take --tools or --app.`
3. `--app` without `--tools`:
   `--app goes with --tools, the folder of the app's own programs: ./install.sh --machine "<this Mac>" --tools "<bin>" --app "<BRIMM Video Studio.app>" "<path to BRIMM Video>"`
4. Either without `--machine`:
   `--tools and --app are for a Mac set up with --machine, as BRIMM Video Studio sets one up: ./install.sh --machine "<this Mac>" --tools "<bin>" --app "<BRIMM Video Studio.app>" "<path to BRIMM Video>"`

Until Task 4, `--app` is parsed and refused in these cases, and is otherwise not yet used.

**The kind of Studio this is.** These checks come right after the `--remove` block. Each refusal prints its line, a blank line and `Nothing was changed.`, and ends with 2.
- **The build file.** It is there when anything is at `$CHECKOUT/build.json`, a link to nowhere too (`-e || -L`), as `buildOf` counts it.
  - No `--tools`, and the build file is there:
    `This is BRIMM Video Studio's own copy of Studio (it has a build.json beside tool/), so it is set up only with the app's own programs, never Homebrew's. Open BRIMM Video Studio and choose Repair.`
  - `--tools`, and no build file:
    `--tools and --app are for BRIMM Video Studio's own copy of Studio, which has a build.json beside tool/. This is a git checkout, which is set up with Homebrew's programs: run this again without them.`
- **The tools folder** (installed mode only).
  - It is not a folder:
    `` `The folder after --tools is not a folder: ${tools}. ${DAMAGED}` ``
  - A program or a helper is not a file that can be run (`-f` and `-x`). The missing ones are named in `TOOLS_PROGRAMS` order, then `HELPERS` order:
    `` `BRIMM Video Studio's own programs are not all in ${tools}. Missing: ${names joined by ", "}. ${DAMAGED}` ``
  - `node_old "$tools/node"` (without `say`) says the node is old:
    `` `BRIMM Video Studio's own node, in ${tools}, is ${its --version}, and Studio needs 22 or later. ${DAMAGED}` ``

**The summary in installed mode.** The order of the lines is as in dev mode.
- In place of the Swift line:
  `` `  Studio's helpers, compiled:  in ${tools}: brimm-faces, brimm-progress, brimm-uploaded, brimm-online-only, brimm-read-through` ``
  The list is built from `HELPERS`.
- The Xcode line and the Homebrew line are not said. In their place:
  `` `  Programs, BRIMM Video Studio's own:  in ${tools}: node ${node --version}, npm, ffmpeg, ffprobe, whisper-cli` ``
- The HDR line, when something is missing: after `it has ${…}.` comes `` ` ${DAMAGED}` ``, in place of `Jason: brew upgrade ffmpeg, …`.
- `  By hand afterwards:  the Getting Started guide, which BRIMM Video Studio opens when the setup is done`
- `Programs to install with Homebrew` is not said.
- Every other line is as in dev mode, Claude Code's lines too (S5).

**The help.** Add this entry, with its text at column 35, which the indent test (:1768) pins:

```
#   ./install.sh --machine "<this Mac>" --tools "<bin>" [--app "<BRIMM Video Studio.app>"] "/path/to/The BRIMM DB/BRIMM Video"
#                                    set this Mac up as BRIMM Video Studio does, from the app's own copy of Studio, which has a
#                                    build.json beside tool/ and is never set up without --tools (and a git checkout never with
#                                    it). Every program is the app's own, in <bin>: node, npm, ffmpeg, ffprobe, whisper-cli and
#                                    Studio's compiled helpers. Homebrew is never looked for or run, and Xcode's tools are not
#                                    needed. The background job runs node from <bin>. It takes the other options of --machine
```

**The test helper `appCopy`.** It goes at the top level of `install.test.js`, after `checkoutWithOpenLock`. It makes a copy of BRIMM Video Studio.app, laid out as its build lays it out, in a folder made for the tests (`realpathSync(mkdtempSync(...))`). Its signature:

`appCopy({ under = "Applications", id = "com.thebrimm.video-studio", exe = "BRIMM Video Studio", build = true, lists = HDR_LISTS, oldNode = false } = {}) -> { dir, app, tools, tool, checkout, install, ran(), done() }`

- `app` is `<dir>/<under>/BRIMM Video Studio.app`.
- `Contents/Info.plist` is an XML plist naming `CFBundleIdentifier` `id`, `CFBundleExecutable` `exe` and `CFBundleName` "BRIMM Video Studio".
- `Contents/MacOS/<exe>` is a stand-in that writes `app $*` into `<dir>/ran`.
- `checkout` is `Contents/Resources/Studio`. It holds a copy of this checkout's `tool/`, without its tests (`cpSync` with the filter at :1890), as `tool`. Beside it is a `build.json` holding Phase 3's `WHOLE`, unless `build` is false. `install` is `<tool>/install.sh`.
- `tools` is `Contents/Resources/node/bin`, holding these stand-ins:
  - `node`: `exec "<process.execPath>" "$@"`. With `oldNode`, it answers a `-e` whose script names `process.versions.node` with exit 1, and `--version` with `v20.11.0`. Anything else goes on to the real node.
  - `ffmpeg`: it answers `-hwaccels`, `-filters` and `-version` with `lists`, and writes any other call into `ran`.
  - `npm`, `ffprobe`, `whisper-cli`, and `brimm-<name>` for each of `HELPERS`: each writes `$0 $*` into `ran`.
- `HDR_LISTS = { hwaccels: "Hardware acceleration methods:\nvideotoolbox\n", filters: "Filters:\n .. scale_vt          V->V       Scale Videotoolbox frames\n", version: "ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers" }`.

- [ ] **Step 1: Write the failing tests** in a new `describe("BRIMM Video Studio's own copy of Studio (--tools; Studio app phase 4), asked what it would do", { skip: notAMac }, …)`.
  - It makes one `appCopy()` in `before` and calls `done()` in `after`.
  - It uses a `dropbox()` like the `--machine` describe's (:857). `drop` is `` `${root}/Unedited Video/Mac Studio` ``.
  - These are the tests:
  - `"takes every program from the folder after --tools on a Mac with no Homebrew, and runs the background job with node from there"`. Ask `askWith({ bare: true, install: copy.install }, "--print", "--machine", "Mac Studio", "--tools", copy.tools, root)`.
    - The status is 0.
    - `agents[0].ProgramArguments` deep-equals `` [`${copy.tools}/node`, `${copy.tool}/unedited.js`, "--watch", drop] ``.
    - `agents[0].EnvironmentVariables.PATH` is `` `${copy.tools}:/usr/bin:/bin` ``, and `agents[0]` has no `AssociatedBundleIdentifiers`.
    - The out holds each of these as a whole line: the helpers line; `` `  Programs, BRIMM Video Studio's own:  in ${copy.tools}: node ${process.version}, npm, ffmpeg, ffprobe, whisper-cli` ``; the `By hand afterwards` line.
    - The out holds `` `"checkout": "${copy.checkout}"` ``.
    - The out does not match `/Homebrew|brew |Xcode|xcode-select|Swift/`.
    - `changedNothing(r)`, and `copy.ran() === ""`.
  - `"takes the app's programs over Homebrew's and the PATH's"`. Ask without `bare`, with `ffmpegSays` (an ffmpeg on the PATH).
    - `r.asked === ""`;
    - `ProgramArguments[0]` is `` `${copy.tools}/node` ``;
    - the HDR line names `ffmpeg version 9.0.2`.
  - `"says the app's ffmpeg may be damaged, and never names brew, when it lacks what an HDR video needs"`. Use a second `appCopy({ lists: { ...HDR_LISTS, hwaccels: "Hardware acceleration methods:\n" } })`.
    - The out holds `` `  HDR video:  this Mac's ffmpeg (ffmpeg version 9.0.2) cannot make an HDR video standard, which an iPhone's clip is by default, so the working copy refuses every one: it has no videotoolbox hwaccel. ${DAMAGED}` `` as a whole line.
  - `"refuses a program or a helper missing from the folder, naming each, before anything is changed"`. In the one copy, take each of `[...TOOLS_PROGRAMS, ...HELPERS.map((h) => `brimm-${h}`)]` away in turn, and put it back in `finally`.
    - Each gives `` [2, `BRIMM Video Studio's own programs are not all in ${copy.tools}. Missing: ${name}. ${DAMAGED}\n\nNothing was changed.\n`] ``, and `[left, ran]` is `[[], ""]`.
    - With `ffprobe` and `brimm-faces` both gone, it says `Missing: ffprobe, brimm-faces.`
    - With `whisper-cli` there but `chmod 0o644`, it counts as missing.
  - `"refuses a node older than 22 in the folder"`. Ask with `appCopy({ oldNode: true })`.
    - It gives `` [2, `BRIMM Video Studio's own node, in ${tools}, is v20.11.0, and Studio needs 22 or later. ${DAMAGED}\n\nNothing was changed.\n`] ``.
  - `"refuses --tools from a git checkout, and the app's own copy without --tools, before anything is changed"`:
    - `ask("--print", "--machine", "Mac Studio", "--tools", copy.tools, root)`, this checkout's own installer, gives `[2, <the git-checkout line> + "\n\nNothing was changed.\n"]`.
    - `askWith({ install: copy.install }, "--print", "--machine", "Mac Studio", root)` gives `[2, <the app's-copy line> + "\n\nNothing was changed.\n"]`.
    - So does the copy in folder mode, `"--print", "/Volumes/Work/Unedited video"`.
    - So does the copy when its `build.json` is a folder, and when it is a link to nowhere. Put the file back after each.
  - `"refuses --tools and --app where they do not belong, plainly and before anything else"`. Each of these gives status 2, its line above exactly with a newline, and `[left, ran]` of `[[], ""]` (`root` is a `dropbox()`'s):
    - `"--print", "--machine", "Mac Studio", root, "--tools"`;
    - `"--print", "--tools", "--machine", "Mac Studio", root`;
    - `"--print", "--machine", "Mac Studio", root, "--app"`;
    - `"--print", "--remove", "--tools", "/x"`;
    - `"--print", "--remove", "--app", "/x"`;
    - `"--print", "--machine", "Mac Studio", "--app", "/x", root` (no `--tools`);
    - `"--print", "--tools", "/x", "/Volumes/Work/Unedited video"` (no `--machine`).
  - `"never looks for brew with --tools: its lines, read"`:
    - the text holds `"$brew" install` once;
    - it holds `brew=""` once, in a branch on `[[ -n "$tools" ]]`;
    - it holds `brew="$(find_program brew || true)"` once, in the other branch.
  - `"says in its help how BRIMM Video Studio sets a Mac up with --tools"`: `ask("--print", "--help")`, with the white space folded, holds the entry's sentences from "set this Mac up as BRIMM Video Studio does" to "Xcode's tools are not needed."
- [ ] **Step 2: Run `cd tool && node --test tests/install.test.js`.** Expected: FAIL. `--tools` is not an option the script knows.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/install.test.js tests/helpers.test.js`.** Expected: PASS. Every dev-mode test passes unchanged.
- [ ] **Step 5: Commit.** `git add tool/install.sh tool/tests/install.test.js`, then `git commit -m "Studio app phase 4: install.sh --tools takes every program from the app's own folder, never Homebrew, and only for the app's copy of Studio"`.

---

### Task 4: `--app`, the background job through the app

**Files:**
- Modify: `tool/install.sh`:
  - the tools block of Task 3, which gains the bundle's checks;
  - `agent()` (`grep -n '^agent() {'`, :344) and `check_agent()` (:375);
  - two new functions beside them;
  - the help entry's last sentence.
- Modify: `tool/tests/install.test.js`: the check-agent writer test at :399, and a new `describe`.

**Interfaces:**
- Consumes: `tools`, `app_given`, `DAMAGED` and `appCopy` (Task 3).
- Produces:
  - `app`: the bundle, by its real path. `app_id`: its `CFBundleIdentifier`. `app_exe`: `$app/Contents/MacOS/<CFBundleExecutable>`. Each is `""` without `--app`.
  - `agent_program NODE` prints the first `ProgramArguments` lines of a launch agent, each `    <string>…</string>` through `xml`:
    - with `--app`: `$app_exe`, then `--agent`;
    - otherwise: NODE, then `$HERE/unedited.js`.
    This is the S4 assumption's one place.
  - `agent_bundle`:
    - with `--app`, it prints the plist's `AssociatedBundleIdentifiers`, an array holding `$app_id`;
    - otherwise it prints nothing, and leaves no line behind.
  - `agent` and `check_agent` both use the two functions, so the two agents run the same way. Dev mode's plist text is byte for byte today's.

**The bundle's checks.** They come right after the tools checks. Each refusal is the line below, a blank line, `Nothing was changed.`, and exit 2:

`` `The app after --app is not a whole BRIMM Video Studio (${app}): ${reason} ${DAMAGED}` ``

The checks, and their reasons, in this order:
1. It is not a folder whose name ends in `.app`: `it is not a folder whose name ends in .app.`
2. `plutil -extract CFBundleIdentifier raw -o - "$app/Contents/Info.plist"` must match `^[A-Za-z0-9.-]+$`, and `CFBundleExecutable` must be a name with no `/`, and not `.` or `..`. Otherwise: `its Contents/Info.plist does not name its identifier and its program.`
3. `$app_exe` is not a file that can be run: `its program, Contents/MacOS/${exe}, is not there or cannot be run.`
4. `$tools` is not inside `$app`, by real paths, with `$app/` as a prefix: `` `the programs after --tools, ${tools}, are not inside it.` ``
5. `${HERE:A}` is not inside `$app`: `` `this installer, ${HERE}/install.sh, is not inside it.` ``

**The help.** The entry's last two sentences become: "With --app the background job is the app's own program, started with --agent, so that macOS names the app when it asks for access and in Login Items; without it, node from <bin>. It takes the other options of --machine".

- [ ] **Step 1: Write the failing tests.**
  - Change the test at :399, "ends a Mac's setup with one real call to Claude…". Its zsh script gains `${functionOf("agent_program")}${functionOf("agent_bundle")}` and `app_exe=""; app_id=""`. Its expected plist is unchanged.
  - Add a new `describe("BRIMM Video Studio's background job through the app (--app; Studio app phase 4), asked what it would do", { skip: notAMac }, …)`. It makes two copies in `before`, `copy` and `other`, and a `dropbox()`. Its `ask` is `askWith({ bare: true, install: copy.install }, "--print", "--machine", "Mac Studio", "--tools", copy.tools, "--app", copy.app, …more, root)`.
  - These are the tests:
  - `"runs the background job as the app's own program with --agent, and names the app to macOS"`:
    - `held(agents[0])` deep-equals `{ Label: "com.thebrimm.unedited", ProgramArguments: [`${copy.app}/Contents/MacOS/BRIMM Video Studio`, "--agent", "--watch", drop], AssociatedBundleIdentifiers: ["com.thebrimm.video-studio"], WatchPaths: [drop], RunAtLoad: true, EnvironmentVariables: { PATH: `${copy.tools}:/usr/bin:/bin` }, StandardOutPath: log, StandardErrorPath: log }`, where `log` is `join(r.home, "Library/Logs/brimm-video.log")`;
    - `changedNothing(r)`, and `copy.ran() === ""`, so the app's program is not run.
  - `"passes --rules-only on after --agent"`: with `--rules-only`, `ProgramArguments` is `[<exe>, "--agent", "--rules-only", "--watch", drop]`.
  - `"runs the check of Claude through the app too (its writer, run alone)"`, `{ skip: noZsh }`:
    - Run the writer as the :399 test does, with `app_exe="/Applications/BRIMM Video Studio.app/Contents/MacOS/BRIMM Video Studio"` and `app_id=com.thebrimm.video-studio`.
    - The plist's JSON deep-equals the :399 test's, but `ProgramArguments` is `[<that exe>, "--agent", "--check-claude", "--until", "1800000180"]`, and `AssociatedBundleIdentifiers` is `["com.thebrimm.video-studio"]`.
  - `"an app in a folder whose name has spaces, & and < > is named exactly"` (Review Focus 1). With `appCopy({ under: "R&D <apps>" })`:
    - `ProgramArguments[0]` is exactly `` `${app}/Contents/MacOS/BRIMM Video Studio` ``;
    - `WatchPaths` reads back as given, and `plutil -lint` passes (the harness checks it).
  - `"refuses an app that is not whole, or that does not hold the programs and this installer, before anything is changed"`. Each gives `[2, <the line above with its reason> + "\n\nNothing was changed.\n"]`, and `[left, ran]` of `[[], ""]`. Put back what each changed in `finally`.
    - `--app copy.tools` (not an `.app`);
    - an Info.plist with no `CFBundleIdentifier`;
    - `CFBundleExecutable` of `"../x"`;
    - the program `chmod 0o644`;
    - `copy`'s installer with `--tools other.tools --app copy.app` (programs not inside it);
    - `other`'s installer with `--tools copy.tools --app copy.app` (installer not inside it).
  - `"keeps dev mode's launch agent as it was: node and unedited.js, no AssociatedBundleIdentifiers, no blank line"`: `ask("--print", "/Volumes/Work/Unedited video")`. `agents[0].text` holds no `AssociatedBundleIdentifiers` and no `"\n\n"`, and `ProgramArguments.slice(1, 2)` is `[join(HERE, "unedited.js")]`.
  - `"says in its help that with --app the background job is the app's own program"`: the help, folded, holds the new sentence.
- [ ] **Step 2: Run `cd tool && node --test tests/install.test.js`.** Expected: FAIL in the new tests, and at :399, since `agent_program` is not found.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/install.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/install.sh tool/tests/install.test.js`, then `git commit -m "Studio app phase 4: install.sh --app runs the background job as the app's own program with --agent, and names the app to macOS"`.

---

### Task 5: waiting for nothing at work, and the README

**Files:**
- Modify: `tool/install.sh`:
  - `BUSY` and a new function `idle_why`, near the other constants and functions;
  - a summary line before `if [[ "$print" == "yes" ]]; then` (:878);
  - a check in the real run, right after the model's download (:968-978) and before `if [[ -n "$machine" ]]; then\n  if ! settings_plan "$node"; then` (:983);
  - the help entry.
- Modify: `README.md`: a paragraph after "**Setting a Mac up.**" (:272).
- Modify: `tool/tests/install.test.js`: the harness's `launchctl` stand-in (:84-88), `askWith`'s options and answer, and a new `describe`.

**Interfaces:**
- Consumes: `node busy.js idle-why --launchd -` (Task 2); `tools` (Task 3).
- Produces:
  - `BUSY=75`, the real run's exit when something is at work. Phase 5's engine waits, then runs it again.
  - `idle_why` prints `busy.js`'s line for what `launchctl print "gui/$(id -u)/$LABEL"` says. Nothing is passed on when launchctl fails. It runs `"$node" "$HERE/busy.js" idle-why --launchd -`, and its status is busy.js's. launchctl is found on the PATH, as every launchctl in install.sh is.
  - The callers take a failure that says nothing as busy, with this line: `Whether anything is at work on this Mac could not be told.` Write it as `why="$(idle_why)" || why="${why:-…}"`, so that `set -e` does not end the run there.

**Where, and the words.** Installed mode only. Dev mode asks launchd nothing here (Decided, 3).
- **In `--print`**, after the `Left behind by an earlier setup` line:
  - nothing at work: `  At work now:  nothing, so the background job can be stopped and started again`;
  - something at work: `` `  At work now:  ${why} The real run stops before it touches this Mac's drop folder, its settings and its background job, until that is done` ``.
  - A print still ends with 0.
- **In the real run**, one check, in its own `if [[ -n "$tools" ]]; then … fi`: the first such block after `mv "$MODEL.part" "$MODEL"`, and before the second `settings_plan "$node"`. When something is at work, it says a blank line, then the line below, and ends with `$BUSY`:
  `` `${why} Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed or downloaded first stays. Run this again once that is done.` ``
- **The help entry gains:** "A real run stops, with 75, before it touches this Mac's drop folder, its settings or its background job, while an import or an episode's command is at work".

**The README paragraph** goes after "**Setting a Mac up.**". It starts "**Installed from the app.**" and says, in the README's own way:
- the app runs `install.sh --yes --machine "<this Mac>" --tools "<its programs' folder>" --app "<the app>" "<BRIMM Video>"`, from its own copy of Studio, which has a `build.json` beside `tool/`;
- every program is then the app's (node, npm, ffmpeg, ffprobe, whisper-cli, and Studio's compiled helpers), in that folder, which must be inside the app;
- Homebrew is never looked for or run, and nothing on the PATH is used;
- with `--app` the launch agent is the app's own program with `--agent`, and names the app (`AssociatedBundleIdentifiers`); without it, the agent is node from that folder;
- the app's copy is never set up without `--tools`, and a git checkout never with it;
- a real run stops with 75 while anything is at work (`tool/busy.js` `idleWhy`), before it touches the drop folder, the settings or the launch agent;
- the transcriber's model is downloaded at the revision `tool/whisper-model.pin.json` pins, and kept only when its SHA-256 is the pin's, on every Mac.

- [ ] **Step 1: Write the failing tests.**
  - **Change the harness.** The `launchctl` stand-in answers `print` without writing it into `ran`. Instead it writes `$*` into `<dir>/launchd-asked`, then prints the text of `<dir>/launchd-says` and ends with 0 when that file is there, or ends with 113, as launchd does for a job that is not loaded. Any other call is written into `ran`, as today. `askWith` takes `launchd` (text for `launchd-says`, none by default), and gives back `launchdAsked` (that file's text, or `""`).
  - Add a new `describe("waiting for nothing at work (Studio app phase 4)", { skip: notAMac }, …)`, with one `appCopy()` and installed mode asked as Task 4 asks it (`--tools` and `--app`). These are the tests:
  - `"says nothing is at work when nothing is, and asks launchd once"`:
    - the out holds `\n  At work now:  nothing, so the background job can be stopped and started again\n`;
    - `r.launchdAsked` is `` `print gui/${process.getuid()}/com.thebrimm.unedited\n` ``;
    - the status is 0, and `changedNothing(r)`.
  - `"names what is at work: the background job launchd names, or an import's lock"`:
    - `launchd: "\tpid = 4321\n"` gives the line `  At work now:  The import is at work: its background job, com.thebrimm.unedited, is running (process 4321). The real run stops before it touches this Mac's drop folder, its settings and its background job, until that is done`;
    - `files: [["BRIMM Video Work/.runs/brimm-transcribe-0123456789abcdef.lock", String(process.pid)]]` gives the lock's line, naming `process.pid`;
    - both end with 0, `r.ran === ""`, and `r.left` is just what the test put there.
  - `"in dev mode asks launchd nothing and says no such line"`: `ask("--print", "--machine", "Mac Studio", root)` gives `r.launchdAsked === ""`, and the out holds no `At work now`.
  - `"stops the real run with 75 right before it touches the Mac, after the downloads (its lines, read, not run)"`:
    - the text holds `\nBUSY=75\n`;
    - the check's block is in a branch on `[[ -n "$tools" ]]`, and ends with `exit $BUSY`;
    - it comes after `curl -L --fail --progress-bar -o "$MODEL.part" "$MODEL_URL"` and after `run_hyperframes doctor`;
    - it comes before `if ! settings_plan "$node"; then`, before `mkdir -p "${folders[@]}"`, and before `agent "$node" > "$AGENT_FILE"`.
  - `"its own lines, run alone in zsh, stop while the background job runs, and go on when nothing is at work"`, `{ skip: noZsh }`:
    - The block is the text from the first `\nif [[ -n "$tools" ]]; then\n` after `mv "$MODEL.part" "$MODEL"` to its own `\nfi\n`.
    - Use a `launchctl` stand-in first on the PATH. The script is `set -euo pipefail`, `LABEL`, `HERE` (this checkout's tool), `node=process.execPath`, `tools=/x`, `BUSY=75`, `functionOf("say")`, `functionOf("idle_why")`, the block, then `print -r -- "went on"`. `HOME` and `BRIMM_VIDEO_HOME` are a temp folder.
    - With the stand-in printing `\tpid = 4321\n`: the status is 75, and the stdout is `"\nThe import is at work: its background job, com.thebrimm.unedited, is running (process 4321). Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed or downloaded first stays. Run this again once that is done.\n"`.
    - With the stand-in ending 113 and printing nothing: the status is 0, and the stdout is `"went on\n"`.
    - With `node=/nowhere/node`: the status is 75, and the stdout starts `"\nWhether anything is at work on this Mac could not be told. Stopped before"`.
  - `"says in its help, and in the README, how BRIMM Video Studio sets a Mac up"`:
    - the help, folded, holds the new sentence;
    - `README.md` holds `**Installed from the app.**`, and that paragraph holds `` `--tools` ``, `` `--app` ``, `` `--agent` ``, `75`, `` `tool/busy.js` `` and `` `tool/whisper-model.pin.json` ``.
- [ ] **Step 2: Run `cd tool && node --test tests/install.test.js`.** Expected: FAIL in the new tests. The changed stand-in leaves every old test passing.
- [ ] **Step 3: Write the code and the README paragraph** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/install.test.js tests/busy.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/install.sh tool/tests/install.test.js README.md`, then `git commit -m "Studio app phase 4: in installed mode a real run stops with 75, before it touches the Mac, while anything is at work"`.

---

### Final check

- [ ] Run `cd tool && node --test`. Every test passes, with `contract.test.js`'s hashes unchanged.
- [ ] Run `git diff ec15a41 --stat -- tool/shared tool/lib.js tool/run.js tool/guide.js tool/guide-note.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures`. Expected: nothing.
- [ ] Run `grep -n 'brew' tool/install.sh`. Every line that looks for brew or runs it is in a dev-mode branch.
- [ ] Run `grep -n 'resolve/main\|stat -f %z' tool/install.sh`. Expected: nothing.
- [ ] Run `grep -n 'launchctl' tool/busy.js`. Expected: only `/bin/launchctl`, in `launchdPid`.

## Decided

Jason, 2026-11-09:
1. The model pin, revision `5359861c739e955e79d9a303bcbc70fb988958b1` and SHA-256 `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69`: yes. Hugging Face and the Mac Studio's own copy agree on them.
2. A model already on a Mac is checked against the pin too (about 3 seconds each run): yes (Task 1).
3. A dev-mode run (the Mac Studio, with no `--tools`) does not stop while an import is at work: no. Dev mode stays as it is, and the installer runs there only on Jason's yes, once he has checked nothing is at work.

Claude's rulings, 2026-11-09:
4. The Mac Studio's `"mode": "dev"` mark in its settings is Phase 5's: the setup engine writes and checks it. Phase 4 neither writes nor reads it.
5. `busy.js` is made here for `idleWhy`, and Phase 7 adds the `updating.json` marker to it. The build plan's Phase 7 row is corrected when Phase 7 is planned.
6. The S4 shape (the plist names only the app and `--agent`, and the app runs its own node on its own `unedited.js`) is the assumption, kept in `agent_program`. Spike S4 confirms it or changes that one function.
7. Exit code 75 (`EX_TEMPFAIL`) means "busy, try again later" for a real run of install.sh in installed mode.
8. The bundle id is read from the app's own Info.plist, so install.sh fixes none. `com.thebrimm.video-studio` stays Phase 6's to settle.
9. Claude Code's summary lines keep their Terminal words in installed mode until S5 says how sign-in works without Terminal.
