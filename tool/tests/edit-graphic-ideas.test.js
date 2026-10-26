// Claude's ideas for graphics as she reads them (Sallie's note 8, 25 Oct: "Add timestamps to graphics suggestions so that they can
// easily be added"): numbered, each with its start and end on the newest version shown on this Mac, put up by its number, and left
// out of Claude's notes of a raw video, whose times are the recording's. A finished video and an iPhone clip get none.
// Every program is a stand-in, nothing opens, and every name is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { notesText } from "../notes.js";
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
/** What the list says last, its example being the first idea listed that can be put up. */
const ask = (n) => `To put one up, say its number and a picture from your Pictures folder, as "put idea ${n} up with chart.png".`;
/** A raw video she has answered whose rough cut, version 0, opened on this Mac, and the other Mac's newer render, version 1. */
const renderedThere = () => {
  const there = { v: 1, how: "render", at: AT, on: "Sallie's laptop", file: "edit/main.v1.fcpxml", opened: AT };
  return episode({ version: 3, kind: "raw", answer: ANSWERED, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [ROUGH, there], base: null } }, {}, withIdeas(IDEAS));
};

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
      ask(1)
    ].join("\n")]);
    t.done();
  });
  it("reads each idea's times on the version she watches: a cut not yet shown moves none, and once it is shown they are that version's", async () => {
    const { t } = raw();
    assert.equal((await on(t.ctx.deps, "cut", "Pricing", "remove", "--words", "Today we are going to talk about pricing")).code, 0);
    assert.deepEqual((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text.split("\n").slice(0, 3), [
      "Claude's ideas for graphics on the main video: 3, with times on main v0.",
      `Idea 1, cut now: The show's name in the lower third. Over "Welcome to the show."`,
      'Idea 2, 0:04 to 0:07: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."'
    ]);
    assert.equal((await on(t.ctx.deps, "push", "Pricing")).code, 0);
    assert.deepEqual((await on(t.ctx.deps, "graphic", "Pricing", "ideas")).text.split("\n").slice(0, 3), [
      "Claude's ideas for graphics on the main video: 3, with times on main v1.",
      `Idea 1, cut now: The show's name in the lower third. Over "Welcome to the show."`,
      'Idea 2, 0:00 to 0:03: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."'
    ]);
    t.done();
  });
  it("keeps each idea's number on a Reel, and lists only those in its stretch, with their times on the Reel", async () => {
    const { t } = episode({}, {}, withIdeas(IDEAS));
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas", "reel", "2");
    assert.deepEqual([r.code, r.text], [0, [
      "Claude's ideas for graphics on Reel 2: 2, with times on Reel 2 as it is now.",
      'Idea 2, 0:00 to 0:03: A chart of what it costs to run the business. Over "So the first thing you need to do is know your costs."',
      'Idea 3, cut now: The word "important" in the corner. Over "It is very, very important."',
      ask(2)
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
  it("says nothing of a newer version the other Mac rendered, in the list or when one is put up: their first line names the version", async () => {
    const { t } = renderedThere();
    picture(t, "chart.png", 1600, 900);
    const r = await on(t.ctx.deps, "graphic", "Pricing", "ideas");
    assert.deepEqual([r.code, r.text.split("\n")[0]], [0, "Claude's ideas for graphics on the main video: 3, with times on main v0."]);
    assert.doesNotMatch(r.text, /other Mac/);
    assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "2"), { code: 0, text: 'Graphic g1, chart.png, full, idea 2, on main v0 at 0:04, for 2.7 seconds. Say "show it in Final Cut" to see it.' });
    t.done();
  });
  it("has Dropbox bring the version she watches when it is not on this Mac yet, for the list and to put one up, and writes nothing", async () => {
    const { t, found } = raw();
    picture(t, "chart.png", 1600, 900);
    t.ctx.deps.isWhole = (path) => !path.endsWith("main.v0.fcpxml");
    for (const argv of [["ideas"], ["add", "chart.png", "--idea", "1"]]) {
      t.started.length = 0;
      assert.deepEqual(await on(t.ctx.deps, "graphic", "Pricing", ...argv), { code: 1, text: "Dropbox is still bringing edit/main.v0.fcpxml over to this Mac. Say it again when it is done." }, argv.join(" "));
      assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "edit/main.v0.fcpxml"]], argv.join(" "));
    }
    assert.equal(reread(found).rev, 1);
    t.done();
  });
  it("are refused, listed or put up, for a video waiting for its answer and for a session, by the gate, before any words are read", async () => {
    const WAITING = { version: 3, kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 0:23, no retakes", came: "camera" }, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
    const SESSION = { version: 3, kind: "session", answer: ANSWERED, label: "Session, 2026-10-20", session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
    for (const [record, why] of [[WAITING, "This video is waiting for its answer: say what it is first."], [SESSION, "This is a client or group session: that is not done for one."]]) {
      const { t, found } = episode(record, {}, withIdeas(IDEAS));
      picture(t, "chart.png", 1600, 900);
      for (const argv of [["ideas"], ["add", "chart.png", "--idea", "1"]]) {
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
  it("takes the place from words that say where on the screen it goes, never from a corner in the picture", async () => {
    for (const [idea, place] of [
      ['The word "important" in the corner', "corner"],
      ["The logo in the top right corner", "corner"],
      ["The show's name in the lower third.", "lower"],
      ["A cutaway of the street corner", "full"],
      ["Corner-shop sign", "full"],
      ["A lower price", "full"]
    ]) {
      const { t, found } = episode({}, {}, withIdeas([{ id: "p7", idea }]));
      picture(t, "chart.png", 1600, 900);
      assert.equal((await on(t.ctx.deps, "graphic", "Pricing", "add", "chart.png", "--idea", "1")).code, 0, idea);
      assert.equal(reread(found).main.graphics[0].place, place, idea);
      t.done();
    }
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
      const graphics = [{ id: "p7", idea: "A chart" }, { id: "p8", idea: "Important in the corner" }];
      writeFileSync(join(found.folder, NOTES_FILE), notesText({ notes: "A tight talk.", graphics, problems }, JSON.parse(EPISODE.files["Pricing talk.cut-plan.json"]), []));
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
});

// --- Task 4 ---

describe("her skill, on ideas for graphics", () => {
  const skill = studioFiles({ checkout: "/c", node: "/n" })[".claude/skills/brimm-edit/SKILL.md"];
  const rowOf = (start) => skill.split("\n").find((line) => line.startsWith(`| ${start} |`)) || "";
  it("lists a raw video's ideas at what Claude found, shows them as printed, and puts one up by its number, in its lines as they are", () => {
    const found = rowOf('"What did Claude find?"');
    const raw = found.slice(0, found.indexOf("a session,"));
    for (const words of ['`show "<video>" notes` (Claude\'s notes, without its line that says to ask for the ideas for graphics: they follow)', '`graphic "<video>" ideas` (its ideas for graphics, each shown exactly as printed, with its number and times)']) assert.ok(raw.includes(words), words);
    const graphics = rowOf('"Show the pricing chart when I say three numbers"');
    for (const words of ['"Any ideas for graphics?": `graphic "<episode>" ideas`: show each idea exactly as printed, with its number and times, never restated without them.', '"Put idea 2 up with pricing.png": `graphic "<episode>" add "<picture>" --idea 2` (on a Reel, `graphic "<episode>" add "<picture>" reel 2 --idea 2`)']) assert.ok(graphics.includes(words), words);
    assert.ok(skill.includes("Ideas for graphics are shown as printed too, with their numbers and times."));
    assert.ok(skill.includes("To keep a cut found there, pass its words. To put up an idea for a graphic, pass its number (`--idea`)."));
  });
});

// --- Task 5 ---

describe("the README on ideas for graphics", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  it("gives graphic its --idea, says how ideas are numbered and timed, and that a raw video's notes leave them out", () => {
    const row = readme.split("\n").find((line) => line.startsWith('| `graphic "<episode>" add')) || "";
    assert.ok(row.includes('(--at <time> \\| --at-words "<words>" \\| --idea <n>)'), row);
    for (const words of ["numbered in the order their words are said", "A finished video and an iPhone clip have none.", "so it asks no guard", "printed by `show` and `open` without their ideas for graphics", "An idea on words that are cut is left out of the printed notes too"]) assert.ok(row.includes(words), words);
    assert.doesNotMatch(readme, /nothing reads them back yet/);
  });
});
