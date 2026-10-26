# brimm-video: the guide's times, "tell me when", and its review's four fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, in this session (no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie's notes of 25 Oct, 1 and 2, on top of the guide (`claude/guide-mode`, 8504bb4). The guide gives clock times while a video is imported or waits for Claude. `guide "<video>" tell` waits in the background, up to 60 minutes, for that video's next point and says it in one line. Also the guide's whole-branch review's four minor findings.

**Architecture:** As in the guide. `tool/guide.js` stays pure: it gets the times as clock words (edit.js formats them with `clockAt`). It also says what `tell` says at each look (`told`) and how it follows a video (`follow`). edit.js reads the panel's run files and `rates.json` (progress.js), and runs the wait. Nothing new is installed, and her lock is unchanged: `tell` is a word of `guide`. So the guard sees the same `edit.js` command, whether or not the Bash call has `run_in_background`.

**Tech Stack:** Node 22, ES modules, `node:test`, no packages.

**Sources:** Sallie's notes triage and the research (lens "timing", notes 1 and 2): `brimm-video-sallie-notes-triage-2026-10-25.md` and `brimm-video-sallie-notes-research-2026-10-25.json`, in the managing session's notes. The guide's plan: `docs/superpowers/plans/2026-10-25-brimm-video-guide.md`.

## The design, and its rulings

1. **Clock times, not a countdown.** A chat message cannot tick, but a clock time stays true while it sits there. Times are on this Mac's clock, as `HH:MM`, the way `clockAt` says them (the form `kind` already uses). A time is said only from a speed this Mac measured. With none, nothing is guessed.
   - **Importing, on this Mac:** "Ready about 15:06.", added after the time left. It is now plus the panel's "left in all" (`run.total`). On the last step the panel gives no "in all", so it is now plus that step's time left (`readyIn`). The other Mac's import has no time, since its panel is not this Mac's.
   - **A raw video waiting for the import's late check:** "Claude starts reading it about 10:58, once the import has checked its copies. Its rough cut is ready about 11:15."
     - The start is `lateCheckAt`, as today.
     - The rough cut is the start, plus the video's seconds times the speeds of "Asking Claude" and "Making the rough cut" in `rates.json` (`roughIn`). The import measured both: the Mac Studio has 0.309 and 0.120 seconds a second, about 17 minutes for a 40-minute video.
     - With either speed missing, it says the start alone.
   - **A raw reading already running but still held by the check** now reads as "later", with its times. Today it says "Claude is reading it", which is not yet so.
   - **Once Claude is at work**, no time is said: when the run began is not kept. That is so once the check is made, and for any finished video, iPhone clip or session. The notice comes as before.
   - Jason's default call holds: **the progress panel does not show Claude's reading**, and the reading is not measured again. `kind`'s own line ("Claude reads it at 10:58") is not changed.
2. **`guide "<video>" tell`** is a word after the video, as `show` and `finished` are. It reads the guide again every 15 seconds, for up to 60 minutes: 240 reads, not the 720 that 5 seconds would make. It prints exactly one line, at the end, then ends with 0. It ends with 1 only when it refuses: no video fits, or the Mac is not on the light import.
   - It waits only while the video is at a stage where something is on its way (`COMING`): coming into a drop folder, being imported, or Claude's reading (`reading-later`, `reading`, `session-reading`).
   - It ends at the video's next point:
     - **ready:** it left the drop folder for Episodes;
     - **read:** Claude's reading is in;
     - **did not finish:** its import failed, stopped or found a problem in its late check (the drop folder's "retry"), or its reading did not finish. A late check that finds a problem stops a raw reading at once (unedited.js `importHold`). So "a late-check problem" reaches her either way;
     - **any other change:** its next step, as the guide says it;
     - **gone:** it is no longer under way.
   - A video with nothing on its way gets its next step at once. One still on its way after 60 minutes gets "Nothing has changed in 60 minutes." and its next step.
   - **A running finish is not waited for** (it is not in `COMING`): the guide cannot tell a finish that failed from one not begun.
   - **It follows a video from its drop folder into Episodes:**
     - While the video is in a drop folder, by its Mac and file. Its size grows as it comes in.
     - After that, by the answered video holding a file of that name and size, as the import files it, newest first. This is the key `holdingEpisode` uses.
     - From then on, by that video's id.
     - The file's name is in the facts as `source`, and is never said.
   - **No notice of its own, and nothing to her phone** (Jason's default call). The import's "Ready" notice and the reading's "Claude has read" notice come as before, on the Mac doing the work. Her skill says so.
   - **Her skill runs it** with the Bash tool's run_in_background, once per video, and never with Monitor (denied).
     - Her session cannot stop it (TaskStop is refused), so its 60-minute limit is firm.
     - Asking twice for one video would run two waits, so the skill says once per video.
   - **`guide wait`** (90 seconds) stays for "is it ready?".
3. **(a) `guide wait` answers at once** when no video under way is at a `COMING` stage, since nothing will change by itself. It says the overview alone, with no "Nothing has changed" line and no wait.
4. **(b)** Her skill says "`guide page` the first time in this chat". There, "session" means a client or group session.
5. **(c)** An import's step in the middle of a sentence starts with a lower-case letter: "at writing the transcript", "at filing".
6. **(d)** Only two videos with no label yet that share a name are renamed. Such a name is "A video of 5 bytes", so the two are the same size.
   - Each gets "that came at 14:58": when this Mac's import first saw it, or else the file's ctime, as now.
   - Two that still share a name (the same minute) also get a number, in the order they came: "(1)", "(2)".
   - A lone unlabelled video keeps its name, and a file's name is never used.
   - `episodes`' own drop lines are not changed: the finding was the guide's.
7. **Left for Jason's check by hand** (setup notes, Task 8), in her Code tab:
   - that a background wait of more than 30 minutes is not cut off;
   - that its line reaches the chat while the chat is idle;
   - whether the Claude app also shows a notice of its own.

## Global Constraints

- Work only in this worktree. Never edit, check out or run anything in `/Users/jasonogden/Claude Code/BRIMM video` itself, nor in any other worktree. Never push. Run `tool/install.sh` only with `--print` (this plan needs no installer change).
- Node 22, no packages. `cd tool && node --test` passes after every task: 3320 tests passed at 8504bb4. Write the failing test first, see it fail, then write the code.
- No test calls the real `claude`, opens an app or page, or waits. `openApp`, `run` and `wait` are the stand-ins of `tests/episodes.js setup`, and the clock moves only through `wait`. Each test has its own root and home in the system's temp folder, so nothing is written into Dropbox or `~/Library`. Never read a `.env`.
- Her lock is unchanged: no change to `tool/studio.js`, `tool/studio/guard.*` or `COMMAND_NAMES`. Monitor stays denied.
- Nothing printed holds a path, a flag, a command name or a file's name. Sentences are under 25 words (guide.test.js checks every stage text). Use the surrounding code's plain English, in comments too.
- Her skill stays under 160 lines: it is 144 now, and 145 after this plan. "## Guide her" stays at 30 lines at most: it is 15 now, and 16 after.
- While PR #40 is open, keep clear of its lines, as the guide's plan lists them:
  - `tool/edit.js` line 33, and lines 2228–2350;
  - `tool/studio.js`;
  - README lines 263 and 304;
  - `docs/setup/sallies-laptop.md` lines 41–44, 54 and 67;
  - `tool/tests/episodes.js` and `tool/tests/edit-show.test.js`.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`tell` never says a file's name.** It follows a video by its file's name and size, inside the code (`source`). Pinned in Task 7 (`doesNotMatch /Jane|Client|\.mov/`) and the privacy walk in edit-labels.test.js.
2. **`tell` always ends with one line**, never with nothing: at the 60-minute limit, when a video is gone, and when a video is done. Pinned in Tasks 6 and 7.
3. **The step from the drop folder into Episodes** finds the right episode: the newest by import time with the file's name and size. A file of the same name in the other Mac's drop folder is another video. Pinned in Task 6.
4. **No time is guessed.** None without a measured speed, none for the other Mac's import, and none once Claude is at work. Pinned in Tasks 2 and 3.
5. **`guide wait` answers at once only when nothing is on its way.** An arriving file is still waited for: the existing 90-second tests stay.

---

### Task 1: (c) an import's step, mid-sentence, in lower case

**Files:** Modify `tool/guide.js` (`dropNext`), `tool/tests/guide.test.js`, `tool/tests/edit-guide.test.js`.

- [ ] **Step 1: Change the expected strings (the failing tests)**

In `tool/tests/guide.test.js` STAGE_ROWS, "at Writing the transcript" becomes "at writing the transcript" in the three importing rows:

```js
  [DROP({ state: "importing", step: "Writing the transcript", left: 180, total: 360 }), "importing", 'It is being imported, at writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'],
  [DROP({ state: "importing", step: "Writing the transcript", left: 180 }), "importing", 'It is being imported, at writing the transcript, about 3 minutes left of this step. Wait for the "Ready" notice.'],
  [{ ...DROP({ here: false, state: "importing", step: "Writing the transcript" }), mac: "Mac Studio" }, "importing", 'It is being imported on the Mac Studio, at writing the transcript. Wait for the "Ready" notice on that Mac.'],
```

In `tool/tests/edit-guide.test.js`:
- "names each video waiting there…": `'  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at writing the transcript, about 6 minutes left in all. Wait for the "Ready" notice.'`
- "says a video being imported… on the other Mac…": `"  Video of 20 Oct, 14:50 (Sallie's laptop): It is being imported on Sallie's laptop, at writing the transcript. Wait for the \"Ready\" notice on that Mac."`
- "waits in steps of 5 seconds…": `'  Video of 20 Oct, 15:00 (Mac Studio): It is being imported, at reading the sound. Wait for the "Ready" notice.'`

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/guide.test.js tests/edit-guide.test.js`
Expected: 4 tests FAIL: "is the one its stage gives, in her words" and the three above. Each has `at Writing` or `at Reading` where `at writing` or `at reading` is wanted.

- [ ] **Step 3: Write the code**

In `tool/guide.js`, beside `toDo`:

```js
/** A step as the panel says it ("Writing the transcript"), put in the middle of a sentence: its first letter in lower case. */
const midSentence = (step) => step[0].toLowerCase() + step.slice(1);
```

In `dropNext`, `${drop.step ? `, at ${drop.step}` : ""}` becomes `${drop.step ? `, at ${midSentence(drop.step)}` : ""}`.

- [ ] **Step 4: Run them to see them pass.** Then run the whole suite: `cd tool && node --test`. Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tool/guide.js tool/tests/guide.test.js tool/tests/edit-guide.test.js
git commit -m "The guide's times and tell, task 1: an import's step, mid-sentence, in lower case

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The times in her words (tool/guide.js)

**Files:** Modify `tool/guide.js`, `tool/tests/guide.test.js`.

**Produces:**
- `READING_STEPS: ["Asking Claude", "Making the rough cut"]`: the names of the import's steps in `rates.json`. A raw reading's time is made of their speeds.
- `readyIn({ left, total, n, of }): number | null`: seconds until Ready, from the panel's run.
- `roughIn(rates: object, seconds: number): number | null`: seconds from the start of Claude's reading of a raw video to its rough cut, rounded.
- VideoFacts gains `drop.readyAt` and `roughAt`: clock words ("15:06"), or "" when not known.

- [ ] **Step 1: Write the failing tests**

- Import `readyIn, roughIn, READING_STEPS` from `../guide.js`.
- Add `roughAt: ""` to `BASE`, and `readyAt: ""` to the `drop` of `DROP`.
- Add these STAGE_ROWS, and change the `reading-later` row:

```js
  [DROP({ state: "importing", step: "Writing the transcript", left: 180, total: 360, readyAt: "15:06" }), "importing", 'It is being imported, at writing the transcript, about 6 minutes left in all. Ready about 15:06. Wait for the "Ready" notice.'],
  [DROP({ state: "importing", step: "Filing", left: 120, readyAt: "15:02" }), "importing", 'It is being imported, at filing, about 2 minutes left of this step. Ready about 15:02. Wait for the "Ready" notice.'],
  [RAW({ reading: "later", readsAt: "10:58" }), "reading-later", "Claude starts reading it about 10:58, once the import has checked its copies. A notice comes when it is done."],
  [RAW({ reading: "later", readsAt: "10:58", roughAt: "11:15" }), "reading-later", "Claude starts reading it about 10:58, once the import has checked its copies. Its rough cut is ready about 11:15. A notice comes when it is done."],
```

- Add a new describe:

```js
describe("the times the guide gives", () => {
  it("are from the panel's run and this Mac's speeds, and none while one is not known", () => {
    assert.deepEqual(READING_STEPS, ["Asking Claude", "Making the rough cut"]);
    assert.equal(readyIn({ left: 180, total: 360, n: 2, of: 4 }), 360);
    assert.equal(readyIn({ left: 120, total: null, n: 4, of: 4 }), 120);
    assert.equal(readyIn({ left: 120, total: null, n: 2, of: 4 }), null);
    assert.equal(readyIn({ left: null, total: null, n: 4, of: 4 }), null);
    assert.equal(readyIn({ left: 30, total: null, n: null, of: null }), null);
    assert.equal(roughIn({ "Asking Claude": 0.31, "Making the rough cut": 0.12 }, 2400), 1032);
    assert.equal(roughIn({ "Asking Claude": 0.31 }, 2400), null);
    assert.equal(roughIn({ "Asking Claude": 0.31, "Making the rough cut": 0.12 }, undefined), null);
    assert.equal(roughIn({}, 2400), null);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tool && node --test tests/guide.test.js`
Expected: FAIL, `does not provide an export named 'READING_STEPS'`.

- [ ] **Step 3: Write the code**

```js
/** The steps of the import whose speeds (progress.js RATES) a raw reading's time is made of: its Claude call and its rough cut. */
export const READING_STEPS = ["Asking Claude", "Making the rough cut"];

/** Seconds until an import on this Mac is Ready, from its run in the panel (progress.js): the time left in all, or on its last
    step, where the panel gives none, the time left of that step. Null when it is not known. */
export function readyIn({ left, total, n, of }) {
  if (Number.isFinite(total)) return total;
  return Number.isFinite(left) && Number.isInteger(n) && n > 0 && n === of ? left : null;
}

/** Seconds from the start of Claude's reading of a raw video `seconds` long to its rough cut, by the speeds this Mac measured
    (`rates`, progress.js readRates), rounded. Null while either speed, or the video's length, is not known. */
export function roughIn(rates, seconds) {
  const speeds = READING_STEPS.map((step) => rates[step]);
  if (!(seconds > 0) || !speeds.every((s) => Number.isFinite(s) && s > 0)) return null;
  return Math.round(speeds.reduce((sum, s) => sum + s * seconds, 0));
}
```

In `dropNext`'s importing branch, the existing `ready` sentence (`Wait for the "Ready" notice${there}.`) stays. The text becomes:

```js
const readyAt = drop.readyAt ? ` Ready about ${drop.readyAt}.` : "";
return toDo("importing", `It is being imported${on}${drop.step ? `, at ${midSentence(drop.step)}` : ""}${left ? `, ${left}` : ""}.${readyAt} ${ready}`);
```

The `reading-later` step becomes:

```js
toDo("reading-later", `Claude starts reading it about ${facts.readsAt}, once the import has checked its copies.${facts.roughAt ? ` Its rough cut is ready about ${facts.roughAt}.` : ""} A notice comes when it is done.`)
```

In the VideoFacts comment, document:
- `drop.readyAt`: "the time it should be Ready, as this Mac's clock says it, "" when not known".
- `roughAt`: "for a raw video whose reading waits (`later`), the time its rough cut should be ready, "" when not known".

- [ ] **Step 4: Run it to see it pass.** Then run `cd tool && node --test`. Expected: PASS. edit.js gives no `readyAt` or `roughAt` yet, so nothing it says changes except the wording of reading-later. No edit-level test asserts that wording.

- [ ] **Step 5: Commit** `tool/guide.js tool/tests/guide.test.js`: "The guide's times and tell, task 2: Ready about, and when Claude starts and its rough cut, in her words".

---

### Task 3: The times from this Mac's runs and speeds (tool/edit.js)

**Files:** Modify `tool/edit.js` (`guideDrops`, `guideReading`, `guideFacts`, `guideItems`; the imports), `tool/tests/edit-guide.test.js`.

- [ ] **Step 1: Write the failing tests**

Add to the imports:
- `rmSync` (node:fs)
- `clockAt` (`../unedited.js`)
- `RATES` (`../progress.js`)
- `writePending` (`../filing.js`)
- `pendingFolder` (`../settings.js`)
- `lockOf` (`../detached.js`)

In "names each video waiting there…", the importing line becomes:

```js
`  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at writing the transcript, about 6 minutes left in all. Ready about ${clockAt(t.now() + 360000)}. Wait for the "Ready" notice.`
```

"says a video being imported… on the other Mac…" also asserts `assert.doesNotMatch(r.said.join("\n"), /Ready about/)`.

A new test in "guide, from the drop folders":

```js
  it("says when a video importing on this Mac should be ready: by the time left in all, or on its last step by that step's, and gives no time while a later step's speed is not known", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    statusOf(t, { import: "d1", video: "Client Jane.mov", step: "Filing", label: "Video of 20 Oct, 14:58 (Mac Studio)", pid: 4242 });
    mkdirSync(progressFolder(t.home), { recursive: true });
    const run = (over) => writeFileSync(join(progressFolder(t.home), "4242.json"), JSON.stringify({ version: 1, pid: 4242, video: "Video of 20 Oct, 14:58 (Mac Studio)", step: "Filing", n: 4, of: 4, percent: 50, left: 120, total: null, detail: "", started: 0, updated: 0, ...over }));
    const deps = light(t, { alive: (pid) => pid === 4242 });
    run({});
    assert.equal((await on(deps, "guide")).said[2], `  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at filing, about 2 minutes left of this step. Ready about ${clockAt(t.now() + 120000)}. Wait for the "Ready" notice.`);
    run({ n: 2 });
    assert.equal((await on(deps, "guide")).said[2], '  Video of 20 Oct, 14:58 (Mac Studio): It is being imported, at filing, about 2 minutes left of this step. Wait for the "Ready" notice.');
    t.done();
  });
```

A new test in "guide, from the records":

```js
  it("says when Claude starts reading a raw video, once the import has checked its copies, and when its rough cut is ready, from this Mac's speeds; and no time once Claude is at work", async () => {
    const t = setup();
    const found = episodeAs(t, { id: "e-20261020-c2c2c2", name: "2026-10-20 Long talk (Mac Studio)", record: { kind: "raw", answer: ANSWERED, name: { text: "Long talk", placeholder: false }, video: { file: "Long talk.mov", bytes: 5, seconds: 2400, recorded: "2026-10-20", recordedFrom: "import" }, main: MAIN([]), ...imported("10:30") } });
    writePending(t.home, { version: 1, id: found.record.id, name: found.name, folder: found.folder, video: "Long talk.mov", bytes: 5, seconds: 2400, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: "Mac Studio", planTxt: "x.txt" });
    const due = t.now() + 10 * 60 * 1000;
    const STARTS = `Long talk (c2c2c2): Claude starts reading it about ${clockAt(due)}, once the import has checked its copies.`;
    const ROUGH = `Its rough cut is ready about ${clockAt(due + 1032 * 1000)}.`;
    const NOTICE = "A notice comes when it is done.";
    // No speed measured yet: the time it starts alone.
    assert.deepEqual((await on(light(t), "guide", "Long talk")).said, [`${STARTS} ${NOTICE}`]);
    mkdirSync(progressFolder(t.home), { recursive: true });
    writeFileSync(join(progressFolder(t.home), RATES), JSON.stringify({ "Asking Claude": 0.31, "Making the rough cut": 0.12 }));
    assert.deepEqual((await on(light(t), "guide", "Long talk")).said, [`${STARTS} ${ROUGH} ${NOTICE}`]);
    // Her answer started its reading, which waits for the check: the same times, not "Claude is reading it".
    mkdirSync(dirname(lockOf(t.home, found.name)), { recursive: true });
    writeFileSync(lockOf(t.home, found.name), JSON.stringify({ pid: 777, command: "read" }));
    const reading = light(t, { alive: (pid) => pid === 777 });
    assert.deepEqual((await on(reading, "guide", "Long talk")).said, [`${STARTS} ${ROUGH} ${NOTICE}`]);
    // The check made, Claude is at work: when it began is not kept, so no time.
    rmSync(join(pendingFolder(t.home), `${found.record.id}.json`));
    assert.deepEqual((await on(reading, "guide", "Long talk")).said, ['Long talk (c2c2c2): Claude is reading it. A notice comes when it is done; then say "what did Claude find?".']);
    t.done();
  });
```

A record's `video` must have `recorded` and `recordedFrom`, as the existing "Filed.mov" one does: a record with another shape is not read. This was checked on 8504bb4.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-guide.test.js`
Expected: 3 tests FAIL:
- no "Ready about" in the two drop tests;
- in the raw test, no "Its rough cut is ready about", and "Claude is reading it" where the held reading's times are wanted.

- [ ] **Step 3: Write the code**

- Imports: `readRates` beside `progressFolder` (line 41), and `readyIn, roughIn` from `./guide.js`.
- `guideDrops`: each drop's facts gain `readyAt: run && readyIn(run) !== null ? clockAt(now + readyIn(run) * 1000) : ""`. A run is only ever this Mac's own, as today. Its comment says so: "and when it should be Ready, from the same run".
- `guideItems`: read the speeds once, with `const rates = readRates(progressFolder(ctx.home));`. Pass them to `guideFacts(ctx, e, links, rates)` and on to `guideReading(ctx, e, r, kind, running, rates)`.
- `guideReading`: work out `due` before the running check. A raw reading that is running while the check still holds it reads as later:

```js
  const due = kind === "raw" ? lateCheckAt(ctx, r) : null;
  /** A raw reading that waits for the import's late check: when Claude starts, and when its rough cut should be ready. */
  const later = () => {
    const rough = roughIn(rates, r.video && r.video.seconds);
    return { reading: "later", readsAt: clockAt(due), roughAt: rough === null ? "" : clockAt(due + rough * 1000) };
  };
  if (running === "read") return due === null ? { reading: "running" } : later();
  // …the failed check as today…
  return due === null ? { reading: "none" } : later();
```

  Its comment says it is "later", with `roughAt`, also while this Mac's reading runs but the check still holds it. Once the check is made it is "running", with no time, since when the run began is not kept.

- [ ] **Step 4: Run it to see it pass.** Then run `cd tool && node --test`. Expected: PASS.

- [ ] **Step 5: Commit** `tool/edit.js tool/tests/edit-guide.test.js`: "The guide's times and tell, task 3: the times from this Mac's panel and measured speeds, and a held reading is not yet reading".

---

### Task 4: (d) two videos with no label yet, told apart

**Files:** Modify `tool/guide.js` (`apart`), `tool/edit.js` (`guideDrops`), `tool/tests/guide.test.js`, `tool/tests/edit-guide.test.js`.

**Produces:** `apart(videos: { name, at, aliases }[], clock: (ms) => string)`, which gives back the same list, renamed. Empty `aliases` means the video has no label yet.

- [ ] **Step 1: Write the failing tests**

In `tool/tests/guide.test.js`, importing `apart`:

```js
describe("the names of videos with no label yet", () => {
  it("tell apart two of one size by when they came, and by a number when that is the same minute; never by a file's name", () => {
    const v = (name, at, aliases = []) => ({ name, at, aliases });
    assert.deepEqual(apart([v("A video of 5 bytes", 1), v("A video of 5 bytes", 2), v("A video of 9 bytes", 3), v("Video of 20 Oct, 14:58 (Mac Studio)", 4, ["Video of 20 Oct, 14:58 (Mac Studio)"])], (ms) => `t${ms}`).map((x) => x.name),
      ["A video of 5 bytes that came at t1", "A video of 5 bytes that came at t2", "A video of 9 bytes", "Video of 20 Oct, 14:58 (Mac Studio)"]);
    assert.deepEqual(apart([v("A video of 5 bytes", 2), v("A video of 5 bytes", 1), v("A video of 5 bytes", 1)], () => "14:58").map((x) => x.name),
      ["A video of 5 bytes that came at 14:58 (3)", "A video of 5 bytes that came at 14:58 (1)", "A video of 5 bytes that came at 14:58 (2)"]);
  });
});
```

In `tool/tests/edit-guide.test.js`, in "guide, from the drop folders", importing `noteSeen` from `../filing.js`:

```js
  it("tells apart two videos of one size with no label yet by when they came, and finds each by its name", async () => {
    const t = setup();
    const dir = join(t.root, "Drop", "Mac Studio");
    dropIn(t, "Mac Studio", "Client Jane.mov");
    noteSeen(t.home, dir, Date.parse("2026-10-20T14:50:00-05:00"));
    dropIn(t, "Mac Studio", "Client John.mov");
    noteSeen(t.home, dir, Date.parse("2026-10-20T14:55:00-05:00"));
    const first = `A video of 5 bytes that came at ${clockAt(Date.parse("2026-10-20T14:50:00-05:00"))}`;
    const second = `A video of 5 bytes that came at ${clockAt(Date.parse("2026-10-20T14:55:00-05:00"))}`;
    const COMING_IN = 'It is coming into your drop folder. Wait for the "Ready" notice.';
    const r = await on(light(t), "guide");
    assert.deepEqual(r.said.slice(2), [`  ${second}: ${COMING_IN}`, `  ${first}: ${COMING_IN}`]);
    assert.doesNotMatch(r.said.join("\n"), /Jane|John|Client|\.mov/);
    assert.deepEqual(await on(light(t), "guide", first), { code: 0, said: [`${first}: ${COMING_IN}`] });
    t.done();
  });
```

- [ ] **Step 2: Run them to see them fail.** Expected: `does not provide an export named 'apart'`. In edit-guide, two lines that are both "A video of 5 bytes" (seen on 8504bb4).

- [ ] **Step 3: Write the code**

```js
/** The names of the videos in the drop folders, told apart. A video with no label yet (no `aliases`) is named by what it is and
    its size, and two of one size would share that name: each of those is said with when it came (`clock(at)`, "14:58"), and two
    that came in the same minute with a number too, in the order they came. A file's name is never part of it. */
export function apart(videos, clock) {
  const shared = (list) => {
    const count = new Map();
    for (const v of list) if (!v.aliases.length) count.set(v.name, (count.get(v.name) || 0) + 1);
    return (v) => !v.aliases.length && count.get(v.name) > 1;
  };
  const once = shared(videos);
  const timed = videos.map((v) => (once(v) ? { ...v, name: `${v.name} that came at ${clock(v.at)}` } : v));
  const still = shared(timed);
  const nth = new Map();
  const counts = new Map();
  for (const v of [...timed].filter(still).sort((a, b) => a.at - b.at)) {
    counts.set(v.name, (counts.get(v.name) || 0) + 1);
    nth.set(v, counts.get(v.name));
  }
  return timed.map((v) => (nth.has(v) ? { ...v, name: `${v.name} (${nth.get(v)})` } : v));
}
```

`guideDrops` ends with `return apart(videos, clockAt);`. Its comment says two of one size with no label are told apart by when they came.

- [ ] **Step 4: Run them to see them pass.** Then run `cd tool && node --test`. Expected: PASS. In no existing drop test do two unlabelled videos share a name.

- [ ] **Step 5: Commit**: "The guide's times and tell, task 4: two videos with no label yet, of one size, told apart by when they came".

---

### Task 5: (a) "Is it ready?" answers at once when nothing is on its way

**Files:** Modify `tool/guide.js` (`COMING`), `tool/edit.js` (`waitForChange`), `tool/tests/guide.test.js`, `tool/tests/edit-guide.test.js`.

- [ ] **Step 1: Write the failing tests**

In `tool/tests/guide.test.js`, in "what counts as a change while the guide waits", importing `COMING`:

```js
  it("waits only while a video is coming in, being imported or being read", () => {
    assert.deepEqual(COMING, ["arriving", "importing", "reading-later", "reading", "session-reading"]);
  });
```

In `tool/tests/edit-guide.test.js`, in "guide wait":

```js
  it("answers at once, waiting for nothing, when no video is coming in, being imported or being read", async () => {
    const t = setup();
    assert.deepEqual(await on(light(t), "guide", "wait"), { code: 0, said: [DROP_LINE, "Nothing is under way. To start, put the video in your drop folder."] });
    episodeAs(t, VIDEOS.waiting);
    dropIn(t, "Mac Studio", "Third.mov");
    statusOf(t, { import: "a2", video: "Third.mov", label: "Video of 20 Oct, 14:00 (Mac Studio)", at: "2026-10-20T14:00:00-05:00", failed: "the sound could not be read" });
    assert.deepEqual(await on(light(t), "guide", "wait"), { code: 0, said: [DROP_LINE, "Under way:",
      '  Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.',
      '  Video of 20 Oct, 14:00 (Mac Studio): Its import did not finish. Say "try it again".'] });
    assert.deepEqual(t.waits, []);
    t.done();
  });
```

- [ ] **Step 2: Run them to see them fail.** Expected:
- no export `COMING`;
- "Nothing has changed in 90 seconds." said first, after 18 waits.

- [ ] **Step 3: Write the code**

```js
/** The stages at which something is on its way that needs nothing of hers: a video coming into a drop folder or being imported,
    and Claude's reading. `guide wait` and `guide tell` wait only while a video is at one. A running finish is not among them:
    the guide cannot tell a finish that failed from one not begun. */
export const COMING = ["arriving", "importing", "reading-later", "reading", "session-reading"];
```

- In `waitForChange`, after the first read: `if (!read.items.some(({ next }) => !next.done && COMING.includes(next.stage))) return sayOverview(ctx, read);`. Its comment: "Nothing is on its way, so nothing will change by itself: the guide answers at once."
- Lift its wait into `const sleepOf = (ctx) => ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));`, for Task 7 too.
- Its doc comment, the guideCommand comment and HELP say "at once when no video is coming in, being imported or being read".

- [ ] **Step 4: Run them to see them pass.** Then run `cd tool && node --test`.

- [ ] **Step 5: Commit**: "The guide's times and tell, task 5: is it ready? answers at once when nothing is on its way".

---

### Task 6: What `tell` says, and how it follows a video (tool/guide.js)

**Files:** Modify `tool/guide.js`, `tool/tests/guide.test.js`.

**Produces:**
- `TELL_MS = 3600000`, `TELL_POLL_MS = 15000`.
- VideoFacts `source: { mac, file, bytes } | null`: the Mac whose drop folder the video is or was in, and its file's name and size. It is never said.
- Type `Trail = { id } | { mac, file, bytes }`, with `trailOf(facts): Trail` and `follow(trail, items): { item, trail } | null`.
- `told(was: Item, seen: Item, now: Item | null): string | null`: the one line, or null while the video is still on its way.
- `stillLine(item): string`: the line at the 60-minute limit.

- [ ] **Step 1: Write the failing tests**

Import `TELL_MS, TELL_POLL_MS, trailOf, follow, told, stillLine` (`nextFor` is imported already). Add `source: null` to `BASE`.

```js
describe("what guide tell says", () => {
  const JANE = { mac: "Mac Studio", file: "Client Jane.mov", bytes: 5 };
  const at = (facts) => ({ facts, next: nextFor(facts, NONE, NOW), folder: null, record: null });
  const arriving = at({ ...BASE, id: "", name: "A video of 5 bytes", source: JANE, ...DROP() });
  const importing = at({ ...arriving.facts, name: "Video of 20 Oct, 15:00 (Mac Studio)", aliases: ["Video of 20 Oct, 15:00 (Mac Studio)"], ...DROP({ state: "importing", step: "Reading the sound" }) });
  const retry = at({ ...arriving.facts, ...DROP({ state: "retry" }) });
  const waiting = at({ ...BASE, name: "Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1)", kind: null, waiting: true, reading: "none", source: JANE });
  const reading = at({ ...BASE, reading: "none" });
  const later = at({ ...BASE, ...RAW({ reading: "later", readsAt: "10:58" }) });
  const read = at({ ...BASE, offersAnswered: false });
  const failed = at({ ...BASE, reading: "failed" });
  const sessionReading = at({ ...BASE, ...SESSION(), reading: "running" });
  const sessionRead = at({ ...BASE, ...SESSION({ undecided: 2 }) });
  const ops = at({ ...BASE, handoff: OPS_HANDOFF });
  const done = at({ ...BASE, ...SESSION({ choice: "transcript only" }) });
  it("waits up to 60 minutes, looking every 15 seconds, and follows a video from its drop folder into Episodes by its file, which it never says", () => {
    assert.deepEqual([TELL_MS, TELL_POLL_MS], [3600000, 15000]);
    const ep = at({ ...BASE, id: "e-20261020-aaaaaa", source: JANE, at: 2 });
    const older = at({ ...BASE, id: "e-20261014-bbbbbb", source: JANE, at: 1 });
    assert.deepEqual(trailOf(arriving.facts), JANE);
    assert.deepEqual(trailOf(ep.facts), { id: "e-20261020-aaaaaa" });
    // In a drop folder by its Mac and file, whose size grows while it comes in.
    const grown = at({ ...arriving.facts, source: { ...JANE, bytes: 9 } });
    assert.deepEqual(follow(trailOf(arriving.facts), [ep, grown]), { item: grown, trail: { ...JANE, bytes: 9 } });
    // Out of it, by the newest answered video that holds a file of that name and size; then by its id.
    assert.deepEqual(follow(JANE, [older, ep]), { item: ep, trail: { id: "e-20261020-aaaaaa" } });
    assert.equal(follow({ ...JANE, bytes: 9 }, [older, ep]), null);
    // A file of that name in the other Mac's drop folder is another video.
    assert.equal(follow({ ...JANE, mac: "Sallie's laptop" }, [grown]), null);
    assert.deepEqual(follow({ id: "e-20261020-aaaaaa" }, [older, ep]), { item: ep, trail: { id: "e-20261020-aaaaaa" } });
    assert.equal(follow({ id: "e-20261020-cccccc" }, [ep]), null);
  });
  it("says in one line that it is ready, that Claude has read it, or its next step; and nothing while it is still on its way", () => {
    for (const [was, seen, now, want] of [
      [arriving, arriving, arriving, null],
      [arriving, arriving, importing, null],
      [later, later, reading, null],
      [arriving, importing, null, 'Video of 20 Oct, 15:00 (Mac Studio) is not under way any more. Say "what\'s next?" to see the ones that are.'],
      [importing, importing, waiting, 'Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1): It is ready. It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
      [importing, importing, reading, 'Pricing talk (3fa9c1): It is ready. Claude is reading it. A notice comes when it is done; then say "what did Claude find?".'],
      [importing, importing, retry, 'A video of 5 bytes: Its import did not finish. Say "try it again".'],
      [reading, reading, read, 'Pricing talk (3fa9c1): Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
      [sessionReading, sessionReading, sessionRead, 'Pricing talk (3fa9c1): Claude has read it. Keep, drop or change each of its principles and Reel ideas. Say "show me the principles".'],
      [reading, reading, failed, 'Pricing talk (3fa9c1): Claude\'s reading of it did not finish. Say "how far is it?" to see why.'],
      // Nothing on its way: its next step at once, as the guide says it.
      [waiting, waiting, waiting, 'Video of 20 Oct, 15:00 (Mac Studio) (3fa9c1): It is waiting for your answer. Say "what\'s waiting?" to see its card.'],
      [read, read, read, 'Pricing talk (3fa9c1): Claude has read it. Say "what did Claude find?", then answer the spellings card.'],
      [ops, ops, ops, 'Pricing talk (3fa9c1): On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".'],
      [retry, retry, retry, 'A video of 5 bytes: Its import did not finish. Say "try it again".'],
      [done, done, done, "Pricing talk (3fa9c1) is done: nothing is left to do for it."]
    ]) assert.equal(told(was, seen, now), want, JSON.stringify([was.next.stage, now && now.next.stage]));
    assert.equal(stillLine(arriving), 'A video of 5 bytes: Nothing has changed in 60 minutes. It is coming into your drop folder. Wait for the "Ready" notice.');
  });
});
```

These rows, and `follow`'s, were run against a prototype using 8504bb4's `nextFor`, and pass.

- [ ] **Step 2: Run it to see it fail.** Expected: no export `TELL_MS`.

- [ ] **Step 3: Write the code**

```js
/** How long `guide tell` waits at most for a video's next point, in the background, and how often it looks again in that time. */
export const TELL_MS = 60 * 60 * 1000;
export const TELL_POLL_MS = 15000;

/** What `guide tell` follows a video by (Trail): its record's id once it has one; in a drop folder, the Mac whose folder it is in,
    and its file's name and size (`facts.source`), which are never said. */
export const trailOf = (facts) => (facts.id ? { id: facts.id } : { mac: facts.source.mac, file: facts.source.file, bytes: facts.source.bytes });

/** The video `trail` follows, found again among `items`: { item, trail }, with the trail as it is now, or null when none is. By
    its id once it has one. In a drop folder, by its Mac and file, whose size grows while it comes in. Once it has left the drop
    folder, by the newest answered video holding a file of that name and size, as the import files it (filing.js
    holdingEpisode): from then on by that one's id. */
export function follow(trail, items) {
  if (trail.id) {
    const item = items.find(({ facts }) => facts.id === trail.id);
    return item ? { item, trail } : null;
  }
  const dropped = items.find(({ facts }) => facts.drop && facts.source.mac === trail.mac && facts.source.file === trail.file);
  if (dropped) return { item: dropped, trail: { ...trail, bytes: dropped.facts.source.bytes } };
  const filed = items.filter(({ facts }) => !facts.drop && facts.source && facts.source.file === trail.file && facts.source.bytes === trail.bytes).sort((a, b) => b.facts.at - a.facts.at)[0];
  return filed ? { item: filed, trail: { id: filed.facts.id } } : null;
}

const READ_IT = "Claude has read it.";

/** What `guide tell` says once its video has reached its next point, or null while it is still on its way. `was` is the video
    when the wait began, `seen` as it was last found, and `now` as it is found now, or null when it is not under way any more.
    It is on its way while it is at the stage it was at (COMING): in a drop folder, coming in or being imported; or Claude's
    reading. Then: it is ready, once it has left the drop folder for Episodes; Claude has read it, once its reading is in; and
    otherwise its next step, as the guide says it, which says when an import or a reading did not finish. At the start (all
    three the same) a video with nothing on its way gets its next step at once. Its file's name is never said. */
export function told(was, seen, now) {
  if (!now) return `${seen.facts.name} is not under way any more. Say "what's next?" to see the ones that are.`;
  if (now.next.done) return videoLines(now)[0];
  const on = (item) => (!COMING.includes(item.next.stage) ? "" : item.facts.drop ? "import" : "reading");
  if (on(now) && on(now) === on(was)) return null;
  const { facts, next } = now;
  if (was.facts.drop && !facts.drop) return `${facts.name}: It is ready. ${next.text}`;
  if (on(was) === "reading" && facts.reading === "done") return `${facts.name}: ${next.text.startsWith(READ_IT) ? next.text : `${READ_IT} ${next.text}`}`;
  return `${facts.name}: ${next.text}`;
}

/** What `guide tell` says of a video still on its way after TELL_MS: so, and its next step. */
export const stillLine = ({ facts, next }) => `${facts.name}: Nothing has changed in ${TELL_MS / 60000} minutes. ${next.text}`;
```

Document `source` in the VideoFacts comment.

- [ ] **Step 4: Run it to see it pass.** Then run `cd tool && node --test`.

- [ ] **Step 5: Commit**: "The guide's times and tell, task 6: what tell says, and how it follows a video into Episodes".

---

### Task 7: `guide "<video>" tell` (tool/edit.js)

**Files:** Modify `tool/edit.js` (HELP, `guideDrops`, `guideFacts`, a new `tellWhen`, `guideCommand`), `tool/tests/edit-guide.test.js`, `tool/tests/edit-labels.test.js`.

- [ ] **Step 1: Write the failing tests**

In `tool/tests/edit-guide.test.js`:
- Import `resultFile` (`../detached.js`) and `readEpisode, recordFile, recordText` (`../episode.js`).
- Move `onWait` out of "guide wait", to file scope.
- Add this helper:

```js
/** The video's record written again, at the next revision, with `over` laid on it. */
function rewrite(folder, over) {
  const { record } = readEpisode(folder, { pastCopies: true });
  writeFileSync(recordFile(folder, record.rev + 1), recordText({ ...record, ...over, rev: record.rev + 1 }));
}
```

- Add `["X", "tell"]` to the forms of "says only to ask Jason…", and `["tell", "now"]` to the words of "gives the help…". Both pass already, and stay as guards.
- Add these tests:

```js
describe("guide tell", () => {
  it("follows a video from its drop folder into Episodes, and says in one line that it is ready", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    let n = 0;
    const wait = async (ms) => {
      await t.ctx.deps.wait(ms);
      n += 1;
      if (n === 1) statusOf(t, { import: "e1", video: "Client Jane.mov", label: "Video of 20 Oct, 09:00 (Mac Studio)", at: "2026-10-20T15:00:10-05:00" });
      if (n === 3) episodeAs(t, { ...VIDEOS.waiting, record: { ...VIDEOS.waiting.record, video: { file: "Client Jane.mov", bytes: 5, seconds: 120, recorded: "2026-10-20", recordedFrom: "import" } } });
    };
    const r = await on(light(t, { wait }), "guide", "A video of 5 bytes", "tell");
    assert.deepEqual(r, { code: 0, said: ['Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is ready. It is waiting for your answer. Say "what\'s waiting?" to see its card.'] });
    assert.deepEqual(t.waits, [15000, 15000, 15000]);
    assert.doesNotMatch(r.said.join("\n"), /Jane|Client|\.mov/);
    t.done();
  });
  it("says in one line that Claude has read a video, once its reading is in", async () => {
    const t = setup();
    const found = episodeAs(t, { ...VIDEOS.read, record: { ...VIDEOS.read.record, reading: null } });
    const r = await on(light(t, { wait: onWait(t, 2, () => rewrite(found.folder, { reading: READ("finished") })) }), "guide", "Pricing talk", "tell");
    assert.deepEqual(r, { code: 0, said: ['Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.'] });
    assert.deepEqual(t.waits, [15000, 15000]);
    t.done();
  });
  it("says in one line that an import, or a reading, did not finish, and never says why", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    const status = { import: "e2", video: "Client Jane.mov", label: "Video of 20 Oct, 15:00 (Mac Studio)", at: "2026-10-20T15:00:00-05:00" };
    statusOf(t, status);
    const failing = onWait(t, 1, () => statusOf(t, { ...status, failed: "the sound could not be read" }));
    assert.deepEqual(await on(light(t, { wait: failing }), "guide", "Video of 20 Oct, 15:00 (Mac Studio)", "tell"), { code: 0, said: ['Video of 20 Oct, 15:00 (Mac Studio): Its import did not finish. Say "try it again".'] });
    // A raw reading the import's late check stopped, as a problem it found stops one.
    const raw = episodeAs(t, { ...VIDEOS.raw, record: { ...VIDEOS.raw.record, reading: null } });
    const stopped = onWait(t, 1, () => {
      mkdirSync(dirname(resultFile(t.home, raw.name, "read")), { recursive: true });
      writeFileSync(resultFile(t.home, raw.name, "read"), JSON.stringify({ version: 1, command: "read", started: t.now(), ended: t.now(), ok: false, made: [], failed: ["The late check of this episode's import found a problem: a copy did not match."], next: "" }));
    });
    const r = await on(light(t, { wait: stopped }), "guide", "Morning talk", "tell");
    assert.deepEqual(r, { code: 0, said: ['Morning talk (cccccc): Claude\'s reading of it did not finish. Say "how far is it?" to see why.'] });
    assert.doesNotMatch(r.said.join("\n"), /late check|did not match/);
    t.done();
  });
  it("gives a video with nothing on its way its next step at once, and never repeats words that fit none", async () => {
    const t = setup();
    for (const v of Object.values(VIDEOS)) episodeAs(t, v);
    assert.deepEqual(await on(light(t), "guide", "Video of 20 Oct, 09:00 (Mac Studio)", "tell"), { code: 0, said: ['Video of 20 Oct, 09:00 (Mac Studio) (aaaaaa): It is waiting for your answer. Say "what\'s waiting?" to see its card.'] });
    assert.deepEqual(await on(light(t), "guide", "Pricing talk", "tell"), { code: 0, said: ['Pricing talk (bbbbbb): Claude has read it. Say "what did Claude find?", then answer the spellings card.'] });
    assert.deepEqual(await on(light(t), "guide", "Session, 2026-10-19", "tell"), { code: 0, said: ["Session, 2026-10-19 (0c0c0c) is done: nothing is left to do for it."] });
    assert.deepEqual(await on(light(t), "guide", "Coaching call Jane Doe", "tell"), { code: 1, said: [NO_FIT] });
    assert.deepEqual(t.waits, []);
    t.done();
  });
  it("gives up after 60 minutes with its next step, and says when the video is no longer under way", async () => {
    const t = setup();
    dropIn(t, "Mac Studio", "Client Jane.mov");
    assert.deepEqual(await on(light(t), "guide", "A video of 5 bytes", "tell"), { code: 0, said: ['A video of 5 bytes: Nothing has changed in 60 minutes. It is coming into your drop folder. Wait for the "Ready" notice.'] });
    assert.deepEqual(t.waits, Array(240).fill(15000));
    const gone = onWait(t, 2, () => rmSync(join(t.root, "Drop", "Mac Studio", "Client Jane.mov")));
    assert.deepEqual(await on(light(t, { wait: gone }), "guide", "A video of 5 bytes", "tell"), { code: 0, said: ['A video of 5 bytes is not under way any more. Say "what\'s next?" to see the ones that are.'] });
    t.done();
  });
});
```

The arriving video in the last test has no import status. So it does not go stale, as a running import's status does after 10 minutes.

In `tool/tests/edit-labels.test.js` `walkWords`, `guide:` gains `[label, "tell"]`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd tool && node --test tests/edit-guide.test.js`
Expected: the 5 new tests FAIL, since `tell` still gives the help (code 2).

- [ ] **Step 3: Write the code**

- Imports from `./guide.js`: `TELL_MS, TELL_POLL_MS, trailOf, follow, told, stillLine`, beside `COMING` from Task 5.
- `guideDrops`: each video's facts gain `source: { mac, file: video, bytes: found.size }`. Its comment says `source` is for `tell` alone and is never said.
- `guideFacts`: `source: r.video && typeof r.video.file === "string" ? { mac: r.imported && r.imported.on, file: r.video.file, bytes: r.video.bytes } : null`, with the same note.
- `tellWhen`, after `waitForChange`:

```js
/** `guide "<video>" tell`: the video's next point (guide.js told), waited for in the background (her skill runs it with the Bash
    tool's run_in_background), and said in one line when it comes: it is ready, Claude has read it, or its import or its
    reading did not finish. What the guide says is read again every TELL_POLL_MS, for up to TELL_MS, following the video from its
    drop folder into Episodes (follow). A video with nothing on its way gets its next step at once, and one still on its way
    after TELL_MS gets that said, with its next step. Nothing is said before the end, and no notice is posted: the import and the
    reading post their own. */
async function tellWhen(ctx, item) {
  const wait = sleepOf(ctx);
  const start = ctx.now();
  let trail = trailOf(item.facts);
  let seen = item;
  let line = told(item, item, item);
  while (line === null && ctx.now() - start < TELL_MS) {
    await wait(Math.min(TELL_POLL_MS, TELL_MS - (ctx.now() - start)));
    const found = follow(trail, guideItems(ctx).items);
    line = told(item, seen, found ? found.item : null);
    if (found) ({ trail, item: seen } = found);
  }
  ctx.say(line ?? stillLine(seen));
  return 0;
}
```

- `guideCommand`: the form after a video takes `"tell"` beside `"show"` and `"finished"`, with `if (form === "tell") return tellWhen(ctx, found.item);`. Its comment adds: "with `tell`, its next point, waited for up to 60 minutes and said in one line".
- HELP:

```
  node edit.js guide drop [zoom] | page | wait
                                        open this Mac's drop folder in Finder (with zoom, Zoom Video Transfer), open the
                                        BRIMM Ops page in the default browser, or wait up to 90 seconds for a change in
                                        what the guide says: at once when no video is coming in, being imported or read
  node edit.js guide "<video>" done <step> | finished | show | tell
                                        note on this Mac that she did its step on the BRIMM Ops page (only the step that
                                        comes next), that she is done with the video, or show in Finder what its step needs.
                                        With tell, wait up to 60 minutes for its next point (ready, read by Claude, or an
                                        import or reading that did not finish), then say it in one line. Her skill runs it
                                        in the background
```

  The `wait` line is Task 5's, if Task 5 did not change it already.

- [ ] **Step 4: Run them to see them pass.** Then run `cd tool && node --test`. Expected: PASS, the privacy walk included.

- [ ] **Step 5: Commit** `tool/edit.js tool/tests/edit-guide.test.js tool/tests/edit-labels.test.js`: "The guide's times and tell, task 7: guide \"<video>\" tell, up to 60 minutes, one line at the end".

---

### Task 8: Her skill, the README and the setup notes

**Files:** Modify `tool/studio/SKILL.md`, `tool/tests/studio.test.js`, `README.md` (rows 278–280), `docs/setup/sallies-laptop.md` (end of "The guide").

- [ ] **Step 1: Write the failing test.** In `tool/tests/studio.test.js`, beside "guides her one step at a time…":

```js
  it("tells her when a video is ready or read, from a wait run in the background, and opens the page once in this chat", () => {
    const guide = sectionOf(skill, "## Guide her");
    assert.ok(guide.trimEnd().split("\n").length <= 30, `${guide.split("\n").length} lines`);
    for (const words of [
      '"Tell me when it\'s ready"', '"Let me know when Claude has read it"', '`guide "<video>" tell`',
      "the Bash tool's run_in_background", "once per video, never Monitor",
      "I'll tell you here; the Mac doing the work shows a notice too", "tell her its one line in plain words",
      "with any time it gives", "offer to tell her here when it's ready",
      "`guide page` the first time in this chat"
    ]) assert.ok(guide.includes(words), words);
    assert.ok(!guide.includes("the first time in a session"), guide);
    assert.ok(sectionOf(skill, "## The card").includes("offer to tell her here when Claude has read it"));
  });
```

Never put run_in_background in backticks: `commandsIn` would take it for an edit.js command.

- [ ] **Step 2: Run it to see it fail**: `cd tool && node --test tests/studio.test.js`. Expected: FAIL on the first words that are missing.

- [ ] **Step 3: Write the skill, the README and the notes**

`tool/studio/SKILL.md`:
- Line 47 (the card): `…in plain words: when Claude reads it, or that a notice will come, and offer to tell her here when Claude has read it ("Guide her"). When it says what Claude made, …`
- Line 56: `- "I've dropped it" / "Is it ready?": \`guide wait\`, and tell her where it is in one line, with any time it gives. If it is still on its way, offer to tell her here when it's ready.`
- A new line after it: `- "Tell me when it's ready" / "Let me know when Claude has read it", or her yes to that offer: run \`guide "<video>" tell\` in the background (the Bash tool's run_in_background), once per video, never Monitor. Say "I'll tell you here; the Mac doing the work shows a notice too," and carry on with her. When it ends, tell her its one line in plain words; if it says the video is ready, show its card.`
- Line 59: "`guide page` the first time in a session" becomes "`guide page` the first time in this chat".

README:
- Row 278: add this before " Only on a Mac that does the light import": ` While a video is imported on this Mac, it says when the video should be ready. While a raw video's reading waits for the import's late check, it says when Claude starts reading it and when its rough cut is ready. These times are on this Mac's clock, from the speeds its runs measured (the panel's \`rates.json\`; a reading's are the import's "Asking Claude" and "Making the rough cut"). None is said while a speed is not known. Two videos in a drop folder with no label yet, of one size, are told apart by when they came, and also by a number when they came in the same minute.`
- Row 279: "or waits up to 90 seconds for a change in what the guide says" gains ", and answers at once when no video is coming in, being imported or being read".
- Row 280: its form becomes `` `guide "<video>" done <step> \| finished \| show \| tell` ``, and it ends: ` With \`tell\`, it waits up to 60 minutes, looking every 15 seconds, for the video's next point, then prints one line: it is ready, Claude has read it, or its next step. That step says when its import or reading did not finish (a late check that found a problem stops a raw reading). A video with nothing on its way gets its next step at once. It follows a video from its drop folder into Episodes by its file's name and size, as the import files it, and never says them. Her skill runs it in the background (the Bash tool's \`run_in_background\`: her guard sees the same \`edit.js\` command) and passes the line on. It posts no notice of its own: the import's "Ready" notice and the reading's "Claude has read" notice come as before.`

`docs/setup/sallies-laptop.md`, a step 4 at the end of "The guide (2026-10-25)":

`4. **Telling her when it's ready (her note of 25 Oct):** in her folder's Code tab, use a short video you are happy to have imported (say "leave it" on its card afterwards). Drop it and say "tell me when it's ready". Claude says it will tell her, and the chat stays free. Check that its line comes in the chat within about 15 seconds of the "Ready" notice, while the chat is idle. Once, check that a wait of more than 30 minutes is not cut off: ask to be told when Claude has read a raw video. Also note whether the Claude app shows a notice of its own.`

- [ ] **Step 4: Run it to see it pass.** Then run `cd tool && node --test`, and check the skill's length with `wc -l tool/studio/SKILL.md` (145).

- [ ] **Step 5: Commit** `tool/studio/SKILL.md tool/tests/studio.test.js README.md docs/setup/sallies-laptop.md`: "The guide's times and tell, task 8: her skill's tell, this chat, and the README and setup notes".

---

## After the last task

- `cd tool && node --test`: all pass (the 3320, plus this plan's).
- Her folder's skill is a copy. Once this merges, on each Mac with her folder:
  - write the folder again, and make step 9's lock-down check again in the same sitting (step 2 of "The guide" in the setup notes);
  - then make step 4's check by hand.
