# brimm-video, the next version: design

Written 2026-10-14 for Jason Ogden, and **revised twice the same day**. First after a review that Jason asked for: four reviewers (fidelity to his decisions, feasibility, Sallie's workflow, risks and phasing) raised 85 findings, a checker confirmed 82 of them in whole or in part, and Jason answered the review's four questions. Then after a second review (`/tmp/brimm-video-design-review-2-2026-10-14.md`), from which Jason asked for five things to be fixed here and the rest to be carried into the phase plans. The sections "What the review changed" and "What the second review changed", at the end, map each finding to where it is answered.

Design only. Built so far: phase W (the write fix, pull request jogden12/brimm-video#4) and phase P (the progress panel, pull request #5). Both are merged into `main` (3030b37) and live, because the launch agent runs `tool/unedited.js` from the main checkout. Nothing else is built or installed on either Mac. Phase 0 was run by hand on the Mac Studio on 2026-10-14 (its findings are in section 7). It left there the "BRIMM final" Share destination, which stays (setup item 10). To be deleted once phase 0 is done: the test libraries and folders in `~/BRIMM Video Work` (`Phase 0/`, and the test files in `From Final Cut/`); and, in Dropbox, the test folder `The BRIMM DB/Phase 0 test (delete after)/`, the test libraries' backups in `~/Movies/Final Cut Backups.localized/`, and one throwaway Motion title in `~/Movies/Motion Templates.localized/`.

## What this rests on

**Jason's decisions of 2026-10-14**, as given in the brief for this design (memory note `video-editing-direction`, brimm-operations' L7):

- Final Cut Pro stays the editor: "Let's stick with final cut pro for now." He will install it on Sallie's laptop (MacBook Pro, November 2024, M4, 16 GB). He has checked the first real outputs, two Zoom recordings of 2026-10-14: "they look great".
- brimm-video is "the app that takes raw unedited video, creates transcripts and other files needed for BRIMM Ops, and automatically creates Reels. from there, it should be able to add effects, editing presets, text and graphics, and then generate final, ready to post videos via final cut pro."
- The first Reels are lightweight: "some of those may not be utilized, so the initial reels creation should be lightweight". Only the Reels she picks are finished.
- It runs on both Macs: "so that Sallie can run the full workflow on her laptop OR send it to me to run on the mac studio when she's busy." Each Mac has its own drop folder, watched by that Mac alone.
- At the end of an edit, one file goes to BRIMM Ops: the episode's final transcript, and each kept Reel with its transcript and its on-screen title. BRIMM Ops then writes the cascade, "preferably" without a trip back. Short pieces that BRIMM Ops recommends are edited by hand.
- The episode name is asked for at the start, and a placeholder is fine. brimm-video recommends the on-screen title, the user edits it once, and it does not change after that. Thumbnails are not brimm-video's job.
- The YouTube and Zoom transcript tool moves into brimm-video, as a phase of its own.
- The brand is the brand guide's, and the name on screen is Sallie Ogden. Jason pays for the typefaces chosen. Either logo mark will do, and the logo stays an editable setting.
- Nothing is written in place inside Dropbox.

**Jason's answers in the design session**, picked from options the session offered:

1. The final transcript is made by transcribing the finished videos again.
2. **Hand edits: brimm-video layers on exports.** He confirmed this after the review, with its three costs in view. Claude's cut changes come before hand trimming, and after hand trims, cuts are made by hand. A caption corrected by hand in Final Cut is lost at the next layering, so caption fixes go through Claude. Reading Final Cut's exports is the largest phase. He also confirmed the review's guard: a push refuses until hand edits are exported and pulled, or the person says there were none.
3. **Sallie's laptop gets the code by a git clone with a read-only deploy key.** He confirmed this after the review, as the project's one stated secret (section 6).
4. **The upright rough cut of the whole episode is a working copy only.** It is never finished or handed off. The Reels are the upright videos that get finished.
5. **Graphics are designed now** (section 4, `graphic`).
6. **Off-brand stand-ins may be posted.** Videos titled with Final Cut's built-in titles, and words set in Varela or Lucida Grande, may be posted while the brand's typefaces and BRIMM templates are made.

**Assumed here, for Jason to correct:**

- The editing session is Claude Code in the Claude desktop app's Code tab. A route through Claude chat would need a local MCP server (phase 7, later at most).
- Claude never writes FCPXML or episode files itself. It runs brimm-video's commands.
- Final Cut libraries stay on each Mac's own disk. Only the episode folder travels, through Dropbox.
- After the move, the transcript tool runs on the Mac Studio only. That sits uneasily with "Sallie can run the full workflow on her laptop": her YouTube and Zoom transcripts for BRIMM Ops would still come from the Mac Studio. `finish` makes the transcripts of finished episodes on either Mac.
- This design asks for three changes in brimm-operations, each made in a session there: the hand-off fixture for L7, the `.srt` fixture that replaces today's shared code, and removing `transcribe/` after phase T.

**Proposals in this design that Jason did not ask for, to accept or drop:**

- **Showing the other Mac how an import is going.** Each import writes a status file in `Episodes/.importing/` whatever Jason decides: it is what refuses a second import of a video and lets `episodes` show one that stopped (section 1). The proposal is only that the status file also carries the step and percent, so the other Mac sees the progress.
- Jason ran phase 0 himself, from made-up files that `docs/phase-0/make-files.mjs` makes: parts A and B on the Mac Studio on 2026-10-14, in about four hours. Part C waits for Sallie's laptop. The hand-built test project of the presets research (its question 8) is not part of phase 0, and is still open.
- Jason does the setup on Sallie's laptop with her, in person or by screen sharing.
- **When the episode's name is asked for.** Recommended: the video's file name at the drop is the placeholder, and Claude asks for the name at the first `open`. The other choice: the progress panel asks for the name when the import begins, and never holds the work up. That needs a text field in the panel.

## The answer in brief

```
 Sallie's laptop                   Dropbox: The BRIMM DB/BRIMM Video                                   Mac Studio
 ───────────────                   ──────────────────────────────────                                  ──────────
 launch agent ◀── watches ── Unedited Video/Sallie's laptop/   Unedited Video/Mac Studio/ ── watches ──▶ launch agent
      │                                                                                                    │
      └── import (unattended, kept awake) ──▶ Episodes/2026-10-14 Pricing talk (Mac Studio)/ ◀── import ───┘
                                                record/ (id, rev, files), transcript, cut plan,
                                                rough cuts, Reel previews, edit/ (timelines), final/
                                                       ▲   every file cloned in by the Dropbox rule, never renamed
 Claude Code session ⇄ local Final Cut library        │        local Final Cut library ⇄ Claude Code session
   ~/BRIMM Video Work/: From Final Cut/, and <episode>/ (pushed copies, library)     (the same on the other Mac)
                                                       │
                    finish: asks, then takes what was Shared, transcribes again ──▶ final/<Episode>.brimm-ops.json ──▶ BRIMM Ops
```

| # | What is settled | The recommendation |
|---|---|---|
| 1 | Folders and outputs | `The BRIMM DB/BRIMM Video/`, beside `BRIMM VIDEO Transfer`, so the transcript tool's agent is not woken by edits. It holds `Unedited Video/<Mac>/`, each watched by its own Mac, and `Episodes/`, which no Mac watches. An episode folder is never renamed. It has an id, a revision number, and a list of its files with their sizes. Each file goes into Dropbox as an APFS clone under its final name, and nothing there is written into or renamed. The record is a new file at each change. A check at least 15 minutes after the last copy confirms it |
| 2 | Paths across Macs | Stored timelines name media by paths relative to themselves. Final Cut is handed a local copy with this Mac's paths and library, `copy assets` 0 and `suppress warnings`. Exports are localised: paths, bookmarks, library, uids, a template's path. There is one library for each episode on each Mac, and one event in it |
| 3 | Lightweight Reels | Candidates, and a 540x960 preview made from each candidate's own stretch only. A picked Reel becomes an upright Final Cut project. No `reel add`. A short or upright recording gets no Reels |
| 4 | Editing session | Sallie works in a small folder of her own, `~/BRIMM Video Studio`, whose skill runs the tool by path and is denied everything else. Long commands run detached. Times are read on the timeline she names. Layering on exports, with the push guard. A `graphic` command |
| 5 | Finish | Share and File > Export XML… both save into one local folder, `~/BRIMM Video Work/From Final Cut/`. `finish` finds the files by the project names recorded at each push and asks, in the foreground. Then a detached run checks and transcribes each finished file again, copies everything into `final/` by the rule, and leaves a result that `status` reports. Hand-off version 1 adds the episode's id, a revision and its kind |
| P | Progress | Built: pull request jogden12/brimm-video#5 |
| 6 | Setup | Both Macs, each install after `--print` and Jason's yes. Only this Mac's drop folder and the episodes being edited are kept offline. The deploy key is a stated exception. The two Macs are kept on the same versions |
| 7 | Phases | W (the write fix, pull request #4, merged), 0 (Final Cut facts: done on the Mac Studio, part C to come), 1a (the Mac Studio alone), 2 (finish and hand-off, on one real episode), 1b (Sallie's laptop), 3, 4, 5, 6, T. P is done |

---

## 1. Folders, writing into Dropbox, and picking an episode up

### Folders in Dropbox

```
The BRIMM DB/
  BRIMM VIDEO Transfer/              the transcript tool's main folder and Zoom Video Transfer, unchanged
    Unedited Video Transfer/         today's drop folder: retired, left as it is
  BRIMM Video/                       new, beside BRIMM VIDEO Transfer
    Unedited Video/
      Mac Studio/                    drop a video here to have the Mac Studio import it
      Sallie's laptop/               drop a video here to have her laptop import it
    Episodes/
      .importing/                    a small status file for each import in progress
      2026-10-14 Pricing talk (Mac Studio)/   one folder for each video imported, named with the Mac that imported it. No Mac watches it
```

- **Why beside `BRIMM VIDEO Transfer`, not inside it.** The transcript tool's launch agent watches `BRIMM VIDEO Transfer`. launchd wakes it on any change there, which was seen on 2026-10-14 while the unedited folder changed, and an editing session makes many changes. The tool would ignore them, but it would run each time.
- **Why one folder for each Mac.** Both Macs watching one folder would import every video twice, because each Mac's lock is in its own temp folder (Jason's decision). The installer marks the drop folder it watches with `.brimm-watched-by`, which holds the Mac's name, and refuses a folder that another Mac has marked.
- **Today's folder.** `Unedited Video Transfer/` stops being watched once phase 1a is installed on the Mac Studio. Its dated folders stay where they are. There is no `adopt` command. If Jason wants the two real recordings of 2026-10-14 as episodes, they are dropped again into `Unedited Video/Mac Studio/`.

### Writing into Dropbox: the rule

Jason's rule is that nothing is written in place inside Dropbox. On 2026-10-14, Dropbox undid two renames of large `.writing` files minutes after `renameSync` had returned. So the rule covers every way a file reaches or moves within Dropbox: files brimm-video makes, files other programs make for it, and every move or rename.

1. **Made outside, then copied in under its final name.** Every file is written whole in the run's own folder in the Mac's temp folder. It is then copied into Dropbox as an APFS clone, under its final name, by `/bin/cp -c`, which calls clonefile(2). Measured on the Mac Studio on 2026-10-14: Node's `copyFileSync` with `COPYFILE_FICLONE` made a full byte copy on macOS (1 GB in about a second, 1 GB used, written into the file under its final name) and `COPYFILE_FICLONE_FORCE` failed, while `cp -c` took 6 to 12 ms and used no space. A clone needs both folders on one disk, as the Mac's temp folder, `~/BRIMM Video Work` and the Dropbox folder are. Where a clone cannot be made, nothing is copied byte by byte into Dropbox: the command stops and says why. The work copy is kept. **A file already there is never written into.** `cp -c` onto an existing name makes a new file (tested 2026-10-14: a new inode, and a hard link to the old file kept the old bytes). Even so, brimm-video deletes the old file first and then clones the new one in, so nothing is renamed over it either. The record and the import's status file are never replaced at all: each change is a new file with the next number (below).
2. **Checked twice.** Once right after the copy, and again at least 15 minutes after the last copy, when a late revert like those of 2026-10-14 (minutes after the renames) would show. The import waits for it, kept awake, after any other videos it has to do. If the run is stopped first, this Mac's next run does it. A file that is missing or short at the late check is copied in again from the work copy. If it is still wrong, the log, the status file and the first lines of the cut plan say so. Only after the late check passes are the work copy and the raw video in the drop folder deleted. Commands that write only the record (`name`, `title`, `release` and the like) have no late check of their own. Instead each Mac keeps, on its own disk, the last `rev` it wrote of each episode, and a command that finds the newest record older than that says Dropbox undid the change and asks for it again.
3. **Listed.** The record keeps a list of the episode's files and their sizes. `episodes`, `open`, `push` and `finish` check the folder against the list. They name any file that is missing, short, or under another name (`.writing`, `(1)`, a conflicted copy).
4. **The raw video is copied, not moved.** It is copied into its episode folder by the rule. The original is deleted from the drop folder only after the late check passes. A video in a drop folder that matches an episode already made (by size and length) is reported, never imported twice. So if Dropbox undoes something, the worst case is a leftover in the drop folder, which `episodes` names.
5. **Never renamed.** An episode folder keeps its name from the import. No command renames or moves a file or folder inside Dropbox. `archive` only marks the record (Storage, below). `resolve` copies the copy it sets aside into `history/` by the rule, and deletes the conflicted copy only once that is whole.
6. **Other programs write locally.** Final Cut's Share and File > Export XML… both save into one folder on the Mac's own disk, `~/BRIMM Video Work/From Final Cut/`. A Share destination keeps its settings but no folder: after Next, Final Cut asks where to save every time, as File > Export XML… does. One folder for both means one answer to both dialogs. The files are told apart by type: `.mov`, `.mp4` and `.m4v` are finished videos, `.fcpxmld` and `.fcpxml` are exports. `finish` and `pull` take an episode's files by the project names recorded at its pushes (section 2), never by the episode's current name, and copy them in by the rule. They say where they looked, and ask for the file when nothing is there. An export is a `.fcpxmld` folder (phase 0, A5): it is copied in as a new folder, with its `Info.fcpxml` cloned in by the rule, and the record lists that file.
7. **Small files too.** The record, the status file and the installer's marker are written the same way.

**Phase W:** the rule applied to today's tool, as the first change of all, with its own failing test. Pull request jogden12/brimm-video#4, from another session, writes each file in the run's own folder and moves it into place whole. Phase 1a builds on it and adds the clone copy, the late check and the list. Jason merged it on 2026-10-14, and it is live. It still moves each made file into place with one rename, and it still files the raw video by renaming it into a dated folder inside the watched folder. So until phase 1a is installed on the Mac Studio, the live import breaks rules 1, 4 and 5 for every video. Nothing in the live tool is changed before then unless Jason asks.

**Not confirmed:** that an APFS clone into Dropbox's File Provider folder is safe where a rename inside it was not. Phase 1a tests it by hand on both Macs, with `cp -c`, the call the code makes: a file of over 1 GB, dropped on one Mac and copied by the import while Dropbox is still uploading it, and a file replaced the way the code replaces one, then checked on both Macs an hour later. If a clone copy is undone too, the import stops copying into Dropbox, says so, and the design comes back to Jason before anything more is built on it.

### When a file has arrived

A video Sallie drops in `Unedited Video/Mac Studio/` reaches the Mac Studio through Dropbox's File Provider. It can first appear as a placeholder showing its full size, with no data yet. Today's check (two equal sizes, five seconds apart) would pass at once, and ffprobe's first read could then hang or fail (Apple TN3150). So a file counts as arrived only when its size has settled and it is not a placeholder: its allocated blocks cover its size (`blocks * 512 >= size`), or `stat -f %Xf` shows no dataless flag. The same check runs in `open`, `push` and `finish` for every file they need. Until it passes they say "Dropbox is still bringing this over" and wait, or stop.

### What the import writes, and in what order

The import is today's `unedited.js --watch`, with these changes:

1. **At the start**, it writes a status file in `Episodes/.importing/`, named for the video and the Mac, `<video> (<Mac>) <n>.json`: the Mac, the video's name, size and length, and the step. At least once a minute while it runs it writes a new one, with the next `n`, and deletes the one before. It refuses, and says so, a video that another status file or an episode already holds.
2. **Everything is made in the work folder.** Then the episode folder is made, and the files are copied in by the rule, with the record last. A whole first record, `record/0001.json`, is the sign that the import finished. A re-run that finds a folder for the same video without a whole record reuses that folder.
3. **The folder's name** is `<date> <video's name, file-safe> (<Mac>)`: `2026-10-14 Pricing talk (Mac Studio)`. When that is taken on this Mac, `-2` follows. The Mac's name is always there, because two Macs importing at the same time cannot see each other's new folder in time.
4. **The import keeps the Mac awake**, with `caffeinate -i -w <its pid>`, which is part of macOS. The panel says "keep the lid open until this is done".
5. The import's own Final Cut file goes into `edit/` as version 0, and names the video by a relative path and no library. The notification at the end names the next step: "Ready. In Claude, say 'open the pricing talk'." Double-clicking that file hands it to Final Cut as `open -a` does, and Final Cut asks which library to import it into (phase 0, A1). With Final Cut's Import setting at "Copy to library storage location", that import copies the raw video into the library. So setup sets "Leave files in place" on both Macs (section 6), and the README says to open episodes through Claude instead.
6. **A short or upright recording**, upright or under 90 seconds, gets a main timeline in its own shape, no Reel candidates and no upright rough cut. Its record says `"kind": "short video"`.

Inside an episode folder:

```
2026-10-14 Pricing talk (Mac Studio)/
  record/                          the record: 0001.json, 0002.json … (below)
  Pricing talk.mp4                 the raw video, copied in by the rule
  Pricing talk.srt, .transcript.txt, .words.json, .cut-plan.json, .cut-plan.txt, .edit-notes.txt
  Pricing talk.rough-cut.mp4, .rough-cut.srt, .rough-cut.transcript.txt
  Pricing talk.rough-cut.vertical.mp4      a working copy only (Jason's answer 4)
  reels.json, previews/            the Reel candidates and their previews
  media/                           pictures and brand files a timeline uses, so they travel with it
  edit/                            the timelines brimm-video kept: main.v0.fcpxml, main.v3.mac-studio.fcpxml …
    from-final-cut/                exports and Shares copied in from ~/BRIMM Video Work/From Final Cut/
  history/                         what `resolve` set aside
  final/                           the finished videos, the final transcripts, the hand-off file
```

### The record

The record is a small JSON file in the episode's `record/` folder. It is never replaced: each change is written as a new file with the next number, `record/0008.json`, and the highest whole number is the record. So nothing is ever written into a file Dropbox may be syncing. Two Macs that change an episode at once both write `0008.json`, which Dropbox turns into a conflicted copy that `resolve` sorts out. Older records stay as the episode's history.

```json
{
  "version": 1,
  "id": "e-20261014-3fa9c1",
  "rev": 7,
  "writer": { "commit": "c709b57", "on": "Mac Studio" },
  "kind": "episode",
  "video": { "file": "Pricing talk.mp4", "bytes": 1823400112, "seconds": 1834.27, "recorded": "2026-10-14", "recordedFrom": "video" },
  "imported": { "on": "Mac Studio", "at": "2026-10-14T09:12:00-05:00" },
  "name": { "text": "Pricing talk", "placeholder": true },
  "title": { "text": "Price like you mean it", "from": "claude", "approved": false },
  "editing": { "by": "Sallie's laptop", "since": "2026-10-14T13:40:00-05:00" },
  "released": null,
  "files": { "Pricing talk.mp4": 1823400112, "Pricing talk.rough-cut.mp4": 41200000 },
  "spellings": [["Sally", "Sallie"]],
  "main": { "preset": { "job": "full-episode", "captions": "file-only", "look": "natural" }, "cuts": [], "texts": [], "graphics": [], "logo": false, "pushed": [], "base": null },
  "reels": [],
  "libraries": {},
  "finished": null
}
```

- `id` is made at the import and never changes. The folder name, the episode's name and the hand-off all point back to it.
- `rev` is the record's number, and goes up by one at every write. A command reads the record, does its work, and before writing looks again for a newer one. If there is one (the other Mac wrote meanwhile), the command writes nothing and says "this episode changed on the other Mac: open it again". So a stale copy can never quietly overwrite the other Mac's change. Dropbox makes a conflicted copy only when both Macs write the same number before it syncs.
- `version` is the record's layout, raised only when the record's shape changes. A command refuses to write a record whose `version` is higher than it knows ("Jason has a newer brimm-video. Ask him to update this Mac."). `writer.commit` says which brimm-video last wrote it, for information only: a commit has no order, and comparing commits would lock the other Mac out after every update Jason pulls. A command keeps any field it does not know as it found it.
- `video.recorded` is the raw video's creation time from ffprobe when the file has one (`recordedFrom: "video"`), and otherwise the import's date (`"import"`).
- Every time in it is in seconds of the raw video. A time a person gives is read on the timeline they name, and mapped back (section 4).

### Picking an episode up

- `episodes` lists each episode with its name, or Claude's recommended title and its length beside a placeholder name, who is editing it, and what was pushed and finished. It also lists videos waiting in either drop folder, and for how long, and imports that stopped: a status file not written for 10 minutes shows as "stopped on Mac Studio at Making the upright version". The Mac that wrote that file removes it at its next run.
- `open` writes the claim, waits until Dropbox has taken the change (or a fixed 20 seconds), and reads the record again. It warns when this Mac seems to be offline, and refuses when another Mac holds the claim, unless the person says to take it over. It checks the list of files before going on. When `released` lists files the other Mac made, it says "still arriving" until they are all here.
- `open` returns at once. When files are not yet whole on this Mac, it starts reading them in a detached run, which brings them down, and says "Dropbox is bringing it over. Say open again when it is done." `status` shows how far it has got.
- `release` lets the claim go, and records the files the episode then holds, with their sizes, and the answer to the hand-edit question for each timeline pushed on this Mac (section 4). It copies this Mac's Shares and exports of the episode, found by their project names, into `edit/from-final-cut/` by the rule, so the other Mac can finish with them. It ends: "Keep this Mac open and online until Dropbox shows the folder is up to date."
- Pushed files carry the Mac's name, `main.v3.mac-studio.fcpxml`, so the two Macs never write the same file.
- **Conflicts.** Every command looks for a conflicted copy of any file in the episode folder. `resolve` (Sallie says "sort out the conflict") shows in plain words what differs between the two records: Reels, texts, cuts, title, claim. It keeps the one she picks, and copies the other into `history/` by the rule before deleting the conflicted copy. Nothing is lost. It handles a conflicted copy of any file, not only of the record. Phase 1b makes a conflict on purpose across both Macs, to learn what Dropbox's File Provider calls the copy.

### The episode's name

The name is kept only in the record, the project names in Final Cut, the finished files and the hand-off. It can be given or changed at any time, because nothing is renamed: a project keeps the name it was pushed with, and `finish` and `pull` find files by the names recorded at each push (section 2). Where it becomes part of a file's name, it is used in a file-safe form: each of `/ \ : * ? " < > |` (the characters Dropbox calls incompatible) becomes `-`, there is no control character, and no space at either end. So "Pricing: what to charge?" becomes "Pricing- what to charge-". The hand-off carries the name as given. When the name is asked for is a choice for Jason (see "Proposals").

### Storage

- **On each Mac, only its own drop folder and the episodes being edited are kept "Available offline".** On the Mac Studio, the transcript tool's watched folders (`BRIMM VIDEO Transfer`, `Zoom Video Transfer`) stay offline too, until phase T gives that tool the arrival check. Everything else stays online-only. Reading a file brings it down but does not keep it, and Dropbox offers no command to keep it. So at the first `open` of an episode on each Mac, the skill asks her to mark its folder in Finder (Control-click, Make available offline), and her card says so. Phase 1b looks for a way to do it without Finder. `push` and `finish` check again that every file they use is whole. After `finish`, the skill tells her how to set the episode online-only again.
- `archive` marks a finished episode archived in its record. Nothing moves, so its libraries and a later `finish` still work. `episodes` leaves it out unless asked, and the skill tells her to set it online-only.
- `episodes` shows each local library's size and the free space on the disk.
- Final Cut renders in ProRes 422 by default, about 66 GB an hour, and a look renders the whole timeline. Setup turns background rendering off on both Macs (Jason's yes). `finish` offers to delete an episode's render files, or its whole library, once its exports exist (section 5).
- Phase 1a measures one real episode: its folder, its library, and the peak space an import needs in the temp folder. Every output is in the work folder and in Dropbox until the late check.

## 2. Paths across Macs

**The problem.** Today's `.fcpxml` names the video by its absolute path on the Mac that made it, and names its library by an absolute path too. Each Mac's path into Dropbox is different.

**Stored timelines** (in `edit/`) name media by a path relative to the file, `../Pricing%20talk.mp4`. They name no library. Final Cut 12.4 reads such a path from the file's own folder (phase 0, A1).

**What is handed to Final Cut** is a local copy, written in `~/BRIMM Video Work/<episode folder>/pushed/`. It has:
- this Mac's absolute paths
- `import-options` naming this Mac's library for the episode
- `copy assets` 0, so media are linked where they are whatever Final Cut's Import preference says, and the raw video is never copied into her library (phase 0, A3: honoured with the Import setting at "Copy"; the library holds only a link)
- `suppress warnings`

Handed over by `open -a "Final Cut Pro"`, such a copy made the episode's library with no question and opened the project in the timeline (A3, with Final Cut already open; a push with Final Cut closed is tried in phase 1a). Apple's `base url` import option is the other way to keep relative paths, and it worked too (A2). The local copy keeps this Mac's absolute paths, the simpler way.

**Exports are localised** before they go to Final Cut on the other Mac, or are layered (section 4):
- every `src` that points inside an episode folder is rewritten to this Mac's path to the same folder
- every `bookmark` is dropped, because Final Cut writes one per media-rep and it cannot resolve on another Mac
- its `<library location>` is dropped, and the localised copy names this Mac's library in `import-options`, as a push does. Final Cut did not make the library an export's own `<library>` element named: it asked which library to use (phase 0, B6)
- the uids on its assets and on its event are taken off, as brimm-video's own files leave them. An asset's uid has the same value as its media-rep's `sig` (A5); the `sig` is kept, as B6 kept it
- a `src` inside a library's `Original Media` (a copy Final Cut made of a video, as B1, B2 and B3's exports name) is mapped back to the episode's own file by its name and size, or refused in plain words. "Leave files in place" and `copy assets` 0 make it rare
- the project gets a new name and no uid
- a custom template's `src` is dropped: Final Cut writes it as a whole path through its own container, with this Mac's user name in it (A7). Its `uid`, `~/Titles.localized/<category>/<name>/<name>.moti`, has no Mac's path in it, and is kept. Final Cut found the template again by its uid alone (B6)

Phase 0 (B6), on the Mac Studio, imported a copy of a real export into a second library, with its bookmark, its uids and its template's `src` dropped, its library location replaced and its project renamed, and the template showed. In push form (B6b), the same copy made its library with no question. Rewriting `src` for another Mac is part C's to try.

Media outside the episode folder is listed: "copy it into `media/`".

**Libraries.** Each Mac keeps one library for each episode, `~/BRIMM Video Work/<episode folder>/<episode folder>.fcpbundle`, never in Dropbox. Since the folder is never renamed, the library's links never break. Final Cut sets backups for each library (Library Properties > Modify Settings), and no import option sets them. Phase 0 (B4) found where it keeps the setting: in the library's own `Settings.plist`, as `backupLocation` (a macOS bookmark) and `backupsEnabled`. A library made by a push had neither, and Final Cut backed it up into "Final Cut Backups" in `~/Movies` while it was open, about 15 to 25 minutes after a change. On the Mac Studio that folder is in Dropbox. A library made by hand afterwards took the folder set on another library, without `backupsEnabled`, so what that key does is not yet clear. And in the two hours after the folder was set by hand, with a change made in that library, Final Cut wrote no backup of it anywhere: not in the folder set, and no longer in `~/Movies`, while libraries left on the default kept backing up there. So setting the folder may stop the backups rather than move them; why is an open question. **Ruling (the lead, 2026-10-14):** library backups stay on Final Cut's default, `~/Movies/Final Cut Backups.localized`, which on the Mac Studio is inside Jason's Dropbox (about 12 MB for all its libraries). Neither the tool nor the skill tells anyone to change them. What keeps the hand work is the finish's exports, copied into `final/` (section 5). If a later check sees backups land in a folder outside Dropbox, moving them can be offered then. Whether brimm-video could write that setting itself, while Final Cut has the library closed, is untried.

**Project names.** Each push makes a new project named `<file-safe name> main v3 <short id>`, for example `Pricing talk main v3 3fa9c1`, where the short id is the last six characters of the episode's id. The push records that name. Share and File > Export XML… offer the project's name as the file's name (phase 0, A5 and A6), so `finish` and `pull` find an episode's files by the names recorded at its pushes, never by its current name, which may change after a push. The id keeps two episodes of the same name apart.

**A project name is never used twice.** When a project of the same name is in the library, Final Cut asks whether to replace the items with matching names or keep both, even with `suppress warnings` (A4c). Keep Both renames the new project `<name> 1`, which no longer matches the recorded name. Replace was not tried; it would put the new project in place of the old one, hand edits and all. So a push's version is higher than any version this Mac has handed to Final Cut for the episode, as its `pushed/` folder shows, and not only higher than the record's.

**Events.** Every push of an episode goes into one event, named after the episode folder, which never changes. With `suppress warnings`, a push with a new project name into that event asked nothing, and the video stayed linked once (A4).

**Time on the raw video's clock.** Camera files may carry a start timecode, which Final Cut uses as the asset's start; Zoom files carry none, and neither did an iPhone clip in phase 0 (B3: its asset started at 0). The writer reads the start timecode with ffprobe and gives it to the asset. In phase 0 (B3) a clip whose own timecode starts at one hour, given the same start in the FCPXML, showed 01:00:00:00; which of the two Final Cut read is not shown. The export reader subtracts it before mapping times back to seconds of the raw video.

**Colour and sound of phone video.** Phase 0's iPhone clip (B3) was HDR: HEVC Main 10, Rec. 2020 HLG with Dolby Vision profile 8, stored 1920x1080 with a rotation, so upright, on a clock of 600 a second. Final Cut wrote its format as `colorSpace="9-18-9 (Rec. 2020 HLG)"`. So the writer gives every format the colour space ffprobe finds (`1-1-1 (Rec. 709)` for bt709 or none given; `9-18-9 (Rec. 2020 HLG)` for bt2020 with arib-std-b67), never Rec. 709 by default. Whether Final Cut then converts it well to the project's is untried. The clip also holds Apple's spatial sound (APAC, four channels), which ffmpeg cannot decode, beside an AAC stereo track: ffmpeg's own choice took the AAC track, and the import names the AAC track itself to be sure.

**Versions.** brimm-video writes its own timelines in FCPXML 1.10, which Final Cut 12.4 imports (phase 0, A1 to A4). Its File > Export XML… offers 1.14 first, then 1.13 and 1.12 (A5), so phase 5 reads 1.14, and her card says to keep the version offered. Exports hold elements 1.10 has no place for (`adjust-colorConform`, on each clip that came in from a 1.10 file), so a timeline layered on an export is written at the export's version. The Mac that imports an export refuses it when its Final Cut has no DTD for that version (the DTDs are in the app bundle). Final Cut's automatic updates are off on both Macs, and Jason updates the two together.

## 3. Lightweight Reels on import

**On import:**
- Claude picks up to five candidates, each with a recommended on-screen title (a hook of at most eight words).
- Each goes into `reels.json`, with its times, crops and words.
- Each gets one **preview**: upright, 540x960, x264 `-preset veryfast -crf 30`. It is made from its own stretch only, by seeking in the input (`-ss` and `-t` for each range), or all previews in one pass. Today's clip code decodes the whole recording for every clip, which on an hour of 1080p costs far more than the encode.
- No full-size clip, no Story parts, and no caption file for a Reel.
- The rough cut and the upright rough cut are made as today. The upright rough cut is a working copy (Jason's answer 4).

Phase 3 measures the previews on a Zoom recording and on an hour of 1080p.

**When she picks a Reel**, brimm-video writes an upright Final Cut project for it: its kept ranges, each clip filled into the frame and moved onto the face. Phase 0 (B2) found a way Final Cut 12.4 takes it. The 1080x1920 format is written as Final Cut writes its own: no name, `frameDuration`, `width`, `height` and `colorSpace="1-1-1 (Rec. 709)"`. Each clip names its own wide format. Then `adjust-conform type="fill"` fills the frame, and `adjust-transform position` moves the picture in percent of the frame's height, on both axes, positive X to the right and negative Y down: "20 0" moved it 384 px right in the upright frame, and on a wide frame Final Cut shows "40 -20" as X 432 px, Y −216 px, 40% and 20% of 1080 (B1). (A first try, whose upright format had no colour space and whose clips named no format, warned about the format and did not fill; B2b changed both and imported with no warning, so which one mattered is not shown.) It gains captions and its title in phase 4, and the look and the logo in phase 6. Final Cut renders the finished Reel when she Shares it. Story parts are cut from the finished Reel (section 5).

**No `reel add`.** Short pieces that BRIMM Ops recommends from the finished episode are edited by hand, as Jason decided. Their times are on the finished video's clock, not the raw video's.

**When Claude could not be asked at the import**, there are no candidates and no recommended title. `ask` asks Claude again from the saved cut plan, with the same locked-down call. The call names its model, so the two Macs pick Reels with the same one. Phase 1a records which model that is. The installer's `--print` says whether `claude` is signed in, and setup ends with one real `claude -p` call from the launch agent's context (Jason's yes).

## 4. The editing session

### Where, and what Claude may do

- **Sallie's sessions run in a small folder of her own**, `~/BRIMM Video Studio`, made by the installer (Jason's yes). It holds a `CLAUDE.md` for her, the `brimm-edit` skill, and `.claude/settings.json`.
- The skill runs the tool by its whole path in the main checkout: `node "<checkout>/tool/edit.js" …`. The path is read from this Mac's `settings.json`. So her sessions never open the code, run the same code as the launch agent, and are never put into a worktree of the repo.
- **The settings deny, rather than ask about,** everything but `node <checkout>/tool/edit.js` and reading files inside the studio folder. In the Code tab Claude has real tools while it reads untrusted words, a guest's included. Sallie cannot judge approval prompts, so there are none to judge. In Claude Code an allow rule cannot carve an exception out of a deny rule, so this is done with the mode that denies whatever is not allowed (`defaultMode: "dontAsk"`), one allow rule naming the checkout's path exactly (it has spaces), the settings that stop a session switching mode (`disableBypassPermissionsMode` and `disableAutoMode` set to `"disable"`), and the one that stops read-only commands reading outside the folder (`blockReadsOutsideWorkingDirectories`). Phase 1b checks each name against Claude Code's documentation, and tests that her session can neither read a file in Dropbox nor switch mode. The check for a newer brimm-video is made by `edit.js`, not by `git` in the session.
- **Pictures for graphics** go in `~/BRIMM Video Studio/Pictures/`, which the installer makes. `edit.js` takes only the name of a picture file in that folder, never a path, so words in a transcript cannot make it copy another file into Dropbox.
- Claude reads an episode's files only through `edit.js` (`show <episode> transcript|notes|plan|reels`), which finds them from this Mac's settings. So no Mac's Dropbox path is written in any settings file.
- Jason works on the code in the repo, as now.
- The skill keeps command names out of Sallie's view. The README gets a one-page card for her: the things to say, and the three things done by hand in Final Cut (Share, then File > Export XML… of the same project, and checking by eye).

### Long commands run detached

The Code tab's command tool stops a command after 2 minutes by default, and after 10 at most. An import of a 30-minute recording takes 8 to 9 minutes on the Mac Studio, and longer on her M4. So every command that can take more than a minute or two starts its work detached and returns at once with "Started. The panel shows how far it is.": `finish`'s long part, `ask`, `retry`, `open` while files are coming down, and making videos again from a plan (`edit.js` wraps `unedited.js --from-plan`). Each detached run holds a lock for its episode, runs under `caffeinate -i -w` as the import does, and writes a result file for its episode on this Mac's disk, `~/BRIMM Video Work/<episode folder>/<command>.result.json`: what it made, what failed, and what it asks next. `status` reads the progress file (phase P) while the run lasts, and the result file after it. A second `finish` while one is running says so and starts nothing.

### Times a person gives

When Sallie says "put my name up at 0:03" or "keep the Hormozi story at 12:30", she means the clock of what she is watching: a pushed version of the main timeline, or a Reel. A time she gives is read on the timeline she names, the newest pushed version by default. It is mapped back through that timeline's clips to seconds of the raw video. A time inside a cut is refused, and the command says where the nearest kept words are. Words she quotes are found in that timeline's kept words.

### What applies where

- `spell` applies to every timeline and to the final transcripts.
- `cut`, `text`, `graphic`, `title` and `preset` apply to the one timeline named: the main video, or a Reel. A cut on the main video does not reach a Reel over the same words, and the command says so.

### What a person can say, and what happens

| They say | Command | What happens |
|---|---|---|
| "What's waiting?" | `episodes` | As in section 1 |
| "Open the Pricing episode" | `open` | Claims it, checks its files are here, asks for the name if it is still a placeholder, and shows the recommended title, Claude's notes and ideas for graphics, and the Reel candidates with their previews |
| "Call it Pricing with confidence" | `name` | Records the name. Nothing is renamed |
| "Use that title" | `title [--words] --approve` | Records it and locks it. A later change needs `--change`, and the command says BRIMM Ops may already have it |
| "Make it Bright" | `preset` | Records the job, caption style and look |
| "Keep the Hormozi story at 12:30" | `cut keep\|remove` | Changes the ranges at heard pauses. Refused on a hand-edited timeline |
| "Put my name up at the start" | `text add lower-third` | A title on the lower-third template |
| "Show the pricing chart when I say three numbers" | `graphic add <picture> --at-words "three numbers" [--for 6] [--place full\|corner\|lower]` | Takes the picture by its name in `~/BRIMM Video Studio/Pictures/`, and copies it into `media/` by the rule. It is placed as a connected still on the `BRIMM titles` role, for the words' length or the seconds given. `full` fills the frame, `corner` is a quarter-size picture in the brand kit's corner, `lower` is the lower third. Claude's graphic ideas are offered as places to use it |
| "Logo on" | `logo on\|off` | The brand kit's logo |
| "Captions on Reel 2" | `captions reel 2 on` | Captions on the caption template |
| "It's Sallie, not Sally" | `spell add Sally Sallie` | Every timeline and the final transcripts |
| "Show me the Reels" / "Finish 1 and 3" / "Drop 4" | `reels`, `reel pick\|drop` | Picks write each Reel's project |
| "Ask Claude again for Reels" | `ask` | Detached (above) |
| "Show it in Final Cut" | `push main\|reel <n>` | Checks the files, writes the version and the local copy, and opens it. The guard below applies |
| "I changed it by hand and exported it" | `pull` | Takes the newest export of that timeline from `~/BRIMM Video Work/From Final Cut/`, by its recorded project name, copies it into `edit/from-final-cut/` by the rule, and makes it the base |
| "Hand it to Jason" | `release` | Lets the claim go, after asking whether there are hand edits not yet exported |
| "Sort out the conflict" | `resolve` | Section 1 |
| "Finish the episode" | `finish` | Finds the files and asks, then works detached. Section 5 |
| "How far is it?" | `status` | Reads the progress file |
| "Try it again" | `retry` | Imports again a video that stopped |
| "Put it away" | `archive` | Marks it archived. Section 1 |
| (Jason, after an update) | `check` | Runs a made-up recording through import, push (to a scratch library) and finish, and reports |

### Hand edits: layering on exports (Jason's answer 2), with the push guard

Each timeline is either **brimm-video's own** (`base` is null) or **hand-edited** (`base` names a pulled export).

- **The guard.** Before any push of a timeline that has been pushed before, and before any command that reads a time or quoted words on such a timeline, the skill asks: "Did you change v3 in Final Cut since it was shown?" It asks every time. An export pulled earlier does not answer it, because she may have trimmed again since. The command refuses unless it is answered: by `--no-hand-edits`, or, from phase 5, by a pull of an export saved after her last change, made as part of the same command. Without the guard, a push silently leaves her trims behind in v3.
- **Before `pull` exists (phases 1a to 4), a "yes, I changed it" stops the command.** Her changes stay in v3 in Final Cut, and brimm-video cannot build on them yet. The skill says so, and says how to work until phase 5: ask brimm-video for its changes first and make hand trims last, or finish that timeline by hand in v3.
- **Answers carried between Macs.** `release` records the answer for each timeline pushed on that Mac. On the other Mac the guard takes that answer for the pushes made on the first Mac, and asks only about pushes made on its own.
- **On a hand-edited timeline,** cut changes are refused: "Make that cut by hand in Final Cut, or start again from version 3 without the hand edits (`reset main`, which pushes it under the next version's name, since a project name is never used twice: section 2)." Layer changes are made on the export. brimm-video removes and adds only what it owns: titles, captions and graphics on its own roles, with the record's id in their names, and the look's effect. Everything else passes through unchanged. A text or graphic whose record has not changed since the export is left exactly as the export has it, so a title moved by hand stays where it was put. Captions are made again from the words, through the export's clips, so a caption corrected by hand is lost (the cost Jason accepted). The skill says to correct words with `spell`.
- **Carrying an edit to the other Mac.** Before `release`: File > Export XML… into `~/BRIMM Video Work/From Final Cut/`, then `pull`. The other Mac's `open` sees the pulled export, localises it (section 2), and pushes it into that Mac's library.
- Placing by the raw video's clock, passing everything else through byte for byte, and reading both plain `.fcpxml` files and `.fcpxmld` bundles are as the first version of this design said. Phase 5 builds them.

### What brimm-video writes for Final Cut

- **Templates.** A Motion title has one layout, so each kind of title (caption, hook, lower third, line of words) is made twice: once for a wide frame and once for an upright one. That is eight templates for the first four. The other way is one template per kind that publishes a place-and-size control, which brimm-video sets for each frame. Phase 0 found that a built-in title given words only does not keep the template's look: Final Cut gives it Helvetica at size 6 (B1). So every title brimm-video writes names its font and size, until phase 6 shows whether a BRIMM template given words only keeps its own. Which of the two ways suits the wide and upright frames is phase 6's test.
- **Who makes the templates, and how long it takes.** Still open: Jason, or the editor Sallie hires, at an estimate of 4 to 8 hours of Motion work for the first eight. Motion is needed only on the Mac Studio. Her laptop needs none.
- **Until the templates exist**, the same commands use Final Cut's built-in titles. Words go in the stand-in typeface until Sweet Sans Pro is bought: Varela, then Lucida Grande. These videos may be posted (Jason's answer 6).
- **Typefaces** are installed with Font Book on both Macs, for each person, after Jason's yes. They are bought per person (MyFonts' licence cannot be shared, and Sinthya's is per seat). Font files never go into the repo, Dropbox or `media/`. A push checks that each template's fonts are installed. Final Cut replaces a missing font without a word.
- **Templates on the Mac Studio** sit under `~/Movies`, which is a link into Dropbox. So there the template folder is set to Available offline, the templates are copied in by the rule, and the check before a push confirms each template file is really on disk, not only listed. Phase 0 found that Final Cut finds a template through that link and writes its uid with no Mac's path in it (A7), and finds it again by that uid alone (B6). Part C checks that her laptop writes the same uid.
- **Roles.** brimm-video's own titles, captions and graphics carry roles of its own, so phase 5 can tell them from hand work. A custom role holds: Final Cut keeps `role="BRIMM titles"` as the role "BRIMM titles" with a subrole "BRIMM titles-1", and shows it in a colour of its own (phase 0, B1). An export carries it as `role="BRIMM titles.BRIMM titles-1"`, so phase 5 reads a role up to its first dot.
- **Captions** are titles in the FCPXML, one for each caption, on the caption template. Final Cut renders them, and they stay editable there. **Looks** name a built-in Color Grading Preset with its Mix. **The logo** and **graphics** are connected stills from `media/`; a still's transform is kept as written (phase 0, B1).
- **Final Cut is reached** by `open -a "Final Cut Pro" <the local copy>`. The unattended import never opens Final Cut.
- **Build on `fcpxml.js`.** Do not adopt the FCPXML MCP server, for the reasons the first version gave. Borrow its findings, its `.fcpxmld` reading, its guard against writing over a file that changed since it was read, and DTD checks against the DTDs in the app bundle.

### What stays by hand

- **Share, through one saved destination.** "BRIMM final" is set up once on each Mac: an Export File destination with Format Video and Audio, Video Codec H.264 and Resolution Same as Source, so that each project keeps its own size (1080 lines for the main video, 1080x1920 for a Reel), and Action Save Only. It is made the default, so that Command-E means this Share. A destination keeps no folder (phase 0, A6): after Next, Final Cut asks where to save. Its first dialog opened on the folder File > Export XML… had just saved into, so the card asks her to check that it says From Final Cut. A Share keeping an upright project's 1080x1920 was not tried. finish and the transcriber pick a Share's streams by type, never by number. A Share is a `.mov`, written under its final name and growing until it is done (A6), so `finish` never takes a file's name as a sign that it is whole.
- **File > Export XML…**: click in the timeline first, so that the project is exported and not a clip in the browser, then save into `~/BRIMM Video Work/From Final Cut/`, keeping the version it offers (1.14). The export is a `.fcpxmld` bundle with `Info.fcpxml` inside (A5). There is no default key. Setup may give it one in Final Cut's Command Editor on both Macs, and the skill then names that key.
- Bringing in b-roll or music by hand: Final Cut's Import Media window did not show the Dropbox folders on the Mac Studio (phase 0, B7), so the card says to drag files in from Finder.
- Checking every cut, caption, crop and graphic by eye. Fine trims, b-roll, music, a guest's name, thumbnails, posting. The tool never posts.

## 5. The finish: from the final edit to the hand-off file

`finish` has two parts. The first runs in the foreground and is quick (steps 1 and 2): it finds the files, says what each is taken for, checks the exports, and asks. When she says yes, the second part runs detached (steps 3 to 9). It holds a lock for the episode, runs under `caffeinate`, and writes its result file (section 4), which `status` reports, with the offers of step 9. `finish` works on an episode that was finished before as well: a second `finish` transcribes only the videos that changed (by size and time), keeps every part of the last revision that it does not replace, and writes the hand-off again with the next `revision`.

1. **Finds the finished files** in `~/BRIMM Video Work/From Final Cut/`: videos (`.mov`, `.mp4`, `.m4v`) whose name, up to the extension, is a project name recorded at a push of this episode. A part with nothing newer there is taken from `edit/from-final-cut/` (what `release` copied in on the other Mac), or kept from `final/`. It lists what it found and what each is taken for. When more than one file fits a part, or a part has none, it asks.
2. **Checks the exports.** For each part whose newest export is older than its Shared video, it asks for one File > Export XML… of that project. For a part never exported, "no hand edits since it was shown" is an answer. This export is what keeps the final edit: a library holds the hand work, and it stays on one Mac; its backups stay where Final Cut puts them by default (section 2), so they are no copy of the edit for the other Mac. The skill tells her the order once: in Final Cut, for each part, Share it and wait for Final Cut's notice that the Share is done, then click in that project's timeline and File > Export XML… it, and only then say "finish". Done in that order, each export is newer than its Shared video, and the check passes without asking again.
3. **Waits until each file is whole** (detached from here on): its size has settled and ffprobe reads it to the end. Share runs in the background.
4. **Checks each one**:
   - its shape against its part: a Reel is upright, and the main video has the raw video's shape (so a short upright video's main video is upright)
   - its first words against that part's expected words
   - its length, as information only (hand trims change it)
5. **Transcribes each one again** (Jason's answer 1). The transcript tool's own pass (`whisperArgs`) writes the `.srt` that goes into the hand-off, with its silence filter and the show's and the episode's spellings. The word pass writes `.words.json`. When the word pass dies, as it does on some recordings, the plain pass alone is used, and the output says that word times are missing.
6. **Cuts Story parts** from a finished Reel whose job goes to Stories. Each part ends on the last pause before 60 seconds, or at the widest gap between words when no pause is heard there (music under the voice).
7. **Copies everything into `final/`** by the rule: the finished videos, the transcripts, the Story parts, the exports (as records: making one the base is `pull`'s work) and the hand-off file. After the late check it deletes from `From Final Cut/` the files it copied in, so that folder does not fill up.
8. Records `finished` with the hand-off's revision and, for each part, the export that keeps its edit or that there were no hand edits. Lets the claim go. Shows the hand-off file in Finder (`open -R`), for her to drop on the BRIMM Ops page.
9. **Offers**, in its result, which the next `status` or `finish` gives her: to set the episode online-only on this Mac, and to free space. Render files are freed through Final Cut's own menu, File > Delete Generated Library Files. The whole library is deleted only when every part's export is newer than its Shared video (or the part had no hand edits), every media path in those exports is inside the episode folder, and Final Cut is not running. Deleting a library leaves its backups in `~/Movies/Final Cut Backups.localized` (in Dropbox on the Mac Studio), so the offer names them too.

### The hand-off file, version 1

`final/<Episode file-safe name>.brimm-ops.json`, read by the BRIMM Ops page in one drop.

```json
{
  "format": "brimm-video hand-off",
  "version": 1,
  "revision": 1,
  "made": "2026-10-20T15:02:11-05:00",
  "madeOn": "Sallie's laptop",
  "madeBy": "brimm-video c709b57",
  "episode": {
    "id": "e-20261014-3fa9c1",
    "kind": "episode",
    "name": "Pricing: what to charge?",
    "recorded": "2026-10-14",
    "recordedFrom": "video",
    "title": "Price like you mean it"
  },
  "main": { "file": "Pricing- what to charge- main v5 3fa9c1.mov", "seconds": 1834.27, "srt": "1\n00:00:00,000 --> 00:00:03,120\nToday we're talking about pricing.\n\n…" },
  "reels": [
    { "n": 2, "title": "Stop discounting your best work", "file": "Pricing- what to charge- reel 2 v1 3fa9c1.mov", "seconds": 42.1, "inMain": { "start": 312.4, "end": 354.5 }, "srt": "…" }
  ]
}
```

- `episode.id` never changes. The page matches a drop by it, and asks before replacing an earlier revision. `revision` goes up with each `finish`.
- `kind` is `"episode"` or `"short video"`. A short video has a main part and no Reels, and the page can use its Short video format for it.
- `srt` is the transcript tool's own caption file, as text, in the form the page reads today with its own `tidyTranscript`. The times match the posted video.
- `inMain`, where a Reel's words fall in the finished main video, is given when at least 90% of the Reel's words, normalised (case, punctuation, numbers), are found there in order, inside one stretch of the main no longer than one and a half times the Reel. Its start and end are those of the tightest such stretch, kept within the main's length. It is left out otherwise.
- `reels` holds only finished Reels, each keeping its `n`.
- **The contract** is as the first version said: `tool/tests/fixtures/handoff-v1.json`, its tests here, and a copy in brimm-operations for L7.
- **Open in L7:** the page's three on-screen hook options overlap with brimm-video's on-screen title. Until the page's reader is built, `.rough-cut.srt` and the final `.srt` stay usable in the page as today. Also open there: what a new revision does to drafts she has already edited from the last one. It should replace the transcripts, never her edited drafts, and say which drafts came from words that changed.

### The three transcript gaps

These were passed on at Jason's request.

- **Story parts** carry the captions Final Cut drew into the Reel's picture, and need no caption file.
- **Word times on an edit's clock** come from `words.json` mapped through the timeline's clips while editing, and from the new transcription after `finish`.
- **A trim in Final Cut** cannot make the final transcript stale, because every finished video is transcribed again.

## Progress while a video is processed (phase P, built)

Built and reviewed in pull request jogden12/brimm-video#5.
- Each run writes a small progress file on the Mac's own disk.
- A floating window, drawn by `tool/progress.swift`, shows the step, a percent for each encode, and the time left. Once one video has been done on that Mac, it also shows the time left in all.
- The work never waits on the window.
- After phase T the transcript tool's video runs write the same progress file.
- Whether the import's status file (section 1) also shows the other Mac the progress is a proposal for Jason.
- The panel holds about 264 MB while open, because `swift` interprets it. A one-time `swiftc` build would cut that, with Jason's yes.

## 6. Setup on both Macs

Every install or change of setting is made only after `--print` and Jason's yes in chat. Proposal: Jason does it with Sallie, in person or by screen sharing.

| # | What | Sallie's laptop | Mac Studio |
|---|---|---|---|
| 1 | macOS new enough for Final Cut Pro 12.4 (Apple's page says 15.6 or later; not confirmed for 12.4) | Check | Has it |
| 2 | Final Cut Pro; App Store automatic updates off (macOS has one switch for every App Store app, so she updates other apps from the App Store's Updates list and leaves Final Cut to Jason); background rendering off; Settings > Import > Files set to "Leave files in place" (phase 0, A1). Library backups stay on Final Cut's default (section 2). On her laptop, items 1 and 2 come before phase 0's part C | Install, then set | Set |
| 3 | Dropbox: `The BRIMM DB` shared; this Mac's drop folder Available offline; disk space sized from phase 1a's measurement | Set | Set |
| 4 | Xcode command line tools (git, swift) | Install | Has them |
| 5 | Homebrew; Node 22 or later, ffmpeg, whisper-cpp; the transcriber's model (about 1.6 GB) | Install, by the installer. Homebrew asks for her password, which she types | Has them |
| 6 | Claude: the desktop app signed in; the `claude` command signed in, checked by one real call from the launch agent's context; a plan that includes Claude Code | Install and check | Check |
| 7 | brimm-video: `git clone` with a read-only deploy key made for this laptop, kept on `main`. **The key is the project's one secret** (Jason's answer 3). It lives only in her `~/.ssh`, never in the repo or Dropbox. It can read this repo and never push. Jason revokes it in the repo's GitHub settings if the laptop is lost or the key is no longer needed | Clone | Has it |
| 8 | Typefaces, installed with Font Book for the person, bought per person; stand-ins until then, with Varela installed on both Macs | Install | Install |
| 9 | BRIMM templates, copied in by the installer. On the Mac Studio, `~/Movies` is in Dropbox, so the template folder is set Available offline and the templates are copied by the rule | Copy | Copy, by the rule |
| 10 | The "BRIMM final" Share destination (Export File; Video and Audio, H.264, Resolution Same as Source, Action Save Only) as the default; the folder `~/BRIMM Video Work/From Final Cut/`; optionally a key for File > Export XML… | Set | Made in phase 0 (A6): rename it "BRIMM final" if not done, and check that it is the default |
| 11 | The launch agent: `./install.sh --machine "<this Mac>" "<path to BRIMM Video>"`, which also writes this Mac's `settings.json` and makes `~/BRIMM Video Studio` | Install | Install again |
| 12 | macOS permissions: node to read the Dropbox folder, and Final Cut for the first push | When asked | When asked |
| 13 | Staying awake. On her laptop the import keeps it awake while it works (`caffeinate`), with the lid open. The Mac Studio must stay logged in and awake: after an overnight macOS update it waits at the login and imports nothing | Lid open while importing | Stay logged in |

**Keeping the two Macs the same.**
- Jason pulls updates on both Macs, by screen sharing, only when no import is running.
- The skill checks, at the start of a session, whether this Mac is behind, and says so in plain words.
- `check` runs after any update of brimm-video, macOS, Final Cut or Dropbox.
- Final Cut is updated on both Macs together.

## 7. Phases, smallest useful first

Every phase writes a failing test first. No test calls the real `claude`, ffmpeg, `open` or Final Cut, and the installer is only ever run with `--print` in a test. Nothing writes into a watched folder.

| Phase | What it builds | Tested by |
|---|---|---|
| **P. Progress panel** | Built: PR #5, merged 2026-10-14 and live | 570 tests at 3030b37; by hand on the Mac Studio; the launch agent's panel checked at the next real drop |
| **W. The write fix for today's tool** | Built: PR #4, merged 2026-10-14. Each file written in the run's own folder and moved into place whole | Its tests, and the next real drop on the Mac Studio |
| **0. Final Cut facts** (by hand, about four hours on the Mac Studio, then again on her laptop once setup items 1 and 2 are done there) | Nothing in code. See the table and the findings below. Done on the Mac Studio on 2026-10-14; part C waits for her laptop | The exports, of made-up clips only, committed as fixtures (`docs/phase-0/exports/`), and the facts written into this spec, with the results in `docs/phase-0/results/` |
| **1a. Episodes, on the Mac Studio alone** | `BRIMM Video/` beside `BRIMM VIDEO Transfer`; the rule with clone copies, the late check and the list; the arrival check; the import's order and status file; the record (id, rev as a new file per change, files, writer); `install.sh --machine`; relative paths in stored timelines; the local push copy (this Mac's paths, `copy assets` 0, `suppress warnings`, one event for the episode) and the recorded project names, each at a version above any in this Mac's `pushed/` (phase 0, A4c); each asset's colour space and start timecode from ffprobe, and its AAC track (B3); `episodes`, `open`, `push` (the guard's question at every repeat push; a yes stops it), `status`, `retry`; `caffeinate`; the model named in the Claude call | Unit tests for each. By hand: a file of over 1 GB copied in with `cp -c` while Dropbox is still uploading it, and a file replaced as the code replaces one, checked an hour later; one real recording dropped, opened and pushed, with Final Cut closed, and pushed again into its library once closed; one episode's folder, library and peak temp space measured |
| **2. Finish and hand-off, on the Mac Studio** | `finish` in two parts (the foreground part that finds the files by their recorded project names and asks; the detached part with its result file), the From Final Cut folder, the BRIMM Share destination, the checks, transcribing again, Story parts, the exports copied in as records only (making one the base is `pull`, phase 5), copying in; the hand-off version 1 with its contract; the import's Claude call asking for the title; `title` (approved) and `reel pick` as records; `push reel <n>` of the clip the import cut, as an upright project, until phase 3's Reel project, so that a Reel can be finished and the hand-off holds it | A stand-in transcriber; the fixture; the page's `tidyTranscript` on every `srt`. By hand: one real episode, Shared from Final Cut and finished, with its main `.srt` given to the page |
| **1b. Sallie's laptop** | Setup (section 6); `~/BRIMM Video Studio`, its denying settings and its `Pictures/`; the claim, `release` (with the answers and the copies), take-over, `rev`, `resolve`; the deploy key, and the line in CLAUDE.md that names it | Unit tests. By hand: one recording dropped on her laptop and finished there; one sent to the Mac Studio and picked up on her laptop; a conflict made on purpose to learn Dropbox's naming |
| **3. Lightweight Reels** | Previews made by seeking; `reels.json`; `reels`, `reel pick`, `reel drop`; the upright Reel project (clips, crop, markers); `ask` | Preview arguments; the project's shape against phase 0's B2 findings. Measured: previews on a Zoom recording and on an hour of 1080p |
| **4. The session's commands** | `name`, `title`, `preset` with the caption builder, `cut`, `text`, `graphic`, `logo`, `captions` (built-in templates first), `spell`, `show`; times read on a named timeline; the skill in full; the card for Sallie | Each command on fixtures, with every refusal. By hand: one session run by Sallie, on a real episode, on her laptop |
| **5. Layering on exports** | `pull`, `reset`, localising exports (bookmarks, library, uids, a template's path), the reader and writer that pass everything else through, ownership by role and id, carrying an edit between Macs, the version check | Phase 0's real exports layered with no change come out the same; a hand-edited timeline carried from one Mac to the other |
| **6. Brand** | The templates, wide and upright; the typefaces on both Macs; `brand/brand.json`; presets, looks and the logo | The research's rules as tests; the template and font checks; one Reel per preset checked by eye |
| **7. Claude chat** (later, maybe) | A local MCP server offering the same commands | Not designed now |
| **T. The transcript tool moves in** | `transcribe.js` beside `unedited.js`, sharing one `lib.js` and `run.js`, under the Dropbox rule and writing the progress file. The steps, in order: tests pass here; `--print` for both agents; Jason's yes; the agent pointed here; one real Zoom file and one YouTube file through the moved tool; then a week of real use, with that repo's installer as the way back; only then is `transcribe/` removed in brimm-operations. The log stays `~/Library/Logs/brimm-transcribe.log`. Both installers keep the check that refuses a folder the other tool watches | Its tests moved and passing; the `.srt` contract fixture in both repos; a test that it ignores `BRIMM Video/` |

### What phase 0 settles, and what it does not

| Unknown | Settled by |
|---|---|
| A relative `src`, and `base url` | Mac Studio (A1, A2): both worked. Her laptop: part C, for a relative `src` |
| `copy assets` 0 when the Import preference says to copy | Mac Studio (A3): honoured. Her laptop: part C |
| "Replace or keep both" on a second push, and `suppress warnings` | Mac Studio (A4, A4c): a new project name asks nothing; a name already taken asks, even with `suppress warnings`. Her laptop: part C |
| A custom template's uid through the linked `~/Movies`, and on her laptop | Mac Studio (A7, B6): found, and found again by its uid alone. Her laptop: part C |
| A template in a wide and an upright project; a title with words only | Mac Studio (B1, B2): a built-in title shows in an upright project; words only get Helvetica 6. A custom template upright: phase 6 |
| An upright project of a wide clip filled and moved; a custom role on a title; a still with a transform | Mac Studio (B1, B2): all work as section 3 and section 4 say |
| File > Export XML…: its default name, and which version to choose (Apple's guide settles the rest: click in the timeline first; a `.fcpxmld` bundle at 1.10 or later) | Mac Studio (A5): the project's name; 1.14 offered first. Her laptop: part C |
| Share: its default name and file type; whether it writes under a temporary name; which folder its save dialog and Export XML…'s open on after the other was used | Mac Studio (A6): the project's name, `.mov`, written under its final name; its dialog opened on Export XML…'s last folder. Her laptop: part C |
| An iPhone clip's start timecode | Mac Studio (B3): none on the iPhone clip tried (start 0); it was HDR (Rec. 2020 HLG). A start given in the FCPXML that matches the video's own was shown |
| Whether a library made by an import can be given its backup folder other than by hand | Mac Studio (B4): kept in the library's `Settings.plist`; only by hand so far. A library made by hand took the folder set on another |
| A clip linked from inside the Dropbox folder, opened on both Macs | Mac Studio (B7): a push links it there, and it played then and an hour later. Her laptop: part C |
| A push with Final Cut closed, and into an existing library that is closed | Phase 1a by hand (A3 and A4 were with Final Cut open) |
| A localised export that names its library in `import-options` | Mac Studio (B6b): makes its library with no question and links the video; its title's words did not show (open, with A7's) |
| A title that moved with no hand edit (A7) | Phase 6 |
| Whether a clone copy into Dropbox is safe, and a file replaced the way the code does it | Phase 1a by hand. If not, the design comes back to Jason |
| The panel from the launch agent | At the next real drop on the Mac Studio (PR #5 is merged and live) |
| The M4's speed; the previews' saving; the disk space an episode needs | Phases 1a, 1b and 3, measured |
| The transcriber's own progress | Not planned |
| The macOS floor for Final Cut 12.4 | Checked at setup |

### What phase 0 found (Mac Studio, Final Cut Pro 12.4, macOS 27.0.1, 2026-10-14)

Run by Jason from `docs/phase-0/checklist.md`, on made-up clips and one iPhone clip of his. The checklist was corrected after the run with what it taught. The results, with screenshots, are in `docs/phase-0/results/`, and Final Cut's own exports in `docs/phase-0/exports/`, beside B6's stripped copy and B7's push file.

- **A1.** A relative `src` is read from the FCPXML file's own folder: a copy of the episode folder under another parent folder brought in that folder's video (a different clip put there to tell them apart), handed over by `open -a`, and again with the original clip in place, into a fresh library. Two earlier tries through File > Import > XML… brought in the original or found it missing; that dialog had most likely picked the original folder's file of the same name. A file that names no library makes `open -a` ask which library to use, and File > Import > XML… use the selected one. An import with no `copy assets` mostly followed Final Cut's Import setting, "Copy to library storage location", and copied the video into the library; one later import of the same video into a library swapped that copy for a link.
- **A2.** Apple's `base url` import option worked: a file in another folder found its video through it (the same video Final Cut had already brought in that hour, so a fallback is not ruled out).
- **A3.** A push file (`library location`, `copy assets` 0, `suppress warnings`) handed over by `open -a` made its library with no question, opened its project in the timeline, and linked the video where it was, with the Import setting at "Copy".
- **A4.** A second push into the same library and event, with a new project name, asked nothing, and the video stayed linked once.
- **A4c.** A push with a project name already taken in the library asked whether to replace or keep both, even with `suppress warnings`. It is the question A1's third try had asked without it: 'Application "(null)" sent an XML document that is about to replace existing items with matching names in the library "Phase 0 moved 2". Do you want to replace them?' Keep Both named the new project `<name> 1` and left the old one as it was. Replace was not tried.
- **A5.** File > Export XML… offered the project's name, opened first on the Desktop, and offered versions 1.14 (first), 1.13 and 1.12. The export is a `.fcpxmld` bundle with `Info.fcpxml` inside. It carries the video's whole path and a bookmark, `<library location=…>`, uids on the asset (equal to its media-rep's `sig`), on the event and on the project, the project's `modDate`, and `adjust-colorConform` on each clip.
- **A6.** A destination keeps no folder. A Share offered the project's name, wrote a `.mov`, and wrote it under its final name from the start, growing for about two seconds on a 20-second clip. Its save dialog opened on the folder Export XML… had just used, and Export XML… then opened on that folder too.
- **A7.** A Motion title published into `~/Movies/Motion Templates.localized/` (in Dropbox on the Mac Studio) was found by Final Cut. Its export names it by `uid="~/Titles.localized/Phase 0 test/Phase 0 Title/Phase 0 Title.moti"` and `src="file:///Users/jasonogden/Library/Containers/com.apple.FinalCut/Data/Movies/Motion%20Templates.localized/…"`.
- **B1.** A built-in title given words only came back as Helvetica 6: the Basic Title was a speck, and the lower third tiny. A title given Helvetica 90 white showed as given. `role="BRIMM titles"` became the role "BRIMM titles" with a subrole "BRIMM titles-1". A still kept its transform: "40 -20" with scale 0.5 showed in the Inspector as Position X 432 px, Y −216 px, Scale 50%.
- **B2.** A 1080x1920 project whose format had no name and no colour space, with wide clips that named no format, warned "Encountered an unexpected value. (format="r3": /fcpxml[1]/event[1]/project[1]/sequence[1]/@format)"; its export gave the wide clips the upright format, and fill did not fill. B2b gave each clip its wide format and both formats a colour space and Final Cut's `frameDuration`, and imported with no warning (as Jason recalls): `fill` filled the frame, and `position="20 0"` moved the picture 384 px right, 20% of 1920. A project made by hand at 1080x1920 has a format with no name and `colorSpace="1-1-1 (Rec. 709)"`.
- **B3.** A clip whose video starts at a timecode of one hour, given the same start in the FCPXML (`start="3600s"`), showed 01:00:00:00 in the Inspector. An iPhone clip of Jason's (about 6 s, upright) carried no start timecode and was HDR: HEVC Main 10, Rec. 2020 HLG, Dolby Vision profile 8, `frameDuration="20/600s"`, with an AAC stereo track and an APAC track that ffmpeg cannot decode.
- **B4.** Libraries made in phase 0 were backed up into `~/Movies/Final Cut Backups.localized` (Dropbox) while open, about 15 to 25 minutes after a change. Setting the backup folder by hand wrote `backupLocation` (a bookmark) and `backupsEnabled` into the library's `Settings.plist`. In the two hours after, with a trim made in that library, Final Cut wrote no backup of it anywhere, while libraries on the default went on backing up into `~/Movies`. A library made by hand afterwards took that folder, without `backupsEnabled`.
- **B5.** A trim changed the project's own `CurrentVersion.fcpevent` in the library at once, but projects Jason only opened and looked at changed too. A file's time cannot tell a hand edit from a look, so the push guard keeps asking.
- **B6.** A copy of the A7 export with its bookmark, its uids and its template's `src` taken off, and a new project name, imported cleanly into a second library, and the custom title showed: Final Cut found the template by its uid alone. The export's own `<library location>` did not choose the library: Final Cut asked. **B6b**: the same copy put in push form (its `<library>` element taken out, and `import-options` naming a new library, `copy assets` 0 and `suppress warnings`) made that library with no question and linked the video where it was. Its title clip is in the timeline, but Jason did not see its words, though both libraries map the template to the same file; this joins the open point below.
- **B7.** A push file whose video was cloned into a test folder in The BRIMM DB, inside Dropbox, made its library with no question and played; the library holds a link to the clip where it sits in Dropbox. It still played an hour later.
- **Open.** In A7's project Jason later saw the title half out of the frame, though he had dropped it elsewhere; the export holds no place for it; and in B6b its words did not show. Not explained. The template is a throwaway; phase 6 checks titles with the real templates. Phase 6 checks that a title stays where it was put after a push, an export and an import. Still to do: part C on her laptop.

## Errors, in plain words

- An import that cannot finish says so in the cut plan's first lines and in the status file, and `episodes` shows it as stopped. `retry` runs it again.
- A command refuses rather than guessing. It refuses for:
  - a claim held elsewhere
  - a changed `rev`
  - a conflicted copy
  - a file not yet whole
  - a cut on a hand-edited timeline
  - a time inside a cut
  - a push without the guard's answer
  - a missing template or font
  - media outside the episode folder
  - an export at an unknown version
  - a record of a newer layout
  - a record older than the one this Mac last wrote (Dropbox undid a change)
- `finish` asks before it acts when files are missing, or when more than one fits a part. A length that differs is information.

## Not designed here

- Which typefaces to buy, and where. Whether the logo's `.png` files may be copied beside the tool.
- Who makes the BRIMM Motion templates.
- An outside editor working on a third Mac.
- The page's side of the hand-off (brimm-operations L7), and the overlap of its hook options with the on-screen title.
- Opening and closing cards and the steps card: templates in phase 6, placed with the `graphic` mechanism.

## What the review changed

The review is `/tmp/brimm-video-design-review-2026-10-14.md`, made in Jason's brimm-operations session: 3 blockers, 49 important and 31 minor findings, plus 5 raised by its checker.

| Review point | Where it is answered now |
|---|---|
| Blocker 1: "Cmd-E" is Share, not Export XML | File > Export XML… everywhere (4, "What stays by hand"); the BRIMM Share destination makes Command-E the BRIMM Share |
| Blocker 2: the rule missed moves, renames and other programs, and a check right after a move cannot see a late revert | 1, "Writing into Dropbox: the rule": clone copies, a late check, the list, the raw video copied not moved, no renames, Share and exports to local folders; phase W |
| Blocker 3: a push silently drops hand trims | 4, the push guard |
| The new folders inside the transcript tool's watched folder | `BRIMM Video/` beside `BRIMM VIDEO Transfer` (1) |
| Placeholders passing the arrival check | 1, "When a file has arrived" |
| Bookmarks, library path and uids in exports; relative paths in the pushed copy; `copy assets`; replace or keep both | 2 |
| Phase 0 too sure and too short; its checks on one Mac only | 7, phase 0's table, 1 to 2 hours, repeated on her laptop |
| Renaming the episode folder | Removed (1, "The episode's name") |
| Claims, stale copies, two Macs picking the same folder, conflicts she cannot judge | `rev`, re-reading the claim, the Mac's name in folders and pushed files, `resolve` (1) |
| Claude Code's 10-minute limit | Detached long commands and `status` (4) |
| Sallie's session editing the repo; Claude's tools while it reads untrusted words; paths in settings | `~/BRIMM Video Studio`, settings that deny, reading through `edit.js` (4) |
| Version skew between the Macs | `writer.commit`, refusing newer records, `check`, updating together (1, 6) |
| Storage on her laptop; archiving; render files | 1, "Storage"; `archive`; setup items 2 and 3 |
| A laptop that sleeps; a Mac Studio at the login screen | `caffeinate`; setup item 13; `episodes` lists waiting videos |
| Libraries deleted with the hand work in them | `finish` asks for exports first (5) |
| The hand-off: no id, no revision, no source for the date, no kind | Hand-off version 1 (5) |
| Graphics not designed | `graphic` (4), Jason's answer 5 |
| The upright rough cut never finished | A working copy, Jason's answer 4 |
| Phase 2's hand-off lacking titles and Reels | `title` and `reel pick` move into phase 2 (7) |
| `reel add` against "edited by hand" | Removed (3) |
| Short and upright recordings; the Short video format | `kind: "short video"` (1, 5) |
| Stand-ins and built-in titles decided for Jason | Asked: he allows posting them (answer 6) |
| Templates, fonts and backups under the Mac Studio's linked `~/Movies` | 2, 4 and setup item 9 |
| Previews decoding the whole recording | Seeking per stretch (3) |
| Phase 1 too big; finish before her laptop | Phases 1a, 2 and 1b (7); `adopt` removed |
| Phase T's order and the transcript tool under the rule | Phase T's row |
| Times a person gives on the wrong clock | 4, "Times a person gives" |
| A Reel not learning of changes to the main video | 4, "What applies where" |
| Finish fallbacks; Story parts with music; `inMain`; the length check | 5 |
| Attributions that could not be checked | "What this rests on": answers marked as picked in the session; proposals listed |

## What the second review changed

The second review is `/tmp/brimm-video-design-review-2-2026-10-14.md`, made in Jason's brimm-operations session. It found 48 new points and 37 earlier ones still open. Jason asked for five to be fixed in this revision, and the rest to be carried into the phase plans.

**The five Jason asked for:**

| Review point | Where it is answered now |
|---|---|
| 1. Node's clone flag makes a byte copy; copying over a file writes into it; no real wait before the late check | The rule, items 1 and 2: `/bin/cp -c`, no byte copy into Dropbox, an old file deleted before the new one is cloned in, the record and the status file a new file at each change, the late check at least 15 minutes after the last copy (1) |
| 2. A detached `finish` cannot ask anything | `finish` in two parts, with a lock, `caffeinate` and a result file that `status` reports (4, "Long commands run detached"; 5) |
| 3. The guard leaks trims after an earlier pull, and a "yes" has nowhere to go before `pull` exists | Asked at every repeat push and before any command that reads a time or quoted words; a yes stops the command until phase 5; answers carried by `release` (4, the guard) |
| 4. Finished files matched by the current name | Matched by the project names recorded at each push, which carry the episode's short id (2, "Project names"; rule 6; 5, step 1) |
| 5. A Share destination keeps no folder | One local folder, `~/BRIMM Video Work/From Final Cut/`, for Shares and Export XMLs, told apart by type (rule 6; 4, "What stays by hand"; setup item 10) |

**Also changed here, because the plans rest on them:** the status lines (PRs 4 and 5 merged and live), and that the live import still renames the raw video until phase 1a is installed (1, phase W); the Mac's name always in a new episode folder's name, and in the status file's name (1); the record's layout `version`, not the commit, decides a refusal (1); `open`, `retry` and `--from-plan` detached (1, 4); `archive` a mark in the record, nothing moved (1); Available offline marked in Finder at the first `open` (1, Storage); library backups set for each library (2); Sallie's Claude Code settings named (4); `~/BRIMM Video Studio/Pictures/` for graphics (4); `release` records the guard's answers and copies Shares and exports in (1); the shape check follows the part, so an upright short video passes (5); `finish` empties what it copied from `From Final Cut/`, shows the hand-off in Finder, and frees render files through Final Cut's menu (5); the App Store's one update switch, the Share destination's settings and Varela (6); the Export XML bundle fact, the folder each dialog opens on, and library backups in phase 0's table (7); phase 0's laptop half after setup items 1 and 2 there (7); phase 2 builds `push reel <n>` and copies exports in as records only (7); phase T's way back (7); what the status-file proposal is (opening); the L7 point on drafts and revisions (5). The superseded phase 1 plan is removed from this pull request; it stays in the branch's history.

**Carried into the phase plans and later phases:**

| Review point | Where it goes |
|---|---|
| Cards that carry words are title templates, not stills; `corner` before the brand kit exists; `full` for a wide picture in an upright Reel | Phase 4 (`graphic`), phase 6 (cards) |
| Motion saves templates into `~/Movies` itself, which is Dropbox on the Mac Studio; her laptop's `~/Movies` not checked | Phase 6 (templates made elsewhere, then copied in by the rule); phase 1b setup checks her `~/Movies` |
| A template's uid that differs between the Macs; templates not found through the link | Phase 0, Mac Studio: found through the link, with a uid that has no Mac's path in it (A7), and found again by that uid alone (B6). Part C compares her laptop's uid; phase 6 decides |
| What changes with each result of phase 0 | The checklist says, step by step; the results are in section 7 |
| A stripped export imported into a second library; bookmarks and uids read off a real export | Done in phase 0 on the Mac Studio (A5, B6; section 2, "Exports are localised"); phase 5 builds on it |
| `reels` opening the previews in QuickTime Player | Phase 3 |
| Her card written from the walk through her day, every manual step in order; the project to open after each push | Phase 1b (the skill), phase 4 (the card). Phase 0 (A3): a push opens its project in the timeline itself |
| `check`: which steps need a person; it writes only into a scratch folder | The phase that builds `check` |
| Claude's usage limits for one import and one session | Phase 1a measures one import, phase 1b one session |
| The FCPXML version checked on the Mac that imports an export, and named | Phase 5 |
| Times read through a newer export | Phase 5 |
| Adobe Fonts | Dropped, unless Jason says it is his account |
| The deploy key's line in CLAUDE.md | Phase 1b |
| How long Dropbox keeps earlier versions; a laptop disk failing between exports | Setup, for Jason to accept |
| An interrupted `open` download on a slow link | Phase 1a (`open` detached) and 1b |
