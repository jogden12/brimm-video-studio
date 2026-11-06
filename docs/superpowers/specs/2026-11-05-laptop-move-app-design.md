# Moving Sallie's laptop to Studio with one app (design)

5 November 2026. A draft for Jason's approval: nothing is built until he approves it. Branch `claude/studio-laptop-move-app`, from main fd5cd77.

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

An app bundle wrapping zsh scripts, made by a build script in the repo and zipped for AirDrop. Its program has Terminal run the move script inside the bundle, with at most one macOS question to let it open Terminal and no second Gatekeeper question; how is the builder's call (a `.command` file it writes into a fresh temporary folder and opens, or Terminal's `do script`).

Not a `.pkg`. Installer runs its scripts as root, and Homebrew, her user's launch agents and her `~/.ssh` all need her user. It cannot show the installer's print and ask between steps. And it asks for her password though nothing needs it.

**Gatekeeper, unsigned.** A file that comes by AirDrop, Messages, Mail or a browser carries macOS's quarantine mark, and an unsigned app with that mark is blocked the first time it is opened ("Apple could not verify…"). Since macOS 15, Control-click › Open no longer gets past it. Instead: Done, then System Settings › Privacy & Security, where it says the app was blocked; Open Anyway (shown for about an hour after the blocked try); her password; Open. Once. A copy from a USB stick has no mark, and opens with no question. The trial on the Mac Studio (macOS 27.0.1) reads Gatekeeper's verdict on a marked copy with `spctl`, which opens nothing.

**Signed.** With an Apple Developer account ($99 a year), the build signs the app with a Developer ID and has Apple notarize it. Her Mac then opens it with only "downloaded from the internet: are you sure?". The certificate stays in the Mac Studio's keychain and the notary login in a `notarytool` keychain profile: no credential is ever in a file. Without an account, the build makes it unsigned and the Open Anyway steps go on the page.

## The next round

The working folder and the drop folders become local in the next round. So the app writes no Dropbox path of its own. It reads her BRIMM Video folder from her settings and her drop folder from `settings.js show`, and keeps the installer's options in one place, so the next round changes one line.

## Testing

- Tests first, in `tool/tests/`. The move script runs in a home made for each test, with stand-ins for every program that could change something or reach out (`ssh-keygen`, `ssh`, `git`, `claude`, `launchctl`, `brew`, `open`, `pbcopy`, `caffeinate`) and a stand-in installer that only notes how it was called. No test makes a real key, clones from GitHub or runs the real installer. Tests that need a Mac skip themselves elsewhere, as the installer's do.
- The build script's tests: what the bundle holds, its Info.plist, the commit written into it, and that it writes nowhere else.
- On the Mac Studio, only in a temporary home and with `--print`: the move script against a made-up brimm-video laptop there, before and after a local clone. Nothing installed, nothing launched.

## Details for the builder

From the page's checks 41 to 44, and calls made here:

- **What step 1 expects.** Her `settings.json` (read as JSON) says machine "Sallie's laptop", import "light", handoffVersion 2, drop "Drop", and a checkout that is brimm-video's (`~/Claude Code/BRIMM video`) or, on a later run, Studio's. Anything else stops it, as check 41 says. "No import running": every line `launchctl list | grep com.thebrimm` prints starts with `-`. "No video": the drop folder holds nothing but `.DS_Store` and `.brimm-watched-by`. The installer checks that again itself and refuses; the app's look only says it sooner.
- **The installer's line** is exactly check 44's: `--machine "Sallie's laptop" --drop Drop --import light --handoff 2 "<root>"`, with `<root>` from her settings. No `--user-deny`, no `--rules-only`. Her folder gets the strict lock: the open lock waits for its checks by hand (`OPEN_LOCK_CLAUDE` unnamed), and the installer says which lock it writes. `--app` is not an installer option, so `settings.js set --app hyperframes` follows the installer, as in check 44.
- **The commit.** The build writes main's commit into the app and refuses one GitHub's main does not hold. The app clones main, then puts her local `main` at that commit, tracking `origin/main`, so it stays on main and a later `git pull --ff-only` works. If main has moved on since the build, the app's commit wins, and `behind` in her folder then says a newer one is out: both Macs are updated as usual. Whether #35 is in main by then changes nothing here.
- **The Host entry and the URL** are check 42's: `Host github-brimm-video-studio`, `HostName github.com`, `User git`, `IdentityFile ~/.ssh/brimm_video_studio_deploy`, `IdentitiesOnly yes`; clone from `git@github-brimm-video-studio:jogden12/brimm-video-studio.git`. An entry already there that is the same is "already done"; one that differs stops it. If GitHub's host key is not yet in `~/.ssh/known_hosts`, it offers to add GitHub's published ED25519 line, carried in the app and checked against the fingerprint above. brimm-video's entry and key are left until step 7.
- **A Mac partly moved** (the key, the Host entry, the clone or the installer done on an earlier run, by the app or by hand) is expected on a later run: each step finds its own work done and says so. A checkout at Studio's place that is not a clean clone of jogden12/brimm-video-studio on main stops it.
- **Claude Code's versions.** The installer's print decides: if it says Terminal's Claude Code is older than her folder's guard needs, the app offers `claude update`, asked, then prints again. If it says the Claude app's own copy is older, the app says to choose Claude › Check for Updates in the app, and prints again once Jason presses Return, as check 44 does.
- **If the real install fails**, the app shows the installer's own last words (it says what it touched) and stops. The installer replaces the launch agent near its very end, after everything it fetches, and a second run goes on from there. Going back to brimm-video is Jason's call, by hand, with brimm-video's installer, which stays on disk.
- **The report** is plain text, one heading per check, one line per answer box, labelled as the page labels it.

## The By-Hand page

Checks 41, 42 and 44 (and 48's key) get the app's way first, with the Terminal steps kept as the fallback. New steps before them: Claude builds the app on the Mac Studio after the merge, on Jason's yes; Jason carries it over and opens it (with Open Anyway, if unsigned); the report comes back by AirDrop. They run only on Jason's yes.

## Not now

- Updating her laptop later (`git pull`, then her folder written again) stays check 48's command. It could be a second app later.
- Changing the installer itself.
- Anything for the Mac Studio.

## Calls made here, for Jason to check

- A Terminal window, not a window of its own: the installer's print shows whole there.
- The commit is fixed when the app is made, so a new commit on main means making the app again.
- A failed install is shown and stopped, never undone: a second run goes on, and going back to brimm-video stays by hand.
- The report and the key's public half go back by AirDrop.
- The tidy of brimm-video's key is in the app, on a later run, asked on its own.
- The name "Move to Studio".
- The code goes in `tool/move-app/` (move script, launcher, build script), its tests in `tool/tests/move-app.test.js`, its doc in `docs/setup/move-to-studio-app.md`.
