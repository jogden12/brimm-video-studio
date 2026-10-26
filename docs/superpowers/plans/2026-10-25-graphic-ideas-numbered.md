# Sallie's note 8: ideas for graphics, numbered, with times on her timeline: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie's note of 25 Oct: "Add timestamps to graphics suggestions so that they can easily be added." "Any ideas for graphics?" lists each of Claude's ideas with a number, and its start and end on the newest version shown on her Mac (the rough cut until a later version is shown). "Put idea 2 up with pricing.png" puts the picture at that idea's words, for as long as they take, in the corner or the lower third when the idea says so. "What did Claude find?" for a raw video lists the ideas too, and Claude shows them exactly as printed. Claude's notes no longer show her the ideas with the recording's times. A finished video and an iPhone clip get no ideas (Jason, 22 Oct: "Reel suggestions and spellings, nothing more"); a session never does (the gate refuses `graphic` for one, as today).

**Architecture:** All of it is in `tool/edit.js`, around the `graphic` command. One pure helper, `graphicIdeas(read)`, numbers the plan's ideas and places each on the clock `clockFor` reads (`tool/timeline.js`: the newest version shown on this Mac, the rough cut `main v0` for a raw video until a later version is shown). Both `graphic … ideas` and `graphic … add --idea <n>` use it, so the numbers and times she reads are the ones a picture is put at. `show … notes` and `open` print a raw video's notes through one small filter, `notesForHer`. Her skill changes inside four of its existing lines, and the README inside two.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages.

**Sources:** the research of 25 Oct (`brimm-video-sallie-notes-research-2026-10-25.json`, lens "graphics", note 8, in the managing session's notes) and its triage; the spec `docs/superpowers/specs/2026-10-22-brimm-video-light-import-and-fork-design.md`, section 3, "Times" ("Every list Claude shows her (Reel suggestions, graphic ideas, notes' times) is written from the stored form when shown, on her current clock") and "Finished by the editor" ("no graphic ideas").

**How this plan was made.** Every test and every line of code below was run on a scratch copy of `main` acec307, outside the repo. The 13 new tests and the one changed test fail on acec307 as written, and pass with the code below. The whole suite there is 3284 tests, of which 6 fail in the copy and in an untouched copy alike: they need the git checkout and `docs/setup/`, which the copy has not. In this worktree, acec307 passes 3271 of 3271.

## Global Constraints

- Work only in this worktree, `.claude/worktrees/graphic-ideas-times`, branch `claude/graphic-ideas-times`. Never edit, check out or run anything in `/Users/jasonogden/Claude Code/BRIMM video` itself (the launch agent runs that checkout), nor in any other worktree. Never push.
- `cd tool && node --test` passes after every task. Write the failing test first, see it fail, then the code.
- No test calls the real `claude` program, and no test opens an app: `openApp` and `run` are the stand-ins of `tests/episodes.js`. `tool/install.sh` only ever with `--print` (this plan needs no installer change). Never read a `.env`. Nothing is written into Dropbox or `~/Library`.
- Her skill (`tool/studio/SKILL.md`) stays at 128 lines: change words inside existing lines only, add no line. `claude/guide-mode` adds about 30 lines to it, and it must stay under 160 (`tests/studio.test.js`). Check with `wc -l tool/studio/SKILL.md` before Task 4's commit.
- Keep clear of open PR #40's lines (`tool/tests/edit-show.test.js`; README line 263, the `behind` row, and its neighbour 262, the `show` row; `tool/edit.js` line 30 and lines 2233 to 2350) and of `claude/guide-mode`'s test files (`part-f-fixes.test.js`, `edit-labels.test.js`, `gate.test.js`). So every new test goes in one new file, `tool/tests/edit-graphic-ideas.test.js`; the only existing test changed is one in `tool/tests/edit-session.test.js`.
- Every message she reads is in the codebase's plain words, and none holds a path or a command; a refusal names a flag only as edit.js's refusals already do ("(--for 6)").
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings

These are this plan's own, where the note, the research and the spec leave it open. Each is for Jason.

1. **An idea's number is its place in the order its words are said**, by its phrase's start in the recording, and Claude's own order for two ideas on one phrase. It is never renumbered: not by a cut, a cut kept again, a new version, or a Reel. An idea that names no phrase of the plan (a misread reply) is left out and takes no number. On a Reel, only the ideas whose words are in its stretch are listed, with the main video's numbers.
2. **An idea's times are its kept words' start and end on the clock she is reading**: `clockFor`'s, the newest version shown on this Mac (a render counts once it has opened), so `main v0`, the rough cut, for a raw video until a later version is shown. The list's first line names that clock. An idea whose words are cut now says "cut now", and is still listed, so a number is never missing without a word. An idea whose words were kept again since that version was made says "not on main v0 (kept again since)" and has no time there. Today's code says "at 0:00" for it, which is wrong.
3. **`--idea <n>` takes the moment and the length from the idea's own words in the plan**, in seconds of the recording, as `--at-words` takes them from her quoted words: from where its kept words start, for as long as they take on the timeline (at least a second). Nothing is read off her timeline, so it asks no guard, as `logo` and `captions` ask none. (The push asks it later, as always.)
4. **The place:** `--place` when she says one; else "corner" when the idea's words say where on the screen, as "in the corner" or "at the top right corner" (a "street corner" or a "corner shop" is what the picture shows, not a place); else "lower" when they say lower third (or lower-third); else full. A bare "lower" ("a lower price") is no place.
5. **A finished video and an iPhone clip she answered have no ideas** (`hasFinalCut` false): `graphic … ideas` says so and ends with 0, as a list with nothing in it does; `--idea` refuses with the same words and writes nothing. A video of before the switch (kind `episode`, or a short video nobody answered) keeps its ideas: its import asked Claude for them. A session is refused by the gate, as today.
6. **"What did Claude find?" for a raw video** runs `graphic "<video>" ideas` after `show "<video>" notes`. `show … notes`, and `open`'s first lines of the notes, of a raw video she has answered, leave out the notes' "Its ideas for graphics" lines, whose times are the recording's, and say in their place: `Say "any ideas for graphics?" to see them, numbered, with their times on the version you are watching.` An idea on words that are cut, which the notes put under "What could not be used from its reply" at the recording's time, is left out of the printed notes too (and that heading with it, when nothing else is under it): the list has it, "cut now", with its number. The notes file itself is not changed. The other times in the notes (what Claude changed, its clips, what could not be used) stay the recording's, as the skill's Times line already tells Claude; putting all of them on her clock is the research's medium "full fix", not this plan.
7. **The list ends by telling her how to put one up**, when at least one idea can be: `To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".`, its example being the first idea listed that can be put up (idea 2 on a Reel whose stretch starts there).

## Not in this plan

- Numbers on the Final Cut markers ("Graphic idea: …"): she never opens Final Cut.
- The other times in Claude's notes on her clock (ruling 6).
- `graphic … add --at` on a finished video is not refused (the research found it by reading; `push` refuses a finished video). A matter for phase V, which renders finished videos.
- The line `say "render it here"`, which `sayElsewhere` prints when the other Mac rendered a newer version, leads nowhere until phase V adds `render`.
- The idea's words are printed as the transcriber wrote them, as today; the Reel suggestions spell theirs as the episode spells them.
- "Make a graphic for idea 2" (note 5's text card, then `--idea 2`) waits on Jason's answer to note 5.

## Merging beside `claude/guide-mode` and PR #40

- `tool/tests/fixtures/today-says.json` pins `HELP`, which both this branch (Task 2) and `claude/guide-mode` change. Whichever merges second takes the other's file in the conflict, runs `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command's lines as it did before labels" tests/edit-labels.test.js`, checks with `git diff` that only `HELP`'s text changed in it, and commits it.
- `tool/edit.js`: the guide adds `HELP` lines after `episodes` and one block before `COMMANDS`; this branch changes the `graphic` `HELP` lines, `open`'s notes loop, the end of `show`, and `graphic` with the helpers above it. No line is shared.
- `tool/studio/SKILL.md`: lines 9, 55, 72 and 84 only, and no new line.
- `README.md`: line 67 and the `graphic` row (274). The guide inserts its rows after the `cut` row (276): two unchanged lines lie between.

---

### Task 1: `graphic … ideas`, numbered, with each idea's start and end on her clock

**Files:**
- Create: `tool/tests/edit-graphic-ideas.test.js`
- Modify: `tool/tests/edit-session.test.js` (the test "offers Claude's ideas for graphics as places on the timeline")
- Modify: `tool/edit.js` (helpers above `graphic`, and its `ideas` branch)

- [ ] **Step 1: Write the failing tests.** Create `tool/tests/edit-graphic-ideas.test.js` with this head (its imports and helpers serve every task) and Task 1's `describe`:

```js
// Claude's ideas for graphics as she reads them (Sallie's note 8, 25 Oct: "Add timestamps to graphics suggestions so that they can
// easily be added"): numbered, each with its start and end on the newest version shown on this Mac, put up by its number, and left
// out of Claude's notes of a raw video, whose times are the recording's. A finished video and an iPhone clip get none.
// Every program is a stand-in, nothing opens, and every name is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { studioFiles } from "../studio.js";
import { EPISODE, episode } from "./phase4.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
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
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
/** Claude's ideas, in its own order: on "So the first thing…" (p7), on no phrase of the plan, on "It is very, very important."
    (p8, which Claude's decision cut), and on "Welcome to the show." (p4). */
const IDEAS = [
  { id: "p7", idea: "A chart of what it costs to run the business" },
  { id: "p99", idea: "A picture of nothing" },
  { id: "p8", idea: 'The word "important" in the corner' },
  { id: "p4", idea: "The show's name in the lower third." }
];
/** The made-up episode's files, its plan holding `graphics` as Claude's ideas. */
const withIdeas = (graphics) => {
  const plan = JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]);
  return { ...EPISODE, files: { ...EPISODE.files, "Pricing talk.cut-plan.json": JSON.stringify({ ...plan, claude: { ...plan.claude, graphics } }) } };
};
/** A raw video she has answered, whose rough cut, version 0, was rendered and opened on this Mac: the clock she reads. */
const ROUGH = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT };
const raw = () => episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH], base: null } }, {}, withIdeas(IDEAS));
/** A finished video's, or an iPhone clip's, files as the light import leaves them. */
const LIGHT = { "Pricing talk.mp4": "the video", "Pricing talk.cut-plan.json": "{}", "Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n" };
const KINDS = [["finished", "a finished video"], ["short video", "an iPhone clip"]];
const light = (kind) => {
  const t = setup();
  const found = episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: "Video of 14 Oct, 09:12 (Mac Studio)" }, files: LIGHT });
  return { t, found };
};
const ASK = 'To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".';

// --- Task 1 ---

describe("graphic ideas", () => {
  it("numbers Claude's ideas in the order their words are said, each with its start and end on the rough cut she watches, and says which are cut now", async () => {
    const { t } = raw();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on the main video: 3, with times on main v0.",
      `Idea 1, 0:00 to 0:01: The show's name in the lower third. Over "Welcome to the show."`,
      'Idea 2, 0:04 to 0:07: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, cut now: The word "important" in the corner. Over "It is very, very important."',
      ASK
    ].join("\n")]);
    t.done();
  });
  it("keeps each idea's number on a Reel, and lists only those in its stretch, with their times on the Reel", async () => {
    const { t } = episode({}, {}, withIdeas(IDEAS));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on Reel 2: 2, with times on Reel 2 as it is now.",
      'Idea 2, 0:00 to 0:03: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, cut now: The word "important" in the corner. Over "It is very, very important."',
      ASK
    ].join("\n")]);
    t.done();
  });
  it("gives no time to an idea whose words were kept again since the version she watched, never 0:00", async () => {
    const { t } = raw();
    assert.equal((await on(t.ctx.deps, "cut", "Pricing", "keep", "--words", "very important")).code, 0);
    assert.match((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text, /\nIdea 3, not on main v0 \(kept again since\): The word "important" in the corner\. Over "It is very, very important\."\n/);
    t.done();
  });
  it("says Claude gave none when the plan holds none", async () => {
    const { t } = episode({}, {}, withIdeas([]));
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 0, text: "Claude gave no ideas for graphics on the main video." });
    t.done();
  });
  it("says a finished video and an iPhone clip have none", async () => {
    for (const [kind, what] of KINDS) {
      const { t } = light(kind);
      assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing talk", "ideas"), { code: 0, text: `Pricing talk has no ideas for graphics: Claude gives none for ${what}.` }, kind);
      t.done();
    }
  });
});
```

In `tool/tests/edit-session.test.js`, replace the test "offers Claude's ideas for graphics as places on the timeline" with:

```js
  it("offers Claude's ideas for graphics as places on the timeline, numbered, each with its start and end", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "graphic", FOLDER, "ideas")).text, [
      "Claude's ideas for graphics on the main video: 1, with times on the main video as it is now.",
      'Idea 1, 0:04 to 0:07: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".'
    ].join("\n"));
    t.done();
  });
```

- [ ] **Step 2: Run them, and see them fail.** `cd tool && node --test tests/edit-graphic-ideas.test.js tests/edit-session.test.js`: the six fail (today's line is `A chart …: at 0:04 on …`; a finished video's plan cannot be read; an idea kept since says "at 0:00").

- [ ] **Step 3: Write the code.** In `tool/edit.js`, just above `graphic`'s comment, add:

```js
/** Claude's ideas for graphics on a timeline, as she reads them (spec 2026-10-22, section 3, "Times"): each idea of the plan's
    `claude.graphics` on a phrase of the plan, numbered in the order their words are said (Claude's order for two on one
    phrase), so that no cut, version or Reel changes a number; one that names no phrase of the plan is left out. Each is
    { n, idea, phrase, outside, at, for, start, end }: `outside` when the timeline is a Reel whose stretch does not hold its
    words; `at`, the second of the recording its kept words start at, and `for`, how long they take on the timeline now, `at`
    null when its words are cut now; `start` and `end`, its times on the clock she is reading (`read.on`), null when its words
    are not on that version (kept again since it was made). `read` is clockFor's. */
function graphicIdeas(read) {
  const phrases = new Map((read.plan.phrases || []).map((p) => [p.id, p]));
  const listed = ((read.plan.claude && read.plan.claude.graphics) || []).map((g, i) => ({ idea: g.idea, phrase: phrases.get(g.id), i })).filter(({ phrase }) => phrase);
  return listed.sort((a, b) => a.phrase.start - b.phrase.start || a.i - b.i).map(({ idea, phrase }, k) => {
    const n = k + 1;
    if (read.span && !(phrase.end > read.span.from && phrase.start < read.span.to)) return { n, idea, phrase, outside: true, at: null };
    const kept = read.pieces.filter((r) => phrase.end > r.start && phrase.start < r.end);
    if (!kept.length) return { n, idea, phrase, at: null };
    const at = Math.max(phrase.start, kept[0].start);
    const to = Math.min(phrase.end, kept[kept.length - 1].end);
    const shown = kept.reduce((sum, r) => sum + Math.max(0, Math.min(to, r.end) - Math.max(at, r.start)), 0);
    const [start, end] = [timelineAt(read.clock, at), timelineAt(read.clock, to)];
    const on = start !== null && end !== null;
    return { n, idea, phrase, at, for: Math.round(shown * 1000) / 1000, start: on ? start : null, end: on ? end : null };
  });
}
/** Where an idea is on the clock she is reading, as its line says it: "0:04 to 0:07", "cut now", or "not on main v0 (kept again
    since)". */
const ideaWhere = (idea, on) => (idea.at === null ? "cut now" : idea.start === null ? `not on ${on} (kept again since)` : `${clockText(idea.start)} to ${clockText(idea.end)}`);
/** An idea's words as a sentence: with a full stop, unless they end in one already. */
const ideaSaid = (idea) => (/[.!?…]"?$/.test(oneLine(idea)) ? oneLine(idea) : `${oneLine(idea)}.`);
/** What is said of a finished video's or an iPhone clip's ideas for graphics: Claude gives none (Jason, 22 Oct: "Reel suggestions
    and spellings, nothing more"). */
const noIdeas = (record) => `${shownName(record)} has no ideas for graphics: Claude gives none for ${recordKind(record) === "finished" ? "a finished video" : "an iPhone clip"}.`;
/** What the list of ideas says last, when one of them can be put up. */
const IDEAS_ASK = 'To put one up, say its number and a picture from your Pictures folder, as "put idea 1 up with chart.png".';
```

and replace `graphic`'s `ideas` branch (from `if (verb === "ideas") {` to its `return 0; }`) with:

```js
  if (verb === "ideas" && !hasFinalCut(found.record)) {
    ctx.say(noIdeas(found.record));
    return 0;
  }
  if (verb === "ideas") {
    const read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    sayElsewhere(ctx, read);
    const ideas = graphicIdeas(read).filter((i) => !i.outside);
    if (!ideas.length) {
      ctx.say(`Claude gave no ideas for graphics on ${partLabel(part)}.`);
      return 0;
    }
    const head = `Claude's ideas for graphics on ${partLabel(part)}: ${ideas.length}, with times on ${read.on}.`;
    ctx.say([head, ...ideas.map((i) => `Idea ${i.n}, ${ideaWhere(i, read.on)}: ${ideaSaid(i.idea)} Over "${oneLine(i.phrase.text)}"`), ...(ideas.some((i) => i.at !== null) ? [IDEAS_ASK] : [])].join("\n"));
    return 0;
  }
```

- [ ] **Step 4: Run them, and see them pass;** then the whole suite: `cd tool && node --test`.
- [ ] **Step 5: Commit** `tool/edit.js`, `tool/tests/edit-graphic-ideas.test.js` and `tool/tests/edit-session.test.js`: "Note 8, task 1: graphic ideas are numbered, each with its start and end on the version she watches".

---

### Task 2: `graphic … add "<picture>" --idea <n>`, and the help

**Files:**
- Modify: `tool/tests/edit-graphic-ideas.test.js` (append)
- Modify: `tool/edit.js` (`HELP`'s `graphic` lines; `graphic`'s add branch and its comment)
- Modify: `tool/tests/fixtures/today-says.json` (written again: `HELP` is in it)

- [ ] **Step 1: Write the failing tests.** Append to `tool/tests/edit-graphic-ideas.test.js`:

```js
// --- Task 2 ---

describe("graphic add --idea", () => {
  it("puts a picture at an idea's words, for as long as they take, in the place the idea says, and says where on her timeline", async () => {
    const { t, found } = raw();
    picture(t, "chart.png", 1600, 900);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "1"), { code: 0, text: 'Graphic g1, chart.png, lower, idea 1, on main v0 at 0:00, for 1 second. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "2"), { code: 0, text: 'Graphic g2, chart.png, full, idea 2, on main v0 at 0:04, for 2.7 seconds. Say "show it in Final Cut" to see it.' });
    // What she says wins over what the idea says.
    assert.equal((await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "1", "--place", "full", "--for", "6")).code, 0);
    assert.deepEqual(reread(found).main.graphics, [
      { id: "g1", picture: "media/chart.png", at: 6.07, for: 1, place: "lower" },
      { id: "g2", picture: "media/chart.png", at: 13.583, for: 2.747, place: "full" },
      { id: "g3", picture: "media/chart.png", at: 6.07, for: 6, place: "full" }
    ]);
    t.done();
  });
  it("puts up an idea whose words were kept again since the version she watched, and says it is not on that version", async () => {
    const { t, found } = raw();
    picture(t, "chart.png", 1600, 900);
    assert.equal((await on(t.ctx.deps, "cut", "Pricing", "keep", "--words", "very important")).code, 0);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "3"), { code: 0, text: 'Graphic g1, chart.png, corner, idea 3, not on main v0 (kept again since), for 1.8 seconds. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).main.graphics, [{ id: "g1", picture: "media/chart.png", at: 17.246, for: 1.776, place: "corner" }]);
    t.done();
  });
  it("asks no guard on a timeline shown in Final Cut: nothing is read off her timeline", async () => {
    const { t, found } = episode();
    picture(t, "chart.png", 1600, 900);
    assert.equal((await on(t.ctx.deps, "push", "Pricing")).code, 0);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "1"), { code: 0, text: 'Graphic g1, chart.png, full, idea 1, on main v1 at 0:04, for 2.7 seconds. Say "show it in Final Cut" to see it.' });
    assert.deepEqual(reread(found).main.graphics, [{ id: "g1", picture: "media/chart.png", at: 13.583, for: 2.747, place: "full" }]);
    t.done();
  });
  it("refuses an idea cut now, one there is not, one outside a Reel's stretch, a number that is not one, and an idea with a time, and writes nothing", async () => {
    const { t, found } = episode({}, {}, withIdeas(IDEAS));
    picture(t, "chart.png", 1600, 900);
    for (const [argv, said] of [
      [["--idea", "3"], 'Idea 3 is on words cut from the main video now: "It is very, very important." Keep them first, or pick another idea.'],
      [["--idea", "4"], 'There is no idea 4 for graphics. Say "any ideas for graphics?" to see them.'],
      [["reel", "2", "--idea", "1"], "Idea 1 is outside Reel 2's stretch of the recording."],
      [["--idea", "two"], "Say which idea by its number (--idea 2)."],
      [["--idea", "0"], "Say which idea by its number (--idea 2)."],
      [["--idea", "2", "--at", "0:04"], "Say when by the idea (--idea 2), or by a time or words (--at, --at-words), not both."]
    ]) assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", ...argv), { code: 1, text: said }, argv.join(" "));
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("puts none up on a finished video or an iPhone clip, and writes nothing", async () => {
    for (const [kind, what] of KINDS) {
      const { t, found } = light(kind);
      picture(t, "chart.png", 1600, 900);
      assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing talk", "add", "chart.png", "--idea", "1"), { code: 1, text: `Pricing talk has no ideas for graphics: Claude gives none for ${what}.` }, kind);
      assert.equal(reread(found).rev, 1, kind);
      t.done();
    }
  });
});
```

- [ ] **Step 2: Run them, and see them fail** (`--idea` is not a flag yet: its number is left over as a word, "is not understood there").

- [ ] **Step 3: Write the code.** In `HELP`, the `graphic` usage and its description become:

```
  node edit.js graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>" | --idea <n>)
                     [--for <seconds>] [--place full|corner|lower] [--no-hand-edits]
                                        a picture from the Pictures folder over the timeline; "drop <id>" takes one off,
                                        "ideas" lists Claude's, numbered, with their times on the timeline, and with
                                        neither, the list. --idea <n> puts it at idea n's words, for as long as they take,
                                        in the corner or the lower third when the idea says so
```

Above `noIdeas`, add:

```js
/** The place an idea says, when it says one: "corner" for the word corner, "lower" for a lower third; null otherwise. A "lower
    price" is no place. */
const ideaPlace = (idea) => (/\bcorner\b/i.test(idea) ? "corner" : /\blower[- ]third\b/i.test(idea) ? "lower" : null);
```

`graphic`'s comment becomes:

```js
/** `graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>" | --idea <n>) [--for <seconds>]
    [--place full|corner|lower]`, `graphic "<episode>" drop <id> [main | reel <n>]`, `graphic "<episode>" ideas
    [main | reel <n>]`, and with none, the list: a picture from her Pictures folder over a timeline (spec section 4). Claude's
    ideas are listed as she reads them (graphicIdeas), and `--idea` puts the picture at one's words (Sallie's note 8). */
```

Its first line takes the flag: `const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "place", "idea"]);`. In the add branch, replace from `const place = …` to `if (moment.code !== undefined) return moment.code;` with:

```js
  const named = flags.place ? flags.place[flags.place.length - 1] : null;
  if (named !== null && !["full", "corner", "lower"].includes(named)) return refuse(ctx, `"${named}" is not a place. Say full, corner or lower.`);
  // By an idea's number, the moment is its words', from the plan: nothing is read off her timeline, so the guard is not asked.
  const asked = flags.idea ? flags.idea[flags.idea.length - 1] : undefined;
  let chosen = null;
  let moment;
  if (asked !== undefined) {
    if (!hasFinalCut(found.record)) return refuse(ctx, noIdeas(found.record));
    if (flags.at || flags["at-words"]) return refuse(ctx, "Say when by the idea (--idea 2), or by a time or words (--at, --at-words), not both.");
    const n = /^[1-9]\d*$/.test(asked) ? Number(asked) : null;
    if (n === null) return refuse(ctx, "Say which idea by its number (--idea 2).");
    const read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    chosen = graphicIdeas(read).find((i) => i.n === n);
    if (!chosen) return refuse(ctx, `There is no idea ${n} for graphics. Say "any ideas for graphics?" to see them.`);
    if (chosen.outside) return refuse(ctx, `Idea ${n} is outside Reel ${part.reel}'s stretch of the recording.`);
    if (chosen.at === null) return refuse(ctx, `Idea ${n} is on words cut from ${partLabel(part)} now: "${oneLine(chosen.phrase.text)}" Keep them first, or pick another idea.`);
    sayElsewhere(ctx, read);
    moment = { at: chosen.at, for: chosen.for, on: read.on, clock: read.clock, read };
  } else {
    moment = momentFrom(ctx, found, part, flags);
    if (moment.code !== undefined) return moment.code;
  }
  const place = named || (chosen && ideaPlace(chosen.idea)) || "full";
```

and its last line, the one that saves, becomes:

```js
  const where = !chosen ? `on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}` : `idea ${chosen.n}, ${chosen.start === null ? `not on ${moment.on} (kept again since)` : `on ${moment.on} at ${clockText(chosen.start)}`}`;
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, graphics: [...graphics, layer] })), `Graphic ${id}, ${nameOrId}, ${place}, ${where}, for ${lengthText(length.seconds)}.${cropped} ${SHOW_IT}`, got);
```

(`--at` and `--at-words` say what they said before, word for word.)

- [ ] **Step 4: Write today's pinned output again,** since `HELP` is in it: `cd tool && UPDATE_TODAY=1 node --test --test-name-pattern="prints every command's lines as it did before labels" tests/edit-labels.test.js`. Check with `git diff tool/tests/fixtures/today-says.json` that only the `graphic` lines of `HELP` changed, in each of the 20 entries that print `HELP`, and nothing else.
- [ ] **Step 5: Run the tests, and see them pass;** then the whole suite.
- [ ] **Step 6: Commit** `tool/edit.js`, `tool/tests/edit-graphic-ideas.test.js` and `tool/tests/fixtures/today-says.json`: "Note 8, task 2: graphic add --idea puts a picture at an idea's words, for their length, in the place it says".

---

### Task 3: Claude's notes of a raw video, without the recording's times for the ideas

**Files:**
- Modify: `tool/tests/edit-graphic-ideas.test.js` (append)
- Modify: `tool/edit.js` (`show`'s last lines, a filter after it, and `open`'s notes loop)

- [ ] **Step 1: Write the failing test.** Append:

```js
// --- Task 3 ---

describe("Claude's notes of a raw video she has answered", () => {
  const NOTES_FILE = "Pricing talk.edit-notes.txt";
  const IDEA_LINE = "0:13  So the first thing you need to do is know your costs.  |  A chart of what it costs";
  const NOTES = ["Claude wrote this from the words of the recording and their times only.", "", "Its notes", "A tight talk.", "", "Its ideas for graphics", IDEA_LINE, "", "Its clips", "1. 0:13 to 0:21, 8 seconds", ""].join("\n");
  const PLACE = 'Say "any ideas for graphics?" to see them, numbered, with their times on the version you are watching.';
  it("are printed, and open shows their first lines, without the ideas for graphics, whose times are the recording's, and say where they are", async () => {
    for (const [kind, expected] of [["raw", NOTES.replace(IDEA_LINE, PLACE)], ["episode", NOTES]]) {
      const t = setup();
      const record = kind === "episode" ? {} : { version: 3, kind, answer: ANSWERED, name: { text: "Pricing talk", placeholder: false } };
      const found = episodeFor(t, { record });
      writeFileSync(join(found.folder, NOTES_FILE), NOTES);
      const r = await on(t.ctx.deps, "show", FOLDER, "notes");
      assert.deepEqual([r.code, r.text], [0, expected.replace(/\n$/, "")], kind);
      const opened = (await on({ ...t.ctx.deps, wait: async () => {}, online: async () => true }, "open", FOLDER)).text.split("\n");
      const from = opened.indexOf("Claude's notes, the first lines:") + 1;
      assert.deepEqual(opened.slice(from, from + 7), expected.split("\n").filter((l) => l.trim()).map((l) => `  ${l}`), kind);
      t.done();
    }
  });
});
```

- [ ] **Step 2: Run it, and see it fail** (the raw video's notes are printed whole).

- [ ] **Step 3: Write the code.** In `show`, its last lines become:

```js
  const text = readFileSync(path, "utf8");
  ctx.say((kind === "notes" ? notesForHer(text, record) : text).replace(/\n$/, ""));
  return 0;
}

/** What is said in place of a raw video's ideas for graphics in Claude's notes: their times there are the recording's. */
const IDEAS_ELSEWHERE = 'Say "any ideas for graphics?" to see them, numbered, with their times on the version you are watching.';
/** Claude's notes as her chat shows them (show, open): of a raw video she has answered, with their ideas for graphics, whose
    times are the recording's and not her timeline's, left out and IDEAS_ELSEWHERE in their place (spec 2026-10-22, section 3,
    "Times"); any other video's as written. Each part of the notes is a heading and its lines, after an empty line (notes.js
    notesText), and Claude's own notes in them hold no empty line. */
function notesForHer(text, record) {
  if (!(isAnswered(record) && recordKind(record) === "raw")) return text;
  return text.split("\n\n").map((block) => (block.startsWith("Its ideas for graphics\n") ? `Its ideas for graphics\n${IDEAS_ELSEWHERE}` : block)).join("\n\n");
}
```

In `open`, the notes loop becomes `for (const line of notesForHer(readFileSync(notes, "utf8"), record).split("\n").filter((l) => l.trim()).slice(0, 12)) say(`  ${line}`);`.

- [ ] **Step 4: Run it, and see it pass;** then the whole suite.
- [ ] **Step 5: Commit** `tool/edit.js` and the test file: "Note 8, task 3: a raw video's notes leave out the ideas for graphics, whose times are the recording's, and say where they are".

---

### Task 4: Her skill

**Files:**
- Modify: `tool/tests/edit-graphic-ideas.test.js` (append)
- Modify: `tool/studio/SKILL.md` (lines 9, 55, 72 and 84, and no new line)

It needs Task 2 first: `tests/studio.test.js` refuses a flag the skill names that `HELP` does not give, and runs each command the skill names in a made-up world.

- [ ] **Step 1: Write the failing test.** Append:

```js
// --- Task 4 ---

describe("her skill, on ideas for graphics", () => {
  const skill = studioFiles({ checkout: "/c", node: "/n" })[".claude/skills/brimm-edit/SKILL.md"];
  const rowOf = (start) => skill.split("\n").find((line) => line.startsWith(`| ${start} |`)) || "";
  it("lists a raw video's ideas at what Claude found, shows them as printed, and puts one up by its number, in its lines as they are", () => {
    const found = rowOf('"What did Claude find?"');
    assert.ok(found.slice(0, found.indexOf("a session,")).includes('`graphic "<video>" ideas` (its ideas for graphics, each shown exactly as printed, with its number and times)'), found);
    const graphics = rowOf('"Show the pricing chart when I say three numbers"');
    for (const words of ['"Any ideas for graphics?": `graphic "<episode>" ideas`: show each idea exactly as printed, with its number and times, never restated without them.', '"Put idea 2 up with pricing.png": `graphic "<episode>" add "<picture>" --idea 2`']) assert.ok(graphics.includes(words), words);
    assert.ok(skill.includes("Ideas for graphics are shown as printed too, with their numbers and times."));
    assert.ok(skill.includes("To keep a cut found there, pass its words. To put up an idea for a graphic, pass its number (`--idea`)."));
  });
});
```

- [ ] **Step 2: Run it, and see it fail.**

- [ ] **Step 3: Change the four lines,** each in place. The words tests pin are kept as they are (`studio.test.js`'s "Ruling 25" test pins line 9's sentence and reads line 55 from "a session,"; `studio-ready.test.js` pins line 84's first two sentences).
  - Line 9: after `which are shown as printed ("A client or group session").` add ` Ideas for graphics are shown as printed too, with their numbers and times.`
  - Line 55, "What did Claude find?": ``raw with retakes, `show "<video>" notes` (Claude's notes) and `reels "<video>"` `` becomes ``raw with retakes, `show "<video>" notes` (Claude's notes), `graphic "<video>" ideas` (its ideas for graphics, each shown exactly as printed, with its number and times) and `reels "<video>"` ``.
  - Line 72, "Show the pricing chart…": its end, ``"Any ideas for graphics?": `graphic "<episode>" ideas` |``, becomes ``"Any ideas for graphics?": `graphic "<episode>" ideas`: show each idea exactly as printed, with its number and times, never restated without them. "Put idea 2 up with pricing.png": `graphic "<episode>" add "<picture>" --idea 2`: it takes the idea's time and length, and its place when the idea says corner or lower third; add `--place` only if she says one |``.
  - Line 84: after `To keep a cut found there, pass its words.` add `` To put up an idea for a graphic, pass its number (`--idea`).``

- [ ] **Step 4: Run it, and see it pass;** then `wc -l tool/studio/SKILL.md` says 128, and the whole suite passes (`studio.test.js` runs `graphic "<episode>" add "<picture>" --idea 2` and `graphic "<video>" ideas` in its made-up world, and `--idea` changes what edit.js says there, so it joins no list of flags that change nothing).
- [ ] **Step 5: Commit** `tool/studio/SKILL.md` and the test file: "Note 8, task 4: her skill lists a raw video's ideas at what Claude found, shows them as printed, and puts one up by number".

---

### Task 5: The README

**Files:**
- Modify: `tool/tests/edit-graphic-ideas.test.js` (append)
- Modify: `README.md` (line 67 and the `graphic` row; not the `show` row, beside PR #40's `behind` row)

- [ ] **Step 1: Write the failing test.** Append:

```js
// --- Task 5 ---

describe("the README on ideas for graphics", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  it("gives graphic its --idea, says how ideas are numbered and timed, and that a raw video's notes leave them out", () => {
    const row = readme.split("\n").find((line) => line.startsWith('| `graphic "<episode>" add')) || "";
    assert.ok(row.includes('(--at <time> \\| --at-words "<words>" \\| --idea <n>)'), row);
    for (const words of ["numbered in the order their words are said", "A finished video and an iPhone clip have none.", "so it asks no guard", "printed by `show` and `open` without their ideas for graphics"]) assert.ok(row.includes(words), words);
    assert.doesNotMatch(readme, /nothing reads them back yet/);
  });
});
```

- [ ] **Step 2: Run it, and see it fail.**

- [ ] **Step 3: Change the README.**
  - Line 67, `<name>.cut-plan.json`: `its ideas for graphics as they were read (kept since 2026-10-14, for later use: nothing reads them back yet),` becomes ``its ideas for graphics as they were read (kept since 2026-10-14: `graphic … ideas` lists them, numbered, and `graphic … add --idea` puts one up),``.
  - The `graphic` row becomes:

```
| `graphic "<episode>" add "<picture>" [main \| reel <n>] (--at <time> \| --at-words "<words>" \| --idea <n>) [--for <seconds>] [--place full\|corner\|lower]` | A picture from the Pictures folder over the timeline; `drop <id>` takes one off, and with neither, the list. `ideas` lists Claude's ideas for graphics (Sallie's note 8, 25 Oct), numbered in the order their words are said, so that no cut or version changes a number, each with its start and end on the newest version shown on this Mac (the rough cut, version 0, until a later one is shown), or "cut now", or no time for words kept again since that version; on a Reel, only those in its stretch, with the same numbers. A finished video and an iPhone clip have none. `--idea <n>` puts the picture at idea n's words, from the plan, for as long as they take, in the corner when the idea says corner and in the lower third when it says lower third (`--for` and `--place` still win); it reads no time off her timeline, so it asks no guard, and it refuses an idea whose words are cut now. Claude's notes of a raw video she has answered are printed by `show` and `open` without their ideas for graphics, whose times there are the recording's: a line in their place says to ask for them |
```

- [ ] **Step 4: Run it, and see it pass;** then the whole suite: 3284 tests, all passing.
- [ ] **Step 5: Commit** `README.md` and the test file: "Note 8, task 5: the README's graphic row: ideas numbered and timed on her clock, --idea, and a raw video's notes".

---

## When it reaches her

Her skill is a copy the installer writes, and her laptop runs `edit.js` from its own checkout. So this reaches Sallie only once it is merged (after `claude/guide-mode`, or before it, with the fixture step above), her checkout is pulled and her folder written again: `install.sh --print` first, and Jason's yes.
