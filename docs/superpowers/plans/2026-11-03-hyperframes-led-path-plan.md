# BRIMM Video Studio: the HyperFrames-led path, the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio suggests short graphics for every video it reads, places them on her words in the HyperFrames project, and builds only those she takes. It turns her script into a video guide, a shot list and a teleprompter script before she films. It plans explainers made only of graphics. It uses a reference folder of post styles she names.

**Architecture:** One format, the graphic cue, serves all three routes. A cue is placed by its words in the transcript's word times, never by a time written in advance. It goes into the project as `brimm/graphic-cues.json`, beside `brimm/cut-suggestions.json`. A planned episode is an episode record with no video yet. Footage that is dropped later, and her voiceover, become that episode. The hand-off and the BRIMM Ops page do not change.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages), zsh for the installer.

**Spec:** the design approved by Jason on 2026-11-03: jogden12/brimm-operations, `docs/superpowers/specs/2026-11-03-hyperframes-led-path-design.md` at 2598941 (PR 38, branch `docs/hyperframes-path-design`). Read it with `gh api "repos/jogden12/brimm-operations/contents/docs/superpowers/specs/2026-11-03-hyperframes-led-path-design.md?ref=2598941" -H "Accept: application/vnd.github.raw"`. Each builder gets a copy in the plan's workspace. Read it with Studio's two specs of 2026-10-27 and `tool/brand/brand.md`. Section numbers below ("design 5") are the design's.

**Not here:**
- Sallie's guide (`docs/guide/brimm-ops-guide.html` in brimm-operations). The BRIMM Ops session brings it up to date once this branch is merged.
- Her laptop's move to Studio (checks 41 to 48 on the Studio By-Hand Checks page). Nothing here touches it, and `main` does not change until the merge.
- Session clips (plan PRs 12 to 14 of 2026-10-27). Nothing of a client or group session recording goes to HyperFrames.
- HeyGen avatars and Video 1 clips, which still need Jason's yes. A generated Sallie, face or voice is never allowed.

---

## The order

| PR | What | Needs | Waits for A1? | By hand |
|---|---|---|---|---|
| H1 | Graphic cues on a raw episode: the cue and its placement, the reading's ask, the cut plan, the edit notes, Final Cut's markers, `graphic … ideas`, and `brimm/graphic-cues.json` with its rule in the main project | None | No | In H7 |
| H2 | Cues for an iPhone clip and for Reels. A raw episode's Reel takes its share of the episode's cues. A finished video's Reel is read when the Reel is made | H1 | No | In H7 |
| H3 | The reference folder: `refs`, `refs look`, `refs use`, and named pictures copied into a project | H1 | No | In H7 |
| H4 | The planned episode and its package: `plan new`, `plan … set` and `plan …`; its three files; "What's waiting?" and the guide; the script route in her skill | H1, H3 | No | In H7 |
| A1 | What the real app does with a cue file, several videos, b-roll, sound with no picture, and a HeyGen voice (design 9) | Jason's yes | None | The probe itself |
| H5 | Footage for a planned episode: the card, the parts, a client's consent, the join, and b-roll and screen recordings as picture-only material in one project | H4, A1 | Yes | In H7 |
| H6 | The explainer: a project from her voiceover, or from an exported HeyGen voice, and the guide; the HeyGen line for explainers; the YouTube reminder at the hand-off | H4, H5, A1 | Yes | In H7 |
| H7 | The branch's by-hand checks, then the merge into `main` on Jason's yes | H1 to H6 | None | The whole group |

A1 needs no code, so it can run while H1 is built. H2, H3 and H4 follow each other, because each changes `project.js` and `edit.js`. H5 and H6 are only outlined here. Their tasks are written once A1 is answered, because the app's answers decide them (design 6 and 9).

---

## Global Constraints

- **Built on the branch `claude/studio-hyperframes-path`,** cut from `main` at 7e3dfb7. `main` stays as it is, and nothing reaches a Mac, until Jason says to merge (design 9). Her laptop's checks 41 to 48 are not touched.
- **The tool drafts.** It never posts, sends or publishes anything, and nothing here adds that.
- Never read a `.env` file. Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat. The installer runs only with `--print`, by a test or by hand.
- **Write a failing test first, then the code.** `cd tool && node --test` passes whole before each commit.
- **No test calls the HyperFrames app, HeyGen, the real command line or the real `claude`.** Stand-ins answer, as today (`CLAUDE`, `FFMPEG`, `FFPROBE`, `WHISPER`, `tests/stand-ins/hyperframes.mjs`).
- **The hand-off and its contract do not change:** `handoff.js`, `handoff-v2.js`, the fixtures, `tool/shared/`, `lib.js` and `run.js`, with `madeBy` still `brimm-video <commit>`. `tests/contract.test.js` keeps the fixtures' hashes. A video from any route is handed off as one of today's kinds (design 10.5).
- **`tool/guide.js` and `tool/guide-note.js` are in the BRIMM Ops contract too.** The new stages (H4's `film`, H5's and H6's) all come before the page's steps (`opsStep`, guide.js:291), and none of those steps changes. When a PR that adds a stage lands on the branch, the BRIMM Ops session is told the stage and its words, in step. Sallie's guide follows after the merge.
- **Graphics show things and words, never people.** No made-up people, and never a made-up Sallie. Everything follows `tool/brand/brand.md`.
- **A cue is built only when she takes it,** in the app, like a suggested cut. Studio never adds one to her video.
- **Sessions stay out.** A client or group session gets no cues, and nothing of a session recording reaches a project.
- **Studio's HyperFrames rules stay:** exports are made on This Mac, links are never set to "Anyone with the link", the agent stays on Auto access, and the denied commands stay denied (`tool/hyperframes.js:135-155`, `tts` among them). The HeyGen voice is for explainers only, and is never a voice made from Sallie's (design 9, 10.6).
- **Her chat stays Studio.** Each new command lives in its own module, and `edit.js` only wires it. In the same commit it gets:
  - an `ASKED` entry (`edit-gate.test.js`);
  - `TODAY_ASKED` and `walkWords` entries (`edit-labels.test.js`);
  - a README row (`part-f-fixes.test.js`);
  - a decision about its gate list (`gate.test.js`).
  The guard and her folder's settings are not widened.
- **Files into Dropbox go by the rule:** made outside, cloned in under a new name, never written over a file, and the record written last with `expectRev`. Studio never writes into the reference folder.
- **Projects live in `~/BRIMM Video Work`.**
- **In code a cue is a "graphic cue"** (`graphicCues`, `graphic-cues.js`), because `cuts.js` already uses `kind: "cue"` for a spoken start-over.
- **Words, skill and README together:**
  - A change to `HELP` regenerates `tests/fixtures/today-says.json`: `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command's lines as it did before labels" tests/edit-labels.test.js`, then read `git diff`.
  - A change to the skill updates every test that pins its sentences, in the same commit.
  - What she is told holds no path, flag or command name.
- **Commits** end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The same words said twice:** a cue lands where its phrase, or its place in the order, says, not on the first time the words are said (H1).
2. **A cue whose words are in a retake** that a suggested cut takes out lands on the take she keeps, when the take she keeps has its words (H1).
3. **A Reel's cues:** they are on the Reel's clock, with the Reel's word ids. A cue whose words start before the stretch, or run past its end, is left out (H2).
4. **A planned episode, which has no video, in `Episodes/`** breaks no other command, listing or run: `episodes`, the guide, the import's version match and its drop-file match, `release`, snapshots and `free` (H4).
5. **A package line holding a quote, a dollar sign, a percent sign, a backslash, a backtick, a pipe or an apostrophe** arrives exactly as she wrote it, and a field broken by an unescaped `|` is refused in words (H4).
6. **An episode read before this branch,** which has graphic ideas and no cues, keeps its ideas and its markers, and its project gets them as cues (H1).

## How each pull request is built

- **The branch:** this plan is the first commit on `claude/studio-hyperframes-path`, and a draft pull request into `main` is opened with it. Each of H1 to H6 lands on the branch as a group of commits once its review is clean and the whole suite passes. Only the merge into `main` waits for Jason's yes, after H7, as a merge commit.
- **The builder:** one Sonnet builder per PR, test first, in its own worktree cut from the branch's tip. It never works in the main checkout or in `~/Claude Code/brimm-video-studio`, the checkout the Mac Studio's import runs from.
- **The review:** a fresh read-only reviewer for each PR. A Critical or Important finding gets one fix pass, test first, by the builder; a Minor goes into the ledger.
- **The coordinator:** reads every risky diff, runs the whole suite, pushes the branch and keeps the ledger at `.superpowers/sdd/2026-11-03-hyperframes-led-path-plan/progress.md`.

---

## The graphic cue (H1 makes it; H2 to H6 use it)

A cue, as the reading writes it into the cut plan and as a package holds it:

```json
{ "n": 1, "words": "too many SKUs", "kind": "graphic", "show": "A stack of product boxes that keeps growing until it topples.", "seconds": 4, "style": null }
```

| Field | Rule |
|---|---|
| `n` | A whole number from 1, in the order its words are said. Renumbered from 1 in the order given |
| `words` | The words it goes with: 1 to 30 words and at most 200 characters, after trimming |
| `kind` | `"graphic"`, `"words"`, `"b-roll"` or `"screen"` (`GRAPHIC_CUE_KINDS`). On a video already shot, and in an explainer, only `"graphic"` and `"words"` (`SHOT_KINDS`, design 10.11) |
| `show` | What it shows: 1 to 300 characters |
| `seconds` | A number from 1 to 10. Anything else becomes 4 (`CUE_SECONDS`) |
| `style` | `null`, or exactly one of `{"ref": "<file in the reference folder>"}`, `{"inspiration": "<name>"}` and `{"link": "https://…"}`. A link must be `https:` |
| `phrase` | From the reading only (H1): the plan phrase id it was written for, used to place it |
| `shot` | From a package only (H4): for a `"b-roll"` or `"screen"` cue, the number of the shot whose footage it shows |
| `material` | In a project's file only (H5): the media file of the footage its `shot` names, such as `"media/b-roll-2.mp4"` |

In a project's `brimm/graphic-cues.json`, each cue also has `"at"`: `{"from": "w12", "to": "w15", "start": 61.2, "end": 62.9}`, the ids and times of its first and last words on the project's clock, or `null` when its words are not found (design 3). The file is `{"version": 1, "clock": "recording" | "reel", "cues": [...]}` and a newline, as `cut-suggestions.json` is.

**How a cue is placed** (`placeGraphicCues`). The tests check this rule; it does not follow from them alone:

1. **Words become tokens.** First, the cue's words go through the same spellings as the words they are matched against (`spell`): a project's `transcript.json` spells "brim" as BRIMM, and the episode's own spellings are applied too (project.js:248). Each token is then lower case, with accents and every mark but an apostrophe inside a word taken off. Curly apostrophes are straight, and the tokens are split on spaces (`cueTokens`).
2. **Cues are placed in order of `n`.** Each search starts after the first word of the cue placed before it (`from`).
3. **A candidate is a run of transcript tokens.** An exact candidate is the cue's tokens, in order and side by side. A loose candidate starts on one of the cue's first two tokens, is the cue's length plus two, and holds at least `max(2, ceil(2k ÷ 3))` of the cue's `k` tokens in order: two of three, three of four, seven of ten. When `k` is 1 or 2, every one of them is needed. Its span runs from the first of those tokens to the last.
4. **Which candidates count, in this order:**
   - those inside the cue's `phrase`, where it has one;
   - then those whose span is wholly in kept words (outside every suggested cut);
   - then any.
   Within the first group that has a candidate, an exact candidate wins over a loose one, a higher count wins, and then the first at or after `from` wins, and failing that, the first.
5. **No candidate means `at` is `null`.** She places that cue in the app, or leaves it out.

---

## PR H1. Graphic cues on a raw episode

**Files.** Create `tool/graphic-cues.js` and `tool/tests/graphic-cues.test.js`. Modify:
- `tool/notes.js`:
  - `ASK.graphics` (:50) becomes `ASK.graphicCues`;
  - `ASKED` (:93) counts a reply holding only cues as one that answered;
  - `readNotes` (:154) reads `graphicCues`;
  - `notesText` (:419) lists cues under its heading `Its ideas for graphics`;
  - `TASK` (:55).
- `tool/readings.js`: `RAW_TASK` (:54), and `readRaw` (:191) reads cues.
- `tool/reading.js` (:458-474): the cut plan's `claude.graphicCues` in place of `claude.graphics`, the edit notes, and `edit/main.v0.fcpxml`'s markers.
- `tool/unedited.js`:
  - `ideaNotes` (:626) gives way to `cueMarkers`;
  - `nothingIn` (:319) counts cues, so a reply with no decisions and no notes no longer throws on `read.graphics`;
  - the markers and notes at :1038 and :1089;
  - `planJson` (:915);
  - `askClaude` and `askAgain` (:357, :1744).
- `tool/edit.js`: `notesForHer` (:2969) still finds the heading `Its ideas for graphics`. Its line "An idea for a graphic sits on words that are cut" is said for a cue placed only inside a cut.
- `tool/timeline.js` (:197): markers from cues.
- `tool/edit.js`: `graphicIdeas` (:4820) and the words of `graphic "<ep>" ideas` (:4855).
- `tool/project.js`:
  - `projectFiles` (:527) writes `brimm/graphic-cues.json` for every main project;
  - `brimmRules` (:406) has the new rule, after "Cutting";
  - `ABOUT` (:431) has an entry for the file.
- `tool/app.js`: `makeProject` (:446) gives `projectFiles` the cut plan's cues.
- The tests that pin any of these:
  - `notes.test.js`;
  - `readings.test.js`: the sha256 of `notesRequest` and `Object.keys(ASK)`;
  - `reading.test.js`, `unedited.test.js`, `fcpxml.test.js`, `projects.test.js`, `edit-graphic-ideas.test.js` and `edit-session.test.js`;
  - `project.test.js`: the main project's file list (:606) and the rule labels (:469-479);
  - the file lists in `free.test.js:115` and `edit-free.test.js:221`.

**Interfaces.** Produces:
- `GRAPHIC_CUE_KINDS`, `SHOT_KINDS` and `CUE_SECONDS = 4`.
- `graphicCuesOf(entries, { kinds = SHOT_KINDS, most = Infinity } = {}) -> { cues, problems }`. It keeps `phrase` and `shot` when they are given as text and as whole numbers from 1.
- `cueTokens(text) -> string[]`.
- `phraseSpans(phrases) -> Map<id, [first, last]>`. It counts `phrase.words` in order, as `cutSuggestions` (`project.js:257`) does.
- `keptIndexes(phrases) -> Set<number>`: the indexes of the words in phrases whose `keep` is not `false`. It is counted the same way.
- `placeGraphicCues(cues, words, { spans = null, kept = null, spell = (text) => text } = {}) -> placed[]`.
  - `words` are `[{text, start, end, id?}]`, and a word with no `id` is given `w<index>`.
  - `kept` is a `Set` of word indexes.
  - `spell` is the speller its words were spelled with: `projectFiles` passes the one `transcriptJson` uses.
- `graphicCuesJson(placed, clock) -> string`.
- `legacyCues(graphics, phrases) -> cues`. Each `{id, idea}` becomes `{words: <that phrase's text, cut to its first 30 words and 200 characters>, kind: "graphic", show: idea, seconds: 4, phrase: id}`.
- `cueMarkers(plan, words) -> [{at, text}]`, with `text` `"Graphic idea: <show>"` as today's markers have, from the cut plan's cues or else from `legacyCues`. A marker is made only for a cue placed wholly in kept words: today's markers keep only kept phrases (unedited.js:628), and a cue in a cut would land on a join (fcpxml.js:192-199).
- The cut plan holds `claude.graphicCues`. `claude.graphics` is no longer written, and is still read where an older plan has it.

**The ask** (`ASK.graphicCues`, the exact line; `most` is twelve for a raw episode and three in H2):

`- "graphicCues": at most twelve {"id", "words", "kind", "show", "seconds"}, in the order they are said. Each makes one of her points visible with a short animated graphic or words on screen. "id" is the kept phrase it goes with; "words" are the words it goes with, copied exactly from that phrase; "kind" is "graphic" or "words"; "show" says what it shows, in one or two plain sentences, with things and words and never people; "seconds" is how long it stays, from 2 to 8 and usually 3 or 4.`

`graphicCuesAsk(most)` writes the line, and the number is spelled out ("twelve", "three"). Twelve is enforced: `most: 12`. An entry with an `id` that is not a kept phrase is dropped, as today's ideas are.

**The project's rule** (`brimmRules`, the exact line; a Reel's version is H2's):

`- **Graphic cues.** Studio's suggested graphics are in `brimm/graphic-cues.json`, each tied to the words it goes with: word ids and times on the recording's clock, so add the recording's `data-start` if it has moved. After the cuts, offer them to her, one at a time or all together, and build only the ones she takes: each short (its `seconds`), in the brand, with things and words and never people. A cue with no `at` was not found in her words: tell her, and place it only where she says. Never add a graphic she has not taken.`

Tests, by group:

| Group | Tests |
|---|---|
| The cue | `graphicCuesOf` keeps a whole cue and numbers from 1 in the order given. It drops each entry with no words, no show, a kind outside `kinds` or a `style` with two keys, adding a problem for each: `Graphic cue 3 could not be read.` A `seconds` of 0, 11 or "four" becomes 4. It stops at `most`. An `http:` link is refused, and `phrase` and `shot` are kept |
| Tokens | Case, commas, full stops, quotes, curly apostrophes ("don’t" is `don't`), accents ("café" is `cafe`) and several spaces |
| Placing | An exact run is placed with the `w` ids and times of its first and last words. A loose run is placed when "too many products" was said for "too many SKUs" (two of three tokens: placed) and is `null` when one of three is. "The brim method", from an unspelled phrase, is placed on a transcript that says "The BRIMM method", and so is a script's "BRIMM" on the same words. When the words are said twice, the second cue's search starts after the first cue, and a cue with a `phrase` lands in that phrase. A run inside a suggested cut loses to the same words in a kept take, and is placed in the cut when nothing else is found. A cue that is not found is `null`, and the cues after it are still placed |
| The file | `graphicCuesJson` is the shape above, with `"clock": "recording"` |
| The ask | `ASK.graphicCues` is the line above, `Object.keys(ASK)` and the request's sha256 are pinned again, and `RAW_TASK` and `TASK` ask for `graphicCues` and not `graphics` |
| The reply | `readNotes` reads `graphicCues` from a clean reply, a fenced one and one cut off (`salvageReply`). A bad entry gives its problem, and thirteen cues give twelve. A reply holding only cues, with no decisions and no notes, is read: `ASKED` counts it, and `nothingIn` neither throws nor says the work stopped |
| The reading | A raw reading writes `claude.graphicCues` (each with its `phrase`) and no `claude.graphics`. The edit notes list `0:13  "too many SKUs"  |  A stack of …` under `Its ideas for graphics`. `edit/main.v0.fcpxml` has a marker `Graphic idea: <show>` at the start of each cue placed in kept words, and none for a cue that was not placed or was placed only in a cut. `notesForHer` swaps the block for her as today |
| The full import | Its markers come from cues, and `askAgain` throws its cues away as it threw away its ideas |
| `graphic … ideas` | `Claude's ideas for graphics on the main video: 3, with times on main v0.`, then `Idea 2, 0:04 to 0:07: <show>. Over "<words>"`, and for a cue that was not placed `Idea 4: <show>. Its words, "<words>", were not found in the video.` An episode with only `claude.graphics` reads as it does today, and a finished video and an iPhone clip still say `noIdeas` |
| The project | A raw episode's main project has `brimm/graphic-cues.json` with its cues placed on `transcript.json`'s own words (the ids agree). An older plan's ideas come in as cues. A short video's main project has `"cues": []` until H2, and a session clip's project never has the file. The rule is the line above, the rule labels are pinned in their new order, and `ABOUT` describes the file. Each file list that pins a main project's files has it |

- [ ] Steps, in order:
  1. Write the failing tests group by group and run them: `cd tool && node --test tests/graphic-cues.test.js`. Expected: they fail because `graphic-cues.js` is missing.
  2. Write `graphic-cues.js` and run the same tests until they pass.
  3. Write the ask's, the reply's, the reading's and the import's tests. Run them, see them fail, then change `notes.js`, `readings.js`, `reading.js`, `unedited.js` and `timeline.js`.
  4. Write the `graphic … ideas` tests, then change `edit.js`.
  5. Write the project's tests, then change `project.js` and `app.js`.
  6. Run the whole suite: `cd tool && node --test`. Expected: every test passes.
- [ ] **Commit:** "Studio HF path H1: graphic cues on a raw episode, placed on her words in its HyperFrames project".

---

## PR H2. Cues for an iPhone clip and for Reels

**Files.** Modify:
- `tool/readings.js`:
  - the short video's ask, `ASKS["short video"].task` (:69), adds `graphicCuesAsk(3)` beside its spellings and its about;
  - `readShort` (:163), its reply's reader, reads the cues;
  - `reelCuesRequest(lines, about)` and `readReelCues(reply)` are new.
- `tool/reading.js`: a short video's reading writes the cut plan's `claude.graphicCues`, by the rule, with the record's `files` updated in the same write.
- `tool/unedited.js`: `askOnce` takes a `limit`. `CLAUDE_MS` (:331) stays its ten-minute default.
- `tool/workcopy.js`:
  - `reelCopyPaths` gains `reel-<n>-<key>.cues.json`;
  - the cleanup of a Reel's older copies (:758, `(?:\.faces)?`) takes the `.cues.json` with them;
  - `makeWorkCopy` with `reel` takes a `cues` step after `faces`, for a finished video only.
- `tool/edit.js`: `workcopy --reel` gives the step its reader.
- `tool/app-reel.js`: `makeReel` (:176) gives `projectFiles` the Reel's cues.
- `tool/project.js`:
  - a Reel's project writes `brimm/graphic-cues.json` with `"clock": "reel"`;
  - a Reel's rule.
- Tests:
  - `readings.test.js`, `reading.test.js`, `workcopy.test.js`, `edit-workcopy-reel.test.js`, `app-reel.test.js` (and its file list at :117), `edit-app-reel.test.js` and `project.test.js`;
  - `snapshot.test.js:81`, a Reel's "no cut or Reel suggestions" check, which now finds the cue file.

**Interfaces.** Consumes H1's `graphicCuesOf`, `placeGraphicCues` and `graphicCuesJson`. Produces:
- `reelGraphicCues(placedOnRecording, stretch, reelWords) -> placed[]`, in `graphic-cues.js`. It keeps the cues whose `at.start` and `at.end` are both inside `[stretch.start, stretch.end]`, at most the first three (ruling 2). It then places them again on the Reel's own words, so that the ids are the Reel's (`w0` on).
- `reelCuesRequest(lines, about) -> string`, from the stretch's phrases as `p7 | 0:13 | <text>` lines, and `readReelCues(reply) -> { cues, problems }`, at most three.

What it does:
- **An iPhone clip:** its reading asks for at most three cues. They go into its cut plan, and from there into its main project as in H1 (design 10.9).
- **A raw episode's Reel:** its project takes the episode's cues placed on the recording's clock, then `reelGraphicCues` on the Reel's stretch and words. No new reading is made.
- **A finished video's Reel:** the detached run of `workcopy --now <folder> --reel <n>` has a third step, `"Suggesting graphics"`, after `"Finding the faces"` (design 4, Jason's "Yes, at the Reel").
  - The step runs only for a finished video, and only when this Mac's readings are on.
  - It asks Claude, through the reading's own request path, model and account rules, for at most three cues over the stretch's phrases.
  - It writes the answer to `working copy/reel-<n>-<key>.cues.json`, in the run's folder and then renamed.
  - A read that fails, is refused or takes more than three minutes (`askOnce`'s `limit`) leaves no file. It says why in the log, and the Reel is still made.
  - The read runs under the work-copy lock, so another Reel's video waits for it. Once a Reel's video is made, a read that failed is not asked again, and the project is made without cues.
  - `makeReel` places the file's cues on the Reel's words.
  - A raw episode's Reel keeps its two steps.
- **A Reel's rule:** the H1 line, with `on the recording's clock, so add the recording's `data-start` if it has moved` replaced by `on the Reel's clock`, and with ` On this upright Reel, keep graphics and words out of the top 14% and the bottom 35%.` added at the end.

Tests, by group:

| Group | Tests |
|---|---|
| An iPhone clip | `readShort`'s request asks for at most three cues, and three are kept from four. The reading writes them into the cut plan by the rule, in one record write with `expectRev`, and the clip's main project has them |
| A raw episode's Reel | A Reel from 312.4 to 340 s takes a cue at 320 s on its own clock (7.6 s) with the Reel's ids. It leaves out a cue starting at 311 s, and one running past 340 s. Of five cues inside the stretch it takes the first three. Its project's file list (`app-reel.test.js:117`) has the file, and its rule is the Reel line |
| A finished video's Reel | The steps are `["Making the video for HyperFrames", "Finding the faces", "Suggesting graphics"]` for a finished video and the two of today for a raw one. The request holds only the stretch's phrases. The answer is saved beside the faces. A failed, refused or stopped read leaves no file and the Reel is still made. With readings off nothing is asked. `makeReel` writes the saved cues placed on the Reel's words |
| Sessions | A session clip's project never has the file, and no session is ever read for cues |

- [ ] Steps: the failing tests group by group, run, see them fail, then the code; then the whole suite.
- [ ] **Commit:** "Studio HF path H2: graphic cues for iPhone clips and Reels".

---

## PR H3. The reference folder

**Files.** Create `tool/references.js`, `tool/tests/references.test.js` and `tool/tests/edit-refs.test.js`. Modify:
- `tool/settings.js`: `referencesFolder(root) = join(root, "References")` beside `dropFolder` (:43), and printed by `show` (:650).
- `tool/install.sh`: `"$root/References"` joins the folders it makes (:897). The installer runs only on Jason's yes. Update `install.test.js`.
- `tool/edit.js`: `refs` wired.
- `tool/project.js`: named pictures as `brimm/references/<file>` (`{copy}` entries), `ABOUT`, and a line in the cue rule.
- `tool/studio/SKILL.md` and `SKILL-open.md`, the README, and the lists and pins of the Global Constraints.
- `studio.test.js`: the skills' line caps (:250 for `SKILL.md`, :1051 for `SKILL-open.md`) each go up by ten. `SKILL.md` has no line to spare today (159 against `< 160`), and H3 and H4 together add five rows.

**Interfaces.** Produces:
- `REFERENCE_KINDS = [".png", ".jpg", ".jpeg", ".heic", ".webp", ".gif", ".tif", ".tiff"]`.
  - Claude reads only PNG, JPEG, GIF and WebP pictures, so a `.heic`, `.tif` or `.tiff` picture is copied as `<stem>.jpg`, made with macOS's `/usr/bin/sips -s format jpeg`. That holds for `Looking/` and for a project; `SIPS` is its stand-in in tests.
  - A conversion that fails says `It can't be used: Studio couldn't turn <name> into a picture it can read.`
- `listReferences(folder) -> { pictures: string[], others: string[] } | null`, with `null` when there is no folder. Dot files are left out, and the names are sorted.
- `findReference(folder, said) -> { file } | { none: true, pictures } | { several: string[] }`. It looks first for a name whose stem is `said` (ignoring case), then for the only stem that holds `said`.
- `projectFiles` takes `references: [{ name, path }]`.

The commands (design 7):
- **`refs`:** `The reference folder has 3 pictures: blue carousel.png, quote card.jpg and title style.heic.`
  - Files that are not pictures: `It also holds 1 file that isn't a picture, which Studio doesn't use: launch.mov.`
  - An empty folder: `The reference folder is empty. Add screenshots or pictures to References, in the BRIMM Video folder in Dropbox.`
  - No folder: `There's no reference folder on this Mac yet: ask Jason.`
- **`refs look "<name>"`:** copies the picture into `Looking/` in her BRIMM Video Studio folder (made when first needed, the same name replaced), and prints `Picture to look at: <path>` for Claude. A Read inside her folder passes today, so the guard is not changed. Her skill tells Claude to look at the picture and never repeat the path to her.
- **`refs use "<episode>" "<name>" [reel <n>]`:** copies the picture into that episode's HyperFrames project on this Mac, the main project or Reel n, as `brimm/references/<file>`. It says `The blue carousel is in the HyperFrames project for <name>. In HyperFrames, say "Use brimm/references/blue carousel.png as the style for the graphics".`
- **Refusals:**
  - with no project on this Mac: `Open it in HyperFrames first: say "open <name> in HyperFrames".`;
  - with the project on another Mac, in `app`'s words;
  - for a name not found: `There's no "blue carusel" in the reference folder. It has: …`;
  - for several matches: `Which one? blue carousel.png or blue carousel 2.png`;
  - for a file that isn't a picture;
  - for a file that is still online only, brought first, as `bring` does: `It's still coming down from Dropbox. Say it again in a minute.`
- **The gate:** `refs` and `refs look` name no episode. `refs use` goes through `findEpisode`'s gate in the gate's own words (gate.js:28), and refuses a session as `app` does.
- **In a project:** the cue rule gets ` Files in `brimm/references/` are style references she chose: follow their look, and never copy what is in them.` A cue whose `style` is `{"ref"}` has that picture copied in when the project is made, if it is in the folder, and if it is not, the cue keeps its style and Studio says so.

Tests, by group:

| Group | Tests |
|---|---|
| The folder | `referencesFolder` and `show`. The installer's printed plan makes `References`. The folder's names and bytes are the same after every command (Studio never writes there) |
| `refs` | Pictures, others, empty, none, dot files, and sorting |
| Finding | An exact stem in any case, a part of a stem, several, none, and a stem that is not a picture |
| `refs look` | The copy, `Looking/` made, the same name replaced, and the one line for Claude. A `.heic` picture is copied as `.jpg` by the `SIPS` stand-in, and a conversion that fails is said in words |
| `refs use` | Main and Reel n. The refusals above. The project's file is new, and no other file is touched, with the app open or not. The gate's own words for an unanswered video and a session |
| The project | The `{copy}` entries for the cues' named pictures, a named picture not in the folder, `ABOUT`, and the rule line |
| The lists and the skill | The rows "What's in the reference folder?" (`refs`) and "Use <name> from the reference folder as a style reference" (`refs look` while a guide is being written, and `refs use` for a project open in HyperFrames), in both skills. `ASKED`, `TODAY_ASKED`, `walkWords`, the README row, and `today-says.json` written again |

- [ ] Steps: failing tests, run, see them fail, code; the skill and the README with their pins; then the whole suite.
- [ ] **Commit:** "Studio HF path H3: the reference folder".

---

## PR H4. The planned episode and its package

**Files.** Create `tool/plan.js`, `tool/tests/plan.test.js`, `tool/tests/edit-plan.test.js` and `tool/studio/script.md`. Modify:
- `tool/episode.js`:
  - `newPlannedEpisode`;
  - `faultFor` (:284) allows `video: null` and `kind: null` only with `answer.state "planned"` and a whole `planned`;
  - `isAnswer` (:107) takes the planned answer, which has no `guess`, `seen` or `came`;
  - `shownName` (:185) names a planned record by its title;
  - a planned record is written at layout 5 (`PLANNED_VERSION`). Every other record stays at `RECORD_VERSION` 4 (:33), so a Mac on older code reads the planned one as newer, not as an unfinished import. `layout.test.js` is updated to match.
- `tool/gate.js`: `gated` (:59) lets a planned record through, by the rule under "Not gated" below.
- `tool/edit.js`: `findEpisode`'s match by words (:680), and `hideNames` and `secretsOf` (:538-569), follow the same rule.
- `tool/edit.js`:
  - `plan` wired;
  - `episodeLines` (:862);
  - `guideFacts` (:6758-6791);
  - `guideItems` (:6903).
- `tool/guide.js`: a branch in `videoNext` (:373) before the reading's (:393), and the `VideoFacts` comment.
- `tool/gate.js`: the planned refusal.
- `tool/versions.js` (:121) and `tool/filing.js` (:249): a planned record is never a match.
- `tool/snapshot.js` and `tool/free.js`: a planned record is skipped.
- `tool/studio.js`:
  - writes `script.md` beside the skill;
  - makes `Scripts/` in her folder.
- `tool/studio/SKILL.md` and `SKILL-open.md`.
- The README.
- The lists and pins of the Global Constraints. The skills' caps were raised in H3.

**Interfaces.** Consumes H1's `graphicCuesOf` (with `kinds = GRAPHIC_CUE_KINDS`, or `SHOT_KINDS` for an explainer) and H3's `findReference`. Produces:
- `SHOT_LIST_KINDS = ["talking", "screen", "b-roll"]`.
- `textArg(word) -> string`. It turns `%22 %24 %25 %5C %60 %7C` (in either case) into `" $ % \ ` |` and nothing else.
- `packageOf({ cues, shots, lines }, { explainer }) -> { plan, problems }`.
- `newPlannedEpisode({ id, machine, at, title, route, voice, writer }) -> record`.
- The record's `planned`:

  ```json
  { "route": "script" | "explainer", "title", "voice": null | "sallie" | "heygen",
    "at", "on", "set": null | "<ISO>", "cues": [...], "shots": [{"n", "kind", "what"}],
    "lines": [...], "filmed": null }
  ```

  It is held with `answer: {"state": "planned", "by": "plan new", "on": <Mac>, "at": <ISO>, "private": "no"}`, `kind: null`, `video: null`, `version: 5`, and `name: {text: title, placeholder: false}`. `filmed` is H5's: the moment the footage made it a video.

**Not gated.** A video with no kind is gated today: its name is hidden and it is named "a video not yet answered", because it might be a client's session. A planned record is different. It was made in her chat from words she gave, and never from a file, so it cannot be a session. A record is therefore treated as answered and not a session only when all of these hold:
- `answer.state` is `"planned"`;
- `planned` is whole;
- `video` is `null`;
- it was written at layout 5.

Then `gated`, `shownName`, `hideNames`, `secretsOf` and `findEpisode`'s match by words show and match its title. A record that only claims to be planned, failing any of the four, is gated exactly as today. This is safety code: its tests come first, and the reviewer reads it line by line.

The commands (design 5 and 6; the words are fixed here for the tests):
- **`plan new "<title>" [--explainer [--voice sallie|heygen]]`:**
  - `textArg` is applied to the title, so a title can hold `$` or `"`. At most 80 characters.
  - It files the planned episode in `Episodes/<day> <title> (<Mac>)` by `fileEpisode`'s folder rule, with only `record/0001.json`. It says `"Too many SKUs" is planned. Next: its guide, its shot list and its teleprompter script.`
  - A planned title not yet filmed is refused: `There's a planned video called "Too many SKUs" already. Say "show me the plan for Too many SKUs".`
  - `--voice` without `--explainer` is refused: `A voice is only for an explainer.`
- **`plan "<planned>" set [--cue "<kind> | <seconds> | <words> | <what to show>[ | <key>: <value>]…"]… [--shot "<kind> | <what>"]… [--line "<paragraph>"]…`:**
  - It replaces the whole package in one record write.
  - The keys are `shot`, `ref`, `inspiration` and `link`.
  - `textArg` is applied to each field and each line.
  - A script route's cue may be any of the four kinds, and a `"b-roll"` or `"screen"` cue must name a shot of its own kind that is in the list. An explainer's cues are `"graphic"` or `"words"`, and it has no shots.
  - A `ref:` must be in the reference folder (`findReference`).
  - The limits are 60 cues, 40 shots and 400 lines, with at most 2,000 characters in a line.
  - Every problem is said on its own line, `Cue 3 can't be used: <why>.` or `Shot 2 can't be used: <why>.`, then `Nothing was saved.`, and it ends with 1.
  - On success it writes, by the rule with `replace`, `video guide.md`, `shot list.md` (none for an explainer) and `teleprompter.txt` into the planned folder. The record's `files` holds their bytes.
  - It says `The plan for "Too many SKUs" is saved: 7 graphic cues, 5 shots and a teleprompter script of 1,240 words, about 8 minutes. Its files are in its folder in Episodes.` The minutes are words ÷ 150, rounded, and at least 1.
- **`plan "<planned>"`** shows the package in plain words:
  - each cue as `Cue 1, a graphic for 4 seconds, on "too many SKUs": A stack of product boxes …`, with its style or shot when it has one;
  - each shot as `Shot 2, b-roll: Sallie at her desk sorting invoices.`;
  - the teleprompter's length.
- **`plan "<planned>" drop`** archives it as an episode is archived (`archived`), so the guide and `episodes` no longer show it. `leave` on a planned record writes nothing, ends with 1 and says `To drop a plan, say "drop the plan for <title>".` (`leave`'s state "not for brimm-video" with `video: null` would fail `faultFor`).
- **The files:**
  - `video guide.md` is `# <title>: the video guide`, then one numbered line per cue in the show's words, with its style.
  - `shot list.md` is `# <title>: the shot list`, then one numbered line per shot, and `For cue 4.` after a shot a cue uses.
  - `teleprompter.txt` is the lines joined by a blank line, with a newline at the end, and nothing else (design 5, step 2).
- **What's waiting and the guide:**
  - `episodes` lists a planned episode as `"Too many SKUs": planned on 4 November, waiting for its footage (5 shots), id …`.
  - The guide's next step for it is the stage `film`, which comes before the BRIMM Ops page's steps and changes none of them: `Film it to its shot list, then drop the files in your drop folder. The teleprompter script is in its folder in Episodes.` For an explainer with `voice: "sallie"` it is `Record the voiceover from the teleprompter script, then drop the sound file in your drop folder.`, and for `"heygen"`, `When the HyperFrames part is ready, you'll choose the HeyGen voice there.` (H6 builds the rest of that route).
- **The gate:** on a planned record, `plan`, `episodes`, `guide` and `name` run, and `leave` says how to drop it. Every other command ends with 1 and says `"Too many SKUs" is a planned video, and there's no footage for it yet.`
- **Her skill:**
  - Three rows, in both skills:
    - "I have a script" (or "Make a video from my script") and "Make an explainer from my script": read `script.md` in this skill's folder and follow it;
    - "Show me the plan for <title>": `plan "<title>"`.
  - `script.md` (written beside `SKILL.md` by `studio.js`) gives Claude the route:
    1. Take the script, pasted in the chat or put in the `Scripts` folder of her BRIMM Video Studio folder. A file anywhere else can't be read, so ask her to move it or paste it.
    2. Ask about the content and the direction one question at a time.
    3. Draft the guide (one cue for each point a graphic would make visible: short, with things and words, never people), the shot list, and the teleprompter lines (her words, ready to read aloud, with no directions or cues). Show it in plain words and change it as she asks.
    4. On her yes, run `plan new`, then one `plan … set` holding every cue, shot and line, with `"`, `$`, `%`, `\`, `` ` `` and `|` written as `%22`, `%24`, `%25`, `%5C`, `%60` and `%7C`.
    5. Run `plan "<title>"`, tell her what it says, and tell her where the teleprompter script is.
    6. For a style she names, run `refs look`, look at the picture, and put `ref: <file>` on the cues it styles.
    7. For an explainer, give only graphic and words cues. The voice is hers, or a HeyGen voice she picks in HyperFrames: Jason's standing yes for explainers, never a voice made from her own.

Tests, by group:

| Group | Tests |
|---|---|
| The record | `newPlannedEpisode`'s whole record, at layout 5. `faultFor` takes it and refuses `video: null` without `"planned"`, and `"planned"` without a whole `planned`. `isAnswer` takes its answer. `readEpisode` reads it. A Mac on older code reads layout 5 as newer (`layout.test.js`) |
| Not gated | A planned record is not gated, and `shownName`, `hideNames`, `secretsOf` and `findEpisode`'s match by words show and match its title. Each of these is gated exactly as today, and its title is hidden: `answer.state "planned"` with no `planned`, with a `video`, or at layout 4; and a record with a `planned` but another state |
| `plan new` | Folder, record, words, the explainer and its voice, a duplicate title, `--voice` alone, no title (the help and 2), a title with `%24` and `%22`, and one of 81 characters |
| `plan … drop` and `leave` | `drop` archives it, and `episodes` and the guide no longer show it. `leave` on a planned record writes nothing and says how to drop it |
| `plan … set` | Cues of each kind with each key. A `b-roll` cue without a shot, or with a shot of another kind. Explainer kinds, shots in an explainer, and a `ref:` not in the folder. Each limit. A cue with five fields but no `key:`. One record write with `expectRev`, and none when any entry fails. The three files' exact texts, written by the rule (a second `set` replaces them, and no other file is touched), and the record's `files` |
| Text | Each of the six escapes, and `100% sure` (no code) kept as it is. An apostrophe and a quote mark arrive whole. A bare `|` in `words` splits the field and is refused in words |
| `plan …` | The plain words, for a script route and for an explainer |
| The rest of Studio | With a planned record in `Episodes/`, each of these runs as before and none crashes: `episodes` (the line above), the guide (the step above), `findEpisode` for other commands (the refusal), the import's version match (`versions.js:121`), its drop-file match (`filing.js:249`), `release`, snapshots, `free`, and `guideItems` |
| The skill | The three rows in both skills. `script.md`'s steps, pinned by sentence. `studio.js` writes it and makes `Scripts/`. The caps are ten higher. Every backticked command is in `COMMAND_NAMES`, with its flags in `HELP` (`studio.test.js:537-644`) |
| The lists | `ASKED`, `TODAY_ASKED`, `walkWords`, the README row, the gate's lists, and `today-says.json` written again |

- [ ] Steps:
  1. The record's tests, then `episode.js`.
  2. `plan.test.js`, then `plan.js`.
  3. `edit-plan.test.js` and the rest of Studio, then `edit.js`, `guide.js`, `gate.js`, `versions.js`, `filing.js`, `snapshot.js` and `free.js`.
  4. The skill and `script.md` with their pins.
  5. The whole suite.
- [ ] **Commit:** "Studio HF path H4: the planned episode, its video guide, shot list and teleprompter script".

---

## A1. What the app does (by hand, before H5 and H6)

Like A0, on the Mac Studio only, and each step needs Jason's yes. Claude writes it as a group on the Studio By-Hand Checks page when Jason says yes, runs every Terminal step, and asks Jason only for what is on screen.

How it is run:
- Everything happens in scratch projects under `~/BRIMM Video Work/HF path A1/`.
- It uses a recording of Jason's own, never one of Sallie's videos or a session.
- Nothing is written into Dropbox.
- Claude assembles the projects in Terminal, in the shape `projectFiles` writes. Before H1, the cue file is written by hand in H1's format.

| Question | What is looked at | What it decides |
|---|---|---|
| 1. The cue file | Does the agent read `brimm/graphic-cues.json`, offer the cues after the cuts, build only the one she takes, and put it on its words? | H1's rule line, if the agent misreads it |
| 2. Several videos | With a b-roll and a screen recording, both picture only, in `media/`: does the app open the project and show them, and does the agent put one at its cue when she takes it? | H5's project. If the app takes only one video, H5 waits for Jason's call |
| 3. B-roll, transcribed? | Does the app transcribe the picture-only files when it opens them (look in `.hyperframes/transcripts/`)? | H5's picture-only rule, as a check: the rule stands either way (design 10.7) |
| 4. Sound with no picture | Does a project whose only media is `media/voiceover.m4a` (an `<audio>` element, no `<video>`) open, play, show its words, and export with its sound? | H6's project from sound |
| 5. A HeyGen voice | In a scratch explainer: can a HeyGen voice be chosen in the app, and exported as a sound file, or as a video whose sound Studio can take? | H6's voice route: an export that is dropped (first choice), or a project with no media (design 6, 10.13) |

---

## PR H5, in outline: footage for a planned episode

Written as tasks once A1's answers 2 and 3 are in. What is decided now:
- **Each dropped file is imported as today:** its own folder, record and light import.
  - A video with no sound (`unedited.js:830`, "there is no sound in the file") is imported with no transcript. It can only be answered as b-roll or a screen recording for a planned episode, or left alone.
- **The card asks first,** while any planned episode is waiting for footage: `Is <label> footage for a planned video?`. The options are the planned videos, newest first and at most three, then `No`. On `No`, the card of today follows.
  - For footage, a second question asks what it is: talking to the camera, a screen recording or b-roll.
  - For a screen recording or b-roll, a third asks whether it shows a client, a client's name or their work.
  - A Zoom download is never asked: it is a session at the drop. A fourth planned video is reached through the card's own "Other".
  - `formOf` (receipts.js:107) gets a third form, recognised by its fixed question. Its options are checked against the planned titles the card offered, which the receipt keeps in `offered`.
- **A client on screen** keeps that file out of the project until she confirms the client agreed to the picture. She confirms it with `plan "<planned>" agreed "<label>"`, in `askDialog`'s typed-answer box with a `They agreed` button, as `reel … --client-agreed` does.
  - The record gets `planned.consent: [{ label, file, day }]`.
  - What she types goes only to `agreements.txt` in the episode's work folder on this Mac (mode 0600), and is never sent anywhere (design 5, step 6).
- **Talking-to-camera parts are joined** in the shot list's order (design 10.12). Studio finds each part's shot by where its words fall in the teleprompter script (`inMain`'s matching), and she confirms the order on a card.
  - ffmpeg's concat with stream copy joins them, made outside and cloned into the planned folder. Parts filmed with different settings are refused in words in this first version.
  - The joined file is transcribed and planned like any import.
  - The planned record becomes a raw episode, or a short video by today's rule, with `video` the joined file and `planned.filmed` set.
  - The parts' records get `answer.state: "part"` and `partOf`, and every listing skips them.
  - One talking part is cloned in without a join. Dropbox then holds the footage twice, which is a cost to tell Jason.
- **B-roll and screen recordings** get working copies with no sound (`workCopyArgs` takes `mute`, which gives `-an`). They go into `media/` as `b-roll-<n>.mp4` and `screen-<n>.mp4`. In the project's cue file, each cue that names their shot gets that file as its `material`.
- **The guide's cues** are placed on the joined words (H1) in place of the reading's. The reading still suggests Reels and spellings.

## PR H6, in outline: the explainer

Written as tasks once A1's answers 4 and 5 are in. What is decided now:
- **Her voiceover:** a dropped sound file is offered to a planned explainer on H5's card, as `The voiceover for "<title>"`.
  - The project is made from the sound and the guide: `media/voiceover.m4a` in an `<audio>` element, upright 1080 by 1920 as the BRIMM explainer test is, and `transcript.json` from its words. The cues are placed on its words.
  - The kind is decided at the finish from the export, by today's rule.
- **A HeyGen voice:** if A1 shows that the voice can be exported, the export is dropped and goes the way of her voiceover. If not, the project is made with no media, its cues have no `at`, and the agent times them to the voice.
- **The HeyGen line:**
  - **In words:** only an explainer's project gets: `- **Voices.** A HeyGen voice is hers to choose for this explainer (Jason's standing yes, 2026-11-03), never a voice made from Sallie's own. No HeyGen avatars or HeyGen Video 1 clips without Jason's yes, no generated people who could pass as real, and never a generated Sallie or her face.` The line said after the app opens (`BUTTONS`, app.js:179, pinned in `app.test.js`) says the same for an explainer. Every other project keeps today's lines (design 10.6).
  - **In settings:** nothing changes. `tts` stays denied and the agent's HeyGen keys stay blank, since she picks the voice in the app's own panel (design 9).
- **At the hand-off** of an explainer with `voice: "heygen"`, Studio adds: `It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content.`
- **The docs:** `CLAUDE.md`'s HeyGen lines and the README record the standing yes for explainers.

---

## PR H7. The branch's by-hand checks, and the merge

The steps go on the Studio By-Hand Checks page as one group, and each is run on Jason's yes:
- The branch runs from a worktree of its own on the Mac Studio, never from `~/Claude Code/brimm-video-studio`.
- Every Studio command is run with `HOME` set to `~/BRIMM Video Work/HF path checks/home`. Its `settings.json` names a scratch root in the same folder, so nothing is written into `Episodes/`, a drop folder or the reference folder in Dropbox. The projects are made under it, inside `~/BRIMM Video Work`.
- Settings come from `$HOME` (`settings.js:40`), so no code is needed for this. How `claude` signs in under that home is settled on the page.

The checks:
1. A recording of Jason's own: the reading's cues, `graphic … ideas`, the main project's cues in the app, and one cue taken and built.
2. A Reel of it; then a finished video's Reel and its read.
3. `refs`, `refs look`, and `refs use` into the scratch project.
4. In the scratch BRIMM Video Studio folder: "I have a script", with the BRIMM explainer test's script, through to `plan "<title>"` and its three files.
5. H5's footage: two talking parts, one b-roll and one screen recording, with one "shows a client" and its box.
6. H6's explainer, with a voiceover of Jason's.

Then:
1. Jason's yes to merge the pull request into `main`, with a merge commit. That is best after her laptop has moved to Studio (checks 41 to 48). Until then her laptop runs brimm-video, which reads a planned record's layout 5 as newer and leaves it alone.
2. The Mac Studio's checkout pulls.
3. `node tool/settings.js studio` runs, which needs Jason's yes. The installer's step that makes `References` also runs, which needs his yes too.
4. The BRIMM Ops session is told, so it can bring Sallie's guide up to date.
5. Her laptop takes it at its own move.

---

## Rulings made in this plan, for Jason to check

1. **One branch, one draft pull request into `main`.** H1 to H6 land on the branch as they pass review. Only the merge into `main` waits for your yes.
2. **At most twelve cues on a raw episode** (it has six ideas today), and at most three on an iPhone clip or a Reel.
3. **The reading names the phrase as well as the words,** so a cue lands where Claude meant it, even when the words are said twice.
4. **Older episodes' graphic ideas come into their projects as cues.**
5. **The placing rule:** the exact words first, otherwise two-thirds of the words in order, with the same spellings applied to both sides. The take she keeps wins over a retake a suggested cut removes.
6. **The reference folder is `BRIMM Video/References`.** Studio only reads it, and the installer makes it, on your yes. Claude looks at a picture through a copy in her folder, so the guard is not widened. HEIC and TIFF pictures are copied as JPEG, the kinds Claude can read.
7. **A package is set whole by one command,** with six characters written as codes, because her chat's commands can't hold line breaks, quote marks or dollar signs.
8. **A planned episode is an episode record with no video,** held as `"planned"` at layout 5. The gate does not hide its title, because it was made in her chat and cannot be a session. A record that only claims to be planned is gated as today.
9. **Her skill's line caps go up by ten in H3,** and the script route's steps are a file beside the skill.
10. **H5 and H6 are planned in detail after A1,** because what the app does decides them.
11. **The HeyGen voice changes the words only,** for explainers. `tts` stays denied.
12. **Joining talking parts uses stream copy only** in its first version. One talking part is copied in, so Dropbox holds it twice.

## Open items

- **How `claude` reads under H7's scratch home.** It is settled on the page before the first check that needs a reading.
- **Whether parts' own files could later be freed,** once a planned episode's main video is filed (ruling 12's cost). That is Jason's call, after H5.
