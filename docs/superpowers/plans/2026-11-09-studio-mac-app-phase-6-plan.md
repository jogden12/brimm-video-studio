# Phase 6: the app and its build (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BRIMM Video Studio.app exists as a thing that can be built: a thin Swift shell that draws the setup engine's events in a window, runs as the background job with `--agent`, answers `brimm-video-studio://check-for-updates`, moves itself out of a quarantine location, repairs itself after it is moved, uninstalls the background job, and turns the Getting Started guide into a PDF. `build-app.sh` makes the bundle from one commit and a folder of pinned, vendored programs, signs it inside-out and prints the notarizing steps.

**Architecture:** Everything is in a new `tool/studio-app/`, which is the build's own and is never put in the bundle. The Swift sources are compiled with `swiftc` from the Command Line Tools, with no Xcode project and no packages. Every decision the shell makes that can be wrong quietly (splitting the engine's lines, the engine's and the agent's command lines, the value each answer sends, which screen comes next, when quitting is allowed, the move, Uninstall) is in files that import only Foundation. A small command-line checker, `studio-check`, is compiled from those same files by the tests and asked for each answer, so the Swift is tested from `node --test` without a window. The windows themselves (SwiftUI in one AppKit window) draw by a question's `kind`, never by its `id`, and are checked by hand with a stand-in engine that a build option puts in place of the real one. The build's JSON work (`build.json`, `Info.plist`, the vendor pins and their seal) is in two small Node files that run on any computer.

**Tech Stack:** Swift (language mode 5, macOS 13 APIs, SwiftUI, AppKit, WebKit, PDFKit in the checker), compiled by `swiftc`. zsh for the two build scripts. Node 22 or later, ES modules, `node:test`, no packages. `plutil`, `ditto`, `file`, `tar`, `git` on macOS.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, part 1 (the app), part 2 (the assistant's window and the PDF), part 3 (the shell is thin), part 4 (`--agent`), and part 5's `edit.js update` line. The build plan's row and its "Verification": `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`, Phase 6. The engine this shell drives: `docs/superpowers/plans/2026-11-09-studio-mac-app-phase-5-plan.md`, "The protocol between the shell and the engine (version 1)" and "Decided" 4, 13, 15, 18, 22 and 39. The spikes: `spikes/2026-11-09-studio-mac-app/` (read `README.md`, then the script each task names).

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end.
- **The tasks are built in order, one at a time.** Several add cases to `Check/main.swift` and tests to the same test file, and each leans on the files before it.
- Node 22 or later, and no packages. No Xcode project, no Swift package, no macro (`@Observable`, `#Preview`): the Mac Studio has the Command Line Tools and no Xcode. Only macOS 13 APIs.
- Every compile of this phase's Swift uses `swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path <folder>`. The tests share one cache folder (Task 4), since a cold cache adds about 24 seconds to a compile. A typecheck swaps `-O` for `-typecheck`.
- **Nothing is installed, signed with the Developer ID, sent to Apple or loaded into launchd by a test or by Claude.** Tests reach `codesign`, `security`, `xcrun`, `curl` and `launchctl` only as stand-ins that write `name args` into a `ran` file. `build-app.sh` and `build-vendor.sh` are run by Claude only with `--print` or inside a test. A real build, a vendor build, notarizing and opening the app on a Mac are by-hand checks, each on Jason's yes.
- **The installer is only ever run with `--print`**, by a test or by hand. No test runs the real `install.sh --remove` or `install.sh --yes`.
- No test writes outside a folder made for it. A test's home is a new folder, never this Mac's home, and never a drop folder. Neither build script writes into a watched folder, a drop folder or Dropbox (`refuse_watched`, Task 3).
- **`install.sh`, `tool/setup/protocol.js` and the protocol are not changed.** The protocol stays version 1 with its six events. The one change under `tool/setup/` is Task 10's lines in `summary.js`.
- **The shell never reads the settings** (Phase 5, Decided 4). It learns what this Mac needs from `--run status`.
- **A pasted sign-in code is never kept or shown again**: not in a log, not in an error's words, not in the checker's output. Claude Code's email address and organisation are never shown. The app's sources never log: no `print(`, `NSLog`, `os_log`, `Logger(` or `dump(` in `Sources/`.
- **The Sparkle EdDSA private key, the notary profile's password and the signing identity's key never appear** in a file, a script's output or chat. The scripts find the identity by name in the keychain, as `tool/move-app/build-app.sh` does.
- Never read a `.env` file. The build never copies one into the bundle and the test only lists names.
- A download is data until its SHA-256 is the pin's. Nothing fetched is unpacked or run before that.
- The labels stay `com.thebrimm.unedited` and `com.thebrimm.claude-check`.
- **The BRIMM Ops contract.** Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes. `build.json`'s `short` stays a git short commit, since `madeBy` is made from it.
- Words a person reads say "BRIMM Video Studio", never "node", "Terminal" or "engine". The engine's own sentences are shown as they come. The shell's own sentences are given in full in this plan: use them exactly.
- Comments are plain, full-sentence English, as in the rest of `tool/`.
- Tests that need a Mac, the Command Line Tools or a window server skip themselves elsewhere and say why. No test runs `swiftc` to find out whether it is there: on a Mac without the tools that opens macOS's install dialog. They ask `hasXcodeTools()` (`tool/helpers.js`).
- The repo is public: no account label, no private path, no client's name and no team ID in a committed file.
- The line numbers are as of 268d10c, main after PR #64. Find each one by the grep given.

## What the shell and the engine say to each other

The Phase 5 plan's protocol section is the contract, and `tool/setup/protocol.js` checks it. What this phase adds is only the shell's side:

- **The command.** `<app>/Contents/Resources/node/bin/node <app>/Contents/Resources/Studio/tool/setup/engine.js --run <run> --app <app> --tools <app>/Contents/Resources/node/bin --protocol 1`. The engine finds its checkout from its own file, so it is always started from inside the bundle.
- **The environment** is built from scratch: `HOME`; `USER`, `LOGNAME` and `TMPDIR` when the app has them; `LANG=en_US.UTF-8`; `PATH=<tools>:/usr/bin:/bin:/usr/sbin:/sbin`. Nothing else, so a stray `NODE_OPTIONS` never reaches node.
- **Reading.** stdout is split at `\n` only (a `\r` before it is dropped). Swift's `FileHandle.bytes.lines` is never used: it also splits at U+2028, U+2029 and U+0085, which the engine writes inside strings as escapes but a folder's name may one day carry.
- **Writing.** One JSON object and `\n` per answer. stdin stays open for the whole run, since closing it is a cancel.
- **The end.** A `done` or an `error` event is the last line. A process that ends without one is shown with the engine's own last-resort words: `BRIMM Video Studio's setup stopped on a fault of its own.` and `Open BRIMM Video Studio and choose Repair.`
- **Runs.** The shell starts `status`, `setup` and `repair`. It never starts `update`: that is Phase 7's, after Sparkle has put a new copy in place.
- **Every launch** asks `--run status` first (Decided 15 and 39). What comes next is one pure function, `nextFromStatus` (Task 7).

## What this phase assumes

Each assumption has one named place to change.

- **SwiftUI compiles with the Command Line Tools alone.** Checked on the Mac Studio on 11 November 2026: `ObservableObject`, `NSHostingController` and an AppKit `main.swift` compile together with the flags above, and a set of files with no `main.swift` typechecks. The one place: Task 13's typecheck test.
- **The guide prints to a PDF from a window that is never shown.** Probed on the Mac Studio on 11 November 2026: `printOperation(with:)` run with `runModal(for:delegate:didRun:contextInfo:)` on an unshown `NSWindow` that holds the web view gives the real guide as three Letter pages, with the page's own margins. Run with `run()` it never returns and writes to the file without end. The one place: `makePDF` in `GuidePDF.swift` (Task 9).
- **A background job that forwards TERM ends with node's status.** Probed the same day with a command-line program: `Process`, signal sources and `waitUntilExit` on the main thread give exit 9 from a child that traps TERM, and 137 for a killed child. The one place: `runAgent` (Task 5).
- **S3 and S4 hold for the real bundle**: node signed with its three entitlements and everything else with the hardened runtime alone passes notarizing, and the prompts and Login Items name the app when its `--agent` starts node as a child. The spikes signed node and the agent in separate apps. The one place: `build-app.sh`'s signing list (Task 15) and by-hand checks 4 to 6.
- **A copy that the app makes of itself opens untranslocated once its quarantine flag is taken off.** `ditto` keeps the flag and `xattr -dr com.apple.quarantine` takes it off (probed). The app has by then passed Gatekeeper and the person has opened it. The one place: `moveApp` in `Mover.swift` (Task 12) and by-hand check 5.
- **The bundle ID is `com.thebrimm.video-studio`**, the value every Phase 4 and 5 test already uses. The one place: `BUNDLE_ID` in `build-info.js` (Open for Jason, 1).

## Where the spec and the code disagree

Each is settled here for this phase. The spec is corrected with the phase's pull request, not in a task.

1. **Sparkle "in the bundle".** The build plan puts Sparkle in Phase 7. No Phase 6 build reaches a Mac that is not a test account (the rollout is Phase 8), so the first build that ships has Sparkle anyway. Phase 6 declares the URL scheme and has the menu item `Check for Updates…`; choosing it says `Updates are not part of this build yet.`
2. **`git archive` of `tool/` "without tests or move-app".** The bundle also leaves out `tool/studio-app/`: the build's own sources have no use on a person's Mac.
3. **`vendor.pin.json`** is only a name in the build plan. Task 2 defines it. `build-app.sh` does not compile ffmpeg or whisper: `build-vendor.sh` (Task 3) makes them once into a sealed folder, and the build refuses a folder whose seal does not hold.
4. **The PDF "with `WKWebView.createPDF`".** `createPDF` gives one sheet as tall as the page (612 by 3,180 points in the probe) and does not paginate, and the guide is laid out for `@page` Letter. The shell prints the page to a file instead.
5. **"/Applications, or ~/Applications for a user who isn't an admin."** The shell asks whether `/Applications` can be written to, which is what being an admin gives.
6. **"Compares its own path with `settings.checkout`."** The shell never reads the settings. `--run status` says `needs: "repair"` for a moved copy.
7. **"Repairs if they differ" and two copies.** If a copy of the app is still in the other Applications folder, the app may not have been moved: there may be two copies. The shell then asks instead of repairing, or two copies would take the Mac from each other at every launch (Phase 5, Decided 22).
8. **"Status, settings."** `--run status` gives the Mac's name, the version and one line. Task 10 adds the folders. The window shows them and changes none: a folder is changed by asking Claude, as today.
9. **Uninstall** is not one of the engine's four runs. The shell asks `busy.js idle-why`, then runs `install.sh --remove`, which needs neither `--tools` nor `--app`.
10. **The version.** `build.json` holds the whole semver (`1.0.0-beta.1`). `CFBundleShortVersionString` takes only numbers, so it holds the part before the hyphen, and `CFBundleVersion` holds the build number.
11. **"Open your BRIMM Video Studio folder in Claude."** No link that opens a folder in the Claude app's Code tab is known. The button opens the Claude app, and the guide says the rest (Open for Jason, 6).
12. **`tests/app-copy.js`** copies `tool/` without `tests` but with `move-app`, so it is looser than the real bundle. Task 15's test compares the real build with it for the layout and the programs, not for `tool/`'s listing.
13. **`tool/claude-code.pin.json` is still not there** (Phase 5, Open for Jason 1), so the Install Claude Code button never shows, and a Mac without Claude Code stops at Apps. Nothing here changes that.
14. **`docs/memory/progress.md`'s "carried forward for the Mac app" line is stale.** The DAMAGED advice, the retry cap, the npm notifier, the docker line and the one launchctl parser were done in Phase 5. This phase owns `whisper-cli`'s name and the zip flags. `install.sh` still has no check for a `:` in `--tools`: the engine refuses it, and the shell never builds such a path (Task 4).

## Review Focus

1. **The bundle holds what it must and nothing else.** Covered in Task 15: "the bundle holds Studio's tool without tests, move-app, studio-app or a .env, and the programs appCopy names" and "the bundle's own Studio loads, and its engine answers a status".
2. **Signing is inside-out and never `--deep`.** Covered in Task 15: "every program inside is signed before the app, node alone with its entitlements, and --deep is only on the verify".
3. **Nothing is sent to Apple by the build.** Covered in Task 15: "the notarizing lines are printed and none is run".
4. **`--print` changes nothing.** Covered in Task 15: "--print writes nothing and starts no compiler". Covered in Task 3: "--print fetches nothing and makes no folder".
5. **The background job ends when launchd says so, and its status is node's.** Covered in Task 5: "a TERM sent to the agent reaches node, and the agent ends with node's status".
6. **A line is never split inside an event, and none is lost at the end.** Covered in Task 4: "a line ends only at a line feed: U+2028, U+2029 and U+0085 stay inside it". Covered in Task 8: "every line comes before the end, however fast the engine ends".
7. **Quitting never stops the installer.** Covered in Task 7: "while the installer may be running, quitting waits".
8. **The Mac Studio is offered nothing.** Covered in Task 7: "what follows the real engine's status, for each kind of Mac" (the dev Mac is `refused`) and "a refused Mac is offered nothing".
9. **Two copies never take the Mac from each other.** Covered in Task 4: "a moved copy is repaired, and a second copy is asked about".
10. **A translocated copy never starts a setup.** Covered in Task 4: "a translocated copy moves first, whatever the status".
11. **A vendor folder built from other pins is refused.** Covered in Task 2: "a folder sealed under other pins is refused, and so is a changed file".
12. **The pasted code is never kept.** Covered in Task 8: "a pasted code reaches the engine and is nowhere in what the client says". Covered in Task 13: "the app's sources never log".
13. **The shell understands every event, and sends only answers the engine can read.** Covered in Task 6: "every event of a whole fresh setup by the real engine is understood". Covered in Task 11: "the shell understands every line of every scenario". Covered in Task 7: "each kind's answer is one the engine can read".
14. **A stand-in build can stop nothing real.** Covered in Task 12: "a stand-in build's Uninstall starts no program". Covered in Task 15: "--fake-engine leaves only the stand-in in the bundle's tool".
15. **Uninstall never stops a video that is being taken in.** Covered in Task 12: "a Mac at work is told so, and nothing is stopped".
16. **A build never writes into a watched folder.** Covered in Task 3: "a folder the launch agent watches, the drop folder or Dropbox is refused".

## Files

| File | What it is |
| --- | --- |
| `tool/studio-app/build-info.js` (new) | The app's names, `build.json`'s text and `Info.plist`'s text. |
| `tool/studio-app/vendor.pin.json`, `vendor.js` (new) | What is vendored and from where; the seal of a vendor folder and its check. |
| `tool/studio-app/common.zsh`, `build-vendor.sh` (new) | Fetches the pinned sources, builds ffmpeg, ffprobe and whisper-cli, unpacks node, seals the folder, makes the GPL source zip. |
| `tool/studio-app/Sources/Core.swift` (new) | Foundation only: lines, command lines, paths, which screen is next. |
| `tool/studio-app/Sources/State.swift` (new) | Foundation only: the events, and the window's state made from them. |
| `tool/studio-app/Sources/Flow.swift` (new) | Foundation only: the value each answer sends, what follows a status, the apps timer, quitting, what the status window offers. |
| `tool/studio-app/Sources/Agent.swift` (new) | Foundation only: `--agent`. |
| `tool/studio-app/Sources/EngineClient.swift` (new) | Foundation only: starts the engine, reads its events, sends answers. |
| `tool/studio-app/Sources/GuidePDF.swift` (new) | The guide's HTML to a PDF. |
| `tool/studio-app/Sources/Mover.swift`, `Uninstall.swift` (new) | Foundation only: the move to Applications, and stopping the background job. |
| `tool/studio-app/Sources/AppModel.swift` (new) | What the windows show and do. |
| `tool/studio-app/Sources/SetupViews.swift`, `StatusViews.swift`, `AppDelegate.swift`, `main.swift` (new) | The window, the menu, the URL scheme, quitting. |
| `tool/studio-app/Check/main.swift` (new) | `studio-check`, the tests' way into the Swift. |
| `tool/studio-app/dev/fake-engine.mjs` (new) | A stand-in engine for looking at the windows. |
| `tool/studio-app/node.entitlements`, `build-app.sh`, `README.md` (new) | The build. |
| `tool/setup/summary.js` | The status says the folders too. |
| `tool/tests/studio-app-check.js` (new, not a test) | Compiles `studio-check` once and asks it. |
| `tool/tests/no-xcode-tools.test.js`, `load-each.test.js` | `studio-app` is skipped by the first and its two `.js` files are loaded by the second. |
| Tests | New: `studio-app-build-info.test.js`, `studio-app-vendor.test.js`, `studio-app-core.test.js`, `studio-app-agent.test.js`, `studio-app-state.test.js`, `studio-app-engine.test.js`, `studio-app-pdf.test.js`, `studio-app-fake-engine.test.js`, `studio-app-model.test.js`, `studio-app-build.test.js`. Changed: `setup-summary.test.js`. |

---

### Task 1: `build-info.js`: the app's names, `build.json` and `Info.plist`

**Files:**
- Create: `tool/studio-app/build-info.js`
- Modify: `tool/tests/no-xcode-tools.test.js` (`grep -n 'const SKIPPED' tool/tests/no-xcode-tools.test.js`: 30), `tool/tests/load-each.test.js`
- Test: `tool/tests/studio-app-build-info.test.js`

**Interfaces:**
- Consumes: `VERSION`, `buildOf` (`tool/build.js`); `isMain` (`tool/is-main.js`); `CHECK_FOR_UPDATES_URL` (`tool/edit.js`, in the test only).
- Produces:
  - `APP_NAME = "BRIMM Video Studio"`; `BUNDLE_ID = "com.thebrimm.video-studio"`; `URL_SCHEME = "brimm-video-studio"`; `FEED = "https://updates.thebrimminsights.com/appcast.xml"`; `SUPPORT = "admin@growwiththebrimm.com"`; `MIN_MACOS = "13.0"`.
  - `buildJson({ version, build, commit, channel }) -> { text } | { fault }`. `text` is the file's whole text, with a line feed at its end.
  - `infoPlist({ version, build, icon }) -> string`, the file's whole text.
  - The command line: `node build-info.js json --version <v> --build <n> --commit <40 hex> --channel <stable|beta>` and `node build-info.js plist --version <v> --build <n> [--icon]`. Each prints the text and ends with 0, or says the fault on stderr and ends with 2.

**The rules:**
- `buildJson`: `version` matches `VERSION`; `build` is a whole number above 0; `commit` is 40 hex; `channel` is `stable` or `beta`. The object's keys, in order: `version`, `build`, `commit`, `short` (the commit's first seven characters), `feed` (`FEED`), `channel`, `support` (`SUPPORT`). A fault names the option, never more.
- `infoPlist`'s keys: `CFBundleExecutable` and `CFBundleName` and `CFBundleDisplayName` (`APP_NAME`); `CFBundleIdentifier` (`BUNDLE_ID`); `CFBundlePackageType` `APPL`; `CFBundleInfoDictionaryVersion` `6.0`; `CFBundleShortVersionString` (the version up to its first `-`); `CFBundleVersion` (the build number, as a string); `LSMinimumSystemVersion` (`MIN_MACOS`); `NSHighResolutionCapable` true; `CFBundleURLTypes`, one entry with `CFBundleURLName` `BUNDLE_ID` and `CFBundleURLSchemes` `[URL_SCHEME]`; `CFBundleIconFile` `AppIcon` only with `icon`; and four usage lines, each `BRIMM Video Studio looks in this folder for new videos and for the videos HyperFrames exports.`: `NSDownloadsFolderUsageDescription`, `NSDesktopFolderUsageDescription`, `NSDocumentsFolderUsageDescription`, `NSFileProviderDomainUsageDescription`.
- There is no `LSUIElement`: the app is an ordinary one, and `--agent` is answered before any window exists (Task 14).
- The command line runs only under `isMain(import.meta.url)`, so importing the file starts nothing.
- `no-xcode-tools.test.js`: `SKIPPED` gains `"studio-app"`. The folder is the build's own and is never in the bundle, which Task 15's test proves.
- `load-each.test.js` gains "loads every tool/studio-app/*.js alone", the same way as its `tool/setup/` test.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-build-info.test.js`.
  - "the build.json it writes is one buildOf reads whole": the text for `{ version: "1.0.0-beta.1", build: 3, commit: "0123456789abcdef0123456789abcdef01234567", channel: "beta" }`, written beside a `tool/` in a temp folder, gives `buildOf` with `broken: false`, `version: "1.0.0-beta.1"`, `build: 3`, `short: "0123456"`, `feed: FEED`, `channel: "beta"`, `support: SUPPORT`.
  - "a version, build, commit or channel it cannot take is a fault that names the option": `1.0`, build `0` and `1.5`, a 39-character commit, channel `nightly`; each fault holds the option's name and not its value.
  - "the Info.plist names the app, its scheme and macOS 13": the text holds each key above with its value; `CFBundleShortVersionString` is `1.0.0` for `1.0.0-beta.1`; there is no `LSUIElement`; `CFBundleIconFile` is there only with `icon`. On a Mac, `plutil -lint` passes on it.
  - "the scheme is the one edit.js opens": `new URL(CHECK_FOR_UPDATES_URL).protocol` is `URL_SCHEME + ":"`.
  - "the command line prints the text, or the fault with 2".
  - In `load-each.test.js`: "loads every tool/studio-app/*.js alone".
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-build-info.test.js tests/load-each.test.js`.** Expected: FAIL, since `tool/studio-app/build-info.js` is not there.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-build-info.test.js tests/load-each.test.js tests/no-xcode-tools.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/build-info.js tool/tests/studio-app-build-info.test.js tool/tests/load-each.test.js tool/tests/no-xcode-tools.test.js`, then `git commit -m "Studio app phase 6: the app's names, its build.json and its Info.plist, from one file"`. Add the Co-Authored-By line from the session's attribution to every commit in this plan.

---

### Task 2: `vendor.pin.json` and `vendor.js`: what is vendored, and the seal

**Files:**
- Create: `tool/studio-app/vendor.pin.json`, `tool/studio-app/vendor.js`
- Test: `tool/tests/studio-app-vendor.test.js`

**Interfaces:**
- Consumes: `node:fs`, `node:crypto`, `node:path`; `isMain` (`tool/is-main.js`).
- Produces:
  - `vendor.pin.json`: an object with exactly the keys `node`, `ffmpeg`, `x264`, `pkgconf`, `whisper`, `cmake`, each `{ "version", "url", "sha256" }`.
  - `PIN_NAMES = ["node", "ffmpeg", "x264", "pkgconf", "whisper", "cmake"]`; `NEEDED = ["node/bin/node", "node/bin/npm", "node/bin/ffmpeg", "node/bin/ffprobe", "node/bin/whisper-cli"]`; `SEAL = "manifest.json"`.
  - `readPins(file) -> { pins } | { fault }`.
  - `sourceName(pins) -> string`: `ffmpeg-<ffmpeg's version>-x264-<the first seven characters of x264's version>-source.zip`.
  - `seal(folder, pinFile) -> void`: writes `<folder>/manifest.json`, `{ "version": 1, "pins": <the SHA-256 of the pin file's bytes>, "files": { "<path under the folder>": "<SHA-256>" | "link:<target>" } }`, for every file and link under `<folder>/node` and `<folder>/licenses`.
  - `sealFault(folder, pinFile) -> "" | why`.
  - The command line, only under `isMain`: `node vendor.js pins` (one line a pin: name, version, url, the url's last part, sha256, tab between); `node vendor.js source-name`; `node vendor.js seal <folder>`; `node vendor.js check <folder>` (0 and nothing, or 1 and the why on stdout). The pin file is the one beside `vendor.js`.

**The rules:**
- A pin's `version` is one line and not empty; its `url` is https with no user, password, query or hash; its `sha256` is 64 lowercase hex. An unknown key, or a missing one, is a fault.
- The six pins' values are those of `spikes/2026-11-09-studio-mac-app/pins.zsh` (`grep -n 'PIN_URL\[\|PIN_SHA\[\|_VERSION=\|X264_COMMIT=' spikes/2026-11-09-studio-mac-app/pins.zsh`), with its shell variables written out in each address (`$NODE_VERSION`, `$X264_COMMIT`). x264's `version` is its whole commit. Its seventh pin, Sparkle, is left out: it is Phase 7's.
- `sealFault`, in this order: no manifest (`The vendored programs are not sealed: run build-vendor.sh.`); the manifest's `pins` is not the pin file's SHA-256 (`The vendored programs were built from other pins: run build-vendor.sh again.`); one of `NEEDED` is not in the folder (`<path> is missing from the vendored programs.`); a file is missing, changed or new (`<path> is not as it was sealed.`, the first by sorted path).
- `whisper-cli` is the transcriber's only name. `run.js` looks for `whisper-cli` before `whisper-cpp`, and `install.sh` and `checks.js` ask for it by that name.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-vendor.test.js`.
  - "the pin file holds the six pins, each whole": `readPins` of the real file gives the six names and no seventh; each `sha256` begins `d916511b` (node), `8c385028` (ffmpeg), `6eeb8293` (x264), `3a9080ac` (pkgconf), `ff1a9053` (whisper), `4e85de4d` (cmake); node's version is `26.11.1`; no address holds a `$`.
  - "the source zip is named for ffmpeg's version and x264's commit": `sourceName` of the real pins is `ffmpeg-9.0.2-x264-b35605a-source.zip`.
  - "a pin with an http address, a query, a short SHA-256 or a key too many is a fault".
  - "a sealed folder checks clean": a temp folder with the five needed files, a link and a licence; `seal`, then `sealFault` is `""`.
  - "a folder sealed under other pins is refused, and so is a changed file": seal, then change one byte of the pin file's copy; seal, then change `node/bin/ffmpeg`; seal, then add `node/bin/extra`; seal, then delete `node/bin/whisper-cli`. Each gives its own sentence above.
  - "the command line lists the pins and checks a folder": `pins` prints six lines of five fields; `check` ends with 1 and the sentence for an unsealed folder.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-vendor.test.js`.** Expected: FAIL, since neither file is there.
- [ ] **Step 3: Write the code** and the pin file.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-vendor.test.js tests/load-each.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/vendor.pin.json tool/studio-app/vendor.js tool/tests/studio-app-vendor.test.js`, then `git commit -m "Studio app phase 6: the vendored programs' pins, and a seal the build can check"`.

---

### Task 3: `build-vendor.sh`: the vendored programs, built once

**Files:**
- Create: `tool/studio-app/common.zsh`, `tool/studio-app/build-vendor.sh`
- Test: `tool/tests/studio-app-vendor.test.js` (a second `describe`, `{ skip: notAMac }`)

**Interfaces:**
- Consumes: `node vendor.js pins`, `source-name` and `seal` (Task 2), run from the script's own folder (`${0:A:h}`) with `node` named bare; the spikes' `common.zsh`, `build-ffmpeg.sh`, `build-whisper.sh` and `node-app.sh` as the text to port.
- Produces:
  - `zsh tool/studio-app/build-vendor.sh --out <folder> [--print | --fetch]`.
  - In `<folder>`: `downloads/` (the six pinned files), `build/` (the unpacked sources and what is compiled), `vendor/node/{bin,lib,LICENSE}` with `ffmpeg`, `ffprobe` and `whisper-cli` in `bin` beside node's own, `vendor/licenses/` (ffmpeg's `COPYING.GPLv3`, x264's `COPYING`, whisper.cpp's `LICENSE`, node's `LICENSE`), `vendor/manifest.json`, and `source/<node vendor.js source-name>`.
  - `common.zsh`, which `build-app.sh` sources too: `say`; `stop` (says and ends with 1); `refuse_watched <folder>`; `sha256_of <file>` (new: `shasum -a 256`, the first 64 characters); `find_identity` (sets `identity`, or stops with `tool/move-app/build-app.sh`'s own sentence, `Signing needs exactly one Developer ID Application identity in the keychain, and this Mac found <n> Developer ID Application identities.`); `only_system <file>…`; `min_macos <file>`; `is_macho <file>`.

**The rules:**
- Options: an unknown one, a missing `--out`, or `--print` with `--fetch` ends with 2 and one line. `--out` with a space in its path ends with 2: `ffmpeg's and x264's configure cannot take a path with a space: pick a folder without one.`
- `refuse_watched` ends with 1 for a folder that is, or is inside: a folder the launch agent watches (`$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist`'s `WatchPaths`, read with `plutil`); `$HOME/BRIMM Video Work/Drop`; `$HOME/Library/CloudStorage`; or a `$HOME/Dropbox*` folder. It says `That folder is watched or is in Dropbox, and a build never writes there.` Folders are compared by their real paths, letter case folded. The spike's own (`grep -n 'refuse_watched\|watched_folders' spikes/2026-11-09-studio-mac-app/common.zsh`) leans on the spike's variables: write this one to stand alone.
- `--print` says what would be fetched (each pin's name, version and address) and built, and changes nothing: no folder is made and nothing is fetched. It still asks `refuse_watched`, which only reads.
- `--fetch` and a whole run fetch each pin that is not already in `downloads/` with the right SHA-256, with `curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output <file>.part`, then check the SHA-256. A file whose SHA-256 is not the pin's is renamed to `<file>.rejected` and the script stops with 1 and `<name>'s download is not the pinned one, so it was set aside and nothing was unpacked.` `--fetch` ends there.
- A whole run then builds in `build/`, with `PATH=/usr/bin:/bin:/usr/sbin:/sbin` and `MACOSX_DEPLOYMENT_TARGET=13.0` and the compiler's variables unset as the spikes unset them: pkgconf, x264 and ffmpeg with the spikes' own flag lists (`grep -n 'X264_CONFIGURE=\|FFMPEG_CONFIGURE=' spikes/2026-11-09-studio-mac-app/build-ffmpeg.sh`), and whisper-cli with the spikes' CMake list (`grep -n 'CMAKE_ARGS=' spikes/2026-11-09-studio-mac-app/build-whisper.sh`); port them unchanged. node's tarball is unpacked and its `bin`, `lib` and `LICENSE` copied with `ditto`.
- After the build it stops unless: each of ffmpeg, ffprobe and whisper-cli links only system libraries (`only_system`), is arm64 and says macOS 13.0 (`min_macos`); ffmpeg's `-hwaccels` lists `videotoolbox` and its `-filters` lists `scale_vt`; `strings` finds `kernel_mul_mm` in whisper-cli (Metal's shaders are inside).
- The source zip holds the ffmpeg and x264 tarballs, `build-vendor.sh`, `common.zsh`, `vendor.pin.json` and a `BUILD.txt` with the two configure lines, and is made with `ditto -c -k --norsrc --noextattr --keepParent`. The spike's zip (`grep -n 'make_source_zip' spikes/2026-11-09-studio-mac-app/build-ffmpeg.sh`) had no `--norsrc --noextattr` and carried `._` files.
- Last, `node vendor.js seal <folder>/vendor`, and it says where the vendor folder and the source zip are.
- Nothing is signed here: the build signs.

- [ ] **Step 1: Write the failing tests.** Each has a temp folder, a temp `HOME`, and a copy of `tool/studio-app/` whose pin file the test may rewrite. First on `PATH` is a stand-in `curl` that records its arguments and copies `$FAKE_DOWNLOADS/<the address's last part>` to the file after `--output`; last on `PATH` is the folder of the test's own node.
  - "--print fetches nothing and makes no folder": the out folder is not there afterwards, and `ran` holds no `curl`.
  - "an unknown option, no --out, or a folder with a space ends with 2".
  - "a folder the launch agent watches, the drop folder or Dropbox is refused": the temp home holds a `Library/LaunchAgents/com.thebrimm.unedited.plist` whose `WatchPaths` names `<temp>/watched`; `--out <temp>/watched/x`, `--out <home>/Dropbox/x`, `--out <home>/Library/CloudStorage/x` and `--out <home>/BRIMM-Drop-link/x` (a link to `<home>/BRIMM Video Work/Drop`) each end with 1 and the sentence, and nothing is made.
  - "--fetch keeps a download whose SHA-256 is the pin's": with a pin file whose six SHA-256s are those of the fake downloads' bytes, the six files are in `downloads/`, no `.part` is left, and every `curl` line holds `--proto =https`.
  - "a download that is not the pinned one is set aside and nothing is unpacked": one pin's SHA-256 wrong, and a whole run; exit 1, the file is `<file>.rejected`, the sentence names the pin, and neither `build/` nor `vendor/` is there.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-vendor.test.js`.** Expected: FAIL in the new tests, since `build-vendor.sh` is not there.
- [ ] **Step 3: Write `common.zsh` and `build-vendor.sh`** to the rules above. The compile steps are not reached by a test: by-hand check 1 runs them.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-vendor.test.js`, then, from the repo's top, `zsh tool/studio-app/build-vendor.sh --out "${TMPDIR%/}/brimm-vendor-print" --print`.** Expected: PASS; the print names six pins, and that folder does not exist afterwards.
- [ ] **Step 5: Commit.** `git add tool/studio-app/common.zsh tool/studio-app/build-vendor.sh tool/tests/studio-app-vendor.test.js`, then `git commit -m "Studio app phase 6: build-vendor.sh fetches the pinned sources, builds the programs and seals the folder"`.

---

### Task 4: `Core.swift` and `studio-check`: lines, command lines, and what comes next

**Files:**
- Create: `tool/studio-app/Sources/Core.swift`, `tool/studio-app/Check/main.swift`, `tool/tests/studio-app-check.js`
- Test: `tool/tests/studio-app-core.test.js`

**Interfaces:**
- Consumes: Foundation only. In the tests: `hasXcodeTools` (`tool/helpers.js`), `AGENT_LABEL` (`busy.js`), `GUIDE_NAME` and `writeGuide` (`setup/guide.js`), `REPAIR` (`build.js`).
- Produces, in `Core.swift`:
  - `struct LineSplitter { init(); mutating func feed(_ bytes: Data) -> [Data]; mutating func rest() -> Data }`.
  - `enum Run: String { case setup, repair, status }`; `struct Command { let program: String; let arguments: [String] }`.
  - `func toolsFolder(app: String) -> String` (`<app>/Contents/Resources/node/bin`); `func studioFolder(app: String) -> String` (`<app>/Contents/Resources/Studio`).
  - `func engineCommand(run: Run, app: String) -> Command?`: nil when `app` is not absolute or holds a `:`.
  - `func childEnvironment(from: [String: String], home: String, app: String) -> [String: String]`.
  - `enum Launch: Equatable { case agent([String]); case window }`; `func launchOf(_ arguments: [String]) -> Launch`.
  - `func agentCommand(rest: [String], app: String) -> Command`.
  - `func isTranslocated(_ path: String) -> Bool`; `func moveTarget(home: String, systemWritable: Bool) -> String`; `func otherCopy(of app: String, home: String, exists: (String) -> Bool) -> String?`.
  - `func agentFile(home: String) -> String` (`<home>/Library/LaunchAgents/com.thebrimm.unedited.plist`); `func guidePaths(home: String) -> (html: String, pdf: String)` (`<home>/BRIMM Video Work/BRIMM Video Studio Getting Started.html` and `.pdf`).
  - `enum Next: String { case move, refused, setup, repair, twoCopies, status }`; `func nextStep(translocated: Bool, needs: String?, failed: Bool, chosen: Run?, other: Bool) -> Next`.
  - `func urlAction(_ url: String) -> String?`.
  - The shell's fixed names: `appName = "BRIMM Video Studio"`; `agentLabel = "com.thebrimm.unedited"`; `guideName = "BRIMM Video Studio Getting Started"`; `workFolderName = "BRIMM Video Work"`; `crashMessage` and `crashAdvice` (the two sentences in "The end", above); `checkEvery = 3.0` (seconds).
- Produces, in `Check/main.swift`: `studio-check <command> …`, a `switch` on the command's name to which each later task adds only its own cases. A command prints one JSON value and a line feed and ends with 0, or says why on stderr and ends with 2 (an unknown command too). A Swift nil prints as `null`, a `Bool` as `true` or `false`, a `String` as a JSON string, a `Command` as `{ "program", "arguments" }`. This task's commands:
  - `split` (stdin: bytes) prints `{ "lines": [strings], "rest": string }`.
  - `engine-command <run> <app>` and `agent-command <app> <arguments…>` print a command, or `null`.
  - `environment <home> <app>` (stdin: a JSON object of strings) prints an object.
  - `launch <arguments…>` prints `{ "agent": [strings] }` or `{ "window": true }`.
  - `translocated <path>`; `move-target <home> <yes|no>`; `other-copy <app> <home> <the paths that exist…>`; `agent-file <home>`; `guide-paths <home>` (`{ "html", "pdf" }`); `url <url>`; `names` (an object of the fixed names).
  - `next <translocated yes|no> <needs: setup|repair|nothing|none> <failed yes|no> <chosen: setup|repair|none> <other yes|no>` prints the `Next`'s name.
- Produces, in `tool/tests/studio-app-check.js`:
  - `noChecker`: `false`, or why the tests skip (`process.platform !== "darwin"`, or `hasXcodeTools()` is false).
  - `MODULES`: `<os.tmpdir()>/brimm-studio-modules`, the one module cache every test compile uses.
  - `CHECK_SOURCES`: those of `Core.swift`, `State.swift`, `Flow.swift`, `Agent.swift`, `EngineClient.swift`, `GuidePDF.swift`, `Mover.swift`, `Uninstall.swift` that are there, in that order, and `Check/main.swift`.
  - `checkerPath() -> string`: compiles on first use (a 180-second limit) and gives the binary's path, `<os.tmpdir()>/brimm-studio-check-<16 characters of the SHA-256 of the sources' names and bytes>`. It is made under a temp name and renamed, so test files that run at the same time share it. A compile that fails throws with `swiftc`'s last lines.
  - `check(command, args = [], { input, env, timeout = 60000 } = {}) -> { status, stdout, stderr, json }`: `spawnSync` of the checker. `env`, when given, is the whole environment; otherwise it is `process.env`. `json` is the parsed stdout when the status is 0.

**The rules:**
- `LineSplitter`: a line ends at byte 10 only; one byte 13 just before it is dropped; an empty line is given as empty data; bytes after the last 10 wait in the splitter and `rest()` gives them.
- `engineCommand`: the program is `<tools>/node`; the arguments are `<studio>/tool/setup/engine.js`, `--run`, the run, `--app`, the app, `--tools`, the tools folder, `--protocol`, `1`.
- `childEnvironment` gives exactly: `HOME` (the home given); `USER`, `LOGNAME` and `TMPDIR` when `from` has them; `LANG` `en_US.UTF-8`; `PATH` `<tools>:/usr/bin:/bin:/usr/sbin:/sbin`.
- `launchOf`: `.agent(rest)` when the first argument is `--agent`, with the others as `rest`; `.window` otherwise. `install.sh` writes the app's program and then `--agent` for both launch agents (`grep -n 'agent_program' tool/install.sh`).
- `agentCommand`: `<tools>/node`, with `<studio>/tool/unedited.js` and then `rest`.
- `isTranslocated`: the path holds `/AppTranslocation/`.
- `moveTarget`: `/Applications` when it can be written to, else `<home>/Applications`.
- `otherCopy`: of `/Applications/BRIMM Video Studio.app` and `<home>/Applications/BRIMM Video Studio.app`, the one that exists and is not `app` itself; nil when neither.
- `nextStep`, in this order: `translocated` gives `move`; `failed` gives `refused`; `needs` `"setup"` gives `setup`, whatever was chosen; `needs` `"repair"` gives `twoCopies` when `other`, else `repair`; `needs` `"nothing"` gives `repair` when `chosen` is `.repair`, else `status`; anything else gives `refused`.
- `urlAction`: `"check-for-updates"` for a URL whose scheme is `brimm-video-studio` and whose host is `check-for-updates`, in any letter case; nil for every other.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-core.test.js`, every `describe` with `{ skip: noChecker }`.
  - "a line ends only at a line feed: U+2028, U+2029 and U+0085 stay inside it": `split` of `{"a":"x\u2028y\u2029z\u0085w"}\n{"b":1}\r\n\npart` (the three characters as their UTF-8 bytes) gives three lines, the first still holding the three characters, the second without `\r`, the third empty, and `rest` `part`.
  - "the engine is started from inside the app, with the four options once each": `engine-command status "/Applications/BRIMM Video Studio.app"` gives the program and the nine arguments above.
  - "an app whose path holds a colon, or is not absolute, starts no engine": `engine-command setup "/Volumes/a:b/BRIMM Video Studio.app"` and a relative path print `null`. `engine-command update <app>` ends with 2: the shell has no such run.
  - "the engine's environment is built from scratch": given `{ USER, LOGNAME, TMPDIR, NODE_OPTIONS, PATH: "/opt/homebrew/bin" }` the result has `HOME`, `USER`, `LOGNAME`, `TMPDIR`, `LANG` and `PATH` only, and `PATH` begins with the tools folder.
  - "--agent first makes the app the background job, and the rest goes to unedited.js": `launch --agent --watch /a --rules-only` is `{ agent: ["--watch", "/a", "--rules-only"] }`; `launch` and `launch --watch /a --agent` are `{ window: true }`; `agent-command <app> --check-claude --until 5` gives node and `[<studio>/tool/unedited.js, "--check-claude", "--until", "5"]`.
  - "a translocated copy moves first, whatever the status": `next yes …` is `move` for every value of the other four.
  - "a status that failed offers nothing, whatever was chosen": `next no nothing yes repair no`, and with `setup` and `none`, is `refused`.
  - "a Mac with no setup is set up, whatever was chosen": `next no setup no repair no` is `setup`.
  - "a moved copy is repaired, and a second copy is asked about": `next no repair no none no` is `repair`, and with `other` `yes` it is `twoCopies`.
  - "a Mac that needs nothing shows its status, and repairs only when asked".
  - "the move goes to /Applications when it can be written to, and to the home's Applications otherwise".
  - "the other copy is the one in the other Applications folder, never this one".
  - "only brimm-video-studio://check-for-updates is an action": also `BRIMM-VIDEO-STUDIO://Check-For-Updates`; `brimm-video-studio://other`, `https://check-for-updates` and an empty string print `null`.
  - "the shell's names and paths are Studio's own": `names` gives `agentLabel` equal to `AGENT_LABEL`, `guideName` equal to `GUIDE_NAME`, a `crashMessage` that `tool/setup/engine.js`'s text holds, and `crashAdvice` equal to `REPAIR`; `agent-file <home>` ends `/Library/LaunchAgents/` + `AGENT_LABEL` + `.plist`; `guide-paths <a temp home>` equals what `writeGuide` gives back for that home (call it as `setup-guide.test.js` does: `grep -n 'writeGuide(' tool/tests/setup-guide.test.js`).
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-core.test.js`.** Expected: FAIL, since there is nothing to compile.
- [ ] **Step 3: Write `Core.swift`, `Check/main.swift` and `studio-app-check.js`** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-core.test.js`.** Expected: PASS on the Mac Studio. Elsewhere every test is skipped with its reason.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/Core.swift tool/studio-app/Check/main.swift tool/tests/studio-app-check.js tool/tests/studio-app-core.test.js`, then `git commit -m "Studio app phase 6: the shell's pure decisions, and studio-check, which lets node's tests ask them"`.

---

### Task 5: `Agent.swift`: the background job

**Files:**
- Create: `tool/studio-app/Sources/Agent.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-agent.test.js`

**Interfaces:**
- Consumes: `agentCommand` (Task 4); `checkerPath`, `check`, `noChecker` (Task 4).
- Produces:
  - `func runAgent(rest: [String], app: String) -> Int32`.
  - `studio-check agent <app> <arguments…>`: runs `runAgent` and ends with what it returns, printing nothing.

**The rules:**
- It starts `agentCommand`'s program as a child with the app's own environment, unchanged: launchd's plist sets `PATH`, and `unedited.js --check-claude` reads `XPC_SERVICE_NAME`. The child's output is the app's own, so both go to the log launchd names.
- Before the child starts, TERM, INT and HUP are each set to `SIG_IGN` and watched with a `DispatchSource` on a queue of its own. Each one that comes is sent on to the child.
- It waits for the child and returns the child's status. A child ended by a signal gives 128 plus the signal's number.
- It returns 1 when the child cannot be started, having written `BRIMM Video Studio could not start its background job: <the error's words>.` to stderr with `FileHandle.standardError`.
- It creates no `NSApplication`, shows nothing and reads no file.
- Port from `runAgent` in `spikes/2026-11-09-studio-mac-app/agent-spike/BRIMMSpike.swift` (`grep -n 'func runAgent' spikes/2026-11-09-studio-mac-app/agent-spike/BRIMMSpike.swift`), which sent no signal on, built its own environment and started a probe.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-agent.test.js`, `{ skip: noChecker }`. Each makes a temp app folder whose `Contents/Resources/node/bin/node` is a shell script that writes its arguments, one a line, and `$XPC_SERVICE_NAME` and `$PATH` into a file, and whose `Contents/Resources/Studio/tool/unedited.js` is an empty file.
  - "the job runs the app's own node on unedited.js with what follows --agent": `check("agent", [app, "--watch", "/a b", "--rules-only"])`; the file holds `<studio>/tool/unedited.js`, `--watch`, `/a b`, `--rules-only`, each as one argument.
  - "the job's environment is the app's own": with `env: { XPC_SERVICE_NAME: "com.thebrimm.claude-check", PATH: "/x:/usr/bin:/bin" }` the file holds both as given.
  - "the job ends with node's status": a node that ends with 7 gives 7; one that ends with 0 gives 0; one that kills itself with `kill -9 $$` gives 137.
  - "a TERM sent to the agent reaches node, and the agent ends with node's status": the node script traps TERM, writes `got TERM` and ends with 9, and otherwise sleeps; the test starts `checkerPath()` with `spawn`, waits until the script's file is there, sends `SIGTERM` to the checker, and finds exit 9 and `got TERM`. The same with `SIGINT` and a trap for INT. No process of the test is left running.
  - "a job whose node is not there says so and ends with 1": with no node file, exit 1 and the sentence on stderr.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-agent.test.js`.** Expected: FAIL, since `studio-check` has no `agent` command.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-agent.test.js tests/studio-app-core.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/Agent.swift tool/studio-app/Check/main.swift tool/tests/studio-app-agent.test.js`, then `git commit -m "Studio app phase 6: --agent starts the app's node on unedited.js, passes signals on and ends with its status"`.

---

### Task 6: `State.swift`: the events, and the window's state

**Files:**
- Create: `tool/studio-app/Sources/State.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-state.test.js`

**Interfaces:**
- Consumes: `crashMessage`, `crashAdvice` (Task 4); the events' shapes (`tool/setup/protocol.js`). In the tests: `mac`, `drive` (`tests/setup-harness.js`).
- Produces:
  - `enum Kind: String { case confirm, text, choice, folder, apps, signIn = "sign-in" }`.
  - `enum Event { case step(StepEvent); case question(Question); case progress(Bar); case summary(Summary); case done(Done); case failure(Failure) }` and `func decodeEvent(_ line: Data) -> Event?` (nil for a line that is not one of the six, has a kind that is none of `Kind`, or lacks a field its kind must have).
  - `StepEvent { id, n, of, title, body }`; `Question { id, kind: Kind, prompt, warning?, fault?, ok?, suggested?, words?, purpose?, options: [Option], apps: [AppRow], link?, paste }` with `Option { value, label, detail? }` and `AppRow { id, name, here, link?, note?, action? }`; `Bar { part, label, done, total?, state, detail? }`; `Summary { id, ok, lines: [Line], details?, needs? }` with `Line { label, value }`; `Done { outcome, summary, studio, guide: Guide?, notes }` with `Guide { html, pdf }`; `Failure { code, message, advice?, contact?, details? }`.
  - `struct SetupState`, with `init()`; `mutating func began()` (the engine was started); `mutating func take(_ event: Event)`; `mutating func ended()` (the process ended); `mutating func sentCheck()`; and what a view reads: `rows: [StepRow]` (`StepRow { id, title, mark }`, mark one of `waiting`, `current`, `done`), `step: StepEvent?`, `question: Question?`, `bars: [Bar]`, `review: Summary?`, `result: Summary?`, `status: Summary?`, `done: Done?`, `failure: Failure?`, `running: Bool`, `installing: Bool`, `awaitingCheck: Bool`.
  - `func stepList(of: Int) -> [(id: String, title: String)]`.
  - `studio-check state [--idle] [--sent-check] [--ended]` (stdin: event lines): makes a state, calls `began()` unless `--idle`, takes each line, then `sentCheck()` with `--sent-check`, then `ended()` with `--ended`. It prints an object with the keys `rows` (`[{ id, title, mark }]`), `step`, `question`, `bars`, `review`, `result`, `status`, `done`, `failure`, `running`, `installing`, `awaitingCheck` and `undecoded` (how many lines `decodeEvent` gave nil for); a nil is `null`.
  - `studio-check steps <of>` prints `[{ id, title }]`.

**The rules:**
- `began()` sets `running`.
- `take`:
  - A `step` sets `step`, clears `question` and `review`, and marks the rows (those before `n` done, `n` current, the rest waiting). A step whose `id` is `install` sets `installing`.
  - A `question` replaces the open one. One of kind `apps` clears `awaitingCheck`.
  - A `progress` replaces the bar with its `part`, or adds it after the others.
  - A `summary` goes to `review`, `result` (id `setup`) or `status`, by its id.
  - A `done` is kept, clears `question`, `running` and `installing`, and, unless its outcome is `cancelled`, marks every row done.
  - A `failure` is kept and clears `question`, `running` and `installing`. The rows stay as they are.
- `ended()`: with neither a `done` nor a `failure`, `failure` becomes `{ code: "engine", message: crashMessage, advice: crashAdvice }`. `running` and `installing` end either way.
- `sentCheck()` sets `awaitingCheck`.
- `rows` come from `stepList(of:)` at the first `step` event: for 9, the nine steps; for 6, `welcome`, `apps`, `permissions`, `review`, `install`, `done`; for 2, `install`, `done`; for any other number, only the steps seen so far. The titles are the engine's: `Welcome`, `This Mac's name`, `Apps`, `BRIMM Video in Dropbox`, `Folders`, `Permissions`, `Review`, `Install`, `Done`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-state.test.js`, `{ skip: noChecker }`. The real engine's events come from `mac()` and `drive()`; `drive` gives the events back. The test has its own small answerer, a table by a question's id that answers every `question` event (so a question sent again with a warning is answered again): `welcome` true, `name` `"Studio Test"`, `apps` `"continue"`, `drop-folder` and `exports-folder` the question's `suggested`, `review` true. It is `setup-engine.test.js`'s `reply` and `FRESH` in small (`grep -n '^const reply\|^const FRESH\|^const HELD' tool/tests/setup-engine.test.js`), and nothing is moved out of that file.
  - "every event of a whole fresh setup by the real engine is understood": the events of `mac()`'s fresh setup, one a line, into `state`: `undecoded` is 0, `done.outcome` is `installed`, `rows` are the nine with every mark `done`, and `running` and `installing` are false.
  - "the shell's step lists are the engine's own": for a fresh setup, a takeover's setup (`mac({ settings: "takeover" })`, with `welcome`, `apps` and `review` answered) and an installed Mac's repair, the ids and titles of the engine's `step` events, in order, equal `steps 9`, `steps 6` and `steps 2`.
  - "a step marks the rows before it done and itself current": after a `step` with `n: 3, of: 9`, two rows are `done`, the third `current`, six `waiting`.
  - "a question sent again replaces the open one": two `question` lines with one id, the second with a `fault`; the state's question has the fault.
  - "a step clears the question and the review before it".
  - "an error ends the run and keeps its words": a `step` and then an `error` line with code `dev`; `failure.code` is `dev`, `question` is `null`, `running` is false, and the row is still `current`.
  - "a cancelled run leaves its rows as they were".
  - "a run that ends with neither done nor error shows the engine's own last words": two events and `--ended`; `failure` has `crashMessage` and `crashAdvice`.
  - "a line that is no event is counted, never shown": `{"event":"note"}`, a question of kind `slider` and `hello`; `undecoded` is 3 and the state is as before.
  - "the installer's step sets installing, and the end clears it".
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-state.test.js`.** Expected: FAIL, since `studio-check` has no `state` command.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-state.test.js tests/studio-app-core.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/State.swift tool/studio-app/Check/main.swift tool/tests/studio-app-state.test.js`, then `git commit -m "Studio app phase 6: the window's state, made from the engine's six events"`.

---

### Task 7: `Flow.swift`: what each answer sends, and what follows

**Files:**
- Create: `tool/studio-app/Sources/Flow.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-state.test.js` (a new `describe`)

**Interfaces:**
- Consumes: `SetupState`, `Kind` (Task 6); `Next`, `Run`, `nextStep` (Task 4). In the tests: `answerFault` (`setup/protocol.js`), `mac`, `drive`.
- Produces:
  - `enum AppsReply: String { case check, proceed = "continue", installClaudeCode = "install-claude-code", signIn = "sign-in" }`.
  - `enum Reply { case confirm; case text(String); case choice(String); case folder(String); case apps(AppsReply); case signIn(code: String?) }`; `func replyValue(_ reply: Reply) -> Any`, the JSON value the engine is sent.
  - `func nextFromStatus(_ state: SetupState, translocated: Bool, chosen: Run?, other: Bool) -> Next`.
  - `func shouldCheck(_ state: SetupState) -> Bool`.
  - `enum Quit: String { case now, cancel, wait }`; `func quitRule(_ state: SetupState) -> Quit`.
  - `func statusOffers(next: Next, agentFileThere: Bool, guideThere: Bool) -> [String]`.
  - `studio-check reply <kind> [<text>]` prints `{ "answer": "q", "value": <replyValue> }`; `studio-check next-from-status <translocated yes|no> <chosen: setup|repair|none> <other yes|no>` (stdin: a status run's event lines, then `ended()`) prints the `Next`'s name; `studio-check offers <next> <agent file yes|no> <guide yes|no>` prints the list; and `state`'s object gains `quit` and `shouldCheck`.

**The rules:**
- `replyValue`: `confirm` is `true`; `text`, `choice` and `folder` are the string; `apps` is the case's raw value; `signIn` is `{ "code": <the code> }`, or `{}` when the code is nil or is empty once the white space around it is taken off.
- `nextFromStatus` is `nextStep` with `needs` the `status` summary's `needs` and `failed` true when the state has a `failure` or has no `done`.
- `shouldCheck`: the run is `running`, the open question's kind is `apps`, and `awaitingCheck` is false.
- `quitRule`: `wait` while `installing`; `cancel` while `running` and not `installing`; `now` otherwise.
- `statusOffers`: for `status`, `["updates", "repair", "guide", "uninstall"]`, without `guide` when there is no guide and without `uninstall` when the launch agent's file is not there; for every other `Next`, none.

- [ ] **Step 1: Write the failing tests.**
  - "each kind's answer is one the engine can read": for a question of each kind, written by the test with that kind's fields (the `apps` one with a row carrying each `action`), `answerFault(question, <the line reply prints>)` is `""`: `reply confirm`; `reply text "Studio Test"`; `reply choice a`; `reply folder /Users/x/Drop`; `reply apps` with each of `check`, `continue`, `install-claude-code`, `sign-in`; `reply sign-in ABC-123`; `reply sign-in`; and `reply sign-in "  "`, whose value is `{}`.
  - "what follows the real engine's status, for each kind of Mac": the events of `drive(m, { run: "status" })` into `next-from-status no none no`, for `mac({ settings })` with `none` (`setup`), `takeover` (`setup`), `installed` (`status`), `moved` (`repair`, and `twoCopies` with `other` `yes`), `dev` (`refused`) and `unusable` (`refused`).
  - "a status run that ended with no last event is refused": one `summary` line and nothing more.
  - "check is sent only while the apps question is open and the last one was answered": `shouldCheck` is true after an `apps` question; false with `--sent-check`; true again after the question is sent again; false for a `confirm` question; false after `done`.
  - "while the installer may be running, quitting waits": after a `step` with id `install`, `quit` is `wait`; with a question open before it, `cancel`; with no event yet, `cancel`; with `--idle`, `now`; after `done`, `now`.
  - "a Mac that is set up is offered updates, Repair, the guide and Uninstall": `offers status yes yes`; `offers status no no` is `["updates", "repair"]`.
  - "a refused Mac is offered nothing": `offers refused yes yes`, and the same for `move`, `twoCopies`, `setup` and `repair`, is `[]`.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-state.test.js`.** Expected: FAIL in the new tests.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-state.test.js tests/studio-app-core.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/Flow.swift tool/studio-app/Check/main.swift tool/tests/studio-app-state.test.js`, then `git commit -m "Studio app phase 6: the value each answer sends, what follows a status, and when quitting waits"`.

---

### Task 8: `EngineClient.swift`: starting the engine, reading it, answering it

**Files:**
- Create: `tool/studio-app/Sources/EngineClient.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-engine.test.js`

**Interfaces:**
- Consumes: `LineSplitter`, `Command` (Task 4); `Event`, `decodeEvent` (Task 6); `Reply`, `replyValue` (Task 7).
- Produces:
  - `final class EngineClient`, with `init(command: Command, environment: [String: String])`; `var onEvent: ((Event) -> Void)?`; `var onUndecoded: (() -> Void)?`; `var onEnd: ((Int32) -> Void)?`; `func start() throws`; `func answer(_ id: String, _ reply: Reply)`; `func back()`; `func cancel()`; `var isRunning: Bool`. The three callbacks come on the main queue, in the order the lines came, and `onEnd` after the last of them.
  - `studio-check drive [--answer-after-end] <answers file> <program> <arguments…>`: starts the program through an `EngineClient` with the checker's own environment and prints each event's own line as it comes. The answers file holds one JSON array a line, a `reply` command's arguments (`["confirm"]`, `["sign-in", "ABC"]`) or `["back"]` or `["cancel"]`; the next one is sent at each `question` event. At the end it prints `{ "ended": <status>, "undecoded": <count> }`. With `--answer-after-end` it first sends one more answer after the engine has ended.

**The rules:**
- stdout is read as it comes and split with `LineSplitter`. `onEnd` is called only once the process has ended and stdout has been read to its end, whichever comes first.
- stderr is read and thrown away, so a full pipe never stops the engine, and it is never shown or logged.
- `answer` writes `{"answer":<id>,"value":<replyValue>}` and a line feed; `back` writes `{"back":true}`; `cancel` writes `{"cancel":true}`. Each is one write. A write after the engine has ended does nothing, and a broken pipe never ends the app (`SIGPIPE` is ignored).
- stdin is never closed by the client while the engine runs.
- An answer's text is never logged, printed or kept.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-engine.test.js`, `{ skip: noChecker }`. The stand-in engine is a small node script the test writes, started with the test's own node.
  - "events come one a line, in order, and the end comes last": a stand-in that writes a `step`, a `question` and, once answered, a `done`; the checker prints the three and then `ended: 0`.
  - "every line comes before the end, however fast the engine ends": a stand-in that writes 500 `progress` lines and a `done` and ends at once, run 20 times; each time 501 event lines come before the `ended` line.
  - "stdin stays open until the engine ends": the stand-in writes a `question`, waits 300 ms after the answer, and writes `done` only if its stdin has not ended; the `done` comes.
  - "an event split across two writes is one event": the stand-in writes half a line, waits, writes the rest.
  - "a pasted code reaches the engine and is nowhere in what the client says": the answer `["sign-in", "ABC-123-XYZ"]`; the stand-in writes what it read into a file, which holds `{"answer":"…","value":{"code":"ABC-123-XYZ"}}`; the checker's stdout and stderr hold the code nowhere.
  - "an engine that ends without done or error is told as it is": a stand-in that writes one `step` and ends with 1; `ended` is 1, and no `done` or error line was printed.
  - "a great deal on stderr does not stop the engine": the stand-in writes 1 MB to stderr before its `done`.
  - "back and cancel are their own lines": the stand-in echoes each line it reads into a file; the file holds `{"back":true}` and `{"cancel":true}`.
  - "an answer after the engine has ended does nothing": `--answer-after-end`; the checker still ends with 0.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-engine.test.js`.** Expected: FAIL, since `studio-check` has no `drive` command.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-engine.test.js tests/studio-app-core.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/EngineClient.swift tool/studio-app/Check/main.swift tool/tests/studio-app-engine.test.js`, then `git commit -m "Studio app phase 6: the engine's client keeps stdin open, splits at line feeds and keeps no answer"`.

---

### Task 9: `GuidePDF.swift`: the guide as a PDF

**Files:**
- Create: `tool/studio-app/Sources/GuidePDF.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-pdf.test.js`

**Interfaces:**
- Consumes: `writeGuide` (`tool/setup/guide.js`), in the test, for a real guide's HTML.
- Produces:
  - `func makePDF(html: URL, pdf: URL, done: @escaping (Bool) -> Void)`, called on the main thread; `done` comes on the main thread, once.
  - `studio-check pdf <html> <pdf>`: makes an `NSApplication` (activation policy `prohibited`), calls `makePDF`, runs the main loop until `done`, and prints `{ "pages": n, "width": points, "height": points }` (the first page's size, read back with PDFKit). It ends with 1 when the PDF was not made, and with 3 and `no window server` on stderr when `CGSessionCopyCurrentDictionary()` is nil.

**The rules:**
- The web view sits in an `NSWindow` that is made for it and never shown. The page is loaded from its file with read access to its own folder only. It needs no network: the guide holds its fonts.
- When the page has loaded, it is printed with `printOperation(with:)`: US Letter, the print's own margins all 0 (the page's `@page` sets them), the job's disposition `save` to `<pdf>.part`, no print panel and no progress panel, run with `runModal(for:delegate:didRun:contextInfo:)` on that window. **Never `run()`**: without a shown window it does not return and writes to the file without end.
- On success `<pdf>.part` is renamed onto the PDF's name, so a half-made file never has the guide's name and an older PDF is replaced.
- A watchdog ends the job with `done(false)` when 30 seconds have passed since `makePDF` was called, or when `<pdf>.part` passes 50 MB: it closes the window and removes the part file.
- `done(false)` too when the page does not load, the operation says it failed, or the file is not there afterwards. Nothing is thrown, and a failure leaves no part file.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-pdf.test.js`, `{ skip: noChecker }`. A test whose checker ends with 3 skips itself with `t.skip("no window server")`.
  - "page breaks become Letter pages": the test's own page, with `@page { size: Letter; margin: 0.8in; }` and three sections, the second and third with `break-before: page`; `pdf` gives `pages` 3, `width` 612 and `height` 792, and the file begins `%PDF`.
  - "the real guide becomes a PDF of Letter pages": a guide written by `writeGuide` into a temp home (as `setup-guide.test.js` calls it); `pages` is 1 or more, 612 by 792.
  - "an older PDF is replaced, and no half-made file is left": the PDF's folder holds only the HTML and the PDF afterwards, with a space in the folder's name.
  - "a page that is not there makes no PDF": exit 1, and neither the PDF nor a part file is there.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-pdf.test.js`.** Expected: FAIL, since `studio-check` has no `pdf` command.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-pdf.test.js`.** Expected: PASS in a session with a screen; skipped with its reason elsewhere.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/GuidePDF.swift tool/studio-app/Check/main.swift tool/tests/studio-app-pdf.test.js`, then `git commit -m "Studio app phase 6: the Getting Started guide is printed to a PDF of Letter pages"`.

---

### Task 10: The status says the folders

**Files:**
- Modify: `tool/setup/summary.js` (`grep -n 'export function statusSummary\|export function setupSummary' tool/setup/summary.js`: 106, 83)
- Test: `tool/tests/setup-summary.test.js`

**Interfaces:**
- Consumes: the lines `setupSummary` already makes for the folders, and the private helpers it makes them with (`line`, `folderWords`, `dropFolderOf`, `exportsFolderOf`).
- Produces: `statusSummary`'s `lines` gain, after `Setup`, the three lines `BRIMM Video in Dropbox`, `Drop folder`, `Exports folder`, each worded exactly as `setupSummary` words it for the same settings. The first lines stay `This Mac`, `BRIMM Video Studio`, `Setup`.

**The rules:**
- The three lines are there only when the Mac has settings (a takeover, an installed Mac, a moved one). A fresh Mac's status is as it was.
- It still starts no program and opens no file: the settings are the ones `kindOf` already read (`found.settings`). `folderWords` only resolves a path, as it does for the setup summary.
- `needs`, `ok` and the `Setup` line are not changed. The event still passes `eventFault`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/setup-summary.test.js`, and bring the test that pins the status's labels as `["This Mac", "BRIMM Video Studio", "Setup"]` up to date (`grep -n '"Setup"' tool/tests/setup-summary.test.js`: about 304): for a Mac with settings the three folder labels follow.
  - "an installed Mac's status says its folders, in the setup summary's own words": for one settings object, the three lines' values in `statusSummary` equal those in `setupSummary`.
  - "a fresh Mac's status has no folder lines", and "the status is still a whole event" (`eventFault` is `""` for each kind of Mac).
- [ ] **Step 2: Run `cd tool && node --test tests/setup-summary.test.js`.** Expected: FAIL in the new tests and the changed one.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/setup-summary.test.js tests/setup-engine.test.js tests/studio-app-state.test.js`.** Expected: PASS. If a `setup-engine.test.js` test pinned the status's lines, bring it up to date in this commit.
- [ ] **Step 5: Commit.** `git add tool/setup/summary.js tool/tests/setup-summary.test.js` (and `setup-engine.test.js` if it changed), then `git commit -m "Studio app phase 6: the status says this Mac's folders, for the app's status window"`.

---

### Task 11: `dev/fake-engine.mjs`: a stand-in engine for the windows

**Files:**
- Create: `tool/studio-app/dev/fake-engine.mjs`
- Test: `tool/tests/studio-app-fake-engine.test.js`

**Interfaces:**
- Consumes: `node:` modules only, so it runs wherever the build puts it (Task 15 puts it at `tool/setup/engine.js` in a `--fake-engine` build, beside `tool/package.json`, which makes it a module). In the test: `eventFault` (`setup/protocol.js`); `check`, `noChecker` (Task 4).
- Produces: `node fake-engine.mjs --run <run> --app <app> --tools <tools> --protocol 1`, speaking the protocol.

**The rules:**
- It keeps one file, `<TMPDIR>/brimm-fake-engine/needs` (`setup` when it is not there), and writes its sample guide into the same folder. It reads and writes nothing else, starts no program and never looks at this Mac's settings, launch agents or folders.
- `--run status`: a `status` summary with that `needs` and six sample lines, then `done`.
- `--run setup`: first a `choice` question, id `scenario`, with these options, then that scenario:
  - `whole`: the nine steps, with one question of each of the six kinds, a `warning` and a `fault` each shown once, an `apps` question whose rows turn `here` one at a time as `check` answers come and whose rows carry both actions, the six bars (the model's with a `total`, the others without), a review with `details`, a `setup` summary, and `done` with outcome `installed`, two notes and a guide. It then writes `needs` `nothing`.
  - `damaged`, `dev`, `busy`, `download`, `install`, `settings`: two steps and then that `error`, with the real engine's own message for the code, and `advice`, `contact` and `details` where the real one gives them.
  - `crash`: one step, then it ends with 1 and no last event.
  - `moved`: writes `needs` `repair` and ends with `done`, outcome `cancelled`.
  - `fresh`: writes `needs` `setup` and ends the same way.
- `--run repair`: the two steps, the six bars, `done` with outcome `repaired` and a guide, and `needs` becomes `nothing`.
- A `cancel`, or stdin closing, before the `install` step ends the run with `done`, outcome `cancelled`. `back` sends the question before again.
- Bars move on a timer so that a whole run takes about ten seconds. `FAKE_ENGINE_FAST=1` takes the waits away, for the test.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-fake-engine.test.js`, with `TMPDIR` a temp folder and `FAKE_ENGINE_FAST=1`.
  - "every line of every scenario is a whole event": each scenario and each run, driven to its end with answers; `eventFault` is `""` for every line.
  - "the whole scenario asks one question of each kind and shows the six bars".
  - "the dev scenario ends with error dev", and the same for `damaged`, `busy`, `download`, `install` and `settings`, each as the last line, with exit 1.
  - "the crash scenario ends with no last event".
  - "status says what the last run left": `setup` at first, `nothing` after `whole`, `repair` after `moved`.
  - "it writes only in its own folder": the temp folder's listing before and after holds nothing new outside `brimm-fake-engine/`.
  - "the shell understands every line of every scenario" (`{ skip: noChecker }`): each scenario's lines into `studio-check state --ended`; `undecoded` is 0, and `whole` ends with every row `done`.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-fake-engine.test.js`.** Expected: FAIL, since the file is not there.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-fake-engine.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/dev/fake-engine.mjs tool/tests/studio-app-fake-engine.test.js`, then `git commit -m "Studio app phase 6: a stand-in engine that speaks the protocol and touches nothing, for looking at the windows"`.

---

### Task 12: `Mover.swift` and `Uninstall.swift`: the move, and stopping the background job

**Files:**
- Create: `tool/studio-app/Sources/Mover.swift`, `tool/studio-app/Sources/Uninstall.swift`
- Modify: `tool/studio-app/Check/main.swift`
- Test: `tool/tests/studio-app-model.test.js`

**Interfaces:**
- Consumes: `Command`, `toolsFolder`, `studioFolder`, `childEnvironment`, `appName` (Task 4).
- Produces:
  - `func moveApp(from app: String, to folder: String, trash: (String) -> Bool) -> String?`: nil, or the sentence to show.
  - `enum Uninstalled: Equatable { case removed; case notice(String) }`.
  - `func uninstallCommands(app: String) -> [Command]`: first `<tools>/node` with `[<studio>/tool/busy.js, "idle-why"]`, then `/bin/zsh` with `[<studio>/tool/install.sh, "--remove"]`.
  - `func uninstall(app: String, fake: Bool, run: (Command) -> (status: Int32, out: String, err: String)) -> Uninstalled`.
  - `studio-check move <from> <folder> <a trash folder>`: `moveApp` with a `trash` that moves the item into the trash folder; prints the sentence, or `null`.
  - `studio-check uninstall <app> <fake yes|no>`: `uninstall` with a `run` that starts the command with `childEnvironment` (the home is the checker's `HOME`) and waits; prints `"removed"` or `{ "notice": <the line> }`.

**The rules:**
- `moveApp`: the destination is `<folder>/BRIMM Video Studio.app`. It makes `<folder>` when it is not there; copies `app` with `/usr/bin/ditto` to `<folder>/.BRIMM Video Studio.app.moving`; takes the quarantine flag off that copy with `/usr/bin/xattr -dr com.apple.quarantine`; gives an older copy at the destination to `trash`; renames the copy onto the destination; and returns nil. Any step that fails removes the `.moving` copy and returns `BRIMM Video Studio could not be moved to your Applications folder. Drag it there in Finder, then open it again.` The app it was copied from is left where it is.
- `uninstall`:
  - With `fake`, it runs nothing and gives `.removed`.
  - It runs the first command. Any status but 0 gives `.notice` with the first line of its stdout, or of its stderr when stdout is empty, or `BRIMM Video Studio could not tell whether it is at work, so nothing was stopped.` when both are, and the second command is never run.
  - It runs the second. Status 0 gives `.removed`; anything else gives `.notice("BRIMM Video Studio could not stop its background job. Open it again and choose Repair.")`.
- `install.sh --remove` takes neither `--tools` nor `--app`, stops both launch agents and deletes their files, and leaves the folders, the settings and the model (`grep -n 'mode" == "remove"' tool/install.sh`). It does not ask whether an import is at work: `busy.js idle-why` does, with 0 and no line when nothing is (`grep -n 'idle-why' tool/busy.js`).

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-model.test.js`, `{ skip: noChecker }`, each in a temp folder. The move's tests use the real `ditto` and `xattr` on temp folders. The Uninstall tests make a temp app whose `Contents/Resources/node/bin/node` and `Contents/Resources/Studio/tool/install.sh` are scripts that write their arguments into a `ran` file and end as the test says; the real `install.sh` is never started.
  - "the app is copied into the folder and loses its quarantine flag": a temp `BRIMM Video Studio.app` with one file, marked with `xattr -w com.apple.quarantine "0081;0;Safari;"`; after `move`, the copy is at the destination with the file, `xattr -p com.apple.quarantine` fails on it, the source is still there, and `null` was printed.
  - "a folder that is not there is made".
  - "an older copy goes to the Trash, and the new one takes its place": the older copy is in the trash folder, and the destination holds the new file.
  - "a move that fails leaves nothing half-made": a source that is not there; the sentence is printed, and the folder holds neither the app nor a `.moving` copy.
  - "Uninstall asks whether this Mac is at work, then stops the job, and starts nothing else": node ends with 0 and `install.sh` with 0; `ran` holds two lines, `<studio>/tool/busy.js idle-why` and `--remove`; `"removed"` is printed.
  - "a Mac at work is told so, and nothing is stopped": node ends with 1 and prints `An import is at work: it holds its lock (process 5).`; the notice is that line, and `ran` holds no `--remove`.
  - "a refusal on stderr is the notice when stdout is empty", and "with neither, the fallback sentence".
  - "a job that cannot be stopped says to choose Repair": `install.sh` ends with 1.
  - "a stand-in build's Uninstall starts no program": `uninstall <app> yes` prints `"removed"`, and there is no `ran` file.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-model.test.js`.** Expected: FAIL, since `studio-check` has neither command.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-model.test.js tests/studio-app-core.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/Mover.swift tool/studio-app/Sources/Uninstall.swift tool/studio-app/Check/main.swift tool/tests/studio-app-model.test.js`, then `git commit -m "Studio app phase 6: the move to Applications, and an Uninstall that asks first and stops only the background job"`.

---

### Task 13: `AppModel.swift`: what the windows do

**Files:**
- Create: `tool/studio-app/Sources/AppModel.swift`
- Test: `tool/tests/studio-app-model.test.js`

**Interfaces:**
- Consumes: everything Tasks 4 to 9 and 12 produce; `MODULES`, `noChecker` (Task 4).
- Produces:
  - `enum Screen { case checking, move, refused, setup, repairing, twoCopies, status, removed }`.
  - `final class AppModel: ObservableObject`, with `@Published` `screen: Screen`, `state: SetupState`, `notice: String?` (one line under the buttons), `other: String?` (the other copy's path), `guideMade: Bool?`; `let fake: Bool` (a file named `FAKE-ENGINE.txt` is in the app's Resources); `var offers: [String]`; `var quit: Quit`; and `func begin(chosen: Run?)`; `func answer(_ reply: Reply)` (to the open question); `func back()`; `func cancel()`; `func moveToApplications()`; `func useThisCopy()`; `func openOtherCopy()`; `func checkForUpdates()`; `func openGuide()`; `func copySummary()`; `func openClaude()`; `func uninstall()` (after the view's confirm).

**The rules:**
- `begin(chosen:)`: if the app is translocated, `screen` is `move` and no engine is started. An app whose `engineCommand` is nil is `refused` with `BRIMM Video Studio cannot run from a folder with a colon in its name. Move it to your Applications folder, then open it again.` Otherwise it runs `--run status` into a new `SetupState` and, when that run ends, takes `nextFromStatus` (with `other` whether `otherCopy` finds one): `setup` and `repair` start that run with a new `SetupState`; `refused` shows the status run's own `failure`; `twoCopies` sets `other`; `status` shows the status summary's lines.
- Each run: `state.began()`, then each event into `state.take`, then `state.ended()` at the client's end.
- **The apps timer.** Every `checkEvery` seconds, when `shouldCheck(state)`, the model sends `.apps(.check)` and calls `state.sentCheck()`.
- **After a `done` with a guide**, `makePDF`; `guideMade` is its answer. After a setup (outcome `installed`) the PDF is opened in Preview. If it could not be made: `notice` is `The Getting Started guide could not be made into a PDF. It is here as a web page: <the HTML's path>.`
- **After a run ends** with `repaired`, or with `installed` when the person closes the Done step, the model calls `begin(chosen: nil)`, so the status window follows.
- `offers` is `statusOffers(next: .status, agentFileThere:, guideThere:)` on the `status` screen, with the launch agent's file at `agentFile(home:)` and the guide at either of `guidePaths(home:)`; none on any other screen.
- `openGuide`: the PDF when it is there; otherwise the HTML is made into the PDF first, and opened itself if that fails.
- `copySummary`: `done.summary` onto the pasteboard. `openClaude`: opens `Claude.app` from `/Applications` or `<home>/Applications`; when neither is there, shows `done.studio` in Finder.
- `checkForUpdates`: `notice` becomes `Updates are not part of this build yet.` Phase 7 replaces this one function's body.
- `uninstall()` returns at once unless `screen` is `status`. It then runs `uninstall(app:fake:run:)` off the main thread: `.removed` gives `screen` `removed`, and `.notice` sets `notice`.
- `useThisCopy` starts `--run repair`. `openOtherCopy` opens `other` and quits this copy.
- `moveToApplications`: with `fake`, `notice` becomes `A stand-in build is never moved.` and nothing more. Otherwise `moveApp` to `moveTarget`, with `FileManager`'s `trashItem` as `trash`; a sentence back becomes `notice`; nil opens the copy with `/usr/bin/open -n` and quits.
- `quit` is `quitRule(state)`.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-model.test.js`.
  - "the app's sources typecheck" (`{ skip: noChecker }`, a 180-second limit): `swiftc -typecheck -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path <MODULES>` over every `.swift` file in `tool/studio-app/Sources/` ends with 0. Until Task 14 adds `main.swift` the sources are a library, which typechecks.
  - "the app's sources never log": no file in `Sources/` holds `print(`, `NSLog`, `os_log`, `Logger(` or `dump(`. It needs no compiler, so it runs everywhere.
  - "no source splits lines with FileHandle's own reader": no file in `Sources/` holds `.bytes.lines` or `.lines {`.
  - "the model asks nextFromStatus, shouldCheck and quitRule, and stops nothing off the status screen": the text of `AppModel.swift` holds each of the three names, and its `uninstall()` begins with a guard on `screen`.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-model.test.js`.** Expected: FAIL in the last test, since `AppModel.swift` is not there.
- [ ] **Step 3: Write `AppModel.swift`** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-model.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/AppModel.swift tool/tests/studio-app-model.test.js`, then `git commit -m "Studio app phase 6: the app's model: status first, then setup, repair, the move, Uninstall and the guide"`.

---

### Task 14: The window, the menu, the URL scheme and quitting

**Files:**
- Create: `tool/studio-app/Sources/SetupViews.swift`, `StatusViews.swift`, `AppDelegate.swift`, `main.swift`
- Test: `tool/tests/studio-app-model.test.js` (Task 13's typecheck now covers these, and two tests more)

**Interfaces:**
- Consumes: `AppModel`, `Screen` (Task 13); `Reply`, `AppsReply`, `Kind`, `Quit` (Tasks 6 and 7); `launchOf`, `runAgent`, `urlAction` (Tasks 4 and 5).
- Produces: the app's program. Nothing later reads a name from these files.

**The rules:**
- `main.swift`: `launchOf` of the arguments after the program's name. `.agent(rest)` calls `exit(runAgent(rest:app:))` with `Bundle.main.bundlePath`, before anything of AppKit is touched. `.window` makes the `NSApplication`, sets the delegate and runs.
- **One window**, 760 by 560 points, titled `BRIMM Video Studio`, holding one SwiftUI view that switches on `model.screen`. Closing the window quits the app, by the quitting rule below.
- **Colours**: navy `#1F2D42` for headings and the main button, mist `#E8E3DA` for the side list's background, smoke `#F8F7F5` for the window, fog `#5C6D7E` for quiet text (`tool/brand/brand.md`). The system font: the brand's typefaces are web fonts.
- **The setup and repair screen** (`SetupViews.swift`): the steps down the left from `state.rows`, each with its mark (a tick for done, a filled dot for current, an empty one for waiting); on the right the step's title and body lines, then the review when there is one, then the open question, then the bars, then the ending.
  - The question is drawn **by its `kind`, never by its `id`**, and each button sends a `Reply` through `model.answer`:
    - `confirm`: one main button with `ok` as its title; `.confirm`.
    - `text`: a field holding `suggested`, and `Continue`; `.text` with the field's text.
    - `choice`: one button for each option, with its `detail` under it; `.choice` with the option's `value`.
    - `folder`: the `words`, a `Use this folder` button (`.folder` with `suggested`), and `Choose another folder…`, which opens `NSOpenPanel` (folders only, may create folders, starting at `suggested`) and sends `.folder` with the path picked.
    - `apps`: a row for each app with a tick when `here`, its `note`, a `Download` button that opens `link` in the browser, and a button titled `Install Claude Code` or `Sign in` for its `action` (`.apps(.installClaudeCode)`, `.apps(.signIn)`); under the rows, `Continue` (`.apps(.proceed)`).
    - `signIn`: `Open the sign-in page` when there is a `link`; a field for the code with `Continue` (`.signIn(code:)` with the field's text); and `I signed in in the browser` (`.signIn(code: nil)`). The field is emptied as soon as it is sent.
  - A `warning` is shown above the buttons in fog with a warning sign, a `fault` in red.
  - `Back` is there while not `installing`; `Cancel` is there until the run ends, and is disabled while `installing`.
  - A bar is a `ProgressView` with its `label` and `detail`: with a `total`, a measured one; without, an unmeasured one while `running`; a tick for `done`, a dash for `skipped`, a cross for `failed`.
  - The review: the summary's lines as two columns, and a `Details` disclosure holding `details` in a scrolling, fixed-width box. The question under it is the review's own button.
  - `done`: the `setup` summary's lines, the notes, `model.notice`, and the buttons `Copy setup summary`, `Open Getting Started guide` and `Open your BRIMM Video Studio folder in Claude`, then `Close`. A `cancelled` outcome shows `Setup was stopped.` and the notes.
  - A `failure`: its `message`, its `advice`, `For help, write to <contact>.` when there is a contact, `details` under a `Details` disclosure, and the buttons `Repair` (not for the codes `dev`, `settings`, `arguments`) and `Close`. `Repair` calls `begin(chosen: .repair)`.
- **The other screens** (`StatusViews.swift`), with these words:
  - `checking`: `Looking at this Mac…`
  - `move`: the heading `Move BRIMM Video Studio to your Applications folder`; `BRIMM Video Studio is running from the place it was downloaded to, and macOS keeps it apart there. It needs to be in your Applications folder before it can set up this Mac.`; when the target is the home's: `It goes in the Applications folder in your home folder, which needs no administrator's password.`; the button `Move to Applications`; then `model.notice`.
  - `twoCopies`: `There are two copies of BRIMM Video Studio on this Mac: this one, and one at <other>. This Mac was not set up from this one.`; the buttons `Open the other copy` and `Use this copy instead`; and `Put the copy you do not use in the Trash.`
  - `status`: with `model.fake`, at the top, `This build's setup is a stand-in: it changes nothing on this Mac.`; the status summary's lines as two columns; `Background job: not on this Mac. Choose Repair to start it.` when the launch agent's file is not there; then the buttons `model.offers` gives, titled `Check for Updates…`, `Repair`, `Open Getting Started guide`, `Uninstall…`; then `model.notice`.
  - `Uninstall…` asks first, in a sheet: `Stop BRIMM Video Studio on this Mac?`; `The background job that watches for new videos is taken away. Your videos, your folders, this Mac's settings and the transcription model stay. To finish, put BRIMM Video Studio in the Trash.`; the buttons `Stop it` and `Cancel`.
  - `removed`: `BRIMM Video Studio no longer watches for new videos on this Mac. To start it again, open it and choose Repair.`
  - `refused`: the failure, as in the setup screen, with only `Close`.
- **The menu** (`AppDelegate.swift`): the app's menu with `About BRIMM Video Studio`, `Check for Updates…` and `Quit BRIMM Video Studio`; an Edit menu with Undo, Redo, Cut, Copy, Paste and Select All, without which a code cannot be pasted (the spike found so: `grep -n 'Edit' spikes/2026-11-09-studio-mac-app/agent-spike/BRIMMSpike.swift`); a Window menu.
- **The URL scheme**: `application(_:open:)` takes each URL through `urlAction`. `check-for-updates` brings the window to the front and, on the `status` screen, calls `model.checkForUpdates()`. A URL that comes before the first `begin` has shown a screen is kept and acted on then. On every other screen it only brings the window to the front.
- **At launch**: `model.begin(chosen: nil)`.
- **Quitting** (`applicationShouldTerminate`, and the window's close): `now` quits. `cancel` sends a cancel, waits for the run's end for at most five seconds, and quits. `wait` does not quit, shows `Setup is finishing. BRIMM Video Studio closes when it is done.`, and quits when the run ends.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-model.test.js`. The typecheck now reads four more files.
  - "main.swift answers --agent before anything of AppKit": with its comment lines taken away, the text of `main.swift` holds `launchOf` and `runAgent` before its first `NSApplication`.
  - "the views never know a question's id": neither `SetupViews.swift` nor `StatusViews.swift` holds `"welcome"`, `"name"`, `"dropbox"`, `"drop-folder"`, `"exports-folder"`, `"review"`, `"scenario"`, `"permission-` or `question.id ==`.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-model.test.js`.** Expected: FAIL in the two new tests, since the files are not there.
- [ ] **Step 3: Write the four files** to the rules above.
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-model.test.js`.** Expected: PASS: every source typechecks together.
- [ ] **Step 5: Commit.** `git add tool/studio-app/Sources/SetupViews.swift tool/studio-app/Sources/StatusViews.swift tool/studio-app/Sources/AppDelegate.swift tool/studio-app/Sources/main.swift tool/tests/studio-app-model.test.js`, then `git commit -m "Studio app phase 6: the window draws each question by its kind, and the menu, the URL scheme and quitting follow the model"`.

---

### Task 15: `build-app.sh`: the bundle, signed inside-out

**Files:**
- Create: `tool/studio-app/build-app.sh`, `tool/studio-app/node.entitlements`, `tool/studio-app/README.md`
- Test: `tool/tests/studio-app-build.test.js`

**Interfaces:**
- Consumes: `node build-info.js json|plist` (Task 1); `node vendor.js check` and `source-name` (Task 2); `common.zsh` (Task 3); the sources (Tasks 4 to 14); `dev/fake-engine.mjs` (Task 11); the commit's own `tool/build-helpers.js`; `tool/move-app/build-app.sh` and `tests/move-app-build.test.js` as the pattern. The script's own helpers are run from its own folder (`${0:A:h}`), in the working tree; what goes into the bundle comes from the commit.
- Produces:
  - `zsh tool/studio-app/build-app.sh --out <folder> --version <semver> --build <n> --vendor <folder> [--channel stable|beta] [--sign] [--any-commit] [--print] [--fake-engine]`.
  - In `<folder>`: `BRIMM Video Studio.app` and `BRIMM-Video-Studio-<version>.zip`. It replaces only those two.
  - The bundle:
    - `Contents/Info.plist`
    - `Contents/MacOS/BRIMM Video Studio`
    - `Contents/Resources/Studio/build.json`
    - `Contents/Resources/Studio/tool/` (the commit's `tool/`, without `tests/`, `move-app/`, `studio-app/` and any `.env` file)
    - `Contents/Resources/node/{bin,lib,LICENSE}` (the vendor folder's, with the five `brimm-<helper>` programs added to `bin`)
    - `Contents/Resources/Licenses/` (the vendor folder's `licenses/`, and `ffmpeg-source.txt`)
    - `Contents/Resources/AppIcon.icns` only when `tool/studio-app/AppIcon.icns` is there
    - `Contents/Resources/FAKE-ENGINE.txt` only with `--fake-engine`

**The rules:**
- Options. Ends with 2 and one line for: an unknown option; a missing `--out`, `--version`, `--build` or `--vendor`; a fault from `build-info.js`; `--fake-engine` with `--sign` (`A build with the stand-in engine is never signed with the Developer ID.`). `--channel` is `stable` when not given.
- Refusals, each with 1 and before anything is written: `refuse_watched` for `--out`; `tool/` has changes that are not committed (`git status --porcelain -- tool`); the commit is not on `origin/main`, unless `--any-commit`; `node vendor.js check <vendor>` says why; with `--sign`, `find_identity` does not find exactly one identity.
- `--print` then says what it would do (the commit, the version and build, the two files it would make, each step in a line, and whether it would sign) and ends with 0. It makes no folder and starts neither `swiftc`, `codesign`, `ditto` nor `tar`.
- The steps, in order, in a temp folder that a trap removes, with the app moved into `--out` only when all have passed:
  1. `git archive --format=tar <commit> tool`, unpacked into `Contents/Resources/Studio`; then `tool/tests`, `tool/move-app` and `tool/studio-app` are removed, and so is every file named `.env` or beginning `.env.`, by name alone.
  2. `build.json` from `node build-info.js json`, with the commit.
  3. The vendor folder's `node` copied with `ditto` to `Contents/Resources/node`, and its `licenses` to `Contents/Resources/Licenses`. `ffmpeg-source.txt` says: `ffmpeg and x264 are free software under the GNU General Public License. The source this copy was built from, with the build's own script, is at https://updates.thebrimminsights.com/source/<node vendor.js source-name>.`
  4. The helpers: `node <the unpacked tool>/build-helpers.js <the bundle's bin>`.
  5. `Info.plist` from `node build-info.js plist` (with `--icon` when the icon is there), checked with `plutil -lint`.
  6. The app's program: `swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path <temp> -o "Contents/MacOS/BRIMM Video Studio" <every Sources/*.swift, sorted>`.
  7. With `--fake-engine`: everything under the bundle's `tool/` but `package.json` is removed, `dev/fake-engine.mjs` is copied to `tool/setup/engine.js`, and `FAKE-ENGINE.txt` is written. Such a bundle holds no `install.sh`, no `busy.js` and no `unedited.js`, so it can set up, stop or run nothing.
  8. Signing. The list is every file under `Contents/Resources/node` that can be run or is named `*.dylib`, `*.node` or `*.so` (`find`, as the spike's `node-app.sh` finds them) and that `is_macho`, sorted by path, and then the app. With `--sign`: each with `codesign --force --options runtime --timestamp --sign <identity>`, and `node/bin/node` alone also with `--entitlements <node.entitlements>`. Without: each with `codesign --force --sign - --timestamp=none`. Never `--deep`.
  9. `codesign --verify --deep --strict --verbose=2` on the app.
  10. The zip: `ditto -c -k --norsrc --noextattr --keepParent`.
- `node.entitlements` holds exactly `com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory` and `com.apple.security.cs.disable-library-validation`, each true (the spike's file: `spikes/2026-11-09-studio-mac-app/node-app/node.entitlements`). The app itself has none.
- What it says at the end: the app, the zip, the commit, the version and build; with `--sign`, `Signed as <identity>.` and then `Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:` with `xcrun notarytool submit "<zip>" --keychain-profile "BRIMM notary" --wait`, `xcrun stapler staple "<app>"`, the `ditto` line again (a zip made before stapling has no ticket) and `spctl --assess --type execute -vv "<app>"`; without `--sign`, that it is sealed ad hoc for this Mac's tests only; with `--fake-engine`, `This build's setup is a stand-in: it is for looking at the windows, and sets up nothing.`
- Programs are named bare (`swiftc`, `codesign`, `security`, `node`, `git`, `ditto`, `plutil`, `tar`, `file`, `find`), as `tool/move-app/build-app.sh` names them, which is how the test puts stand-ins first.
- `README.md` (one page): what the folder is, the two scripts and their options, that Claude runs them only with `--print`, the order of a real build (vendor once, then the app), and where the by-hand checks are.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-app-build.test.js`, `{ skip: notAMac }`, on the pattern of `move-app-build.test.js`'s `world()`. The temp repo holds a copy of `tool/` (with a `tool/tests/x.test.js`, a `tool/move-app/x`, and a `tool/.env` holding one line that no test reads), committed, with `refs/remotes/origin/main` at its head. `HOME` is a temp folder. Stand-ins first on `PATH`: `swiftc` copies `/usr/bin/true` to the file after `-o` and marks it with an extended attribute; `security` prints the identities; `codesign` and `xcrun` only record. The test's own node's folder is last on `PATH`. The vendor folder's five programs are copies of `/usr/bin/true`, with a `lib/x.js`, a `LICENSE` and a licence, sealed with the real `vendor.js seal`.
  - "the bundle holds Studio's tool without tests, move-app, studio-app or a .env, and the programs appCopy names": the listing has no path with `/tests/`, `/move-app/`, `/studio-app/` or a `.env`; `Contents/Resources/node/bin` holds every name `appCopy()`'s `tools` folder holds (`tests/app-copy.js`), and `whisper-cli` but no `whisper-cpp`; `Contents/MacOS/BRIMM Video Studio` can be run; `install.sh`, `unedited.js`, `busy.js` and `setup/engine.js` are in the bundle's `tool/`.
  - "build.json is whole and names the commit": `buildOf(<bundle>/Contents/Resources/Studio)` has `broken: false`, the version and build given, and `commit` the repo's head.
  - "the Info.plist names the bundle, the program and the scheme, as install.sh needs them": read with `plutil -extract … raw`: `CFBundleIdentifier` `com.thebrimm.video-studio`, which matches `^[A-Za-z0-9.-]+$`; `CFBundleExecutable` `BRIMM Video Studio`, with no `/`, and `Contents/MacOS/<it>` can be run; `CFBundleURLTypes.0.CFBundleURLSchemes.0` `brimm-video-studio`; `LSMinimumSystemVersion` `13.0`.
  - "the bundle's own Studio loads, and its engine answers a status": one build whose vendor `node/bin/node` is a clone of the test's own node (`cpSync` with `COPYFILE_FICLONE`). With a temp `HOME`, the bundle's node runs the bundle's `tool/setup/engine.js --run status --app <app> --tools <bin> --protocol 1`: the last two events are a `status` summary with `needs: "setup"` and `done`, with exit 0. The same node imports every `tool/*.js` and `tool/setup/*.js` of the bundle without a throw, which shows that nothing left behind was needed.
  - "every program inside is signed before the app, node alone with its entitlements, and --deep is only on the verify": with `--sign`, the `codesign --force` lines in `ran`: the last is the app's; every other names a file under `Contents/Resources/node`; each holds `--options runtime --timestamp`; only `node/bin/node`'s holds `--entitlements`; none holds `--deep`; and the one line with `--verify` holds `--deep --strict` and comes after them all.
  - "without --sign every program is sealed ad hoc, in the same order": each line holds `--sign - --timestamp=none`, and `security` was never asked.
  - "the notarizing lines are printed and none is run": the output holds the three `xcrun` lines; `ran` holds no `xcrun`.
  - "the zip holds no ._ file and no extended attribute's shadow": `/usr/bin/unzip -Z1` lists no name beginning `._` and no `__MACOSX`.
  - "--print writes nothing and starts no compiler": the out folder is not made; `ran` holds no `swiftc` and no `codesign`; the output names the commit and both files.
  - "a vendor folder that is not sealed, or was sealed under other pins, stops the build before anything is written".
  - "it refuses a commit that is not on origin/main unless --any-commit, and uncommitted changes in tool/".
  - "it refuses an unknown option, a missing one, a version that is no semver, and --fake-engine with --sign", each with 2.
  - "signing needs exactly one Developer ID Application identity": none, and two, each end with 1 and the sentence with its count.
  - "it replaces only its own app and zip": another file in the out folder is as it was after a second build.
  - "an out folder the launch agent watches, or in Dropbox or the drop folder, is refused": as Task 3's test, with the temp home's launch agent file.
  - "--fake-engine leaves only the stand-in in the bundle's tool": the bundle's `tool/` holds exactly `package.json` and `setup/engine.js`, which has `dev/fake-engine.mjs`'s bytes; `FAKE-ENGINE.txt` is there. Without the option the marker is not there and `setup/engine.js` is the commit's.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-build.test.js`.** Expected: FAIL, since `build-app.sh` is not there.
- [ ] **Step 3: Write `build-app.sh`, `node.entitlements` and `README.md`.**
- [ ] **Step 4: Run `cd tool && node --test tests/studio-app-build.test.js tests/no-xcode-tools.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/studio-app/build-app.sh tool/studio-app/node.entitlements tool/studio-app/README.md tool/tests/studio-app-build.test.js`, then `git commit -m "Studio app phase 6: build-app.sh makes the bundle from one commit and a sealed vendor folder, signs inside-out and prints the notarizing steps"`.

---

## Final check

- [ ] Run `cd tool && node --test`. Expected: every test passes or skips with its reason, and `contract.test.js` passes with the same hashes.
- [ ] Run `cd tool && node tests/unused-exports.mjs`. Expected: nothing new is listed for `tool/*.js` and `tool/setup/*.js`. (It does not read `tool/studio-app/`.)
- [ ] Run `git diff --stat main -- tool/install.sh tool/setup/protocol.js tool/shared tool/lib.js tool/run.js tool/guide.js tool/guide-note.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures`. Expected: nothing.
- [ ] Run `git status --short`. Nothing is left over but `.cloudflare/`, and no file outside `tool/` and `docs/` was touched.
- [ ] With the pull request: correct the spec in the places "Where the spec and the code disagree" names; bring `docs/memory/progress.md` up to date (Phase 6, and its stale carried-forward line) and add to `docs/memory/gotchas.md` whatever the build taught (the print operation that must be run modally is one).
- [ ] The session that runs this plan adds a Phase 6 group to the Mac App By-Hand Checks page (https://claude.ai/artifact/VQVsatRKKwwYpzKW3GZPdA) with the ten checks below, each with its commands and a place for its result. The pull request links the page and holds none of the steps itself.

## By hand (on the Mac App By-Hand Checks page, each on Jason's yes)

Claude runs the Terminal steps it can reach; Jason does what is on screen.

1. **The vendor build**, on the Mac Studio: `build-vendor.sh --out <a folder in ~/Library/Caches>`. About fifteen minutes and 170 MB of downloads. It ends by naming the sealed folder and the source zip.
2. **The windows, with the stand-in engine**: an unsigned `--fake-engine --any-commit` build, opened on the Mac Studio. Each scenario is walked through: every kind of question, the bars, the review's Details, Done with the PDF opening in Preview, each error, the crash, Cancel, Back, quitting during Install, the status window and its Uninstall sheet. The build holds no installer, so it changes nothing on the Mac.
3. **The Mac Studio is refused**: an unsigned real build opened there shows the dev refusal and offers nothing, and its own `install.sh --print` refuses the Mac the same way.
4. **A signed build, notarized and stapled.** This sends the app to Apple.
5. **A first install from the zip in Studio Test** (a standard account, no Terminal): the move to the home's Applications folder, the copy opening untranslocated, then the setup as far as that account's apps allow.
6. **The names macOS shows**: the Files and Folders prompts and Login Items say BRIMM Video Studio.
7. **The PDF** has that Mac's folders, in Letter pages.
8. **After the app is dragged to another folder**, opening it repairs, and the background job's file names the new place.
9. **`open brimm-video-studio://check-for-updates`** brings the app's window to the front with the app running, and opens it when it is not.
10. **Uninstall** takes the background job away and leaves the folders, the settings and the model.

## Decided

Jason:
1. "Yes, plan Phase 6", then "Write the plan" (11 November 2026). The build plan stands: one pull request for the phase, built test first, and a push, a pull request or a merge only on his yes.
2. The update address is `updates.thebrimminsights.com`, the bucket `brimm-studio-updates`, the support contact `admin@growwiththebrimm.com` (9 November). He keeps the Sparkle key himself.
3. The main chat runs on Fable 5.2 and keeps the hard reasoning; coding, writing and reviews go to cheaper agents (11 November).

Claude's rulings, 2026-11-11 (Jason can overrule any of them):
4. `tool/studio-app/` is never in the bundle, and `no-xcode-tools.test.js` skips it for that reason.
5. Sparkle waits for Phase 7. `Check for Updates…` and the URL scheme are here now, with one function for Phase 7 to fill.
6. The vendored programs are built once by `build-vendor.sh` and sealed. The seal ties the folder to the pin file, so a pin that moves makes the old folder unusable. The built programs' own SHA-256s are in the seal, not in the repo.
7. The Swift that can be wrong quietly is in Foundation-only files and is tested through `studio-check`. The views are checked by a typecheck, by three tests of their text, and by hand.
8. The windows draw by a question's `kind`. No view knows a question's `id`, so the engine can add or reword a question without a new build of the shell.
9. The side list's step names are the shell's own copy, since the protocol sends a title only when a step is reached. A test holds the copy to the real engine's events.
10. Every launch asks the status first. A moved copy is repaired at once, as the spec says; a second copy is asked about; a refused Mac is offered nothing.
11. The shell reads two things itself and no settings: whether the launch agent's file is there, and whether a copy of the app is in the other Applications folder.
12. An app that is not translocated is set up where it is, even outside an Applications folder: a later move is repaired.
13. The move takes the quarantine flag off its own copy, as self-moving Mac apps do, after Gatekeeper and the person have passed the download.
14. Uninstall asks `busy.js` first and never stops a video that is being taken in.
15. The PDF is printed, not captured, so it has Letter pages, and the print is run modally on a window that is never shown.
16. The engine's environment is built from scratch; the background job's is launchd's own, unchanged.
17. The agent passes TERM, INT and HUP on to node. The spike did not, and node would have outlived its job.
18. The stand-in engine gets into an app only through a build option that refuses the Developer ID, marks the build on screen, and leaves the installer, `busy.js` and `unedited.js` out of the bundle.
19. `CFBundleShortVersionString` is the version without its pre-release part, and Sparkle will compare `CFBundleVersion`, the build number.
20. `install.sh` and the protocol are not changed. The status's three new lines are the only change under `tool/setup/`.
21. The shell's `Run` has no `update`: Phase 7 adds it with the code that starts it.
22. Three reviewers read this plan before it was committed (spec and rules, interfaces and testability, facts and feasibility with probes). Their findings are in it: a stand-in build can stop nothing, the print operation is run modally, the answers' values and what follows a status are tested against the real engine, and the move and Uninstall are tested.

## Open for Jason

1. **The bundle ID.** Recommended: `com.thebrimm.video-studio`, which every test since Phase 4 uses. Changing it after a Mac is set up loses that Mac's privacy answers.
2. **Claude Code's pin** (`tool/claude-code.pin.json`, Phase 5's first open question). Without it a Mac that has no Claude Code stops at the Apps step, so by-hand check 5 passes only on an account that already has it. Studio Test has it since S5.
3. **The first version and the build number.** Recommended: `1.0.0-beta.1`, build 1, each given to `build-app.sh` by hand, the build number going up by one with every build that leaves the Mac Studio.
4. **The feed's address.** Recommended: `https://updates.thebrimminsights.com/appcast.xml`, one feed, with beta builds marked by Sparkle's channel tag.
5. **ffmpeg's source.** Recommended: the source zip at `https://updates.thebrimminsights.com/source/`, named in a text file inside the app. It is published with the first release, in Phase 7.
6. **The "Open your BRIMM Video Studio folder in Claude" button.** Recommended: it opens the Claude app, and the guide says to pick the folder in the Code tab. If Claude has a link that opens a folder there, the button can use it.
7. **The app's icon.** There is none yet. The build takes `tool/studio-app/AppIcon.icns` when it is there, and uses macOS's plain icon until then.
8. **Whether Phase 6 ends with a signed, notarized build** (by-hand checks 4 to 10), or merges on the tests and checks 1 to 3, with the signed build at the start of Phase 7. Recommended: checks 1 to 3 before the merge, 4 to 10 after it.
9. **A macOS job in CI.** The Swift and build tests skip on GitHub's Linux, so they run only on the Mac Studio. A macOS runner costs about ten times Linux's minutes.
