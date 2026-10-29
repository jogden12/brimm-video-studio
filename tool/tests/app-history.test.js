// What was done in the HyperFrames app, and the versions it has kept (plan PR 6; architecture 2026-10-27, sections 4.1 step 9 and 4.6).
// app-history.js is what `app "<episode>" what-happened` and `app "<episode>" versions` do once edit.js has found the episode, asked
// the gate and seen that this Mac is set up; tests/edit-app-history.test.js runs both through editMain. Here the module is run on its
// own, in a made-up home with a project of the record in it. No test runs the command line, the app or HeyGen: the stand-in
// (tests/stand-ins/hyperframes.mjs) answers `history` as the pinned version does, from the fixtures, and writes down how it was run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PIN, plainTurns, turnsOf } from "../hyperframes.js";
import { CANNOT_LIST, MOST_TURNS, daysOf, historyTail, noVersions, nothingYet, versionsOf, whatHappened } from "../app-history.js";
import { episodeWork } from "../settings.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const fixture = (name) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/${name}`, import.meta.url), "utf8");
const NEW_YORK = "America/New_York";
const FOLDER = "2026-10-28 Pricing talk (Mac Studio)";
const PROJECT = "Pricing talk main 3fa9c1";
/** A moment the day after the fixtures' (2026-10-27, in New York), and one on their day. */
const NEXT_DAY = Date.parse("2026-10-28T12:00:00-04:00");
const SAME_DAY = Date.parse("2026-10-27T22:00:00-04:00");
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";
/** The names of the variables the pinned command line is run with (hyperframes.js childEnv): no chat's id among them. */
const PINNED_ENV = ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs/;

const THREE = [
  "4:05 pm: you asked What font is the title in?; HyperFrames did It's Josefin Sans, medium weight.",
  "3:52 pm: you asked Add the BRIMM logo in the bottom right corner for the whole video; HyperFrames did I added the logo at the bottom right and kept it on for the whole video.; changed logo.html, brimm-logo.png",
  "3:41 pm: you asked Make the title bigger and move it up a little; HyperFrames did I made the title larger and moved it up about 40 pixels.; changed index.html"
];
const SIX = [
  "4:12 pm: Undid: Make the title bigger and move it up a little (HyperFrames; changed index.html)",
  "4:07 pm: Imported media (you; changed theme-song.mp3)",
  "4:06 pm: Changed outside the app (outside HyperFrames; changed recording.transcript.json)",
  "3:52 pm: recording.mp4 Add the BRIMM logo in the bottom right corner for the whole video (HyperFrames; kept; changed logo.html, brimm-logo.png)",
  "3:47 pm: 1. Remove “um,”: Cut recording.mp4 from 12.4s to 12.8s so the take is clean. (HyperFrames; changed index.html)",
  "3:41 pm: Make the title bigger and move it up a little (HyperFrames; undone; changed index.html)"
];

/** A made-up Mac for one test: its home (which is also the stand-in's, where it reads how to answer and writes how it was run), the
    episode's work folder, the project of the record in it, and a context that collects what is said. `history` is how the stand-in
    answers (the fixture's entries, an untouched project's, a refusal, or what is not JSON). `made` says whether the project's
    folder is on this Mac, `listed` whether the record lists it, `id` whether it has a history-id, as the app (or the command line)
    makes one when it first records, and `turns` is the text of its app-history.jsonl, none when it has none. */
function world(c, { history = "entries", made = true, listed = true, id = true, turns = null, on = "Mac Studio", state = "opened", projects } = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-app-history-"));
  c.after(() => rmSync(home, { recursive: true, force: true }));
  writeFileSync(join(home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened", history }));
  const work = episodeWork(home, FOLDER);
  const dir = join(work, PROJECT);
  if (made) {
    mkdirSync(join(dir, ".hyperframes"), { recursive: true });
    writeFileSync(join(dir, "index.html"), "<html>the project</html>");
    if (id) writeFileSync(join(dir, ".hyperframes", "history-id"), "c5039b1a-c117-4f32-a8f5-e73e6804dbbe\n");
    if (turns !== null) writeFileSync(join(dir, ".hyperframes", "app-history.jsonl"), turns);
  }
  const entry = { key: "main", name: PROJECT, madeAt: "2026-10-27T15:42:00-04:00", on, from: { file: "Talk.mov", bytes: 1, modified: "2026-10-27T09:12:00-04:00" }, workingCopy: { bytes: 1, seconds: 2.6, fps: 30 }, opened: ["2026-10-27T15:43:10-04:00"], handover: false, fromSuggestion: null, state };
  const record = { id: "e-20261028-3fa9c1", rev: 4, kind: "raw", name: { text: "Pricing talk", placeholder: false }, video: { file: "Talk.mov" }, ...(listed ? { app: { toolchain: PIN.version, projects: projects ?? [entry] } } : {}) };
  const said = [];
  const ctx = { home, machine: "Mac Studio", now: () => NEXT_DAY, alive: () => false, say: (line) => said.push(line), settings: { root: join(home, "Dropbox", "BRIMM Video"), app: "hyperframes", appHandover: true } };
  const found = { name: FOLDER, folder: join(home, "Dropbox", "BRIMM Video", "Episodes", FOLDER) };
  const runs = () => (existsSync(join(home, "hyperframes-stand-in.log")) ? readFileSync(join(home, "hyperframes-stand-in.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
  const deps = { cli: STAND_IN, node: process.execPath, tz: NEW_YORK, env: { LANG: "en_US.UTF-8", CLAUDE_CODE_SESSION_ID: CHAT } };
  return { home, work, dir, record, said, ctx, found, runs, deps };
}
/** Every path under a folder, with what a file holds: to see that nothing was written. */
const treeOf = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).sort().map((path) => [path, lstatSync(join(dir, path)).isFile() ? readFileSync(join(dir, path), "utf8") : null]));
const turn = (n, over = {}) => JSON.stringify({ at: new Date(Date.parse("2026-10-27T15:00:00.000Z") + n * 60000).toISOString(), engine: "claude", asked: `ask ${n}`, did: `did ${n}`, files: [], ...over });

describe("the file of the app's history", () => {
  const file = (dir) => join(dir, ".hyperframes", "app-history.jsonl");
  it("is read whole when it is small, and is nothing when there is no folder, no file or nothing in it", (c) => {
    const w = world(c, { turns: `${turn(1)}\n${turn(2)}\n` });
    assert.equal(historyTail(w.dir), `${turn(1)}\n${turn(2)}\n`);
    const none = world(c, { made: false });
    assert.equal(historyTail(join(none.work, "nowhere")), "");
    const bare = world(c);
    assert.equal(historyTail(bare.dir), "");
    rmSync(join(bare.dir, ".hyperframes"), { recursive: true });
    assert.equal(historyTail(bare.dir), "");
    writeFileSync(file(w.dir), "");
    assert.equal(historyTail(w.dir), "");
  });
  it("is not followed when the file or the folder is a symbolic link, and is nothing when a folder is where the file should be", (c) => {
    const elsewhere = world(c, { turns: `${turn(1)}\n` });
    const linked = world(c);
    symlinkSync(file(elsewhere.dir), file(linked.dir));
    assert.equal(historyTail(linked.dir), "");
    const folderLinked = world(c, { made: false });
    mkdirSync(folderLinked.dir, { recursive: true });
    symlinkSync(join(elsewhere.dir, ".hyperframes"), join(folderLinked.dir, ".hyperframes"));
    assert.equal(historyTail(folderLinked.dir), "", "a linked .hyperframes folder");
    const inPlace = world(c);
    mkdirSync(file(inPlace.dir));
    assert.equal(historyTail(inPlace.dir), "");
  });
  it("is nothing when the file cannot be read", (c) => {
    if (process.getuid?.() === 0) return c.skip("root reads what it is not given");
    const w = world(c, { turns: `${turn(1)}\n` });
    chmodSync(file(w.dir), 0);
    assert.equal(historyTail(w.dir), "");
  });
  it("reads the last megabyte of a larger file and drops the first line the cut left in the middle, so that the newest turns stand and no half line does", (c) => {
    const lines = Array.from({ length: 2000 }, (_, n) => turn(n, { asked: "x".repeat(500), did: `did ${n}` }));
    const w = world(c, { turns: `${lines.join("\n")}\n` });
    assert.ok(lstatSync(join(w.dir, ".hyperframes", "app-history.jsonl")).size > 1024 * 1024 + 100000, "the file is well over a megabyte");
    const text = historyTail(w.dir);
    assert.ok(Buffer.byteLength(text) <= 1024 * 1024, String(Buffer.byteLength(text)));
    assert.ok(Buffer.byteLength(text) > 1024 * 1024 - 1000, "all but the one line the cut broke");
    assert.ok(text.startsWith('{"at"') && text.endsWith("}\n"));
    const turns = turnsOf(text);
    assert.equal(turns.length, text.split("\n").filter(Boolean).length, "every line is a whole turn");
    assert.equal(turns[turns.length - 1].did, "did 1999");
    assert.ok(turns.length < 2000 && turns.length > 1500, String(turns.length));
  });
  it("reads a file of exactly a megabyte whole, and one with no newline in the part it reads as nothing", (c) => {
    const exact = world(c, { turns: "y".repeat(1024 * 1024) });
    assert.equal(historyTail(exact.dir).length, 1024 * 1024);
    const over = world(c, { turns: "z".repeat(1024 * 1024 + 5) });
    assert.equal(historyTail(over.dir), "", "a cut that leaves no whole line says nothing");
  });
  it("writes, makes and removes nothing", (c) => {
    const w = world(c, { turns: `${turn(1)}\n` });
    const before = treeOf(w.work);
    historyTail(w.dir);
    assert.deepEqual(treeOf(w.work), before);
  });
});

describe("the days", () => {
  const at = (iso) => Date.parse(iso);
  const item = (iso) => ({ ms: at(iso), line: `at ${iso}` });
  const days = (items, now = NEXT_DAY) => daysOf(items, { tz: NEW_YORK, now });

  it("puts what happened today under Today, the day before under Yesterday, and any other under its weekday, day and month", () => {
    const items = [item("2026-10-28T14:00:00.000Z"), item("2026-10-27T19:00:00.000Z"), item("2026-10-27T15:00:00.000Z"), item("2026-10-20T19:41:08.000Z"), item("2026-01-02T19:41:08.000Z")];
    assert.deepEqual(days(items), [
      "Today:", "  at 2026-10-28T14:00:00.000Z",
      "Yesterday:", "  at 2026-10-27T19:00:00.000Z", "  at 2026-10-27T15:00:00.000Z",
      "Tuesday 20 October:", "  at 2026-10-20T19:41:08.000Z",
      "Friday 2 January:", "  at 2026-01-02T19:41:08.000Z"
    ]);
  });
  it("tells the day in the zone it is given: a moment just before midnight and one just after are in two days", () => {
    const items = [item("2026-10-28T04:01:00.000Z"), item("2026-10-28T03:59:00.000Z")];
    assert.deepEqual(days(items, at("2026-10-28T12:00:00-04:00")), ["Today:", "  at 2026-10-28T04:01:00.000Z", "Yesterday:", "  at 2026-10-28T03:59:00.000Z"]);
    assert.deepEqual(daysOf(items, { tz: "UTC", now: at("2026-10-28T12:00:00Z") }), ["Today:", "  at 2026-10-28T04:01:00.000Z", "  at 2026-10-28T03:59:00.000Z"]);
  });
  it("finds yesterday by the calendar and not by 24 hours, on the day the clocks change", () => {
    // 1 November 2026 has 25 hours in New York: at 11:30 pm that day, 24 hours back is 12:30 am on the same day, not the day before.
    const items = [item("2026-11-02T03:00:00.000Z"), item("2026-11-01T04:30:00.000Z"), item("2026-10-31T20:00:00.000Z"), item("2026-10-30T20:00:00.000Z")];
    assert.deepEqual(days(items, at("2026-11-01T23:30:00-05:00")), [
      "Today:", "  at 2026-11-02T03:00:00.000Z", "  at 2026-11-01T04:30:00.000Z", "Yesterday:", "  at 2026-10-31T20:00:00.000Z", "Friday 30 October:", "  at 2026-10-30T20:00:00.000Z"
    ]);
  });
  it("gives the date of a moment after the clock, whose day is not yet", () => {
    assert.deepEqual(days([item("2026-10-28T14:00:00.000Z")], at("2026-10-27T12:00:00-04:00")), ["Wednesday 28 October:", "  at 2026-10-28T14:00:00.000Z"]);
  });
  it("keeps the order it is given, and says nothing for nothing", () => {
    assert.deepEqual(days([item("2026-10-27T15:00:00.000Z"), item("2026-10-28T14:00:00.000Z")]), ["Yesterday:", "  at 2026-10-27T15:00:00.000Z", "Today:", "  at 2026-10-28T14:00:00.000Z"]);
    assert.deepEqual(days([]), []);
  });
  it("refuses a time zone that is not one, rather than tell a wrong day", () => {
    assert.throws(() => daysOf([item("2026-10-28T14:00:00.000Z")], { tz: "Not/AZone", now: NEXT_DAY }), RangeError);
  });
});

describe("what was done in HyperFrames (what-happened)", () => {
  const HEAD = "What was done in HyperFrames on Pricing talk, newest first:";
  const NOTHING = "Nothing has been done in HyperFrames on Pricing talk yet.";
  const run = (w, over = {}) => whatHappened(w.ctx, { found: w.found, record: w.record }, { ...w.deps, ...over });

  it("tells the fixture's three turns newest first, under the day they happened, and ends with 0", (c) => {
    const w = world(c, { turns: fixture("app-history.jsonl") });
    assert.equal(run(w), 0);
    assert.deepEqual(w.said, [HEAD, "Yesterday:", ...THREE.map((line) => `  ${line}`)]);
    assert.equal(nothingYet("Pricing talk"), NOTHING);
  });
  it("puts today's under Today when the clock is on their day", (c) => {
    const w = world(c, { turns: fixture("app-history.jsonl") });
    w.ctx.now = () => SAME_DAY;
    assert.equal(run(w), 0);
    assert.deepEqual(w.said, [HEAD, "Today:", ...THREE.map((line) => `  ${line}`)]);
  });
  it("tells the turns of several days under each, the newest day first, and the turns of a day newest first", (c) => {
    const text = [turn(1, { at: "2026-10-20T19:00:00.000Z" }), turn(2, { at: "2026-10-27T15:00:00.000Z" }), turn(3, { at: "2026-10-28T14:00:00.000Z" }), turn(4, { at: "2026-10-27T19:00:00.000Z" })].join("\n");
    const w = world(c, { turns: text });
    assert.equal(run(w), 0);
    assert.deepEqual(w.said, [HEAD, "Today:", "  10:00 am: you asked ask 3; HyperFrames did did 3", "Yesterday:", "  3:00 pm: you asked ask 4; HyperFrames did did 4", "  11:00 am: you asked ask 2; HyperFrames did did 2", "Tuesday 20 October:", "  3:00 pm: you asked ask 1; HyperFrames did did 1"]);
  });
  it("tells the newest 10 and how many earlier ones there are", (c) => {
    assert.equal(MOST_TURNS, 10);
    const turns = (count) => Array.from({ length: count }, (_, n) => turn(n)).join("\n");
    for (const [count, footer] of [[10, null], [11, "1 earlier request is not shown."], [12, "2 earlier requests are not shown."], [40, "30 earlier requests are not shown."]]) {
      const w = world(c, { turns: turns(count) });
      assert.equal(run(w), 0);
      const told = w.said.filter((line) => line.startsWith("  "));
      assert.equal(told.length, 10, String(count));
      assert.ok(told[0].includes(`ask ${count - 1};`) && told[9].includes(`ask ${count - 10};`), told.join("\n"));
      assert.equal(w.said[w.said.length - 1], footer ?? told[9], String(count));
    }
  });
  it("counts only the turns that have something to say among the earlier ones", (c) => {
    const empty = JSON.stringify({ at: "2026-10-27T15:00:00.000Z", engine: "claude", asked: "", did: "", files: [] });
    const w = world(c, { turns: [...Array.from({ length: 12 }, (_, n) => turn(n + 100)), empty, empty, "not json"].join("\n") });
    assert.equal(run(w), 0);
    assert.equal(w.said[w.said.length - 1], "2 earlier requests are not shown.");
  });
  it("tells a turn that quotes a path, a link and a flag with none of them, and leaves out a text with a command in it", (c) => {
    const text = [
      turn(1, { asked: "Move **it** to assets/logos/a.png --now", did: "Done: see [it](x://y/z.html).", files: ["compositions/c.html"] }),
      turn(2, { asked: "run npx hyperframes lint", did: "I checked it.", files: [] })
    ].join("\n");
    const w = world(c, { turns: text });
    assert.equal(run(w), 0);
    assert.deepEqual(w.said.slice(2), ["  11:02 am: HyperFrames did I checked it.", "  11:01 am: you asked Move it to a.png; HyperFrames did Done: see it.; changed c.html"]);
    for (const line of w.said) assert.doesNotMatch(line, PLAIN, line);
  });
  it("says nothing has been done yet, with 0, for no folder, no file, no turn, junk, no project in the record, a project kept for an earlier kind only, and a folder that is gone", (c) => {
    const cases = [
      ["no .hyperframes folder", world(c)],
      ["no file", world(c)],
      ["an empty file", world(c, { turns: "" })],
      ["junk", world(c, { turns: "not json\n{\n5\n\n" })],
      ["turns with nothing in them", world(c, { turns: `${turn(1, { asked: "", did: "", files: [] })}\n` })],
      ["no project in the record", world(c, { listed: false })],
      ["a project kept for an earlier kind only", world(c, { state: "kept for an earlier kind", turns: fixture("app-history.jsonl") })],
      ["a project whose folder is gone", world(c, { made: false })],
      ["a folder the record does not list", world(c, { listed: false, turns: fixture("app-history.jsonl") })],
      ["a project name that leads nowhere a folder is", world(c, { projects: [{ key: "main", name: "../elsewhere", on: "Mac Studio", state: "opened", opened: [] }] })]
    ];
    rmSync(join(cases[0][1].dir, ".hyperframes"), { recursive: true });
    for (const [what, w] of cases) {
      assert.equal(run(w), 0, what);
      assert.deepEqual(w.said, [NOTHING], what);
    }
  });
  it("says the project is on the other Mac, and ends with 1, when it was made there and is not here", (c) => {
    const w = world(c, { made: false, on: "Sallie's laptop", turns: null });
    assert.equal(run(w), 1);
    assert.deepEqual(w.said, ["The HyperFrames project for Pricing talk is on Sallie's laptop, with everything done in it, so there is nothing to look at on this Mac. Ask Jason."]);
    // A project of the other Mac's whose folder is here is looked at, whichever Mac made it.
    const here = world(c, { on: "Sallie's laptop", turns: fixture("app-history.jsonl") });
    assert.equal(run(here), 0);
    assert.equal(here.said.length, 5);
  });
  it("writes nothing, makes no record, claims nothing and runs no program", (c) => {
    const w = world(c, { turns: fixture("app-history.jsonl") });
    const before = [treeOf(w.work), w.record];
    const spawned = [];
    assert.equal(run(w, { spawn: (...args) => (spawned.push(args), { status: 0, stdout: "" }) }), 0);
    assert.deepEqual([treeOf(w.work), w.record, spawned, w.runs()], [...before, [], []]);
  });
  it("says no path, no flag and no command, and names the episode as its other lines do", (c) => {
    const w = world(c, { turns: fixture("app-history.jsonl") });
    w.record.name.text = "Budget talk";
    assert.equal(run(w), 0);
    assert.equal(w.said[0], "What was done in HyperFrames on Budget talk, newest first:");
    for (const line of w.said) assert.doesNotMatch(line, PLAIN, line);
    assert.deepEqual(plainTurns(turnsOf(fixture("app-history.jsonl")), { tz: NEW_YORK }), THREE);
  });
});

describe("the versions HyperFrames has kept (versions)", () => {
  const HEAD = "The versions of Pricing talk in HyperFrames, newest first:";
  const NONE = "Pricing talk has no versions in HyperFrames yet.";
  const run = (w, over = {}) => versionsOf(w.ctx, { found: w.found, record: w.record }, { ...w.deps, ...over });
  /** A spawn that says what the command line printed, and writes down how it was run. */
  const printing = (stdout, status = 0, calls = []) => Object.assign((...args) => (calls.push(args), { status, stdout, stderr: "", signal: null }), { calls });
  const entries = (count) => JSON.stringify({ entries: Array.from({ length: count }, (_, n) => ({ id: `id-${n}`, who: { kind: "agent", name: "Framey" }, label: `change ${count - n}`, startedAt: 1, endedAt: Date.parse("2026-10-27T19:00:00.000Z") + (count - n) * 60000, files: [], undone: false, pinned: false })), _meta: { version: PIN.version, updateAvailable: false } });

  it("runs the pinned command line once: by its absolute path, `history --json --limit 20 --dir <project>`, in PR 1's environment with no chat's id", (c) => {
    const w = world(c);
    assert.equal(run(w), 0);
    assert.deepEqual(w.runs(), [{ args: ["history", "--json", "--limit", "20", "--dir", w.dir], env: PINNED_ENV }]);
    assert.ok(!w.runs()[0].env.includes("CLAUDE_CODE_SESSION_ID"), "this Mac's setting wants the handover, and the chat has an id: neither is read");
  });
  it("tells the fixture's six entries newest first under the day they happened, and ends with 0", (c) => {
    const w = world(c);
    assert.equal(run(w), 0);
    assert.deepEqual(w.said, [HEAD, "Yesterday:", ...SIX.map((line) => `  ${line}`)]);
    assert.equal(noVersions("Pricing talk"), NONE);
  });
  it("says that is the newest 20 when exactly 20 come, and not when fewer do", (c) => {
    const twenty = world(c);
    assert.equal(run(twenty, { spawn: printing(entries(20)) }), 0);
    assert.equal(twenty.said.filter((line) => line.startsWith("  ")).length, 20);
    assert.equal(twenty.said[twenty.said.length - 1], "These are the newest 20; HyperFrames shows any older ones.");
    const nineteen = world(c);
    assert.equal(run(nineteen, { spawn: printing(entries(19)) }), 0);
    assert.equal(nineteen.said.filter((line) => line.startsWith("  ")).length, 19);
    assert.ok(!nineteen.said.some((line) => line.startsWith("These are")));
  });
  it("asks the spawn it is given for the same program, arguments and environment, a time to wait and room for the output", (c) => {
    const w = world(c);
    const spawn = printing(entries(2));
    assert.equal(run(w, { spawn }), 0);
    const [[file, args, options]] = spawn.calls;
    assert.equal(file, process.execPath);
    assert.deepEqual(args, [STAND_IN, "history", "--json", "--limit", "20", "--dir", w.dir]);
    assert.deepEqual(Object.keys(options.env).sort(), PINNED_ENV);
    assert.deepEqual([options.encoding, options.timeout, options.maxBuffer], ["utf8", 30 * 1000, 16 * 1024 * 1024]);
  });
  it("says there are no versions yet, with 0, when the command line lists none", (c) => {
    const w = world(c, { history: "empty" });
    assert.equal(run(w), 0);
    assert.deepEqual(w.said, [NONE]);
    assert.equal(w.runs().length, 1);
  });
  it("does not run the command line, and makes nothing in the project, when the app has not recorded its history: no history-id, or one that is a link or a folder", (c) => {
    const bare = world(c, { id: false });
    const linked = world(c, { id: false });
    symlinkSync(join(bare.dir, "index.html"), join(linked.dir, ".hyperframes", "history-id"));
    const folder = world(c, { id: false });
    mkdirSync(join(folder.dir, ".hyperframes", "history-id"));
    const noFolder = world(c, { id: false });
    rmSync(join(noFolder.dir, ".hyperframes"), { recursive: true });
    for (const [what, w] of [["no history-id", bare], ["a linked history-id", linked], ["a history-id that is a folder", folder], ["no .hyperframes folder", noFolder]]) {
      const before = treeOf(w.work);
      assert.equal(run(w), 0, what);
      assert.deepEqual([w.said, w.runs(), treeOf(w.work)], [[NONE], [], before], what);
    }
  });
  it("says there are no versions yet, with 0, when there is no project here: none in the record, one kept for an earlier kind only, or a folder that is gone", (c) => {
    for (const w of [world(c, { listed: false }), world(c, { state: "kept for an earlier kind" }), world(c, { made: false })]) {
      assert.equal(run(w), 0);
      assert.deepEqual([w.said, w.runs()], [[NONE], []]);
    }
  });
  it("says the project is on the other Mac, and ends with 1 and runs nothing, when it was made there and is not here", (c) => {
    const w = world(c, { made: false, on: "Sallie's laptop" });
    assert.equal(run(w), 1);
    assert.deepEqual([w.said, w.runs()], [["The HyperFrames project for Pricing talk is on Sallie's laptop, with everything done in it, so there is nothing to look at on this Mac. Ask Jason."], []]);
  });
  it("says it cannot list the versions right now, and ends with 0, when the command line refuses, prints what is not JSON, prints entries none of which can be read, exits with a status other than 0, times out or cannot be started", (c) => {
    const timedOut = Object.assign(new Error("spawnSync node ETIMEDOUT"), { code: "ETIMEDOUT" });
    const cases = [
      ["a refusal", { history: "fails" }, {}],
      ["what is not JSON", { history: "garbled" }, {}],
      ["entries none can be read", {}, { spawn: printing(JSON.stringify({ entries: [5, null, {}] })) }],
      ["a status other than 0", {}, { spawn: printing(entries(2), 1) }],
      ["a time out", {}, { spawn: () => ({ status: null, signal: "SIGTERM", stdout: "", error: timedOut }) }],
      ["a program that cannot be started", {}, { spawn: () => ({ status: null, stdout: null, error: Object.assign(new Error("spawnSync x ENOENT"), { code: "ENOENT" }) }) }],
      ["a spawn that throws", {}, { spawn: () => { throw new Error("no"); } }]
    ];
    for (const [what, world_, over] of cases) {
      const w = world(c, world_);
      const before = treeOf(w.work);
      assert.equal(run(w, over), 0, what);
      assert.deepEqual([w.said, treeOf(w.work)], [[CANNOT_LIST], before], what);
    }
    assert.equal(CANNOT_LIST, "I can't list the versions right now; HyperFrames shows its history.");
  });
  it("writes nothing and makes no record, and says no path, no flag and no command", (c) => {
    const w = world(c);
    const before = [treeOf(w.work), w.record];
    assert.equal(run(w), 0);
    assert.deepEqual([treeOf(w.work), w.record], before);
    for (const line of w.said) assert.doesNotMatch(line, PLAIN, line);
  });
});

describe("app-history.js", () => {
  it("writes nothing, imports no connector, and runs the pinned command line only through the spawn it is given", () => {
    const source = readFileSync(new URL("../app-history.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /writeFileSync|appendFileSync|mkdirSync|renameSync|rmSync|unlinkSync|copyFileSync|chmodSync|symlinkSync|rmdirSync|utimesSync|truncateSync/);
    assert.deepEqual([...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort(), ["./app.js", "./hyperframes.js", "./settings.js", "node:child_process", "node:fs", "node:path"]);
    assert.doesNotMatch(source, /\bfetch\(|\beval\(|\brequire\(|\bimport\(|npx/);
    assert.equal(source.match(/spawnSync/g).length, 2, "imported, and the default of the spawn it is given");
  });
});
