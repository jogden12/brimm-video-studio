# Her folder's lock, loosened: K1, the open lock (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the open lock for her folder for Claude (a never list; the gated places, held by Claude Code's sandbox, by deny rules and by a guard that compares paths by identity; chats that hold a session's words kept to today's lock; the card's receipt; `edit.js`'s own sandbox check), behind a per-Mac `lock` setting that stays `strict` everywhere until Jason turns it on after the by-hand round.

**Architecture:** `settings.js studio` writes her folder in one of two shapes: strict (today's, byte for byte) or open (sandbox on, deny rules, the guard, a receipt hook, memory off). The guard (`tool/studio/guard.mjs`) reads this Mac's lock in effect (`effectiveLock`: open only when the settings say so and `OPEN_LOCK_CLAUDE` is set): strict runs today's `guardDecision`; open runs the shared lock check (`tool/loosened.js`) and the held-chat check (`tool/held.js`, reading transcripts a little at a time through `tool/scan.js`), falls back to today's decision when either says so (a held chat to the commands a session runs, R29), and otherwise asks the new `openDecision` (`tool/open-lock.js`). `edit.js` marks a chat that is shown a session's words, hands those words over by a file only that chat's Read reaches, checks a receipt before `kind` answers a waiting video, refuses inside the sandbox, and opens and reveals copies named by id; every one of these but the mark only on an open-lock Mac.

**Tech Stack:** Node 22 ES modules, `node:test`, no packages; the zsh installer; macOS `ps`, `lsof`, `plutil`, Finder (`open -R`), always through stand-ins in tests.

**Spec:** `docs/superpowers/specs/2026-10-26-brimm-video-lock-loosened-design.md` (sections 1, 2, 5, 6, 7, 8, 10, 11; K1 only, not K2, K3 or S), with `docs/superpowers/notes/2026-10-26-lock-k0-findings.md`. Executors read both.

## Global Constraints

- Node 22 or later, no packages. `cd tool && node --test` passes after every task. A failing test first, then the code.
- No test calls the real `claude`, OpenRouter, `security`, `osascript`, `ps`, `lsof`, WebKit, or `install.sh` without `--print`. `ps` and `lsof` are always stand-ins (functions in `deps` or `ctx`), never an environment variable a sandboxed command could set. No test reads this Mac's real settings, managed settings or temp folder: every world gives a made-up home, `tmp`, `managedDir`, `managedPrefs` and `user`.
- **The strict lock is the default everywhere.** The lock in effect is open only when this Mac's settings say `lock: "open"` and `OPEN_LOCK_CLAUDE` (R2) is set: `effectiveLock(settings, minimum = OPEN_LOCK_CLAUDE)` (Task 6), the one test every part uses (`settings.js studio`, `studioStale`, the lock check, the guard, the words files, the receipt, the reveals and the installer's print). A Mac with no `lock` setting, one that cannot be read, or one whose settings say open while `OPEN_LOCK_CLAUDE` is null, is strict: today's settings, today's guard, PR #40's `behind`. Merging K1 changes nothing on either Mac until Jason runs `node tool/settings.js studio --node <node> --lock open`, which refuses, writing nothing, while `OPEN_LOCK_CLAUDE` is null.
- A chat's id (`session_id`, `CLAUDE_CODE_SESSION_ID`) is put into a file or folder name only when it matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` (`SESSION_ID`, Task 13), and the path made from it is checked to be inside the folder meant. One that does not match holds the chat (the guard) or ends the command with `MARK_FAILED` (`edit.js`).
- Never read a `.env` file or a key. Nothing is installed and no launch agent changed without Jason's yes; `install.sh` only with `--print` in tests. Experiments never write into a watched folder. Never push.
- Her skill (`tool/studio/SKILL.md`) stays under 160 lines and runs only commands `edit.js` has (`COMMAND_NAMES`).
- Nothing `edit.js`, the guard, `behind` or the receipt hook prints holds a file's contents, an environment variable's value, a gated video's file or folder name, or a client's name. Lines for Jason are in parentheses and end "Its contents are not shown here." (or "Its value is not shown here." for the environment), as PR #40's do.
- Everything `edit.js` writes into a place a sandboxed command can reach is created with `wx`. Marks, receipts, words files and the guard's cache are in Application Support, never the workshop or the temp folder.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Exact strings that must not drift (design): `LOCK_CHANGED` = "This folder's lock is changed on this Mac: ask Jason before going on."; `HELD_REFUSED` = "This chat holds a session's words, so it can only run brimm-video now. Start a new chat for anything else."; `SANDBOXED` = "brimm-video was run inside Claude Code's sandbox: ask Jason."; `UNTRUSTED` = "Claude Code has not trusted this folder yet: open it once and choose to trust it."; `cantOpen(label)` = `${label} can't be opened on this Mac without showing its file's name: ask Jason.`; `RUN_ALONE` begins "Run brimm-video's commands on their own"; `WRITE_REFUSED` = "Claude's own file tools do not write files here. Make a file in the workshop, ~/BRIMM Video Workshop, with a command, which runs in the sandbox."; `WORKSHOP_FILES_REFUSED` = "Claude's own file tools do not read the workshop. Read a file there with a command, which runs in the sandbox." (the last two decided by Jason, 2026-10-26).

## Review Focus

Seven inputs the design implies but no single test of its list exercises, most likely first. Each has its test in the task named.

1. **A held chat reading its own words file**, which happens at every teachings view, since the mark makes the chat held first. Expected: the guard answers `allow`, never `pass`: a pass leaves the Read to Claude Code, which asks a card for a file outside her folder, and that card's "add this folder" loosens the lock and its "always allow" writes `settings.local.json`. Task 19, "answers as today's guard does in a chat that holds a session's words, allowing it to read its own words with no card".
2. **A chat that ran a sandboxed `cd` into a folder inside hers** (`cd Pictures`). Claude Code keeps Bash's folder between calls and gives it as the hook's `cwd`, and `edit.js` runs in it. Expected: the session's folder is judged by its transcript's folder (`claudeDirName(folder)`) together with `cwd` being her folder or inside it (R30, confirmed by Jason, 2026-10-26), not by `cwd` alone, so the chat keeps the open lock and `behind` goes on. Task 19, "keeps the open lock for a chat that ran cd Pictures", and Task 13, "goes on for a chat whose commands run in a folder inside hers".
3. **A transcript still being written, or very large**, when it is scanned for the environment snapshot, its start and a held chat's message `uuid`s. Expected: the last, unfinished line and any line that does not parse are skipped, only bytes added since the last look are read, the scan starts again from 0 when the file shrinks or is another file, and nothing is wrongly let go. Task 13, "reads a transcript's environment snapshot a little at a time, and skips a line still being written", and Task 15, "reads only what a transcript added since the last look, and skips a line still being written".
4. **A fork looked at before the chat it was forked from was held.** Its shared `uuid`s lie before the scan's offset. Expected: a held chat's `uuid`s not yet checked against send the scan back to 0. Task 15, "holds a fork looked at before the chat it was forked from was held".
5. **A link in the workshop to a file**: to a held chat's transcript in `~/.claude/projects`, to another chat's words file, to `~/.zshrc`, or left dangling to `~/.zshenv` or into `Drop/`. The identity check sees only folders, and three gated places (`~/.claude`, the words folder, the app's data) have no `Read()` rule. Since a sandboxed loop can swap a folder in the workshop for a link between the guard's `lstat` and the tool acting on the path, and the guard cannot close that race, Claude's own file tools never act in the workshop (decided by Jason, 2026-10-26). Expected: Write and Edit refused for every path; Read, SendUserFile, Glob and Grep refused for any path inside the workshop, a link's real path judged too; a link in the workshop to a gated file refused as gated, for Read and SendUserFile. Task 4, "finds a gated file through a link to it", and Task 17, "refuses a link in the workshop to a gated file for Read and SendUserFile", "refuses Write and Edit for every path: in the workshop and out of it, through a link or not" and "refuses Read, SendUserFile, Glob and Grep for any path inside the workshop, a link's real path judged too".
6. **A label with an apostrophe, a slash, quotes, a colon or a leading dot**, in the words file's name, a revealed copy's name and the `Card:` JSON line. Expected: a safe file name in the chat's own folder, and JSON that parses back to the very label. Tasks 15, 22 and 24.
7. **Two guard calls at once** (a chat and its subagents) writing the lock check's cache. Expected: written whole (temporary name, then rename); a cache that is half written or not JSON is ignored and the check made again. Task 19, "ignores a cache another call is writing, or one that is not JSON".

Beside these, one condition of the test runner itself: the suite is often run from inside Claude Code, where `CLAUDECODE=1` and the app's secret-shaped names are in `process.env`. No test may take `process.env` for the chat's environment: the shared worlds give `env: {}` (Tasks 5 and 21), so a test marks nothing, runs no `ps` and is not loosened by the runner's own environment.

## Rulings

Where the design leaves a choice, or two parts of it pull apart, this plan decides as follows. Each is for Jason to overrule.

- **R1. Strict stays as it is.** `guardDecision`, the strict `settingsOf`, the strict `lockBroken` and PR #40's `lockLoosened` reasons are unchanged. Every new reason, refusal, file hand-over, receipt check and copy-by-id applies only where the lock in effect is open (`effectiveLock`, R2). Harmless exceptions, all failing closed, found by the whole-branch review: (1) the mark (R7): under Claude Code a command that says a session's words first writes a file marking the chat (edit.js `holdWords`, held.js `markChat`, about edit.js 496-512), and when that cannot be written it says MARK_FAILED, ends with 1 and shows no words; (2) after-all notes (R9): any read of a record writes the note of a session read as another kind and answered a session since (`noteSessionsAfterAll`, about 361-376), so more chats are held, never fewer; (3) `clearOldWords`: every command under Claude Code takes away the words files a day old (about 5880); (4) the `Card:` lines `episodes` and `kind` print (R10, about 730 and 4000); (5) a detached run's environment without `CLAUDECODE` (R8, detached.js about 219-232); (6) `tool/studio/guard.mjs` imports `open-lock.js`, so a strict Mac's guard hook also fails (and blocks the call) if that file cannot be loaded; (7) the real `install.sh --machine` gains a `lock_facts` step, which asks settings.js what lock its settings say, and exits 2, changing nothing, when it cannot read the answer. The sandbox check at the start of edit.js (`sandboxedWhy`) is the open lock's alone: a strict Mac never runs it and never asks `ps` (I1).
- **R2. `OPEN_LOCK_CLAUDE`, not an unset `GUARD_CLAUDE`.** `GUARD_CLAUDE` stays `2.1.295`, which the strict lock needs. A new `export const OPEN_LOCK_CLAUDE = null;` in `tool/studio.js` is the Claude Code version the by-hand round passed on. While it is null, `settings.js studio --lock open` refuses, writing nothing, and the lock in effect is strict on every Mac whatever its settings say: `effectiveLock(settings, minimum)` is `"open"` only when `lockOf(settings)` is open and `minimum` is set. So a settings file written open by hand, or one left open after `OPEN_LOCK_CLAUDE` is set back to null, gets the strict folder, the strict guard and the installer's strict line. Setting it is a one-line change after the by-hand round, on Jason's yes.
- **R3. What the by-hand round records is data in the checkout, and starts so that the open lock fails closed:** `tool/studio/app-flags.json` is `{"flags": []}` (every flag the app passes is outside the record, so every chat is loosened); `tool/studio/environment.json` has the design's `deny` names and `harmless: []`. The fixture of the Code tab's tool list is recorded from a Mac Studio session in Task 1, and replaced by by-hand item 9's.
- **R4. New, focused modules instead of a larger `studio.js`:** `never.js`, `places.js`, `chain.js`, `loosened.js`, `scan.js`, `held.js`, `fetchable.js`, `receipts.js`, `sandboxed.js`, `open-lock.js`, `reveal.js`. `lockLoosened` moves to `tool/loosened.js` (the design says `studio.js`); `edit.js` re-exports `LOCK_CHANGED`.
- **R5. `guardDecision` stays synchronous and strict;** the open decision is a new `async openDecision`, since WebFetch's look-up is asynchronous.
- **R6. `guide "<video>" tell` in the background (confirmed by Jason, 2026-10-26).** The design refuses `edit.js` with `run_in_background`, but her skill runs `guide … tell`, which waits up to 60 minutes, only that way. The open guard allows `run_in_background` for exactly `<node> "<checkout>/tool/edit.js" guide <WORD> tell` (an UNSCOPED command whose one line names a label; and in K1 a session's words are never command output) and refuses it for every other `edit.js` command.
- **R7. The mark is written under Claude Code (`CLAUDECODE=1`) on any Mac where her folder exists, strict or open,** so a Mac turned open later still holds the chats that were shown a session's words. Handing the words over by file is open-lock only. Chats from before K1 carry no mark (her unlocked chats of 25 Oct, and any chat PR #40's `principles`, `ideas` or `teachings` printed words into), and the Code tab can resume them. So when `settings.js studio` writes the open lock on a Mac whose folder was strict, it first writes an untied mark at that moment (`{ at, session: null, claude: null, tied: false }`), which holds every chat begun before it for good, and takes away the command output those chats left in her folder's own subfolder of Claude Code's temp folder (`<tmp>/claude-<uid>/<claudeDirName(folder)>/*/tasks/*.output`), which every open chat's sandbox may read.
- **R8. Which commands mark and hand over:** `teachings`, `principles`, `ideas`, `finish`, `reel` and `render` (SESSION_TAUGHT beyond SESSION, `tool/gate.js`), when the record found is a session not cleared, under Claude Code. A detached run (`read`, or a command `startDetached` launches with `--now`) prints to no chat, and is not under Claude Code: `spawnDetached` starts it with `CLAUDECODE` taken out of its environment. Which run is detached is never taken from the word `--now`, which Claude can type: a foreground `finish --now "<label>"` from a chat still has `CLAUDECODE=1`, and is marked and handed over like any other. Everything such a command says after its episode is found goes into the words file; the chat gets one line.
- **R9. A session after all** is noted by `kind` when it answers a video already answered as another kind as a session, with the time it does so; and on either Mac by `episodeAt` (which `episodes`, `status`, `guide`, `behind`'s lists and `findEpisode` all read records through), the first time it reads a record whose `session.emptyRevision` is set (the mark of a session after all) with no note for that id and that `emptyRevision`, with the time it saw it, which is later than the correction and so fails closed. Each note is a file of its own, `held/after-all-<id>-<emptyRevision>-<ms>.json`, made with `wx`, so two runs at once lose none and a second session after all of the same video is noted again; `chatHeld` takes the latest time for each id. A chat whose transcript began at or before such a time is held.
- **R10. The card in code.** `episodes` prints, under each waiting video, `    Card: <JSON>`, and `    Card if not a session: <JSON>` when its Came line says Zoom or sound alone; `kind` prints the same second line after `ASK_IF_SESSION`. `kind`, when it refuses a video with no kind for want of a receipt (`NO_RECEIPT`, Task 23), prints the card's lines after it, a video she left alone among them, whose listing in `episodes` stays as it is. The skill passes the JSON to `AskUserQuestion` as it is. The Zoom follow-up gains the label, so that a receipt names one video: "<label> came from Zoom, which is often a client or group session. Which is it?"; "<label> is sound alone, which is often a client or group session. Which is it?"; and, with neither known, "<label> may be a Zoom download or sound alone, which is often a client or group session. Which is it?".
- **R11. The receipt** takes the questions and option labels from `tool_response.questions` and the answers from `tool_response.answers` (an object keyed by question text), as 2.1.308's `AskUserQuestion` result is shaped; the fixture is replaced by by-hand item 10's recording. The receipt hook's args gain her folder (`[receipt.sh, node, folder]`), from which it finds the home folder (R25).
- **R12. Copies and reveals by id are open-lock only**, in `~/BRIMM Video Work/shown/<record id>/`; `behind` clears both the old `shown/` folders and the new.
- **R13. The workshop's name-only reader and its `wx` writer are built in K2**, with their first caller (`picture render`, `graphic add`). K1 makes the workshop, writes the settings that confine writes to it, and guards it, and the guard shuts Claude's own file tools out of it (decided by Jason, 2026-10-26, option b; Task 17): Write and Edit are refused for every path, and Read, SendUserFile, Glob and Grep for any path inside the workshop, a link's real path judged too, since a sandboxed loop can swap a folder there for a link between the guard's `lstat` and the tool acting on the path, and the guard cannot close that race. A file in the workshop is made and read with sandboxed commands (`printf`, `python3 -c`, `node -e` or `base64 -d` fed by a pipe; `cat`), since heredocs fail in the sandbox (C36). The settings have no `Edit(<workshop>/**)` allow rule and no `Edit()` or `Read()` deny for the workshop as a whole (Claude Code merges those into the sandbox's `denyWrite` and `denyRead`, C3, which would stop sandboxed commands using it); the four inner `Edit()` denies stay. Claude can no longer look at a picture it made there with Read, and SendUserFile cannot send a workshop file: K2 and K3 route pictures another way (copies opened and revealed by id, Task 24's reveal).
- **R14. Id-named arguments for child programs are not built:** they wait on K0's next round (`lsof -p`).
- **R15. The subagent tool** (`Agent` or `Task`) is allowed with no `subagent_type` or one of `general-purpose`, `Explore`, `Plan`; any other is refused. By-hand item 9 confirms the list.
- **R16. A per-Mac `tool` entry** may not name a never-list tool (`Workflow` is one, always: decided by Jason, 2026-10-26, since it runs scripts whose agent options the guard cannot see), `NotebookEdit` or `Monitor`; it may name the `Cron*` tools (`CronCreate`, `CronDelete`, `CronList`) and nothing else that is otherwise denied.
- **R17. The open shape is checked whole:** `lockBroken` (open) compares the whole of her folder's `.claude/settings.json`, as an object, with what this checkout writes for this Mac, for the node `settings.js studio` recorded in this Mac's settings (`studioNode`), never the node the file names. Any difference is "changed", not "out of date": a folder written by an older brimm-video, lacking a place gated since; a hook beyond the guard and the receipt (a `SessionStart` hook the `/hooks` menu wrote there overwrites the chat's id and `CLAUDE_PID`, C24); an `env`, `statusLine` or `enabledPlugins` key; and another program put consistently in place of node in the guard's args, the allow rule and the excluded command.
- **R18. The new lock-check reasons run only on an open-lock Mac.** On a strict Mac `behind` and the guard are PR #40's.
- **R19. Paths by identity:** each folder along a path is compared by (device, inode) with the gated places that are there; a gated place not there yet is compared by its text, both spellings, letter case folded. A path whose last part is there (by `lstat`) is judged by the folders of its real path too, so a link to a file inside a gated place is held, though the identity check sees only folders.
- **R20. `.env` files** are held by the guard (any path whose name is `.env` or starts with `.env.`), anywhere. The `Read(**/.env)` and `Read(**/.env.*)` deny rules are relative to the session's working folder in Claude Code's rule syntax, so they cover her folder only; outside it the guard alone holds Claude's file tools. The sandbox's `denyRead` gets no pattern for them (whether it takes globs is not known), so a sandboxed `cat` of a `.env` outside the listed secret folders is not held: listed below as unbuildable now.
- **R21. A plugin "carrying hooks or a mod"** is a plugin folder holding `hooks/hooks.json`, or a `.claude-plugin/plugin.json` with a `hooks` or `mods` key. Enabled means `enabledPlugins["<name>@<marketplace>"] === true` in any settings source, and every plugin under `~/.claude/plugins/synced/*/` counts as enabled. The mod marker is the by-hand round's to confirm.
- **R22. A named skill's folders:** `<her folder>/.claude/skills/<name>`, `~/.claude/skills/<name>`, `~/.claude/plugins/cache/*/*/*/skills/<name>` and `~/.claude/plugins/synced/*/*/skills/<name>`. Where the app keeps an account-synced skill (theme-factory) is by-hand item 9's.
- **R23. Wording in K1 (section 8):** `docs/requirements.md` gets the heading with Jason's words, the lock bullet without "and pictures from OpenRouter" (K3 adds those words, the "Kept" line and this repo's `CLAUDE.md` lines), a line under "Decisions" and a change line. This repo's `CLAUDE.md` is unchanged in K1.
- **R24. Question 5:** the installer prints her user settings' `Read()` deny rules, and writes them only with a new `--user-deny` flag, through a new `node tool/settings.js user-deny`, which adds them to `~/.claude/settings.json` and keeps everything else there.
- **R25. The guard and the receipt hook take the home folder as the folder above her folder,** the path written into their args by `settings.js studio`, never from `HOME`. Tests then give a made-up folder and home.
- **R26. Process facts:** one `/bin/ps -A -ww -o pid=,ppid=,lstart=,args=` per check, run with `env: { LC_ALL: "C" }` so that `lstart` is the 24 letters the table reads in any locale; the parent `claude` is the first process up the chain whose executable's name is `claude`; its arguments are split at each " --". Finding no `claude` above is Jason's own run only when the caller is not under Claude Code: in the guard, and in `behind` with `CLAUDECODE=1`, it is a loosened line (a renamed binary, or Claude Code run as `node …/cli.js`, has flags and a version nobody checked). While `OPEN_LOCK_CLAUDE` is set, a `claude` whose version cannot be read from its path is loosened too.
- **R27. A transcript's start** is the earliest `timestamp` of any of its complete lines, kept as a running least value by the scan (a transcript's first line often has none: `mode`, `ai-title`, `custom-title`; a fork's copied lines keep the parent's times). A transcript with no timestamp at all, while any untied mark or session-after-all time exists, holds the chat; so does one that cannot be read while any mark or session-after-all time exists. The scan (Task 13's `tool/scan.js`) starts again from 0 when the file is smaller than its stored offset or its inode has changed.
- **R28. The card's version answers** ("A new version of <name>", "A finished version of <name>") use `shownName` of the Maybe line's video, as `cardLines` prints it.
- **R29. A held chat runs only the commands a session runs (confirmed by Jason, 2026-10-26).** The design gives a held chat all of today's lock, and today's lock allows every `edit.js` command; under the open lock that leaves a channel: a held chat with a session's key phrases in its context could write them, as free text, into a record other chats read (`name` of an ordinary episode, `title … --words`, `text … --line`, `spell … add`, `cut … --words`), and an unheld chat could read them back through `episodes` or `status` and send them out. So in a held chat the guard allows only `edit.js` commands whose first word is in `UNSCOPED` or `SESSION_TAUGHT` (`tool/gate.js`) but `name` and `read`: `episodes`, `status`, `behind`, `retry`, `guide`, `kind`, `leave`, `which`, `show`, `release`, `resolve`, `teachings`, `principles`, `ideas`, `finish`, `reel`, `render`. Any other gets `HELD_NARROWED` = "This chat holds a session's words, so it can't do that here. Start a new chat for it." A background run is not refused in a held chat: her skill runs `guide … tell` so, in the very chats that finish a session, and an instruction planted in its output could ask only for the commands above.
- **R30. The session's folder, on an open-lock Mac, is judged by its transcript and by its folder together, not by `cwd` alone (confirmed by Jason, 2026-10-26: her chat is judged by where its transcript is kept and by its folder being hers or inside it).** Under the open lock a sandboxed `cd Pictures` is allowed, Claude Code keeps Bash's folder between calls and gives it as the hook's `cwd`, and `edit.js` then runs in it; PR #40's check would then refuse every later call, and the fallback guard would refuse the `cd` back. So on an open-lock Mac the session is in her folder when its transcript lies in her folder's projects folder **and** its folder is her folder or inside it: in the guard, `basename(dirname(input.transcript_path)) === claudeDirName(folder)` and `input.cwd` is `folder` or starts with `folder + "/"`; in `behind` under Claude Code, the transcript `<projects>/<claudeDirName(folder)>/<CLAUDE_CODE_SESSION_ID>.jsonl` exists (`<projects>` is `$CLAUDE_CONFIG_DIR/projects` when that is set, else `~/.claude/projects`) and the command's folder (`deps.cwd || process.cwd()`) is her folder or inside it. The transcript alone is not enough: Claude Code's name for a folder makes every sign but a letter or a digit a dash, so a chat started in another folder whose name comes out the same (`~/BRIMM-Video-Studio`) keeps its transcript in her projects folder too. A chat started in `Pictures` keeps its transcript in `Pictures`' projects folder, so PR #40's line still says so. For a chat that is hers, `input.cwd` is kept only for resolving relative paths. Jason's own run in Terminal, and every strict Mac, keep PR #40's `cwd`.

## Not built in K1, and what the design leaves unbuildable now

- Waiting on the by-hand round (the design's last list): the record of her chat's flags (item 2), the harmless environment names (item 4), her laptop's node path (item 3), her folder's name in the temp folder (computed here by Claude Code's rule, confirmed there), the subagent tool's name and built-in agents (item 9), the `AskUserQuestion` result's exact shape (item 10), where the app keeps account-synced skills and what marks a mod (item 9), and whether her trust is kept in `~/.claude.json` as `hasTrustDialogAccepted` (item 1; if the Code tab keeps it for the session only, the untrusted line is taken out). Until each is recorded, the code reads data that fails closed.
- Waiting on K0's next round: id-named arguments (`lsof -p`); the recent lists, preferences and logs found holding names, to add to the gated places; whether `sandbox.network.httpProxyPort` and `socksProxyPort` remove the proxy login and `credentials.envVars` takes names away (K1 writes both; the web tools stay held until Jason runs `--web open`); whether the sandbox's `denyRead` takes a `.env` glob (R20).
- Later phases: `picture render`, `brimm-graphics`, `graphic add` and `logo` from the workshop, the workshop's name-only reader (K2); `picture make`, `settings.js pictures`, the repo `CLAUDE.md` and the rest of `requirements.md` (K3); the session drop folder (S). The guard's refusal of `picture` in a held chat is built now (one line), so K3 cannot forget it.
- Departures from the design, confirmed by Jason on 2026-10-26: R6 (`guide … tell` in the background); R29 (a held chat runs only the commands a session runs, narrower than the design's "what today's lock allows"); R30 (on an open-lock Mac, PR #40's folder check judges her chat by where its transcript is kept and by its folder being hers or inside it, not by the folder alone).
- Decided, with a check by hand (Jason, 2026-10-26): the chat's own command-output (`tasks`) folder in Claude Code's temp folder is no Read carve-out. The sandbox may write the temp folder (C11), which would give the same swap race as the workshop's on the guard's Read of it. So a Read of it is refused as a gated place, and a command's saved output is read with `cat` or `head`, which the sandbox's `allowRead` lets through. The by-hand round confirms that the temp folder Claude Code uses for sandboxed commands is the folder the guard treats as gated.
- Not decided, for the by-hand round or K0's next round (Jason, 2026-10-26): a way to make heredocs work inside the sandbox (C36), which would make the workshop's commands-only rule less clumsy.

## File Structure

| File | Responsibility |
|---|---|
| `tool/never.js` (new) | The never list: tools by name, MCP servers by kind, posting words, the subagent's limits; the settings' deny entries for it |
| `tool/studio/never.json` (new) | The never list's data: exact tool names, and the local MCP servers seen in the Code tab |
| `tool/places.js` (new) | The gated places for a Mac, both spellings, what Bash may read, and the identity check of paths in any tool input |
| `tool/chain.js` (new) | The process table from `ps`, the chain up from a process, the `claude` above it, its flags and version |
| `tool/loosened.js` (new; from `edit.js`) | The one lock check `behind` and the guard make: PR #40's reasons, and on an open-lock Mac the new ones; the untrusted line |
| `tool/scan.js` (new) | A transcript read a little at a time: its start, its latest environment snapshot and, for `held.js`, a held chat's message `uuid`s; the scan files in `AS/BRIMM Video/held/`; `SESSION_ID` |
| `tool/held.js` (new) | Marks, sessions after all, which chats are held, forks, and the words files |
| `tool/fetchable.js` (new) | Whether WebFetch may reach a URL: numeric, local and privately answering hosts refused |
| `tool/receipts.js` (new) | The card's fixed forms, the receipt the hook writes, and `kind`'s check of it |
| `tool/sandboxed.js` (new) | `edit.js`'s own check that it is not in the sandbox |
| `tool/open-lock.js` (new) | `openDecision` (the open guard's steps) and `guardAnswer` (what the hook script runs, with the lock check, the held check and the cache) |
| `tool/reveal.js` (new) | Copies named by id, and Finder reveals of copies, on an open-lock Mac |
| `tool/studio.js` | The strict and open settings, `lockBroken` for both, the files of her folder, the workshop, `OPEN_LOCK_CLAUDE`; today's `guardDecision` kept |
| `tool/studio/guard.mjs`, `guard.sh` | The PreToolUse hook: strict or `guardAnswer` |
| `tool/studio/receipt.mjs`, `receipt.sh` (new) | The PostToolUse hook on `AskUserQuestion` |
| `tool/studio/allow.json`, `environment.json`, `app-flags.json` (new) | Default allowlist; the app's secret names and the harmless names; the record of her chat's flags |
| `tool/studio/CLAUDE-open.md` (new); `SKILL.md` | Her folder's `CLAUDE.md` under the open lock; her skill's new lines |
| `tool/settings.js` | `lock`, `web`, `zoomFolder`, `studioAllow`, `proxyPort`; `studio`'s new options; `user-deny` |
| `tool/edit.js` | Uses `loosened.js`; marks and words files; Card lines; receipts in `kind`; sessions after all; copies by id; the sandbox check at its entry |
| `tool/finish.js` | Its three reveals go through `reveal.js` |
| `tool/install.sh` | The lock this Mac gets, the open lock's lines, `--user-deny` |
| `tool/tests/open-world.js` (new) | A made-up open-lock Mac for tests: home, root, folder, workshop, temp folder, managed folders, ps text, transcripts |
| `tool/tests/guard-cases.js` (new; from `studio.test.js`) | `CHECKOUT`, `NODE`, `EDIT` and `ALLOWED`, which `studio.test.js` and `guard-open.test.js` both import |
| `tool/tests/fixtures/code-tab-tools.json` (new) | The Code tab's tool names, recorded on the Mac Studio |
| `docs/setup/sallies-laptop.md`, `README.md`, `docs/requirements.md` | Step 9 for the open lock, Jason's steps, the rows, the decision |

---

### Task 0: Bring main in

**Files:** none of its own.

- [ ] **Step 1: Merge main.** `cd "/Users/jasonogden/Claude Code/BRIMM video/.claude/worktrees/lock-loosened" && git fetch -q origin && git merge origin/main` (main has PR #40 at 7aaa110). Expected: a merge commit with no conflicts (this branch holds only docs).
- [ ] **Step 2: Run the suite.** `cd tool && node --test`. Expected: every test passes, 0 fail. This is the baseline; the merge commit is the commit.

---

### Task 1: The never list

**Files:**
- Create: `tool/never.js`, `tool/studio/never.json`, `tool/tests/never.test.js`, `tool/tests/fixtures/code-tab-tools.json`

**Interfaces:**
- Produces:
  - `NEVER_WORDS: string[]` = `["send","post","publish","share","schedule","upload","forward","reply","invite","delete","trash","remove","deploy","submit","comment","respond"]` (`respond` keeps the calendar connector's `respond_to_event` refused, which can invite other people: decided by Jason, 2026-10-26)
  - `BUILT_IN_AGENTS: string[]` = `["general-purpose","Explore","Plan"]` (R15)
  - `DRAWING: string[]` = `["mcp__visualize__show_widget","mcp__visualize__read_me"]`
  - `isConnector(name: string): boolean`: `/^mcp__[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}__/`
  - `isLocalExtension(name: string): boolean`: an `mcp__<server>__` tool that is not a connector's and not `mcp__visualize__`
  - `neverCaught(name: string, input?: object): boolean`
  - `neverDenyRules(allowed?: {type,name}[]): string[]`: the settings' deny entries: `never.json`'s tools, `mcp__<server>__*` for each of its servers, each of its `connectorTools` by its exact name (the design's "the posting tools by name": a connector's family cannot be denied whole, since a deny beats the allow a named tool of it may get), and `CronCreate`, `CronDelete`, `CronList` unless `allowed` names them as `tool` (`Workflow` is among `never.json`'s `tools`, so always denied: decided by Jason, 2026-10-26)

- [ ] **Step 1: Record the fixture.** In a Code-tab session on the Mac Studio, write every tool name the session lists (its tool list and its deferred-tool list), names only, sorted, as `{"recorded": "2026-10-26, Mac Studio, the Claude app's Claude Code (Code tab)", "tools": [...]}`. Add `Agent`, `Task`, `AskUserQuestion`, `TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` if a subagent's list lacks them (a chat has them). By-hand item 9 replaces it with her laptop's.
- [ ] **Step 2: Write `never.json`.** `tools`: `Artifact`, `ArtifactComments`, `ArtifactData`, `RemoteTrigger`, `EnterWorktree`, `ExitWorktree`, `SearchPlugins`, `SuggestPluginInstall`, `SuggestSkills`, `SendMessage`, `DesignSync`, `NotebookEdit`, `Monitor`, `Workflow`. `servers`: every MCP server in the fixture that `isLocalExtension` takes (`computer-use`, `Claude_Browser`, `claude-in-chrome`, `Control_Chrome`, `playwright`, `terminal`, `PDF_Tools`, `plugin_pdf-viewer_pdf`, `knowledge-mcp`, each `ccd_*`, `scheduled-tasks`, `mcp-registry`, and the rest the fixture holds). `connectorTools`: every connector tool of the fixture (`isConnector`) that `neverCaught` catches by its words, by its exact name, sorted (for example `mcp__4e8268a7-b354-4c23-ab7d-2076f0dc3000__opusclip_create_post_task`). A connector added later is held by the guard alone until the fixture and this list are recorded again.
- [ ] **Step 3: Write the failing tests** in `tool/tests/never.test.js`:

```js
it("refuses by name every tool the design puts on the never list", () => {
  for (const name of ["Artifact","ArtifactComments","ArtifactData","RemoteTrigger","EnterWorktree","ExitWorktree","SearchPlugins","SuggestPluginInstall","SuggestSkills","SendMessage","DesignSync","NotebookEdit","Monitor","Workflow"]) assert.equal(neverCaught(name), true, name);
});
it("refuses the screen, the browser, the terminal, every local extension and every tool of the app's own, by kind, and never the drawing tools", () => {
  for (const name of ["mcp__computer-use__screenshot","mcp__Claude_Browser__navigate","mcp__claude-in-chrome__navigate","mcp__Control_Chrome__open_url","mcp__playwright__browser_click","mcp__terminal__run_in_terminal","mcp__PDF_Tools__fill_pdf","mcp__plugin_pdf-viewer_pdf__display_pdf","mcp__knowledge-mcp__kb_search","mcp__ccd_host__reveal_path","mcp__ccd_directory__change_directory","mcp__ccd_session__start_session","mcp__ccd_session_mgmt__send_message","mcp__ccd_settings__set_setting","mcp__ccd_connectors__reconnect_session_connector","mcp__scheduled-tasks__create_scheduled_task","mcp__mcp-registry__search_mcp_registry","mcp__a_server_added_later__anything"]) assert.equal(neverCaught(name), true, name);
  for (const name of DRAWING) assert.equal(neverCaught(name), false, name);
});
it("catches by word any connector tool that posts, sends, shares, schedules, uploads or deletes, a made-up one included", () => {
  const c = "mcp__4e8268a7-b354-4c23-ab7d-2076f0dc3000__";
  for (const tool of ["opusclip_create_post_task","opusclip_schedule_publish","opusclip_unschedule_publish","opusclip_share_project","opusclip_create_upload_link"]) assert.equal(neverCaught(c + tool), true, tool);
  assert.equal(neverCaught("mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__send_invoice"), true);
  assert.equal(neverCaught(c + "opusclip_list_clips"), false);
});
it("refuses the calendar connector's respond_to_event by its word, and does not catch create_event and update_event, which stay refused because no per-Mac entry names them", () => {
  const cal = "mcp__fc13441e-97cf-4f22-a919-82c76dc951e0__";
  assert.equal(neverCaught(cal + "respond_to_event"), true);
  for (const tool of ["create_event", "update_event"]) assert.equal(neverCaught(cal + tool), false, tool);  // Task 16: NOT_NAMED unless Jason names one in a per-Mac mcp-tool entry
});
it("refuses the subagent tool sent elsewhere or of another kind, under either of its names", () => {
  for (const name of ["Agent","Task"]) {
    for (const input of [{ isolation: "remote" }, { isolation: "worktree" }, { cwd: "/tmp" }, { subagent_type: "code-review:reviewer" }]) assert.equal(neverCaught(name, input), true, `${name} ${JSON.stringify(input)}`);
    for (const input of [{}, { subagent_type: "general-purpose" }, { subagent_type: "Explore" }]) assert.equal(neverCaught(name, input), false);
  }
});
it("refuses a Bash call that asks to run outside the sandbox", () => {
  assert.equal(neverCaught("Bash", { command: "date", dangerouslyDisableSandbox: true }), true);
  assert.equal(neverCaught("Bash", { command: "date" }), false);
});
it("runs its rule over the Code tab's real tool list, and lists what it catches", (t) => {
  const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
  for (const must of ["Bash","Read","Write","Edit","WebFetch","WebSearch","SendUserFile","PushNotification","Skill", ...DRAWING]) assert.ok(tools.includes(must), must);
  assert.ok(tools.some((n) => n.startsWith("mcp__ccd_")));
  const caught = tools.filter((n) => neverCaught(n));
  for (const open of ["Bash","Read","Write","Edit","WebFetch","WebSearch","SendUserFile","PushNotification","Skill", ...DRAWING]) assert.ok(!caught.includes(open), open);
  for (const n of tools.filter((n) => /opusclip_(create_post_task|schedule_publish|share_project|create_upload_link)$/.test(n))) assert.ok(caught.includes(n), n);
  t.diagnostic(caught.join("\n"));
});
it("denies in the settings every local MCP server of the fixture and the never tools by name, never the drawing tools, and never all of mcp__", () => {
  const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
  const rules = neverDenyRules();
  for (const server of new Set(tools.filter(isLocalExtension).map((n) => n.split("__")[1]))) assert.ok(rules.includes(`mcp__${server}__*`), server);
  assert.ok(!rules.some((r) => r.startsWith("mcp__visualize__")) && !rules.includes("mcp__*"));
  assert.ok(rules.includes("CronCreate") && !neverDenyRules([{ type: "tool", name: "CronCreate" }]).includes("CronCreate"));
  assert.ok(rules.includes("Workflow") && neverDenyRules([{ type: "tool", name: "Workflow" }]).includes("Workflow"));  // Workflow is on the never list, always
});
it("denies in the settings, by its exact name, every connector tool of the fixture that the never list's words catch, and no other connector tool", () => {
  const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
  const rules = neverDenyRules();
  const posting = tools.filter((n) => isConnector(n) && neverCaught(n));
  assert.ok(posting.length > 0);
  for (const n of posting) assert.ok(rules.includes(n), n);
  for (const n of tools.filter((n) => isConnector(n) && !neverCaught(n))) assert.ok(!rules.includes(n), n);
  assert.ok(!rules.some((r) => isConnector(r) && r.endsWith("*")));
});
```

- [ ] **Step 4: Run them to see them fail.** `cd tool && node --test tests/never.test.js`. Expected: FAIL, `never.js` not found.
- [ ] **Step 5: Implement `tool/never.js`.** A tool's own name (after `mcp__<server>__`) is matched against `NEVER_WORDS` as a case-insensitive substring (stricter is closed). `neverCaught` also takes `Agent`/`Task` with `isolation` or `cwd` present, or `subagent_type` present and not in `BUILT_IN_AGENTS`, and `Bash` with a truthy `dangerouslyDisableSandbox`.
- [ ] **Step 6: Run them to see them pass.** Same command. Expected: PASS.
- [ ] **Step 7: Commit.** `git add tool/never.js tool/studio/never.json tool/tests/never.test.js tool/tests/fixtures/code-tab-tools.json && git commit -m "The open lock, task 1: the never list, by name, by kind and by word, over the Code tab's real tool list"` (with the co-author line).

---

### Task 2: This Mac's lock settings

**Files:**
- Modify: `tool/settings.js` (`settingsFault`, `show`, new exports)
- Test: `tool/tests/settings.test.js`

**Interfaces:**
- Consumes: `isConnector`, `neverCaught` (Task 1).
- Produces (`tool/settings.js`):
  - `lockOf(s): "strict"|"open"` (only `s.lock === "open"` is open; what the settings say, not the lock in effect, which is Task 6's `effectiveLock`); `webOf(s): "held"|"open"`; `zoomFolderOf(s, home): string` (default `join(home, "Documents", "Zoom")`); `studioAllowOf(s): {type,name}[]` (default `[]`); `proxyPortOf(s): number|null`; `studioNodeOf(s): string|null` (the node `settings.js studio` last wrote her folder with, R17)
  - `settingsFault` accepts optional `lock`, `web`, `zoomFolder`, `studioAllow`, `proxyPort`, `studioNode` (a whole path)

- [ ] **Step 1: Write the failing tests:**

```js
it("keeps the lock strict, the web tools held and Zoom's folder in Documents when the settings say nothing", () => {
  assert.deepEqual([lockOf({}), lockOf({ lock: "open" }), lockOf(undefined), webOf({}), webOf({ web: "open" })], ["strict", "open", "strict", "held", "open"]);
  assert.equal(zoomFolderOf({}, "/Users/sallie"), "/Users/sallie/Documents/Zoom");
});
it("refuses a lock, a web setting, a Zoom folder, a proxy port or a node that will not do", () => {
  for (const [more, why] of [[{ lock: "loose" }, 'the lock must be "strict" or "open"'], [{ web: "on" }, 'the web tools must be "held" or "open"'], [{ zoomFolder: "Zoom" }, "the Zoom folder is not a whole path"], [{ proxyPort: 80 }, "the proxy port must be a whole number from 1024 to 65535"], [{ proxyPort: 47123.5 }, "the proxy port must be a whole number from 1024 to 65535"], [{ studioNode: "node" }, "the node her folder was written with is not a whole path"]])
    assert.equal(settingsFault({ ...good, ...more }), why);
});
it("keeps an entry her folder allows only when it is typed and exact, and never one on the never list", () => {
  const WHY = "an entry her folder allows must be a skill by its name, a connector's tool by its exact name, or a tool the never list does not hold";
  const id = "mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__";
  for (const ok of [{ type: "skill", name: "theme-factory" }, { type: "mcp-tool", name: id + "list_designs" }, { type: "tool", name: "CronCreate" }]) assert.equal(settingsFault({ ...good, studioAllow: [ok] }), "");
  for (const bad of [{ type: "skill", name: "../x" }, { type: "mcp-tool", name: "mcp__PDF_Tools__fill_pdf" }, { type: "mcp-tool", name: id + "*" }, { type: "mcp-tool", name: id + "send_invoice" }, { type: "tool", name: "Monitor" }, { type: "tool", name: "NotebookEdit" }, { type: "tool", name: "Workflow" }, { type: "tool", name: "Artifact" }, { type: "plugin", name: "x" }, "brimm-edit"])
    assert.equal(settingsFault({ ...good, studioAllow: [bad] }), WHY, JSON.stringify(bad));
});
it("shows the lock, the web tools, Zoom's folder, the entries allowed and the proxy port, each only when it is set", () => {
  // show on settings { lock: "open", web: "held", zoomFolder: "<home>/Zoom recordings", proxyPort: 47123, studioAllow: [{type:"skill",name:"theme-factory"}] }
  // said lines end, after today's lines, with exactly:
  //   "  Her folder's lock:  open", "  The web tools:  held", "  Zoom's recordings:  <home>/Zoom recordings",
  //   "  Also allowed in her folder:  skill theme-factory", "  Her folder's proxy port:  47123"
  // and show on settings with none of them set says today's lines only (settings.test.js's exact show tests stay as they are)
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test --test-name-pattern="lock strict|web setting|her folder allows|proxy port" tests/settings.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the six readers and the checks in `settingsFault`, in the order the test lists them, after `sessionTeachings`. A skill name is `/^[a-z0-9][a-z0-9-]*$/`; an `mcp-tool` is `isConnector(name)` with no `*` and `!neverCaught(name)`; a `tool` is not `mcp__`-prefixed, not `*`, and `!neverCaught(name)`. `show` says each new line only when its field is in the file, as it does `import` and `readings`, and after the Teachings line: `settings.test.js`'s whole-output `show` tests (`:394-403`, `:696-712`, the Teachings line last) then pass unchanged. `studioNode` is not shown.
- [ ] **Step 4: Run them to see them pass.** Then `cd tool && node --test`. Expected: all PASS.
- [ ] **Step 5: Commit.** `"The open lock, task 2: this Mac's lock, web, Zoom folder, allowed entries and proxy port, strict and held by default"`.

---

### Task 3: The gated places

**Files:**
- Create: `tool/places.js`, `tool/tests/places.test.js`

**Interfaces:**
- Produces (`tool/places.js`):
  - `claudeDirName(path: string): string` = `path.replace(/[^A-Za-z0-9]/g, "-")` (Claude Code's name for a folder under `~/.claude/projects` and the temp folder)
  - `realOf(path: string): string`: the real path of the nearest folder that is there, with the rest of the path after it
  - `bothSpellings(path: string): [string, string]` = `[path, "/System/Volumes/Data" + path]`
  - `gatedPlaces({ home, root, uid, tmp = "/private/tmp", folder, zoomFolder }): Place[]`, `Place = { path: string, readRules: string[], kind: "folder"|"file", carve?: "claude"|"tmp"|"app"|"words" }`
  - `readAllowed({ home, root, uid, tmp = "/private/tmp", folder }): string[]`: the sandbox's `allowRead`, and nothing else. The guard's index opens `BV/Assets` alone (Task 19): the guard's carve-outs are each call's own (Task 17), never all of her folder's temp subfolder, which holds every chat's command output (C36).
  - `isEnvFile(path): boolean` (name `.env` or starting `.env.`)

`tmp` is Claude Code's temp folder, `CLAUDE_CODE_TMPDIR` or `/tmp`, as `guardDecision` takes it, by its real path; a test gives a made-up one and never writes into Claude Code's real temp folder. The places, all by `realOf` (`BV` = root; `DB` = the first folder above `BV` holding `.dropbox.cache`, when one does; `AS` = `home/Library/Application Support`):

| Place | `readRules` |
|---|---|
| `BV` | `BV/Drop`, `BV/Episodes`, `BV/Unedited Video` |
| `dirname(BV)/BRIMM VIDEO Transfer`, `zoomFolder`, `home/Movies/Final Cut Backups`, `home/BRIMM Video Work`, `AS/BRIMM Video` | itself |
| `AS/BRIMM Video Words` (carve `words`), `home/.claude` (carve `claude`), `<tmp>/claude-<uid>` (carve `tmp`) | none |
| `AS/Claude` (carve `app`), `home/.claude.json`, `AS/com.apple.sharedfilelist`, `home/Library/Preferences/com.apple.finder.plist`, `home/.dropbox`, `AS/Dropbox`, `DB/.dropbox.cache`, `home/Library/Group Containers/G7HH3F8CAK.com.getdropbox.dropbox.sync`, `home/Library/Containers/com.getdropbox.dropbox.fileprovider`, `….TransferExtension`, `….garcon`, `home/Library/Logs/brimm-video.log`, `home/Library/Logs/brimm-video-claude-check.log`, `home/.ssh`, `home/Library/Keychains`, `home/.aws`, `home/.config`, `home/.netrc`, `home/.git-credentials`, `home/.npmrc` | itself (none for `AS/Claude`, which Claude Code reads its own program from) |

`readAllowed` = `[BV/Assets, <tmp>/claude-<uid>/<claudeDirName(folder)>, home/.claude/shell-snapshots, AS/Claude/claude-code]`.

- [ ] **Step 1: Write the failing tests** (a made-up home `<dir>/Sallie's home`, root `<dir>/Dropbox (Personal)/The BRIMM DB/BRIMM Video`, `.dropbox.cache` in `<dir>/Dropbox (Personal)`, and a made-up temp folder `<dir>/tmp`, `<dir>` being the test's `mkdtemp`):

```js
it("lists every gated place of the design by its real path, for a home and root with spaces and an apostrophe", () => {
  const paths = gatedPlaces(w).map((p) => p.path);
  for (const want of [w.root, join(dirname(w.root), "BRIMM VIDEO Transfer"), join(w.home, "Documents", "Zoom"), join(w.home, "Movies", "Final Cut Backups"), /* …every row above… */ join(w.home, ".npmrc")]) assert.ok(paths.includes(realOf(want)), want);
  assert.deepEqual(gatedPlaces(w).find((p) => p.path === realOf(w.root)).readRules, ["Drop", "Episodes", "Unedited Video"].map((n) => join(realOf(w.root), n)));
});
it("finds a place through a link by its real path, as ~/Movies is a link into Dropbox on the Mac Studio", () => { /* home/Movies → <tmp>/Dropbox (Personal)/Movies; the backups place is <real Dropbox>/Movies/Final Cut Backups */ });
it("names her folder's own temp folder as Claude Code does", () => {
  assert.equal(claudeDirName("/Users/sallie/BRIMM Video Studio"), "-Users-sallie-BRIMM-Video-Studio");
  assert.equal(claudeDirName("/Users/o'neil/BRIMM Video Studio"), "-Users-o-neil-BRIMM-Video-Studio");
});
it("lets Bash read Assets and the three places Bash needs, and no other", () => { assert.deepEqual(readAllowed(w), [/* the four, in order, the temp one under w.tmp */]); });
it("finds Claude Code's temp folder under the temp folder it is given, never /private/tmp in a test", () => {
  assert.ok(gatedPlaces(w).some((p) => p.carve === "tmp" && p.path === realOf(join(w.tmp, `claude-${w.uid}`))));
  assert.ok(!gatedPlaces(w).some((p) => p.path.startsWith("/private/tmp/")));
});
it("spells each place a second way, under /System/Volumes/Data", () => { assert.deepEqual(bothSpellings("/Users/s/x"), ["/Users/s/x", "/System/Volumes/Data/Users/s/x"]); });
it("leaves out Dropbox's cache folder when no folder above BRIMM Video holds one", () => {});
it("knows a .env file by its name", () => { for (const p of ["/a/.env", "/a/.env.local"]) assert.ok(isEnvFile(p)); assert.ok(!isEnvFile("/a/env.txt")); });
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/places.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the exports. `realOf` walks up to the nearest folder that is there and takes its `realpathSync.native`. The test helper (Task 5's `tests/open-world.js`) is not needed yet: build the made-up home inline.
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 3: the gated places, by their real paths, and what Bash may read"`.

---

### Task 4: Paths by what they are

**Files:**
- Modify: `tool/places.js`
- Test: `tool/tests/places.test.js`

**Interfaces:**
- Consumes: `gatedPlaces`, `realOf`, `bothSpellings` (Task 3).
- Produces:
  - `gatedIndex(places: Place[], open: string[]): { at(path: string): Place|null, holds(dir: string): boolean }`. `at` walks the path's folders, following links, with `statSync`, and gives the gated place one of whose (dev, ino) it meets, unless it meets an `open` folder's first (Assets, a carve-out); a place not there is matched by its text, both spellings, letter case folded (R19); a path whose name `isEnvFile` is a gated place of its own. When the path's last part is there (`lstatSync`), `at` also walks the folders of `realpathSync(path)`, and of the link's target text when it dangles, and gives a place either walk meets, the stricter: a link to a file inside a gated folder (`~/.claude/projects/<dir>/<id>.jsonl`, `<words>/<other id>/x.txt`) is held, though the identity check sees only folders. `holds(dir)`: some gated place lies inside `dir` (its parents walked for `dir`'s identity).
  - `pathsIn(input: unknown, cwd: string, home: string): string[]`: every string, at any depth of objects and arrays, that is absolute, starts with `~`, holds `..`, or names something there from `cwd`; each resolved (`~` to `home`, relative to `cwd`).
  - `searchRoot(tool: string, input: object, cwd: string, home: string): string|null`: for Glob and Grep, kept for a later version: Glob's literal start of an absolute, `~/` or `..` pattern, before `path`; otherwise `path`, otherwise `cwd`.

- [ ] **Step 1: Write the failing tests:**

```js
const notAMac = process.platform !== "darwin" && "/System/Volumes/Data and letter case are a Mac's";
it("finds a gated place by any spelling: .., a link into it, a file not there yet", () => {
  const ix = gatedIndex(gatedPlaces(w), readAllowed(w));
  for (const p of [join(w.root, "Episodes", "x", "t.txt"), join(w.root, "Assets", "..", "Episodes"), join(w.home, "Documents", "link-to-episodes", "t.txt"), join(w.root, "Episodes", "not-yet", "new.txt")]) assert.ok(ix.at(p), p);
  assert.equal(ix.at(join(w.home, "Documents", "notes.txt")), null);
});
it("finds one by /System/Volumes/Data and by changed letter case", { skip: notAMac }, () => {});
it("finds a gated file through a link to it, from an open folder or the workshop, dangling or not", () => {
  // links in the workshop and in Assets: to <home>/.claude/projects/<dir>/<id>.jsonl, to <words>/<other id>/x.txt,
  // to <root>/Episodes/x/t.txt, and a dangling one to <root>/Drop/<Mac>/x.mov: each at() is that place, not null
  // a link to <home>/Documents/notes.txt: null
});
it("lets a path inside Assets through, and not a link from Assets into Episodes", () => {});
it("lets a path in a carve-out through only when that carve-out is among those open", () => {});
it("holds a gated place that is not there yet by its text, both spellings, any letter case", () => {
  // Zoom's folder is not made; "<home>/documents/ZOOM/x.m4a" and "/System/Volumes/Data<home>/Documents/Zoom" are held.
});
it("holds a .env file anywhere", () => {});
it("takes every path-like string from any field, nested, and nothing else", () => {
  writeFileSync(join(w.cwd, "notes.txt"), "x");
  assert.deepEqual(pathsIn({ file_path: "~/x", nested: { list: ["../y", "plain words", "/abs", "notes.txt"] }, url: "https://a.b/c", n: 3 }, w.cwd, w.home).sort(), [join(w.home, "x"), resolve(w.cwd, "../y"), "/abs", join(w.cwd, "notes.txt")].sort());
});
it("says a search folder holds a gated place when one is inside it", () => {
  // Zoom's folder, <home>/Documents/Zoom, is gated, so Documents holds one; Pictures holds none.
  assert.ok(ix.holds(w.home)); assert.ok(ix.holds(join(w.home, "Documents"))); assert.ok(!ix.holds(join(w.home, "Pictures")));
});
it("takes Glob's folder from the literal start of an absolute or ~/ pattern, before path", () => {
  assert.equal(searchRoot("Glob", { pattern: `${w.root}/Ep*/**`, path: "/tmp" }, w.cwd, w.home), w.root);
  assert.equal(searchRoot("Glob", { pattern: "~/Lib*/x" }, w.cwd, w.home), w.home);
  assert.equal(searchRoot("Glob", { pattern: "**/*.md", path: "/tmp" }, w.cwd, w.home), "/tmp");
  assert.equal(searchRoot("Grep", {}, w.cwd, w.home), w.cwd);
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/places.test.js`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** `gatedIndex`, `pathsIn` and `searchRoot`. The identities are taken once when the index is made.
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 4: paths compared by what they are, in any field of a tool's input"`.

---

### Task 5: The open settings

**Files:**
- Modify: `tool/studio.js`
- Create: `tool/studio/allow.json`, `tool/studio/environment.json`, `tool/studio/app-flags.json`, `tool/studio/CLAUDE-open.md`, `tool/tests/open-world.js`, `tool/tests/studio-open.test.js`

**Interfaces:**
- Consumes: `neverDenyRules` (Task 1); `gatedPlaces`, `readAllowed`, `bothSpellings`, `realOf` (Task 3).
- Produces (`tool/studio.js`):
  - `OPEN_LOCK_CLAUDE = null` (R2)
  - `workshopFolder(home) = join(home, "BRIMM Video Workshop")`
  - `ALLOW_DEFAULT`, from `allow.json`: `[{type:"skill",name:"brimm-edit"},{type:"skill",name:"brimm-graphics"},{type:"skill",name:"frontend-design"},{type:"skill",name:"theme-factory"},{type:"tool",name:"mcp__visualize__show_widget"},{type:"tool",name:"mcp__visualize__read_me"},{type:"tool",name:"PushNotification"}]`
  - `ENVIRONMENT`, from `environment.json`: `{ deny: ["CLAUDE_CODE_MESSAGING_TOKEN","CLAUDE_CODE_MESSAGING_SOCKET","CLAUDE_CODE_USER_EMAIL","CLAUDE_CODE_ACCOUNT_UUID","CLAUDE_CODE_ORGANIZATION_UUID","SSH_AUTH_SOCK","ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_OAUTH_TOKEN","CLAUDE_CODE_OAUTH_REFRESH_TOKEN","CLAUDE_CODE_ARTIFACTS_API_TOKEN","CLAUDE_CODE_MEMORY_API_TOKEN","CLAUDE_CODE_SLACK_TAG_TOKEN","ANTHROPIC_IDENTITY_TOKEN", …the rest of the binary's list (design C27)], harmless: [] }`
  - `APP_FLAGS`, from `app-flags.json`: `{ flags: [] }` (R3)
  - `Facts = { home, root, uid, tmp, zoomFolder, port, web: "held"|"open", allow: {type,name}[] }` (allow is `ALLOW_DEFAULT` plus this Mac's; `tmp` is Claude Code's temp folder, `process.env.CLAUDE_CODE_TMPDIR || "/tmp"` by its real path, given by a test)
  - `studioFiles({ checkout, node, folder, lock = "strict", facts })`; `writeStudio(home, { checkout, node, lock = "strict", facts })` (open also makes the workshop, mode 0700); both strict exactly as today when `lock` is strict
  - `openSettingsOf({ checkout, node, folder, facts }): object`, exported for `lockBroken` (Task 7)
- Produces (`tool/tests/open-world.js`): `openWorld(): { dir, home, root, checkout, node, folder, workshop, uid, tmp, port: 47123, facts, cwd }` (a made-up Mac with an apostrophe in the home, a made-up temp folder `<dir>/tmp`, an open-lock per-Mac settings file with `studioNode`, and her folder written open); `psText(rows: [pid, ppid, args][]): string`; `chatChain({ claude = 700, args }): string` (node 900 ← zsh 800 ← claude 700 ← launchd 1); `APP_ARGS(folder, home): string`; `RECORD = { flags: ["--output-format","--input-format","--verbose","--model","--effort","--resume","--permission-prompt-tool","--permission-mode","--allow-dangerously-skip-permissions","--allowedTools","--disallowedTools","--settings","--add-dir","--project-config-root","--setting-sources"] }`; `transcript(dir, lines): string`; `openDeps(w, more = {})` = `{ home: w.home, cwd: w.folder, env: {}, pid: 900, tmp: w.tmp, managedDir: join(w.dir, "managed"), managedPrefs: join(w.dir, "managed-preferences"), user: "sallie", ps: () => chatChain({ args: APP_ARGS(w.folder, w.home) }), lsof: () => "", appFlags: RECORD, minimum: "2.1.308", ...more }`, which every open-lock test gives, so that no real `ps`, `lsof` or `plutil` runs, `chainUp` starts from the stand-in chain's node, this Mac's real managed settings and temp folder are never read, and the runner's own environment is never read. (`minimum` is set, since with none the lock in effect is strict; a test of the strict fallback gives `minimum: null`.)

The open settings (design section 7's outline, made exact; `W` = workshop, `F` = her folder, `R(p)` = `` `Read(/${p}/**)` `` for a folder and `` `Read(/${p})` `` for a file, `E(p)` = `` `Edit(/${p}/**)` ``, each in both spellings):

```
permissions.defaultMode "default", disableBypassPermissionsMode "disable", disableAutoMode "disable"
permissions.allow  [`Bash(${node} "${checkout}/tool/edit.js" *)`, …"WebFetch","WebSearch" only when facts.web is "open"]
permissions.deny   [...neverDenyRules(facts.allow), ...R(every readRule), "Read(**/.env)", "Read(**/.env.*)" (her folder only, R20),
                    ...E(F, checkout, BV, Transfer, Work, AS/BRIMM Video, AS/BRIMM Video Words, AS/Claude, home/Library/LaunchAgents, home/.claude, home/.ssh),
                    `Edit(/${W}/**/.claude/**)`, `Edit(/${W}/**/CLAUDE.md)`, `Edit(/${W}/**/CLAUDE.local.md)`, `Edit(/${W}/**/.mcp.json)`]
sandbox            { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false,
                     excludedCommands: [`${node} "${checkout}/tool/edit.js" *`],
                     network: { deniedDomains: ["*"], httpProxyPort: port, socksProxyPort: port },
                     filesystem: { allowWrite: [W], denyWrite: [...both(F), ...both(AS/Claude)], denyRead: [...both(every place's path)], allowRead: readAllowed({ ...facts, folder: F }) },
                     credentials: { envVars: ENVIRONMENT.deny.map((name) => ({ name, mode: "deny" })) } }
autoMemoryEnabled false, autoDreamEnabled false, disableSkillShellExecution true, disableAllHooks false
hooks.PreToolUse   [today's guard entry, args [`${checkout}/tool/studio/guard.sh`, node, F]]
hooks.PostToolUse  [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "/bin/sh", args: [`${checkout}/tool/studio/receipt.sh`, node, F] }] }]
```

No `permissions.additionalDirectories`. **No `Edit(/${W}/**)` allow rule, and no `Edit()` or `Read()` deny rule for the workshop as a whole (decided by Jason, 2026-10-26):** Claude Code merges `Edit()` allow rules into the sandbox's `allowWrite` and `Edit()` and `Read()` deny rules into `denyWrite` and `denyRead` (C3), so a deny of the whole workshop would stop sandboxed commands using it. They write there by `sandbox.filesystem.allowWrite: [W]` alone, and Claude's own file tools never act there: the guard refuses them (Task 17). Only the four inner `Edit()` denies are the workshop's. `CLAUDE-open.md` is written in Task 26; here it holds one placeholder line so the file exists, and Task 26's test pins its words.

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio-open.test.js` (all on `openWorld()`):

```js
it("writes the strict shape exactly as today when the lock is strict", () => { /* deepEqual with today's expected permissions, disableAllHooks, hooks; no sandbox key */ });
it("writes the sandbox on, failing when it cannot start, with edit.js its one door, no network and no proxy login", () => {
  const s = open();
  assert.deepEqual([s.sandbox.enabled, s.sandbox.failIfUnavailable, s.sandbox.allowUnsandboxedCommands], [true, true, false]);
  assert.deepEqual(s.sandbox.excludedCommands, [`${w.node} "${w.checkout}/tool/edit.js" *`]);
  assert.deepEqual(s.sandbox.network, { deniedDomains: ["*"], httpProxyPort: 47123, socksProxyPort: 47123 });
});
it("denies every gated place to Read and to sandboxed commands, by its real path and its /System/Volumes/Data spelling", () => {});
it("lets sandboxed commands read Assets and the three places Bash needs, and no other", () => {});
it("keeps ~/.claude.json, the app's data and the words folder from sandboxed commands, with no Read() rule for ~/.claude or the words folder", () => {});
it("lets sandboxed commands write only the workshop, and never her folder or the app's data", () => {});
it("denies Edit() in her folder, the checkout, BRIMM Video, the app's data and every place only brimm-video writes, and, in the workshop, only its CLAUDE.md, CLAUDE.local.md, .mcp.json and .claude", () => {});
it("has no Edit() allow rule, and no Edit() or Read() rule for the workshop as a whole, so that sandboxed commands write there by allowWrite alone", () => {
  const s = open();
  assert.ok(!s.permissions.allow.some((r) => r.startsWith("Edit(")));
  assert.deepEqual(s.sandbox.filesystem.allowWrite, [w.workshop]);
  assert.ok(![`Edit(/${w.workshop}/**)`, `Edit(/${w.workshop})`, `Read(/${w.workshop}/**)`, `Read(/${w.workshop})`].some((r) => s.permissions.deny.includes(r) || s.permissions.allow.includes(r)));
});
it("takes every listed name of the app's environment from sandboxed commands, the binary's own list among them, and never the chat's id or pid", () => {
  const names = open().sandbox.credentials.envVars;
  for (const n of ["CLAUDE_CODE_MESSAGING_TOKEN","CLAUDE_CODE_MESSAGING_SOCKET","CLAUDE_CODE_USER_EMAIL","CLAUDE_CODE_ACCOUNT_UUID","CLAUDE_CODE_ORGANIZATION_UUID","SSH_AUTH_SOCK","ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_OAUTH_TOKEN","CLAUDE_CODE_OAUTH_REFRESH_TOKEN","CLAUDE_CODE_ARTIFACTS_API_TOKEN","CLAUDE_CODE_MEMORY_API_TOKEN","CLAUDE_CODE_SLACK_TAG_TOKEN","ANTHROPIC_IDENTITY_TOKEN"]) assert.ok(names.some((e) => e.name === n && e.mode === "deny"), n);
  assert.ok(!names.some((e) => ["CLAUDE_CODE_SESSION_ID", "CLAUDE_PID"].includes(e.name)));
});
it("turns Claude Code's memory off, and a skill's shell lines", () => {});
it("has no WebFetch or WebSearch allow rule while the web tools are held, and both once they are opened", () => {});
it("never denies the drawing tools, and denies Monitor and NotebookEdit", () => {});
it("denies Workflow always, and the Cron tools unless this Mac allows them", () => {});
it("runs the guard before every call and the receipt hook after every card, each given her folder", () => {});
it("makes the workshop on this Mac's own disk, readable by her alone, and never adds it to the session", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/studio-open.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `openSettingsOf` and the `lock` and `facts` parameters; the three data files; the test helper.
- [ ] **Step 4: Run them, then the whole suite, to see them pass.** `cd tool && node --test`.
- [ ] **Step 5: Commit.** `"The open lock, task 5: her folder's open settings: the sandbox, the deny rules, the app's secrets, memory off, the receipt hook"`.

---

### Task 6: `settings.js studio` for both locks

**Files:**
- Modify: `tool/settings.js` (`studio`, `settingsMain`, `HELP`)
- Test: `tool/tests/settings.test.js`

**Interfaces:**
- Consumes: Task 2's readers; `studioFiles`, `writeStudio`, `OPEN_LOCK_CLAUDE`, `ALLOW_DEFAULT` (Task 5).
- Produces: `settingsMain(argv, { home, say, clone, now, openMinimum = OPEN_LOCK_CLAUDE, freePort })`; `node settings.js studio --node <node> [--lock strict|open] [--web held|open] [--zoom "<folder>"] [--allow skill|mcp-tool|tool <name>]… [--print]`; `factsOf(home, settings): Facts` (exported; Tasks 10 to 19 use it); `effectiveLock(settings, minimum = OPEN_LOCK_CLAUDE): "strict"|"open"` (exported; open only when `lockOf(settings)` is open and `minimum` is set, R2; every task after this one asks it, never `lockOf`, for the lock in effect).

Behaviour: first, `--lock open` while `openMinimum` is null says `Not changed: the open lock waits for the checks by hand in the Code tab (the design's "By hand before K1 ships"). Her folder keeps the strict lock.` and ends with 1, before anything is written (unless `--print`). Then the options given are written into this Mac's settings (by `writeSettings`, so `settingsFault` refuses a bad one and nothing is written), `--allow` appended to `studioAllow` once; with the lock in effect open, `studioNode` set to the `--node` given (R17; a strict write leaves this Mac's settings as today's tests read them), and with no `proxyPort`, one is picked once by `freePort()` (default: listen on 127.0.0.1 port 0, read the port, close) and stored. Then the folder is written with `effectiveLock(settings, openMinimum)`, never `lockOf` alone: a settings file that says open, by hand or from before `OPEN_LOCK_CLAUDE` was set back to null, gets the strict folder. `--print` says the `settings.json` her folder would get, as JSON, and writes nothing at all, for the by-hand round's scratch copy; it is allowed with `--lock open` whatever `openMinimum` is. It ends `Written: <folder>` for the strict lock, as today (`settings.test.js:364` passes unchanged), or `Written: <folder> (the open lock)`.

- [ ] **Step 1: Write the failing tests:**

```js
it("writes her folder with the strict lock unless this Mac's settings say open", () => {});
it("writes the strict folder for settings that say open while no Claude Code is named for the open lock", () => {
  // settings { lock: "open" } written by hand; openMinimum null; studio --node NODE → 0, said [`Written: ${folder}`],
  // the folder's settings are studioFiles strict, no workshop; effectiveLock({ lock: "open" }, null) is "strict"
});
it("refuses the open lock, writing nothing, until the Claude Code it was checked on is named", () => {
  assert.equal(t.asked("studio", "--node", NODE, "--lock", "open", "--web", "open", "--zoom", join(t.home, "Zoom")), 1);
  assert.equal(t.said.at(-1), 'Not changed: the open lock waits for the checks by hand in the Code tab (the design\'s "By hand before K1 ships"). Her folder keeps the strict lock.');
  const s = readSettings(t.home).settings;
  assert.deepEqual([s.lock, s.web, s.zoomFolder, s.studioNode], [undefined, undefined, undefined, undefined]); assert.equal(existsSync(workshopFolder(t.home)), false);
});
it("writes the open lock, the workshop and a proxy port picked once, when the minimum is named", () => {
  // openMinimum "2.1.308", freePort stub → 47123; a second run does not call it again; the folder's settings are studioFiles(open) for factsOf(home, settings);
  // studioNode is the --node given; said ends `Written: ${folder} (the open lock)`
});
it("keeps the web tools held until told --web open, and adds an allowed entry once, by its type and exact name", () => {});
it("prints the folder's settings for a lock without writing anything", () => {});
it("refuses a studio line that will not do", () => { /* today's cases, and --lock maybe, --allow skill with no name, --allow mcp-tool mcp__PDF_Tools__fill_pdf (settingsFault's words), --zoom Zoom */ });
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test --test-name-pattern="studio" tests/settings.test.js`.
- [ ] **Step 3: Implement.** The option parser takes `--node` first and the rest in any order; any other word is the help, with 2.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 6: settings.js studio writes either lock, refuses the open one until its Claude Code is named, and prints without writing"`.

---

### Task 7: `lockBroken` for the open lock

**Files:**
- Modify: `tool/studio.js` (`lockBroken`)
- Test: `tool/tests/studio-open.test.js`

**Interfaces:**
- Consumes: `openSettingsOf` (Task 5).
- Produces: `lockBroken(settings, { checkout, folder, lock = "strict", facts, node }): string[]`. Strict: today's keys, `node` not looked at. Open: the whole object is compared with `openSettingsOf({ checkout, node, folder, facts })`, `node` being this Mac's `studioNode` (R17), never the node the file names; each part that differs is named: today's `hooks`, `guard`, `bypass`, `auto`, and `"sandbox"` (`settings.sandbox` not deep-equal to the expected), `"permissions"` (the whole `permissions` object not deep-equal: `allow`, `deny`, `defaultMode`, any `additionalDirectories`), `"memory"` (`autoMemoryEnabled` or `autoDreamEnabled` not `false`), `"skill-shell"` (`disableSkillShellExecution` not `true`), `"receipt"` (the `PostToolUse` entries not as written), `"other-hooks"` (any `hooks` event but `PreToolUse` and `PostToolUse`, or any entry beside the guard's and the receipt's), and `"other"` (any top-level key the open shape does not write, such as `env`, `statusLine`, `enabledPlugins` or `apiKeyHelper`, or one of its other keys changed). With no `node` (this Mac's settings name no `studioNode`), it is `["node"]` alone.

- [ ] **Step 1: Write the failing tests:**

```js
it("finds nothing broken in the open shape it writes, for the node this Mac recorded", () => {});
it("says the guard, the allow rule and the excluded command are changed when another program stands in node's place in all three", () => {
  // the file written for w.node with every w.node replaced by "<workshop>/x"; lockBroken(…, { node: w.node }) holds "guard", "permissions" and "sandbox"
});
it("names a SessionStart hook, another hook beside the guard, an env, a statusLine or an enabledPlugins key in her folder's own settings", () => {
  // hooks.SessionStart → "other-hooks"; a second PreToolUse entry → "other-hooks"; env / statusLine / enabledPlugins → "other"
});
it("says the node is not known when this Mac's settings name none", () => {});
it("names each part of the open shape that is changed", () => {
  for (const [change, key] of [[(s) => { s.sandbox.enabled = false; }, "sandbox"], [(s) => s.sandbox.filesystem.denyRead.pop(), "sandbox"], [(s) => s.sandbox.filesystem.allowRead.push("/Users"), "sandbox"], [(s) => s.sandbox.excludedCommands.push("python3 *"), "sandbox"], [(s) => s.sandbox.credentials.envVars.pop(), "sandbox"], [(s) => { s.sandbox.network.allowUnixSockets = ["/x"]; }, "sandbox"], [(s) => { s.sandbox.network.socksProxyPort = 1; }, "sandbox"], [(s) => s.permissions.deny.splice(s.permissions.deny.findIndex((r) => r.startsWith("Read(")), 1), "permissions"], [(s) => s.permissions.deny.push("mcp__visualize__*"), "permissions"], [(s) => s.permissions.allow.push("WebFetch"), "permissions"], [(s) => s.permissions.allow.push(`Edit(/${w.workshop}/**)`), "permissions"], [(s) => { s.permissions.additionalDirectories = ["/x"]; }, "permissions"], [(s) => { s.autoMemoryEnabled = true; }, "memory"], [(s) => { s.disableSkillShellExecution = false; }, "skill-shell"], [(s) => { delete s.hooks.PostToolUse; }, "receipt"]]) {
    const s = open(); change(s); assert.deepEqual(lockBroken(s, { ...where, lock: "open", node: w.node }), [key]);
  }
});
it("keeps the strict lock's check as it was", () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 7: lockBroken checks her folder's open settings whole, for the node this Mac recorded"`.

---

### Task 8: The process chain

**Files:**
- Create: `tool/chain.js`, `tool/tests/chain.test.js`

**Interfaces:**
- Produces (`tool/chain.js`):
  - `PS_ARGS = ["-A", "-ww", "-o", "pid=,ppid=,lstart=,args="]`
  - `readProcesses(spawn = spawnSync): string|null` (`/bin/ps` with `PS_ARGS` and `{ env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 }`, so `lstart` is 24 letters in any locale; null on any error or non-zero exit)
  - `processTable(text: string): Map<number, Proc>`, `Proc = { pid: number, ppid: number, start: string, args: string }` (`lstart` is 24 letters)
  - `chainUp(table, pid: number): Proc[]` (that process first; stops at pid 1, at a pid not listed, and at a loop)
  - `claudeAbove(chain: Proc[]): Proc|null` (the first whose executable's base name is `claude`; the executable is the args before the first " --")
  - `argsOf(args: string): { exe: string, flags: { name: string, value: string|null }[] }` (split at each " --"; `--a=b` and `--a b` both give value `b`)
  - `appVersionOf(exe: string): string|null` (`/\/claude-code\/(\d+(?:\.\d+)+)\//`)

- [ ] **Step 1: Write the failing tests:**

```js
it("reads ps's table, a start time of 24 letters and arguments with spaces", () => {});
it("walks up to the first claude above, from edit.js (node, zsh, claude) and from the guard (node, sh, claude)", () => {});
it("finds no claude above Jason's own run in Terminal", () => {});
it("splits the app's arguments at each ' --', keeping a value with spaces whole", () => {
  const a = argsOf(`/Users/s/Library/Application Support/Claude/claude-code/2.1.308/claude --output-format stream-json --settings {"a":1} --add-dir=/Users/s/Library/Application Support/Claude/side-session-notes/abc --setting-sources=user,project,local --resume 1234`);
  assert.equal(a.exe, "/Users/s/Library/Application Support/Claude/claude-code/2.1.308/claude");
  assert.deepEqual(a.flags.map((f) => [f.name, f.value]), [["--output-format","stream-json"],["--settings",'{"a":1}'],["--add-dir","/Users/s/Library/Application Support/Claude/side-session-notes/abc"],["--setting-sources","user,project,local"],["--resume","1234"]]);
});
it("reads the app's copy's version from its path, and none from another claude", () => {});
it("stops at a loop and at a process ps does not list", () => {});
it("gives null when ps cannot be run, exits with an error, or is refused", () => {});
it("runs ps with LC_ALL=C and nothing else in its environment", () => {
  // a stand-in spawn records its arguments: ["/bin/ps", PS_ARGS, { env: { LC_ALL: "C" }, … }]
});
it("gives no row for a line whose start time is not 24 letters, rather than a wrong one", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/chain.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 8: the process chain up to a chat's claude, and its flags"`.

---

### Task 9: The shared lock check, moved

**Files:**
- Create: `tool/loosened.js`, `tool/tests/loosened.test.js`
- Modify: `tool/edit.js` (remove `lockLoosened`, `prefsObject`, `settingsObject`, `MANAGED_DIR`, `MANAGED_PREFS`, `PREFS_FILE`, `LOCK_CHANGED`; import them; `export { LOCK_CHANGED } from "./loosened.js"`)
- Modify: `tool/tests/edit-show.test.js` and `tool/tests/studio.test.js`, the four checks that read the moved code from `edit.js`'s source, pointed at `../loosened.js`: `edit-show.test.js:584` (`const MANAGED_DIR = …`), `:699` (`(deps.cwd || process.cwd())`), `:763-765` (`MANAGED_PREFS`, `deps.user || userInfo().username`), and `studio.test.js:485`, whose regex becomes `/\nexport function lockLoosened\(/` (line numbers at origin/main 7aaa110)

**Interfaces:**
- Produces (`tool/loosened.js`): `LOCK_CHANGED`; `lockLoosened({ home, checkout, deps = {} }): string[]` (PR #40's lines, in PR #40's order); `settingsObject(file)`; `sources({ home, deps }): [label: string, settings: object|null][]` (the user settings, then each managed file, managed preferences and the server-managed settings, labelled as PR #40's lines name them).

- [ ] **Step 1: Write the failing test:** `it("is the check behind makes: a settings.local.json in her folder gives PR #40's line, and nothing loosened gives none")`, calling `lockLoosened` from `../loosened.js`.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Move the code.** Nothing in it changes but its home. Point the four source checks above at `../loosened.js` (`readFileSync(new URL("../loosened.js", import.meta.url), "utf8")`, and `source("loosened.js")` in `studio.test.js`); nothing else in either test file changes. `studio.js`'s comment at its top still names `lockLoosened` and `behind`, as `studio.test.js:483-484` reads it.
- [ ] **Step 4: Run the whole suite.** `cd tool && node --test`. Expected: every PR #40 test in `tests/edit-show.test.js` passes, the four source checks reading `loosened.js`, and no other line of it changed.
- [ ] **Step 5: Commit.** `"The open lock, task 9: PR #40's lock check moves to loosened.js, unchanged"`.

---

### Task 10: The open check, I: settings sources and her folder's open shape

**Files:**
- Modify: `tool/loosened.js`, `tool/edit.js` (`studioStale`)
- Create: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `lockBroken` (Task 7), `factsOf`, `effectiveLock`, `studioNodeOf` (Tasks 2, 6), `sources` (Task 9), `openWorld` (Task 5).
- Produces:
  - `lockLoosened` reads this Mac's settings (`deps.settings`, else `readSettings(home)`) and the lock in effect, `effectiveLock(settings, deps.minimum ?? OPEN_LOCK_CLAUDE)`; on a strict Mac it is as before (R18). On an open Mac it adds, after PR #40's lines, the lines below, and gives `lockBroken` this Mac's `studioNode` (R17). `deps` gains `appSettings: object|null` (Task 13 fills it from the app's `--settings`).
  - `studioStale(ctx)` compares her folder with `studioFiles({ checkout, node, folder, lock: effectiveLock(ctx.settings, ctx.deps.minimum ?? OPEN_LOCK_CLAUDE), facts: factsOf(ctx.home, ctx.settings) })`, not always the strict shape: otherwise every `behind` on an open-lock Mac says "Her folder for Claude is out of date", which the command it names cannot clear, since it writes the same open folder again. On a strict Mac it is today's (`edit-show.test.js:206-224` pass unchanged).
  - `sourceWhy(label: string, settings: object): string[]`.
  - `NARROWING`: `sandbox.filesystem.denyRead`, `sandbox.filesystem.denyWrite`, and `sandbox.credentials.envVars` entries whose `mode` is `"deny"`.

Lines (`L` is the source's label: `this Mac's ~/.claude/settings.json` or `$CLAUDE_CONFIG_DIR/settings.json`, `this Mac's managed settings, <file>`, `the Claude app's --settings for this chat`):

| Reason | Line |
|---|---|
| Any `sandbox` key path but `NARROWING` (one line per path, sorted; a key under `network`, `filesystem` or `credentials` named with its parent; any key a later version adds) | `(Jason: ${L}: sandbox.${path}, which can open her folder's lock. Its contents are not shown here.)` |
| A `permissions.allow` entry starting `Edit(` | `(Jason: ${L}: an Edit( allow rule, which lets sandboxed commands write there. Its contents are not shown here.)` |
| A `permissions.deny` entry starting `WebFetch(domain:` | `(Jason: ${L}: a WebFetch(domain:…) deny rule, which brings the sandbox's proxy login back. Its contents are not shown here.)` |
| `autoMemoryEnabled` or `autoDreamEnabled` true | `(Jason: ${L}: ${key} true, which turns Claude Code's memory on. Its contents are not shown here.)` |
| `env.CLAUDE_CODE_DISABLE_AUTO_MEMORY` set to a false value (`0`, `false`, `no`, `off`, empty; any case) | `(Jason: ${L}: env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, which turns Claude Code's memory on. Its contents are not shown here.)` |
| Any `permissions.additionalDirectories` | `(Jason: ${L}: permissions.additionalDirectories, which adds folders to every session. Its contents are not shown here.)` |
| Her folder's own settings, `lockBroken` open keys beyond PR #40's | `(Jason: her folder's .claude/settings.json no longer holds the open lock as this brimm-video writes it: ${parts}. Its contents are not shown here.)`, `parts` from `{ sandbox: "the sandbox's settings", permissions: "the allow and deny rules", memory: "memory off", "skill-shell": "skills' shell lines off", receipt: "the card's receipt hook", "other-hooks": "a hook beside the guard and the receipt", other: "settings brimm-video does not write there", node: "the node it was written with (this Mac's settings name none)" }`, joined with ", " |

- [ ] **Step 1: Write the failing tests** (each through `behind` on `openWorld()`, git a stand-in, `ps` and `lsof` stand-ins from the helper so no real one runs; `SECRET` in every value):

```js
it("goes on when her folder holds the open lock as written and nothing else loosens it, and says nothing of it being out of date", async () => {
  // r.code 0; no line starts "Her folder for Claude is out of date"
});
it("says her open folder is out of date when its skill is older than this checkout's, and names the command that writes it again", async () => {});
it("refuses, naming the key and none of its values, for every sandbox key but the few that narrow, in the user, managed and --settings settings", async () => {
  for (const path of ["enabled","filesystem.disabled","allowAppleEvents","excludedCommands","filesystem.allowRead","filesystem.allowWrite","allowUnsandboxedCommands","enableWeakerNetworkIsolation","network.allowedDomains","network.deniedDomains","network.allowUnixSockets","network.allowAllUnixSockets","network.allowLocalBinding","network.allowMachLookup","network.httpProxyPort","network.socksProxyPort","aKeyALaterVersionAdds"])
    for (const where of ["user", "managed", "app"]) { /* r.text starts LOCK_CHANGED, holds the exact line, not SECRET; r.code 1; git not asked */ }
});
it("goes on for denyRead, denyWrite and envVars deny entries in those settings", async () => {});
it("refuses for an envVars entry of another mode, an Edit( allow rule, a WebFetch(domain:…) deny, memory turned on there, and added folders", async () => {});
it("says which part of her folder's own open settings is changed", async () => {});
it("is PR #40's check on a strict Mac, whatever the user settings' sandbox keys say", async () => {});
it("is PR #40's check, and the strict folder is not out of date, on a Mac whose settings say open while no Claude Code is named for the open lock", async () => {
  // openDeps(w, { minimum: null }); her folder written strict
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/behind-open.test.js`.
- [ ] **Step 3: Implement** `sourceWhy`, the open branch and `studioStale`'s lock.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 10: the lock check reads every settings source's sandbox keys, Edit( rules and memory keys, and her folder's open shape; behind knows the open folder is not out of date"`.

---

### Task 11: The open check, II: the environment, the proxy port, the workshop

**Files:**
- Modify: `tool/loosened.js`
- Test: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `ENVIRONMENT`, `workshopFolder` (Task 5), `proxyPortOf` (Task 2).
- Produces: `SECRET_WORDS = ["TOKEN","SECRET","PASSWORD","PASSWD","KEY","AUTH","COOKIE","CREDENTIAL","EMAIL","ACCOUNT","ORGANIZATION","SOCK"]`; `environmentWhy(env: object, list = ENVIRONMENT): string[]` (names only: no value is read into any line); `deps.env` (default `process.env`), `deps.lsof(port): string|null` (default runs `/usr/sbin/lsof -nP -iTCP:<port> -sTCP:LISTEN`), `deps.workshopLimit` (default 20000 entries).

| Reason | Line |
|---|---|
| `CLAUDE_CODE_POST_TURN_MEMORY` or `CLAUDE_CODE_MEMORY_API_TOKEN` present (checked first; not said again as a secret) | `(Jason: this chat's environment has ${name}, which sends Claude Code's memory to a server. Its value is not shown here.)` |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` set to a false value | `(Jason: this chat's environment turns Claude Code's memory on (CLAUDE_CODE_DISABLE_AUTO_MEMORY). Its value is not shown here.)` |
| A name holding a `SECRET_WORDS` word, in neither `deny` nor `harmless` | `(Jason: this chat's environment has ${name}, which looks like a secret and is not on brimm-video's list. Its value is not shown here.)` |
| `lsof` prints a line | `(Jason: something on this Mac listens on her folder's proxy port, ${port}.)` |
| `lsof` cannot run | `(Jason: whether anything listens on her folder's proxy port, ${port}, could not be checked.)` |
| A `.claude`, `CLAUDE.md`, `CLAUDE.local.md` or `.mcp.json` anywhere in the workshop, any letter case, links not followed | `(Jason: the workshop holds a .claude folder, a CLAUDE.md, a CLAUDE.local.md or a .mcp.json, which a session started there would take as its own.)` |
| More than `workshopLimit` entries | `(Jason: the workshop holds too much to look through for a .claude folder or a CLAUDE.md.)` |

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses for a secret-shaped name not on the list, naming it and never its value", async () => {});
it("goes on with only listed and harmless names, the chat's id and pid among them", async () => {
  // env { PATH, HOME, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s", CLAUDE_PID: "700", CLAUDE_CODE_MESSAGING_TOKEN: SECRET, SSH_AUTH_SOCK: SECRET }
});
it("refuses when the environment turns memory on, or holds the memory server's names, and goes on for CLAUDE_CODE_DISABLE_AUTO_MEMORY=1", async () => {});
it("refuses when something listens on the proxy port, or that cannot be checked", async () => {});
it("refuses for a .claude, CLAUDE.md, CLAUDE.local.md or .mcp.json anywhere in the workshop, in any letter case", async () => {});
it("leaves alone the .claude/.cc-writes folder Claude Code makes in her folder", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 11: the lock check reads the chat's environment by name, the proxy port and the workshop"`.

---

### Task 12: The open check, III: plugins, named skills, SessionStart hooks

**Files:**
- Modify: `tool/loosened.js`
- Test: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `sources` (Task 9), `ALLOW_DEFAULT`, `studioAllowOf`.
- Produces: `skillFolders({ home, folder, name }): string[]` (R22; the guard's Read carve-out uses it in Task 17); `pluginsWhy({ home, settingsList }): string[]` (R21); `skillsWhy({ home, folder, allow }): string[]`.

| Reason | Line |
|---|---|
| An enabled plugin with hooks or a mod | `(Jason: the plugin ${name} carries hooks or a mod, which run outside the sandbox. Turn it off for her account.)` |
| A named skill whose `SKILL.md` front matter has a `hooks:` line | `(Jason: the skill ${name}, which her folder allows, registers hooks (hooks: in its SKILL.md).)` |
| `hooks.SessionStart` in a source, or the app's `--settings` | `(Jason: ${L}: a SessionStart hook, which can change the id brimm-video marks chats by. Its contents are not shown here.)` |

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses for an enabled plugin that carries hooks or a mod, in the cache or synced from her account, and goes on for one turned off or carrying neither", async () => {});
it("refuses for a named skill whose SKILL.md registers hooks, wherever it is kept, and goes on for one that does not, or is not there", async () => {});
it("refuses for a SessionStart hook in the user, managed or --settings settings, and goes on for her folder's own guard and receipt hooks", async () => {});
it("refuses for any hook in her folder's own settings beyond the guard and the receipt, a SessionStart hook the /hooks menu wrote there among them", async () => {
  // Task 7's "other-hooks": the line names "a hook beside the guard and the receipt"
});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 12: plugins with hooks or a mod, named skills with hooks, and SessionStart hooks loosen the lock"`.

---

### Task 13: The open check, IV: the app's flags, the transcript's scan, folders added mid-chat, the version, the session's folder, and an untrusted folder

**Files:**
- Create: `tool/scan.js`, `tool/tests/scan.test.js`
- Modify: `tool/loosened.js`, `tool/edit.js` (`behind` says `UNTRUSTED` and goes on)
- Test: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `readProcesses`, `processTable`, `chainUp`, `claudeAbove`, `argsOf`, `appVersionOf` (Task 8); `APP_FLAGS`, `OPEN_LOCK_CLAUDE` (Task 5); `claudeDirName` (Task 3).
- Produces (`tool/scan.js`): `SESSION_ID` (the UUID pattern, Global Constraints); `heldFolder(home)` = `AS/BRIMM Video/held` (`held.js` takes it from here); `scanTranscript({ home, sessionId, transcriptPath }): { start: string|null, added: string[]|null, unread: boolean }`. It keeps `held/scan-<sessionId>.json` (`{ ino, size, offset, start, added }`, written by temporary name and rename; a scan file that cannot be read or is not JSON is taken as none) and reads only the bytes past `offset`, up to the last complete line, so a line still being written waits for its newline; a line that does not parse is skipped. It starts again from 0 when the file's size is below `offset` or its inode is another. `start` is the least `timestamp` of any complete line so far (R27); `added` is the `additionalWorkingDirectories` of the latest line with `attachment.type === "environment"`, or null while there is none; `unread` is true when the transcript cannot be read. A `sessionId` that does not match `SESSION_ID` gives `{ unread: true }` and writes nothing. Task 15 adds the held chats' `uuid`s to the same scan.
- Produces (`tool/loosened.js`): `deps.ps(): string|null` (default `readProcesses`), `deps.pid` (default `process.pid`), `deps.transcript` (default `<projects>/<claudeDirName(folder)>/<CLAUDE_CODE_SESSION_ID>.jsonl` when that id is set, `<projects>` as R30 says), `deps.appFlags` (default `APP_FLAGS`), `deps.minimum` (default `OPEN_LOCK_CLAUDE`); `appWhy({ claude: Proc|null, underClaude: boolean, folder, home, record, minimum }): { lines: string[], settings: object|null }` (`underClaude` is `env.CLAUDECODE === "1"`; the guard always gives true); `addedWhy({ home, sessionId, transcriptPath }): string[]`, which reads the environment snapshot through `scanTranscript`, never the whole transcript at each call, and never throws; `UNTRUSTED`; `trustWhy({ home, folder }): string` (from `~/.claude.json`'s `projects[<path>].hasTrustDialogAccepted === true`, for her folder or any folder above it).
- On an open-lock Mac, PR #40's check of the session's folder takes it from the transcript and the command's folder together (R30): under Claude Code, the session runs in her folder when `deps.transcript` is there and `deps.cwd || process.cwd()` is her folder or inside it; with no `CLAUDE_CODE_SESSION_ID`, or not under Claude Code, `deps.cwd || process.cwd()` as today.

| Reason | Line |
|---|---|
| ps gives null | `(Jason: this chat's processes could not be read, so the Claude app's flags on it are not known.)` |
| No `claude` above, not under Claude Code | none (Jason's own run) |
| No `claude` above, under Claude Code (the guard, or `behind` with `CLAUDECODE=1`) | `(Jason: the Claude Code above this check could not be found, so its flags and version are not known.)` |
| A flag not in `record.flags` | `(Jason: the Claude app started this chat with ${name}, which is not among the flags recorded for her chats.)` |
| `--project-config-root` other than her folder's real path | `(Jason: the Claude app reads this chat's project settings from another folder (--project-config-root).)` |
| `--setting-sources` other than `user,project,local` | `(Jason: the Claude app starts this chat with other setting sources (--setting-sources).)` |
| An `--allowedTools` entry (split at commas and spaces) not starting `mcp__` | `(Jason: the Claude app allows this chat a rule that is not a connector's tool (--allowedTools).)` |
| `--settings` not readable as JSON (text starting `{`, otherwise a file) | `(Jason: the Claude app's --settings for this chat could not be read.)`; readable: `sourceWhy("the Claude app's --settings for this chat", …)` and the SessionStart line |
| An `--add-dir` other than one folder directly in `<home>/Library/Application Support/Claude/side-session-notes`, by its real path, not a link | `(Jason: this chat has a folder added to it by the Claude app (--add-dir), which its commands could write and whose skills it would load.)` |
| The transcript's latest line with `attachment.type === "environment"` lists an `additionalWorkingDirectories` entry other than the notes folder | `(Jason: a folder was added to this chat while it ran (/add-dir, or "add this folder" on a card), which its commands could write and whose skills it would load.)` |
| The transcript cannot be read (under Claude Code, with a session id) | `(Jason: this chat's transcript could not be read, so whether a folder was added to it is not known.)` |
| `appVersionOf(exe)` below `minimum` (no line while `minimum` is null) | `(Jason: this chat runs Claude Code ${v}, older than the ${minimum} her folder's open lock was checked on.)` |
| `appVersionOf(exe)` null while `minimum` is set (a Terminal `claude`, or another copy) | `(Jason: this chat's Claude Code is not the Claude app's own copy, so its version could not be checked against the ${minimum} her folder's open lock was checked on.)` |

Not a loosening, and said by `behind` only (design section 2, "so a change shows"): when this Mac's settings add entries to the allowlist, `behind` says, after its other lines, `(Jason: her folder also allows, on this Mac: ${entries}.)`, each entry as `<type> <name>`, joined with ", ".

- [ ] **Step 1: Write the failing tests** (`chatChain` and `APP_ARGS` from the helper; `deps.appFlags: RECORD`):

```js
it("goes on for a chat whose flags are all in the record and whose one added folder is the app's own notes folder", async () => {});
it("refuses for a flag outside the record, another project-config root, other setting sources, and an allowedTools rule that is not a connector's", async () => {});
it("reads the app's --settings, as JSON or as a file, for every loosening key, allowUnsandboxedCommands false among them", async () => {});
it("refuses for any --add-dir but the app's notes folder, and for that folder through a link", async () => {});
it("reads a folder added mid-chat from the transcript's latest environment snapshot", async () => {
  // a line copied from K0's shape: {"type":"attachment","attachment":{"type":"environment","snapshot":{"additionalWorkingDirectories":["/x"]}}} → refused;
  // a later snapshot with [] → goes on
});
it("reads a transcript's environment snapshot a little at a time, and skips a line still being written", async () => {
  // tests/scan.test.js: a transcript whose last line has no newline yet and one line that is not JSON: no throw, the snapshot before them stands;
  // the scan file's offset after the first look; a second look reads only what was added; a shorter or replaced file is read again from 0;
  // start is the least timestamp of any line, with a first line {"type":"mode"} that has none, as K0's fork transcript begins
});
it("refuses for a Claude Code older than the one the open lock was checked on, and for one whose version cannot be read while one is named", async () => {});
it("says nothing of the app's flags for Jason's own run, with no claude above it and not under Claude Code", async () => {});
it("refuses under Claude Code when no claude is found above, as for a Claude Code run as node …/cli.js", async () => {
  // env { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: <uuid> }; ps: node 900 ← zsh 800 ← "node /x/cli.js" 700 ← launchd 1
});
it("refuses when the processes cannot be read", async () => {});
it("goes on for a chat whose commands run in a folder inside hers, judged by its transcript's folder", async () => {
  // openDeps(w, { cwd: join(w.folder, "Pictures"), env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: id } }) with the transcript at
  // <home>/.claude/projects/<claudeDirName(folder)>/<id>.jsonl → code 0; with it at …/<claudeDirName(folder + "/Pictures")>/<id>.jsonl → PR #40's line;
  // the first transcript again, with cwd outside her folder (<w.dir>/Elsewhere) → PR #40's line (R30)
});
it("says the folder is not trusted yet, from ~/.claude.json, and still goes on; a parent folder's trust counts", async () => {
  // r.code 0; r.text includes UNTRUSTED once, not LOCK_CHANGED
});
it("says the entries this Mac adds to her folder's allowlist, and says nothing of the default ones", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** `lockLoosened` gives `appWhy`'s `settings` to Task 10's source check.
- [ ] **Step 4: Run them, then the suite.** `cd tool && node --test tests/scan.test.js tests/behind-open.test.js`, then `node --test`.
- [ ] **Step 5: Commit.** `"The open lock, task 13: the lock check reads the app's flags on this chat, folders added mid-chat a little at a time and its version, and fails closed with no claude above under Claude Code; behind says an untrusted folder"`.

---

### Task 14: WebFetch's addresses

**Files:**
- Create: `tool/fetchable.js`, `tool/tests/fetchable.test.js`

**Interfaces:**
- Produces: `LOCAL_ADDRESS = "That address is on this Mac or its network, which this folder never fetches."`; `UNCHECKED_ADDRESS = "That address could not be checked, so it is not fetched."`; `isGlobalUnicast(address: string): boolean`; `async fetchWhy(url: string, resolve: (host: string) => Promise<string[]>): Promise<string>` ("" when it may be fetched).

Rules: the host is `new URL(url).hostname` (WHATWG parsing turns `2130706433`, `0x7f.1` and `017700000001` into `127.0.0.1`); a URL that does not parse is `UNCHECKED_ADDRESS`. Refused with `LOCAL_ADDRESS`: **every IP literal, public ones too** (confirmed by Jason, 2026-10-26: the design's wording covers all, where this plan said only those that are not global unicast); `localhost`; a name with no dot; a name under `.local`, `.localhost`, `.internal` or `.home.arpa`; a name whose look-up, or its `www.` form's (added or taken away), gives any address that is not global unicast. A look-up that fails is `UNCHECKED_ADDRESS`. Not global unicast: IPv4 `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`; IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, and anything outside `2000::/3`; an IPv4-mapped `::ffff:a.b.c.d` and a NAT64 `64:ff9b::/96` answer are unwrapped first.

- [ ] **Step 1: Write the failing tests** (design section 10's values):

```js
it("refuses every numeric or local address, in every spelling", async () => {
  for (const url of ["http://127.0.0.1/","http://2130706433/","http://0x7f.1/","http://017700000001/","http://[::1]/","http://[::ffff:127.0.0.1]/","http://192.168.1.1/","http://169.254.169.254/","http://100.64.0.1/","http://localhost/","http://printer.local/","http://router/"]) assert.equal(await fetchWhy(url, never), LOCAL_ADDRESS, url);
});
it("refuses a name that answers with an address that is not global unicast", async () => {
  for (const answer of ["10.0.0.5","0.0.0.0","::","::ffff:127.0.0.1","64:ff9b::7f00:1"]) assert.equal(await fetchWhy("https://bad.example.com/", resolver({ "bad.example.com": [answer] })), LOCAL_ADDRESS, answer);
});
it("refuses a name whose www. form answers privately, and the same the other way round", async () => {
  assert.equal(await fetchWhy("https://example.com/", resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["10.0.0.5"] })), LOCAL_ADDRESS);
  assert.equal(await fetchWhy("https://www.example.com/", resolver({ "www.example.com": ["93.184.215.14"], "example.com": ["10.0.0.5"] })), LOCAL_ADDRESS);
});
it("refuses a public IP address too", async () => {
  for (const url of ["http://93.184.215.14/", "https://[2606:2800:220:1:248:1893:25c8:1946]/"]) assert.notEqual(await fetchWhy(url, never), "", url);
});
it("allows a public name", async () => { assert.equal(await fetchWhy("https://example.com/a", resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["93.184.215.14"] })), ""); });
it("refuses what cannot be parsed or looked up", async () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/fetchable.test.js`.
- [ ] **Step 3: Implement.** The `www.` form whose look-up fails (no such name) counts as no answer, not a refusal; only the URL's own host failing is `UNCHECKED_ADDRESS`.
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 14: WebFetch never reaches a numeric, local or privately answering address"`.

---

### Task 15: Chats that hold a session's words

**Files:**
- Create: `tool/held.js`, `tool/tests/held.test.js`
- Modify: `tool/scan.js` (the held chats' `uuid`s), `tool/settings.js` (`studio`: the untied mark and the old command output when the open lock is first written, R7)
- Test: `tool/tests/settings.test.js`

**Interfaces:**
- Consumes: `processTable`, `chainUp`, `claudeAbove` (Task 8); `scanTranscript`, `SESSION_ID`, `heldFolder` (Task 13); `claudeDirName` (Task 3).
- Produces (`tool/held.js`):
  - `HELD_REFUSED` (Global Constraints); `HELD_NARROWED` (R29); `wordsFolder(home)` = `AS/BRIMM Video Words`
  - `markChat({ home, env, table, pid, now }): { tied: boolean }`: writes `held/mark-<ms>-<6 hex>.json`, `wx`, `{ at, session: env.CLAUDE_CODE_SESSION_ID || null, claude: { pid, start } | null, tied }`; `tied` when the session is set and matches `SESSION_ID`, a claude is found above `pid`, and `String(claude.pid) === env.CLAUDE_PID`. Throws when it cannot write.
  - `untiedMark({ home, now }): void`: the mark `settings.js studio` writes when the open lock is first written (R7), `{ at, session: null, claude: null, tied: false }`, `wx`.
  - `noteAfterAll({ home, id, revision, at }): void`: writes `held/after-all-<id>-<revision>-<ms>.json`, `wx` (R9; `id` and `revision` must be the record's own shapes, else nothing is written); `afterAllNoted(home, id, revision): boolean`; `afterAllTimes(home): Map<string, string>` (the latest time for each id)
  - `chatHeld({ home, sessionId, transcriptPath, claude, now }): boolean`: held when a mark's `session` is `sessionId`; or a mark's `claude` (pid and start) is `claude`; or an untied mark's, or a session after all's, time is at or after the transcript's start (R27: the scan's least timestamp; no timestamp at all, while any such time exists, holds it); or the transcript holds a `uuid` from `held/<id>.uuids.json` of a held chat (a fork). When it first holds a chat it writes `held/<sessionId>.uuids.json` with the `uuid`s of its transcript so far. A marks folder that cannot be read, a `sessionId` that does not match `SESSION_ID`, or a transcript that cannot be read while any mark or after-all time exists, holds it. It reads the transcript through `scanTranscript` (Task 13), which this task extends: the scan file also keeps `checked`, the `uuids.json` files (by name, size and mtime) already checked against; when one appears that is not among them, or one has changed, the scan reads the transcript again from 0 against it, so a fork looked at before the chat it was forked from was held is held at its next call.
  - `writeWords({ home, sessionId, label, what, text, now }): string`: refuses (throws, which `edit.js` says as `MARK_FAILED`) unless `sessionId` matches `SESSION_ID`; `<words>/<sessionId>/` made mode 0700, and its resolved path checked to be directly inside `wordsFolder(home)`; the file `${safeName(label)} ${what} ${YYYY-MM-DD HHMMSS}.txt`, `wx`, mode 0600; a name taken gets ` 2`, ` 3`…; gives the path
  - `safeName(text): string` (`/`, `:`, `\`, control letters each become a space; leading dots and spaces dropped; at most 80 letters; empty becomes `video`)
  - `clearOldWords(home, now): void` (files older than 24 hours; then empty chat folders)
- `settings.js studio`, when the lock in effect goes from strict (or no folder) to open, first writes `untiedMark` and takes away every `<tmp>/claude-<uid>/<claudeDirName(folder)>/*/tasks/*.output` (the made-up `tmp` in tests), the command output chats from before the open lock left where every open chat's sandbox may read it (R7). It does neither when her folder was open already.

- [ ] **Step 1: Write the failing tests:**

```js
it("writes a mark with the chat's id and its claude process, tied when CLAUDE_PID is that process", () => {});
it("writes an untied mark when CLAUDE_PID is not the claude above, or the id is missing or not a chat's id", () => {});
it("holds a chat by its id, by its claude process, and every chat begun before an untied mark", () => {});
it("holds every chat begun before a session after all, and before a second session after all of the same video", () => {
  // noteAfterAll for (id, rev 1) at T1, then (id, rev 2) at T2; a chat begun between T1 and T2 is held
});
it("loses no note when two runs note sessions after all at once", () => {});
it("holds a resumed chat, which keeps its id, and a fork, whose transcript holds a held chat's message uuids", () => {});
it("holds a fork made before the teaching too", () => {});
it("holds a fork looked at before the chat it was forked from was held", () => {
  // chatHeld for fork A (unheld; its scan offset at its end); then B is held and writes B.uuids.json; chatHeld for A again → true
});
it("takes a transcript's start from the earliest timestamp of any line, and holds one with none while an untied mark exists", () => {
  // K0's fork shape: a first line {"type":"mode"} with no timestamp, copied lines with the parent's earlier times
});
it("holds the chat when the marks cannot be read, its id is not a chat's id, or its transcript cannot be read while marks exist; and lets one go when there are none", () => {});
it("reads only what a transcript added since the last look, and skips a line still being written", () => {
  // a 2 MB transcript; the scan file's offset after the first look; a last line without its newline is not read until it has one
});
it("hands a session's words over in a file of the chat's own, wx and mode 600, never over another", () => {});
it("refuses a words folder for an id that is not a chat's, as ../../../Documents/x", () => {
  assert.throws(() => writeWords({ ...w, sessionId: "../../../Documents/x", label: "L", what: "principles", text: "x", now }));
  assert.equal(existsSync(join(w.home, "Documents", "x")), false);
});
// settings.test.js
it("writes an untied mark and takes away old command output when it first writes the open lock, and neither when the folder is open already", () => {
  // made-up tmp with <tmp>/claude-<uid>/<claudeDirName(folder)>/<id>/tasks/a.output; after studio --lock open (openMinimum "2.1.308"): one untied mark, no a.output;
  // a chat whose transcript began before is held; a second studio run writes no second mark
});
it("names the words file safely whatever the label holds", () => {
  for (const label of ["Sallie's / Q&A: \u0000 call", "..hidden", "", "  "]) { const p = writeWords({ ...w, sessionId: "s-1", label, what: "principles", text: "x", now }); assert.equal(dirname(p), join(wordsFolder(w.home), "s-1")); assert.ok(!basename(p).startsWith(".")); }
});
it("takes away a chat's words files a day old, and keeps newer ones", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/held.test.js tests/settings.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Then `cd tool && node --test`.
- [ ] **Step 5: Commit.** `"The open lock, task 15: marks, sessions after all, held chats and their forks, the words files, and an untied mark when the open lock is first written"`.

---

### Task 16: The open guard, I: what is never, named or left to Claude Code

**Files:**
- Create: `tool/open-lock.js`, `tool/tests/guard-open.test.js`

**Interfaces:**
- Consumes: `neverCaught`, `isConnector`, `DRAWING` (Task 1); `fetchWhy` (Task 14); `ALLOW_DEFAULT` (Task 5).
- Produces (`tool/open-lock.js`):
  - `GuardCtx = { checkout, node, folder, home, uid, tmp, index, allow: {type,name}[], web: "held"|"open", resolve, loosened: boolean, held: boolean }`
  - `async openDecision(input, ctx: GuardCtx): Promise<{ decision: "allow"|"deny"|"pass", reason: string }>`
  - `NEVER_REFUSED = "That is never done from this folder: nothing here posts, sends, publishes or shares, or works the screen, the browser or another session. Ask Jason."`; `NOT_NAMED = "That is not among the tools and skills this folder allows. Ask Jason."`; `WEB_HELD = "The web is not turned on for this folder yet: ask Jason."`

Steps covered here (design section 6, "in order"): 3 (never → deny `NEVER_REFUSED`), 6 (Skill: allow when `allow` holds `skill` of that name, else `NOT_NAMED`), then a tool an exact `tool` entry of `allow` names (`PushNotification`, the drawing tools `mcp__visualize__show_widget` and `mcp__visualize__read_me`) is allowed, before step 7, since the drawing tools are MCP tools and step 7 would otherwise refuse them; 7 (an MCP tool no `tool` entry names: allow only for an `mcp-tool` entry of that exact name, `isConnector`, not `neverCaught`; else `NOT_NAMED`), 8 (the subagent tool as `Agent` or `Task` with none of the never limits; `SendUserFile`; WebSearch and WebFetch: `WEB_HELD` while `web` is held, then WebSearch allowed and WebFetch by `fetchWhy`), 9 (`AskUserQuestion`, `TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `ToolSearch`: pass), 10 (anything else, `Monitor` among them: deny `NOT_NAMED`). A per-Mac `tool` entry cannot name an `mcp__` tool (Task 2), so only the default allowlist's drawing tools pass step 7 that way. Steps 1, 2, 4 and 5 come in Tasks 17 to 19; until then they fall to step 10.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses every never entry, fed the Code tab's real tool list", async () => {});
it("leaves the card, the task list and ToolSearch to Claude Code; the subagent tool named Task is not among them", async () => {});
it("refuses Monitor and a tool it does not know", async () => {});
it("refuses Workflow always, even when this Mac names it, and the Cron tools unless this Mac names them", async () => {});
it("allows a named skill and refuses another", async () => { /* brimm-edit, frontend-design allowed; canva-creator NOT_NAMED */ });
it("allows a connector's tool only when this Mac names it exactly, and never a local extension's or a posting one", async () => {
  // the calendar connector's create_event and update_event → NOT_NAMED until a per-Mac mcp-tool entry names one; respond_to_event → NEVER_REFUSED even then (Task 1's word `respond`)
});
it("allows the subagent tool as Agent and as Task with no isolation, no cwd and a built-in agent, and refuses it otherwise", async () => {});
it("refuses WebFetch and WebSearch while the web tools are held", async () => {});
it("allows WebSearch and a public WebFetch once the web tools are opened, and refuses a numeric or local one", async () => {});
it("allows the drawing tools and PushNotification by the default allowlist, the drawing tools though they are MCP tools no mcp-tool entry names", async () => {
  for (const name of DRAWING) assert.deepEqual((await decide(name, {})).decision, "allow", name);
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/guard-open.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 16: the open guard's never list, named skills and tools, subagents and the web tools"`.

---

### Task 17: The open guard, II: paths, and the workshop shut to Claude's own file tools

**Files:**
- Modify: `tool/open-lock.js`
- Test: `tool/tests/guard-open.test.js`

**Interfaces:**
- Consumes: `gatedIndex`, `pathsIn`, `searchRoot` (Task 4); `wordsFolder` (Task 15); `skillFolders` (Task 12); `workshopFolder` (Task 5).
- Produces: step 4 of `openDecision`, before steps 5 to 10. `GATED_REFUSED = "That is one of the places only brimm-video reads or writes. Ask for it through brimm-video, or ask Jason."`; `WRITE_REFUSED = "Claude's own file tools do not write files here. Make a file in the workshop, ~/BRIMM Video Workshop, with a command, which runs in the sandbox."`; `WORKSHOP_FILES_REFUSED = "Claude's own file tools do not read the workshop. Read a file there with a command, which runs in the sandbox."` (both decided by Jason, 2026-10-26, option b: a sandboxed loop can swap a folder in the workshop for a link, or back, between the guard's `lstat` check and Claude Code's own Write, Edit, Read or SendUserFile acting on the path, and the guard cannot close that race; files in the workshop are made and read with sandboxed commands, where macOS keeps a write inside the workshop whatever links exist)

Rules: **Write and Edit are refused for every path, with `WRITE_REFUSED`, after the loosened, held and never-list steps and before any path is looked at** (decided by Jason, 2026-10-26): not in the workshop, not through a link, not in a gated place, not anywhere. For the other tools, every path `pathsIn(tool_input, input.cwd || folder, home)` gives is looked up with `ctx.index.at`, which judges a link by the folders of its real path too (Task 4); a path in a gated place is refused (`GATED_REFUSED`) unless it is a Read inside one of this call's carve-outs, by identity, its real path included: `<dirname(transcript_path)>/<session_id>/tool-results`, `<words>/<session_id>`, and each allowed skill's `skillFolders` (a `session_id` that does not match `SESSION_ID` has no carve-outs). **The chat's own command-output folder, `<ctx.tmp>/claude-<uid>/<basename(dirname(transcript_path))>/<session_id>/tasks`, is no carve-out** (decided by Jason, 2026-10-26): the sandbox may write the temp folder (C11), so a command left going could swap a file there for a link between the guard's check and Claude Code's own Read, the race that shut the workshop. A Read of it is `GATED_REFUSED`; a command's saved output is read with `cat` or `head`, which the sandbox's `allowRead` for her temp subfolder lets through (Task 4). For Glob and Grep (kept for a later version), `searchRoot` in a gated place or holding one is refused. **Read, SendUserFile, Glob and Grep are refused with `WORKSHOP_FILES_REFUSED` for any path inside the workshop** (decided by Jason, 2026-10-26): found by what it is, as a gated place is (`gatedIndex` with the workshop as its one place: the identity of each folder along each of its real paths, a link's real path included, so that a link elsewhere to a file in the workshop is refused, a dangling one by its target text); a gated place answers `GATED_REFUSED` first; for Glob and Grep the path judged is `searchRoot`, and a search folder that holds the workshop is refused too. A held chat's Read of its own words file through a link in the workshop is refused as well (`HELD_REFUSED`). Then Read and SendUserFile (and Glob, Grep) are allowed. No path below the workshop is ever allowed to Claude's own file tools, so nothing here depends on a link being absent when the tool acts.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses every gated place for Read, Write, Edit and SendUserFile: by .., by a link into it and out of it, and by a path in a field it did not know of", async () => {
  // Read and SendUserFile → GATED_REFUSED; Write and Edit → WRITE_REFUSED (they are refused first, whatever the path)
});
it("refuses them by /System/Volumes/Data and by changed letter case", { skip: notAMac }, async () => {});
it("allows Read anywhere else: her documents, Assets, the checkout's code", async () => {});
it("allows Read of the chat's own tool-results and words folders and the named skills' folders, and refuses another chat's", async () => {
  // ctx.tmp is the world's made-up temp folder: another chat's <tmp>/claude-<uid>/<her dir>/<other id>/tasks/x.output is refused
});
it("refuses Read of the chat's own command-output folder too: a sandboxed command can write the temp folder and swap a file there for a link", async () => {
  // Read and SendUserFile of <tmp>/claude-<uid>/<her dir>/<id>/tasks/a.output, of the folder itself, of a file below it and of a `..` spelling of it → GATED_REFUSED; its tool-results, words and skill carve-outs still allow
});
it("refuses a link in the workshop to a gated file for Read and SendUserFile", async () => {
  // Read and SendUserFile of <workshop>/t, a link to <home>/.claude/projects/<dir>/<held id>.jsonl, and of one to <words>/<other id>/x.txt → GATED_REFUSED
});
it("refuses Write and Edit for every path: in the workshop and out of it, through a link or not", async () => {
  // Write and Edit of <workshop>/new.svg, <workshop>/CLAUDE.md, <workshop>/.claude/x, <workshop>/z (a link to <home>/.zshrc), a dangling one to <home>/.zshenv,
  // <workshop>/d/x where d links to <root>/Drop/<Mac>, <home>/Documents/x, a file in her folder and a gated place → { deny, WRITE_REFUSED }; NotebookEdit → NEVER_REFUSED
});
it("refuses Read, SendUserFile, Glob and Grep for any path inside the workshop, a link's real path judged too", async () => {
  // Read and SendUserFile of <workshop>/x.png, <workshop>/sub/y.svg, one not there yet, <home>/Documents/l (a link to <workshop>/x.png) and a dangling link to <workshop>/gone.png
  // → { deny, WORKSHOP_FILES_REFUSED }; a Glob or Grep whose folder is <workshop> (kept for a later version) the same; Read of <home>/Documents/notes.txt → allow
});
it("refuses, for a later Claude Code, a Glob or Grep whose folder is in a gated place or holds one, a Glob's absolute or ~/ pattern with no path among them", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 17: the open guard compares every path by what it is, links to files among them, refuses Write and Edit always, and shuts Claude's own file tools out of the workshop"`.

---

### Task 18: The open guard, III: Bash

**Files:**
- Modify: `tool/open-lock.js`, `tool/studio.js` (export `WORD` and `literally`)
- Create: `tool/tests/guard-cases.js`: `CHECKOUT`, `NODE`, `EDIT` and `ALLOWED`, moved out of `tool/tests/studio.test.js` (`:17-20`, `:99-111` at origin/main 7aaa110) word for word
- Modify: `tool/tests/studio.test.js` (imports those four from `./guard-cases.js` in place of defining them; nothing else changes). `guard-open.test.js` imports them too: importing `studio.test.js` itself would run its whole suite again.
- Test: `tool/tests/guard-open.test.js`

**Interfaces:**
- Consumes: `WORD`, `literally` (`tool/studio.js`), `ctx.index` (Task 4); `CHECKOUT`, `NODE`, `EDIT`, `ALLOWED` (`tests/guard-cases.js`).
- Produces: step 5 of `openDecision`. `RUN_ALONE = "Run brimm-video's commands on their own, exactly as her skill says, and not in the background."`

Rules, in order: `dangerouslyDisableSandbox` was refused at step 3. The one spelling is `^${literally(node)} "${literally(checkout)}/tool/edit\.js"(?: ${WORD})+$` (at least one word; no bare `node`; nothing before it). A command matching it is allowed, unless `run_in_background` is truthy and its words are not exactly `guide <WORD> tell` (R6, confirmed by Jason, 2026-10-26). A command that does not match it but holds `edit.js` or `${checkout}/tool` anywhere is refused with `RUN_ALONE`. A command any of whose words (split at white space, quotes taken off) `ctx.index.at` finds in a gated place is refused with `GATED_REFUSED`, as a courtesy. Any other command is allowed: it runs in the sandbox.

- [ ] **Step 1: Write the failing tests:**

```js
it("allows edit.js in its one spelling, and every form it allows is one the excluded entry takes", async () => {
  for (const [command] of ALLOWED.filter(([c]) => !c.startsWith("node "))) {
    assert.equal((await bash(command)).decision, "allow", command);
    assert.ok(command.startsWith(`${NODE} "${CHECKOUT}/tool/edit.js" `), command);
  }
});
it("refuses edit.js with bare node, &&, ;, |, $(…), an environment prefix, cd … &&, another node or another path", async () => {});
it("refuses edit.js with nice, env -u SANDBOX_RUNTIME, env, timeout, nohup, time, stdbuf, xargs, sudo, command or exec in front of it", async () => {
  for (const before of ["nice", "env -u SANDBOX_RUNTIME", "env", "timeout 60", "nohup", "time", "stdbuf -o0", "xargs", "sudo", "command", "exec", "A=1"]) assert.deepEqual(await bash(`${before} ${EDIT} episodes`), { decision: "deny", reason: RUN_ALONE }, before);
});
it("refuses edit.js in the background, but for guide's tell", async () => {
  assert.equal((await bash(`${EDIT} episodes`, { run_in_background: true })).decision, "deny");
  assert.equal((await bash(`${EDIT} guide "Pricing talk" tell`, { run_in_background: true })).decision, "allow");
});
it("refuses edit.js with no words after it", async () => {});
it("refuses any other command that names edit.js or the checkout's tool folder", async () => {});
it("refuses, as a courtesy, cat, grep -r, rg and find naming a gated place", async () => {});
it("allows any other command, which runs in the sandbox", async () => {
  for (const c of ["date", "ls ~/Documents", "python3 -c 'print(1)'", "rg TODO ~/Documents"]) assert.equal((await bash(c)).decision, "allow", c);
});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Move the four constants into `tests/guard-cases.js` first, and run `node --test tests/studio.test.js` to see it still pass.
- [ ] **Step 4: Run them to see them pass.** Then `cd tool && node --test`.
- [ ] **Step 5: Commit.** `"The open lock, task 18: the open guard lets edit.js through in one spelling only, and any other command into the sandbox"`.

---

### Task 19: The open guard, IV: falling back to today's, and the hook

**Files:**
- Modify: `tool/open-lock.js`, `tool/studio/guard.mjs`
- Test: `tool/tests/guard-open.test.js`, `tool/tests/studio.test.js` (its `hook()` helper, `:26` at origin/main 7aaa110, defaults to a made-up folder; today's end-to-end hook tests otherwise stay as they are)

**Interfaces:**
- Consumes: `guardDecision` (today's), `lockLoosened`, `LOCK_CHANGED` (Tasks 9 to 13), `chatHeld`, `HELD_REFUSED`, `HELD_NARROWED` (Task 15), `factsOf`, `readSettings`, `effectiveLock` (Tasks 2, 6), `gatedPlaces`, `gatedIndex`, `realOf`, `claudeDirName` (Tasks 3, 4), `SESSION_ID`, `scanTranscript` (Task 13), `UNSCOPED`, `SESSION_TAUGHT` (`tool/gate.js`).
- Produces:
  - Steps 1 and 2 of `openDecision`: with `ctx.loosened`, the answer is `guardDecision(input, …)`, its deny reason `LOCK_CHANGED`. With `ctx.held`, it is `guardDecision`'s too, but a Read inside `<words>/<session_id>` (by identity, Task 4, a link's real path included) is answered `allow`, never `pass` (a pass leaves it to Claude Code, which asks a card for a file outside her folder, and the card's "add this folder" or "always allow" loosens the lock); an `edit.js` command whose first word is not one of R29's (confirmed by Jason, 2026-10-26) is refused with `HELD_NARROWED`, `picture` among them; and every other deny reason is `HELD_REFUSED`.
  - `async guardAnswer(input, { checkout, node, folder, deps = {} }): Promise<{ decision, reason }>`, `deps` holding `env` (default `process.env`), `ps` (default `readProcesses`), `pid` (default `process.pid`), `lsof`, `resolve` (default dns lookup, all), `now` (default `Date.now`), `tmp` (default `CLAUDE_CODE_TMPDIR || "/tmp"`), `managedDir`, `managedPrefs`, `user`, `appFlags`, `minimum` (each with today's default), all handed on to `lockLoosened` and `chatHeld`: home is `dirname(folder)` (R25); this Mac's settings are read from that home; the lock in effect (`effectiveLock(settings, deps.minimum)`) strict, or settings that cannot be read → `guardDecision`; open → `lockLoosened` (with `deps.cwd = folder` when `basename(dirname(input.transcript_path)) === claudeDirName(folder)` and `input.cwd` is `folder` or starts with `folder + "/"`, else `input.cwd` (R30, confirmed by Jason, 2026-10-26); `deps.transcript = input.transcript_path`; and `underClaude` true, so that no `claude` above is loosened, R26), `chatHeld` (with the claude above the guard), then `openDecision` with `ctx.index = gatedIndex(gatedPlaces(facts), [join(realOf(root), "Assets")])`: the guard's index opens Assets alone, never `readAllowed`'s temp subfolder, shell snapshots or the app's program, which are the sandbox's (`input.cwd` is kept for resolving relative paths). A call with no `cwd`, no `session_id` or no `transcript_path`, a `session_id` that does not match `SESSION_ID`, or a `tool_input` that is not an object, is loosened.
  - The cache: `AS/BRIMM Video/lock-cache.json`, `{ signature, lines, at }`. `signature` holds every path the check looked at (read, listed or looked for), each with its (size, mtimeMs, ino), or `missing` when it was not there, so that a file that appears (her folder's `settings.local.json`, which `/sandbox`'s "No sandbox" writes, a managed settings file, a plugin) is seen at the next call; every folder it listed (the plugin and skill folders, `managed-settings.d`) with its (mtimeMs, ino); the claude's pid and start; and the sorted environment names. The transcript is not in it, since it grows at every call: its environment snapshot is read outside the cache, through `scanTranscript`, at each call. The lsof and workshop looks are made again at most every 60 and 30 seconds. Written by temporary name and rename; a cache that cannot be read or is not JSON is ignored.
  - `guard.mjs`: `guardAnswer(JSON.parse(stdin), { checkout, node: argv[2], folder: argv[3] })`; any throw is the deny "brimm-video's guard could not check this. Ask Jason." as today.

- [ ] **Step 1: Write the failing tests** (every call through `guardAnswer` gives `deps` from `openDeps(w)`, with the world's made-up `tmp` and managed folders):

```js
it("answers as today's guard does, saying the lock is changed, while anything loosens the lock", async () => {
  // open world + settings.local.json; and again with a user sandbox key; an unlisted secret name; a plugin with hooks; no claude above:
  // Bash `date` → { deny, LOCK_CHANGED }; EDIT episodes → allow
});
it("answers as today's guard does in a chat that holds a session's words, allowing it to read its own words with no card", async () => {
  // Read <words>/<session_id>/x.txt → { decision: "allow" }; Read <words>/<other id>/x.txt → deny HELD_REFUSED; Bash date → deny HELD_REFUSED
});
it("lets a chat that holds a session's words run only the commands a session runs", async () => {
  // EDIT episodes, guide "Talk" tell, principles "<label>" keep 1, finish "<label>" → allow;
  // EDIT name "Pricing talk" "x", title "Pricing talk" --words "x", text …, spell … add, cut … --words, picture make "x" → { deny, HELD_NARROWED }
});
it("keeps the open lock for a chat that ran cd Pictures", async () => {
  // cwd <folder>/Pictures, transcript_path <home>/.claude/projects/<claudeDirName(folder)>/<id>.jsonl: Bash date → allow, not LOCK_CHANGED;
  // the same cwd with the transcript in …/<claudeDirName(folder + "/Pictures")>/ → LOCK_CHANGED;
  // the transcript in …/<claudeDirName(folder)>/ but cwd outside her folder (<w.dir>/Elsewhere, or a folder whose name has the same dashes) → LOCK_CHANGED
});
it("decides a subagent's call, with its chat's session id and an agent_id, as its chat's own", async () => {});
it("keeps to today's guard on a strict Mac, on a Mac whose settings cannot be read, and on one whose settings say open while no Claude Code is named for it", async () => {
  // openDeps(w, { minimum: null }): Bash date → deny with today's REFUSED; no ps or lsof stand-in is asked
});
it("takes the home folder from her folder, never from HOME", async () => {});
it("falls back to today's guard for a call with no session id, transcript or folder, a session id that is not a chat's, or a tool_input that is not an object", async () => {});
it("reuses the lock check while nothing it looked at has changed, and looks again when a file changes or appears", async () => {
  // after a cached answer: her folder's .claude/settings.local.json appears → LOCK_CHANGED at the next call; likewise a managed settings file, a plugin folder;
  // a transcript that grew by one line does not miss the cache, and a snapshot added in that line is still seen
});
it("ignores a cache another call is writing, or one that is not JSON", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** `tests/studio.test.js`'s `hook()` defaults its folder to `<a mkdtemp home>/BRIMM Video Studio`, a home with no settings, in place of `/Users/sallie/BRIMM Video Studio`: the suite is run on her laptop after each pull (`sallies-laptop.md`), where `/Users/sallie` may be her real home with the open lock, and the guard would then read her real settings and run the real `ps` and `lsof`. Its tests stay strict and pass with nothing else changed.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 19: the guard falls back to today's lock when loosened or held, a held chat runs only a session's commands, and the hook runs the open guard on an open-lock Mac"`.

---

### Task 20: `edit.js`'s own sandbox check, and the app's environment

**Files:**
- Create: `tool/sandboxed.js`, `tool/tests/sandboxed.test.js`
- Modify: `tool/edit.js` (its entry, the `if (process.argv[1] …)` block)

**Interfaces:**
- Produces: `SANDBOXED`; `sandboxedWhy({ env, pid, spawn }): string`: `SANDBOXED` when `env.SANDBOX_RUNTIME === "1"`, or `spawn("/bin/ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 })` has an `error` (any code, `EPERM` among them), a `status` other than 0, or `stdout` not matching `/^\s*\d+\s*$/`; else "". `pid` is `edit.js`'s own process, which is always there, never its parent: Node's `process.ppid` is read once at start, and a detached run's parent `edit.js` returns at once (`startDetached`), so `ps -p <that pid>` would fail and refuse the reading's own run at random.
- The entry: `sandboxedWhy({ env: process.env, pid: process.pid, spawn: spawnSync })` first; when it says so, that line is printed, the exit code is 1, and nothing else runs.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses under SANDBOX_RUNTIME=1 without asking ps", () => {});
it("refuses with the variable unset when ps cannot be started (EPERM), exits non-zero, or prints nothing", () => {});
it("goes on when ps prints a process id and the variable is unset", () => {});
it("asks ps about edit.js's own process, never its parent, which a detached run outlives", () => {
  // a stand-in spawn that fails for any pid but 4242: sandboxedWhy({ env: {}, pid: 4242, spawn }) is "", and the pid asked is "4242"
});
it("is checked at edit.js's entry before anything else runs", () => {
  const entry = readFileSync(new URL("../edit.js", import.meta.url), "utf8").split("if (process.argv[1]").at(-1);
  assert.ok(entry.indexOf("sandboxedWhy(") >= 0 && entry.indexOf("sandboxedWhy(") < entry.indexOf("editMain("));
  assert.ok(entry.includes("pid: process.pid") && !entry.includes("process.ppid"));
});
it("prints and logs no value of a listed variable of the app's environment", async () => {
  // deps.env with every ENVIRONMENT.deny name set to "VALUE-<name>"; run episodes, behind (open world, stand-ins), show and kind refusals;
  // no said line and no line of the tool's log holds "VALUE-"
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/sandboxed.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 20: edit.js refuses inside Claude Code's sandbox, by SANDBOX_RUNTIME or a ps of its own process that cannot start"`.

---

### Task 21: A session's words, by file

**Files:**
- Modify: `tool/edit.js` (`episodeAt`, `findEpisode`, `editMain`, `kindCommand`'s session-after-all branch), `tool/detached.js` (`spawnDetached` starts its run with `CLAUDECODE` taken out of the environment, R8)
- Create: `tool/tests/edit-words.test.js`

**Interfaces:**
- Consumes: `markChat`, `writeWords`, `clearOldWords`, `noteAfterAll`, `afterAllNoted` (Task 15); `SESSION_ID` (Task 13); `processTable`, `readProcesses` (Task 8); `effectiveLock` (Task 6); `studioFolder`.
- Produces:
  - `deps.env` (default `process.env`), `deps.ps` (default `readProcesses`), `deps.pid` (default `process.pid`), `deps.minimum` (default `OPEN_LOCK_CLAUDE`) on ctx.
  - In `findEpisode`, once the gate lets the command run: when the command is one of R8's, and a record found is a session not cleared, and `env.CLAUDECODE === "1"` and her folder exists, the chat is marked (R7). A detached run is not under Claude Code (`spawnDetached` takes `CLAUDECODE` out of its environment), so it is never marked; nothing is decided by the word `--now`. A mark that cannot be written ends the command with `MARK_FAILED = "This chat could not be marked as holding a session's words, so they are not shown here: ask Jason."` (1). Then, where the lock in effect is open (`effectiveLock(ctx.settings, ctx.deps.minimum)`) only, `ctx.say` collects every later line instead of printing it (no `CLAUDE_CODE_SESSION_ID`, or one that does not match `SESSION_ID`, ends it with `MARK_FAILED` too).
  - At the end of `editMain`, collected lines are written by `writeWords` (`what` is the command's name) and the chat is told one line, `wordsLine(label, path)` = `` `${label}: a session's words are in a file for this chat alone: ${path}` ``. A `writeWords` that throws ends the command with `MARK_FAILED`, the collected lines shown nowhere.
  - `editMain` runs `clearOldWords` at each command under Claude Code.
  - A session after all (R9): `kindCommand`, when `stored === "session"` and the record was answered before as another kind, calls `noteAfterAll({ home, id, revision: session.emptyRevision, at })`; `episodeAt`, which `episodes`, `status`, `guide`, `recordsHere` and `findEpisode` all read records through, on reading a record with `session.emptyRevision` set for which `afterAllNoted(home, id, emptyRevision)` is false, calls it with now. So the other Mac notes it at `behind` and `episodes`, which her skill runs at each start, not only once a command names that video.
  - `tests/episodes.js`'s `setup()` and `tests/phase4.js`'s worlds give `env: {}` in their deps (Review Focus): a suite run from inside Claude Code then marks nothing and runs no `ps`.

- [ ] **Step 1: Write the failing tests** (an open world with a session episode from `phase4.js`; env `{ CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-1", CLAUDE_PID: "700" }`; `deps.ps` gives `chatChain()`; stand-in key phrases "KEY PHRASE 4417"):

```js
it("writes the mark, then a session's principles into a file for this chat alone, and prints only its label and the file", async () => {
  const r = await on(deps, "principles", LABEL);
  assert.deepEqual(r.said.length, 1); assert.match(r.said[0], /^.+: a session's words are in a file for this chat alone: .+\.txt$/);
  const file = r.said[0].split(": ").at(-1);
  assert.ok(readFileSync(file, "utf8").includes("KEY PHRASE 4417")); assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.ok(!r.said.join("\n").includes("KEY PHRASE"));
  const mark = marksOf(home)[0]; assert.deepEqual([mark.session, mark.tied], ["s-1", true]); assert.ok(statSync(markFile).mtimeMs <= statSync(file).mtimeMs);
});
it("does the same for ideas, teachings, and a session's Reel and finish lines", async () => {});
it("prints as today without CLAUDECODE, and on a strict-lock Mac, where it still marks the chat under Claude Code", async () => {});
it("refuses, showing nothing, when the chat cannot be marked, has no id, or has an id that is not a chat's", async () => {
  // CLAUDE_CODE_SESSION_ID "../../../Documents/x" → MARK_FAILED, code 1, nothing written under <home>/Documents
});
it("prints an ordinary video's words as today, and marks nothing", async () => {});
it("leaves a detached run, started without CLAUDECODE, and the reading's own run unmarked", async () => {
  // deps.env {} for the run startDetached launches; and spawnDetached's child environment holds no CLAUDECODE (a stand-in spawn records it)
});
it("marks and hands over a foreground run Claude typed with --now, which is under Claude Code", async () => {});
it("takes away this chat's words files a day old at its next command", async () => {});
it("notes a session after all when kind answers an answered video as a session, and when this Mac first reads one the other Mac answered, through episodes", async () => {
  // the other Mac's record with session.emptyRevision set; `episodes` alone (no command naming it) writes held/after-all-<id>-<rev>-<ms>.json once;
  // a second episodes writes none; a record with a later emptyRevision is noted again
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/edit-words.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 21: a session's words go to a file only that chat may read, after the chat is marked; detached runs leave Claude Code's environment; sessions after all are noted wherever a record is read"`.

---

### Task 22: The card's wording, in code

**Files:**
- Create: `tool/receipts.js`, `tool/tests/receipts.test.js`
- Modify: `tool/edit.js` (`cardLines`; the line after `ASK_IF_SESSION`)
- Modify: the exact-output tests the new lines change (line numbers at origin/main 7aaa110):
  - `tool/tests/edit-labels.test.js`: the `cardOf` helper (`:573-579`) skips lines starting `    Card` (the new tests here pin those); `:483-491` expects the `Card:` line after the Guess line, in `slice(0, 8)`; `:869` reads `said[at + 5]` for the "Not right" line, the `Card:` line coming before it. `:625`, `:637` (`[]`), `:648`, `:656`, `:670`, `:688`, `:733` and `:876` then pass unchanged through `cardOf`.
  - `tool/tests/edit-kind.test.js`: `:204`, `:1273` and `:1284` expect `[ZOOM, \`    Card if not a session: ${JSON.stringify(notSessionCardOf({ label, came }))}\`]` (the label as the test gives it, `came` null where the record does not say).

**Interfaces:**
- Produces (`tool/receipts.js`):
  - `WHAT_Q = (label) => \`What is ${label}?\``; `PRIVATE_Q = "Is it a private session with a client or a group?"`
  - `cardOf({ label, guess: "finished"|"raw"|"clip"|null, maybe: null | { session: true } | { name, kind } }): { questions: { question, options: { label }[] }[] }`: the first question's options as `tool/studio/SKILL.md:21-28` orders them (a Maybe line wins over a Guess line); the second's `Yes`, `No`
  - `notSessionCardOf({ label, came: "zoom"|"sound"|null })`: one question (R10's words), options `It is a client or group session`, `It is not a session`
  - `formOf(questions): { label, form: "what"|"not-a-session" } | null`: the label that makes `questions` (texts and option labels, in order) equal one of the forms above, for some guess, Maybe and came
- `cardLines` adds `` `    Card: ${JSON.stringify(cardOf(…))}` `` last, and `` `    Card if not a session: ${JSON.stringify(notSessionCardOf(…))}` `` when `answer.came` is `zoom` or `sound`; `kind` prints the second form after `ASK_IF_SESSION`, with `came: null` when it does not know. `cardLinesFor(record, …)`, the card's lines alone, is exported for Task 23, which prints them after `NO_RECEIPT` for any video with no kind, one she left alone included (R10). The `Left alone` listing of `episodes` is unchanged (`edit-labels.test.js:500`).

- [ ] **Step 1: Write the failing tests:**

```js
it("words the card for each guess and each Maybe line exactly as her skill did", () => {
  for (const [given, first] of [
    [{ maybe: { session: true } }, ["Client or group session","Finished by your editor","Raw with retakes","iPhone clip"]],
    [{ maybe: { name: "Pricing talk", kind: "finished" } }, ["A new version of Pricing talk","Finished by your editor","Raw with retakes","Client or group session"]],
    [{ maybe: { name: "Pricing talk", kind: "raw" } }, ["A finished version of Pricing talk","Finished by your editor","Raw with retakes","Client or group session"]],
    [{ guess: "finished" }, ["Finished by your editor","Raw with retakes","iPhone clip","Client or group session"]],
    [{ guess: "raw" }, ["Raw with retakes","Finished by your editor","iPhone clip","Client or group session"]],
    [{ guess: "clip" }, ["iPhone clip","Finished by your editor","Raw with retakes","Client or group session"]],
    [{}, ["Finished by your editor","Raw with retakes","iPhone clip","Client or group session"]]]) {
    const card = cardOf({ label: "Talk 3", guess: null, maybe: null, ...given });
    assert.deepEqual(card.questions.map((q) => [q.question, q.options.map((o) => o.label)]), [["What is Talk 3?", first], [PRIVATE_Q, ["Yes","No"]]]);
  }
});
it("words the not-a-session card with the label, for Zoom, sound alone and neither", () => {});
it("finds the label and the form of a card in each fixed form, and none of a card worded otherwise", () => {});
it("prints the card under each waiting video in episodes, as JSON she can be asked with as it is, whatever the label holds", async () => {
  // a label "Sallie's \"Q&A\": part 2" round-trips through the Card: line
});
it("prints the not-a-session card only for a Zoom download or sound alone, and after kind's ask-first line", async () => {});
it("keeps in the code every order of the card's answers her skill wrote out, the Maybe line of a session first", () => {
  // moved from studio.test.js:273-318 (Task 26 takes the skill's lists away): the seven orders, through cardOf, and edit.js's
  // `lines.push("    Maybe a new version of a client or group session.")` still in its source (studio.test.js:317)
});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** The Maybe forms read `shownName` of the matched video (R28) and its kind from `KIND_SAID`: an iPhone clip's or a finished video's is "A new version of", a raw one's "A finished version of". Then change `edit-labels.test.js` and `edit-kind.test.js` as the Files list says, and nothing else in them.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 22: the card's wording moves into code, and episodes prints the exact card"`.

---

### Task 23: The card's receipt

**Files:**
- Create: `tool/studio/receipt.sh` (mode 755), `tool/studio/receipt.mjs`
- Modify: `tool/receipts.js`, `tool/edit.js` (`kindCommand`)
- Test: `tool/tests/receipts.test.js`, `tool/tests/fixtures/ask-user-question-result.json` (new)

**Interfaces:**
- Consumes: `cardOf`, `notSessionCardOf`, `formOf`, `cardLinesFor` (Task 22); `effectiveLock` (Task 6); `kindOf` (`tool/gate.js`).
- Produces:
  - `receiptsFolder(home)` = `AS/BRIMM Video/receipts`; `receiptFrom(input, now): Receipt|null`, `Receipt = { at, label, form, answers: { [question]: answer } }`: only for `hook_event_name` PostToolUse and `tool_name` AskUserQuestion; none when `tool_response.afkTimeoutMs` or `tool_response.followUp` is present, when `formOf(tool_response.questions)` is null, or when any question's answer in `tool_response.answers` is missing or not one of its options. `tool_input` is never read.
  - `writeReceipt(home, receipt)`: `receipt-<ms>-<6 hex>.json`, `wx`.
  - `expectedAnswers({ label, stored, maybeName, maybeKind, notASession }): { form, answers }[]`
  - `receiptWhy({ home, expected, now }): string`: "" when, for each expected form, a receipt of the last hour has that label, that form and those very answers; else `NO_RECEIPT = "Ask her on the card first: only her answer on it answers a video that has no answer yet."`
  - `receipt.sh`: `"$1" "$(dirname "$0")/receipt.mjs" "$2" || exit 0`; `receipt.mjs` reads the hook's input, home = `dirname(argv[2])` (R25), writes the receipt if any, prints nothing.
  - `kindCommand`: under `CLAUDECODE=1` where the lock in effect is open (`effectiveLock(ctx.settings, ctx.deps.minimum)`), for any record with no kind yet (`kindOf(record) === null`, whatever its `answer.state`: a video waiting for her answer, and one she left alone, which `kind` still answers, `tool/gate.js` `LEFT`), refuses with `NO_RECEIPT` unless `receiptWhy` is "", and then prints the video's card lines (`cardLinesFor`, Task 22), so the skill can ask it though `episodes` lists a left-alone video with no card. `--not-a-session` needs the not-a-session receipt as well.
  - The fixture: the result shape of R11, `{ "questions": [...], "answers": { "<question>": "<label>" } }`, marked in its first key as written from 2.1.308's output schema and awaiting by-hand item 10.

- [ ] **Step 1: Write the failing tests:**

```js
it("writes a receipt for a card in each fixed form, from her answers in the result", () => {});
it("writes none for a card worded otherwise, one left idle (afkTimeoutMs), one with followUp, a question unanswered or answered in Other's words, or answers only in what Claude asked with", () => {});
it("never writes outside this Mac's receipts folder, nor over a receipt there", () => {});
it("is run by /bin/sh from the checkout as committed, and writes the receipt into the home above her folder", () => {
  // spawn /bin/sh receipt.sh process.execPath <tmp home>/BRIMM Video Studio with the fixture on stdin
});
it("lets kind answer a waiting video under Claude Code on an open-lock Mac only with a receipt holding her answers", async () => {
  // none, an hour-old one, another label, another answer to the same question → NO_RECEIPT, code 1, nothing written to the record
});
it("needs the not-a-session receipt too for --not-a-session", async () => {});
it("refuses kind on a video she left alone without a receipt, and prints its card after the refusal", async () => {
  // a left-alone video (answer.state "not for brimm-video"); kind "<label>" finished --private no under Claude Code, open lock, no receipt
  // → [NO_RECEIPT, "    Card: {…}"], code 1, nothing written to the record; with a receipt holding her answers → 0
});
it("needs no receipt in Terminal, on a strict-lock Mac (one whose settings say open while no Claude Code is named for it among them), or for a video already answered", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 23: the card's receipt, and kind answers a video with no kind, waiting or left alone, only with her click"`.

---

### Task 24: Copies and reveals by id

**Files:**
- Create: `tool/reveal.js`, `tool/tests/reveal.test.js`
- Modify: `tool/edit.js` (`showCopy`, `whichCommand`, `clearShown`, `showInFinder`'s callers at the withdrawal, `emptyRevisionAgain` and `showForStep`), `tool/finish.js` (its three `open -R`)

**Interfaces:**
- Consumes: `effectiveLock` (Task 6); `workFolder`; `cloneWhole` (as `which` uses it); `fileSafe` (`tool/names.js`).
- Produces (`tool/reveal.js`):
  - `cantOpen(label)` (Global Constraints' words)
  - `shownByIdFolder(home, id)` = `join(workFolder(home), "shown", id)`
  - `freeShownName(dir, base, ending)`, moved here from `edit.js` (`:2213` at origin/main 7aaa110), which imports it back for `showCopy` and `which`
  - `async revealed({ home, settings, minimum, run, record, label, path, clone }): Promise<void>`: strict (the lock in effect, `effectiveLock(settings, minimum)`): `open -R path`, as today. Open: the file is copied (a video by `clone`, anything else with `copyFileSync` and mode 0444) into `shownByIdFolder`, named `freeShownName(dir, fileSafe(label), ".brimm-ops.json")` for a hand-off or `freeShownName(dir, fileSafe(label), extname(path))`, as `show` and `which` name theirs (a default label holds a ":", a label may hold a "/", and a name taken is never written over), listed in that folder's `SHOWN_MARKER`, and that copy is revealed; one that cannot be copied is not revealed, and the caller says `cantOpen(label)`.
- `show` and `which` copy into `shownByIdFolder` on an open-lock Mac (R12). `which`, on an open-lock Mac, for a gated record (gate.js `gated`, or held as a session) it cannot copy, refuses with `cantOpen(name)` and opens nothing; for an answered ordinary video it opens the original as today. `clearShown` clears `BRIMM Video Work/shown/*` as well.

- [ ] **Step 1: Write the failing tests:**

```js
it("opens show's and which's copies from a folder named by the video's id on an open-lock Mac, and from the episode's own on a strict one", async () => {});
it("reveals a copy of the hand-off, named by its label, never a path in the episode's folder, for guide show, a session after all's withdrawal and finish", async () => {});
it("reveals a copy of the video to post too", async () => {});
it("names a revealed copy safely whatever the label holds, and never over an earlier copy", async () => {
  // labels "Video of 18 Oct, 09:30 (Mac Studio)" and "Q&A / part 2": the copy is directly in shown/<id>/, its name fileSafe's; a second reveal gets " 2"
});
it("refuses which for a gated video it cannot copy, opening nothing, and opens an answered ordinary one's original as before", async () => {});
it("has behind clear the copies in both places", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 24: copies opened and revealed from a folder named by the video's id"`.

---

### Task 25: No hard link out of a gated place

**Files:**
- Create: `tool/tests/no-hard-link.test.js`

brimm-video makes one kind of hard link on purpose, and it stays: `takeEpisodeLock` (`tool/detached.js:102`, `:113`, `:131` at origin/main 7aaa110) claims an episode's run lock by `linkSync(mine, lock)` and `linkSync(mine, guard)`, an atomic link of the run's own lock text to the lock's name in the same folder of BRIMM Video Work. Both ends are brimm-video's lock files, holding a pid, a command and a nonce, and no gated content leaves a gated place; a clone would lose the atomic claim. So those three lines are allowed by name, with that reason in the test. Whisper's language flag, `"-l", language` (`tool/lib.js:44`), is not `cp -l`: `-l` is matched only in a `cp` argument list. Run over origin/main's `tool/` (checked with node), the patterns below find those three lines of `detached.js` and nothing else.

- [ ] **Step 1: Write the test:**

```js
// `link(` touches its parenthesis, so a comment's "a new link (--version-of)" (edit.js:4110) is not taken for a call.
const HARD_LINK = [/(?<![Ss]ym)linkSync\s*\(/, /(?<![A-Za-z0-9_$])link\(/, /["']\/bin\/ln["']/, /["']ln["']\s*,/, /\bln\s+(?!-s)/, /["']\/bin\/cp["']\s*,\s*\[[^\]]*["']-l["']/, /\bcp\s+-l\b/];
/** The episode lock's own atomic links (detached.js takeEpisodeLock): its lock text linked to the lock's name beside it, in BRIMM Video Work.
    Both ends are brimm-video's lock files; no gated content leaves a gated place, and a clone would lose the atomic claim. */
const ALLOWED_LINKS = [["detached.js", "linkSync(mine, lock);"], ["detached.js", "linkSync(mine, guard);"]];
it("knows a hard link when it sees one, and not a symbolic one, a clone or whisper's language flag", () => {
  for (const line of ['linkSync(a, b)', 'fs.link(a, b, cb)', 'spawnSync("/bin/ln", [a, b])', 'run("ln", [a, b])', 'cp -l a b', 'spawnSync("/bin/cp", ["-l", a, b])']) assert.ok(HARD_LINK.some((r) => r.test(line)), line);
  for (const line of ['symlinkSync(a, b)', 'unlink(a)', 'readlink(a)', 'spawnSync("/bin/cp", ["-c", a, b])', 'ln -s a b', '["-m", model, "-f", wav, "-l", language]', 'still refuses a new link (--version-of)']) assert.ok(!HARD_LINK.some((r) => r.test(line)), line);
});
it("makes no hard link anywhere in tool/, its scripts included, but the episode lock's own", () => {
  // every .js, .mjs and .sh under tool/ but tests/: no line matches HARD_LINK, but a line of a file ALLOWED_LINKS names whose trimmed text is the one it names;
  // and each ALLOWED_LINKS line is still there (so the allowance goes when the code does)
});
```

- [ ] **Step 2: Run it.** `cd tool && node --test tests/no-hard-link.test.js`. Expected: PASS at once. A failure names the file and line: a new hard link of a gated file is changed to a clone (`cp -c`); one of brimm-video's own lock files is added to `ALLOWED_LINKS` with its reason, on Jason's yes.
- [ ] **Step 3: Commit.** `"The open lock, task 25: a test that brimm-video hard-links no file but its own episode lock's"`.

---

### Task 26: Her folder's `CLAUDE.md` and skill

**Files:**
- Modify: `tool/studio/CLAUDE-open.md`, `tool/studio/SKILL.md`
- Test: `tool/tests/studio.test.js`, whose card tests read the lines this task replaces (line numbers at origin/main 7aaa110):
  - `:269-272` ("asks with one AskUserQuestion card for each video…") requires `"What is <label>?"` and the Yes/No question written out: rewritten to require `` `Card: {…}` ``, "never two videos in one card", "Never word this card yourself" and "The card's words are a proposal, for Jason and Sallie to settle".
  - `:273-318` (the seven orders) is deleted: Task 22's `receipts.test.js` pins the orders through `cardOf`, and its check of `edit.js`'s Maybe line (`:317`) moves there.
  - `:322-329` (the Zoom card's old sentence, SKILL.md:45) is rewritten for the new sentence: "Card if not a session", "on one `AskUserQuestion`", "A bare yes or no in the chat is unclear: ask again.", and `Only on "It is not a session", run the same \`kind\` with \`--not-a-session\` added`.
  - Kept as they are, and so kept in the skill: the span `kind "<label>" finished --private no --not-a-session` (`:227-259`, `:383-397`, and `KNOWN_INERT` at `:430-436`, `:480`); the guide's cards (`:523-547`) and the correction card (`:563-573`), which the skill still words itself.

**Interfaces:**
- Consumes: `wordsLine` (Task 21), `HELD_REFUSED`, `UNTRUSTED`, `NO_RECEIPT`, the `Card:` lines (Task 22).

`CLAUDE-open.md`, in her words: this folder edits The BRIMM's videos with brimm-video (the brimm-edit skill), and Claude may also help with anything else: graphics, research, writing, other programs. The BRIMM Video folders, the episodes and the code are read and changed only through brimm-video's commands. Nothing here posts, sends or publishes anything; the finished videos are posted by hand. Files Claude makes go in the workshop, `~/BRIMM Video Workshop`. Claude's own Write, Edit and Read tools never touch the workshop (decided by Jason, 2026-10-26): a file there is made and read with a command, which runs in the sandbox, and since heredocs do not work here it is written with `printf`, `python3 -c`, `node -e` or `base64 -d` fed by a pipe, and read with `cat`. When a command's long output is saved to a file, Claude reads that file with `cat` or `head`, never with its Read tool (the sandbox may write the temp folder, so the guard does not let Read open it; decided by Jason, 2026-10-26). A session's or a client's words never go into a web search, a picture's description, a drawing or the workshop; a chat that has a session's teachings is for brimm-video only. Speak to Sallie in plain words; never show her command names, paths or flags. Today's line on never rating, reporting or sharing a chat about a session. For anything the folder refuses, say so plainly and suggest she asks Jason.

Her skill (one template for both locks): the card section's option lists (lines 21 to 29 today) give way to: "`episodes` prints, under each video waiting for her answer, a line `Card: {…}`. Ask it with one `AskUserQuestion` exactly as that line gives it: its questions and answers, in that order, word for word, never two videos in one card. Never word this card yourself. When it also prints `Card if not a session: {…}`, and she answered anything but "Client or group session", ask that card next, as given; `kind` prints one after it says to ask first, too. If `kind` says to ask her on the card first, ask the card it prints after that line, as given, and run `kind` again only with her answers." The table mapping answers to `kind` stays. The Zoom sentence (line 45 today) becomes R10's: ask the `Card if not a session` card on one `AskUserQuestion`, a bare yes or no in the chat is unclear, and `Only on "It is not a session", run the same \`kind\` with \`--not-a-session\` added, as \`kind "<label>" finished --private no --not-a-session\``. At the start: "If `behind` says Claude Code has not trusted this folder yet, tell her: "Open this folder again in the Claude app and choose to trust it, then start a new chat."" In "A client or group session": "When brimm-video says a session's words are in a file for this chat alone, read that file with Read and show it exactly as written. Then tell her: "This chat now runs brimm-video only; start a new chat for anything else." If a refusal says "This chat holds a session's words", say that to her in plain words." The skill names no `picture` command (K2, K3).

- [ ] **Step 1: Write the failing tests:**

```js
it("keeps the skill under 160 lines, running only commands edit.js has", () => {});
it("has the skill ask the card exactly as episodes prints it, and never word it itself", () => {
  assert.ok(skill.includes("`Card: {…}`") && skill.includes("Never word this card yourself"));
  assert.ok(!skill.includes("Never word a card yourself"), "the skill still words the guide's cards and the correction card");
  assert.ok(!skill.includes('"Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"'));
});
it("has the skill read a session's words from the file brimm-video names, show them as written, and send her to a new chat for anything else", () => {});
it("has the skill tell her when the folder is not trusted yet, and when a chat holds a session's words", () => {});
it("tells Claude in the open lock's CLAUDE.md what it may help with, where it writes, how it reads a command's saved output, and what never leaves the chat", () => {
  const md = studioFiles({ ...where, lock: "open", facts })["CLAUDE.md"];
  for (const words of ["~/BRIMM Video Workshop", "heredoc", "printf", "base64 -d", "never touch the workshop", "read that file with `cat` or `head`", "posted by hand", "Never rate, report or share a chat about a session", "a chat that has a session's teachings is for brimm-video only"]) assert.ok(md.includes(words), words);
  assert.ok(!md.includes("do not run any other program") && !md.includes("written with Write"));
});
it("keeps the strict lock's CLAUDE.md as it is", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/studio.test.js`.
- [ ] **Step 3: Write the texts, and change `studio.test.js` as the Files list says.** Keep every other line today's tests read (the Guess and Maybe rows of the `kind` table, the `--not-a-session` span, the dialogs, the guide's cards, the correction card).
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 26: her folder's open CLAUDE.md, and the skill asks the card as printed and reads a session's words from their file"`.

---

### Task 27: The installer

**Files:**
- Modify: `tool/install.sh`, `tool/settings.js` (`user-deny`), `tool/loosened.js` (the check of those rules)
- Test: `tool/tests/install.test.js`, `tool/tests/settings.test.js`, `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `OPEN_LOCK_CLAUDE` (read by `sed` from `tool/studio.js`, as `CLAUDE_MODEL` is from `unedited.js`); the planned settings' `lock`; `gatedPlaces`; `node settings.js studio`.
- Produces: `--user-deny` (with `--machine`); `node settings.js user-deny`: adds each `Read()` rule of the open shape's gated places (both spellings, and the `.env` rules) to `~/.claude/settings.json`'s `permissions.deny`, once each, keeping every other key and rule; written by temporary name and rename; a file that is not a JSON object is refused with `Her user settings could not be read as JSON, so nothing was added: Jason puts them right by hand.` (1); it says `Written: ~/.claude/settings.json (<n> deny rules for the places only brimm-video reads)`, and records `userDeny: true` in this Mac's settings (`settingsFault` takes it as a boolean).
- The lock check (design section 6, "on her laptop, if Jason takes question 5"): on an open-lock Mac whose settings say `userDeny: true`, a missing rule is `(Jason: her user settings, ~/.claude/settings.json, no longer hold every Read deny rule brimm-video added for the places only it reads. Its contents are not shown here.)`.

`--print` lines, after "Sallie's folder for Claude":
- `  Her folder's lock:  strict (Claude runs only brimm-video's commands there)`, or, when this Mac's settings say open and the open lock can be written, `  Her folder's lock:  open: Claude may help with anything but the never list, and its commands run in Claude Code's sandbox with no network`.
- When they say open and `OPEN_LOCK_CLAUDE` is not set: `  The open lock:  waits for the checks by hand in the Code tab (no Claude Code version is named for it yet), so her folder keeps the strict lock`.
- For an open lock: `  The workshop, where Claude's commands write:  ~/BRIMM Video Workshop`; `  Kept from Claude in her folder:  BRIMM Video (all but Assets), BRIMM VIDEO Transfer, Zoom's recordings (<zoom folder>), Final Cut's backups, BRIMM Video Work, brimm-video's own settings, Claude's and the Claude app's own files, Dropbox's own files, brimm-video's logs, and the folders that hold secrets`; `  The web tools:  held (until node tool/settings.js studio --web open, on Jason's yes)` or `open`; `  Her folder's proxy port:  <port>, which nothing on this Mac may listen on` (or `picked when her folder is written`).
- A Terminal or app Claude Code older than `OPEN_LOCK_CLAUDE` with the lock open: `studio_why="Claude Code here is <v>, older than the <min> her folder's open lock was checked on. In Terminal: claude update, then run this again"`, and her folder is not written, as for `GUARD_CLAUDE`.
- `  Her user settings, ~/.claude/settings.json:  the Read deny rules for the places above, added (every Claude Code session on this Mac takes them; they hold Claude's file tools, not a script)` with `--user-deny`; without: `  Her user settings:  left as they are (--user-deny adds deny rules for the places above)`.

- [ ] **Step 1: Write the failing tests:**

```js
it("says which lock her folder gets, and that the open lock waits for the checks by hand while no version is named for it", () => {});
it("for an open lock, names the workshop, the places kept from Claude in Finder's words, the web tools held and the proxy port", () => {});
it("does not write her folder when Claude Code is older than the version the open lock was checked on", () => {});
it("names her user settings' deny rules, and adds them only with --user-deny", () => {});
// settings.test.js
it("adds the Read deny rules to her user settings once, keeps everything else in them, and notes that it did", () => {});
it("refuses user settings that are not a JSON object, changing nothing", () => {});
// behind-open.test.js
it("refuses when her user settings lose a Read deny rule brimm-video added, and says nothing of them on a Mac where none were added", async () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/install.test.js tests/settings.test.js`.
- [ ] **Step 3: Implement.** The real run's line stays `"$node" "$HERE/settings.js" studio --node "$node"` (the lock comes from this Mac's settings, through `effectiveLock`, so settings that say open while `OPEN_LOCK_CLAUDE` is null get the strict lock, as `--print` says), then, with `--user-deny`, `"$node" "$HERE/settings.js" user-deny`. The print's lock line follows the same rule: open only when the planned settings say open and the `OPEN_LOCK_CLAUDE` it reads is not `null`.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 27: the installer says which lock this Mac gets, waits for the open lock's Claude Code, and adds her user settings' deny rules only with --user-deny"`.

---

### Task 28: The setup guide, the README and the requirements

**Files:**
- Modify: `docs/setup/sallies-laptop.md`, `README.md`, `docs/requirements.md`
- Test: `tool/tests/install.test.js`

Content:
- **Step 9** stays "9. **Check that her Claude folder only runs BRIMM Video:**" (today's text, for while her laptop has the strict lock; `install.test.js:518` and the README name it), and a new step follows it: "10. **Check her Claude folder's open lock:**" (design section 7's list, in the same voice: trust first and `behind`; each refusal, each "shows nothing", each "works with no card"; with a made-up `Episodes/0000 Lock check (test)/` folder holding one line of made-up words, removed afterwards; each check put as a named owner's check or a script to run). It is a numbered step of its own, not "9b.", which `install.test.js:520`'s `/^\d+\. \*\*([^*]+):\*\*/gm` does not count as a step and which Markdown runs on into step 9. Today's steps 10 to 13 become 11 to 14, and every reference moves with them (lines of `sallies-laptop.md` at origin/main 7aaa110): "step 10" at `:11` and `:43` and "Switching her laptop" item 8's at `:70` become "step 11"; each "step 9's check again" (`:52`, `:54`, `:67`, `:78`) stays and gains "or step 10's, on an open-lock laptop"; step 7's "step 9's `/status`" (`:41`) stays. Step 10 says that until the folder is trusted every brimm-video command asks a card (not "every file in the workshop": nothing in the workshop asks a card, since Claude's own file tools never act there and sandboxed commands write by the sandbox's `allowWrite`).
- **New steps for Jason alone:** clear Finder's and QuickTime's recent lists once, before the open lock; empty `~/.claude/projects/<her folder>/memory/`; review her claude.ai account's skills and plugins and turn off any with hooks or a mod; install `frontend-design`; `node tool/settings.js studio --node <node> --zoom "<her Zoom folder>"`; then, once `OPEN_LOCK_CLAUDE` is set, `--lock open` on his yes, and `--web open` only once K0's checks of the app's environment pass. (The OpenRouter key and `settings.js pictures` are K3's.) The commit that sets `OPEN_LOCK_CLAUDE` reaches her laptop by a pull: the steps say "pull as under "Jason has a newer brimm-video", above", and write no `git … pull` command of their own (`install.test.js:558-566` requires every line holding one to look for the check agent left behind and say how to take it away alone).
- **For Sallie:** move a Zoom recording into the drop folder rather than copy it, and delete Zoom's original; never add a folder to her session from the app, nor choose "add this folder" on a card; never choose "No sandbox" in `/sandbox`; never turn memory on in `/memory`.
- **"If something goes wrong"** gains one line per new `behind` reason (Tasks 10 to 13), keeps "choose the one-time Yes only".
- **README:** the `tool/studio.js` row and "On Sallie's laptop" describe the two locks (the open lock's paragraph says that Claude's commands in the sandbox, not its own file tools, write in the workshop, and that its Write and Edit are refused and its Read, SendUserFile, Glob and Grep shut out of it: decided by Jason, 2026-10-26); the `behind` row its new checks and the untrusted line; `which`, `show`, `guide … show` and `finish` reveal copies by id on an open-lock Mac; rows for the new files.
- **`docs/requirements.md` (R23):** a heading "Jason's decisions of 2026-10-25" with his words verbatim (design, "What this rests on"); the lock bullet keeps its 22 Oct facts and gains "On her laptop it is open but for a fixed never list (2026-10-25): Claude may help with graphics, other programs and named design skills, and with the web once a check in the Code tab shows the app's secrets stay out of her commands. Kept locked: the code and the episode records change only through brimm-video; a session's words never come into her chat but as its approved teachings, and a chat that has them runs brimm-video only; nothing is posted or published. OpusClip's posting tools stay denied."; a line under "Decisions" naming the design; a change line for 2026-10-26.

- [ ] **Step 1: Write the failing tests:**

```js
it("names the lock-down checks by titles that are steps of the setup guide, for both locks", () => {
  // the steps found by install.test.js:520's pattern include "Check that her Claude folder only runs BRIMM Video" and "Check her Claude folder's open lock"
});
it("has the setup guide's open-lock check name every refusal, every hidden name and every card-free step the design lists", () => {
  const step = guide.split("\n").find((l) => /^\d+\. \*\*Check her Claude folder's open lock:\*\*/.test(l));
  for (const words of ["trust", "`behind`", "`cat`", "`node -e`", "`python3`", "/System/Volumes/Data", "letter case", "`grep -r`", "`rg`", "`find`", "`mdfind`", "`osascript", "`curl`", "`nice`", "`env -u SANDBOX_RUNTIME`", "http://127.0.0.1/", "`printenv`", "HTTP_PROXY", "memory", "side-session-notes", "teachings", "words file"]) assert.ok(step.includes(words), words);
});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Write the three documents.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 28: the setup guide's open-lock check and Jason's steps, the README, and Jason's decisions in the requirements"`.

---

### Task 29: The whole branch

- [ ] **Step 1: Run the suite.** `cd tool && node --test`. Expected: all pass, 0 fail.
- [ ] **Step 2: Check strict is unchanged.** `git diff origin/main -- tool/studio/CLAUDE.md tool/studio/guard.sh` shows nothing. The strict tests of `tests/studio.test.js` and PR #40's of `tests/edit-show.test.js` pass, and `git diff origin/main` of the existing test files shows only additions and these changes, each named in its task: the four source checks pointed at `loosened.js` (Task 9, `edit-show.test.js` and `studio.test.js`); `CHECKOUT`, `NODE`, `EDIT` and `ALLOWED` imported from `guard-cases.js` (Task 18); `hook()`'s made-up default folder (Task 19); `cardOf`'s skip of `Card` lines and the two moved indexes (Task 22, `edit-labels.test.js`) and the three `ZOOM` expectations (Task 22, `edit-kind.test.js`); the card tests rewritten or moved (Task 26, `studio.test.js`); and `env: {}` in `tests/episodes.js` and `tests/phase4.js` (Task 21).
- [ ] **Step 3: Print the installer once.** `cd tool && ./install.sh --print --machine "Sallie's laptop" --drop Drop --import light --handoff 2 "<a scratch BRIMM Video>"` on the Mac Studio: it says the strict lock, and that the open lock waits for the checks by hand. Nothing is written.
