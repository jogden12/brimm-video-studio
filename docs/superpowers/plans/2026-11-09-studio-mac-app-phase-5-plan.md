# Phase 5: the setup engine (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every decision of the app's setup assistant lives in a Node engine, `tool/setup/`, which the Swift shell of Phase 6 only draws. The engine works out which kind of Mac this is, asks what it must, shows what will change (from `install.sh --print`), stages the downloads behind progress bars, runs `install.sh --yes` with the answers, and says how it went, all as JSON lines. A repair or an update is the same run with the answers the settings already hold. A Mac marked `"mode": "dev"` is never taken over.

**Architecture:** The app starts `node <Studio>/tool/setup/engine.js --run <why> --app "<app>" --tools "<bin>" --protocol 1`. The engine writes one JSON object per line on stdout (step, progress, question, summary, done, error) and reads one per line on stdin (an answer, back, cancel). The shell says why it starts the engine (`setup`, `repair`, `update` or `status`). The engine works out the kind of Mac (fresh, takeover, installed, dev) from the settings. Beside `engine.js` sit small modules: `protocol.js` (the events and their checks), `checks.js` (what this Mac has), `questions.js` (pure: each question, and the reading of each answer), `install.js` (staging, Claude Code, the installer), `summary.js`, and `guide.js` with `guide-template.html`. The engine never parses install.sh's English: Review's lines come from the node functions install.sh itself uses, its exit code decides, and its full text is only shown. `engine.js` exports `runSetup(options)`, so the tests run it in-process with a table of stand-in programs. Production names every system program by its absolute path, and has no environment seam.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages. zsh for `install.sh`, which this phase does not change. `plutil` and `/bin/zsh` on macOS for the tests that run the real installer with `--print`.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, part 2 (the setup assistant and the Getting Started guide) and part 3 (engine and shell), with part 1's "Only the Mac Studio stays a git checkout" for the dev mark. The build plan's row: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`, Phase 5. The spikes: `spikes/2026-11-09-studio-mac-app/README.md`. What Phase 4 left to this phase: `docs/superpowers/plans/2026-11-09-studio-mac-app-phase-4-plan.md`, "Decided" 4, 7, 8 and 9.

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end.
- Node 22 or later, and no packages.
- **The installer is only ever run with `--print`**, by a test or by hand. The engine's tests reach `install.sh --yes` only as a stand-in that writes what it was given into a `ran` file. The one test that runs the real installer goes through a guard that refuses any call without `--print` (Task 5's `printOnly`).
- No test downloads anything, installs anything, loads a launch agent, or asks the real launchd. Every `launchctl`, `scutil`, `curl`, `codesign` and `script` a test reaches is a stand-in. No test calls the real `claude`, HyperFrames, HeyGen, `npm` or `curl`.
- No test writes outside the folder made for it. A test's home is a new folder, never this Mac's home, and never a drop folder.
- **This phase does not change `install.sh`.** Its exit codes stay: 0 done or a print, 1 a real run failed, 2 it refused ("Nothing was changed."), 75 something is at work.
- The engine's own exit codes: 0 after a `done` event, 1 after an `error` event, 2 for a bad invocation (with an `error` event all the same).
- **No line and no event names an episode's folder.** Its name can carry a client's name. The engine reads `Episodes` only for the Macs' names in brackets.
- **Claude Code's email address and organisation are never shown**, in an event, a summary, the guide or stderr. Only signed in or not, and the plan.
- **A pasted sign-in code is never kept**: not in an event, not in a file, not in stderr, not in a thrown error's message.
- The labels stay `com.thebrimm.unedited` and `com.thebrimm.claude-check`. The log stays `~/Library/Logs/brimm-video.log`.
- **The BRIMM Ops contract.** Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes. `tool/setup/guide.js` is a different file from `tool/guide.js`, and imports nothing from it.
- Never read a `.env` file. Never run a script fetched from the network: a download is data until its SHA-256 is the pin's.
- Comments and messages are plain, full-sentence English, as in the rest of `tool/`. Words a person reads say "BRIMM Video Studio", never "node" and never "Terminal".
- Tests that need a Mac skip themselves elsewhere and say why (`{ skip: notAMac }`, or `{ skip: noZsh }` for zsh alone), as `tests/install.test.js` does.
- The line numbers are as of 6636327, main after PR #58 (the review fixes). Find each one by the grep given.

## The protocol between the shell and the engine (version 1)

**The command.** `node <Studio>/tool/setup/engine.js --run setup|repair|update|status --app "<BRIMM Video Studio.app>" --tools "<bin>" --protocol 1`. Each option once. `--app` and `--tools` are absolute paths, and `--tools` holds no `:` (it goes into a PATH). Studio's checkout is the folder above the engine's own `tool/`.

**The lines.** stdout: one JSON object per line, each with `"event"`. stdin: one JSON object per line. stderr is for a developer, and is never parsed or shown. A string in an event holds no line break unless its field is `details`, `summary` or `body`.

**What the shell may send.**

- `{"answer":"<question id>","value":<value>}`: the answer to the open question. A value the engine refuses brings the same question again with `fault` set. An answer to a question the engine has since replaced is dropped (the shell's timer can be a moment late). An answer to an id never asked, a value of the wrong shape, or a line that is no JSON object ends the run with `error`, code `protocol`.
- `{"back":true}`: to the step before that asked something. Allowed until Install starts. What was answered is kept as the suggestion.
- `{"cancel":true}`: stop. stdin closing counts as a cancel.

**The six events.**

- `step`: `{ "event":"step", "id", "n", "of", "title", "body":[lines] }`. `id` is one of `welcome`, `name`, `apps`, `dropbox`, `folders`, `permissions`, `review`, `install`, `done`. `n` and `of` count only the steps this run shows.
- `question`: `{ "event":"question", "id", "kind", "prompt", "warning"?, "fault"?, … }`. The engine sends the same `id` again whenever the view should change. The kinds:
  - `confirm`: `ok` (the button's label). The value is `true`.
  - `text`: `suggested`. The value is a string.
  - `choice`: `options: [{ value, label, detail? }]`. The value is one option's `value`.
  - `folder`: `suggested`, `words` (Finder's words for it), `purpose` (`"drop"` or `"exports"`). The value is an absolute path.
  - `apps`: `apps: [{ id, name, here, link?, note?, action? }]`, with `id` one of `claude-app`, `claude-code`, `dropbox`, `hyperframes`. The value is `"check"` (look again: the shell sends it on a timer), `"install-claude-code"`, `"sign-in"` or `"continue"`.
  - `sign-in`: `link?`, `paste: true`. The value is `{ "code": "<pasted>" }` or `{}`.
- `progress`: `{ "event":"progress", "part", "label", "done", "total", "state", "detail"? }`. `part` is one of `programs`, `model`, `hyperframes`, `chrome`, `installer`, `claude`. `total` is `null` for a bar with no known end. `state` is `waiting`, `running`, `done`, `skipped` or `failed`.
- `summary`: `{ "event":"summary", "id", "ok", "lines":[{ label, value }], "details"?, "exit"?, "needs"? }`. `id` is `review`, `setup` or `status`. For `review`, `ok` is whether `install.sh --print` ended with 0, `exit` is its code, and `details` is its full text: Install is offered only when `ok`. For `status`, `needs` is `"nothing"`, `"setup"` or `"repair"`.
- `done`: `{ "event":"done", "outcome", "summary", "studio", "guide": { html, pdf } | null, "notes":[lines] }`. `outcome` is `installed`, `repaired`, `updated`, `status` or `cancelled`. `summary` is the text for "Copy setup summary". `studio` is `~/BRIMM Video Studio`, as a path.
- `error`: `{ "event":"error", "code", "message", "advice"?, "contact"?, "details"? }`. It is always the last line. `code` is one of `arguments`, `protocol`, `damaged`, `dev`, `no-settings`, `settings`, `busy`, `install`, `download`, `engine`.

**Which run, on which Mac.**

| The Mac | `--run setup` | `--run repair` or `update` | `--run status` |
| --- | --- | --- | --- |
| fresh (no settings file) | all nine steps | `error`, `no-settings` | `summary` with `needs: "setup"`, then `done` |
| takeover (settings whose checkout is a git clone, or gone) | welcome, apps, permissions, review, install, done | install, done | `summary` with `needs: "setup"`, then `done` |
| installed (settings whose checkout is an app's copy) | welcome, apps, permissions, review, install, done | install, done | `summary`, `needs: "repair"` when the copy is not this one, then `done` |
| dev (`"mode": "dev"`) | `error`, `dev` | `error`, `dev` | `error`, `dev` |
| settings that cannot be read | `error`, `settings` | `error`, `settings` | `error`, `settings` |

A repair or an update asks nothing and takes this Mac's name, BRIMM Video folder, drop folder and exports folder from its settings. An update differs from a repair only in its outcome (`updated`) and one note, "Start a new chat in Claude so it reads this version." Phase 7 owns `updating.json` and the wait before an update.

**Cancel.** Before Install: `done` with outcome `cancelled`, and a note of what the Apps step already installed, which stays. During staging: the download is stopped, its `.part` file is taken away, then `done`, `cancelled`. Once `install.sh --yes` runs it is never interrupted: the cancel is answered after it ends, with the run's own outcome.

## What this phase assumes of the spikes

S1 to S4 and S7 have passed. S5 (Claude Code's sign-in without Terminal) and S6 (the HyperFrames app in a standard account) are paused at a sign-in. Nothing here waits for them: each assumption has one named place to change.

- **S3 (the app's node and npm).**
  - Assumed: the tools are in `Contents/Resources/node/bin`, the app's npm installs the pinned HyperFrames CLI, and the CLI's `browser ensure` fetches its Chrome with no Homebrew on the Mac.
  - The one place: the engine takes the folder from `--tools` and never works it out.
- **S4 (the launch agent through the app).**
  - Assumed: macOS's Files and Folders prompt names "BRIMM Video Studio" for a folder the app's node lists, whether the app started that node for setup or launchd started it for the agent.
  - The one place: `lookerOf` in `access.js`, merged with PR #58. If a prompt names something else, only that word changes.
- **S5 (sign-in, paused).**
  - Assumed: `claude auth login`, given a terminal, opens the browser, prints a link, and takes a pasted code when the browser cannot hand the sign-in back. S5 proved that from Swift's `forkpty`. It did not prove it from `/usr/bin/script` under the app's node, and it did not prove that the stored sign-in then works from the background job.
  - The one place: `signIn`'s `pty` option in `tool/setup/install.js` (Task 9).
  - The fallback: the Swift shell runs the terminal itself, as S5's spike does, and answers the same `sign-in` question. The engine then only asks `claude auth status --json`. Install's last part, the check that Claude answers from the background job, is the proof either way.
- **S6 (the HyperFrames app, paused).**
  - Assumed: its download page is `https://hyperframes.dev/studio/download`, a standard account puts it in `~/Applications`, and it asks for a HeyGen sign-in when it first opens.
  - The one place: the `APPS` table in `tool/setup/checks.js` (Task 6).
- **Claude Code's own install (no spike).**
  - Assumed: a version's macOS build can be downloaded from a fixed address, has a published SHA-256, and installs itself into `~/.local/bin` with its own `install` step. None of the three was checked in this session.
  - The one place: `tool/claude-code.pin.json`, which this phase does **not** add. Until Jason's answer adds a whole pin (Open for Jason, 1), the Apps step shows Claude Code with no install button, and a Mac without Claude Code stops there with the support contact.

## Where the spec and the code disagree

Each is settled here for this phase. The spec is corrected with the phase's pull request, not in a task.

1. **Claude Code "with a pinned SHA-256".** `install.sh` says "It does not install Claude Code", nothing in `tool/` installs it or signs in to it, and Anthropic's own installer fetches "native build latest" (2.1.321 in S5), unpinned. `install.sh` only requires `GUARD_CLAUDE="2.1.295"` or later. This plan builds the pinned install and leaves the pin file to Jason's answer.
2. **Stale line numbers.** `find_claude` is at `install.sh:346` (the spec says 281). The BRIMM Video search is `search_brimm_video` at `move.zsh:422`.
3. **The HyperFrames CLI "and its Chrome", each pinned by SHA-256.** The CLI has npm's own integrity pin (`hyperframes.pin.json`). Chrome is fetched by the pinned CLI's `browser ensure`, with no pin of Studio's. This plan keeps that (Open for Jason, 2).
4. **"The HyperFrames CLI and Chrome" as a staged bar.** `install.sh` runs `browser ensure` (1149) and `doctor` (1157) itself in every real run. Only the npm install (1111) and the model (1167) are skipped when already there. The engine runs `browser ensure` first for the bar, and the installer's own then returns at once.
5. **"Copying the programs".** Nothing is copied: the programs are in the bundle. The first bar is the check that this copy is whole.
6. **The check that Claude answers** has its own bar, but `install.sh`'s exit code does not carry it. The engine reads the check's log.
7. **Review: "Its exit code decides".** `install.sh --print` ends with 0 when Claude Code is missing, signed out or too old (it only says so). The engine therefore holds the Apps step until Claude Code is there, new enough and signed in.
8. **Terminal words.** `install.sh`'s summary says "In Terminal, run: claude auth login" and "In Terminal: claude update" (957, 966). Review's own lines are the engine's, without Terminal. install.sh's lines stay under Details. `access.js` has named "BRIMM Video Studio" on an installed Mac since PR #58 (`lookerOf`).
9. **The dev mark.** `settingsFault` (settings.js:155) knows no `mode`, and `SETTABLE` (872) has no `--mode`. Task 1 adds both.
10. **Two launchctl parsers.** `edit.js` has its own two (1708, 1714) beside `busy.js`'s, and they differ. Task 2 leaves one.
11. **The name's clash and its suggestion** are spoken of as if they existed. `move.zsh` has neither. Both are new code in Task 6.
12. **Where Claude Code is looked for.** In installed mode `find_claude` looks only in `<tools>`, `/usr/bin`, `/bin` and `~/.local/bin`. A takeover Mac whose Claude Code is only in Homebrew's folder is told Claude Code is not here.
13. **`load-each.test.js` and `unused-exports.mjs`** read only `tool/*.js`. Task 4 extends both to `tool/setup/`.
14. **`protocol.js`** is one file more than the build plan's row lists. The events need one home that both the engine and its tests read.

## Review Focus

1. **A test must never install anything.** Covered in Task 5: "printOnly refuses a call without --print, and runs nothing". Covered in Task 10: "the installer is started with exactly the arguments, and with an environment built from scratch".
2. **The Mac Studio is never taken over.** Covered in Task 1: "a plan from an app's copy refuses a Mac marked dev, and nothing changes". Covered in Task 13: "a dev Mac: every run ends with error dev, and nothing ran".
3. **A takeover keeps its settings and its drop folder.** Covered in Task 10: "a takeover's arguments name no drop folder and no exports folder". Covered in Task 13: "a takeover: nothing is asked of the name or the folders, and the settings' own go to the installer".
4. **The pasted code and the account never leak.** Covered in Task 9: "the pasted code reaches claude and nothing else". Covered in Task 6: "Claude Code's state never carries the email or the organisation".
5. **No episode's folder is named.** Covered in Task 6: "the names in use come from the brackets, and no episode's folder is given back". Covered in Task 13: "no event of a whole run holds an episode folder's name".
6. **A download is kept only when its SHA-256 is the pin's.** Covered in Task 8: "a model whose SHA-256 is not the pin's is taken away". Covered in Task 9: "a Claude Code download whose SHA-256 is not the pin's is never run".
7. **Only allowed sign-in links are passed on.** Covered in Task 9: "a link is passed on only when it is https and its host is claude.ai, claude.com or anthropic.com".
8. **Exit 75 is waited for a bounded time.** Covered in Task 10: "something at work: the line is shown, and after five tries the run ends with error busy".
9. **Review never reads install.sh's English.** Covered in Task 11: "the review's lines are the same whatever the installer's text says".
10. **The installer is never interrupted.** Covered in Task 13: "a cancel while the installer runs is answered after it ends".
11. **A Mac on a git checkout reads every line as before.** The access lines' dev wording is pinned by PR #58's own tests. Covered in Task 1: "a plan and a write from a git checkout keep the mark" and "a Mac that is not marked is planned from an app's copy as before".
12. **A faulty event is never written.** Covered in Task 4: "the emitter throws on a faulty event before it writes".

## Files

| File | What changes |
| --- | --- |
| `tool/settings.js` | An optional `mode` (`"dev"` or `"off"`), `set --mode`, `devMarked`, `DEV_REFUSAL`, and the refusal of a plan or a write from an app's copy on a marked Mac. |
| `tool/edit.js` | `agentRunning` and `agentPid` use `busy.js`'s `launchdPid`. |
| `tool/setup/protocol.js` (new) | The events, steps, parts and codes, the emitter, the reader, the reading of an answer and of the arguments. |
| `tool/setup/checks.js` (new) | Is this copy whole, which kind of Mac, the name and its clash, the BRIMM Video search, the apps, Claude Code's state. |
| `tool/setup/questions.js` (new) | Each question, and `read`, which turns an answer into a value or a fault. Pure. |
| `tool/setup/install.js` (new) | Staging (model, CLI, Chrome), Claude Code's install and sign-in, the installer's arguments and run, the busy wait, the check log. |
| `tool/setup/summary.js` (new) | The review, setup and status summaries. |
| `tool/setup/guide.js`, `tool/setup/guide-template.html` (new) | The Getting Started guide's data and its HTML. |
| `tool/setup/engine.js` (new) | `runSetup(options)` and `main()`. |
| `tool/tests/setup-harness.js`, `tool/tests/app-copy.js` (new, not tests) | The engine's stand-ins, and `appCopy` moved out of `install.test.js` unchanged. |
| `tool/tests/load-each.test.js`, `tool/tests/unused-exports.mjs` | Both also read `tool/setup/*.js`. |
| Tests | New: `setup-protocol.test.js`, `setup-checks.test.js`, `setup-questions.test.js`, `setup-install.test.js`, `setup-summary.test.js`, `setup-guide.test.js`, `setup-engine.test.js`. Changed: `settings.test.js`, `install.test.js`, `busy.test.js`. |

---

### Task 1: The dev mark in `settings.js`

**Files:**
- Modify: `tool/settings.js` (`grep -n '^const HELP\|^export function settingsFault\|^function planned\|^export const SETTABLE' tool/settings.js`: 320, 155, 709, 872)
- Test: `tool/tests/settings.test.js` (a new `describe("a Mac marked as Jason's development Mac", …)`), `tool/tests/install.test.js` (beside the `--app` tests, from 2737)

**Interfaces:**
- Consumes:
  - `buildOf`, `isInstalled` (build.js), which `settings.js` has imported since PR #58;
  - `heldIn`, `fieldsToldBy`, `writeSettings` (settings.js itself).
- Produces:
  - the settings' optional `mode`: `"dev"` or `"off"`, and nothing else. It is not a build's mode (`buildOf` gives `dev` for a git checkout and `installed` for an app's copy): this one is about the Mac, and only a person sets it.
  - `SETTABLE["--mode"]`, so `node settings.js set --mode dev` marks this Mac and `set --mode off` takes the mark away.
  - `devMarked(settings) -> boolean`. True only when `settings?.mode === "dev"`.
  - `DEV_REFUSAL`, the one line a refused plan or write says.

**The lines:**
- `settingsFault`, just before its last `return "";`: `if (s.mode !== undefined && s.mode !== "dev" && s.mode !== "off") return 'the mode must be "dev" or "off"';`
- `SETTABLE["--mode"]`, after `--app-handover`: `{ field: "mode", takes: "dev or off", read: (v) => (v === "dev" || v === "off" ? v : undefined), said: String, otherwise: "off", subject: "This Mac's mode", be: "is", was: "it was" }`.
- `HELP`: the option lines of `write`, `plan` and `set` each gain ` [--mode dev|off]` after `[--app-handover on|off]`, and `set`'s own text gains the sentence `--mode dev marks this Mac as Jason's development Mac, which the app never takes over; --mode off takes the mark away.` The help's own test (`settings.test.js`, "names each option set takes, and each that write and plan take, and no option that none of them takes") reads `SETTABLE`, so it fails until the three lines name the option.
- `DEV_REFUSAL`: `Not written: this Mac is marked as Jason's development Mac ("mode": "dev" in its settings), and the app does not take it over. Its settings are as they were.`

**The rules:**
- In `planned`, right after `held` is read and before `const { dropFolder: picked, switchBack } = told;`: `if (devMarked(held) && isInstalled(buildOf(told.fields.checkout))) return { code: 1, said: [DEV_REFUSAL] };`. `plan` and `write` both go through `planned`, so both refuse, and neither writes.
- Since PR #58, `planned(home, rest, now, plutil = spawnSync, build)` takes a fifth parameter: `build` is the running copy's own build, for the words of its mends. The refusal does not use it. It asks the build of the checkout it is told (`buildOf(told.fields.checkout)`), so a plan for an app's copy is refused on a marked Mac whichever copy of `settings.js` runs it.
- A broken app's copy is still an installed one (`buildOf` gives `broken: true` with `mode: "installed"`), so it refuses a marked Mac too.
- A plan or a write from a git checkout is as it was, and keeps the mark: `mode` is a setting it is not told, so it is kept.
- `set` is not gated. Only a person runs it, by hand, and it is how the mark is put on and taken off.
- The mark is never put on by any program: not by `install.sh`, not by the engine, and not by `write`, unless a person gives `--mode` by hand.
- `install.sh` is not changed. Its gate (`settings_plan`, 318) already ends with 2, the plan's own words and "Nothing was changed." when the plan refuses.
- `settings.js` does not import `busy.js`: `busy.js` imports `settings.js`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/settings.test.js`, with its `setup()` helper. An app's copy is a temp folder `…/BRIMM Video Studio.app/Contents/Resources/Studio` that holds a `build.json` with the seven fields of `install.test.js`'s `WHOLE`; a broken one holds a `build.json` whose text is `{`. The mark is written with `writeSettings(t.home, { ...t.given, mode: "dev" })`.
  - "a Mac's mode is dev or off, and anything else is a fault": `settingsFault` of the given settings with `mode: "dev"` and with `mode: "off"` is `""`; with `mode: "on"`, `mode: true` and `mode: ""` it is `the mode must be "dev" or "off"`.
  - "set --mode dev marks this Mac, and set --mode off takes the mark away": after a `write`, `t.asked("set", "--mode", "dev")` ends with 0 and `readSettings(t.home).settings.mode` is `"dev"`; `set --mode off` ends with 0 and the mode is `"off"`; `set --mode maybe` ends with 1 and says `Not changed: --mode takes dev or off.`
  - "devMarked is true only for the mark": true for `{ mode: "dev" }`; false for `{ mode: "off" }`, `{}`, `null` and `undefined`.
  - "a plan from an app's copy refuses a Mac marked dev, and nothing changes": `t.asked("plan", "--machine", "Mac Studio", "--root", ROOT, "--checkout", <the app's copy>)` ends with 1, `t.said` is `[DEV_REFUSAL]`, and the settings file's bytes are the same before and after.
  - "a write from an app's copy refuses a Mac marked dev, and nothing changes": the same with `write`.
  - "a plan and a write from a git checkout keep the mark": with `--checkout CHECKOUT` both end with 0, and after the write the mode is still `"dev"`.
  - "a Mac that is not marked is planned from an app's copy as before": with no `mode`, and with `mode: "off"`, the plan ends with 0 and names the app's copy as the checkout.
  - "a broken app's copy refuses a marked Mac too": the plan from the broken copy ends with 1 and says `DEV_REFUSAL`.
  - In `tool/tests/install.test.js`, with the neighbouring tests' skip and their `appCopy()`: "the app's copy refuses a Mac marked "mode": "dev": exit 2, and nothing changes". The home's settings are written with `mode: "dev"` and a checkout that is not the copy; `install.sh --print --machine "Mac Studio" --tools <tools> --app <app> <root>` ends with 2, its output holds `DEV_REFUSAL` and "Nothing was changed.", and `changedNothing` holds.
- [ ] **Step 2: Run `cd tool && node --test tests/settings.test.js tests/install.test.js`.** Expected: FAIL in the new tests, since `devMarked` and `DEV_REFUSAL` are not exported and `--mode` is no option.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/settings.test.js tests/install.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/settings.js tool/tests/settings.test.js tool/tests/install.test.js`, then `git commit -m "Studio app phase 5: a Mac marked as Jason's development Mac (mode dev) is never planned or written from an app's copy"`. Add the Co-Authored-By line from the session's attribution to every commit in this plan.

---

### Task 2: One launchctl-print parser

**Files:**
- Modify: `tool/edit.js` (`grep -n 'const AGENT\|^function agentRunning\|^function agentPid' tool/edit.js`: 1704, 1707, 1713)
- Test: `tool/tests/busy.test.js`

**Interfaces:**
- Consumes:
  - `AGENT_LABEL`, `launchdPid` (busy.js).
- Produces:
  - nothing new. `edit.js`'s `agentRunning()` and `agentPid()` keep their names and what they give back, and the wiring at 431 to 435 is not changed.

**The rules:**
- `edit.js` imports `AGENT_LABEL` and `launchdPid` from `./busy.js`. `const AGENT = AGENT_LABEL;`. `agentPid()` returns `launchdPid()`. `agentRunning()` returns `launchdPid() !== null`. Neither calls `spawnSync` on `launchctl` itself, and neither holds a regular expression for `pid = `.
- What changes, on purpose: `busy.js`'s `pidFromPrint` takes only a whole line `pid = N` with N above 0. `edit.js`'s old expressions also took `pid = 0` and a line with more text after the number. A job launchd shows with `pid = 0` is not running, so the new answer is the right one.
- `busy.js` does not import `edit.js`, so there is no cycle. `load-each.test.js` shows it.

- [ ] **Step 1: Write the failing tests** in `tool/tests/busy.test.js`.
  - "edit.js reads the launch agent's pid with busy.js's parser, and has none of its own": the text of `tool/edit.js` imports `launchdPid` from `./busy.js`, holds no `pid = ` inside a regular expression (`/pid = \\d/` and `/pid = \(\\d/` are not in it), and names `"com.thebrimm.unedited"` nowhere as a string of its own.
  - "a launch agent whose print says pid = 0 is not running": `launchdPid({ run: () => ({ status: 0, stdout: "\tstate = waiting\n\tpid = 0\n" }), uid: 501 })` is `null`, and with `pid = 412` it is `412`.
- [ ] **Step 2: Run `cd tool && node --test tests/busy.test.js`.** Expected: FAIL in the first new test, since `edit.js` still has its own two expressions.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/busy.test.js tests/load-each.test.js && node --test`.** Expected: PASS, the whole suite too, since `edit.js`'s tests give `agentRunning` or `agentPid` themselves.
- [ ] **Step 5: Commit.** `git add tool/edit.js tool/tests/busy.test.js`, then `git commit -m "Studio app phase 5: edit.js reads the launch agent's pid with busy.js's one parser"`.

---

### Task 3: Dropped, since PR #58 did it

PR #58 (the review fixes, merged into main on 10 November 2026 as 6636327) made every access line name the program as macOS lists it. `lookerOf(build)` in `access.js` gives `"node"` on a git checkout and `"BRIMM Video Studio"` on an installed Mac. `edit.js`, `filing.js`, `unedited.js` and `access.js`'s own `main` pass it to each line as `name`, and its tests pin a git checkout's lines as they were. It also took the unused `installed` option off `findingOf` and `postNewNodeIfDue`.

Nothing is left for this task. Its number is kept so that the other tasks keep theirs. The lines that still name Jason, `install.sh` or node on an installed Mac (`access.js`'s `locked` line among them) are the sweep's, in its own session and pull request, not this phase's.

---

### Task 4: `tool/setup/protocol.js`: events, answers, arguments

**Files:**
- Create: `tool/setup/protocol.js`
- Modify: `tool/tests/load-each.test.js`, `tool/tests/unused-exports.mjs`
- Test: `tool/tests/setup-protocol.test.js`

**Interfaces:**
- Consumes:
  - nothing of the tool: `node:path` (`isAbsolute`) and `node:readline` only.
- Produces:
  - `PROTOCOL = 1`; `EVENTS = ["step", "question", "progress", "summary", "done", "error"]`; `STEPS = ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"]`; `PARTS = ["programs", "model", "hyperframes", "chrome", "installer", "claude"]`; `CODES = ["arguments", "protocol", "damaged", "dev", "no-settings", "settings", "busy", "install", "download", "engine"]`; `RUNS = ["setup", "repair", "update", "status"]`.
  - `eventFault(event) -> "" | why`. The why names fields, never values.
  - `emitter(output) -> (event) => void`. It throws on a faulty event before it writes, and otherwise writes `JSON.stringify(event) + "\n"`.
  - `readerOf(input) -> { next(): Promise<object | null> }`. One object per line, kept in a queue, so `next()` may be waiting while other work goes on; `null` when the input ends. A line that is not a JSON object gives `{ fault }`, whose words never repeat the line: it may hold a pasted code.
  - `lineFault(line) -> "" | why`. A line holds exactly one of `answer`, `back: true` and `cancel: true`.
  - `answerFault(question, line) -> "" | why`. The shape only, by the open question's kind.
  - `argsOf(argv) -> { run, app, tools, protocol } | { fault, code }`. `code` is `"arguments"`, or `"protocol"` for a number that is not 1.

**The rules:**
- `eventFault`: the event is an object whose `event` is one of `EVENTS`. A step's `id` is one of `STEPS`, its `n` and `of` are whole numbers with 1 <= n <= of, its `title` a string and its `body` a list of strings. A question has an `id`, a `prompt` and one of the six kinds with that kind's fields, as the protocol's section gives them. A progress event's `part` is one of `PARTS`, its `state` one of `waiting`, `running`, `done`, `skipped`, `failed`, its `done` a whole number of 0 or more, and its `total` null or a whole number not below `done`. A summary's `id` is `review`, `setup` or `status`, its `ok` true or false, its `lines` a list of `{ label, value }` strings, and `needs` is there only for `status` and is `nothing`, `setup` or `repair`. A done event's `outcome` is one of the five, its `guide` null or `{ html, pdf }`, its `notes` a list of strings. An error's `code` is one of `CODES` and its `message` is not empty. No string holds a line break unless its field is `details`, `summary` or `body`.
- `answerFault`: `confirm` takes `true`; `text` a string with no line break; `choice` one of the options' values; `folder` an absolute path; `apps` one of `check`, `install-claude-code`, `sign-in`, `continue`, and the middle two only when an app in the question carries that `action`; `sign-in` takes `{}` or `{ code }` with a one-line string that is not empty. Whether a value is good is `questions.js`'s to say (Task 7): this is only whether it can be read.
- `argsOf`: `--run` is one of `RUNS`; `--app` and `--tools` are absolute paths; `--tools` holds no `:`; `--protocol` is `1`. Each is given once and none is left out. Anything else is a fault that names the option, never its value.
- `load-each.test.js` gains "loads every tool/setup/*.js alone", importing `./setup/<name>` the same way. `unused-exports.mjs` reads `tool/setup/*.js` too, as modules and as importers (`"../"` for what they import of `tool/*.js`, `"./"` among themselves). It still does not count tests, so an export of `tool/setup/` that only the shell's contract or a test uses is listed: the Final check says which may be.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-protocol.test.js`.
  - "the events are the spec's six, and the steps are its nine in order": `EVENTS`, `STEPS`, `PARTS`, `CODES` and `RUNS` equal the lists above.
  - "an event with a name of no kind, or a step with an id of no step, is a fault": `{ event: "note" }`, a step with `id: "finish"`, a step with `n: 3, of: 2`; and a whole event of each of the six kinds has no fault.
  - "a progress event's part is one of the six, and its done never passes its total": `part: "node"` is a fault; `done: 5, total: 4` is a fault; `done: 5, total: null` is none.
  - "a string with a line break is a fault outside details, summary and body": a `title` with `\n` is a fault; `details` with `\n` is none.
  - "the emitter writes one JSON object on one line": two events give two lines, each of which `JSON.parse` reads back to the event.
  - "the emitter throws on a faulty event before it writes": a faulty event throws, and nothing was written.
  - "the reader gives one object per line, null at the end, and names a line that is not a JSON object": lines `{"answer":"name","value":"A"}`, `hello 123456`, `[1]`; the fault's words hold neither `hello` nor `123456`.
  - "an answer is read against the open question: its id, and a value of the question's kind": one good value and one bad one for each of the six kinds, and `install-claude-code` refused when no app carries that action.
  - "the arguments: --run, --app, --tools and --protocol 1, each once, absolute paths, no ':' in --tools": the good four; each left out; `--run install`; a relative `--app`; `--tools /a:/b`; `--run` twice; `--protocol 2` with code `protocol`; an unknown option.
  - In `tool/tests/load-each.test.js`: "loads every tool/setup/*.js alone".
- [ ] **Step 2: Run `cd tool && node --test tests/setup-protocol.test.js tests/load-each.test.js`.** Expected: FAIL, since `tool/setup/protocol.js` is not there.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-protocol.test.js tests/load-each.test.js && node tests/unused-exports.mjs`.** Expected: PASS, and the last line of the listing is `Imports of files that are not there: 0`.
- [ ] **Step 5: Commit.** `git add tool/setup/protocol.js tool/tests/setup-protocol.test.js tool/tests/load-each.test.js tool/tests/unused-exports.mjs`, then `git commit -m "Studio app phase 5: the setup protocol's events, answers and arguments, checked in one place"`.

---

### Task 5: The harness, the shared `app-copy.js`, and `checks.js`: is this copy whole, and which kind of Mac

**Files:**
- Create: `tool/tests/app-copy.js`, `tool/tests/setup-harness.js` (neither is a test: `node --test` runs only `*.test.js`), `tool/setup/checks.js`
- Modify: `tool/tests/install.test.js` (`grep -n '^const WHOLE\|^const TOOLS_PROGRAMS\|^const DAMAGED\|^const HDR_LISTS\|^function appCopy\|^const xml\|^function xml' tool/tests/install.test.js`: from 1934, and `xml` at 186)
- Test: `tool/tests/setup-checks.test.js`

**Interfaces:**
- Consumes:
  - `buildOf`, `isInstalled` (build.js); `settingsFile`, `readSettings`, `sameFolder`, `devMarked`, `writeSettings` (settings.js); `HELPERS` (helpers.js); `hasHwaccel`, `hasFilters` (workcopy.js).
- Produces, in `tool/tests/app-copy.js`:
  - `appCopy`, `WHOLE`, `HDR_LISTS`, `TOOLS_PROGRAMS`, `DAMAGED` and `xml`, moved out of `install.test.js` with not a character changed, and whatever `appCopy` reads (`HERE`, `HELPERS`). `install.test.js` imports them back. The other `appCopy`, the `const appCopy = (version) => …` inside the describe at 1978, is another thing and stays.
- Produces, in `tool/tests/setup-harness.js`:
  - `notAMac`, as `install.test.js` has it.
  - `mac({ settings = "none", apps = [], dropbox = true, claude = "signed-in" } = {}) -> { dir, home, root, app, tools, checkout, programs, ran(), done() }`. A whole made-up Mac in one temp folder: an app's copy from `appCopy()`, a home, and a BRIMM Video folder at `<home>/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video` when `dropbox` is true, holding `Drop`, `Unedited Video` and `Episodes/2026-11-01 Client Jane (Old Mac)`. `apps` is a list of `claude-app`, `dropbox` and `hyperframes`: each is made as that app's folder (`Claude.app`, `Dropbox.app`, `HyperFrames.app`) in `<home>/Applications`.
  - `settings`: `"none"`; `"takeover"` (usable settings whose checkout is a folder in `dir` that holds `.git`, machine `Studio Test`, the root, and a `dropPath` and an `exportsPath` in the home); `"installed"` (the checkout is this app's copy); `"moved"` (the checkout is `<dir>/Old/BRIMM Video Studio.app/Contents/Resources/Studio`); `"dev"` (takeover's, with `mode: "dev"`); `"unusable"` (a file whose text is `{`). All but the last are written with `writeSettings`, never typed as JSON.
  - `claude`: `"none"`, `"signed-out"`, `"old"` (version 2.0.0) or `"signed-in"`. The stand-in is at `<home>/.local/bin/claude`. It answers `--version` from `dir/says/claude-version`, `auth status --json` from `dir/says/claude-status` (whose JSON holds `email: "jane@example.invalid"` and `orgName: "Example Org"` as well, so a leak shows), and `auth login` by printing `dir/says/claude-login`, reading one line and writing it to `dir/claude-got`.
  - `programs`: `{ launchctl, scutil, curl, codesign, script, installer }`, stand-ins in `dir/bin`; `installer` is a list (the program and its first arguments). Each writes `<name> <arguments>` into `dir/ran`, prints `dir/says/<name>` when it is there, and ends with the number in `dir/exits/<name>` when it is there. `curl` writes `dir/says/curl`'s bytes to the file after `--output`. `script` runs what follows `/dev/null`. The `installer` stand-in waits while `dir/hold` is there, and appends `dir/says/check-log`, when it is there, to `<home>/Library/Logs/brimm-video-claude-check.log`.
  - `drive(m, { run, answers, why, argv, look }) -> Promise<{ code, events, errors }>`. It runs `runSetup` in this process with `--run <run> --app <m.app> --tools <m.tools> --protocol 1`. `answers(event)` is called with every event, and the line it gives back, if any, is sent. It imports `../setup/engine.js` when first called, not at the top, so the harness loads before Task 13. It always gives a `why` (`() => ""` unless the test gives one) and a `wait` that does not wait, so no test asks the real launchd or sleeps. It gives an `applications` of `<dir>/Applications`, which holds nothing, so no test looks in this Mac's own Applications folder, and the test's `look` when it gives one.
  - `installCalls(ran) -> string[][]`, the installer's calls; `settingsOf(home)`, the settings file's text or null.
  - `printOnly(m) -> string[]`. An installer for `programs.installer` that reaches the real `install.sh`: a guard script in `dir/bin` that passes its arguments to the app copy's own `tool/install.sh` only when `--print` is among them and `--yes` is not. Otherwise it writes `refused <arguments>` into `dir/ran` and ends with 99. It puts the stand-ins first on `PATH` and sets `BRIMM_CLAUDE` to the claude stand-in, as `askWith` (`install.test.js`:80) does.
- Produces, in `tool/setup/checks.js`:
  - `PROGRAMS`: `["node", "npm", "ffmpeg", "ffprobe", "whisper-cli"]`, then `brimm-<helper>` for each of `HELPERS`.
  - `DAMAGED`: `This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair.`
  - `copyFault({ app, tools, checkout, programs, deep = true }) -> "" | why`.
  - `kindOf({ home, checkout }) -> { kind: "fresh" } | { kind: "unusable", why } | { kind: "dev", settings } | { kind: "installed", settings, moved } | { kind: "takeover", settings }`.

**The rules:**
- `copyFault`, in this order, stopping at the first fault: `buildOf(checkout)` is installed and not broken; each of `PROGRAMS` is a regular file in `tools` that may be run; `ffmpeg -nostdin -hide_banner -hwaccels` names `videotoolbox` (`hasHwaccel`) and `-filters` names `scale_vt` (`hasFilters`), asked as `install.sh` asks at 914 to 915; and, when `deep`, `codesign --verify --deep --strict <app>` ends with 0. The why names the thing (`build.json`, a program's name, `the signature`), never a path in the home.
- The person sees `DAMAGED` as the `error` event's message, with the why in `details` (Task 13).
- `kindOf`: no file at `settingsFile(home)` is `fresh`. `readSettings(home)` giving `{ why }` is `unusable` (`usable` is not exported; `readSettings` is). `devMarked(settings)` is `dev`, whatever the checkout. `sameFolder(settings.checkout, checkout)` is `installed` with `moved: false`. A `settings.checkout` that ends `.app/Contents/Resources/Studio` is `installed` with `moved: true`. Anything else, a git clone or a folder that is gone, is `takeover`.
- `PROGRAMS` and `DAMAGED` are `install.sh`'s (296, 299, 300), and a test reads `install.sh` to hold them to it.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-checks.test.js`, after moving `appCopy` and its neighbours and seeing `install.test.js` still pass.
  - "printOnly refuses a call without --print, and runs nothing": the guard with `--yes …` ends with 99, `ran` holds `refused`, and nothing else was run; with `--print --yes` it ends with 99 too.
  - "a home with no settings file is a fresh Mac"; "settings that cannot be read are unusable, with the settings' own words"; "settings marked dev are a dev Mac, whatever their checkout" (a dev mark with the app's copy as its checkout too); "settings whose checkout is this app's copy are installed, and not moved"; "settings whose checkout is another app's copy are installed and moved"; "settings whose checkout is a git clone, or is gone, are a takeover".
  - "a whole copy has no fault": `copyFault` of `mac()`'s copy is `""`.
  - "a copy with no build.json, a broken one, a missing program, a program that cannot be run, each is a fault that names it": `appCopy({ build: false })`; a `build.json` of `{`; `whisper-cli` removed; `ffprobe` with mode 644; and `appCopy({ lists: { ...HDR_LISTS, filters: "Filters:\n" } })`, whose fault names `scale_vt`.
  - "a copy whose signature does not verify is a fault": `dir/exits/codesign` holds 1.
  - "with deep false, codesign is never asked": `ran` holds no `codesign` line.
  - "the engine's list of programs is install.sh's": `TOOLS_PROGRAMS=(…)` and `TOOLS_HELPERS=(…)` read from `install.sh`'s text give `PROGRAMS`.
  - "the engine's DAMAGED words are install.sh's": `install.sh`'s text holds `DAMAGED`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-checks.test.js tests/install.test.js`.** Expected: FAIL in the new tests, since `tool/setup/checks.js` is not there; `install.test.js` passes as before.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-checks.test.js tests/install.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/checks.js tool/tests/app-copy.js tool/tests/setup-harness.js tool/tests/setup-checks.test.js tool/tests/install.test.js`, then `git commit -m "Studio app phase 5: the setup engine's checks of its own copy and of the kind of Mac, and the tests' made-up Mac"`.

---

### Task 6: `checks.js`: the name, the BRIMM Video search, the apps and Claude Code's state

**Files:**
- Modify: `tool/setup/checks.js`
- Test: `tool/tests/setup-checks.test.js`

**Interfaces:**
- Consumes:
  - `machineFault` (settings.js); `tool/move-app/move.zsh`'s `search_brimm_video` (422 to 435) and `install.sh`'s `find_claude` (346) and `GUARD_CLAUDE` (111), each read as text by a test.
- Produces:
  - `GUARD_CLAUDE = "2.1.295"` and `versionAtLeast(version, floor) -> boolean`, comparing the three numbers.
  - `nameSuggestion({ programs }) -> string`. `scutil --get ComputerName`, trimmed; `""` when scutil fails or `machineFault` refuses the name.
  - `namesInUse(root) -> string[]`. The names of the folders in `<root>/Drop` and in `<root>/Unedited Video`, and the name in the brackets at the end of each folder in `<root>/Episodes` (`(<machine>)` or `(<machine>)-N`). Sorted, each once. It never gives back an episode folder's name, or any part of one outside the brackets.
  - `nameClash(name, root) -> "" | warning`, whatever the case of the letters.
  - `brimmVideoFolders(home) -> string[]`; `NO_BRIMM_VIDEO`, the lines said when none is found.
  - `APPS`, the table of the four; `appsHere({ home, system = "/Applications" }) -> { "claude-app", dropbox, hyperframes: boolean }`.
  - `claudeAt({ home, tools, system = ["/usr/bin", "/bin"] }) -> path | null`.
  - `claudeState({ home, tools, run = spawnSync }) -> { here, where, version, enough, signedIn, plan }`.

**The lines:**
- `nameClash`'s warning: `Another Mac already uses the name "<name>" in BRIMM Video. Two Macs with one name would share a drop folder: choose another name, unless this is that Mac being set up again.`
- `NO_BRIMM_VIDEO`: `BRIMM Video was not found in Dropbox on this Mac.`, `Open Dropbox, sign in to The BRIMM's account, and wait until "The BRIMM DB" shows in Finder.`, `Then choose Look again.`
- `APPS`: `claude-app`, "Claude", `Claude.app`, `https://claude.ai/download`; `claude-code`, "Claude Code", no link; `dropbox`, "Dropbox", `Dropbox.app`, `https://www.dropbox.com/install`; `hyperframes`, "HyperFrames", `HyperFrames.app`, `https://hyperframes.dev/studio/download`, with the note `HyperFrames asks you to sign in to HeyGen the first time it opens.` One note for the three with a link: `If this Mac asks for an administrator's password, drag the app into the Applications folder inside your home folder instead.`

**The rules:**
- `brimmVideoFolders` looks in the four places `search_brimm_video` looks, in its order: `Library/CloudStorage/Dropbox*/The BRIMM DB/BRIMM Video`, `Library/CloudStorage/Dropbox*/*/The BRIMM DB/BRIMM Video`, `Dropbox*/The BRIMM DB/BRIMM Video` and `Dropbox*/*/The BRIMM DB/BRIMM Video`, under `home`. Folders only. One folder reached by two spellings is counted once, by its real path, and the first spelling is kept.
- `appsHere` looks for each app's folder in `system` and in `<home>/Applications`.
- `claudeAt` looks in `tools`, then in each of `system`, then in `<home>/.local/bin`, for a file named `claude` that may be run. That is where `install.sh`'s `find_claude` looks on an installed Mac: it does not look in Homebrew's folder there, and neither does this.
- `claudeState` runs claude with an environment built from scratch (`HOME`, `PATH=<tools>:/usr/bin:/bin`, `LANG=en_US.UTF-8`). `version` is the first `\d+\.\d+\.\d+` of `--version`; `enough` is `versionAtLeast(version, GUARD_CLAUDE)`; from `auth status --json`, `signedIn` is `loggedIn === true` and `plan` is `subscriptionType` when it is a string. Nothing else of that JSON is read, kept or given back: never the email, never the organisation. A claude that fails or prints no JSON is `signedIn: false`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-checks.test.js`.
  - "the suggested name is this Mac's ComputerName, trimmed": `says/scutil` of `Sallie's MacBook Pro\n`.
  - "a ComputerName that machineFault refuses, or a scutil that fails, suggests nothing": a name with `/` in it; `exits/scutil` of 1.
  - "the names in use come from the brackets, and no episode's folder is given back": `Episodes` holding `2026-11-01 Client Jane (Old Mac)`, `2026-11-02 Group (Old Mac)-2` and `Loose folder`, `Drop/Laptop`, `Unedited Video/Mac Studio`; the result is `["Laptop", "Mac Studio", "Old Mac"]`, and no entry holds `Jane`, `Group` or `2026`.
  - "a name already in use gives a warning, whatever its case, and a new name gives none": `old mac` warns; `New Mac` gives `""`.
  - "the search finds BRIMM Video in each of the four places, and counts one folder once": one home for each place; and a home where `~/Dropbox` is a link to `~/Library/CloudStorage/Dropbox` gives one path.
  - "a home with no Dropbox finds nothing": `[]`.
  - "the apps are looked for in /Applications and in the home's Applications": `system` given as a temp folder.
  - "the links are the three pinned ones": the three addresses above, each `https`, and Claude Code has none.
  - "Claude Code is looked for where install.sh looks": the three places in order, and the text of `find_claude` in `install.sh` still names `.local/bin`.
  - "Claude Code's state: not here, too old, signed out, signed in with its plan": the harness's four `claude` presets.
  - "Claude Code's state never carries the email or the organisation": `JSON.stringify` of the state holds neither `jane@example.invalid` nor `Example Org`, and its keys are exactly the six.
  - "the engine's floor for Claude Code is install.sh's": `GUARD_CLAUDE="2.1.295"` read from `install.sh`'s text equals `GUARD_CLAUDE`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-checks.test.js`.** Expected: FAIL in the new tests, since `checks.js` exports none of these yet.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-checks.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/checks.js tool/tests/setup-checks.test.js`, then `git commit -m "Studio app phase 5: the setup engine reads this Mac's name, BRIMM Video, the apps and Claude Code's state"`.

---

### Task 7: `tool/setup/questions.js`: each question, and the reading of each answer

**Files:**
- Create: `tool/setup/questions.js`
- Test: `tool/tests/setup-questions.test.js`

**Interfaces:**
- Consumes:
  - `machineFault`, `dropFolderFault`, `exportsFolderFault`, `cloudFolder`, `folderWords`, `defaultDropFolder`, `downloadsFolder` (settings.js); `nameClash`, `APPS`, `GUARD_CLAUDE`, `NO_BRIMM_VIDEO` (checks.js); `switchFor`, `lookerOf` (access.js); `eventFault`, `answerFault` (protocol.js), in the tests only.
- Produces:
  - Each question function gives a whole `question` event, `{ event: "question", id, kind, prompt, … }`, with `warning` and `fault` only when given and not empty.
  - `welcomeQuestion()`: id `welcome`, kind `confirm`, `ok: "Continue"`.
  - `nameQuestion({ suggested, warning, fault })`: id `name`, kind `text`.
  - `appsQuestion(state, { pin, warning, fault, working })`: id `apps`, kind `apps`. `state` is `{ here, claude }`, from `appsHere` and `claudeState`.
  - `signInQuestion({ link, fault })`: id `sign-in`, kind `sign-in`, `paste: true`, and `link` only when given.
  - `rootQuestion(found, home) -> question | null`: id `dropbox`, kind `choice`. `null` when exactly one folder was found.
  - `folderQuestion(purpose, { suggested, home, warning, fault })`: ids `drop-folder` and `exports-folder`, kind `folder`, with `words` from `folderWords(suggested, home)`.
  - `permissionQuestion(place, { folder, home })`: ids `permission-drop`, `permission-episodes` and `permission-downloads`, kind `choice`.
  - `reviewQuestion(ok)`: id `review`. A `confirm` when `ok`, a `choice` when not.
  - `read(question, value, ctx) -> { value, warning? } | { fault }`, where `ctx` is `{ home, root, drop, exports, state, pin, support }`, each given when the engine knows it.
  - `sentence(words) -> string`: a capital first letter and a full stop, for a fault that settings.js words as a phrase.

**The lines:**
- Prompts: `Set up BRIMM Video Studio on this Mac?`; `What should this Mac be called?`; `These apps work with BRIMM Video Studio.`; `Sign in to Claude in the browser. If it gives a code, paste it here.`; `Which BRIMM Video folder is The BRIMM's?`, or `NO_BRIMM_VIDEO`'s first line when none was found; `Where will videos be dropped on this Mac?`; `Where does HyperFrames save its exports on this Mac?`; `Install BRIMM Video Studio on this Mac?`; `This Mac is not ready to install yet. What stands in the way is under Details.`
- The permission prompt: `This Mac does not let BRIMM Video Studio look in <the folder, in Finder's words>. In System Settings, under Privacy & Security, Files and Folders, turn on <switchFor(folder, home)> under "BRIMM Video Studio". Then choose Look again.`
- Labels: `Look again` (value `look-again` in `dropbox`, `again` in a permission), `Go on without it` (`skip`), `Check again` (`again` in `review`). The `ok` of the review is `Install`.
- Claude Code's notes in the apps question: `Not installed.`; `Version <version> is too old: BRIMM Video Studio needs <GUARD_CLAUDE> or later.`; `Not signed in yet.`
- The faults of `continue`, the first that holds: `Claude Code is not installed yet. Choose Install Claude Code.` (with a pin); `This copy of BRIMM Video Studio cannot install Claude Code.` (with no pin), followed by `Write to <support> for help.` when `ctx.support` is not empty; `Claude Code <version> is too old: BRIMM Video Studio needs <GUARD_CLAUDE> or later.`, followed by `Choose Install Claude Code.` with a pin, or by the support sentence without one; `Claude Code is not signed in yet. Choose Sign in.`; `Dropbox is not installed yet. Install it, sign in to The BRIMM's account, then choose Continue.`
- The warning of `continue`: `<Claude | HyperFrames | Claude and HyperFrames> is not installed yet. You can go on: the Getting Started guide lists what is still to install.` (`are` for two).
- The drop folder's cloud warning: `This folder is kept in <cloudFolder's words>: every video dropped here would be uploaded there too. A folder on this Mac itself, such as BRIMM Video Work › Drop, is better.`

**The rules:**
- An apps row is `{ id, name, here }` for each of `APPS`, in its order. A row with a link carries it always, and the table's notes for it in one line: HyperFrames's own always, and the one about an administrator's password only while the app is not here.
- Claude Code's row is `here` only when it is here, new enough and signed in. Its `action` is `install-claude-code` only with a whole pin and Claude Code missing or too old, and `sign-in` only when it is here, new enough and not signed in. With no pin and Claude Code missing, the row has no action and its note ends with the support sentence when `ctx.support` names one. The shell's buttons for the two actions say `Install Claude Code` and `Sign in` (Phase 6): the faults name them so. `working`, when given, is a line that stands as Claude Code's note, with no action on that row, while Claude Code is being installed.
- `rootQuestion`: several folders make one option each, valued by the path and labelled by `folderWords`, and `look-again` last. None makes `look-again` the only option. BRIMM Video is never typed or picked by hand.
- `read`, by the question's id:
  - `name`: the value trimmed. `machineFault` not empty is a fault, as a sentence. With `ctx.root` given and `nameClash` not empty, `{ value, warning }`.
  - `apps`: `check`, `install-claude-code` and `sign-in` pass as they are. `continue` is a fault or a warning by the lines above, from `ctx.state`.
  - `sign-in`: `{}`, or `{ code }` with the code trimmed. The code is never put into a fault or a warning.
  - `dropbox`: `look-again` or one of the options' paths.
  - `drop-folder`: `dropFolderFault(path, { home, root, exports })`, with `exports` only when `ctx.exports` is given, and never a `machine`: a drop folder marked by another Mac is the installer's to refuse (Decided 28). A fault is said as a sentence. `cloudFolder(path, home)` not empty is the warning.
  - `exports-folder`: `exportsFolderFault(path, { home, root, drop })`. No cloud warning: a cloud folder is allowed there.
  - A permission: `again` or `skip`. `review`: `true` or `again`.
- `questions.js` is pure: it starts no program, writes nothing and emits nothing. It reads the disk only through settings.js's folder faults and `nameClash`. Giving a warning only once is the engine's rule (Task 13), not `read`'s.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-questions.test.js`, on the harness's `mac()`.
  - "the welcome is a confirm whose button says Continue".
  - "a name that machineFault refuses is a fault, in its own words as a sentence": `""` gives `A Mac's name cannot be empty.`; a name of 41 letters gives the 40 characters line.
  - "a name another Mac uses is taken with a warning, and without one when no BRIMM Video is known yet": `old mac` with `ctx.root`, then with none.
  - "the apps question: a link for each app that has one, and here as appsHere says"; "Claude Code's row: install only with a whole pin, sign in only when it is here and new enough": the four `claude` presets, each with and without a pin.
  - "continue is refused, in one line, for Claude Code missing, too old or signed out, and for Dropbox missing": each fault is one line and is the line above.
  - "with no pin, the refusal says this copy cannot install Claude Code and names the support contact": `support: "help@example.invalid"`; and with `support: ""` the sentence is not there.
  - "a missing Claude app or HyperFrames app is a warning, and continue is taken": one missing, then both.
  - "several BRIMM Video folders make a choice in Finder's words, with Look again; exactly one asks nothing"; "no BRIMM Video folder: the only choice is Look again".
  - "the drop folder's suggestion is BRIMM Video Work's Drop, and the exports folder's is Downloads": the engine's defaults, `defaultDropFolder(home)` and `downloadsFolder(home)`, given as `suggested`, come back with their `words`.
  - "a drop folder that dropFolderFault refuses is a fault, in its own words as a sentence": the root itself, and a path that is not whole.
  - "a drop folder in a cloud folder is taken with a warning that names the cloud": `<home>/Library/CloudStorage/Dropbox/Videos`, made first, names `Dropbox`.
  - "an exports folder is checked against the drop folder that was chosen": the drop folder itself is a fault.
  - "the permission question names the folder in Finder's words, its switch and BRIMM Video Studio": `<home>/Downloads` names `Downloads Folder`, and the prompt holds no `node`.
  - "a review that is ok is a confirm whose button says Install; one that is not offers only Check again".
  - "a pasted code is given back and is in no fault and no warning": `{ code: " 9f3a-code " }` gives `9f3a-code`; and a `{}` gives `{}`.
  - "every question passes eventFault": each function above, with and without a warning and a fault; and each value `read` takes passes `answerFault` for its question.
  - "no prompt, label, fault or warning says node or Terminal": every string the tests above saw.
  - "questions.js starts no program and writes nothing": its text imports neither `node:child_process` nor a writing function of `node:fs`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-questions.test.js`.** Expected: FAIL, since `tool/setup/questions.js` is not there.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-questions.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/questions.js tool/tests/setup-questions.test.js`, then `git commit -m "Studio app phase 5: the setup engine's questions, and the reading of each answer"`.

---

### Task 8: `tool/setup/install.js`: staging the model, the HyperFrames tools and Chrome

**Files:**
- Create: `tool/setup/install.js`
- Test: `tool/tests/setup-install.test.js`

**Interfaces:**
- Consumes:
  - `PIN`, `toolchainDir`, `cliPath`, `toolchainHolds`, `toolchainDiffers`, `childEnv` (hyperframes.js); `tool/whisper-model.pin.json`; `install.sh`'s `MODEL` (118 to 119), its npm line (1121), `toolchain_here` (385), `drop_toolchain` (393), `run_hyperframes` (403) and `browser ensure` (1149), each read as text by a test or followed by hand.
- Produces:
  - `LABELS`: the label of each part of `PARTS`.
  - `MODEL_BYTES = 1624555275`, the bar's guess of the model's size. Nothing is checked against it.
  - `modelPath(home)`: `<home>/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin`, stated here. `tool/run.js` is not imported.
  - `modelPin(checkout) -> { url, sha256 }`, from `tool/whisper-model.pin.json`; `sha256Of(file) -> Promise<string>`, read as a stream.
  - `stageModel({ home, pin, programs, progress, signal, bytes = MODEL_BYTES, pollMs = 500 }) -> Promise<"done" | "skipped">`.
  - `npmArgs(home) -> string[]`; `stageCli({ home, tools, progress, signal, run, holds = toolchainHolds, differs = toolchainDiffers }) -> Promise<"done" | "skipped">`.
  - `stageChrome({ home, tools, progress, signal, run }) -> Promise<"done">`.
  - `quiet(text) -> string`.
  - `progress` is a function given a whole `progress` event's fields, `{ part, label, done, total, state, detail? }`. A stage that fails rejects with an `Error` whose `code` is `"download"` and whose message is fit to show; one that was stopped rejects with `code: "stopped"`.

**The lines:**
- `LABELS`: `programs` is `Checking BRIMM Video Studio`; `model` is `Transcription model`; `hyperframes` is `HyperFrames tools`; `chrome` is `Chrome for HyperFrames`; `installer` is `Setting up this Mac`; `claude` is `Asking Claude from the background job`.
- A model that is not the pin's: `The transcription model that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.`
- A download that failed: `The transcription model could not be downloaded (curl <code>). Check this Mac's internet connection, then choose Repair.`
- The tools: `The HyperFrames tools could not be fetched as BRIMM Video Studio expects them. Check this Mac's internet connection, then choose Repair.`
- Chrome: `HyperFrames could not fetch its copy of Chrome. Check this Mac's internet connection, then choose Repair.`

**The rules:**
- `stageModel`: a model that is there with the pin's SHA-256 is `skipped`, and curl is never run. Otherwise a `.part` file left from before is taken away, and curl is run as `curl --fail --location --silent --show-error --output <modelPath>.part <url>`, with an environment built from scratch (`HOME`, `PATH=/usr/bin:/bin`, `LANG=en_US.UTF-8`). While it runs, the `.part` file's size is read every `pollMs` and sent as `done`, with `total` `bytes`; `done` never passes `total`, and once the file is larger than `bytes` the `total` is null. When curl ends with 0 and the file's SHA-256 is the pin's, it is given its name. A SHA-256 that is not the pin's, or a curl that fails, takes the `.part` file away. A stop (`signal`) ends curl and takes the `.part` file away.
- `npmArgs(home)` is `["install", "--prefix", toolchainDir(home), "--ignore-scripts", "--no-fund", "--no-audit", "--save-exact", "hyperframes@<PIN.version>"]`, the arguments of `install.sh`'s own npm line. npm is `<tools>/npm`, run with `HOME`, `PATH=<tools>:/usr/bin:/bin`, `LANG=en_US.UTF-8`, `HYPERFRAMES_NO_TELEMETRY=1` and `NPM_CONFIG_UPDATE_NOTIFIER=false`.
- `stageCli`: `differs(holds(home)) === ""` is `skipped`, and npm is never run. After npm, a toolchain that still differs is taken away and the stage fails. Only a folder whose path matches `/\/\.toolchain\/hyperframes-\d[^/]*$/` is ever taken away, as `drop_toolchain` does.
- `stageChrome` runs `<tools>/node <cliPath(home)> browser ensure` with `childEnv({ base: { HOME: home }, node: <tools>/node })`: the pinned command line fetches its own Chrome, and Studio holds no pin for it (Decided 10). It is run every time, as `install.sh` runs it.
- `quiet` drops each line that matches `/^\/bin\/sh: (line \d+: )?docker: command not found$/` and keeps every other line as it was.
- Each stage sends `running` when it starts and `done`, `skipped` or `failed` when it ends. No stage shows what a program printed: it goes to the engine's stderr, through `quiet`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-install.test.js`, on the harness's `mac()`. A pin is given whose `sha256` is that of the bytes in `says/curl`.
  - "a model already there with the pin's SHA-256 is skipped, and curl is never run": `ran` holds no `curl` line.
  - "the model is downloaded to a .part file, checked, and then given its name": `ran`'s curl line names `--output` and the `.part` path; afterwards the model is there and the `.part` file is not.
  - "a model whose SHA-256 is not the pin's is taken away": the model's folder holds neither file, and the fault is the line above.
  - "a curl that fails leaves no .part file, and the fault names the model": `exits/curl` of 22.
  - "the model's bar never passes its total, and has no total once the file is larger than expected": `bytes: 4` with 10 bytes downloaded; every event has `done <= total` or `total === null`.
  - "a stop while the model downloads ends curl and takes the .part file away": a curl of the test's own, which writes a few bytes and waits while `dir/hold` is there; the stage rejects with `code: "stopped"`.
  - "the HyperFrames CLI already there and right is skipped, and npm is never run": `differs: () => ""`.
  - "npm is given install.sh's own arguments, with its update notice off": `run` given as a recorder.
  - "the engine's npm arguments are install.sh's": the words after `"$npm"` on `install.sh`'s npm line, with `$TOOLCHAIN` and `$HYPERFRAMES_VERSION` filled in, are `npmArgs(home)`.
  - "a CLI that is not right after npm ran is taken away, and only its own folder": `differs: () => "none"`; a folder beside it in `.toolchain` stays.
  - "Chrome is fetched by the pinned CLI's own browser ensure": `run` given as a recorder; its environment is `childEnv`'s.
  - "docker's line is dropped, and every other line is kept".
- [ ] **Step 2: Run `cd tool && node --test tests/setup-install.test.js`.** Expected: FAIL, since `tool/setup/install.js` is not there.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-install.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/install.js tool/tests/setup-install.test.js`, then `git commit -m "Studio app phase 5: the setup engine stages the model, the HyperFrames tools and Chrome"`.

---

### Task 9: `install.js`: Claude Code's install and its sign-in

**Files:**
- Modify: `tool/setup/install.js`
- Test: `tool/tests/setup-install.test.js`

**Interfaces:**
- Consumes:
  - `GUARD_CLAUDE`, `versionAtLeast`, `claudeAt`, `claudeState` (checks.js); `signInQuestion` (questions.js); `sha256Of` (Task 8).
- Produces:
  - `claudePin(checkout) -> { version, url, sha256 } | null`, from `tool/claude-code.pin.json`. This phase adds no such file (Open for Jason, 1).
  - `CLAUDE_INSTALL_ARGS = ["install"]`: what the downloaded copy is run with. The one place to change if the by-hand check finds otherwise.
  - `installClaudeCode({ home, tools, pin, programs, say, signal, run }) -> Promise<string>`, the path `claudeAt` then finds.
  - `signInLinkOf(text) -> string | null`.
  - `LINK_WAIT_MS = 5000`, `SETTLE_MS = 10000`.
  - `signIn({ home, tools, claude, programs, ask, timeoutMs = 300000, linkWaitMs = LINK_WAIT_MS, settleMs = SETTLE_MS, pty = true }) -> Promise<{ signedIn, plan, fault? }>`.

**The lines:**
- `say` is given `Downloading Claude Code.` and then `Installing Claude Code.`
- A download that is not the pin's: `The copy of Claude Code that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.`
- A download or an install that failed: `Claude Code could not be installed. Check this Mac's internet connection, then try again.`
- A sign-in that never ended: `Signing in took too long. Try again.` One that ended signed out: `Claude Code is not signed in yet. Try again.`

**The rules:**
- A pin is whole only with a `version` of three numbers that is not below `GUARD_CLAUDE`, a `url` that is `https`, and a `sha256` of 64 hex digits. No file, a file that is no JSON, or a pin that is not whole gives `null`, and the Apps step then shows Claude Code with no install button.
- `installClaudeCode` downloads to `<home>/Library/Caches/BRIMM Video Studio/claude-<version>.part` with curl, as `stageModel` does. A download is data until its SHA-256 is the pin's: one that is not is taken away, never made runnable and never run. One that is right is given mode 755 and run with `CLAUDE_INSTALL_ARGS`, with `claudeState`'s environment. The download is taken away whatever happens. `claudeAt` must then find Claude Code, or the install failed. It rejects with a message fit to show: at the Apps step that is the apps question's `fault`, and the run goes on (Decided 30).
- `signInLinkOf` takes colour codes off, and gives the first link that is `https`, holds no user name and no password, and whose host is `claude.ai`, `claude.com` or `anthropic.com`, or ends with a dot and one of them. Any other link is never passed on.
- `signIn` starts `<programs.script> -q /dev/null <claude> auth login`, so that claude has a terminal of its own, with `claudeState`'s environment, and script's input goes through cat and a shell pipe (node's own pipes are sockets, which macOS script refuses; a named pipe is a socket there too). With `pty: false` it starts nothing and only asks `claudeState` (the fallback of "What this phase assumes of the spikes").
- It waits up to `linkWaitMs` for a link, then asks `signInQuestion({ link })` through `ask`, with no link when none came. A link that comes later asks the question again with it.
- `ask(question)` gives a promise of the answer's value, or of `"back"` or `"cancel"`. `{ code }` writes the code and a line break to claude's input, and nothing else anywhere. `{}` writes nothing. After an answer, claude is given `settleMs` to end by itself and is then ended. If claude ends by itself before an answer, `signIn` goes on without one. `"back"`, `"cancel"` and `timeoutMs` end claude.
- Afterwards it asks `claudeState` and gives back only `signedIn` and `plan`, with a `fault` when it is not signed in.
- The pasted code is never in an event, a file, the engine's stderr, a thrown error's message or a program's arguments.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-install.test.js`.
  - "a pin is whole only with a version, an https address and a 64-digit SHA-256, and never below the floor": a whole one; then `http`, 63 digits, `2.0.0`, and a version of two numbers, each `null`.
  - "no pin file, or one that is not whole, gives no pin": the app copy as it is; a file of `{`.
  - "Claude Code is downloaded, checked against the pin, installed by its own install step, and the download is taken away": `says/curl` holds a script that, run with `install`, puts a claude stand-in into `<home>/.local/bin`; afterwards `claudeAt` finds it and the caches folder holds no `claude-` file.
  - "a Claude Code download whose SHA-256 is not the pin's is never run": the script would write `dir/was-run`; that file is not there, and neither is the download.
  - "a link is passed on only when it is https and its host is claude.ai, claude.com or anthropic.com": `https://claude.ai/oauth/authorize?code=true` and `https://console.anthropic.com/x` pass; `http://claude.ai/x`, `https://claude.ai.example.invalid/x`, `https://example.invalid/?next=https://claude.ai/x` and `https://user:pw@claude.ai/x` do not.
  - "colour codes around a link are taken off".
  - "the pasted code reaches claude and nothing else": `says/claude-login` holds a link; the answer `{ code: "9f3a-code" }`; `dir/claude-got` holds it, and no question, no line of `ran`, no other file in `dir` and nothing written to stderr holds it.
  - "an empty answer writes nothing to claude": `dir/claude-got` is not there, and claude was ended after `settleMs: 20`.
  - "a sign-in that never ends is stopped after its time, and says so": `timeoutMs: 50` and an `ask` that never answers.
  - "after signing in, only signed in and the plan are given back": the result's text holds neither `jane@example.invalid` nor `Example Org`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-install.test.js`.** Expected: FAIL in the new tests, since `install.js` exports none of these yet.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-install.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/install.js tool/tests/setup-install.test.js`, then `git commit -m "Studio app phase 5: the setup engine installs Claude Code from a pin and signs it in"`.

---

### Task 10: `install.js`: the installer's run, its exit codes, the busy wait and the check log

**Files:**
- Modify: `tool/setup/install.js`
- Test: `tool/tests/setup-install.test.js`

**Interfaces:**
- Consumes:
  - `idleWhy` (busy.js); `quiet` (Task 8); `install.sh`'s options (193 to 208), `BUSY=75` (99) and `CHECK_LOG` (117), and `tool/unedited.js`'s two lines (1746, 1763), each read as text by a test; `printOnly` (the harness).
- Produces:
  - `installerArgs(answers, { app, tools, print = false }) -> string[]`, where `answers` is `{ kind: "fresh", machine, root, drop, exports }` or `{ kind: "held", machine, root }`.
  - `installerEnv(home, base = process.env) -> object`.
  - `runInstaller({ args, home, programs }) -> Promise<{ code, text }>`.
  - `installerOutcome(code) -> "done" | "failed" | "refused" | "busy"`.
  - `BUSY_TRIES = 5`, `BUSY_WAIT_MS = 30000`.
  - `installWhenIdle({ args, home, programs, why, wait, progress, tries = BUSY_TRIES, waitMs = BUSY_WAIT_MS }) -> Promise<{ code, text }>`.
  - `checkLogMark(home) -> { ino, birthtimeMs, size } | null`; `checkLogSays(home, { before = null } = {}) -> { answered, line }`.

**The lines:**
- After five tries: `BRIMM Video Studio is at work on this Mac, so setup cannot finish yet. Wait until it is done, then choose Repair.`
- No line in the check log: `Claude did not answer from the background job within 90 seconds.`

**The rules:**
- A fresh Mac's arguments are `["--yes", "--machine", machine, "--tools", tools, "--app", app, "--drop-folder", drop, "--exports-folder", exports, root]`. A held Mac's, a takeover's or an installed Mac's, are `["--yes", "--machine", machine, "--tools", tools, "--app", app, root]`, with the machine and the root of its settings: the installer keeps the folders the settings hold. With `print`, `--print` stands where `--yes` stood, and nothing else differs.
- `installerEnv` is built from scratch: `HOME`, `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, `LANG=en_US.UTF-8`, `NPM_CONFIG_UPDATE_NOTIFIER=false`, and `TMPDIR`, `USER` and `LOGNAME` when `base` holds them. Never the whole of `base`.
- `runInstaller` starts `programs.installer` with the arguments, its input closed, and gives its exit code and its stdout and stderr as one text, through `quiet`. It has no time limit and is never ended by the engine: half an install is worse than a late answer to a cancel.
- `installerOutcome`: 0 is `done`, 2 is `refused`, 75 is `busy`, and 1 or any other code is `failed`.
- `installWhenIdle` asks `why()` before each try (by default `idleWhy({ home })`). A line means something is at work: it is sent as `progress`, part `installer`, state `waiting`, with the line as `detail`, then `wait(waitMs)`, and that was a try. With no line the installer runs. An exit of 75 is treated the same way, and the line shown is asked from `why()` again, never read out of the installer's text. After `tries` it rejects with `code: "busy"`.
- `checkLogMark` says which file `<home>/Library/Logs/brimm-video-claude-check.log` is (its inode and birth time) and its size, or null when it is not there. The engine takes it before the installer runs. `checkLogSays` reads the whole log when it is another file than `before` or there was none, else from `before.size`, or from 0 when it is now shorter (install.sh takes the old log away before its check, and the new log can be just as long: Ruling F1 of the final review). A line that starts `Claude answered from here` is `answered: true`. One that starts `Claude could not be asked from here` is `answered: false`, with that line. Neither is `answered: false` with the line above.
- No line of this task names an episode's folder: `idleWhy`'s lines name none.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-install.test.js`.
  - "a fresh Mac's arguments carry its name, the tools, the app, both folders and BRIMM Video, in install.sh's order".
  - "a takeover's arguments name no drop folder and no exports folder": `kind: "held"`.
  - "a print has --print where a real run has --yes, and nothing else differs".
  - "every option the engine gives is one install.sh reads": each of `--print`, `--yes`, `--machine`, `--tools`, `--app`, `--drop-folder` and `--exports-folder` is a label of the `case` in `install.sh`'s text.
  - "the installer is started with exactly the arguments, and with an environment built from scratch": an installer of the test's own that writes its arguments and `env`'s output to a file; `process.env.BRIMM_LEAK = "1"` set first is not in it, and `PATH` is the line above.
  - "exit 0 is done, exit 1 failed, exit 2 refused, each with the installer's text": `exits/installer` and `says/installer`; docker's line is not in the text.
  - "something at work: the line is shown, and after five tries the run ends with error busy": a `why` that always gives `BRIMM Video Studio is transcribing a video.`; five `waiting` events carry it, `wait` was called with 30000, the installer never ran, and the rejection's `code` is `busy`.
  - "an exit 75 from the installer itself is waited for the same way, and the line comes from idleWhy, not from the installer's text": `exits/installer` of 75 and `says/installer` of `2026-11-01 Client Jane (Old Mac) is being read`; no event holds `Jane`.
  - "once nothing is at work the installer runs": a `why` that gives a line twice and then `""`.
  - "the check log: answered, could not be asked, and no line at all"; "an old line in the check log, from before this run, is not read": `from` set to the size before.
  - "the engine's two phrases are unedited.js's": `tool/unedited.js`'s text holds `Claude answered from here.` and `Claude could not be asked from here: `.
  - "the real installer, with --print, from an app's copy: exit 0, and nothing changed", `{ skip: notAMac }`: `programs.installer` is `printOnly(m)`, the arguments are a fresh Mac's with `print`; the code is 0, `settingsOf(m.home)` is null, and the home holds no `Library/LaunchAgents`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-install.test.js`.** Expected: FAIL in the new tests, since `install.js` exports none of these yet.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-install.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/install.js tool/tests/setup-install.test.js`, then `git commit -m "Studio app phase 5: the setup engine runs the installer, waits while this Mac is at work, and reads the check log"`.

---

### Task 11: `tool/setup/summary.js`: the review, the setup summary and the status

**Files:**
- Create: `tool/setup/summary.js`
- Test: `tool/tests/setup-summary.test.js`

**Interfaces:**
- Consumes:
  - `folderWords`, `dropFolderOf`, `exportsFolderOf` (settings.js); `quiet` (Task 8); `installerEnv` (Task 10); `eventFault` (Task 4); `install.sh`'s `settings_plan` (318 to 322), its `switch_args` (658 to 660) and its options (193 to 208), each read as text by a test; `mac`, `settingsOf` (the harness).
- Produces:
  - `planArgs(answers, { checkout }) -> string[]`. `settings.js plan`'s arguments for these answers, where `answers` is Task 10's.
  - `planOf({ answers, home, checkout, node = process.execPath, run = spawnSync }) -> { code: 0, settings } | { code, why }`. The one function of this file that starts a program.
  - `reviewSummary({ kind, moved, answers, home, build, printed, planned, claude, here }) -> object`. A whole `summary` event, id `review`. `kind` and `moved` are `kindOf`'s, `build` is `buildOf(checkout)`, `printed` is `runInstaller`'s `{ code, text }`, `planned` is `planOf`'s result, `claude` is `claudeState`'s result, and `here` is `{ model, cli }`, two booleans.
  - `setupSummary({ kind, home, settings, build, claude, check, missing, old }) -> object`. A whole `summary` event, id `setup`. `check` is `checkLogSays`'s `{ answered, line }`, `missing` is the names, from `APPS`, of the apps that are not here, and `old` is a takeover's old checkout.
  - `statusSummary({ found, home, build }) -> object`. A whole `summary` event, id `status`, with `needs`. `found` is `kindOf`'s result.
  - `summaryText(summary) -> string`. The text for "Copy setup summary".

**The lines:**
- `This Mac`: the Mac's name.
- `BRIMM Video in Dropbox`, `Drop folder`, `Exports folder`: each folder in `folderWords`.
- `BRIMM Video Studio`: `Version <version> (<build>)`, or `This copy's version cannot be read.` when the build is broken.
- `Transcription model`: `Already on this Mac.` or `Will be downloaded (about 1.6 GB).`
- `HyperFrames tools`: `Already on this Mac.` or `Will be fetched.`
- `Claude Code`: `Version <version>, signed in.`, or `Version <version>, signed in, on the <plan> plan.` when `plan` is not empty. Not here: `Not found on this Mac.` Too old: `Version <version>, which is too old for BRIMM Video Studio.` Not signed in: `Version <version>, not signed in.`
- `Background job`, in the review: `Watches the drop folder for new videos, and starts when you log in.`
- `Background job`, in the setup summary: `Claude answered from the background job.` or `Claude did not answer from the background job.`
- `Moving to this app`, a takeover: `This Mac already runs BRIMM Video Studio from an older copy. Installing moves it to this app. Its name, its settings and its drop folder stay as they are.`
- `Moving to this app`, an installed Mac whose copy moved: `This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Installing points it at this one.`
- `Still to install`: the names, with commas between them.
- `Older copy`, a takeover: `<folderWords(old, home)> is no longer used, and was left as it is.`
- `Setup`, in the status. A fresh Mac: `BRIMM Video Studio is not set up on this Mac yet.` A takeover: `This Mac runs BRIMM Video Studio from an older copy. Setup moves it to this app.` An installed Mac whose copy moved: `This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Repair points it at this one.` An installed Mac: `BRIMM Video Studio is set up on this Mac.`

**The rules:**
- `planArgs` gives `["plan", "--machine", machine, "--root", root, "--checkout", checkout]`, and for a fresh Mac `"--drop-folder", drop, "--exports-folder", exports` after them. The checkout is the app's own, as `install.sh`'s `$CHECKOUT` is. A held Mac's plan names no folder: `planned` keeps the ones its settings hold.
- `planOf` runs `<node> <checkout>/tool/settings.js` with `planArgs`, with `installerEnv(home)`, its input closed and a time limit of 60 seconds. The settings are the JSON object that comes first in its stdout, up to the first line that is `}` alone: the plain lines after it are not read. A refusal, a program that would not start, or JSON that does not parse gives `{ code, why }`, with the plan's own words through `quiet`, and a `code` that is never 0.
- The review's `ok` is `printed.code === 0` and a plan that was made. Its `exit` is `printed.code`. Its `details` is the installer's text, and when the plan refused, the plan's why comes first, then a blank line, then the installer's text.
- The review's lines are made from the plan's settings and from this file's own functions, never from `printed.text` (Decided 31): in order `This Mac`, `BRIMM Video in Dropbox`, `Drop folder`, `Exports folder`, `BRIMM Video Studio`, `Transcription model`, `HyperFrames tools`, `Claude Code`, `Background job`, and `Moving to this app` on a takeover or on an installed Mac whose copy moved. When the plan refused, the name and the folders are the answers', and the drop folder's and the exports folder's lines are there only when the answers hold them.
- The setup summary's `ok` is `check.answered`. Its lines, in order: `This Mac`, `BRIMM Video Studio`, `BRIMM Video in Dropbox`, `Drop folder`, `Exports folder`, `Claude Code`, `Background job`, `Still to install` when `missing` holds a name, and `Older copy` on a takeover. When Claude did not answer, the check's own line is the summary's `details`. It never deletes the old copy, and it holds no date.
- The status's `needs`: a fresh Mac and a takeover need `setup`; an installed Mac whose copy moved needs `repair`; an installed Mac needs `nothing`. Its `ok` is whether it needs nothing. Its lines: `This Mac` when the Mac has settings, `BRIMM Video Studio`, and `Setup`. `statusSummary` starts no program and reads no file.
- `summaryText` gives `label: value`, one to a line, in the summary's order, without the details.
- Claude Code's line never holds the email address or the organisation, and no line says "Terminal" or "node". The plan's refusal words, which may say "node", stay under `details`.
- No value holds a line break: only `details` may.
- These tests run on CI's Linux as on a Mac: `settings.js plan` asks plutil only of a launch agent's file that is there, and the harness's home holds none.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-summary.test.js`.
  - "the review's ok is the installer's exit code, and its details are the installer's text": codes 0, 1 and 2, with a plan that was made.
  - "the review's lines are the same whatever the installer's text says": two `printed` with the same code and different texts, one holding `2026-11-01 Client Jane (Old Mac)`, give deep-equal `lines`, and no line holds `Jane`.
  - "a fresh Mac's review names its name and its three folders in Finder's words": BRIMM Video reads `Dropbox › The BRIMM DB › BRIMM Video`.
  - "a takeover's review says this Mac moves to this app and keeps its settings"; "a plan that refuses makes the review not ok, with the plan's own words": the why is the first thing in `details`.
  - "Claude Code's line has no Terminal in it, and no email": a `claude` whose fields hold `jane@example.invalid` and `Example Org`, in each of the four states.
  - "the setup summary names the old checkout as no longer used, and never deletes it": the old folder is still there afterwards.
  - "the status of a whole Mac needs nothing"; "the status of a Mac whose app has moved needs a repair"; "the status of a fresh Mac needs setup": `mac`'s `installed`, `moved` and `none`, each through `kindOf`.
  - "every option the engine gives the plan is one install.sh's settings_plan gives": `--machine`, `--root` and `--checkout` are in `settings_plan`'s line, and `--drop-folder` and `--exports-folder` are options `install.sh` takes into `switch_options`, which `switch_args` passes on.
  - "the plan's settings are read from the JSON that comes first, whatever lines follow": a `run` of the test's own whose stdout is an object and then three plain lines.
  - "settings.js's own plan, for a fresh Mac on the harness: code 0, and the settings hold the name and both folders": the drop folder is `<home>/BRIMM Video Work/Drop` and the exports folder is `<home>/Downloads`, neither of which need be there; `settingsOf(m.home)` is still null.
  - "settings.js's own plan, for a takeover on the harness: code 0, and the name and both folders are the settings' own". If it fails for a folder the `takeover` preset does not make, the preset makes it, and `tool/tests/setup-harness.js` is then part of this task's commit.
  - "every summary passes eventFault": each summary a test above made.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-summary.test.js`.** Expected: FAIL, since `tool/setup/summary.js` is not there.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-summary.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/summary.js tool/tests/setup-summary.test.js`, then `git commit -m "Studio app phase 5: the setup engine's review, setup summary and status"`.

---

### Task 12: `tool/setup/guide.js` and `guide-template.html`: the Getting Started guide

**Files:**
- Create: `tool/setup/guide.js`
- Create: `tool/setup/guide-template.html`
- Test: `tool/tests/setup-guide.test.js`

**Interfaces:**
- Consumes:
  - `folderWords`, `workFolder`, `dropFolderOf`, `exportsFolderOf` (settings.js); `REPAIR`, `UPDATE_SAY` (build.js); `studioFolder` (studio.js); the fonts in `tool/brand/fonts/`; the colours of `tool/brand/brand.md`, read as text by a test.
- Produces:
  - `GUIDE_NAME = "BRIMM Video Studio Getting Started"`.
  - `guideData({ home, settings, build, missing, notes, now }) -> object`. Every value the template asks for.
  - `fillGuide(template, data, { fonts }) -> string`. The page, whole. `fonts` is the folder the font files are in.
  - `writeGuide({ home, data, template, fonts }) -> { html, pdf }`. By default the template is `guide-template.html` beside this file, and the fonts are `tool/brand/fonts/`.

**The lines:**
- The agent: `In HyperFrames, the agent is Claude Code with Auto access, never Full.`
- Telemetry: `Telemetry stays off.`
- HeyGen: `HyperFrames asks you to sign in to HeyGen the first time it opens.`
- The cloud: `Never render in the cloud: every video is made on this Mac.`
- Sallie: `The BRIMM does not use an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice, for now.`
- Nothing to install: `Nothing: every app is here.`

**The rules:**
- `guideData` gives `machine`; `drop`, `exports` and `root`, each in `folderWords`; `version` and `build`; `support`; `studio`, which is `folderWords(studioFolder(home), home)`; `toInstall`, a list of the missing apps' names, or the one line above when none is missing; `notes`, a list; `update`, which is `UPDATE_SAY`; `repair`, which is `REPAIR`; and `date`. The date is spelled from this file's own table of months, in the Mac's local time: `new Date(2026, 10, 9, 12)` gives `9 November 2026`.
- `fillGuide` knows three marks. `{{key}}` is the value as text, with `&`, `<`, `>` and `"` escaped. `{{list:key}}` is a list's lines, each escaped, each an `<li>`. `{{font:<file>}}` is a base64 `data:` URI of that file in `fonts`. A key the data does not hold, a list that is not a list, or a font file that is not there throws. Nothing else in the template is changed.
- The template holds, in this order: a welcome with this Mac's name and the version; the drop folder in Finder's words, and how to add it to Finder's sidebar; how to make BRIMM Video available offline in Dropbox; HyperFrames' settings, with the five lines above; how to start in the Claude app, in its Code tab, on the `BRIMM Video Studio` folder in the home folder; how an update arrives, in `update`'s words, and Repair, in `repair`'s; what is still to install; the notes; and who to ask, the support contact.
- The page's background is Mist (`#E8E3DA`), its words are Navy (`#1F2D42`) and its lines are Sand (`#C1AD97`). Its typeface is Josefin Sans, with Allison for the script, held in the page itself (Decided 17): `josefin-sans-latin-300-normal.woff2`, `josefin-sans-latin-400-normal.woff2`, `josefin-sans-latin-500-normal.woff2` and `Allison-Regular.ttf`. Its `@page` is Letter.
- The page loads nothing from the network: no `<script`, no `<link`, no `src="http`, and every `url(` is a `data:` URI.
- `writeGuide` writes `<workFolder(home)>/BRIMM Video Studio Getting Started.html`, making the folder when it is not there, and gives that path as `html` and the same name with `.pdf` as `pdf`. It does not make the PDF: Phase 6's shell prints the page to that path.
- The guide is written into `~/BRIMM Video Work` itself, which no Mac's drop folder and no exports folder can be (`dropFolderFault`, settings.js:555, and `exportsFolderFault`, 659, each refuse it), so a new file there starts nothing.
- The guide never says "node" and never says "Terminal". It names no episode's folder, and nothing of Claude Code's account.
- `tool/setup/guide.js` imports nothing from `tool/guide.js`, which is the contract's.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-guide.test.js`.
  - "the guide's data has this Mac's name, its folders in Finder's words, the version and the support contact"; "the date is spelled in the Mac's own time": `new Date(2026, 10, 9, 12)`.
  - "every key the template asks for is given, and a template that asks for one more throws": the real template with the real data, then the same template with `{{nothing}}` added.
  - "a value is escaped: a Mac named with < or & cannot write HTML": a Mac named `<b>A&B</b>`.
  - "the guide says Auto, never Full; telemetry off; never render in the cloud; and the HeyGen sign-in": the five lines above, each whole.
  - "the guide's colours are the brand's, and its fonts are held in the page itself": the three colours are in `tool/brand/brand.md`'s text too, and the page holds four `data:` URIs.
  - "the guide loads nothing from the network".
  - "the guide is written into BRIMM Video Work, and the PDF's place is named beside it": a home with no `BRIMM Video Work`; the folder is made, the `.html` is there and the `.pdf` is not.
  - "the guide never says node or Terminal": the filled page with its `data:` URIs taken out, whatever the case.
  - "tool/setup/guide.js does not import tool/guide.js": its text holds no `../guide.js`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-guide.test.js`.** Expected: FAIL, since `tool/setup/guide.js` is not there.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-guide.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/guide.js tool/setup/guide-template.html tool/tests/setup-guide.test.js`, then `git commit -m "Studio app phase 5: the Getting Started guide"`.

---

### Task 13: `tool/setup/engine.js`: the run, from the first line to the last

**Files:**
- Create: `tool/setup/engine.js`
- Modify: `tool/tests/setup-harness.js`
- Test: `tool/tests/setup-engine.test.js`

**Interfaces:**
- Consumes:
  - Everything Tasks 4 to 12 produce; `DEV_REFUSAL`, `episodesFolder`, `defaultDropFolder`, `downloadsFolder` (settings.js); `lookAt` (access.js); `buildOf`, `REPAIR` (build.js); `studioFolder` (studio.js); `idleWhy` (busy.js); `toolchainHolds`, `toolchainDiffers` (hyperframes.js); `isMain` (is-main.js); `mac`, `drive`, `installCalls`, `settingsOf` (the harness).
- Produces:
  - `runSetup({ argv, input, output, errors, home, checkout, programs, why, wait, now, look = lookAt, applications = "/Applications", pty = true, stages = { model: stageModel, cli: stageCli, chrome: stageChrome } }) -> Promise<number>`. The whole run: it gives the engine's exit code.
  - `main()`. The engine as a program, run only under `isMain(import.meta.url)`.
  - `drive(m, { run, answers, why, argv, look, stages })` (the harness): `stages` is new.

**The lines:**
- The steps' titles: `Welcome`, `This Mac's name`, `Apps`, `BRIMM Video in Dropbox`, `Folders`, `Permissions`, `Review`, `Install`, `Done`.
- Welcome's body: `BRIMM Video Studio takes in a video, reads it, and makes it ready to edit in HyperFrames.`; `Setup puts on this Mac: a transcription model (about 1.6 GB), the HyperFrames tools, and a background job that watches one folder for new videos.`; `It takes about ten minutes, most of it the download.`; `Nothing is ever posted, sent or published by BRIMM Video Studio.`
- The name's body: `Each Mac that runs BRIMM Video Studio has its own name, so its videos can be told apart.`
- The apps' body: `BRIMM Video Studio works with these apps. Install the ones that are missing, then continue.`
- Dropbox's body, one folder: `BRIMM Video is at <folderWords(root, home)>.` Several: `More than one BRIMM Video folder is on this Mac. Choose the one to use.` None: `NO_BRIMM_VIDEO`'s three lines.
- The folders' body: `The drop folder is where you put a video for BRIMM Video Studio to take in.`; `The exports folder is where HyperFrames saves a finished video, and where BRIMM Video Studio looks for it.`
- The permissions' body: `BRIMM Video Studio looks in three folders: the drop folder, the Episodes folder in BRIMM Video, and the exports folder.`; `If macOS asks whether "BRIMM Video Studio" may look in a folder, choose Allow.`
- The review's body: `This is what Install will do. Nothing has been changed yet.`
- The install's body: `Setting up this Mac. The download is the longest part: leave this window open.`
- Done's body: `BRIMM Video Studio is set up on this Mac.`, or `BRIMM Video Studio was repaired on this Mac.`, or `BRIMM Video Studio was updated on this Mac.`
- `arguments`: `BRIMM Video Studio's setup was started in a way it does not know.`
- `protocol`: `BRIMM Video Studio's window and its setup did not understand each other.`, with the advice `Close BRIMM Video Studio and open it again.`
- `no-settings`: `BRIMM Video Studio is not set up on this Mac yet, so there is nothing to repair or update. Set it up first.`
- `settings`: `This Mac's BRIMM Video settings cannot be read, so setup stopped and changed nothing.`
- `dev`: `DEV_REFUSAL`. `damaged`: `DAMAGED`. `busy`: Task 10's line.
- `install`, exit 1: `BRIMM Video Studio could not be set up on this Mac.`, with the advice `REPAIR`. Exit 2: `Setup was refused, and nothing was changed.`
- `download`: the stage's own message, with the advice `Check this Mac's internet connection, then open BRIMM Video Studio and choose Repair.`
- `engine`: `BRIMM Video Studio's setup stopped on a fault of its own.`
- The notes. Claude did not answer: `Claude did not answer from the background job. Open BRIMM Video Studio and choose Repair.` Apps: `Still to install: <names>.` An update: `Start a new chat in Claude so it reads this version.` A takeover: `The older copy of BRIMM Video Studio on this Mac is no longer used, and was left as it is.` A place that was refused and passed over: `BRIMM Video Studio is not yet allowed to look in <folderWords(folder, home)>. Allow it in System Settings, under Privacy & Security, then Files and Folders.` A place that could not be looked in: `BRIMM Video Studio could not look in <folderWords(folder, home)>.`
- A cancel's notes. Claude Code was installed at the Apps step: `Claude Code was installed on this Mac during setup, and stays.` A cancel during staging: `What setup had already put on this Mac stays, and the next run uses it.`

**The rules:**
- `main` takes its arguments from `process.argv.slice(2)`, its home from `HOME`, and its checkout from its own place: the folder that holds `tool`. Its programs are absolute paths: `/bin/launchctl`, `/usr/sbin/scutil`, `/usr/bin/curl`, `/usr/bin/codesign`, `/usr/bin/script`, and the installer `["/bin/zsh", "<checkout>/tool/install.sh"]`. It sets the exit code `runSetup` gives.
- The start, in this order, before any step: `argsOf` (a fault ends with `error`, code `arguments` or `protocol`, and exit 2); `kindOf` (`unusable` ends with `error`, `settings`; `dev` ends with `error`, `dev`; a fresh Mac with a repair or an update ends with `error`, `no-settings`); then, for a setup, a repair or an update, `copyFault` with `deep` false, which ends with `error`, `damaged`, the why in `details`. Each of these runs nothing else and changes nothing. Every `error` carries `contact` when `buildOf(checkout).support` is not empty.
- `--run status`: `statusSummary`, then `done` with outcome `status`, the status's text as `summary`, `guide: null` and no notes. It starts no program and asks nothing (Decided 15).
- A setup's steps are the table's, "Which run, on which Mac". Each `step` carries its `n` and its `of`, counted over the steps this run shows. A step that asks nothing is passed over in the direction the run is going: forward after an answer, further back after a `back`.
- The name (a fresh Mac): `nameQuestion`, suggested by `nameSuggestion`. The clash is checked at this step when `brimmVideoFolders(home)` finds exactly one folder. Otherwise it is checked once the Dropbox step settles the folder, and a clash brings the `name` step and its question again with the warning, once (Decided 25).
- The apps: `appsQuestion`, with `appsHere({ home, system: applications })` and `claudeState`. `check` looks again and sends the question again. `install-claude-code` runs `installClaudeCode`, whose `say` lines are shown by sending the question again with `working`; its failure is the question's `fault`, and the run goes on (Decided 30). `sign-in` runs `signIn`, whose `ask` sends the `sign-in` question and waits; when it ends, `claudeState` is read again and the apps question is sent again, with `signIn`'s fault when it gave one. `continue` goes through `read`, which refuses it while Claude Code is not signed in.
- Dropbox (a fresh Mac): the step is always sent. Exactly one folder asks nothing, and the body says which. `look-again` searches again.
- The folders (a fresh Mac): `drop-folder`, suggested `defaultDropFolder(home)`, then `exports-folder`, suggested `downloadsFolder(home)`.
- The permissions: `look(place, folder, { home })` at the drop folder (`drop`), at `episodesFolder(root)` (`episodes`) and at the exports folder (`downloads`). A place that is `refused` is asked about with `permissionQuestion`: `again` looks again, and `skip` goes on with a note. `locked` and `error` give a note and no question. `missing` gives nothing, since the installer makes the folder (Decided 33). The engine uses only whether a look gave names, never the names.
- The review: `planOf`, then `runInstaller` with `installerArgs(answers, { app, tools, print: true })`, then `reviewSummary`, with `here` as `{ model: whether modelPath(home) is there, cli: toolchainDiffers(toolchainHolds(home)) === "" }`, then `reviewQuestion(ok)`. `again` runs both again. Install starts only on the `confirm`'s `true`.
- The install's parts, in order, each with its `LABELS` label: `programs` (`copyFault` with `deep` true, whose fault ends with `error`, `damaged`); `model`, `hyperframes` and `chrome` (`stages.model`, `stages.cli` and `stages.chrome`, each given `progress` and one `AbortController`'s `signal`); `installer` (`checkLogMark`, then `installWhenIdle` with `installerArgs(answers, { app, tools })`, then `done` or `failed` by `installerOutcome`); `claude` (`checkLogSays` with the mark taken before: `done` when Claude answered, `failed` when not). The engine sends `running` for `programs`, `installer` and `claude` as each starts, and its last state as it ends; a stage sends its own.
- Done: `writeGuide`, then `summary`, id `setup`, then `done`. The settings shown are the review's plan's on a setup and the Mac's own on a repair or an update: the engine does not read the settings file back (Decided 32). `done.studio` is `studioFolder(home)`, `done.summary` is `summaryText` of the setup summary, and `done.guide` is `writeGuide`'s.
- A repair or an update asks nothing: `step` install (1 of 2), the parts, `step` done (2 of 2). Its answers are `{ kind: "held", machine, root }` from the settings. It reads `claudeState` and `appsHere` once, for the summary. The outcome is `repaired` or `updated`; a setup's is `installed` on every kind of Mac.
- Claude that did not answer from the background job fails the `claude` part, and the run is still `done`, with the note above.
- The installer's exit 1 ends with `error`, `install`, its text in `details`. Exit 2 ends with `error`, `install`, the second message, its text in `details`. A stage that rejects with `code: "download"` ends with `error`, `download`, and the installer never runs. `installWhenIdle`'s `busy` ends with `error`, `busy`. Anything the engine did not expect ends with `error`, `engine`, with the fault's name and code in `details` and its stack on stderr only.
- One reader reads stdin for the whole run. A line with `lineFault`, or an answer with `answerFault`, ends with `error`, `protocol`. A value `read` refuses brings the same question again with `fault`. A warning is given once: the same value again is taken (Decided 26).
- An answer that comes while no question is open, or to an id that was asked earlier in this run and has since been replaced, is dropped (Decided 18). An answer to an id never asked ends with `error`, `protocol`.
- `back` goes to the nearest earlier step that asked something in this run, and that step's question is sent again with the answer it had as its suggestion (Decided 23). At either folders question it goes to the step before the folders. At the first question of the run it sends that question again. While the `sign-in` question is open it ends `claude auth login` and brings the apps question again. Once Install has started it is dropped.
- A cancel, or stdin closing, before Install: `done` with outcome `cancelled`, `summary` `""`, `guide: null`, and the note of what the Apps step installed, when it installed something. While the `sign-in` question is open it ends `claude auth login` first. During a stage it aborts the signal, waits for the stage to end, and ends `done`, `cancelled`, with the staging note. From the moment `installWhenIdle` is called it is remembered and answered when that part ends, with the run's own outcome: the `done` or the `error` it would have been (Decided 13, 38).
- No event names an episode's folder, and no event and no line on stderr holds a pasted sign-in code, Claude Code's email address or its organisation.
- The harness's `drive` gives `runSetup` three stand-in stages, each of which sends `running` and then `done` through `progress` and writes nothing, unless the test gives its own `stages` (Decided 37). The real stages are Task 8's to test: a test of the engine never downloads and never calls npm.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-engine.test.js`, and give `drive` its `stages`.
  - "a fresh Mac: nine steps in order, and the installer gets the answers": `installCalls(m.ran())` is a `--print` call and then a `--yes` call, each with the name, the tools, the app, both folders and the root; the guide's `.html` is there.
  - "a takeover: nothing is asked of the name or the folders, and the settings' own go to the installer": six steps; each call has `--machine`, `Studio Test` and the root, and no `--drop-folder`.
  - "a repair: no question, the parts in order, and outcome repaired"; "an update: as a repair, with outcome updated and the new-chat note".
  - "a repair on a fresh Mac ends with error no-settings, and nothing ran"; "a dev Mac: every run ends with error dev, and nothing ran": each of the four runs; `m.ran()` is empty and `settingsOf(m.home)` is as it was.
  - "settings that cannot be read: error settings, with the support contact, and the file is as it was"; "a damaged copy: error damaged with install.sh's own words, before any question": `ffmpeg` taken out of the tools; `DAMAGED` is in `install.sh`'s text too.
  - "status: a summary and done, and nothing ran but the reads": `m.ran()` is empty and `settingsOf(m.home)` is unchanged, on each of `none`, `takeover`, `installed` and `moved`.
  - "back from the apps returns to the name, with the answer kept as the suggestion"; "back from the folders passes over a Dropbox step that asked nothing".
  - "a cancel before Install: done cancelled, and the installer never ran"; "stdin closing counts as a cancel".
  - "a cancel while a stage runs stops it, and ends done cancelled": a model stage of the test's own that waits on `signal`.
  - "a cancel while the installer runs is answered after it ends": the test makes `dir/hold` when it answers the review, so the `--print` run is not held; it sends the cancel on the `installer` part's `running` event and then takes `dir/hold` away; the outcome is `installed`.
  - "an answer to a question since replaced is dropped, and an answer to an id never asked is error protocol".
  - "the name's warning is given once, and the same name again is taken"; "a name that clashes only once BRIMM Video is found brings the name step again, once": a home with two BRIMM Video folders.
  - "continue is refused while Claude Code is not signed in, and taken once it is": `claude: "signed-out"`; the test writes `says/claude-status` as signed in when it answers the `sign-in` question.
  - "a failed Claude Code install comes back as the apps question's fault, and the run goes on": `claude: "none"`, and a `tool/claude-code.pin.json` of the test's own in the app's copy whose SHA-256 the stand-in `curl`'s bytes do not match.
  - "a place this Mac refuses is asked about, and a missing one is passed over": a `look` of the test's own.
  - "a review that is not ok offers no Install": `exits/installer` of 2; the question is a `choice` with `Check again`.
  - "a failed download ends with error download, and the installer never ran": a model stage of the test's own that rejects with `code: "download"`; no `--yes` call.
  - "the installer's exit 1 ends with error install and its text in details": the test writes `exits/installer` as 1 when it answers the review, so the `--print` run ends with 0 and the `--yes` run with 1.
  - "Claude that did not answer from the background job: the part fails, the run is still done, and a note says so": `says/check-log` of `Claude could not be asked from here: no answer.`
  - "no event of a whole run holds an episode folder's name": the fresh run's and the takeover's events, as text, hold no `Client Jane`.
  - "no event and no stderr of a whole run holds the pasted code, the email or the organisation": a run that signs in with the code `PASTED-CODE-123`.
  - "every event of every run above passes eventFault".
  - "the engine as a program: bad arguments give one error line on stdout and exit 2": `process.execPath` runs this checkout's `tool/setup/engine.js` with `--run nonsense` and a home of the test's own.
  - "a wrong protocol number is error protocol, exit 2": `drive`'s `argv`.
- [ ] **Step 2: Run `cd tool && node --test tests/setup-engine.test.js`.** Expected: FAIL, since `tool/setup/engine.js` is not there.
- [ ] **Step 3: Write the code** to the lines and rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/setup-engine.test.js tests/setup-checks.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/setup/engine.js tool/tests/setup-engine.test.js tool/tests/setup-harness.js`, then `git commit -m "Studio app phase 5: the setup engine's run, from the first step to done"`.

---

### Final check

- [ ] Run `cd tool && node --test`. Every test passes, with `contract.test.js`'s hashes unchanged.
- [ ] Run `git diff 6636327 --stat -- tool/shared tool/lib.js tool/run.js tool/guide.js tool/guide-note.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures`. Expected: nothing.
- [ ] Run `git diff 6636327 --stat -- tool/install.sh`. Expected: nothing.
- [ ] Run `node tool/tests/unused-exports.mjs`. Every export of `tool/setup/` it lists is one this plan names under "Produces": a test's seam, or the shell's contract in `protocol.js`. Its last line is `Imports of files that are not there: 0`.
- [ ] Run `grep -rnwi -e node -e terminal tool/setup`. Every line it shows is code or a comment, never words a person reads.
- [ ] Run `git status --short`. Nothing is left over, and no file outside `tool/` and `docs/` was touched.

## Decided

Jason, 2026-11-09:
1. The Mac app's build plan stands: one pull request for each phase, a task plan for each phase, built by subagent-driven development, and a push, a pull request or a merge only on his yes. For this plan: "Yes, write it" (9 November), then "Yes, amend and build" (10 November), which accepts the recommendations under Open for Jason; the by-hand steps in 1 and 4 still wait for his yes.
2. The support contact is `admin@growwiththebrimm.com` and the update address is `updates.thebrimminsights.com`. The engine reads the contact from `build.json` and never spells it itself.
3. Every agent in this build ran on Fable 5.2 until 10 November 2026. Since then Jason picks the main chat's model, and each agent goes to the cheapest model that fits its task: "change models in order to save tokens. I will select the model for the main chat; delegate to cheaper models for appropriate sub tasks and sessions".

Claude's rulings, 2026-11-09:
4. The shell says which run it wants, and the engine works out which kind of Mac this is. The shell never reads the settings.
5. The dev refusal sits in `planned`, so `settings.js plan` and `settings.js write` both refuse an app's copy on a marked Mac, and `install.sh` is unchanged. This is the one change to code that already runs on both Macs: review it first.
6. The mark is never set by a program. It is one by-hand command, on Jason's yes.
7. Settings that cannot be read are never overwritten: every run ends with `error`, `settings`, and the file is as it was.
8. Claude Code is installed and signed in at the Apps step, before the Review, since `install.sh --print` ends with 0 without it.
9. The Apps step's continue: Claude Code, new enough and signed in, and Dropbox are required. A missing Claude app or HyperFrames app is a warning, given once.
10. Chrome comes through the pinned CLI's own `browser ensure`. Studio keeps no pin of its own for it.
11. A takeover leaves the old clone and its deploy key where they are. The setup summary names the old copy as no longer used.
12. The sign-in runs `claude auth login` under `/usr/bin/script`, so it has a terminal. If S5 shows that this does not work from the app's node, the Swift shell runs the terminal and the engine only asks `claude auth status --json`.
13. The installer is never interrupted. A cancel is answered after it ends, with the run's own outcome.
14. A busy Mac is waited for five times, 30 seconds apart, and then the run ends with `error`, `busy`.
15. `--run status` never asks codesign, starts no program and asks nothing, so the shell may ask it whenever it opens.
16. `protocol.js` is one file more than the build plan's row: the events' shapes are checked in one place, by the engine before it writes and by the tests.
17. The guide's fonts are held in the page itself, about 250 KB in all, so the page and its PDF look the same on a Mac that has neither font.
18. An answer to a question the engine has since replaced is dropped, since the shell's timer can be a moment late. An answer to an id never asked is a fault.
19. `install.sh`'s Terminal words stay under Details, where its whole text goes, and so do the plan's refusal words and the check log's own line. This answers Phase 4's Decided 9 until S5 passes.
20. A `:` in `--tools` is refused by `argsOf`, since the folder goes into a PATH.
21. The new-node notice is never given or posted on an installed Mac, since Phase 3. PR #58 took their unused `installed` option away, and this phase does not touch them.
22. Which of two copies of the app wins is Phase 6's. The engine sets up the copy it was started from.
23. `back` goes to the step before that asked something. From an open sign-in it ends the sign-in and returns to the Apps question.
24. The permission question words its place itself, with `folderWords`, not with `accessLine`, whose words are for a Mac that is already set up.
25. The name's clash is checked at the name step when one BRIMM Video is already found, and otherwise once the Dropbox step settles it, which brings the name step again, once.
26. A warning is given once, and the same value again is taken. This is the engine's rule: `read` stays pure.
27. BRIMM Video is picked from what the search finds, never by hand, so the `folder` question's purposes are only `drop` and `exports`.
28. A drop folder that another Mac has marked is refused at the Review, by `install.sh --print`, not at the Folders step: `dropFolderFault` lets it pass, and the installer's own words say why.
29. The exports folder gets no warning for a cloud folder, since `exportsFolderFault` allows one.
30. A failed Claude Code install at the Apps step is the question's fault, not the run's end: the person can try again or install it another way.
31. The review's facts come from `settings.js plan`'s JSON and from node functions, never from `install.sh`'s text. The text decides only `ok`, by its exit code, and is shown under Details.
32. After the installer the engine shows the plan's settings, or the Mac's own on a repair, and does not read the settings file back.
33. A folder that is missing at the Permissions step is passed over, since the installer makes it (`install.sh`, 1209).
34. `appsQuestion`'s `working` line shows Claude Code's install: the engine sends the apps question again for each line.
35. The engine looks for apps in an `applications` folder it is given, so no test looks in this Mac's own Applications folder.
36. The review's plan is Studio's own `settings.js`, run by the engine's own node, in tests too. It is not a system program, it asks plutil only of a launch agent's file that is there, and it runs on CI's Linux as the settings tests do.
37. The engine is given its three stages, so its tests never download and never call npm. The real stages are Task 8's to test.
38. A cancel that comes while the engine waits for a busy Mac is answered when the installer's part ends, at most two and a half minutes later: `installWhenIdle` takes no signal, so the wait and the installer are one part.
39. "Choose Repair" is the app's one way back in after a fault. On a Mac with no settings a repair ends with `error`, `no-settings`, so Phase 6's shell asks `--run status` first and starts a setup when `needs` is `setup`, whatever the person chose.
40. Task 3 is dropped: PR #58 did its work, with `lookerOf` and a `name` option in place of this plan's `LOOKER_APP` and `installed` flag. The plan was moved onto main after #58 (10 November), and its line numbers with it.

## Open for Jason

1. How Claude Code is installed, and whether it is pinned. Recommended: a pin for the first install only, in a new `tool/claude-code.pin.json` (the version, that version's macOS build address, and its SHA-256), added by a by-hand check on your yes. Claude Code updates itself afterwards, and a script fetched from the network is never run. Until the pin is there, the Apps step shows Claude Code with no install button. The build address, the published checksum and the binary's `install` step are not verified yet.
2. Chrome has no pin of Studio's. Recommended: leave it to the pinned CLI's own `browser ensure`, and correct the spec's "each pinned".
3. On a takeover, the old clone and its deploy key. Recommended: the app leaves both and names the old copy in the setup summary. You remove them by hand, and revoke the key in GitHub, when you choose.
4. The Mac Studio's `"mode": "dev"` mark. Recommended: `node tool/settings.js set --mode dev`, as a check on the By-Hand Checks page, on your yes, before any copy of the app is opened on the Mac Studio.
5. Which apps are required. Recommended: Claude Code, signed in, and Dropbox are required. A missing Claude app or HyperFrames app is a warning, and goes on the guide's list of what is still to install.
6. The bundle ID. Recommended: it stays Phase 6's. The engine reads the app's own Info.plist and never spells `com.thebrimm.video-studio`.
