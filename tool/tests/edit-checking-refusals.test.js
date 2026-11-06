// What the commands a running finish stops say while it only waits for its late check (finish.js, finish-check.js). She is told she need
// not wait for the check, and what she is likeliest to do next, a spelling, handing the video off again or over, or answering what it is
// again, is stopped while the finish runs: the stop says that the hand-off is written and when Studio checks Dropbox's copies, so that she
// says it again then, in each command's own voice. While a finish still copies, or the lock is another run's, the words are as they were.
// The finish is run as the command line runs it, holding the episode's lock, and the stopped command is run while it waits; the lock is
// this process's, so the command is told that this process is the finish run at work (checking-world.js). The worlds are guide-world.js's
// (exports-world.js's episode, read by Claude and its spellings answered), reels-world.js's for the Reels of a finished video, and
// episodes.js's for the Final Cut way, with stand-ins for ffprobe, ffmpeg, the transcriber and open: nothing here touches the real home,
// Downloads, Dropbox or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { editMain, finishEpisode } from "../edit.js";
import { lockOf, resultFile, takeEpisodeLock } from "../detached.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { episodeWork } from "../settings.js";
import { guideWorld } from "./guide-world.js";
import { markChecking } from "../finish-check.js";
import { clockAt } from "../unedited.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { ANSWERED, exportOf } from "./exports-world.js";
import { OFFERS, READ } from "./guide-world.js";
import { finishedWorld } from "./reels-world.js";
import { atWait, exported, on, seeing, whileChecking } from "./checking-world.js";

/** What every stop begins with: the hand-off is written, and when Studio checks Dropbox's copies (`due`, ms). `of` names the video. */
const written = (due, of = "") => `The hand-off${of} is written, and Studio checks Dropbox's copies at ${clockAt(due)}.`;
/** The words of the stops as they were, while the finish still copies. */
const STILL = {
  spell: 'finish is running for this episode. Say "how far is it?", and try again when it is done.',
  finish: 'finish is running for this episode. Say "how far is it?"',
  kind: "finish is running for 2026-10-14 Pricing talk (Mac Studio) already. Say it again when it has finished."
};
/** The layer commands, each with words that take it as far as the stop. */
const LAYERS = {
  captions: ["captions", FOLDER, "off"],
  text: ["text", FOLDER, "add", "lower-third", "--at", "0:01", "--line", "Sallie Ogden"],
  graphic: ["graphic", FOLDER, "add", "chart.png", "--at", "0:01"],
  preset: ["preset", FOLDER, "--look", "bright"],
  cut: ["cut", FOLDER, "remove", "--words", "know your costs"]
};
const SPELL = ["spell", FOLDER, "add", "Pricing", "Prycing"];
const KIND = ["kind", FOLDER, "raw", "--private", "no", "--again", "--not-a-session"];

describe("a spelling, while a finish waits for its late check", () => {
  it("is stopped with the hand-off written and when Studio checks Dropbox's copies, to try again then, for an add, a drop and an answer to the offers, and writes nothing", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { add: SPELL, drop: ["spell", FOLDER, "drop", "Pricing"], offers: ["spell", FOLDER, "offers", "none"] });
    for (const name of ["add", "drop", "offers"]) assert.deepEqual([heard[name].code, heard[name].text], [1, `${written(heard.due)} Try again then.`], name);
    assert.doesNotMatch(JSON.stringify(reread(w.found)), /Prycing/);
    w.t.done();
  });
  it("is stopped in the words it had while the finish still copies", async () => {
    const w = await exported();
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), ...SPELL);
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.equal(copying.text, STILL.spell);
    w.t.done();
  });
});

describe("handing the video off again, while a finish waits for its late check", () => {
  it("is stopped with the hand-off written and when Studio checks, to say it again then, in the words that hand it off", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { again: ["finish", FOLDER, "--yes"] });
    assert.equal(heard.again.code, 1, heard.again.text);
    assert.ok(heard.again.said.includes(`${written(heard.due)} Say "hand it off" again then.`), heard.again.text);
    assert.doesNotMatch(heard.again.text, /is running/);
    w.t.done();
  });
  it("is stopped in the words of the Reels for the Reels of a finished video", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    const heard = await whileChecking(w, { again: ["finish", FOLDER, "reels", "--yes"] });
    assert.equal(heard.again.code, 1, heard.again.text);
    assert.ok(heard.again.said.includes(`${written(heard.due)} Say "hand off the Reels" again then.`), heard.again.text);
    w.t.done();
  });
  it("is stopped in the words it had while the finish still copies", async () => {
    const w = await exported();
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "finish", FOLDER, "--yes");
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.ok(copying.said.includes(STILL.finish), copying.text);
    w.t.done();
  });
});

describe("a change to the timeline's layers, while a finish waits for its late check", () => {
  it("is stopped with the hand-off written and when Studio checks, to try again then, for each of the layer commands", async () => {
    const w = await exported();
    const heard = await whileChecking(w, LAYERS);
    for (const name of Object.keys(LAYERS)) assert.deepEqual([heard[name].code, heard[name].text], [1, `${written(heard.due)} Try again then.`], name);
    w.t.done();
  });
  it("is stopped in the words it had while the finish still copies", async () => {
    const w = await exported();
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), ...LAYERS.captions);
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.equal(copying.text, STILL.spell);
    w.t.done();
  });
});

describe("asking Claude again, while a finish waits for its late check", () => {
  it("is stopped with the hand-off written and when Studio checks, to say it again then", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { ask: ["ask", FOLDER] }, { tools: { claude: "claude" } });
    assert.deepEqual([heard.ask.code, heard.ask.text], [1, `${written(heard.due, " of 2026-10-14 Pricing talk (Mac Studio)")} Say it again then.`]);
    w.t.done();
  });
});

describe("answering what a video is again, while a finish waits for its late check", () => {
  it("is stopped with the hand-off written and when Studio checks, to say it again then", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { kind: KIND });
    assert.deepEqual([heard.kind.code, heard.kind.text], [1, `${written(heard.due, " of 2026-10-14 Pricing talk (Mac Studio)")} Say it again then.`]);
    w.t.done();
  });
  it("is stopped in the words it had while the finish still copies", async () => {
    const w = await exported();
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), ...KIND);
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.equal(copying.text, STILL.kind);
    w.t.done();
  });
});

describe("the stops, when the finish's marker is not the one the lock is held for", () => {
  /** A raw video whose finish has ended, and then a finish at work on it (the lock is this process's), with a marker if `marker` says so:
      for the revision of the record unless `revision` is given, and for the lock's nonce unless `ownNonce` is false. Gives { w, due }. */
  async function held({ marker = true, revision, ownNonce = true } = {}) {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    const due = w.t.now() + 600000;
    if (marker) markChecking(w.t.home, FOLDER, { nonce: ownNonce ? took.nonce : "another run's nonce", revision: revision ?? reread(w.found).finished.revision, due, took: ["Downloads"] });
    return { w, due };
  }
  it("say the stop, with the time in the marker, when the marker is the lock's and the record holds the revision it names", async () => {
    const { w, due } = await held();
    assert.equal((await on(seeing(w), ...SPELL)).text, `${written(due)} Try again then.`);
    w.t.done();
  });
  it("keep the words they had when there is no marker, when the marker is another run's, and when the record holds another revision", async () => {
    for (const [what, options] of [["no marker", { marker: false }], ["another run's marker", { ownNonce: false }], ["another revision", { revision: 99 }]]) {
      const { w } = await held(options);
      assert.equal((await on(seeing(w), ...SPELL)).text, STILL.spell, what);
      w.t.done();
    }
  });
});

// R1d: a read run whose reading is in the record and which only waits for its own late check stops these in the reading's words.
describe("the stops, while a read run waits for its own late check (R1d)", () => {
  /** A raw episode read by Claude, a live read lock (this process) and, when `early` is true, that run's early result. */
  function reading(early = true, options = {}) {
    const w = guideWorld(options);
    mkdirSync(episodeWork(w.t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "read", () => true).taken, true);
    const ended = w.t.now() - 60000;
    if (early) writeFileSync(resultFile(w.t.home, FOLDER, "read"), JSON.stringify({ version: 1, command: "read", started: ended - 1000, ended, ok: true, made: [], failed: [], next: "", early: true, pid: process.pid }));
    return { w, at: clockAt(ended + LATE_CHECK_MS) };
  }
  const NAMED = { kind: FOLDER, ask: FOLDER };
  it("say when Studio checks Dropbox's copies, from the run's early result, in each command's own words", async () => {
    const { w, at } = reading();
    const says = (argv) => on(seeing(w, { tools: { claude: "claude" } }), ...argv);
    const first = await says(["finish", FOLDER, "--yes"]);
    assert.equal(first.code, 1, first.text);
    assert.ok(first.said.includes(`Claude's reading is written, and Studio checks Dropbox's copies at ${at}. Say "hand it off" again then.`), first.text);
    for (const [what, argv] of [["kind", KIND], ["ask", ["ask", FOLDER]]]) {
      const heard = await says(argv);
      assert.deepEqual([heard.code, heard.text], [1, `Claude's reading of ${NAMED[what]} is written, and Studio checks Dropbox's copies at ${at}. Say it again then.`], what);
    }
    w.t.done();
  });
  it("say their generic words for the hand-off and for free with no early result of that run, and free says its own words with one", async () => {
    for (const early of [false, true]) {
      const { w } = reading(early);
      const off = await on(seeing(w), "finish", FOLDER, "--yes");
      if (early) assert.match(off.text, /Claude's reading is written/);
      else assert.match(off.text, /read is running for this episode\. Say "how far is it\?"/);
      const free = await on(seeing(w), "free", FOLDER);
      assert.doesNotMatch(free.text, /Claude's reading/, free.text);
      assert.match(free.text, /Something is still at work on/, free.text);
      w.t.done();
    }
  });
  it("say their generic words with no early result of that run", async () => {
    const { w } = reading(false);
    for (const argv of [KIND, ["ask", FOLDER]]) {
      const heard = await on(seeing(w, { tools: { claude: "claude" } }), ...argv);
      assert.equal(heard.code, 1);
      assert.doesNotMatch(heard.text, /Claude's reading/);
      assert.match(heard.text, /read is running/);
    }
    w.t.done();
  });
});
