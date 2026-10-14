# Phase 1a, episodes on the Mac Studio alone: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A video dropped in `The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio/` is imported into its own folder in `BRIMM Video/Episodes/`, with a record that names every file and its size, every file put into Dropbox as a clone and checked again at least 15 minutes later. From a Claude Code session on the Mac Studio, `node tool/edit.js` then lists the episodes, opens one, and shows its main timeline in Final Cut Pro through a local copy and a library of its own.

**Architecture:** Five small modules carry the rules: `names.js` (names made from names), `settings.js` (this Mac's settings), `dropbox.js` (the rule for writing into Dropbox), `episode.js` (the record, `record/NNNN.json`) and `importing.js` (the import status files). `portable.js` and an optional `src` in `fcpxml.js` make the stored timeline name its video by a path from itself, and the local copy name this Mac's paths and library. `filing.js` holds the episode import's own steps (filing, the duplicate guard, the late checks), and `unedited.js` switches into it only when this Mac has settings and the folder it watches is this Mac's drop folder: otherwise it does exactly what it does today. `edit.js` is the command line for episodes, and `detached.js` runs its long parts detached. `install.sh --machine` writes the settings, the drop folder's marker and the launch agent.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no npm packages. zsh for the installer. `/bin/cp -c` (clonefile) for every copy into Dropbox. Tests run with `cd tool && node --test` on macOS and on GitHub's Ubuntu runner.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`, on `main` at e5b5017 (approved and merged). This plan is the spec's phase 1a: its row in section 7, sections 1 and 2, and the parts of section 4 that 1a builds (`episodes`, `open`, `push` with the guard, `status`, `retry`, detached runs). Builder A's brief from the lead adds `release`: see "The lead's answers", item 1.

**Built from:** the architect's drafts on branch `drafts/plans-1a-2-1b` at commit 03bd414, folder `docs/superpowers/plans/drafts/`. Taken in, each changed to the merged design as its task says: `plan-1a-tasks-1-6/task-01-names.md` (Task 1), `task-02-settings.md` (Task 2), `task-03-dropbox.md` (Task 3), `task-04-episode-record.md` (Task 4), `task-05-import-status-files.md` (Task 5), `task-06-portable.md` (Task 6, as it stands but for one line). `contract.md` gives the module, function and file names, and `decisions-1a.md` the order of the import, both followed except where a task says otherwise and why. Each drafted task's full code is in its draft file at 03bd414: a task below says "the draft's code" for the parts it keeps, and gives in full the code it changes. The branch is not merged: the pieces are copied into this branch, task by task.

**Shared with builder C (phase 2):** the names in "Interfaces other phases use", agreed with builder C on 2026-10-14.

## Global Constraints

- Node 22 or later. No npm packages. `cd tool && node --test` runs every test.
- Write a failing test first, then the code (CLAUDE.md). Small commits, one or more per task.
- The tool drafts. It never posts, sends or publishes anything.
- Never read a `.env` file. No secrets, no keys.
- Nothing is installed on a Mac and no launch agent is changed. The installer is run only with `--print`, by a test or by hand. Jason or the lead deploys.
- No test runs the real `claude`, ffmpeg, ffprobe, whisper, swift, `open`, `caffeinate` or Final Cut Pro: stand-ins only. One test runs the real `/bin/cp -c`, in a temp folder, on a Mac only.
- Nothing writes into a watched Dropbox folder, into the real `BRIMM Video/`, or touches a real video. Made-up clips only, in a temp folder.
- Work in this git worktree. The main checkout stays on `main`, because the launch agent `com.thebrimm.unedited` runs `tool/unedited.js` from it.
- **Old mode stays.** When this Mac has no settings, or `--watch` names a folder that is not this Mac's drop folder, the import does exactly what it does today, and every one of today's 570 tests passes unchanged. The live agent watches `Unedited Video Transfer` and has no settings until Jason runs the installer again. Old mode is removed in a later phase.
- **The rule for writing into Dropbox** (spec section 1, items 1 to 7): every file is written whole in the run's own folder on this Mac's disk, then put into Dropbox as an APFS clone under its final name by `/bin/cp -c`. An existing file is deleted first, then the new one cloned in. Nothing in Dropbox is written into, renamed or moved. There is no byte-copy fallback: where a clone cannot be made, the command stops and says why. `man cp` on this Mac says that `cp -c` itself falls back to a plain copy when the two folders are on different filesystems, so the code checks that they are on the same disk before it clones. Each file is checked right after it is copied, and again at least 15 minutes (900000 ms) after the import's last copy.
- Names, from the spec and the contract, verbatim:
  - root: this Mac's path to `The BRIMM DB/BRIMM Video`. On the Mac Studio: `/Users/jasonogden/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB/BRIMM Video`.
  - Drop folder `<root>/Unedited Video/<machine>/`, marker `.brimm-watched-by` in it holding the Mac's name.
  - Episodes `<root>/Episodes/`; status files `<root>/Episodes/.importing/<video file name> (<machine>) <n>.json`.
  - Episode folder `<YYYY-MM-DD> <file-safe stem> (<machine>)`, then `-2`, `-3` when taken on this Mac. Never renamed.
  - The record `<episode folder>/record/0001.json`, `0002.json` and on; the highest number whose file reads whole is the record.
  - The import's timeline `edit/main.v0.fcpxml`; a push `edit/main.v<v>.<machine slug>.fcpxml` ("Mac Studio" → `mac-studio`).
  - Project names `<file-safe name> main v<v> <short id>`.
  - On this Mac's disk: `~/BRIMM Video Work/<episode folder>/` with `pushed/`, `<episode folder>.fcpbundle`, `episode.lock`, `<command>.result.json`; `~/BRIMM Video Work/Backups/`; `~/BRIMM Video Work/From Final Cut/` (made by the installer for phase 2).
  - `~/Library/Application Support/BRIMM Video/`: `settings.json`, `written.json`, `pending/<episode id>.json`, `progress/` (phase P).
- Messages a person reads are whole sentences in plain words. Comments as the code around them: plain-English JSDoc that says what a thing is for.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

The five inputs most likely to bite a person that no task's main tests would otherwise meet. Each is pinned by a test in the task named.

1. **A video Dropbox has not finished bringing over** (its full size shown, no blocks yet). A person expects it left alone until it is whole, not a failed import. Pinned in Task 3 (`isWhole` with a stand-in `stat` of 1 GB and 0 blocks) and Task 8 (the import says "still arriving" and makes nothing).
2. **Dropbox undoing a copy before the late check** (a file missing or short 15 minutes later). A person expects it copied in again from the work copy; when it is still wrong, the raw video kept in the drop folder, the status file saying so, the cut plan's first lines saying so, and the video never imported twice. Pinned in Task 3 (`lateCheck`) and Task 11.
3. **The live launch agent after this is merged but before the installer is run again** (no `settings.json`; watching `Unedited Video Transfer`). A person expects today's behaviour exactly. Pinned in Task 9 (a run with no settings files into a dated folder, as today).
4. **A conflicted copy of a record or a timeline in an episode folder.** A person expects `open` and `push` to stop and name the copy, never to go on with one of the two. Pinned in Task 4 (`readEpisode`, `writeEpisode`) and Tasks 14 and 15.
5. **A second push of the main timeline with no answer to the guard, or with "yes, I trimmed it".** A person expects the push refused with the question, and a yes to stop the push and say how to work until phase 5, so that trims in Final Cut are never silently left behind. Pinned in Task 15.

---

## File structure

| File | What it is for | Task |
|---|---|---|
| `tool/names.js` (new) | File-safe names, episode folder names, a Mac's short name, short ids, project and timeline names | 1 |
| `tool/settings.js` (new) | This Mac's settings and the folders found from them; a small command line for the installer (`write`, `show`, `marker`) | 2, 12 |
| `tool/dropbox.js` (new) | The rule: `cloneIn`, `replaceIn`, `lateCheck`, `isWhole`, `waitWhole`, `textWriter` | 3 |
| `tool/episode.js` (new) | The record: shape, reading the newest, writing the next, conflicted copies, the files list, `written.json` | 4 |
| `tool/importing.js` (new) | The import status files | 5 |
| `tool/fcpxml.js` | An optional `src`; its URL helpers exported | 6 |
| `tool/portable.js` (new) | Relative media for stored timelines; the local copy's paths and `import-options`; `retitle`; `mediaIn` | 6 |
| `tool/unedited.js` | `--model` in the Claude call (7); the arrival check (8); the switch into episode mode, and the facts the record needs (9 to 11) | 7 to 11 |
| `tool/cuts.js` | `factsOf` also reads the file's creation time | 9 |
| `tool/filing.js` (new) | The episode import's own steps: finding or making the folder, cloning in, the record, the duplicate guard, the status reporter, the pending late checks | 9 to 11 |
| `tool/install.sh` | `--machine "<name>" "<root>"` | 12 |
| `tool/edit.js` (new) | The command line for episodes: `episodes`, `open`, `push`, `status`, `retry` | 13 to 16 |
| `tool/detached.js` (new) | Long commands run detached: the episode's lock, `caffeinate`, the result file | 16 |
| `tool/tests/*.test.js` | A test file for each new module; `unedited.test.js`, `fcpxml.test.js`, `install.test.js` gain tests | each |
| `README.md`, `docs/requirements.md` | "Episodes" in the README; a line in the requirements' Changes | 17 |

---

## Interfaces other phases use

Builder C (phase 2) builds on these names. Phase 1b (the architect) adds the claim, `release`, `resolve` and the studio folder.

- `names.js`: `fileSafe(text)`, `episodeFolderName(names, day, stem, machine)`, `machineSlug(machine)`, `shortId(id)`, `projectName({ name, part, v, id })`, `timelineFile({ part, v, machine })`; `part` is `"main"` or `{ reel: n }`.
- `settings.js`: `readSettings(home) → { settings } | { why }`, `dropFolder(root, machine)`, `episodesFolder(root)`, `importingFolder(root)`, `workFolder(home)`, `fromFinalCutFolder(home)`, `backupsFolder(home)`, `episodeWork(home, folder)`, `pushedFolder(home, folder)`, `libraryFor(home, folder)`, `writtenFile(home)`, `pendingFolder(home)`.
- `dropbox.js`: `LATE_CHECK_MS`, `cloneIn(from, to, opts)`, `replaceIn(from, to, opts)`, `lateCheck(entries, opts) → problems[]`, `isWhole(path, opts)`, `waitWhole(paths, opts)`, `textWriter({ work, keep, ...opts }) → (to, text, { replace }) → { from, to, bytes }`. `cloneIn` takes files only, and `to` must not exist.
- `episode.js`: `readEpisode(folder) → { record, file } | { why, code }`, `writeEpisode(folder, record, { expectRev, writeText, writer, home })`, `filesProblems(folder, record, opts)`, `conflictedCopies(folder)`, `undone(record, home)`, `localStamp()`, `newId(day)`.
- `edit.js`: `editMain(argv, deps)`; `findEpisode(ctx, said)`; `pushPart(ctx, found, { part, xml, noHandEdits, handEdits })` (the guard, the version, the stored file, the local copy, `pushed[]`, `openApp`), for `push main` here and `push reel <n>` in phase 2.
- `detached.js`: `startDetached(ctx, { command, folder, args })`, `runDetached({ home, folder, command, keepAwake, alive, now }, work)`, `resultFile(home, folder, command)`, `readResult(home, folder, command)`, `runningCommand(home, folder, alive)`.
- The record at the import, beyond the spec's example: `reels` from the clips the import cut, `{ n, status: "candidate", from, to, title, why, files, pushed: [] }`; `title` from the cut plan's `claude.title` when phase 2's `notes.js` gives one, `{ text, from: "claude", approved: false }`, and null otherwise; `archived: null`.

## What 1a leaves to other phases, and stubs

- **The claim, take-over, `release`, `resolve`** are phase 1b's (spec section 7). In 1a `open` claims nothing, and nothing writes `editing` or `released`. The helpers for them stay in `episode.js` from the draft, untested by any command. See "The lead's answers", item 1.
- **The title, `reel pick`, `push reel <n>`, `finish`, `From Final Cut/`** are phase 2's. 1a writes `title` and `reels` into the first record as above, makes the `From Final Cut` folder at install, and exposes `pushPart`.
- **`pull` does not exist** until phase 5. A "yes, I trimmed it" at the guard stops the command, as the spec's section 4 says.
- **The skill, `~/BRIMM Video Studio`, its settings** are phase 1b's. In 1a `edit.js` prints its own next-step lines, which a Claude session on the Mac Studio reads.
- **The "keep the lid open" line in the panel** is for her laptop: phase 1b.
- **The start timecode of phone files** (spec section 2) is not built: Zoom files carry none, and phase 0 settles how Final Cut reads it. The asset's `start` stays `0s`, as today.

### Phase 0 facts: settled on 2026-10-14, and still open

Phase 0 ran on the Mac Studio with Final Cut Pro 12.4 on 2026-10-14 (the spec has every finding). The follow-up to this plan, after PR #11, applies them.

| Question | What phase 0 found, and what the tool does |
|---|---|
| A relative `src`, or `base url` | Settled (A1, A2): both work. Stored timelines keep a relative `src`; the copy handed to Final Cut names whole paths. |
| `copy assets` 0 when the Import setting says to copy | Settled (A3): honoured; the library holds a link to the video. A stored file opened by a double-click follows the Import setting and copies, so episodes are opened through Claude. |
| "Replace or keep both" on a second push | Settled (A4, A4c): a new project in the same event asks nothing, so every push of an episode goes into one event named for the episode folder; a name the library holds asks even with `suppress warnings`, so a push's version is above any this Mac has handed over. |
| `library location` with or without a slash at its end | Settled: without works, and is what is written. |
| Library backups set other than by hand | Ruled by the lead (B4): backups stay on Final Cut's default, in `~/Movies` (Dropbox on the Mac Studio), since a library set to `~/BRIMM Video Work/Backups` wrote none there; no push or open speaks of them, and the finish's exports keep the hand work. The `Settings.plist` reader is kept, unused. Open: what a missing `backupsEnabled` means. |
| An iPhone video's colour (B3) | Settled: HDR, "9-18-9 (Rec. 2020 HLG)", with no start timecode. The video's format names the colour space ffprobe finds. |
| Whether a clone into Dropbox's File Provider folder is safe | Open: checked by hand after the deploy (deployment note). |
| Pushes while Final Cut is closed | Open: by hand on the Mac Studio, when Final Cut can be quit: a push with Final Cut quit first, and a second push into the same library after Final Cut has closed it. |
| An iPhone clip's sound (B3) | Settled: APAC beside AAC; the import maps the first sound its ffmpeg can read, and refuses a file whose only sound is APAC. |

## The lead's answers and changes (2026-10-14, approving df60480)

1. **`release`**: left out of 1a, with the claim. The spec is right.
2. **The model**: a constant, `CLAUDE_MODEL = "claude-opus-5-5"`.
3. **The status file**: the step only, no percent.

Changes, folded into their tasks below:

- **A.** In episode mode the run's own folder is `~/BRIMM Video Work/.runs/<pid>-<time>/`, not the temp folder, so a pending late check after a restart still has its work copies (macOS may clear `$TMPDIR`). Same disk, so the clone rule is unchanged. Old mode keeps the temp folder. (Tasks 9 and 11.)
- **B.** At filing, the "Ready: … open …" banner shows and the panel closes. The wait for the late check runs quietly; the log says when the check is due. A banner shows only when the late check finds a problem: `Dropbox lost a file of Talk. The video stays in the drop folder; see the log.` (Task 11.)
- **C.** The duplicate guard matches by name and size, before ffprobe, with a comment saying the spec says size and length and why size is enough here. (Task 10.)
- **D, E, F.** The deployment note checks that this Mac's Claude Code accepts the model; puts the clone test's file in `BRIMM Video/Clone test (delete after)/` and says to delete it after the hour; and checks that `Unedited Video Transfer` is empty before the installer runs. The README names the new drop folder in its first lines. (Task 17 and the note.)

---

### Task 1: `names.js`

**Files:** Create `tool/names.js`, `tool/tests/names.test.js`.

**From the draft** `task-01-names.md` at 03bd414: `fileSafe`, `machineSlug` and their tests as they are. Changed:

- `episodeFolderName(names, day, stem, machine)` always carries the Mac's name (spec section 1, item 3: "The Mac's name is always there, because two Macs importing at the same time cannot see each other's new folder in time"): `<day> <fileSafe(stem)> (<machine>)`, and when that is taken on this Mac, `-2`, `-3` after it. Taken is compared in NFC and lower case, as in the draft.
- New: `shortId(id)`, `projectName({ name, part, v, id })`, `timelineFile({ part, v, machine })`.

**Interfaces:** Produces `fileSafe(text) → string`, `episodeFolderName(names, day, stem, machine) → string`, `machineSlug(machine) → string`, `shortId(id) → string`, `projectName({ name, part, v, id }) → string`, `timelineFile({ part, v, machine }) → string` (a path from the episode folder, with `/`).

- [ ] **Step 1: Write the failing test.** The draft's `tool/tests/names.test.js`, with its folder-name block replaced by:

```js
describe("the name of a new episode's folder", () => {
  it("is the day, the file-safe form of the video's name and this Mac's name", () => {
    assert.equal(episodeFolderName([], "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)");
    assert.equal(episodeFolderName([".importing"], "2026-10-14", "Pricing: what to charge?", "Mac Studio"), "2026-10-14 Pricing- what to charge- (Mac Studio)");
  });
  it("gets -2, -3 and so on when that is taken on this Mac", () => {
    const names = ["2026-10-14 Pricing talk (Mac Studio)"];
    assert.equal(episodeFolderName(names, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-2");
    names.push("2026-10-14 Pricing talk (Mac Studio)-2");
    assert.equal(episodeFolderName(names, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-3");
  });
  it("is never the one the other Mac took for a video of the same name on the same day", () => {
    const taken = ["2026-10-14 Pricing talk (Sallie's laptop)"];
    assert.equal(episodeFolderName(taken, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)");
  });
  it("counts a name as taken whatever its case and however its accents are written", () => {
    assert.equal(episodeFolderName(["2026-10-14 PRICING TALK (mac studio)"], "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-2");
    assert.equal(episodeFolderName(["2026-10-14 Café talk (Mac Studio)"], "2026-10-14", "Café talk", "Mac Studio"), "2026-10-14 Café talk (Mac Studio)-2");
  });
  it("is the day, video and the Mac's name when nothing is left of the video's name", () => {
    assert.equal(episodeFolderName([], "2026-10-14", " \t ", "Mac Studio"), "2026-10-14 video (Mac Studio)");
  });
});

describe("the names a push gives", () => {
  it("has the short id, the last six characters of the episode's id", () => {
    assert.equal(shortId("e-20261014-3fa9c1"), "3fa9c1");
  });
  it("names a project by the file-safe name, the part, the version and the short id", () => {
    assert.equal(projectName({ name: "Pricing: what to charge?", part: "main", v: 3, id: "e-20261014-3fa9c1" }), "Pricing- what to charge- main v3 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: { reel: 2 }, v: 1, id: "e-20261014-3fa9c1" }), "Pricing talk reel 2 v1 3fa9c1");
  });
  it("names the timeline kept in edit/ by the part, the version and the Mac, and the import's own as version 0", () => {
    assert.equal(timelineFile({ part: "main", v: 0 }), "edit/main.v0.fcpxml");
    assert.equal(timelineFile({ part: "main", v: 3, machine: "Mac Studio" }), "edit/main.v3.mac-studio.fcpxml");
    assert.equal(timelineFile({ part: { reel: 2 }, v: 1, machine: "Sallie's laptop" }), "edit/reel-2.v1.sallies-laptop.fcpxml");
  });
});
```

- [ ] **Step 2: Run it and see it fail.** `cd tool && node --test tests/names.test.js` → FAIL, `Cannot find module '…/tool/names.js'`.
- [ ] **Step 3: Write `tool/names.js`.** The draft's code, with `episodeFolderName` and the three new functions as:

```js
export function episodeFolderName(names, day, stem, machine) {
  const taken = new Set(names.map(sameAs));
  const first = `${day} ${fileSafe(stem)} (${machine})`;
  let name = first;
  for (let n = 2; taken.has(sameAs(name)); n++) name = `${first}-${n}`;
  return name;
}

/** The short id of an episode: the last six characters of its id, which go into the names of its projects in Final Cut, so
    that two episodes of one name are told apart. */
export const shortId = (id) => String(id).slice(-6);

/** The name of a part as it goes into a name: "main", or "reel 2". */
const partName = (part) => (part === "main" ? "main" : `reel ${part.reel}`);

/** The name a push gives its project in Final Cut, as "Pricing talk main v3 3fa9c1". Share and File > Export XML… name their
    files after the project, so the push records it and files are found by it, never by the episode's current name. */
export const projectName = ({ name, part, v, id }) => `${fileSafe(name)} ${partName(part)} v${v} ${shortId(id)}`;

/** Where a timeline is kept in an episode's folder, as a path from it: the import's own as "edit/main.v0.fcpxml", and a push
    as "edit/main.v3.mac-studio.fcpxml", with the Mac's short name, so the two Macs never write the same file. */
export function timelineFile({ part, v, machine }) {
  const kind = part === "main" ? "main" : `reel-${part.reel}`;
  return v === 0 ? `edit/${kind}.v0.fcpxml` : `edit/${kind}.v${v}.${machineSlug(machine)}.fcpxml`;
}
```

- [ ] **Step 4: Run it and see it pass**, then the whole suite. `cd tool && node --test tests/names.test.js` then `cd tool && node --test` → 0 fail.
- [ ] **Step 5: Commit** `tool/names.js`, `tool/tests/names.test.js`: "Name episode folders, projects and timelines (names.js)".

---

### Task 2: `settings.js`

**Files:** Create `tool/settings.js`, `tool/tests/settings.test.js`.

**From the draft** `task-02-settings.md` at 03bd414: the module and its tests, with these changes to the merged design:

- No `sharedFolder` and `exportsFolder`: one local folder, `fromFinalCutFolder(home)` = `~/BRIMM Video Work/From Final Cut` (spec rule 6).
- New folder helpers: `backupsFolder(home)` (`~/BRIMM Video Work/Backups`), `pushedFolder(home, folder)` (`~/BRIMM Video Work/<folder>/pushed`), `writtenFile(home)` (`~/Library/Application Support/BRIMM Video/written.json`), `pendingFolder(home)` (`~/Library/Application Support/BRIMM Video/pending`), `runsFolder(home)` (`~/BRIMM Video Work/.runs`, the lead's change A).
- No `claudeModel` (the lead's answers, item 2): the settings are `{ version: 1, machine, root, checkout }`; `--claude-model` is not an option of `write`; `show` has no model line. A field a later version adds is still kept as it is.
- `show` lists `From Final Cut` beside `Work in Final Cut`.
- The `marker` command is added in Task 12, where `dropbox.js` is at hand.

- [ ] **Step 1: Write the failing test.** The draft's test file with the changes above: the folders test names `fromFinalCutFolder`, `backupsFolder`, `pushedFolder`, `writtenFile`, `pendingFolder`; each `{ …, claudeModel: … }` in an expected object is taken out, and the two tests of the model are replaced by one: "keeps a field it does not know, such as claudeModel, as it is" (written by hand into the file, read back). The `show` test expects `"  From Final Cut:  <home>/BRIMM Video Work/From Final Cut"` as its last line.
- [ ] **Step 2: Run it and see it fail** (`Cannot find module '…/tool/settings.js'`).
- [ ] **Step 3: Write `tool/settings.js`**: the draft's code with `claudeModel` taken out of `settingsFault`, `writeSettings`, `WRITTEN`, `HELP` and `show`, and the folder helpers as listed.
- [ ] **Step 4: Run it and see it pass**, then the whole suite.
- [ ] **Step 5: Commit**: "Keep this Mac's settings for episodes, and find its folders from them (settings.js)".

---

### Task 3: `dropbox.js`, the rule

**Files:** Create `tool/dropbox.js`, `tool/tests/dropbox.test.js`.

**From the draft** `task-03-dropbox.md` at 03bd414: `isWhole`, `waitWhole`, the shape of `lateCheck` and `textWriter`, `cloneFile`, and their tests. Changed to the merged design (spec rule items 1 and 2) and to what `man cp` says:

- **No fallback.** `plainCopy` and every `fallback` option go. `cloneIn` clones or throws.
- **Same disk first.** `cp -c` copies byte for byte, without a word, when the two folders are on different filesystems. So `cloneIn` checks `statSync(from).dev === statSync(dirname(to)).dev` first (an option `sameDisk(from, folder)` for tests) and throws `<file> could not be put into <folder>: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was copied.` when they differ.
- **`to` must not exist.** `cloneIn` throws `<file> is in <folder> already, and a file there is never written over.` when it does. `replaceIn(from, to, opts)` deletes `to` first (`rmSync`, force) and then calls `cloneIn` (spec: "deletes the old file first and then clones the new one in").
- **The late check's wait is the caller's.** Export `LATE_CHECK_MS = 15 * 60 * 1000`. `lateCheck` re-copies a missing or short file with `replaceIn`, since a short one is there.
- **`textWriter({ work, keep, clone, sameDisk, log })`** returns `(to, text, { replace = false } = {})`, which uses `replaceIn` when `replace` is true and `cloneIn` otherwise.
- **`isWhole` also asks the file's flags.** The spec counts a file whole when its blocks cover its size **or** `stat -f %Xf` shows no dataless flag. So when the blocks do not cover the size (as for a file APFS has compressed), `isWhole` asks `flags(path)` (real: `spawnSync("/usr/bin/stat", ["-f", "%Xf", path])`, read as hex) and counts the file whole when the `SF_DATALESS` bit, `0x40000000`, is not set. A `flags` that fails counts as not whole.

**Interfaces:** Produces `LATE_CHECK_MS`, `cloneFile(from, to)`, `onSameDisk(from, folder)`, `cloneIn(from, to, { clone, sameDisk, log }) → void`, `replaceIn(from, to, opts) → void`, `lateCheck(entries, opts) → string[]`, `isWhole(path, { stat, flags }) → boolean`, `waitWhole(paths, { wait, tries, stat, flags }) → Promise<{ whole, notYet }>`, `textWriter({ work, keep, clone, sameDisk, log }) → (to, text, { replace }) → { from, to, bytes }`.

- [ ] **Step 1: Write the failing test.** The draft's tests, less the three that test a fallback ("copied in instead…", "is copied in instead when the clone left it short", and the plain copy), and with these:

```js
describe("a file copied into Dropbox by the rule", () => {
  it("is cloned in under its final name, and its work copy is kept for the late check", () => { /* the draft's first test; cloneIn now gives back nothing */ });
  it("is never copied byte for byte: a clone that fails stops it, and nothing is left under its name", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    assert.throws(() => cloneIn(from, join(t.dest, "talk.mp4"), { ...t.opts, clone: refused }), { message: `talk.mp4 could not be put into ${t.dest}: cloning is not possible there. Nothing was copied.` });
    assert.deepEqual(readdirSync(t.dest), []);
    t.done();
  });
  it("is not cloned at all when the run's folder and Dropbox are on different disks, where cp -c would copy it byte for byte", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    assert.throws(() => cloneIn(from, join(t.dest, "talk.mp4"), { ...t.opts, sameDisk: () => false }), { message: `talk.mp4 could not be put into ${t.dest}: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was copied.` });
    assert.deepEqual([t.copies, readdirSync(t.dest)], [[], []]);
    t.done();
  });
  it("is refused when a file of its name is there already: a file in Dropbox is never written over", () => {
    const t = setup();
    writeFileSync(join(t.dest, "talk.mp4"), "the old video");
    assert.throws(() => cloneIn(t.made("talk.mp4", "a video"), join(t.dest, "talk.mp4"), t.opts), { message: `talk.mp4 is in ${t.dest} already, and a file there is never written over.` });
    assert.equal(readFileSync(join(t.dest, "talk.mp4"), "utf8"), "the old video");
    t.done();
  });
  it("replaces a file by deleting it first and then cloning the new one in", () => {
    const t = setup();
    const to = join(t.dest, "talk.cut-plan.txt");
    writeFileSync(to, "the old plan");
    const seen = [];
    replaceIn(t.made("talk.cut-plan.txt", "the new plan"), to, { ...t.opts, clone: (from, into) => { seen.push(existsSync(into)); copyFileSync(from, into); } });
    assert.deepEqual([seen, readFileSync(to, "utf8")], [[false], "the new plan"]);
    t.done();
  });
});

describe("a file Dropbox may still be bringing over", () => {
  // The draft's three tests, with `flags: () => 0x40000000` given where a placeholder is meant, and:
  it("is whole when its blocks do not cover its size but the disk does not mark it dataless, as for a file APFS compressed", () => {
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 8 }), flags: () => 0x20 }), true);
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 0 }), flags: () => 0x40000000 }), false);
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 0 }), flags: () => { throw new Error("stat failed"); } }), false);
  });
});

describe("the late check", () => {
  // The draft's three tests, with the fallback taken out of their expected logs, and:
  it("is made at least 15 minutes after the last copy: LATE_CHECK_MS is 900000", () => {
    assert.equal(LATE_CHECK_MS, 900000);
  });
});
```

The Mac-only test of the real `/bin/cp -c` stays, changed to: clone into an empty folder; `replaceIn` a longer file over it (new inode, new bytes); `cloneFile` of a missing file throws in cp's words.

- [ ] **Step 2: Run it and see it fail** (`Cannot find module '…/tool/dropbox.js'`).
- [ ] **Step 3: Write `tool/dropbox.js`.** The draft's code for `cloneFile`, `wrong`, `isWhole`, `waitWhole`, with these in place of its `cloneIn`, `lateCheck` and `textWriter`:

```js
/** How long after the last copy into Dropbox the late check is made: 15 minutes. On 2026-10-14 Dropbox undid two renames
    minutes after they had returned. */
export const LATE_CHECK_MS = 15 * 60 * 1000;

/** Whether a file and a folder are on one disk, where a clone can be made. cp -c copies byte for byte, and says nothing,
    when they are not. */
export const onSameDisk = (from, folder) => statSync(from).dev === statSync(folder).dev;

/** Put the whole work copy at `from` into Dropbox at `to`, under its final name, as a clone, by the rule. The folder must be
    there, and on the same disk as the work copy; nothing must be under that name. Then the file is looked at, and must be
    the work copy's size. The work copy is kept for the late check. Throws, saying why in plain words, when the file is not
    there whole, and leaves nothing under its name. */
export function cloneIn(from, to, { clone = cloneFile, sameDisk = onSameDisk, log = () => {} } = {}) {
  const folder = dirname(to);
  const name = basename(to);
  if (existsSync(to)) throw new Error(`${name} is in ${folder} already, and a file there is never written over.`);
  if (!sameDisk(from, folder)) throw new Error(`${name} could not be put into ${folder}: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was copied.`);
  const bytes = statSync(from).size;
  let why = "";
  try {
    clone(from, to);
    why = wrong(to, bytes);
  } catch (e) {
    why = e.message.replace(/\.$/, "");
  }
  if (!why) return;
  try {
    rmSync(to, { force: true });
  } catch (stays) {
    // What is there is not a file, and nothing was cloned into it.
  }
  log(`${name} could not be put into ${folder}: ${why}.`);
  throw new Error(`${name} could not be put into ${folder}: ${why}. Nothing was copied.`);
}

/** Put a new file in place of one in Dropbox: the old one is deleted first, and the new one cloned in (cloneIn), so nothing
    is written into a file there or renamed over it. */
export function replaceIn(from, to, opts = {}) {
  rmSync(to, { force: true });
  cloneIn(from, to, opts);
}

export function lateCheck(entries, opts = {}) {
  const { log = () => {} } = opts;
  const problems = [];
  for (const { from, to, bytes } of entries) {
    const why = wrong(to, bytes);
    if (!why) continue;
    if (!existsSync(from)) {
      problems.push(`${basename(to)} is not whole in ${dirname(to)} (${why}), and its work copy is gone, so it could not be copied in again.`);
      continue;
    }
    log(`${basename(to)} is not whole in ${dirname(to)} at the late check (${why}), so it is copied in again from its work copy.`);
    try {
      replaceIn(from, to, opts);
    } catch (e) {
      problems.push(e.message);
    }
  }
  return problems;
}

export function textWriter({ work, keep = false, ...opts }) {
  return (to, text, { replace = false } = {}) => {
    mkdirSync(work, { recursive: true });
    written += 1;
    const from = join(work, `${process.pid}-${written}-${basename(to)}`);
    writeFileSync(from, text);
    try {
      (replace ? replaceIn : cloneIn)(from, to, opts);
      return { from, to, bytes: statSync(from).size };
    } finally {
      if (!keep) rmSync(from, { force: true });
    }
  };
}
```

and `isWhole` as:

```js
/** The flag macOS sets on a file whose data is not on this Mac yet (sys/stat.h). */
const SF_DATALESS = 0x40000000;
/** The file's flags, as `stat -f %Xf` prints them, in hex. */
const fileFlags = (path) => {
  const ran = spawnSync("/usr/bin/stat", ["-f", "%Xf", path], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(lastLine(ran.stderr));
  return parseInt(ran.stdout.trim(), 16);
};
export function isWhole(path, { stat = statSync, flags = fileFlags } = {}) {
  let found;
  try {
    found = stat(path);
  } catch (e) {
    return false;
  }
  if (found.blocks * 512 >= found.size) return true;
  try {
    return (flags(path) & SF_DATALESS) === 0;
  } catch (e) {
    return false;
  }
}
```

- [ ] **Step 4: Run it and see it pass**, then the whole suite. On GitHub's runner the `cp -c` test skips itself.
- [ ] **Step 5: Commit**: "Add the rule for writing into Dropbox: clone in on one disk, never over a file, check late (dropbox.js)".

---

### Task 4: `episode.js`, the record

**Files:** Create `tool/episode.js`, `tool/tests/episode.test.js`.

**From the draft** `task-04-episode-record.md` at 03bd414: `newId`, `localStamp`, `shown`, `newEpisode`, `episodeFault`, `conflictedCopies`, `filesProblems` with `otherNames`, `heldElsewhere`, `claimed`, `released`, and their tests. Changed to the merged design (spec section 1, "The record"):

- **`record/NNNN.json`, a new file at each change, never replaced.** No `EPISODE_FILE`. `RECORD_DIR = "record"`, `RECORD_VERSION = 1`, `recordFile(folder, rev)` = `<folder>/record/<rev, 4 digits>.json`.
- **`readEpisode(folder)`** lists `record/`; stops on any conflicted copy in the folder (as the draft); takes the highest-numbered `NNNN.json` that parses, passes `episodeFault`, and whose `rev` equals its number. Gives `{ record, file }`, or `{ why, code }` with `code` one of `CONFLICTED`, `NONE` (no whole record: an import that has not finished, or not an episode), `UNREADABLE` (the folder cannot be read). A record of a `version` above `RECORD_VERSION` is read and given back with `newer: true`, its fields not checked beyond `id` and `rev`: `episodes` and `open` can show it, and nothing writes it.
- **`writeEpisode(folder, record, { expectRev, writeText, writer, home })`**: refuses (`code: "NEWER"`, "Jason has a newer brimm-video. Ask him to update this Mac.") a record of a newer version; refuses a conflicted copy (`CONFLICTED`); lists `record/` again and refuses (`CHANGED`, "this episode changed on the other Mac: open it again") when any `NNNN.json` above `expectRev` is there, whole or not; makes `record/` when it is not there; writes `record/<expectRev + 1>.json` through `writeText` (which clones it in and never replaces); notes the rev in `written.json` (`{ "<id>": rev }`, written whole on this Mac's disk under another name and renamed); gives back the record written. Fields it does not know are kept (the record is spread, never rebuilt).
- **`lastWritten(home, id)`** and **`undone(record, home) → "" | why`**: when the newest record's `rev` is below the one this Mac last wrote: `Dropbox undid this Mac's last change to <name>. Say it again.`
- **`newEpisode`** gains `title` and `reels` arguments and an `archived: null` field (the contract's record); `rev` is 0 until written; `files` lists every file brimm-video put in the folder, not the record files.
- `filesProblems` also names files in the folder that look like another name for a listed one (`.writing`, ` (1)`, a conflicted copy), as the draft's `otherNames` does, and leaves `record/` out of what it compares.

**Interfaces:** Produces `RECORD_DIR`, `RECORD_VERSION`, `recordFile`, `newId(day, rand)`, `localStamp(date)`, `shown(at)`, `newEpisode({ id, machine, at, video, kind, writer, files, title, reels })`, `episodeFault(r)`, `recordText(r)`, `readEpisode(folder)`, `conflictedCopies(folder)`, `writeEpisode(folder, record, opts)`, `lastWritten(home, id)`, `undone(record, home)`, `filesProblems(folder, record, { stat })`, `heldElsewhere`, `claimed`, `released`. Consumes `writtenFile(home)` from Task 2.

- [ ] **Step 1: Write the failing test.** The draft's tests of `newId`, `localStamp`, `newEpisode`, `episodeFault`, `conflictedCopies` and `filesProblems`, moved to `record/`, and these new ones (a stand-in `writeText` that writes with `writeFileSync` and refuses an existing file, as `cloneIn` does):

  - "reads the highest whole record, and skips a higher one that is not whole yet, as while Dropbox brings it over" (`0001.json`, `0002.json` whole, `0003.json` holding `{"rev":`): gives rev 2.
  - "says the import has not finished when there is no whole record" → `code: "NONE"`.
  - "writes each change as a new file with the next number, and never touches the one before" (rev 1 → `0002.json`, `0001.json` byte for byte as it was).
  - "keeps a field it does not know as it found it" (`later: { x: 1 }` round-trips).
  - "writes nothing, and says the other Mac changed it, when a record above the one it read is there, whole or not" → `code: "CHANGED"`, message `this episode changed on the other Mac: open it again`.
  - "writes nothing while Dropbox keeps a conflicted copy of a record" (`record/0002 (Jason Ogden's conflicted copy 2026-10-14).json`) → `CONFLICTED`, and `readEpisode` names the copy.
  - "reads a record of a newer layout, and never writes one" (`version: 2`) → `readEpisode` gives `newer: true`; `writeEpisode` throws `NEWER` with "Jason has a newer brimm-video. Ask him to update this Mac."
  - "notes in written.json the rev this Mac wrote, and says Dropbox undid it when the newest record is older" (write rev 2, delete `0002.json`, `undone` → `Dropbox undid this Mac's last change to Pricing talk. Say it again.`; with `0002.json` there, `""`).
  - "names a file missing, short, or kept under another name, and leaves the record files out" (the draft's `filesProblems` test with `record/` present).
- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Write `tool/episode.js`**: the draft's code for the parts kept, and `readEpisode`, `writeEpisode`, `lastWritten`, `undone` as described. `writeEpisode`'s check of the folder and its write are one after the other with nothing between them that waits.
- [ ] **Step 4: Run it and see it pass**, then the whole suite.
- [ ] **Step 5: Commit**: "Add episode.js: the record as a new file for each change (record/NNNN.json)".

---

### Task 5: `importing.js`, the import status files

**Files:** Create `tool/importing.js`, `tool/tests/importing.test.js`.

**From the draft** `task-05-import-status-files.md` at 03bd414: `STALE_MS`, `statusFault`, `importState`, `holdsVideo`, `leftByCrash`, and their tests. Changed to the merged design (spec section 1, "What the import writes", item 1):

- **A new file at each write, named with the Mac**: `statusName(video, machine, n)` = `<video> (<machine>) <n>.json`. `writeStatus(root, status, writeText)` finds the highest `n` this Mac has for the video, writes `n + 1` through `writeText` (a new file, never replacing), and then deletes the one before. So nothing in Dropbox is written into.
- **`readStatuses(root, now) → [{ file, status, stale, n }]`**: the highest `n` for each video and Mac, and a line for each that cannot be read.
- **`removeStatus(root, video, machine)`** removes every `n` of that video and Mac.
- The status gains `pid` (the run's process number, for this Mac to tell its own live run from one that stopped), beside the draft's fields.

**Interfaces:** Produces `STALE_MS`, `statusName`, `statusFault`, `writeStatus`, `readStatuses`, `removeStatus`, `importState`, `holdsVideo`, `leftByCrash`. Consumes `importingFolder(root)` from Task 2.

- [ ] **Step 1: Write the failing test.** The draft's tests, moved to the new names, and:
  - "writes each status as a new file with the next number, and deletes the one before" (writes 1, 2, 3; only `Talk.mp4 (Mac Studio) 3.json` is left; each written by `writeText` to a name not there before).
  - "keeps the two Macs' status files of one video apart" (Mac Studio's 2 and Sallie's laptop's 1 both read).
  - "reads the highest number of each, and leaves an older one Dropbox has not yet deleted out" (`… 4.json` and `… 5.json` → one entry, `n: 5`).
  - "removes every file of one video and one Mac, and leaves the other Mac's".
- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Write `tool/importing.js`**: the draft's code with the changes above.
- [ ] **Step 4: Run it and see it pass**, then the whole suite.
- [ ] **Step 5: Commit**: "Add importing.js: a new status file at each write, named with the Mac".

---

### Task 6: `fcpxml.js` `src`, and `portable.js`

**Files:** Modify `tool/fcpxml.js`, `tool/tests/fcpxml.test.js`; create `tool/portable.js`, `tool/tests/portable.test.js`.

**From the draft** `task-06-portable.md` at 03bd414, as it stands, but one line: `withImportOptions` writes `library location` as `libraryUrl(library)`, with no slash at its end, the one form Final Cut Pro 12.4 has opened (README, "The Final Cut file"). Its test changes to match. `portable.js`'s first comment says that a relative `src` and `base url` are phase 0 facts still pending, and that the local copy names whole paths so works either way.

**Interfaces:** as the draft: `fcpxml({ …, src })`, `fileUrl`, `relativeUrl`, `libraryUrl`, `attribute` from `fcpxml.js`; `relativeMedia`, `localMedia`, `withImportOptions(xml, { library, copyAssets = false, suppressWarnings = true })`, `retitle(xml, { event, project })`, `mediaIn(xml, from)` from `portable.js`.

- [ ] **Step 1–2:** the draft's tests, with the one expectation changed: `<option key="library location" value="file:///Users/sallie/BRIMM%20Video%20Work/2026-10-14%20Pricing%20talk%20(Mac%20Studio)/2026-10-14%20Pricing%20talk%20(Mac%20Studio).fcpbundle"/>`. Run, see them fail.
- [ ] **Step 3:** the draft's code, with that line.
- [ ] **Step 4:** run them and the whole suite: every test of today's `fcpxml.test.js` passes unchanged.
- [ ] **Step 5: Commit**: "Name a stored timeline's video from the file, and give Final Cut a local copy with this Mac's paths (portable.js)".

---

### Task 7: the model named in the Claude call

**Files:** Modify `tool/unedited.js`, `tool/tests/unedited.test.js`.

**Interfaces:** Produces `CLAUDE_MODEL` (exported from `unedited.js`). `CLAUDE_ARGS` gains `"--model", CLAUDE_MODEL` before `--output-format`.

- [ ] **Step 1: Write the failing test.** Change the expectation at `tests/unedited.test.js:1012` to `["-p", "--model", CLAUDE_MODEL, "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--setting-sources", "", "--output-format", "json"]`, and add: "names its model, so that both Macs read a plan with the same one" (`CLAUDE_MODEL === "claude-opus-5-5"`). This changes a test of today's mode on purpose: the spec puts the model in every call. The README's line of the call (line 124) and the memory note change with it in Task 17.
- [ ] **Step 2: Run, see it fail.**
- [ ] **Step 3:** in `unedited.js`:

```js
/** The Claude model the plan is read with. It is named, and not left to the account's default, so that both Macs pick the
    same clips and Reels for the same plan, and a change of default does not change what is picked. */
export const CLAUDE_MODEL = "claude-opus-5-5";
const CLAUDE_ARGS = ["-p", "--model", CLAUDE_MODEL, "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--setting-sources", "", "--output-format", "json"];
```

- [ ] **Step 4: Run it and the whole suite.**
- [ ] **Step 5: Commit**: "Name the Claude model in the call, so both Macs read a plan with one model".

---

### Task 8: the arrival check

**Files:** Modify `tool/unedited.js`, `tool/tests/unedited.test.js`.

A video counts as arrived only when its size has settled **and** it is whole (`isWhole`, Task 3). Today's loop in `workOn` (lines 594–602) looks at the size alone; a Dropbox placeholder shows its full size from the first look. This applies in both modes: for a whole file it changes nothing, so today's tests stay as they are.

**Interfaces:** Consumes `isWhole` from Task 3. `deps.isWhole` (default `isWhole`) for tests.

- [ ] **Step 1: Write the failing tests** in the `describe` of a file that is still arriving:
  - "waits for a video Dropbox shows at its full size with no data yet, and takes it once it is whole" (`sizes: [7, 7, 7]`, `isWhole` false at the first two looks, true at the third: two waits of 5000, then the run goes on).
  - "leaves a placeholder for the next time after as many looks as a growing file, and makes nothing" (`isWhole` always false: `{ ok: false, arriving: true }`, the log line `still arriving. It is taken the next time the folder changes.`, no files beside the video, no call to ffprobe).
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3:** in `workOn`, `const whole = deps.isWhole || isWhole;` and the loop `while (!settled(sizes) || !whole(file))`, with the same limit and wait.
- [ ] **Step 4: Run them and the whole suite.**
- [ ] **Step 5: Commit**: "Take a video only when Dropbox has brought all of it over".

---

### Task 9: the episode import, filing a video into its episode

**Files:** Create `tool/filing.js`, `tool/tests/filing.test.js`; modify `tool/unedited.js`, `tool/cuts.js`, `tool/tests/unedited.test.js`, `tool/tests/cuts.test.js`.

When this Mac has settings and `--watch` names its drop folder (`dropFolder(root, machine)`, after `resolve`), `uneditedFolder` hands each video to the episode import. Everything is made as today, held in the run's own folder (`filesOf(work, { hold: true })`), and then filed: the episode folder made (or reused), the raw video cloned in from the drop folder, each made file cloned in, the Final Cut file as `edit/main.v0.fcpxml` naming its video `../<video>` and no library, and `record/0001.json` last. The run's folder is kept for the late check (Task 11). Nothing is renamed or moved in Dropbox.

**Interfaces:**
- `cuts.js`: `factsOf(printed)` also gives `created`: the format's `creation_time` tag as an ISO string, or null. Today's tests stay green (they compare named fields).
- `filing.js` produces:
  - `episodeMode(dir, settings) → boolean`.
  - `episodeKind(facts) → "episode" | "short video"`: a short video when the picture is not wider than it is tall, or the video is under 90 seconds; a file with no picture is an episode.
  - `findFolder(episodes, video, machine, day) → { name, reused }`: a folder of this Mac's whose record is not whole and that holds this video under its name at its size, or none of it yet, is reused (spec item 2); otherwise a new name by `episodeFolderName`.
  - `fileEpisode({ dropped, held, facts, plan, read, cut, made }, deps) → { folder, record, entries }`: makes the folder (`mkdirSync`, as the spec allows), clones in the raw video and each held file (`cloneIn`, or `replaceIn` when reused), the Final Cut file to `edit/main.v0.fcpxml`, builds the record with `newEpisode` (kind; `video` with `bytes`, `seconds`, `created`; `files` of every file cloned in; `reels` from `cut` for an episode; `title` from `read.title` when it is text), writes it with `writeEpisode(… { expectRev: 0, writeText: textWriter({ work, keep: true }) })` and gives back the late-check entries: `{ from, to, bytes }` for each file, the raw video's `from` being its copy in the drop folder.
  - `commitOf(checkout, run) → Promise<string>`: `git -C <checkout> rev-parse --short HEAD`, or `"unknown"`.
- `unedited.js`: `uneditedFolder(dir, deps)` checks `episodeMode(dir, deps.settings)`; `depsFor` reads the settings once (`readSettings(home)`) into `deps.settings` (null when there are none). In episode mode `workOn` gives `finalCut` a `src` of `relativeUrl("../" + name)` and no library, does not delete the run's folder in `finally` when filing gave late-check entries, and calls `fileEpisode` where today it calls `fileAway`. In episode mode the run's own folder is `~/BRIMM Video Work/.runs/<pid>-<time>/` (`runsFolder(home)` in `settings.js`), not the temp folder (the lead's change A); old mode keeps `deps.tmpDir || tmpdir()`.

- [ ] **Step 1: Write the failing tests.**
  - `cuts.test.js`: "reads the creation time ffprobe gives the file, and null when it gives none".
  - `filing.test.js` (pure parts): `episodeKind` for 1280x720 at 1834 s (episode), 1080x1920 at 600 s, 1280x720 at 60 s, 1080x1080 at 300 s (short video), no picture (episode); `findFolder` makes `2026-10-14 Talk (Mac Studio)`, `-2` when that has a whole record, and reuses one with no whole record that holds `Talk.mp4` at its size.
  - `unedited.test.js`, a new `describe("an episode imported from this Mac's drop folder")`, with `deps.settings = { version: 1, machine: "Mac Studio", root, checkout }`, `root` in the test's folder, the drop folder `<root>/Unedited Video/Mac Studio`, and a stand-in `clone` that copies (`copyFileSync`) and records each call:
    1. "files the video and everything made of it into a new folder in Episodes, named for the day, the video and this Mac": the folder's sorted names are the raw video, today's files less `.fcpxml`, `edit/main.v0.fcpxml` and `record/0001.json`.
    2. "puts every file into Dropbox by a clone from the run's own folder, the raw video from the drop folder, and the record last": the clone calls in order; none renames (a stand-in `move` that throws if called in episode mode).
    3. "writes a first record that lists every file with its size": `id` matches `/^e-20261014-[0-9a-f]{6}$/`, `rev` 1, `kind` "episode", `video` `{ file, bytes, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "import" }`, `name` `{ text: "Talk", placeholder: true }`, `files` equal to the sizes on disk, `writer.on` "Mac Studio".
    4. "names the video in edit/main.v0.fcpxml by a path from the file, and names no library": `src="../Talk.mp4"`, no `import-options`.
    5. "leaves the raw video in the drop folder, and the run's own folder in BRIMM Video Work/.runs, for the late check" (Task 11 deletes them).
    6. "takes the day the file says it was recorded when it says one" (`creation_time` 2026-10-01 → `recorded: "2026-10-01"`, `recordedFrom: "video"`).
    7. "makes a short or upright recording a short video: no upright version and no clips" (1080x1920 and a wide one of 60 s: no `.rough-cut.vertical.mp4`, no `.reel-` file, `kind: "short video"`, `reels: []`; Claude is still asked and its notes kept).
    8. "puts the clips Claude picked into the record as Reel candidates" (`{ n: 1, status: "candidate", from, to, title: <hook>, why, files: ["Talk.reel-1.mp4", "Talk.reel-1.srt"], pushed: [] }`).
    9. "says in the banner what to say to Claude next": `Ready: Talk. In Claude, say "open Talk".`
    10. "reuses the folder of an import that stopped before its record, and writes each file again" (a folder with the raw video and no `record/`: the same folder, `replaceIn` for the files there).
    11. **Review Focus 3:** "files into a dated folder as today when this Mac has no settings, or the folder is not its drop folder" (`settings: null`, and settings naming another drop folder: today's dated folder, a top-level `.fcpxml`, no `Episodes/`).
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Write `tool/filing.js`** and the changes in `unedited.js` and `cuts.js`. `fileEpisode`'s order: folder; raw video; each held file in today's `held` order with `.fcpxml` going to `edit/main.v0.fcpxml`; the record. A clone that fails throws, and the run's result says what could not be put where, as `fileAway` says it today; the drop folder keeps the video, and no record is written, so the next run reuses the folder.
- [ ] **Step 4: Run them and the whole suite.**
- [ ] **Step 5: Commit** (two commits if it reads better: `factsOf` first, then the filing): "File an imported video into its own episode folder, by clones, with its record last".

---

### Task 10: status files and the duplicate guard

**Files:** Modify `tool/filing.js`, `tool/unedited.js`, `tool/tests/unedited.test.js`, `tool/tests/filing.test.js`.

**Interfaces:**
- `filing.js`: `statusReporter(inner, { root, machine, video, bytes, writeText, now, every }) → reporter`: wraps the progress reporter (phase P) so that `begin`, each `step`, and a timer every 60 seconds (`every`, default `setInterval`, unref'd) write the status (`writeStatus`); `length(seconds)` fills `seconds`; `fail(why)` writes it with `failed`; `end()` stops the timer and leaves the file (Task 11 removes it after the late check).
- The guard matches an episode by the video's name and size, before ffprobe, with this comment (the lead's change C): the spec says size and length; size is enough here because the guard runs before ffprobe has read the length, the name must match too, and two different recordings with one name and one size to the byte are not met in practice; a length check would cost an ffprobe of every video in the drop folder at every run.
- `filing.js`: `heldBy({ episodes, root, video, bytes, now, machine }) → "" | why`: an episode whose whole record names this video at this size ("already imported as <folder>"), or a status that `holdsVideo` ("being imported on <Mac>", "its import failed on <Mac>: <why>. Say "try it again" to import it again.", "copied in, but the late check found a problem: <problem>").
- `filing.js`: `clearCrashes({ root, machine, now, alive })`: removes this Mac's stale status files with no `failed` and no `problem` whose `pid` is not running (spec: "The Mac that wrote that file removes it at its next run").

- [ ] **Step 1: Write the failing tests.**
  - "writes a status file at the start, at each step, and once a minute while a step runs" (a stand-in `every` that the test ticks; each write a new `n`; the last holds `step: "Filing"`).
  - "writes why the import failed into its status, and leaves it" (whisper fails: the status has `failed`, the drop folder keeps the video, `Episodes/` has no folder with a record).
  - "does not import a video an episode already holds, and leaves it in the drop folder" (the log: `Talk.mp4: already imported as 2026-10-14 Talk (Mac Studio). It stays in the drop folder until its late check passes, or for a person to delete.`; no ffprobe call).
  - "does not import a video another Mac's fresh status file holds".
  - **Review Focus 2, part:** "does not import a video whose import failed until someone says to try it again" (a `failed` status: nothing made; after `removeStatus`, it is imported).
  - "removes the status file a stopped run of this Mac left, and imports the video again" (stale, this Mac, dead pid: removed, imported, its folder reused).
- [ ] **Step 2–5:** run and fail; write; run and pass with the whole suite; commit "Say how far each import has got in Episodes/.importing, and never import a video twice".

---

### Task 11: the late check, and what a stopped run leaves

**Files:** Modify `tool/filing.js`, `tool/unedited.js`, `tool/tests/unedited.test.js`.

After its videos, the run waits, kept awake, until the late check of each is due (`LATE_CHECK_MS` after its last copy), looking in the drop folder once a minute meanwhile and importing what arrives. A pending check is kept on this Mac's disk, so a run that is stopped first leaves it for this Mac's next run, which does it first.

**Interfaces:**
- `filing.js`: `pendingFile(home, id)`; `writePending(home, pending)`; `readPendings(home) → pending[]`; a pending is `{ version: 1, id, folder, video, drop, work, entries, lastCopy, root, machine }`.
- `filing.js`: `finishLate(pending, deps) → { ok, problems }`: `lateCheck(entries)`; when it gives none, deletes the run's folder (`work`), the raw video in the drop folder, this Mac's status files for the video, and the pending file; when it gives some, logs each, writes the cut plan's text again with the problems as its first lines (`replaceIn`, by the rule), writes the status with `problem`, keeps the raw video, the work copies and the pending file (so a later run checks again), and the banner says so.
- The panel and the banner (the lead's change B): at filing, the banner `Ready: <name>. In Claude, say "open <name>".` shows and the video's panel bar ends (`progress.end`), so no panel stays up through the wait. The wait runs quietly; the log says `<name>: copied into Dropbox. Its late check is due at <time>.` A banner shows only when the late check finds a problem: `Dropbox lost a file of <name>. The video stays in the drop folder; see the log.`
- `unedited.js`: in episode mode `uneditedFolder` does: take the lock; `keepAwake(process.pid)` (real: `/usr/bin/caffeinate -i -w <pid>`, detached, unref'd, errors ignored; `deps.keepAwake` in tests); `clearCrashes`; this Mac's pendings that are due, then each waiting video; then, while any pending is not yet due, `wait(min(60000, until due))`, import anything new, and finish each that is due. `deps.now` (default `Date.now`) is the clock; a test's `wait` moves it on.

- [ ] **Step 1: Write the failing tests.**
  - "waits 15 minutes after the last copy, then checks, and only then deletes the raw video from the drop folder and the run's own folder" (the test's clock: no deletion before 900000 ms; `caffeinate` asked once with this pid).
  - **Review Focus 2:** "copies a file in again when Dropbox has taken it away before the late check" (the stand-in removes `Talk.rough-cut.mp4` from the episode folder before the check: cloned in again, then the raw video is deleted).
  - **Review Focus 2:** "keeps the raw video, says so in the status file and in the cut plan's first lines, and never imports it twice, when a file is still wrong at the late check" (a clone that always leaves the rough cut short: `problem` in the status; `Talk.cut-plan.txt` opens with the problem; a second run imports nothing and logs `copied in, but the late check found a problem`).
  - "imports a video that arrives while it waits for a late check" (a second video appears in the drop folder at the third wait).
  - "does a late check a stopped run left, before anything else" (a pending file whose `lastCopy` is 20 minutes ago: checked at once, at the start of the next run).
  - "leaves a pending check that is not yet due for this run to wait for" (one written 5 minutes ago: waited 10 minutes more).
  - "keeps the run's own folder in BRIMM Video Work/.runs, so a pending check after a restart still has its work copies" (the pending's `work` is under `~/BRIMM Video Work/.runs/`; after the run ends early, the work copies are still there).
  - "shows the Ready banner and ends the panel's bar at filing, waits quietly, and shows a banner after the wait only when the late check finds a problem".
- [ ] **Step 2–5:** run and fail; write; run and pass with the whole suite; commit "Check every file again 15 minutes after the import's last copy, and only then let the raw video go".

---

### Task 12: `install.sh --machine`

**Files:** Modify `tool/install.sh`, `tool/settings.js`, `tool/tests/install.test.js`, `tool/tests/settings.test.js`.

`./install.sh --machine "<this Mac>" "<path to BRIMM Video>" [--rules-only] [--print] [--yes]`:
- The name is checked by `node settings.js check-machine` (`machineFault`); the path must be a whole path ending in `BRIMM Video`; a folder that `com.thebrimm.transcribe` watches, or any folder inside one, is refused (the spec puts `BRIMM Video/` beside `BRIMM VIDEO Transfer` so the transcript tool is never woken; so the root itself must not be inside a folder it watches).
- The drop folder `<root>/Unedited Video/<machine>` is refused when its `.brimm-watched-by` names another Mac.
- It would make: in Dropbox, `<root>/Unedited Video/<machine>/`, `<root>/Episodes/`, `<root>/Episodes/.importing/` (`mkdir -p`), and the marker by `node settings.js marker "<drop>" "<machine>"` (textWriter, real clone, `replace` when this Mac's marker is there); on this Mac, `settings.json` by `node settings.js write --machine … --root … --checkout <repo>`, and `~/BRIMM Video Work/`, `Backups/`, `From Final Cut/`.
- The launch agent: today's plist, with `--watch "<drop folder>"` and WatchPaths the drop folder alone. The episode mode is chosen by `unedited.js` from the settings (Task 9), so the plist needs nothing more.
- `--print` prints all of that, the settings as they would be written, the marker's text, and the plist, and changes nothing. `--machine` with more than one folder, or with no folder, says how it is used and ends 2. Today's `./install.sh "<folder>"` works as it does.

**Interfaces:** `settings.js` gains `marker` (`settingsMain(["marker", drop, machine])` → 0 written, 1 refused: `The drop folder <drop> is watched by <other>. A folder is watched by one Mac only.`) and `check-machine` (0, or 1 with the why). Their tests in `settings.test.js` use a stand-in clone through an option of `settingsMain`.

- [ ] **Step 1: Write the failing tests** (every one with `--print`, as `install.test.js` does today):
  - "shows what it would make for this Mac: its drop folder, Episodes and .importing in Dropbox, the marker, the settings and BRIMM Video Work, and changes nothing" (each line, and `left` shows no new file in the test's home or root).
  - "has the launch agent watch this Mac's drop folder" (plutil reads `ProgramArguments` `[node, …/unedited.js, --watch, <root>/Unedited Video/Mac Studio]` and `WatchPaths` that folder).
  - "refuses a drop folder another Mac's marker names" (exit 2, its words).
  - "refuses BRIMM Video inside a folder the transcript tool watches" (an installed `com.thebrimm.transcribe` plist watching the parent of `<root>`: exit 2).
  - "refuses a name a Mac cannot have, and a path that is not BRIMM Video" (exit 2).
  - "says how it is used when --machine has no folder or more than one".
  - "says which Claude model reads each plan" (`CLAUDE_MODEL` in the summary).
  - `settings.test.js`: `marker` writes `Mac Studio\n` into `.brimm-watched-by` by the clone, rewrites its own with `replace`, refuses another Mac's.
- [ ] **Step 2–5:** run and fail; write; run and pass with the whole suite; commit "Set a Mac up for episodes: install.sh --machine".

---

### Task 13: `edit.js`, its frame and `episodes`

**Files:** Create `tool/edit.js`, `tool/tests/edit.test.js`.

**Interfaces:**
- `editMain(argv, deps) → Promise<0 | 1 | 2>`; `contextFor(deps)` gives `ctx = { settings, machine, root, episodes, home, say, now, today, openApp, run, wait, writeText, clone, start, alive, stat }`. No settings → 2: `This Mac is not set up for episodes yet. Jason runs install.sh --machine on it.` Unknown command or none → the help, 2.
- `findEpisode(ctx, said) → { folder, name, record } | { why }`: the folder's name exactly; else the id or short id; else every word said is in the folder's name or the record's `name.text` (case-insensitive). None → `why` names up to five closest; more than one → names them, "say which". Folders starting with `.` are skipped; folders with no whole record are imports in progress, not episodes.
- `episodes(ctx)`: each episode, newest folder first: its name (and `(a placeholder)`), its length, its kind, `title` when there is one, its last push (`v` and Mac), finished, archived episodes left out; any file problem (`filesProblems`) or conflicted copy, by name. Then "Waiting in the drop folders": each video in each `Unedited Video/*/` with how long it has waited, and "already imported as …" when an episode holds it. Then imports from the status files: running ("on Mac Studio, at <step>"), stopped ("stopped on Mac Studio at <step>, <time> ago"), failed, problem. Then this Mac's libraries in `~/BRIMM Video Work/*/*.fcpbundle` with their sizes, and the free space on the disk (`statfsSync`).

- [ ] **Step 1: Write the failing tests** (a test root and home made per test; episodes written with Task 4's functions):
  - "says this Mac is not set up, and ends with 2, when it has no settings".
  - "lists each episode with its name, length and kind, newest first".
  - "marks a placeholder name, and leaves an archived episode out".
  - "names a missing file and a conflicted copy under the episode they are in".
  - "lists a video waiting in a drop folder, and one already imported".
  - "lists an import that is running, one that stopped, one that failed and one with a problem".
  - "shows each library's size and the free space".
  - `findEpisode`: "finds an episode by its folder, its id, its short id, or the words of its name"; "names the ones that fit when more than one does"; "names the closest when none does".
- [ ] **Step 2–5:** run and fail; write; run and pass; commit "Add edit.js: list the episodes, the waiting videos and the imports".

---

### Task 14: `open`

**Files:** Modify `tool/edit.js`, `tool/tests/edit.test.js`.

`open "<episode>"` reads the record (a conflicted copy, or no whole record: refuse, naming it); says when Dropbox undid this Mac's last change (`undone`); checks the files list (`filesProblems`: refuse, naming each); and checks each listed file is whole (`isWhole`). When some are not, it starts a detached `bring` run (Task 16) that reads them to their end, so that Dropbox brings them down, and says `Dropbox is bringing <n> files of <name> over to this Mac. Say "open <name>" again when it is done; "how far is it?" shows how far it has got.` Otherwise it shows: the name, and `The name is a placeholder: say what to call it.` when it is; the title or `No title yet.`; the length and kind; the first 12 lines of `<stem>.edit-notes.txt` when there is one; the Reel candidates (n, title, length); what was pushed; and the next step: `Say "show it in Final Cut" to see the main video there.` At the first open on this Mac (no `~/BRIMM Video Work/<folder>/`), it makes that folder and says: `So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: <folder path>.` No claim is written (phase 1b).

- [ ] **Step 1: Write the failing tests:**
  - "shows the name, the placeholder line, the notes, the Reel candidates and the next step".
  - **Review Focus 4:** "refuses an episode with a conflicted copy of its record or a timeline, naming it".
  - "refuses an episode with a file missing or short, naming it".
  - "says Dropbox undid this Mac's last change when the newest record is older than the one it wrote".
  - "starts a detached run to bring over files that are not whole yet, and returns at once" (a stand-in `start`; the words above).
  - "says at the first open on this Mac how to keep the episode offline, and not after".
  - "shows a record of a newer layout, and says this Mac needs updating to change it".
- [ ] **Step 2–5:** run and fail; write; run and pass; commit "Open an episode: check its files, bring them over, and show what is decided".

---

### Task 15: `push main`, with the guard

**Files:** Modify `tool/edit.js`, `tool/tests/edit.test.js`.

**Interfaces:** `pushPart(ctx, found, { part, xml, noHandEdits, handEdits }) → Promise<0 | 1>`; `push(ctx, said, flags)` for `push "<episode>" [main] [--no-hand-edits | --hand-edits]`. `push … reel <n>` says `Reels are pushed from a later version.` and ends 1 (phase 2 adds it on `pushPart`).

`pushPart` in order:
1. Refuse: a conflicted copy; a record of a newer layout; `undone`; a file problem; a file it uses not whole (the raw video, the source timeline).
2. **The guard** (spec section 4). When the part has been pushed before: with neither flag, refuse with `Did you change v<last> of <name> in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.` and end 1. With `--hand-edits`: end 1 with `Your changes stay in v<last> in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v<last>.` With `--no-hand-edits`: go on, and the new push records `answer: "no hand edits since v<last>"`.
3. `v` = 1 + the highest `pushed[].v` of the part; `project = projectName({ name: record.name.text, part, v, id })`.
4. The stored timeline: `retitle(xml, { event: project, project })` (each push its own event, named as its project: the spec's fallback while phase 0 is pending, marked in a comment), written to `timelineFile({ part, v, machine })` by the rule (`textWriter`, `cloneIn`), making `edit/` when it is not there.
5. The record: `pushed.push({ v, at, on, file, project, answer? })`, `libraries[machine] = "<folder>.fcpbundle"`, `files[file] = bytes`, written with `expectRev`. A `CHANGED` refusal ends 1 with its words.
6. The local copy: `localMedia` from the stored file's place, refused when `outside` is not empty (`<path> is outside the episode's folder. Copy it into media/ first.`), then `withImportOptions({ library: libraryFor(home, folder) })`, written to `pushedFolder(home, folder)/<basename of the stored file>` (plain write: this Mac's own disk).
7. `ctx.openApp("Final Cut Pro", localCopy)` (real: `spawnSync("/usr/bin/open", ["-a", "Final Cut Pro", file])`).
8. Says `Shown in Final Cut as "<project>", in the library <folder>.fcpbundle in BRIMM Video Work.`, and at the episode's first push on this Mac: `Once, for this library: in Final Cut, choose File > Library Properties, click Modify Settings beside Storage Locations, and set Backups to BRIMM Video Work/Backups.`

`push main` gives `pushPart` the text of `edit/main.v0.fcpxml` (`main.base` is always null in 1a).

- [ ] **Step 1: Write the failing tests:**
  - "pushes v1: the stored timeline in edit/ by the rule, names a relative video, no library; the local copy names this Mac's paths, its library, copy assets 0 and suppress warnings 1; Final Cut is asked to open it".
  - "records the push with its project name, and lists the stored file with its size".
  - **Review Focus 5:** "refuses a second push with no answer, and asks the guard's question".
  - **Review Focus 5:** "stops at a yes, and says how to work until brimm-video can build on hand edits; nothing is written and Final Cut is not asked".
  - "pushes v2 with --no-hand-edits, and records the answer".
  - "refuses when another record was written after the one it read, and does not open Final Cut".
  - **Review Focus 4:** "refuses an episode with a conflicted copy".
  - "refuses when the video is not whole on this Mac".
  - "refuses media outside the episode's folder, naming it".
  - "names the backup step at the first push on this Mac, and not after".
  - "handles a video name with an apostrophe, #, & and %" (`Sallie's talk #1 & 100%.mov`: the stored `src`, the local `src` and the project name).
- [ ] **Step 2–5:** run and fail; write; run and pass; commit "Push the main timeline to Final Cut through a local copy, with the guard".

---

### Task 16: detached runs, `status` and `retry`

**Files:** Create `tool/detached.js`, `tool/tests/detached.test.js`; modify `tool/edit.js`, `tool/tests/edit.test.js`.

**Interfaces:** `detached.js` (names agreed with builder C):
- `startDetached(ctx, { command, folder, args })`: `ctx.start(process.execPath, [<checkout>/tool/edit.js, command, "--now", folder, ...args])`; real `start`: `spawn(…, { detached: true, stdio: ["ignore", log, log] }).unref()`, the log `~/Library/Logs/brimm-video.log` opened for appending.
- `runDetached({ home, folder, command, keepAwake, alive, now }, work) → Promise<result | { running }>`: one lock for the episode, `~/BRIMM Video Work/<folder>/episode.lock` holding `{ pid, command }` (`wx`; a lock whose pid is not running is taken over); `keepAwake(process.pid)`; `await work()` → `{ ok, made, failed, next }`; the result written whole to `<command>.result.json` (`{ version: 1, command, started, ended, ok, made, failed, next }`, written under another name and renamed: this Mac's own disk); the lock removed, also when `work` throws (then `ok: false` and the error's words in `failed`).
- `resultFile(home, folder, command)`, `readResult(home, folder, command) → result | null`, `runningCommand(home, folder, alive) → command | ""`.
- `edit.js`: `bring` (`--now` only): reads each listed file that is not whole to its end (`createReadStream`), then `isWhole` again; `made` lists the whole ones, `failed` the others.
- `edit.js`: `status ["<episode>"]`: this Mac's progress files (phase P's folder: each run's `detail`, or "ended"), the status files in `Episodes/.importing/`, and for an episode its running command and its result files. With nothing: `Nothing is running, and nothing is waiting.`
- `edit.js`: `retry "<video>"`: finds the video in this Mac's drop folder by its file name or stem (case-insensitive); refuses while its import is running (a fresh status); removes this Mac's status files for it (`removeStatus`); starts the import detached: `ctx.start(process.execPath, [<checkout>/tool/unedited.js, "--watch", <drop folder>])`; says `Started again. The panel shows how far it is.`

- [ ] **Step 1: Write the failing tests:**
  - `detached.test.js`: "runs the work holding the episode's lock, kept awake, and writes its result"; "starts nothing when another run holds the lock, and says which"; "takes over a lock its run left when it died"; "writes a result that says what went wrong when the work throws, and lets the lock go"; "starts a command detached and returns at once".
  - `edit.test.js`: "bring reads the files that were not whole, and says which are whole now"; "status shows a running import's step, an episode's running command and its last result"; "status says nothing is running when nothing is"; "retry removes a failed import's status and starts the import again"; "retry refuses while the import is running"; "retry names the videos in the drop folder when it cannot find the one said".
- [ ] **Step 2–5:** run and fail; write; run and pass; commit "Run long commands detached, and add status and retry".

---

### Task 17: the README and the requirements

**Files:** Modify `README.md`, `docs/requirements.md`; the memory note `mac-studio-video-setup` (outside the repo).

- [ ] **Step 1:** README: its first lines name the new drop folder, `The BRIMM DB/BRIMM Video/Unedited Video/<Mac>/` (the lead's change F). A section "Episodes", after "Unedited video": the folders in Dropbox, what the import writes and in what order, the rule (clones, never over a file, the late check 15 minutes on, the raw video kept until then), the record, `edit.js` and what each command does, what 1a does not do yet (the claim, release, Reels, finish), the phase 0 fallbacks, and how to set a Mac up (`install.sh --print --machine …`). The line of the Claude call (line 124) gains `--model claude-opus-5-5`. The "What is where" table gains the new modules.
- [ ] **Step 2:** `docs/requirements.md`, Changes: `2026-10-14: built phase 1a of the design: episodes on the Mac Studio alone.`
- [ ] **Step 3:** run the whole suite; run `./install.sh --print --machine "Mac Studio" "<root>"` by hand (it changes nothing) and keep its output for the PR's deployment note.
- [ ] **Step 4: Commit**: "Say in the README what episodes are, and how a Mac is set up for them".

---

## After the code: the pull request's deployment note

The PR to `main` carries, for the lead:

0. **Before anything: the model.** Pulling `main` changes the live old mode's Claude call too. One real call from an empty temp folder, exit 0 (the lead's change D): `echo 'Say ok' | claude -p --model claude-opus-5-5 --tools "" --strict-mcp-config --setting-sources "" --output-format json`.
1. **What `install.sh --print` shows** for `./install.sh --print --machine "Mac Studio" "/Users/jasonogden/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB/BRIMM Video"`, run by hand from the worktree before the PR (it changes nothing), pasted whole.
2. **What it makes in Dropbox**: `BRIMM Video/`, `BRIMM Video/Unedited Video/Mac Studio/` with `.brimm-watched-by`, `BRIMM Video/Episodes/` and `BRIMM Video/Episodes/.importing/`. On the Mac: `settings.json`, `~/BRIMM Video Work/Backups/` and `From Final Cut/`. The launch agent stops watching `Unedited Video Transfer` and watches `Unedited Video/Mac Studio/`.
3. **Order**: check that `Unedited Video Transfer` is empty, so no video is stranded when the agent stops watching it (the lead's change F); merge; pull `main` in `~/Claude Code/BRIMM video` (the agent then still watches `Unedited Video Transfer` in today's mode); `--print`; Jason's yes; the installer without `--print`.
4. **The by-hand checks the spec asks for** (Jason or the lead, after the install): (a) the clone into Dropbox: a made-up file of over 1 GB (`mkfile 1100m` in a temp folder) cloned into `BRIMM Video/Clone test (delete after)/`, never into `Episodes` or a drop folder (the lead's change E), with `cp -c` while Dropbox is uploading it, and one replaced as `replaceIn` does it, both checked on the Mac an hour later (and on the laptop in phase 1b); if a clone is undone, stop and take the design back to Jason. Delete `Clone test (delete after)` after the hour's check. (b) A made-up clip end to end: in a temp folder, `say -o talk.aiff "…"` and `ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30000/1001 -i talk.aiff -shortest -c:v libx264 -c:a aac talk.mp4`; copy `talk.mp4` into `Unedited Video/Mac Studio/`; watch the panel; 15 minutes after the last copy, `Episodes/<day> talk (Mac Studio)/` holds every file and `record/0001.json`, the drop folder is empty, and `~/Library/Logs/brimm-video.log` says the late check passed. Then `node tool/edit.js episodes`, `open talk`, `push talk main` (Final Cut opens the project in its own library), and a second `push talk main` refused until `--no-hand-edits`. (c) One real recording, dropped, opened and pushed; its folder, its library and the peak space in the temp folder measured, and the Claude usage of one import noted.

## Self-review

- Spec coverage, phase 1a row: `BRIMM Video/` beside `BRIMM VIDEO Transfer` (12); the rule with clones, the late check and the list (3, 9, 11); the arrival check (3, 8); the import's order and status file (9, 10); the record, `rev` as a new file, files, writer (4, 9); `install.sh --machine` (12); relative paths in stored timelines (6, 9); the local push copy and recorded project names (6, 15); `episodes`, `open`, `push` with the guard, `status`, `retry` (13 to 16); `caffeinate` (11, 16); the model named (7). Section 1's `episodes` lines (waiting videos, stopped imports, libraries, free space) in 13; the first-open offline step in 14; detached `open` in 14 and 16. Measured by hand: the deployment note.
- Left out on purpose, each with its reason above: the claim and `release` (1b), the start timecode (phase 0), the status file's percent (Jason's), the panel's lid line (1b).
- Names checked across tasks against "Interfaces other phases use".
