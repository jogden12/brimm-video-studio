// Where the guide reads, and how often (plan PR 17; the review of PR 10, M5, and the rule of the review of PR 16, F6, for a raw video): what the guide looks in for
// an export of a video in HyperFrames is its project, Downloads and what the other Mac released into the episode. A video she set aside is looked in for none
// of them, and Downloads is listed once for a pass, however many videos look in it: a pass is one reading of every video, as `guide` makes one, `guide wait`'s
// every 5 seconds and `guide … tell`'s every 15 another, and each video that looked in Downloads used to list it by itself, 20 to 50 ms each. The file system's
// own functions are watched while the guide runs, in made-up worlds with a home of their own: no test touches the real home, Downloads, Dropbox or a program,
// and the guide writes nothing.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { recordFile, recordText } from "../episode.js";
import { NOTHING_UNDER_WAY } from "../guide.js";
import { writeGuideNotes } from "../guide-note.js";
import { PIN } from "../hyperframes.js";
import { episodeWork } from "../settings.js";
import { workCopyLockOf } from "../workcopy.js";
import { FOLDER, ID, episodeAs, reread } from "./episodes.js";
import { ANSWERED, AT, entry, exportOf, ms, named } from "./exports-world.js";
import { OFFERS, READ, depsOf, guideWorld } from "./guide-world.js";
import { finishedWorld } from "./reels-world.js";
import { atWork, on } from "./workcopy-world.js";
import { watched } from "./watched-fs.js";

const NAMED = "Pricing: what to charge? (3fa9c1)";
const DROP_LINE = "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Mac Studio";
const EXPORTED = 'You have exported it from HyperFrames. Say "hand it off" to write its hand-off.';
const IN_APP = 'Edit it in HyperFrames. When you are done, export it on This Mac, as MP4, then say "hand it off".';
const REEL_2 = 'You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.';
const TAKE = 'On the BRIMM Ops page: Drag the hand-off onto Episodes, then press "Take the hand-off".';
const CLEAR = 'It is held as a client or group session. If it is not one, say "clear the session mark".';
const MARKED = { marked: "2026-10-20T08:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };

const worlds = [];
const kept = (w) => (worlds.push(w), w);
after(() => {
  for (const w of worlds) w.t.done();
});
/** The made-up episode of guide-world.js: a raw video with a main project here and no hand-off, with an export of it in Downloads unless `exported` is false
    (or it has no project). */
function raw({ exported = true, ...opts } = {}) {
  const w = kept(guideWorld(opts));
  if (exported && opts.projects !== null) exportOf(w, "main");
  return w;
}
/** The finished video of reels-world.js, read by Claude and its spellings answered, with its hand-off written (revision 1) and the project of Reel 2 (or of
    the Reels in `projects`); Reel 2 is exported unless `exported` is false. */
async function finished({ exported = true, ...opts } = {}) {
  const w = kept(await finishedWorld({ ...opts, over: { reading: READ("finished"), offers: OFFERS, ...opts.over } }));
  if (exported && (opts.projects ?? ["reel 2"]).includes("reel 2")) exportOf(w, "reel 2");
  return w;
}
/** Another raw video in the same made-up root, number `n`: read by Claude, its spellings answered, its main project on disk (last changed at 13:40) and, with
    `exported`, an export of it in Downloads that began after. `over` changes its record. `line(said)` is what the guide says of it. */
function another(w, { n = 2, exported = true, over = {} } = {}) {
  const short = `${n}${n}b${n}${n}b`;
  const folder = `2026-10-20 Talk ${n} (Mac Studio)`;
  const name = `Talk ${n}`;
  const project = `Talk ${n} main ${short}`;
  episodeAs(w.t, { id: `e-20261020-${short}`, name: folder, record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: name, placeholder: false }, app: { toolchain: PIN.version, projects: [entry("main", { name: project })] }, ...over } });
  const dir = join(episodeWork(w.t.home, folder), project);
  mkdirSync(join(dir, "renders"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<html></html>");
  utimesSync(join(dir, "index.html"), new Date(ms(13, 40)), new Date(ms(13, 40)));
  if (exported) {
    const file = join(w.downloads, named(project, "13.56"));
    writeFileSync(file, `the export of ${name}`);
    utimesSync(file, new Date(ms(13, 58)), new Date(ms(13, 58)));
  }
  return { id: `e-20261020-${short}`, short, folder, name, project, dir, line: (said) => `${name} (${short}): ${said}` };
}
/** The record written again with `change` laid over it, as a command of her chat, the other Mac or the app would leave it. */
function rewrite(w, change) {
  const now = reread(w.found);
  writeFileSync(recordFile(w.found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...change }));
}
const sorted = (lines) => [...lines].sort();
/** What a guide run makes of the file system: how many times Downloads was listed, and each episode's folder of what the other Mac released that was. */
async function listings(w, run) {
  const { result, calls } = await watched(run, { names: ["readdirSync"] });
  return { result, downloads: calls.filter((call) => call.path === w.downloads).length, released: calls.map((call) => call.path).filter((path) => path.endsWith(join("edit", "from-hyperframes"))).sort() };
}
const releasedOf = (w, ...folders) => [join(w.found.folder, "edit", "from-hyperframes"), ...folders.map((folder) => join(w.t.root, "Episodes", folder, "edit", "from-hyperframes"))].sort();
/** `readdirSync` refused for Downloads, as macOS refuses a program it has not been allowed to look in it. */
const refusedDownloads = (w) => ({ deny: (name, path) => (path === w.downloads ? Object.assign(new Error(`EPERM: operation not permitted, scandir '${path}'`), { code: "EPERM" }) : null) });

describe("a raw video she set aside is read for nothing of its project (plan PR 17, the rule of the review of PR 16, F6, for a raw video)", () => {
  /** The functions of `fs` that look at a path, watched while `run` goes: the paths they were asked about. */
  const names = ["statSync", "lstatSync", "readdirSync", "readFileSync", "openSync", "existsSync", "realpathSync", "accessSync", "readlinkSync", "opendirSync"];
  const inside = (dir) => (path) => path === dir || path.startsWith(`${dir}${sep}`);
  it("looks in its project, Downloads and what the other Mac released for none of the forms that read, once she said it was finished: the overview, the video, wait and tell", async () => {
    const w = raw();
    const places = [w.dirOf("main"), w.downloads, join(w.found.folder, "edit")].map(inside);
    const reads = async () => {
      const said = [];
      const { calls } = await watched(async () => {
        for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", "wait"], ["guide", "3fa9c1", "tell"]]) said.push((await on(depsOf(w), ...argv)).said);
      }, { names });
      return { said, paths: calls.map((call) => call.path).filter((path) => places.some((is) => is(path))) };
    };
    // The same video before she said it: its project and Downloads are looked in (the control, so that this test would see a read at all).
    const before = await reads();
    assert.ok(before.paths.some(inside(w.downloads)), "Downloads is read for a video not set aside");
    assert.ok(before.paths.some(inside(w.dirOf("main"))), "its project is read for a video not set aside");
    assert.ok(before.said.every((lines) => lines.some((said) => said.includes(EXPORTED))), JSON.stringify(before.said));
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: { [ID]: AT } });
    const after = await reads();
    assert.deepEqual(after.paths, [], "nothing of its project or Downloads is looked in");
    assert.deepEqual(after.said, [[DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`], [DROP_LINE, NOTHING_UNDER_WAY], [`${NAMED} is done: nothing is left to do for it.`]]);
  });
});

describe("the guide lists Downloads once for a pass, however many videos look in it (plan PR 17; the review of PR 10, M5)", () => {
  it("lists it once when two raw videos in HyperFrames look for an export, tells each what it was told, and lists each video's own folder of what the other Mac released once", async () => {
    const w = raw();
    const b = another(w);
    const { result, downloads, released } = await listings(w, () => on(depsOf(w), "guide"));
    assert.equal(result.code, 0, result.text);
    assert.equal(downloads, 1, "Downloads is listed once");
    assert.deepEqual(released, releasedOf(w, b.folder));
    assert.deepEqual(sorted(result.said), sorted([DROP_LINE, "Under way:", `  ${NAMED}: ${EXPORTED}`, `  ${b.line(EXPORTED)}`]));
  });
  it("tells each video the export that is its own, though every export is in the one listing: a video with none is told it is in HyperFrames", async () => {
    const w = raw();
    const b = another(w, { n: 2, exported: false });
    const c = another(w, { n: 3 });
    const { result, downloads } = await listings(w, () => on(depsOf(w), "guide"));
    assert.equal(downloads, 1);
    assert.deepEqual(sorted(result.said), sorted([DROP_LINE, "Under way:", `  ${NAMED}: ${EXPORTED}`, `  ${b.line(IN_APP)}`, `  ${c.line(EXPORTED)}`]));
  });
  it("lists it once for a raw video and a finished video's Reels, and tells each what it was told", async () => {
    const w = await finished();
    const b = another(w);
    const { result, downloads, released } = await listings(w, () => on(depsOf(w), "guide"));
    assert.equal(downloads, 1);
    assert.deepEqual(released, releasedOf(w, b.folder));
    assert.deepEqual(sorted(result.said), sorted([DROP_LINE, "Under way:", `  ${NAMED}: ${REEL_2}`, `  ${b.line(EXPORTED)}`]));
  });
  it("lists it once whichever form of the guide reads: the overview, one video by its short id, and another by its name", async () => {
    const w = raw();
    const b = another(w);
    for (const argv of [["guide"], ["guide", "3fa9c1"], ["guide", b.short], ["guide", b.name]]) {
      const { result, downloads } = await listings(w, () => on(depsOf(w), ...argv));
      assert.equal(result.code, 0, result.text);
      assert.equal(downloads, 1, argv.join(" "));
    }
  });
});

describe("Downloads is listed for no video that does not look in it, for none the gate holds and for none she set aside", () => {
  it("is not listed when no video has a project to look for an export of: a raw video with no project, a raw video with its hand-off written, a finished video with no Reel project", async () => {
    const none = raw({ projects: null });
    assert.equal((await listings(none, () => on(depsOf(none), "guide"))).downloads, 0, "no project");
    const written = raw({ over: { finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } } });
    mkdirSync(join(written.found.folder, "final"), { recursive: true });
    writeFileSync(join(written.found.folder, "final", "Pricing talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID, kind: "raw", name: "Pricing talk" }, main: { file: "Pricing talk.mov" } }));
    assert.equal((await listings(written, () => on(depsOf(written), "guide"))).downloads, 0, "a hand-off written");
    const noReel = await finished({ projects: [] });
    assert.equal((await listings(noReel, () => on(depsOf(noReel), "guide"))).downloads, 0, "no Reel project");
  });
  it("is listed once, by the one video that looks in it, beside a video the gate holds, a raw video she set aside and a finished video she set aside", async () => {
    // The finished video, with its Reel exported, is set aside; the raw videos have projects and exports of their own, one held by the gate, one set aside.
    const w = await finished();
    const held = another(w, { n: 2, over: { session: MARKED } });
    const aside = another(w, { n: 3 });
    const active = another(w, { n: 4 });
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: { [ID]: AT, [aside.id]: AT } });
    const { result, downloads } = await listings(w, () => on(depsOf(w), "guide"));
    assert.equal(downloads, 1, "only the video that is under way looks in Downloads");
    assert.ok(result.said.includes(`  ${active.line(EXPORTED)}`), result.text);
    assert.ok(result.said.some((line) => line.includes(`(${held.short}): ${CLEAR}`)), result.text);
    assert.ok(!result.text.includes(NAMED) && !result.text.includes(aside.name), "what she set aside is not said");
  });
  it("is not listed at all when each video that has something to look for is one the gate holds or she set aside", async () => {
    const w = await finished();
    const held = another(w, { n: 2, over: { session: MARKED } });
    const aside = another(w, { n: 3 });
    writeGuideNotes(w.t.home, { version: 1, handoffs: {}, finished: { [ID]: AT, [aside.id]: AT } });
    const { result, downloads } = await listings(w, () => on(depsOf(w), "guide"));
    assert.equal(downloads, 0);
    assert.ok(result.said.some((line) => line.includes(`(${held.short}): ${CLEAR}`)), result.text);
  });
  it("is not listed for a finished video that finish would go no further with: the other Mac has it open, a bring is at work, or it is held beside a session", async () => {
    const open = await finished();
    rewrite(open, { editing: { by: "Sallie's laptop", since: AT } });
    const opened = await listings(open, () => on(depsOf(open), "guide"));
    assert.equal(opened.downloads, 0, "the other Mac has it open");
    assert.ok(opened.result.said.includes(`  ${NAMED}: ${TAKE}`), opened.result.text);
    const busy = await finished();
    assert.equal(takeEpisodeLock(lockOf(busy.t.home, FOLDER), "bring", () => true).taken, true);
    busy.t.ctx.deps.alive = (pid) => pid === process.pid;
    assert.equal((await listings(busy, () => on(depsOf(busy), "guide"))).downloads, 0, "a bring is at work");
    const beside = await finished();
    episodeAs(beside.t, { id: "e-20261020-a2a2a2", name: "2026-10-20 Group call (Mac Studio)", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 10:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: MARKED, versionOf: ID, imported: { on: "Mac Studio", at: "2026-10-20T10:00:00-05:00" } } });
    assert.equal((await listings(beside, () => on(depsOf(beside), "guide"))).downloads, 0, "held beside a session");
  });
});

describe("a Downloads folder this Mac will not let be read is no export for any video, and is tried once", () => {
  it("is tried once for two raw videos, told they are in HyperFrames, and once for a raw video and a finished video's Reels, told the BRIMM Ops page's step", async () => {
    const w = raw();
    const b = another(w);
    const refused = await watched(() => on(depsOf(w), "guide"), { names: ["readdirSync"], ...refusedDownloads(w) });
    assert.equal(refused.calls.filter((call) => call.path === w.downloads).length, 1, "tried once");
    assert.deepEqual(sorted(refused.result.said), sorted([DROP_LINE, "Under way:", `  ${NAMED}: ${IN_APP}`, `  ${b.line(IN_APP)}`]));
    const f = await finished();
    const c = another(f);
    const mixed = await watched(() => on(depsOf(f), "guide"), { names: ["readdirSync"], ...refusedDownloads(f) });
    assert.equal(mixed.calls.filter((call) => call.path === f.downloads).length, 1, "tried once");
    assert.ok(mixed.result.said.includes(`  ${NAMED}: ${TAKE}`), mixed.result.text);
    assert.ok(mixed.result.said.includes(`  ${c.line(IN_APP)}`), mixed.result.text);
  });
});

describe("each look lists it once: `guide wait` looks again every 5 seconds, and `guide … tell` every 15, and each look is one pass", () => {
  /** A wait stand-in that does `then` on the `n`th wait, once. */
  const onWait = (w, n, then) => {
    let count = 0;
    const wait = w.t.ctx.deps.wait;
    return async (time) => {
      await wait(time);
      if (++count === n) then();
    };
  };
  for (const form of ["wait", "tell"]) {
    it(`lists it once for each look of \`guide ${form}\` while a video is at its copy, with two videos in HyperFrames beside it`, async () => {
      const w = raw({ projects: null });
      atWork(w.t, "workcopy");
      const b = another(w, { n: 2 });
      const c = another(w, { n: 3 });
      const wait = onWait(w, 2, () => rmSync(workCopyLockOf(w.t.home, FOLDER)));
      const argv = form === "wait" ? ["guide", "wait"] : ["guide", "3fa9c1", "tell"];
      const { result, downloads } = await listings(w, () => on(depsOf(w, { wait }), ...argv));
      assert.equal(result.code, 0, result.text);
      // The first look, and one after each of the two waits: three passes, each listing Downloads once for the two videos in HyperFrames.
      assert.equal(w.t.waits.length, 2);
      assert.equal(downloads, w.t.waits.length + 1, "once for each pass, not once for each video of each");
      assert.equal(result.text.includes(b.name) && result.text.includes(c.name), form === "wait", result.text);
    });
  }
});
