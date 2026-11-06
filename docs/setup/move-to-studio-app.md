# The Move to Studio app

For Jason, who runs the move with Sallie. This is a small Mac app that moves her laptop from brimm-video to Studio. It does the Terminal work of checks 41, 42 and 44 on the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT) and part of check 43 and check 48. Checks 45 to 47 stay on screen, by hand.

The app, its build and the notarizing are all run from that page, each on Jason's yes. Nothing is installed on any Mac by building the app.

## What it is

- "Move to Studio", an app for her laptop alone. It stops at once on any Mac whose brimm-video settings do not say "Sallie's laptop".
- Double-clicked, it opens one Terminal window and walks through the move there, one step at a time.
- Nothing is typed but y or n.
- Before each change it says what will change, then asks: `Go ahead? Type y and press Return, or n to stop: `
- `y` and `yes` go ahead, in any case. Return alone is no. So is anything else.
- Each step looks first and does only what is not done yet. A second run says "Already done" for what is done and goes on.
- It keeps the Mac awake while it runs. Keep the lid open and the charger in.

The code is in `tool/move-app/`:

- `move.zsh`: the steps.
- `open-in-terminal.zsh` and `launcher.swift`: how the app hands the steps to Terminal.
- `build-app.sh`: makes, signs and zips the app.

## What it does, in order

### 1. Looking at this Mac (check 41). This changes nothing.

It shows:

- her macOS, and her free disk (under 100 GB is said, and does not stop the move);
- Xcode's command line tools, Homebrew and node (22 or later);
- brimm-video's settings: the light import, hand-off version 2, the drop folder `Drop`, and a checkout that is brimm-video's or Studio's;
- that no import is running;
- that her drop folder is empty. The drop folder is the one brimm-video's `settings.js show` names. Files are counted and never named;
- Claude Code in Terminal: signed in or not, its plan and its version. Never her email.

If Claude Code is not signed in, it asks first, then runs `claude auth login`. That opens the browser, where Sallie signs in to her own Claude account.

### 2. Studio's key (check 42)

- Makes a read-only key, `~/.ssh/brimm_video_studio_deploy`, and shows its public half. The public half is copied, and kept on her Desktop as `Studio key (public half).txt`.
- Adds a Host entry for `github-brimm-video-studio` to `~/.ssh/config`, after what is there. The rest of the file stays byte for byte.
- Adds GitHub's published host key to `~/.ssh/known_hosts`, after showing its fingerprint (`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`). ssh trusts no other host.
- Waits while the public half goes on GitHub (by hand, below). Press Return, and it checks with `ssh -T`. If GitHub says `Permission denied`, it says GitHub does not know the key yet, and waits again.
- A key from an earlier run is kept. A key at that name with another comment is never touched.

### 3. Studio's code (check 42)

- Clones Studio into `~/Claude Code/brimm-video-studio.partial`, puts main at the commit the app was made at, and only then renames the folder. A clone cut short never blocks the next run: the next run takes the half-made folder away and clones again.
- If the folder is already there, it must be Studio's own clone, clean, on main, at the app's commit. Anything else stops the app, and it touches nothing.
- Runs Studio's own tests (about three minutes, changing nothing). A pass is marked in `.git/move-to-studio`, so a later run does not run them again at the same commit. One failing test stops the app.

### 4. The HyperFrames app (check 43)

- If `/Applications/HyperFrames.app` is there, it notes the version.
- If not, it opens https://hyperframes.dev/studio in Safari and waits while the app is downloaded, dragged into Applications and opened once.
- The HeyGen sign-in and the agent on Auto stay by hand, as check 43 says.

### 5. Studio's installer (check 44)

- Runs `install.sh --print` with `--machine "Sallie's laptop" --drop Drop --import light --handoff 2` and her BRIMM Video folder (read from her settings). It shows all of it.
- If the print refuses, the app shows its words and stops. It never runs the installer with `--yes` then.
- If Claude Code in Terminal is older than the installer wants, it asks, runs `claude update`, and prints again.
- If the Claude app's own Claude Code is older, it says to choose Claude, then Check for Updates, and prints again when Return is pressed.
- Repeats the lines that matter: Claude Code's sign-in and versions, HDR video, her folder's lock.
- Asks once. On y it runs the same line for real with `--yes`. This can take a few minutes, and ends with one real call to Claude from the background job (up to 90 seconds).
- Then it checks for the line `From the background job:` and that the one-shot check agent (`com.thebrimm.claude-check.plist`) is gone.
- Asks, then turns HyperFrames on as the editing app (`settings.js set --app hyperframes`).
- Shows her drop folder in Finder and waits while she does "Make available offline" there.

### 6. The report

- Writes `~/Desktop/Studio move report.txt` and shows it in Finder.
- One heading a check (41, 42, 43, 44, 48), one line for each box the By-Hand page has, labelled as the page labels it.
- It holds no email, no organisation, no key and no file name from her drop folder.
- Jason AirDrops it to the Mac Studio. Claude reads it there and fills in the page's boxes.

### 7. brimm-video's old key (check 48)

- Asked only once the installer has finished at the app's commit.
- It asks whether brimm-video's key has been deleted on GitHub (jogden12/brimm-video, Settings, Deploy keys). On y it deletes `~/.ssh/brimm_video_deploy` and its `.pub`, and nothing else in `~/.ssh`.
- A no keeps the key and does not stop the run. Double-click the app again to be asked once more.
- The report is written again with this answer.

The last line of a finished run is: `Done. Next on the By-Hand page: checks 45 to 47, on screen.`

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
- `--sign` signs the app with the one "Developer ID Application" identity in the keychain, found by name. It uses the hardened runtime and a secure timestamp. This copy is the one that goes to Sallie.
- Without `--sign`, the copy is unsigned and opens on this Mac only. That is for a trial.
- `--any-commit` builds at a commit that is not yet on origin/main. Without it, the build refuses, so what Sallie gets is what was merged. Use it for a trial only.
- The build also refuses if the app's files in `tool/move-app` have changes that are not committed.
- The commit is written into the app. A new commit on main means building the app again.
- The build ends by printing what it made, the commit, and (when signed) the three notarizing commands.
- Signing needs exactly one Developer ID Application identity. With none, or with two, the build says how many it found and stops.

### Signing, once, by hand

Done once on the Mac Studio, from the By-Hand page. Jason types his own passwords: never into chat, and never into a file.

1. **The certificate.** In Keychain Access, Certificate Assistant, Request a Certificate From a Certificate Authority, saved to disk. On developer.apple.com, Certificates, then +, then Developer ID Application, with that request. Download it and double-click it. Claude then checks that `security find-identity -v -p codesigning` shows it.
2. **The notary login.** An app-specific password made at account.apple.com, then `xcrun notarytool store-credentials "BRIMM notary"` in Terminal, answering its own questions. The keychain keeps it under that name. Nothing secret is in any file.

### Notarizing, by hand

Notarizing sends the app to Apple, which scans it and returns a ticket. That sends a file out of the Mac, so it is a by-hand step on Jason's yes. No script here does it. The build only prints the three commands:

```
xcrun notarytool submit "<folder>/Move to Studio.zip" --keychain-profile "BRIMM notary" --wait
xcrun stapler staple "<folder>/Move to Studio.app"
ditto -c -k --keepParent "<folder>/Move to Studio.app" "<folder>/Move to Studio.zip"
```

The last command makes the zip again, with the ticket stapled in.

## Carrying it to her laptop

- AirDrop `Move to Studio.zip` from the Mac Studio to her laptop, or copy it on a USB stick.
- Open the zip, and double-click the app.
- A signed and notarized copy from AirDrop opens with one macOS question: "'Move to Studio' is an app downloaded from the Internet. Are you sure you want to open it?" Click Open.
- An unsigned copy from AirDrop is blocked the first time. Since macOS 15, Control-click then Open no longer gets past it. Click Done, then System Settings, Privacy & Security, Open Anyway (shown for about an hour after the blocked try), her password, Open.
- A copy from a USB stick has no quarantine mark and opens with no question.
- Terminal may ask "Terminal would like to access...". Click Allow.

## Stopping and running again

- An n, a failure, Control-C or closing the window stops it. It then lists what this run changed (or says it changed nothing), and says: `Double-click Move to Studio again to go on from here.`
- A run stopped in the middle of a clone takes the half-made copy away.
- It undoes nothing and deletes nothing, except its own half-made clone and, in step 7, brimm-video's old key on her y.
- A failed install is shown and stopped, never undone. A second run goes on. Going back to brimm-video is Jason's call, by hand, with brimm-video's installer, which stays on disk.

### The log and the report

- Everything the app says is also kept in `~/Library/Logs/brimm-video-studio-move.log`, a run at a time, each with a dated line.
- The report is `~/Desktop/Studio move report.txt`. The public half of the key is `~/Desktop/Studio key (public half).txt`.

### Where it stops, and what to do

Each of these stops the run before it changes anything more.

- **Not set up as the switch left it.** The import is not "light", the drop folder is not "Drop", the hand-off version is not "2", or the checkout is neither brimm-video's nor Studio's. Tell Jason.
- **Xcode's tools are not here.** Run `xcode-select --install`, then run the app again.
- **Homebrew is not here.** Sallie runs Homebrew's install command from the app's message, and types her own password. Then run the app again.
- **Node is missing or older than 22.** Run `brew install node` (or `brew upgrade node`), then run the app again.
- **An import is running.** Wait until its window in the top right closes, then run the app again.
- **Her drop folder holds files still to be imported.** The app says how many, and never names them. Let the import finish, then run the app again.
- **Claude Code is not on this Mac.** Install it, then run the app again.
- **Claude Code is still not signed in** after the offered sign-in. Run `claude auth login` in Terminal, then run the app again.
- **A key exists at Studio's key place with another comment, or only one of its two files is there.** The app does not touch it. Tell Jason.
- **`~/.ssh/config` already has a `Host github-brimm-video-studio` entry that is not Studio's.** The app does not change it. Tell Jason.
- **GitHub's key on this Mac is not the one GitHub publishes.** Nothing is trusted. Tell Jason.
- **`ssh` did not get GitHub's welcome, and did not say "Permission denied".** The app shows what ssh said. Tell Jason.
- **Studio's code could not be copied.** The lines above say why. A half-made copy is taken away. Run the app again.
- **GitHub's main does not hold the commit the app was made at.** Tell Jason: the app needs building again.
- **The folder at Studio's place is not a clean copy of Studio on main at the app's commit.** The app does not touch it. Tell Jason.
- **Studio's tests did not pass.** The lines from `ℹ tests` on say how many failed. Tell Jason.
- **The installer's print refused** (a video in her drop folder, for one). Its words are shown. Nothing was run for real. Deal with what it says, then run the app again.
- **Claude Code is not signed in**, as the installer's print sees it. Run `claude auth login`, then run the app again.
- **Claude Code is still older than the installer needs** after `claude update`, or the Claude app's own copy is still older after Check for Updates. Tell Jason.
- **The installer stopped.** Its last lines are shown. Tell Jason. Running the app again goes on from there.
- **The setup stopped before its check of Claude** (no `From the background job:` line), or **the one-shot check agent is still there**. Tell Jason. The agent file would run at every login if left.
- **HyperFrames could not be turned on.** The app shows what `settings.js` said. Tell Jason.

## What reaches out

- `codesign --timestamp` asks Apple's timestamp server for the time. That is all it sends. Signing for notarization needs it.
- Notarizing sends the app to Apple. It is by hand, not in any script.
- In the move script, only these reach out: the clone from GitHub, `ssh -T` to GitHub, opening the HyperFrames page in Safari, and what Studio's own installer does (Homebrew, npm, the HyperFrames command line and its Chrome, the model).
- The app never touches brimm-video's checkout, GitHub's settings, the Mac Studio, or Dropbox, except through the installer and the reads above.

## The tests

```
cd tool && node --test tests/move-app.test.js
cd tool && node --test tests/move-app-build.test.js
cd tool && node --test
```

- The move script runs in a home made for each test, with stand-ins for every program that could change something or reach out. A stand-in installer only notes how it was called.
- No test makes a real key, clones from GitHub, runs the real installer, signs or notarizes.
- Tests that need a Mac skip themselves elsewhere.
- Trying it on the Mac Studio: `zsh tool/move-app/move.zsh --commit <40 characters> --print` looks, says what it would do in order, and changes nothing: no log, no report, no key, no clone, no question. Run it in a temporary home, never against the live checkout.
