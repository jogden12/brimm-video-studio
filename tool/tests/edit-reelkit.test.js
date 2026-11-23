// Her chat's `reelkit` words for an edit (plan Task 11): start, status "<episode>", note, go, revise and resume, and the gate for them.
// edit.js is only the wiring (the commands' bodies are reel-kit-commands.js). Every test builds the made-up episode of phase4.js in a temp
// home (tests/episodes.js setup), with Reel Kit's kit and Python laid where they would be: nothing real is run. The first half's detached
// starts are written down, each with a pid of its own; a detached half is run here, in this process, and where it runs the worker it is
// the worker's own runJob, with a scaffold that stands in for Reel Kit's new.py and the stand-in tests/stand-ins/claude-worker.mjs for
// `claude`, as tests/reel-kit-worker.test.js runs them.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELP, editMain } from "../edit.js";
import { byReelKit, isMain, projectOnAnotherMac } from "../app.js";
import { madeInApp } from "../app-reel.js";
import { HELD, NOT_FOR_SESSION, gateFor, heldGateFor, namesNoEpisode } from "../gate.js";
import { kitDir, venvPython } from "../reel-kit.js";
import { EDIT_SAY, NOTE_MOST, notesFile } from "../reel-kit-commands.js";
import { entryOf, readState, writeState } from "../reel-kit-project.js";
import { queuedOf } from "../reel-kit-worker.js";
import { episodeWork } from "../settings.js";
import { FOLDER, ID, reread } from "./episodes.js";
import { episode } from "./phase4.js";
import { ANSWERED, CLEARED, LEFT, RAW, SESSION, UNANSWERED } from "./workcopy-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/claude-worker.mjs", import.meta.url));
const ASK = "Hi-fi, lo-fi or showcase?";
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT_SAID = "You said to leave this video: it is not for BRIMM Video Studio. To have it read, say what it is.";
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|reelkit|\.json\b/;
/** What the record keeps of the recording and of the copy of 4K, as scaffold gives them (app.js fromOf and copyOf). */
const FROM = { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" };
const COPY = { bytes: 11, seconds: 7.907, fps: 30 };
const nameOf = (n) => `Pricing- what to charge- reel ${n} 3fa9c1 Reel Kit v1`;
const slugOf = (n) => `3fa9c1-reel-${n}-v1`;

const done = [];
after(() => {
  for (const t of done) t.done();
});

/** The record's entry for a Reel Kit edit of Reel `n`, as the queued job writes it. */
const entry = (n, mode = "lofi") => entryOf({ key: `reel ${n}`, name: nameOf(n), mode, version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: n, from: FROM, workingCopy: COPY });

/** The made-up episode, answered as a raw wide recording unless `record` says otherwise, with a Reel Kit edit of each Reel of `edits`
    (n, mode, and what its studio.json says), and Reel Kit's kit and Python on this Mac. Each detached start is written down with a pid
    of its own, which runs (`alive`) until a test says it ended; this process's own pid runs too, as a detached half run here is it. */
function world({ record = {}, edits = [] } = {}) {
  const projects = edits.map(({ n, mode }) => entry(n, mode));
  const { t, found } = episode({ ...RAW, answer: { ...ANSWERED, seen: "wide, 0:23, no retakes" }, ...(projects.length ? { version: 4, app: { toolchain: "0.8.208", projects } } : {}), ...record });
  done.push(t);
  mkdirSync(join(kitDir(t.home), "pipeline"), { recursive: true });
  writeFileSync(join(kitDir(t.home), "pipeline", "new.py"), "# made up\n");
  mkdirSync(join(venvPython(t.home), ".."), { recursive: true });
  writeFileSync(venvPython(t.home), "#!/bin/sh\n");
  const live = new Set();
  let next = 50000;
  t.ctx.deps.start = (cmd, args) => {
    t.started.push([cmd, args]);
    live.add(next);
    return next++;
  };
  t.ctx.deps.alive = (pid) => live.has(pid) || pid === process.pid;
  const dirOf = (n) => join(episodeWork(t.home, FOLDER), nameOf(n));
  for (const { n, mode = "lofi", state = {} } of edits) {
    mkdirSync(join(dirOf(n), "storyboard"), { recursive: true });
    writeState(dirOf(n), { slug: slugOf(n), key: `reel ${n}`, mode, version: 1, title: "Know your costs", name: nameOf(n), ...state });
  }
  return { t, found, live, dirOf };
}

/** Run `reelkit <words…>` on the made-up Mac: { code, said }. `reelKit` is what a test gives in place of this Mac's own. */
async function reelkit(w, words, { reelKit = {}, env = {} } = {}) {
  const said = [];
  const code = await editMain(["reelkit", ...words], { ...w.t.ctx.deps, env, reelKit, say: (line) => said.push(line) });
  return { code, said };
}
/** Run any command of edit.js on the made-up Mac. */
async function on(w, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...w.t.ctx.deps, say: (line) => said.push(line) });
  return { code, said };
}

/** The words of each detached half started, after `reelkit`: ["--now", folder, job, …]. */
const startedWords = (w) => w.t.started.map(([, args]) => args.slice(2));

/** A program for runJob to start as `claude`: a small script that runs the stand-in with its scenario baked in. */
function claudeOf(w, scenario = "") {
  const program = join(w.t.dir, `claude-${Math.random().toString(36).slice(2)}`);
  writeFileSync(program, `#!/bin/sh\nCLAUDE_WORKER_STANDIN='${scenario}' exec '${process.execPath}' '${STAND_IN}' "$@"\n`);
  chmodSync(program, 0o755);
  return program;
}
/** lsof finds no one holding a project open; ps is the real one. */
const run = (program, args, options) => (program === "/usr/sbin/lsof" ? { status: 1, stdout: "", stderr: "" } : spawnSync(program, args, options));
/** Wait until `test()` holds, or fail after a few seconds. */
async function until(test, what) {
  for (let i = 0; i < 800; i++) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail(`waited too long for ${what}`);
}

describe("starting an edit", () => {
  it("asks the mode in one line and starts nothing when none is given", async () => {
    const w = world();
    for (const words of [[FOLDER, "reel", "2"], [FOLDER, "reel", "1", "reel", "2"], [FOLDER, "reel", "2", "--mode", "medium"]]) {
      const r = await reelkit(w, ["start", ...words]);
      assert.deepEqual([r.code, r.said], [1, [ASK]], words.join(" "));
    }
    assert.deepEqual(w.t.started, []);
    assert.deepEqual(queuedOf(w.t.home, ID, w.t.ctx.deps.alive), []);
    // Words that are not a part are its help, and start nothing either.
    for (const words of [[FOLDER], [FOLDER, "reel"], [FOLDER, "reel", "two", "--mode", "lofi"], [FOLDER, "reel", "2", "--mode"], ["--mode", "lofi"]]) {
      const r = await reelkit(w, ["start", ...words]);
      assert.deepEqual([r.code, r.said], [2, [HELP]], words.join(" "));
    }
    assert.deepEqual(w.t.started, []);
  });

  it("starts several Reels as queued jobs, one running", async () => {
    const w = world();
    const r = await reelkit(w, ["start", FOLDER, "reel", "1", "reel", "2", "--mode", "lo-fi"]);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(r.said, [
      "Reel 1 is in the queue for a lo-fi Reel Kit edit.",
      "Reel 2 is in the queue for a lo-fi Reel Kit edit.",
      "This kind of video leans to hi-fi; this is lo-fi, as you said.",
      "This Mac makes one Reel Kit edit at a time. Each goes through intake, cut, beats, build, sound and storyboard, then waits for you at its storyboard.",
      `Say "how are the Reel Kit edits going?" to follow them.`
    ]);
    for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
    // One detached job per part, each in the queue record before her chat was answered, by the pid of the run it started.
    const words = startedWords(w);
    assert.deepEqual(words.map((s) => s.slice(0, 5)), [["--now", FOLDER, "start", "reel 1", "lofi"], ["--now", FOLDER, "start", "reel 2", "lofi"]]);
    const queued = queuedOf(w.t.home, ID, w.t.ctx.deps.alive);
    assert.deepEqual(queued.map((j) => [j.key, j.mode, j.job, j.pid, j.id]), [["reel 1", "lofi", "edit", 50000, words[0][5]], ["reel 2", "lofi", "edit", 50001, words[1][5]]]);
    // So a second ask for a part waiting is refused at once, and nothing more starts.
    const again = await reelkit(w, ["start", FOLDER, "reel", "2", "--mode", "hifi"]);
    assert.deepEqual([again.code, again.said], [1, ["Reel 2 has a Reel Kit edit waiting or being made already."]]);
    assert.equal(w.t.started.length, 2);
    const status = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(status.said, ["Reel 1 (lo-fi): waiting for its turn.", "Reel 2 (lo-fi): waiting for its turn."]);

    // The detached halves, run here: one worker at a time on this Mac, each project made inside the queued job, and its entry written.
    const made = [];
    const scaffold = async (ctx, make) => {
      const n = Number(make.key.slice(5));
      made.push(make.key);
      assert.deepEqual([make.mode, make.title, make.found.name, make.record.id], ["lofi", n === 1 ? "The opening" : "Know your costs", FOLDER, ID]);
      mkdirSync(join(w.dirOf(n), "work"), { recursive: true });
      writeState(w.dirOf(n), { slug: slugOf(n), key: make.key, mode: make.mode, version: 1, title: make.title, name: nameOf(n) });
      return { dir: w.dirOf(n), slug: slugOf(n), name: nameOf(n), version: 1, from: FROM, workingCopy: COPY };
    };
    const reelKit = { scaffold, claude: claudeOf(w, "wait"), run, every: 20, wait: (ms) => new Promise((done) => setTimeout(done, Math.min(ms, 20))) };
    const first = reelkit(w, words[0], { reelKit });
    await until(() => readState(w.dirOf(1))?.state === "working", "Reel 1 at work");
    mkdirSync(join(w.dirOf(2), "work"), { recursive: true });
    writeFileSync(join(w.dirOf(2), "work", "go-on"), "");
    const second = reelkit(w, words[1], { reelKit });
    await until(() => queuedOf(w.t.home, ID, w.t.ctx.deps.alive).some((j) => j.key === "reel 2" && j.pid === process.pid), "Reel 2's run taking its entry");
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(made, ["reel 1"], "Reel 2's project is not made while Reel 1 holds the Mac");
    assert.equal(readState(w.dirOf(2)), null);
    assert.deepEqual(queuedOf(w.t.home, ID, w.t.ctx.deps.alive).map((j) => j.key), ["reel 2"], "one entry per job");
    const meanwhile = await reelkit(w, ["status", FOLDER]);
    assert.equal(meanwhile.said.length, 2, meanwhile.said.join("\n"));
    assert.equal(meanwhile.said[0], "Reel 2 (lo-fi): waiting for its turn.");
    assert.match(meanwhile.said[1], /^Reel 1 \(lo-fi, version 1\): being made, at (intake|cut|beats|build|sound|storyboard)\.$/);

    writeFileSync(join(w.dirOf(1), "work", "go-on"), "");
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual([a.code, b.code], [0, 0], [...a.said, ...b.said].join("\n"));
    assert.deepEqual(made, ["reel 1", "reel 2"]);
    // Each entry in the record, a Reel Kit edit's, with what the record checks a project by.
    const projects = reread(w.found).app.projects;
    assert.deepEqual(projects.map((p) => [p.key, p.maker, p.mode, p.version, p.name, p.state, p.fromSuggestion]), [
      ["reel 1", "reel-kit", "lofi", 1, nameOf(1), "made", 1], ["reel 2", "reel-kit", "lofi", 1, nameOf(2), "made", 2]
    ]);
    for (const p of projects) assert.deepEqual([p.from, p.workingCopy, p.on], [FROM, COPY, "Mac Studio"]);
    assert.deepEqual(queuedOf(w.t.home, ID, w.t.ctx.deps.alive), []);
    const after = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(after.said, ["Reel 1 (lo-fi, version 1): its storyboard is made.", "Reel 2 (lo-fi, version 1): its storyboard is made."]);
  });

  it("passes startWhy whether the video is held as a session and the main video's title", async () => {
    // The main video of an upright recording, titled with a double quote: Reel Kit's new.py can't take it, so nothing is queued.
    const w = world({ record: { answer: { ...ANSWERED, seen: "upright, 0:40" }, name: { text: 'Pricing: "what" to charge', placeholder: false } } });
    const r = await reelkit(w, ["start", FOLDER, "main", "--mode", "showcase"]);
    assert.deepEqual([r.code, r.said], [1, ["The Reel's title can't hold a double quote, a backslash or a new line for Reel Kit: say it again without them."]]);
    assert.deepEqual(w.t.started, []);
    // Held as a session (one of its other versions is a session not cleared): the gate refuses it, in HELD's words, before startWhy.
    assert.equal(heldGateFor("reelkit", ["start", FOLDER, "main", "--mode", "showcase"]), HELD);
    for (const words of [["install", "/a/download"], ["status"], ["style"]]) assert.equal(heldGateFor("reelkit", words), "", words.join(" "));
  });

  it("says why a start that made no project did not start, until the next start of that part", async () => {
    const w = world();
    const r = await reelkit(w, ["start", FOLDER, "reel", "2", "--mode", "hifi"]);
    assert.equal(r.code, 0);
    const [words] = startedWords(w);
    const ran = await reelkit(w, words, { reelKit: { scaffold: async () => ({ why: "Reel Kit could not start this edit: ask Jason." }), claude: claudeOf(w), run } });
    assert.equal(ran.code, 1);
    w.live.clear();
    const status = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(status.said, ["Reel 2: its Reel Kit edit didn't start. Reel Kit could not start this edit: ask Jason."]);
    await reelkit(w, ["start", FOLDER, "reel", "2", "--mode", "hifi"]);
    w.live.clear();
    assert.deepEqual((await reelkit(w, ["status", FOLDER])).said, [EDIT_SAY.none]);
  });

  it("refuses a start on a Mac without Reel Kit, in one line", async () => {
    const w = world();
    rmSync(venvPython(w.t.home));
    const r = await reelkit(w, ["start", FOLDER, "reel", "2", "--mode", "hifi"]);
    assert.deepEqual([r.code, r.said, w.t.started], [1, ["Reel Kit isn't set up on this Mac yet: ask Jason."], []]);
  });
});

describe("following an edit", () => {
  it("prints NEEDS in Reel Kit's words and opens the folder for them", async () => {
    const needs = [{ beat: "p06", text: "NEEDS: a screen recording of the pricing page, 5 seconds, no cursor." }, { beat: "p09", text: "NEEDS: five seconds of the empty room." }];
    const w = world({ edits: [{ n: 2, mode: "hifi", state: { state: "working", job: "edit", step: "beats", pid: process.pid, needs, minutesLeft: 7 } }, { n: 1, mode: "lofi", state: { state: "storyboard", step: "storyboard" } }] });
    const r = await reelkit(w, ["status", FOLDER]);
    assert.equal(r.code, 0);
    assert.deepEqual(r.said, [
      "Reel 2 (hi-fi, version 1): being made, at beats: about 7 minutes left, by Reel Kit's own guess.",
      `  p06: ${needs[0].text}`,
      `  p09: ${needs[1].text}`,
      "Drop it in the folder that just opened.",
      "Reel 1 (lo-fi, version 1): its storyboard is made."
    ]);
    for (const line of r.said.filter((l) => !l.startsWith("  "))) assert.doesNotMatch(line, PLAIN, line);
    // The edit's own from-you/ folder, made and opened in Finder: never the drop folder.
    assert.deepEqual(w.t.opened, [["Finder", join(w.dirOf(2), "from-you")]]);
    assert.ok(lstatSync(join(w.dirOf(2), "from-you")).isDirectory());
    // A from-you that is a link is not opened: nothing is put through it.
    symlinkSync(w.t.dir, join(w.dirOf(1), "from-you"));
    writeState(w.dirOf(1), { ...readState(w.dirOf(1)), needs: [needs[0]] });
    const again = await reelkit(w, ["status", FOLDER]);
    assert.equal(again.said.at(-1), "The folder for it couldn't be opened: ask Jason.");
    assert.equal(w.t.opened.length, 2);
  });

  it("says each state in her words, a stopped one with the phrase that carries it on", async () => {
    const w = world({ edits: [{ n: 1, state: { state: "working", step: "cut", pid: 4242 } }, { n: 2, state: { state: "ready" } }] });
    const r = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(r.said, [
      `Reel 1 (lo-fi, version 1): This edit stopped at cut before it was done. Say "carry on" and it picks up from there.`,
      "Reel 2 (lo-fi, version 1): it is built and ready to render."
    ]);
    const none = world();
    assert.deepEqual((await reelkit(none, ["status", FOLDER])).said, ["This video has no Reel Kit edits yet."]);
  });
});

describe("her notes", () => {
  it("writes a note as Reel Kit's {beat, text, at}", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard", step: "storyboard" } }] });
    const said = 'Make the title bigger, and "punchier".\nThen cut the pause.';
    const r = await reelkit(w, ["note", FOLDER, slugOf(2), "p06", said]);
    assert.deepEqual([r.code, r.said], [0, ["Noted, on beat p06.", `When your notes are all in, say "make the changes", or "go" when it's right.`]]);
    const at = new Date(w.t.now()).toISOString();
    assert.deepEqual(JSON.parse(readFileSync(notesFile(w.dirOf(2)), "utf8")), [{ beat: "p06", text: said, at }]);
    await reelkit(w, ["note", FOLDER, slugOf(2), "all", "Shorter overall."]);
    assert.deepEqual(JSON.parse(readFileSync(notesFile(w.dirOf(2)), "utf8")), [{ beat: "p06", text: said, at }, { beat: "all", text: "Shorter overall.", at }]);
    // Refused, with the notes as they were: a beat that is not one, an empty note, one over 4,000 characters, an edit that isn't there.
    const before = readFileSync(notesFile(w.dirOf(2)), "utf8");
    for (const [words, line] of [
      [[slugOf(2), "6", "x"], EDIT_SAY.beat], [[slugOf(2), "p6x", "x"], EDIT_SAY.beat], [[slugOf(2), "p06", "  "], EDIT_SAY.empty],
      [[slugOf(2), "p06", "x".repeat(NOTE_MOST + 1)], EDIT_SAY.tooLong], [[slugOf(1), "p06", "x"], EDIT_SAY.noSuchEdit], [["3fa9c1-main-v1", "p06", "x"], EDIT_SAY.noSuchEdit]
    ]) {
      const refused = await reelkit(w, ["note", FOLDER, ...words]);
      assert.deepEqual([refused.code, refused.said], [1, [line]], words.join(" "));
    }
    assert.equal((await reelkit(w, ["note", FOLDER, slugOf(2), "p06", "x".repeat(NOTE_MOST)])).code, 0, "4,000 characters is a note");
    assert.equal(JSON.parse(readFileSync(notesFile(w.dirOf(2)), "utf8")).length, 3);
    assert.notEqual(before, "");
    // Notes that can't be read whole are never written over.
    writeFileSync(notesFile(w.dirOf(2)), "not JSON");
    const unread = await reelkit(w, ["note", FOLDER, slugOf(2), "p06", "x"]);
    assert.deepEqual([unread.code, unread.said], [1, [EDIT_SAY.notesUnread]]);
    assert.equal(readFileSync(notesFile(w.dirOf(2)), "utf8"), "not JSON");
    assert.equal((await reelkit(w, ["note", FOLDER, slugOf(2), "p06"])).code, 2);
    assert.deepEqual(w.t.started, [], "a note starts nothing");
  });
});

describe("the gate", () => {
  const WORDS = [
    ["start", FOLDER, "reel", "2", "--mode", "lofi"], ["status", FOLDER], ["note", FOLDER, slugOf(2), "p01", "x"], ["go", FOLDER, slugOf(2)],
    ["revise", FOLDER, slugOf(2)], ["resume", FOLDER, slugOf(2)], ["--now", FOLDER, "start", "reel 2", "lofi", "q1"], ["--now", FOLDER, "finalize", slugOf(2)]
  ];
  it("refuses every reelkit word for a session and an unanswered video", async () => {
    const cleared = { ...SESSION, session: { ...SESSION.session, cleared: CLEARED } };
    for (const [record, line] of [[UNANSWERED, WAITING], [LEFT, LEFT_SAID], [SESSION, NOT_FOR_SESSION], [cleared, NOT_FOR_SESSION]]) {
      const w = world({ record });
      const before = reread(w.found).rev;
      for (const words of WORDS) {
        const r = await reelkit(w, words);
        assert.deepEqual([r.code, r.said], [1, [line]], `${record.label ?? record.kind}: ${words.join(" ")}`);
      }
      assert.deepEqual([w.t.started, w.t.opened, reread(w.found).rev], [[], [], before]);
      // Her Reel Kit setup and her style name no episode: the gate is never asked of them.
      for (const words of [["install", "/a/download"], ["--now", "install", "/a/download"], ["status"], ["style"]]) assert.equal(gateFor("reelkit", record, {}, words), "", words.join(" "));
    }
  });

  it("names no episode only for install, status alone and style", () => {
    for (const words of [["install", "/a"], ["--now", "install", "/a"], ["status"], ["style"], ["style", "show"]]) assert.equal(namesNoEpisode("reelkit", words), true, words.join(" "));
    for (const words of [[], ["status", FOLDER], ["--now", "status"], ["--now", FOLDER, "start"], ["start", FOLDER], ["note"], ["go"], ["revise"], ["resume"]]) assert.equal(namesNoEpisode("reelkit", words), false, words.join(" "));
    assert.equal(namesNoEpisode("episodes", ["anything"]), true);
    assert.equal(namesNoEpisode("app", []), false);
    // An answered video goes on to the command, which says what it makes of it.
    assert.equal(gateFor("reelkit", RAW, {}, ["start", FOLDER]), "");
  });

  it("refuses the detached half under Claude Code, where her chat could type it", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard", approved: { at: "2026-11-23T10:00:00.000Z" } } }] });
    for (const words of [["--now", FOLDER, "finalize", slugOf(2)], ["--now", FOLDER, "start", "reel 2", "lofi", "q1"]]) {
      const r = await reelkit(w, words, { env: { CLAUDECODE: "1" } });
      assert.deepEqual([r.code, r.said], [2, [HELP]], words.join(" "));
    }
    assert.equal(readState(w.dirOf(2)).state, "storyboard");
  });
});

describe("her go", () => {
  it("starts nothing without her go", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard", step: "storyboard" } }, { n: 1, state: { state: "stopped", job: "edit", step: "cut" } }] });
    await reelkit(w, ["note", FOLDER, slugOf(2), "p02", "Shorter."]);
    assert.equal((await reelkit(w, ["revise", FOLDER, slugOf(2)])).code, 0);
    assert.equal((await reelkit(w, ["resume", FOLDER, slugOf(1)])).code, 0);
    // Those runs end, and the storyboard waits for her again.
    w.live.clear();
    writeState(w.dirOf(2), { slug: slugOf(2), key: "reel 2", mode: "lofi", version: 1, title: "Know your costs", name: nameOf(2), state: "storyboard", step: "storyboard" });
    assert.equal((await reelkit(w, ["start", FOLDER, "main", "--mode", "lofi"])).code, 1, "a wide recording's main video is no edit");
    const jobs = () => startedWords(w).map((s) => s[2]);
    assert.deepEqual(jobs(), ["revise", "resume"]);
    // The detached half of finalize, without her go: refused, and the worker never runs.
    const claude = claudeOf(w);
    const r = await reelkit(w, ["--now", FOLDER, "finalize", slugOf(2)], { reelKit: { claude, run } });
    assert.equal(r.code, 1);
    assert.deepEqual([readState(w.dirOf(2)).state, readState(w.dirOf(2)).job], ["storyboard", undefined]);
    // Her go: the note, her approval, and finalize started, marked queued at once by the run it started.
    const go = await reelkit(w, ["go", FOLDER, slugOf(2)]);
    assert.deepEqual([go.code, go.said], [0, [`Approved: Reel 2 (lo-fi, version 1) is being built to render. Say "how are the Reel Kit edits going?" to follow them.`]]);
    assert.deepEqual(jobs(), ["revise", "resume", "finalize"]);
    const at = new Date(w.t.now()).toISOString();
    assert.deepEqual(JSON.parse(readFileSync(notesFile(w.dirOf(2)), "utf8")).at(-1), { beat: "all", text: "go", at });
    const state = readState(w.dirOf(2));
    assert.deepEqual([state.state, state.job, state.step, state.pid, state.approved], ["queued", "finalize", "cards", 50002, { at }]);
    assert.deepEqual((await reelkit(w, ["go", FOLDER, slugOf(2)])).said, [EDIT_SAY.busy], "a second go waits");
    // Its detached half runs finalize, and the edit is ready. (Here it runs in this process, not as the run her chat started.)
    w.live.clear();
    const ran = await reelkit(w, startedWords(w).at(-1), { reelKit: { claude, run } });
    assert.equal(ran.code, 0, ran.said.join("\n"));
    assert.equal(readState(w.dirOf(2)).state, "ready");
  });

  it("revises from her notes since the last version, and takes her go back", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard", step: "storyboard" } }] });
    assert.deepEqual((await reelkit(w, ["revise", FOLDER, slugOf(2)])).said, [EDIT_SAY.noNotes]);
    await reelkit(w, ["note", FOLDER, slugOf(2), "p02", "Shorter."]);
    await reelkit(w, ["note", FOLDER, slugOf(2), "all", "Warmer colours."]);
    const r = await reelkit(w, ["revise", FOLDER, slugOf(2)]);
    assert.deepEqual(r.said, [`Reel 2 (lo-fi, version 1) is in the queue for its changes, from 2 notes. Say "how are the Reel Kit edits going?" to follow them.`]);
    const [words] = startedWords(w);
    assert.deepEqual(words, ["--now", FOLDER, "revise", slugOf(2)]);
    writeState(w.dirOf(2), { ...readState(w.dirOf(2)), approved: { at: "earlier" } });
    w.live.clear();
    const ran = await reelkit(w, words, { reelKit: { claude: claudeOf(w), run } });
    assert.equal(ran.code, 0, ran.said.join("\n"));
    const state = readState(w.dirOf(2));
    assert.deepEqual([state.state, state.notesUsed, state.approved], ["storyboard", 2, undefined]);
    w.live.clear();
    assert.deepEqual((await reelkit(w, ["revise", FOLDER, slugOf(2)])).said, [EDIT_SAY.noNotes], "those notes are used");
  });

  it("carries on only a stopped edit", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard" } }] });
    assert.deepEqual((await reelkit(w, ["resume", FOLDER, slugOf(2)])).said, [EDIT_SAY.notStopped]);
    assert.deepEqual(w.t.started, []);
  });
});

describe("HyperFrames leaves a Reel Kit edit alone", () => {
  it("is never the main video's project, nor a Reel's, nor another Mac's", () => {
    const main = entryOf({ key: "main", name: "Pricing- what to charge- main 3fa9c1 Reel Kit v1", mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "MacBook", from: FROM, workingCopy: COPY });
    assert.equal(byReelKit(main), true);
    assert.equal(isMain(main), false);
    assert.equal(isMain({ ...main, maker: undefined }), true);
    const record = { app: { toolchain: "0.8.208", projects: [main, { ...entry(2), on: "MacBook" }] } };
    assert.equal(madeInApp(record, 2), false);
    assert.equal(projectOnAnotherMac({ home: "/nowhere", machine: "Mac Studio" }, { found: { name: FOLDER }, record }), null);
    assert.equal(projectOnAnotherMac({ home: "/nowhere", machine: "Mac Studio" }, { found: { name: FOLDER }, record }, "reel 2"), null);
  });

  it("keeps a Reel Kit edit of the main video for the earlier kind, as kind --again keeps the main project, and leaves a Reel's", async () => {
    const main = entryOf({ key: "main", name: "Pricing- what to charge- main 3fa9c1 Reel Kit v1", mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", from: FROM, workingCopy: COPY });
    const w = world({ record: { answer: { ...ANSWERED, seen: "upright, 0:40" }, version: 4, app: { toolchain: "0.8.208", projects: [main, entry(2)] } } });
    const r = await on(w, "kind", FOLDER, "finished", "--private", "no", "--again");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(reread(w.found).app.projects.map((p) => [p.key, p.state]), [["main", "kept for an earlier kind"], ["reel 2", "made"]]);
  });

  it("refuses to open a Reel Kit edit as a HyperFrames project, in one line", async () => {
    const w = world({ edits: [{ n: 2, state: { state: "storyboard" } }] });
    const r = await on(w, "app", FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, ["Reel 2 of Pricing: what to charge? is a Reel Kit edit: it opens through Reel Kit, not as a HyperFrames project."]]);
    const upright = world({ record: { answer: { ...ANSWERED, seen: "upright, 0:40" }, version: 4, app: { toolchain: "0.8.208", projects: [entryOf({ key: "main", name: "Pricing- what to charge- main 3fa9c1 Reel Kit v1", mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", from: FROM, workingCopy: COPY })] } } });
    const m = await on(upright, "app", FOLDER);
    assert.deepEqual([m.code, m.said], [1, ["Pricing: what to charge? is a Reel Kit edit: it opens through Reel Kit, not as a HyperFrames project."]]);
    assert.deepEqual([w.t.started, upright.t.started, reread(w.found).app.projects.length], [[], [], 1]);
  });
});
