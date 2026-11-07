# Move to Studio: picking the drop folder and the exports folder, the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At a MacBook's move, the Move to Studio app asks where videos are dropped and where HyperFrames' exports go. It shows macOS's own folder chooser for either, checks each pick, and hands Studio's installer exactly Phase 3's options. Any stop after the install began says where videos go now.

**Architecture:**
- `move.zsh` gains:
  - step 5's two questions;
  - the app's own folder checks;
  - a reader of the installer's print;
  - privacy notes;
  - marks for later runs;
  - a stop summary that knows whether the installer started;
  - an end-of-run count of the old Dropbox drop folder;
  - a try mode.
- **The chooser.** A small helper app, `Choose a Folder.app`, is compiled into the bundle. `open-in-terminal.zsh` recreates it in the temporary folder with no quarantine mark. The script starts it with `open -n -W`, and it answers through a result file. The second way, running its program directly, is the fallback.
- **The launcher** passes on an exact `--try-chooser`.
- **Studio's code.** Studio's own `settings.js` functions are asked through node for Finder's words, the cloud and the privacy questions, with a whole path when they can't be. Three tests tie the app to Phase 3's real code.

**Tech Stack:** zsh (`set -euo pipefail`); Swift (Foundation for the launcher, AppKit for the helper, `swiftc -target arm64-apple-macos13.0`); Node 22+ with `node:test`, no packages.

**Spec:** `docs/superpowers/specs/2026-11-06-move-app-folder-pickers-design.md`, version 5. Every quoted line of the app's words in it is exact copy. Read the spec's sections named in a task before its steps.

## Global Constraints

- **When it is built.** It is built after all of Phase 3 (`claude/studio-local-folder`, L1c and L9 included) is merged into main, on a branch from main then. If it is built earlier, it is built on `claude/studio-local-folder`, and main is merged in after Phase 3, with Task 7 run again.
- **Tests first.** Every step writes its failing test, then the code (CLAUDE.md).
- **Stand-ins only.** No test calls the real `claude`, opens a window or an app, or runs the real installer but Task 7's `--print`. No test writes outside its own temporary folder.
- **The installer** is only ever run with `--print`, unless Jason has said yes in chat. Nothing is installed on a Mac.
- **Words.** The app's words never name Sallie, and never say "her" of the person or the Mac (#42). They may name Jason, as "Tell Jason" does today. The report keeps the page's own labels.
- **Untouched.** The contract with BRIMM Ops (`tool/handoff*.js` and its fixtures), the copies `tool/shared/`, `tool/lib.js` and `tool/run.js`, and Phase 3's files.
- **Statuses.** Under `set -euo pipefail`:
  - every status that is not a stop is caught (`|| rc=$?`);
  - counters are changed with `x=$(( … ))`, never `(( … ))` alone;
  - an `if` is never written as `[[ … ]] && …` at a function's end;
  - every counter starts at 0;
  - a variable is declared first and assigned after (`local n; n="$(…)" || rc=$?`), never `local n=$(…)`, which hides the status;
  - the last command of a loop at a function's end counts as the function's end;
  - a result file is read only after `[[ -r … ]]`, with `|| content=""`;
  - a stop always goes through `stop_here`.
- **node.** Every node call made for words or answers keeps node's errors off the screen (`2>/dev/null`), and never ends the run. `settings.js` is never node's first argument, since its main guard would run it as a command. The call is install.sh's `lock_facts` form: `"$NODE" --input-type=module -e '…await import(pathToFileURL(join(process.argv[1], "settings.js")).href)…' "$STUDIO/tool" "<path>" "$HOME" 2>/dev/null`.
- **Agents.** Builders run on Sonnet 5.5 (claude-sonnet-5-5). Reviewers, skeptics and judges run on Opus 5.5 (Jason, 7 November: "Yes, Sonnet builders").
- **Merging.** Nothing is merged or pushed without Jason's yes.

## Review Focus

1. **A pick under Desktop, Documents, Downloads or iCloud Drive, on a Mac where Terminal was never let in.** The app must ask macOS once, refuse a drop folder it cannot look in, and never look inside Downloads.
2. **Names.** A folder name with spaces, a curly apostrophe, an accent, an emoji or a leading space must be passed whole and shown right. A line break must be refused, by the helper and by the app.
3. **Every rerun.** Each place a run can stop must lead the next double-click to the right question, with nothing asked twice that was settled, and nothing settled that wasn't. That means each question, each check, mid-install, after the install, and the Finder step.
4. **A chooser that never comes forward, hangs, or is closed by force.** The run must not hang, and keys typed meanwhile must not answer a question. That means `open` failing, no result file, the second way failing too, Control-C, and a closed window.
5. **A video put in the old Dropbox drop folder between runs, or while the install is half done.** It must be counted, and the person told where to put it, before anyone deletes the folder.

Each line has its tests, in the task that owns the code:
- 1 in Tasks 3 and 4;
- 2 in Tasks 1, 2 and 7;
- 3 in Task 5;
- 4 in Tasks 1, 2 and 7;
- 5 in Task 5.

## How each task is built

Each task follows `superpowers:subagent-driven-development`.
- A builder works in its own worktree, tests first.
- Reviewers then look through the spec, correctness, safety, the tests and integration.
- Each Critical or Important finding is checked by skeptics.
- A fixer runs, and the review loops until clean.

Run the move app's tests with `cd tool && node --test tests/move-app.test.js tests/move-app-build.test.js tests/move-app-ties.test.js`. Run the whole suite once a task ends: `cd tool && node --test`.

---

### Task 1. The chooser, the launcher, the build, the copy and the zip

**Spec:** "The chooser"; "The try mode" (how it is started).

**Goal:**
- `Choose a Folder.app` is in the bundle, signed before the app, and recreated with no quarantine mark beside the move script.
- The launcher passes on an exact `--try-chooser`, and `open-in-terminal.zsh` writes it into the `.command`.
- The zip carries no `._` entries.

**Files:**
- Create `tool/move-app/choose-folder.swift`.
- Modify `tool/move-app/launcher.swift`, `tool/move-app/build-app.sh` and `tool/move-app/open-in-terminal.zsh`.
- Test in `tool/tests/move-app-build.test.js`.

**Interfaces (produced):**
- **The program** `Choose a Folder.app/Contents/MacOS/Choose a Folder`.
  - **The first way:** `<message> <start folder> <result file> <process id>`.
    - It shows the panel, then writes `<result file>.part` and renames it to `<result file>`.
    - The file is `path\n<whole path>\n`, `cancel\n`, or `linebreak\n` when the chosen path holds a line break.
    - It ends 0 once the file is written. It ends 2 with one line on stderr only when the file cannot be written.
    - It watches the process id with `DispatchSource.makeProcessSource(identifier:eventMask: .exit)`. It checks it once at start, and ends 2 when that process is gone.
  - **The second way:** `<message> <start folder>`.
    - It prints the whole path and a newline, and ends 0.
    - Cancel ends 1.
    - A path with a line break ends 3 with one line.
  - **How it starts:**
    - `NSApplication.shared`, then its delegate, then `run()`;
    - `applicationDidFinishLaunching` only schedules the panel (`DispatchQueue.main.async { … runModal … }`) and returns, so the launch's open event is answered at once;
    - `runModal` is never called before `NSApp.run()`, or inside `applicationWillFinishLaunching` or `applicationDidFinishLaunching` themselves, or LaunchServices can time out (-1712, about a minute) and `open` ends 1 while the panel is still up;
    - the process-id source on a queue of its own;
    - `application(_:open:)` and `application(_:openFiles:)` answer by ignoring the request;
    - its arguments read from `CommandLine.arguments`.
  - **Either way:** fewer than two arguments, or a start folder that is not there, ends 2 with one line on stderr and opens no window.
  - **The panel:**
    - `canChooseDirectories` true, `canChooseFiles` false, `allowsMultipleSelection` false, `canCreateDirectories` true, `resolvesAliases` true;
    - `prompt` "Use This Folder", `message` the message, `directoryURL` the start folder;
    - level `.modalPanel`, `hidesOnDeactivate` false, `orderFrontRegardless()` once the modal session runs, and `.moveToActiveSpace` in its `collectionBehavior`.
  - **Before the panel:**
    - `NSApp.applicationIconImage = NSWorkspace.shared.icon(for: .folder)`;
    - `NSApp.activate()` on macOS 14 and later, `activate(ignoringOtherApps: true)` on 13;
    - `requestUserAttention(.criticalRequest)` if it is not active 0.5 s after the panel opens.
- **The helper's Info.plist:**
  - `CFBundleExecutable` "Choose a Folder";
  - `CFBundleIdentifier` "com.thebrimm.move-to-studio.choose-folder";
  - `CFBundleName` and `CFBundleDisplayName` "Choose a Folder";
  - `CFBundlePackageType` "APPL", `CFBundleInfoDictionaryVersion` "6.0", `CFBundleShortVersionString` "1.0", `CFBundleVersion` "1";
  - `LSMinimumSystemVersion` "13.0".
- **`launcher.swift`:** `helper.arguments = [resources + "/open-in-terminal.zsh"] + (CommandLine.arguments.dropFirst().contains("--try-chooser") ? ["--try-chooser"] : [])`.
- **`build-app.sh`:**
  - **The compile.** After the launcher: `swiftc -O -target arm64-apple-macos13.0 -module-cache-path <tmp> -o "<app>/Contents/Helpers/Choose a Folder.app/Contents/MacOS/Choose a Folder" <here>/choose-folder.swift`. It writes the helper's Info.plist, and runs `plutil -lint` on it.
  - **With `--sign`,** before the app's two lines:
    - `codesign --force --options runtime --timestamp --identifier com.thebrimm.move-to-studio.choose-folder --sign <identity> "<helper app>"`;
    - then `codesign --verify --strict --verbose=2 "<helper app>"`.
  - **Without `--sign`,** `codesign --force --sign - --timestamp=none --identifier com.thebrimm.move-to-studio.choose-folder "<helper app>"`, and its verify line, before the app's.
  - **The zip.** It is made with `ditto -c -k --norsrc --noextattr --keepParent`, and so is the printed command after stapling.
- **`open-in-terminal.zsh`:**
  - **The alert.** A missing `"${here:h}/Helpers/Choose a Folder.app"` gives the alert "This copy of the app is missing a part. Ask Jason for a new copy."
  - **The copy.** It recreates the helper beside `move.zsh` in the temporary folder: each folder with `mkdir -p`, each file through `cat -- <src> > <dest>`, then `chmod 755` on the program, on the same line as today's `chmod 755`. No `cp`, no `ditto`, no `xattr`. Its header comment says why: on this macOS, `cp -X` and `ditto --noqtn` keep `com.apple.quarantine`, and a redirect does not.
  - **The try.** `--try-chooser`, optionally followed by `--second-way`, makes the `.command` run `/bin/zsh '<folder>/move.zsh' --try-chooser [--second-way]`, with no `--commit`. Any other argument is passed over.

**Tests** (in `move-app-build.test.js`; the stand-in `swiftc` writes "x" to its `-o` file):
- **"builds the chooser into the bundle, with its Info.plist, after the launcher".**
  - A second `swiftc` line matches `^swiftc -O -target arm64-apple-macos13\.0 -module-cache-path (\S+) -o (.+\/Contents\/Helpers\/Choose a Folder\.app\/Contents\/MacOS\/Choose a Folder) (\S+\/choose-folder\.swift)$`.
  - The helper's Info.plist, as JSON, deep-equals the keys above.
  - The zip lists the helper's program and has no entry starting `._` or holding `/._`.
- **"signs the chooser first, with its own identifier, the hardened runtime and a timestamp, and verifies it"**, and **"seals the chooser ad hoc without --sign, before the app"**: by the lines' order in `ran`.
- **"zips with --norsrc --noextattr, and prints the same for after stapling".** The stand-in `swiftc` also runs `xattr -w com.example.mark yes` on its `-o` file, so a zip made the old way would hold a `._` entry and fail.
- **"the launcher passes on --try-chooser alone".** The source holds the line above. Where the real `swiftc` is there, the launcher is compiled into a made-up bundle whose `Resources/open-in-terminal.zsh` notes its arguments. Run with `--try-chooser -psn_0_1 x`, it is given `--try-chooser` alone. Run with nothing, it is given nothing.
- **"the chooser compiles at its real target, and with no arguments ends 2 within 10 seconds, opening nothing".** Where the real `swiftc` is there, `choose-folder.swift` is compiled into a temporary folder with `-target arm64-apple-macos13.0`, sharing one module cache, made in `before()`, with the launcher's existing type-check. This compile is its type-check. Run with no arguments, and with a start folder that is not there, it ends 2 with one stderr line. `spawnSync` gets `timeout: 10000`, and a timeout fails the test.
- **open-in-terminal.zsh.** The existing tests stay. The resources helper gains a stand-in `Helpers/Choose a Folder.app` with an Info.plist, a 755 program, and `_CodeSignature/CodeResources`.
  - "recreates the chooser beside the move script, with no quarantine mark":
    - mark every item of the stand-in helper with `com.apple.quarantine`, folders included;
    - every copied file must equal its source byte for byte;
    - the program must have its executable bit;
    - no copied item may show `com.apple.quarantine` by name (`com.apple.provenance` may be there).
  - "shows the missing-part alert, and opens nothing, without the chooser".
  - "--try-chooser, and --try-chooser --second-way, write the try's .command; other arguments are passed over".

**Steps:**
- [ ] Write the tests above.
- [ ] See them fail.
- [ ] Write `choose-folder.swift` and the launcher's line, then the build, the copy and the zip.
- [ ] See the two build test files pass.
- [ ] Commit.

### Task 2. The two questions, the chooser call and the options

**Spec:** "Step 5, in order", parts 1 and 2; "What the installer is given"; "The chooser" (the ways, the keys thrown away); "Other changes" (`--print`).

**Goal:**
- Step 5 asks the drop question and the exports question in the spec's words, with their three variants.
- On c it opens the chooser, by the first way and then the second, and throws away keys typed meanwhile.
- It says each pick, and builds `INSTALL_OPTIONS` from the answers.

**Files:**
- Modify `tool/move-app/move.zsh` and `tool/tests/move-app.test.js`.

**Interfaces (consumed):** Task 1's two ways.

**Interfaces (produced, in `move.zsh`):**
- **The chooser's settings.**
  - `CHOOSER_APP="${BRIMM_CHOOSER_APP:-${SELF:A:h}/Choose a Folder.app}"`, written after `SELF=`, since `set -u` ends the script on an unset `SELF`.
  - `CHOOSER_ROUTE=app`: a plain variable, `app` or `program`, naming which way goes first.
  - `THROWN=0`, with the run's other state.
- **`answer_of <line>`** prints `y`, `c` or nothing: y or yes, c or choose, in any case, with spaces round them.
- **`ask_y_or_c <words> <prompt> [c-only]`** says the words, reads one line as `ask_yes` does (logging it), and sets `ANSWER` to `y` or `c`. Anything else, or the end of input, stops through `stop_here`. With `c-only`, a y stops too.
- **`choose_folder <message> <start>`.**
  - It says the spec's Terminal line, then tries the first way of `CHOOSER_ROUTE`, then the other.
  - The app way runs `open -n -W "$CHOOSER_APP" --args "<message>" "<start>" "<result>" "$$" 2>/dev/null || rc=$?`, with `<result>` in a fresh `mktemp -d`. It reads the file first, and looks at `rc` only when there is none. It takes the path as everything after the first line, less one final newline.
  - When `open` leaves no result file, it polls every 0.5 s while `pgrep -f "$CHOOSER_APP/Contents/MacOS/Choose a Folder"` finds the program, with no time limit. Control-C still goes to the traps, and the helper ends with the script through its process-id watch.
  - Once the program has gone, it reads the result file again. It tries the program way only when the helper has gone and left no result.
  - The program way runs `"$CHOOSER_APP/Contents/MacOS/Choose a Folder" "<message>" "<start>" 2>/dev/null`, capturing stdout, with `|| rc=$?`. A 3 is the line break.
  - It returns:
    - 0 with `CHOSEN` set to the path made whole (`${path:A}`);
    - 1 on Cancel;
    - 3 for a line break;
    - 2 when neither way could show it.
  - Every way back runs `open -a Terminal || true`, then `throw_away_typed_keys`.
- **`throw_away_typed_keys`** is exactly the spec's block. It says the spec's sentence when this call's count is more than 0.
- **`words_for <path>`** prints Studio's `folderWords(path, $HOME)`, by the Global Constraints' node form. When that fails, or there is no node, it prints the path.
- **The drop question on a moved Mac** says the spec's "Today the drop folder is …" line first.
- **`ask_drop_folder` and `ask_exports_folder`** run their questions and their re-asks.
  - They set:
    - `DROP_FOLDER` and `EXPORTS_FOLDER`, whole paths;
    - `DROP_KEPT` and `EXPORTS_KEPT`: yes when the settings' folder is kept;
    - `DROP_FROM` and `EXPORTS_FROM`: `suggested`, `settings`, `last` or `picked`.
  - The settings' drop folder is `dropPath`, read with `plutil`. Its words come from `words_for`.
  - The exports folder of the settings is `exportsPath`, read with `plutil`, only when it is not Downloads by real path.
  - The last-time folders are the marks `drop=` and `exports=`.
  - The exports chooser starts in `$HOME`.
  - When the answer is `c-only` and `choose_folder` returns 2, the run stops with the spec's words for that refusal's kind (Task 3).
  - When `DROP_FROM` was `last` and another folder is picked, it says the spec's line about the folder left behind, in Finder's words, with its count.
- **`set_install_options`** sets `INSTALL_OPTIONS=(--machine "$MACHINE" [--drop-folder "$DROP_FOLDER"] [--exports-folder "$EXPORTS_FOLDER"] --import light --handoff 2)`, by the spec's "What the installer is given". `which_mac` no longer sets `INSTALL_OPTIONS`.
- **`run_the_installer`** calls `ask_drop_folder`, `ask_exports_folder` and `set_install_options` before its print, unless the install finished at this commit already.
  - Under `--print` it asks nothing, opens no chooser, says the spec's "Would ask …" line, and uses the folders y would give.

**The harness gains** (spec, "Testing", "What the harness gains"), all in this task, since Tasks 3 to 6 need them:
- `moveOn` options:
  - `dropPath` (`"<HOME>/…"`), with `drop` kept or taken out (`settingsChange`), and `exportsPath`;
  - `folderFiles: { "<HOME>/…": [names] }` and `folderModes: { "<HOME>/…": 0o000 }`, set after `before`, and put back before `tree`;
  - `picks`: answers for the stand-in `open`'s chooser call: `"<HOME>/…"`, `"cancel"`, `"linebreak"`, `"nofile"` or `"fail"`;
  - `program`: answers for the stand-in helper's second way: `"<HOME>/…"`, `"cancel"`, `"two"` or `"missing"`;
  - `agentWatches`: a list of folders the stand-in unedited plist's `WatchPaths` name, with `agentLoaded`, true or false.
- Every home gets `Downloads`.
- **A second run in the same home.** `moveOn` returns `again(options)`, which runs the move script again in the same home, the same "GitHub" repo and the same clone, and returns the same shape for that run alone.
  - It takes the per-run options: `answers`, args, `env`, `picks`, `program`, `launchctl`/`launchctlLater`, `agentLoaded`, and `install`'s `print`, `printExit`, `ran`, `ranExit` and `noBackground`.
  - Every stand-in reads these from files in the test's own folder, which `again` rewrites. None reads them from the committed clone, which step 3 needs clean.
- **Defaults that keep today's tests meaning what they meant:**
  - the default marks gain `finder=SHA`;
  - a moved Mac's default agent is loaded, with `WatchPaths` naming `Drop › <Mac>`;
  - the stand-in `launchctl` answers `list com.thebrimm.unedited` from `agentLoaded` without touching its counter for `list`.
- **Today's tests.** Each test whose run reaches step 5 adds the two new answers (`y\ny\n`), and the option string changes. "The old ones still pass" means after these changes, which are listed in the commit.
  - The `open -R` expectations in today's tests become the suggested `<HOME>/BRIMM Video Work/Drop`, since the stand-in `--yes` now writes `dropPath`.
  - With `writesSettings`, `dropPath` is written after the new settings, so that it is kept.
  - `y\ny\n` is added only where the install question is actually asked. Runs that start with the default marks (the installer finished at the pin) keep their answers.
  - `LABELS` changes move from Task 2 to Task 5, where the report's lines arrive.
  - In `moveOn`, when the settings have `dropPath` and no `drop`, the made-up drop folder (`.DS_Store`, `.brimm-watched-by`, `dropFiles`, `dropMode`) is made at `dropPath`.
- **The fake `settings.js` for Studio's checkout:**
  - it has `settings.js`'s own main guard, so importing it runs nothing;
  - `show` prints `  Its drop folder:  <dropPath, or root/drop/machine>` and `  Exports from HyperFrames, looked for in:  <exportsPath, or HOME/Downloads>`;
  - it exports `folderWords` (the folders after the home, joined with " › ", then ", in your home folder"), `cloudFolder` ("Dropbox" under `<HOME>/Dropbox` or `<HOME>/Library/CloudStorage/Dropbox*`, else "") and `needsFilesAccess` (true under `<HOME>/Desktop` or `<HOME>/Documents`);
  - its `set --app hyperframes` is as today.

  The old checkout's fake keeps only `show` and `set`.
- **The stand-in `open`:**
  - For `open -n -W <app> --args <message> <start> <result> <pid>`, it checks `<app>` is `BRIMM_CHOOSER_APP`, then takes the next pick: it writes the result, writes nothing (`nofile`), or ends 1 (`fail`).
  - It notes `chooser <message> | <start>` in `ran`, and on its own stdout, so that `out` holds it in order with what the script says. It never writes into the home.
  - It writes each argument it was given on a line of its own into `ran`, so a test can see a name passed whole.
  - Its `-a Safari` part stays as today, and it notes `-a Terminal`.
- **The stand-in helper** at `BRIMM_CHOOSER_APP`: its `Contents/MacOS/Choose a Folder` answers the second way from `program`.
- **The stand-in installer:**
  - `install.print` and `install.printExit` take lists, one a call, the last repeating;
  - `--yes` writes `dropPath` and `exportsPath` from `--drop-folder` and `--exports-folder`, makes that drop folder, and prints `DEFAULT_RAN`. `install.noBackground` leaves out its "From the background job:" line.
- **The stand-in `launchctl list com.thebrimm.unedited`** ends 0 when `agentLoaded`. The plist file is written from `agentWatches`.
- The env sets `BRIMM_CHOOSER_APP` to the stand-in helper's path.

**Tests** (whole runs with `moveOn`; pure parts sourced):
- "takes c, C and ' c ' as choose, and y as before" (sourced `answer_of`).
- "y and y give --drop-folder <HOME>/BRIMM Video Work/Drop and no --exports-folder, in the print and in the real run".
- "c opens the chooser in the home folder with the drop message, says the pick in Finder's words, and gives it to the installer". In order:
  - Terminal's line;
  - the `chooser` log line;
  - `open -a Terminal`;
  - `Picked: …`;
  - the options.
- "Cancel asks again; the end of input then stops with nothing run for real".
- "a pick that arrives after `open` has ended 1 is still taken": a stand-in `open` starts a background stand-in helper that writes the pick about 2 s later, and ends 1 at once. The run takes that pick, and never calls the program.
- "the first way not shown: the second way is tried". This is checked for `nofile` and for `fail`, then for the second way answering a path, `cancel` and `two`.
- "neither way shown: asked again, and y takes the suggested folder". The c-alone case is Task 3's.
- "a name with a space, an apostrophe, an accent and an emoji reaches the installer whole", from the stand-ins' lines in `ran`.
- Sourced tests that reach `choose_folder` put a stand-in `open` first on PATH, and set `BRIMM_CHOOSER_APP` before sourcing.
- "a line break from the chooser is refused by the app's line, and asked again" (`linebreak`).
- "answers piped after the chooser are still read".
- "the exports question":
  - y gives no option;
  - Downloads picked through a link gives none;
  - another folder gives `--exports-folder` and the D12 note with "Never export into the drop folder.";
  - an `exportsPath` naming Downloads is not a kept folder;
  - going back to Downloads from another `exportsPath` gives `--exports-folder <HOME>/Downloads`.
- "a Mac whose settings have dropPath: y keeps it with no drop option; c gives --drop-folder".
- "a folder picked last time is offered again; held to the empty check; and, when another is picked, named with its count".
- "under --print: no chooser and no question, the would line, and the installer's print with the folders y would give, keeping dropPath and exportsPath".
- "the second way, sourced: a path; Cancel (1); 2 with a sentence; a missing program".
- The current tests' option string, `--machine Sallie's laptop --drop Drop --import light --handoff 2`, becomes the new line wherever it is asserted.

**Steps:**
- [ ] Write the harness gains and the tests.
- [ ] See the new tests fail, and the old ones still pass.
- [ ] Write the functions.
- [ ] See the move app's tests pass.
- [ ] Commit.

### Task 3. The app's own checks

**Spec:** "The app's own checks".

**Goal:** Each pick is checked right after it is made. A refused one is asked again, with c alone when y would give the same folder again.

**Files:**
- Modify `tool/move-app/move.zsh` and `tool/tests/move-app.test.js`.

**Interfaces (produced):**
- **`same_or_nested <a> <b>`**: true when one is the other or inside it. It compares by real path (`${p:A}`), with letter case folded (`${(L)…}`), and treats a missing part as spelled.
- **`count_entries <folder>`** prints the number of entries but `.DS_Store` and `.brimm-watched-by`. It names no entry. `look_at_import_and_drop` uses it too.
  - A folder is "not there", and prints 0, only when the folder that holds it can be listed and the name is absent from it.
  - It returns 2 when the folder, or the folder that holds it, cannot be listed.
- **`plist_watch_paths <file>`** prints a plist's `WatchPaths`, one a line, as install.sh reads them: `count="$(plutil -extract WatchPaths raw -o - "$f" 2>/dev/null)" || return 0; [[ $count == <-> ]] || return 0`, then `WatchPaths.$i raw` for each index. No JSON is read, so no node is needed.
- **`transcript_folders`** prints, one a line, `"${ROOT:A:h}/BRIMM VIDEO Transfer"` and `plist_watch_paths` of `~/Library/LaunchAgents/com.thebrimm.transcribe.plist`, and of its `.plist.off`.
- **`in_downloads <path>`**: true when the path is `$HOME/Downloads`, or inside it, by real path.
- **`drop_folder_fault <path> <from>`** prints the spec's refusal words, in this order, and prints nothing when the folder will do. It sets `FAULT_KIND` to `linebreak`, `transcript`, `cannot-look` or `not-empty`.
  - a line break;
  - the transcript tool's;
  - Terminal cannot look in it;
  - not empty, unless `<from>` is `settings`.
- **`exports_folder_fault <path>`** sets `FAULT_KIND` the same way, with `studio` for one of Studio's folders or a drop folder.
  - **Every folder:** a line break; the transcript tool's.
  - **Not in Downloads:** then, in this order: one of Studio's folders (the spec's list, with Zoom's folder from the settings' `zoomFolder`, else `~/Documents/Zoom`); `.brimm-watched-by` in the folder or above it, where Terminal can look.
  - **In Downloads:** nothing inside it is read.
  - It sets `EXPORTS_PASSED_OVER=yes` when it passed over a place Terminal could not look in.
- **Where c alone is offered.** It is offered when y would give a refused folder again, unless `FAULT_KIND` is `cannot-look`, which keeps its y. When c alone is offered and the chooser cannot be shown, the stop's words follow `FAULT_KIND`: `not-empty` gets the "Empty it in Finder" words, and any other kind the "Tell Jason" words.

**Tests:**
- **Sourced:** each refusal's exact words, and each pass:
  - a line break;
  - a full folder, counted;
  - a missing folder, taken as empty;
  - a folder at mode 000, refused as unreadable;
  - the last-time folder holding a file, refused as not empty;
  - a picked folder inside a folder at mode 000: "cannot look", never 0;
  - Downloads, and a folder inside it, at mode 000, passed with nothing read; and a Downloads pick named by a made-up transcribe plist, refused;
  - a `WatchPaths` entry holding a comma and a quote, read whole;
  - an exports folder in `Episodes`, in BRIMM Video Work, in the workshop, in Zoom's folder, and under a folder holding `.brimm-watched-by`;
  - a folder above an exports folder at mode 000: passed over, with `EXPORTS_PASSED_OVER`;
  - `BRIMM VIDEO Transfer`, a folder named in a made-up transcribe plist, and one named in a `.plist.off`, for either pick.
- **Whole runs:**
  - "a refused pick says why and asks again";
  - "the suggested drop folder, when it holds a file, is asked again with c alone; y then stops";
  - "with c alone offered, and the chooser not shown (`fail`, then the second way's `two`), the run stops with the not-empty words; after a transcript refusal, with the Tell Jason words";
  - "a drop folder Terminal cannot look in keeps its y";
  - "a folder inside Downloads, picked for exports, gets its note".

**Steps:**
- [ ] Write the tests.
- [ ] See them fail.
- [ ] Write the functions, and use them in the two questions.
- [ ] See the tests pass.
- [ ] Commit.

### Task 4. Reading the installer's print, and the privacy notes

**Spec:** "Step 5", parts 3 and 4 (the privacy questions).

**Goal:**
- A refused pick goes back to the right question.
- The cloud question holds for its folder within a run.
- The privacy notes are said from Studio's own answers.
- Claude Code's update tries are counted only after an update.

**Files:**
- Modify `tool/move-app/move.zsh` and `tool/tests/move-app.test.js`.

**Interfaces (produced):**
- **`refused_pick <print text>`** prints `exports`, `drop`, `nested` or nothing, from the print's first line, by the spec's step 5.3 list:
  - `nested` for the drop-and-exports line;
  - `exports` for `Not written: the exports folder …`;
  - `drop` for the rest of the list;
  - nothing for `Not written: the drop folder would change from …` and any other line.
- **`cloud_warning <print text>`** prints the `Warning: this drop folder is in …` line, or nothing. The cloud's name is the text between "is in " and the first ". ".
- **`studio_says <cloudFolder|needsFilesAccess> <path>`** prints Studio's answer through node, with errors off the screen: the name, `yes` or `no`, or nothing on a failure.
- **The loop in `run_the_installer`**, after the questions:
  - It prints. When `PRINT_RC` is not 0 and `refused_pick` names a folder, it says the words, runs that question again, sets the options again, and prints again.
    - `nested` asks the question of the folder whose `*_FROM` is `picked`, or the exports one when both are.
    - When y would give the same folder again, the question is asked with c alone.
  - Any other non-zero status stops, as today. Under `--print`, every non-zero print stops with the installer's words, and nothing is asked again.
  - Then the cloud question, unless `DROP_KEPT` is yes (the installer gets no drop option), or `CLOUD_OK_FOR` already holds this drop folder's real path. A y sets `CLOUD_OK_FOR`, and nothing is written. When the Warning line itself already holds the sessions sentence (L1c), the app does not add its own.
  - Then Claude Code's lines as today, with `tries` counted only after `claude update` or the Claude app's update.
- **`privacy_notes`**, said before the real install's question:
  - always the Downloads line. Its words follow Phase 3's L5 answer (spec, finding 10); until then, the spec's words;
  - the drop folder's line, decided by `studio_says cloudFolder` first: Dropbox gives the line only on a Mac set up fresh (`SET_UP_FRESH`). Any other cloud gives it, and otherwise it comes when `studio_says needsFilesAccess` is `yes`;
  - the exports folder's line on the same rule, or when `EXPORTS_PASSED_OVER` is set.

**Tests:**
- **Sourced: `refused_pick`** on each line of the spec's step 5.3 list, on the old folder's line, and on `Not written: this Mac's drop folder is …`.
- **Whole runs, with a print list and an exit list:**
  - "a refusal naming the drop folder asks the drop question again, and prints again with the new pick";
  - "a refusal naming the exports folder asks the exports question again";
  - "the nesting refusal asks again the folder picked on this run";
  - "the old folder's refusal stops, and runs nothing for real".
- "the cloud question":
  - it is said with the sessions sentence;
  - c asks the drop question again;
  - y holds when the print is shown again after `claude update`, and after a refused exports pick;
  - after a c at the cloud question, a different cloud folder is asked about afresh;
  - a Mac whose settings already name a Dropbox drop folder, kept by y, is not asked, and its report says "kept on a y on an earlier run";
  - a Warning line that already holds the sessions sentence gets no second one.
- "under --print, a refused print stops with its words, and asks nothing".
- "a print shown again after a refused pick, then an older Claude Code, still offers claude update".
- "privacy":
  - the Downloads line on every run;
  - the drop folder's line for a pick under Desktop;
  - none for the suggested drop folder;
  - none for Dropbox on a moved Mac, and the line for it on a fresh one;
  - the exports line for a pick under Documents, and after a passed-over folder.

**Steps:**
- [ ] Write the tests.
- [ ] See them fail.
- [ ] Write the reader, the loop and the notes.
- [ ] See the tests pass.
- [ ] Commit.

### Task 5. Later runs, the marks, the stop summary and the end of the run

**Spec:** "Step 5", parts 4 and 5; "Later runs".

**Goal:** Every run, first or later, says and counts the right things, whatever point it stops at.

**Files:**
- Modify `tool/move-app/move.zsh` and `tool/tests/move-app.test.js`.

**Interfaces (produced):**
- **Two pure functions**, which Task 7's ties call:
  - `show_folders` runs Studio's `settings.js show` once (guarded), and prints its drop folder and its exports folder on two lines. `START_DROP`, `look_at_import_and_drop`, `summary` and the report use it.
  - `finder_sentence <dropPath>` prints the Finder step's sentence, by `studio_says cloudFolder` and `SET_UP_FRESH`. `turn_on_hyperframes` says it.
- **The marks.** Right before the real install's run, after its y:
  - `write_mark drop "$DROP_FOLDER"` only when `--drop-folder` is given, and `write_mark exports "$EXPORTS_FOLDER"` only when `--exports-folder` is given;
  - on a Mac set up fresh, `write_mark fresh yes`;
  - `INSTALL_STARTED=yes`.
- **`BACKGROUND_SEEN=yes`** is set in the loop that reads the installer's output, as soon as the line "From the background job:" passes, before the status is looked at.
- **`finder=<commit>`** is written once the Finder step's Return is pressed.
- **`START_DROP`**: the drop folder `show_folders` gives when step 1 counts it, as a real path.
- **`summary`.** When `INSTALL_STARTED` is set, it reads `show_folders` before its own lines.
  - With `BACKGROUND_SEEN`, and the drop folder changed from `START_DROP`, it says the spec's "now" words. Their Dropbox sentence is said only on a Mac moved from brimm-video.
  - Without `BACKGROUND_SEEN`, it says the spec's "not finished" words, whether or not the folder changed.
  - It never counts the old drop folder, and never waits or asks, so every stop stops. `stop_here` and `interrupted` both call `summary`.
- **`which_mac`.** With settings and the mark `fresh=yes`, it sets `SET_UP_FRESH=yes` and leaves `FRESH` empty. With no settings, `FRESH=yes` and `SET_UP_FRESH=yes`. Step 7, the last lines and `summary` read `SET_UP_FRESH`.
- **Step 1** takes `drop` "Drop", or a `dropPath`, as expected, and says the spec's words for each. With `SET_UP_FRESH` and settings, it says "set up fresh on an earlier run", asks nothing, and reads BRIMM Video from the settings. Once `installed` is this commit, it counts the drop folder for the report and does not stop on it.
- **The set-up-fresh question** says the spec's new words: "a drop folder picked in step 5 (suggested: BRIMM Video Work › Drop, on this Mac)".
- **`privacy_notes` and step 7** read `SET_UP_FRESH`, not `FRESH`.
- **`watched_by_agent <folder>`**: `launchctl list com.thebrimm.unedited` ends 0, and `plist_watch_paths` of the plist name the folder, by real path.
- **`look_at_import_and_drop`**, by the spec's "What step 1 counts":
  - `Drop › <Mac>` while it is there, on a moved Mac whose `installed` mark is not this commit;
  - the folder `show` names;
  - each with its stop or go-on words.
- **`turn_on_hyperframes`'s Finder step.**
  - It runs when the install finished on this run, or while `finder=` is not this commit.
  - It decides its sentence by `studio_says cloudFolder "$dropPath"` and `SET_UP_FRESH`, and names the folder by `words_for`.
- **`old_drop_lines`.**
  - It runs only right before "Done.", on a Mac that is not `SET_UP_FRESH`, while `$ROOT/Drop/$MACHINE` is a folder. It never runs on a stop.
  - It counts once with `count_entries`, and says the spec's 0, N or unreadable words. It never waits or asks.
- **The report.** Under check 44's heading, after its current lines:
  - `Drop folder: …` and `Exports folder: …`, from this run's options, or from Studio's `show` after the install;
  - `Cloud warning: …`, from `studio_says cloudFolder` of the drop folder: `none`, `<name>, kept on a y`, or `<name>, kept on a y on an earlier run` when the settings already named it;
  - under `--print`, "not checked: this was a print".

**Tests:**
- "the marks are written right before the real install, and not on n".
- "a run after a partial install offers to keep the folder, and gives no drop option". The first run is stopped by `install.ranExit: 1` after the stand-in wrote `dropPath`. The second has no `installed` mark.
- "a Mac set up fresh, run again after a partial install, is still fresh":
  - no Dropbox search;
  - no fresh question;
  - step 7 leaves the old key;
  - no old-folder lines.
- "step 1":
  - `dropPath` with no `drop` passes;
  - its folder missing counts 0;
  - files in it, loaded and watched, stop;
  - files in it, not loaded, go on with the spec's line.
- "Drop › <Mac> holding a file stops: 'still to be imported' when watched, 'Tell Jason' when not".
- "a stop after the installer started":
  - with the background line: "This Mac's drop folder is now …", with the Dropbox sentence on a moved Mac only;
  - with the background line and `ranExit: 1`: the same "now" words;
  - without it (`install.noBackground`, with or without `ranExit`): the "not finished" words;
  - an n at the HyperFrames question after the install: the "now" words, and no count of the old folder.
- "a later run after the install finished at this commit, with a file in the drop folder: counted for the report, no stop".
- "the set-up-fresh question's new words".
- "the marks: drop= only with --drop-folder, exports= only with --exports-folder (a rerun after y to Downloads has no exports=)".
- "the Finder step":
  - a local drop folder gets the sidebar, Option-drag and never-export words;
  - one in Dropbox gets Make available offline with the folder's words, and the node sentence on a fresh Mac;
  - a later run shows it again until it is done.
- "the last lines on a moved Mac":
  - at 0;
  - at 2, counted, never named, said once, with no wait: the run ends 0 with "Done.";
  - unreadable, said once, without a stop;
  - none once the folder is gone, and none on a Mac set up fresh.
- "a stop after the install, with a file in the old folder, says no last lines, and ends 1 at once".
- "the report's three lines on a first run, on a later run, and under --print".

**Steps:**
- [ ] Write the tests.
- [ ] See them fail.
- [ ] Write the changes.
- [ ] See the tests pass.
- [ ] Commit.

### Task 6. The try mode

**Spec:** "The try mode".

**Goal:** `move.zsh --try-chooser [--second-way]` runs the two questions alone, on any Mac, needing nothing of Studio's, and changes nothing.

**Files:**
- Modify `tool/move-app/move.zsh` and `tool/tests/move-app.test.js`.

**Interfaces (produced):**
- **`read_options`** takes `--try-chooser`, optionally with `--second-way`, which sets `CHOOSER_ROUTE=program`. It refuses either with `--commit` or `--print`, with exit 2.
- **`try_chooser`:**
  - no lock, no log, no report, no marks, no installer; `which_mac`'s refusal is passed over;
  - `NODE` from `find_program node`, with no stop;
  - folders from `settings.json` with `plutil`;
  - BRIMM Video from `root`, or from `set_up_fresh`'s search with its question passed over. When none is found, it says so, and passes over the checks that need it;
  - `ask_drop_folder` and `ask_exports_folder` with the app's own checks;
  - when `words_for` gave a path for any pick, the spec's one line about paths;
  - its own heading, its chooser line with no double-click advice, and its own stop words (spec, "Its own words"), said by `summary` and by the c-alone stop when `TRY` is set;
  - its end lines: the folders, `sw_vers -productVersion`, `uname -m`, the keys thrown away, and "Nothing was changed. Studio's installer checks more at the move.". It ends 0.

**Tests:**
- "--try-chooser on the Mac Studio's settings":
  - it asks the two questions and opens the stand-in chooser;
  - it says the picks, the version and the chip;
  - the home's files are unchanged (`tree` deep-equals `before`, the stand-ins' records apart);
  - no lock file, and no `install.sh` call.
- "--try-chooser with no Studio checkout and no node on PATH says paths and its line, and ends 0".
- "--try-chooser with no settings finds BRIMM Video with no question".
- "--try-chooser with no BRIMM Video says so, and still asks".
- "--try-chooser --second-way uses the program first".
- "--try-chooser with --commit, or with --print, is refused with 2".
- "--try-chooser stopped at its first question says the try's own stop words, with the open … --args --try-chooser line, and no double-click advice".

**Steps:**
- [ ] Write the tests.
- [ ] See them fail.
- [ ] Write `try_chooser`.
- [ ] See the tests pass.
- [ ] Commit.

### Task 7. The ties to Studio's real code, and keys on a real terminal

**Spec:** "Testing": the three ties, and keys thrown away on a real terminal.

**Goal:**
- The app's readings and decisions are tied to Phase 3's real `settings.js` and `install.sh`.
- Throwing keys away is tested on a pseudo-terminal.

**Files:**
- Create `tool/tests/move-app-ties.test.js`.

**Interfaces (consumed):**
- `settingsMain` (`tool/settings.js`). Every call is awaited, and a missing line fails the test: an empty reading is never taken for "nothing".
- **Running the real `install.sh --print`.** `install.test.js`'s `askWith` and `box`. If they are not exported, move them into a helper module that both test files import. Their stand-ins (`ffmpegSays`, `onPath`) come with them. Every folder named in the settings or a transcribe plist is kept inside the test's own folder, so nothing of the Mac's own is read.
- `move.zsh`'s `refused_pick`, `cloud_warning`, `words_for`, `privacy_notes`, `finder_sentence` and `show_folders` (Task 5). They are sourced with `zsh -c 'source move.zsh; …'` (`main` runs only when the file is run), with stand-in `open` and `launchctl` first on PATH.

**Tests:**
- **Tie 1.** Run `settingsMain(["plan", "--machine", "Mac Studio", "--root", <root>, "--checkout", <co>, "--drop-folder", <pick>, …], { home, say })` for each of these. Feed the first said line to `refused_pick`, and expect the spec's routing:
  - each refusal Phase 3's own install test lists for `dropFolderFault`;
  - the nesting one;
  - L1c's exports refusals;
  - `References` and `Unedited Video` in BRIMM Video, `~/BRIMM Video Workshop`, `~/Documents/Zoom`, and a pick that is a file, not a folder;
  - a plan made while the old folder holds a video, which must give nothing (a stop).

  Each case row carries its expected words, as `install.test.js` does in "refuses a drop folder it must not watch". The test asserts `deepEqual([await code, said[0]], [1, \`Not written: ${why}.\`])` before it feeds the line to `refused_pick`.

  The old-folder row asserts code 1, and that the first line starts `Not written: the drop folder would change from `. Then it expects nothing (a stop) from `refused_pick`.
- **Tie 2.** The real `install.sh --print` in a made-up home, for each of these picks. Feed each print to `refused_pick` and `cloud_warning`, and expect the spec's reading:
  - a drop folder in `Library/CloudStorage/Dropbox-X/In`, which gives the Warning with "Dropbox";
  - `Downloads`, which gives a refused pick;
  - a pick while the old drop folder holds a video, which gives a stop: the print's exit code is not 0 and its first line starts `Not written: the drop folder would change from `;
  - a pick holding another Mac's `.brimm-watched-by`, which gives a refused pick;
  - a pick a made-up transcribe plist watches, which gives a refused pick;
  - a pick named `It’s café 🎬 x`, whose name is passed whole in the print's `Its drop folder, on this Mac:` line.

  It also runs Studio's real `settings.js show` on settings with `dropPath` and `exportsPath`, and reads both lines through the app's readers.
- **Tie 3.** Source `move.zsh` with `STUDIO` set to the repository root and `NODE` set to the running node, and a made-up `HOME`. For paths in `Library/CloudStorage/Dropbox-X/In`, `Desktop/In`, `Library/Mobile Documents/com~apple~CloudDocs/In`, `/Volumes/X/In` and `BRIMM Video Work/Drop`, expect Studio's own answers through:
  - `words_for`;
  - the Finder sentence;
  - `privacy_notes`.
- **Keys on a terminal.**
  - Run a sourced `choose_folder`, then an `ask_y_or_c`, under `/bin/sh -c 'cat | /usr/bin/script -q /dev/null /bin/zsh -c "…"'`.
  - The stand-in chooser waits on a release file.
  - The test writes `y` with no Return. It waits for the echoed `y` in the output, then makes the release file. It waits for the next question's prompt, then writes a lone Return.
  - The run must stop, and its output must hold "Keys typed while the window was open were not taken as answers."
  - Every wait has a 10-second limit, which fails the test.
  - **Cleanup.** The child is spawned detached. In a `finally` block the test first makes the release file, then ends `cat`'s input, then kills the whole process group (`process.kill(-pid, "SIGKILL")`).
  - The stand-in chooser gives up on its own after about 15 s, so a failed wait can neither hang the test file nor leave processes behind.
  - **A second test** writes Control-C (`\x03`) while the stand-in chooser waits. The run must end with the stop summary. It models the first way as two parts: a waiter like `open -W` in the job's process group, which Control-C ends; and a stand-in helper outside that group, which watches the script's process id and must see it end.
  - Both are skipped where `/usr/bin/script` is missing.

**Steps:**
- [ ] Write the ties and the terminal test.
- [ ] Run them against the merged Phase 3, and see each pass. A failing tie means the app's reading or Phase 3's words changed: fix the reader, never the tie's expectation of Studio's words.
- [ ] Commit.

### Task 8. The doc, the earlier design, and step 3's time

**Spec:** "Other changes".

**Files:**
- Modify `docs/setup/move-to-studio-app.md` and `docs/superpowers/specs/2026-11-05-laptop-move-app-design.md`.
- Modify `tool/move-app/move.zsh` for step 3's time.

**Steps:**
- [ ] The doc, by the spec's "Other changes":
  - "y, n or c";
  - step 5 and the try mode;
  - "Where it stops, and what to do", with each new stop and the stop summary's words;
  - "Building the app", with the helper and the zip;
  - the tests.
- [ ] The 5 November design's "The next round" ends with a line pointing to this spec.
- [ ] Time Studio's whole suite with the new tests on the Mac Studio, idle (`cd tool && time node --test`). Set step 3's time in `move.zsh` and in the doc to what was measured.
- [ ] Run the whole suite, and see it pass.
- [ ] Commit.

### Task 9. The By-Hand page and her guide (no code)

Done by this session after the final review, before the merge question goes to Jason.
- [ ] Re-read the live By-Hand page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT).
  - Change the move group (72 to 74), his MacBook's group (80) and checks 44 to 46, by the spec's "The By-Hand page".
  - Rewrite every existing step there that describes a drop folder in Dropbox, and put check 80 before check 74.
  - Run `scratchpad/by-hand/check-page.mjs`, publish, and tell the coordinator in one line.
- [ ] Check with Phase 3's session that her guide's lines (the spec's "In step with brimm-operations", finding 9) went to the BRIMM Ops session with L9.

---

## Rulings made in this plan, for Jason to check

1. **Pure checks are tested as sourced functions, and whole runs with `moveOn`.** This keeps step 3's run of Studio's suite on the MacBook short. Cost if wrong: a slower step 3, which Task 8 measures.
2. **Phase 3's real code is tested in a file of its own, `move-app-ties.test.js`.** A tie that breaks then says which of Phase 3's words moved. Cost if wrong: none.
3. **The helper's Swift is one file, `choose-folder.swift`, with both ways in it.** Cost if wrong: none; the second way is the fallback.
4. **The harness gains all come in Task 2**, since Tasks 3 to 6 need them. Cost if wrong: a larger first review.
5. **The By-Hand page and her guide's lines come last, after the final review**, so they describe what was built. Cost if wrong: the page lags the code for the length of one review.
