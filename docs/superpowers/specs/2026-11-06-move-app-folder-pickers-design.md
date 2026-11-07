# The Move to Studio app picks the drop folder and the exports folder (design)

6 November 2026. Jason answered its questions on 7 November (below). Nothing is built until he approves the build. Branch `claude/studio-move-app-folders`, from main 673f770.

It needs Phase 3's installer options, so it is built and merged after Phase 3. Those options are L1 (af3d75a) and L1b (c125ae7) on `claude/studio-local-folder`, reviewed and not merged; L1c and L9 are coming. Phase 3's plan is `docs/superpowers/plans/2026-11-06-local-working-folder-plan.md` on that branch. Its rulings D4, D7, D8, D10, D11 and D12 are cited here by number.

This is version 5. Each version was attacked before the next:
- **Version 1** was read by a builder and attacked once.
- **Version 2** went through a workflow on Opus 5.5: four lenses, two skeptics per serious finding, and a judge on how to show the folder chooser. All 14 serious findings stood.
- **Version 3** went through a second workflow of the same four lenses: 17 serious findings stood and one was refuted, most of them about the try mode it added.
- **Version 4 and its plan** went through a third round of six lenses, three on the design and three on the plan. It found 25 serious findings, most of them in the plan. The weekly usage limit stopped its skeptics after 4 of them were checked, and all 4 stood. The round was then paused, to keep the shared extra-usage budget for Phase 3. The other 21 were ruled on here, by reading them against the code; they were not checked by skeptics. Many were the same finding seen by several lenses. The finished skeptics are kept, and the round can be resumed. Round 3's skeptics were resumed on 7 November after the weekly reset. Against version 5, 20 of its 25 serious findings were refuted (most as already handled), and the last 5 are fixed here.

Every serious finding is in this version or its plan, with most of the minor ones.

## In short

- At the move, step 5 asks where videos are dropped and where HyperFrames' exports go.
  - A y takes the suggested folder: BRIMM Video Work › Drop, and Downloads.
  - A c opens macOS's own folder chooser, with New Folder.
- The drop folder leaves Dropbox at the move. The old Dropbox drop folder is counted at the end of the run, and is deleted by hand only once it is empty.
- A cloud drop folder gets Studio's warning, and is told that every video dropped there, a client session too, goes up to that cloud.
- The app refuses a drop folder that isn't empty, and an exports folder from which Studio or the transcript tool would take the export.
- The chooser is a small helper app inside Move to Studio. It is started the way Finder starts an app, so that it comes in front with the keyboard, and falls back to a second way if it can't be shown.
- A try mode, started through the app itself, shows the chooser on each Mac before its move, and changes nothing.
- Studio's installer still checks every pick. The app reads its words, which tests tie to Phase 3's real code.

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
- no video is left where nothing watches it, unseen, whatever point a run stops at;
- Studio's installer gets exactly D8's options;
- nothing else about the move changes.

## What changes

- Step 5 (check 44) asks two questions before the installer's print.
- The installer gets `--drop-folder "<folder>"` in place of `--drop Drop`. It gets `--exports-folder "<folder>"` when the exports folder changes.
- The drop folder leaves Dropbox at the move, on both MacBooks. This is D8, and Jason's 5 November note, "the working folder is local".
- The old Dropbox drop folder (`Drop › Sallie's laptop`, or `Drop › Jason's MacBook`) is no longer watched (D10). The app counts it at the end of the run. It is deleted by hand, and taken out of Finder's sidebar, only once it is empty.
- Studio's check of the old drop folder (`heldInOld`) now runs at every move. A By-Hand pre-check looks first for what only Dropbox's status files show.
- Any stop after the installer has started says plainly where videos go now.
- The folder chooser is a small helper app in Move to Studio, with a try mode.
- Step 1, the set-up-fresh question, the report, `--print`, the build, the doc, the By-Hand page and her guide change to match.

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

- **On a Mac moved from brimm-video**, the question first says: "Today the drop folder is Drop › <Mac> in Dropbox. Once the install has run, it is no longer watched."
- **y** takes `~/BRIMM Video Work/Drop`, Phase 3's default. y and c are read as `ask_yes` reads y: any case, with spaces round them.
- **c** opens the chooser (see "The chooser").
  - Terminal first says: "A window to choose the folder is opening. If you don't see it, click the folder icon named Choose a Folder in the Dock. If no window comes at all, press Control-C; on the next run, y uses the suggested folder."
  - The chooser starts in the home folder. Its message is "Move to Studio: choose the folder you will drop videos into, or make a new one with New Folder." macOS shows no title on a chooser, so the message names the folder. Its button is "Use This Folder".
  - The folder chosen is said back in Finder's words, which Studio's own `folderWords` gives (`settings.js`, through node). When that cannot be asked, the whole path is said instead: there is no node, no Studio checkout, or an error. node's errors are kept off the screen.
  - Cancel asks the question again.
  - If the chooser cannot be shown either way, the app says "The window to choose a folder could not be shown." and asks the question again. y still takes the suggested folder, so a chooser that fails never blocks a move. It does block one in a single case: when c alone is offered (below). Then the run stops with words that fit the refusal:
    - after the not-empty refusal: "The window to choose a folder could not be shown, and <folder> is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again.";
    - after any other refusal: "The window to choose a folder could not be shown, and <folder> can't be used: <the refusal's reason>. Tell Jason, then double-click Move to Studio again."
- **Anything else**, an empty line or the end of input stops the run, as every question in the app does. A run stopped here has changed nothing in step 5.

The question changes in three cases:
- **The settings already name a drop folder of its own** (`dropPath`). This happens on a later run, after the installer wrote the settings but did not finish. The app says "This Mac's drop folder is <folder>.", then "Type y and press Return to keep it, or c and press Return to choose another." y keeps it, and the installer is given no drop option (D8).
- **A folder was picked on an earlier run**, and the settings don't name one yet. This happens when a run stopped before the installer wrote them. The app says "Last time, this folder was picked: <folder>.", then "Type y and press Return to use it again, or c and press Return to choose another."
  - That folder may hold this Mac's marker. It is held to the empty check like any new pick, since Phase 3's L1c refuses a new drop folder that holds a video. Nothing watched it, and nothing told anyone to drop there, so it should be empty.
  - If another is picked, the app says the earlier folder was left as it is, in Finder's words, with its count, counted and never listed. Jason checks it is empty, then deletes it by hand if it is not wanted.
- **y would give a refused folder again.** That covers the suggested folder, the kept one, or the last-time one, refused by the app's checks or by the installer. The question is asked with c alone: "Type c and press Return to choose another folder. Anything else stops:". A refusal that allowing Terminal in System Settings cures keeps its y.

### 2. The exports folder

```
  Where HyperFrames' exports go: the exports folder.
  Suggested: Downloads, where HyperFrames saves an export unless its Export dialog is given another folder. Studio looks in Downloads in any case, and deletes each export it takes from there once its copy in the video's final folder in Dropbox is checked.
  A folder in Dropbox is fine, for instance to share the exports with other people.
Type y and press Return to use Downloads, or c and press Return to choose another. Anything else stops:
```

- **y** takes Downloads. Nothing looks inside it (see "The app's own checks").
- **c** opens the chooser as above, starting in the home folder. Its message is "Move to Studio: choose the folder HyperFrames' exports will go into, or make a new one with New Folder."
- **A folder that is not Downloads** is followed by one note: "Studio looks for exports there and in Downloads. It copies each one into its video's final folder in Dropbox, and leaves the one there as it is. When you export in HyperFrames, choose this folder in its Export dialog. Never export into the drop folder." This is D12: Studio never deletes from an exports folder other than Downloads.
- The same three cases as the drop question apply, with one difference: the settings name an exports folder of their own only when `exportsPath` is set (read by `plutil`) and is not Downloads by real path. Its words come from Studio's `settings.js show`, where it can be asked, and its question says "HyperFrames' exports are looked for in <folder> and in Downloads".

There is no warning for a cloud exports folder. Jason: "Cloud based folders are fine for this step".

### 3. The app's checks, then the installer's print

Each pick is checked by the app's own checks (below) right after it is made. Then the print runs as today (`installer_print`), with the options below. Studio's installer is what checks the picks against D11.

- **A pick the installer refuses** is asked about again. The installer's print ends 2 with its reason on its first line. The app says those words, then asks the refused folder's question again, with c alone when y would give the same folder. The print then runs again with both folders.
  - **The two folders nested.** Today that line is `Not written: the drop folder cannot be the exports folder, or inside it, or hold it.` The app asks again the question of the folder picked on this run. When both were picked on this run, it asks the exports question.
  - **The exports question** is asked again for any `Not written: the exports folder …` line, which comes from L1c if Phase 3 adds it.
  - **The drop question** is asked again for every other line that means the drop folder was refused:
    - any `Not written: the drop folder …` line but `Not written: the drop folder would change from …`;
    - `Not written: the folder that is to hold the drop folder is not there.`;
    - `The folder <path> is watched by <Mac> already. A drop folder is watched by one Mac only.`;
    - `A folder is for transcripts or for unedited video, and not for both: …`.

  Any other refusal stops the run, as today. The likeliest is the old drop folder's check, `Not written: the drop folder would change from …`. See "What the old drop folder holds".
- **A drop folder in a cloud folder.** The print holds D11's line, `Warning: this drop folder is in <name>. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.`
  - The app says it, and adds: "Every video dropped there, a client session too, goes up to <name>, and stays in its deleted files after Studio takes it out." Phase 3's L1c may put that sentence in the Warning line itself. If it does, the app does not add its own.
  - Then it asks: "Type y and press Return to use it anyway, or c and press Return to choose another. Anything else stops:".
  - A y holds for that folder, by real path, for the rest of the run. It is not asked again when the print is shown again, after a `claude update` or after an exports folder is picked again. A different drop folder in a cloud is asked about afresh.
  - A later run asks again only if it gives the installer a new drop folder. A folder the settings already name was answered on the run that wrote it.
- **Claude Code's lines** (signed in, versions) are read after the folders, as today. Only a print after a `claude update`, or after the Claude app's own update, counts as a try at updating. A print shown again after a refused pick does not.

### 4. Before the real install

- **Privacy questions.** Before the real install's question, the app says which questions macOS may still ask. It decides by asking Studio's own `needsFilesAccess` and `cloudFolder` (`settings.js`, through node), never by its own list.
  - **On every run:** "Studio looks in Downloads for exports, whatever is picked. macOS may ask once whether Claude Code may access files in your Downloads folder, the first time the chat on this Mac hands off a video and looks for its export. It may then ask once whether node may, about 15 minutes later, when Studio deletes that export from Downloads after its copies in Dropbox are checked. Choose Allow each time."
    - Settled 7 November (finding 10, Jason: "Yes, let it delete"). From Phase 3's L5 on, the launch agent's node (`/opt/homebrew/bin/node`) reads Downloads and deletes the export there, on each MacBook and on the Mac Studio. So the line names node as well as Claude Code.
    - The words above are a draft. Studio's own `  Files and Folders:` line keeps its start and gets new words in L1c and L5. The app's line takes the exact text Phase 3's session sends when those are built.
  - **Dropbox is decided first,** by `cloudFolder`: L1c's `needsFilesAccess` will also cover `~/Library/CloudStorage`, Dropbox included.
  - **For a drop folder under Desktop or Documents, in iCloud Drive or another cloud folder, or on another disk:** "macOS may also ask whether node may read <folder>, at the first import, and whether Claude Code may, the first time the chat on this Mac looks there ("what's waiting?"). Choose Allow each time. A Don't Allow is undone in System Settings › Privacy & Security › Files and Folders, under that name. macOS may ask node again after Homebrew updates it, and until someone clicks Allow, Studio sees no video dropped there." Terminal's own question came already, at the app's check that the folder is empty.
  - **Dropbox** brings these questions only on a Mac set up fresh. On a moved Mac, node and Claude Code read Dropbox already.
  - **For an exports folder in one of those places,** or one whose look for a marker passed over a folder Terminal could not open: "macOS may ask whether Claude Code may look in <folder>, at the first hand-off. Choose Allow."
- **The marks.** Right before the real install, after its y, the app writes its marks (`.git/move-to-studio` in Studio's checkout). A path with a line break was refused already, so each mark is one line.
  - `drop=<path>` and `exports=<path>`: the folders given to the installer on this run;
  - `fresh=yes` on a Mac set up fresh.
- **The run's own record.** The app also records, for the run alone, that the installer was started.

### 5. As today, then after the install, or after any stop past it

The lines that matter, the question, the look again at the old drop folder and the import, and the real run all work as today. The real run uses the same options as the print.

- **Any stop after the installer started on this run.** This includes a stop inside it, a stop at the check of Claude, an n at a later question, Control-C and a closed window.
  - The run's stop summary (`summary`, which both `stop_here` and `interrupted` call) reads Studio's `settings.js show`. It compares its drop folder, by real path, with the drop folder at the start of the run.
  - **If the installer's output held its "From the background job:" line,** the new launch agent was started. install.sh prints it only after the agent was started. The line is noted as it is read, before the installer's status is looked at, so an installer that printed it and then ended 1 still counts.
    - If the drop folder changed, the summary says: "This Mac's drop folder is now <folder>."
    - On a Mac moved from brimm-video it adds: "Videos put in Drop › <Mac> in Dropbox are no longer imported."
  - **If that line is missing,** whether or not the folder changed, the installer stopped part way. The summary says: "Move to Studio has not finished, so a video dropped now may not be imported. Drop no video until it has finished: double-click it again now."
- **The Finder step.** The drop folder is shown in Finder (`open -R`), as today. What it says is decided from the settings, by Studio's `cloudFolder` of the settings' `dropPath`. A print that may not have run on this run is never used for this. The folder is named in Finder's words, never by the Mac's name.
  - **For a drop folder in Dropbox,** it keeps today's sentence: Control-click it, choose Make available offline. On a Mac set up fresh it also keeps today's "click Allow if macOS asks whether node may read the Dropbox folder".
  - **Otherwise** it says: "This is the drop folder from now on: <folder>. Drag it into Finder's sidebar now, under Favorites, so it is one click away. To bring in a video that is in Dropbox, hold Option as you drag it, so that Dropbox keeps its copy. Never export into the drop folder."
  - It waits for Return, as today. The step is marked done (`finder=<commit>`), and is shown on every later run until it is.
- **The last lines, on a Mac moved from brimm-video.** These lines are said only at the end of a run that reaches "Done.", never on the way to a stop, and never on a Mac set up fresh. They are said only while `Drop › <Mac>` is still in Dropbox (`$ROOT/Drop/$MACHINE`). Right before them, the app counts that folder once, as step 1 counts a drop folder: nothing but `.DS_Store` and `.brimm-watched-by`, counted and never listed. Nothing here waits or asks, so nothing here can stop the run.
  - **At 0:** "The old drop folder, Drop › <Mac> in Dropbox, is empty and no longer watched. Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar."
  - **At N:** "The old drop folder, Drop › <Mac> in Dropbox, holds N files or folders that nothing imports now. Drag each video in it into <new drop folder>, with a plain drag, which moves it out of Dropbox, and it is imported there. Jason deletes the folder by hand once it is empty."
  - **When the folder cannot be read:** "The old drop folder, Drop › <Mac> in Dropbox, could not be read, so it was not counted. Jason counts it from the Mac Studio before deleting it."
  - The By-Hand step right after the install counts it again, and the folder is deleted only at 0. A file in it that is not a video, which the import would never take, is dealt with by Jason there.

## The app's own checks

These checks run right after each pick, before the installer's print, so a pick they refuse never reaches the print or the cloud question. Each refusal says why, and asks the question again: with c alone when y would give the same folder.
- **How folders are compared.** By real path, letter case folded, as Studio's `sameOrNested` compares them. Studio's `sameFolder`, which D12 uses for Downloads, compares real paths as spelled.
- **How a pick is first taken.** It is made whole (`${pick:A}`), and must be a folder.

For either folder:
- **A line break.** A folder whose path holds a line break is refused: "A folder whose name holds a line break can't be used. Choose another." The installer reads its plan line by line, and the marks are lines.
- **Not the transcript tool's.** A folder is refused when it is, or is inside, any of these:
  - `BRIMM VIDEO Transfer` beside BRIMM Video in Dropbox (`${ROOT:A:h}`), which Studio gates (`places.js`);
  - any folder this Mac's transcript tool watches: the `WatchPaths` of `~/Library/LaunchAgents/com.thebrimm.transcribe.plist`, or of its `.plist.off`.

  The transcript tool takes each video put there and files it away. "<folder> is watched by the transcript tool, which takes each video put there. Choose another."

For the drop folder:
- **Terminal can look in it.** A folder Terminal cannot look in is refused, never taken for empty: "macOS did not let Terminal look in <folder>. Allow Terminal in System Settings › Privacy & Security › Files and Folders, or choose another folder." This refusal keeps its y, since allowing Terminal cures it.
  - A folder is "not there yet" only when the folder that holds it can be listed and the name is absent from it. A folder that cannot even be looked at is "cannot look", never "not there".
  - A folder that is not there yet is not looked in: the installer makes it.
- **Empty.** A new drop folder, picked, suggested or picked last time, must be empty. Empty means nothing in it but `.DS_Store` and `.brimm-watched-by`, as step 1 counts. A folder that is not there yet is empty. Only the settings' own drop folder is not held to this.
  - A folder that holds anything is refused: "<folder> holds N files or folders. Studio takes every video out of a drop folder, so choose an empty folder that only you drop into, or make one with New Folder."
  - Without this check, picking the Desktop would import every video on it, and the import deletes each original once it is filed (D11). The first attacker ran Phase 3's `plan` on a Desktop holding a video: it was accepted.
  - The folder is counted and never listed.

For the exports folder, which Studio checks only for being a whole path and apart from the drop folder:
- **Downloads is never looked in.** Downloads, by y or by a pick that is Downloads or inside it by real path, takes no check that reads inside it. D11 keeps every drop folder out of it, and none of Studio's folders is there. It still takes the two checks that read nothing inside it: a line break, and the transcript tool's folders.
  - So the suggested answer brings no question from macOS at the move.
  - A folder inside Downloads gets one more line in its note: "Studio tidies only Downloads itself, so exports in this folder are never tidied."
- **Not one of Studio's folders, and not a drop folder.** It is refused when it is, or is inside, any of these:
  - BRIMM Video's `Drop`, `Unedited Video`, `Episodes` or `References`;
  - BRIMM Video Work;
  - her chat's folder `~/BRIMM Video Studio`, or the workshop `~/BRIMM Video Workshop`;
  - Zoom's recordings folder: the settings' `zoomFolder`, or `~/Documents/Zoom`;
  - a folder that holds `.brimm-watched-by`, or is inside one. This is looked for in the folder and each folder above it, where Terminal can look. A place Terminal cannot look in is passed over, not refused, and the privacy note then names Claude Code's question.

  An export saved in a drop folder would be imported as a new video, and its original taken out. The words: "Exports can't go in <folder>: it is one of Studio's own folders, or a drop folder, where an export would be taken. Choose another."

These rules went to Phase 3 as findings, and L1c is adding them to the installer. The app's checks stay even then, since they come before the print, and the installer's become a second guard.

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
- **The By-Hand pre-check, before checks 80 and 74.** Claude, on the Mac Studio, runs Studio's own `heldInOld` for that Mac: its old folder, light, and the statuses in Dropbox. It names no video.
  - It is for what only Dropbox's status files show: an import of that Mac that failed, or whose late check found a problem.
  - A failed import whose video is gone has its status taken away by hand, as the installer's words say. A problem is Jason's to look at.
  - **Nothing in the old drop folder is deleted on the pre-check's word**, whatever it calls a video. From the Mac Studio, `heldInOld` cannot see the late checks a MacBook still owes, which are kept on its own disk. So it calls such a video "kept", though the MacBook's late check still needs it. A video waiting there is left for the MacBook's own import, which step 1 waits for.
- If something is missed, the move stops at step 5 with the installer's words. The doc's "Where it stops" says what to do.

## The chooser

A small helper app, `Choose a Folder.app`, inside Move to Studio at `Contents/Helpers/`. It is signed and notarized with the app. The judge picked this over a bare program, AppleScript, JavaScript for Automation, and dragging a folder into Terminal.

- **Why an app.** The Swift SDK on this Mac (macOS 27.0.1) documents that an app may no longer simply take focus. `activate(ignoringOtherApps:)` has no effect since macOS 14, and `activate()` waits for the app in front to yield, which Terminal never does. So a bare program started by the shell would likely open without the keyboard. An app started through LaunchServices (`open`) is brought in front as it starts, as Safari is in step 4.
- **Where the script finds it.** `CHOOSER_APP="${BRIMM_CHOOSER_APP:-${SELF:A:h}/Choose a Folder.app}"`. `BRIMM_CHOOSER_APP` is only for tests, as `BRIMM_HYPERFRAMES_APP` is named.
- **The first way.** `open -n -W "$CHOOSER_APP" --args "<message>" "<start folder>" "<result file>" "<the script's process id>"`.
  - The result file is in a fresh `mktemp -d` folder for each call. The helper writes it whole, then renames it into place. Its first line is `path`, `cancel` or `linebreak`. After `path`, the path is everything after the first line, less one final newline.
  - The helper itself refuses a chosen path that holds a line break, by writing `linebreak`, so no path is ever cut.
  - In this way the helper always ends 0 after writing its result. The script reads the result file first, and looks at `open`'s status only when there is no file.
- **The second way.** The helper's program, run directly as `"$CHOOSER_APP/Contents/MacOS/Choose a Folder" "<message>" "<start folder>"`.
  - It prints the path and ends 0, ends 1 on Cancel, or ends 2 with one sentence on stderr.
  - With no arguments, or a start folder that is not there, it ends 2 and opens no window.
- **When the first way can't be shown.** No file, an unreadable one, or `open` failing all mean the chooser could not be shown.
  - When `open` leaves no result file, the script polls every 0.5 s while `pgrep -f "$CHOOSER_APP/Contents/MacOS/Choose a Folder"` finds the program, with no time limit. Control-C still goes to the traps, and the helper ends with the script through its process-id watch.
  - Once the program has gone, the script reads the result file again. It tries the second way only when the helper has gone and left no result. So two choosers never show at once.
  - If the second way fails as well, it says so.
  - The second way ends 3 on a path with a line break, so that this is never mistaken for a chooser that could not be shown.
  - Which way goes first is one constant in `move.zsh`, `CHOOSER_ROUTE`, for the case where the tries show the first way bringing a question from macOS.
  - Every call is written so that `set -euo pipefail` cannot end the run on a non-zero status (`|| rc=$?`). A stop always goes through `stop_here`. Control-C while `open -W` waits goes to the script's traps, and the helper goes too (below).
- **What it shows.** `NSOpenPanel`:
  - folders only, and one at a time;
  - New Folder on;
  - links and aliases resolved;
  - the message it is given, and the button "Use This Folder".
- **In front, and findable.** It is an ordinary app, with the name "Choose a Folder" and a folder for its Dock icon (`NSApp.applicationIconImage = NSWorkspace.shared.icon(for: .folder)`, set before the panel shows). Inside, it also does what it can for the case where LaunchServices does not bring it in front:
  - it activates itself: `activate()` on macOS 14 and later, `activate(ignoringOtherApps:)` on 13;
  - its panel sits at the modal-panel level, does not hide when the app is not in front, is ordered to the front, and moves to the active Space;
  - it bounces its Dock icon if it is not in front half a second after the panel opens.
- **It goes when the move goes.** It watches the script's process id, so Control-C or a closed Terminal window takes the chooser away. The script's traps need nothing more.
- **How it starts.**
  - It sets itself up as an app first (`NSApplication.shared`, then its delegate).
  - Its `applicationDidFinishLaunching` only schedules the panel (`DispatchQueue.main.async { … runModal … }`) and returns, so the launch's open event is answered at once.
  - It never calls `runModal` before `NSApp.run()`, or inside `applicationWillFinishLaunching` or `applicationDidFinishLaunching` themselves. If it did, LaunchServices could time out (-1712, about a minute) and `open` would end 1 while the panel is still up.
  - It watches the process id on a queue of its own, not on the main queue, which the panel holds while it is open.
  - Its delegate answers any request to open a document by ignoring it. It reads its own arguments, and never takes them as files to open.
  - `open`'s own lines, and the second way's stderr, are kept off the screen. The app says its own words.
- **Asking Studio's code.** `settings.js` runs as a command when node's first argument is its own path, because of its main guard. So the app never passes that path as an argument. It passes the tool folder as the first argument and imports `settings.js` from it, as install.sh's `lock_facts` does, with node's errors kept off the screen.
- **Keys typed meanwhile.** After the chooser closes, the app brings Terminal to the front (`open -a Terminal`), then throws away any keys typed into Terminal while the chooser was open:

  ```zsh
  local thrown=0 _key
  if [[ -t 0 ]]; then
    while read -t 0 -k 1 -s _key; do thrown=$(( thrown + 1 )); done
  fi
  THROWN=$(( THROWN + thrown ))
  ```

  - This is zsh's own terminal read, with no `-u`. It leaves line mode for each key, so a y typed without Return is thrown away too, which a read of whole lines would keep.
  - It is written with `if`, never `&&`, and with `$(( … ))` assignments, never `(( … ))` alone. Either of those, under `set -e`, ends the script when a count or a test comes out 0. The two counters start at 0, as `set -u` needs: `THROWN` with the run's other state at the top of `move.zsh`.
  - It runs only when the answers come from a keyboard, so a test's piped answers are kept.
  - When `thrown` is more than 0, the app says: "Keys typed while the window was open were not taken as answers."
- **Where it runs from, with no quarantine mark.** `open-in-terminal.zsh` makes a copy of `Choose a Folder.app` in the temporary folder, beside the move script. It makes each folder with `mkdir -p`, writes each file through a redirect (`cat`), as it already writes the `.command`, and then makes the program executable again (`chmod 755`), since a redirect writes every file at 644. This keeps a download's quarantine mark off the copy, so macOS never asks about the helper.
  - On this Mac, `cp -X`, and even `ditto --norsrc --noextattr --noqtn`, keep `com.apple.quarantine` on the copy. A copy made through a redirect does not. This was tried on 6 November.
  - The comment in `open-in-terminal.zsh` that says `cp -X` leaves the marks behind is corrected.
  - A missing helper gives today's "This copy of the app is missing a part" alert.
- **Building, signing and zipping.** `build-app.sh`:
  - compiles the helper's program with the launcher's target (`arm64-apple-macos13.0`);
  - writes its Info.plist (identifier `com.thebrimm.move-to-studio.choose-folder`, name "Choose a Folder", `LSMinimumSystemVersion` 13.0) and checks it with `plutil -lint`;
  - signs the helper first, with its own `codesign` call: its identifier, the hardened runtime and a secure timestamp; or ad hoc, with no timestamp, without `--sign`;
  - then signs the app as today;
  - then verifies the helper's own signature as well as the app's;
  - zips with `ditto -c -k --norsrc --noextattr --keepParent`, here and in the printed command after stapling, so the build Mac's own marks don't travel in the zip as `._` entries. The stapled ticket is a file inside the bundle, so it travels.

## The try mode

The try mode runs step 5's two questions and nothing else, with the real chooser, the keys thrown away, Terminal brought back, and the app's own checks.

- **How it is started: through the app, as a move is.** `open "<…>/Move to Studio.app" --args --try-chooser`.
  - The launcher passes on `--try-chooser` alone, and only that exact word. Nothing else LaunchServices or Finder might add ever reaches the move script.
  - `open-in-terminal.zsh` writes it into the `.command`, which runs `/bin/zsh '<folder>/move.zsh' --try-chooser`.
  - On a MacBook, the try is run on the copy as it arrived: the AirDropped zip, opened in Downloads, with the app not moved. So Gatekeeper's question, the moved-copy path (translocation) and the helper's copy are all as at the move.
  - On the Mac Studio, check 73 can also start it from Terminal: `zsh "<app>/Contents/Resources/open-in-terminal.zsh" --try-chooser --second-way`, to try the second way.
- **It needs neither Studio's code nor node.**
  - It looks for node as step 1 does, and goes on without it.
  - It reads the Mac's folders from `settings.json` with `plutil` (`root`, `dropPath`, `exportsPath`, `zoomFolder`), never through `settings.js`.
  - BRIMM Video comes from `root`, or from the search a fresh Mac makes, with no question. If none is found, it says so, and passes over the checks that need it.
  - Each pick is said in Finder's words only when node and `$STUDIO/tool/settings.js` both answer. Otherwise it is said by its whole path, with one line: "Studio's code is not on this Mac yet, so folders are given as paths here. Finder's words come at the move."
- **It changes nothing.**
  - It writes no log, takes no lock, writes no report and no marks, changes no settings, and runs no installer.
  - It runs on any Mac, the Mac Studio included, so `which_mac`'s refusal is passed over in this mode alone.
- **Its own words.**
  - It opens with its own heading: "Trying the folder questions. Nothing is changed."
  - Its chooser line gives no advice to double-click Move to Studio, since a double-click starts a real move.
  - Its stop summary, and its stop when c alone is offered, say: "This was a try of the folder questions: nothing was changed. To try again: open "<app>" --args --try-chooser".
- **What it says at the end:** the folders picked, `sw_vers -productVersion`, `uname -m`, and whether keys were thrown away. Then: "Nothing was changed. Studio's installer checks more at the move."

## Later runs

- **Step 1 accepts a drop folder of its own.** Today step 1 stops unless the settings say drop "Drop". That is no longer enough:
  - a Mac the installer has switched keeps `drop: "Drop"` and gains `dropPath`;
  - a Mac it set up fresh with `--drop-folder` has `dropPath` and no `drop`. The attacker ran it.

  So step 1 takes either `drop: "Drop"` or a `dropPath` as expected. It treats a `dropPath` as a later run's work, as it already treats Studio's checkout. It says "drop folder: its own, <folder>".
- **What step 1 counts, and when it stops.** Step 5's look again, right before the real install, is the same function, with the same rules.
  - **Watched** means: `launchctl list com.thebrimm.unedited` finds the job loaded, and the `WatchPaths` of `~/Library/LaunchAgents/com.thebrimm.unedited.plist` name the folder, by real path. It is decided from the job macOS has loaded, not from the file alone.
  - **`Drop › <Mac>` in Dropbox** is counted while it is there, on a moved Mac whose install has not finished at this commit. On a later run that is beside the drop folder of its own. Any file in it stops the run, as today:
    - when watched: "still to be imported", as today;
    - otherwise: "N files or folders wait in the old drop folder, Drop › <Mac>, and nothing imports them now. Tell Jason."
  - **A drop folder of its own** is counted as the folder `settings.js show` names. A drop folder that is not there yet counts as empty: the installer makes it. Files in it stop the run with "still to be imported" only when it is watched. Otherwise the run goes on: "N files or folders wait in <folder>. Nothing watches it yet: the install starts the watching, and they are imported then."
  - **Its sentence for a folder it cannot read** names no cloud: "macOS may have asked whether Terminal may read it…".
  - **Once the install has finished at this commit,** a later run counts the drop folder for the report and does not stop on it. Only step 7 and the end are left then, and neither changes the drop folder. A video held there, or one whose import failed, then never blocks the run.
- **A Mac set up fresh is remembered.** The `fresh=yes` mark is written right before the real install.
  - On a later run, the settings are there, and `which_mac` reads the mark. The run treats the Mac as set up fresh: step 7 leaves brimm-video's key alone, and no line names an old Dropbox drop folder.
  - It does not search Dropbox or ask the set-up-fresh question again. Step 1 says "set up fresh on an earlier run", takes BRIMM Video and the drop folder from the settings, and counts the drop folder.
- **The report** is written whole on every run, so its three new lines are filled on every run. They go under the report's existing heading for check 44, and the By-Hand page's boxes for checks 74 and 80 are labelled the same:
  - `Drop folder:` and `Exports folder:` hold the folders given to the installer on this run. After the install, they hold the folders Studio's `settings.js show` names.
  - `Cloud warning:` holds Studio's `cloudFolder` of the drop folder: `none`; `<name>, kept on a y`; or `<name>, kept on a y on an earlier run`, when the settings already named it.
  - Under `--print`, each says "not checked: this was a print".

## Other changes

- **The set-up-fresh question** said "its own drop folder (Drop › Jason's MacBook)". It now says "a drop folder picked in step 5 (suggested: BRIMM Video Work › Drop, on this Mac)".
- **`--print`** asks nothing and opens no chooser.
  - It says "Would ask where videos are dropped (suggested: BRIMM Video Work › Drop) and where HyperFrames' exports go (suggested: Downloads)".
  - It runs the app's own checks on the folders y would give, which only read. A refused one stops the print with its words.
  - It shows the installer's print with those folders. On a Mac with `dropPath`, or `exportsPath`, it keeps them, as a y would.
- **The doc** (`docs/setup/move-to-studio-app.md`):
  - "Nothing is typed but y or n" becomes "but y, n or c";
  - step 5 and the try mode;
  - "Where it stops, and what to do": a refused pick, the cloud question, the privacy questions, a chooser that could not be shown, the old drop folder's check, and a stop after the installer started;
  - "Building the app": the helper app, and the zip;
  - the tests.
- **Step 3's time.** The move runs Studio's whole test suite at step 3, and says how long it takes. That time is measured again with the new tests, and `move.zsh`'s sentence and the doc change together.
- **The 5 November design** (`2026-11-05-laptop-move-app-design.md`): its "The next round" points here.

## The By-Hand page

The live page is re-read before each publish, since the review session publishes the same page.

What changes:
- the move group (checks 72 to 74);
- his MacBook's group (check 80), which is a group of its own;
- the laptop checks 44 to 46 that check 74 sends Jason to.

Existing steps that describe a drop folder in Dropbox are rewritten, not only added to, so that nothing on the page contradicts the app on the day of a move.

- **His MacBook moves first.** Check 80 runs before check 74, as a rehearsal, so the parts of step 5 that the try never reaches run for real on his MacBook before hers.
- **Before checks 80 and 74**, the pre-check under "What the old drop folder holds".
- **Check 73 (build, sign, notarize)** gets these steps after the build. The check still waits for Jason's word that the app is ready.
  - **Signatures.**
    - `codesign -dvvv` on the helper shows the Developer ID authority, the runtime flag, a timestamp and its identifier.
    - `codesign --verify --strict --deep` on the app passes.
    - The notary log lists no issue for the helper.
    - After stapling, `spctl` accepts the app.
    - The zip holds no `._` entries.
  - **The try mode on the Mac Studio.** Claude starts it through the app (`open … --args --try-chooser`), so Terminal is in front as at a move. Then it starts it again from Terminal with `--second-way`.
    - Jason keeps one chooser open for two minutes before picking.
    - The test folders are made in one folder on the Desktop, never in BRIMM Video Work, and that folder is deleted afterwards.
    - In the temporary folder, `ls -l` shows the helper's program executable, and `codesign --verify --strict` passes on the copy.
    - For each way, Jason notes:
      - whether it came in front of Terminal with the keyboard, and any question macOS asked, with the name it gave;
      - that New Folder works, by its button and by Command-Shift-N, and that a name with spaces, a curly apostrophe, an accent and an emoji is said back as Finder shows it;
      - what Cancel does;
      - that y typed into Terminal while it was open, with and without Return, is thrown away, and the next question still waits;
      - that Terminal is in front after it closes;
      - that Control-C, and closing the window, take the chooser away;
      - that Return at once picks the chooser's start folder, the home folder. In the drop chooser it is refused as not empty. In the exports chooser, the app's checks accept it, and at a move the installer refuses it, since it holds the drop folder.
    - If there is time, he tries Terminal in full screen, on another desktop, and with Stage Manager on.
- **Before her laptop.** The notarized zip goes by AirDrop to a Mac that is not the build Mac (Jason's MacBook). First `uname -m`, to confirm Apple silicon, since the app is built for arm64 only (her laptop is an M4, per `docs/setup/sallies-laptop.md`). Then, from Downloads, with the app not moved, `open "…/Move to Studio.app" --args --try-chooser`.
  - Gatekeeper may ask its one question for Move to Studio, and none for the helper.
  - The same notes as above, with a second display if one is there.
- **On each MacBook, before its move:** `sw_vers`, `uname -m`, then the try through the app, with the same notes. Finder's words are not expected there: Studio's code isn't on the MacBook until the move. A pass on 27.0.1 says nothing about macOS 15 or 26.
- **Checks 74 (her move) and 80 (his MacBook)** get:
  - boxes for the three report lines, labelled as the report labels them;
  - on a Mac moved from brimm-video, right after the install, Jason's by-hand step: Claude counts the old Dropbox drop folder, as the app's last lines did, naming no file. At 0, Jason checks it is still empty, then deletes it, and takes it out of Finder's sidebar.
- **Check 80** also gets a short first drop and export, with boxes of its own.
- **Checks 44 to 46**, which check 74 sends Jason to:
  - **Check 44's** Terminal fallback installs with `--drop-folder`, and counts the picked folder.
  - **Check 45, step 8:** her drop folder, the one picked at the move, opens in Finder. A new box asks whether it is in Finder's sidebar and the old Dropbox drop folder is out of it.
  - **Check 46:**
    - step 1 drops into the Finder window check 45 opened;
    - step 3 says Claude reads the video within a few minutes of her answer, since nothing waits for Dropbox (D4);
    - step 8 exports into the picked exports folder, then exports again.
    - Boxes: which folder HyperFrames' Export dialog opened in, whether it kept the picked folder for the second export, and which questions macOS asked, and when.

## In step with brimm-operations

Her written guide, the BRIMM Ops guide (https://claude.ai/artifact/Vu5JmADhftiEsPz4KYN4e4), names `Drop › Sallie's laptop` in Dropbox. Phase 3's in-step list leaves the MacBooks' rows to this design, and Phase 3's session carries these lines to the BRIMM Ops session with L9 (finding 9):
- **Her drop folder**, with no path, so the words are true before the move and after: "your drop folder: say 'I have a video' and Claude opens it in Finder". The words "it is in Finder's sidebar" are added once check 45's sidebar box is ticked.
- **A video in Dropbox**, from her editor, is brought in with Option held as she drags it, so that Dropbox keeps its copy (D7). A video from another device comes by AirDrop.
- **Her export row:** "Never export into the drop folder."
- **"Make available offline"** is said only for a drop folder in Dropbox.

## Testing

Tests come first, in `tool/tests/move-app.test.js`, `tool/tests/move-app-build.test.js`, and a new `tool/tests/move-app-ties.test.js` for the ties.

- **What the harness gains.**
  - `moveOn` takes settings with `dropPath`, with or without `drop`. Their folders are named under the made-up home through a placeholder, as `marks` uses SHA. A folder can be made, hold files, be missing, or have a mode set and put back, as `dropMode` does today.
  - Every made-up home gets `Downloads`.
  - The fake `settings.js` prints what Phase 3's prints: `show`'s drop folder (`dropPath`, else `root/drop/machine`) and its exports line. It also gives stand-in versions of `folderWords`, `cloudFolder` and `needsFilesAccess`, which the app imports through node. The old checkout's copy of the fake does not have them, as brimm-video's real file has none.
  - The stand-in installer's `--yes` writes `dropPath` and `exportsPath` from the options it is given, and makes the folder. It prints the "From the background job:" line, or leaves it out when a test says so. Its `--print` gets a text and an exit code for each call.
  - The stand-in `open` answers the chooser's launch line from the test's list: a path, Cancel, `linebreak`, no file, or `open` failing. It checks it was given `BRIMM_CHOOSER_APP`'s path, and notes each call in the move's own log, so a test sees the order of what was said and done.
  - The stand-in helper app, at `BRIMM_CHOOSER_APP`, has a program that answers the second way: a path, Cancel (1), 2 with a sentence, or missing.
  - A stand-in `launchctl list com.thebrimm.unedited`, and a plist whose `WatchPaths` the test names.
  - No test can open a real chooser.
  - A run after a partial install is two runs: the first leaves its marks and settings, and the second starts from them.
- **Pure checks as sourced functions**, as the Ctrl-C test sources the script today. `CHOOSER_ROUTE` is a plain variable, which a test sets after sourcing.
  - reading a print's refusal, and which question it sends back to;
  - the app's own checks;
  - the option line;
  - the y and c answers: `c`, `C` and `' c '` beside the existing y cases;
  - the second way: a path, Cancel, 2 with a sentence, and a missing program.

  `moveOn` is kept for whole runs. The move runs Studio's whole test suite on the MacBook at step 3, so cases share a home where they can.
- **The cases**, as whole runs:
  - **The two questions.**
    - y and y give `--drop-folder "<home>/BRIMM Video Work/Drop"` and no `--exports-folder`, in the print and in the real run.
    - c, then a pick, gives that path. In order: Terminal's line, the chooser's launch line with its message, start folder, result file and process id, then `open -a Terminal`.
    - Cancel asks again. The end of input stops, and nothing runs for real.
    - The first way not shown: the second way is tried. Both not shown: the question is asked again, and y then still takes the suggested folder. With c alone offered, the run stops with its words.
  - **Refusals.**
    - A refusal naming the exports folder asks the exports question again.
    - The nesting refusal asks again the question of the folder picked on this run.
    - Every other refused pick asks the drop question again.
    - y that would give the refused folder again is asked with c alone.
    - The old folder's refusal stops.
  - **The cloud question.** It is said with the sessions sentence, and c picks again. A y holds for that folder when the print is shown again. A different cloud folder is asked about afresh.
  - **Claude Code's update.** A print shown again after a refused pick does not count as a try at updating Claude Code.
  - **Privacy.** The Downloads line on every run. The note for a drop folder under Desktop, none for the suggested drop folder, and none for Dropbox on a moved Mac.
  - **The app's own checks:**
    - a line break;
    - a folder that is not empty, counted and never listed;
    - a missing suggested folder, taken as empty;
    - the last-time folder holding files, refused as not empty;
    - a folder that cannot even be looked at, refused as "cannot look", never taken as not there;
    - a drop folder Terminal cannot read (mode 000), refused, not taken as empty;
    - Downloads at mode 000, accepted by y and never looked in;
    - a folder inside Downloads, with its note;
    - an exports folder in `Episodes`, in BRIMM Video Work, in `~/BRIMM Video Workshop`, or under a folder holding `.brimm-watched-by`;
    - `BRIMM VIDEO Transfer`, or a folder a made-up transcribe plist watches, for either pick.
  - **Later runs:**
    - a Mac with `dropPath`: y keeps it, with no drop option, and c gives `--drop-folder`;
    - the "Last time" pick, from the marks;
    - going back to Downloads gives `--exports-folder "<home>/Downloads"`;
    - step 1 with `dropPath`, with and without `drop`, with its folder missing, and with files in it, loaded and not;
    - `Drop › <Mac>` holding a file: stopped with "still to be imported" when watched, and with "Tell Jason" when not;
    - a Mac set up fresh, run again after a partial install: still fresh by the mark, with no question asked again.
  - **A stop after the installer started:**
    - with the background job's line: "This Mac's drop folder is now …", with the Dropbox sentence on a moved Mac only;
    - without it: "Move to Studio has not finished…";
    - an n at the HyperFrames question after the install: the first of these.
  - **The Finder step,** decided from the settings, for a local drop folder and for one in Dropbox, on a moved Mac and on a fresh one, and shown again on a later run until it is done.
  - **The last lines:** on a moved Mac only, at the end of a run that reaches "Done.", while the old folder is there: at 0, at N, and unreadable, each said once, with no wait. A stop after the install says none of them.
  - **The report's three lines** on a first run, on a later run and under `--print`.
  - **`--print`:** no chooser and no question. A Mac with `exportsPath` keeps it. A refused suggestion stops the print.
  - **The try mode:**
    - on the Mac Studio's settings: the two questions, the home's files unchanged (no log, no lock, no report, no marks), and no installer;
    - with no Studio checkout and no node: paths, and its line;
    - with no settings: BRIMM Video found with no question;
    - with none found: says so, and still asks;
    - `--try-chooser` with `--commit` or `--print`: refused, with exit 2.
- **Keys thrown away, on a real terminal.** macOS's `/usr/bin/script` refuses input that is a socket, which is what node's pipes are. So the test runs it behind a real pipe (`/bin/sh -c 'cat | /usr/bin/script -q /dev/null /bin/zsh …'`). It waits on the run's output before each key: for the echoed y before it lets the chooser close. Each wait has a time limit. The child is spawned detached, and a `finally` block makes the release file, ends `cat`'s input, then kills the whole process group. The stand-in chooser gives up on its own after about 15 s. A second test sends Control-C (`\x03`) while the stand-in chooser waits: the run must end with the stop summary, and the stand-in must see the script's process end.
  - A stand-in chooser waits while the test types y with no Return.
  - Then the chooser closes, and the test sends a lone Return. The run must stop, and must have said "Keys typed while the window was open were not taken as answers."
  - The test is skipped where `/usr/bin/script` is missing.
- **Three ties to Studio's real code**, in `move-app-ties.test.js`. Every other test uses stand-ins, and Phase 3's L1c and L9 still change its words.
  - **Tie 1** runs Studio's `settings.js` `plan` (`settingsMain(["plan", …])`) for each of `dropFolderFault`'s refusals, the nesting one, and the old folder's. It feeds what it says to the move script's own reader. Each must be read as a refused pick of the right folder, and the old folder's as a stop.
  - **Tie 2** runs the real `tool/install.sh --print` in a made-up home, as `install.test.js` does. It feeds each print to the move script's own reader, sourced, and pins only the lines the app reads. Its cases:
    - a drop folder in Dropbox, whose Warning line must be read with its cloud's name;
    - a pick the installer refuses;
    - a pick while the old drop folder holds a video;
    - a pick holding another Mac's marker;
    - a pick a made-up transcribe plist watches;
    - a name with a space, an apostrophe, an accent and an emoji, which must be passed whole.

    It also reads Studio's real `settings.js show` with `dropPath` and `exportsPath` through the app's readers.
  - **Tie 3** sources the move script with `STUDIO` at the real checkout and the real node. It calls the app's own decisions for paths in Dropbox, under Desktop, in iCloud Drive, on `/Volumes`, and in BRIMM Video Work:
    - the words a folder is said in;
    - the Finder step's sentence;
    - the privacy lines.

    These rest on Studio's `folderWords`, `cloudFolder` and `needsFilesAccess`, so a change to those fails here.
  - **What the ties cover.** A rewording of the lines the app reads fails a test: the refusals, the Warning line, and `show`'s two lines. So does a change to the three functions. Lines the ties don't reach rest on Phase 3's own tests: Claude Code's lines, the lines that matter, and the background job's line.
- **The build.**
  - The bundle holds `Contents/Helpers/Choose a Folder.app`, with its Info.plist checked and its program compiled from `choose-folder.swift`.
  - The helper is signed before the app, by its own call with its identifier, the hardened runtime and the timestamp, or ad hoc without `--sign`, and its signature is verified.
  - The zip holds it, made with `--norsrc --noextattr`, with no `._` entries.
  - `open-in-terminal.zsh` copies it with no quarantine mark: the test marks every item of the bundle's helper with one, folders included. The copy's files must equal their sources byte for byte, its program must be executable, and no item may carry `com.apple.quarantine`. The test checks that mark by name, since a copy may rightly carry `com.apple.provenance`.
  - `open-in-terminal.zsh --try-chooser` writes the try's `.command`.
  - The launcher passes on an exact `--try-chooser`, and nothing else. This is checked in its source, and, where `swiftc` is there, by running it.
  - Where `swiftc` is there, `choose-folder.swift` is compiled once into a temporary folder, at build-app.sh's own target (`-target arm64-apple-macos13.0`). That compile is its type-check. The Swift tests share one module cache. The compiled program run with no arguments must end 2 with one line on stderr, within a time limit, and open no window.
- **The chooser itself** is shown only by hand: check 73, and each MacBook's try. No test opens a window.

## Order, and what waits

- This is built after all of Phase 3 is merged into main, L1c and L9 included, on a branch from main then. The ties need Phase 3's `settings.js` and `install.sh` with their final words.
- Phase 3's session holds the lines the app reads, word for word, from L1c on. Before any of them changes, it sends the old and new text, with L1c's refusal words. If this is built before Phase 3 merges, it is built on `claude/studio-local-folder`, and main is merged in after Phase 3 lands, with the ties run again.
- Check 73 still waits for Jason's word that the app is ready.
- Nothing is installed, pushed or merged without Jason's yes.

## Findings for Phase 3

Findings 1 to 9 were sent to Phase 3's session on 6 November.
- **1 to 8** join L1c, each checked in the code first.
- **9** goes to L9 and its in-step list for BRIMM Ops.
- **Finding 5:** Phase 3 holds the lines the app reads.

The findings:
1. **A picked drop folder that holds files is accepted.** The import would take every video in it, and delete each original.
2. **`--exports-folder` is checked only for being a whole path and apart from the drop folder.** `plan` accepted `BRIMM Video/Episodes`. A folder another Mac watches is accepted too.
3. **Privacy questions.**
   - `needsFilesAccess` leaves out iCloud Drive and the other cloud folders.
   - Homebrew's node is ad-hoc signed, so macOS may ask again after each node update, from the launch agent.
4. **The transcript tool's refusal compares paths as spelled** (`install.sh`, about line 610).
5. **The lines the app reads from `install.sh --print`.**
6. **Her chat is a third reader.** On a Don't Allow, `episodes` and the guide pass over the drop folder without a word. They should say so, and the unreadable sentences should name Claude Code.
7. **D11's warning talks only about timing.** It should also say that every video dropped in a cloud folder, a session too, goes up to that cloud.
8. **The transcript tool's folders, and the places Studio keeps from her chat,** accepted as an exports folder. `BRIMM VIDEO Transfer` is also accepted as a drop folder when it is empty.
9. **Her guide's drop-folder rows**, under "In step with brimm-operations".

One more goes with this version:

10. **Downloads and the launch agent.** If L5 moves the delete from Downloads into the launch agent, then node, not only Claude Code, will need to be let into Downloads. The app's Downloads line names Claude Code alone. **Settled 7 November:** Jason, "Yes, let it delete". The Downloads line now names node too (step 4).

## Not here

- **Moving a MacBook again.** A MacBook moved by a build from before this design keeps its drop folder in Dropbox. A later build stops at step 3 ("This app does not move it") on a checkout at another commit. Switching that Mac is then `install.sh --drop-folder …` by hand. Jason answered "yes, wait" (7 November): the moves wait for this.
- **HyperFrames' own export folder.** The app can't set it. The person chooses the folder in HyperFrames' Export dialog. Check 46 records what the dialog does.
- **Which folders Studio allows** (D11, D12). That is Phase 3's, but for the app's own checks above.
- **Anything on the Mac Studio**, but the try mode. A move there is refused, as today.

## Calls made here, for Jason to check

1. **y takes the suggested folder, and c opens the chooser.** Return alone stops, as every question in the app does. When y would give a refused folder again, only c is offered.
2. **The drop folder leaves Dropbox at the move**, on both MacBooks (D8). The app counts the old Dropbox drop folder at the end of the run. You delete it by hand once it is empty, and take it out of Finder's sidebar.
3. **The suggestions:** BRIMM Video Work › Drop for videos (Phase 3's default), and Downloads for exports (Jason: "Downloads").
4. **Studio's installer checks each pick, through its print.** The app holds a few checks of its own:
   - no line break;
   - a new drop folder Terminal can look in, and empty;
   - neither folder the transcript tool's;
   - an exports folder that is not one of Studio's own, or a drop folder.
5. **The cloud question says sessions go up to the cloud.** A cloud drop folder gets Studio's own warning, that sentence, then y to keep it or c to choose again. A cloud exports folder gets no warning.
6. **The chooser is a small helper app**, started the way Finder starts an app, so that it comes in front with the keyboard. It has a Dock icon. It falls back to a second way when it can't be shown. Terminal comes back to the front after it, and keys typed meanwhile are thrown away.
7. **A try mode, started through the app,** shows the chooser on each Mac before its move, and changes nothing. It needs nothing of Studio's on the MacBook.
8. **Any stop after the installer started** says where videos go now, or that nothing may import yet.
9. **`--drop-folder` with the default path**, not `--switch-local`; and `--exports-folder` only when the folder changes.
10. **The Finder step tells her to put the drop folder in Finder's sidebar**, and to Option-drag a video from Dropbox. It also says never to export into the drop folder.
11. **Step 5 keeps its number:** the questions are part of the installer's step, so no check is renumbered.
12. **The pre-check of the old drop folder** looks only for failed imports and problems, and nothing is deleted on its word.
13. **The privacy wording.** It names macOS's question about Downloads on every run, and steers people to the suggested drop folder, which brings none.
14. **Checks 44 to 46 change in the same publish** as checks 74 and 80. Her guide's lines go through Phase 3's session to BRIMM Ops.
15. **The zip loses the build Mac's own marks** (`--norsrc --noextattr`). That also changes today's zip, for the better.
16. **His MacBook moves before hers**, as a rehearsal of the real step 5.
17. **The end of the run counts the old Dropbox drop folder once, and never waits.** Deleting it waits for the By-Hand count at 0. A stop never counts it, so a stop can always stop.
18. **A folder picked on a run that stopped is held to the empty check, like any new pick**, to match L1c.

## Jason's answers (7 November)

1. **Which exports folder a y takes:** "Downloads". The suggestion stays Downloads. A Dropbox folder is still one c away, picked or made in the chooser.
2. **Whether each MacBook's move waits until this lands, after all of Phase 3:** "yes, wait". The moves (checks 80 and 74) come after this is merged. Check 73, the build, still waits for his word that the app is ready.
3. **Pushing this branch as a draft pull request, design and plan only:** "yes". It merges only after Phase 3.
4. **Whether the launch agent's node deletes the export in Downloads** (finding 10, through Phase 3's session): "Yes, let it delete". Claude Code looks for the export at the hand-off, and node deletes it about 15 minutes later, so the app's Downloads line names both.
