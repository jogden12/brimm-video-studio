# The switch: the light import, the fork, the readings and hand-off v2. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A video dropped on either Mac is imported lightly (transcript, cut log, rough cut's transcript, a guess and a match; no Claude, no render), Sallie says what it is in one card in her chat, and brimm-video's one Claude call reads it for that kind: a finished video ends in a hand-off version 2 with no Final Cut, a session in approved principles with no transcript, a raw video in its rough cut rendered as version 0.

**Architecture:** Four pull requests, merged one at a time, released together behind per-Mac settings (`import: "light"`, `handoffVersion: 2`, `drop: "Drop"`), so nothing changes on either Mac until the switch. Pure modules first (`kinds.js`, `versions.js`, `handoff-v2.js`, `readings.js`, `sessions.js`, `gate.js`), each with no disk and no program; then the import's light path in `unedited.js`, the reading's detached run (`reading.js`), and `edit.js`'s commands and its one gate. Renders beyond today's ffmpeg rough cut, `render`, `reel make`, fine edits and the finish without Final Cut are phase V, planned after the tests R0 and R2.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages; ffmpeg, the transcriber and `claude -p` as today, always stand-ins in tests; `osascript` for one dialog.

**Spec:** `docs/superpowers/specs/2026-10-22-brimm-video-light-import-and-fork-design.md` (pull request jogden12/brimm-video#34, with Jason's answers in its section 11): sections 1 (the light import, labels, the guess, the match, the record), 2 (the card, `kind`, the one Claude call, corrections, the session mark, the gate, the dialogs), 3 (the readings, the Reel suggestions, times, the version model), 7 (her folder's settings: `defaultMode`), 8 (hand-off v2, as agreed with the page) and 9 (phases L, F, H, D and "the switch"). Where this plan names a value, it is the spec's.

**Built on:** `main` at 0700809 (phase 4), with PR #34 (the spec). Phase T (PR #32) may land before or after; where both touch a file, the second to merge takes the other's lines (Tasks H2 and D1 say where).

**How this plan was made:** from the spec and a read of the code at 0700809 (each file and line named below was opened). Unlike the phase 4 plan, no task was run beforehand: each task's own failing test is the first run.

## Global Constraints

- Node 22 or later, no packages. Every test: `cd tool && node --test`, all pass, 0 fail, before every commit.
- A failing test first, then the code (`CLAUDE.md`). Small commits, in a worktree, never on the main checkout, which runs the launch agent.
- No test calls the real `claude`, ffmpeg, ffprobe, the transcriber, `osascript`, `open` or Final Cut; no test writes into Dropbox or a watched folder; the installer runs with `--print` only.
- Nothing changes on a Mac until its settings say so: with `import` absent or `"full"`, the import is today's; with `handoffVersion` absent or `1`, `finish` writes version 1 with its title. Every new path is behind one of these, and a test pins the old path unchanged.
- "Until she answers, nothing about a video goes to Claude: not its words, not its plan, not its file name", and for a session never its file name (spec 1). Every line `edit.js` prints about an unanswered or session record uses its label.
- Every write into an episode follows the rule (2026-10-14 spec section 1): the record through `writeEpisode`; files cloned in under their final names (`cloneIn`, `replaceIn`), never written in place; a file set aside goes into `history/` whole before the original is deleted.
- Kinds stored in a record: `null` (unanswered), `"finished"`, `"raw"`, `"session"`, `"short video"` (an iPhone clip; the command word is `clip`); `"episode"` is read as raw (`kindOf`).
- The one Claude call keeps today's options and model (`CLAUDE_MODEL`, `unedited.js:79`; README "Claude's read"), and every request keeps today's guard lines (`notes.js`, `DATA`).
- Messages a person reads are in the codebase's plain words: what happened, and what to do.
- Never read a `.env` file. Install nothing.

## Review Focus

1. **A raw video answered within 15 minutes of "Ready":** the reading must not replace a file the import's late check will look at; it waits until no pending late check holds the video (`importHolds`), then starts. Test in Task F5.
2. **The same video answered on both Macs at once:** `kind` claims the episode as `open` does; the second Mac's `kind` is refused and runs no reading. Test in Task F3.
3. **A file named for a client** (`"Coaching call Jane Doe.mp4"`): no command's output, log line or result file names it while the record is unanswered or a session. A test drops such a file and walks every command name over it. Test in Task F2.
4. **A layout-3 record on a Mac with layout-2 code:** it is refused with "Jason has a newer brimm-video", never read as an older record. Test in Task L2.
5. **The installer run again after the switch:** `settingsFile` keeps `import`, `readings`, `handoffVersion`, `drop`, `sessionTeachings` and any later field. Test in Task L1.

---

## Part L: the light import (pull request L)

### Task L1: Settings keep what they do not write, and gain the switch's fields

**Files:**
- Modify: `tool/settings.js` (`settingsFault` 63, `writeSettings` 90, `settingsMain` 230; `dropFolder` 23)
- Test: `tool/tests/settings.test.js`

**Interfaces:**
- Produces: `writeSettings(home, fields)` merges `fields` into the file's current settings (unknown fields kept); `settingsFault(s)` also checks the optional fields `import: "full"|"light"`, `readings: boolean`, `handoffVersion: 1|2`, `drop: "Unedited Video"|"Drop"`, `sessionTeachings: null | { on: true, at, accounts: { cli: string, app: string } }`; `dropFolder(root, machine, folder = "Unedited Video")`; `lightImport(s) => s.import === "light"`; `teachingsOn(s, now) =>` true when `sessionTeachings.on` and `at` is less than 90 days before `now`.
- `node settings.js set [--import light|full] [--readings on|off] [--handoff 1|2] [--drop Drop|"Unedited Video"]` and `node settings.js sessions --teachings on --cli-account <email> --app-account <email>` / `--teachings off`.

- [ ] **Step 1: Write the failing tests**

```js
test("writing the settings again keeps every field it does not write", () => {
  const home = tempHome();
  writeSettings(home, { machine: "Mac Studio", root: "/r", checkout: "/c" });
  writeSettings(home, { import: "light", handoffVersion: 2, sessionTeachings: { on: true, at: "2026-10-22T20:00:00-04:00", accounts: { cli: "a@b.c", app: "a@b.c" } }, later: { x: 1 } });
  writeSettings(home, { machine: "Mac Studio", root: "/r", checkout: "/c" });
  const s = readSettings(home).settings;
  assert.equal(s.import, "light");
  assert.equal(s.handoffVersion, 2);
  assert.equal(s.sessionTeachings.accounts.cli, "a@b.c");
  assert.deepEqual(s.later, { x: 1 });
});
test("the switch's fields are checked", () => {
  assert.match(settingsFault({ ...BASE, import: "heavy" }), /import/);
  assert.match(settingsFault({ ...BASE, handoffVersion: 3 }), /hand-off/);
  assert.match(settingsFault({ ...BASE, drop: "Elsewhere" }), /drop folder/);
  assert.equal(settingsFault({ ...BASE, import: "light", readings: false, handoffVersion: 2, drop: "Drop" }), "");
});
test("teachings lapse 90 days after Jason turned them on", () => {
  const s = { ...BASE, sessionTeachings: { on: true, at: "2026-10-22T20:00:00-04:00", accounts: { cli: "a@b.c", app: "a@b.c" } } };
  assert.equal(teachingsOn(s, Date.parse("2027-01-19T20:00:00-05:00")), true);
  assert.equal(teachingsOn(s, Date.parse("2027-01-21T20:00:00-05:00")), false);
});
test("the drop folder is Unedited Video until the switch names Drop", () => {
  assert.equal(dropFolder("/r", "Mac Studio"), "/r/Unedited Video/Mac Studio");
  assert.equal(dropFolder("/r", "Mac Studio", "Drop"), "/r/Drop/Mac Studio");
});
```

- [ ] **Step 2: Run** `cd tool && node --test tests/settings.test.js`. Expected: FAIL (`teachingsOn` is not exported; the second `writeSettings` throws on a missing machine).
- [ ] **Step 3: Implement** in `tool/settings.js`: `writeSettings` reads the current file when it is there and valid, merges, checks the whole with `settingsFault`, and writes as now; the old `{ machine, root, checkout }` call keeps working. Add `lightImport`, `teachingsOn`, the `folder` parameter of `dropFolder`, and the two `settingsMain` commands (`set`, `sessions`), each printing what it changed. The `install.sh` call `settings.js write` (`install.sh:458`) now keeps the other fields by construction.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS, all.
- [ ] **Step 5: Commit** `git commit -m "Settings keep fields they do not write; the switch's settings (import, readings, handoffVersion, drop, sessionTeachings)"`

### Task L2: The record's layout 3

**Files:**
- Modify: `tool/episode.js` (`RECORD_VERSION` 25, `KINDS` 32, `isPush` 64, `layoutOf` 84, `newEpisode` 111, `episodeFault` 138)
- Test: `tool/tests/episode.test.js`, `tool/tests/layout.test.js`

**Interfaces:**
- Produces: `RECORD_VERSION = 3`; `KINDS = ["episode", "short video", "finished", "raw", "session"]`; `kindOf(record) => "raw" | "finished" | "session" | "short video" | null` (`"episode"` → `"raw"`); `newEpisode({ …, kind, answer = null, label = "", fingerprint = "", versionOf = null })`; record fields `answer: { state: "needs your answer" | "answered" | "not for brimm-video", guess: string|null, seen: string, came: "camera"|"phone"|"zoom"|"sound", by?, on?, at?, private?: "yes"|"no" }`, `label: string`, `fingerprint: string`, `versionOf: string|null`, `session: null | { marked, on, teachings: null|"asked"|"transcript only", cleared: null | { at, on, to, confirmed: "dialog" } }`, `reading: null | { kind, model, at, on, account, outcome }`; a push entry may be `{ v, how: "render", … }` with `v >= 0`, or `{ v >= 1, how?: "push", … }`.
- `layoutOf(r)` returns 3 when `r.kind` is not `"episode"` or `"short video"`, or any of `answer`, `session`, `reading`, `versionOf` is set, or a push has `how`.

- [ ] **Step 1: Write the failing tests**

```js
test("an unanswered record is layout 3, with no kind", () => {
  const r = { ...made(), kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10, 2 retakes", came: "camera" }, label: "Video of 22 Oct, 10:40 (Mac Studio)" };
  assert.equal(episodeFault(r), "");
  assert.equal(layoutOf(r), 3);
  assert.equal(kindOf(r), null);
});
test("a kind is needed once the record is answered", () => {
  assert.match(episodeFault({ ...made(), kind: null, answer: { state: "answered", guess: null, seen: "", came: "camera" } }), /kind/);
});
test("an episode imported before the switch reads as raw, and stays layout 1", () => {
  assert.equal(kindOf({ ...made(), kind: "episode" }), "raw");
  assert.equal(layoutOf({ ...made(), kind: "episode" }), 1);
});
test("a rendered version 0 is a version", () => {
  assert.equal(episodeFault({ ...made(), kind: "raw", main: { ...made().main, pushed: [{ v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml" }] } }), "");
  assert.match(episodeFault({ ...made(), main: { ...made().main, pushed: [{ v: 0, at: AT, on: "Mac Studio", file: "x" }] } }), /main video/);
});
test("a Mac on layout 2 is refused a layout-3 record by name, not given an older one", () => { /* readEpisode with RECORD_VERSION stubbed to 2 over a folder whose newest record is layout 3: the result says "newer brimm-video" and no older record is returned */ });
```

The last test builds a folder with records 1 (layout 1) and 2 (layout 3) and calls `readEpisode` through a copy of `episodeFault` that knows versions 1–2 (export `faultFor(knownVersion)` for this); expected: `{ why: /newer brimm-video/ }`.

- [ ] **Step 2: Run** `cd tool && node --test tests/episode.test.js tests/layout.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `tool/episode.js`: the constants, `kindOf`, the new field checks in `episodeFault` (each optional field checked only when present; `kind` may be `null` only while `answer.state` is "needs your answer" or "not for brimm-video"), `isPush` as above, `layoutOf` as above, `newEpisode`'s new parameters, and `readEpisode` refusing a record of a layout above the code's own with today's words ("Jason has a newer brimm-video") rather than falling back. Keep `writeEpisode` writing `version: layoutOf(record)`.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Record layout 3: unanswered records, the new kinds, answer, label, session, reading, rendered versions"`

### Task L3: How a video came, the guess and the labels (`kinds.js`)

**Files:**
- Create: `tool/kinds.js`
- Modify: `tool/cuts.js` (`factsOf` 31: add `device`)
- Test: `tool/tests/kinds.test.js`, `tool/tests/cuts.test.js`

**Interfaces:**
- Produces: `isZoomName(name) => boolean` (`/^GMT\d{8}-\d{6}_Recording/`, `/^(audio|video)\d{8,}\.(m4a|mp4)$/`); `cameFrom({ name, facts }) => "zoom" | "phone" | "sound" | "camera"` (`zoom` by name; `sound` with no picture; `phone` when `facts.device.make` is Apple and `facts.device.model` names an iPhone, or the picture is upright; else `camera`); `guessKind({ facts, plan, came }) => "finished" | "raw" | "clip" | null` (upright or under 90 s → `clip`; `zoom` or `sound` → `null`; else `raw` when the plan has at least one range of kind "retake", "false start" or "cue" per ten minutes of `facts.duration`, `finished` otherwise); `labelFor({ seconds, machine, at }) => { short: "Video of 22 Oct, 10:40 (Mac Studio)", spoken: "the 42-minute video dropped on the Mac Studio at 10:40 on 22 Oct" }`; `sessionLabel(day, taken) => "Session, 2026-10-22"` or `"Session, 2026-10-22 (2)"` when the first is in `taken`; `seenLine({ facts, plan, came }) => "wide, 42:10, 2 retakes"`.
- `factsOf` adds `device: { make, model }` from `format.tags["com.apple.quicktime.make"]` and `["com.apple.quicktime.model"]`, empty strings when absent.

- [ ] **Step 1: Write the failing tests**

```js
test("the guess: a phone or short clip, then raw by its retakes, finished otherwise; Zoom and sound get none", () => {
  const plan = (n, minutes) => ({ ranges: Array.from({ length: n }, () => ({ keep: false, kind: "retake" })) });
  assert.equal(guessKind({ facts: { width: 1080, height: 1920, duration: 300 }, plan: plan(0), came: "phone" }), "clip");
  assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 60 }, plan: plan(0), came: "camera" }), "clip");
  assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 1200 }, plan: plan(2), came: "camera" }), "raw");
  assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 1200 }, plan: plan(1), came: "camera" }), "finished");
  assert.equal(guessKind({ facts: { width: 1280, height: 720, duration: 1800 }, plan: plan(9), came: "zoom" }), null);
});
test("a session is never guessed", () => { /* every combination of facts, plan and came: never "session" */ });
test("labels never hold the file's name", () => {
  const l = labelFor({ seconds: 2530, machine: "Mac Studio", at: "2026-10-22T10:40:00-04:00" });
  assert.equal(l.short, "Video of 22 Oct, 10:40 (Mac Studio)");
  assert.equal(l.spoken, "the 42-minute video dropped on the Mac Studio at 10:40 on 22 Oct");
  assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-22"]), "Session, 2026-10-22 (2)");
});
test("Zoom's names", () => {
  assert.equal(isZoomName("GMT20261013-142933_Recording_gvo_1280x720.mp4"), true);
  assert.equal(isZoomName("audio1449382767.m4a"), true);
  assert.equal(isZoomName("Pricing talk.mov"), false);
});
```

- [ ] **Step 2: Run** `cd tool && node --test tests/kinds.test.js tests/cuts.test.js`. Expected: FAIL (no module).
- [ ] **Step 3: Implement** `tool/kinds.js` (pure) and `factsOf`'s `device`.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "kinds.js: how a video came, the guess, and labels with no file name"`

### Task L4: The words' fingerprint and the match (`versions.js`)

**Files:**
- Create: `tool/versions.js`
- Test: `tool/tests/versions.test.js`

**Interfaces:**
- Consumes: `normalWords` and `inMain` from `tool/handoff.js`.
- Produces: `fingerprintOf(words) => string` (FNV-1a 32-bit hashes of each run of five normalised words, deduplicated, sorted, hex, joined; at most 4,000 kept by taking every k-th); `shareOf(a, b) => number` (the share of `a`'s hashes found in `b`); `matchVersion({ seconds, fingerprint, words }, candidates, readWords) => { id, folder } | null`, where each candidate is `{ id, folder, kind, archived, session, seconds, fingerprint }` from a record, and `readWords(folder) => words | null` (null when the file is not whole on this Mac). Rules, in order: answered, not a session, not archived; `seconds` within a fifth; fingerprint share at least 0.5; then, on the one best by share, `inMain` finds at least 70 in 100 of the new words in order.

- [ ] **Step 1: Write the failing tests**

```js
const words = (text) => text.split(" ").map((w, i) => ({ w, start: i, end: i + 0.5 }));
const TALK = Array.from({ length: 400 }, (_, i) => `word${i % 97} thing${i % 13}`).join(" ");
test("a re-export of the same talk matches its episode", () => {
  const old = { id: "e-20261020-aaaaaa", folder: "A", kind: "finished", archived: false, session: null, seconds: 800, fingerprint: fingerprintOf(words(TALK)) };
  assert.deepEqual(matchVersion({ seconds: 790, fingerprint: fingerprintOf(words(TALK)), words: words(TALK) }, [old], () => words(TALK)), { id: old.id, folder: "A" });
});
test("no match: another length, a session, unanswered, or words not on this Mac", () => {
  const base = { id: "e-20261020-aaaaaa", folder: "A", kind: "finished", archived: false, session: null, seconds: 800, fingerprint: fingerprintOf(words(TALK)) };
  const mine = { seconds: 790, fingerprint: base.fingerprint, words: words(TALK) };
  assert.equal(matchVersion({ ...mine, seconds: 500 }, [base], () => words(TALK)), null);
  assert.equal(matchVersion(mine, [{ ...base, kind: "session", session: { marked: AT } }], () => words(TALK)), null);
  assert.equal(matchVersion(mine, [{ ...base, kind: null }], () => words(TALK)), null);
  assert.equal(matchVersion(mine, [base], () => null), null);
});
```

- [ ] **Step 2: Run** `cd tool && node --test tests/versions.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `tool/versions.js` (pure).
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "versions.js: a fingerprint of the words, and the match of a new version"`

### Task L5: The pauses kept in the cut plan

**Files:**
- Modify: `tool/unedited.js` (the plan written at 929; `planFault` 1027), `tool/notes.js` (callers of `applyDecisions` and `clipRanges` read the plan's pauses)
- Test: `tool/tests/unedited.test.js`, `tool/tests/notes.test.js`

**Interfaces:**
- Produces: `cut-plan.json` gains `pauses: [{ start, end }]`, the pauses ffmpeg heard (`planned.pauses`); `pausesOfPlan(plan) => plan.pauses || []`. `askAgain` (`unedited.js:1567`) and every later reading pass `pausesOfPlan(plan)` where they pass `[]` today.

- [ ] **Step 1: Write the failing tests**: the plan an import writes holds the pauses the stand-in ffmpeg printed (`PAUSES` in `tests/fixtures.js`); `applyDecisions(plan, decisions, pausesOfPlan(plan))` on a plan read back from disk gives the same ranges as on the import's own pauses.
- [ ] **Step 2: Run** `cd tool && node --test tests/unedited.test.js tests/notes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**: write `pauses` in the plan; `pausesOfPlan` in `notes.js`; `askAgain` uses it. `planFault` already ignores fields it does not know: a test pins that.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Keep the pauses ffmpeg heard in the cut plan, for a reading made later"`

### Task L6: The light path of the import

**Files:**
- Modify: `tool/unedited.js` (`workOn` 613–996: the steps 684–737 stay; 742–930 branch; 937–980 filing), `tool/filing.js` (`fileEpisode` 91)
- Test: `tool/tests/unedited.test.js` (a new `describe("the light import")`)

**Interfaces:**
- Consumes: `lightImport` (L1), `newEpisode`'s new fields (L2), `cameFrom`, `guessKind`, `labelFor`, `seenLine` (L3), `fingerprintOf`, `matchVersion` (L4).
- Produces: with `deps.episode` and `deps.light`, `workOn` writes the transcript, `.srt`, `.transcript.txt`, `.words.json`, the plan (with pauses) and its `.txt`, the rough cut's `.srt` and `.transcript.txt`, and nothing else; `fileEpisode({ …, kind: null, answer, label, fingerprint, versionOf })`; the notice `Ready on the ${machine}: ${label.short}. In Claude, say "what's waiting?"`; the progress panel's video name is `label.short`; `stepsFor({ light: true })` gives "Reading the sound", "Writing the transcript", "Making the cut plan", "Filing".
- `deps.light` is set by `depsFor` from this Mac's settings (`lightImport(settings)`).

- [ ] **Step 1: Write the failing tests**

```js
describe("the light import", () => {
  test("asks Claude nothing, renders nothing, and writes no Final Cut file or reels.json", async () => {
    const t = episodeImport({ light: true });
    await uneditedFolder(t.drop, t.deps);
    assert.equal(t.calls.filter((c) => c.cmd === "claude").length, 0);
    assert.equal(t.calls.filter((c) => c.cmd === "ffmpeg" && c.args.includes("libx264")).length, 0);
    const files = listAll(t.episodeFolder());
    assert.ok(!files.some((f) => f.startsWith("edit/") || f === "reels.json" || f.endsWith(".edit-notes.txt") || f.startsWith("previews/")));
    assert.ok(files.includes("Talk.rough-cut.srt") && files.includes("Talk.cut-plan.txt"));
  });
  test("files the record as needing an answer, with its guess, label and fingerprint", async () => {
    const t = episodeImport({ light: true });
    await uneditedFolder(t.drop, t.deps);
    const r = t.record();
    assert.equal(r.kind, null);
    assert.equal(r.answer.state, "needs your answer");
    assert.equal(r.label, "Video of 20 Oct, 15:00 (Mac Studio)");
    assert.ok(r.fingerprint.length > 0);
  });
  test("the notice and the panel name the label, never the file", async () => {
    const t = episodeImport({ light: true, video: "Coaching call Jane Doe.mov" });
    await uneditedFolder(t.drop, t.deps);
    assert.ok(t.notices.every((n) => !n.includes("Jane")));
    assert.ok(t.progress.every((p) => !String(p.video).includes("Jane")));
  });
  test("with the setting off, the import is today's", async () => { /* the existing import tests run unchanged with light: false */ });
});
```

`episodeImport` is a helper added to `tests/unedited.test.js` from the existing episode-import setup there (the one the tests at lines 1343–2129 use), with `light` passed into `deps`.

- [ ] **Step 2: Run** `cd tool && node --test tests/unedited.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** in `workOn`: after the plan is made (742), when `deps.light`, skip from "Claude reads the rules' plan" (781) to the plan's text and JSON (919–929), writing only the words and the rough cut's captions (825–828); compute `came`, `guess`, `seen`, `label`, the fingerprint and the match (candidates read from `Episodes/*/record` on this Mac, `readWords` from each folder's `.words.json` only when `isWhole`); call `fileEpisode` with them; post the notice above. `fileEpisode` passes the new fields to `newEpisode`.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The light import: no Claude, no render, no Final Cut file; the record needs an answer"`

### Task L7: Zoom's files held until phase Z, and the heavy path's other users

**Files:**
- Modify: `tool/filing.js` (`importEpisodes` 408), `tool/unedited.js` (`videosFromPlan` 1633)
- Test: `tool/tests/filing.test.js`, `tool/tests/unedited.test.js`

**Interfaces:**
- Produces: in a light drop folder, a file whose name `isZoomName` is not imported; its status says `Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.`, and the log once. `--from-plan` of a layout-3 episode refuses: `This episode was imported lightly: its videos are made when it is read, not from the plan.` A watched folder that is not an episode drop folder, and the one-file command line, keep the full run.

- [ ] **Step 1: Write the failing tests** for each of the three.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Hold Zoom's files until phase Z; --from-plan refuses a light episode"`

---

## Part H: hand-off version 2 (pull request H)

### Task H1: The version 2 writer and its check (`handoff-v2.js`)

**Files:**
- Create: `tool/handoff-v2.js`
- Test: `tool/tests/handoff-v2.test.js`

**Interfaces:**
- Consumes: `FORMAT`, `normalWords` from `tool/handoff.js`; `tidyTranscript` from `tool/shared/transcript.js`.
- Produces: `VERSION_2 = 2`; `buildHandoffV2({ record, revision, made, madeOn, commit, id, main, onPicture, suggestions, reels, session }) => object` with keys in the spec's order (`format, version, revision, made, madeOn, madeBy, video, main?, suggestions?, reels?, session`; `reels` absent for a short video); `video = { id, kind, name, recorded, recordedFrom }` where `kind` is `kindOf(record)`, `name` is `record.name.text` (the label for a session), and `id` is the given `id` (the first version's, H4); `handoffFaultV2(h) => string` ("" when whole).
- Per kind, as spec section 8's table: `main` absent for a session; `suggestions` only for finished and raw; `main.onPicture` only for raw and short video, a list of strings, absent when empty; a session's `reels` only with `clientAgreed` a `YYYY-MM-DD`; `session` null except for a session, then `{ principles, recurringPrinciples, reelsToFilm }` with principle keys exactly `n, name, category, description, steps, red_flags, green_flags, decision_criteria, example_application, verbatim_key_phrases`; a suggestion exactly `n, start, end, stretches, first, last, why, point`; a made Reel `n, title, file, seconds, inMain?, srt, fromSuggestion` (`clientAgreed` for a session's); no other key anywhere in a session's hand-off; no `title` under `video`.

- [ ] **Step 1: Write the failing tests**: one built hand-off per kind passes `handoffFaultV2`; each of these is refused with its own words: a session with `main`, a session with a `suggestions` key, a principle with `source_context`, a session Reel without `clientAgreed`, `clientAgreed` holding anything but a date, `onPicture` on a finished video, an unknown key in a session's hand-off, a `video.title`, a suggestion missing `point`, a `revision` of 0.
- [ ] **Step 2: Run** `cd tool && node --test tests/handoff-v2.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `tool/handoff-v2.js` (pure).
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Hand-off version 2: the writer and its check, per kind"`

### Task H2: The four fixtures, pinned

**Files:**
- Create: `tool/tests/fixtures/handoff-v2-finished.json`, `handoff-v2-raw.json`, `handoff-v2-session.json`, `handoff-v2-short-video.json`; `tool/tests/fixtures/make-handoff-v2.mjs` (writes them from `buildHandoffV2` and made-up records)
- Create or modify: `tool/tests/contract.test.js` (phase T's Task 4 creates it for version 1; if it is not on `main` yet, create it here with the version 2 pins only, and phase T adds version 1's beside them)
- Test: `tool/tests/contract.test.js`

**Interfaces:**
- Produces: four fixtures, each passing `handoffFaultV2`, each `srt` readable by `tidyTranscript`; the session fixture holds a Reel with `clientAgreed` and no transcript; the finished fixture a Reel with `fromSuggestion` and a suggestion it came from; the raw fixture `main.onPicture` and a suggestion whose `stretches` are two; their sha256 pinned, with the message `"<file>" changed. brimm-operations keeps a copy of it: ask Jason for a session there to copy it again, then set its hash here to <new>.` (the phase T plan's words).

- [ ] **Step 1: Write the failing test**: the four files exist, pass `handoffFaultV2`, and their hashes equal the pinned ones.
- [ ] **Step 2: Run** `cd tool && node --test tests/contract.test.js`. Expected: FAIL.
- [ ] **Step 3: Write** the fixtures with `node tests/fixtures/make-handoff-v2.mjs`, then pin their hashes.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Hand-off version 2's four fixtures, pinned: the contract with BRIMM Ops"` and send their paths to the managing session for the page's copy.

### Task H3: Suggestions on the final clock

**Files:**
- Modify: `tool/handoff-v2.js`
- Test: `tool/tests/handoff-v2.test.js`

**Interfaces:**
- Consumes: `timelineAt` from `tool/clock.js`.
- Produces: `suggestionsOnClock({ suggestions, words, clock }) => suggestion[]`: each suggestion's words (those of `words` inside its stretches, raw seconds) mapped through `clock`; kept when at least 70 in 100 are kept, with `start` and `end` its first and last kept word's mapped times and `stretches` the kept runs; left out otherwise; numbers kept.

- [ ] **Step 1: Write the failing tests**: a suggestion with no word cut maps by the clock's offset; one with 3 of 10 words cut is kept with its new `start` and two `stretches`; one with 4 of 10 cut is left out; numbers unchanged.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Reel suggestions mapped onto the final main video's clock"`

### Task H4: Revisions across ids, versions and both formats

**Files:**
- Modify: `tool/finish.js` (`lastRevision` 155)
- Test: `tool/tests/finish.test.js`

**Interfaces:**
- Produces: `lastRevision(finalDir, id)` counts a hand-off whose `episode.id` (version 1) or `video.id` (version 2) is `id`; `chainOf(root, record) => [{ folder, record }]`, the record and every episode reached by `versionOf` (reads only); `nextRevision(root, found) => number`, one above the highest of every `record.finished.revision` and `lastRevision` over the chain, keyed by the chain's first id; `handoffIdOf(root, record) => string`, the chain's first id.

- [ ] **Step 1: Write the failing tests**: a version 2 hand-off counts; a new version whose old folder's `final/` holds revision 3 gets revision 4 and the old id; reading the chain writes nothing (the stand-in clone records no call).
- [ ] **Step 2: Run** `cd tool && node --test tests/finish.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Revisions across both hand-off versions and a video's new versions"`

### Task H5: The finish writes version 2 once this Mac's settings say so

**Files:**
- Modify: `tool/finish.js` (`finishNow` 205, the hand-off at 340–365), `tool/edit.js` (`finishEpisode` 1237: the title refusal at 1247)
- Test: `tool/tests/edit-finish.test.js`, `tool/tests/finish.test.js`

**Interfaces:**
- Consumes: `buildHandoffV2`, `handoffFaultV2` (H1), `nextRevision`, `handoffIdOf` (H4), `settings.handoffVersion` (L1).
- Produces: with `handoffVersion` 2, `finish` writes version 2 for every kind (an `"episode"` record's kind written `"raw"`), no longer refuses an episode without an approved title, and keeps refusing a placeholder name only for raw videos (a finished video's name is its file's); with 1 or none, today's version 1, title and all.

- [ ] **Step 1: Write the failing tests**: the same finished episode finishes to version 1 with the setting off and to version 2 with it on; with 2, an episode with no title finishes; its hand-off passes `handoffFaultV2`; a raw episode's `main.onPicture` holds the lines of its name titles (`record.main.texts`), and a finished one has none.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "finish writes hand-off version 2 once this Mac's settings say so"`

---

## Part F: the fork, the readings and the session (pull request F)

### Task F1: One gate for every command (`gate.js`)

**Files:**
- Create: `tool/gate.js`
- Modify: `tool/edit.js` (`editMain` 2564; `COMMANDS` 2558)
- Test: `tool/tests/gate.test.js`, `tool/tests/edit-gate.test.js`

**Interfaces:**
- Produces: `UNSCOPED = ["episodes", "status", "behind", "retry"]` (they name no episode; their output is F2's); `UNANSWERED = ["kind", "leave", "which", "show", "release", "resolve"]`; `SESSION = [...UNANSWERED, "name"]`; `SESSION_TAUGHT = [...SESSION, "teachings", "principles", "ideas", "finish", "reel", "render"]`; `gateFor(command, record, { teachingsOn }) => ""` or the plain words of why: for a record with `kind` null, only `UNANSWERED`; for a session not cleared, `SESSION`, and `SESSION_TAUGHT` when `teachingsOn`. `editMain` resolves the episode a scoped command names (its first word, through `findEpisode`, which reads records only) and refuses before the command runs.

- [ ] **Step 1: Write the failing tests**

```js
test("every command is in a list, or refused for an unanswered and a session record", () => {
  for (const name of COMMAND_NAMES) {
    const scoped = !UNSCOPED.includes(name);
    if (!scoped) continue;
    const unanswered = gateFor(name, { kind: null, answer: { state: "needs your answer" } }, { teachingsOn: true });
    assert.equal(unanswered === "", UNANSWERED.includes(name), name);
    const session = gateFor(name, { kind: "session", session: { marked: AT, cleared: null } }, { teachingsOn: false });
    assert.equal(session === "", SESSION.includes(name), name);
  }
});
test("a command added later and named in no list is refused", () => {
  assert.notEqual(gateFor("somethingNew", { kind: null, answer: { state: "needs your answer" } }, {}), "");
});
test("edit.js refuses before the command reads anything", async () => { /* ask on an unanswered episode: refused, and no file of the episode was read (a stand-in readFileSync records paths) */ });
```

- [ ] **Step 2: Run** `cd tool && node --test tests/gate.test.js tests/edit-gate.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `tool/gate.js` and the check in `editMain`.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "One gate in edit.js for unanswered and session records"`

### Task F2: Labels in everything the chat sees

**Files:**
- Modify: `tool/edit.js` (`findEpisode` 176–196, `episodes` 260, `status` 869, `importLines` 247, result lines), `tool/unedited.js` (log lines that name the video for a light import: by its label), `tool/detached.js` (result files: label)
- Test: `tool/tests/edit-labels.test.js` (new)

**Interfaces:**
- Produces: `shownName(record) => string`: the label for a record with `kind` null or a session not cleared, the name otherwise; every list and message uses it; `findEpisode` matches a label (case and spacing ignored) and the short id, and its "The episodes are: …" list shows `shownName`.

- [ ] **Step 1: Write the failing test** (Review Focus 3): an episode imported lightly from `"Coaching call Jane Doe.mov"`; run every command name in `COMMAND_NAMES` with that episode's label (and with no words, for the unscoped ones) through `editMain` with stand-ins, and assert that nothing said, logged or written to a result file holds "Jane" or "Coaching". Then answer it "session" and run them again.
- [ ] **Step 2: Run** `cd tool && node --test tests/edit-labels.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `shownName` and use it at each place listed.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Labels, not file names, for unanswered and session videos, in every line the chat sees"`

### Task F3: `kind`, `leave` and `which`

**Files:**
- Modify: `tool/edit.js` (new commands; the claim helpers at 441–494 reused)
- Test: `tool/tests/edit-kind.test.js` (new)

**Interfaces:**
- Consumes: `claimFor`, `claimHeld` (`edit.js`), `startDetached` (`detached.js`), `kindOf`, the record fields (L2).
- Produces: `kind "<label>" finished|raw|clip|session --private yes|no [--version-of <id>] [--not-a-session] [--again]`: refuses unless both answers are given and agree (`session` with `yes`, anything else with `no`); refuses an answered record without `--again`; refuses, for a record whose `answer.came` is `zoom` or `sound`, any kind but session without `--not-a-session` (the skill asks the line first, spec 2); claims the episode as `open` does (write the claim, wait, read again); records `answer: { state: "answered", by, on, at, private }`, `kind`, `versionOf`; for `session`, the session mark and the name (F7); then starts the reading detached (`startDetached(ctx, { command: "read", folder })`) for every kind but session (whose reading starts with `teachings`), and waits in the foreground up to 90 seconds for its result, saying what Claude found when it comes; otherwise it says a notice will come. It refuses to start a reading on a Mac whose settings say `readings: false`: "Readings are off on this Mac: ask Jason." `leave "<label>"` sets `answer.state` to "not for brimm-video". `which "<label>"` opens the episode's video with `openApp("QuickTime Player", video)`.

- [ ] **Step 1: Write the failing tests**: both answers needed; disagreeing answers refused with "Those two answers disagree: say again whether it is a private session."; an answered record refused without `--again`; a Zoom record answered "raw" refused without `--not-a-session`; (Review Focus 2) the other Mac's claim refuses `kind` and starts no run; `leave` lists it apart in `episodes`; `kind … finished` starts one detached run named `read`.
- [ ] **Step 2: Run** `cd tool && node --test tests/edit-kind.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the three commands, and add them to `COMMANDS`.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "kind, leave and which: her answer, claimed, both questions required"`

### Task F4: The four requests and their readers (`readings.js`)

**Files:**
- Create: `tool/readings.js`
- Modify: `tool/notes.js` (export `OPENING`'s guard lines, `DATA`, `LINES`, `section`, `objectIn`, so `readings.js` shares them)
- Test: `tool/tests/readings.test.js`

**Interfaces:**
- Produces: `requestFor(kind, plan, about) => string` for `"finished"`, `"raw"`, `"session"`, `"short video"`; `readReading(kind, reply) => { suggestions?, spellings, decisions?, notes?, graphics?, principles?, recurringPrinciples?, reelIdeas?, about?, problems }`. Exact asks (spec 3): finished, up to eight suggestions of 15 to 90 seconds, each `{ from, to, first, last, why, point }` by phrase ids, and spellings `{ heard, spelled, why }`, nothing else; raw, `notesRequest`'s keys less `"title"`, plus `"spellings"` and each clip's `"point"`; session, frameworks `{ name, category, description, steps, red_flags, green_flags, decision_criteria, example_application, verbatim_key_phrases, source_context }`, `recurring_principles`, and `reel_ideas` `{ from, to, idea, words, why, refilm: true|false }`, with the line "Of every field: no client's name, business, industry, numbers or story." and no `File:` line; short video, spellings and `about` (one line).

- [ ] **Step 1: Write the failing tests**: each request holds the guard lines (`DATA`); the session request holds no "File:" and holds the every-field line; the finished request asks for no title, notes, graphics or decisions; each reader takes a good reply and names what it could not read in a bad one, as `readNotes` does.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement** `tool/readings.js` (pure).
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "readings.js: one request and one reader per kind"`

### Task F5: The reading's detached run (`reading.js`)

**Files:**
- Create: `tool/reading.js`
- Modify: `tool/unedited.js` (export `askOnce` 313 taking a request; `roughCut` 357), `tool/edit.js` (`read` as a detached command, as `ask` is), `tool/reels.js` (`REELS_VERSION` 2 for crop-less candidates)
- Test: `tool/tests/reading.test.js`

**Interfaces:**
- Consumes: `requestFor`, `readReading` (F4); `pausesOfPlan` (L5); `applyDecisions`, `clipRanges` (`notes.js`); `importHolds` (`unedited.js:1441`); `roughCutArgs`, `roughCaptions` (`cuts.js`); `timelineFor` (`timeline.js`).
- Produces: `readEpisodeNow(ctx, found, deps) => { ok, made, failed, next }` (the run's result). It waits while `importHolds` says the import still holds the video (a raw reading only), reads the record again and stops if the kind, the session or the claim changed, calls Claude once with `requestFor`, and writes by the rule: for every kind, `<stem>.reel-suggestions.txt` (not for a session or a clip) and `reels.json` at version 2 (candidates with no crops, `title` ""), the spellings as `record.offers.spellings`, `record.reading`; for raw, the plan changed with the plan's pauses, its `.txt`, the rough cut's captions, the rough cut rendered by `roughCutArgs` into `~/BRIMM Video Work/<folder>/renders/<shownName> – version 0.mp4`, `edit/main.v0.fcpxml` from `timelineFor`, and `main.pushed: [{ v: 0, how: "render", … }]`; for a session, F7's files. When done it posts `Claude has read ${shownName}: say "what did Claude find?"`.

- [ ] **Step 1: Write the failing tests**: (Review Focus 1) a raw reading started while a pending late check holds the video waits and replaces nothing until it is cleared; a finished reading writes the suggestions and offers and no plan; a raw reading's plan keeps the pauses; a reading stops when the record's kind changed meanwhile; a candidate with no crops reads back from `reels.json` version 2; an older reader told version 2 says "a newer brimm-video wrote it".
- [ ] **Step 2: Run** `cd tool && node --test tests/reading.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The reading's detached run, one Claude call per kind; raw's rough cut as version 0"`

### Task F6: The spellings card, and the finished video's hand-off after it

**Files:**
- Modify: `tool/edit.js` (`spell` 2302: several pairs; new `offers` answer), `tool/finish.js` (a `finishFinished(ctx, found)` path that writes `record.finished` and `final/` as `finishNow` does, from the import's own transcript)
- Test: `tool/tests/edit-spellings.test.js` (new), `tool/tests/finish.test.js`

**Interfaces:**
- Consumes: H1, H4, H5.
- Produces: `spell "<video>" add "<heard>" "<spelled>" [add …]…` takes several pairs and writes one change (one hand-off revision); `spell "<video>" offers all|none|<n> <n>…` answers the reading's offers; once answered (none counts) for a finished video or a clip, the hand-off is written in `finishNow`'s shape (`record.finished` with `parts.main`, `final/<stem>.srt`, `.transcript.txt`, the hand-off) at revision `nextRevision`, and shown in Finder.

- [ ] **Step 1: Write the failing tests**: three pairs in one `spell` make one revision; answering "none" writes the hand-off once; a later `spell` remakes it as the next revision (as `saveSpellings` does after a finish).
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The spellings card; a finished video's hand-off once it is answered"`

### Task F7: The session: label, training gate, teachings, approval (`sessions.js`)

**Files:**
- Create: `tool/sessions.js`
- Modify: `tool/edit.js` (`teachings`, `principles`, `ideas`; `kind … session` renames to the label), `tool/reading.js` (the session branch), `tool/finish.js` (a session's finish)
- Test: `tool/tests/sessions.test.js`, `tool/tests/edit-session-mark.test.js` (new)

**Interfaces:**
- Produces (pure, `sessions.js`): `replaceSpeakers(zoomText, sallie = "Sallie") => { text, map }`; `visibleNames({ map, fileName, words, show, spellings }) => string[]`; `checkNames(reading, names) => { kept, dropped: [{ field, why }] }` over every field; `approve(items, said) => items` for `keep 1 3`, `drop 2`, `edit 3 --name "…"`; `undecided(session) => string[]`.
- Produces (`edit.js`): `kind … session` sets `name` to `sessionLabel` and `session.marked`; `name` on a session refuses words holding any of `visibleNames`; `teachings "<label>"` refuses unless `teachingsOn(settings, now)` and `claude auth status`'s account (read by a stand-in in tests) is the one recorded, then starts `read`; `principles "<label>" [keep|drop|edit …]` and `ideas "<label>" [keep|drop …]`; a session's `finish` refuses while `undecided` is not empty, then writes the session hand-off (H1) of approved items only, the name check run again on it.

- [ ] **Step 1: Write the failing tests**: the name becomes "Session, 2026-10-22"; teachings refused with the gate off, with the account changed, and after 90 days; a speaker's name in `example_application` drops that field and says so; the show's names and the episode's spellings do not trip it; the session hand-off holds only approved items, no `source_context`, and no key outside the contract; `finish` refuses with "Principle 2 is not decided yet: keep it or drop it."
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Sessions: the label, the training gate, teachings, and approval item by item"`

### Task F8: The dialogs Claude cannot press (`dialog.js`)

**Files:**
- Create: `tool/dialog.js`
- Modify: `tool/edit.js` (`kind … --clear-session`; `reel … --client-agreed`, recorded for phase V's `reel make`)
- Test: `tool/tests/dialog.test.js`

**Interfaces:**
- Produces: `askDialog(text, { buttons = ["Cancel", "Clear it"], answer = false, run }) => Promise<{ button, text? }>`: `osascript -e 'display dialog …'`, waiting for her click; `run` is a stand-in in tests. `--clear-session` shows "This was marked a client or group session. Clearing it lets Claude read its words and lets its transcript go to the BRIMM Ops page. Clear it?", and on "Clear it" records `session.cleared` with `confirmed: "dialog"`; `--client-agreed` asks who agreed and when, writes who into `~/BRIMM Video Work/<folder>/agreements.txt`, and records only the date.

- [ ] **Step 1: Write the failing tests**: with the stand-in answering "Cancel", nothing changes; with "Clear it", the record says so and the log names the episode by id; the agreement's "who" is in `agreements.txt` and in no record or hand-off.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Dialogs Claude cannot press: clearing a session, a client's agreement"`

### Task F9: Corrections, `ask`, `show`, times and versions

**Files:**
- Modify: `tool/edit.js` (`kind --again`; `ask` 2035; `show` 1549; the push guard `guardOf` 733; `push` 770), `tool/timeline.js` (`clockFor` 185, `piecesOf` 77), `tool/reels.js` (`reelsText` 270)
- Test: `tool/tests/edit-corrections.test.js` (new), `tool/tests/timeline.test.js`, `tool/tests/edit-show.test.js`, `tool/tests/reels.test.js`

**Interfaces:**
- Produces: `kind … --again` sets aside the reading's files and every file in `final/` into `history/` by the rule; to session, it also writes at once a session hand-off with nothing in it at `nextRevision`, and shows it in Finder. `ask` on a layout-3 record runs `kind … --again` with its own kind, and is refused for unanswered and session records. `show` of an unanswered or session record copies the file into `~/BRIMM Video Work/<folder>/shown/`, makes it read-only, and opens it in TextEdit; nothing is printed. `clockFor`: for finished, short video and session, the whole video is kept; the newest version on this Mac by `at` among `pushed` (renders and pushes); `guardOf` asks only when the newest is a push. `reelsText` writes from `reels.json` on the current clock, "cut now" for a suggestion's words cut.

- [ ] **Step 1: Write the failing tests** for each.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Corrections, ask, show, times on the current clock, renders as versions"`

### Task F10: Her folder: the skill, the card, `defaultMode`

**Files:**
- Modify: `tool/studio/SKILL.md`, `tool/studio/CLAUDE.md`, `tool/studio.js` (`settingsOf` 24: `defaultMode: "default"`), `CLAUDE.md` (the repo's: one line, on Jason's yes in the pull request: "Never read an unanswered or session episode's transcript, plan, principles or Zoom files.")
- Test: `tool/tests/studio.test.js`, `tool/tests/studio-ready.test.js`

**Interfaces:**
- Produces: the skill's rows: at session start and on "what's waiting?", for each video needing an answer, one `AskUserQuestion` card with the two questions (spec 2), the guess first, "Client or group session" always and never first; for `came` zoom or sound, the extra line before `--not-a-session`; "what did Claude find?"; the spellings card; `which`, `leave`, `teachings`, `principles`, `ideas`; "never rate, report or share a chat about a session". The card's wording is a proposal, marked so in the skill, for Jason and Sallie to settle (Jason: "not sure").

- [ ] **Step 1: Write the failing tests**: the skill names every new command; the settings' `defaultMode` is "default"; the deny and the guard are unchanged.
- [ ] **Step 2: Run**. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Her folder: the card, the new commands, defaultMode default"`

---

## Part D: the new drop folder (pull request D)

### Task D1: `Drop/<Mac>/`

**Files:**
- Modify: `tool/install.sh` (the drop folder, the marker, the plist; `settings.js write` at 458), `tool/edit.js` (`episodes` 290: the other Mac's drop folder from settings; `retry` 966), `README.md`
- Test: `tool/tests/install.test.js` (`--print` only), `tool/tests/edit.test.js`

**Interfaces:**
- Consumes: `dropFolder(root, machine, folder)` and `settings.drop` (L1).
- Produces: `install.sh --drop Drop …` makes `Drop/<Mac>/`, marks it, points the agent at it, writes `drop: "Drop"`; it refuses while the old folder holds a video, or a status of the old folder is failed or holds a problem, naming them. `--import light`, `--handoff 2` and `--rules-only` (as `readings: false`) are written into the settings. `episodes` and `retry` use the settings' folder. Phase T's `install-transcribe.sh` refuses `BRIMM Video/` already (its ruling 6): no change there.

- [ ] **Step 1: Write the failing tests**: `--print --drop Drop` says what it would make and point at; with a video in the old folder it refuses and names it; `episodes` lists the other Mac's `Drop/<Mac>/` when its settings say Drop.
- [ ] **Step 2: Run** `cd tool && node --test tests/install.test.js tests/edit.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `cd tool && node --test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "The drop folder Drop/<Mac>, switched by the installer"`

---

## The switch itself (Jason, after P, L, H, F and D are merged)

Not a code task. Each step on Jason's yes.

1. The page reads version 2 and is published (BRIMM Ops' phase P).
2. On the Mac Studio, with nothing at work (`launchctl list | grep com.thebrimm` shows `-` for both agents): `git pull` in the main checkout.
3. `cd tool && ./install.sh --print --machine "Mac Studio" --drop Drop --import light --handoff 2 "<BRIMM Video>"`, read with Jason; then without `--print`. Her folder is written again, and the setup guide's lock-down check made again.
4. `node tool/settings.js sessions --teachings on --cli-account … --app-account …`, once Jason has checked both accounts' training setting.
5. Her laptop, in one sitting with the Mac Studio, the same steps (Jason said to set her laptop aside for now: until then her laptop stays as it is, and nothing is dropped in its folder).
6. One drop of each kind from Jason's test recordings, never Sallie's episodes; the card in the Code tab (phase R1's check).

## Self-review (against the spec)

- Spec 1: folders (D1), the light import (L6), labels (L3, F2), the guess (L3), the match and identity (L4, H4), layout 3 (L2), episodes before the switch (L2's `kindOf`, F9's `ask`). Zoom held until Z (L7).
- Spec 2: the card (F10), `kind` with both answers, the claim, the Zoom line (F3), the one call (F4, F5), `ask` (F9), readings switched off (L1, D1), corrections (F9), the session mark, training gate, teachings (F7), the gate (F1), labels in logs (F2), the dialogs (F8).
- Spec 3: each kind's reading (F4, F5, F6, F7), suggestions and `reels.json` version 2 (F5), times and the version model (F9), "show me the transcript" (F9's `show`). `reel make`, previews by request and the faces over a Reel's stretches: phase V.
- Spec 7: `defaultMode` (F10); the rest of the lock is phase K.
- Spec 8: H1 to H5, the fixtures sent to the page (H2).
- Not here, by the spec's phases: the renderer, `render`, `reel make`, fine edits, cards, the finish without Final Cut (V, after R0 and R2); Assets (A); the lock as a list (K); Zoom sets (Z); option b (B).
