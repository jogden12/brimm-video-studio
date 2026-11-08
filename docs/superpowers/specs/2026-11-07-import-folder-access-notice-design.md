# When macOS stops the import reading a folder: notice it and say it (design)

7 November 2026 (version 3, 7 November 2026, after Phase 3 merged). A design for Jason to approve. The build plan is
`docs/superpowers/plans/2026-11-07-import-folder-access-notice-plan.md`.

**What changed from version 2.** Version 2 was written against e17df12, before Phase 3. Phase 3 has merged (main 565150f), and a
check of this design and the plan against that code found sixteen points that no longer fit: line numbers, where the first
touch of the drop folder is, that Episodes missing is normal, where the late checks are guarded, what the overview and the
steps already say, what the setup can count on, and which files list her commands. Each is corrected in the part it belongs
to. The idea and the words are as before, but for the lines named in the Words table.

## Why

The launch agent `com.thebrimm.unedited` runs Homebrew's `node` to import the videos dropped in this Mac's drop folder. macOS's
privacy control (System Settings › Privacy & Security › Files and Folders) decides, program by program, whether a program may
read a folder under Desktop, Documents, Downloads, iCloud Drive, a cloud drive under `~/Library/CloudStorage` (where Dropbox is),
or another disk. macOS knows Homebrew's node by its exact build, so after a `brew upgrade node` it treats node as a new program
and asks again.

When nobody is at the Mac to answer, or the answer is Don't Allow, the import can no longer look in the drop folder, or in
BRIMM Video's Episodes in Dropbox. A dropped video then sits there, the guide tells Sallie to wait for a "Ready" notice that never
comes, and nobody is told. Phase 3 makes this matter more: each Mac may pick a drop folder under Desktop, Documents, another disk
or a cloud drive (D11), and L5 has the launch agent delete a Downloads export (installer finding 10). Phase 3 only changed the
installer's words (L1c, ruling X3): its Files and Folders line no longer promises that macOS asks once.

## What was found

1. **Homebrew's node changes identity at each upgrade.** On the Mac Studio, node 26.11.1 is ad-hoc signed
   (`codesign -dv`: `Signature=adhoc`, no team), and its designated requirement is its own hash alone
   (`codesign -d -r-`: `designated => cdhash H"fe68…"`). `process.execPath` is the versioned Cellar path
   (`/opt/homebrew/Cellar/node/26.11.1/bin/node`), though the plist names `/opt/homebrew/bin/node`, a link that follows the
   upgrade. A new version has a new hash and a new path, so macOS has no answer for it and asks again.
2. **A copy of Homebrew's node is not self-contained.** `otool -L` shows it loads Homebrew's own libraries (`libnode`, `libuv`,
   `llhttp`, many `abseil` ones) from `/opt/homebrew/opt/…`. Homebrew upgrades those and later deletes the old ones, so a copy
   kept at a fixed path would one day fail to start.
3. **Two programs, two answers.** The launch agent's node is a program of its own to macOS. Her chat's reads are made for the
   Claude app, which has its own switches. So her chat can read the drop folder while the import cannot, and the other way
   round. L1c's finding 6 covers her chat's own reads; this design covers the import's, which her chat cannot see by looking.
4. **What node gets when it is refused.** Simulated with `sandbox-exec` on a scratch folder outside Dropbox (macOS's privacy
   refusals come through the same sandbox, as EPERM, "Operation not permitted"):
   - contents refused: `readdirSync`, `opendirSync`, `accessSync(R_OK)` and `readFileSync` throw `EPERM`; `statSync` and
     `existsSync` still answer; writing a new file still works;
   - all reads refused: `statSync` throws `EPERM` even with `{ throwIfNoEntry: false }`; `existsSync` still says `true`;
   - `EACCES` is a different thing: the folder's own Unix permissions, not macOS's privacy control.
   - Not tested, since it needs a real question on a Mac's screen: whether a read waits while macOS's question is up (in
     Terminal it is commonly seen to wait), and whether `existsSync` alone brings the question up. The design works either way
     (part 1 opens its bracket before the first touch); by-hand check B1 settles it.
5. **Where it is swallowed today** (code at main 565150f):
   - `unedited.js:1566` `uneditedFolders` looks with `existsSync(folder)` (`1571`) before anything else; a folder not there is
     "There is no folder at …" in the log (`1572`). On a local Mac it goes on to the folder anyway (`1576-1577`).
   - `filing.js` `importEpisodes` (`1622`) runs `finishDue(true)` (`1830`) before `importWaiting(true)` (`1831`). `finishLate`'s
     `sameFile(pending.drop, …)` (`1492`) is unguarded there, so when every read of the drop folder is refused, the run ends at
     the due late check with "The work on this folder stopped (EPERM)" (`uneditedFolders`' catch, `unedited.js:1584-1589`): the
     log again.
   - `importWaiting` (`1743`) calls `noteSeen` (`1744`; its prune `sameFile`s each noted file, `1933`, and its own `readdirSync`,
     `1940`, is swallowed) and `releaseHeld` (`1745`; its `statSync(…, { throwIfNoEntry: false })`, `1596`, throws under a full
     refusal) before its own `readdirSync` (`1759`), whose refusal writes one log line (`1763`: "The folder could not be read
     (EPERM). If it is in Dropbox …") and returns.
   - A local Mac's import lists Episodes in Dropbox before its work (`unedited.js:539-547`, per video), and on an error "leaves
     the video for the next look, as a video still arriving is (no status, one log line)". Its drop folder, often
     `~/BRIMM Video Work/Drop`, needs no Files and Folders access, but Dropbox does.
   - `edit.js` `dropFolders` and `guideDrops` pass over a folder her chat cannot list (her chat's own reads, L1c finding 6).
   - `guide.js` `dropNext` (`293`): a video in this Mac's drop folder with no status is "arriving": "It is coming into your drop
     folder. Wait for the "Ready" notice." It says so for ever, and `guide wait` waits on it (`COMING`, `615`).
   - The plist starts the agent on `WatchPaths` and at load only. After someone allows node, nothing starts a new run until
     something changes in the folder or the Mac logs in again.
6. **The Mac Studio today.** Its agent log, since it began on 14 October (node 26.11.1 has been there since 13 October), has no
   EPERM line: node is allowed into its Dropbox drop folder now. The next `brew upgrade node` puts that at risk on the Mac
   Studio as well as on the MacBooks.

## Goals

- When the import cannot look in this Mac's drop folder, in Episodes in Dropbox, or (L5) at a Downloads export, whoever is at
  the Mac and her chat are told, each in one plain line that says what to allow and where.
- After allowing it, one plain step gets the waiting videos imported.
- A video the import has not taken is never told "wait for the Ready notice" for ever, whatever the cause: refused, node gone or
  broken after a Homebrew change, or the agent not running.
- Where it is cheap, macOS's question comes up while someone is at the Mac (the setup, the start of her session), not when a
  video is dropped and nobody is there.

## Non-goals

- Her chat's own reads (L1c, finding 6).
- Any change while Phase 3 was being built: this is built on Phase 3's merged code (the build plan's order).
- Studio never changes macOS's privacy settings itself (no `tccutil`), and never asks for Full Disk Access.

## Anti-goals: it fails if

- a line names the wrong program (Claude where it is node) or sends her to a switch that does not exist;
- a banner shows every minute, or a line says something is wrong while a long import is simply running;
- any line, file or banner names a video by its file, which may be a client's.

## The design

### 1. The import keeps a note of each look: `access.json`

The import writes `~/Library/Application Support/BRIMM Video/access.json`, beside `seen.json` (`settings.js` `seenFile`): on this
Mac's own disk, never in Dropbox, never in a watched folder. It is written whole under another name and renamed, as `seen.json`
is; a write that fails costs only the notice.

```json
{
  "version": 1,
  "places": {
    "drop":     { "state": "refused", "code": "EPERM", "at": 1762500000000, "since": 1762490000000, "folder": "<path>",
                  "node": "/opt/homebrew/Cellar/node/26.11.1/bin/node", "okNode": "<node of the last ok look, or absent>" },
    "episodes": { "state": "ok", "code": "", "at": 1762500000000, "since": 1762400000000, "folder": "<path>", "node": "…", "okNode": "…" }
  },
  "looking": { "place": "drop", "pid": 4242, "at": 1762500000000 },
  "told": { "drop": { "key": "refused|<node>", "at": 1762500000000 }, "newNode": { "node": "…", "at": 1762500000000 } }
}
```

- The places: `drop` (this Mac's drop folder), `episodes` (`Episodes` in BRIMM Video in Dropbox), and, after L5, `downloads`.
- `state` is `ok`, `refused` (EPERM: macOS's privacy control), `locked` (EACCES: the folder's own permissions), `missing`
  (ENOENT) or `error` (any other code, kept in `code`). `since` is when this state began. `okNode` is the node of the last `ok`
  look, kept through later states; until a first `ok` look it is absent, and absent means unknown.
- No video name is ever in it. A folder's path and node's path are.

A new module, `tool/access.js`, holds the note, its reader and every sentence below, so that `filing.js`, `unedited.js` and
`edit.js` each change in a few lines. Its two tools:

- `bracket(place, fn)`: writes `looking`, runs `fn`, clears `looking`, whatever `fn` does.
- `lookAt(place, folder)`: in a bracket, lists the folder with `readdirSync`, and writes the place's state. Gives back
  `{ names }` or `{ state, code }`.

Where the import uses them (the episode import of this Mac's drop folder only; the old folder mode is left as it is):

- `uneditedFolders` (`unedited.js:1571`): its `existsSync(folder)` of the drop folder runs in `bracket("drop", …)`, when
  `episodeMode(folder, deps.settings, home)` holds (the loop also walks old-mode folders, which are left as they are), so that a
  run stuck at its very first touch is inside the bracket. A folder not there is noted `missing`, in both branches: the late
  checks of a missing local drop folder still run, as `tests/unedited.test.js:3358-3378` pins.
- `importEpisodes`, first thing, before `finishDue(true)` (`filing.js:1830`; after `clearRuns`, `clearCrashes` and `oweForgotten`):
  `lookAt("drop", dir)` and `lookAt("episodes", episodesFolder(root))`.
  - After a drop look that is not `ok`, the run reads nothing more in the drop folder: no `noteSeen`, `releaseHeld` or imports.
  - After an episodes look that is `refused`, `locked` or `error`, it imports nothing (each import needs Episodes). `missing` is
    noted and the import goes on: the import makes Episodes itself (`filing.js:114-122`, `210-211`, `345-346`;
    `unedited.js:539-547`), and in a first import it is often not there yet. That per-video check (`unedited.js:539-547`) stays,
    as a backstop for a refusal that begins in the middle of a run.
  - Its late checks still run, each in its own `try`. The kind branch of `finishDue` already has one per check
    (`filing.js:1704-1710`); the import branch (`1715-1729`) gets the same, around `settleReading` and `finishLate` after
    `checked.add` (`1728`), with `pending.label || "A video"`, never the file. Because it is inside `finishDue`, one guard covers
    `finishDue(true)` (`1830`), `finishDue(false)` (`1867`) and the timer's call (`1793-1797`). A check that throws stays pending
    for the next run, and the log says so by its label.
- `importWaiting` (`filing.js:1743`): `lookAt("drop", dir)` comes first, in place of its own `readdirSync` (`1759`); only on
  `ok` does it call `noteSeen(home, dir, now, names)` (`1744`; the new fourth argument, the names, means it does not list the
  folder, and its prune is guarded) and `releaseHeld` (`1745`). The silent return for a folder not there stays. The line "The
  folder could not be read …" at `filing.js:1763` goes, and the refused look's log line takes its place; its old-folder-mode twin,
  `unedited.js:1545`, stays. `importWaiting` runs every `LOOK_AGAIN_MS` (`1609`, 60 s) while a run waits for late checks; each
  of those looks writes the note, and the hourly rule in part 2 reads `told` from the note each time.
- Phase 3's test at `tests/unedited.test.js:2939-2959` (Episodes unreadable for the second drop) expected a result for each
  video and the per-video "Episodes could not be read" line. Under this part that run imports nothing: no results, and the log
  holds the locked line. The plan changes that test and says so.
- L5's late check (`checkFinal`, `filing.js:1307-1452`) stats and deletes a Downloads export by its path (`1428`, `1440`, `1445`),
  and never lists Downloads. So no new read is added there: its own catch (`1447-1449`), when a stat or delete throws, writes the
  `downloads` state through the same note (`noteState(place, folder, error)` in `access.js`), and a delete that works (after
  `1445`) writes `ok`. After a refusal the check still completes and the pending is put away, so the `ok` comes only at a later
  finish's delete; part 3 says how the line ends meanwhile.

Each refused or locked look's log line names node and the switch (Words).

### 2. Whoever is at the Mac sees a banner

The import posts a banner (`deps.notify`, which posts the "Ready" notice) when a look finds `refused` or `locked`:

- when the state or node is not what `told` last said for that place, or
- when the last banner for that place is more than an hour old, since a run starts when a video is dropped: just when she
  needs to hear it.

Never more often. And once per node, before the run's first touch of the drop folder (`uneditedFolders`' `existsSync`,
`unedited.js:1571`, which part 1 brackets): when `okNode` is set for a place that needs Files and Folders access
(`settings.js:469-486` `needsFilesAccess`: Desktop, Documents, `/Volumes`, `~/Library/CloudStorage/*`, iCloud Drive, another
device) and the run's node is not that `okNode`, macOS is about to ask, and the banner says to choose Allow. The `downloads`
place always counts as needing access (a plain `~/Downloads` is not in `needsFilesAccess`, and the installer and
`dropFolderFault` use it, so it is not widened). With no `okNode` yet, nothing is posted.

The rule that decides a banner lives in `access.js`, so that the import's look sites and L5's late check use the same one.

### 3. Her chat says it: one reader, four places

`importAccess(ctx)` gives `null` or one finding with its line. The first that holds, in this order:

| finding | when | covers |
|---|---|---|
| `asking` | `looking` is set, its `pid` is the agent's own (the `pid = N` that `launchctl print` gives, which `agentRunning` already reads), and it is more than a minute old | a run waiting on macOS's question, or on Dropbox listing a folder slowly |
| `refused` / `locked` / `error` | a place's state is so, and its `folder` is still where that place is now (a note about an old drop folder is passed over) | Don't Allow, a question that ended without Allow, the folder's own permissions |
| `missing` | on a Mac with a drop folder of its own (`settings.js:78` `isLocal`), that folder is not there, as her chat sees it | another disk not connected, a folder moved. A missing Dropbox drop folder is Dropbox's to bring back (`unedited.js:1574-1576`), so it says nothing |
| `unseen` | a video in this Mac's own drop folder, older than 3 minutes (ctime), that no status of this Mac names, that `seen.json` does not note and that no `ok` drop look made after it came saw, while no run is at work (neither the agent's pid nor a live pid in the drop folder's lock, `run.js` `lockFile` under `runsFolder`) | node gone or broken after a Homebrew change, the agent not loaded, a refusal from before this build |
| `newNode` | `okNode` is set, the node the plist names (its real path) is not it, and a noted place needs Files and Folders access | a heads-up before any video is dropped |

`unseen` needs no note at all: it is the safety net, and it reads only what her chat can read itself. On a Mac with a Dropbox
drop folder it looks only at this Mac's own folder.

How the reader gets its facts. The agent's pid and node are asked only when a finding could need them: `agentPid` when
`looking` is set or an unseen candidate is found, `agentNode` when an `okNode` is noted and a place needs access. Neither calls
the real `launchctl` or `plutil` when the caller gave `agentRunning` instead: `agentPid` falls back to it, and `agentNode`
to `""`. `agentNode` reads the plist under the Studio home (`<home>/Library/LaunchAgents/com.thebrimm.unedited.plist`,
`ProgramArguments.0`, `install.sh:88`, `351-353`), and gives `""` on any failure; `""` is never a new node. The lock's pid is
checked with her chat's `ctx.alive`. A place `downloads` always counts as needing access.

Only the places `drop` and `episodes` block a drop video or take anything from the overview. A `downloads` finding is said in
`behind` and `episodes` only, and only while that place's note `at` is within 24 hours (`DOWNLOADS_SAY_MS = 24 * 60 * 60 *
1000`): after a refusal the check is put away, so the note may not turn `ok` for a long while. It never blocks a drop video and
never takes "Nothing is under way" or the AirDrop line away; `stepLine` gives `""` for it.

Where it is said:

1. **`behind`**, at every session's start (`edit.js:2739-2781`): the finding's line, last, whatever git answered, said in
   `folderLine` after the `added` line (`2767`) and before it returns (never when the lock refused first, `2742-2743`).
   For `newNode` alone, and only when no run is at work, `behind` also asks the agent to look now (`kickstart`, as `retry`
   does; the call is made in `folderLine` too), so that macOS's question comes up while she is at the Mac; the line tells her to
   choose Allow. (My call: Jason can turn this off.)
2. **`guide`**'s overview (`guide.js:587` `overviewLines`, called from `edit.js:6699-6702`; `guideItems` passes the finding on and
   `guideDrops`, `edit.js:6496-6537`, returns it, once per pass, since `guide wait` reads every 5 s): under "Your drop folder:",
   after L1c's line for her chat's own refusal when both hold. Then no line tells her to put a video in: "Nothing is under way.
   To start, put the video in your drop folder." and the AirDrop line ("drag it from there into your drop folder") are both left
   out, as L1c does for its own. Not for `newNode`, and not for `downloads`.
3. **A video's step**: `guideDrops` marks this Mac's arriving videos `blocked` for `asking`, `refused`, `locked` and `error` (all
   of them, when the finding's place is `drop` or `episodes`) and `unseen` (only the videos it found). `dropNext` (`guide.js:293`)
   then says the finding's step words instead of "Wait for the "Ready" notice"; it needs its own `blocked` branch before the
   fall-through to the Zoom step (`305`). `blocked` is not in `COMING` (`615`), so `guide wait` answers at once, but it has a
   place in `trailOf` (`633`), since a blocked video may still be copying in. The other Mac's videos are as before.
4. **`episodes`** (`edit.js:1076`): the line once, right after L1c's line (`1128`) and before "Imports:" (`1132`) and "On this
   Mac:" (`1136`) ("Waiting in the drop folders:", `1125`, is printed only when something waits).

Her skill (`SKILL.md` and `SKILL-open.md`) gains one or two bullets after L1c's line in "Guide her", which has room for no more
(`tests/studio.test.js:1551` caps it at 30 lines, and both skills are at 24). They tell her to pass on what `behind`, the guide
or `episodes` says of the import, node or Dropbox, as it is said, and to run `look` when she says "look again" or "I allowed
it". The skill does not hold each line of this part. A new bullet does not start with L1c's prefix
(`tests/studio.test.js:1546`).

### 4. "Look again"

A new command, `look` (in `COMMANDS` and `COMMAND_NAMES`, `edit.js:6958`, `6960`, in `HELP` and in the file's top comment): while the finding is `asking`, it says the asking line; while a run is at work otherwise, it says it looks
again within a minute; else it asks the agent to look (`kickstart`) and says so. Her skill runs it when she says "look again" or
"I allowed it". It starts no run of its own: the agent's run has its own arguments, environment and lock. `look` names no episode, so it joins
`gate.js:14` `UNSCOPED` (from which `open-lock.js:78` `HELD_COMMANDS` derives); the folder's allow list and guard name no
commands, so they do not change.

### 5. The setup shows what macOS answered

The installer loads the import's agent, whose `RunAtLoad` run now looks at the drop folder and Episodes first thing (part 1), so
macOS's question comes up during the setup, with Jason at the Mac. After its check of Claude (after the check block, `install.sh:1052`, inside the part that runs
only for a machine), the installer reads `access.json` and prints one line: both places `ok`, a place refused or locked (its
line), or a place still being looked at. The setup cannot count on the import having had 90 seconds (the check stops as soon
as Claude answers, and not at all with `--rules-only`), and no wait is added. So the line judges the `looking` it finds: one
whose pid is not alive is passed over (the places are used); a live one under a minute old gets new words, "the import is still
looking"; an older one gets the asking line. The entry is `node access.js --setup-line`, behind the main-module guard, since
every `tool/*.js` must load alone. No launch agent is added or used differently. The installer's own words change (the real run's, and the `--print` "Files and
Folders:" line if it names node again), so the old and new words go to the installer session (`local_d62ac744`) first: the Move
to Studio app reads `install.sh`'s lines by their words (X5).

### 6. Making it rarer: which program macOS asks about

| option | what happens | verdict |
|---|---|---|
| A. Homebrew's node, as now | asked again after each node upgrade; parts 1–5 notice and say it each time | now |
| B. a copy of Homebrew's node at a fixed path | breaks when Homebrew moves node's libraries (finding 2): a worse silence | no |
| C. `brew pin node` | node's libraries still move; node gets no fixes | no |
| D. Node.js's own build from nodejs.org, at a fixed path in BRIMM Video Work | self-contained; if it is signed by the Node.js Foundation (to check, B3), macOS's answer holds across its updates; a second node to install and keep up to date, and System Settings still says "node" | possible |
| E. a small helper, "BRIMM Video Studio Import", signed with Jason's Developer ID, that the plist runs and that runs Homebrew's node as its child | macOS asks about the helper, once per Mac, and keeps the answer across node updates; System Settings shows a name Sallie knows; built, signed and notarized by hand on the Mac Studio as the Move app is (check 73); the plist's first argument changes | recommended later |
| F. node run by `/bin/zsh` without `exec` | macOS asks about "zsh", and the answer covers every launch agent run by zsh | no |

Recommendation: A with parts 1–5 now, since an answer can be lost in other ways too (Don't Allow, a reset, a new disk, a macOS
upgrade). E later, if Jason wants it, once the Move app's signing is routine. E rests on macOS asking about the program launchd
started, not its child: B4 checks it before E is built.

### 7. In step with BRIMM Ops

`guide.js`'s words are part of the contract with BRIMM Ops. The new step (`blocked`), the overview's line and the overview's
two left-out lines are "Contract
touched": the BRIMM Ops guide page (in brimm-operations) gains, in step at merge time, a sentence for when the guide says the
import cannot look: allow node as the line says, then say "look again". The hand-off file, its fixtures and `madeBy` do not
change.

## Words

Every new sentence, exactly. `<words>` is the drop folder as the guide's "Your drop folder:" line names it (`guide.js:24`
`dropWords`), so that the access line names it as the line above it does; in the import, where there are no settings,
`settings.js:492` `folderWords` of the folder. `<place>` is "your drop folder, <words>",
"BRIMM Video in Dropbox" or "the Downloads folder". `<switch>` is from the table below.

| where | text |
|---|---|
| log, refused | `macOS does not let node (<node's path>) look in <place> (EPERM). Allow node in System Settings, Privacy & Security, Files and Folders; then say "look again" in her chat, or drop the video again.` |
| log, locked | `The folder's own permissions do not let node look in <place> (EACCES). Jason checks them in Finder, Get Info, Sharing & Permissions.` |
| log, late check put off | `<label>: its check could not be made (<code>). The next run makes it again.` (the words the kind branch already says, `filing.js:1704-1710`; `<label>` is `pending.label \|\| "A video"`) |
| banner, refused | `This Mac does not let node look in <place>. Allow it in System Settings › Privacy & Security › Files and Folders.` |
| banner, locked | `The import cannot open <place>. Ask Jason.` |
| banner, new node | `node was updated. If macOS asks whether node may look in a folder, choose Allow.` |
| chat, asking | `The import has waited more than a minute to look in <place>. If a box on this Mac's screen asks whether "node" may look in it, choose Allow, and the import goes on.` |
| chat, refused | `This Mac does not let the import look in <place>, so the videos you drop wait. In System Settings, under Privacy & Security, Files and Folders, turn on <switch> under each "node" listed. Then say "look again".` |
| chat, locked | `The import cannot open <place>: the folder's own permissions shut it. Ask Jason. (Jason: node gets EACCES there; see Get Info, Sharing & Permissions.)` |
| chat, error | `The import could not look in <place> (<code>). Ask Jason. (Jason: see ~/Library/Logs/brimm-video.log.)` |
| chat, missing | `Your drop folder, <words>, is not there now. If it is on another disk, connect the disk, then say "look again".` |
| chat, unseen (behind, episodes) | `The import has not taken <n> video(s) in your drop folder, and no import is running. Say "look again". If <it/they> still wait(s), ask Jason. (Jason: see ~/Library/Logs/brimm-video.log, and launchctl print gui/$(id -u)/com.thebrimm.unedited.)`, with "1 video" / "it" / "waits" for one |
| step, unseen | `The import has not taken it, and no import is running. Say "look again". If it still waits, ask Jason.` |
| step, asking/refused/locked/error | the chat line, as is |
| chat, new node | `node was updated on this Mac, so macOS may ask whether node may look in your drop folder or in Dropbox. If a box asks, choose Allow.` |
| `look`, at work | `The import is at work now: it looks in your drop folder again within a minute.` |
| `look`, asked | `The import is asked to look in your drop folder now. The panel shows how far it is.` |
| setup, ok | `  Files and Folders, at the end:  node may look in the drop folder and in Dropbox.` |
| setup, not looked yet | `  Files and Folders, at the end:  the import has not looked yet.` |
| setup, still looking (a live `looking` under a minute old) | `  Files and Folders, at the end:  the import is still looking; if a box asks whether "node" may look in a folder, choose Allow.` (new words; to the installer session first) |
| setup, refused, locked or asking | `  Files and Folders, at the end:  ` and the chat line |
| Downloads, refused | as the refused line, with `the Downloads folder` for `<place>` and `, so the exports HyperFrames put there stay there` for `, so the videos you drop wait`; said only while the note's `at` is within 24 hours |

`<switch>`, by the folder's real path (B2 confirms the labels on macOS 27 before the builder fixes them): under Desktop, "Desktop
Folder"; under Documents, "Documents Folder"; under Downloads, "Downloads Folder"; another disk, "Removable Volumes" or "Network
Volumes"; under `~/Library/CloudStorage/<Provider>-…`, "the switch for <Provider>" (Dropbox, on the Mac Studio's Downloads too,
which is a link into Dropbox); iCloud Drive, "the switch for iCloud Drive"; else "its switches".

## Rules kept

- No file is written in Dropbox or in a watched folder; `access.json` is on this Mac's disk.
- No line, note or banner names a video by its file: a video is named as the guide names it.
- Nothing is installed and no launch agent is changed or used differently: parts 1–5 add a file of notes, words and one
  command. Option E would change the plist's program, with Jason's yes.
- Tests first; no test calls the real `launchctl`, `osascript`, `plutil` or macOS's privacy control.

## My calls (Jason can overturn any)

1. The note lives beside `seen.json`, in a new module `access.js`.
2. A banner at most once an hour per place while refused, and once per change.
3. `behind` asks the agent to look when node has changed and no run is at work, so that macOS asks while she is at the Mac.
4. "unseen" waits 3 minutes, and "asking" one minute.
5. A new command `look` rather than widening `retry`, which needs a video.
6. Only the episode import of this Mac's drop folder is noted; the old folder mode is left as it is, including its own "The
   folder could not be read" line (`unedited.js:1545`, pinned by `tests/unedited.test.js:871`).
7. Built after Phase 3 is merged (it is: main 565150f), not after L3 alone: L5 rewrote `importEpisodes`, and L7 and L9 changed
   the guide, `edit.js`, `install.sh` and both skills; one builder at a time.
8. Option A now, E recommended later; B, C and F rejected.

## For Jason to decide

1. The go-ahead to build this once Phase 3 is merged.
2. Later: whether to build the signed helper (option E), so that macOS asks once per Mac and System Settings says "BRIMM Video
   Studio Import" instead of "node".

## By-hand checks (for the Studio By-Hand Checks page)

- **B1, an observation, no change:** at the next `brew upgrade node` on any Mac, before dropping anything: does a box come up on
  the next run, and does the run wait on it (`launchctl print gui/$(id -u)/com.thebrimm.unedited` shows a pid)?
- **B2, a look, no change:** System Settings › Privacy & Security › Files and Folders on the Mac Studio: is node listed, how many
  times, and what are its switches' labels, the Dropbox one in particular?
- **B3, only for option D:** does `codesign -d -r-` of nodejs.org's darwin-arm64 `node` name the Node.js Foundation's team?
- **B4, only for option E:** with the helper built and a scratch drop folder under Desktop, does macOS's box name the helper,
  not node?
