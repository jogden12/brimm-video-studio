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
- HeyGen avatars, lip-sync, Video 1 clips, and an AI-generated Sallie, her face or her voice. Main's notes warn before them and block nothing (#36, 4 November), and nothing here uses them.

---

## The order

| PR | What | Needs | Waits for A1? | By hand |
|---|---|---|---|---|
| H1 | Graphic cues on a raw episode: the cue and its placement, the reading's ask, the cut plan, the edit notes, Final Cut's markers, `graphic … ideas`, and `brimm/graphic-cues.json` with its rule in the main project | None | No | In H7 |
| H2 | Cues for an iPhone clip and for Reels. A raw episode's Reel takes its share of the episode's cues. A finished video's Reel is read when the Reel is made | H1 | No | In H7 |
| H3 | The reference folder: `refs`, `refs look`, `refs use`, and named pictures copied into a project | H1 | No | In H7 |
| H4 | The planned episode and its package: `plan new`, `plan … set` and `plan …`; its three files; "What's waiting?" and the guide; the script route in her skill | H1, H3 | No | In H7 |
| A1 | What the real app does with a cue file, several videos, b-roll, sound with no picture, and a HeyGen voice (design 9) | Jason's yes | None | The probe itself |
| H5a | Footage for a planned episode, its first part: a video with no sound taken in, the planned card and the part card with their receipts, `footage`, the parts, a client's agreement (`plan … agreed`), and the stage `footage` | H4, A1 | Answered 4 November | In H7 |
| H5b | Its second part: the join (`plan … join` and the `join` run), the plan made a video, footage copies with no sound, the project's footage and its line, and the stages `joining` and `join-failed` | H5a | Answered 4 November | In H7 |
| H6 | The explainer: her voiceover on the planned card, a project from sound, a HeyGen explainer's project with no media and its voice taken in (`plan … voice`), the YouTube reminder at the hand-off, and the stages `heygen-open` and `heygen-voice` | H5b | Answered 4 November | In H7 |
| H7 | The branch's by-hand checks, then the merge into `main` on Jason's yes | H1 to H6 | None | The whole group |

A1 needs no code, so it ran while H1 to H4 were built. H2, H3 and H4 follow each other, because each changes `project.js` and `edit.js`, and so do H5a, H5b and H6, written from A1's answers of 4 November.

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
- **Studio's HyperFrames rules stay:** exports are made on This Mac, links are never set to "Anyone with the link", the agent stays on Auto access, and the denied commands stay denied (`tool/hyperframes.js:135-155`, `tts` among them, since it fetches a voice model the first time). HeyGen's tools are open. The notes of every main video and Reel hold `AI_PEOPLE`, which warns before an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice. A session clip keeps `NO_GENERATED_PEOPLE` (main's #36). The app never applies a project's `.claude/settings.json`, since it starts its agent with `--setting-sources user`. So nothing here relies on a project's settings, and in the app the notes are the only guard.
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
7. **No client reaches a project before her click** (H5a, H5b). A part that shows a client gets no footage copy and no file in `media/` until `planned.consent` holds its id, whether the project is being made or opened. What she typed is only in `agreements.txt`, at mode 0600. Pinned by `edit-footage.test.js`, "a client's part stays out until her click", and `app.test.js`, "footage goes in at an open only once agreed".
8. **Footage reaches the app with no sound** (H5b). Every footage copy is made with `-an`, and one in which ffprobe finds a sound stream is never put in. Pinned by `workcopy.test.js`, "a footage copy is made mute, and one with sound is refused".
9. **A part is answered only by her cards** (H5a). On an open-lock Mac, `footage` writes nothing without her receipts of the planned card and the part card, and for sound alone the not-a-session card's (H6). It never takes a Zoom download, a video holding a session's words, or one held beside a session. Pinned by `edit-footage.test.js`, "the receipts and the sessions".

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
- **`refs use "<episode>" "<name>" [reel <n>]`:** copies the picture into that episode's HyperFrames project on this Mac, the main project or Reel n, as `brimm/references/<file>`. It says `The blue carousel is in the HyperFrames project for <name>. In HyperFrames, say "Use the blue carousel picture as the style for the graphics".`, naming the picture by its stem with no folder or extension. The project's rule already tells the agent where her references are (H3 ruling: what she is told holds no path).
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

### A1's answers, 4 November

Run on the Mac Studio, in scratch projects, as checks 49 to 56 on the By-Hand page.

| Question | What the app did | What it decides |
|---|---|---|
| 1. The cue file | After "Make the cuts Studio suggests", the agent offered all six cues by itself and named the one it could not place. It built only the cue taken, on its words once the cut was counted (2.24 s earlier on the timeline). | H1's line stands as built |
| 2. Several videos | The app opened a project with three videos in `media/` and showed all of them. The agent put each footage cue at its words, muted, with the recording's sound under it. Upright b-roll became a full cutaway, on a mist panel (Jason: "Full cutaway is fine"). Wide footage filled the frame. | H5's project as outlined. Its line says a full cutaway |
| 3. B-roll, transcribed? | No. The app transcribes only files with sound. | H5's picture-only rule holds |
| 4. Sound with no picture | It opened and played, with no `<video>`. Its words showed in the Script tab, from the app's own transcript, which spells BRIMM "Brim". It exported with its sound. | H6's project from her voiceover, as planned |
| 5. A HeyGen voice | The app has no voice panel. The agent makes the voice with the app's own tool (`mcp__hf_media__voice_generateVoiceover`), which saves `assets/HeyGen voice <id>.wav` with the app's transcript beside it. The export has the voice. | H6 takes the voice from the project's `assets/`, with no export and no drop |

Also found:
- **Videos added in the app go to `assets/`,** each with the app's transcript beside it. The agent finds a stretch of one by its words (check 52).
- **The app never applies a project's settings.** It starts its agent with `--setting-sources user`, so a project's `.claude/settings.json` has no effect in the app. Only the notes guard the agent there (check 55).
- **The app gives its agent HeyGen tools of its own** (`hf_media`): voiceover, voice cloning, avatars, lip-sync and generated video. Jason, 4 November: block none of them on either Mac. Instead, every project's notes warn before an AI avatar or an AI Sallie, her face or her voice. That change goes to main in its own pull request.
- **The Export dialog starts on Cloud** since the app's update of 4 November.

---

## PR H5. Footage for a planned episode

H5 is built and reviewed in two parts. H5a takes the footage in: its cards, their receipts, the parts and a client's agreement are safety code, which a reviewer can approve apart from H5b's media work. H5a leaves each piece of footage as a part of its plan, with any client's agreement noted. H5b joins the talking parts into the plan's video and puts the rest into its project.

### H5a. The cards, the parts and a client's agreement

**Files.** Create `tool/footage.js`, `tool/tests/footage.test.js` and `tool/tests/edit-footage.test.js`. Modify:
- `tool/unedited.js`: a light import of a video with a picture and no sound (:828, "there is no sound in the file") files it with no transcript. `tool/filing.js`: `fileEpisode` (:108) passes `sound: false` into its `video`.
- `tool/kinds.js`: `seenLine` (:125) ends `, no sound` for such a video, and `isSeenLine` (:137) takes that ending.
- `tool/episode.js`:
  - the answer state `"part"`, in `ANSWER_STATES` and `NO_KIND_STATES` (:51-53), and `isPart(record)`;
  - `faultFor` (:371) takes `partOf` only with that state, and that state only with `partOf`; `video.sound` may be `false` (`newEpisode`, :305);
  - `layoutOf` (:260) is 5 for a record that holds `partOf`, so a Mac on older code leaves a part alone; `isPlanned` (:198) takes `consent`.
- `tool/receipts.js`: the planned card and the part card, `formOf` (:107), `receiptFrom` (:151), and the answers `footage` expects.
- `tool/gate.js`: `FOOTAGE`, which runs for a record with no kind alone (`gateFor`, :140).
- `tool/edit.js`: `footage` wired; `cardLinesFor` (:922) prints the two cards, and no `Card:` line for a video with no sound; `listedEpisodes` (:983) and `guideItems` (:7026) skip parts; `answerWhy` (:5367) and `leaveCommand` (:6283) refuse a part, and `kind` takes no kind, `session` included, for a video with no sound (ruled at H5a's review); `guideFacts` (:6855) gives a plan its parts.
- `tool/plan.js`: `planAsked` (:296) and `planFor` (:472) take `agreed`, and `showPlan` (:453) lists the footage.
- `tool/guide.js`: the stage `footage`, in `videoNext`'s planned branch (:388), before `opsStep`.
- Both skills, the README, the lists of the Global Constraints, and `today-says.json`. The skills' caps go up by ten (`< 180`) in the five tests that hold them: `studio.test.js:251`, `:1096` and `:1221`, `guide-reels-pins.test.js:67` and `set-aside-pins.test.js:135`. `SKILL.md` has six lines to spare today, and H5 and H6 add about eight.

**Interfaces.** Consumes H4's planned record (`isPlannedRecord`, `planned.set`, `planned.shots`) and `textArg`. Produces, for H5b and H6:
- `PART_KINDS = ["talking", "screen", "b-roll"]`. H6 adds `"voiceover"`.
- A part is the dropped video's own record, kind `null`, written at layout 5, with `answer.state: "part"` (its `by`, `on`, `at` and `private: "no"` as `kind` writes them) and:

  ```json
  "partOf": { "id": "<the plan's id>", "as": "talking" | "screen" | "b-roll", "shot": null | <n>, "client": false | true }
  ```

  `shot` is a whole number for a screen recording or b-roll, and `null` for a talking part, whose `client` is always `false`.
- `planned.consent: [{ "id": "<the part's id>", "label", "at": "<day>" }]`: the part by its id, never its file, whose name may be a client's, since a plan's record is not gated.
- `partsOf(root, id) -> [{ name, folder, record }]`: plan `id`'s parts, by their records in force, whole and not archived, in the order answered. A plan's record is never written for a part.
- `mayGoIn(part, planned)`: the part shows no client, or `planned.consent` holds its id.
- `plannedOffers(records, { picture, sound }) -> [{ record, option }]`: the plans a video may be for, newest first by `planned.at`, at most three. In H5a, a script whose package is set, not filmed and not dropped, for a video with a picture, as `Footage for "<title>"`.
- `plannedCardOf({ label, offers })` and `partCardOf({ label })` (receipts.js). `formOf` gives `{ label, form: "planned" }` and `{ label, form: "part" }`.

**The cards** (exact; one answer each, no descriptions):
- The planned card, one question: `Is <label> for a planned video?`, header `Planned`, answered by each offer's `Footage for "<title>"`, then `No`. Its receipt keeps every answer, in order, as `offered`.
- The part card: `Which kind of shot is <label>?` (header `Shot`): `Talking to the camera`, `A screen recording`, `B-roll`; and `Does <label> show a client, a client's name or their work?` (header `Client`): `Yes`, `No`.
- `episodes` prints `    Planned card: {…}` and `    Part card: {…}` before `    Card: {…}`, under a video waiting for its answer that a plan is offered to. Never for a Zoom download, a video whose Maybe line is a session's, or one held beside a session. A video with no sound has `    No sound: it can only be footage for a planned video.` in place of its `Card:` line.

**The commands** (the words are fixed here for the tests):
- **`footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]`:**
  - Its episode is the video, found through the gate. The plan is read from the records alone, as plan.js `plannedWith` (:339) reads them, by the string its title was made with.
  - It holds the video's answer lock, as `leave` does, claims nothing, and makes one write by the rule.
  - On an open-lock Mac under Claude Code it writes only with her receipts of the planned card (`Footage for "<title>"`, among offers that are each still offered) and of the part card, checked as `receiptHeld` (edit.js:5201) checks `kind`'s. Otherwise it says `NO_RECEIPT` and both cards, this plan among the offers.
  - Says `<label> is footage for "Too many SKUs": talking to the camera.`, `…: the b-roll for shot 2. It goes in with no sound.` or `…: the screen recording for shot 4. It goes in with no sound.` With a client it adds ` It shows a client, so it stays out of the HyperFrames project until you confirm they agreed.` It ends ` When all its footage is in, say "that's all the footage for Too many SKUs".`
  - Refused, with 1 and nothing written:
    - the plan: `There's no planned video called "<said>" waiting for its footage.`; `The plan for "<title>" isn't made yet: its guide, its shot list and its teleprompter script come first.`
    - the video: `<label> came from Zoom, and a Zoom download is never footage.`; `<label> holds most of the words of a client or group session, so it is never footage. Ask Jason.` (its match, or a version beside a session); `<label> is answered already: it is <KIND_SAID>.`; `<label> is footage for "<other>" already. To change that, say "that's not footage for <other>" first.`; `<label> is sound alone, so it can't be footage.`
    - the kind: `<label> has no sound, so it can't be a talking part: it is b-roll or a screen recording.`; `A talking part is you talking to the camera. A video that shows a client is b-roll or a screen recording.`
    - the shot: `"<title>" has no b-roll shot in its shot list.`; with two or more and no `--shot`, `Which b-roll shot is it? Shot 2: Sallie at her desk sorting invoices. Shot 5: A coaching session. Say it again with its number.` (one is taken); `Shot 3 of "<title>" is talking to the camera, not b-roll.`; `Shot 2 of "<title>" has its footage already: <label>.`; `A talking part has no shot: Studio puts the talking parts in order by their words.`
- **`footage "<video>" none`:** until its plan is filmed, the part waits for its answer again, cards and all: `<label> is no longer footage for "<title>": it waits for its answer again.` Refused: `<label> is not footage for a planned video.`, `"<title>" is made from its footage already: ask Jason.`
- **`plan "<planned>" agreed "<video>"`,** in the order of `reel … --client-agreed` (noteAgreement, edit.js:3737), under the plan's answer lock:
  - Before any dialog: `<label> is not footage for "<title>".`; `<label> shows no client, so no agreement is needed.`; `<label>'s client agreed already, on 4 November.` (ends 0).
  - `A dialog is open on this Mac for <label>: type who agreed and when, then click "They agreed". Return presses Cancel.` The dialog (askHere, `DIALOG_MS`) shows `<label>`, a blank line, and `Who agreed to being shown in this footage for "<title>", and when?`, with `Cancel` and `They agreed`.
  - After her click the plan and the part are read again. The note `<when> <label> (<part id>): <what she typed>` goes into `agreements.txt` in the plan's work folder on this Mac (mode 0600), then one record write adds `{ id, label, at }` to `planned.consent`.
  - `<label>: the client's agreement is noted, on 4 November. Who agreed is kept on this Mac only, and the footage goes into the HyperFrames project.` The tool log names the plan's id and the label, never what she typed. Cancel, a dialog out of time and nothing typed are said as the Reel's are, and write nothing.
- **`plan "<planned>"`** adds a line for each part: `Footage: <label>, talking to the camera.`, `Footage: <label>, b-roll for shot 2.` or `Footage: <label>, a screen recording for shot 4.`, and for a client ` It shows a client, and waits for their agreement.` or ` It shows a client, who agreed on 4 November.` A plan with no part prints as H4's.
- **The import:** a light import of a video with a picture and no sound files the video alone, with no transcript, plan or words, at the steps `Reading the sound` and `Filing`. Its record has `answer.seen` such as `upright, 0:08, no sound`, its `came`, no guess, no match, and `video.sound: false`. A file with no picture and no sound fails as today, and so does a heavy import of a silent video. `kind` refuses it every kind, `session` included, before any receipt is looked at (ruled at H5a's review): `<label> has no sound, so Claude can't read it: it can only be footage for a planned video. Or say "leave it".`
- **The guide:** `footage`, for a plan with a part and not filmed: `Its footage so far: 2 talking parts, 1 screen recording and 2 b-roll clips. When it is all in, say "that's all the footage".` A part waiting for its client adds a line of edit.js's own (`also`): `<label> shows a client: it stays out until you say "the client agreed".` With no part, `film` is said as H4 wrote it.
- **The gate:** `FOOTAGE = ["footage"]` runs for a record with no kind alone, so a session not cleared and a video held beside one refuse it in the gate's words. `kind` and `leave` refuse a part: `<label> is footage for "<title>". Say "that's not footage for <title>" first.`
- **Her skill,** both skills: ask `Planned card: {…}` first, as given. On `Footage for`, ask `Part card: {…}`, as given, then run `footage`, asking her in the chat for the shot when it says which. Never word either card. On `No`, today's card, or for a video with no sound `leave "<label>"`, saying why. Two rows: "The client agreed to <label>" (`plan "<title>" agreed "<label>"`, with the dialog's words as for a Reel's) and "That's not footage for <title>" (`footage "<label>" none`).

Tests, by group:

| Group | Tests |
|---|---|
| The import | A light import of a video with no sound: its folder, its record (no words or plan, `video.sound` false, the seen line, `came`), its two steps, and `Ready: <label>…`. A file with no picture and no sound fails as today, as does a heavy import of a silent video. `isSeenLine` takes `, no sound` at the end alone |
| The record | A part's whole record, at layout 5. `faultFor` refuses `partOf` without the state, the state without `partOf`, a screen part with no shot, and a talking part with one. A Mac on older code reads a part as newer (`layout.test.js`). `consent` is read in `planned` |
| The cards | `plannedCardOf` and `partCardOf` exactly. `formOf` finds both with one to three offers, and refuses four, `No` not last, a description, another header, and an answer that is not `Footage for "…"`. `receiptFrom` keeps `offered`, and the hook writes a receipt for both |
| `episodes` | The cards under a waiting video when plans wait; none for a Zoom download, a session's Maybe line, a video held beside a session, a plan not set or a dropped one; the three newest of four plans; the `No sound` line, and no `Card:`, for a video with no sound; a part listed nowhere |
| `footage` | Each kind. `--shot` taken alone, asked for, of another kind, and taken already. Each refusal above. One write with `expectRev`, and the record's `answer` and `partOf` |
| Receipts and sessions | On an open-lock Mac with `CLAUDECODE=1`, nothing is written without both receipts, or with a receipt of another plan, kind or client answer, or offers naming a plan dropped since. The refusal prints both cards, with a fourth plan among the offers when it was named. A strict Mac and Terminal ask for none. A Zoom download, a session's match and a video held beside a session are refused with every receipt in place |
| Taking back, and consent | `none` before the join brings its cards back, and is refused after. `agreed`: each refusal, Cancel, out of time, nothing typed, and the plan or the part changed meanwhile. `agreements.txt` at mode 0600 holds the line, the record holds `{ id, label, at }` and nothing she typed, and the tool log |
| `kind`, `leave` and the gate | Both refuse a part. A video with no sound takes no kind, `session` included. `FOOTAGE` in the gate's walk (`gate.test.js`): it runs for no kind, and is refused for a session and beside one |
| The guide | `footage` with each count, its `also` line, and `film` while no part has come. `opsStep`'s texts unchanged (the guide's pins) |
| The lists and the skill | `ASKED`, `TODAY_ASKED`, `walkWords`, the README row, both skills' paragraph and rows, the five caps, and `today-says.json` written again |

- [ ] Steps:
  1. The record's and the import's tests, then `episode.js`, `kinds.js`, `filing.js` and `unedited.js`.
  2. `footage.test.js` and the cards' tests in `receipts.test.js`, then `receipts.js` and `footage.js`.
  3. `edit-footage.test.js`, and the gate's and the guide's tests, then `edit.js`, `gate.js`, `plan.js` and `guide.js`.
  4. The skills, the README and the lists, with their pins; then the whole suite.
- [ ] **Commit:** "Studio HF path H5a: footage for a planned video, its cards, its parts and a client's agreement".

### H5b. The join and the project

**Files.** Create `tool/join.js` and `tool/tests/join.test.js`. Modify:
- `tool/unedited.js`: `importInto(file, into, deps)`, the light import's own steps on a file made outside. `tool/filing.js`: `fileEpisode`'s `into: { folder, record, change }`.
- `tool/plan.js`: the `join` form; `planFor` takes a video made from a plan for `plan "<planned>"` and `agreed`.
- `tool/footage.js`: `plannedOffers` also offers a video made from a plan, with no hand-off yet, for b-roll and screen recordings.
- `tool/workcopy.js`: `workCopyArgs`'s `mute` (:369), the footage copies (`footageCopyPaths`, `FOOTAGE_STEP`), and `--footage`.
- `tool/project.js`: `projectFiles`' `footage` (:665), cues' `material`, `FOOTAGE_RULE` in `brimmRules` (:531), `aboutOf` (:586).
- `tool/app.js`: `makeProject` (:453), and the footage at every open (`openInApp`, :728). `tool/app-reel.js`: `cuesFor` (:177).
- `tool/edit.js`: `join` wired as a detached run's alone (no help, as `workcopy`); `workcopy --footage` (:4082); `graphicIdeas` (:4933); `guideFacts`.
- `tool/gate.js`: `PLANNED` gains `join`. `tool/guide.js`: the stages `joining` and `join-failed`.

**Interfaces.** Consumes H5a's parts, `partsOf` and `mayGoIn`, and H1's `placeGraphicCues`. Produces, for H6:
- `partOrder(parts, lines) -> [{ id, label, place }]`. A talking part's place is where its words fall in the teleprompter script: each run of four of its tokens (H1's `cueTokens`) found once in the script votes for its place there, and the place is the middle vote. With fewer than three votes it has none. Placed parts come in order of place, then the rest in the order answered.
- `partsFault(probes) -> "" | why`, from what ffprobe printed of each part: the same picture (codec, size, rate, pixel format), the same sound (codec, rate, channels), and the same streams at the same indexes.
- `concatList(paths) -> text` (`ffconcat version 1.0`, an apostrophe written `'\''`), and `joinArgs(list, output, { video, audio }) -> argv`: stream copy into a `.mov`.
- The `join` run, `join --now "<plan's folder>" --parts <id>[,<id>…]`. H6 adds `--voice`.
- A video made from a plan: the plan's record, written once as the video (below). `isFromPlan(record)`: it has `planned`, a `video` and a kind.
- `footageOf(record, parts) -> [{ part, as, shot, path }]`, `path` being `media/<as>-<shot>.mp4`.

**What it does** (the words are fixed for the tests):
- **`plan "<planned>" join ["<video>"…]`,** for "that's all the footage":
  - Refused: `"<title>" is an explainer: its voice makes it, and it has no footage to join.`; `"<title>" is made from its footage already.`; `"<title>" has no talking part yet: a video needs at least one.`; `Those aren't the talking parts of "<title>". They are: <label>, <label>.`, unless each is given once; and a run at work, as `kind` says it.
  - With two talking parts or more and none given, it says the order and writes nothing (0): `The talking parts of "Too many SKUs", in the order of its script:`, then `1. <label>` and `2. <label>, whose words weren't found in the script`, then `Once they are joined, no more talking parts can be added.`
  - With them given in her order, or with one talking part, it starts the run: `"Too many SKUs" is being made from its footage. A notice comes when it is ready.`
- **The run,** under the plan's episode lock, reads the plan again and refuses as above, and reads each part's video through from Dropbox.
  - One part: its video and its light import's files are cloned into the plan's folder under their own names (ruling 12).
  - Several: refused in words when `partsFault` says so; `joinArgs` makes `<file-safe title>.mov` in the run's own folder; `importInto` takes it in with the light import's steps, so its words, transcribed from the joined file, run on across the joins.
  - It is filed as the import files a video (`fileEpisode`'s `into`): by clones, never over a file, the record last with `expectRev`, and its late check kept on this Mac (`writePending`), so the reading and the copy wait for it as for an import's.
  - In that one write the record becomes the video: `kind` `"raw"`, or `"short video"` by today's rule (filing.js `episodeKind`); its `video`, `files` and `fingerprint`; `answer: { state: "answered", guess: null, seen, came, by, on, at, private: "no" }`, with the first part's `came`; and `planned.filmed: { at, parts: [<id>, …] }`, in the order joined. `planned` stays, so it stays at layout 5, and its name stays the title.
  - Then it starts the reading (`read --kind <kind> --rev <rev>`) and asks for the working copy, as `kind` does, with the notice `Ready: "Too many SKUs" is made from its footage. In Claude, say "what's next?"`
  - A run that fails leaves the plan as it was, and its result says `The footage of "Too many SKUs" couldn't be made into one video: <why>.`: `talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080`; `talking part 2 was filmed at 60 pictures a second, and talking part 1 at 30`; `talking part 2 has its picture in another form`; `talking part 2 has its sound in another form`; or ffmpeg's last line.
- **After the join,** a video made from a plan with no hand-off yet stays on the planned card for b-roll and screen recordings. `footage` refuses it a talking part: `"<title>" is made from its footage already: a talking part can't be added.`
- **The footage copies:** `workCopyArgs` takes `mute`, which maps no sound and gives `-an`. After a plan's video's working copy, the same run makes a copy with no sound of each b-roll and screen part that may go in (`mayGoIn`), at the step `Making the footage for HyperFrames`: `footage-<shot>-<key>.mp4` with its facts, by its own video's key (`footageCopyPaths`), an older copy of the shot taken away. A copy in which ffprobe finds a sound stream is never put in place. One that fails is logged, and the main copy stands. `workcopy --now <folder> --footage` makes these alone.
- **The project:**
  - A video made from a plan takes the guide's cues (`planned.cues`, read again by `graphicCuesOf` with `GRAPHIC_CUE_KINDS`) in place of the reading's, placed on the joined words as a raw video's are (`mainCues`, project.js:349).
  - Each b-roll and screen cue gets `material: "media/<kind>-<shot>.mp4"`, whether or not that file is in yet. Each footage copy made is moved in (`footage: [{ path, from }]`).
  - `FOOTAGE_RULE` follows "Graphic cues.", and `aboutOf` says `media/b-roll-<n>.mp4` is "b-roll she filmed for shot <n>, with no sound" and `media/screen-<n>.mp4` "a screen recording she made for shot <n>, with no sound".
- **At every open** of such a project, each footage that may go in and is not in `media/` is moved in from its copy. With no copy, it is asked for (`--footage`), the project opens, and she is told `Its footage is still being made for HyperFrames: say "open it in HyperFrames" again when it is done.` A snapshot leaves `media/` out (snapshot.js:69), so a project rebuilt on the other Mac gets its footage this way, as does a part agreed after the project was made.
- **The rule** (`FOOTAGE_RULE`, the exact line, from A1's and Jason's "Full cutaway is fine"):

  `- **Footage cues.** A cue whose kind is `b-roll` or `screen` shows footage she filmed for it: its `material`, a video in `media/` with no sound. When she takes it, put that video at the cue's words for its `seconds`, muted, as a full cutaway over the recording, and keep the recording's sound. Wide footage fills the frame. Upright footage goes in the middle as a rounded panel on a plain mist background, hiding the recording for those seconds. A cue whose `material` is not in `media/` has no footage yet, or waits for her client's agreement: tell her, and never build it.`
- **Elsewhere:** a Reel of such a video takes its guide's graphic and words cues, and no footage (`cuesFor`). `graphic "<ep>" ideas` lists its guide's cues in H1's words, under `The graphics of its video guide: 7, with times on main v0.` `plan "<planned>"` and `agreed` still run for it; `set` and `drop` say `"<title>" is made from its footage already: its plan can't be changed.`
- **The guide,** before `opsStep`: `joining`, while the run is at work, `Its footage is being made into one video. A notice comes when it is ready.`; and `join-failed`, when its last run ended and it is still a plan, `Its footage could not be made into one video. Say "how far is it?" to see why.` Once it is a video, its stages are a raw or short video's.
- **The gate:** `PLANNED` gains `join`, which every other record with no kind refuses, as `workcopy`.
- **Her skill:** a row, "That's all the footage for <title>": run `plan "<title>" join`, tell her the order, and ask on one `AskUserQuestion`, "Join them in this order?": "Yes", "Another order". Then `plan "<title>" join "<label>" …` in her order, and on as "Guide her" says for work in the background.

Tests, by group:

| Group | Tests |
|---|---|
| The order | `partOrder`: two parts given out of order come in the script's order; a part with a retake (a paragraph read twice) lands where its words are; a part whose words are not in the script comes last, as given; fewer than three votes is no place |
| Settings and ffmpeg | `partsFault`: the same settings pass, each difference is said in its words of the first part that differs, and another layout of streams is refused. `concatList` with a path holding an apostrophe and spaces. `joinArgs` maps the two streams and copies them |
| `plan … join` | Each refusal; the order said, nothing written; the run started with the ids in her order; one talking part started at once |
| The run | One part: its files cloned under their names; the record the video (`faultFor` whole, `isPlannedRecord` false, layout 5, `filmed`); the reading, the copy and the notice. Several: the stand-in ffmpeg's file taken in by the import's stand-ins, `<title>.mov` and its words in the folder, raw, and a short one a short video. A part or the record changed meanwhile (`expectRev`), and different settings, leave the plan as it was, with the result's words |
| The copies | `mute` gives `-an` and no map of a sound. A plan's footage copies: only those that may go in, named by shot and key. A copy with a sound stream refused. `--footage` makes them alone. A failed footage copy leaves the main copy |
| The project | The guide's cues on the joined words, with `material`. A client's part not agreed has no file in `media/`. `FOOTAGE_RULE` and the rule labels pinned. `aboutOf`. A plan's main project's file list |
| The open | Footage moved in at an open; its copy asked for, and the line said, when not made; a part agreed after the project goes in at the next open; a project rebuilt from a snapshot gets its footage |
| Elsewhere | A Reel of it takes graphic and words cues alone. `graphic … ideas`. `plan` and `agreed` run on it, and `set`, `drop` and `join` are refused. After the join a screen recording is taken, and a talking part refused |
| The guide and the gate | `joining` and `join-failed`. `PLANNED` with `join`, and `join` in the gate's walk and `edit-gate.test.js`, refused for a video with no kind and a session as `workcopy` is |
| The lists and the skill | `ASKED` and `walkWords` for `join` as for `workcopy`; the README's `plan` row; the skills' row; `today-says.json` written again |

- [ ] Steps:
  1. `join.test.js` for `partOrder`, `partsFault`, `concatList` and `joinArgs`, then `join.js`'s pure half.
  2. The run's and `plan … join`'s tests, then `fileEpisode`'s `into`, `importInto`, the run and `plan.js`.
  3. The copies' tests, then `workcopy.js` and `workcopy --footage`.
  4. The project's and the open's tests, then `project.js`, `app.js` and `app-reel.js`.
  5. The guide, the gate, `graphic … ideas`, the skills and the lists; then the whole suite.
- [ ] **Commit:** "Studio HF path H5b: the talking parts joined into the plan's video, and its footage in the HyperFrames project".

---

## PR H6. The explainer

**Files.** Create `tool/explainer.js` and `tool/tests/explainer.test.js`. Modify:
- `tool/footage.js`, `tool/receipts.js` and `tool/edit.js`: the voiceover on the planned card.
- `tool/episode.js`: `partOf.client` may be `null` for a voiceover, and `isPlanned` (:198) takes `project`.
- `tool/join.js`: `--voice`, and an explainer made a short video.
- `tool/workcopy.js`: the copy of an explainer's sound (`voiceCopyArgs`; `unusable`, :284).
- `tool/project.js`: `projectFiles`' `explainer`, `explainerHtml`, and the explainer's lines in `brimmRules`.
- `tool/app.js`: `mediaOf(record)` and `videoIn(dir, record)` (:357), with its callers in `app.js`, `app-reel.js` and `free.js`; `makeProject` for an explainer; `openOnly`, the open half of `openProjectInApp` (:810).
- `tool/plan.js`: the `voice` form. `tool/gate.js`: `PLANNED` gains `app`.
- `tool/edit.js`: `app` (:1443) for a planned HeyGen explainer; `finishEpisode` (:2430) and `finishClip` (:4385); `guideFacts`.
- `tool/guide.js`: the stages `heygen-open` and `heygen-voice`; an explainer's step after its spellings is always `appStep`'s.
- `tool/studio/script.md`, step 7: "or a stock HeyGen voice she picks in HyperFrames", in place of the standing yes, which main's #36 widened.
- Both skills, the README, the lists of the Global Constraints, and `today-says.json`.

**Interfaces.** Consumes H5a's planned card and `footage`, and H5b's `join` run and project. Produces:
- `PART_KINDS` gains `"voiceover"`, a part with `shot: null` and `client: null`.
- `plannedOffers` offers a video of sound alone each explainer whose voice is hers or not chosen yet, whose package is set and that is not filmed, as `The voiceover for "<title>"`. A video with a picture is offered no explainer, and a HeyGen explainer is offered to nothing.
- `voiceCopyArgs(input, output, { streams }) -> argv | null`: the sound alone (`-vn`), AAC at 48 kHz, with `aresample=async=1:first_pts=0` on the file's clock. Its copy is `<key>.m4a`, and its facts `{ seconds, bytes, width: 1080, height: 1920, fps: 30, sound: true }`.
- `explainerHtml(facts, { voiceover })`: an upright page of 1080 by 1920 with the brand's fonts and a mist background (`#E8E3DA`). With `voiceover` it holds `<audio id="voiceover" src="media/voiceover.m4a" data-start="0" data-duration="<seconds>" data-track-index="0" data-volume="1"></audio>`; without it, no media element.
- `mediaOf(record)`: `"media/voiceover.m4a"` for an explainer in her voice, `null` for one in a HeyGen voice, `"media/recording.mp4"` for any other. `videoIn(dir, record)` joins it, and `free`, the video put back (`putVideoBack`) and a rebuild ask it; with `null` there is nothing to put back or free.
- `planned.project: { name, madeAt, on, opened: [<ISO>, …] }`: a HeyGen explainer's project, kept in its plan until its voice is taken in.
- `voiceIn(html) -> { src } | { none: true } | { several: [src, …] }` (explainer.js): the sound files of `assets/` that the page's `<audio>` elements play.

**What it does** (the words are fixed for the tests):
- **Her voiceover,** which is sound alone:
  - `footage "<video>" "<planned>" voiceover [--not-a-session]` takes no `--client` and no part card. Its receipts are the planned card's `The voiceover for "<title>"` and, as `kind` asks for sound alone, the not-a-session card's `It is not a session` (`--not-a-session`).
  - It writes the part, sets `planned.voice` to `"sallie"` when it had none, and starts the `join` run with that one part at once: `<label> is the voiceover for "<title>". It is being taken in now. A notice comes when it is ready.`
  - Refused: `"<title>" is read by a HeyGen voice, so it takes no voiceover.`; `<label> has a picture: a voiceover is sound alone.`; `"<title>" is a script: it takes footage, and no voiceover.`; and, without `--not-a-session`, `kind`'s `ASK_IF_SESSION` words with its card.
  - The run clones the voiceover and its light import's files in, as for one talking part, and the record becomes a `"short video"` whose `video` is the voiceover.
- **A project from sound** (`app`, as for any short video):
  - An explainer in her voice has the working copy `<key>.m4a` (`voiceCopyArgs`), which `makeProject` moves into `media/voiceover.m4a`.
  - The page is `explainerHtml`. `transcript.json` is the voiceover's words, and the guide's cues are placed on them as an iPhone clip's are, `"graphic"` and `"words"` alone (`SHOT_KINDS`).
  - The project holds `brimm/teleprompter.txt`, the plan's, and its cut suggestions are the rules' as for any short video.
  - Its notes add `EXPLAINER_RULE`, and its cue rule is H1's with "on the recording's clock, so add the recording's `data-start` if it has moved" made "on the voiceover's clock".
- **A HeyGen voice:**
  - The gate lets `app` run for a planned record. `app` refuses every plan but a HeyGen explainer, in the gate's words (`"<title>" is a planned video, and there's no footage for it yet.`), and a HeyGen explainer whose package is not set with `The plan for "<title>" isn't made yet: its guide and its teleprompter script come first.`
  - For that one, `openVoiceProject` (explainer.js) makes an upright project with no media from the package: `explainerHtml` with no voiceover, as long as the teleprompter script at 150 words a minute and at least 10 seconds; `transcript.json` `[]`; and every cue with `at: null`. It goes in the plan's work folder, named as a main project, and opens with `openOnly`. One write gives the record `planned.project`, and each open adds its time.
  - A project on another Mac is refused: `Its HyperFrames project is on the Mac Studio: open it there.`
  - Its notes add `EXPLAINER_RULE` and `VOICE_RULE`, with the words line and the cue line below in place of H1's. `AI_PEOPLE` stays, so a stock voice needs no warning.
- **`plan "<planned>" voice`** ("the HeyGen voice is done") reads the project's page with `voiceIn`. Refused: `"<title>" isn't read by a HeyGen voice.`; `"<title>" has no HyperFrames project yet: say "open it in HyperFrames" first.`; `Its HyperFrames project is on the Mac Studio: say it there.`; `Its HyperFrames project plays no HeyGen voice yet: have one made there first.`; `Its HyperFrames project plays more than one sound: keep one voice there, then say it again.` Otherwise it starts `join --voice`: `The HeyGen voice of "<title>" is being taken in. A notice comes when it is ready.`
- **The run with `--voice`** copies that file out of the project into its own folder, takes it in with `importInto` (its words transcribed on this Mac) and files it into the plan's folder under its own name. In one write the record becomes a `"short video"`: its video is the voice; `app.projects` holds the project as its main project in use (`from`, the voice as filed; `workingCopy`, `{ bytes, seconds, fps: 30 }`; `opened`, from `planned.project`; state `"opened"`); and `planned.filmed` is set. From then on `finish`, `release` and every stage are a short video's in HyperFrames.
- **The hand-off:** for an explainer in a HeyGen voice, `finish "<episode>"` ends what it found with `It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content.` For any explainer, `finish --as-it-is` and `finishClip` say `An explainer is made in HyperFrames: export it there, then say "hand it off".` The hand-off is a short video's, and the contract does not change.
- **The guide,** before `opsStep`:
  - `film` is as H4 wrote it, for each voice.
  - `heygen-open`, a HeyGen explainer whose package is set and that has no project: `Say "open it in HyperFrames" to make it there. Then ask there for a HeyGen voice to read the teleprompter script.`
  - `heygen-voice`, once it has one: `In HyperFrames, have a HeyGen voice read the teleprompter script. Then say "the HeyGen voice is done".`
  - For an explainer, `joining` and `join-failed` say `Its voice is being taken in. A notice comes when it is ready.` and `Its voice could not be taken in. Say "how far is it?" to see why.`
  - Once a short video, an explainer goes to the app after its spellings (`appStep`), and is never offered "as it is".
- **The project's lines** (exact):
  - `EXPLAINER_RULE`: `- **This explainer.** It is graphics and words on screen over a voice, with no video of her. Keep it upright, 1080 by 1920: it is exported and handed off at that size.`
  - A HeyGen project's words line: `- **The words.** There are none yet: they are the voice's, in the app's transcript beside it in `assets/` once it is made. Never transcribe again.`
  - A HeyGen project's cue line, with H3's sentence about `brimm/references/` after it: `- **Graphic cues.** Studio's suggested graphics are in `brimm/graphic-cues.json`, each with the words it goes with and no times yet. Once the voice is made, place each on its words in the voice's transcript, then offer them to her, one at a time or all together, and build only the ones she takes: each short (its `seconds`), in the brand, with things and words and never people. Tell her of a cue whose words the voice does not say, and place it only where she says. Never add a graphic she has not taken.`
  - `VOICE_RULE`: `- **Its voice.** A stock HeyGen voice she chooses reads it. When she has chosen one, make it with the app's voice tool from `brimm/teleprompter.txt`, word for word, put it on the timeline from the start, and make the composition as long as the voice.`
- **Her skill:** in the card paragraph, `The voiceover for "<title>"` runs `footage "<label>" "<title>" voiceover` after the not-a-session card, adding `--not-a-session` only on "It is not a session". A row, "The HeyGen voice is done", runs `plan "<title>" voice`, then on as for work in the background. "Open it in HyperFrames" already covers a HeyGen explainer.

Tests, by group:

| Group | Tests |
|---|---|
| The card | A video of sound alone is offered an explainer in her voice, or with none chosen, as `The voiceover for "…"`; never a HeyGen one, a script, or a plan not set. A video with a picture is offered no explainer. `formOf` finds a card that offers both kinds |
| `footage … voiceover` | Its two receipts; `--not-a-session` needed for sound alone; each refusal; the part written and the run started; `planned.voice` set to `"sallie"` when it had none |
| The voice made a video | The run with a voiceover: its files cloned in under their names, the record a short video (`faultFor` whole) whose video is the voiceover, and the reading and the copy asked for |
| The copy of sound | `voiceCopyArgs`: `-vn`, AAC at 48 kHz, the file's clock; its facts; a copy of sound alone |
| The project from sound | `explainerHtml` (one `<audio>`, no `<video>`, 1080 by 1920). The file list. `media/voiceover.m4a` moved in. `transcript.json` from its words, the guide's cues on them, `brimm/teleprompter.txt`, the rules. `mediaOf` for `free`, the video put back, and a rebuild |
| A HeyGen project | `app` on a HeyGen plan: the project with no media (its page, `[]`, every `at` null, its length), opened, and `planned.project` written. Refused for a plan not set, a project on another Mac, a script, and an explainer in her voice. Its four lines |
| Its voice | `plan … voice`: each refusal, and `voiceIn` with none, one, one source in several `<audio>` clips, and two sources. The run: the file copied out and transcribed by the stand-in, filed, and the record a short video with the project in `app.projects` (`isAppProject` whole). `finish` then finds its export |
| The hand-off | The YouTube line for a HeyGen explainer, and none for one in her voice. `--as-it-is` refused for an explainer. A short video's hand-off, the contract's fixtures unchanged |
| The guide | `film` unchanged; `heygen-open`; `heygen-voice`; an explainer's `joining` and `join-failed`; an explainer never offered "as it is" |
| The lists and the skill | `ASKED`, `TODAY_ASKED`, `walkWords` and the README row for `plan … voice`; both skills' line and row; `script.md`'s step 7 pinned again; `today-says.json` written again |

- [ ] Steps:
  1. The card's and `footage … voiceover`'s tests, then `footage.js` and `receipts.js`.
  2. `explainer.test.js` for `voiceIn`, `explainerHtml` and `voiceCopyArgs`, then the code.
  3. The project's, `app`'s and `plan … voice`'s tests, then `project.js`, `app.js`, `join.js`, `plan.js`, `explainer.js` and `edit.js`.
  4. The hand-off and the guide.
  5. The skills, `script.md`, the README and the lists; then the whole suite.
- [ ] **Commit:** "Studio HF path H6: the explainer, from her voiceover or a HeyGen voice".

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
5. H5's footage, in the scratch home, for a plan made as a script from the BRIMM explainer test's script:
   - two talking parts dropped out of order, a b-roll with no sound, and a screen recording of Jason's said to show a client;
   - the cards and their receipts, the order Studio finds, and "join them";
   - the joined video read, and the screen recording kept out until the box;
   - the project with both footage cues, one built as a full cutaway, with the upright b-roll on a mist panel;
   - an export, handed off as raw.
6. H6's explainers:
   - a voiceover of Jason's, dropped as sound alone, through the planned card and the not-a-session card; its project of sound, with the guide's cues on its words; exported and handed off as a short video;
   - a HeyGen explainer: its project with no media, a stock voice made there from the teleprompter script, "the HeyGen voice is done", and the hand-off with its YouTube reminder.

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
10. **H5 and H6 were planned in detail after A1,** on 4 November, because what the app does decided them.
11. **HeyGen's tools are open in every project, and the notes warn** (Jason, 4 November; main's #36). The warning comes before an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice. A stock HeyGen voice is fine anywhere. `tts` stays denied, since it fetches a voice model the first time. H6 adds no HeyGen line of its own.
12. **Joining talking parts uses stream copy only** in its first version. One talking part is copied in, so Dropbox holds it twice.
13. **A video with no sound is footage only.** It is taken in with no transcript. It can be answered only as b-roll or a screen recording for a plan, or it is left alone. It is never a session (ruled at H5a's review): a session's answer needs a receipt of the card, which a video with no sound never gets, and it has no words to read for teachings.
14. **Each piece of footage keeps its own episode, as a part of its plan.** A part is gated, written at layout 5, and in no listing. The plan learns of its talking parts at the join, which she starts by saying all the footage is in. After the join, only b-roll and screen recordings can be added.
15. **Talking parts are put in order by where their words fall in the script,** by a vote of four-word runs, and she confirms the order. `inMain`'s rule of nine words in ten is not used, because a raw part's retakes would defeat it.
16. **B-roll and screen recordings go in as a full cutaway** (Jason, 4 November: "Full cutaway is fine"). A footage cue names its shot's file. That file is put into `media/` at every open, since a snapshot leaves `media/` out.
17. **An explainer is a short video whose video is its voice.** That is her voiceover, dropped as sound alone after the not-a-session card, or the HeyGen voice the app made, taken from its project when she says it is done.

These came from H5a's review on 4 November, and H5b builds them:

18. **A part in a conflicted or newer episode is never used.** Nothing is joined, copied or put into a project from a part whose folder holds a conflicted copy, or whose record a newer brimm-video wrote. Its record is still read, so it is still listed.
19. **A plan with footage can't be dropped** until each piece is taken back (`that's not footage for <title>`). That way her footage never goes unlisted.
20. **The gate's line for a plan** becomes `"<title>" is a planned video, and it isn't made from its footage yet.` That is true whether or not footage has come.
21. **Footage whose shot changed goes in nowhere.** If `plan … set` changes the shot list after footage has come, a b-roll or screen recording whose shot is no longer of its kind gets no file in the project. The rule then tells her the cue has no footage yet.

These came from H5b's build and review on 4 November:

22. **A talking part with no sound is never joined,** whether it is the only part or one of several. The join's filing refuses a kind for a video with no sound. A record's own check does not, because it also judges records read from disk. So any later path that gives a record a kind refuses a silent video itself, as `kind` does.
23. **A failed join says nothing of its parts' names.** A part is gated, and the guide sends her from a failed join to "how far is it?". So the run's result is cleaned of every name hidden while it ran.
24. **`guide wait` and `guide tell` wait while a join runs,** as they do for a reading or a copy. No step on the BRIMM Ops page changes.
25. **A client's agreement can still be noted once the video is made** (`plan … agreed` runs for a video made from its footage), and `workcopy --footage` makes the footage copies alone.

## Open items

- **How `claude` reads under H7's scratch home.** It is settled on the page before the first check that needs a reading.
- **Whether parts' own files could later be freed,** once a planned episode's main video is filed (ruling 12's cost). That is Jason's call, after H5.
- **Whether taking footage back should void its client's agreement.** Today it does not. The agreement is for that video as footage for that plan, so if she makes it footage for the same plan again, the agreement still counts. Jason's call.
- **Whether a video she left alone can be made footage.** Today it can. `episodes` shows no card for it, but `footage` asks her both cards, and the client question still holds back footage that shows a client. Jason's call.
- **Whether the join should wait for each part's own late check.** Today it reads each part as Dropbox has it, and a video made from its footage can't be joined again. The whole-branch review weighs it; then it is Jason's call.
