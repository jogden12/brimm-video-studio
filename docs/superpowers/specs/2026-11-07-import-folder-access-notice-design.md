# When macOS stops the import reading a folder: notice it and say it (design)

7 November 2026, version 2 (after one Opus review). A design for Jason to approve. Nothing here is built. The build plan is
`docs/superpowers/plans/2026-11-07-import-folder-access-notice-plan.md`.

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
5. **Where it is swallowed today** (code at e17df12):
   - `unedited.js` `uneditedFolders` looks with `existsSync(folder)` (1496) before anything else; a folder not there is "There
     is no folder at …" in the log.
   - `filing.js` `importEpisodes` then runs `finishDue(true)` (780) before `importWaiting`. `finishLate`'s
     `sameFile(pending.drop, …)` (500) is unguarded there, so when every read of the drop folder is refused, the run ends at the
     due late check with "The work on this folder stopped (EPERM)" (`uneditedFolders`' catch): the log again.
   - `importWaiting` calls `noteSeen` (871; its prune `sameFile`s each noted file, and its own `readdirSync` is swallowed) and
     `releaseHeld` (605; its `statSync(…, { throwIfNoEntry: false })` throws under a full refusal) before its own `readdirSync`,
     whose refusal writes one log line ("The folder could not be read (EPERM). If it is in Dropbox …") and returns.
   - After L3, a local Mac's import lists Episodes in Dropbox before its work, and on an error "leaves the video for the next
     look, as a video still arriving is (no status, one log line)" (Phase 3 plan, L3). Its drop folder, often
     `~/BRIMM Video Work/Drop`, needs no Files and Folders access, but Dropbox does.
   - `edit.js` `dropFolders` and `guideDrops` pass over a folder her chat cannot list (her chat's own reads, L1c finding 6).
   - `guide.js` `dropNext`: a video in this Mac's drop folder with no status is "arriving": "It is coming into your drop folder.
     Wait for the "Ready" notice." It says so for ever, and `guide wait` waits on it (`COMING`).
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
- Any change while Phase 3 is being built: this is built after Phase 3 is merged (the build plan's order).
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

- `uneditedFolders`: its `existsSync(folder)` of the drop folder runs in `bracket("drop", …)`, so that a run stuck at its very
  first touch is inside the bracket. A folder not there is noted `missing`.
- `importEpisodes`, first thing: `lookAt("drop", dir)` and `lookAt("episodes", episodesFolder(root))`.
  - After a drop look that is not `ok`, the run reads nothing more in the drop folder: no `noteSeen`, `releaseHeld` or imports.
  - After an episodes look that is not `ok`, it imports nothing (each import needs Episodes).
  - Its late checks still run, each in its own `try`, as the timer's call already is (filing.js 748-753): one that throws stays
    pending for the next run, and the log says so by its label.
- `importWaiting`: `lookAt("drop", dir)` in place of its own `readdirSync`, and `noteSeen` is given those names instead of
  reading again.
- After L5: L5's late check stats and deletes a Downloads export by its path, and never lists Downloads. So no new read is added
  there: L5's own stat or delete, when it throws, writes the `downloads` state through the same note (`noteState(place, folder,
  error)` in `access.js`), and an `ok` delete writes `ok`.

Each refused or locked look's log line names node and the switch (Words).

### 2. Whoever is at the Mac sees a banner

The import posts a banner (`deps.notify`, which posts the "Ready" notice) when a look finds `refused` or `locked`:

- when the state or node is not what `told` last said for that place, or
- when the last banner for that place is more than an hour old, since a run starts when a video is dropped: just when she
  needs to hear it.

Never more often. And once per node, before the run's first look: when `okNode` is set for a place that needs Files and Folders
access (`settings.js` `needsFilesAccess`, which L1c widens to iCloud Drive and `~/Library/CloudStorage`; Downloads, by its real
path) and the run's node is not that `okNode`, macOS is about to ask, and the banner says to choose Allow. With no `okNode` yet,
nothing is posted.

### 3. Her chat says it: one reader, four places

`importAccess(ctx)` gives `null` or one finding with its line. The first that holds, in this order:

| finding | when | covers |
|---|---|---|
| `asking` | `looking` is set, its `pid` is the agent's own (the `pid = N` that `launchctl print` gives, which `agentRunning` already reads), and it is more than a minute old | a run waiting on macOS's question, or on Dropbox listing a folder slowly |
| `refused` / `locked` / `error` | a place's state is so, and its `folder` is still where that place is now (a note about an old drop folder is passed over) | Don't Allow, a question that ended without Allow, the folder's own permissions |
| `missing` | this Mac's drop folder is not there, as her chat sees it | another disk not connected, a folder moved |
| `unseen` | a video in this Mac's own drop folder, older than 3 minutes (ctime), that no status of this Mac names, that `seen.json` does not note and that no `ok` drop look made after it came saw, while no run is at work (neither the agent's pid nor a live pid in the drop folder's lock, `run.js` `lockFile` under `runsFolder`) | node gone or broken after a Homebrew change, the agent not loaded, a refusal from before this build |
| `newNode` | `okNode` is set, the node the plist names (its real path) is not it, and a noted place needs Files and Folders access | a heads-up before any video is dropped |

`unseen` needs no note at all: it is the safety net, and it reads only what her chat can read itself. On a Mac with a Dropbox
drop folder it looks only at this Mac's own folder.

Where it is said:

1. **`behind`**, at every session's start: the finding's line, last, whatever git answered (never when the lock refused first).
   For `newNode` alone, and only when no run is at work, `behind` also asks the agent to look now (`kickstart`, as `retry`
   does), so that macOS's question comes up while she is at the Mac; the line tells her to choose Allow. (My call: Jason can
   turn this off.)
2. **`guide`**'s overview: under "Your drop folder:", after L1c's line for her chat's own refusal when both hold. Then no line
   tells her to put a video in ("Nothing is under way. To start, put the video in your drop folder." is left out), as L1c does
   for its own. Not for `newNode`.
3. **A video's step**: `guideDrops` marks this Mac's arriving videos `blocked` for `asking`, `refused`, `locked` and `error` (all
   of them) and `unseen` (only the videos it found). `dropNext` then says the finding's step words instead of "Wait for the
   "Ready" notice". `blocked` is not in `COMING`, so `guide wait` answers at once. The other Mac's videos are as before.
4. **`episodes`**: the line once, before "On this Mac:", where L1c puts its own ("Waiting in the drop folders:" is printed only
   when something waits).

Her skill (`SKILL.md` and `SKILL-open.md`) gains the lines in "Guide her" and in "At the start of each session", and "look again".

### 4. "Look again"

A new command, `look`: while the finding is `asking`, it says the asking line; while a run is at work otherwise, it says it looks
again within a minute; else it asks the agent to look (`kickstart`) and says so. Her skill runs it when she says "look again" or
"I allowed it". It starts no run of its own: the agent's run has its own arguments, environment and lock.

### 5. The setup shows what macOS answered

The installer loads the import's agent, whose `RunAtLoad` run now looks at the drop folder and Episodes first thing (part 1), so
macOS's question comes up during the setup, with Jason at the Mac. After its check of Claude, the installer reads `access.json`
and prints one line: both places `ok`, a place refused or locked (its line), or a place still being looked at (the asking line).
No launch agent is added or used differently. The installer's own words change (the real run's, and the `--print` "Files and
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

`guide.js`'s words are part of the contract with BRIMM Ops. The new step (`blocked`) and the overview's line are "Contract
touched": the BRIMM Ops guide page (in brimm-operations) gains, in step at merge time, a sentence for when the guide says the
import cannot look: allow node as the line says, then say "look again". The hand-off file, its fixtures and `madeBy` do not
change.

## Words

Every new sentence, exactly. `<words>` is `settings.js` `folderWords` of the folder. `<place>` is "your drop folder, <words>",
"BRIMM Video in Dropbox" or "the Downloads folder". `<switch>` is from the table below.

| where | text |
|---|---|
| log, refused | `macOS does not let node (<node's path>) look in <place> (EPERM). Allow node in System Settings, Privacy & Security, Files and Folders; then say "look again" in her chat, or drop the video again.` |
| log, locked | `The folder's own permissions do not let node look in <place> (EACCES). Jason checks them in Finder, Get Info, Sharing & Permissions.` |
| log, late check put off | `<label>: its late check could not be made (<code>). The next run makes it again.` |
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
| setup, refused, locked or asking | `  Files and Folders, at the end:  ` and the chat line |
| Downloads, refused | as the refused line, with `the Downloads folder` for `<place>` and `, so the exports HyperFrames put there stay there` for `, so the videos you drop wait` |

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
6. Only the episode import of this Mac's drop folder is noted; the old folder mode is left as it is.
7. Built after Phase 3 is merged, not after L3 alone: L5 rewrites `importEpisodes`, and L7 and L9 change the guide, `edit.js`,
   `install.sh` and both skills, one builder at a time.
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
