// Opening an episode in HyperFrames (plan PR 4; architecture 2026-10-27, sections 4.1, 5.3 and 5.6). No test runs the command line,
// the app or HeyGen: the stand-in (tests/stand-ins/hyperframes.mjs) answers as the pinned version does, from PR 1's fixtures, and
// writes down how it was run, so a test can check the arguments and the environment `app` gives it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { childEnv, PIN, readOpen } from "../hyperframes.js";
import { openInApp, NOT_SET_UP } from "../app.js";
import { takeEpisodeLock } from "../detached.js";
import { episodeFault, layoutOf, localStamp, newEpisode } from "../episode.js";
import { episodeWork } from "../settings.js";
import { workCopyKey, workCopyLockOf, workCopyPaths } from "../workcopy.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";

/** A home folder for the stand-in, which reads how to answer `open` from a file there (`hyperframes-stand-in.json`) and writes each
    run it makes to another (`hyperframes-stand-in.log`): it is run in PR 1's environment, which carries no variable of a test's. */
function standIn(c, { open = "opened" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-stand-in-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open }));
  const env = (more = {}) => childEnv({ base: { HOME: home, LANG: "en_US.UTF-8" }, node: process.execPath, ...more });
  const run = (args, more) => spawnSync(process.execPath, [STAND_IN, ...args], { env: env(more), encoding: "utf8" });
  const runs = () => (existsSync(join(home, "hyperframes-stand-in.log")) ? readFileSync(join(home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  return { home, project: join(home, "BRIMM Video Work", "Pricing talk", "Pricing talk main 3fa9c1"), run, runs };
}

describe("the HyperFrames stand-in", () => {
  it("says the pinned version", (c) => {
    const s = standIn(c);
    const r = s.run(["--version"]);
    assert.deepEqual([r.status, r.stdout], [0, `${PIN.version}\n`]);
  });
  it("opens a project as the test tells it to, and says so as the pinned open --json does", (c) => {
    for (const [open, code, words] of [
      ["opened", 0, "It's open in HyperFrames."],
      ["not-installed", 1, "HyperFrames isn't installed on this Mac: ask Jason."],
      ["open-failed", 1, "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]
    ]) {
      const s = standIn(c, { open });
      const r = s.run(["open", s.project, "--json"]);
      assert.equal(r.status, code, open);
      assert.equal(JSON.parse(r.stdout).project, s.project, open);
      assert.equal(readOpen(r.stdout, r.status).words, words, open);
    }
  });
  it("takes the chat over only when its environment carries a chat's id", (c) => {
    const s = standIn(c);
    assert.equal(JSON.parse(s.run(["open", s.project, "--json"]).stdout).handedOver, null);
    const handed = JSON.parse(s.run(["open", s.project, "--json"], { handover: true, sessionId: CHAT }).stdout);
    assert.deepEqual(handed.handedOver, { engine: "claude", sessionId: CHAT });
    assert.equal(readOpen(JSON.stringify(handed), 0).words, "It's open in HyperFrames, and it picks up this conversation.");
  });
  it("answers catch-up and history as an untouched project's", (c) => {
    const s = standIn(c);
    const caught = s.run(["catch-up", s.project, "--json"]);
    assert.deepEqual([caught.status, JSON.parse(caught.stdout)], [0, { project: s.project, turns: [], files: [] }]);
    const history = s.run(["history", "--dir", s.project, "--json"]);
    assert.deepEqual([history.status, JSON.parse(history.stdout).entries], [0, []]);
  });
  it("writes down each run: its arguments and the names of its environment", (c) => {
    const s = standIn(c);
    s.run(["--version"]);
    s.run(["open", s.project, "--json"], { handover: true, sessionId: CHAT });
    assert.deepEqual(s.runs(), [
      { args: ["--version"], env: ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"] },
      { args: ["open", s.project, "--json"], env: ["CLAUDE_CODE_SESSION_ID", "HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"] }
    ]);
  });
  it("answers nothing else, and ends with 2", (c) => {
    const s = standIn(c);
    for (const args of [["publish"], ["open"], ["render", s.project]]) {
      const r = s.run(args);
      assert.deepEqual([r.status, r.stdout], [2, ""], args.join(" "));
    }
  });
});

// --- openInApp: the working copy, the project, the pinned open and the record ---

const FOLDER = "2026-10-28 Pricing talk (Mac Studio)";
const AT = Date.parse("2026-10-28T15:00:00-04:00");
const WORDS = [{ w: "Pricing,", start: 0.5, end: 1.1 }, { w: "says", start: 1.2, end: 1.6 }, { w: "Sally.", start: 1.7, end: 2.5 }];
const PLAN = { by: "rules", phrases: [{ id: "p1", start: 0.4, end: 1.15, text: "Pricing,", words: WORDS.slice(0, 1), keep: false, kind: "retake", why: "said again" }, { id: "p2", start: 1.15, end: 2.6, text: "says Sally.", words: WORDS.slice(1), keep: true, kind: "keep", why: "" }] };
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));

/** An episode on this Mac, as `app` finds it once the gate and the claim are past: its folder in Episodes with the raw video, its
    words, its cut plan and its Reel candidates; this Mac's home with the stand-in's answers; and a context that collects what is
    said, what is started and each record written. `copy` makes the working copy first, as the job would. */
function episode(c, { open = "opened", copy = true, words = true, handover = false, chat = { sessionId: CHAT, held: false }, record: over = {} } = {}) {
  const s = standIn(c, { open });
  const folder = join(s.home, "Dropbox", "BRIMM Video", "Episodes", FOLDER);
  const raw = join(folder, "Talk.mov");
  const write = (path, text) => {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  };
  write(raw, "the raw video's bytes");
  if (words) write(join(folder, "Talk.words.json"), JSON.stringify(WORDS));
  write(join(folder, "Talk.cut-plan.json"), JSON.stringify(PLAN));
  write(join(folder, "reels.json"), JSON.stringify({ format: "brimm-video reels", version: 1, candidates: [] }));
  const stat = statSync(raw);
  const paths = workCopyPaths(s.home, FOLDER, workCopyKey({ bytes: stat.size, mtimeMs: stat.mtimeMs }));
  if (copy) {
    write(paths.video, "the working copy's bytes");
    write(paths.facts, JSON.stringify({ seconds: 2.6, fps: 30, width: 1920, height: 1080, bytes: 24 }));
  }
  const said = [];
  const started = [];
  const saved = [];
  const ctx = {
    home: s.home, machine: "Mac Studio", now: () => AT, alive: (pid) => pid === process.pid, say: (line) => said.push(line),
    start: (cmd, args) => started.push(args.slice(1)), settings: { root: join(s.home, "Dropbox", "BRIMM Video"), checkout: "/checkout", app: "hyperframes", appHandover: handover }
  };
  const record = { id: "e-20261028-3fa9c1", rev: 4, kind: "raw", name: { text: "Pricing talk", placeholder: false }, video: { file: "Talk.mov", bytes: stat.size, seconds: 2.6 }, spellings: [["Sally", "Sallie"]], ...over };
  const deps = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE, chat: () => chat, save: async (next) => (saved.push(next), 0) };
  const project = join(episodeWork(s.home, FOLDER), "Pricing talk main 3fa9c1");
  return { ...s, folder, raw, paths, said, started, saved, ctx, record, deps, project, found: { name: FOLDER, folder } };
}
const run = (e, record = e.record) => openInApp(e.ctx, { found: e.found, record }, e.deps);
/** Run `app` once with a `save` that cannot write the record (edit.js's says why, and resolves 1; `code` is what this one resolves),
    as a run is whose record was not written: it gives what the run ended with and each record it was asked to write. */
async function unwritten(e, code = 1) {
  const asked = [];
  const ended = await openInApp(e.ctx, { found: e.found, record: e.record }, { ...e.deps, save: async (next) => (asked.push(next), code) });
  return { ended, asked };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const plain = (said) => said.forEach((line) => assert.doesNotMatch(line, /\/|--|\bnpx\b|\bnode\b|hyperframes\.mjs/, line));
/** A project's folder as it is: every path in it, and the text of each file. */
const treeOf = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((path) => [path, lstatSync(join(dir, path)).isFile() ? readFileSync(join(dir, path), "utf8") : null]));
/** A whole record of the episode, so that the `app` a run writes can be read as the next command reads it (episode.js episodeFault). */
const WHOLE = { ...newEpisode({ id: "e-20261028-3fa9c1", machine: "Mac Studio", at: "2026-10-28T09:00:00-04:00", video: { file: "Talk.mov", bytes: 20, seconds: 2.6, created: null }, kind: "raw", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
/** What is wrong with the HyperFrames projects in a record `app` wrote: "" when the next command can read them. */
const unreadable = (next) => episodeFault({ ...WHOLE, app: next.app });

describe("app: opening an episode in HyperFrames", () => {
  it("makes the project from the working copy, opens it with the pinned command line in PR 1's environment, and records it", async (c) => {
    const e = episode(c);
    assert.equal(await run(e), 0);
    assert.deepEqual(e.said, ["It's open in HyperFrames."]);
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), "the working copy's bytes");
    assert.ok(!existsSync(e.paths.video), "the working copy was moved in, not copied");
    assert.ok(existsSync(e.paths.facts), "its facts stay where they were");
    assert.match(readFileSync(join(e.project, "transcript.json"), "utf8"), /"Sallie\."/);
    assert.deepEqual(e.runs(), [{ args: ["open", e.project, "--json"], env: ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"] }]);
    assert.equal(e.saved.length, 1);
    const next = e.saved[0];
    assert.equal(layoutOf(next), 4);
    assert.deepEqual(next.app, {
      toolchain: PIN.version,
      projects: [{
        key: "main", name: "Pricing talk main 3fa9c1", madeAt: localStamp(new Date(AT)), on: "Mac Studio",
        from: { file: "Talk.mov", bytes: statSync(e.raw).size, modified: localStamp(new Date(statSync(e.raw).mtimeMs)) },
        workingCopy: { bytes: 24, seconds: 2.6, fps: 30 }, opened: [localStamp(new Date(AT))], handover: false, fromSuggestion: null, state: "opened"
      }]
    });
    assert.deepEqual(e.started, []);
    plain(e.said);
  });
  it("opens the same project again, and makes no second project or working copy", async (c) => {
    const e = episode(c);
    await run(e);
    const before = readdirSync(episodeWork(e.home, FOLDER)).sort();
    assert.equal(await run(e, e.saved[0]), 0);
    assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), before);
    assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", e.project, "--json"]]);
    assert.deepEqual(e.saved[1].app.projects.map((p) => [p.name, p.opened.length, p.state]), [["Pricing talk main 3fa9c1", 2, "opened"]]);
    assert.deepEqual(e.started, []);
    assert.deepEqual(e.said, ["It's open in HyperFrames.", "It's open in HyperFrames."], "the recording is as it was, and nothing is said of it");
  });
  it("starts the working copy when there is none, says it is being made, and makes no project yet", async (c) => {
    const e = episode(c, { copy: false });
    assert.equal(await run(e), 0);
    assert.deepEqual(e.started, [["workcopy", "--now", FOLDER]]);
    assert.deepEqual(e.said, ['The video for HyperFrames is being made. Say "open Pricing talk in HyperFrames" again when it is done; "how far is it?" shows how far it has got.']);
    assert.ok(!existsSync(e.project));
    assert.deepEqual([e.saved, e.runs()], [[], []]);
  });
  it("starts no second working copy while one is being made", async (c) => {
    const e = episode(c, { copy: false });
    mkdirSync(episodeWork(e.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(workCopyLockOf(e.home, FOLDER), "workcopy", () => true).taken, true);
    assert.equal(await run(e), 0);
    assert.deepEqual(e.started, []);
    assert.match(e.said[0], /^The video for HyperFrames is being made\./);
  });
  it("hands her chat to the app only when this Mac's setting is on and the chat holds no session's words", async (c) => {
    const on = episode(c, { handover: true });
    await run(on);
    assert.deepEqual(on.said, ["It's open in HyperFrames, and it picks up this conversation."]);
    assert.ok(on.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    assert.equal(on.saved[0].app.projects[0].handover, true);
    const held = episode(c, { handover: true, chat: { sessionId: CHAT, held: true } });
    await run(held);
    assert.deepEqual(held.said, ["It's open in HyperFrames. It starts a new conversation.", "This chat has held a client or group session's words, so it stays here."]);
    assert.ok(!held.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    assert.equal(held.saved[0].app.projects[0].handover, false);
    const noChat = episode(c, { handover: true, chat: { sessionId: "", held: true } });
    await run(noChat);
    assert.deepEqual(noChat.said, ["It's open in HyperFrames. It starts a new conversation.", "This chat could not be found, so it stays here."]);
    const off = episode(c, { handover: false });
    await run(off);
    assert.deepEqual(off.said, ["It's open in HyperFrames."]);
    assert.ok(!off.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    plain([...on.said, ...held.said, ...noChat.said, ...off.said]);
  });
  it("keeps the project when HyperFrames will not open, records no time it opened, and says so in her words", async (c) => {
    for (const [open, words] of [["not-installed", "HyperFrames isn't installed on this Mac: ask Jason."], ["open-failed", "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason."]]) {
      const e = episode(c, { open });
      assert.equal(await run(e), 1, open);
      assert.deepEqual(e.said, [words], open);
      assert.ok(existsSync(join(e.project, "index.html")), open);
      assert.deepEqual(e.saved[0].app.projects.map((p) => [p.state, p.opened]), [["made", []]], open);
    }
  });
  it("ends with 1 when the record cannot be written, after the project is made and the app has opened", async (c) => {
    // edit.js's save says why it could not write and resolves 1; anything but 0 is a record that was not written.
    for (const code of [1, undefined]) {
      const e = episode(c);
      const { ended, asked } = await unwritten(e, code);
      assert.equal(ended, 1, String(code));
      assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"]], String(code));
      assert.deepEqual(e.said, ["It's open in HyperFrames."], String(code));
      assert.deepEqual(asked.map((record) => record.app.projects.map((p) => p.state)), [["opened"]], String(code));
      assert.ok(existsSync(join(e.project, "index.html")), `${code}: the project stays`);
    }
  });
  it("opens a project folder the record does not know, as a run whose record was not written leaves one, and records it", async (c) => {
    for (const [what, recordOf] of [
      ["has no project", (e) => e.record],
      ["has one whose folder is gone", (e, asked) => ({ ...e.record, app: { toolchain: PIN.version, projects: [{ ...asked[0].app.projects[0], name: "Pricing main 3fa9c1" }] } })]
    ]) {
      // The first run made the project and opened the app, and could not write the record.
      const e = episode(c);
      const { ended, asked } = await unwritten(e);
      assert.equal(ended, 1, what);
      const made = readdirSync(episodeWork(e.home, FOLDER)).sort();
      // The working copy's facts stay where they were; here they differ from the project's own, to show which of them is read.
      writeFileSync(e.paths.facts, JSON.stringify({ seconds: 2.6, fps: 29.97, width: 1920, height: 1080, bytes: 24 }));
      e.said.splice(0);
      // The second run is given the record as it was, which has no project (or one whose folder is gone), and the folder is there.
      assert.equal(await run(e, recordOf(e, asked)), 0, what);
      assert.deepEqual(e.started, [], `${what}: no working copy is asked for`);
      assert.deepEqual(e.said, ["It's open in HyperFrames."], what);
      assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), made, `${what}: no project is written again`);
      assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", e.project, "--json"]], what);
      assert.equal(e.saved.length, 1, what);
      assert.deepEqual(e.saved[0].app, {
        toolchain: PIN.version,
        projects: [{
          key: "main", name: "Pricing talk main 3fa9c1", madeAt: localStamp(new Date(AT)), on: "Mac Studio",
          from: { file: "Talk.mov", bytes: statSync(e.raw).size, modified: localStamp(new Date(statSync(e.raw).mtimeMs)) },
          workingCopy: { bytes: 24, seconds: 2.6, fps: 29.97 }, opened: [localStamp(new Date(AT))], handover: false, fromSuggestion: null, state: "opened"
        }]
      }, what);
      assert.equal(unreadable(e.saved[0]), "", what);
      plain(e.said);
    }
  });
  it("does not write the project again, nor move a working copy made meanwhile into it", async (c) => {
    const e = episode(c);
    await unwritten(e);
    writeFileSync(e.paths.video, "a working copy made again");
    assert.equal(await run(e), 0);
    assert.equal(readFileSync(e.paths.video, "utf8"), "a working copy made again");
    assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), "the working copy's bytes");
    assert.deepEqual(e.started, []);
    assert.deepEqual(e.saved.map((record) => record.app.projects.map((p) => [p.name, p.state])), [[["Pricing talk main 3fa9c1", "opened"]]]);
  });
  it("takes what the working copy is from the project's own facts when the copy's facts are gone too", async (c) => {
    const e = episode(c);
    await unwritten(e);
    rmSync(e.paths.facts);
    assert.equal(await run(e), 0);
    assert.deepEqual(e.started, []);
    // brimm/facts.json holds the length and the rate; the size is that of the video in the project.
    assert.deepEqual(e.saved[0].app.projects.map((p) => [p.name, p.workingCopy, p.state]), [["Pricing talk main 3fa9c1", { bytes: 24, seconds: 2.6, fps: 30 }, "opened"]]);
    assert.equal(unreadable(e.saved[0]), "");
  });
  it("never takes a project the record keeps for an earlier kind for the main project", async (c) => {
    const e = episode(c);
    const { asked } = await unwritten(e);
    const kept = { ...e.record, app: { toolchain: PIN.version, projects: [{ ...asked[0].app.projects[0], state: "kept for an earlier kind" }] } };
    // The working copy is not there (the first project's writer moved it in), so it is asked for, as for any project that has none;
    // what matters here is that the kept project is neither opened nor recorded again as the main one.
    await run(e, kept);
    assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"]], "only the first run opened it");
    assert.deepEqual(e.saved, []);
  });
  describe("a correction kept the first project, and the next is another folder (4.8)", () => {
    const KEPT = "kept for an earlier kind";
    const SECOND = "Pricing talk main 2 3fa9c1";
    const THIRD = "Pricing talk main 3 3fa9c1";
    /** The episode with its first project made and opened, and the record that says it is kept for an earlier kind, as `kind` writes it. */
    async function keptOnce(c) {
      const e = episode(c);
      assert.equal(await run(e), 0);
      const [first] = e.saved[0].app.projects;
      const kept = { ...e.saved[0], app: { ...e.saved[0].app, projects: [{ ...first, state: KEPT }] } };
      e.said.splice(0);
      return { e, first, kept };
    }
    /** A working copy made again, as the run `kind` asked for makes one: the first project's writer moved the last into the project. */
    const copyAgain = (e, text = "a second working copy") => writeFileSync(e.paths.video, text);
    it("makes the next main project under the first name no project of the record has, \"main 2\", and records it as the main one, with the kept project untouched", async (c) => {
      const { e, first, kept } = await keptOnce(c);
      copyAgain(e);
      const keptTree = treeOf(e.project);
      assert.equal(await run(e, kept), 0);
      const second = join(episodeWork(e.home, FOLDER), SECOND);
      assert.ok(existsSync(join(second, "index.html")));
      assert.equal(readFileSync(join(second, "media", "recording.mp4"), "utf8"), "a second working copy");
      assert.equal(JSON.parse(readFileSync(join(second, "meta.json"), "utf8")).name, SECOND);
      // The kept project keeps its own folder, as it was, and its own entry, with the state it was kept in; the new one is the main one.
      assert.deepEqual(treeOf(e.project), keptTree);
      assert.equal(e.saved.length, 2);
      assert.deepEqual(e.saved[1].app.projects.map((p) => [p.key, p.name, p.state, p.opened.length]), [["main", first.name, KEPT, 1], ["main", SECOND, "opened", 1]]);
      assert.deepEqual(e.saved[1].app.projects[0], { ...first, state: KEPT });
      assert.equal(unreadable(e.saved[1]), "");
      // It opened the new project, and said what it says of any: nothing of names, and no working copy was asked for.
      assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", second, "--json"]]);
      assert.deepEqual([e.said, e.started], [["It's open in HyperFrames."], []]);
      plain(e.said);
    });
    it("makes \"main 3\" after a third kind, and \"main 4\" after a fourth: the first name that no project of the record has", async (c) => {
      const { e, kept } = await keptOnce(c);
      copyAgain(e);
      assert.equal(await run(e, kept), 0);
      const twice = { ...e.saved[1], app: { ...e.saved[1].app, projects: e.saved[1].app.projects.map((p) => ({ ...p, state: KEPT })) } };
      copyAgain(e, "a third working copy");
      assert.equal(await run(e, twice), 0);
      assert.deepEqual(e.saved[2].app.projects.map((p) => [p.name, p.state]), [["Pricing talk main 3fa9c1", KEPT], [SECOND, KEPT], [THIRD, "opened"]]);
      assert.equal(readFileSync(join(episodeWork(e.home, FOLDER), THIRD, "media", "recording.mp4"), "utf8"), "a third working copy");
      const thrice = { ...e.saved[2], app: { ...e.saved[2].app, projects: e.saved[2].app.projects.map((p) => ({ ...p, state: KEPT })) } };
      copyAgain(e, "a fourth working copy");
      assert.equal(await run(e, thrice), 0);
      assert.deepEqual(e.saved[3].app.projects.map((p) => p.name).slice(-1), ["Pricing talk main 4 3fa9c1"]);
      assert.equal(unreadable(e.saved[3]), "");
    });
    it("takes the name of a kept project of any state as taken, wherever it is in the record's list", async (c) => {
      const { e, first, kept } = await keptOnce(c);
      // The list holds a Reel's project first, the kept main project after it, and a main 2 project that is kept too.
      const reelEntry = { ...first, key: "reel 1", name: "Pricing talk reel 1 3fa9c1", fromSuggestion: 1 };
      const second = { ...first, name: SECOND, state: KEPT };
      copyAgain(e);
      assert.equal(await run(e, { ...kept, app: { ...kept.app, projects: [reelEntry, second, ...kept.app.projects] } }), 0);
      assert.deepEqual(e.saved[1].app.projects.map((p) => p.name).slice(-1), [THIRD]);
      assert.deepEqual(e.saved[1].app.projects.map((p) => p.name).slice(0, 3), ["Pricing talk reel 1 3fa9c1", SECOND, "Pricing talk main 3fa9c1"]);
    });
    it("keeps the name of a main project in use whose folder is gone: it is replaced, not kept, so its name is free", async (c) => {
      const e = episode(c);
      assert.equal(await run(e), 0);
      rmSync(e.project, { recursive: true });
      copyAgain(e);
      assert.equal(await run(e, e.saved[0]), 0);
      assert.deepEqual(e.saved[1].app.projects.map((p) => [p.name, p.state]), [["Pricing talk main 3fa9c1", "opened"]]);
      assert.equal(readFileSync(join(e.project, "media", "recording.mp4"), "utf8"), "a second working copy");
    });
    it("adopts a folder at the \"main 2\" name that the record does not know, as a run whose record was not written leaves one, and writes nothing over it", async (c) => {
      const { e, first, kept } = await keptOnce(c);
      copyAgain(e);
      // The run that made main 2 opened the app and could not write the record.
      const ended = await openInApp(e.ctx, { found: e.found, record: kept }, { ...e.deps, save: async () => 1 });
      assert.equal(ended, 1);
      const work = episodeWork(e.home, FOLDER);
      const second = join(work, SECOND);
      assert.ok(existsSync(join(second, "index.html")));
      const before = [readdirSync(work).sort(), treeOf(second)];
      e.said.splice(0);
      // The next run is given the record as it was: it does not know the folder, which is at the name the next main project gets.
      assert.equal(await run(e, kept), 0);
      assert.deepEqual([readdirSync(work).sort(), treeOf(second)], before, "nothing is written again, and nothing over the folder that is there");
      assert.deepEqual([e.said, e.started], [["It's open in HyperFrames."], []], "no working copy is asked for");
      assert.deepEqual(e.saved.at(-1).app.projects.map((p) => [p.name, p.state]), [[first.name, KEPT], [SECOND, "opened"]]);
      assert.equal(unreadable(e.saved.at(-1)), "");
      assert.deepEqual(e.runs().slice(-2).map((r) => r.args), [["open", second, "--json"], ["open", second, "--json"]]);
    });
    it("writes nothing over a folder at that name that it cannot take for a project, and opens nothing", async (c) => {
      const { e, kept } = await keptOnce(c);
      copyAgain(e);
      const second = join(episodeWork(e.home, FOLDER), SECOND);
      mkdirSync(second, { recursive: true });
      writeFileSync(join(second, "notes.txt"), "a folder of someone's own");
      rmSync(e.paths.facts);
      assert.equal(await run(e, kept), 1);
      assert.deepEqual(e.said, ["The HyperFrames project for Pricing talk is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason."]);
      assert.deepEqual(treeOf(second), { "notes.txt": "a folder of someone's own" });
      assert.equal(readFileSync(e.paths.video, "utf8"), "a second working copy", "the working copy is where it was");
      assert.deepEqual([e.saved.length, e.runs().length, e.started], [1, 1, []]);
    });
  });
  it("does not open a project folder it cannot read the working copy of, and says so", async (c) => {
    for (const [what, spoil] of [
      ["its facts are gone", (e) => (rmSync(e.paths.facts), rmSync(join(e.project, "brimm", "facts.json")))],
      ["its facts are not JSON", (e) => (writeFileSync(e.paths.facts, "{"), writeFileSync(join(e.project, "brimm", "facts.json"), "{"))],
      ["its video is gone", (e) => (rmSync(e.paths.facts), rmSync(join(e.project, "media", "recording.mp4")))]
    ]) {
      const e = episode(c);
      await unwritten(e);
      spoil(e);
      e.said.splice(0);
      assert.equal(await run(e), 1, what);
      assert.deepEqual(e.said, ["The HyperFrames project for Pricing talk is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason."], what);
      assert.deepEqual([e.saved, e.started], [[], []], what);
      assert.equal(e.runs().length, 1, `${what}: only the first run opened it`);
      plain(e.said);
    }
  });
  it("says when the recording has changed since the project was made, and opens the project as it was", async (c) => {
    const CHANGED = "The recording of Pricing talk has changed since its HyperFrames project was made: the project is opened as it was, with the recording it was made from.";
    for (const [what, change] of [
      ["in its size", (e) => {
        const { mtimeMs } = statSync(e.raw);
        writeFileSync(e.raw, "the raw video, another take");
        utimesSync(e.raw, mtimeMs / 1000, mtimeMs / 1000);
      }],
      ["in its time", (e) => {
        const later = (statSync(e.raw).mtimeMs + 3600 * 1000) / 1000;
        utimesSync(e.raw, later, later);
      }]
    ]) {
      const e = episode(c);
      await run(e);
      const project = treeOf(e.project);
      const folders = readdirSync(episodeWork(e.home, FOLDER)).sort();
      change(e);
      e.said.splice(0);
      assert.equal(await run(e, e.saved[0]), 0, what);
      assert.deepEqual(e.said, [CHANGED, "It's open in HyperFrames."], what);
      assert.deepEqual(e.started, [], `${what}: no working copy is asked for`);
      assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), folders, `${what}: no project is made`);
      assert.deepEqual(treeOf(e.project), project, `${what}: nothing is replaced under the project`);
      assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", e.project, "--json"]], what);
      const [first, again] = e.saved.map((record) => record.app.projects);
      assert.deepEqual(again.map((p) => [p.name, p.opened.length, p.state]), [["Pricing talk main 3fa9c1", 2, "opened"]], what);
      assert.deepEqual(again[0].from, first[0].from, `${what}: the record still says what the project was made from`);
      plain(e.said);
    }
  });
  it("says nothing of the recording while it is as it was, however its time is written, or when it is not there to look at", async (c) => {
    const e = episode(c);
    await run(e);
    const [made] = e.saved[0].app.projects;
    // The same moment written in another zone, as a time written before the clocks changed is now.
    const utc = new Date(Date.parse(made.from.modified)).toISOString().replace(/\.\d+Z$/, "Z");
    assert.notEqual(utc, made.from.modified);
    assert.equal(await run(e, { ...e.saved[0], app: { ...e.saved[0].app, projects: [{ ...made, from: { ...made.from, modified: utc } }] } }), 0);
    // The recording is looked at only to compare it: a project opens without it.
    rmSync(e.raw);
    assert.equal(await run(e, e.saved[1]), 0);
    assert.deepEqual(e.said, ["It's open in HyperFrames.", "It's open in HyperFrames.", "It's open in HyperFrames."]);
  });
  it("makes nothing without the words of the recording, and says why", async (c) => {
    const e = episode(c, { words: false });
    assert.equal(await run(e), 1);
    assert.deepEqual(e.said, ["The words of Pricing talk are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason."]);
    assert.ok(!existsSync(e.project));
    assert.deepEqual([e.saved, e.runs(), e.started], [[], [], []]);
  });
  it("says this Mac is not set up for HyperFrames in words that hold no path", () => {
    assert.equal(NOT_SET_UP, "This Mac isn't set up for HyperFrames yet: ask Jason.");
  });
});
