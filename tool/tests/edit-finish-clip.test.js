// An iPhone clip's hand-off (plan PR 7, groups F1 to F4; architecture 2026-10-27, section 4.2): answering its spellings card writes no
// hand-off; `finish` is how the hand-off is made. With a project that the app has opened, it is finished from the project's export (the
// HyperFrames way, which edit-finish-app.test.js and finish-app.test.js cover for a raw video); otherwise it asks once whether to hand
// the clip off as it is, and `--as-it-is` writes the hand-off from the import's captions, as the card did before. A clip answered under
// the old rules keeps the hand-off it has. Nothing here runs a real program or touches Dropbox, the app or the real Downloads folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { finishFinished, finishNow, madeFromImport } from "../finish.js";
import { episodeWork } from "../settings.js";
import { FOLDER, ID, episodeFor, reread, setup, listAll } from "./episodes.js";
import { AT, MAIN, READING, SPELLINGS, VIDEO, clipWorld as clip, entry, exportOf, world } from "./exports-world.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const NAME = "Pricing talk";
const HANDOFF = "Pricing talk.brimm-ops.json";
const OGDEN = '"Ogdin" as "Ogden"';
const NEXT = 'Say "open it in HyperFrames" to edit it, or "hand it off" to hand it off as it is.';
const WAITS = "The hand-off is written once this Mac hands off version 2: ask Jason.";
const questionOf = (name) => `${name} was not opened in HyperFrames. Hand it off as it is, or open it in HyperFrames first?`;
const QUESTION = questionOf(NAME);
/** The made-up episode of exports-world.js is named "Pricing: what to charge?", and its hand-off is named for it. */
const WORLD_NAME = "Pricing: what to charge?";
const WORLD_HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const WRITTEN = (n) => `The hand-off is written as revision ${n} and shown in Finder: drop it on the BRIMM Ops page.`;
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/handoff-v2-${name}.json`, import.meta.url), "utf8"));
const handoffIn = (found, file = HANDOFF) => JSON.parse(readFileSync(join(found.folder, "final", file), "utf8"));

describe("F1. the spellings card, for an iPhone clip", () => {
  it("records the answer and the spellings and writes no hand-off: nothing is run, and final/ is not made", async () => {
    const { t, found } = clip();
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. ${NEXT}`);
    const record = reread(found);
    assert.deepEqual([record.spellings, record.offers.answered.applied, record.finished], [[["Ogdin", "Ogden"]], ["Ogdin"], null]);
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.deepEqual(t.calls, []);
    t.done();
  });
  it("says the same of an answer of none, with the spelling it applied none of", async () => {
    const { t, found } = clip();
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.text, `No spelling applied. ${NEXT}`);
    assert.equal(reread(found).finished, null);
    t.done();
  });
  it("is answered already when it is asked again, and still writes no hand-off", async () => {
    const { t, found } = clip();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "offers", "1")).code, 0);
    const again = await on(t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.deepEqual([again.code, again.text], [1, `The spellings Claude offered for ${NAME} were answered already. To spell a word another way, say it with spell add; to take one back, spell drop.`]);
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  it("says only that the hand-off waits for version 2 on a Mac that hands off version 1, and keeps the answer", async () => {
    const { t, found } = clip({ version: 1 });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. ${WAITS}`);
    assert.deepEqual([reread(found).spellings, reread(found).finished], [[["Ogdin", "Ogden"]], null]);
    t.done();
  });
  it("writes no hand-off for a spelling added or dropped afterwards either", async () => {
    const { t, found } = clip({ answer: [] });
    const add = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.deepEqual([add.code, add.text], [0, '"Ogdin" is spelled "Ogden" now, in every caption.']);
    const drop = await on(t.ctx.deps, "spell", FOLDER, "drop", "Ogdin");
    assert.deepEqual([drop.code, drop.text], [0, '"Ogdin" is as the transcriber writes it again.']);
    assert.equal(existsSync(join(found.folder, "final")), false);
    assert.equal(reread(found).finished, null);
    t.done();
  });
  it("still writes a finished video's hand-off from the card, as it always did", async () => {
    const { t, found } = clip({ over: { kind: "finished", reading: { ...READING, kind: "finished" } } });
    const r = await on(t.ctx.deps, "spell", FOLDER, "offers", "1");
    assert.equal(r.text, `Spelled now, in every caption: ${OGDEN}. ${WRITTEN(1)}`);
    assert.equal(handoffIn(found).video.kind, "finished");
    t.done();
  });
});

describe("F2. finish on a clip that was not opened in HyperFrames: it asks once, and as it is", () => {
  it("asks whether to hand it off as it is, exit 0, and starts and writes nothing, with or without a yes", async () => {
    const { t, found } = clip({ answer: ["Ogdin"] });
    for (const argv of [["finish", FOLDER], ["finish", FOLDER, "--yes"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.text], [0, QUESTION], argv.join(" "));
    }
    assert.deepEqual([t.started, t.calls, existsSync(join(found.folder, "final")), reread(found).rev, reread(found).editing.by], [[], [], false, found.record.rev, "Mac Studio"]);
    t.done();
  });
  it("writes the hand-off from the import's captions with --as-it-is, as the card did: kind short video, its main video alone, no suggestions", async () => {
    const { t, found } = clip({ answer: ["Ogdin"] });
    const r = await on(t.ctx.deps, "finish", FOLDER, "--as-it-is");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, `Handed off as it is. ${WRITTEN(1)}`);
    const handoff = handoffIn(found);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual(handoff.video, { id: ID, kind: "short video", name: NAME, recorded: "2026-10-14", recordedFrom: "video" });
    assert.equal(handoff.main.file, VIDEO);
    assert.match(handoff.main.srt, /Sallie Ogden\./);
    assert.deepEqual(["suggestions" in handoff, "reels" in handoff, handoff.session], [false, false, null]);
    const contract = fixture("short-video");
    assert.deepEqual([Object.keys(handoff), Object.keys(handoff.video), Object.keys(handoff.main)], [Object.keys(contract), Object.keys(contract.video), Object.keys(contract.main).filter((key) => key !== "onPicture")]);
    assert.deepEqual(listAll(join(found.folder, "final")), [HANDOFF, "Pricing talk.srt", "Pricing talk.transcript.txt"]);
    assert.deepEqual(t.calls, [{ cmd: "/usr/bin/open", args: ["-R", join(found.folder, "final", HANDOFF)] }]);
    const record = reread(found);
    assert.deepEqual([record.finished.revision, record.finished.parts.main.import, record.finished.parts.main.kind], [1, true, "short video"]);
    assert.ok(!record.editing, "the claim is let go");
    t.done();
  });
  it("hands it off as it is only once its spellings are answered", async () => {
    const { t, found } = clip();
    for (const argv of [["finish", FOLDER], ["finish", FOLDER, "--as-it-is"], ["finish", FOLDER, "--as-it-is", "--yes"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.text], [1, `${NAME}'s hand-off is written once its spellings are answered. Say "show me the spellings".`], argv.join(" "));
    }
    assert.equal(existsSync(join(found.folder, "final")), false);
    t.done();
  });
  it("waits for version 2 on a Mac that hands off version 1, before it looks at anything else", async () => {
    for (const argv of [["finish", FOLDER], ["finish", FOLDER, "--as-it-is"]]) {
      const { t, found } = clip({ version: 1, answer: ["Ogdin"] });
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.text], [1, `${NAME}'s hand-off is written from its spellings once this Mac hands off version 2: ask Jason.`], argv.join(" "));
      assert.equal(existsSync(join(found.folder, "final")), false);
      t.done();
    }
    const { t } = clip({ version: 1 });
    assert.equal((await on(t.ctx.deps, "finish", FOLDER)).text, `${NAME}'s hand-off is written from its spellings once this Mac hands off version 2: ask Jason.`);
    t.done();
  });
  it("asks the same of a clip answered under the old rules whose hand-off was never written, and owes it nothing now", async () => {
    // Its spellings were answered on a Mac that handed off version 1; the card wrote nothing then, and now writes nothing either.
    const { t, found } = clip({ answer: ["Ogdin"] });
    const r = await on(t.ctx.deps, "finish", FOLDER);
    assert.deepEqual([r.code, r.text], [0, QUESTION]);
    assert.equal(reread(found).finished, null);
    const card = await on(t.ctx.deps, "spell", FOLDER, "offers");
    assert.equal(card.code, 0);
    assert.doesNotMatch(card.text, /written|waits/);
    t.done();
  });
  it("refuses a clip the other Mac has open, and one another run is at work on, as it refuses an episode, and writes nothing", async () => {
    const away = clip({ answer: ["Ogdin"], over: { editing: { by: "Sallie's laptop", since: AT } } });
    const held = await on(away.t.ctx.deps, "finish", FOLDER, "--as-it-is");
    assert.equal(held.code, 1);
    assert.match(held.text, /Sallie's laptop/);
    assert.equal(existsSync(join(away.found.folder, "final")), false);
    away.t.done();
    const busy = clip({ answer: ["Ogdin"] });
    mkdirSync(episodeWork(busy.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(busy.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "read" }));
    busy.t.ctx.deps.alive = (pid) => pid === 4242;
    const running = await on(busy.t.ctx.deps, "finish", FOLDER, "--as-it-is");
    assert.deepEqual([running.code, running.text], [1, 'read is running for this episode. Say "how far is it?"']);
    assert.equal(existsSync(join(busy.found.folder, "final")), false);
    busy.t.done();
  });
  it("says nothing of a path, a flag or a command in the question", () => {
    assert.doesNotMatch(QUESTION, /\/|--|~|\bedit\.js\b|\bnode\b/);
  });
});

describe("F3. a clip edited in HyperFrames, and a clip handed off already", () => {
  /** The made-up world of exports-world.js, for an answered iPhone clip whose spellings are answered: a main project, opened or not. */
  const edited = ({ opened = true, over = {} } = {}) => world({
    kind: "short video",
    projects: ["main"],
    over: { version: 4, reels: [], offers: { spellings: SPELLINGS, answered: { reading: READING.at, at: AT, on: "Mac Studio", applied: ["Ogdin"], left: ["pricing"] } }, reading: READING, spellings: [["Ogdin", "Ogden"]], app: { toolchain: "0.8.208", projects: [entry("main", opened ? {} : { opened: [], state: "made" })] }, ...over }
  });
  it("goes the HyperFrames way once the app has opened its project, with no question, and its hand-off is from the export", async () => {
    const w = edited();
    const main = exportOf(w, "main");
    assert.equal((await on(w.t.ctx.deps, "finish", FOLDER)).text.split("\n").at(-1), 'Say "yes, hand it off" to start.');
    const r = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(r.code, 0, r.text);
    assert.equal(w.asked().source, "hyperframes");
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const handoff = handoffIn(found, WORLD_HANDOFF);
    assert.equal(handoffFaultV2(handoff), "");
    assert.deepEqual([handoff.video.kind, handoff.main.file, "reels" in handoff, "suggestions" in handoff, handoff.revision], ["short video", main.name, false, false, 1]);
    const contract = fixture("short-video");
    assert.deepEqual([Object.keys(handoff), Object.keys(handoff.video)], [Object.keys(contract), Object.keys(contract.video)]);
    assert.equal(reread(found).finished.parts.main.project, MAIN);
    assert.equal(reread(found).finished.parts.main.import, undefined);
    w.t.done();
  });
  it("asks the question for a clip whose project was made and never opened, and for one with no project at all", async () => {
    const never = edited({ opened: false });
    exportOf(never, "main");
    const r = await on(never.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.deepEqual([r.code, r.text], [0, questionOf(WORLD_NAME)]);
    assert.deepEqual(never.t.started, []);
    never.t.done();
    const none = clip({ answer: ["Ogdin"] });
    assert.equal((await on(none.t.ctx.deps, "finish", FOLDER)).text, QUESTION);
    none.t.done();
  });
  it("says a hand-off made from the import is written already, as its revision, and writes nothing", async () => {
    const { t, found } = clip({ answer: ["Ogdin"] });
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--as-it-is")).code, 0);
    const tree = listAll(join(found.folder, "final"));
    const rev = reread(found).rev;
    const text = readFileSync(join(found.folder, "final", HANDOFF), "utf8");
    for (const argv of [["finish", FOLDER], ["finish", FOLDER, "--yes"], ["finish", FOLDER, "--as-it-is"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.text], [1, `${NAME}'s hand-off is written already, as revision 1, from the clip as it was filmed. To hand off an edited version, open it in HyperFrames first.`], argv.join(" "));
    }
    assert.deepEqual([listAll(join(found.folder, "final")), reread(found).rev, readFileSync(join(found.folder, "final", HANDOFF), "utf8"), t.started], [tree, rev, text, []]);
    t.done();
  });
  it("makes that hand-off again from the import's captions at a later spell, as it does today", async () => {
    const { t, found } = clip({ answer: ["Ogdin"] });
    assert.equal((await on(t.ctx.deps, "finish", FOLDER, "--as-it-is")).code, 0);
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "pricing", "Pricing");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /the hand-off is made again as revision 2/);
    assert.equal(handoffIn(found).revision, 2);
    assert.match(handoffIn(found).main.srt, /Pricing is the subject/);
    assert.equal(reread(found).finished.parts.main.import, true);
    t.done();
  });
  it("writes the next revision from the export, under the same id, once the clip is opened and exported, and it is no longer the import's", async () => {
    const w = edited();
    // The hand-off it has from the import, as revision 1, written under the old rules.
    const made = await finishFinished(w.t.ctx, w.found);
    assert.equal(made.ok, true, made.why);
    const first = handoffIn(w.found, WORLD_HANDOFF);
    assert.deepEqual([first.revision, madeFromImport(reread(w.found))], [1, true]);
    // It is opened in HyperFrames and exported.
    const main = exportOf(w, "main");
    const asked = await on(w.t.ctx.deps, "finish", FOLDER, "--yes");
    assert.equal(asked.code, 0, asked.text);
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    const second = handoffIn(found, WORLD_HANDOFF);
    assert.deepEqual([second.revision, second.video.id, second.main.file, handoffFaultV2(second)], [2, first.video.id, main.name, ""]);
    assert.match(second.main.srt, /Today we are going to talk about/, "its captions are the export's, and not the import's");
    const record = reread(found);
    assert.deepEqual([madeFromImport(record), record.finished.revision, record.finished.parts.main.project], [false, 2, MAIN]);
    // A spelling afterwards re-spells the final transcripts and the hand-off the way a finished raw video's are: from them, and not from the import.
    const spelled = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(spelled.code, 0, spelled.text);
    assert.match(spelled.text, /the hand-off is made again as revision 3/);
    const third = handoffIn(found, WORLD_HANDOFF);
    assert.deepEqual([third.revision, third.video.id], [3, first.video.id]);
    assert.match(third.main.srt, /Thank you so much, Sally\./);
    assert.match(third.main.srt, /Today we are going to talk about/);
    w.t.done();
  });
});

describe("F4. what does not change", () => {
  it("still says an answered clip has no timeline to show in Final Cut", async () => {
    const { t } = clip({ answer: ["Ogdin"] });
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.equal(r.code, 1);
    assert.equal(r.text, `${NAME} has no timeline to show in Final Cut: an iPhone clip is not edited here.`);
    t.done();
  });
  it("still takes a short video from before the switch, with no answer, the Final Cut way", async () => {
    const t = setup();
    episodeFor(t, { record: { kind: "short video", name: { text: "Hello clip", placeholder: false } } });
    const r = await on(t.ctx.deps, "finish", FOLDER);
    assert.match(r.text, /was never shown in Final Cut|has not been Shared|Looked in/);
    assert.doesNotMatch(r.text, /HyperFrames/);
    t.done();
  });
  it("still tells a finished video what it told: its hand-off is written from its spellings", async () => {
    const { t } = clip({ over: { kind: "finished", reading: { ...READING, kind: "finished" } } });
    const r = await on(t.ctx.deps, "finish", FOLDER);
    assert.deepEqual([r.code, r.text], [1, `${NAME} is not edited in Final Cut: its hand-off is written once its spellings are answered. Say "show me the spellings".`]);
    t.done();
  });
});
