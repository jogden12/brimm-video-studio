# Phase 3, lightweight Reels: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At the import, an episode gets up to five Reel candidates in `reels.json`, each with a small upright preview made from its own stretch only. Picking a Reel writes an upright 1080x1920 Final Cut project of it, moved onto the face. `reels` lists the candidates and plays the previews, and `ask` asks Claude again for candidates.

**Architecture:** Three pure pieces with no disk or program: `tool/reels.js` (the candidates, the preview's ffmpeg arguments, `reels.json`, the listing, and the Reel project's text), `tool/fcpxml.js` (learns an upright frame with a fill and a move per clip, and its checker learns a second format and more than one project), and small moves in `reframe.js` and `cuts.js`. Then three thin seams into code that builders A and C own: the episode import in `tool/unedited.js` (A's 1a), C's `tool/reel.js` `reelTimeline` and `reel pick` (phase 2), and `tool/edit.js` (A's), which gains `reels` and `ask`.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages. ffmpeg (x264), the face finder `faces.swift`, Final Cut Pro's FCPXML 1.10.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md` on `main` (e5b5017): section 3, section 1 (the rule, the record, the episode folder), section 2 (stored timelines, project names), section 4 (detached commands), and phase 3's row. Advisory, where the spec is silent: the architect's contract, `docs/superpowers/plans/drafts/contract.md` on branch `drafts/plans-1a-2-1b`, and builder C's message of 2026-10-14 on `reel pick` and `reelTimeline`.

## Global Constraints

- Node 22 or later, no packages. Every test: `cd tool && node --test`.
- Write a failing test first, then the code. Small commits, in this worktree only.
- No test calls the real `claude`, ffmpeg, `open` or Final Cut (spec section 7). xmllint against Final Cut's DTD, which skips itself where it is missing, is allowed (it is today).
- Previews: "upright, 540x960, x264 `-preset veryfast -crf 30`. It is made from its own stretch only, by seeking in the input (`-ss` and `-t` for each range)".
- "No full-size clip, no Story parts, and no caption file for a Reel" on import.
- "Claude picks up to five candidates, each with a recommended on-screen title (a hook of at most eight words)."
- "No `reel add`."
- "A short or upright recording ... gets a main timeline in its own shape, no Reel candidates and no upright rough cut." Its `kind` is builder A's (`"short video"`); this phase reads it and never decides it.
- The Reel project: "its kept ranges, each clip filled into the frame and moved onto the face", 1080x1920, written by this repo's `fcpxml.js`, and checked before it is kept.
- Every file reaches an episode folder by the rule: made in the run's folder, then cloned in with `/bin/cp -c` (A's `cloneIn`, or `replaceIn` when a file of that name is there: deleted first, then cloned). Never written into, never renamed. Listed in the record's `files`.
- The record is never rebuilt from known fields: spread it, change what this phase owns, and write it with A's `writeEpisode(folder, record, { expectRev, ... })`. Unknown fields are kept.
- `record.reels[i]` keeps the contract's fields and names: `{ n, status, from, to, title, why, files, pushed }`. This phase adds no field to it.
- Never write into a watched Dropbox folder or touch a real video. Experiments and measurements use made-up recordings in this session's scratchpad.
- Install nothing. Never touch the live checkout at `~/Claude Code/BRIMM video`. Never read a `.env` file.
- Comments and every message a person reads are in the codebase's own plain words: short sentences, no jargon, say what happens and why.

## What is still to settle, and how this plan handles it

1. **How Final Cut takes a wide clip in an upright project (phase 0, step B2).** Not known yet. This plan writes `<adjust-conform type="fill"/>` and `<adjust-transform position="X 0"/>` on each clip, with X in hundredths of the frame's height (the architect's understanding, unconfirmed), all from one function, `reelPosition`, marked pending phase 0. A clip whose crop is a guess carries a marker that says so. If phase 0 finds that fill is not honoured, the architect's fallback is conform `none` plus an explicit scale; that is a change to `reelPosition` and the two adjust tags only.
2. **Final Cut's name for a 1080x1920 format.** Not among the names `fcpxml.js` knows, so the sequence's format goes without a name, as an unknown size does today, and Final Cut goes by its numbers. Phase 0 may give the name.
3. **Seams.** Tasks 1 to 7 touch nothing builders A or C own and are built first. Task 8 and 9 are built on A's merged phase 1a, Tasks 10 to 12 on C's merged phase 2. The names used for their functions are the contract's and C's message's; where a merged name differs, the merged name wins and the task's code is renamed to it, nothing else.

## Review Focus

The inputs the spec implies and no task's main tests exercise, most likely to bite first. Each line's test is added to the task named.

1. **A face at the very edge of the picture.** The crop is pressed against the edge, and the even-rounded crop is half a pixel narrower than 9:16, so the move would leave a sliver of black down one side. Expected: the move is held to the largest that still fills the frame. Test in Task 3.
2. **Sound that starts after the picture**, as Zoom and phone files can. Each stretch is seeked on its own, so a stretch near the start could have its sound pulled early. Expected: the preview's sound is placed on the picture's clock, with silence where there is none, as the rough cut does (`aresample=async=1:first_pts=0`). Test in Task 1; checked with the real ffmpeg in Task 13's measurement.
3. **A candidate made of many stretches** (a 90-second Reel of a talk with its pauses shortened can have 30 or more). Expected: one input per stretch, and one preview. Test in Task 1.
4. **No face found, or the faces not looked for** (no swift, the face finder failed, or the upright version was not made). Expected: every candidate still gets a preview and a crop, centred or the whole video's, with `found: false`, and the Reel project carries a marker on each such stretch. Tests in Task 2 and Task 5.
5. **`ask` after a Reel is picked.** New candidates must not take a picked Reel's number or move its stretch. Expected: picked and finished Reels keep their number and their stretch in `reels.json`, and new candidates are numbered on from the highest number ever used. Test in Task 7.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `tool/reels.js` | Create | The Reel candidates: the preview's arguments, the candidates from Claude's clips, `reels.json` (make, read, merge), the record entries made from it, the listing, and the Reel project's text |
| `tool/tests/reels.test.js` | Create | Its tests |
| `tool/reframe.js` | Modify | Export `stretchesOf` (moved from `unedited.js`, where it is `stretches`) |
| `tool/cuts.js` | Modify | `encodeArgs(crf, preset = "medium")`; `joinNotes` moved here from `unedited.js` and exported |
| `tool/fcpxml.js` | Modify | `frame` and a per-range `crop` in `fcpxml()`; `reelPosition`; `checkFcpxml` checks each project, each format, and each move |
| `tool/tests/fcpxml.test.js`, `tool/tests/reframe.test.js`, `tool/tests/cuts.test.js` | Modify | Tests of the above |
| `tool/unedited.js` | Modify (after A) | Episode mode: candidates and previews in place of clips; `--from-plan` of an episode's video makes previews |
| `tool/tests/unedited.test.js` | Modify (after A) | Tests of the above |
| `tool/reel.js` | Modify (after C) | `reelTimeline` gives the Reel project |
| `tool/edit.js` | Modify (after A and C) | `reels`, `ask`; `reel pick` writes `edit/reel-<n>.v0.fcpxml`; `push reel` takes it |
| `tool/tests/edit.test.js` | Modify (after A and C) | Tests of the above |
| `README.md` | Modify | Reels on import, the previews, `reels`, `reel pick`, `ask`, what is pending phase 0, the measurements |

---

## Task 1: The preview of a candidate

**Files:**
- Create: `tool/reels.js`
- Create: `tool/tests/reels.test.js`
- Modify: `tool/cuts.js:449` (`encodeArgs`)
- Modify: `tool/reframe.js` (add `stretchesOf`), `tool/unedited.js:390-402` (use it)
- Test: `tool/tests/reels.test.js`, `tool/tests/cuts.test.js`, `tool/tests/reframe.test.js`

**Interfaces:**
- Consumes: `encodeArgs(crf, preset)` from `cuts.js`.
- Produces: `PREVIEW = { width: 540, height: 960 }`, `PREVIEW_QUALITY = 30`, `previewArgs({ video, ranges, out }) → string[]` where each range is `{ start, end, crop: { x, y, w, h, found } }` in seconds of the raw video; throws in plain words on an empty list, a range that does not end after it starts, ranges out of order, or a range without a crop. `stretchesOf(spans) → [{ start, end }]` from `reframe.js`.

- [ ] **Step 1: Write the failing tests**

In `tool/tests/cuts.test.js`, beside the tests of `encodeArgs`:

```js
it("writes at the speed it is asked for, and at x264's medium when it is not asked", () => {
  assert.deepEqual(encodeArgs(30, "veryfast"), ["-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart"]);
  assert.equal(encodeArgs(23)[encodeArgs(23).indexOf("-preset") + 1], "medium");
});
```

In `tool/tests/reframe.test.js`:

```js
describe("stretches as ffmpeg is given them", () => {
  it("writes each edge to the thousandth of a second below it, and keeps nothing else of the span", () => {
    assert.deepEqual(stretchesOf([{ start: 5.8724, end: 9.8436, at: 0 }, { start: 13.3800001, end: 21.2879, at: 3.97 }]), [{ start: 5.872, end: 9.843 }, { start: 13.38, end: 21.287 }]);
  });
});
```

`tool/tests/reels.test.js`:

```js
// The Reel candidates of an episode: what ffmpeg is asked for to make a preview, the candidates made of Claude's clips,
// reels.json, the listing, and the Reel's Final Cut project. None of it needs a video, and no program is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PREVIEW, previewArgs } from "../reels.js";

/** A crop of a 1920x1080 picture, 606 wide, that starts `x` pixels in. */
const crop = (x, found = true) => ({ x, y: 0, w: 606, h: 1080, found });

describe("the preview of a Reel candidate", () => {
  it("is 540 by 960, made of each stretch alone, by seeking to it in the input, at veryfast and quality 30", () => {
    const ranges = [{ start: 312.4, end: 330.1, crop: crop(438) }, { start: 333.25, end: 354.5, crop: crop(500, false) }];
    assert.deepEqual(PREVIEW, { width: 540, height: 960 });
    assert.deepEqual(previewArgs({ video: "/in/a b.mp4", ranges, out: "/work/reel-1.mp4" }), [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "312.4", "-t", "17.7", "-i", "/in/a b.mp4",
      "-ss", "333.25", "-t", "21.25", "-i", "/in/a b.mp4",
      "-filter_complex", [
        "[0:v]crop=606:1080:438:0,scale=540:960,setsar=1,setpts=PTS-STARTPTS[v0]",
        "[0:a]aresample=async=1:first_pts=0[a0]",
        "[1:v]crop=606:1080:500:0,scale=540:960,setsar=1,setpts=PTS-STARTPTS[v1]",
        "[1:a]aresample=async=1:first_pts=0[a1]",
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
      ].join(";"),
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart",
      "-f", "mp4", "/work/reel-1.mp4"
    ]);
  });
  it("puts each stretch's sound on its picture's clock, with silence where there is none, for a recording whose sound starts late", () => {
    const graph = (args) => args[args.indexOf("-filter_complex") + 1];
    assert.match(graph(previewArgs({ video: "/in/a.mp4", ranges: [{ start: 0, end: 20, crop: crop(0) }], out: "/w/p.mp4" })), /\[0:a\]aresample=async=1:first_pts=0\[a0\]/);
  });
  it("takes one input for each stretch, however many there are", () => {
    const ranges = Array.from({ length: 40 }, (_, i) => ({ start: i * 3, end: i * 3 + 2, crop: crop(438) }));
    const args = previewArgs({ video: "/in/a.mp4", ranges, out: "/w/p.mp4" });
    assert.equal(args.filter((a) => a === "-i").length, 40);
    assert.match(args[args.indexOf("-filter_complex") + 1], /concat=n=40:v=1:a=1\[v\]\[a\]$/);
  });
  it("writes a time a computer's sums leave a hair off as ffmpeg can read it", () => {
    const args = previewArgs({ video: "/in/a.mp4", ranges: [{ start: 0.1 + 0.2, end: 0.6, crop: crop(0) }], out: "/w/p.mp4" });
    assert.deepEqual(args.slice(5, 9), ["-ss", "0.3", "-t", "0.3"]);
  });
  it("refuses what would make no preview, or one with its stretches out of order or uncropped, and says which", () => {
    assert.throws(() => previewArgs({ video: "/in/a.mp4", ranges: [], out: "/w/p.mp4" }), { message: "A preview needs at least one stretch to show." });
    assert.throws(() => previewArgs({ video: "/in/a.mp4", ranges: [{ start: 5, end: 5, crop: crop(0) }], out: "/w/p.mp4" }), { message: "A stretch must end after it starts, at times in seconds: this one runs from 5 to 5." });
    assert.throws(() => previewArgs({ video: "/in/a.mp4", ranges: [{ start: 10, end: 12, crop: crop(0) }, { start: 11, end: 14, crop: crop(0) }], out: "/w/p.mp4" }), { message: "The stretches must be in rising order and must not overlap: the one from 11 to 14 starts before the one before it ends." });
    assert.throws(() => previewArgs({ video: "/in/a.mp4", ranges: [{ start: 10, end: 12 }], out: "/w/p.mp4" }), { message: "Each stretch of a preview needs its crop: the one from 10 to 12 has none." });
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/reels.test.js tests/cuts.test.js tests/reframe.test.js`
Expected: FAIL. `reels.js` cannot be found; `encodeArgs(30, "veryfast")` gives `medium`; `stretchesOf` is not exported.

- [ ] **Step 3: Write the code**

`tool/cuts.js`, `encodeArgs` (its comment gains one line: "`preset` is x264's speed: medium unless a quick, small file is wanted, as for a preview."):

```js
export const encodeArgs = (crf, preset = "medium") => ["-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart"];
```

`tool/reframe.js`, after `timeOf` (move the comment of `stretches` and `below` from `unedited.js` with it, unchanged):

```js
/** A time written to the thousandth of a second below it. */
const below = (t) => Math.floor(t * 1000) / 1000;

/** Stretches of a video as ffmpeg is given them, when the stretches are the rough cut's own, each end on a whole picture. ...
    (the comment of `stretches` in unedited.js, word for word) */
export const stretchesOf = (spans) => spans.map((span) => ({ start: below(span.start), end: below(span.end) }));
```

In `tool/unedited.js`: delete `below` and `stretches` (lines 389 to 402), import `stretchesOf` from `./reframe.js`, and replace each `stretches(` with `stretchesOf(`.

`tool/reels.js`:

```js
// The Reels of an episode, made light at the import, as Jason asked: "some of those may not be utilized, so the initial reels
// creation should be lightweight". Claude picks up to five candidates. Each has its kept stretches on the raw video's clock,
// the crop that puts the speaker in an upright frame, a recommended title, why Claude picked it, and a small upright preview
// to judge it by. No full-size clip is made at the import, no part of a Story and no caption file. Only a Reel she picks gets
// a Final Cut project.
// Nothing here touches a disk or runs a program. It takes plain data and gives back plain data, text or ffmpeg's arguments.
import { encodeArgs } from "./cuts.js";

/** The size of a preview, in pixels: half a Reel's each way. */
export const PREVIEW = { width: 540, height: 960 };
/** The quality a preview is written at. It is for judging a candidate, not for posting, so it is small: about a fifth of the
    size quality 23 would give. */
export const PREVIEW_QUALITY = 30;

/** A time as it is written for ffmpeg: to the thousandth of a second, and never before 0. */
const timeOf = (seconds) => Math.max(0, Math.round(seconds * 1000) / 1000);

/** Have ffmpeg make the preview of one candidate: its stretches, each cropped on the speaker, joined, and made 540 by 960.
    Each stretch is read alone, by seeking to it in the input (-ss and -t before -i), so ffmpeg reads from the picture it can
    start at before the stretch to the stretch's end, and nothing else. The upright version and the clips read the whole
    recording once for each file, which for an hour of 1080 lines costs far more than writing the file.
    The sound of each stretch is put on its picture's clock first, with silence where there is none, as the rough cut's is: a
    recording whose sound starts after its picture would otherwise have that stretch's sound pulled early.
    Each stretch is {start, end, crop}, in seconds of the raw video, and the crop is cropFor's, in pixels of the picture as it
    is shown. The stretches must be in rising order and must not overlap, and each must end after it starts and have a crop.
    Anything else is refused, with a reason that says which stretch. The file is told it is an mp4, so it can be written under
    another name and given its own when it is whole. */
export function previewArgs({ video, ranges, out }) {
  if (!ranges.length) throw new Error("A preview needs at least one stretch to show.");
  let at = 0;
  const inputs = ranges.flatMap((range) => {
    const [start, end] = [timeOf(range.start), timeOf(range.end)];
    if (!(end > start && end < Infinity)) throw new Error(`A stretch must end after it starts, at times in seconds: this one runs from ${range.start} to ${range.end}.`);
    if (start < at) throw new Error(`The stretches must be in rising order and must not overlap: the one from ${range.start} to ${range.end} starts before the one before it ends.`);
    if (!range.crop) throw new Error(`Each stretch of a preview needs its crop: the one from ${range.start} to ${range.end} has none.`);
    at = end;
    return ["-ss", String(start), "-t", String(timeOf(end - start)), "-i", video];
  });
  const each = ranges.flatMap(({ crop }, i) => [
    `[${i}:v]crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${PREVIEW.width}:${PREVIEW.height},setsar=1,setpts=PTS-STARTPTS[v${i}]`,
    `[${i}:a]aresample=async=1:first_pts=0[a${i}]`
  ]);
  const joined = `${ranges.map((range, i) => `[v${i}][a${i}]`).join("")}concat=n=${ranges.length}:v=1:a=1[v][a]`;
  return ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", [...each, joined].join(";"), "-map", "[v]", "-map", "[a]", ...encodeArgs(PREVIEW_QUALITY, "veryfast"), "-f", "mp4", out];
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS, every test, today's included (the move of `stretches` changes nothing they see).

- [ ] **Step 5: Commit**

```bash
git add tool/reels.js tool/tests/reels.test.js tool/cuts.js tool/tests/cuts.test.js tool/reframe.js tool/tests/reframe.test.js tool/unedited.js
git commit -m "Have ffmpeg make a Reel's preview from its own stretches only, by seeking"
```

---

## Task 2: The candidates, and reels.json

**Files:**
- Modify: `tool/reels.js`
- Test: `tool/tests/reels.test.js`

**Interfaces:**
- Consumes: `clipRanges`'s clips `{ n, hook, why, start, end, ranges, length, fits, story, check? }` (notes.js); the plan `{ phrases: [{ id, start, end, text, keep }] }`; `facts` as `factsOf` gives them; `stills` as the face finder prints them; `keptSpans`, `roughRate` (cuts.js); `cropsFor`, `stretchesOf`, `fitReel` (reframe.js).
- Produces:
  - `reelCandidates({ clips, plan, facts, stills }) → candidate[]`, each `{ n, start, end, ranges: [{ start, end, crop }], seconds, fits: { fits, why }, title, reason, words, check?, preview: null }`, or for a clip that comes to less than one picture `{ n, start, end, ranges: [], seconds: 0, fits, title, reason, words, preview: null, failed: "it is shorter than one picture" }`.
  - `REELS_FILE = "reels.json"`, `previewPath(n) → "previews/reel-<n>.mp4"` (relative to the episode folder, with `/`).
  - `reelsFile({ video, by, made, candidates, none }) → object`: `{ format: "brimm-video reels", version: 1, video, by, made, none?, candidates }`; `by` is `"import"` or `"ask"`; `none` says why there are no candidates, and is left out when there are some.
  - `readReels(text) → { reels } | { why }`.
  - `reelEntries(candidates) → record.reels entries`, each `{ n, status: "candidate", from: start, to: end, title, why: reason, files: [previewPath(n)] or [], pushed: [] }`.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/reels.test.js`:

```js
import { wordsOf, pausesOf, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { TOLD, PAUSES } from "./fixtures.js";
import { reelCandidates, REELS_FILE, previewPath, reelsFile, readReels, reelEntries } from "../reels.js";

/** The made-up recording of fixtures.js, as the rules plan it, with Claude cutting "It is very, very important." (p8) and
    picking one clip, from p7 to p9. The clip is two stretches: 13.383 to 16.53, and 19.214 to 21.297. */
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
const HEARD = pausesOf(PAUSES);
const RULES = cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: FACTS.duration, pauses: HEARD });
const READ = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [{ from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
const PLAN = applyDecisions(RULES, READ.decisions, HEARD).plan;
const CLIPS = clipRanges(PLAN, READ.clips, HEARD).clips;
/** The face finder's stills of the made-up recording: eleven, each with one face whose middle is `centre` of the way across. */
const stillsWith = (centre) => Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: centre == null ? [] : [{ x: centre - 0.05, y: 0.2, w: 0.1, h: 0.2 }] }));
const crop720 = (x, found = true) => ({ x, y: 0, w: 404, h: 720, found });

describe("the Reel candidates made of Claude's clips", () => {
  it("hold each clip's stretches as the preview and the project take them, each with its crop, its title, why, and its words", () => {
    assert.deepEqual(reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }), [{
      n: 1, start: 13.38, end: 21.287,
      ranges: [{ start: 13.38, end: 16.516, crop: crop720(118) }, { start: 19.219, end: 21.287, crop: crop720(118) }],
      seconds: 5.204, fits: { fits: false, why: "It is 5.204 seconds long, and a Reel clip is at least 15 seconds." },
      title: "Know your costs", reason: "It makes one point and stands alone.",
      words: "So the first thing you need to do is know your costs. Thank you so much, Sallie.",
      preview: null
    }]);
  });
  it("keep the clip's own number, and its word to check the first or the last word", () => {
    const [one] = reelCandidates({ clips: [{ ...CLIPS[0], n: 4, check: "It starts with no pause before it: check the first word." }], plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual([one.n, one.check], [4, "It starts with no pause before it: check the first word."]);
  });
  it("still get a crop where no face was found, the middle of the picture, and say it is a guess", () => {
    for (const stills of [stillsWith(null), []]) {
      const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills });
      assert.deepEqual(one.ranges.map((r) => r.crop), [crop720(438, false), crop720(438, false)]);
    }
  });
  it("say so, and have no stretch, for a clip that comes to less than one picture", () => {
    const tiny = { ...CLIPS[0], ranges: [{ start: 13.3801, end: 13.3802 }], start: 13.3801, end: 13.3802, length: 0 };
    const [one] = reelCandidates({ clips: [tiny], plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual([one.ranges, one.seconds, one.failed], [[], 0, "it is shorter than one picture"]);
  });
});

describe("reels.json", () => {
  const made = "2026-10-14T09:12:00-05:00";
  it("is named reels.json, with each preview in previews/, beside it in the episode folder", () => {
    assert.deepEqual([REELS_FILE, previewPath(3)], ["reels.json", "previews/reel-3.mp4"]);
  });
  it("holds the candidates, who made them and when, and of which video", () => {
    const candidates = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual(reelsFile({ video: "talk.mov", by: "import", made, candidates }), { format: "brimm-video reels", version: 1, video: "talk.mov", by: "import", made, candidates });
  });
  it("says why there are none, when there are none", () => {
    assert.deepEqual(reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude could not be asked (it timed out)" }), { format: "brimm-video reels", version: 1, video: "talk.mov", by: "import", made, none: "Claude could not be asked (it timed out)", candidates: [] });
  });
  it("is read back as it was written", () => {
    const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) }) });
    assert.deepEqual(readReels(JSON.stringify(reels, null, 2)), { reels });
  });
  it("is refused, with the reason, when it is not one this tool wrote or a candidate in it cannot be read", () => {
    assert.deepEqual(readReels("not json"), { why: "it is not JSON" });
    assert.deepEqual(readReels(JSON.stringify({ format: "something else", version: 1 })), { why: "it is not a list of Reel candidates this tool wrote" });
    assert.deepEqual(readReels(JSON.stringify({ format: "brimm-video reels", version: 2, video: "a.mov", candidates: [] })), { why: "it was written by a newer brimm-video. Ask Jason to update this Mac." });
    assert.deepEqual(readReels(JSON.stringify({ format: "brimm-video reels", version: 1, video: "a.mov", candidates: [{ n: 1, ranges: [{ start: 1 }] }] })), { why: "candidate 1 in it cannot be read" });
  });
});

describe("the record's Reels, made of the candidates", () => {
  it("are one entry each, a candidate still, with its times, title, why and preview, in the record's own words", () => {
    const [candidate] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
    assert.deepEqual(reelEntries([{ ...candidate, preview: "previews/reel-1.mp4" }, { ...candidate, n: 2, preview: null }]), [
      { n: 1, status: "candidate", from: 13.38, to: 21.287, title: "Know your costs", why: "It makes one point and stands alone.", files: ["previews/reel-1.mp4"], pushed: [] },
      { n: 2, status: "candidate", from: 13.38, to: 21.287, title: "Know your costs", why: "It makes one point and stands alone.", files: [], pushed: [] }
    ]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/reels.test.js`
Expected: FAIL: `reelCandidates` and the rest are not exported.

- [ ] **Step 3: Write the code**

Add to `tool/reels.js` (and to its imports: `keptSpans, roughRate` from `./cuts.js`; `cropsFor, stretchesOf, fitReel` from `./reframe.js`):

```js
/** A sum to the thousandth of a second: a computer's sums leave 3.136 + 2.068 a hair off 5.204. */
const ms = (t) => Math.round(t * 1000) / 1000;

/** The Reel candidates made of the clips Claude picked, as clipRanges gives them. Each is {n, start, end, ranges, seconds,
    fits, title, reason, words, check, preview}:
    - `ranges` are the clip's kept stretches as the preview and the Reel's project take them, each end on a whole picture and
      written to the thousandth below it, each with its crop: one fixed crop for each stretch, placed on the speaker's face by
      the stills the face finder looked in for the upright version. A crop no face was found for is a guess, and `found` is
      false. All in seconds of the raw video.
    - `seconds` is how long the Reel is, and `fits` whether that fits a Reel and, when not, why.
    - `title` is Claude's recommended words for the screen, and `reason` why it picked the clip.
    - `words` are the kept words of the clip, as the plan has them.
    - `check` is there when the clip starts or ends with no pause: its first or last word is to be checked.
    - `preview` is null until a preview is made.
    A clip that comes to less than one picture has no stretches, no preview, and `failed` says why. */
export function reelCandidates({ clips, plan, facts, stills }) {
  return clips.map((clip) => {
    const stretches = stretchesOf(keptSpans(clip.ranges.map((range) => ({ ...range, keep: true })), roughRate(facts)));
    const crops = cropsFor(facts, stretches, stills);
    const seconds = ms(stretches.reduce((sum, s) => sum + s.end - s.start, 0));
    const words = plan.phrases.filter((p) => p.keep && p.start < clip.end && p.end > clip.start).map((p) => p.text.trim()).filter(Boolean).join(" ");
    const about = { title: clip.hook, reason: clip.why, words, ...(clip.check ? { check: clip.check } : {}), preview: null };
    if (!stretches.length) return { n: clip.n, start: clip.start, end: clip.end, ranges: [], seconds: 0, fits: fitReel({ start: 0, end: 0 }), ...about, failed: "it is shorter than one picture" };
    return {
      n: clip.n, start: stretches[0].start, end: stretches[stretches.length - 1].end,
      ranges: stretches.map((s, i) => ({ start: s.start, end: s.end, crop: crops[i] })),
      seconds, fits: fitReel({ start: 0, end: seconds }), ...about
    };
  });
}

/** What the candidates' file is called in the episode folder, and where each preview is, relative to that folder. */
export const REELS_FILE = "reels.json";
export const previewPath = (n) => `previews/reel-${n}.mp4`;

/** The layout of reels.json. It is raised only when its shape changes, and a reader refuses a higher one. */
const REELS_VERSION = 1;

/** reels.json, as it is written: the candidates of `video`, made by the import or by `ask` (`by`) at the moment `made`.
    `none` says why there are no candidates, and is left out when there are some. */
export const reelsFile = ({ video, by, made, candidates, none = "" }) => ({ format: "brimm-video reels", version: REELS_VERSION, video, by, made, ...(none && !candidates.length ? { none } : {}), candidates });

/** reels.json as it was read: {reels}, or {why} it cannot be used. Only what the previews, the listing and a Reel's project
    are made from is looked at: each candidate's number, its stretches and their crops. */
export function readReels(text) {
  let reels;
  try {
    reels = JSON.parse(text);
  } catch (e) {
    return { why: "it is not JSON" };
  }
  if (!reels || reels.format !== "brimm-video reels" || !Number.isInteger(reels.version)) return { why: "it is not a list of Reel candidates this tool wrote" };
  if (reels.version > REELS_VERSION) return { why: "it was written by a newer brimm-video. Ask Jason to update this Mac." };
  if (typeof reels.video !== "string" || !Array.isArray(reels.candidates)) return { why: "it is not a list of Reel candidates this tool wrote" };
  const isCrop = (c) => Boolean(c) && [c.x, c.y, c.w, c.h].every(Number.isFinite);
  const isRange = (r) => Boolean(r) && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && isCrop(r.crop);
  const bad = reels.candidates.findIndex((c) => !c || !Number.isInteger(c.n) || c.n < 1 || !Array.isArray(c.ranges) || !c.ranges.every(isRange));
  return bad === -1 ? { reels } : { why: `candidate ${bad + 1} in it cannot be read` };
}

/** The record's Reels, one for each candidate, in the record's own words (spec section 1; the contract's fields): each a
    candidate still, with its times, its title and why, and its preview as its one file. reels.json keeps the rest. */
export const reelEntries = (candidates) => candidates.map((c) => ({ n: c.n, status: "candidate", from: c.start, to: c.end, title: c.title, why: c.reason, files: c.preview ? [c.preview] : [], pushed: [] }));
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reels.js tool/tests/reels.test.js
git commit -m "Make the Reel candidates and reels.json from Claude's clips"
```

---

## Task 3: An upright project in the FCPXML writer

**Files:**
- Modify: `tool/fcpxml.js:84-181`
- Test: `tool/tests/fcpxml.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fcpxml({ ..., frame })` where `frame` is `{ width, height }` of the project, and each range may carry `crop: { x, y, w, h, found }` in pixels of the picture as it is shown. With `frame`, the file holds a second format (`r3`) of that size for the sequence, and each clip `<adjust-conform type="fill"/>` and `<adjust-transform position="X 0"/>`. Without `frame`, the file is exactly as today. `reelPosition(facts, crop, frame) → "X 0"` and `fillMost(facts, frame) → number`, exported.

- [ ] **Step 1: Write the failing tests**

Add to `tool/tests/fcpxml.test.js` (and `reelPosition` to its import):

```js
describe("an upright project of a wide video, for a Reel", () => {
  const REEL = { width: 1080, height: 1920 };
  /** A crop of the 1920x1080 picture, 606 wide, that starts `x` pixels in. */
  const crop = (x, found = true) => ({ x, y: 0, w: 606, h: 1080, found });
  const upright = (over = {}) => fcpxml({ video: VIDEO, facts: AT_30, ranges: [{ start: 0, end: 5, crop: crop(438) }, { start: 10, end: 20, crop: crop(657) }], frame: REEL, ...over });

  it("has the timeline in a format of its own, 1080 by 1920, and the video in its own", () => {
    const xml = upright();
    assert.deepEqual(tags(xml, "format"), [
      { id: "r1", name: "FFVideoFormat1080p30", frameDuration: "1/30s", width: "1920", height: "1080" },
      { id: "r3", frameDuration: "1/30s", width: "1080", height: "1920" }
    ]);
    assert.equal(tags(xml, "sequence")[0].format, "r3");
    assert.equal(tags(xml, "asset")[0].format, "r1");
  });
  it("fills the frame with each clip and moves it onto the face, before what sits on the clip", () => {
    const xml = upright({ markers: [{ at: 1, text: "A note" }] });
    assert.deepEqual(tags(xml, "adjust-conform"), [{ type: "fill" }, { type: "fill" }]);
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "20.2778 0" }, { position: "0 0" }]);
    assert.match(clips(xml)[0], /^<asset-clip [^>]*>\n<adjust-conform type="fill"\/>\n<adjust-transform position="20\.2778 0"\/>\n<marker /);
  });
  it("moves a picture no further than fills the frame, when the face is at its very edge", () => {
    // The crop is rounded down to an even width, 606 where 9:16 of 1080 is 607.5, so a crop pressed to the edge would move the
    // picture half a pixel too far and leave a sliver of black.
    assert.equal(reelPosition(AT_30, crop(0), REEL), "60.7639 0");
    assert.equal(reelPosition(AT_30, crop(1314), REEL), "-60.7639 0");
  });
  it("leaves a project of the video's own shape as it is today", () => {
    const xml = make();
    assert.deepEqual(tags(xml, "format").map((f) => f.id), ["r1"]);
    assert.deepEqual([tags(xml, "adjust-conform"), tags(xml, "adjust-transform")], [[], []]);
  });
  it("refuses a frame that cannot be read, and a clip in an upright project without its crop", () => {
    assert.throws(() => upright({ frame: { width: 0, height: 1920 } }), { message: "The frame of the project must be given in whole pixels: 0 by 1920." });
    assert.throws(() => upright({ ranges: [{ start: 0, end: 5 }] }), { message: "Piece 1 of an upright project has no crop to move it onto the face by." });
  });
});
```

Add to the `describe("Final Cut Pro's own definition of the format", ...)` block:

```js
it("passes an upright project of a wide video, with each clip filled and moved", { skip: cannot }, () => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-fcpxml-"));
  try {
    const xml = fcpxml({ ...RICH, ranges: RICH.ranges.map((r, i) => ({ ...r, crop: { x: 100 * i, y: 0, w: 606, h: 1080, found: i !== 1 } })), facts: { ...AT_2997, width: 1920, height: 1080 }, frame: { width: 1080, height: 1920 } });
    writeFileSync(join(dir, "reel.fcpxml"), xml);
    const right = spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, "reel.fcpxml")], { encoding: "utf8" });
    assert.equal(right.status, 0, right.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/fcpxml.test.js`
Expected: FAIL: no second format, no adjust tags, `reelPosition` not exported.

- [ ] **Step 3: Write the code**

In `tool/fcpxml.js`, after `libraryUrl`:

```js
/** The furthest a wide picture filled into an upright frame can be moved either way and still fill it, in the unit of
    reelPosition. */
export const fillMost = (facts, frame) => (100 * (facts.width - (facts.height * frame.width) / frame.height)) / 2 / facts.height;

/** Where a wide picture is moved in an upright frame so that its crop is what shows: Final Cut's position, "x y".
    PENDING PHASE 0 (step B2): the unit is taken to be hundredths of the frame's height, as the architect understands Final
    Cut's documentation, and has not been tried. A picture filled into an upright frame is as tall as the frame, so unmoved
    its middle shows. It is moved by how far the crop's middle is from the picture's, in hundredths of the picture's height,
    and never so far that the frame is not filled: a crop is rounded down to an even width, so one pressed to the edge would
    leave a sliver of black. If phase 0 finds another unit, or that fill is not honoured, this and the two tags it is written
    in are what change. */
export function reelPosition(facts, crop, frame) {
  const most = fillMost(facts, frame);
  const x = (100 * (facts.width / 2 - (crop.x + crop.w / 2))) / facts.height;
  const held = Math.max(-most, Math.min(most, x));
  return `${Math.round(held * 10000) / 10000 || 0} 0`;
}
```

In `fcpxml()`: take `frame` in its arguments and add to its comment: "`frame` is {width, height} of the project, for an upright project of a wide video: then each piece is filled into the frame and moved onto the face by its `crop`, and the project has a format of its own. Given none, the project is the video's own shape." Then:

```js
  if (frame && !(Number.isInteger(frame.width) && frame.width > 0 && Number.isInteger(frame.height) && frame.height > 0)) throw new Error(`The frame of the project must be given in whole pixels: ${frame.width} by ${frame.height}.`);
```

In the loop that builds `pieces`, keep the crop: `pieces.push({ from, to, name: range.name || name, crop: range.crop, captions: [], notes: new Map() });` and before it, when `frame` is given: `if (frame && !range.crop) throw new Error(\`Piece ${i + 1} of an upright project has no crop to move it onto the face by.\`);`

In `clips`, the inside of each clip:

```js
    // In an upright project each clip is first filled into the frame and moved onto the face. Final Cut's definition of the
    // format has these before what sits on the clip.
    const moved = frame ? [tag("adjust-conform", { type: "fill" }), tag("adjust-transform", { position: reelPosition(facts, piece.crop, frame) })] : [];
    const inside = [...moved, ...shown, ...noted];
```

In the resources, after the asset:

```js
      ...(frame ? [tag("format", { id: "r3", frameDuration: time(1), width: frame.width, height: frame.height })] : [])
```

and the sequence: `tag("sequence", { format: frame ? "r3" : "r1", ... })`.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS, and the xmllint test passes on this Mac (it has Final Cut Pro).

- [ ] **Step 5: Commit**

```bash
git add tool/fcpxml.js tool/tests/fcpxml.test.js
git commit -m "Write an upright project of a wide video: each clip filled into the frame and moved onto the face"
```

---

## Task 4: The checker learns a second format and more than one project

**Files:**
- Modify: `tool/fcpxml.js:212-270` (`checkFcpxml`)
- Test: `tool/tests/fcpxml.test.js`

**Interfaces:**
- Consumes: Task 3's file.
- Produces: `checkFcpxml(text, facts, { frame } = {}) → problems[]`. It checks every project in the file, each on its own; each format's frame is one frame of the video's rate; the video's format is the video's size; each timeline's format is `frame` when given, and the video's size when not; in a timeline of another shape each clip is filled and moved no further than fills the frame. With one project its words are today's, so today's tests stand. With more than one, each problem starts with the project's name.

- [ ] **Step 1: Write the failing tests**

```js
describe("our own checks of an upright project, and of a file of more than one", () => {
  const REEL = { width: 1080, height: 1920 };
  const crop = (x) => ({ x, y: 0, w: 606, h: 1080, found: true });
  const reel = fcpxml({ video: VIDEO, facts: AT_30, ranges: [{ start: 0, end: 5, crop: crop(438) }, { start: 10, end: 20, crop: crop(657) }], frame: REEL, project: "Reel 1" });
  /** The same file with one piece of it changed. */
  const changedReel = (from, to) => {
    assert.ok(reel.includes(from), `the file has ${from}`);
    return reel.replace(from, to);
  };
  /** A file of two projects: the Reel's, and a copy of it named "Reel 2" with whatever `change` does to the copy. */
  const twoProjects = (change = (p) => p) => {
    const project = reel.match(/ {8}<project [\s\S]*?<\/project>\n/)[0];
    return reel.replace(project, project + change(project.replace('name="Reel 1"', 'name="Reel 2"')));
  };

  it("pass a project of the frame it is meant to have", () => {
    assert.deepEqual(checkFcpxml(reel, AT_30, { frame: REEL }), []);
  });
  it("find a timeline of another size than it is meant to be, and a format whose frame is not one of the video's", () => {
    assert.deepEqual(checkFcpxml(reel, AT_30), ["The timeline is 1080 by 1920, and it is meant to be 1920 by 1080."]);
    assert.deepEqual(checkFcpxml(changedReel('<format id="r3" frameDuration="1/30s"', '<format id="r3" frameDuration="1/25s"'), AT_30, { frame: REEL }), ["The format r3 has frames of 1/25s, and the video's are 1/30s."]);
    assert.deepEqual(checkFcpxml(changedReel('width="1920" height="1080"', 'width="1280" height="720"'), AT_30, { frame: REEL }), ["The video's format is 1280 by 720, and the video is 1920 by 1080."]);
  });
  it("find a clip of an upright project that is not filled into the frame, or is moved so far the frame is not filled", () => {
    assert.deepEqual(checkFcpxml(changedReel('<adjust-conform type="fill"/>', '<adjust-conform type="fit"/>'), AT_30, { frame: REEL }), ["Clip 1 is not filled into the frame."]);
    assert.deepEqual(checkFcpxml(changedReel('position="20.2778 0"', 'position="61 0"'), AT_30, { frame: REEL }), ["Clip 1 is moved so far that the frame is not filled."]);
  });
  it("check each project of a file on its own, and say which project a problem is in", () => {
    assert.deepEqual(checkFcpxml(twoProjects(), AT_30, { frame: REEL }), []);
    assert.deepEqual(checkFcpxml(twoProjects((p) => p.replace('offset="5s"', 'offset="6s"')), AT_30, { frame: REEL }), ['In the project "Reel 2": there is a gap of 30 frames before clip 2.']);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/fcpxml.test.js`
Expected: FAIL: today's checker looks at the first timeline only and knows no frame.

- [ ] **Step 3: Write the code**

`checkFcpxml` uses Task 3's `fillMost`, so the writer and the checker hold one idea of how far is too far. It becomes, with the part from `const sequence = ...` to the end run once for each `project`, on the clips of that project's own spine:

```js
export function checkFcpxml(text, facts, { frame } = {}) {
  const rate = rateOf(facts.frameRate);
  const total = framesIn(facts, rate);
  const all = tagsIn(text);
  const problems = [];
  const count = (frames) => `${frames} frame${frames === 1 ? "" : "s"}`;
  const read = (el, key) => (key in el.attrs ? framesOf(el.attrs[key], rate) : 0);

  for (const el of all) {
    for (const key of ["offset", "start", "duration"]) {
      if (read(el, key) === null) problems.push(`One ${el.name} has the ${key} ${el.attrs[key]}, which is not a whole number of frames.`);
    }
  }

  const kinds = new Map(all.filter((el) => "id" in el.attrs).map((el) => [el.attrs.id, el.name]));
  for (const el of all) {
    for (const [key, kind] of [["format", "format"], ["ref", POINTS_AT[el.name]]]) {
      const id = el.attrs[key];
      if (id === undefined) continue;
      if (kind ? kinds.get(id) !== kind : !kinds.has(id)) problems.push(`The ${el.name} points at "${id}", and the file holds ${kind ? `no ${kind}` : "nothing"} of that name.`);
    }
  }

  // Each format's frames are the video's, and the video's own format is the video's size. A timeline is the size it is meant
  // to be: `frame` for an upright project, and the video's own size otherwise.
  const one = timeOf(1, rate);
  const formats = new Map(all.filter((el) => el.name === "format").map((el) => [el.attrs.id, el]));
  for (const format of formats.values()) {
    if (format.attrs.frameDuration !== one) problems.push(`The format ${format.attrs.id} has frames of ${format.attrs.frameDuration}, and the video's are ${one}.`);
  }
  const asset = all.find((el) => el.name === "asset");
  const own = asset && formats.get(asset.attrs.format);
  if (own && (Number(own.attrs.width) !== facts.width || Number(own.attrs.height) !== facts.height)) problems.push(`The video's format is ${own.attrs.width} by ${own.attrs.height}, and the video is ${facts.width} by ${facts.height}.`);
  const meant = frame || { width: facts.width, height: facts.height };

  // Each project on its own. With more than one, each problem says which project it is in.
  const projects = all.filter((el) => el.name === "project");
  if (!projects.length) return [...problems, "The file has no timeline."];
  for (const project of projects) {
    const said = projects.length > 1 ? (problem) => `In the project "${project.attrs.name}": ${problem[0].toLowerCase()}${problem.slice(1)}` : (problem) => problem;
    const sequence = all.find((el) => el.name === "sequence" && el.parent === project);
    const spine = sequence && all.find((el) => el.name === "spine" && el.parent === sequence);
    if (!spine) {
      problems.push(said("The file has no timeline."));
      continue;
    }
    const shape = formats.get(sequence.attrs.format);
    const size = shape ? { width: Number(shape.attrs.width), height: Number(shape.attrs.height) } : meant;
    if (size.width !== meant.width || size.height !== meant.height) problems.push(said(`The timeline is ${size.width} by ${size.height}, and it is meant to be ${meant.width} by ${meant.height}.`));
    // A timeline of another shape than the video holds each clip filled into it and moved no further than fills it.
    const upright = size.width !== facts.width || size.height !== facts.height;
    const most = upright ? fillMost(facts, size) : 0;
    let end = read(sequence, "tcStart");
    let sum = 0;
    all.filter((el) => el.parent === spine).forEach((clip, i) => {
      const n = i + 1;
      const [offset, start, length] = ["offset", "start", "duration"].map((key) => read(clip, key));
      if (upright) {
        const conform = all.find((e) => e.parent === clip && e.name === "adjust-conform");
        const moved = all.find((e) => e.parent === clip && e.name === "adjust-transform");
        if (!conform || conform.attrs.type !== "fill") problems.push(said(`Clip ${n} is not filled into the frame.`));
        const x = moved ? Number(String(moved.attrs.position || "0 0").split(" ")[0]) : 0;
        if (!(Math.abs(x) <= most + 0.0001)) problems.push(said(`Clip ${n} is moved so far that the frame is not filled.`));
      }
      // A time that is not on a frame is in the list already, and nothing can be added up from it.
      if (offset === null || start === null || length === null) {
        end = sum = null;
        return;
      }
      if (end !== null && offset > end) problems.push(said(`There is a gap of ${count(offset - end)} before clip ${n}.`));
      if (end !== null && offset < end) problems.push(said(`Clip ${n} overlaps what comes before it by ${count(end - offset)}.`));
      if (start < 0 || start + length > total) problems.push(said(`Clip ${n} runs outside the video.`));
      for (const el of all.filter((e) => e.parent === clip && (e.name === "caption" || e.name === "marker"))) {
        const at = read(el, el.name === "caption" ? "offset" : "start");
        const long = el.name === "caption" ? read(el, "duration") : 1;
        if (at !== null && long !== null && (at < start || at + long > start + length)) problems.push(said(`A ${el.name} on clip ${n} lies outside the clip.`));
      }
      end = offset + length;
      if (sum !== null) sum += length;
    });
    const told = read(sequence, "duration");
    if (told !== null && sum !== null && told !== sum) problems.push(said(`The timeline is said to be ${count(told)} long, and its clips come to ${count(sum)}.`));
  }
  return problems;
}
```

Today's message "The file has no timeline." stays for a file with no project, and for a project with no spine. One of today's tests builds a bare `<spine>` with no project: it still gets "The file has no timeline.". Its comment gains: "`frame` is {width, height} of an upright project's timeline; given none, the timeline is meant to be the video's own size."

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS, today's fcpxml and unedited tests included (one project: today's words).

- [ ] **Step 5: Commit**

```bash
git add tool/fcpxml.js tool/tests/fcpxml.test.js
git commit -m "Check every project in a Final Cut file, each format, and each clip's move in an upright one"
```

---

## Task 5: The Reel's Final Cut project

**Files:**
- Modify: `tool/cuts.js` (`joinNotes`, moved from `tool/unedited.js:543-562`, with `capital`)
- Modify: `tool/unedited.js` (import `joinNotes`)
- Modify: `tool/reels.js` (`REEL_FRAME`, `reelProject`)
- Test: `tool/tests/reels.test.js`, `tool/tests/cuts.test.js`

**Interfaces:**
- Consumes: Task 2's candidate; `fcpxml`, `checkFcpxml` (Tasks 3, 4); `joinNotes(ranges)` (cuts.js); the plan's `ranges`; `facts` as `factsOf` gives them.
- Produces: `REEL_FRAME = { width: 1080, height: 1920 }`; `reelProject({ video, facts, candidate, plan, project, event }) → { text } | { why }`: the upright project of the candidate's stretches, each moved onto its face, with a marker at each join (what was taken out there and why) and a marker on each stretch whose crop is a guess; checked before it is given back. `video` is the raw video's whole path on this Mac (the stored copy is made relative by A's `relativeMedia`, in Task 10). No captions and no title: phase 4 adds them.

- [ ] **Step 1: Write the failing tests**

`joinNotes` has no test of its own today (it is tested through the Final Cut file in `unedited.test.js`, and those tests stay). In `tool/tests/cuts.test.js`, add one:

```js
describe("the notes at each join", () => {
  it("say how much was taken out at each join and why, one note for what is cut with nothing kept between", () => {
    const ranges = [{ start: 0, end: 2, keep: false, kind: "pause", why: "a long pause" }, { start: 2, end: 5, keep: true }, { start: 5, end: 6.5, keep: false, kind: "retake", why: "said again at 0:07" }, { start: 6.5, end: 7, keep: false, kind: "claude", why: "Claude: it trails off" }, { start: 7, end: 9, keep: true }];
    assert.deepEqual(joinNotes(ranges), [{ at: 0, text: "Taken out, 2.0 seconds. Pause: a long pause" }, { at: 5, text: "Taken out, 2.0 seconds. Retake: said again at 0:07. Claude: it trails off" }]);
  });
});
```

In `tool/tests/reels.test.js`:

```js
import { reelProject, REEL_FRAME } from "../reels.js";
import { checkFcpxml } from "../fcpxml.js";

describe("the Final Cut project of a Reel", () => {
  const VIDEO = "/Users/sallie/BRIMM Video/Episodes/2026-10-14 Talk/talk.mov";
  const [CANDIDATE] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
  const tagsOf = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
  const make = (over = {}) => reelProject({ video: VIDEO, facts: FACTS, candidate: CANDIDATE, plan: PLAN, project: "Talk reel 1 v0 3fa9c1", event: "Talk", ...over });

  it("is 1080 by 1920, its stretches as clips one after another, each filled and moved onto the face", () => {
    const { text } = make();
    assert.deepEqual(REEL_FRAME, { width: 1080, height: 1920 });
    assert.deepEqual(tagsOf(text, "asset-clip").map((c) => `${c.offset} ${c.start} ${c.duration}`), ["0s 401401/30000s 94094/30000s", "94094/30000s 576576/30000s 62062/30000s"]);
    assert.deepEqual(tagsOf(text, "adjust-transform"), [{ position: "44.4444 0" }, { position: "44.4444 0" }]);
    assert.deepEqual([tagsOf(text, "project")[0].name, tagsOf(text, "event")[0].name], ["Talk reel 1 v0 3fa9c1", "Talk"]);
    assert.deepEqual(checkFcpxml(text, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
  });
  it("has a marker at the join, saying what was taken out there and why", () => {
    assert.deepEqual(tagsOf(make().text, "marker").map((m) => [m.start, m.value]), [["576576/30000s", "Taken out, 2.7 seconds. Claude: It adds nothing to the line before it."]]);
  });
  it("has a marker on each stretch whose crop is a guess, for it to be checked by eye", () => {
    const guessed = { ...CANDIDATE, ranges: CANDIDATE.ranges.map((r, i) => ({ ...r, crop: { ...r.crop, found: i === 1 } })) };
    assert.deepEqual(tagsOf(make({ candidate: guessed }).text, "marker").map((m) => m.value), [
      "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.",
      "Taken out, 2.7 seconds. Claude: It adds nothing to the line before it."
    ]);
  });
  it("has no captions and no titles yet", () => {
    assert.deepEqual([tagsOf(make().text, "caption"), tagsOf(make().text, "title")], [[], []]);
  });
  it("is not given back, and says why, for a candidate with no stretch", () => {
    assert.deepEqual(make({ candidate: { ...CANDIDATE, ranges: [] } }), { why: "the Reel has no stretch to show" });
  });
});
```

The two clip times come from the candidate's stretches at 29.97 pictures a second: 13.38 s is picture 401, 16.516 is 495, 19.219 is 576, 21.287 is 638. The position: the face's crop starts 118 pixels into 1280, so its middle is at 320 and the picture's at 640: 320 / 720 × 100 = 44.4444.

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/reels.test.js tests/cuts.test.js`
Expected: FAIL: `joinNotes` not exported from cuts.js; `reelProject` not exported.

- [ ] **Step 3: Write the code**

Move `joinNotes` (and the `capital` it uses) from `unedited.js` to `cuts.js` unchanged, exported; `unedited.js` imports it from there and keeps its own `capital` for its other uses.

In `tool/reels.js` (imports: `fcpxml, checkFcpxml` from `./fcpxml.js`; `joinNotes` from `./cuts.js`):

```js
/** The size of a Reel, in pixels. */
export const REEL_FRAME = { width: 1080, height: 1920 };

/** The words of a marker on a stretch whose crop is a guess. */
const GUESSED = "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.";

/** The upright Final Cut project of a Reel candidate: {text}, or {why} there is none. Its stretches are clips one after
    another on a timeline of 1080 by 1920, each filled into the frame and moved onto the face by its crop (pending phase 0:
    see reelPosition in fcpxml.js). A marker at each join says how much was taken out there and why, in the plan's own words,
    and a marker on each stretch whose crop is a guess says to check it. No captions and no title yet: they come in phase 4.
    `video` is the raw video's whole path on this Mac, `facts` what ffprobe said of it (as factsOf gives them), and `plan` the
    cut plan. `project` and `event` are the names Final Cut is to give them. The text is checked before it is given back, and
    one with something wrong in it is not: `why` then says what. */
export function reelProject({ video, facts, candidate, plan, project, event }) {
  if (!candidate.ranges.length) return { why: "the Reel has no stretch to show" };
  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound };
  const joins = joinNotes(plan.ranges.filter((r) => r.start >= candidate.start && r.end <= candidate.end));
  const guesses = candidate.ranges.filter((r) => !r.crop.found).map((r) => ({ at: r.start, text: GUESSED }));
  try {
    const text = fcpxml({ video, facts: said, ranges: candidate.ranges, markers: [...guesses, ...joins], frame: REEL_FRAME, project, event });
    const wrong = checkFcpxml(text, said, { frame: REEL_FRAME });
    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
  } catch (e) {
    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
  }
}
```

`joinNotes` is given the plan's ranges that lie wholly inside the candidate, so only the cuts between its stretches have a note, never the cut before its first words or after its last.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reels.js tool/tests/reels.test.js tool/cuts.js tool/tests/cuts.test.js tool/unedited.js
git commit -m "Write a Reel's upright Final Cut project, with its joins and its guessed crops marked"
```

---

## Task 6: The listing of the candidates

**Files:**
- Modify: `tool/reels.js`
- Test: `tool/tests/reels.test.js`

**Interfaces:**
- Consumes: `reels.json` as `readReels` gives it; the record's `reels` (status of each, by `n`).
- Produces: `reelsText(reels, record) → string`: one block per candidate (number, times, length, whether it fits, title, why, what it is now: a candidate, picked, dropped or finished, its preview or why it has none, and the word to check), or why there are none and what to say to ask again.

- [ ] **Step 1: Write the failing tests**

```js
import { reelsText } from "../reels.js";

describe("the list of the Reel candidates", () => {
  const made = "2026-10-14T09:12:00-05:00";
  const [one] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
  const reels = reelsFile({ video: "talk.mov", by: "import", made, candidates: [{ ...one, preview: "previews/reel-1.mp4" }, { ...one, n: 3, title: "Thank you", seconds: 32, fits: { fits: true, why: "" }, preview: null, failed: "ffmpeg stopped (Cannot allocate memory)", check: "It ends with no pause after it: check the last word." }] });
  const record = { reels: [{ n: 1, status: "picked" }, { n: 3, status: "candidate" }] };

  it("gives each candidate's number, times, length, title, why, what it is now and its preview", () => {
    assert.equal(reelsText(reels, record), [
      "Reel candidates of talk.mov: 2.",
      "",
      "1. 0:13 to 0:21, 5 seconds. Picked.",
      "   On screen: Know your costs",
      "   Why: It makes one point and stands alone.",
      "   It does not fit a Reel. It is 5.204 seconds long, and a Reel clip is at least 15 seconds.",
      "   Preview: previews/reel-1.mp4",
      "",
      "3. 0:13 to 0:21, 32 seconds. A candidate.",
      "   On screen: Thank you",
      "   Why: It makes one point and stands alone.",
      "   No preview: ffmpeg stopped (Cannot allocate memory).",
      "   It ends with no pause after it: check the last word.",
      ""
    ].join("\n"));
  });
  it("says why there are none, and how to ask again", () => {
    assert.equal(reelsText(reelsFile({ video: "talk.mov", by: "import", made, candidates: [], none: "Claude could not be asked (it timed out)" }), { reels: [] }), "There are no Reel candidates of talk.mov: Claude could not be asked (it timed out).\nSay \"ask Claude again for Reels\" to ask again.\n");
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/reels.test.js`
Expected: FAIL: `reelsText` not exported.

- [ ] **Step 3: Write the code**

```js
import { stamp } from "./shared/text.js";

/** What a Reel is now, in the record's words, as the list says it. */
const NOW = { candidate: "A candidate", picked: "Picked", dropped: "Dropped", finished: "Finished" };

/** The list of the Reel candidates, to show a person: for each its number, where it is in the raw video, its length, what it
    is now, its words for the screen and why Claude picked it, whether it fits a Reel, its preview or why it has none, and the
    word to check when it starts or ends with no pause. With none, why there are none and how to ask again. `record` is the
    episode's record, for what each Reel is now. */
export function reelsText(reels, record) {
  const name = reels.video;
  if (!reels.candidates.length) return `There are no Reel candidates of ${name}${reels.none ? `: ${reels.none}` : ""}.\nSay "ask Claude again for Reels" to ask again.\n`;
  const status = new Map((record.reels || []).map((r) => [r.n, r.status]));
  const blocks = reels.candidates.map((c) => {
    const seconds = Math.round(c.seconds);
    return [
      `${c.n}. ${stamp(c.start)} to ${stamp(c.end)}, ${seconds} second${seconds === 1 ? "" : "s"}. ${NOW[status.get(c.n)] || NOW.candidate}.`,
      c.title && `   On screen: ${c.title}`,
      c.reason && `   Why: ${c.reason}`,
      !c.fits.fits && `   It does not fit a Reel. ${c.fits.why}`,
      c.preview ? `   Preview: ${c.preview}` : `   No preview: ${c.failed || "none was made"}.`,
      c.check && `   ${c.check}`
    ].filter(Boolean).join("\n");
  });
  return [`Reel candidates of ${name}: ${reels.candidates.length}.`, "", ...blocks.flatMap((b) => [b, ""])].join("\n");
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reels.js tool/tests/reels.test.js
git commit -m "Write the list of an episode's Reel candidates for a person to read"
```

---

## Task 7: New candidates from `ask`, without moving a picked Reel

**Files:**
- Modify: `tool/reels.js`
- Test: `tool/tests/reels.test.js`

**Interfaces:**
- Consumes: the old `reels.json` (or none), the fresh candidates from `reelCandidates`, the record's `reels`.
- Produces: `mergeCandidates({ old, fresh, record }) → { candidates, entries, added }`: the candidates of the new `reels.json` and the record's new `reels`. Every Reel the record has as `picked` or `finished` keeps its number, its candidate (stretches, crops, preview) and its record entry, untouched. Every other old candidate and its entry goes. Fresh candidates are numbered on from the highest number ever used in either, in Claude's order, and get `reelEntries`. A fresh candidate that overlaps a kept Reel's stretch is left out. `added` is the fresh candidates kept, with their new numbers: the ones whose previews are to be made.

- [ ] **Step 1: Write the failing tests**

```js
import { mergeCandidates } from "../reels.js";

describe("new candidates from asking Claude again", () => {
  const at = (n, start, end) => ({ n, start, end, ranges: [{ start, end, crop: crop720(118) }], seconds: end - start, fits: { fits: true, why: "" }, title: `Reel at ${start}`, reason: "", words: "", preview: `previews/reel-${n}.mp4` });
  const old = { candidates: [at(1, 10, 40), at(2, 100, 130), at(3, 200, 230)] };
  const record = { reels: [{ n: 1, status: "picked", pushed: [{ v: 1 }] }, { n: 2, status: "dropped" }, { n: 3, status: "candidate" }] };

  it("keep each picked or finished Reel as it is, and number the new ones on from the highest number used", () => {
    const fresh = [{ ...at(1, 300, 330), preview: null }, { ...at(2, 400, 430), preview: null }];
    const merged = mergeCandidates({ old, fresh, record });
    assert.deepEqual(merged.candidates.map((c) => [c.n, c.start]), [[1, 10], [4, 300], [5, 400]]);
    assert.deepEqual(merged.entries.map((e) => [e.n, e.status]), [[1, "picked"], [4, "candidate"], [5, "candidate"]]);
    assert.deepEqual(merged.entries[0], record.reels[0]);
    assert.deepEqual(merged.added.map((c) => c.n), [4, 5]);
  });
  it("leave out a new candidate over a kept Reel's stretch", () => {
    const merged = mergeCandidates({ old, fresh: [{ ...at(1, 20, 50), preview: null }], record });
    assert.deepEqual(merged.candidates.map((c) => c.n), [1]);
  });
  it("number from 1 when there were none before", () => {
    const merged = mergeCandidates({ old: null, fresh: [{ ...at(1, 300, 330), preview: null }], record: { reels: [] } });
    assert.deepEqual(merged.candidates.map((c) => c.n), [1]);
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/reels.test.js`
Expected: FAIL: `mergeCandidates` not exported.

- [ ] **Step 3: Write the code**

```js
/** The Reels a person has chosen, which asking Claude again never changes. */
const KEPT = new Set(["picked", "finished"]);

/** The candidates and the record's Reels after Claude is asked again (`ask`): {candidates, entries}. A Reel that is picked or
    finished keeps its number, its candidate and its record entry as they are, so a project already written of it, or a
    finished file, still matches. Every other candidate goes, with its entry. The fresh candidates are numbered on from the
    highest number used before, in either list, in Claude's order, so no number ever names two different stretches. One that
    overlaps a kept Reel is left out: the same words would be two Reels. `old` is the reels.json read before, or null. */
export function mergeCandidates({ old, fresh, record }) {
  const entries = record.reels || [];
  const kept = entries.filter((e) => KEPT.has(e.status));
  const keptCandidates = (old ? old.candidates : []).filter((c) => kept.some((e) => e.n === c.n));
  let next = Math.max(0, ...entries.map((e) => e.n), ...(old ? old.candidates.map((c) => c.n) : []));
  const over = (c) => keptCandidates.some((k) => c.start < k.end && k.start < c.end);
  const added = fresh.filter((c) => !over(c)).map((c) => ({ ...c, n: (next += 1) }));
  return { candidates: [...keptCandidates, ...added], entries: [...kept, ...reelEntries(added)], added };
}
```

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/reels.js tool/tests/reels.test.js
git commit -m "Keep picked Reels and number new candidates on when Claude is asked again"
```

---

## Task 8: The import makes candidates and previews in place of clips (after A's phase 1a is merged)

Rebase on `main` first. Then read A's merged import (`tool/unedited.js`, episode mode) and `tool/dropbox.js`, and rename anything below to A's merged names.

**Files:**
- Modify: `tool/unedited.js` (episode mode only: old mode and a one-video run keep today's clips, as A's decision D1 keeps them; old mode is removed in a later phase)
- Test: `tool/tests/unedited.test.js` (the episode-mode tests A added)

**Interfaces:**
- Consumes: Tasks 1 and 2; A's episode-mode import (`fileEpisode`, its held files, the record's `kind`, `reels` and `files`); `upright()`'s `stills`; `progress.step`.
- Produces: in an episode of kind `"episode"`: `reels.json` and `previews/reel-<n>.mp4` in the episode folder, cloned in by the rule with the rest of the import's files and listed in `files`; `record.reels = reelEntries(candidates)`; no `<stem>.reel-<n>.mp4`, `.srt` or Story part. In a short video: no previews, `reels.json` with `none: "it is a short video"` and no candidates, `reels: []`. When Claude was not asked, or picked nothing: `reels.json` with `none` saying why. The cut plan's `claude.clips` keeps each clip as read, with `files` naming its preview. A progress step "Making the Reel previews" in place of "Cutting the short clips".

- [ ] **Step 1: Write the failing tests**

Each in A's episode-mode test setup, with a made-up talk of more than 90 seconds (`longTalk(20)`: 20 sentences, 109.5 seconds) and a reply that picks two clips:

```js
describe("the Reel candidates of an episode, made at the import", () => {
  const talk = longTalk(20);
  const reply = { decisions: [], notes: "A talk.", graphics: [], clips: [{ from: "p2", to: "p5", hook: "The first point", why: "It stands alone." }, { from: "p12", to: "p15", hook: "The second point", why: "It stands alone too." }] };

  it("are in reels.json in the episode folder, each with its stretches, crops, title, why, words and preview", async () => {
    const t = episodeSetup({ ...talk, claude: [answers(reply)] });
    await importOne(t, "talk.mov");
    const reels = JSON.parse(t.readEpisode("reels.json"));
    assert.deepEqual([reels.format, reels.version, reels.video, reels.by], ["brimm-video reels", 1, "talk.mov", "import"]);
    assert.deepEqual(reels.candidates.map((c) => [c.n, c.title, c.preview]), [[1, "The first point", "previews/reel-1.mp4"], [2, "The second point", "previews/reel-2.mp4"]]);
    assert.deepEqual(t.episodeNames("previews"), ["reel-1.mp4", "reel-2.mp4"]);
    t.done();
  });
  it("each have one preview, made by seeking to its own stretches, and no clip, caption file or part of a Story", async () => {
    const t = episodeSetup({ ...talk, claude: [answers(reply)] });
    await importOne(t, "talk.mov");
    const previews = t.calls.filter((c) => c.cmd === "FFMPEG" && /reel-\d+\.mp4$/.test(c.args[c.args.length - 1]));
    const reels = JSON.parse(t.readEpisode("reels.json"));
    // Each call is exactly previewArgs of its candidate, for the raw video the import read and the name it writes under.
    const read = t.calls.find((c) => c.cmd === "FFPROBE").args.at(-1);
    assert.deepEqual(previews.map((c) => c.args), reels.candidates.map((c, i) => previewArgs({ video: read, ranges: c.ranges, out: previews[i].args.at(-1) })));
    assert.equal(t.episodeNames().filter((n) => /\.reel-\d+/.test(n)).length, 0);
    t.done();
  });
  it("are the record's Reels, each a candidate with its preview as its file, and every file is in the record's list", async () => {
    const t = episodeSetup({ ...talk, claude: [answers(reply)] });
    await importOne(t, "talk.mov");
    const record = t.record();
    assert.deepEqual(record.reels.map((r) => [r.n, r.status, r.files]), [[1, "candidate", ["previews/reel-1.mp4"]], [2, "candidate", ["previews/reel-2.mp4"]]]);
    for (const file of ["reels.json", "previews/reel-1.mp4", "previews/reel-2.mp4"]) assert.ok(file in record.files, file);
    t.done();
  });
  it("still make the others when one preview cannot be made, and say why for that one", async () => {
    const t = episodeSetup({ ...talk, claude: [answers(reply)], previews: { 2: "fail" } });
    await importOne(t, "talk.mov");
    const reels = JSON.parse(t.readEpisode("reels.json"));
    assert.deepEqual(reels.candidates.map((c) => [c.n, c.preview, c.failed || ""]), [[1, "previews/reel-1.mp4", ""], [2, null, "ffmpeg stopped (Error while filtering: Cannot allocate memory)"]]);
    t.done();
  });
  it("have a preview and a crop when the faces could not be looked for, cropped at the middle, and say it is a guess", async () => {
    const t = episodeSetup({ ...talk, claude: [answers(reply)], swift: "fail" });
    await importOne(t, "talk.mov");
    const reels = JSON.parse(t.readEpisode("reels.json"));
    assert.ok(reels.candidates.every((c) => c.preview && c.ranges.every((r) => r.crop.found === false && r.crop.x === 438)));
    t.done();
  });
  it("are none for a short video, and reels.json says so", async () => {
    const t = episodeSetup({ claude: [answers(REPLY)] });
    await importOne(t, "talk.mov");
    assert.deepEqual(JSON.parse(t.readEpisode("reels.json")).candidates, []);
    assert.match(JSON.parse(t.readEpisode("reels.json")).none, /short video/);
    assert.deepEqual(t.record().reels, []);
    assert.equal(t.calls.filter((c) => /reel-\d+\.mp4$/.test(c.args[c.args.length - 1])).length, 0);
    t.done();
  });
  it("are none, and reels.json says why, when Claude could not be asked", async () => {
    const t = episodeSetup({ ...talk, claude: [{ code: 1, stderr: "Failed to authenticate\n" }] });
    await importOne(t, "talk.mov");
    assert.match(JSON.parse(t.readEpisode("reels.json")).none, /^Claude could not be asked/);
    t.done();
  });
});
```

`episodeSetup`, `importOne`, `readEpisode`, `episodeNames` and `record` are A's episode-mode test helpers, or thin ones written over them. The ffmpeg stand-in gains `script.previews` (by candidate number: `"fail"`, `"throw"`, `"nothing"`), known by an output name matching `/reel-(\d+)\.mp4$/` inside the run's folder; it writes `preview <n>`.

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/unedited.test.js`
Expected: FAIL: the import still cuts `<stem>.reel-<n>.mp4` clips and writes no `reels.json`.

- [ ] **Step 3: Write the code**

In `tool/unedited.js`:

1. Generalise `joined` into `encoded(file, to, seconds, args, deps)`, which takes ffmpeg's arguments made for the writing name (`args(writing)`), so the upright version, the clips and the previews share one way of running ffmpeg, watching its progress and putting the file in place:

```js
/** Have ffmpeg write one file at `to`, of `seconds` of video, with the arguments `args` gives for the name it is written
    under. Resolves "" when the file is made, or why it is not. It is written whole in the run's own folder and then put where
    it belongs, as every other file is. */
async function encoded(to, seconds, args, { run, tools, files, progress = noProgress }) {
  const writing = files.at(to);
  const watch = progress.encoding(seconds);
  let made;
  try {
    made = await run(tools.ffmpeg, [...watch.args, ...args(writing)]);
  } finally {
    watch.stop();
  }
  if (made.code !== 0 || !existsSync(writing)) {
    rmSync(writing, { force: true });
    return `ffmpeg stopped (${lastLine(made.stderr)})`;
  }
  files.done(to);
  return "";
}

const joined = (file, to, { ranges, crops }, deps) => encoded(to, secondsIn(ranges), (out) => verticalArgs({ video: file, ranges, crops, out }), deps);
```

2. The previews, in place of `cutClips` in episode mode:

```js
/** Make the preview of each Reel candidate, in turn. Resolves the candidates, each with `preview` (its path in the episode
    folder) when it was made, or `failed` saying why not. One that cannot be made does not stop the others. A candidate with
    no stretch already says why. Nothing is thrown from here. */
async function makePreviews(file, candidates, deps) {
  const { progress = noProgress } = deps;
  const made = [];
  for (const [i, candidate] of candidates.entries()) {
    progress.step("Making the Reel previews", `Making preview ${i + 1} of ${candidates.length}`);
    if (!candidate.ranges.length) {
      made.push(candidate);
      continue;
    }
    const to = join(deps.outDir, previewPath(candidate.n));
    try {
      const why = await encoded(to, candidate.seconds, (out) => previewArgs({ video: file, ranges: candidate.ranges, out, fps: roughRate(facts), duration: facts.duration }), deps);
      made.push(why ? { ...candidate, failed: why } : { ...candidate, preview: previewPath(candidate.n) });
    } catch (e) {
      rmSync(deps.files.at(to), { force: true });
      made.push({ ...candidate, failed: `the work stopped (${e.code || e.message})` });
    }
  }
  return made;
}
```

(`deps.outDir` is where A's episode mode holds the import's files before they are cloned in; when A names it otherwise, use A's. The held name keeps the `previews/` folder, so `fileEpisode` makes the folder and clones the file in under `previews/reel-<n>.mp4`; check that A's `files.at` takes a name with a folder in it, and make it do so in this task if it does not.)

3. In `workOn`, in episode mode and kind `"episode"`, where today `cutClips` runs:

```js
      // The Reel candidates: Claude's clips, each with its stretches cropped on the speaker by the stills found for the upright
      // version, and a small upright preview of each. No full-size clip, no Story and no caption file: only a Reel that is
      // picked gets more (design, section 3).
      if (episode && kind === "episode") {
        const candidates = clips.length ? await makePreviews(file, reelCandidates({ clips, plan, facts, stills }), deps) : [];
        const none = !asking ? (deps.rulesOnly ? "Claude was not asked (rules only)" : "Claude Code is not installed")
          : asked && !asked.read ? `Claude could not be asked (${asked.why})` : !clips.length ? "Claude picked no clip that stands alone" : "";
        files.text(out.reels, JSON.stringify(reelsFile({ video: name, by: "import", made: localStamp(new Date(deps.now ? deps.now() : Date.now())), candidates, none }), null, 2) + "\n");
        reelsForRecord = reelEntries(candidates);
        uncut.push(...candidates.filter((c) => c.failed).map((c) => `the preview of Reel ${c.n} could not be made: ${c.failed}`));
      } else if (episode) {
        files.text(out.reels, JSON.stringify(reelsFile({ video: name, by: "import", made: localStamp(new Date()), candidates: [], none: "it is a short video" }), null, 2) + "\n");
      }
```

`out.reels` is `join(<episode work folder>, REELS_FILE)`; A's `fileEpisode` clones it in with the rest. The record A writes takes `reels: reelsForRecord` in place of the entries A made from the cut clips. `stepsFor` gains `previews` in place of `clips` in episode mode: "Making the Reel previews". A preview that could not be made is named in the log and the notes, as a clip that could not be cut is today, and is not a failed run of the import's other files.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS. Old mode's and a one-video run's tests of the short clips are unchanged and still pass.

- [ ] **Step 5: Commit**

```bash
git add tool/unedited.js tool/tests/unedited.test.js
git commit -m "Make Reel candidates and their previews at an episode's import, in place of full-size clips"
```

---

## Task 9: `--from-plan` of an episode's video makes previews (after A's phase 1a is merged)

**Files:**
- Modify: `tool/unedited.js` (`videosFromPlan`)
- Test: `tool/tests/unedited.test.js`

**Interfaces:**
- Consumes: Task 1's `previewArgs`, Task 2's `readReels`, `previewPath`; A's `replaceIn` (dropbox.js) and its late check; A's way of telling an episode folder (`record/` beside the video, read by `readEpisode`).
- Produces: for a video in an episode folder, `--from-plan` makes the rough cut and the upright version again as today, and, in place of the clips, the preview of each candidate in `reels.json` that has one, with the crops `reels.json` holds (so a preview matches the Reel's project, which is made with the same crops). Each file replaces the one before by the rule (`replaceIn`: deleted, then cloned in), never by a rename into Dropbox. With no `reels.json`, no preview is made and the log says so. Outside an episode folder, `--from-plan` is as today.

- [ ] **Step 1: Write the failing tests**

```js
describe("the videos of an episode's video, made again from its cut plan (--from-plan)", () => {
  it("make each candidate's preview again, by seeking, with the crops reels.json holds, and no clip", async () => {
    const t = episodeSetup({ ...longTalk(20), claude: [answers(TWO_CLIPS)] });
    const folder = await importOne(t, "talk.mov");
    const reels = JSON.parse(t.readEpisode("reels.json"));
    t.calls.length = 0;
    const r = await videosFromPlan(join(folder, "talk.mov"), t.deps);
    assert.deepEqual(r.made.filter((m) => m.startsWith("reel-")), ["reel-1.mp4", "reel-2.mp4"]);
    const previews = t.calls.filter((c) => /reel-\d+\.mp4$/.test(c.args[c.args.length - 1]));
    assert.deepEqual(previews.map((c) => c.args.slice(0, -1)), reels.candidates.map((c) => previewArgs({ video: join(folder, "talk.mov"), ranges: c.ranges, out: "x" }).slice(0, -1)));
    t.done();
  });
  it("put each file in place by the rule: the one before deleted, the new one cloned in, never renamed into the folder", async () => {
    const t = episodeSetup({ ...longTalk(20), claude: [answers(TWO_CLIPS)] });
    const folder = await importOne(t, "talk.mov");
    const moves = movesOf(t);
    const clones = clonesOf(t);
    await videosFromPlan(join(folder, "talk.mov"), t.deps);
    assert.deepEqual(moves.filter(([, to]) => to.startsWith(folder)), []);
    assert.ok(clones.some(([, to]) => to === join(folder, "previews", "reel-1.mp4")));
    t.done();
  });
  it("make no preview, and say so, when the episode has no reels.json, as one imported before this phase has none", async () => {
    const t = episodeSetup({ ...longTalk(20), claude: [answers(TWO_CLIPS)] });
    const folder = await importOne(t, "talk.mov");
    rmSync(join(folder, "reels.json"));
    t.calls.length = 0;
    const r = await videosFromPlan(join(folder, "talk.mov"), t.deps);
    assert.equal(t.calls.filter((c) => /reel-\d+\.mp4$/.test(c.args[c.args.length - 1])).length, 0);
    assert.ok(t.logs.includes("talk.mov: no Reel previews are made again: there is no reels.json."));
    assert.equal(r.ok, true);
    t.done();
  });
});
```

(`clonesOf` records the stand-in `clone` A's tests give. `TWO_CLIPS` is the two-clip reply of Task 8.)

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/unedited.test.js`
Expected: FAIL: `--from-plan` cuts clips and renames files into the folder.

- [ ] **Step 3: Write the code**

In `videosFromPlan`: when `readEpisode(dirname(file))` gives a record, set `episode = true`, give `filesOf` A's rule (`put` = `replaceIn` and the late-check list, as A's episode mode does), and replace the loop over `plan.claude.clips` with:

```js
    // In an episode, the Reel candidates' previews take the place of the clips: each made again from its stretches and the
    // crops reels.json holds, so it still matches the Reel's project, which is made with the same crops.
    if (episode) {
      const read = existsSync(join(dirname(file), REELS_FILE)) ? readReels(readFileSync(join(dirname(file), REELS_FILE), "utf8")) : { why: "there is no reels.json" };
      if (read.why) log(`${name}: no Reel previews are made again: ${read.why}.`);
      for (const candidate of read.reels ? read.reels.candidates.filter((c) => c.preview) : []) {
        progress.step("Making the Reel previews", `Making the preview of Reel ${candidate.n}`);
        const to = join(dirname(file), previewPath(candidate.n));
        madeOr(to, `the preview of Reel ${candidate.n} could not be made again`, await encoded(to, candidate.seconds, (out) => previewArgs({ video: file, ranges: candidate.ranges, out, fps: roughRate(facts), duration: facts.duration }), deps).catch((e) => `the work stopped (${e.code || e.message})`));
      }
    }
```

and keep today's clip loop for a video outside an episode folder.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/unedited.js tool/tests/unedited.test.js
git commit -m "Make an episode's Reel previews again from its cut plan, by the rule, in place of clips"
```

---

## Task 10: A picked Reel's project (after C's phase 2 is merged)

**Files:**
- Modify: `tool/reel.js` (C's `reelTimeline`)
- Modify: `tool/edit.js` (C's `pickReels`, `pushReel`)
- Test: `tool/tests/edit.test.js` (C's tests of `reel pick` and `push reel`)

**Interfaces:**
- Consumes: Task 5's `reelProject`; Task 2's `readReels`, `REELS_FILE`; C's `pickReels(ctx, found, ns)`, `pushReel(ctx, found, n, { noHandEdits })` and `reelTimeline(found, reel, ctx) → { xml } | { why }`; A's `relativeMedia`, `projectName({ name, part: { reel: n }, v, id })`, `textWriter`, `writeEpisode`; the cut plan `<stem>.cut-plan.json` and its `facts`.
- Produces:
  - `reelTimeline(found, reel, ctx)` gives the Reel's upright project of its candidate in `reels.json` (Task 5), named for version 0, with the raw video named relative to `edit/` and no library.
  - `reel pick` also writes that timeline as `edit/reel-<n>.v0.fcpxml` by the rule (`replaceIn` when it is there), lists it in `files`, and says: "Reel <n> is picked. Its Final Cut project is written: say 'show Reel <n> in Final Cut'." It refuses a Reel whose candidate has no stretch ("Reel <n> has nothing to show: <failed>"). Its other refusals are C's.
  - `reel drop` is C's, unchanged: the project stays where it is.
  - `push reel <n>` takes `edit/reel-<n>.v0.fcpxml` as its source, as `push main` takes `edit/main.v0.fcpxml`, and falls back to `reelTimeline` for a Reel picked before this phase. The project name and `pushed[].project` stay C's and A's.

- [ ] **Step 1: Write the failing tests**

```js
describe("a picked Reel's Final Cut project", () => {
  it("is written as edit/reel-<n>.v0.fcpxml by the rule when the Reel is picked, upright, of its stretches, its media relative", async () => {
    const t = await editSetup({ episode: episodeWithCandidates() });
    assert.equal(await t.edit(["reel", "pick", "Talk", "2"]), 0);
    const xml = t.readEpisode("edit/reel-2.v0.fcpxml");
    assert.match(xml, /<format id="r3" frameDuration="[^"]+" width="1080" height="1920"\/>/);
    assert.match(xml, /src="\.\.\/talk\.mov"/);
    assert.ok("edit/reel-2.v0.fcpxml" in t.record().files);
    assert.ok(t.clones().some(([, to]) => to.endsWith("edit/reel-2.v0.fcpxml")));
    assert.match(t.said(), /Reel 2 is picked\. Its Final Cut project is written: say 'show Reel 2 in Final Cut'\./);
    t.done();
  });
  it("is what `push reel` shows in Final Cut, retitled for its version", async () => {
    const t = await editSetup({ episode: episodeWithCandidates() });
    await t.edit(["reel", "pick", "Talk", "2"]);
    assert.equal(await t.edit(["push", "Talk", "reel", "2"]), 0);
    const pushed = t.readLocal("pushed/reel-2.v1.mac-studio.fcpxml");
    assert.match(pushed, /<project name="Talk reel 2 v1 3fa9c1"/);
    assert.match(pushed, /width="1080" height="1920"/);
    t.done();
  });
  it("is refused, with the reason, for a Reel that has nothing to show", async () => {
    const t = await editSetup({ episode: episodeWithCandidates({ 3: { ranges: [], failed: "it is shorter than one picture" } }) });
    assert.equal(await t.edit(["reel", "pick", "Talk", "3"]), 1);
    assert.match(t.said(), /Reel 3 has nothing to show: it is shorter than one picture\./);
    t.done();
  });
});
```

(`editSetup`, `edit`, `readEpisode`, `readLocal`, `record`, `clones`, `said` are A's and C's test helpers for `edit.js`. `episodeWithCandidates(over)` writes a made-up episode folder with a record of kind "episode", a cut plan, and a `reels.json` of three candidates, each changed by `over[n]`.)

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit.test.js`
Expected: FAIL: pick writes no project; push reel pushes the import's clip.

- [ ] **Step 3: Write the code**

`tool/reel.js`, `reelTimeline`'s body:

```js
/** The upright Final Cut project of one Reel, as a stored timeline: {xml}, or {why} there is none. It is made of the Reel's
    candidate in reels.json (its stretches and crops) and the cut plan (for what was taken out at each join), by reelProject,
    and names the raw video relative to edit/, with no library, as every stored timeline does (spec section 2). */
export function reelTimeline(found, reel, ctx) {
  const read = readReels(readFileSync(join(found.folder, REELS_FILE), "utf8"));
  if (read.why) return { why: `reels.json cannot be used: ${read.why}` };
  const candidate = read.reels.candidates.find((c) => c.n === reel.n);
  if (!candidate) return { why: `reels.json has no candidate ${reel.n}` };
  if (!candidate.ranges.length) return { why: `Reel ${reel.n} has nothing to show: ${candidate.failed || "it has no stretch"}` };
  const plan = JSON.parse(readFileSync(join(found.folder, `${stemOf(found.record)}.cut-plan.json`), "utf8"));
  const video = join(found.folder, found.record.video.file);
  const made = reelProject({ video, facts: plan.facts, candidate, plan, project: projectName({ name: found.record.name.text, part: { reel: reel.n }, v: 0, id: found.record.id }), event: found.record.name.text });
  if (made.why) return made;
  return { xml: relativeMedia(made.text, { from: video, to: join(found.folder, "edit"), episode: found.folder }).xml };
}
```

In C's `pickReels`, for each Reel it picks: `const made = reelTimeline(found, reel, ctx)`; on `why`, refuse that Reel and say why; otherwise `ctx.writeText(join(found.folder, "edit", \`reel-${n}.v0.fcpxml\`), made.xml, { replace: true })` and add the file to `files`, in the same record write as the status. In C's `pushReel`, take the source text from `edit/reel-<n>.v0.fcpxml` when the record lists it, and from `reelTimeline` otherwise.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS, C's tests included.

- [ ] **Step 5: Commit**

```bash
git add tool/reel.js tool/edit.js tool/tests/edit.test.js
git commit -m "Write a picked Reel's upright Final Cut project, and show it with push reel"
```

---

## Task 11: `reels`, the list, with the previews played (after A's and C's are merged)

**Files:**
- Modify: `tool/edit.js` (a command `reels "<episode>" [--no-play]`, and its help line)
- Test: `tool/tests/edit.test.js`

**Interfaces:**
- Consumes: Task 6's `reelsText`; Task 2's `readReels`; A's `readEpisode`, `waitWhole`, `ctx.openApp`.
- Produces: `reels "<episode>"` prints the list, then opens every preview that is whole on this Mac in QuickTime Player in one call (`ctx.openApp("QuickTime Player", ...files)`, real: `spawnSync("/usr/bin/open", ["-a", "QuickTime Player", ...files])`). A preview not yet whole is named: "Dropbox is still bringing this over: previews/reel-2.mp4". `--no-play` lists only. Refusals: a conflicted copy (A's), no `reels.json` ("This episode has no Reel candidates yet."), a `reels.json` that cannot be read (its `why`). Exit 0 when listed.

- [ ] **Step 1: Write the failing tests**

```js
describe("the list of an episode's Reels", () => {
  it("is printed, and the previews are opened in QuickTime Player, all in one go", async () => {
    const t = await editSetup({ episode: episodeWithCandidates() });
    assert.equal(await t.edit(["reels", "Talk"]), 0);
    assert.match(t.said(), /^Reel candidates of talk\.mov: 3\./m);
    assert.deepEqual(t.opened(), [["QuickTime Player", ...[1, 2, 3].map((n) => join(t.episodeFolder(), "previews", `reel-${n}.mp4`))]]);
    t.done();
  });
  it("names a preview Dropbox has not brought over yet, and opens the rest", async () => {
    const t = await editSetup({ episode: episodeWithCandidates(), notWhole: ["previews/reel-2.mp4"] });
    await t.edit(["reels", "Talk"]);
    assert.match(t.said(), /Dropbox is still bringing this over: previews\/reel-2\.mp4/);
    assert.equal(t.opened()[0].length, 3);
    t.done();
  });
  it("lists only, with --no-play", async () => {
    const t = await editSetup({ episode: episodeWithCandidates() });
    await t.edit(["reels", "Talk", "--no-play"]);
    assert.deepEqual(t.opened(), []);
    t.done();
  });
  it("says so when there is no reels.json", async () => {
    const t = await editSetup({ episode: episodeWithCandidates(), without: ["reels.json"] });
    assert.equal(await t.edit(["reels", "Talk"]), 1);
    assert.match(t.said(), /This episode has no Reel candidates yet\./);
    t.done();
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit.test.js`
Expected: FAIL: no `reels` command.

- [ ] **Step 3: Write the code**

```js
/** reels "<episode>" [--no-play]: the list of the episode's Reel candidates, and their previews opened in QuickTime Player,
    each that is whole on this Mac. A preview Dropbox is still bringing over is named, not opened. */
async function reels(ctx, episode, { play = true } = {}) {
  const found = findEpisode(ctx, episode);
  if (found.why) return refuse(ctx, found.why);
  const file = join(found.folder, REELS_FILE);
  if (!existsSync(file)) return refuse(ctx, "This episode has no Reel candidates yet.");
  const read = readReels(readFileSync(file, "utf8"));
  if (read.why) return refuse(ctx, `Its list of Reel candidates cannot be read: ${read.why}.`);
  ctx.say(reelsText(read.reels, found.record));
  if (!play) return 0;
  const previews = read.reels.candidates.filter((c) => c.preview).map((c) => join(found.folder, c.preview));
  const { whole, notYet } = await waitWhole(previews, { wait: ctx.wait, tries: 1, stat: ctx.stat });
  if (notYet.length) ctx.say(`Dropbox is still bringing this over: ${notYet.map((f) => relative(found.folder, f)).join(", ")}`);
  if (whole.length) ctx.openApp("QuickTime Player", ...whole);
  return 0;
}
```

(`findEpisode` and `refuse` are A's names for finding an episode by what the person called it and refusing with exit 1; use A's merged names.) Add `reels` to the help text and to the command table in `editMain`.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/tests/edit.test.js
git commit -m "List an episode's Reel candidates and play their previews in QuickTime Player"
```

---

## Task 12: `ask`, Claude asked again for Reels, detached (after A's and C's are merged)

**Files:**
- Modify: `tool/edit.js` (`ask "<episode>"` and its detached part `ask "<episode>" --now`)
- Modify: `tool/unedited.js` (export `askClaude` and `facesIn` for `ask`'s use, unchanged)
- Test: `tool/tests/edit.test.js`

**Interfaces:**
- Consumes: A's `detached.js` (lock, `caffeinate`, result file), `ctx.start`, `readEpisode`, `writeEpisode`, `textWriter`, `cloneIn`/`replaceIn`, the late check; `askClaude` (with the model the settings name), `facesIn`, `notesRequest`, `readNotes`, `clipRanges`; Tasks 1, 2, 7.
- Produces:
  - `ask "<episode>"` (foreground) refuses a short video ("A short video gets no Reels."), a conflicted copy, an `ask` already running ("Claude is being asked already. Say 'how far is it?'"), then starts `edit.js ask "<folder>" --now` detached and says "Started. The panel shows how far it is."
  - `ask --now` (detached): reads the cut plan, asks Claude with the same request and the same locked-down call the import uses (`--model` from the settings), takes only its clips (its decisions are not applied: the rough cut is made, and the clips are read on the plan as it is), finds the faces again, makes the candidates and their previews in the run's folder, merges them (Task 7), clones the previews in by the rule, writes `reels.json` again (`replaceIn`: the old one deleted first, then the new one cloned in), writes the record (`reels` from the merge, `files` updated) with `expectRev`, waits for the late check, and leaves a result file `status` reports: how many candidates, and what could not be made.
  - When Claude cannot be asked, `reels.json` and the record are left as they were, and the result says why.

- [ ] **Step 1: Write the failing tests**

```js
describe("asking Claude again for Reels", () => {
  it("starts detached and returns at once", async () => {
    const t = await editSetup({ episode: episodeWithCandidates({}, { none: "Claude could not be asked (it timed out)", candidates: [] }) });
    assert.equal(await t.edit(["ask", "Talk"]), 0);
    assert.deepEqual(t.started(), [[process.execPath, [join(t.checkout, "tool", "edit.js"), "ask", t.episodeFolder(), "--now"]]]);
    assert.match(t.said(), /Started\. The panel shows how far it is\./);
    t.done();
  });
  it("refuses a short video, and a second ask while one runs", async () => {
    const short = await editSetup({ episode: shortVideoEpisode() });
    assert.equal(await short.edit(["ask", "Talk"]), 1);
    assert.match(short.said(), /A short video gets no Reels\./);
    short.done();
    const busy = await editSetup({ episode: episodeWithCandidates(), running: ["ask"] });
    assert.equal(await busy.edit(["ask", "Talk"]), 1);
    assert.match(busy.said(), /Claude is being asked already\. Say 'how far is it\?'/);
    busy.done();
  });
  it("writes new candidates and previews by the rule, keeps a picked Reel, and numbers the new ones on", async () => {
    const t = await editSetup({ episode: episodeWithCandidates({}, { picked: [2] }), claude: [answers(TWO_CLIPS_ELSEWHERE)] });
    assert.equal(await t.edit(["ask", "Talk", "--now"]), 0);
    const reels = JSON.parse(t.readEpisode("reels.json"));
    assert.deepEqual(reels.candidates.map((c) => c.n), [2, 4, 5]);
    assert.equal(reels.by, "ask");
    assert.deepEqual(t.record().reels.map((r) => [r.n, r.status]), [[2, "picked"], [4, "candidate"], [5, "candidate"]]);
    assert.ok(t.removedBeforeClone("reels.json"));
    t.done();
  });
  it("leaves reels.json and the record as they were, and says why, when Claude cannot be asked", async () => {
    const t = await editSetup({ episode: episodeWithCandidates(), claude: [{ code: 1, stderr: "Failed to authenticate\n" }] });
    const before = t.readEpisode("reels.json");
    await t.edit(["ask", "Talk", "--now"]);
    assert.equal(t.readEpisode("reels.json"), before);
    assert.match(t.result("ask").problem, /^Claude could not be asked/);
    t.done();
  });
});
```

- [ ] **Step 2: Run them, and see them fail**

Run: `cd tool && node --test tests/edit.test.js`
Expected: FAIL: no `ask` command.

- [ ] **Step 3: Write the code**

The foreground part follows A's `retry` and C's `finish` (refusals, then `ctx.start` detached through `detached.js`). The detached part, `askNow(ctx, found)`:

```js
/** The detached part of `ask`: Claude asked again for Reel candidates, from the saved cut plan, with the import's own request
    and its locked-down call. Only its clips are taken: the rough cut is made, so its decisions are not applied, and the clips
    are read on the plan as it is. The faces are found again for the crops, the previews made, and everything copied in by
    the rule. A Reel already picked or finished keeps its number and its stretch. */
async function askNow(ctx, found) {
  const stem = stemOf(found.record);
  const plan = JSON.parse(readFileSync(join(found.folder, `${stem}.cut-plan.json`), "utf8"));
  const video = join(found.folder, found.record.video.file);
  const work = mkdtempSync(join(ctx.tmpDir, "brimm-ask-"));
  try {
    // 1. Claude, with the import's request and call. Nothing is changed when it cannot be asked.
    const asked = await askClaude(found.record.video.file, plan, plan.facts, work, ctx);
    if (!asked.read) return result(ctx, found, { problem: `Claude could not be asked (${asked.why})` });
    // 2. The fresh candidates, numbered by the merge before anything is made, so each preview is made under its own number.
    const { clips } = clipRanges(plan, asked.read.clips, []);
    const seen = await facesIn(video, work, ctx);
    const fresh = reelCandidates({ clips, plan, facts: plan.facts, stills: seen.stills || [] });
    const before = existsSync(join(found.folder, REELS_FILE)) ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")).reels || null : null;
    const merged = mergeCandidates({ old: before, fresh, record: found.record });
    const { added } = merged;
    // 3. The new previews, made in the run's folder.
    const files = holdFiles(work, ctx);
    const made = await makePreviews(video, added, { ...ctx, files, outDir: work });
    const candidates = merged.candidates.map((c) => made.find((m) => m.n === c.n) || c);
    // 4. By the rule: each new preview cloned in (one of the same name from an earlier ask deleted first), then reels.json
    //    (the old one deleted first), then the record, written once, with the files it now lists.
    const pending = [];
    for (const c of made.filter((m) => m.preview)) {
      replaceIn(files.at(join(work, c.preview)), join(found.folder, c.preview), ctx);
      pending.push({ from: files.at(join(work, c.preview)), to: join(found.folder, c.preview), bytes: statSync(files.at(join(work, c.preview))).size });
    }
    ctx.writeText(join(found.folder, REELS_FILE), JSON.stringify(reelsFile({ video: found.record.video.file, by: "ask", made: localStamp(ctx.now()), candidates, highest: merged.highest }), null, 2) + "\n", { replace: true });
    const entries = merged.entries.map((e) => {
      const c = made.find((m) => m.n === e.n);
      return c ? { ...e, files: c.preview ? [c.preview] : [] } : e;
    });
    const listed = [REELS_FILE, ...candidates.map((c) => c.preview).filter(Boolean)];
    await writeEpisode(found.folder, { ...found.record, reels: entries, files: { ...found.record.files, ...sizesOf(found.folder, listed) } }, { expectRev: found.record.rev, ...ctx });
    // 5. The late check, at least 15 minutes after the last copy, kept awake; the work folder goes only after it passes.
    const problems = await lateCheckWhenDue(pending, ctx);
    return result(ctx, found, { made: candidates.length, failed: made.filter((c) => c.failed).map((c) => `Reel ${c.n}: ${c.failed}`), problems });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
```

`holdFiles`, `sizesOf`, `result`, `stemOf` and `lateCheckWhenDue` stand for A's merged helpers: files held in a work folder (A's `filesOf` with `hold: true`), the sizes the record lists, a detached run's result file, the video's stem, and waiting for and running the late check (A's `lateCheck` with `LATE_CHECK_MS`). Use A's names. When A's late check keeps the work folder until it passes, the `finally` follows A's rule instead of deleting it at once.

- [ ] **Step 4: Run every test, and see them pass**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/edit.js tool/unedited.js tool/tests/edit.test.js
git commit -m "Ask Claude again for Reel candidates, detached, keeping the Reels already picked"
```

---

## Task 13: The README, the help, the measurements, and the pull request

**Files:**
- Modify: `README.md` ("Unedited video": the Reels on import, `reels.json`, the previews, `reels`, `reel pick`'s project, `ask`, what waits on phase 0)
- Modify: `tool/unedited.js` (the help: episode mode makes previews; `--from-plan` of an episode's video makes previews)
- Scratch only, not committed: `measure-previews.mjs` in this session's scratchpad

- [ ] **Step 1: Make two made-up recordings in the scratchpad, never from a real video**

```bash
S="$SCRATCHPAD/measure"; mkdir -p "$S"
# Like a Zoom recording: 32 minutes, 640x360, 25 a second, about 0.67 Mbit, a picture made to start every 10 seconds.
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=25" -f lavfi -i "sine=frequency=220:sample_rate=32000" -t 1920 -c:v libx264 -preset veryfast -b:v 670k -g 250 -c:a aac -b:a 64k "$S/zoom-like.mp4"
# An hour of 1080 lines at 29.97, a picture made to start every 2 seconds.
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i "testsrc2=size=1920x1080:rate=30000/1001" -f lavfi -i "sine=frequency=220:sample_rate=48000" -t 3600 -c:v libx264 -preset ultrafast -crf 28 -g 60 -c:a aac -b:a 128k "$S/hour-1080.mp4"
```

- [ ] **Step 2: Measure the previews, and the old way for one clip to compare**

`measure-previews.mjs` imports `previewArgs` and `clipArgs` from this worktree's `tool/`, makes five candidates of about 45 seconds each, of eight stretches, at 10, 30, 50, 70 and 90% of each recording, with a fixed crop, and for each recording: times each preview with the real ffmpeg, records its size and checks it with ffprobe (540x960, length within one picture of the candidate's); times one clip the old way (`clipArgs`, the whole recording decoded); and checks one stretch of a recording whose sound starts 0.5 seconds after its picture, that the preview's sound is not early (Review Focus 2). It prints a table. Run: `node "$SCRATCHPAD/measure-previews.mjs"`.

- [ ] **Step 3: Write the README and the help**

The README's "Unedited video" gains a part on the Reels: what the import makes for an episode (and not for a short video), `reels.json`'s fields, the previews and how they are made, the measured times and sizes from Step 2, `reels`, `reel pick` writing `edit/reel-<n>.v0.fcpxml`, `ask`, and that the move onto the face is pending phase 0 (with the marker for a guessed crop). The help of `unedited.js` says the same in two lines.

- [ ] **Step 4: Run every test**

Run: `cd tool && node --test`
Expected: PASS.

- [ ] **Step 5: Commit, push, and open the pull request**

```bash
git add README.md tool/unedited.js
git commit -m "Say in the README and the help what the Reels on import are, and what they cost"
git push -u origin claude/brave-solomon-d601da
gh pr create --base main --title "Phase 3: lightweight Reels" --body "<what it builds, the measurements from Step 2, what waits on phase 0, how it was tested>"
```

Message the lead the pull request's number. Never merge it.

---

## After the final review of Tasks 1 to 7

The whole-branch review found two faults in `mergeCandidates` and one in `reelCandidates`, fixed in the first PR with a test each:
- `reels.json` keeps `highest`, the highest number ever given to a Reel of the episode, and `mergeCandidates` numbers on from it and returns it as `highest`. Without it, a number let go by one `ask` could be given again by the next. Task 12 writes it (`reelsFile({ ..., highest: merged.highest })`).
- `mergeCandidates` keeps fresh candidates off a picked or finished Reel's words by its record entry's `from` and `to` too, so a Reel picked before `reels.json` existed is protected.
- `reelCandidates` takes missing stills as none (every crop the middle, a guess), so Task 8 need not guard it.

And after the lead's review of PR 8, fixed in the same PR with a test each and checked with the real ffmpeg on made-up clips:
- `previewArgs` takes `fps` (roughRate's, the rate the stretches were made at). Each stretch's picture goes on an even grid from the seek time (`fps=<rate>:start_time=0`) and is trimmed by its count of pictures (`trim=end_frame=N`); its sound is padded and trimmed to the same length (`apad=whole_dur`, `atrim=end`); `-t` reads two pictures past the end. Tasks 8, 9 and 12 pass `fps: roughRate(facts)` (or the plan's facts).
- Candidates carry `phrases`, the ids of their kept phrases. `mergeCandidates` leaves a fresh candidate out only when it shares a phrase with a kept Reel (a Reel known only by its record's times is compared without the 0.2 s of pause at its ends), and returns `ignored`, the reasons, for `ask`'s result.
- `reels.json` may hold `cannotAsk` (why asking Claude again would not work). Task 8 writes it when Claude Code is not installed ("Claude Code is not installed on this Mac") or the import goes by the rules alone ("this Mac's import is set to go by the rules alone"); Task 12's `ask` refuses in those cases with the same words. `reelsText` says a short video gets no Reels, and offers to ask again only when that can work.
- `reelProject` takes a `writer`, for a test to show its own check refuses a bad file.

And after a preview froze the Mac Studio (101 GB) during the review, fixed in the same PR:
- `previewArgs` takes `duration` (facts.duration): each stretch is stopped at the end of the video, one with no picture left before it is left out, and a preview with nothing left is refused. Tasks 8, 9 and 12 pass it.
- Each stretch is read twice, its picture alone (`-an`) and its sound alone (`-vn`), and the sound is never padded by `apad`: read together, a stretch with no sound waited for the end of the file while its picture was read on into memory.
- `tool/guard.js`, `runGuarded(cmd, args, { most, limit })`: the program runs in a process group of its own, its resident memory is looked at every 50 ms, and the whole group is killed past the cap or the time limit; `stopped` says why in plain words. `previewLimits(seconds)` gives a preview's limits: 2 GB, and 60 s plus 5 s for every second of the preview.
- **Task 8 runs every preview through it**, never through `run`: `encoded()` for a preview calls `(deps.runGuarded || runGuarded)(tools.ffmpeg, [...watch.args, ...args(writing)], previewLimits(candidate.seconds))`, and a preview it stopped gets `failed: \`ffmpeg was stopped: ${r.stopped}\``. Its test: the ffmpeg stand-in, asked for a preview, resolves `{ code: null, signal: "SIGKILL", overMemory: true, stopped: "it took more than 2 GB of memory, so it was stopped" }`, and the candidate says so while the others are made. Task 9 and Task 12 do the same.
- Every experiment with the real ffmpeg runs it through `runGuarded`, never under a bare timeout or `/usr/bin/time`.

And after the lead's guarded re-check of PR 8, fixed in the same PR:
- **A preview is made in parts, then joined, so its memory does not grow with its stretches.** `previewArgs` is gone. `previewSteps({ video, ranges, out, fps, duration, work, size })` gives `{ parts: [{ file, seconds, args }], list: { file, text }, join: { seconds, args } }`. Each part is one ffmpeg, of at most 8 stretches (fewer for a larger picture: 2 at 4K), with the same per-stretch chain, H.264 picture at the preview's quality and PCM sound, into a `.mov` in the run's folder. The join writes `list.text` to `list.file` first, then joins the parts with ffmpeg's concat, copying the picture and writing the sound once as AAC. **Task 8's `makePreviews` and Task 9 run each part, then the join, each through `runGuarded` with `previewLimits(step.seconds)`**; any step that fails or is stopped fails that preview, with the reason, and its part files go with the run's folder. Pass `size: { width: facts.width, height: facts.height }`.
- `runGuarded` also kills its groups when this process is stopped by SIGTERM, SIGINT or SIGHUP (launchctl's bootout sends SIGTERM), then ends by the signal.

And after the lead's second guarded re-check, fixed in the same PR:
- Each part's sound is mixed with silence exactly as long as the part (`anullsrc`, `amix` with `duration=first`), one channel: so every part has a sound track, always as long as its picture, and no later part plays early.
- A part and its list are named after the preview: `<preview>.part-N.mov` and `<preview>.parts.txt`, and the list names each part by its name alone (ffmpeg reads list names from the list's own folder), so a relative work folder joins.
- `previewSteps` also returns `cleanup`, the list and the parts. **Task 8 deletes every path in `cleanup` once the join is over, whether it made the preview or not** (in a `finally`), and Task 9 does the same. Its test: after a preview is made, and after one whose join fails, none of those files is left in the run's folder.

## As built, Tasks 8 and 9 (on main after phase 1a, PR 11)

- Task 8: `workOn`, in episode mode, makes the candidates and their previews in place of cutting clips (`makePreviews`: `previewSteps`, each step through `runGuarded` with `previewLimits`, the parts cleared away in a `finally`), writes `reels.json` with `none` and `cannotAsk` when there are no candidates, and hands `fileEpisode` the record's Reels as `reels: reelEntries(candidates)`. `fileEpisode` files a made file at its path beside the video (`previews/reel-1.mp4` keeps its folder), making the folder it needs. The cut plan's `claude.clips` keeps each clip, with its preview as its file. Old mode and a one-video run cut clips as before.
- Task 9: `videosFromPlan` of a video whose folder holds an episode's record holds every video it makes in a run folder in BRIMM Video Work, makes each candidate's preview again from `reels.json` (in place of the clips), then `intoEpisode` puts each in by `replaceIn`, writes the record again with the files' sizes, waits `LATE_CHECK_MS` (`deps.wait`) and runs `lateCheck`. A video outside an episode is made again as before.

## Self-review

- **Spec coverage, section 3:** up to five candidates with a title (Claude's request already asks for five and a hook of at most eight words: `notes.js`, unchanged) → Tasks 2, 8. `reels.json` with times, crops and words → Task 2. One 540x960 preview each, veryfast, crf 30, by seeking → Tasks 1, 8. No full-size clip, Story parts or caption file → Task 8. Rough cut and upright rough cut as today → Task 8 leaves them. Measured on a Zoom-like recording and an hour of 1080p → Task 13. Picked Reel → upright project, clips filled and moved → Tasks 3, 5, 10. No `reel add` → none is written. `ask` from the saved plan, the same call, the model named → Task 12. Short or upright → Task 8 (A decides the kind; no previews, `none` in `reels.json`).
- **Phase 3's row:** previews by seeking (1), `reels.json` (2), `reels` (11), `reel pick` / `reel drop` (C's, extended in 10), the Reel project with clips, crop and markers (3, 5), `ask` (12); the project's shape is tested here, and against phase 0's fixture once phase 0 commits one (a test to add then: the same assertions on its export).
- **Carried from the second review:** "`reels` opening the previews in QuickTime Player" → Task 11.
- **Placeholders:** Tasks 8 to 12 name A's and C's functions by the contract and C's message; where a merged name differs, the merged name is used. That is a rename, not a gap.
- **Type consistency:** a candidate is `{ n, start, end, ranges: [{ start, end, crop }], seconds, fits, title, reason, words, check?, preview, failed? }` in every task. The record entry is the contract's `{ n, status, from, to, title, why, files, pushed }`. `REEL_FRAME` is `{ width: 1080, height: 1920 }` in Tasks 5 and 10, and `frame` has that shape in Tasks 3 and 4.
