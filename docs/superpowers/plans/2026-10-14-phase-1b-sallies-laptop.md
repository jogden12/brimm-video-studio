# Phase 1b: Sallie's laptop. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie's laptop runs the core loop tomorrow morning (drop → import → open in Claude → push → trims by hand → Share and Export XML → finish → hand-off → BRIMM Ops), and the two Macs never fight over an episode.

**Architecture:** Everything builds on main at 40f4969 plus PR 19 (phase 3, part 2), which merges tonight. New work is in `tool/edit.js` (the claim in `open`, `release`, `resolve`, `show`, `behind`, the guard taking the other Mac's answers), `tool/studio.js` and `tool/studio/` (Sallie's folder, its settings, its guard hook and its skill), `tool/settings.js` (a `studio` command), `tool/install.sh` (the laptop's checks and the studio folder), and three documents (the setup guide, CLAUDE.md, the README). No new npm packages.

**If PR 19 has not merged by midnight, build on main (40f4969) instead.** Main's `COMMANDS` are `episodes, open, push, bring, status, retry, name, title, reel, finish, free`; PR 19 adds `reels` and `ask` (and Reel titles). Then: the skill has no rows for `reels`, `ask` or a Reel's title, and its "Not ready yet" list gains "Show me the Reels", "Ask Claude again for Reels" and "Reel 2's title is …" (Task 2's test enforces it); the `--from-plan` claim check (Task 3) goes wherever main's `--from-plan` writes an episode, if it does; everything else is the same.

**Tech Stack:** Node 22+ (ESM, `node:test`), zsh for the installer, Claude Code project settings and a PreToolUse hook.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md` (main 930996a or later). Section 1 "Picking an episode up", section 4 "Where, and what Claude may do" and the guard, section 6, and phase 1b's row.

**Builder:** Builder A, tonight, to finish by about 03:00. **Tasks are in the order to build them, smallest safe slice first.** If time runs short, stop after any task: each leaves main working. The order of value: 1 and 2 (she can install and talk to it), 3 and 4 (the Macs never fight), 5 (reading files), 6 (conflicts). Task 7 (documents) is needed by morning whatever else is done, so do it before 6 if the clock is tight.

## Global Constraints

- The tool drafts. It never posts, sends or publishes anything.
- Never read a `.env` file. The one secret is the deploy key on Sallie's laptop (Task 7), only in her `~/.ssh`, never in the repo or Dropbox.
- Nothing is installed on a Mac, and no launch agent changed, without Jason's yes in chat. The installer is only run with `--print` by a test or by hand.
- Write a failing test first, then the code. Run the whole suite before each commit: `cd tool && node --test` (all pass, 0 fail).
- No test calls the real `claude`, ffmpeg, `open`, `git` or Final Cut. No test writes into Dropbox, `~/Library/Application Support/BRIMM Video`, `~/BRIMM Video Work` or `~/BRIMM Video Studio`: every test uses a temp home and root.
- Every file into Dropbox goes by the rule: made outside, cloned in with `/bin/cp -c` (`dropbox.js` `cloneIn`, `replaceIn`, `textWriter`), never written into or renamed there; the record is a new `record/NNNN.json` per change (`writeEpisode` with `expectRev`).
- Messages a person reads are plain words, as the existing commands write them. Exit codes: 0 done, 1 refused or failed, 2 asked wrongly or not set up.
- Library backups stay on Final Cut's default; nothing tells anyone to change them (spec section 2, the lead's ruling).
- Match the code around it: comments in full plain sentences, the existing helpers (`episodeFor`, `findEpisode`, `save`, `refuse`, `flagsOf`, `textWriter`, `ruleOpts`), and the test helpers (`tests/episodes.js` `setup`, `episodeFor`, `reread`; `tests/edit.test.js` `setup`).

## Rulings (where the spec leaves something open)

1. **The claim is written by `open`**, after the file checks, only when the record's `editing` is not this Mac's already. Then `open` waits `CLAIM_WAIT_MS` (20 000) through `ctx.deps.wait`, reads the record again, and stops if another Mac's claim is there now. The wait is a fixed 20 seconds: there is no way to see Dropbox take the change.
2. **Take-over** is `open "<ep>" --take-over`. `finish` already has `--take` with a value; this is a different word on purpose.
3. **Which commands refuse when another Mac holds the claim:** every command that writes the record or pushes: `name`, `title`, `reel pick|drop`, `push`, `ask`, `finish` (the asking part), `release`, and `unedited.js --from-plan` when it writes an episode (Jason runs it by hand on the Mac Studio; it replaces the rough cut and writes a record). Not `resolve` (a conflict must be sortable any time), not `open` (it offers take-over), not `episodes`, `status`, `show`, `reels`, `retry`, `behind`. An episode with no claim (`editing: null`) may be changed without `open` first, as on the Mac Studio today.
4. **`released` gains `by` and `answers`.** `released = { at, by, files, answers }`. `episodeFault` already ignores unknown fields; `released()` in episode.js gains the two.
5. **Release asks** when this Mac made the highest push of any part, and refuses unless answered: `--no-hand-edits` ("no changes since it was shown") or `--hand-edits-stay` ("the changes stay in this Mac's library"). With the second, the episode is still released; the answer tells the other Mac.
6. **Release checks, then copies, and does not wait long:** each Share and export of the episode in this Mac's `From Final Cut/`, found by the project names recorded at its pushes, is cloned into `edit/from-final-cut/` by the rule. `cp -c` keeps the source's times, but each `.fcpxmld` folder is made new at release, and finish dates a bundle by the later of its folder and its `Info.fcpxml`; so on the other Mac every copied export looks newer than its Share. So **before copying, release applies finish's rule here** (parts.js:129, `exported.mtimeMs < video.mtimeMs`, with a bundle dated as finish's `listing()` dates it): a part whose newest whole Share has no export, or an export older than it, refuses the release with finish's words plus "then hand it over again", and nothing is written. A Share not yet whole (size still changing, or not readable whole) is skipped and named. `.fcpxmld` bundles are cloned file by file. No late check (spec rule 2: record-only commands rely on `written.json`); the copies go into the record's list, so the other Mac's file checks see a missing one.
7. **The guard takes the other Mac's answer** (spec section 4, "Answers carried between Macs"): when a part's last push was made on another Mac and `released.answers` for that part says "no changes" at that version, `pushPart` asks nothing. When it says the changes stay there, or when no answer at that version was carried (a take-over, or a release by a Mac that did not push it), the push refuses and names the Mac. That refusal is lifted only by its own flag, `--without-other-macs-changes` ("go ahead from v<N> as brimm-video made it; whatever was done to it on <Mac> stays there"), never by `--no-hand-edits`, which is her answer about her own Final Cut.
8. **`show`** is built here (spec section 4 needs it: her session reads episode files only through `edit.js`): `show "<ep>" transcript|notes|plan`. The Reels are `reels` (PR 19).
9. **`behind`** is built here, with a 20-second limit (under the Code tab's 2-minute command limit). On her laptop `git fetch` uses the deploy key over SSH (Task 7 sets that up by hand).
10. **Sallie's settings deny with a hook on every tool, not only a mode.** Claude Code's `dontAsk` mode is documented for the CLI only; the desktop Code tab lists Manual, Accept edits, Plan and Auto, and a mode picked in its selector overrides `defaultMode` for that folder (code.claude.com/docs/en/desktop, "Choose a permission mode"). So `.claude/settings.json` sets `defaultMode: "dontAsk"` (where honoured), denies by name the editing and web tools, every MCP tool (`mcp__*`: her connectors and the desktop app's own terminal, folder, mode, browser and computer-use tools) and the tools that run or send elsewhere (Monitor, RemoteTrigger, SendMessage), blocks reads outside the folder, disables bypass and auto modes, and adds a **PreToolUse hook on every tool** that allows only `"<node>" "<checkout>/tool/edit.js"` followed by plain or double-quoted words and the `brimm-edit` skill, leaves reads and Claude's own bookkeeping tools to Claude Code's rules, and denies every other tool (Artifact, Workflow, Agent, other skills, and any tool added later) with a plain reason. If the hook cannot run, it blocks: guard.sh exits 2, and the hook has `"onFailure": "block"` for when guard.sh itself cannot start (Claude Code 2.1.295 or later; the guide's step 9 reads the Code tab's version). Deny rules and hooks work in every mode. Jason checks it in the Code tab on her laptop in the morning (Task 7's guide, step 9).
11. **The checkout path and node's path are written into her files by `settings.js studio`, in node**, because the path has spaces and maybe an apostrophe; her session cannot read `settings.json` in Application Support.
12. **Homebrew is never installed by the installer**: it prints the command, and Sallie runs it in Terminal and types her own password. This departs from spec section 6 item 5 ("Install, by the installer"): running Homebrew's script from inside our installer would hide its questions; the spec is updated to match when this plan is approved. Final Cut, Xcode's command line tools and Claude are checked, not installed.
13. **`check`** is left out tonight; the guide's morning test (a short real recording through the loop) does its job.
14. **The conflict pattern stays as it is** (episode.js:34). The guide's last step makes a conflict on purpose across both Macs (spec phase 1b row) and notes the copy's exact name; if `resolve` does not find it, the pattern changes in one place.
15. **The decisions draft (`docs/superpowers/plans/drafts/decisions-1b.md`) is superseded** where it differs: no commit-ancestry refusal (the spec refuses by layout `version` only), no backup folder, string paths from `conflictedCopies`, the record in `record/NNNN.json`.

## Review Focus

1. Both Macs open the same episode within seconds: both write the same record number, Dropbox keeps one as a conflicted copy, and after the 20-second wait each `open` finds the conflict and stops; when the other Mac's claim is a later record (it took over during the wait), this one stops with the "it is theirs" text. They never both edit (Task 3).
2. Files the other Mac released still syncing when this Mac opens: "still arriving", and no claim written (Task 3).
3. A hand-edited timeline handed over: the other Mac's push is refused when the changes stay there (even with `--no-hand-edits`) or when no answer was carried (a take-over), and goes ahead with no question when they said "no changes" (Task 4).
4. Sallie's session asked to run anything but `edit.js`, to edit a file, or to read outside her folder: refused with no prompt, in any mode (Task 2; the hook's tests, and the morning check).
5. A conflicted copy of the record or of a timeline: `resolve` keeps what she picks, and nothing is deleted before its copy is whole in `history/` (Task 6).

## Files

| File | Task | What |
|---|---|---|
| `tool/install.sh` | 1 | The laptop's checks and steps in `--print`; the studio folder in the install |
| `tool/tests/install.test.js` | 1 | `--print` lines for a laptop; stand-in `claude`, `xcode-select`, Final Cut |
| `tool/studio.js` (new) | 2 | Writes Sallie's folder: `CLAUDE.md`, `.claude/settings.json`, the skill, `Pictures/`; the guard hook's decision |
| `tool/studio/CLAUDE.md`, `tool/studio/SKILL.md`, `tool/studio/guard.mjs` (new) | 2 | The templates, with `{{CHECKOUT}}` and `{{NODE}}` |
| `tool/settings.js` | 2 | `studio` command |
| `tool/tests/studio.test.js` (new) | 2 | The generated files exactly; the hook's decisions |
| `tool/episode.js` | 3, 4 | `released(record, files, { at, by, answers })`; `conflictWhy` says to say "sort out the conflict" |
| `tool/edit.js` | 3–6 | Claim, take-over, the claim check, `release`, the guard's answers, `show`, `behind`, `resolve` |
| `tool/tests/edit-claim.test.js` (new) | 3, 4 | Two Macs on one root |
| `tool/tests/edit-show.test.js` (new) | 5 | `show`, `behind` |
| `tool/tests/edit-resolve.test.js` (new) | 6 | `resolve` |
| `docs/setup/sallies-laptop.md` (new), `CLAUDE.md`, `README.md` | 7 | The guide for Jason, the secret's line, the card |

## Two Macs in one test

Every claim test needs two Macs on one root. Add this helper to `tool/tests/episodes.js` (exported), used by Tasks 3, 4 and 6:

```js
/** The same root seen from another Mac: its own home, and settings naming it, as contextFor takes them. The ctx shares the
    first Mac's stand-ins (clone, clock, wait), so both Macs' writes go through the same rule and the same clock. */
export function otherMac(t, machine = "Sallie's laptop") {
  const home = join(t.dir, `home-${machine.replace(/\W+/g, "-")}`);
  mkdirSync(fromFinalCutFolder(home), { recursive: true });
  return contextFor({ ...t.ctx.deps, home, settings: { version: 1, machine, root: t.root, checkout: "/checkout" } });
}
```

(Import `contextFor` from `../edit.js` there if it is not imported yet.)

---

### Task 1: The installer, for her laptop

**Files:** Modify `tool/install.sh`; Test `tool/tests/install.test.js`.

**Interfaces:** Produces `--print` lines named below; at install, runs `"$node" "$HERE/settings.js" studio` after `settings.js write` (Task 2 makes the command; until then the line is printed only).

What `--print --machine "Sallie's laptop" "<root>"` adds to today's summary, in this order, after the "Swift" line (each a line in the same two-space style):

- `Xcode's command line tools (git, swift):  here already` or `not here. Jason runs: xcode-select --install`
- `Homebrew:  here already` or `not here. In Terminal, Sallie runs this (it asks for her password, which she types herself): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`, and the install stops there with exit 1 until it is there (today's message, kept).
- `macOS:  <version>` from `sw_vers -productVersion`, and when it is below 26.6: `; Final Cut Pro 12.4 needs macOS 26.6 or later (System Settings › General › Software Update)`. (12.4's `LSMinimumSystemVersion` is 26.6; on an older macOS the App Store gives 12.3, which her laptop has tonight.)
- `Final Cut Pro:  <version>, here` (read with `defaults read "/Applications/Final Cut Pro.app/Contents/Info" CFBundleShortVersionString`) or `not here. Install it from the App Store (on her Apple ID, or shared by Family Sharing) before the first push.` A version below 12.4 adds `; phase 0 was checked with 12.4: update macOS first, then App Store › Updates`.
- `Claude Code, signed in:  yes (<subscriptionType>)` from `claude auth status --json` (`loggedIn`, `subscriptionType`), or `no. In Terminal, run: claude auth login (Sallie signs in to her own Claude account in the browser), then run this again.` (Signing in to the Claude app does not sign in the `claude` command.) Never print the email or the org. When `claude` is not found, today's "not here" line stays.
- `Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)`
- `At the end: one real call to Claude from the background job, to prove its sign-in is seen there`
- `By hand afterwards: the setup guide (docs/setup/sallies-laptop.md)`

The installer's header line "meant to be the Mac Studio" (install.sh:2) becomes "for the Mac Studio or Sallie's laptop".

- [ ] **Step 1: Write the failing test.** In `tool/tests/install.test.js`, inside the `--machine` describe (Mac-only, as its neighbours). First extend the helper: `askWith` gains `stubs: { <name>: <script text> }`, each written into its `bin` with mode 755 (for `xcode-select`, `defaults` and `sw_vers`); and `programs` may also hold `[path, scriptText]` pairs under the test home (today it holds paths written as `exit 0`). The `claude` stand-in goes at `.local/bin/claude` (install.sh looks for claude along `AGENT_PATH`, then `~/.local/bin`), and **`askWith`'s `agentPath` defaults to `NOWHERE`** (move that constant from :170 to the top of the file; `ask` and `askOn` go through `askWith`, so the `--machine` tests at :346-389 are covered too; a test that relied on finding the Mac's claude gets a stand-in instead), so the Mac's own `/opt/homebrew/bin/claude` is never found or run by any test, old or new. Make that change first and see the existing install tests still pass. A `.local/bin` stand-in is left behind in the home, so these tests assert `[r.left, r.ran]` deepEqual `[[".local", ".local/bin", ".local/bin/claude"], ""]` instead of `changedNothing(r)`.

```js
it("tells, for her laptop, the tools it finds and the steps by hand, and never prints her email", () => {
  const { root } = dropbox();
  const r = askWith({ programs: [[".local/bin/claude", CLAUDE_SIGNED_IN]], stubs: { "xcode-select": XCODE_HERE, defaults: FCP_124, sw_vers: MACOS_27 }, agentPath: NOWHERE }, "--print", "--machine", "Sallie's laptop", root);
  assert.equal(r.status, 0);
  for (const line of [
    "  Xcode's command line tools (git, swift):  here already",
    "  Final Cut Pro:  12.4, here",
    "  Claude Code, signed in:  yes (max)",
    "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)",
    "  By hand afterwards: the setup guide (docs/setup/sallies-laptop.md)",
  ]) assert.ok(r.out.includes(line), line);
  assert.ok(!r.out.includes("x@y"));
  assert.deepEqual([r.left, r.ran], [[".local", ".local/bin", ".local/bin/claude"], ""]);
});
it("says how to sign the claude command in when it is not, and goes on to the end", () => { /* the claude stand-in prints {"loggedIn":false} and EXITS 1, as the real one does; --print still reaches "Nothing was changed." */ });
it("names the macOS Final Cut 12.4 needs, on an older macOS", () => { /* sw_vers prints 15.6; defaults prints 12.3 */ });
```

(Define `CLAUDE_SIGNED_IN`, `XCODE_HERE`, `FCP_124`, `MACOS_27` as small shell scripts beside the existing stand-ins. Homebrew's "not here" line cannot be made to show on a Mac that has Homebrew (`find_program` also looks in /opt/homebrew/bin), so check its text by reading install.sh, as the "installer's own text" tests do.)

- [ ] **Step 2: Run, see it fail.** `cd tool && node --test tests/install.test.js` → the new lines are missing.
- [ ] **Step 3: Implement** in install.sh's summary block (:240-270), with the existing `say` and `find_program` helpers; `auth="$("$claude" auth status --json 2>/dev/null || true)"`, `fcp="$(defaults read "/Applications/Final Cut Pro.app/Contents/Info" CFBundleShortVersionString 2>/dev/null || true)"` and `macos="$(sw_vers -productVersion 2>/dev/null || true)"` (the script runs under `set -euo pipefail`, and `claude auth status` exits 1 when signed out, `defaults read` when Final Cut is not there), then parse `$auth` with `"$node" -e` (node is found before this point; when it is not, say `Claude Code, signed in:  not checked (node is not here yet)`). In the install block, after `settings.js write` (:321), add `"$node" "$HERE/settings.js" studio --node "$node"`. Keep every text constraint the tests at :284-331 assert.
- [ ] **Step 4: Run** `node --test tests/install.test.js`, then `node --test` (all pass).
- [ ] **Step 5: Commit** `git commit -m "Installer: her laptop's tools, Claude's sign-in, and her folder, in --print"`.
- [ ] **Step 6 (if time; the guide's step 10, "Claude was asked from the background job", is the fallback): the real call from the background job's context** (spec section 3: "setup ends with one real `claude -p` call from the launch agent's context"). Add `unedited.js --check-claude`: it makes the same locked-down call as the import (`CLAUDE_ARGS`, the named model) with the request `Reply with the one word OK.`, prints `Claude answered from here.` or `Claude could not be asked from here: <why>.`, and exits 0 or 1; a test with a stand-in `claude` (as `tests/unedited.test.js` does). In the install path only (never `--print`, never a test), after the launch agent is bootstrapped: write a one-shot plist `com.thebrimm.claude-check` (same `PATH`, `ProgramArguments` node + `unedited.js --check-claude`, `RunAtLoad`, its output to `~/Library/Logs/brimm-video-claude-check.log`), bootstrap it, wait up to 90 seconds for the log to hold one of the two lines, say that line, then `launchctl bootout` it and delete its plist. Commit `git commit -m "Installer: one real call to Claude from the background job's context"`.

### Task 2: `~/BRIMM Video Studio`: her settings, the guard hook, the skill

**Files:** Create `tool/studio.js`, `tool/studio/CLAUDE.md`, `tool/studio/SKILL.md`, `tool/studio/guard.sh`, `tool/studio/guard.mjs`, `tool/tests/studio.test.js`; Modify `tool/settings.js` (a `studio` command), `tool/edit.js` (export `COMMAND_NAMES`).

**Interfaces:**
- `studioFolder(home)` → `<home>/BRIMM Video Studio`.
- `studioFiles({ checkout, node })` → `{ "CLAUDE.md": text, ".claude/settings.json": text, ".claude/skills/brimm-edit/SKILL.md": text }`, `{{CHECKOUT}}` and `{{NODE}}` filled in.
- `writeStudio(home, { checkout, node })` → writes those files (plain writes: this folder is on her own disk), makes `Pictures/`, and touches nothing else in the folder. Returns the folder.
- `guardDecision(input, { checkout, node })` → `{ decision: "allow" | "deny" | "pass", reason }` for a PreToolUse input `{ tool_name, tool_input }`. `pass` = no answer: Claude Code's own rules decide.
- `settings.js studio --node "<node>"`: `--node` is required, and is the node the installer found (`/opt/homebrew/bin/node`), never `process.execPath` (with Homebrew that is a versioned Cellar path that `brew upgrade node` deletes); `checkout` comes from this Mac's settings. Writes the folder, prints `Written: <folder>`; exit 2 when not set up or `--node` is missing. install.sh runs `"$node" "$HERE/settings.js" studio --node "$node"`.

**The settings** (exactly this JSON, with the two paths filled in; `\"` is JSON's escape):

```json
{
  "permissions": {
    "defaultMode": "dontAsk",
    "allow": ["Bash({{NODE}} \"{{CHECKOUT}}/tool/edit.js\" *)"],
    "deny": ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
    "blockReadsOutsideWorkingDirectories": true,
    "disableBypassPermissionsMode": "disable",
    "disableAutoMode": "disable"
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "/bin/sh \"{{CHECKOUT}}/tool/studio/guard.sh\" \"{{NODE}}\"", "onFailure": "block" }] }
    ]
  }
}
```

A bare-name deny removes the tool from Claude's sight; the hook refuses it anyway. If Claude Code warns at start that a deny rule names no tool (an older version without that tool), drop that name from the template: the hook still covers it. A settings file Claude Code cannot read loses the whole lock-down, so tonight's CLI check and the guide's step 9 are where a wrong key shows.

Keys checked against code.claude.com/docs/en/settings-reference and /permissions on 2026-10-14: `permissions.defaultMode` ("dontAsk": "auto-denies every call that would otherwise prompt"), `permissions.disableBypassPermissionsMode` and `permissions.disableAutoMode` (value "disable", any settings file), `permissions.blockReadsOutsideWorkingDirectories` (Boolean; "Make Claude's file tools refuse reads outside your working directories in every permission mode"; Claude Code 2.1.257 or later). `dontAsk` may not apply in the desktop app (ruling 10): the hook is what holds there. Check against code.claude.com/docs/en/hooks while building: that a `matcher` of `"*"` matches every tool (an empty string may be the documented form), that a PreToolUse hook's JSON on stdout with `hookSpecificOutput.permissionDecision` `"allow"`/`"deny"` and a `permissionDecisionReason` is read, that exit code 2 blocks the call, and where `onFailure: "block"` goes (on the hook handler; Claude Code 2.1.295 or later, per the lead's review), and that `mcp__*` "matches every MCP tool across all servers" (/permissions). Adjust the shapes to what the docs say and note it in the PR.

**The guard runs for every tool.** It answers:
- **Bash:** `allow` only when the whole command matches one anchored pattern, else `deny`. The pattern (both paths regex-escaped): `^(?:node|<node>) "<checkout>/tool/edit\.js"(?: (?:[A-Za-z0-9_.,:+@%/-][A-Za-z0-9_.,:+=@%/-]*|"[^"$`\\\r\n]*"))*$`. So after `edit.js` come only words, one space apart: a plain word of those characters, or a double-quoted word holding no `"`, `$`, backtick, backslash or line break. Single quotes, `~`, globs, parentheses, `;`, `&`, `|`, `<`, `>`, and `$(…)` or backticks even inside double quotes are all refused. Refusing a strange but harmless command is fine.
- **Skill:** `allow` when `tool_input.skill` is `brimm-edit`, else `deny`.
- **Read, Glob, Grep, and Claude's own bookkeeping (TodoWrite, TaskCreate, TaskUpdate, TaskList, TaskGet, ToolSearch, AskUserQuestion):** `pass` (Claude Code's rules decide: reads outside the folder are refused by `blockReadsOutsideWorkingDirectories`; ToolSearch only loads a tool, which then meets this hook).
- **Every other tool** (Edit, Write, WebFetch, Monitor, Artifact, Workflow, Agent, RemoteTrigger, SendMessage, LSP, any `mcp__…` tool, and any tool added later): `deny`.
- Reason when refused: `In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else.`

`tool/studio/guard.sh` makes a failure block rather than let the call through (a hook that cannot start is only a non-blocking error):

```sh
#!/bin/sh
# Run the guard with the node the installer found. If node cannot run, or the guard fails, block the call: exit 2.
"$1" "$(dirname "$0")/guard.mjs" "$1" || { echo "brimm-video's guard could not check this. Ask Jason." >&2; exit 2; }
```

`tool/studio/guard.mjs`:

```js
// Sallie's session may run one program: brimm-video's edit.js, from this Mac's main checkout. This hook answers every tool
// call before Claude Code asks anyone, in whatever mode the session is in: yes to edit.js, no to anything that is not
// reading inside her folder, and nothing (Claude Code's own rules) for those reads.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { guardDecision } from "../studio.js";

const answer = (decision, reason) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } }));
try {
  const node = process.argv[2];
  const checkout = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
  const { decision, reason } = guardDecision(JSON.parse(readFileSync(0, "utf8") || "{}"), { checkout, node });
  if (decision !== "pass") answer(decision, reason);
} catch {
  answer("deny", "brimm-video's guard could not check this command. Ask Jason.");
}
```

- [ ] **Step 1: Write the failing tests** in `tool/tests/studio.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFiles, writeStudio, guardDecision, studioFolder } from "../studio.js";

const CHECKOUT = "/Users/sallie/Claude Code/BRIMM video";
const NODE = "/opt/homebrew/bin/node";
const EDIT = `${NODE} "${CHECKOUT}/tool/edit.js"`;
const bash = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout: CHECKOUT, node: NODE }).decision;
const tool = (tool_name) => guardDecision({ tool_name, tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision;

describe("her folder's settings", () => {
  it("allow only edit.js, deny the editing and web tools, keep reads in the folder, lock the mode, and guard every tool", () => {
    const s = JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/settings.json"]);
    assert.deepEqual(s.permissions, {
      defaultMode: "dontAsk",
      allow: [`Bash(${EDIT} *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      blockReadsOutsideWorkingDirectories: true,
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable",
    });
    assert.deepEqual(s.hooks.PreToolUse, [{ matcher: "*", hooks: [{ type: "command", command: `/bin/sh "${CHECKOUT}/tool/studio/guard.sh" "${NODE}"`, onFailure: "block" }] }]);
  });
  it("name the checkout in the skill, with its spaces, and leave no {{ }} behind", () => {
    const files = studioFiles({ checkout: CHECKOUT, node: NODE });
    assert.ok(files[".claude/skills/brimm-edit/SKILL.md"].includes(EDIT));
    for (const text of Object.values(files)) assert.ok(!text.includes("{{"));
  });
});

describe("the guard", () => {
  it("lets edit.js run with plain or double-quoted words", () => {
    for (const c of [`${EDIT} episodes`, `${EDIT} open "Pricing talk"`, `node "${CHECKOUT}/tool/edit.js" open "Talk (Sallie's laptop)"`, `${EDIT} title "Pricing talk" --words "Price it right" --approve`])
      assert.equal(bash(c), "allow", c);
  });
  it("refuses anything else, and edit.js with anything that could run more", () => {
    for (const c of ["date", "cat /etc/hosts", `ls "${CHECKOUT}"`, `${NODE} -e "1"`, `${NODE} "${CHECKOUT}/tool/unedited.js" --from-plan x`,
      `${NODE} "/other/tool/edit.js" open x`, `${EDIT} open x; cat /etc/hosts`, `${EDIT} open x && date`, `${EDIT} open x | sh`,
      `${EDIT} open $(date)`, `${EDIT} open "$(cat ~/.ssh/id_ed25519)"`, `${EDIT} open "\`date\`"`, `${EDIT} open '"' ; date ; '"'`,
      `${EDIT} open x > /tmp/y`, `${EDIT} open ~/x`, `${EDIT} open *`, `${EDIT} open "a\nb"`, `${EDIT} open x\ndate`])
      assert.equal(bash(c), "deny", c);
  });
  it("leaves reads and the skill to Claude Code's own rules, and refuses every other tool", () => {
    for (const t of ["Read", "Glob", "Grep", "TodoWrite", "TaskCreate", "ToolSearch", "AskUserQuestion"]) assert.equal(tool(t), "pass", t);
    for (const t of ["Edit", "Write", "WebFetch", "Monitor", "Artifact", "Workflow", "Agent", "RemoteTrigger", "SendMessage", "LSP",
      "mcp__gmail__send_message", "mcp__terminal__run_in_terminal", "mcp__ccd_directory__change_directory", "SomethingNew"]) assert.equal(tool(t), "deny", t);
  });
  it("allows her skill and refuses any other", () => {
    const skill = (name) => guardDecision({ tool_name: "Skill", tool_input: { skill: name } }, { checkout: CHECKOUT, node: NODE }).decision;
    assert.equal(skill("brimm-edit"), "allow");
    assert.equal(skill("something-else"), "deny");
  });
  it("blocks the call when its node cannot run", () => {
    const sh = join(dirname(fileURLToPath(import.meta.url)), "..", "studio", "guard.sh");
    const r = spawnSync("/bin/sh", [sh, "/no/such/node"], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "date" } }), encoding: "utf8" });
    assert.equal(r.status, 2);
  });
  it("answers allow and deny as JSON when run as the hook", () => {
    const sh = join(dirname(fileURLToPath(import.meta.url)), "..", "studio", "guard.sh");
    const checkout = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const ask = (command) => JSON.parse(spawnSync("/bin/sh", [sh, process.execPath], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }), encoding: "utf8" }).stdout).hookSpecificOutput.permissionDecision;
    assert.equal(ask(`${process.execPath} "${checkout}/tool/edit.js" episodes`), "allow");
    assert.equal(ask("date"), "deny");
  });
});

describe("writing her folder", () => {
  it("writes the three files and Pictures, and keeps whatever else is there", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-studio-"));
    const folder = studioFolder(home);
    mkdirSync(join(folder, "Pictures"), { recursive: true });
    writeFileSync(join(folder, "Pictures", "chart.png"), "x");
    writeStudio(home, { checkout: CHECKOUT, node: NODE });
    for (const f of ["CLAUDE.md", ".claude/settings.json", ".claude/skills/brimm-edit/SKILL.md", "Pictures/chart.png"]) assert.ok(existsSync(join(folder, f)), f);
    rmSync(home, { recursive: true, force: true });
  });
});
```

(The hook test's checkout is this worktree, resolved from the test file, so `process.execPath` stands for her node there.) Also a test that `settingsMain(["studio", "--node", "/opt/homebrew/bin/node"], { home })` writes the folder from this Mac's settings (in `settings.test.js`, beside `write`), exits 2 with no settings, and exits 2 without `--node`.

- [ ] **Step 2: Run, see them fail** (`studio.js` does not exist).
- [ ] **Step 3: Implement** `tool/studio.js` (templates read from `tool/studio/`, `{{CHECKOUT}}` and `{{NODE}}` replaced with `split().join()`; the Bash pattern built with both paths regex-escaped), `guard.sh` and `guard.mjs` above (guard.sh executable: `chmod 755`, and committed so), and the `studio` command in `settings.js`.
- [ ] **Step 4: Write the templates.**

`tool/studio/CLAUDE.md`:

```markdown
# The BRIMM's video editing

This folder is for editing The BRIMM's episodes with brimm-video. Use the brimm-edit skill for everything here.

- Everything is done through brimm-video's commands. Do not open, read or change any code, and do not run any other program.
- Nothing here posts, sends or publishes anything. The finished videos are posted by hand.
- Speak to Sallie in plain words. Never show her command names, paths or flags.
- For anything this folder cannot do, say so plainly and suggest she asks Jason.
```

`tool/studio/SKILL.md` (front matter, then the body; keep it under about 150 lines):

```markdown
---
name: brimm-edit
description: Use for anything about The BRIMM's videos and episodes: what is waiting, opening an episode, its name and title, Reels, showing it in Final Cut, finishing it, handing it to Jason, conflicts, and how far something has got.
---

# brimm-edit

Run brimm-video's commands, and only these, exactly so: {{NODE}} "{{CHECKOUT}}/tool/edit.js" <command> …
Put the episode in quotes. Never show Sallie the command, a path or a flag: say what it did, in plain words.

## What she says, and what to run

| She says | Run |
|---|---|
| "What's waiting?" | `episodes` |
| "Open the Pricing episode" | `open "<episode>"` |
| "Call it …" | `name "<episode>" "<name>"` |
| "Use that title" / "Make the title …" | `title "<episode>" --approve` / `title "<episode>" --words "<words>" --approve` (an approved title changes only with `--change`; say BRIMM Ops may have it already) |
| "Reel 2's title is …" | `title "<episode>" reel 2 --words "<words>"` |
| "Show me the Reels" | `reels "<episode>"` (it opens the previews) |
| "Ask Claude again for Reels" | `ask "<episode>"` |
| "Finish Reels 1 and 3" / "Drop 2" | `reel pick "<episode>" 1 3` / `reel drop "<episode>" 2` |
| "Show it in Final Cut" / "Show reel 1 in Final Cut" | `push "<episode>"` / `push "<episode>" reel 1`, with the guard below |
| "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
| "How far is it?" | `status` |
| "Try it again" (an import that stopped) | `retry "<video>"` |

## The guard, before showing a timeline again

When a push answers that the timeline was shown before, ask her, in these words: "Did you change v<N> in Final Cut since it was shown?"
- If not: run the push again with `--no-hand-edits`.
- If yes: run it with `--hand-edits` and read her what it says: her changes stay in v<N>; brimm-video cannot build on them yet. Until it can, ask brimm-video for its changes first and make trims by hand last, or finish that timeline by hand.

## Not ready yet: say so, and what to do by hand

- Taking an episode over from the other Mac, handing it to Jason, showing the transcript, notes or plan, sorting out a conflict, checking for a newer brimm-video: "That isn't ready yet; ask Jason."
- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, captions, a spelling fix, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
- Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)

## By hand in Final Cut, in this order (tell her at the right moment)

1. At the first open of an episode on this Mac: in Finder, Control-click the episode's folder and choose Make available offline (`open` says where).
2. To finish: for each part, Share it with Command-E (check the save dialog says From Final Cut), wait for Final Cut's notice that it is done, then click in that project's timeline and choose File > Export XML…, into From Final Cut, keeping the version it offers. Then say "finish".
3. When the finish is done: drop the hand-off file it shows in Finder onto the BRIMM Ops page.
4. Once the hand-off is on the page and Dropbox shows the folder is up to date: in Finder, Control-click the episode's folder and choose Make online-only, to free space on her laptop.
```

**The skill names only commands that exist** (so stopping after any task leaves her no dead row). This task writes the rows above, for the commands in `COMMANDS` now; Tasks 3–6 each add their own rows and take their words out of the first "Not ready yet" line. If PR 19 has not merged, leave out the rows for `reels`, `ask` and a Reel's title, and add "showing the Reels, asking Claude again for Reels, a Reel's title" to that line. Export `COMMAND_NAMES = Object.keys(COMMANDS)` from edit.js, and add to studio.test.js:

```js
import { COMMAND_NAMES } from "../edit.js";
it("names only commands edit.js has", () => {
  const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
  // Every backticked span that starts with a lowercase word is a command line; its first word must be a command.
  for (const [, span] of skill.matchAll(/`([a-z][^`]*)`/g)) assert.ok(COMMAND_NAMES.includes(span.split(" ")[0]), span);
});
```

(Flags such as `--no-hand-edits` start with `-` and are not checked. Write every command in full inside its backticks, never a bare `notes`.)

- [ ] **Step 5: Run** `node --test tests/studio.test.js tests/settings.test.js`, then `node --test`.
- [ ] **Step 6: Commit** `git commit -m "Her folder for Claude: settings that allow only edit.js, a guard hook, and the skill"`.

### Task 3: The claim in `open`, take-over, and refusing a claim held elsewhere

**Files:** Modify `tool/edit.js`, `tool/episode.js`, `tool/unedited.js` (the `--from-plan` claim check), `tool/studio/SKILL.md`; Test `tool/tests/edit-claim.test.js` (new), `tool/tests/unedited.test.js`; update the exact-output open tests in `tool/tests/edit.test.js` (:212) for the new claim line.

**Interfaces:**
- `CLAIM_WAIT_MS = 20000` (exported from edit.js).
- `open(ctx, rest)`: flags `--take-over`. Order: `episodeFor` (now `newerEnds: 1`, since it writes) → `undone` (say it, `acceptRev`, go on, as pushPart does) → **released files still arriving** → `filesProblems` (refuse, as today) → `notHere` (bring, as today) → **the claim** → **online** → show (as today). Still-arriving comes before `filesProblems` because the released files are in the record's list too, and `filesProblems` would call them missing.
- `claimHeld(ctx, record)` → `""` or the refusal text, used by every writing command (ruling 3).
- `ctx.deps.online` (default: `dns.promises.lookup("www.dropbox.com")` raced against 3 seconds, true/false).
- `episodes` shows `Editing: <Mac>, since <shownAt(since)>` for an episode with a claim. Import `shown as shownAt`, `claimed`, `heldElsewhere` and `released` from ./episode.js (edit.js has a local `shown` array in `episodes` and a local `released` in `finishEpisode`).
- Both test setups (`tests/edit.test.js` `setup` deps, and the `contextFor({...})` in `tests/episodes.js`) gain `online: async () => true`, so no test looks anything up; `otherMac` inherits it. The offline test sets `t.ctx.deps.online = async () => false`.

Texts:
- Held elsewhere, no take-over: `<Mac> has <name> open, since <shown(since)>. Say "take it over" to open it here; anything not handed over stays on <Mac>.` → 1.
- Take-over: `Taken over from <Mac>, who had it since <shown(since)>.` (then as below).
- Lost the race after the wait: `<Mac> opened <name> at the same time, and it is theirs. Say "take it over" if they are done with it.` → 1.
- Offline: `This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.`
- Released files still coming: `Still arriving from <released.by>: <n> file(s). Dropbox is bringing them over; say "open <name>" again when it is done.` (start `bring` of those files) → 0, no claim.
- `claimHeld`: `<Mac> has <name> open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`

- [ ] **Step 1: Write the failing tests** (`tool/tests/edit-claim.test.js`, with `setup`, `episodeFor`, `reread`, `otherMac` from `tests/episodes.js`; `t.ctx.deps.online = async () => true`):

```js
describe("the claim", () => {
  it("open writes the claim, waits twenty seconds, reads again, and shows the episode", async () => {
    const t = setup(); const found = episodeFor(t);
    t.ctx.deps.online = async () => true;
    assert.equal(await editMain(["open", FOLDER], t.ctx.deps), 0);
    assert.equal(reread(found).editing.by, "Mac Studio");
    assert.deepEqual(t.waits.filter((ms) => ms === CLAIM_WAIT_MS).length, 1);
    t.done();
  });
  it("open on the Mac that has it writes nothing new", async () => { /* editing already this Mac: rev unchanged */ });
  it("refuses when the other Mac has it, and takes it over when told to", async () => {
    const t = setup(); const found = episodeFor(t, { record: { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } } });
    t.ctx.deps.online = async () => true;
    const said = [];
    assert.equal(await editMain(["open", FOLDER], { ...t.ctx.deps, say: (l) => said.push(l) }), 1);
    assert.match(said.join("\n"), /Sallie's laptop has Pricing talk open, since 2026-10-20 14:00\. Say "take it over"/);
    assert.equal(await editMain(["open", FOLDER, "--take-over"], t.ctx.deps), 0);
    assert.equal(reread(found).editing.by, "Mac Studio");
    t.done();
  });
  it("stops when the other Mac took it over during the wait", async () => {
    // The stand-in wait writes the other Mac's claim as the record AFTER this Mac's (rev + 2, recordFile), as Dropbox would
    // bring a take-over made there after seeing this claim. Says the "it is theirs" text, returns 1.
  });
  it("stops, naming the conflict, when both Macs wrote the same record number", async () => {
    // The stand-in wait adds `record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json` holding her claim beside this
    // Mac's 0002.json, as Dropbox keeps both. Says the conflict (readEpisode's why), returns 1, writes nothing more.
  });
  it("says still arriving, starts bring, and claims nothing, when released files are not here yet", async () => {
    // As release writes it: the file is in BOTH record.files and released.files ({ at, by: "Sallie's laptop", files:
    // { "edit/from-final-cut/Pricing talk main v2 3fa9c1.mov": 9 } }), and missing. Says "Still arriving from Sallie's
    // laptop: 1 file", returns 0, and the record's rev is unchanged.
  });
  it("warns when this Mac seems offline, and still claims", async () => { /* online: async () => false */ });
  it("name, title, reel, push, ask and finish refuse while the other Mac has it, and write nothing", async () => { /* each command once */ });
  it("episodes says who is editing", async () => { /* "Editing: Sallie's laptop, since 2026-10-20 14:00" */ });
});
```

Fill the bodies in full in the same style (the two Macs: `const her = otherMac(t)`; the races: give `t.ctx.deps.wait` a stand-in that acts on the 20 000 ms wait, writing with `recordFile` and `claimed(record, "Sallie's laptop", …)`; never write over this Mac's own record file, which Dropbox never does).

Also in `tool/tests/unedited.test.js` (PR 19's episode-mode `--from-plan` tests): `--from-plan` on a video in an episode another Mac has open refuses with the `claimHeld` text and writes nothing.

- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement.** In `open`: parse `flagsOf(rest, [])`; `episodeFor(ctx, words, { newerEnds: 1 })`. If `undone`: say it and `acceptRev(ctx.home, record.id, record.rev)`, then go on. Before `filesProblems`: if `record.released?.by && record.released.by !== ctx.machine`, take the released files not here at their size (`const s = ctx.stat(join(found.folder, rel)); !s || s.size !== bytes || !ctx.isWhole(join(found.folder, rel))`; `ctx.stat` does not throw on a missing file); for those, `startDetached(ctx, { command: "bring", folder: found.name, args: missing })`, say, return 0. After `notHere`: if `record.editing?.by !== ctx.machine`: if `heldElsewhere(record, ctx.machine)` and no `--take-over` → refuse; else `if ((await save(ctx, { ...found, record }, claimed(record, ctx.machine, localStamp(new Date(ctx.now()))), takeOverText)) !== 0) return 1;` (`found` from `episodeFor` has no `record`; give `save` one, and let it say nothing when `done` is empty), then `await (ctx.deps.wait || ((ms) => new Promise((r) => setTimeout(r, ms))))(CLAIM_WAIT_MS)`. Then `const again = readEpisode(found.folder); if (!again.record) { say(`${found.name}: ${again.why}.`); return 1; }` (a real race leaves a conflicted copy of the record); if `again.record.editing?.by !== ctx.machine`, the lost-race text with `again.record.editing.by`, return 1. Then `if (!(await (ctx.deps.online || online)())) say(offline text)`. Then the existing show, from `again.record`. Add `claimHeld(ctx, record)` and call it at the top of `nameEpisode`, `markReels`, `pushPart`, `ask` (quick part), `finishEpisode` (quick part) and `release` (Task 4), and in `titleEpisode` and `reelTitle` only after their show-only returns (a title that is only shown changes nothing). Add a test that open's race ends cleanly when the wait stand-in writes `record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json` beside `0002.json`: it names the conflicted copy and returns 1. The existing test that open shows a record of a newer layout now expects code 1. Update the open tests in edit.test.js that assert exact lines (they run as "Mac Studio" with no claim: the claim is written silently, so only rev and the waits change; adjust what they assert about `rev`). `episodes`: add the line after the episode's name line when `record.editing`. In `unedited.js` `videosFromPlan` (PR 19, about :1343), add `heldElsewhere(read.record, deps.settings.machine)` beside `undone(…) || importHolds(…)`, turned into the `claimHeld` text (import it from ./episode.js). The skill: the `open` row gains `. If it says another Mac has it, ask her whether to take it over; if yes, \`open "<episode>" --take-over\``, and "taking an episode over from the other Mac" leaves the "Not ready yet" line.
- [ ] **Step 4: Run** `node --test tests/edit-claim.test.js tests/edit.test.js tests/edit-records.test.js tests/edit-finish.test.js tests/reel.test.js tests/unedited.test.js tests/studio.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "The claim: open writes it and checks it after twenty seconds, take-over, and writers refuse a claim held elsewhere"`.

### Task 4: `release`, its answers and copies, and the guard taking the other Mac's answer

**Files:** Modify `tool/edit.js`, `tool/episode.js`, `tool/studio/SKILL.md`; Test `tool/tests/edit-claim.test.js`.

**Interfaces:**
- `released(record, files, { at = localStamp(), by, answers = {} } = {})` in episode.js → `{ ...record, editing: null, released: { at, by, files, answers } }`. (Change the one existing caller pattern and its test, episode.test.js:347-363.)
- `release(ctx, rest)`: flags `--no-hand-edits`, `--hand-edits-stay`. Exported `releaseEpisode(ctx, found, { answer })`.
- `answers` shape: `{ "main": { v, said: "no changes" | "changes stay on <Mac>" }, "reel 2": { … } }`: one entry per part whose highest push was made on this Mac, plus each earlier `released.answers` entry carried forward for a part this Mac did not push, while its `v` is still that part's highest push (so a release by a Mac that pushed nothing keeps the first Mac's answer).
- `pushPart`: flag `--without-other-macs-changes` (push, both forms). When the part's last push was `on` another Mac: `fromOther = released.answers[partKey]`; `fromOther.v === last` and "no changes" → no question; otherwise (changes stay, or no answer at that version) → refuse with the texts below unless `--without-other-macs-changes`. `--no-hand-edits` never lifts it. When the last push was on this Mac: today's guard, unchanged.
- Which parts release asks about: every part (main, each Reel) whose highest push was made on this Mac, whether or not it was pushed after the claim (an episode with no claim may be pushed, ruling 3).

Texts:
- Not held here: `This Mac does not have <name> open, so there is nothing to hand over.` → 1.
- The question: `Did you change anything in Final Cut since it was last shown (<parts with their v>)? Say "no changes" to hand it over, or "hand it over anyway" if your changes should stay on this Mac.` → 1, nothing written.
- Done: `<name> is handed over. Copied for the other Mac: <files, or "nothing">. Not copied yet, still being written: <files>. Keep this Mac open and online until Dropbox shows the folder is up to date.` → 0.
- The guard, the other Mac said changes stay: `The changes to v<last> of <part> stay on <Mac>, in its Final Cut library: <Mac> said so when it handed this over. Finish that part on <Mac>, or start again from v<last> without them (say "go ahead without <Mac>'s changes").` → 1 unless `--without-other-macs-changes`.
- The guard, no answer carried: `v<last> of <part> was shown on <Mac>, and <Mac> has not said whether it was changed there. Ask whoever used it on <Mac>. If it was not changed, or to start again from v<last> without those changes, say "go ahead without <Mac>'s changes".` → 1 unless `--without-other-macs-changes`.
- Release, an export out of date (ruling 6): finish's words for that part (parts.js:129) then ` Then hand it over again. Nothing was handed over.` → 1, nothing written.

What release copies (ruling 6): first, for each part, finish's freshness rule on this Mac's `From Final Cut/` (refuse as above). Then every file in `fromFinalCutFolder(ctx.home)` whose name without its extension is a project name in `record.main.pushed[].project` or `record.reels[].pushed[].project`: videos (`.mov`, `.mp4`, `.m4v`), each only when whole (`ctx.isWhole` and the size the same across one `await (ctx.deps.wait || ((ms) => new Promise((r) => setTimeout(r, ms))))(5000)`), and exports (`.fcpxmld` folders, file by file; `.fcpxml` files), into `edit/from-final-cut/<same name>` by `textWriter`/`cloneIn` (use `replaceIn` when a copy is there already). The list for `record.files` and `released.files` is **the record's own `files` plus each copy release made, with its size** (not a scan of the folder: a scan would list `.DS_Store` and other files Dropbox never syncs, and the other Mac would call them missing).

- [ ] **Step 1: Write the failing tests** (same file, `describe("release")`):

```js
it("refuses on a Mac that does not have it", async () => { /* editing: Sallie's laptop */ });
it("asks about hand edits when this Mac pushed, and writes nothing until answered", async () => {
  const t = setup(); const found = episodeFor(t, { record: { editing: { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" }, main: { ...EDITED.main, pushed: [{ v: 2, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", file: "edit/main.v2.mac-studio.fcpxml", project: PROJECT.main }] } } });
  const said = [];
  assert.equal(await editMain(["release", FOLDER], { ...t.ctx.deps, say: (l) => said.push(l) }), 1);
  assert.match(said.join("\n"), /Did you change anything in Final Cut since it was last shown \(main v2\)\?/);
  assert.equal(reread(found).editing.by, "Mac Studio");
  t.done();
});
it("lets it go with the answers, copies the Share and the export, lists them, and says to keep the Mac open", async () => {
  // t.shared(`${PROJECT.main}.mov`, …) and, newer, an export bundle `${PROJECT.main}.fcpxmld/Info.fcpxml` in From Final Cut,
  // and a `.DS_Store` in the episode folder. After release --no-hand-edits: editing null; released.by "Mac Studio";
  // released.answers.main = { v: 2, said: "no changes" }; edit/from-final-cut/<project>.mov and .fcpxmld/Info.fcpxml are in
  // the folder and in record.files and released.files; .DS_Store is in neither; the last line ends "Keep this Mac open and
  // online until Dropbox shows the folder is up to date."
});
it("refuses when a part's export is older than its Share, and writes nothing", async () => {
  // Info.fcpxml's time (utimesSync) before the .mov's: finish's words for main, then "Then hand it over again."; rev unchanged.
});
it("leaves out a Share still being written, and names it", async () => { /* t.grow(...) */ });
it("keeps the first Mac's answer when a Mac that pushed nothing releases it", async () => {
  // Released by Mac Studio with answers["reel 1"] = { v: 1, said: "no changes" }; her = otherMac(t); she opens and releases
  // (no push, so no question); released.by "Sallie's laptop" and answers["reel 1"] is still { v: 1, said: "no changes" }.
});
it("on the other Mac, a push asks nothing when the first Mac said no changes at that version", async () => {
  // The episodes.js episode has no edit/main.v0.fcpxml, so push Reel 1 (EDITED's reels[0] was pushed v1 on Mac Studio;
  // reel.test.js:71 pushes it with this fixture). Released by Mac Studio with answers["reel 1"] = { v: 1, said: "no changes" };
  // her = otherMac(t); open as her (claims); push reel 1 as her: no question; that Reel's pushed gains v2 on "Sallie's laptop".
});
it("on the other Mac, a push refuses when the first Mac said its changes stay there, even with --no-hand-edits", async () => {
  // said: "changes stay on Mac Studio". push reel 1 as her → 1, names Mac Studio; again with --no-hand-edits → 1, nothing
  // written; again with --without-other-macs-changes → 0, pushed gains v2 on "Sallie's laptop".
});
it("on the other Mac after a take-over, a push refuses because no answer was carried", async () => {
  // Mac Studio has it open and pushed reel 1 v1; her = otherMac(t); open --take-over as her; push reel 1 as her → 1 with
  // "v1 of reel 1 was shown on Mac Studio, and Mac Studio has not said"; it does not ask her "Did you change v1".
});
```

- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** `releaseEpisode` (claim check; the parts whose highest push was made on this Mac → if any and no answer → question; the freshness check; copies as above; answers with the earlier ones carried forward; `save(ctx, found, released({ ...record, files: list }, list, { by: ctx.machine, answers }), doneText)`), the `release` command in `COMMANDS` and `HELP`, and the guard change in `pushPart` and `push`'s flags (read `record.released?.answers?.[key]`, where `key` is `"main"` or `` `reel ${n}` ``; `--without-other-macs-changes` in HELP). Keep `finish.js`'s own `editing: null` as it is. The skill gains:
  - the row `| "Hand it to Jason" / "I'm done with it for now" | \`release "<episode>"\`, with the release question below |`, and "handing it to Jason" leaves the "Not ready yet" line;
  - under the guard: `- If the push says the changes are, or may be, on the other Mac: tell her so in plain words, and that whoever used it there can say. Run the push again with \`--without-other-macs-changes\` only if she says to go ahead without them. Never use \`--no-hand-edits\` for this: that is her answer about her own Final Cut.`;
  - the section `## The release question`: "When `release` asks, ask her: "Did you change anything in Final Cut since it was last shown?" No: `--no-hand-edits`. Yes: `--hand-edits-stay`, and tell her the changes stay in this Mac's library. If release says an export is out of date, read her what to do in Final Cut, then try again. Afterwards tell her to keep the laptop open and online until Dropbox shows the folder is up to date." (Write `release "<episode>"` in full where the section names it, for the skill's test.)
- [ ] **Step 4: Run** the claim tests, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "release: the hand-edit answers, the Shares and exports copied for the other Mac, and the guard taking the other Mac's answer"`.

### Task 5: `show` and `behind`

**Files:** Modify `tool/edit.js`; Test `tool/tests/edit-show.test.js` (new).

**Interfaces:**
- `show "<ep>" transcript|notes|plan` → prints `<stem>.transcript.txt`, `<stem>.edit-notes.txt` or `<stem>.cut-plan.txt` whole. Not whole on this Mac: start `bring` of that file and say `Dropbox is still bringing it over; say it again when it is done.` → 1. Missing: `<name> has no <what> yet.` → 1. Anything else after the episode: HELP → 2. Takes no path.
- `behind` → runs, through `ctx.deps.run || runProgram` with a 20 000 ms limit, `git -C <checkout> fetch -q origin main`, then `git -C <checkout> rev-list --count HEAD..origin/main`. Says `This Mac has the newest brimm-video.` / `Jason has a newer brimm-video (<n> change(s)). Ask him to update this Mac when it suits.` / `Could not check for a newer brimm-video. Is this Mac offline?` Always 0, except 2 when not set up.

- [ ] **Step 1: Write the failing tests:** each `show` kind prints the file's text; a missing file; `show` with a path-like word gives HELP and 2; `behind` with a stand-in `run` answering `{ code: 0 }` then `{ code: 0, stdout: "3\n" }` says 3 changes; `{ code: 0, stdout: "0\n" }` says newest; a fetch with `code: 128` says offline. Assert the stand-in got `["-C", "/checkout", "fetch", "-q", "origin", "main"]` and a `limit` of 20000.
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** both, in `COMMANDS` and `HELP`. The skill gains, before "What she says": `## At the start of each session` / "Run \`behind\`. If this Mac is behind, tell her: "Jason has a newer brimm-video; ask him to update this Mac when it suits."", and the row `| "Show me the transcript / Claude's notes / the cut plan" | \`show "<episode>" transcript\` / \`show "<episode>" notes\` / \`show "<episode>" plan\` |`; "showing the transcript, notes or plan" and "checking for a newer brimm-video" leave the "Not ready yet" line. (`runProgram`'s time limit is `limit`, run.js:27; it returns `stdout` only when `out` is given, so run both with `{ limit: 20000, out: 100 }`. The test asserts the stand-in got `limit` 20000 and an `out` above 0.)
- [ ] **Step 4: Run** `node --test tests/edit-show.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "show the transcript, notes or plan, and behind: whether this Mac has the newest brimm-video"`.

### Task 6: `resolve`

**Files:** Modify `tool/edit.js`, `tool/episode.js` (`conflictWhy` ends `Say "sort out the conflict"`, with no full stop: its callers add one; update episode.test.js:178; `{ pastCopies }` on `readEpisode` and `writeEpisode`), `tool/studio/SKILL.md`; Test `tool/tests/edit-resolve.test.js` (new).

**Interfaces:** `resolve "<ep>" [--keep A|B]`. Finds the episode with `findEpisode` (not `episodeFor`: a conflicted record must still be found). Takes the conflicted copies (`conflictedCopies(folder)`), oldest name first, one at a time.

- `of(copy)`: the file it is a copy of: the copy's path with the bracketed conflict words and the space before them taken out (`"record/0008 (Sallie's conflicted copy 2026-10-20).json"` → `"record/0008.json"`). Use the same `CONFLICTED` pattern, exported as `conflictedOf(path)` from episode.js.
- **Without `--keep`:** A is `of(copy)`, B is the copy. For a record (`record/NNNN.json`): say, for each that differs, in plain words: who has it open; the name; the title; each Reel's status; how many cuts and texts; the pushed versions (main and Reels); finished; and each side's `writer.on`. As `A: the record written on <A.writer.on>` / `B: the copy written on <B.writer.on>`. For any other file: each side's size and time. End: `Say which to keep: A or B. <n> more conflicted cop(ies) after this one.` → 0.
- **Order:** record copies first (oldest name first), then the others. `readEpisode` and `writeEpisode` refuse while any conflicted copy is there, so episode.js gains `{ pastCopies: true }` for both (only `resolve` passes it): the newest `record/NNNN.json` is read, and written past, as if the copies were not there.
- **Every `--keep`, in this order:** (1) set aside into `history/<localStamp, file-safe> <basename>` by the rule every file this step will replace or delete, and check each is whole there (size equal); (2) write the record, when the step changes it, with `writeEpisode(…, { expectRev, pastCopies: true })`; (3) only then replace or delete. A refused write changes nothing; nothing is deleted before its copy in `history/` is whole.
- **`--keep A`:** set the copy aside; delete the copy. Say `Kept A. The other is set aside in history/.` → 0.
- **`--keep B`, a record:** set A's file and the copy aside; write B's content as the next record (rev = the highest + 1); delete the copy. A's file **stays in `record/`** (a record file is never deleted: the newest must not drop below the rev this Mac wrote). → 0.
- **`--keep B`, another file:** set A's file and the copy aside; write the record with `files[A's path]` = the copy's size; `replaceIn(copy → A's path)`; delete the copy. → 0.
- No conflicted copy: `There is no conflict in <name>.` → 0.

- [ ] **Step 1: Write the failing tests:** a record conflict shows both sides' differences in plain words and changes nothing; `--keep A` sets the copy aside and leaves no conflicted copy, and the episode reads again; `--keep B` writes B's content as a new record above the highest and sets both aside; a conflicted timeline (`edit/main.v2.mac-studio (Sallie's conflicted copy 2026-10-20).fcpxml`) kept as B replaces the file and updates its size in the record; with a clone stand-in that leaves a short file, nothing is deleted and it says so; **a record copy and a `reels.json` copy together: `--keep B` on the record writes B's record while the reels copy is still there, and the next `resolve` shows the reels copy; a timeline copy and a record copy together: the record copy comes first, and `--keep B` on each leaves both kept**; the CONFLICTED message ends `Say "sort out the conflict".`
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement.** The skill gains the row `| "Sort out the conflict" | \`resolve "<episode>"\`; show her the two sides in plain words; then \`resolve "<episode>" --keep A\` or \`resolve "<episode>" --keep B\` as she picks |`, and "sorting out a conflict" leaves the "Not ready yet" line (which is then empty: delete it).
- [ ] **Step 4: Run** `node --test tests/edit-resolve.test.js tests/episode.test.js tests/studio.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "resolve: show both sides of a conflict, keep the one she picks, and set the other aside in history/"`.

### Task 7: The setup guide, the deploy key's line, and the README

**The guide Jason follows is the lead's doc, "Install BRIMM Video on Sallie's laptop": https://claude.ai/code/artifact/05733dad-f4eb-41a9-8fcc-b123615b97cf** (macOS 26.6 or later first, then Final Cut 12.4; Homebrew and Claude by hand; steps 6 and 7, the deploy key and the installer, written by the architect from this plan; the lock-down check before the first episode). When the build names something differently from the guide, tell the lead or the architect, who edit the doc. The file below is the repo's copy, for the record; where it and the doc differ, the doc wins.

**Files:** Create `docs/setup/sallies-laptop.md`; Modify `CLAUDE.md`, `README.md`.

- [ ] **Step 1:** `CLAUDE.md`: replace "Never read a `.env` file. There are no secrets in this project, and none are added to the repo." with "Never read a `.env` file. The project's one secret is the read-only deploy key on Sallie's laptop, kept only in her `~/.ssh` (never in the repo or Dropbox); Jason revokes it in the repo's GitHub settings when it is no longer needed." Replace the "Open decision" section (DaVinci Resolve) with: "Both Macs use Final Cut Pro (spec, \"What this rests on\")."
- [ ] **Step 2:** `README.md`: in "Episodes", a short "On Sallie's laptop" part: her folder `~/BRIMM Video Studio` and why it allows only edit.js; the new commands that were built (of `release`, `resolve`, `show`, `behind`, `open --take-over`, `push --without-other-macs-changes`) in the command list; the claim in one paragraph. Point to `docs/setup/sallies-laptop.md`.
- [ ] **Step 3:** Write `docs/setup/sallies-laptop.md` with exactly this content (adjust a command's wording only if Tasks 1–6 named it differently). Steps that need a task not built: step 12's hand-over needs Task 4 (without it, step 12 ends at "the Mac Studio has it"); step 13's "sort out the conflict" needs Task 6 (without it, check only that "what's waiting?" names the conflict); "Jason has a newer brimm-video" needs Task 5. Leave out what was not built, and tell the lead which steps changed, so the Doc matches:

```markdown
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
7. **The installer, printed first:** `cd ~/"Claude Code/BRIMM video/tool" && ./install.sh --print --machine "Sallie's laptop" "<path to The BRIMM DB/BRIMM Video>"`. Read every line with her: the drop folder, the programs Homebrew will install (node, ffmpeg, whisper-cpp), the model (about 1.6 GB), Final Cut, Claude's sign-in, her folder for Claude. Then, with your yes, run it again without `--print`. It downloads and installs; it asks "Go ahead?".
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
```

- [ ] **Step 4:** Commit `git commit -m "The setup guide for Sallie's laptop, the deploy key's line in CLAUDE.md, and her part of the README"`.

## After the code: by hand, each with Jason's yes

- Tonight (Builder A, on the Mac Studio, no install): `./install.sh --print --machine "Sallie's laptop" "<a scratch BRIMM Video folder>"` reads right. Then `HOME=<scratch> node tool/settings.js write --machine "Sallie's laptop" --root "<scratch>/BRIMM Video" --checkout "<this worktree>"` and `HOME=<scratch> node tool/settings.js studio --node /opt/homebrew/bin/node`. In `<scratch>/BRIMM Video Studio`, run `claude --permission-mode default` (Manual, as in the desktop app, so the hook and not dontAsk is what refuses) and check: `date`, each bypass command from Task 2's tests, and a read of a file outside the folder are refused with no prompt, and `edit.js episodes` runs. The desktop app's check waits for her laptop (the guide's step 9).
- Tomorrow (Jason, with Sallie): the guide, in order. Its step 9 is the check that her session is locked down in the desktop app; step 11 puts the Mac Studio on the merged code; steps 10, 12 and 13 are phase 1b's three hand checks (one recording finished on her laptop; one handed between the Macs; a conflict made on purpose, ruling 14).
- Later: phase 0's part C on her laptop, once there are templates.

## Self-review

- Spec coverage: section 1 "Picking an episode up" (claim, wait, offline warning, take-over, still arriving, release with files, answers and copies, keep the Mac open) — Tasks 3, 4; conflicts and `resolve` — Task 6; the guard's answers between Macs — Task 4; section 4 her folder, denying settings, `Pictures/`, reading through `show` — Tasks 2, 5; section 6 setup items 1–13 for the laptop — Tasks 1, 7; "Keeping the two Macs the same" — Task 5 (`behind`); the deploy key and CLAUDE.md's line — Task 7; phase 1b's three hand checks — the guide, steps 10, 12 and 13. Left out on purpose: `check` (ruling 13); templates and typefaces (phase 6); phase 0 part C.
- Every Consumes names an existing function at main 40f4969 or one an earlier task produces (`otherMac`, `released(…, { by, answers })`, `claimHeld`, `CLAIM_WAIT_MS`, `conflictedOf`, `studioFiles`, `guardDecision`).
- Review Focus lines each have their test: 1 and 2 in Task 3, 3 in Task 4, 4 in Task 2 (and guide step 9), 5 in Task 6.
```
