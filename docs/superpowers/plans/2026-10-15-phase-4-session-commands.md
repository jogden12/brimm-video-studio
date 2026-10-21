# Phase 4, the session's commands: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie says what she wants on a timeline and the next push shows it: the episode's spellings, the logo, a Reel's captions and its title on screen, a name over a role, a picture from her Pictures folder, a preset (job, caption style, look), and a stretch kept or taken out at a pause. A time or words she gives are read on the timeline she watched.

**Architecture:** Pure modules first, with no disk and no program: `styles.js` (the preset's three lists, the stand-in face, how captions and titles look, where a picture goes, a look's colour preset), `captions.js` (the running captions), `clock.js` (times and words on a timeline), `recut.js` (cuts at pauses), `spelling.js`, `pictures.js`, `layers.js` (a timeline's layers from the record, as titles and pictures) and `projects.js` (the main video's project); and `fcpxml.js` learns built-in titles, stills and a look. Then `timeline.js` builds what a push hands to Final Cut from the record, `edit.js` gains seven commands, and the record gains a layout 2 for what they record.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages. Final Cut Pro 12.4's FCPXML 1.10, its built-in Basic Title and Basic Lower Third, and its Color Grading Presets.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md` on `main` (2504589): section 4 (the session: "Times a person gives", "What applies where", the table of what a person can say, the guard, "What brimm-video writes for Final Cut"), section 1 (the rule, the record), section 2 (stored timelines), section 3 (a Reel "gains captions and its title in phase 4, and the look and the logo in phase 6"), and section 7 (phase 4's row, phase 0's findings B1 and B2). Where the spec names a value only by reference: `docs/research/2026-10-13-video-presets/presets.md` (Parts 1 and 2, and the rules of 2.4). Built on `main` 2504589 and PR 19 (f3e02a2), which merges after Sallie's set-up.

**How this plan was made.** Every module, command and test in it was written test first and run on a scratch copy of f3e02a2, outside the repo: 1589 of 1590 tests pass there, and the one that fails needs a git checkout, which the copy is not. C8's script was run into a scratch folder, and each file it wrote passes Final Cut's own definition of the format (xmllint). So the code below is exact against f3e02a2. Where PR 19 changes before it merges, its merged names win, and the task's code is renamed to them, nothing else.

**This is the second version.** It answers the architect's review (findings 1 to 41) and the lead's (L1 to L32); "What changed in this version", at the end, says where each is answered. Jason's steer for it: keep the `claimHeld` refusals, add no new two-Mac machinery (where a finding is only about a race between the two Macs, refusing safely is enough), and put the effort into her experience on her laptop: correct output, clear words, nothing lost.

## Global Constraints

- Node 22 or later, no packages. Every test: `cd tool && node --test`.
- Write a failing test first, then the code. Small commits, in a worktree only. Nothing merges to `main` until Jason is back.
- No test calls the real `claude`, ffmpeg, `open` or Final Cut (spec section 7). xmllint against Final Cut's own definition of the format, which skips itself where Final Cut or xmllint is missing, is allowed (`tests/fcpxml.test.js` does it today).
- "Until the templates exist, the same commands use Final Cut's built-in titles. Words go in the stand-in typeface until Sweet Sans Pro is bought: Varela, then Lucida Grande." (spec section 4)
- "every title brimm-video writes names its font and size" (spec section 4; phase 0, B1: a built-in title given words only is Helvetica 6). The writer refuses a title line without both.
- "brimm-video's own titles, captions and graphics carry roles of its own", with "the record's id in their names" (spec section 4): the roles `BRIMM titles` and `BRIMM captions`, and names `brimm <kind> <id> <short id>`.
- A Reel "gains captions and its title in phase 4, and the look and the logo in phase 6" (spec section 3): a Reel's logo is refused, and its look is recorded and said, not applied.
- Nothing beyond the refusals touches a hand-edited timeline (phase 5): every command that changes a timeline refuses one whose `base` is set.
- Every new command that changes the record refuses while another Mac has the episode (`claimHeld`), and while a detached run other than `bring` runs for it (`runningCommand`), as `finish` and `release` do. A command that only reads (a list, Claude's ideas, a preset's lists) does neither. Every command that reads a time or quoted words on a timeline shown before asks the guard first, as a push does: "before any command that reads a time or quoted words on such a timeline, the skill asks" (spec section 4).
- Every write into an episode follows the rule (spec section 1): the record through `writeEpisode` (`save`); a picture cloned into `media/` with `cloneIn`, never over another file, and taken out again when the record cannot be written; a file in `final/` through `textWriter` with `replace` (deleted, then cloned in), and only once it is here, whole.
- "`edit.js` takes only the name of a picture file in that folder, never a path, so words in a transcript cannot make it copy another file into Dropbox." (spec section 4)
- "Every time in it is in seconds of the raw video. A time a person gives is read on the timeline they name, and mapped back." (spec section 1, the record) "A time she gives is read on the timeline she names, the newest pushed version by default." (section 4): for every command, `cut keep` too.
- `cut` "Changes the ranges at heard pauses. Refused on a hand-edited timeline" (spec section 4), and "A phrase is only ever cut whole, and only at a pause" (`cuts.js`).
- "A cut on the main video does not reach a Reel over the same words, and the command says so." (spec section 4)
- Never write into a watched Dropbox folder or touch a real video. Install nothing. Never read a `.env` file.
- Every message a person reads is in the codebase's own plain words: short sentences, what happened, and what to do.

## Rulings

Where the spec is silent or two of its lines meet, this plan rules. The lead accepted 1 to 4 on 2026-10-15, and the architect 5 to 8, 10 and 11 with changes, made below; 9 is replaced by the spec's own reading; 13 and 14 are new. All are for the lead and the architect again.

1. **A Reel's captions are on unless turned off, and its title on screen shows for its first 3 seconds whenever it has one** (section 3; the research's D1). `captions reel <n> off` turns off the captions and leaves the title. The research's rule 3, which leaves out a title in the top band that meets the face (presets.md 492), is not applied: brimm-video does not read where her face is in each frame until phase 6. So a Reel's title on screen, and an upright name title, will often cover her face, since the crop centres it, and every push of an upright timeline with a title says: "A title at the top of an upright video can cover a face: check it by eye in Final Cut."
2. **The logo is on the main video only, and its picture comes from her Pictures folder**, named once with `logo on --picture "<name>"`, copied into `media/`, and kept by the episode as `brand.logo`. `logo … reel <n>` is refused: "A Reel's logo comes with the brand templates, later." Phase 6 moves the logo into `brand/brand.json`.
3. **With no cut asked for, a timeline keeps the plan's own ranges**, as the import made them from the pauses ffmpeg heard. With cuts, only the stretch around each phrase a cut changed is made again, from the start of the phrase before it to the end of the phrase after it, by the import's own `rangesOf` on the gaps between the plan's phrases (the plan does not keep the pauses ffmpeg heard). Everything outside those stretches is the plan's own, so a lead-in, a cough or a tail with no words is kept as the import kept it. Inside one, a sound with no words beside the phrase taken out goes with the pause beside it, and each range names only the phrases it holds now.
4. **A look is applied in phase 4 on the main video**, as Final Cut's own Color Grading Preset with its Mix (spec section 4: "Looks name a built-in Color Grading Preset with its Mix"), behind by-hand checks 2 and 2b. A look is applied only once C9 has its preset's uid and Mix key from check 2, and its check 2b matched; until then it is recorded only, and the push says so. A Reel's look is recorded and said, not applied (section 3). An HDR recording gets no look, Natural included, and the push says Final Cut converts its colours (rule 7, with HLG and PQ both read as HDR).
5. **The record's layout goes to 2 the first time a record holds a layer of phase 4, and stays at 2.** Spec 172: "`version` is the record's layout, raised only when the record's shape changes." The spec's own layout-1 record (150-163) holds `spellings` and a `main.preset`; phase 4 is what gives them a meaning, so they raise the layout too. A record written at 2 is never written at 1 again, after `logo off` or the last `spell drop` too, so a Mac on older code never takes it back. Such a Mac refuses an episode at layout 2 ("Jason has a newer brimm-video") instead of pushing it without its layers. An episode no phase 4 command has touched stays at 1, and a Mac on older code still pushes it as before: its Reels without the captions and title phase 4 draws on them by default, and a short video's main video without its captions.
6. **A Reel is built on the project written when it was picked**: its clips and their moves, read back from `edit/reel-<n>.v0.fcpxml`, with its note that a face was guessed, through any cut she makes in it. A Reel the import cut as a clip, before phase 3, cannot be laid over: every command that would change it refuses ("make this change by hand in Final Cut"), and a push of it says when the record asks for something on it that is not shown.
7. **Boxed and Signature are drawn as Plain until their parts exist, and the push says so, for captions and for titles.** Signature's running captions are Plain words that fade in line by line (presets.md 355-370); no fade is written yet, so they are Plain without it. Its navy block belongs to its title on screen. Boxed's mist box is Final Cut's own Subtitle title (presets.md 415, 685), whose settings an export made by hand would give; that is not asked for yet. Bold is drawn in its capitals, without the box on its stressed word.
8. **A title or picture that runs over a join is written once on each side of it**, so nothing hangs off its clip (`checkFcpxml`'s rule; phase 0 never put a title over a join). The cost: a Basic Lower Third over a join may play its build-in again on the far side. Check 1 has a title over a join in each frame to show it. If it does, the fallback is a change to `fcpxml.js` and `checkFcpxml` (a title written once, at full length, on the clip where it starts), which the lead schedules: C9 stops and says so. A layer whose moment is cut now is left out of the push, and the push says so.
9. **A time she gives is read on the timeline she names** (spec 273: the lead's decision), for `cut` as for every other command. `cut remove --at <time> --to <time>` takes out what lies between, on it, and `--to` may be its very end. For `cut keep --at 12:30`, spec 273 says only that a time inside a cut is refused; what a time beside one keeps is this plan's own rule, for the lead and the architect. It keeps what was cut at a join near 12:30 on her timeline: a join where words were cut (never a pause alone), the only one within 5 seconds, or one within a second whose next is more than 2 seconds off; otherwise each is named, with its time and first words, and nothing is guessed (spec 500). A join whose words are kept again since is said to be kept already. A time on what she watched that a cut has taken out since keeps that cut again. On a Reel, what was cut before its first piece or after its last, within its stretch, is a join at its start or its end. `cut keep --words` finds the words in what is cut, within a Reel's stretch for a Reel. A keep of what is kept already, and a cut that would leave nothing, are refused. The times in the cut plan, Claude's notes and the markers' words are the recording's, and her skill says never to give one as `--at`.
10. **Each command names its timeline after the episode**: `main`, the default, or `reel <n>`.
11. **`spell` after a finish spells the final transcripts too, once, and makes the hand-off again as its next revision**, which she drops on the BRIMM Ops page again. Each finished part's transcripts hold the spellings that changed them: its own `spellings` in `finished.parts`, or the record's for a part no spelling has reached since a finish made it. A finish again keeps a part it reuses as it was, its list with it, and makes a part Shared again afresh. Only a spelling of a word a part does not hold yet is applied to it, so none is applied twice, however it spells, and one that changes nothing there is not held. A spelling taken back or changed leaves the parts as they are, and says they keep it "until each part is shown in Final Cut, Shared and finished again" (a finish again reuses a part not Shared again). Files and a new revision are written only when a final text changes; the revision is past any in `final/`; the hand-off is checked and names this brimm-video. It refuses while a finish (or any run but `bring`) runs, before anything is written, finished or not, and brings the final files over first when they are not here, whole. When the record cannot be written, each final file is put back as it was, on its own; one that cannot be is named, and she is told the episode needs Jason. A finished part may have captions drawn into its picture, which keep the old spelling on screen: the push says so for each that may ("If Reel 2 shows captions on screen, …"). Open in brimm-operations' L7 (spec 387): what a new revision does to drafts she has already edited.
12. **Final Cut's font sizes are taken to be pixels of the frame, and a title's move hundredths of the frame's height, as a still's is.** Check 1 says whether they are, at 1080 and at 720 lines, and C9 applies what it finds: in `styles.js`, and in the tests that pin those numbers. Builder A's tests take their sizes and places from `styles.js`, so they follow.
13. **Upright, a picture in the corner sits below the top band (31% down), and `lower` sits above the captions, about 41% to 60% down**: the captions hold 65% down, and a name and a Reel's title the top band. Spec 291 says "`lower` is the lower third"; this rules for the upright frame only. Wide, `lower` is the lower third (its lowest edge 85% down). Check 3 shows both.
14. **Words go above pictures**: graphics on lane 2, the logo on 3, captions on 4, titles on 5. On a Reel, a name title asked for while its title on screen shows waits for it to end (both sit in the top band), and the push says so.

## Merge order, and when she gets each slice

- **Merge order** (the architect's): first the five PR 22 branches, fix/guard-single-quotes (PR 25), fix/open-held-first, fix/followups-resolve-release, docs/as-built-1b and fix/installer-check-agent, settling their shared `edit-claim.test.js` between them. Then PR 19, rebased onto them: keep both `heldText` and `conflictedBy` in `edit.js`'s import from `episode.js`, and take as-built-1b's README and setup guide. C1 to C9 may merge at any time. A1 onward merge only after PR 19, and Builder A works on PR 19's head until then. Nothing merges until Jason is back.
- A10 is written against the files as those branches leave them. The skill's new rows go after "Show it in Final Cut", and the check of "Not ready yet" is a test file of its own (`tests/studio-ready.test.js`), so it meets none of their edits.
- **When a slice reaches her.** Her skill is a copy the installer writes (`settings.js studio`), and her laptop runs `edit.js` from its own checkout. So a slice reaches her only when her checkout is pulled and her folder written again: an install, `--print` first, and Jason's yes. Suggested twice: after A6 (a Reel's captions and title, `spell`, `logo`), and after A9 (the rest).

## What phase 4 needs from her guard's grammar

Her guard (`studio.js`, `WORD`) passes plain words, and double-quoted words without `"`, `$`, a backtick or a backslash. PR 25 (fix/guard-single-quotes, PR 22's task 3) adds single-quoted words, for words that hold those four.
- Times, `0:03`, `12:30`, `1:02:03`, `3.5`, and the commands' own words (`add`, `lower-third`, `reel`, `2`, `--place`, `corner`): plain words.
- Her words: `--at-words "three numbers"`, `--line "Founder, The BRIMM"`, `--picture "BRIMM logo.png"`, `spell "<episode>" add "Hormozy" "Hormozi"`: double-quoted. An apostrophe passes ("Sallie's"). A word with a letter outside A to Z (an accent) must be quoted, since plain words are ASCII, so the skill quotes all of her words.
- In `--at-words` and `--words`, words are matched by their letters, figures and apostrophes alone (`clock.js` `wordsAt`): `$`, a backtick, a backslash and a double quote count for nothing. So the skill leaves them out ("that's $100,000" is passed as `"that's 100,000"`), keeps apostrophes, and never asks her to say such words another way. Her skill says so from A7.
- In `--line`, `--picture` and `spell`, words are kept as they are. A word with `$`, a backtick, a backslash or a double quote needs PR 25's single quotes; one that also holds an apostrophe cannot be passed, and the skill asks her to say it another way, as PR 25 says.
- Nothing else is new: a lower third's two lines are two `--line` words, so no line break is ever passed, and no command needs a pipe, a glob or a path.

## By-hand checks for Jason

About 25 minutes, on made-up clips only. Task C8's script writes the files from brimm-video's own writer into `~/BRIMM Video Work/Phase 4 checks/`, outside Dropbox, and each imports into one library there, "Phase 4 checks". Install Varela with Font Book first (Jason's own yes). Open each file with `open -a "Final Cut Pro" "<file>"`. Write what is seen on the line under each check in `docs/phase-4/checks.md`, and send it to the lead: Task C9 applies it. In this order, because each unblocks more than the next:

1. **Titles** (it unblocks everything she sees: captions, a Reel's title, name titles). Times are on the timeline, as Final Cut shows them.
   - `1 titles upright.fcpxml`: the caption "So the first thing" in Varela with a soft shadow, its lowest edge about 65% down, its capitals about 48 px tall at 100%. The title "Know your / costs" on two lines, centred, in the top band (15% to 30% down), from 0:07 to 0:13; at the join at 0:09 it carries on, with no break and no second entry (ruling 8). The name "Sallie Ogden / Founder, The BRIMM" in the top band from 0:13, centred.
   - `1 titles upright lucida.fcpxml`: the same, in Lucida Grande, not Helvetica.
   - `1 titles wide.fcpxml`: the caption, centred, low. The Basic Lower Third "Sallie Ogden" over "Founder, The BRIMM", in Varela, flush left one over the other at the template's own place, lower left, wholly inside the frame, from 0:06 to 0:12; it stays up across the join at 0:09, with no second entry. Then, from 0:13, "Sallie Ogden" alone: nothing under it, not the template's own words.
   - `1 titles wide 720p.fcpxml`: the same at 1280 by 720. With the viewer at Fit, set beside the 1080 one: the name's capitals are the same share of the frame's height in both. Say "the same", or "smaller at 720p" and by about how much.

   If a place or a size is off, say what is seen: the capitals' height at 100%, and the lowest edge. If the title over the join enters again, or the name alone shows words under it, say so.
2. **Looks** (it unblocks applying a look). In the browser, duplicate the project "Phase 4, 1 titles wide" three times (Edit > Duplicate Project), and name the copies "look bright", "look warm" and "look moody". In each, select both clips of the video (not the titles), and from the Effects browser drag one Color Grading Preset onto them: Clean Whites with Lifted Blacks onto "look bright", Warm Dusk with Low Contrast onto "look warm", Warmer Vintage with Dark Blacks onto "look moody". Set its Mix to 0.25 (0.5 for moody), the strength brimm-video writes. Then File > Export XML… of each in turn, saved as "look bright.fcpxml", "look warm.fcpxml" and "look moody.fcpxml" into `~/BRIMM Video Work/Phase 4 checks/`. Send the three.

   **2b**, once C9 has the presets on its branch: run the script from that branch, which now writes `2 look <look>.fcpxml` for each look. Open each, and set it beside the "look <look>" project made by hand. Say, for each look, "the same colour" or what differs: a look is applied only once its 2b is the same colour.
3. **Pictures** (it unblocks graphics and the logo). Open `3 pictures.fcpxml`, upright. See: the made-up logo, 600 by 300, top right, 15% of the frame's width; the made-up chart, 1600 by 900, filling the frame from 0:01 (full), at half size in the top right corner below the top band, about 31% down, from 0:06 (corner), and fitted into a box above the captions, about 41% to 60% down, from 0:11 (lower; ruling 13). If a picture is not fitted to the frame unless told to fill it, say so. Then File > Export XML… of that project, saved as "3 pictures export.fcpxml" into the same folder, and send it: C9 reads each picture's role there. Last, open `3 pictures bare.fcpxml`, the same pictures written without "suppress warnings", in an event of its own: say anything Final Cut says when it takes it in.

Then, as the spec's phase 4 row asks: one session run by Sallie, on a real episode, on her laptop.

## Review Focus

The inputs the spec implies and no task's main tests exercise, most likely to bite first. Each line's test is in the task named.

1. **A recording whose heard pauses are not its phrase gaps**: a lead-in, a cough or a tail with no words. Expected: with no cut, the plan's own pieces exactly, through a push after a spelling, the logo or a preset; a cut away from them keeps them too. Tests in C7 (a lead-in, a laugh between two heard pauses, and a tail) and A4 (the tail, through a push).
2. **A time on a version cut again since it was watched, past its end, at its very end, or on a timeline never shown.** Expected: refused with the nearest kept words; refused with its length (to the tenth of a second when, to the second, the two would read the same); the end read as the end; read on the timeline as it is now. Tests in C6, A7 and A9.
3. **A layer, or Claude's graphic idea, whose moment a later cut takes out.** Expected: the layer left out of the push, and said; the idea's note gone with its words, and back when they are kept again. Tests in A3 and A9.
4. **A picture named with a path, a link, a missing file, a file that is not a picture, a name another picture in `media/` already has, or a phone photo stored on its side behind a large EXIF part.** Expected: refused in plain words with nothing copied; the same picture used again without a second copy; the photo placed at the size it is shown. Tests in C5, A4 and A6.
5. **A word spelled inside a longer word, with punctuation on it, with a curly apostrophe, or spelled again after a finish.** Expected: "Sallyport" left alone; "Sally," and "Sally's" spelled; a curly apostrophe, and a word the show's own names spell already, refused in plain words; the final transcripts spelled once, never twice, after a finish again too. Tests in C4 and A5.

---

## Two builders

The work is split by file, so the two never touch the same function. Builder C writes the pure modules, each with its tests, the check files, and what the checks send back. Builder A (who built phases 1a and 1b) writes the record, the builder, the push and every command in `edit.js`, and the skill and the card.

| Task | Builder | What | After |
|---|---|---|---|
| C1 | C | Titles, pictures and a look in the Final Cut file (`fcpxml.js`) | — |
| C2 | C | The looks of words and pictures (`styles.js`) | — |
| C3 | C | The running captions (`captions.js`) | C2, C6 (its tests use `captionLook` and `heardWords`) |
| C4 | C | Spellings (`spelling.js`; `final-transcript.js` exports two functions) | — |
| C5 | C | Pictures by name, their size as shown (`pictures.js`) | — |
| C6 | C | Times and words a person gives, and the cuts on a timeline (`clock.js`) | — |
| C7 | C | Cuts at pauses (`recut.js`) | — |
| C8 | C | The files for Jason's by-hand checks (`docs/phase-4/`) | C1, C2 |
| C9 | C | What the by-hand checks send back (`styles.js`) | C8, and Jason's answers |
| A1 | A | The record's layout 2 (`episode.js`) | PR 19 |
| A2 | A | One main project for the import and the push (`projects.js`); the guard on its own; a Reel's project takes layers | A1, C4 |
| A3 | A | A timeline's layers (`layers.js`) | C2, C3, C4, C6 |
| A4 | A | What a push hands Final Cut (`timeline.js`), push through it, and `captions` | A1, A2, A3, C1, C5, C6, C7 |
| A5 | A | `spell` | A4 |
| A6 | A | `logo` | A5 |
| A7 | A | `text` and `graphic` | A6 |
| A8 | A | `preset` | A7 |
| A9 | A | `cut` | A8 |
| A10 | A | Her card, and the skill's last words | A9 |

Each task leaves its branch working. A2 is the first task to rely on Builder C's work (C4's `spelledCaptions`); C3 waits for C2 and C6; the other pure modules have no order among themselves, so Builder C lands them first. A4 is the first change she sees: a Reel shown in Final Cut gains its captions and its title on screen (ruling 1), and `captions … off` turns its captions off. From A4 on, each command lands with its own row in her skill and leaves "Not ready yet" in the same commit; `tests/studio-ready.test.js` checks each. C8's files should reach Jason early: check 1 can change `styles.js`'s numbers before A4 shows anything.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `tool/fcpxml.js` | Modify (C1) | Built-in titles, stills and a look on a timeline; a piece may carry its move; the check learns them |
| `tool/styles.js` | Create (C2), modify (C9) | The preset's lists; the stand-in face; captions' and titles' looks; where a picture goes; a look's preset |
| `tool/captions.js` | Create (C3) | The running captions of a timeline (rules 1 and 4) |
| `tool/spelling.js` | Create (C4) | A spelling's check; spellings on words; final transcripts and the hand-off spelled again |
| `tool/final-transcript.js` | Modify (C4) | Exports `spelledPairs` and `spelledCaptions` |
| `tool/pictures.js` | Create (C5) | A picture's name checked; its size as shown, from its bytes |
| `tool/clock.js` | Create (C6) | Times and words on a timeline, mapped to the raw video, refused where the spec says; the cuts on a timeline |
| `tool/recut.js` | Create (C7) | Cuts at pauses: whole phrase groups, the plan's own ranges outside what a cut changed |
| `docs/phase-4/make-checks.mjs`, `docs/phase-4/checks.md` | Create (C8) | The files and the steps of the by-hand checks |
| `tool/episode.js` | Modify (A1) | Layout 2: the layers read and checked; `layoutOf` |
| `tool/projects.js` | Create (A2) | The main video's project, for the import and for a push |
| `tool/unedited.js` | Modify (A2) | `finalCut` through `mainProject`; `ideaNotes` exported |
| `tool/reels.js` | Modify (A2) | `reelProject` takes titles, stills, a look, the ranges for its notes, and a piece's move; `GUESSED` exported |
| `tool/layers.js` | Create (A3) | A timeline's layers as titles, stills and a look |
| `tool/timeline.js` | Create (A4) | What a push hands Final Cut; the clock a time is read on |
| `tool/finish.js` | Modify (A5) | Exports `lastRevision` |
| `tool/edit.js` | Modify (A2, A4 to A9) | `guardOf`; push through `timelineFor`; `captions`, `spell`, `logo`, `text`, `graphic`, `preset`, `cut`; the help |
| `tool/studio/SKILL.md` | Modify (A4 to A10) | A row for each command; "Not ready yet" shrinks |
| `README.md` | Modify (A10) | The commands, and her one-page card |
| tests | Create and modify | `tests/fcpxml-layers.test.js`, `styles`, `captions`, `spelling`, `pictures`, `clock`, `recut`, `layout`, `projects`, `layers`, `timeline`, `phase4.js` (the shared fixture), `edit-session`, `studio-ready`; small changes to `fixtures.js` and the `fcpxml`, `episode`, `edit-records`, `edit` and `unedited` tests |

---

## Task C1: Titles, pictures and a look in the Final Cut file

**Files:**
- Modify: `tool/fcpxml.js`
- Create: `tool/tests/fcpxml-layers.test.js`
- Modify: `tool/tests/fcpxml.test.js` (one test: a title now points at an effect, a picture at an asset)

**Interfaces:**
- Produces: `TITLE_UID`, `LOWER_THIRD_UID`. `fcpxml({ …, titles = [], stills = [], look = null })` where each title is `{ start, end, lane, name, role, template: "title" | "lower-third", lines: [{ text, font, fontSize, fontFace?, fontColor?, shadow?: { color, blur }, kerning?, alignment? }], position? }`, each still `{ start, end, lane, name, role, src, width, height, position?, scale?, fill? }`, all times in seconds of the raw video, and `look` is `{ name, uid, params: [{ name, key, value }] }`. A line names its alignment, or has none written (the Basic Lower Third keeps its own, flush left). A title line with no font or no size is refused (it throws). A one-line Basic Lower Third gets an empty second text, so the template's own words never show under a name. A range of an upright project may carry `position` (a move as written before) in place of `crop`. `checkFcpxml` accepts a still's format, which has no frame rate, and checks a title or a picture lies in its clip. The file's opening comment says it writes titles now.

- [ ] **Step 1: Write the failing tests**

`tool/tests/fcpxml-layers.test.js`:

```js
// Titles and pictures on a timeline (phase 4): Final Cut's built-in titles, each naming its font and size, and stills laid
// over the picture, each written on the kept pieces it shows over.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fcpxml, checkFcpxml, TITLE_UID, LOWER_THIRD_UID } from "../fcpxml.js";

const AT_30 = { duration: 20, frameRate: "30/1", width: 1920, height: 1080, hasAudio: true, audioRate: 48000, audioChannels: 2 };
/** Each tag of a name in the text, as its attributes. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
const RANGES = [{ start: 0, end: 4 }, { start: 8, end: 12 }];
const LINE = { text: "Sallie Ogden", font: "Varela", fontSize: 69, alignment: "center" };
const base = { video: "/v/Pricing talk.mp4", facts: AT_30, ranges: RANGES, project: "p", event: "e" };

describe("an upright timeline's pieces", () => {
  it("may each carry a move of its own in place of a crop, as a Reel's pick wrote it", () => {
    const xml = fcpxml({ ...base, frame: { width: 1080, height: 1920 }, ranges: [{ ...RANGES[0], position: "44.4444 0" }, { ...RANGES[1], position: "-12.5 0" }] });
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "44.4444 0" }, { position: "-12.5 0" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30, { frame: { width: 1080, height: 1920 } }), []);
  });
});

describe("titles on a timeline", () => {
  it("writes a title on each kept piece it shows over, split at the join, with its template, font, size and place", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 2, end: 10, lane: 3, name: "brimm text t1 3fa9c1", role: "BRIMM titles", lines: [LINE], position: "0 -14" }] });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: "Basic Title", uid: TITLE_UID }]);
    assert.deepEqual(tags(xml, "title"), [
      { ref: "r4", lane: "3", offset: "2s", name: "brimm text t1 3fa9c1", duration: "2s", role: "BRIMM titles" },
      { ref: "r4", lane: "3", offset: "8s", name: "brimm text t1 3fa9c1", duration: "2s", role: "BRIMM titles" }
    ]);
    assert.deepEqual(tags(xml, "text-style").filter((t) => t.font), [
      { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", alignment: "center" },
      { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", alignment: "center" }
    ]);
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "0 -14" }, { position: "0 -14" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
  it("writes two lines of a Basic Title as one text, the first ending in a line break, each line with its own style", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "BRIMM titles", lines: [LINE, { ...LINE, text: "Founder, The BRIMM", fontSize: 52 }] }] });
    assert.match(xml, /<text>\n\s*<text-style ref="ts1">Sallie Ogden\n<\/text-style>\n\s*<text-style ref="ts2">Founder, The BRIMM<\/text-style>\n\s*<\/text>/);
    assert.deepEqual(tags(xml, "text-style").filter((t) => t.font).map((t) => t.fontSize), ["69", "52"]);
  });
  it("writes each line of a Basic Lower Third in a text of its own, as Final Cut writes one, and its template once", () => {
    const lower = { start: 1, end: 3, lane: 3, name: "n", role: "BRIMM titles", template: "lower-third", lines: [LINE, { ...LINE, text: "Founder" }] };
    const xml = fcpxml({ ...base, titles: [lower, { ...lower, start: 9, end: 11 }] });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: "Basic Lower Third", uid: LOWER_THIRD_UID }]);
    assert.equal(xml.match(/<text>/g).length, 4);
    assert.doesNotMatch(xml, /Sallie Ogden\n/);
    // A line that names no alignment writes none: the Basic Lower Third keeps its own place at the left (phase 0, B1). A name
    // with no role gets an empty second text, or the template would show its own words there.
    const own = fcpxml({ ...base, titles: [{ ...lower, lines: [{ text: "Sallie Ogden", font: "Varela", fontSize: 34 }] }] });
    assert.deepEqual(tags(own, "text-style").filter((t) => t.font), [0, 1].map(() => ({ font: "Varela", fontSize: "34", fontFace: "Regular", fontColor: "1 1 1 1" })));
    assert.match(own, /<text-style ref="ts1">Sallie Ogden<\/text-style>[\s\S]*<text-style ref="ts2"><\/text-style>/);
    assert.deepEqual(checkFcpxml(own, AT_30), []);
  });
  it("gives a soft shadow and letter spacing when a line asks for them", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 2, name: "n", role: "BRIMM captions", lines: [{ ...LINE, shadow: { color: "0 0 0 0.65", blur: 10 }, kerning: 4 }] }] });
    assert.deepEqual(tags(xml, "text-style").find((t) => t.font), { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", shadowColor: "0 0 0 0.65", shadowOffset: "0 0", shadowBlurRadius: "10", kerning: "4", alignment: "center" });
  });
  it("refuses a title line with no font or no size, which Final Cut would draw as Helvetica 6", () => {
    for (const line of [{ ...LINE, font: "" }, { ...LINE, fontSize: 0 }, { text: "x" }]) assert.throws(() => fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "r", lines: [line] }] }), { message: "Title 1 must name a font and a size for every line." });
  });
  it("leaves out a title wholly in what was cut out, and writes nothing new when given no titles or pictures", () => {
    const plain = fcpxml(base);
    assert.equal(fcpxml({ ...base, titles: [{ start: 5, end: 7, lane: 3, name: "n", role: "r", lines: [LINE] }] }), plain);
    assert.equal(fcpxml({ ...base, titles: [], stills: [] }), plain);
  });
});

describe("pictures on a timeline", () => {
  const still = { start: 1, end: 3, lane: 4, name: "brimm graphic g1 3fa9c1", role: "BRIMM titles", src: "../media/chart.png", width: 1600, height: 900 };
  it("writes each picture once, as a still's format and asset, and shows it as a connected video with its move and size", () => {
    const xml = fcpxml({ ...base, stills: [{ ...still, position: "40 -20", scale: 0.5 }, { ...still, start: 9, end: 10 }] });
    assert.deepEqual(tags(xml, "format").slice(1), [{ id: "r4", name: "FFVideoFormatRateUndefined", width: "1600", height: "900" }]);
    assert.deepEqual(tags(xml, "asset")[1], { id: "r5", name: "chart", start: "0s", duration: "0s", hasVideo: "1", format: "r4", videoSources: "1" });
    assert.deepEqual(tags(xml, "media-rep")[1], { kind: "original-media", src: "../media/chart.png" });
    assert.deepEqual(tags(xml, "video"), [
      { ref: "r5", lane: "4", offset: "1s", name: "brimm graphic g1 3fa9c1", duration: "2s", role: "BRIMM titles" },
      { ref: "r5", lane: "4", offset: "9s", name: "brimm graphic g1 3fa9c1", duration: "1s", role: "BRIMM titles" }
    ]);
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "40 -20", scale: "0.5 0.5" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
  it("fills the frame with a picture shown full", () => {
    const xml = fcpxml({ ...base, stills: [{ ...still, fill: true }] });
    assert.deepEqual(tags(xml, "adjust-conform"), [{ type: "fill" }]);
  });
  it("gives the templates their ids before the pictures", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 2, lane: 3, name: "n", role: "r", lines: [LINE] }], stills: [still] });
    assert.deepEqual(tags(xml, "effect").map((e) => e.id), ["r4"]);
    assert.deepEqual(tags(xml, "asset").map((a) => a.id), ["r2", "r6"]);
  });
});

describe("a look", () => {
  const LOOK = { name: "Clean Whites with Lifted Blacks", uid: "FFColorGradingPreset.Clean Whites", params: [{ name: "Mix", key: "9999/1", value: "0.25" }] };
  it("is a built-in colour preset on every clip, after its notes, with its Mix, and its effect once", () => {
    const xml = fcpxml({ ...base, markers: [{ at: 1, text: "a note" }], look: LOOK });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: LOOK.name, uid: LOOK.uid }]);
    assert.deepEqual(tags(xml, "filter-video"), [{ ref: "r4", name: LOOK.name }, { ref: "r4", name: LOOK.name }]);
    assert.deepEqual(tags(xml, "param"), [{ name: "Mix", key: "9999/1", value: "0.25" }, { name: "Mix", key: "9999/1", value: "0.25" }]);
    assert.match(xml, /<marker [^>]*\/>\n\s*<filter-video/);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
});

describe("the check of a file with titles and pictures", () => {
  it("finds a title that runs off the end of its clip", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "r", lines: [LINE] }] }).replace('offset="1s" name="n" duration="2s"', 'offset="1s" name="n" duration="5s"');
    assert.deepEqual(checkFcpxml(xml, AT_30), ["A title on clip 1 lies outside the clip."]);
  });
});

describe("Final Cut's definition of the format", { skip: !existsSync("/Applications/Final Cut Pro.app") || spawnSync("xmllint", ["--version"]).error ? "Final Cut Pro or xmllint is not on this machine" : false }, () => {
  const DTD = "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd";
  it("holds a wide and an upright project with titles of both kinds and pictures", () => {
    const dir = mkdtempSync(join(tmpdir(), "layers-"));
    try {
      const layered = { look: { name: "Clean Whites with Lifted Blacks", uid: "FFColorGradingPreset.Clean Whites", params: [{ name: "Mix", key: "9999/1", value: "0.25" }] }, titles: [{ start: 1, end: 10, lane: 3, name: "t", role: "BRIMM titles", lines: [LINE, { ...LINE, text: "two" }], position: "0 -14" }, { start: 2, end: 3, lane: 3, name: "l", role: "BRIMM titles", template: "lower-third", lines: [LINE] }], stills: [{ start: 1, end: 3, lane: 4, name: "s", role: "BRIMM titles", src: "../media/chart.png", width: 1600, height: 900, fill: true, position: "10 0", scale: 0.5 }] };
      const wide = fcpxml({ ...base, ...layered });
      const upright = fcpxml({ ...base, ...layered, frame: { width: 1080, height: 1920 }, ranges: RANGES.map((r) => ({ ...r, crop: { x: 657, y: 0, w: 606, h: 1080 } })) });
      for (const [name, text] of [["wide.fcpxml", wide], ["upright.fcpxml", upright]]) {
        writeFileSync(join(dir, name), text);
        const checked = spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, name)], { encoding: "utf8" });
        assert.equal(checked.status, 0, checked.stderr);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

In `tool/tests/fcpxml.test.js`, the test "find anything else that points at a part of the file that is not there": a title now points at a template, an effect, and a picture at its asset (phase 0, B1). Its comment and its four lines become:

```js
    /** The file with a title at the end of its timeline, or a picture laid over its first clip. A title points at a
        template, an effect, and a picture at its asset (phase 0, B1). */
    const titled = (ref) => changed("</spine>", `<title ref="${ref}" offset="15s" name="Lower third" duration="2s"/></spine>`).replace('duration="15s" tcStart', 'duration="17s" tcStart');
    const laidOver = (ref) => changed("<marker ", `<video ref="${ref}" lane="1" offset="1s" duration="1s"/><marker `);
    assert.deepEqual(checkFcpxml(titled("r9"), AT_30), [`The title points at "r9", and the file holds no effect of that name.`]);
    assert.deepEqual(checkFcpxml(laidOver("r9"), AT_30), [`The video points at "r9", and the file holds no asset of that name.`]);
    assert.deepEqual(checkFcpxml(titled("r1"), AT_30), [`The title points at "r1", and the file holds no effect of that name.`]);
    assert.deepEqual(checkFcpxml(laidOver("r2"), AT_30), []);
  });
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/fcpxml-layers.test.js tests/fcpxml.test.js`
Expected: FAIL. `TITLE_UID` is not exported; no `<title>`, `<video>` or `<filter-video>` is written; a title pointing at `r1` passes the check.

- [ ] **Step 3: Write the code**

```diff
--- a/tool/fcpxml.js
+++ b/tool/fcpxml.js
@@ -1,8 +1,8 @@
 // Writes a Final Cut Pro project file (FCPXML) from a video and the list of the pieces of it to keep. Final Cut Pro opens the file
 // as a project with those cuts already made on its timeline, the captions in place, and a marker wherever there is a note.
-// What the file holds: the cuts, the captions, the notes for the editor and, when it is told one, the library the project goes
-// into. What it cannot do: it cannot make Final Cut export a video, and a title or a graphic in such a file is only the name of
-// a template on that Mac, so none is written here.
+// What the file holds: the cuts, the captions, the notes for the editor, Final Cut's own built-in titles (each naming its font
+// and size, which a title given words only does not keep: phase 0, B1), pictures laid over the picture, a look, and, when it
+// is told one, the library the project goes into. What it cannot do: make Final Cut export a video.
 // Nothing here touches a disk or runs a program. It takes plain data and gives back text.
 import { basename, extname } from "node:path";
 
@@ -66,6 +66,12 @@
     attribute in the file is written this way, and code that changes a name in a file this module wrote uses it too. */
 export const attribute = (text) => escaped(oneLine(text)).replace(/"/g, "&quot;");
 
+/** Final Cut's own titles, by the names its exports give them (phase 0, B1): the Basic Title, and the Basic Lower Third. A
+    title given words only comes back Helvetica 6 (B1), so every title written here names its font and its size. */
+export const TITLE_UID = ".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti";
+export const LOWER_THIRD_UID = ".../Titles.localized/Lower Thirds.localized/Basic Lower Third.localized/Basic Lower Third.moti";
+const TEMPLATES = { title: { name: "Basic Title", uid: TITLE_UID }, "lower-third": { name: "Basic Lower Third", uid: LOWER_THIRD_UID } };
+
 /** How a caption looks, as Final Cut writes it for a caption of its own: white letters on black. */
 const STYLE = { font: ".AppleSystemUIFont", fontSize: 13, fontFace: "Regular", fontColor: "1 1 1 1", backgroundColor: "0 0 0 1" };
 
@@ -140,7 +146,7 @@
     frame and moved onto the face by its `crop`, {x, y, w, h} in pixels of the picture as it is shown, and the project has a
     format of its own. Given none, the project is the video's own shape. It throws when the frame is not whole pixels, and
     when a piece of an upright project has no crop. */
-export function fcpxml({ video, facts, ranges = [], captions = [], markers = [], project, event, library, src, frame }) {
+export function fcpxml({ video, facts, ranges = [], captions = [], markers = [], titles = [], stills = [], look = null, project, event, library, src, frame }) {
   if (frame && !(Number.isInteger(frame.width) && frame.width > 0 && Number.isInteger(frame.height) && frame.height > 0)) throw new Error(`The frame of the project must be given in whole pixels: ${frame.width} by ${frame.height}.`);
   const rate = rateOf(facts.frameRate);
   const time = (count) => timeOf(count, rate);
@@ -166,10 +172,10 @@
   for (const [i, range] of ranges.entries()) {
     const from = Math.max(0, frames(range.start, `start of piece ${i + 1}`));
     const to = Math.min(total, frames(range.end, `end of piece ${i + 1}`));
-    if (frame && !range.crop) throw new Error(`Piece ${i + 1} of an upright project has no crop to move it onto the face by.`);
+    if (frame && !range.crop && !range.position) throw new Error(`Piece ${i + 1} of an upright project has no crop to move it onto the face by.`);
     if (to <= from) continue;
     if (pieces.length && from < pieces[pieces.length - 1].to) throw new Error(`The pieces to keep must follow one another in the video: piece ${i + 1} starts before the one before it ends.`);
-    pieces.push({ from, to, name: range.name || name, crop: range.crop, captions: [], notes: new Map() });
+    pieces.push({ from, to, name: range.name || name, crop: range.crop, position: range.position, captions: [], titles: [], stills: [], notes: new Map() });
   }
 
   // A caption goes on the first kept piece it shows over, and shows no longer than that piece runs. So one that starts in a piece
@@ -193,8 +199,37 @@
     piece.notes.set(frame, [...(piece.notes.get(frame) || []), oneLine(marker.text)]);
   }
 
+  // A title or a still goes on each kept piece it shows over, for as long as it shows there: one that runs over a join is
+  // written once on each side of it, so nothing hangs off the end of its clip. One wholly in what was cut out goes nowhere.
+  const over = (item, what, i) => {
+    const from = frames(item.start, `start of ${what} ${i + 1}`);
+    const to = frames(item.end, `end of ${what} ${i + 1}`);
+    return to > from ? pieces.filter((p) => p.to > from && p.from < to).map((p) => [p, Math.max(from, p.from), Math.min(to, p.to)]) : [];
+  };
+  for (const [i, title] of titles.entries()) {
+    // Final Cut gives a title with no font or size Helvetica 6 (phase 0, B1): one is refused, never written so.
+    if (!title.lines.length || title.lines.some((line) => !String(line.font || "").trim() || !(Number(line.fontSize) > 0))) throw new Error(`Title ${i + 1} must name a font and a size for every line.`);
+    for (const [piece, from, to] of over(title, "title", i)) piece.titles.push({ ...title, from, to });
+  }
+  // Each picture shown is one asset, however often it shows. Final Cut writes a still's format with no frame rate, and its
+  // asset with no length (phase 0, B1).
+  const pictures = new Map();
+  for (const [i, still] of stills.entries()) {
+    for (const [piece, from, to] of over(still, "picture", i)) {
+      if (!pictures.has(still.src)) pictures.set(still.src, { src: still.src, width: still.width, height: still.height, name: basename(decodeURIComponent(still.src), extname(decodeURIComponent(still.src))) });
+      piece.stills.push({ ...still, from, to });
+    }
+  }
+
   // On the timeline each piece begins where the one before it ends. What sits on a piece is placed by the video's own time, since
   // a clip keeps the clock of the video it shows. Final Cut's definition of the format has the captions before the markers.
+  // The ids of what only some files hold come after the three every file may: each template used, then each picture's format
+  // and asset.
+  let ids = 3;
+  const used = [...new Set(pieces.flatMap((p) => p.titles.map((t) => t.template || "title")))].sort();
+  const effects = new Map(used.map((kind) => [kind, `r${++ids}`]));
+  for (const picture of pictures.values()) Object.assign(picture, { format: `r${++ids}`, id: `r${++ids}` });
+  const lookId = look && pieces.length ? `r${++ids}` : "";
   let length = 0;
   let styles = 0;
   const clips = pieces.map((piece) => {
@@ -207,11 +242,38 @@
         tag("text-style-def", { id: style }, [tag("text-style", STYLE)])
       ]);
     });
+    // A title names its font and size on every line (phase 0, B1), and its place, when it is not the middle, by a move in
+    // hundredths of the frame's height (phase 0, B1 and B2: that is how Final Cut 12.4 took a still's).
+    const written = piece.titles.map((title) => {
+      // A Basic Lower Third has two text objects, and one given no words keeps the template's own: a name with no role
+      // gets an empty second line (the lead's review, L9; by-hand check 1 shows it).
+      const given = title.template === "lower-third" && title.lines.length === 1 ? [...title.lines, { ...title.lines[0], text: "" }] : title.lines;
+      const lines = given.map((line) => ({ ...line, style: `ts${++styles}` }));
+      const runs = lines.map((line, i) => tag("text-style", { ref: line.style }, wordsOf(line.text) + (title.template === "lower-third" || i === lines.length - 1 ? "" : "\n")));
+      const texts = title.template === "lower-third" ? runs.map((run) => tag("text", {}, [run])) : [tag("text", {}, runs)];
+      const defs = lines.map((line) => tag("text-style-def", { id: line.style }, [tag("text-style", {
+        font: line.font, fontSize: line.fontSize, fontFace: line.fontFace || "Regular", fontColor: line.fontColor || "1 1 1 1",
+        ...(line.shadow ? { shadowColor: line.shadow.color, shadowOffset: "0 0", shadowBlurRadius: line.shadow.blur } : {}),
+        ...(line.kerning ? { kerning: line.kerning } : {}), alignment: line.alignment
+      })]));
+      const moved = title.position && title.position !== "0 0" ? [tag("adjust-transform", { position: title.position })] : [];
+      return tag("title", { ref: effects.get(title.template || "title"), lane: title.lane, offset: time(title.from), name: title.name, duration: time(title.to - title.from), role: title.role }, [...texts, ...defs, ...moved]);
+    });
+    const shownPictures = piece.stills.map((still) => {
+      const fit = still.fill ? [tag("adjust-conform", { type: "fill" })] : [];
+      const moved = (still.position && still.position !== "0 0") || (still.scale && still.scale !== 1) ? [tag("adjust-transform", { position: still.position || "0 0", scale: `${still.scale || 1} ${still.scale || 1}` })] : [];
+      return tag("video", { ref: pictures.get(still.src).id, lane: still.lane, offset: time(still.from), name: still.name, duration: time(still.to - still.from), role: still.role }, fit.length || moved.length ? [...fit, ...moved] : undefined);
+    });
     const noted = [...piece.notes].sort(([a], [b]) => a - b).map(([frame, texts]) => tag("marker", { start: time(frame), duration: time(1), value: texts.filter(Boolean).join(" / ") }));
     // In an upright project each clip is first filled into the frame and moved onto the face. Final Cut's definition of the
     // format has these before what sits on the clip.
-    const moved = frame ? [tag("adjust-conform", { type: "fill" }), tag("adjust-transform", { position: reelPosition(facts, piece.crop, frame) })] : [];
-    const inside = [...moved, ...shown, ...noted];
+    // A piece may carry its move as it was written before, in place of its crop: a Reel built again on the project written
+    // when it was picked keeps that project's moves.
+    const moved = frame ? [tag("adjust-conform", { type: "fill" }), tag("adjust-transform", { position: piece.position || reelPosition(facts, piece.crop, frame) })] : [];
+    // The look, a built-in colour preset of Final Cut's, on every clip, with its params as Final Cut writes them (by-hand
+    // check 2 of phase 4 read them off an export): Final Cut's definition of the format has a clip's filters after its notes.
+    const graded = lookId ? [tag("filter-video", { ref: lookId, name: look.name }, look.params.map((p) => tag("param", { name: p.name, key: p.key, value: p.value })))] : [];
+    const inside = [...moved, ...shown, ...written, ...shownPictures, ...noted, ...graded];
     // In an upright project each clip names the video's own format. Phase 0, Final Cut 12.4: a clip that does not takes the
     // timeline's, Final Cut takes the wide video for an upright one, warns of "an unexpected value", and does not fill.
     return tag("asset-clip", { ref: "r2", format: frame ? "r1" : undefined, offset: time(offset), name: piece.name, start: time(piece.from), duration: time(piece.to - piece.from) }, inside.length ? inside : undefined);
@@ -231,7 +293,13 @@
       ...(frame ? [tag("format", { id: "r3", frameDuration: time(1), width: frame.width, height: frame.height, colorSpace: "1-1-1 (Rec. 709)" })] : []),
       // An HDR video's format keeps its own colour space, and the timeline gets a Rec. 709 format of its own, the video's size
       // and rate, as Final Cut writes the project of an iPhone's HLG clip (phase 0, B3): never an HDR timeline.
-      ...(!frame && hdr ? [tag("format", { id: "r3", frameDuration: time(1), width: facts.width, height: facts.height, colorSpace: REC_709 })] : [])
+      ...(!frame && hdr ? [tag("format", { id: "r3", frameDuration: time(1), width: facts.width, height: facts.height, colorSpace: REC_709 })] : []),
+      ...[...effects].map(([kind, id]) => tag("effect", { id, name: TEMPLATES[kind].name, uid: TEMPLATES[kind].uid })),
+      ...(lookId ? [tag("effect", { id: lookId, name: look.name, uid: look.uid })] : []),
+      ...[...pictures.values()].flatMap((p) => [
+        tag("format", { id: p.format, name: "FFVideoFormatRateUndefined", width: p.width, height: p.height }),
+        tag("asset", { id: p.id, name: p.name, start: "0s", duration: "0s", hasVideo: 1, format: p.format, videoSources: 1 }, [tag("media-rep", { kind: "original-media", src: p.src })])
+      ])
     ]),
     tag("event", { name: event || "Rough cuts" }, [
       tag("project", { name: project || `${name} rough cut` }, [
@@ -271,7 +339,7 @@
 }
 
 /** The kind of thing a tag's ref has to name. A ref on any other tag has only to name something that is in the file. */
-const POINTS_AT = { "asset-clip": "asset", "text-style": "text-style-def" };
+const POINTS_AT = { "asset-clip": "asset", "text-style": "text-style-def", title: "effect", video: "asset" };
 
 /** Our own checks of a project file, for what Final Cut's definition of the format cannot see: that every time is a whole number
     of frames, that the clips follow one another with no gap and no overlap, that no clip runs outside the video, that a caption
@@ -312,8 +380,9 @@
   // Each format's frames are the video's, and the video's own format is the video's size.
   const one = timeOf(1, rate);
   const formats = new Map(all.filter((el) => el.name === "format").map((el) => [el.attrs.id, el]));
+  // A still's format has no frames of its own (phase 0, B1), and is not held to the video's.
   for (const format of formats.values()) {
-    if (format.attrs.frameDuration !== one) problems.push(`The format ${format.attrs.id} has frames of ${format.attrs.frameDuration}, and the video's are ${one}.`);
+    if ("frameDuration" in format.attrs && format.attrs.frameDuration !== one) problems.push(`The format ${format.attrs.id} has frames of ${format.attrs.frameDuration}, and the video's are ${one}.`);
   }
   // The video's size is the one `facts` gives, and when they give none, the one its own format says.
   const asset = all.find((el) => el.name === "asset");
@@ -361,9 +430,9 @@
       if (end !== null && offset > end) problems.push(said(`There is a gap of ${count(offset - end)} before clip ${n}.`));
       if (end !== null && offset < end) problems.push(said(`Clip ${n} overlaps what comes before it by ${count(end - offset)}.`));
       if (start < 0 || start + length > total) problems.push(said(`Clip ${n} runs outside the video.`));
-      for (const el of all.filter((e) => e.parent === clip && (e.name === "caption" || e.name === "marker"))) {
-        const at = read(el, el.name === "caption" ? "offset" : "start");
-        const long = el.name === "caption" ? read(el, "duration") : 1;
+      for (const el of all.filter((e) => e.parent === clip && ["caption", "title", "video", "marker"].includes(e.name))) {
+        const at = read(el, el.name === "marker" ? "start" : "offset");
+        const long = el.name === "marker" ? 1 : read(el, "duration");
         if (at !== null && long !== null && (at < start || at + long > start + length)) problems.push(said(`A ${el.name} on clip ${n} lies outside the clip.`));
       }
       end = offset + length;
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS. A file given no titles, pictures or look is the same as before, byte for byte (tested), so every other test is unchanged. The xmllint test runs where Final Cut and xmllint are installed, and passes a wide and an upright project with both kinds of title, a picture and a look.

- [ ] **Step 5: Commit**

```bash
git add tool/fcpxml.js tool/tests/fcpxml-layers.test.js tool/tests/fcpxml.test.js
git commit -m "The Final Cut file takes built-in titles, each naming its font and size, pictures, and a look"
```

---

## Task C2: The looks of words and pictures

**Files:**
- Create: `tool/styles.js`, `tool/tests/styles.test.js`

**Interfaces:**
- Produces: `JOBS`, `CAPTION_STYLES` (each keyed by the spec's ids, `"full-episode"`, `"file-only"`), `LOOKS`, each to its one line; `nameOf(id)` (`"full episode"`, as she reads it) and `idOf(name)`; `defaultPreset(kind, part) → { job, captions, look }`, in ids; `presetFault(preset) → ""` or words; `FACES`; `faceOnThisMac(fileNames) → { face, told }`; `captionLook({ style, job, frame, face }) → { draws: false, told }` or `{ draws: true, caps, lines, most, chars, fontSize, shadow, alignment, position, told }`; `titleLook("hook" | "name", { style, frame, face }) → { template, caps, lines: [{ fontSize, shadow, alignment? }], chars?, position, told }`; `placeOf("full" | "corner" | "lower" | "logo", { frame, picture }) → { position, scale, fill }`; `LOOK_PRESETS` (empty until C9), `LOOK_MIX`, `lookFor({ look, height, hdr }, presets?) → { effect, told }`, HDR checked first.

- [ ] **Step 1: Write the failing tests**

`tool/tests/styles.test.js`:

```js
// The looks of words and pictures until The BRIMM's templates exist: the preset's lists, the stand-in face, the captions'
// and titles' looks, and where a picture goes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JOBS, CAPTION_STYLES, LOOKS, defaultPreset, presetFault, faceOnThisMac, captionLook, titleLook, placeOf, lookFor, LOOK_MIX } from "../styles.js";

const UPRIGHT = { width: 1080, height: 1920 };
const WIDE = { width: 1920, height: 1080 };

describe("the preset's lists", () => {
  it("are the research's five jobs, five caption styles and four looks", () => {
    assert.deepEqual(Object.keys(JOBS), ["full-episode", "solo-clip", "interview-clip", "teaching-clip", "as-filmed"]);
    assert.deepEqual(Object.keys(CAPTION_STYLES), ["file-only", "plain", "boxed", "bold", "signature"]);
    assert.deepEqual(Object.keys(LOOKS), ["natural", "bright", "warm", "moody"]);
  });
  it("give an episode's main video the full episode, a short video as filmed, and a Reel a solo clip", () => {
    assert.deepEqual(defaultPreset("episode", "main"), { job: "full-episode", captions: "file-only", look: "natural" });
    assert.deepEqual(defaultPreset("short video", "main"), { job: "as-filmed", captions: "plain", look: "natural" });
    assert.deepEqual(defaultPreset("episode", { reel: 2 }), { job: "solo-clip", captions: "plain", look: "natural" });
  });
  it("say which word is not on its list, and what is", () => {
    assert.equal(presetFault({ job: "solo-clip", captions: "plain", look: "natural" }), "");
    assert.equal(presetFault({ job: "solo-clip", captions: "fancy", look: "natural" }), '"fancy" is not a caption style. The caption styles are: file only, plain, boxed, bold, signature.');
  });
});

describe("the stand-in face", () => {
  it("is Varela when its file is in a font folder, and Lucida Grande otherwise, said", () => {
    assert.deepEqual(faceOnThisMac(["Avenir.ttc", "Varela-Regular.ttf"]), { face: "Varela", told: "" });
    assert.deepEqual(faceOnThisMac(["VarelaRound-Regular.ttf", "LucidaGrande.ttc"]), { face: "Lucida Grande", told: "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book." });
  });
});

describe("the running captions' look", () => {
  it("is Plain upright: capitals 2.5% of the height, one line of 19 characters in Varela, 4 words at most, 65% down", () => {
    assert.deepEqual(captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" }), { draws: true, caps: false, lines: 1, most: 4, chars: 19, fontSize: 69, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center", position: "0 -12.84", told: "" });
  });
  it("is Bold in capitals on two lines upright", () => {
    const bold = captionLook({ style: "bold", job: "solo-clip", frame: UPRIGHT, face: "Lucida Grande" });
    assert.deepEqual([bold.caps, bold.lines, bold.chars, bold.fontSize], [true, 2, 9, 94]);
  });
  it("draws none on a wide full episode, and says so when a drawn style was picked (rule 9)", () => {
    assert.deepEqual(captionLook({ style: "file-only", job: "full-episode", frame: WIDE, face: "Varela" }), { draws: false, told: "" });
    assert.deepEqual(captionLook({ style: "bold", job: "full-episode", frame: WIDE, face: "Varela" }), { draws: false, told: "Bold was picked, but a full episode goes to YouTube with its caption file, so no captions are drawn into the picture." });
  });
  it("draws Plain for file only where no caption file is taken (rule 2), for Boxed until its box, and for Signature without its fade", () => {
    assert.equal(captionLook({ style: "file-only", job: "solo-clip", frame: UPRIGHT, face: "Varela" }).told, "File only was picked, but this goes where no caption file is taken, so Plain captions are drawn.");
    const boxed = captionLook({ style: "boxed", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([boxed.caps, boxed.chars, boxed.told], [false, 19, "Boxed's box is not drawn yet, so Plain captions are drawn."]);
    const signature = captionLook({ style: "signature", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([signature.caps, signature.chars, signature.told], [false, 19, "Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade."]);
  });
  it("draws a title Plain under Boxed and Signature, and says what is not drawn", () => {
    assert.equal(titleLook("hook", { style: "signature", frame: UPRIGHT, face: "Varela" }).told, "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain.");
    assert.equal(titleLook("name", { style: "boxed", frame: WIDE, face: "Varela" }).told, "Boxed's box behind a title is not drawn yet, so titles are drawn Plain.");
    assert.equal(titleLook("name", { style: "bold", frame: WIDE, face: "Varela" }).told, "");
  });
  it("is wide Plain for a wide short video: 8 words, the research's stored 42 characters whatever the face, 90% down", () => {
    const wide = captionLook({ style: "plain", job: "as-filmed", frame: WIDE, face: "Varela" });
    assert.deepEqual([wide.most, wide.chars, wide.fontSize, wide.position], [8, 42, 51, "0 -37.17"]);
    assert.equal(captionLook({ style: "plain", job: "as-filmed", frame: WIDE, face: "Lucida Grande" }).chars, 42);
  });
});

describe("a title's look", () => {
  it("puts a Reel's hook in the top band, two lines of 13 characters in Varela", () => {
    assert.deepEqual(titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }), { template: "title", caps: false, lines: [{ fontSize: 96, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center" }, { fontSize: 96, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center" }], chars: 13, position: "0 27.5", told: "" });
  });
  it("puts a name over a role in the top band upright, and on the Basic Lower Third wide", () => {
    const up = titleLook("name", { style: "plain", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([up.template, up.lines.map((l) => l.fontSize), up.position], ["title", [69, 52], "0 27.5"]);
    const wide = titleLook("name", { style: "bold", frame: WIDE, face: "Varela" });
    assert.deepEqual([wide.template, wide.caps, wide.lines.map((l) => l.fontSize), wide.position], ["lower-third", true, [51, 39], "0 0"]);
    // The lower third's lines keep its own place at the left: none is centred.
    assert.deepEqual(wide.lines.map((l) => l.alignment), [undefined, undefined]);
    assert.deepEqual(up.lines.map((l) => l.alignment), ["center", "center"]);
  });
});

describe("where a picture goes", () => {
  const chart = { width: 1600, height: 900 };
  it("fills the frame when full", () => {
    assert.deepEqual(placeOf("full", { frame: UPRIGHT, picture: chart }), { position: "0 0", scale: 1, fill: true });
  });
  it("is half the fitted size in the top right corner", () => {
    assert.deepEqual(placeOf("corner", { frame: WIDE, picture: chart }), { position: "39.11 20", scale: 0.5, fill: false });
  });
  it("is the logo at 15% of an upright frame's width, top right, 15% down and 6% in", () => {
    assert.deepEqual(placeOf("logo", { frame: UPRIGHT, picture: { width: 600, height: 300 } }), { position: "20.53 32.89", scale: 0.15, fill: false });
  });
  it("is fitted into the lower third, its lowest edge 85% down when wide", () => {
    assert.deepEqual(placeOf("lower", { frame: WIDE, picture: chart }), { position: "0 -25", scale: 0.2, fill: false });
  });
});

describe("a look", () => {
  const PRESETS = { moody: { name: "Warmer Vintage with Dark Blacks", uid: "uid.moody", mixKey: "9999/1" } };
  it("is nothing for natural, and Final Cut's preset with its Mix for one Jason's check has given", () => {
    assert.deepEqual(lookFor({ look: "natural", height: 1080 }, PRESETS), { effect: null, told: "" });
    assert.deepEqual(lookFor({ look: "moody", height: 1080 }, PRESETS), { effect: { name: "Warmer Vintage with Dark Blacks", uid: "uid.moody", params: [{ name: "Mix", key: "9999/1", value: "0.5" }] }, told: "" });
  });
  it("is weaker on a small recording (rule 6), none on HDR (rule 7), and recorded only until its preset is known", () => {
    assert.deepEqual(lookFor({ look: "moody", height: 720 }, PRESETS).effect.params[0].value, "0.375");
    assert.deepEqual(lookFor({ look: "moody", height: 360 }, PRESETS).told, "Moody was applied at 50% strength: the recording has 360 lines.");
    assert.deepEqual(lookFor({ look: "moody", height: 2160, hdr: true }, PRESETS), { effect: null, told: "This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked. Moody was not applied: its colours are made for ordinary video." });
    assert.deepEqual(lookFor({ look: "natural", height: 2160, hdr: true }, PRESETS), { effect: null, told: "This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked." });
    assert.deepEqual(lookFor({ look: "bright", height: 1080 }, PRESETS), { effect: null, told: "Bright is recorded. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one." });
    assert.deepEqual(LOOK_MIX.bright, ["Clean Whites with Lifted Blacks", 0.25]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/styles.test.js`
Expected: FAIL: `styles.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/styles.js`:

```js
// How words and pictures look on a timeline until The BRIMM's own templates exist (spec section 4, "What brimm-video writes
// for Final Cut"; phase 6 makes the templates). It holds the three lists a preset is picked from (the job, the caption
// style and the look, docs/research/2026-10-13-video-presets/presets.md, Part 2), the stand-in typeface, the look of the
// running captions and of the titles in a wide or an upright frame, and where a picture goes. Final Cut's built-in titles
// are used, and every one names its font and size: a built-in title given words only comes back Helvetica 6 (phase 0, B1).
// Every size and place here is the research's starting value, or a guess where it says so, to be judged by eye.
// Nothing here touches a disk or runs a program.

/** The jobs: what a video is and where it goes, with the caption style and look it takes unless others are picked. Each is
    kept in the record by its id, as the spec's record has them ("full-episode"), and named to a person with spaces. */
export const JOBS = {
  "full-episode": { says: "The whole show, wide. Calm cuts, no captions drawn on the picture", goes: ["YouTube"], captions: "file-only", look: "natural" },
  "solo-clip": { says: "A short upright clip of Sallie alone", goes: ["Reels", "Shorts", "Stories", "LinkedIn"], captions: "plain", look: "natural" },
  "interview-clip": { says: "A short upright clip cut from an interview", goes: ["Reels", "Shorts", "LinkedIn"], captions: "plain", look: "natural" },
  "teaching-clip": { says: "An upright clip of a framework or a list", goes: ["Reels", "Shorts", "LinkedIn"], captions: "plain", look: "natural" },
  "as-filmed": { says: "A quick thought, trimmed. Nothing added but captions", goes: ["Stories", "LinkedIn"], captions: "plain", look: "natural" }
};
/** The caption styles: how words in the picture look. */
export const CAPTION_STYLES = {
  "file-only": "No words drawn. The caption file only",
  plain: "Small white words, two to four at a time, soft shadow",
  boxed: "The same words in navy on a mist box",
  bold: "Big white capitals, two to four words on two lines",
  signature: "The brand's headline: spaced capitals on a navy block"
};
/** The looks: the colour of the picture, applied as Final Cut's own Color Grading Preset with its Mix once by-hand check 2 has
    given each preset's uid and Mix key (LOOK_PRESETS), and recorded until then. */
export const LOOKS = {
  natural: "No change",
  bright: "A little lighter, softer in contrast",
  warm: "A touch warmer, slightly darker corners",
  moody: "A little darker, warmer and less colourful. It goes against the brand guide"
};

/** A job's, a caption style's or a look's name for a person: its id with spaces ("full episode"). */
export const nameOf = (id) => String(id).replace(/-/g, " ");
/** The id of what a person names, either way: "Full episode" and "full-episode" are both "full-episode". */
export const idOf = (said) => String(said ?? "").trim().toLowerCase().replace(/\s+/g, "-");

/** The preset a timeline has until one is picked: a wide episode's main video is the full episode; a short video's is as
    filmed; a Reel is a solo clip. Each with its job's own caption style and look. */
export function defaultPreset(kind, part) {
  const job = part !== "main" ? "solo-clip" : kind === "short video" ? "as-filmed" : "full-episode";
  return { job, captions: JOBS[job].captions, look: JOBS[job].look };
}

/** What is wrong with a preset, in plain words: "" when each of its three is one of its list's. */
export function presetFault(preset) {
  const named = (list, what, value) => (value in list ? "" : `"${nameOf(value)}" is not a ${what}. The ${what}s are: ${Object.keys(list).map(nameOf).join(", ")}.`);
  return named(JOBS, "job", preset.job) || named(CAPTION_STYLES, "caption style", preset.captions) || named(LOOKS, "look", preset.look);
}

/** The stand-in typefaces, in the order they are tried until the brand's own are bought: Varela, then Lucida Grande, which is
    on every Mac (spec section 4). `cap` is how tall a capital is, as a share of the font size: Varela's by the brand guide's
    PDF record, Lucida Grande's a guess. `fits` is how many characters of sentence case fit a line where Sweet Sans Pro fits
    18 (the research's count for Plain, upright), by each face's width against it. */
export const FACES = {
  Varela: { file: /^Varela-Regular\.(ttf|otf)$/i, cap: 0.698, width: 0.93 },
  "Lucida Grande": { file: /^LucidaGrande\.ttc$/i, cap: 0.716, width: 0.92 }
};

/** The face to draw in, of the files in this Mac's font folders (their names): Varela when its file is there, and otherwise
    Lucida Grande, with what the person is told then. The Mac does not say when a face is missing: Final Cut draws another
    without a word, so the files are looked for. */
export function faceOnThisMac(names) {
  if (names.some((n) => FACES.Varela.file.test(n))) return { face: "Varela", told: "" };
  return { face: "Lucida Grande", told: "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book." };
}

/** Is a frame upright? */
const upright = (frame) => frame.height > frame.width;
/** The font size that gives capitals of `share` of the frame's height, in the face. Final Cut's sizes are taken to be pixels of
    the frame: phase 4's by-hand check 1 says whether they are. */
const sizeFor = (share, frame, face) => Math.round((share * frame.height) / FACES[face].cap);
/** How much taller than its font size a line is, a guess for both faces. */
const LINE_STEP = 1.2;
/** A title's move, so that its lines' lowest edge is `edge` of the frame's height down: Final Cut's position, "x y", in
    hundredths of the frame's height from its middle, with y up (phase 0, B1). A Basic Title's lines sit around the middle. */
const placed = (edge, lines, fontSize, frame, x = 0) => {
  const middle = edge - (lines * fontSize * LINE_STEP) / 2 / frame.height;
  return `${round(x)} ${round((0.5 - middle) * 100)}`;
};
const round = (n) => Math.round(n * 100) / 100 || 0;
/** The soft shadow of Plain and Bold: black at 65%, blurred half a percent of the frame's height, with no offset. */
const shadowFor = (frame) => ({ color: "0 0 0 0.65", blur: Math.round(0.005 * frame.height) });

/** How the running captions of a timeline look, for its preset's caption style and job, in its frame and face:
    { draws: false, told } when none are drawn, or { draws: true, caps, lines, most, chars, fontSize, shadow, position,
    told }, where `most` is the words a caption holds at most and `chars` the characters a line holds. Three of the
    research's rules are applied here, and each is told:
    - a wide full episode goes to YouTube with its caption file, so no running captions are drawn into it (rule 9);
    - "file only" on a timeline that goes where no caption file is taken draws Plain (rule 2);
    - Boxed's mist box is Final Cut's own Subtitle title, whose settings an export made by hand will give (not yet asked
      for): until then Boxed's captions are Plain. Signature's running captions are Plain words that fade in line by line,
      and no fade is written yet: they are Plain without it (the research, T1). Bold is drawn in its capitals, without the
      box on its stressed word (that needs a template). */
export function captionLook({ style, job, frame, face }) {
  const wide = !upright(frame);
  if (wide && job === "full-episode") return { draws: false, told: style === "file-only" ? "" : `${capitalOf(nameOf(style))} was picked, but a full episode goes to YouTube with its caption file, so no captions are drawn into the picture.` };
  let told = "";
  let drawn = style;
  if (style === "file-only") {
    drawn = "plain";
    told = "File only was picked, but this goes where no caption file is taken, so Plain captions are drawn.";
  } else if (style === "boxed") {
    drawn = "plain";
    told = "Boxed's box is not drawn yet, so Plain captions are drawn.";
  } else if (style === "signature") {
    drawn = "plain";
    told = "Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade.";
  }
  const bold = drawn === "bold";
  const share = bold ? (wide ? 0.045 : 0.035) : wide ? 0.033 : 0.025;
  const fontSize = sizeFor(share, frame, face);
  const lines = bold && !wide ? 2 : 1;
  // How many characters a line holds. Wide, the research stores a caption standard's count, not a fit: 42 for Plain, 20 for
  // Bold. Upright it is a fit: Sweet Sans Pro's 18 for Plain and 9 capitals for Bold, by the face's width against it.
  const chars = wide ? (bold ? 20 : 42) : Math.floor((bold ? 9 : 18) / FACES[face].width);
  return { draws: true, caps: bold, lines, most: wide && !bold ? 8 : bold && wide ? 3 : 4, chars, fontSize, shadow: shadowFor(frame), alignment: "center", position: placed(wide ? 0.9 : 0.65, lines, fontSize, frame), told };
}

const capitalOf = (words) => words[0].toUpperCase() + words.slice(1);

/** How a title looks, by its kind, for the caption style, in the frame and face. Every title is white with the soft shadow,
    and its style's case (Bold's in capitals). Boxed's box and Signature's navy block behind a title are not drawn yet: such a
    title is drawn Plain, and `told` says so.
    - "hook": a Reel's title on screen, in the top band (15% to 30% down when upright, 8% to 25% when wide), capitals 3.5% of
      the height upright and 4.5% wide, two lines at most;
    - "name": a name over a role. Upright, in the top band, as a Basic Title of two lines, capitals 2.5% and 1.9%; wide, on
      Final Cut's Basic Lower Third, at its own place and alignment, capitals 3.3% and 2.5% (by-hand check 1).
    Gives { template, caps, lines: [{ fontSize, shadow }], chars, position, told }: `chars` is what a hook's line holds. */
export function titleLook(kind, { style, frame, face }) {
  const wide = !upright(frame);
  const caps = style === "bold";
  const shadow = shadowFor(frame);
  const told = style === "boxed" ? "Boxed's box behind a title is not drawn yet, so titles are drawn Plain." : style === "signature" ? "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain." : "";
  if (kind === "hook") {
    const fontSize = sizeFor(wide ? 0.045 : 0.035, frame, face);
    const band = wide ? [0.08, 0.25] : [0.15, 0.3];
    const chars = Math.floor((caps ? 10 : 13) / FACES[face].width);
    return { template: "title", caps, lines: [{ fontSize, shadow, alignment: "center" }, { fontSize, shadow, alignment: "center" }], chars, position: `0 ${round((0.5 - (band[0] + band[1]) / 2) * 100)}`, told };
  }
  const [name, role] = wide ? [0.033, 0.025] : [0.025, 0.019];
  // The Basic Lower Third places its lines at the left by its own params (phase 0, B1's export): its lines name no alignment,
  // so none of them is centred off the frame's edge. A Basic Title's lines are centred.
  const lines = [{ fontSize: sizeFor(name, frame, face), shadow }, { fontSize: sizeFor(role, frame, face), shadow }];
  if (wide) return { template: "lower-third", caps, lines, position: "0 0", told };
  return { template: "title", caps, lines: lines.map((l) => ({ ...l, alignment: "center" })), position: `0 ${round((0.5 - 0.225) * 100)}`, told };
}

/** Where a picture goes, and how big, by its place: Final Cut's { position, scale, fill } for a still. Final Cut fits a still
    into the frame unless told to fill it (by-hand check 3), so a scale is of the fitted picture.
    - "full" fills the frame: a picture of another shape loses its edges;
    - "corner": a quarter of the frame (half its width and height, as fitted), in the brand kit's corner, top right, and
      upright below the top band, where a Reel's title and a name title sit;
    - "lower": the lower third, fitted into a box 60% of the frame's width and 20% of its height, its lowest edge 85% down
      when wide, and 60% when upright, above the captions (a guess);
    - "logo": the brand kit's logo, top right: 15% of the width, its top edge 15% down and 6% in from the side upright; 8%,
      5% and 3% wide (the research's K3).
    `picture` is its size in pixels. */
export function placeOf(place, { frame, picture }) {
  const fit = Math.min(frame.width / picture.width, frame.height / picture.height);
  const shown = { width: picture.width * fit, height: picture.height * fit };
  const at = (x, y) => `${round((x / frame.height) * 100)} ${round((y / frame.height) * 100)}`;
  if (place === "full") return { position: "0 0", scale: 1, fill: true };
  if (place === "lower") {
    const box = { width: 0.6 * frame.width, height: 0.2 * frame.height };
    const scale = Math.min(box.width / shown.width, box.height / shown.height);
    const bottom = (upright(frame) ? 0.6 : 0.85) * frame.height;
    return { position: at(0, frame.height / 2 - (bottom - (shown.height * scale) / 2)), scale: round3(scale), fill: false };
  }
  // Upright, a corner picture starts below the top band (15% to 30% down), where a Reel's title and a name title sit.
  const corner = place === "logo" ? (upright(frame) ? { width: 0.15, top: 0.15, side: 0.06 } : { width: 0.08, top: 0.05, side: 0.03 }) : { width: 0.5, top: upright(frame) ? 0.31 : 0.05, side: upright(frame) ? 0.06 : 0.03 };
  const scale = place === "logo" ? (corner.width * frame.width) / shown.width : 0.5;
  const w = shown.width * scale;
  const h = shown.height * scale;
  const x = frame.width / 2 - corner.side * frame.width - w / 2;
  const y = frame.height / 2 - (corner.top * frame.height + h / 2);
  return { position: at(x, y), scale: round3(scale), fill: false };
}
const round3 = (n) => Math.round(n * 1000) / 1000;

/** Final Cut's own colour preset for each look with a recipe, as Final Cut writes it in an export: its name, its uid, and the
    key of its Mix, read off an export by phase 4's by-hand check 2. A look with no entry here is recorded, and not applied
    yet. */
export const LOOK_PRESETS = {};
/** Each look's preset and its Mix at full strength (the research's E4: the names were read in Final Cut's folders). */
export const LOOK_MIX = { bright: ["Clean Whites with Lifted Blacks", 0.25], warm: ["Warm Dusk with Low Contrast", 0.25], moody: ["Warmer Vintage with Dark Blacks", 0.5] };

/** The look on a timeline, as the Final Cut writer takes it: { effect, told }, `effect` null when nothing is applied.
    Natural changes nothing. Rule 7: an HDR recording gets no look, and is said, Natural too. Rule 6: under 1080 lines a look is applied at 75%, and
    under 720 at 50%. A look whose preset is not known yet (LOOK_PRESETS) is recorded only, and said. `presets` is the
    table, for a test to give another. */
export function lookFor({ look, height, hdr }, presets = LOOK_PRESETS) {
  const named = capitalOf(look);
  if (hdr) return { effect: null, told: `This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked.${look === "natural" ? "" : ` ${named} was not applied: its colours are made for ordinary video.`}` };
  if (look === "natural") return { effect: null, told: "" };
  const known = presets[look];
  if (!known) return { effect: null, told: `${named} is recorded. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one.` };
  const share = height < 720 ? 0.5 : height < 1080 ? 0.75 : 1;
  const mix = Math.round(LOOK_MIX[look][1] * share * 1000) / 1000;
  return { effect: { name: known.name, uid: known.uid, params: [{ name: "Mix", key: known.mixKey, value: String(mix) }] }, told: share < 1 ? `${named} was applied at ${share * 100}% strength: the recording has ${height} lines.` : "" };
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/styles.js tool/tests/styles.test.js
git commit -m "The preset's lists, the stand-in face, and how captions, titles, pictures and looks are set until the templates exist"
```

---

## Task C3: The running captions

**Files:**
- Create: `tool/captions.js`, `tool/tests/captions.test.js`

**Interfaces:**
- Consumes: `captionLook` (C2) and `heardWords` (C6), in the tests only; `wordsOf`, `pausesOf`, `phrasesOf` (`cuts.js`) and `TOLD`, `PAUSES` (`tests/fixtures.js`), the made-up recording.
- Produces: `SHORTEST = 0.83`, `FASTEST = 20`, `captionsFor({ words, ranges, look }) → { captions: [{ start, end, lines, scale }], told }`, times in seconds of the raw video. Its `words` start when they are said (C6 `heardWords`), so a caption after a pause starts on the pause's end, and rule 4 holds a caption into the pause after it.

- [ ] **Step 1: Write the failing tests**

`tool/tests/captions.test.js`:

```js
// The running captions of a timeline: its kept words, grouped and fitted as a caption style says, never over a join, and
// shown long enough to read (the research's rules 1 and 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf } from "../cuts.js";
import { heardWords } from "../clock.js";
import { captionsFor, SHORTEST, FASTEST } from "../captions.js";
import { captionLook } from "../styles.js";
import { TOLD, PAUSES } from "./fixtures.js";

/** The made-up recording's words, each from when it is said (clock.js heardWords), as a push gives them. */
const RAW = wordsOf(TOLD);
const WORDS = heardWords(RAW, phrasesOf(RAW, pausesOf(PAUSES)));
/** The main video's kept pieces in the made-up recording, as its cut plan gives them. */
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const UPRIGHT = { width: 1080, height: 1920 };
const PLAIN = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
const BOLD = captionLook({ style: "bold", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
const said = (made) => made.captions.map((c) => [c.start, c.end, c.lines.join(" / ")]);

describe("the running captions", () => {
  it("are the kept words, a sentence at a time, in the fewest and most even captions that fit Plain's line of 19", () => {
    const made = captionsFor({ words: WORDS, ranges: MAIN, look: PLAIN });
    assert.deepEqual(said(made), [
      [6.07, 6.58, "Welcome to"], [6.58, 7.04, "the show."],
      [7.04, 7.98, "Today we are"], [7.98, 8.72, "going to talk"], [8.72, 9.55, "about pricing."],
      [13.583, 14.42, "So the first thing"], [14.42, 15.12, "you need to do"], [15.12, 16.2, "is know your costs."],
      [19.414, 19.94, "Thank you so"], [19.94, 20.94, "much, Sallie."]
    ]);
    assert.deepEqual(made.told, ["2 captions were split to fit the line.", "5 captions still show for under 0.83 s, and 3 still run faster than 20 characters a second."]);
  });
  it("start a piece's first words when they are said, at the end of the pause before them, not where the word before them ended", () => {
    assert.equal(RAW.find((w) => w.w === "Welcome" && w.end > 6).start, 4.78);
    assert.equal(captionsFor({ words: WORDS, ranges: MAIN, look: PLAIN }).captions[0].start, 6.07);
  });
  it("never runs a caption over a join: a sentence cut in two is two captions", () => {
    const made = captionsFor({ words: WORDS, ranges: [{ start: 5.87, end: 8.0 }, { start: 8.2, end: 9.838 }], look: PLAIN });
    assert.ok(made.captions.every((c) => c.end <= 8.0 || c.start >= 8.2), JSON.stringify(said(made)));
    assert.deepEqual(said(made).slice(2), [[7.04, 7.98, "Today we are"], [8.2, 8.72, "going to talk"], [8.72, 9.55, "about pricing."]]);
  });
  it("puts Bold in capitals on two lines", () => {
    assert.deepEqual(said(captionsFor({ words: WORDS, ranges: [MAIN[1]], look: BOLD })).slice(0, 2), [[13.583, 14.2, "SO THE / FIRST"], [14.2, 14.8, "THING / YOU NEED"]]);
  });
  it("draws a single word too wide for the line smaller, and says by how much", () => {
    const made = captionsFor({ words: [{ w: "Entrepreneurship.", start: 1, end: 2 }], ranges: [{ start: 0, end: 3 }], look: { ...PLAIN, chars: 12 } });
    assert.deepEqual(made.captions, [{ start: 1, end: 2, lines: ["Entrepreneurship."], scale: 0.71 }]);
    assert.deepEqual(made.told, ["1 single word was drawn smaller, the smallest at 71% of the style's size."]);
  });
  it("holds a short caption into the pause ffmpeg heard after it, inside one stretch of speech", () => {
    // The transcriber starts "Then" where "this." ended; the phrases put it after the pause, so the caption before it is held.
    const raw = [{ w: "Know", start: 1, end: 1.3 }, { w: "this.", start: 1.3, end: 1.5 }, { w: "Then", start: 1.5, end: 3.3 }, { w: "act.", start: 3.3, end: 3.6 }];
    const words = heardWords(raw, [{ id: "p1", start: 1, end: 1.5 }, { id: "p2", start: 3, end: 3.6 }]);
    assert.deepEqual(said(captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: PLAIN })), [[1, 1.83, "Know this."], [3, 3.83, "Then act."]]);
    assert.deepEqual(said(captionsFor({ words: raw, ranges: [{ start: 0, end: 4 }], look: PLAIN }))[0], [1, 1.5, "Know this."]);
  });
  it("holds a caption too short to read into the pause after it (rule 4), up to the next word", () => {
    const words = [{ w: "Know", start: 1, end: 1.3 }, { w: "this.", start: 1.3, end: 1.6 }, { w: "Then", start: 3, end: 3.3 }, { w: "act.", start: 3.3, end: 3.5 }];
    assert.deepEqual(said(captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: PLAIN })), [[1, 1.83, "Know this."], [3, 3.83, "Then act."]]);
    assert.equal(SHORTEST, 0.83);
    assert.equal(FASTEST, 20);
  });
  it("leaves a short caption inside a sentence as it is, and counts it", () => {
    const words = ["So", "we", "will", "talk"].map((w, i) => ({ w, start: 1 + i * 0.2, end: 1.2 + i * 0.2 }));
    const made = captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: { ...PLAIN, most: 2 } });
    assert.deepEqual(said(made), [[1, 1.4, "So we"], [1.4, 2.23, "will talk"]]);
    assert.deepEqual(made.told, ["1 caption still shows for under 0.83 s, and 0 still run faster than 20 characters a second."]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/captions.test.js`
Expected: FAIL: `captions.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/captions.js`:

```js
// The running captions drawn on a timeline (phase 4): its kept words, grouped two to four at a time as a caption style says,
// each caption fitted to the style's line and kept on screen long enough to read. The research's rules 1 and 4
// (docs/research/2026-10-13-video-presets/presets.md, 2.4) are applied here, and what they did is told.
// Nothing here touches a disk or runs a program.

/** A caption shows for at least this long, in seconds, and needs reading no faster than this many characters a second. */
export const SHORTEST = 0.83;
export const FASTEST = 20;
/** A gap this long between two words is taken as a pause, where a caption may end. The words file holds no pauses, and its
    times are off by a tenth to a third of a second, so this is a guess. */
const PAUSE = 0.25;

/** Does this word end a sentence? Words that trail off ("So the...") do not. */
const endsSentence = (w) => /[.?!]["'”’)\]]*$/.test(w) && !/(?:\.\.\.|…)["'”’)\]]*$/.test(w);
const round = (n) => Math.round(n * 1000) / 1000;

/** The words of `list` on as many lines as the look allows, each no longer than its `chars`: the lines, or null when they do
    not fit. Two lines are split where the longer of them is shortest. */
function linesOf(list, look) {
  const text = list.join(" ");
  if (text.length <= look.chars) return [text];
  if (look.lines < 2 || list.length < 2) return null;
  let best = null;
  for (let i = 1; i < list.length; i++) {
    const pair = [list.slice(0, i).join(" "), list.slice(i).join(" ")];
    if (pair.every((line) => line.length <= look.chars) && (!best || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length)))) best = pair;
  }
  return best;
}

/** The captions of a timeline: `words` are the recording's words, each {w, start, end} in seconds of the raw video, spelled
    as the episode's spellings say; `ranges` are the kept pieces, in order, each {start, end}; `look` is captionLook's. Gives
    { captions: [{ start, end, lines, scale }], told }, each caption in seconds of the raw video. A word belongs to the piece
    it ends in: its end is when it was said, and its start is only where the word before it ended (cuts.js wordsOf), so a
    piece's first word may start in what was cut before it. A caption never runs over a join: it shows only what is seen together. A caption ends at a
    sentence's end or a pause, and holds `look.most` words at most.
    Rule 1: a caption wider than the style's line is split at a word, or put on two lines when the style allows two; a single
    word still too wide is drawn smaller (`scale` under 1). Rule 4: a caption shown for under SHORTEST seconds, or read faster
    than FASTEST characters a second, is held into the pause after it, up to the next word; inside a sentence there is none,
    and it stays. (The research's rule also joins it to the next when the two fit: grouped in the fewest captions that fit,
    two that would fit together are one already.) */
export function captionsFor({ words, ranges, look }) {
  const captions = [];
  let split = 0;
  const smaller = [];
  for (const range of ranges) {
    const mine = words
      .filter((w) => w.end > range.start && w.end <= range.end)
      .map((w) => ({ w: look.caps ? w.w.toLocaleUpperCase("en") : w.w, start: Math.max(w.start, range.start), end: Math.min(w.end, range.end) }));
    // The runs: where a sentence ends or there is a pause, a caption may end.
    const runs = [];
    for (const [i, word] of mine.entries()) {
      if (!runs.length || endsSentence(mine[i - 1].w) || word.start - mine[i - 1].end >= PAUSE) runs.push([]);
      runs[runs.length - 1].push(word);
    }
    for (const run of runs) {
      // The fewest captions the run can be shown in, each of `most` words at most and fitting the line, and of those the
      // most even: so a sentence of four words too wide for one line is two and two, not three and one. A single word too
      // wide for the line is a caption of its own, drawn smaller.
      const best = [{ count: 0, longest: 0, cut: -1 }];
      for (let i = 1; i <= run.length; i++) {
        for (let j = Math.max(0, i - look.most); j < i; j++) {
          const list = run.slice(j, i);
          const lines = linesOf(list.map((x) => x.w), look);
          if (!lines && list.length > 1) continue;
          const length = list.map((x) => x.w).join(" ").length;
          const tried = { count: best[j].count + 1, longest: Math.max(best[j].longest, lines ? length : 0), cut: j };
          if (!best[i] || tried.count < best[i].count || (tried.count === best[i].count && tried.longest < best[i].longest)) best[i] = tried;
        }
      }
      const made = [];
      for (let i = run.length; i > 0; i = best[i].cut) made.unshift(run.slice(best[i].cut, i));
      split += made.length - Math.ceil(run.length / look.most);
      // Rule 4: a caption too short, or too quick to read, is held into the pause after it. It cannot be joined to the next:
      // the run is already in the fewest captions that fit, so two that fit together are one already.
      const read = (list) => ({ start: list[0].start, end: list[list.length - 1].end, chars: list.map((x) => x.w).join(" ").length });
      const after = (list) => {
        const at = mine.indexOf(list[list.length - 1]);
        return at + 1 < mine.length ? mine[at + 1].start : range.end;
      };
      for (const list of made) {
        const { start, end, chars } = read(list);
        const wanted = start + Math.max(SHORTEST, chars / FASTEST);
        const held = end < wanted ? Math.min(wanted, after(list)) : end;
        const lines = linesOf(list.map((x) => x.w), look);
        const scale = lines ? 1 : Math.round((look.chars / list[0].w.length) * 100) / 100;
        if (!lines) smaller.push(scale);
        captions.push({ start: round(start), end: round(held), lines: lines || [list[0].w], scale });
      }
    }
  }
  const told = [];
  if (split || smaller.length) {
    const parts = [];
    if (split) parts.push(`${split} caption${split === 1 ? " was" : "s were"} split to fit the line.`);
    if (smaller.length) parts.push(`${smaller.length} single word${smaller.length === 1 ? " was" : "s were"} drawn smaller, the smallest at ${Math.round(Math.min(...smaller) * 100)}% of the style's size.`);
    told.push(parts.join(" "));
  }
  const short = captions.filter((c) => c.end - c.start < SHORTEST - 0.0005).length;
  const fast = captions.filter((c) => c.lines.join(" ").length / (c.end - c.start) > FASTEST).length;
  if (short || fast) told.push(`${short} caption${short === 1 ? "" : "s"} still show${short === 1 ? "s" : ""} for under ${SHORTEST} s, and ${fast} still run${fast === 1 ? "s" : ""} faster than ${FASTEST} characters a second.`);
  return { captions, told };
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/captions.js tool/tests/captions.test.js
git commit -m "The running captions: kept words in the fewest, most even captions that fit, never over a join"
```

---

## Task C4: Spellings

**Files:**
- Create: `tool/spelling.js`, `tool/tests/spelling.test.js`
- Modify: `tool/final-transcript.js` (`spelledPairs` split out of `spelled`; `spelledCaptions` exported)

**Interfaces:**
- Consumes: `spelled` (`final-transcript.js`: the show's own names first, then the episode's); `stampedText` (`lib.js`); `buildHandoff`, `handoffFault` (`handoff.js`), in the tests.
- Produces: in `final-transcript.js`, `spelledPairs(text, spellings)` (the episode's pairs alone), `spelled` (as before), and `spelledCaptions(srt, spellings, spell = spelled)`; in `spelling.js`, `spellingFault(heard, meant) → ""` or words (a curly apostrophe in the heard word is refused, since the transcriber writes a straight one, and so is a word the show's own names spell already, which a pair could never change); `withSpelling(spellings, heard, meant)`; `spellWords(words, spellings)`; `respelledPart({ srt, words }, spellings) → { srt, txt, words }`, which applies only the pairs it is given; `respelledHandoff(handoff, { srts, revision, made, madeOn, commit })`, which names this brimm-video in `madeBy`.

- [ ] **Step 1: Write the failing tests**

`tool/tests/spelling.test.js`:

```js
// The episode's own spellings: a word as the transcriber writes it, and as it is spelled, in the timelines' words and the
// final transcripts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spellingFault, withSpelling, spellWords, respelledPart, respelledHandoff } from "../spelling.js";
import { spelled } from "../final-transcript.js";
import { buildHandoff, handoffFault } from "../handoff.js";

const SALLIE = [["Sally", "Sallie"]];

describe("a spelling", () => {
  it("is one word as heard and one to four words as spelled, not the same", () => {
    assert.equal(spellingFault("Hormozy", "Hormozi"), "");
    assert.equal(spellingFault("Sally Ogden", "Sallie Ogden"), '"Sally Ogden" is not one word. Say the one word as the transcriber writes it.');
    assert.equal(spellingFault("Sally", ""), 'Say how "Sally" is spelled, in one to four words.');
    assert.equal(spellingFault("Sallie", "Sallie"), '"Sallie" is spelled that way already.');
  });
  it("is refused for a word the show's own names spell already, which it could never change", () => {
    assert.equal(spellingFault("Sally", "Sallie"), '"Sally" is spelled "Sallie" already: it is one of the show\'s own names.');
    assert.equal(spellingFault("Sally", "Sal"), '"Sally" is always written "Sallie", the show\'s own spelling. To spell it another way, give "Sallie" as the word heard.');
  });
  it("is kept once for each word as heard, the newest", () => {
    assert.deepEqual(withSpelling([["Sally", "Sally O"], ["Hormozy", "Hormozi"]], "Sally", "Sallie"), [["Hormozy", "Hormozi"], ["Sally", "Sallie"]]);
  });
  it("is applied to a words file's words, as written, with what is around it, and never inside a longer word", () => {
    assert.deepEqual(spellWords([{ w: "Sally.", start: 1, end: 2 }, { w: "Sally,", start: 2, end: 3 }, { w: "Sally's", start: 3, end: 4 }, { w: "Sallyport", start: 4, end: 5 }], SALLIE).map((w) => w.w), ["Sallie.", "Sallie,", "Sallie's", "Sallyport"]);
  });
  it("is one spelled() takes: every spelling accepted changes a text that has its word", () => {
    for (const [heard, meant] of [["Hormozy", "Hormozi"], ["O'Brien", "O’Brien"], ["co-op", "Co-op"], ["10", "ten"]]) {
      assert.equal(spellingFault(heard, meant), "", heard);
      assert.notEqual(spelled(`and ${heard} said`, [[heard, meant]]), `and ${heard} said`, heard);
    }
    assert.equal(spellingFault("O’Brien", "O'Brien"), `"O’Brien" has a curly apostrophe, and the transcriber writes a straight one ('): give it that way.`);
  });
});

describe("the final transcripts, spelled again", () => {
  it("spell the captions, make the transcript again from them, and spell the words, never a caption's number or times", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sally.\n\n";
    const made = respelledPart({ srt, words: JSON.stringify({ video: "a.mov", duration: 2, words: [{ w: "Sally.", start: 1, end: 2 }] }) }, SALLIE);
    assert.equal(made.srt, "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sallie.\n\n");
    assert.match(made.txt, /Thank you, Sallie\./);
    assert.deepEqual(JSON.parse(made.words).words, [{ w: "Sallie.", start: 1, end: 2 }]);
    assert.equal(respelledPart({ srt, words: null }, SALLIE).words, null);
  });
  it("make the hand-off again as the next revision, with each part's captions as spelled now, by this brimm-video", () => {
    const srt = (words) => `1\n00:00:01,000 --> 00:00:02,000\n${words}\n\n`;
    const record = { id: "e-20261014-3fa9c1", kind: "episode", name: { text: "Pricing talk" }, video: { recorded: "2026-10-14", recordedFrom: "video" }, title: { text: "Price like you mean it", approved: true }, reels: [{ n: 2, title: "Know your costs" }] };
    const handoff = buildHandoff({ record, revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "m.mov", seconds: 9, srt: srt("Sally.") }, reels: [{ n: 2, title: "Know your costs", file: "r.mov", seconds: 7, srt: srt("Sally.") }] });
    const next = respelledHandoff(handoff, { srts: { main: srt("Sallie."), "reel 2": srt("Sallie, yes.") }, revision: 2, made: "2026-10-21T09:00:00-05:00", madeOn: "Sallie's laptop", commit: "e72a170" });
    assert.deepEqual([next.revision, next.madeOn, next.madeBy, next.main.srt, next.reels[0].srt, next.reels[0].title], [2, "Sallie's laptop", "brimm-video e72a170", srt("Sallie."), srt("Sallie, yes."), "Know your costs"]);
    assert.equal(handoffFault(next), "");
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/spelling.test.js`
Expected: FAIL: `spelling.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/final-transcript.js` (the same on `main` and in PR 19):

```diff
--- a/tool/final-transcript.js
+++ b/tool/final-transcript.js
@@ -12,10 +12,10 @@
 const reasonOf = (ended) => (ended.signal ? `it was killed by ${ended.signal}` : lastLine(ended.stderr));
 const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
 
-/** A text with the show's names spelled the way they are spelled, and then the episode's own: each [wrong, right] pair is a
-    whole word, matched as it is written. A pair whose wrong word is not a word of letters and figures is passed over. */
-export function spelled(text, spellings = []) {
-  let out = spellNames(text);
+/** A text with the episode's own spellings: each [wrong, right] pair is a whole word, matched as it is written. A pair whose
+    wrong word is not a word of letters and figures is passed over. */
+export function spelledPairs(text, spellings = []) {
+  let out = String(text);
   for (const [wrong, right] of spellings) {
     if (!/^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u.test(String(wrong || ""))) continue;
     out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped(wrong)}(?![\\p{L}\\p{N}])`, "gu"), right);
@@ -23,14 +23,18 @@
   return out;
 }
 
+/** A text with the show's names spelled the way they are spelled, and then the episode's own (spelledPairs). */
+export const spelled = (text, spellings = []) => spelledPairs(spellNames(text), spellings);
+
 /** Captions with the spellings applied to their words alone: never to a caption's number or its times, so a spelling of a
-    figure ("10" as "ten") leaves "00:00:10,000" and caption 10 as they are. */
-function spelledCaptions(srt, spellings) {
+    figure ("10" as "ten") leaves "00:00:10,000" and caption 10 as they are. `spell` is how a line is spelled: the show's names
+    and the episode's (spelled), or the episode's pairs alone (spelledPairs). */
+export function spelledCaptions(srt, spellings, spell = spelled) {
   let words = false;
   return String(srt).split("\n").map((line) => {
     if (!line.trim()) words = false;
     else if (line.includes("-->")) words = true;
-    else if (words) return spelled(line, spellings);
+    else if (words) return spell(line, spellings);
     return line;
   }).join("\n");
 }
```

`tool/spelling.js`:

```js
// The episode's own spellings (spec section 4, `spell`): a word the transcriber writes one way, written as the person says it
// is spelled, "Sally" as "Sallie". They apply to every timeline's words and to the final transcripts, by the same rule the
// final transcript is spelled by (final-transcript.js `spelled`: the show's own names first, then the episode's, each a
// whole word matched as it is written).
// Nothing here touches a disk or runs a program.
import { spelled, spelledPairs, spelledCaptions } from "./final-transcript.js";
import { stampedText } from "./lib.js";

/** Why a spelling cannot be kept, in plain words: "" when it can. The word as heard is one word, of letters and figures with
    a straight apostrophe or a hyphen inside it, as the transcriber writes it and as `spelled` takes it, and not one the
    show's own names spell already; the spelling is one to four words on one line, and not the same. */
export function spellingFault(heard, meant) {
  const one = String(heard ?? "").trim();
  const written = String(meant ?? "").trim();
  if (one.includes("’")) return `"${one}" has a curly apostrophe, and the transcriber writes a straight one ('): give it that way.`;
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}'-]*[\p{L}\p{N}])?$/u.test(one)) return `"${one}" is not one word. Say the one word as the transcriber writes it.`;
  if (!written || /[\r\n]/.test(written) || written.split(/\s+/).length > 4) return `Say how "${one}" is spelled, in one to four words.`;
  if (written === one) return `"${one}" is spelled that way already.`;
  // The show's own names are spelled first (final-transcript.js spelled), so a pair for one of them would never be applied.
  const shows = spelled(one);
  if (shows !== one) return shows === written ? `"${one}" is spelled "${written}" already: it is one of the show's own names.` : `"${one}" is always written "${shows}", the show's own spelling. To spell it another way, give "${shows}" as the word heard.`;
  return "";
}

/** The spellings with one more, as the record keeps them: one for each word as heard, the newest kept, in the order given. */
export const withSpelling = (spellings, heard, meant) => [...spellings.filter(([h]) => h !== heard), [heard, meant]];

/** The words of a words file, each {w, start, end}, with the spellings applied to each. */
export const spellWords = (words, spellings = []) => words.map((word) => ({ ...word, w: spelled(word.w, spellings) }));

/** The final transcripts of one finished part with spellings added: its captions (.srt), its transcript (.transcript.txt,
    made again from the captions as finish makes it) and its words (.words.json, when it has one), each given and given back
    as text. Only the pairs given are applied: the show's own names and the episode's earlier spellings are in them already,
    from when they were made. */
export function respelledPart({ srt, words }, spellings) {
  const captions = spelledCaptions(srt, spellings, spelledPairs);
  const timed = words ? JSON.parse(words) : null;
  return { srt: captions, txt: stampedText(captions), words: timed ? JSON.stringify({ ...timed, words: timed.words.map((w) => ({ ...w, w: spelledPairs(w.w, spellings) })) }, null, 2) + "\n" : null };
}

/** The hand-off made again with each part's captions as they are spelled now, as the next revision, made now on this Mac by
    this brimm-video (`commit`). */
export const respelledHandoff = (handoff, { srts, revision, made, madeOn, commit }) => ({
  ...handoff,
  revision,
  made,
  madeOn,
  madeBy: `brimm-video ${commit}`,
  main: { ...handoff.main, srt: srts.main },
  reels: handoff.reels.map((r) => ({ ...r, srt: srts[`reel ${r.n}`] }))
});
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS: `spelled` gives what it gave before, so the finish's own tests are unchanged.

- [ ] **Step 5: Commit**

```bash
git add tool/spelling.js tool/tests/spelling.test.js tool/final-transcript.js
git commit -m "The episode's spellings, by the final transcript's own rule, on words, captions and the hand-off"
```

---

## Task C5: Pictures by name, their size as shown

**Files:**
- Create: `tool/pictures.js`, `tool/tests/pictures.test.js`
- Modify: `tool/tests/fixtures.js` (`jpegOf`, a phone's JPEG, which A4's tests use too)

**Interfaces:**
- Produces: `PICTURE_ENDINGS`; `pictureNameFault(name) → ""` or words; `pictureSize(bytes) → { width, height }` or null, as the picture is shown: a JPEG whose EXIF orientation is 5 to 8 (a phone's upright photo, stored on its side) has its width and height swapped. `bytes` is the whole file, since a JPEG's frame may come after large EXIF or XMP parts. In the tests, `jpegOf(width, height, { orientation, padding, little })`.

- [ ] **Step 1: Write the failing tests**

`tool/tests/fixtures.js` gains, at its end:

```diff
--- a/tool/tests/fixtures.js
+++ b/tool/tests/fixtures.js
@@ -78,3 +78,27 @@
 [Parsed_silencedetect_1 @ 0x7969040900] silence_start: 21.096688
 [Parsed_silencedetect_1 @ 0x7969040900] silence_end: 23.423 | silence_duration: 2.326313
 `;
+
+/** A phone's JPEG: an EXIF part saying its orientation, as an iPhone writes it (big-endian), then `padding` bytes of XMP
+    parts, then its frame. */
+export const jpegOf = (width, height, { orientation = 1, padding = 0, little = false } = {}) => {
+  const tiff = Buffer.alloc(26);
+  tiff.write(little ? "II" : "MM", 0, "ascii");
+  const u16 = (v, at) => (little ? tiff.writeUInt16LE(v, at) : tiff.writeUInt16BE(v, at));
+  const u32 = (v, at) => (little ? tiff.writeUInt32LE(v, at) : tiff.writeUInt32BE(v, at));
+  u16(42, 2);
+  u32(8, 4);
+  u16(1, 8);
+  u16(0x0112, 10);
+  u16(3, 12);
+  u32(1, 14);
+  u16(orientation, 18);
+  const exif = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
+  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
+  const xmp = [];
+  for (let left = padding; left > 0; left -= 60000) {
+    const body = Buffer.alloc(Math.min(left, 60000));
+    xmp.push(Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body);
+  }
+  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, ...xmp, Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03]), Buffer.alloc(9)]);
+};
```

`tool/tests/pictures.test.js`:

```js
// A picture's name and size: taken only by its name in the Pictures folder, its size read from its own bytes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pictureNameFault, pictureSize } from "../pictures.js";
import { jpegOf } from "./fixtures.js";

/** The first bytes of a PNG of a size: its signature, and its header. */
const png = (width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
};
/** The first bytes of a JPEG of a size: its start, an APP0 part, and a baseline frame. */
const jpeg = (width, height) => Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14),
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03]), Buffer.alloc(9)
]);

describe("a picture", () => {
  it("is taken by its name only, PNG or JPEG", () => {
    assert.equal(pictureNameFault("Pricing chart.png"), "");
    assert.equal(pictureNameFault("chart.JPG"), "");
    assert.equal(pictureNameFault("../.ssh/id_rsa.png"), '"../.ssh/id_rsa.png" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.');
    assert.equal(pictureNameFault(".hidden.png"), '".hidden.png" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.');
    assert.equal(pictureNameFault("notes.pdf"), '"notes.pdf" is not a PNG or a JPEG picture. Save it as one in the Pictures folder.');
    assert.equal(pictureNameFault(""), "Say the name of a picture in the Pictures folder.");
  });
  it("has its size read from a PNG's header or a JPEG's frame, and none from other bytes", () => {
    assert.deepEqual(pictureSize(png(1600, 900)), { width: 1600, height: 900 });
    assert.deepEqual(pictureSize(jpeg(1080, 1350)), { width: 1080, height: 1350 });
    assert.equal(pictureSize(Buffer.from("not a picture at all, just words")), null);
  });
  it("has a phone photo's size as it is shown: an EXIF orientation of 5 to 8 is a quarter turn", () => {
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 6 })), { width: 3024, height: 4032 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 8, little: true })), { width: 3024, height: 4032 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 3 })), { width: 4032, height: 3024 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024)), { width: 4032, height: 3024 });
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/pictures.test.js`
Expected: FAIL: `pictures.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/pictures.js`:

```js
// Pictures for graphics and the logo (spec section 4, `graphic` and `logo`): taken only by the name of a file in
// ~/BRIMM Video Studio/Pictures/, never by a path, so words in a transcript cannot make brimm-video copy another file into
// Dropbox. A picture's size is read from its own first bytes, with no program run.
// Nothing here touches a disk or runs a program.

/** The kinds of picture taken: PNG and JPEG, which Final Cut takes as stills. */
export const PICTURE_ENDINGS = [".png", ".jpg", ".jpeg"];

/** Why a name is not the name of a picture to take, in plain words: "" when it is. Only a name is taken: one with a slash
    in it, or one that starts with a dot, is refused, and so is one of another kind. */
export function pictureNameFault(name) {
  const said = String(name ?? "");
  if (!said.trim()) return "Say the name of a picture in the Pictures folder.";
  if (said.includes("/") || said.startsWith(".")) return `"${said}" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.`;
  if (!PICTURE_ENDINGS.some((e) => said.toLowerCase().endsWith(e))) return `"${said}" is not a PNG or a JPEG picture. Save it as one in the Pictures folder.`;
  return "";
}

/** A JPEG's EXIF orientation, from its APP1 part at `at`: null when the part is not EXIF (XMP is an APP1 part too), and 1 when
    it says none. A phone's upright photo is stored on its side and says 6 (or 8): it is shown turned. */
function orientationOf(bytes, at) {
  if (bytes.toString("ascii", at + 4, at + 10) !== "Exif\0\0") return null;
  const tiff = at + 10;
  const little = bytes.toString("ascii", tiff, tiff + 2) === "II";
  const u16 = (o) => (little ? bytes.readUInt16LE(o) : bytes.readUInt16BE(o));
  const u32 = (o) => (little ? bytes.readUInt32LE(o) : bytes.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > bytes.length) return 1;
  for (let i = 0, count = u16(ifd); i < count && ifd + 14 + i * 12 <= bytes.length; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 1;
}

/** A picture's size in pixels as it is shown, { width, height }, read from its bytes: a PNG's header, or a JPEG's frame,
    turned as its EXIF orientation says (5 to 8 are a quarter turn, so its width and height swap). null when the bytes are
    neither. `bytes` is the whole file: a JPEG's frame may come after large EXIF or XMP parts. */
export function pictureSize(bytes) {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString("ascii", 12, 16) === "IHDR") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    let orientation = 1;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = bytes.readUInt16BE(at + 2);
      if (marker === 0xe1) orientation = orientationOf(bytes, at) ?? orientation;
      // A frame's start, of any of the kinds a JPEG may be coded in (not 0xc4, 0xc8 or 0xcc, which are tables).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const [width, height] = [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
        return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
      }
      at += 2 + length;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/pictures.js tool/tests/pictures.test.js tool/tests/fixtures.js
git commit -m "A picture taken by its name only, its size read from its own bytes as it is shown"
```

---

## Task C6: Times and words a person gives, and the cuts on a timeline

**Files:**
- Create: `tool/clock.js`, `tool/tests/clock.test.js`

**Interfaces:**
- Produces: `secondsOf(said)`, `clockText(seconds)`, `clockOf(fcpxmlText) → [{ at, from, to, position?, notes }]`, `clockOfRanges(ranges)`, `rawAt(clock, t)`, `timelineAt(clock, raw)`, `lengthOf(clock)`; `heardWords(words, phrases)` (each word from when it is said: no earlier than the phrase it ends in, which starts on a heard pause); `keptWords(words, ranges)`, `wordsAt(words, ranges, said) → [{ start, end }]`; `momentOf({ time | quoted, on, clock, ranges, words, end? }) → { at, for? }` or `{ why }`, where `end: true` reads the end of a stretch (up to a second past the timeline's end is its end, and a kept piece's own end is in it), and a time past the end is said with the length, to the tenth of a second when, to the second, the two would read the same; `cutsOn(clock, edges?) → [{ at, from, to }]`, with a cut before the first clip and after the last within `edges` (`{ from, to }`: the recording for the main video, a Reel's stretch); `NEAR = 5`; `cutNear({ time, on, clock, edges, said }) → { cut }` or `{ why }`, where `said(cut) → { cut, kept }` gives the words cut there now and those kept there again since: only a cut with words counts, the only one within NEAR, or one within a second whose next is more than 2 seconds off; otherwise each is named, and one kept again is said to be kept already (ruling 9).

- [ ] **Step 1: Write the failing tests**

`tool/tests/clock.test.js`:

```js
// Times and words a person gives on a timeline, mapped back to seconds of the raw video.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf } from "../cuts.js";
import { secondsOf, clockText, clockOf, clockOfRanges, rawAt, timelineAt, lengthOf, wordsAt, momentOf, heardWords, cutsOn, cutNear } from "../clock.js";
import { fcpxml } from "../fcpxml.js";
import { TOLD, PAUSES } from "./fixtures.js";

const RAW = wordsOf(TOLD);
/** The words from when they are said, as a push gives them (heardWords). */
const WORDS = heardWords(RAW, phrasesOf(RAW, pausesOf(PAUSES)));
/** The main video's kept pieces in the made-up recording, as its cut plan gives them. */
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const FACTS = { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 };

describe("a time as a person gives it", () => {
  it("is minutes and seconds, hours too, or seconds alone", () => {
    assert.deepEqual(["0:03", "12:30", "1:02:03", "45", "3.5", " 0:07 "].map(secondsOf), [3, 750, 3723, 45, 3.5, 7]);
    assert.deepEqual(["", "noon", "1:75", "-3", "0:03:"].map(secondsOf), [null, null, null, null, null]);
  });
  it("is shown to the second", () => {
    assert.deepEqual([5.885, 750, 3723.4, 59.6].map(clockText), ["0:06", "12:30", "1:02:03", "1:00"]);
  });
});

describe("the clock of a timeline", () => {
  it("is read off a Final Cut file brimm-video wrote, each clip's place on the timeline and its stretch of the video", () => {
    const clock = clockOf(fcpxml({ video: "/v/a.mp4", facts: FACTS, ranges: MAIN }));
    assert.equal(clock.length, 3);
    assert.ok(Math.abs(clock[1].at - 3.971) < 0.001 && Math.abs(clock[1].from - 13.38) < 0.001, JSON.stringify(clock));
    // Each clip is whole frames of the video: 119, 94 and 62 at 29.97 a second.
    assert.ok(Math.abs(lengthOf(clock) - 275 / (30000 / 1001)) < 0.0001, String(lengthOf(clock)));
  });
  it("is the kept pieces end to end, for a timeline never pushed", () => {
    assert.deepEqual(clockOfRanges(MAIN).map((p) => Math.round(p.at * 1000) / 1000), [0, 3.968, 7.115]);
  });
  it("maps a time on it to the raw video, and back", () => {
    const clock = clockOfRanges(MAIN);
    assert.equal(Math.round(rawAt(clock, 5.885) * 1000) / 1000, 15.3);
    assert.equal(Math.round(timelineAt(clock, 15.3) * 1000) / 1000, 5.885);
    assert.equal(timelineAt(clock, 11), null);
    assert.equal(rawAt(clock, 30), null);
  });
});

describe("the words, from when they are said", () => {
  it("start after the pause before them, where the transcriber starts them where the word before ended", () => {
    const moved = WORDS.filter((w, i) => w.start !== RAW[i].start).map((w) => [w.w, w.start]);
    assert.deepEqual(moved, [["Welcome", 1.111], ["Let", 3.695], ["Welcome", 6.07], ["So", 12.459], ["So", 13.583], ["It", 17.246], ["Thank", 19.414]]);
  });
});

describe("words a person quotes", () => {
  it("are found among the timeline's kept words, without case or punctuation", () => {
    assert.deepEqual(wordsAt(WORDS, MAIN, "Know your COSTS"), [{ start: 15.3, end: 16.2 }]);
    assert.deepEqual(wordsAt(WORDS, MAIN, "very important"), []);
  });
  it("start when they are said, and never before their piece", () => {
    assert.deepEqual(wordsAt(WORDS, MAIN, "welcome to"), [{ start: 6.07, end: 6.58 }]);
    // Were they taken as the transcriber times them, they would start at the piece's start, in the pause.
    assert.deepEqual(wordsAt(RAW, MAIN, "welcome to"), [{ start: 5.87, end: 6.58 }]);
  });
});

describe("a moment a person gives", () => {
  const given = { on: "main v3", clock: clockOfRanges(MAIN), ranges: MAIN, words: WORDS };
  it("is a time on the clock she watched, in seconds of the raw video", () => {
    assert.deepEqual(momentOf({ ...given, time: "0:05" }), { at: 14.415 });
  });
  it("is quoted words, with how long they take", () => {
    assert.deepEqual(momentOf({ ...given, quoted: "know your costs" }), { at: 15.3, for: 0.9 });
  });
  it("refuses a time past the end, a time in what is cut now, and words not kept or said twice", () => {
    assert.deepEqual(momentOf({ ...given, time: "0:45" }), { why: "0:45 is after the end of main v3, which is 0:09 long." });
    // She watched v3, which kept the opening; it is cut now.
    const watched = clockOfRanges([{ start: 0, end: 4 }, ...MAIN]);
    assert.deepEqual(momentOf({ ...given, clock: watched, time: "0:02" }), { why: '0:02 on main v3 is in what is cut now. The nearest kept words are after it, "Welcome to the show." at 0:04.' });
    assert.deepEqual(momentOf({ ...given, quoted: "very important" }), { why: '"very important" is not said in what main v3 keeps. Say the words as they are said, or give the time.' });
    const twice = [...WORDS, { w: "know", start: 21.0, end: 21.05 }, { w: "your", start: 21.05, end: 21.1 }, { w: "costs.", start: 21.1, end: 21.2 }];
    assert.deepEqual(momentOf({ ...given, words: twice, quoted: "know your costs" }), { why: '"know your costs" is said 2 times on main v3: at 0:06, at 0:09. Say the time instead.' });
    assert.deepEqual(momentOf({ ...given, time: "noon" }), { why: '"noon" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.' });
  });
  it("is, as the end of a stretch, the timeline's own end, read off its clock to the second, up to a second past it", () => {
    assert.deepEqual(momentOf({ ...given, time: "9.198", end: true }), { at: 21.297 });
    assert.deepEqual(momentOf({ ...given, time: "0:10", end: true }), { at: 21.297 });
    assert.deepEqual(momentOf({ ...given, time: "0:09", end: true }), { at: 21.099 });
    assert.deepEqual(momentOf({ ...given, time: "0:11", end: true }), { why: "0:11 is after the end of main v3, which is 0:09 long." });
  });
});

describe("a cut on a timeline", () => {
  const round = (cuts) => cuts.map((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 1000) / 1000])));
  it("is each place its clips' seconds of the raw video do not meet, and before its first and after its last within its edges", () => {
    assert.deepEqual(round(cutsOn(clockOfRanges(MAIN), { from: 0, to: 23.423 })), [{ at: 0, from: 0, to: 5.87 }, { at: 3.968, from: 9.838, to: 13.383 }, { at: 7.115, from: 16.53, to: 19.214 }, { at: 9.198, from: 21.297, to: 23.423 }]);
    // A Reel's edges are its stretch: what a cut took from its start is a cut at 0:00.
    assert.deepEqual(round(cutsOn(clockOfRanges([{ start: 19.214, end: 21.287 }]), { from: 13.38, to: 21.287 })), [{ at: 0, from: 13.38, to: 19.214 }]);
    assert.deepEqual(round(cutsOn(clockOfRanges(MAIN))), [{ at: 3.968, from: 9.838, to: 13.383 }, { at: 7.115, from: 16.53, to: 19.214 }]);
  });
  /** A clock of pieces of the raw video, and what is said in each cut between them: the words cut there now, and those kept
      there again since. */
  const joined = (pieces, said) => ({ on: "main v3", clock: clockOfRanges(pieces.map(([start, end]) => ({ start, end }))), said: (c) => said[c.from] || { cut: "", kept: "" } });
  const IMPORTANT = { cut: "It is very, very important to know this.", kept: "" };
  const AGAIN = { cut: "Let me do that again.", kept: "" };
  // Words cut at 1:00, only a pause cut at 1:02, and words at 1:08.
  const A = joined([[0, 60], [70, 72], [75, 81], [90, 130]], { 60: IMPORTANT, 81: AGAIN });
  it("is the one where words were cut nearest a time she gives, a pause alone never counting", () => {
    assert.deepEqual(cutNear({ ...A, time: "1:02" }), { cut: { at: 60, from: 60, to: 70, ...IMPORTANT } });
  });
  it("is within five seconds of the time, and refused further off, naming the nearest place where words were cut", () => {
    assert.equal(cutNear({ ...A, time: "1:13" }).cut.at, 68);
    assert.deepEqual(cutNear({ ...A, time: "1:13.1" }), { why: 'There is no cut with words near 1:13 on main v3: the nearest is at 1:08, "Let me do that again." Say that time, or the words that were cut (--words).' });
  });
  it("is refused when two places where words were cut are near, naming each, and is never guessed", () => {
    assert.deepEqual(cutNear({ ...A, time: "1:04" }), { why: 'There are 2 places near 1:04 on main v3 where words were cut: at 1:00, "It is very, very important…", and at 1:08, "Let me do that again." Say the words that were cut (--words), or a time nearer one of them.' });
    // Within a second of one, and the next more than 2 seconds off, it is that one; otherwise it is refused.
    const B = joined([[0, 60], [70, 74], [80, 130]], { 60: IMPORTANT, 74: AGAIN });
    assert.equal(cutNear({ ...B, time: "1:03.5" }).cut.at, 64);
    assert.match(cutNear({ ...B, time: "1:02.5" }).why, /^There are 2 places near 1:03/);
  });
  it("says what is kept already, and refuses a time past the end, or where nothing with words is cut", () => {
    const C = joined([[0, 60], [70, 130]], { 60: { cut: "", kept: "Know your costs." } });
    assert.deepEqual(cutNear({ ...C, time: "1:00.5" }), { why: '"Know your costs." is kept on main v3 already.' });
    assert.deepEqual(cutNear({ ...C, time: "0:30" }), { why: "Nothing with words is cut from main v3, so there is nothing there to keep." });
    assert.deepEqual(cutNear({ ...C, time: "5:00" }), { why: "5:00 is after the end of main v3, which is 2:00 long." });
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/clock.test.js`
Expected: FAIL: `clock.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/clock.js`:

```js
// Times and words a person gives (spec section 4, "Times a person gives"): read on the timeline she names, as she watched it
// in Final Cut, and mapped back to seconds of the raw video, where the record keeps every time. A time in what is cut now is
// refused, with the kept words nearest it.
// Nothing here touches a disk or runs a program.

/** A time as a person gives it, in seconds: "0:03", "12:30", "1:02:03", or seconds alone, "45" or "3.5". null for anything
    else. */
export function secondsOf(said) {
  const m = /^(?:(\d+):)?(?:(\d{1,2}):)?(\d+(?:\.\d+)?)$/.exec(String(said ?? "").trim());
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter((p) => p !== undefined).map(Number);
  if (parts.length > 1 && parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((sum, p) => sum * 60 + p, 0);
}

/** Seconds as a clock shows them, to the second: "0:05", "12:30", "1:02:03". */
export function clockText(seconds) {
  const s = Math.round(seconds);
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A time of a Final Cut file, "300300/30000s" or "5s", in seconds. */
const timeIn = (text) => {
  const m = /^(-?\d+)(?:\/(\d+))?s$/.exec(String(text ?? "0s"));
  return m ? Number(m[1]) / Number(m[2] || 1) : NaN;
};

/** The clock of a timeline as a Final Cut file keeps it: each clip of its spine, in order, as { at, from, to }, where `at`
    is where it starts on the timeline and `from` and `to` are seconds of the raw video, `position`, the clip's move,
    when it has one, and `notes`, the words of the markers on it. It reads a file as brimm-video
    writes one, not Final Cut's files at large. */
export function clockOf(text) {
  const spine = /<spine>([\s\S]*?)<\/spine>/.exec(String(text));
  if (!spine) return [];
  // Each clip, and the move on it when it has one: an upright project's clip moved onto the face (phase 3).
  return [...spine[1].matchAll(/<asset-clip((?:\s+[\w.:-]+="[^"]*")*)\s*(\/?)>((?:(?!<asset-clip)[\s\S])*?)(?=<asset-clip|$)/g)].map((m) => {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w.:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const from = timeIn(attrs.start || "0s");
    const moved = m[2] ? null : /<adjust-transform\b[^>]*\sposition="([^"]*)"/.exec(m[3]);
    const notes = m[2] ? [] : [...m[3].matchAll(/<marker\b[^>]*\svalue="([^"]*)"/g)].map((n) => n[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    return { at: timeIn(attrs.offset || "0s"), from, to: from + timeIn(attrs.duration), ...(moved ? { position: moved[1] } : {}), notes };
  });
}

/** The clock of a timeline as kept pieces, { start, end } of the raw video in order, would give it. */
export function clockOfRanges(ranges) {
  let at = 0;
  return ranges.map((r) => {
    const piece = { at, from: r.start, to: r.end };
    at += r.end - r.start;
    return piece;
  });
}

const EDGE = 0.0005;
const END_SLACK = 0.05;
/** The second of the raw video at a time on a clock, or null when the time is past its end. */
export function rawAt(clock, t) {
  const piece = clock.find((p) => t >= p.at - EDGE && t < p.at + (p.to - p.from) - EDGE) || (clock.length && Math.abs(t - lengthOf(clock)) < EDGE ? clock[clock.length - 1] : null);
  return piece ? piece.from + (t - piece.at) : null;
}
/** The time on a clock of a second of the raw video, or null when it is not on that clock: cut out of it. */
export function timelineAt(clock, raw) {
  const piece = clock.find((p) => raw >= p.from - EDGE && raw <= p.to + EDGE);
  return piece ? piece.at + Math.min(Math.max(raw - piece.from, 0), piece.to - piece.from) : null;
}
/** A time past the end of a clock, said with the clock's length; to the tenth of a second when, to the second, the two would
    read the same ("0:04 is after the end …, which is 0:03.9 long"). */
function pastEnd(t, on, clock) {
  const length = lengthOf(clock);
  const tenths = Math.floor(length * 10) / 10;
  const shown = clockText(length) === clockText(t) ? `${clockText(Math.floor(tenths))}.${Math.round((tenths % 1) * 10)}` : clockText(length);
  return `${clockText(t)} is after the end of ${on}, which is ${shown} long.`;
}
/** How long a clock runs. */
export const lengthOf = (clock) => (clock.length ? clock[clock.length - 1].at + clock[clock.length - 1].to - clock[clock.length - 1].from : 0);

/** The recording's words as they were heard: the transcriber starts a word where the word before it ended (cuts.js wordsOf),
    so a word after a pause starts in the pause. A phrase starts on the pause's end where there is one (cuts.js phrasesOf),
    so each word starts no earlier than the phrase it ends in. Captions, and words a person quotes, start when they are said. */
export const heardWords = (words, phrases) => words.map((w) => {
  const phrase = phrases.find((p) => w.end > p.start && w.end <= p.end + 0.0005);
  return phrase && w.start < phrase.start ? { ...w, start: phrase.start } : w;
});

/** A word as words are compared: in lower case, without its punctuation. */
const plain = (w) => String(w).normalize("NFC").toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, "");

/** The words of the recording that a timeline keeps: those that end in one of its kept pieces, `ranges`. */
export const keptWords = (words, ranges) => words.filter((w) => ranges.some((r) => w.end > r.start && w.end <= r.end));

/** Where quoted words are said among a timeline's kept words: each place, { start, end } in seconds of the raw video, from the
    first word's start (no earlier than its piece's) to the last word's end. Compared without case or punctuation. */
export function wordsAt(words, ranges, said) {
  const wanted = String(said ?? "").split(/\s+/).map(plain).filter(Boolean);
  const kept = keptWords(words, ranges);
  const found = [];
  if (!wanted.length) return found;
  for (let i = 0; i + wanted.length <= kept.length; i++) {
    if (wanted.every((w, k) => plain(kept[i + k].w) === w)) {
      const piece = ranges.find((r) => kept[i].end > r.start && kept[i].end <= r.end);
      found.push({ start: Math.max(kept[i].start, piece.start), end: kept[i + wanted.length - 1].end });
    }
  }
  return found;
}

/** The moment a person gives on a timeline, in seconds of the raw video: { at } and, for quoted words, `for`, how long they
    take; or { why } in plain words. `on` names the timeline as she knows it ("main v3"); `clock` is the clock she watched
    (the newest version pushed, or the timeline as it is now when none was); `ranges` are its kept pieces now, and `words`
    the recording's words. Given `time` (as a person says it) or `quoted` words:
    - a time past the clock's end is refused, with its length;
    - a time that falls in what is cut now (it was kept in the version she watched) is refused, with the kept words nearest;
    - words found nowhere, or found more than once, are refused, the second with each place on her clock. */
export function momentOf({ time, quoted, on, clock, ranges, words, end = false }) {
  if (quoted !== undefined) {
    const places = wordsAt(words, ranges, quoted);
    if (!places.length) return { why: `"${quoted}" is not said in what ${on} keeps. Say the words as they are said, or give the time.` };
    if (places.length > 1) {
      const at = places.map((p) => timelineAt(clock, p.start)).map((t) => (t === null ? "in what is cut now" : `at ${clockText(t)}`));
      return { why: `"${quoted}" is said ${places.length} times on ${on}: ${at.join(", ")}. Say the time instead.` };
    }
    return { at: places[0].start, for: Math.round((places[0].end - places[0].start) * 1000) / 1000 };
  }
  let t = secondsOf(time);
  if (t === null) return { why: `"${time}" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.` };
  // The end of a stretch may be the timeline's own end, read off its clock to the second: up to a second past it is the end.
  if (end && t > lengthOf(clock) && t <= lengthOf(clock) + 1) t = lengthOf(clock);
  const raw = rawAt(clock, t);
  if (raw === null) return { why: pastEnd(t, on, clock) };
  // A stretch's end may be a kept piece's own end; a pushed file's clips end on a frame, a little past it.
  const inside = (r) => (end ? raw > r.start + EDGE && raw <= r.end + END_SLACK : raw >= r.start - EDGE && raw < r.end - EDGE);
  if (!ranges.some(inside)) return { why: `${clockText(t)} on ${on} is in what is cut now. ${nearest(words, ranges, raw, clock)}` };
  return { at: Math.round(raw * 1000) / 1000 };
}

/** The places on a clock where the raw video was cut: between two clips whose seconds of the raw video do not meet and, given
    the timeline's `edges` ({ from, to }: the whole recording for the main video, its stretch for a Reel), before its first
    clip and after its last. Each is { at, from, to }: where it is on the timeline, and the seconds of the raw video cut out
    there. */
export function cutsOn(clock, edges) {
  const GAP = 0.1;
  const cuts = [];
  if (!clock.length) return cuts;
  if (edges && clock[0].from - edges.from > GAP) cuts.push({ at: 0, from: edges.from, to: clock[0].from });
  for (let i = 1; i < clock.length; i++) if (clock[i].from - clock[i - 1].to > GAP) cuts.push({ at: clock[i].at, from: clock[i - 1].to, to: clock[i].from });
  const last = clock[clock.length - 1];
  if (edges && edges.to - last.to > GAP) cuts.push({ at: lengthOf(clock), from: last.to, to: edges.to });
  return cuts;
}

/** How far from a cut, in seconds of the timeline, a time a person gives may be and still mean it. */
export const NEAR = 5;

/** A sentence's end: a full stop, unless it ends in one already, or in a quote that does. */
const ended = (text) => (/[.!?…]"?$/.test(text) ? text : `${text}.`);
/** The first words of what was said, for a person to know it by. */
const opening = (text) => {
  const words = String(text).split(/\s+/);
  return words.length > 5 ? `${words.slice(0, 5).join(" ")}…` : text;
};

/** The cut nearest a time a person gives on a timeline, "keep the Hormozi story at 12:30": { cut } (cutsOn, with the words
    cut there), or { why } in plain words. `said(cut)` gives what is said in a cut, { cut, kept }: the words cut there now,
    and those kept there again since. Only a cut with words counts, never a pause alone, and only within NEAR seconds of the
    time. It is the one when it is the only one so near, or when it is within a second and the next more than 2 seconds off;
    otherwise each is named, and nothing is guessed (spec section 4: a command refuses rather than guess). One whose words are
    all kept again is said to be kept already. */
export function cutNear({ time, on, clock, edges, said }) {
  const t = secondsOf(time);
  if (t === null) return { why: `"${time}" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.` };
  if (t > lengthOf(clock) + 1) return { why: pastEnd(t, on, clock) };
  const off = (c) => Math.abs(c.at - t);
  const worded = cutsOn(clock, edges).map((c) => ({ ...c, ...said(c) })).filter((c) => c.cut || c.kept).sort((a, b) => off(a) - off(b));
  const near = worded.filter((c) => off(c) <= NEAR);
  if (near.length === 1 || (near.length > 1 && off(near[0]) <= 1 && off(near[1]) > 2)) return near[0].cut ? { cut: near[0] } : { why: `"${near[0].kept}" is kept on ${on} already.` };
  if (near.length > 1) {
    const each = [...near].sort((a, b) => a.at - b.at).map((c) => `at ${clockText(c.at)}, "${opening(c.cut || c.kept)}"${c.cut ? "" : " (kept already)"}`);
    return { why: `There are ${near.length} places near ${clockText(t)} on ${on} where words were cut: ${ended(each.length === 2 ? each.join(", and ") : `${each.slice(0, -1).join("; ")}; and ${each[each.length - 1]}`)} Say the words that were cut (--words), or a time nearer one of them.` };
  }
  const cut = worded.find((c) => c.cut);
  if (!cut) return { why: `Nothing with words is cut from ${on}, so there is nothing there to keep.` };
  return { why: `There is no cut with words near ${clockText(t)} on ${on}: ${ended(`the nearest is at ${clockText(cut.at)}, "${opening(cut.cut)}"`)} Say that time, or the words that were cut (--words).` };
}

/** The kept words nearest a second of the raw video, before it and after it, each with its time on the clock when it is on
    it: a sentence for a person. */
function nearest(words, ranges, raw, clock) {
  const kept = keptWords(words, ranges);
  const before = kept.filter((w) => w.end <= raw).slice(-4);
  const after = kept.filter((w) => w.end > raw).slice(0, 4);
  const told = (list) => {
    if (!list.length) return null;
    const piece = ranges.find((r) => list[0].end > r.start && list[0].end <= r.end);
    const t = timelineAt(clock, Math.max(list[0].start, piece.start));
    return `"${list.map((w) => w.w).join(" ")}"${t === null ? "" : ` at ${clockText(t)}`}`;
  };
  const parts = [told(before) && `before it, ${told(before)}`, told(after) && `after it, ${told(after)}`].filter(Boolean);
  return parts.length ? `The nearest kept words are ${parts.join(", and ")}.` : "Nothing is kept near it.";
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/clock.js tool/tests/clock.test.js
git commit -m "Times and words read on the timeline she watched, mapped to the raw video, and refused where they cannot be"
```

---

## Task C7: Cuts at pauses

**Files:**
- Create: `tool/recut.js`, `tool/tests/recut.test.js`

**Interfaces:**
- Consumes: `rangesOf`, `KEPT_SIDE` (`cuts.js`).
- Produces: `pausesOf(phrases, duration)`; `cutSpan(phrases, from, to) → { from, to, phrases }` or `{ why }`; `cutPhrases(phrases, cuts)`; `rangesWith({ plan, cuts = [] })`, the whole recording's ranges, kept and cut: with no cut, `plan.ranges` as they are; with cuts, the plan's own outside the stretch around each phrase a cut changed, and each range naming the phrases it holds now (ruling 3); `keptOf(ranges, span?)`; `keptRanges({ plan, cuts, span })`; `croppedLike(pieces, stretches)`, each piece with the crop or the move of the stretch it lies most in, and its `guessed` mark.

- [ ] **Step 1: Write the failing tests**

`tool/tests/recut.test.js`:

```js
// Cuts a person asks for: whole phrases, at pauses, the ranges made again by the import's own rules.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf as heardPauses, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions } from "../notes.js";
import { pausesOf, cutSpan, cutPhrases, keptRanges, rangesWith, croppedLike } from "../recut.js";
import { TOLD, PAUSES } from "./fixtures.js";

/** The made-up recording's plan, as phase 3's tests make it: Claude cut "It is very, very important." (p8). */
const HEARD = heardPauses(PAUSES);
const DECIDED = applyDecisions(cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: 23.423, pauses: HEARD }), readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [] })).decisions, HEARD).plan;
const PLAN = { ...DECIDED, facts: { duration: 23.423 } };
/** The same recording, as ffmpeg heard it with no silence after its last words: its tail is a sound with no words to it, which
    the plan keeps, and which the gaps between phrases cannot show. */
const TAILED = (() => {
  const heard = HEARD.slice(0, -1);
  return { ...applyDecisions(cutPlan(phrasesOf(wordsOf(TOLD), heard), { duration: 23.423, pauses: heard }), readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [] })).decisions, heard).plan, facts: { duration: 23.423 } };
})();
/** A recording as ffmpeg heard it with sound before its first words (a lead-in), and a laugh between two pauses after them:
    the plan keeps both, and the gaps between phrases cannot show either (the lead's re-check of the plan). */
const LAUGHED = (() => {
  const words = [["Welcome", 1.0, 1.3], ["to", 1.3, 1.5], ["the", 1.5, 1.7], ["show.", 1.7, 2.0], ["Today", 4.6, 4.9], ["we", 4.9, 5.1], ["talk", 5.1, 5.4], ["pricing.", 5.4, 6.0], ["Then", 8.0, 8.3], ["we", 8.3, 8.5], ["stop.", 8.5, 9.0]].map(([w, start, end]) => ({ w, start, end }));
  const heard = [[2.1, 2.6], [3.4, 4.5], [6.1, 7.9], [9.1, 12]];
  return { ...cutPlan(phrasesOf(words, heard), { duration: 12, pauses: heard }), facts: { duration: 12 } };
})();
const pairs = (ranges) => ranges.map((r) => [r.start, r.end]);

describe("the pauses a plan's phrases show", () => {
  it("are the gaps between them, and before the first and after the last: here, every pause ffmpeg heard", () => {
    assert.deepEqual(pausesOf(PLAN.phrases, 23.423), HEARD);
  });
});

describe("a cut asked for", () => {
  it("is made whole: the phrases it touches, with every one they touch without a pause", () => {
    assert.deepEqual(cutSpan(PLAN.phrases, 17.5, 18.0), { from: 17.246, to: 19.022, phrases: ["p8"] });
    // p4 and p5 touch: "Welcome to the show." runs into "Today we are...", so they go together.
    assert.deepEqual(cutSpan(PLAN.phrases, 8.5, 9.0), { from: 6.07, to: 9.638, phrases: ["p4", "p5"] });
    assert.deepEqual(cutSpan(PLAN.phrases, 10, 11), { why: "No words are said there, so there is nothing to cut or keep." });
  });
  it("keeps or takes out each phrase in it, in the order asked, and says a person took it out", () => {
    const now = cutPhrases(PLAN.phrases, [{ keep: false, from: 13.583, to: 16.33 }, { keep: true, from: 17.246, to: 19.022 }]);
    assert.deepEqual(now.filter((p) => ["p7", "p8"].includes(p.id)).map((p) => [p.id, p.keep, p.kind, p.why]), [["p7", false, "cut", "taken out by a person"], ["p8", true, "keep", ""]]);
    assert.equal(PLAN.phrases.find((p) => p.id === "p8").keep, false);
  });
});

describe("the kept pieces", () => {
  it("are the plan's own, untouched, with no cut asked for", () => {
    assert.equal(rangesWith({ plan: TAILED }), TAILED.ranges);
    assert.deepEqual(pairs(keptRanges({ plan: PLAN })), pairs(PLAN.ranges.filter((r) => r.keep)));
  });
  it("keep a sound the plan kept that the gaps between phrases cannot show, the tail, when a cut is made elsewhere", () => {
    assert.deepEqual(pairs(keptRanges({ plan: TAILED })).slice(-1), [[19.214, 23.423]]);
    assert.deepEqual(pairs(keptRanges({ plan: TAILED, cuts: [{ keep: false, from: 6.07, to: 9.638 }] })), [[13.383, 16.53], [19.214, 23.423]]);
    // Made again from the gaps alone, the tail would be cut as silence after the last words.
    assert.deepEqual(pausesOf(TAILED.phrases, 23.423).slice(-1), [[20.94, 23.423]]);
  });
  it("keep a lead-in and a laugh the plan kept, with no cut and with a cut away from them", () => {
    assert.equal(rangesWith({ plan: LAUGHED }), LAUGHED.ranges);
    assert.deepEqual(pairs(keptRanges({ plan: LAUGHED })), [[0, 6.3], [7.7, 9.3]]);
    assert.deepEqual(pairs(keptRanges({ plan: LAUGHED, cuts: [{ keep: false, from: 7.9, to: 9.1 }] })), [[0, 6.3]]);
  });
  it("name only the phrases each range holds now, where what a cut made again meets the plan's own ranges", () => {
    // The laugh beside the phrase taken out is made again from the gaps between phrases, so it goes with the pause (ruling 3).
    const ranges = rangesWith({ plan: LAUGHED, cuts: [{ keep: false, from: 4.5, to: 6.1 }] });
    assert.deepEqual(ranges.map((r) => [r.start, r.end, r.keep, r.phrases, r.text]), [
      [0, 2.3, true, ["p1"], "Welcome to the show."],
      [2.3, 7.7, false, ["p2"], "Today we talk pricing."],
      [7.7, 9.3, true, ["p3"], "Then we stop."],
      [9.3, 12, false, [], ""]
    ]);
  });
  it("join over a phrase kept again, with no breath lost", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: true, from: 17.246, to: 19.022 }] })), [[5.87, 9.838], [13.383, 21.297]]);
  });
  it("lose a phrase taken out, and the pause beside it", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: false, from: 6.07, to: 9.638 }] })), [[13.383, 16.53], [19.214, 21.297]]);
  });
  it("lie within a Reel's stretch, cut at its edges", () => {
    assert.deepEqual(pairs(keptRanges({ plan: PLAN, cuts: [{ keep: true, from: 17.246, to: 19.022 }], span: { from: 13.38, to: 21.287 } })), [[13.383, 21.287]]);
  });
});

describe("a Reel's pieces after a cut", () => {
  it("take the crop of the Reel's own stretch they lie most in", () => {
    const stretches = [{ start: 13.38, end: 16.516, crop: { x: 118, w: 404 } }, { start: 19.219, end: 21.287, crop: { x: 200, w: 404 } }];
    assert.deepEqual(croppedLike([{ start: 13.383, end: 16.53 }, { start: 19.6, end: 21.287 }, { start: 17, end: 18 }], stretches).map((p) => p.crop.x), [118, 200, 118]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/recut.test.js`
Expected: FAIL: `recut.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/recut.js`:

```js
// Cuts a person asks for (spec section 4, `cut keep|remove`): a stretch kept that the plan cut, or one taken out that it
// kept, always whole phrases and only at a pause, as the import's own rules cut (cuts.js). The ranges are made again by the
// import's own rangesOf, so a cut asked for looks like one the rules made: a breath kept each side, a long pause shortened.
// Nothing here touches a disk or runs a program.
import { rangesOf, KEPT_SIDE } from "./cuts.js";

/** The pauses of a recording, as its phrases show them: a phrase starts or ends on a pause's edge where there is one, and two
    phrases with no pause between them touch (cuts.js phrasesOf). So each gap between two phrases is a pause, and so is the
    time before the first and after the last. The cut plan keeps the phrases and not the pauses ffmpeg heard; a gap that held
    a sound with no words to it (a cough between two pauses) is taken as one pause here. */
export function pausesOf(phrases, duration) {
  const pauses = [];
  let at = 0;
  for (const p of phrases) {
    if (p.start > at) pauses.push([at, p.start]);
    at = Math.max(at, p.end);
  }
  if (duration > at) pauses.push([at, duration]);
  return pauses;
}

/** The phrases that go together: touching ones, with no pause between them, are cut together or not at all. Each group as the
    indexes of its phrases. */
const groupsOf = (phrases) => {
  const groups = [];
  for (const [i, p] of phrases.entries()) {
    if (!groups.length || phrases[i - 1].end < p.start) groups.push([]);
    groups[groups.length - 1].push(i);
  }
  return groups;
};

/** A cut asked for, made whole: the phrases from `from` to `to` (seconds of the raw video), with every phrase they touch
    without a pause, as { from, to, phrases }, from the first one's start to the last one's end; or { why } when no phrase
    is there. */
export function cutSpan(phrases, from, to) {
  const groups = groupsOf(phrases).filter((g) => g.some((i) => phrases[i].end > from && phrases[i].start < to));
  if (!groups.length) return { why: "No words are said there, so there is nothing to cut or keep." };
  const ids = groups.flat();
  return { from: phrases[ids[0]].start, to: phrases[ids[ids.length - 1]].end, phrases: ids.map((i) => phrases[i].id) };
}

/** The phrases as the cuts asked for leave them: each cut, { keep, from, to }, in the order asked, keeps or takes out every
    phrase in it, whole. What a cut took out it says, in the plan's way. */
export function cutPhrases(phrases, cuts = []) {
  const now = phrases.map((p) => ({ ...p }));
  for (const cut of cuts) {
    for (const p of now) {
      if (!(p.end > cut.from && p.start < cut.to)) continue;
      Object.assign(p, cut.keep ? { keep: true, kind: "keep", why: "" } : { keep: false, kind: "cut", why: "taken out by a person" });
    }
  }
  return now;
}

/** The ranges of the whole recording, as the cuts asked for leave them, kept and cut alike, each with its reason, as a plan's
    are (the joins' notes are made from them). With no cut asked for, they are the plan's own, untouched: the plan made them
    from the pauses ffmpeg heard, which it does not keep, so a sound with no words to it (a lead-in, a cough, a tail) is kept
    where it was. With cuts, only the stretch around each phrase a cut changed is made again, by the import's own rangesOf on
    the pauses the phrases show: from the start of the phrase before it to the end of the phrase after it. Everything else is
    the plan's own. */
export function rangesWith({ plan, cuts = [] }) {
  if (!cuts.length) return plan.ranges;
  const duration = plan.facts.duration;
  const phrases = cutPhrases(plan.phrases, cuts);
  const remade = rangesOf(phrases, duration, pausesOf(plan.phrases, duration));
  // The stretches made again: around each phrase whose keeping changed, with its neighbours, joined where they meet.
  const windows = [];
  phrases.forEach((p, i) => {
    if (p.keep === plan.phrases[i].keep) return;
    const from = i > 0 ? phrases[i - 1].start : 0;
    const to = i + 1 < phrases.length ? phrases[i + 1].end : duration;
    const last = windows[windows.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else windows.push([from, to]);
  });
  const clip = (ranges, a, b) => ranges.filter((r) => r.end > a && r.start < b).map((r) => ({ ...r, start: Math.max(r.start, a), end: Math.min(r.end, b) }));
  const spliced = [];
  let at = 0;
  for (const [a, b] of windows) {
    spliced.push(...clip(plan.ranges, at, a), ...clip(remade, a, b));
    at = b;
  }
  spliced.push(...clip(plan.ranges, at, duration));
  // Ranges that now touch and are of one kind are one range, as rangesOf leaves them.
  const joined = [];
  for (const r of spliced.filter((x) => x.end > x.start)) {
    const last = joined[joined.length - 1];
    if (last && last.keep === r.keep && last.kind === r.kind && last.why === r.why) last.end = r.end;
    else joined.push({ ...r });
  }
  // Each range names the phrases that lie in it now, and their words: one of the plan's, cut short at a stretch made again,
  // no longer holds the phrases beyond it.
  return joined.map((r) => {
    const inside = phrases.filter((p) => (p.start + p.end) / 2 >= r.start && (p.start + p.end) / 2 < r.end);
    return { ...r, phrases: inside.map((p) => p.id), text: inside.map((p) => p.text).join(" ") };
  });
}

/** The kept pieces of a timeline, each { start, end }, from ranges as rangesWith gives them. `span`, for a Reel, is its
    stretch, { from, to }: only what lies in it is kept, and it is cut at the stretch's edges. */
export function keptOf(ranges, span) {
  const pieces = ranges.filter((r) => r.keep).map((r) => ({ start: r.start, end: r.end }));
  if (!span) return pieces;
  return pieces.map((r) => ({ start: Math.max(r.start, span.from), end: Math.min(r.end, span.to) })).filter((r) => r.end - r.start > KEPT_SIDE / 2);
}

/** The kept pieces, as the cuts asked for leave them (rangesWith, then keptOf). */
export const keptRanges = ({ plan, cuts = [], span }) => keptOf(rangesWith({ plan, cuts }), span);

/** Each piece of a Reel with the crop, or the move, of the Reel's own stretch it lies most in, or the nearest: a cut made in a
    Reel keeps the picture where the face was, and the note that no face was found there (reels.js GUESSED) goes with it. */
export function croppedLike(pieces, stretches) {
  return pieces.map((piece) => {
    const overlap = (s) => Math.min(piece.end, s.end) - Math.max(piece.start, s.start);
    const gap = (s) => Math.max(s.start - piece.end, piece.start - s.end, 0);
    const best = stretches.reduce((a, b) => (overlap(b) > overlap(a) || (overlap(b) === overlap(a) && gap(b) < gap(a)) ? b : a));
    return { ...piece, ...(best.crop ? { crop: best.crop } : {}), ...(best.position ? { position: best.position } : {}), ...(best.guessed ? { guessed: true } : {}) };
  });
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/recut.js tool/tests/recut.test.js
git commit -m "Cuts a person asks for: whole phrases at a pause, and the plan's own ranges wherever no cut reaches"
```

---

## Task C8: The files for Jason's by-hand checks

**Files:**
- Create: `docs/phase-4/make-checks.mjs`, `docs/phase-4/checks.md`

**Interfaces:**
- Consumes: `fcpxml`, `fileUrl`, `checkFcpxml` (C1); `captionLook`, `titleLook`, `placeOf`, `lookFor`, `LOOK_PRESETS` (C2).

This task writes no test: it is a script Jason runs by hand, as `docs/phase-0/make-files.mjs` is, and nothing calls it. It writes only into `~/BRIMM Video Work/Phase 4 checks/`, which is outside Dropbox (or into a folder it is given, for a dry run), and it runs ffmpeg there to make two made-up clips and two made-up pictures. Each file is checked by `checkFcpxml` before it is written.

- [ ] **Step 1: Write the script**

`docs/phase-4/make-checks.mjs`:

```js
// The files for phase 4's by-hand checks (docs/phase-4/checks.md), from brimm-video's own writer: two made-up clips and two
// made-up pictures, and the Final Cut files, written into ~/BRIMM Video Work/Phase 4 checks/, which is outside Dropbox (or
// into the folder given, for a dry run). Each file imports into one library there, "Phase 4 checks".
// Run by hand: node docs/phase-4/make-checks.mjs [<folder>]. It needs ffmpeg, as docs/phase-0/make-files.mjs does.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fcpxml, fileUrl, checkFcpxml } from "../../tool/fcpxml.js";
import { captionLook, titleLook, placeOf, lookFor, LOOK_PRESETS } from "../../tool/styles.js";

const INTO = process.argv[2] ? resolve(process.argv[2]) : join(homedir(), "BRIMM Video Work", "Phase 4 checks");
const LIBRARY = join(INTO, "Phase 4 checks.fcpbundle");
const FFMPEG = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find(existsSync);
if (!FFMPEG) throw new Error("ffmpeg is not installed where brimm-video looks for it.");
mkdirSync(INTO, { recursive: true });
const run = (args) => {
  const ran = spawnSync(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(ran.stderr);
};
// Two made-up clips of 20 seconds with a tone, 1920 by 1080 and 1280 by 720 (a Zoom recording's size), and a logo and a chart.
const clip = (name, size) => {
  const path = join(INTO, name);
  run(["-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:duration=20`, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=20", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "2", "-shortest", path]);
  return path;
};
const HD = clip("Phase 4 clip.mov", "1920x1080");
const SMALL = clip("Phase 4 clip 720p.mov", "1280x720");
run(["-f", "lavfi", "-i", "color=c=white:size=600x300", "-frames:v", "1", join(INTO, "logo.png")]);
run(["-f", "lavfi", "-i", "testsrc2=size=1600x900", "-frames:v", "1", join(INTO, "chart.png")]);
const at = (width, height) => ({ duration: 20, frameRate: "30/1", width, height, hasAudio: true, audioRate: 48000, audioChannels: 2 });
const UPRIGHT = { width: 1080, height: 1920 };
const WIDE = { width: 1920, height: 1080 };
const SMALL_WIDE = { width: 1280, height: 720 };
// Two pieces with a join at 9 seconds of the timeline (9 to 11 of the clip is cut): a title over it is written once on each
// side of it (ruling 8), and check 1 sees whether it plays its build-in again there. Times below are the clip's; on the
// timeline, a time after the join is 2 seconds earlier.
const crop = { x: 657, y: 0, w: 606, h: 1080, found: true };
const joined = (cropped) => [{ start: 0, end: 9, ...(cropped ? { crop } : {}) }, { start: 11, end: 20, ...(cropped ? { crop } : {}) }];
const written = [];
// Each file goes into the checks' library without a question, unless `bare`: then Final Cut says what it would warn of.
const write = (name, text, facts, frame, { bare = false } = {}) => {
  const problems = checkFcpxml(text, facts, frame ? { frame } : {});
  if (problems.length) throw new Error(`${name}: ${problems.join(" ")}`);
  writeFileSync(join(INTO, name), text.replace("<resources>", `<import-options><option key="library location" value="${fileUrl(LIBRARY)}"/><option key="copy assets" value="0"/>${bare ? "" : '<option key="suppress warnings" value="1"/>'}</import-options>\n    <resources>`));
  written.push(name);
};
const line = (text, look, face) => ({ text, font: face, fontSize: look.fontSize, shadow: look.shadow, ...(look.alignment ? { alignment: look.alignment } : {}) });

// 1. Titles. Upright: a caption, a Reel's title over the join, and a name title in the top band; in Varela, and again in
// Lucida Grande, the stand-in on a Mac without Varela. Wide, at 1080 and at 720 lines: a caption, a name over a role on the
// Basic Lower Third over the join, and a name with no role.
const upright = (face, name) => {
  const caption = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face });
  const hook = titleLook("hook", { style: "plain", frame: UPRIGHT, face });
  const named = titleLook("name", { style: "plain", frame: UPRIGHT, face });
  write(name, fcpxml({ video: HD, facts: at(1920, 1080), ranges: joined(true), frame: UPRIGHT, project: `Phase 4, ${name.replace(/\.fcpxml$/, "")}`, event: "Phase 4 checks", titles: [
    { start: 1, end: 5, lane: 4, name: "check caption", role: "BRIMM captions", lines: [line("So the first thing", caption, face)], position: caption.position },
    { start: 7, end: 15, lane: 5, name: "check title over a join", role: "BRIMM titles", lines: ["Know your", "costs"].map((text, i) => line(text, hook.lines[i], face)), position: hook.position },
    { start: 15, end: 19, lane: 5, name: "check upright name", role: "BRIMM titles", lines: ["Sallie Ogden", "Founder, The BRIMM"].map((text, i) => line(text, named.lines[i], face)), position: named.position }
  ] }), at(1920, 1080), UPRIGHT);
};
upright("Varela", "1 titles upright.fcpxml");
upright("Lucida Grande", "1 titles upright lucida.fcpxml");
const wide = (video, frame, name) => {
  const face = "Varela";
  const caption = captionLook({ style: "plain", job: "as-filmed", frame, face });
  const named = titleLook("name", { style: "plain", frame, face });
  const facts = at(frame.width, frame.height);
  write(name, fcpxml({ video, facts, ranges: joined(false), project: `Phase 4, ${name.replace(/\.fcpxml$/, "")}`, event: "Phase 4 checks", titles: [
    { start: 1, end: 4, lane: 4, name: "check wide caption", role: "BRIMM captions", lines: [line("So the first thing you need to do", caption, face)], position: caption.position },
    { start: 6, end: 14, lane: 5, name: "check lower third over a join", role: "BRIMM titles", template: "lower-third", lines: ["Sallie Ogden", "Founder, The BRIMM"].map((text, i) => line(text, named.lines[i], face)) },
    { start: 15, end: 19, lane: 5, name: "check name alone", role: "BRIMM titles", template: "lower-third", lines: [line("Sallie Ogden", named.lines[0], face)] }
  ] }), facts);
};
wide(HD, WIDE, "1 titles wide.fcpxml");
wide(SMALL, SMALL_WIDE, "1 titles wide 720p.fcpxml");

// 3. Pictures, upright: the logo, and the chart full, in the corner and in the lower place, each on the role BRIMM titles. The
// same again in an event of its own, without suppress warnings, so that Final Cut says anything it would warn of.
const logo = { width: 600, height: 300 };
const chart = { width: 1600, height: 900 };
const still = (src, size, place, start, end, lane) => ({ start, end, lane, name: `check ${place}`, role: "BRIMM titles", src: fileUrl(join(INTO, src)), width: size.width, height: size.height, ...placeOf(place, { frame: UPRIGHT, picture: size }) });
const pictures = [still("logo.png", logo, "logo", 0, 20, 3), still("chart.png", chart, "full", 1, 5, 2), still("chart.png", chart, "corner", 6, 10, 2), still("chart.png", chart, "lower", 11, 15, 2)];
write("3 pictures.fcpxml", fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20, crop }], frame: UPRIGHT, project: "Phase 4, 3 pictures", event: "Phase 4 checks", stills: pictures }), at(1920, 1080), UPRIGHT);
write("3 pictures bare.fcpxml", fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20, crop }], frame: UPRIGHT, project: "Phase 4, 3 pictures bare", event: "Phase 4 checks bare", stills: pictures }), at(1920, 1080), UPRIGHT, { bare: true });

// 2b. A look, once check 2's exports have given Final Cut's preset for it (styles.js LOOK_PRESETS): one project for each.
for (const look of Object.keys(LOOK_PRESETS)) {
  write(`2 look ${look}.fcpxml`, fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20 }], project: `Phase 4, 2 look ${look}`, event: "Phase 4 checks", look: lookFor({ look, height: 1080, hdr: false }).effect }), at(1920, 1080));
}
console.log(`Written into ${INTO}: ${written.join(", ")}. Open each with: open -a "Final Cut Pro" "<file>". Then follow docs/phase-4/checks.md.`);
```

`docs/phase-4/checks.md` holds this plan's "By-hand checks for Jason", word for word, with a line under each check for what was seen (and, for check 2, the three exports).

- [ ] **Step 2: Run it into a folder of your own, and check its files**

Run: `node docs/phase-4/make-checks.mjs "$(mktemp -d)/checks"`, then, for each `.fcpxml` it names, `xmllint --noout --dtdvalid "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd" <file>` (on a Mac with Final Cut).
Expected: six files written (`1 titles upright`, `1 titles upright lucida`, `1 titles wide`, `1 titles wide 720p`, `3 pictures`, `3 pictures bare`), and each passes. Then `cd tool && node --test`: PASS (the script is under `docs/`, and no test runs it).

- [ ] **Step 3: Commit, and tell the lead the checks can be run**

```bash
git add docs/phase-4/make-checks.mjs docs/phase-4/checks.md
git commit -m "The files and steps for phase 4's by-hand checks: titles, looks and pictures, about 25 minutes"
```

---

## Task C9: What the by-hand checks send back

**Files:**
- Modify: `tool/styles.js`, `tool/tests/styles.test.js`, and any test that pins what a number of `styles.js` gives: C3's `tool/tests/captions.test.js`, and `tool/tests/layers.test.js`, whose caption texts and a Reel title's line break follow `chars` (its sizes and places it takes from `styles.js`)

**Interfaces:**
- Consumes: Jason's answers in `docs/phase-4/checks.md`, and his three exports of check 2.
- Produces: `styles.js`'s numbers as Final Cut shows them, and `LOOK_PRESETS` filled in: `{ bright | warm | moody: { name, uid, mixKey } }`.

Builder C owns this task: `styles.js` is C2's. It changes only `styles.js` and the tests that pin its numbers. Anything a check shows that needs another file is not done here: stop, and tell the lead what was seen and which fallback the plan names.

- [ ] **Step 1: Check 1, the sizes and places**

For each size or place Jason says is off, write the test first: in `tool/tests/styles.test.js`, the number `captionLook` or `titleLook` should give, worked out from what he measured (the share of the frame's height he saw, against the share `styles.js` asks for: the new share is the old one times what was asked for, over what was seen). Run `cd tool && node --test tests/styles.test.js`, and see it fail. Then change that share in `styles.js` (`captionLook`'s `share`, `titleLook`'s band or sizes, `shadowFor`), and run every test: a test that pins the old number (C3's grouping and Builder A's caption texts follow `chars`, which a size changes) is changed in the same commit, to what the code now gives, and named in the commit message.

- If the 720p file's name was "smaller at 720p", Final Cut scales a template's own space with the frame, so a size is of a 1080-line frame. Write the test first: `captionLook({ style: "plain", job: "as-filmed", frame: { width: 1280, height: 720 }, face: "Varela" }).fontSize` equals the same at 1920 by 1080. Then in `styles.js`, `sizeFor` works out a wide frame's size on 1080 lines: `const lines = frame.width > frame.height ? 1080 : frame.height;` in place of `frame.height`. Upright frames are as check 1's upright file showed.
- If the title over a join entered again at the join, stop: ruling 8's fallback (a title written once, at full length, on the clip where it starts, and `checkFcpxml` allowing a connected title or still to run past its clip) is a change to `fcpxml.js`, which the lead schedules.
- If the name alone showed the template's own words under it, stop: the fallback (a one-line name drawn as a Basic Title) is a change to `titleLook` and `layers.js`, which the lead schedules.
- If the Lucida file showed Helvetica, stop: `FACES`' name for Lucida Grande is wrong on this Mac, and the lead decides.

- [ ] **Step 2: Check 2, the looks' presets**

In each of Jason's three exports, find the clip's `<filter-video>` whose `<effect>` (in the resources) is named as `LOOK_MIX` names that look, and the `key` of its `param` named Mix. Write the test first, in `tool/tests/styles.test.js`:

```js
it("applies each look as Final Cut's own preset, at its Mix, once check 2 has given them", () => {
  for (const [look, [name, mix]] of Object.entries(LOOK_MIX)) {
    const { effect } = lookFor({ look, height: 1080, hdr: false });
    assert.deepEqual([effect.name, effect.uid, effect.params], [name, LOOK_PRESETS[look].uid, [{ name: "Mix", key: LOOK_PRESETS[look].mixKey, value: String(mix) }]]);
  }
});
```

Run it, and see it fail (`effect` is null). Then fill in `LOOK_PRESETS` in `styles.js` on the branch, one entry for each look, `{ name, uid, mixKey }`, with the `name` as `LOOK_MIX` gives it and the `uid` and `mixKey` from the export. If an export holds the Mix anywhere but a `param` named Mix, or its `<filter-video>` carries anything beyond that one param, stop: the looks stay recorded only, and the lead and Jason decide. Run every test: PASS, but do not commit yet. Jason runs `node docs/phase-4/make-checks.mjs` from the branch, which writes `2 look <look>.fcpxml` for each look, for check 2b. Keep an entry only for a look whose 2b was "the same colour"; take out any other, with its line in the test, and tell the lead and Jason what differed. Then commit.

- [ ] **Step 3: Check 3, the pictures**

As step 1, for `placeOf`: the test first, from what he saw, then the number. If a picture was not fitted to the frame unless told to fill it, `placeOf`'s `scale` is of the picture's own size, not the fitted one: the test first (`placeOf("corner", …).scale` for a 1600 by 900 chart in an upright frame), then `scale` worked out on the picture's own width. In "3 pictures export.fcpxml", each picture is a `<video>` whose role, up to its first dot, is `BRIMM titles` (Final Cut writes it as "BRIMM titles.BRIMM titles-1"), and whose `adjust-transform` is as written. If a role is another name up to its first dot, or Final Cut said something when it took `3 pictures bare.fcpxml` in, stop: stills need a role of their own, which is a change to `layers.js` that the lead schedules.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/styles.js tool/tests/
git commit -m "Sizes, places and looks as Final Cut shows them (by-hand checks 1 to 3)"
```

---

## Task A1: The record's layout 2

**Files:**
- Modify: `tool/episode.js`
- Create: `tool/tests/layout.test.js`
- Modify: `tool/tests/episode.test.js`, `tool/tests/edit-records.test.js`, `tool/tests/edit.test.js`, `tool/tests/unedited.test.js`: each record of "a newer layout" they write is version 3, not 2, since 2 is known now

**Interfaces:**
- Produces: `RECORD_VERSION = 2`; `layoutOf(record) → 1 | 2`; `writeEpisode` writes `version: Math.max(record.version || 1, layoutOf(record))`, so a record once at 2 stays at 2 (ruling 5); `episodeFault` reads layouts 1 and 2 and checks each layer: on the main video and on each Reel, `texts` (`{ id: "t<n>", kind: "lower-third", at, for, lines: [1 or 2] }`), `graphics` (`{ id: "g<n>", picture: "media/<name>", at, for, place: "full" | "corner" | "lower" }`), `cuts` (`{ id: "c<n>", keep, from, to }`), `logo`, `captions` (booleans), `preset` (`{ job, captions, look }`, in the spec's ids); and the episode's `brand: { logo: "media/<name>" }`. A picture's name is one file in `media/`, never `media/..`.

- [ ] **Step 1: Write the failing tests**

`tool/tests/layout.test.js`:

```js
// The record's layout 2 (phase 4): written only once a record holds a layer of the session's commands, and each layer read
// whole or refused.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newEpisode, episodeFault, layoutOf, writeEpisode, recordFile, RECORD_VERSION } from "../episode.js";

const BASE = { ...newEpisode({ id: "e-20261014-3fa9c1", machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
const REEL = { n: 2, status: "picked", from: 1, to: 9, title: "t", why: "", files: [], pushed: [] };

describe("the record's layout", () => {
  it("is 2 at most here, and 2 only once a record holds a layer of phase 4", () => {
    assert.equal(RECORD_VERSION, 2);
    assert.equal(layoutOf(BASE), 1);
    assert.equal(layoutOf({ ...BASE, reels: [{ ...REEL, captions: true }] }), 1);
    for (const more of [
      { spellings: [["Sally", "Sallie"]] },
      { main: { ...BASE.main, logo: true } },
      { main: { ...BASE.main, preset: { job: "full-episode", captions: "file-only", look: "natural" } } },
      { reels: [{ ...REEL, captions: false }] },
      { reels: [{ ...REEL, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden"] }] }] },
      { brand: { logo: "media/logo.png" } }
    ]) assert.equal(layoutOf({ ...BASE, ...more }), 2, JSON.stringify(more));
  });
  it("is written as the record holds: 1 with nothing laid over it, 2 once it has a spelling, and stays at 2 once written at 2", () => {
    const folder = mkdtempSync(join(tmpdir(), "layout-"));
    try {
      const options = (rev) => ({ expectRev: rev, writeText: (to, text) => writeFileSync(to, text), writer: { commit: "c709b57", on: "Mac Studio" } });
      writeEpisode(folder, BASE, options(0));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 1), "utf8")).version, 1);
      writeEpisode(folder, { ...BASE, rev: 1, spellings: [["Sally", "Sallie"]] }, options(1));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 2), "utf8")).version, 2);
      // Its last spelling taken back: a Mac on older code must still not take it back (ruling 5).
      writeEpisode(folder, { ...BASE, rev: 2, version: 2, spellings: [] }, options(2));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 3), "utf8")).version, 2);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  it("reads each layer whole, or refuses the record", () => {
    assert.equal(episodeFault({ ...BASE, version: 2, main: { ...BASE.main, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden", "Founder"] }], graphics: [{ id: "g1", picture: "media/chart.png", at: 3, for: 2, place: "corner" }], cuts: [{ id: "c1", keep: false, from: 6, to: 9 }] }, reels: [{ ...REEL, captions: false, logo: true, preset: { job: "solo-clip", captions: "bold", look: "warm" } }], brand: { logo: "media/logo.png" } }), "");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: [] }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, graphics: [{ id: "g1", picture: "../secret.png", at: 3, for: 2, place: "corner" }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, reels: [{ ...REEL, cuts: [{ id: "c1", keep: true, from: 9, to: 6 }] }] }), "its Reels cannot be read");
    assert.equal(episodeFault({ ...BASE, brand: { logo: "/Users/x/logo.png" } }), "its logo cannot be read");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, graphics: [{ id: "g1", picture: "media/..", at: 3, for: 2, place: "corner" }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, brand: { logo: "media/." } }), "its logo cannot be read");
    assert.equal(episodeFault({ ...BASE, version: 3 }), "it is version 3, and this brimm-video reads versions 1 to 2");
  });
});
```

And in the four test files named above, each record written to stand for one from a newer brimm-video is version 3: `episode.test.js` (`RECORD_VERSION` is 2 in its first check; the two records `version: 2` of "a newer layout" become `version: 3`), `edit-records.test.js` (one), `edit.test.js` (three), `unedited.test.js` (one). `grep -n "version: 2" tool/tests/*.js` finds them; leave the ones in the `reels`, `reel`, `handoff`, `settings` and `importing` tests, which are other files' versions.

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/layout.test.js tests/episode.test.js`
Expected: FAIL: `layoutOf` is not exported; `RECORD_VERSION` is 1.

- [ ] **Step 3: Write the code**

```diff
--- a/tool/episode.js
+++ b/tool/episode.js
@@ -17,7 +17,12 @@
 export const RECORD_DIR = "record";
 /** The record's layout this brimm-video reads and writes. A record of a higher one is read for what it says, and never
     written: a later brimm-video wrote it. */
-export const RECORD_VERSION = 1;
+/** The newest layout of the record this brimm-video reads and writes. Layout 2 (phase 4) adds what the session's commands
+    record: on each Reel its captions, texts, graphics, cuts, logo and preset, and the episode's logo picture, `brand`, beside
+    the main video's own, which layout 1 already had. A record is written at layout 2 only once it holds one of them
+    (layoutOf), so an episode no phase 4 command has touched is still read by a Mac that knows layout 1 alone, and one that
+    holds them is refused there, never changed by code that would drop them. */
+export const RECORD_VERSION = 2;
 /** The name of a record file: its number, with four digits. */
 const RECORD_NAME = /^(\d{4})\.json$/;
 /** The record file of one rev, in an episode's folder. */
@@ -45,9 +50,30 @@
 const isFiles = (v) => isObject(v) && Object.entries(v).every(([path, bytes]) => isText(path) && !path.startsWith("/") && !path.split("/").includes("..") && isCount(bytes));
 /** A version of a timeline handed to Final Cut: its number from 1, when, on which Mac, and the file kept in edit/. */
 const isPush = (p) => isObject(p) && Number.isInteger(p.v) && p.v >= 1 && isTime(p.at) && isText(p.on) && isText(p.file);
-/** A Reel: its number from 1, where it has got to, its stretch in seconds of the raw video, and its pushes, when it has any. */
-const isReel = (c) => isObject(c) && Number.isInteger(c.n) && c.n >= 1 && REEL_STATUSES.includes(c.status) && isNumber(c.from) && isNumber(c.to) && c.from < c.to && typeof c.title === "string" && (c.pushed === undefined || (Array.isArray(c.pushed) && c.pushed.every(isPush)));
+/** A moment of the raw video, in seconds from its start, and a length after it. */
+const isAt = (v) => isNumber(v) && v >= 0;
+const isLength = (v) => isNumber(v) && v > 0;
+/** A picture in the episode's media/ folder, by its path from the episode's folder. */
+const isPicture = (v) => isText(v) && /^media\/(?!\.\.?$)[^/]+$/.test(v);
+/** The layers a person asks for on a timeline (phase 4): a name title (a name over a role), a graphic at a place, a stretch
+    kept or taken out, each with an id of its own; whether its captions and the logo show; and its preset. */
+const isTextLayer = (t) => isObject(t) && /^t\d+$/.test(t.id) && t.kind === "lower-third" && isAt(t.at) && isLength(t.for) && Array.isArray(t.lines) && t.lines.length >= 1 && t.lines.length <= 2 && t.lines.every(isText);
+const isGraphic = (g) => isObject(g) && /^g\d+$/.test(g.id) && isPicture(g.picture) && isAt(g.at) && isLength(g.for) && ["full", "corner", "lower"].includes(g.place);
+const isCut = (c) => isObject(c) && /^c\d+$/.test(c.id) && typeof c.keep === "boolean" && isAt(c.from) && isNumber(c.to) && c.from < c.to;
+const isPreset = (p) => p === null || p === undefined || (isObject(p) && isText(p.job) && isText(p.captions) && isText(p.look));
+const listOf = (v, each) => v === undefined || (Array.isArray(v) && v.every(each));
+const isLayered = (x) => listOf(x.texts, isTextLayer) && listOf(x.graphics, isGraphic) && listOf(x.cuts, isCut) && [x.logo, x.captions].every((b) => b === undefined || typeof b === "boolean") && isPreset(x.preset);
+/** A Reel: its number from 1, where it has got to, its stretch in seconds of the raw video, its pushes, when it has any, and
+    the layers a person asked for on it (phase 4). */
+const isReel = (c) => isObject(c) && Number.isInteger(c.n) && c.n >= 1 && REEL_STATUSES.includes(c.status) && isNumber(c.from) && isNumber(c.to) && c.from < c.to && typeof c.title === "string" && (c.pushed === undefined || (Array.isArray(c.pushed) && c.pushed.every(isPush))) && isLayered(c);
 
+/** The layout a record is written at: 2 once it holds a layer of phase 4 (a spelling, a text, a graphic, a cut, the logo, a
+    preset, a Reel's captions turned off, or the logo's picture), and 1 while it holds none. */
+export function layoutOf(r) {
+  const layered = (x) => Boolean(x) && (["texts", "graphics", "cuts"].some((k) => Array.isArray(x[k]) && x[k].length > 0) || x.logo === true || Boolean(x.preset) || x.captions === false);
+  return (r.spellings || []).length > 0 || layered(r.main) || (r.reels || []).some(layered) || Boolean(r.brand && r.brand.logo) ? 2 : 1;
+}
+
 /** A new episode's id, made once at the import and never changed: "e-", the day without its dashes, and six hex digits, as
     "e-20261014-3fa9c1". `rand` gives a number from 0 up to 1, as Math.random does: a test gives a stand-in. */
 export const newId = (day, rand = Math.random) => `e-${day.split("-").join("")}-${Math.floor(rand() * 0x1000000).toString(16).padStart(6, "0")}`;
@@ -99,7 +125,7 @@
     are not looked at, since they are kept as they are. */
 export function episodeFault(r) {
   if (!isObject(r)) return "it is not an episode's record";
-  if (r.version !== RECORD_VERSION) return `it is version ${JSON.stringify(r.version)}, and this brimm-video reads version ${RECORD_VERSION}`;
+  if (!Number.isInteger(r.version) || r.version < 1 || r.version > RECORD_VERSION) return `it is version ${JSON.stringify(r.version)}, and this brimm-video reads versions 1 to ${RECORD_VERSION}`;
   const v = r.video;
   const m = r.main;
   const faults = [
@@ -116,7 +142,8 @@
     [r.archived === undefined || r.archived === null || (isObject(r.archived) && isTime(r.archived.at)), "whether it is archived cannot be read"],
     [isFiles(r.files), "its list of files cannot be read"],
     [Array.isArray(r.spellings) && r.spellings.every((s) => Array.isArray(s) && s.length === 2 && s.every(isText)), "its spellings cannot be read"],
-    [isObject(m) && (m.preset === null || isObject(m.preset)) && [m.cuts, m.texts, m.graphics].every(Array.isArray) && typeof m.logo === "boolean" && Array.isArray(m.pushed) && m.pushed.every(isPush) && (m.base === null || isText(m.base)), "its main video cannot be read"],
+    [isObject(m) && [m.cuts, m.texts, m.graphics].every(Array.isArray) && typeof m.logo === "boolean" && isLayered(m) && Array.isArray(m.pushed) && m.pushed.every(isPush) && (m.base === null || isText(m.base)), "its main video cannot be read"],
+    [r.brand === undefined || r.brand === null || (isObject(r.brand) && (r.brand.logo === undefined || isPicture(r.brand.logo))), "its logo cannot be read"],
     [Array.isArray(r.reels) && r.reels.every(isReel), "its Reels cannot be read"],
     [isObject(r.libraries) && Object.values(r.libraries).every(isText), "its libraries cannot be read"],
     [r.finished === null || (isObject(r.finished) && Number.isInteger(r.finished.revision) && r.finished.revision >= 1 && isTime(r.finished.at) && isText(r.finished.on)), "whether it is finished cannot be read"]
@@ -274,7 +301,8 @@
   const copies = conflictedCopies(folder);
   if (copies.length && !pastCopies) throw Object.assign(new Error(conflictWhy(copies)), { code: "CONFLICTED" });
   if (recordNumbers(folder).some((n) => n > expectRev)) throw Object.assign(new Error("this episode changed on the other Mac: open it again"), { code: "CHANGED" });
-  const next = { ...record, rev: expectRev + 1, writer };
+  // A record once written at layout 2 stays at 2: a Mac that knows only 1 would push its Reels without what layout 2 draws.
+  const next = { ...record, version: Math.max(Number.isInteger(record.version) ? record.version : 1, layoutOf(record)), rev: expectRev + 1, writer };
   const fault = episodeFault(next);
   if (fault) throw Object.assign(new Error(`the episode's record was not written, because ${fault}`), { code: "FAULT" });
   mkdirSync(join(folder, RECORD_DIR), { recursive: true });
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS. Every record written so far has no layer of phase 4, so is still written at layout 1.

- [ ] **Step 5: Commit**

```bash
git add tool/episode.js tool/tests/layout.test.js tool/tests/episode.test.js tool/tests/edit-records.test.js tool/tests/edit.test.js tool/tests/unedited.test.js
git commit -m "The record's layout 2: the session's layers, read whole, and written once a record holds one"
```

---

## Task A2: One main project for the import and the push; the guard on its own; a Reel's project takes layers

**Files:**
- Create: `tool/projects.js`, `tool/tests/projects.test.js`
- Modify: `tool/unedited.js` (`finalCut` through `mainProject`; `ideaNotes` exported), `tool/reels.js` (`reelProject` takes layers; `GUESSED` exported), `tool/edit.js` (`guardOf`, out of `pushPart`)

**Interfaces:**
- Consumes: `spelledCaptions` (C4). `fcpxml`'s `titles`, `stills`, `look` and a piece's `position` (C1) are passed through; nothing here needs C1 merged to pass its tests, since a writer given none of them writes as before.
- Produces: `mainProject({ video, facts, more, plan, ranges = plan.ranges, srt, spellings, ideas, titles, stills, look, library, src, project, event, writer }) → { text }` or `{ why }`; `ideaNotes(plan, graphics)` exported from `unedited.js`; `reelProject({ …, planRanges = plan.ranges, titles, stills, look })`, a piece with no crop taking its `guessed` mark for the note; `GUESSED`; in `edit.js`, `guardOf(ctx, found, part, { noHandEdits, handEdits, withoutOther }, doing = "to show it again") → { last, answer }` or `{ why }`, and `pushPart` gains `told = []`, said after "Shown in Final Cut".

- [ ] **Step 1: Write the failing test**

`tool/tests/projects.test.js`:

```js
// The main video's project, one way for the import and for a push: the episode's spellings in its captions, and nothing else
// changed when there are none.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mainProject } from "../projects.js";

const FACTS = { duration: 20, width: 1280, height: 720, fps: "30/1", sound: true, soundStart: 0 };
const PLAN = { ranges: [{ start: 0, end: 10, keep: true, kind: "keep", why: "", phrases: [], text: "" }, { start: 10, end: 20, keep: false, kind: "pause", why: "silence after the last words", phrases: [], text: "" }] };
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sallie.\n\n";

describe("the main video's project", () => {
  it("spells its captions as the episode spells, and leaves them as written with no spelling", () => {
    assert.match(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: PLAN, srt: SRT, spellings: [["Sallie", "Sally"]] }).text, /name="Thank you, Sally\."/);
    assert.match(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: PLAN, srt: SRT }).text, /name="Thank you, Sallie\."/);
  });
  it("says why there is none when nothing is kept", () => {
    assert.deepEqual(mainProject({ video: "/v/a.mp4", facts: FACTS, plan: { ranges: [PLAN.ranges[1]] } }), { why: "the plan keeps nothing" });
  });
});
```

- [ ] **Step 2: Run it, and see it fail**

Run: `cd tool && node --test tests/projects.test.js`
Expected: FAIL: `projects.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/projects.js`:

```js
// The main video's Final Cut project, as the import writes it at the start (edit/main.v0.fcpxml) and as a push writes it
// again once the session has laid something over it or cut it again (phase 4): its kept pieces of the raw video, the whole
// recording's captions on their own timing, a note at each join and Claude's ideas for graphics, and what lies over it.
// Nothing here touches a disk or runs a program.
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { joinNotes, roughRate } from "./cuts.js";
import { captionsOf } from "./lib.js";
import { spelledCaptions } from "./final-transcript.js";

/** The main video's project: {text}, or {why} there is none. `video` is where the file names the raw video, `facts` what
    ffprobe said of it (as factsOf gives them) and `more` what else ffprobe says, for its asset ({ audioRate, audioChannels,
    colorSpace }). `ranges` are the recording's ranges, kept and cut, as a plan's are: the plan's own unless cuts were asked
    for since. `srt` is the whole recording's captions, which keep the sound's timing, so when the sound starts after the
    picture they are moved on as the words are; the episode's `spellings` are applied to them. `ideas` are notes too.
    `titles` and `stills` lie over the picture (layers.js). The text is checked before it is given back. */
export function mainProject({ video, facts, more = {}, plan, ranges = plan.ranges, srt = "", spellings = [], ideas = [], titles = [], stills = [], look = null, library, src, project, event, writer = fcpxml }) {
  if (!facts.height) return { why: "there is no picture in the file" };
  if (!ranges.some((r) => r.keep)) return { why: "the plan keeps nothing" };
  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...more };
  const shift = Math.max(0, facts.soundStart || 0);
  try {
    const captions = captionsOf(spellings.length ? spelledCaptions(srt, spellings) : srt).map((caption) => ({ ...caption, start: caption.start + shift, end: caption.end + shift }));
    const text = writer({ video, facts: said, ranges: ranges.filter((range) => range.keep), captions, markers: [...joinNotes(ranges), ...ideas], titles, stills, look, library: library || undefined, ...(src ? { src } : {}), ...(project ? { project } : {}), ...(event ? { event } : {}) });
    const wrong = checkFcpxml(text, said);
    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
  } catch (e) {
    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
  }
}
```

`tool/unedited.js`:

```diff
--- a/tool/unedited.js
+++ b/tool/unedited.js
@@ -36,6 +36,7 @@
 // While it works, it says how far it has got in a small file on this Mac's own disk (progress.js), and swift runs
 // progress.swift to show that in a small window: closing the window, or its failing to open, changes nothing about the work.
 // "install.sh <folder>" has the Mac run the --watch form whenever something lands in that folder.
+import { mainProject } from "./projects.js";
 import { spawn, spawnSync } from "node:child_process";
 import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync, closeSync, openSync, readSync } from "node:fs";
 import { homedir, tmpdir } from "node:os";
@@ -595,30 +596,18 @@
     the moment that phrase starts, worded so that nobody takes it for more than an idea. An idea whose phrase is cut, or is
     not in the plan, gets none: the Final Cut writer would put it on the join after it, as if it belonged there. The notes
     for the editor say what became of such an idea. */
-function ideaNotes(plan, graphics) {
+export function ideaNotes(plan, graphics) {
   const phrases = new Map(plan.phrases.map((p) => [p.id, p]));
   return graphics.map((idea) => ({ on: phrases.get(idea.id), idea: idea.idea })).filter(({ on }) => on && on.keep).map(({ on, idea }) => ({ at: on.start, text: `Graphic idea: ${idea}` }));
 }
 
-/** The Final Cut file of a plan, for the video at `video`: {text}, or {why} there is none. The kept ranges are its pieces, the
-    captions are those of the whole recording on its own timing, and there is a note at each join. `ideas` are more notes,
-    Claude's ideas for graphics, each at a moment that is kept. The captions keep the timing of the sound, so when the sound
-    starts after the picture they are moved on as the words are. `library` is where Final Cut Pro is to keep the project,
-    and `writer` is what writes the file's text. The text is checked before it is given back, and one with something wrong
-    in it is not: `why` then says what. */
+/** The Final Cut file of a plan, for the video at `video`: {text}, or {why} there is none: the main video's project
+    (projects.js mainProject), with what ffprobe printed of the video for its asset's sound and colour. `library` is where
+    Final Cut Pro is to keep the project, and `writer` is what writes the file's text. */
 function finalCut(video, { plan, facts, spans, srt, printed, ideas = [] }, { library, src, writer = fcpxml }) {
   if (!facts.height) return { why: "there is no picture in the file" };
   if (!spans.length) return { why: "the plan keeps nothing" };
-  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) };
-  const shift = Math.max(0, facts.soundStart);
-  try {
-    const captions = captionsOf(srt).map((caption) => ({ ...caption, start: caption.start + shift, end: caption.end + shift }));
-    const text = writer({ video, facts: said, ranges: plan.ranges.filter((range) => range.keep), captions, markers: [...joinNotes(plan.ranges), ...ideas], library: library || undefined, ...(src ? { src } : {}) });
-    const wrong = checkFcpxml(text, said);
-    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
-  } catch (e) {
-    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
-  }
+  return mainProject({ video, facts, more: { ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) }, plan, srt, ideas, library, src, writer });
 }
 
 async function workOn(file, deps) {
```

`tool/reels.js`:

```diff
--- a/tool/reels.js
+++ b/tool/reels.js
@@ -231,7 +231,7 @@
 export const REEL_FRAME = { width: 1080, height: 1920 };
 
 /** The words of a marker on a stretch whose crop is a guess. */
-const GUESSED = "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.";
+export const GUESSED = "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.";
 
 /** The upright Final Cut project of a Reel candidate: {text}, or {why} there is none. Its stretches are clips one after
     another on a timeline of 1080 by 1920, each filled into the frame and moved onto the face by its crop (reelPosition, in
@@ -243,13 +243,13 @@
     a test to give another. `more` is what else ffprobe says of the video, for its asset: { audioRate, audioChannels,
     colorSpace }, as the main timeline is given them (an HDR video's own colour space goes on its format). The text is
     checked before it is given back, and one with something wrong in it is not: `why` then says what. */
-export function reelProject({ video, facts, candidate, plan, project, event, more = {}, writer = fcpxml }) {
+export function reelProject({ video, facts, candidate, plan, planRanges = plan.ranges, titles = [], stills = [], look = null, project, event, more = {}, writer = fcpxml }) {
   if (!candidate.ranges.length) return { why: "the Reel has no stretch to show" };
   const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...more };
-  const joins = joinNotes(plan.ranges.filter((r) => r.start >= candidate.start && r.end <= candidate.end));
-  const guesses = candidate.ranges.filter((r) => !r.crop.found).map((r) => ({ at: r.start, text: GUESSED }));
+  const joins = joinNotes(planRanges.filter((r) => r.start >= candidate.start && r.end <= candidate.end));
+  const guesses = candidate.ranges.filter((r) => (r.crop ? !r.crop.found : r.guessed)).map((r) => ({ at: r.start, text: GUESSED }));
   try {
-    const text = writer({ video, facts: said, ranges: candidate.ranges, markers: [...guesses, ...joins], frame: REEL_FRAME, project, event });
+    const text = writer({ video, facts: said, ranges: candidate.ranges, markers: [...guesses, ...joins], titles, stills, look, frame: REEL_FRAME, project, event });
     const wrong = checkFcpxml(text, said, { frame: REEL_FRAME });
     return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
   } catch (e) {
```

`tool/edit.js`: the guard leaves `pushPart` and becomes `guardOf`, which phase 4's commands share. In `pushPart`, everything from `const pushed = Array.isArray(target.pushed) …` down to the line before `const v = last + 1;` is replaced by:

```js
  const guard = guardOf(ctx, found, part, { noHandEdits, handEdits, withoutOther });
  if (guard.why) return refuse(ctx, guard.why);
  const { last, answer } = guard;
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
```

`pushPart`'s parameters gain `told = []`, and after its line "Shown in Final Cut as …" it says them:

```js
    // How the timeline was built, said once it is shown (phase 4): what stood in, and what a rule changed.
    for (const line of told) say(line);
```

And `guardOf`, before `push`:

```js
/** The guard, for a part shown in Final Cut before (spec section 4, "the guard"): asked before it is shown again, and before
    a command reads a time or quoted words on it (phase 4). { last, answer }: the version it was last shown as on either
    Mac (0 when never), and what goes in the record of a push; or { why } it cannot go on. A yes to the guard (`handEdits`)
    always stops it. When the other Mac showed it last, only that Mac's answer, carried in the record when it handed the
    episode over, says whether it was changed there; `withoutOther` goes on from that version as brimm-video made it.
    `doing` is what "no changes" lets happen, in the question asked. */
function guardOf(ctx, found, part, { noHandEdits = false, handEdits = false, withoutOther = false } = {}, doing = "to show it again") {
  const { record } = found;
  const target = part === "main" ? record.main : record.reels.find((reel) => reel.n === part.reel);
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  // The version is one more than any the record lists and any this Mac has handed Final Cut, whose copies are kept in
  // pushed/: a push whose record Dropbox took away has used up its version, and its project's name is never handed over twice.
  const kind = part === "main" ? "main" : `reel-${part.reel}`;
  let handed = [];
  try {
    handed = readdirSync(pushedFolder(ctx.home, found.name)).map((n) => new RegExp(`^${kind}\\.v(\\d+)\\.`).exec(n)).filter(Boolean).map((m) => Number(m[1]));
  } catch (e) {
    // Nothing has been handed to Final Cut on this Mac yet.
  }
  const last = Math.max(0, ...pushed.map((p) => p.v), ...handed);
  // The newest push, when another Mac made it: what was done to it there is in that Mac's library, and only that Mac's answer,
  // carried in the record when it handed the episode over, says whether it was changed (spec section 4).
  const top = pushed.reduce((best, p) => (!best || p.v > best.v ? p : best), null);
  const other = top && top.v === last && top.on !== ctx.machine ? top.on : "";
  // A yes to the guard always stops it, whatever else is said with it.
  if (last && handEdits) return { why: `Your changes stay in v${last} in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v${last}.` };
  if (other) {
    const key = part === "main" ? "main" : `reel ${part.reel}`;
    const named = part === "main" ? "the main video" : `reel ${part.reel}`;
    const carried = record.released && record.released.answers && record.released.answers[key];
    const said = carried && carried.v === last ? carried.said : "";
    // Her own "no changes" is about her own Final Cut, and never lifts this.
    if (said === "no changes") return { last, answer: `${other} said no changes since v${last}` };
    if (withoutOther) return { last, answer: `without ${other}'s changes since v${last}` };
    if (said) return { why: `The changes to v${last} of ${named} stay on ${other}, in its Final Cut library: ${other} said so when it handed this over. Finish that part on ${other}, or start again from v${last} without them (say "go ahead without ${other}'s changes").` };
    return { why: `v${last} of ${named} was shown on ${other}, and ${other} has not said whether it was changed there. Ask whoever used it on ${other}. If it was not changed, or to start again from v${last} without those changes, say "go ahead without ${other}'s changes".` };
  }
  if (last && !noHandEdits) return { why: `Did you change v${last} of ${record.name.text} in Final Cut since it was shown? Say "no changes" ${doing}. If you did change it, say so.` };
  return { last, answer: last ? `no hand edits since v${last}` : null };
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS: the import's own tests pass through `mainProject` unchanged, and every test of the push's guard passes through `guardOf` word for word.

- [ ] **Step 5: Commit**

```bash
git add tool/projects.js tool/tests/projects.test.js tool/unedited.js tool/reels.js tool/edit.js
git commit -m "One main project for the import and a push, a Reel's project that takes layers, and the guard on its own"
```

---

## Task A3: A timeline's layers

**Files:**
- Create: `tool/layers.js`, `tool/tests/layers.test.js`

**Interfaces:**
- Consumes: `defaultPreset`, `captionLook`, `titleLook`, `placeOf`, `lookFor` (C2); `captionsFor` (C3); `spellWords` (C4); `clockOfRanges`, `rawAt`, `timelineAt`, `lengthOf` (C6); `relativeUrl` (`fcpxml.js`); `shortId` (`names.js`).
- Produces: `ROLES`, `TOP_BAND`, `HOOK_SECONDS = 3`, `targetOf(record, part)`, `presetOf(record, part)`, `layersFor({ record, part, frame, ranges, words, face, pictures, video, lookPresets }) → { titles, stills, look, told }`, `lookPresets` as `LOOK_PRESETS` unless given. Lanes: graphics 2, the logo 3, captions 4, titles 5 (ruling 14). A Reel draws no logo, and its look is recorded and said (ruling 2, 4). A title at the top of an upright frame is said (ruling 1). Boxed and Signature are said for titles too (ruling 7).

Its tests take every size and place from `styles.js` (`captionLook`, `titleLook`), and the count of characters a title fits; only the caption texts and a Reel title's line break follow `styles.js`'s `chars`, and C9 updates those if a check changes it.

- [ ] **Step 1: Write the failing tests**

`tool/tests/layers.test.js`:

```js
// What brimm-video lays over a timeline's picture, from the record: captions, a Reel's title, texts, graphics and the logo.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf } from "../cuts.js";
import { layersFor, ROLES, HOOK_SECONDS, TOP_BAND } from "../layers.js";
// Sizes and places are styles.js's (by-hand checks 1 and 3 may change them): these tests take them from there.
import { captionLook, titleLook } from "../styles.js";
import { TOLD } from "./fixtures.js";

const WORDS = wordsOf(TOLD);
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const REEL = [{ start: 13.38, end: 16.516 }, { start: 19.219, end: 21.287 }];
const WIDE = { width: 1280, height: 720 };
const UPRIGHT = { width: 1080, height: 1920 };
const ID = "e-20261014-3fa9c1";
const main = (more = {}) => ({ preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null, ...more });
const record = (more = {}) => ({ id: ID, kind: "episode", spellings: [], main: main(), reels: [{ n: 2, status: "picked", from: 13.38, to: 21.287, title: "Know your costs", pushed: [] }], ...more });
const CHART = { "media/chart.png": { width: 1600, height: 900 }, "media/logo.png": { width: 600, height: 300 } };

describe("the layers of the main video", () => {
  it("are none for an episode's main video as the import left it: a full episode draws no captions", () => {
    assert.deepEqual(layersFor({ record: record(), part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" }), { titles: [], stills: [], look: null, told: [] });
  });
  it("are its name titles, on Final Cut's Basic Lower Third when wide, until the time asked, on the timeline's clock", () => {
    const r = record({ main: main({ texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden", "Founder, The BRIMM"] }] }) });
    const { titles } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" });
    assert.equal(titles.length, 1);
    const [t] = titles;
    const look = titleLook("name", { style: "file-only", frame: WIDE, face: "Varela" });
    assert.deepEqual([t.start, Math.round(t.end * 1000) / 1000, t.lane, t.role, t.name, t.template, t.lines.map((l) => [l.text, l.font, l.fontSize])], [15.3, 19.984, 5, ROLES.titles, "brimm text t1 3fa9c1", look.template, [["Sallie Ogden", "Varela", look.lines[0].fontSize], ["Founder, The BRIMM", "Varela", look.lines[1].fontSize]]]);
  });
  it("are its graphics, each its picture from media/ at its place, and the logo kept out of the way of a picture in its corner", () => {
    const r = record({ brand: { logo: "media/logo.png" }, main: main({ logo: true, graphics: [{ id: "g1", picture: "media/chart.png", at: 14.0, for: 2, place: "corner" }] }) });
    const { stills } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela", pictures: CHART });
    assert.deepEqual(stills.map((s) => [s.name, s.src, s.start, Math.round(s.end * 1000) / 1000, s.lane]), [
      ["brimm graphic g1 3fa9c1", "../media/chart.png", 14, 16, 2],
      ["brimm logo 3fa9c1", "../media/logo.png", 5.87, 14, 3],
      ["brimm logo 3fa9c1", "../media/logo.png", 16, 21.297, 3]
    ]);
  });
  it("say a text that is in what is cut now is not shown", () => {
    const r = record({ main: main({ texts: [{ id: "t1", kind: "lower-third", at: 11, for: 4, lines: ["Sallie Ogden"] }] }) });
    assert.deepEqual(layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" }).told, ['The name title t1 ("Sallie Ogden") is in what is cut now, so it is not shown.']);
  });
});

describe("the layers of a Reel", () => {
  it("are its running captions, Plain, spelled as the episode spells, and its title on screen for its first seconds", () => {
    const r = record({ spellings: [["Sallie", "Sallie Ogden"]] });
    const { titles, told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const captions = titles.filter((t) => t.role === ROLES.captions);
    assert.deepEqual(captions.map((c) => c.lines.map((l) => l.text).join(" / ")), ["So the first thing", "you need to do", "is know your costs.", "Thank you so much,", "Sallie Ogden."]);
    const look = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([captions[0].name, captions[0].lane, captions[0].position, captions[0].lines[0].fontSize], ["brimm caption 1 3fa9c1", 4, look.position, look.fontSize]);
    const hook = titles.find((t) => t.name === "brimm hook 3fa9c1");
    assert.deepEqual([hook.start, Math.round(hook.end * 1000) / 1000, hook.lines.map((l) => l.text), hook.position], [13.38, 16.38, ["Know your", "costs"], titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).position]);
    assert.equal(HOOK_SECONDS, 3);
    // Its title sits at the top, where it can cover her face: said, since where the face is is not read yet (ruling 1).
    assert.deepEqual(told, ["1 caption still shows for under 0.83 s, and 1 still runs faster than 20 characters a second.", TOP_BAND]);
  });
  it("leave a Reel's logo and look for the brand templates, and say its look is recorded", () => {
    const r = record({ brand: { logo: "media/logo.png" }, reels: [{ ...record().reels[0], captions: false, title: "", logo: true, preset: { job: "solo-clip", captions: "plain", look: "warm" } }] });
    const made = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela", pictures: CHART });
    assert.deepEqual([made.stills, made.look, made.told], [[], null, ["A Reel's look comes with the brand templates, later: warm is recorded for Reel 2."]]);
  });
  it("put words above pictures: graphics lowest, then the logo, the captions and the titles", () => {
    const r = record({ brand: { logo: "media/logo.png" }, main: main({ logo: true, preset: { job: "teaching-clip", captions: "plain", look: "natural" }, texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden"] }], graphics: [{ id: "g1", picture: "media/chart.png", at: 14.0, for: 2, place: "full" }] }) });
    const { titles, stills } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela", pictures: CHART });
    const lane = (name) => [...titles, ...stills].find((x) => x.name.startsWith(name)).lane;
    assert.deepEqual(["brimm graphic", "brimm logo", "brimm caption", "brimm text"].map(lane), [2, 3, 4, 5]);
  });
  it("start a name title asked for while a Reel's title on screen shows once that title ends: both sit at the top", () => {
    const r = record({ reels: [{ ...record().reels[0], captions: false, texts: [{ id: "t1", kind: "lower-third", at: 14, for: 3, lines: ["Sallie Ogden"] }] }] });
    const { titles, told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    assert.deepEqual(titles.map((t) => [t.name, Math.round(t.start * 1000) / 1000]), [["brimm hook 3fa9c1", 13.38], ["brimm text t1 3fa9c1", 16.38]]);
    assert.deepEqual(told, ["The name title t1 starts once Reel 2's title on screen ends, 3 seconds in: both sit at the top.", TOP_BAND]);
  });
  it("say once what Signature does not draw yet, for the captions and for the titles", () => {
    const r = record({ reels: [{ ...record().reels[0], preset: { job: "solo-clip", captions: "signature", look: "natural" }, texts: [{ id: "t1", kind: "lower-third", at: 19.5, for: 1, lines: ["Sallie Ogden"] }] }] });
    const { told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    assert.deepEqual(told.filter((t) => t.startsWith("Signature")), ["Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade.", "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain."]);
  });
  it("draw no captions on a Reel whose captions are turned off", () => {
    const r = record({ reels: [{ ...record().reels[0], captions: false }] });
    assert.deepEqual(layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" }).titles.map((t) => t.name), ["brimm hook 3fa9c1"]);
  });
  it("draw a title too wide for two lines smaller, and leave out one that does not fit even at 70%", () => {
    const long = (title) => record({ reels: [{ ...record().reels[0], captions: false, title }] });
    const drawn = layersFor({ record: long("Charge what your expertise is worth"), part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const full = titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).lines[0].fontSize;
    assert.deepEqual([drawn.titles[0].lines.map((l) => l.text), drawn.titles[0].lines[0].fontSize, drawn.told], [["Charge what your", "expertise is worth"], Math.round(full * 0.7), ["The title on screen is drawn at 70% of its size to fit two lines.", TOP_BAND]]);
    const gone = layersFor({ record: long("Everything you were never told about pricing your consulting offers"), part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const fit = Math.floor((titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).chars / 0.7) * 2);
    assert.deepEqual([gone.titles, gone.told], [[], [`No title on screen: "Everything you were never told about pricing your consulting offers" does not fit two lines, even at the smallest size. About ${fit} characters fit. Give a shorter one.`]]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/layers.test.js`
Expected: FAIL: `layers.js` cannot be found.

- [ ] **Step 3: Write the code**

`tool/layers.js`:

```js
// What brimm-video lays over a timeline's picture (spec section 4): its running captions, a Reel's title on screen, the texts
// and graphics a person asked for, and the logo, each from the record, as the titles and pictures the Final Cut writer takes
// (fcpxml.js). Each is on a role of brimm-video's own, with the episode's short id in its name, so a later version can tell
// it from hand work (spec section 4, "Roles"; phase 5). Every time here is in seconds of the raw video.
// Nothing here touches a disk or runs a program.
import { relativeUrl } from "./fcpxml.js";
import { shortId } from "./names.js";
import { defaultPreset, captionLook, titleLook, placeOf, lookFor } from "./styles.js";
import { captionsFor } from "./captions.js";
import { spellWords } from "./spelling.js";
import { clockOfRanges, rawAt, timelineAt, lengthOf } from "./clock.js";

/** The roles, and the lanes above the picture each goes on. A higher lane is drawn on top, so words go above pictures:
    graphics, then the logo, then the captions, then the titles. */
export const ROLES = { captions: "BRIMM captions", titles: "BRIMM titles" };
/** What a push says of a title at the top of an upright video. */
export const TOP_BAND = "A title at the top of an upright video can cover a face: check it by eye in Final Cut.";
const LANES = { graphics: 2, logo: 3, captions: 4, titles: 5 };
/** How long a Reel's title shows from its start, in seconds (the research's D1). */
export const HOOK_SECONDS = 3;
/** A title too wide for its lines is drawn smaller, down to this share of its size, and past it left out (rule 8). */
const SMALLEST = 0.7;

/** The part's own entry in the record: the main video's, or a Reel's. */
export const targetOf = (record, part) => (part === "main" ? record.main : (record.reels || []).find((r) => r.n === part.reel));
/** The part's preset: the one picked, or its default. */
export const presetOf = (record, part) => targetOf(record, part).preset || defaultPreset(record.kind, part);

/** Words in at most two lines of `chars` characters each, split where the longer line is shortest: the lines, or null. */
function twoLines(text, chars) {
  if (text.length <= chars) return [text];
  const words = text.split(" ");
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    if (pair.every((l) => l.length <= chars) && (!best || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length)))) best = pair;
  }
  return best;
}

/** The second of the raw video `seconds` after `at` on the timeline, or the timeline's end. */
const rawAfter = (clock, at, seconds) => {
  const t = timelineAt(clock, at);
  if (t === null) return null;
  const end = Math.min(t + seconds, lengthOf(clock));
  return rawAt(clock, end);
};

/** The titles and pictures over one timeline: { titles, stills, told }. `record` is the episode's record; `part` is "main" or
    { reel: n }; `frame` is the timeline's size; `ranges` its kept pieces, in order; `words` the recording's words; `face`
    the stand-in face to draw in; `pictures` the size of each picture the record names, by its path in the episode's
    folder ("media/chart.png"); `video` is the raw video's { height, hdr }, for its look; `lookPresets` the looks' presets, as
    styles.js LOOK_PRESETS unless given (a test gives its own). Gives { titles, stills, look, told }, `look` as the Final Cut
    writer takes it, or null. */
export function layersFor({ record, part, frame, ranges, words, face, pictures = {}, video = { height: frame.height, hdr: false }, lookPresets }) {
  const target = targetOf(record, part);
  const preset = presetOf(record, part);
  const short = shortId(record.id);
  const clock = clockOfRanges(ranges);
  const titles = [];
  const stills = [];
  const told = [];
  const shadowed = (fontSize, shadow) => ({ font: face, fontSize, shadow });

  // The running captions: a Reel's unless they are turned off, and the main video's as its preset says.
  if (part === "main" || target.captions !== false) {
    const look = captionLook({ style: preset.captions, job: preset.job, frame, face });
    if (look.told) told.push(look.told);
    if (look.draws) {
      const made = captionsFor({ words: spellWords(words, record.spellings), ranges, look });
      told.push(...made.told);
      made.captions.forEach((c, i) => titles.push({ start: c.start, end: c.end, lane: LANES.captions, role: ROLES.captions, name: `brimm caption ${i + 1} ${short}`, lines: c.lines.map((text) => ({ text, ...shadowed(Math.round(look.fontSize * c.scale), look.shadow), alignment: look.alignment })), position: look.position }));
    }
  }

  // A Reel's title on screen, from its start, in the top band (rule 8: drawn smaller to fit two lines, or left out).
  let hookEnd = null;
  if (part !== "main" && String(target.title || "").trim() && ranges.length) {
    const look = titleLook("hook", { style: preset.captions, frame, face });
    if (look.told) told.push(look.told);
    const text = look.caps ? target.title.trim().toLocaleUpperCase("en") : target.title.trim();
    let scale = 1;
    let lines = twoLines(text, look.chars);
    while (!lines && scale > SMALLEST + 0.001) {
      scale = Math.round((scale - 0.05) * 100) / 100;
      lines = twoLines(text, Math.floor(look.chars / scale));
    }
    if (!lines) told.push(`No title on screen: "${target.title.trim()}" does not fit two lines, even at the smallest size. About ${Math.floor((look.chars / SMALLEST) * 2)} characters fit. Give a shorter one.`);
    else {
      if (scale < 1) told.push(`The title on screen is drawn at ${Math.round(scale * 100)}% of its size to fit two lines.`);
      const end = rawAfter(clock, ranges[0].start, HOOK_SECONDS);
      hookEnd = end;
      titles.push({ start: ranges[0].start, end, lane: LANES.titles, role: ROLES.titles, name: `brimm hook ${short}`, lines: lines.map((l, i) => ({ text: l, ...shadowed(Math.round(look.lines[i].fontSize * scale), look.lines[i].shadow), alignment: look.lines[i].alignment })), position: look.position });
    }
  }

  // The texts a person asked for: a name over a role. On a Reel, one asked for while its title on screen shows waits for it to
  // end: both sit in the top band.
  for (const asked of target.texts || []) {
    const text = hookEnd !== null && asked.at < hookEnd ? { ...asked, at: hookEnd } : asked;
    if (text !== asked) told.push(`The name title ${asked.id} starts once Reel ${part.reel}'s title on screen ends, ${HOOK_SECONDS} seconds in: both sit at the top.`);
    const end = rawAfter(clock, text.at, text.for);
    if (end === null) {
      told.push(`The name title ${text.id} ("${text.lines[0]}") is in what is cut now, so it is not shown.`);
      continue;
    }
    const look = titleLook("name", { style: preset.captions, frame, face });
    if (look.told && !told.includes(look.told)) told.push(look.told);
    const lines = text.lines.map((l, i) => ({ text: look.caps && i === 0 ? l.toLocaleUpperCase("en") : l, ...shadowed(look.lines[Math.min(i, 1)].fontSize, look.lines[Math.min(i, 1)].shadow), alignment: look.lines[Math.min(i, 1)].alignment }));
    titles.push({ start: text.at, end, lane: LANES.titles, role: ROLES.titles, name: `brimm text ${text.id} ${short}`, template: look.template, lines, position: look.position });
  }

  // The research's rule 3 leaves out a title in the top band that meets the face; brimm-video does not read where the face is
  // in each frame yet (phase 6), so it is said instead (ruling 1).
  if (frame.height > frame.width && titles.some((t) => t.role === ROLES.titles)) told.push(TOP_BAND);

  // The graphics, each a picture from the episode's media/.
  const corners = [];
  for (const graphic of target.graphics || []) {
    const end = rawAfter(clock, graphic.at, graphic.for);
    const size = pictures[graphic.picture];
    if (end === null) {
      told.push(`The graphic ${graphic.id} (${graphic.picture.replace(/^media\//, "")}) is in what is cut now, so it is not shown.`);
      continue;
    }
    if (!size) {
      told.push(`The graphic ${graphic.id}'s picture, ${graphic.picture}, cannot be read, so it is not shown.`);
      continue;
    }
    const place = placeOf(graphic.place, { frame, picture: size });
    stills.push({ start: graphic.at, end, lane: LANES.graphics, role: ROLES.titles, name: `brimm graphic ${graphic.id} ${short}`, src: relativeUrl(`../${graphic.picture}`), width: size.width, height: size.height, ...place });
    if (graphic.place === "corner") corners.push([graphic.at, end]);
  }

  // The logo, over the whole main video, out of the way of a picture in its corner. A Reel's comes with the brand templates
  // (spec section 3: a Reel gains "the look and the logo in phase 6").
  const logo = record.brand && record.brand.logo;
  if (part === "main" && target.logo && logo && ranges.length) {
    const size = pictures[logo];
    if (!size) told.push(`The logo's picture, ${logo}, cannot be read, so it is not shown.`);
    else {
      let from = ranges[0].start;
      const spans = [];
      for (const [a, b] of [...corners].sort((x, y) => x[0] - y[0])) {
        if (a > from) spans.push([from, a]);
        from = Math.max(from, b);
      }
      spans.push([from, ranges[ranges.length - 1].end]);
      const place = placeOf("logo", { frame, picture: size });
      for (const [a, b] of spans.filter(([a, b]) => b > a)) stills.push({ start: a, end: b, lane: LANES.logo, role: ROLES.titles, name: `brimm logo ${short}`, src: relativeUrl(`../${logo}`), width: size.width, height: size.height, ...place });
    }
  }
  // The look, on the whole picture: Final Cut's own colour preset, with its Mix (styles.js lookFor). A Reel's is recorded, and
  // comes with the brand templates (spec section 3).
  if (part !== "main") {
    if (preset.look !== "natural") told.push(`A Reel's look comes with the brand templates, later: ${preset.look} is recorded for Reel ${part.reel}.`);
    // An HDR recording is said on a Reel too: Final Cut converts its colours for the upright timeline (rule 7).
    if (video.hdr) told.push(lookFor({ look: "natural", height: video.height, hdr: true }).told);
    return { titles, stills, look: null, told };
  }
  const graded = lookFor({ look: preset.look, height: video.height, hdr: video.hdr }, lookPresets);
  if (graded.told) told.push(graded.told);
  return { titles, stills, look: graded.effect, told };
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/layers.js tool/tests/layers.test.js
git commit -m "A timeline's layers from the record: captions, a Reel's title, name titles, graphics, the logo and the look"
```

---

## Task A4: What a push hands Final Cut, push through it, and `captions`

**Files:**
- Create: `tool/timeline.js`, `tool/tests/timeline.test.js`, `tool/tests/phase4.js` (the made-up episode phase 4's tests share), `tool/tests/edit-session.test.js`, `tool/tests/studio-ready.test.js`
- Modify: `tool/edit.js` (`push` and `pushReel` through `timelineFor`; `partFrom`, `partLabel`, `withPart`, `SHOW_IT`, `layerStart`, `captions`; the table; the help), `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: A1 to A3; `fcpxml` (C1), `faceOnThisMac` (C2), `pictureSize` (C5), `clockOf`, `clockOfRanges`, `heardWords` (C6), `rangesWith`, `keptOf`, `croppedLike`, `cutPhrases` (C7); `jpegOf` (C5's fixture); PR 19's `reelTimeline`, `readReels`, `reelProject`, `REELS_FILE`, `REEL_FRAME`, `pickReels`.
- Produces: `fontFolders(home)`, `fontFiles(home)`; `layered(record, part)`, true for every Reel and for a main video that draws anything, a short video's from its first push; `piecesOf(found, part, ctx, extra) → { plan, words, hasWords, wordsFile, stem, ranges, pieces, span?, picked, need }` or `{ coming, bring }`, `{ why }`, `{ old: true }`, with `plan.ranges` as they are while no cut is asked for (ruling 3) and the words as heard; `timelineFor(found, part, ctx) → { xml, told }` or `{ coming, bring }`, `{ why }`, HDR read from the colour itself (HLG or PQ) and said on a Reel too, each picture's size as shown, Claude's graphic ideas as her cuts leave them, the looks' presets from `ctx.deps.lookPresets` when a test gives them; `clockFor(found, part, ctx) → { …piecesOf, clock, on }`. `ctx.deps.fontFiles`, for a test to give the font files a Mac has. In `edit.js`: `partFrom(words)`, `partLabel(part)`, `withPart(record, part, change)`, `SHOW_IT`, `layerStart(ctx, words, { writes = true }) → { found, part, target, words }` or `{ code }` (a command that only reads passes `writes: false`, and checks neither the claim, a running command, a hand-edited timeline nor a clip Reel), and `captions "<episode>" reel <n> on|off`.

What changes for her: a Reel shown in Final Cut gains its running captions and its title on screen (ruling 1), and she can turn its captions off. The main video is pushed as the import wrote it until something is laid over it; a short video's main draws its captions from its first push.

- [ ] **Step 1: Write the failing tests**

`tool/tests/phase4.js`:

```js
// The made-up episode phase 4's tests share: phase 3's, with the files a phase 4 push reads too.
import { writeFileSync } from "node:fs";
import { wordsOf, pausesOf, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { reelCandidates, reelsFile, reelEntries, previewPath } from "../reels.js";
import { mainProject } from "../projects.js";
import { ideaNotes } from "../unedited.js";
import { relativeMedia } from "../portable.js";
import { TOLD, PAUSES, probed } from "./fixtures.js";
import { setup, episodeFor, NAME } from "./episodes.js";

export const SRT = "1\n00:00:06,070 --> 00:00:07,040\nWelcome to the show.\n\n2\n00:00:19,414 --> 00:00:21,097\nThank you so much, Sallie.\n\n";

/** The made-up recording of fixtures.js, as phase 3's tests make it, with the files a phase 4 push reads too: the words, the
    whole recording's captions, and the import's own main timeline. */
/** The episode's files, made from the pauses ffmpeg heard: `drop` takes out the heard pauses of those numbers, as a recording
    whose lead-in or tail has a sound with no words to it. `guessed` marks Reel 2's first stretch as one where no face was
    found. `picked` is whether Reel 2 is picked in the record. */
export const episodeFiles = ({ drop = [], guessed = false, picked = true } = {}) => {
  const heard = pausesOf(PAUSES).filter((_, i) => !drop.includes(i));
  const facts = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
  const read = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [{ from: "p4", to: "p5", hook: "The opening", why: "It says what the talk is about." }, { from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
  const words = wordsOf(TOLD);
  const plan = applyDecisions(cutPlan(phrasesOf(words, heard), { duration: facts.duration, pauses: heard }), read.decisions, heard).plan;
  const stills = Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.2 }] }));
  const candidates = reelCandidates({ clips: clipRanges(plan, read.clips, heard).clips, plan, facts, stills }).map((c) => ({ ...c, preview: previewPath(c.n) }))
    .map((c) => (guessed && c.n === 2 ? { ...c, ranges: c.ranges.map((r, i) => (i === 0 ? { ...r, crop: { ...r.crop, found: false } } : r)) } : c));
  const stored = { version: 1, video: "Pricing talk.mp4", facts, phrases: plan.phrases, ranges: plan.ranges, kept: plan.kept, cut: plan.cut, by: plan.by, claude: { graphics: [{ id: "p7", idea: "A chart of what it costs to run the business" }] } };
  const v0 = mainProject({ video: "/x/Pricing talk.mp4", facts, more: { audioRate: 48000, audioChannels: 2 }, plan: stored, srt: SRT, ideas: ideaNotes(stored, stored.claude.graphics) }).text;
  const files = {
    "Pricing talk.mp4": "the raw video",
    "Pricing talk.cut-plan.json": JSON.stringify(stored),
    "Pricing talk.words.json": JSON.stringify({ video: "Pricing talk.mp4", duration: facts.duration, words }),
    "Pricing talk.srt": SRT,
    "reels.json": JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates }), null, 2) + "\n",
    "edit/main.v0.fcpxml": relativeMedia(v0, { from: "/x/edit/a.fcpxml", to: "/x/edit/a.fcpxml", episode: "/x" }).xml
  };
  const record = { name: { text: NAME, placeholder: false }, reels: reelEntries(candidates).map((r) => (r.n === 2 && picked ? { ...r, status: "picked" } : r)) };
  return { files, record };
};
export const EPISODE = episodeFiles();
export const rawProbe = (args) => {
  writeFileSync(args[args.indexOf("-o") + 1], probed({ sound: { sample_rate: "48000", channels: 2 } }));
  return { code: 0, stderr: "" };
};
export const episode = (record = {}, programs = {}, made = EPISODE) => {
  const t = setup({ programs: { FFPROBE: rawProbe, ...programs } });
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  const found = episodeFor(t, { record: { ...made.record, ...record }, files: made.files });
  return { t, found };
};
```

`tool/tests/timeline.test.js`:

```js
// The timeline a push hands to Final Cut, built from the record once the session has given it anything (phase 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REEL_FRAME } from "../reels.js";
import { checkFcpxml } from "../fcpxml.js";
import { timelineFor, layered } from "../timeline.js";
import { EPISODE, episode, episodeFiles } from "./phase4.js";
import { probed, jpegOf } from "./fixtures.js";
import { editMain, pickReels } from "../edit.js";
import { pushedFolder } from "../settings.js";
import { readdirSync, readFileSync } from "node:fs";
import { FOLDER, reread } from "./episodes.js";
import { GUESSED } from "../reels.js";
import { clockOf } from "../clock.js";

const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}

describe("a push, through what it hands to Final Cut", () => {
  it("shows a Reel with its captions and its title on screen, and says what stood in for Varela once it is shown", async () => {
    const { t } = episode();
    t.ctx.deps.fontFiles = () => ["LucidaGrande.ttc"];
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "2");
    assert.equal(r.code, 0, r.text);
    const lines = r.text.split("\n");
    assert.match(lines[0], /^Shown in Final Cut as "Pricing- what to charge- reel 2 v1 3fa9c1"/);
    assert.equal(lines[1], "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book.");
    const dir = pushedFolder(t.home, FOLDER);
    const handed = readFileSync(join(dir, readdirSync(dir).find((n) => n.startsWith("reel-2.v1"))), "utf8");
    assert.ok(tags(handed, "title").some((x) => x.role === "BRIMM captions"));
    assert.ok(tags(handed, "title").some((x) => x.name === "brimm hook 3fa9c1"));
    t.done();
  });
  it("builds a picked Reel on the project written at its pick: its clips and moves as they were, its note of a guessed crop once", async () => {
    const made = episodeFiles({ guessed: true, picked: false });
    const { t, found } = episode({}, {}, made);
    assert.equal(await pickReels(t.ctx, found, [2]), 0);
    const now = { ...found, record: reread(found) };
    const v0 = readFileSync(join(found.folder, "edit", "reel-2.v0.fcpxml"), "utf8");
    const built = await timelineFor(now, { reel: 2 }, t.ctx);
    assert.ok(built.xml, built.why);
    const clips = (xml) => clockOf(xml).map((p) => [p.from, p.to, p.position]);
    assert.deepEqual(clips(built.xml), clips(v0));
    assert.equal(tags(built.xml, "marker").filter((m) => m.value.split(" / ").includes(GUESSED)).length, 1);
    assert.ok(tags(built.xml, "title").some((x) => x.role === "BRIMM captions"));
    assert.ok(tags(built.xml, "title").some((x) => x.name === "brimm hook 3fa9c1"));
    assert.deepEqual(checkFcpxml(built.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    // A cut in the Reel keeps each piece's move as the pick wrote it, and its note that the face was guessed.
    const cut = { ...now, record: { ...now.record, version: 2, reels: now.record.reels.map((r) => (r.n === 2 ? { ...r, cuts: [{ id: "c1", keep: false, from: 19.414, to: 21.097 }] } : r)) } };
    const after = await timelineFor(cut, { reel: 2 }, t.ctx);
    assert.deepEqual(clockOf(after.xml).map((p) => p.position), [clips(v0)[0][2]]);
    assert.equal(tags(after.xml, "marker").filter((m) => m.value.split(" / ").includes(GUESSED)).length, 1);
    assert.deepEqual(checkFcpxml(after.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    t.done();
  });
});

describe("the timeline a push hands to Final Cut", () => {
  it("is the import's own main timeline while nothing is laid over it", async () => {
    const { t, found } = episode();
    assert.equal(layered(found.record, "main"), false);
    assert.deepEqual(await timelineFor(found, "main", t.ctx), { xml: EPISODE.files["edit/main.v0.fcpxml"], told: [] });
    t.done();
  });
  it("is built the same as the import's, once a preset is picked that draws nothing on it", async () => {
    const { t, found } = episode();
    const record = { ...found.record, main: { ...found.record.main, preset: { job: "full-episode", captions: "file-only", look: "natural" } } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.equal(made.xml.replace(/ name="[^"]*"/g, ""), EPISODE.files["edit/main.v0.fcpxml"].replace(/ name="[^"]*"/g, ""));
    t.done();
  });
  it("keeps the import's own pieces once a spelling is laid over it, on a recording whose tail the phrase gaps cannot show", async () => {
    // ffmpeg heard no silence after the last words: the plan keeps the tail, a sound with no words to it.
    const made = episodeFiles({ drop: [7] });
    const { t, found } = episode({}, {}, made);
    const record = { ...found.record, version: 2, spellings: [["Sallie", "Sally"]] };
    const built = await timelineFor({ ...found, record }, "main", t.ctx);
    const clips = (xml) => tags(xml, "asset-clip").map((c) => [c.offset, c.start, c.duration]);
    assert.deepEqual(clips(built.xml), clips(made.files["edit/main.v0.fcpxml"]));
    assert.match(built.xml, /Thank you so much, Sally\./);
    t.done();
  });
  it("has a name title on the main video, on the Basic Lower Third, in Varela", async () => {
    const { t, found } = episode();
    const record = { ...found.record, version: 2, main: { ...found.record.main, texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden", "Founder, The BRIMM"] }] } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.deepEqual(tags(made.xml, "title").map((x) => [x.name, x.role, x.lane]), [["brimm text t1 3fa9c1", "BRIMM titles", "5"], ["brimm text t1 3fa9c1", "BRIMM titles", "5"]]);
    assert.deepEqual(checkFcpxml(made.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }), []);
    assert.deepEqual(made.told, []);
    t.done();
  });
  it("puts no look on an HDR recording, PQ as well as HLG, and says so", async () => {
    for (const color_transfer of ["smpte2084", "arib-std-b67"]) {
      const hdr = (args) => {
        writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: { color_primaries: "bt2020", color_transfer }, sound: { sample_rate: "48000", channels: 2 } }));
        return { code: 0, stderr: "" };
      };
      const { t, found } = episode({}, { FFPROBE: hdr });
      const record = { ...found.record, version: 2, main: { ...found.record.main, preset: { job: "full-episode", captions: "file-only", look: "bright" } } };
      const made = await timelineFor({ ...found, record }, "main", t.ctx);
      assert.match(made.told.join(" "), /This recording is HDR/, color_transfer);
      // A Reel of it says so too: Final Cut converts its colours for the upright timeline as well.
      assert.match((await timelineFor(found, { reel: 2 }, t.ctx)).told.join(" "), /This recording is HDR: Final Cut converts its colours/, color_transfer);
      t.done();
    }
  });
  it("reads a phone photo's size as it is shown, turned upright, from a JPEG whose frame comes after a large EXIF part", async () => {
    const { t, found } = episode();
    mkdirSync(join(found.folder, "media"), { recursive: true });
    writeFileSync(join(found.folder, "media", "photo.jpg"), jpegOf(4032, 3024, { orientation: 6, padding: 70000 }));
    const record = { ...found.record, version: 2, main: { ...found.record.main, graphics: [{ id: "g1", picture: "media/photo.jpg", at: 14, for: 2, place: "full" }] } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.deepEqual(tags(made.xml, "format").find((f) => f.name === "FFVideoFormatRateUndefined"), { id: "r4", name: "FFVideoFormatRateUndefined", width: "3024", height: "4032" });
    t.done();
  });
  it("is a picked Reel's own project with its captions, and its title on screen, upright", async () => {
    const { t, found } = episode();
    const made = await timelineFor(found, { reel: 2 }, t.ctx);
    assert.ok(made.xml, made.why);
    const titles = tags(made.xml, "title");
    assert.ok(titles.some((x) => x.role === "BRIMM captions"));
    assert.ok(titles.some((x) => x.name === "brimm hook 3fa9c1"));
    assert.deepEqual(checkFcpxml(made.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    t.done();
  });
  it("says Lucida Grande stands in when Varela is not on this Mac", async () => {
    const { t, found } = episode();
    t.ctx.deps.fontFiles = () => ["LucidaGrande.ttc"];
    const made = await timelineFor(found, { reel: 2 }, t.ctx);
    assert.equal(made.told[0], "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book.");
    t.done();
  });
  it("brings over what Dropbox has not brought yet, a picture included", async () => {
    const { t, found } = episode();
    mkdirSync(join(found.folder, "media"), { recursive: true });
    writeFileSync(join(found.folder, "media", "chart.png"), "png");
    t.ctx.isWhole = (path) => !path.endsWith("chart.png");
    const record = { ...found.record, main: { ...found.record.main, graphics: [{ id: "g1", picture: "media/chart.png", at: 15.3, for: 2, place: "lower" }] } };
    assert.deepEqual(await timelineFor({ ...found, record }, "main", t.ctx), { coming: "media/chart.png", bring: ["media/chart.png"] });
    t.done();
  });
});
```

`tool/tests/edit-session.test.js`, its head and the tests of `captions`; later tasks add their own `describe` blocks to it, and their rows to the two tests here that run every command:

```js
// The session's commands (phase 4), end to end on the made-up episode: spell, logo, captions, text, graphic, preset and
// cut, each recording what it is asked in the record, and the next push showing it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { pushedFolder } from "../settings.js";
import { FOLDER, EDITED, reread, setup, episodeFor } from "./episodes.js";
import { recordFile, recordText } from "../episode.js";
import { buildHandoff, handoffText, handoffFault } from "../handoff.js";
import { episodeWork } from "../settings.js";
import { episode } from "./phase4.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
/** The copy the newest push handed to Final Cut. */
const handed = (t, kind) => {
  const names = readdirSync(pushedFolder(t.home, FOLDER)).filter((n) => n.startsWith(`${kind}.v`)).sort();
  return readFileSync(join(pushedFolder(t.home, FOLDER), names[names.length - 1]), "utf8");
};
/** A PNG's first bytes, of a size, as a picture in her Pictures folder. */
const picture = (t, name, width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  const dir = join(t.home, "BRIMM Video Studio", "Pictures");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), b);
};

describe("the session's commands, while the other Mac has the episode", () => {
  it("each refuses a change, says who has it, and writes nothing, a picture included", async () => {
    const asks = [
      ["captions", FOLDER, "reel", "2", "off"]
    ];
    for (const ask of asks) {
      const { t, found } = episode({ editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
      picture(t, "logo.png", 600, 300);
      picture(t, "chart.png", 1600, 900);
      const r = await on(t.ctx.deps, ...ask);
      assert.deepEqual([r.code, r.text], [1, 'Sallie\'s laptop has Pricing: what to charge? open. Open it here first (say "take it over" if they are done with it). Nothing was changed.'], ask[0]);
      assert.equal(reread(found).rev, 1, ask[0]);
      assert.equal(existsSync(join(found.folder, "media")), false, ask[0]);
      t.done();
    }
  });
});

describe("captions", () => {
  it("are on a Reel unless turned off, and the main video's follow its caption style", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2")).code, 0);
    assert.ok(tags(handed(t, "reel-2"), "title").some((x) => x.role === "BRIMM captions"));
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "reel", "2", "off")).code, 0);
    assert.equal(reread(found).reels.find((r) => r.n === 2).captions, false);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2", "--no-hand-edits")).code, 0);
    assert.ok(!tags(handed(t, "reel-2"), "title").some((x) => x.role === "BRIMM captions"));
    // Its title on screen stays: only the captions were turned off.
    assert.ok(tags(handed(t, "reel-2"), "title").some((x) => x.name === "brimm hook 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "main", "on")).text, "The main video's captions follow its caption style: say which (preset --captions).");
    assert.equal((await on(t.ctx.deps, "captions", FOLDER, "reel", "1", "on")).text, "Reel 1 is not picked. Pick it first.");
    t.done();
  });
});

describe("a Reel cut as a clip, before Reels had projects of their own", () => {
  it("is shown as before when the record asks for something on it, and the push says what is not shown", async () => {
    const t = setup();
    episodeFor(t, { record: { ...EDITED, spellings: [["Hormozy", "Hormozi"]] } });
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "1", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /\nReel 1 was cut as a clip before Reels had projects of their own, so what was asked for on it is not shown\. Change it by hand in Final Cut\./);
    t.done();
  });
  it("refuses what would be laid over it, which nothing can be, rather than keep it and show nothing", async () => {
    const t = setup();
    episodeFor(t, { record: EDITED });
    const asks = [
      ["captions", FOLDER, "reel", "1", "off"]
    ];
    for (const argv of asks) {
      assert.equal((await on(t.ctx.deps, ...argv)).text, "Reel 1 was cut as a clip before Reels had projects of their own, so brimm-video cannot change it: make this change by hand in Final Cut.", argv.join(" "));
    }
    t.done();
  });
});
```

`tool/tests/studio-ready.test.js` (each later task adds its own words to `LANDED`):

```js
// What her skill says is not ready yet (phase 4): each slice, once it has landed, is gone from there, so Claude never tells
// her to do by hand what brimm-video does now.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { studioFiles } from "../studio.js";

/** The words of each slice of phase 4 that has landed. None may be left under "Not ready yet". Each task adds its own. */
const LANDED = ["captions"];

describe("her skill's Not ready yet", () => {
  const skill = studioFiles({ checkout: "/c", node: "/n" })[".claude/skills/brimm-edit/SKILL.md"];
  const notReady = skill.slice(skill.indexOf("## Not ready yet"), skill.indexOf("## By hand in Final Cut")).replace(/Final Cut/g, "");
  it("names nothing that is ready", () => {
    for (const word of LANDED) assert.doesNotMatch(notReady, new RegExp(`\\b${word}\\b`, "i"), word);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/timeline.test.js tests/edit-session.test.js tests/studio-ready.test.js`
Expected: FAIL: `timeline.js` cannot be found; `captions` is not a command; "captions" is still under "Not ready yet".

- [ ] **Step 3: Write the code**

`tool/timeline.js`:

```js
// The timeline a push hands to Final Cut (phase 4): built from the record whenever the session has laid something over it,
// spelled a word, cut it again or picked its preset, and otherwise the one kept as it was made (the import's
// edit/main.v0.fcpxml, or a Reel's as reel.js gives it). Built, it is the main video's project (projects.js) or the Reel's
// (reels.js), with its pieces as the cuts asked for leave them (recut.js) and what lies over them (layers.js), in the face
// this Mac has (styles.js).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeArgs, factsOf, colourOf } from "./cuts.js";
import { colorSpaceOf } from "./fcpxml.js";
import { lastLine, runProgram } from "./run.js";
import { soundOf, findPrograms, sameVideo, described, ideaNotes } from "./unedited.js";
import { relativeMedia } from "./portable.js";
import { runsFolder } from "./settings.js";
import { eventName, timelineFile } from "./names.js";
import { readReels, reelProject, REELS_FILE, REEL_FRAME, GUESSED } from "./reels.js";
import { reelTimeline } from "./reel.js";
import { mainProject } from "./projects.js";
import { layersFor, targetOf, presetOf } from "./layers.js";
import { rangesWith, keptOf, croppedLike, cutPhrases } from "./recut.js";
import { clockOf, clockOfRanges, heardWords } from "./clock.js";
import { faceOnThisMac } from "./styles.js";
import { pictureSize } from "./pictures.js";

/** The folders a Mac keeps fonts in: Font Book installs a person's into the first. */
export const fontFolders = (home) => [join(home, "Library", "Fonts"), "/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"];
/** The names of the font files in a Mac's font folders: none from a folder that cannot be read. */
export const fontFiles = (home) => fontFolders(home).flatMap((dir) => {
  try {
    return readdirSync(dir);
  } catch (e) {
    return [];
  }
});

/** Is there anything to build this part from, beyond the timeline kept as it was made? Always for a Reel with a project of its
    own, which shows its title on screen and, unless they are turned off, its captions. For the main video: a spelling, a
    text, a graphic, a cut, the logo, a preset, or a job whose captions are drawn (a short video's default, as filmed). */
export function layered(record, part) {
  if (part !== "main") return true;
  const t = record.main;
  if ((record.spellings || []).length) return true;
  if (["texts", "graphics", "cuts"].some((k) => (t[k] || []).length) || t.logo || t.preset) return true;
  return presetOf(record, part).job !== "full-episode";
}

/** A picture's size as it is shown: null when it cannot be read. */
function sizeOf(path) {
  try {
    return pictureSize(readFileSync(path));
  } catch (e) {
    return null;
  }
}

/** What a timeline is made of now, read from the episode's folder: { plan, words, hasWords, wordsFile, stem, ranges, pieces,
    picked, need }, where `ranges` are the whole recording's ranges as its cuts leave them, `pieces` its kept pieces, and
    `need` the files it is built from; or { coming, bring } while Dropbox has not brought one over yet, { why } when one is
    missing or cannot be read, or { old: true } for a Reel the import cut as a clip, before Reels had projects of their own,
    which is shown as it was, with nothing over it. A Reel is built on the project written when it was picked, so it shows
    the stretches it was picked with whatever reels.json says after (phase 3); a Reel picked before that is built on its
    candidate. `extra` are more files it needs, its pictures. */
export function piecesOf(found, part, ctx, extra = []) {
  const { record } = found;
  const target = targetOf(record, part);
  const name = record.video.file;
  const stem = name.replace(/\.[^.]*$/, "");
  const v0 = part === "main" ? "" : timelineFile({ part, v: 0 });
  const picked = Boolean(v0) && v0 in record.files && existsSync(join(found.folder, v0));
  let candidate = null;
  if (part !== "main" && !picked) {
    const listed = existsSync(join(found.folder, REELS_FILE));
    if (listed && !ctx.isWhole(join(found.folder, REELS_FILE))) return { coming: REELS_FILE, bring: [REELS_FILE] };
    const read = listed ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")) : null;
    candidate = read && read.reels ? read.reels.candidates.find((c) => c.n === part.reel) || null : null;
    if (!candidate) return { old: true };
  }
  const wordsFile = `${stem}.words.json`;
  const hasWords = existsSync(join(found.folder, wordsFile));
  const need = [name, `${stem}.cut-plan.json`, ...(hasWords ? [wordsFile] : []), ...(part === "main" ? [`${stem}.srt`] : picked ? [v0] : []), ...extra];
  const gone = need.find((f) => !existsSync(join(found.folder, f)));
  if (gone) return { why: `${gone} is not in the episode's folder.` };
  const coming = need.filter((f) => !ctx.isWhole(join(found.folder, f)));
  if (coming.length) return { coming: coming[0], bring: coming };
  let plan;
  let words = [];
  try {
    plan = JSON.parse(readFileSync(join(found.folder, `${stem}.cut-plan.json`), "utf8"));
    // Each word from when it is said: after a pause, not in it (clock.js heardWords).
    if (hasWords) words = heardWords(JSON.parse(readFileSync(join(found.folder, wordsFile), "utf8")).words, plan.phrases);
  } catch (e) {
    return { why: `${stem}.cut-plan.json or ${wordsFile} cannot be read.` };
  }
  // The plan's own ranges while no cut is asked for: a layer never cuts her video again (recut.js rangesWith).
  const ranges = rangesWith({ plan, cuts: target.cuts || [] });
  if (part === "main") return { plan, words, hasWords, wordsFile, stem, ranges, pieces: keptOf(ranges), picked, need };
  // The note that a stretch's crop is a guess goes with it (reels.js GUESSED), as the pick wrote it.
  const base = picked
    ? clockOf(readFileSync(join(found.folder, v0), "utf8")).map((p) => ({ start: p.from, end: p.to, position: p.position, guessed: p.notes.some((n) => n.split(" / ").includes(GUESSED)) }))
    : candidate.ranges;
  const span = { from: base[0].start, to: base[base.length - 1].end };
  const pieces = (target.cuts || []).length ? croppedLike(keptOf(ranges, span), base) : base;
  return { plan, words, hasWords, wordsFile, stem, ranges, pieces, span, picked, need };
}

/** The stored timeline of a part, as text that names its media from the episode's edit/ folder and no library: { xml, told },
    where `told` is what the person is told of how it was built; { coming, bring }, the file Dropbox has not brought over yet
    and the files to bring; or { why } there is none. `part` is "main" or { reel: n }. */
export async function timelineFor(found, part, ctx) {
  const { record } = found;
  const target = targetOf(record, part);
  if (!target) return { why: `There is no Reel ${part.reel}.` };
  if (!layered(record, part)) {
    if (part !== "main") return { told: [], ...(await reelTimeline(found, target, ctx)) };
    const v0 = timelineFile({ part: "main", v: 0 });
    if (!ctx.isWhole(join(found.folder, v0))) return { coming: v0, bring: [v0] };
    return { xml: readFileSync(join(found.folder, v0), "utf8"), told: [] };
  }
  const pictures = [...new Set([...(target.graphics || []).map((g) => g.picture), ...(target.logo && record.brand && record.brand.logo ? [record.brand.logo] : [])])];
  const read = piecesOf(found, part, ctx, pictures);
  if (read.old) {
    const asked = (record.spellings || []).length > 0 || ["texts", "graphics", "cuts"].some((k) => (target[k] || []).length) || Boolean(target.preset) || target.captions === false;
    return { told: asked ? [`Reel ${part.reel} was cut as a clip before Reels had projects of their own, so what was asked for on it is not shown. Change it by hand in Final Cut.`] : [], ...(await reelTimeline(found, target, ctx)) };
  }
  if (read.why || read.coming) return read;
  const { plan, words, hasWords, wordsFile, stem, ranges, pieces, span } = read;
  const name = record.video.file;
  const run = ctx.deps.run || runProgram;
  const tools = ctx.deps.tools || findPrograms();
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `timeline-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    const video = join(found.folder, name);
    const out = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(video, out));
    const printed = probe.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
    const now = printed ? factsOf(printed) : null;
    if (!now || !now.height) return { why: `${name} could not be read (${lastLine(probe.stderr)}).` };
    if (!sameVideo(plan.facts, now)) return { why: `${name} is not the video its cut plan was made of: it is ${described(now)}, and the plan's is ${described(plan.facts)}.` };
    const more = { ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) || undefined };
    const face = faceOnThisMac(ctx.deps.fontFiles ? ctx.deps.fontFiles() : fontFiles(ctx.home));
    const sizes = Object.fromEntries(pictures.map((p) => [p, sizeOf(join(found.folder, p))]));
    const frame = part === "main" ? { width: plan.facts.width, height: plan.facts.height } : REEL_FRAME;
    // HDR by the colour itself: HLG or PQ, or BT.2020 colour (the lead's review, L22).
    const colour = colourOf(printed) || {};
    const hdr = colour.primaries === "bt2020" || ["arib-std-b67", "smpte2084"].includes(colour.transfer);
    const layers = layersFor({ record, part, frame, ranges: pieces, words, face: face.face, pictures: sizes, video: { height: plan.facts.height, hdr }, lookPresets: ctx.deps.lookPresets });
    const made = part === "main"
      ? mainProject({ video, facts: plan.facts, more, plan, ranges, srt: readFileSync(join(found.folder, `${stem}.srt`), "utf8"), spellings: record.spellings, ideas: ideaNotes({ ...plan, phrases: cutPhrases(plan.phrases, target.cuts || []) }, (plan.claude && plan.claude.graphics) || []), titles: layers.titles, stills: layers.stills, look: layers.look, project: "main", event: eventName(found.name) })
      : reelProject({ video, facts: plan.facts, candidate: { start: span.from, end: span.to, ranges: pieces }, plan, planRanges: (target.cuts || []).length ? ranges : plan.ranges, titles: layers.titles, stills: layers.stills, look: layers.look, more, project: `reel ${part.reel}`, event: eventName(found.name) });
    if (made.why) return { why: `Its timeline could not be made: ${made.why}.` };
    const kept = join(found.folder, "edit", "timeline.fcpxml");
    const unworded = hasWords ? "" : `This episode has no ${wordsFile}, so no captions are drawn.`;
    return { xml: relativeMedia(made.text, { from: kept, to: kept, episode: found.folder }).xml, told: [face.told, unworded, ...layers.told].filter(Boolean) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The clock a person reads a time on, for a part: the newest version shown in Final Cut, on either Mac, as its stored file
    gives it, or the timeline as it is now when it was never shown. { clock, on, pieces, words, plan } with `on` naming it
    for a person ("main v3", "Reel 2 v1", "the main video as it is now"); or what piecesOf gives when it cannot be read. */
export function clockFor(found, part, ctx) {
  const read = piecesOf(found, part, ctx);
  if (read.old) return { why: `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so a time on it cannot be read. Make this change by hand in Final Cut.` };
  if (read.why || read.coming) return read;
  const target = targetOf(found.record, part);
  const label = part === "main" ? "main" : `Reel ${part.reel}`;
  const top = (target.pushed || []).reduce((best, p) => (!best || p.v > best.v ? p : best), null);
  if (!top) return { ...read, clock: clockOfRanges(read.pieces), on: `${part === "main" ? "the main video" : label} as it is now` };
  const at = join(found.folder, top.file);
  if (!existsSync(at)) return { why: `${top.file} is not in the episode's folder.` };
  if (!ctx.isWhole(at)) return { coming: top.file, bring: [top.file] };
  return { ...read, clock: clockOf(readFileSync(at, "utf8")), on: `${label} v${top.v}` };
}
```

`tool/edit.js`, beside the other imports:

```js
import { timelineFor, clockFor, piecesOf } from "./timeline.js";
```

`push`: the main timeline comes from `timelineFor`, and what it tells is said once the push is shown:

```diff
-  const source = join(found.folder, timelineFile({ part: "main", v: 0 }));
-  if (!ctx.isWhole(source)) {
-    ctx.say(`Dropbox is still bringing edit/main.v0.fcpxml over to this Mac. Say "open ${record.name.text}" first.`);
-    return 1;
-  }
-  return pushPart(ctx, { ...found, record }, { part: "main", xml: readFileSync(source, "utf8"), noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") });
+  // The timeline as the session leaves it: the import's own until something is laid over it (phase 4).
+  const made = await timelineFor({ ...found, record }, "main", ctx);
+  if (made.coming) {
+    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: made.bring });
+    return refuse(ctx, `Dropbox is still bringing ${made.coming} over to this Mac. Say "open ${record.name.text}" first.`);
+  }
+  if (made.why) return refuse(ctx, made.why);
+  return pushPart(ctx, { ...found, record }, { part: "main", xml: made.xml, told: made.told, noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") });
```

And `pushReel`: `const made = await reelTimeline(found, reel, ctx);` becomes `const made = await timelineFor(found, { reel: n }, ctx);`, and its `pushPart` is given `told: made.told`.

After `ask`:

```js
/** The timeline a command names after the episode: "main", the default, or "reel <n>"; and the words left. */
function partFrom(words) {
  const at = words.findIndex((w, i) => w === "reel" && /^\d+$/.test(words[i + 1] || ""));
  if (at !== -1) return { part: { reel: Number(words[at + 1]) }, words: [...words.slice(0, at), ...words.slice(at + 2)] };
  return { part: "main", words: words.filter((w) => w !== "main") };
}
const partLabel = (part) => (part === "main" ? "the main video" : `Reel ${part.reel}`);
/** The record with one part's own entry changed. */
const withPart = (record, part, change) => (part === "main" ? { ...record, main: change(record.main) } : { ...record, reels: record.reels.map((r) => (r.n === part.reel ? change(r) : r)) });
const SHOW_IT = 'Say "show it in Final Cut" to see it.';
```

```js
/** What every command on a timeline's layers does first (phase 4): the episode, from its first word, and the timeline it
    names, a Reel picked. One that `writes` is refused while another Mac has the episode, while a detached run is at work on
    it (a finish's late check would put its own copies back), on a timeline changed by hand and taken in (phase 5), and on a
    Reel the import cut as a clip, before Reels had projects of their own, which nothing is laid over. Gives
    { found, part, target, words } or { code }. */
function layerStart(ctx, words, { writes = true } = {}) {
  const [said, ...rest] = words;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return { code: got.code };
  const found = { ...got.found, record: got.record };
  const { part, words: left } = partFrom(rest);
  const target = part === "main" ? got.record.main : (got.record.reels || []).find((r) => r.n === part.reel);
  if (!target) return { code: refuse(ctx, `There is no Reel ${part.reel}.`) };
  if (part !== "main" && target.status !== "picked" && target.status !== "finished") return { code: refuse(ctx, `Reel ${part.reel} is not picked. Pick it first.`) };
  if (!writes) return { found, part, target, words: left };
  if (claimHeld(ctx, got.record)) return { code: refuse(ctx, claimHeld(ctx, got.record)) };
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return { code: refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`) };
  if (target.base) return { code: refuse(ctx, "This timeline was changed by hand in Final Cut and taken in. brimm-video does not change a hand-edited timeline yet: make this change by hand in Final Cut.") };
  if (part !== "main" && piecesOf(found, part, ctx).old) return { code: refuse(ctx, `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so brimm-video cannot change it: make this change by hand in Final Cut.`) };
  return { found, part, target, words: left };
}
```

After `layerStart`:

```js
/** `captions "<episode>" reel <n> on|off`: a Reel's running captions, drawn in its preset's caption style. The main video's
    follow its preset alone. */
async function captions(ctx, rest) {
  const [said, ...more] = rest;
  const verb = more[more.length - 1];
  const start = layerStart(ctx, [said, ...more.slice(0, -1)]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  if (part === "main") return refuse(ctx, "The main video's captions follow its caption style: say which (preset --captions).");
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, captions: verb === "on" })), `Captions are ${verb} on Reel ${part.reel}. ${SHOW_IT}`);
}
```

The table of commands gains `captions`, and the help, at its end:

```
  node edit.js captions "<episode>" reel <n> on|off
                                        a Reel's running captions, in its caption style; its title on screen stays
```

`tool/studio/SKILL.md`, her row, and "captions" leaves "Not ready yet":

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -25,6 +25,7 @@
 | "Ask Claude again for Reels" | `ask "<episode>"`: it runs in the background, so say so, and that "how far is it?" shows how far it has got |
 | "Finish Reels 1 and 3" / "Drop 2" | `reel pick "<episode>" 1 3` / `reel drop "<episode>" 2` |
 | "Show it in Final Cut" / "Show reel 1 in Final Cut" | `push "<episode>"` / `push "<episode>" reel 1`, with the guard below |
+| "Captions on Reel 2" / "No captions on Reel 2" | `captions "<episode>" reel 2 on` / `captions "<episode>" reel 2 off`. A Reel shows its captions unless they are turned off, and its title on screen whenever it has one |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -45,7 +46,7 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, captions, a spelling fix, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
+- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, a spelling fix, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS: PR 19's tests of a Reel's push and of `reelTimeline` pass unchanged (an old Reel cut as a clip falls back to it; one whose episode has no words file is built with no captions, and says so), and `tests/studio.test.js` too (the skill runs only commands `edit.js` has).

- [ ] **Step 5: Commit**

```bash
git add tool/timeline.js tool/tests/timeline.test.js tool/tests/phase4.js tool/tests/edit-session.test.js tool/tests/studio-ready.test.js tool/edit.js tool/studio/SKILL.md
git commit -m "A push hands Final Cut the timeline built from the record: a Reel gains its captions and its title on screen"
```

---

## Task A5: `spell`

**Files:**
- Modify: `tool/edit.js` (`saveSpellings`, `spell`; the table; the help), `tool/finish.js` (`lastRevision` exported), `tool/tests/edit-session.test.js`, `tool/tests/studio-ready.test.js`, `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: `spellingFault`, `withSpelling`, `respelledPart`, `respelledHandoff` (C4); `handoffText`, `handoffFault` (`handoff.js`); `lastRevision` (`finish.js`); `presetOf` (A3); `save`, `episodeFor`, `claimHeld`, `runningCommand`, `refuse`, `listed`, `capital`, `writerOf`, `ruleOpts` (`edit.js`).
- Produces: `spell "<episode>" [add "<as heard>" "<as spelled>" | drop "<as heard>"]`, and after a finish, ruling 11. A change or a drop is refused while the other Mac has the episode, or a run other than `bring` runs for it, before anything is written (a finish writes its record after its work, and its late check puts its own copies of `final/` back); listing reads only.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/edit-session.test.js`:

```js
describe("spell", () => {
  it("lists, adds and drops the episode's spellings, and the next push's captions take them", async () => {
    const { t, found } = episode();
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER), { code: 0, text: "There are no spellings for this episode yet." });
    assert.deepEqual(await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally"), { code: 0, text: '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).spellings, [["Sallie", "Sally"]]);
    assert.equal(reread(found).version, 2);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match(handed(t, "main"), /Thank you so much, Sally\./);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie Ogden", "Sally")).text, '"Sallie Ogden" is not one word. Say the one word as the transcriber writes it.');
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
});

describe("spell, while a finish runs", () => {
  it("refuses a change, even before the finish has written its record, and a drop too, and writes nothing", async () => {
    const { t, found } = episode({ spellings: [["Sallie", "Sally"]] });
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    const running = { ...t.ctx.deps, alive: (pid) => pid === 4242 };
    for (const ask of [["add", "Brim", "BRIMM"], ["drop", "Sallie"]]) {
      assert.equal((await on(running, "spell", FOLDER, ...ask)).text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.', ask[0]);
    }
    assert.deepEqual([reread(found).rev, reread(found).spellings], [1, [["Sallie", "Sally"]]]);
    // Listing them reads only.
    assert.equal((await on(running, "spell", FOLDER)).code, 0);
    t.done();
  });
});

describe("spell, after a finish", () => {
  const MAIN = "final/Pricing- what to charge- main v1 3fa9c1";
  const REEL = "final/Pricing- what to charge- reel 2 v1 3fa9c1";
  const HANDOFF = "final/Pricing- what to charge-.brimm-ops.json";
  const SRT = "1\n00:00:01,000 --> 00:00:02,000\nThank you so much, Sallie.\n\n";
  /** The episode as a finish leaves it: the transcripts of its main video and of Reel 2, with captions drawn into its picture,
      and the hand-off, in final/; and the record of it, holding `spellings`. */
  const finishedEpisode = (spellings = []) => {
    const { t, found } = episode();
    const words = JSON.stringify({ video: "m.mov", duration: 2, words: [{ w: "Sallie.", start: 1, end: 2 }] });
    const record = { ...reread(found), title: { text: "Price like you mean it", from: "person", approved: true } };
    const handoff = handoffText(buildHandoff({ record, revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "m.mov", seconds: 9, srt: SRT }, reels: [{ n: 2, title: "Know your costs", file: "r.mov", seconds: 7, srt: SRT }] }));
    mkdirSync(join(found.folder, "final"), { recursive: true });
    for (const stem of [MAIN, REEL]) for (const [rel, text] of [[`${stem}.srt`, SRT], [`${stem}.transcript.txt`, "[00:00:01] Thank you so much, Sallie.\n"], [`${stem}.words.json`, words]]) writeFileSync(join(found.folder, rel), text);
    writeFileSync(join(found.folder, HANDOFF), handoff);
    const part = (stem) => ({ v: 1, file: `${stem}.mov`, bytes: 9, seconds: 9, words: `${stem}.words.json` });
    const finished = { revision: 1, at: "2026-10-20T15:00:00-05:00", on: "Mac Studio", handoff: HANDOFF, parts: { main: part(MAIN), "reel 2": part(REEL) } };
    writeFileSync(recordFile(found.folder, 2), recordText({ ...record, rev: 2, spellings, finished }));
    return { t, found };
  };
  const text = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
  it("spells the final transcripts with a new spelling, makes the hand-off again as its next revision, and says a Reel's captions on screen keep the old", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.commit = "e72a170";
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling until it is shown in Final Cut, Shared and finished again.');
    for (const stem of [MAIN, REEL]) assert.match(text(found, `${stem}.srt`), /Thank you so much, Sally\./);
    assert.match(text(found, `${MAIN}.transcript.txt`), /Sally\./);
    assert.deepEqual(JSON.parse(text(found, `${MAIN}.words.json`)).words.map((w) => w.w), ["Sally."]);
    const handoff = JSON.parse(text(found, HANDOFF));
    assert.deepEqual([handoff.revision, handoff.madeOn, handoff.madeBy, /Sally\./.test(handoff.main.srt), /Sally\./.test(handoff.reels[0].srt), handoffFault(handoff)], [2, "Mac Studio", "brimm-video e72a170", true, true, ""]);
    const now = reread(found);
    assert.deepEqual([now.finished.revision, now.finished.parts.main.spellings, now.finished.parts["reel 2"].spellings, now.files[HANDOFF]], [2, [["Sallie", "Sally"]], [["Sallie", "Sally"]], Buffer.byteLength(text(found, HANDOFF))]);
    t.done();
  });
  it("applies a spelling that holds its own word once, and never again", async () => {
    const { t, found } = finishedEpisode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much, Sallie Ogden\.\n/);
    // A later spelling is applied alone: the one before is held already.
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "much", "much indeed")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much indeed, Sallie Ogden\.\n/);
    assert.doesNotMatch(text(found, HANDOFF), /Ogden Ogden/);
    t.done();
  });
  it("leaves the final transcripts and the revision as they are when the new spelling's word is not in them", async () => {
    const { t, found } = finishedEpisode();
    const before = text(found, HANDOFF);
    assert.match((await on(t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi")).text, /The final transcripts do not have "Hormozy", so they are as they were\.$/);
    assert.deepEqual([reread(found).finished.revision, text(found, HANDOFF), reread(found).spellings], [1, before, [["Hormozy", "Hormozi"]]]);
    // It changed nothing there, so taking it back says nothing of the final transcripts.
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Hormozy")).text, '"Hormozy" is as the transcriber writes it again. Say "show it in Final Cut" to see it.');
    t.done();
  });
  it("takes a spelling back, or changes it, in the timelines, and says the final transcripts keep the old one", async () => {
    const { t, found } = finishedEpisode([["Sallie", "Sally"]]);
    const before = text(found, `${MAIN}.srt`);
    // A finish again makes a part's transcripts again only once it is Shared again (finish.js reuses the others).
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again.');
    assert.deepEqual([reread(found).spellings, reread(found).finished.revision, text(found, `${MAIN}.srt`)], [[], 1, before]);
    assert.match((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Salli")).text, /The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again\.$/);
    t.done();
  });
  it("never spells a part twice after a finish again that reused it, and spells the part it made again afresh", async () => {
    const { t, found } = finishedEpisode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    // A finish again: the main video was not Shared again, so it is reused as it was; Reel 2 is made again, with no spelling.
    const now = reread(found);
    writeFileSync(join(found.folder, `${REEL}.srt`), SRT);
    writeFileSync(join(found.folder, `${REEL}.words.json`), JSON.stringify({ video: "r.mov", duration: 2, words: [{ w: "Sallie.", start: 1, end: 2 }] }));
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, finished: { revision: 3, at: now.finished.at, on: now.finished.on, handoff: HANDOFF, parts: { main: now.finished.parts.main, "reel 2": { v: 2, file: `${REEL}.mov`, bytes: 9, seconds: 9, words: `${REEL}.words.json` } } } }));
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sallie Ogden")).code, 0);
    assert.match(text(found, `${MAIN}.srt`), /much, Sallie Ogden\.\n/);
    assert.match(text(found, `${REEL}.srt`), /much, Sallie Ogden\.\n/);
    t.done();
  });
  it("brings the final transcripts over first when the folder was made online-only, and changes nothing", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.isWhole = (path) => !path.endsWith(".brimm-ops.json");
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).text, "Dropbox is bringing the final transcripts over to this Mac. Say it again when it is done. Nothing was changed.");
    assert.deepEqual(reread(found).spellings, []);
    t.done();
  });
  it("waits while a finish runs, whose late check would put its own copies back, for an add and a drop", async () => {
    const { t, found } = finishedEpisode([["Sallie", "Sally"]]);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    const rev = reread(found).rev;
    for (const ask of [["add", "much", "much indeed"], ["drop", "Sallie"]]) {
      const r = await on({ ...t.ctx.deps, alive: (pid) => pid === 4242 }, "spell", FOLDER, ...ask);
      assert.equal(r.text, 'finish is running for this episode. Say "how far is it?", and try again when it is done.', ask[0]);
    }
    assert.deepEqual([reread(found).rev, reread(found).spellings], [rev, [["Sallie", "Sally"]]]);
    t.done();
  });
  it("puts each final file back as it was when the record cannot be written", async () => {
    const { t, found } = finishedEpisode();
    const before = text(found, `${MAIN}.srt`);
    // The record is written meanwhile, as by another command: the save is refused.
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".brimm-ops.json") && !existsSync(recordFile(found.folder, 3))) writeFileSync(recordFile(found.folder, 3), recordText({ ...reread(found), rev: 3 }));
    };
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 1);
    t.ctx.deps.clone = clone;
    assert.equal(text(found, `${MAIN}.srt`), before);
    t.done();
  });
  it("names a final file that cannot be put back, and says the episode needs Jason", async () => {
    const { t, found } = finishedEpisode();
    t.ctx.deps.clone = (from, to) => {
      if (to.endsWith(".transcript.txt")) throw new Error("cp: the disk is full");
      writeFileSync(to, readFileSync(from));
    };
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 1);
    assert.match(r.text, new RegExp(`${MAIN}\\.transcript\\.txt could not be put back as it was\\. Tell Jason: the episode needs him\\.$`));
    assert.match(text(found, `${MAIN}.srt`), /Sallie\./);
    t.done();
  });
});

describe("a short video's main video", () => {
  it("draws its captions from the first push, as its job says, and the same after a spelling", async () => {
    const { t } = episode({ kind: "short video", reels: [] });
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.role === "BRIMM captions"));
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits")).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.role === "BRIMM captions" && x.name.includes("caption")));
    t.done();
  });
});
```

In the test "each refuses a change, says who has it, and writes nothing, a picture included", `asks` gains:

```js
      ["spell", FOLDER, "add", "Sallie", "Sally"]
```

And after it, in the same `describe`:

```js
  it("still list what there is: spellings, texts, graphics, ideas and the preset", async () => {
    const lists = [
      ["spell", FOLDER]
    ];
    for (const ask of lists) {
      const { t } = episode({ editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } });
      assert.equal((await on(t.ctx.deps, ...ask)).code, 0, ask.join(" "));
      t.done();
    }
  });
```

In `tool/tests/studio-ready.test.js`, `LANDED` gains "spelling".

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit-session.test.js tests/studio-ready.test.js`
Expected: FAIL: `spell` is not a command (the help is said, and 2 returned); "spelling" is still under "Not ready yet".

- [ ] **Step 3: Write the code**

`tool/finish.js`:

```diff
--- a/tool/finish.js
+++ b/tool/finish.js
@@ -149,7 +149,7 @@
 }
 /** The highest revision of a hand-off of this episode already in final/: a revision is never used twice, even when the
     record of the last finish was never written. */
-function lastRevision(finalDir, id) {
+export function lastRevision(finalDir, id) {
   let most = 0;
   let names = [];
   try {
```

`tool/edit.js`, beside the other imports (`lastRevision` joins the import from `./finish.js`):

```js
import { spellingFault, withSpelling, respelledPart, respelledHandoff } from "./spelling.js";
import { handoffText, handoffFault } from "./handoff.js";
import { presetOf } from "./layers.js";
```

Before `captions`:

```js
/** The record with its spellings, `spellings`; and after a finish (spec section 4, "spell applies to every timeline and to
    the final transcripts") the final transcripts with each spelling they do not hold yet, and the hand-off made again as its
    next revision, each file put in by the rule, and only when its words change. Each finished part's transcripts hold the
    spellings that changed them: its `spellings`, or, for a part no spelling has reached since a finish made it, the record's
    own. Only the others are applied to it, so none is applied twice, and a spelling taken back or changed leaves the part as
    it is, which is said: a finish again makes a part's transcripts again only once it is Shared again. Before reading them
    it checks they are here, whole (her folder may be online-only after a hand-off): if not, it starts bringing them over and
    stops. (`spell` has refused already while a finish runs, whose late check would put its own copies back.) When the record
    cannot be written, each final file is put back as it was, each on its own; one that cannot be is named, and she is told
    the episode needs Jason. Resolves the save's code. */
async function saveSpellings(ctx, found, spellings, done) {
  const record = { ...found.record, spellings };
  const finished = record.finished;
  if (!finished) return save(ctx, found, record, done);
  const meantOf = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const parts = Object.entries(finished.parts || {}).map(([key, part]) => {
    const held = part.spellings || found.record.spellings || [];
    return { key, part, held, stem: `final/${basename(part.file, extname(part.file))}`, toApply: spellings.filter(([h]) => meantOf(held, h) === undefined) };
  });
  // Every part's own list is kept from now on, so a part a finish reuses keeps it, and one it makes again starts afresh.
  const withHeld = (held) => ({ ...finished, parts: Object.fromEntries(parts.map((p) => [p.key, { ...p.part, spellings: held[p.key] || p.held }])) });
  const kept = [...new Set(parts.flatMap((p) => p.held.filter(([h, m]) => meantOf(spellings, h) !== m).map(([h, m]) => `"${h}" as "${m}"`)))];
  const keptNote = kept.length ? ` The final transcripts keep ${listed(kept)} until each part is shown in Final Cut, Shared and finished again.` : "";
  if (!parts.some((p) => p.toApply.length)) return save(ctx, found, { ...record, finished: withHeld({}) }, `${done}${keptNote}`);
  const finals = [...parts.flatMap((p) => [`${p.stem}.srt`, `${p.stem}.transcript.txt`, ...(p.part.words ? [p.part.words] : [])]), finished.handoff];
  const gone = finals.find((rel) => !existsSync(join(found.folder, rel)));
  if (gone) return refuse(ctx, `${gone} is not in the episode's folder, so the final transcripts cannot be spelled again. Nothing was changed. Say finish again.`);
  const coming = finals.filter((rel) => !ctx.isWhole(join(found.folder, rel)));
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
    return refuse(ctx, "Dropbox is bringing the final transcripts over to this Mac. Say it again when it is done. Nothing was changed.");
  }
  const work = join(runsFolder(ctx.home), `spell-${process.pid}-${ctx.now()}`);
  mkdirSync(work, { recursive: true });
  const put = textWriter({ work, ...ruleOpts(ctx) });
  const before = [];
  /** Each final file put back as it was, each on its own: the ones that could not be. */
  const putBack = () => before.filter(([rel, text]) => {
    try {
      put(join(found.folder, rel), text, { replace: true });
      return false;
    } catch (e) {
      return true;
    }
  }).map(([rel]) => rel);
  try {
    const srts = {};
    const writes = [];
    const held = {};
    for (const p of parts) {
      const was = { srt: readFileSync(join(found.folder, `${p.stem}.srt`), "utf8"), words: p.part.words ? readFileSync(join(found.folder, p.part.words), "utf8") : null };
      const sameWords = (made) => !made.words || JSON.stringify(JSON.parse(made.words).words) === JSON.stringify(JSON.parse(was.words).words);
      // A spelling is held by a part only once it has changed it: one whose word the part does not have is not.
      const changing = p.toApply.filter((pair) => {
        const made = respelledPart(was, [pair]);
        return made.srt !== was.srt || !sameWords(made);
      });
      held[p.key] = [...p.held, ...changing];
      const made = respelledPart(was, changing);
      srts[p.key] = made.srt;
      if (made.srt !== was.srt) writes.push([`${p.stem}.srt`, made.srt], [`${p.stem}.transcript.txt`, made.txt]);
      if (!sameWords(made)) writes.push([p.part.words, made.words]);
    }
    const toApply = [...new Map(parts.flatMap((p) => p.toApply).map(([h, m]) => [h, [h, m]])).values()];
    if (!writes.length) return save(ctx, found, { ...record, finished: withHeld(held) }, `${done} The final transcripts do not have ${listed(toApply.map(([h]) => `"${h}"`))}, so they are as they were.${keptNote}`);
    // A revision is never used twice, even one a finish left in final/ without writing its record (finish.js lastRevision).
    const revision = Math.max(finished.revision, lastRevision(join(found.folder, "final"), record.id)) + 1;
    const at = localStamp(new Date(ctx.now()));
    const handoff = respelledHandoff(JSON.parse(readFileSync(join(found.folder, finished.handoff), "utf8")), { srts, revision, made: at, madeOn: ctx.machine, commit: writerOf(ctx).commit });
    const fault = handoffFault(handoff);
    if (fault) return refuse(ctx, `The hand-off could not be made again (${fault.replace(/\.$/, "")}). Nothing was changed.`);
    writes.push([finished.handoff, handoffText(handoff)]);
    const files = {};
    for (const [rel, text] of writes) {
      before.push([rel, readFileSync(join(found.folder, rel), "utf8")]);
      files[rel] = put(join(found.folder, rel), text, { replace: true }).bytes;
    }
    // A finished part may have captions drawn into its picture (whether it has is not known here), which keep the old spelling
    // until it is finished again: a full episode's main video has none.
    const drawn = parts.filter((p) => p.key !== "main" || presetOf(record, "main").job !== "full-episode").map((p) => (p.key === "main" ? "the main video" : capital(p.key)));
    const still = drawn.length ? ` If ${listed(drawn)} ${drawn.length === 1 ? "shows" : "show"} captions on screen, they keep the old spelling until ${drawn.length === 1 ? "it is" : "each is"} shown in Final Cut, Shared and finished again.` : "";
    const code = await save(ctx, found, { ...record, files: { ...record.files, ...files }, finished: { ...withHeld(held), revision, at, on: ctx.machine } }, `${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${revision}: drop it on the BRIMM Ops page again.${still}${keptNote}`);
    if (code !== 0) {
      const lost = putBack();
      if (lost.length) ctx.say(`${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.`);
    }
    return code;
  } catch (e) {
    const lost = putBack();
    return refuse(ctx, `The final transcripts could not be spelled again (${e.code || "a file could not be read or put in"}). ${lost.length ? `${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.` : "Nothing was changed."}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `spell "<episode>" [add "<as heard>" "<as spelled>" | drop "<as heard>"]`: the episode's own spellings, which every
    timeline's captions and the final transcripts take. */
async function spell(ctx, rest) {
  const [said, verb, heard, meant] = rest;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const found = { ...got.found, record: got.record };
  const spellings = got.record.spellings || [];
  if (verb === undefined) {
    ctx.say(spellings.length ? `The spellings: ${spellings.map(([h, m]) => `"${h}" as "${m}"`).join(", ")}.` : "There are no spellings for this episode yet.");
    return 0;
  }
  if (claimHeld(ctx, got.record)) return refuse(ctx, claimHeld(ctx, got.record));
  // A finish's late check would put its own copies of final/ back, and its record would be refused after a change here.
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`);
  if (verb === "drop") {
    if (!spellings.some(([h]) => h === heard)) return refuse(ctx, `There is no spelling of "${heard}".`);
    return saveSpellings(ctx, found, spellings.filter(([h]) => h !== heard), `"${heard}" is as the transcriber writes it again. ${SHOW_IT}`);
  }
  if (verb !== "add") {
    ctx.say(HELP);
    return 2;
  }
  const fault = spellingFault(heard, meant);
  if (fault) return refuse(ctx, fault);
  return saveSpellings(ctx, found, withSpelling(spellings, heard.trim(), meant.trim()), `"${heard.trim()}" is spelled "${meant.trim()}" now, in every timeline's captions. ${SHOW_IT}`);
}
```

The table gains `spell`, and the help, at its end:

```
  node edit.js spell "<episode>" [add "<as heard>" "<as spelled>" | drop "<as heard>"]
                                        the episode's spellings, which every timeline's captions take; after a finish,
                                        the final transcripts too, and the hand-off is made again
```

`tool/studio/SKILL.md`, her row, and "a spelling fix" leaves "Not ready yet":

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -26,6 +26,7 @@
 | "Finish Reels 1 and 3" / "Drop 2" | `reel pick "<episode>" 1 3` / `reel drop "<episode>" 2` |
 | "Show it in Final Cut" / "Show reel 1 in Final Cut" | `push "<episode>"` / `push "<episode>" reel 1`, with the guard below |
 | "Captions on Reel 2" / "No captions on Reel 2" | `captions "<episode>" reel 2 on` / `captions "<episode>" reel 2 off`. A Reel shows its captions unless they are turned off, and its title on screen whenever it has one |
+| "It's Hormozi, not Hormozy" | `spell "<episode>" add "Hormozy" "Hormozi"`: the one word as the transcriber writes it, then how it is spelled. "What spellings are there?": `spell "<episode>"`. After a finish it may say the hand-off was made again: tell her to drop it on the BRIMM Ops page again; if it says a video's captions on screen, or the final transcripts, keep the old spelling, tell her that changes when that video is shown in Final Cut, Shared and finished again |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -46,7 +47,7 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, a spelling fix, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
+- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/finish.js tool/tests/edit-session.test.js tool/tests/studio-ready.test.js tool/studio/SKILL.md
git commit -m "spell: the episode's spellings in every timeline's captions, and after a finish in the final transcripts, once"
```

---

## Task A6: `logo`

**Files:**
- Modify: `tool/edit.js` (`pictureFrom`, `saveWithPicture`, `logo`; the table; the help), `tool/tests/edit-session.test.js`, `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: `pictureNameFault`, `pictureSize` (C5); `studioFolder` (`studio.js`); `cloneIn` (`dropbox.js`); `layerStart`, `withPart` (A4).
- Produces: `logo "<episode>" on|off [--picture "<name>"]`, on the main video only (ruling 2); `pictureFrom(ctx, found, name) → { picture, size, bytes, copied }` or `{ code }`, which compares a picture already in `media/` byte for byte, and `saveWithPicture(ctx, found, record, done, got)`, which takes a picture it copied out again when the record cannot be written. `graphic` (A7) shares both.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/edit-session.test.js`:

```js
describe("logo", () => {
  it("asks for the logo's picture once, copies it into media/ by the rule, and the push shows it top right on the main video", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on")).text, 'Say which picture in the Pictures folder is the logo (--picture "<name>").');
    picture(t, "BRIMM logo.png", 600, 300);
    assert.deepEqual(await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "BRIMM logo.png"), { code: 0, text: 'The logo is on on the main video. Say "show it in Final Cut" to see it.' });
    const now = reread(found);
    assert.deepEqual([now.brand, now.main.logo, now.files["media/BRIMM logo.png"]], [{ logo: "media/BRIMM logo.png" }, true, 33]);
    assert.ok(existsSync(join(found.folder, "media", "BRIMM logo.png")));
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "video").every((v) => v.name === "brimm logo 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "off")).code, 0);
    assert.equal(reread(found).main.logo, false);
    t.done();
  });
  it("leaves a Reel's logo for the brand templates", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "reel", "2")).text, "A Reel's logo comes with the brand templates, later. The logo is on the main video.");
    t.done();
  });
  it("refuses a path for a picture, a picture that is not there, and a link in the Pictures folder, and copies nothing", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "../../.ssh/id.png")).code, 1);
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "gone.png")).text, 'There is no picture called "gone.png" in the Pictures folder (BRIMM Video Studio, Pictures). Put it there first.');
    picture(t, "real.png", 600, 300);
    symlinkSync(join(t.home, "BRIMM Video Studio", "Pictures", "real.png"), join(t.home, "BRIMM Video Studio", "Pictures", "link.png"));
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "link.png")).text, '"link.png" in the Pictures folder is not a picture file of its own. Put the picture itself there.');
    assert.equal(existsSync(join(found.folder, "media")), false);
    t.done();
  });
  it("uses the same picture again without a second copy, and refuses a file that is not a PNG or a JPEG inside", async () => {
    const { t, found } = episode();
    picture(t, "logo.png", 600, 300);
    for (let i = 0; i < 2; i++) assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "logo.png")).code, 0);
    assert.deepEqual(readdirSync(join(found.folder, "media")), ["logo.png"]);
    assert.deepEqual([reread(found).brand, reread(found).rev], [{ logo: "media/logo.png" }, 3]);
    writeFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "notes.png"), "these are words, not a picture");
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "notes.png")).text, '"notes.png" cannot be read as a PNG or a JPEG picture.');
    assert.deepEqual(readdirSync(join(found.folder, "media")), ["logo.png"]);
    t.done();
  });
  it("refuses another picture of a name already in the episode, of the same size too, and takes back one it copied when the record cannot be written", async () => {
    const { t, found } = episode();
    picture(t, "logo.png", 600, 300);
    mkdirSync(join(found.folder, "media"), { recursive: true });
    const other = readFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "logo.png"));
    other[30] = 7;
    writeFileSync(join(found.folder, "media", "logo.png"), other);
    assert.equal((await on(t.ctx.deps, "logo", FOLDER, "on", "--picture", "logo.png")).text, 'Another picture called "logo.png" is in this episode already. Give yours another name in the Pictures folder.');
    picture(t, "BRIMM logo.png", 600, 300);
    // The record is written meanwhile, as by another command: the save is refused, and the picture taken out again.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2 }));
    const stale = { ...t.ctx.deps, isWhole: t.ctx.deps.isWhole };
    const clone = t.ctx.deps.clone;
    stale.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("BRIMM logo.png")) writeFileSync(recordFile(found.folder, 3), recordText({ ...reread(found), rev: 3 }));
    };
    assert.equal((await on(stale, "logo", FOLDER, "on", "--picture", "BRIMM logo.png")).code, 1);
    assert.equal(existsSync(join(found.folder, "media", "BRIMM logo.png")), false);
    assert.equal(reread(found).brand, undefined);
    t.done();
  });
});
```

In the test "each refuses a change, …", `asks` gains:

```js
      ["logo", FOLDER, "on", "--picture", "logo.png"]
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit-session.test.js`
Expected: FAIL: `logo` is not a command.

- [ ] **Step 3: Write the code**

`tool/edit.js`, beside the other imports:

```js
import { pictureNameFault, pictureSize } from "./pictures.js";
```

Before `saveSpellings`:

```js
/** A picture from her Pictures folder, by its name only, copied into the episode's media/ by the rule (spec section 4):
    { picture: "media/<name>", size, bytes, copied } or { code }. A link is refused: only a file of her own in the folder
    is taken. One already in media/ of that name is used when it is the same picture, byte for byte, and refused when it is
    another: nothing in Dropbox is written over. `copied` says this call put it there, so a command whose record cannot be
    written takes it out again. */
function pictureFrom(ctx, found, name) {
  const fault = pictureNameFault(name);
  if (fault) return { code: refuse(ctx, fault) };
  const from = join(studioFolder(ctx.home), "Pictures", name);
  let seen;
  try {
    seen = lstatSync(from);
  } catch (e) {
    return { code: refuse(ctx, `There is no picture called "${name}" in the Pictures folder (BRIMM Video Studio, Pictures). Put it there first.`) };
  }
  if (!seen.isFile()) return { code: refuse(ctx, `"${name}" in the Pictures folder is not a picture file of its own. Put the picture itself there.`) };
  const size = pictureSize(readFileSync(from));
  if (!size) return { code: refuse(ctx, `"${name}" cannot be read as a PNG or a JPEG picture.`) };
  const picture = `media/${name}`;
  const to = join(found.folder, picture);
  if (existsSync(to)) {
    if (!ctx.isWhole(to)) return { code: refuse(ctx, `Dropbox is still bringing ${picture} over to this Mac. Say it again when it is done.`) };
    if (!readFileSync(to).equals(readFileSync(from))) return { code: refuse(ctx, `Another picture called "${name}" is in this episode already. Give yours another name in the Pictures folder.`) };
    return { picture, size, bytes: seen.size, copied: false };
  }
  try {
    mkdirSync(join(found.folder, "media"), { recursive: true });
    cloneIn(from, to, ruleOpts(ctx));
  } catch (e) {
    return { code: refuse(ctx, `"${name}" could not be copied into the episode: ${String(e.message).replace(/\.$/, "")}.`) };
  }
  return { picture, size, bytes: seen.size, copied: true };
}

/** Save the record, and take a picture this command copied into media/ out again when the record cannot be written: the
    record never leaves a picture in the episode that it does not list. */
async function saveWithPicture(ctx, found, record, done, got) {
  const code = await save(ctx, found, record, done);
  if (code !== 0 && got && got.copied) rmSync(join(found.folder, got.picture), { force: true });
  return code;
}
```

After `spell`:

```js
/** `logo "<episode>" on|off [--picture "<name>"]`: the logo on the main video, top right (spec section 4). Its picture is
    named once, from the Pictures folder, and the episode keeps it. A Reel's logo comes with the brand templates (spec
    section 3). */
async function logo(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["picture"]);
  const [said, verb, ...more] = words;
  if (partFrom(more).part !== "main") return refuse(ctx, "A Reel's logo comes with the brand templates, later. The logo is on the main video.");
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  let record = found.record;
  let picked = null;
  if (verb === "on") {
    const named = flags.picture && flags.picture[flags.picture.length - 1];
    if (named) {
      const got = pictureFrom(ctx, found, named);
      if (got.code !== undefined) return got.code;
      picked = got;
      record = { ...record, brand: { ...(record.brand || {}), logo: got.picture }, files: { ...record.files, [got.picture]: got.bytes } };
    } else if (!(record.brand && record.brand.logo)) return refuse(ctx, 'Say which picture in the Pictures folder is the logo (--picture "<name>").');
  }
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, logo: verb === "on" })), `The logo is ${verb} on ${partLabel(part)}. ${SHOW_IT}`, picked);
}
```

The table gains `logo`, and the help, at its end:

```
  node edit.js logo "<episode>" on|off [--picture "<name>"]
                                        the logo on the main video, top right; its picture is named once, from the
                                        Pictures folder
```

`tool/studio/SKILL.md`, her row, and "Not ready yet" keeps only a Reel's logo:

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -27,6 +27,7 @@
 | "Show it in Final Cut" / "Show reel 1 in Final Cut" | `push "<episode>"` / `push "<episode>" reel 1`, with the guard below |
 | "Captions on Reel 2" / "No captions on Reel 2" | `captions "<episode>" reel 2 on` / `captions "<episode>" reel 2 off`. A Reel shows its captions unless they are turned off, and its title on screen whenever it has one |
 | "It's Hormozi, not Hormozy" | `spell "<episode>" add "Hormozy" "Hormozi"`: the one word as the transcriber writes it, then how it is spelled. "What spellings are there?": `spell "<episode>"`. After a finish it may say the hand-off was made again: tell her to drop it on the BRIMM Ops page again; if it says a video's captions on screen, or the final transcripts, keep the old spelling, tell her that changes when that video is shown in Final Cut, Shared and finished again |
+| "Logo on" / "Logo off" | `logo "<episode>" on` / `logo "<episode>" off`, on the main video. If it asks which picture is the logo, ask her its name in her Pictures folder, then `logo "<episode>" on --picture "<name>"` |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -47,7 +48,7 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, the logo, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
+- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-session.test.js tool/studio/SKILL.md
git commit -m "logo: the logo on the main video, from her Pictures folder, copied in by the rule"
```

Then (suggested): tell the lead a slice is ready for her laptop: a Reel's captions and title, `spell` and `logo`. It reaches her by an install, `--print` first, and Jason's yes.

---

## Task A7: `text` and `graphic`

**Files:**
- Modify: `tool/edit.js` (`nextId`, `lengthText`, `momentFrom`, `timelineRead`, `lengthFrom`, `text`, `graphic`; the table; the help), `tool/tests/edit-session.test.js`, `tool/tests/studio-ready.test.js`, `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: `momentOf`, `clockText`, `timelineAt` (C6); `clockFor` (A4); `guardOf` (A2); `pictureFrom`, `saveWithPicture` (A6); `REEL_FRAME`.
- Produces: `text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>] --line "<name>" [--line "<role>"]`, `text "<episode>" drop <id>`, the list; `graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>] [--place full|corner|lower]`, `graphic "<episode>" drop <id>`, `graphic "<episode>" ideas`, the list. Both take the guard's `--no-hand-edits`, `--hand-edits` and `--without-other-macs-changes`, as a push does. `timelineRead(ctx, found, part, flags) → { read }` or `{ code }`, the guard and the timeline read, which `cut` (A9) shares.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/edit-session.test.js`:

```js
describe("text", () => {
  it("puts a name over a role on the main video at a time on it, and the push shows it on the lower third", async () => {
    const { t, found } = episode();
    const r = await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden", "--line", "Founder, The BRIMM");
    assert.deepEqual(r, { code: 0, text: 'Name title t1 on the main video as it is now at 0:05, for 4 seconds: "Sallie Ogden", "Founder, The BRIMM". Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).main.texts, [{ id: "t1", kind: "lower-third", at: 14.415, for: 4, lines: ["Sallie Ogden", "Founder, The BRIMM"] }]);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.ok(tags(handed(t, "main"), "title").some((x) => x.name === "brimm text t1 3fa9c1"));
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "drop", "t1")).code, 0);
    assert.deepEqual(reread(found).main.texts, []);
    t.done();
  });
  it("asks the guard before reading a time on a timeline shown before, and reads it on the version shown", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden")).text, /^Did you change v1 of .* in Final Cut since it was shown\? Say "no changes" to go on\./);
    assert.match((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:05", "--line", "Sallie Ogden", "--no-hand-edits")).text, /^Name title t1 on main v1 at 0:05,/);
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:40", "--line", "x", "--no-hand-edits")).text, "0:40 is after the end of main v1, which is 0:09 long.");
    t.done();
  });
});

describe("graphic", () => {
  it("uses a picture already in the episode again without a second copy, refuses one that is not a picture, and takes back one it copied when the record cannot be written", async () => {
    const { t, found } = episode();
    picture(t, "chart.png", 1600, 900);
    for (const at of ["0:01", "0:05"]) assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "--at", at, "--place", "lower")).code, 0);
    assert.deepEqual([readdirSync(join(found.folder, "media")), reread(found).main.graphics.map((g) => g.picture)], [["chart.png"], ["media/chart.png", "media/chart.png"]]);
    writeFileSync(join(t.home, "BRIMM Video Studio", "Pictures", "notes.png"), "these are words, not a picture");
    assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "add", "notes.png", "--at", "0:01")).text, '"notes.png" cannot be read as a PNG or a JPEG picture.');
    picture(t, "photo.png", 1080, 1350);
    const stale = { ...t.ctx.deps };
    stale.clone = (from, to) => {
      t.ctx.deps.clone(from, to);
      if (to.endsWith("photo.png")) writeFileSync(recordFile(found.folder, reread(found).rev + 1), recordText({ ...reread(found), rev: reread(found).rev + 1 }));
    };
    assert.equal((await on(stale, "graphic", FOLDER, "add", "photo.png", "--at", "0:01")).code, 1);
    assert.deepEqual([readdirSync(join(found.folder, "media")), reread(found).main.graphics.length], [["chart.png"], 2]);
    t.done();
  });
  it("puts a picture from her Pictures folder in a Reel's corner at the words said, for their length", async () => {
    const { t, found } = episode();
    picture(t, "chart.png", 1600, 900);
    const r = await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "reel", "2", "--at-words", "know your costs", "--place", "corner");
    assert.deepEqual(r, { code: 0, text: 'Graphic g1, chart.png, corner, on Reel 2 as it is now at 0:02, for 1 second. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).reels.find((x) => x.n === 2).graphics, [{ id: "g1", picture: "media/chart.png", at: 15.3, for: 1, place: "corner" }]);
    t.done();
  });
  it("says how little of a wide picture shows full in a Reel", async () => {
    const { t } = episode();
    picture(t, "chart.png", 1600, 900);
    assert.match((await on(t.ctx.deps, "graphic", FOLDER, "add", "chart.png", "reel", "2", "--at", "0:01")).text, /only about 32% of it shows: say --place lower to show it whole\./);
    t.done();
  });
  it("offers Claude's ideas for graphics as places on the timeline", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "ideas")).text, 'A chart of what it costs to run the business: at 0:04 on the main video as it is now, "So the first thing you need to do is know your costs."');
    t.done();
  });
});
```

In the test "each refuses a change, …", `asks` gains:

```js
      ["text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden"],
      ["graphic", FOLDER, "add", "chart.png", "--at", "0:01"]
```

In "still list what there is …", `lists` gains:

```js
      ["text", FOLDER],
      ["graphic", FOLDER],
      ["graphic", FOLDER, "ideas"]
```

In "a Reel cut as a clip …", `asks` gains:

```js
      ["text", FOLDER, "add", "lower-third", "reel", "1", "--at", "0:01", "--line", "x"]
```

In `tool/tests/studio-ready.test.js`, `LANDED` gains "words on screen", "lower third", "graphic", "Pictures folder".

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit-session.test.js tests/studio-ready.test.js`
Expected: FAIL: `text` and `graphic` are not commands; "words on screen", "lower third", "graphic" and "Pictures folder" are still under "Not ready yet".

- [ ] **Step 3: Write the code**

`tool/edit.js`, beside the other imports (`clockFor` is in the import from `./timeline.js` already):

```js
import { momentOf, clockText, timelineAt } from "./clock.js";
import { REEL_FRAME } from "./reels.js";
```

Before `SHOW_IT`:

```js
/** The next id of a layer: its letter and one more than the highest of the part's. */
const nextId = (items, letter) => `${letter}${1 + Math.max(0, ...(items || []).map((x) => Number(String(x.id).slice(1)) || 0))}`;
/** Seconds as a person reads a length: "4 seconds", "1.5 seconds". */
const lengthText = (seconds) => `${Math.round(seconds * 10) / 10} second${seconds === 1 ? "" : "s"}`;
```

After `layerStart`:

```js
/** The moment a command is given on a timeline, in seconds of the raw video: { at, for, on } or { code }. With `--at` a time,
    or `--at-words` quoted words, read on the newest version shown (clock.js), after the guard: a timeline shown before is
    read only when she says it was not changed in Final Cut since (`--no-hand-edits`). */
function momentFrom(ctx, found, part, flags, { needed = true } = {}) {
  const time = flags.at && flags.at[flags.at.length - 1];
  const quoted = flags["at-words"] && flags["at-words"][flags["at-words"].length - 1];
  if (!time && !quoted) return needed ? { code: refuse(ctx, "Say when: a time on the timeline (--at 0:03), or the words said there (--at-words \"three numbers\").") } : { none: true };
  const got = timelineRead(ctx, found, part, flags);
  if (got.code !== undefined) return got;
  const { read } = got;
  const moment = momentOf({ ...(quoted ? { quoted } : { time }), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words });
  if (moment.why) return { code: refuse(ctx, moment.why) };
  return { ...moment, on: read.on, clock: read.clock, read };
}

/** The timeline she names, as she watched it, read for a time or words she gives: { read } (clockFor) or { code }. After the
    guard: a timeline shown before is read only when she says it was not changed in Final Cut since. */
function timelineRead(ctx, found, part, flags) {
  const guard = guardOf(ctx, found, part, { noHandEdits: Boolean(flags["no-hand-edits"]), handEdits: Boolean(flags["hand-edits"]), withoutOther: Boolean(flags["without-other-macs-changes"]) }, "to go on");
  if (guard.why) return { code: refuse(ctx, guard.why) };
  const read = clockFor(found, part, ctx);
  if (read.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: read.bring });
    return { code: refuse(ctx, `Dropbox is still bringing ${read.coming} over to this Mac. Say it again when it is done.`) };
  }
  if (read.why) return { code: refuse(ctx, read.why) };
  return { read };
}

/** How long a layer shows: `--for` seconds, else the quoted words' length, else `fallback`. { seconds } or { code }. */
function lengthFrom(ctx, flags, moment, fallback) {
  if (!flags.for) return { seconds: moment.for ? Math.max(moment.for, 1) : fallback };
  const seconds = Number(flags.for[flags.for.length - 1]);
  if (!(seconds > 0 && seconds <= 600)) return { code: refuse(ctx, "Say how long it shows in seconds, from 1 to 600 (--for 6).") };
  return { seconds };
}
```

After `captions`:

```js
/** `text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>] --line "<name>"
    [--line "<role>"]`, `text "<episode>" drop <id> [main | reel <n>]`, and with neither, the list: a name over a role on a
    timeline, from the moment given, for the seconds given (4 unless said). */
async function text(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "line"]);
  const [said, verb, kindOrId, ...more] = words;
  const start = layerStart(ctx, [said, ...(verb === "add" || verb === "drop" ? more : [verb, kindOrId, ...more].filter((w) => w !== undefined))], { writes: verb === "add" || verb === "drop" });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const texts = target.texts || [];
  if (verb === undefined || (verb !== "add" && verb !== "drop")) {
    ctx.say(texts.length ? texts.map((t) => `${t.id}: "${t.lines.join('", "')}" at ${t.at} s of the recording, for ${lengthText(t.for)}`).join("\n") : `There are no texts on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!texts.some((t) => t.id === kindOrId)) return refuse(ctx, `There is no text ${kindOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: texts.filter((x) => x.id !== kindOrId) })), `Text ${kindOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  if (kindOrId !== "lower-third") return refuse(ctx, "The kind of text there is so far is a lower third: a name over a role (add lower-third).");
  const lines = (flags.line || []).map((l) => oneLine(l)).filter(Boolean);
  if (!lines.length || lines.length > 2) return refuse(ctx, 'Say the name, and the role under it if there is one (--line "Sallie Ogden" --line "Founder, The BRIMM").');
  const moment = momentFrom(ctx, found, part, flags);
  if (moment.code !== undefined) return moment.code;
  const length = lengthFrom(ctx, flags, {}, 4);
  if (length.code !== undefined) return length.code;
  const id = nextId(texts, "t");
  const layer = { id, kind: "lower-third", at: moment.at, for: length.seconds, lines };
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: [...texts, layer] })), `Name title ${id} on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}, for ${lengthText(length.seconds)}: "${lines.join('", "')}". ${SHOW_IT}`);
}

/** `graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>]
    [--place full|corner|lower]`, `graphic "<episode>" drop <id> [main | reel <n>]`, `graphic "<episode>" ideas
    [main | reel <n>]`, and with none, the list: a picture from her Pictures folder over a timeline (spec section 4). */
async function graphic(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "place"]);
  const [said, verb, nameOrId, ...more] = words;
  const takes = verb === "add" || verb === "drop";
  const start = layerStart(ctx, [said, ...(takes ? more : [verb === "ideas" ? undefined : verb, nameOrId, ...more].filter((w) => w !== undefined))], { writes: takes });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const graphics = target.graphics || [];
  if (verb === "ideas") {
    const read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    const ideas = ((read.plan.claude && read.plan.claude.graphics) || []).map((idea) => ({ idea: idea.idea, phrase: read.plan.phrases.find((p) => p.id === idea.id) }))
      .filter(({ phrase }) => phrase && read.pieces.some((r) => phrase.end > r.start && phrase.start < r.end));
    ctx.say(ideas.length ? ideas.map(({ idea, phrase }) => `${idea}: at ${clockText(timelineAt(read.clock, Math.max(phrase.start, read.pieces.find((r) => phrase.end > r.start && phrase.start < r.end).start)) ?? 0)} on ${read.on}, "${phrase.text}"`).join("\n") : `Claude gave no ideas for graphics on what ${partLabel(part)} keeps.`);
    return 0;
  }
  if (!takes) {
    ctx.say(graphics.length ? graphics.map((g) => `${g.id}: ${g.picture.replace(/^media\//, "")}, ${g.place}, at ${g.at} s of the recording, for ${lengthText(g.for)}`).join("\n") : `There are no graphics on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!graphics.some((g) => g.id === nameOrId)) return refuse(ctx, `There is no graphic ${nameOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, graphics: graphics.filter((g) => g.id !== nameOrId) })), `Graphic ${nameOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  const place = flags.place ? flags.place[flags.place.length - 1] : "full";
  if (!["full", "corner", "lower"].includes(place)) return refuse(ctx, `"${place}" is not a place. Say full, corner or lower.`);
  const moment = momentFrom(ctx, found, part, flags);
  if (moment.code !== undefined) return moment.code;
  const length = lengthFrom(ctx, flags, moment, 4);
  if (length.code !== undefined) return length.code;
  const got = pictureFrom(ctx, found, nameOrId);
  if (got.code !== undefined) return got.code;
  const id = nextId(graphics, "g");
  const layer = { id, picture: got.picture, at: moment.at, for: length.seconds, place };
  // A picture shown full in another shape than the frame loses its edges: how much of it shows is said.
  const frame = part === "main" ? { width: moment.read.plan.facts.width, height: moment.read.plan.facts.height } : REEL_FRAME;
  const shown = Math.min(got.size.width / got.size.height / (frame.width / frame.height), (frame.width / frame.height) / (got.size.width / got.size.height));
  const cropped = place === "full" && shown < 0.67 ? ` The picture is another shape than the frame, so only about ${Math.round(shown * 100)}% of it shows: say --place lower to show it whole.` : "";
  const record = { ...found.record, files: { ...found.record.files, [got.picture]: got.bytes } };
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, graphics: [...graphics, layer] })), `Graphic ${id}, ${nameOrId}, ${place}, on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}, for ${lengthText(length.seconds)}.${cropped} ${SHOW_IT}`, got);
}
```

The table gains `text` and `graphic`, and the help, at its end:

```
  node edit.js text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>]
                     --line "<name>" [--line "<role>"] [--no-hand-edits]
                                        a name over a role, at a time on the timeline or the words said there; "drop
                                        <id>" takes one off, and with neither, the list
  node edit.js graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>")
                     [--for <seconds>] [--place full|corner|lower] [--no-hand-edits]
                                        a picture from the Pictures folder over the timeline; "drop <id>" takes one off,
                                        "ideas" lists Claude's, and with neither, the list
```

`tool/studio/SKILL.md`, two rows, a line on words she quotes, and a line in "The guard"; words on screen, a lower third, a graphic and the line about pictures leave "Not ready yet":

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -28,6 +28,8 @@
 | "Captions on Reel 2" / "No captions on Reel 2" | `captions "<episode>" reel 2 on` / `captions "<episode>" reel 2 off`. A Reel shows its captions unless they are turned off, and its title on screen whenever it has one |
 | "It's Hormozi, not Hormozy" | `spell "<episode>" add "Hormozy" "Hormozi"`: the one word as the transcriber writes it, then how it is spelled. "What spellings are there?": `spell "<episode>"`. After a finish it may say the hand-off was made again: tell her to drop it on the BRIMM Ops page again; if it says a video's captions on screen, or the final transcripts, keep the old spelling, tell her that changes when that video is shown in Final Cut, Shared and finished again |
 | "Logo on" / "Logo off" | `logo "<episode>" on` / `logo "<episode>" off`, on the main video. If it asks which picture is the logo, ask her its name in her Pictures folder, then `logo "<episode>" on --picture "<name>"` |
+| "Put my name up at 0:03" | `text "<episode>" add lower-third --at 0:03 --line "Sallie Ogden" --line "<her role>"`; on a Reel, `text "<episode>" add lower-third reel 2 --at 0:03 …`. For a guest, ask the name and the role. A time is as she sees it on that timeline in Final Cut; when she gives words, not a time, use `--at-words "<her words>"` |
+| "Show the pricing chart when I say three numbers" | `graphic "<episode>" add "<picture>" --at-words "three numbers"`, with `--place corner` or `--place lower` if she says so (full unless she does). Ask which picture in her Pictures folder. "Any ideas for graphics?": `graphic "<episode>" ideas` |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -35,6 +37,8 @@
 | "Hand it to Jason" / "I'm done with it for now" | `release "<episode>"`, with the release question below |
 | "Sort out the conflict" | `resolve "<episode>"`; show her the two sides in plain words; then `resolve "<episode>" --keep A` or `resolve "<episode>" --keep B` as she picks. If it says a conflict needs Jason, or that Dropbox is still bringing a file over, tell her so and keep nothing. If it says that is not the version shown last, or that it was sorted out meanwhile, show her what it shows now and ask her again: never reuse her last answer |
 
+In `--at-words`, give her words without `$`, backticks, backslashes or double quotes, which are not matched, and keep apostrophes: "that's $100,000" is `--at-words "that's 100,000"`.
+
 ## The guard, before showing a timeline again
 
 When a push answers that the timeline was shown before, ask her, in these words: "Did you change v<N> in Final Cut since it was shown?"
@@ -42,13 +46,15 @@
 - If yes: run it with `--hand-edits` and read her what it says: her changes stay in v<N>; brimm-video cannot build on them yet. Until it can, ask brimm-video for its changes first and make trims by hand last, or finish that timeline by hand.
 - If the push says the changes are, or may be, on the other Mac: tell her so in plain words, and that whoever used it there can say. Run the push again with `--without-other-macs-changes` only if she says to go ahead without them. Never use `--no-hand-edits` for this: that is her answer about her own Final Cut.
 
+`text` and `graphic` ask it too, before they read a time or her words on a timeline shown before: ask her the same question, and answer in the same way.
+
 ## The release question
 
 When `release "<episode>"` asks, ask her: "Did you change anything in Final Cut since it was last shown?" No: run it again with `--no-hand-edits`. Yes: run it again with `--hand-edits-stay`, and tell her the changes stay in this Mac's library. If it says an export is out of date, read her what to do in Final Cut, then try again. Afterwards tell her to keep the laptop open and online until Dropbox shows the folder is up to date.
 
 ## Not ready yet: say so, and what to do by hand
 
-- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), words on screen, a lower third, a graphic, a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut." For a picture: "Put it in the Pictures folder in BRIMM Video Studio, then drag it into Final Cut."
+- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-session.test.js tool/tests/studio-ready.test.js tool/studio/SKILL.md
git commit -m "text and graphic: a name over a role and a picture, at a time or words read on the timeline she watched"
```

---

## Task A8: `preset`

**Files:**
- Modify: `tool/edit.js` (`preset`; the table; the help), `tool/tests/edit-session.test.js`, `tool/tests/studio-ready.test.js`, `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: `JOBS`, `CAPTION_STYLES`, `LOOKS`, `defaultPreset`, `presetFault`, `nameOf`, `idOf` (C2).
- Produces: `preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]`; she names each as she reads it ("teaching clip") or by its id, and the record keeps the id. The looks are applied once C9 has filled in their presets (ruling 4); until then a push says a look is recorded. Its test gives its own presets (`t.ctx.deps.lookPresets`), so it holds before C9 and after.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/edit-session.test.js`:

```js
describe("preset", () => {
  it("says what a timeline has and what there is, and takes a job with its own style and look", async () => {
    const { t, found } = episode();
    assert.match((await on(t.ctx.deps, "preset", FOLDER)).text, /^The main video is a full episode, with file only captions and the natural look\. \(Its default\.\)\nJobs: full episode, solo clip/);
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "reel", "2", "--job", "teaching-clip", "--captions", "bold")).code, 0);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).preset, { job: "teaching-clip", captions: "bold", look: "natural" });
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "--look", "sepia")).text, '"sepia" is not a look. The looks are: natural, bright, warm, moody.');
    // Until Jason's check gives Final Cut's preset for a look, it is recorded, and the push says so (C9 fills them in: the test
    // gives its own, so it holds either way).
    t.ctx.deps.lookPresets = {};
    assert.equal((await on(t.ctx.deps, "preset", FOLDER, "--look", "moody")).code, 0);
    assert.match((await on(t.ctx.deps, "push", FOLDER)).text, /\nMoody is recorded\. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one\.\n/);
    // Once it is known, the push puts it on every clip of the main video, at its Mix, and says nothing of it. The made-up
    // recording has 720 lines, so its Mix is at 75% (rule 6).
    t.ctx.deps.lookPresets = { moody: { name: "Warmer Vintage with Dark Blacks", uid: ".../Warmer Vintage with Dark Blacks.moef", mixKey: "9999/999/1/100/101" } };
    const r = await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /Moody was applied at 75% strength: the recording has 720 lines\./);
    const xml = handed(t, "main");
    assert.deepEqual(tags(xml, "effect").filter((e) => e.name === "Warmer Vintage with Dark Blacks"), [{ id: tags(xml, "effect").find((e) => e.name === "Warmer Vintage with Dark Blacks").id, name: "Warmer Vintage with Dark Blacks", uid: ".../Warmer Vintage with Dark Blacks.moef" }]);
    assert.equal(tags(xml, "filter-video").length, tags(xml, "asset-clip").length);
    assert.deepEqual([...new Set(tags(xml, "param").filter((p) => p.name === "Mix").map((p) => p.value))], ["0.375"]);
    t.done();
  });
});
```

In the test "each refuses a change, …", `asks` gains:

```js
      ["preset", FOLDER, "--look", "bright"]
```

In "still list what there is …", `lists` gains:

```js
      ["preset", FOLDER]
```

In "a Reel cut as a clip …", `asks` gains:

```js
      ["preset", FOLDER, "reel", "1", "--look", "warm"]
```

In `tool/tests/studio-ready.test.js`, `LANDED` gains "make it Bright", "style".

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit-session.test.js tests/studio-ready.test.js`
Expected: FAIL: `preset` is not a command; "make it Bright" and "style" are still under "Not ready yet".

- [ ] **Step 3: Write the code**

`tool/edit.js`, beside the other imports:

```js
import { JOBS, CAPTION_STYLES, LOOKS, defaultPreset, presetFault, nameOf, idOf } from "./styles.js";
```

After `graphic`:

```js
/** `preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]`: the timeline's job,
    caption style and look, each from its list (styles.js); with none of them, what it has and what there is. */
async function preset(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["job", "captions", "look"]);
  const start = layerStart(ctx, words, { writes: ["job", "captions", "look"].some((k) => flags[k]) });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const now = target.preset || defaultPreset(found.record.kind, part);
  // The record keeps each by its id ("full-episode"), as the spec's record does; a person names it either way.
  const given = Object.fromEntries(["job", "captions", "look"].filter((k) => flags[k]).map((k) => [k, idOf(flags[k][flags[k].length - 1])]));
  const describe = (p) => `${partLabel(part)[0].toUpperCase()}${partLabel(part).slice(1)} is a ${nameOf(p.job)}, with ${nameOf(p.captions)} captions and the ${nameOf(p.look)} look.`;
  if (!Object.keys(given).length) {
    ctx.say(`${describe(now)}${target.preset ? "" : " (Its default.)"}`);
    ctx.say(`Jobs: ${Object.keys(JOBS).map(nameOf).join(", ")}. Caption styles: ${Object.keys(CAPTION_STYLES).map(nameOf).join(", ")}. Looks: ${Object.keys(LOOKS).join(", ")}.`);
    return 0;
  }
  // A new job brings its own caption style and look, unless they are given too.
  const next = given.job && given.job !== now.job ? { job: given.job, captions: (JOBS[given.job] || {}).captions, look: (JOBS[given.job] || {}).look, ...given } : { ...now, ...given };
  const fault = presetFault(next);
  if (fault) return refuse(ctx, fault);
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, preset: next })), `${describe(next)} ${SHOW_IT}`);
}
```

The table gains `preset`, and the help, at its end:

```
  node edit.js preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]
                                        the timeline's job, caption style and look; with none, what it has and what
                                        there is
```

`tool/studio/SKILL.md`, her row; a look or style leaves "Not ready yet":

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -30,6 +30,7 @@
 | "Logo on" / "Logo off" | `logo "<episode>" on` / `logo "<episode>" off`, on the main video. If it asks which picture is the logo, ask her its name in her Pictures folder, then `logo "<episode>" on --picture "<name>"` |
 | "Put my name up at 0:03" | `text "<episode>" add lower-third --at 0:03 --line "Sallie Ogden" --line "<her role>"`; on a Reel, `text "<episode>" add lower-third reel 2 --at 0:03 …`. For a guest, ask the name and the role. A time is as she sees it on that timeline in Final Cut; when she gives words, not a time, use `--at-words "<her words>"` |
 | "Show the pricing chart when I say three numbers" | `graphic "<episode>" add "<picture>" --at-words "three numbers"`, with `--place corner` or `--place lower` if she says so (full unless she does). Ask which picture in her Pictures folder. "Any ideas for graphics?": `graphic "<episode>" ideas` |
+| "Make it Bright" / "Bold captions on Reel 2" / "It's a teaching clip" | `preset "<episode>" --look bright` / `preset "<episode>" reel 2 --captions bold` / `preset "<episode>" reel 2 --job "teaching clip"`. "What styles are there?": `preset "<episode>"`, and tell her the lists in plain words |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -54,7 +55,7 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A look or style ("make it Bright"), a cut ("keep the Hormozi story"), a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
+- A cut ("keep the Hormozi story"), a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-session.test.js tool/tests/studio-ready.test.js tool/studio/SKILL.md
git commit -m "preset: a timeline's job, caption style and look, from the research's lists"
```

---

## Task A9: `cut`

**Files:**
- Modify: `tool/edit.js` (`cut`; the table; the help), `tool/tests/edit-session.test.js`, `tool/tests/studio-ready.test.js`, `tool/studio/SKILL.md`

**Interfaces:**
- Consumes: `cutSpan`, `cutPhrases`, `keptRanges` (C7); `momentOf`, `cutNear`, `clockText`, `wordsAt`, `secondsOf`, `rawAt`, `lengthOf` (C6); `clockFor` (A4), `layerStart` (A4), `momentFrom`, `timelineRead`, `nextId` (A7).
- Produces: `cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>)` and `cut "<episode>" keep [main | reel <n>] (--words "<words>" | --at <time>)` (ruling 9), each with the guard's flags. `remove` with neither words nor times asks for one.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/edit-session.test.js`:

```js
describe("cut", () => {
  it("takes whole phrases out of the main video at a pause, says so, and the push leaves them out", async () => {
    const { t, found } = episode();
    const r = await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "today we are going");
    assert.equal(r.text, 'Taken out of the main video: "Welcome to the show. Today we are going to talk about pricing." (0:06 to 0:10 of the recording, whole phrases, at a pause). A cut on the main video does not reach a Reel over the same words. Say "show it in Final Cut" to see it.');
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: false, from: 6.07, to: 9.638 }]);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.equal(tags(handed(t, "main"), "asset-clip").length, 2);
    t.done();
  });
  it("takes out a stretch by its times on the timeline she watched, to its very end, and refuses it reversed or with no end", async () => {
    // The main video runs 9.198 s, which its clock shows as 0:09: the end, read to the second, is still the end.
    for (const end of ["9.198", "0:10"]) {
      const { t, found } = episode();
      assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", end)).text, /^Taken out of the main video: "So the first thing you need to do is know your costs\. It is very, very important\. Thank you so much, Sallie\." \(0:14 to 0:21 of the recording/);
      assert.deepEqual(reread(found).main.cuts.map((c) => [c.from, c.to]), [[13.583, 21.097]]);
      // Now 3.968 s long, which reads 0:04 to the second: a time past it is said to the tenth.
      assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:05")).text, "0:04 is after the end of the main video as it is now, which is 0:03.9 long.");
      t.done();
    }
    const { t: t2, found: found2 } = episode();
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:07", "--to", "0:05")).text, "A cut ends after it starts: 0:05 is not after 0:07 on the main video as it is now.");
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:07")).text, "Say where the cut ends too (--to 0:12).");
    assert.equal((await on(t2.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:11")).text, "0:11 is after the end of the main video as it is now, which is 0:09 long.");
    assert.deepEqual(reread(found2).main.cuts, []);
    t2.done();
  });
  it("refuses a cut that would take out all of a timeline, and writes nothing", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:00", "--to", "0:09")).text, "That would take out all of the main video. Say a shorter stretch.");
    assert.deepEqual(reread(found).main.cuts, []);
    t.done();
  });
  it("keeps what was cut at the join nearest a time on the timeline she watched, and says what it kept", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    // Read on a timeline shown before, a time asks the guard first, and nothing is written until it is answered.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:07")).text, /^Did you change v1 of Pricing: what to charge\? in Final Cut since it was shown\?/);
    assert.deepEqual(reread(found).main.cuts, []);
    // On main v1, 0:07 is beside the join where "It is very, very important." was cut.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:07", "--no-hand-edits")).text, /^Kept in the main video: "It is very, very important\." \(0:17 to 0:19 of the recording/);
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: true, from: 17.246, to: 19.022 }]);
    // 0:09 is beside it too, and beside a join where only a pause was cut: that one never counts.
    for (const at of ["0:07", "0:09"]) assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", at, "--no-hand-edits")).text, '"It is very, very important." is kept on main v1 already.', at);
    // 0:02 lies between the joins at 0:00 and 0:04, where words were cut at each: neither is guessed.
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:02", "--no-hand-edits")).text, 'There are 2 places near 0:02 on main v1 where words were cut: at 0:00, "Welcome to the show. Today…", and at 0:04, "So the..." Say the words that were cut (--words), or a time nearer one of them.');
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep")).text, 'Say what to keep: the words that were cut (--words "very important"), or the time on the timeline where they were cut (--at 12:30).');
    assert.equal(reread(found).main.cuts.length, 1);
    t.done();
  });
  it("keeps again what a cut took out since she watched it, and never the cut beside it", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "remove", "--at", "0:04", "--to", "0:06", "--no-hand-edits")).text, /^Taken out of the main video: "So the first thing you need to do is know your costs\."/);
    // 0:05 on main v1 is in what that cut took out: it is that cut that is kept again, not "So the..." at the join beside it.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--at", "0:05", "--no-hand-edits")).text, /^Kept in the main video: "So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).main.cuts.map((c) => [c.keep, c.from, c.to]), [[false, 13.583, 16.33], [true, 13.583, 16.33]]);
    t.done();
  });
  it("keeps what a cut took from a Reel's start, at 0:00 on it", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "reel", "2", "--words", "know your costs")).code, 0);
    // What was cut before its first piece is a cut at 0:00, within the Reel's own stretch: her cut, and Claude's beside it.
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--at", "0:00")).text, /^Kept in Reel 2: "So the first thing you need to do is know your costs\. It is very, very important\."/);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("asks what to take out when it is given neither words nor times", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove")).text, 'Say what to take out: the words (--words "know your costs"), or where it starts and ends on the timeline (--at 0:04 --to 0:09).');
    assert.deepEqual(reread(found).main.cuts, []);
    t.done();
  });
  it("keeps words cut from a Reel within its stretch, though they are said again outside it", async () => {
    const { t, found } = episode();
    // "So the" is said in the false start before Reel 2's stretch, and again in the line the Reel starts with.
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "reel", "2", "--words", "know your costs")).code, 0);
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--words", "So the")).text, /^Kept in Reel 2: "So the first thing you need to do is know your costs\."/);
    assert.deepEqual(reread(found).reels.find((r) => r.n === 2).cuts.map((c) => c.keep), [false, true]);
    t.done();
  });
  it("keeps what the plan cut, by its words", async () => {
    const { t, found } = episode();
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "--words", "very important")).text, /^Kept in the main video: "It is very, very important\." \(0:17 to 0:19 of the recording/);
    assert.deepEqual(reread(found).main.cuts, [{ id: "c1", keep: true, from: 17.246, to: 19.022 }]);
    t.done();
  });
  it("takes Claude's graphic idea for the words a cut took out off the next push, and puts it back when they are kept again", async () => {
    const { t } = episode();
    const ideas = () => tags(handed(t, "main"), "marker").filter((m) => m.value.startsWith("Graphic idea"));
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "know your costs")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER)).code, 0);
    assert.deepEqual(ideas(), []);
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "keep", "--words", "know your costs")).code, 0);
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "--no-hand-edits")).code, 0);
    assert.equal(ideas().length, 1);
    t.done();
  });
  it("leaves out of the next push a name title whose moment a cut took out, and says so", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden")).code, 0);
    assert.equal((await on(t.ctx.deps, "cut", FOLDER, "remove", "--words", "Welcome to the show")).code, 0);
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.equal(r.code, 0);
    assert.match(r.text, /\nThe name title t1 \("Sallie Ogden"\) is in what is cut now, so it is not shown\./);
    assert.ok(!tags(handed(t, "main"), "title").some((x) => x.name === "brimm text t1 3fa9c1"));
    t.done();
  });
  it("refuses what is outside a Reel's stretch", async () => {
    const { t } = episode();
    assert.match((await on(t.ctx.deps, "cut", FOLDER, "keep", "reel", "2", "--words", "Let me do that again")).text, /^That is outside Reel 2's stretch of the recording/);
    t.done();
  });
});
```

Among them are Review Focus 2 (the very end, a time past it, reversed times) and 3 (a name title, and Claude's graphic idea, whose moment a cut takes out).

In the test "each refuses a change, …", `asks` gains:

```js
      ["cut", FOLDER, "remove", "--words", "know your costs"]
```

In `tool/tests/studio-ready.test.js`, `LANDED` gains "cut", "Hormozi", and after "names nothing that is ready":

```js
  it("tells Claude the times in the cut plan, the notes and the markers are the recording's, never to be given as a time on her timeline", () => {
    assert.ok(skill.includes("Times in the cut plan, in Claude's notes and inside a marker's words are the recording's, not her timeline's: never pass one as `--at`. To keep a cut found there, pass its words."), skill);
  });
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit-session.test.js tests/studio-ready.test.js`
Expected: FAIL: `cut` is not a command; "cut" and "Hormozi" are still under "Not ready yet"; her skill has no line on the recording's own times.

- [ ] **Step 3: Write the code**

`tool/edit.js`, beside the other imports (`cutNear`, `wordsAt`, `secondsOf`, `rawAt` and `lengthOf` join the import from `./clock.js`):

```js
import { cutSpan, cutPhrases, keptRanges } from "./recut.js";
```

After `preset`:

```js
/** `cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>)` and `cut "<episode>" keep
    [main | reel <n>] (--words "<words>" | --at <time>)`: whole phrases taken out of a timeline, or kept that were cut, always
    at a pause (recut.js). A time is read on the timeline she names, as she watched it (spec section 4, "Times a person
    gives"): what is taken out runs from --at to --to on it, and what is kept is what was cut at the join nearest --at
    ("keep the Hormozi story at 12:30"). Words to keep are found in what is cut. A cut that would keep nothing is refused. A
    cut on the main video does not reach a Reel over the same words, and is said so. */
async function cut(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["words", "at", "to"]);
  const [said, verb, ...more] = words;
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  if (verb !== "keep" && verb !== "remove") {
    ctx.say(HELP);
    return 2;
  }
  const last = (k) => (flags[k] ? flags[k][flags[k].length - 1] : undefined);
  let from;
  let to;
  let read;
  const cuts = target.cuts || [];
  if (verb === "remove") {
    if (!flags.words && !flags.at) return refuse(ctx, 'Say what to take out: the words (--words "know your costs"), or where it starts and ends on the timeline (--at 0:04 --to 0:09).');
    if (!flags.words && !last("to")) return refuse(ctx, "Say where the cut ends too (--to 0:12).");
    const first = momentFrom(ctx, found, part, { ...flags, ...(flags.words ? { "at-words": flags.words } : {}) });
    if (first.code !== undefined) return first.code;
    read = first.read;
    from = first.at;
    to = first.at + (first.for || 0);
    if (!flags.words) {
      const end = momentOf({ time: last("to"), on: first.on, clock: first.clock, ranges: read.pieces, words: read.words, end: true });
      if (end.why) return refuse(ctx, end.why);
      if (!(end.at > from)) return refuse(ctx, `A cut ends after it starts: ${last("to")} is not after ${last("at")} on ${first.on}.`);
      to = end.at;
    }
  } else if (flags.words) {
    read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    let places = wordsAt(read.words, [{ start: 0, end: read.plan.facts.duration }], last("words")).filter((p) => !read.pieces.some((r) => p.start < r.end && p.end > r.start));
    // On a Reel, only what is cut within its stretch counts: the same words said elsewhere in the recording are not meant.
    if (read.span) {
      const within = places.filter((p) => p.start >= read.span.from && p.end <= read.span.to);
      if (!within.length && places.length) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
      places = within;
    }
    if (places.length !== 1) return refuse(ctx, places.length ? `"${last("words")}" is said ${places.length} times in what is cut. Say the time on ${read.on} where it was cut instead (--at 0:07).` : `"${last("words")}" is not in what is cut from ${partLabel(part)}.`);
    [from, to] = [places[0].start, places[0].end];
  } else {
    if (!flags.at) return refuse(ctx, 'Say what to keep: the words that were cut (--words "very important"), or the time on the timeline where they were cut (--at 12:30).');
    const got = timelineRead(ctx, found, part, flags);
    if (got.code !== undefined) return got.code;
    read = got.read;
    const t = secondsOf(last("at"));
    const raw = t === null || t > lengthOf(read.clock) + 1 ? null : rawAt(read.clock, Math.min(t, lengthOf(read.clock)));
    if (raw !== null && !read.pieces.some((r) => raw >= r.start - 0.0005 && raw <= r.end + 0.0005)) {
      // A time on what was kept when she watched it, and is cut now: the cut she asked for that took it out, the newest.
      const since = [...cuts].reverse().find((c) => !c.keep && raw >= c.from && raw <= c.to);
      if (!since) return refuse(ctx, momentOf({ time: last("at"), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words }).why);
      [from, to] = [since.from, since.to];
    } else {
      // Otherwise the cut nearest it, by what is said there now: words cut, or kept again since.
      const now = cutPhrases(read.plan.phrases, cuts);
      const said = (c) => {
        const there = now.filter((p) => (p.start + p.end) / 2 > c.from && (p.start + p.end) / 2 < c.to);
        return { cut: there.filter((p) => !p.keep).map((p) => p.text).join(" "), kept: there.filter((p) => p.keep).map((p) => p.text).join(" ") };
      };
      const near = cutNear({ time: last("at"), on: read.on, clock: read.clock, edges: part === "main" ? { from: 0, to: read.plan.facts.duration } : read.span, said });
      if (near.why) return refuse(ctx, near.why);
      [from, to] = [near.cut.from, near.cut.to];
    }
  }
  if (read.span && (from < read.span.from || to > read.span.to)) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
  const whole = cutSpan(read.plan.phrases, from, to);
  if (whole.why) return refuse(ctx, whole.why);
  const what = read.plan.phrases.filter((p) => whole.phrases.includes(p.id)).map((p) => p.text).join(" ");
  if (verb === "keep" && cutPhrases(read.plan.phrases, cuts).filter((p) => whole.phrases.includes(p.id)).every((p) => p.keep)) return refuse(ctx, `"${what}" is kept on ${partLabel(part)} already.`);
  const next = [...cuts, { id: nextId(cuts, "c"), keep: verb === "keep", from: whole.from, to: whole.to }];
  // A timeline that keeps nothing cannot be shown, and every time on it would be refused after: such a cut is refused.
  if (!keptRanges({ plan: read.plan, cuts: next, span: read.span }).length) return refuse(ctx, `That would take out all of ${partLabel(part)}. Say a shorter stretch.`);
  const reach = part === "main" ? " A cut on the main video does not reach a Reel over the same words." : "";
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, cuts: next })), `${verb === "keep" ? "Kept in" : "Taken out of"} ${partLabel(part)}: "${what}" (${clockText(whole.from)} to ${clockText(whole.to)} of the recording, whole phrases, at a pause).${reach} ${SHOW_IT}`);
}
```

The table gains `cut`, and the help, at its end:

```
  node edit.js cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>) [--no-hand-edits]
  node edit.js cut "<episode>" keep [main | reel <n>] (--words "<words>" | --at <time>) [--no-hand-edits]
                                        take whole phrases out, at a pause, as read on the timeline; or keep what was
                                        cut, by its words or at the join nearest a time on the timeline
```

`tool/studio/SKILL.md`, her row; `cut` joins the guard's line and the line on words she quotes; a line on the recording's own times; a cut leaves "Not ready yet":

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -31,6 +31,7 @@
 | "Put my name up at 0:03" | `text "<episode>" add lower-third --at 0:03 --line "Sallie Ogden" --line "<her role>"`; on a Reel, `text "<episode>" add lower-third reel 2 --at 0:03 …`. For a guest, ask the name and the role. A time is as she sees it on that timeline in Final Cut; when she gives words, not a time, use `--at-words "<her words>"` |
 | "Show the pricing chart when I say three numbers" | `graphic "<episode>" add "<picture>" --at-words "three numbers"`, with `--place corner` or `--place lower` if she says so (full unless she does). Ask which picture in her Pictures folder. "Any ideas for graphics?": `graphic "<episode>" ideas` |
 | "Make it Bright" / "Bold captions on Reel 2" / "It's a teaching clip" | `preset "<episode>" --look bright` / `preset "<episode>" reel 2 --captions bold` / `preset "<episode>" reel 2 --job "teaching clip"`. "What styles are there?": `preset "<episode>"`, and tell her the lists in plain words |
+| "Cut the bit where I say …" / "Keep the Hormozi story at 12:30" | `cut "<episode>" remove --words "<her words>"` (or `--at` and `--to`, times on that timeline) / `cut "<episode>" keep --at 12:30` (the cut nearest that time on that timeline) or `cut "<episode>" keep --words "<words>"`. Say a cut on the main video does not change a Reel |
 | "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
 | "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
 | "How far is it?" | `status` |
@@ -38,8 +39,10 @@
 | "Hand it to Jason" / "I'm done with it for now" | `release "<episode>"`, with the release question below |
 | "Sort out the conflict" | `resolve "<episode>"`; show her the two sides in plain words; then `resolve "<episode>" --keep A` or `resolve "<episode>" --keep B` as she picks. If it says a conflict needs Jason, or that Dropbox is still bringing a file over, tell her so and keep nothing. If it says that is not the version shown last, or that it was sorted out meanwhile, show her what it shows now and ask her again: never reuse her last answer |
 
-In `--at-words`, give her words without `$`, backticks, backslashes or double quotes, which are not matched, and keep apostrophes: "that's $100,000" is `--at-words "that's 100,000"`.
+In `--at-words` and `--words`, give her words without `$`, backticks, backslashes or double quotes, which are not matched, and keep apostrophes: "that's $100,000" is `--at-words "that's 100,000"`.
 
+Times in the cut plan, in Claude's notes and inside a marker's words are the recording's, not her timeline's: never pass one as `--at`. To keep a cut found there, pass its words.
+
 ## The guard, before showing a timeline again
 
 When a push answers that the timeline was shown before, ask her, in these words: "Did you change v<N> in Final Cut since it was shown?"
@@ -47,7 +50,7 @@
 - If yes: run it with `--hand-edits` and read her what it says: her changes stay in v<N>; brimm-video cannot build on them yet. Until it can, ask brimm-video for its changes first and make trims by hand last, or finish that timeline by hand.
 - If the push says the changes are, or may be, on the other Mac: tell her so in plain words, and that whoever used it there can say. Run the push again with `--without-other-macs-changes` only if she says to go ahead without them. Never use `--no-hand-edits` for this: that is her answer about her own Final Cut.
 
-`text` and `graphic` ask it too, before they read a time or her words on a timeline shown before: ask her the same question, and answer in the same way.
+`text`, `graphic` and `cut` ask it too, before they read a time or her words on a timeline shown before: ask her the same question, and answer in the same way.
 
 ## The release question
 
@@ -55,7 +58,7 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A cut ("keep the Hormozi story"), a logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
+- A logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit-session.test.js tool/tests/studio-ready.test.js tool/studio/SKILL.md
git commit -m "cut: whole phrases taken out at a pause, or kept again at the join nearest a time, read on the timeline she watched"
```

Then (suggested): tell the lead the rest is ready for her laptop, by an install, `--print` first, and Jason's yes.

---

## Task A10: Her card, and the skill's last words

**Files:**
- Modify: `README.md`, `tool/studio/SKILL.md`, `tool/tests/studio-ready.test.js`

The spec: "The README gets a one-page card for her: the things to say, and the three things done by hand in Final Cut (Share, then File > Export XML… of the same project, and checking by eye)." And the second review: "Her card written from the walk through her day, every manual step in order; the project to open after each push." Written against `README.md` as docs/as-built-1b leaves it.

- [ ] **Step 1: Write the failing test**

In `tool/tests/studio-ready.test.js`, after "tells Claude the times …":

```js
  it("says what is not, and what to do meanwhile: a logo or a look on a Reel, and bringing in her hand edits", () => {
    assert.ok(skill.includes('- A logo or a look on a Reel: "That comes with the brand templates, later. For now, do it by hand in Final Cut."'), notReady);
    assert.ok(skill.includes('- Bringing in her hand edits: "That part of brimm-video isn\'t ready yet. Make your changes by hand last, after brimm-video\'s, or finish that timeline by hand in Final Cut."'), notReady);
  });
```

- [ ] **Step 2: Run it, and see it fail**

Run: `cd tool && node --test tests/studio-ready.test.js`
Expected: FAIL: "Not ready yet" still reads "A logo or a look on a Reel, bringing in her hand edits: …" in one line.

- [ ] **Step 3: Write the card and the rest**

`tool/studio/SKILL.md`:

```diff
--- a/tool/studio/SKILL.md
+++ b/tool/studio/SKILL.md
@@ -58,7 +58,8 @@
 
 ## Not ready yet: say so, and what to do by hand
 
-- A logo or a look on a Reel, bringing in her hand edits: "That part of brimm-video isn't ready yet. For now, do it by hand in Final Cut."
+- A logo or a look on a Reel: "That comes with the brand templates, later. For now, do it by hand in Final Cut."
+- Bringing in her hand edits: "That part of brimm-video isn't ready yet. Make your changes by hand last, after brimm-video's, or finish that timeline by hand in Final Cut."
 - Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)
 
 ## By hand in Final Cut, in this order (tell her at the right moment)
```

`README.md`:
- The `tool/edit.js` row of the files' table says it holds the session's commands too: `captions`, `spell`, `logo`, `text`, `graphic`, `preset` and `cut`.
- The commands' table gains those seven, each in one line, as the help says it.
- Under "What it cannot hold:", the bullet on titles and graphics is written again, in place: "A title or a graphic: the import writes none (Claude's ideas are markers). They are added in a session (`text`, `graphic`, `logo`, a Reel's captions and title) and shown on the next push, as Final Cut's built-in Basic Title and Basic Lower Third, each line naming its font and size, and pictures from `media/`."
- A section "Sallie's card", one page, in this order:

1. **Start.** Open Claude in BRIMM Video Studio. Say "what's waiting?", then "open <the episode>". The first time on this Mac: in Finder, Control-click the episode's folder, Make available offline.
2. **Ask for changes, in your own words.** "Call it …", "Use that title", "Show me the Reels", "Finish 1 and 3", "It's Hormozi, not Hormozy", "Put my name up at 0:03", "Show the chart when I say three numbers" (the picture in your Pictures folder first), "Logo on", "Captions off on Reel 2", "Make it Bright", "Cut the bit where I say …", "Keep the story at 12:30". Times are as Final Cut shows them on the timeline you are watching. To keep something that was cut, say where its "Taken out" marker sits on that timeline, or the words that were cut: never a time from the cut plan or Claude's notes, which are the recording's own.
3. **See it.** "Show it in Final Cut" (or "show Reel 2 in Final Cut"). Final Cut opens the new version. When asked whether you changed it since: say so truthfully.
4. **By hand in Final Cut, last:** fine trims, b-roll and music (drag them in from Finder), and checking every cut, caption, title and picture by eye (a title at the top of a Reel can cover your face).
5. **Finish.** For each part: Command-E (check the dialog says From Final Cut), wait for Final Cut's notice, then click in that timeline and File > Export XML…, into From Final Cut. Say "finish the episode", answer its questions, then drop the hand-off it shows onto the BRIMM Ops page. A spelling after a finish makes the hand-off again: drop it again.
6. **Hand it to Jason** when you stop part-way: "hand it to Jason", and keep the laptop open and online until Dropbox shows the folder is up to date.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit, and open the pull request**

```bash
git add README.md tool/studio/SKILL.md tool/tests/studio-ready.test.js
git commit -m "Her card, and the skill with every command of phase 4"
```

---

## Self-review

1. **Spec coverage.** Phase 4's row: `preset` with the caption builder (C2, C3, A8), `cut` (C7, A9), `text` (A7), `graphic` (C5, A7), `logo` (A6), `captions` (A4), `spell` (C4, A5), times read on a named timeline (C6, A7, A9), the skill in full (A4 to A10), the card (A10). `name`, `title` and `show` were built in phases 2 and 1b. Section 4's refusals: a change to a hand-edited timeline (A4's `layerStart`, for every command that changes one), a time inside a cut naming the nearest kept words (C6), a push or a time read without the guard's answer (A2, A7), media outside the episode folder (C5 names only; PR 19's push still lists any). "What applies where": `spell` on every timeline and the final transcripts (A3, A5); the rest on the one named (ruling 10); a main cut not reaching a Reel, said (A9). Section 3: a Reel gains captions and its title (A3, A4), and not yet its logo or look (ruling 2, 4). Section 4, "What brimm-video writes": built-in titles naming font and size (C1, C2), roles and names with the id (A3), a look as a built-in preset with its Mix (C1, C2, C9), stills from `media/` with their transform (C1, C2). Typeface checks before a push: the stand-in face is looked for on this Mac and said (A4); templates' fonts are phase 6.
2. **Placeholders.** None, but two by design: `LOOK_PRESETS` is empty until Jason's check 2, and C9 fills it from his exports; until then a look is recorded only and said (ruling 4). And C9's numbers come from what Jason sees; where a check calls for more than a number, C9 stops and the lead schedules the fallback the plan names.
3. **Type consistency.** `layersFor` gives `{ titles, stills, look, told }`, which `mainProject` and `reelProject` take as `titles`, `stills`, `look`, and `fcpxml` as the same. A piece is `{ start, end, crop? | position?, guessed? }` from `piecesOf` to `croppedLike` to `reelProject` to `fcpxml`. `momentOf` gives `{ at, for }` in seconds of the raw video, which every layer stores; `cutNear` gives `{ cut: { at, from, to } }`, `at` on the timeline and `from`, `to` in seconds of the raw video. A preset is kept in the spec's ids and shown by `nameOf`.
4. **Review Focus.** Each of the five has its test, in the task named there.

## What changed in this version

Where each finding of the two reviews is answered. Two are put off by Jason's steer (no new two-Mac machinery): the other-Mac halves of architect 5 and 6 (and the lead's refuted "spell after a finish writes final/ with no claim"); what is left of them on her laptop is answered.

| Finding | Answer |
|---|---|
| Architect 1, L1, L4, L5: a layer re-cut her video from phrase gaps | `rangesWith` keeps `plan.ranges` with no cut, and remakes only around a changed phrase (C7, ruling 3); A4's fixture has heard pauses that are not its phrase gaps, and a push after a spelling keeps v0's pieces |
| Architect 2, L17: A10's skill test could not pass | `tests/studio-ready.test.js`: "Final Cut" taken out, whole words, any case; from A4, each task adds its words (A4 to A9), and A10 checks the last two lines word for word |
| Architect 3: A7 named `cut` before it existed | A7's guard line names `text` and `graphic`; A9 adds `cut` (checked at every task by the plan's own script) |
| Architect 4, L2, L3, L13, L14, L23: `spell` after a finish | Ruling 11, A5: only what the final files do not hold; once; files and a revision only when a text changes; refused while a run other than `bring` runs; brought over first; put back file by file; drawn captions said; revision past `final/`; hand-off checked, `madeBy` set |
| Architect 5, 6 | On her laptop: a running finish refuses `spell` (and every change, `layerStart`); final files not here are brought over first (A5). The other Mac: a conflict needs Jason, as today |
| Architect 7: words started in the pause | `heardWords` (C6), shared by captions, `wordsAt` and `momentOf`; rule 4 holds into the pause (C3) |
| Architect 8, L16: A2 needed C4 | A2 after C4; C4's diff is filled in |
| Architect 9, L6, L7: `layered()` | Every Reel is layered; a main video when it draws anything, a short video from its first push (A4) |
| Architect 10: a clip Reel took changes silently | `layerStart` refuses it; a push of it says what is not shown (A4, ruling 6) |
| Architect 11: ruling 9 | The clock is spec 273's (the lead's decision); the join rule for `cut keep --at` is this plan's own (C6 `cutNear`, A9; see the re-check rows); a keep of what is kept is refused |
| Architect 12: a Reel's logo and look | The logo on the main video only; a Reel's look recorded and said (ruling 2, 4) |
| Architect 13: rule 3 | Not applied; said on every push of an upright title (ruling 1, A3) |
| Architect 14: titles over a join | Check 1 has one in each frame; ruling 8 states the cost and the fallback; C9 stops if it fails |
| Architect 15, L8: the lower third centred | No alignment written unless a line names one (C1); `titleLook` gives it per line (C2) |
| Architect 16: upright `lower` | Ruling 13; check 3 states both bands |
| Architect 17: a still's role | Check 3 exports the stills and sends them back |
| Architect 18, L32: check 2's exports | One project per look, each export named; check 2b |
| Architect 19, L12, L20, L29: pictures | Byte-for-byte compare; a link, a missing file, a non-picture, the same picture reused, a picture taken out when the save fails, all tested (A6); "Sally," and "Sally's" (C4) |
| Architect 20: A4 had no push test | `timeline.test.js` pushes a Reel through `editMain`, and the stand-in face is said after "Shown in Final Cut" |
| Architect 21, L30: a Reel rebuilt from v0 | A4 tests it, with a cut: its moves and its note of a guessed face kept (`croppedLike` carries `guessed`, C7); C1 tests a piece's move |
| Architect 22: ruling 5 | Restated with spec 172; a record stays at 2 once written at 2 (A1) |
| Architect 23: ruling 7 | Restated; Signature's captions Plain without the fade, Boxed waits for the Subtitle title's settings, titles said too (C2, A3) |
| Architect 24: preset names | The spec's ids in the record; `nameOf` for her (C2, A8) |
| Architect 25, L28: a curly apostrophe | Refused in plain words (C4) |
| Architect 26: `madeBy` | `respelledHandoff` takes `commit` (C4, A5) |
| Architect 27: HDR with Natural | HDR checked first, Natural too (C2) |
| Architect 28, 29, 30 | Comments in `styles.js`; `fcpxml.js`'s header and a title without font or size refused (C1); wide Plain at 42 characters (C2) |
| Architect 31: Lucida | Check 1 has an upright file in Lucida Grande |
| Architect 32, L31: ideas and cuts | Claude's ideas as her cuts leave them (A4), tested both ways (A9) |
| Architect 33, L15, L24, L25: `cut`'s refusals | `--to` at the very end, past it by rounding, reversed, missing; a Reel's words within its stretch; a cut that keeps nothing (C6, A9) |
| Architect 34, L26: reads refused | `layerStart`'s `writes: false` for lists, ideas and a preset's lists, tested while the other Mac has the episode (A4 to A8) |
| Architect 35: `media/..` | Refused by the record's check (A1) |
| Architect 36, L27: the guard's grammar | The section above, and a line in her skill (A7, A9) |
| Architect 37, L18: who applies the checks | C9; Builder A's tests take numbers from `styles.js` |
| Architect 38: captions before `spell` | `captions` and `layerStart` move into A4, with her row; A4 waits for C5 and C7, which land first |
| Architect 39, 40: merge order | "Merge order, and when she gets each slice" |
| Architect 41: when a slice reaches her | The same section; after A6 and after A9 |
| L9: a one-line lower third | An empty second text (C1); check 1 shows it |
| L10: sizes at 720p | Check 1 has a 720p file; C9 applies it |
| L11: a phone photo | Its EXIF orientation read, the whole file read (C5); placed upright (A4) |
| L19: every command and the claim | One test runs every command while the other Mac has it; each task adds its row (A4 to A9) |
| L21: lanes and the top band | Ruling 14 (A3); the upright corner below the band (C2, ruling 13) |
| L22: PQ | HDR read from the colour itself (A4) |
| Re-check 1: A6's tests used `graphic` | A6's picture tests use `logo` only; the plan's script checks that no task's tests use a command a later task brings |
| Re-check 2: `spell` saved before its run check | The check is in `spell`, after the claim, before anything is written; tested with a finish running and no finish recorded, for `add` and `drop` (A5) |
| Re-check 3: the put-back comment | It says what the code does: a file that cannot be put back is named, and she is told the episode needs Jason (A5) |
| Re-check 4: a merged range's words | Each range names the phrases that lie in it now (C7, tested) |
| Re-check 5: Review Focus 1's tests | C7 tests a lead-in and a laugh between two heard pauses, with no cut and a cut away from them; ruling 3 says a sound beside a phrase taken out goes with it |
| Re-check 6: her `spell` row | It says a finished video keeps the old spelling on screen until it is finished again |
| Architect's re-check 5, 19 | Closed by the lead's re-check above; also a drop while a finish runs on a finished episode (A5), `brand.logo` unset after the takeback (A6), and `graphic`'s own reuse, non-picture and takeback test (A7) |
| Architect's re-check N1 | "until each part is shown in Final Cut, Shared and finished again"; a spelling that changed nothing in a part is not held by it (A5, ruling 11) |
| Architect's re-check N2 | Each finished part holds its own `spellings`, which a finish again keeps for a part it reuses; tested through a finish that reuses the main video (A5) |
| Architect's re-check N3 | Said as "If Reel 2 shows captions on screen, …", for each finished part that may (A5) |
| Architect's re-check R9-1 | A time on what she watched that a cut took out since keeps that cut again, never the join beside it; with no such cut it is refused with the nearest kept words (A9) |
| Architect's re-check R9-2 | Only joins where words were cut count; two near ones are named, never guessed; a join kept again since is said to be kept already (C6, A9) |
| Architect's re-check R9-3 | `cutsOn` takes a timeline's edges, a Reel's stretch for a Reel (C6, A9) |
| Architect's re-check R9-4 | A line in her skill (A9, tested) and on her card (A10): the plan's, notes' and markers' times are the recording's |
| Architect's re-check R9-5 | Ruling 9 says which part is the spec's and which is this plan's |
| Architect's re-check R9-6 | Tests of two joins, the 5-second edge, a pause beside a cut with words, a Reel's start, a time cut since, and the guard (C6, A9) |
| Architect's re-check N37a | A8's test gives its own presets, both empty and filled in |
| Architect's re-check N37b | C9 names `layers.test.js`; the count of characters a title fits is taken from `styles.js` |
| Architect's re-check 18 | Check 2 selects both clips; a look is kept only once its 2b matched (ruling 4, C9) |
| Architect's re-check 17 | Check 3 reads the role up to its first dot; `3 pictures bare.fcpxml` shows what Final Cut would warn of (C8, C9) |
| Architect's re-check 10, 22, 25, 27, 29, 33, 35 | A clip Reel's push says what is not shown (A4's describe); the layout stays at 2, tested (A1); a word the show's own names spell is refused, and the examples are "Hormozy" (C4, A5); an HDR Reel is said (A3, A4); the README bullet rewritten in place (A10); `cut remove` with nothing asks for words or times (A9); `media/..` and `media/.` refused, tested (A1) |
| Architect's re-check 6, and 10's second half | Not done: 6 is the two-Mac half (Jason's steer); 10's `{ old }` for a missing reels.json gives the wrong reason in words only, and pushes stay right |
| Check 1's times | The title over the join runs to 0:13 on the timeline, as the name starts; times in check 1 are the timeline's, and the wide lower third runs 0:06 to 0:12 |

