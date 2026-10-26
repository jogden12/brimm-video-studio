# brimm-video: her folder's lock, loosened (design)

Written 2026-10-26 for Jason Ogden, from his decisions of 25 Oct, after Sallie's first walkthrough. **Design only: nothing in it is built.** It replaces section 7 of the 2026-10-22 design (`2026-10-22-brimm-video-light-import-and-fork-design.md`, "Her folder's lock, as an adjustable allowlist") and its phase K, and builds on pull request #40 (branch `claude/laughing-gauss-45eead`, open, not merged). Where it says nothing, the designs of 22 and 25 Oct stand: the import, the card, the gate in `edit.js`, the readings, sessions and their teachings, the dialogs, the hand-off and the guide.

## What this rests on

**Jason's decisions of 25 Oct**, word for word, which win over anything below:

> loosen the lock. the session asks if it is a client session upfront and treats those videos appropriately. the connection to open router is acceptable. this cannot be fully self contained and on machine and still achieve all of the functionality that she wants included.

**Sallie's notes of 25 Oct** that he answered:

- Note 5: "Allow claude code session to create graphics."
- Note 6: "Overall, reduce the locks on her claude code session; she should be able to ask it to do anything that doesn't break or rewrite the code."
- Note 7: "Connect the application to open router and/or standard claude design skills."

**What the coordinating session told Jason would stay locked**, which he did not object to:

1. The code (brimm-video's checkout) and the episode records cannot be changed from her chat, except through brimm-video itself.
2. Once a video is marked a session, its words still cannot be read into the chat, unless she asks for its teachings (and then, as today, what comes in is the principles and Reel ideas after the name check, never the transcript).
3. Nothing is posted or published. He did not change that rule.

Everything else opens: graphics, other programs, the web, design tools, OpenRouter. The OpenRouter key is a new secret on her Mac that Jason puts there himself; Claude never reads it or asks for it.

**The rules that never break** (this repo's `CLAUDE.md`), all kept but two: the tool drafts and never posts or publishes; no `.env` is read; nothing is installed and no launch agent changed without Jason's yes; a failing test first; the main checkout stays on `main`; nothing writes into a watched folder by experiment. What changes is "sends" (section 8): brimm-video now sends one thing outside Anthropic, a picture's description she typed, to OpenRouter. No video or sound leaves the Mac, as before. And the project gets a second secret.

**My reading of "all of the functionality that she wants included"**: it widens Jason's 22 Oct answer on graphics ("that's all": text cards) to the pictures Sallie asks for in note 5. This is question 9 below.

**Prior work this uses:** the lock-gaps note of 25 Oct (`brimm-video-lock-gaps-2026-10-25.md` in the managing session's notes folder: how a session runs unlocked, a session in `Pictures/` among them); the notes research of 25 Oct (`brimm-video-sallie-notes-research-2026-10-25.json`, lens "lock": options a to d, why a single `cat` or `node -e` would read a session's words, and OpenRouter's implications); the triage of that day (`brimm-video-sallie-notes-triage-2026-10-25.md`); and what Claude Code itself does, read on 26 Oct from its documentation (code.claude.com/docs/en/sandboxing, /permissions, /hooks) and from the strings of the two copies on the Mac Studio: the Claude app's own, 2.1.308 (`~/Library/Application Support/Claude/claude-code/2.1.308`, which the Code tab runs), and the Terminal's, 2.1.296. The table in section 1 says where each fact comes from.

## The answer in brief

```
 Her chat, in ~/BRIMM Video Studio (the Code tab)
   │
   │  every tool call, in every mode ──▶ the guard (a hook, outside Claude's reach)
   │                                       ├─ her folder's lock loosened on this Mac?  ──▶ today's lock: edit.js and her skill only
   │                                       ├─ on the never list?                       ──▶ refused
   │                                       ├─ a gated place, or a write outside the workshop? ──▶ refused
   │                                       └─ otherwise                                ──▶ allowed (and Claude Code's own deny rules still apply)
   │
   ├─ brimm-video's edit.js, exactly as today ──▶ runs outside the sandbox: the only way into Episodes, Drop, the records,
   │                                              the dialogs, Final Cut, Claude's readings and OpenRouter
   ├─ any other command (cat, node, python, swift…) ──▶ runs inside Claude Code's sandbox (macOS Seatbelt), children too:
   │                                              no read of a gated place, writes only in the workshop, no network, no Apple Events
   ├─ Read, Glob, Grep ──▶ anywhere but a gated place      Write, Edit ──▶ the workshop only
   ├─ WebSearch, WebFetch, skills, subagents, drawing in the chat ──▶ open
   └─ posting, sending, publishing, sharing; the screen, browser and terminal drivers ──▶ never
```

| # | Settled | The design |
|---|---|---|
| 1 | What stays locked | A never list in code; the gated places, closed to every tool by the guard, Claude Code's `Read()` and `Edit()` deny rules, and its sandbox, which macOS enforces on Bash and everything Bash starts; `edit.js` the only command outside the sandbox |
| 2 | What opens | Bash in the sandbox; reading anywhere but the gated places; writing in a workshop, `~/BRIMM Video Workshop`; the web tools; skills; subagents; drawing in the chat; named connector tools |
| 3 | Graphics | Drawn in the chat, or made in the workshop and turned into a picture by `picture render`, or made by OpenRouter with `picture make`; `graphic add` takes a picture from the workshop too |
| 4 | OpenRouter | One brimm-video command, for pictures, with no-training and zero retention on every request; the key in the Keychain, put there by Jason |
| 5 | Sessions | The questions stay; two additions for Jason: a session drop folder, so her upfront "yes" binds, and the card's receipt, so only her click answers a card |
| 6 | The guard and `behind` | One check of the lock's settings, made by both, the guard at every call; PR #40's checks kept and widened |
| 7 | Her folder, the installer, the setup guide | New settings, a new `CLAUDE.md`, a graphics skill; a per-Mac lock, open on her laptop and strict on the Mac Studio; step 9 rewritten |

---

## 1. What stays locked, and how

### What Claude Code does (2.1.296 and 2.1.308)

Each choice below rests on one of these. Those marked K0 are not yet seen working in the Code tab and are the by-hand test's (section 9) before anything is built.

| # | What it does | Where it says so |
|---|---|---|
| C1 | The sandbox covers shell commands only, and every process they start: "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks run outside it." Read, Edit, Write, WebFetch and WebSearch "follow permission rules instead. A `denyRead` entry doesn't stop the Read tool" | docs, sandboxing |
| C2 | On macOS it is Seatbelt, and "all commands running inside the sandbox, including their child processes, respect" its limits. Subagents "use the same sandbox configuration" | docs, sandboxing |
| C3 | `Read(...)` deny rules are merged into the sandbox's `denyRead`, `Edit(...)` deny rules into `denyWrite`, `Edit(...)` allow rules into `allowWrite`: "Additional paths to deny reading within the sandbox. Merged with paths from Read(...) deny permission rules." | the settings schema in both binaries |
| C4 | Read and Edit deny rules hold Claude's own file tools (and, "best-effort", Glob and Grep), and commands Claude Code recognizes in Bash such as `cat`, but not "a Python or Node script that opens files itself": "For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox." A Read deny rule also blocks Write and Edit on the path; NotebookEdit is not covered | docs, permissions |
| C5 | A deny rule holds a path reached through a link, both ways: "apply when either the requested path or the file it resolves to matches", and a rule written through a linked folder holds at the real place too (since 2.1.268) | docs, permissions |
| C6 | Bash patterns that try to limit a command's words "are fragile"; a deny rule "doesn't match the same program by path or inside `sh -c`" | docs, permissions |
| C7 | A command runs outside the sandbox only when **every** part of it matches an `excludedCommands` entry; a command that cannot be parsed runs inside. Entries from the folder's own settings count unless managed or `--settings` settings set `allowUnsandboxedCommands: false` | both binaries (`shouldUseSandbox`, the excluded-command check) |
| C8 | `allowUnsandboxedCommands: false`: "Claude Code ignores the `dangerouslyDisableSandbox` parameter" (and takes it out of the tool) | docs, sandboxing; binary |
| C9 | `failIfUnavailable: true`: Claude Code "exit[s] at startup" when the sandbox cannot start; one that stops mid-session refuses every sandboxed command ("Only commands the user runs themselves with the `!` prefix, and commands their settings exclude from the sandbox, still run") | docs; 2.1.308 binary |
| C10 | Apple Events are blocked in the sandbox by default (no `osascript` to another app, no `open`); `allowAppleEvents` "is only honored from user, managed, or CLI settings. Project settings cannot enable it" | docs, sandboxing; the Seatbelt profile in the binary ("Apple Events - opt-in") |
| C11 | By default sandboxed commands may write the session's working folder, folders added to it and the temp folder, and read "the entire computer, except certain denied directories. This default still allows reading credential files" | docs, sandboxing |
| C12 | A host not allowed is asked about in the default mode; `strictAllowlist` (refuse instead of asking) is honored only from user, managed or `--settings` settings; "A connection to a host in `deniedDomains` is refused in every permission mode" | docs, sandboxing |
| C13 | From user settings, `allowRead` "takes precedence over denyRead"; `excludedCommands`, `allowWrite` and `allowedDomains` are merged across settings files; `filesystem.disabled` (which drops `denyRead`) and `allowAppleEvents` are honored only from user, managed or `--settings` settings | both binaries |
| C14 | A hook's "allow" does not override the settings: "Deny and ask rules are still evaluated regardless of what the hook returns." The hook is given `cwd`, `transcript_path`, `permission_mode` and the tool's input | docs, hooks |
| C15 | `disableSkillShellExecution`: a skill's inline shell commands "are replaced with a placeholder instead of being run" | both binaries |
| C16 | "a process that a mod starts runs outside the sandbox"; so do command hooks and local MCP servers | docs, sandboxing |
| C17 | A folder added to a session as a working folder brings its "skills, commands, and agents" with it | 2.1.308 binary |

### Why the sandbox, and not a list of banned commands

Sallie's words taken literally would be a list of commands her chat may not run. That does not hold (C4, C6): `cat ~/Lib*/Cloud*/Drop*/*/BRIMM\ Video/Ep*/*/*.txt`, a path built from pieces inside `node -e`, a `find … -exec`, a script written to a file and run: each reads a session's transcript into her chat without naming a path a guard would know. A sandbox of our own around her commands (a `sandbox-exec` wrapper) would be the same Seatbelt with code of our own to keep; Claude Code's is already wired into its Bash tool, its children and its settings (C2, C3), so the design uses it. The guard still refuses a command that names a gated place, so that Claude gets a plain refusal rather than a sandbox error; that is a courtesy, not the boundary.

### The never list (in code; no setting changes it)

Tests pin each entry against the real tool list of a session in the Code tab (taken from a session on the Mac Studio, kept as a fixture).

- **Any tool that posts, publishes, sends, shares, schedules, uploads or deletes on a service.** By name: OpusClip's `create_post_task`, `schedule_publish`, `unschedule_publish`, `share_project`, `create_upload_link` and its make-public and delete tools; `Artifact`, `ArtifactComments`, `ArtifactData` (a page on claude.ai is published, private or not: question 6). **And by word**, so that a connector added later is caught: any MCP tool whose own name (after `mcp__<server>__`) holds `send`, `post`, `publish`, `share`, `schedule`, `upload`, `forward`, `reply`, `invite`, `delete`, `trash` or `remove` is never allowed, even when named in a per-Mac entry. A test runs the rule over the fixture and lists what it catches.
- **The screen, the browser and the terminal**, which could press a dialog, act on a page or run a command outside the sandbox: `mcp__computer-use__*`, `mcp__Claude_Browser__*`, `mcp__claude-in-chrome__*`, `mcp__Control_Chrome__*`, `mcp__playwright__*`, `mcp__terminal__*`.
- **Anything that moves her session out of its lock, or starts one elsewhere:** `mcp__ccd_directory__*`, `mcp__ccd_session__*`, `mcp__ccd_session_mgmt__*`, `mcp__scheduled-tasks__*`, `RemoteTrigger`, `EnterWorktree`, `ExitWorktree`.
- **Anything that changes the app, its plugins or its connectors:** `mcp__ccd_settings__*`, `mcp__ccd_connectors__*`, `mcp__mcp-registry__*`, `SearchPlugins`, `SuggestPluginInstall`, `SuggestSkills`; and `SendMessage`, which talks to other sessions.
- **A Bash call that asks to run outside the sandbox** (`dangerouslyDisableSandbox`), and **brimm-video's `edit.js` in any but its exact form** (below).
- **A read of a gated place, and a write anywhere but the workshop** (below).

### The gated places: never read but by brimm-video

| Place | Why | Held by |
|---|---|---|
| `BRIMM Video/` in Dropbox, all but `Assets/`: `Drop/`, `Episodes/` (with `.importing/`), `Unedited Video/`, and any folder added later | Transcripts, plans and principles of sessions and unanswered videos; folder and file names that may name a client; the records | guard; sandbox `denyRead` of `BRIMM Video` with `allowRead` of `BRIMM Video/Assets`; `Read()` deny rules on `Drop/**`, `Episodes/**`, `Unedited Video/**` |
| `BRIMM VIDEO Transfer/` beside it | Zoom recordings and their transcripts; the transcript tool watches it | guard; `Read()` deny rule |
| `~/BRIMM Video Work/` | The read-only copies of a session's transcript (`shown/`), `agreements.txt` (who agreed to a Reel), libraries and renders | guard; `Read()` deny rule |
| `~/Library/Application Support/BRIMM Video/` | This Mac's settings (the training gate, the lock's per-Mac entries), the guide's note, the approved links, the card's receipts | guard; `Read()` deny rule |
| Places that keep a gated video's name: Claude Code's transcripts and prompt history (`~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.claude/file-history/`); macOS's recent-items lists (`~/Library/Application Support/com.apple.sharedfilelist/`); Dropbox's own data (`~/.dropbox/`, `~/Library/Application Support/Dropbox/`, `.dropbox.cache` at Dropbox's root); brimm-video's log | Each can hold an Episodes folder's name, or the path of a copy `show` opened | guard (with today's carve-out for the session's own tool-results and tasks folders); sandbox `denyRead` (not `Read()` rules for `~/.claude`, which would also stop Claude Code's own reads of saved answers) |
| Spotlight | `mdfind` returns names, and words, from the whole disk | The sandbox's Seatbelt profile gives no access to the metadata service (its list of allowed Mach services has none); K0 checks `mdfind` fails |
| Secrets: `~/.ssh/` (the deploy key), `~/Library/Keychains/`, `~/.aws/`, `~/.config/`, `~/.netrc`, `~/.git-credentials`, `~/.npmrc`, any `.env` | C11: the sandbox reads credential files by default | guard; `Read()` deny rules; sandbox `denyRead` |

Paths are the real ones, built by `settings.js studio` from this Mac's settings (`root`, the home folder) with links followed (C5 holds either way, but the sandbox's own lists are matched as written: the one note on this in the binary, for another feature, says "List each folder by its real path"). On the Mac Studio `~/Movies` is a link into Dropbox; on her laptop Dropbox is under `~/Library/CloudStorage`. K0 checks a read through `~/Dropbox` or any other link is refused.

**Searches that reach a gated place from above.** A Grep or Glob of the home folder would walk into Dropbox. The guard refuses a Glob or Grep whose folder is inside a gated place **or holds one**, and says to search a narrower folder. In the sandbox, a `grep -r ~` is held file by file by Seatbelt.

**A gated video's copies, by id.** `show` and `which` open copies of a gated video from `~/BRIMM Video Work/<episode folder>/shown/`, and the episode folder's name is the dropped file's, which may name a client. Every app that opens a copy (QuickTime Player, TextEdit) adds its path to a recent list, and a sandboxed `defaults read` can read an app's preferences (the profile allows `user-preference-read`). So, in this design, a gated video's copies are opened from `~/BRIMM Video Work/shown/<id>/`, named by its label as now: no recent list anywhere holds more than a label and an id. It is a small change to `shownFolder` (`tool/edit.js:2148`), with a test.

### Writes: the workshop only

Nothing but brimm-video changes the code, her folder's lock, the records, Episodes, the drop folders, Assets, the launch agents, this Mac's settings or the training gate. Concretely:

- **The sandbox** writes only in the workshop (`sandbox.filesystem.allowWrite`) and the temp folder. The workshop is **not** added to the session as a working folder (`permissions.additionalDirectories`): Claude Code loads "skills, commands, and agents" from a folder added so (C17), and a folder Claude writes in must not be one Claude Code takes instructions from. The guard's "allow" and an `Edit()` allow rule let Claude write there with no card (K0 checks it). **Her folder is the session's working folder, which the sandbox would let commands write (C11)**, so the folder's settings deny it (`sandbox.filesystem.denyWrite`), and `Edit()` deny rules (C3) name the checkout, `BRIMM Video`, `BRIMM VIDEO Transfer`, `~/BRIMM Video Work`, `~/Library/Application Support/BRIMM Video`, `~/Library/LaunchAgents`, `~/.claude` and `~/.ssh`.
- **Write and Edit** are allowed by the guard only inside the workshop, never for a file named `CLAUDE.md`, `CLAUDE.local.md` or `.mcp.json` or anything in a folder named `.claude` there (a session started in that folder would take them as its own). NotebookEdit stays denied (C4: no rule covers it).
- **`behind` and the guard** look for any `.claude`, `CLAUDE.md` or `.mcp.json` in the workshop that a sandboxed command made there (K0 checks whether the sandbox's `denyWrite` takes a pattern for these; if not, this look is what holds), and treat one as a loosened lock.

### brimm-video's own command, outside the sandbox

`edit.js` must run outside: it reads and writes Episodes, shows the dialogs, opens Finder and QuickTime, runs ffmpeg and Claude's readings, and calls OpenRouter. So the folder's settings give `sandbox.excludedCommands` one entry, `edit.js` as the folder already allows it (today's `Bash(<node> "<checkout>/tool/edit.js" *)`). Claude Code compares an entry with a command's words with their quotes taken off, and the checkout's path holds spaces: the entry's exact spelling is settled in K0 and pinned by a test.

Three things keep that one door narrow. First, C7: `node "<checkout>/tool/edit.js" episodes && cat …` runs inside the sandbox, where `edit.js` itself then cannot reach Episodes and fails. Second, the guard allows `edit.js` only in today's exact form (the `WORD` rules, `tool/studio.js`), and refuses any other command that names `edit.js` or the checkout's `tool/` folder, so nothing rides on a near match. Third, `allowUnsandboxedCommands: false` (C8), and the guard refuses a call that sets `dangerouslyDisableSandbox` anyway. With `failIfUnavailable: true` (C9), a Mac where the sandbox cannot start opens no session in her folder at all, and she is told to ask Jason.

### The dialogs Claude cannot press

Clearing a session mark and a client's agreement stay clicks on a macOS dialog `edit.js` shows (22 Oct design, section 2). In the sandbox, `osascript` and `open` cannot send Apple Events (C10), and the folder's settings cannot turn that on; the screen, browser and terminal drivers are on the never list. K0 checks a sandboxed `osascript` cannot press the clearing dialog while it is shown.

### Network

- **Sandboxed commands get none** (question 2). The folder's settings say `sandbox.network.deniedDomains: ["*"]`, refused in every mode with no card (C12), if Claude Code takes a bare `*` there (K0). If not, `strictAllowlist: true` goes into her user settings (`~/.claude/settings.json`), the only place it is honored (C12), written by the installer on Jason's yes; it changes nothing in her sessions elsewhere, where the sandbox is off.
- **WebFetch and WebSearch** are open (bare allow rules, so no card). They run in Claude Code's own process, outside the sandbox (C1).
- **OpenRouter** is reached only by `edit.js` (section 4).

### Modes, and the settings that could loosen it

As today: `defaultMode: "default"` (the card needs it), Bypass and Auto off, `disableAllHooks: false`, the guard in exec form with `onFailure: "block"`. New: `disableSkillShellExecution: true` (C15). What could loosen the lock from outside her folder's file, and is looked at by the guard and by `behind` (section 5):

- her folder's `.claude/settings.local.json` (anything of that name), as today;
- her user settings, for the keys honored there (C13): `sandbox.filesystem.disabled`, `sandbox.allowAppleEvents`, any `sandbox.excludedCommands`, `sandbox.filesystem.allowRead` or `allowWrite`, `sandbox.network.allowedDomains`, `sandbox.allowAllUnixSockets`, `sandbox.enableWeakerNetworkIsolation`, and `disableAllHooks`;
- the managed settings, in all three places PR #40 reads (the managed folder, the managed preferences, the server-managed settings), for the same keys and `allowManagedHooksOnly`;
- the Claude app's `--settings` flag, which nothing can read (the lock-gaps note): a known gap, as today.

---

## 2. What opens

- **Bash: any command**, inside the sandbox, with no card (`autoAllowBashIfSandboxed` stays at its default, true, and the guard allows it). `Monitor` is treated as Bash; its commands are sandboxed too (C1).
- **Read, Glob and Grep** anywhere but a gated place: her documents, her other Dropbox folders, the brand's files, the checkout's code.
- **Write and Edit in a workshop**, `~/BRIMM Video Workshop`, on her Mac's own disk (not Dropbox), which `settings.js studio` makes and never adds to the session as a working folder (section 1, "Writes"). It is **outside** her folder on purpose: Claude Code reads a folder's settings only in the session's own folder, but her `CLAUDE.md` and skill from the folders above too (PR #40), so a session started in a folder inside hers looks like hers and has no lock. A session started in the workshop has neither her settings nor her skill, and looks like what it is. `behind` already refuses a session that is not in her folder itself (PR #40). Writing in her folder itself is question 7.
- **WebSearch and WebFetch.**
- **Skills: any skill** (question 3). A skill is instructions; every tool it leads Claude to still meets the guard. Her `brimm-edit`, and a new `brimm-graphics` skill written beside it (section 3).
- **Subagents** (`Agent`): same process, same sandbox (C2), same hooks.
- **Drawing in the chat:** `mcp__visualize__show_widget` and `mcp__visualize__read_me`, by name. Claude draws an SVG or a page in the chat; she downloads it.
- **`PushNotification`**, which reaches only her own phone (her note 2; question 10).
- **Named connector tools.** The settings' `mcp__*` deny is narrowed to the never list's families and the desktop's own servers, so that a connector tool can be named; the guard allows a connector tool only when a per-Mac entry names its server and the tool exactly, and never one the never list's words catch. None is named at first (question 5).
- As today: `AskUserQuestion`, `TodoWrite`, the task tools and `ToolSearch` are left to Claude Code.
- Not opened at first, denied unless Jason allows them: `NotebookEdit`, the `Cron*` tools, `Workflow`, and any tool Claude Code adds later.

**The allowlist is data, as Jason asked on 22 Oct** ("a configurable allowlist, not hard-coded"): `tool/studio/allow.json` in the checkout holds the default (the skills rule, the drawing tools, `PushNotification`), and this Mac's settings may add entries, written only by `node tool/settings.js studio --allow skill|mcp …` on Jason's yes. Entries are typed (`skill`, `mcp-tool`, `tool`), with no wildcard in an `mcp-tool`. The guard reads both at every call; a per-Mac list it cannot read is ignored and never widens anything. `behind` prints the per-Mac additions, so a change shows.

---

## 3. Graphics (note 5)

Four ways, all landing a PNG where `graphic add` finds it:

1. **In the chat.** Claude draws with `show_widget`; she downloads the picture and drops it into the workshop or `Pictures/`.
2. **In the workshop.** Claude writes the graphic as SVG or a small HTML page, then runs a new command, `picture render "<file>" [--size 1920x1080|1080x1920|1080x1080]`: `edit.js`, outside the sandbox, draws it with WebKit on this Mac (the Swift drawer of phase V's renderer, `card make`'s cousin) and writes `<name>.png` beside it by name, never over another, and opens it in Preview. Rendering inside the sandbox may work for some tools (CoreText's font services are on the profile's list), but brimm-video's command is the one that is tested.
3. **Illustrations and photos** Claude cannot draw: `picture make` through OpenRouter (section 4).
4. **Text cards:** `card make` (phase V3), unchanged.

Then "put it up at 1:20" is `graphic add "<name>.png" …`, as now: `graphic add` and `logo` take a picture by its name from `Pictures/` and, new, from the workshop's top folder (`tool/edit.js:3221`), copied into the episode's `media/` by the rule. When phase A brings `Assets/Graphics/`, a picture she keeps goes there by a brimm-video command, never by Claude writing into Dropbox.

**The `brimm-graphics` skill**, written by `settings.js studio` beside `brimm-edit`: the brand guide's colours (navy, fog, light gray, dew, sand, dune, mist, smoke, with their values), Sweet Sans Pro and the script Sinthya when they are installed on her Mac (Varela, then Lucida Grande, until then), the name on screen "Sallie Ogden", never the "with Sallie Holder" marks; the sizes for the main video, a Reel and a post; the three ways above; and that a graphic never holds a client's name or business. It is the brand in one place, so other design skills Claude uses (`theme-factory`, `frontend-design` and the like) are bent to it.

---

## 4. OpenRouter (note 7)

**Not her chat's model, and not the readings.** Her chat would leave the Claude account whose training setting Jason checked, and the readings name one Claude model so that both Macs pick the same Reels (`tool/unedited.js:86`). Both stay with Anthropic.

**One command, for pictures:** `picture make "<name>" --prompt "<her words>" [--size square|wide|tall]`, in `edit.js`, with no episode (so `UNSCOPED`, `tool/gate.js`).

- It sends OpenRouter's image endpoint (`POST https://openrouter.ai/api/v1/images`, which gives the picture back as `b64_json`, per OpenRouter's image-generation page) one model named in this Mac's settings and the prompt, with, on every request, the provider settings OpenRouter documents: `data_collection: "deny"` ("use only providers which do not collect user data") and `zdr: true` ("Restrict routing to only ZDR (Zero Data Retention) endpoints"). If OpenRouter refuses them, or no endpoint fits, it makes nothing and says so. That the image endpoint takes them is checked by hand before it is built (phase K3).
- **What is sent is the prompt, and only that**: never a transcript, a frame, a video, a sound or a file name. It refuses a prompt that holds a name brimm-video knows from a session or a video not yet answered (the names the session name check uses: the speakers it replaced, the words of the dropped files' names), without saying which, with "That description holds a name from a client or group session: say it without the name." The chat never holds a session's words, so this catches what she types herself.
- It writes `<name>.png` into the workshop by name and opens it in Preview; Claude can look at it with Read and suggest another try.
- A limit of pictures a day (a setting; 20 to start), and the cost OpenRouter gives, said in one line.
- Off until Jason turns it on: `node tool/settings.js pictures --openrouter on --model <name> --per-day <n>` (his yes); until then it says "Pictures from OpenRouter are not turned on for this Mac: ask Jason."

**The key**, the project's second secret:

- In the login Keychain of each Mac that makes pictures, as a password named `brimm-video-openrouter`. Jason puts it there himself, in Terminal: `security add-generic-password -s brimm-video-openrouter -a "$USER" -w`, which asks for it, so it is in no file and no shell history. Never by the installer, never in a chat.
- `edit.js` reads it with `/usr/bin/security find-generic-password -s brimm-video-openrouter -w` into memory, puts it in the request's header, and never prints, logs or writes it; a test holds every line it prints and logs against a stand-in key.
- Claude never reads it or asks for it. The guard and the sandbox deny `~/Library/Keychains/`. Whether a sandboxed `security find-generic-password` can reach the Keychain at all is K0's (the profile's list of Mach services names `com.apple.securityd.xpc` but not `com.apple.SecurityServer`, which the login Keychain uses). If it can, the key moves to a file only Jason writes, `~/Library/Application Support/BRIMM Video/openrouter.key` (mode 600), which the guard and the sandbox already deny (question 8).

**What OpenRouter learns:** her picture descriptions, on Jason's account, and through it one image company per request, under the routing above. Nothing of a video.

---

## 5. Sessions in a looser chat

**The questions stay as they are.** Before the drop, the guide asks "Is this video a private session with a client or a group?" (25 Oct design). After the import, the card asks what the video is and whether it is a private session, both answers required in code (22 Oct design). A session's words go to Claude only on "teachings", on the training gate; what comes into the chat is the principles and Reel ideas after the name check, never the transcript; the dialogs, the labels and "never rate, report or share a chat about a session" stay.

**What the looser chat changes, and what holds a gated video** (unanswered, or a session not cleared):

| Opened | How a gated video stays out |
|---|---|
| Read, Glob, Grep | The guard (real paths; searches that hold a gated place refused) and `Read()` deny rules |
| Bash, and everything it starts | The sandbox's `denyRead`, enforced by macOS (C2, C3) |
| `ls` of Drop or Episodes, `mdfind` | The same; Spotlight's service is not on the sandbox's list (K0) |
| Recent lists, app preferences, Dropbox's database, Claude Code's transcripts | Denied where known; and a gated video's copies are opened from a folder named by its id, so what they hold is a label |
| WebSearch, WebFetch | They carry only words in the chat, which never holds a gated video's words or file name |
| OpenRouter | Only her prompt; names from sessions refused |
| The workshop | Holds only what Claude wrote from the chat |
| Skills, plugins | Instructions; the tools they lead to meet the guard. A plugin's own hooks and mods run outside the sandbox (C16): none is added on her laptop without Jason (setup guide) |
| The dialogs | Apple Events blocked in the sandbox; the drivers on the never list |

**Two additions, for Jason** ("asks upfront and treats those videos appropriately"):

1. **Her upfront answer binds: a session drop folder** (question 11). Today her "yes" before the drop only leads to advice (rename the file); the video then sits unanswered until the card, the window in which one wrong click sends a session's words to Claude (the 22 Oct review's worst case), and its Episodes folder is named from the dropped file. Instead: on "yes", `guide drop session` opens `Drop/<this Mac>/Client or group session/`. A video dropped there is marked a session by the import itself (`answer.by: "drop folder"`, private yes), named by its label from the first moment, **its Episodes folder named by its label too**, so no Dropbox listing, Spotlight index or recent list anywhere ever holds the client's name, and the card asks only "teachings, or the transcript only?". A video dropped in the main folder still gets the whole card. It changes the import, so it is its own phase (S), after K.
2. **The card's receipt** (question 12). With the web open, words on a fetched page can try to steer Claude. The one brimm-video command whose misuse would expose a session is `kind` on a video waiting for her answer: run by Claude with "finished" and "no", it sends the video's words to Claude. So a second hook, `PostToolUse` on `AskUserQuestion`, writes each card's question and her answers into a receipt in this Mac's Application Support, which neither the sandbox nor the Write tool can reach; and `kind`, run under Claude Code (which marks the commands it runs with `CLAUDECODE=1`) on a Mac whose folder has the open lock, refuses a waiting video unless a receipt from the last hour holds its label and the same two answers. Her click is then the only way to answer a card. Jason's own runs in Terminal need none.

---

## 6. The guard and `behind`

### One check of the lock, made by both

PR #40's `lockLoosened` (`tool/edit.js`) moves into `tool/studio.js`, widened, as one function both `behind` and the guard call. It says what is loosened, never what a file holds:

- **Kept from PR #40:** the session's folder must be her folder itself, by its real path (more important now: a session in a folder inside hers has neither the guard nor the sandbox); her folder's `settings.local.json`; the user settings; the managed settings in all three places (the managed folder, the managed preferences read with `plutil`, the server-managed `remote-settings.json`).
- **Widened:** `lockBroken` checks, beside the guard hook, Bypass, Auto and hooks, the sandbox's keys (`enabled`, `failIfUnavailable`, `allowUnsandboxedCommands`, the one `excludedCommands` entry and no other, `denyWrite` of her folder, `allowWrite` of the workshop only, the network rule), every gated place's `Read()` rule and `denyRead` entry, the never list's families in `deny`, `disableSkillShellExecution`, and the receipt hook. The user and managed settings are checked for the keys in section 1 ("Modes, and the settings that could loosen it"). The workshop is checked for `.claude`, `CLAUDE.md` and `.mcp.json`.
- **The guard makes the same check at every call** (cached by each file's size and time, in Application Support, so most calls read a handful of `stat`s). While anything is loosened, it answers as today's guard does, `edit.js` and her skill only, and says "This folder's lock is changed on this Mac: ask Jason before going on." So the lock no longer rests on her skill choosing to run `behind` (the lock-gaps note: "behind-never-run").

### The guard's decision, in order

1. Is the lock loosened on this Mac? Then today's decision.
2. On the never list? Deny.
3. Any path in the tool's input (`file_path`, `path`, `notebook_path`, each of `files`): in a gated place, or (for Glob and Grep) holding one? Deny. A write outside the workshop, or of a `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` or anything in a `.claude` folder? Deny.
4. Bash or Monitor: `edit.js` in today's exact form: allow (it runs outside the sandbox). Naming `edit.js` or the checkout's `tool/` in any other form: deny ("Run brimm-video's commands on their own"). `dangerouslyDisableSandbox`: deny. Naming a gated place: deny, as a courtesy. Anything else: allow; it runs in the sandbox.
5. Skill: allow (or only named skills: question 3).
6. An MCP tool: allow when a per-Mac entry names it and the never list's words do not catch it; otherwise deny.
7. Read, Glob, Grep, Write, Edit, WebFetch, WebSearch, Agent, `PushNotification`, `SendUserFile`, the drawing tools: allow.
8. `AskUserQuestion`, `TodoWrite`, the task tools, `ToolSearch`: no answer (left to Claude Code, as today; `AskUserQuestion` must stay so).
9. Anything else, a tool added later among them: deny.

Claude Code's deny rules still apply after the guard's "allow" (C14), so the gated places and the never families are held twice.

### What is replaced

`settingsOf` and `guardDecision` (`tool/studio.js`) are rewritten; `readable` becomes the path check of step 3, its carve-out for the session's tool-results and tasks folders kept. `tool/studio/CLAUDE.md` loses "do not run any other program". `blockReadsOutsideWorkingDirectories` is still not used. PR #40's `--print` line naming the Claude app's copy of Claude Code stays, with the version it compares raised (below).

---

## 7. Her folder, the installer and the setup guide

### A lock per Mac

A new setting, `lock: "strict" | "open"`, says which lock `settings.js studio` writes on this Mac. Strict is today's lock (with PR #40). **Her laptop gets "open"; the Mac Studio keeps "strict"** (question 1): it holds Jason's own Claude transcripts, which name clients, and secrets of his other projects, and the open lock's reads reach the whole disk but the gated places. `node tool/settings.js studio --node <node> --lock open`, on Jason's yes.

### Her folder's settings (open), in outline

```json
{
  "permissions": {
    "defaultMode": "default",
    "disableBypassPermissionsMode": "disable",
    "disableAutoMode": "disable",
    "allow": ["Bash(<node> \"<checkout>/tool/edit.js\" *)", "WebFetch", "WebSearch", "Edit(/<home>/BRIMM Video Workshop/**)"],
    "deny": ["NotebookEdit", "Artifact", "ArtifactComments", "ArtifactData", "RemoteTrigger", "SendMessage",
             "mcp__computer-use__*", "mcp__terminal__*", "…every never family…",
             "Read(/<real BRIMM Video>/Drop/**)", "Read(/<real BRIMM Video>/Episodes/**)", "…every gated place…",
             "Edit(/<checkout>/**)", "Edit(/<real BRIMM Video>/**)", "…every place only brimm-video writes…"]
  },
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "excludedCommands": ["<edit.js, as K0 settles its spelling>"],
    "network": { "deniedDomains": ["*"] },
    "filesystem": {
      "allowWrite": ["<home>/BRIMM Video Workshop"],
      "denyWrite": ["<home>/BRIMM Video Studio"],
      "denyRead": ["<real BRIMM Video>", "<home>/.claude/projects", "…"],
      "allowRead": ["<real BRIMM Video>/Assets"]
    }
  },
  "disableSkillShellExecution": true,
  "disableAllHooks": false,
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "/bin/sh", "args": ["<checkout>/tool/studio/guard.sh", "<node>", "<her folder>"], "onFailure": "block" }] }],
    "PostToolUse": [{ "matcher": "AskUserQuestion", "hooks": [{ "type": "command", "command": "/bin/sh", "args": ["<checkout>/tool/studio/receipt.sh", "<node>"] }] }]
  }
}
```

(`Read()` and `Edit()` rules spell an absolute path with `//` in Claude Code's syntax; the sandbox's own lists take it plainly. The outline shows one slash for both.)

### Her folder's `CLAUDE.md` and skill

`CLAUDE.md` says, in her words: this folder edits The BRIMM's videos with brimm-video, and Claude may also help with anything else (graphics, research, writing, other programs); the BRIMM Video folders, the episodes and the code are changed and read only through brimm-video's commands; nothing is posted, sent or published, the finished videos are posted by hand; a session's or a client's words never go into the chat, a web search, a picture's description or the workshop; files Claude makes go in the workshop; never rate, report or share a chat about a session; for anything the folder refuses, say so plainly and suggest she asks Jason. The `brimm-edit` skill gains a few lines (under its 160-line limit): pictures from the workshop by name, `picture render`, `picture make`, and the session drop folder if Jason takes it. `brimm-graphics` is new (section 3).

### The installer

- `install.sh --print` says which lock this Mac gets, the workshop, the gated places in Finder words, and, for an open lock, that commands run in Claude Code's sandbox with no network.
- `GUARD_CLAUDE` (`tool/install.sh:67`) becomes the version K0 passed on (2.1.308 today, or later), checked for the Terminal's `claude` as now and named for the app's own copy (PR #40). Below it, the installer writes the strict lock, never the open one.
- If K0 finds `deniedDomains: ["*"]` is not taken, `--print` names the one line it would add to her user settings (`strictAllowlist`), and writes it only on Jason's yes.
- It never touches the Keychain.

### The setup guide (`docs/setup/sallies-laptop.md`)

- **Step 9, rewritten** for the open lock, in the Code tab on `~/BRIMM Video Studio`, in every mode the menu offers (PR #40's way), with a made-up gated folder Jason makes for the check (a copy of no real episode: a folder `Episodes/0000 Lock check (test)/` holding one line of made-up words, removed afterwards; never her episodes, never the deploy key):
  - must be refused: reading the made-up transcript with Read, with `cat`, with `node -e`, with `python3`; `ls` of Episodes; a Grep of the home folder; `mdfind` of its words; writing a file into her folder, the checkout and Dropbox; `osascript -e 'display dialog "x"'`; a `curl` to any site; "publish this as a page"; "send this by email"; "take a screenshot"; a command that asks to run outside the sandbox;
  - must work, with no approval card: "What's waiting?"; `date`; a web search; "draw a navy and sand title card in the chat"; "make it as an SVG in the workshop and turn it into a picture"; reading a logo in `Assets/`; once Jason has set the key, "make a picture of a sunrise over a desk".
- **A new step for Jason alone:** the OpenRouter key into the Keychain, and `settings.js pictures … on`.
- **"If something goes wrong"** gains `behind`'s new lines (the sandbox's settings, the user settings' sandbox keys, a `.claude` in the workshop) and keeps "choose the one-time Yes only": "Always allow" writes `settings.local.json`, and Claude Code's `/sandbox exclude` writes there too.
- **Plugins:** none added on her laptop without Jason; a plugin's hooks and mods run outside the sandbox (C16).

---

## 8. Wording to change

**`docs/requirements.md`**, "The workflows (2026-10-22)", the lock bullet and "Kept" become:

> - **Her folder's lock** (2026-10-25): open on her laptop, except for a fixed never list. Claude may do anything that does not break or rewrite the code: graphics, other programs, the web, design skills, OpenRouter. Kept locked: the code and the episode records change only through brimm-video; a session's words never come into her chat but as its approved teachings; nothing is posted or published. OpusClip's posting tools stay denied.
> - **Kept:** the tool drafts and never posts or publishes; no video or sound leaves the Mac. brimm-video sends words to Claude for a reading, and a picture's description she typed to OpenRouter.

and a line under "Decisions" naming this design, and a change line of 2026-10-26.

**`CLAUDE.md`** (this repo), "Rules that are never broken":

> - The tool drafts. It never posts or publishes anything, and nothing in this repo may add that. It sends nothing but what a command is for: words to Claude for a reading, and a picture's description to OpenRouter for `picture make`. No video or sound leaves the Mac.
> - Never read a `.env` file. The project has two secrets: the read-only deploy key on Sallie's laptop, kept only in her `~/.ssh` (never in the repo or Dropbox), which Jason revokes in the repo's GitHub settings when it is no longer needed; and the OpenRouter key, in the Keychain of each Mac that makes pictures, which Jason puts there himself. Claude never reads, prints or asks for either.

**`README.md`:** the `tool/studio.js` row and "On Sallie's laptop" describe the two locks; the `behind` row its new checks; new rows for `picture render` and `picture make`; `graphic add` takes the workshop.

---

## 9. Phases

Each phase is a pull request, a failing test first, merged one at a time on Jason's yes. No test calls the real `claude`, OpenRouter, `security`, `osascript` or the installer without `--print`.

| Phase | What it does | Tested by |
|---|---|---|
| **K0. The sandbox in the Code tab** | By hand, nothing built: a scratch copy of her folder's open settings, on the Mac Studio and on her laptop, in the Code tab, over a scratch `BRIMM Video` tree of made-up files (never Dropbox, never her folder). Checks: the app's copy takes the folder's sandbox settings (`/sandbox` shows it on); C3 and C7 hold (a sandboxed `cat`, `node -e`, `python3`, `ls`, `grep -r` of the scratch Episodes refused; `edit.js … && cat …` runs inside); a read through a link refused; `mdfind`, `defaults read` of QuickTime's and TextEdit's preferences, the recent lists, `security find-generic-password`, `launchctl kickstart` and `osascript` against a shown dialog all fail; the `excludedCommands` spelling with the checkout's spaces; `denyWrite` of the working folder holds; Write, Read and a sandboxed command reach the workshop with no card although it is not a working folder; a `.claude` folder in the workshop; `deniedDomains: ["*"]` refuses `curl` with no card while WebFetch works; `disableSkillShellExecution` from the folder's settings; `failIfUnavailable` in the app (by reading what `/sandbox` says) | Written down; it sets `GUARD_CLAUDE` |
| **K1. The open lock** | The never list, the gated places, the per-Mac `lock`, `allow.json` and `--allow`, the new settings, the guard rewritten, the shared lock check (the guard falling back to strict), `behind`'s new reasons, the workshop, `CLAUDE.md`, the skill's lines, `shownFolder` by id, the installer and the setup guide. Needs PR #40 merged | Unit tests for every entry (section 10); step 9 on her laptop |
| **K2. Graphics** | `brimm-graphics`, `picture render`, `graphic add` and `logo` from the workshop | Fixtures; a by-hand render on her M4 |
| **K3. OpenRouter** | `picture make`, `settings.js pictures`; first a by-hand check, by Jason, that the image endpoint takes `data_collection` and `zdr` | Stand-ins for `security` and the service |
| **S. Sessions** | The session drop folder; the card's receipt. On Jason's yes to questions 11 and 12 | Fixtures; one made-up drop each way |

---

## 10. Tests

- **The settings** (`tests/studio.test.js`): the open shape for a made-up home, checkout and root with spaces and an apostrophe; every gated place in `Read()` rules or `denyRead` by its real path through a link; `allowRead` of `Assets` only; `allowWrite` the workshop only; `denyWrite` her folder; exactly one `excludedCommands` entry; the strict shape unchanged from today.
- **The guard:** every never entry refused, fed the fixture of the Code tab's real tool list; the never words catch every posting tool in the fixture and a made-up connector's `send_invoice`; every gated place refused for Read, Glob, Grep, Write, Edit, `SendUserFile`, by `..`, by a link into it and by a link out of it, and a Glob or Grep of a folder holding one; writes outside the workshop and of `CLAUDE.md`, `.mcp.json` or into `.claude` refused; `edit.js` in its exact form allowed, and with `&&`, `;`, `|`, `$(…)`, an environment prefix, `cd … &&`, another node or another path refused; `dangerouslyDisableSandbox` refused; any other command allowed; a skill allowed; an MCP tool allowed only when named; a tool unknown to the guard refused; and with each kind of loosening, the guard answering as today's.
- **The lock check** (`behind`'s tests, `tests/edit-show.test.js`): each new reason, for each settings source, said once and without a file's words; PR #40's tests kept.
- **The receipt:** a card's answers written by the hook; `kind` refused with none, an old one, another label or other answers, under `CLAUDECODE=1` on an open-lock Mac only.
- **`picture make`:** refused with the setting off, with no key, past the day's limit, and for a prompt holding a session's speaker name or a word of a gated file's name; the request holds the prompt, the model and `data_collection: "deny"` and `zdr: true`, and nothing else of brimm-video's; the key in no printed or logged line; the PNG written by name, never over another.
- **`picture render`, `graphic add` from the workshop, `shownFolder` by id:** fixtures.
- **The gate:** `picture` in `COMMAND_NAMES` and `UNSCOPED`, its HELP line and README row (the walks of 25 Oct's design).
- **The installer:** `--print` lines for each lock and for a Claude Code below the new minimum.

---

## 11. Risks, and what is accepted on Jason's word

- **Words on the web can steer Claude** (a page, a skill, a file in the workshop). Held: the never list, the gated places and the dialogs, which do not rest on Claude's judgement; the card's receipt, if Jason takes it. Not held: brimm-video commands that change an answered video (a name, a cut, a finish), each kept by the rule in `history/` and undone by asking; and anything in her chat, which a page can ask Claude to send on in a later fetch. **Accepted.**
- **Her other files are open to her chat**: her documents, her other Dropbox folders and anything on her Mac not listed as a gated place or a secret, and through WebFetch they could leave the Mac. This is how any Claude Code session with the web works; Jason's "this cannot be fully self contained" accepts it. The known secret places are closed; one not known is a residual risk. **Accepted.**
- **OpenRouter** sees her picture descriptions; its no-training and zero-retention routing is OpenRouter's promise and its providers'; it costs money (the daily limit bounds it). **Accepted** by "the connection to open router is acceptable".
- **Claude Code's own behaviour can change** with an update of the app's copy. The guard falls back to today's lock only when it can see a loosened setting, not a changed meaning. Held in part: the minimum version and step 9 again after a Claude update that changes the sandbox's documentation. **Accepted.**
- **Sandboxed commands have no network**, so some design tools that fetch packages will not work. Opening named hosts later is question 2.
- **The `--settings` flag of the Claude app** cannot be read by `behind` (the lock-gaps note). **Accepted, as today.**
- **Her own Terminal panel** in the Code tab runs anything she types, outside every lock. It is her, not Claude. **Accepted, as today.**
- **A session started in a folder inside hers** has no lock; `behind` refuses it (PR #40), and nothing Claude writes is inside her folder. A session in a folder elsewhere does not look like hers.
- **Plugins** bring hooks and mods that run outside the sandbox; none is added on her laptop without Jason.

## Constraints

- Node 22, no packages; `cd tool && node --test` passes; a failing test first.
- PR #40 merges first (question 4); K1 builds on `main` after it. The guide (merged) keeps its lines; the skill stays under 160 lines.
- Nothing is installed on a Mac; Claude Code's sandbox is part of Claude Code and uses macOS's own Seatbelt.
- K0 is made on scratch copies only; experiments never write into a watched folder.

## Left to the builder

- The exact `excludedCommands` spelling, from K0.
- How the guard caches the lock check, so a call stays fast.
- The step texts of `picture make`'s and `picture render`'s refusals, in plain words.
- Which recent-list and preference places K0 finds holding names, added to the gated places.

## Jason's questions

1. **Where the open lock applies.** Her laptop only; the Mac Studio's folder for Claude keeps today's lock, since that Mac holds your own transcripts and your other projects' secrets. *Recommended: her laptop only.*
2. **Network for her commands.** None (web pages reach her chat only through WebSearch and WebFetch, OpenRouter only through brimm-video), or named package hosts for design tools that need them. *Recommended: none, for now.*
3. **Skills.** Any skill, since a skill grants no tool; or only skills you name. *Recommended: any skill.*
4. **PR #40.** Merge it as it is first, then build this on it. *Recommended: yes.*
5. **Connectors.** None named at first; Canva's connector (designs kept online, with share and publish tools the never list would refuse) only on a later yes. *Recommended: none at first.*
6. **Artifact pages.** They stay on the never list: a page on claude.ai is published, if privately. *Recommended: keep them refused.*
7. **Where Claude writes.** Only a workshop, `~/BRIMM Video Workshop`, outside her folder; or also her folder (and its `Pictures/`), where a session started in a subfolder would look like hers with no lock. *Recommended: the workshop only.*
8. **The OpenRouter key's place.** The Keychain, put there by you in Terminal; or a file only you write, if K0 finds a sandboxed command can reach the Keychain. *Recommended: the Keychain.* And first ask Sallie what she wants OpenRouter for: this design covers pictures only.
9. **Graphics beyond text cards.** Your 25 Oct words widen your 22 Oct "that's all" to the pictures she asks for: drawn in the chat, made in the workshop, made by OpenRouter. *Recommended: yes.*
10. **`PushNotification`** to her phone, as her note 2 asked. *Recommended: yes.*
11. **The session drop folder**, so that her upfront "yes" marks the video a session at the import, named by its label from the start. *Recommended: yes, as phase S after K.*
12. **The card's receipt**, so that only her click answers a card. *Recommended: yes, in phase S.*
13. **The guard falls back to today's lock** whenever anything about the lock is loosened on her Mac, rather than relying on `behind` at the start. *Recommended: yes.*
