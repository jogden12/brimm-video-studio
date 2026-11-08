# The Move to Studio app

For Jason, who runs the move with Sallie. This is a small Mac app that moves her laptop from brimm-video to Studio, and sets up Jason's MacBook too: moved from brimm-video, or set up fresh if it has none (6 November). On her laptop it does the Terminal work of checks 41, 42 and 44 on the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT) and part of check 43 and check 48. Checks 45 to 47 stay on screen, by hand.

The app, its build and the notarizing are all run from that page, each on Jason's yes. Nothing is installed on any Mac by building the app.

## What it is

- "Move to Studio", an app for Sallie's laptop and Jason's MacBook. A Mac whose brimm-video settings name one of the two is moved under that name. A Mac with no brimm-video settings is set up fresh as Jason's MacBook, after a y. It stops at once on any Mac whose settings name another Mac, the Mac Studio included.
- Double-clicked, it opens one Terminal window and walks through the move there, one step at a time.
- Nothing is typed but y, n or c. The c is only for step 5's two folder questions: it opens macOS's own window to choose a folder.
- Before each change it says what will change, then asks: `Go ahead? Type y and press Return, or n to stop: `
- `y` and `yes` go ahead, in any case. Return alone is no. So is anything else.
- Each step looks first and does only what is not done yet. A second run says "Already done" for what is done and goes on.
- It keeps the Mac awake while it runs. Keep the lid open and the charger in.
- One run at a time. A second double-click while a first run is still going says so and stops at once; use that run's window, or close it and double-click again. A window left open after its run stopped holds nothing back: a new double-click runs. A `--print` takes no such lock.

The code is in `tool/move-app/`:

- `move.zsh`: the steps.
- `open-in-terminal.zsh` and `launcher.swift`: how the app hands the steps to Terminal.
- `choose-folder.swift`: the small helper app that shows macOS's folder window (see step 5).
- `build-app.sh`: makes, signs and zips the app, and the helper inside it.

## What it does, in order

### 1. Looking at this Mac (check 41). This changes nothing.

It shows:

- the Mac's macOS, and its free disk (under 100 GB is said, and does not stop the move);
- Xcode's command line tools, Homebrew and node (22 or later);
- brimm-video's settings: the light import, hand-off version 2, the drop folder `Drop`, and a checkout that is brimm-video's or Studio's;
- that no import is running;
- that the drop folder is empty. The drop folder is the one brimm-video's `settings.js show` names. Files are counted and never named. A folder that cannot be read is not taken for an empty one: the app stops and says to allow Terminal in Privacy & Security;
- Claude Code in Terminal: signed in or not, its plan and its version. Never the account's email.

If Claude Code is not signed in, it asks first, then runs `claude auth login`. That opens the browser, to sign in to the Mac's own Claude account.

On a Mac with no brimm-video settings, in place of the settings and the drop folder, it finds Dropbox's The BRIMM DB › BRIMM Video. It looks at the top of each Dropbox in `~/Library/CloudStorage` and `~/Dropbox`, and a level deeper, in a team member's folder (as on the Mac Studio: `Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB`). With none, or more than one, it stops before asking anything. Then it asks to set the Mac up fresh as Jason's MacBook. Studio's installer makes the settings and the drop folder in step 5.

### 2. Studio's key (check 42)

- Makes a read-only key, `~/.ssh/brimm_video_studio_deploy`, and shows its public half. The public half is copied, and kept on her Desktop as `Studio key (public half).txt`.
- Adds a Host entry for `github-brimm-video-studio` to `~/.ssh/config`, after what is there. The rest of the file stays byte for byte.
- Adds GitHub's published host key to `~/.ssh/known_hosts`, after showing its fingerprint (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`). ssh trusts no other host.
- Waits while the public half goes on GitHub (by hand, below). Press Return, and it checks with `ssh -T`. If GitHub says `Permission denied`, it says GitHub does not know the key yet, and waits again.
- A key from an earlier run is kept. A key at that name with another comment is never touched.

### 3. Studio's code (check 42)

- Clones Studio into `~/Claude Code/brimm-video-studio.partial`, puts main at the commit the app was made at, and only then renames the folder. A clone cut short never blocks the next run: the next run takes the half-made folder away and clones again.
- If the folder is already there, it must be Studio's own clone, clean, on main, at the app's commit. Anything else stops the app, and it touches nothing.
- Runs Studio's own tests (about 4 minutes, changing nothing). A pass is marked in `.git/move-to-studio`, so a later run does not run them again at the same commit. One failing test stops the app.

### 4. The HyperFrames app (check 43)

- If `/Applications/HyperFrames.app` is there, it notes the version.
- If not, it opens https://hyperframes.dev/studio in Safari and waits while the app is downloaded, dragged into Applications and opened once. The wait also says to sign in to HeyGen and to choose Claude Code as the agent, on Auto, as check 43 says.
- The HeyGen sign-in and the agent on Auto stay by hand.

### 5. Studio's installer (check 44)

Two questions come first, then the installer's print, then the real install.

**The two folder questions.** Each takes y or c. Anything else, an empty line or the end of input stops the run.

- *The drop folder*, where videos are dropped for Studio. The suggested folder is BRIMM Video Work › Drop, in the home folder: on this Mac, made by the installer, with no macOS questions about it. A Mac that already has a drop folder in its settings is asked whether to keep it (y), and a folder picked on an earlier run that did not finish is offered again. A Mac moved from brimm-video is also told that today's drop folder (Drop › the Mac's name, in Dropbox) is no longer watched once the install has run.
- *The exports folder*, where HyperFrames' exports go. The suggested folder is Downloads. After any other folder the app says that Studio looks there and in Downloads, copies each export into its video's final folder in Dropbox, leaves the one in the exports folder as it is, and that HyperFrames' Export dialog must be given that folder. A folder inside Downloads is never tidied.
- `y` takes the folder the question names. `c` opens the folder window (below), where a new folder can be made with New Folder. A pick is said back in Finder's words ("Picked: ...").
- The app checks every pick itself, before the installer sees it. A drop folder is refused if the transcript tool watches it (or holds it, or is inside it), if macOS did not let Terminal look in it, if its name holds a line break, or if it is not empty. An exports folder is refused if it is one of Studio's own folders, a drop folder, or the transcript tool's. A refused pick is not a stop: the words say why, and the question is asked again. When y would give the same refused folder, only c is offered.
- Studio's installer checks again. If its print refuses a pick, the app says the installer's line and asks that question again, then prints again.
- A drop folder in Dropbox, iCloud Drive or another cloud folder gets Studio's warning from the print, and one more question: y uses it anyway (the answer holds for that folder for the rest of the run), c chooses another. Every video dropped in a cloud folder, a client session too, goes up to that cloud.
- Before the real install, the app says which questions macOS may still ask (Downloads, the drop folder, the exports folder) and to choose Allow.
- A folder picked on an earlier run and not taken this time is left as it is, and the app says how many files or folders it holds. Jason deletes it by hand once it is empty.

**The folder window.** It is a helper app inside Move to Studio, `Choose a Folder.app`. It has an Edit menu, so Command-V, Command-C, Command-X, Command-A and Command-Z work in its boxes (New Folder's name, Go to Folder), and Control-Command-Space opens the emoji picker. The first way starts it the way Finder starts an app, so that it comes in front with the keyboard; if it cannot be shown, a second way runs its program directly. It answers through a file, whole or not at all. Keys typed into Terminal while the window is open are thrown away, and Terminal is brought back to the front. If neither way can be shown, y still takes the suggested folder; only a question where c alone is offered stops, with the words in "Where it stops" below.

**Then the installer.**

- Runs `install.sh --print` with `--machine "<the Mac's name>" --import light --handoff 2`, the BRIMM Video folder (read from the Mac's settings, or found in Dropbox on a Mac set up fresh), and the two folders. The drop folder is given as `--drop-folder` unless the settings' own is kept; the exports folder as `--exports-folder` when it differs from the one the settings name. It shows all of it.
- If the print refuses for any reason the app cannot ask again, the app shows its words and stops. It never runs the installer with `--yes` then.
- If Claude Code in Terminal is older than the installer wants, it asks, runs `claude update`, and prints again.
- If the Claude app's own Claude Code is older, it says to choose Claude, then Check for Updates, and prints again when Return is pressed.
- Repeats the lines that matter: Claude Code's sign-in and versions, HDR video, the folder's lock.
- Asks once. On y it looks again at the drop folder (a Mac set up fresh has none yet) and the import (the installer does not look at the drop folder here: it does that only when it switches the folder), with the same words and stops as step 1. Then it runs the same line for real with `--yes`. This can take a few minutes, and ends with one real call to Claude from the background job (up to 90 seconds).
- Then it checks for the line `From the background job: Claude answered from here`. Any other background-job line ("could not be asked", "did not answer within 90 seconds") stops the app with that line shown, and writes no installed mark. It also checks that the one-shot check agent (`com.thebrimm.claude-check.plist`) is gone.
- The stop summary lists "ran Studio's installer (if it stopped, its last lines say how far it got)" from the moment it starts, and the plain "ran Studio's installer" once it has finished.
- Asks, then turns HyperFrames on as the editing app (`settings.js set --app hyperframes`).
- Shows the drop folder in Finder. For a drop folder in Dropbox it says to Control-click it and choose Make available offline (on a Mac set up fresh, also to click Allow if macOS asks whether node may read the Dropbox folder). For any other it says to drag the folder into Finder's sidebar, under Favorites, to hold Option when dragging a video in from Dropbox so that Dropbox keeps its copy, and never to export into the drop folder.

**On a later run.** The folders asked about are remembered in `.git/move-to-studio` (`drop=`, `exports=`) as the folders given to the installer on the last run. A run after the installer finished at the app's commit does not ask the two folder questions or run the installer again, and says "Already done" for them. The later questions still come as they are needed: HyperFrames as the editing app, the Finder step, and the old key.

### The try mode (step 5's questions alone)

`--try-chooser` runs the two folder questions and nothing else, on any Mac, before its move. It writes no log, takes no lock, writes no report, no marks and runs no installer, and it does not need Studio's code, a Dropbox folder or the Mac's settings. It ends with "What was picked": the two folders in Finder's words (or as paths, when Studio's code is not on the Mac yet), the macOS version, the chip, and how many keys were typed while a window was open. It says "Nothing was changed."

Start it through the app itself, so Terminal comes in front as at a move:

```
open "<path to Move to Studio.app>" --args --try-chooser
```

`--second-way` shows the window by its program first, which is how the second way is tried. The app passes on only `--try-chooser`, so start it from Terminal, through the app's helper:

```
zsh "<path to Move to Studio.app>/Contents/Resources/open-in-terminal.zsh" --try-chooser --second-way
```

When a try stops (an n, Control-C, or a window that could not be shown), its last lines say how to start it again. A finished try ends: `Nothing was changed. Studio's installer checks more at the move.` Run by hand from the repo, `zsh tool/move-app/move.zsh --try-chooser` asks the same questions, but the folder window needs the built app, which the repo does not have: only y answers work there, and c says the window could not be shown. It takes neither `--commit` nor `--print`.

### 6. The report

- Writes `~/Desktop/Studio move report.txt` and shows it in Finder.
- One heading a check (41, 42, 43, 44, 48), one line for each box the By-Hand page has, labelled as the page labels it.
- It holds no email, no organisation, no key and no file name from her drop folder.
- Jason AirDrops it to the Mac Studio. Claude reads it there and fills in the page's boxes.

### 7. brimm-video's old key (check 48)

- On a Mac set up fresh, nothing is asked: brimm-video's old key, if there is one, is left as it is.
- Asked only once the installer has finished at the app's commit.
- It asks whether brimm-video's key has been deleted on GitHub (jogden12/brimm-video, Settings, Deploy keys). On y it deletes `~/.ssh/brimm_video_deploy` and its `.pub`, and nothing else in `~/.ssh`.
- A no keeps the key and does not stop the run. Double-click the app again to be asked once more.
- The report is written again with this answer.

The last line of a finished run is: `Done. Next on the By-Hand page: checks 45 to 47, on screen.` On Jason's MacBook it is: `Done. Next on the By-Hand page: the rest of the check for Jason's MacBook.`

## What stays by hand

- **GitHub's deploy key settings.** Adding Studio's public half to jogden12/brimm-video-studio, read-only (Write access off), and later deleting brimm-video's key. The app never touches GitHub and never reads the key's private half.
- **The HyperFrames app and its HeyGen sign-in** (check 43).
- **Her own Claude sign-in.** If it is needed, the app starts it, and she signs in in the browser.
- **macOS's own questions**, and her password wherever macOS asks for it.
- **Finder's "Make available offline".** Dropbox has no command for it.
- **Checks 45 to 47.** Her folder's lock in the Code tab, a first video, and BRIMM Ops.
- **Homebrew, Xcode's tools and a newer node.** The app does not install these. It stops and says what to run.

## Building the app

The build runs on the Mac Studio, from a checkout of main, when Jason says yes on the By-Hand page. Claude runs it.

```
zsh tool/move-app/build-app.sh --out <folder> --sign
```

- `--out <folder>` is required. The build writes `Move to Studio.app` and `Move to Studio.zip` there, replacing only those two from an earlier build. Beyond that it writes only a temporary folder, which it takes away.
- The app holds a helper app, `Contents/Helpers/Choose a Folder.app` (identifier `com.thebrimm.move-to-studio.choose-folder`), built from `choose-folder.swift`. With `--sign` the helper is signed first, with the hardened runtime and a secure timestamp, and checked with `codesign --verify --strict`; then the app is signed over it. Without `--sign` the helper gets its own ad-hoc seal first, then the app.
- The zip is made with `ditto -c -k --norsrc --noextattr --keepParent`, so it holds no `._` entries and no extended attributes.
- `--sign` signs the app with the one "Developer ID Application" identity in the keychain, found by name. It uses the hardened runtime and a secure timestamp. This copy is the one that goes to Sallie.
- Without `--sign`, the copy is not signed with the Developer ID. The build still seals the whole bundle with an ad-hoc signature (`codesign --force --sign - --timestamp=none`, then `--verify`), which is local and sends nothing, so that another Mac says "rejected" (the Open Anyway path below) and not "damaged". From AirDrop, macOS asks once; from a USB stick it asks nothing. Use `--sign` for the copy that goes to Sallie.
- `--any-commit` builds at a commit that is not yet on origin/main. Without it, the build refuses (run `git fetch` first, so it sees what GitHub has), so what Sallie gets is what was merged. Use it for a trial only.
- The build also refuses if the app's files in `tool/move-app` have changes that are not committed.
- The commit is written into the app. A new commit on main means building the app again.
- The build ends by printing what it made, the commit, and (when signed) the three notarizing commands.
- Signing needs exactly one Developer ID Application identity. With none, or with two, the build says how many it found and stops.

### Signing, once, by hand

Done once on the Mac Studio, from the By-Hand page. Jason types his own passwords: never into chat, and never into a file.

1. **The certificate.** In Keychain Access, Certificate Assistant, Request a Certificate From a Certificate Authority, saved to disk. On developer.apple.com, Certificates, then +, then Developer ID Application, with that request. Download it and double-click it. Claude then checks that `security find-identity -v -p codesigning` shows it. Done on 6 November, with three things learned on the way:
   - Open Apps, type keychain, and choose Keychain Access, not Passwords. On this macOS it isn't in Applications › Utilities, and opening it by its path opens Passwords.
   - Click login in Keychain Access before importing. With iCloud selected, the import fails with "Error: -25294", and Keychain Access hung.
   - A Mac with only the Command Line Tools, and no Xcode, lacks Apple's Developer ID G2 intermediate certificate, so `find-identity` shows the identity but 0 valid. Download DeveloperIDG2CA.cer from apple.com/certificateauthority and import it into login too.
2. **The notary login.** An app-specific password made at account.apple.com, then `xcrun notarytool store-credentials "BRIMM notary"` in Terminal, answering its own questions. The keychain keeps it under that name. Nothing secret is in any file.

### Notarizing, by hand

Notarizing sends the app to Apple, which scans it and returns a ticket. That sends a file out of the Mac, so it is a by-hand step on Jason's yes. No script here does it. The build only prints the three commands:

```
xcrun notarytool submit "<folder>/Move to Studio.zip" --keychain-profile "BRIMM notary" --wait
xcrun stapler staple "<folder>/Move to Studio.app"
ditto -c -k --norsrc --noextattr --keepParent "<folder>/Move to Studio.app" "<folder>/Move to Studio.zip"
```

The last command makes the zip again, with the ticket stapled in, and with the same flags as the build.

## Carrying it to her laptop

- AirDrop `Move to Studio.zip` from the Mac Studio to her laptop, or copy it on a USB stick.
- Open the zip, and double-click the app.
- A signed and notarized copy from AirDrop opens with one macOS question: "'Move to Studio' is an app downloaded from the Internet. Are you sure you want to open it?" Click Open.
- A copy that is not signed with the Developer ID, from AirDrop, is blocked the first time. Since macOS 15, Control-click then Open no longer gets past it. Click Done, then System Settings, Privacy & Security, Open Anyway (shown for about an hour after the blocked try), her password, Open.
- A copy from a USB stick has no quarantine mark and opens with no question.
- Terminal may ask "Terminal would like to access...". Click Allow.

## Stopping and running again

- An n, a failure, Control-C or closing the Terminal window stops it. It then lists what this run changed (or says it changed nothing), and says: `Double-click Move to Studio again to go on from here.` After a closed window there is no window to show that in, so it is only in the log (below).
- A run stopped in the middle of a clone takes the half-made copy away.
- A run stopped after the installer started also says where the drop folder is now. If the run never saw the background job's line, it says: `Move to Studio has not finished, so a video dropped now may not be imported. Drop no video until it has finished: double-click it again now.` If it did, and the drop folder changed, it says: `This Mac's drop folder is now <folder>.` and, on a Mac moved from brimm-video, `Videos put in Drop › <Mac> in Dropbox are no longer imported.`
- A try of the folder questions stops with its own line, never the advice to double-click: `This was a try of the folder questions: nothing was changed. To try again: open "<the app>" --args --try-chooser`.
- It undoes nothing and deletes nothing, except its own half-made clone and, in step 7, brimm-video's old key on her y.
- A failed install is shown and stopped, never undone. A second run goes on. Going back to brimm-video is Jason's call, by hand, with brimm-video's installer, which stays on disk.

### The log and the report

- Everything the app says is also kept in `~/Library/Logs/brimm-video-studio-move.log`, a run at a time, each with a dated line. Each question is followed in the log by the answer given to it (a y, an n or a Return, never a secret). The lock that keeps a second run out is the file beside it, `brimm-video-studio-move.log.lock`.
- The report is `~/Desktop/Studio move report.txt`. The public half of the key is `~/Desktop/Studio key (public half).txt`.

### Where it stops, and what to do

Each of these stops the run, says what this run changed, and goes on from there at the next double-click. The words in quotes are the app's own. A `$` word or a name in angle brackets stands for what the app fills in.

An n (or Return alone, or a line that is not y) at any question also stops the run. So does anything but Return at a "Press Return when that's done" wait.

Step 1, looking:

- **"In Terminal, run: xcode-select --install, then run the app again."** Do that.
- **Homebrew is not here.** "In Terminal, run this (it asks for the password of this Mac, which its owner types)", then Homebrew's install command. Run it, then run the app again.
- **"Node is not on this Mac, and Studio needs 22 or later. Run: brew install node, then run the app again."** Do that.
- **"Node here is <version>, and Studio needs 22 or later. Run: brew upgrade node, then run the app again."** Do that.
- **"This Mac's settings are not as the switch of 26 October left them"**, naming the import (should be "light"), the drop folder (should be "Drop"), the hand-off version (should be "2"), or the checkout (should be brimm-video's or Studio's). Tell Jason.
- **"This app is for Sallie's laptop and Jason's MacBook, and this Mac's settings say it is "<machine>". Nothing was changed."** The app refuses at once, before any question (exit 2). Tell Jason.
- **"This Mac has no BRIMM Video folder in Dropbox (The BRIMM DB › BRIMM Video). Sign in to Dropbox, let The BRIMM DB sync, then run the app again."** Only on a Mac with no brimm-video settings, which is set up fresh as Jason's MacBook. Do that.
- **"This Mac has <n> BRIMM Video folders in Dropbox: <path 1>, <path 2>. Tell Jason which one is The BRIMM's."** Same Mac. Two paths that are the same folder (`~/Dropbox` is often a link to the CloudStorage folder) count once, and so does a folder found both at the top of a Dropbox and a level deeper. Tell Jason.
- **"An import is running now. Wait until its window in the top right closes, then double-click Move to Studio again."** Do that.
- **"This Mac's checkout (<folder>) has no tool/settings.js to say where its drop folder is."** Tell Jason.
- **"The drop folder could not be found from this Mac's settings (settings.js show)."** Tell Jason.
- **"The drop folder holds <n> file still to be imported."** (or "<n> files") The app never names them. Let the import finish, then run the app again. Step 5 looks at this again right before the real install and stops with the same words.
- **"The drop folder could not be read. macOS may have asked whether Terminal may read it, and the answer may have been no. Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again."** Do that.
- **"Move to Studio is already running in another Terminal window. Use that one, or close it and double-click again."** Do that.
- **"Claude Code is not on this Mac. Install it, then run the app again."** Do that.
- **"Claude Code is still not signed in."** after the offered sign-in. Run `claude auth login` in Terminal, then run the app again.

Step 2, the key:

- **"There is a file <key> but no <key>.pub beside it, and this app does not touch it."** Tell Jason.
- **"There is a file <key>.pub but no <key>, and this app does not touch it."** Tell Jason.
- **"There is already a key at <key> with another comment ("<comment>"), so it is not Studio's. This app does not touch it."** Tell Jason.
- **"The key could not be made."** Tell Jason.
- **"~/.ssh/config already has a "Host github-brimm-video-studio" entry that is not the one Studio needs. This app does not change it."** Tell Jason.
- **"GitHub's key on this Mac isn't the one GitHub publishes (<fingerprint>). Nothing is trusted until that is looked into: tell Jason."** Tell Jason.
- **"ssh did not get GitHub's welcome for this key. It said:"** and all of ssh's lines (a host-key warning comes before the rest). Tell Jason. (A "Permission denied" is not a stop: the app says GitHub does not know the key yet and waits again.)

- **"The Desktop could not be written to. macOS may have asked whether Terminal may write there…"** (this can come in step 2 or step 6). Allow Terminal in System Settings › Privacy & Security › Files and Folders, then run the app again.

Step 3, the code:

- **"<folder> is there, but it isn't a copy of Studio's code (it has no origin). This app does not touch it."** Tell Jason.
- **"<folder> is there, but it comes from <origin>, not from Studio's repository (<url>). This app does not touch it."** Tell Jason.
- **"<folder> has changes that aren't saved. This app does not touch it; tell Jason."** Tell Jason.
- **"<folder> isn't on main (it is on <branch>)."** Or "it is not on any branch". The app does not touch it. Tell Jason.
- **"<folder> is at <commit>, and this app was made at <commit>. This app does not move it; tell Jason."** Tell Jason: the app may need building again.
- **"Studio's code could not be copied from GitHub (the lines above say why)."** The half-made copy is taken away. Run the app again, or tell Jason if it happens again.
- **"GitHub's main doesn't hold the commit this app was made at (<commit>). Tell Jason."** The app needs building again.
- **"Studio's code could not be put at the app's commit (<commit>)."** The half-made copy is taken away. Tell Jason.
- **"Studio's tests did not pass at <commit>. Tell Jason; the lines above, from ℹ tests on, say how many failed."** Tell Jason.

Step 5, the folder questions (a refused pick is asked again and is not a stop; the first two items below are stops, the rest are what the app says or asks on the way):

- **"The window to choose a folder could not be shown, and <folder> is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again."** Only when neither way of showing the window worked and the folder y gives was refused for not being empty. Do that.
- **"The window to choose a folder could not be shown, and <folder> can't be used: <reason>. Tell Jason, then double-click Move to Studio again."** The same, for another reason (the transcript tool watches it, it is one of Studio's own folders, and so on). Tell Jason. In a try, this stop and the "is not empty" one end after "Tell Jason" or "tell Jason" with no advice to double-click.
- **The privacy questions.** Not stops. The app says that macOS may ask whether Claude Code may access Downloads, whether node may, and whether either may read the drop folder or the exports folder. Choose Allow each time. A Don't Allow is undone in System Settings › Privacy & Security › Files and Folders. Until node is allowed, Studio sees no video dropped there.
- **"macOS did not let Terminal look in <folder>. Allow Terminal in System Settings › Privacy & Security › Files and Folders, or choose another folder."** A refused pick, asked again. Allow it, or choose another.
- **The cloud question**, after the print, for a drop folder in a cloud folder: y uses it anyway, c chooses another, anything else stops with no change.
- **After the installer started:** the stop summary says what the drop folder is now, or that Move to Studio has not finished and no video should be dropped until it has (the words are under "Stopping and running again").
- **At the end of a finished run on a Mac moved from brimm-video**, the old drop folder is counted once, never named, and one of these is said: `The old drop folder, Drop › <Mac> in Dropbox, is empty and no longer watched. Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar.` or that it holds <n> files or folders that nothing imports now, to drag each into the new drop folder with a plain drag, or that it could not be read. None of these stops the run.

Step 5, the installer (step 4 only waits, and stops on an n):

- **"<folder>/tool/install.sh is not there."** Tell Jason.
- **"Studio's installer refused (its words are above), so it was not run for real. Nothing it refused has been changed."** Deal with what its words say, then run the app again. (A video in the drop folder is not one of its reasons: the installer looks at that only when it switches the folder, which is why the app looks itself, right before the real install.)
- **"Claude Code is not signed in. In Terminal, run: claude auth login (sign in to this Mac's own Claude account in the browser), then run the app again."** Do that.
- **"Claude Code is still older than the installer needs after claude update. Tell Jason."** Tell Jason.
- **"The Claude app's own Claude Code is still older than the installer wants. Tell Jason."** after Check for Updates. Tell Jason.
- **"The installer stopped (it ended with <n>). Its last lines:"** and the lines. Tell Jason. Running the app again goes on from there.
- **"The installer's check of Claude did not get an answer. It said:"** and the background job's line. Tell Jason.
- **"The setup stopped before its check of Claude (there is no "From the background job:" line in what it said)."** and its last lines. Tell Jason.
- **"The one-shot check of Claude (<file>) is still there. Left there, launchd would run it at every login. Tell Jason."** Tell Jason.
- **"<folder>/tool/settings.js is not there, so the editing app cannot be looked at."** Tell Jason.
- **"HyperFrames could not be turned on. It said: <what settings.js said>"** Tell Jason.

## What reaches out

- The ad-hoc seal of an unsigned build (`codesign --sign - --timestamp=none`) is local and sends nothing.
- `codesign --timestamp` asks Apple's timestamp server for the time. That is all it sends. Signing for notarization needs it.
- Notarizing sends the app to Apple. It is by hand, not in any script.
- In the move script, only these reach out: the clone from GitHub, `ssh -T` to GitHub, `claude auth login` (it opens the browser, for her to sign in), `claude update` (it fetches Claude Code's newer version), opening the HyperFrames page in Safari, and what Studio's own installer does (Homebrew, npm, the HyperFrames command line and its Chrome, the model).
- The app never touches brimm-video's checkout, GitHub's settings, the Mac Studio, or Dropbox, except through the installer and the reads above.

## The tests

```
cd tool && node --test tests/move-app-*.test.js
cd tool && node --test
```

- The move script runs in a home made for each test, with stand-ins for every program that could change something or reach out. A stand-in installer only notes how it was called, and a stand-in chooser answers with a pick, a Cancel or a failure.
- The move script's tests are split into files that `node --test` runs side by side, so that step 3 stays short, and share one harness, `move-app-harness.js` (not a test file): `move-app-looking`, `-key-code`, `-installer` (steps 1 to 5 and the report), `-step5-questions`, `-step5-checks`, `-step5-print` (the two folder questions, the app's checks of a pick, the installer's print), `-marks-summary` and `-later-runs` (later runs, the marks, the stop summary), and the try mode (in `-looking`). `move-app-build.test.js` covers the build, the helper app and the zip.
- `move-app-ties.test.js` (with `move-app-ties-helpers.js`) ties the app to Studio's real code: the words it reads from `settings.js` and from `install.sh --print`, and the keys typed while the window is open, on a real terminal. A change to either side that the other does not follow fails there.
- No test makes a real key, clones from GitHub, runs the real installer, signs or notarizes.
- Tests that need a Mac skip themselves elsewhere.
- Trying it on the Mac Studio: `zsh tool/move-app/move.zsh --commit <40 characters> --print` looks, says what it would do in order, and changes nothing: no log, no report, no key, no clone, no question, and no folder window. It says it would ask where videos are dropped and where HyperFrames' exports go, runs the app's own checks of the folders a y would give, and shows the installer's print with them. Run it in a temporary home, never against the live checkout.
