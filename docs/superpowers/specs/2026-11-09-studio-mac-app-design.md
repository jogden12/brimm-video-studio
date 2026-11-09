# BRIMM Video Studio as a Mac app (design)

9 November 2026. Jason approved this design on 2026-11-09. The build plan is
`docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`.

## Context

Today a Mac is set up with "Move to Studio.app", which opens Terminal on a 1,900-line y/n script (`tool/move-app/move.zsh`) and then runs `tool/install.sh`. The script was written to move two named Macs (`MACHINES=("Sallie's laptop" "Jason's MacBook")`). Before the app can run, the Mac needs:
- Homebrew, installed in Terminal with an admin password
- Xcode's command line tools
- node
- a GitHub deploy key that Jason adds by hand for each Mac

**What Jason asked for.** He wants a normal Mac install, with no Terminal, that is generic enough to set up his MacBook and other computers. It should be built "as close to how I would for an app to be distributed to clients and other third parties."

**The experience, in Jason's words:**
1. Open the zip and double-click the installer.
2. A friendly window walks through every step: folder pickers, Dropbox instructions and warnings, links to install HyperFrames and other needed apps.
3. When it finishes, a Getting Started PDF covers the final setup: the drop folder in Finder's sidebar, recommended HyperFrames settings, and how to start a session in Claude Code.

**Jason's decisions**
- The person is at the Mac alone, so no step may need Jason.
- Updates are offered from within the app, like the Claude app does it. The notice reaches the person through the Claude app when they work in their BRIMM Video Studio folder.
- Sallie's laptop and Jason's MacBook re-run the new installer, which takes them over. Their GitHub keys are deleted afterwards.
- The Getting Started PDF is written for each Mac.
- The installer is client-grade, but The BRIMM's brand, folders and BRIMM Ops stay built in for now. Making them configurable is a later project.

## The design

### 1. One app: **BRIMM Video Studio.app**
- **What's in it.** It is signed with Developer ID, notarized and versioned (semver), for Apple silicon on macOS 13 or later. The bundle carries:
  - Studio's code at one commit, from `git archive` of `tool/` without tests or move-app;
  - `build.json`: version, build number, full and short commit, update feed URL, channel, support contact;
  - node and npm;
  - static ffmpeg and ffprobe, with VideoToolbox, `scale_vt` and libx264;
  - a static whisper-cli built with Metal;
  - Studio's Swift helpers, compiled ahead of time;
  - Sparkle 2.
- **Downloaded during setup instead,** with a pinned SHA-256 for each:
  - the whisper model;
  - the pinned HyperFrames CLI and its Chrome, as today;
  - Claude Code, via its user-level native installer into `~/.local/bin`, where `install.sh:281` and `unedited.js:117` already look.
- **First open.**
  - If macOS is running it from a quarantine location (App Translocation), it refuses to set up and offers to move itself to /Applications, or to ~/Applications for a user who isn't an admin.
  - Then it opens the setup assistant.
- **Later opens.**
  - It shows status, settings, Check for Updates…, Repair, Open Getting Started guide, and Uninstall. Uninstall removes the background job and leaves the person's data.
  - On every launch it compares its own path with `settings.checkout` and repairs if they differ.
- **No git and no deploy key** on any installed Mac. Only the Mac Studio stays a git checkout, marked `"mode": "dev"` in its settings, and the app refuses to take it over.

### 2. The setup assistant (no Terminal)
A SwiftUI window shows its steps down the side, each with a live status. Every question is a button, a text field or macOS's own folder picker. The steps:
1. **Welcome.** What will be installed, roughly how long it takes, and that nothing is ever posted.
2. **This Mac's name.** Suggested from the computer's name (ComputerName). It is checked with `machineFault` (`tool/settings.js:103`) and against the names already in Drop and Episodes, which gives a warning, not a block. On a takeover or repair the name comes from the settings and is never asked again.
3. **Apps to install.** The window says which are missing, with buttons that open each download page, and turns green as each one appears:
   - the Claude app (for the Code tab), and Claude Code, with sign-in through the browser;
   - Dropbox;
   - the HyperFrames app.
4. **BRIMM Video in Dropbox.** It finds `The BRIMM DB/BRIMM Video` using the search ported from `move.zsh:422-433`. If there are several it offers a picker; if there are none it gives guidance. The window also explains Dropbox:
   - make the folder available offline;
   - hold Option while dragging, so Dropbox keeps its copy;
   - never export into the drop folder.
5. **Folders.** The drop folder (suggested: BRIMM Video Work › Drop) and the exports folder (suggested: Downloads). Each is checked with `dropFolderFault` and `exportsFolderFault` and named with `folderWords`. A cloud folder gets a warning from `cloudFolder`.
6. **Permissions.** macOS's privacy prompts (Downloads, Dropbox, the drop folder) are triggered here, while the person is there to click Allow. They name "BRIMM Video Studio".
7. **Review.** A plain summary of what will change, from the gate in `install.sh --print`. Its exit code decides, and the full text sits under a Details disclosure. Then an **Install** button.
8. **Install.** One progress bar per part: copying the programs, the model, the HyperFrames CLI and Chrome, the installer run, and the check that Claude answers from the background job.
9. **Done.** The Getting Started PDF opens in Preview. There are also "Copy setup summary" and "Open your BRIMM Video Studio folder in Claude" buttons.

**The Getting Started PDF**
- It is made at the end from an HTML template with this Mac's own details: its name, its drop folder and exports folder in Finder's words, and the app versions.
- The Swift app turns it into a PDF (`WKWebView.createPDF`), so no packages are needed.
- It is saved in `~/BRIMM Video Work/` and can be reopened from the app.
- It covers:
  - adding the drop folder to Finder's sidebar;
  - making the folder available offline in Dropbox;
  - recommended HyperFrames settings: agent Claude Code on **Auto, never Full**; telemetry off; sign in to HeyGen; never render in the cloud; the notes on AI avatars;
  - how to start a session in the Claude app's Code tab on `~/BRIMM Video Studio`;
  - how updates arrive;
  - who to contact for help.

### 3. Engine and shell
- **The Swift side is thin.** Windows, pickers, the PDF and Sparkle. Every decision lives in a Node engine, `tool/setup/`, which runs on the bundled node and speaks JSON lines: step, progress, question, summary, done, error.
- **The engine keeps the tests in `node --test`.** Its harness has stand-ins for launchctl, scutil, claude, curl, codesign and the installer, on the pattern of `tool/tests/move-app-harness.js`.
- **It drives `install.sh` rather than replacing it.** install.sh is the tested path (136 tests) that the Mac Studio keeps using. The engine:
  - uses the same node functions install.sh uses, rather than parsing its English: `settings.js plan` and `write`, `hyperframes.js toolchainHolds`, `workcopy` `hasHwaccel` and `hasFilters`, `claude auth status --json`;
  - stages first anything that needs a progress bar;
  - then runs `install.sh --yes` with the answers.
- **An update or a repair** is the same run, from the new bundle, with the answers settings.json already holds.

### 4. The background job
- It keeps the label `com.thebrimm.unedited` and the plist install.sh writes, with `WatchPaths` on the folder the person picked. That is why a sealed SMAppService plist doesn't fit.
- `ProgramArguments[0]` is the app's own executable in `--agent` mode. It starts node as a child and waits. This way:
  - macOS's prompts and grants belong to "BRIMM Video Studio";
  - the grants survive updates, which Homebrew's node never did;
  - `AssociatedBundleIdentifiers` shows the app's name in Login Items.

### 5. Updates, offered in the app and in Claude
- **Sparkle 2** reads an EdDSA-signed appcast from **Cloudflare R2 on Jason's own domain**, published with the `cf` CLI (per Jason's global rule).
  - It sends no system profile.
  - Automatic installs are off; the person decides.
  - Sparkle also checks that each update is signed by the same team.
  - Delta updates keep the downloads small.
- **The notice in Claude needs no new hook.** Studio's skill already runs `behind` at the start of every session (`tool/studio/SKILL.md:14`), right after the lock check.
  - In installed mode, `behind` reads a new `tool/update-check.js`. It looks at the same appcast at most once a day, with a 3-second timeout. It caches its answer in Application Support, still works offline, and sends nothing about the Mac.
  - `behind` then says "A newer BRIMM Video Studio is ready: 1.5.0 (this Mac has 1.4.2)." Claude passes that on in one line and says the person can say "update Studio" whenever it suits.
- **A new `edit.js update` command** opens the app with `brimm-video-studio://check-for-updates`, and Sparkle's window takes over. Two reasons for this route:
  - It is just another `edit.js` command, so the guard needs no new rule.
  - It is a URL scheme because `open --args` is ignored when the app is already running.
- **A SessionStart hook was rejected.** Whether its message shows in the Code tab is unconfirmed, it would speak before the lock check, and the lock checkers count it as "other-hooks".
- **Updating safely.** Before installing an update:
  1. The app writes an `updating.json` marker, which expires when its process is gone or after 30 minutes.
  2. It waits until the system is idle. A single `idleWhy()` checks all of these: the agent has no process, the runs lock is free, and neither `episode.lock` nor `when-ready.lock` is held.
  3. It stops the agent and installs.
- **After relaunching,** it repairs the plist, the Claude folder (`settings.js studio`) and the HyperFrames pin, starts the agent again, and says "start a new chat".
- **Compatibility.** Commands stay backward-compatible for one release, for a chat that spans an update.

### 6. What changes in Studio outside the installer
- **`build.js` (`buildOf`)** tells installed mode from dev mode. In installed mode:
  - `commitOf` (`filing.js:158`) reads `build.json` and starts no program;
  - `behind` and `studioStale` (`edit.js` ~2880-2960) change their wording;
  - `access.js`'s notices about node changing are turned off.
  - Dev mode stays exactly as it is.
- **Nothing at run time needs Xcode's tools:**
  - the four Swift helpers are compiled;
  - a compiled helper replaces `/usr/bin/python3` in `dropbox.js:177`;
  - git runs only where there is a `.git`;
  - `findPrograms` (`unedited.js:107-118`) looks in node's own folder first. `run.js` is a copy from brimm-operations and is left alone.
- **Two path fixes:**
  - `{{NODE}}` is quoted in the skill, the allow rule and the guard patterns (`SKILL.md:8`, `studio.js:340`, `open-lock.js:154,186`), because the app's path has spaces. This touches security, so it gets its own reviewed PR, with `guard-cases` tests written first.
  - The checks for being started as the main script become realpath-safe (`edit.js:7167`, `unedited.js:1800`, `settings.js:1402`, `access.js:335`).
- **Wording.** Messages that say "Jason runs install.sh" become "open BRIMM Video Studio and choose Repair". "Jason has a newer…" becomes the update line. The support contact comes from `build.json`.
  - `guide.js` is left alone: it is part of the BRIMM Ops contract.
  - The wider move from "her" and "Jason" in about 40 files waits for the brand-configurable project.
- **The BRIMM Ops contract is unchanged.** `madeBy` stays `brimm-video <short commit>` and still passes `handoff-v2.js:207`. `tool/shared/`, `lib.js`, `run.js`, the fixtures and their hashes are untouched.
- **CLAUDE.md:**
  - Only the Mac Studio uses git and a key.
  - The person's own click in the app is their yes; Claude only runs `--print`, the tests, or `release.sh --print`.
  - Updates come only from signed builds on the feed.
  - Correct the stale line that says Sallie's laptop still runs brimm-video.
