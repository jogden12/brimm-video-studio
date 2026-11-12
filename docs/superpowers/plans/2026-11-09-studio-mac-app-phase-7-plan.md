# Phase 7: Sparkle and safe updates (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BRIMM Video Studio.app updates itself. It carries Sparkle 2, looks for a newer build only when the person asks, and lets Sparkle install one only when nothing is at work on the Mac. While an update is under way no new work starts. The new copy finishes the update the first time it is opened, whether or not Sparkle relaunched it. A new `release.sh` makes the signed appcast from a kept folder of releases and prints the publishing commands, which stay Jason's.

**Architecture:** The safety is in Node, where the tests are. `busy.js` gains a marker, `updating.json`, that is live for two minutes after it was last written; the watcher, its late-check loop and `edit.js` start nothing while it is live. The setup engine records the build that last set the Mac up, and its status says `needs: "update"` when the app's build is another. In the app, every decision of an update (when to wait, when to go, what a quit does) is in one Foundation-only file that `studio-check` tests; one small file holds everything that touches Sparkle. Sparkle comes from its own pinned archive, checked by its SHA-256 each time it is used, so the sealed vendor folder is not touched.

**Tech Stack:** Swift (language mode 5, macOS 13 APIs, AppKit, SwiftUI, Sparkle 2.10.1), compiled by `swiftc` from the Command Line Tools. zsh for the build scripts. Node 22 or later, ES modules, `node:test`, no packages. `plutil`, `ditto`, `tar`, `unzip`, `git` on macOS.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, part 5 (updates), part 1's Sparkle line, and part 3's "An update or a repair is the same run". The build plan's row 7 and "Verification", by hand 4 to 6: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`. The shell this phase changes: `docs/superpowers/plans/2026-11-09-studio-mac-app-phase-6-plan.md`. The spike: `spikes/2026-11-09-studio-mac-app/sparkle-spike/` and `pins.zsh`. Sparkle's own headers, read for this plan: `Sparkle.framework/Versions/B/Headers/SPUUpdater.h`, `SPUUpdaterDelegate.h`, `SPUStandardUpdaterController.h`, `SPUUserDriver.h`.

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end.
- **The tasks are built in order, one at a time.** Later tasks lean on the names the earlier ones make.
- Node 22 or later, and no packages. No Xcode project, no Swift package, no macro (`@Observable`, `#Preview`, `@State`). Only macOS 13 APIs. Every compile of the app's Swift uses `swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path <folder>`; a typecheck swaps `-O` for `-typecheck`.
- **Nothing is installed, signed with the Developer ID, sent to Apple, published, or loaded into launchd by a test or by Claude.** Tests reach `codesign`, `security`, `xcrun`, `curl`, `launchctl`, `cf`, `generate_keys` and `generate_appcast` only as stand-ins that write `name args` into a `ran` file. `build-app.sh`, `fetch-sparkle.sh` and `release.sh` are run by Claude only with `--print` or inside a test. A real build, a fetch, notarizing, a real `release.sh` and every publish are by-hand checks, each on Jason's yes.
- **No test starts Sparkle, reaches the network or asks the keychain.** No test runs a program that is inside an app bundle a test built.
- **Sparkle for the tests, while this phase is built:** `BRIMM_SPARKLE="$HOME/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1"`, spike S7's unpacked copy of the pinned archive. It is read only: nothing is written there. `fetch-sparkle.sh` is never run here without `--print`. A run in which the typecheck with Sparkle skipped does not count as a run with Sparkle.
- **The installer is only ever run with `--print`**, by a test or by hand. `install.sh` is not changed in this phase.
- No test writes outside a folder made for it. A test's home is a new folder, never this Mac's home, and never a drop folder. No script writes into a watched folder, a drop folder or Dropbox (`refuse_watched`, `tool/studio-app/common.zsh`).
- **The update key's private half never appears** in a file, a script's output, a test or chat. Scripts read only `generate_keys -p`, and keep what it prints only when it matches `^[A-Za-z0-9+/]{43}=$`. `generate_appcast` signs with the keychain's key itself.
- **The sealed vendor folder stays usable:** `tool/studio-app/vendor.pin.json` does not change by a byte.
- **The protocol stays version 1.** Its one change is the word `update` among a status's `needs` (Task 4). The shell and the engine always come from one bundle.
- **The shell never reads the settings.** It learns what this Mac needs from `--run status`. It reads one file of its own bundle, `build.json`, for its channel.
- **Commands stay compatible for one release** (spec, part 5): no `edit.js` command or flag, and no `unedited.js` argument, is removed or renamed. After an update the background job runs from the new bundle with the old launch agent's arguments until the update run has written it again.
- A pasted sign-in code is never kept or shown. The app's sources never log: no `print(`, `NSLog`, `os_log`, `Logger(` or `dump(` in `Sources/` (the test matches the letters `print(` anywhere, so no name may end in them).
- Never read a `.env` file.
- A download is data until its SHA-256 is the pin's. Nothing fetched is unpacked or run before that.
- The labels stay `com.thebrimm.unedited` and `com.thebrimm.claude-check`.
- **The BRIMM Ops contract.** Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes.
- Words a person reads say "BRIMM Video Studio", never "node", "Terminal", "engine" or "Sparkle". The engine's sentences are shown as they come. So are `busy.js`'s lines, which name the job's label and a process number, as Uninstall already shows them. The shell's own sentences are given in full in this plan: use them exactly.
- A line a person reads never names an episode's folder or a video's file.
- Comments are plain, full-sentence English, as in the rest of `tool/`.
- Tests that need a Mac, the Command Line Tools or Sparkle's framework skip themselves elsewhere and say why. No test runs `swiftc` to find out whether it is there: they ask `hasXcodeTools()` (`tool/helpers.js`).
- The repo is public: no account label, no private path, no client's name and no team ID in a committed file. The update key's public half is public and is committed.
- The line numbers are as of 0689c21, main after pull request 65. Find each one by the grep given.

## How an update goes

This is the design every task builds a part of.

**The marker.** `updating.json` sits in Studio's support folder, beside `settings.json` and `update-check.json`. It is live for two minutes (`UPDATING_HOLD_MS`) after it was last written, by the file's own time and never by its text. The app writes it again every thirty seconds while an update is under way. While it is live:
- a run of the watcher starts nothing and says so in its log;
- a watcher that is already running finishes its late checks and takes no new video in;
- every `edit.js` command but `behind` and `update` is refused with `BRIMM Video Studio is being updated on this Mac. Try again once it has finished.` The second half of a command already under way (`--now`, `app --when-ready`, started by Studio itself and never typed in a chat) is let through: it holds a lock, so the update waits for it.

`idleWhy` never looks at the marker. The marker stops work from starting; `idleWhy` says whether work is still going.

**The check, step by step.** The person chooses Check for Updates… (the menu, the status window's button, or `edit.js update`'s link). The app then goes through these phases, and is in none of them at any other time.
1. **Waiting.** The window shows its Check for Updates page. The app writes the marker, then asks `busy.js idle-why` every three seconds. While something is at work the page says so, with `busy.js`'s own line and a **Not now** button. Not now takes the marker away and asks the background job to look in the drop folder. After half an hour of waiting the app gives up the same way and says so.
2. **Offered.** When nothing is at work on two looks in a row, the app hands over to Sparkle's own window (`-[SPUUpdater checkForUpdates]`, which also finds a version the person skipped). Sparkle says the Mac is up to date, or offers the update and downloads it. If Sparkle's check ends with nothing unpacked, the app takes the marker away, asks the job to look, and shows the status again.
3. **Unpacked.** Once Sparkle starts to unpack an update, that update is installed when the app next ends. Sparkle's own header says so: "If the application terminates on its own, Sparkle will attempt to automatically install the update" (`SPUUserDriver.h:214`; `:90` says the same of an update the person dismissed). Only Skip in Sparkle's window cancels it (`SPUUserDriver.h:218`).
4. **Holding.** Install and Relaunch reaches `updater:shouldPostponeRelaunchForUpdate:untilInvokingBlock:`. The app always postpones, writes the marker, and looks until nothing is at work on two looks in a row.
5. **Installing.** The app calls Sparkle's block. Sparkle asks the app to quit, replaces the bundle and opens the new copy.

**A quit.** While waiting, a quit takes the marker away, asks the job to look, and quits. From Offered on, Sparkle may install at any quit, even with nothing unpacked in this session (an update kept from an earlier one: `SPUUpdater.h:100`). So from Offered on a quit, a log-out or a restart is held until nothing is at work, the marker is left to lapse by itself, and nothing is asked to look.

**After the swap.** The new copy's first `--run status` says `needs: "update"`, because the build that last set this Mac up is not the app's own. The app runs `--run update` at once, which is a repair with the settings the Mac already has: the launch agent, the folder for Claude, the HyperFrames pin, and the job started again. It ends on the engine's own words, `BRIMM Video Studio was updated on this Mac.` and `Start a new chat in Claude so it reads this version.` If Sparkle never relaunched the app, the same happens when the person next opens it, and until then `behind` says at the start of each session: `BRIMM Video Studio was updated on this Mac. Open it once so it finishes the update, then start a new chat.`

**A release.** `build-app.sh --sign`; then notarizing, stapling and the zip again, run by Claude on Jason's yes as in Phase 6. Then `release.sh` copies the stapled zip into the kept releases folder, runs Sparkle's `generate_appcast` there (which signs with the keychain's key and makes deltas from the earlier zips), checks the appcast with the same reader `behind` uses, and prints the `cf` commands: the zip and deltas first, the appcast last.

## What this phase assumes

Each assumption has one named place to change.

- **The Sparkle code compiles with the Command Line Tools alone.** Probed on the Mac Studio on 12 November 2026: a class that conforms to `SPUUpdaterDelegate`, makes `SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)`, calls `try updater.start()` and `updater.checkForUpdates()`, and implements `allowedChannels(for:)`, `updater(_:willExtractUpdate:)`, `updater(_:didExtractUpdate:)`, `updater(_:userDidMake:forUpdate:state:)`, `updater(_:didFinishUpdateCycleFor:error:)` and `updater(_:shouldPostponeRelaunchForUpdate:untilInvokingBlock:)` typechecks with no warning against Sparkle 2.10.1, with the flags above and `-F`. The same file inside `#if canImport(Sparkle)` with a fallback typechecks with no `-F`. The one place: `SparkleUpdater.swift` (Task 10).
- **From Check for Updates on, Sparkle may install when the app ends**, and the postpone hook may be skipped (`SPUUserDriver.h:90`, `:214-216`; `SPUUpdater.h:100`; `SPUUpdaterDelegate.h:345-348`). The one place: `updateQuit` (Task 9). By-hand check 8 proves the hold.
- **Sparkle installs over a copy in the home's Applications folder with no password** (S7, 9 November). A copy in `/Applications` opened by a person who is not an administrator is asked for an administrator's password by Sparkle itself; nothing here changes that.
- **`generate_appcast` keeps earlier items, makes deltas from the earlier zips in its folder, takes `--channel` for new items only, and reads the key from the keychain** (Sparkle's documentation and source, read 12 November; the spike made one item and no delta). The one place: `release.sh` (Task 11). By-hand checks 6 and 7 prove it.
- **A short version with a pre-release part passes notarizing and Gatekeeper.** `CFBundleShortVersionString` becomes `1.0.0-beta.2` (Where the spec and the code disagree, 6). The one place: `infoPlist` (Task 6). By-hand check 4 proves it.
- **The background job needs no stopping.** Sparkle watches one running application and does nothing about a job started from the same program. That is safe only because the marker lets no run start and the app waits until none is going. The one place: Task 2's three checks.
- **The bundle ID is `com.thebrimm.video-studio`** (Phase 6, Open for Jason 1). Sparkle's own preferences are kept under it.

## Where the spec and the code disagree

Each is settled here for this phase. The spec is corrected with the phase's pull request, not in a task.

1. **"An `updating.json` marker, which expires when its process is gone or after 30 minutes."** A marker that died with its process would let work start in the seconds between the app's end and the swap. A marker that lived thirty minutes would outlive an abandoned update. So it is live for two minutes after it was last written, and the app writes it every thirty seconds. The thirty minutes are kept as the longest the app holds new work back before Sparkle is asked, and again while Sparkle's window is open.
2. **"A single `idleWhy()` checks all of these."** `idleWhy` is as it was and never reads the marker. If it did, the app would wait on its own marker, the installer's own idle check would refuse the update run (exit 75), and Uninstall would refuse.
3. **"It stops the agent and installs."** The job is not unloaded. Every run of it starts nothing while the marker is live, and the app waits until none is going. An unloaded job would stay unloaded if the update were abandoned at the wrong moment, and nobody would be told.
4. **"After relaunching, it repairs."** Sparkle tells the new copy nothing, and it does not always relaunch. The engine records the build that set the Mac up, and the status says `update` when the app's build is another.
5. **"`release.sh --print`: builds the appcast and signs it with EdDSA."** `--print` prints and signs nothing. The real run signs, and is a by-hand step on Jason's yes, as `build-app.sh --sign` is (Open for Jason, 3).
6. **"`CFBundleShortVersionString` holds only the numbers before the hyphen"** (Phase 6). `generate_appcast` writes the appcast's version from that key, `behind` reads it, and Sparkle's window shows it, so a second beta would be offered as "1.0.0 (this Mac has 1.0.0-beta.1)". The key now holds the whole version. `CFBundleVersion`, the build number, is still what is compared.
7. **"Its seventh pin, Sparkle"** (Phase 6 plan). Sparkle has its own pin file. A seventh pin in `vendor.pin.json` would make the sealed vendor folder unusable and change the published source zip's bytes under the same name.
8. **Check for Updates… "on the status screen"** (Phase 6). It also works while setup is at a question, so a Mac that is not set up yet can take a newer build first, and after an update or a repair that stopped, so a mended release can reach that Mac.
9. **"Delta updates keep the downloads small."** `generate_appcast` makes them from the earlier zips in the releases folder. The first release has none.
10. **`busy.js` and a folder it cannot list.** It called that "nothing at work". A safety check fails toward busy: a runs folder or work folder that is there but cannot be listed now gives `Whether anything is at work on this Mac could not be told.` A folder that is not there is still nothing at work.
11. **The build plan's row 7** names `tool/studio-app/`, `release.sh` and `busy.js`. This phase also changes `unedited.js`, `filing.js`, `edit.js`, `update-check.js` and `tool/setup/`, and adds `tool/set-up.js`.
12. **"An EdDSA-signed appcast."** Each download is signed, and is checked before it is unpacked. The feed itself is not signed in this phase (Open for Jason, 9).

## Review Focus

1. **Sparkle is never handed the check while anything is at work.** Covered in Task 9: "the gate goes only after two idle answers in a row".
2. **Nothing new starts while the marker is live.** Covered in Task 2: "a run of the watcher starts nothing while an update is under way", "a watcher that is waiting for a late check takes no new video in", "every command but behind and update is refused" and "a second half typed in a chat is refused".
3. **A marker never holds a Mac for more than two minutes after its app is gone.** Covered in Task 1: "a marker is live for two minutes after it was written, and no longer".
4. **The marker never makes the Mac look busy.** Covered in Task 1: "idle-why says the same with a live marker". Covered in Task 4: "an update run goes through with a live marker, and takes it away".
5. **The new copy always finishes the update, and says so until it has.** Covered in Task 4: "an installed Mac set up by another build needs an update, and one with no record does too" and "behind says an update is not finished". Covered in Task 8: "what follows the real engine's status after an update".
6. **An update is never installed under a video.** Covered in Task 9: "once the update's window has the check, a quit waits for idle". Covered in Task 10: "a quit asks the update's rule where it used to end at once".
7. **A Mac is never left holding new work back.** Covered in Task 9: "waiting gives up after half an hour". Covered in Task 10: "every way back to the status ends the check first" and "the marker's commands run one at a time, in order". Covered in Task 4: "an installer that fails asks the job to look".
8. **The private key is never printed, and `--print` asks the keychain nothing.** Covered in Task 11: "--print runs neither generate_keys nor generate_appcast" and "what generate_keys prints is shown only when it is a public key".
9. **`behind` and Sparkle read the same appcast the same way.** Covered in Task 11: "a beta item is tagged beta and a stable one is not tagged" and "the new item is one behind's reader gives back".
10. **A build that no Mac should take is never released.** Covered in Task 11: "a build number that is not above every item's is refused, and so is a zip name the feed already has", "a beta version on the stable channel is refused, and a stable one on beta" and "a release that did not finish stops the next".
11. **Sparkle's parts are signed inside-out, in Sparkle's own order.** Covered in Task 7: "Sparkle's five parts are signed after node's programs and before the app, the downloader alone keeping its entitlements".
12. **An archive that is not the pinned one is never unpacked.** Covered in Task 5: "an archive whose SHA-256 is not the pin's is refused before it is unpacked".
13. **The development Mac and a stand-in build never start the updater.** Covered in Task 9: "where Check for Updates may be chosen".

## Files

| File | What it is |
| --- | --- |
| `tool/busy.js` | The marker: writing it, taking it away, whether it is live. Folders that cannot be listed. |
| `tool/unedited.js`, `tool/filing.js`, `tool/edit.js` | Start nothing while the marker is live. `behind` says when an update is not finished. |
| `tool/update-check.js` | Smaller caps on what an appcast may hold; the items with their own text. |
| `tool/set-up.js` (new) | The record of the build that set this Mac up. |
| `tool/setup/checks.js`, `summary.js`, `engine.js`, `protocol.js` | `needs: "update"`; the record written; the marker taken away before the installer. |
| `tool/studio-app/sparkle.pin.json`, `sparkle.js` (new) | Sparkle's archive, by version and SHA-256, and the update key's public half. |
| `tool/studio-app/fetch-sparkle.sh` (new) | Fetches the pinned archive and unpacks a copy for the tests. |
| `tool/studio-app/build-info.js` | Sparkle's keys in `Info.plist`; the whole version. |
| `tool/studio-app/build-app.sh`, `common.zsh`, `README.md` | Sparkle in the bundle, signed in its order. |
| `tool/studio-app/Sources/Core.swift`, `Flow.swift`, `AppModel.swift`, the views | The update run after a swap. |
| `tool/studio-app/Sources/Updates.swift` (new) | Foundation only: every decision of a check for updates, and its sentences. |
| `tool/studio-app/Sources/SparkleUpdater.swift` (new) | The one file that imports Sparkle. |
| `tool/studio-app/dev/fake-engine.mjs` | The stand-in learns the update run. |
| `tool/studio-app/release.js`, `release.sh` (new) | What may be released, the appcast, its check, and the publishing commands. |
| Tests | New: `busy-updating.test.js`, `edit-updating.test.js`, `set-up.test.js`, `studio-app-sparkle.test.js`, `studio-app-updates.test.js`, `studio-app-release.test.js`. Changed: `busy.test.js`, `unedited.test.js`, `filing.test.js`, `update-check.test.js`, `behind-installed.test.js`, `setup-summary.test.js`, `setup-engine.test.js`, `setup-harness.js`, `studio-app-build-info.test.js`, `studio-app-build.test.js`, `studio-app-core.test.js`, `studio-app-state.test.js`, `studio-app-model.test.js`, `studio-app-fake-engine.test.js`, `studio-app-check.js`, `load-each.test.js`. |

---

### Task 1: `busy.js`: the marker

**Files:**
- Modify: `tool/busy.js` (`grep -n 'updating.json\|export function idleWhy\|function foldersIn\|function importLockPid' tool/busy.js`)
- Test: `tool/tests/busy-updating.test.js` (new), `tool/tests/busy.test.js`

**Interfaces:**
- Consumes: `studioHome` (`tool/home.js`); `settingsFile` (`tool/settings.js`), for the support folder.
- Produces:
  - `UPDATING = "BRIMM Video Studio is being updated on this Mac. Try again once it has finished."`
  - `UPDATING_UNTOLD = "Whether BRIMM Video Studio is being updated on this Mac could not be told. Open BRIMM Video Studio and choose Repair."`
  - `UPDATING_HOLD_MS = 120000`
  - `updatingFile(home) -> string`: `updating.json` in the folder `settings.json` is in.
  - `markUpdating({ home, now }) -> boolean`: writes the marker; false when it could not.
  - `updatingWhy({ home, now }) -> string`: `UPDATING` while the marker is live, `UPDATING_UNTOLD` when it could not be looked at, else `""`.
  - `endUpdating({ home, kick }) -> void`: takes the marker away, then calls `kick()` when one is given.
  - The command line: `node busy.js updating begin` and `node busy.js updating end [--look]`.

**The rules:**
- The marker's text is `{"version":1,"at":"<now, ISO>"}` and a line feed, written to a temp file beside it. `markUpdating` then sets that file's access and modified times to `now` (`utimesSync`) and renames it into place. The support folder is made when it is not there. The command line gives `Date.now()`.
- Live means: the file is there, and its modified time is less than `UPDATING_HOLD_MS` before `now` and not more than `UPDATING_HOLD_MS` after it. An error whose code is `ENOENT` or `ENOTDIR` is no marker. Any other error gives `UPDATING_UNTOLD`. The text is never read.
- `endUpdating` never throws: a marker that is not there is no fault, and neither is a `kick` that throws.
- `node busy.js updating begin` ends with 0, or with 1 and `The update could not be marked on this Mac.` on stdout. `updating end` ends with 0. With `--look` it then runs `/bin/launchctl kickstart gui/<uid>/com.thebrimm.unedited` and ignores how that ends: it asks the job to take in what waited. Any other words end with 2 and `Say: node busy.js idle-why [--launchd -], or node busy.js updating begin, or node busy.js updating end [--look]`.
- **No test runs `updating end --look`**: it would reach this Mac's own job. A test in `busy-updating.test.js` reads every file in `tool/tests` and fails on a line that names `busy.js` (or the tests' `BUSY`) together with the quoted word `--look`. It builds that word as `"--" + "look"`, so it does not find itself, and it compares the usage line as one whole string.
- `idleWhy` does not read the marker.
- `idleWhy` and a folder it cannot list (Where the spec and the code disagree, 10): in `foldersIn` and `importLockPid`, an error whose code is `ENOENT` or `ENOTDIR` means nothing is there; any other error makes `idleWhy` give `CANNOT_TELL`.
- The comment at the top of `busy.js` ("Phase 7 adds the `updating.json` marker here.") is replaced by what the marker is.

- [ ] **Step 1: Write the failing tests.** A test that makes a folder with mode `000` skips for root (`process.getuid?.() === 0`), which reads such a folder, and puts the mode back in a `finally`.
  - In `busy-updating.test.js`, each with a temp home and a `now` of the test's own:
    - "a marker is live for two minutes after it was written, and no longer": after `markUpdating` at `now`, the file's modified time is `now`; `updatingWhy` is `UPDATING` at `now + 119000` and `""` at `now + 121000`.
    - "no marker is not live, and a marker from the far future is not live": no file gives `""`; after `markUpdating` at `now + 121000`, `updatingWhy` at `now` gives `""`.
    - "a marker that cannot be looked at is not told": the support folder with mode `000` gives `UPDATING_UNTOLD`.
    - "the marker is live by its time, whatever its text": a file holding `x`, with its time set to `now`, gives `UPDATING`.
    - "taking the marker away asks for a look, and never throws": `endUpdating` with a `kick` that counts is called once and the file is gone; with no marker and a `kick` that throws it returns.
    - "the command line marks and unmarks": `updating begin` ends with 0 and the file is there; `updating end` ends with 0 and it is gone; `updating`, `updating stop` and `idle-why x` end with 2 and the usage line. Each spawn passes `TMPDIR` and `BRIMM_VIDEO_HOME`, as `busy.test.js` does.
    - "no test asks this Mac's job to look".
  - In `busy.test.js`, through its own `whyOn`, so its check of every `idleWhy` call still passes:
    - "idle-why says the same with a live marker": for an idle home and for a home with a held import lock, the answer is the same with and without a marker.
    - "a runs folder or work folder that cannot be listed cannot be told, and one that is not there is nothing at work".
- [ ] **Step 2: Run `cd tool && node --test tests/busy-updating.test.js tests/busy.test.js`.** Expected: FAIL, since `markUpdating` is not exported.
- [ ] **Step 3: Write the code** to the rules above.
- [ ] **Step 4: Run the same two files, and `tests/install.test.js`** (the installer's idle check is `busy.js`'s). Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/busy.js tool/tests/busy-updating.test.js tool/tests/busy.test.js`, then `git commit -m "Studio app phase 7: the marker of an update under way, live for two minutes after it is written"`. Add the Co-Authored-By line from the session's attribution to every commit in this plan.

---

### Task 2: Nothing new starts while an update is under way

**Files:**
- Modify: `tool/unedited.js` (`grep -n 'const lockDir = deps.lockDir' tool/unedited.js`: 1531), `tool/filing.js` (`grep -n 'const importWaiting = async' tool/filing.js`: 1816), `tool/edit.js` (`grep -n 'export async function editMain\|from "./busy.js"' tool/edit.js`: 7181, 101)
- Test: `tool/tests/unedited.test.js`, `tool/tests/filing.test.js`, `tool/tests/edit-updating.test.js` (new)

**Interfaces:**
- Consumes: `updatingWhy`, `UPDATING`, `markUpdating` (Task 1).
- Produces: `deps.updating`, a function that gives the marker's line, or `""`, taken by `uneditedFolder` and `importEpisodes`. When none is given it is `() => updatingWhy({ home, now: Date.now() })`.

**The rules:**
- `uneditedFolder`, for every kind of folder, just before `const lockDir`, which is after the return for a drop folder this Mac has no settings for and before the runs folder is made: when `updating()` gives a line, it logs that line and then `Nothing was started. What is in the drop folder waits for the next look.`, and returns `[]`. No lock is taken and no folder is made.
- `importWaiting` returns at once while `updating()` gives a line. Late checks that fall due are still made (`finishDue` is not changed), so a run that was waiting ends and the Mac becomes idle. A run that is still going when the marker is taken away takes in what waited at its next look.
- `editMain`, once it knows the command is one of `COMMANDS` and before it runs it: when the marker's line is not `""` it says that line and returns 1. Three kinds of call are let through: `behind`; `update`; and a second half, which is a call whose first word after the command is `--now`, or `app` followed by `--when-ready`, made outside Claude Code: the context's environment (`ctx.deps.env`, else `process.env`) does not have `CLAUDECODE` set to `1`. A detached run is started with that variable taken away (`spawnDetached`, `tool/detached.js`), and a chat can type `--now`. The home is the context's, and the time is the context's `now()`.
- `edit.js` has one import line from `./busy.js`, which a test counts: the new names join it.
- Nothing else in the three files changes in this task. No command, flag or argument is renamed, and the skill is not changed: the sentence itself says what to do.

- [ ] **Step 1: Write the failing tests.**
  - In `unedited.test.js`, beside the test of a held lock (`grep -n 'Another run' tool/tests/unedited.test.js`): "a run of the watcher starts nothing while an update is under way": with `deps.updating` giving `UPDATING`, a drop folder holding a video gives `[]`, the log holds `UPDATING` and the line above, the test's lock folder is empty, no `.runs` folder is in the home, and the video is where it was.
  - In `filing.test.js`: "a watcher that is waiting for a late check takes no new video in": a run with one late check open, `updating` giving a line from its first wait on, and a second video put in the drop folder during the wait: the late check is made, the second video is not taken in, and the run ends. And "once the update is over it takes in what waited": the same with `updating` giving `""` again after one wait: the second video is taken in.
  - In `edit-updating.test.js`, driving `editMain` with a temp home as `edit-update.test.js` does, the marker written with `markUpdating({ home: <the context's home>, now: <the context's clock> })`:
    - "every command but behind and update is refused": each name in `COMMAND_NAMES` but those two says exactly `UPDATING` and gives 1, and starts no program (`deps.run` and `deps.start` are never called).
    - "behind, update and a second half go on": `behind` and `update` do not say `UPDATING`; `bring --now x` and `app --when-ready x` do not either, with no `CLAUDECODE` in `deps.env`.
    - "a second half typed in a chat is refused": with `deps.env.CLAUDECODE = "1"`, `bring --now x` and `app --when-ready x` say exactly `UPDATING` and give 1.
    - "with no marker nothing is refused for it": `status` does not say `UPDATING`.
- [ ] **Step 2: Run `cd tool && node --test tests/unedited.test.js tests/filing.test.js tests/edit-updating.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run the same files, and `tests/edit-update.test.js tests/behind-installed.test.js tests/busy.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: the watcher and edit.js start nothing while an update is under way"`.

---

### Task 3: `update-check.js`: smaller caps, and the items with their text

**Files:**
- Modify: `tool/update-check.js` (`grep -n 'APPCAST_MAX_CHARS\|export function parseAppcast\|function itemsIn' tool/update-check.js`)
- Test: `tool/tests/update-check.test.js`

**Interfaces:**
- Produces:
  - `APPCAST_MAX_CHARS = 262144`; `APPCAST_ITEM_MAX_CHARS = 16384`.
  - `appcastItems(xml) -> [{ build, version, channel, minimumSystemVersion, text }]`: the items `parseAppcast` keeps, in order, each with its own text from `<item` to `</item>`.
  - `parseAppcast(xml)` is `appcastItems` with `text` dropped: what it gives is unchanged for an appcast inside the caps.

**The rules:**
- A body longer than `APPCAST_MAX_CHARS` is no answer, as today with the larger number. The check is where it is now, in the read of the feed.
- An `<item>` longer than `APPCAST_ITEM_MAX_CHARS` is passed over; the items around it are read.
- This was carried from Phase 3: a hostile item cost time that grew with its square.

- [ ] **Step 1: Write the failing tests**:
  - "an item longer than 16,384 characters is passed over, and the others are read".
  - "a body longer than 262,144 characters is no answer", through `checkForUpdate` with a stand-in fetch, as the file's other feed tests do.
  - "an appcast as generate_appcast writes it is read whole": one item with `title`, `pubDate`, `sparkle:version`, `sparkle:shortVersionString` `1.0.0-beta.3`, `sparkle:channel` `beta`, `sparkle:minimumSystemVersion`, `sparkle:hardwareRequirements`, an `enclosure` with `sparkle:edSignature`, and a `sparkle:deltas` block of two enclosures: one item, build and version as given, channel `beta`.
  - "each item comes with its own text": `appcastItems` of two items gives two texts, each holding its own enclosure and not the other's.
- [ ] **Step 2: Run `cd tool && node --test tests/update-check.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run it again.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: an appcast's body and each of its items are capped, and an item can be had with its text"`.

---

### Task 4: The engine and `behind` know an updated copy

**Files:**
- Create: `tool/set-up.js`
- Modify: `tool/setup/checks.js` (`kindOf`), `tool/setup/summary.js` (`SETUP`, `statusSummary`), `tool/setup/engine.js` (`grep -n 'installWhenIdle\|"updated"\|programs = ' tool/setup/engine.js`), `tool/setup/protocol.js` (`grep -n 'NEEDS' tool/setup/protocol.js`: 16, 98), `tool/edit.js` (`behind`: `grep -n 'updateLine(await checkForUpdate' tool/edit.js`), `tool/tests/setup-harness.js`
- Test: `tool/tests/set-up.test.js` (new), `tool/tests/setup-summary.test.js`, `tool/tests/setup-engine.test.js`, the protocol's test (`grep -ln 'NEEDS' tool/tests/*.test.js`), `tool/tests/behind-installed.test.js`

**Interfaces:**
- Consumes: `endUpdating` (Task 1); `buildOf`, `isInstalled` (`tool/build.js`); `settingsFile` (`tool/settings.js`).
- Produces:
  - In `tool/set-up.js`: `setUpFile(home) -> string` (`set-up.json` in the support folder); `readSetUp(home) -> number | null` (the record's build, or null when there is no record or it cannot be read); `writeSetUp(home, build) -> boolean`; `UNFINISHED = "BRIMM Video Studio was updated on this Mac. Open it once so it finishes the update, then start a new chat."`; `unfinished(home, build) -> boolean`.
  - `kindOf` gives an installed Mac one more field, `setUpBy`: what `readSetUp` gives.
  - A status's `needs` is one of `nothing`, `setup`, `repair`, `update`.
  - The status's Setup line for an updated copy: `BRIMM Video Studio was updated on this Mac. It finishes the update when it is opened.` `SETUP` stays unexported: the tests use the sentence itself.

**The rules:**
- The record is `{"version":1,"build":<the build number>,"app":"<the version>"}` and a line feed, written to a temp file and renamed. `writeSetUp` takes the app's build as `buildOf` gives it.
- `unfinished(home, build)` is true only when `isInstalled(build)`, the build is not broken, and `readSetUp(home)` is not `build.build`.
- `statusSummary`: an installed Mac that was not moved, for which `unfinished` holds, has `needs: "update"` and the Setup line above. A moved copy is still `repair`. A checkout, and an app whose `build.json` cannot be read, never give `update`.
- A Mac with settings and no record needs an update. No Mac has been set up by the app before this phase, so this costs nothing, and it makes the first build with this phase write the record.
- The engine writes the record at the end of a setup, a repair or an update whose installer ended with 0, just before `done`. When it cannot be written the run still ends well, with one more note: `BRIMM Video Studio could not note this update, so it finishes it again the next time it is opened.`
- Every run that reaches the installer (`setup`, `repair`, `update`) first takes the marker away with `endUpdating({ home })`, with no `kick`: the installer starts the job itself. When the installer ends with anything but 0, or `installWhenIdle` gives up, the engine calls `endUpdating({ home, kick })` with a kick that runs its `programs.launchctl` with `kickstart gui/<uid>/com.thebrimm.unedited` and ignores how it ends: the videos that waited are then taken in though the run failed.
- `--run update` is otherwise as it is. It may be asked for on a Mac whose record is already this build.
- `behind`, in installed mode, after the lock's check and before the update line: when `unfinished(ctx.home, build)`, it says `UNFINISHED` first. The rest of what it says is as today.
- `setup-harness.js`: `mac({ settings, record = "this" })`. With installed settings, `this` writes the record of the app copy's own build (`WHOLE.build`, 142, and `WHOLE.version`), `older` writes build 141 and `1.4.1`, and `none` writes no record. `tests/app-copy.js` is not changed.

- [ ] **Step 1: Write the failing tests.**
  - `set-up.test.js`: "a record is written whole and read back"; "no record, a record that is not JSON and a record with no whole build number are each read as none"; "an update is unfinished only on an installed, readable build whose record is another's".
  - "an installed Mac set up by another build needs an update, and one with no record does too": `record: "older"` and `record: "none"` each give a status with `needs: "update"`, `ok: false` and the Setup line above; the default gives `nothing`.
  - "a moved copy needs a repair whatever its record", and "an app whose build file cannot be read never needs an update".
  - "a setup, a repair and an update each leave the record of this build": each run is made on `mac({ settings: "installed", record: "older" })` with the stand-in installer ending 0; afterwards `set-up.json` holds build 142 and `1.4.2`, and the next status says `nothing`. After an installer that ended 1 the record still says 141.
  - "a record that cannot be written is noted, and the run ends well".
  - "an update run goes through with a live marker, and takes it away": a marker written before `--run update`; the run ends `updated`, with the note `Start a new chat in Claude so it reads this version.`, and the marker is gone before the installer's call in `ran()`.
  - "an installer that fails asks the job to look": after an installer that ended 1, `ran()` holds one `launchctl kickstart` line, after the installer's; after one that ended 0 it holds none.
  - "the protocol takes update among a status's needs, and no other new word".
  - In `behind-installed.test.js`: "behind says an update is not finished": with a record of another build, and with none, the first line is `UNFINISHED`; with this build's record the line is not said.
- [ ] **Step 2: Run `cd tool && node --test tests/set-up.test.js tests/setup-summary.test.js tests/setup-engine.test.js tests/behind-installed.test.js` and the protocol's test.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run every `tests/setup-*.test.js`, `tests/set-up.test.js`, `tests/behind-installed.test.js`, `tests/load-each.test.js` and `tests/busy.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: the build that set a Mac up is recorded, and the status and behind say when the app is a newer one"`.

---

### Task 5: Sparkle's pin, and fetching it

**Files:**
- Create: `tool/studio-app/sparkle.pin.json`, `tool/studio-app/sparkle.js`, `tool/studio-app/fetch-sparkle.sh`
- Modify: `tool/studio-app/common.zsh`
- Test: `tool/tests/studio-app-sparkle.test.js` (new), `tool/tests/load-each.test.js` if it names the folder's files

**Interfaces:**
- Consumes: `isMain` (`tool/is-main.js`); `sha256_of`, `refuse_watched`, `stop` (`common.zsh`).
- Produces:
  - `sparkle.pin.json`: `{ "version": "2.10.1", "url": "https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz", "sha256": "1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27", "publicKey": "" }`. The first three are the spike's pin (`spikes/2026-11-09-studio-mac-app/pins.zsh`, pinned on Jason's yes on 9 November). `publicKey` is filled by by-hand check 2.
  - `readSparklePin(file) -> { pin } | { fault }`; `PUBLIC_KEY = /^[A-Za-z0-9+/]{43}=$/`.
  - `node sparkle.js pin` prints `version`, `url`, the url's last part and `sha256`, tab-separated. `node sparkle.js key` prints the public key, or ends with 1 and `The update key's public half is not in sparkle.pin.json yet. Reading it is a by-hand step.` `node sparkle.js check <archive>` ends with 0, or with 1 and `That is not the pinned Sparkle archive, so it was not unpacked.` Each reads the `sparkle.pin.json` in `sparkle.js`'s own folder.
  - `unpack_sparkle <archive> <folder>` in `common.zsh`: runs `node "$here/sparkle.js" check`, then `tar -xJf <archive> -C <folder>`, then stops unless `Sparkle.framework/Versions/B/Sparkle`, `bin/generate_appcast` and `bin/generate_keys` are there. The archive has no folder of its own at its top. Each script that uses it sets `here=${0:A:h}` first, as `build-app.sh` does.
  - `zsh tool/studio-app/fetch-sparkle.sh [--out <folder>] [--print]`. Without `--out` the folder is `~/Library/Caches/brimm-studio-app/sparkle`. It leaves `<folder>/Sparkle-<version>.tar.xz` and the unpacked `<folder>/Sparkle-<version>/`.

**The rules:**
- `readSparklePin` refuses, naming the key and never its value: any key but the four; a version that is empty or not one line; a url that is not https or has a user, a password, a query or a hash; a sha256 that is not 64 lowercase hex; a `publicKey` that is neither empty nor a match of `PUBLIC_KEY`.
- `fetch-sparkle.sh`: an unknown option ends with 2. `refuse_watched` for the folder, with its sentence as it is. An archive already there with the pin's SHA-256 is kept and not fetched again. Otherwise `curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output <file>.part <url>`, the same line `build-vendor.sh` uses; a file whose SHA-256 is not the pin's is renamed `.rejected` and the script stops with `Sparkle's download is not the pinned one, so it was set aside and nothing was unpacked.` Then `unpack_sparkle` into a fresh `Sparkle-<version>/`. `--print` says what it would fetch and where, makes no folder and starts no `curl`.
- `build-vendor.sh` and `vendor.pin.json` are not touched.
- Programs are named bare (`curl`, `tar`, `node`), so the test puts stand-ins first.

- [ ] **Step 1: Write the failing tests** in `studio-app-sparkle.test.js`. The script tests are `{ skip: notAMac }`. They use a made-up archive: a temp folder holding `Sparkle.framework/Versions/B/Sparkle`, `bin/generate_appcast` and `bin/generate_keys`, packed with `/usr/bin/tar -cJf`. They run copies: `tool/is-main.js` copied to `<temp>/is-main.js`, and `sparkle.js`, `common.zsh` and `fetch-sparkle.sh` to `<temp>/studio-app/`, beside a pin file that names the made-up archive's SHA-256.
  - "the pin file in the repo is whole, and names the spike's archive": `readSparklePin` of the real file gives the version, url and sha256 above.
  - "a pin with a key it should not have, or a bad url, sha256 or public key, is a fault that names the key".
  - "key says the public half, or that it is not there yet".
  - "an archive whose SHA-256 is not the pin's is refused before it is unpacked": `check` ends with 1 on a changed archive; `fetch-sparkle.sh` with a stand-in `curl` that writes other bytes ends with 1, leaves a `.rejected` file and no unpacked folder.
  - "it fetches once, checks, and unpacks": with a stand-in `curl` that copies the made-up archive, the archive and the unpacked folder are there; a second run starts no `curl`.
  - "--print fetches nothing and makes no folder".
  - "a folder the launch agent watches, the drop folder or Dropbox is refused".
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-sparkle.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run it, and `tests/load-each.test.js tests/studio-app-vendor.test.js`.** Expected: PASS, the vendor tests unchanged.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: Sparkle's archive by its own pin, checked before it is unpacked"`.

---

### Task 6: `build-info.js`: Sparkle's keys, and the whole version

**Files:**
- Modify: `tool/studio-app/build-info.js` (`grep -n 'function infoPlist\|optionsOf\|CFBundleShortVersionString' tool/studio-app/build-info.js`)
- Test: `tool/tests/studio-app-build-info.test.js`

**Interfaces:**
- Consumes: `PUBLIC_KEY` (Task 5).
- Produces: `infoPlist({ version, build, icon, publicKey }) -> string | { fault }`, and `node build-info.js plist --version <v> --build <n> --public-key <key> [--icon]`.

**The rules:**
- `CFBundleShortVersionString` is the whole version (`1.0.0-beta.2`). `CFBundleVersion` is still the build number.
- New keys, after the usage lines: `SUFeedURL` (`FEED`); `SUPublicEDKey` (the key); and five switches: `SUEnableAutomaticChecks` false, `SUAutomaticallyUpdate` false, `SUAllowsAutomaticUpdates` false, `SUEnableSystemProfiling` false, `SUVerifyUpdateBeforeExtraction` true.
- The faults come in this order: the version, the build (in the words `json` uses for them), then the key: `The update key's public half (--public-key) is not one that can be used.` The key's fault never repeats what was given. There is no plist without a key.
- `buildJson` is not changed.

- [ ] **Step 1: Change and add the tests.** Every existing call of `infoPlist` gives `publicKey`, and every `plist` command line gives `--public-key`, a made-up key: `"A".repeat(43) + "="`. The test of the app's names expects `CFBundleShortVersionString` `1.0.0-beta.1`. New:
  - "the Info.plist carries the feed, the key and the five switches": read back with `plutil -extract … raw` on a Mac; `plutil -lint` passes.
  - "a plist is never made without a public key, and the fault never repeats what was typed".
  - "a bad version or build is refused before the key, in json's words".
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-build-info.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run it again.** Expected: PASS. `tests/studio-app-build.test.js` fails until Task 7, which comes next.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: the Info.plist names the feed and the update key, and asks Sparkle to do nothing by itself"`.

---

### Task 7: `build-app.sh`: Sparkle in the bundle

**Files:**
- Modify: `tool/studio-app/build-app.sh` (`grep -n 'swiftc -O\|inside=\|codesign --force\|--vendor' tool/studio-app/build-app.sh`), `tool/studio-app/README.md`
- Test: `tool/tests/studio-app-build.test.js`

**Interfaces:**
- Consumes: `unpack_sparkle`, `node sparkle.js key` (Task 5); `node build-info.js plist --public-key` (Task 6).
- Produces: `zsh tool/studio-app/build-app.sh --out <folder> --version <semver> --build <n> --vendor <folder> --sparkle <archive> [--channel stable|beta] [--sign] [--any-commit] [--print] [--fake-engine]`. The bundle gains `Contents/Frameworks/Sparkle.framework` and `Contents/Resources/Licenses/Sparkle-LICENSE`.

**The rules:**
- A missing `--sparkle` ends with 2 and `Say where Sparkle is: --sparkle and the archive fetch-sparkle.sh fetched.`, after the version's and the build's faults. Two new refusals, each with 1 and before anything is written: `node sparkle.js check` says why; `node sparkle.js key` says why. Both run before `--print` prints.
- New steps, in the temp folder:
  - After the vendor folder's copy: `unpack_sparkle <archive> <temp>/sparkle`; `ditto <temp>/sparkle/Sparkle.framework Contents/Frameworks/Sparkle.framework`, which keeps the framework's links; Sparkle's `LICENSE` to `Contents/Resources/Licenses/Sparkle-LICENSE`.
  - `Info.plist` is made with `--public-key "$(node sparkle.js key)"`.
  - The compile: `swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path <temp> -F <temp>/sparkle -framework Sparkle -Xlinker -rpath -Xlinker @executable_path/../Frameworks -o "Contents/MacOS/BRIMM Video Studio" <every Sources/*.swift, sorted>`. The app's program is also the background job's, so a run path that is wrong stops both.
- Signing. The list is node's programs as today, sorted; then Sparkle's five parts in Sparkle's own order, each a path under `Contents/Frameworks/Sparkle.framework`: `Versions/B/XPCServices/Installer.xpc`, `Versions/B/XPCServices/Downloader.xpc`, `Versions/B/Autoupdate`, `Versions/B/Updater.app`, and the framework itself; then the app. A part that is not there stops the build. The downloader alone also gets `--preserve-metadata=entitlements`, with `--sign` and without. Node alone gets `--entitlements`. Never `--deep`.
- A stand-in build (`--fake-engine`) carries Sparkle the same way; its app never starts the updater (Task 9).
- With `--sign`, after the notarizing lines, one more: `Then the release: zsh tool/studio-app/release.sh --app "<app>" --releases <folder> --sparkle "<archive>" --print`.
- `README.md` gains: `fetch-sparkle.sh`, the `--sparkle` option, and where the release's own lines will be (Task 11 writes them).

- [ ] **Step 1: Change the tests first** in `studio-app-build.test.js`. `world()` gains a made-up Sparkle archive (as Task 5's, with `Updater.app/Contents/MacOS/Updater`, the two `.xpc` folders each with a program, `Autoupdate`, a `Versions/Current` link, a top-level `Sparkle` link, a `LICENSE` and `bin/`), and the temp repo's `sparkle.pin.json` names its SHA-256 and a made-up public key, committed. The existing tests change thus:
  - `needed()` gains `--sparkle <the made-up archive>`, and so do the two hand-written argument lists (the version `1.0` and build `0` cases, and the version fault's match).
  - The short version expected is `1.0.0-beta.1`.
  - The compile line's pattern is the new line, with `-F`, `-framework Sparkle` and the run path before `-o`.
  - In the signing test, node's lines are the forced lines before the first one under `Contents/Frameworks/`: each is under `Contents/Resources/node/`, they are sorted, and exactly one of them has `--entitlements`. Sparkle's five follow, then the app.
  New tests:
  - "Sparkle's five parts are signed after node's programs and before the app, the downloader alone keeping its entitlements": the forced lines' order, signed and ad hoc.
  - "the framework is in the bundle with its links": `Contents/Frameworks/Sparkle.framework/Versions/Current` is a link, and `Versions/B/Sparkle` a file.
  - "the Info.plist names the feed and the repo's public key".
  - "an archive that is not the pinned one, or a pin with no public key, stops the build before anything is written".
  - "--sparkle is needed", with 2.
  - "the release line is printed after the notarizing lines, and nothing of it is run".
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-build.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run it, and `tests/studio-app-build-info.test.js tests/studio-app-sparkle.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: the build carries Sparkle from its pinned archive and signs its parts in Sparkle's own order"`.

---

### Task 8: The shell finishes an update

**Files:**
- Modify: `tool/studio-app/Sources/AppModel.swift` (`grep -n 'enum Screen' -A2 tool/studio-app/Sources/AppModel.swift`; `startRepair`), `Flow.swift`, `Core.swift` (`Run`, `Next`, `nextStep`), `StatusViews.swift` (`RootView`'s switch), `SetupViews.swift` (`grep -n 'struct DoneView\|Repair stopped' tool/studio-app/Sources/SetupViews.swift`: 297, 355), `tool/studio-app/Check/main.swift` (`runOf`, `checkNext`, the lists of `needs` and `chosen` words), `tool/studio-app/dev/fake-engine.mjs` (`grep -n '"status", "setup", "repair"' tool/studio-app/dev/fake-engine.mjs`: 610)
- Test: `tool/tests/studio-app-core.test.js`, `studio-app-state.test.js`, `studio-app-model.test.js`, `studio-app-fake-engine.test.js`

**Interfaces:**
- Consumes: the engine's `needs: "update"`, its Setup line, and its `updated` outcome with its note (Task 4).
- Produces:
  - `enum Screen: String` moves from `AppModel.swift` to `Flow.swift`, which is Foundation only and already one of `studio-check`'s sources. Its cases are as they are, and it gains `updating`. A screen's raw value is the word `studio-check` takes.
  - `Run` has `update`. `engineCommand(run: .update, app:)` gives the engine's command with `--run update`.
  - `Next` has `update`. `nextStep`: `needs == "update"` gives `.update`, whether or not another copy is there and whether or not Repair was chosen: the engine says `update` only of the copy the Mac was set up from, and an update run is a repair.
  - `AppModel.startUpdate()`.
  - The shell's sentences: `updateHeading = "Finishing the update"`, `updateStopped = "The update stopped"`.

**The rules:**
- `begin` maps `.update` to `startUpdate()`: the screen is `updating`, and the run is `.update`. `RootView` draws `updating` with the page it draws `setup` and `repairing` with.
- That page's heading over the bars is `updateHeading` on the updating screen. Its failure heading (the line at 355) is `updateStopped` there; the `Repair stopped` and `Setup stopped` words stay for their screens.
- `DoneView`, for an outcome of `updated`, shows the done step's body and every note, as they came, and one button: `Button("Continue") { model.begin(chosen: nil) }`. It has no Close and no other button there. `startUpdate` calls no `begin` at the run's end, so the note stays until the person has read it.
- A run that fails shows the engine's own words under `updateStopped`, with the buttons the repairing page has on a failure. Nothing starts the run again until the app is opened again or Repair is chosen.
- `quitRule` is not changed: the installer is never stopped.
- The stand-in engine takes `--run update`. It gains the scenario `["updated", "An updated copy", "The next status says update."]`, whose status says `needs: "update"` with the real engine's Setup line, and whose update run ends `updated` with the real engine's done body and note. In the test, `SCENARIOS` gains `updated`, the lists of runs gain `update`, and `COPIED_FROM` gains `updated`, naming `setup/summary.js` for the message and `setup/engine.js` for the body and the note.

- [ ] **Step 1: Write the failing tests.**
  - `studio-app-core.test.js`: "engine-command update gives the engine's command" (the test at 57 expected 2 before, and is rewritten); "a status that needs an update is followed by the update run, alone, with Repair chosen, and with another copy there"; "a moved copy is still repaired, and a second copy still asked about". `checkNext` and `next-from-status` take `update` among their words.
  - `studio-app-state.test.js`: "what follows the real engine's status after an update": the real engine's status for `record: "older"` (Task 4's harness), fed to `next-from-status`, gives `update`. "the events of a real update run end updated, with its note".
  - `studio-app-model.test.js`: "an updated copy's last page has Continue alone": the text of `SetupViews.swift` from `struct DoneView` to `struct SetupPage` holds `"updated"` and `model.begin(chosen: nil)`; the body of `startUpdate` holds no `begin(`. "the update's page has its own two headings": `SetupViews.swift` holds `updateHeading` and `updateStopped`, and still holds `Repair stopped` and `Setup stopped`.
  - `studio-app-fake-engine.test.js`: "the stand-in takes an update run, in the real engine's words", and the shell understands every line of the new scenario.
- [ ] **Step 2: Run the four files.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run every `tests/studio-app-*.test.js`.** Expected: PASS, the typecheck with no warning.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: a copy that finds it is newer than the Mac's setup finishes the update, and stays on its last words"`.

---

### Task 9: `Updates.swift`: every decision of a check for updates

**Files:**
- Create: `tool/studio-app/Sources/Updates.swift`
- Modify: `tool/studio-app/Check/main.swift`, `tool/tests/studio-app-check.js` (`SOURCE_NAMES` gains `Updates.swift`)
- Test: `tool/tests/studio-app-updates.test.js` (new)

**Interfaces:**
- Consumes: `Command` and `uninstallCommands(app:)` (`Uninstall.swift`), for how `busy.js` is run; `Screen` (Task 8); `Quit` (`Flow.swift`).
- Produces, all Foundation only:
  - `enum UpdatePhase: String { case none, waiting, offered, unpacked, holding, installing }`.
  - `enum GateNext: Equatable { case wait(String), again, go, cannotTell }` and `gateNext(status: Int32, out: String, idleBefore: Bool) -> GateNext`.
  - `enum UpdateQuit: String { case now, end, hold }` and `updateQuit(_ phase: UpdatePhase) -> UpdateQuit`.
  - `mayCheckForUpdates(screen: Screen, quit: Quit, failure: String?, fake: Bool, phase: UpdatePhase) -> Bool`. `failure` is the failure's code, `colon` for the shell's own refusal of a colon in the app's path, and nil when nothing failed.
  - `keepsUpdatesAsk(screen: Screen) -> Bool`.
  - `markDue(now: Double, lastMarked: Double, began: Double, limited: Bool) -> Bool`, and `waitedTooLong(now: Double, began: Double) -> Bool`, with `updateMarkEvery = 30.0` and `updateMarkLimit = 1800.0`.
  - `allowedChannels(build: Data) -> [String]`.
  - `updatingCommands(app: String) -> (begin: Command, end: Command)?`: `<node> <tool>/busy.js updating begin` and `… updating end --look`, built as `uninstallCommands` builds the idle-why command, and nil where that gives nil.
  - `busyCannotTell = "Whether anything is at work on this Mac could not be told."`, `busy.js`'s own `CANNOT_TELL`.
  - The sentences:
    - `updatesHeading = "Check for Updates"`
    - `updatesWaiting = "BRIMM Video Studio looks for a newer version once nothing is at work on this Mac. New videos wait in the drop folder until then."`
    - `updatesOffered = "The check for updates is in its own window."`
    - `updatesUnpacked = "The update is ready. It is installed when BRIMM Video Studio closes, or when you choose Install now."`
    - `updatesHolding = "The update is installed once nothing is at work on this Mac."`
    - `updatesCannotTell = "BRIMM Video Studio could not tell whether it is at work, so it did not look for an update."`
    - `updatesWaitedTooLong = "BRIMM Video Studio waited half an hour for the work on this Mac to end, so it did not look for an update. Choose Check for Updates… again later."`
    - `updatesCannotStart = "BRIMM Video Studio could not look for updates. Open it again and choose Check for Updates… once more."`
    - `updatesStandIn = "This build's setup is a stand-in, so it does not look for updates."`
    - The buttons: `updatesNotNow = "Not now"`, `updatesShowWindow = "Show the update window"`, `updatesInstallNow = "Install now"`.

**The rules:**
- `gateNext`: status 0 with `idleBefore` gives `.go`; status 0 without gives `.again`. Status 1 whose first line is exactly `busyCannotTell` gives `.cannotTell`; any other status 1 gives `.wait` with the first line of `out`, or with `Something is at work on this Mac.` when there is none. Any other status gives `.cannotTell`.
- `updateQuit`: `.none` and `.installing` give `.now`; `.waiting` gives `.end`; `.offered`, `.unpacked` and `.holding` give `.hold`.
- `mayCheckForUpdates` is false for a stand-in build and while `phase` is not `.none`. Otherwise it is true:
  - on the status screen;
  - on the setup screen while `quit` is `.cancel` (a run is at a question and the installer has not begun);
  - on the updating and repairing screens once their run has failed (`quit` is `.now` and `failure` is not nil);
  - on the refused screen unless `failure` is `dev` or `colon`. The development Mac only ever shows refused, with `dev`. (Not so: see ruling 38, which is what was built.)
  It is false on every other screen and in every other state.
- `keepsUpdatesAsk`: true for the checking, repairing and updating screens, which pass by themselves, so a link that arrives then waits for the screen after. False for the others.
- `markDue`: true when `now - lastMarked >= updateMarkEvery` and, if `limited`, `now - began < updateMarkLimit`. `waitedTooLong`: `now - began >= updateMarkLimit`.
- `allowedChannels`: `["beta"]` when the JSON's `channel` is exactly `beta`; `[]` for anything else, and for bytes that are not JSON.
- `studio-check` gains, each printing one JSON value:
  - `gate-next <status> <idle-before yes|no>`, with `out` on stdin;
  - `update-quit <phase>`;
  - `may-check <screen> <now|cancel|wait> <failure code, or -> <fake yes|no> <phase>`;
  - `keeps-ask <screen>`;
  - `mark-due <now> <last marked> <began> <limited yes|no>` and `waited-too-long <now> <began>`;
  - `channels`, with the `build.json` on stdin;
  - `updating-commands <app>`;
  - and the new sentences and buttons under `names`.

- [ ] **Step 1: Write the failing tests** in `studio-app-updates.test.js`, `{ skip: noChecker }`.
  - "the gate goes only after two idle answers in a row": 0 then 0 goes; a 1 between starts the count again; 1 with a line waits with that line, and with no line waits with the fallback; 1 with `busy.js`'s cannot-tell line, 2 and 127 cannot tell.
  - "the cannot-tell line is busy.js's own": `busyCannotTell` equals `CANNOT_TELL` imported from `tool/busy.js`.
  - "once the update's window has the check, a quit waits for idle": `update-quit` gives `end` for waiting, `hold` for offered, unpacked and holding, and `now` for none and installing.
  - "where Check for Updates may be chosen": the status screen; the setup screen at a question and not once the installer runs; the updating and repairing screens only once their run has failed; the refused screen but for `dev` and `colon`; no other screen; never in a stand-in build; never while a check is under way.
  - "a link that arrives on a screen that passes by itself is kept".
  - "the marker is written every thirty seconds, and for half an hour where it is limited"; "waiting gives up after half an hour".
  - "a beta build allows the beta channel, and any other allows none".
  - "the two commands are busy.js's, from the bundle's own node".
  - "the sentences are the plan's": each constant, exactly.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-updates.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run every `tests/studio-app-*.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: when a check for updates waits, goes, gives up and holds a quit, in one file the tests can ask"`.

---

### Task 10: Sparkle in the app

**Files:**
- Create: `tool/studio-app/Sources/SparkleUpdater.swift`
- Modify: `tool/studio-app/Sources/AppModel.swift` (`grep -n 'func checkForUpdates\|noUpdatesYet\|func tick\|beginAsked' tool/studio-app/Sources/AppModel.swift`), `AppDelegate.swift` (`grep -n 'checkForUpdates\|updatesAsked\|case .now' tool/studio-app/Sources/AppDelegate.swift`), `StatusViews.swift` (`RootView`, and the new page), `Flow.swift` (`Screen` gains `updates`), `tool/tests/studio-app-check.js` (a helper that finds Sparkle for the tests)
- Test: `tool/tests/studio-app-model.test.js`

**Interfaces:**
- Consumes: everything Task 9 produces; `runToEnd`, `childEnvironment`; Sparkle 2.10.1's `SPUStandardUpdaterController`, `SPUUpdater`, `SPUUpdaterDelegate`.
- Produces:
  - `SparkleUpdater`, the only type that names Sparkle: `init(channels: [String])`; `startUpdater() -> Bool`; `check()`; `install()`; and four closures the model sets, `onUnpacked`, `onEnded`, `onSkipped` and `onInstallAsked`.
  - `sparkleForTests()` in `studio-app-check.js`: the folder that holds `Sparkle.framework`, from `BRIMM_SPARKLE`, else `~/Library/Caches/brimm-studio-app/sparkle/Sparkle-<the pin's version>`, else `null`.
  - On the model: `private let updater: SparkleUpdater`, a published `update: UpdatePhase` and `updateLine: String`.

**The rules:**
- `SparkleUpdater.swift` is the only file that imports Sparkle. After its opening comment its first line is `#if canImport(Sparkle)` and its last is `#endif`. The `#else` is a class with the same members whose `startUpdater()` gives false. A real build can never ship the `#else`: `build-app.sh` links the framework, and the link fails without it (Task 7).
- With Sparkle. `startUpdater()` makes `SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)` and calls `try updater.start()` the first time only, keeps whether that worked, and gives the kept answer every time after. `check()` is `updater.checkForUpdates()`. It keeps its channels as a set. The delegate's methods, as Sparkle's header declares them:
  - `allowedChannelsForUpdater:` gives the channels.
  - `updater:willExtractUpdate:` and `updater:didExtractUpdate:` each call `onUnpacked`.
  - `updater:userDidMakeChoice:forUpdate:state:` calls `onSkipped` when the choice is Skip.
  - `updater:didFinishUpdateCycleForUpdateCheck:error:` calls `onEnded`.
  - `updater:shouldPostponeRelaunchForUpdate:untilInvokingBlock:` keeps the block, calls `onInstallAsked` and returns true. `install()` calls the kept block once, on the main thread, and does nothing when none is kept.
- The model. Everything here is on the main thread but the programs it runs.
  1. **One queue for the marker.** Every `updating begin` and `updating end --look` the app runs goes through one serial queue, in the order asked. A `begin` whose turn comes when the phase is `.none` is dropped.
  2. **Ending a check.** Every way back to the status first sets the phase to `.none` and `updateLine` to `""`, then queues `updating end --look`, then calls `begin(chosen: nil)`. The ways are: Not now; `.cannotTell` while waiting; waiting too long; Sparkle's check ending while offered; and Skip.
  3. **Entering waiting or holding.** `idleBefore` is false, `began` is now, and `updating begin` is queued. The first idle-why is asked only after that `begin` has ended.
  4. **Check for Updates** (the menu, the button and the link all arrive here). Where `mayCheckForUpdates` is false, a stand-in build says `updatesStandIn` and everything else does nothing. Then `updater.startUpdater()`: false says `updatesCannotStart` and goes no further. On the setup screen the model calls `cancel()` and goes on only once the cancelled run's client has ended, as `beginAsked` waits. Then the screen is `updates` and the phase is `.waiting` (rule 3). A `begin` that does not end with 0 is `.cannotTell`.
  5. **Every tick while waiting or holding**, and never two at once, the idle-why command is run off the main thread and its answer given to `gateNext` with `idleBefore`:
     - `.again` sets `idleBefore`.
     - `.wait` clears `idleBefore` and shows the line in `updateLine`.
     - `.cannotTell` while waiting ends the check (rule 2) and says `updatesCannotTell`. While holding it clears `idleBefore`, shows `updatesCannotTell` in `updateLine`, and the looks go on: the marker stays, and nothing is asked to look.
     - `.go` while waiting sets `.offered`, takes a new `began`, and calls `updater.check()`.
     - `.go` while holding queues `updating begin`, and when that has ended sets `.installing`, calls `updater.install()`, and replies true to a quit that is waiting: both.
  6. **Sparkle's calls.** `onUnpacked` while offered sets `.unpacked`. `onEnded` while offered ends the check (rule 2); in any other phase it changes nothing. `onSkipped` while unpacked or holding ends the check and replies true to a quit that is waiting. `onInstallAsked` enters holding (rule 3).
  7. **The marker's upkeep.** Every tick while the phase is not `.none`, `markDue` decides whether `updating begin` is queued again. It is limited while waiting, offered and unpacked, and not while holding and installing.
  8. **Waiting too long.** A tick while waiting for which `waitedTooLong` holds ends the check and says `updatesWaitedTooLong`.
  9. **Not now** (shown only while waiting) ends the check.
- The model's timer keeps its apps rule: nothing here sends an apps check, and `shouldCheck` is not changed.
- The updates page shows `updatesHeading`, then by phase: waiting, `updatesWaiting`, `updateLine` and `updatesNotNow`; offered, `updatesOffered` and `updatesShowWindow`, which calls `updater.check()`; unpacked, `updatesUnpacked` and `updatesInstallNow`, which calls `updater.check()`; holding and installing, `updatesHolding` and `updateLine`. `RootView` draws it for the `updates` screen.
- `applicationShouldTerminate`. `mayQuit` and `model.quitAsked()` come first, as today, and `.cancel` and `.wait` are as today. In the place of `case .now: return .terminateNow`, `updateQuit(model.update)` is asked:
  - `.now` returns `.terminateNow`.
  - `.end` returns `.terminateLater`; the model sets `.none`, queues `updating end --look`, and replies true when that has ended.
  - `.hold` returns `.terminateLater`; the model notes that a quit is waiting, brings the window to the front on the updates page, and enters holding (rule 3) unless it is holding already. The reply comes from rule 5 or rule 6.
  It never answers `.terminateCancel`.
- The menu item is enabled by `mayCheckForUpdates` (`NSMenuItemValidation`). A link that arrives where a check may not be chosen is kept while `keepsUpdatesAsk`, and acted on at the first screen where it may; otherwise it only brings the window to the front, as today.
- `noUpdatesYet` and its use are removed.

- [ ] **Step 1: Write the failing tests** in `studio-app-model.test.js`.
  - "only one file names Sparkle, inside canImport": no file in `Sources/` but `SparkleUpdater.swift` holds Sparkle's import or a name beginning `SPU` or `SU`; in that file, the first line that is neither a comment nor blank is `#if canImport(Sparkle)`, and the last is `#endif`.
  - "the sources typecheck with Sparkle's framework": the existing typecheck with `-F <sparkleForTests()>`, no warning; it skips with `Sparkle is not on this Mac for the tests: set BRIMM_SPARKLE, or run fetch-sparkle.sh` when there is none. The existing typecheck with no `-F` still passes.
  - "the model asks the gate, and never decides itself": `AppModel.swift` holds `gateNext(`, `markDue(`, `waitedTooLong(` and `mayCheckForUpdates(`, and no `Process()`.
  - "a quit asks the update's rule where it used to end at once": in `AppDelegate.swift` the text between `case .now:` and the next `case` holds `updateQuit(`; the file holds no `.terminateCancel` and still holds the reply.
  - "every way back to the status ends the check first": in `AppModel.swift`, each place that names the end command sets `update = .none` before it.
  - "the marker's commands run one at a time, in order": `AppModel.swift` makes one serial `DispatchQueue` that both commands go through, and the begin's block looks at the phase before it runs.
  - "holding lets go once": the `.holding` branch of `.go` sets `.installing` before it calls `install()`; each place that sets `.waiting` or `.holding` sets `idleBefore = false`; the `.cannotTell` branch asks whether the phase is `.waiting` before it ends the check.
  - "the updater is started only when a check is asked for": `.startUpdater()` occurs once in `AppModel.swift`, inside `func checkForUpdates`, and in no other file but `SparkleUpdater.swift`; that file keeps whether it started.
  - "a skip ends the check": `onSkipped`'s handler sets `update = .none`.
  - "the page shows the plan's sentences and buttons": the view's source names each phase's sentence and the three buttons by their constants.
- [ ] **Step 2: Run `cd tool && BRIMM_SPARKLE="$HOME/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1" node --test tests/studio-app-model.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code.**
- [ ] **Step 4: Run every `tests/studio-app-*.test.js`, with `BRIMM_SPARKLE` set as above and again without it.** Expected: PASS both ways. The step is not done until the typecheck with Sparkle has run and passed, not skipped.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: Check for Updates waits until nothing is at work, hands over to Sparkle, and holds a quit from then on"`.

---

### Task 11: `release.sh`: the appcast, and what to publish

**Files:**
- Create: `tool/studio-app/release.js`, `tool/studio-app/release.sh`
- Modify: `tool/studio-app/README.md`
- Test: `tool/tests/studio-app-release.test.js` (new)

**Interfaces:**
- Consumes: `buildOf` (`tool/build.js`); `appcastItems`, `APPCAST_MAX_CHARS` (Task 3); `PUBLIC_KEY`, `unpack_sparkle` (Task 5); `refuse_watched`; `FEED` (`build-info.js`); `node vendor.js source-name`.
- Produces:
  - `RELEASES_URL = "https://updates.thebrimminsights.com/releases/"`, `BUCKET = "brimm-studio-updates"`.
  - `node release.js facts <app>` prints `version`, `build`, `channel` and the zip's name, tab-separated, from the app's own `build.json`.
  - `node release.js may <appcast, or a path that is not there> <version> <build> <channel> <zip name>` ends with 0, or with 1 and why.
  - `node release.js check <appcast> <version> <build> <channel> <zip name>` ends with 0, or with 1 and why.
  - `node release.js enclosures <appcast> <build>` prints the file name of each enclosure of that build's item, the zip first and then its deltas, one to a line.
  - `zsh tool/studio-app/release.sh --app <the stapled app> --releases <folder> --sparkle <archive> [--source <the GPL source zip>] [--print]`.

**The rules:**
- `may` refuses:
  - a version with a pre-release part whose channel is not `beta`, or one without whose channel is `beta`: `A beta version goes on the beta channel, and only a beta version does. Build it again with the right --channel.`;
  - an item in the appcast whose build is this build or higher: `Build <n> is not above the feed's newest, <m>. A release needs a higher build number.`;
  - an item of this version, or this zip's name in an enclosure: `The feed already has <version>. A release needs a new version.`
  No appcast is the first release and is allowed. (Tightened during the build: see ruling 42.)
- `check` reads the appcast through `appcastItems`. It refuses, each in one sentence that names what is wrong:
  - an appcast longer than `APPCAST_MAX_CHARS`, which `behind` would not read: `The appcast is longer than Studio reads. Take its oldest items out first.`;
  - no item with this build; an item of this build whose version is not this version; a beta build's item that is not tagged `beta`, or a stable build's item that is tagged at all;
  - this build's item without an enclosure whose `url` is `<RELEASES_URL><zip name>`;
  - any enclosure, of any item, whose `url` is not under `RELEASES_URL` or that has no `sparkle:edSignature` of 88 base64 characters.
- `release.sh`, in order. Options first (2 for an unknown or missing one). Then, each with 1:
  1. `refuse_watched` for `--releases`.
  2. `--app` is a folder named `BRIMM Video Studio.app`, and `node release.js facts` reads it.
  3. The zip beside the app, `BRIMM-Video-Studio-<version>.zip`, is there, and its listing holds the whole path `BRIMM Video Studio.app/Contents/CodeResources`, which only a stapled app has: `That zip was made before the app was stapled. Make it again first.`
  4. With `--source`, the file's name is `node vendor.js source-name`.
  5. `unfinished-release.txt` is not in the releases folder: `An earlier release here did not finish (<its text>). Put the folder right first: take that release's zip and deltas out, put appcast.xml.before back as appcast.xml, or remove appcast.xml when there is no appcast.xml.before, then remove unfinished-release.txt.`
  6. `node release.js may`.
  7. `node sparkle.js check <archive>`.
- `--print` then says each step it would take and `Nothing was done.`, and ends with 0. It makes no folder and starts neither `generate_keys`, `generate_appcast`, `xcrun` nor `cf`.
- The real run, after the same checks:
  1. `xcrun stapler validate "<app>"`, or it stops.
  2. `unpack_sparkle` into a temp folder that a trap removes.
  3. `<sparkle>/bin/generate_keys -p`. What it prints is kept only when it matches `PUBLIC_KEY`; anything else is not shown. It must equal the app's `SUPublicEDKey` (`plutil -extract SUPublicEDKey raw`): `This build carries another update key than the one in your login keychain, so no Mac would take the update. Nothing was written.`
  4. The releases folder is made when it is not there. `unfinished-release.txt` is written, holding the version. A copy of `appcast.xml`, when there is one, is kept as `appcast.xml.before`. The zip is copied in.
  5. `<sparkle>/bin/generate_appcast --download-url-prefix <RELEASES_URL> -o <releases>/appcast.xml <releases>`, with `--channel beta` before `-o` for a beta build and no channel for a stable one. macOS may ask Jason whether it may use the keychain.
  6. `node release.js check`, and every name `node release.js enclosures` gives is a file in the releases folder. A failure says the sentence, then `Nothing is to be published. The releases folder is as it was left: unfinished-release.txt says how to put it right.`, and ends with 1.
  7. `unfinished-release.txt` and `appcast.xml.before` are removed.
  8. It prints, and never runs, what to publish: `Publishing is a by-hand step, on Jason's yes. In this order, each only when the line before it answered:`. For each name `enclosures` gave: `cf r2 objects put "releases/<name>" --bucket-name brimm-studio-updates --file "<path>" --content-type <application/zip for the zip, application/octet-stream for a delta>`, then `curl -sI "<RELEASES_URL><name>"`. With `--source`, the same pair for `source/<its name>`. Then `Put the appcast only when each line above answered 200:`, `cf r2 objects put appcast.xml --bucket-name brimm-studio-updates --file "<releases>/appcast.xml" --content-type application/xml`, and `curl -sI <FEED>`.
- The releases folder is kept from one release to the next: `generate_appcast` makes deltas from the zips in it and keeps its own appcast there. `release.sh` deletes nothing in it but its own two files, once a run has ended well.
- Programs are named bare but for Sparkle's two, which are run from the unpacked archive.
- `README.md` gains the order of a release: the build, notarizing, `release.sh --print`, the real `release.sh`, then publishing.

- [ ] **Step 1: Write the failing tests** in `studio-app-release.test.js`. `release.js`'s tests need no Mac. The script's tests are `{ skip: notAMac }` and run copies, as Task 5's do: `release.sh`, `release.js`, `sparkle.js`, `common.zsh`, `build-info.js` and `vendor.js` in a temp `tool/studio-app`, with what they import one level up, beside a pin naming the made-up archive and key. The made-up stapled app has an `Info.plist` from `infoPlist`, a `build.json` from `buildJson`, a `Contents/CodeResources` file and a `Contents/_CodeSignature/CodeResources` file, zipped with `/usr/bin/ditto`; the unstapled one lacks only the first of those two. The made-up Sparkle archive's `bin/generate_keys` prints what `$KEY_SAYS` holds; its `bin/generate_appcast` copies `$APPCAST_SAYS` to its `-o` path and makes an empty file for each name in `$DELTAS_SAYS`; each writes its line to `$RAN`. `xcrun` and `cf` are stand-ins.
  - "a build number that is not above every item's is refused, and so is a zip name the feed already has"; "the first release needs no appcast".
  - "a beta version on the stable channel is refused, and a stable one on beta".
  - "a beta item is tagged beta and a stable one is not tagged": `check` passes each, and refuses a beta build's untagged item and a stable build's tagged one.
  - "the new item is one behind's reader gives back": `check` refuses an appcast whose item has another version, no signature, a short signature, or another url; an older item with an enclosure elsewhere or unsigned; and an appcast longer than the cap.
  - "the order of a release": `ran` holds `xcrun stapler validate`, then `generate_keys -p`, then `generate_appcast`, with the prefix and, for a beta build, `--channel beta`; it holds no `cf` and no `notarytool`.
  - "the publishing lines are printed in order and none is run": the zip's `cf` line and its `curl` line; a delta's, when the appcast names one, whether or not it was in the folder before the run; the source zip's with `--source`; the appcast's last.
  - "a file the appcast names that is not in the folder stops the run".
  - "--print runs neither generate_keys nor generate_appcast, and makes no folder".
  - "what generate_keys prints is shown only when it is a public key": with `$KEY_SAYS` holding other text, the script stops and its output holds none of that text.
  - "a build with another key stops before anything is written": the releases folder is not made.
  - "a zip made before stapling, an app with another name, a source zip with another name, and a watched or Dropbox releases folder are each refused".
  - "a release that did not finish stops the next": after a check that failed, `unfinished-release.txt` and `appcast.xml.before` are there, and a second run stops before `generate_keys`. After a run that ended well neither file is there.
  - "nothing else in the releases folder is deleted": an earlier zip and another file are as they were.
- [ ] **Step 2: Run `cd tool && node --test tests/studio-app-release.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code and the README's lines.**
- [ ] **Step 4: Run it, and `tests/load-each.test.js tests/no-xcode-tools.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Studio app phase 7: release.sh makes the signed appcast from the kept releases, checks it as behind reads it, and prints what to publish"`.

---

## Final check

- [ ] Run `cd tool && BRIMM_SPARKLE="$HOME/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1" node --test`. Expected: every test passes or skips with its reason, the typecheck with Sparkle among those that ran, and `contract.test.js` passes with the same hashes.
- [ ] Run `cd tool && node tests/unused-exports.mjs`. It counts neither tests nor `tool/studio-app` as users. Expected: the only new lines are `busy.js`'s `markUpdating`, `UPDATING_HOLD_MS` and `updatingFile`, and `update-check.js`'s `APPCAST_ITEM_MAX_CHARS` and `appcastItems`. (As built, three more, each in a task's Interfaces and used only by tests: `busy.js`'s `UPDATING` and `UPDATING_UNTOLD`, and `set-up.js`'s `setUpFile`.)
- [ ] Run `git diff --stat main -- tool/install.sh tool/studio-app/vendor.pin.json tool/studio-app/build-vendor.sh tool/studio/SKILL.md tool/shared tool/lib.js tool/run.js tool/guide.js tool/guide-note.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures`. Expected: nothing.
- [ ] Run `git status --short`. Nothing is left over but `.cloudflare/`, and no file outside `tool/` and `docs/` was touched.
- [ ] With the pull request: correct the spec in the places "Where the spec and the code disagree" names, and the build plan's row 7; bring `docs/memory/progress.md` up to date (it still says pull request 65 is not merged) and add to `docs/memory/gotchas.md` what the build taught.
- [ ] The session that runs this plan adds a Phase 7 group to the Mac App By-Hand Checks page (https://claude.ai/artifact/VQVsatRKKwwYpzKW3GZPdA) with the checks below, each with its commands and a place for its result. The pull request links the page and holds none of the steps itself.

## By hand (on the Mac App By-Hand Checks page, each on Jason's yes)

Claude runs the Terminal steps it can reach in Jason's own account; Jason does what is on screen, what is typed in Studio Test, and everything that publishes.

1. **Fetch Sparkle**, on the Mac Studio: `fetch-sparkle.sh`, a 16 MB download from GitHub, checked against the pin.
2. **The update key's public half**, once Jason has said which key it is (Open for Jason, 5): `generate_keys -p` from the fetched Sparkle, which reads his login keychain and prints only the public half. It goes into `sparkle.pin.json` in one commit. Before the pull request is merged.
3. **An unsigned build with Sparkle, on the Mac Studio**: it builds; the program names Sparkle by its run path; opened, it shows the development Mac's refusal and only Close, which shows the framework loads; the settings, the job and the support folder are as they were.
4. **A signed build, 1.0.0-beta.2, build 2, notarized and stapled.** This sends the app to Apple.
5. **1.0.0-beta.2 in Studio Test**, put over 1.0.0-beta.1 by hand from the zip: macOS asks once; it opens on Welcome.
6. **The first release**: `release.sh` for 1.0.0-beta.2 (Jason answers the keychain's box), then Jason publishes the zip, the GPL source zip and the appcast with `cf`. The addresses answer 200. In Studio Test, Check for Updates… says the Mac is up to date. The page notes that the source zip's own script needs Node 22.7 or later.
7. **A second release, 1.0.0-beta.3, build 3**: built, notarized, released (a delta is made) and published.
8. **The wait, Not now, and a held quit**, in Studio Test on 1.0.0-beta.2. The stand-in import is typed by Jason in that account's own Terminal, never in a drop folder: `mkdir -p ~/'BRIMM Video Work/.runs'; sleep 1800 & echo $! > ~/'BRIMM Video Work/.runs/brimm-transcribe-0000000000000000.lock'`, and ended with `kill %1; rm ~/'BRIMM Video Work/.runs/brimm-transcribe-0000000000000000.lock'`. With it held, Check for Updates… says an import is at work; Not now goes back. Again, and with the stand-in ended the check goes on within seconds and offers 1.0.0-beta.3; Install Update; once it is ready, hold the stand-in again and Quit: the app stays open and says why; end the stand-in: it closes. Opened again, it is 1.0.0-beta.3.
9. **Install and Relaunch, and Skip**, in Studio Test with 1.0.0-beta.2 put back by hand: Check for Updates… offers 1.0.0-beta.3 and says this Mac has 1.0.0-beta.2; Install Update; Skip once it is ready takes the app back to its first page within seconds, and a check can be asked for again; this time Install and Relaunch: no password, and it opens again as 1.0.0-beta.3.
10. **On the first Mac that is set up to the end** (the first MacBook, at Phase 8's start), set up from 1.0.0-beta.2's zip with a newer build on the feed: the update line at the start of a Code tab session (the build plan's by hand 4); "update Studio" opening the check and waiting for the same stand-in import (5); the update run after the relaunch, with its two sentences; the Files and Folders grants and Login Items as before (6).

## Decided

Jason:
1. The update address is `updates.thebrimminsights.com`, the bucket `brimm-studio-updates`, and he keeps the update key himself, in his login keychain (9 November 2026).
2. Sparkle 2.10.1's archive was pinned on his yes (9 November, spike S7).
3. The main chat runs on Fable 5.2; every subagent runs on Opus 5.5 (11 November). A push, a pull request and a merge each wait for his yes.
4. "First MacBook, later" (12 November), of Phase 6's checks 11 to 15, which need a Mac set up to the end.

Claude's rulings, 2026-11-12 (Jason can overrule any of them):
5. By-hand check 10 is the same kind as those checks, so it runs on the first MacBook too. The update run after a swap is therefore proved by hand only then; Studio Test proves the rest.
6. The marker is a file's time, not a process: live for two minutes after it was written, and written every thirty seconds.
7. The marker stops work from starting and is not a reason to call the Mac busy.
8. The background job is not unloaded for an update.
9. While an update is under way every `edit.js` command but `behind` and `update` is refused in one sentence. Refusing only the commands that start work would need each of thirty commands judged, and a wrong judgment is a video cut in half. The skill is not changed: the sentence says what to do.
10. The check for updates waits for idle before Sparkle is asked, not after it has an update. Sparkle's quiet look does not find a version the person skipped, and an update that is unpacked can no longer be held back from a quit.
11. The app waits at most half an hour for idle, and holds new work back for at most half an hour while Sparkle's window is open. An install or a quit that is waiting for idle holds new work back for as long as it waits.
12. From the moment Sparkle has the check, a quit waits until nothing is at work and never takes the marker away.
13. After such a quit nothing asks the job to look, so a video dropped in those minutes waits for the next drop, the next log-in or the app's next opening. Nothing is lost, and nothing is cut in half.
14. A Force Quit or a crash once an update is unpacked installs it at once. The marker keeps new work from starting, but work already going goes on across the swap. Accepted: the hold is what a person meets first.
15. An update that fails once it is unpacked leaves the app holding its quits, since Sparkle may still install it. Only Skip, which Sparkle says cancels it, ends the check.
16. The new copy learns that it is new from the engine's status, by a record the engine writes, and `behind` says so until the update is finished. A Mac with settings and no record needs an update.
17. Sparkle has its own pin and is checked by its archive's SHA-256 at every use. The sealed vendor folder, its programs and the source zip stay as they are.
18. The GPL source zip is published as Phase 6 made it. Its own script runs from the zip only on Node 22.7 or later, since the zip has no `package.json`; the By-Hand page says so beside check 6. Adding the file would change the zip's bytes under the same name.
19. Nothing is taken out of Sparkle's framework: its two unused services stay, signed, as in the spike that passed notarizing.
20. Sparkle looks only when asked. The daily look is `behind`'s, so the person hears of an update once, in Claude.
21. The updater is started when a check is asked for, never at launch, so the development Mac and a Mac that never asks start none.
22. Check for Updates… also works while setup is at a question, and after an update or a repair that stopped.
23. The update's pages are a screen of their own, so no engine run goes on beside a check and no other action's line overwrites its words.
24. `CFBundleShortVersionString` holds the whole version.
25. Downloads are under `releases/` in the bucket, and the feed is at its top.
26. A release that goes wrong is left for a person to put right, and stops the next release until it is. `release.sh` deletes nothing in the releases folder but its own two files.
27. Each release has a new version and a higher build number, and a beta version is always on the beta channel.
28. A runs folder or work folder that cannot be listed counts as "cannot tell".
29. `install.sh` is not changed. Its idle check is `busy.js`'s, so it gains ruling 28.
30. `refuse_watched`'s sentence, "a build never writes there", is left as it is for the two new scripts.
31. CLAUDE.md's lines about updates (the spec's last list) wait for Phase 8, with the rollout's other changes to it.
32. Four reviewers read this plan before it was committed (the spec and the rules; interfaces and tests; the code's facts; an attempt to break the update), and a sceptic checked each serious finding against the code. Fifty-six held and are in it. The two gravest were quits: a quit while Sparkle's window had the check took the marker away, and the quit's own rule was never reached.

Jason, during the build:
33. "Yes, build it" (12 November 2026). The update key is the one in his login keychain since the spike, with its backup found, and the bundle ID stays `com.thebrimm.video-studio` (By-Hand page checks 16 and 17, the same day). On his "Yes, read it", the key's public half was read with `generate_keys -p` and is in `sparkle.pin.json`.

Claude's rulings during the build, 2026-11-12 (Jason can overrule any of them). Where one of these and a task's rule differ, this is what was built:
34. Every run of setup, repair or update that got as far as its first check of the app's copy, and does not end with its installer at 0, ends by taking the marker away and asking the job to look, once (Task 4 named only a failed installer). A refusal before that check touches nothing and asks nothing, so the development Mac's job is never asked. The kick has a five-second limit, one constant in `busy.js`. The record is written only for an installed build that can be read.
35. A run of the watcher that is refused for the marker leaves a note, and `behind` asks the job to look once the marker has lapsed and nothing is at work. So a video dropped during an update that was abandoned is taken in at the next Claude session. This narrows ruling 13.
36. An error from Sparkle once an update is unpacked ends the check, as Skip does. A check that ends with no error once an update is unpacked does not: that update is still installed at a quit. The marker is limited to half an hour while installing too. This replaces ruling 15 and Task 10's rules 6 and 7.
37. A look that has gone twenty seconds is given up as "cannot tell", and its program is ended, so one look that never ends cannot leave a quit unanswered.
38. The refused screen offers a check only when its failure has a code that is none of `dev`, `colon` and `settings`. The development Mac can refuse with no code, or with `settings`, and a check there would mark its real support folder. This replaces Task 9's rule for that screen.
39. A check cannot be chosen while Uninstall or the move is working, no engine run starts while a check is under way, and a link that arrives during a run is acted on when that run ends.
40. `busy.js updating end --look` asks the job to look only when no `BRIMM_VIDEO_HOME` is set, so no test can reach this Mac's job.
41. The count of idle answers is a function of its own (`idleAfter`), so the tests can ask it.
42. `release.sh` takes `--first-release`, and without it refuses a folder that has no appcast. A mistyped folder would otherwise pass for a first release, and the printed last line would overwrite the live feed. This replaces Task 11's "No appcast is the first release and is allowed".
43. `release.sh` keeps `appcast.xml.before` before it writes `unfinished-release.txt`; its check also takes the appcast as it was and refuses an item this release did not make; every enclosure in the appcast's text is checked; and `generate_appcast` is told to keep every version (`--maximum-versions 0`).
44. A version with a pre-release part goes on the beta channel, and only such a version does. `buildJson` checks it, so the build refuses it too, before anything is signed.
45. Sparkle's pin takes only a version that is a version and an address whose last part is a plain `.tar.xz` name, and `unpack_sparkle` checks and unpacks one copy of the archive.
46. The controller made two small commits itself: the test that compares the app's end command puts the word together, so the guard on asking this Mac's job to look passes (the whole suite found it); and the key's public half, with its test.
47. The whole branch was read by four reviewers (the Node side's safety; the Swift shell; the build and the release; the tests, the rules and the plan), with a sceptic for each. Nothing critical was found. Twenty important findings held and one did not. They were fixed in one wave by three fixers on separate files, each re-reviewed, and a last list of five.

## Open for Jason

Answered on 12 November: 5 (the key in his keychain since the spike) and 7 (`com.thebrimm.video-studio`). The others stand at their recommendations, as built.

1. **Sparkle's own daily look.** Recommended: off, as ruling 20. The other way is a second notice, in the app's own window, on the days it is open. Built as recommended; the other way changes one switch in Task 6.
2. **The version macOS shows.** Recommended: the whole version, `1.0.0-beta.2`, in Finder, in the update's window and in the appcast. Apple's own format for that key is three numbers; Phase 6 kept to it, and a beta then reads as `1.0.0` everywhere but in Studio's own window. Built as recommended; the other way changes Task 6 and has `release.sh` write the version into the appcast itself.
3. **Who runs `release.sh` for real.** Recommended: Claude, on your yes each time, as with `build-app.sh --sign`; you answer the keychain's box, and every `cf` command is yours. The spec says Claude runs only `release.sh --print`.
4. **The releases folder.** Recommended: `~/BRIMM Video Work/App releases`, never in Dropbox, and in your own backup: the deltas are made from what it holds.
5. **The update key, before by-hand check 2.** Recommended: the one in your keychain since the spike, once you have confirmed its backup. A new key for the product is the other way. Either must be settled before the first build with this phase leaves the Mac Studio: a key cannot be dropped later, only changed with care.
6. **The spike's two files on R2** (`spike/appcast.xml` and its zip) are still public. Recommended: delete them after by-hand check 9.
7. **The bundle ID** (Phase 6, Open 1). Recommended: `com.thebrimm.video-studio`, as every build so far. It must be settled before the first MacBook: Sparkle keeps its own preferences under it too.
8. **A macOS job in CI** (Phase 6, Open 9). Recommended: not yet; the tests that need a Mac run on the Mac Studio before every pull request, as in Phase 6. This phase adds more of them.
9. **Signing the feed itself.** Recommended: not in this phase. Each download is signed and checked before it is unpacked, and a lower build is refused, so a feed that was tampered with can offer nothing a Mac would install. A signed feed adds one more thing that, done wrong, stops every Mac's updates for twenty days.
