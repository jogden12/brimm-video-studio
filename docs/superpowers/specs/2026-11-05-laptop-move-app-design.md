# Moving Sallie's laptop to Studio with one app (design)

5 November 2026. A draft for Jason's approval: nothing is built until he approves it. Branch `claude/studio-laptop-move-app`, from main fd5cd77.

**Changed on 6 November: both MacBooks.** The app now also sets up Jason's MacBook, moved from brimm-video or set up fresh. See "Both MacBooks", below. Where this document says "her laptop", it means either MacBook, unless that section says otherwise.

## Why

Moving her laptop from brimm-video to Studio is checks 41 to 48 on the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT, group "laptop"). On her laptop Jason pastes about thirty Terminal commands, one at a time, and copies what each prints into the page. The app takes the pasting away: Jason double-clicks it on her laptop, reads what it says, and answers y or n.

It works when the move takes one double-click and a handful of y's, nothing on her laptop changes without a y, and anything unexpected stops it with a plain sentence saying what; a second double-click then goes on from where it stopped.

## What it is

"Move to Studio", a small Mac app for her laptop alone. Double-clicked, it opens one Terminal window and walks through the move there, a step at a time. Nothing is typed or pasted but y or n. Claude makes it on the Mac Studio with a build script in the repo, from main, and Jason carries it to her laptop by AirDrop or a USB stick. It stops at once on any Mac whose settings are not Sallie's laptop's.

## What it does, in order

Each step looks first, and does only what is not done yet.

1. **Looks (check 41). Changes nothing.** Her macOS; free disk; brimm-video's settings (Sallie's laptop, the light import, Drop, hand-off version 2); that no import is running; that her drop folder holds no video, as a count and never by name, with the folder named by her own brimm-video (`settings.js show`); Homebrew, Xcode's tools and node; whether Terminal's `claude` is signed in, its plan and its version, never its email. Anything unexpected stops it.
2. **Studio's key (check 42).** Makes the read-only key `~/.ssh/brimm_video_studio_deploy` and shows its public half, copied to the clipboard and saved on the Desktop as a small text file to AirDrop. Jason puts it on GitHub (below) and presses Return. The app adds the Host entry to `~/.ssh/config` and checks the key with `ssh -T` against GitHub's published host key (fingerprint `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`), never accepting a host key it has not checked. A key there from an earlier run is kept, never overwritten.
3. **Studio's code (check 42).** Clones Studio to `~/Claude Code/brimm-video-studio`, on main, at the commit the app was made from, which is the Mac Studio's. So the app and the installer it runs come from the same commit. Then it runs Studio's tests (about three minutes) and stops if any fails.
4. **The HyperFrames app (check 43).** If it is not in Applications, it opens hyperframes.dev/studio in Safari and waits while Jason installs it and signs in as check 43 says. Then it notes the app's version.
5. **Studio's installer (check 44).** Runs the new checkout's `install.sh --print` with today's options (`--machine "Sallie's laptop" --drop Drop --import light --handoff 2` and her BRIMM Video folder, read from her settings), shows all of it, repeats the lines that matter (Claude Code's two versions, its sign-in, HDR, her folder's lock), and asks once. On y it runs the same line for real with `--yes`, as check 40 did on the Mac Studio. Then it checks for the line "From the background job:" and that the one-shot check agent is gone, turns HyperFrames on for her laptop (`settings.js set --app hyperframes`, asked first), and opens her drop folder in Finder for "Make available offline".
6. **The report.** What it found and did, in the page's order, on her Desktop. Jason AirDrops it to the Mac Studio, where Claude reads it and fills in the page's boxes. It holds no secret and no video's name.
7. **Afterwards (check 48), on a later run.** Once the move is done, another double-click offers one more step, asked on its own: delete brimm-video's old key from her `~/.ssh`, once Jason has deleted it on GitHub.

Checks 45 to 47 (her folder's lock in the Code tab, a first video, BRIMM Ops) stay on the page as they are: they are done on screen.

## What stays Jason's, and Sallie's

- **The deploy key on GitHub.** Adding Studio's public half to jogden12/brimm-video-studio, read-only, on github.com or by giving it to Claude on the Mac Studio as check 42 offers; later, deleting brimm-video's. The app never touches GitHub's settings and never reads or shows the key's private half.
- **HyperFrames.** Its download, its install, the HeyGen sign-in, the agent on Auto (check 43).
- **Her Claude sign-in.** If `claude` is not signed in, the app offers to start `claude auth login`, which opens the browser, where she signs in herself. The Claude app's own sign-in, and its own Claude Code (Claude › Check for Updates), are hers too.
- **macOS's own questions.** Gatekeeper's Open Anyway (below), "Terminal would like to access…" (Allow), and her password wherever macOS asks for it.
- **Anything missing that needs her password or a big install.** Homebrew, Xcode's tools or a newer node: the app stops and says what to run. It offers `claude update` alone, asked first, when Terminal's Claude Code is older than her folder's guard needs.
- **Finder's "Make available offline".** Dropbox has no command for it.
- **Her two answers on the page** (her HeyGen account; "Help improve Claude" off): typed into the page, as now.

## How it asks

- Before each change it says what will change, with the file or the command, then: "Go ahead? Type y and press Return, or n to stop." Return alone is no. One y is one change.
- The installer is one step: its whole print first, then one question.
- The move script takes `--print`: every step looks and says what it would do, and nothing changes. This is how it is tried on the Mac Studio. The app itself has no switch: it always looks first and asks before each change.

## How it stops, and runs again

- n, a failure, Ctrl-C or closing the window stops it. It then lists what this run changed and says that a new double-click goes on from there.
- Every step looks before it acts, so a second run says "already done" for what is done and goes on. The installer is safe to run again, as it says itself.
- The clone is made in a temporary folder beside its place and renamed once whole, so a clone cut short never blocks the next run.
- It undoes nothing and deletes nothing, but its own half-made clone and, in step 7, asked on its own, brimm-video's old key.
- It keeps the Mac awake while it runs (`caffeinate`). Keep the lid open and the charger in.
- It never touches brimm-video's checkout, GitHub, the Mac Studio, or Dropbox, but through the installer and the reads above.
- Every command it ran, and what each printed, go in `~/Library/Logs/brimm-video-studio-move.log`.

## How it is packaged

An app bundle, made by a build script in the repo and zipped for AirDrop. Its program is a small native launcher (an AppleScript applet or a few lines of Swift: the builder's call), since code signing and Apple's notary service expect a native program, not a script. The launcher has Terminal run the zsh move script inside the bundle, with no macOS question beyond Gatekeeper's one; a `.command` file it writes into a fresh temporary folder and opens is one way.

Not a `.pkg`. Installer runs its scripts as root, and Homebrew, her user's launch agents and her `~/.ssh` all need her user. It cannot show the installer's print and ask between steps. And it asks for her password though nothing needs it.

**Signed and notarized** (Jason has a paid Apple Developer membership, 5 November). The build signs the app with his Developer ID Application certificate, with the hardened runtime and a secure timestamp. Notarizing sends the app to Apple, which scans it and returns a ticket that is stapled to the app. That sends a file out of the Mac, so it is not in the repo's scripts: it is a by-hand step on the page, two commands Claude runs on Jason's yes. Her Mac then opens the app with one question: "'Move to Studio' is an app downloaded from the Internet. Are you sure you want to open it?" Open.

**Once, by hand, on the Mac Studio** (on the page; Jason types his own passwords, never into chat or a file):

1. The certificate. Today the Mac Studio has none (`security find-identity -v -p codesigning` finds 0). In Keychain Access, Certificate Assistant › Request a Certificate From a Certificate Authority, saved to disk; on developer.apple.com, Certificates › + › Developer ID Application, with that request; download it and double-click it. Claude then checks that `security find-identity` shows it. Done on 6 November, with three things learned on the way:
   - Open Apps, type keychain, and choose Keychain Access, not Passwords. On this macOS it isn't in Applications › Utilities, and opening it by its path opens Passwords.
   - Click login in Keychain Access before importing. With iCloud selected, the import fails with "Error: -25294", and Keychain Access hung.
   - A Mac with only the Command Line Tools, and no Xcode, lacks Apple's Developer ID G2 intermediate certificate, so `find-identity` shows the identity but 0 valid. Download DeveloperIDG2CA.cer from apple.com/certificateauthority and import it into login too.
2. The notary login. An app-specific password made at account.apple.com, then `xcrun notarytool store-credentials "BRIMM notary"` in Terminal, answering its own questions. The keychain keeps it under that name, and the notarizing step names only that.

**Unsigned**, for the tests and the trial, and as a fallback, the build script makes one when told to. From AirDrop, macOS blocks an unsigned app the first time ("Apple could not verify…"). Since macOS 15, Control-click › Open no longer gets past it: Done, then System Settings › Privacy & Security, Open Anyway (shown for about an hour after the blocked try), her password, Open. A copy from a USB stick has no quarantine mark and opens with no question. The trial on the Mac Studio (macOS 27.0.1) reads Gatekeeper's verdict on a marked copy with `spctl`, which opens nothing.

## Both MacBooks (6 November)

Jason, 6 November: "the app should be able to be installed on any computer; in reality, it will just be her Macbook and my Macbook. I just want to be sure that it's not specific to her laptop in a way that prevents installation on my laptop". His answers the same day:
- His MacBook is a standby, set up like hers, named Jason's MacBook. That was already the plan of 21 and 22 October: its own drop folder, with the import.
- He isn't sure brimm-video is on it, so the app handles both cases.

**Which Mac it is, from its settings, before anything changes:**
- Settings naming Sallie's laptop or Jason's MacBook: moved from brimm-video under that name, as described above.
- No settings: set up fresh, as Jason's MacBook, after a y. A brimm-video checkout with no settings (the transcript tool's standby may have one) is left as it is.
- Settings naming any other Mac, the Mac Studio included: refused, and nothing is changed.

**Set up fresh:**
- The app finds Dropbox's The BRIMM DB › BRIMM Video: first in `~/Library/CloudStorage/Dropbox*`, then in `~/Dropbox*`, at the top of each Dropbox or a level deeper, in a team member's folder (as on the Mac Studio: `Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB`). A link to the same folder counts once. With none, or more than one, it stops before asking anything.
- It skips what only brimm-video has: the check that the settings are as the switch of 26 October left them, the drop-folder count (there is no drop folder until the installer makes it), and step 7 (brimm-video's old key, if there is one, is left as it is).
- Studio's installer makes the rest, with the same options as hers: the settings, Drop › Jason's MacBook, the light import, hand-off version 2, and the BRIMM Video Studio folder for Claude.

**On both MacBooks:**
- Each Mac's key and its title on GitHub carry the Mac's name.
- Nothing the app says names Sallie, or says "her" of the person or the Mac. The report keeps the page's own box labels, which are her laptop's.
- On the By-Hand page, the move group gets a check for his MacBook. Check 74 stays hers.

Calls made here (Claude's):
- A fresh Mac is always Jason's MacBook, so nothing is typed but y or n. A third Mac needs one line in the app.
- The app keeps its name, Move to Studio.

## The next round

The working folder and the drop folders become local in the next round. So the app writes no Dropbox path of its own. It reads her BRIMM Video folder from her settings and her drop folder from `settings.js show`, and keeps the installer's options in one place, so the next round changes one line. On a Mac set up fresh, it finds BRIMM Video in Dropbox and hands that to the installer, which needs it.

Jason, 6 November: "the app installer should allow the user to pick or create the Drop folder in a location of their choosing with a warning that creating it in Dropbox or other 'cloud' folders could cause issues. they should also be able to choose which folder exports of edited videos go into. Cloud based folders are fine for this step, especially if they want to share with other users or computers"

Studio can't do that yet: it puts the drop folder at BRIMM Video › Drop › the Mac's name, and looks for exports only in Downloads. Jason decided the same day that Studio's side belongs to Phase 3 of the review plan (the local working folder, `docs/superpowers/plans/2026-11-05-review-changes-plan.md`), and that the app follows once Studio has it. The app will then pick each folder with macOS's own folder chooser (with New Folder), warn when the drop folder is in Dropbox, iCloud Drive or another cloud folder, and hand both to the installer.

## Testing

- Tests first, in `tool/tests/`. The move script runs in a home made for each test, with stand-ins for every program that could change something or reach out (`ssh-keygen`, `ssh`, `git`, `claude`, `launchctl`, `brew`, `open`, `pbcopy`, `caffeinate`) and a stand-in installer that only notes how it was called. No test makes a real key, clones from GitHub or runs the real installer. Tests that need a Mac skip themselves elsewhere, as the installer's do.
- The build script's tests: what the bundle holds, its Info.plist, the commit written into it, and that it writes nowhere else. Its signing is tested with stand-ins for `codesign` and `security`: the identity it picks, the hardened runtime and timestamp, and that it refuses unless exactly one Developer ID Application identity is found.
- On the Mac Studio, only in a temporary home and with `--print`: the move script against a made-up brimm-video laptop there, before and after a local clone. Nothing installed, nothing launched.

## Details for the builder

From the page's checks 41 to 44, and calls made here:

- **What step 1 expects.** Her `settings.json` (read as JSON) says machine "Sallie's laptop", import "light", handoffVersion 2, drop "Drop", and a checkout that is brimm-video's (`~/Claude Code/BRIMM video`) or, on a later run, Studio's. Anything else stops it, as check 41 says. "No import running": every line `launchctl list | grep com.thebrimm` prints starts with `-`. "No video": the drop folder holds nothing but `.DS_Store` and `.brimm-watched-by`. The app looks again right before the real install (after the y, before `--yes`), because the installer checks the drop folder only when it switches the folder, and her laptop stays on Drop (corrected 6 November).
- **The installer's line** is exactly check 44's: `--machine "Sallie's laptop" --drop Drop --import light --handoff 2 "<root>"`, with `<root>` from her settings. No `--user-deny`, no `--rules-only`. Her folder gets the strict lock: the open lock waits for its checks by hand (`OPEN_LOCK_CLAUDE` unnamed), and the installer says which lock it writes. `--app` is not an installer option, so `settings.js set --app hyperframes` follows the installer, as in check 44.
- **The commit.** The build writes main's commit into the app and refuses one GitHub's main does not hold. The app clones main, then puts her local `main` at that commit, tracking `origin/main`, so it stays on main and a later `git pull --ff-only` works. If main has moved on since the build, the app's commit wins, and `behind` in her folder then says a newer one is out: both Macs are updated as usual. Whether #35 is in main by then changes nothing here.
- **The Host entry and the URL** are check 42's: `Host github-brimm-video-studio`, `HostName github.com`, `User git`, `IdentityFile ~/.ssh/brimm_video_studio_deploy`, `IdentitiesOnly yes`; clone from `git@github-brimm-video-studio:jogden12/brimm-video-studio.git`. An entry already there that is the same is "already done"; one that differs stops it. If GitHub's host key is not yet in `~/.ssh/known_hosts`, it offers to add GitHub's published ED25519 line, carried in the app and checked against the fingerprint above. brimm-video's entry and key are left until step 7.
- **A Mac partly moved** (the key, the Host entry, the clone or the installer done on an earlier run, by the app or by hand) is expected on a later run: each step finds its own work done and says so. A checkout at Studio's place that is not a clean clone of jogden12/brimm-video-studio on main stops it.
- **Claude Code's versions.** The installer's print decides: if it says Terminal's Claude Code is older than her folder's guard needs, the app offers `claude update`, asked, then prints again. If it says the Claude app's own copy is older, the app says to choose Claude › Check for Updates in the app, and prints again once Jason presses Return, as check 44 does.
- **If the real install fails**, the app shows the installer's own last words (it says what it touched) and stops. The installer replaces the launch agent near its very end, after everything it fetches, and a second run goes on from there. Going back to brimm-video is Jason's call, by hand, with brimm-video's installer, which stays on disk.
- **The report** is plain text, one heading per check, one line per answer box, labelled as the page labels it.

## The By-Hand page

Checks 41, 42 and 44 (and 48's key) get the app's way first, with the Terminal steps kept as the fallback. New steps before them: the one-time signing setup (above); Claude builds and signs the app on the Mac Studio after the merge, then notarizes it, each on Jason's yes; Jason carries it over and opens it; the report comes back by AirDrop. They run only on Jason's yes.

## Not now

- Updating her laptop later (`git pull`, then her folder written again) stays check 48's command. It could be a second app later.
- Changing the installer itself.
- Anything for the Mac Studio.

## Calls made here, for Jason to check

- A Terminal window, not a window of its own: the installer's print shows whole there.
- The commit is fixed when the app is made, so a new commit on main means making the app again.
- A failed install is shown and stopped, never undone: a second run goes on, and going back to brimm-video stays by hand.
- Notarizing is a by-hand step, not in the repo's scripts: it sends the app to Apple, and nothing in the repo sends anything.
- An unsigned build stays possible, for the tests, the trial and a fallback.
- The report and the key's public half go back by AirDrop.
- The tidy of brimm-video's key is in the app, on a later run, asked on its own.
- The name "Move to Studio".
- The code goes in `tool/move-app/` (move script, launcher, build script), its tests in `tool/tests/move-app.test.js`, its doc in `docs/setup/move-to-studio-app.md`.
