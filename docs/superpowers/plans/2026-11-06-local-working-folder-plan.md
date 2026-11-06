# BRIMM Video Studio: the local working folder (Phase 3 of the review changes), the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** She drops a video into the folder her Mac picked, and nothing waits for Dropbox. The recording and everything made from it stay on the Mac that took it in. Once the video is handed off, every recording she dropped for it moves into its episode's `Original files` folder in Dropbox, and leaves the Mac only after Dropbox's check of that copy. The edited export, its transcript, the hand-off and the records go to Dropbox as today; Dropbox's checks run behind, and nothing waits for them. A session's recording never goes to Dropbox.

**Architecture:** Two settings per Mac, picked at install: `dropPath` (by default `~/BRIMM Video Work/Drop`) and `exportsPath` (by default `~/Downloads`). On a Mac with `dropPath`, an episode's own files go in `~/BRIMM Video Work/<episode folder>/video/`, its record gains `local: { on: <Mac> }` (layout 6), and one resolver (`tool/where.js`) says where each listed file is. The episode's folder in Dropbox keeps `record/`, `final/`, `Original files/` and a plan's three script files. The late-check machinery Phase 1 built (pendings on this Mac's disk, `late-check.lock`, the launch agent's loop) makes Dropbox's checks of `final/` and `Original files/` behind the work. Episodes filed before the switch keep the old way until they are handed off, so no old code is deleted. Phase 2's code (Final Cut, the full import, `release`, the take-over) is still on main: it refuses a video kept on a Mac.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages); `tool/install.sh` (zsh).

**Spec:**
- Jason's change list of 5 Nov 2026, Phase 3 (https://claude.ai/artifact/Nrv9VMy8AgX9tGG78YyHf1; copy `CHANGE-LIST.md` in `~/Library/Application Support/Claude/side-session-notes/local_cf396f88-dcff-4c95-91e6-1f77aa69803f/team-review-2026-11-05/`). His answers on https://claude.ai/artifact/5Z8GNkqKe68PcNctRWNnMv: `phone` = "AirDrop, or record on the Mac"; `release` = r1, "videos will not be passed from one Mac to the other … This will not happen"; `features` includes "Drop it, and it runs until it needs her"; `pain` (a) "fixed by moving the raw and working folder out of Dropbox". His note of 5 Nov (H7 check 67): "the working folder is local, and the export folder is on dropbox. the video file does not hit dropbox until it is edited and ready to post".
- Jason, 6 Nov: "of all the changes that came out of the review, moving the drop folder out of Dropbox is top priority … I would like to implement that one change and merge it to main." So this plan builds on main alone and merges alone; Phase 2 is not done first.
- Jason, 6 Nov, on recordings after editing: "Yes, every recording" (every recording she dropped moves into the video's `Original files` in Dropbox after the hand-off). A client session's recording never goes into Dropbox.
- Jason, 6 Nov, Question 2: "Yes, some do" (some videos already in Studio still need editing or a hand-off after the change).
- Jason, 6 Nov, on folders: "the app installer should allow the user to pick or create the Drop folder in a location of their choosing with a warning that creating it in Dropbox or other 'cloud' folders could cause issues. they should also be able to choose which folder exports of edited videos go into. Cloud based folders are fine for this step, especially if they want to share with other users or computers". The Studio side is here; the Move to Studio app's folder pickers are another session's.
- Jason, 5-6 Nov: edits are not handed between Macs; Sallie isn't using brimm-video now; nothing here touches her laptop; all testing and deployment are on the Mac Studio, which switches at deployment on his yes.
- The review's design notes: `arch.md` section 5 and finding 2, `flow.md` section 5, `reliability.md` F1-F2. Phase 1's plan, `docs/superpowers/plans/2026-11-05-review-changes-plan.md`: R1a-R1d, their rulings, and its outline of Phase 3 (line 993).

**Not here:**
- Phase 2 (Final Cut retired; `release`, its snapshots and the take-over removed; the full import removed). Its code stays; on a video kept on a Mac it refuses (D13, L2b).
- The removal of the old waiting code (R1a-R1d, the claim, `bring` for imports): a later round, once no episode from before the switch is left to hand off.
- Sallie's laptop, her drop folder `Drop/Sallie's laptop`, her setup doc and the By-Hand page's laptop checks. Her laptop picks its folders at its move, through the Move to Studio app; that app's pickers are another session's (D8 says what they call).
- BRIMM Ops' code and its guide, which describes her laptop.
- Merging. Nothing merges, and nothing is pushed, without Jason's yes.

Line numbers are at ed9ef20 (main), and in `tool/*.js` they are the same as at 6cdf48b. A builder finds code by its function's name.

---

## The design, as rulings

Each says why, and what it costs if wrong. The question still open for Jason is at the end.

**D1. Where things live.**
- The drop folder: the one each Mac's installer is given, anywhere (D11); by default `~/BRIMM Video Work/Drop/`.
- An episode's own files: `~/BRIMM Video Work/<episode folder>/video/`: the recording, its transcript, words, cut plan, notes, Reel suggestions, the rough cut's captions, `edit/` and `media/`, and `video/history/` for replaced files. A footage part's recording and a joined video go there too.
- In Dropbox, `Episodes/<episode folder>/` keeps `record/`, `final/` (the export, the final transcript, the hand-off), `Original files/` (D6) and a plan's `video guide.md`, `shot list.md` and `teleprompter.txt`.
- The import's status files: `~/Library/Application Support/BRIMM Video/importing/`.
- Why: `~/BRIMM Video Work` is on both Macs, never in Dropbox, gated in her folder already (`places.js` `gatedPlaces`, 76), and holds each episode's work folder (`settings.js` `episodeWork`, 63); no HyperFrames project is ever called `video` (`project.js` `projectName` ends every name with a short id). A plan's script files are small, made before any footage, and written with no wait.
- Cost if wrong: folder names to change.

**D2. The record: layout 6.** A record of an episode filed on a Mac with `dropPath` holds `local: { on: "<Mac>" }` and is layout 6 (`LOCAL_VERSION`). `files` keeps its shape. A file's place is its name: `final/…`, `Original files/…`, `record/…` and the plan's three files are in Dropbox; every other name is on `local.on`, in `video/`. A record without `local` is as today. New records still write `editing` and `released: null`, which the laptop's old brimm-video checks (`episode.js` `faultFor`, 448-449); an older Studio reads a layout-6 record as one a newer Studio wrote, and never writes it (`readEpisode` 575, `writeEpisode` 646).
- Cost if wrong: one resolver to change.

**D3. One Mac per episode.** Edits are not handed between Macs (Jason, 5 Nov). An episode with `local.on` is edited only on that Mac. On the other Mac, `episodes` and the guide list it as on that Mac, and every command that reads or changes it says one line and changes nothing. No claim is written or waited for on a local episode.
- Cost if wrong: a record-only change (a title, a name) must be made on the Mac that holds the video.

**D4. Nothing waits for Dropbox on a local episode.** No late check of the import, Claude's reading, the copy for HyperFrames or a join, since their files never go to Dropbox. Phase 1's holds, waits and words (R1a-R1d) apply only to an episode whose files are in Dropbox.

**D5. Dropbox's checks that remain run behind.** On a local episode, the finish's copies in `final/` and a recording's copy in `Original files/` are checked 15 minutes after their copy (`LATE_CHECK_MS`, unchanged), by the launch agent's loop, from this Mac's pendings, under `late-check.lock`. A file is put back only when the record in force still lists it at the size the check put in. The finish ends once its hand-off is written; a finish killed after its hand-off no longer loses its check. An episode from before the switch is finished as today (D9).

**D6. Original files after the hand-off.** Once a video kept on a Mac is handed off, every recording she dropped for it moves into `Original files/` in Dropbox, by the rule; its copy on the Mac is deleted only after Dropbox's check of the moved copy has passed (D5). If the check fails, the Mac's copy stays and she is told. A session's recording never moves. Every file made from a recording stays where it is. (Jason: "Yes, every recording". Details: L6.)

**D7. How videos reach the drop folder.** A phone clip comes by AirDrop (it lands in Downloads, and she drags it into the drop folder) or is recorded on the Mac. A finished video from her editor is dragged from Dropbox with Option held, so Dropbox keeps its copy. On the Mac Studio, Downloads is a link into Dropbox (`settings.js` 56-58), so an AirDropped clip is in Dropbox until she drags it out. By-hand checks P3-5 and P3-6 confirm what Finder does before the guide's words are final.

**D8. The switch is per Mac.** `install.sh --machine "<Mac>" --drop-folder "<path>" [--exports-folder "<path>"] … "<BRIMM Video>"`, or `--switch-local` for both defaults, switches a Mac, and is refused while its old drop folder holds work (`switch.js` `heldInOld`). `--drop Drop` switches back. The Mac Studio switches at deployment, on Jason's yes. This is the interface the Move to Studio app's pickers call: the two options, the two `--print` lines `  Its drop folder, on this Mac:  <path>` and `  Exports from HyperFrames, looked for in:  <path>`, and `settings.js show`'s `  Its drop folder:  <path>`, still the path alone (move.zsh reads it at 209 and 667).

**D9. Episodes from before the switch keep the old way** (files in Dropbox, layout 5 or below), until each is handed off: their holds, waits and late checks as Phase 1 built them, their claim, and their finish's check in its own run (Jason's answer to Question 2). No old code is deleted here. Their recordings stay where they are in Dropbox: they are not moved into `Original files/`, since a move in Dropbox would be a rename there.

**D10. The two-Mac rules that still bind,** because her laptop's old brimm-video may still run (Question 1): new records keep `editing` and `released: null`; no stored value is renamed (the settings' `drop` stays); nothing in Dropbox is written into, renamed or moved but by the rule; `Drop/Sallie's laptop` and the Mac Studio's old `Drop/Mac Studio` are never touched by code. Her old tool sees a local episode as one a newer Studio wrote, and leaves it alone.

**D11. The drop folder is picked, and a cloud one is warned about.** The installer takes `--drop-folder "<path>"`: a whole path, made when missing (its parent must be there). It is refused when it is, is inside, or holds: `Episodes`, `References`, `Drop` or `Unedited Video` in BRIMM Video; `~/BRIMM Video Work`, but for `~/BRIMM Video Work/Drop` itself; her chat's folder `~/BRIMM Video Studio` and the workshop `~/BRIMM Video Workshop`, where her chat reads; `~/Downloads`; or the exports folder; and, as today, a folder the transcript tool watches. A drop folder in Dropbox, iCloud Drive (`~/Library/Mobile Documents`) or elsewhere in `~/Library/CloudStorage` is allowed, by its real path, and `--print` and the run say: `Warning: this drop folder is in <Dropbox | iCloud Drive | a cloud folder>. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.` From any drop folder the import clones the video into `video/` (a whole copy when the two are on different disks), writes the record, and only then deletes the original if it is unchanged: never a rename, since a run stopped between a rename and the record would leave a video no record names, and Dropbox undid renames on 14 Oct. The chosen folder is marked as this Mac's (`.brimm-watched-by`), so two Macs never watch one shared folder, and is gated in her folder wherever it is.
- Why: Jason's words; the drop folder is where an unanswered video, perhaps a session, waits; an export or an AirDrop landing in the drop folder would be imported.
- Cost if wrong: a warning's words, or a folder refused that Jason wanted.

**D12. The exports folder is picked.** The installer takes `--exports-folder "<path>"` (by default `~/Downloads`, today's place; a cloud folder is fine, with no warning). Studio looks for HyperFrames' exports there and in Downloads, and also where an export's own record says it went. It copies the export into `final/` and writes the hand-off as today, so the hand-off file, its fixtures and `madeBy` do not change (`handoff-v2.js` names the main video by its file name in `final/`). Studio never deletes an export from a chosen exports folder, which may be shared; it still deletes the original it took from Downloads after Dropbox's check, as today.
- Cost if wrong: an export left in a folder she chose, for her to tidy. HyperFrames writes into a cloud exports folder itself, which the Dropbox rule cannot guard; the copy in `final/` is checked as today.

**D13. Phase 2's code and a local episode.** Phase 2 is not done first. Its code stays, and where it could touch a local episode it refuses with one plain line and changes nothing (L2b): the seven Final Cut commands (`push`, `cut`, `captions`, `text`, `graphic` but `ideas`, `logo`, `preset`), `release`, and `--take-over`. A Mac with `dropPath` takes the light import only (L1), and `--from-plan` refuses a video in BRIMM Video Work. The reading still makes a raw video's rough cut and its `edit/main.v0.fcpxml`, into `renders/` and `video/edit/` on this Mac, because `graphic … ideas` reads that file today; Phase 2's F3 decides them. A local episode never has a snapshot (`release` refuses it), so `app`'s rebuild and set-aside never meet one.
- Cost if wrong: a Final Cut step refused on a video nobody edits in Final Cut.

---

## The order

**Where the work happens:** Studio, a worktree of its own per builder, cut from the branch `claude/studio-local-folder`, which is cut from main at ed9ef20. Tests: `cd tool && node --test`.

| Task | What | Size | Needs |
|---|---|---|---|
| L1 | The picked drop folder, the settings, and the switch | M | main |
| L1b | The exports folder | S-M | L1 |
| L2 | Layout 6: where an episode's files are, and the other Mac | L | L1 |
| L2b | Phase 2's code refuses a local episode | S-M | L2 |
| L8 | Episodes from before the switch keep the old way | M | L2b |
| L3 | The import files a video on this Mac | L | L2 |
| L4 | Readings, copies, joins and footage on a local episode | L | L3 |
| L5 | The export's check runs behind, and nothing waits for it | L | L4, L1b (design first) |
| L6 | Original files after the hand-off | M-L | L5 |
| L7 | Open it once: drop it, and it runs until it needs her | M | L4 |
| L9 | The words and the docs | M | L6, L7 |

**Waves.** L1 first. Then L1b beside L2 (different files). Then L2b, then L8, whose tests are the net every later task keeps green. Then L3, then L4. Then L5 and L7 in parallel worktrees (different modules; both touch `edit.js`, in different functions), merged one at a time with the whole suite after each. Then L6, then L9.

**Pre-flight: tasks that share files:**

| Pair | Shared | Rule |
|---|---|---|
| L1 → every task | `settings.js` `isLocal`, `dropFolderOf`, `episodeFilesFolder`, `importingFolderOf`, `exportsFolderOf`, `cloudFolder`, `folderWords` | L1 first |
| L1b → L5 | `exports.js`'s export places; only an original from Downloads is deleted (D12) | L5 after L1b |
| L2 → L2b, L3, L4, L6, L7, L8 | `where.js` `filePlace`, `fileAt`, `onOtherMac`, `ON_OTHER_MAC`; `LOCAL_VERSION` | L2 before them |
| L2b / L7 | `edit.js` `open` and `app` (L2b: the take-over flag; L7: the copy-at-work branch) | L7 after L2b |
| L3 / L4 | `filing.js` `fileEpisode` (L3's local filing; L4's join files a part through it, join.js 496-513) | L4 after L3 |
| L4 / L5 | `late-wait.js` `keepCheckInStep` (L4 stops calling it for a local reading; L5 moves it to `filing.js` as `takeOutOfCheck`) | L5 after L4 |
| L5 → L6 | the pending kinds, `pending/<kind>/`, `finishDue`'s dispatch | L6 after L5 |
| L4 / L7, L5 / L7 | `edit.js` (`answerKind`, `app`; L5's `lateCheckWaits`, `stoppedWords`, `saveSpellings`) | different functions; one merge at a time |
| L8 → later tasks | `tool/tests/old-episodes-after-switch.test.js` | stays green |
| the skill | L7, L9 | one builder at a time on both skill files |

**Hot spots:** `tool/edit.js`, `tool/filing.js`, `tool/unedited.js`, `tool/reading.js`, the two skill files. `today-says.json` is regenerated only in a task that changes `HELP`, help lines only.

---

## Global Constraints

- **Branches:** work on `claude/studio-local-folder`, in builders' own worktrees. Never in `~/Claude Code/brimm-video-studio` (the Mac Studio's live checkout, on main), never in another session's worktree or a draft PR's branch. Nothing merges or is pushed without Jason's yes.
- **Posting:** Studio itself never posts, sends or publishes anything. Nothing here adds a way to.
- **Never read a `.env` file.** Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes. The installer runs only with `--print`.
- **Write a failing test first, then the code.** The whole suite passes before each commit: `cd tool && node --test`.
- **No test calls the real `claude`, HyperFrames, HeyGen, Final Cut or Dropbox, or the real `launchctl`.** Use the stand-ins and worlds in `tool/tests/` (`phase4.js`, `workcopy-world.js`, `guide-world.js`, `checking-world.js`, `filing.test.js`'s `world`); a test's own home and folders.
- **The contract with BRIMM Ops does not change:** `handoff.js`, `handoff-v2.js`, their fixtures, `tool/shared/`, `lib.js`, `run.js`, `madeBy`, the hand-off's name and place in `final/`, and `guide.js`'s quotes of the page's buttons.
- **The Dropbox rule holds for Dropbox:** nothing in Dropbox is written into, renamed or moved; each file is written whole on this Mac and cloned in; files first, the record last. On this Mac's own disk a file may be written whole and renamed into place.
- **D10's rules:** `editing` and `released: null` in every new record; no stored value renamed; `Drop/Sallie's laptop` and `Drop/Mac Studio` never touched by code.
- **The old way stays:** every new path branches on `record.local` (or `isLocal(settings)`); a record without `local` takes today's code, unchanged. No old code is deleted.
- **Sessions stay out:** a session's recording never goes to Dropbox, at the import or after its hand-off. Nothing new prints a session's label beyond the label, its words or a file name. Every new local folder is gated in her folder as `Episodes` is.
- **Her chat stays Studio:** a command or flag that changes gets its `HELP`, `ASKED`, `TODAY_ASKED`, `walkWords`, `WALK` entries, README row, gate-list decision and skill row in the same commit.
- **Words:** short sentences, no path, flag or command name in what she is told; Finder words for a folder. The name on screen is "BRIMM Video Studio".
- **Commits** end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the builder's own model line).

## Review Focus

1. **A session never reaches Dropbox.** Its recording stays in `video/` (the import files no copy in Dropbox), no `Original files/` move is ever owed for it or for a video held beside one, and the picked drop folder (wherever it is), `video/` and the local status folder are refused to Claude in her folder, strict and open lock. (L1's, L3's and L6's tests.)
2. **A recording leaves the Mac only when it is safe.** At the import, the original leaves the drop folder only after the record is written; a stopped run leaves it in the drop folder. After the hand-off, the Mac's copy is deleted only when its copy in `Original files/` was found whole by a check that put nothing back, the record in force lists it at its size, the Mac's file is unchanged, and no run is at work on the episode; a failed check keeps it and tells her. (L3's and L6's tests.)
3. **The other Mac changes nothing.** On a Mac that is not `local.on`, no local file is called missing, no card is offered for a video it cannot read, and every command that reads or changes the episode says the one line and writes nothing. (L2's tests.)
4. **An episode from before the switch works as it did,** on a switched Mac: its waits, holds and late checks, its finish's check in its own run, "Make online-only" in its guide, and no `Original files/` move. A layout-6 record is read as newer by older code and never written by it. (L8's and L2's tests.)
5. **`final/`'s check is never skipped and never puts back over a newer file.** A missing or short copy is put back; a file the record in force lists at another size is left; an original from Downloads is deleted only when every copy is whole and it is unchanged, and one from a chosen exports folder never; a finish killed after its hand-off still has its check made. (L5's tests.)

## How each task is built

As in Phase 1: one Sonnet builder per task, test first, in its own Agent worktree; a fresh read-only reviewer per task; the coordinator merges one at a time, runs the whole suite after each, and keeps the ledger `.superpowers/sdd/2026-11-06-local-working-folder-plan/progress.md`. **L5 is designed first** by the most capable model, as R1c was: it writes `L5-task.md` (tests, interfaces, the walk of each order of the check and a writer) within D5 and L5's rulings, and the coordinator adds it to this plan before the builder starts.

---

## Phase 3

### L1. The picked drop folder, the settings, and the switch

**Goal:** A Mac whose settings hold `dropPath` watches that folder, wherever it is, says where it is in Finder's words, and is switched only while its old drop folder holds no work. The installer takes the drop folder and the exports folder (D11, D12), warns about a cloud drop folder, and shows both with `--print`.

**Evidence:**
- `settings.js`: `dropFolder(root, machine, folder)` (44) is always in Dropbox; `settingsFault` checks `drop` (137); `planned` (393-447) computes the old and new folders and calls `heldInOld`; `plan` (477-500) prints the last lines install.sh reads; `set` refuses any change of the drop folder (567-575), because written alone it left the launch agent watching the old folder; `show` prints the folders (655, 659-660); `factsOf` (182) gives `gatedPlaces` its facts.
- `switch.js` `heldInOld` (66-187) takes the old folder by its name (67).
- Callers of `dropFolder`: `filing.js` `episodeMode` (33), `edit.js` `dropFolders` (901-911), `retry` (2145), the overview (7503) and `guide drop` (7568).
- `install.sh`: options (129-174); `WatchPaths` (312-315); the plan's lines (460-490); the drop path (522-528); the say-lines (572-582, Make available offline at 582); folders and marker (894-900); "Done" (950-955).
- `unedited.js` `uneditedFolder` (2128-2181) refuses a folder in `BRIMM Video/Drop/` with no settings naming it (2140).
- `places.js` `gatedPlaces` (62-100) gates `~/BRIMM Video Work` (76) and `~/Library/Application Support/BRIMM Video` (77); `realHomeOnly` (104-).
- `guide.js` `dropWords` (21).

**Files:** `tool/settings.js`, `tool/switch.js`, `tool/install.sh`, `tool/filing.js` (`episodeMode`), `tool/unedited.js` (`uneditedFolder`), `tool/edit.js` (`dropFolders`, `retry`, the overview, `guide drop`), `tool/guide.js` (`dropWords`), `tool/places.js`, `tool/studio.js`; tests `settings.test.js`, `install.test.js`, `switch.test.js` (or where `heldInOld` is tested), `unedited.test.js`, `guide.test.js`, `edit-guide*.test.js`, and the lock's place tests (`grep -ln "gatedPlaces" tool/tests`).

**Interfaces.** Produces, in `settings.js`:
- Two fields, each a whole path when present: `dropPath` and `exportsPath`, checked by `settingsFault` as `root` is. `dropPath` with an import other than light is a fault: `a drop folder of this Mac's own takes the light import`. `drop` keeps its values and stays in a switched Mac's settings, unread while `dropPath` is there.
- `isLocal(settings) -> boolean`: `typeof settings.dropPath === "string"`.
- `defaultDropFolder(home) -> path`: `join(workFolder(home), "Drop")`.
- `dropFolderOf(settings, home) -> path`: `settings.dropPath` on a local Mac, else `dropFolder(settings.root, settings.machine, settings.drop)`.
- `episodeFilesFolder(home, folder) -> path`: `join(episodeWork(home, folder), "video")`.
- `importingFolderOf(settings, home) -> path`: `join(home, "Library", "Application Support", "BRIMM Video", "importing")` on a local Mac, else `importingFolder(settings.root)` (L3 uses it).
- `exportsFolderOf(settings, home) -> path`: `settings.exportsPath`, else `downloadsFolder(home)` (L1b uses it).
- `cloudFolder(path, home) -> "Dropbox" | "iCloud Drive" | "a cloud folder" | ""`: by real path; under `~/Library/CloudStorage/Dropbox*` or `~/Dropbox`, "Dropbox"; under `~/Library/Mobile Documents`, "iCloud Drive"; elsewhere under `~/Library/CloudStorage`, "a cloud folder".
- `folderWords(path, home) -> string`: under the home folder, its folders after it and `, in your home folder`; under `~/Library/CloudStorage/<Provider>-<account>/`, `<Provider> › …`; else each folder of the path.
- `dropFolderFault(path, { home, root, exports }) -> string`: D11's refusals in plain words, "" when none.
- `write` and `plan` take `--drop-folder "<path>"` and `--exports-folder "<path>"`; `--drop Drop` or `"Unedited Video"` on a Mac with `dropPath` takes `dropPath` away (the switch back). `plan` prints after the JSON, in order: `The import will be: …`, `The drop folder is now: …`, `The drop folder will be: …` (each `Drop`, `Unedited Video` or a whole path), `The exports folder will be: <path>`, `The drop folder is in a cloud folder: <name>` (only when `cloudFolder` names one), then `The old drop folder: <path>` when the folder watched changes.
- `set --exports-folder "<path>"` writes `exportsPath`; `set --drop-folder …` is refused as `set --drop` is (1, the installer's line, nothing written).
- `show`: `  Its drop folder:  <path>` (the path alone) and `  Exports from HyperFrames, looked for in:  <path>`.
- `factsOf` gives `dropFolder: dropFolderOf(s, home)`; `places.js` `gatedPlaces({ …, dropFolder })` gates it (`itself`) when given.
- `switch.js` `heldInOld({ root, machine, folder, light, home, now })`: `folder`, a whole path, in place of `old`.
- `filing.js` `episodeMode(dir, settings, home)` compares with `dropFolderOf(settings, home)`.
- `guide.js` `dropWords(settings, machine, home)`: `folderWords(settings.dropPath, home)` on a local Mac, else as today.
- `install.sh`, on a `--machine` install: `--drop-folder "<path>"`, `--exports-folder "<path>"`, or `--switch-local` alone for both defaults; passed to `settings.js plan` and `write`. The installer reads the plan's lines by their words; `drop` is the will-be path when it is whole, else `$root/$drop_name/$machine`; the folder is made when missing and marked (`settings.js marker`); `WatchPaths` names it. `--print` says `  Its drop folder, on this Mac:  <path>`, D11's warning when there is a cloud line, `  Exports from HyperFrames, looked for in:  <path>`; `Make available offline` only when the drop folder is in Dropbox; no `Episodes/.importing` made on a local Mac. A line it cannot read refuses, with nothing changed.

**Failing tests first:**
- `settings.test.js`:
  - "write --drop-folder writes dropPath": `write --machine "Mac Studio" --root <root> --checkout <co> --import light --drop-folder <home>/Desktop/Drop` ends 0; the file's `dropPath` is that path and `drop` is as it was.
  - `dropFolderOf` gives `dropPath`, and today's folder with none.
  - `show` prints `  Its drop folder:  <home>/Desktop/Drop` exactly, and `  Exports from HyperFrames, looked for in:  <home>/Downloads` (or `exportsPath`).
  - `set --drop-folder <path>` ends 1 with the installer's line and writes nothing; `set --exports-folder <path>` ends 0 and writes `exportsPath`.
  - `write --drop-folder …` while `<root>/Drop/Mac Studio` holds a video is refused in `heldInOld`'s words, and writes nothing; `write --drop Drop` on a Mac with `dropPath` takes it away, and is refused while the picked folder holds a video.
  - `write --drop-folder … --import full` ends 1: `Not written: a drop folder of this Mac's own takes the light import.`
  - `dropFolderFault` refuses `<root>` itself, `<root>/Episodes/x`, `<root>/Drop/Mac Studio`, `<root>/Drop/Sallie's laptop`, `<root>/Unedited Video`, `<root>/References`, `<home>/BRIMM Video Work`, `<home>/BRIMM Video Work/<an episode folder>`, `<home>/BRIMM Video Studio/Drop`, `<home>/BRIMM Video Workshop`, `<home>/Downloads`, the exports folder, a folder inside it, its parent, a relative path, and one whose parent is not there; it allows `<home>/BRIMM Video Work/Drop`, `<home>/Desktop/Drop` and `<home>/Library/CloudStorage/Dropbox-X/The BRIMM DB/In`.
  - `cloudFolder`: "Dropbox" under `<home>/Library/CloudStorage/Dropbox-X/…`, "iCloud Drive" under `<home>/Library/Mobile Documents/…`, "a cloud folder" under `<home>/Library/CloudStorage/GoogleDrive-X/…`, the target's for a link into one, "" for `<home>/BRIMM Video Work/Drop`.
  - `folderWords`: `BRIMM Video Work › Drop, in your home folder`; `Dropbox › The BRIMM DB › In`.
  - `plan` prints its lines after the JSON in the order above, the cloud line only for a cloud folder and the old folder's only when the folder watched changes.
- `install.test.js`, each with `--print --machine "Mac Studio" --import light --handoff 2 "<root>"`:
  - `--switch-local`: `Its drop folder, on this Mac:` `<home>/BRIMM Video Work/Drop`, `WatchPaths` naming it, `Exports from HyperFrames, looked for in:` `<home>/Downloads`, no `Make available offline`, no `.importing` made, `Nothing was changed.`
  - `--drop-folder "<home>/Library/CloudStorage/Dropbox-X/In"`: the same, with D11's warning naming Dropbox and the `Make available offline` line.
  - Each `dropFolderFault` case above: refused, with nothing changed.
  - `--exports-folder` in Dropbox: shown, with no warning.
- `unedited.test.js`: `uneditedFolder` takes the picked folder as the drop folder (`episodeMode`), and still does nothing in `<root>/Drop/<Mac>` that no settings name.
- `edit-guide*.test.js`: `guide drop` opens `dropPath` (the `openFolder` stand-in gets it); the overview names it `BRIMM Video Work › Drop, in your home folder`.
- `edit.js` `dropFolders` on a local Mac lists only its own folder.
- The lock: in her folder, Read and Edit of a file in the picked drop folder are refused, strict and open lock, for `<home>/BRIMM Video Work/Drop`, `<home>/Desktop/Drop` and one in Dropbox, as a file in `<root>/Drop/Mac Studio/` is today; so are files in `<home>/BRIMM Video Work/<episode>/video/` and the local status folder.

**Steps:** tests; fail; `settings.js`; `switch.js`; callers; `install.sh`; `places.js` and `studio.js`; `guide.js`; whole suite; commit. Then the coordinator tells the Move to Studio app's session the options as built.

**Words Sallie sees:** her drop folder in Finder's words (`folderWords`), e.g. `BRIMM Video Work › Drop, in your home folder`. Jason's: D11's warning and refusals.

**Contract touched:** none. **Size:** M.

---

### L1b. The exports folder

**Goal:** Studio looks for HyperFrames' exports in the folder this Mac picked (`exportsPath`, by default Downloads), in Downloads, and where an export's own record says it went, and never deletes an export from a picked folder that is not Downloads (D12).

**Evidence:** `exports.js` looks only in Downloads: `exportsFound` (476-500, `downloadsFolder(home)` at 477), `downloadsOnce` (464-467); `lookForExports` (240-366) ends `Looked in Downloads …` (365). The finish takes an original only from Downloads (finish.js 1001, `place: "Downloads"`) and deletes it after its check (1160-1182). A file in Downloads can be a Dropbox placeholder on the Mac Studio, which the finish brings down (finish.js 112-117).

**Files:** `tool/exports.js`, `tool/finish.js`, `tool/guide.js` and `tool/app.js` (the export step's words when the folder is not Downloads), the skill twins' export rows; tests `exports.test.js`, `exports-words.test.js`, `finish*.test.js`, `guide.test.js`, `app.test.js`, `studio.test.js`.

**Interfaces.** Consumes L1's `exportsFolderOf` and `folderWords`. Produces:
- `exportsFound({ home, exports, name, folder, record, … })` lists `exports` and Downloads, once each when they are one folder; a file from `exports` has `where: "the exports folder"`.
- The finish's `taken` keeps `place: "Downloads"` only for a file from `downloadsFolder(home)`; only those are ever deleted.

**Failing tests first:**
- `exports.test.js`: with `exportsPath` a test folder holding an export of the project, it is found there; an export in Downloads is still found; the looked-in line names both, in Finder's words.
- `finish*.test.js`: an export taken from the picked folder is still there after the check passes; one taken from Downloads is deleted, as today; a placeholder in the picked folder is brought down as one in Downloads is.
- `guide.test.js`, `app.test.js`: with a picked exports folder, the export step says `Export it on This Mac, into <folder words>.`; with none, the words are as today.

**Words Sallie sees:** `Export it on This Mac, into <folder words>.`, only when the exports folder is not Downloads.

**Contract touched:** none. **Size:** S-M.

---

### L2. Layout 6: where an episode's files are, and the other Mac

**Goal:** A record can say its files are on one Mac; every reader finds each file where it is; the other Mac lists the episode and changes nothing.

**Evidence:**
- `episode.js`: `RECORD_VERSION = 4` (38), `PLANNED_VERSION = 5` (41), `NEWEST_VERSION` (42); `layoutOf` (316-325); `faultFor` (429-470), which accepts a field it does not know; `fileProblems` (687-703) and `filesProblems` (705-713), which call any listed file not in the folder "missing".
- Readers of an episode's own files in its Dropbox folder: find them all with `grep -n "found.folder\|join(folder" tool/*.js`. Among them: app.js `changedSince` (463), `adoptProject` (498), `makeProject` (534-565), 710; app-reel.js 173, 225, 240, 262, 297; edit.js `notHere` and `stillArriving` (1256-1290), `open` (1450), `markReels` (2366-2430), `finishEpisode` (2640), `show` (3176-3187), `resolveIn` (3622-3793), `reels` (4091-4139), `waitForImport` (4436), `saveSpellings` (4931-5007), `answerKind` (5983-6145), `earlierFiles` and `setAsideWritten` (6300-6450), `whichCommand` (6675), `broughtOver` (6739-6746); free.js 321; join.js 448, 501; late-wait.js `localSource` (39-); plan-project.js 88; finish.js 817; suggestions-in-main.js 81; unedited.js 672; timeline.js `clockFor` (252-268), which `graphic … ideas` reads through `clockRead` (edit.js 4566-4576).
- `findEpisode` (edit.js 788); `offlineStep` (1209-1219); the guide's step for an episode open elsewhere (guide.js `videoNext`, 427).

**Files:** `tool/episode.js`; create `tool/where.js` and `tool/tests/where.test.js`; `tool/edit.js` (`findEpisode`, `episodes`' lines, the refusal, `offlineStep`, `guideFacts`); `tool/guide.js`; every reader above; tests `episode.test.js`, a new `tool/tests/local-episode.test.js` (a world with a layout-6 record), `guide.test.js`.

**Interfaces.** Produces:
- `episode.js` `LOCAL_VERSION = 6`, `NEWEST_VERSION = 6`; `layoutOf` gives 6 for a record with `local`; `faultFor` takes `local` as undefined, null, or `{ on: <non-empty string> }` at layout 6 or above.
- `episode.js` `fileProblems(folder, record, { stat, machine, localFolder })`: a local file is looked at in `localFolder` (the episode's `video/`) on `local.on`, and not at all on another Mac; `filesProblems` takes the same options.
- `where.js`:
  - `filePlace(record, rel) -> "dropbox" | "local"`: `final/`, `Original files/`, `record/` and `PLAN_FILE_NAMES` (plan.js 247) are "dropbox"; every other name is "local" when `record.local`, else "dropbox".
  - `fileAt(ctx, { folder, record }, rel) -> path`: `join(folder, rel)` for "dropbox", `join(episodeFilesFolder(ctx.home, basename(folder)), rel)` for "local", so a part read through `partsOf` (footage.js 128) needs nothing more (L6 adds the recording's branch).
  - `onOtherMac(ctx, record) -> string`: `record.local.on` when it is not `ctx.machine`, else "".
  - `ON_OTHER_MAC(name, mac) -> string`: the line below.
- Every reader above reads through `fileAt`; every caller of `fileProblems` and `filesProblems` gives `localFolder: episodeFilesFolder(ctx.home, <folder name>)` for a local record; `offlineStep` says nothing of a local episode.

**Failing tests first:**
- `episode.test.js`: a record with `local` is written at layout 6 and read back; `readEpisode(folder, { known: 5 })` reads it as newer and `writeEpisode` refuses it at `known: 5`; `editing` and `released: null` are in it; `local: {}` and `local` at layout 5 are faults; a record without `local` is still layout 4 or 5.
- `where.test.js`: `filePlace` for `IMG.mov`, `IMG.words.json`, `edit/main.v0.fcpxml`, `final/IMG.mp4`, `Original files/IMG.mov`, `teleprompter.txt` and `record/0002.json`, with and without `local`.
- `local-episode.test.js`, on the Mac that holds it: `episodes` lists it with no file line; `app`, `show … transcript`, `which`, `reels`, `free`, `graphic … ideas` and `kind --again` find their files in `video/`; `open` and `app` say no "Make available offline" line.
- On the other Mac (`ctx.machine` "Sallie's laptop", `local.on` "Mac Studio"): `episodes` lists it as on the Mac Studio, with no file called missing; `app`, `app … reel 1`, `which`, `show`, `kind`, `kind --again`, `title`, `name`, `spell`, `finish`, `free`, `ask` and `plan … join` each say `ON_OTHER_MAC` and write nothing; no card is offered for its video while it waits for her answer; the guide's step is `It is on the Mac Studio. Carry on there.`

**Steps:** tests; fail; `episode.js`; `where.js`; `findEpisode`; the readers through `fileAt`; the refusal and the guide; whole suite; commit.

**Words Sallie sees:**
- `"<name>" is on the Mac Studio: carry on there. Nothing was changed.` (a session or a video not yet answered by its label, as every line names it).
- The guide: `It is on the Mac Studio. Carry on there.`

**Contract touched:** none. **Size:** L.

---

### L2b. Phase 2's code refuses a local episode

**Goal:** The code Phase 2 retires later meets a local episode only to refuse it, in one plain line, changing nothing (D13).

**Evidence:**
- `layerStart` (edit.js 4516-4545) is the start of `logo` (5180), `captions` (5207), `text` (5224), `graphic` (5331, whose `ideas` passes `writes: false`), `preset` (5410) and `cut` (5437); its writing path begins at `claimHeld` (4533).
- `push` (1839), `pushPart` (1696), `pushVersion` (1877), `pushReel` (2455); `release` (3875) and `releaseEpisode` (2931); `--take-over` on `open` (1435) and `app` (1567), through `claimAndBring` (1347-1430), and on `bring` (1901).
- `videosFromPlan` (unedited.js 1920-2010) refuses a light episode only when a `record/` is beside the file (1935), which a local episode's `video/` never has; `--out` is refused only in an episode with a `record/`.
- `finishWay` (edit.js 2500-2510) gives "final cut" only to a record with a push.
- The reading's raw branch (reading.js 531-575) writes `edit/main.v0.fcpxml` and renders the rough cut; `graphic … ideas` needs that file today (`clockFor`).

**Files:** `tool/where.js` (two words), `tool/edit.js` (`layerStart`, `push`, `release`, the take-over flag of `open`, `app`, `bring`), `tool/unedited.js` (`videosFromPlan`); tests `local-episode.test.js`, `unedited.test.js` (the `--from-plan` describes).

**Interfaces.** Consumes L2's `record.local` and `fileAt`. Produces in `where.js`:
- `NOT_IN_FINAL_CUT(name) -> string` and `KEPT_HERE(name) -> string`: the lines below.
- In `layerStart`, on its writing path, before `claimHeld`; at the top of `push` (main and reel) and `release` once the episode is found; and for `--take-over` before any claim: on a local record, refuse with the line.

**Failing tests first:**
- "the Final Cut commands refuse a video kept on this Mac": on a local raw episode, `push "<id>"`, `push "<id>" reel 1`, `cut "<id>" add …`, `captions "<id>" reel 1 off`, `text "<id>" add lower-third …`, `graphic "<id>" add …`, `logo "<id>" on` and `preset "<id>" --job …` each print `NOT_IN_FINAL_CUT` and end 1; the record's rev is as it was, and nothing is written under `video/` or `pushed/`.
- "`graphic … ideas` still lists a local raw video's cues", from `video/edit/main.v0.fcpxml` and the words in `video/`.
- "release refuses it": `release "<id>"` prints `KEPT_HERE`, ends 1, and writes nothing in Dropbox.
- "a take-over is refused": `open "<id>" --take-over` and `app "<id>" --take-over` print `KEPT_HERE` on its own Mac, and `ON_OTHER_MAC` on the other.
- "a local raw episode with the reading's rough cut and no project": `finish "<id>"` says the unopened words, never a Final Cut line.
- `unedited.test.js`: `--from-plan <home>/BRIMM Video Work/<folder>/video/<file>` prints `<file>: a video kept in BRIMM Video Work is its episode's own, and is never made again from its plan. Nothing was made.` and ends 2; `--out` inside BRIMM Video Work is refused the same way.

**Steps:** tests; fail; change; whole suite; commit.

**Words Sallie sees:**
- `"<name>" is edited in HyperFrames, not Final Cut. Nothing was changed.`
- `"<name>" stays on this Mac: a video is edited from start to finish on the Mac that took it in. Nothing was changed.`

**Contract touched:** none. **Size:** S-M.

---

### L8. Episodes from before the switch keep the old way

**Goal:** On a Mac switched to its picked drop folder, an episode filed before the switch works as today until it is handed off (D9), and no old code is deleted. Built right after L2b: its tests are the net every later task keeps green.

**Evidence:** Jason's answer to Question 2, "Yes, some do". What such an episode still reads of this Mac after the switch: no pending (P3-1, and `heldInOld` refuses the switch while one is owed), no status of this Mac's import in `Episodes/.importing` (likewise), and its files in its folder in Dropbox. `guide.js` `opsText` (142-146) appends `ONLINE_ONLY` (97) after the page's "taken" step of a raw video; the finish's online-only line is on its old path (finish.js 1187).

**Files:** create `tool/tests/old-episodes-after-switch.test.js` (a world whose Mac has `dropPath` and `exportsPath`, holding a layout-4 raw episode, a layout-4 finished video, and a layout-5 plan with one part in Dropbox); `tool/guide.js` (`opsText`: `ONLINE_ONLY` only for a record without `local`).

**Interfaces.** Consumes L1's settings and L2's `record.local`. Produces nothing new: every later task branches on `record.local` and leaves this world's results as they are.

**Failing tests first** (most pass at once; each later task keeps them passing):
- `episodes` lists the old raw episode with its files checked in its Dropbox folder, and no "on <Mac>" line.
- `kind "<id>" raw --private no --again` reads it the old way: the reading's files go into its Dropbox folder, and its read run waits for its own late check (`LATE_CHECK_MS`).
- `app "<id>"` makes its project from the recording in its Dropbox folder.
- `finish "<id>" --yes` writes its hand-off, and its run waits for its check as today; nothing is written in `pending/final/`.
- `spell "<id>" add …` while that check runs is refused in today's words.
- After its hand-off: nothing in `pending/original/`, and no `Original files/` in its folder.
- The guide's step after the page's "taken" step of the old raw episode ends with the "Make online-only" sentence; a local raw episode's does not.
- The old plan: `plan "<title>" join` joins the old way (the joined video filed into the plan's Dropbox folder, with its pending); a part dropped after the switch joins from its own `video/`.

**Steps:** tests; the `opsText` fork; whole suite; commit.

**Words Sallie sees:** none new. **Contract touched:** none. **Size:** M.

---

### L3. The import files a video on this Mac

**Goal:** On a local Mac, the import makes its files from the dropped video in place, as today, then files the episode on this Mac: the video cloned into `video/`, its files beside it, and only the first record in Dropbox; the original deleted from the drop folder once the record is written. No pending, no late check, no 15-minute wait.

**Evidence:** the import works on the drop file in place (`unedited.js` `workOn`, 729); Dropbox comes in only at filing (`filing.js` `fileEpisode` 122-193: `put` 142-149 clones the video and each file, the record at 176) and at the late check (`keepLateCheck`, unedited.js 815-825; `pendingFor` 195-199; `writePending` 369-375; `finishLate` 491-546, which deletes the drop file at 508). `importEpisodes` (634-835) stays alive until every pending check is made. A stopped import's folder is used again (`findFolder`, `found.reused`). Status files: `importing.js` `writeStatus` (102), `readStatuses` (123), `statusesOf` (150), `removeStatus` (165), each deriving `Episodes/.importing/` from `root`; read by edit.js 884, 1111, 2097, 2153, 7306; late-wait.js 65, 80; unedited.js 705, 1712; filing.js `heldBy` (268), `clearCrashes` (350), `releaseHeld` (606), 639, 709, 771; switch.js 80-82. `episodeHolding` (336-341) says a held video stays "until Dropbox's check of its copies passes".

**Files:** `tool/filing.js` (`fileEpisode`, `heldBy`, `clearCrashes`, `importEpisodes`), `tool/unedited.js` (`workOn`'s filing, `keepLateCheck`), `tool/importing.js`, `tool/switch.js`, every status reader above; tests `filing.test.js`, `unedited.test.js` (the light import's describes, 4730-5221), `importing.test.js`, `edit-retry*.test.js`, `switch.test.js`, the lock's place tests.

**Interfaces.** Consumes L1's `episodeFilesFolder`, `importingFolderOf`, `isLocal`, and L2's `LOCAL_VERSION`. Produces:
- `importing.js`: `writeStatus(folder, status, writeText)`, `readStatuses(folder, now)`, `statusesOf(folder, video, machines, now)`, `removeStatus(folder, video, machine, id)`: the status folder in place of `root`. Callers give `importingFolderOf(settings, home)`; edit.js keeps it as `ctx.statuses`.
- `filing.js` `heldBy({ root, statuses, video, bytes, now, gatedAs })` and `clearCrashes({ statuses, machine, now, alive, pid })`; `switch.js` `heldInOld({ …, statuses })`.
- `fileEpisode(…)` on a local Mac: `{ name, path, record }` with no `entries`.

**The order of filing on a local Mac:** make `video/` (emptied first when a stopped import left the folder) and write each made file there whole (a name of its own, then renamed); check the drop file is unchanged (`sameFile`); clone it into `video/` under a name of its own (a whole copy when the two are on different disks), check its size, and rename it into place; make `Episodes/<folder>/record/` in Dropbox and write `0001.json` by the rule, with `local: { on: machine }`; then delete the drop file, if it is unchanged. If the record cannot be written, `video/` is removed, the drop file stays, and the import ends as one that failed, as today. A drop file that cannot be deleted stays, held by its episode, and the log says so.

**Failing tests first:**
- `unedited.test.js` / `filing.test.js`, a light import on a local Mac:
  - the recording and its `.srt`, `.transcript.txt`, `.words.json`, `.cut-plan.txt`, `.cut-plan.json`, `.rough-cut.srt` and `.rough-cut.transcript.txt` are in `video/`, at the sizes the record lists;
  - the drop folder holds nothing of it when the run ends, and the run ends without waiting (no `wait` of `LATE_CHECK_MS`, no "Waiting for its late check" status);
  - `Episodes/<folder>/` in Dropbox holds `record/0001.json` and nothing else; the record is layout 6, with `local.on` this Mac, `editing` and `released: null`;
  - no pending file is written;
  - its status files are in the local importing folder while it runs, and gone after; nothing is written in `Episodes/.importing`.
- "a record that cannot be written leaves the video in the drop folder": the record write fails; the video is in the drop folder at its size; `video/` is not there; the status says it failed; the next run imports it.
- "a run stopped after the clone and before the record": the video is still in the drop folder, and the next run imports it into the same folder.
- "a run stopped after the record and before the delete": the video stays in the drop folder, held by its episode, in the words `already imported as <label> (<short id>). It stays in the drop folder for you to delete.`
- "a drop folder in Dropbox": the video is cloned out, never renamed, and deleted only after the record is written; a placeholder there is read through first, as today.
- "a Zoom download is held as today", with its status in the local folder.
- "a video dropped again under the same name and size is held by its episode", as today.
- `retry` on a local Mac finds a failed import by its local status.
- `heldInOld` on a switch from a picked folder reads the local status folder.

**Steps:** tests; fail; `importing.js` and its callers; `filing.js`, `unedited.js`; whole suite; commit.

**Words Sallie sees:** the held line above. The banner stays `Ready: <label>. In Claude, say "what's waiting?"`, and comes when the import ends, not 15 minutes later.

**Contract touched:** none. **Size:** L.

---

### L4. Readings, copies, joins and footage on a local episode

**Goal:** On a local episode, Claude's reading starts at once and puts its files into `video/`; the copy for HyperFrames starts at once from `video/`; a join reads each part from its own place and files the joined video into the plan's `video/`; nothing writes a pending or waits for a check.

**Evidence:**
- reading.js: the hold loop (307-331, `READ_LOOK_MS` 53, `READ_HOLD_MS` 54); `written` (460-648) puts its files through `keepCheckInStep` (615) and `intoEpisode` (unedited.js 1343-1690: `ownLateCheck` 1462, `replaceIn` 1642, the record 1664-1668, the wait 1674).
- edit.js: `waitForImport` (4297-4333); `answerKind` (5959; `readingWaitsUntil` at 6138); `kind --again`'s set-aside (`setAsideWritten`, 6373-6450).
- join.js: parts read at 448 and 501 (`hereWhy` reads through); a single part filed with `fileEpisode(… into …)` (496-513), then `pendingFor`/`writePending` (515-519) and "copied into Dropbox … in 15 minutes" (521-523); `afterJoin` (585-607) kickstarts the agent; `opensAt` (571-583).
- workcopy.js `makeFootageCopies` reads parts through `readAll`; plan-project.js `copyOfFootage` (86); footage.js `makePart` (403).
- late-wait.js `projectWaits` (183), `waitFacts` (171), used by app.js (106, 537), app-reel.js (126, 217, 306), edit.js (1380, 7094).
- Phase 1's parked items here: M2 (a past-due pending: reading at once, copy refused) has no local case; `reading.js` `AGAIN` (67) puts a flag in her words.

**Files:** `tool/reading.js`, `tool/unedited.js` (a local put beside `intoEpisode`), `tool/edit.js` (`waitForImport`, `answerKind`, `setAsideWritten`), `tool/join.js`, `tool/workcopy.js`, `tool/footage.js`, `tool/plan-project.js`, `tool/explainer.js`, `tool/late-wait.js` (`projectWaits`, `waitFacts` give nothing for a local record), `tool/app.js`, `tool/app-reel.js`; tests `reading.test.js`, `edit-kind.test.js`, `edit-workcopy*.test.js`, `join.test.js`, `footage*.test.js`, `plan-project*.test.js`, `app.test.js`, `edit-app*.test.js`, `late-wait.test.js`.

**Interfaces.** Produces in `unedited.js`:
- `putHere(found, files, { change, expectRev, home, writer }) -> { put: true, record } | { put: false, why }`: each file written whole into `video/` under a name of its own; each file it replaces renamed first into `video/history/<stamp> <name>`; then renamed into place; then the record written to Dropbox with `expectRev`, by the rule. A refused record write renames each replaced file back and removes the new ones, and gives `{ put: false, why }` in `intoEpisode`'s words for that case. No wait and no check.
- Callers: `reading.js` `written` for a local record (in place of `keepCheckInStep` + `intoEpisode`); join.js's filing, and `plan … voice`'s run (explainer.js), which files a voice as the plan's video; `setAsideWritten` uses `video/history/` for a local record.

**Ruling for L4: a plan is filmed on one Mac.** A planned record (layout 5) with no footage is on no Mac. The first `footage` answer for it adds `local: { on: <this Mac> }` to the plan's record in the same write (layout 6), and the join files into that Mac's `video/`. A video answered as footage on the other Mac for a plan already on this one is refused, and nothing is written. A plan whose footage began before the switch has no `local`, and joins the old way (L8); a part dropped since is read from its own `video/`. Cost if wrong: footage filmed on two Macs is dropped on one.

**Failing tests first:**
- `reading.test.js`, a raw reading of a local episode: no `READ_LOOK_MS` wait, no lock file, no mark, no pending; the reading's files are in `video/` (its Final Cut file in `video/edit/`), the replaced ones in `video/history/`; the record is written last; no `wait` of `LATE_CHECK_MS`; the notice goes at once.
- "a refused record write puts the earlier files back": the record write fails with `CHANGED`; `video/` holds the earlier files, byte for byte; the result says why, with the `AGAIN` line.
- `edit-kind.test.js`: a local raw answer starts the reading and the copy, and says `waitForReading`'s words, with no time of Dropbox's.
- `edit-workcopy*.test.js`: the copy of a local episode reads `video/<file>`, with no wait step in the panel.
- `join.test.js`: two parts joined; the joined video is in the plan's `video/`; no pending; `kickstart` never called; the notice is `Ready: "<title>" is made from its footage. In Claude, say "what's next?"`.
- A single part filed into the plan's `video/` by a clone on this Mac (the part stays its own episode).
- `footage.test.js`: the first part answered for a plan writes `local.on` into the plan's record; on the other Mac, `footage "<label>" "<plan>" talking --client no` says `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` and writes nothing.
- `app.test.js`: on a local episode `readyAt` names no Dropbox time and `projectWaits` is "".
- `AGAIN`: `Nothing was changed. Tell me what it is again, and Claude reads it again.`

**Steps:** tests; fail; `putHere`; the callers; join; the copies; `AGAIN`; whole suite; commit.

**Words Sallie sees:** the join's notice above; `AGAIN` above; `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` No line names Dropbox for a local episode.

**Contract touched:** none. **Size:** L.

---

### L5. The export's check runs behind, and nothing waits for it

**Goal:** On a local episode, the finish ends as soon as its hand-off is written. Dropbox's check of its copies in `final/` is made 15 minutes later by the launch agent's loop, from a pending on this Mac's disk. A spelling, a second hand-off or the Reels' hand-off goes ahead at once, and the check never puts an older file back over theirs. An episode from before the switch is finished as today.

**Evidence:**
- finish.js: `markChecking` (1119), the wait (1140), the check and the deletion of the originals it took (1138-1182), the online-only line (1187); the run holds the episode's lock throughout (finish-check.js header).
- What waits on it today: `lateCheckWaits` (edit.js 4648, called at 4902 and 5002), `stoppedWords`' finish branch (2275-2282), the guide's checking step (guide.js 166, 382, 428-435); `checkingNow` (finish-check.js 60) believes the marker only while the run holds the lock.
- R1c's machinery: `takeLateCheckLock` (filing.js 430), `finishDue` (a closure of `importEpisodes`, 664-702) and its loop (780-831), `settleReading` (447), `keepCheckInStep` (late-wait.js 102), the pending's `reading` mark. Pendings are `pending/<id>.json` (`pendingFile` 366), read by `readPendings` (377, `*.json` only) and `heldInOld` (switch.js 99); `clearRuns` (838) keeps a `.runs` folder an import pending names.
- The finish's check already leaves files a later record changed (`movedOn`, finish.js ~1146-1150).

**Rulings for L5** (the designer writes `L5-task.md` within them):
1. On a local episode the finish writes, after its record and hand-off, a pending `{ version: 1, kind: "final", id, name, folder, root, machine, revision, entries, took, lastCopy }`, asks the agent to run (`ctx.kickstart()` when `!ctx.agentRunning()`), and ends; its result is written then. Its work copies stay in its own folder in `.runs` until the check. `finish.checking.json` is left while the pending is there, and `checkingNow` believes the pending, not the run's lock.
2. A pending of a kind lives in `pendingFolder(home)/<kind>/<id>.json` (`final`; `original`, L6), so `readPendings` and `heldInOld`, which read only `pending/*.json`, never take one for an import's. `finishDue` dispatches by kind: none, the import's and the join's, as today; `final` here; `original` (L6). `clearRuns` keeps every folder a pending of any kind names.
3. `finishDue` makes a due `final` pending under `late-check.lock`: it reads the pending again, reads the record in force, and puts a file back only when that record lists it at the entry's bytes (as `ownLateCheck` judges); a file listed at another size, or not listed, is left. When every copy is whole and the record in force holds this revision, it deletes each original the finish took from Downloads (`took`; never one from a picked exports folder, D12) that is unchanged since; one changed is kept and said in the log. A problem is flagged as today (`flagProblem`, the notice, `finish.problem.json`).
4. A writer into `final/` of a local episode (a finish, `finish … reels`, the spellings' new hand-off) takes `late-check.lock` around its puts and record write, and takes the entries it replaces out of every pending of this episode (`keepCheckInStep`, moved into `filing.js` as `takeOutOfCheck`). It never waits on a check.
5. `lateCheckWaits` (the other Mac's finish still checking) stays for an episode from before the switch; a local episode never meets it (D3).
6. The import loop (`importEpisodes`) runs while any pending of this Mac is open, of any kind, as it does today for imports; a pending written as the loop ends is made by the next run, which the writer's kickstart or the next drop or login starts.

**Files:** `tool/finish.js`, `tool/finish-check.js`, `tool/finish-reels.js`, `tool/filing.js` (`finishDue`'s dispatch, `final`, `takeOutOfCheck`, `clearRuns`, `writePending`/`readPendings` by kind), `tool/late-wait.js` (`keepCheckInStep` moved), `tool/edit.js` (`stoppedWords`, `saveSpellings`), `tool/guide.js` (the checking step), `README.md` (the finish's late check, 461-475); tests `finish*.test.js`, `edit-finish*.test.js`, `filing.test.js`, `edit-spell*.test.js`, `guide.test.js`, `checking-world.js` users, `late-wait.test.js`, `switch.test.js`.

**Failing tests first** (the headline cases; `L5-task.md` adds the rest):
- "the finish of a local episode ends once its hand-off is written": the result is written, the lock let go and `pending/final/<id>.json` on disk, with no `wait` of `LATE_CHECK_MS`; `kickstart` called once.
- "a spelling right after a hand-off writes the next revision at once": no `Studio checks Dropbox's copies at` line; the pending no longer holds the files the spelling replaced.
- "the due check puts back a missing copy", "leaves a file the record in force lists at another size", "deletes the Downloads export only when every copy is whole and it is unchanged", "flags a problem as today".
- "a finish killed after its hand-off still has its check made": the pending is made by the next loop.
- "a writer waits for the check's lock, never for the check": with the lock held by a live check, a spelling tries again within `LOCK_WAIT_MS` and goes ahead when it is let go.
- "a pending in `pending/final/` is never read as an import's": `readPendings` and `heldInOld` leave it alone.
- "an episode from before the switch is finished as today" (L8's case stays green).

**Words Sallie sees:** gone for a local episode: `Claude's reading is written, and Studio checks Dropbox's copies at <time>.` for a finish; `The finish on <Mac> is still checking its copies in final/, until <time>. Say it again after that. Nothing was changed.`; the guide's line of when Studio checks; the finish's `To save space on this Mac, make the episode's folder online-only…`. Kept: the notice and the guide's note when a check fails.

**Contract touched:** none: the hand-off file, its name and its place are as today. **Size:** L. **Design first.**

---

### L6. Original files after the hand-off

**Goal:** Once a local video is handed off, every recording she dropped for it moves into `Original files/` in Dropbox, behind her; the Mac's copy is deleted only after Dropbox's check of the moved copy has passed; a failed check keeps it and tells her. A session's recording never moves. Every file made from a recording stays (D6).

**Evidence:** Jason's answer, "Yes, every recording"; `arch.md` finding 2 (Dropbox is the recording's only second copy today). The hand-off writers: the finish run (finish.js, after its record and hand-off, ~1095-1112), `importHandoff` (edit.js 4763: a finished video's or an iPhone clip's first hand-off, from the spellings), `saveSpellings` (4883: a new revision), `finish … reels` (finish-reels.js). `changedSince` (app.js 463) and the work copy's key (`copyPathsOf`, 431) read the recording's size and time; `cp -c` calls clonefile(2) (dropbox.js `cloneFile`, 32), whose clone keeps the source's times. A record lists only paths inside its own folder (`episode.js` `isFiles`, no `..`). A part answers `which`, `show`, `resolve` and `footage` through the gate (gate.js 14-34).

**Rulings for L6:**
1. **What moves:** the video's own recording (`video.file`), or for a video made from a plan each footage part's (`planned.filmed.parts`), each whose record has `local.on` this Mac and is not a session, holds no session mark, and is not held beside one (gate.js). The joined video, a HeyGen voice, the HyperFrames work copy, the transcripts, words, cut plans, notes, `edit/`, `renders/` and every HyperFrames project and its media stay where they are: a joined video is made by Studio, not dropped, and is what a later Reel of a plan's video is made from; the rest are small, or a project's own, or needed to make the work copy again.
2. **Where:** `Episodes/<the recording's own episode folder>/Original files/<file>`. A part's goes into the part's own folder, because a part's record can list only files in its own folder, and a part still answers `which`, `show` and `footage`. (Question 4.)
3. **When:** each hand-off writer, once the record holding the hand-off is written, calls `oweOriginals`: for each recording to move it writes `pending/original/<its episode's id>.json`, `{ version: 1, kind: "original", id, name, folder, root, machine, owed: true, entries: [], took: [], lastCopy }`, and asks the agent to run. An owed pending is due at once. Writing it again for one already moved, owed or checking changes nothing.
4. **The move,** in the agent's loop, under that episode's `late-check.lock`, put off while a detached run is at work on the episode (`runningCommand`): clone `video/<file>` into `Original files/<file>` by the rule (`cloneIn`); write the record by the rule (`expectRev`), adding `files["Original files/<file>"]` at the recording's size (the local entry stays); then the pending becomes `{ owed: false, entries: [{ from: <video/file>, to, bytes }], took: [{ path: <video/file>, id: fileId(path) }], lastCopy: now }`. A refused record write takes the clone away and leaves the pending owed for the next look.
5. **The check,** 15 minutes later (`LATE_CHECK_MS`), under the lock: `lateCheck(entries)`. A clone that had to be put back starts its 15 minutes again. When the check puts nothing back, the record in force lists each clone at its entry's bytes, and each Mac's file is unchanged since (`sameFile`), each Mac's file is deleted and the pending removed; a run at work on the episode puts the deletion off. A problem keeps the Mac's copy and the pending (with `problem`), posts the notice once, and writes `originals.problem.json` in the episode's work folder, which the guide reads.
6. **Afterwards:** `fileAt(ctx, { folder, record }, record.video.file)` gives `video/<file>` while it is on this Mac, else `Original files/<file>` in Dropbox when the record lists it; `fileProblems` calls a local recording missing only when neither is there. A reader that needs it whole brings it down as for any file in Dropbox (`isWhole`, `readThrough`).
7. **An episode from before the switch:** nothing is owed (D9).

**Files:** create `tool/originals.js` and `tool/tests/originals.test.js`; `tool/filing.js` (`finishDue`'s `original` kind); `tool/where.js` (`fileAt`'s recording branch); `tool/episode.js` (`fileProblems`); `tool/finish.js`, `tool/finish-reels.js`, `tool/edit.js` (`importHandoff`, `saveSpellings`): the calls to `oweOriginals`; `tool/guide.js` (the problem line); tests `filing.test.js`, `finish*.test.js`, `edit-spell*.test.js`, `guide.test.js`, `app.test.js`, `edit-app*.test.js`, `local-episode.test.js`.

**Interfaces.** Consumes L5's pending kinds and dispatch, L2's `fileAt`. Produces in `originals.js`:
- `originalsOf(ctx, found, record) -> [{ name, folder, record, file }]`: the recordings that move (rulings 1-2); [] for a session, a video held beside one, or an episode from before the switch.
- `oweOriginals(ctx, found, record) -> { owed: [id] }` (ruling 3).
- `moveOwed(pending, deps) -> { moved: true } | { later: true } | { why }` (ruling 4) and `checkMoved(pending, deps) -> { deleted: [path], problems: [text] }` (ruling 5), which `finishDue` calls for kind `original`.
- `ORIGINALS_PROBLEM(name) -> string`: the line below.

**Failing tests first:**
- `originals.test.js`:
  - "a raw video's recording is owed after its hand-off": after a local finish, `pending/original/<id>.json` has `owed: true`; `kickstart` called once.
  - "the move clones it into Original files and lists it": `Episodes/<folder>/Original files/<file>` is there at the recording's size, with the same `mtimeMs` (the test's clone is `cloneFile` itself, on its own folders); the record lists both entries; the Mac's copy is still in `video/`.
  - "the check deletes the Mac's copy only when the copy is whole": once due, `video/<file>` is gone; its transcript, words, cut plan and `edit/` stay; the pending is gone.
  - "a copy put back is checked again": a missing clone is put back from the Mac's copy, the Mac's copy stays, and the pending is due 15 minutes later.
  - "a problem keeps the Mac's copy and tells her": with a clone that cannot be put back, `video/<file>` stays, the notice is posted once with `ORIGINALS_PROBLEM`, `originals.problem.json` is written, and the pending keeps `problem`.
  - "a session's recording never moves": a local session handed off: no `pending/original/`, no `Original files/` in its Dropbox folder, the recording in `video/`; `oweOriginals` gives `{ owed: [] }`. So for a video held beside a session.
  - "a video made from a plan": each local part's recording moves into its own folder's `Original files/`; the joined video stays in the plan's `video/`.
  - "a run at work on the episode puts the move and the deletion off"; "a Mac's copy changed since is kept, and said in the log"; "an episode from before the switch owes nothing".
- `app.test.js`: "after the move, `app` opens the project as it was": no `recordingChanged` line, no new work copy, `changedSince` false.
- `edit-app*.test.js`: "a later Reel is made from the recording in Original files" (`app "<id>" reel 1`, a placeholder brought down first).
- `episode.test.js`: the recording gone from `video/` and listed in `Original files/` is no problem.
- `guide.test.js`: with `originals.problem.json`, the guide's step after the page's steps says `ORIGINALS_PROBLEM`.

**Steps:** tests; fail; `originals.js`; the dispatch; `fileAt` and `fileProblems`; the hand-off writers; the guide; whole suite; commit.

**Words Sallie sees:** `The recording of <name> stays on this Mac: Dropbox didn't keep its copy whole. Ask Jason.` (the notice, and the guide's line). Nothing is said when a move goes well; the log says it.

**Contract touched:** none. **Size:** M-L.

---

### L7. Open it once: drop it, and it runs until it needs her

**Goal:** After her answer nothing asks her to wait or to say a thing twice. Her answer starts the reading and the copy with no 20-second claim; "open it in HyperFrames" said while the copy is being made opens HyperFrames by itself when the copy is done.

**Evidence:** `kind` and `teachings` claim and wait `CLAIM_WAIT_MS` (20 s, edit.js 1260) in `claimAndWait` (6556-6587, called at 6006 and 6854), to keep both Macs from answering one video; with a local drop the other Mac never sees it (D3). `app` says `The video for HyperFrames is being made. … Say "open <name> in HyperFrames" again when it is done; …` (app.js `beingMade`, 99), so she says it twice. Phase 1's M7: the join's notice says "It opens in HyperFrames about 17:26" (`opensAt`, join.js 571), when its video is ready; she still has to ask.

**Files:** `tool/edit.js` (`answerKind`/`claimAndWait` for a local record; `app`'s copy-at-work branch; a detached `app --when-ready`), `tool/app.js` (`beingMade` words; the run that opens when ready), `tool/workcopy.js` (the run's end is what it waits for: `workCopyLockOf`, its result), `tool/join.js` (the notice), the skill twins (the "Open it in HyperFrames" row: when Studio says it opens by itself, tell her and stop); tests `edit-kind.test.js`, `edit-app.test.js`, `app.test.js`, `join.test.js`, `studio.test.js`.

**Interfaces.** Produces `app --when-ready "<episode folder>"` (a detached run, not in her `HELP`; like `workcopy --now`): it waits while the copy's lock is held by a live run (at most the copy's own limit), then does what `app` does (the project made and opened); if the copy failed, it opens nothing and posts the notice below. An episode from before the switch keeps its claim and today's words.

**Failing tests first:**
- `edit-kind.test.js`: a local raw answer writes its record once, with no `wait(CLAIM_WAIT_MS)`, and starts the reading and the copy; an old episode's answer still claims and waits.
- `edit-app.test.js`: with the copy at work, `app` says `Its video for HyperFrames is being made. HyperFrames opens it by itself about 17:26.` (`… by itself when it is ready.` with no measured speed), starts one `app --when-ready`, and claims nothing; a second `app` meanwhile says the same and starts nothing.
- The `--when-ready` run: when the copy's result is ok, the project is made and the `openApp` stand-in called once; when it failed, nothing opens and the notice is posted.
- `join.test.js`: the notice is `Ready: "<title>" is made from its footage. Say "open <title> in HyperFrames": it opens by itself once its video is ready.`

**Steps:** tests; fail; change; the skill row; whole suite; commit.

**Words Sallie sees:**
- `Its video for HyperFrames is being made. HyperFrames opens it by itself about 17:26.`
- The notice when it cannot: `The video for HyperFrames of <name> couldn't be made. Say "open <name> in HyperFrames" to try again; if it says this again, ask Jason.`
- The join's notice above (Phase 1's M7, now true).

**Contract touched:** none. **Size:** M.

---

### L9. The words and the docs

**Goal:** Everything she reads and every doc describes the picked drop folder, the exports folder, AirDrop, Option-drag for her editor's videos, and Original files; an episode from before the switch keeps its old words.

**Files:**
- The skill twins: the drop folder (`guide drop`), AirDrop (`Send it to this Mac with AirDrop. It lands in Downloads: drag it from there into your drop folder.`), a finished video from Dropbox (`Hold Option while you drag it into your drop folder, so Dropbox keeps its copy.`), the other Mac's line, and the export row (L1b). The "By hand in Final Cut" section (SKILL.md 246-250, SKILL-open.md 242-246) stays for Phase 2: a local video never goes that way (L2b).
- `tool/guide.js`: the overview's drop step says the AirDrop sentence for a clip.
- `tool/install.sh`: the header (16-35) and the say-lines (572-582, 950-955) for a picked folder.
- `README.md`: the folders (233-255), the import (257-268), the claim (325), "Switching a Mac's drop folder" (349: `--drop-folder`, `--exports-folder`, `--switch-local`, `--drop Drop` to go back, the cloud warning, the refusals), the finish's check (461-475), and a paragraph on Original files.
- `CLAUDE.md` (repo): "Experiments never write into the watched Dropbox folder" becomes "Experiments never write into a Mac's drop folder: a new file there starts the tool."; "Both Macs" says each Mac picks its drop and exports folders, a video's own files stay on the Mac that took it in until its hand-off, its recordings then move into Original files, and episodes from before the switch keep the old way.
- `docs/requirements.md`: a dated line under "Decisions" (6 Nov: the drop folder out of Dropbox, picked per Mac; the exports folder; every recording into Original files after the hand-off, never a session's; edits not handed between Macs).
- Tests: `studio.test.js` pins the new skill sentences; `local-episode.test.js` holds that no line said for a local episode has "Make available offline" or "Make online-only".

**Words Sallie sees:** as above. **Contract touched:** none. **Size:** M.

---

## By hand, on the Mac Studio

For the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT), a new group "Phase 3: the local working folder", numbered after the last check on the page. Claude runs every Terminal step on the Mac Studio, by absolute path, reads the output and writes the answers; Jason does only what is on screen, one plain instruction at a time; each check starts on his yes in chat. Only Jason's own recordings, never Sallie's or a client's. `<id>` is the six-character short id Claude reads from `episodes` and writes into the command itself. `… <command>` stands for `node "$HOME/Claude Code/brimm-video-studio/tool/edit.js" <command>`; `PENDING` for `"$HOME/Library/Application Support/BRIMM Video/pending"`; `<its folder in Episodes>` for the episode's folder under `$BRIMM_DB/BRIMM Video/Episodes` (`BRIMM_DB` is the page's own constant for The BRIMM DB; this public repo never names the Dropbox account's folder). The page writes every command in full, with no placeholder left.

**P3-1. Before the merge.**
1. Claude: `launchctl list | grep com.thebrimm`. Every line starts with `-`: nothing is importing.
2. Claude: `find PENDING -name '*.json' | wc -l` prints `0`: no Dropbox check is owed.
3. Claude counts what waits in the Mac Studio's drop folder in Dropbox, without listing it: `ls -A "$BRIMM_DB/BRIMM Video/Drop/Mac Studio" | grep -v -e '^\.DS_Store$' -e '^\.brimm-watched-by$' | wc -l` prints `0`. If not, the merge waits until those videos are imported.
- Answers: the three outputs.

**P3-2. The merge, and Studio brought up to date.** *(On Jason's yes at each step.)*
1. Claude: `… status` lists no run at work.
2. On Jason's yes, Claude merges this plan's pull request on GitHub (`gh pr merge`).
3. Jason, in Terminal: `git -C "$HOME/Claude Code/brimm-video-studio" pull --ff-only`. Prints `Fast-forward` and the files.
4. Claude: `git -C "$HOME/Claude Code/brimm-video-studio" log --oneline -1` (read only).
5. On Jason's yes, Claude writes her folder again: `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" studio --node "$(command -v node)"`. Prints `Written:` and her folder's path.
- Answers: what each step printed. Until P3-3 the Mac Studio works as before.

**P3-3. Switch the Mac Studio to its picked folders.** *(Changes the launch agent: on Jason's yes.)*
1. Jason, in chat: where the Mac Studio's drop folder and exports folder go. By default BRIMM Video Work › Drop, and Downloads as today. Claude writes his folders into the commands.
2. Claude: `"$HOME/Claude Code/brimm-video-studio/tool/install.sh" --print --machine "Mac Studio" --drop-folder "$HOME/BRIMM Video Work/Drop" --exports-folder "$HOME/Downloads" --import light --handoff 2 "$BRIMM_DB/BRIMM Video"` (the page's `MS_INSTALL` with the two folder options). Expect `Its drop folder, on this Mac:` with the folder, `Exports from HyperFrames, looked for in:` with the other, `WatchPaths` naming the drop folder, the old drop folder named as no longer watched, the cloud warning only if the drop folder is in one, and `Nothing was changed.`
3. On Jason's yes, the same with `--yes` in place of `--print`.
4. Claude: `plutil -p "$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist" | grep -A2 WatchPaths` names the drop folder; `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" show` prints `  Its drop folder:  ` with it, and `  Exports from HyperFrames, looked for in:  ` with the other.
- Answers: what the print said would change; the two checks.

**P3-4. A recording of yours, from drop to hand-off, with nothing waiting.**
1. Jason: in Finder, open the drop folder (BRIMM Video Work › Drop in his home folder, or the one he picked) and drag a short recording of his own into it (one or two minutes).
2. Claude: `… episodes` until it is waiting (about a minute); Jason tells Claude it is raw, no session; Claude: `… kind "<label>" raw --private no`. Expect the reading started, with no Dropbox time.
3. Claude: `… guide "<id>" tell`. Expect: read by Claude within a few minutes of the answer, not 15 minutes after the drop.
4. Claude: `… app "<id>"`. Expect `It's open in HyperFrames.`, or `HyperFrames opens it by itself about …` and then HyperFrames opening by itself.
5. Jason: in HyperFrames, Export, This Mac, into the exports folder.
6. Claude: `… finish "<id>"`, then on Jason's yes `… --yes`. Expect the hand-off shown in Finder, and the run ended within a minute or two.
7. Claude: `ls -A "<its folder in Episodes>"` prints `final` and `record`, and `Original files` a minute or two after the hand-off; `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists the recording and its files.
8. Claude: a spelling at once: `… spell "<id>" add "<a word it heard>" "<its spelling>"`. Expect it to go ahead, with no "checks Dropbox's copies" line.
- Answers: the times from drop to Ready, from the answer to read, from `app` to open; what steps 7 and 8 printed; if the exports folder is not Downloads, whether the export is still there after P3-7's wait.

**P3-5. A clip by AirDrop.**
1. Jason: AirDrop a short iPhone clip of his own to the Mac Studio. It lands in Downloads.
2. Jason: drag it from Downloads into the drop folder.
3. Jason: look in Downloads. Expect: the clip is no longer there (the drag moved it out of Dropbox, which Downloads links into on the Mac Studio).
4. Claude: answer it as an iPhone clip, no session, and `… guide "<id>" tell`. Expect it read, then `app` opening it.
- Answers: what each step did; whether Downloads still held the clip (if so, D7's words change before merge).

**P3-6. A finished video from Dropbox.**
1. Jason: in Finder, hold Option and drag a finished video of his own from Dropbox into the drop folder.
2. Jason: look in the Dropbox folder it came from. Expect: it is still there (a copy was made).
3. Claude: answer it as finished, no session; its reading runs.
- Answers: whether Dropbox kept its copy (if not, D7's words change before merge).

**P3-7. The recording reaches Original files, and leaves the Mac only after Dropbox's check.** *(P3-4's episode.)*
1. Within two minutes of P3-4's hand-off, Claude: `ls "<its folder in Episodes>/Original files"` lists the recording, and `ls "$HOME/BRIMM Video Work/<its folder>/video"` still lists it: the Mac's copy stays until the check.
2. 16 minutes later, Claude: `ls "<its folder in Episodes>/Original files"` still lists it; `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists its transcript and other files, and not the recording; `find PENDING -name '*.json' | wc -l` prints `0`.
3. Claude: `… app "<id>"`. Expect `It's open in HyperFrames.`, with no line that the recording changed.
- Answers: the three outputs, and the times.

**P3-8. A session's recording stays on the Mac.**
1. Jason: drag another short recording of his own into the drop folder. Claude answers it as a session: `… kind "<label>" session --private yes`.
2. Claude: `ls -A "<its folder in Episodes>"` prints `record` only; `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists the recording.
3. Only if the Mac Studio's teachings are on: Claude reads its teachings and hands it off as the page's session steps say, then, 31 minutes later, repeats step 2 (no `Original files`, the recording still in `video/`) and `find PENDING -name '*.json' | wc -l` prints `0`. With teachings off, Claude notes that L6's tests hold this case.
- Answers: what steps 2 and 3 printed.

**P3-9. An episode from before the switch.** Claude finds one of Jason's own that is not handed off, by its record (layout 5 or below, no `local`). Claude: `… guide "<id>"` gives its old step; `… app "<id>"` opens it as before. If it is then handed off, `ls -A "<its folder in Episodes>"` shows no `Original files`. Claude also counts the episodes from before the switch that are not handed off yet, for the later round that removes the old code.
- Answers: what each printed; the count.

**P3-10. Checks this retires.** Claude marks as skipped, with the note "retired by the local working folder": `pr9-two-macs` and the two-Mac checks 24, 29 and 34. `pr17-online-only` stays: an episode from before the switch still has the step. Nothing to run.

---

## Rulings made in this plan, for Jason to check

1. **Each Mac picks its drop folder; by default BRIMM Video Work › Drop** (D1, D11). It may not be in BRIMM Video's own folders, BRIMM Video Work (but its Drop), her chat's folder or the workshop, Downloads, or nested with the exports folder; a cloud one is allowed with a warning. Cost if wrong: a folder refused that you wanted.
2. **A video's own files live in its folder in BRIMM Video Work, under "video"** (D1). Cost if wrong: a folder's name.
3. **The plan's script files stay in Dropbox** (D1). Cost if wrong: none for her; two places for a plan's files.
4. **One Mac per video, with no claim and no 20-second wait** (D3, L7); the other Mac lists it and says "carry on there". Cost if wrong: a title or a name is changed on the Mac that holds the video.
5. **Dropbox's checks of `final/` and Original files run behind, from the launch agent** (D5, L5), only for a video kept on a Mac; an older one is finished as today. A finish killed after its hand-off no longer loses its check. Cost if wrong: L5's design pass finds another way, before any code.
6. **After the hand-off, every recording she dropped moves into Original files; the Mac's copy goes only after a check that put nothing back** (D6, L6; your "Yes, every recording"). Every file made from a recording stays, the joined video included. Cost if wrong: space on the Mac that a derived file still takes.
7. **A footage part's original goes into the part's own folder in Episodes** (L6, ruling 2; Question 4). Cost if wrong: a plan's originals are each one folder over.
8. **An episode from before the switch keeps the old way, and its recording stays where it is in Dropbox** (D9, L8; your answer to Question 2). Moving it into Original files would be a move in Dropbox. Cost if wrong: an old recording sits at its folder's top, not in Original files.
9. **The import clones each video out of the drop folder and deletes the original after the record is written, never a rename** (D11, L3). Cost if wrong: none; a crash at the wrong moment leaves a copy in the drop folder for her to delete.
10. **Studio never deletes an export from the exports folder you pick** (D12); it still deletes the one it took from Downloads after Dropbox's check, as today. Cost if wrong: exports left in that folder for her to tidy.
11. **Final Cut's commands, `release` and the take-over refuse a video kept on a Mac; such a Mac takes the light import only** (D13, L2b). Phase 2 still retires them. Cost if wrong: a Final Cut step refused on a video nobody edits in Final Cut.
12. **Phone clips come by AirDrop; her editor's videos are Option-dragged in** (D7). P3-5 and P3-6 check it. Cost if wrong: the guide's words.
13. **"Open it in HyperFrames" said once opens it by itself when its video is ready** (L7). That also makes Phase 1's join notice true (M7). Cost if wrong: HyperFrames opening while she is in another app; she asked for it.
14. **Phase 1's parked items:** M2 has no local case; M7 is fixed by L7; `reading.js`'s AGAIN words lose their flag (L4). M6 stays parked.

## Questions for Jason

1. **Is brimm-video still switched on on Sallie's laptop?** (Phase 2's Question 1.) Not blocking: this plan keeps every field her old tool checks either way. If it may be on, Claude gives you one step to turn it off when you're next at her laptop.
2. **Do any videos already in Studio still need editing or a hand-off after the change?** Answered 6 Nov, (b): "Yes, some do". They keep the old way until handed off (D9, L8), and the old code goes in a later round.
3. **When may Studio take a recording off the Mac?** Answered 6 Nov: "Yes, every recording" moves into the video's Original files in Dropbox after the hand-off, and leaves the Mac once Dropbox's check has passed (D6, L6).
4. **A planned video's footage: where do its originals go?** Not blocking; the plan builds (a).
   - (a) Each part's recording into that part's own folder in Episodes. Every record lists only its own files, and nothing else is needed.
   - (b) All of them into the planned video's own Original files. One place to look, at the cost of a new field in each part's record and a lookup from part to plan.
