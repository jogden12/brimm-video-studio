# BRIMM Video Studio: the local working folder (Phase 3 of the review changes), the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** She drops a video into a folder on her Mac, and nothing waits for Dropbox. The recording and everything made from it stay on the Mac that took it in. Only the edited export and the hand-off go to Dropbox, with the records, and a recording goes there only when she says "keep". Dropbox's check of those copies runs behind, and nothing waits for it.

**Architecture:** One setting per Mac (`drop: "local"`) switches it. A local Mac's drop folder is `~/BRIMM Video Work/Drop`, and an episode's own files go in `~/BRIMM Video Work/<episode folder>/video/`. The episode's folder in Dropbox keeps `record/`, `final/`, `kept/` and a plan's three script files. The record gains `local: { on: <Mac> }` (layout 6), and one resolver (`tool/where.js`) says where each listed file is. The late-check machinery Phase 1 built (the pending file, `late-check.lock`, `keepCheckInStep`) is reused for the two things still copied into Dropbox, `final/` and `kept/`; the import's, the reading's, the copy's and the join's checks and waits go.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages); `tool/install.sh` (zsh).

**Spec:** Jason's change list of 5 Nov 2026, Phase 3 (https://claude.ai/artifact/Nrv9VMy8AgX9tGG78YyHf1; copy `CHANGE-LIST.md` in `~/Library/Application Support/Claude/side-session-notes/local_cf396f88-dcff-4c95-91e6-1f77aa69803f/team-review-2026-11-05/`). His answers on https://claude.ai/artifact/5Z8GNkqKe68PcNctRWNnMv: `raw-copy` = "Only videos she marks 'keep'"; `phone` = "AirDrop, or record on the Mac"; `release` = r1, "videos will not be passed from one Mac to the other … This will not happen"; `features` includes "Drop it, and it runs until it needs her" ("fewer cards and no waits"); `pain` (a) "fixed by moving the raw and working folder out of Dropbox". His note of 5 Nov (memory, H7 check 67): "the working folder is local, and the export folder is on dropbox. the video file does not hit dropbox until it is edited and ready to post"; records yes, the hand-off yes, drop folders no. Jason, 6 Nov: Phase 3 does not wait for her laptop's move; all testing and deployment happen on the Mac Studio. The review's design notes: `arch.md` section 5 and finding 2, `flow.md` section 5, `reliability.md` F1-F2, in the notes folder. Phase 1's plan (`docs/superpowers/plans/2026-11-05-review-changes-plan.md`): R1a-R1d and their rulings, and its outline of Phase 3 (line ~993). Phase 2's plan (`docs/superpowers/plans/2026-11-06-final-cut-retired-plan.md`): this plan builds on it.

**Not here:**
- `release`, the hand-over snapshots and the take-over: Phase 2 removes them (its F5 and ruling 1).
- Sallie's laptop: it moves to Studio later (checks 41 to 48), and switches to the local folder then. Nothing here touches it, or her drop folder in Dropbox.
- A clean-up of recordings on the Mac: Question 3 decides; until then nothing deletes a recording.
- BRIMM Ops' code. Its guide's words about the drop folder change in step (L9), with no contract change.
- Merging. Nothing merges, and nothing is pushed, without Jason's yes.

Line numbers are at 6cdf48b (Phase 1's tip). Phase 2 moves them; a builder finds code by its function's name.

---

## The design, as rulings

These are the design note Phase 1's outline asked for before any code. Each says why, and what it costs if wrong. The three that are Jason's to decide are his questions at the end.

**D1. Where things live on a local Mac.**
- The drop folder: `~/BRIMM Video Work/Drop/`, one per Mac, with no Mac's name in it.
- An episode's own files: `~/BRIMM Video Work/<episode folder>/video/`: the recording, its transcript, words, cut plan, notes, Reel suggestions, the rough cut's captions, and `video/history/` for replaced files. A footage part's recording and a joined video go there too.
- In Dropbox, `Episodes/<episode folder>/` keeps `record/`, `final/` (the export, the final transcript, the hand-off), `kept/` (a recording she keeps) and a plan's `video guide.md`, `shot list.md` and `teleprompter.txt`.
- The import's status files: `~/Library/Application Support/BRIMM Video/importing/`.
- Why: `~/BRIMM Video Work` is on both Macs, never in Dropbox, already gated in her folder (`places.js:76`), and already holds each episode's work folder (`settings.js:63` `episodeWork`); it is on the same disk as the drop folder, so a video is filed by one rename and no copy. A plan's script files are small, made before any footage, written with no wait (`plan.js:426-445`), and let either Mac pick a plan up.
- Cost if wrong: folder names to change.

**D2. The record: layout 6.** A record of an episode filed on a local Mac holds `local: { on: "<Mac>" }` and is layout 6 (`LOCAL_VERSION`). `files` keeps its shape (a name and its bytes). A file's place is its name: `final/…`, `kept/…`, `record/…` and the plan's three files are in Dropbox; every other name is on `local.on`, in `video/`. A record without `local` is as today. New records still write `editing` and `released: null`, which the laptop's old brimm-video checks (`episode.js:448-449`); an older Studio reads a layout-6 record as one a newer Studio wrote, and never writes it (`episode.js:641-660`).
- Cost if wrong: one resolver to change.

**D3. One Mac per episode.** An episode with `local.on` is edited only on that Mac. On the other Mac, `episodes` and the guide list it as on that Mac, and every command that reads or changes it says one line and changes nothing. No claim is written or waited for on a local episode: no other Mac can answer or open it.
- Cost if wrong: a record-only change (a title, a name) must be made on the Mac that holds the video.

**D4. Nothing waits for Dropbox on a local episode.** No late check of the import, Claude's reading, the copy for HyperFrames or a join, since their files never go to Dropbox. The holds, waits and words Phase 1 built (R1a-R1d) apply only to an episode whose files are in Dropbox (layout 5 or below).

**D5. Dropbox's checks that remain run behind.** The finish's copies in `final/` and a kept recording in `kept/` are checked 15 minutes after their copy (`LATE_CHECK_MS`, unchanged), by the launch agent's loop, from this Mac's pending file, under `late-check.lock`. A file is put back only when the record in force still lists it at the size the check put in. The finish ends once its hand-off is written, and nothing waits for its check. A finish killed after its hand-off no longer loses its check: the pending is on disk.

**D6. Keep.** `keep "<episode>"` (her words: "keep the recording") copies the recording into `kept/` by the Dropbox rule, in a detached run; the record lists it; its check runs behind (D5). A session's recording is never kept. Nothing deletes a recording on the Mac (Question 3).

**D7. How videos reach the drop folder.** A phone clip comes by AirDrop (it lands in Downloads, and she drags it into the drop folder) or is recorded on the Mac. A finished video from her editor is dragged from Dropbox with Option held, so Dropbox keeps its copy. On the Mac Studio, Downloads is a link into Dropbox (`settings.js:56-58`), so an AirDropped clip is in Dropbox until she drags it out; the drag must move it, not copy it. By-hand checks P3-5 and P3-6 confirm what Finder does in both cases before the guide's words are final.

**D8. The switch is per Mac.** `install.sh --drop local` (or `settings.js set --drop local`) switches a Mac, and is refused while its old drop folder in Dropbox holds work (`switch.js` `heldInOld`, unchanged). The Mac Studio switches at deployment, on Jason's yes. Her laptop switches at its move.

**D9. Episodes from before the switch** (files in Dropbox, layout 5 or below) are Question 2's. The default in this plan, if he says they are all tests: they are listed, and any command that would read or write their files says they came in before the change. Then the old waiting code is deleted (L8).

**D10. The two-Mac rules that still bind,** because her laptop's old brimm-video may still run (Question 1): new records keep `editing` and `released: null`; no stored value is renamed; nothing in Dropbox is written into, renamed or moved but by the rule; her drop folder `Drop/Sallie's laptop` and the Mac Studio's old `Drop/Mac Studio` are never touched by code. Her old tool sees a local episode as one a newer Studio wrote, and leaves it alone.

---

## The order

**Where the work happens:** Studio, a worktree of its own per builder, cut from the branch `claude/studio-local-folder`, which is cut from Phase 2's branch tip (`claude/studio-final-cut-retired`), or from main once Phase 2 has merged. Tests: `cd tool && node --test`.

| Task | What | Size | Needs |
|---|---|---|---|
| L1 | The local drop folder, its place in the settings, and the switch | M | Phase 2 |
| L2 | Layout 6: where an episode's files are, and the other Mac | L | L1 |
| L3 | The import files a video on this Mac | L | L2 |
| L4 | Readings, copies, joins and footage on a local episode | L | L3 |
| L5 | The export's check runs behind, and nothing waits for it | L | L4 (design first) |
| L6 | Keep the recording | M | L5 |
| L7 | Open it once: drop it, and it runs until it needs her | M | L4 |
| L8 | Episodes from before the switch, and the old waiting code | L | L5, L6, L7, Question 2 |
| L9 | The words and the docs | M | L8 |

**Waves.** L1, L2, L3, L4 one after another. Then L5 and L7 in parallel worktrees (different modules; both touch `edit.js`, in different functions), merged one at a time with the whole suite after each. Then L6, then L8, then L9.

**Pre-flight: tasks that share files:**

| Pair | Shared | Rule |
|---|---|---|
| L1 → L2, L3 | `settings.js` `dropFolderOf`, `episodeFilesFolder`, `isLocal` | L1 first |
| L2 → L3, L4, L6, L7 | `where.js` `fileAt`, `onOtherMac`, `ON_OTHER_MAC`; `LOCAL_VERSION` | L2 before them |
| L3 / L4 | `filing.js` `fileEpisode` (L3's local filing; L4's join re-files a part through it, join.js:496-513) | L4 after L3 |
| L4 / L5 | `late-wait.js` `keepCheckInStep` (L4 stops calling it for a local reading; L5 moves it to `filing.js` for `final/`) | L5 after L4 |
| L5 → L6 | the pending kinds `final` and `kept`; `finishPut` in `filing.js` | L6 after L5 |
| L4 / L7 | `edit.js` `answerKind` and `app`; `app.js` | L7 after L4 |
| L5 / L7 | `edit.js` (L5: `lateCheckWaits`, `stoppedWords`, `spell`; L7: `kind`, `app`) | different functions; one merge at a time |
| L8 | every module above | after every other code task |
| the skill | L6, L7, L9 | one builder at a time on both skill files |

**Hot spots:** `tool/edit.js`, `tool/filing.js`, `tool/unedited.js`, `tool/reading.js`, the two skill files. `today-says.json` is regenerated only in a task that changes `HELP` (L6), help lines only.

---

## Global Constraints

- **Branches:** work on `claude/studio-local-folder`, in builders' own worktrees. Never in `~/Claude Code/brimm-video-studio` (the Mac Studio's live checkout, on main), never in another session's worktree or a draft PR's branch. Nothing merges or is pushed without Jason's yes.
- **Posting:** Studio itself never posts, sends or publishes anything. Nothing here adds a way to.
- **Never read a `.env` file.** Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes. The installer runs only with `--print`.
- **Write a failing test first, then the code.** The whole suite passes before each commit: `cd tool && node --test`.
- **No test calls the real `claude`, HyperFrames, HeyGen or Dropbox, or the real `launchctl`.** Use the stand-ins and worlds in `tool/tests/` (`phase4.js`, `workcopy-world.js`, `guide-world.js`, `checking-world.js`, `filing.test.js`'s `world`); a test's own home and folders.
- **The contract with BRIMM Ops does not change:** `handoff.js`, `handoff-v2.js`, their fixtures, `tool/shared/`, `lib.js`, `run.js`, `madeBy`, the hand-off's name and place in `final/`, and `guide.js`'s quotes of the page's buttons.
- **The Dropbox rule holds for Dropbox:** nothing in Dropbox is written into, renamed or moved; each file is written whole on this Mac and cloned in; files first, the record last. On this Mac's own disk a file may be written whole and renamed into place.
- **D10's two-Mac rules:** `editing` and `released: null` in every new record; no stored value renamed; `Drop/Sallie's laptop` and `Drop/Mac Studio` never touched by code.
- **Sessions stay out:** a session's recording never goes to Dropbox, by the import or by `keep`. Nothing new prints a session's label beyond the label, its words or a file name. Every new local folder is gated in her folder as `Episodes` is.
- **Her chat stays Studio:** a new command (`keep`) gets its `ASKED`, `TODAY_ASKED`, `walkWords`, `WALK` entries, a README row, a gate-list decision and its skill row, in the same commit.
- **Words:** short sentences, no path, flag or command name in what she is told; Finder words for a folder. The name on screen is "BRIMM Video Studio".
- **Commits** end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the builder's own model line).

## Review Focus

1. **A session never reaches Dropbox.** Its recording stays in `video/` (the import files no copy in Dropbox), `keep` refuses it, and the local drop folder, `video/` and the local status folder are refused to Claude in her folder (strict and open lock), as `Episodes` is. (L1's, L3's and L6's tests.)
2. **Nothing is half-filed.** A failed import, a refused record write or a stopped run leaves the recording in the drop folder or in `video/` as it was, and the record as it was. No recording is ever deleted. (L3's and L4's tests.)
3. **The other Mac changes nothing.** On a Mac that is not `local.on`, no local file is called missing, no card is offered for a video it cannot read, and every command that reads or changes the episode says the one line and writes nothing. (L2's tests.)
4. **`final/`'s check is never skipped and never puts back over a newer file.** A missing or short copy is put back; a file the record in force lists at another size is left; the originals in Downloads are deleted only when every copy is whole and each is unchanged; a finish killed after its hand-off still has its check made. (L5's tests.)
5. **Records stay readable by older code,** and an older record is never treated as layout 6. (L2's and L8's tests.)

## How each task is built

As in Phase 2: one Sonnet builder per task, test first, in its own Agent worktree; a fresh read-only reviewer per task; the coordinator merges one at a time, runs the whole suite and `node tool/tests/unused-exports.mjs` (Phase 2's F1) after each, and keeps the ledger `.superpowers/sdd/2026-11-06-local-working-folder-plan/progress.md`. **L5 is designed first** by the most capable model, as R1c was: it writes `L5-task.md` (tests, interfaces, the walk of each order of the check and a writer) within D5 and L5's rulings, and the coordinator adds it to this plan before the builder starts.

---

## Phase 3

### L1. The local drop folder, its place in the settings, and the switch

**Goal:** A Mac whose settings say `drop: "local"` watches `~/BRIMM Video Work/Drop`, says so in Finder's words, and is switched only while its old drop folder in Dropbox holds no work.

**Evidence:** `settings.js` `dropFolder(root, machine, folder)` (44) is always in Dropbox; `drop` is checked at 137 ("Unedited Video" or "Drop"); the switch is `plan()` (404-447) and `set`'s refusal (568-573), with `switch.js` `heldInOld` (66-187); `show` prints the folders (654-657). Callers of `dropFolder`: filing.js:33 (`episodeMode`), switch.js:67, edit.js:901-910 (`dropFolders`, which lists the other Mac's drop folders from Dropbox), :2145, :7568 (`guide drop`), settings.js:411-412 and :655, install.sh:522. install.sh: the drop path (522-528), `WatchPaths` (312-314), the folders made (894, 899), the marker (900), the say-lines (572-582, with Make available offline at 582). guide.js `dropWords` (21). places.js gates `~/BRIMM Video Work` (76) and, for a test home, the real one (113).

**Files:** `tool/settings.js`, `tool/install.sh`, `tool/filing.js` (33), `tool/edit.js` (`dropFolders`, 2145, `guide drop`), `tool/guide.js` (`dropWords`); tests `settings.test.js`, `install.test.js`, `switch.test.js` (or where `heldInOld` is tested), `guide.test.js`, `edit-guide*.test.js`, and the lock's place tests (`places.test.js`, `studio.test.js`, `open-lock*.test.js`: find with `grep -ln "gatedPlaces" tool/tests`).

**Interfaces.** Produces, in `settings.js`:
- `isLocal(settings) -> boolean`: `settings.drop === "local"`.
- `localDropFolder(home) -> path`: `join(workFolder(home), "Drop")`.
- `dropFolderOf(settings, home, root, machine) -> path`: `localDropFolder(home)` on a local Mac, else `dropFolder(root, machine, settings.drop)`.
- `episodeFilesFolder(home, folder) -> path`: `join(episodeWork(home, folder), "video")`.
- `importingFolderOf(settings, home, root) -> path`: `join(home, "Library", "Application Support", "BRIMM Video", "importing")` on a local Mac, else `importingFolder(root)` (L3 uses it).

**Failing tests first:**
- `settings.test.js`: `set --drop local` writes `"drop": "local"`; `dropFolderOf` gives `~/BRIMM Video Work/Drop` for it and today's folder otherwise; `show` prints `Its drop folder:  <home>/BRIMM Video Work/Drop (on this Mac)`.
- `set --drop local` while the old Dropbox drop folder holds a video is refused in `heldInOld`'s words, and writes nothing.
- `install.test.js`: `--print --machine "Mac Studio" --drop local --import light --handoff 2 "<root>"` shows the local drop folder, `WatchPaths` naming it, no `Make available offline` line, no `.importing` folder made; `Nothing was changed.`
- `edit-guide*.test.js`: `guide drop` opens the local folder (the `openFolder` stand-in gets it); the overview names it `BRIMM Video Work › Drop, in your home folder`.
- `edit.js` `dropFolders` on a local Mac lists only its own folder.
- The lock: in her folder, Read and Edit of a file in `~/BRIMM Video Work/Drop/` and in `~/BRIMM Video Work/<episode>/video/` are refused, strict and open lock, as a file in `<root>/Drop/Mac Studio/` is today; with `BRIMM_VIDEO_HOME` set, the real home's are too.

**Steps:** tests; fail; `settings.js`; callers; `install.sh`; `guide.js`; whole suite; commit.

**Words Sallie sees:** her drop folder in Finder's words: `BRIMM Video Work › Drop, in your home folder` (guide.js `dropWords` for a local Mac).

**Contract touched:** none. **Size:** M.

---

### L2. Layout 6: where an episode's files are, and the other Mac

**Goal:** A record can say its files are on one Mac; every reader finds each file where it is; the other Mac lists the episode and changes nothing.

**Evidence:** `episode.js`: `RECORD_VERSION = 4` (38), `PLANNED_VERSION = 5` (41), `NEWEST_VERSION` (42), `layoutOf` (316-324), `episodeFault` (448-449 for `editing` and `released`), `fileProblems` (687-703) and `filesProblems` (705-713), which call any listed file not in the folder "missing". Readers of the recording in the episode's folder (Dropbox mapper): app.js 464, 503, 550, 710; app-reel.js 173, 240, 297; edit.js 2640, 4344, 4436, 5983, 6145, 6675; free.js 321; join.js 448, 501, 533; late-wait.js 45; plan-project.js 88; finish.js 817, 911; suggestions-in-main.js 81; unedited.js 672; `show`'s reads (edit.js 3143-3175); and Phase 2's `video-clock.js` (the words file). `findEpisode` (edit.js:788). The guide's line for an episode open elsewhere (guide.js:325).

**Files:** `tool/episode.js`; create `tool/where.js` and `tool/tests/where.test.js`; `tool/edit.js` (`findEpisode`, `episodes`' lines, the refusal, `guideFacts`); `tool/guide.js`; every reader above; tests `episode.test.js`, a new `tool/tests/local-episode.test.js` (a world with a layout-6 record), `guide.test.js`.

**Interfaces.** Produces:
- `episode.js` `LOCAL_VERSION = 6`, `NEWEST_VERSION = 6`; a record with `local` is layout 6; `episodeFault` takes `local: { on: <non-empty string> }`.
- `episode.js` `fileProblems(folder, record, { machine, local })`: a local file is looked at in `local` (the `video/` folder) on `local.on`, and not at all on another Mac.
- `where.js`:
  - `filePlace(record, rel) -> "dropbox" | "local"`: `final/`, `kept/`, `record/` and `PLAN_FILE_NAMES` are `"dropbox"`; every other name is `"local"` when `record.local`, else `"dropbox"`.
  - `fileAt(ctx, found, rel) -> path`.
  - `onOtherMac(ctx, record) -> string`: `record.local.on` when it is not `ctx.machine`, else `""`.
  - `ON_OTHER_MAC(name, mac) -> string`: the line below.
- `findEpisode` gives `found.files`: the folder of the episode's own files on this Mac (`episodeFilesFolder`, or `found.folder` for an older record).

**Failing tests first:**
- `episode.test.js`: a record with `local` is written at layout 6 and read back; `readEpisode(folder, { known: 5 })` reads it as newer and `writeEpisode` with `known: 5` refuses it; `editing` and `released: null` are in it; a record without `local` is still layout 4 or 5.
- `where.test.js`: `filePlace` for `IMG.mov`, `IMG.words.json`, `final/IMG.mp4`, `kept/IMG.mov`, `teleprompter.txt` and `record/0002.json`, with and without `local`.
- `local-episode.test.js`, on the Mac that holds it: `episodes` lists it with no file line; `app`, `show … transcript`, `which`, `reels`, `free`, `graphic … ideas` and `kind --again` find their files in `video/`.
- On the other Mac (`ctx.machine` "Sallie's laptop", `local.on` "Mac Studio"): `episodes` lists it as on the Mac Studio, with no file called missing; `app`, `app … reel 1`, `which`, `show`, `kind`, `kind --again`, `title`, `name`, `spell`, `finish`, `free`, `ask` and `plan … join` each say `ON_OTHER_MAC` and write nothing; no card is offered for its video while it waits for her answer; the guide's step is `It is on the Mac Studio. Carry on there.`

**Steps:** tests; fail; `episode.js`; `where.js`; `findEpisode`; the readers through `fileAt`; the refusal and the guide; whole suite; commit.

**Words Sallie sees:**
- `"<name>" is on the Mac Studio: carry on there. Nothing was changed.` (a session or a video not yet answered by its label, as every line names it).
- The guide: `It is on the Mac Studio. Carry on there.`

**Contract touched:** none. **Size:** L.

---

### L3. The import files a video on this Mac

**Goal:** On a local Mac, the import makes its files from the dropped video in place, as today, then files the episode on this Mac: the video moved into `video/` by one rename, its files beside it, and only the first record in Dropbox. No pending, no late check, no 15-minute wait, and the drop folder is empty at once.

**Evidence:** the import works on the drop file in place (`unedited.js` `workOn` 729); Dropbox comes in only at filing (`filing.js` `fileEpisode` 122-193: `put` 142-149 clones the video, 155, and each file, 156; the record at 176) and at the late check (`keepLateCheck` unedited.js 815-825; `pendingFor` filing.js 195-199; `writePending` 369-375; `finishLate` 491-546, which deletes the drop file at 508). `importEpisodes` (634-835) stays alive until every pending check is made (780-831). Status files: `importing.js` `writeStatus` (102-114) into `Episodes/.importing/`; read by edit.js 884, 1111, 2097, 2153, 2182-2195, 7306-7322; late-wait.js 65, 80; unedited.js 705, 1712; filing.js 204, 217, 593; switch.js. The arrival wait reads a Dropbox placeholder through (`bringDown`, unedited.js 758).

**Files:** `tool/filing.js` (`fileEpisode`, `importEpisodes`, `heldBy` 263), `tool/unedited.js` (`workOn`'s arrival and filing, `keepLateCheck`), `tool/importing.js` (the folder through `importingFolderOf`), every status reader above; tests `filing.test.js`, `unedited.test.js` (the light import's describes, 4730-5221), `importing.test.js`, `edit-retry*.test.js`, the lock's place tests.

**Interfaces.** Consumes L1's `episodeFilesFolder`, `importingFolderOf`, `isLocal`, L2's `LOCAL_VERSION`. Produces `fileEpisode(…)` on a local Mac: `{ folder, record }` with no `entries`.

**The order of filing on a local Mac:** make `video/` and write each made file there whole (a name of its own, then renamed); check the drop file is unchanged (`sameFile`, as today); rename it into `video/` (refused, with nothing moved, when the two folders are not on one disk); make `Episodes/<folder>/record/` in Dropbox and write `0001.json` by the rule, with `local: { on: machine }`. If the record cannot be written, the video is renamed back into the drop folder, `video/` is removed, and the import ends as one that failed, as today.

**Failing tests first:**
- `unedited.test.js` / `filing.test.js`, a light import on a local Mac:
  - the recording and its `.srt`, `.transcript.txt`, `.words.json`, `.cut-plan.txt`, `.cut-plan.json`, `.rough-cut.srt` and `.rough-cut.transcript.txt` are in `video/`, at the sizes the record lists;
  - the drop folder holds nothing of it when the run ends, and the run ends without waiting (no `wait` of `LATE_CHECK_MS`, no "Waiting for its late check" status);
  - `Episodes/<folder>/` in Dropbox holds `record/0001.json` and nothing else; the record is layout 6, with `local.on` this Mac, `editing` and `released: null`;
  - no pending file is written;
  - its status files are in the local importing folder while it runs, and gone after.
- "a record that cannot be written leaves the video in the drop folder": the record write fails; the video is back in the drop folder at its size; `video/` is not there; the status says it failed; the next run imports it.
- "a Zoom download is held as today", with its status in the local folder.
- "a video dropped again under the same name and size is held by its episode", as today (`heldBy`).
- `retry` on a local Mac finds a failed import by its local status.
- The lock: Read of a status file in the local importing folder is refused in her folder, as one in `.importing` is.

**Steps:** tests; fail; `filing.js`, `unedited.js`, `importing.js`, the readers; whole suite; commit.

**Words Sallie sees:** none new. The banner stays `Ready: <label>. In Claude, say "what's waiting?"`, and comes when the import ends, not 15 minutes later.

**Contract touched:** none. **Size:** L.

---

### L4. Readings, copies, joins and footage on a local episode

**Goal:** On a local episode, Claude's reading starts at once and puts its files into `video/`; the copy for HyperFrames starts at once from `video/`; a join reads its parts from their own `video/` and files the joined video into the plan's; nothing writes a pending or waits for a check.

**Evidence:**
- reading.js: the hold loop (307-331, `READ_LOOK_MS` 53, `READ_HOLD_MS` 54); `written` (460-648) puts its files through `keepCheckInStep` (615) and `intoEpisode` (unedited.js 1343-1690: `replaceIn` 1642, the record 1664-1668, the wait 1674, `ownLateCheck` 1462-1535).
- edit.js: `waitForImport` (4297-4333); `answerKind` (6138-6150, `readingWaitsUntil`); `kind --again`'s set-aside (6312).
- join.js: parts read at 448, 501, 533 (`hereWhy` 396-404 reads through); a single part re-filed with `fileEpisode(… into …)` (496-513), then `pendingFor`/`writePending` (515-519) and "copied into Dropbox … in 15 minutes" (521-523); `afterJoin` (586-607) kickstarts the agent (598-603); `opensAt` (568-577).
- workcopy.js `makeFootageCopies` (929-947) reads parts through `readAll`; plan-project.js 88; footage.js.
- late-wait.js `projectWaits` (183), `waitFacts` (171), used by app.js (106, 537), app-reel.js (126, 217, 306), edit.js (1380, 7094).
- Phase 1's parked items this task meets: M2 (a past-due pending: reading at once, copy refused) has no local case; `reading.js` `AGAIN` (67) puts a flag in her words (`Say what it is again, with --again, …`).

**Files:** `tool/reading.js`, `tool/unedited.js` (a local put beside `intoEpisode`), `tool/edit.js` (`waitForImport`, `answerKind`, `kind --again`), `tool/join.js`, `tool/workcopy.js`, `tool/footage.js`, `tool/plan-project.js`, `tool/late-wait.js` (`projectWaits`, `waitFacts` give nothing for a local record), `tool/app.js`, `tool/app-reel.js`; tests `reading.test.js`, `edit-kind.test.js`, `edit-workcopy*.test.js`, `join.test.js`, `footage*.test.js`, `plan-project*.test.js`, `app.test.js`, `edit-app*.test.js`, `late-wait.test.js`.

**Interfaces.** Produces in `unedited.js`:
- `putHere(found, files, { change, expectRev, home, writer }) -> { put: true, record } | { put: false, why }`: each file written whole into `video/` under a name of its own; each file it replaces renamed first into `video/history/<stamp> <name>`; then renamed into place; then the record written to Dropbox with `expectRev` (by the rule). A refused record write renames each replaced file back and removes the new ones, and gives `{ put: false, why }` in `intoEpisode`'s words for that case. No wait and no check.
- Callers: `reading.js` `written` for a local record (in place of `keepCheckInStep` + `intoEpisode`); join.js's filing, and `plan … voice`'s run (explainer.js), which files a voice as the plan's video; `kind --again`'s set-aside uses `video/history/`.

**Ruling for L4: a plan is filmed on one Mac.** A planned record (layout 5) is on no Mac. The first `footage` answer for it adds `local: { on: <this Mac> }` to the plan's record in the same write (layout 6), and the join files into that Mac's `video/`. A video answered as footage on the other Mac for a plan already on this one is refused, and nothing is written. Cost if wrong: footage filmed on two Macs is dropped on one.

**Failing tests first:**
- `reading.test.js`, a raw reading of a local episode: no `READ_LOOK_MS` wait, no lock file, no mark, no pending; the reading's files are in `video/`, the replaced ones in `video/history/`; the record is written last; no `wait` of `LATE_CHECK_MS`; the notice goes at once.
- "a refused record write puts the earlier files back": the record write fails with `CHANGED`; `video/` holds the earlier files, byte for byte; the result says why, with the `AGAIN` line.
- `edit-kind.test.js`: a local raw answer starts the reading and the copy, and says `waitForReading`'s words, with no time of Dropbox's.
- `edit-workcopy*.test.js`: the copy of a local episode reads `video/<file>`, with no wait step in the panel.
- `join.test.js`: two parts joined; the joined video is in the plan's `video/`; no pending; `kickstart` never called; the notice is `Ready: "<title>" is made from its footage. In Claude, say "what's next?"`.
- A single part filed into the plan's `video/` (by a clone on this Mac, since the part stays its own episode).
- `footage.test.js`: the first part answered for a plan writes `local.on` into the plan's record; on the other Mac, `footage "<label>" "<plan>" talking --client no` says `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` and writes nothing.
- `app.test.js`: on a local episode `readyAt` names no Dropbox time and `projectWaits` is `""`.
- `AGAIN`: `Nothing was changed. Tell me what it is again, and Claude reads it again.`

**Steps:** tests; fail; `putHere`; the callers; join; the copies; `AGAIN`; whole suite; commit.

**Words Sallie sees:** the join's notice above; `AGAIN` above; `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` No line names Dropbox for a local episode.

**Contract touched:** none. **Size:** L.

---

### L5. The export's check runs behind, and nothing waits for it

**Goal:** The finish ends as soon as its hand-off is written. Dropbox's check of its copies in `final/` is made 15 minutes later by the launch agent's loop, from a pending on this Mac's disk. A spelling, a second hand-off or the Reels' hand-off goes ahead at once, and the check never puts an older file back over theirs.

**Evidence:**
- finish.js: `markChecking` (1119), the wait (1140), the check and the deletion of the originals it took (1138-1182), the online-only hint (1187); the run holds the episode's lock throughout (finish-check.js header).
- What waits on it today: `lateCheckWaits` (edit.js 4648, called at 4902 and 5002), `stoppedWords`' finish branch (2275-2282), the guide's checking step (guide.js 166, 380, 428-435); `checkingNow` (finish-check.js 60) believes the marker only while the run holds the lock.
- R1c's machinery: `takeLateCheckLock` (filing.js 430), `finishDue` (664-702) and its loop (780-831), `settleReading` (447), `keepCheckInStep` (late-wait.js 102), the pending's `reading` mark.
- The finish's check already leaves files a later record changed (`movedOn`, finish.js ~1146-1150).

**Rulings for L5** (the designer writes `L5-task.md` within them):
1. The finish writes, after its record and hand-off, a pending `{ version: 1, kind: "final", id, name, folder, root, machine, revision, entries, took, lastCopy }` into `pendingFolder(home)`, asks the agent to run (`kickstart`), and ends. Its result is written then. `finish.checking.json` is left while the pending is there, and `checkingNow` believes the pending, not the run's lock.
2. `finishDue` makes a due `final` pending under `late-check.lock`: it reads the pending again, reads the record in force, and puts a file back only when that record lists it at the entry's bytes (as `ownLateCheck` judges); a file listed at another size, or not listed, is left. When every copy is whole and the record in force holds this revision, it deletes each original the finish took (`took`) that is unchanged since; one changed is kept and said in the log. A problem is flagged as today (`flagProblem`, the notice, `finish.problem.json`).
3. A writer into `final/` (a finish, `finish … reels`, the spellings' new hand-off) takes `late-check.lock` around its puts and record write, and takes the entries it replaces out of every pending of this episode (`keepCheckInStep`, moved into `filing.js` as `takeOutOfCheck`). It never waits on a check.
4. On the other Mac nothing changes: `lateCheckWaits` (the other Mac's finish still checking) goes, since a local episode is never finished there (D3).
5. The import loop (`importEpisodes`) runs while any pending of this Mac is due, as it does today for imports.

**Files:** `tool/finish.js`, `tool/finish-check.js`, `tool/finish-reels.js`, `tool/filing.js` (`finishDue` for kind `final`, `finishPut`, `takeOutOfCheck`), `tool/late-wait.js` (`keepCheckInStep` moved), `tool/edit.js` (`lateCheckWaits` and its callers, `stoppedWords`, `spell`/`saveSpellings`), `tool/guide.js` (the checking step), `README.md` (the finish's late check, 461-475); tests `finish*.test.js`, `edit-finish*.test.js`, `filing.test.js`, `edit-spell*.test.js`, `guide.test.js`, `checking-world.js` users, `late-wait.test.js`.

**Failing tests first** (the headline cases; `L5-task.md` adds the rest):
- "the finish ends once its hand-off is written": the result is written, the lock let go and a `final` pending on disk, with no `wait` of `LATE_CHECK_MS`; `kickstart` called once.
- "a spelling right after a hand-off writes the next revision at once": no `Studio checks Dropbox's copies at` line; the pending no longer holds the files the spelling replaced.
- "the due check puts back a missing copy", "leaves a file the record in force lists at another size", "deletes the Downloads export only when every copy is whole and it is unchanged", "flags a problem as today".
- "a finish killed after its hand-off still has its check made": the pending is made by the next loop.
- "a writer waits for the check's lock, never for the check": with the lock held by a live check, a spelling tries again within `LOCK_WAIT_MS` and goes ahead when it is let go.

**Words Sallie sees:** gone: `Claude's reading is written, and Studio checks Dropbox's copies at <time>.` for a finish; `The finish on <Mac> is still checking its copies in final/, until <time>. Say it again after that. Nothing was changed.`; the guide's line of when Studio checks; the finish's `To save space on this Mac, make the episode's folder online-only…`. Kept: the notice and the guide's note when a check fails.

**Contract touched:** none: the hand-off file, its name and its place are as today. **Size:** L. **Design first.**

---

### L6. Keep the recording

**Goal:** When she says "keep the recording", Studio copies it into Dropbox, in the background; Dropbox's check of it runs behind. A session's recording is never kept.

**Evidence:** Jason's `raw-copy` answer: "Only videos she marks 'keep'"; arch.md finding 2 (Dropbox is the recording's only second copy today); the Dropbox rule (`dropbox.js` header: clone into Dropbox, never over a file, the late check).

**Files:** create `tool/keep.js` and `tool/tests/keep.test.js`; `tool/edit.js` (`COMMANDS.keep`, `HELP`, the detached run `keep --now`); `tool/filing.js` (`finishDue` makes a due `kept` pending as L5 makes a `final` one); `tool/guide.js` (the offer after the BRIMM Ops step); the skill twins; README row; tests `edit-labels.test.js` (`TODAY_ASKED`, `walkWords`), `edit-gate.test.js` (`ASKED`), `gate.test.js`, `part-f-fixes.test.js`, `edit-refs.test.js` (`WALK`), `guide.test.js`, `studio.test.js`, `filing.test.js`; `today-says.json` regenerated (help only).

**Interfaces.** Produces:
- `keep "<episode>"`: refuses a session (`gate.js` lists it among the session's refused commands), a video not yet answered, an episode on the other Mac (`ON_OTHER_MAC`), one already kept, and one whose recording is not whole in `video/`; otherwise starts `keep --now "<episode folder>"` and says so.
- `keep --now`: clones the recording from `video/` into `Episodes/<folder>/kept/<file>` by the rule (`cloneIn`; the run's own clone and Dropbox on one disk), writes the record with `files["kept/<file>"]` and `kept: { at, on }` (`expectRev`), writes a `kept` pending (L5's form, with `took: []`) and asks the agent to run.
- `filePlace` (L2) already puts `kept/` in Dropbox.

**Failing tests first:**
- `keep.test.js`: a raw episode: the clone is in `kept/`, the record lists it at its size, a `kept` pending is written, `kickstart` called; a session: refused, nothing written; on the other Mac: `ON_OTHER_MAC`; twice: `The recording of "<name>" is kept in Dropbox already.`; a recording not in `video/`: `The recording of "<name>" isn't on this Mac, so it can't be kept from here. Ask Jason.`
- `filing.test.js`: a due `kept` pending puts back a missing clone and is then removed.
- `guide.test.js`: after the BRIMM Ops step of a raw video or a clip that is not kept, the step adds the offer; once kept, it does not.
- The command tables and the README row.

**Steps:** tests; fail; `keep.js`; wiring; the guide; the skill (a row: "Keep the recording (of X)" runs `keep "<episode>"`); `today-says.json`; whole suite; commit.

**Words Sallie sees:**
- `Copying the recording of "<name>" into Dropbox, to keep. Nothing waits for it.`
- `A session's recording stays on this Mac.`
- The guide, after the page's step: `The recording is on this Mac only. To keep a copy in Dropbox, say "keep the recording".`

**Contract touched:** none. **Size:** M.

---

### L7. Open it once: drop it, and it runs until it needs her

**Goal:** After her answer nothing asks her to wait or to say a thing twice. Her answer starts the reading and the copy with no 20-second claim; "open it in HyperFrames" said while the copy is being made opens HyperFrames by itself when the copy is done.

**Evidence:** `kind` and `teachings` claim and wait `CLAIM_WAIT_MS` (20 s, edit.js:1260) in `claimAndWait` (6556-6587), to keep both Macs from answering one video; with a local drop the other Mac never sees it (D3). `app` says `The video for HyperFrames is being made. … Say "open <name> in HyperFrames" again when it is done; …` (app.js `beingMade`, 99), so she says it twice. Phase 1's M7: the join's notice says "It opens in HyperFrames about 17:26", which is when its video is ready; she still has to ask.

**Files:** `tool/edit.js` (`answerKind`/`claimAndWait` for a local record; `app`'s copy-at-work branch; a detached `app --when-ready`), `tool/app.js` (`beingMade` words; the run that opens when ready), `tool/workcopy.js` (the run's end is what it waits for: `workCopyLockOf`, its result), `tool/join.js` (the notice), the skill twins (the "Open it in HyperFrames" row: when Studio says it opens by itself, tell her and stop); tests `edit-kind.test.js`, `edit-app.test.js`, `app.test.js`, `join.test.js`, `studio.test.js`.

**Interfaces.** Produces `app --when-ready "<episode folder>"` (a detached run, not in her `HELP`; like `workcopy --now`): it waits while the copy's lock is held by a live run (at most the copy's own limit), then does what `app` does (the project made and opened); if the copy failed, it opens nothing and posts the notice below.

**Failing tests first:**
- `edit-kind.test.js`: a local raw answer writes its record once, with no `wait(CLAIM_WAIT_MS)`, and starts the reading and the copy.
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

### L8. Episodes from before the switch, and the old waiting code

**Goal:** As Question 2 decides. With (a), the default: an episode whose files are in Dropbox is listed but not edited, and the code that waited for Dropbox goes.

**(a) Every earlier episode is a test.**
- A record of layout 5 or below that is not handed off: any command that would read or write its files says `"<name>" came in before BRIMM Video Studio kept videos on the Mac. Drop its video again to start it fresh.`; `episodes` lists it under `From before the change:`; the guide skips it. A plan (layout 5, no footage) is not "before the change": it is planned on either Mac, and its first footage goes local.
- Deleted, with their tests: `late-wait.js` (`localSource`, `lateCheckAt`, `ownCheckOnly`, `readingWaitsUntil`, `lateWaitFor`, `waitFacts`, `projectWaits`, `readingCheckAt`); `edit.js` `waitForImport`, `lateCheckOwed` (2094-2129), `stillArriving`, `bring` and `claimAndBring`'s bring step, `offlineStep` (1207-1219), `kind --here` with `notHereYet` and its online-only line (5614-5628, 5983); `unedited.js` `importHold`'s owed and due states and `intoEpisode`'s Dropbox put with `ownLateCheck`, once nothing calls them; `reading.js`'s hold loop, `READ_HOLD_MS`, `READ_LOOK_MS`, `asFiled`; the import's pending (`keepLateCheck`, `pendingFor`, the import half of `finishLate`); join's pending; `app.js` `stillReading`'s time, `notWholeYet`, `readListed`'s window; `app-reel.js` `reelNotWholeYet`; `guide.js` `waitWords`, `copyStep`'s wait, `WORK_COPY_WAIT_STEP`; the claim and `claimAndWait` (no episode left needs them; new records still write `editing: null`).
- Kept: `dropbox.js` (the rule, `lateCheck`, `readThrough` for the References folder and Downloads); the pending machinery L5 and L6 use (`writePending`, `readPendings`, `finishDue`, `takeLateCheckLock`, `takeOutOfCheck`, and `settleReading` for a writer killed while it held its mark); `filesProblems` for Dropbox files.
- **(b) Some earlier episodes must be finished:** L8 is not built now. The old code stays for records of layout 5 and below, and a later round removes it once they are handed off.

**Files:** as listed; tests: R1a-R1d's (`late-wait.test.js`, the wait cases of `reading.test.js`, `filing.test.js`, `edit-kind.test.js`, `edit-guide.test.js`, `app.test.js`, `edit-app*.test.js`, `edit-checking-refusals.test.js`), `edit-claim.test.js`, `edit-two-macs.test.js`.

**Failing tests first (a):** the "came in before" line for each command group (`app`, `kind --again`, `ask`, `finish`, `spell`, `free`, `which`, `show`); `episodes`' heading; the guide skips it; `unused-exports.mjs` prints nothing for the modules above.

**Words Sallie sees (a):** the line and heading above. **Contract touched:** none. **Size:** L (mostly deletion).

---

### L9. The words and the docs

**Goal:** Everything she reads and every doc describes the local folder: where to drop, AirDrop, Option-drag for her editor's videos, keep, and no Finder steps for Dropbox.

**Files:**
- The skill twins: the drop folder (`guide drop`), AirDrop (`Send it to this Mac with AirDrop. It lands in Downloads: drag it from there into your drop folder.`), a finished video from Dropbox (`Hold Option while you drag it into your drop folder, so Dropbox keeps its copy.`), keep (L6's row), the other Mac's line, and no "Make available offline" or "online-only" (SKILL.md 248, 250).
- `tool/guide.js`: `ONLINE_ONLY` (97, appended at 145) goes; the drop step of the overview says the AirDrop sentence for a clip.
- `tool/install.sh` say-lines (572-582, 950-955).
- `README.md`: the folders (233-255), the import (257-271), the claim (325-326), the finish's check (461-475).
- `CLAUDE.md` (repo): "Experiments never write into the watched Dropbox folder" becomes "into a drop folder"; "Both Macs" says each Mac's drop and working folders are local.
- `docs/requirements.md`: a dated line under "Decisions".
- `docs/setup/sallies-laptop.md`: one line: at her move, her laptop switches to the local folder too (`--drop local`).
- The By-Hand page's laptop checks (44 and 46) change with this, when it merges: her installer line gains `--drop local`, and "about 15 minutes after Ready" goes.
- BRIMM Ops, in step (its own repository and branch; no contract change): `docs/guide/brimm-ops-guide.html`'s "drop folder" and "Make online-only" lines.
- Tests: `plain-words.test.js` gains "Make online-only" and "Make available offline" among the words her lines never hold; `studio.test.js` pins the new skill sentences.

**Words Sallie sees:** as above. **Contract touched:** none (BRIMM Ops' guide is words only). **Size:** M.

---

## By hand, on the Mac Studio

For the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT), a new group "Phase 3: the local working folder", numbered after Phase 2's checks. Claude runs every Terminal step on the Mac Studio, by absolute path, reads the output and writes the answers; Jason does only what is on screen, one plain instruction at a time; each check starts on his yes in chat. Only Jason's own recordings, never Sallie's or a client's. `<id>` is the six-character short id Claude reads from `episodes` and writes into the command itself. `…/tool/edit.js` and `… <command>` stand for `node "$HOME/Claude Code/brimm-video-studio/tool/edit.js" <command>`; the page writes every command in full, with no placeholder left.

**P3-1. Before the switch.**
1. Claude: `launchctl list | grep com.thebrimm`. Every line starts with `-`: nothing is importing.
2. Claude: `ls -A "$HOME/Library/Application Support/BRIMM Video/pending" | wc -l` prints `0`: no Dropbox check is owed.
3. Claude counts what waits in the Mac Studio's drop folder in Dropbox, without listing it (`BRIMM_DB` is the page's own constant for The BRIMM DB; this public repo never names the Dropbox account's folder): `ls -A "$BRIMM_DB/BRIMM Video/Drop/Mac Studio" | grep -v -e '^\.DS_Store$' -e '^\.brimm-watched-by$' | wc -l` prints `0`. If not, the switch waits until those videos are imported.
- Answers: the three outputs.

**P3-2. The merge, and Studio brought up to date.** As Phase 2's P2-2: Claude merges on Jason's yes; Jason pulls (`git -C "$HOME/Claude Code/brimm-video-studio" pull --ff-only`); Claude checks the commit and, on his yes, writes her folder again (`node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" studio --node "$(command -v node)"`).

**P3-3. Switch the Mac Studio to the local drop folder.** *(Changes the launch agent: on Jason's yes.)*
1. Claude: `"$HOME/Claude Code/brimm-video-studio/tool/install.sh" --print --machine "Mac Studio" --drop local --import light --handoff 2 "$BRIMM_DB/BRIMM Video"` (the page's `MS_INSTALL` with `--drop local`). Expect the drop folder `BRIMM Video Work/Drop` in the home folder, `WatchPaths` naming it, and `Nothing was changed.`
2. On Jason's yes, the same with `--yes` in place of `--print`.
3. Claude: `plutil -p "$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist" | grep -A2 WatchPaths` names the home folder's `BRIMM Video Work/Drop`; `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" show` prints `Its drop folder:` with that folder and `(on this Mac)`.
- Answers: what the print said would change; the two checks.

**P3-4. A recording of yours, from drop to hand-off, with nothing waiting.**
1. Jason: in Finder, Go › Home, open BRIMM Video Work › Drop, and drag a short recording of his own into it (one or two minutes).
2. Claude: `node "…/tool/edit.js" episodes` until it is waiting (about a minute); Jason tells Claude it is raw, no session; Claude: `… kind "<label>" raw --private no`. Expect the reading started, with no Dropbox time.
3. Claude: `… guide "<id>" tell`. Expect: read by Claude within a few minutes of the answer, not 15 minutes after the drop.
4. Claude: `… app "<id>"`. Expect `It's open in HyperFrames.`, or `HyperFrames opens it by itself about …` and then HyperFrames opening by itself.
5. Jason: in HyperFrames, Export, This Mac.
6. Claude: `… finish "<id>"`, then on Jason's yes `… --yes`. Expect the hand-off shown in Finder, and the run ended within a minute or two.
7. Claude lists the episode's folder in Dropbox: `ls -A "<its folder in Episodes>"` prints `final` and `record` only; and on this Mac: `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists the recording and its files.
8. Claude: a spelling at once: `… spell "<id>" add "<a word it heard>" "<its spelling>"`. Expect it to go ahead, with no "checks Dropbox's copies" line.
9. After 16 minutes, Claude: `ls -A "$HOME/Library/Application Support/BRIMM Video/pending" | wc -l` prints `0`: the check of `final/` was made.
- Answers: the times from drop to Ready, from the answer to read, from `app` to open; what steps 7 to 9 printed.

**P3-5. A clip by AirDrop.**
1. Jason: AirDrop a short iPhone clip of his own to the Mac Studio. It lands in Downloads.
2. Jason: drag it from Downloads into BRIMM Video Work › Drop.
3. Jason: look in Downloads. Expect: the clip is no longer there (the drag moved it out of Dropbox, which Downloads links into on the Mac Studio).
4. Claude: answer it as an iPhone clip, no session, and `… guide "<id>" tell`. Expect it read, then `app` opening it.
- Answers: what each step did; whether Downloads still held the clip (if so, D7's words change before merge).

**P3-6. A finished video from Dropbox.**
1. Jason: in Finder, hold Option and drag a finished video of his own from Dropbox into BRIMM Video Work › Drop.
2. Jason: look in the Dropbox folder it came from. Expect: it is still there (a copy was made).
3. Claude: answer it as finished, no session; its reading runs.
- Answers: whether Dropbox kept its copy (if not, D7's words change before merge).

**P3-7. Keep the recording.**
1. Claude: `… keep "<id>"` for P3-4's episode. Expect `Copying the recording of "<name>" into Dropbox, to keep. Nothing waits for it.`
2. After 16 minutes, Claude: `ls "<its folder in Episodes>/kept"` lists the recording, and the pending folder is empty.
- Answers: both outputs.

**P3-8. An episode from before the switch.** *(Per Question 2.)* Claude: `… app "<an earlier id>"`. Expect the "came in before" line with (a); with (b), it opens as it did.

**P3-9. Checks this retires.** Claude marks as skipped, with the note "retired by the local working folder": `pr9-two-macs`, `pr17-online-only`, and the two-Mac checks 24, 29 and 34. Nothing to run.

---

## Rulings made in this plan, for Jason to check

1. **Her drop folder is BRIMM Video Work › Drop, on each Mac** (D1). Already gated, never in Dropbox, on the same disk. Cost if wrong: a folder's name.
2. **A video's own files live in its folder in BRIMM Video Work, under "video"** (D1). Cost if wrong: a folder's name.
3. **The plan's script files stay in Dropbox** (D1). They are small, made before any footage, and need no wait. Cost if wrong: none for her; two places for a plan's files.
4. **One Mac per video, with no claim and no 20-second wait** (D3, L7); the other Mac lists it and says "carry on there". Cost if wrong: a title or a name is changed on the Mac that holds the video.
5. **Dropbox's checks of `final/` and a kept recording run behind, from the launch agent** (D5, L5), reusing Phase 1's lock. A finish killed after its hand-off no longer loses its check. Cost if wrong: L5's design pass finds another way, before any code.
6. **"Keep" is her words, "keep the recording", offered once after the hand-off** (L6); a session's recording is never kept. Cost if wrong: one more card, if you want her asked at the hand-off instead.
7. **Phone clips come by AirDrop; her editor's videos are Option-dragged in, so Dropbox keeps its copy** (D7). P3-6 checks it. Cost if wrong: the guide's words.
8. **"Open it in HyperFrames" said once opens it by itself when its video is ready** (L7). That also makes Phase 1's join notice true (M7). Cost if wrong: HyperFrames opening while she is in another app; she asked for it.
9. **Phase 1's parked items:** M2 has no local case; M7 is fixed by L7; `reading.js`'s AGAIN words lose their flag (L4). M6 stays parked.

## Questions for Jason

Asked one at a time, in this order, after Phase 2's two (the first is the same question, asked once).

1. **Is brimm-video still switched on on Sallie's laptop?** (Phase 2's Question 1.) Phase 3 keeps every field her old tool checks either way; if it may be on, Claude gives you one step to turn it off when you're next at her laptop.
2. **Do any videos already in Studio still need editing or a hand-off after the change?**
   - (a) No, they're all tests. Studio lists them but stops editing them, and the code that waited for Dropbox is deleted (L8).
   - (b) Yes, some. Studio keeps the old way for those until they're handed off; the old code goes in a later round.
3. **When may Studio take a recording off the Mac?** Today it never does, and Dropbox holds every recording. After the change, a recording she doesn't keep is only on her Mac.
   - (a) Only once it's kept in Dropbox: then "free" also takes the recording off the Mac.
   - (b) Never: she or you delete recordings by hand in Finder.
