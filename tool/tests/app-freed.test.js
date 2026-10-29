// A project whose video has been taken away (plan PR 15; `free`, free.js) is opened by `app` as the project it is: the video is put
// back, and no second project is made (architecture 2026-10-27, 4.8 and 5.6). openInApp is run on its own here, as app.test.js runs
// it, with the stand-in for the pinned command line (tests/stand-ins/hyperframes.mjs) and a home folder of its own; the same, from
// Sallie's chat, after the real `free`, is edit-free.test.js's. Nothing here runs HyperFrames, the app, HeyGen, ffmpeg or `claude`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openInApp } from "../app.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { episodeWork } from "../settings.js";
import { workCopyKey, workCopyLockOf, workCopyPaths } from "../workcopy.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
const FOLDER = "2026-10-28 Pricing talk (Mac Studio)";
const NAME = "Pricing talk";
const AT = Date.parse("2026-10-28T15:00:00-04:00");
const WORDS = [{ w: "Pricing,", start: 0.5, end: 1.1 }, { w: "says", start: 1.2, end: 1.6 }, { w: "Sally.", start: 1.7, end: 2.5 }];
const PLAN = { by: "rules", phrases: [{ id: "p1", start: 0.4, end: 1.15, text: "Pricing,", words: WORDS.slice(0, 1), keep: false, kind: "retake", why: "said again" }, { id: "p2", start: 1.15, end: 2.6, text: "says Sally.", words: WORDS.slice(1), keep: true, kind: "keep", why: "" }] };
const BEING_MADE = `The video for HyperFrames is being made. Say "open ${NAME} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
const BACK = `The video HyperFrames was given for ${NAME} had been taken away; it is back in the project.`;
const CHANGED = `The recording of ${NAME} has changed since its HyperFrames project was made, and the video that project was made from has been taken away, so it can't be opened. Ask Jason.`;
const NO_RECORDING = `The recording of ${NAME} is not in its folder, so the video of its HyperFrames project could not be made again. Ask Jason.`;
const NOT_THE_SAME = `The video made again for ${NAME} isn't the size or length of the one its HyperFrames project was made with, so it wasn't put back. Ask Jason.`;
const NOT_READABLE = `The HyperFrames project for ${NAME} is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason.`;
const NOT_PUT_BACK = `The video for ${NAME} was made again, but it could not be put back in its HyperFrames project. Ask Jason.`;
const REMADE = "the working copy, made again";
/** The facts of the working copy the project was made from (the first copy's, in episode()), and of one made again. */
const FACTS = { seconds: 2.6, fps: 30, width: 1920, height: 1080 };

/** The made-up episode on a made-up Mac, as app.test.js makes it: its folder in a Dropbox of the test's own, the raw video, the words,
    the cut plan, the working copy made, this Mac's home with the stand-in's answers, and a context that collects what is said, what
    is started and each record written. */
function episode(c) {
  const home = mkdtempSync(join(tmpdir(), "brimm-freed-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  const folder = join(home, "Dropbox", "BRIMM Video", "Episodes", FOLDER);
  const raw = join(folder, "Talk.mov");
  const write = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  write(raw, "the raw video's bytes");
  write(join(folder, "Talk.words.json"), JSON.stringify(WORDS));
  write(join(folder, "Talk.cut-plan.json"), JSON.stringify(PLAN));
  write(join(folder, "reels.json"), JSON.stringify({ format: "brimm-video reels", version: 1, candidates: [] }));
  const stat = statSync(raw);
  const paths = workCopyPaths(home, FOLDER, workCopyKey({ bytes: stat.size, mtimeMs: stat.mtimeMs }));
  write(paths.video, "the working copy's bytes");
  write(paths.facts, JSON.stringify({ ...FACTS, bytes: 24 }));
  const said = [];
  const started = [];
  const saved = [];
  const ctx = {
    home, machine: "Mac Studio", now: () => AT, alive: (pid) => pid === process.pid, say: (line) => said.push(line),
    start: (cmd, args) => started.push(args.slice(1)), settings: { root: join(home, "Dropbox", "BRIMM Video"), checkout: "/checkout", app: "hyperframes", appHandover: false }
  };
  const record = { id: "e-20261028-3fa9c1", rev: 4, kind: "raw", name: { text: NAME, placeholder: false }, video: { file: "Talk.mov", bytes: stat.size, seconds: 2.6 }, spellings: [] };
  const deps = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE, chat: () => ({ sessionId: "", held: true }), save: async (next) => (saved.push(next), 0) };
  const runs = () => (existsSync(join(home, "hyperframes-stand-in.log")) ? readFileSync(join(home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  return { home, folder, raw, paths, said, started, saved, ctx, record, deps, runs, project: join(episodeWork(home, FOLDER), "Pricing talk main 3fa9c1"), found: { name: FOLDER, folder } };
}
const run = (e, record = e.record) => openInApp(e.ctx, { found: e.found, record }, e.deps);
/** Nothing she reads holds a path, a flag or the name of a command. */
const plain = (said) => said.forEach((line) => assert.doesNotMatch(line, /\/|--|\bnpx\b|\bnode\b|hyperframes\.mjs|workcopy/, line));
/** A project's folder as it is: every path in it, and the text of each file. */
const treeOf = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((path) => [path, lstatSync(join(dir, path)).isFile() ? readFileSync(join(dir, path), "utf8") : null]));

/** The project made and opened once, and then its video taken away, as `free` takes it: the video, and the folder of copies, in which
    the first copy's facts were left. */
async function freed(c) {
  const e = episode(c);
  assert.equal(await run(e), 0);
  assert.ok(!existsSync(e.paths.video) && existsSync(e.paths.facts), "the working copy was moved into the project, and its facts stay");
  rmSync(join(e.project, "media", "recording.mp4"));
  rmSync(e.paths.dir, { recursive: true });
  e.said.splice(0);
  e.opened = e.runs().length;
  return e;
}
/** The working copy made again, as the job puts it in place: the video, and its facts beside it. */
function madeAgain(e, facts = { ...FACTS, bytes: REMADE.length }) {
  mkdirSync(dirname(e.paths.video), { recursive: true });
  writeFileSync(e.paths.video, REMADE);
  writeFileSync(e.paths.facts, JSON.stringify(facts));
}

describe("app: a project whose video has been taken away is not made again, and its video is put back", () => {
  it("asks for the working copy once, says it is being made, and opens nothing, records nothing and makes no second project", async (c) => {
    const e = await freed(c);
    const before = treeOf(e.project);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.said, [BEING_MADE]);
    assert.deepEqual([e.started, e.runs().length, e.saved.length], [[["workcopy", "--now", FOLDER]], e.opened, 1]);
    assert.deepEqual(treeOf(e.project), before);
    assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).filter((name) => name.startsWith("Pricing talk main")), ["Pricing talk main 3fa9c1"]);
    plain(e.said);
  });
  it("starts no second working copy while one is being made", async (c) => {
    const e = await freed(c);
    assert.equal(takeEpisodeLock(workCopyLockOf(e.home, FOLDER), "workcopy", () => true).taken, true);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual([e.started, e.said, e.runs().length], [[], [BEING_MADE], e.opened]);
  });
  it("asks for a copy that is not whole as it asks for none: the video without its facts, or the facts without the video", async (c) => {
    for (const half of [(e) => writeFileSync(e.paths.video, REMADE), (e) => writeFileSync(e.paths.facts, JSON.stringify({ ...FACTS, bytes: 4 }))]) {
      const e = await freed(c);
      mkdirSync(dirname(e.paths.video), { recursive: true });
      half(e);
      assert.equal(await run(e, e.saved[0]), 0);
      assert.deepEqual([e.said, e.started], [[BEING_MADE], [["workcopy", "--now", FOLDER]]]);
    }
  });
  it("puts the video back from the working copy made again, moved and not copied, and then opens the same project, recording the copy's size", async (c) => {
    const e = await freed(c);
    const before = treeOf(e.project);
    madeAgain(e);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.said, [BACK, "It's open in HyperFrames.", BUTTONS]);
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), REMADE);
    assert.ok(!existsSync(e.paths.video), "the working copy was moved in, not copied");
    assert.ok(existsSync(e.paths.facts), "its facts stay where they were");
    const now = treeOf(e.project);
    for (const [path, text] of Object.entries(before)) assert.equal(now[path], text, path);
    assert.deepEqual(e.started, []);
    assert.deepEqual(e.runs().slice(e.opened).map((r) => r.args), [["open", e.project, "--json"]]);
    const [project, ...others] = e.saved[1].app.projects;
    assert.deepEqual(others, []);
    assert.deepEqual([project.name, project.opened.length, project.state, project.workingCopy], ["Pricing talk main 3fa9c1", 2, "opened", { bytes: REMADE.length, seconds: 2.6, fps: 30 }]);
    plain(e.said);
  });
  it("opens it as before when it is said again, and moves nothing", async (c) => {
    const e = await freed(c);
    madeAgain(e);
    await run(e, e.saved[0]);
    e.said.splice(0);
    assert.equal(await run(e, e.saved[1]), 0);
    assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), REMADE);
  });
  it("puts the video back while the reading is at work: the project is made, so the reading does not matter", async (c) => {
    const e = await freed(c);
    madeAgain(e);
    mkdirSync(episodeWork(e.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(e.home, FOLDER), "read", () => true).taken, true);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.said, [BACK, "It's open in HyperFrames.", BUTTONS]);
  });
  it("says the project cannot be opened when the recording has changed since it was made, with a copy or without, and asks for nothing", async (c) => {
    for (const copy of [false, true]) {
      const e = await freed(c);
      if (copy) madeAgain(e);
      const later = new Date("2026-10-29T08:00:00-04:00");
      utimesSync(e.raw, later, later);
      const before = [treeOf(e.project), e.saved.length];
      assert.equal(await run(e, e.saved[0]), 1);
      assert.deepEqual(e.said, [CHANGED]);
      assert.deepEqual([e.started, e.runs().length, treeOf(e.project), e.saved.length], [[], e.opened, ...before], String(copy));
      plain(e.said);
    }
  });
  it("says the recording is not in the episode, and opens nothing, when it is not (the files of the episode were checked before, so this is a file that went since)", async (c) => {
    const e = await freed(c);
    rmSync(e.raw);
    assert.equal(await run(e, e.saved[0]), 1);
    assert.deepEqual([e.said, e.started, e.runs().length, e.saved.length], [[NO_RECORDING], [], e.opened, 1]);
    plain(e.said);
  });
  it("does not put back a copy that is not the project's width, height or length, and leaves it where it is", async (c) => {
    for (const facts of [{ ...FACTS, width: 640, height: 360 }, { ...FACTS, width: 1918 }, { ...FACTS, height: 1082 }, { ...FACTS, seconds: 4.7 }, { ...FACTS, seconds: 1.4 }]) {
      const e = await freed(c);
      madeAgain(e, { ...facts, bytes: 4 });
      const before = treeOf(e.project);
      assert.equal(await run(e, e.saved[0]), 1, JSON.stringify(facts));
      assert.deepEqual([e.said, e.runs().length, e.saved.length, treeOf(e.project), existsSync(e.paths.video)], [[NOT_THE_SAME], e.opened, 1, before, true], JSON.stringify(facts));
    }
  });
  it("puts back a copy that is within a second of the project's length: the job itself allows that much", async (c) => {
    const e = await freed(c);
    madeAgain(e, { ...FACTS, seconds: 2.6 + 0.9, bytes: REMADE.length });
    assert.equal(await run(e, e.saved[0]), 0, e.said.join("\n"));
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), REMADE);
  });
  it("opens nothing, and leaves the copy, when the project's facts cannot be read to check it against", async (c) => {
    for (const unreadable of [(e) => rmSync(join(e.project, "brimm", "facts.json")), (e) => writeFileSync(join(e.project, "brimm", "facts.json"), "not json"), (e) => writeFileSync(join(e.project, "brimm", "facts.json"), JSON.stringify({ seconds: 2.6 }))]) {
      const e = await freed(c);
      madeAgain(e);
      unreadable(e);
      assert.equal(await run(e, e.saved[0]), 1);
      assert.deepEqual([e.said, e.runs().length, e.saved.length, existsSync(e.paths.video)], [[NOT_READABLE], e.opened, 1, true]);
    }
  });
  it("says so, and opens nothing, when the video cannot be put back: the copy stays where it is", async (c) => {
    const e = await freed(c);
    madeAgain(e);
    const failing = () => {
      throw Object.assign(new Error("EXDEV: cross-device link not permitted"), { code: "EXDEV" });
    };
    assert.equal(await openInApp(e.ctx, { found: e.found, record: e.saved[0] }, { ...e.deps, rename: failing }), 1);
    assert.deepEqual([e.said, e.runs().length, e.saved.length, existsSync(e.paths.video), existsSync(join(e.project, "media", "recording.mp4"))], [[NOT_PUT_BACK], e.opened, 1, true, false]);
    plain(e.said);
  });
  it("leaves a project whose video is there as it was, and says the recording changed only then", async (c) => {
    const e = episode(c);
    assert.equal(await run(e), 0);
    const later = new Date("2026-10-29T08:00:00-04:00");
    utimesSync(e.raw, later, later);
    e.said.splice(0);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.said, [`The recording of ${NAME} has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.`, "It's open in HyperFrames.", BUTTONS]);
  });
});
