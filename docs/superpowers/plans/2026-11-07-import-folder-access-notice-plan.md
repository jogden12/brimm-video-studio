# When macOS stops the import reading a folder: the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When macOS stops the launch agent's node from reading this Mac's drop folder, Episodes in Dropbox, or (after L5) a Downloads export, the import notes it, a banner says it at the Mac, and her chat says it in one plain line with what to allow and where; "look again" starts the import after she allows it.

**Architecture:** A new module, `tool/access.js`, owns a note on this Mac's disk (`access.json`, beside `seen.json`), the bracket around each first touch of a folder, the pure judgement of what to say (`findingOf`) and every sentence. The import (`unedited.js`, `filing.js`) notes each look and posts banners; her chat (`edit.js`, `guide.js`) gathers facts, asks `findingOf`, and says the line in `behind`, the guide, a video's step and `episodes`. The installer prints the note at the end of a setup.

**Tech Stack:** Node 22+, `node:test`, no packages; zsh for `install.sh`.

**Spec:** `docs/superpowers/specs/2026-11-07-import-folder-access-notice-design.md` (version 2)

## Global Constraints

- Tests first: each task's tests are seen failing before its code. `cd tool && node --test` passes whole at each task's end.
- No test calls the real `launchctl`, `osascript`, `plutil` or macOS's privacy control: `deps.kickstart`, `deps.agentRunning`, `deps.agentPid`, `deps.agentNode` and `deps.notify` stand in. A refused folder is made with `tests/watched-fs.js` `watched` (`deny` gives an error with `code` `EPERM` or `EACCES` for `readdirSync`, `statSync` or `existsSync`), or `chmod 0o000` (put back in `finally`) for a real EACCES.
- No file is written in Dropbox or in a watched folder. `access.json` is `join(dirname(seenFile(home)), "access.json")`.
- No line, banner, log line or note names a video by its file: a video is named as `guideDrops` names it (`label`, or `capital(unlabelled(video, size))`).
- The hand-off files, their fixtures and `madeBy` are untouched. `guide.js`'s new words are "Contract touched" (design part 7): the BRIMM Ops session changes its guide page in step at merge time.
- Nothing is installed and no launch agent is changed or used differently: `install.sh` is run only with `--print`, by its tests.
- Before any change to a line `install.sh` prints, the old and new words go to the installer session (`local_d62ac744-1279-4354-a077-967909ed12c8`), which owns the Move to Studio app that reads them (X5).
- Constants: `ASKING_MS = 60 * 1000`, `UNSEEN_MS = 3 * 60 * 1000`, `BANNER_AGAIN_MS = 60 * 60 * 1000`.
- Builders and fixers on Sonnet 5.5; reviewers on Opus 5.5. Jason's yes before the build starts, and again before any merge or push.

## When each task may start

Phase 3 changes every file below but `access.js` (L5 rewrites `importEpisodes`; L1c, L7 and L9 change `edit.js`, `guide.js`, `install.sh` and both skills). So A1 may be built at any time after Jason's yes, and A2 to A7 start from `main` once Phase 3 is merged, one builder at a time, in order. A8 is part of the same run (L5 is in by then).

## Review Focus

1. **A long import is not a refusal.** While one video imports for 20 minutes, a second one dropped meanwhile is not `unseen`, and no banner shows. (A4.)
2. **A note about another folder.** After a switch to a new drop folder, a `refused` note about the old one says nothing. (A4.)
3. **A run killed in its look.** A `looking` left by a run that is gone, or whose pid is now another program's, is not `asking`: only the agent's own pid counts. (A4.)
4. **A Mac whose drop folder is in Dropbox.** `unseen` looks only at this Mac's own folder, never `Drop/<other Mac>`. (A4.)
5. **A local Mac refused only Dropbox.** Drop folder `ok` under `~/BRIMM Video Work/Drop`, Episodes refused: nothing is imported, and her chat says the Dropbox line, not "wait for Ready". (A2, A4, A5.)

---

### Task A1: `access.js`: the note, the bracket, the judgement and the words

**Files:**
- Create: `tool/access.js`
- Test: `tool/tests/access.test.js`

**Interfaces:**
- Produces:
  - `accessFile(home) -> string`; `readAccess(home) -> Note` (`{ version: 1, places: {}, looking: null, told: {} }` when there is none or it cannot be read); `writeAccess(home, note) -> void` (whole: `${file}.writing`, then rename; a throw is passed over).
  - `bracket(place, fn, { home, clock = Date.now, pid = process.pid }) -> fn's result`: writes `looking: { place, pid, at }`, runs `fn`, clears `looking` in a `finally`.
  - `noteState(place, folder, errorOrNull, { home, clock, node = process.execPath }) -> state`: sets `places[place] = { state, code, at, since, folder: resolve(folder), node, okNode }`: `null` → `ok` (code `""`, `okNode = node`); `EPERM` → `refused`; `EACCES` → `locked`; `ENOENT` → `missing`; any other → `error`. `since` is kept while `state` is unchanged; `okNode` is kept, or absent, otherwise.
  - `lookAt(place, folder, opts) -> { names: string[] } | { state, code }`: `bracket` around `readdirSync(folder)`, then `noteState`.
  - `findingOf({ note, now, places, agentPid, missing = false, unseen = [], agentNode = "", needsAccess = false }) -> null | { kind, place?, code?, videos? }`. `places` maps each place to where it is now (`{ drop: "/…", episodes: "/…" }`); a noted place whose `folder` is not there is passed over. Order: `asking` (`note.looking.pid === agentPid`, `now - note.looking.at > ASKING_MS`, `place` = `note.looking.place`); `refused`, `locked`, `error` (first noted place, in the order drop, episodes, downloads); `missing`; `unseen` (`videos` = the caller's list, when not empty); `newNode` (`needsAccess`, an `okNode` set in some place, and `agentNode` not it).
  - `accessLine(finding, { placeWords, switchName, code }) -> string`, `stepLine(finding, …) -> string`, `switchFor(folder, home) -> string` (by the folder's real path), `accessBanner(kind, placeWords) -> string`, `accessLog(state, code, node, placeWords) -> string`, `setupLine(note) -> string`, and the constants `ASKING_MS`, `UNSEEN_MS`, `BANNER_AGAIN_MS`, `LOOK_AT_WORK`, `LOOK_ASKED`: each exactly as the design's Words table.

- [ ] **Step 1: Write the failing tests** in `tests/access.test.js`, each in a fresh temp home:
  - "lookAt lists the folder, notes ok, and leaves no looking": names are the folder's; `places.drop.state === "ok"`, `okNode === node`, `looking === null`.
  - "noteState keeps since and okNode": `ok` at t=1, `EPERM` at t=2 and t=3 → `refused`, `code: "EPERM"`, `since: 2`, `at: 3`, `okNode` the first node; then `EACCES` → `locked`, `since` the new time; a first-ever `EPERM` leaves `okNode` absent.
  - "the bracket is set while fn runs and cleared when it throws": inside `fn`, the note's `looking` is `{ place: "drop", pid, at }`; after `fn` throws, `looking` is `null` and the throw goes on.
  - "lookAt goes on when the note cannot be written": the note's folder is a file → it still gives the names.
  - "findingOf": one `it` per row of the design's table, and: a `looking` with another pid → not `asking`; a refused note for `/old` with `places.drop = "/new"` → `null`; `episodes` refused with `drop` ok → `{ kind: "refused", place: "episodes" }`; `newNode` with no `okNode` anywhere → `null`.
  - "the words are the design's": `accessLine`, `stepLine`, `accessBanner`, `accessLog`, `setupLine` for each kind and place equal the Words table exactly; the unseen line for 1 and for 2 videos; `switchFor` gives `Desktop Folder`, `Documents Folder`, `Downloads Folder`, `the switch for Dropbox` (a real path under `<home>/Library/CloudStorage/Dropbox-x/`, and a `Downloads` link into it), `the switch for iCloud Drive`, and `its switches` for any other.

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/access.test.js`. Expected: FAIL, "Cannot find module '../access.js'".

- [ ] **Step 3: Write `tool/access.js`.** `readdirSync` is imported by name from `node:fs`, so `watched` reaches it.

- [ ] **Step 4: Run them, then the whole suite.** Run: `cd tool && node --test tests/access.test.js && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git add tool/access.js tool/tests/access.test.js && git commit -m "Access: the import's note of each look, and what to say of it (A1)"`

### Task A2: the import notes each look, and stops cleanly when refused

**Files:**
- Modify: `tool/unedited.js` (`uneditedFolders`), `tool/filing.js` (`importEpisodes`, `importWaiting`, `noteSeen`, the call `finishDue(true)`)
- Test: `tool/tests/import-access.test.js` (new, so that Phase 3's tests stay as they are)

**Interfaces:**
- Consumes: A1 `bracket`, `noteState`, `lookAt`, `accessLog`; `settings.js` `episodesFolder`.
- Produces: `noteSeen(home, dir, now, names)`: with `names` given it does not list the folder.

- [ ] **Step 1: Write the failing tests**, in the import world of `tests/filing.test.js` and `tests/unedited.test.js`:
  - "the drop folder's first touch in a run is inside the bracket": with `watched` on `existsSync`, `readdirSync` and `statSync`, at the first call whose path is the drop folder or in it, the note's `looking.place` is `"drop"`.
  - "a folder not there is noted missing": `uneditedFolders` on a drop folder that is not there → `places.drop.state === "missing"`, and the log still says "There is no folder at".
  - "a refused drop folder is noted, logged, and nothing more is read there": `deny` EPERM for `readdirSync` of the drop folder → `refused`; the log holds `accessLog`'s line; `importOne` is never called; no `noteSeen` or `releaseHeld` read of the folder (`watched`'s calls).
  - "every read refused still ends cleanly, the late check put off": `deny` EPERM for every call in the drop folder, with a due pending whose `drop` is in it → `importEpisodes` resolves; the pending is still there; the log holds the put-off line by its label; nothing says "The work on this folder stopped".
  - "Episodes refused on a local Mac: nothing imported" (Review Focus 5): drop folder under `<home>/BRIMM Video Work/Drop` holding a video, `deny` EPERM for `readdirSync` of `<root>/Episodes` → `places.episodes.state === "refused"`, `places.drop.state === "ok"`, `importOne` never called.
  - "an ok look after a refused one clears it".
  - "noteSeen does not list the folder when given the names".

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/import-access.test.js`. Expected: FAIL (no note is written).

- [ ] **Step 3: Make the changes** the design's part 1 lists. `finishDue(true)` gets the same `try` and log line as the timer's call (filing.js 748-753), with the pending's label (`pending.label || "A video"`, never its file). The old log line "The folder could not be read …" goes; a test that pins it changes to the new words here.

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: the import notes each look, and stops cleanly when macOS refuses it (A2)"`

### Task A3: the banners

**Files:**
- Modify: `tool/filing.js` (A2's call sites)
- Test: `tool/tests/import-access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `writeAccess`, `accessBanner`, `BANNER_AGAIN_MS`; `settings.js` `needsFilesAccess`; `deps.notify`; `deps.node || process.execPath`.
- Produces: `told[place] = { key: "<state>|<node>", at }` and `told.newNode = { node, at }`.

- [ ] **Step 1: Write the failing tests** (`notify` collects; the test sets `clock` and `node`):
  - "a refused look posts once, not again within the hour, and again after it": runs at t, t+10 min, t+61 min → posted at the first and third.
  - "a change of state, place or node posts at once": refused then locked → twice; drop refused then episodes refused → twice; node A then node B → twice.
  - "an ok look posts nothing, and the next refusal posts at once".
  - "a new node posts once, before the first look, only when an okNode is known": `okNode` A for `episodes` (under `<home>/Library/CloudStorage/Dropbox-x/…`), a run under node B → `accessBanner("newNode")` posted before the first `readdirSync`, once over two runs; with no `okNode` → not posted; with every noted place under `<home>/BRIMM Video Work` → not posted.

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/import-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Add the banners** at A2's call sites.

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: a banner when the import cannot look (A3)"`

### Task A4: her chat's reader, and `behind`

**Files:**
- Modify: `tool/edit.js` (new `accessFinding(ctx)`, `agentPid()`, `agentNode()`; `behind`; the ctx's `agentPid`, `agentNode`)
- Test: `tool/tests/behind-access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `findingOf`, `accessLine`, `switchFor`, `UNSEEN_MS`; `settings.js` `dropFolderOf`, `needsFilesAccess`, `folderWords`, `readSeen`, `seenKey`, `runsFolder`; `run.js` `lockFile`, `isRunning`; the statuses as Phase 3 leaves them (`ctx.statusFolders`).
- Produces:
  - `agentPid() -> number | null` (the `pid = N` of `launchctl print gui/<uid>/com.thebrimm.unedited`); `agentRunning()` becomes `agentPid() !== null`. ctx: `agentPid: deps.agentPid || agentPid`.
  - `agentNode() -> string`: the real path of the plist's `ProgramArguments.0` (`/usr/bin/plutil -extract ProgramArguments.0 raw -o - <plist>`, then `realpathSync`), or `""`. ctx: `agentNode: deps.agentNode || agentNode`.
  - `accessFinding(ctx) -> null | { finding, line, step }`. `missing` is her chat's own `existsSync` of this Mac's drop folder. `unseen` is gathered only when no run is at work (`ctx.agentPid()` null, and the drop folder's lock, `lockFile(drop, runsFolder(home))`, holds no live pid): each media file directly in this Mac's own drop folder (a folder her chat cannot read gives none), older than `UNSEEN_MS` by ctime, named by no status of this Mac, not noted in `seen.json`, and with no `ok` drop look in the note whose `at` is after its ctime.

- [ ] **Step 1: Write the failing tests** (the note written by the test with A1's `writeAccess`):
  - "behind says each finding's line last, whatever git answered": one `it` per kind; with the lock refused first, nothing of it is said.
  - "behind asks the agent to look for a new node when no run is at work": `newNode`, `agentPid: () => null` → `kickstart` once; a run at work → not; any other kind → not; `kickstart` throws → the line is still said.
  - "says nothing of a video dropped while a run is at work" (Review Focus 1): unseen video 10 minutes old, `agentPid: () => 4242` → no line; the same with `agentPid: () => null` and the lock holding the test's own live pid → no line.
  - "says unseen for a video the import never took, and counts them": `agentPid: () => null`, a 4-minute-old video of 5 bytes, no seen entry, no status → the unseen line for 1; two such → for 2; with a seen entry, a status of this Mac (held or failed), an `ok` drop look after its ctime, or 2 minutes old → no line.
  - "never looks in another Mac's drop folder" (Review Focus 4).
  - "asking only for the agent's own pid" (Review Focus 3).
  - "passes over a note whose folder is not where its place is now" (Review Focus 2).
  - "a local Mac refused only Dropbox says the Dropbox line" (Review Focus 5).
  - "missing: says the drop folder is not there".

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/behind-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Add `agentPid`, `agentNode`, `accessFinding`, and `behind`'s line and kickstart** (design part 3, item 1).

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: her chat says when the import cannot look (A4)"`

### Task A5: the guide, a video's step and `episodes`

**Files:**
- Modify: `tool/edit.js` (`guideDrops`, `episodes`, the guide's overview call), `tool/guide.js` (`dropNext`, `overviewLines`)
- Test: `tool/tests/edit-guide-access.test.js`, `tool/tests/guide.test.js`

**Interfaces:**
- Consumes: A4 `accessFinding`; Phase 3's `overviewLines({ drop, items, old, unreadable })` and `dropUnreadable` (L1c).
- Produces: a drop `state` of `"blocked"` with `drop.blocked` (the step line); `overviewLines({ …, access })`, `access` a line or `""`.

- [ ] **Step 1: Write the failing tests:**
  - `guide.test.js` "the import's line comes after her chat's own, and then nothing tells her to put a video in": `overviewLines({ drop: "D", items: [], old: 0, unreadable: true, access: "X" })` is `["Your drop folder: D", dropUnreadable("D"), "X"]`; with `unreadable: false` it is `["Your drop folder: D", "X"]`; with `access: ""` it is as Phase 3 left it.
  - `guide.test.js` "a blocked video's step is its line, and is not coming": `dropNext({ here: true, state: "blocked", blocked: "X" }, "")` gives `toDo("blocked", "X")`; `COMING` does not hold `"blocked"`.
  - `edit-guide-access.test.js`: for `refused` (drop, and episodes alone), `asking`, `locked`, `error`: `guide` says the line under the drop folder's line, and each arriving video of this Mac has the step line; `guide wait` answers at once; `episodes` says the line once, before "On this Mac:". For `unseen`: only the unseen video's step changes. For `newNode`: `guide` and `episodes` say nothing of it. The other Mac's videos keep "It is in the drop folder of …".

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/guide.test.js tests/edit-guide-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Make the changes.** Grep `guide.js` and `edit.js` for every list of drop states and stages (`"arriving"`, `COMING`, `ordered`, `guide wait`'s comparison) and give `"blocked"` its place beside `"arriving"` in each. In the commit message, "Contract touched: guide.js's blocked step and the overview's access line (BRIMM Ops guide page, in step)".

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: the guide and episodes say the import's line; a blocked video waits for nothing (A5)"`

### Task A6: `look`, and her skill's words

**Files:**
- Modify: `tool/edit.js` (`look`, `COMMANDS`), `tool/studio/SKILL.md`, `tool/studio/SKILL-open.md`, `README.md` (her commands)
- Test: `tool/tests/edit-look.test.js`, `tool/tests/studio.test.js`

**Interfaces:**
- Consumes: A1 `LOOK_AT_WORK`, `LOOK_ASKED`; A4 `accessFinding`; `ctx.kickstart`, `ctx.agentPid`.
- Produces: `look(ctx) -> 0 | 1`.

- [ ] **Step 1: Write the failing tests:**
  - `edit-look.test.js`: `asking` → says its line, no kickstart, ends 0; a run at work → `LOOK_AT_WORK`, no kickstart, ends 0; none → kickstart once, `LOOK_ASKED`, ends 0; kickstart throws → `retry`'s could-not line for the agent, ends 1.
  - `studio.test.js`, for each of `SKILL.md` and `SKILL-open.md`: "At the start of each session" tells her to pass on `behind`'s line about node, her drop folder or Dropbox as it is said; "What she says, and what to run" maps "look again" and "I allowed it" to `look`; each chat line of the design is in "Guide her" exactly once, after L1c's line for her chat's own refusal.

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/edit-look.test.js tests/studio.test.js`. Expected: FAIL.

- [ ] **Step 3: Add `look` and the skill's lines.** If her folder's allow rules or guard name `edit.js` commands one by one, `look` joins them (`studio/allow.json`, `studio/guard.mjs`, with a `tests/guard.test.js` case).

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: look again, and her skill's words (A6)"`

### Task A7: the setup prints what macOS answered

**Files:**
- Modify: `tool/install.sh` (after the check of Claude, a call that prints `setupLine`), `tool/access.js` (a command-line entry `node access.js --setup-line`, printing `setupLine(readAccess(home))`)
- Test: `tool/tests/install.test.js`, `tool/tests/access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `setupLine`.

- [ ] **Step 0: Send the words first.** Send the installer session the new real-run line(s) and, if L9 left the `--print` "Files and Folders:" line naming node once, the proposed words; build with the words it accepts.
- [ ] **Step 1: Write the failing tests:** `access.test.js`: `--setup-line` with a note of both places `ok` prints the ok line; with episodes refused, the refused line; with a `looking` of a live pid, the asking line; with no note, "  Files and Folders, at the end:  the import has not looked yet." `install.test.js` (`--print` only): what `--print` says is unchanged but for the accepted words.
- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/access.test.js tests/install.test.js`. Expected: FAIL.
- [ ] **Step 3: Add the entry and the installer's call** (after `drop_check`, so after the import's `RunAtLoad` run has had its 90 seconds).
- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Access: the setup prints what macOS answered the import (A7)"`

### Task A8: Downloads

**Files:**
- Modify: L5's late check of a `final` pending (its stat and delete of a Downloads export), `tool/edit.js` `accessFinding`
- Test: L5's late-check test file (C6b's world), a new `it`

**Interfaces:**
- Consumes: A1 `noteState("downloads", downloadsFolder(home), error)`, A3's banner rule, A4.

- [ ] **Step 1: Write the failing tests:** C6b's world with `watched` refusing (EPERM) the export's `statSync` → `places.downloads.state === "refused"`; the Downloads banner once; the export kept (L5's rule); `behind` says the Downloads line, with "the switch for Dropbox" when Downloads is a link into `<home>/Library/CloudStorage/Dropbox-x/`; a later delete that works → `ok`, and the line is gone.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Call `noteState` from L5's stat and delete** (an error, or `null` on success); add `downloads` to `accessFinding`'s `places`.
- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Access: the late check notes and says when it cannot touch Downloads (A8)"`

## After the build

- One Opus review of the whole branch, then a draft PR on Jason's yes.
- The BRIMM Ops session's in-step sentence on its guide page (design part 7), at merge time.
- By-hand checks B1 and B2 (design) go on the Studio By-Hand Checks page through the coordinator. B2's switch labels may change `switchFor`'s words: a one-line change with its test.
