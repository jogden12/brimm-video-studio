# BRIMM Video Studio: the local working folder (Phase 3 of the review changes), the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** She drops a video into the folder her Mac picked, and nothing waits for Dropbox. The recording and everything made from it stay on the Mac that took it in. At the hand-off, every recording she dropped for the video is copied into its episode's `Original files` folder in Dropbox, and leaves the Mac once Dropbox's check of that copy has passed and Dropbox reports it uploaded. The edited export, its transcript, the hand-off and the records go to Dropbox as today; Dropbox's checks run behind, and nothing waits for them. A session's recording never goes to Dropbox.

**Architecture:** Two settings per Mac, picked at install: `dropPath` (by default `~/BRIMM Video Work/Drop`) and `exportsPath` (by default `~/Downloads`). On a Mac with `dropPath`, an episode's own files go in `~/BRIMM Video Work/<episode folder>/video/`, its record gains `local: { on: <Mac> }` (layout 6), and `tool/where.js` says where each listed file and folder is. The episode's folder in Dropbox keeps `record/`, `final/`, `history/`, `Original files/` and a plan's three script files. The late-check machinery Phase 1 built (pendings on this Mac's disk, `late-check.lock`, the launch agent's loop) checks three kinds behind the work: the first record, `final/` and `Original files/`; a small Swift helper reads whether Dropbox has uploaded a copy. Episodes filed before the switch keep the old way until handed off, so no old code is deleted. Phase 2 (Final Cut, the full import, `release` and the take-over retired) is merged into main first, and this plan builds on it: none of that code is left to meet a video kept on a Mac (D13).

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages); `tool/install.sh` (zsh); one Swift helper, a script beside `faces.swift`, read synchronously.

**Spec:**
- Jason's change list of 5 Nov 2026, Phase 3 (https://claude.ai/artifact/Nrv9VMy8AgX9tGG78YyHf1; copy `CHANGE-LIST.md` in `~/Library/Application Support/Claude/side-session-notes/local_cf396f88-dcff-4c95-91e6-1f77aa69803f/team-review-2026-11-05/`). His answers on https://claude.ai/artifact/5Z8GNkqKe68PcNctRWNnMv: `phone` = "AirDrop, or record on the Mac"; `release` = r1, "videos will not be passed from one Mac to the other … This will not happen"; `features` includes "Drop it, and it runs until it needs her"; `pain` (a) "fixed by moving the raw and working folder out of Dropbox". His note of 5 Nov (H7 check 67): "the working folder is local, and the export folder is on dropbox. the video file does not hit dropbox until it is edited and ready to post".
- Jason, 6 Nov: "of all the changes that came out of the review, moving the drop folder out of Dropbox is top priority … I would like to implement that one change and merge it to main." Later that day, told that L1 was built, he chose "Phase 2 first": Phase 2 was built and merged into main first (e99f537, PR #44), main was merged into this branch after L1 (660ef9b), and this plan builds on main with Phase 2 in it and still merges alone.
- Jason, 6 Nov: recordings after editing, "Yes, every recording"; Question 2, "Yes, some do"; the folders, "the app installer should allow the user to pick or create the Drop folder in a location of their choosing with a warning that creating it in Dropbox or other 'cloud' folders could cause issues. they should also be able to choose which folder exports of edited videos go into. Cloud based folders are fine for this step, especially if they want to share with other users or computers".
- Jason, 6 Nov, on this plan's review: the move is made "Right away", at the hand-off; the Mac's copy goes "When Dropbox says uploaded"; parts that show a client, "Yes, move them too"; "airdropped and other downloaded videos can land in dropbox to start, but brimm video studio does not touch them until they are in the app's drop folder"; a part's original goes in "Each part's folder"; and to L9's change of the CLAUDE.md rule on experiments and the drop folder, "Yes, change it".
- Jason, 5-6 Nov: edits are not handed between Macs; Sallie isn't using brimm-video now; nothing here touches the MacBooks; all testing and deployment are on the Mac Studio, which switches at deployment on his yes.
- The coordinator's rulings on the review (6 Nov): the guide's words change only in step with brimm-operations; Jason deletes the old `Drop/Mac Studio` by hand; this Mac's statuses are written locally and every Mac's are read; leaving `dropPath` takes `--switch-back`.
- The review's design notes: `arch.md` section 5 and finding 2, `flow.md` section 5, `reliability.md` F1-F2. Phase 1's plan, `docs/superpowers/plans/2026-11-05-review-changes-plan.md`: R1a-R1d, their rulings, and its outline of Phase 3 (line 993).

**Not here:**
- Phase 2 (Final Cut retired; `release`, its snapshots and the take-over removed; the full import removed): built first, on Jason's "Phase 2 first", and merged into main as e99f537 (PR #44). This plan builds on it (D13); L2b, which made its code refuse a local episode, is dropped.
- The removal of the old waiting code (R1a-R1d, the claim, `bring` for imports): a later round, once no episode from before the switch is left to hand off.
- The MacBooks (Sallie's laptop, Jason's MacBook), their drop folders in Dropbox, her setup doc and the By-Hand page's laptop checks. Each MacBook picks its folders at its move, through the Move to Studio app, whose pickers are another session's (D8 says what they pass).
- BRIMM Ops' code. Its guide's lines that a switched Mac makes wrong are listed under "In step with brimm-operations"; the BRIMM Ops session changes them at merge time.
- Merging. Nothing merges, and nothing is pushed, without Jason's yes.

Line numbers are at 660ef9b: main with Phase 2 (e99f537) merged into this branch after L1 (c0e4e46, af3d75a). L1's own section keeps the numbers it was built from, at 5bb0065. A builder finds code by its function's name.

---

## The design, as rulings

Each says why, and what it costs if wrong.

**D1. Where things live.**
- The drop folder: picked per Mac (D11); by default `~/BRIMM Video Work/Drop/`.
- An episode's own files: `~/BRIMM Video Work/<episode folder>/video/`: the recording, its transcript, words, cut plan, notes, Reel suggestions, the rough cut's captions and a session's teachings files. A footage part's recording and a joined video go there too. (Since Phase 2 no new episode has `edit/` or `media/`: no Final Cut file or picture is made. The rough cut's render stays in the episode's work folder, in `renders/`, as for any episode.) A local file set aside goes into `video/history/`, unlisted. `video/.import.json` names the import that made the folder (L3).
- In Dropbox, `Episodes/<episode folder>/` keeps `record/`, `final/` (the export, the final transcript, the hand-off), `history/` (what is set aside from there, listed as today), `Original files/` (D6) and a plan's `video guide.md`, `shot list.md` and `teleprompter.txt`.
- The import's status files: this Mac writes its own in `~/Library/Application Support/BRIMM Video/importing/`; every reader reads those and `Episodes/.importing`, where a Mac still on a Dropbox drop folder writes, so another Mac's import still holds a reading (L3).
- Why: `~/BRIMM Video Work` is on every Mac, never in Dropbox, gated in her folder already (`places.js` `gatedPlaces`, 78), and holds each episode's work folder (`settings.js` `episodeWork`, 64); no HyperFrames project is ever called `video` (`project.js` `projectName`, 86, ends every name with a short id). A plan's script files are small, made before any footage, and written with no wait.
- Cost if wrong: folder names to change.

**D2. The record: layout 6.** A record of an episode filed on a Mac with `dropPath` holds `local: { on: "<Mac>" }` and is layout 6 (`LOCAL_VERSION`). `files` keeps its shape. A file's place is its name: `final/…`, `history/…`, `Original files/…`, `record/…` and the plan's three files are in Dropbox; every other name is on `local.on`, in `video/`. After the move (L6), `local` also holds `original: { file, bytes, mtimeMs }`, the recording as it was on the Mac. A record without `local` is as today. New records still write `editing` and `released: null`, which the laptop's old brimm-video checks (`episode.js` `faultFor`, 448-449); an older Studio reads a layout-6 record as one a newer Studio wrote, and never writes it (`readEpisode` 575, `writeEpisode` 646).
- Cost if wrong: one resolver to change.

**D3. One Mac per episode.** Edits are not handed between Macs (Jason, 5 Nov). An episode with `local.on` is edited only on that Mac. On another Mac, `episodes` and the guide list it as on that Mac, and every command that reads or changes it says one line and changes nothing. No claim is waited for on a local episode (L7); a claim that `open`, `app` or `finish` writes is still written, as today, and is harmless: another Mac refuses a local episode by `local.on`, at the gate, before it reads any claim.
- Cost if wrong: a record-only change (a title, a name) must be made on the Mac that holds the video.

**D4. Nothing waits for Dropbox on a local episode.** No late check of Claude's reading, the copy for HyperFrames or a join, since their files never go to Dropbox. Phase 1's holds, waits and words (R1a-R1d) apply only to an episode whose files are in Dropbox. A read run at work still holds the HyperFrames project until its reading is in the record (`projectWaits` "reading"): that wait is the reading's, not Dropbox's.

**D5. Dropbox's checks that remain run behind.** On a local episode three things still go into Dropbox, and each is checked 15 minutes after its copy (`LATE_CHECK_MS`, unchanged) by the launch agent's loop, from this Mac's pendings, under `late-check.lock`: the import's first record and the finish's copies in `final/` (L5), and a recording's copy in `Original files/` (L6). A file is put back only when the record in force still lists it at the size the check put in. Nothing she does waits for a check. A finish killed after its pending is written no longer loses its check. An episode from before the switch is checked as today (D9).

**D6. Original files after the hand-off.** At the hand-off, every recording she dropped for a video kept on a Mac is copied into `Original files/` in Dropbox, by the rule: a footage part's into its own episode's folder, one that shows a client included (Jason: "Yes, every recording"; "Yes, move them too"; "Each part's folder"). Its copy on the Mac is deleted only once Dropbox's check of the moved copy has passed and Dropbox reports that copy uploaded (Jason: "When Dropbox says uploaded"). If the check fails, or the flag cannot be read, the Mac's copy stays; a failed check is told to her. A session's recording, and one held beside a session, never moves: the gate is asked when the move is owed, when it is made, and before the Mac's copy is deleted. A video that becomes a session after its copy was made is left as it is in Dropbox, and Jason is told in one plain line that the copy is there and in Dropbox's history (Jason: "Right away"). Every file made from a recording stays where it is. Details: L6.

**D7. How videos reach the drop folder.** A phone clip comes by AirDrop (it lands in Downloads, and she drags it into the drop folder) or is recorded on the Mac. A finished video from her editor is dragged from Dropbox with Option held, so Dropbox keeps its copy. On the Mac Studio, Downloads is a link into Dropbox (`settings.js` 57-59, `downloadsFolder`), so an AirDropped clip is in Dropbox until she drags it out. Jason: "airdropped and other downloaded videos can land in dropbox to start, but brimm video studio does not touch them until they are in the app's drop folder". So the Mac Studio's Downloads stays as it is, and no words are special for a session sent by AirDrop. Studio never reads, lists or imports a downloaded or AirDropped video until it is in the drop folder; what the new code looks for outside it is only HyperFrames' exports of its own projects (D12). By-hand checks P3-5 and P3-6 confirm what Finder does before the guide's words are final.

**D8. The switch is per Mac.** `install.sh --machine "<Mac>" --drop-folder "<path>" [--exports-folder "<path>"] … "<BRIMM Video>"`, or `--switch-local` for both defaults, switches a Mac, and is refused while its old drop folder holds work (`switch.js` `heldInOld`). A run with no drop option keeps the settings' folder. On a Mac with `dropPath`, `--drop Drop` (or `"Unedited Video"`) is refused with one plain line unless `--switch-back` is given too. The Mac Studio switches at deployment, on Jason's yes. What the Move to Studio app's pickers must pass, for the installer session:
- a Mac being set up or switched: `--drop-folder "<the picked drop folder>"` and `--exports-folder "<the picked exports folder>"` in place of today's `--drop Drop` (never `--drop` and `--drop-folder` together), or `--switch-local` when nothing is picked;
- a Mac whose settings already have `dropPath`: no drop option, unless she picks a new folder;
- to read a Mac's folders back: `settings.js show`'s `  Its drop folder:  <path>` (the path alone; move.zsh reads it at 223 and 714) and `  Exports from HyperFrames, looked for in:  <path>`; `--print`'s `  Its drop folder, on this Mac:  <path>`, the same exports line, and D11's `Warning:` line when there is one.

**D9. Episodes from before the switch keep the old way** (files in Dropbox, layout 5 or below), until each is handed off: their holds, waits and late checks as Phase 1 built them, their claim, and their finish's check in its own run (Jason's answer to Question 2). No old code is deleted here. Their recordings stay where they are in Dropbox: they are not moved into `Original files/`, since a move in Dropbox would be a rename there. A part dropped after the switch for a plan from before it is on this Mac (its record has `local`), and its recording moves when the plan is handed off (L6).

**D10. The two-Mac rules that still bind,** because her laptop's old brimm-video may still run (Question 1), and the MacBooks the Move to Studio app sets up stay on Dropbox drop folders until each moves: new records keep `editing` and `released: null`; no stored value is renamed (the settings' `drop` stays); nothing in Dropbox is written into, renamed or moved but by the rule; `Drop/Sallie's laptop`, `Drop/Jason's MacBook` and the Mac Studio's old `Drop/Mac Studio` are never touched by code. Jason deletes `Drop/Mac Studio` by hand once Studio shows it empty (P3-3). An old tool sees a local episode as one a newer Studio wrote, and leaves it alone.

**D11. The drop folder is picked, and a cloud one is warned about.** The installer takes `--drop-folder "<path>"`: a whole path, made when missing (its parent must be there). It is refused when it is, is inside, or holds: `Episodes`, `References`, `Drop` or `Unedited Video` in BRIMM Video; `~/BRIMM Video Work`, but for `~/BRIMM Video Work/Drop` itself; her chat's folder `~/BRIMM Video Studio` and the workshop `~/BRIMM Video Workshop`, where her chat reads; Zoom's recordings folder (`zoomFolderOf`); `~/Downloads`; or the exports folder; and, as today, a folder the transcript tool watches. A drop folder in Dropbox, iCloud Drive (`~/Library/Mobile Documents`) or elsewhere in `~/Library/CloudStorage` is allowed, by its real path, and `--print` and the run say: `Warning: this drop folder is in <Dropbox | iCloud Drive | a cloud folder>. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.` Under Desktop or Documents, which iCloud Drive keeps at their own paths when its "Desktop & Documents Folders" option is on, the warning says `iCloud Drive, if it keeps Desktop & Documents`. A folder under Desktop or Documents, or on another disk, is allowed, and `--print` also says that macOS asks once whether node may read it. The chosen folder is marked as this Mac's (`.brimm-watched-by`), so two Macs never watch one shared folder: by the rule in a cloud folder, written plainly (whole, then renamed) anywhere else, so another disk works. It is gated in her folder wherever it is. From any drop folder the import copies the video out and deletes the original only after the record is written, never a rename (L3).
- Why: Jason's words; the drop folder is where an unanswered video, perhaps a session, waits; an export or an AirDrop landing in the drop folder would be imported.
- Cost if wrong: a warning's words, or a folder refused that Jason wanted.

**D12. The exports folder is picked.** The installer takes `--exports-folder "<path>"` (by default `~/Downloads`, today's place; a cloud folder is fine, with no warning). Studio looks for HyperFrames' exports there and in Downloads, and also where an export's own record says it went. It copies the export into `final/` and writes the hand-off as today, so the hand-off file, its fixtures and `madeBy` do not change (`handoff-v2.js` names the main video by its file name in `final/`). Downloads is told apart by its real path (`sameFolder`, settings.js 426), since on the Mac Studio it is a link: a file found there keeps `where: "Downloads"` and is deleted after Dropbox's check, as today, whether or not `exportsPath` names it. Studio never deletes an export from any other exports folder, which may be shared.
- Cost if wrong: an export left in a folder she chose, for her to tidy. HyperFrames writes into a cloud exports folder itself, which the Dropbox rule cannot guard; the copy in `final/` is checked as today.

**D13. Phase 2 and a local episode.** Phase 2 ("Final Cut retired") was built first (Jason, 6 Nov: "Phase 2 first"), merged into main as e99f537 (PR #44), and brought into this branch at 660ef9b; this plan builds on it. It took away all the code this ruling once made refuse a video kept on a Mac: the seven Final Cut commands and the finish's Final Cut way (F6, F7), `release` with its snapshots, the rebuild, the set-aside and `--take-over` (F5), and the full import with `--from-plan` (F4). Nothing is left to refuse, so L2b is dropped. What Phase 2 kept reads a local episode's files as any other code does, through L2c's readers: a raw reading still renders its rough cut into `renders/` in the episode's work folder on this Mac and opens it in QuickTime, but writes no Final Cut file and lists the render nowhere (F3; `renderRough`, reading.js 714-733); `graphic … ideas` and `reels` read the video's own clock from its words file, cut plan and `reels.json` (F2; `videoClock`, video-clock.js 19-54, through `clockRead`, edit.js 3574-3582); and `finish` tells a raw video with no main project in use to open it in HyperFrames before it reads any file (F6; `finishWay`, edit.js 1915-1922, said at 2025). Every import is light (F4), so a drop folder of a Mac's own needs no import setting: L1b takes away L1's fault that asked for one. An episode from the Final Cut days is older than the switch, has no `local`, and keeps the old way (D9).
- Cost if wrong: a reader Phase 2 kept that still looks for a local episode's file in Dropbox: L2c's grep finds it, and L2c's and L8's tests catch it.

---

## The order

**Where the work happens:** Studio, a worktree of its own per builder, cut from the branch `claude/studio-local-folder`, which holds L1 and, since 660ef9b, main with Phase 2 (e99f537). Tests: `cd tool && node --test`.

| Task | What | Size | Needs |
|---|---|---|---|
| L1 | The picked drop folder, the settings, and the switch (built: c0e4e46, af3d75a) | M | main |
| L1b | The exports folder; L1's light-import fault taken away (built: 66ce351, c125ae7, 7c87194, 4f3f929) | M | L1 |
| L2 | Layout 6, `where.js`, and the other Mac | M | L1 |
| L1d | Every Mac names a waiting video quietly | S | L1b, L2 |
| L2c | Every reader through `fileAt` and `folderAt` | M-L | L2 |
| L2b | Dropped: Phase 2 removed the code it guarded | — | — |
| L8 | Episodes from before the switch keep the old way | M | L2c |
| L3 | The import files a video on this Mac | L | L2c |
| L4 | Readings, copies, joins and footage on a local episode | L | L3 |
| L5 | The checks run behind, and nothing waits for them | L | L4, L1b (design first) |
| L6 | Original files after the hand-off | L | L5 |
| L7 | Open it once: drop it, and it runs until it needs her | M | L4 |
| L9 | The words and the docs | M | L6, L7 |

**Waves.** L1 is built. Then L1b beside L2 (different files but `guide.js`, where they change different functions). Then L2c, then L8, whose tests are the net every later task keeps green. Then L3, then L4. Then L5 and L7 in parallel worktrees (different modules; both touch `edit.js`, in different functions), merged one at a time with the whole suite after each. Then L6, then L9.

**Pre-flight: tasks that share files:**

| Pair | Shared | Rule |
|---|---|---|
| L1 → every task | `settings.js` `isLocal`, `dropFolderOf`, `episodeFilesFolder`, `importingFolderOf`, `statusFoldersOf`, `exportsFolderOf`, `cloudFolder`, `folderWords` | L1 first |
| L1b → L5 | `exports.js`'s export places; only an original from Downloads is deleted (D12) | L5 after L1b |
| L1b / L2 | `guide.js` (L1b: `appStep`'s export sentence and the head comment; L2: `videoNext`, `sessionNext`) | different functions; one merge at a time |
| L1b / L3 | `settings.js` `planned` (L1b: the fault's refusal; L3: its call of `heldInOld`) | L3 after L1b |
| L1b / L9 | `install.sh` (L1b: the plan's import line, 546; L9: the header and the say-lines) | L9 after L1b |
| L2 → every later task | `where.js` `filePlace`, `folderAt`, `fileAt`, `onOtherMac`, `ON_OTHER_MAC`; `LOCAL_VERSION`; `isPlannedRecord` at layout 6 | L2 first |
| L2c → L3, L4, L6 | the readers through `fileAt`/`folderAt`; `history/`'s rule | L2c before them |
| L3 / L4 | `filing.js` `fileEpisode` (L3's local filing; L4's join files a part through it, join.js 496-513) | L4 after L3 |
| L3 → L5 | `fileEpisode`'s `entries` on a local Mac: the first record's, for L5's `record` pending | L5 after L3 |
| L4 / L5 | `late-wait.js` `keepCheckInStep` (L4 stops calling it for a local reading; L5 moves it to `filing.js` as `takeOutOfCheck`) | L5 after L4 |
| L5 → L6 | the pending kinds, their readers, `finishDue`'s dispatch | L6 after L5 |
| L4 / L7, L5 / L7 | `edit.js` (`answerKind`, `app`; L5's `lateCheckWaits`, `stoppedWords`, `saveSpellings`); `guide.js` (L5: the checking step; L7: `copyStep`) | different functions; one merge at a time |
| L8 → later tasks | `tool/tests/old-episodes-after-switch.test.js` | stays green |
| the skill | L7, L9 | one builder at a time on both skill files |

**Hot spots:** `tool/edit.js`, `tool/filing.js`, `tool/unedited.js`, `tool/reading.js`, `tool/guide.js`, the two skill files. `today-says.json` is regenerated only in a task that changes `HELP`, help lines only.

---

## Global Constraints

- **Branches:** work on `claude/studio-local-folder`, in builders' own worktrees. Never in `~/Claude Code/brimm-video-studio` (the Mac Studio's live checkout, on main), never in another session's worktree or a draft PR's branch. Nothing merges or is pushed without Jason's yes.
- **Posting:** Studio itself never posts, sends or publishes anything. Nothing here adds a way to.
- **Never read a `.env` file.** Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes. The installer runs only with `--print`.
- **Write a failing test first, then the code.** The whole suite passes before each commit: `cd tool && node --test`.
- **No test calls the real `claude`, HyperFrames, HeyGen, Dropbox or `swift`, or the real `launchctl`.** Use the stand-ins and worlds in `tool/tests/` (`phase4.js`, `workcopy-world.js`, `guide-world.js`, `checking-world.js`, `filing.test.js`'s `world`); a test's own home and folders.
- **The contract with BRIMM Ops:** the hand-off file (`handoff.js`, `handoff-v2.js`), their fixtures, `tool/shared/`, `lib.js`, `run.js`, `madeBy`, and the hand-off's name and place in `final/` do not change. The guide (`tool/guide.js`, `tool/guide-note.js`) changes only in step with brimm-operations: each task's "Contract touched" says what changes in its output, and "In step with brimm-operations" lists the page guide's lines that change with them.
- **Downloaded videos:** Studio never reads, lists or imports a video someone downloaded or AirDropped until it is in the drop folder (D7). The new code reads no other video outside the drop folder but HyperFrames' exports of Studio's own projects: in the exports folder, in Downloads, or where an export's own record says it went (D12). Phase 2 took away the old code's other places (From Final Cut, and the other Mac's exports in `edit/from-hyperframes/`): it reads none of them now.
- **The Dropbox rule holds for Dropbox:** nothing in Dropbox is written into, renamed or moved; each file is written whole on this Mac and cloned in; files first, the record last. On this Mac's own disk a file may be written whole and renamed into place.
- **D10's rules:** `editing` and `released: null` in every new record; no stored value renamed; `Drop/Sallie's laptop`, `Drop/Jason's MacBook` and `Drop/Mac Studio` never touched by code.
- **The old way stays:** every new path branches on `record.local` (or `isLocal(settings)`); a record without `local` takes today's code, unchanged. No old code is deleted.
- **Sessions stay out:** a session's recording never goes to Dropbox: not at the import, and not after a hand-off while it is a session or held beside one (L6 asks the gate at the owe, the move and the delete). Nothing new prints a session's label beyond the label, its words or a file name. Every new local folder is gated in her folder as `Episodes` is.
- **Her chat stays Studio:** a command or flag that changes gets its `HELP`, `ASKED`, `TODAY_ASKED`, `walkWords`, `WALK` entries, README row, gate-list decision and skill row in the same commit.
- **Words:** short sentences, no path, flag or command name in what she is told; Finder words for a folder. The name on screen is "BRIMM Video Studio".
- **Commits** end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the builder's own model line).

## Review Focus

1. **A session's recording never reaches Dropbox.** It stays in `video/` at the import; it is never moved after a hand-off while the gate holds it as a session or beside one, asked at the owe, the move and the delete; a video that becomes a session after its copy was made is left as it is, and Jason is told; the picked drop folder, `video/` and the local status folder are refused to Claude in her folder, strict and open lock. (L1's, L3's and L6's tests.)
2. **A recording leaves the Mac only when it is safe.** The import never empties or removes a `video/` whose marker is not its own, and never names a folder while Episodes cannot be listed; the original leaves the drop folder only after the record is written. After the hand-off the Mac's copy is deleted only when a check that put nothing back found the copy whole, the record in force lists it at its size, Dropbox reports it uploaded, the Mac's file is unchanged, and no run holds the episode's or its work copy's lock. (L3's and L6's tests.)
3. **The other Mac changes nothing.** On a Mac that is not `local.on`, no local file is called missing, no card is offered for a video it cannot read, and every command that names the episode says the one line and writes nothing; another Mac's import still holds a reading here. (L2's and L3's tests.)
4. **An episode from before the switch works as it did,** on a switched Mac: its waits, holds and late checks, its finish's check in its own run, "Make online-only" in its guide, and no `Original files/` move of its own recording. A layout-6 record is read as newer by older code and never written by it. (L8's and L2's tests.)
5. **Every check behind is made, and never puts back over a newer file.** A missing or short copy is put back; a file the record in force lists at another size is left; an original from Downloads is deleted only when every copy is whole and it is unchanged, and one from another exports folder never; a pending is on disk before its record, so a finish killed after its hand-off still has its check made, and one for a revision the record never held is dropped; a lost first record is put back. (L5's tests.)

## In step with brimm-operations

The guide's words are part of the contract with BRIMM Ops (CLAUDE.md). This plan changes what `guide.js` says only for a switched Mac's videos, and each task's "Contract touched" names the change: the drop folder's words (L1); the export sentence (L1b); the other Mac's step (L2); the checking step (L5); the Original files lines (L6); the copy step's "it opens by itself" (L7); "Make online-only" kept only for an episode from before the switch (L8); the AirDrop sentence (L9). The hand-off file, its fixtures and `madeBy` do not change.

The BRIMM Ops session changes these lines of `docs/guide/brimm-ops-guide.html` (in brimm-operations) in step, at merge time. Each becomes wrong for a switched Mac, and stays true for a Mac on a Dropbox drop folder:
- 167: "Drop it in your drop folder in Dropbox."
- 248: the Mac Studio's drop folder, "Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio".
- 253: "Control-click your drop folder and choose Make available offline".
- 282: "Both wait for the import to check its copies in Dropbox, about 15 minutes after Ready."
- 286: "The first time on a Mac, … choose Make available offline", and "ask again when it is" (L7 opens it by itself).
- 295: "Make online-only" after the hand-off: on a switched Mac the recording goes into Original files by itself.

## How each task is built

As in Phase 1: one Sonnet builder per task, test first, in its own Agent worktree; a fresh read-only reviewer per task; the coordinator merges one at a time, runs the whole suite after each, and keeps the ledger `.superpowers/sdd/2026-11-06-local-working-folder-plan/progress.md`. **L5 is designed first** by the most capable model, as R1c was: it writes `L5-task.md` (tests, interfaces, the walk of each order of a check and a writer, for the three kinds) within D5 and L5's rulings, and the coordinator adds it to this plan before the builder starts.

---

## Phase 3

### L1. The picked drop folder, the settings, and the switch

**Built:** c0e4e46 and af3d75a (review clean), merged with main (Phase 2) in 660ef9b. The text below is the record of the task as it was given, with its line numbers at 5bb0065. Since the merge, `--import full` is refused by Phase 2's own rule (`FULL_GONE`), and L1b takes away L1's fault that a drop folder of a Mac's own needs `import: "light"` (D13). L1's deferred minors that land in later tasks are carried into them: L1b, L3 and L9.

**Goal:** A Mac whose settings hold `dropPath` watches that folder, wherever it is, says where it is in Finder's words, and is switched only while its old drop folder holds no work. The installer takes the drop folder and the exports folder (D11, D12), warns about a cloud drop folder, and shows both with `--print`.

**Evidence:**
- `settings.js`: `dropFolder(root, machine, folder)` (44) is always in Dropbox; `settingsFault` checks `drop` (137); `planned` (393-447) computes the old and new folders and calls `heldInOld`; `plan` (477-500) prints the last lines install.sh reads; `set` refuses any change of the drop folder (567-575), because written alone it left the launch agent watching the old folder; `show` prints the folders (655, 659-660); `factsOf` (182) gives `gatedPlaces` its facts; `zoomFolderOf` (164); `mark` writes the marker by the rule from the temp folder (943), which fails for a folder on another disk.
- `switch.js` `heldInOld` (66-187) takes the old folder by its name (67).
- Callers of `dropFolder`: `filing.js` `episodeMode` (33), `edit.js` `dropFolders` (901-911), `retry` (2145), the overview (7503) and `guide drop` (7568).
- `install.sh`: options (129-174); `WatchPaths` (312-315); the plan's lines (460-490); the drop path (522-528); the say-lines (572-582, Make available offline at 582); folders and marker (894-900); "Done" (950-955).
- `unedited.js` `uneditedFolder` (2135-2187) refuses a folder in `BRIMM Video/Drop/` with no settings naming it (2147).
- `places.js` `gatedPlaces` (62-100) gates `~/BRIMM Video Work` (76) and `~/Library/Application Support/BRIMM Video` (77); `realHomeOnly` (104-).
- `guide.js` `dropWords` (21).
- The Move to Studio app passes `--drop Drop` (move.zsh 197), so a run of it on a switched Mac must not switch it back unasked.

**Files:** `tool/settings.js`, `tool/switch.js`, `tool/install.sh`, `tool/filing.js` (`episodeMode`), `tool/unedited.js` (`uneditedFolder`), `tool/edit.js` (`dropFolders`, `retry`, the overview, `guide drop`), `tool/guide.js` (`dropWords`), `tool/places.js`, `tool/studio.js`; tests `settings.test.js`, `install.test.js`, `switch.test.js` (or where `heldInOld` is tested), `unedited.test.js`, `guide.test.js`, `edit-guide*.test.js`, and the lock's place tests (`grep -ln "gatedPlaces" tool/tests`).

**Interfaces.** Produces, in `settings.js`:
- Two fields, each a whole path when present: `dropPath` and `exportsPath`, checked by `settingsFault` as `root` is. `dropPath` with an import other than light is a fault: `a drop folder of this Mac's own takes the light import`. `drop` keeps its values and stays in a switched Mac's settings, unread while `dropPath` is there.
- `isLocal(settings) -> boolean`: `typeof settings.dropPath === "string"`.
- `defaultDropFolder(home) -> path`: `join(workFolder(home), "Drop")`.
- `dropFolderOf(settings, home) -> path`: `settings.dropPath` on a local Mac, else `dropFolder(settings.root, settings.machine, settings.drop)`.
- `episodeFilesFolder(home, folder) -> path`: `join(episodeWork(home, folder), "video")`.
- `importingFolderOf(settings, home) -> path`: `join(home, "Library", "Application Support", "BRIMM Video", "importing")` on a local Mac, else `importingFolder(settings.root)`: where this Mac writes its statuses.
- `statusFoldersOf(settings, home) -> [path]`: `importingFolderOf` and `importingFolder(settings.root)`, once each by `sameFolder`: where every status is read (L3).
- `exportsFolderOf(settings, home) -> path`: `settings.exportsPath`, else `downloadsFolder(home)` (L1b uses it).
- `cloudFolder(path, home) -> "Dropbox" | "iCloud Drive" | "iCloud Drive, if it keeps Desktop & Documents" | "a cloud folder" | ""`: by real path; under `~/Library/CloudStorage/Dropbox*` or `~/Dropbox`, "Dropbox"; under `~/Library/Mobile Documents`, "iCloud Drive"; under `~/Desktop` or `~/Documents`, the third (a path cannot tell whether iCloud keeps them); elsewhere under `~/Library/CloudStorage`, "a cloud folder".
- `folderWords(path, home) -> string`: under the home folder, its folders after it and `, in your home folder`; under `~/Library/CloudStorage/<Provider>-<account>/`, `<Provider> › …`; else each folder of the path.
- `dropFolderFault(path, { home, root, exports, zoom }) -> string`: D11's refusals in plain words, "" when none.
- `write` and `plan` take `--drop-folder "<path>"`, `--exports-folder "<path>"` and `--switch-back`. On a Mac with `dropPath`, `--drop Drop` or `"Unedited Video"` without `--switch-back` is refused: `Not written: this Mac's drop folder is <path>, on this Mac. To go back to a drop folder in Dropbox, give --switch-back as well.`; with it, `dropPath` is taken away, refused while the picked folder holds work. `plan` prints after the JSON, in order: `The import will be: …`, `The drop folder is now: …`, `The drop folder will be: …` (each `Drop`, `Unedited Video` or a whole path), `The exports folder will be: <path>`, `The drop folder is in a cloud folder: <name>` (only when `cloudFolder` names one), `The drop folder needs Files and Folders access` (only under Desktop or Documents, or on another disk), then `The old drop folder: <path>` when the folder watched changes.
- `set --exports-folder "<path>"` writes `exportsPath`; `set --drop-folder …` on every Mac, and `set --drop …` on a Mac with `dropPath`, are refused (1, the installer's line, nothing written); `set --drop …` on any other Mac is as today.
- `show`: `  Its drop folder:  <path>` (the path alone) and `  Exports from HyperFrames, looked for in:  <path>`.
- `mark`: a marker in a folder `cloudFolder` names is written by the rule, as today; anywhere else it is written plainly, whole and then renamed.
- `factsOf` gives `dropFolder: dropFolderOf(s, home)`; `places.js` `gatedPlaces({ …, dropFolder })` gates it (`itself`) when given.
- `switch.js` `heldInOld({ root, machine, folder, light, home, now })`: `folder`, a whole path, in place of `old`.
- `filing.js` `episodeMode(dir, settings, home)` compares with `dropFolderOf(settings, home)`.
- `guide.js` `dropWords(settings, machine, home)`: `folderWords(settings.dropPath, home)` on a local Mac, else as today.
- `install.sh`, on a `--machine` install: `--drop-folder "<path>"`, `--exports-folder "<path>"`, `--switch-back`, or `--switch-local` alone for both defaults; passed to `settings.js plan` and `write`. The installer reads the plan's lines by their words; `drop` is the will-be path when it is whole, else `$root/$drop_name/$machine`; the folder is made when missing and marked (`settings.js marker`); `WatchPaths` names it. `--print` says `  Its drop folder, on this Mac:  <path>`, D11's `Warning:` line for a cloud folder, the Files and Folders line when the plan says so, and `  Exports from HyperFrames, looked for in:  <path>`; `Make available offline` only when the drop folder is in Dropbox; no `Episodes/.importing` made on a local Mac. A line it cannot read refuses, with nothing changed.

**Failing tests first:**
- `settings.test.js`:
  - "write --drop-folder writes dropPath": `write --machine "Mac Studio" --root <root> --checkout <co> --import light --drop-folder <home>/Desktop/Drop` ends 0; the file's `dropPath` is that path and `drop` is as it was.
  - `dropFolderOf` gives `dropPath`, and today's folder with none; `statusFoldersOf` gives the local folder and `Episodes/.importing` on a local Mac, and `Episodes/.importing` once on any other.
  - `show` prints `  Its drop folder:  <home>/Desktop/Drop` exactly, and `  Exports from HyperFrames, looked for in:  <home>/Downloads` (or `exportsPath`).
  - `set --drop-folder <path>` ends 1 with the installer's line and writes nothing, on any Mac; on a Mac with `dropPath`, `set --drop Drop` does the same (today it would say "already"); `set --exports-folder <path>` ends 0 and writes `exportsPath`.
  - `write --drop-folder …` while `<root>/Drop/Mac Studio` holds a video is refused in `heldInOld`'s words, and writes nothing.
  - On a Mac with `dropPath`: `write --drop Drop` ends 1 with the line above and writes nothing; `write --drop Drop --switch-back` takes `dropPath` away, and is refused while the picked folder holds a video.
  - `write --drop-folder … --import full` ends 1: `Not written: a drop folder of this Mac's own takes the light import.`
  - `dropFolderFault` refuses `<root>` itself, `<root>/Episodes/x`, `<root>/Drop/Mac Studio`, `<root>/Drop/Sallie's laptop`, `<root>/Drop/Jason's MacBook`, `<root>/Unedited Video`, `<root>/References`, `<home>/BRIMM Video Work`, `<home>/BRIMM Video Work/<an episode folder>`, `<home>/BRIMM Video Studio/Drop`, `<home>/BRIMM Video Workshop`, the Zoom folder and its parent, `<home>/Downloads`, the exports folder, a folder inside it, its parent, a relative path, and one whose parent is not there; it allows `<home>/BRIMM Video Work/Drop`, `<home>/Desktop/Drop` and `<home>/Library/CloudStorage/Dropbox-X/The BRIMM DB/In`.
  - `cloudFolder`: "Dropbox" under `<home>/Library/CloudStorage/Dropbox-X/…`, "iCloud Drive" under `<home>/Library/Mobile Documents/…`, "iCloud Drive, if it keeps Desktop & Documents" under `<home>/Desktop/…` and `<home>/Documents/…`, "a cloud folder" under `<home>/Library/CloudStorage/GoogleDrive-X/…`, the target's for a link into one, "" for `<home>/BRIMM Video Work/Drop`.
  - `folderWords`: `BRIMM Video Work › Drop, in your home folder`; `Dropbox › The BRIMM DB › In`.
  - `plan` prints its lines after the JSON in the order above, each optional line only when it applies.
  - `marker` in a folder that is in no cloud folder is written with no clone (the `clone` stand-in is never called); in a Dropbox one, by the rule.
- `install.test.js`, each with `--print --machine "Mac Studio" --import light --handoff 2 "<root>"`:
  - `--switch-local`: `Its drop folder, on this Mac:` `<home>/BRIMM Video Work/Drop`, `WatchPaths` naming it, `Exports from HyperFrames, looked for in:` `<home>/Downloads`, no `Make available offline`, no `.importing` made, `Nothing was changed.`
  - `--drop-folder "<home>/Library/CloudStorage/Dropbox-X/In"`: the same, with D11's warning naming Dropbox and the `Make available offline` line.
  - `--drop-folder "<home>/Desktop/Drop"`: the Files and Folders line, and the warning naming `iCloud Drive, if it keeps Desktop & Documents`.
  - Each `dropFolderFault` case above, and `--drop Drop` on a Mac with `dropPath` without `--switch-back`: refused, with nothing changed.
  - `--exports-folder` in Dropbox: shown, with no warning.
- `unedited.test.js`: `uneditedFolder` takes the picked folder as the drop folder (`episodeMode`), and still does nothing in `<root>/Drop/<Mac>` that no settings name.
- `edit-guide*.test.js`: `guide drop` opens `dropPath` (the `openFolder` stand-in gets it); the overview names it `BRIMM Video Work › Drop, in your home folder`.
- `edit.js` `dropFolders` on a local Mac lists only its own folder.
- The lock: in her folder, Read and Edit of a file in the picked drop folder are refused, strict and open lock, for `<home>/BRIMM Video Work/Drop`, `<home>/Desktop/Drop` and one in Dropbox, as a file in `<root>/Drop/Mac Studio/` is today; so are files in `<home>/BRIMM Video Work/<episode>/video/` and the local status folder.

**Steps:** tests; fail; `settings.js`; `switch.js`; callers; `install.sh`; `places.js` and `studio.js`; `guide.js`; whole suite; commit. Then the coordinator tells the Move to Studio app's session the options as built (D8).

**Words Sallie sees:** her drop folder in Finder's words (`folderWords`), e.g. `BRIMM Video Work › Drop, in your home folder`. Jason's: D11's warning, the Files and Folders line, the refusals.

**Contract touched:** the guide's words, in step with brimm-operations: for a switched Mac, the overview's drop folder and `guide drop` say the picked folder's Finder words in place of `Dropbox › The BRIMM DB › BRIMM Video › Drop › <Mac>`. **Size:** M.

---

### L1b. The exports folder

**Goal:** Studio looks for HyperFrames' exports in the folder this Mac picked (`exportsPath`, by default Downloads), in Downloads, and where an export's own record says it went, and never deletes an export from a picked folder that is not Downloads (D12). And, since Phase 2 made every import light, a Mac may have a drop folder of its own whatever its settings say of the import, and the plan the installer reads says the import is light.

**Evidence:**
- `exports.js` looks only in Downloads: `exportsFound` (447-471, `downloadsFolder(home)` at 448), `downloadsOnce` (436-439); `lookForExports` (234-342) ends `Looked in Downloads for exports of: …` (341). The finish takes an original only from Downloads (finish.js 955, in `finishNow`, `place: "Downloads"`) and deletes it after its check (1109-1133). A file in Downloads can be a Dropbox placeholder on the Mac Studio, which the finish brings down (`whole`, finish.js 97-110). The guide's export sentence is in `appStep` (guide.js 364-373; the in-app step at 367).
- Since Phase 2 (F4) every import is light, whatever the settings say: an absent `import` is light, `--import full` is refused (`FULL_GONE`, settings.js 392; in `fieldsToldBy` 411 and `set` 728), and a file that still says "full" imports lightly. L1's fault `LOCAL_NEEDS_LIGHT` (settings.js 74; `settingsFault` 160; said by `planned` 561) predates that. It refuses a drop folder of its own to a Mac whose settings have no import setting, or an old "full", for nothing; and a file it faults cannot be read by any command (`usable`, settings.js 241-256). `plan` still says `The import will be: full` for such a file (settings.js 653), and install.sh still takes `full` there as one of two values (546). Whether her chat is set up is another rule, which stays as Phase 2 left it: a Mac whose file does not say `import: "light"` is not set up for her chat's questions (`lightImport`, settings.js 211), with a drop folder of its own or without.
- L1's deferred minors that land here: guide.js's head comment says everything in it is pure and reads nothing (guide.js 4), but `dropWords` reads the disk through `folderWords` since L1, and the export sentence will too; `folderWords` (settings.js 471-480) says a folder in iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/…`) or on another disk (`/Volumes/<disk>/…`) by its path's folders, not in Finder's words, and the export sentence names the exports folder by it. A third, `set`'s suggested installer line lacking `--import light` on a Mac whose file says "full", goes with the fault.

**Files:** `tool/exports.js`, `tool/finish.js`, `tool/guide.js` (the export sentence when the folder is not Downloads; the head comment) and `tool/app.js` (the export sentence when the folder is not Downloads), `tool/settings.js` (`settingsFault`, `planned`, `plan`'s import line, `folderWords`, and the words that a drop folder of its own takes the light import, in its head comment at 15 and its help at 324), `tool/install.sh` (the plan's import line, 546), the skill twins' export rows; tests `exports.test.js`, `exports-words.test.js`, `finish*.test.js`, `guide.test.js`, `app.test.js`, `studio.test.js`, `settings.test.js`, `install.test.js`.

**Interfaces.** Consumes L1's `exportsFolderOf` and `folderWords`. Produces:
- `exportsFound({ home, exports, name, record, … })` (Phase 2 took its `folder` away with the other Mac's released exports) lists `exports` and Downloads, once when they are one folder by `sameFolder`. A file whose folder is Downloads by `sameFolder` has `where: "Downloads"`; any other from `exports` has `where: "the exports folder"`.
- The finish's `taken` keeps `place: "Downloads"` only for a file from Downloads by `sameFolder`; only those are ever deleted.
- `settingsFault` has no fault for `dropPath` with any import setting, and `LOCAL_NEEDS_LIGHT` goes; `plan` says `The import will be: light` whatever the file says; install.sh takes only `light` on that line, and refuses any other as a line it cannot read. No stored value changes: an old "full" stays in the file (D10).
- `folderWords` gives Finder's words for a folder in iCloud Drive (`iCloud Drive › …`) and on another disk (`<disk> › …`).

**Failing tests first:**
- `exports.test.js`: with `exportsPath` a test folder holding an export of the project, it is found there; an export in Downloads is still found; the looked-in line names both, in Finder's words.
- `finish*.test.js`: an export taken from the picked folder is still there after the check passes; one taken from Downloads is deleted, as today; with `exportsPath` naming Downloads, or a link to it, an export there is taken as from Downloads and deleted after the check; a placeholder in the picked folder is brought down as one in Downloads is.
- `guide.test.js`, `app.test.js`: with a picked exports folder, the export step says `Export it on This Mac, into <folder words>.`; with none, the words are as today.
- `settings.test.js`, L1's describe "a Mac's own drop folder, picked": "takes dropPath and exportsPath as whole paths…" now has `settingsFault` give "" for `dropPath` with `import: "full"` and with no import. "refuses a drop folder of its own with the full import…" becomes "takes a drop folder of its own whatever the file says of the import": `write … --import full --drop-folder …` still ends 2 with `FULL_GONE` and writes nothing; `write … --drop-folder <desktop>` on a Mac whose file says "full", and on one whose file has no import, ends 0, writes `dropPath` and leaves `import` as it was; `plan` on a Mac whose file says "full" prints `The import will be: light`.
- `install.test.js`, "refuses, and changes nothing, when what settings.js said of the drop folder cannot be read": `The import will be: full` is among the lines it cannot read, and the case it reads whole says `light`.
- `settings.test.js`, `folderWords`: `iCloud Drive › Exports` for `<home>/Library/Mobile Documents/com~apple~CloudDocs/Exports`, and `Backup › Exports` for `/Volumes/Backup/Exports`.

**Steps:** tests; fail; `settings.js` (the fault, the import line, `folderWords`, the head comment and the help) and `install.sh` (546); `exports.js` and `finish.js`; `guide.js` (the export sentence, the head comment) and `app.js`; the skill rows; whole suite; commit.

**Words Sallie sees:** `Export it on This Mac, into <folder words>.`, only when the exports folder is not Downloads. Jason's: the refusal `Not written: a drop folder of this Mac's own takes the light import.` is gone.

**Contract touched:** the guide's words, in step with brimm-operations: `appStep`'s export sentence names the picked exports folder when it is not Downloads. **Size:** M.

---

### L1d. Every Mac names a waiting video quietly

**Goal:** Whatever a Mac's settings file says of the import (`"light"`, `"full"` or nothing), Studio names a waiting video, an episode it cannot read and an error nobody foresaw quietly, as the light import does, so a client's name in a file's name never reaches Claude. `lightImport` keeps one job: whether her chat is set up (`NOT_SET_UP`). This is the review session's ruling of 7 Nov 2026 on a Phase 2 leftover, which Jason may overturn: every import has been light since Phase 2, but `namesQuietly` is `lightImport(s) || isLocal(s)`, so a Mac with a drop folder in Dropbox whose file says `"full"`, or has no import line, still names by file name. No Mac is on `"full"` today (the Mac Studio's file says `"light"`, and the Move app passes `--import light`), so this changes nothing on any Mac: it is a safety net.

**Evidence:** `namesQuietly` (settings.js 219) and each place it decides: `gateOf`'s refusal while a newer record is still arriving (`PENDING_WHY`, edit.js 461); `listedAs`'s name for an episode it cannot read (`unreadName`, edit.js 563-572); the waiting list (edit.js 1013-1015); `retry` (edit.js 1686-1688); `editMain`'s filter of an unforeseen error (edit.js 6550-6553); `planned`'s look at the old drop folder (settings.js 607-608, the `light` it gives `heldInOld`). `lightImport` (settings.js 213) at edit.js 6312 (`NOT_SET_UP`) stays. `tool/tests/fixtures/today-says.json` pins today's naming by file name on a Mac whose file says `"full"`. L2 changes `gateOf` and the waiting list's lines: build on L2, and find each place by its function.

**Files:** `tool/settings.js`, `tool/edit.js`; `tool/switch.js` only if `heldInOld`'s `light` becomes true for every caller (then say so in the report, and keep or drop the parameter by what its callers pass); tests `edit-labels.test.js`, `edit-gate.test.js`, `settings.test.js`, the tests of the waiting list and of `retry`, and `tests/fixtures/today-says.json`.

**Interfaces:** `namesQuietly` goes, and each place it decided acts as it does today when it was true. `lightImport(s)` keeps its meaning and is used only for her chat's set-up.

**Failing tests first:** on a Mac whose settings file says `import: "full"`, and on one with no import line, each with a drop folder in Dropbox (no `dropPath`):
- the waiting list names a waiting video quietly, never by its file name (a Zoom-like file name holding a client's name);
- an episode whose record cannot be read is named by `unreadName`, not its folder's name;
- an error nobody foresaw is shown as the light import shows it, never with a file's name in it;
- `gateOf` refuses with `PENDING_WHY` while a newer record is still arriving;
- `retry` names quietly;
- `planned`'s lines about the old drop folder name its videos quietly;
- and `NOT_SET_UP` is still said on a Mac whose file does not say `"light"`.
`today-says.json` changes to the quiet names; the commit shows the fixture's change.

**Steps:** the tests, seen failing; take `namesQuietly` and its conditions out; the fixture; the whole suite; commit.

**Words Sallie and Jason see:** none new: the light import's quiet names, now on every Mac.

**Contract touched:** none: the guide's words and the hand-off are unchanged. **Size:** S.

---

### L2. Layout 6, `where.js`, and the other Mac

**Goal:** A record can say its files are on one Mac; `where.js` says where each file and folder is; a plan marked local is still a plan; another Mac lists the episode and changes nothing.

**Evidence:**
- `episode.js`: `RECORD_VERSION = 4` (38), `PLANNED_VERSION = 5` (41), `NEWEST_VERSION` (42); `layoutOf` (316-323); `faultFor` (429-470), which accepts a field it does not know; `fileProblems` (687-701) and `filesProblems` (705-712), which call any listed file not in the folder "missing".
- `isPlannedRecord` (episode.js 252) requires `version === 5`, so a plan written at layout 6 would be no plan: `gated` (gate.js 87) would take it for a video waiting for its answer, the join would stop (join.js 380), and the plans lists and footage offers would leave it out (footage.js 52, 64, 120, 466, 630; plan.js 347, 487; edit.js 736 and 757 in `findEpisode`, 963 in `episodeLines`, 1345 in `app`, 1401 in `appReel`, 2679 in `keptOverWhy`, 5923 in `guideFacts`).
- `findEpisode` (edit.js 726-775) and its gate (`gateOf`, 456-473) are where every command that names an episode finds it; COMMAND_NAMES (6493) is what gate.test.js walks.
- The guide's steps for a video or a session open elsewhere: `videoNext` (guide.js 424, the step at 428) and `sessionNext` (317, the step at 327).

**Files:** `tool/episode.js`; create `tool/where.js` and `tool/tests/where.test.js`; `tool/edit.js` (`findEpisode`'s gate, `episodes`' lines, `guideFacts`); `tool/guide.js`; tests `episode.test.js`, a new `tool/tests/local-episode.test.js` (a world with a layout-6 record, used by later tasks too), `gate.test.js`, `guide.test.js`, `footage*.test.js`, `join.test.js`.

**Interfaces.** Produces:
- `episode.js` `LOCAL_VERSION = 6`, `NEWEST_VERSION = 6`; `layoutOf` gives 6 for a record with `local`; `faultFor` takes `local` as undefined, null, or `{ on: <non-empty string>, original?: { file, bytes, mtimeMs } }` at layout 6 or above.
- `isPlannedRecord` accepts layout 5, or layout 6 when the record has `local`.
- `fileProblems(folder, record, { stat, machine, localFolder })`: a local file is looked at in `localFolder` (the episode's `video/`) on `local.on`, and not at all on another Mac; `filesProblems` takes the same options.
- `where.js`:
  - `filePlace(record, rel) -> "dropbox" | "local"`: `final/`, `history/`, `Original files/`, `record/` and `PLAN_FILE_NAMES` (plan.js 247) are "dropbox"; every other name is "local" when `record.local`, else "dropbox".
  - `folderAt(ctx, { folder, record }, place) -> path`: `folder` for "dropbox"; for "local", `episodeFilesFolder(ctx.home, basename(folder))` on a local record and `folder` on any other.
  - `fileAt(ctx, { folder, record }, rel) -> path`: `join(folderAt(ctx, { folder, record }, filePlace(record, rel)), rel)` (L6 adds the recording's branch). A part read through `partsOf` (footage.js 128) has its `folder` and `record`, and needs nothing more.
  - `onOtherMac(ctx, record) -> string`: `record.local.on` when it is not `ctx.machine`, else "".
  - `ON_OTHER_MAC(name, mac) -> string`: the line below.
- The other Mac's refusal is in `findEpisode`'s gate, so every command that names an episode says `ON_OTHER_MAC` and writes nothing on another Mac; `guide`, `episodes` and `status` list it instead.

**Failing tests first:**
- `episode.test.js`: a record with `local` is written at layout 6 and read back; `readEpisode(folder, { known: 5 })` reads it as newer and `writeEpisode` refuses it at `known: 5`; `editing` and `released: null` are in it; `local: {}` and `local` at layout 5 are faults; a record without `local` is still layout 4 or 5.
- `episode.test.js`, `gate.test.js`: a plan at layout 6 with `local` is a plan: `isPlannedRecord` is true, the gate lets `plan`, `name`, `join`, `app` and `resolve` through, `plan "<title>"` shows it, the footage offers list it, and `plan "<title>" join` takes it.
- `where.test.js`: `filePlace` for `IMG.mov`, `IMG.words.json`, `IMG.rough-cut.srt`, `history/2026-11-06T10-00-00 IMG.cut-plan.json`, `final/IMG.mp4`, `Original files/IMG.mov`, `teleprompter.txt` and `record/0002.json`, with and without `local`; `folderAt` and `fileAt` for each.
- On another Mac (`ctx.machine` "Jason's MacBook", whose settings say `drop: "Drop"`, and `local.on` "Mac Studio"): `episodes` lists it as on the Mac Studio, with no file called missing; walking COMMAND_NAMES as gate.test.js does, every command that names the episode says `ON_OTHER_MAC` and writes nothing; no card is offered for its video while it waits for her answer; the guide's step is `It is on the Mac Studio. Carry on there.`, for a video and for a session.

**Steps:** tests; fail; `episode.js`; `where.js`; the gate's refusal; `guideFacts` and the guide; whole suite; commit.

**Words Sallie sees:**
- `"<name>" is on the Mac Studio: carry on there. Nothing was changed.` (a session or a video not yet answered by its label, as every line names it).
- The guide: `It is on the Mac Studio. Carry on there.`

**Contract touched:** the guide's words, in step with brimm-operations: for a local video or session on another Mac, `It is on <Mac>. Carry on there.` in place of `It is open on <Mac>. Carry on there.` (`videoNext` and `sessionNext`; Phase 2 took the take-over out of `videoNext`'s words). **Size:** M.

---

### L2c. Every reader through `fileAt` and `folderAt`

**Goal:** Every reader of an episode's own files finds them where they are, one file at a time or a whole folder; `history/` follows the file it holds.

**Evidence:**
- Find the readers with `grep -nE 'join\([A-Za-z.]*folder' tool/*.js` (it finds `found.folder`, `folder` and `part.folder`). Among them: app.js `changedSince` (376), `adoptProject` (411), `makeProject` (447-478), `putVideoBack` (540); app-reel.js 167, 219, 234, 256, 288; edit.js `notHere` (1112), `open` (1230-1262, the notes at 1250), `notMade` (1892-1898), `suggestionOpening` (1951-1960), `finishEpisode` (2001-2150: `filesProblems` at 2043, `suggestionOpening` at 2097 and 2128), `show` (2263-2274), `resolveIn` (2709-2880), `reels` (3160-3206), `planFootage` (3411), the work copy's run (`workcopy`, 3452, which reads the video at 3503), `saveSpellings` (3878-3954), `answerKind` (4717-4879), `earlierFiles` and `setAsideWritten` (5034-5184), `whichCommand` (5409), `broughtOver` (5473-5480); free.js 321; join.js `wordsOfPart` (179: a missing words file gives `[]`, and the part then has no place, with no error), 448, 501, 533 (the concat list); late-wait.js `localSource` (39-53); plan-project.js 88; finish.js 776; suggestions-in-main.js 81; unedited.js `versionIn` (427); reading.js `renderRough` (714-733, which reads the recording at 715: Phase 2 kept the rough cut's render, into `renders/`); video-clock.js `videoClock` (19-54: the words file, the cut plan and `reels.json`), which `graphic … ideas` and `reels` read through `clockRead` (edit.js 3574-3582). Phase 2 took away three readers this list named: `stillArriving` (with `release`, F5), `markReels` (with the Final Cut commands, F7) and timeline.js's `clockFor` (with the timelines, F2 and F7; `videoClock` reads in its place).
- `history/` is read as a whole folder: by the hand-off's readers, finish.js `handoffsBeside` (178-181), `handedOff` (187-196), `lastRevision` (205) and free.js `handedOffForSure` (245-254, at 247); by the readers of local kinds, finish.js `teachingsIn` (213), `reelsListsIn` (218), which with the hand-offs feed `highestNumberOf` (491, where a number is never given twice), reading.js `rulesPlanKept` (217-237) and edit.js `readBefore` (4965-4973). Writers: finish.js 1600-1611 (`finishSession`: a session's hand-off set aside from `final/`), reading.js 504 and 669 (a reading's own set-asides, put in with its files, which `intoEpisode` lists: unedited.js 1185, 1205), edit.js `resolveIn` (2796-2799, 2880) and `setAsideWritten` (5107-5184).

**Ruling for L2c: `history/` follows the file.** A Dropbox file set aside (from `final/`, a plan file, a record) goes into `history/` in Dropbox and is listed as today. A local record's set-asides stay on the Mac, in `video/history/`, and are never listed, whoever sets them aside (`putHere`'s own renames, or a reading's `history/…` files, L4): nothing checks them, and `folderAt` finds them. So every `history/…` a local record lists is in Dropbox; the hand-off's readers read Dropbox's `history/` as today, and the readers of local kinds (`teachingsIn`, `reelsListsIn`, `rulesPlanKept`, `readBefore`) read `folderAt(…, "local")` and its `history/`.

**Files:** every reader and writer above; tests `local-episode.test.js`, `finish*.test.js`, `reading.test.js`, `join.test.js`.

**Interfaces.** Consumes L2's `filePlace`, `folderAt`, `fileAt`. Produces no new name: every reader above goes through them, and every caller of `fileProblems` gives `localFolder: episodeFilesFolder(ctx.home, <folder name>)` for a local record.

**Failing tests first:**
- `local-episode.test.js`, on the Mac that holds it: `episodes` lists it with no file line; `app`, `show … transcript`, `which`, `reels`, `free`, `graphic … ideas` and `kind --again` find their files in `video/`; `open` and `app` say no "Make available offline" line.
- `join.test.js`: `plan "<title>" join` of a local plan finds each part's words in its own `video/` (no part "with no place").
- `finish*.test.js`: a local session's next hand-off numbers its items after those in its teachings in `video/` and `video/history/`; a hand-off set aside from `final/` lands in Dropbox's `history/`, listed, and counts for the next revision.
- `reading.test.js`: `rulesPlanKept` of a local raw episode finds the rules' plan in `video/history/`.

**Steps:** tests; fail; the readers and writers; whole suite; commit.

**Words Sallie sees:** none new. **Contract touched:** none. **Size:** M-L.

---

### L2b. Phase 2's code refuses a local episode

**Dropped: Phase 2 removed the code it guarded.** L2b was to make Phase 2's code refuse a local episode while that code was still on main (D13 as it was). Phase 2 merged first and took all of it away, so no builder is given L2b; its ID is kept, and L8 now follows L2c. What it named, and where each went:
- The seven Final Cut commands (`push` with `pushPart`, `pushVersion` and `pushReel`, `cut`, `captions`, `text`, `graphic` but `ideas`, `logo`, `preset`) and `layerStart`: gone (F7). `graphic … ideas` stays, on the video's own clock (F2, `videoClock`), and L2c's test that it finds its files in `video/` stands in for L2b's.
- `release`, `releaseEpisode`, and `--take-over` on `open`, `app` and `bring`: gone (F5). `open` and `app` take no flag now; `bring` stays, and reads through `notHere` (L2c).
- `--from-plan` (`videosFromPlan`) and its `--out` refusal: gone (F4). `unedited.js --from-plan` says it is gone and ends 2.
- `finishWay`'s "final cut": gone (F6). A raw video with no main project in use is "unopened", which `finish` says before it reads any file (edit.js 2025).
- The reading's `edit/main.v0.fcpxml`: gone (F3). The rough cut's render stays, in `renders/` on this Mac, listed nowhere (D13).
- Its two lines of words, `NOT_IN_FINAL_CUT` and `KEPT_HERE`, are never made.

---

### L8. Episodes from before the switch keep the old way

**Goal:** On a Mac switched to its picked drop folder, an episode filed before the switch works as today until it is handed off (D9), and no old code is deleted. Built right after L2c (L2b, which came between them, is dropped): its tests are the net every later task keeps green.

**Evidence:** Jason's answer to Question 2, "Yes, some do". What such an episode still reads of this Mac after the switch: no pending (P3-1, and `heldInOld` refuses the switch while one is owed), no status of this Mac's import in `Episodes/.importing` (likewise, and P3-1 counts them), and its files in its folder in Dropbox. `guide.js` `opsText` (146-150) appends `ONLINE_ONLY` (101) after the page's "taken" step of a raw video; the finish's online-only line is on its old path (finish.js 1135, in `finishNow`).

**Files:** create `tool/tests/old-episodes-after-switch.test.js` (a world whose Mac has `dropPath` and `exportsPath`, holding a layout-4 raw episode, a layout-4 finished video, and a layout-5 plan with one part in Dropbox); `tool/guide.js` (`opsText`: `ONLINE_ONLY` only for a record without `local`).

**Interfaces.** Consumes L1's settings and L2's `record.local`. Produces nothing new: every later task branches on `record.local` and leaves this world's results as they are.

**Failing tests first** (most pass at once; each later task keeps them passing):
- `episodes` lists the old raw episode with its files checked in its Dropbox folder, and no "on <Mac>" line.
- `kind "<id>" raw --private no --again` reads it the old way: the reading's files go into its Dropbox folder, and its read run waits for its own late check (`LATE_CHECK_MS`).
- `app "<id>"` makes its project from the recording in its Dropbox folder.
- `finish "<id>" --yes` writes its hand-off, and its run waits for its check as today; nothing is written under `pending/` but what today's finish writes.
- `spell "<id>" add …` while that check runs is refused in today's words.
- After its hand-off: nothing in `pending/original/`, and no `Original files/` in its folder.
- The guide's step after the page's "taken" step of the old raw episode ends with the "Make online-only" sentence; a local raw episode's does not.
- The old plan: `plan "<title>" join` joins the old way (the joined video filed into the plan's Dropbox folder, with its pending); a part dropped after the switch joins from its own `video/`.

**Steps:** tests; the `opsText` fork; whole suite; commit.

**Words Sallie sees:** none new. **Contract touched:** the guide's words, in step with brimm-operations: the "taken" step of a local raw video no longer ends with the "Make online-only" sentence; an old one's still does. **Size:** M.

---

### L3. The import files a video on this Mac

**Goal:** On a local Mac, the import makes its files from the dropped video in place, as today, then files the episode on this Mac: the video copied into `video/`, its files beside it, and only the first record in Dropbox; the original deleted from the drop folder once the record is written. No pending and no wait before Ready (L5 adds the first record's check, behind). It never takes or empties another episode's folder.

**Evidence:**
- The import works on the drop file in place (`unedited.js` `workOn`, 484; the arrival wait 520-); Dropbox comes in only at filing (`filing.js` `fileEpisode` 121-184: `put` 140-147 clones the video and each file, the record at 174) and at the late check (`keepLateCheck`, unedited.js 568-577; `pendingFor` 193-197; `writePending` 367-372; `finishLate` 489-542, which deletes the drop file at 506). The first record is one of the late check's entries today (filing.js 149, 174).
- `findFolder` (filing.js 64-79) names a folder from Episodes alone (`episodeFolderName`, names.js 23-29: `<day> <stem> (<Mac>)`, then `-2`), swallows any error listing Episodes (67-71), and reuses a folder with no whole record and no video (74-76), which every local episode's Dropbox folder is once its first record is lost. Stems repeat ("Movie Recording.mov").
- Status files: `importing.js` `writeStatus` (102), `readStatuses` (123), `statusesOf` (150), `removeStatus` (165), each deriving `Episodes/.importing` from `root` (61-67) and naming the file after the video (39), which may be a client's name. Their calls: filing.js 212 and 244 (`statusReporter`), 266 (`heldBy`), 348 and 352 (`clearCrashes`), 476 (`waitingStatus`), 511 and 537 (`finishLate`), 588 (`hold`), 602 and 607 (`releaseHeld`), 635, 705 and 767 (`importEpisodes`); edit.js 796 (`importLines`), 1013 (`episodes`), 1627 and 1635 (`lateCheckOwed`), 1683 and 1723 (`retry`), 6038 (`guideDrops`); late-wait.js 65, 80; unedited.js 460 (`labelsGiven`), 1251 (`importHold`); switch.js 79-81 (and the words at 80, 132 and 145 that name the folder).
- Until L3, `importing.js` and `switch.js` read and write `Episodes/.importing` alone (`importingFolder(root)`), which install.sh no longer makes on a local Mac (L1): a local Mac's status writes would fail there. L1 made `importingFolderOf` and `statusFoldersOf` (settings.js 86 and 88-92), and nothing calls them yet; it left `heldInOld` (switch.js 66-186, called from settings.js `planned` at 583) reading `Episodes/.importing` alone (L1's deferred minor: "heldInOld must read statusFoldersOf"). No Mac is switched to a drop folder of its own before Phase 3 merges, so nothing between L1 and L3 guards it.
- Where another Mac's import matters: `importHold` (unedited.js 1247-1268), `lateCheckAt` and `ownCheckOnly` (late-wait.js 61-67, 77-81), `importLines` (edit.js 795-805), `heldBy` (filing.js 261-277). A MacBook on a Dropbox drop folder writes its statuses in `Episodes/.importing` (move.zsh 197 passes `--drop Drop`).
- `episodeHolding` (filing.js 334-339) says a held video stays "until Dropbox's check of its copies passes".

**Files:** `tool/filing.js` (`findFolder`, `fileEpisode`, `heldBy`, `clearCrashes`, `importEpisodes`), `tool/unedited.js` (`workOn`'s filing, `keepLateCheck`, `importHold`), `tool/importing.js`, `tool/late-wait.js`, `tool/switch.js` (`heldInOld`), `tool/settings.js` (`planned`'s call of `heldInOld`), every status call above; tests `filing.test.js`, `unedited.test.js` (the import's describes: every import is light since Phase 2), `importing.test.js`, `edit.test.js` (its describe "node edit.js bring, status and retry"), `settings.test.js` (where `heldInOld` is tested, through `write` and `plan`), `late-wait.test.js`, the lock's place tests.

**Interfaces.** Consumes L1's `episodeFilesFolder`, `importingFolderOf`, `statusFoldersOf`, `isLocal`, and L2's `LOCAL_VERSION`. Produces:
- `importing.js`, renamed so a call left on an old name fails: `writeStatusIn(folder, status, writeText)`, `readStatusesIn(folders, now)` (each entry with its `folder`), `statusesIn(folders, video, machines, now)`, `removeStatusIn(folder, video, machine, id)`; each throws for a folder whose name is not `importing` or `.importing`. Writes go to `importingFolderOf(settings, home)`; reads go to `statusFoldersOf(settings, home)`. edit.js keeps `ctx.statuses` (where it writes) and `ctx.statusFolders` (where it reads).
- `filing.js` `heldBy({ root, statusFolders, video, bytes, now, gatedAs })`; `clearCrashes({ statusFolders, machine, now, alive, pid })` removes this Mac's stopped statuses in whichever folder each is; `switch.js` `heldInOld({ …, statusFolders })`, which settings.js `planned` gives `statusFoldersOf(held, home)`: the folders of the settings the switch is from.
- `filing.js` `findFolder(episodes, { video, bytes, machine, day, work, importId, dropId })`: listing Episodes throws on any error but ENOENT; a name is free only when neither `Episodes/<name>` nor `<work>/<name>/video` is there, unless that `video/.import.json` names this import (`importId` and `dropId` both); a re-run of a stopped import finds its folder by that marker, whatever day it was named on.
- `fileEpisode(…, { onRecordCopy })` on a local Mac: the record's `writeText` writes the record whole into the import's run folder (kept), calls `onRecordCopy({ from, to, bytes })`, and then clones it in by the rule; it returns `{ name, path, record, entries }`, `entries` holding that entry alone. L3 passes no hook; L5 passes the one that writes the `record` pending.

**The order of filing on a local Mac:** before its work, the import lists Episodes: an error other than ENOENT leaves the video for the next look, as a video still arriving is (no status, one log line, the drop file left); at the filing step, list Episodes again (an error then fails the import, as today, and she says "try it again"); find the folder (above); make `video/` and write `video/.import.json` (`{ import, drop }`) before anything else; write each made file there whole (a name of its own, then renamed), keeping a list of what this run wrote; check the drop file is unchanged (`sameFile`); copy it into `video/` under a name of its own (a clone on one disk, a whole copy otherwise), check its size, and rename it into place; write `0001.json` by the rule, its work copy kept, with `local: { on: machine }`; then delete the drop file, if it is unchanged. If anything fails before the record, only the files this run wrote are removed, then the marker, then `video/` if it is empty; the drop file stays; the import ends as one that failed, as today. A drop file that cannot be deleted stays, held by its episode, and the log says so.

**Failing tests first:**
- `unedited.test.js` / `filing.test.js`, an import on a local Mac:
  - the recording and its `.srt`, `.transcript.txt`, `.words.json`, `.cut-plan.txt`, `.cut-plan.json`, `.rough-cut.srt` and `.rough-cut.transcript.txt` are in `video/`, at the sizes the record lists;
  - the Ready banner is posted, and the drop file deleted, before any `wait`; no import pending is written (`pending/*.json`; L5 adds the first record's, in `pending/record/`);
  - `Episodes/<folder>/` in Dropbox holds `record/0001.json` and nothing else; the record is layout 6, with `local.on` this Mac, `editing` and `released: null`;
  - its status files are in the local importing folder (`importingFolderOf(settings, home)`) while it runs, with no `Episodes/.importing` there, as install.sh leaves a local Mac, and gone after; nothing is written in `Episodes/.importing`.
- "a record that cannot be written leaves the video in the drop folder": the record write fails; the video is in the drop folder at its size; nothing this run wrote is left in `video/`; the status says it failed; the next run imports it.
- "two drops of one stem on one day, Episodes unreadable for the second": the second import does no work and writes no status, its drop file stays and is looked at again, and the first episode's `video/` is untouched; with Episodes unreadable only at the filing step, it fails with its status, and the first `video/` is untouched.
- "a first record lost, then a drop of the same stem": the new import takes a new name, and the first episode's `video/` is untouched.
- "a run stopped after the copy and before the record": the video is still in the drop folder, and the next run finds its folder by the marker, on the same day and on a later one.
- "a run stopped after the record and before the delete": the video stays in the drop folder, held by its episode, in the words `already imported as <label> (<short id>). It stays in the drop folder for you to delete.`
- "a drop folder in Dropbox": the video is copied out, never renamed, and deleted only after the record is written; a placeholder there is read through first, as today.
- "a Zoom download is held as today", with its status in the local folder.
- "a video dropped again under the same name and size is held by its episode", as today.
- "another Mac's import still holds a reading here": a status of "Jason's MacBook" in `Episodes/.importing`, at work on a video, holds `importHold` for that video on the local Mac Studio, as today.
- "a status call on any other folder throws".
- `retry` on a local Mac finds a failed import by its local status (`edit.test.js`); `heldInOld` on a switch from a picked folder reads the local status folder (`statusFoldersOf`): in `settings.test.js`, `write --drop Drop --switch-back` on a Mac whose local status folder holds a failed import of a video in its picked folder is refused in `heldInOld`'s words and writes nothing.

**Steps:** tests; fail; `importing.js` and its calls (`heldInOld` and its call in `planned` among them); `findFolder`; `fileEpisode`, `unedited.js`; whole suite; commit.

**Words Sallie sees:** the held line above. The banner stays `Ready: <label>. In Claude, say "what's waiting?"`, and comes when the import's own work ends, not 15 minutes later.

**Contract touched:** none. **Size:** L.

---

### L4. Readings, copies, joins and footage on a local episode

**Goal:** On a local episode, Claude's reading starts at once and puts its files into `video/`; the copy for HyperFrames starts at once from `video/`; a join reads each part from its own place and files the joined video into the plan's `video/`; nothing writes a pending or waits for a check.

**Evidence:**
- reading.js: the hold loop (306-331, `READ_LOOK_MS` 52, `READ_HOLD_MS` 53); `written` (459-630) puts its files through `keepCheckInStep` (609) and `intoEpisode` (unedited.js 883-1217: it takes the Dropbox folder from the video's path at 886, `ownLateCheck` 1002, `replaceIn` 1182, the record 1205, the wait 1214); `writtenSession` (644-708) puts a session's teachings files in the same way (698). A raw reading's branch (495-538) renders the rough cut into `renders/` (`renderRough`, 714-733) and writes no Final Cut file (Phase 2's F3).
- edit.js: `waitForImport` (3364-3398); `answerKind` (4693-4888; `readingWaitsUntil` at 4872); `kind --again`'s set-aside (`setAsideWritten`, 5107-5184).
- join.js: parts read at 448 and 501 (`hereWhy` reads through); a single part filed with `fileEpisode(… into …)` (496-513), then `pendingFor`/`writePending` (518-520) and "copied into Dropbox … in 15 minutes" (521-523); a HeyGen voice taken in through `importInto` (425); `afterJoin` (585-606) kickstarts the agent; `opensAt` (571-577).
- footage.js: "A plan's record is never written for a part" (5, 123); `makePart` (403).
- workcopy.js `makeFootageCopies` (929-956) reads parts through `readAll`; plan-project.js `copyOfFootage` (86).
- late-wait.js `projectWaits` (183-186): "reading" while a read run is at work and the record holds no reading yet, "verify" while the import's check is owed (`owedFor`); `waitFacts` (171-176). Used by app.js (89 in `readyAt`, 432-450 in `adoptProject` and `makeProject`), app-reel.js (120, 194, 211, 297), edit.js (1185 in `claimAndBring`, 5828 in `guideCopy`).
- Phase 1's parked items here: M2 (a past-due pending: reading at once, copy refused) has no local case; `reading.js` `AGAIN` (66) puts a flag in her words.

**Files:** `tool/reading.js`, `tool/unedited.js` (a local put beside `intoEpisode`), `tool/edit.js` (`waitForImport`, `answerKind`, `setAsideWritten`), `tool/join.js`, `tool/workcopy.js`, `tool/footage.js`, `tool/plan-project.js`, `tool/explainer.js`, `tool/late-wait.js`, `tool/app.js`, `tool/app-reel.js`; tests `reading.test.js`, `edit-kind.test.js`, `edit-workcopy*.test.js`, `join.test.js`, `footage*.test.js`, `app.test.js` (where `plan-project.js` is tested, with `join.test.js`), `edit-app*.test.js`, `late-wait.test.js`.

**Interfaces.** Produces in `unedited.js`:
- `putHere(found, files, { change, expectRev, home, writer }) -> { put: true, record } | { put: false, why }`: it first writes `video/.put.json`, the renames it will make; then each file written whole into `video/` under a name of its own; each file it replaces renamed into `video/history/<stamp> <name>`; then renamed into place; then the record written to Dropbox with `expectRev`, by the rule; then the journal removed. A file it is given under `history/` (a reading's own set-aside: reading.js 504, 669) is written into `video/history/` and never listed; `putHere` lists only files outside `history/`. A refused record write renames each replaced file back and removes the new ones, and gives `{ put: false, why }` in `intoEpisode`'s words for that case. A journal left by a stopped run is undone first by the next `putHere` on that episode. No wait and no check.
- Callers: `reading.js` `written` and `writtenSession` for a local record (in place of `keepCheckInStep` + `intoEpisode`); join.js's filing, and `plan … voice`'s run (explainer.js), which files a voice as the plan's video; `setAsideWritten` uses `video/history/` for a local file.
- `late-wait.js`: for a local record `projectWaits` drops only its "verify" branch, and "reading" stays; `waitFacts` gives nothing.

**Ruling for L4: a plan is filmed on one Mac.** A planned record with no footage is on no Mac. The first `footage` answer for it on a local Mac writes two records: the plan's first, with its `expectRev`, adding `local: { on: <this Mac> }` (layout 6, still a plan by L2); then the part's. A run stopped between them leaves a plan marked local with no part yet, which is harmless: the answer is said again. `plan … voice` on a local Mac marks the plan local the same way before it files the voice, and files it with `putHere`. A video answered as footage on another Mac for a plan already on this one is refused, and nothing is written; and that Mac's planned card never offers it: `plannedOffers` (footage.js 82) and the plans waiting for footage (52, 466) leave out a plan whose `local.on` is another Mac. A plan whose footage began before the switch has no `local`, and joins the old way (L8); a part dropped since is read from its own `video/`. Cost if wrong: footage filmed on two Macs is dropped on one.

**Failing tests first:**
- `reading.test.js`, a raw reading of a local episode: no `READ_LOOK_MS` wait, no lock file, no mark, no pending; the reading's files are in `video/` (no Final Cut file is made since Phase 2's F3; the rough cut's render is in the episode's work folder, in `renders/`, as for any episode, and listed nowhere), the replaced ones in `video/history/`; the record is written last; no `wait` of `LATE_CHECK_MS`; the notice goes at once.
- "a local session's reading writes nothing under `Episodes/<folder>/` but its record", and does not wait; "a local session read twice leaves nothing in `Episodes/<folder>/history/`, and nothing of its earlier teachings in its record": they are in `video/history/`.
- "a refused record write puts the earlier files back": the record write fails with `CHANGED`; `video/` holds the earlier files, byte for byte; the result says why, with the `AGAIN` line.
- "a reading stopped between its renames and its record is undone by the next put": `video/` holds the files the record lists, at its sizes.
- `edit-kind.test.js`: a local raw answer starts the reading and the copy, and says `waitForReading`'s words, with no time of Dropbox's.
- `app.test.js`: "no project is made while a local read run is at work" (`projectWaits` "reading"); on a local episode `readyAt` names no Dropbox time and `projectWaits` is never "verify".
- `edit-workcopy*.test.js`: the copy of a local episode reads `video/<file>`, with no wait step in the panel.
- `join.test.js`: two parts joined; the joined video is in the plan's `video/`; no pending; `kickstart` never called; the notice is `Ready: "<title>" is made from its footage. In Claude, say "what's next?"`.
- A single part filed into the plan's `video/` by a clone on this Mac (the part stays its own episode).
- `footage.test.js`: the first part answered for a plan on a local Mac writes the plan's record with `local.on`, then the part's; "a footage answer stopped after the plan's record and before the part's: the plan is local and still a plan, and the answer can be said again"; on another Mac, `footage "<label>" "<plan>" talking --client no` says `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` and writes nothing, and that Mac's planned card does not offer the plan.
- `plan … voice` on a local Mac: the plan's record gets `local`, the voice is in `video/`, and no pending is written.
- `AGAIN`: `Nothing was changed. Tell me what it is again, and Claude reads it again.`

**Steps:** tests; fail; `putHere` and its journal; the callers; join and footage; the copies; `AGAIN`; whole suite; commit.

**Words Sallie sees:** the join's notice above; `AGAIN` above; `"<plan>" is filmed on the Mac Studio: drop its footage there. Nothing was changed.` No line names Dropbox for a local episode.

**Contract touched:** none. **Size:** L.

---

### L5. The checks run behind, and nothing waits for them

**Goal:** On a local episode, the finish ends as soon as its hand-off is written. Dropbox's check of its copies in `final/` is made 15 minutes later by the launch agent's loop, from a pending on this Mac's disk; so is the check of a local import's first record, and later of Original files (L6). A spelling, a second hand-off or the Reels' hand-off goes ahead at once, and the check never puts an older file back over theirs. An episode from before the switch is finished as today.

**Evidence:**
- finish.js `finishNow` (664-): `markChecking` (1068), the wait (1089), the check and the deletion of the originals it took (1086-1133), the record put back when it is gone and no later one is there (1106-1119), the online-only line (1135); the run holds the episode's lock throughout (finish-check.js header); its work folder is in `.runs` (681).
- What waits on it today: `lateCheckWaits` (edit.js 3598-3601, called at 3849 and 3949 in `saveSpellings`), `stoppedWords`' finish branch (1805-1807), the guide's checking step (guide.js 169, `reelsStep` 383, `videoNext` 429-438); `checkingNow` (finish-check.js 60) believes the marker only while the run holds the lock.
- R1c's machinery: `takeLateCheckLock` (filing.js 428), `finishDue` (a closure of `importEpisodes`, 660-693) and its loop (777-827), `settleReading` (445), `keepCheckInStep` (late-wait.js 102), the pending's `reading` mark.
- Pendings today are `pending/<id>.json` (`pendingFile` 364), read by `readPendings` (375, `*.json` only), `heldInOld` (switch.js 98), `mine()` (648), `owedFor` (late-wait.js 23) and `importHold` (unedited.js 1260). `mine()` also feeds `waitingStatus` (474; called at 745, 804, 818), which writes an import's status. `clearRuns` (834-852) runs first in `importEpisodes` (777) and calls `resolve(p.work)` for every pending it reads (842).
- The finish's check already leaves files a later record changed (`movedOn`, finish.js ~1094-1100).
- Today the first record is one of the import's late-check entries (filing.js 149, 174). `undone()` (episode.js 629-634) cannot see a lost first record, and an episode with no whole record reads as an import not finished (episode.js 586-588). After L3 a local import writes no pending.

**Rulings for L5** (the designer writes `L5-task.md` within them):
0. A local import writes a `record` pending before its first record reaches Dropbox, as the finish writes its own first (ruling 1): L3's `onRecordCopy` hook gives the record's entry once its work copy is written whole and before it is cloned in, and the pending is `{ version: 1, kind: "record", id, name, folder, root, machine, entries, work, lastCopy }`, `work` the import's run folder, which keeps that work copy. A record write that then fails takes the pending away. At its check, a pending whose record never reached Dropbox (the run stopped before it) is dropped, and the stopped import is found again by its marker (L3); otherwise the first record is put back only when it is gone and no later record is there; then the pending and `work` go. The import's own work does not wait for it.
1. On a local episode the finish writes its `final` pending first, before its record: `{ version: 1, kind: "final", id, name, folder, root, machine, revision, entries, took, work, lastCopy }`, `work` its own folder in `.runs`. Then its record and hand-off; then it asks the agent to run (`ctx.kickstart()` when `!ctx.agentRunning()`) and ends; its result is written then. At the check, a pending whose revision the record in force never held is dropped: the finish died before its record. `L5-task.md` rules putting the record back, as finish.js 1106-1119 does today. `finish.checking.json` is left while the pending is there, and `checkingNow` believes the pending, not the run's lock.
2. A pending of a kind lives in `pendingFolder(home)/<kind>/<id>.json` (`record`; `final`; `original`, L6). Every pending carries `work`: a folder in `.runs` its check needs, or null. `readPendings(home)` stays the import's alone (`pending/*.json`); `readPendingsOf(home, kind)` reads one kind. `waitingStatus`, `owedFor`, `importHold` and `heldInOld` read only the import's, as they do today through `readPendings`. `mine()`'s test of what is still open, and `finishDue`'s dispatch, read every kind; `clearRuns` keeps every `work` a pending of any kind names, and skips null. `dueAt` honours a pending's `nextLook` when it has one; a pending given a `nextLook` is not marked made for the run (`checked`); and `mine()`'s still-open test leaves out a pending past its `lookUntil`, which the next run looks at once (L6 sets both fields). `finishDue` stays synchronous: every check it calls is.
3. `finishDue` makes a due `final` pending under `late-check.lock`: it reads the pending again, reads the record in force, and puts a file back only when that record lists it at the entry's bytes (as `ownLateCheck` judges); a file listed at another size, or not listed, is left. When every copy is whole and the record in force holds this revision, it deletes each original the finish took from Downloads (`took`; never one from another exports folder, D12) that is unchanged since; one changed is kept and said in the log. A problem is flagged as today (`flagProblem`, the notice, `finish.problem.json`).
4. A writer into `final/` of a local episode (a finish, `finish … reels`, the spellings' new hand-off) takes `late-check.lock` around its puts and record write, and takes the entries it replaces out of every pending of this episode (`keepCheckInStep`, moved into `filing.js` as `takeOutOfCheck`). It never waits on a check.
5. `lateCheckWaits` (the other Mac's finish still checking) stays for an episode from before the switch; a local episode never meets it (D3).
6. The import loop (`importEpisodes`) runs while any pending of this Mac is open, of any kind. After its last look it reads the pendings once more, and goes on if one came meanwhile.

**Files:** `tool/finish.js`, `tool/finish-check.js`, `tool/finish-reels.js`, `tool/filing.js` (`finishDue`'s dispatch, `record` and `final`, `takeOutOfCheck`, `clearRuns`, `writePending`/`readPendingsOf`), `tool/unedited.js` (the local import's `record` pending), `tool/late-wait.js` (`keepCheckInStep` moved), `tool/edit.js` (`stoppedWords`, `saveSpellings`), `tool/guide.js` (the checking step), `README.md` (the finish's late check, 333-349: its steps 5 to 7, "What she is told, and when", "Afterwards"); tests `finish*.test.js`, `edit-finish*.test.js`, `filing.test.js`, `edit-spell*.test.js`, `guide.test.js`, `checking-world.js` users, `late-wait.test.js`, `settings.test.js` (where `heldInOld` is tested).

**Failing tests first** (the headline cases; `L5-task.md` adds the rest):
- "a local import writes its `record` pending before its record reaches Dropbox": `pending/record/<id>.json` holds the first record's entry, and is on disk when the clone is made; the Ready banner is not held for it. "Its check puts back a lost first record": with the record file gone and no later one, the due pending puts it back, then goes; with a later record there, it puts nothing back. "A run stopped between the pending and the record": the pending is dropped at its check, and the next run finds the import's folder by its marker.
- "the finish of a local episode ends once its hand-off is written": `pending/final/<id>.json` is on disk before the record; the result is written, the lock let go, with no `wait` of `LATE_CHECK_MS`; `kickstart` called once.
- "a spelling right after a hand-off writes the next revision at once": no `Studio checks Dropbox's copies at` line; the pending no longer holds the files the spelling replaced.
- "the due check puts back a missing copy", "leaves a file the record in force lists at another size", "deletes the Downloads export only when every copy is whole and it is unchanged", "flags a problem as today".
- "a finish killed after its pending is written still has its check made"; "a `final` pending for a revision the record never held is dropped at its check".
- "a writer waits for the check's lock, never for the check": with the lock held by a live check, a spelling tries again within `LOCK_WAIT_MS` and goes ahead when it is let go.
- "a pending in `pending/<kind>/` is never read as an import's": `readPendings`, `heldInOld`, `owedFor` and `importHold` leave it alone, so an `original` pending holds no reading; no import status is written for it.
- "a pending with `work: null` stops no import": `clearRuns` skips it.
- "a pending written during the loop's last look is made in the same run".
- "an episode from before the switch is finished as today" (L8's case stays green).

**Words Sallie sees:** gone for a local episode: `The hand-off is written, and Studio checks Dropbox's copies at <time>.` for a command stopped by a finish (`stoppedWords`, edit.js 1807); `The finish on <Mac> is still checking its copies in final/, until <time>. Say it again after that. Nothing was changed.`; the guide's line of when Studio checks; the finish's `To save space on this Mac, make the episode's folder online-only…`. Kept: the notice and the guide's note when a check fails.

**Contract touched:** the guide's words, in step with brimm-operations: for a local episode the checking step (guide.js 169, 383, 429-438) gives no time of Dropbox's check; the hand-off file, its name and its place are as today. **Size:** L. **Design first.**

---

### L6. Original files after the hand-off

**Goal:** At the hand-off of a local video, every recording she dropped for it is copied into `Original files/` in Dropbox, behind her; the Mac's copy is deleted only once Dropbox's check of that copy has passed and Dropbox reports it uploaded; a failed check keeps it and tells her. A session's recording, or one held beside a session, never moves; a video that becomes a session after its move is left as it is in Dropbox, and Jason is told. Every file made from a recording stays (D6).

**Evidence:**
- Jason's rulings (Spec); `arch.md` finding 2 (Dropbox is the recording's only second copy today).
- The hand-off writers: the finish run (finish.js `finishNow`, after its record and hand-off, ~1043-1060), `importHandoff` (edit.js 3713-3732: a finished video's or an iPhone clip's first hand-off, from the spellings), `saveSpellings` (3830-3975: a new revision), `finish … reels` (finish-reels.js).
- A video read as another kind can be answered as a session after its hand-off (edit.js 4814-4824 in `answerKind`, held.js 78 `noteAfterAll`; the withdrawal comes "whatever revision the hand-off is at", guide.js 69-70); another version answered as a session makes a video held beside one (gate.js 110 `gatedAsOf`, finish.js 319 `linksOf`).
- `lateCheck` only looks at the file on this Mac's disk (dropbox.js 42-46, 89-110); nothing reads whether Dropbox has uploaded it. `faces.swift` is a script `swift` runs (unedited.js 386, in `facesIn`), and `tools.swift` is found by `findPrograms` (106).
- The loop: "each late check is made once in a run" (`checked`, filing.js 642, left out of `mine()` at 648); `dueAt` (413) is the last copy + 15 minutes, so a pending past it makes `left` 0 or less (802-803) and the loop turns with no wait. `finishDue` is synchronous (660; its count is used at 815), and also runs in a `setInterval` (743-754), whose try/catch would not catch a rejected promise.
- The working copy's key uses the recording's size and time in milliseconds (`workCopyKey`, workcopy.js 434-438), through `copyPathsOf` (app.js 344-347; called at 417, 464, 549), `footageCopyPaths` (plan-project.js 89) and the Reel's key (workcopy.js 494-502, `reelCopyKey`); `changedSince` compares to the second (app.js 376-382). `/bin/cp -c` keeps the time to the nanosecond, but a copy made online-only and brought back down takes its time from Dropbox.
- `runningCommand` (detached.js 52) reads `episode.lock` alone, not `workcopy.lock` (`workCopyLockOf`, workcopy.js 551); a record write that crosses her command makes it read CHANGED as "this episode changed on the other Mac" (episode.js 651).
- A record lists only paths inside its own folder (`episode.js` `isFiles`, no `..`).

**Rulings for L6:**
1. **What moves:** the video's own recording (`video.file`), or for a video made from a plan each footage part's (`planned.filmed.parts`), each whose record has `local.on` this Mac, a part that shows a client included, and that the gate holds neither as a session nor beside one. The gate is asked when the move is owed, when it is made, and before the delete. One found a session's, or held beside one, before its move is not moved: its pending goes, and the log says so. The joined video, a HeyGen voice, the HyperFrames work copy, the transcripts, words, cut plans, notes, teachings files, `renders/` (the rough cut's render) and every HyperFrames project and its media stay where they are: Studio made them, and they are small, a project's own, or what a later Reel or work copy is made from.
2. **Where:** `Episodes/<the recording's own episode folder>/Original files/<file>`: a part's in the part's own folder (Jason: "Each part's folder").
3. **When:** each hand-off writer, once the record holding the hand-off is written, calls `oweOriginals`, which writes `pending/original/<the recording's episode id>.json`, `{ version: 1, kind: "original", id, name, folder, root, machine, owed: true, entries: [], took: [], work: null, lastCopy }`, for each recording to move, and asks the agent to run. An owed pending is due at once. Writing it again for one already moved, owed or checking changes nothing. At the start of each run the loop also owes the move for any local, handed-off episode on this Mac whose recording is still in `video/`, not listed in `Original files/`, with no `original` pending, and not held as or beside a session: a hand-off writer killed before it owed the move.
4. **The move,** in the agent's loop, under that episode's `late-check.lock`, holding its `episode.lock` as a detached run does, with the command word `originals`, and put off while a live run holds `episode.lock` or `workcopy.lock`: the gate is asked again; `video/<file>` is cloned into `Original files/<file>` by the rule (`cloneIn`); the record is written by the rule (`expectRev`), adding `files["Original files/<file>"]` at the recording's size and `local.original: { file, bytes, mtimeMs }` as it is on the Mac (the local entry stays); then the pending becomes `{ owed: false, entries: [{ from: <video/file>, to, bytes }], took: [{ path: <video/file>, id: fileId(path) }], lastCopy: now }`. A command of hers meanwhile is stopped by that lock, not told that the other Mac changed the episode: `stoppedWords` (edit.js 1805-1811, whose callers at 2048 in `finishEpisode` and 4090 in `spell` would otherwise say "originals is running for this episode"; Phase 2 took away the third, `layerStart`'s) gives the `originals` run its own line, `Its recording is being copied into Dropbox. <again>`, and `status` (1534) lists it as `<name>: its recording is being copied into Dropbox.` A refused record write takes the clone away and leaves the pending owed for the next look.
5. **The check,** 15 minutes later (`LATE_CHECK_MS`), under the same locks: the gate is asked again; `lateCheck(entries)`; a clone it had to put back starts its 15 minutes again. When the check puts nothing back, the record in force lists each clone at its entry's bytes, `uploadedOf` says `true` for each, and each Mac's file is unchanged since (`sameFile`), each Mac's file is deleted and the pending removed. When `uploadedOf` says `false` or `null`, the Mac's copy stays and the pending gets `nextLook` (now + `UPLOAD_LOOK_MS`, 10 minutes) and, the first time, `lookUntil` (the check's time + 1 hour). L5's `dueAt` honours `nextLook`, and `mine()`'s still-open test leaves out a pending past its `lookUntil`, so the loop looks again every 10 minutes for that hour and can then end; `finishDue` at the start of each later run of the agent (a drop, a login, a hand-off's kickstart) looks at it once. Nothing is deleted without the flag. A problem keeps the Mac's copy and the pending (with `problem`), posts the notice once, and writes `originals.problem.json` in the episode's work folder, which the guide reads. The log says, by the label or name every log line uses: `<who>: its recording is copied into Original files in Dropbox.` at the move; `<who>: Dropbox has not uploaded its copy yet, so the recording stays on this Mac.` once a run while it waits; `<who>: Dropbox has its copy uploaded, so the recording is taken off this Mac.` at the delete.
6. **A session after the move:** when the gate holds a moved recording's video as a session, or beside one, at the check or later, Studio moves and deletes nothing in Dropbox, and keeps the Mac's copy if it is still there; the pending goes. `ORIGINALS_SESSION(label)` is said in the log, as a line of that video's step in the guide, and on its line in `episodes`, for as long as the record lists `Original files/<file>` and the gate holds it as a session or beside one, judged with its versions (`gatedAsOf(linksOf(root))`, as `episodes` already names such a record). Jason removes the copy by hand if he wants.
7. **Afterwards:** `fileAt(ctx, { folder, record }, record.video.file)` gives `video/<file>` while it is on this Mac, else `Original files/<file>` in Dropbox when the record lists it; `fileProblems` calls a local recording missing only when neither is there. `recordingStat(ctx, found) -> { size, mtimeMs } | undefined` gives the Mac's file while it is there, else `local.original`'s `bytes` and `mtimeMs` when the copy in Dropbox has that size. Every reader of the recording's size or time for a key or a comparison reads it: `changedSince` and `copyPathsOf` (app.js 376, 344; at 417, 464, 549), app-reel.js 167, 234, 288, `footageCopyPaths` (plan-project.js 89), the Reel's key (workcopy.js 494-502), free.js 321. A reader that needs the recording whole brings it down as for any file in Dropbox (`isWhole`, `readThrough`).
8. **An episode from before the switch:** its own recording is not moved (D9). A part dropped after the switch for a plan from before it is local, and moves when the plan is handed off: the old finish's run owes it too.

**Files:** create `tool/originals.js`, `tool/uploaded.swift`, `tool/tests/originals.test.js` and a stand-in for the helper; `tool/dropbox.js` (`uploadedOf`); `tool/filing.js` (`finishDue`'s `original` kind, the owing at the start of a run); `tool/where.js` (`fileAt`'s recording branch, `recordingStat`); `tool/episode.js` (`fileProblems`); `tool/finish.js`, `tool/finish-reels.js`, `tool/edit.js` (`importHandoff`, `saveSpellings`: the calls to `oweOriginals`; `episodes`' line; `stoppedWords` and `status` for the `originals` run); `tool/app.js`, `tool/app-reel.js`, `tool/plan-project.js`, `tool/workcopy.js`, `tool/free.js` (`recordingStat`); `tool/guide.js` (the two lines); tests `dropbox.test.js`, `filing.test.js`, `finish*.test.js`, `edit-spell*.test.js`, `guide.test.js`, `app.test.js`, `edit-app*.test.js`, `episode.test.js`, `local-episode.test.js`.

**Interfaces.** Consumes L5's pending kinds and dispatch, L2's `fileAt`. Produces:
- `tool/uploaded.swift`: `swift uploaded.swift <file>` prints one JSON document, `{"uploaded": true}`, `{"uploaded": false}` or `{"uploaded": null}` (when Foundation gives no value), from `URLResourceValues.ubiquitousItemIsUploaded`; when the file cannot be looked at it prints nothing, says why in one line on standard error, and ends 1, as `faces.swift` does.
- `dropbox.js` `uploadedOf(path, { swift, exec = execFileSync, timeoutMs = UPLOADED_TIMEOUT_MS }) -> true | false | null`, synchronous: `exec(swift, [UPLOADED, path], { timeout: timeoutMs })`, `UPLOADED_TIMEOUT_MS` 20 seconds; null when swift is not there, or the run fails, times out or prints no value. So `checkMoved` and `finishDue` stay synchronous, and nothing in the loop's timer can reject.
- `where.js` `recordingStat(ctx, found)` (ruling 7).
- `originals.js`: `originalsOf(ctx, found, record) -> [{ name, folder, record, file }]` (rulings 1-2); `oweOriginals(ctx, found, record) -> { owed: [id] }` and `oweForgotten(deps) -> { owed: [id] }` (ruling 3); `moveOwed(pending, deps) -> { moved: true } | { later: true } | { dropped: why } | { why }` (ruling 4); `checkMoved(pending, deps) -> { deleted: [path], waiting: "upload" | "", problems: [text] }` (rulings 5-6), both synchronous, which `finishDue` calls for kind `original`; `ORIGINALS_PROBLEM(name) -> string`; `ORIGINALS_SESSION(label) -> string`.

**Failing tests first:**
- `dropbox.test.js`: `uploadedOf` with a stand-in `exec` gives `true`, `false`, and `null` for a run that throws, one that times out, printed words that are not the JSON, and no swift; it returns a value, never a promise.
- `originals.test.js`:
  - "a raw video's recording is owed at its hand-off": after a local finish, `pending/original/<id>.json` has `owed: true`; `kickstart` called once.
  - "the move clones it into Original files and lists it": `Episodes/<folder>/Original files/<file>` is there at the recording's size, with the same `mtimeMs` (the test's clone is `cloneFile` itself, on its own folders); the record lists both entries and `local.original`; the Mac's copy is still in `video/`.
  - "the check deletes the Mac's copy only when the copy is whole and uploaded": with `uploadedOf` true, once due, `video/<file>` is gone, its transcript, words and cut plan stay, and the pending is gone.
  - "not uploaded yet": with `uploadedOf` false, and with null, the Mac's copy stays, the log says so once, the pending stays with `nextLook` and `lookUntil`; a later look with `true` deletes it.
  - "a paused upload is looked at six times in the hour, and the loop then ends": with `uploadedOf` false throughout and a stand-in clock, the loop looks every 10 minutes, never turns with no wait, and returns once `lookUntil` has passed; the next run looks once at its start.
  - "a copy put back is checked again": a missing clone is put back from the Mac's copy, the Mac's copy stays, and the pending is due 15 minutes later.
  - "a problem keeps the Mac's copy and tells her": with a clone that cannot be put back, `video/<file>` stays, the notice is posted once with `ORIGINALS_PROBLEM`, `originals.problem.json` is written, and the pending keeps `problem`.
  - "a session's recording never moves": a local session handed off owes nothing (`oweOriginals` gives `{ owed: [] }`), and nothing is in `Original files/`; so for a video held beside a session.
  - "a session after all before the move": a video answered as a session between the owe and the move is not moved, and its pending goes.
  - "hand-off, then the move, then the session-after-all answer": nothing in Dropbox changes (the copy and its entry stay, nothing is deleted there), the Mac's copy is kept if it was still there, the pending goes, and `ORIGINALS_SESSION` is said in the log, in the guide's step and in `episodes`.
  - "a part that shows a client moves into its own folder's Original files".
  - "a video made from a plan": each local part's recording moves into its own folder's `Original files/`; the joined video stays in the plan's `video/`.
  - "a run at work puts the move and the deletion off": with a live run holding `episode.lock`, and with one holding `workcopy.lock`.
  - "her command during the move": `finish "<id>"` while the move holds the lock says a line beginning `Its recording is being copied into Dropbox.` and writes nothing; `status` lists the move.
  - "a hand-off writer killed before it owed the move": the next run of the loop owes it.
  - "an old plan's local part moves when the plan is handed off"; "an episode from before the switch owes nothing for its own recording"; "a Mac's copy changed since is kept, and said in the log".
- `app.test.js`: "after the move, `app` opens the project as it was": no `recordingChanged` line, no new work copy; "with the Mac's copy gone and the copy in Dropbox brought back down with a time in whole seconds, `app` keeps its working copy" (`recordingStat` gives `local.original`'s).
- `edit-app*.test.js`: "a later Reel is made from the recording in Original files" (`app "<id>" reel 1`, a placeholder brought down first).
- `episode.test.js`: the recording gone from `video/` and listed in `Original files/` is no problem.
- `guide.test.js`: with `originals.problem.json`, the guide's step says `ORIGINALS_PROBLEM`; for a session with a recording in `Original files/`, and for a video held beside one (another version answered as a session), its step and its line in `episodes` have the `ORIGINALS_SESSION` line.

**Steps:** tests; fail; `uploaded.swift` and `uploadedOf`; `originals.js`; the dispatch and the owing at a run's start; `fileAt`, `recordingStat` and their readers; `fileProblems`; the hand-off writers; the guide and `episodes`; whole suite; commit.

**Words Sallie sees:**
- `The recording of <name> stays on this Mac: Dropbox didn't keep its copy whole. Ask Jason.` (the notice, and the guide's line).
- `The recording of <label> was copied into Dropbox, in Original files, before it became a session. Dropbox keeps it there and in its history. Jason removes it by hand if he wants.` (the guide's step, `episodes`, the log).
- `Its recording is being copied into Dropbox. <again>` (a command stopped by the move's lock), and `<name>: its recording is being copied into Dropbox.` (`status`).
- Nothing is said when a move goes well, or while it waits for the upload; the log says it.

**Contract touched:** the guide's words, in step with brimm-operations: the two lines above in the guide's step. **Size:** L.

---

### L7. Open it once: drop it, and it runs until it needs her

**Goal:** After her answer nothing asks her to wait or to say a thing twice. Her answer starts the reading and the copy with no 20-second claim; "open it in HyperFrames" said while the copy is being made opens HyperFrames by itself when the copy is done.

**Evidence:** `kind` and `teachings` claim and wait `CLAIM_WAIT_MS` (20 s, edit.js 1116) in `claimAndWait` (5290-5320, called at 4740 in `answerKind` and 5588 in `askTeachings`), to keep two Macs from answering one video; with a local drop another Mac never sees it (D3). `app` says `The video for HyperFrames is being made. … Say "open <name> in HyperFrames" again when it is done; …` (app.js `beingMade`, 82), so she says it twice. Phase 1's M7: the join's notice says "It opens in HyperFrames about 17:26" (`opensAt`, join.js 571-577), when its video is ready; she still has to ask. `runDetached` takes the episode's lock for the whole run (detached.js 172).

**Files:** `tool/edit.js` (`answerKind`/`claimAndWait` for a local record; `app`'s copy-at-work branch; a detached `app --when-ready`), `tool/app.js` (`beingMade` words; the run that opens when ready), `tool/workcopy.js` (the run's end is what it waits for: `workCopyLockOf`, its result), `tool/join.js` (the notice), `tool/guide.js` (`copyStep`, 346-352, which says `Say "open it in HyperFrames" when it is done.`), the skill twins (the "Open it in HyperFrames" row: when Studio says it opens by itself, tell her and stop); tests `edit-kind.test.js`, `edit-app.test.js`, `app.test.js`, `join.test.js`, `guide.test.js`, `studio.test.js`.

**Interfaces.** Produces `app --when-ready "<episode folder>"` (a detached run, not in her `HELP`; like `workcopy --now`): it waits, without the episode's lock, while the copy's lock is held by a live run (at most the copy's own limit); then it takes the lock and does what `app` does (the project made and opened); if the copy failed, it opens nothing and posts the notice below. An episode from before the switch keeps its claim and today's words.

**Failing tests first:**
- `edit-kind.test.js`: a local raw answer writes its record once, with no `wait(CLAIM_WAIT_MS)`, and starts the reading and the copy; an old episode's answer still claims and waits.
- `edit-app.test.js`: with the copy at work, `app` says `Its video for HyperFrames is being made. HyperFrames opens it by itself about 17:26.` (`… by itself when it is ready.` with no measured speed), starts one `app --when-ready`, and claims nothing; a second `app` meanwhile says the same and starts nothing.
- The `--when-ready` run: when the copy's result is ok, the project is made and the `openApp` stand-in called once; when it failed, nothing opens and the notice is posted; while it waits, `free`, L6's move and her other commands are not refused for it.
- `join.test.js`: the notice is `Ready: "<title>" is made from its footage. Say "open <title> in HyperFrames": it opens by itself once its video is ready.`
- `guide.test.js`: for a local episode whose copy is being made, the step ends `Say "open it in HyperFrames": it opens by itself when it is ready.`; an old episode's ends as today.

**Steps:** tests; fail; change; the skill row; whole suite; commit.

**Words Sallie sees:**
- `Its video for HyperFrames is being made. HyperFrames opens it by itself about 17:26.`
- The notice when it cannot: `The video for HyperFrames of <name> couldn't be made. Say "open <name> in HyperFrames" to try again; if it says this again, ask Jason.`
- The join's notice above (Phase 1's M7, now true).
- The guide's step while the copy is made: `Say "open it in HyperFrames": it opens by itself when it is ready.`

**Contract touched:** the guide's words, in step with brimm-operations: `copyStep`'s last sentence for a local episode, as above. **Size:** M.

---

### L9. The words and the docs

**Goal:** Everything she reads and every doc describes the picked drop folder, the exports folder, AirDrop, Option-drag for her editor's videos, and Original files; an episode from before the switch keeps its old words.

**Files:**
- The skill twins: the drop folder (`guide drop`), AirDrop (`Send it to this Mac with AirDrop. It lands in Downloads: drag it from there into your drop folder.`), a finished video from Dropbox (`Hold Option while you drag it into your drop folder, so Dropbox keeps its copy.`), the other Mac's line, and the export row (L1b). Phase 2 took the "By hand in Final Cut" section away; what it kept of it is "Keeping an episode's folder on this Mac" (SKILL.md 202-205, SKILL-open.md 198-201): Make available offline at an episode's first open, and Make online-only after its hand-off. Both are for an episode in Dropbox: the section says they are for an episode from before the switch (and on a Mac whose drop folder is in Dropbox), and that a video kept on this Mac needs neither.
- `tool/guide.js`: the overview's drop step says the AirDrop sentence for a clip.
- `tool/install.sh`: the header (15-45: `--machine`, `--drop`, and L1's `--drop-folder` and `--switch-local`, whose "It takes the light import" goes, since every import is light) and the say-lines (the plan's lines, 643-668; "Done", 1010-1022, which says a video's files are copied into Dropbox and checked 15 minutes later before it leaves the drop folder) for a picked folder; and the line said when `write` refuses (966), which names the status files' folder that a local Mac does not make (L1's deferred minor).
- `README.md`: the folders (161-182), the import (184-196), the claim (245), "Switching a Mac's drop folder" (255: `--drop-folder`, `--exports-folder`, `--switch-local`, `--switch-back`, the cloud warning, the refusals; its `--import light|full`, stale since Phase 2 refused the full import, becomes `--import light`; and, L1's deferred minor, on a Mac with a drop folder of its own `episodes` and the guide list only that folder's waiting videos, `dropFolders`, edit.js 813-825) and L1's "A drop folder of a Mac's own" (257: "A Mac on the light import may watch" becomes "A Mac may watch", since every import is light), the finish's check (333-349), and a paragraph on Original files and the upload flag.
- `CLAUDE.md` (repo): the rule "Experiments never write into the watched Dropbox folder: a new file there starts the tool (and `~/Movies` on the Mac Studio is a link into Dropbox)." becomes "Experiments never write into a Mac's drop folder: a new file there starts the tool (and `~/Movies` on the Mac Studio is a link into Dropbox)." (Phase 2 added the words in brackets when it took away the rule on Final Cut's library; they stay); "Both Macs" says each Mac picks its drop and exports folders, a video's own files stay on the Mac that took it in until its hand-off, its recordings then move into Original files, and episodes from before the switch keep the old way. The first is a rule under "Rules that are never broken": Jason said "Yes, change it" in chat on 6 Nov, so the builder changes it without asking again.
- `docs/requirements.md`: a dated line under "Decisions" (6 Nov: the drop folder out of Dropbox, picked per Mac; the exports folder; every recording into Original files at the hand-off, deleted from the Mac once Dropbox says uploaded, never a session's; edits not handed between Macs).
- Tests: `studio.test.js` pins the new skill sentences; `local-episode.test.js` holds that no line said for a local episode has "Make available offline" or "Make online-only".

**Words Sallie sees:** as above. **Contract touched:** the guide's words, in step with brimm-operations: the overview's AirDrop sentence. **Size:** M.

---

## By hand, on the Mac Studio

For the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT), a new group "Phase 3: the local working folder", numbered after the last check on the page. Claude runs every Terminal step on the Mac Studio, by absolute path, reads the output and writes the answers; Jason does only what is on screen, one plain instruction at a time; each check starts on his yes in chat. Only Jason's own recordings and test files, never Sallie's or a client's. `<id>` is the six-character short id Claude reads from `episodes` and writes into the command itself. `… <command>` stands for `node "$HOME/Claude Code/brimm-video-studio/tool/edit.js" <command>`; `PENDING` for `"$HOME/Library/Application Support/BRIMM Video/pending"`; `<its folder in Episodes>` for the episode's folder under `$BRIMM_DB/BRIMM Video/Episodes` (`BRIMM_DB` is the page's own constant for The BRIMM DB; this public repo never names the Dropbox account's folder); `FLAG <file>` for `swift "$TMPDIR/uploaded-check.swift" "<file>"`, where Claude first writes the four lines below to that file. The page writes every command in full, with no placeholder left.

```swift
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let values = try? url.resourceValues(forKeys: [.ubiquitousItemIsUploadedKey])
print(values?.ubiquitousItemIsUploaded.map { $0 ? "true" : "false" } ?? "null")
```

**P3-0. Does Dropbox say when a file is uploaded?** *(First, before L6 is built.)*
1. Jason, in chat: a folder in his own Dropbox, outside BRIMM Video, for two test files. Claude: `head -c 1048576 /dev/urandom > "<folder>/upload-check-1.bin"`, then `FLAG "<folder>/upload-check-1.bin"` every 15 seconds for two minutes. Expect `false` at first, then `true` once the Dropbox menu shows it synced.
2. Jason: in the Dropbox menu, pause syncing. Claude writes `upload-check-2.bin` the same way and reads its flag for two minutes: expect `false` throughout. Jason resumes syncing; expect `true` within a few minutes.
3. On Jason's yes, Claude deletes the two test files.
- Answers: each value and its time. If the flag never reads `true`, or reads `true` while paused, L6 would never delete, or could not trust its flag: Jason decides what to do before L6 is built.

**P3-1. Before the merge.**
1. Claude: `launchctl list | grep com.thebrimm`. Every line starts with `-`: nothing is importing.
2. Claude: `find PENDING -name '*.json' | wc -l` prints `0`: no Dropbox check is owed.
3. Claude counts what waits in the Mac Studio's drop folder in Dropbox, without listing it: `ls -A "$BRIMM_DB/BRIMM Video/Drop/Mac Studio" | grep -v -e '^\.DS_Store$' -e '^\.brimm-watched-by$' | wc -l` prints `0`. If not, the merge waits until those videos are imported.
4. Claude counts the Mac Studio's statuses in Dropbox: `ls -A "$BRIMM_DB/BRIMM Video/Episodes/.importing" | grep -c ' (Mac Studio) '` prints `0`.
- Answers: the four outputs.

**P3-2. The merge, and Studio brought up to date.** *(On Jason's yes at each step.)*
1. Claude: `… status` lists no run at work.
2. On Jason's yes, Claude merges this plan's pull request on GitHub (`gh pr merge`).
3. On Jason's yes, Claude: `git -C "$HOME/Claude Code/brimm-video-studio" pull --ff-only`. Prints `Fast-forward` and the files.
4. Claude: `git -C "$HOME/Claude Code/brimm-video-studio" log --oneline -1`.
5. On Jason's yes, Claude writes her folder again: `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" studio --node "$(command -v node)"`. Prints `Written:` and her folder's path.
- Answers: what each step printed. Until P3-3 the Mac Studio works as before.

**P3-3. Switch the Mac Studio to its picked folders.** *(Changes the launch agent: on Jason's yes.)*
1. Jason, in chat: where the Mac Studio's drop folder and exports folder go. By default BRIMM Video Work › Drop, and Downloads as today. Claude writes his folders into the commands.
2. Claude: `"$HOME/Claude Code/brimm-video-studio/tool/install.sh" --print --machine "Mac Studio" --drop-folder "$HOME/BRIMM Video Work/Drop" --exports-folder "$HOME/Downloads" --import light --handoff 2 "$BRIMM_DB/BRIMM Video"` (the page's `MS_INSTALL` with the two folder options). Expect `Its drop folder, on this Mac:` with the folder, `Exports from HyperFrames, looked for in:` with the other, `WatchPaths` naming the drop folder, the old drop folder named as no longer watched, the cloud warning only if the drop folder is in one, and `Nothing was changed.`
3. On Jason's yes, the same with `--yes` in place of `--print`.
4. Claude: `plutil -p "$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist" | grep -A2 WatchPaths` names the drop folder; `node "$HOME/Claude Code/brimm-video-studio/tool/settings.js" show` prints `  Its drop folder:  ` with it, and `  Exports from HyperFrames, looked for in:  ` with the other.
5. Claude counts the old `Drop/Mac Studio` again, as in P3-1 step 3: `0`. Jason, in Finder: Control-click Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio and choose Move to Trash. Code never touches it.
- Answers: what the print said would change; the two checks; the count, and that the folder is gone.

**P3-4. A recording of yours, from drop to hand-off, with nothing waiting.**
1. Jason: in Finder, open the drop folder (BRIMM Video Work › Drop in his home folder, or the one he picked) and drag a short recording of his own into it (one or two minutes).
2. Claude: `… episodes` until it is waiting (about a minute); Jason tells Claude it is raw, no session; Claude: `… kind "<label>" raw --private no`. Expect the reading started, with no Dropbox time.
3. Claude: `… guide "<id>" tell`. Expect: read by Claude within a few minutes of the answer, not 15 minutes after the drop.
4. Claude: `… app "<id>"`. Expect `It's open in HyperFrames.`, or `HyperFrames opens it by itself about …` and then HyperFrames opening by itself.
5. Jason: in HyperFrames, Export, This Mac, into the exports folder.
6. Claude: `… finish "<id>"`, then on Jason's yes `… --yes`. Expect the hand-off shown in Finder, and the run ended within a minute or two.
7. Claude: `ls -A "<its folder in Episodes>"` prints `final` and `record`, and `Original files` a minute or two after the hand-off; `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists the recording and its files.
8. Claude: a spelling at once: `… spell "<id>" add "<a word it heard>" "<its spelling>"`. Expect it to go ahead, with no "checks Dropbox's copies" line.
- Answers: the times from drop to Ready, from the answer to read, from `app` to open; what steps 7 and 8 printed; if the exports folder is not Downloads, whether the export is still there after P3-7.

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

**P3-7. The recording reaches Original files, and leaves the Mac only when Dropbox says it is uploaded.** *(P3-4's episode.)*
1. Within two minutes of P3-4's hand-off, Claude: `ls "<its folder in Episodes>/Original files"` lists the recording, and `ls "$HOME/BRIMM Video Work/<its folder>/video"` still lists it: the Mac's copy stays until the check.
2. Claude: `grep "copied into Original files" "$HOME/Library/Logs/brimm-video.log" | tail -1` shows the launch agent's line for the move. Then `FLAG "<its folder in Episodes>/Original files/<the recording>"` once a minute until it prints `true`, for at most 30 minutes; then, once a minute, `find PENDING -name '*.json' | wc -l` until it prints `0`, for at most 30 minutes more. Then `grep "taken off this Mac" "$HOME/Library/Logs/brimm-video.log" | tail -1` shows the agent's own flag read, and `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists its transcript and other files, and not the recording. If a limit passes, Claude reads the log's last lines for the move (`grep "Original files\|uploaded" … | tail -5`) and stops the check there.
3. Claude: `… app "<id>"`. Expect `It's open in HyperFrames.`, with no line that the recording changed.
4. Jason, in Finder: Control-click the episode's Original files folder in Dropbox and choose Make online-only. Claude: `… app "<id>"` opens it with no new video for HyperFrames made; `… app "<id>" reel 1` makes Reel 1, its recording brought down from Dropbox first.
- Answers: the outputs, and the times from the hand-off to `true` and to the count of `0`.

**P3-8. A session's recording stays on the Mac.**
1. Jason: drag another short recording of his own into the drop folder. Claude answers it as a session: `… kind "<label>" session --private yes`.
2. Claude: `ls -A "<its folder in Episodes>"` prints `record` only; `ls "$HOME/BRIMM Video Work/<its folder>/video"` lists the recording.
3. Only if the Mac Studio's teachings are on: Claude reads its teachings and hands it off as the page's session steps say, then, 31 minutes later, repeats step 2 (no `Original files`, the recording still in `video/`) and `find PENDING -name '*.json' | wc -l` prints `0`. With teachings off, Claude notes that L6's tests hold this case.
- Answers: what steps 2 and 3 printed.

**P3-9. An episode from before the switch.** Claude finds one of Jason's own that is not handed off, by its record (layout 5 or below, no `local`). Claude: `… guide "<id>"` gives its old step; `… app "<id>"` opens it as before. If it is then handed off, `ls -A "<its folder in Episodes>"` shows no `Original files`. Claude also counts the episodes from before the switch that are not handed off yet, for the later round that removes the old code.
- Answers: what each printed; the count.

**P3-10. Checks this retires.** Claude marks as skipped, with the note "retired by the local working folder": `pr9-two-macs` (check 34). The other two-Mac checks, 24 (`pr11-two-macs`) and 29 (`pr18-two-macs`), were retired with Final Cut in Phase 2 (its check 85, `p2-retire`). `pr17-online-only` stays: an episode from before the switch still has the step. Nothing to run.

---

## Rulings made in this plan, for Jason to check

1. **Each Mac picks its drop folder; by default BRIMM Video Work › Drop** (D1, D11). It may not be in BRIMM Video's own folders, BRIMM Video Work (but its Drop), her chat's folder or the workshop, Zoom's folder, Downloads, or nested with the exports folder; a cloud one is allowed with a warning. Cost if wrong: a folder refused that you wanted.
2. **A video's own files live in its folder in BRIMM Video Work, under "video"; what is set aside there stays there, unlisted** (D1, L2c). Cost if wrong: a folder's name.
3. **The plan's script files stay in Dropbox** (D1). Cost if wrong: none for her; two places for a plan's files.
4. **One Mac per video, with no claim waited for** (D3, L7); another Mac lists it and says "carry on there". Cost if wrong: a title or a name is changed on the Mac that holds the video.
5. **Dropbox's checks of the first record, `final/` and Original files run behind, from the launch agent** (D5, L5, L6), only for a video kept on a Mac; an older one is checked as today. A pending is written before its record, so a finish killed after it still has its check. Cost if wrong: L5's design pass finds another way, before any code.
6. **At the hand-off, every recording she dropped is copied into Original files, a client's part included; the Mac's copy goes once the check passed and Dropbox says uploaded; never a session's; a video that becomes a session after its move is left in Dropbox, and you are told** (D6, L6; your "Right away", "When Dropbox says uploaded", "Yes, move them too"). Every file made from a recording stays, the joined video included. Cost if wrong: space on the Mac that a derived file still takes; a recording kept on the Mac while Dropbox has not uploaded its copy.
7. **A footage part's original goes into the part's own folder in Episodes** (L6; your "Each part's folder"). Cost if wrong: none; it is your answer.
8. **An episode from before the switch keeps the old way, and its own recording stays where it is in Dropbox** (D9, L8; your answer to Question 2). Moving it into Original files would be a move in Dropbox. Cost if wrong: an old recording sits at its folder's top, not in Original files.
9. **The import copies each video out of the drop folder and deletes the original after the record is written, never a rename; it never takes or empties another episode's folder; and while Episodes cannot be read it waits for the next look, or fails at the filing step for her to try again** (D11, L3). Cost if wrong: a crash at the wrong moment leaves a copy in the drop folder for her to delete.
10. **Studio never deletes an export from an exports folder other than Downloads** (D12); it still deletes the one it took from Downloads after Dropbox's check, as today. Cost if wrong: exports left in that folder for her to tidy.
11. **Phase 2 came first (your "Phase 2 first"), so nothing of Final Cut, `release`, the take-over or the full import is left for a video kept on a Mac to meet: L2b, which made that code refuse one, is dropped. Every Mac imports lightly, so a Mac may have a drop folder of its own whatever its settings say of the import** (D13, L1b). Cost if wrong: none for a video kept on a Mac; the code is gone.
12. **Phone clips come by AirDrop, and may sit in Dropbox's Downloads until she drags them in; her editor's videos are Option-dragged in** (D7; your words). Studio touches no downloaded video until it is in the drop folder. P3-5 and P3-6 check it. Cost if wrong: the guide's words.
13. **"Open it in HyperFrames" said once opens it by itself when its video is ready** (L7). That also makes Phase 1's join notice true (M7). Cost if wrong: HyperFrames opening while she is in another app; she asked for it.
14. **This Mac writes its import statuses on its own disk and reads every Mac's** (D1, L3), so a MacBook's import still holds a reading here. Cost if wrong: one more folder read per look.
15. **Leaving a picked drop folder takes `--switch-back`** (D8, L1), so the Move to Studio app's `--drop Drop` never switches a Mac back unasked. Cost if wrong: one more word when you mean to go back.
16. **The guide's words for a switched Mac change in step with brimm-operations** (In step with brimm-operations). Cost if wrong: none to the hand-off; the page's guide and Studio's guide must merge together.
17. **Phase 1's parked items:** M2 has no local case; M7 is fixed by L7; `reading.js`'s AGAIN words lose their flag (L4). M6 stays parked.

## Questions for Jason

1. **Is brimm-video still switched on on Sallie's laptop?** (Phase 2's Question 1.) Not blocking: this plan keeps every field her old tool checks either way. If it may be on, Claude gives you one step to turn it off when you're next at her laptop.
2. **Do any videos already in Studio still need editing or a hand-off after the change?** Answered 6 Nov, (b): "Yes, some do". They keep the old way until handed off (D9, L8), and the old code goes in a later round.
3. **When may Studio take a recording off the Mac?** Answered 6 Nov: "Yes, every recording" moves into the video's Original files in Dropbox at the hand-off ("Right away"), and leaves the Mac "When Dropbox says uploaded" (D6, L6).
4. **A planned video's footage: where do its originals go?** Answered 6 Nov: "Each part's folder" (L6).

Still to come from Jason, at build time: P3-0's result, before L6 is built. (L9's change to a rule in CLAUDE.md's "Rules that are never broken" has his yes: "Yes, change it", 6 Nov.)
