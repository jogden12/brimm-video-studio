// finish and the words on a HyperFrames project's picture (plan PR 8, groups B1 to B5 and C1 to C3; architecture 2026-10-27, section 8.5): what
// finish says and asks of the words on the main video's picture, which it reads out of the project, and the proposal it names when a
// Reel has no title. It runs in the made-up world of exports-world.js: a raw video whose main project holds a lower third, "Alex Rivera" over
// "Head of Pricing", from 0:03, with a Downloads folder in the test's own home. No program is run, and nothing is written in a project.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { PIN } from "../hyperframes.js";
import { EPISODE } from "./phase4.js";
import { EDITED, FOLDER, PROJECT, reread } from "./episodes.js";
import { FIXTURE_MAIN, FOUND, MAIN, MAIN_WORDS, REEL2, REEL_FILES, TAKEN, entry, exportOf, named, screen, world } from "./exports-world.js";

/** Nothing she reads holds a path, a flag, or the name of a command. */
const PLAIN = /\/|--|~|\bedit\.js\b|\bnode\b|\bnpx\b/;
const plain = (lines) => {
  for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
};
/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
const MAIN_LINE = `The main video: ${named(MAIN, "13.56")}, from Downloads, exported 2026-10-20 13:56.`;
const REEL_LINE = `Reel 2: ${named(REEL2, "14.03")}, from Downloads, exported 2026-10-20 14:03.`;
const START = 'Say "yes, hand it off" to start.';
const STARTED = "Started. The panel shows how far it is.";
const NONE_FOUND = "I found no words on the main video's picture. Say what is on screen, or say that nothing is.";
const NOT_HERE = "I could not look at the main video's project on this Mac, so I do not know what is on its picture. Say what is on screen, or say that nothing is.";
const REEL2_OPENING = "So the first thing you need to do is know your costs.";
/** The made-up recording's Reels, with Reel 2's title changed. */
const reelsWith = (title) => EPISODE.record.reels.map((r) => (r.n === 2 ? { ...r, title } : r));
/** Every file under a project's folder with its size and time: to see that finish writes nothing in a project. */
const listing = (dir, from = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const at = join(dir, entry.name);
  return entry.isDirectory() ? listing(at, from) : [[at.slice(from.length), statSync(at).size, statSync(at).mtimeMs]];
});
/** A made-up world with both exports in Downloads. */
function ready(options = {}) {
  const w = world(options);
  exportOf(w, "main");
  exportOf(w, "reel 2");
  return w;
}

describe("B1. the main video's words, found", () => {
  it("shows what the picture holds with a question, after the parts and before the yes, and starts nothing", async () => {
    const w = ready();
    const before = listing(w.dirOf("main"));
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, FOUND, START]);
    assert.deepEqual([w.t.started, reread(w.found).rev, existsSync(join(w.work, "finish.asked.json"))], [[], 1, false]);
    assert.deepEqual(listing(w.dirOf("main")), before, "nothing is written in the project");
    plain(w.t.said().split("\n"));
    w.t.done();
  });
  it("with a yes after the call that showed them says them again as taken, starts the finish once, and writes the lines in the order shown", async () => {
    // Her yes is to the words that call showed (review I1): so it is the second call that starts.
    const w = ready({ shown: false });
    const first = await on(w.t.ctx.deps, "finish", FOLDER);
    assert.deepEqual([first.code, first.said], [0, [MAIN_LINE, REEL_LINE, FOUND, START]]);
    assert.deepEqual(w.t.started, []);
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said], [0, [MAIN_LINE, REEL_LINE, TAKEN, STARTED]]);
    assert.equal(w.t.started.length, 1);
    const asked = w.asked();
    assert.deepEqual(asked.parts.map((p) => [p.key, p.onPicture]), [["main", MAIN_WORDS], ["reel 2", undefined]]);
    plain([...first.said, ...r.said]);
    w.t.done();
  });
  it("says three or more as a, b and c, each with its time, in the order they appear", async () => {
    const w = ready();
    screen(w, "main", FIXTURE_MAIN);
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-2), 'On screen in the main video I found "Alex Rivera" at 0:03, "Head of Pricing" at 0:03, "Three pricing" at 0:20, "mistakes" at 0:20 and "Know your costs" at 0:40. Right?');
    w.t.done();
  });
  it("says one line with its time, and a time past the hour as a clock shows it", async () => {
    const w = ready();
    screen(w, "main", { "index.html": '<div class="clip" data-start="3725" data-duration="4">Last word</div>' }, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-2), 'On screen in the main video I found "Last word" at 1:02:05. Right?');
    w.t.done();
  });
  it("reads the words of the project, not the captions beside them, an end card, or a composition nothing names", async () => {
    const w = ready();
    screen(w, "main", { ...FIXTURE_MAIN, "compositions/unused.html": '<template><div data-composition-id="unused"><div class="clip" data-start="0" data-duration="2">Never named</div></div></template>' });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    const line = w.t.said().split("\n").at(-2);
    assert.doesNotMatch(line, /Never named|Welcome|The Example/);
    w.t.done();
  });
});

describe("B2. changed, dropped, and said", () => {
  it("takes the lines she gives instead, and drops the one she leaves out", async () => {
    const w = ready();
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Alex Rivera");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [MAIN_LINE, REEL_LINE, 'On screen in the main video, as you said: "Alex Rivera".', START]);
    assert.deepEqual(w.t.started, []);
    plain(r.said);
    w.t.done();
  });
  it("says two as a and b, and three as a, b and c, in her order, whatever was found, and takes a line the reader did not find", async () => {
    const w = ready();
    const two = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Head of Pricing", "--on-screen", "Alex Rivera");
    assert.equal(two.said.at(-2), 'On screen in the main video, as you said: "Head of Pricing" and "Alex Rivera".');
    const three = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Alex Rivera", "--on-screen", "Head of Pricing", "--on-screen", "Something else");
    assert.equal(three.said.at(-2), 'On screen in the main video, as you said: "Alex Rivera", "Head of Pricing" and "Something else".');
    assert.ok(!three.text.includes(FOUND) && !three.text.includes(TAKEN), "the words found are not said when she has said them");
    w.t.done();
  });
  it("starts with them, and writes them as she gave them, a line each with its whitespace collapsed", async () => {
    const w = ready();
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "  Alex   Rivera ", "--on-screen", "Head of\nPricing", "--yes");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [MAIN_LINE, REEL_LINE, 'On screen in the main video, as you said: "Alex Rivera" and "Head of Pricing".', STARTED]);
    assert.deepEqual(w.asked().parts[0].onPicture, ["Alex Rivera", "Head of Pricing"]);
    w.t.done();
  });
  it("says there are none when she says so, starts, and writes an empty list", async () => {
    const w = ready();
    const asked = await on(w.t.ctx.deps, "finish", FOLDER, "--no-on-screen");
    assert.deepEqual(asked.said, [MAIN_LINE, REEL_LINE, "Nothing is on the main video's picture, as you said.", START]);
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--no-on-screen", "--yes");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(w.asked().parts[0].onPicture, []);
    plain(asked.said);
    w.t.done();
  });
  it("takes what she says before what a project holds, in the CLI and as the answers of finishEpisode", async () => {
    const w = ready();
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, onScreen: ["Only this"] }), 0);
    assert.deepEqual(w.asked().parts[0].onPicture, ["Only this"]);
    w.t.done();
    const none = ready();
    assert.equal(await finishEpisode(none.t.ctx, none.found, { yes: true, noOnScreen: true }), 0);
    assert.deepEqual(none.asked().parts[0].onPicture, []);
    none.t.done();
  });
});

describe("B3. nothing found, or no project to look at", () => {
  it("asks when the project holds no words, with a yes too, and starts nothing", async () => {
    const w = ready();
    screen(w, "main", { "index.html": "<html></html>" }, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, NONE_FOUND]);
    const yes = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([yes.code, yes.said.at(-1)], [0, NONE_FOUND]);
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json"))], [[], false]);
    plain([NONE_FOUND]);
    w.t.done();
  });
  it("asks too when the project holds only captions, an end card and a picture", async () => {
    const w = ready();
    const { "index.html": index, "compositions/captions.html": captions, "compositions/end-card.html": end } = FIXTURE_MAIN;
    screen(w, "main", { "index.html": index.replace(/<div[^>]*id="(?:lower-third|title-card|note)"[\s\S]*?(?:><\/div>|<\/div>)\s*(?=<div)/g, ""), "compositions/captions.html": captions, "compositions/end-card.html": end }, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-1), NONE_FOUND);
    w.t.done();
  });
  it("asks when the main video's project is not on this Mac, though its export is", async () => {
    const w = ready();
    rmSync(w.dirOf("main"), { recursive: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    const lines = w.t.said().split("\n");
    assert.equal(lines.at(-1), NOT_HERE);
    assert.deepEqual(w.t.started, []);
    plain([NOT_HERE]);
    w.t.done();
  });
  it("is answered by the words she gives, or by nothing, and then starts", async () => {
    const w = ready();
    screen(w, "main", { "index.html": "<html></html>" }, { only: true });
    const said = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Alex Rivera", "--yes");
    assert.equal(said.code, 0, said.text);
    assert.deepEqual(said.said, [MAIN_LINE, REEL_LINE, 'On screen in the main video, as you said: "Alex Rivera".', STARTED]);
    assert.deepEqual(w.asked().parts[0].onPicture, ["Alex Rivera"]);
    w.t.done();
    const none = ready();
    screen(none, "main", { "index.html": "<html></html>" }, { only: true });
    const nothing = await on(none.t.ctx.deps, "finish", FOLDER, "--no-on-screen", "--yes");
    assert.equal(nothing.code, 0, nothing.text);
    assert.deepEqual(none.asked().parts[0].onPicture, []);
    none.t.done();
  });
});

describe("B4. refused", () => {
  const BOTH = "Say what is on screen, or that nothing is, but not both.";
  const EMPTY = "A line on the screen needs words. Say what it says.";
  it("refuses both flags together, and a line with no words, ending with 1, with nothing started or claimed", async () => {
    const w = ready();
    for (const [argv, why] of [[["--on-screen", "Alex Rivera", "--no-on-screen", "--yes"], BOTH], [["--on-screen", "", "--yes"], EMPTY], [["--on-screen", "   ", "--yes"], EMPTY], [["--on-screen", "Alex Rivera", "--on-screen", "", "--yes"], EMPTY], [["--yes", "--on-screen"], EMPTY]]) {
      const r = await on(w.t.ctx.deps, "finish", FOLDER, ...argv);
      assert.deepEqual([r.code, r.said], [1, [why]], argv.join(" "));
    }
    assert.deepEqual([w.t.started, reread(w.found).rev, Boolean(reread(w.found).editing), existsSync(join(w.work, "finish.asked.json"))], [[], 1, false, false]);
    plain([BOTH, EMPTY]);
    w.t.done();
  });
});

describe("B5. when it is not asked", () => {
  const KEPT = { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { main: { file: "final/m.mp4", bytes: 5, seconds: 11.878, source: { bytes: 5, mtimeMs: 1 }, project: MAIN } } };
  it("says nothing of the words of a main video kept as the last finish made it, and asks nothing", async () => {
    const w = world({ over: { finished: KEPT } });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.deepEqual(w.t.said().split("\n"), ["The main video: kept as the last finish made it.", REEL_LINE, START]);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.kept, p.onPicture]), [["main", true, undefined], ["reel 2", false, undefined]]);
    w.t.done();
  });
  it("takes the words she gives for a kept main video all the same", async () => {
    const w = world({ over: { finished: KEPT } });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, onScreen: ["A new line"] }), 0);
    assert.deepEqual(w.t.said().split("\n"), ["The main video: kept as the last finish made it.", REEL_LINE, 'On screen in the main video, as you said: "A new line".', STARTED]);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.kept, p.onPicture]), [["main", true, ["A new line"]], ["reel 2", false, undefined]]);
    w.t.done();
  });
  it("says nothing of words when the main video has no export, and stops as it did", async () => {
    const w = world();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.doesNotMatch(w.t.said(), /On screen|picture/);
    w.t.done();
  });
  it("says nothing of words, and takes none, for a main video that went the Final Cut way beside a Reel from HyperFrames", async () => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = world({ projects: ["reel 2"], over: { main: { ...EDITED.main, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, onScreen: ["Ignored"] }), 0, w.t.said());
    assert.doesNotMatch(w.t.said(), /On screen|picture/);
    assert.deepEqual(w.asked().parts.map((p) => [p.key, p.onPicture]), [["main", undefined], ["reel 2", undefined]]);
    w.t.done();
  });
  it("says nothing of words, and takes none, on a Mac that hands off version 1, which has no words on the picture", async () => {
    const w = ready({ handoffVersion: 1, over: { title: { text: "Price like you mean it", from: "person", approved: true } } });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { onScreen: ["Ignored"] }), 0);
    assert.deepEqual(w.t.said().split("\n"), [MAIN_LINE, REEL_LINE, START]);
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, noOnScreen: true }), 0);
    assert.equal(w.asked().parts[0].onPicture, undefined);
    w.t.done();
  });
  it("is as it was for an episode with a Reel project and no main project", async () => {
    const w = world({ projects: ["reel 2"] });
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 1);
    assert.doesNotMatch(w.t.said(), /On screen|picture/);
    w.t.done();
  });
});

describe("B7. a yes is to the words she was shown (review I1)", () => {
  // A bare yes takes the words found only when they are the lines the last call that asked "Right?" showed, kept on this Mac's own
  // disk beside what finish was asked (finish.shown.json): the chat cannot hand off words she never saw by adding a yes to its first call.
  const SHOWN = "finish.shown.json";
  const keptOf = (w) => JSON.parse(readFileSync(join(w.work, SHOWN), "utf8"));
  const LAST_WORD = { "index.html": '<div class="clip" data-start="3725" data-duration="4">Last word</div>' };
  const LAST = 'On screen in the main video I found "Last word" at 1:02:05. Right?';
  it("shows the words, and starts nothing, when the first call has a yes and nothing was shown before", async () => {
    const w = ready({ shown: false });
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said], [0, [MAIN_LINE, REEL_LINE, FOUND, START]]);
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json")), reread(w.found).rev, Boolean(reread(w.found).editing)], [[], false, 1, false]);
    assert.deepEqual(keptOf(w).lines, MAIN_WORDS, "what it showed is kept");
    plain(r.said);
    w.t.done();
  });
  it("starts with the next yes, and lets go of what it kept, so that a later finish shows them again", async () => {
    const w = ready({ shown: false });
    await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual(w.t.started, [], "the call that shows them starts nothing");
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said], [0, [MAIN_LINE, REEL_LINE, TAKEN, STARTED]]);
    assert.equal(w.t.started.length, 1);
    assert.deepEqual(w.asked().parts[0].onPicture, MAIN_WORDS);
    assert.equal(existsSync(join(w.work, SHOWN)), false, "a finish that has started does not leave what it was shown");
    w.t.done();
  });
  it("shows them again, and starts nothing, when the project's words changed between the two calls, and then takes the new ones on a yes", async () => {
    const w = ready({ shown: false });
    await on(w.t.ctx.deps, "finish", FOLDER);
    assert.deepEqual(keptOf(w).lines, MAIN_WORDS);
    screen(w, "main", LAST_WORD, { only: true });
    const again = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([again.code, again.said], [0, [MAIN_LINE, REEL_LINE, LAST, START]]);
    assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json"))], [[], false]);
    assert.deepEqual(keptOf(w).lines, ["Last word"], "each call that asks replaces what was kept");
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said], [0, [MAIN_LINE, REEL_LINE, 'On screen in the main video: "Last word" at 1:02:05.', STARTED]]);
    assert.deepEqual(w.asked().parts[0].onPicture, ["Last word"]);
    w.t.done();
  });
  it("shows them again when they are the same lines in another order, or the same lines and one more", async () => {
    const w = ready({ shown: false });
    for (const lines of [[...MAIN_WORDS].reverse(), [...MAIN_WORDS, "One more"], [MAIN_WORDS[0]], []]) {
      writeFileSync(join(w.work, SHOWN), JSON.stringify({ version: 1, lines }));
      const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
      assert.deepEqual([r.code, r.said.at(-2), w.t.started], [0, FOUND, []], JSON.stringify(lines));
    }
    w.t.done();
  });
  it("takes nothing in the file for shown when it is not a list of lines", async () => {
    const w = ready({ shown: false });
    for (const text of ["", "not json", "null", "[]", "{}", '{"lines":"Alex Rivera"}', JSON.stringify({ lines: [1, 2] }), JSON.stringify({ lines: [["Alex Rivera"], "Head of Pricing"] }), JSON.stringify({ lines: { 0: "Alex Rivera", 1: "Head of Pricing", length: 2 } })]) {
      writeFileSync(join(w.work, SHOWN), text);
      const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
      assert.deepEqual([r.code, r.said.at(-2), w.t.started], [0, FOUND, []], text);
    }
    // A folder where the file goes does not stop it from asking either.
    rmSync(join(w.work, SHOWN), { recursive: true, force: true });
    mkdirSync(join(w.work, SHOWN));
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said.at(-2), w.t.started], [0, FOUND, []]);
    w.t.done();
  });
  it("needs nothing shown for the lines she gives, or for nothing on screen, and lets go of what it kept when it starts", async () => {
    const w = ready({ shown: false });
    await on(w.t.ctx.deps, "finish", FOLDER);
    const gave = await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Her words", "--yes");
    assert.deepEqual([gave.code, gave.said], [0, [MAIN_LINE, REEL_LINE, 'On screen in the main video, as you said: "Her words".', STARTED]]);
    assert.equal(existsSync(join(w.work, SHOWN)), false);
    w.t.done();
    const none = ready({ shown: false });
    const r = await on(none.t.ctx.deps, "finish", FOLDER, "--no-on-screen", "--yes");
    assert.deepEqual([r.code, r.said], [0, [MAIN_LINE, REEL_LINE, "Nothing is on the main video's picture, as you said.", STARTED]]);
    assert.deepEqual(none.asked().parts[0].onPicture, []);
    none.t.done();
  });
  it("keeps nothing when what it says is the lines she gave, a main video kept as the last finish made it, or no words found", async () => {
    const w = ready({ shown: false });
    await on(w.t.ctx.deps, "finish", FOLDER, "--on-screen", "Her words");
    await on(w.t.ctx.deps, "finish", FOLDER, "--no-on-screen");
    assert.equal(existsSync(join(w.work, SHOWN)), false, "the lines she gave are not kept as shown");
    screen(w, "main", { "index.html": "<html></html>" }, { only: true });
    await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(existsSync(join(w.work, SHOWN)), false, "nothing found is shown as nothing");
    w.t.done();
  });
  it("starts a kept main video's finish with a yes alone, as it did, there being no words to show", async () => {
    const KEPT = { revision: 1, at: "2026-10-20T14:10:00-05:00", on: "Mac Studio", handoff: "final/x.brimm-ops.json", parts: { main: { file: "final/m.mp4", bytes: 5, seconds: 11.878, source: { bytes: 5, mtimeMs: 1 }, project: MAIN } } };
    const w = world({ shown: false, over: { finished: KEPT } });
    exportOf(w, "reel 2");
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.said], [0, ["The main video: kept as the last finish made it.", REEL_LINE, STARTED]]);
    w.t.done();
  });
  it("keeps the words it showed also when a Reel's title is asked in the same call", async () => {
    const w = ready({ shown: false, over: { reels: reelsWith("") } });
    const first = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(first.code, 0);
    assert.ok(first.said.includes(FOUND), first.text);
    assert.ok(first.said.some((line) => line.startsWith("Reel 2 has no title on screen")), first.text);
    assert.deepEqual(w.t.started, []);
    assert.deepEqual(keptOf(w).lines, MAIN_WORDS);
    w.t.done();
  });
  it("says what it shows with no path, flag or command name", async () => {
    const w = ready({ shown: false });
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    plain(r.said);
    assert.doesNotMatch(r.text, /shown|\.json/);
    w.t.done();
  });
});

describe("C1. a Reel's title, proposed from what its picture holds", () => {
  it("names the first line the Reel's picture holds, and still asks", async () => {
    const w = ready({ over: { reels: reelsWith("") } });
    screen(w, "reel 2", REEL_FILES, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    const lines = w.t.said().split("\n");
    assert.equal(lines.at(-1), `Reel 2 has no title on screen. On screen in it I found "Mistake one" at 0:00. Is that its title? If not, say what it says: it starts "${REEL2_OPENING}".`);
    assert.deepEqual(w.t.started, []);
    assert.ok(!lines.join("\n").includes("Welcome to the show"), "the Reel's captions are never proposed");
    plain(lines);
    w.t.done();
  });
  it("proposes the first line by time, whatever the order of the file", async () => {
    const w = ready({ over: { reels: reelsWith("") } });
    screen(w, "reel 2", { "index.html": '<div class="clip" data-start="9" data-duration="2">Later</div><div class="clip" data-start="2.5" data-duration="2">Earlier</div>' }, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.match(w.t.said().split("\n").at(-1), /^Reel 2 has no title on screen\. On screen in it I found "Earlier" at 0:03\. Is that its title\?/);
    w.t.done();
  });
  it("names no opening when the Reel was made from times she gave, and still names the proposal", async () => {
    const w = ready({ over: { reels: reelsWith(""), app: { toolchain: PIN.version, projects: [entry("main"), entry("reel 2", { fromSuggestion: null })] } } });
    screen(w, "reel 2", REEL_FILES, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-1), 'Reel 2 has no title on screen. On screen in it I found "Mistake one" at 0:00. Is that its title? If not, say what it says.');
    w.t.done();
  });
  it("is confirmed the way any title is given, and then finish starts without asking again", async () => {
    const w = ready({ over: { reels: reelsWith("") } });
    screen(w, "reel 2", REEL_FILES, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0);
    assert.deepEqual(w.t.started, []);
    const titled = await on(w.t.ctx.deps, "title", FOLDER, "reel", "2", "--words", "Mistake one");
    assert.equal(titled.code, 0, titled.text);
    assert.equal(reread(w.found).reels[1].title, "Mistake one");
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(r.code, 0, r.text);
    assert.equal(w.t.started.length, 1);
    assert.doesNotMatch(r.text, /has no title/);
    w.t.done();
  });
});

describe("C2. a Reel's title that is not proposed", () => {
  it("asks as it did when the Reel's picture holds no words, or only captions", async () => {
    const w = ready({ over: { reels: reelsWith("") } });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-1), `Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`);
    w.t.done();
    const captions = ready({ over: { reels: reelsWith("") } });
    screen(captions, "reel 2", { "index.html": REEL_FILES["index.html"].replace(/<div[^>]*id="title"[^>]*><\/div>/, ""), "compositions/captions.html": REEL_FILES["compositions/captions.html"] }, { only: true });
    assert.equal(await finishEpisode(captions.t.ctx, captions.found, {}), 0);
    assert.equal(captions.t.said().split("\n").at(-1), `Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`);
    captions.t.done();
  });
  it("asks as it did when the Reel's project is not on this Mac, or its first line has more than 12 words", async () => {
    const w = ready({ over: { reels: reelsWith("") } });
    rmSync(w.dirOf("reel 2"), { recursive: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.equal(w.t.said().split("\n").at(-1), `Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`);
    w.t.done();
    const long = ready({ over: { reels: reelsWith("") } });
    screen(long, "reel 2", { "index.html": '<div class="clip" data-start="1" data-duration="2">one two three four five six seven eight nine ten eleven twelve thirteen</div>' }, { only: true });
    assert.equal(await finishEpisode(long.t.ctx, long.found, {}), 0);
    assert.equal(long.t.said().split("\n").at(-1), `Reel 2 has no title on screen. Say what it says: it starts "${REEL2_OPENING}".`);
    const twelve = ready({ over: { reels: reelsWith("") } });
    screen(twelve, "reel 2", { "index.html": '<div class="clip" data-start="1" data-duration="2">one two three four five six seven eight nine ten eleven twelve</div>' }, { only: true });
    assert.equal(await finishEpisode(twelve.t.ctx, twelve.found, {}), 0);
    assert.match(twelve.t.said().split("\n").at(-1), /^Reel 2 has no title on screen\. On screen in it I found "one two three four five six seven eight nine ten eleven twelve" at 0:01\./);
    w.t.done();
    long.t.done();
    twelve.t.done();
  });
  it("does not ask, or propose, for a Reel that has a title", async () => {
    const w = ready();
    screen(w, "reel 2", REEL_FILES, { only: true });
    assert.equal(await finishEpisode(w.t.ctx, w.found, {}), 0);
    assert.doesNotMatch(w.t.said(), /Mistake one|has no title/);
    w.t.done();
  });
});

describe("C3. the lines she is read", () => {
  it("holds no path, no flag and no command name, whichever way it ends", async () => {
    const lines = [];
    for (const argv of [[], ["--yes"], ["--on-screen", "Alex Rivera"], ["--on-screen", "Alex Rivera", "--on-screen", "Head of Pricing", "--yes"], ["--no-on-screen"], ["--no-on-screen", "--on-screen", "x"], ["--on-screen", ""]]) {
      const w = ready({ over: { reels: reelsWith("") } });
      screen(w, "reel 2", REEL_FILES, { only: true });
      lines.push(...(await on(w.t.ctx.deps, "finish", FOLDER, ...argv)).said);
      w.t.done();
    }
    const gone = ready();
    screen(gone, "main", { "index.html": "<html></html>" }, { only: true });
    lines.push(...(await on(gone.t.ctx.deps, "finish", FOLDER)).said);
    gone.t.done();
    assert.ok(lines.length > 15);
    plain(lines);
  });
});
