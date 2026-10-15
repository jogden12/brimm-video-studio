# Setting up Sallie's laptop

For Jason, with Sallie, in person or by screen share. About two hours. Each step says what to check. Nothing here is done without your yes; the installer runs with `--print` first.

## Morning checks (only the laptop can answer these)

Write each answer down; tell the design session if one is a surprise.

1. **macOS version:** Apple menu > About This Mac. Final Cut Pro 12.4 needs macOS 26.6 or later (its LSMinimumSystemVersion); on anything older the App Store gives 12.3. Update macOS first (System Settings > General > Software Update; about an hour with restarts, so start it first), ideally to 27 like the Mac Studio, then App Store > Updates. That upgrade is your and Sallie's decision: if you decide to stay on 12.3 today, step 10 is then the first check that 12.3 opens brimm-video's timelines (relative paths, and one Reel push for the upright format), and the two Macs' Final Cut versions differ until you bring them together.
2. **Free disk space:** Apple menu > About This Mac > More Info > Storage. An episode needs its raw video (about 2 GB an hour on Zoom) plus its library and renders; keep 100 GB free.
3. **Her Claude plan:** after step 6 below, `claude auth status --text` shows it. It must include Claude Code (Pro or Max).
4. **Final Cut Pro on her Apple ID:** bought, or shared with her by Family Sharing from yours. Open it once and note the version (Final Cut Pro > About).
5. **Her Dropbox:** signed in to the account The BRIMM DB is shared with; note the path to `The BRIMM DB/BRIMM Video` in Finder (Control-click the folder with Option held, Copy as Pathname).
6. **Her macOS user name and her `~/Movies`:** in Terminal, `whoami` and `ls -l ~ | grep Movies`. If Movies is a link into Dropbox, say so (Final Cut templates go there later).
7. **Her account is an administrator:** System Settings > Users & Groups shows Admin under her name. Homebrew and Xcode's tools need it; she types her own password each time.

## Steps

1. **Xcode's command line tools:** in Terminal, `xcode-select -p`. If it is not there: `xcode-select --install`, and click Install.
2. **Homebrew:** `brew --version`. If not there, she runs the command from https://brew.sh in Terminal and types her own password when it asks; then she runs the commands it prints under "Next steps".
3. **The deploy key** (read-only access to the code; the project's one secret, only on her laptop):
   - `ssh-keygen -t ed25519 -f ~/.ssh/brimm_video_deploy -N "" -C "brimm-video read-only, Sallie's laptop"`
   - `cat ~/.ssh/brimm_video_deploy.pub` and send yourself the one line it prints (this half is not secret).
   - On GitHub: jogden12/brimm-video > Settings > Deploy keys > Add deploy key. Title "Sallie's laptop", paste the line, leave "Allow write access" OFF, Add key.
   - Add the host to `~/.ssh/config`, in Terminal (it makes the file if it is not there):
     ```
     mkdir -p ~/.ssh && cat >> ~/.ssh/config <<'EOF'
     Host github-brimm-video
       HostName github.com
       User git
       IdentityFile ~/.ssh/brimm_video_deploy
       IdentitiesOnly yes
     EOF
     ```
   - `ssh -T git@github-brimm-video`: the first time it asks whether to continue connecting; check the fingerprint is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` (GitHub's published ED25519 key) and type `yes`. It should then say "Hi jogden12/brimm-video! You've successfully authenticated, but GitHub does not provide shell access."
4. **The code:** `mkdir -p ~/"Claude Code" && git clone git@github-brimm-video:jogden12/brimm-video.git ~/"Claude Code/BRIMM video"`. It stays on `main`; nobody edits it on her laptop.
5. **Final Cut Pro settings** (Final Cut Pro > Settings): Import > Files: **Leave files in place**. Playback: background rendering **off**. Destinations: add **Export File**, rename it **BRIMM final**, Format **Video and Audio**, Video Codec **H.264**, Resolution **Same as Source**, Action **Save Only**; Control-click it > **Make Default**. Leave library backups as they are. Turn the App Store's automatic updates off: App Store > Settings…, Automatic Updates off (or System Settings > General > Software Update, the (i) beside Automatic Updates, "Install application updates from the App Store" off). It is one switch for every App Store app: she updates other apps from the App Store's Updates list; you update Final Cut, on both Macs together.
6. **Claude:** install the Claude app and sign in. In Terminal, `claude --version`; if it is not there, install Claude Code as Anthropic's page says. Then `claude auth login`: she signs in to her own account in the browser (signing in to the app does not sign in the `claude` command). `claude auth status --text` must then show her signed in, and her plan (morning check 3).
7. **The installer, printed first:** `cd ~/"Claude Code/BRIMM video/tool" && ./install.sh --print --machine "Sallie's laptop" "<path to The BRIMM DB/BRIMM Video>"`. Read every line with her: the drop folder, the programs Homebrew will install (node, ffmpeg, whisper-cpp), the model (about 1.6 GB), Final Cut, Claude's sign-in, her folder for Claude. If it says Claude Code's version is older than 2.1.295, run `claude update` first and print again: on an older one her folder's guard could let a call through, and the install does not write her folder. Then, with your yes, run it again without `--print`. It downloads and installs; it asks "Go ahead?".
8. **Dropbox:** in Finder, Control-click `BRIMM Video/Unedited Video/Sallie's laptop` and choose Make available offline. macOS may ask whether node may read the Dropbox folder: Allow.
9. **Her folder for Claude, checked:** open the Claude app's Code tab on `~/BRIMM Video Studio` and accept the folder's trust question. First type `/status` and read the Claude Code row: it must be 2.1.295 or later (the Code tab runs its own copy, which can differ from `claude --version` in Terminal); if it is older, choose Claude > Check for Updates, then start a new session. If Claude Code shows a settings error or a warning about a deny rule at start, note it and tell the design session. In the mode selector, check that Auto and Bypass permissions are not offered, then pick Manual. Ask each of these, one at a time, and check that no approval card ever appears: "What's waiting?" (it lists the episodes); "Run the date command." (refused); "Read the file /etc/hosts." (refused: it is outside her folder); "Read <an episode's transcript, by its full Dropbox path>." (refused); "Show the episodes and the date in one command." (refused); "Run date in my terminal panel", "Watch the import log in the background", "Publish this as a page", "Check my email" and "Take a screenshot" (each refused, or no such tool). Ask the date and /etc/hosts questions again in Accept edits and in Plan. Never use the deploy key, or any other secret, as the file to try. If anything is allowed or asks for approval, stop and tell the design session.
10. **The first real run:** drop a short recording (a minute or two) into her drop folder, keep the lid open, and watch the panel. When it says Ready, first check that Claude was asked from the background job: in her Claude folder, "show me Claude's notes" must give notes, and the cut plan must not open by saying Claude could not be asked (if either fails, read ~/Library/Logs/brimm-video.log). Then, in her Claude folder: "open <its name>", "show it in Final Cut" (Final Cut asks once to be allowed; Allow), trim something by hand, Share it (the first save dialog will not be in From Final Cut yet: press Command-Shift-G, type `~/BRIMM Video Work/From Final Cut`, Return, and drag that folder into the dialog's sidebar), Export XML of the same project (check its dialog is in From Final Cut too), "finish the episode", and drop the hand-off on the BRIMM Ops page. Note how long the import took (the M4's speed) and the episode folder's size.
11. **The Mac Studio on the same brimm-video:** until its checkout has phase 1b, its `open` writes no claim and its writers ignore hers. On the Mac Studio, with no import running (the panel says nothing is in progress): `git -C ~/"Claude Code/BRIMM video" pull` (it stays on `main`), then `cd ~/"Claude Code/BRIMM video/tool" && node --test` (all pass). Then open a test episode there and check that "what's waiting?" shows `Editing: Mac Studio`.
12. **The two Macs:** on the Mac Studio, open an episode; on her laptop, open the same one: hers must say the Mac Studio has it. Then "hand it to Jason" on one, and open it on the other.
13. **A conflict, on purpose** (to learn Dropbox's naming): pick an episode nobody has open. Pause Dropbox on both Macs (its menu-bar icon > Pause syncing; on the laptop, turning Wi-Fi off also works); on the Mac Studio say "call it Test A", on her laptop "call it Test B"; resume Dropbox on both and wait. Note the conflicted copy's exact file name in the episode's `record/` folder, check that "what's waiting?" names the conflict, and that "sort out the conflict" finds it. If either does not, tell the design session the exact name: it goes into episode.js's `CONFLICTED` pattern and a test.

## If something goes wrong

- The import stopped: "try it again" in her Claude folder; the log is `~/Library/Logs/brimm-video.log`.
- "Jason has a newer brimm-video": in Terminal, `cd ~/"Claude Code/BRIMM video" && git pull` (only when no import is running), and on the Mac Studio too.
- Revoking the key (laptop lost, or no longer needed): GitHub > jogden12/brimm-video > Settings > Deploy keys > Delete.
