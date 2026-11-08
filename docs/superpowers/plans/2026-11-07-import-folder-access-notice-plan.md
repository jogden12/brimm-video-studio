# When macOS stops the import reading a folder: the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When macOS stops the launch agent's node from reading this Mac's drop folder, Episodes in Dropbox, or (after L5) a Downloads export, the import notes it, a banner says it at the Mac, and her chat says it in one plain line with what to allow and where; "look again" starts the import after she allows it.

**Architecture:** A new module, `tool/access.js`, owns a note on this Mac's disk (`access.json`, beside `seen.json`), the bracket around each first touch of a folder, the pure judgement of what to say (`findingOf`) and every sentence. The import (`unedited.js`, `filing.js`) notes each look and posts banners; her chat (`edit.js`, `guide.js`) gathers facts, asks `findingOf`, and says the line in `behind`, the guide, a video's step and `episodes`. The installer prints the note at the end of a setup.

**Tech Stack:** Node 22+, `node:test`, no packages; zsh for `install.sh`.

**Spec:** `docs/superpowers/specs/2026-11-07-import-folder-access-notice-design.md` (version 3, 7 November 2026, after Phase 3 merged)

## Global Constraints

- Tests first: each task's tests are seen failing before its code. `cd tool && node --test` passes whole at each task's end.
- No test calls the real `launchctl`, `osascript`, `plutil` or macOS's privacy control: `deps.kickstart`, `deps.agentRunning`, `deps.agentPid`, `deps.agentNode` and `deps.notify` stand in. A refused folder is made with `tests/watched-fs.js` `watched` (`deny` gives an error with `code` `EPERM` or `EACCES`, for `readdirSync`, `statSync`, `opendirSync` or `readFileSync`; never for `existsSync`, which the real one never throws, so a test would crash the run instead of simulating macOS: "all reads refused" denies the four and lets `existsSync` answer), or `chmod 0o000` (put back in `finally`) for a real EACCES.
- No file is written in Dropbox or in a watched folder. `access.json` is `join(dirname(seenFile(home)), "access.json")`.
- No line, banner, log line or note names a video by its file: a video is named as `guideDrops` names it (`label`, or `capital(unlabelled(video, size))`).
- The hand-off files, their fixtures and `madeBy` are untouched. `guide.js`'s new words are "Contract touched" (design part 7): the BRIMM Ops session changes its guide page in step at merge time.
- Nothing is installed and no launch agent is changed or used differently: `install.sh` is run only with `--print`, by its tests.
- Before any change to a line `install.sh` prints, the old and new words go to the installer session (`local_d62ac744-1279-4354-a077-967909ed12c8`), which owns the Move to Studio app that reads them (X5).
- Constants: `ASKING_MS = 60 * 1000`, `UNSEEN_MS = 3 * 60 * 1000`, `BANNER_AGAIN_MS = 60 * 60 * 1000`, `DOWNLOADS_SAY_MS = 24 * 60 * 60 * 1000`.
- Line references (`file:line`) are main 565150f's, from `.superpowers/sdd/2026-11-07-import-folder-access-notice-plan/plan-vs-main.md`.
- Builders and fixers on Sonnet 5.5; reviewers on Opus 5.5. Jason's yes before the build starts, and again before any merge or push.

## When each task may start

Phase 3 is merged (main 565150f). The build runs from branch `claude/studio-import-access-notice`, which holds the design commit, in order, one builder at a time: A1 (already built: `tool/access.js` and `tool/tests/access.test.js` exist), then A2 to A8. Run each task's whole suite before the next starts; A8 follows A2's, since both change `filing.js` (`finishDue` and `checkFinal` do not overlap by line).

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
  - `accessLine(finding, { placeWords, switchName, code }) -> string`, `stepLine(finding, …) -> string`, `switchFor(folder, home) -> string` (by the folder's real path), `accessBanner(kind, placeWords) -> string`, `accessLog(state, code, node, placeWords) -> string`, `setupLine(note, { home, now, alive }) -> string` (see "Changes after Phase 3" below), and the constants `ASKING_MS`, `UNSEEN_MS`, `BANNER_AGAIN_MS`, `LOOK_AT_WORK`, `LOOK_ASKED`: each exactly as the design's Words table.

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

**Changes after Phase 3** (A1 is built; its finished steps stand, and these are added to it, tests first, in a follow-up commit "Access: setupLine's options and stepLine for Downloads (A1)"):
- `setupLine(note, { home = studioHome(), now = Date.now(), alive })`: `home` is for the place words, and `studioHome()` (`home.js:21`) matches every other command. A `looking` whose pid is not alive is passed over (the places are used); a live `looking` under `ASKING_MS` old gives `  Files and Folders, at the end:  the import is still looking; if a box asks whether "node" may look in a folder, choose Allow.`; a live one older gives the asking setup words. No wait is added to `install.sh`.
- `stepLine` gives `""` for a finding whose place is `downloads`. (Already as built: `findingOf`'s newNode needs `agentNode !== ""`; `switchFor` uses `realOf`.)
- Also in `access.js`: a banner rule, `postIfDue(place, note, { notify, clock, node, placeWords })`, reading and writing `told`, with A3's tests; and the `DOWNLOADS_SAY_MS` constant.
- `accessLine`'s `placeWords` for her chat come from `guide.js:24` `dropWords(settings, machine, home)`; the import's `folderWords` (`settings.js:492`) is the fallback, since `tests/checks-world.js` deps carry no settings.

### Task A2: the import notes each look, and stops cleanly when refused

**Files:**
- Modify: `tool/unedited.js` (`uneditedFolders`, `1566`), `tool/filing.js` (`importEpisodes` `1622`, `importWaiting` `1743`, `noteSeen` `1928`, `finishDue` `1677-1735`)
- Modify (a Phase 3 test): `tool/tests/unedited.test.js:2939-2959`
- Test: `tool/tests/import-access.test.js` (new), built on `tests/checks-world.js` (`world` `23`, `runs` `42`, `run` `65`, `holdImport` `99`), because the import worlds of `tests/filing.test.js` and `tests/unedited.test.js` are private. For the `uneditedFolders` cases add `settings: { version: 1, machine: MAC, root: w.root, checkout: "/c", drop: "Drop", dropPath: <drop> }` and `home: w.home`; for Review Focus 5 the drop is under `<home>/BRIMM Video Work/Drop`.

**Interfaces:**
- Consumes: A1 `bracket`, `noteState`, `lookAt`, `accessLog`; `settings.js` `episodesFolder`.
- Produces: `noteSeen(home, dir, now, names)`: with `names` given it does not list the folder, and its prune is guarded. The 3-argument callers stay (`filing.js:1744`, `tests/edit-guide.test.js:374,376,583`, `tests/unedited.test.js:2359,2361,2384,2397,2410`). `accessLog` falls back to `folderWords` for place words, as `checks-world` deps have no settings.

- [ ] **Step 1: Write the failing tests** (the denials are `readdirSync`, `statSync`, `opendirSync`, `readFileSync` in the folder; `existsSync` is never denied):
  - "the drop folder's first touch in a run is inside the bracket": at the first `existsSync` whose path is the drop folder (`unedited.js:1571`) the note's `looking.place` is `"drop"`; old-mode folders are not bracketed.
  - "a folder not there is noted missing, in both branches": `uneditedFolders` on a drop folder that is not there → `places.drop.state === "missing"`; the log still says "There is no folder at" (`1572`); on a local Mac the late checks still run (the case pinned at `tests/unedited.test.js:3358-3378` still passes).
  - "a refused drop folder is noted, logged, and nothing more is read there": `deny` EPERM for `readdirSync` of the drop folder → `refused`; the log holds `accessLog`'s line; `importOne` is never called; no `noteSeen` or `releaseHeld` read of the folder (`watched`'s calls).
  - "every read refused still ends cleanly, the late check put off": all reads in the drop folder refused, with a due pending whose `drop` is in it → `importEpisodes` resolves; the pending is still there; the log holds `<label>: its check could not be made (<code>). The next run makes it again.` by `pending.label || "A video"`; nothing says "The work on this folder stopped".
  - "Episodes refused on a local Mac: nothing imported" (Review Focus 5): drop folder under `<home>/BRIMM Video Work/Drop` holding a video, `deny` EPERM for `readdirSync` of `<root>/Episodes` → `places.episodes.state === "refused"`, `places.drop.state === "ok"`, `importOne` never called.
  - "Episodes missing is imported as today": no `<root>/Episodes` (as the `episodic()` world has it) → noted `missing`, the import goes on and makes it.
  - "an ok look after a refused one clears it"; an `ok` look writes `at` on every `importWaiting` look too.
  - "noteSeen does not list the folder when given the names".

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/import-access.test.js`. Expected: FAIL (no note is written).

- [ ] **Step 3: Make the changes** the design's part 1 lists:
  - `uneditedFolders`: bracket the `existsSync` only when `episodeMode(folder, deps.settings, home)`; note `missing` in both branches.
  - `importEpisodes`: the first-thing looks go before `finishDue(true)` (`1830`). Stop only on `refused`, `locked`, `error`; Episodes `missing` is noted and the import goes on. Leave `unedited.js:539-547` as the backstop.
  - `finishDue`: the import branch (`1715-1729`) gets the kind branch's try (`1704-1710`) around `settleReading` + `finishLate`, after `checked.add` (`1728`), with `pending.label || "A video"`, never `who`. One guard covers `1830`, `1867` and the timer (`1793-1797`).
  - `importWaiting`: `lookAt("drop", dir)` first; only on `ok` call `noteSeen(home, dir, now, names)` and `releaseHeld`; keep the silent return for a folder not there. Change only the line at `filing.js:1763`; leave `unedited.js:1545` and its test (`tests/unedited.test.js:871`).
  - Change `tests/unedited.test.js:2939-2959` (Episodes `chmod 0o000` for the second drop): it expected `results.length > 0`, each `{ ok: false, arriving: true }`, and "Episodes could not be read"; it now expects `results` to be `[]` and the log to hold `accessLog`'s locked line. Say so in the commit.

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: the import notes each look, and stops cleanly when macOS refuses it (A2)"` (the message names the changed Phase 3 test).

### Task A3: the banners

**Files:**
- Modify: `tool/unedited.js` (the once-per-node banner, in `uneditedFolders` before its `existsSync` at `1571`, for the episode drop folder only), `tool/filing.js` (A2's call sites), `tool/access.js` (the banner rule `postIfDue`, which A8 reuses)
- Test: `tool/tests/import-access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `writeAccess`, `accessBanner`, `BANNER_AGAIN_MS`; `settings.js` `needsFilesAccess` (`469-486`, not widened); `deps.notify` (`unedited.js:1655` `depsFor` gives `notify: banner`; `tests/checks-world.js:56` collects `notices`); `deps.node || process.execPath`.
- Produces: `told[place] = { key: "<state>|<node>", at }` and `told.newNode = { node, at }`; `access.js` `postIfDue(place, note, { notify, clock, node, placeWords })`. Place `downloads` counts as needing access always. The hourly rule reads `told` from the note each time, never from run memory, since `importWaiting` looks every `LOOK_AGAIN_MS` (`filing.js:1609`).

- [ ] **Step 1: Write the failing tests** (`notify` collects; the test sets `clock` and `node`):
  - "a refused look posts once, not again within the hour, and again after it": runs at t, t+10 min, t+61 min → posted at the first and third.
  - "a change of state, place or node posts at once": refused then locked → twice; drop refused then episodes refused → twice; node A then node B → twice.
  - "an ok look posts nothing, and the next refusal posts at once".
  - "a new node posts once, before the first touch, only when an okNode is known": `okNode` A for `episodes` (under `<home>/Library/CloudStorage/Dropbox-x/…`), a run under node B → `accessBanner("newNode")` posted before the first `existsSync` whose path is the drop folder, once over two runs; with no `okNode` → not posted; with every noted place under `<home>/BRIMM Video Work` → not posted; a noted `downloads` place with an `okNode` → posted.

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/import-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Add the banners** at A2's call sites, and the new-node banner in `uneditedFolders`; put the rule in `access.js`.

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: a banner when the import cannot look (A3)"`

### Task A4: her chat's reader, and `behind`

**Files:**
- Modify: `tool/edit.js` (new `accessFinding(ctx)`, `agentPid()`, `agentNode()`; `contextFor` `378-418`; `behind` `2739-2781`; the import at `105`)
- Modify: `tool/tests/episodes.js` (beside `109`: `agentPid: () => null, agentNode: () => ""`)
- Test: `tool/tests/behind-access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `findingOf`, `accessLine`, `switchFor`, `UNSEEN_MS`; `filing.js` `readSeen` `1916`, `seenKey` `1912` (already imported by `edit.js:77`); `settings.js` `dropFolderOf`, `needsFilesAccess`, `isLocal` (`78`), `runsFolder`; `run.js` `lockFile` (`89`; add it to the import at `edit.js:105`) and the pid checked with `ctx.alive` (`edit.js:410`), not `isRunning`; the statuses through `ctx.statusFolders` (`edit.js:397`), read with `readStatusesIn(statusReadFolders(ctx), ctx.now())` (`filing.js:444`) as `episodes` does (`edit.js:1094`); `guide.js` `dropWords` for her chat's place words.
- Produces:
  - `agentPid() -> number | null` (the `pid = N` of `launchctl print gui/<uid>/com.thebrimm.unedited`, beside `agentRunning` `1682-1685`). `contextFor`: `agentPid: deps.agentPid || (deps.agentRunning ? () => (deps.agentRunning() ? -1 : null) : agentPid)`; `agentNode: deps.agentNode || (deps.agentRunning ? () => "" : agentNode)`. About 60 test files build deps with neither, so no test reaches the real `launchctl` or `plutil`. `agentPid` is called only when `looking` is set or an unseen candidate is found; `agentNode` only when an `okNode` is noted and a place needs access.
  - `agentNode() -> string`: the real path of the plist's `ProgramArguments.0`, read at `join(ctx.home, "Library", "LaunchAgents", AGENT + ".plist")` (`install.sh:88`, `351-353`), never `os.homedir()`; `""` on any failure (and `""` is never a new node).
  - `accessFinding(ctx) -> null | { finding, line, step }`. `missing` is said only on a Mac with a drop folder of its own (`isLocal`): her chat's `existsSync` of it; grep `dropPath` in `tests/edit-*.test.js`, `explainer`, `footage-local`, `join-local`, `old-episodes-after-switch` for local worlds that make no Drop (`tests/episodes.js:42-47` makes none; `behind`, `episodes` and the guide overviews are pinned word for word, `tests/fixtures/today-says.json:168`). `unseen` is gathered only when no run is at work (`ctx.agentPid()` null, and the lock `lockFile(drop, runsFolder(home))`, whose text is the pid, holds no live pid by `ctx.alive`): each media file directly in this Mac's own drop folder, older than `UNSEEN_MS` by ctime, named by no status of this Mac, not noted in `seen.json`, and with no `ok` drop look whose `at` is after its ctime. `downloads` always counts as needing access; it is said only while its note's `at` is within `DOWNLOADS_SAY_MS`.
  - `behind`: the line is said in `folderLine` (`2761-2769`) after the `added` line (`2767`), before `return 0`; the `newNode` kickstart is made there too. The lock's refusal (`2742-2743`) returns before it.

- [ ] **Step 1: Write the failing tests** (the note written by the test with A1's `writeAccess`; ages are made by setting the ctx clock to `statSync(file).ctimeMs + 4 * 60000`, and `+ 2 * 60000` for the too-young case, since ctime cannot be set and the test clocks are fixed past dates):
  - "behind says each finding's line last, whatever git answered": one `it` per kind; with the lock refused first, nothing of it is said.
  - "behind asks the agent to look for a new node when no run is at work": `newNode`, `agentPid: () => null` → `kickstart` once; a run at work → not; any other kind → not; `kickstart` throws → the line is still said; `agentNode: () => ""` → no `newNode`.
  - "says nothing of a video dropped while a run is at work" (Review Focus 1): unseen video 10 minutes old, `agentPid: () => 4242` → no line; the same with `agentPid: () => null` and the lock holding the test's own live pid, with its own `alive` (`tests/episodes.js:106` sets `alive: () => false`) → no line.
  - "says unseen for a video the import never took, and counts them": `agentPid: () => null`, a video of 5 bytes at ctime + 4 minutes, no seen entry, no status → the unseen line for 1; two such → for 2; with a seen entry, a status of this Mac (held or failed), an `ok` drop look after its ctime, or at ctime + 2 minutes → no line.
  - "never looks in another Mac's drop folder" (Review Focus 4).
  - "asking only for the agent's own pid" (Review Focus 3).
  - "passes over a note whose folder is not where its place is now" (Review Focus 2).
  - "a local Mac refused only Dropbox says the Dropbox line" (Review Focus 5).
  - "missing: says the drop folder is not there" on a Mac with a drop folder of its own; a Dropbox Mac's missing drop folder says nothing.
  - "no real launchctl or plutil": deps with neither stand-in reach neither.

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/behind-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Add `agentPid`, `agentNode`, `accessFinding`, and `behind`'s line and kickstart** (design part 3, item 1).

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: her chat says when the import cannot look (A4)"`

### Task A5: the guide, a video's step and `episodes`

**Files:**
- Modify: `tool/edit.js` (`guideDrops` `6496-6537` and its state at `6517`; `guideItems` `6561-6599`; `sayOverview` `6699-6702`; `waitForChange` `6711-6726`; `episodes` `1076`; the doc line `6486`), `tool/guide.js` (`dropNext` `293`, `trailOf` `633`, `overviewLines` `587`; doc line `163`)
- Test: `tool/tests/edit-guide-access.test.js`, `tool/tests/guide.test.js`

**Interfaces:**
- Consumes: A4 `accessFinding` (computed once per guide pass: `guide wait` reads every 5 s); `overviewLines({ drop, items, old, unreadable = false, local = false })` and `dropUnreadable` (L1c).
- Produces: a drop `state` of `"blocked"` with `drop.blocked` (the step line), only when the finding's place is `drop` or `episodes`; `overviewLines({ …, access })`, `access` a line or `""`; `guideItems` passes `access` on. With `access` set, `overviewLines` leaves out both `NOTHING_UNDER_WAY` (`232`) and `AIRDROP` (`235`). `dropNext` gets its `blocked` branch before the Zoom fall-through (`305`); `blocked` is left out of `COMING` (`615`), given a place in `trailOf` (`633`: a blocked video may still be copying in) and in the docs (`guide.js:163`, `edit.js:6486`). Check the other lists of drop states: `guide.js:297`, `298`, `303`, `643` (`follow`: `retry`), `670` (`told`'s `on()`), `edit.js:6716` (`guide wait`).

- [ ] **Step 1: Write the failing tests:**
  - `guide.test.js` "the import's line comes after her chat's own, and then nothing tells her to put a video in": `overviewLines({ drop: "D", items: [], old: 0, unreadable: true, access: "X" })` is `["Your drop folder: D", dropUnreadable("D"), "X"]`; with `unreadable: false` it is `["Your drop folder: D", "X"]`; with `access: ""` it is as Phase 3 left it; and with `local: true` and `access: "X"` neither `NOTHING_UNDER_WAY` nor `AIRDROP` is in it.
  - `guide.test.js` "a blocked video's step is its line, and is not coming": through `nextFor({ ...BASE, drop: { here: true, state: "blocked", blocked: "X" } }, NONE, NOW)` (`dropNext` and `toDo` are private, `nextFor` is `520`) deep-equals `{ done: false, stage: "blocked", text: "X", step: "", after: "" }`; `COMING` does not hold `"blocked"`; `trailOf` counts a blocked video that is still growing.
  - `edit-guide-access.test.js`: for `refused` (drop, and episodes alone), `asking`, `locked`, `error`: `guide` says the line under the drop folder's line, and each arriving video of this Mac has the step line; `guide wait` answers at once; `episodes` says the line once, right after L1c's line and before "Imports:". For `unseen`: only the unseen video's step changes. For `newNode`: `guide` and `episodes` say nothing of it. For `downloads` (refused, note within a day): `behind` and `episodes` say it, but no drop video is blocked and the overview still says "Nothing is under way" and the AirDrop line. The other Mac's videos keep "It is in the drop folder of …".

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/guide.test.js tests/edit-guide-access.test.js`. Expected: FAIL.

- [ ] **Step 3: Make the changes.** `stepLine` gives `""` for `downloads`, so the filter by place is in `guideDrops` too. In the commit message, "Contract touched: guide.js's blocked step and the overview's access line and two left-out lines (BRIMM Ops guide page, in step)".

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: the guide and episodes say the import's line; a blocked video waits for nothing (A5)"`

### Task A6: `look`, and her skill's words

**Files:**
- Modify: `tool/edit.js` (`look`; `COMMANDS` `6958`, `COMMAND_NAMES` `6960`, `HELP` `130` beside retry `221` and behind `277`, the top comment `20`), `tool/gate.js` (`UNSCOPED`, `14`), `tool/studio/SKILL.md` (after L1c's line `89`; "What she says, and what to run", retry row `129`; "At the start of each session" `12-14`), `tool/studio/SKILL-open.md` (`83`, `123`, `12-16`), `README.md` (the word at `21`; a `look` row after `231`)
- Test: `tool/tests/edit-look.test.js`, `tool/tests/studio.test.js`, and the tables that walk the commands: `tests/gate.test.js:68,184,251`, `tests/edit-gate.test.js:67`, `tests/edit-labels.test.js:85` (`TODAY_ASKED`), `1219` (`walkWords`), `1427` (inline map), and `tests/fixtures/today-says.json` (regenerate with `UPDATE_TODAY=1`)
- No change: `studio/allow.json`, `studio/guard.mjs`, `tests/guard.test.js` (they list skills and tools, not commands).

**Interfaces:**
- Consumes: A1 `LOOK_AT_WORK`, `LOOK_ASKED`; A4 `accessFinding`; `ctx.kickstart`, `ctx.agentPid`.
- Produces: `look(ctx) -> 0 | 1`; `look` in `UNSCOPED` (it names no episode; `open-lock.js:78` `HELD_COMMANDS` derives from it).

- [ ] **Step 1: Write the failing tests:**
  - `edit-look.test.js`: `asking` → says its line, no kickstart, ends 0; a run at work → `LOOK_AT_WORK`, no kickstart, ends 0; none → kickstart once, `LOOK_ASKED`, ends 0; kickstart throws → `retry`'s could-not line for the agent (`edit.js:2024`, and `1933` in `lateCheckOwed`), ends 1.
  - The command tables above name `look` (they fail until `gate.js` and `COMMANDS` have it).
  - `studio.test.js`, for each of `SKILL.md` and `SKILL-open.md`, by clauses, not by each design line: one or two bullets after L1c's line in "Guide her" say to pass on what `behind`, the guide or `episodes` says of the import, node or Dropbox as it is said, and to run `look` when she says "look again" or "I allowed it"; "What she says, and what to run" maps those words to `look`; "Guide her" stays within its 30 lines (`1551`, `1566`) and no new bullet starts with L1c's prefix (`1546`).

- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/edit-look.test.js tests/studio.test.js tests/gate.test.js`. Expected: FAIL.

- [ ] **Step 3: Add `look`, its place in `COMMANDS`, `COMMAND_NAMES`, `HELP`, the top comment and `UNSCOPED`, the skill's bullets and the README row.**

- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Access: look again, and her skill's words (A6)"`

### Task A7: the setup prints what macOS answered

**Files:**
- Modify: `tool/install.sh` (a call after the check block, after `1052` and before `1054`, inside `[[ -n "$machine" ]]`; not inside it, since `drop_check` at `1049` is pinned there by `tests/install.test.js:423`), `tool/access.js` (a command-line entry `node access.js --setup-line`, printing `setupLine(readAccess(home), { home: studioHome() })`, behind the `process.argv[1] === fileURLToPath(import.meta.url)` guard as `unedited.js:1769` and `edit.js:7011` have it, since `tests/load-each.test.js` imports every `tool/*.js` alone)
- Test: `tool/tests/install.test.js`, `tool/tests/access.test.js`

**Interfaces:**
- Consumes: A1 `readAccess`, `setupLine` (with its options, A1's "Changes after Phase 3"). No wait is added: the check stops as soon as Claude answers, and there is none with `--rules-only` or without Claude Code, so the line judges the `looking` it finds.

- [ ] **Step 0: Send the words first.** Send the installer session (`local_d62ac744`) the new real-run lines (the ok, not-looked-yet, still-looking and refused/locked/asking lines, all starting "  Files and Folders, at the end:") and, if L9 left the `--print` "Files and Folders:" line (`install.sh:687`, pinned by `tests/install.test.js:2025`, naming node twice) as it is, say so; change it only if that session asks. The Move app (`move-app/move.zsh:833`) reads only the last `^From the background job:` line and keeps the last 8 lines on a failure (`827`), so a new line beginning "  Files and Folders, at the end:" breaks neither. Build with the words it accepts.
- [ ] **Step 1: Write the failing tests:** `access.test.js`: `--setup-line` with a note of both places `ok` prints the ok line; with episodes refused, the refused line; with a `looking` of a live pid under a minute old, the still-looking line; with one older, the asking line; with one whose pid is not alive, the places' line; with no note, "  Files and Folders, at the end:  the import has not looked yet."; the module loads alone. `install.test.js` (`--print` only): what `--print` says is unchanged but for the accepted words.
- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/access.test.js tests/install.test.js`. Expected: FAIL.
- [ ] **Step 3: Add the entry and the installer's call** (after the check block's `fi`, `install.sh:1052`).
- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Access: the setup prints what macOS answered the import (A7)"`

### Task A8: Downloads

**Files:**
- Modify: `tool/filing.js` `checkFinal` (`1307-1452`): the catch at `1447-1449` ("could not be looked at or taken out of Downloads (`<code>`) …") gets `noteState("downloads", downloadsFolder(home), err)` and the banner rule `postIfDue`; the success after `rmSync` (`1445`) gets `noteState("downloads", …, null)`. `downloadsFolder` is `settings.js:62`, already imported at `filing.js:19`. `tool/edit.js` `accessFinding`: `downloads: downloadsFolder(home)` in `places`.
- Test: the import half in `tool/tests/checks-behind.test.js` (describe `1040`, C6b `1137-1150`, world `tests/checks-world.js`, `holdFinal` `152`, export at `<home>/Downloads/Talk main.mp4`), with `watched` denying `statSync` of `h.exportPath` (`filing.js` imports `statSync` by name); the `behind` half in `tool/tests/behind-access.test.js` (A4's world), with the note written by `writeAccess`, since `checks-world.js` has no `edit.js` ctx.

**Interfaces:**
- Consumes: A1 `noteState`; A3's `postIfDue` (in `access.js`); A4 `accessFinding` and `DOWNLOADS_SAY_MS`.

- [ ] **Step 1: Write the failing tests:** (a) in `checks-behind.test.js`, C6b's world with `watched` refusing (EPERM) the export's `statSync` → `places.downloads.state === "refused"`; the Downloads banner once; the export kept (L5's rule, and the pending is put away as C6b asserts); a later delete that works → `ok`. (b) in `behind-access.test.js`: a note with `downloads` refused and `at` within 24 hours → `behind` and `episodes` say the Downloads line, with "the switch for Dropbox" when Downloads is a link into `<home>/Library/CloudStorage/Dropbox-x/`; with `at` older than 24 hours → no line; a `downloads` finding blocks no drop video and leaves "Nothing is under way" and the AirDrop line in place; an `ok` note → no line.
- [ ] **Step 2: Run them to see them fail.** Run: `cd tool && node --test tests/checks-behind.test.js tests/behind-access.test.js`. Expected: FAIL.
- [ ] **Step 3: Call `noteState` from `checkFinal`'s catch and success** (an error, or `null`); add `downloads` to `accessFinding`'s `places`, and the 24-hour rule.
- [ ] **Step 4: Run the whole suite.** Run: `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Access: the late check notes and says when it cannot touch Downloads (A8)"`

## After the build

- One Opus review of the whole branch, then a draft PR on Jason's yes.
- The BRIMM Ops session's in-step sentence on its guide page (design part 7), at merge time.
- By-hand checks B1 and B2 (design) go on the Studio By-Hand Checks page through the coordinator. B2's switch labels may change `switchFor`'s words: a one-line change with its test.
