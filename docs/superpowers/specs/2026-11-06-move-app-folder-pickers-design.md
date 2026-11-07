# The Move to Studio app picks the drop folder and the exports folder (design)

6 November 2026. A draft for Jason's approval: nothing is built until he approves it. Branch `claude/studio-move-app-folders`, from main 673f770.

It needs Phase 3's installer options, so it is built and merged after Phase 3. Those options are L1 (af3d75a) and L1b (c125ae7) on `claude/studio-local-folder`, reviewed and not merged. Phase 3's plan is `docs/superpowers/plans/2026-11-06-local-working-folder-plan.md` on that branch. Its rulings D7, D8, D10, D11 and D12 are cited here by number.

This is version 3. Version 1 was read by a builder and attacked once. Version 2 was attacked through four lenses by a workflow on Opus 5.5: 35 agents, each serious finding checked by two skeptics, and a judge on how to show the folder chooser. All 14 serious findings stood, and they are in this version, with most of the 27 minor ones.

## In short

- At the move, step 5 asks where videos are dropped and where HyperFrames' exports go.
  - A y takes the suggested folder: BRIMM Video Work › Drop, and Downloads.
  - A c opens macOS's own folder chooser, with New Folder.
- The drop folder leaves Dropbox at the move. The old Dropbox drop folder is counted before anyone deletes it.
- A cloud drop folder gets Studio's warning, and says that every video dropped there, a client session too, goes up to that cloud.
- The app refuses a drop folder that isn't empty, and an exports folder where Studio or the transcript tool would take the export.
- The chooser is a small helper app inside Move to Studio, started the way Finder starts an app, so that it comes in front with the keyboard. A try mode shows it on each Mac before the move, and changes nothing.
- Studio's installer still checks every pick. The app reads its words, which two tests tie to Phase 3's real code.

## Why

Jason, 6 November: "the app installer should allow the user to pick or create the Drop folder in a location of their choosing with a warning that creating it in Dropbox or other 'cloud' folders could cause issues. they should also be able to choose which folder exports of edited videos go into. Cloud based folders are fine for this step, especially if they want to share with other users or computers"

The same day he chose "Phase 3, then the app": Studio's side first, then the app's pickers. Phase 3 has built Studio's side:
- The installer takes `--drop-folder "<path>"`, `--exports-folder "<path>"` and `--switch-local`. The settings gain `dropPath` and `exportsPath`.
- D8 says what the app passes.
- D11 says what a drop folder may be, and words the cloud warning.
- D12 makes the exports folder Studio's second place to look, besides Downloads.
- D10 says the MacBooks stay on their drop folders in Dropbox until each moves. Moving is this app's job.
- Phase 3's own goal: "A session's recording never goes to Dropbox."

This design works when, on either MacBook at its move:
- the person at the Mac takes the suggested drop folder with a y, or picks or makes another in macOS's own folder chooser;
- they see what a cloud drop folder costs, and decide;
- they do the same for the exports folder;
- no folder is picked from which Studio, or the transcript tool, would take a video or an export by surprise;
- no video is left where nothing watches it, unseen;
- Studio's installer gets exactly D8's options;
- nothing else about the move changes.

## What changes

- Step 5 (check 44) asks two questions before the installer's print.
- The installer gets `--drop-folder "<folder>"` in place of `--drop Drop`. It gets `--exports-folder "<folder>"` when the exports folder changes.
- The drop folder leaves Dropbox at the move, on both MacBooks. This is D8, and Jason's 5 November note, "the working folder is local".
- The old Dropbox drop folder (`Drop › Sallie's laptop`, or `Drop › Jason's MacBook`) is no longer watched (D10).
  - The app counts it at the end of the run.
  - When it is empty, Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar.
  - When it is not empty, its videos are moved into the new drop folder first.
- Studio's check of the old drop folder (`heldInOld`) now runs at every move. A By-Hand pre-check looks first for what only Dropbox's status files show.
- The folder chooser is a small helper app in Move to Studio, with a try mode.
- Step 1, the set-up-fresh question, the end of the install, the report, `--print`, the doc, the By-Hand page and her guide change to match.

## Step 5, in order

Step 5 keeps its heading, "5. Studio's installer (check 44)", so no step or check is renumbered.

### 1. The drop folder

```
  Where videos are dropped for Studio: the drop folder.
  Studio takes every video out of this folder and files it. Use a new folder that only you drop into: never one shared with others, or one an app saves into.
  Suggested: BRIMM Video Work › Drop, in your home folder. It is on this Mac, the installer makes it, and macOS asks no questions about it.
  A folder in Dropbox, iCloud Drive or another cloud folder can be picked, but every video dropped there, a client session too, goes up to that cloud, and one still syncing can be imported late, or twice.
Type y and press Return to use the suggested folder, or c and press Return to choose another. Anything else stops:
```

- **y** takes `~/BRIMM Video Work/Drop`, Phase 3's default. y and c are read as `ask_yes` reads y: any case, with spaces round it.
- **c** opens the chooser (see "The chooser").
  - Terminal first says: "A window to choose the folder is opening. If you don't see it, click Choose a Folder in the Dock."
  - The chooser starts in the home folder. Its message: "Move to Studio: choose the folder you will drop videos into, or make a new one with New Folder." macOS shows no title on a chooser, so the message names the folder. Its button is "Use This Folder".
  - The folder chosen is said back in Finder's words, which Studio's own `folderWords` gives (`settings.js`, through node): for example `Picked: Desktop › Videos for Studio, in your home folder`.
  - Cancel asks the question again.
  - A chooser that could not be shown says so ("The window to choose a folder could not be shown."), and asks the question again. y still takes the suggested folder, so a chooser that fails never blocks a move.
- **Anything else**, an empty line or the end of input stops the run, as every question in the app does. A run stopped here has changed nothing in step 5.

The question changes in three cases:
- **The settings already name a drop folder of its own** (`dropPath`). This happens on a later run, after the installer wrote the settings but did not finish. "This Mac's drop folder is <folder>." Then "Type y and press Return to keep it, or c and press Return to choose another." y keeps it, and the installer is given no drop option (D8).
- **A folder was picked on an earlier run**, and the settings don't name one yet. This happens when a run stopped before the installer wrote them. "Last time, this folder was picked: <folder>." Then "Type y and press Return to use it again, or c and press Return to choose another." If another is picked, the app says the earlier folder may hold this Mac's marker, and Jason deletes it by hand if it is not wanted.
- **The suggested folder was refused**, by the app's checks or by the installer. The question is asked again with c alone: "Type c and press Return to choose another folder. Anything else stops."

### 2. The exports folder

```
  Where HyperFrames' exports go: the exports folder.
  Suggested: Downloads, where HyperFrames saves an export unless its Export dialog is given another folder. Studio looks in Downloads in any case.
  A folder in Dropbox is fine, for instance to share the exports with other people.
Type y and press Return to use Downloads, or c and press Return to choose another. Anything else stops:
```

- **y** takes Downloads. Nothing looks inside it (see "The app's own checks").
- **c** opens the chooser as above, starting in Downloads, with the message "Move to Studio: choose the folder HyperFrames' exports will go into, or make a new one with New Folder."
- **A folder that is not Downloads** is followed by one note: "Studio looks for exports there and in Downloads. It copies each one into its video's final folder in Dropbox, and leaves the one there as it is. When you export in HyperFrames, choose this folder in its Export dialog." This is D12: Studio never deletes from an exports folder other than Downloads.
- The same three cases as the drop question apply. The settings' folder is read from Studio's `settings.js show`, line `  Exports from HyperFrames, looked for in:  <path>`. Its question says "HyperFrames' exports are looked for in <folder> and in Downloads".

There is no warning for a cloud exports folder. Jason: "Cloud based folders are fine for this step".

### 3. The app's checks, then the installer's print

Each pick is checked by the app's own checks (below) right after it is made. Then the print runs as today (`installer_print`), with the options below. Studio's installer is what checks the picks against D11.

- **A pick the installer refuses** is asked about again. The installer's print ends 2 with its reason on its first line. The app says those words, then asks the refused folder's question again, with c alone if the refused folder was the suggested one. The print runs again with both folders.
  - **The exports question** is asked again when the line names the exports folder. Today that is `Not written: the drop folder cannot be the exports folder, or inside it, or hold it.` From L1c, if Phase 3 adds it, it is any `Not written: the exports folder …` line.
  - **The drop question** is asked again for every other line that means the drop folder was refused:
    - any `Not written: the drop folder …` line but `Not written: the drop folder would change from …`;
    - `Not written: the folder that is to hold the drop folder is not there.`;
    - `The folder <path> is watched by <Mac> already. A drop folder is watched by one Mac only.`;
    - `A folder is for transcripts or for unedited video, and not for both: …`.

  Any other refusal stops the run, as today. The likeliest is the old drop folder's check, `Not written: the drop folder would change from …`. See "What the old drop folder holds".
- **A drop folder in a cloud folder.** The print holds D11's line, `Warning: this drop folder is in <name>. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.`
  - The app says it, adds "Every video dropped there, a client session too, goes up to <name>, and stays in its deleted files after Studio takes it out.", then asks "Type y and press Return to use it anyway, or c and press Return to choose another. Anything else stops:".
  - A y is asked once for that folder, and kept in the marks as `cloud=<name>`. It is not asked again when the print is shown again after a `claude update`.
- **Privacy questions.** Before the real install, the app says which questions macOS may still ask. It decides by asking Studio's own `needsFilesAccess` and `cloudFolder` (`settings.js`, through node), never by its own list. Dropbox brings none, since node and Claude Code read Dropbox already.
  - **A drop folder under Desktop or Documents, in iCloud Drive or another cloud folder, or on another disk:** "macOS may also ask whether node may read <folder>, at the first import, and whether Claude Code may, the first time her chat looks there ("what's waiting?"). Choose Allow each time. A Don't Allow is undone in System Settings › Privacy & Security › Files and Folders, under that name. macOS may ask node again after Homebrew updates it, and until someone clicks Allow, Studio sees no video dropped there." Terminal's own question came already, at the app's check that the folder is empty.
  - **An exports folder in one of those places:** "macOS may ask whether Claude Code may look in <folder>, at the first hand-off. Choose Allow."
  - The suggested folders bring none of these questions.
- **Claude Code's lines** (signed in, versions) are read after the folders, as today. Only a print after a `claude update`, or after the Claude app's own update, counts as a try at updating. A print shown again after a refused pick does not.

### 4. As today, with the picks kept

The lines that matter, the question, the look again at the old drop folder and the import, and the real run all work as today. The real run uses the same options as the print.

Right before the real install, the app writes its marks (`.git/move-to-studio` in Studio's checkout):
- `drop=<path>` and `exports=<path>`, the folders picked on this run;
- `fresh=yes` on a Mac set up fresh.

A path with a line break was refused already, so each mark is one line.

### 5. After the install, or after a stop in it

- **A stop in the installer.** If the installer stops, the app reads Studio's `settings.js show`. This covers the stop for the check of Claude too. If the drop folder is now a folder of its own, and was not when the run began, the app says so at once, before the stop's summary: "This Mac's drop folder is now <folder>. Videos put in Drop › <Mac> in Dropbox are no longer imported."
- **The Finder step.** The drop folder is shown in Finder (`open -R`), as today. What it says is decided from the settings, by Studio's `cloudFolder` of `dropPath`, never from a print that may not have run on this run.
  - For a drop folder in Dropbox it keeps today's sentence, naming the folder in Finder's words (not the Mac's name): Control-click it, choose Make available offline.
  - Otherwise it says: "This is the drop folder from now on: <folder>. To keep it one click away, drag it into Finder's sidebar, under Favorites. To bring in a video that is in Dropbox, hold Option as you drag it, so that Dropbox keeps its copy."
  - It waits for Return, as today. The step is marked done (`finder=<commit>`), and is shown on every later run until it is.
- **The last lines, on a Mac moved from brimm-video.** These lines are not said on a Mac set up fresh. They are said only while `Drop › <Mac>` is still in Dropbox (`$ROOT/Drop/$MACHINE`). Right before them, the app counts that folder as step 1 counts a drop folder: nothing but `.DS_Store` and `.brimm-watched-by`, counted and never listed.
  - At 0: "The old drop folder, Drop › <Mac> in Dropbox, is empty and no longer watched. Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar."
  - At N: "The old drop folder, Drop › <Mac> in Dropbox, holds N files or folders that nothing imports now. Don't delete it yet: drag each video in it into <new drop folder>, where it is imported. Jason deletes the folder once it is empty."
  - When the folder cannot be read, the existing could-not-be-read words.

## The app's own checks

These checks run right after each pick, before the installer's print, so a pick they refuse never reaches the print or the cloud question. Each refusal says why, and asks the question again (c alone, when the refused folder was the suggested one). Folders are compared by real path, letter case folded, as Studio's `sameOrNested` compares them. A pick is first made whole: `${pick:A}`, which must be a folder.

For either folder:
- **A line break.** A folder whose path holds a line break is refused: "A folder whose name holds a line break can't be used. Choose another." The installer reads its plan line by line, and the marks are lines.
- **Not the transcript tool's.** A folder is refused when it is, or is inside, `BRIMM VIDEO Transfer` beside BRIMM Video in Dropbox (`${ROOT:A:h}`), or any folder this Mac's transcript tool watches. Those are the `WatchPaths` of `~/Library/LaunchAgents/com.thebrimm.transcribe.plist`, or of `.plist.off`. The transcript tool takes each video put there and files it away. "<folder> is watched by the transcript tool, which takes each video put there. Choose another."

For the drop folder:
- **Terminal can look in it.** A folder Terminal cannot look in is refused, never taken for empty: "macOS did not let Terminal look in <folder>. Allow Terminal in System Settings › Privacy & Security › Files and Folders, or choose another folder." A folder that is not there yet is not looked in: the installer makes it.
- **Empty.** A drop folder picked or suggested must be empty, unless it is this Mac's drop folder already. Empty means nothing in it but `.DS_Store` and `.brimm-watched-by`, as step 1 counts. A folder that is not there yet is empty.
  - A folder that holds anything is refused: "<folder> holds N files or folders. Studio takes every video out of a drop folder, so choose an empty folder that only you drop into, or make one with New Folder."
  - Without this check, picking the Desktop would import every video on it, and the import deletes each original once it is filed (D11). The first attacker ran Phase 3's `plan` on a Desktop holding a video: it was accepted.
  - The folder is counted and never listed.

For the exports folder, which Studio checks only for being a whole path and apart from the drop folder:
- **Downloads is never looked in.** Downloads, by y or by a pick that is Downloads by real path, takes no check that reads inside it. D11 keeps every drop folder out of it, and none of Studio's folders is there. So the suggested answer brings no question from macOS.
- **Not one of Studio's folders, and not a drop folder.** It is refused when it is, or is inside, any of these:
  - BRIMM Video's `Drop`, `Unedited Video`, `Episodes` or `References`;
  - BRIMM Video Work;
  - her chat's folder `~/BRIMM Video Studio`, or the workshop `~/BRIMM Video Workshop`;
  - Zoom's recordings folder;
  - a folder that holds `.brimm-watched-by`, or is inside one. This is looked for in the folder and each folder above it, where Terminal can look. A place Terminal cannot look in is passed over, not refused, and the privacy note says Claude Code will be asked.

  An export saved in a drop folder would be imported as a new video, and its original taken out. The words: "Exports can't go in <folder>: it is one of Studio's own folders, or a drop folder, where an export would be taken. Choose another."

These rules are sent to Phase 3 as findings. If Phase 3 adds them to the installer (L1c), the app's checks stay, since they come before the print, and the installer's become a second guard.

## What the installer is given

- **The drop option.** `--drop-folder "<picked or suggested>"`, unless the settings' `dropPath` is kept, when there is none.
- **The exports option.** `--exports-folder "<picked>"` when the folder differs, by real path, from the one the settings name now: their `exportsPath`, or Downloads when there is none. None when it is the same. So going back to Downloads from another folder passes `--exports-folder "$HOME/Downloads"`.

The full line, for a Mac moved or set up fresh:

```
zsh "$STUDIO/tool/install.sh" --print --machine "<Mac>" --drop-folder "<drop>" [--exports-folder "<exports>"] --import light --handoff 2 "<BRIMM Video>"
```

- **Never `--drop`.** Phase 3 refuses `--drop` with `--drop-folder`, and refuses `--drop` on a Mac with `dropPath` unless `--switch-back` is given too.
- **Never `--switch-back`.**
- **Never `--switch-local`.** The installer turns it into exactly `--drop-folder "$HOME/BRIMM Video Work/Drop"`, so the app uses one way, `--drop-folder` with the path.
- **`INSTALL_OPTIONS`** is still written in one place. It is now written after the two questions, not in `which_mac`.

## What the old drop folder holds

- With `--drop-folder`, Studio's installer checks the old drop folder before it switches (`switch.js` `heldInOld`), at every move.
  - On a moved Mac, the old folder is `Drop › <Mac>`. With `--drop Drop` this check never ran there, since the folder did not change.
  - On a Mac set up fresh, the old folder is `Unedited Video › <Mac>`, which the installer names for a Mac with no settings. It is normally not there.
- It refuses while the old folder holds a video. It also refuses while this Mac has an import in `Episodes/.importing` that failed or whose late check found a problem, even when its video is gone. The first attacker ran it: "Not written: the drop folder would change from Drop to …, and work is not finished in the old one: 1 import failed, and its video is not in the old folder now… a person takes it away by hand."
- Step 1 counts the old folder's files, but reads no statuses. Without a pre-check, the move would stop at step 5's print, after the key, the clone and the tests. The installer would have changed nothing.
- **The By-Hand pre-check, before checks 74 and 80.** Claude, on the Mac Studio, runs Studio's own `heldInOld` for that Mac: its old folder, light, and the statuses in Dropbox. It names no video.
  - It is for what only Dropbox's status files show: an import of that Mac that failed, or whose late check found a problem.
  - A failed import whose video is gone has its status taken away by hand, as the installer's words say. A problem is Jason's to look at.
  - **Nothing in the old drop folder is deleted on the pre-check's word**, whatever it calls a video. From the Mac Studio, `heldInOld` cannot see the late checks a MacBook still owes, which are kept on its own disk. So it calls such a video "kept", though the MacBook's late check still needs it. A video waiting there is left for the MacBook's own import, which step 1 waits for.
- If something is missed, the move stops at step 5 with the installer's words. The doc's "Where it stops" says what to do.

## The chooser

A small helper app, `Choose a Folder.app`, inside Move to Studio at `Contents/Helpers/`. It is signed and notarized with the app. The judge picked this way over a bare program, AppleScript, JavaScript for Automation, and dragging a folder into Terminal.

- **Why an app.** The Swift SDK on this Mac (macOS 27.0.1) documents that an app may no longer simply take focus. `activate(ignoringOtherApps:)` has no effect since macOS 14, and `activate()` waits for the app in front to yield, which Terminal never does. So a bare program started by the shell would likely open without the keyboard. An app started through LaunchServices (`open`) is brought in front as it starts, as Safari is in step 4.
- **How it is started.** `open -n -W "<copy of Choose a Folder.app>" --args "<message>" "<start folder>" "<result file>" "<the script's process id>"`.
  - The result file is in a fresh `mktemp -d` folder for each call. The helper writes it whole, then renames it into place. It holds `path` and the path on the next line, or `cancel`.
  - No file, an unreadable one, or `open` failing all mean the chooser could not be shown.
  - Every call is written so that `set -euo pipefail` cannot end the run on a non-zero status: `open … || rc=$?`. A stop always goes through `stop_here`.
- **What it shows.** `NSOpenPanel`:
  - folders only, and one at a time;
  - New Folder on;
  - links and aliases resolved;
  - the message it is given, and the button "Use This Folder".
- **In front, and findable.** It is an ordinary app, with a Dock icon (a folder) and the name "Choose a Folder". Inside, it also does what it can for the case where LaunchServices does not bring it in front:
  - it activates itself: `activate()` on macOS 14 and later, `activate(ignoringOtherApps:)` on 13;
  - its panel sits at the modal-panel level, does not hide when the app is not in front, is ordered to the front, and moves to the active Space;
  - it bounces its Dock icon if it is not in front half a second after the panel opens.
- **It goes when the move goes.** It watches the script's process id, so Control-C or a closed Terminal window takes the chooser away. The script's traps need nothing more.
- **Keys typed meanwhile.** After the chooser closes, the app brings Terminal to the front (`open -a Terminal`), then throws away any keys typed into Terminal while the chooser was open:

  ```zsh
  if [[ -t 0 ]]; then
    while read -t 0 -k 1 -s _key; do (( ++thrown )); done
  fi
  ```

  - This is zsh's own terminal read, with no `-u`. It leaves line mode for each key, so a y typed without Return is thrown away too, which a read of whole lines would keep.
  - It is written with `if`, not `&&`. Under `set -e`, the `&&` form would end the script when the answers are piped in.
  - It runs only when the answers come from a keyboard, so a test's piped answers are kept.
  - When `thrown` is more than 0, the app says: "Keys typed while the window was open were not taken as answers."
- **Where it runs from, with no quarantine mark.** `open-in-terminal.zsh` makes a copy of `Choose a Folder.app` in the temporary folder, beside the move script, file by file through redirects (`cat`). That is how it already writes the `.command`. This keeps a download's quarantine mark off the copy, so macOS never asks about the helper.
  - On this Mac, `cp -X`, and even `ditto --norsrc --noextattr --noqtn`, keep `com.apple.quarantine` on the copy. A copy made through a redirect does not. This was tried on 6 November.
  - The comment in `open-in-terminal.zsh` that says `cp -X` leaves the marks behind is corrected.
  - A missing helper gives today's "This copy of the app is missing a part" alert.
- **Building and signing.** `build-app.sh`:
  - compiles the helper's program with the launcher's target (arm64, macOS 13), writes its Info.plist (identifier `com.thebrimm.move-to-studio.choose-folder`, name "Choose a Folder", `LSMinimumSystemVersion` 13.0), and checks the Info.plist with `plutil -lint`;
  - signs the helper first, with its own `codesign` call: its identifier, the hardened runtime and a secure timestamp; or ad hoc, with no timestamp, without `--sign`;
  - then signs the app as today;
  - then verifies the helper's own signature as well as the app's.
- **A second way in, kept.** The helper's program, run directly with no result file, prints the path and ends 0, 1 on Cancel, or 2 with one sentence on stderr. It does this with no arguments as well, and opens no window then. Check 73 tries this way beside the first.
  - If check 73, or a MacBook's try, shows the first way bringing any question from macOS that names the helper, or `open` failing on the temporary copy, the move script is switched to the second way before that MacBook's move.
  - The switch is one constant in `move.zsh`.

## The try mode

`zsh "<Move to Studio.app>/Contents/Resources/open-in-terminal.zsh" --try-chooser` opens Terminal as a move does. In it, the move script, given `--try-chooser`, runs step 5's two questions and nothing else.
- It uses the real chooser, the keys thrown away, Terminal brought back, and the app's own checks.
- It says the folders picked, the macOS version, and whether keys were thrown away.
- It writes no log, no report and no marks, changes no settings, and runs no installer.
- It runs on any Mac, the Mac Studio included, so `which_mac`'s refusal is passed over in this mode alone.
- It finds BRIMM Video from the settings, or as a fresh Mac does. If none is found, it says so, and passes over the checks that need it.

Check 73 uses it on the Mac Studio. Each MacBook runs it before its move, by Jason in Terminal.

## Later runs

- **Step 1 accepts a drop folder of its own.** Today step 1 stops unless the settings say drop "Drop". That is no longer enough:
  - a Mac the installer has switched keeps `drop: "Drop"` and gains `dropPath`;
  - a Mac it set up fresh with `--drop-folder` has `dropPath` and no `drop`. The attacker ran it.

  So step 1 takes either `drop: "Drop"` or a `dropPath` as expected. It treats a `dropPath` as a later run's work, as it already treats Studio's checkout. It says "drop folder: its own, <folder>".
- **What step 1 counts.** It counts the folder `settings.js show` names, as today. A drop folder of its own that is not there yet counts as empty: the installer makes it.
  - When the folder holds files, the stop "still to be imported" is said only when this Mac's launch agent watches it: the `WatchPaths` of `~/Library/LaunchAgents/com.thebrimm.unedited.plist` name it, by real path. An import of it is then coming.
  - A drop folder of its own that nothing watches yet is counted, and the run goes on: "N files or folders wait in <folder>. Nothing watches it yet: the install starts the watching, and they are imported then." This happens on a run after a partial install.
- **Its sentence for a folder it cannot read** drops "Dropbox": "macOS may have asked whether Terminal may read it…".
- **A Mac set up fresh is remembered.** The `fresh=yes` mark is written right before the real install.
  - On a later run, the settings are there. `which_mac` reads the mark, and the run treats the Mac as set up fresh. Step 7 leaves brimm-video's key alone, and the last lines say nothing of an old Dropbox drop folder.
  - It does not search Dropbox or ask the set-up-fresh question again. Step 1 says "set up fresh on an earlier run", takes BRIMM Video and the drop folder from the settings, and counts the drop folder.
- **The report** is written whole on every run, so its three new lines are filled on every run:
  - `Drop folder:` and `Exports folder:` are the picks of this run, or, after the install, the folders Studio's `settings.js show` names.
  - `Cloud warning:` is `none`; `<name>, kept on a y`; or `<name>, kept on a y on an earlier run`, from the `cloud=` mark.
  - Under `--print`, each says "not checked: this was a print".

## Other changes

- **The set-up-fresh question** said "its own drop folder (Drop › Jason's MacBook)". It now says "a drop folder picked in step 5 (suggested: BRIMM Video Work › Drop, on this Mac)".
- **`--print`** asks nothing and opens no chooser. It says "Would ask where videos are dropped (suggested: BRIMM Video Work › Drop) and where HyperFrames' exports go (suggested: Downloads)". It runs the app's own checks on the suggested folders, which only read. It shows the installer's print with the suggested folders. On a Mac with `dropPath`, the print has no drop option.
- **The doc** (`docs/setup/move-to-studio-app.md`):
  - "Nothing is typed but y or n" becomes "but y, n or c";
  - step 5 and the try mode;
  - "Where it stops, and what to do": a refused pick, the cloud question, the privacy questions, the chooser that could not be shown, and the old drop folder's check;
  - "Building the app": the helper app;
  - the tests;
  - the time step 3's tests take, measured again.
- **The 5 November design** (`2026-11-05-laptop-move-app-design.md`): its "The next round" points here.

## The By-Hand page

The live page is re-read before each publish, since the review session publishes the same page. What changes is the move group, and the laptop checks 44 to 46 that check 74 sends Jason to.

- **Before checks 74 and 80**, the pre-check under "What the old drop folder holds".
- **Check 73 (build, sign, notarize)** gets these steps after the build. The check still waits for Jason's word that the app is ready.
  - **Signatures.**
    - `codesign -dvvv` on the helper shows the Developer ID authority, the runtime flag, a timestamp and its identifier.
    - `codesign --verify --strict --deep` on the app passes.
    - The notary log lists no issue for the helper.
    - After stapling, `spctl` accepts the app.
  - **The try mode on the Mac Studio.** Claude starts it, so Terminal is in front as at a move. Jason tries the chooser by the first way, then by the second. For each, he notes:
    - whether it came in front of Terminal with the keyboard;
    - that New Folder works, by its button and by Command-Shift-N, and that a name with spaces, a curly apostrophe, an accent and an emoji is said back as Finder shows it;
    - what Cancel does;
    - that y typed into Terminal while it was open, with and without Return, is thrown away, and the next question still waits;
    - that Terminal is in front after it closes;
    - that Control-C, and closing the window, take the chooser away;
    - that Return at once, in each chooser, picks its start folder: the home folder, refused as not empty; and Downloads.
- **Before her laptop**, the notarized zip goes by AirDrop to a Mac that is not the build Mac (Jason's MacBook). Opened there from Downloads, its try mode may bring Gatekeeper's one question for Move to Studio, and none for the helper.
- **On each MacBook, before its move:** `sw_vers`, then the try mode, with the same notes. A pass on 27.0.1 says nothing about macOS 15 or 26.
- **Checks 74 (her move) and 80 (his MacBook)** get:
  - boxes for the three report lines;
  - right after the install, Jason's by-hand step: Claude counts the old Dropbox drop folder, as the app's last lines did, naming no file. At 0, Jason checks it is still empty, then deletes it, and takes it out of Finder's sidebar.
- **Check 80** first confirms that Jason's MacBook has Apple silicon, since the app is built for arm64 only. Her laptop is an M4 (`docs/setup/sallies-laptop.md`). Check 80 also gets a short first drop and export, with boxes of its own.
- **Checks 44 to 46**, which check 74 sends Jason to:
  - check 44's Terminal fallback installs with `--drop-folder`, and counts the picked folder;
  - check 45 step 8: her drop folder, the one picked at the move, opens in Finder;
  - check 46: step 1 drops into the Finder window check 45 opened. Step 3 says Claude reads the video within a few minutes of her answer: nothing waits for Dropbox (D4). Step 8 exports into the picked exports folder, then exports again. A box there says whether HyperFrames' Export dialog kept the folder for the second export.

## In step with brimm-operations

Her written guide, the BRIMM Ops guide (https://claude.ai/artifact/Vu5JmADhftiEsPz4KYN4e4), names `Drop › Sallie's laptop` in Dropbox. Phase 3 leaves the MacBooks' rows to this design. These lines change in step with this design, through the BRIMM Ops session:
- **Her drop folder**, with no path, so the words are true before the move and after: "your drop folder: say 'I have a video' and Claude opens it in Finder; it is in Finder's sidebar".
- **A video in Dropbox**, from her editor, is brought in with Option held as she drags it, so that Dropbox keeps its copy (D7). A video from another device comes by AirDrop.
- **"Make available offline"** is said only for a drop folder in Dropbox.

## Testing

Tests come first, in `tool/tests/move-app.test.js` and `tool/tests/move-app-build.test.js`.

- **What the harness gains.**
  - `moveOn` takes settings with `dropPath`, with or without `drop`. Their folders are named under the made-up home through a placeholder, as `marks` uses SHA. A folder can be made, hold files, be missing, or have a mode set and put back, as `dropMode` does today.
  - Every made-up home gets `Downloads`.
  - The fake `settings.js` prints what Phase 3's prints: `show`'s drop folder (`dropPath`, else `root/drop/machine`) and its exports line. It also gives stand-in versions of `folderWords`, `cloudFolder` and `needsFilesAccess`, which the app imports through node.
  - The stand-in installer's `--yes` writes `dropPath` and `exportsPath` from the options it is given, and makes the folder. Its `--print` gets a text and an exit code for each call.
  - The stand-in `open` answers the chooser's launch line from the test's list: a path, Cancel, no file, or `open` failing. It notes each call in the move's own log, so a test sees the order of what was said and done. No test can open a real chooser.
  - A run after a partial install is two runs. The first leaves its marks and settings, and the second starts from them.
- **Pure checks as sourced functions**, as the Ctrl-C test sources the script today:
  - reading a print's refusal and which question it sends back to;
  - the app's own checks;
  - the option line;
  - the y and c answers: `c`, `C` and `' c '` beside the existing y cases.

  `moveOn` is kept for whole runs. The move runs Studio's whole test suite on the MacBook at step 3, so new cases are kept lean.
- **The cases**, as whole runs:
  - y and y give `--drop-folder "<home>/BRIMM Video Work/Drop"` and no `--exports-folder`, in the print and in the real run.
  - c, then a pick, gives that path. Terminal's line comes first, then the chooser's launch line with its message, start folder, result file and process id, then `open -a Terminal`.
  - Cancel asks again. The end of input stops, and nothing runs for real.
  - A chooser that could not be shown asks again, and y then still takes the suggested folder.
  - A refusal naming the exports folder asks the exports question again. Every other refused pick asks the drop question again. A refused suggestion is asked again with c alone. The old folder's refusal stops.
  - The cloud question: said, with the sessions sentence. c picks again. y is kept as a mark, and not asked twice after a print shown again.
  - A print shown again after a refused pick does not count as a try at updating Claude Code.
  - The privacy note for a drop folder under Desktop, and none for the suggested folders or for Dropbox.
  - The app's own checks:
    - a line break;
    - a folder that is not empty, counted and never listed;
    - a missing suggested folder, taken as empty;
    - a drop folder Terminal cannot read (mode 000), refused, not taken as empty;
    - Downloads at mode 000, accepted by y and never looked in;
    - an exports folder in `Episodes`, in BRIMM Video Work, in `~/BRIMM Video Workshop`, or under a folder holding `.brimm-watched-by`;
    - `BRIMM VIDEO Transfer`, or a folder a made-up transcribe plist watches, for either pick.
  - Each later-run case:
    - a Mac with `dropPath`: y keeps it, with no drop option, and c gives `--drop-folder`;
    - the "Last time" pick, from the marks;
    - going back to Downloads gives `--exports-folder "<home>/Downloads"`;
    - step 1 with `dropPath`, with and without `drop`, with its folder missing, and with files in a folder nothing watches yet;
    - a Mac set up fresh, run again after a partial install, still fresh by the mark, with no question asked again.
  - A stop in the installer after the settings were written says where videos go now.
  - The Finder step, decided from the settings, for a local drop folder and for one in Dropbox, and shown again on a later run until it is done.
  - The last lines: on a moved Mac only, while the old folder is there, at 0, at N, and unreadable.
  - The report's three lines on a first run, on a later run and under `--print`.
  - `--print`: no chooser and no question.
- **Keys thrown away, on a real terminal.** One test runs the throwing-away under `/usr/bin/script -q /dev/null` (a pseudo-terminal). A stand-in chooser waits while the test types y with no Return, then a lone Return. The run must stop.
- **Two tests tie the app to Studio's real code.** Every other test uses a stand-in installer, and Phase 3's L9 rewords the installer's print lines.
  - **Tie 1** runs Studio's `settings.js` `plan` (`settingsMain(["plan", …])`) for each of `dropFolderFault`'s refusals, and for the old folder's. It feeds what it says to the move script's own reader. Each refusal must be read as a refused pick of the right folder, and the old folder's as a stop.
  - **Tie 2** runs the real `tool/install.sh --print` in a made-up home, as `install.test.js` does, and feeds each print to the move script's own functions, sourced. Its cases:
    - a drop folder in Dropbox, which must give the cloud warning and "Make available offline";
    - one under Desktop, which must give the Files and Folders line;
    - one the installer refuses;
    - one while the old drop folder holds a video;
    - a pick holding another Mac's marker;
    - a pick a made-up transcribe plist watches;
    - a name with a space, an apostrophe, an accent and an emoji.

    It also reads Studio's real `settings.js show` with `dropPath` and `exportsPath` through the app's readers.
  - So a rewording of the warning, the Files and Folders line, "Make available offline", the refusals or `show`'s two lines fails a test.
  - Lines the ties don't reach rest on Phase 3's own tests: Claude Code's lines, the lines that matter, and the background job's line.
- **The build.**
  - The bundle holds `Contents/Helpers/Choose a Folder.app`, with its Info.plist checked and its program compiled from `choose-folder.swift`.
  - The helper is signed before the app, by its own call with its identifier, the hardened runtime and the timestamp, or ad hoc without `--sign`, and its signature is verified.
  - The zip holds it.
  - `open-in-terminal.zsh` copies it with no quarantine mark: the test marks the bundle's helper with one, and its copy must have none.
  - `choose-folder.swift` is type-checked, as `launcher.swift` is. Where `swiftc` is there, the compiled program run with no arguments ends 2 with one line on stderr, and opens no window.
- **The chooser itself** is shown only by hand: check 73, and each MacBook's try. No test opens a window.

## Order, and what waits

- This is built after Phase 3 is merged into main, L1c and L9 included, on a branch from main then. The two ties need Phase 3's `settings.js` and `install.sh`, with L9's words. If it is built earlier, it is built on `claude/studio-local-folder`, and main is merged in after Phase 3 lands, with the ties run again.
- Phase 3's session holds L9 to the print lines the app reads, word for word, and sends the old and new text before any of them changes. It sends L1c's refusal words when L1c is built.
- Check 73 still waits for Jason's word that the app is ready.
- Nothing is installed, pushed or merged without Jason's yes.

## Findings for Phase 3

Findings 1 to 5 were sent to Phase 3's session on 6 November. It is checking 1 to 4 for L1c, and holds L9 to 5. Findings 6 to 9 go with this version.
1. **A picked drop folder that holds files is accepted.** The import would take every video in it, and delete each original.
2. **`--exports-folder` is checked only for being a whole path and apart from the drop folder.** `plan` accepted `BRIMM Video/Episodes`. A folder another Mac watches is accepted too.
3. **Privacy questions.**
   - `needsFilesAccess` leaves out iCloud Drive and the other cloud folders.
   - Homebrew's node is ad-hoc signed, so macOS may ask again after each node update, from the launch agent.
4. **The transcript tool's refusal compares paths as spelled** (`install.sh`, about line 610).
5. **The lines the app reads from `install.sh --print`.** Phase 3 holds L9 to them.
6. **Her chat is a third reader.** Claude Code is asked about a drop folder under Desktop, Documents, iCloud Drive or another disk at her first "what's waiting?". On a Don't Allow, `episodes` and the guide pass over the folder without a word. Ask:
   - they should say when the drop folder cannot be read, as `exportsUnreadable` does;
   - that sentence, and `DOWNLOADS_UNREADABLE`, should name Claude Code as what to allow.
7. **D11's warning talks only about timing.** It should also say that every video dropped in a cloud folder, a session too, goes up to that cloud. That goes against Phase 3's own goal that a session's recording never goes to Dropbox.
8. **The transcript tool's folders, and the places Studio keeps from her chat.** `BRIMM VIDEO Transfer`, a folder the transcribe plist watches, her chat's folders and Zoom's folder are accepted as an exports folder. `BRIMM VIDEO Transfer` is accepted as a drop folder when it is empty.
9. **Her guide's drop-folder rows** (BRIMM Ops), under "In step with brimm-operations", which Phase 3's list leaves out.

## Not here

- **Moving a MacBook again.** A MacBook moved by a build from before this design keeps its drop folder in Dropbox. A later build stops at step 3 ("This app does not move it") on a checkout at another commit. Switching that Mac is then `install.sh --drop-folder …` by hand. Question 2 asks whether the moves should wait.
- **HyperFrames' own export folder.** The app can't set it. The person chooses the folder in HyperFrames' Export dialog. Check 46 records whether the dialog keeps it.
- **Which folders Studio allows** (D11, D12). That is Phase 3's, but for the app's own checks above.
- **Anything on the Mac Studio**, but the try mode. A move there is refused, as today.

## Calls made here, for Jason to check

1. **y takes the suggested folder, and c opens the chooser.** Return alone stops, as every question in the app does. A suggestion that was refused is asked again with c alone.
2. **The drop folder leaves Dropbox at the move**, on both MacBooks (D8). The app counts the old Dropbox drop folder at the end of the run. You delete it by hand once it is empty, and take it out of Finder's sidebar.
3. **The suggestions:** BRIMM Video Work › Drop for videos (Phase 3's default), and Downloads for exports (Question 1).
4. **Studio's installer checks each pick, through its print.** The app holds a few checks of its own:
   - no line break;
   - a drop folder Terminal can look in, and empty;
   - neither folder the transcript tool's;
   - an exports folder that is not one of Studio's own, or a drop folder.
5. **The cloud question says sessions go up to the cloud.** A cloud drop folder gets Studio's own warning, that sentence, then y to keep it or c to choose again. A cloud exports folder gets no warning.
6. **The chooser is a small helper app**, started the way Finder starts an app, so that it comes in front with the keyboard. It has a Dock icon. Terminal comes back to the front after it, and keys typed meanwhile are thrown away. It is tried by hand before it reaches a MacBook, with a second way kept in case the first brings a question from macOS.
7. **A try mode** shows the chooser on each Mac before its move, and changes nothing.
8. **`--drop-folder` with the default path**, not `--switch-local`; and `--exports-folder` only when the folder changes.
9. **A Finder sidebar tip, and Option-drag**, for a drop folder on the Mac, which no longer sits in Dropbox where she knows it.
10. **Step 5 keeps its number:** the questions are part of the installer's step, so no check is renumbered.
11. **The pre-check of the old drop folder** looks only for failed imports and problems, and nothing is deleted on its word.
12. **The privacy wording** steers people to the suggested folders, which bring no question from macOS.
13. **Checks 44 to 46 change in the same publish** as checks 74 and 80. Her guide's drop-folder rows change through the BRIMM Ops session.

## Questions for Jason

1. **Which exports folder should a y take?** A Dropbox folder is one c away in either case: the person makes or picks it in the chooser.
   - Downloads (recommended). Studio deletes each export it took from Downloads after Dropbox's check of the copy in `final/`.
   - A fixed folder in Dropbox. It is shared, but each export is then in Dropbox twice, there and in `final/`, and Studio never deletes it. You would name the folder, and it must be there before the move: neither the app nor the installer makes an exports folder, and nothing here writes into Dropbox.
2. **Should each MacBook's move wait until this lands?**
   - Yes (recommended). The drop folder then leaves Dropbox at the move, as D8 plans.
   - No. A MacBook moved before this keeps `Drop › <Mac>` in Dropbox until its drop folder is switched by hand.
