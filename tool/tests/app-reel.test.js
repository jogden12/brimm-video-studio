// Opening a Reel of an episode in the HyperFrames app (plan PR 5; architecture 2026-10-27: 4.1 step 10, 4.3, 5.1, 5.2, 5.6, 5.7, 7.1).
// app-reel.js makes a Reel's project from the Reel's video (workcopy.js, made from a stretch of the recording), the Reel's words and
// the faces found in it, opens the app on it by the pinned command line (app.js openProjectInApp, the code the main project is
// opened by) and records the project and the Reel picked in one write. edit.js finds the episode, asks the gate and makes the claim;
// tests/edit-app-reel.test.js runs all of it through editMain. These tests give openReelInApp what it touches (`deps`), and run the
// stand-in for the pinned command line, never the real one, the app, HeyGen or `claude`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { childEnv, PIN } from "../hyperframes.js";
import { projectOnAnotherMac } from "../app.js";
import { REEL_COPY_KINDS, madeInApp, openReelInApp, openReelWords, reelAsked, reelStretch, reelWhy } from "../app-reel.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { episodeFault, layoutOf, localStamp, newEpisode } from "../episode.js";
import { reelEntries, reelsFile } from "../reels.js";
import { episodeWork } from "../settings.js";
import { workCopyLockOf } from "../workcopy.js";
import { reelCopyKey, reelCopyPaths } from "../workcopy.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";
/** The line that ends what is said whenever the app opened: the buttons Studio cannot turn off (architecture 5.9). */
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
const PINNED_ENV = ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];

const FOLDER = "2026-10-28 Pricing talk (Mac Studio)";
const AT = Date.parse("2026-10-28T15:00:00-04:00");
const WORDS = [{ w: "Pricing,", start: 0.5, end: 1.1 }, { w: "says", start: 1.2, end: 1.6 }, { w: "Sally.", start: 1.7, end: 2.5 }];
/** A Reel candidate as a reading writes it (reels.json version 2): its stretch and no crop, no preview, no title. */
const candidate = (n, start, end, over = {}) => ({ n, start, end, ranges: [{ start, end }], seconds: Math.round((end - start) * 1000) / 1000, fits: { fits: false, why: "It is short." }, title: "", reason: "It makes one point.", point: "", words: "", phrases: [], preview: null, ...over });
const CANDIDATES = [candidate(2, 1.15, 2.6), candidate(3, 0.5, 2.5)];
const STRETCH = { start: 1.15, end: 2.6 };
const FACES = { every: 2, stills: [{ file: "0001.jpg", faces: [{ x: 0.41, y: 0.22, w: 0.18, h: 0.3 }] }] };

/** A home folder for the stand-in, which reads how to answer `open` from a file there and writes each run it makes to another: it is
    run in PR 1's environment, which carries no variable of a test's. */
function standIn(c, { open = "opened" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-stand-in-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open }));
  const runs = () => (existsSync(join(home, "hyperframes-stand-in.log")) ? readFileSync(join(home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  return { home, runs };
}

/** An episode on this Mac, as `app` finds it once the gate and the claim are past: its folder in Episodes with the raw video, its
    words and the list of Reel suggestions a reading wrote (`reels`: the candidates, or null for none); this Mac's home with the
    stand-in's answers; and a context that collects what is said, what is started and each record written. `copy` makes the Reel's
    video first, as the job would, and `faces` the faces found in it. */
function episode(c, { open = "opened", copy = true, faces = false, words = true, plan = null, reels = CANDIDATES, handover = false, chat = { sessionId: CHAT, held: false }, record: over = {} } = {}) {
  const s = standIn(c, { open });
  const folder = join(s.home, "Dropbox", "BRIMM Video", "Episodes", FOLDER);
  const raw = join(folder, "Talk.mov");
  const write = (path, text) => {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  };
  write(raw, "the raw video's bytes");
  if (words) write(join(folder, "Talk.words.json"), JSON.stringify(WORDS));
  // The cut plan the import wrote beside the words, when the test gives one: its phrases place the words' starts, and cut nothing.
  if (plan !== null) write(join(folder, "Talk.cut-plan.json"), typeof plan === "string" ? plan : JSON.stringify({ by: "rules", phrases: plan }));
  if (reels) write(join(folder, "reels.json"), JSON.stringify(reelsFile({ video: "Talk.mov", by: "read", made: "2026-10-28T09:00:00-04:00", candidates: reels })));
  const stat = statSync(raw);
  const paths = reelCopyPaths(s.home, FOLDER, 2, reelCopyKey({ bytes: stat.size, mtimeMs: stat.mtimeMs }, STRETCH));
  if (copy) {
    write(paths.video, "the Reel's bytes");
    write(paths.facts, JSON.stringify({ seconds: 1.45, fps: 30, width: 1920, height: 1080, bytes: 16, stretch: STRETCH }));
    if (faces) write(paths.faces, JSON.stringify(FACES));
  }
  const said = [];
  const started = [];
  const saved = [];
  const ctx = {
    home: s.home, machine: "Mac Studio", now: () => AT, alive: (pid) => pid === process.pid, say: (line) => said.push(line),
    start: (cmd, args) => started.push(args.slice(1)), settings: { root: join(s.home, "Dropbox", "BRIMM Video"), checkout: "/checkout", app: "hyperframes", appHandover: handover }
  };
  const record = {
    id: "e-20261028-3fa9c1", rev: 4, kind: "raw", name: { text: "Pricing talk", placeholder: false }, video: { file: "Talk.mov", bytes: stat.size, seconds: 2.6 }, spellings: [["Sally", "Sallie"]],
    reels: reelEntries(CANDIDATES), ...over
  };
  const deps = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE, chat: () => chat, save: async (next) => (saved.push(next), 0) };
  const project = join(episodeWork(s.home, FOLDER), "Pricing talk reel 2 3fa9c1");
  return { ...s, folder, raw, paths, said, started, saved, ctx, record, deps, project, found: { name: FOLDER, folder }, work: episodeWork(s.home, FOLDER) };
}
const run = (e, record = e.record, n = 2) => openReelInApp(e.ctx, { found: e.found, record, n }, e.deps);
/** Nothing she reads holds a path, a flag or the name of a command. */
const plain = (said) => said.forEach((line) => assert.doesNotMatch(line, /\/|--|\bnpx\b|\bnode\b|hyperframes\.mjs|workcopy|reels\.json/, line));
const treeOf = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((path) => [path, lstatSync(join(dir, path)).isFile() ? readFileSync(join(dir, path), "utf8") : null]));
/** A whole record of the episode, so that the `app` a run writes can be read as the next command reads it. */
const WHOLE = { ...newEpisode({ id: "e-20261028-3fa9c1", machine: "Mac Studio", at: "2026-10-28T09:00:00-04:00", video: { file: "Talk.mov", bytes: 20, seconds: 2.6, created: null }, kind: "raw", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
const unreadable = (next) => episodeFault({ ...WHOLE, app: next.app });
const STILL = 'Claude is still reading it. Say "open Reel 2 of Pricing talk in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.';
const MAKING = 'The video for Reel 2 is being made. Say "open Reel 2 of Pricing talk in HyperFrames" again when it is done; "how far is it?" shows how far it has got.';

describe("openReelInApp: a Reel opened in HyperFrames", () => {
  it("makes the Reel's project from its video, opens it with the pinned command line in PR 1's environment, and records it with the Reel picked", async (c) => {
    const e = episode(c);
    assert.equal(await run(e), 0);
    assert.deepEqual(e.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", "It's open in HyperFrames.", BUTTONS]);
    // The Reel's video is moved in, not copied, and its facts stay where they were.
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), "the Reel's bytes");
    assert.ok(!existsSync(e.paths.video), "the Reel's video was moved in");
    assert.ok(existsSync(e.paths.facts));
    // Its words are the recording's words in it, on the Reel's own clock, spelled as the episode spells them.
    const transcript = JSON.parse(readFileSync(join(e.project, "transcript.json"), "utf8"));
    assert.deepEqual(transcript.map((word) => [word.id, word.text, word.start, word.end]), [["w0", "says", 0.25, 0.45], ["w1", "Sallie.", 0.95, 1.35]]);
    assert.deepEqual(JSON.parse(readFileSync(join(e.project, "brimm", "facts.json"), "utf8")).reel, { n: 2, offset: 1.15 });
    assert.deepEqual(e.runs(), [{ args: ["open", e.project, "--json"], env: PINNED_ENV }]);
    // No cut or Reel suggestions, and no face track: none was found.
    assert.ok(!existsSync(join(e.project, "brimm", "cut-suggestions.json")) && !existsSync(join(e.project, "brimm", "reel-suggestions.json")) && !existsSync(join(e.project, "brimm", "face-track.json")));
    // One record write: the project, and the Reel picked, which is what `reel pick` did.
    assert.equal(e.saved.length, 1);
    const next = e.saved[0];
    assert.equal(layoutOf(next), 4);
    assert.deepEqual(next.app, {
      toolchain: PIN.version,
      projects: [{
        key: "reel 2", name: "Pricing talk reel 2 3fa9c1", madeAt: localStamp(new Date(AT)), on: "Mac Studio",
        from: { file: "Talk.mov", bytes: statSync(e.raw).size, modified: localStamp(new Date(statSync(e.raw).mtimeMs)) },
        workingCopy: { bytes: 16, seconds: 1.45, fps: 30 }, opened: [localStamp(new Date(AT))], handover: false, fromSuggestion: 2, state: "opened"
      }]
    });
    assert.deepEqual(next.reels.map((r) => [r.n, r.status]), [[2, "picked"], [3, "candidate"]]);
    assert.equal(unreadable(next), "", "the next command can read the record");
    assert.deepEqual(e.started, []);
    plain(e.said);
  });
  it("places the Reel's words by the cut plan's phrases, as the main project's are placed: a word after a pause starts where the phrase does", async (c) => {
    // "says" is given 1.2 to 1.6, so it starts halfway in, at 1.4; the phrase it ends in starts on the pause's end, at 1.5. The Reel
    // starts at 1.15 in the recording, so "says" is at 0.35 of the Reel's clock, and not at 0.25. The plan cuts nothing: every word
    // the stretch holds is there.
    const e = episode(c, { plan: [{ id: "p1", start: 0.4, end: 1.15 }, { id: "p2", start: 1.5, end: 2.6 }] });
    assert.equal(await run(e), 0);
    const transcript = JSON.parse(readFileSync(join(e.project, "transcript.json"), "utf8"));
    assert.deepEqual(transcript.map((word) => [word.text, word.start, word.end]), [["says", 0.35, 0.45], ["Sallie.", 0.95, 1.35]]);
  });
  it("moves the Reel's words only inside their time when the episode has no cut plan, and when its cut plan cannot be used", async (c) => {
    for (const plan of [null, JSON.stringify({ by: "rules" }), JSON.stringify(null), JSON.stringify({ phrases: "none" })]) {
      const e = episode(c, { plan });
      assert.equal(await run(e), 0, String(plan));
      const transcript = JSON.parse(readFileSync(join(e.project, "transcript.json"), "utf8"));
      assert.deepEqual(transcript.map((word) => [word.text, word.start]), [["says", 0.25], ["Sallie.", 0.95]], String(plan));
    }
  });
  it("offers the face positions in the project only when the finder found some", async (c) => {
    const found = episode(c, { faces: true });
    assert.equal(await run(found), 0);
    const track = JSON.parse(readFileSync(join(found.project, "brimm", "face-track.json"), "utf8"));
    assert.deepEqual([track.clock, track.every, track.stills], ["reel", 2, [{ at: 2, faces: FACES.stills[0].faces }]]);
    assert.ok(existsSync(found.paths.faces), "the file beside the copy stays");
    const none = episode(c);
    await run(none);
    assert.ok(!existsSync(join(none.project, "brimm", "face-track.json")));
    // A file of faces that cannot be read is no faces: the project is made all the same.
    const broken = episode(c);
    writeFileSync(broken.paths.faces, "{ not json");
    assert.equal(await run(broken), 0);
    assert.ok(!existsSync(join(broken.project, "brimm", "face-track.json")));
  });
  it("opens the same project again, and makes no second project or video", async (c) => {
    const e = episode(c);
    await run(e);
    const before = readdirSync(e.work).sort();
    const tree = treeOf(e.project);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(readdirSync(e.work).sort(), before);
    assert.deepEqual(treeOf(e.project), tree, "nothing in the project is changed");
    assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", e.project, "--json"]]);
    assert.deepEqual(e.saved[1].app.projects.map((p) => [p.key, p.opened.length, p.state, p.fromSuggestion]), [["reel 2", 2, "opened", 2]]);
    assert.deepEqual(e.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", "It's open in HyperFrames.", BUTTONS, "It's open in HyperFrames.", BUTTONS], "it is made once, and said once");
    assert.deepEqual(e.started, []);
  });
  it("keeps the main project's entry and the other Reels', and takes the Reel's own place in the list", async (c) => {
    const e = episode(c);
    const entry = (key, name) => ({ key, name, madeAt: "2026-10-27T09:00:00-04:00", on: "Mac Studio", from: { file: "Talk.mov", bytes: 5, modified: "2026-10-27T08:00:00-04:00" }, workingCopy: { bytes: 5, seconds: 2.6, fps: 30 }, opened: ["2026-10-27T09:01:00-04:00"], handover: false, fromSuggestion: key === "main" ? null : 3, state: "opened" });
    const earlier = [entry("main", "Pricing talk main 3fa9c1"), entry("reel 3", "Pricing talk reel 3 3fa9c1")];
    const record = { ...e.record, app: { toolchain: PIN.version, projects: earlier } };
    assert.equal(await run(e, record), 0);
    assert.deepEqual(e.saved[0].app.projects.map((p) => p.key), ["main", "reel 3", "reel 2"]);
    assert.deepEqual(e.saved[0].app.projects.slice(0, 2), earlier);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.saved[1].app.projects.map((p) => [p.key, p.opened.length]), [["main", 1], ["reel 3", 1], ["reel 2", 2]]);
  });
  it("asks for the Reel's video when there is none, says it is being made, makes no project, and waits for nothing", async (c) => {
    const e = episode(c, { copy: false });
    assert.equal(await run(e), 0);
    assert.deepEqual(e.started, [["workcopy", "--now", FOLDER, "--reel", "2"]]);
    assert.deepEqual(e.said, [MAKING]);
    assert.ok(!existsSync(e.project));
    assert.deepEqual([e.saved, e.runs()], [[], []]);
    plain(e.said);
  });
  it("asks for it when the video there is another stretch's: a Reel whose suggestion has changed", async (c) => {
    const e = episode(c, { copy: false });
    // A copy made for the stretch this Reel had before: its key is another.
    const stat = statSync(e.raw);
    const other = reelCopyPaths(e.home, FOLDER, 2, reelCopyKey({ bytes: stat.size, mtimeMs: stat.mtimeMs }, { start: 1, end: 2.6 }));
    mkdirSync(join(other.video, ".."), { recursive: true });
    writeFileSync(other.video, "an earlier stretch");
    writeFileSync(other.facts, "{}");
    assert.equal(await run(e), 0);
    assert.deepEqual([e.started, e.said, existsSync(e.project)], [[["workcopy", "--now", FOLDER, "--reel", "2"]], [MAKING], false]);
  });
  it("asks for the video again when only one of its two files is there", async (c) => {
    const e = episode(c);
    rmSync(e.paths.facts);
    assert.equal(await run(e), 0);
    assert.deepEqual([e.started, e.said], [[["workcopy", "--now", FOLDER, "--reel", "2"]], [MAKING]]);
    assert.ok(existsSync(e.paths.video), "the video is not moved into a project without its facts");
  });
  it("starts no second copy while one is being made, a Reel's or the video's", async (c) => {
    const e = episode(c, { copy: false });
    mkdirSync(e.work, { recursive: true });
    assert.equal(takeEpisodeLock(workCopyLockOf(e.home, FOLDER), "workcopy", () => true).taken, true);
    assert.equal(await run(e), 0);
    assert.deepEqual(e.started, []);
    assert.deepEqual(e.said, [MAKING]);
  });
  describe("while Claude is still reading the episode (a `read` run holds the episode's lock): the suggestions are its work", () => {
    const atWork = (e, command = "read") => {
      mkdirSync(e.work, { recursive: true });
      assert.equal(takeEpisodeLock(lockOf(e.home, FOLDER), command, () => true).taken, true);
    };
    it("makes no project and asks for no video: it says Claude is still reading, writes nothing and ends with 0", async (c) => {
      const e = episode(c);
      atWork(e);
      const before = readdirSync(e.work).sort();
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, [STILL]);
      assert.deepEqual([e.saved, e.runs(), e.started, existsSync(e.project)], [[], [], [], false]);
      assert.deepEqual(readdirSync(e.work).sort(), before);
      assert.equal(readFileSync(e.paths.video, "utf8"), "the Reel's bytes", "the Reel's video is where it was");
      plain(e.said);
    });
    it("asks for nothing even with no video, since which stretch it is depends on the reading", async (c) => {
      const e = episode(c, { copy: false, reels: null });
      atWork(e);
      assert.equal(await run(e), 0);
      assert.deepEqual([e.started, e.said], [[], [STILL]]);
    });
    it("makes the project the next time it is asked, once the reading has ended", async (c) => {
      const e = episode(c);
      atWork(e);
      await run(e);
      rmSync(lockOf(e.home, FOLDER));
      e.said.splice(0);
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", "It's open in HyperFrames.", BUTTONS]);
    });
    it("makes the project as before when no reading is at work: a lock left by a reading that died, or another command at work, stops nothing", async (c) => {
      for (const [what, hold] of [
        ["a reading that died", (e) => (mkdirSync(e.work, { recursive: true }), writeFileSync(lockOf(e.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" })))],
        ["a bring", (e) => atWork(e, "bring")]
      ]) {
        const e = episode(c);
        hold(e);
        assert.equal(await run(e), 0, what);
        assert.ok(existsSync(join(e.project, "index.html")), what);
      }
    });
    it("opens a project made before, and takes a folder the record does not know, and makes nothing: only a new project waits for the reading", async (c) => {
      const made = episode(c);
      await run(made);
      atWork(made);
      made.said.splice(0);
      assert.equal(await run(made, made.saved[0]), 0);
      assert.deepEqual(made.said, ["It's open in HyperFrames.", BUTTONS]);
      const left = episode(c);
      await run(left);
      atWork(left);
      assert.equal(await run(left, left.record), 0, "the folder the first run left, whose record was not written");
      assert.deepEqual(left.saved.at(-1).app.projects.map((p) => [p.key, p.state]), [["reel 2", "opened"]]);
    });
  });
  it("makes nothing without the words of the recording, and says why", async (c) => {
    const e = episode(c, { words: false });
    assert.equal(await run(e), 1);
    assert.deepEqual(e.said, ["The words of Pricing talk are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason."]);
    assert.deepEqual([e.started, e.saved, e.runs(), existsSync(e.project)], [[], [], [], false]);
    plain(e.said);
  });
  describe("a suggestion that is gone, or cannot be made", () => {
    it("is refused in words when reels.json no longer has it, and the others are named", async (c) => {
      const e = episode(c, { reels: [CANDIDATES[1]] });
      assert.equal(await run(e), 1);
      assert.deepEqual(e.said, ["There is no Reel 2. The Reels are 3."]);
      assert.deepEqual([e.started, e.saved, e.runs(), existsSync(e.project)], [[], [], [], false]);
      const none = episode(c, { reels: [] });
      assert.equal(await run(none), 1);
      assert.deepEqual(none.said, ["There is no Reel 2. The Reels are none."]);
    });
    it("is refused in words when it has no stretch to show", async (c) => {
      const e = episode(c, { reels: [candidate(2, 1.15, 1.15, { ranges: [], seconds: 0, failed: "it is shorter than one picture" })] });
      assert.equal(await run(e), 1);
      assert.deepEqual(e.said, ["Reel 2 has nothing to show: it is shorter than one picture."]);
      assert.deepEqual([e.started, e.saved], [[], []]);
    });
    it("is refused in words when the list cannot be read, or is not there", async (c) => {
      for (const make of [(e) => rmSync(join(e.folder, "reels.json")), (e) => writeFileSync(join(e.folder, "reels.json"), "{ not json"), (e) => writeFileSync(join(e.folder, "reels.json"), JSON.stringify({ format: "brimm-video reels", version: 3, video: "Talk.mov", candidates: [] }))]) {
        const e = episode(c);
        make(e);
        assert.equal(await run(e), 1);
        assert.deepEqual(e.said, ["The Reel suggestions of Pricing talk cannot be read. Ask Jason."]);
        assert.deepEqual([e.started, e.saved], [[], []]);
        plain(e.said);
      }
    });
  });
  describe("a project folder the record does not list, as a run whose record was not written leaves", () => {
    it("is taken as the project it is and recorded, and nothing is made, asked for or written over it", async (c) => {
      const e = episode(c);
      // The run that makes the project gets as far as the app and cannot write the record.
      const failed = await openReelInApp(e.ctx, { found: e.found, record: e.record, n: 2 }, { ...e.deps, save: async () => 1 });
      assert.equal(failed, 1);
      assert.ok(existsSync(join(e.project, "index.html")));
      const tree = treeOf(e.project);
      const before = readdirSync(e.work).sort();
      e.said.splice(0);
      // Neither the words nor the Reel's video is needed for it now.
      rmSync(join(e.folder, "Talk.words.json"));
      rmSync(e.paths.facts);
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS], "nothing is said of making it");
      assert.deepEqual(treeOf(e.project), tree);
      assert.deepEqual(readdirSync(e.work).sort(), before);
      assert.deepEqual(e.saved.at(-1).app.projects.map((p) => [p.key, p.name, p.state, p.fromSuggestion, p.opened.length, p.workingCopy]), [["reel 2", "Pricing talk reel 2 3fa9c1", "opened", 2, 1, { bytes: 16, seconds: 1.45, fps: 30 }]]);
      assert.deepEqual(e.started, []);
    });
    it("is not opened when part of it cannot be read, and the words say so", async (c) => {
      const e = episode(c, { copy: false });
      mkdirSync(join(e.project, "brimm"), { recursive: true });
      writeFileSync(join(e.project, "index.html"), "<html></html>");
      assert.equal(await run(e), 1);
      assert.deepEqual(e.said, ["The HyperFrames project for Reel 2 of Pricing talk is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason."]);
      assert.deepEqual([e.saved, e.runs(), e.started], [[], [], []]);
      plain(e.said);
    });
  });
  it("says when the recording has changed since the project was made, and opens the project as it was", async (c) => {
    const e = episode(c);
    await run(e);
    const tree = treeOf(e.project);
    writeFileSync(e.raw, "the raw video's bytes, and some more");
    e.said.splice(0);
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(e.said, ["The recording of Pricing talk has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.", "It's open in HyperFrames.", BUTTONS]);
    assert.deepEqual(treeOf(e.project), tree);
    assert.equal(e.started.length, 0);
  });
  describe("when HyperFrames will not open", () => {
    it("keeps the project, records no time it was opened, leaves it made, still picks the Reel, and says so in her words without the buttons", async (c) => {
      for (const [open, words] of [["not-installed", "HyperFrames isn't installed on this Mac: ask Jason."], ["open-failed", "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]]) {
        const e = episode(c, { open });
        assert.equal(await run(e), 1, open);
        assert.deepEqual(e.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", words], open);
        assert.ok(existsSync(join(e.project, "index.html")), open);
        assert.deepEqual(e.saved[0].app.projects.map((p) => [p.state, p.opened]), [["made", []]], open);
        assert.equal(e.saved[0].reels[0].status, "picked", open);
        plain(e.said);
        // The next try opens the same project, and does not say it is made.
        e.said.splice(0);
        writeFileSync(join(e.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
        assert.equal(await run(e, e.saved[0]), 0, open);
        assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS], open);
        assert.deepEqual(e.saved[1].app.projects.map((p) => [p.state, p.opened.length]), [["opened", 1]], open);
      }
    });
    it("ends with 1 when the record cannot be written, after the project is made and the app has opened, and the next run takes the project it left", async (c) => {
      const e = episode(c);
      assert.equal(await openReelInApp(e.ctx, { found: e.found, record: e.record, n: 2 }, { ...e.deps, save: async () => 1 }), 1);
      assert.deepEqual(e.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", "It's open in HyperFrames.", BUTTONS], "the app is open all the same");
      assert.ok(existsSync(join(e.project, "index.html")));
      assert.equal(await run(e), 0);
      assert.equal(e.runs().length, 2);
    });
  });
  describe("her chat, handed over by the code the main project's is (app.js openProjectInApp)", () => {
    it("is handed to the app only when this Mac's setting is on and the chat holds no session's words, and recorded as handed over", async (c) => {
      const off = episode(c, { handover: false });
      await run(off);
      assert.ok(!off.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
      assert.equal(off.saved[0].app.projects[0].handover, false);
      const on = episode(c, { handover: true });
      await run(on);
      assert.ok(on.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
      assert.equal(on.saved[0].app.projects[0].handover, true);
      assert.deepEqual(on.said, ["Reel 2 is made: the recording from 0:01 to 0:03.", "It's open in HyperFrames, and it picks up this conversation.", BUTTONS]);
    });
    it("is not handed over from a chat that holds a session's words, or one that was not found, and she is told why", async (c) => {
      const held = episode(c, { handover: true, chat: { sessionId: CHAT, held: true } });
      await run(held);
      assert.ok(!held.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
      assert.deepEqual(held.said.slice(1), ["It's open in HyperFrames. It starts a new conversation.", "This chat has held a client or group session's words, so it stays here.", BUTTONS]);
      const lost = episode(c, { handover: true, chat: { sessionId: "", held: true } });
      await run(lost);
      assert.ok(!lost.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
      assert.ok(lost.said.includes("This chat could not be found, so it stays here."), lost.said.join("\n"));
    });
  });
  describe("the Reel in the record", () => {
    it("is picked again when it was dropped, and stays finished when it is finished: a finished Reel's project is still opened", async (c) => {
      const dropped = episode(c, { record: { reels: reelEntries(CANDIDATES).map((r) => (r.n === 2 ? { ...r, status: "dropped" } : r)) } });
      await run(dropped);
      assert.equal(dropped.saved[0].reels.find((r) => r.n === 2).status, "picked");
      const finished = episode(c);
      const made = { ...finished.record, reels: finished.record.reels.map((r) => (r.n === 2 ? { ...r, status: "finished" } : r)) };
      await run(finished, made);
      assert.equal(await run(finished, { ...finished.saved[0], reels: made.reels }), 0);
      assert.equal(finished.saved[1].reels.find((r) => r.n === 2).status, "finished");
    });
    it("changes nothing else of the record's Reels, and lists the Reel when the record did not", async (c) => {
      const e = episode(c, { record: { reels: [{ ...reelEntries(CANDIDATES)[1], later: { x: 1 } }] } });
      await run(e);
      const next = e.saved[0].reels;
      assert.deepEqual(next[0], { ...reelEntries(CANDIDATES)[1], later: { x: 1 } }, "Reel 3 is as it was");
      assert.deepEqual([next[1].n, next[1].status, next[1].from, next[1].to, next[1].title], [2, "picked", 1.15, 2.6, ""]);
    });
  });
  it("is told in words that hold no path, no flag and no command name, whichever way it ends", async (c) => {
    for (const script of [{}, { copy: false }, { words: false }, { open: "not-installed" }, { reels: [] }]) {
      const e = episode(c, script);
      await run(e);
      plain(e.said);
    }
  });
  it("refuses to run without a way to write the record, so that nothing is made without one", async (c) => {
    const e = episode(c);
    await assert.rejects(() => openReelInApp(e.ctx, { found: e.found, record: e.record, n: 2 }, { ...e.deps, save: undefined }), /save/);
    assert.ok(!existsSync(e.project));
  });
});

describe("the words that name a Reel, and what is known of it before anything is claimed", () => {
  it("name the Reel and the episode in what she is told to say again: the phrase of the specification, with the episode", () => {
    assert.equal(openReelWords(2, "Pricing talk"), "open Reel 2 of Pricing talk in HyperFrames");
  });
  it("find the Reel in what she asked: `reel` and a number after the episode's words, in any case", () => {
    assert.deepEqual(reelAsked(["Pricing talk", "reel", "2"]), { episode: ["Pricing talk"], n: 2 });
    assert.deepEqual(reelAsked(["Pricing", "talk", "Reel", "12"]), { episode: ["Pricing", "talk"], n: 12 });
    assert.deepEqual(reelAsked(["reel", "2"]), { episode: [], n: 2 });
    assert.deepEqual(reelAsked(["Pricing talk", "reel"]), { episode: ["Pricing talk"], n: null }, "a Reel with no number");
    for (const words of [["Pricing talk"], ["reel"], [], ["Pricing talk", "reel", "two"], ["Pricing talk", "reels", "2"], ["Pricing talk", "2"]]) assert.equal(reelAsked(words), null, JSON.stringify(words));
  });
  it("say whether the record lists a project for the Reel", () => {
    assert.equal(madeInApp({ app: { projects: [{ key: "reel 2" }] } }, 2), true);
    for (const record of [{}, { app: { projects: [] } }, { app: { projects: [{ key: "main" }, { key: "reel 12" }, { key: "reel 3" }] } }]) assert.equal(madeInApp(record, 2), false);
  });
  it("name the kinds of video a Reel's video is made for: a raw one and a finished one", () => {
    assert.deepEqual(REEL_COPY_KINDS, ["raw", "finished"]);
  });
  describe("reelWhy: the refusals the record alone makes, before the claim", () => {
    const here = (c) => {
      const e = episode(c);
      return { ctx: e.ctx, found: e.found, record: e.record, e };
    };
    it("is nothing for a Reel the record lists, whatever it is now but finished", (c) => {
      const { ctx, found, record } = here(c);
      assert.equal(reelWhy(ctx, found, record, 2), "");
      for (const status of ["candidate", "picked", "dropped"]) assert.equal(reelWhy(ctx, found, { ...record, reels: record.reels.map((r) => ({ ...r, status })) }, 3), "", status);
    });
    it("says there is no such Reel, and which there are, for a number the record does not list", (c) => {
      const { ctx, found, record } = here(c);
      assert.equal(reelWhy(ctx, found, record, 9), "There is no Reel 9. The Reels are 2, 3.");
      assert.equal(reelWhy(ctx, found, { ...record, reels: [] }, 1), "There is no Reel 1. The Reels are none.");
      assert.equal(reelWhy(ctx, found, { ...record, reels: undefined }, 1), "There is no Reel 1. The Reels are none.");
      assert.equal(reelWhy(ctx, found, record, 0), "There is no Reel 0. The Reels are 2, 3.");
    });
    it("says a finished Reel is in the hand-off, unless the record lists its project, which is opened whatever the list says", (c) => {
      const { ctx, found, record } = here(c);
      const finished = { ...record, reels: record.reels.map((r) => (r.n === 2 ? { ...r, status: "finished" } : r)) };
      assert.equal(reelWhy(ctx, found, finished, 2), "Reel 2 is finished: it is in the hand-off already.");
      const project = { key: "reel 2" };
      assert.equal(reelWhy(ctx, found, { ...finished, app: { projects: [project] } }, 2), "");
      assert.equal(reelWhy(ctx, found, { ...record, reels: [], app: { projects: [project] } }, 2), "", "a project is opened though the list no longer has its Reel");
    });
    it("leaves the list to the reading while it is at work: its suggestions are what it makes", (c) => {
      const { ctx, found, record, e } = here(c);
      mkdirSync(e.work, { recursive: true });
      assert.equal(takeEpisodeLock(lockOf(e.home, FOLDER), "read", () => true).taken, true);
      assert.equal(reelWhy(ctx, found, { ...record, reels: [] }, 2), "");
      assert.equal(reelWhy(ctx, found, { ...record, reels: [] }, 9), "");
    });
    it("holds no path, no flag and no command name", (c) => {
      const { ctx, found, record } = here(c);
      plain([reelWhy(ctx, found, record, 9), reelWhy(ctx, found, { ...record, reels: [] }, 1)]);
    });
  });
  describe("reelStretch: where the Reel is in the recording, read from the list of suggestions", () => {
    it("gives the Reel's stretch from its first moment to its last, whatever lies between", (c) => {
      const e = episode(c, { reels: [candidate(2, 1.15, 2.6, { ranges: [{ start: 1.15, end: 1.6 }, { start: 2, end: 2.6 }] })] });
      assert.deepEqual(reelStretch(e.folder, 2), { stretch: { n: 2, start: 1.15, end: 2.6 } });
    });
    it("says the Reel is gone, with the numbers there are, and when it has nothing to show or the list cannot be read", (c) => {
      const e = episode(c, { reels: [CANDIDATES[1], candidate(4, 1, 1, { ranges: [], failed: "it is shorter than one picture" })] });
      assert.deepEqual(reelStretch(e.folder, 2), { gone: true, numbers: [3, 4] });
      assert.deepEqual(reelStretch(e.folder, 4), { nothing: "it is shorter than one picture" });
      rmSync(join(e.folder, "reels.json"));
      assert.deepEqual(reelStretch(e.folder, 2), { unreadable: true });
      writeFileSync(join(e.folder, "reels.json"), "{ not json");
      assert.deepEqual(reelStretch(e.folder, 2), { unreadable: true });
    });
  });
});
