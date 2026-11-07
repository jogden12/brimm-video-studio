// `plan`: the planned episode from Sallie's chat (PR H4; design 2026-11-03, sections 5 and 6). `plan new "<title>"` files an episode with no footage in
// Episodes; `plan "<planned>" set …` replaces its whole package (a video guide of graphic cues, a shot list and a teleprompter script) in one record
// write; `plan "<planned>"` says it in plain words; `plan "<planned>" drop` archives it. edit.js is only the wiring here (plan.js is the module).
// Every file goes into Dropbox by the rule (the clone stand-in of tests/episodes.js refuses to write over a file, so a test fails if one is), and
// the record last. A planned episode in Episodes breaks no other command, listing or run: the second half of this file proves it. No test runs a
// real program: the programs are stand-ins (tests/episodes.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { UNSCOPED } from "../gate.js";
import { newPlannedEpisode, readEpisode, recordFile, localStamp } from "../episode.js";
import { holdingEpisode } from "../filing.js";
import { fileSafe } from "../names.js";
import { referencesFolder, runsFolder } from "../settings.js";
import { freeEpisode } from "../free.js";
import { matchVersion } from "../versions.js";
import { uneditedFolder } from "../unedited.js";
import { noProgress } from "../progress.js";
import { localDay } from "../shared/text.js";
import { guardDecision } from "../studio.js";
import { CHECKOUT, EDIT, NODE } from "./guard-cases.js";
import { probed, TOLD, SRT, PAUSES } from "./fixtures.js";
import { setup, episodeAs, episodeFor, listAll, FOLDER, NAME } from "./episodes.js";
import { episode } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** The deps every command here is run with: the made-up Mac's, with an id that is the same every time (400000). */
const depsOf = (t, over = {}) => ({ ...t.ctx.deps, rand: () => 0.25, ...over });
/** This Mac on the light import, as the guide needs it. */
const light = (t, over = {}) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, ...over });

const TITLE = "Too many SKUs";
const SHORT = "400000";
/** The day and the moment the made-up Mac's clock stands at, as the record keeps them. */
const dayOf = (t) => localDay(new Date(t.now()));
const atOf = (t) => localStamp(new Date(t.now()));
const nameOf = (t, title = TITLE) => `${dayOf(t)} ${fileSafe(title)} (Mac Studio)`;
const folderOf = (t, title = TITLE) => join(t.root, "Episodes", nameOf(t, title));
const recordOf = (t, title = TITLE) => readEpisode(folderOf(t, title)).record;
const WRITER = { commit: "c709b57", on: "Mac Studio" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayText = (t) => `${new Date(t.now()).getDate()} ${MONTHS[new Date(t.now()).getMonth()]}`;

/** What she is told holds no path, no flag and no command: the one rule of the words of this command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|\bplan (?:new|set)\b/;
const isPlain = (line) => !PLAIN.test(line);

const NOT_PLANNED_YET = `"${TITLE}" is a planned video, and it isn't made from its footage yet.`;
const TO_DROP = `To drop a plan, say "drop the plan for ${TITLE}".`;
const NOT_SAVED = "Nothing was saved.";

/** A planned script made on this Mac, in a world of its own. */
async function planned(t, title = TITLE, ...flags) {
  const r = await on(depsOf(t), "plan", "new", title, ...flags);
  assert.equal(r.code, 0, r.text);
  return folderOf(t, title);
}

describe("plan new", () => {
  it("files a planned episode in Episodes by the import's rule for a folder's name, with only its first record, and says what comes next", async () => {
    const t = setup();
    const r = await on(depsOf(t), "plan", "new", TITLE);
    assert.deepEqual([r.code, r.said], [0, [`"Too many SKUs" is planned. Next: its guide, its shot list and its teleprompter script.`]]);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")), [nameOf(t)]);
    assert.deepEqual(listAll(folderOf(t)), ["record/0001.json"]);
    assert.deepEqual(readEpisode(folderOf(t)).record, {
      ...newPlannedEpisode({ id: `e-${dayOf(t).replaceAll("-", "")}-${SHORT}`, machine: "Mac Studio", at: atOf(t), title: TITLE, route: "script", voice: null, writer: WRITER }),
      rev: 1
    });
    t.done();
  });
  it("puts the record in by the rule: made in this Mac's own folder, cloned in under its name, and the folder it was made in is taken away", async () => {
    const t = setup();
    await planned(t);
    assert.deepEqual(t.clones.map(([from, to]) => [dirname(from).startsWith(runsFolder(t.home)), to]), [[true, recordFile(folderOf(t), 1)]]);
    assert.deepEqual(existsSync(runsFolder(t.home)) ? readdirSync(runsFolder(t.home)).filter((n) => n.startsWith("plan-")) : [], []);
    t.done();
  });
  it("files an explainer, with its voice when she names one: Sallie's own or a HeyGen voice she picks in HyperFrames", async () => {
    for (const [flags, voice, next] of [[["--explainer"], null, "Next: its guide and its teleprompter script."], [["--explainer", "--voice", "sallie"], "sallie", "Next: its guide and its teleprompter script."], [["--explainer", "--voice", "heygen"], "heygen", "Next: its guide and its teleprompter script."]]) {
      const t = setup();
      const r = await on(depsOf(t), "plan", "new", "Why SKUs", ...flags);
      assert.deepEqual([r.code, r.said], [0, [`"Why SKUs" is planned. ${next}`]], flags.join(" "));
      const { planned: plan } = recordOf(t, "Why SKUs");
      assert.deepEqual([plan.route, plan.voice, plan.shots, plan.cues, plan.lines], ["explainer", voice, [], [], []], flags.join(" "));
      t.done();
    }
  });
  it("refuses a voice without --explainer, and a voice that is neither, writing nothing", async () => {
    const t = setup();
    for (const [words, why] of [[["--voice", "sallie"], "A voice is only for an explainer."], [["--voice", "heygen"], "A voice is only for an explainer."], [["--voice", "robot"], "A voice is only for an explainer."], [["--explainer", "--voice", "robot"], `A voice is Sallie's own ("sallie") or a HeyGen voice ("heygen").`], [["--explainer", "--voice"], `A voice is Sallie's own ("sallie") or a HeyGen voice ("heygen").`]]) {
      const r = await on(depsOf(t), "plan", "new", TITLE, ...words);
      assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
    }
    assert.deepEqual(existsSync(join(t.root, "Episodes")) ? readdirSync(join(t.root, "Episodes")) : [], []);
    t.done();
  });
  it("refuses a title already planned and not yet filmed, in any case and spacing, and writes nothing", async () => {
    const t = setup();
    await planned(t);
    for (const again of [TITLE, "too many skus", "  Too   many SKUs  "]) {
      const r = await on(depsOf(t), "plan", "new", again);
      assert.deepEqual([r.code, r.said], [1, [`There's a planned video called "Too many SKUs" already. Say "show me the plan for Too many SKUs".`]], again);
    }
    assert.deepEqual(readdirSync(join(t.root, "Episodes")), [nameOf(t)]);
    assert.deepEqual(listAll(folderOf(t)), ["record/0001.json"]);
    t.done();
  });
  it("lets a title be planned again once its plan is dropped, in a folder of its own", async () => {
    const t = setup();
    await planned(t);
    assert.equal((await on(depsOf(t), "plan", TITLE, "drop")).code, 0);
    const again = await on(depsOf(t, { rand: () => 0.5 }), "plan", "new", TITLE);
    assert.deepEqual([again.code, again.said], [0, [`"Too many SKUs" is planned. Next: its guide, its shot list and its teleprompter script.`]]);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")).sort(), [nameOf(t), `${nameOf(t)}-2`]);
    // The title now means the new plan, not the dropped one beside it.
    assert.deepEqual((await on(depsOf(t), "plan", TITLE)).said, [`"Too many SKUs" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]);
    assert.equal(readEpisode(join(t.root, "Episodes", `${nameOf(t)}-2`)).record.archived, null);
    t.done();
  });
  it("is the help, with 2, when it is given no title, and writes nothing", async () => {
    const t = setup();
    for (const words of [[], ["new"], ["new", ""], ["new", "   "], ["new", "A", "B"], ["new", "A", "--zzz"], ["new", "A", "--cue", "x"], ["new", "A", "--explainer", "--shot", "x"]]) {
      const r = await on(depsOf(t), "plan", ...words);
      assert.equal(r.code, 2, words.join(" "));
      assert.equal(r.said.join("\n"), HELP, words.join(" "));
    }
    assert.deepEqual(existsSync(join(t.root, "Episodes")) ? readdirSync(join(t.root, "Episodes")) : [], []);
    t.done();
  });
  it("turns %24 and %22 and the rest in a title, and names the folder for it by the rule's file-safe form", async () => {
    const t = setup();
    const title = `Make $10k "fast" | 100%`;
    const r = await on(depsOf(t), "plan", "new", "Make %2410k %22fast%22 %7C 100%25");
    assert.deepEqual([r.code, r.said], [0, [`"${title}" is planned. Next: its guide, its shot list and its teleprompter script.`]]);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")), [`${dayOf(t)} Make $10k -fast- - 100% (Mac Studio)`]);
    const { record } = readEpisode(join(t.root, "Episodes", `${dayOf(t)} Make $10k -fast- - 100% (Mac Studio)`));
    assert.deepEqual([record.name.text, record.planned.title], [title, title]);
    t.done();
  });
  it("takes the folder it made away again when the record cannot be written, and leaves every other episode as it was", async () => {
    const t = setup();
    await planned(t, "Why SKUs");
    const before = bytesIn(join(t.root, "Episodes"));
    const r = await on(depsOf(t, { clone: () => { throw new Error("the disk is full"); } }), "plan", "new", TITLE);
    assert.deepEqual([r.code, r.said], [1, ["Nothing was saved: it could not be written (an error)."]]);
    assert.deepEqual(bytesIn(join(t.root, "Episodes")), before);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")), [nameOf(t, "Why SKUs")]);
    t.done();
  });
  it("takes a title of 80 characters, and refuses one of 81", async () => {
    const t = setup();
    const ok = await on(depsOf(t), "plan", "new", "a".repeat(80));
    assert.equal(ok.code, 0, ok.text);
    const long = await on(depsOf(t), "plan", "new", "b".repeat(81));
    assert.deepEqual([long.code, long.said], [1, ["A title is at most 80 characters, and that is 81."]]);
    // A title is counted after its escapes are turned, in characters.
    assert.equal((await on(depsOf(t), "plan", "new", "%24".repeat(80))).code, 0);
    assert.equal((await on(depsOf(t), "plan", "new", "🙂".repeat(81))).code, 1);
    assert.equal(readdirSync(join(t.root, "Episodes")).length, 2);
    t.done();
  });
  it("is named by the string it was made with when its title holds a code: shown, set, left alone and dropped by it", async () => {
    const t = setup();
    const made = "Make %2410k %22fast%22 %7C 100%25";
    const title = `Make $10k "fast" | 100%`;
    assert.equal((await on(depsOf(t), "plan", "new", made)).code, 0);
    const folder = join(t.root, "Episodes", `${dayOf(t)} Make $10k -fast- - 100% (Mac Studio)`);
    const shown = await on(depsOf(t), "plan", made);
    assert.deepEqual([shown.code, shown.said], [0, [`"${title}" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]]);
    const saved = await on(depsOf(t), "plan", made, "set", "--line", "Make %2410k.");
    assert.equal(saved.code, 0, saved.text);
    assert.deepEqual([readEpisode(folder).record.rev, readEpisode(folder).record.planned.lines], [2, ["Make $10k."]]);
    // Told to leave it, it says how a plan is dropped, as it does for a title with no code, and writes nothing.
    const left = await on(depsOf(t), "leave", made);
    assert.deepEqual([left.code, left.said], [1, [`To drop a plan, say "drop the plan for ${title}".`]]);
    assert.equal(readEpisode(folder).record.rev, 2);
    const dropped = await on(depsOf(t), "plan", made, "drop");
    assert.deepEqual([dropped.code, dropped.said], [0, [`The plan for "${title}" is dropped.`]]);
    assert.deepEqual([readEpisode(folder).record.rev, readEpisode(folder).record.archived], [3, { at: atOf(t) }]);
    // Asked for again by the same string, it is the plan that was dropped: found, as a dropped plan is by a title with no code.
    const again = await on(depsOf(t), "plan", made);
    assert.deepEqual([again.code, again.said], [1, [`The plan for "${title}" was dropped.`]]);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")), [`${dayOf(t)} Make $10k -fast- - 100% (Mac Studio)`]);
    t.done();
  });
  it("tries the word as given before its codes turned, and looks a word with no code up as it always did", async () => {
    const t = setup();
    // %2524 is the text "%24": a plan whose title is a code written out, and a plan whose title is a dollar sign.
    assert.equal((await on(depsOf(t), "plan", "new", "Pay %252410k")).code, 0);
    assert.equal((await on(depsOf(t), "plan", "new", "Pay %2410k")).code, 0);
    assert.deepEqual(readdirSync(join(t.root, "Episodes")).sort(), [`${dayOf(t)} Pay $10k (Mac Studio)`, `${dayOf(t)} Pay %2410k (Mac Studio)`]);
    const shownAs = async (word) => (await on(depsOf(t), "plan", word)).said;
    // As given, "Pay %2410k" is the title of the first. Its codes turned, "Pay $10k", it would be the second: the word as given comes first.
    assert.deepEqual(await shownAs("Pay %2410k"), [`"Pay %2410k" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]);
    assert.deepEqual(await shownAs("Pay %252410k"), [`"Pay %2410k" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]);
    // A word with no code is found as it was found: by its whole title, and by its words.
    assert.deepEqual(await shownAs("Pay $10k"), [`"Pay $10k" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]);
    assert.equal((await on(depsOf(t), "plan", "new", "Is 100% sure")).code, 0);
    for (const word of ["Is 100% sure", "is   100% SURE", "100% sure"]) assert.deepEqual(await shownAs(word), [`"Is 100% sure" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`], word);
    // A word that fits no episode, with a code in it or not, says so as it was given.
    for (const word of ["nothing like it", "nothing %24 like it", "%7C"]) {
      const none = await on(depsOf(t), "plan", word);
      assert.equal(none.code, 1, word);
      assert.match(none.text, new RegExp(`^No episode fits "${word}"\\. The episodes are: `), word);
    }
    t.done();
  });
  it("turns the codes of a word only to find a plan: a word that fits an ordinary video once they are turned fits none, in plan and in leave", async () => {
    const t = setup();
    episodeAs(t, { id: "e-20261022-c0c0c0", name: "2026-10-22 100% sure (Mac Studio)", record: { name: { text: "100% sure", placeholder: false } } });
    const bytes = bytesIn(join(t.root, "Episodes"));
    for (const words of [["plan", "100%25 sure"], ["plan", "100%25 sure", "drop"], ["plan", "100%25 sure", "set", "--line", "x"], ["leave", "100%25 sure"]]) {
      const r = await on(depsOf(t), ...words);
      assert.deepEqual([r.code, r.said], [1, [`No episode fits "100%25 sure". The episodes are: 2026-10-22 100% sure (Mac Studio).`]], words.join(" "));
    }
    // Said as it is, with no code, it is that video, as it always was.
    assert.deepEqual((await on(depsOf(t), "plan", "100% sure")).said, [`"100% sure" is not a planned video.`]);
    assert.deepEqual(bytesIn(join(t.root, "Episodes")), bytes);
    t.done();
  });
  it("says nothing she reads with a path, a flag or the name of a command in it", async () => {
    const t = setup();
    const lines = [(await on(depsOf(t), "plan", "new", TITLE)).said, (await on(depsOf(t), "plan", "new", TITLE)).said, (await on(depsOf(t), "plan", "new", "Why", "--explainer")).said, (await on(depsOf(t), "plan", "new", "X", "--voice", "sallie")).said].flat();
    assert.ok(lines.length >= 4);
    for (const line of lines) assert.ok(isPlain(line), line);
    t.done();
  });
});

describe("plan … drop and leave", () => {
  it("drops a plan: it is archived as an episode is, and episodes and the guide no longer show it", async () => {
    const t = setup();
    const folder = await planned(t);
    assert.match((await on(light(t), "episodes")).text, new RegExp(`"Too many SKUs": planned on`));
    assert.match((await on(light(t), "guide")).text, /Too many SKUs \(400000\): Film it/);
    const r = await on(light(t), "plan", TITLE, "drop");
    assert.deepEqual([r.code, r.said], [0, [`The plan for "Too many SKUs" is dropped.`]]);
    const { record } = readEpisode(folder);
    assert.deepEqual([record.rev, record.archived, listAll(folder)], [2, { at: atOf(t) }, ["record/0001.json", "record/0002.json"]]);
    assert.equal((await on(light(t), "episodes")).said[0], "No episodes yet.");
    assert.doesNotMatch((await on(light(t), "episodes")).text, /Too many SKUs/);
    assert.deepEqual((await on(light(t), "guide")).said.slice(1), ["Nothing is under way. To start, put the video in your drop folder."]);
    t.done();
  });
  it("says a plan was dropped when it is asked for again, or dropped again, and changes nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    await on(depsOf(t), "plan", TITLE, "drop");
    for (const words of [[TITLE], [TITLE, "drop"], [TITLE, "set", "--line", "x"]]) {
      const r = await on(depsOf(t), "plan", ...words);
      assert.deepEqual([r.code, r.said], [1, [`The plan for "Too many SKUs" was dropped.`]], words.join(" "));
    }
    assert.deepEqual(listAll(folder), ["record/0001.json", "record/0002.json"]);
    t.done();
  });
  it("leaves a plan alone when it is told to leave it, ends with 1 and says how to drop it, writing nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    const r = await on(depsOf(t), "leave", TITLE);
    assert.deepEqual([r.code, r.said], [1, [TO_DROP]]);
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    assert.equal(readEpisode(folder).record.answer.state, "planned");
    t.done();
  });
  it("is the help, with 2, with a word it does not know after the plan's name", async () => {
    const t = setup();
    await planned(t);
    for (const words of [[TITLE, "drop", "now"], [TITLE, "drop", "--zzz"], [TITLE, "remove"], [TITLE, "show"], [TITLE, "set"], [TITLE, "set", "--zzz", "x"], [TITLE, "--line", "x"]]) assert.equal((await on(depsOf(t), "plan", ...words)).code, 2, words.join(" "));
    t.done();
  });
});

/** A package: three cues (a graphic, words in a style, b-roll that shows a shot), two shots and two lines; or, with no picture to look up, the same
    with the style left out of the second cue. */
const packageArgs = (style = true) => [
  "--cue", "graphic | 4 | too many SKUs | A stack of product boxes that keeps growing until it topples.",
  "--cue", `words | 2 | every one | The words EVERY ONE${style ? " | ref: blue carousel" : ""}`,
  "--cue", "b-roll | 3 | sorting invoices | Her hands on the pile | shot: 2",
  "--shot", "talking | Open on the problem, to the camera.",
  "--shot", "b-roll | Sallie at her desk sorting invoices.",
  "--line", "Too many SKUs will sink a small shop.",
  "--line", "Here is why."
];
const PACKAGE = packageArgs();
const set = (t, ...args) => on(depsOf(t), "plan", TITLE, "set", ...args);
/** The reference folder, holding two pictures. */
function references(t) {
  mkdirSync(referencesFolder(t.root), { recursive: true });
  for (const name of ["blue carousel.png", "quote card.jpg"]) writeFileSync(join(referencesFolder(t.root), name), name);
}
/** Every file under a folder with its bytes: what a command left there. */
function bytesIn(folder) {
  return Object.fromEntries(listAll(folder).map((rel) => [rel, readFileSync(join(folder, rel), "utf8")]));
}
/** Every file of a folder with its size, its time and what it holds, and the folder's own time: what "unchanged" means. */
function snapshotOf(folder) {
  return Object.fromEntries([["/", [statSync(folder).mtimeMs]], ...listAll(folder).map((rel) => [rel, [statSync(join(folder, rel)).size, statSync(join(folder, rel)).mtimeMs, readFileSync(join(folder, rel), "utf8")]])]);
}
/** Make a folder and everything in it read-only while `work` runs, so that a write into it fails where it is tried, and give it back after. */
async function readOnly(folder, work) {
  const all = [folder, ...listAll(folder).map((rel) => join(folder, rel))];
  for (const path of [...all].reverse()) chmodSync(path, statSync(path).isDirectory() ? 0o555 : 0o444);
  try {
    return await work();
  } finally {
    for (const path of all) chmodSync(path, statSync(path).isDirectory() ? 0o755 : 0o644);
  }
}

describe("plan … set", () => {
  it("replaces the whole package in one record write, and puts its three files in the plan's folder by the rule", async () => {
    const t = setup();
    const folder = await planned(t);
    references(t);
    t.clones.length = 0;
    const r = await set(t, ...PACKAGE);
    assert.deepEqual([r.code, r.said], [0, [`The plan for "Too many SKUs" is saved: 3 graphic cues, 2 shots and a teleprompter script of 11 words, about 1 minute. Its files are in its folder in Episodes.`]]);
    assert.deepEqual(listAll(folder), ["record/0001.json", "record/0002.json", "shot list.md", "teleprompter.txt", "video guide.md"]);
    // The files, made in a folder of this Mac's own and cloned in; the record last.
    assert.deepEqual(t.clones.map(([, to]) => basename(to)), ["video guide.md", "shot list.md", "teleprompter.txt", "0002.json"]);
    assert.ok(t.clones.every(([from]) => dirname(from).startsWith(runsFolder(t.home))));
    t.done();
  });
  it("makes the three files exactly: the video guide, the shot list and the teleprompter script", async () => {
    const t = setup();
    const folder = await planned(t);
    references(t);
    await set(t, ...PACKAGE);
    assert.equal(readFileSync(join(folder, "video guide.md"), "utf8"), [
      "# Too many SKUs: the video guide",
      "",
      '1. A graphic for 4 seconds, on "too many SKUs": A stack of product boxes that keeps growing until it topples.',
      '2. Words on screen for 2 seconds, on "every one": The words EVERY ONE. Style: blue carousel.png.',
      '3. B-roll for 3 seconds, on "sorting invoices": Her hands on the pile. From shot 2.',
      ""
    ].join("\n"));
    assert.equal(readFileSync(join(folder, "shot list.md"), "utf8"), [
      "# Too many SKUs: the shot list",
      "",
      "1. Talking to the camera: Open on the problem, to the camera.",
      "2. B-roll: Sallie at her desk sorting invoices. For cue 3.",
      ""
    ].join("\n"));
    assert.equal(readFileSync(join(folder, "teleprompter.txt"), "utf8"), "Too many SKUs will sink a small shop.\n\nHere is why.\n");
    t.done();
  });
  it("holds the package in the record, with the files' sizes, and the moment it was set", async () => {
    const t = setup();
    const folder = await planned(t);
    references(t);
    await set(t, ...PACKAGE);
    const record = readEpisode(folder).record;
    assert.deepEqual(record.planned.cues, [
      { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of product boxes that keeps growing until it topples.", seconds: 4, style: null },
      { n: 2, words: "every one", kind: "words", show: "The words EVERY ONE", seconds: 2, style: { ref: "blue carousel.png" } },
      { n: 3, words: "sorting invoices", kind: "b-roll", show: "Her hands on the pile", seconds: 3, style: null, shot: 2 }
    ]);
    assert.deepEqual(record.planned.shots, [{ n: 1, kind: "talking", what: "Open on the problem, to the camera." }, { n: 2, kind: "b-roll", what: "Sallie at her desk sorting invoices." }]);
    assert.deepEqual(record.planned.lines, ["Too many SKUs will sink a small shop.", "Here is why."]);
    assert.equal(record.planned.set, atOf(t));
    const sizes = Object.fromEntries(["video guide.md", "shot list.md", "teleprompter.txt"].map((name) => [name, statSync(join(folder, name)).size]));
    assert.deepEqual(record.files, sizes);
    assert.deepEqual([record.rev, record.version, record.answer.state, record.video], [2, 5, "planned", null]);
    t.done();
  });
  it("replaces the package at a second set: the files are replaced, none is written over, and no other file of the folder is touched", async () => {
    const t = setup();
    const folder = await planned(t);
    writeFileSync(join(folder, "notes.txt"), "her notes");
    await set(t, ...packageArgs(false));
    const before = bytesIn(folder);
    const r = await set(t, "--cue", "graphic | 5 | the end | A closing card.", "--line", "Only this.");
    assert.deepEqual([r.code, r.said], [0, [`The plan for "Too many SKUs" is saved: 1 graphic cue, 0 shots and a teleprompter script of 2 words, about 1 minute. Its files are in its folder in Episodes.`]]);
    const after = bytesIn(folder);
    assert.equal(after["teleprompter.txt"], "Only this.\n");
    assert.equal(after["video guide.md"], "# Too many SKUs: the video guide\n\n1. A graphic for 5 seconds, on \"the end\": A closing card.\n");
    assert.equal(after["shot list.md"], "# Too many SKUs: the shot list\n");
    assert.equal(after["notes.txt"], "her notes");
    assert.equal(before["record/0001.json"], after["record/0001.json"]);
    assert.equal(before["record/0002.json"], after["record/0002.json"], "a record once written is not written into");
    const record = readEpisode(folder).record;
    assert.deepEqual([record.rev, record.planned.cues.length, record.planned.shots, record.planned.lines], [3, 1, [], ["Only this."]]);
    assert.deepEqual(Object.keys(record.files).sort(), ["shot list.md", "teleprompter.txt", "video guide.md"]);
    t.done();
  });
  it("writes the record with the rev it was read at, and none at all when the other Mac wrote meanwhile or any entry fails", async () => {
    // The other Mac writes record 2 as this Mac puts its files in: the record this Mac writes last is refused, and says so.
    const t = setup();
    const folder = await planned(t);
    const clone = t.ctx.deps.clone;
    let seen = 0;
    const racing = (from, to) => {
      clone(from, to);
      if (basename(to) === "teleprompter.txt" && !seen++) writeFileSync(recordFile(folder, 2), JSON.stringify({ ...readEpisode(folder).record, rev: 2 }));
    };
    const r = await on(depsOf(t, { clone: racing }), "plan", TITLE, "set", "--line", "One.");
    assert.deepEqual([r.code, r.said], [1, ["Nothing was saved: this plan changed on the other Mac: say it again."]]);
    assert.deepEqual(readdirSync(join(folder, "record")), ["0001.json", "0002.json"], "the record it would have written is not there");
    t.done();
  });
  it("says a conflicted copy kept meanwhile as she sees it: one full stop, and what she can say", async () => {
    const t = setup();
    const folder = await planned(t);
    const clone = t.ctx.deps.clone;
    let seen = 0;
    const racing = (from, to) => {
      clone(from, to);
      if (basename(to) === "teleprompter.txt" && !seen++) writeFileSync(join(folder, "record", "0001 (Sallie's conflicted copy 2026-10-20).json"), "{}");
    };
    const r = await on(depsOf(t, { clone: racing }), "plan", TITLE, "set", "--line", "One.");
    assert.deepEqual([r.code, r.said], [1, ['Nothing was saved: Dropbox has kept a conflicted copy of it: say "sort out the conflict".']]);
    t.done();
  });
  it("writes no record, and no file, when any entry fails: each problem is said on its own line, then that nothing was saved, with 1", async () => {
    const t = setup();
    const folder = await planned(t);
    const r = await set(t, "--cue", "graphic | 4 | ok | Fine.", "--cue", "podcast | 4 | w | S.", "--cue", "graphic | 4", "--shot", "drone | Up high.", "--line", "Fine.", "--line", "");
    assert.deepEqual([r.code, r.said], [1, [
      `Cue 2 can't be used: "podcast" is not a kind of cue: use graphic, words, b-roll or screen.`,
      `Cue 3 can't be used: it needs four parts: its kind, its seconds, its words and what it shows.`,
      `Shot 1 can't be used: "drone" is not a kind of shot: use talking, screen or b-roll.`,
      `Line 2 can't be used: it is empty.`,
      NOT_SAVED
    ]]);
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    assert.deepEqual(t.clones.filter(([, to]) => to.startsWith(folder)).length, 1, "only the first record was ever cloned in");
    t.done();
  });
  it("takes a cue of each kind with each key", async () => {
    const t = setup();
    const folder = await planned(t);
    references(t);
    const r = await set(t,
      "--cue", "graphic | 4 | one | A one.", "--cue", "words | 3 | two | A two. | inspiration: Spotlight", "--cue", "b-roll | 5 | three | A three. | shot: 2", "--cue", "screen | 6 | four | A four. | shot: 3 | link: https://example.com/post",
      "--cue", "graphic | 2 | five | A five. | ref: quote card", "--shot", "talking | One.", "--shot", "b-roll | Two.", "--shot", "screen | Three.", "--line", "Say it.");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(readEpisode(folder).record.planned.cues.map((c) => [c.kind, c.seconds, c.style, c.shot]), [
      ["graphic", 4, null, undefined], ["words", 3, { inspiration: "Spotlight" }, undefined], ["b-roll", 5, null, 2], ["screen", 6, { link: "https://example.com/post" }, 3], ["graphic", 2, { ref: "quote card.jpg" }, undefined]
    ]);
    t.done();
  });
  it("needs a b-roll or a screen cue to name a shot of its own kind that is in the list", async () => {
    const t = setup();
    const folder = await planned(t);
    for (const [cue, why] of [
      ["b-roll | 4 | w | S.", `a b-roll cue needs the number of the shot it shows, as "shot: 2"`],
      ["b-roll | 4 | w | S. | shot: 3", `shot 3 is a screen recording, and a b-roll cue shows b-roll`],
      ["screen | 4 | w | S. | shot: 2", `shot 2 is b-roll, and a screen cue shows a screen recording`],
      ["b-roll | 4 | w | S. | shot: 9", `there is no shot 9 in the shot list, which has 3`]
    ]) {
      const r = await set(t, "--cue", cue, "--shot", "talking | A.", "--shot", "b-roll | B.", "--shot", "screen | C.", "--line", "x");
      assert.deepEqual([r.code, r.said], [1, [`Cue 1 can't be used: ${why}.`, NOT_SAVED]], cue);
    }
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    t.done();
  });
  it("gives an explainer graphic and words cues only, and no shot", async () => {
    const t = setup();
    const folder = await planned(t, "Why SKUs", "--explainer");
    const set2 = (...args) => on(depsOf(t), "plan", "Why SKUs", "set", ...args);
    const bad = await set2("--cue", "b-roll | 4 | w | S.", "--cue", "screen | 4 | w | S.", "--shot", "talking | A.", "--line", "x");
    assert.deepEqual(bad.said, [
      `Cue 1 can't be used: an explainer shows graphics and words on screen only, so a b-roll cue is not one.`,
      `Cue 2 can't be used: an explainer shows graphics and words on screen only, so a screen cue is not one.`,
      `Shot 1 can't be used: an explainer has no shots.`,
      NOT_SAVED
    ]);
    const ok = await set2("--cue", "graphic | 4 | w | S.", "--cue", "words | 4 | v | T.", "--line", "Voice one.", "--line", "Voice two.");
    assert.deepEqual([ok.code, ok.said], [0, [`The plan for "Why SKUs" is saved: 2 graphic cues and a teleprompter script of 4 words, about 1 minute. Its files are in its folder in Episodes.`]]);
    // No shot list for an explainer.
    assert.deepEqual(listAll(join(t.root, "Episodes", nameOf(t, "Why SKUs"))), ["record/0001.json", "record/0002.json", "teleprompter.txt", "video guide.md"]);
    assert.deepEqual(Object.keys(readEpisode(join(t.root, "Episodes", nameOf(t, "Why SKUs"))).record.files).sort(), ["teleprompter.txt", "video guide.md"]);
    assert.equal(folder, join(t.root, "Episodes", nameOf(t, "Why SKUs")));
    t.done();
  });
  it("asks the reference folder about a ref, and refuses one that is not in it, saying which there are; it writes nothing in the folder", async () => {
    const t = setup();
    await planned(t);
    references(t);
    const listing = () => readdirSync(referencesFolder(t.root)).map((name) => [name, readFileSync(join(referencesFolder(t.root), name), "utf8")]);
    const before = listing();
    const none = await set(t, "--cue", "graphic | 4 | w | S. | ref: nothing like it", "--line", "x");
    assert.deepEqual(none.said, [`Cue 1 can't be used: there is no "nothing like it" in the reference folder, which has blue carousel.png and quote card.jpg.`, NOT_SAVED]);
    const several = await set(t, "--cue", "graphic | 4 | w | S. | ref: c", "--line", "x");
    assert.deepEqual(several.said, [`Cue 1 can't be used: which one is "c" in the reference folder? blue carousel.png or quote card.jpg.`, NOT_SAVED]);
    assert.deepEqual(listing(), before);
    // No folder at all, or no picture in it.
    rmSync(referencesFolder(t.root), { recursive: true });
    assert.deepEqual((await set(t, "--cue", "graphic | 4 | w | S. | ref: blue", "--line", "x")).said, [`Cue 1 can't be used: there is no "blue" in the reference folder, which has no pictures yet.`, NOT_SAVED]);
    assert.equal(existsSync(referencesFolder(t.root)), false, "the folder is not made");
    t.done();
  });
  it("looks a ref up with the reference folder read-only, to the word, and leaves its names, bytes and times as they were: Studio only reads it", async () => {
    const said = async (locked) => {
      const t = setup();
      await planned(t);
      references(t);
      const before = snapshotOf(referencesFolder(t.root));
      const args = ["--cue", "words | 2 | every one | The words EVERY ONE | ref: blue carousel", "--cue", "graphic | 4 | w | S. | ref: nothing like it", "--line", "x"];
      const r = locked ? await readOnly(referencesFolder(t.root), () => set(t, ...args)) : await set(t, ...args);
      const r2 = locked ? await readOnly(referencesFolder(t.root), () => set(t, "--cue", "words | 2 | every one | The words EVERY ONE | ref: blue carousel", "--line", "x")) : await set(t, "--cue", "words | 2 | every one | The words EVERY ONE | ref: blue carousel", "--line", "x");
      assert.deepEqual(snapshotOf(referencesFolder(t.root)), before);
      t.done();
      return [r.code, r.said, r2.code, r2.said.map((line) => line.split(t.dir).join("<dir>"))];
    };
    assert.deepEqual(await said(true), await said(false));
  });
  it("takes the most of each and refuses what is over: 60 cues, 40 shots, 400 lines, and 2,000 characters in a line", async () => {
    const t = setup();
    const folder = await planned(t);
    const cues = (n) => Array.from({ length: n }, (_, i) => ["--cue", `graphic | 4 | w${i} | S.`]).flat();
    const shots = (n) => Array.from({ length: n }, () => ["--shot", "talking | A."]).flat();
    const lines = (n) => Array.from({ length: n }, () => ["--line", "L."]).flat();
    const ok = await set(t, ...cues(60), ...shots(40), ...lines(400));
    assert.equal(ok.code, 0, ok.text);
    for (const [args, said] of [
      [[...cues(61), "--line", "x"], `Cue 61 can't be used: a plan has at most 60 cues.`],
      [[...shots(41), "--line", "x"], `Shot 41 can't be used: a plan has at most 40 shots.`],
      [[...lines(401)], `Line 401 can't be used: a plan has at most 400 lines.`],
      [["--line", "a".repeat(2001)], `Line 1 can't be used: it is 2,001 characters, and at most 2,000 can be used.`]
    ]) {
      const rev = readEpisode(folder).record.rev;
      const r = await set(t, ...args);
      assert.deepEqual([r.code, r.said], [1, [said, NOT_SAVED]], said);
      assert.equal(readEpisode(folder).record.rev, rev, "nothing was written");
    }
    assert.equal((await set(t, "--line", "a".repeat(2000))).code, 0);
    t.done();
  });
  it("refuses a cue with five parts and no key, and says a | in its words is written %7C", async () => {
    const t = setup();
    const folder = await planned(t);
    const r = await set(t, "--cue", "graphic | 4 | this | that | what it shows", "--line", "x");
    assert.deepEqual([r.code, r.said], [1, [`Cue 1 can't be used: part 5 ("what it shows") is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C.`, NOT_SAVED]]);
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    t.done();
  });
  it("is the help, with 2, when it is told nothing to set, or a flag it does not know, and writes nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    for (const words of [[], ["--zzz", "x"], ["--explainer"], ["--voice", "sallie"]]) {
      const r = await set(t, ...words);
      assert.equal(r.code, 2, words.join(" "));
    }
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    t.done();
  });
  it("sets nothing for a video that is not a planned one, and says so", async () => {
    const { t, found } = episode();
    const r = await on(depsOf(t), "plan", found.name, "set", "--line", "x");
    assert.deepEqual([r.code, r.said], [1, [`"${NAME}" is not a planned video.`]]);
    assert.deepEqual((await on(depsOf(t), "plan", found.name)).said, [`"${NAME}" is not a planned video.`]);
    assert.deepEqual((await on(depsOf(t), "plan", found.name, "drop")).said, [`"${NAME}" is not a planned video.`]);
    t.done();
  });
  it("says what Dropbox undid before it writes, and nothing is saved", async () => {
    const t = setup();
    const folder = await planned(t);
    // The record this Mac wrote last has been taken away by Dropbox: the newest record there is older than the one noted.
    writeFileSync(join(t.home, "Library", "Application Support", "BRIMM Video", "written.json"), JSON.stringify({ [recordOf(t).id]: 5 }));
    const written = (await import("../settings.js")).writtenFile(t.home);
    mkdirSync(dirname(written), { recursive: true });
    writeFileSync(written, JSON.stringify({ [recordOf(t).id]: 5 }));
    const r = await set(t, "--line", "x");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Dropbox undid this Mac's last change to Too many SKUs\. Say it again\. Nothing was saved\.$/);
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    t.done();
  });
});

describe("plan, the text of a package", () => {
  /** A package of one cue and one line made of `parts`, saved, and the cue and line as the record holds them. */
  async function saved(cue, line) {
    const t = setup();
    const folder = await planned(t);
    const r = await set(t, "--cue", cue, "--line", line);
    return { t, r, folder, record: readEpisode(folder).record };
  }
  it("turns each of the six escapes in a cue's words, what it shows and a line, and in the files", async () => {
    const { t, r, folder, record } = await saved("graphic | 4 | a %22quoted%22 %2499 %7C b | Costs 100%25, %5C and %60 ticks.", "Say %22it%22: %2499, 100%25, %5C, %60 and %7C.");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([record.planned.cues[0].words, record.planned.cues[0].show], ['a "quoted" $99 | b', "Costs 100%, \\ and ` ticks."]);
    assert.deepEqual(record.planned.lines, ['Say "it": $99, 100%, \\, ` and |.']);
    assert.match(readFileSync(join(folder, "video guide.md"), "utf8"), /on "a "quoted" \$99 \| b": Costs 100%, \\ and ` ticks\.\n$/);
    assert.equal(readFileSync(join(folder, "teleprompter.txt"), "utf8"), 'Say "it": $99, 100%, \\, ` and |.\n');
    t.done();
  });
  it("keeps a percent sign that is no code: 100% sure arrives as it is", async () => {
    const { t, record } = await saved("graphic | 4 | 100% sure | It is 100% sure.", "I am 100% sure of 50% of it.");
    assert.deepEqual([record.planned.cues[0].words, record.planned.cues[0].show, record.planned.lines[0]], ["100% sure", "It is 100% sure.", "I am 100% sure of 50% of it."]);
    t.done();
  });
  it("hands each of the seven marks on whole in a shot too, and in every file that holds it", async () => {
    const t = setup();
    const folder = await planned(t);
    const r = await set(t, "--shot", "talking | She says %22it's %2499%22: 100%25, %5C, %60 and %7C.", "--line", "x");
    assert.equal(r.code, 0, r.text);
    const what = `She says "it's $99": 100%, \\, \` and |.`;
    assert.equal(readEpisode(folder).record.planned.shots[0].what, what);
    assert.equal(readFileSync(join(folder, "shot list.md"), "utf8"), `# Too many SKUs: the shot list\n\n1. Talking to the camera: ${what}\n`);
    t.done();
  });
  it("hands an apostrophe and a quote mark on whole, a curly one too", async () => {
    const { t, record } = await saved("graphic | 4 | it's “fine” | It’s a ‘quote’, isn't it.", "She said it's 'fine', and “fine” too.");
    assert.deepEqual([record.planned.cues[0].words, record.planned.cues[0].show, record.planned.lines[0]], ["it's “fine”", "It’s a ‘quote’, isn't it.", "She said it's 'fine', and “fine” too."]);
    t.done();
  });
  it("refuses a field broken by a | that is not written %7C, in words, and writes nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    const r = await set(t, "--cue", "graphic | 4 | this | that | what it shows", "--shot", "talking | Open | to the camera.", "--line", "x");
    assert.deepEqual(r.said, [
      `Cue 1 can't be used: part 5 ("what it shows") is not a key and a value, such as "ref: blue carousel.png". If a | belongs to its words or to what it shows, write it as %7C.`,
      `Shot 1 can't be used: it needs two parts: its kind and what it is. If a | belongs to what it is, write it as %7C.`,
      NOT_SAVED
    ]);
    assert.deepEqual(listAll(folder), ["record/0001.json"]);
    const ok = await set(t, "--cue", "graphic | 4 | this %7C that | what it shows", "--shot", "talking | Open %7C to the camera.", "--line", "x");
    assert.equal(ok.code, 0, ok.text);
    t.done();
  });
});

describe("plan, the plan in plain words", () => {
  it("says each cue, each shot and the teleprompter script's length, for a script", async () => {
    const t = setup();
    await planned(t);
    references(t);
    await set(t, ...PACKAGE);
    const r = await on(depsOf(t), "plan", TITLE);
    assert.deepEqual([r.code, r.said], [0, [
      'The plan for "Too many SKUs":',
      'Cue 1, a graphic for 4 seconds, on "too many SKUs": A stack of product boxes that keeps growing until it topples.',
      'Cue 2, words on screen for 2 seconds, on "every one": The words EVERY ONE. Style: blue carousel.png.',
      'Cue 3, b-roll for 3 seconds, on "sorting invoices": Her hands on the pile. From shot 2.',
      "Shot 1, talking to the camera: Open on the problem, to the camera.",
      "Shot 2, b-roll: Sallie at her desk sorting invoices.",
      "The teleprompter script is 11 words, about 1 minute."
    ]]);
    for (const line of r.said) assert.ok(isPlain(line), line);
    t.done();
  });
  it("says the same for an explainer, with its voice and without shots", async () => {
    const t = setup();
    await planned(t, "Why SKUs", "--explainer", "--voice", "heygen");
    await on(depsOf(t), "plan", "Why SKUs", "set", "--cue", "graphic | 4 | w | S.", "--line", "Voice.");
    const r = await on(depsOf(t), "plan", "Why SKUs");
    assert.deepEqual([r.code, r.said], [0, ['The plan for "Why SKUs", an explainer in a HeyGen voice:', 'Cue 1, a graphic for 4 seconds, on "w": S.', "The teleprompter script is 1 word, about 1 minute."]]);
    t.done();
  });
  it("says what is still to be made while the package is not set", async () => {
    const t = setup();
    await planned(t);
    await planned(t, "Why SKUs", "--explainer");
    assert.deepEqual((await on(depsOf(t), "plan", TITLE)).said, [`"Too many SKUs" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`]);
    assert.deepEqual((await on(depsOf(t), "plan", "Why SKUs")).said, [`"Why SKUs" is planned, and its guide and its teleprompter script aren't made yet.`]);
    t.done();
  });
  it("finds the plan by its title, its words or its id, and writes nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    const before = bytesIn(folder);
    for (const said of [TITLE, "too many skus", "skus", recordOf(t).id, SHORT]) assert.equal((await on(depsOf(t), "plan", said)).code, 0, said);
    assert.deepEqual(bytesIn(folder), before);
    assert.match((await on(depsOf(t), "plan", "nothing like it")).text, /^No episode fits "nothing like it"\./);
    t.done();
  });
});

describe("a planned episode in Episodes, and the commands that are not plan", () => {
  /** A command's words for each command that is not in the gate's lists for a plan, by the words that name the plan. */
  const ASKED = {
    kind: [TITLE, "raw", "--private", "no"], leave: [TITLE], which: [TITLE], read: ["--now", TITLE, "--kind", "raw", "--rev", "1"], workcopy: ["--now", TITLE], open: [TITLE], app: [TITLE],
    bring: ["--now", TITLE], title: [TITLE], reel: ["drop", TITLE, "1"], reels: [TITLE, "--no-play"], ask: [TITLE], finish: [TITLE], release: [TITLE], show: [TITLE, "transcript"], resolve: [TITLE], free: [TITLE],
    spell: [TITLE], graphic: [TITLE, "ideas"], teachings: [TITLE], principles: [TITLE], ideas: [TITLE],
    refs: ["use", TITLE, "blue carousel"],
    // A plan is no video, so it is no footage for a plan (PR H5a): the gate says it isn't made from its footage yet.
    footage: [TITLE, "Another plan", "talking", "--client", "no"]
  };
  it("refuses every other command in the same words, ends with 1, and starts and writes nothing", async () => {
    const names = COMMAND_NAMES.filter((name) => !UNSCOPED.includes(name) && !["plan", "name", "join", "resolve"].includes(name));
    for (const name of names) assert.ok(name in ASKED, `${name} names an episode: give it its words here, or the plan is not tried on it`);
    const t = setup();
    const folder = await planned(t);
    const before = bytesIn(folder);
    for (const name of names) {
      const r = await on(depsOf(t), name, ...ASKED[name]);
      const why = name === "leave" ? TO_DROP : NOT_PLANNED_YET;
      assert.deepEqual([r.code, r.said], [1, [why]], name);
    }
    assert.deepEqual([t.started, t.calls, t.opened], [[], [], []]);
    assert.deepEqual(bytesIn(folder), before);
    t.done();
  });
  it("lets name run, and the plan is then found and shown by the name she gave it", async () => {
    const t = setup();
    await planned(t);
    const r = await on(depsOf(t), "name", TITLE, "Why SKUs sink you");
    assert.deepEqual([r.code, r.said], [0, [`It is called "Why SKUs sink you" now. Nothing was renamed.`]]);
    assert.equal(recordOf(t).name.text, "Why SKUs sink you");
    assert.equal((await on(depsOf(t), "plan", "Why SKUs sink you")).said[0], `"Why SKUs sink you" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`);
    assert.equal((await on(depsOf(t), "open", "Why SKUs sink you")).said[0], `"Why SKUs sink you" is a planned video, and it isn't made from its footage yet.`);
    t.done();
  });
  it("lists it in episodes, with the made-up episode beside it", async () => {
    const { t } = episode();
    await planned(t);
    assert.equal((await set(t, ...packageArgs(false))).code, 0);
    const r = await on(depsOf(t), "episodes");
    assert.equal(r.code, 0, r.text);
    const lines = r.said;
    assert.equal(lines[0], "Episodes, newest first:");
    assert.equal(lines[1], `  "Too many SKUs": planned on ${dayText(t)}, waiting for its footage (2 shots), id ${SHORT}`);
    assert.match(lines[2], new RegExp(`^  ${NAME.replace(/[?]/g, "\\?")}: an episode of`));
    assert.ok(lines.every((line) => !/A file of this video/.test(line)), r.text);
    t.done();
  });
  it("lists a plan with no shot yet, and an explainer, in the words of its footage or its voice", async () => {
    const t = setup();
    await planned(t);
    await planned(t, "Why SKUs", "--explainer");
    await planned(t, "Why again", "--explainer", "--voice", "heygen");
    const { said } = await on(depsOf(t), "episodes");
    assert.deepEqual(said.slice(1, 4).sort(), [
      `  "Too many SKUs": planned on ${dayText(t)}, waiting for its footage (no shots yet), id ${SHORT}`,
      `  "Why SKUs": an explainer planned on ${dayText(t)}, waiting for its voiceover, id ${SHORT}`,
      `  "Why again": an explainer planned on ${dayText(t)}, waiting for its HeyGen voice, id ${SHORT}`
    ].sort());
    t.done();
  });
  it("lists a plan the other Mac has set, and one with a package file that is missing, as every episode is: with what is not right", async () => {
    const t = setup();
    const folder = await planned(t);
    await set(t, "--line", "One.");
    rmSync(join(folder, "teleprompter.txt"));
    const { said } = await on(depsOf(t), "episodes");
    assert.deepEqual(said.slice(1, 3), [`  "Too many SKUs": planned on ${dayText(t)}, waiting for its footage (no shots yet), id ${SHORT}`, "    A file of this video is missing: teleprompter.txt. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason."]);
    t.done();
  });
  it("gives the guide a step of its own for it: film it, before the BRIMM Ops page's steps and changing none of them", async () => {
    const t = setup();
    await planned(t);
    const FILM = "Film it to its shot list, then drop the files in your drop folder. To read the teleprompter script, say 'show me the script': it opens as a copy to read, and changes come through the chat.";
    assert.deepEqual((await on(light(t), "guide")).said, ["Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio", "Under way:", `  Too many SKUs (${SHORT}): ${FILM}`]);
    assert.deepEqual((await on(light(t), "guide", TITLE)).said, [`Too many SKUs (${SHORT}): ${FILM}`]);
    assert.deepEqual((await on(light(t), "guide", SHORT)).said, [`Too many SKUs (${SHORT}): ${FILM}`]);
    // Its step is not the page's: nothing is shown in Finder for it, and none is noted done.
    assert.deepEqual((await on(light(t), "guide", TITLE, "show")).said, [`There is nothing to show in Finder for Too many SKUs (${SHORT}) now.`]);
    assert.deepEqual((await on(light(t), "guide", TITLE, "done", "taken")).said, [`Not noted: Too many SKUs (${SHORT}) has no step on the BRIMM Ops page now. ${FILM}`]);
    t.done();
  });
  it("tells an explainer the step of its voice: recorded by her, or chosen in HyperFrames", async () => {
    for (const [flags, step] of [
      [["--explainer"], "Record the voiceover from the teleprompter script, then drop the sound file in your drop folder."],
      [["--explainer", "--voice", "sallie"], "Record the voiceover from the teleprompter script, then drop the sound file in your drop folder."],
      [["--explainer", "--voice", "heygen"], "When the HyperFrames part is ready, you'll choose the HeyGen voice there."]
    ]) {
      const t = setup();
      await planned(t, "Why SKUs", ...flags);
      assert.deepEqual((await on(light(t), "guide", "Why SKUs")).said, [`Why SKUs (${SHORT}): ${step}`], flags.join(" "));
      t.done();
    }
  });
  it("keeps the guide's other steps for the other videos, and puts the plan among them newest first", async () => {
    const { t, found } = episode({ kind: "finished", answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: "2026-10-20T08:00:00-05:00", private: "no" } });
    await planned(t);
    const before = (await on(light(t), "guide", found.name)).said;
    const r = await on(light(t), "guide");
    assert.equal(r.said[1], "Under way:");
    assert.match(r.said[2], /^ {2}Too many SKUs \(400000\): Film it/);
    assert.ok(r.said.some((line) => line.startsWith(`  ${NAME} (`)), r.text);
    assert.deepEqual((await on(light(t), "guide", found.name)).said, before);
    t.done();
  });
  it("is passed over by the guide once it is set aside as done, as any video is", async () => {
    const t = setup();
    await planned(t);
    assert.deepEqual((await on(light(t), "guide", TITLE, "finished")).said, [`Too many SKUs (${SHORT}) is no longer under way.`]);
    assert.deepEqual((await on(light(t), "guide")).said.slice(1), ["Nothing is under way. To start, put the video in your drop folder."]);
    t.done();
  });
  it("leaves every other command as it was: the made-up episode's status, free and show say the same with a plan beside it", async () => {
    const asks = [["status"], ["status", FOLDER], ["free", FOLDER], ["show", FOLDER, "plan"], ["name", FOLDER, "Another"], ["reels", FOLDER, "--no-play"], ["resolve", FOLDER]];
    const said = async (withPlan) => {
      const { t } = episode();
      if (withPlan) await planned(t);
      const out = [];
      for (const ask of asks) {
        const r = await on(depsOf(t, { statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 }), kickstart: () => {}, agentRunning: () => false }), ...ask);
        out.push([ask.join(" "), r.code, r.text.split(t.dir).join("<dir>")]);
      }
      t.done();
      return out;
    };
    assert.deepEqual(await said(true), await said(false));
  });
  it("stays out of the import's version match: a plan is never a candidate, and a candidate made of one matches nothing", async () => {
    const t = setup();
    const folder = await planned(t);
    const mine = { seconds: 800, fingerprint: "abc", words: [{ w: "hello" }] };
    const record = recordOf(t);
    const candidate = { id: record.id, folder, kind: null, archived: null, session: null, seconds: undefined, fingerprint: "" };
    assert.equal(matchVersion(mine, [candidate], () => [{ w: "hello" }]), null);
    // A candidate with the plan's id, its kind null as the record's is, is no version of a new file with words.
    assert.equal(matchVersion({ seconds: 800, fingerprint: "x".repeat(8), words: [] }, [candidate], () => null), null);
    t.done();
  });
  it("is not taken for an import that stopped by a video of the same name, which is filed in a folder of its own beside it", async () => {
    const t = setup();
    const folder = await planned(t);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, `${TITLE}.mov`), "video");
    const logs = [];
    const run = async (cmd, args) => {
      if (cmd === "FFPROBE") {
        writeFileSync(args[args.indexOf("-o") + 1], probed({ duration: "120.000000" }));
        return { code: 0, stderr: "" };
      }
      if (cmd === "FFMPEG") {
        const filter = args.includes("-af") ? args[args.indexOf("-af") + 1] : "";
        if (filter.includes("silencedetect=noise=-45dB")) return { code: 0, stderr: "" };
        if (filter.includes("silencedetect=noise=-35dB")) return { code: 0, stderr: PAUSES };
        writeFileSync(args[args.length - 1], "RIFF");
        return { code: 0, stderr: "" };
      }
      const base = args[args.indexOf("-of") + 1];
      writeFileSync(`${base}.srt`, SRT);
      if (args.includes("-ojf")) writeFileSync(`${base}.json`, JSON.stringify(TOLD));
      return { code: 0, stderr: "" };
    };
    for (const d of ["tmp", "locks"]) mkdirSync(join(t.dir, d), { recursive: true });
    const at = Date.parse("2026-10-20T15:00:00");
    let clock = at;
    await uneditedFolder(drop, {
      run, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", swift: "", claude: "" }, model: "/models/model.bin", tmpDir: join(t.dir, "tmp"), lockDir: join(t.dir, "locks"), home: t.home,
      today: () => dayOf(t), rand: () => 0.5, rulesOnly: true, settings: { version: 1, machine: "Mac Studio", root: t.root, checkout: "/checkout", import: "light" }, light: true,
      now: () => new Date(at), clock: () => clock, wait: async (ms) => { clock += ms; }, notify: () => {}, log: (line) => logs.push(line),
      clone: (from, to) => copyFileSync(from, to), sameDisk: () => true, commit: "abc1234", keepAwake: () => {}, progress: noProgress, isWhole: () => true, alive: () => false
    });
    const names = readdirSync(join(t.root, "Episodes")).filter((name) => !name.startsWith(".")).sort();
    assert.deepEqual(names, [nameOf(t), `${nameOf(t)}-2`]);
    assert.deepEqual(listAll(folder), ["record/0001.json"], "the plan's folder is as it was");
    const imported = readEpisode(join(t.root, "Episodes", `${nameOf(t)}-2`)).record;
    assert.deepEqual([imported.video.file, imported.answer.state, imported.answer.match], [`${TITLE}.mov`, "needs your answer", null]);
    t.done();
  });
  it("is no episode that holds a video of its name in the drop folders, and episodes lists that video as waiting", async () => {
    const t = setup();
    await planned(t);
    assert.equal(holdingEpisode({ root: t.root, video: `${TITLE}.mov`, bytes: 5 }), null);
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, `${TITLE}.mov`), "video");
    const r = await on(depsOf(t), "episodes");
    const waiting = r.said.find((line) => line.startsWith(`  ${TITLE}.mov, in Mac Studio's`));
    assert.ok(waiting, r.text);
    assert.doesNotMatch(waiting, /already imported/);
    t.done();
  });
  it("is no video that kind can name as the one a new video is a version of: it is not answered", async () => {
    const t = setup();
    const waiting = episodeFor(t, { record: { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:23", came: "camera" }, label: "Video of 20 Oct, 15:00 (Mac Studio)" } });
    const folder = await planned(t);
    for (const id of [SHORT, `e-${dayOf(t).replaceAll("-", "")}-${SHORT}`]) {
      const r = await on(depsOf(t), "kind", "Video of 20 Oct, 15:00 (Mac Studio)", "finished", "--private", "no", "--version-of", id);
      assert.deepEqual([r.code, r.said], [1, [`No answered video on this Mac has the id ${id}.`]], id);
    }
    assert.deepEqual([readEpisode(waiting.folder).record.rev, listAll(folder)], [1, ["record/0001.json"]]);
    t.done();
  });
  it("is listed, guided and refused as a plan when a conflicted copy of its record only claims to be one: named as any gated video is, and nothing crashes", async () => {
    const t = setup();
    const folder = await planned(t);
    const claim = { ...recordOf(t), answer: { ...recordOf(t).answer, guess: "raw" } };
    writeFileSync(join(folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-10-20).json"), JSON.stringify(claim));
    const episodes = await on(depsOf(t), "episodes");
    assert.equal(episodes.code, 0, episodes.text);
    assert.ok(!/Too many SKUs/.test(episodes.text) && !episodes.text.includes(nameOf(t)), episodes.text);
    assert.match(episodes.text, /a video not yet answered \(400000\): a video waiting for your answer, id 400000/);
    const guide = await on(light(t), "guide");
    assert.equal(guide.code, 0, guide.text);
    assert.ok(!/Too many SKUs/.test(guide.text), guide.text);
    assert.match(guide.text, /a video not yet answered \(400000\): Dropbox kept two copies of a change to it\. Say "sort out the conflict"\./);
    const refused = await on(depsOf(t), "plan", nameOf(t));
    assert.equal(refused.code, 1);
    assert.ok(!/Too many SKUs/.test(refused.text), refused.text);
    t.done();
  });
  it("has nothing for free to take away: it is passed over", async () => {
    const t = setup();
    const folder = await planned(t);
    await set(t, "--line", "One.");
    const record = recordOf(t);
    const said = [];
    const ctx = { home: t.home, machine: "Mac Studio", root: t.root, alive: () => false, say: (line) => said.push(line), stat: (path) => statSync(path, { throwIfNoEntry: false }) };
    const code = await freeEpisode(ctx, { found: { name: nameOf(t), folder }, record }, { running: async () => false });
    assert.equal(code, 0, said.join("\n"));
    t.done();
  });
});

describe("the words of a plan command, through the guard", () => {
  const command = (tail) => `${EDIT} ${tail}`;
  const decision = (tail) => guardDecision({ tool_name: "Bash", tool_input: { command: command(tail) } }, { checkout: CHECKOUT, node: NODE }).decision;
  it("lets through a plan with every mark written as a code, and a quote that cannot be passed whole is refused: that is what the codes are for", () => {
    assert.equal(decision(`plan new "Too many SKUs"`), "allow");
    assert.equal(decision(`plan new "Why SKUs" --explainer --voice heygen`), "allow");
    assert.equal(decision(`plan "Too many SKUs" set --cue "graphic | 4 | it's %2499 and %22100%25%22 | She said %22it's fine%22: %5C and %60 and %7C." --shot "talking | Open to the camera." --line "I am 100%25 sure, it's %2499."`), "allow");
    assert.equal(decision(`plan "Too many SKUs" set --line "It is $99"`), "deny");
    assert.equal(decision(`plan "Too many SKUs" set --line "She said "no""`), "deny");
    assert.equal(decision(`plan "Too many SKUs" set --line "a \`tick\`"`), "deny");
    assert.equal(decision(`plan "Too many SKUs" set --line "a \\ slash"`), "deny");
  });
});

describe("the walk of every command: plan has its words in the help", () => {
  it("has the help give plan its three forms, with every flag of them", () => {
    for (const usage of ['node edit.js plan new "<title>" [--explainer [--voice sallie|heygen]]', 'node edit.js plan "<planned>" set [--cue "<kind> | <seconds> | <words> | <what to show>[ | <key>: <value>]…"]…', '[--shot "<kind> | <what>"]… [--line "<paragraph>"]…', 'node edit.js plan "<planned>"', 'node edit.js plan "<planned>" drop']) {
      assert.ok(HELP.includes(usage), usage);
    }
    assert.ok(COMMAND_NAMES.includes("plan"));
    // And the commands the gate refuses it for (every one that names an episode) were all tried above.
    assert.ok(COMMAND_NAMES.length > 30);
  });
});
