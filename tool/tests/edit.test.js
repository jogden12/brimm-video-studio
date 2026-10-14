// edit.js, the command line for episodes, which a Claude Code session on the Mac runs: listing the episodes and what waits,
// opening one, showing its timeline in Final Cut, what is running, and importing a video again. Each test has a folder of its
// own that stands for BRIMM Video in Dropbox, and a home folder of its own; the clone, the clock, Final Cut and the starting
// of a detached run are stand-ins. Nothing here touches Dropbox, opens Final Cut or starts a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { editMain, findEpisode, contextFor } from "../edit.js";
import { newEpisode, recordFile, recordText } from "../episode.js";
import { writeSettings, libraryFor } from "../settings.js";

const NOW = Date.parse("2026-10-14T12:00:00");

/** One test's BRIMM Video, home folder and stand-ins. `episode(folder, more, files)` puts an episode in Episodes: a whole
    first record, with `more` over its fields, and `files` by their sizes, each listed in the record. `run(...argv)` runs
    edit.js and gives back { code, said }. */
function setup({ settings = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-edit-"));
  const root = join(dir, "BRIMM Video");
  const home = join(dir, "home");
  const episodes = join(root, "Episodes");
  mkdirSync(join(root, "Unedited Video", "Mac Studio"), { recursive: true });
  mkdirSync(episodes, { recursive: true });
  if (settings) writeSettings(home, { machine: "Mac Studio", root, checkout: "/checkout" });
  const opened = [];
  const started = [];
  const clones = [];
  let n = 0;
  const episode = (folder, more = {}, files = { "Talk.mov": 5, "Talk.cut-plan.txt": 3, "edit/main.v0.fcpxml": 0 }) => {
    const path = join(episodes, folder);
    for (const [file, bytes] of Object.entries(files)) {
      mkdirSync(dirname(join(path, file)), { recursive: true });
      writeFileSync(join(path, file), "x".repeat(bytes));
    }
    n += 1;
    const record = { ...newEpisode({ id: `e-20261013-00000${n}`, machine: "Mac Studio", at: "2026-10-13T10:00:00-05:00", video: { file: "Talk.mov", bytes: 5, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: "Mac Studio" }, files }), rev: 1, ...more };
    mkdirSync(join(path, "record"), { recursive: true });
    writeFileSync(recordFile(path, 1), recordText(record));
    return { path, record };
  };
  const deps = {
    home,
    now: () => NOW,
    openApp: (app, file) => opened.push([app, file]),
    start: (cmd, args) => started.push([cmd, ...args]),
    clone: (from, to) => {
      clones.push(to);
      copyFileSync(from, to);
    },
    wait: async () => {},
    alive: () => false,
    statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 })
  };
  const run = async (...argv) => {
    const said = [];
    const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
    return { code, said, text: said.join("\n") };
  };
  return { dir, root, home, episodes, opened, started, clones, deps, episode, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("edit.js, before it does anything", () => {
  it("says this Mac is not set up, and ends with 2, when it has no settings", async () => {
    const t = setup({ settings: false });
    const r = await t.run("episodes");
    assert.deepEqual([r.code, r.said], [2, ["This Mac is not set up for episodes yet. Jason runs install.sh --machine on it."]]);
    t.done();
  });
  it("says how it is used, and ends with 2, when it is asked for nothing or for a command it does not know", async () => {
    const t = setup();
    for (const argv of [[], ["what"]]) {
      const r = await t.run(...argv);
      assert.equal(r.code, 2);
      assert.match(r.text, /node edit\.js episodes/);
    }
    t.done();
  });
});

describe("finding the episode a person names", () => {
  it("finds it by its folder, its id, its short id, or the words of its name", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    t.episode("2026-10-14 Pricing talk (Mac Studio)", { name: { text: "Pricing with confidence", placeholder: false } });
    const ctx = contextFor({ ...t.deps, say: () => {} });
    for (const said of ["2026-10-14 Pricing talk (Mac Studio)", "e-20261013-000002", "000002", "pricing", "Pricing Talk", "confidence"]) {
      assert.equal(findEpisode(ctx, said).name, "2026-10-14 Pricing talk (Mac Studio)", said);
    }
    t.done();
  });
  it("names the ones that fit when more than one does, and says to say which", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    t.episode("2026-10-14 Pricing talk (Mac Studio)");
    const ctx = contextFor({ ...t.deps, say: () => {} });
    assert.deepEqual(findEpisode(ctx, "talk"), { why: 'More than one episode fits "talk": 2026-10-14 Pricing talk (Mac Studio) and 2026-10-13 Talk (Mac Studio). Say which.' });
    t.done();
  });
  it("names the episodes there are when none fits", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    const ctx = contextFor({ ...t.deps, say: () => {} });
    assert.deepEqual(findEpisode(ctx, "budget"), { why: 'No episode fits "budget". The episodes are: 2026-10-13 Talk (Mac Studio).' });
    t.done();
  });
  it("finds an episode with a conflicted copy by its folder, and gives back why it cannot be read", async () => {
    const t = setup();
    const { path } = t.episode("2026-10-13 Talk (Mac Studio)");
    writeFileSync(join(path, "record", "0001 (Sallie Ogden's conflicted copy 2026-10-14).json"), "{}");
    const ctx = contextFor({ ...t.deps, say: () => {} });
    const found = findEpisode(ctx, "talk");
    assert.equal(found.name, "2026-10-13 Talk (Mac Studio)");
    assert.equal(found.read.code, "CONFLICTED");
    t.done();
  });
});

describe("node edit.js episodes", () => {
  it("lists each episode with its name, length and kind, newest first, and leaves an archived one out", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    t.episode("2026-10-14 Pricing talk (Mac Studio)", { name: { text: "Pricing with confidence", placeholder: false }, kind: "short video", main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [{ v: 2, at: "2026-10-14T11:00:00-05:00", on: "Mac Studio", file: "edit/main.v2.mac-studio.fcpxml", project: "Pricing with confidence main v2 000002" }], base: null } }, { "Talk.mov": 5 });
    t.episode("2026-10-12 Old (Mac Studio)", { archived: { at: "2026-10-13T10:00:00-05:00" } }, { "Talk.mov": 5 });
    const r = await t.run("episodes");
    assert.equal(r.code, 0);
    assert.ok(r.text.startsWith([
      "Episodes, newest first:",
      "  Pricing with confidence: a short video of 2:00, in 2026-10-14 Pricing talk (Mac Studio)",
      "    Shown in Final Cut: v2, on Mac Studio",
      "  Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio)"
    ].join("\n")), r.text);
    assert.ok(!r.text.includes("Old"), r.text);
    t.done();
  });
  it("names a missing file and a conflicted copy under the episode they are in", async () => {
    const t = setup();
    const { path } = t.episode("2026-10-13 Talk (Mac Studio)");
    rmSync(join(path, "Talk.cut-plan.txt"));
    const other = t.episode("2026-10-14 Pricing talk (Mac Studio)");
    writeFileSync(join(other.path, "Talk (Jason Ogden's conflicted copy 2026-10-14).mov"), "x");
    const r = await t.run("episodes");
    assert.ok(r.text.includes("  Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio)\n    Not right: Talk.cut-plan.txt is missing"), r.text);
    assert.ok(r.text.includes("  2026-10-14 Pricing talk (Mac Studio)\n    Not right: Dropbox has kept a conflicted copy in this episode: Talk (Jason Ogden's conflicted copy 2026-10-14).mov."), r.text);
    t.done();
  });
  it("lists the videos waiting in each drop folder, for how long, and one already imported", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    const laptop = join(t.root, "Unedited Video", "Sallie's laptop");
    mkdirSync(laptop, { recursive: true });
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "x".repeat(5));
    writeFileSync(join(laptop, "Budget.mov"), "budget");
    utimesSync(join(laptop, "Budget.mov"), new Date(NOW - 25 * 60000), new Date(NOW - 25 * 60000));
    utimesSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), new Date(NOW - 2 * 3600000), new Date(NOW - 2 * 3600000));
    const r = await t.run("episodes");
    assert.ok(r.text.includes([
      "Waiting in the drop folders:",
      "  Talk.mov, in Mac Studio's, for 2 hours: already imported as 2026-10-13 Talk (Mac Studio). It stays in the drop folder until its late check passes, or for a person to delete.",
      "  Budget.mov, in Sallie's laptop's, for 25 minutes"
    ].join("\n")), r.text);
    t.done();
  });
  it("lists an import that is running, one that stopped, one that failed and one with a problem", async () => {
    const t = setup();
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder);
    const status = (video, machine, more) => writeFileSync(join(folder, `${video} (${machine}) 1.json`), JSON.stringify({ version: 1, machine, pid: 1, video, bytes: 5, seconds: 120, step: "Making the rough cut", at: new Date(NOW - 60000).toISOString(), ...more }));
    status("A.mov", "Mac Studio", {});
    status("B.mov", "Sallie's laptop", { at: new Date(NOW - 30 * 60000).toISOString() });
    status("C.mov", "Mac Studio", { failed: "the transcriber stopped" });
    status("D.mov", "Mac Studio", { problem: "Talk.rough-cut.mp4 is short" });
    const r = await t.run("episodes");
    assert.ok(r.text.includes([
      "Imports:",
      "  A.mov: being imported on Mac Studio, at Making the rough cut",
      "  B.mov: stopped on Sallie's laptop at Making the rough cut, 30 minutes ago",
      "  C.mov: its import failed on Mac Studio: the transcriber stopped",
      "  D.mov: copied in on Mac Studio, but the late check found a problem: Talk.rough-cut.mp4 is short"
    ].join("\n")), r.text);
    t.done();
  });
  it("shows each library on this Mac with its size, and the free space on the disk", async () => {
    const t = setup();
    const library = libraryFor(t.home, "2026-10-13 Talk (Mac Studio)");
    mkdirSync(join(library, "Event"), { recursive: true });
    writeFileSync(join(library, "Event", "media"), "x".repeat(3 * 2 ** 20));
    const r = await t.run("episodes");
    assert.ok(r.text.endsWith(["On this Mac:", "  2026-10-13 Talk (Mac Studio).fcpbundle: 3.0 MB", "  Free on the disk: 300 GB"].join("\n")), r.text);
    t.done();
  });
  it("says there are none yet when there are none", async () => {
    const t = setup();
    const r = await t.run("episodes");
    assert.ok(r.text.startsWith("No episodes yet."), r.text);
    t.done();
  });
});
