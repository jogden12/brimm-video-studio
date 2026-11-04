// A project's whole file set, and its writer (architecture 2026-10-27, sections 5.1, 5.2, 5.4 and 5.8, F4 and F5; plan PR 2).
// The golden files are what the pinned command line's `init --video` and `transcribe` wrote for a six-second test clip
// (tests/fixtures/hyperframes-0.8.208/init/). No test runs the command line, the app or HeyGen.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wordsOf, pausesOf, phrasesOf } from "../cuts.js";
import { COMMANDS, PIN } from "../hyperframes.js";
import { wordsOnScreen } from "../on-screen.js";
import { recordingPlacements } from "../on-timeline.js";
import { assertSafe, cutSuggestions, faceTrack, hyperframesGuidance, indexHtml, projectCues, projectFiles, projectName, reelCrop, reelSuggestions, reelWords, saidWords, settingsText, transcriptJson, writeProject } from "../project.js";

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/hyperframes-0.8.208/init/${name}`, import.meta.url), "utf8");
const GOLDEN = {
  index: fixture("index.html"),
  hyperframes: JSON.parse(fixture("hyperframes.json")),
  claude: fixture("CLAUDE.md"),
  transcript: fixture("transcript.json")
};

/** The six words of the golden's words.srt, as an episode keeps its words (cuts.js wordsOf: {w, start, end}). */
const WORDS = [
  { w: "Pricing,", start: 0.5, end: 1.1 },
  { w: "says", start: 1.2, end: 1.6 },
  { w: "Hormozy,", start: 1.7, end: 2.5 },
  { w: "is", start: 2.7, end: 2.9 },
  { w: "a", start: 3, end: 3.1 },
  { w: "skill.", start: 3.2, end: 4 }
];
/** A working copy's facts, as workcopy.js writes them beside it. */
const FACTS = { seconds: 6, fps: 30, width: 1920, height: 1080, bytes: 4830125 };
/** A cut plan as cutPlan leaves it, and Claude may change it: the first phrase is a retake of the second. */
const PLAN = {
  by: "rules",
  phrases: [
    { id: "p1", start: 0.4, end: 1.15, text: "Pricing,", words: WORDS.slice(0, 1), keep: false, kind: "retake", why: "said again at 0:01, better" },
    { id: "p2", start: 1.15, end: 4.05, text: "says Hormozy, is a skill.", words: WORDS.slice(1), keep: true, kind: "keep", why: "" }
  ]
};
/** A Reel candidate as reels.json keeps it (reels.js reelCandidates). */
const REELS = [{
  n: 2, start: 1.15, end: 4.05, ranges: [{ start: 1.15, end: 4.05, crop: { x: 656, y: 0, width: 608, height: 1080 } }], seconds: 2.9,
  title: "Pricing is a skill", reason: "a point made in one breath", words: "says Hormozy, is a skill.", phrases: ["p2"], preview: null
}];
const ID = "2026-10-14-mac-studio-3fa9c1";
const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";
const LOGOS = ["/Users/sallie/Dropbox/BRIMM Video/Assets/Logos/the-brimm-stacked-navy.svg", "/Users/sallie/Dropbox/BRIMM Video/Assets/Logos/the-brimm-stacked-white.svg"];

const main = (over = {}) => ({
  kind: "main", name: "Pricing talk", part: "main", id: ID, facts: FACTS, words: WORDS, spellings: [["Hormozy", "Hormozi"]], plan: PLAN, reels: REELS,
  guidance: GOLDEN.claude, video: "/Users/sallie/BRIMM Video Work/E/working copy/k.mp4", cli: CLI, logos: LOGOS, createdAt: "2026-10-28T15:00:00.000Z", ...over
});
/** Reel 2's stretch of the recording, as the candidate of REELS has it: from its first moment to its last. */
const STRETCH = { start: 1.15, end: 4.05 };
const reel = (over = {}) => main({ kind: "reel", part: { reel: 2 }, stretch: STRETCH, ...over });
/** A session's clip, given everything an episode's part is given: its kind alone decides what goes in. */
const clip = (over = {}) => main({ kind: "clip", clip: 3, name: undefined, part: undefined, file: "GMT20261013-142933_Recording_Jane Doe.mp4", ...over });
const json = (files, path) => JSON.parse(files.get(path));
const FONTS = ["assets/fonts/Allison-Regular.ttf", "assets/fonts/josefin-sans-latin-300-normal.woff2", "assets/fonts/josefin-sans-latin-400-italic.woff2", "assets/fonts/josefin-sans-latin-400-normal.woff2", "assets/fonts/josefin-sans-latin-500-normal.woff2"];

/** The names of a tag's attributes, in its order. */
const attributes = (tag) => [...tag.matchAll(/\s([a-z][a-z-]*)(?=[\s=>/])/g)].map((m) => m[1]);
const rootTag = (html) => html.match(/<div\b[^>]*\bid="root"[^>]*>/)[0];
const videoTag = (html) => html.match(/<video\b[^>]*>/)[0];

describe("a project's name (5.1)", () => {
  it("is the file-safe name, the part and the short id for an episode's part, with no version", () => {
    assert.equal(projectName({ name: "Pricing talk", part: "main", id: ID }), "Pricing talk main 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: { reel: 2 }, id: ID }), "Pricing talk reel 2 3fa9c1");
    assert.equal(projectName({ name: "Pricing: what to charge?", part: "main", id: ID }), "Pricing- what to charge- main 3fa9c1");
  });
  it("is a number and the short id for a session's clip, never a name", () => {
    assert.equal(projectName({ clip: 3, id: ID, name: "Jane Doe" }), "Session clip 3 3fa9c1");
  });
  it("has the part \"main 2\", \"main 3\" and on for the main video's later projects, which a correction of the kind makes (4.8), and \"main\" for the first", () => {
    assert.equal(projectName({ name: "Pricing talk", part: "main", number: 2, id: ID }), "Pricing talk main 2 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: "main", number: 3, id: ID }), "Pricing talk main 3 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: "main", number: 12, id: ID }), "Pricing talk main 12 3fa9c1");
    assert.equal(projectName({ name: "Pricing: what to charge?", part: "main", number: 2, id: ID }), "Pricing- what to charge- main 2 3fa9c1");
    // The first project is the one without a number, whether the number is given as 1 or not given.
    assert.equal(projectName({ name: "Pricing talk", part: "main", number: 1, id: ID }), projectName({ name: "Pricing talk", part: "main", id: ID }));
    assert.equal(projectName({ name: "Pricing talk", part: "main", number: 1, id: ID }), "Pricing talk main 3fa9c1");
  });
  it("is different for each number, so that no later project can have the name of an earlier one", () => {
    const names = [1, 2, 3, 4, 10, 11].map((number) => projectName({ name: "Pricing talk", part: "main", number, id: ID }));
    assert.equal(new Set(names).size, names.length);
  });
  it("is numbered for the main video alone, and by a whole number from 1", () => {
    for (const number of [0, -1, 1.5, "2", null, NaN, Infinity, {}]) assert.throws(() => projectName({ name: "Pricing talk", part: "main", number, id: ID }), /projectName/, String(number));
    for (const number of [2, 3]) assert.throws(() => projectName({ name: "Pricing talk", part: { reel: 2 }, number, id: ID }), /projectName/, String(number));
    assert.equal(projectName({ name: "Pricing talk", part: { reel: 2 }, number: 1, id: ID }), "Pricing talk reel 2 3fa9c1");
  });
  it("is that of the project's folder, its meta.json, its package and its facts, for a main project numbered 2", () => {
    const files = projectFiles(main({ number: 2 }));
    const name = "Pricing talk main 2 3fa9c1";
    assert.deepEqual([json(files, "meta.json").id, json(files, "meta.json").name, json(files, "package.json").name, json(files, "brimm/facts.json").name, json(files, "brimm/facts.json").kind], [name, name, name, name, "main"]);
    // The same files as the first project's, and the same set of paths: the name is the only thing that differs.
    const first = projectFiles(main());
    assert.deepEqual([...files.keys()], [...first.keys()]);
    assert.equal(json(first, "meta.json").name, "Pricing talk main 3fa9c1");
  });
});

describe("index.html (5.2, F4)", () => {
  const html = indexHtml(FACTS);
  it("loads no script and no stylesheet from the network", () => {
    assert.deepEqual([...html.matchAll(/\b(?:src|href)="(https?:[^"]*)"/g)].map((m) => m[1]), []);
    assert.match(html, /<script src="vendor\/gsap\.min\.js"><\/script>/);
  });
  it("has the golden's structure", () => {
    assert.deepEqual(new Set(attributes(rootTag(html))), new Set(attributes(rootTag(GOLDEN.index))));
    assert.deepEqual(new Set(attributes(videoTag(html))), new Set(attributes(videoTag(GOLDEN.index))));
    for (const name of ["data-composition-id", "data-start", "data-duration", "data-width", "data-height"]) assert.ok(attributes(rootTag(html)).includes(name), name);
    for (const name of ["class", "data-track-index", "data-has-audio"]) assert.ok(attributes(videoTag(html)).includes(name), name);
    assert.match(videoTag(html), /class="clip"/);
    assert.match(rootTag(html), /data-composition-id="main"/);
    assert.equal(html.match(/window\.__timelines\["main"\] =/g).length, 1);
  });
  it("takes its size and length from the working copy's facts", () => {
    assert.match(rootTag(html), /data-duration="6"[\s\S]*data-width="1920"[\s\S]*data-height="1080"/);
    assert.match(videoTag(html), /src="media\/recording\.mp4"/);
    assert.match(html, /data-resolution="landscape"/);
    const upright = indexHtml({ ...FACTS, width: 1080, height: 1920, seconds: 42.5 });
    assert.match(rootTag(upright), /data-duration="42\.5"[\s\S]*data-width="1080"[\s\S]*data-height="1920"/);
    assert.match(upright, /data-resolution="portrait"/);
    assert.match(upright, /content="width=1080, height=1920"/);
  });
  it("sets the brand's typefaces from the project's own files", () => {
    for (const font of FONTS) assert.ok(html.includes(`url("${font}")`), font);
    assert.match(html, /font-family: "Josefin Sans"/);
  });
});

describe("the project's template files (5.2)", () => {
  const files = projectFiles(main());
  it("hyperframes.json has the golden's keys, and no registry on a moving branch", () => {
    const made = json(files, "hyperframes.json");
    assert.deepEqual(Object.keys(made), Object.keys(GOLDEN.hyperframes).filter((key) => key !== "registry"));
    assert.ok(!files.get("hyperframes.json").includes("raw.githubusercontent.com"));
  });
  it("package.json has dev, check and render and no publish", () => {
    const pkg = json(files, "package.json");
    assert.deepEqual(pkg.scripts, { dev: "hyperframes preview", check: "hyperframes check", render: "hyperframes render" });
    assert.equal(pkg.name, "Pricing talk main 3fa9c1");
    assert.ok(!files.get("package.json").includes("publish"));
  });
  it("meta.json has id, name, createdAt", () => {
    assert.deepEqual(json(files, "meta.json"), { id: "Pricing talk main 3fa9c1", name: "Pricing talk main 3fa9c1", createdAt: "2026-10-28T15:00:00.000Z" });
  });
});

describe("transcript.json (F5)", () => {
  it("is the list the pinned transcribe writes", () => {
    assert.equal(`${JSON.stringify(transcriptJson(WORDS, []), null, 2)}\n`.trim(), GOLDEN.transcript.trim());
  });
  it("spells the company's name BRIMM in every project, whatever the transcriber wrote", () => {
    const heard = [{ w: "the", start: 0, end: 0.2 }, { w: "brim", start: 0.2, end: 0.5 }, { w: "Brim,", start: 0.6, end: 0.9 }, { w: "BRIM.", start: 1, end: 1.3 }, { w: "brim's", start: 1.4, end: 1.8 }, { w: "brimming", start: 1.9, end: 2.4 }];
    assert.deepEqual(transcriptJson(heard, []).map((word) => word.text), ["the", "BRIMM", "BRIMM,", "BRIMM.", "BRIMM's", "brimming"]);
    const files = projectFiles(clip({ words: heard }));
    assert.deepEqual(json(files, "transcript.json").map((word) => word.text).slice(1, 3), ["BRIMM", "BRIMM,"]);
    assert.deepEqual(json(projectFiles(main()), "brimm/spellings.json").spellings.slice(0, 3), [{ wrong: "brim", right: "BRIMM" }, { wrong: "Brim", right: "BRIMM" }, { wrong: "BRIM", right: "BRIMM" }]);
  });
  it("applies the episode's spellings", () => {
    const spelled = transcriptJson(WORDS, [["Hormozy", "Hormozi"]]);
    assert.equal(spelled[2].text, "Hormozi,");
    assert.deepEqual(spelled.map(({ id, start, end }) => [id, start, end]), JSON.parse(GOLDEN.transcript).map(({ id, start, end }) => [id, start, end]));
    assert.equal(json(projectFiles(main()), "transcript.json")[2].text, "Hormozi,");
  });
});

describe("the words as they are said (F5)", () => {
  // The transcriber starts a word where the word before it ended, so a word after a pause starts in the pause. "Next" is said at 2 s.
  const given = [{ w: "Hello,", start: 0, end: 0.4 }, { w: "there.", start: 0.4, end: 0.9 }, { w: "Next", start: 0.9, end: 2.4 }, { w: "word.", start: 2.4, end: 2.9 }];
  const phrases = [{ id: "p1", start: 0, end: 0.9 }, { id: "p2", start: 2, end: 2.9 }];
  const plan = {
    by: "rules",
    phrases: [
      { id: "p1", start: 0, end: 0.9, text: "Hello, there.", words: given.slice(0, 2), keep: true, kind: "keep", why: "" },
      { id: "p2", start: 2, end: 2.9, text: "Next word.", words: given.slice(2), keep: false, kind: "false start", why: "said again" }
    ]
  };
  const starts = (files) => json(files, "transcript.json").map((word) => word.start);
  it("start halfway into the time the transcriber gave them, and on the pause's end where the cut plan's phrases say a pause ends", () => {
    assert.deepEqual(saidWords(given, phrases).map((w) => [w.w, w.start, w.end]), [["Hello,", 0.2, 0.4], ["there.", 0.65, 0.9], ["Next", 2, 2.4], ["word.", 2.65, 2.9]]);
    assert.equal(saidWords(given)[2].start, 1.65, "without the phrases a word is only moved inside its time");
  });
  it("are what a main project's transcript.json holds, and its cut suggestions start where the words do", () => {
    const files = projectFiles(main({ words: given, plan, spellings: [] }));
    assert.deepEqual(json(files, "transcript.json").map(({ id, start, end }) => [id, start, end]), [["w0", 0.2, 0.4], ["w1", 0.65, 0.9], ["w2", 2, 2.4], ["w3", 2.65, 2.9]]);
    const [cut] = json(files, "brimm/cut-suggestions.json").suggestions;
    assert.deepEqual([cut.from, cut.to, cut.start, cut.end], ["w2", "w3", 2, 2.9]);
  });
  it("are placed by the cut plan's phrases in a Reel's project too, as the main project's are, and moved inside their time only in a clip's, which has no plan", () => {
    // (The Reel's stretch here is the first three seconds of the recording, so its clock is the recording's own.) "Next" is said at 2 s.
    assert.deepEqual(starts(projectFiles(main({ words: given, plan, spellings: [] }))), [0.2, 0.65, 2, 2.65]);
    assert.deepEqual(starts(projectFiles(reel({ words: given, plan, stretch: { start: 0, end: 3 } }))), [0.2, 0.65, 2, 2.65]);
    assert.deepEqual(starts(projectFiles(clip({ words: given }))), [0.2, 0.65, 1.65, 2.65]);
  });
  it("are moved inside their time and no more in a Reel's project given no plan, or a plan with no phrases to place them by", () => {
    for (const over of [{ plan: undefined }, { plan: null }, { plan: {} }, { plan: { by: "rules", phrases: "none" } }]) {
      assert.deepEqual(starts(projectFiles(reel({ words: given, stretch: { start: 0, end: 3 }, ...over }))), [0.2, 0.65, 1.65, 2.65], JSON.stringify(over));
    }
  });
  /** What whisper.cpp wrote (-ojf, with -dtw) and ffmpeg printed (silencedetect) for 3 seconds of the A0 test recording: the words as
      an episode keeps them, and the cut plan's phrases, which start on a pause's end. */
  const a0 = () => {
    const told = { transcription: [{ offsets: { from: 119330, to: 122700 }, tokens: [
      { text: " newsletter", offsets: { from: 119330, to: 120060 }, t_dtw: 12038 },
      { text: " section", offsets: { from: 120060, to: 120680 }, t_dtw: 12090 },
      { text: ",", offsets: { from: 120680, to: 120960 }, t_dtw: 12166 },
      { text: " Instagram", offsets: { from: 121430, to: 121690 }, t_dtw: 12208 },
      { text: " captions", offsets: { from: 121690, to: 121980 }, t_dtw: 12260 }
    ] }] };
    const printed = "[silencedetect @ 0x6000] silence_start: 121.07\n[silencedetect @ 0x6000] silence_end: 121.8 | silence_duration: 0.73\n";
    const words = wordsOf(told);
    return { words, plan: { by: "rules", phrases: phrasesOf(words, pausesOf(printed)) } };
  };
  it("start a word after a long pause on the pause's end: \"Instagram\" of the A0 recording, which the app's transcript has at 121.82 s", () => {
    const { words, plan } = a0();
    assert.equal(words[2].start, 120.9, "wordsOf starts \"Instagram\" where \"section,\" ended: in the pause");
    const made = json(projectFiles(main({ words, plan, spellings: [] })), "transcript.json");
    // The app's transcript has "section," at 120.58 and "captions" at 122.34.
    assert.deepEqual(made.map(({ text, start, end }) => [text, start, end]), [["newsletter", 119.855, 120.38], ["section,", 120.64, 120.9], ["Instagram", 121.8, 122.08], ["captions", 122.34, 122.6]]);
  });
  it("start it there in a Reel's project too: the same moment of the recording as in the main project's, less where the Reel starts", () => {
    const { words, plan } = a0();
    const inMain = json(projectFiles(main({ words, plan, spellings: [] })), "transcript.json");
    const round = (seconds) => Math.round(seconds * 1000) / 1000;
    // A Reel that starts before the pause, and one that starts on its end, where "Instagram" begins.
    for (const start of [119.5, 121.8]) {
      const inReel = json(projectFiles(reel({ words, plan, stretch: { start, end: 122.7 }, spellings: [] })), "transcript.json");
      const wanted = inMain.filter((word) => (word.start + word.end) / 2 >= start).map(({ text, start: at, end }) => [text, Math.max(0, round(at - start)), round(end - start)]);
      assert.deepEqual(inReel.map(({ text, start: at, end }) => [text, at, end]), wanted, `a Reel from ${start}`);
      assert.equal(inReel.find((word) => word.text === "Instagram").start, Math.max(0, round(121.8 - start)));
    }
  });
});

describe("a Reel's words and clock (architecture 4.3 and 5.2; plan PR 5)", () => {
  it("are the words whose middle is inside its stretch, on the stretch's own clock: its start taken off the times", () => {
    // "Pricing," is said before the stretch starts at 1.15, and "Later" after it ends at 4.05.
    const said = reelWords([...WORDS, { w: "Later", start: 4.05, end: 4.4 }], STRETCH);
    assert.deepEqual(said.map(({ w, start, end }) => [w, start, end]), [["says", 0.05, 0.45], ["Hormozy,", 0.55, 1.35], ["is", 1.55, 1.75], ["a", 1.85, 1.95], ["skill.", 2.05, 2.85]]);
  });
  it("start a word that began before the stretch at its first moment, and give no word for words that are not given", () => {
    assert.deepEqual(reelWords([{ w: "Okay,", start: 1, end: 1.5 }], STRETCH), [{ w: "Okay,", start: 0, end: 0.35 }]);
    for (const words of [null, undefined, {}, "words"]) assert.deepEqual(reelWords(words, STRETCH), []);
  });
  it("keep a word whose end is a little past the stretch's end when its middle is inside it: where two phrases touch, the word across their edge is the last of the first", () => {
    // The last word of a stretch that ends at 55.466 ends at 55.481 (the transcriber's end and the phrase's end differ by 15 ms).
    const said = reelWords([{ w: "so", start: 54.4, end: 54.7 }, { w: "far.", start: 54.9, end: 55.481 }], { start: 54, end: 55.466 });
    assert.deepEqual(said.map(({ w, start, end }) => [w, start, end]), [["so", 0.4, 0.7], ["far.", 0.9, 1.466]]);
  });
  it("leave out a word that only touches an edge of the stretch: the end of the one before it, or the start of the one after", () => {
    const said = reelWords([{ w: "Before.", start: 0.9, end: 1.16 }, { w: "In.", start: 2, end: 2.4 }, { w: "After", start: 4.04, end: 4.5 }], STRETCH);
    assert.deepEqual(said.map(({ w, start, end }) => [w, start, end]), [["In.", 0.85, 1.25]]);
  });
  it("keep the last word of a Reel in transcript.json where the stretch ends a little before the word does", () => {
    const words = [{ w: "Hello,", start: 1.2, end: 1.6 }, { w: "world.", start: 1.6, end: 2.1 }];
    const made = json(projectFiles(reel({ words, plan: undefined, stretch: { start: 1.15, end: 2.085 }, spellings: [] })), "transcript.json");
    assert.deepEqual(made.map(({ text, start, end }) => [text, start, end]), [["Hello,", 0.25, 0.45], ["world.", 0.7, 0.935]]);
  });
  it("are what transcript.json of a Reel's project holds: ids from w0, the spellings applied, each start moved halfway into its time", () => {
    const made = json(projectFiles(reel()), "transcript.json");
    assert.deepEqual(made.map(({ id, text, start, end }) => [id, text, start, end]), [
      ["w0", "says", 0.25, 0.45], ["w1", "Hormozi,", 0.95, 1.35], ["w2", "is", 1.65, 1.75], ["w3", "a", 1.9, 1.95], ["w4", "skill.", 2.45, 2.85]
    ]);
  });
  it("say in brimm/facts.json where the Reel starts in the recording, and a main project or a clip says nothing of one", () => {
    assert.deepEqual(json(projectFiles(reel()), "brimm/facts.json").reel, { n: 2, offset: 1.15 });
    for (const files of [projectFiles(main()), projectFiles(clip())]) assert.equal("reel" in json(files, "brimm/facts.json"), false);
  });
  it("tell the agent in the notes where the Reel's clock starts, what its video is, and that Studio made it upright", () => {
    const notes = projectFiles(reel({ stretch: { start: 312.4, end: 340 } })).get("CLAUDE.md");
    assert.ok(notes.includes("- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/recording.mp4`, which starts at 5:12 (312.4 seconds) into the episode's recording: this Reel is that stretch of it, and nothing was cut from the stretch."), notes);
    assert.ok(notes.includes("`media/recording.mp4`: the Reel's stretch of the recording, made ready for HyperFrames and not cut inside it."), notes);
    assert.match(notes, /Studio made it upright, 1080 by 1920/);
    // A main project's and a clip's lines are as they were.
    for (const files of [projectFiles(main()), projectFiles(clip())]) {
      const own = files.get("CLAUDE.md");
      assert.ok(own.includes("is on the clock of `media/recording.mp4`, which is the recording's own: nothing was cut from it."), own);
      assert.ok(own.includes("`media/recording.mp4`: the video: the recording, made ready for HyperFrames and not cut."), own);
      assert.doesNotMatch(own, /This Reel|Studio made it upright|which starts at/);
    }
  });
  it("name an offset an hour in as an hour, as the lists of Reels do", () => {
    assert.match(projectFiles(reel({ stretch: { start: 3725.5, end: 3800 } })).get("CLAUDE.md"), /which starts at 1:02:06 \(3725\.5 seconds\) into the episode's recording/);
  });
  it("are refused, with the Reel's project, when its stretch is not one: missing, empty, backwards or not times", () => {
    for (const stretch of [undefined, null, {}, { start: 5, end: 5 }, { start: 6, end: 5 }, { start: -1, end: 4 }, { start: 1, end: "x" }, { start: NaN, end: 4 }]) {
      assert.throws(() => projectFiles(reel({ stretch })), /stretch/, JSON.stringify(stretch));
    }
    // A main project and a clip have no stretch, and are not asked for one.
    assert.doesNotThrow(() => projectFiles(main()));
    assert.doesNotThrow(() => projectFiles(clip()));
  });
});

describe("the face track (architecture 4.3; plan PR 5)", () => {
  const BOX = { x: 0.41, y: 0.22, w: 0.18, h: 0.3 };
  /** What the face finder printed of three stills, one every two seconds of the Reel: none, one face, and two. */
  const FACES = { every: 2, stills: [{ file: "0001.jpg", faces: [] }, { file: "0002.jpg", faces: [BOX] }, { file: "0003.jpg", faces: [BOX, { x: 0.7, y: 0.3, w: 0.1, h: 0.15 }] }] };
  it("is the faces found in each still, at the still's time on the Reel's own clock: its number times how far apart they are", () => {
    const made = json(projectFiles(reel({ faces: FACES })), "brimm/face-track.json");
    assert.deepEqual(made.stills, [{ at: 2, faces: [] }, { at: 4, faces: [BOX] }, { at: 6, faces: [BOX, { x: 0.7, y: 0.3, w: 0.1, h: 0.15 }] }]);
    assert.deepEqual([made.version, made.clock, made.every], [1, "reel", 2]);
    // It says how to read a box.
    assert.match(made.about, /fractions of the picture, from its top left corner/);
    assert.deepEqual(faceTrack(FACES), made);
  });
  it("is written only when some still holds a face: none looked for, none found, or a finder that printed nothing it can be read by", () => {
    for (const faces of [undefined, null, { every: 2, stills: [] }, { every: 2, stills: [{ file: "0001.jpg", faces: [] }] }, { every: 2 }, { stills: [{ file: "0001.jpg", faces: [BOX] }] }, "faces"]) {
      assert.equal(faceTrack(faces), null, JSON.stringify(faces));
      assert.ok(!projectFiles(reel({ faces })).has("brimm/face-track.json"), JSON.stringify(faces));
    }
  });
  it("leaves out a still whose name has no number, and keeps the others at their own times", () => {
    const made = faceTrack({ every: 2, stills: [{ file: "cover.jpg", faces: [BOX] }, { file: "0004.jpg", faces: [BOX] }] });
    assert.deepEqual(made.stills, [{ at: 8, faces: [BOX] }]);
  });
  it("is a Reel's alone: a main project and a clip given faces have none", () => {
    assert.ok(!projectFiles(main({ faces: FACES })).has("brimm/face-track.json"));
    assert.ok(!projectFiles(clip({ faces: FACES })).has("brimm/face-track.json"));
  });
  it("is in the notes' list of the project's files, with what it is for, when it is there and not otherwise", () => {
    assert.ok(projectFiles(reel({ faces: FACES })).get("CLAUDE.md").includes("`brimm/face-track.json`: where the faces are in this Reel, for the upright crop."));
    assert.ok(!projectFiles(reel()).get("CLAUDE.md").includes("face-track.json: where"));
    assert.ok(json(projectFiles(reel({ faces: FACES })), "brimm/facts.json").files["brimm/face-track.json"]);
    assert.ok(!("brimm/face-track.json" in json(projectFiles(reel()), "brimm/facts.json").files));
  });
});

describe("a Reel's page: upright, 1080 by 1920, and cropped on the speaker (Jason, 2 November; architecture 4.3)", () => {
  // A face is made of halves and eighths, which a computer keeps exactly: `centre` is how far across the picture its middle is.
  const box = (centre) => ({ x: centre - 0.0625, y: 0.2, w: 0.125, h: 0.25 });
  /** What the face finder printed of a Reel's video, a still every 2 seconds: for each still, the middles of the faces in it. */
  const seen = (...stills) => ({ every: 2, stills: stills.map((centres, i) => ({ file: `${String(i + 1).padStart(4, "0")}.jpg`, faces: centres.map(box) })) });
  const pageOf = (over) => projectFiles(reel(over)).get("index.html");
  /** The `object-position` the page gives the video, as it is written: "13.43% 50%". */
  const positionOf = (html) => videoTag(html).match(/object-position: ([^;"]+)/)?.[1] ?? null;
  const sha = (text) => createHash("sha256").update(text).digest("hex");

  it("is 1080 by 1920 and portrait whatever the working copy's shape: the root, the viewport and the body", () => {
    for (const facts of [FACTS, { ...FACTS, width: 1280, height: 720 }, { ...FACTS, width: 1080, height: 1080 }, { ...FACTS, width: 1080, height: 1920 }]) {
      const html = pageOf({ facts, faces: seen([0.25]) });
      const shown = JSON.stringify(facts);
      assert.match(rootTag(html), /data-duration="6"[\s\S]*data-width="1080"[\s\S]*data-height="1920"/, shown);
      assert.match(html, /<html lang="en" data-resolution="portrait">/, shown);
      assert.match(html, /content="width=1080, height=1920"/, shown);
      assert.ok(html.includes("        width: 1080px;\n        height: 1920px;\n"), shown);
      assert.doesNotMatch(html, /data-width="1920"|data-resolution="landscape"|height: 1080px/, shown);
    }
  });
  it("keeps the working copy's video filling the frame, as the main project's does, and places it by object-position", () => {
    const html = pageOf({ faces: seen([0.25]) });
    assert.match(videoTag(html), /src="media\/recording\.mp4"/);
    assert.match(videoTag(html), /style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 13\.43% 50%"/);
    // The same attributes as the main project's video, and nothing else: only its style says where the picture is placed.
    assert.deepEqual(attributes(videoTag(html)), attributes(videoTag(projectFiles(main()).get("index.html"))));
    assert.deepEqual(attributes(rootTag(html)), attributes(rootTag(projectFiles(main()).get("index.html"))));
    assert.equal(html.match(/window\.__timelines\["main"\] =/g).length, 1);
    // The video has sound unless the working copy has none, as before.
    assert.match(videoTag(html), /data-has-audio="true"/);
    assert.match(videoTag(pageOf({ facts: { ...FACTS, audio: false } })), /data-has-audio="false"/);
  });

  it("puts the speaker in the middle of the frame: a face a quarter of the way across the picture is at 13.43%, three quarters of the way across at 86.57%, in the middle at 50%", () => {
    assert.equal(positionOf(pageOf({ faces: seen([0.25]) })), "13.43% 50%");
    assert.equal(positionOf(pageOf({ faces: seen([0.75]) })), "86.57% 50%");
    assert.equal(positionOf(pageOf({ faces: seen([0.5]) })), "50% 50%");
  });
  it("stops at the picture's own edges, 0% and 100%, for a speaker too near a side to be put in the middle", () => {
    assert.equal(positionOf(pageOf({ faces: seen([0.0625]) })), "0% 50%");
    assert.equal(positionOf(pageOf({ faces: seen([0.9375]) })), "100% 50%");
  });
  it("takes the largest face in a still for the speaker, and goes by the middle one of the stills, skipping the stills with nobody in them", () => {
    // The face at the right covers more of the picture, though it is not the one found first.
    const larger = { every: 2, stills: [{ file: "0001.jpg", faces: [box(0.25), { x: 0.625, y: 0.2, w: 0.25, h: 0.5 }] }] };
    assert.equal(positionOf(pageOf({ faces: larger })), "86.57% 50%");
    // Three stills with a face: the middle one of 0.25, 0.875 and 0.375 is 0.375. A still with nobody in it is not counted.
    assert.equal(positionOf(pageOf({ faces: seen([0.25], [], [0.875], [], [0.375]) })), "31.71% 50%");
    // Two stills: the lower of the two, a place a face was and not the gap between them.
    assert.equal(positionOf(pageOf({ faces: seen([0.75], [0.25]) })), "13.43% 50%");
  });
  it("is the middle, 50%, when there are no faces to go by: none looked for, none found, or what the finder printed cannot be read", () => {
    for (const faces of [undefined, null, seen(), seen([]), seen([], [], []), { every: 2 }, { stills: seen([0.25]).stills }, "faces"]) {
      assert.equal(positionOf(pageOf({ faces })), "50% 50%", JSON.stringify(faces));
      assert.match(rootTag(pageOf({ faces })), /data-width="1080"[\s\S]*data-height="1920"/);
    }
  });
  it("is 50% for a working copy that is upright already, wherever the speaker is: there is nothing to crop across", () => {
    for (const facts of [{ ...FACTS, width: 1080, height: 1920 }, { ...FACTS, width: 720, height: 1280 }, { ...FACTS, width: 1080, height: 2400 }]) {
      assert.equal(positionOf(pageOf({ facts, faces: seen([0.25]) })), "50% 50%", JSON.stringify(facts));
    }
  });
  it("goes by the working copy's shape, not its size: a 16:9 picture of any size is placed alike, and a square one is cropped across too", () => {
    const [small, large] = [{ ...FACTS, width: 1280, height: 720 }, { ...FACTS, width: 3840, height: 2160 }].map((facts) => positionOf(pageOf({ facts, faces: seen([0.25]) })));
    assert.deepEqual([small, large], ["13.43% 50%", "13.43% 50%"]);
    assert.equal(positionOf(pageOf({ facts: { ...FACTS, width: 1080, height: 1080 }, faces: seen([0.375]) })), "21.43% 50%");
  });

  it("is a Reel's alone: a main project's page and a clip's are the working copy's own shape, with no object-position, whatever faces they are given", () => {
    for (const files of [projectFiles(main()), projectFiles(main({ faces: seen([0.25]) })), projectFiles(clip()), projectFiles(clip({ faces: seen([0.25]) }))]) {
      const html = files.get("index.html");
      assert.match(rootTag(html), /data-width="1920"[\s\S]*data-height="1080"/);
      assert.match(html, /data-resolution="landscape"/);
      assert.doesNotMatch(html, /object-position/);
    }
  });
  it("leaves a main project's page and a clip's as they were, byte for byte: each page's hash is that of the page before the Reel's was made upright", () => {
    // Made by main's code at f931c7b (30 October), before the Reel's page was made upright, for the working copy's facts of each page.
    const WIDE_PAGE = "a1c09d62d221da061fed60f5fe708fb4e8325daab51d0ade1e678ff05acf2c2e";
    assert.equal(sha(indexHtml(FACTS)), WIDE_PAGE);
    assert.equal(sha(projectFiles(main()).get("index.html")), WIDE_PAGE);
    assert.equal(sha(projectFiles(main({ short: true })).get("index.html")), WIDE_PAGE);
    assert.equal(sha(projectFiles(clip()).get("index.html")), WIDE_PAGE);
    assert.equal(sha(indexHtml({ ...FACTS, width: 1080, height: 1920, seconds: 42.5 })), "a4502cf4227f92e94d4a2aa029158a79398d8c505e38c62b3ffbb8c8f78dde2f");
    assert.equal(sha(indexHtml({ ...FACTS, width: 1280, height: 720, seconds: 1.45, audio: false })), "072c6c8a348588518a5ed1a892c463efd2d029632b92b5592da6dee129c4f1b2");
    assert.equal(sha(indexHtml({ ...FACTS, width: 1080, height: 1080, seconds: 10 })), "dafd4e7e239566253325e61bf3ba4207cd2b0b499189cf51fe09ba6dc798d050");
    assert.equal(projectFiles(main({ facts: { ...FACTS, width: 1080, height: 1920 } })).get("index.html"), indexHtml({ ...FACTS, width: 1080, height: 1920 }));
  });
  it("is refused for a working copy whose facts say no size or length, as any page is", () => {
    for (const facts of [undefined, {}, { seconds: 6 }, { ...FACTS, width: 0 }, { ...FACTS, seconds: 0 }]) assert.throws(() => projectFiles(reel({ facts })), /indexHtml/, JSON.stringify(facts));
  });

  it("leaves the working copy's own size in brimm/facts.json, since it is the video's and a video put back is held to it", () => {
    const facts = json(projectFiles(reel({ facts: { ...FACTS, width: 1280, height: 720 }, faces: seen([0.25]) })), "brimm/facts.json");
    assert.deepEqual([facts.width, facts.height, facts.seconds, facts.fps], [1280, 720, 6, 30]);
  });
  it("is read as the wide page was: no words on the picture, and the recording placed at the start for the length of the working copy", () => {
    const html = pageOf({ faces: seen([0.25]) });
    assert.deepEqual(wordsOnScreen((rel) => (rel === "index.html" ? html : null)), []);
    assert.deepEqual(recordingPlacements(html), [{ start: 0, duration: 6, mediaStart: 0, rate: 1 }]);
    assert.deepEqual(recordingPlacements(html), recordingPlacements(projectFiles(main()).get("index.html")));
  });

  describe("the Reel's notes say what Studio did to its page, and what stays", () => {
    const rulesOf = (files) => {
      const notes = files.get("CLAUDE.md");
      return notes.slice(notes.indexOf("# The BRIMM: rules for this project"), notes.indexOf("\n# ", notes.indexOf("# The BRIMM: rules for this project") + 1));
    };
    const lineOf = (over) => rulesOf(projectFiles(reel(over))).split("\n").find((line) => line.startsWith("- **This Reel.**"));
    /** The bold label that starts each rule, in the order they stand. */
    const labels = (rules) => rules.split("\n").filter((line) => line.startsWith("- **")).map((line) => line.match(/^- \*\*([^*]+)\*\*/)[1]);
    const SIDES = "(0% shows the picture's left edge, 100% its right)";
    const STAYS = "Keep it upright, 1080 by 1920: it is exported and handed off at that size. `brimm/face-track.json`, when it is there, says where the faces are, to move the crop by or to follow the speaker with.";

    it("say that Studio made it upright and cropped it on the speaker, with the place it chose and where the speaker was found, that it stays upright for the hand-off, and what the face track is for", () => {
      assert.equal(lineOf({ faces: seen([0.25]) }), `- **This Reel.** Studio made it upright, 1080 by 1920, and cropped it on the speaker: \`#a-roll\` fills the frame (\`object-fit: cover\`) and \`object-position: 13.43% 50%\` puts the speaker, found 25% of the way across the picture, in the middle ${SIDES}. ${STAYS}`);
      assert.equal(lineOf({ faces: seen([0.75]) }), `- **This Reel.** Studio made it upright, 1080 by 1920, and cropped it on the speaker: \`#a-roll\` fills the frame (\`object-fit: cover\`) and \`object-position: 86.57% 50%\` puts the speaker, found 75% of the way across the picture, in the middle ${SIDES}. ${STAYS}`);
    });
    it("say, when no face was found, that it is cropped on the middle of the picture for that reason", () => {
      for (const faces of [undefined, seen([])]) {
        assert.equal(lineOf({ faces }), `- **This Reel.** Studio made it upright, 1080 by 1920, and cropped it on the middle of the picture, as it found no face to crop on: \`#a-roll\` fills the frame (\`object-fit: cover\`) and \`object-position: 50% 50%\` shows the middle ${SIDES}. ${STAYS}`);
      }
    });
    it("say, when the video is upright already, that nothing is cropped across", () => {
      assert.equal(lineOf({ facts: { ...FACTS, width: 1080, height: 1920 }, faces: seen([0.25]) }), `- **This Reel.** Studio made it upright, 1080 by 1920. Its picture is upright already, so nothing is cropped across: \`#a-roll\` fills the frame (\`object-fit: cover\`, \`object-position: 50% 50%\`). ${STAYS}`);
    });
    it("no longer tell the agent to make the composition upright and crop it itself", () => {
      for (const faces of [undefined, seen([0.25])]) {
        const notes = projectFiles(reel({ faces })).get("CLAUDE.md");
        assert.doesNotMatch(notes, /if its picture is wide|make the composition upright|crop it on the speaker\. `brimm|It is exported upright/);
      }
    });
    it("keep the rest of the Reel's rules, in their order, and the graphic cues' after Cutting in a main project's and in a Reel's, and a clip's rules as they were", () => {
      const reelLabels = ["A draft only.", "On this Mac only.", "Sharing.", "AI-generated people.", "Commands never run here.", "The words.", "Cutting.", "Graphic cues.", "Reels.", "This Reel.", "Spellings.", "The brand.", "Captions.", "Versions.", "When she is done."];
      assert.deepEqual(labels(rulesOf(projectFiles(reel({ faces: seen([0.25]) })))), reelLabels);
      // The rule for graphic cues stands right after Cutting, in a main project's and in a Reel's, and a clip has none.
      const mainLabels = ["A draft only.", "On this Mac only.", "Sharing.", "AI-generated people.", "Commands never run here.", "The words.", "Cutting.", "Graphic cues.", "Reels.", "Spellings.", "The brand.", "Captions.", "Versions.", "When she is done."];
      assert.deepEqual(labels(rulesOf(projectFiles(main()))), mainLabels);
      assert.deepEqual(labels(rulesOf(projectFiles(main({ short: true })))), mainLabels.map((label) => (label === "Reels." ? "No new projects." : label)));
      // A session clip has no Reels, no spellings and no graphic cues, and keeps its old rule about generated people, under its old label.
      assert.deepEqual(labels(rulesOf(projectFiles(clip()))), ["A draft only.", "On this Mac only.", "Sharing.", "No generated people.", "Commands never run here.", "The words.", "Cutting.", "The brand.", "Captions.", "Versions.", "When she is done."]);
      // The rule that a Reel is made by Studio only, the captions' clear areas and the way out are the lines they were.
      const rules = rulesOf(projectFiles(reel({ faces: seen([0.25]) })));
      assert.match(rules, /\*\*Reels\.\*\* Never make a Reel as a new project yourself/);
      assert.match(rules, /Reels have captions, with the top 14% and the bottom 35% of an upright frame kept clear\./);
      assert.match(rules, /- \*\*When she is done\.\*\* Export on This Mac\. Then she says "hand it off" in her Claude chat\./);
    });
    it("are the same text in CLAUDE.md and AGENTS.md, and name the object-position the page has", () => {
      const files = projectFiles(reel({ faces: seen([0.25]) }));
      assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
      assert.equal(positionOf(files.get("index.html")), "13.43% 50%");
      assert.ok(files.get("CLAUDE.md").includes("`object-position: 13.43% 50%`"));
    });
  });

  describe("reelCrop: how a Reel's page is cropped", () => {
    it("is the speaker's place across the picture, whether a face was found, the object-position that puts it in the middle, and whether the picture is cropped across at all", () => {
      assert.deepEqual(reelCrop(FACTS, faceTrack(seen([0.25]))), { at: 0.25, found: true, position: 13.43, across: true });
      assert.deepEqual(reelCrop(FACTS, faceTrack(seen([0.75]))), { at: 0.75, found: true, position: 86.57, across: true });
    });
    it("is the middle of the picture, and says no face was found, when the face track is none", () => {
      assert.deepEqual(reelCrop(FACTS, null), { at: 0.5, found: false, position: 50, across: true });
      assert.deepEqual(reelCrop(FACTS, undefined), { at: 0.5, found: false, position: 50, across: true });
    });
    it("is not across for a picture that is upright already, though its speaker is found", () => {
      assert.deepEqual(reelCrop({ ...FACTS, width: 1080, height: 1920 }, faceTrack(seen([0.25]))), { at: 0.25, found: true, position: 50, across: false });
    });
  });
});

describe("the ruling: a Reel is made by Studio only (Jason, 2026-10-28; plan PR 5)", () => {
  const rulesOf = (files) => {
    const notes = files.get("CLAUDE.md");
    return notes.slice(notes.indexOf("# The BRIMM: rules for this project"), notes.indexOf("\n# ", notes.indexOf("# The BRIMM: rules for this project") + 1));
  };
  /** The one line a short video's main project has in place of the Reels': the same rule a session clip has (no Reel and no new
      project from it), for the reason that a short video has no Reels to ask for. */
  const SHORT_LINE = "- **No new projects.** Never make a Reel or any other new project from this video: a new project holds a second copy of the recording outside Studio's care, and a short video has no Reels. Say a short video has no Reels.";
  it("is in the BRIMM rules of a main project and of a Reel's: never make a Reel as a new project, and say \"Open Reel 2 in HyperFrames\" in her Claude chat", () => {
    for (const files of [projectFiles(main()), projectFiles(reel())]) {
      const rules = rulesOf(files);
      assert.match(rules, /Never make a Reel as a new project yourself/);
      assert.match(rules, /tell her to say "Open Reel 2 in HyperFrames" in her Claude chat, with the number of the Reel she wants/);
      assert.match(rules, /outside BRIMM Video Work with a second copy of the whole recording/);
      assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
    }
    // The main project's line about the Reels Studio suggests stays, with the rule after it.
    assert.match(rulesOf(projectFiles(main())), /\*\*Reels\.\*\* The Reels Studio suggests are in `brimm\/reel-suggestions\.json`, by their word ids\. Never make a Reel as a new project yourself/);
  });
  it("has one line of its own in the rules of a short video's main project, where the Reels' line is: no Reel and no new project from it, since a short video has no Reels", () => {
    const short = projectFiles(main({ short: true, reels: undefined, plan: undefined }));
    // The Reels' line is out, both halves of it: "Open Reel 2 in HyperFrames" would be answered that a short video has none, and the
    // rules do not send the agent to suggestions it has none of. (The file list of the notes is as it was: the project still holds
    // brimm/reel-suggestions.json, an empty list.)
    for (const notes of [short.get("CLAUDE.md"), short.get("AGENTS.md")]) {
      assert.doesNotMatch(notes, /Open Reel \d in HyperFrames|Never make a Reel as a new project|\*\*Reels\.\*\*/);
      // But the rule that matters most there stays, in the voice of a session clip's: asked for a Reel, the app's agent would make a
      // project of its own, outside Studio's reach.
      assert.ok(notes.includes(SHORT_LINE), notes);
    }
    assert.doesNotMatch(rulesOf(short), /reel-suggestions|Reels Studio suggests/);
    // It stands where the Reels' line does, and the rest of the rules are the main project's own.
    const whole = rulesOf(projectFiles(main({ reels: undefined, plan: undefined })));
    assert.equal(whole.split("\n").map((line) => (line.startsWith("- **Reels.**") ? SHORT_LINE : line)).join("\n"), rulesOf(short));
    assert.equal(rulesOf(short).split("\n").filter((line) => line.startsWith("- **No new projects.**")).length, 1);
    // Only the main project's: a Reel's project is a Reel, and a flag a Reel or a clip is given changes nothing.
    assert.match(rulesOf(projectFiles(reel({ short: true }))), /Never make a Reel as a new project yourself/);
    assert.doesNotMatch(rulesOf(projectFiles(reel({ short: true }))), /No new projects/);
    assert.equal(projectFiles(clip({ short: true })).get("CLAUDE.md"), projectFiles(clip()).get("CLAUDE.md"));
    // A main project that is not told it is a short video's keeps the rule, and has no line of the short video's.
    for (const over of [{}, { short: false }, { short: undefined }, { short: "yes" }]) {
      assert.match(rulesOf(projectFiles(main(over))), /Open Reel 2 in HyperFrames/, JSON.stringify(over));
      assert.doesNotMatch(rulesOf(projectFiles(main(over))), /No new projects/, JSON.stringify(over));
    }
  });
  it("is in a session clip's own rules, above the BRIMM rules: no new projects, a Reel or any other, from a clip of a private client session", () => {
    const own = projectFiles(clip()).get("CLAUDE.md");
    const first = own.slice(0, own.indexOf("# The BRIMM: rules for this project"));
    assert.match(first, /\*\*No new projects\.\*\* Never make a Reel or any other new project from this clip/);
    assert.match(first, /second copy of the clip outside Studio's care/);
    // The clip has no Reels to ask for, so it is not told to say a phrase about one.
    assert.doesNotMatch(own, /Open Reel \d in HyperFrames/);
  });
});

describe("what the app is given to start from (5.8)", () => {
  const transcript = transcriptJson(WORDS, []);
  const ids = new Set(transcript.map((word) => word.id));
  const byId = new Map(transcript.map((word) => [word.id, word]));
  it("brimm/cut-suggestions.json uses the transcript's ids", () => {
    const made = cutSuggestions(PLAN, transcript);
    assert.deepEqual(made, { version: 1, clock: "recording", suggestions: [{ n: 1, from: "w0", to: "w0", start: 0.5, end: 1.1, kind: "retake", why: "said again at 0:01, better", by: "rules" }] });
    for (const s of made.suggestions) {
      assert.ok(ids.has(s.from) && ids.has(s.to));
      assert.equal(s.start, byId.get(s.from).start);
      assert.equal(s.end, byId.get(s.to).end);
    }
    assert.deepEqual(json(projectFiles(main()), "brimm/cut-suggestions.json").suggestions.map((s) => [s.from, s.to]), [["w0", "w0"]]);
  });
  it("gives each word of a cut its own id, by its place, even when two words share their times", () => {
    const words = [{ w: "So", start: 1, end: 1.5 }, { w: "uh,", start: 1.5, end: 1.5 }, { w: "um,", start: 1.5, end: 1.5 }, { w: "pricing.", start: 1.5, end: 2 }];
    const plan = {
      by: "claude",
      phrases: [
        { id: "p1", start: 0.9, end: 1.5, text: "So", words: words.slice(0, 1), keep: true, kind: "keep", why: "" },
        { id: "p2", start: 1.5, end: 1.5, text: "uh, um,", words: words.slice(1, 3), keep: false, kind: "false start", why: "said before the words" },
        { id: "p3", start: 1.5, end: 2.1, text: "pricing.", words: words.slice(3), keep: true, kind: "keep", why: "" }
      ]
    };
    assert.deepEqual(cutSuggestions(plan, transcriptJson(words, [])).suggestions.map((s) => [s.from, s.to, s.by]), [["w1", "w2", "claude"]]);
  });
  it("reads a cut plan back from its file the same", () => {
    assert.deepEqual(cutSuggestions(JSON.parse(JSON.stringify(PLAN)), transcript), cutSuggestions(PLAN, transcript));
  });
  it("refuses a cut plan whose words are not the transcript's", () => {
    assert.throws(() => cutSuggestions(PLAN, transcriptJson(WORDS.slice(1), [])), /words/);
  });
  it("brimm/reel-suggestions.json has stretches, ids, title, first and last words, and why", () => {
    assert.deepEqual(reelSuggestions(REELS, transcript), {
      version: 1, clock: "recording",
      reels: [{ n: 2, title: "Pricing is a skill", why: "a point made in one breath", first: "says", last: "skill.", stretches: [{ start: 1.15, end: 4.05, from: "w1", to: "w5" }] }]
    });
    assert.ok(projectFiles(main()).has("brimm/reel-suggestions.json"));
    assert.ok(!projectFiles(reel()).has("brimm/reel-suggestions.json"));
    assert.ok(!projectFiles(clip()).has("brimm/reel-suggestions.json"));
  });

  describe("brimm/graphic-cues.json (PR H1)", () => {
    const CUE = { n: 1, words: "says Hormozy", kind: "words", show: "The name on screen.", seconds: 3, style: null, phrase: "p2" };
    const cuesOf = (files) => json(files, "brimm/graphic-cues.json");
    /** The made-up recording where "too many SKUs" is said twice, the first time in a retake the plan cuts, with the plan's phrases. */
    const SKUS = (() => {
      const words = ["so", "we", "have", "too", "many", "SKUs", "here", "uh", "too", "many", "SKUs", "there", "today"].map((w, i) => ({ w, start: i, end: i + 0.8 }));
      return {
        words,
        plan: {
          by: "rules",
          phrases: [
            { id: "p1", start: 0, end: 2.8, text: "so we have", words: words.slice(0, 3), keep: true, kind: "keep", why: "" },
            { id: "p2", start: 3, end: 7.8, text: "too many SKUs here uh", words: words.slice(3, 8), keep: false, kind: "retake", why: "said again at 0:08, the later one is kept" },
            { id: "p3", start: 8, end: 12.8, text: "too many SKUs there today", words: words.slice(8), keep: true, kind: "keep", why: "" }
          ]
        }
      };
    })();
    it("has each cue placed on the transcript's own words, by their ids, with their times, and the recording's clock", () => {
      const files = projectFiles(main({ graphicCues: [CUE] }));
      const transcript = json(files, "transcript.json");
      // "says Hormozy" is spelled as the transcript spells it, "says Hormozi", and found there: the second and third words.
      assert.deepEqual(transcript.slice(1, 3).map((w) => [w.id, w.text]), [["w1", "says"], ["w2", "Hormozi,"]]);
      assert.deepEqual(cuesOf(files), { version: 1, clock: "recording", cues: [{ ...CUE, at: { from: "w1", to: "w2", start: transcript[1].start, end: transcript[2].end } }] });
      assert.deepEqual(Object.keys(cuesOf(files)), ["version", "clock", "cues"]);
      const ids = new Set(transcript.map((w) => w.id));
      assert.ok(cuesOf(files).cues.every((c) => ids.has(c.at.from) && ids.has(c.at.to)));
      assert.ok(files.get("brimm/graphic-cues.json").endsWith("}\n"));
    });
    it("has the same file as the placing rule makes of the cues, written as the other files of brimm/ are", () => {
      const files = projectFiles(main({ graphicCues: [CUE] }));
      assert.equal(files.get("brimm/graphic-cues.json"), `${JSON.stringify(cuesOf(files), null, 2)}\n`);
    });
    it("has a cue whose words are not found with no place, and still places the cues after it", () => {
      const lost = { ...CUE, n: 1, words: "the moon landing", phrase: "p2" };
      const found = { ...CUE, n: 2, words: "a skill", phrase: "p2" };
      const cues = cuesOf(projectFiles(main({ graphicCues: [lost, found] }))).cues;
      assert.deepEqual(cues.map((c) => [c.n, c.at && [c.at.from, c.at.to]]), [[1, null], [2, ["w4", "w5"]]]);
    });
    it("is empty of cues for a main project given none", () => {
      for (const given of [undefined, [], "none", null]) assert.deepEqual(cuesOf(projectFiles(main({ graphicCues: given }))), { version: 1, clock: "recording", cues: [] }, String(given));
      for (const given of [undefined, [], "none", null]) assert.deepEqual(cuesOf(projectFiles(main({ short: true, graphicCues: given }))), { version: 1, clock: "recording", cues: [] }, `a short video's, ${String(given)}`);
    });
    it("has a short video's cues placed as any main video's are, now that its reading gives it some (PR H2)", () => {
      const clip = cuesOf(projectFiles(main({ short: true, graphicCues: [CUE] })));
      assert.deepEqual(clip, cuesOf(projectFiles(main({ graphicCues: [CUE] }))));
      assert.deepEqual(clip.cues.map((c) => [c.n, c.at.from, c.at.to]), [[1, "w1", "w2"]]);
      assert.equal(clip.clock, "recording");
    });
    it("spells the words of a cue as the transcript's are spelled: the company's name first, then the episode's spellings, so the cue finds its words", () => {
      const words = [{ w: "learn", start: 0, end: 0.5 }, { w: "the", start: 0.5, end: 0.7 }, { w: "brim", start: 0.7, end: 1.1 }, { w: "method,", start: 1.1, end: 1.6 }, { w: "Hormozy", start: 1.7, end: 2.4 }];
      const plan = { by: "rules", phrases: [{ id: "p1", start: 0, end: 2.4, text: "learn the brim method, Hormozy", words, keep: true, kind: "keep", why: "" }] };
      const cue = (n, said) => ({ n, words: said, kind: "words", show: "A card.", seconds: 3, style: null, phrase: "p1" });
      const files = projectFiles(main({ words, plan, graphicCues: [cue(1, "brim method"), cue(2, "The BRIMM method"), cue(3, "method Hormozy")] }));
      assert.deepEqual(json(files, "transcript.json").map((w) => w.text), ["learn", "the", "BRIMM", "method,", "Hormozi"]);
      // Two of the three are of two tokens, which need both: they are found only because "brim" is spelled "BRIMM" like the transcript.
      assert.deepEqual(cuesOf(files).cues.map((c) => [c.at.from, c.at.to]), [["w2", "w3"], ["w1", "w3"], ["w3", "w4"]]);
    });
    it("lands a cue on the take that is kept when its words are said twice in a retake the plan cuts, whether it names the kept take's phrase, a phrase the plan has not, or none", () => {
      const cue = (phrase) => ({ n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, ...(phrase ? { phrase } : {}) });
      for (const phrase of ["p3", "p9", undefined]) {
        const [placed] = cuesOf(projectFiles(main({ words: SKUS.words, plan: SKUS.plan, graphicCues: [cue(phrase)] }))).cues;
        assert.deepEqual([placed.at.from, placed.at.to], ["w8", "w10"], String(phrase));
      }
    });
    it("lands a cue that names the retake's phrase, which is cut, on the take that is kept, as one that names no phrase does (Review Focus 2): a cue is asked for a kept phrase", () => {
      const cue = { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack.", seconds: 4, style: null, phrase: "p2" };
      const [placed] = cuesOf(projectFiles(main({ words: SKUS.words, plan: SKUS.plan, graphicCues: [cue] }))).cues;
      assert.deepEqual([placed.at.from, placed.at.to], ["w8", "w10"]);
    });
    it("lands a cue that names a phrase that is cut in that phrase only when its words are said nowhere else: the cut is the fallback", () => {
      const cue = { n: 1, words: "here uh", kind: "words", show: "A card.", seconds: 3, style: null, phrase: "p2" };
      const [placed] = cuesOf(projectFiles(main({ words: SKUS.words, plan: SKUS.plan, graphicCues: [cue] }))).cues;
      assert.deepEqual([placed.at.from, placed.at.to], ["w6", "w7"]);
    });
    it("goes by a cue's place in the order when its words are said twice: the second cue with the same words is on the second time", () => {
      const cue = (n) => ({ n, words: "too many SKUs", kind: "graphic", show: "A stack.", seconds: 4, style: null });
      const noPlan = cuesOf(projectFiles(main({ words: SKUS.words, plan: undefined, graphicCues: [cue(1), cue(2)] }))).cues;
      assert.deepEqual(noPlan.map((c) => c.at.from), ["w3", "w8"]);
    });
    it("is a main project's and a Reel's, and never a session clip's, whatever it is given (a session's recording never reaches a project's cues)", () => {
      assert.ok(projectFiles(reel()).has("brimm/graphic-cues.json"));
      assert.ok(projectFiles(reel({ graphicCues: [CUE] })).has("brimm/graphic-cues.json"));
      assert.ok("brimm/graphic-cues.json" in json(projectFiles(reel()), "brimm/facts.json").files);
      for (const over of [{}, { graphicCues: [CUE] }, { reelCues: [CUE] }, { graphicCues: [CUE], reelCues: [CUE], short: true }]) {
        assert.ok(!projectFiles(clip(over)).has("brimm/graphic-cues.json"), JSON.stringify(over));
        assert.ok(!("brimm/graphic-cues.json" in json(projectFiles(clip(over)), "brimm/facts.json").files), JSON.stringify(over));
        assert.doesNotMatch(projectFiles(clip(over)).get("CLAUDE.md"), /graphic-cues|Graphic cues/);
      }
    });
  });

  describe("a Reel's brimm/graphic-cues.json (PR H2)", () => {
    const cuesOf = (files) => json(files, "brimm/graphic-cues.json");
    /** A recording said from 300 s: word i is "word<i>", starts at 300 + i ÷ 2 and ends 0.2 s later, as the project places the words (each
        is given the time from 0.2 s before to 0.2 s after, and starts halfway in). */
    const RECORDING = Array.from({ length: 120 }, (_, i) => ({ w: `word${i}`, start: 300 + i / 2 - 0.2, end: 300 + i / 2 + 0.2 }));
    /** Reel 2: from 312.4 s to 340 s of it, which holds the words 25 to 79, as the Reel's w0 to w54. */
    const AT = { start: 312.4, end: 340 };
    const onWords = (i, j, over = {}) => ({ n: 1, words: RECORDING.slice(i, j + 1).map((w) => w.w).join(" "), kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, ...over });
    const cut = (over = {}) => reel({ words: RECORDING, plan: undefined, stretch: AT, facts: { ...FACTS, seconds: 27.6 }, spellings: [], ...over });

    it("is version 1 with the Reel's clock, and has no cues when it is given none", () => {
      for (const over of [{}, { graphicCues: [] }, { graphicCues: undefined }, { graphicCues: "none" }, { reelCues: [] }, { reelCues: "none" }]) {
        assert.deepEqual(cuesOf(projectFiles(cut(over))), { version: 1, clock: "reel", cues: [] }, JSON.stringify(over));
      }
      const files = projectFiles(cut({ graphicCues: [onWords(40, 42)] }));
      assert.deepEqual(Object.keys(cuesOf(files)), ["version", "clock", "cues"]);
      assert.equal(files.get("brimm/graphic-cues.json"), `${JSON.stringify(cuesOf(files), null, 2)}\n`);
    });
    it("takes the cues of the episode's plan that fall in its stretch, onto its own clock, with the ids of its transcript: a cue at 320 s is at 7.6 s", () => {
      const files = projectFiles(cut({ graphicCues: [onWords(40, 42)] }));
      const transcript = json(files, "transcript.json");
      assert.deepEqual([transcript.length, transcript[0].id, transcript[54].id, transcript[0].text], [55, "w0", "w54", "word25"]);
      assert.deepEqual(cuesOf(files).cues, [{ ...onWords(40, 42), at: { from: "w15", to: "w17", start: 7.6, end: 8.8 } }]);
      assert.deepEqual([transcript[15].text, transcript[15].start, transcript[17].end], ["word40", 7.6, 8.8]);
    });
    it("leaves out a cue that starts before the stretch, at 311 s, and one that runs past its end", () => {
      const cues = [onWords(22, 24, { n: 1 }), onWords(40, 42, { n: 2 }), onWords(78, 81, { n: 3 })];
      const got = cuesOf(projectFiles(cut({ graphicCues: cues }))).cues;
      assert.deepEqual(got.map((c) => [c.n, c.at.from, c.at.to]), [[2, "w15", "w17"]]);
    });
    it("takes the first three of five cues inside the stretch", () => {
      const cues = [30, 35, 40, 45, 50].map((i, k) => onWords(i, i + 1, { n: k + 1 }));
      assert.deepEqual(cuesOf(projectFiles(cut({ graphicCues: cues }))).cues.map((c) => [c.n, c.at.from]), [[1, "w5"], [2, "w10"], [3, "w15"]]);
    });
    it("keeps a cue on the Reel's first words and one on its last words when the stretch's ends are a few thousandths inside them, as a stretch moved to pictures can be", () => {
      // Word 25 starts at 312.5 s and word 79 ends at 339.7 s, and the Reel holds both (their middles are inside), but the stretch is from
      // 312.51 s to 339.69 s: the Reel's first word starts at 0 and its last ends at its length, 27.18 s, as the transcript has them.
      const stretch = { start: 312.51, end: 339.69 };
      const files = projectFiles(cut({ stretch, facts: { ...FACTS, seconds: 27.18 }, graphicCues: [onWords(25, 26, { n: 1 }), onWords(40, 41, { n: 2 }), onWords(78, 79, { n: 3 })] }));
      const transcript = json(files, "transcript.json");
      assert.deepEqual([transcript.length, transcript[0].start, transcript[54].end], [55, 0, 27.18]);
      assert.deepEqual(cuesOf(files).cues.map((c) => [c.n, c.at.from, c.at.to, c.at.start, c.at.end]), [[1, "w0", "w1", 0, 0.69], [2, "w15", "w16", 7.49, 8.19], [3, "w53", "w54", 26.49, 27.18]]);
    });
    it("still leaves out a cue whose words start a fifth of a second before the stretch, or end a fifth after it", () => {
      const stretch = { start: 312.7, end: 339.5 };
      const cues = [onWords(25, 26, { n: 1 }), onWords(40, 41, { n: 2 }), onWords(78, 79, { n: 3 })];
      // Word 25 starts at 312.5 s, 0.2 s before the stretch; word 79 ends at 339.7 s, 0.2 s after it.
      assert.deepEqual(cuesOf(projectFiles(cut({ stretch, graphicCues: cues }))).cues.map((c) => c.n), [2]);
    });
    it("does not place a cue of the episode that the recording does not hold, nor one that the stretch does not: neither is in the Reel's file", () => {
      const cues = [{ ...onWords(40, 42), n: 1, words: "the moon landing" }, onWords(5, 6, { n: 2 }), onWords(41, 42, { n: 3 })];
      assert.deepEqual(cuesOf(projectFiles(cut({ graphicCues: cues }))).cues.map((c) => c.n), [3]);
    });
    it("spells a cue's words as the transcript's are, so that a cue from an unspelled phrase finds them", () => {
      const words = RECORDING.map((w, i) => (i === 40 ? { ...w, w: "brim" } : w));
      const cue = { ...onWords(40, 41), words: "brim word41" };
      for (const over of [{ graphicCues: [cue] }, { reelCues: [cue] }]) {
        const files = projectFiles(cut({ words, ...over }));
        assert.equal(json(files, "transcript.json")[15].text, "BRIMM");
        assert.deepEqual(cuesOf(files).cues.map((c) => [c.n, c.at && [c.at.from, c.at.to]]), [[1, ["w15", "w16"]]], JSON.stringify(Object.keys(over)));
      }
    });
    it("keeps a cue on the take she keeps when its words are said in a retake the plan cuts that the Reel holds, with the Reel's ids", () => {
      const words = ["so", "we", "have", "too", "many", "SKUs", "here", "uh", "too", "many", "SKUs", "there", "today"].map((w, i) => ({ w, start: i, end: i + 0.8 }));
      const plan = {
        by: "rules",
        phrases: [
          { id: "p1", start: 0, end: 2.8, text: "so we have", words: words.slice(0, 3), keep: true, kind: "keep", why: "" },
          { id: "p2", start: 3, end: 7.8, text: "too many SKUs here uh", words: words.slice(3, 8), keep: false, kind: "retake", why: "said again at 0:08, the later one is kept" },
          { id: "p3", start: 8, end: 12.8, text: "too many SKUs there today", words: words.slice(8), keep: true, kind: "keep", why: "" }
        ]
      };
      const skus = (phrase) => ({ n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null, ...(phrase ? { phrase } : {}) });
      // The Reel is from 3 s to the end: it holds the retake and the take that is kept, as words 3 to 12 of the recording, its w0 to w9.
      for (const phrase of ["p2", "p3", "p9", undefined]) {
        const files = projectFiles(cut({ words, plan, stretch: { start: 3, end: 13 }, facts: { ...FACTS, seconds: 10 }, graphicCues: [skus(phrase)] }));
        assert.deepEqual(cuesOf(files).cues.map((c) => [c.at.from, c.at.to]), [["w5", "w7"]], String(phrase));
      }
    });
    it("takes the cues read for the Reel itself, for a Reel of a video her editor finished, and places them on its own words, three at most, in the order given", () => {
      const cues = [onWords(30, 31, { n: 1 }), onWords(35, 36, { n: 2 }), onWords(40, 41, { n: 3 }), onWords(45, 46, { n: 4 })];
      const files = projectFiles(cut({ reelCues: cues }));
      assert.deepEqual(cuesOf(files).cues.map((c) => [c.n, c.at.from, c.at.to]), [[1, "w5", "w6"], [2, "w10", "w11"], [3, "w15", "w16"]]);
      assert.equal(cuesOf(files).clock, "reel");
    });
    it("places a cue read for the Reel on the Reel's words alone: the same words said before the stretch are not where it lands, and it is not left out for them", () => {
      // The words are said at 306 s, before the Reel, and at 320 s inside it.
      const words = RECORDING.map((w, i) => (i === 12 || i === 40 ? { ...w, w: "pricing" } : w));
      const files = projectFiles(cut({ words, reelCues: [{ ...onWords(40, 40), words: "pricing" }] }));
      assert.deepEqual(cuesOf(files).cues.map((c) => [c.at.from, c.at.to, c.at.start]), [["w15", "w15", 7.6]]);
    });
    describe("a cue read for the Reel, for a phrase of the plan, is looked for in that phrase first", () => {
      // The plan's phrases are 30 words each, p1 to p4, over the whole recording (words 0 to 119). The Reel holds words 25 to 79: the end
      // of p1, all of p2 and the start of p3. "pricing" is said in p2 (word 35, the Reel's w10) and again in p3 (word 65, the Reel's w40).
      const phrases = ["p1", "p2", "p3", "p4"].map((id, k) => {
        const own = RECORDING.slice(k * 30, k * 30 + 30).map((w) => ({ ...w, w: w.w === "word35" || w.w === "word65" ? "pricing" : w.w }));
        return { id, start: own[0].start, end: own[own.length - 1].end, text: own.map((w) => w.w).join(" "), words: own, keep: true, kind: "keep", why: "" };
      });
      const words = phrases.flatMap((p) => p.words);
      const plan = { by: "rules", phrases };
      const said = (phrase, over = {}) => ({ n: 1, words: "pricing", kind: "words", show: "The word.", seconds: 3, style: null, ...(phrase ? { phrase } : {}), ...over });
      const landed = (cues) => cuesOf(projectFiles(cut({ words, plan, reelCues: cues }))).cues.map((c) => c.at && c.at.from);
      it("lands a cue that names the later phrase on the later time its words are said, and one that names the earlier phrase on the earlier", () => {
        assert.deepEqual(landed([said("p3")]), ["w40"]);
        assert.deepEqual(landed([said("p2")]), ["w10"]);
      });
      it("lands a cue that names no phrase, a phrase the plan has not, or a phrase outside the Reel on the first time its words are said in the Reel", () => {
        for (const phrase of [undefined, "p9", "p4", "p1"]) assert.deepEqual(landed([said(phrase)]), ["w10"], String(phrase));
      });
      it("keeps the order of the cues: the second cue with the same words lands on the second time when it names no phrase", () => {
        assert.deepEqual(landed([said(undefined, { n: 1 }), said(undefined, { n: 2 })]), ["w10", "w40"]);
      });
      it("does the same for a phrase that is cut: a finished video keeps the whole of itself, so every phrase of its plan is there", () => {
        const cutThird = { ...plan, phrases: phrases.map((p) => (p.id === "p3" ? { ...p, keep: false, kind: "retake", why: "said again" } : p)) };
        assert.deepEqual(cuesOf(projectFiles(cut({ words, plan: cutThird, reelCues: [said("p3")] }))).cues.map((c) => c.at.from), ["w40"]);
      });
    });
    it("has a cue read for the Reel with no place when the Reel's words do not hold it, and still lists it", () => {
      const files = projectFiles(cut({ reelCues: [{ ...onWords(40, 42), words: "the moon landing" }, onWords(41, 42, { n: 2 })] }));
      assert.deepEqual(cuesOf(files).cues.map((c) => [c.n, c.at && c.at.from]), [[1, null], [2, "w16"]]);
    });
    it("takes the cues read for the Reel before the cues of the plan, which a Reel of a finished video has none of", () => {
      const files = projectFiles(cut({ reelCues: [onWords(41, 42)], graphicCues: [onWords(40, 42)] }));
      assert.deepEqual(cuesOf(files).cues.map((c) => c.at.from), ["w16"]);
    });
    it("is the Reel's alone: a main video's cues stay on the recording's clock, and its file is not given the Reel's cues", () => {
      const main = projectFiles({ ...cut({ graphicCues: [onWords(40, 42)], reelCues: [onWords(41, 42)] }), kind: "main", part: "main", plan: undefined });
      assert.equal(cuesOf(main).clock, "recording");
      assert.deepEqual(cuesOf(main).cues.map((c) => [c.at.from, c.at.start]), [["w40", 320]]);
    });
  });
});

describe("the notes and facts of a main project, on its graphic cues (PR H1)", () => {
  const rulesOf = (files) => {
    const notes = files.get("CLAUDE.md");
    return notes.slice(notes.indexOf("# The BRIMM: rules for this project"), notes.indexOf("\n# ", notes.indexOf("# The BRIMM: rules for this project") + 1));
  };
  const RULE = "- **Graphic cues.** Studio's suggested graphics are in `brimm/graphic-cues.json`, each tied to the words it goes with: word ids and times on the recording's clock, so add the recording's `data-start` if it has moved. After the cuts, offer them to her, one at a time or all together, and build only the ones she takes: each short (its `seconds`), in the brand, with things and words and never people. A cue with no `at` was not found in her words: tell her, and place it only where she says. Never add a graphic she has not taken.";
  const ABOUT_FILE = "the graphics Studio suggests, each on the words it goes with, by word ids";
  /** The sentence PR H3 adds to the end of the rule, in a main project's and in a Reel's: the pictures she chose are styles, not sources. */
  const SENTENCE = " Files in `brimm/references/` are style references she chose: follow their look, and never copy what is in them.";
  it("have the rule for graphic cues, as it is written, right after the rule for cutting, in CLAUDE.md and AGENTS.md alike", () => {
    for (const files of [projectFiles(main()), projectFiles(main({ short: true }))]) {
      const lines = rulesOf(files).split("\n");
      assert.equal(lines.filter((line) => line.startsWith("- **Graphic cues.**")).length, 1);
      assert.equal(lines[lines.findIndex((line) => line.startsWith("- **Cutting.**")) + 1], RULE + SENTENCE);
      assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
    }
  });
  it("end the rule with the sentence about the style references she chose, to follow their look and never to copy what is in them (PR H3)", () => {
    assert.ok(rulesOf(projectFiles(main())).split("\n").some((line) => line.endsWith(`Never add a graphic she has not taken.${SENTENCE}`)));
    assert.match(SENTENCE, /^ Files in `brimm\/references\/` are style references she chose: follow their look, and never copy what is in them\.$/);
  });
  it("name a graphic as something shown, in the brand, and never a person, and build only what she takes", () => {
    assert.match(RULE, /build only the ones she takes/);
    assert.match(RULE, /with things and words and never people/);
    assert.match(RULE, /Never add a graphic she has not taken\./);
    assert.ok(rulesOf(projectFiles(main())).includes(RULE));
  });
  it("have no such rule in a session clip's project", () => {
    assert.doesNotMatch(projectFiles(clip()).get("CLAUDE.md"), /Graphic cues|graphic-cues/);
  });
  describe("in a Reel's project (PR H2)", () => {
    /** H1's line, with its clock put as the Reel's, and the frame of an upright Reel added at its end. */
    const REEL_RULE = "- **Graphic cues.** Studio's suggested graphics are in `brimm/graphic-cues.json`, each tied to the words it goes with: word ids and times on the Reel's clock. After the cuts, offer them to her, one at a time or all together, and build only the ones she takes: each short (its `seconds`), in the brand, with things and words and never people. A cue with no `at` was not found in her words: tell her, and place it only where she says. Never add a graphic she has not taken. On this upright Reel, keep graphics and words out of the top 14% and the bottom 35%.";
    it("is H1's line with the Reel's clock in place of the recording's, and the frame of an upright Reel at its end, as it is written, right after the rule for cutting", () => {
      const files = projectFiles(reel());
      const lines = rulesOf(files).split("\n");
      assert.equal(lines.filter((line) => line.startsWith("- **Graphic cues.**")).length, 1);
      assert.equal(lines[lines.findIndex((line) => line.startsWith("- **Cutting.**")) + 1], REEL_RULE + SENTENCE);
      assert.equal(REEL_RULE, `${RULE.replace("on the recording's clock, so add the recording's `data-start` if it has moved", "on the Reel's clock")} On this upright Reel, keep graphics and words out of the top 14% and the bottom 35%.`);
      assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
    });
    it("says nothing of the recording's data-start, which a Reel's video does not move from, and is not the main project's line", () => {
      assert.doesNotMatch(REEL_RULE, /data-start|recording's clock/);
      assert.ok(!rulesOf(projectFiles(reel())).includes(RULE));
      assert.ok(rulesOf(projectFiles(main())).includes(RULE));
      assert.ok(!rulesOf(projectFiles(main())).includes("On this upright Reel"));
    });
    it("is the same whatever faces the Reel was cropped on, and in a Reel given cues and one given none", () => {
      const faces = { every: 2, stills: [{ file: "0001.jpg", faces: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.2 }] }] };
      for (const over of [{}, { faces }, { facts: { ...FACTS, width: 1080, height: 1920 } }, { graphicCues: [] }, { reelCues: [] }]) assert.ok(rulesOf(projectFiles(reel(over))).includes(REEL_RULE), JSON.stringify(over));
    });
    it("keeps the safe areas of the Reel's captions as they were: the same 14% and 35% as the line about captions", () => {
      assert.match(rulesOf(projectFiles(reel())), /Reels have captions, with the top 14% and the bottom 35% of an upright frame kept clear\./);
    });
  });
  it("say what the file is in the facts and in the notes' list of the project's files, after the cuts' and the Reels'", () => {
    const files = projectFiles(main());
    assert.equal(json(files, "brimm/facts.json").files["brimm/graphic-cues.json"], ABOUT_FILE);
    assert.ok(files.get("CLAUDE.md").includes(`  - \`brimm/graphic-cues.json\`: ${ABOUT_FILE}.`));
    const listed = Object.keys(json(files, "brimm/facts.json").files);
    assert.deepEqual(listed.filter((path) => path.startsWith("brimm/")).slice(0, 3), ["brimm/cut-suggestions.json", "brimm/reel-suggestions.json", "brimm/graphic-cues.json"]);
  });
});

describe("the reference pictures a project holds (PR H3)", () => {
  const WORK = "/Users/sallie/BRIMM Video Work/.reference-x";
  const BLUE = { name: "blue carousel.png", path: `${WORK}/blue carousel.png` };
  /** A HEIC picture of the reference folder, as it is given once Claude can read it: the name is the folder's, the path the JPEG made of it. */
  const HEIC = { name: "title style.heic", path: `${WORK}/title style.jpg` };
  const ABOUT_REFERENCES = "style references she chose: follow their look, and never copy what is in them";
  const cue = (n, words, style, over = {}) => ({ n, words, kind: "graphic", show: "A chart of costs.", seconds: 4, style, phrase: "p2", ...over });
  const cuesOf = (files) => json(files, "brimm/graphic-cues.json").cues;

  it("copies each picture it is given into brimm/references/ under its name, in a main project, a short video's and a Reel's", () => {
    for (const over of [{}, { short: true }]) {
      const files = projectFiles(main({ references: [BLUE], ...over }));
      assert.deepEqual(files.get("brimm/references/blue carousel.png"), { copy: BLUE.path });
    }
    assert.deepEqual(projectFiles(reel({ references: [BLUE] })).get("brimm/references/blue carousel.png"), { copy: BLUE.path });
  });
  it("names a HEIC or TIFF picture for the JPEG that was made of it, which is the file Claude reads", () => {
    const files = projectFiles(main({ references: [HEIC, { name: "scan.TIFF", path: `${WORK}/scan.jpg` }] }));
    assert.deepEqual(files.get("brimm/references/title style.jpg"), { copy: HEIC.path });
    assert.deepEqual(files.get("brimm/references/scan.jpg"), { copy: `${WORK}/scan.jpg` });
    assert.deepEqual([...files.keys()].filter((path) => path.startsWith("brimm/references/")), ["brimm/references/title style.jpg", "brimm/references/scan.jpg"]);
  });
  it("holds none, and says nothing of the folder in its facts or its list of files, when it is given none", () => {
    for (const over of [{}, { references: [] }, { references: undefined }]) {
      const files = projectFiles(main(over));
      assert.deepEqual([...files.keys()].filter((path) => path.startsWith("brimm/references")), []);
      assert.ok(!("brimm/references/" in json(files, "brimm/facts.json").files));
      assert.ok(!files.get("CLAUDE.md").includes("  - `brimm/references/`"));
    }
  });
  it("says what the folder is in the facts and in the notes' list of the project's files, once, whatever the number of pictures, after the logos", () => {
    for (const files of [projectFiles(main({ references: [BLUE] })), projectFiles(main({ references: [BLUE, HEIC] })), projectFiles(reel({ references: [BLUE, HEIC] }))]) {
      const listed = Object.keys(json(files, "brimm/facts.json").files);
      assert.equal(json(files, "brimm/facts.json").files["brimm/references/"], ABOUT_REFERENCES);
      assert.equal(listed.filter((path) => path.startsWith("brimm/references")).length, 1);
      assert.ok(listed.indexOf("brimm/references/") > listed.indexOf("assets/logos/"));
      assert.equal(files.get("CLAUDE.md").split("\n").filter((line) => line.startsWith("  - `brimm/references/`")).length, 1);
      assert.ok(files.get("CLAUDE.md").includes(`  - \`brimm/references/\`: ${ABOUT_REFERENCES}.`));
      assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
    }
  });
  it("gives a session's clip none, whatever it is given: nothing of the reference folder is a clip's", () => {
    const files = projectFiles(clip({ references: [BLUE] }));
    assert.deepEqual([...files.keys()].filter((path) => path.startsWith("brimm/references")), []);
    assert.ok(!files.has("brimm/graphic-cues.json"));
  });
  it("refuses a reference that is not a file name of its own, or whose copy is not named by a whole path: nothing leads out of the project", () => {
    const bad = [{ name: "../x.png", path: BLUE.path }, { name: "a/b.png", path: BLUE.path }, { name: "a\\b.png", path: BLUE.path }, { name: ".hidden.png", path: BLUE.path }, { name: "", path: BLUE.path },
      { name: "line\nbreak.png", path: BLUE.path }, { name: 7, path: BLUE.path }, { name: "x.png", path: "relative/x.png" }, { name: "x.png", path: "" }, { name: "x.png" }, null, "x.png"];
    for (const reference of bad) assert.throws(() => projectFiles(main({ references: [reference] })), /references/, JSON.stringify(reference));
    assert.throws(() => projectFiles(main({ references: "x.png" })), /references/);
  });

  describe("and the cues that name them", () => {
    it("keeps a cue's style as it is whether or not the picture is given: a picture that is not in the folder leaves the cue its style", () => {
      const cues = [cue(1, "says Hormozy", { ref: "blue carousel.png" }), cue(2, "is a skill", { ref: "gone.png" }), cue(3, "says", null), cue(4, "a skill", { inspiration: "Hormozi's reels" })];
      for (const references of [[], [BLUE]]) {
        assert.deepEqual(cuesOf(projectFiles(main({ graphicCues: cues, references }))).map((c) => c.style), [{ ref: "blue carousel.png" }, { ref: "gone.png" }, null, { inspiration: "Hormozi's reels" }]);
      }
    });
    it("names the JPEG in a cue's style once a HEIC picture is made one, so that the cue names the file the project holds", () => {
      const files = projectFiles(main({ graphicCues: [cue(1, "says Hormozy", { ref: "title style.heic" }), cue(2, "is a skill", { ref: "title style.heic" })], references: [HEIC] }));
      assert.deepEqual(cuesOf(files).map((c) => c.style), [{ ref: "title style.jpg" }, { ref: "title style.jpg" }]);
      assert.ok(files.has("brimm/references/title style.jpg"));
    });
    it("names the file as the project holds it when the cue spelled it with another case, and leaves a ref no picture is given for as it was spelled", () => {
      const files = projectFiles(main({ graphicCues: [cue(1, "says Hormozy", { ref: "Blue Carousel.PNG" }), cue(2, "is a skill", { ref: "Gone.PNG" })], references: [BLUE] }));
      assert.deepEqual(cuesOf(files).map((c) => c.style), [{ ref: "blue carousel.png" }, { ref: "Gone.PNG" }]);
    });
    it("does the same in a Reel's file of cues, whichever way the Reel has them", () => {
      const RECORDING = Array.from({ length: 120 }, (_, i) => ({ w: `word${i}`, start: 300 + i / 2 - 0.2, end: 300 + i / 2 + 0.2 }));
      const AT = { start: 312.4, end: 340 };
      const onWords = (i, j, style) => ({ n: 1, words: RECORDING.slice(i, j + 1).map((w) => w.w).join(" "), kind: "graphic", show: "A stack of boxes.", seconds: 4, style });
      const cut = (over = {}) => reel({ words: RECORDING, plan: undefined, stretch: AT, facts: { ...FACTS, seconds: 27.6 }, spellings: [], ...over });
      const fromPlan = projectFiles(cut({ graphicCues: [onWords(40, 42, { ref: "title style.heic" })], references: [HEIC] }));
      assert.deepEqual(cuesOf(fromPlan).map((c) => c.style), [{ ref: "title style.jpg" }]);
      const fromRun = projectFiles(cut({ reelCues: [onWords(40, 42, { ref: "title style.heic" })], references: [HEIC] }));
      assert.deepEqual(cuesOf(fromRun).map((c) => c.style), [{ ref: "title style.jpg" }]);
    });
    it("changes nothing else about the file of cues: it is the file the cues make without any picture, but for those names", () => {
      const cues = [cue(1, "says Hormozy", { ref: "title style.heic" })];
      const bare = json(projectFiles(main({ graphicCues: cues })), "brimm/graphic-cues.json");
      const given = json(projectFiles(main({ graphicCues: cues, references: [HEIC] })), "brimm/graphic-cues.json");
      assert.deepEqual({ ...given, cues: given.cues.map((c) => ({ ...c, style: bare.cues[0].style })) }, bare);
      assert.equal(projectFiles(main({ graphicCues: cues, references: [HEIC] })).get("brimm/graphic-cues.json"), `${JSON.stringify(given, null, 2)}\n`);
    });
  });

  describe("projectCues: the cues a project will hold, which tell which pictures it needs", () => {
    it("is what the file of cues lists, for a main video, a short video and a Reel, before any picture is given", () => {
      const cues = [cue(1, "says Hormozy", { ref: "blue carousel.png" }), cue(2, "the moon landing", { ref: "gone.png" })];
      for (const input of [main({ graphicCues: cues }), main({ graphicCues: cues, short: true }), reel({ graphicCues: cues }), reel({ reelCues: cues })]) {
        assert.deepEqual(projectCues(input), cuesOf(projectFiles(input)), input.kind);
      }
      assert.deepEqual(projectCues(main({ graphicCues: cues })).map((c) => [c.n, c.at === null]), [[1, false], [2, true]]);
    });
    it("is none for a session's clip, and for a project given no cues", () => {
      assert.deepEqual(projectCues(clip({ graphicCues: [cue(1, "says", null)] })), []);
      assert.deepEqual(projectCues(main()), []);
      assert.deepEqual(projectCues(reel()), []);
    });
    it("is none for a kind that is none of the three, as projectFiles refuses it", () => {
      assert.deepEqual(projectCues(main({ kind: "podcast" })), []);
    });
  });
});

describe("the file set of each kind of project (5.2)", () => {
  const common =[".claude/settings.json", "AGENTS.md", "CLAUDE.md", ...FONTS, "brimm/brand.md", "brimm/facts.json", "hyperframes.json", "index.html", "media/recording.mp4", "meta.json", "node_modules/.bin/hyperframes", "package.json", "transcript.json", "vendor/gsap.min.js"];
  const logos = ["assets/logos/the-brimm-stacked-navy.svg", "assets/logos/the-brimm-stacked-white.svg"];
  const sorted = (paths) => [...paths].sort();
  it("is exactly this for a main project", () => {
    assert.deepEqual(sorted(projectFiles(main()).keys()), sorted([...common, ...logos, "brimm/cut-suggestions.json", "brimm/graphic-cues.json", "brimm/reel-suggestions.json", "brimm/spellings.json"]));
  });
  it("is the same for a Reel's project, with its graphic cues (on the Reel's clock) and without the cut and Reel suggestions", () => {
    assert.deepEqual(sorted(projectFiles(reel()).keys()), sorted([...common, ...logos, "brimm/graphic-cues.json", "brimm/spellings.json"]));
  });
  it("has the face track too for a Reel whose video has faces in it, and for no other project", () => {
    const faces = { every: 2, stills: [{ file: "0001.jpg", faces: [{ x: 0.4, y: 0.2, w: 0.2, h: 0.3 }] }] };
    assert.deepEqual(sorted(projectFiles(reel({ faces })).keys()), sorted([...common, ...logos, "brimm/graphic-cues.json", "brimm/spellings.json", "brimm/face-track.json"]));
    assert.deepEqual(sorted(projectFiles(main({ faces })).keys()), sorted(projectFiles(main()).keys()));
    assert.deepEqual(sorted(projectFiles(clip({ faces })).keys()), sorted(common));
  });
  it("has no spellings, suggestions or logos for a session clip", () => {
    assert.deepEqual(sorted(projectFiles(clip()).keys()), sorted(common));
  });
  it("moves the working copy in, links the toolchain, and copies the brand pack's files and the vendored GSAP", () => {
    const files = projectFiles(main());
    assert.deepEqual(files.get("media/recording.mp4"), { move: "/Users/sallie/BRIMM Video Work/E/working copy/k.mp4" });
    assert.deepEqual(files.get("node_modules/.bin/hyperframes"), { link: CLI });
    assert.deepEqual(files.get("assets/logos/the-brimm-stacked-white.svg"), { copy: LOGOS[1] });
    for (const path of [...FONTS, "vendor/gsap.min.js"]) assert.ok(fs.existsSync(files.get(path).copy), path);
  });
  it("vendors the GSAP init uses, at the checksum the pin holds", () => {
    const gsap = projectFiles(main()).get("vendor/gsap.min.js").copy;
    const bytes = fs.readFileSync(gsap);
    assert.equal(PIN.gsap.version, "3.14.2");
    assert.match(bytes.toString("utf8", 0, 40), /GSAP 3\.14\.2/);
    assert.equal(`sha512-${createHash("sha512").update(bytes).digest("base64")}`, PIN.gsap.integrity);
    assert.ok(GOLDEN.index.includes(`gsap@${PIN.gsap.version}/`));
  });
  it("gives a session clip's project no part of the file's name", () => {
    const files = projectFiles(clip());
    const said = [...files.keys(), ...[...files.values()].filter((v) => typeof v === "string")].join("\n");
    for (const part of ["Jane", "Doe", "GMT20261013", "142933"]) assert.ok(!said.includes(part), part);
    assert.equal(json(files, "meta.json").name, "Session clip 3 3fa9c1");
    assert.equal(json(files, "brimm/facts.json").name, "Session clip 3 3fa9c1");
  });
  it("writes the settings of its kind", () => {
    assert.ok(!json(projectFiles(main()), ".claude/settings.json").permissions.deny.includes("WebFetch"));
    assert.ok(json(projectFiles(clip()), ".claude/settings.json").permissions.deny.includes("WebFetch"));
  });
});

describe("the notes for the agent (5.4)", () => {
  const notes = projectFiles(main()).get("CLAUDE.md");
  const rules = notes.slice(0, notes.indexOf("\n# ", 1));
  it("are the same text in CLAUDE.md and AGENTS.md", () => {
    for (const files of [projectFiles(main()), projectFiles(reel()), projectFiles(clip())]) assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
  });
  it("put the BRIMM rules first, saying they come before everything below", () => {
    assert.equal(notes.split("\n")[0], "# The BRIMM: rules for this project");
    assert.match(notes.split("\n").slice(1, 4).join("\n"), /These rules come before everything below/);
  });
  // In A0 the app's assistant said "the app told me it records every change on its own", and skipped the line that asked it to
  // wrap each request in `history begin` and `history end`. The app keeps the history; what stays is asking it.
  it("do not ask the agent to record each request in the history, and keep the line about asking the history what changed", () => {
    for (const files of [projectFiles(main()), projectFiles(reel()), projectFiles(clip())]) {
      for (const path of ["CLAUDE.md", "AGENTS.md"]) {
        const text = files.get(path);
        assert.doesNotMatch(text, /history\s+(?:begin|end)\b/, path);
        assert.doesNotMatch(text, /--who\b|--label\b/, path);
        assert.ok(text.split("\n").includes("- **Versions.** When asked what has changed, or to go back, use `npx hyperframes history`."), path);
      }
    }
  });
  // Jason, 2026-11-04, after A1: "I don't want to block ai generated content on either computer." The notes of a main video and of a Reel
  // warn, in his words, before an AI avatar, lip-sync or an AI-generated Sallie, her face or her voice, and block none of them. They are the
  // only guard in the app: it starts its agent with `--setting-sources user`, so a project's `.claude/settings.json` has no effect there.
  const AI_PEOPLE = `- **AI-generated people.** HeyGen's tools are open. The BRIMM doesn't use AI avatars, lip-sync, or an AI-generated Sallie, her face or her voice, for now. If she asks for one of these, warn her first: "The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now. Do you still want it?" Go ahead only if she still wants it, and remind her that YouTube needs the video marked as altered or synthetic content. A stock HeyGen voice is fine without the warning, with the same YouTube reminder.`;
  // A session clip keeps the rule it had: no session clip uses HeyGen's features until HeyGen confirms the training opt-out (CLAUDE.md).
  const NO_GENERATED_PEOPLE = "- **No generated people.** No HeyGen avatars, HeyGen voices or HeyGen Video 1 clips without Jason's yes. No generated people who could pass as real, and never a generated Sallie, face or voice.";
  it("warn before an AI avatar, lip-sync or an AI-generated Sallie, her face or her voice, in a main video's notes and a Reel's, and block none of them", () => {
    for (const files of [projectFiles(main()), projectFiles(reel())]) {
      for (const path of ["CLAUDE.md", "AGENTS.md"]) {
        const text = files.get(path);
        assert.ok(text.split("\n").includes(AI_PEOPLE), path);
        assert.ok(!text.split("\n").includes(NO_GENERATED_PEOPLE), path);
        assert.doesNotMatch(text, /No generated people|HeyGen Video 1|without Jason's yes|never a generated/i, path);
      }
    }
  });
  it("keep a session clip's old rule about generated people, and never say that HeyGen's tools are open", () => {
    for (const path of ["CLAUDE.md", "AGENTS.md"]) {
      const text = projectFiles(clip()).get(path);
      assert.ok(text.split("\n").includes(NO_GENERATED_PEOPLE), path);
      assert.ok(!text.includes(AI_PEOPLE), path);
      assert.doesNotMatch(text, /HeyGen's tools are open|AI-generated people|AI Sallie/, path);
    }
  });
  it("name every command the agent may not run, and send it to transcript.json", () => {
    for (const [name, c] of Object.entries(COMMANDS)) if (c.class !== "agent") assert.ok(rules.includes(`\`${name}\``), name);
    for (const name of ["skills", "publish", "cloud", "tts", "add"]) assert.ok(rules.includes(`\`${name}\``), name);
    assert.match(rules, /`transcript\.json`/);
    assert.match(rules, /never transcribe/i);
  });
  it("keep HyperFrames' own guidance without the lines that conflict", () => {
    const kept = hyperframesGuidance(GOLDEN.claude);
    for (const gone of ["skills update", "publish", "npm run publish", "hyperframes.heygen.com", "catch-up", "upgrade", "registry"]) assert.ok(!kept.includes(gone), gone);
    for (const still of ["## Key Rules", "npx hyperframes docs <topic>", "npx hyperframes preview --background", "window.__timelines"]) assert.ok(kept.includes(still), still);
    assert.ok(notes.includes(kept.trim()));
  });
  it("give the brand's guide the company's name, and where an end card goes", () => {
    const brand = projectFiles(main()).get("brimm/brand.md");
    assert.match(brand, /The company's name is The BRIMM/);
    assert.match(brand, /"Brim" or "brim" is BRIMM/);
    assert.match(brand, /An end card starts after the last words/);
    assert.match(brand, /never cuts the recording/);
  });
  it("begin a session clip's notes with its own rules", () => {
    const own = projectFiles(clip()).get("CLAUDE.md");
    const at = own.indexOf("This is a clip of a private client session");
    assert.ok(at >= 0 && at < own.indexOf("# The BRIMM: rules for this project"));
    const first = own.slice(0, own.indexOf("# The BRIMM: rules for this project"));
    for (const said of [/Share/, /cloud/, /Script panel/, /web/]) assert.match(first, said);
  });
});

describe("assertSafe (5.2)", () => {
  it("refuses a path that leaves the project, an absolute one and a .env", () => {
    for (const path of ["../outside", "brimm/../../x", "/etc/passwd", ".env", "brimm/.env", ".env.local"]) {
      assert.throws(() => assertSafe(new Map([[path, "x"]])), undefined, path);
    }
  });
  it("lets each kind's file set through", () => {
    for (const files of [projectFiles(main()), projectFiles(reel()), projectFiles(clip())]) assert.doesNotThrow(() => assertSafe(files));
  });
});

describe("writeProject (5.7)", () => {
  /** A scratch folder holding a working copy and a logo, with the file set of a main project for them, to go in its episode's folder. */
  function scratch() {
    const root = fs.mkdtempSync(join(tmpdir(), "brimm-project-"));
    const video = join(root, "working copy", "k.mp4");
    fs.mkdirSync(join(root, "working copy"));
    fs.writeFileSync(video, "the working copy's bytes");
    fs.mkdirSync(join(root, "logos"));
    fs.writeFileSync(join(root, "logos", "mark.svg"), "<svg/>");
    const files = projectFiles(main({ video, logos: [join(root, "logos", "mark.svg")] }));
    const episode = join(root, "Episode");
    return { root, video, files, episode, dir: join(episode, "Pricing talk main 3fa9c1") };
  }
  /** node:fs, with the rename of the finished folder into place refused, and, when `stuck`, the working copy's way back too. */
  const refusing = (dir, video, stuck = false) => ({
    ...fs,
    renameSync: (from, to) => {
      if (to === dir) throw new Error("the rename was refused");
      if (stuck && to === video) throw new Error("the way back is gone");
      return fs.renameSync(from, to);
    }
  });
  /** node:fs, with writeFileSync and copyFileSync failing after `n` files. */
  const failingAfter = (n) => {
    let made = 0;
    const counted = (call) => (...args) => {
      if (++made > n) throw new Error("the disk is full");
      return call(...args);
    };
    return { ...fs, writeFileSync: counted(fs.writeFileSync), copyFileSync: counted(fs.copyFileSync) };
  };

  it("moves the video in, not copies it, and writes the rest, building beside the project's folder", () => {
    const { root, video, files, episode, dir } = scratch();
    writeProject(dir, files);
    assert.ok(!fs.existsSync(video));
    assert.equal(fs.readFileSync(join(dir, "media", "recording.mp4"), "utf8"), "the working copy's bytes");
    assert.equal(fs.readFileSync(join(dir, "CLAUDE.md"), "utf8"), files.get("CLAUDE.md"));
    assert.equal(fs.readlinkSync(join(dir, "node_modules", ".bin", "hyperframes")), CLI);
    assert.equal(fs.readFileSync(join(dir, "assets", "logos", "mark.svg"), "utf8"), "<svg/>");
    assert.deepEqual(fs.readdirSync(episode), ["Pricing talk main 3fa9c1"]);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("writes whole or not at all: a failure after the third file leaves no folder and the video where it was", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, files, { fs: failingAfter(3) }), /the disk is full/);
    assert.ok(!fs.existsSync(dir));
    assert.equal(fs.readFileSync(video, "utf8"), "the working copy's bytes");
    assert.deepEqual(fs.readdirSync(episode), []);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("puts the video back when the folder cannot be put in place", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, files, { fs: refusing(dir, video) }), /the rename was refused/);
    assert.ok(!fs.existsSync(dir));
    assert.equal(fs.readFileSync(video, "utf8"), "the working copy's bytes");
    assert.deepEqual(fs.readdirSync(episode), []);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("leaves the video beside the project's folder, and says where, when it cannot be put back", () => {
    const { root, video, files, episode, dir } = scratch();
    let said = "";
    assert.throws(() => writeProject(dir, files, { fs: refusing(dir, video, true) }), (error) => {
      said = error.message;
      return /could not be put back/.test(said);
    });
    const at = said.slice(said.lastIndexOf(" is at ") + " is at ".length);
    assert.ok(at.startsWith(`${episode}/`), at);
    assert.equal(fs.readFileSync(at, "utf8"), "the working copy's bytes");
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("refuses a folder that exists, and leaves it alone", () => {
    const { root, video, files, dir } = scratch();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(join(dir, "theirs.txt"), "kept");
    assert.throws(() => writeProject(dir, files), /already/);
    assert.deepEqual(fs.readdirSync(dir), ["theirs.txt"]);
    assert.ok(fs.existsSync(video));
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("refuses a file set with an unsafe path before it touches anything", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, new Map([...files, ["../escaped.txt", "x"]])));
    assert.ok(!fs.existsSync(episode) && fs.existsSync(video));
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("gives a file it copies the time it is given (a project rebuilt from a snapshot keeps the times its files had), and a copy with none the time of the copy (plan PR 11)", () => {
    const root = fs.mkdtempSync(join(tmpdir(), "brimm-project-"));
    fs.writeFileSync(join(root, "a.html"), "<a/>");
    fs.writeFileSync(join(root, "b.html"), "<b/>");
    const dir = join(root, "Episode", "Project");
    const at = Date.parse("2020-05-04T13:40:00.500Z");
    writeProject(dir, new Map([["a.html", { copy: join(root, "a.html"), mtimeMs: at }], ["b.html", { copy: join(root, "b.html") }], ["c.html", "<c/>"]]));
    assert.equal(fs.statSync(join(dir, "a.html")).mtimeMs, at);
    assert.ok(fs.statSync(join(dir, "b.html")).mtimeMs > at + 1000 * 60 * 60 * 24, "a copy with no time is as new as the copy");
    assert.equal(fs.readFileSync(join(dir, "a.html"), "utf8"), "<a/>");
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("leaves no folder when a time cannot be given to a copy", () => {
    const root = fs.mkdtempSync(join(tmpdir(), "brimm-project-"));
    fs.writeFileSync(join(root, "a.html"), "<a/>");
    const dir = join(root, "Episode", "Project");
    const failing = { ...fs, utimesSync: () => { throw new Error("no time for it"); } };
    assert.throws(() => writeProject(dir, new Map([["a.html", { copy: join(root, "a.html"), mtimeMs: 1000 }]]), { fs: failing }), /no time for it/);
    assert.deepEqual(fs.readdirSync(join(root, "Episode")), []);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("settingsText (5.5; plan PR 11)", () => {
  it("is the text that .claude/settings.json holds in a project of that kind, so that a rebuilt project's is the same", () => {
    assert.equal(settingsText("main"), projectFiles(main()).get(".claude/settings.json"));
    assert.equal(settingsText("main"), projectFiles(reel()).get(".claude/settings.json"));
    assert.equal(settingsText("clip"), projectFiles(clip()).get(".claude/settings.json"));
    assert.notEqual(settingsText("main"), settingsText("clip"));
  });
});

describe("what the documents say of a Reel's page (Jason, 2 November): Studio makes it upright, 1080 by 1920, and crops it on the speaker", () => {
  const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const readme = read("README.md");
  const spec = read("docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md");
  const plan = read("docs/superpowers/plans/2026-10-27-brimm-video-studio-build-plan.md");
  const rowOf = (start) => readme.split("\n").filter((line) => line.startsWith(start));

  it("has the README's row of `app … reel` say how the Reel opens: upright, where the speaker is, the formula, who can move the crop, and that an older Reel project stays as it was", () => {
    const [row] = rowOf("| `app \"<episode>\" reel <n> [--take-over]`");
    for (const words of [
      "**It opens upright, 1080 by 1920, cropped on the speaker**", "`data-resolution=\"portrait\"`", "`object-fit: cover`", "`object-position: <p>% 50%`", "the largest face in each still the finder looked in",
      "the lower of two", "p = (540 - place x `Wi`) / (1080 - `Wi`)", "`speakerPlace` and `uprightPosition`", "has nothing to crop across and is 50", "the app's agent can move the crop",
      "`finish` refuses a Reel that is not upright", "`brimm/facts.json` keeps the video's own size", "A Reel project made before this stays as it was made, wide"
    ]) assert.ok(row.includes(words), words);
  });
  it("has the specification say it in 4.3, in the table of a project's files, in the notes (5.4) and in the list of what is kept", () => {
    for (const words of [
      "**The Reel opens upright, cropped on the speaker by Studio**", "**Where the speaker is**", "p` = (540 - `c` x `Wi`) / (1080 - `Wi`)", "**The app's agent can still adjust it.**", "a Reel project made before this stays as it was made, wide",
      "A Reel's is upright whatever the video's shape (4.3): 1080 by 1920", "Studio makes the Reel's upright crop from it (4.3); the app's agent can move that crop by it, or follow the speaker with it",
      "Studio made the Reel upright, 1080 by 1920, and cropped it on the speaker", "`speakerPlace` and `uprightPosition`"
    ]) assert.ok(spec.includes(words), words);
  });
  it("no longer says anywhere that the crop is the app's job, or that the app opens a wide Reel and is asked to make it upright", () => {
    for (const [what, text] of [["README", readme], ["specification", spec], ["plan", plan]]) {
      assert.doesNotMatch(text, /upright crop is the app'?s|crop it on the speaker\. `brimm\/face-track|make the composition upright and crop|The app opens a wide project of the Reel|ask the app to make it upright/, what);
    }
  });
});
