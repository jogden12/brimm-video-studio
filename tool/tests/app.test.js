// Opening an episode in HyperFrames (plan PR 4; architecture 2026-10-27, sections 4.1, 5.3 and 5.6). No test runs the command line,
// the app or HeyGen: the stand-in (tests/stand-ins/hyperframes.mjs) answers as the pinned version does, from PR 1's fixtures, and
// writes down how it was run, so a test can check the arguments and the environment `app` gives it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { childEnv, PIN, readHistory, readOpen } from "../hyperframes.js";
import { openInApp, projectOnAnotherMac, NOT_SET_UP } from "../app.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { processTable } from "../chain.js";
import { episodeFault, layoutOf, localStamp, newEpisode } from "../episode.js";
import { markChat } from "../held.js";
import { claudeDirName } from "../places.js";
import { episodeWork } from "../settings.js";
import { workCopyKey, workCopyLockOf, workCopyPaths } from "../workcopy.js";
import { psText } from "./open-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";
/** The line `app` ends with whenever the app opened: the buttons Studio cannot turn off (architecture 5.9). */
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";

/** A home folder for the stand-in, which reads how to answer `open` and `history` from a file there (`hyperframes-stand-in.json`) and
    writes each run it makes to another (`hyperframes-stand-in.log`): it is run in PR 1's environment, which carries no variable of a
    test's. `history` is "empty" (an untouched project's, the default), "entries" (the fixture's), "far" (the fixture's, with times no
    date can hold), "fails" or "garbled". */
function standIn(c, { open = "opened", history = "empty" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-stand-in-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open, history }));
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
    const history = s.run(["history", "--json", "--limit", "20", "--dir", s.project]);
    assert.deepEqual([history.status, JSON.parse(history.stdout).entries], [0, []]);
    assert.deepEqual(readHistory(history.stdout, history.status), { ok: true, entries: [] });
  });
  it("answers history as the fixture's entries when the test says so, the newest of them up to the limit it is given", (c) => {
    const s = standIn(c, { history: "entries" });
    const all = s.run(["history", "--json", "--limit", "20", "--dir", s.project]);
    assert.equal(all.status, 0);
    const read = readHistory(all.stdout, all.status);
    assert.deepEqual([read.ok, read.entries.length, read.entries.map((e) => e.kind)], [true, 6, ["agent", "person", "outside", "agent", "agent", "agent"]]);
    assert.deepEqual(Object.keys(JSON.parse(all.stdout)), ["entries", "_meta"]);
    const two = s.run(["history", "--json", "--limit", "2", "--dir", s.project]);
    assert.deepEqual(readHistory(two.stdout, two.status).entries.map((e) => e.kind), ["agent", "person"]);
  });
  it("answers history with times no date can hold when the test says so: the fixture's entries, each ended 1e20, -1e20, one past the edge of a Date and so on", (c) => {
    const s = standIn(c, { history: "far" });
    const far = s.run(["history", "--json", "--limit", "20", "--dir", s.project]);
    assert.equal(far.status, 0);
    const said = JSON.parse(far.stdout);
    assert.deepEqual(Object.keys(said), ["entries", "_meta"]);
    assert.equal(said.entries.length, 6);
    for (const entry of said.entries) assert.ok(typeof entry.endedAt === "number" && Number.isFinite(entry.endedAt) && Math.abs(entry.endedAt) > 8.64e15, String(entry.endedAt));
    assert.deepEqual(said.entries.slice(0, 4).map((e) => e.endedAt), [1e20, -1e20, 8.64e15 + 1, 1e300]);
    assert.deepEqual(said.entries.map((e) => e.label), JSON.parse(readFileSync(new URL("./fixtures/hyperframes-0.8.208/history-entries.json", import.meta.url), "utf8")).entries.map((e) => e.label));
  });
  it("fails history as the pinned version does when a project cannot be listed: {ok: false} on stdout and exit 2", (c) => {
    const s = standIn(c, { history: "fails" });
    const failed = s.run(["history", "--json", "--limit", "20", "--dir", s.project]);
    assert.equal(failed.status, 2);
    const said = JSON.parse(failed.stdout);
    assert.deepEqual([said.ok, typeof said.error, Object.keys(said)], [false, "string", ["ok", "error", "_meta"]]);
    assert.deepEqual(readHistory(failed.stdout, failed.status), { ok: false });
  });
  it("prints what is not JSON for history when the test says so, with exit 0", (c) => {
    const s = standIn(c, { history: "garbled" });
    const garbled = s.run(["history", "--json", "--limit", "20", "--dir", s.project]);
    assert.equal(garbled.status, 0);
    assert.deepEqual(readHistory(garbled.stdout, garbled.status), { ok: false });
  });
  it("answers history in the order Studio runs it, and no other, as it answers nothing it was not built for", (c) => {
    const s = standIn(c, { history: "entries" });
    for (const args of [["history", "--dir", s.project, "--json"], ["history", "--json", "--dir", s.project], ["history", "--json", "--limit", "20"], ["history", "--limit", "20", "--json", "--dir", s.project], ["history"]]) {
      const r = s.run(args);
      assert.deepEqual([r.status, r.stdout], [2, ""], args.join(" "));
    }
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
    assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
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
    assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS, "It's open in HyperFrames.", BUTTONS], "the recording is as it was, and nothing is said of it");
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
  describe("while Claude is still reading the episode (a `read` run holds the episode's lock)", () => {
    const STILL = 'Claude is still reading it. Say "open Pricing talk in HyperFrames" again when it has finished; "how far is it?" shows how far it has got.';
    /** A run of `command` at work on the episode now, as a live process holds it: the lock is the episode's own, and this very
        process is the live one (the context's `alive`). */
    function atWork(e, command = "read") {
      mkdirSync(episodeWork(e.home, FOLDER), { recursive: true });
      assert.equal(takeEpisodeLock(lockOf(e.home, FOLDER), command, () => true).taken, true);
    }
    it("makes no project while the reading is at work: it says Claude is still reading, writes nothing and ends with 0", async (c) => {
      const e = episode(c);
      atWork(e);
      const before = readdirSync(episodeWork(e.home, FOLDER)).sort();
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, [STILL]);
      assert.ok(!existsSync(e.project));
      assert.deepEqual([e.saved, e.runs(), e.started], [[], [], []]);
      assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), before, "nothing is written beside the lock");
      assert.equal(readFileSync(e.paths.video, "utf8"), "the working copy's bytes", "the working copy is where it was, not moved into a project");
      plain(e.said);
    });
    it("asks for the working copy when there is none, exactly as it does without a reading, but says only that Claude is reading", async (c) => {
      const e = episode(c, { copy: false });
      atWork(e);
      assert.equal(await run(e), 0);
      assert.deepEqual(e.started, [["workcopy", "--now", FOLDER]]);
      assert.deepEqual(e.said, [STILL]);
      assert.ok(!existsSync(e.project));
      assert.deepEqual([e.saved, e.runs()], [[], []]);
    });
    it("makes the project the next time it is asked, once the reading has ended", async (c) => {
      const e = episode(c);
      atWork(e);
      assert.equal(await run(e), 0);
      rmSync(lockOf(e.home, FOLDER));
      e.said.splice(0);
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
      assert.ok(existsSync(join(e.project, "index.html")));
      assert.deepEqual(e.saved.map((record) => record.app.projects.map((p) => p.state)), [["opened"]]);
    });
    it("makes the project as before when no reading is at work: a lock left by a reading that died, or another command at work, stops nothing", async (c) => {
      for (const [what, hold] of [
        ["a reading that died", (e) => (mkdirSync(episodeWork(e.home, FOLDER), { recursive: true }), writeFileSync(lockOf(e.home, FOLDER), JSON.stringify({ pid: 4242, command: "read" })))],
        ["a bring", (e) => atWork(e, "bring")]
      ]) {
        const e = episode(c);
        hold(e);
        assert.equal(await run(e), 0, what);
        assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS], what);
        assert.ok(existsSync(join(e.project, "index.html")), what);
        assert.deepEqual(e.saved.map((record) => record.app.projects.map((p) => p.state)), [["opened"]], what);
      }
    });
    it("opens a project made before while the reading is at work, and makes nothing: only a new project waits for the reading", async (c) => {
      const e = episode(c);
      assert.equal(await run(e), 0);
      const before = readdirSync(episodeWork(e.home, FOLDER)).sort();
      atWork(e);
      e.said.splice(0);
      assert.equal(await run(e, e.saved[0]), 0);
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
      assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), [...before, "episode.lock"].sort());
      assert.deepEqual(e.runs().map((r) => r.args), [["open", e.project, "--json"], ["open", e.project, "--json"]]);
      assert.deepEqual(e.saved[1].app.projects.map((p) => [p.name, p.opened.length, p.state]), [["Pricing talk main 3fa9c1", 2, "opened"]]);
    });
    it("takes a project folder the record does not know while the reading is at work: the folder is there already, so nothing is made", async (c) => {
      const e = episode(c);
      const { ended } = await unwritten(e);
      assert.equal(ended, 1);
      const made = readdirSync(episodeWork(e.home, FOLDER)).sort();
      atWork(e);
      e.said.splice(0);
      assert.equal(await run(e), 0);
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
      assert.deepEqual(readdirSync(episodeWork(e.home, FOLDER)).sort(), [...made, "episode.lock"].sort());
      assert.deepEqual(e.saved.map((record) => record.app.projects.map((p) => [p.name, p.state])), [[["Pricing talk main 3fa9c1", "opened"]]]);
    });
  });
  it("hands her chat to the app only when this Mac's setting is on and the chat holds no session's words", async (c) => {
    const on = episode(c, { handover: true });
    await run(on);
    assert.deepEqual(on.said, ["It's open in HyperFrames, and it picks up this conversation.", BUTTONS]);
    assert.ok(on.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    assert.equal(on.saved[0].app.projects[0].handover, true);
    const held = episode(c, { handover: true, chat: { sessionId: CHAT, held: true } });
    await run(held);
    assert.deepEqual(held.said, ["It's open in HyperFrames. It starts a new conversation.", "This chat has held a client or group session's words, so it stays here.", BUTTONS]);
    assert.ok(!held.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    assert.equal(held.saved[0].app.projects[0].handover, false);
    const noChat = episode(c, { handover: true, chat: { sessionId: "", held: true } });
    await run(noChat);
    assert.deepEqual(noChat.said, ["It's open in HyperFrames. It starts a new conversation.", "This chat could not be found, so it stays here.", BUTTONS]);
    const off = episode(c, { handover: false });
    await run(off);
    assert.deepEqual(off.said, ["It's open in HyperFrames.", BUTTONS]);
    assert.ok(!off.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"));
    plain([...on.said, ...held.said, ...noChat.said, ...off.said]);
  });
  describe("the buttons Studio cannot control (architecture 3.3 and 5.9)", () => {
    it("ends what it says with them whenever the app opened: after the opening, and after what it says of her chat", async (c) => {
      for (const [what, options, first] of [
        ["no handover asked", {}, ["It's open in HyperFrames."]],
        ["her chat handed over", { handover: true }, ["It's open in HyperFrames, and it picks up this conversation."]],
        ["her chat wanted and kept", { handover: true, chat: { sessionId: CHAT, held: true } }, ["It's open in HyperFrames. It starts a new conversation.", "This chat has held a client or group session's words, so it stays here."]]
      ]) {
        const e = episode(c, options);
        assert.equal(await run(e), 0, what);
        assert.deepEqual(e.said, [...first, BUTTONS], what);
        assert.equal(e.said.at(-1), "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.", what);
        plain(e.said);
      }
    });
    it("says them each time the app is opened, the project made before included", async (c) => {
      const e = episode(c);
      await run(e);
      await run(e, e.saved[0]);
      assert.equal(e.said.filter((line) => line === BUTTONS).length, 2);
    });
    it("says them when the app opened and the record could not be written, since the app is open all the same", async (c) => {
      const e = episode(c);
      const { ended } = await unwritten(e);
      assert.equal(ended, 1);
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS]);
    });
    it("does not say them when the app did not open, or when nothing was opened because the video or the reading is not ready", async (c) => {
      for (const [what, make] of [
        ["not installed", () => episode(c, { open: "not-installed" })],
        ["would not open", () => episode(c, { open: "open-failed" })],
        ["the video is being made", () => episode(c, { copy: false })],
        ["no words", () => episode(c, { words: false })],
        ["Claude is still reading", () => {
          const e = episode(c);
          mkdirSync(episodeWork(e.home, FOLDER), { recursive: true });
          assert.equal(takeEpisodeLock(lockOf(e.home, FOLDER), "read", () => true).taken, true);
          return e;
        }]
      ]) {
        const e = make();
        await run(e);
        assert.equal(e.said.length, 1, what);
        assert.ok(!e.said.includes(BUTTONS), what);
      }
    });
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
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS], String(code));
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
      assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS], what);
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
      assert.deepEqual([e.said, e.started], [["It's open in HyperFrames.", BUTTONS], []]);
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
      assert.deepEqual([e.said, e.started], [["It's open in HyperFrames.", BUTTONS], []], "no working copy is asked for");
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
      assert.deepEqual(e.said, [CHANGED, "It's open in HyperFrames.", BUTTONS], what);
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
    assert.deepEqual(e.said, ["It's open in HyperFrames.", BUTTONS, "It's open in HyperFrames.", BUTTONS, "It's open in HyperFrames.", BUTTONS]);
  });
  it("makes nothing without the words of the recording, and says why", async (c) => {
    const e = episode(c, { words: false });
    assert.equal(await run(e), 1);
    assert.deepEqual(e.said, ["The words of Pricing talk are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason."]);
    assert.ok(!existsSync(e.project));
    assert.deepEqual([e.saved, e.runs(), e.started], [[], [], []]);
  });
  describe("projectOnAnotherMac: the main project in use is another Mac's and is not here", () => {
    /** The episode with its main project made and opened on this Mac, "Mac Studio", and the record that says so. */
    async function madeHere(c) {
      const e = episode(c);
      assert.equal(await run(e), 0);
      return { e, record: e.saved[0] };
    }
    /** The record with each project of it changed by `over`: as the other Mac's record would say it. */
    const changed = (record, over) => ({ ...record, app: { ...record.app, projects: record.app.projects.map((p) => ({ ...p, ...over })) } });
    const asked = (e, record) => projectOnAnotherMac(e.ctx, { found: e.found, record });
    it("gives the name of the Mac the project was made on, when that is not this one and the project's folder is not on this Mac", async (c) => {
      const { e, record } = await madeHere(c);
      rmSync(e.project, { recursive: true });
      assert.equal(asked(e, changed(record, { on: "Sallie's laptop" })), "Sallie's laptop");
    });
    it("gives null when this Mac made the project, whether or not its folder is still here", async (c) => {
      const { e, record } = await madeHere(c);
      assert.equal(asked(e, record), null);
      rmSync(e.project, { recursive: true });
      assert.equal(asked(e, record), null, "a project of this Mac's whose folder is gone is made again, under its own name");
    });
    it("gives null when the project's folder is on this Mac, whichever Mac made it", async (c) => {
      const { e, record } = await madeHere(c);
      assert.equal(asked(e, changed(record, { on: "Sallie's laptop" })), null);
    });
    it("gives null for a project kept for an earlier kind, which is none in use, and for a record with no project or no main one", async (c) => {
      const { e, record } = await madeHere(c);
      rmSync(e.project, { recursive: true });
      assert.equal(asked(e, changed(record, { on: "Sallie's laptop", state: "kept for an earlier kind" })), null);
      assert.equal(asked(e, changed(record, { on: "Sallie's laptop", key: "reel 1" })), null);
      assert.equal(asked(e, { ...record, app: { ...record.app, projects: [] } }), null);
      const { app, ...bare } = record;
      assert.equal(asked(e, bare), null);
    });
    it("takes a name that leads nowhere a folder is for a folder that is not here", async (c) => {
      const { e, record } = await madeHere(c);
      for (const name of ["", ".", "..", "../Pricing talk main 3fa9c1", "a/b"]) assert.equal(asked(e, changed(record, { on: "Sallie's laptop", name })), "Sallie's laptop", JSON.stringify(name));
    });
    it("is asked about a Reel's project by its key (plan PR 5): the Reel's, whatever state it is in, and not the main project's", async (c) => {
      const { e, record } = await madeHere(c);
      const reel = { ...record.app.projects[0], key: "reel 2", name: "Pricing talk reel 2 3fa9c1", fromSuggestion: 2, on: "Sallie's laptop" };
      const both = { ...record, app: { ...record.app, projects: [record.app.projects[0], reel] } };
      // Its folder is not here: another Mac made it, and everything done in it is there.
      assert.equal(projectOnAnotherMac(e.ctx, { found: e.found, record: both }, "reel 2"), "Sallie's laptop");
      // The main project is this Mac's, and the Reel's other Mac does not make it another's.
      assert.equal(asked(e, both), null);
      // This Mac's own Reel, whose folder is gone, is made again; one whose folder is here is opened, whichever Mac made it.
      assert.equal(projectOnAnotherMac(e.ctx, { found: e.found, record: { ...both, app: { ...both.app, projects: [record.app.projects[0], { ...reel, on: "Mac Studio" }] } } }, "reel 2"), null);
      mkdirSync(join(episodeWork(e.home, FOLDER), reel.name));
      assert.equal(projectOnAnotherMac(e.ctx, { found: e.found, record: both }, "reel 2"), null);
      // A Reel with no project in the record, and one the record keeps in another state, are asked the same way.
      assert.equal(projectOnAnotherMac(e.ctx, { found: e.found, record: both }, "reel 3"), null);
      rmSync(join(episodeWork(e.home, FOLDER), reel.name), { recursive: true });
      assert.equal(projectOnAnotherMac(e.ctx, { found: e.found, record: { ...both, app: { ...both.app, projects: [record.app.projects[0], { ...reel, state: "exported" }] } } }, "reel 2"), "Sallie's laptop");
    });
  });
  describe("her chat, found by chatOf (plan PR 4, \"The chat\": no readable transcript, no handover, never guessed)", () => {
    // No test here gives openInApp a chat(): it finds the chat itself, from the environment it is given, her folder for Claude and
    // the transcript where Claude Code keeps it (loosened.js transcriptOf), and decides by held.js chatHeld. The stand-in's log says
    // whether the chat's id reached the command line.
    const PICKS_UP = "It's open in HyperFrames, and it picks up this conversation.";
    const NEW_CHAT = "It's open in HyperFrames. It starts a new conversation.";
    const NOT_FOUND = "This chat could not be found, so it stays here.";
    const SESSION_WORDS = "This chat has held a client or group session's words, so it stays here.";
    const VIDEOS_CHAT = "This video's chat stays here.";
    /** The environment the chat's command runs in. The runner's own is never taken for it (it is often a Claude Code session's). */
    const chatEnv = (more = {}) => ({ LANG: "en_US.UTF-8", CLAUDE_CODE_SESSION_ID: CHAT, ...more });
    /** Her folder for Claude on this Mac, as its real path is looked up (a temporary folder is behind a link), and where Claude Code
        keeps the transcripts of the chats started in it: its projects folder, a folder for her folder, a file for each chat. */
    const studioOf = (e) => join(realpathSync.native(e.home), "BRIMM Video Studio");
    const transcriptsOf = (e, config = join(e.home, ".claude")) => join(config, "projects", claudeDirName(studioOf(e)));
    /** Her folder, and a made-up transcript of the chat `id` in it: a few lines, each with its message's uuid and time. */
    function herChat(e, { folder = true, transcript = true, id = CHAT, config } = {}) {
      if (folder) mkdirSync(studioOf(e), { recursive: true });
      if (!transcript) return;
      mkdirSync(transcriptsOf(e, config), { recursive: true });
      const lines = [
        { type: "user", uuid: "0d3c7f9a-1111-4aaa-8bbb-000000000001", timestamp: "2026-10-28T14:00:00.000Z", message: { role: "user", content: "open the Pricing talk in HyperFrames" } },
        { type: "assistant", uuid: "0d3c7f9a-1111-4aaa-8bbb-000000000002", timestamp: "2026-10-28T14:00:05.000Z", message: { role: "assistant", content: "Opening it." } }
      ];
      writeFileSync(join(transcriptsOf(e, config), `${id}.jsonl`), lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
    }
    /** Mark the chat as edit.js does before it prints a session's words (held.js markChat): its id, and the claude above it. */
    const marked = (e) => markChat({
      home: e.home, env: { CLAUDE_CODE_SESSION_ID: CHAT, CLAUDE_PID: "700" }, pid: 900, now: Date.parse("2026-10-28T14:30:00.000Z"),
      table: processTable(psText([[1, 0, "/sbin/launchd"], [700, 1, "/opt/homebrew/bin/claude"], [800, 700, "/bin/zsh"], [900, 800, "node edit.js app"]]))
    });
    /** `app` with the setting on, and no chat() given: openInApp finds the chat itself, in `env`. */
    const ask = (e, env, record = e.record) => openInApp(e.ctx, { found: e.found, record }, { ...e.deps, chat: undefined, env });
    /** Whether the chat's id reached the pinned command line, by the stand-in's log of the one run it made. */
    const reached = (e) => {
      assert.equal(e.runs().length, 1, "the command line was run once");
      return e.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID");
    };
    /** The handover did not happen: the id did not reach the command line, the record says so, and the words say why. */
    function stays(e, why) {
      assert.equal(reached(e), false);
      assert.deepEqual(e.said, [NEW_CHAT, why, BUTTONS]);
      assert.equal(e.saved[0].app.projects[0].handover, false);
      plain(e.said);
    }
    it("hands the chat over when its transcript is found and readable and nothing has marked it", async (c) => {
      const e = episode(c, { handover: true });
      herChat(e);
      assert.equal(await ask(e, chatEnv()), 0);
      assert.equal(reached(e), true);
      assert.deepEqual(e.said, [PICKS_UP, BUTTONS]);
      assert.equal(e.saved[0].app.projects[0].handover, true);
    });
    it("does not hand over a chat that was marked with a session's words (markChat), and says that is why", async (c) => {
      const e = episode(c, { handover: true });
      herChat(e);
      assert.deepEqual(marked(e), { tied: true });
      assert.equal(await ask(e, chatEnv()), 0);
      stays(e, SESSION_WORDS);
    });
    it("does not hand over a chat whose transcript is not at the path, her folder being there", async (c) => {
      const e = episode(c, { handover: true });
      herChat(e, { transcript: false });
      assert.equal(await ask(e, chatEnv()), 0);
      stays(e, NOT_FOUND);
    });
    it("does not hand over a chat when she has no folder for Claude on this Mac, though a transcript is where it would be", async (c) => {
      const e = episode(c, { handover: true });
      herChat(e, { folder: false });
      assert.ok(existsSync(join(transcriptsOf(e), `${CHAT}.jsonl`)) && !existsSync(studioOf(e)));
      assert.equal(await ask(e, chatEnv()), 0);
      stays(e, NOT_FOUND);
    });
    it("does not hand over a chat whose id is not a chat's, whatever is in the files: such an id is never made into a path", async (c) => {
      for (const id of ["not-a-chat", "5B1F0C8E-2D47-4A93-B6E1-7C9A3F2D8E04", "../5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04", `${CHAT}/../x`, `${CHAT}\n`, ""]) {
        const e = episode(c, { handover: true });
        herChat(e);
        // A file of that very name, where the id can be one (the uppercase id, or "not-a-chat").
        if (/^[\w-]+$/.test(id)) herChat(e, { id });
        assert.equal(await ask(e, chatEnv({ CLAUDE_CODE_SESSION_ID: id })), 0, JSON.stringify(id));
        stays(e, NOT_FOUND);
      }
    });
    it("does not hand over when the environment holds no chat's id", async (c) => {
      const e = episode(c, { handover: true });
      herChat(e);
      const { CLAUDE_CODE_SESSION_ID, ...without } = chatEnv();
      assert.equal(await ask(e, without), 0);
      stays(e, NOT_FOUND);
    });
    it("does not hand over a chat whose transcript is not a file that can be read: a folder, or a link, at its path", async (c) => {
      for (const [what, put] of [
        ["a folder", (path) => mkdirSync(path)],
        ["a link", (path) => symlinkSync(join(path, "..", "elsewhere.jsonl"), path)]
      ]) {
        const e = episode(c, { handover: true });
        herChat(e, { transcript: false });
        mkdirSync(transcriptsOf(e), { recursive: true });
        writeFileSync(join(transcriptsOf(e), "elsewhere.jsonl"), '{"type":"user","timestamp":"2026-10-28T14:00:00.000Z"}\n');
        put(join(transcriptsOf(e), `${CHAT}.jsonl`));
        assert.equal(await ask(e, chatEnv()), 0, what);
        stays(e, NOT_FOUND);
      }
    });
    it("looks for the transcript where Claude Code keeps its chats when that is not ~/.claude (CLAUDE_CONFIG_DIR), and nowhere else", async (c) => {
      const e = episode(c, { handover: true });
      const config = join(e.home, "Claude config");
      herChat(e, { config });
      assert.equal(await ask(e, chatEnv({ CLAUDE_CONFIG_DIR: config })), 0);
      assert.equal(reached(e), true, "found in the folder the environment names");
      const f = episode(c, { handover: true });
      herChat(f);
      assert.equal(await ask(f, chatEnv({ CLAUDE_CONFIG_DIR: join(f.home, "Claude config") })), 0);
      stays(f, NOT_FOUND);
    });
    describe("the video it opens, with the setting on and a chat that is found, readable and unmarked", () => {
      /** The mark a session carries, not cleared; and as `kind … --clear-session` leaves it, cleared by her click on a dialog. */
      const MARK = { marked: "2026-10-20T15:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
      const CLEARED = { ...MARK, cleared: { at: "2026-10-21T09:00:00-05:00", on: "Mac Studio", to: "raw", confirmed: "dialog" } };
      const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
      it("does not hand over for a session: a video answered as one, or one that carries a session's mark, whatever its kind says", async (c) => {
        for (const [what, over] of [
          ["a session", { kind: "session", session: MARK }],
          ["a session with no mark", { kind: "session" }],
          ["a video answered as another kind whose session mark is not cleared", { kind: "finished", session: MARK }],
          ["a mark that cannot be read", { kind: "raw", session: "yes" }],
          ["a mark whose clearing was not by her click", { kind: "raw", session: { ...MARK, cleared: { ...CLEARED.cleared, confirmed: "no" } } }]
        ]) {
          const e = episode(c, { handover: true });
          herChat(e);
          assert.equal(await ask(e, chatEnv(), { ...e.record, ...over }), 0, what);
          stays(e, VIDEOS_CHAT);
        }
      });
      it("does not hand over for a video not yet answered, or one left alone", async (c) => {
        for (const [what, over] of [
          ["not yet answered", { kind: null, answer: ANSWER }],
          ["left alone", { kind: null, answer: { ...ANSWER, state: "not for brimm-video" } }]
        ]) {
          const e = episode(c, { handover: true });
          herChat(e);
          assert.equal(await ask(e, chatEnv(), { ...e.record, ...over }), 0, what);
          stays(e, VIDEOS_CHAT);
        }
      });
      it("hands over for a session whose mark was cleared, which is an ordinary video of its new kind (architecture 6.2)", async (c) => {
        for (const [what, over] of [
          ["a session cleared by saying it is a raw video, as --clear-session writes it", { kind: "raw", session: CLEARED }],
          ["a session cleared by saying it is an iPhone clip", { kind: "short video", session: CLEARED }],
          ["a record of kind session whose mark is cleared, which the gate lets through as a cleared one", { kind: "session", session: CLEARED }]
        ]) {
          const e = episode(c, { handover: true });
          herChat(e);
          assert.equal(await ask(e, chatEnv(), { ...e.record, ...over }), 0, what);
          assert.equal(reached(e), true, what);
          assert.deepEqual(e.said, [PICKS_UP, BUTTONS], what);
          assert.equal(e.saved[0].app.projects[0].handover, true, what);
        }
      });
      it("still does not hand over a cleared session's chat when it was marked with the session's words", async (c) => {
        const e = episode(c, { handover: true });
        herChat(e);
        marked(e);
        assert.equal(await ask(e, chatEnv(), { ...e.record, kind: "raw", session: CLEARED }), 0);
        stays(e, SESSION_WORDS);
      });
    });
  });
  it("says this Mac is not set up for HyperFrames in words that hold no path", () => {
    assert.equal(NOT_SET_UP, "This Mac isn't set up for HyperFrames yet: ask Jason.");
  });
});
