# Her folder's lock, loosened: K1, the open lock (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the open lock for her folder for Claude (a never list; the gated places, held by Claude Code's sandbox, by deny rules and by a guard that compares paths by identity; chats that hold a session's words kept to today's lock; the card's receipt; `edit.js`'s own sandbox check), behind a per-Mac `lock` setting that stays `strict` everywhere until Jason turns it on after the by-hand round.

**Architecture:** `settings.js studio` writes her folder in one of two shapes: strict (today's, byte for byte) or open (sandbox on, deny rules, the guard, a receipt hook, memory off). The guard (`tool/studio/guard.mjs`) reads this Mac's `lock`: strict runs today's `guardDecision`; open runs the shared lock check (`tool/loosened.js`) and the held-chat check (`tool/held.js`), falls back to today's decision when either says so, and otherwise asks the new `openDecision` (`tool/open-lock.js`). `edit.js` marks a chat that is shown a session's words, hands those words over by a file only that chat's Read reaches, checks a receipt before `kind` answers a waiting video, refuses inside the sandbox, and opens and reveals copies named by id; every one of these but the mark only on an open-lock Mac.

**Tech Stack:** Node 22 ES modules, `node:test`, no packages; the zsh installer; macOS `ps`, `lsof`, `plutil`, Finder (`open -R`), always through stand-ins in tests.

**Spec:** `docs/superpowers/specs/2026-10-26-brimm-video-lock-loosened-design.md` (sections 1, 2, 5, 6, 7, 8, 10, 11; K1 only, not K2, K3 or S), with `docs/superpowers/notes/2026-10-26-lock-k0-findings.md`. Executors read both.

## Global Constraints

- Node 22 or later, no packages. `cd tool && node --test` passes after every task. A failing test first, then the code.
- No test calls the real `claude`, OpenRouter, `security`, `osascript`, `ps`, `lsof`, WebKit, or `install.sh` without `--print`. `ps` and `lsof` are always stand-ins (functions in `deps` or `ctx`), never an environment variable a sandboxed command could set.
- **The strict lock is the default everywhere.** A Mac with no `lock` setting, or one that cannot be read, is strict: today's settings, today's guard, PR #40's `behind`. Merging K1 changes nothing on either Mac until Jason runs `node tool/settings.js studio --node <node> --lock open`, which refuses while `OPEN_LOCK_CLAUDE` (R2) is null.
- Never read a `.env` file or a key. Nothing is installed and no launch agent changed without Jason's yes; `install.sh` only with `--print` in tests. Experiments never write into a watched folder. Never push.
- Her skill (`tool/studio/SKILL.md`) stays under 160 lines and runs only commands `edit.js` has (`COMMAND_NAMES`).
- Nothing `edit.js`, the guard, `behind` or the receipt hook prints holds a file's contents, an environment variable's value, a gated video's file or folder name, or a client's name. Lines for Jason are in parentheses and end "Its contents are not shown here." (or "Its value is not shown here." for the environment), as PR #40's do.
- Everything `edit.js` writes into a place a sandboxed command can reach is created with `wx`. Marks, receipts, words files and the guard's cache are in Application Support, never the workshop or the temp folder.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Exact strings that must not drift (design): `LOCK_CHANGED` = "This folder's lock is changed on this Mac: ask Jason before going on."; `HELD_REFUSED` = "This chat holds a session's words, so it can only run brimm-video now. Start a new chat for anything else."; `SANDBOXED` = "brimm-video was run inside Claude Code's sandbox: ask Jason."; `UNTRUSTED` = "Claude Code has not trusted this folder yet: open it once and choose to trust it."; `cantOpen(label)` = `${label} can't be opened on this Mac without showing its file's name: ask Jason.`; `RUN_ALONE` begins "Run brimm-video's commands on their own".

## Review Focus

Five inputs the design implies but no single test of its list exercises, most likely first. Each has its test in the task named.

1. **A hook call missing a field** (no `transcript_path`, no `session_id`, no `cwd`, or a `tool_input` that is not an object). Expected: the guard falls back to today's decision (fails closed), never throws past `guard.mjs`. Task 19, "falls back to today's guard for a call with no session id, transcript or folder".
2. **A transcript still being written, or very large**, when the guard scans it for a held chat's message `uuid`s. Expected: the last, unfinished line is skipped, only bytes added since the last look are read, and nothing is wrongly let go. Task 15, "reads only what a transcript added since the last look, and skips a line still being written".
3. **A label with an apostrophe, a slash, quotes, a colon or a leading dot**, in the words file's name and in the `Card:` JSON line. Expected: a safe file name in the chat's own folder, and JSON that parses back to the very label. Tasks 15 and 22.
4. **Two guard calls at once** (a chat and its subagents) writing the lock check's cache. Expected: written whole (temporary name, then rename); a cache that is half written or not JSON is ignored and the check made again. Task 19, "ignores a cache another call is writing, or one that is not JSON".
5. **A gated place that is not there yet** (Zoom's folder before the first recording, `~/.aws` on a Mac without it). Expected: compared by its text, both spellings, letter case folded, so it is held the moment it is made. Task 4, "holds a gated place that is not there yet by its text, both spellings, any letter case".

Beside these, one condition of the test runner itself: the suite is often run from inside Claude Code, where `CLAUDECODE=1` and the app's secret-shaped names are in `process.env`. No test may take `process.env` for the chat's environment: the shared worlds give `env: {}` (Tasks 5 and 21), so a test marks nothing, runs no `ps` and is not loosened by the runner's own environment.

## Rulings

Where the design leaves a choice, or two parts of it pull apart, this plan decides as follows. Each is for Jason to overrule.

- **R1. Strict stays as it is.** `guardDecision`, the strict `settingsOf`, the strict `lockBroken` and PR #40's `lockLoosened` reasons are unchanged. Every new reason, refusal, file hand-over, receipt check and copy-by-id applies only where this Mac's settings say `lock: "open"`. Two harmless exceptions, both failing closed: the mark (R7), and the `Card:` lines `episodes` prints (R10).
- **R2. `OPEN_LOCK_CLAUDE`, not an unset `GUARD_CLAUDE`.** `GUARD_CLAUDE` stays `2.1.295`, which the strict lock needs. A new `export const OPEN_LOCK_CLAUDE = null;` in `tool/studio.js` is the Claude Code version the by-hand round passed on. While it is null, `settings.js studio --lock open` refuses and the installer writes the strict lock. Setting it is a one-line change after the by-hand round, on Jason's yes.
- **R3. What the by-hand round records is data in the checkout, and starts so that the open lock fails closed:** `tool/studio/app-flags.json` is `{"flags": []}` (every flag the app passes is outside the record, so every chat is loosened); `tool/studio/environment.json` has the design's `deny` names and `harmless: []`. The fixture of the Code tab's tool list is recorded from a Mac Studio session in Task 1, and replaced by by-hand item 9's.
- **R4. New, focused modules instead of a larger `studio.js`:** `never.js`, `places.js`, `chain.js`, `loosened.js`, `held.js`, `fetchable.js`, `receipts.js`, `sandboxed.js`, `open-lock.js`, `reveal.js`. `lockLoosened` moves to `tool/loosened.js` (the design says `studio.js`); `edit.js` re-exports `LOCK_CHANGED`.
- **R5. `guardDecision` stays synchronous and strict;** the open decision is a new `async openDecision`, since WebFetch's look-up is asynchronous.
- **R6. `guide "<video>" tell` in the background.** The design refuses `edit.js` with `run_in_background`, but her skill runs `guide … tell`, which waits up to 60 minutes, only that way. The open guard allows `run_in_background` for exactly `<node> "<checkout>/tool/edit.js" guide <WORD> tell` (an UNSCOPED command whose one line names a label; and in K1 a session's words are never command output) and refuses it for every other `edit.js` command.
- **R7. The mark is written under Claude Code (`CLAUDECODE=1`) on any Mac where her folder exists, strict or open,** so a Mac turned open later still holds the chats that were shown a session's words. Handing the words over by file is open-lock only.
- **R8. Which commands mark and hand over:** `teachings`, `principles`, `ideas`, `finish`, `reel` and `render` (SESSION_TAUGHT beyond SESSION, `tool/gate.js`), when the record found is a session not cleared, except a detached run (`read`, or any command run with `--now`), which prints to no chat. Everything such a command says after its episode is found goes into the words file; the chat gets one line.
- **R9. A session after all** is noted by `kind` when it answers a video already answered as another kind as a session, with the time it does so; and on the other Mac by `findEpisode`, the first time it reads a record whose `session.emptyRevision` is set (the mark of a session after all), with the time it saw it, which is later than the correction and so fails closed. A chat whose transcript began at or before such a time is held.
- **R10. The card in code.** `episodes` prints, under each waiting video, `    Card: <JSON>`, and `    Card if not a session: <JSON>` when its Came line says Zoom or sound alone; `kind` prints the same second line after `ASK_IF_SESSION`. The skill passes the JSON to `AskUserQuestion` as it is. The Zoom follow-up gains the label, so that a receipt names one video: "<label> came from Zoom, which is often a client or group session. Which is it?"; "<label> is sound alone, which is often a client or group session. Which is it?"; and, with neither known, "<label> may be a Zoom download or sound alone, which is often a client or group session. Which is it?".
- **R11. The receipt** takes the questions and option labels from `tool_response.questions` and the answers from `tool_response.answers` (an object keyed by question text), as 2.1.308's `AskUserQuestion` result is shaped; the fixture is replaced by by-hand item 10's recording. The receipt hook's args gain her folder (`[receipt.sh, node, folder]`), from which it finds the home folder (R25).
- **R12. Copies and reveals by id are open-lock only**, in `~/BRIMM Video Work/shown/<record id>/`; `behind` clears both the old `shown/` folders and the new.
- **R13. The workshop's name-only reader and its `wx` writer are built in K2**, with their first caller (`picture render`, `graphic add`). K1 makes the workshop, writes the settings that confine writes to it, and guards it.
- **R14. Id-named arguments for child programs are not built:** they wait on K0's next round (`lsof -p`).
- **R15. The subagent tool** (`Agent` or `Task`) is allowed with no `subagent_type` or one of `general-purpose`, `Explore`, `Plan`; any other is refused. By-hand item 9 confirms the list.
- **R16. A per-Mac `tool` entry** may not name a never-list tool, `NotebookEdit` or `Monitor`; it may name the `Cron*` tools and `Workflow`, which are otherwise denied.
- **R17. The open shape is checked whole:** `lockBroken` (open) compares each security key of her folder's settings with what this checkout writes for this Mac (the node taken from the file itself), so a folder written by an older brimm-video, lacking a place gated since, says "changed" rather than "out of date".
- **R18. The new lock-check reasons run only on an open-lock Mac.** On a strict Mac `behind` and the guard are PR #40's.
- **R19. Paths by identity:** each folder along a path is compared by (device, inode) with the gated places that are there; a gated place not there yet is compared by its text, both spellings, letter case folded.
- **R20. `.env` files** are held by the guard (any path whose name is `.env` or starts with `.env.`) and by `Read(**/.env)` and `Read(**/.env.*)` deny rules. The sandbox's `denyRead` gets no pattern for them (whether it takes globs is not known), so a sandboxed `cat` of a `.env` outside the listed secret folders is not held: listed below as unbuildable now.
- **R21. A plugin "carrying hooks or a mod"** is a plugin folder holding `hooks/hooks.json`, or a `.claude-plugin/plugin.json` with a `hooks` or `mods` key. Enabled means `enabledPlugins["<name>@<marketplace>"] === true` in any settings source, and every plugin under `~/.claude/plugins/synced/*/` counts as enabled. The mod marker is the by-hand round's to confirm.
- **R22. A named skill's folders:** `<her folder>/.claude/skills/<name>`, `~/.claude/skills/<name>`, `~/.claude/plugins/cache/*/*/*/skills/<name>` and `~/.claude/plugins/synced/*/*/skills/<name>`. Where the app keeps an account-synced skill (theme-factory) is by-hand item 9's.
- **R23. Wording in K1 (section 8):** `docs/requirements.md` gets the heading with Jason's words, the lock bullet without "and pictures from OpenRouter" (K3 adds those words, the "Kept" line and this repo's `CLAUDE.md` lines), a line under "Decisions" and a change line. This repo's `CLAUDE.md` is unchanged in K1.
- **R24. Question 5:** the installer prints her user settings' `Read()` deny rules, and writes them only with a new `--user-deny` flag, through a new `node tool/settings.js user-deny`, which adds them to `~/.claude/settings.json` and keeps everything else there.
- **R25. The guard and the receipt hook take the home folder as the folder above her folder,** the path written into their args by `settings.js studio`, never from `HOME`. Tests then give a made-up folder and home.
- **R26. Process facts:** one `ps -A -ww -o pid=,ppid=,lstart=,args=` per check; the parent `claude` is the first process up the chain whose executable's name is `claude`; its arguments are split at each " --".
- **R27. A transcript's start** is its first line's `timestamp`. A transcript that cannot be read, while any mark or session-after-all time exists, holds the chat.
- **R28. The card's version answers** ("A new version of <name>", "A finished version of <name>") use `shownName` of the Maybe line's video, as `cardLines` prints it.

## Not built in K1, and what the design leaves unbuildable now

- Waiting on the by-hand round (the design's last list): the record of her chat's flags (item 2), the harmless environment names (item 4), her laptop's node path (item 3), her folder's name in the temp folder (computed here by Claude Code's rule, confirmed there), the subagent tool's name and built-in agents (item 9), the `AskUserQuestion` result's exact shape (item 10), where the app keeps account-synced skills and what marks a mod (item 9), and whether her trust is kept in `~/.claude.json` as `hasTrustDialogAccepted` (item 1; if the Code tab keeps it for the session only, the untrusted line is taken out). Until each is recorded, the code reads data that fails closed.
- Waiting on K0's next round: id-named arguments (`lsof -p`); the recent lists, preferences and logs found holding names, to add to the gated places; whether `sandbox.network.httpProxyPort` and `socksProxyPort` remove the proxy login and `credentials.envVars` takes names away (K1 writes both; the web tools stay held until Jason runs `--web open`); whether the sandbox's `denyRead` takes a `.env` glob (R20).
- Later phases: `picture render`, `brimm-graphics`, `graphic add` and `logo` from the workshop, the workshop's name-only reader (K2); `picture make`, `settings.js pictures`, the repo `CLAUDE.md` and the rest of `requirements.md` (K3); the session drop folder (S). The guard's refusal of `picture` in a held chat is built now (one line), so K3 cannot forget it.
- One departure for Jason to confirm: R6 (`guide … tell` in the background).

## File Structure

| File | Responsibility |
|---|---|
| `tool/never.js` (new) | The never list: tools by name, MCP servers by kind, posting words, the subagent's limits; the settings' deny entries for it |
| `tool/studio/never.json` (new) | The never list's data: exact tool names, and the local MCP servers seen in the Code tab |
| `tool/places.js` (new) | The gated places for a Mac, both spellings, what Bash may read, and the identity check of paths in any tool input |
| `tool/chain.js` (new) | The process table from `ps`, the chain up from a process, the `claude` above it, its flags and version |
| `tool/loosened.js` (new; from `edit.js`) | The one lock check `behind` and the guard make: PR #40's reasons, and on an open-lock Mac the new ones; the untrusted line |
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
| `tool/tests/open-world.js` (new) | A made-up open-lock Mac for tests: home, root, folder, workshop, ps text, transcripts |
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
  - `NEVER_WORDS: string[]` = `["send","post","publish","share","schedule","upload","forward","reply","invite","delete","trash","remove"]`
  - `BUILT_IN_AGENTS: string[]` = `["general-purpose","Explore","Plan"]` (R15)
  - `DRAWING: string[]` = `["mcp__visualize__show_widget","mcp__visualize__read_me"]`
  - `isConnector(name: string): boolean`: `/^mcp__[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}__/`
  - `isLocalExtension(name: string): boolean`: an `mcp__<server>__` tool that is not a connector's and not `mcp__visualize__`
  - `neverCaught(name: string, input?: object): boolean`
  - `neverDenyRules(allowed?: {type,name}[]): string[]`: the settings' deny entries: `never.json`'s tools, `mcp__<server>__*` for each of its servers, and `CronCreate`, `CronDelete`, `CronList`, `Workflow` unless `allowed` names them as `tool`

- [ ] **Step 1: Record the fixture.** In a Code-tab session on the Mac Studio, write every tool name the session lists (its tool list and its deferred-tool list), names only, sorted, as `{"recorded": "2026-10-26, Mac Studio, the Claude app's Claude Code (Code tab)", "tools": [...]}`. Add `Agent`, `Task`, `AskUserQuestion`, `TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` if a subagent's list lacks them (a chat has them). By-hand item 9 replaces it with her laptop's.
- [ ] **Step 2: Write `never.json`.** `tools`: `Artifact`, `ArtifactComments`, `ArtifactData`, `RemoteTrigger`, `EnterWorktree`, `ExitWorktree`, `SearchPlugins`, `SuggestPluginInstall`, `SuggestSkills`, `SendMessage`, `DesignSync`, `NotebookEdit`, `Monitor`. `servers`: every MCP server in the fixture that `isLocalExtension` takes (`computer-use`, `Claude_Browser`, `claude-in-chrome`, `Control_Chrome`, `playwright`, `terminal`, `PDF_Tools`, `plugin_pdf-viewer_pdf`, `knowledge-mcp`, each `ccd_*`, `scheduled-tasks`, `mcp-registry`, and the rest the fixture holds).
- [ ] **Step 3: Write the failing tests** in `tool/tests/never.test.js`:

```js
it("refuses by name every tool the design puts on the never list", () => {
  for (const name of ["Artifact","ArtifactComments","ArtifactData","RemoteTrigger","EnterWorktree","ExitWorktree","SearchPlugins","SuggestPluginInstall","SuggestSkills","SendMessage","DesignSync","NotebookEdit","Monitor"]) assert.equal(neverCaught(name), true, name);
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
  - `lockOf(s): "strict"|"open"` (only `s.lock === "open"` is open); `webOf(s): "held"|"open"`; `zoomFolderOf(s, home): string` (default `join(home, "Documents", "Zoom")`); `studioAllowOf(s): {type,name}[]` (default `[]`); `proxyPortOf(s): number|null`
  - `settingsFault` accepts optional `lock`, `web`, `zoomFolder`, `studioAllow`, `proxyPort`

- [ ] **Step 1: Write the failing tests:**

```js
it("keeps the lock strict, the web tools held and Zoom's folder in Documents when the settings say nothing", () => {
  assert.deepEqual([lockOf({}), lockOf({ lock: "open" }), lockOf(undefined), webOf({}), webOf({ web: "open" })], ["strict", "open", "strict", "held", "open"]);
  assert.equal(zoomFolderOf({}, "/Users/sallie"), "/Users/sallie/Documents/Zoom");
});
it("refuses a lock, a web setting, a Zoom folder or a proxy port that will not do", () => {
  for (const [more, why] of [[{ lock: "loose" }, 'the lock must be "strict" or "open"'], [{ web: "on" }, 'the web tools must be "held" or "open"'], [{ zoomFolder: "Zoom" }, "the Zoom folder is not a whole path"], [{ proxyPort: 80 }, "the proxy port must be a whole number from 1024 to 65535"], [{ proxyPort: 47123.5 }, "the proxy port must be a whole number from 1024 to 65535"]])
    assert.equal(settingsFault({ ...good, ...more }), why);
});
it("keeps an entry her folder allows only when it is typed and exact, and never one on the never list", () => {
  const WHY = "an entry her folder allows must be a skill by its name, a connector's tool by its exact name, or a tool the never list does not hold";
  const id = "mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__";
  for (const ok of [{ type: "skill", name: "theme-factory" }, { type: "mcp-tool", name: id + "list_designs" }, { type: "tool", name: "CronCreate" }]) assert.equal(settingsFault({ ...good, studioAllow: [ok] }), "");
  for (const bad of [{ type: "skill", name: "../x" }, { type: "mcp-tool", name: "mcp__PDF_Tools__fill_pdf" }, { type: "mcp-tool", name: id + "*" }, { type: "mcp-tool", name: id + "send_invoice" }, { type: "tool", name: "Monitor" }, { type: "tool", name: "NotebookEdit" }, { type: "tool", name: "Artifact" }, { type: "plugin", name: "x" }, "brimm-edit"])
    assert.equal(settingsFault({ ...good, studioAllow: [bad] }), WHY, JSON.stringify(bad));
});
it("shows the lock, the web tools, Zoom's folder, the entries allowed and the proxy port", () => {
  // show on settings { lock: "open", web: "held", proxyPort: 47123, studioAllow: [{type:"skill",name:"theme-factory"}] }
  // said lines include exactly:
  //   "  Her folder's lock:  open", "  The web tools:  held", "  Zoom's recordings:  <home>/Documents/Zoom",
  //   "  Also allowed in her folder:  skill theme-factory", "  Her folder's proxy port:  47123"
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test --test-name-pattern="lock strict|web setting|her folder allows|proxy port" tests/settings.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the five readers and the checks in `settingsFault`, in the order the test lists them, after `sessionTeachings`. A skill name is `/^[a-z0-9][a-z0-9-]*$/`; an `mcp-tool` is `isConnector(name)` with no `*` and `!neverCaught(name)`; a `tool` is not `mcp__`-prefixed, not `*`, and `!neverCaught(name)`. `show` says the lock and the web tools always, and the rest only when set.
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
  - `gatedPlaces({ home, root, uid, folder, zoomFolder }): Place[]`, `Place = { path: string, readRules: string[], kind: "folder"|"file", carve?: "claude"|"tmp"|"app"|"words" }`
  - `readAllowed({ home, root, uid, folder }): string[]`
  - `isEnvFile(path): boolean` (name `.env` or starting `.env.`)

The places, all by `realOf` (`BV` = root; `DB` = the first folder above `BV` holding `.dropbox.cache`, when one does; `AS` = `home/Library/Application Support`):

| Place | `readRules` |
|---|---|
| `BV` | `BV/Drop`, `BV/Episodes`, `BV/Unedited Video` |
| `dirname(BV)/BRIMM VIDEO Transfer`, `zoomFolder`, `home/Movies/Final Cut Backups`, `home/BRIMM Video Work`, `AS/BRIMM Video` | itself |
| `AS/BRIMM Video Words` (carve `words`), `home/.claude` (carve `claude`), `/private/tmp/claude-<uid>` (carve `tmp`) | none |
| `AS/Claude` (carve `app`), `home/.claude.json`, `AS/com.apple.sharedfilelist`, `home/Library/Preferences/com.apple.finder.plist`, `home/.dropbox`, `AS/Dropbox`, `DB/.dropbox.cache`, `home/Library/Group Containers/G7HH3F8CAK.com.getdropbox.dropbox.sync`, `home/Library/Containers/com.getdropbox.dropbox.fileprovider`, `….TransferExtension`, `….garcon`, `home/Library/Logs/brimm-video.log`, `home/Library/Logs/brimm-video-claude-check.log`, `home/.ssh`, `home/Library/Keychains`, `home/.aws`, `home/.config`, `home/.netrc`, `home/.git-credentials`, `home/.npmrc` | itself (none for `AS/Claude`, which Claude Code reads its own program from) |

`readAllowed` = `[BV/Assets, /private/tmp/claude-<uid>/<claudeDirName(folder)>, home/.claude/shell-snapshots, AS/Claude/claude-code]`.

- [ ] **Step 1: Write the failing tests** (a made-up home `<tmp>/Sallie's home`, root `<tmp>/Dropbox (Personal)/The BRIMM DB/BRIMM Video`, `.dropbox.cache` in `<tmp>/Dropbox (Personal)`):

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
it("lets Bash read Assets and the three places Bash needs, and no other", () => { assert.deepEqual(readAllowed(w), [/* the four, in order */]); });
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
  - `gatedIndex(places: Place[], open: string[]): { at(path: string): Place|null, holds(dir: string): boolean }`. `at` walks the path's folders, following links, with `statSync`, and gives the gated place one of whose (dev, ino) it meets, unless it meets an `open` folder's first (Assets, a carve-out); a place not there is matched by its text, both spellings, letter case folded (R19); a path whose name `isEnvFile` is a gated place of its own. `holds(dir)`: some gated place lies inside `dir` (its parents walked for `dir`'s identity).
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
it("says a search folder holds a gated place when one is inside it", () => { assert.ok(ix.holds(w.home)); assert.ok(!ix.holds(join(w.home, "Documents"))); });
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
  - `Facts = { home, root, uid, zoomFolder, port, web: "held"|"open", allow: {type,name}[] }` (allow is `ALLOW_DEFAULT` plus this Mac's)
  - `studioFiles({ checkout, node, folder, lock = "strict", facts })`; `writeStudio(home, { checkout, node, lock = "strict", facts })` (open also makes the workshop, mode 0700); both strict exactly as today when `lock` is strict
  - `openSettingsOf({ checkout, node, folder, facts }): object`, exported for `lockBroken` (Task 7)
- Produces (`tool/tests/open-world.js`): `openWorld(): { dir, home, root, checkout, node, folder, workshop, uid, port: 47123, facts, cwd }` (a made-up Mac with an apostrophe in the home, an open-lock per-Mac settings file, and her folder written open); `psText(rows: [pid, ppid, args][]): string`; `chatChain({ claude = 700, args }): string` (node 900 ← zsh 800 ← claude 700 ← launchd 1); `APP_ARGS(folder, home): string`; `RECORD = { flags: ["--output-format","--input-format","--verbose","--model","--effort","--resume","--permission-prompt-tool","--permission-mode","--allow-dangerously-skip-permissions","--allowedTools","--disallowedTools","--settings","--add-dir","--project-config-root","--setting-sources"] }`; `transcript(dir, lines): string`; `openDeps(w, more = {})` = `{ home: w.home, cwd: w.folder, env: {}, ps: () => chatChain({ args: APP_ARGS(w.folder, w.home) }), lsof: () => "", appFlags: RECORD, minimum: null, ...more }`, which every open-lock test gives, so that no real `ps` or `lsof` runs and the runner's own environment is never read.

The open settings (design section 7's outline, made exact; `W` = workshop, `F` = her folder, `R(p)` = `` `Read(/${p}/**)` `` for a folder and `` `Read(/${p})` `` for a file, `E(p)` = `` `Edit(/${p}/**)` ``, each in both spellings):

```
permissions.defaultMode "default", disableBypassPermissionsMode "disable", disableAutoMode "disable"
permissions.allow  [`Bash(${node} "${checkout}/tool/edit.js" *)`, `Edit(/${W}/**)`, …"WebFetch","WebSearch" only when facts.web is "open"]
permissions.deny   [...neverDenyRules(facts.allow), ...R(every readRule), "Read(**/.env)", "Read(**/.env.*)",
                    ...E(F, checkout, BV, Transfer, Work, AS/BRIMM Video, AS/BRIMM Video Words, AS/Claude, home/Library/LaunchAgents, home/.claude, home/.ssh),
                    `Edit(/${W}/**/.claude/**)`, `Edit(/${W}/**/CLAUDE.md)`, `Edit(/${W}/**/CLAUDE.local.md)`, `Edit(/${W}/**/.mcp.json)`]
sandbox            { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false,
                     excludedCommands: [`${node} "${checkout}/tool/edit.js" *`],
                     network: { deniedDomains: ["*"], httpProxyPort: port, socksProxyPort: port },
                     filesystem: { allowWrite: [W], denyWrite: [...both(F), ...both(AS/Claude)], denyRead: [...both(every place's path)], allowRead: readAllowed(...) },
                     credentials: { envVars: ENVIRONMENT.deny.map((name) => ({ name, mode: "deny" })) } }
autoMemoryEnabled false, autoDreamEnabled false, disableSkillShellExecution true, disableAllHooks false
hooks.PreToolUse   [today's guard entry, args [`${checkout}/tool/studio/guard.sh`, node, F]]
hooks.PostToolUse  [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "/bin/sh", args: [`${checkout}/tool/studio/receipt.sh`, node, F] }] }]
```

No `permissions.additionalDirectories`. `CLAUDE-open.md` is written in Task 26; here it holds one placeholder line so the file exists, and Task 26's test pins its words.

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
it("denies Write and Edit in her folder, the checkout, BRIMM Video, the app's data and every place only brimm-video writes, and the workshop's CLAUDE.md, CLAUDE.local.md, .mcp.json and .claude", () => {});
it("takes every listed name of the app's environment from sandboxed commands, the binary's own list among them, and never the chat's id or pid", () => {
  const names = open().sandbox.credentials.envVars;
  for (const n of ["CLAUDE_CODE_MESSAGING_TOKEN","CLAUDE_CODE_MESSAGING_SOCKET","CLAUDE_CODE_USER_EMAIL","CLAUDE_CODE_ACCOUNT_UUID","CLAUDE_CODE_ORGANIZATION_UUID","SSH_AUTH_SOCK","ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_OAUTH_TOKEN","CLAUDE_CODE_OAUTH_REFRESH_TOKEN","CLAUDE_CODE_ARTIFACTS_API_TOKEN","CLAUDE_CODE_MEMORY_API_TOKEN","CLAUDE_CODE_SLACK_TAG_TOKEN","ANTHROPIC_IDENTITY_TOKEN"]) assert.ok(names.some((e) => e.name === n && e.mode === "deny"), n);
  assert.ok(!names.some((e) => ["CLAUDE_CODE_SESSION_ID", "CLAUDE_PID"].includes(e.name)));
});
it("turns Claude Code's memory off, and a skill's shell lines", () => {});
it("has no WebFetch or WebSearch allow rule while the web tools are held, and both once they are opened", () => {});
it("never denies the drawing tools, and denies Monitor and NotebookEdit", () => {});
it("denies the Cron tools and Workflow unless this Mac allows them", () => {});
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
- Produces: `settingsMain(argv, { home, say, clone, now, openMinimum = OPEN_LOCK_CLAUDE, freePort })`; `node settings.js studio --node <node> [--lock strict|open] [--web held|open] [--zoom "<folder>"] [--allow skill|mcp-tool|tool <name>]… [--print]`; `factsOf(home, settings): Facts` (exported; Tasks 10 to 19 use it).

Behaviour: the options given are written into this Mac's settings first (by `writeSettings`, so `settingsFault` refuses a bad one and nothing is written), `--allow` appended to `studioAllow` once; with `lock` open and no `proxyPort`, one is picked once by `freePort()` (default: listen on 127.0.0.1 port 0, read the port, close) and stored. Then the folder is written with `lockOf(settings)`. `--lock open` while `openMinimum` is null says `Not changed: the open lock waits for the checks by hand in the Code tab (the design's "By hand before K1 ships"). Her folder keeps the strict lock.` and ends with 1, writing nothing. `--print` says the `settings.json` her folder would get, as JSON, and writes nothing at all, for the by-hand round's scratch copy; it is allowed with `--lock open` whatever `openMinimum` is. It ends `Written: <folder> (the strict lock)` or `(the open lock)`.

- [ ] **Step 1: Write the failing tests:**

```js
it("writes her folder with the strict lock unless this Mac's settings say open", () => {});
it("refuses the open lock, writing nothing, until the Claude Code it was checked on is named", () => {
  assert.equal(t.asked("studio", "--node", NODE, "--lock", "open"), 1);
  assert.equal(t.said.at(-1), 'Not changed: the open lock waits for the checks by hand in the Code tab (the design\'s "By hand before K1 ships"). Her folder keeps the strict lock.');
  assert.equal(readSettings(t.home).settings.lock, undefined); assert.equal(existsSync(workshopFolder(t.home)), false);
});
it("writes the open lock, the workshop and a proxy port picked once, when the minimum is named", () => {
  // openMinimum "2.1.308", freePort stub → 47123; a second run does not call it again; the folder's settings are studioFiles(open) for factsOf(home, settings)
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
- Produces: `lockBroken(settings, { checkout, folder, lock = "strict", facts }): string[]`. Strict: today's keys. Open: today's `hooks`, `guard`, `bypass`, `auto`, and `"sandbox"` (`settings.sandbox` not deep-equal to the expected), `"permissions"` (`allow` or `deny` not deep-equal, `defaultMode` not "default", or any `additionalDirectories`), `"memory"` (`autoMemoryEnabled` or `autoDreamEnabled` not `false`), `"skill-shell"` (`disableSkillShellExecution` not `true`), `"receipt"` (no PostToolUse entry as written). The expected is `openSettingsOf` with the node the file's own guard args name (R17).

- [ ] **Step 1: Write the failing tests:**

```js
it("finds nothing broken in the open shape it writes, whatever node it names", () => {});
it("names each part of the open shape that is changed", () => {
  for (const [change, key] of [[(s) => { s.sandbox.enabled = false; }, "sandbox"], [(s) => s.sandbox.filesystem.denyRead.pop(), "sandbox"], [(s) => s.sandbox.filesystem.allowRead.push("/Users"), "sandbox"], [(s) => s.sandbox.excludedCommands.push("python3 *"), "sandbox"], [(s) => s.sandbox.credentials.envVars.pop(), "sandbox"], [(s) => { s.sandbox.network.allowUnixSockets = ["/x"]; }, "sandbox"], [(s) => { s.sandbox.network.socksProxyPort = 1; }, "sandbox"], [(s) => s.permissions.deny.splice(s.permissions.deny.findIndex((r) => r.startsWith("Read(")), 1), "permissions"], [(s) => s.permissions.deny.push("mcp__visualize__*"), "permissions"], [(s) => s.permissions.allow.push("WebFetch"), "permissions"], [(s) => { s.permissions.additionalDirectories = ["/x"]; }, "permissions"], [(s) => { s.autoMemoryEnabled = true; }, "memory"], [(s) => { s.disableSkillShellExecution = false; }, "skill-shell"], [(s) => { delete s.hooks.PostToolUse; }, "receipt"]]) {
    const s = open(); change(s); assert.deepEqual(lockBroken(s, { ...where, lock: "open" }), [key]);
  }
});
it("keeps the strict lock's check as it was", () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 7: lockBroken checks her folder's open settings whole"`.

---

### Task 8: The process chain

**Files:**
- Create: `tool/chain.js`, `tool/tests/chain.test.js`

**Interfaces:**
- Produces (`tool/chain.js`):
  - `PS_ARGS = ["-A", "-ww", "-o", "pid=,ppid=,lstart=,args="]`
  - `readProcesses(spawn = spawnSync): string|null` (`/bin/ps` with `PS_ARGS`; null on any error or non-zero exit)
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

**Interfaces:**
- Produces (`tool/loosened.js`): `LOCK_CHANGED`; `lockLoosened({ home, checkout, deps = {} }): string[]` (PR #40's lines, in PR #40's order); `settingsObject(file)`; `sources({ home, deps }): [label: string, settings: object|null][]` (the user settings, then each managed file, managed preferences and the server-managed settings, labelled as PR #40's lines name them).

- [ ] **Step 1: Write the failing test:** `it("is the check behind makes: a settings.local.json in her folder gives PR #40's line, and nothing loosened gives none")`, calling `lockLoosened` from `../loosened.js`.
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Move the code.** Nothing in it changes but its home.
- [ ] **Step 4: Run the whole suite.** `cd tool && node --test`. Expected: every PR #40 test in `tests/edit-show.test.js` passes unchanged.
- [ ] **Step 5: Commit.** `"The open lock, task 9: PR #40's lock check moves to loosened.js, unchanged"`.

---

### Task 10: The open check, I: settings sources and her folder's open shape

**Files:**
- Modify: `tool/loosened.js`
- Create: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `lockBroken` (Task 7), `factsOf` (Task 6), `sources` (Task 9), `openWorld` (Task 5).
- Produces:
  - `lockLoosened` reads this Mac's settings (`deps.settings`, else `readSettings(home)`); on a strict Mac it is as before (R18). On an open Mac it adds, after PR #40's lines, the lines below. `deps` gains `appSettings: object|null` (Task 13 fills it from the app's `--settings`).
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
| Her folder's own settings, `lockBroken` open keys beyond PR #40's | `(Jason: her folder's .claude/settings.json no longer holds the open lock as this brimm-video writes it: ${parts}. Its contents are not shown here.)`, `parts` from `{ sandbox: "the sandbox's settings", permissions: "the allow and deny rules", memory: "memory off", "skill-shell": "skills' shell lines off", receipt: "the card's receipt hook" }`, joined with ", " |

- [ ] **Step 1: Write the failing tests** (each through `behind` on `openWorld()`, git a stand-in, `ps` and `lsof` stand-ins from the helper so no real one runs; `SECRET` in every value):

```js
it("goes on when her folder holds the open lock as written and nothing else loosens it", async () => {});
it("refuses, naming the key and none of its values, for every sandbox key but the few that narrow, in the user, managed and --settings settings", async () => {
  for (const path of ["enabled","filesystem.disabled","allowAppleEvents","excludedCommands","filesystem.allowRead","filesystem.allowWrite","allowUnsandboxedCommands","enableWeakerNetworkIsolation","network.allowedDomains","network.deniedDomains","network.allowUnixSockets","network.allowAllUnixSockets","network.allowLocalBinding","network.allowMachLookup","network.httpProxyPort","network.socksProxyPort","aKeyALaterVersionAdds"])
    for (const where of ["user", "managed", "app"]) { /* r.text starts LOCK_CHANGED, holds the exact line, not SECRET; r.code 1; git not asked */ }
});
it("goes on for denyRead, denyWrite and envVars deny entries in those settings", async () => {});
it("refuses for an envVars entry of another mode, an Edit( allow rule, a WebFetch(domain:…) deny, memory turned on there, and added folders", async () => {});
it("says which part of her folder's own open settings is changed", async () => {});
it("is PR #40's check on a strict Mac, whatever the user settings' sandbox keys say", async () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/behind-open.test.js`.
- [ ] **Step 3: Implement** `sourceWhy` and the open branch.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 10: the lock check reads every settings source's sandbox keys, Edit( rules and memory keys, and her folder's open shape"`.

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
it("refuses for a SessionStart hook in the user, managed or --settings settings, and goes on for her folder's own hooks", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 12: plugins with hooks or a mod, named skills with hooks, and SessionStart hooks loosen the lock"`.

---

### Task 13: The open check, IV: the app's flags, folders added mid-chat, the version, and an untrusted folder

**Files:**
- Modify: `tool/loosened.js`, `tool/edit.js` (`behind` says `UNTRUSTED` and goes on)
- Test: `tool/tests/behind-open.test.js`

**Interfaces:**
- Consumes: `readProcesses`, `processTable`, `chainUp`, `claudeAbove`, `argsOf`, `appVersionOf` (Task 8); `APP_FLAGS`, `OPEN_LOCK_CLAUDE` (Task 5); `claudeDirName` (Task 3).
- Produces: `deps.ps(): string|null` (default `readProcesses`), `deps.pid` (default `process.pid`), `deps.transcript` (default `~/.claude/projects/<claudeDirName(folder)>/<CLAUDE_CODE_SESSION_ID>.jsonl` when that id is set), `deps.appFlags` (default `APP_FLAGS`), `deps.minimum` (default `OPEN_LOCK_CLAUDE`); `appWhy({ claude: Proc|null, folder, home, record, minimum }): { lines: string[], settings: object|null }`; `addedWhy(transcriptPath, home): string[]`; `UNTRUSTED`; `trustWhy({ home, folder }): string` (from `~/.claude.json`'s `projects[<path>].hasTrustDialogAccepted === true`, for her folder or any folder above it).

| Reason | Line |
|---|---|
| ps gives null | `(Jason: this chat's processes could not be read, so the Claude app's flags on it are not known.)` |
| No `claude` above | none (Jason's own run) |
| A flag not in `record.flags` | `(Jason: the Claude app started this chat with ${name}, which is not among the flags recorded for her chats.)` |
| `--project-config-root` other than her folder's real path | `(Jason: the Claude app reads this chat's project settings from another folder (--project-config-root).)` |
| `--setting-sources` other than `user,project,local` | `(Jason: the Claude app starts this chat with other setting sources (--setting-sources).)` |
| An `--allowedTools` entry (split at commas and spaces) not starting `mcp__` | `(Jason: the Claude app allows this chat a rule that is not a connector's tool (--allowedTools).)` |
| `--settings` not readable as JSON (text starting `{`, otherwise a file) | `(Jason: the Claude app's --settings for this chat could not be read.)`; readable: `sourceWhy("the Claude app's --settings for this chat", …)` and the SessionStart line |
| An `--add-dir` other than one folder directly in `<home>/Library/Application Support/Claude/side-session-notes`, by its real path, not a link | `(Jason: this chat has a folder added to it by the Claude app (--add-dir), which its commands could write and whose skills it would load.)` |
| The transcript's latest line with `attachment.type === "environment"` lists an `additionalWorkingDirectories` entry other than the notes folder | `(Jason: a folder was added to this chat while it ran (/add-dir, or "add this folder" on a card), which its commands could write and whose skills it would load.)` |
| `appVersionOf(exe)` below `minimum` (no line while `minimum` is null) | `(Jason: this chat runs Claude Code ${v}, older than the ${minimum} her folder's open lock was checked on.)` |

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
it("refuses for a Claude Code older than the one the open lock was checked on", async () => {});
it("says nothing of the app's flags for Jason's own run, with no claude above it", async () => {});
it("refuses when the processes cannot be read", async () => {});
it("says the folder is not trusted yet, from ~/.claude.json, and still goes on; a parent folder's trust counts", async () => {
  // r.code 0; r.text includes UNTRUSTED once, not LOCK_CHANGED
});
it("says the entries this Mac adds to her folder's allowlist, and says nothing of the default ones", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** `lockLoosened` gives `appWhy`'s `settings` to Task 10's source check.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 13: the lock check reads the app's flags on this chat, folders added mid-chat and its version; behind says an untrusted folder"`.

---

### Task 14: WebFetch's addresses

**Files:**
- Create: `tool/fetchable.js`, `tool/tests/fetchable.test.js`

**Interfaces:**
- Produces: `LOCAL_ADDRESS = "That address is on this Mac or its network, which this folder never fetches."`; `UNCHECKED_ADDRESS = "That address could not be checked, so it is not fetched."`; `isGlobalUnicast(address: string): boolean`; `async fetchWhy(url: string, resolve: (host: string) => Promise<string[]>): Promise<string>` ("" when it may be fetched).

Rules: the host is `new URL(url).hostname` (WHATWG parsing turns `2130706433`, `0x7f.1` and `017700000001` into `127.0.0.1`); a URL that does not parse is `UNCHECKED_ADDRESS`. Refused with `LOCAL_ADDRESS`: an IP literal that is not global unicast; `localhost`; a name with no dot; a name under `.local`, `.localhost`, `.internal` or `.home.arpa`; a name whose look-up, or its `www.` form's (added or taken away), gives any address that is not global unicast. A look-up that fails is `UNCHECKED_ADDRESS`. Not global unicast: IPv4 `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`; IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, and anything outside `2000::/3`; an IPv4-mapped `::ffff:a.b.c.d` and a NAT64 `64:ff9b::/96` answer are unwrapped first.

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

**Interfaces:**
- Consumes: `processTable`, `chainUp`, `claudeAbove` (Task 8).
- Produces (`tool/held.js`):
  - `HELD_REFUSED` (Global Constraints); `heldFolder(home)` = `AS/BRIMM Video/held`; `wordsFolder(home)` = `AS/BRIMM Video Words`
  - `markChat({ home, env, table, pid, now }): { tied: boolean }`: writes `held/mark-<ms>-<6 hex>.json`, `wx`, `{ at, session: env.CLAUDE_CODE_SESSION_ID || null, claude: { pid, start } | null, tied }`; `tied` when the session is set, a claude is found above `pid`, and `String(claude.pid) === env.CLAUDE_PID`. Throws when it cannot write.
  - `noteAfterAll({ home, id, at }): void` (adds `id` once to `held/after-all.json`, written whole by temporary name and rename) and `afterAllTimes(home): Map<string, string>`
  - `chatHeld({ home, sessionId, transcriptPath, claude, now }): boolean`: held when a mark's `session` is `sessionId`; or a mark's `claude` (pid and start) is `claude`; or an untied mark's, or a session after all's, time is at or after the transcript's start (R27); or the transcript holds a `uuid` from `held/<id>.uuids.json` of a held chat (a fork). When it first holds a chat it writes `held/<sessionId>.uuids.json` with the `uuid`s of its transcript so far. A marks folder that cannot be read, or a transcript that cannot be read while any mark or after-all time exists, holds it. The scan keeps `held/scan-<sessionId>.json` (`{ size, offset }`) and reads only bytes past `offset`, up to the last complete line.
  - `writeWords({ home, sessionId, label, what, text, now }): string`: `<words>/<sessionId>/` made mode 0700; the file `${safeName(label)} ${what} ${YYYY-MM-DD HHMMSS}.txt`, `wx`, mode 0600; a name taken gets ` 2`, ` 3`…; gives the path
  - `safeName(text): string` (`/`, `:`, `\`, control letters each become a space; leading dots and spaces dropped; at most 80 letters; empty becomes `video`)
  - `clearOldWords(home, now): void` (files older than 24 hours; then empty chat folders)

- [ ] **Step 1: Write the failing tests:**

```js
it("writes a mark with the chat's id and its claude process, tied when CLAUDE_PID is that process", () => {});
it("writes an untied mark when CLAUDE_PID is not the claude above, or the id is missing", () => {});
it("holds a chat by its id, by its claude process, and every chat begun before an untied mark", () => {});
it("holds every chat begun before a session after all", () => {});
it("holds a resumed chat, which keeps its id, and a fork, whose transcript holds a held chat's message uuids", () => {});
it("holds a fork made before the teaching too", () => {});
it("holds the chat when the marks cannot be read, or its transcript cannot be read while marks exist; and lets one go when there are none", () => {});
it("reads only what a transcript added since the last look, and skips a line still being written", () => {
  // a 2 MB transcript; the scan file's offset after the first look; a last line without its newline is not read until it has one
});
it("hands a session's words over in a file of the chat's own, wx and mode 600, never over another", () => {});
it("names the words file safely whatever the label holds", () => {
  for (const label of ["Sallie's / Q&A: \u0000 call", "..hidden", "", "  "]) { const p = writeWords({ ...w, sessionId: "s-1", label, what: "principles", text: "x", now }); assert.equal(dirname(p), join(wordsFolder(w.home), "s-1")); assert.ok(!basename(p).startsWith(".")); }
});
it("takes away a chat's words files a day old, and keeps newer ones", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/held.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 15: marks, sessions after all, held chats and their forks, and the words files"`.

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

Steps covered here (design section 6, "in order"): 3 (never → deny `NEVER_REFUSED`), 6 (Skill: allow when `allow` holds `skill` of that name, else `NOT_NAMED`), 7 (an MCP tool: allow only for an `mcp-tool` entry of that exact name, `isConnector`, not `neverCaught`; else `NOT_NAMED`), 8 (the subagent tool as `Agent` or `Task` with none of the never limits; `PushNotification`, the drawing tools by their `tool` entries; `SendUserFile`; WebSearch and WebFetch: `WEB_HELD` while `web` is held, then WebSearch allowed and WebFetch by `fetchWhy`), 9 (`AskUserQuestion`, `TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `ToolSearch`: pass), 10 (anything else, `Monitor` among them: deny `NOT_NAMED`). Steps 1, 2, 4 and 5 come in Tasks 17 to 19; until then they fall to step 10.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses every never entry, fed the Code tab's real tool list", async () => {});
it("leaves the card, the task list and ToolSearch to Claude Code; the subagent tool named Task is not among them", async () => {});
it("refuses Monitor and a tool it does not know", async () => {});
it("allows a named skill and refuses another", async () => { /* brimm-edit, frontend-design allowed; canva-creator NOT_NAMED */ });
it("allows a connector's tool only when this Mac names it exactly, and never a local extension's or a posting one", async () => {});
it("allows the subagent tool as Agent and as Task with no isolation, no cwd and a built-in agent, and refuses it otherwise", async () => {});
it("refuses WebFetch and WebSearch while the web tools are held", async () => {});
it("allows WebSearch and a public WebFetch once the web tools are opened, and refuses a numeric or local one", async () => {});
it("allows the drawing tools and PushNotification by the default allowlist", async () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/guard-open.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 16: the open guard's never list, named skills and tools, subagents and the web tools"`.

---

### Task 17: The open guard, II: paths and writes

**Files:**
- Modify: `tool/open-lock.js`
- Test: `tool/tests/guard-open.test.js`

**Interfaces:**
- Consumes: `gatedIndex`, `pathsIn`, `searchRoot` (Task 4); `wordsFolder` (Task 15); `skillFolders` (Task 12); `workshopFolder` (Task 5).
- Produces: step 4 of `openDecision`, before steps 5 to 10. `GATED_REFUSED = "That is one of the places only brimm-video reads or writes. Ask for it through brimm-video, or ask Jason."`; `WRITE_REFUSED = "Claude writes files here only in the workshop, ~/BRIMM Video Workshop, and never a CLAUDE.md, a .mcp.json or a .claude folder."`

Rules: every path `pathsIn(tool_input, input.cwd || folder, home)` gives is looked up with `ctx.index.at`; a path in a gated place is refused (`GATED_REFUSED`) unless it is a Read inside one of this call's carve-outs, by identity: `<dirname(transcript_path)>/<session_id>/tool-results`, `<tmp>/claude-<uid>/<basename(dirname(transcript_path))>/<session_id>/tasks`, `<words>/<session_id>`, and each allowed skill's `skillFolders`. For Glob and Grep (kept for a later version), `searchRoot` in a gated place or holding one is refused. Write and Edit: `file_path` must be inside the workshop, by identity of its nearest folder that is there, with no `.claude` component and a name other than `CLAUDE.md`, `CLAUDE.local.md` and `.mcp.json` in any letter case; otherwise `WRITE_REFUSED`. Then Read, Write, Edit (and Glob, Grep) are allowed.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses every gated place for Read, Write, Edit and SendUserFile: by .., by a link into it and out of it, and by a path in a field it did not know of", async () => {});
it("refuses them by /System/Volumes/Data and by changed letter case", { skip: notAMac }, async () => {});
it("allows Read anywhere else: her documents, Assets, the checkout's code", async () => {});
it("allows Read of the chat's own tool-results, tasks and words folders and the named skills' folders, and refuses another chat's", async () => {});
it("allows Write and Edit only inside the workshop, and never a CLAUDE.md, CLAUDE.local.md, .mcp.json or anything in a .claude folder there", async () => {});
it("refuses a write through a link from the workshop into her folder", async () => {});
it("refuses, for a later Claude Code, a Glob or Grep whose folder is in a gated place or holds one, a Glob's absolute or ~/ pattern with no path among them", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 17: the open guard compares every path by what it is, and writes only in the workshop"`.

---

### Task 18: The open guard, III: Bash

**Files:**
- Modify: `tool/open-lock.js`, `tool/studio.js` (export `WORD` and `literally`)
- Test: `tool/tests/guard-open.test.js`

**Interfaces:**
- Consumes: `WORD`, `literally` (`tool/studio.js`), `ctx.index` (Task 4).
- Produces: step 5 of `openDecision`. `RUN_ALONE = "Run brimm-video's commands on their own, exactly as her skill says, and not in the background."`

Rules, in order: `dangerouslyDisableSandbox` was refused at step 3. The one spelling is `^${literally(node)} "${literally(checkout)}/tool/edit\.js"(?: ${WORD})+$` (at least one word; no bare `node`; nothing before it). A command matching it is allowed, unless `run_in_background` is truthy and its words are not exactly `guide <WORD> tell` (R6). A command that does not match it but holds `edit.js` or `${checkout}/tool` anywhere is refused with `RUN_ALONE`. A command any of whose words (split at white space, quotes taken off) `ctx.index.at` finds in a gated place is refused with `GATED_REFUSED`, as a courtesy. Any other command is allowed: it runs in the sandbox.

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
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit.** `"The open lock, task 18: the open guard lets edit.js through in one spelling only, and any other command into the sandbox"`.

---

### Task 19: The open guard, IV: falling back to today's, and the hook

**Files:**
- Modify: `tool/open-lock.js`, `tool/studio/guard.mjs`
- Test: `tool/tests/guard-open.test.js`, `tool/tests/studio.test.js` (today's end-to-end hook tests stay as they are)

**Interfaces:**
- Consumes: `guardDecision` (today's), `lockLoosened`, `LOCK_CHANGED` (Tasks 9 to 13), `chatHeld`, `HELD_REFUSED` (Task 15), `factsOf`, `readSettings`, `lockOf` (Tasks 2, 6), `gatedPlaces`, `readAllowed`, `gatedIndex`.
- Produces:
  - Steps 1 and 2 of `openDecision`: with `ctx.loosened`, the answer is `guardDecision(input, …)`, its deny reason `LOCK_CHANGED`. With `ctx.held`, it is `guardDecision`'s too, but a Read inside `<words>/<session_id>` passes, an `edit.js` command whose first word is `picture` is refused, and the deny reason is `HELD_REFUSED`.
  - `async guardAnswer(input, { checkout, node, folder, env = process.env, ps = readProcesses, lsof, resolve = dns lookup (all), now = Date.now }): Promise<{ decision, reason }>`: home is `dirname(folder)` (R25); this Mac's settings are read from that home; strict (or unreadable) → `guardDecision`; open → `lockLoosened` (with `deps.cwd = input.cwd`, `deps.transcript = input.transcript_path`, `deps.pid = process.pid`), `chatHeld` (with the claude above the guard), then `openDecision`. A call with no `cwd`, no `session_id` or no `transcript_path`, or a `tool_input` that is not an object, is loosened.
  - The cache: `AS/BRIMM Video/lock-cache.json`, `{ signature, lines, at }`; `signature` is the (size, mtimeMs, ino) of every file the check read, the claude's pid and start, and the sorted environment names; the lsof and workshop looks are made again at most every 60 and 30 seconds. Written by temporary name and rename; a cache that cannot be read or is not JSON is ignored.
  - `guard.mjs`: `guardAnswer(JSON.parse(stdin), { checkout, node: argv[2], folder: argv[3] })`; any throw is the deny "brimm-video's guard could not check this. Ask Jason." as today.

- [ ] **Step 1: Write the failing tests:**

```js
it("answers as today's guard does, saying the lock is changed, while anything loosens the lock", async () => {
  // open world + settings.local.json; and again with a user sandbox key; an unlisted secret name; a plugin with hooks:
  // Bash `date` → { deny, LOCK_CHANGED }; EDIT episodes → allow
});
it("answers as today's guard does in a chat that holds a session's words, letting it read its own words and refusing picture make", async () => {});
it("decides a subagent's call, with its chat's session id and an agent_id, as its chat's own", async () => {});
it("keeps to today's guard on a strict Mac, and on a Mac whose settings cannot be read", async () => {});
it("takes the home folder from her folder, never from HOME", async () => {});
it("falls back to today's guard for a call with no session id, transcript or folder, or a tool_input that is not an object", async () => {});
it("reuses the lock check while nothing it read has changed, and looks again when a file changes", async () => {});
it("ignores a cache another call is writing, or one that is not JSON", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Today's end-to-end hook tests in `tests/studio.test.js` give `/Users/sallie/BRIMM Video Studio`, whose home has no settings: they stay strict and pass unchanged.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 19: the guard falls back to today's lock when loosened or held, and the hook runs the open guard on an open-lock Mac"`.

---

### Task 20: `edit.js`'s own sandbox check, and the app's environment

**Files:**
- Create: `tool/sandboxed.js`, `tool/tests/sandboxed.test.js`
- Modify: `tool/edit.js` (its entry, the `if (process.argv[1] …)` block)

**Interfaces:**
- Produces: `SANDBOXED`; `sandboxedWhy({ env, ppid, spawn }): string`: `SANDBOXED` when `env.SANDBOX_RUNTIME === "1"`, or `spawn("/bin/ps", ["-o", "ppid=", "-p", String(ppid)], { encoding: "utf8", timeout: 5000 })` has an `error` (any code, `EPERM` among them), a `status` other than 0, or `stdout` not matching `/^\s*\d+\s*$/`; else "".
- The entry: `sandboxedWhy({ env: process.env, ppid: process.ppid, spawn: spawnSync })` first; when it says so, that line is printed, the exit code is 1, and nothing else runs.

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses under SANDBOX_RUNTIME=1 without asking ps", () => {});
it("refuses with the variable unset when ps cannot be started (EPERM), exits non-zero, or prints nothing", () => {});
it("goes on when ps prints a process id and the variable is unset", () => {});
it("is checked at edit.js's entry before anything else runs", () => {
  const entry = readFileSync(new URL("../edit.js", import.meta.url), "utf8").split("if (process.argv[1]").at(-1);
  assert.ok(entry.indexOf("sandboxedWhy(") >= 0 && entry.indexOf("sandboxedWhy(") < entry.indexOf("editMain("));
});
it("prints and logs no value of a listed variable of the app's environment", async () => {
  // deps.env with every ENVIRONMENT.deny name set to "VALUE-<name>"; run episodes, behind (open world, stand-ins), show and kind refusals;
  // no said line and no line of the tool's log holds "VALUE-"
});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/sandboxed.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 20: edit.js refuses inside Claude Code's sandbox, by SANDBOX_RUNTIME or a ps that cannot start"`.

---

### Task 21: A session's words, by file

**Files:**
- Modify: `tool/edit.js` (`findEpisode`, `editMain`, `kindCommand`'s session-after-all branch)
- Create: `tool/tests/edit-words.test.js`

**Interfaces:**
- Consumes: `markChat`, `writeWords`, `clearOldWords`, `noteAfterAll`, `afterAllTimes` (Task 15); `processTable`, `readProcesses` (Task 8); `lockOf`; `studioFolder`.
- Produces:
  - `deps.env` (default `process.env`), `deps.ps` (default `readProcesses`), `deps.pid` (default `process.pid`) on ctx.
  - In `findEpisode`, once the gate lets the command run: when the command is one of R8's, not detached, and a record found is a session not cleared, and `env.CLAUDECODE === "1"` and her folder exists, the chat is marked (R7). A mark that cannot be written ends the command with `MARK_FAILED = "This chat could not be marked as holding a session's words, so they are not shown here: ask Jason."` (1). Then, on an open-lock Mac only, `ctx.say` collects every later line instead of printing it (no `CLAUDE_CODE_SESSION_ID` ends it with `MARK_FAILED` too).
  - At the end of `editMain`, collected lines are written by `writeWords` (`what` is the command's name) and the chat is told one line, `wordsLine(label, path)` = `` `${label}: a session's words are in a file for this chat alone: ${path}` ``.
  - `editMain` runs `clearOldWords` at each command under Claude Code.
  - A session after all (R9): `kindCommand`, when `stored === "session"` and the record was answered before as another kind, calls `noteAfterAll({ home, id, at })`; `findEpisode`, on reading a record with `session.emptyRevision` set whose id `afterAllTimes` lacks, calls it with now.
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
it("refuses, showing nothing, when the chat cannot be marked or has no id", async () => {});
it("prints an ordinary video's words as today, and marks nothing", async () => {});
it("leaves a detached run (--now) and the reading's own run unmarked", async () => {});
it("takes away this chat's words files a day old at its next command", async () => {});
it("notes a session after all when kind answers an answered video as a session, and when this Mac first reads one the other Mac answered", async () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/edit-words.test.js`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 21: a session's words go to a file only that chat may read, after the chat is marked; sessions after all are noted"`.

---

### Task 22: The card's wording, in code

**Files:**
- Create: `tool/receipts.js`, `tool/tests/receipts.test.js`
- Modify: `tool/edit.js` (`cardLines`; the line after `ASK_IF_SESSION`)

**Interfaces:**
- Produces (`tool/receipts.js`):
  - `WHAT_Q = (label) => \`What is ${label}?\``; `PRIVATE_Q = "Is it a private session with a client or a group?"`
  - `cardOf({ label, guess: "finished"|"raw"|"clip"|null, maybe: null | { session: true } | { name, kind } }): { questions: { question, options: { label }[] }[] }`: the first question's options as `tool/studio/SKILL.md:21-28` orders them (a Maybe line wins over a Guess line); the second's `Yes`, `No`
  - `notSessionCardOf({ label, came: "zoom"|"sound"|null })`: one question (R10's words), options `It is a client or group session`, `It is not a session`
  - `formOf(questions): { label, form: "what"|"not-a-session" } | null`: the label that makes `questions` (texts and option labels, in order) equal one of the forms above, for some guess, Maybe and came
- `cardLines` adds `` `    Card: ${JSON.stringify(cardOf(…))}` `` last, and `` `    Card if not a session: ${JSON.stringify(notSessionCardOf(…))}` `` when `answer.came` is `zoom` or `sound`; `kind` prints the second form after `ASK_IF_SESSION`, with `came: null` when it does not know.

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
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** The Maybe forms read `shownName` of the matched video (R28) and its kind from `KIND_SAID`: an iPhone clip's or a finished video's is "A new version of", a raw one's "A finished version of".
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 22: the card's wording moves into code, and episodes prints the exact card"`.

---

### Task 23: The card's receipt

**Files:**
- Create: `tool/studio/receipt.sh` (mode 755), `tool/studio/receipt.mjs`
- Modify: `tool/receipts.js`, `tool/edit.js` (`kindCommand`)
- Test: `tool/tests/receipts.test.js`, `tool/tests/fixtures/ask-user-question-result.json` (new)

**Interfaces:**
- Consumes: `cardOf`, `notSessionCardOf`, `formOf` (Task 22); `lockOf`.
- Produces:
  - `receiptsFolder(home)` = `AS/BRIMM Video/receipts`; `receiptFrom(input, now): Receipt|null`, `Receipt = { at, label, form, answers: { [question]: answer } }`: only for `hook_event_name` PostToolUse and `tool_name` AskUserQuestion; none when `tool_response.afkTimeoutMs` or `tool_response.followUp` is present, when `formOf(tool_response.questions)` is null, or when any question's answer in `tool_response.answers` is missing or not one of its options. `tool_input` is never read.
  - `writeReceipt(home, receipt)`: `receipt-<ms>-<6 hex>.json`, `wx`.
  - `expectedAnswers({ label, stored, maybeName, maybeKind, notASession }): { form, answers }[]`
  - `receiptWhy({ home, expected, now }): string`: "" when, for each expected form, a receipt of the last hour has that label, that form and those very answers; else `NO_RECEIPT = "Ask her on the card first: only her answer on it answers a video waiting for her answer."`
  - `receipt.sh`: `"$1" "$(dirname "$0")/receipt.mjs" "$2" || exit 0`; `receipt.mjs` reads the hook's input, home = `dirname(argv[2])` (R25), writes the receipt if any, prints nothing.
  - `kindCommand`: under `CLAUDECODE=1` on an open-lock Mac, for a video waiting for her answer (no kind, `answer.state` "needs your answer"), refuses with `NO_RECEIPT` unless `receiptWhy` is "". `--not-a-session` needs the not-a-session receipt as well.
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
it("needs no receipt in Terminal, on a strict-lock Mac, or for a video already answered", async () => {});
```

- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 23: the card's receipt, and kind answers a waiting video only with her click"`.

---

### Task 24: Copies and reveals by id

**Files:**
- Create: `tool/reveal.js`, `tool/tests/reveal.test.js`
- Modify: `tool/edit.js` (`showCopy`, `whichCommand`, `clearShown`, `showInFinder`'s callers at the withdrawal, `emptyRevisionAgain` and `showForStep`), `tool/finish.js` (its three `open -R`)

**Interfaces:**
- Consumes: `lockOf`; `workFolder`; `cloneWhole` (as `which` uses it).
- Produces (`tool/reveal.js`):
  - `cantOpen(label)` (Global Constraints' words)
  - `shownByIdFolder(home, id)` = `join(workFolder(home), "shown", id)`
  - `async revealed({ home, settings, run, record, label, path, clone }): Promise<void>`: strict: `open -R path`, as today. Open: the file is copied (a video by `clone`, anything else with `copyFileSync` and mode 0444) into `shownByIdFolder`, named `${label}.brimm-ops.json` for a hand-off or `${label}${extname(path)}`, listed in that folder's `SHOWN_MARKER`, and that copy is revealed; one that cannot be copied is not revealed, and the caller says `cantOpen(label)`.
- `show` and `which` copy into `shownByIdFolder` on an open-lock Mac (R12). `which`, on an open-lock Mac, for a gated record (gate.js `gated`, or held as a session) it cannot copy, refuses with `cantOpen(name)` and opens nothing; for an answered ordinary video it opens the original as today. `clearShown` clears `BRIMM Video Work/shown/*` as well.

- [ ] **Step 1: Write the failing tests:**

```js
it("opens show's and which's copies from a folder named by the video's id on an open-lock Mac, and from the episode's own on a strict one", async () => {});
it("reveals a copy of the hand-off, named by its label, never a path in the episode's folder, for guide show, a session after all's withdrawal and finish", async () => {});
it("reveals a copy of the video to post too", async () => {});
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

- [ ] **Step 1: Write the test:**

```js
const HARD_LINK = [/(?<![Ss]ym)linkSync\s*\(/, /(?<![\w.])link\s*\(/, /["']\/bin\/ln["']/, /["']ln["']\s*,/, /\bln\s+(?!-s)/, /["']-l["']/, /\bcp\s+-l\b/];
it("knows a hard link when it sees one, and not a symbolic one or a clone", () => {
  for (const line of ['linkSync(a, b)', 'fs.link(a, b, cb)', 'spawnSync("/bin/ln", [a, b])', 'run("ln", [a, b])', 'cp -l a b', 'spawnSync("/bin/cp", ["-l", a, b])']) assert.ok(HARD_LINK.some((r) => r.test(line)), line);
  for (const line of ['symlinkSync(a, b)', 'spawnSync("/bin/cp", ["-c", a, b])', 'ln -s a b']) assert.ok(!HARD_LINK.some((r) => r.test(line)), line);
});
it("makes no hard link anywhere in tool/, its scripts included", () => {
  // every .js, .mjs and .sh under tool/ but tests/: no line matches HARD_LINK
});
```

- [ ] **Step 2: Run it.** `cd tool && node --test tests/no-hard-link.test.js`. Expected: PASS at once if brimm-video makes none (it should: the design checked); a failure names the file and line, which is then changed to a clone.
- [ ] **Step 3: Commit.** `"The open lock, task 25: a test that brimm-video never hard-links a file"`.

---

### Task 26: Her folder's `CLAUDE.md` and skill

**Files:**
- Modify: `tool/studio/CLAUDE-open.md`, `tool/studio/SKILL.md`
- Test: `tool/tests/studio.test.js`

**Interfaces:**
- Consumes: `wordsLine` (Task 21), `HELD_REFUSED`, `UNTRUSTED`, `NO_RECEIPT`, the `Card:` lines (Task 22).

`CLAUDE-open.md`, in her words: this folder edits The BRIMM's videos with brimm-video (the brimm-edit skill), and Claude may also help with anything else: graphics, research, writing, other programs. The BRIMM Video folders, the episodes and the code are read and changed only through brimm-video's commands. Nothing here posts, sends or publishes anything; the finished videos are posted by hand. Files Claude makes go in the workshop, `~/BRIMM Video Workshop`; heredocs do not work here, so a file is written with Write, in the workshop. A session's or a client's words never go into a web search, a picture's description, a drawing or the workshop; a chat that has a session's teachings is for brimm-video only. Speak to Sallie in plain words; never show her command names, paths or flags. Today's line on never rating, reporting or sharing a chat about a session. For anything the folder refuses, say so plainly and suggest she asks Jason.

Her skill (one template for both locks): the card section's option lists (lines 21 to 29 today) give way to: "`episodes` prints, under each video waiting for her answer, a line `Card: {…}`. Ask it with one `AskUserQuestion` exactly as that line gives it: its questions and answers, in that order, word for word. Never word a card yourself. When it also prints `Card if not a session: {…}`, and she answered anything but "Client or group session", ask that card next, as given; `kind` prints one after it says to ask first, too. If `kind` says to ask her on the card first, ask it, and run `kind` again only with her answers." The table mapping answers to `kind` stays. At the start: "If `behind` says Claude Code has not trusted this folder yet, tell her: "Open this folder again in the Claude app and choose to trust it, then start a new chat."" In "A client or group session": "When brimm-video says a session's words are in a file for this chat alone, read that file with Read and show it exactly as written. Then tell her: "This chat now runs brimm-video only; start a new chat for anything else." If a refusal says "This chat holds a session's words", say that to her in plain words." The skill names no `picture` command (K2, K3).

- [ ] **Step 1: Write the failing tests:**

```js
it("keeps the skill under 160 lines, running only commands edit.js has", () => {});
it("has the skill ask the card exactly as episodes prints it, and never word one itself", () => {
  assert.ok(skill.includes("`Card: {…}`") && skill.includes("Never word a card yourself"));
  assert.ok(!skill.includes('"Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"'));
});
it("has the skill read a session's words from the file brimm-video names, show them as written, and send her to a new chat for anything else", () => {});
it("has the skill tell her when the folder is not trusted yet, and when a chat holds a session's words", () => {});
it("tells Claude in the open lock's CLAUDE.md what it may help with, where it writes, and what never leaves the chat", () => {
  const md = studioFiles({ ...where, lock: "open", facts })["CLAUDE.md"];
  for (const words of ["~/BRIMM Video Workshop", "heredoc", "posted by hand", "Never rate, report or share a chat about a session", "a chat that has a session's teachings is for brimm-video only"]) assert.ok(md.includes(words), words);
  assert.ok(!md.includes("do not run any other program"));
});
it("keeps the strict lock's CLAUDE.md as it is", () => {});
```

- [ ] **Step 2: Run them to see them fail.** `cd tool && node --test tests/studio.test.js`.
- [ ] **Step 3: Write the texts.** Keep every line today's tests read (the Guess and Maybe rows of the `kind` table, the dialogs, the guide).
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
- For an open lock: `  The workshop, where Claude writes:  ~/BRIMM Video Workshop`; `  Kept from Claude in her folder:  BRIMM Video (all but Assets), BRIMM VIDEO Transfer, Zoom's recordings (<zoom folder>), Final Cut's backups, BRIMM Video Work, brimm-video's own settings, Claude's and the Claude app's own files, Dropbox's own files, brimm-video's logs, and the folders that hold secrets`; `  The web tools:  held (until node tool/settings.js studio --web open, on Jason's yes)` or `open`; `  Her folder's proxy port:  <port>, which nothing on this Mac may listen on` (or `picked when her folder is written`).
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
- [ ] **Step 3: Implement.** The real run's line stays `"$node" "$HERE/settings.js" studio --node "$node"` (the lock comes from this Mac's settings), then, with `--user-deny`, `"$node" "$HERE/settings.js" user-deny`.
- [ ] **Step 4: Run them, then the suite.**
- [ ] **Step 5: Commit.** `"The open lock, task 27: the installer says which lock this Mac gets, waits for the open lock's Claude Code, and adds her user settings' deny rules only with --user-deny"`.

---

### Task 28: The setup guide, the README and the requirements

**Files:**
- Modify: `docs/setup/sallies-laptop.md`, `README.md`, `docs/requirements.md`
- Test: `tool/tests/install.test.js`

Content:
- **Step 9** becomes two: "9. Check that her Claude folder only runs BRIMM Video" (today's text, for while her laptop has the strict lock) and "9b. Check her Claude folder's open lock" (design section 7's list, in the same voice: trust first and `behind`; each refusal, each "shows nothing", each "works with no card"; with a made-up `Episodes/0000 Lock check (test)/` folder holding one line of made-up words, removed afterwards; each check put as a named owner's check or a script to run).
- **New steps for Jason alone:** clear Finder's and QuickTime's recent lists once, before the open lock; empty `~/.claude/projects/<her folder>/memory/`; review her claude.ai account's skills and plugins and turn off any with hooks or a mod; install `frontend-design`; `node tool/settings.js studio --node <node> --zoom "<her Zoom folder>"`; then, once `OPEN_LOCK_CLAUDE` is set, `--lock open` on his yes, and `--web open` only once K0's checks of the app's environment pass. (The OpenRouter key and `settings.js pictures` are K3's.)
- **For Sallie:** move a Zoom recording into the drop folder rather than copy it, and delete Zoom's original; never add a folder to her session from the app, nor choose "add this folder" on a card; never choose "No sandbox" in `/sandbox`; never turn memory on in `/memory`.
- **"If something goes wrong"** gains one line per new `behind` reason (Tasks 10 to 13), keeps "choose the one-time Yes only".
- **README:** the `tool/studio.js` row and "On Sallie's laptop" describe the two locks; the `behind` row its new checks and the untrusted line; `which`, `show`, `guide … show` and `finish` reveal copies by id on an open-lock Mac; rows for the new files.
- **`docs/requirements.md` (R23):** a heading "Jason's decisions of 2026-10-25" with his words verbatim (design, "What this rests on"); the lock bullet keeps its 22 Oct facts and gains "On her laptop it is open but for a fixed never list (2026-10-25): Claude may help with graphics, other programs and named design skills, and with the web once a check in the Code tab shows the app's secrets stay out of her commands. Kept locked: the code and the episode records change only through brimm-video; a session's words never come into her chat but as its approved teachings, and a chat that has them runs brimm-video only; nothing is posted or published. OpusClip's posting tools stay denied."; a line under "Decisions" naming the design; a change line for 2026-10-26.

- [ ] **Step 1: Write the failing tests:**

```js
it("names the lock-down checks by titles that are steps of the setup guide, for both locks", () => {});
it("has the setup guide's open-lock check name every refusal, every hidden name and every card-free step the design lists", () => {
  const step = guide.split("\n").find((l) => l.startsWith("9b. **"));
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
- [ ] **Step 2: Check strict is unchanged.** `git diff origin/main -- tool/studio/CLAUDE.md tool/studio/guard.sh` shows nothing; the strict tests of `tests/studio.test.js` and PR #40's of `tests/edit-show.test.js` pass unchanged (`git diff origin/main -- tool/tests/edit-show.test.js` shows only additions, if any).
- [ ] **Step 3: Print the installer once.** `cd tool && ./install.sh --print --machine "Sallie's laptop" --drop Drop --import light --handoff 2 "<a scratch BRIMM Video>"` on the Mac Studio: it says the strict lock, and that the open lock waits for the checks by hand. Nothing is written.
