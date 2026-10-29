// The guide for a finished video whose Reel is exported from HyperFrames (plan PR 16; architecture 2026-10-27, 4.5 and 8.7): what edit.js reads of
// a video her editor finished for it, and what the guide then says. guide.test.js has the words by their facts; here the facts are read from a
// made-up finished video as `guide` reads them: from the record, the hand-off in final/, the Reel projects, their history and records, and
// Downloads, in reels-world.js's world with a home of its own. The guide only reads: no test touches the real home, Downloads, Dropbox or a
// program, and none of these writes anything into the video's.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join, sep } from "node:path";
import { KEPT } from "../app.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { acceptRev, recordFile, recordText } from "../episode.js";
import { finishEpisode } from "../edit.js";
import { fixedZone } from "../exports.js";
import { finishNow } from "../finish.js";
import { NOTHING_UNDER_WAY } from "../guide.js";
import { guideFile, writeGuideNotes } from "../guide-note.js";
import { progressFolder } from "../progress.js";
import { FOLDER, ID, episodeAs, listAll, reread } from "./episodes.js";
import { ANSWERED, REEL2, exportOf } from "./exports-world.js";
import { OFFERS, READ, depsOf } from "./guide-world.js";
import { HANDOFF_REL, finishedWorld } from "./reels-world.js";
import { PLAIN, on } from "./workcopy-world.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const says = (text) => `${NAMED}: ${text}`;
/** What the guide says of Reels exported and not in the hand-off: `names` are the Reels, said together, and `them` is true for more than one. */
const reelLine = (names, them = false) => `You have exported ${names} from HyperFrames. Say "hand off the Reels" to add ${them ? "them" : "it"} to the hand-off.`;
const REEL_2 = reelLine("Reel 2");
const TAKE = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
const TAKE_AGAIN = 'On the BRIMM Ops page: Drag the new hand-off onto the same episode, then press "Take the hand-off".';
const FINISH_RUNNING = "Its finish is running. The panel shows how far it is.";
const HANDOFF_OWED = 'Its hand-off is not written yet. Say "show me the spellings" and answer them again.';
const AT = "2026-10-20T15:00:00-05:00";
const MARKED = { marked: "2026-10-20T08:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
const noted = (step, revision = 1) => ({ version: 1, handoffs: { [ID]: { kind: "episode", step, revision, at: AT } }, finished: {} });

const worlds = [];
/** The finished video of reels-world.js (its hand-off written as revision 1), read by Claude and its spellings answered, with the Reel projects
    given on disk and kept until the tests are done. */
async function W(opts = {}) {
  const w = await finishedWorld({ ...opts, over: { reading: READ("finished"), offers: OFFERS, ...opts.over } });
  worlds.push(w);
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});
/** What `guide` says of the made-up video, in a line, asserting that it ends well and says nothing a path, a flag or a command name would be. */
async function line(w, over) {
  const r = await on(depsOf(w, over), "guide", "3fa9c1");
  assert.equal(r.code, 0, r.text);
  assert.doesNotMatch(r.text, PLAIN);
  return r.said[0];
}
/** The record written again with `change` laid over it, as a command of her chat, the other Mac or the app would leave it. */
function rewrite(w, change) {
  const now = reread(w.found);
  writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...(typeof change === "function" ? change(now) : change) }));
}
/** The app's history in the project of `key`: a turn for each time given. */
function history(w, key, ...turns) {
  const dir = join(w.dirOf(key), ".hyperframes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "app-history.jsonl"), turns.map((at, i) => JSON.stringify({ at, engine: "claude", asked: `Request ${i + 1}`, did: "Done.", files: [] })).join("\n") + "\n");
}
/** A `readdir` that writes down the folders it is asked to list. */
const spy = () => {
  const looked = [];
  return { looked, readdir: (dir) => (looked.push(dir), readdirSync(dir)) };
};
const refused = (dir) => {
  throw Object.assign(new Error(`EPERM: operation not permitted, scandir '${dir}'`), { code: "EPERM" });
};
const LISTED = (w) => [w.downloads, join(w.found.folder, "edit", "from-hyperframes")];

describe("B1. the guide says which Reels of a finished video are exported from HyperFrames, and what to say", () => {
  it("says it of one Reel whether the app's record of the export is in the project or only the file's name tells", async () => {
    for (const record of [true, false]) {
      const w = await W();
      exportOf(w, "reel 2", { record });
      assert.equal(await line(w), says(REEL_2), `record ${record}`);
    }
  });
  it("names the Reels together: two, and three, one of them made from times she gave", async () => {
    const two = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(two, "reel 1");
    exportOf(two, "reel 2");
    assert.equal(await line(two), says(reelLine("Reel 1 and Reel 2", true)));
    const three = await W({ projects: ["reel 1", "reel 2", "reel 3"] });
    for (const key of ["reel 3", "reel 1", "reel 2"]) exportOf(three, key);
    assert.equal(await line(three), says(reelLine("Reel 1, Reel 2 and Reel 3", true)));
  });
  it("says it of the video by its name with no step of the page after it, and lists it as under way in the overview", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const one = await on(depsOf(w), "guide", "3fa9c1");
    assert.deepEqual(one.said, [says(REEL_2)]);
    const all = await on(depsOf(w), "guide");
    assert.deepEqual(all.said, [DROP_LINE, "Under way:", `  ${NAMED}: ${REEL_2}`]);
    assert.doesNotMatch(all.text, PLAIN);
  });
  it("says it of a Reel that has no title yet: finish asks for the title once she says it, which is not another export to wait for", async () => {
    const w = await W();
    rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) }));
    exportOf(w, "reel 2");
    assert.equal(await line(w), says(REEL_2));
    const asked = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.equal(asked.code, 0, asked.said.join("\n"));
    assert.ok(asked.said.some((said) => said.startsWith("Reel 2 has no title on screen.")), asked.said.join("\n"));
  });
  it("says it ahead of the page's steps, whatever her note holds and however old the hand-off is", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    assert.equal(await line(w), says(REEL_2));
    // Every step of the page noted: without a Reel waiting the video is done, and with one it is not.
    writeGuideNotes(w.t.home, noted("cascade"));
    assert.equal(await line(w), says(REEL_2));
    // A hand-off 111 days old is done for the page's steps, and not for a Reel exported today.
    rewrite(w, (now) => ({ finished: { ...now.finished, at: "2026-07-01T10:00:00-05:00" } }));
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: {} });
    assert.equal(await line(w), says(REEL_2));
  });
  it("has the page's step while no Reel is exported, and done once every step of it is noted", async () => {
    const w = await W();
    assert.equal(await line(w), says(TAKE));
    writeGuideNotes(w.t.home, noted("cascade"));
    const done = await on(depsOf(w), "guide", "3fa9c1");
    assert.deepEqual(done.said, [`${NAMED} is done: nothing is left to do for it.`]);
  });
  it("says it in plain words for an episode named with an accent and a quote: no project's name, no file's name, no path", async () => {
    const name = 'Café "talk"';
    const w = await W({ name });
    exportOf(w, "reel 2");
    const said = await line(w);
    assert.equal(said, `${name} (3fa9c1): ${REEL_2}`);
    assert.ok(!said.includes(w.names["reel 2"]) && !/\.mp4|\d\d\.\d\d/.test(said), said);
  });
});

describe("B2. what changes nothing: the page's step stands", () => {
  const cases = {
    "a Reel project open in the app and not exported": async (w) => history(w, "reel 2", "2026-10-20T14:41:00-05:00"),
    "an export that began before the project last changed": async (w) => exportOf(w, "reel 2", { start: [13, 30, 0] }),
    "an export that began before the project's last request in the app": async (w) => {
      exportOf(w, "reel 2");
      history(w, "reel 2", "2026-10-20T14:41:00-05:00");
    },
    "an export of the name alone that began before the project last changed": async (w) => exportOf(w, "reel 2", { start: [13, 30, 0], record: false }),
    "a WebM": async (w) => exportOf(w, "reel 2", { ending: "webm" }),
    "another project's export": async (w) => exportOf(w, "reel 2", { name: "Other talk reel 2 3fa9c1 2026-10-20 14.03.mp4", record: false }),
    "an empty file": async (w) => exportOf(w, "reel 2", { text: "" }),
    "a Reel she dropped after its project was made": async (w) => {
      exportOf(w, "reel 2");
      rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r)) }));
    },
    "a project kept for an earlier kind": async (w) => {
      exportOf(w, "reel 2");
      rewrite(w, (now) => ({ app: { ...now.app, projects: now.app.projects.map((p) => ({ ...p, state: KEPT })) } }));
    },
    "a project whose folder is not on this Mac": async (w) => {
      exportOf(w, "reel 2");
      rmSync(w.dirOf("reel 2"), { recursive: true });
    },
    "an export of a Reel the record does not hold": async (w) => {
      exportOf(w, "reel 2");
      rewrite(w, (now) => ({ reels: now.reels.filter((r) => r.n !== 2) }));
    }
  };
  for (const [what, make] of Object.entries(cases)) {
    it(`is ${what}`, async () => {
      const w = await W();
      await make(w);
      assert.equal(await line(w), says(TAKE));
    });
  }
  it("is any trouble in reading the exports that nobody foresaw: the guide only reads, and no trouble stops it (review F7)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    // A zone that cannot place a moment makes the reading of the export's name throw inside exportsFound.
    const said = await on(depsOf(w, { zone: {} }), "guide", "3fa9c1");
    assert.deepEqual([said.code, said.said[0]], [0, says(TAKE)], said.text);
  });
  it("reads the day and the time on an export's name in the zone it is given and not in this Mac's own: east of the project's zone by 14 hours the export is older than the project's last change, and in the project's own it is not (review F7)", async () => {
    // Two zones that give different answers, so that one of them differs from this Mac's own whichever Mac this is: the export is named 14.03, and the
    // project last changed at 13:40 in UTC-5. Read in UTC+9 the export began at 05:03 UTC, before the change at 18:40 UTC.
    const w = await W();
    exportOf(w, "reel 2");
    assert.equal(await line(w, { zone: fixedZone(-300) }), says(REEL_2));
    assert.equal(await line(w, { zone: fixedZone(540) }), says(TAKE));
  });
  it("is a Downloads folder this Mac will not let be read, and a Reel project with no export at all", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    assert.equal(await line(w, { readdir: refused }), says(TAKE));
    const none = await W();
    assert.equal(await line(none), says(TAKE));
  });
});

describe("B3. a Reel in the hand-off", () => {
  /** `finish … reels` asked for with a yes and run to its end, as finish-reels-now.test.js runs it. */
  async function handedOff(w, answers = {}) {
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, ...answers }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) });
    assert.equal(result.ok, true, result.failed.join(" "));
  }
  it("is not said once finish has put it there: the page's step comes back for revision 2, as it was noted for revision 1", async () => {
    const w = await W();
    writeGuideNotes(w.t.home, noted("kit"));
    exportOf(w, "reel 2");
    assert.equal(await line(w), says(REEL_2));
    await handedOff(w);
    assert.equal(reread(w.found).finished.revision, 2);
    assert.deepEqual(readdirSync(w.downloads), [], "what it took from Downloads is removed after the late check");
    assert.equal(await line(w), says(TAKE_AGAIN));
  });
  it("is not said while the export it took is still in Downloads, the same size and time: the late check has not made yet", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    await handedOff(w);
    exportOf(w, "reel 2", { record: false });
    assert.equal(await line(w), says(TAKE));
  });
  it("is said again when the Reel is exported again, with the same words: finish replaces the Reel's entry", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    await handedOff(w);
    exportOf(w, "reel 2", { start: [14, 30, 0], text: "the export of reel 2, again" });
    assert.equal(await line(w), says(REEL_2));
  });
  it("names only the Reel that is not there yet when another is", async () => {
    const w = await W({ projects: ["reel 2", "reel 3"] });
    exportOf(w, "reel 2");
    await handedOff(w, { without: ["reel 3"] });
    assert.equal(await line(w), says(TAKE));
    exportOf(w, "reel 3");
    assert.equal(await line(w), says(reelLine("Reel 3")));
  });
  it("is not said for a Reel she changed in the app after its hand-off, with no export since: finish asks her to export it again", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    await handedOff(w);
    history(w, "reel 2", "2026-10-20T16:30:00-05:00");
    assert.equal(await line(w), says(TAKE));
  });
});

describe("B4. two exports of one Reel in one minute, and an older one", () => {
  it("says it when an MP4 and a MOV began in one minute after the last change, and when a file has a copy the system numbered: finish asks which is final (ruling 2)", async () => {
    for (const [what, make] of [
      ["an MP4 and a MOV", (w) => { exportOf(w, "reel 2", { record: false }); exportOf(w, "reel 2", { ending: "mov", record: false }); }],
      ["a file and its numbered copy", (w) => { exportOf(w, "reel 2", { record: false }); exportOf(w, "reel 2", { name: `${REEL2} 2026-10-20 14.03 (1).mp4`, record: false }); }],
      ["an MP4 the app's record names and a MOV it does not", (w) => { exportOf(w, "reel 2"); exportOf(w, "reel 2", { ending: "mov", record: false }); }]
    ]) {
      const w = await W();
      make(w);
      assert.equal(await line(w), says(REEL_2), what);
    }
  });
  it("does not say it when both began before the project last changed", async () => {
    const w = await W();
    exportOf(w, "reel 2", { start: [13, 30, 0], record: false });
    exportOf(w, "reel 2", { start: [13, 30, 0], ending: "mov", record: false });
    assert.equal(await line(w), says(TAKE));
  });
  it("says the Reels that are ready and not the one with an older export", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 1", { start: [13, 30, 0] });
    exportOf(w, "reel 2");
    assert.equal(await line(w), says(REEL_2));
  });
  it("says the Reels in the order of their numbers, the one with two exports in a minute among them", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 1", { record: false });
    exportOf(w, "reel 1", { ending: "mov", record: false });
    exportOf(w, "reel 2");
    assert.equal(await line(w), says(reelLine("Reel 1 and Reel 2", true)));
  });
});

describe("B5. where finish would go no further, the guide says nothing new", () => {
  it("has no Reel line before the hand-off is written: the stage the video had, and Downloads not listed", async () => {
    const w = await W({ handoff: false });
    exportOf(w, "reel 2");
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(HANDOFF_OWED));
    assert.deepEqual(looked, []);
  });
  for (const [what, make] of [
    ["was not made from the import's captions", (w) => rewrite(w, (now) => ({ finished: { ...now.finished, parts: { ...now.finished.parts, main: { ...now.finished.parts.main, import: false } } } }))],
    ["was made as another kind than the video is now", (w) => rewrite(w, (now) => ({ finished: { ...now.finished, parts: { ...now.finished.parts, main: { ...now.finished.parts.main, kind: "short video" } } } }))],
    ["is named where final/ is not directly", (w) => rewrite(w, (now) => ({ finished: { ...now.finished, handoff: "final/more/Pricing- what to charge-.brimm-ops.json" } }))],
    ["is not there", (w) => rmSync(join(w.found.folder, HANDOFF_REL))],
    ["cannot be read", (w) => writeFileSync(join(w.found.folder, HANDOFF_REL), "not json")],
    ["is not a finished video's", (w) => writeFileSync(join(w.found.folder, HANDOFF_REL), JSON.stringify({ ...JSON.parse(readFileSync(join(w.found.folder, HANDOFF_REL), "utf8")), video: { id: ID, kind: "raw", name: "x" } }))]
  ]) {
    it(`has no Reel line when the hand-off ${what}, and Downloads is not listed`, async () => {
      const w = await W();
      exportOf(w, "reel 2");
      make(w);
      const { looked, readdir } = spy();
      const said = await line(w, { readdir });
      assert.doesNotMatch(said, /hand off the Reels/, said);
      assert.deepEqual(looked, []);
    });
  }
  it("has the Reel line when the hand-off is not whole on this Mac: finish brings it over and asks her to say it again", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    assert.equal(await line(w, { isWhole: (path) => !path.endsWith(".brimm-ops.json") }), says(REEL_2));
  });
  it("has the page's step when the other Mac has the episode open: finish is refused there", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { editing: { by: "Sallie's laptop", since: AT } });
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(TAKE));
    assert.deepEqual(looked, []);
  });
  // The review of PR 16, F1: finish refuses while any run is at work on the episode, and says so in its own words; only a finish at work is the
  // guide's stage of its own (ruling 4). Another run is a bring, a read or an ask, and `finish` itself starts a bring for a hand-off that is not whole.
  for (const command of ["bring", "read", "ask"]) {
    it(`has the page's step while a ${command} run is at work, which finish refuses, and the Reel line once the run is done (review F1)`, async () => {
      const w = await W();
      exportOf(w, "reel 2");
      const lock = lockOf(w.t.home, FOLDER);
      assert.equal(takeEpisodeLock(lock, command, () => true).taken, true);
      w.t.ctx.deps.alive = (pid) => pid === process.pid;
      const { looked, readdir } = spy();
      assert.equal(await line(w, { readdir }), says(TAKE));
      assert.deepEqual(looked, [], "Downloads is not listed while another run is at work");
      const asked = await on(depsOf(w), "finish", FOLDER, "reels");
      assert.equal(asked.code, 1, asked.said.join("\n"));
      assert.ok(asked.said.includes(`${command} is running for this episode. Say "how far is it?"`), asked.said.join("\n"));
      rmSync(lock);
      assert.equal(await line(w), says(REEL_2));
    });
  }
  it("has the page's step while a bring is at work for a hand-off that is not whole, and the Reel line once it is whole: finish starts the bring, and the guide does not send her round again (review F1)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const notWhole = { isWhole: (path) => !path.endsWith(".brimm-ops.json") };
    assert.equal(await line(w, notWhole), says(REEL_2));
    const asked = await on(depsOf(w, notWhole), "finish", FOLDER, "reels");
    assert.equal(asked.code, 1, asked.said.join("\n"));
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, HANDOFF_REL]]);
    // The bring is at work (the stand-in does not run it: its lock is taken here).
    assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "bring", () => true).taken, true);
    w.t.ctx.deps.alive = (pid) => pid === process.pid;
    assert.equal(await line(w, notWhole), says(TAKE));
  });
  it("has the page's step when the video says it is a version of one that is not on this Mac yet: finish stops at once, and the Reel line is back when it is (review F2a)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { versionOf: "e-20261001-aaaaaa" });
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(TAKE));
    assert.deepEqual(looked, [], "Downloads is not listed");
    const asked = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.equal(asked.code, 1, asked.said.join("\n"));
    assert.match(asked.said.join("\n"), /is a new version of a video that is not on this Mac yet \(e-20261001-aaaaaa\)/);
    rewrite(w, { versionOf: undefined });
    assert.equal(await line(w), says(REEL_2));
  });
  it("has the page's step when Dropbox undid this Mac's last change to the record: finish stops once and says it again, and the Reel line is back once it has (review F2c)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    acceptRev(w.t.home, ID, reread(w.found).rev + 5);
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(TAKE));
    assert.deepEqual(looked, [], "Downloads is not listed");
    const first = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.equal(first.code, 1, first.said.join("\n"));
    assert.ok(first.said.includes("Dropbox undid this Mac's last change to Pricing: what to charge?. Say it again."), first.said.join("\n"));
    // `finish` took the rev it found: the second time goes on, and so does the guide.
    assert.equal(await line(w), says(REEL_2));
    assert.equal((await on(depsOf(w), "finish", FOLDER, "reels")).code, 0);
  });
  it("reads a hand-off that is a link to a regular file as one that cannot be read, though finish follows the link: Studio never makes a link there, and the guide's reader follows none (review F4, ruling 7)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const handoff = join(w.found.folder, HANDOFF_REL);
    const copy = join(w.t.dir, "copy.brimm-ops.json");
    copyFileSync(handoff, copy);
    rmSync(handoff);
    symlinkSync(copy, handoff);
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(TAKE));
    assert.deepEqual(looked, [], "Downloads is not listed");
    const asked = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.equal(asked.code, 0, asked.said.join("\n"));
    // The hand-off as a regular file, the same copy: the Reel line.
    rmSync(handoff);
    copyFileSync(copy, handoff);
    assert.equal(await line(w), says(REEL_2));
  });
  it("has the page's step for a Reel project that is only on the other Mac, though finish takes its export from Downloads: the guide reads Downloads only for a project that is here, as for the main video (review F3)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rmSync(w.dirOf("reel 2"), { recursive: true });
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(TAKE));
    assert.deepEqual(looked, [], "Downloads is not listed");
    const asked = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.equal(asked.code, 0, asked.said.join("\n"));
    assert.match(asked.said.join("\n"), /Its project is on Mac Studio, so the export could not be checked against it\./);
  });
  it("has the Reel line on a Mac whose settings say version 1 when the hand-off on file is version 2, as finish goes on there", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    assert.equal(await line(w, { settings: { ...w.t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 1 } }), says(REEL_2));
  });
  it("says its finish is running while one runs, where a Reel waits, and the page's step where none does (ruling 4)", async () => {
    const waiting = await W();
    exportOf(waiting, "reel 2");
    assert.equal(takeEpisodeLock(lockOf(waiting.t.home, FOLDER), "finish", () => true).taken, true);
    waiting.t.ctx.deps.alive = (pid) => pid === process.pid;
    assert.equal(await line(waiting), says(FINISH_RUNNING));
    const quiet = await W();
    assert.equal(takeEpisodeLock(lockOf(quiet.t.home, FOLDER), "finish", () => true).taken, true);
    quiet.t.ctx.deps.alive = (pid) => pid === process.pid;
    assert.equal(await line(quiet), says(TAKE));
  });
});

describe("B6. a video the gate holds", () => {
  it("has the page's step of its written hand-off, and nothing of its Reel projects or Downloads is read, though a Reel is exported (plan PR 10, review I2)", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { session: MARKED });
    const { looked, readdir } = spy();
    const said = await line(w, { readdir });
    // A video the gate holds is named by its label and short id, never by its name.
    const [name, ...rest] = said.split("): ");
    assert.match(`${name})`, /\(3fa9c1\)$/, said);
    assert.equal(rest.join("): "), TAKE, said);
    assert.deepEqual(looked, []);
  });
  it("is held, and nothing of it read, when a session is a version of it", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    episodeAs(w.t, { id: "e-20261020-a2a2a2", name: "2026-10-20 Group call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: MARKED, versionOf: ID, imported: { on: "Mac Studio", at: "2026-10-20T10:00:00-05:00" } } });
    const { looked, readdir } = spy();
    const said = await line(w, { readdir });
    assert.match(said, /^a video \(3fa9c1\): One of its other versions is a client or group session\. Say "it was a session after all" for this one too\.$/);
    assert.deepEqual(looked, []);
  });
  it("is an ordinary video once the mark is cleared", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    rewrite(w, { session: { ...MARKED, cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } } });
    assert.equal(await line(w), says(REEL_2));
  });
});

describe("B7. where the guide reads", () => {
  it("lists Downloads and what the other Mac released, once, for a finished video with a hand-off and a Reel project here, and no other place", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const { looked, readdir } = spy();
    assert.equal(await line(w, { readdir }), says(REEL_2));
    assert.deepEqual(looked, LISTED(w));
  });
  for (const [what, opts, make] of [
    ["no Reel project", { projects: [] }, () => {}],
    ["a Reel project only on the other Mac", {}, (w) => rmSync(w.dirOf("reel 2"), { recursive: true })],
    ["a Reel she dropped", {}, (w) => rewrite(w, (now) => ({ reels: now.reels.map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r)) }))],
    ["a project kept for an earlier kind", {}, (w) => rewrite(w, (now) => ({ app: { ...now.app, projects: now.app.projects.map((p) => ({ ...p, state: KEPT })) } }))],
    // ".." is a folder that is there: only its name keeps it from being the project.
    ["a project whose name is not one folder's", {}, (w) => rewrite(w, (now) => ({ app: { ...now.app, projects: now.app.projects.map((p) => ({ ...p, name: ".." })) } }))]
  ]) {
    it(`does not list them for ${what}`, async () => {
      const w = await W(opts);
      make(w);
      const { looked, readdir } = spy();
      assert.equal(await line(w, { readdir }), says(TAKE));
      assert.deepEqual(looked, []);
    });
  }
  it("does not list them for a raw video or an iPhone clip with a hand-off and Reel projects: the page's step stands", async () => {
    for (const kind of ["raw", "short video"]) {
      const w = await W();
      exportOf(w, "reel 2");
      rewrite(w, { kind, answer: { ...ANSWERED, guess: null } });
      const { looked, readdir } = spy();
      const said = await line(w, { readdir });
      assert.doesNotMatch(said, /hand off the Reels/, `${kind}: ${said}`);
      assert.deepEqual(looked, [], kind);
    }
  });
});

describe("B7b. a video she set aside is read for nothing of its Reels (review F6)", () => {
  /** The paths this process asks the file system about while `run` goes: the functions of `fs` that look at a path are wrapped, and put back
      whatever happens. (The test files run one by one, and each test in a file after the one before, so nothing else is looking meanwhile.) */
  async function touched(run) {
    const names = ["statSync", "lstatSync", "readdirSync", "readFileSync", "openSync", "existsSync", "realpathSync", "accessSync", "readlinkSync", "opendirSync"];
    const real = Object.fromEntries(names.map((name) => [name, fs[name]]));
    const paths = new Set();
    for (const name of names) {
      fs[name] = function (...args) {
        if (typeof args[0] === "string") paths.add(args[0]);
        return real[name].apply(this, args);
      };
    }
    syncBuiltinESMExports();
    try {
      await run();
    } finally {
      Object.assign(fs, real);
      syncBuiltinESMExports();
    }
    return [...paths];
  }
  const inside = (dir) => (path) => path === dir || path.startsWith(`${dir}${sep}`);
  it("looks in no Reel project and no Downloads, nor in what the other Mac released, for a video she said was finished, in every form that reads: the overview, the video, wait and tell", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    exportOf(w, "reel 2");
    // (The episode's lock, in the work folder, is looked at for every video: whether a run is at work is the guide's own business.)
    const places = [w.dirOf("reel 1"), w.dirOf("reel 2"), w.downloads, join(w.found.folder, "edit")].map(inside);
    const reads = async () => {
      const said = [];
      const paths = await touched(async () => {
        for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", "wait"], ["guide", "3fa9c1", "tell"]]) said.push((await on(depsOf(w), ...argv)).said);
      });
      return { said, paths: paths.filter((path) => places.some((is) => is(path))) };
    };
    // The same video before she said it: its projects and Downloads are looked in (the control, so that this test would see a read at all).
    const before = await reads();
    assert.ok(before.paths.some(inside(w.downloads)), "Downloads is read for a video not set aside");
    assert.ok(before.paths.some(inside(w.dirOf("reel 2"))), "its Reel project is read for a video not set aside");
    assert.ok(before.said.every((lines) => lines.some((said) => said.includes(REEL_2))), JSON.stringify(before.said));
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: { [ID]: AT } });
    const after = await reads();
    assert.deepEqual(after.paths, [], "nothing of its Reel projects or Downloads is looked in");
    assert.deepEqual(after.said, [[DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`], [DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`]]);
  });
});

describe("B8. the other forms of the guide, at this stage", () => {
  it("answers `guide wait` at once, and tells her the line at once when asked to tell her", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const waited = await on(depsOf(w), "guide", "wait");
    assert.deepEqual(waited.said, [DROP_LINE, "Under way:", `  ${NAMED}: ${REEL_2}`]);
    const told = await on(depsOf(w), "guide", "3fa9c1", "tell");
    assert.deepEqual([told.code, told.said], [0, [says(REEL_2)]]);
    assert.deepEqual(w.t.waits, []);
  });
  it("is no step of the page's to note, or to show in Finder", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const done = await on(depsOf(w), "guide", "3fa9c1", "done", "taken");
    assert.deepEqual([done.code, done.said], [1, [`Not noted: ${NAMED} has no step on the BRIMM Ops page now. ${REEL_2}`]]);
    const shown = await on(depsOf(w), "guide", "3fa9c1", "show");
    assert.deepEqual([shown.code, shown.said], [1, [`There is nothing to show in Finder for ${NAMED} now.`]]);
    assert.equal(w.t.opened.length, 0);
  });
  it("lets her set the video aside: her word that it is finished stands, and the guide then says nothing of its Reels (ruling 1); finish still takes them", async () => {
    const w = await W();
    exportOf(w, "reel 2");
    const finished = await on(depsOf(w), "guide", "3fa9c1", "finished");
    assert.deepEqual([finished.code, finished.said], [0, [`${NAMED} is no longer under way.`]]);
    assert.deepEqual((await on(depsOf(w), "guide")).said, [DROP_LINE, NOTHING_UNDER_WAY]);
    assert.deepEqual((await on(depsOf(w), "guide", "3fa9c1")).said, [`${NAMED} is done: nothing is left to do for it.`]);
    // Her note is the guide's: `finish` does not look at it.
    const asked = await on(depsOf(w), "finish", FOLDER, "reels");
    assert.deepEqual([asked.code, asked.said.at(-1)], [0, 'Say "yes, hand off the Reels" to start.']);
  });
});

describe("B10. the guide reads and writes nothing of the video's", () => {
  const contents = (dir) => Object.fromEntries(listAll(dir).map((file) => [file, readFileSync(join(dir, file), "utf8")]));
  const snapshot = (w) => [reread(w.found).rev, listAll(w.found.folder), contents(w.work), contents(w.downloads), contents(progressFolder(w.t.home))];
  it("leaves the record, the projects, Downloads, final/ and the panel's files as they were, in every form, and writes no note of hers", async () => {
    const w = await W({ projects: ["reel 1", "reel 2"] });
    history(w, "reel 1", "2026-10-20T14:41:00-05:00");
    exportOf(w, "reel 2");
    const before = snapshot(w);
    for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", "wait"], ["guide", "3fa9c1", "show"], ["guide", "3fa9c1", "tell"], ["guide", "3fa9c1", "done", "taken"]]) await on(depsOf(w), ...argv);
    assert.deepEqual(snapshot(w), before);
    assert.throws(() => readFileSync(guideFile(w.t.home)), { code: "ENOENT" });
  });
});
