// The guide while a finish waits for its late check (finish.js, finish-check.js): the BRIMM Ops page does not wait for the check. The
// finish is run as the command line runs it, holding the episode's lock, and the guide is asked while it waits; the lock is this
// process's, so the guide is told that this process is the finish run at work. The worlds are guide-world.js's (exports-world.js's
// episode, read by Claude and its spellings answered), reels-world.js's for the Reels of a finished video, and episodes.js's for the
// Final Cut way, with stand-ins for ffprobe, ffmpeg, the transcriber and open: nothing here touches the real home, Downloads,
// Dropbox or a program. The guide writes nothing, but her note when she says she has done a step.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { CHECKING_FILE, markChecking } from "../finish-check.js";
import { OPS_PAGE } from "../guide.js";
import { clockAt } from "../unedited.js";
import { episodeWork } from "../settings.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { ANSWERED, exportOf, whisper } from "./exports-world.js";
import { OFFERS, READ, depsOf, guideWorld } from "./guide-world.js";
import { finishedWorld } from "./reels-world.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
const TAKEN = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
const ONLINE = ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".';
const KIT = 'Press "Write what’s next" and read the "Brief". In "Before posting", pick a title, a thumbnail idea and a subject line. Approve and copy each piece.';
const POSTED = 'Upload it to YouTube Studio with the title, description and chapters. Then tick "Not posted yet" so it says "Posted".';
const POST_TEXT ='Press "Write what’s next", and pick the hook and the YouTube Short title. Approve and copy the caption, the Short\'s title and description, and the LinkedIn post.';
const FINISH_RUNNING = "Its finish is running. The panel shows how far it is.";
const THIS_PROCESS = (pid) => pid === process.pid;
/** What Studio says of its late check, after the guide's lines: when it checks Dropbox's copies (`due`, ms), and what it then takes away. */
const check = (due, where = "the export out of Downloads") => `Studio checks Dropbox's copies at ${clockAt(due)}${where ? `, and then takes ${where}` : ""}. You do not need to wait for it.`;

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** The deps of a guide run that sees this process as the finish run at work. */
const seeing = (w, over = {}) => depsOf(w, { alive: THIS_PROCESS, ...over });
/** Have `then` run once, at the first wait of `waited` milliseconds: the late check's (15 minutes) unless another is given. */
function atWait(t, then, waited = LATE_CHECK_MS) {
  const wait = t.ctx.deps.wait;
  let done = false;
  t.ctx.deps.wait = async (ms) => {
    if (ms === waited && !done) {
      done = true;
      await then();
    }
    return wait(ms);
  };
}
/** A raw video or an iPhone clip, with the exports of its HyperFrames projects in Downloads, and finish asked with a yes. */
async function exported(kind = "raw") {
  const w = guideWorld({ kind, projects: kind === "raw" ? ["main", "reel 2"] : ["main"], programs: { WHISPER: whisper() } });
  exportOf(w, "main");
  if (kind === "raw") exportOf(w, "reel 2");
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  return w;
}
/** Run the finish as the command line runs it. While it waits for its late check, ask the guide each of `asks` (a name for the ask, and
    the words of a guide run), and give back what each said, with `due`, the time the check is made. */
async function whileChecking(w, asks, over = {}) {
  const heard = {};
  atWait(w.t, async () => {
    heard.due = w.t.now() + LATE_CHECK_MS;
    for (const [name, argv] of Object.entries(asks)) heard[name] = await on(seeing(w, over), ...argv);
  });
  assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
  return heard;
}

describe("the guide while a raw video's finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step, and after its lines the line of when Studio checks Dropbox's copies and then takes the export out of Downloads", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
  it("lists the video among those under way with the BRIMM Ops page's step, and the line under it", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { all: ["guide"] });
    assert.deepEqual(heard.all.said, [
      "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio", "Under way:", `  ${NAMED}: ${TAKEN}${ONLINE}`, `    ${check(heard.due)}`
    ]);
    w.t.done();
  });
  it("shows the hand-off in Finder, and opens the BRIMM Ops page, as at any other time", async () => {
    const w = await exported();
    const before = w.t.calls.filter((c) => c.cmd === "/usr/bin/open").length;
    const heard = await whileChecking(w, { show: ["guide", "3fa9c1", "show"], page: ["guide", "page"] });
    assert.deepEqual([heard.show.code, heard.show.said], [0, [`Shown in Finder: the hand-off of ${NAMED}.`]]);
    assert.deepEqual([heard.page.code, heard.page.said], [0, ["Opened the BRIMM Ops page in your browser."]]);
    // The finish showed the hand-off itself (the first call), then `show` did, then `page` opened the page.
    const opened = w.t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args);
    assert.deepEqual(opened.slice(before), [["-R", join(w.found.folder, "final", HANDOFF)], ["-R", join(w.found.folder, "final", HANDOFF)], [OPS_PAGE]]);
    w.t.done();
  });
  it("answers `tell` at once with the page's step, and waits for nothing", async () => {
    const w = await exported();
    let waits = 0;
    const heard = await whileChecking(w, { tell: ["guide", "3fa9c1", "tell"] }, { wait: async () => { waits += 1; } });
    assert.deepEqual([heard.tell.code, heard.tell.said], [0, [`${NAMED}: ${TAKEN}${ONLINE}`]]);
    assert.equal(waits, 0);
    w.t.done();
  });
  it("notes the page's steps as she does them, and says the next step each time with the line after it", async () => {
    const w = await exported();
    const heard = await whileChecking(w, { done: ["guide", "3fa9c1", "done", "taken"] });
    assert.deepEqual(heard.done.said, [`Noted: ${NAMED}, taken.`, `${NAMED}: On the BRIMM Ops page: ${KIT}`, `Then: ${POSTED}`, "Step: kit", check(heard.due)]);
    w.t.done();
  });
  it("is the step of a finish that has ended, without the line, once the run is over", async () => {
    const w = await exported();
    await whileChecking(w, {});
    const after = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(after.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"]);
    assert.equal(existsSync(join(episodeWork(w.t.home, FOLDER), CHECKING_FILE)), false);
    w.t.done();
  });
  it("says its finish is running while the finish still copies, before it has reached the check", async () => {
    const w = await exported();
    // The first look at an export, which the finish waits five seconds before.
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "guide", "3fa9c1");
    }, 5000);
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
  it("says its finish is running while a second finish copies, though the first one's hand-off is written, and the page's step again once that one waits for its check", async () => {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    // A newer export of the main video: finish shows its words again for her yes first, and the next yes starts the finish.
    exportOf(w, "main", { start: [14, 30, 0] });
    const again = { ...w.found, record: reread(w.found) };
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    assert.equal(await finishEpisode(w.t.ctx, again, { yes: true }), 0, w.t.said());
    let copying = null;
    atWait(w.t, async () => {
      copying = await on(seeing(w), "guide", "3fa9c1");
    }, 5000);
    const heard = await whileChecking(w, { second: ["guide", "3fa9c1"] });
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    assert.deepEqual(heard.second.said, [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while an iPhone clip's finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step for a clip, and the line", async () => {
    const w = await exported("short video");
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}`, `Then: ${POST_TEXT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while the Reels of a finished video are handed off, and the finish waits for its late check", () => {
  it("gives the BRIMM Ops page's step for the new revision, and the line", async () => {
    const w = await finishedWorld();
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    const heard = await whileChecking(w, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said, [`${NAMED}: ${TAKEN}`, `Then: ${KIT}`, "Step: taken", check(heard.due)]);
    w.t.done();
  });
});

describe("the guide while a finish of the Final Cut way waits for its late check", () => {
  it("gives the page's step, and the line names From Final Cut as the place the originals are taken from", async () => {
    const t = setup();
    const found = episodeFor(t, { record: { ...EDITED, version: 3, kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS } });
    t.shared(`${PROJECT.main}.mp4`, 2000);
    t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
    t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
    t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
    assert.equal(await finishEpisode(t.ctx, found, { yes: true, noHandEdits: ["reel 2"] }), 0, t.said());
    const heard = await whileChecking({ t, found }, { next: ["guide", "3fa9c1"] });
    assert.equal(heard.next.code, 0, heard.next.text);
    assert.deepEqual(heard.next.said.slice(0, 1), [`${NAMED}: ${TAKEN}${ONLINE}`]);
    assert.equal(heard.next.said.at(-1), check(heard.due, "what it took out of From Final Cut"));
    t.done();
  });
});

describe("a marker the guide does not believe", () => {
  /** A raw video whose finish has ended, so that its hand-off is written and nothing is at work. */
  async function finished() {
    const w = await exported();
    assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
    return w;
  }
  /** A marker for the hand-off the record holds, under `nonce`. */
  const mark = (w, nonce, over = {}) => markChecking(w.t.home, FOLDER, { nonce, revision: reread(w.found).finished.revision, due: w.t.now() + LATE_CHECK_MS, took: ["Downloads"], ...over });
  const STEP = [`${NAMED}: ${TAKEN}${ONLINE}`, `Then: ${KIT}`, "Step: taken"];
  it("is believed with the lock's own nonce, a live finish run and the record's revision, and the guide writes nothing meanwhile", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce);
    const files = readdirSync(episodeWork(w.t.home, FOLDER)).sort();
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, [...STEP, check(w.t.now() + LATE_CHECK_MS)]);
    assert.deepEqual(readdirSync(episodeWork(w.t.home, FOLDER)).sort(), files);
    w.t.done();
  });
  it("is not believed when its run is gone: the finish was killed, and the lock it held is a dead run's", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce);
    const dead = await on(seeing(w, { alive: () => false }), "guide", "3fa9c1");
    assert.deepEqual(dead.said, STEP, "no finish is running: the step, and no line of a check to wait for");
    w.t.done();
  });
  it("is not believed when another finish holds the lock: an older run's marker, and a later finish still copying", async () => {
    const w = await finished();
    takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, "the nonce of the run that was killed");
    const copying = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(copying.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
  it("is not believed when the lock is another command's", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "bring", () => true);
    mark(w, took.nonce);
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, STEP);
    w.t.done();
  });
  it("is not believed once the record no longer holds the finish it names", async () => {
    const w = await finished();
    const took = takeEpisodeLock(lockOf(w.t.home, FOLDER), "finish", () => true);
    mark(w, took.nonce, { revision: reread(w.found).finished.revision + 1 });
    const said = await on(seeing(w), "guide", "3fa9c1");
    assert.deepEqual(said.said, [`${NAMED}: ${FINISH_RUNNING}`]);
    w.t.done();
  });
});
