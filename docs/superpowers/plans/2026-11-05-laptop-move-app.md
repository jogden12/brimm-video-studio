# Move to Studio (Sallie's laptop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed Mac app, "Move to Studio", that moves Sallie's laptop from brimm-video to BRIMM Video Studio one asked step at a time, in a Terminal window.

**Architecture:** A zsh move script (`tool/move-app/move.zsh`) does every step: looks first, asks before each change, stops safely, and runs again from where it stopped. A tiny Swift launcher and a zsh helper hand that script to Terminal. A zsh build script makes the bundle, signs it with Jason's Developer ID, and zips it. The move script wraps the clone's own `tool/install.sh`, never a copy of it.

**Tech Stack:** zsh, Swift (the launcher only, built with the Command Line Tools' `swiftc`), Node 22+ `node:test` for the tests. No packages.

**Spec:** `docs/superpowers/specs/2026-11-05-laptop-move-app-design.md` (approved by Jason, 5 Nov 2026). Read it first.

## Global Constraints

- Work only in `/Users/jasonogden/Claude Code/brimm-video-studio/.claude/worktrees/studio-laptop-move-app`, branch `claude/studio-laptop-move-app`. Never touch `~/Claude Code/brimm-video-studio` (the Mac Studio's live checkout), never run `tool/install.sh` (not even `--print`: only the coordinator does that, in a temporary home), never write into Dropbox.
- Test first, always: `cd tool && node --test tests/move-app.test.js` (or `move-app-build.test.js`), then the whole suite `cd tool && node --test` before each commit.
- Tests run only stand-ins for `ssh-keygen`, `ssh`, `claude`, `launchctl`, `brew`, `open`, `pbcopy`, `caffeinate`, `sw_vers`, `df`, `xcode-select`, `swiftc`, `security`, `codesign`, `osascript`, and a stand-in `tool/install.sh`. Real ones allowed: `zsh`, `git` (on local repos only), `node`, `plutil`, `ditto`, coreutils. A test that needs a Mac skips itself elsewhere, as `tool/tests/install.test.js` does (`process.platform !== "darwin"`, and `/bin/zsh` present). CI is Ubuntu.
- Nothing ever prints, logs or writes into the report: the key's private half (never read, only `ssh-keygen` touches it), the Claude account's email or organisation, or the name of any file in her drop folder.
- Nothing in the repo sends anything: no `notarytool submit` or `stapler` in any script (the build only prints those commands for the by-hand step). `codesign --timestamp` asks Apple's timestamp server for a time, which signing for notarization needs; say so in the doc.
- No credential in any file. The build finds the identity by name in the keychain.
- Copy is in plain words. Lines quoted in this plan are exact: tests assert them.
- Commit messages start "Studio move app: " and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A video dropped in her drop folder after the look: the installer's own `--print` refuses. The app must show its words and stop, never run `--yes`, never open or name the file. (Task 4 test "stops with the installer's own words when its print refuses".)
2. A clone cut short (the network drops, the lid closes): the next run must clear `~/Claude Code/brimm-video-studio.partial` and clone again, and a failed clone must leave nothing at the checkout's place. (Task 3 tests.)
3. Her `~/.ssh/config` with other hosts and no final newline: the new block must not run into the last Host block, and everything before it must stay byte for byte. (Task 2 test.)
4. Return pressed before the key is on GitHub: `ssh -T` says "Permission denied", and the app must ask to try again rather than stop or report success. (Task 2 test.)
5. Answers typed as `Y`, `yes` or ` y `: these go ahead. Anything else, an empty line, or the end of input is no. (Task 1 test.)

---

## The move script's interface (all tasks)

`zsh tool/move-app/move.zsh --commit <40 hex> [--print]` (and `-h|--help`: the opening comment, as install.sh does).

- **Exit:** 0 finished (or `--print` done); 1 stopped (an n, a failure, something unexpected); 2 refused before anything (an option, not a Mac, not her laptop); 130 or 143 on Ctrl-C or a kill.
- **Main is guarded** so a test can `source` the file and call one function alone: the last line is `[[ $ZSH_EVAL_CONTEXT == toplevel ]] && main "$@"`.
- **Values, each set once at the top:**
  - `MACHINE="Sallie's laptop"`
  - `STUDIO_URL="git@github-brimm-video-studio:jogden12/brimm-video-studio.git"`, or `$BRIMM_STUDIO_REPO` when set (tests use a local repo)
  - `HOST_ALIAS="github-brimm-video-studio"`
  - `KEY="$HOME/.ssh/brimm_video_studio_deploy"`
  - `KEY_COMMENT="brimm-video-studio read-only, Sallie's laptop"`
  - `OLD_KEY="$HOME/.ssh/brimm_video_deploy"`
  - `GITHUB_HOST_KEY="github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"` (fingerprint `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`)
  - `STUDIO="$HOME/Claude Code/brimm-video-studio"`, `PARTIAL="$STUDIO.partial"`
  - `OLD_CHECKOUT="$HOME/Claude Code/BRIMM video"`
  - `SETTINGS="$HOME/Library/Application Support/BRIMM Video/settings.json"`
  - `LOG="$HOME/Library/Logs/brimm-video-studio-move.log"`
  - `REPORT="$HOME/Desktop/Studio move report.txt"`, `PUBLIC_COPY="$HOME/Desktop/Studio key (public half).txt"`
  - `MARKS="$STUDIO/.git/move-to-studio"`: lines `tests=<sha>` and `installed=<sha>`
  - `INSTALL_OPTIONS=(--machine "Sallie's laptop" --drop Drop --import light --handoff 2)`: the one place the installer's options are written
  - `HF_APP="${BRIMM_HYPERFRAMES_APP:-/Applications/HyperFrames.app}"`, `HF_PAGE="https://hyperframes.dev/studio"`
  - `CHECK_FILE="$HOME/Library/LaunchAgents/com.thebrimm.claude-check.plist"`, `AGENT_FILE="$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist"`
- **Programs** are found as install.sh finds them: `node` and `brew` along PATH then `${BRIMM_HOMEBREW_DIRS-/opt/homebrew/bin:/usr/local/bin}`; `claude` from `$BRIMM_CLAUDE`, else along `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` and `$HOME/.local/bin`.
- **ssh and git** always use her own files, never the passwd home's: `SSH_OPTS=(-F "$HOME/.ssh/config" -o "UserKnownHostsFile=$HOME/.ssh/known_hosts" -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes)`, and `GIT_SSH_COMMAND` built from the same options, shell-quoted.
- **Helpers:**
  - `say`: to the terminal, and to `$LOG` unless `--print`.
  - `ask "<what will change>"`: prints it, then `Go ahead? Type y and press Return, or n to stop: `. It reads one line from stdin; `y`/`yes` in any case, trimmed, means go ahead, and anything else or the end of input calls `stop_here`.
  - `wait_for "<what to do>"`: prints `Press Return when that's done, or type n and press Return to stop: `. An empty line goes on; anything else stops.
  - `done_already "<what>"` prints `Already done: <what>`.
  - `would "<what>"` prints `Would <what>`, under `--print` only.
  - `changed+=("<what>")` after each change.
  - `stop_here ["<why>"]`: prints the why, then `Stopped. This run changed nothing.` or `Stopped. This run changed:` with one `  - <change>` line each, then `Double-click Move to Studio again to go on from here.`, and exits 1.
  - On INT/TERM: take away `$PARTIAL` if this run made it, print the same summary, and exit 130/143.
- **`--print`** changes nothing: no log, no report file, no key, no clone, no question. Every look still runs, and a look that would stop the real run stops it here too, with the same words. It ends `Nothing was changed.`
- **Start:** `This is for a Mac.` (exit 2, from `uname -s`). A missing or malformed `--commit`: `Say the commit this app was made at: --commit and its 40 characters.` (exit 2). An unknown option: `Not an option this app knows: <arg>` (exit 2). The real run starts `caffeinate -i -w $$` in the background.
- **The headings, in order:** `1. Looking at this Mac (check 41). This changes nothing.`, `2. Studio's key (check 42)`, `3. Studio's code (check 42)`, `4. The HyperFrames app (check 43)`, `5. Studio's installer (check 44)`, `6. The report`, `7. brimm-video's old key (check 48)`. The last line of a finished run: `Done. Next on the By-Hand page: checks 45 to 47, on screen.`

## The test harness (Task 1 builds it; later tasks extend it)

In `tool/tests/move-app.test.js`, a `moveOn(options, ...args)` in the style of install.test.js's `askWith`. It makes a temporary folder with `home/`, `bin/` (stand-ins first on PATH, each appending `name args` to a `ran` file) and a local "GitHub" repo, made with real `git`. That repo holds a stand-in `tool/install.sh`, a fake `tool/settings.js` (`show`, which prints `  Its drop folder:  <root>/<drop>/<machine>` and `  The editing app:  <app>` when set, and `set --app hyperframes`, which writes `app` into settings.json and prints `The editing app is now hyperframes (it was off).`) and `tool/tests/ok.test.js`, which fails when `BRIMM_TEST_FAIL=1`. The same fake settings.js is put in the old checkout, `home/Claude Code/BRIMM video/tool/`. The repo's commit is the default `--commit`. `options` sets:

- `settings`: her settings.json (default `{version:1, machine:"Sallie's laptop", root:<home>/Dropbox/The BRIMM DB/BRIMM Video, checkout:<old checkout>, import:"light", handoffVersion:2, drop:"Drop"}`), or `null` for none;
- `launchctl`: what `launchctl list` prints (default `-\t0\tcom.thebrimm.unedited`);
- `dropFiles`: names put in her drop folder (always also `.DS_Store` and `.brimm-watched-by`);
- `claude`: `{ status, version }` (default signed in, Max, an email that must never show, `2.1.300 (Claude Code)`); `auth login` flips it to signed in;
- `ssh`: `"ok"`, `"denied"` or `["denied","ok"]` (one answer a call);
- `key`: `null` or the comment of a key already in `home/.ssh`;
- `sshConfig` and `knownHosts`: those files' text, or `null`;
- `checkout`: `"absent"`, `"at-pin"`, `"other-commit"`, `"dirty"`, `"other-remote"`, or `"partial-left"` (a stale `.partial` beside it);
- `hfApp`: a version, or `null` (pointed at by `BRIMM_HYPERFRAMES_APP`);
- `install`: what the stand-in installer does: `{ print, printExit, ran, ranExit, moves }` (`moves` rewrites settings.json's checkout to Studio and writes the agent's plist to run `$STUDIO/tool/unedited.js`);
- `answers`: stdin, such as `"y\ny\n\n"`.

It returns `{ status, out, ran, home, tree, log, report }`: `tree` lists every file in `home` afterwards, and `log` and `report` are those files' text or `""`.

---

### Task 1: The frame and the look (check 41)

**Files:**
- Create: `tool/move-app/move.zsh`
- Test: `tool/tests/move-app.test.js`

**Interfaces:**
- Produces: everything in "The move script's interface" and "The test harness" above. Step 1 is `look_at_this_mac`. It sets `ROOT`, `DROP` (from `settings.js show` of the checkout her settings name), `CHECKOUT_NOW`, `NODE`, `CLAUDE` and the report's step-41 lines, `R41=()`.

- [ ] **Step 1: Write the failing tests** (all skip off a Mac):
  - "refuses another Mac, and an option it doesn't know, and a missing commit, changing nothing": `settings.machine = "Mac Studio"` gives status 2 and `This app is for Sallie's laptop, and this Mac's settings say it is "Mac Studio". Nothing was changed.`; no settings gives status 2 and `This Mac has no brimm-video settings (~/Library/Application Support/BRIMM Video/settings.json), so it isn't a laptop this app moves. Nothing was changed.`; `--frobnicate` and a missing `--commit` give status 2; `tree` is unchanged and `ran` is empty in each.
  - "stops, saying which, when her settings aren't as the switch of 26 October left them": one case each for `import:"full"`, `drop:"Unedited Video"`, `handoffVersion:1` and a checkout that is neither checkout. Each has status 1, names the setting and its value, and ends with the stop summary.
  - "stops while an import is running": `launchctl: "1234\t0\tcom.thebrimm.unedited"` gives status 1 and `An import is running now. Wait until its window in the top right closes, then double-click Move to Studio again.`
  - "counts the files in her drop folder, never names one, and stops when there are any": `dropFiles: ["Client Name Session.mov"]` gives status 1 and `Her drop folder holds 1 file still to be imported.`; neither `out` nor `log` contains `Client Name`.
  - "offers claude auth login when Claude Code isn't signed in, and stops on n": signed out with `answers: "n\n"` gives status 1 and no `claude auth login` in `ran`; with `"y\n"` it runs it, looks again, and goes on.
  - "never shows the Claude account's email": with the default signed-in status, `out`, `log` and `report` never contain `sallie@example.com` or the organisation.
  - "takes y, Y, yes and ' y ' as go ahead, and anything else as stop": over the first question.
  - "with --print, looks, says what it would do in order, and changes nothing": status 0, the seven headings in order, `Would make Studio's key`, `Nothing was changed.` last; `tree` unchanged (no log, no Desktop file); `ran` holds only reading calls (`launchctl list`, `claude auth status --json`, `claude --version`, `sw_vers`, `df`, `xcode-select -p`, `brew --version`).
  - "writes all it says into its log, and keeps the Mac awake": a real run that stops at the first question has `log` holding every line of `out`, and `ran` has `caffeinate -i -w`.
  - "says it was stopped, and what it changed, on Ctrl-C": `source` the script and call its INT handler with one change made, and with `PARTIAL` made by this run. It prints the summary, takes `PARTIAL` away, and returns 130.

- [ ] **Step 2: Run** `cd tool && node --test tests/move-app.test.js`. Expected: FAIL (the script is not there).

- [ ] **Step 3: Write the frame and `look_at_this_mac` in `tool/move-app/move.zsh`.** Settings are read with `plutil -extract <key> raw -o - "$SETTINGS"`. Free disk is `df -k /`, in GB; under 100 GB is said and does not stop. The count leaves out `.DS_Store` and `.brimm-watched-by`. node must be 22 or later: else stop with `Node here is <version>, and Studio needs 22 or later. Run: brew upgrade node, then run the app again.` Missing Xcode tools or Homebrew stop with what Sallie runs (install.sh's own words). Claude's plan comes from `subscriptionType` alone.

- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS, with no other test changed.

- [ ] **Step 5: Commit** `Studio move app: the move script's frame and its look at her Mac (check 41)`.

### Task 2: Studio's key (check 42)

**Files:** Modify `tool/move-app/move.zsh`, `tool/tests/move-app.test.js`.

**Interfaces:**
- Consumes: Task 1's helpers and harness.
- Produces: `make_the_key`. It leaves `R42_KEY` and `R42_SSH` (what `ssh -T` printed) for the report.

- [ ] **Step 1: Write the failing tests:**
  - "makes the key on y, with exactly check 42's line, and shows and copies its public half": `ran` has `ssh-keygen -t ed25519 -f <home>/.ssh/brimm_video_studio_deploy -N  -C brimm-video-studio read-only, Sallie's laptop`. `pbcopy` was given the `.pub` line, `PUBLIC_COPY` holds it, and the stand-in private half's text (`PRIVATE-HALF`) appears in no `out`, `log` or `report`.
  - "keeps a key of that name made earlier with the same comment, and stops on one with another comment": `key: KEY_COMMENT` gives `Already done:` and no ssh-keygen in `ran`; `key: "someone else"` gives status 1.
  - "adds the Host entry on y, exactly, after what is there, and leaves the rest byte for byte": `sshConfig: "Host other\n  HostName example.com"` (no final newline) ends up as that text, `\n\n`, then the five lines `Host github-brimm-video-studio` / `  HostName github.com` / `  User git` / `  IdentityFile ~/.ssh/brimm_video_studio_deploy` / `  IdentitiesOnly yes` and a newline. A new file is made with mode 600. The same entry already there gives `Already done:`, and a different entry under that Host stops.
  - "offers GitHub's published host key when this Mac has none, and stops on a different one": no `knownHosts` and `y` appends `GITHUB_HOST_KEY`. A known_hosts line `github.com ssh-ed25519 AAAAOTHER` stops with words saying GitHub's key on this Mac isn't the one GitHub publishes.
  - "waits for the key to be on GitHub, then checks it with ssh, with her own files and GitHub's ed25519 key only": `ran` has `ssh -F <home>/.ssh/config -o UserKnownHostsFile=<home>/.ssh/known_hosts -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes -T git@github-brimm-video-studio`, and `R42_SSH` is the stand-in's `Hi jogden12/brimm-video-studio! You've successfully authenticated, but GitHub does not provide shell access.`
  - "asks to try again when GitHub doesn't know the key yet": `ssh: ["denied","ok"]` with answers taking the retry goes on; `["denied"]` with `n` stops.

- [ ] **Step 2: Run the file's tests.** Expected: the new ones FAIL.
- [ ] **Step 3: Write `make_the_key`.** One `ask` names the two files in `~/.ssh` and the Desktop copy. `wait_for` names what Jason does on GitHub (jogden12/brimm-video-studio › Settings › Deploy keys, title Sallie's laptop, write access off). A second `ask` covers the Host entry and a third GitHub's host key, each only when needed. Known keys are read with `ssh-keygen -F github.com -f "$HOME/.ssh/known_hosts"`. Success is the text `Hi jogden12/brimm-video-studio!`, not the exit status, since GitHub ends with 1.
- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `Studio move app: Studio's read-only key and the check of it (check 42)`.

### Task 3: Studio's code (check 42)

**Files:** Modify `tool/move-app/move.zsh`, `tool/tests/move-app.test.js`.

**Interfaces:**
- Consumes: `SSH_OPTS`, `STUDIO_URL`, `--commit` as `COMMIT`.
- Produces: `copy_the_code`, `run_the_tests`, and the marks file. It leaves `R42_COMMIT` and `R42_TESTS` (the `ℹ` lines) for the report.

- [ ] **Step 1: Write the failing tests:**
  - "clones main on y into the partial folder, puts main at the app's commit, then renames it": after the run, `$STUDIO` is on `main`, `HEAD` is the commit, its upstream is `origin/main`, its origin is the repo, and there is no `.partial`. When the local "GitHub" has a commit after the pin, `HEAD` is still the pin.
  - "stops, leaving nothing, when GitHub's main doesn't hold the app's commit": `--commit` of a commit not in the repo gives status 1, no `$STUDIO` and no `.partial`.
  - "takes away a half-made clone an earlier run left, then clones": `checkout: "partial-left"`.
  - "a failed clone leaves nothing at the checkout's place": the repo path made unreadable (or `BRIMM_STUDIO_REPO` pointing nowhere) gives status 1, no `$STUDIO` and no `.partial`.
  - "says already done for a clean checkout at the app's commit, and stops on any other": `at-pin` gives `Already done:`; `other-commit`, `dirty` and `other-remote` each stop and name what is wrong.
  - "the real clone is from check 42's address, through her own ssh files": with a stand-in `git` that notes `$GIT_SSH_COMMAND` and its arguments and fails, `ran` has `git clone --branch main git@github-brimm-video-studio:jogden12/brimm-video-studio.git <home>/Claude Code/brimm-video-studio.partial`, with `SSH_OPTS` in the command (no `BRIMM_STUDIO_REPO`).
  - "runs Studio's tests there with the spec reporter, stops when one fails, and doesn't run them again at the same commit": `BRIMM_TEST_FAIL=1` stops with the `ℹ fail 1` line shown. A pass writes `tests=<commit>` into the marks file, and a second run says `Already done:` for the tests.
- [ ] **Step 2: Run the file's tests.** Expected: the new ones FAIL.
- [ ] **Step 3: Write `copy_the_code` and `run_the_tests`.** Clone with `GIT_SSH_COMMAND`, check with `git merge-base --is-ancestor "$COMMIT" origin/main`, then `git reset --hard "$COMMIT"` and `mv "$PARTIAL" "$STUDIO"`. Run the tests with `(cd "$STUDIO/tool" && node --test --test-reporter=spec)`, shown as they run and kept in the log. The report keeps the `ℹ` lines. Tell Jason first that they take about three minutes and change nothing.
- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `Studio move app: Studio's code at the app's commit, and its tests (check 42)`.

### Task 4: HyperFrames, and Studio's installer (checks 43 and 44)

**Files:** Modify `tool/move-app/move.zsh`, `tool/tests/move-app.test.js`.

**Interfaces:**
- Consumes: `ROOT`, `STUDIO`, `INSTALL_OPTIONS`, `NODE`, `CLAUDE`, the marks file.
- Produces: `look_for_hyperframes` and `run_the_installer`. They leave `R43_VERSION` and `R44_PRINT`, `R44_RAN`, `R44_AGENT` and `R44_APP` for the report.

- [ ] **Step 1: Write the failing tests:**
  - "notes HyperFrames' version, or opens its page in Safari and waits": `hfApp: "1.4.0"` gives `1.4.0`. `hfApp: null` gives `open -a Safari https://hyperframes.dev/studio` in `ran`, then waits, then looks again.
  - "prints the installer first, with check 44's options and her BRIMM Video, and repeats the lines that matter": `ran` has `install.sh --print --machine Sallie's laptop --drop Drop --import light --handoff 2 <root>`. The lines starting `  Claude Code, signed in:`, `  Claude Code's version:`, `  The Claude app's own Claude Code:`, `  HDR video:` and `  Her folder's lock:` are shown again under `The lines that matter:`.
  - "stops with the installer's own words when its print refuses, and never runs it for real": `printExit: 2` with a refusal's text gives status 1, that text in `out`, and no `--yes` in `ran`.
  - "on n after the print, runs nothing for real": no `--yes`.
  - "on y runs the same line with --yes, then checks the background job's line and the one-shot agent": `ran` has `install.sh --yes` with the same options and root. Without `From the background job:` in its output it stops, saying the setup stopped before its check of Claude. With `CHECK_FILE` left behind it stops, saying launchd would run it at every login.
  - "offers claude update when the print says Terminal's Claude Code is too old, then prints again": one `older than` line, then `y`, gives `claude update` in `ran` and two `--print` calls.
  - "waits for the Claude app's own update when its copy is too old, then prints again".
  - "turns HyperFrames on, asked, unless it is on already, and shows her drop folder in Finder": `settings.js set --app hyperframes` runs on y, and `open -R <root>/Drop/Sallie's laptop` is in `ran`.
  - "says already done for an install finished at this commit, and runs it again otherwise": `installed=<commit>` in the marks file gives no installer call. A finished real run writes it, and a run that stopped writes nothing.
  - "stops, showing its last lines, when the real install fails": `ranExit: 1` gives status 1, the installer's last lines, and no `installed=` mark.
- [ ] **Step 2: Run the file's tests.** Expected: the new ones FAIL.
- [ ] **Step 3: Write `look_for_hyperframes` and `run_the_installer`.** Run the installer as `zsh "$STUDIO/tool/install.sh"`, its output shown live and kept, with `${pipestatus[1]}` as its status. The app version comes from `plutil -extract CFBundleShortVersionString raw -o -`. The drop folder comes from `settings.js show`'s `  Its drop folder:  ` line, never built here. Say the Finder step in check 44's words: Control-click Sallie's laptop, choose Make available offline, and Allow if macOS asks whether node may read the Dropbox folder.
- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `Studio move app: HyperFrames and Studio's installer (checks 43 and 44)`.

### Task 5: The report, and brimm-video's old key (check 48)

**Files:** Modify `tool/move-app/move.zsh`, `tool/tests/move-app.test.js`.

**Interfaces:**
- Consumes: the `R41…R44` lines.
- Produces: `write_the_report` and `tidy_the_old_key`.

- [ ] **Step 1: Write the failing tests:**
  - "writes the report on her Desktop, one heading a check and one line a box, as the page labels them, and shows it in Finder". The headings are `41 Before you start`, `42 Studio's code on her laptop`, `43 The HyperFrames app on her laptop` and `44 Studio's installer on her laptop`. The lines are `Her macOS:`, `Free on her disk:`, `Anything unexpected in her settings:`, `What the count printed:`, `Her Claude account's plan:`, `Whether the key is on GitHub, and how:`, `What the check of the key printed:`, `The commit:`, `The tests' last lines:`, `The app's version on each Mac:`, `Anything in the print that surprised you, and its HDR line:`, `The installer's last lines:`, `What the look for the one-shot check printed:` and `What turning HyperFrames on printed:`. A run writes it whole again, and `open -R` gets the report.
  - "with --print, shows the report and writes no file".
  - "offers to delete brimm-video's old key only once the move is done, and deletes exactly its two files on y": `installed=<commit>` and both `OLD_KEY` files, with `y`, leaves neither file and everything else in `.ssh` untouched; `n` keeps them, and the run still ends `Done.`. Not installed: no question.
- [ ] **Step 2: Run the file's tests.** Expected: the new ones FAIL.
- [ ] **Step 3: Write `write_the_report` and `tidy_the_old_key`.** The tidy's question names GitHub first: "Has brimm-video's key been deleted on GitHub (jogden12/brimm-video › Settings › Deploy keys)?". An n there skips the tidy, never stopping the run. Its result line goes under a heading `48 Afterwards`.
- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `Studio move app: the report, and brimm-video's old key (check 48)`.

### Task 6: The launcher and the build

**Files:**
- Create: `tool/move-app/open-in-terminal.zsh`, `tool/move-app/launcher.swift`, `tool/move-app/build-app.sh`
- Test: `tool/tests/move-app-build.test.js`

**Interfaces:**
- Consumes: `tool/move-app/move.zsh` (copied as it is).
- Produces: `zsh tool/move-app/build-app.sh --out <folder> [--sign] [--any-commit]`. It makes `<folder>/Move to Studio.app` and `<folder>/Move to Studio.zip`, replacing only those two from an earlier build. The bundle is `Contents/Info.plist`, `Contents/MacOS/Move to Studio`, and `Contents/Resources/{move.zsh, open-in-terminal.zsh, commit.txt}`.

- [ ] **Step 1: Write the failing tests** (Mac only; the build is run from a copy of `tool/move-app/` committed into a temporary repo, with stand-ins first on PATH):
  - "opens Terminal on a fresh .command that runs a copy of the move script with the app's commit": with stand-in `open` and `TMPDIR` set to the test folder, `ran` has `open -a Terminal <TMPDIR>/move-to-studio.<…>/Move to Studio.command`. That file is executable, carries no `com.apple.quarantine`, and runs `/bin/zsh '<that folder>/move.zsh' --commit <commit.txt>`. The copy has the same bytes as move.zsh.
  - "shows an alert and opens nothing without a commit": `commit.txt` missing gives an `osascript` call, no `open`, and status 1.
  - "builds the bundle, its Info.plist and the commit, and writes nowhere but its folder": `plutil -lint` passes, and the keys are exactly `CFBundleExecutable` "Move to Studio", `CFBundleIdentifier` "com.thebrimm.move-to-studio", `CFBundleName` and `CFBundleDisplayName` "Move to Studio", `CFBundlePackageType` "APPL", `CFBundleInfoDictionaryVersion` "6.0", `CFBundleShortVersionString` "1.0", `CFBundleVersion` "1", `LSMinimumSystemVersion` "13.0" and `LSUIElement` true. `commit.txt` is HEAD, both scripts are byte-identical, `ran` has `swiftc -O -target arm64-apple-macos13.0 -module-cache-path <a temporary folder> -o <app>/Contents/MacOS/Move to Studio <…>/launcher.swift`, and the zip holds the app. Outside `--out` and the temporary folder nothing new appears.
  - "refuses a commit not on main, unless --any-commit, and uncommitted changes to the app's files": `origin/main` behind HEAD refuses; `--any-commit` builds; a changed `move.zsh` refuses always.
  - "signs with the one Developer ID Application identity, with the hardened runtime and a timestamp, and checks the signature": stand-in `security` lists one gives `codesign --force --options runtime --timestamp --sign Developer ID Application: Jason Ogden (TEAMID) <app>`, then `codesign --verify --strict --verbose=2 <app>`. Zero or two identities refuse, naming how many, with no codesign.
  - "names the notarizing steps and runs none of them": a signed build prints `xcrun notarytool submit "<zip>" --keychain-profile "BRIMM notary" --wait`, `xcrun stapler staple "<app>"` and `ditto -c -k --keepParent "<app>" "<zip>"`, and none of the three is in `ran`.
  - "the launcher compiles" (only where `swiftc` is): `swiftc -typecheck` of `launcher.swift`, with a temporary module cache, exits 0.
- [ ] **Step 2: Run** `cd tool && node --test tests/move-app-build.test.js`. Expected: FAIL.
- [ ] **Step 3: Write the three files.** `launcher.swift` runs `/bin/zsh <Resources>/open-in-terminal.zsh`, waits, and exits with its status. `open-in-terminal.zsh` copies `move.zsh` with `cp -X` into `mktemp -d "${TMPDIR:-/tmp}/move-to-studio.XXXXXX"`, writes the `.command` there with `printf`, `chmod 755`s it and opens it in Terminal. Copying out also covers macOS running a quarantined app from a temporary place. On any failure it shows `osascript -e 'display alert "Move to Studio could not open Terminal." message "…"'`. `build-app.sh` finds the repo as `${0:A:h:h:h}` and checks the commit (`git status --porcelain -- tool/move-app` empty; `git merge-base --is-ancestor HEAD origin/main` unless `--any-commit`), then makes, lints, signs, zips and says what it made. Signing takes the identity's name from `security find-identity -v -p codesigning`.
- [ ] **Step 4: Run the file's tests, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `Studio move app: the launcher and the build, signed with the Developer ID`.

### Task 7: The docs

**Files:**
- Create: `docs/setup/move-to-studio-app.md`
- Modify: `docs/setup/sallies-laptop.md` (one sentence at the top), `README.md` (one sentence after "Setting her laptop up, step by step: `docs/setup/sallies-laptop.md`.")

- [ ] **Step 1: Write `docs/setup/move-to-studio-app.md`** in plain words:
  - what the app is, and what it does step by step, check by check;
  - what stays by hand;
  - how to build it: signed for her laptop; `--any-commit`, unsigned, for a trial;
  - the one-time signing setup and the by-hand notarizing (the design's words);
  - carrying it over: AirDrop, or a USB stick;
  - stopping and running again, and the log and the report;
  - each stop message and what to do;
  - that `codesign --timestamp` asks Apple's timestamp server for a time, and that nothing else in the scripts reaches out but the clone, `ssh -T` and what the installer does;
  - the tests.
- [ ] **Step 2: Add the two sentences.** sallies-laptop.md: "Moving her laptop from brimm-video to Studio is done with the Move to Studio app (`docs/setup/move-to-studio-app.md`), which runs checks 41, 42 and 44 for you." README: "Moving it from brimm-video to Studio: the Move to Studio app, `docs/setup/move-to-studio-app.md`."
- [ ] **Step 3: Run the whole suite.** Expected: PASS (`tool/tests/contract.test.js` untouched).
- [ ] **Step 4: Commit** `Studio move app: its doc, and where the setup guide and README point to it`.

## After the tasks (the coordinator, not an implementer)

1. Review the whole branch, then run the whole suite.
2. The trial on the Mac Studio, nothing installed:
   - Make a temporary home in the scratchpad holding a made-up laptop: settings for Sallie's laptop, a made-up BRIMM Video with an empty `Drop/Sallie's laptop`, and an old checkout from `git archive brimm-video-v1 tool`.
   - Run `HOME=<that> zsh tool/move-app/move.zsh --print --commit <HEAD>`.
   - Add a local clone there, its origin set to `STUDIO_URL`, and print again, so the clone's real `install.sh --print` runs.
   - Then an unsigned `--any-commit` build into the scratchpad, and `spctl --assess --type execute -vv` of a copy given a quarantine mark. Nothing is launched.
3. Add the steps to the By-Hand page, to run only on Jason's yes:
   - the signing setup;
   - the build and the notarizing, after the merge;
   - carrying the app over and opening it;
   - the app's way for checks 41, 42, 44 and 48's key, with the Terminal steps kept as the fallback;
   - the report back by AirDrop.
4. Push, and open a draft pull request linking the page. Nothing is merged.
