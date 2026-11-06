// Claude's ideas for graphics as she reads them (Sallie's note 8, 25 Oct: "Add timestamps to graphics suggestions so that they can
// easily be added"): numbered, each with its start and end on the newest version shown on this Mac, put up by its number, and left
// out of Claude's notes of a raw video, whose times are the recording's. A finished video's main video gets none.
// Every program is a stand-in, nothing opens, and every name is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { notesText } from "../notes.js";
import { studioFiles } from "../studio.js";
import { EPISODE, episode } from "./phase4.js";
import { newPlannedEpisode } from "../episode.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";
import { withRules } from "./skill-rows.js";
import { projectCues } from "../project.js";
import { graphicCuesOf, graphicCuesOfPlan, graphicCuesOfRecord, GRAPHIC_CUE_KINDS, REEL_CUES_MOST } from "../graphic-cues.js";
import { clockText } from "../clock.js";

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
/** A raw video she has answered, whose rough cut, version 0, was rendered and opened on this Mac. */
const ROUGH = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT };
const raw = () => episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH], base: null } }, {}, withIdeas(IDEAS));
/** A finished video's, or an iPhone clip's, files as the light import leaves them. */
const LIGHT = { "Pricing talk.mp4": "the video", "Pricing talk.cut-plan.json": "{}", "Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n" };
const light = (kind) => {
  const t = setup();
  const found = episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: "Video of 14 Oct, 09:12 (Mac Studio)" }, files: LIGHT });
  return { t, found };
};
/** A raw video she has answered whose rough cut, version 0, opened on this Mac, and the other Mac's newer render, version 1. */
const renderedThere = () => {
  const there = { v: 1, how: "render", at: AT, on: "Sallie's laptop", file: "edit/main.v1.fcpxml", opened: AT };
  return episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH, there], base: null } }, {}, withIdeas(IDEAS));
};

// --- Task 1 ---

describe("graphic ideas", () => {
  it("numbers Claude's ideas in the order their words are said, each with its start and end on the video's own clock", async () => {
    const { t } = raw();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on the main video: 3, with times on the video.",
      `Idea 1, 0:06 to 0:07: The show's name in the lower third. Over "Welcome to the show."`,
      'Idea 2, 0:14 to 0:16: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, 0:17 to 0:19: The word "important" in the corner. Over "It is very, very important."'
    ].join("\n")]);
    t.done();
  });
  it("puts a cue at the second its words are said on the video, as the project's own cue file does", async () => {
    // "So the" is said at 12.459 s in p6, which Claude's decision cut; kept, it is the take the cue is on, at 0:12.
    const plan = JSON.parse(withCues([]).files["Pricing talk.cut-plan.json"]);
    const kept = { ...plan, phrases: plan.phrases.map((ph) => (ph.id === "p6" ? { ...ph, keep: true } : ph)), claude: { graphicCues: [cue(1, "p6", "So the", "A pause card.")] } };
    const { t } = episode({ version: 3, kind: "raw", answer: ANSWERED }, {}, { ...EPISODE, files: { ...EPISODE.files, "Pricing talk.cut-plan.json": JSON.stringify(kept) } });
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.text.split("\n")[1], 'Idea 1, 0:12 to 0:13: A pause card. Over "So the"', r.text);
    t.done();
  });
  it("needs no Final Cut file: with the rough cut not in the record, and no file in the folder, the cues are listed", async () => {
    const { t, found } = rawWithCues(CUES, { main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null } });
    assert.ok(!existsSync(join(found.folder, "edit", "main.v0.fcpxml")));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /main\.v0\.fcpxml/);
    assert.match(r.text, /^Claude's ideas for graphics on the main video: 4, with times on the video\./);
    t.done();
  });
  it("gives the same times whatever the record still lists of the Final Cut days: a rough-cut render, a push, a cut, a text, a graphic", async () => {
    const plain = rawWithCues(CUES, { main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null } });
    const push = { v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: "Pricing main v1" };
    const listed = rawWithCues(CUES, { main: { preset: { job: "full-episode", captions: "word-by-word", look: "clean" }, cuts: [{ id: "c1", keep: false, from: 5.8, to: 9 }], texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden"] }], graphics: [{ id: "g1", picture: "media/chart.png", at: 3, for: 4, place: "full" }], logo: true, pushed: [ROUGH, push], base: null } });
    const [a, b] = [await on(plain.t.ctx.deps, "graphic", "Pricing", "ideas"), await on(listed.t.ctx.deps, "graphic", "Pricing", "ideas")];
    assert.equal(a.code, 0, a.text);
    assert.equal(a.text, b.text);
    plain.t.done();
    listed.t.done();
  });
  it("keeps each idea's number on a Reel, and lists only those in its stretch, with their times on the Reel's own clock", async () => {
    const { t } = episode({}, {}, withIdeas(IDEAS));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on Reel 2: 2, with times on Reel 2.",
      'Idea 2, 0:00 to 0:03: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, 0:04 to 0:05: The word "important" in the corner. Over "It is very, very important."'
    ].join("\n")]);
    t.done();
  });
  it("lists a Reel's cues from the Reel's start", async () => {
    const { t } = rawWithCues();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "1");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text.split("\n")[0], /^Claude's ideas for graphics on Reel 1: \d+, with times on Reel 1\.$|^Claude gave no ideas for graphics on Reel 1\.$/);
    t.done();
  });
  it("says Claude gave none when the plan holds none", async () => {
    const { t } = episode({}, {}, withIdeas([]));
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 0, text: "Claude gave no ideas for graphics on the main video." });
    t.done();
  });
  it("says a finished video's main video has none", async () => {
    const { t } = light("finished");
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing talk", "ideas"), { code: 0, text: "Pricing talk has no ideas for graphics: Claude gives none for a finished video's main video." });
    t.done();
  });
  it("says a finished video's Reel gets its ideas when it is made in HyperFrames, not the main video's line", async () => {
    const t = setup();
    const reel = { n: 1, status: "candidate", from: 2, to: 30, title: "", why: "It stands alone.", files: [], pushed: [] };
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: "Video of 14 Oct, 09:12 (Mac Studio)", reels: [reel] }, files: LIGHT });
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing talk", "ideas", "reel", "1"), { code: 0, text: "Pricing talk: Claude gives Reel 1 its ideas for graphics when it is made in HyperFrames, in its project there." });
    t.done();
  });
  it("says nothing of a newer version the other Mac rendered: their first line names the version", async () => {
    const { t } = renderedThere();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text.split("\n")[0]], [0, "Claude's ideas for graphics on the main video: 3, with times on the video."]);
    assert.doesNotMatch(r.text, /other Mac/);
    t.done();
  });
  it("has Dropbox bring the words for the list, and writes nothing", async () => {
    const { t, found } = raw();
    t.ctx.deps.isWhole = (path) => !path.endsWith(".words.json");
    t.started.length = 0;
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 1, text: "Dropbox is still bringing Pricing talk.words.json over to this Mac. Say it again when it is done." });
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "Pricing talk.words.json"]]);
    t.ctx.deps.isWhole = (path) => !path.endsWith("main.v0.fcpxml");
    t.started.length = 0;
    assert.equal((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).code, 0, "a Final Cut file Dropbox has not brought over is not waited for");
    assert.deepEqual(t.started, []);
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("are refused for a video waiting for its answer and for a session, by the gate, before any words are read", async () => {
    const WAITING = { version: 3, kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera" }, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
    const SESSION = { version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-20", session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
    for (const [record, why] of [[WAITING, "This video is waiting for its answer: say what it is first."], [SESSION, "This is a client or group session: that is not done for one."]]) {
      const { t, found } = episode(record, {}, withIdeas(IDEAS));
      for (const argv of [["ideas"]]) {
        const r = await on(t.ctx.deps, "graphic", FOLDER, ...argv);
        assert.deepEqual([r.code, r.text], [1, why], `${record.label}: ${argv.join(" ")}`);
        assert.doesNotMatch(r.text, /Pricing talk/);
      }
      assert.deepEqual([t.started, reread(found).rev], [[], 1], record.label);
      t.done();
    }
  });
});

// --- Task 2 ---

// --- Graphic cues (PR H1): the same list, from the cues a raw reading writes ---

/** The made-up episode's files, its plan holding `graphicCues` and no ideas for graphics: a plan the reading of PR H1 wrote. */
const withCues = (graphicCues) => {
  const plan = JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]);
  return { ...EPISODE, files: { ...EPISODE.files, "Pricing talk.cut-plan.json": JSON.stringify({ ...plan, claude: { graphicCues } }) } };
};
const cue = (n, phrase, words, show, kind = "words", seconds = 3) => ({ n, words, kind, show, seconds, style: null, phrase });
/** Claude's cues: on "Welcome to the show" (said twice: the rules cut the first, p1, and keep the second, p4), on "know your
    costs" (p7), on "very important" (p8, which Claude's decision cut), and on words nobody says. */
const CUES = [
  cue(1, "p4", "Welcome to the show", "The show's name in the lower third."),
  cue(2, "p7", "know your costs", "A chart of what it costs to run the business", "graphic", 4),
  cue(3, "p8", "very important", 'The word "important" in the corner'),
  cue(4, "p9", "the moon landing", "A picture of the moon.", "graphic", 4)
];
const rawWithCues = (cues = CUES, record = {}) => episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH], base: null }, ...record }, {}, withCues(cues));

describe("graphic ideas, from graphic cues", () => {
  it("lists a raw video's cues with times on the video, each by its number, or not found", async () => {
    const { t } = rawWithCues();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on the main video: 4, with times on the video.",
      `Idea 1, 0:06 to 0:07: The show's name in the lower third. Over "Welcome to the show"`,
      'Idea 2, 0:15 to 0:16: A chart of what it costs to run the business. Over "know your costs"',
      'Idea 3, 0:18 to 0:19: The word "important" in the corner. Over "very important"',
      'Idea 4: A picture of the moon. Its words, "the moon landing", were not found in the video.'
    ].join("\n")]);
    t.done();
  });
  it("puts a cue on the take of its words that Claude keeps, not on the first time they are said, whichever phrase it names", async () => {
    // "Welcome to the show" is said at 1.1 s, in a retake the rules cut, and at 6.07 s. Naming p1, the retake that is cut, is naming no phrase.
    for (const phrase of ["p4", "p1", "p99", undefined]) {
      const { t } = rawWithCues([{ ...CUES[0], phrase }]);
      const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
      assert.equal(r.text.split("\n")[1], `Idea 1, 0:06 to 0:07: The show's name in the lower third. Over "Welcome to the show"`, String(phrase));
      t.done();
    }
  });
  it("numbers the cues by their own numbers, which no cut, version or Reel changes, and lists on a Reel only those whose words are in its stretch", async () => {
    const { t } = rawWithCues();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on Reel 2: 2, with times on Reel 2.",
      'Idea 2, 0:02 to 0:03: A chart of what it costs to run the business. Over "know your costs"',
      'Idea 3, 0:05 to 0:05: The word "important" in the corner. Over "very important"'
    ].join("\n")]);
    t.done();
  });
  it("finds the words of a cue as the episode spells them now: the cue is written from the plan's own words, and her spelling changes the transcript's", async () => {
    // "thing" is spelled "item" on the timeline; a cue of two words is found only if its words are spelled so too.
    const { t } = rawWithCues([cue(1, "p7", "first thing", "A list.", "graphic", 4)], { spellings: [["thing", "item"]] });
    assert.equal((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text.split("\n")[1], 'Idea 1, 0:14 to 0:14: A list. Over "first thing"');
    t.done();
  });
  it("says Claude gave none when the plan holds no cues", async () => {
    const { t } = rawWithCues([]);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 0, text: "Claude gave no ideas for graphics on the main video." });
    t.done();
  });
  it("lists the ideas of an older plan as it always did, when the plan holds no graphic cues", async () => {
    const { t } = raw();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.text.split("\n")[2], 'Idea 2, 0:14 to 0:16: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."');
    t.done();
  });
  it("is refused for a video waiting for its answer and for a session, by the gate, before any words are read", async () => {
    const WAITING = { version: 3, kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera" }, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
    const { t } = episode(WAITING, {}, withCues(CUES));
    const r = await on(t.ctx.deps, "graphic", FOLDER, "ideas");
    assert.deepEqual([r.code, r.text], [1, "This video is waiting for its answer: say what it is first."]);
    t.done();
  });
});

describe("graphic ideas, for a video made from a plan (PR H5b)", () => {
  /** The cues of the plan's video guide, which its project is made from: the reading of the joined video wrote cues of its own into the cut plan (CUES), and they are not these. */
  const GUIDE = [
    { n: 1, words: "Welcome to the show", kind: "words", show: "Her show's name.", seconds: 3, style: null },
    { n: 2, words: "know your costs", kind: "graphic", show: "A chart of costs.", seconds: 4, style: null },
    { n: 3, words: "so the first thing", kind: "b-roll", show: "Sallie at her desk.", seconds: 5, style: null, shot: 2 },
    { n: 4, words: "the moon landing", kind: "screen", show: "Her dashboard.", seconds: 4, style: null, shot: 4 }
  ];
  const planned = (cues = GUIDE) => ({
    ...newPlannedEpisode({ id: "e-20261104-400000", machine: "Mac Studio", at: AT, title: "Pricing", route: "script", voice: null, writer: { commit: "c709b57", on: "Mac Studio" } }).planned,
    set: AT, shots: [{ n: 1, kind: "talking", what: "Open." }, { n: 2, kind: "b-roll", what: "Her desk." }, { n: 3, kind: "talking", what: "Why." }, { n: 4, kind: "screen", what: "Her dashboard." }], cues, lines: ["Welcome to the show."], filmed: { at: AT, parts: [] }
  });
  const made = (cues) => rawWithCues(CUES, { version: 5, planned: planned(cues) });
  it("lists the cues of its video guide, every kind among them, in place of the reading's, under their own head", async () => {
    const { t } = made();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.text.split("\n"), [
      "The graphics of its video guide: 4, with times on the video.",
      `Idea 1, 0:06 to 0:07: Her show's name. Over "Welcome to the show"`,
      'Idea 2, 0:15 to 0:16: A chart of costs. Over "know your costs"',
      'Idea 3, 0:14 to 0:14: Sallie at her desk. Over "so the first thing"',
      'Idea 4: Her dashboard. Its words, "the moon landing", were not found in the video.'
    ]);
    t.done();
  });
  it("says its video guide has none when it holds no cue, and does not fall back on the reading's", async () => {
    const { t } = made([]);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 0, text: "The graphics of its video guide: none." });
    t.done();
  });
  it("lists a video that was not made from a plan as it always did", async () => {
    const { t } = rawWithCues();
    assert.equal((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text.split("\n")[0], "Claude's ideas for graphics on the main video: 4, with times on the video.");
    t.done();
  });
});

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
  it("leave out an idea on words that are cut as well, which the list has as cut now, in the notes as notes.js writes them", async () => {
    const PROBLEM = "Clip 4 of its reply starts on no phrase of the plan.";
    for (const problems of [[], [PROBLEM]]) {
      const t = setup();
      const found = episodeFor(t, { record: { version: 3, kind: "raw", answer: ANSWERED, name: { text: "Pricing talk", placeholder: false } } });
      const graphicCues = [{ n: 1, words: "know your costs", kind: "graphic", show: "A chart", seconds: 4, style: null, phrase: "p7" }, { n: 2, words: "very important", kind: "words", show: "Important in the corner", seconds: 3, style: null, phrase: "p8" }];
      writeFileSync(join(found.folder, NOTES_FILE), notesText({ notes: "A tight talk.", graphicCues, problems }, JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]), []));
      const r = await on(t.ctx.deps, "show", FOLDER, "notes");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /\nIts ideas for graphics\nSay "any ideas for graphics\?" to see them/);
      assert.doesNotMatch(r.text, /An idea for a graphic sits on words that are cut/);
      // The heading of what could not be used stays only while something else is under it.
      if (problems.length) assert.ok(r.text.endsWith(`\n\nWhat could not be used from its reply\n${PROBLEM}`), r.text);
      else assert.doesNotMatch(r.text, /What could not be used/);
      t.done();
    }
  });
  it("keep a cue whose words were not found in the video in a line of its own, since the notes are the only place that says so beside the list, and leave the cut one out", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "raw", answer: ANSWERED, name: { text: "Pricing talk", placeholder: false } } });
    const graphicCues = [
      { n: 1, words: "very important", kind: "words", show: "Important in the corner", seconds: 3, style: null, phrase: "p8" },
      { n: 2, words: "the moon landing", kind: "graphic", show: "A picture of the moon.", seconds: 4, style: null, phrase: "p9" }
    ];
    writeFileSync(join(found.folder, NOTES_FILE), notesText({ notes: "A tight talk.", graphicCues, problems: [] }, JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]), []));
    const r = await on(t.ctx.deps, "show", FOLDER, "notes");
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /An idea for a graphic sits on words that are cut/);
    assert.ok(r.text.endsWith('\n\nWhat could not be used from its reply\nGraphic idea 2: its words, "the moon landing", were not found in the video: A picture of the moon.'), r.text);
    t.done();
  });
});

// --- Task 4 ---

describe("her skill, on ideas for graphics", () => {
  const skill = studioFiles({ checkout: "/c", node: "/n" })[".claude/skills/brimm-edit/SKILL.md"];
  // The row and the rules under it ("More on these rows"), as the row said them before R2 split it (review changes).
  const rowOf = (start) => withRules(skill, skill.split("\n").find((line) => line.startsWith(`| ${start} |`)) || "");
  it("lists a raw video's ideas at what Claude found, and shows them as printed, in its lines as they are", () => {
    const found = rowOf('"What did Claude find?"');
    const raw = found.slice(0, found.indexOf("a session:"));
    for (const words of ['`show "<video>" notes` (Claude\'s notes, without its line that says to ask for the ideas for graphics: they follow)', '`graphic "<video>" ideas` (its ideas for graphics, each shown exactly as printed, with its number and times)']) assert.ok(raw.includes(words), words);
    const graphics = rowOf('"Any ideas for graphics?"');
    assert.ok(graphics.includes('`graphic "<episode>" ideas` (on a Reel, `graphic "<episode>" ideas reel 2`): show each idea exactly as printed, with its number and times, never restated without them.'), graphics);
    assert.ok(skill.includes("Ideas for graphics are shown as printed too, with their numbers and times."));
    assert.doesNotMatch(skill, /graphic "<episode>" add|put idea 2 up/i);
  });
});

// --- Task 5 ---

describe("the README on ideas for graphics", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  it("gives graphic only its ideas, says how ideas are numbered and timed, and that a raw video's notes leave them out", () => {
    const row = readme.split("\n").find((line) => line.startsWith('| `graphic "<episode>"')) || "";
    assert.ok(row.startsWith('| `graphic "<episode>" ideas [main \\| reel <n>]` |'), row);
    assert.doesNotMatch(row, /--idea|--at-words|--place/);
    for (const words of ["numbered in the order their words are said", "A finished video's main video has none; an iPhone clip she answered and a short video made from a plan are listed with the cues their projects are given", "printed by `show` and `open` without their ideas for graphics", "An idea on words that are cut is left out of the printed notes too"]) assert.ok(row.includes(words), words);
    assert.doesNotMatch(readme, /nothing reads them back yet/);
  });
});

// --- Parity: the list gives the seconds the project's own cue file gives (F2 fix 1) ---

/** The ideas a list printed: { n, start } for each, `start` as printed (null for a cue whose words were not found). */
const printed = (text) => text.split("\n").filter((l) => /^Idea \d+[,:]/.test(l)).map((l) => {
  const m = /^Idea (\d+)(?:, (\d+:\d\d) to \d+:\d\d)?:/.exec(l);
  return { n: Number(m[1]), start: m[2] ?? null };
});
/** The cues of the project that app.js (or app-reel.js) makes, as its own cue file places them: { n, start } on the project's clock. */
const projectList = (found, extra) => {
  const read = (name) => JSON.parse(readFileSync(join(found.folder, name), "utf8"));
  return projectCues({ words: read("Pricing talk.words.json").words, plan: read("Pricing talk.cut-plan.json"), spellings: found.record.spellings, ...extra })
    .map((c) => ({ n: c.n, start: c.at ? clockText(c.at.start) : null }));
};
const planOf = (found) => JSON.parse(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"));
const reelOf = (found, n) => JSON.parse(readFileSync(join(found.folder, "reels.json"), "utf8")).candidates.find((c) => c.n === n);

describe("graphic ideas match the project's own cue file", () => {
  it("for a raw video", async () => {
    const { t, found } = rawWithCues();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual(printed(r.text), projectList(found, { kind: "main", graphicCues: graphicCuesOfPlan(planOf(found)) }));
    assert.equal(printed(r.text).length, 4);
    t.done();
  });
  it("for a raw video with a spelling", async () => {
    const { t, found } = rawWithCues([cue(1, "p7", "first thing", "A list.", "graphic", 4), CUES[1]], { spellings: [["thing", "item"]] });
    assert.deepEqual(printed((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text), projectList(found, { kind: "main", graphicCues: graphicCuesOfPlan(planOf(found)) }));
    t.done();
  });
  it("for a video made from a plan, its guide's cues", async () => {
    const guide = [
      { n: 1, words: "Welcome to the show", kind: "words", show: "Her show's name.", seconds: 3, style: null },
      { n: 2, words: "know your costs", kind: "graphic", show: "A chart of costs.", seconds: 4, style: null },
      { n: 3, words: "so the first thing", kind: "b-roll", show: "Sallie at her desk.", seconds: 5, style: null, shot: 2 }
    ];
    const p = newPlannedEpisode({ id: "e-20261104-400000", machine: "Mac Studio", at: AT, title: "Pricing", route: "script", voice: null, writer: { commit: "c709b57", on: "Mac Studio" } }).planned;
    const planned = { ...p, set: AT, shots: [{ n: 1, kind: "talking", what: "Open." }, { n: 2, kind: "b-roll", what: "Her desk." }, { n: 3, kind: "talking", what: "Why." }], cues: guide, lines: ["Welcome to the show."], filmed: { at: AT, parts: [] } };
    const { t, found } = rawWithCues(CUES, { version: 5, planned });
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual(printed(r.text), projectList(found, { kind: "main", graphicCues: graphicCuesOf(found.record.planned.cues, { kinds: GRAPHIC_CUE_KINDS }).cues }));
    t.done();
  });
  it("for a short video made from a plan, its guide's cues and not its reading's, as app.js gives the project (the kit first)", async () => {
    const guide = [
      { n: 1, words: "Welcome to the show", kind: "words", show: "Her show's name.", seconds: 3, style: null },
      { n: 2, words: "know your costs", kind: "graphic", show: "A chart of costs.", seconds: 4, style: null }
    ];
    const p = newPlannedEpisode({ id: "e-20261104-400000", machine: "Mac Studio", at: AT, title: "Pricing", route: "script", voice: null, writer: { commit: "c709b57", on: "Mac Studio" } }).planned;
    const planned = { ...p, set: AT, shots: [{ n: 1, kind: "talking", what: "Open." }], cues: guide, lines: ["Welcome to the show."], filmed: { at: AT, parts: [] } };
    // Its reading kept a cue of its own, which the project is not given: the guide's are.
    const reading = { kind: "short video", model: "claude-sonnet-4-5", at: AT, on: "Mac Studio", account: "", outcome: "read", about: "A clip.", graphicCues: [{ n: 1, words: "very important", kind: "graphic", show: "Another.", seconds: 4, style: null }] };
    const { t, found } = episode({ version: 5, kind: "short video", answer: ANSWERED, reading, planned }, {}, withCues([]));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^The graphics of its video guide: 2, with times on /);
    assert.deepEqual(printed(r.text), projectList(found, { kind: "main", graphicCues: graphicCuesOf(found.record.planned.cues, { kinds: GRAPHIC_CUE_KINDS }).cues, short: true }));
    assert.equal(printed(r.text).length, 2, r.text);
    t.done();
  });
  it("for an iPhone clip she answered, its words placed with its cut plan's phrases as for any main video", async () => {
    // She answered it (answer.state "answered"), as join.js and the card leave it: the list is still the one the project is given (app.js graphicCuesOfRecord).
    // Both are said just after a pause, where the cut plan's phrases start the words later than the transcriber did: 0:04 and 0:14, not 0:03 and 0:13.
    const cues = [{ n: 1, words: "Let me do that again", kind: "graphic", show: "A chart.", seconds: 4, style: null }, { n: 2, words: "So the first thing", kind: "words", show: "A word.", seconds: 3, style: null }];
    const reading = { kind: "short video", model: "claude-sonnet-4-5", at: AT, on: "Mac Studio", account: "", outcome: "read", about: "A clip.", graphicCues: cues };
    const { t, found } = episode({ version: 3, kind: "short video", answer: ANSWERED, reading }, {}, withCues([]));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(printed(r.text), projectList(found, { kind: "main", graphicCues: graphicCuesOfRecord(found.record), short: true }));
    assert.equal(printed(r.text).length, 2, r.text);
    t.done();
  });
  it("for a Reel: exactly the cues its own project holds, in its numbering, on its clock", async () => {
    const { t, found } = rawWithCues();
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    const reel = reelOf(found, 2);
    assert.deepEqual(printed(r.text), projectList(found, { kind: "reel", part: { reel: 2 }, stretch: { start: reel.start, end: reel.end }, graphicCues: graphicCuesOfPlan(planOf(found)) }));
    assert.ok(printed(r.text).length > 0);
    t.done();
  });
  it("for a Reel, lists no cue that straddles the Reel's edge, and at most the project's few", async () => {
    // Reel 2 runs from 13.38 s: "talk about pricing so the first thing" starts before it and ends inside it.
    const straddle = cue(5, "p6", "talk about pricing so the first thing", "A long one.", "graphic", 4);
    const many = [1, 2, 3, 4].map((i) => cue(10 + i, "p7", "know your costs", `Card ${i}.`, "graphic", 4));
    const { t, found } = rawWithCues([...CUES.slice(1, 3), straddle, ...many]);
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    const reel = reelOf(found, 2);
    const want = projectList(found, { kind: "reel", part: { reel: 2 }, stretch: { start: reel.start, end: reel.end }, graphicCues: graphicCuesOfPlan(planOf(found)) });
    assert.deepEqual(printed(r.text), want);
    assert.ok(!printed(r.text).some((c) => c.n === 5), r.text);
    assert.ok(printed(r.text).length <= REEL_CUES_MOST, r.text);
    t.done();
  });
  it("is refused, not listed as none, when the cut plan is there but cannot be read", async () => {
    const { t, found } = rawWithCues();
    writeFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "not json");
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "ideas"), { code: 1, text: "Pricing talk.cut-plan.json or Pricing talk.words.json cannot be read." });
    t.done();
  });
});
