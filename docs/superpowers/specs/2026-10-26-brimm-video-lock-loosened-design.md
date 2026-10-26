# brimm-video: her folder's lock, loosened (design)

Written 2026-10-26 for Jason Ogden, from his decisions of 25 Oct, after Sallie's first walkthrough. Revised the same day after four reviews: privacy, code safety, how Claude Code really behaves, and OpenRouter and design tools. "What the review changed", just before the questions, says what each finding changed, or why it did not. Revised again the same day after K0's lab checks, with Jason's yes to all 18 recommendations kept: "What K0 changed", after it, says where each of K0's 20 changes went. **Design only: nothing in it is built.** It replaces section 7 of the 2026-10-22 design (`2026-10-22-brimm-video-light-import-and-fork-design.md`, "Her folder's lock, as an adjustable allowlist") and its phase K, and builds on pull request #40 (branch `claude/laughing-gauss-45eead`, open, not merged). Where it says nothing, the designs of 22 and 25 Oct stand: the import, the card, the gate in `edit.js`, the readings, sessions and their teachings, the dialogs, the hand-off and the guide.

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

Item 2 has a consequence the first draft missed. What comes into a chat on "teachings" holds some of a session's own words: each principle's key phrases, word for word (`tool/teachings.js:332`), which her skill tells Claude to show exactly as printed. And `show` prints an ordinary video's words into a chat; if that video is later found to be a session after all, the chat still holds them (`tool/gate.js`, printWhy). So a chat sometimes does hold a session's words. **Such a chat keeps today's lock** (section 5): nothing in it can reach the web, OpenRouter, the workshop or her phone.

Everything else opens: graphics, other programs, the web, design tools, OpenRouter. The OpenRouter key is a new secret on her laptop that Jason puts there himself; Claude never reads it or asks for it.

**The rules that never break** (this repo's `CLAUDE.md`), all kept but two: the tool drafts and never posts or publishes; no `.env` is read; nothing is installed and no launch agent changed without Jason's yes; a failing test first; the main checkout stays on `main`; nothing writes into a watched folder by experiment. What changes is "sends" (section 8): brimm-video now sends one more thing outside Anthropic, a picture's description, which Claude writes from her request, to OpenRouter. No video or sound leaves the Mac, as before. And the project gets a second secret.

**My reading of "all of the functionality that she wants included"**: it widens Jason's 22 Oct answer on graphics ("that's all": text cards) to the pictures Sallie asks for in note 5. This is question 11.

**Prior work this uses:**

- The lock-gaps note of 25 Oct (`brimm-video-lock-gaps-2026-10-25.md` in the managing session's notes folder): how a session runs unlocked, a session in `Pictures/` among them.
- The notes research of 25 Oct (`brimm-video-sallie-notes-research-2026-10-25.json`, lens "lock"): options a to d, why a single `cat` or `node -e` would read a session's words, and OpenRouter's implications. And the triage of that day (`brimm-video-sallie-notes-triage-2026-10-25.md`).
- What Claude Code itself does, read on 26 Oct from its documentation (code.claude.com/docs/en/sandboxing, /permissions, /hooks) and from the strings of the two copies on the Mac Studio: the Claude app's own, 2.1.308 (`~/Library/Application Support/Claude/claude-code/2.1.308`, which the Code tab runs), and the Terminal's, 2.1.296.
- The four reviews of 26 Oct. One of them ran three `claude -p` sessions of the app's 2.1.308 on made-up files, never her folder or Dropbox (the "lab": `lock-lab2/runtime-lens/` in the managing session's scratchpad).
- **K0's lab checks of 26 Oct** (`docs/superpowers/notes/2026-10-26-lock-k0-findings.md`): 50 `claude -p` runs of the app's 2.1.308 on the Mac Studio, in lab folders of made-up files, from the command line, untrusted. Every result there is "held in the lab"; the Code tab, a trusted folder and her laptop are K0's by-hand round (section 9).
- The 2.1.308 binary's settings schema and its macOS sandbox wrapper, read on 26 Oct for the app's environment (C27): which variables a setting can take away from sandboxed commands, and which it cannot.
- OpenRouter's public pages on image generation, zero retention, guardrails, limits and logging, and its list of zero-retention endpoints (fetched 26 Oct).

The table in section 1 says where each fact comes from, and what K0 found.

## The answer in brief

```
 Her chat, in ~/BRIMM Video Studio (the Code tab)
   │
   │  every tool call, in every mode ──▶ the guard (a hook, outside Claude's reach)
   │                                       ├─ her folder's lock loosened on this Mac?        ──▶ today's lock: edit.js and her skill only
   │                                       ├─ this chat holds a session's words?             ──▶ today's lock, and no picture make
   │                                       ├─ on the never list?                             ──▶ refused
   │                                       ├─ a gated place (by what it is, not its spelling),
   │                                       │  or a write outside the workshop?               ──▶ refused
   │                                       └─ otherwise                                      ──▶ allowed (Claude Code's own deny rules still apply)
   │
   ├─ brimm-video's edit.js, in its one exact spelling, nothing before it ──▶ runs outside the sandbox: the only way into Episodes,
   │                                              Drop, the records, the dialogs, Final Cut, Claude's readings and OpenRouter
   ├─ any other command (cat, grep, rg, find, node, python, swift…) ──▶ runs inside Claude Code's sandbox (macOS Seatbelt), children
   │                                              too: no read of a gated place, writes only in the workshop, no network, no Apple
   │                                              Events, and none of the app's secrets but the sandbox's own proxy login
   ├─ Read ──▶ anywhere but a gated place      Write, Edit ──▶ the workshop only      (2.1.308 has no Glob or Grep tool)
   ├─ named skills, subagents in her folder, drawing in the chat ──▶ open
   ├─ WebSearch, WebFetch ──▶ held until K0 shows the app's secrets cannot be read from the sandbox (section 1; question 19)
   └─ posting, sending, publishing, sharing; Artifact pages; the screen, browser and terminal drivers; local extensions ──▶ never
```

| # | Settled | The design |
|---|---|---|
| 1 | What stays locked | A never list in code; the gated places, closed first by Claude Code's sandbox, which macOS (Seatbelt) enforces on Bash and everything Bash starts, then by Claude Code's `Read()` and `Edit()` deny rules for its own file tools, and by the guard, which compares a path by what it is, not how it is spelled; `edit.js` the only command outside the sandbox, in one exact spelling with nothing before it; the app's secrets taken out of sandboxed commands' environment |
| 2 | What opens | Bash in the sandbox; reading anywhere but the gated places; writing in a workshop, `~/BRIMM Video Workshop`; named skills; subagents that stay in her folder; drawing in the chat; named connector tools. The web tools once K0's by-hand round shows the app's secrets cannot be read from the sandbox |
| 3 | Graphics | Sketched in the chat; made in the workshop and turned into a picture by `picture render`, a new WebKit drawer that loads nothing but the one file; made by OpenRouter with `picture make`; `graphic add` takes a picture from the workshop by name |
| 4 | OpenRouter | One brimm-video command, for pictures; one model and one zero-retention provider, pinned in each request and by the key's own guardrail; a daily count and a dollar budget; the key in her laptop's Keychain, put there by Jason |
| 5 | Sessions | The questions stay. A chat that holds a session's words keeps today's lock. The card's receipt, with the card's wording fixed in code, comes with the open lock. The session drop folder follows as phase S |
| 6 | The guard and `behind` | One check of the lock's settings, made by both, the guard at every call; PR #40's checks kept and widened |
| 7 | Her folder, the installer, the setup guide | New settings, a new `CLAUDE.md`, a graphics skill; a per-Mac lock, open on her laptop and strict on the Mac Studio; her user settings' deny rules; step 9 rewritten |

---

## 1. What stays locked, and how

> **K0, 2026-10-26.** This design is revised to match K0's lab checks (`docs/superpowers/notes/2026-10-26-lock-k0-findings.md`). The table below gives each claim's result; "What K0 changed", near the end, says where each of the note's 20 changes went. What K0 could not check headless is its by-hand round (section 9).

### What Claude Code does (2.1.296 and 2.1.308)

Each choice below rests on one of these. "Lab" means the first lab saw it with `claude -p` of 2.1.308 (above). "K0" is what K0's lab found, in lab folders that were not trusted (C31). What K0 left is its by-hand round in the Code tab (section 9), which comes before anything is built.

| # | What it does | Where it says so | K0 |
|---|---|---|---|
| C1 | The sandbox covers shell commands only, and every process they start: "The sandbox covers shell commands only. Claude's file tools, MCP servers, and hooks run outside it." Read, Edit, Write, WebFetch and WebSearch "follow permission rules instead. A `denyRead` entry doesn't stop the Read tool" | docs, sandboxing; lab | **Held.** Sandboxed `cat`, `head`, `node -e`, `python3 -c`, `ls`, `grep -r` and `find` of the scratch Episodes were refused, and the sandbox could not make a hard link. A hard link made **outside** the sandbox is readable (C35) |
| C2 | On macOS it is Seatbelt, and "all commands running inside the sandbox, including their child processes, respect" its limits. Subagents "use the same sandbox configuration". The guard, a PreToolUse hook, is called for a subagent's tool calls with the chat's `session_id` and `transcript_path`, plus `agent_id` and `agent_type`, in the background too | docs, sandboxing; K0 | **Held**, and its open question answered: yes |
| C3 | `Read(...)` deny rules are merged into the sandbox's `denyRead`, `Edit(...)` deny rules into `denyWrite`, `Edit(...)` allow rules into `allowWrite`: "Additional paths to deny reading within the sandbox. Merged with paths from Read(...) deny permission rules." | the settings schema in both binaries; lab | **Held** for `Edit()`: sandboxed writes got EPERM. The `Read()` half was seen by the first lab |
| C4 | Read and Edit deny rules hold Claude's own file tools; a Read deny rule also blocks Write and Edit on the path ("File is covered by a Read deny rule … cannot be written"). They do **not** hold a command in Bash in a sandboxed session: there the permission layer let `cat` of a `Read()`-denied path through as a sandboxed auto-allow, with no card, and only Seatbelt refused it. The docs say as much for scripts: "For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox." Whether the rules hold `cat` in a folder with no sandbox (her user settings, question 5) is untested. NotebookEdit is not covered | docs, permissions; K0 | **Did not hold, in part.** Glob and Grep: absent (C20). NotebookEdit: not checked |
| C5 | A deny rule holds a path reached through a link, both ways: "apply when either the requested path or the file it resolves to matches", and a rule written through a linked folder holds at the real place too (since 2.1.268) | docs, permissions | **Held.** A Write through a workshop link into the Studio was denied, a sandboxed write through it got EPERM, and a Read through a link into Episodes was denied |
| C6 | Bash patterns that try to limit a command's words "are fragile"; a deny rule "doesn't match the same program by path or inside `sh -c`" | docs, permissions | Not checked |
| C7 | A command runs outside the sandbox when it matches an `excludedCommands` entry, matched as text, **after Claude Code strips some wrappers in front of it**: `nice <the entry's spelling>` and `env -u SANDBOX_RUNTIME <the entry's spelling>` also ran outside. Bare `node`, Homebrew's Cellar node and a quoted node path all ran inside; `… && cat …` runs inside; a command that cannot be parsed runs inside. Entries from the folder's own settings count, but are dropped when managed or `--settings` settings set `allowUnsandboxedCommands: false` ("excludedCommands restricted to trusted settings tiers") | both binaries (`shouldUseSandbox`); lab; K0 | **Did not hold, in part.** The full node path with spaces ran outside, `&&` ran inside, and `--settings` with `allowUnsandboxedCommands: false` dropped the entry, as written. But "every part matches" is looser: `nice` and `env -u` ride along. `timeout`, `nohup`, `time` and `stdbuf` were not tried |
| C8 | `allowUnsandboxedCommands: false`: "Claude Code ignores the `dangerouslyDisableSandbox` parameter" (and takes it out of the tool) | docs, sandboxing; binary | **Held** |
| C9 | `failIfUnavailable: true`: Claude Code "exit[s] at startup" when the sandbox cannot start; one that stops mid-session refuses every sandboxed command ("Only commands the user runs themselves with the `!` prefix, and commands their settings exclude from the sandbox, still run"). The binary reads it from the merged settings, the folder's included | docs; 2.1.308 binary | Not checkable headless: a healthy Mac's sandbox started even with no `rg` |
| C10 | Apple Events are blocked in the sandbox by default (no `osascript` to another app, no `open`); `allowAppleEvents` "is only honored from user, managed, or CLI settings. Project settings cannot enable it" | docs, sandboxing; the Seatbelt profile in the binary; lab | Not checked: no `osascript` was run. `launchctl list` gave 0 lines in the sandbox (582 outside) and `pbpaste` 0 bytes |
| C11 | By default sandboxed commands may write the session's working folder, folders added to it (their `.claude/settings.json` included) and the temp folder, and read "the entire computer, except certain denied directories. This default still allows reading credential files". They can write anywhere under `/private/tmp/claude*` | docs, sandboxing; lab; K0 | **Held** |
| C12 | A host not allowed is asked about in the default mode; "A connection to a host in `deniedDomains` is refused in every permission mode". A bare `"*"` there is taken: `curl` was refused with no card. Raw TCP, direct DNS, the proxy bypass and `127.0.0.1` were refused too, in Auto and Bypass modes as well | docs, sandboxing; the schema; lab; K0 | **Held** |
| C13 | `allowRead` "takes precedence over denyRead", from the folder's own settings as well as the user settings (K0: `allowRead` of Assets beat `denyRead`, "ASSET OK 1234"); `excludedCommands`, `allowWrite` and `allowedDomains` are merged across settings files; `filesystem.disabled` (which drops `denyRead`) and `allowAppleEvents` are honored only from user, managed or `--settings` settings | both binaries; K0 | **Held, and wider.** The other keys were not checked |
| C14 | A hook's "allow" does not override the settings: "Deny and ask rules are still evaluated regardless of what the hook returns." So a deny rule beats every allow, the guard's and the settings' own. But the hook is called **before** Claude Code's deny check unless the path matches a rule as text (the real path, with letter case, `..`, `//` and `~` folded): a Read through a link or through `/System/Volumes/Data/…` reached the guard, which answered allow, and was then refused; so did a Bash call refused through an `Edit()` rule. The hook is given `session_id`, `cwd`, `transcript_path`, `permission_mode`, the tool's input, `effort`, `prompt_id` and `tool_use_id` | docs, hooks; lab; K0 | **Did not hold, in part**: "never reached the hook" holds only for spellings that match a rule as text |
| C15 | `disableSkillShellExecution`: a skill's inline shell commands "are replaced with a placeholder instead of being run" | both binaries; lab | **Held**, from the folder's settings |
| C16 | "a process that a mod starts runs outside the sandbox"; so do command hooks (a hook could run `ps`, which the sandbox refuses) and local MCP servers. A mod started whatever `--setting-sources` said, and skills from `~/.claude/skills` loaded too | docs, sandboxing; K0 | **Held** |
| C17 | A folder added to a session as a working folder brings its "skills, commands, and agents" with it, and its settings can turn a plugin on ("An added directory's settings (--add-dir) turn a plugin … on"). It is among the session's `additional_directories` and the sandbox's write list | 2.1.308 binary; lab; K0 | **Held, in part checked**: whether its skills, commands or plugins load was not checked |
| C18 | The Seatbelt profile always allows the Keychain's service (`(allow mach-lookup (global-name "com.apple.SecurityServer"))`; the first draft said otherwise). With `~/Library/Keychains` in `denyRead`, a sandboxed `security list-keychains` showed only `System.keychain` | 2.1.308 binary; lab | Not checked: the check adds an item to the login Keychain |
| C19 | Whenever any read is denied, the profile adds `(allow file-read-metadata (vnode-type DIRECTORY))`: `test -d "<a guessed folder>"` is answered inside the sandbox, though listing it is refused | 2.1.308 binary; K0 | **Held**: the right guess printed "EXISTS"; `test -f`, `test -e`, `stat` and `ls` were refused |
| C20 | **2.1.308 has no Glob or Grep tool**: neither is in `-p`'s tool list (21 tools: "Task, Bash, …, Read, …, Write") nor in a Code-tab session of the same version. Searching is Bash's `find`, `grep` and `rg` (the shell snapshot's bfs and ugrep), inside the sandbox. What the binary says of Glob's pattern (it searches from an absolute pattern's own base folder, whatever `path` says) matters only if a later version brings Glob back | K0; 2.1.308 binary | Not checkable: the tools are absent |
| C21 | The subagent tool's input can carry `isolation: "worktree" \| "remote"` ("remote launches the agent in a remote cloud environment") and `cwd`; these are switched on per account. The `-p` tool list names the tool `Task`; the first lab saw calls named `Agent`. Which name the guard receives in the Code tab is not recorded | 2.1.308 binary; lab; K0 | Not checked: `isolation` and `cwd` were not tried |
| C22 | A skill can register hooks ("Registered … hooks from skill"), and carries `allowed-tools` and `shell`; an agent definition can bring hooks and MCP servers | 2.1.308 binary | Not checked |
| C23 | AskUserQuestion's result has `afkTimeoutMs` when the card resolved itself after she was idle ("Absent on every human-resolved path"); it then submits what she had selected but not sent. On Bash, `PostToolUse` fires on success only; a non-zero exit goes to `PostToolUseFailure`, with no `tool_response` | 2.1.308 binary; K0 | Not checkable headless: it needs a card and a person |
| C24 | Every command Claude Code runs gets `CLAUDECODE=1`; a sandboxed one also gets `SANDBOX_RUNTIME=1`. **A command can remove it**: `env -u SANDBOX_RUNTIME …`. Every command, sandboxed, excluded, in the background or a subagent's, also gets `CLAUDE_CODE_SESSION_ID` (equal to the hook's `session_id`) and `CLAUDE_PID`; **a SessionStart hook can overwrite both** through `CLAUDE_ENV_FILE`, while hooks still see the true values | lab; 2.1.308 binary; K0 | **Held**, but `SANDBOX_RUNTIME` is a hint, not proof |
| C25 | A Monitor call with `ws` and no `command` runs in Claude Code's own process, outside the sandbox | 2.1.308 binary | Not checked; `Monitor` stays denied either way |
| C26 | Node's `realpathSync` gives back `/USERS/<her>/library` and `/System/Volumes/Data/Users/<her>/Library` as typed (`.native` fixes the letter case, not the second). APFS ignores letter case, and `/usr/share/firmlinks` maps `/Users` to `/System/Volumes/Data/Users`: each spelling opens the same folder. Claude Code folds letter case for deny rules (`caseInsensitiveTarget`), and **refuses a Read through `/System/Volumes/Data/…` with only the real spelling in the rules**; so does Seatbelt for `head`, `python3`, `node`, `ls` and `grep -r`. The second spelling in the rules is not needed in 2.1.308; it is kept, as harmless | run on the Mac Studio; 2.1.308 binary; K0 | **Held**, and its unknown answered |
| C27 | **The app's whole environment reaches every sandboxed command**: `CLAUDE_CODE_USER_EMAIL`, the account and organization ids (`CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_ORGANIZATION_UUID`), `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN`, `SSH_AUTH_SOCK`; the sockets themselves were blocked. The sandbox also gives each command **its own proxy's per-session login**, in `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` and their kin (`<…>:<token>@localhost:<port>`). `sandbox.credentials.envVars` entries with `mode: "deny"` take a variable away: "`deny` unsets the variable for sandboxed commands"; the schema does not keep it from project settings. On macOS the wrapper is `env -u <each denied name> … HTTP_PROXY=… … /usr/bin/sandbox-exec …`, so the proxy variables are set **after** the denied names are taken away, and no setting removes them | K0 (network, R8); 2.1.308 binary (schema, macOS wrapper) | The environment: **held** (seen). The `envVars` entries: not run |
| C28 | **Process information is readable from the sandbox.** `ps` and `pgrep` are refused, but `python3` with libproc and `sysctl(KERN_PROCARGS2)` listed 986 processes and read a made-up `ffmpeg`'s full arguments, an Episodes path among them. `lsof -nP -i` (other apps' connections), `lsappinfo` and the host and computer names were readable too. Whether `lsof` shows another process's open files by their real paths was not tried | K0 (network, R8, R9) | Seen |
| C29 | **WebFetch reaches numeric addresses** on the Mac and the home network, outside `deniedDomains`: `http://127.0.0.1:47321/` was switched to https and connected. `localhost` and names without a dot are refused ("cannot fetch localhost or other hostnames without a dot") | K0 (network) | Seen |
| C30 | **The Code tab adds a working folder to every session**, `--add-dir=~/Library/Application Support/Claude/side-session-notes/<id>`, which sandboxed commands can write. The parent `claude`'s arguments, its `--settings` and `--add-dir` among them, can be read with `ps -ww -o args= -p <pid>` outside the sandbox (on a workflow child session of Jason's, `--settings` was `{"ultracode":true,"deniedMcpServers":[…]}`). A folder added by `/add-dir` mid-chat shows not in the hook's input but in the transcript's `environment` entry, `"additionalWorkingDirectories"`. Each chat is its own `claude` process: `node ← zsh ← claude` above `edit.js`, `node ← sh ← claude` above the guard | K0 (hooks, H7; network) | Seen on the Mac Studio |
| C31 | **An untrusted folder's `permissions.allow` and `additionalDirectories` are ignored** ("Ignoring 4 permissions.allow entries … this workspace has not been trusted"); deny rules, the sandbox and hooks still apply. So `edit.js`, the web tools and workshop writes each ask a card. On the Mac Studio `~/BRIMM Video Studio` has no entry in `~/.claude.json` | K0 | Seen |
| C32 | **`--resume` keeps the `session_id`** in a new process; **`--fork-session` gives a new one** (`source: "fork"`), whose transcript carries the old chat's words with all its message `uuid`s unchanged | K0 (hooks, runs 12, 13) | Seen |
| C33 | **`/sandbox` still offers "No sandbox"**: what it draws reported `"enabled": true, "enabled_in_settings": true, "unsandboxed_fallback": false` and `"no_sandbox_allowed": true`. What that choice writes was not seen | K0 (network, R1) | Seen; the screen is not checkable headless |
| C34 | **Claude Code makes `<working folder>/.claude/.cc-writes/` itself** at each session start: an empty folder, mode 0700 | K0 (writes) | Seen |
| C35 | **A hard link to a gated file, made outside the sandbox at an ungated path, is readable** by a sandboxed `head` and by the Read tool | K0 (reads, r08, r12) | Seen |
| C36 | **Command output is written into the temp folder**, `/private/tmp/claude-<uid>/<working folder, as Claude Code writes it>/<session>/tasks/<id>.output`. With that folder in `denyRead`, every plain `cat` fails ("cat: stdout: Operation not permitted"), `node` writing back aborts (exit 134), here-strings fail ("can't create temp file for here document") and the shell snapshot is lost (no `rg`). Three narrow `allowRead` entries fix all of it but heredocs: that working folder's own subfolder of the temp folder, `~/.claude/shell-snapshots` and `~/Library/Application Support/Claude/claude-code`. Claude Code still reads its saved answers (a 43KB output under `~/.claude/projects/…/tool-results/`). In `-p` each output file was deleted after its command; a long Code-tab chat's background tasks may keep theirs | K0 (reads, r01, r05, r10) | Seen |

### Why the sandbox, and not a list of banned commands

Sallie's words taken literally would be a list of commands her chat may not run. That does not hold (C4, C6): `cat ~/Lib*/Cloud*/Drop*/*/BRIMM\ Video/Ep*/*/*.txt`, a path built from pieces inside `node -e`, a `find … -exec`, a script written to a file and run: each reads a session's transcript into her chat without naming a path a guard would know. A sandbox of our own around her commands (a `sandbox-exec` wrapper) would be the same Seatbelt with code of our own to keep; Claude Code's is already wired into its Bash tool, its children and its settings (C2, C3), so the design uses it. The guard still refuses a command that names a gated place, so that Claude gets a plain refusal rather than a sandbox error; that is a courtesy, not the boundary. K0 bears this out: in a sandboxed session Claude Code's permission layer let `cat` of a `Read()`-denied path through, and only Seatbelt refused it (C4).

### The never list (in code; no setting changes it)

Tests pin each entry against the real tool list of a session in the Code tab (taken from a session on the Mac Studio, kept as a fixture).

- **Any tool that posts, publishes, sends, shares, schedules, uploads or deletes on a service.** By name: OpusClip's `create_post_task`, `schedule_publish`, `unschedule_publish`, `share_project`, `create_upload_link` and its make-public and delete tools. **And by word**, so that a connector added later is caught: any MCP tool whose own name (after `mcp__<server>__`) holds `send`, `post`, `publish`, `share`, `schedule`, `upload`, `forward`, `reply`, `invite`, `delete`, `trash` or `remove` is never allowed, even when named in a per-Mac entry. A test runs the rule over the fixture and lists what it catches.
- **Artifact pages:** `ArtifactComments`, `ArtifactData`, and `Artifact`'s reading, listing and deleting, whatever question 12's answer. The BRIMM Ops page is a claude.ai artifact (`tool/guide.js:9`): it holds sessions' principles, and a session after all's words until the withdrawal. Publishing a private page of her own is question 12; until it is answered, `Artifact` is refused whole.
- **The screen, the browser and the terminal**, which could press a dialog, act on a page or run a command outside the sandbox: `mcp__computer-use__*`, `mcp__Claude_Browser__*`, `mcp__claude-in-chrome__*`, `mcp__Control_Chrome__*`, `mcp__playwright__*`, `mcp__terminal__*`.
- **Local extensions, which run outside the sandbox (C16)**, by kind: file and folder readers, PDF tools (`mcp__PDF_Tools__*`, `mcp__plugin_pdf-viewer_pdf__*`), "Control your Mac", knowledge stores (`mcp__knowledge-mcp__*`), `DesignSync`, and every `mcp__ccd_*` tool (the app's own, `mcp__ccd_host__reveal_path` among them). A per-Mac entry may name only a claude.ai connector's tool, whose server the app names by an id (`mcp__<id>__<tool>`), never a local extension's. A test runs the rule over the fixture.
- **Anything that moves her session out of its lock, or starts one elsewhere:** `mcp__ccd_directory__*`, `mcp__ccd_session__*`, `mcp__ccd_session_mgmt__*`, `mcp__scheduled-tasks__*`, `RemoteTrigger`, `EnterWorktree`, `ExitWorktree`; and **the subagent tool with `isolation` or `cwd` in its input** (a remote agent has no guard, no sandbox and no never list, and would have her claude.ai connectors: C21), or naming an agent definition other than Claude Code's built-in ones (C22). The guard takes the subagent tool by both its names, `Agent` and `Task`, until the name it receives in the Code tab is recorded (C21).
- **Anything that changes the app, its plugins or its connectors:** `mcp__ccd_settings__*`, `mcp__ccd_connectors__*`, `mcp__mcp-registry__*`, `SearchPlugins`, `SuggestPluginInstall`, `SuggestSkills`; and `SendMessage`, which talks to other sessions.
- **A Bash call that asks to run outside the sandbox** (`dangerouslyDisableSandbox`), and **brimm-video's `edit.js` in any but its one exact spelling, with anything in front of it, or in the background** (below).
- **A read of a gated place, and a write anywhere but the workshop** (below).
- **WebFetch to a numeric or local address** (C29; section 1, "Network").
- **In a chat that holds a session's words:** everything but brimm-video's commands and her skill, and `picture make` too (section 5).

### The gated places: never read but by brimm-video

**How a read is held, in order of strength:**

1. **The sandbox (Seatbelt)** holds every sandboxed command and every process it starts, by `denyRead`. macOS enforces it, whatever the command is or however it spells a path. In K0 it was the only thing that held `cat` of a gated file in a sandboxed session (C4); it also refused the `/System/Volumes/Data` spelling and changed letter case (C26).
2. **Claude Code's `Read()` deny rules** hold its own file tools: Read, and Write and Edit on the same path (C4). They match a path as text, with links and letter case folded (C5, C26). They do not hold Bash in a sandboxed session (C4).
3. **The guard** holds every tool by a path's identity (below), and refuses a command that names a gated place, as a courtesy. A call whose path matches a deny rule as text is refused before the guard is asked; one through a link or `/System/Volumes/Data` reaches the guard first, and both refuse it (C14).

| Place | Why | Held by |
|---|---|---|
| `BRIMM Video/` in Dropbox, all but `Assets/`: `Drop/`, `Episodes/` (with `.importing/`), `Unedited Video/`, and any folder added later | Transcripts, plans and principles of sessions and unanswered videos; folder and file names that may name a client; the records | sandbox `denyRead` of `BRIMM Video` with `allowRead` of `BRIMM Video/Assets` (C13); `Read()` deny rules on `Drop/**`, `Episodes/**`, `Unedited Video/**`; guard |
| `BRIMM VIDEO Transfer/` beside it | Zoom downloads and their transcripts (`tool/guide.js`, ZOOM_WORDS); the transcript tool watches it | sandbox `denyRead`; `Read()` deny rule; guard |
| Copies of a session outside BRIMM Video: the folder Zoom records into on that Mac (by default `~/Documents/Zoom`, holding the sound, the video and `chat.txt`, in a folder named for the meeting), and Final Cut's library backups, `~/Movies/Final Cut Backups` (README, "A library's backups"), named by the Episodes folder and holding the captions | With Bash open, sound alone becomes words: the Mac's own transcription runs offline in the sandbox. macOS's prompts for Documents and Downloads are hers to click, so they are no boundary | sandbox `denyRead` (question 6); `Read()` deny rules; guard |
| `~/BRIMM Video Work/` | The read-only copies of a session's transcript (`shown/`), `agreements.txt` (who agreed to a Reel), libraries and renders | sandbox `denyRead`; `Read()` deny rule; guard |
| `~/Library/Application Support/BRIMM Video/` | This Mac's settings (the training gate, the lock's per-Mac entries), the guide's note, the approved links, the card's receipts, the marks of chats that hold a session's words, the picture count | sandbox `denyRead`; `Read()` deny rule; guard |
| Places that keep a gated video's name or words: all of `~/.claude` (transcripts, prompt history, `file-history/`, `debug/`, `sessions/`, `jobs/`, `uploads/`, `backups/`) and `~/.claude.json` (the folders she has opened, her account); Claude Code's temp folder `/private/tmp/claude-<uid>/`, which holds other chats' command output (C36); the Claude app's data, `~/Library/Application Support/Claude/` (with `claude-code-sessions/`, `local-agent-mode-sessions/` and the Code tab's `side-session-notes/`, C30); macOS's recent lists (`~/Library/Application Support/com.apple.sharedfilelist/`) and Finder's preferences (`~/Library/Preferences/com.apple.finder.plist`, whose `FXRecentFolders` holds whole paths); Dropbox's data (`~/.dropbox/`, `~/Library/Application Support/Dropbox/`, `.dropbox.cache` at Dropbox's root, `~/Library/Group Containers/G7HH3F8CAK.com.getdropbox.dropbox.sync`, and `~/Library/Containers/com.getdropbox.dropbox.fileprovider`, `.TransferExtension` and `.garcon`, as her laptop's Dropbox runs under CloudStorage); brimm-video's two logs, `~/Library/Logs/brimm-video.log` and `brimm-video-claude-check.log` (`tool/install.sh:69`, `:73`) | Each can hold an Episodes folder's name, the path of a copy, or (for Claude Code's and the app's data) the words of another chat, her unlocked chats of 25 Oct among them | sandbox `denyRead` of all of these, with **three narrow `allowRead` entries Bash itself needs (C36)**: her folder's own subfolder of the temp folder (`/private/tmp/claude-<uid>/<her folder as Claude Code writes it>`), `~/.claude/shell-snapshots` and `~/Library/Application Support/Claude/claude-code` (Claude Code's own program). No `Read()` rules for `~/.claude`, which would also stop Claude Code's own reads of saved answers. The guard: all of these, but for the chat's own tool-results folder, its own tasks folder and the named skills' own folders (section 2). Heredocs still fail with the temp folder denied, so her `CLAUDE.md` tells Claude to write a file with Write, in the workshop, instead. The temp subfolder is shared by every chat of her folder (section 5, "Another chat's command output") |
| Spotlight, the system log, QuickLook's thumbnails, Notification Center | `mdfind` returns names, and words, from the whole disk; `log show`, the thumbnail index and Notification Center's database may hold names | The sandbox's Seatbelt profile gives no access to the metadata service: in K0, with the control file indexed (confirmed outside the sandbox), every sandboxed `mdfind` returned nothing and `mdls` "could not find" it. `log show`, the thumbnail index and Notification Center's database against a made-up name are K0's next round (section 9) |
| Secrets: `~/.ssh/` (the deploy key), `~/Library/Keychains/`, `~/.aws/`, `~/.config/`, `~/.netrc`, `~/.git-credentials`, `~/.npmrc`, any `.env`; and the app's environment (below) | C11: the sandbox reads credential files by default. The Keychain's service is reachable from the sandbox (C18); the `denyRead` of `~/Library/Keychains/` is what held in the first lab | sandbox `denyRead`; `Read()` deny rules; guard |

**No hard link out of a gated place.** A hard link to a gated file, made outside the sandbox at an ungated path, is readable from the sandbox and by Read (C35): it is the same file under a name no rule knows, and the guard's identity check sees only folders. The sandbox cannot make one (C1). So the rule is that **nothing outside the sandbox hard-links a gated file into an ungated place**. brimm-video's part is pinned by a test: no `link`/`linkSync`, no `ln` without `-s` and no `cp -l` anywhere in `tool/` (its `cp -c` makes a clone, a file of its own, not a link). Other programs on her Mac (Dropbox, Time Machine, Photos) are not brimm-video's to pin.

### The app's environment

Every command Claude Code runs is given the Claude app's whole environment (C27): her email, her account and organization ids, the app's messaging socket and its token, `SSH_AUTH_SOCK`, and more. A sandboxed command could print any of it into the chat, and a web tool could then carry it out. The rule: **the app's secrets (the messaging token, the proxy login) reach neither a sandboxed command nor the chat.**

- **Taken away by setting.** The folder's settings list them in `sandbox.credentials.envVars`, each with `mode: "deny"`, which "unsets the variable for sandboxed commands" (2.1.308's schema; the schema does not keep it from project settings): `CLAUDE_CODE_MESSAGING_TOKEN`, `CLAUDE_CODE_MESSAGING_SOCKET`, `CLAUDE_CODE_USER_EMAIL`, `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_ORGANIZATION_UUID`, `SSH_AUTH_SOCK`, and any other the by-hand round finds in her chat's environment that names her account or carries a login or a socket. The list is data in the checkout, written by `settings.js studio`. `edit.js` runs outside the sandbox and keeps them all; it never prints or logs any of them (a test, with stand-in values).
- **Not taken away: the sandbox's own proxy login.** Claude Code gives every sandboxed command a login to its own network proxy, in `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` and their kin (`<…>:<token>@localhost:<port>`). On macOS it sets them **after** it takes the denied names away (`env -u … HTTP_PROXY=… … sandbox-exec …`, C27), so no setting removes them. The login opens only that proxy, on her Mac, which refuses every host (C12).
- **So WebFetch and WebSearch are held in her chats**: refused by the guard, and their allow rules left out of the folder's settings, until a by-hand check in K0 shows that a sandboxed command in her chat cannot read the messaging token, the proxy login or the rest. From the 2.1.308 binary the proxy login is expected to stay readable, so the web tools stay held until Jason answers question 19 or a later Claude Code stops handing it out. Opening them is `node tool/settings.js studio --web open`, on his yes.
- `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PID` are not taken away: they name only the chat, and `edit.js`, outside the sandbox, needs them (section 5).
- `~/.claude.json`, which holds her account too, is gated (above).

### Paths, by what they are, not how they are spelled

Today's lock lists what is allowed, so a path spelled another way is refused. The open lock lists what is refused, so a path spelled another way would be let through. `/USERS/<her>/…` and `/System/Volumes/Data/Users/<her>/…` open her Dropbox's Episodes as surely as the usual spelling, and Node's `realpathSync`, which today's `real()` and `within()` use (`tool/studio.js`), gives both back unchanged (C26). Read runs outside the sandbox (C1), and a Read through a link or `/System/Volumes/Data` reaches the guard before Claude Code's own deny check (C14).

So the guard compares **identities**, not text. For each path in a tool's input it walks the path's folders, following links, with `stat`, and refuses when any (device, inode) pair is a gated folder's. A path not there yet is judged by its nearest folder that is. The gated folders' identities are taken once per call from this Mac's settings (cached with the lock check, section 6). The settings' lists, which Claude Code and Seatbelt match as text, name each gated place by its real path **and** by its `/System/Volumes/Data` spelling. In 2.1.308 the second spelling is not needed, since Claude Code and Seatbelt refuse it with the real spelling alone, and both fold letter case (C26); it is kept, as harmless, against a later version. The tests try Read and a sandboxed `cat`, `grep -r`, `rg` and `find` through `/System/Volumes/Data/…`, through changed letter case and through a link. On the Mac Studio `~/Movies` is a link into Dropbox; on her laptop Dropbox is under `~/Library/CloudStorage`.

**Searches, and paths in any field.** 2.1.308 has no Glob or Grep tool (C20): searching is `grep -r`, `rg` and `find` in Bash, inside the sandbox, where Seatbelt holds a search of the home folder file by file, and the guard refuses one that names a gated place, as a courtesy. The guard's Glob and Grep handling is kept for a later version that brings them back: it refuses a search whose folder is inside a gated place **or holds one** (it walks each gated folder's parents for the search folder's identity), and takes Glob's folder the way the binary does, from the literal start of a pattern that is absolute or starts with `~/` or `..`, before `path`. And the guard checks every string in any tool's input that is absolute, starts with `~`, holds `..`, or names a path that is there from the chat's folder, not only the `file_path`, `path`, `notebook_path` and `files` it knew: a tool a per-Mac entry allows later may name its path another way.

### What brimm-video opens and shows

Every app that opens a file, and Finder for every folder it shows, keeps the path in a recent list or its preferences, and a sandboxed `defaults read` reaches any app's preferences through macOS's preferences service (the profile allows `user-preference-read`), so denying the files themselves does not hold alone. An Episodes folder is named from the dropped file (`<day> <dropped file's name> (<Mac>)`, `tool/names.js:25`), which for a session may name a client. So, under the open lock:

- `show` and `which` open copies of a gated video from `~/BRIMM Video Work/shown/<id>/`, named by its label as now (a small change to `shownFolder`, `tool/edit.js:2148`).
- **Every Finder reveal shows a copy, never a path in an episode's folder:** `guide "<video>" show` (`tool/edit.js:5585`, every session's BRIMM Ops step), the withdrawal of a session after all (`tool/edit.js:4447`), and `finish` (`tool/finish.js:959`, `:1241`, `:1412`) reveal `~/BRIMM Video Work/shown/<id>/<label>.brimm-ops.json` (or the video's copy, by label), which she drags as before.
- **`which`, for a gated video, refuses rather than open the original** when no copy can be made (`tool/edit.js:5023` opens the video itself today): "<label> can't be opened on this Mac without showing its file's name: ask Jason." For an answered ordinary video it still opens the original when no copy can be made, which is the usual case on her laptop for a video the Mac Studio imported; its name is not a client's by her own answer, and a later "session after all" is a risk accepted in section 11.
- Before the open lock is turned on, Jason clears Finder's and QuickTime's recent lists on her laptop once (setup guide): they may hold names from before.
- K0's next round (no group ran it) reveals a made-up folder and checks `defaults read` and `plutil` of Finder's, QuickTime's and TextEdit's preferences from the sandbox, and the recent lists.

### What the sandbox still answers: whether a folder is there, and what is running

Seatbelt lets a sandboxed command ask whether a folder is there, though not list it (C19; K0 saw it so). So `test -d "<Episodes>/<day> <guessed name> (Sallie's laptop)"` answers yes or no for a guessed day and name. This is **accepted** (section 11): it answers only an exact guess, and the session drop folder (phase S) names a session's folder by its label from the start.

It also answers **what is running** (C28): a sandboxed script can read every process's arguments, and brimm-video puts episode paths in them while a program runs on a video (`ffmpegArgs`, `tool/lib.js:41`; `roughCutArgs`, `tool/cuts.js:551`; `cloneFile`'s `cp -c`, `tool/dropbox.js:33`; ffprobe and whisper beside them). So while an import, a cut or a finish runs, a sandboxed script can read an Episodes folder's name. Passing those programs id-named links instead would hide the arguments, but not the files the program holds open, which the same process information gives by their real paths to any tool that reads it, as `lsof` does (K0 ran `lsof -i` from the sandbox; whether it shows another process's open files was not tried). Hiding the arguments alone would not keep the name private, and nothing in her folder's settings can close the process information itself. So it is **accepted** (section 11): it shows a name only while brimm-video runs a program on that video, and phase S names a session's folder and video by its label. K0's next round tries `lsof -p` of a made-up `ffmpeg` from the sandbox; if open files do not show, id-named arguments are worth building after all.

### Writes: the workshop only

Nothing but brimm-video changes the code, her folder's lock, the records, Episodes, the drop folders, Assets, the launch agents, this Mac's settings or the training gate. Concretely:

- **The sandbox** writes only in the workshop (`sandbox.filesystem.allowWrite`) and the temp folder. The workshop is **not** added to the session as a working folder (`permissions.additionalDirectories`): Claude Code loads "skills, commands, and agents" from a folder added so (C17), and a folder Claude writes in must not be one Claude Code takes instructions from. The guard's "allow" and an `Edit()` allow rule let Claude write there with no card: K0 saw Write, Read and a sandboxed command reach the workshop with no card once the allow rule was taken or the guard answered allow. In a folder not trusted the allow rule is ignored and each asks a card (C31), so step 9 begins by trusting her folder. **Her folder is the session's working folder, which the sandbox would let commands write (C11)**, so the folder's settings deny it (`sandbox.filesystem.denyWrite`; K0: held).
- **The app's own added folder.** The Code tab adds `~/Library/Application Support/Claude/side-session-notes/<id>` to every session as a working folder, and the sandbox could write it (C30). So the folder's settings deny writes into all of `~/Library/Application Support/Claude`, by `sandbox.filesystem.denyWrite` and by an `Edit()` deny rule, which the sandbox takes as "deny within allow". K0's next round checks the deny holds over the app's `--add-dir`. A side chat's notes, if the app ever asks Claude to write them there, are refused in her folder.
- **Static `Edit()` deny rules**, which hold Write and Edit even if a hook is not called (C14) and reach the sandbox (C3), name: **her folder itself**, `~/BRIMM Video Studio/**`, which holds the lock (its settings, `CLAUDE.md` and skill; Claude never writes there); the checkout; `BRIMM Video`; `BRIMM VIDEO Transfer`; `~/BRIMM Video Work`; `~/Library/Application Support/BRIMM Video`; `~/Library/Application Support/Claude`; `~/Library/LaunchAgents`; `~/.claude`; `~/.ssh`; and, in the workshop, `**/.claude/**`, `**/CLAUDE.md`, `**/CLAUDE.local.md` and `**/.mcp.json`. The lab saw sandboxed commands write those last four freely into a folder they may write; a session started there would take them as its own. K0: the `Edit()` deny of her folder held for Write, Edit and a sandboxed write, and a `**` in the middle of a rule held at any depth (a Read of `<workshop>/sub/CLAUDE.md` then asked a card, which is harmless).
- **Write and Edit** are allowed by the guard only inside the workshop, never for those four names. NotebookEdit stays denied (C4: no rule covers it).
- **`behind` and the guard** still look for any `.claude`, `CLAUDE.md` or `.mcp.json` in the workshop, as a backstop, and treat one as a loosened lock. In her folder they leave alone `.claude/.cc-writes/`, which Claude Code makes there itself at each start (C34).
- **Everything `edit.js` takes from the workshop is taken by name**, never by a path: a file in its top folder, by the `pictureNameFault` rule (`tool/pictures.js`: no `/`, no leading dot), refused when it is a link (`lstat`) or its real path is not in the workshop, as `pictureFrom` does for `Pictures/` (`tool/edit.js:3218`). A sandboxed command can make a link in the workshop that points into Episodes (lab); reading it is refused inside the sandbox, but `edit.js` runs outside. **Everything `edit.js` writes there is created with `wx`** (O_CREAT|O_EXCL), so it never writes over a file, nor through a link planted under that name, dangling or not (a dangling link into `Drop/` would otherwise start an import).

### brimm-video's own command, outside the sandbox

`edit.js` must run outside: it reads and writes Episodes, shows the dialogs, opens Finder and QuickTime, runs ffmpeg and Claude's readings, and calls OpenRouter. So the folder's settings give `sandbox.excludedCommands` one entry, `edit.js` as the folder already allows it: `<node> "<checkout>/tool/edit.js" *`, with the node the installer found. K0 saw that shape, with the full node path and the checkout's spaces, run outside without a card through the `Bash()` allow rule (C7); the exact node path on her laptop is the by-hand round's.

Four things keep that one door narrow:

1. C7: `node "<checkout>/tool/edit.js" episodes && cat …` runs inside the sandbox, where `edit.js` itself then cannot reach Episodes and fails.
2. **The guard allows `edit.js` only in the one spelling the excluded entry names, with nothing in front of it.** The full node path, never the bare word `node`, which today's guard also takes (`tool/studio.js`, the `edit` pattern): bare `node` runs inside the sandbox (C7) and would fail partway through a command. And Claude Code strips some wrappers before it matches the entry: `nice <the spelling>` and `env -u SANDBOX_RUNTIME <the spelling>` also ran outside (C7). So the guard's one spelling is the line: it refuses `edit.js` with anything before the node path, among them `nice`, `env` in any form, `timeout`, `nohup`, `time`, `stdbuf`, `command`, `exec`, `builtin` and a variable assignment, whether or not Claude Code would strip it; tests pin the `nice`, `env -u`, `timeout`, `nohup`, `time` and `stdbuf` forms as refused, and that every form the guard allows is one the entry excludes. The guard refuses any other command that names `edit.js` or the checkout's `tool/` folder, so nothing rides on a near match. It also refuses `edit.js` with `run_in_background`, so its output file is on disk only while it runs (section 5).
3. **`edit.js` refuses at its start when it finds itself in the sandbox**: when `SANDBOX_RUNTIME=1` (C24), **or** when `ps` of its own parent fails with "Operation not permitted", since a command can remove the variable (`env -u SANDBOX_RUNTIME`, C24) but the sandbox refuses `ps` (K0). "brimm-video was run inside Claude Code's sandbox: ask Jason." That covers a spelling that slips past the guard, and the app's `--settings` dropping the folder's entry (C7), which the guard and `behind` now also read (below).
4. `allowUnsandboxedCommands: false` (C8), and the guard refuses a call that sets `dangerouslyDisableSandbox` anyway. With `failIfUnavailable: true` (C9), a Mac where the sandbox cannot start opens no session in her folder at all, and she is told to ask Jason.

### The dialogs Claude cannot press

Clearing a session mark and a client's agreement stay clicks on a macOS dialog `edit.js` shows (22 Oct design, section 2). In the sandbox, `osascript` and `open` cannot send Apple Events (C10), and the folder's settings cannot turn that on; the screen, browser and terminal drivers are on the never list. No K0 group ran `osascript`: the by-hand round checks a sandboxed `osascript` cannot press the clearing dialog while it is shown, and the next round tries `launchctl kickstart` from the sandbox (`launchctl list` already gave nothing there).

### Network

- **Sandboxed commands get none** (question 13). The folder's settings say `sandbox.network.deniedDomains: ["*"]`, refused in every mode with no card (C12; K0 also saw raw TCP, direct DNS, the proxy bypass and `127.0.0.1` refused, in Auto and Bypass too). The lab saw a bare `"*"` taken, so the first draft's fallback (`strictAllowlist` in her user settings) is dropped; it would not have held Monitor's WebSocket form anyway, being "Enforced for sandboxed commands only".
- **WebFetch and WebSearch are held** until the by-hand check of the app's environment passes, or Jason answers question 19 (above, "The app's environment"). They run in Claude Code's own process, outside the sandbox (C1). Once opened they have bare allow rules, so no card, except in a chat that holds a session's words, where they stay refused.
- **WebFetch never reaches a numeric or local address.** It reaches the Mac and the home network by number, outside `deniedDomains` (C29). So the guard refuses a WebFetch whose host is an IP address in any spelling (dotted, a whole number, hex, octal, IPv6, IPv4 inside IPv6), `localhost` or a name under `.local`, `.localhost`, `.internal` or `.home.arpa`, or a name that, when the guard looks it up, gives a loopback, private, link-local, shared (`100.64.0.0/10`) or multicast address. WebFetch hands a redirect to another host back as a new address, which comes to the guard again. A name whose answer changes between the guard's look-up and the fetch is accepted (section 11).
- **OpenRouter** is reached only by `edit.js` (section 4).
- **`Monitor` stays denied.** It is not Bash: its WebSocket form runs in Claude Code's own process, outside the sandbox (C25), and nothing shows its command form is sandboxed. Her work does not need it.

### Modes, and the settings that could loosen it

As today: `defaultMode: "default"` (the card needs it), Bypass and Auto off, `disableAllHooks: false`, the guard in exec form with `onFailure: "block"` (K0: a missing guard script blocked the call). New: `disableSkillShellExecution: true` (C15). What could loosen the lock from outside her folder's file, and is looked at by the guard and by `behind` (section 6):

- her folder's `.claude/settings.local.json` (anything of that name), as today;
- her user settings, for the keys honored there (C13): `sandbox.filesystem.disabled`, `sandbox.allowAppleEvents`, any `sandbox.excludedCommands`, `sandbox.filesystem.allowRead` or `allowWrite`, `sandbox.network.allowedDomains`, `sandbox.allowAllUnixSockets`, `sandbox.enableWeakerNetworkIsolation`, `disableAllHooks`, and **any `permissions.additionalDirectories`** (an added folder can be written by sandboxed commands, brings its skills, and can turn a plugin on: C11, C17);
- the managed settings, in all three places PR #40 reads (the managed folder, the managed preferences, the server-managed settings), for the same keys and `allowManagedHooksOnly`;
- **plugins and skills**: an enabled plugin that carries hooks or a mod (C16), and a named skill whose `SKILL.md` has `hooks:` (C22);
- **any SessionStart hook** outside her folder's own settings (user, managed or a plugin's): it can overwrite the chat's id and `CLAUDE_PID` that every later command sees (C24), which the marks of section 5 rest on;
- **the Claude app's own flags on her chat.** The guard and `behind` find the parent `claude` by walking their own process chain with `ps` (both run outside the sandbox: C16, C30) and read its arguments. A `--settings` that holds any of the keys above (or `allowUnsandboxedCommands: false`, which drops the folder's `edit.js` entry: C7) is a loosened lock, as is any `--add-dir` but the app's own notes folder, `~/Library/Application Support/Claude/side-session-notes/<id>` (one folder, by its real path, no link: C30). A folder added by `/add-dir` mid-chat shows only in the transcript's `additionalWorkingDirectories`, which they read too. The first draft called `--settings` a gap nothing can read; it can be read. The setup guide still says never to add a folder to her session from the app;
- **`/sandbox`'s "No sandbox"**, which it still offers (C33). What that choice writes is the by-hand round's to see; the lock check then catches it there (if it is her folder's `settings.local.json`, it already does).

A folder Claude Code does not yet trust drops the allow rules and `additionalDirectories` (C31). That narrows rather than loosens, since deny rules, the sandbox and hooks still apply, but it asks cards for `edit.js` and the workshop. So `behind` reports it, from her `~/.claude.json` entry for her folder, and step 9 trusts the folder once.

---

## 2. What opens

Not in a chat that holds a session's words: that chat keeps today's lock (section 5).

- **Bash: any command**, inside the sandbox, with no card (`autoAllowBashIfSandboxed` stays at its default, true, and the guard allows it). Searching is Bash too: `grep -r`, `rg` and `find`, since 2.1.308 has no Glob or Grep tool (C20). Heredocs fail inside the sandbox (C36), so Claude writes a file with Write, in the workshop, instead.
- **Read** anywhere but a gated place: her documents, her other Dropbox folders, the brand's files, the checkout's code. Glob and Grep, if a later version brings them back, are allowed on the same terms, with the search rule of section 1.
- **Write and Edit in a workshop**, `~/BRIMM Video Workshop`, on her Mac's own disk (not Dropbox), which `settings.js studio` makes and never adds to the session as a working folder (section 1, "Writes"). It is **outside** her folder on purpose: Claude Code reads a folder's settings only in the session's own folder, but her `CLAUDE.md` and skill from the folders above too (PR #40), so a session started in a folder inside hers looks like hers and has no lock. A session started in the workshop has neither her settings nor her skill. `behind` already refuses a session that is not in her folder itself (PR #40). Writing in her folder itself is question 16.
- **WebSearch and WebFetch, once opened.** They are held until a by-hand check shows the app's secrets cannot be read from the sandbox, or Jason answers question 19 (section 1, "The app's environment"). Once open, WebFetch still never reaches a numeric or local address (section 1, "Network").
- **Skills: only the ones named** (question 4), since a skill can register hooks that run outside the sandbox (C16, C22): her `brimm-edit`; a new `brimm-graphics` skill written beside it (section 3); `frontend-design`, which Jason installs on her laptop (a single `SKILL.md` with no hooks and no MCP); and `theme-factory`, if her claude.ai account syncs it. The guard checks the name; `behind` checks each named `SKILL.md` has no `hooks:`; the guard lets Read reach the named skills' own folders, for the files they point to. Skills that lead only to refused tools (`artifact-design`, `web-artifacts-builder`, `docs`, `canva-creator`, the computer and browser skills) are not named.
- **Subagents** (the subagent tool, named `Agent` or `Task`: the guard takes both until the Code tab's name is recorded, C21) that stay in her folder: no `isolation`, no `cwd`, and no agent definition but Claude Code's built-in ones (never list). They share the sandbox, and K0 found the guard is called for a subagent's own tool calls with her chat's `session_id`, plus an `agent_id` (C2), so a subagent is held as her chat is, and a chat held for a session's words holds its subagents too.
- **Drawing in the chat:** `mcp__visualize__show_widget` and `mcp__visualize__read_me`, by name. Claude draws an SVG or a page in the chat; she downloads it (section 3). `mcp__visualize__*` is never in the settings' deny list, since a deny there beats the guard's allow (C14); a test pins it.
- **`PushNotification`**, which reaches only her own phone (her note 2; question 17).
- **Named connector tools.** The settings' `mcp__*` deny is replaced by a deny of every MCP family in the fixture but the drawing tools, and of the posting tools by name. A broad `mcp__*` deny cannot stay: a deny beats every allow (C14), so it would refuse the drawing tools and any connector Jason names. The guard allows a connector tool only when a per-Mac entry names its server and the tool exactly, its server is a claude.ai connector's, and the never list's words do not catch it. None is named at first (question 15). A connector added later is held by the guard alone until `settings.js studio` is run again; K0 found the guard is called for subagents' calls too (C2), so that holds in a subagent as well.
- As today: `AskUserQuestion`, `TodoWrite`, the task tools and `ToolSearch` are left to Claude Code.
- Not opened at first, denied unless Jason allows them: `NotebookEdit`, `Monitor`, the `Cron*` tools, `Workflow`, and any tool Claude Code adds later.

**The allowlist is data, as Jason asked on 22 Oct** ("a configurable allowlist, not hard-coded"): `tool/studio/allow.json` in the checkout holds the default (the named skills, the drawing tools, `PushNotification`), and this Mac's settings may add entries, written only by `node tool/settings.js studio --allow skill|mcp …` on Jason's yes. Entries are typed (`skill`, `mcp-tool`, `tool`), with no wildcard in an `mcp-tool`. The guard reads both at every call; a per-Mac list it cannot read is ignored and never widens anything. `behind` prints the per-Mac additions, so a change shows.

---

## 3. Graphics (note 5)

Four ways, all landing a PNG where `graphic add` finds it:

1. **In the chat.** Claude draws with `show_widget`. The widget has the app's fonts and colours, not the brand's: it loads only from a few public code sites, none of which serves Sweet Sans Pro or Sinthya, and it flips its colours in dark mode. So it is for sketches. Whether its download gives a PNG (which `graphic add` takes) or the SVG or HTML source is K2's to see; if it is not a PNG, the finished graphic goes through way 2.
2. **In the workshop.** Claude writes the graphic as SVG or a small HTML page in the workshop's top folder, then runs a new command, `picture render "<name>" [--size 1920x1080|1080x1920|1080x1080]`. This is **a new drawer, WebKit's, written for this** (question 10). The first draft called it phase V's drawer's cousin; it is not: phase V's drawer is CoreText reading a JSON draw list (the phase V plan, Task V1.3) and draws no SVG or HTML. Because `edit.js` runs outside the sandbox, what the page can load is confined by the command itself:
   - It takes a **name**, never a path, by the workshop rule (section 1, "Writes"): the top folder, no link, real path inside.
   - It refuses a file whose text holds `file:`, `http:`, `https:` or `..`, outside the namespace declarations SVG needs (`xmlns="http://www.w3.org/2000/svg"` and the xlink one).
   - It copies the file into a fresh private temporary folder and draws it there, with JavaScript off, a WebKit content rule list that blocks every load but the file itself and `data:` addresses, and `loadFileURL(…, allowingReadAccessTo:)` given that temporary folder only. WebKit's page process, which runs outside Claude Code's sandbox, can then read nothing else and reach no network.
   - Fonts come only from those installed on this Mac. A file that names a font not installed (Sweet Sans Pro or Sinthya before Jason installs them) is refused, since WebKit would swap in another without saying so.
   - It writes `<name>.png` into the workshop's top folder with `wx`, and opens it in Preview.
   Drawing it inside Claude Code's sandbox instead would not hold: WebKit's page process and QuickLook's service are not the command's children, and run outside the sandbox whatever it denies.
3. **Illustrations and photos** Claude cannot draw: `picture make` through OpenRouter (section 4).
4. **Text cards:** `card make` (phase V3), unchanged.

Then "put it up at 1:20" is `graphic add "<name>.png" …`, as now: `graphic add` and `logo` take a picture by its name from `Pictures/` and, new, from the workshop's top folder (`tool/edit.js:3221`), by the same rule (no link, real path inside), copied into the episode's `media/` by the rule. When phase A brings `Assets/Graphics/`, a picture she keeps goes there by a brimm-video command, never by Claude writing into Dropbox.

**The `brimm-graphics` skill**, written by `settings.js studio` beside `brimm-edit`: the brand guide's colours (navy, fog, light gray, dew, sand, dune, mist, smoke, with their values), Sweet Sans Pro and the script Sinthya when they are installed on her Mac (Varela, then Lucida Grande, until then), the name on screen "Sallie Ogden", never the "with Sallie Holder" marks; the sizes for the main video, a Reel and a post; the four ways above; the ways that are refused in her folder (Artifact pages, Canva, the browser), so Claude does not lead her to a refusal; and that a graphic never holds a client's name or business. It is the brand in one place, so `frontend-design` and `theme-factory` are bent to it. With those two, it is what note 7's "standard claude design skills" comes to.

---

## 4. OpenRouter (note 7)

**Not her chat's model, and not the readings.** Her chat would leave the Claude account whose training setting Jason checked, and the readings name one Claude model so that both Macs pick the same Reels (`tool/unedited.js:86`). Both stay with Anthropic.

**One command, for pictures:** `picture make "<name>" --prompt "<description>" [--size square|wide|tall]`, in `edit.js`, with no episode (so `UNSCOPED`, `tool/gate.js`). The description is one Claude writes from her request, not her own typing: her chat may hold her other files and pages Claude fetched.

- **Which model, and who runs it.** This Mac's settings hold one model and the provider slugs for it from OpenRouter's list of zero-retention endpoints (`/api/v1/endpoints/zdr`): for example `google/gemini-3.1-flash-image` on Google Vertex, or `microsoft/mai-image-2.6` on Azure (question 9). Many image models (OpenAI's `gpt-image-*`, FLUX, Recraft) have no zero-retention endpoint and cannot be named. Each request names the provider with the routing fields OpenRouter's image page documents, `provider.only` (those slugs) and `allow_fallbacks: false`; it also sends `data_collection: "deny"` and `zdr: true`, which that page does not list and may ignore. So the promise does not rest on fields that may be ignored: Jason makes **a key for brimm-video alone, under OpenRouter's guardrail on that key** (a provider allowlist, a model allowlist, zero retention enforced, and a budget that resets daily), and turns off training for paid models in the account's privacy settings (question 8). Without the pin, price routing would pick Google AI Studio for that Gemini model, which is cheaper and not on the zero-retention list.
- **K3, by Jason, before it is built, as checks that must fail:** with `zdr: true`, a model with no such endpoint (`openai/gpt-image-2`) is refused; and a provider outside the guardrail is refused. A success alone cannot tell "honoured" from "ignored".
- **What is sent is the description, and only that**: never a transcript, a frame, a video, a sound or a file name. It refuses a description that holds a name brimm-video knows from a session or a video not yet answered (the names the session name check uses: the speakers it replaced, the words of the dropped files' names), without saying which, with "That description holds a name from a client or group session: say it without the name." **A refusal turns `picture make` off on this Mac for the rest of the day** and writes a line for Jason in the log, without the description or the name, so the check cannot be used to test names one at a time. The check catches names, not other words; a chat that holds a session's words cannot run `picture make` at all (section 5).
- **Size and what comes back.** `--size` becomes `aspect_ratio` 1:1, 16:9 or 9:16. The answer's `media_type` is checked: a JPEG or WebP is turned into a PNG with `sips`, anything else refused. `<name>.png` is written into the workshop with `wx`, by the picture-name rule, and opened in Preview; Claude can look at it with Read and suggest another try.
- **Count, cost and log**, in Application Support (never the workshop or the temp folder, where Claude could reset them). Every call counts against a daily limit (a setting; 20 to start), refusals included; the guardrail's budget bounds the money. One log line per call: the date, the Mac, the model, the provider, the cost (or "unknown": OpenRouter gives it "when available"), OpenRouter's id for the call and the outcome; never the description, a matched name or the key.
- Off until Jason turns it on: `node tool/settings.js pictures --openrouter on --model <name> --provider <slug>… --per-day <n>` (his yes); until then it says "Pictures from OpenRouter are not turned on for this Mac: ask Jason."

**The key**, the project's second secret:

- In the login Keychain of her laptop, the Mac that makes pictures, as a password named `brimm-video-openrouter`; not on the Mac Studio unless pictures are wanted there. Jason puts it there himself, in Terminal: `security add-generic-password -s brimm-video-openrouter -a "$USER" -w`, which asks for it, so it is in no file and no shell history. Never by the installer, never in a chat.
- `edit.js` reads it with `/usr/bin/security find-generic-password -s brimm-video-openrouter -w` into memory, puts it in the request's header, and never prints, logs or writes it; a test holds every line it prints and logs against a stand-in key.
- **Inside her folder, Claude cannot reach it.** The first draft's reason was wrong: the sandbox does allow the Keychain's service (C18). What held in the lab is the sandbox's `denyRead` of `~/Library/Keychains/`, with the guard and a `Read()` rule for the file tools. K0's next round checks it with a made-up item, read exactly as `edit.js` reads it (a search for an item that is not there gives code 44 whether or not the Keychain is reachable, so only a made-up item tells); no K0 group ran it, since it adds an item to the login Keychain, so it waits for Jason's yes. If that check fails, the key moves to `~/Library/Application Support/BRIMM Video/openrouter.key` (mode 600), which the guard and the sandbox already deny.
- **Outside her folder it is a rule, not a lock.** An item added with `security add-generic-password` trusts `/usr/bin/security`, so any Claude session not in her folder (a chat she starts in another folder, or any of Jason's on a Mac that holds the key) could print it with no prompt; a key file would be no better. What bounds a leaked key is the guardrail: zero-retention models only, and a small daily budget. Adding the item with `-T ""` (no program trusted) should make macOS ask her at every picture, which Claude cannot answer; that is the stricter choice in question 8, checked in K3.

**What OpenRouter learns:** the picture descriptions Claude writes, on Jason's account, passed only to the one named zero-retention provider. Nothing of a video.

---

## 5. Sessions in a looser chat

**The questions stay as they are.** Before the drop, the guide asks "Is this video a private session with a client or a group?" (25 Oct design). After the import, the card asks what the video is and whether it is a private session, both answers required in code (22 Oct design). A session's words go to Claude only on "teachings", on the training gate; what comes into the chat is the principles and Reel ideas after the name check, never the transcript; the dialogs, the labels and "never rate, report or share a chat about a session" stay.

### A chat that holds a session's words keeps today's lock

The first draft said the chat never holds a session's words. It does, in two ways: the principles' key phrases, word for word, once she asks for a session's teachings; and an ordinary video's words that `show` printed before it was found a session after all (section "What this rests on"). Her skill already says the chat may hold a session's "file's name, its suggestions, its spellings" (`tool/studio/SKILL.md:107`), and such a chat can be resumed from the Code tab. With the web open in that chat, a page Claude fetched could steer it to carry those words out: in a WebFetch address, a search, `SendUserFile`, `PushNotification`, a drawing that loads a remote picture, a `picture make` description (whose check catches names, not other words), or a file in the workshop, which a later chat could send on. So (question 2):

- **Which chats.** `edit.js` knows when it prints anything drawn from a session's words (`principles`, `ideas`, `teachings`, and a Reel's or the finish's lines of a session: `SESSION_TAUGHT` beyond `SESSION`, `tool/gate.js`). When it does, under Claude Code (`CLAUDECODE=1`, C24), it first writes a mark into Application Support: the time; **the chat's id**, which Claude Code gives every command as `CLAUDE_CODE_SESSION_ID`, equal to the hook's `session_id` (C24); and **the chat's `claude` process**, which `edit.js` finds by walking its own process chain with `ps` (`node ← zsh ← claude`, C30). It checks the two against each other: `CLAUDE_PID` must be that process. The guard, which Claude Code starts for the same chat (`node ← sh ← claude`), holds a chat whose `session_id` is a mark's, or whose own chain reaches a mark's `claude` process. A mark whose id and process disagree, or that cannot be tied to one chat, holds every chat of her folder that was open at the time. Since a SessionStart hook can overwrite the id and `CLAUDE_PID` that commands see (C24), any such hook outside her folder's own settings is a loosened lock (section 1, "Modes").
- **Resumed and forked chats.** A chat resumed with `--resume` keeps its `session_id`, so it stays held. A fork gets a new `session_id` but carries the held chat's words, with every message `uuid` unchanged (C32). So when the guard first holds a chat it records the `uuid`s of that chat's messages so far, and it also holds any chat whose transcript holds one of them (read at each call of a chat not yet held, cached by the transcript's size). A fork from before the teaching is held too; that fails closed. Whether the Code tab can fork or rewind a chat is the by-hand round's to see.
- **A session after all.** When `edit.js` marks a video a session after all, it writes the time into Application Support; `edit.js` on the other Mac does so too when it first sees the record. Every chat whose transcript began before that time is then held too.
- **What such a chat may do:** what today's lock allows, `edit.js` and her skill, but not `picture make`. So no web, no `SendUserFile`, no `PushNotification`, no drawing, no Write and no sandboxed command, which could write into the workshop for a later chat to send on. The guard says: "This chat holds a session's words, so it can only run brimm-video now. Start a new chat for anything else."
- **It fails closed:** a mark the guard cannot read holds the chat.

### Another chat's command output

Command output is written into the temp folder, under her folder's own subfolder and the chat's id (C36), and the sandbox may read that subfolder, so that `cat` and `node` work at all (section 1, the gated places). So any chat of her folder can read, and write, another chat's command output while the file is on disk: a held chat's `edit.js` output, a teaching's key phrases among them, could be read from a chat that is not held. In `-p` each file was deleted when its command ended; a long Code-tab chat's background tasks may keep theirs.

This cannot be closed per chat in K1. The folder's settings are the same for every chat of her folder, and nothing in them names one chat's own temp folder: `CLAUDE_CODE_TMPDIR`, set in the folder's settings, would move all her chats' output to one other folder, not one each (and is untested). Denying the subfolder breaks `cat` itself (C36). So it is **narrowed and accepted** (section 11): the guard refuses `edit.js` with `run_in_background`, so its output is on disk only while it runs, and every `edit.js` command that prints a session's words is a quick one. The by-hand round's two-chat check (section 9) sees how long the Code tab keeps output files, and whether one chat can read the other's; if the Code tab keeps them after a command ends, this comes back to Jason.

### What the looser chat changes, and what holds a gated video

A gated video is one not yet answered, or a session whose mark is not cleared.

| Opened | How a gated video stays out |
|---|---|
| Bash, and everything it starts, searches (`grep -r`, `rg`, `find`) among them | The sandbox's `denyRead`, enforced by macOS (C2, C3; K0: held where deny rules did not, C4); it still answers whether an exactly guessed folder is there (C19, accepted) and, while brimm-video runs a program on a video, its path (C28, accepted) |
| Read (Glob and Grep are absent in 2.1.308) | `Read()` deny rules and the guard (by identity; every path in the input) |
| `ls` of Drop or Episodes, `mdfind` | The sandbox; K0 saw every sandboxed `mdfind` return nothing |
| Recent lists, Finder's and apps' preferences, Dropbox's data, Claude Code's and the app's data, the temp folder | Gated where known; copies opened and revealed from a folder named by the video's id, so what they hold is a label. Her folder's own temp subfolder is open to every chat of her folder (above, accepted) |
| Copies of a session outside BRIMM Video | Zoom's recording folder and Final Cut's backups gated; the guide says to move a recording into the drop folder, not copy it, and to delete Zoom's originals (question 6); nothing hard-links a gated file out (section 1) |
| Resumed and forked chats | Held by the mark's chat id and by the held chat's message `uuid`s (above) |
| WebSearch, WebFetch | Held in every chat until the app's secrets cannot be read from the sandbox (section 1); then refused in a chat that holds a session's words, and WebFetch never to a numeric or local address |
| `SendUserFile`, `PushNotification`, drawing | Refused in a chat that holds a session's words; elsewhere they carry what the chat holds, which is no session's words |
| OpenRouter | A description; names from sessions refused, and a refusal ends pictures for the day; refused in a chat that holds a session's words |
| The workshop | Written only from chats that hold no session's words |
| Skills, plugins | Named skills only, checked for hooks; a plugin carrying hooks or a mod is a loosened lock (C16, C22) |
| The dialogs | Apple Events blocked in the sandbox; the drivers on the never list |
| `kind` on a waiting video | The card's receipt (below) |

### The card's receipt, with the open lock (question 3)

With the web open, words on a fetched page can try to steer Claude. The one brimm-video command whose misuse would expose a session is `kind` on a video waiting for her answer: run by Claude with "finished" and "no", it sends the video's words to Claude, and what Claude finds then comes into the chat. That is possible from the day the web opens, so the receipt comes **in K1, with the open lock, not after it**; the open lock is not turned on without it.

- **The card's wording is fixed in code.** The card's two questions and each set of answers it may offer (`tool/studio/SKILL.md:20-29`, by the Guess and Maybe lines), and the Zoom follow-up ("It came from Zoom… Which is it?"), move from the skill into `edit.js`, with only the label and a video's name put in. `episodes` prints the exact card for each waiting video, and the skill asks it as printed. A card Claude words itself ("<label>: is the sound clear? Finished / Raw", then "Make it louder? Yes / No") then earns no receipt, though her clicks on it would be honest.
- **The hook.** A second hook, `PostToolUse` on `AskUserQuestion`, writes a receipt into this Mac's Application Support, which neither the sandbox nor the Write tool can reach, only for a card whose questions and answers match one of those fixed forms exactly. It takes her answers from the tool's result (`tool_response`), never from what Claude asked with (`tool_input`), and writes nothing when the result has `afkTimeoutMs` or `followUp` (the card resolved itself after she was idle, C23), or a question has no answer.
- **`kind`**, run under Claude Code (`CLAUDECODE=1`) on a Mac whose folder has the open lock, refuses a waiting video unless a receipt from the last hour holds its label and, for each question, the same answer to that exact question. Her click is then the only way to answer a card. Jason's own runs in Terminal need none.
- The by-hand round checks that a `PostToolUse` hook on `AskUserQuestion` fires in the Code tab with her answers in `tool_response`, whether a dismissed card goes to `PostToolUseFailure` instead (K0 saw a failed Bash call go there, with no `tool_response`: C23), and `afkTimeoutMs` on a card left idle. The receipt hook is not registered on `PostToolUseFailure`, so a card that ends there earns no receipt, and `kind` stays refused: it fails closed.

### The session drop folder, as phase S (question 18)

Today her "yes" before the drop only leads to advice (rename the file); the video then sits unanswered until the card, and its Episodes folder is named from the dropped file. Instead: on "yes", `guide drop session` opens `Drop/<this Mac>/Client or group session/`. A video dropped there is marked a session by the import itself (`answer.by: "drop folder"`, private yes), and the card asks only "teachings, or the transcript only?". A video dropped in the main folder still gets the whole card. It changes the import, so it is its own phase, after K.

**Everything the import makes for it is named by its label or the import's id**: its Episodes folder, the video inside it (which today keeps the dropped name, `tool/filing.js:107`), and its status files (named from the dropped file today, `tool/importing.js:39`). The first draft claimed that then "no Dropbox listing … ever holds the client's name"; that does not hold. The dropped file itself sits in `Drop/<Mac>/Client or group session/` under its own name until the late check deletes it, so Dropbox, its version history and the other Mac see that name for those minutes. The import does not rename it there: renames inside Dropbox were undone by Dropbox on 14 Oct (22 Oct design, phase T). So the guide's advice stays: if the file's name holds the client's name, she renames it before she drops it.

---

## 6. The guard and `behind`

### One check of the lock, made by both

PR #40's `lockLoosened` (`tool/edit.js`) moves into `tool/studio.js`, widened, as one function both `behind` and the guard call. It says what is loosened, never what a file holds:

- **Kept from PR #40:** the session's folder must be her folder itself, by its real path (more important now: a session in a folder inside hers has neither the guard nor the sandbox); her folder's `settings.local.json`; the user settings; the managed settings in all three places (the managed folder, the managed preferences read with `plutil`, the server-managed `remote-settings.json`).
- **Widened:** `lockBroken` checks, beside the guard hook, Bypass, Auto and hooks:
  - the sandbox's keys: `enabled`, `failIfUnavailable`, `allowUnsandboxedCommands`, the one `excludedCommands` entry and no other, `denyWrite` of her folder and of the app's data, `allowWrite` of the workshop only, the network rule;
  - every gated place's `Read()` rule and `denyRead` entry, in both spellings, and no `allowRead` but `Assets` and the three Bash needs (C36);
  - `sandbox.credentials.envVars`: every name on the list, each with `mode: "deny"` (section 1, "The app's environment");
  - the `Edit()` deny rules of her folder, of the app's data and of the workshop's four names;
  - the never list's families in `deny`, and `mcp__visualize__*` not among them;
  - no allow rule for WebFetch or WebSearch while the web tools are held;
  - `disableSkillShellExecution` and the receipt hook;
  - on her laptop, if Jason takes question 5, the gated places' `Read()` rules in her user settings.
- **And beyond the folder's own file:** the user and managed settings, for the keys in section 1 ("Modes, and the settings that could loosen it"), `additionalDirectories` among them; enabled plugins carrying hooks or a mod; named skills with `hooks:`; any SessionStart hook outside her folder's settings (C24); a `.claude`, `CLAUDE.md` or `.mcp.json` in the workshop; and what `/sandbox`'s "No sandbox" writes, once the by-hand round has seen where (C33).
- **And the app's own flags on this chat** (C30): both find the parent `claude` by walking their own process chain with `ps`, which they can, running outside the sandbox, and read its arguments. A `--settings` holding any key of section 1's list, or `allowUnsandboxedCommands: false`, is loosened. Any `--add-dir` is loosened but one: the app's own notes folder, `~/Library/Application Support/Claude/side-session-notes/<id>`, one folder deep, by its real path, not a link, which the Code tab adds to every session; the lock check expects it rather than call every chat loosened, and the sandbox and `Edit()` denies keep it unwritten (section 1, "Writes"). A folder added by `/add-dir` mid-chat is read from the transcript's `additionalWorkingDirectories`. A chain with no `claude` above it (Jason's own runs in Terminal) has no app flags to read.
- **What it leaves alone:** `.claude/.cc-writes/` in her folder, which Claude Code makes there itself at each start (C34).
- **What `behind` reports, not a loosening:** her folder not yet trusted, read from her `~/.claude.json` entry for it (C31). An untrusted folder drops the allow rules, so `edit.js` and the workshop ask cards, but it opens nothing; `behind` says "Claude Code has not trusted this folder yet: open it once and choose to trust it", and the guard goes on as usual.
- **The guard makes the same check at every call** (cached by each file's size and time, in Application Support, so most calls read a handful of `stat`s). While anything is loosened, it answers as today's guard does, `edit.js` and her skill only, and says "This folder's lock is changed on this Mac: ask Jason before going on." So the lock no longer rests on her skill choosing to run `behind` (the lock-gaps note: "behind-never-run"). This is question 7.

### The guard's decision, in order

1. Is the lock loosened on this Mac? Then today's decision.
2. Does this chat hold a session's words (section 5)? Then today's decision, and `picture make` refused too.
3. On the never list? Deny.
4. Every path in the tool's input (every string that is absolute, starts with `~`, holds `..` or names a path that is there; for a Glob, if a later version brings it back, its pattern's root first), compared by identity: in a gated place, or, for a search, holding one? Deny. A write outside the workshop, or of a `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` or anything in a `.claude` folder? Deny.
5. Bash: `edit.js` in its one exact spelling, with nothing in front of it and not in the background: allow (it runs outside the sandbox). Naming `edit.js` or the checkout's `tool/` in any other form, `nice`, `env`, `timeout`, `nohup`, `time`, `stdbuf` or an assignment in front of it among them, or with `run_in_background`: deny ("Run brimm-video's commands on their own"). `dangerouslyDisableSandbox`: deny. Naming a gated place (`grep -r`, `rg`, `find`, `cat` and the rest): deny, as a courtesy. Anything else: allow; it runs in the sandbox.
6. Skill: allow when named.
7. An MCP tool: allow when a per-Mac entry names it, its server is a claude.ai connector's, and the never list's words do not catch it; otherwise deny.
8. The subagent tool, as `Agent` or `Task` (C21), with no `isolation`, no `cwd` and only a built-in agent; Read, Write, Edit, `PushNotification`, `SendUserFile`, the drawing tools; Glob and Grep, if a later version brings them back: allow. WebFetch and WebSearch: deny while the web tools are held (section 1, "The app's environment"); once opened, allow, but WebFetch to a numeric or local address denied (section 1, "Network").
9. `AskUserQuestion`, `TodoWrite`, the task-list tools (`TaskCreate` and its kin, not the subagent tool `Task`), `ToolSearch`: no answer (left to Claude Code, as today; `AskUserQuestion` must stay so).
10. Anything else, `Monitor` and a tool added later among them: deny.

Claude Code's deny rules still apply after the guard's "allow" (C14), so the gated places and the never families are held twice. A call whose path matches a deny rule as text is refused before the guard is asked; one through a link or `/System/Volumes/Data` reaches the guard first (C14), which is why step 4 compares identities. The guard is called for a subagent's calls with her chat's `session_id` (C2), so every step holds in a subagent too.

### What is replaced

`settingsOf` and `guardDecision` (`tool/studio.js`) are rewritten. `readable`, `real` and `within` become the identity check of step 4; its carve-outs (the chat's own tool-results and tasks folders, by its `session_id`) are kept, and the named skills' folders are added. The `edit` pattern loses the bare word `node` and takes nothing in front of the node path. `tool/studio/CLAUDE.md` loses "do not run any other program". `blockReadsOutsideWorkingDirectories` is still not used. PR #40's `--print` line naming the Claude app's copy of Claude Code stays, with the version it compares raised (below).

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
    "allow": ["Bash(<node> \"<checkout>/tool/edit.js\" *)", "Edit(/<home>/BRIMM Video Workshop/**)", "…WebFetch and WebSearch only once the web tools are opened…"],
    "deny": ["NotebookEdit", "Monitor", "Artifact", "ArtifactComments", "ArtifactData", "RemoteTrigger", "SendMessage",
             "mcp__computer-use__*", "mcp__terminal__*", "…every MCP family in the fixture but mcp__visualize__*…",
             "Read(/<real BRIMM Video>/Drop/**)", "Read(/System/Volumes/Data/<real BRIMM Video>/Drop/**)", "…every gated place, both spellings…",
             "Edit(/<home>/BRIMM Video Studio/**)", "Edit(/<checkout>/**)", "Edit(/<real BRIMM Video>/**)", "Edit(/<home>/Library/Application Support/Claude/**)", "…every place only brimm-video writes…",
             "Edit(/<home>/BRIMM Video Workshop/**/.claude/**)", "Edit(/<home>/BRIMM Video Workshop/**/CLAUDE.md)", "…CLAUDE.local.md, .mcp.json…"]
  },
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "excludedCommands": ["<node> \"<checkout>/tool/edit.js\" *"],
    "network": { "deniedDomains": ["*"] },
    "filesystem": {
      "allowWrite": ["<home>/BRIMM Video Workshop"],
      "denyWrite": ["<home>/BRIMM Video Studio", "<home>/Library/Application Support/Claude"],
      "denyRead": ["<real BRIMM Video>", "<home>/.claude", "<home>/.claude.json", "/private/tmp/claude-<uid>",
                   "<home>/Library/Application Support/Claude", "…every gated place, both spellings…"],
      "allowRead": ["<real BRIMM Video>/Assets", "/private/tmp/claude-<uid>/<her folder as Claude Code writes it>",
                    "<home>/.claude/shell-snapshots", "<home>/Library/Application Support/Claude/claude-code"]
    },
    "credentials": {
      "envVars": [{ "name": "CLAUDE_CODE_MESSAGING_TOKEN", "mode": "deny" }, { "name": "CLAUDE_CODE_MESSAGING_SOCKET", "mode": "deny" },
                  { "name": "CLAUDE_CODE_USER_EMAIL", "mode": "deny" }, { "name": "CLAUDE_CODE_ACCOUNT_UUID", "mode": "deny" },
                  { "name": "CLAUDE_CODE_ORGANIZATION_UUID", "mode": "deny" }, { "name": "SSH_AUTH_SOCK", "mode": "deny" }, "…any other from the by-hand list…"]
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

(`Read()` and `Edit()` rules spell an absolute path with `//` in Claude Code's syntax; the sandbox's own lists take it plainly. The outline shows one slash for both. `<her folder as Claude Code writes it>` is the form Claude Code names her folder by in the temp folder, `-Users-<her>-BRIMM-Video-Studio` on the Mac Studio's pattern; the installer computes it, and the by-hand round records it on her laptop.)

### Her folder's `CLAUDE.md` and skill

`CLAUDE.md` says, in her words: this folder edits The BRIMM's videos with brimm-video, and Claude may also help with anything else (graphics, research, writing, other programs); the BRIMM Video folders, the episodes and the code are changed and read only through brimm-video's commands; nothing is posted, sent or published, the finished videos are posted by hand; heredocs do not work here, so a file is written with Write, in the workshop; a session's or a client's words never go into a web search, a picture's description, a drawing or the workshop, and a chat that has a session's teachings is for brimm-video only; files Claude makes go in the workshop; never rate, report or share a chat about a session; for anything the folder refuses, say so plainly and suggest she asks Jason. The `brimm-edit` skill gains a few lines (under its 160-line limit): asking the card exactly as `episodes` prints it, pictures from the workshop by name, `picture render`, `picture make`, "start a new chat for anything else" after teachings, and the session drop folder if Jason takes it. `brimm-graphics` is new (section 3).

### The installer

- `install.sh --print` says which lock this Mac gets, the workshop, the gated places in Finder words, and, for an open lock, that commands run in Claude Code's sandbox with no network.
- `GUARD_CLAUDE` (`tool/install.sh:67`) **is not set until K0's by-hand round passes**; it then becomes the version that round passed on (2.1.308 today, or later), checked for the Terminal's `claude` as now and named for the app's own copy (PR #40). Until it is set, and below it, the installer writes the strict lock, never the open one.
- It writes the web tools held: no WebFetch or WebSearch allow rule, and the guard refusing them, until `settings.js studio --web open` on Jason's yes (section 1, "The app's environment"; question 19).
- **On her laptop, if Jason takes question 5**, `--print` names the `Read()` deny rules for the gated places that it would add to her user settings (`~/.claude/settings.json`), and writes them only on his yes. Every Claude Code session on her laptop then takes them, in any folder. They hold Claude's file tools, not a script (C4): they narrow a chat she starts elsewhere, they do not lock it. Whether they hold even `cat` in Bash there, in a folder with no sandbox, is untested: in a sandboxed session K0 saw the permission layer let `cat` of a `Read()`-denied path through, and only Seatbelt stopped it (C4). The by-hand round tries `cat` in a scratch folder with no sandbox; the setup guide does not promise more than the file tools. `edit.js` is untouched, and the readings run with `--setting-sources ""` (`tool/unedited.js:100`).
- It never touches the Keychain.

### The setup guide (`docs/setup/sallies-laptop.md`)

- **Step 9, rewritten** for the open lock, in the Code tab on `~/BRIMM Video Studio`, in every mode the menu offers (PR #40's way), with a made-up gated folder Jason makes for the check (a copy of no real episode: a folder `Episodes/0000 Lock check (test)/` holding one line of made-up words, removed afterwards; never her episodes, never the deploy key). Each check is put to Claude as a named owner's check, or as a script to run: K0 saw Claude refuse a bare probe as an attempt to defeat the session's boundary.
  - first: open her folder once and choose to trust it (C31), then run `behind`, which must not report the folder untrusted;
  - must be refused: reading the made-up transcript with Read, with `cat`, with `node -e`, with `python3`, and through `/System/Volumes/Data/…` and changed letter case; `ls` of Episodes; `grep -r` and `rg` of the home folder for its words, and `find` of Episodes; `mdfind` of its words; writing a file into her folder, the checkout, Dropbox and the app's notes folder (`~/Library/Application Support/Claude/side-session-notes/…`); `osascript -e 'display dialog "x"'`; a `curl` to any site; "publish this as a page"; "send this by email"; "take a screenshot"; a command that asks to run outside the sandbox; brimm-video's `episodes` with `nice` or `env -u SANDBOX_RUNTIME` in front of it; while the web tools are held, a web search and a fetch; once they are opened, a fetch of `http://127.0.0.1/` and of the home router's address, and, in a chat that has asked for a made-up session's teachings, a web search;
  - must show nothing: `printenv` in a sandboxed command, for the messaging token, her email and her account ids (the proxy variables are Claude Code's own, and show: section 1);
  - must work, with no approval card: "What's waiting?"; `date`; `cat` of a file in the workshop; "draw a navy and sand title card in the chat"; "make it as an SVG in the workshop and turn it into a picture"; reading a logo in `Assets/`; once Jason has set the key, "make a picture of a sunrise over a desk"; once the web tools are opened, a web search in a new chat.
- **New steps for Jason alone:** clear Finder's and QuickTime's recent lists on her laptop once, before the open lock; look at her claude.ai account's skill and plugin settings, and turn off any plugin with hooks or a mod; install `frontend-design`; make the OpenRouter key for brimm-video with its guardrail, turn training off for paid models, put the key into her Keychain, and run `settings.js pictures … on`; name Zoom's recording folder on her laptop for the gate.
- **For Sallie:** move a Zoom recording into the drop folder rather than copy it, and delete Zoom's original; never add a folder to her session from the app; never choose "No sandbox" in `/sandbox`.
- **"If something goes wrong"** gains `behind`'s new lines (the sandbox's settings, the user settings' sandbox keys, an added folder, the app's `--settings` or `--add-dir`, a SessionStart hook, a plugin with hooks, a `.claude` in the workshop, "No sandbox", the folder not trusted) and keeps "choose the one-time Yes only": "Always allow" writes `settings.local.json`, and Claude Code's `/sandbox exclude` writes there too.

---

## 8. Wording to change

Written only once questions 1, 11 and 12 are answered, each in the phase that makes it true, on Jason's yes.

**`docs/requirements.md`:**

- A new heading, "Jason's decisions of 2026-10-25", with his words verbatim, as the page quotes his 14 Oct direction.
- The lock bullet of "The workflows (2026-10-22)" keeps its 22 Oct facts ("can admit a connector later"; "brimm-video never uploads video: OpusClip takes an episode's YouTube link"; option b after a test in the Code tab) and gains: "On her laptop it is open but for a fixed never list (2026-10-25): Claude may help with graphics, other programs, named design skills and pictures from OpenRouter, and with the web once a check in the Code tab shows the app's secrets stay out of her commands. Kept locked: the code and the episode records change only through brimm-video; a session's words never come into her chat but as its approved teachings, and a chat that has them runs brimm-video only; nothing is posted or published. OpusClip's posting tools stay denied."
- "Kept" becomes: "the tool drafts and never posts or publishes; no video or sound leaves the Mac. brimm-video sends words to Claude for a reading, and a picture's description, written by Claude from her request, to OpenRouter."
- "Assets" and "Graphics Claude makes are text cards" change in the same edit, if Jason takes question 11.
- A line under "Decisions" naming this design, and a change line.

**`CLAUDE.md`** (this repo), "Rules that are never broken", in K3's pull request:

> - The tool drafts. It never posts or publishes anything, and nothing in this repo may add that. It sends only two things, and nothing in this repo may add another without Jason's yes: words to Claude for a reading, and a picture's description to OpenRouter for `picture make`. No video or sound leaves the Mac.
> - Never read a `.env` file. The project has two secrets: the read-only deploy key on Sallie's laptop, kept only in her `~/.ssh` (never in the repo or Dropbox), which Jason revokes in the repo's GitHub settings when it is no longer needed; and the OpenRouter key, which Jason puts on the Mac that makes pictures himself (where, once question 8 is answered). Claude never reads, prints or asks for either.

**`README.md`:** the `tool/studio.js` row and "On Sallie's laptop" describe the two locks; the `behind` row its new checks; new rows for `picture render` and `picture make`; `graphic add` takes the workshop; `which`, `show`, `guide … show` and `finish` reveal copies by id.

---

## 9. Phases

Each phase is a pull request, a failing test first, merged one at a time on Jason's yes. No test calls the real `claude`, OpenRouter, `security`, `osascript`, `ps`, WebKit or the installer without `--print`.

| Phase | What it does | What it now tests |
|---|---|---|
| **K0. The sandbox, checked** | Nothing built. The lab round is done (26 Oct, the findings note). Left: the by-hand round in the Code tab on both Macs, and a next round of the checks no group ran (below) | Written down. `GUARD_CLAUDE` is **not set until the by-hand round passes**, so until then the installer writes only the strict lock |
| **K1. The open lock** | The never list (the subagent tool as `Agent` and `Task`); the gated places, by identity, held first by the sandbox; the per-Mac `lock`; `allow.json` and `--allow`; the new settings, with the three `allowRead` entries, the app's data denied for writes and the app's secrets in `credentials.envVars`; the web tools held, and WebFetch's refusal of numeric and local addresses for when they open; the guard rewritten (one `edit.js` spelling with nothing in front and not in the background; Glob and Grep kept for a later version); the shared lock check, reading the app's `--settings`, `--add-dir` and `/add-dir`, catching SessionStart hooks, leaving `.cc-writes` alone, expecting the app's notes folder, reporting an untrusted folder; the chats that hold a session's words, marked by chat id and process, forks held by message `uuid`; the card's receipt with the card's wording in code; `edit.js`'s sandbox check by `SANDBOX_RUNTIME` and `ps`; `behind`'s new reasons; the workshop and its name-only rule; no hard link out of a gated place; `CLAUDE.md` and the skill's lines; copies and reveals by id; the user settings' deny rules if taken; the installer and the setup guide. Needs PR #40 merged | Unit tests for every entry (section 10), with stand-ins for `ps`, the transcript, the resolver and the settings sources; step 9 on her laptop |
| **K2. Graphics** | `brimm-graphics`; the WebKit drawer and `picture render`; `graphic add` and `logo` from the workshop | Fixtures; a by-hand render on her M4; "use frontend-design to make a card in the workshop and render it"; what the drawing's download gives |
| **K3. OpenRouter** | `picture make`, `settings.js pictures`. First, by Jason: the key and its guardrail, and the checks that must fail (section 4); whether `-T ""` asks at every read | Stand-ins for `security` and the service |
| **S. The session drop folder** | On Jason's yes to question 18 | Fixtures; one made-up drop each way |

**K0's by-hand round**, in the Code tab, on both Macs, in a trusted copy of her folder's open settings, over a scratch `BRIMM Video` of made-up files (never Dropbox, never her folder). Write checks use a scratch tree outside `/private/tmp/claude*`, where sandboxed commands may write anything (C11). Each prompt is framed as a named owner's check, or as a script to run (section 7, step 9).

- **Trust:** that the Code tab takes the folder's `permissions.allow` once the folder is trusted: the stand-in `edit.js` and a Write to the workshop ask no card. Her laptop's `~/.claude.json` entry after she opens the folder.
- **The app's flags on her chat:** its `--settings` (no `allowUnsandboxedCommands`, so the stand-in `edit.js` prints `SANDBOX_RUNTIME=(unset)`); the `--add-dir` of `side-session-notes`, and that the sandbox and Write cannot write it under the new denies; whether `/add-dir` mid-chat shows in the transcript as K0 saw.
- **The exact node path** the installer records on her laptop, run outside the sandbox through the excluded entry.
- **The app's environment:** in a sandboxed command, `printenv` shows none of the names on the `envVars` list, and the stand-in `edit.js` still has them; the full list of names her chat is given, for the list; and whether the proxy variables carry a login. The web tools open only if this passes, or on question 19.
- **`/sandbox`:** that it shows on, and what its "No sandbox" choice writes; that `behind` and the guard catch it.
- **`failIfUnavailable`:** the startup refusal, which a healthy Mac cannot produce.
- **The mode menu:** its refusal of Bypass and Auto, as she sees it.
- **The tool list:** no Glob or Grep; the fixture of local extensions and connectors; the plugins and skills her account turns on; the name the guard receives for the subagent tool (`Agent` or `Task`).
- **Cards:** `PostToolUse` on `AskUserQuestion` with her answers in `tool_response`; whether a dismissed card goes to `PostToolUseFailure`; `afkTimeoutMs` on a card left idle.
- **Two chats open in her folder at once:** separate `claude` processes, each with its own `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PID`; whether one can read the other's output file in her folder's temp subfolder (a background task, and `show`'s output), and how long the Code tab keeps an output file after its command ends.
- **Forks:** whether the Code tab can fork or rewind a chat, and that a fork of a held chat is held.
- **On her laptop:** reads of a scratch tree under `~/Library/CloudStorage` (Dropbox's File Provider) in every spelling, and `cat` in a scratch folder with no sandbox under her user settings' deny rules, if question 5 is taken.

**K0's next round**, of what no group ran; most can run headless, with `claude -p` on made-up files, as the lab did:

- a made-up Keychain item read from the sandbox exactly as `edit.js` reads it (on Jason's yes: it adds an item to the login Keychain);
- `launchctl kickstart`, and `osascript` against a shown clearing dialog (by hand);
- `log show`, QuickLook's thumbnail index and Notification Center's database against a made-up name;
- `defaults read` and `plutil` of Finder's, QuickTime's and TextEdit's preferences after a reveal, and the recent lists;
- `lsof -p` of a made-up `ffmpeg`'s open files from the sandbox (section 1, "What the sandbox still answers");
- `timeout`, `nohup`, `time` and `stdbuf` in front of the excluded spelling, to know whether Claude Code strips them too (the guard refuses them either way);
- the `credentials.envVars` entries from the folder's settings, and the `denyRead` of `~/.claude.json` and `denyWrite` of the app's data, for what they cost;
- NotebookEdit under a Read deny;
- the subagent tool's `isolation` and `cwd`.

---

## 10. Tests

- **The settings** (`tests/studio.test.js`): the open shape for a made-up home, checkout and root with spaces and an apostrophe; every gated place in `Read()` rules or `denyRead` by its real path through a link and by its `/System/Volumes/Data` spelling; `allowRead` of `Assets` and the three entries Bash needs, no other (C36); `~/.claude.json` and the app's data in `denyRead`; `allowWrite` the workshop only; `denyWrite` her folder and the app's data; the `Edit()` denies of her folder, of the app's data and of the workshop's four names; every name on the environment list in `credentials.envVars` with `mode: "deny"`; exactly one `excludedCommands` entry; no WebFetch or WebSearch allow rule while the web tools are held, and both once opened; `mcp__visualize__*` in no deny; `Monitor` denied; the strict shape unchanged from today.
- **The guard:**
  - every never entry refused, fed the fixture of the Code tab's real tool list; the never words catch every posting tool in the fixture and a made-up connector's `send_invoice`; a per-Mac entry naming a local extension refused;
  - every gated place refused for Read, Write, Edit and `SendUserFile`: by `..`, by a link into it and out of it, by `/System/Volumes/Data/…`, by changed letter case, and by a path in a field the guard did not know of; a Bash `cat`, `grep -r`, `rg` or `find` naming one refused, as a courtesy; and, kept for a later version, Glob and Grep the same way, with a Glob whose absolute or `~/` pattern starts there with no `path` and a search of a folder holding one;
  - writes outside the workshop and of `CLAUDE.md`, `.mcp.json` or into `.claude` refused;
  - `edit.js` in its one spelling allowed; with bare `node`, `&&`, `;`, `|`, `$(…)`, an environment prefix, `cd … &&`, another node or another path refused; with `nice`, `env -u SANDBOX_RUNTIME`, `env`, `timeout`, `nohup`, `time`, `stdbuf`, `command` or `exec` in front of it refused; with `run_in_background` refused; every allowed form also an excluded form;
  - `dangerouslyDisableSandbox` refused; any other command allowed; a named skill allowed and another refused; an MCP tool allowed only when named; the subagent tool, as `Agent` and as `Task`, with `isolation`, `cwd` or a plugin's agent refused, and without them allowed; the task-list tools left to Claude Code; `Monitor` refused; a tool unknown to the guard refused;
  - WebFetch and WebSearch refused while held; once opened, WebFetch to `http://127.0.0.1/`, `http://2130706433/`, `http://0x7f.1/`, `http://017700000001/`, `http://[::1]/`, `http://[::ffff:127.0.0.1]/`, `http://192.168.1.1/`, `http://169.254.169.254/`, `http://100.64.0.1/`, `http://localhost/`, `http://printer.local/` and a name a stand-in resolver answers with `10.0.0.5` refused, and a public name allowed;
  - with each kind of loosening, the guard answering as today's;
  - a chat holding a session's words: tied by its `session_id`, by its process (a stand-in `ps` chain), by a session after all's time, and every open chat when a mark cannot be tied to one or its id and process disagree; a resumed chat (same `session_id`) and a fork (a transcript holding a held chat's message `uuid`) held; refused WebFetch, Write, a sandboxed command and `picture make`, allowed `edit.js`; a mark that cannot be read holds the chat;
  - a subagent's call, with her chat's `session_id` and an `agent_id`, decided as her chat's own.
- **The lock check** (`behind`'s tests, `tests/edit-show.test.js`): each new reason, for each settings source, said once and without a file's words; `additionalDirectories`; a plugin with hooks; a named skill with `hooks:`; a SessionStart hook at user, managed and plugin level; with a stand-in `ps` chain, the parent `claude`'s `--settings` with each loosening key and `allowUnsandboxedCommands: false`, an `--add-dir` other than the app's notes folder (and that folder through a link), and the notes folder alone not loosened; a folder added mid-chat in a stand-in transcript's `additionalWorkingDirectories`; `.claude/.cc-writes/` left alone; an untrusted folder reported from a stand-in `~/.claude.json`, and not a loosening; Jason's own run with no `claude` above it; PR #40's tests kept.
- **The receipt:** a card in each fixed form written by the hook; none for a card worded otherwise, with `afkTimeoutMs` or `followUp`, with a question unanswered, or with answers only in `tool_input`; `kind` refused with none, an old one, another label or another answer to the same question, under `CLAUDECODE=1` on an open-lock Mac only.
- **`edit.js` in the sandbox:** refused at its start, without touching anything, with `SANDBOX_RUNTIME=1`, and with the variable unset but a stand-in `ps` of its parent failing with "Operation not permitted"; run as usual when `ps` answers and the variable is unset.
- **The mark:** written with `CLAUDE_CODE_SESSION_ID` and the `claude` process from a stand-in `ps` chain; a `CLAUDE_PID` that is not that process makes a mark that holds every open chat.
- **The app's environment:** no value of a listed variable (stand-ins) in any line `edit.js` prints or logs.
- **No hard link:** no `link`/`linkSync`, no `ln` without `-s` and no `cp -l` anywhere in `tool/`.
- **`picture make`:** refused with the setting off, with no key, past the day's count (refusals counted), after a name refusal for the rest of the day, and for a description holding a session's speaker name or a word of a gated file's name; the request holds the description, the model, `provider.only` with `allow_fallbacks: false`, `data_collection` and `zdr`, and nothing else of brimm-video's; `--size` as `aspect_ratio`; a JPEG answer turned to PNG, another kind refused; the key in no printed or logged line, and the log line's fields; the PNG written by name with `wx`, never over a file or through a link.
- **`picture render`:** a name only (a path, a link, a file outside the workshop refused); a file holding `file:`, `http(s):` or `..` outside SVG's namespaces refused; fixtures with an iframe, an `<img>`, a CSS `@import` and an SVG `xlink:href` aimed at a stand-in gated file and at a stand-in server (by hand in K2: the PNG shows neither, and no request reaches the server); a font not installed refused; `wx`.
- **`graphic add` from the workshop; copies and reveals by id; `which` refusing a gated video it cannot copy:** fixtures.
- **The gate:** `picture` in `COMMAND_NAMES` and `UNSCOPED`, its HELP line and README row (the walks of 25 Oct's design).
- **The installer:** `--print` lines for each lock, for a Claude Code below the new minimum, and for the user settings' deny rules.

---

## 11. Risks, and what is accepted on Jason's word

- **Words on the web can steer Claude** (a page, a skill, a file in the workshop, a drawing: a widget runs scripts, loads from public code sites, and its `sendPrompt` sends a message to the chat as if she typed it). Held: the never list, the gated places and the dialogs, which do not rest on Claude's judgement; the card's receipt, which trusts only her click on a card in its fixed wording; and the chats that hold a session's words, which keep today's lock. Not held: brimm-video commands that change an answered video (a name, a cut, a finish), each kept by the rule in `history/` and undone by asking. **Accepted.**
- **Her other files are open to her chat**: her documents, her other Dropbox folders, her Downloads and Desktop, and anything on her Mac not listed as a gated place or a secret; once the web tools are opened, through WebFetch they could leave the Mac. This is how any Claude Code session with the web works, and Jason's "this cannot be fully self contained" accepts it for her own files. It does not accept it for sessions: a session's recording or transcript she keeps outside the gated places (a copy in Downloads, say) is open too, and sound becomes words in the sandbox. Held in part: Zoom's folder and Final Cut's backups gated, and the guide's "move, don't copy" (question 6). **The rest accepted**, if Jason agrees.
- **A guessed folder name** is answered yes or no by the sandbox (C19). **Accepted**: only an exact day and name; phase S names session folders by label.
- **What is running** can be read from the sandbox (C28): while brimm-video runs ffmpeg, ffprobe, whisper or `cp` on a video, a sandboxed script can read the video's path, and so an Episodes folder's name, from the program's arguments. Id-named arguments would not close it, since the program's open files give the same path to anything that reads process information, as `lsof` does, and nothing in her folder's settings closes the process information itself (section 1). **Accepted**: only while a program runs on that video; phase S names a session's folder and video by label. K0's next round tries `lsof -p`; if open files do not show, id-named arguments come back to Jason.
- **Another chat's command output**, in her folder's own temp subfolder, can be read (and written) from any chat of her folder while the file is on disk (C36; section 5). Not closable per chat, since the folder's settings are the same for every chat and name no chat's own temp folder. **Accepted**, narrowed: `edit.js` is never run in the background, so a held chat's teaching is on disk only while it prints. If the by-hand round finds the Code tab keeps output files after a command ends, this comes back to Jason.
- **The sandbox's own proxy login** reaches every sandboxed command, and so could be printed into the chat (C27): Claude Code sets it after any setting could take it away. It opens only that proxy, on her Mac, which refuses every host. **Not accepted: held.** WebFetch and WebSearch stay refused in her chats until the by-hand round shows a sandboxed command cannot read it, the messaging token or the rest, or Jason answers question 19. The other secrets of the app's environment are taken away from sandboxed commands by `credentials.envVars` (section 1).
- **WebFetch's look-up of a name** can give a public address to the guard and a private one to the fetch a moment later. **Accepted**, once the web tools are opened: it needs a name made for it, and the guard refuses every numeric and local address and every name that answers privately when it looks.
- **A hard link made by another program** (Dropbox, Time Machine, Photos) from a gated file to an ungated place would be readable (C35). brimm-video never makes one (a test). **Accepted**: no such program is known to do it.
- **An answered ordinary video found a session after all** may have its path in QuickTime's recent list, from a `which` that opened the original. **Accepted**; the chats that saw its words are held (section 5).
- **OpenRouter** sees the picture descriptions Claude writes; its zero-retention routing is pinned in each request and by the key's guardrail, and its providers' promise; it costs money (the daily count and the guardrail's budget bound it). **Accepted** by "the connection to open router is acceptable".
- **The OpenRouter key, outside her folder,** could be printed by any Claude session not in her folder, on a Mac that holds it. Bounded by the guardrail, and by keeping it on her laptop only. **Accepted** unless Jason takes the stricter `-T ""` (question 8).
- **Claude Code's own behaviour can change** with an update of the app's copy. The guard falls back to today's lock only when it can see a loosened setting, not a changed meaning. Held in part: the minimum version, `edit.js`'s own sandbox check, and step 9 again after a Claude update that changes the sandbox's documentation. **Accepted.**
- **Sandboxed commands have no network**, so some design tools that fetch packages will not work. Opening named hosts later is question 13.
- **The Claude app's own flags on her chat** (`--settings`, `--add-dir`) are now read by the guard and `behind`, with `ps`, from the parent `claude` (C30); the first draft's "nothing can read it" was wrong. What is left is a flag whose meaning the lock check does not know. Narrowed: `edit.js` refuses inside the sandbox. **Accepted.**
- **The Code tab's own added folder**, `side-session-notes/<id>`, is a working folder of every chat: it could bring skills, commands or agents if anything wrote them there (C17). Held: neither the sandbox nor Write can write into the app's data (section 1, "Writes"). **Accepted** as so held.
- **Her own Terminal panel** in the Code tab runs anything she types, outside every lock. It is her, not Claude. **Accepted, as today.**
- **A chat she starts in any other folder on her laptop** (the workshop, `Pictures/`, anywhere) has no guard and no sandbox, and reads Episodes freely: "it does not look like hers" was no privacy answer. Held in part, if Jason takes question 5: her user settings' `Read()` deny rules hold Claude's file tools in every folder. A script in such a chat is not held. `behind` refuses a session in a folder inside hers (PR #40). **The rest accepted**, if Jason agrees.
- **Plugins and skills** bring hooks and mods that run outside the sandbox. Held: named skills only, checked for hooks; a plugin with hooks or a mod is a loosened lock; Jason reviews her account's settings. Whatever her claude.ai account syncs in by itself is seen only when the lock check next runs.

## Constraints

- Node 22, no packages; `cd tool && node --test` passes; a failing test first.
- PR #40 merges first (question 14); K1 builds on `main` after it. The guide (merged) keeps its lines; the skill stays under 160 lines.
- Nothing is installed on a Mac without Jason's yes; Claude Code's sandbox is part of Claude Code and uses macOS's own Seatbelt; the WebKit drawer uses macOS's own WebKit, as phase V's drawer uses its own Swift.
- K0 is made on scratch copies only; experiments never write into a watched folder.

## Left to the builder

- The exact `excludedCommands` spelling with her laptop's node path, from the by-hand round (K0 settled the shape).
- How the guard caches the lock check, the gated folders' identities, the `ps` walk and the held chats' message `uuid`s, so a call stays fast.
- The exact form of her folder's name in the temp folder, from the by-hand round, for the narrow `allowRead`.
- The full list of the app's environment names to take away from sandboxed commands, from the by-hand round.
- The step texts of the new refusals, in plain words.
- Which recent-list, preference and log places K0's next round finds holding names, added to the gated places.

## What the review changed

Four reviews of the first draft (commit cc3bbc7), each checked against the code, Claude Code's binary or the lab before it was taken. Most were taken whole; where one was taken in part or not at all, the reason is given.

**Privacy (sessions and clients):**

1. A path spelled another way (letter case, `/System/Volumes/Data`) passed the guard. Checked: Node's `realpathSync` gives both back as typed (C26). **Taken:** paths compared by identity, both spellings in the settings, K0 and tests (section 1).
2. Glob's `pattern` was never checked. **Taken:** Glob's root from its pattern, and every path-like string in any tool's input (section 1). K0 then found 2.1.308 has no Glob at all (C20): the handling is kept for a later version.
3. `picture render` drew Claude's page outside the sandbox. **Taken** (section 3), with the other reviews' fixes.
4. "The chat never holds a session's words" was false. Checked: `tool/teachings.js:332` prints key phrases word for word; `printWhy` lets `show` print an ordinary video's words. **Taken, in a simpler and wider form:** a chat that holds a session's words keeps today's lock, which refuses everything the review listed, and also sandboxed commands, which could write into the workshop, a way out the review's list missed. The chat is tied by its process, not only by a `PostToolUse` hook, so that it fails closed (section 5).
5. Finder reveals put a client-named Episodes path into Finder's preferences. Checked: `tool/edit.js:5585`, `:4447`, `tool/finish.js:959`, `:1241`, `:1412`. **Taken:** reveals show copies by id; Finder's preferences gated, though that alone does not hold (the preferences service); K0 checks. **Taken in part** for `which`: it refuses to open the original only for a gated video. Refusing for every video would break `which` for most videos on her laptop, and an answered ordinary video's name is not a client's by her own answer (section 1).
6. Copies of a session outside the gated places. **Taken:** Zoom's recording folder and Final Cut's backups gated; the guide says move, not copy; the rest (Downloads, Desktop) is question 6.
7. The lists of places were incomplete. **Taken:** all of `~/.claude`, the temp folder, the Claude app's data, Dropbox's containers, both logs; K0 tries the system log, thumbnails and Notification Center (section 1).
8. A card Claude words itself could earn a receipt. **Taken:** the card's wording moves into code, and the hook matches it exactly (section 5).
9. Probing names. **Taken:** a name refusal ends `picture make` for the day, with a log line; `test -d` stated as accepted (C19, section 11).
10. Phase S's claim did not hold. **Corrected**, and the episode's video and status files named by label or id. **Not taken:** renaming the dropped file on arrival, since renames inside Dropbox were undone by Dropbox on 14 Oct (22 Oct design, phase T); the guide's advice to rename it before the drop stays (section 5).
11. Artifact tools were on the never list only as "publishing". **Taken:** reading, listing, comments and data are never allowed, whatever question 12's answer; local extensions never allowed, by kind (section 1).
12. The gated places held only in chats started in her folder. **Taken** as question 5 (her user settings' deny rules), with what they do not hold said plainly (sections 7, 11).
- Outside its lens, the Keychain: **taken** (C18, section 4).

**Code safety:**

1. Her folder's lock files had no static backstop. **Taken:** an `Edit()` deny of her folder, and a K0 check that the guard is called for subagents. K0 found it is (C2), so the subagent tool stays open in her folder (sections 1, 2).
2. `picture render` and `picture make` took a path and wrote by a name Claude chose. **Taken:** names only, by the picture-name rule, in the workshop, written with `wx`, and the renderer confined; carried into `graphic add` and `logo` (sections 1, 3, 4).
3. The narrowed `mcp__*` deny left later connectors to the guard alone. **Taken in part:** the K0 check of hooks in subagents, which K0 found are called (C2). **Not taken:** keeping a broad `mcp__*` deny with named tools as allow rules, because a deny beats every allow (C14): it would refuse the drawing tools and any named connector. Instead the deny names every family in the fixture but the drawing tools (section 2).
4. The guard allowed a bare `node` form that `excludedCommands` did not exclude. **Taken:** one spelling, a test that every allowed form is excluded (section 1).
5. `Monitor` was opened on an inference. **Taken:** it stays denied (section 1, "Network").

**How Claude Code behaves (the lab):**

1. `picture render` and links in the workshop. **Taken:** links refused in every workshop input, `wx` for every output, the renderer confined and its tests. **Not taken:** drawing inside Claude Code's sandbox as the main answer, because WebKit's page process and QuickLook's service are not the command's children and run outside the sandbox whatever it denies; the confinement must be WebKit's own (section 3).
2. The Agent tool's `isolation` and `cwd`. **Taken** (C21, never list).
3. "Any skill" was wrong: skills can register hooks. **Taken:** named skills only, checked for hooks; question 4's recommendation changed (C22, section 2).
4. An auto-answered card could write a receipt. **Taken:** no receipt with `afkTimeoutMs` or `followUp` or a question unanswered; answers from `tool_response`; K0 check (C23, section 5).
5. `edit.js` could run inside the sandbox and fail partway. **Taken:** one spelling, and `edit.js` refuses under `SANDBOX_RUNTIME=1` (C24, section 1).
6. Folders added to her session. **Taken:** `additionalDirectories` is a loosened lock; the guide says never to add one. K0 found an added folder in the parent `claude`'s arguments and the transcript, and the Code tab's own added folder, which the lock check now expects (C30, section 1).
7. Sandboxed commands write `.claude`, `CLAUDE.md` and `.mcp.json` into the workshop. **Taken:** `Edit()` denies for them, the look kept as a backstop (section 1).
8. Monitor's WebSocket form, Glob's pattern, the `strictAllowlist` fallback. **Taken:** Monitor denied, Glob's root from its pattern (for a later version, C20), the fallback dropped (the lab saw `deniedDomains: ["*"]` taken).
- The lab's findings are marked in the table of section 1, with what K0 found of each.

**OpenRouter and design tools:**

1. `picture render`, and the wrong "cousin" sentence. Checked: the phase V plan's Task V1.3 draws a JSON list with CoreText. **Taken**, with the sentence corrected; whether to build the new drawer at all is question 10. **Taken in part:** the refusal of a file holding `http:`, since every SVG holds `http://www.w3.org/2000/svg` in its namespace; those declarations are excepted, and the content rules still block any load (section 3).
2. The no-training promise rested on fields the image page does not document. **Taken:** `provider.only` and `allow_fallbacks: false`, the key's guardrail, training off, and K3's checks that must fail (section 4).
3. No model was named. Checked against the zero-retention list of 26 Oct. **Taken:** a model and provider pair from that list, `aspect_ratio`, the answer's kind checked (section 4; question 9).
4. The Keychain fact was wrong, and the key is open outside her folder. **Taken** (C18, section 4; question 8).
5. The `CLAUDE.md` wording allowed more sending than decided. **Taken:** "only these two things … without Jason's yes", in K3's pull request (section 8).
6. The `docs/requirements.md` wording said more than he decided and dropped his 22 Oct facts. **Taken** (section 8).
7. Cost and logging. **Taken:** the count kept in Application Support with refusals counted, the guardrail's budget, one log line per call; a name refusal ends pictures for the day, stricter than "after a few" (section 4).
8. "Her words" is not what is sent. **Taken:** the wording says "a description Claude writes from her request" everywhere. **Not taken:** a dialog for her to approve each picture, since WebFetch already carries anything an ordinary chat holds, so a dialog on OpenRouter alone would not change what can leave, and a chat that holds a session's words cannot run `picture make` at all.
9. Design skills. Checked on the Mac Studio: synced skills and org plugins arrive by themselves. **Taken:** the design skills named, Jason's review of her account's settings, a K2 check, the routes listed in `brimm-graphics`, a plugin with hooks or a mod a loosened lock (sections 2, 3, 7).
10. Drawing in the chat, and the first draft's question 6 (Artifact pages). **Taken:** `mcp__visualize__*` never in the deny list; the widget is for sketches; K2 checks its download; widgets' scripts and `sendPrompt` in the risks. Question 12 now gives Jason both choices. **Taken in part:** choice (b) is publishing only, since reading or listing pages would reach the BRIMM Ops page, which holds sessions' principles (privacy 11).

## What K0 changed

K0's lab checks (`docs/superpowers/notes/2026-10-26-lock-k0-findings.md`, "What the design must change") asked for 20 changes. Each is taken; where the note offered "close it or accept it", the choice and its reason are given. Jason's yes of 26 Oct to all 18 recommendations is kept.

1. **Glob and Grep are absent in 2.1.308.** Said in sections 1, 2, 5 and 6; searching is `grep -r`, `rg` and `find` in the sandbox; the guard's Glob and Grep handling kept for a later version; K0's and step 9's checks use `grep -r`, `rg` and `find` (C20).
2. **Deny rules did not hold `cat` in a sandboxed session.** C4 corrected; the read protection rewritten as the sandbox first, deny rules second, the guard third (section 1); question 5's rules said to hold the file tools only, their hold on Bash untested (section 7).
3. **`excludedCommands` strips `nice` and `env -u`.** C7 corrected; the guard refuses anything in front of the spelling, `nice`, `env`, `timeout`, `nohup`, `time` and `stdbuf` pinned by tests (sections 1, 6, 10).
4. **`SANDBOX_RUNTIME` can be removed.** `edit.js` also refuses when `ps` of its parent fails with "Operation not permitted" (sections 1, 10).
5. **The `denyRead` of Claude's folders broke everyday commands.** The three narrow `allowRead` entries added; heredocs stay broken, so Claude uses Write in the workshop (sections 1, 2, 7; C36).
6. **Another chat's command output.** Closing it per chat is not buildable in K1: the folder's settings are the same for every chat and name no chat's own temp folder, and `CLAUDE_CODE_TMPDIR` would be one folder for all. **Accepted**, narrowed by never running `edit.js` in the background; the two-chat check decides if it comes back (sections 5, 11).
7. **The Code tab's own added folder is writable.** Writes into `~/Library/Application Support/Claude` denied by `denyWrite` and an `Edit()` rule; the lock check expects that one folder (sections 1, 6, 7).
8. **The app's `--settings` and `--add-dir` can be read.** The guard and `behind` read them with `ps` from the parent `claude`, and `/add-dir` from the transcript; the "nothing can read it" gap removed (sections 1, 6, 11; C30).
9. **The mark.** It carries `CLAUDE_CODE_SESSION_ID` and the `claude` process `edit.js` finds, checked against `CLAUDE_PID`; any SessionStart hook outside her folder is a loosened lock (sections 1, 5, 6).
10. **Forks.** The guard holds a chat whose transcript holds a held chat's message `uuid`s; a resumed chat keeps its id (section 5; C32).
11. **Process arguments.** Id-named arguments are buildable, but would not keep the name private: a running program's open files give the same path to anything that reads process information, which the sandbox allows. **Accepted** (sections 1, 11); K0's next round tries `lsof -p`, and if open files do not show, this comes back.
12. **WebFetch to numeric and local addresses.** Refused by the guard, in every spelling and by look-up (sections 1, 6, 10; C29).
13. **Hard links.** "Nothing outside the sandbox hard-links a gated file into an ungated place", with a test that brimm-video never does (sections 1, 10; C35).
14. **`.cc-writes`.** The lock check leaves it alone (sections 1, 6; C34).
15. **Trust.** `behind` reports an untrusted folder from `~/.claude.json`; step 9 trusts the folder first (sections 1, 6, 7; C31).
16. **`/sandbox`'s "No sandbox".** Still offered; the lock check catches what it writes, once the by-hand round has seen where (sections 1, 6; C33).
17. **The app's environment.** The messaging token and socket, her email, her account ids and `SSH_AUTH_SOCK` are taken away from sandboxed commands by `sandbox.credentials.envVars` (a setting 2.1.308 takes from the folder's settings). The sandbox's own proxy login cannot be: Claude Code sets it after that list. So WebFetch and WebSearch are **held** until the by-hand round shows the secrets cannot be read from the sandbox; this changes what she can do, so it is question 19 (sections 1, 2, 7, 11; C27).
18. **Subagents.** "If not, `Agent` is denied" dropped (the guard is called, with an `agent_id`); the subagent tool matched as `Agent` and `Task` (sections 1, 2, 6; C2, C21).
19. **The C-facts table.** C2, C4, C7, C13, C14, C20, C24 and C26 corrected with K0's results, a K0 column added, and C27 to C36 added for what K0 found that no claim covered; the `/System/Volumes/Data` spelling in the rules said to be unneeded in 2.1.308 and kept, as harmless (section 1).
20. **`GUARD_CLAUDE`.** Not set until the by-hand round passes; until then the installer writes the strict lock only (sections 7, 9).

## Jason's questions

Most important first.

1. **Where the open lock applies.** Her laptop only; the Mac Studio's folder for Claude keeps today's lock, since that Mac holds your own transcripts and your other projects' secrets. *Recommended: her laptop only.*
2. **A chat that holds a session's words keeps today's lock**: once she asks for a session's teachings, or a video it showed is found a session after all, that chat runs brimm-video only, and she starts a new chat for anything else. *Recommended: yes.*
3. **The card's receipt, with the card's wording fixed in code, built with the open lock (K1), not after it**, so that only her click answers a card. *Recommended: yes; the open lock is not turned on without it.*
4. **Skills.** Only the skills you name (brimm-edit, brimm-graphics, frontend-design, and theme-factory if her account has it), since a skill can bring hooks that run outside the sandbox; or any skill. *Recommended: named skills only.*
5. **Her laptop's user settings get the gated places' deny rules**, so that a chat she starts in any other folder cannot read Episodes with Claude's file tools (a script there still could). *Recommended: yes, written by the installer on your yes.*
6. **Copies of a session outside BRIMM Video.** Gate Zoom's recording folder and Final Cut's backups; the guide tells her to move a recording into the drop folder and delete Zoom's original; Downloads and Desktop stay open to her chat. *Recommended: yes.*
7. **The guard falls back to today's lock** whenever anything about the lock is loosened on her Mac, rather than relying on `behind` at the start. *Recommended: yes.*
8. **The OpenRouter key and its limits.** A key for brimm-video alone, under OpenRouter's guardrail (the named zero-retention provider and model only, a small daily budget), training off on the account, in her laptop's Keychain only; outside her folder that is a rule, not a lock. Or, stricter, the item trusts no program, so macOS asks her at every picture. *Recommended: the guardrailed key in the Keychain, with no prompt.* And first ask Sallie what she wants OpenRouter for: this design covers pictures only.
9. **Which picture model.** One model and provider from OpenRouter's zero-retention list. *Recommended: `google/gemini-3.1-flash-image` on Google Vertex.*
10. **`picture render`.** A new WebKit drawer for Claude's SVG and HTML, confined to the one file; or drop it, and widen `card make` instead. *Recommended: build it, confined, in K2.*
11. **Graphics beyond text cards.** Your 25 Oct words widen your 22 Oct "that's all" to the pictures she asks for: sketched in the chat, made in the workshop, made by OpenRouter. *Recommended: yes.*
12. **Artifact pages.** (a) All refused; or (b) she may publish a private page of her own from the workshop, which only her own click shares, while reading and listing pages stay refused (they would reach the BRIMM Ops page). *Recommended: (a), keep them refused.*
13. **Network for her commands.** None (web pages reach her chat only through WebSearch and WebFetch, OpenRouter only through brimm-video), or named package hosts for design tools that need them. *Recommended: none, for now.*
14. **PR #40.** Merge it as it is first, then build this on it. *Recommended: yes.*
15. **Connectors.** None named at first; Canva's connector (designs kept online, with share and publish tools the never list would refuse) only on a later yes. *Recommended: none at first.*
16. **Where Claude writes.** Only a workshop, `~/BRIMM Video Workshop`, outside her folder; or also her folder (and its `Pictures/`), where a session started in a subfolder would look like hers with no lock. *Recommended: the workshop only.*
17. **`PushNotification`** to her phone, as her note 2 asked, except from a chat that holds a session's words. *Recommended: yes.*
18. **The session drop folder**, so that her upfront "yes" marks the video a session at the import, and everything the import makes for it is named by its label. *Recommended: yes, as phase S after K.*
19. **The web tools, while the sandbox's proxy login can be read.** Claude Code gives every sandboxed command a login to its own network proxy, which no setting can take away; it opens only that proxy, on her Mac, which refuses every host. The rule taken here is that the app's secrets reach neither a sandboxed command nor the chat, so WebSearch and WebFetch are held until a by-hand check shows they cannot be read, which, from the 2.1.308 binary, it will not while Claude Code hands the login out. (a) Keep the web tools held until then; or (b) accept the proxy login, since it opens nothing outside her Mac, and open the web tools once the by-hand round shows the messaging token, her email and her account ids are gone from sandboxed commands. *Recommended: (a), the rule as taken, until the by-hand round; then decide with what it shows.*
