// `reelkit app "<episode>" <slug>`: a Reel Kit edit opened in the HyperFrames app (plan Task 17, with Task 18's version line), and the
// fingerprint's refusal after it (spec 2026-11-23 Reel Kit in Studio, section 7). Every test builds the made-up episode of phase4.js in a
// temp home (tests/episodes.js setup) with a Reel Kit edit of Reel 2 that finalize left ready (its edit.py, fx/, cards/ and public/, and
// their fingerprint in studio.json), and Reel Kit's kit and Python laid where they would be. Nothing real is run: the pinned command line
// is tests/stand-ins/hyperframes.mjs, which, told so, writes into the project what the app writes there once it has it open (Review Focus
// 3); plutil is a stand-in; a detached half is run here, with the worker's own runJob, the real scaffold given stand-ins for what it runs,
// and tests/stand-ins/claude-worker.mjs for `claude`.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELP, editMain } from "../edit.js";
import { NOT_SET_UP } from "../app.js";
import { appVersionFile } from "../app-version.js";
import { NOT_FOR_SESSION } from "../gate.js";
import { projectFiles } from "../project.js";
import { kitDir, venvPython } from "../reel-kit.js";
import { markReady } from "./reel-kit-ready.js";
import { EDIT_SAY, notesFile } from "../reel-kit-commands.js";
import { REEL_KIT_LINE, compositionFingerprint, entryOf, readState, writeState } from "../reel-kit-project.js";
import { RENDER_SAY, renderWhy } from "../reel-kit-render.js";
import { asideDir, runJob, sweepProject, wasOpened } from "../reel-kit-worker.js";
import { episodeWork, writeSettings } from "../settings.js";
import { FOLDER, reread } from "./episodes.js";
import { episode } from "./phase4.js";
import { ANSWERED, CLEARED, LEFT, RAW, SESSION, UNANSWERED } from "./workcopy-world.js";

const HF = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const WORKER = fileURLToPath(new URL("./stand-ins/claude-worker.mjs", import.meta.url));
const SYSTEM = "/Applications/HyperFrames.app/Contents/Info.plist";
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|reelkit|\.json\b/;
const FROM = { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" };
const COPY = { bytes: 11, seconds: 7.907, fps: 30 };
const nameOf = (v) => `Pricing- what to charge- reel 2 3fa9c1 Reel Kit v${v}`;
const slugOf = (v) => `3fa9c1-reel-2-v${v}`;
const NAME = nameOf(1);
const SLUG = slugOf(1);
/** A second edit of the episode, of Reel 1, for what one project's open says of another's. */
const ONE_NAME = "Pricing- what to charge- reel 1 3fa9c1 Reel Kit v1";
const ONE_SLUG = "3fa9c1-reel-1-v1";
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT_SAID = "You said to leave this video: it is not for BRIMM Video Studio. To have it read, say what it is.";
const OPEN = "It's open in HyperFrames.";

const done = [];
after(() => {
  for (const t of done) t.done();
});

/** A stand-in plutil, by what each plist holds (a path not in `plists` is no app), writing down each call and its options. */
function plutilOf(plists) {
  const calls = [];
  const run = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    const plist = args.at(-1);
    return plist in plists ? { status: 0, stdout: JSON.stringify(plists[plist]), stderr: "" } : { status: 1, stdout: "", stderr: "No such file" };
  };
  return { run, calls, plists };
}

/** The made-up episode, answered as a raw wide recording unless `record` says otherwise, with a Reel Kit edit of Reel 2 that finalize
    left ready (`state` laid over its studio.json), this Mac set up for the app, and the stand-in told to open (`open`) and, with `app`
    "writes", to write what the app writes. HyperFrames' Info.plist says 0.9.4 unless `plists` says otherwise. */
function world({ record = {}, state = {}, open = "opened", app = "writes", plists = { [SYSTEM]: { CFBundleShortVersionString: "0.9.4", CFBundleVersion: "941" } }, setUp = true, reelOne = false } = {}) {
  const entry = entryOf({ key: "reel 2", name: NAME, mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 2, from: FROM, workingCopy: COPY });
  const one = entryOf({ key: "reel 1", name: ONE_NAME, mode: "hifi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 1, from: FROM, workingCopy: COPY });
  const { t, found } = episode({ ...RAW, answer: { ...ANSWERED, seen: "wide, 0:23, no retakes" }, version: 4, app: { toolchain: "0.8.208", projects: reelOne ? [entry, one] : [entry] }, ...record });
  done.push(t);
  mkdirSync(join(kitDir(t.home), "pipeline"), { recursive: true });
  writeFileSync(join(kitDir(t.home), "pipeline", "new.py"), "# made up\n");
  mkdirSync(join(venvPython(t.home), ".."), { recursive: true });
  writeFileSync(venvPython(t.home), "#!/bin/sh\n");
  markReady(t.home);
  const live = new Set();
  let next = 50000;
  t.ctx.deps.start = (cmd, args) => {
    t.started.push([cmd, args]);
    live.add(next);
    return next++;
  };
  t.ctx.deps.alive = (pid) => live.has(pid) || pid === process.pid;
  const dirOf = (v) => join(episodeWork(t.home, FOLDER), nameOf(v));
  const dir = dirOf(1);
  /** An edit finalize left ready in the folder `at`. */
  const made = (at, fields) => {
    for (const folder of ["public/media", "cards/c1", "fx/f1", "work", "source", "storyboard", "renders"]) mkdirSync(join(at, folder), { recursive: true });
    writeFileSync(join(at, "source", "clip.mp4"), "THE 4K COPY");
    writeFileSync(join(at, "edit.py"), `TITLE = "${fields.title}"\nSTYLE = "${fields.mode}"\n`);
    writeFileSync(join(at, "public", "index.html"), "<html>the composition</html>\n");
    writeFileSync(join(at, "cards", "c1", "index.html"), "<html>a card</html>\n");
    writeFileSync(join(at, "fx", "f1", "fx.js"), "// an effect\n");
    writeState(at, { version: 1, state: "ready", job: "finalize", step: "ready", approved: { at: "2026-11-23T10:00:00.000Z" }, ...fields, fingerprint: compositionFingerprint(at) });
  };
  made(dir, { slug: SLUG, key: "reel 2", mode: "lofi", title: "Know your costs", name: NAME, ...state });
  if (reelOne) made(join(episodeWork(t.home, FOLDER), ONE_NAME), { slug: ONE_SLUG, key: "reel 1", mode: "hifi", title: "The opening", name: ONE_NAME });
  if (setUp) writeSettings(t.home, { app: "hyperframes" });
  writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open, app }));
  t.ctx.deps.app = { cli: HF, node: process.execPath };
  const plutil = plutilOf(plists);
  return { t, found, live, dir, dirOf, plutil, fingerprint: readState(dir).fingerprint };
}

/** Run `reelkit <words…>` on the made-up Mac: { code, said }, every line she reads checked plain. */
async function reelkit(w, words, { reelKit = {}, env = {} } = {}) {
  const said = [];
  const code = await editMain(["reelkit", ...words], { ...w.t.ctx.deps, env, reelKit: { plutil: w.plutil.run, ...reelKit }, say: (line) => said.push(line) });
  for (const line of said) assert.doesNotMatch(line, PLAIN, line);
  return { code, said };
}
const openIt = (w, ...more) => reelkit(w, ["app", FOLDER, SLUG], ...more);

/** What the stand-in wrote down of each run of the pinned command line: its arguments. */
const hfRuns = (w) => {
  const log = join(w.t.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line).args) : [];
};
const entryNow = (w, version = 1) => reread(w.found).app.projects.find((p) => p.maker === "reel-kit" && p.version === version);

/** The lines of a Studio Reel project's own notes (project.js projectFiles), for the rules a Reel Kit edit's notes share with them. */
function studioNotes() {
  const words = [{ w: "Pricing,", start: 0.5, end: 1.1 }, { w: "is", start: 1.2, end: 1.6 }, { w: "a", start: 1.7, end: 2 }, { w: "skill.", start: 2.1, end: 3 }];
  const files = projectFiles({
    kind: "reel", name: "Pricing talk", part: { reel: 2 }, id: "e-20261014-3fa9c1", facts: { seconds: 6, fps: 30, width: 1920, height: 1080, bytes: 10 },
    words, spellings: [], plan: { by: "rules", phrases: [] }, reels: [], guidance: "# HyperFrames\n", video: "/made-up/working copy/k.mp4",
    cli: "/made-up/hyperframes.mjs", logos: [], createdAt: "2026-10-28T15:00:00.000Z",
    stretch: { start: 0.5, end: 3 }
  });
  return files.get("CLAUDE.md").split("\n");
}

/** A program for runJob to start as `claude`: the stand-in, its scenario baked in. */
function claudeOf(w, scenario = "") {
  const program = join(w.t.dir, `claude-${Math.random().toString(36).slice(2)}`);
  writeFileSync(program, `#!/bin/sh\nCLAUDE_WORKER_STANDIN='${scenario}' exec '${process.execPath}' '${WORKER}' "$@"\n`);
  chmodSync(program, 0o755);
  return program;
}
/** lsof finds no one holding a project open; ps is the real one. */
const run = (program, args, options) => (program === "/usr/sbin/lsof" ? { status: 1, stdout: "", stderr: "" } : spawnSync(program, args, options));

describe("opening a Reel Kit edit in the app", () => {
  it("opens the project's public folder in the app with BRIMM's notes and the Reel Kit line", async () => {
    const w = world({ app: "" });
    const r = await openIt(w);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(r.said[0], OPEN);
    assert.match(r.said.at(-1), /^In HyperFrames, share only with people you invite, and export on This Mac/);
    // The app is asked for the project's public/, Reel Kit's HyperFrames project, by the pinned command line.
    assert.deepEqual(hfRuns(w), [["open", join(w.dir, "public"), "--json"]]);
    // Its notes, both files the same text: BRIMM's rules as Studio's own projects have them, and the line about Reel Kit.
    const notes = readFileSync(join(w.dir, "public", "CLAUDE.md"), "utf8");
    assert.equal(readFileSync(join(w.dir, "public", "AGENTS.md"), "utf8"), notes);
    assert.equal(REEL_KIT_LINE, "This project was made by Reel Kit: leave its timeline and its fx/ and cards/ folders as they are unless Sallie asks.");
    assert.ok(notes.includes(REEL_KIT_LINE), notes);
    const lines = notes.split("\n");
    const studio = studioNotes();
    assert.equal(lines[0], "# The BRIMM: rules for this project");
    for (const label of ["A draft only.", "On this Mac only.", "Sharing.", "AI-generated people.", "Commands never run here.", "Cutting.", "When she is done."]) {
      const ours = lines.find((line) => line.startsWith(`- **${label}**`));
      assert.ok(ours, `${label} is in the notes`);
      assert.equal(ours, studio.find((line) => line.startsWith(`- **${label}**`)), `${label} is Studio's own rule, word for word`);
    }
    assert.ok(lines.some((line) => line.startsWith("- **The brand.**") && line.includes("Sallie Ogden")));
    // None of Studio's own project's files is named: a Reel Kit edit has none of them.
    assert.doesNotMatch(notes, /transcript\.json|brimm\/|assets\/fonts|node_modules|npx hyperframes history/);
    assert.ok(notes.includes(NAME), "the project's name, which HyperFrames names an export after");
    assert.equal(existsSync(join(w.dir, "CLAUDE.md")), false, "nothing at the project's top");
    // Studio noted both, so the next look over the project leaves them alone.
    assert.deepEqual(sweepProject(w.t.home, SLUG, w.dir, {}).planted, []);
    // The record's entry is opened, and studio.json keeps the edit ready, with the app's version it was opened with.
    const entry = entryNow(w);
    assert.equal(entry.state, "opened");
    assert.equal(entry.opened.length, 1);
    const state = readState(w.dir);
    assert.equal(state.state, "ready");
    assert.equal(state.fingerprint, w.fingerprint);
    assert.equal(state.app.version, "0.9.4");
    assert.equal(state.app.build, "941");
    assert.equal(state.app.opened.length, 1);
    assert.equal(wasOpened(w.t.home, SLUG), true);
    // Opened again: one more time in the record, the state stays opened.
    const again = await openIt(w);
    assert.equal(again.code, 0, again.said.join("\n"));
    assert.deepEqual([entryNow(w).state, entryNow(w).opened.length, readState(w.dir).app.opened.length], ["opened", 2, 2]);
  });

  it("opening in the app alone leaves the fingerprint as it was", async () => {
    const w = world();
    const r = await openIt(w);
    assert.equal(r.code, 0, r.said.join("\n"));
    // The stand-in app wrote its own folder, its snapshots, a record in renders/ and its agent's settings, as the app does.
    for (const rel of [".hyperframes/transcripts/clip.json", ".hyperframes/history.json", "snapshots/frame-0001.png", "renders/preview_2026-11-23_10-00-00.meta.json", ".claude/settings.local.json"]) {
      assert.ok(existsSync(join(w.dir, "public", rel)), rel);
    }
    assert.equal(compositionFingerprint(w.dir), w.fingerprint);
    assert.equal(renderWhy(w.dir, readState(w.dir)), "");
    // So "render it" still renders it, and status says it is ready.
    const status = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(status.said, ["Reel 2 (lo-fi, version 1): it is built and ready to render."]);
    const render = await reelkit(w, ["render", FOLDER, SLUG]);
    assert.deepEqual([render.code, render.said], [0, [EDIT_SAY.rendering("Reel 2 (lo-fi, version 1)")]]);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(2)), [["--now", FOLDER, "render", SLUG]]);
  });

  it("refuses a headless render and a rebuild once the app changed it, in one line", async () => {
    const w = world();
    assert.equal((await openIt(w)).code, 0);
    // She changes the composition in the app.
    writeFileSync(join(w.dir, "public", "index.html"), "<html>the composition, as she changed it</html>\n");
    const changed = RENDER_SAY.changed(NAME);
    assert.equal(changed, `${NAME} was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`);
    const render = await reelkit(w, ["render", FOLDER, SLUG]);
    assert.deepEqual([render.code, render.said], [1, [changed]]);
    writeFileSync(notesFile(w.dir), JSON.stringify([{ beat: "p02", text: "Shorter.", at: "2026-11-23T11:00:00.000Z" }]));
    const revise = await reelkit(w, ["revise", FOLDER, SLUG]);
    assert.deepEqual([revise.code, revise.said], [1, [changed]]);
    // The detached half refuses it too, before anything is written or run.
    const before = readFileSync(join(w.dir, "studio.json"), "utf8");
    const half = await reelkit(w, ["--now", FOLDER, "revise", SLUG], { reelKit: { claude: claudeOf(w), run } });
    assert.equal(half.code, 1);
    assert.equal(half.said.length, 1, half.said.join("\n"));
    assert.equal(readFileSync(join(w.dir, "studio.json"), "utf8"), before);
    assert.deepEqual(w.t.started, [], "nothing started");
    // An edit at a later storyboard, its composition changed by Reel Kit's own revise since finalize, is no edit changed in the app.
    const revised = world({ state: { state: "storyboard", step: "storyboard", job: "revise" } });
    writeFileSync(join(revised.dir, "public", "index.html"), "<html>as the revise left it</html>\n");
    writeFileSync(notesFile(revised.dir), JSON.stringify([{ beat: "p03", text: "Warmer.", at: "2026-11-23T11:00:00.000Z" }]));
    assert.equal((await reelkit(revised, ["revise", FOLDER, SLUG])).code, 0);
    // Status says why it isn't rendered; opening it in the app again is still hers.
    assert.deepEqual((await reelkit(w, ["status", FOLDER])).said, [`Reel 2 (lo-fi, version 1): ${changed}`]);
    assert.equal((await openIt(w)).code, 0);
    assert.equal(readFileSync(join(w.dir, "public", "index.html"), "utf8"), "<html>the composition, as she changed it</html>\n");
  });

  it("starts a new version for further Reel Kit changes, leaving the changed one", async () => {
    const w = world();
    assert.equal((await openIt(w)).code, 0);
    writeFileSync(join(w.dir, "public", "index.html"), "<html>hers</html>\n");
    const stateBefore = readFileSync(join(w.dir, "studio.json"), "utf8");
    // An opened edit is never changed by Reel Kit again, changed in the app or not: further changes are a new version.
    const unchanged = world();
    assert.equal((await openIt(unchanged)).code, 0);
    writeFileSync(notesFile(unchanged.dir), JSON.stringify([{ beat: "p02", text: "Shorter.", at: "2026-11-23T11:00:00.000Z" }]));
    const refused = await reelkit(unchanged, ["revise", FOLDER, SLUG]);
    assert.deepEqual([refused.code, refused.said], [1, [EDIT_SAY.openedNoChange(NAME)]]);
    assert.deepEqual(unchanged.t.started, []);

    const start = await reelkit(w, ["start", FOLDER, "reel", "2", "--mode", "lofi"]);
    assert.equal(start.code, 0, start.said.join("\n"));
    assert.equal(start.said[0], "Reel 2 is in the queue for a lo-fi Reel Kit edit.");
    const words = w.t.started.map(([, args]) => args.slice(2));
    assert.equal(words.length, 1);
    // The queued job, run here: the real scaffold, with stand-ins for her pack, the copy of 4K and Reel Kit's new.py.
    const made = join(w.t.dir, "copy");
    mkdirSync(made, { recursive: true });
    const scaffoldDeps = {
      syncPack: () => "",
      makeWorkCopy: async () => {
        writeFileSync(join(made, "clip.mp4"), "THE NEW 4K COPY");
        writeFileSync(join(made, "clip.json"), JSON.stringify(COPY));
        return { ok: true, paths: { video: join(made, "clip.mp4"), facts: join(made, "clip.json") } };
      },
      copy: { tools: {} },
      run: async () => ({ code: 0, out: "" })
    };
    const half = await reelkit(w, words[0], { reelKit: { scaffoldDeps, claude: claudeOf(w), run, every: 20, wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 20))) } });
    assert.equal(half.code, 0, half.said.join("\n"));
    // Version 2, in a folder of its own, and its entry beside the first.
    const second = w.dirOf(2);
    assert.equal(lstatSync(second).isDirectory(), true);
    assert.deepEqual([readState(second).slug, readState(second).version, readState(second).state], [slugOf(2), 2, "storyboard"]);
    assert.deepEqual(reread(w.found).app.projects.map((p) => [p.version, p.name, p.state]), [[1, NAME, "opened"], [2, nameOf(2), "made"]]);
    // The changed one stays as it is: her composition, its studio.json, its notes, untouched.
    assert.equal(readFileSync(join(w.dir, "public", "index.html"), "utf8"), "<html>hers</html>\n");
    assert.equal(readFileSync(join(w.dir, "studio.json"), "utf8"), stateBefore);
    assert.ok(existsSync(join(w.dir, "public", "CLAUDE.md")));
    assert.ok(existsSync(join(w.dir, "public", ".claude", "settings.local.json")));
  });
});

describe("what may be opened", () => {
  it("never opens a session or a video the gate holds", async () => {
    const cleared = { ...SESSION, session: { ...SESSION.session, cleared: CLEARED } };
    for (const [record, line] of [[UNANSWERED, WAITING], [LEFT, LEFT_SAID], [SESSION, NOT_FOR_SESSION], [cleared, NOT_FOR_SESSION]]) {
      const w = world({ record });
      const r = await openIt(w);
      assert.deepEqual([r.code, r.said], [1, [line]], record.label ?? record.kind);
      assert.deepEqual(hfRuns(w), [], "the app is never asked");
      assert.equal(existsSync(join(w.dir, "public", "CLAUDE.md")), false);
      assert.deepEqual(w.plutil.calls, []);
    }
  });

  it("opens only an edit built after her go, on a Mac set up for the app, in one line", async () => {
    const early = world({ state: { state: "storyboard", step: "storyboard" } });
    assert.deepEqual(Object.values(await openIt(early)), [1, [EDIT_SAY.appNotBuilt]]);
    const working = world({ state: { state: "working", step: "cut", pid: process.pid } });
    assert.deepEqual(Object.values(await openIt(working)), [1, [EDIT_SAY.busy]]);
    const bare = world({ setUp: false });
    assert.deepEqual(Object.values(await openIt(bare)), [1, [NOT_SET_UP]]);
    const rendered = world({ state: { state: "rendered" } });
    assert.equal((await openIt(rendered)).code, 0, "a rendered edit opens too");
    const said = [];
    assert.equal(await editMain(["reelkit", "app", FOLDER], { ...rendered.t.ctx.deps, env: {}, say: (line) => said.push(line) }), 2);
    assert.deepEqual(said, [HELP]);
    for (const w of [early, working, bare]) assert.deepEqual(hfRuns(w), []);
  });
});

describe("the app's own writes in public/", () => {
  it("sets aside Studio's own names Studio did not write, and opens nothing, before the app has ever opened it", async () => {
    const w = world();
    mkdirSync(join(w.dir, "public", ".claude"), { recursive: true });
    writeFileSync(join(w.dir, "public", ".claude", "settings.local.json"), "{}\n");
    const r = await openIt(w);
    assert.deepEqual([r.code, r.said], [1, [EDIT_SAY.appFound]]);
    assert.deepEqual(hfRuns(w), [], "the app is never asked");
    assert.equal(existsSync(join(w.dir, "public", ".claude")), false, "set aside");
    const aside = asideDir(w.t.home, SLUG);
    const [when] = readdirSync(aside);
    assert.ok(existsSync(join(aside, when, "public", ".claude", "settings.local.json")));
    assert.equal(wasOpened(w.t.home, SLUG), false);
    // Once it is set aside, she can open it.
    assert.equal((await openIt(w)).code, 0);
  });

  it("leaves the app's own .claude folder alone once Studio has opened the project, and the worker never runs it again", async () => {
    const w = world();
    assert.equal((await openIt(w)).code, 0);
    assert.ok(existsSync(join(w.dir, "public", ".claude", "settings.local.json")), "the app's agent wrote its settings");
    const again = await openIt(w);
    assert.equal(again.code, 0, again.said.join("\n"));
    assert.ok(existsSync(join(w.dir, "public", ".claude", "settings.local.json")), "left where the app wrote it");
    assert.equal(existsSync(asideDir(w.t.home, SLUG)), false, "nothing set aside");
    assert.deepEqual(hfRuns(w).length, 2);
    // A job of the worker's is refused for an opened project before anything is marked, looked at or run.
    const before = readFileSync(join(w.dir, "studio.json"), "utf8");
    const ended = await runJob(w.t.ctx, { dir: w.dir, job: "revise", notes: [{ beat: "p02", text: "Shorter." }] }, { claude: claudeOf(w), run, alive: w.t.ctx.deps.alive, every: 20, wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 20))) });
    assert.deepEqual([ended.state, ended.why], ["ready", "opened"]);
    assert.equal(readFileSync(join(w.dir, "studio.json"), "utf8"), before);
    assert.ok(existsSync(join(w.dir, "public", ".claude", "settings.local.json")));
  });
});

describe("the app's version (plan Task 18)", () => {
  it("says once when HyperFrames was updated since, and records the version in the project", async () => {
    const w = world();
    const first = await openIt(w);
    assert.equal(first.code, 0);
    assert.equal(first.said.some((line) => line.startsWith("HyperFrames was updated")), false, "the first version seen is no change");
    // plutil is asked with a time limit, for each copy of the app.
    assert.deepEqual(w.plutil.calls.map((c) => [c.cmd, c.args.at(-1), c.options.timeout]), [["/usr/bin/plutil", SYSTEM, 5000], ["/usr/bin/plutil", join(w.t.home, "Applications", "HyperFrames.app", "Contents", "Info.plist"), 5000]]);
    w.plutil.plists[SYSTEM] = { CFBundleShortVersionString: "0.9.5", CFBundleVersion: "950" };
    const second = await openIt(w);
    assert.equal(second.code, 0);
    const updated = "HyperFrames was updated since this project was last opened (0.9.4 to 0.9.5): check that it plays before you change it.";
    assert.deepEqual(second.said.filter((line) => line.startsWith("HyperFrames was updated")), [updated]);
    assert.deepEqual([readState(w.dir).app.version, readState(w.dir).app.build], ["0.9.5", "950"]);
    const third = await openIt(w);
    assert.equal(third.said.some((line) => line.startsWith("HyperFrames was updated")), false, "said once");
  });

  it("opens all the same when the version can't be read or kept, and says nothing of it", async () => {
    const w = world({ plists: {} });
    const none = await openIt(w);
    assert.equal(none.code, 0);
    assert.equal(none.said.some((line) => line.startsWith("HyperFrames was updated")), false);
    assert.equal(existsSync(appVersionFile(w.t.home)), false);
    // A record of the last version that can't be written (a folder in its place) stops nothing.
    const broken = world();
    mkdirSync(join(appVersionFile(broken.t.home), "in the way"), { recursive: true });
    const r = await openIt(broken);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(r.said[0], OPEN);
    // plutil that throws stops nothing either.
    const throws = world();
    const r2 = await openIt(throws, { reelKit: { plutil: () => { throw new Error("plutil broke"); } } });
    assert.equal(r2.code, 0, r2.said.join("\n"));
  });
});

describe("fix round 1", () => {
  const UPDATED = "HyperFrames was updated since this project was last opened (0.9.4 to 0.9.5): check that it plays before you change it.";
  const updatedLines = (r) => r.said.filter((line) => line.startsWith("HyperFrames was updated"));

  it("says the app was updated only for a project last opened with another version, and never at a project's first open", async () => {
    const w = world({ reelOne: true });
    const openA = () => reelkit(w, ["app", FOLDER, SLUG]);
    const openB = () => reelkit(w, ["app", FOLDER, ONE_SLUG]);
    assert.deepEqual(updatedLines(await openA()), [], "A's first open");
    w.plutil.plists[SYSTEM] = { CFBundleShortVersionString: "0.9.5", CFBundleVersion: "950" };
    const b = await openB();
    assert.equal(b.code, 0, b.said.join("\n"));
    assert.deepEqual(updatedLines(b), [], "B was never opened before: nothing was updated since");
    assert.deepEqual(updatedLines(await openA()), [UPDATED], "A was last opened at 0.9.4");
    assert.deepEqual(updatedLines(await openA()), [], "said once for A");
    assert.deepEqual(updatedLines(await openB()), [], "B was last opened at 0.9.5");
    // The Mac's own record of the last version seen is kept all the same.
    assert.equal(JSON.parse(readFileSync(appVersionFile(w.t.home), "utf8")).version, "0.9.5");
  });

  it("refuses a rebuild of an edit that holds a link, as its render is refused", async () => {
    const w = world();
    mkdirSync(join(w.t.dir, "elsewhere"), { recursive: true });
    symlinkSync(join(w.t.dir, "elsewhere"), join(w.dir, "public", "elsewhere"));
    writeFileSync(notesFile(w.dir), JSON.stringify([{ beat: "p02", text: "Shorter.", at: "2026-11-23T11:00:00.000Z" }]));
    assert.deepEqual(Object.values(await reelkit(w, ["revise", FOLDER, SLUG])), [1, [RENDER_SAY.odd]]);
    assert.deepEqual(Object.values(await reelkit(w, ["render", FOLDER, SLUG])), [1, [RENDER_SAY.odd]]);
    assert.deepEqual(w.t.started, []);
  });

  it("opens nothing while the edit is being rendered, in one line", async () => {
    const w = world({ state: { rendering: { pid: process.pid, at: "2026-11-23T11:00:00.000Z" } } });
    const r = await openIt(w);
    assert.equal(r.code, 1, r.said.join("\n"));
    assert.equal(r.said.length, 1);
    assert.equal(r.said[0], EDIT_SAY.appRendering);
    assert.deepEqual(hfRuns(w), []);
    assert.equal(existsSync(join(w.dir, "public", "CLAUDE.md")), false);
  });

  it("writes its notes again when the app's agent changed them in an opened project, and still refuses anything else", async () => {
    const w = world();
    assert.equal((await openIt(w)).code, 0);
    const notes = readFileSync(join(w.dir, "public", "CLAUDE.md"), "utf8");
    writeFileSync(join(w.dir, "public", "CLAUDE.md"), `${notes}\n- She likes the warm look.\n`);
    writeFileSync(join(w.dir, "public", "AGENTS.md"), "the agent's own words\n");
    const again = await openIt(w);
    assert.equal(again.code, 0, again.said.join("\n"));
    for (const name of ["CLAUDE.md", "AGENTS.md"]) assert.equal(readFileSync(join(w.dir, "public", name), "utf8"), notes, name);
    assert.equal(existsSync(asideDir(w.t.home, SLUG)), false, "nothing set aside");
    assert.deepEqual(sweepProject(w.t.home, SLUG, w.dir, { opened: true }).planted, [], "noted again as Studio's");
    // Any other of Studio's own names is still refused, opened or not.
    writeFileSync(join(w.dir, "public", "CLAUDE.local.md"), "planted\n");
    assert.deepEqual(Object.values(await openIt(w)), [1, [EDIT_SAY.appFound]]);
    assert.equal(hfRuns(w).length, 2);
  });
});
