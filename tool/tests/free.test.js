// Taking an episode's working copy and renders away (plan PR 15; architecture 2026-10-27, sections 6.1 and 7.4, and risk 10). free.js
// deletes files, so these tests are about what it may delete before they are about what it does: every path it removes is a
// named path under BRIMM Video Work, and nothing it is not meant to touch moves. Each test makes a folder of its own in the
// system's temporary folder, with a home, a Dropbox root and a Downloads folder inside it, and takes it away again when it ends;
// nothing here touches the real home, Dropbox or Downloads, and no test runs a program (`running` is given).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { localStamp } from "../episode.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { freeEpisode, freePaths, hyperFramesRunning } from "../free.js";
import { sizeText } from "../kinds.js";
import { episodeWork } from "../settings.js";
import { workCopyDir, workCopyLockOf, workCopyPaths } from "../workcopy.js";

const FOLDER = "2026-10-28 Pricing talk (Mac Studio)";
const MAIN = "Pricing talk main 3fa9c1";
const KEPT = "Pricing talk main 2 3fa9c1";
const REEL = "Pricing talk reel 2 3fa9c1";
const CLIP = "Session clip 1 3fa9c1";
const UNLISTED = "Pricing talk main 9 3fa9c1";
const NOTHING = "There is nothing to take away for Pricing talk on this Mac.";
/** What an export leaves in a project's renders: where it went. */
const META = "{\"exportedTo\":\"somewhere\"}";
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnode\b|\bnpx\b|edit\.js|workcopy|hyperframes\.mjs/;

/** Write a file, and the folders above it. */
const put = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
/** Move a folder to `to` and leave a link to it where it was. */
function moveAndLink(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  symlinkSync(to, from);
}
/** A folder's whole contents as { path from it: text, or "dir", or "-> where a link leads" }: a link is not followed. */
function treeOf(dir) {
  const out = {};
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      const rel = relative(dir, path);
      if (entry.isSymbolicLink()) out[rel] = `-> ${readlinkSync(path)}`;
      else if (entry.isDirectory()) {
        out[rel] = "dir";
        walk(path);
      } else out[rel] = readFileSync(path, "utf8");
    }
  };
  walk(dir);
  return out;
}
/** What the tree of a folder holds under one name. */
const under = (tree, name) => Object.fromEntries(Object.entries(tree).filter(([rel]) => rel === name || rel.startsWith(`${name}/`)));

/** An entry of the record's `app.projects`, made from a recording of `raw`'s size and time. */
const entry = (key, name, raw, over = {}) => ({
  key, name, madeAt: "2026-10-28T10:00:00-04:00", on: "Mac Studio", from: { file: "Talk.mov", bytes: raw.bytes, modified: raw.modified },
  workingCopy: { bytes: 4000, seconds: 23.4, fps: 30 }, opened: ["2026-10-28T10:05:00-04:00"], handover: false, fromSuggestion: null, state: "opened", ...over
});

/** A made-up Mac in a folder of its own: its home (BRIMM Video Work with a toolchain in it, and Downloads with an export in it), the
    Dropbox root with the episode in it (the recording, an export in final/), and the episode's work folder holding the working
    copy and five project folders: the main project, one kept for an earlier kind, a Reel's, a session clip's, and one the record
    does not list. The record names the first four. `ctx` is what edit.js gives a command, as far as free.js reads it. */
function world(c, { names = [KEPT, MAIN, REEL, CLIP, UNLISTED], listed = [KEPT, MAIN, REEL, CLIP], copies = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-free-"));
  c.after(() => rmSync(dir, { recursive: true, force: true }));
  const home = join(dir, "home");
  const root = join(dir, "Dropbox", "BRIMM Video");
  const episode = join(root, "Episodes", FOLDER);
  const work = episodeWork(home, FOLDER);
  const downloads = join(home, "Downloads");
  const raw = join(episode, "Talk.mov");
  put(raw, "the raw video");
  put(join(episode, "final", "Pricing talk main.mp4"), "an export in final");
  put(join(downloads, "Pricing talk main 3fa9c1_2026-10-28_11-00.mp4"), "an export in Downloads");
  const toolchain = join(home, "BRIMM Video Work", ".toolchain", "hyperframes-0.8.208", "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  put(toolchain, "the pinned command line");
  const stat = statSync(raw);
  const made = { bytes: stat.size, modified: localStamp(new Date(stat.mtimeMs)) };
  const key = `${stat.size}-${Math.floor(stat.mtimeMs)}`;
  if (copies) {
    put(join(work, "working copy", `${key}.mp4`), "c".repeat(1500));
    put(join(work, "working copy", `${key}.json`), "{}");
  }
  /** A project folder, as the writer makes one and the app and its agent go on with it: its text files, what the app keeps in
      `.hyperframes/`, its video and its renders; and beside them files that only look like what free takes. */
  const project = (name) => {
    const at = join(work, name);
    for (const file of ["index.html", "meta.json", "hyperframes.json", "package.json", "transcript.json", "CLAUDE.md", "AGENTS.md", ".claude/settings.json", "brimm/facts.json", "brimm/cut-suggestions.json", "brimm/brand.md", "compositions/title.html", "assets/fonts/Allison-Regular.ttf", "vendor/gsap.min.js", ".hyperframes/app-history.jsonl", ".hyperframes/transcripts/t.json"]) put(join(at, file), `${name}: ${file}`);
    put(join(at, "media", "recording.mp4"), "v".repeat(2000));
    put(join(at, "renders", "draft.mp4"), "r".repeat(300));
    put(join(at, "renders", "draft_2026-10-28_11-00.meta.json"), META);
    put(join(at, "renders", "frames", "0001.png"), "p".repeat(50));
    put(join(at, "media", "recording.mp4.bak"), "decoy");
    put(join(at, "media", "other.mp4"), "decoy");
    put(join(at, "renders-old", "old.mp4"), "decoy");
    put(join(at, "renders.txt"), "decoy");
    mkdirSync(join(at, "node_modules", ".bin"), { recursive: true });
    symlinkSync(toolchain, join(at, "node_modules", ".bin", "hyperframes"));
    return at;
  };
  for (const name of names) project(name);
  put(join(work, "working copy 2", "decoy.mp4"), "decoy");
  put(join(work, "workcopy.result.json"), "{}");
  put(join(work, "pushed", "main.v1.fcpxml"), "<fcpxml/>");
  const projects = listed.map((name) => entry(name === CLIP ? "clip 1" : name === REEL ? "reel 2" : "main", name, made, name === KEPT ? { state: "kept for an earlier kind" } : name === REEL ? { fromSuggestion: 2 } : {}));
  const record = { id: "e-20261028-3fa9c1", rev: 4, kind: "raw", name: { text: "Pricing talk", placeholder: false }, video: { file: "Talk.mov", bytes: stat.size, seconds: 23.4 }, app: { toolchain: "0.8.208", projects } };
  const said = [];
  const ctx = { home, machine: "Mac Studio", root, now: () => Date.parse("2026-10-28T15:00:00-04:00"), alive: () => false, say: (line) => said.push(line), stat: (path) => statSync(path, { throwIfNoEntry: false }) };
  const found = { name: FOLDER, folder: episode };
  const removed = [];
  const deps = { running: async () => false, rm: (path, options) => (removed.push(path), rmSync(path, options)) };
  const run = (over = {}, rec = record) => freeEpisode(ctx, { found, record: rec }, { ...deps, ...over });
  return { dir, home, root, episode, work, downloads, raw, key, stat, made, record, ctx, found, said, removed, deps, run, project, projects };
}

describe("freePaths: the paths free names", () => {
  const record = (projects) => ({ app: { toolchain: "0.8.208", projects } });
  const RAW = { bytes: 13, modified: "2026-10-28T09:00:00-04:00" };
  it("names the folder of copies, and for each project of the record but a session clip's its video and its renders, and nothing else", () => {
    const projects = [entry("main", KEPT, RAW, { state: "kept for an earlier kind" }), entry("main", MAIN, RAW), entry("reel 2", REEL, RAW), entry("clip 1", CLIP, RAW)];
    const work = "/h/BRIMM Video Work/F";
    assert.deepEqual(freePaths("/h", "F", record(projects)), {
      work,
      copies: `${work}/working copy`,
      projects: [KEPT, MAIN, REEL].map((name) => ({ key: projects.find((p) => p.name === name).key, name, dir: `${work}/${name}`, video: `${work}/${name}/media/recording.mp4`, renders: `${work}/${name}/renders` }))
    });
  });
  it("leaves out a project whose name is not one plain folder name, and one that has a session clip's name", () => {
    const names = ["..", ".", "", "a/b", "../../Downloads", "x\0y", 7, undefined];
    const projects = [...names.map((name, i) => entry(i % 2 ? "main" : "reel 2", name, RAW)), entry("clip 1", CLIP, RAW), entry("main", CLIP, RAW), entry("main", MAIN, RAW)];
    assert.deepEqual(freePaths("/h", "F", record(projects)).projects.map((p) => p.name), [MAIN]);
  });
  it("names the folder of copies alone for a record with no projects, and for a record with no app at all", () => {
    const alone = { work: "/h/BRIMM Video Work/F", copies: "/h/BRIMM Video Work/F/working copy", projects: [] };
    assert.deepEqual(freePaths("/h", "F", {}), alone);
    assert.deepEqual(freePaths("/h", "F", record([])), alone);
  });
  it("names the projects of the main video and of Reels alone: a key it does not know takes nothing", () => {
    const projects = ["story 1", "reel 0", "reel", "main 2", "clip 0", "Main", ""].map((key, i) => entry(key, `Other ${i}`, RAW));
    assert.deepEqual(freePaths("/h", "F", record([...projects, entry("reel 12", REEL, RAW)])).projects.map((p) => p.name), [REEL]);
  });
  it("names one project once, however often the record lists it", () => {
    assert.deepEqual(freePaths("/h", "F", record([entry("main", MAIN, RAW), entry("main", MAIN, RAW)])).projects.map((p) => p.name), [MAIN]);
  });
  it("is given an episode's folder that is one name, as the working copy's paths are", () => {
    for (const folder of ["", ".", "..", "a/b", "../x"]) assert.throws(() => freePaths("/h", folder, {}), /not the name of one/, JSON.stringify(folder));
  });
});

describe("workCopyDir: the folder of the copies", () => {
  it("is the folder the copies' paths are in, and is told one name only", () => {
    const paths = workCopyPaths("/h", "F", "12-34");
    assert.equal(workCopyDir("/h", "F"), paths.dir);
    assert.equal(workCopyDir("/h", "F"), dirname(paths.video));
    for (const folder of ["", ".", "..", "a/b"]) assert.throws(() => workCopyDir("/h", folder), /not the name of one/, JSON.stringify(folder));
  });
});

describe("free: what it takes", () => {
  it("takes the video and renders of each project but a session clip's, and the folder of copies, and nothing else; each file stays as it was", async (c) => {
    const w = world(c);
    const before = treeOf(w.work);
    const around = [treeOf(w.episode), treeOf(w.downloads), treeOf(join(w.home, "BRIMM Video Work", ".toolchain"))];
    assert.equal(await w.run(), 0, w.said.join("\n"));
    const after = treeOf(w.work);
    const taken = [MAIN, KEPT, REEL].flatMap((name) => [`${name}/media/recording.mp4`, `${name}/renders`, `${name}/renders/draft.mp4`, `${name}/renders/draft_2026-10-28_11-00.meta.json`, `${name}/renders/frames`, `${name}/renders/frames/0001.png`]);
    const copies = Object.keys(before).filter((rel) => rel === "working copy" || rel.startsWith("working copy/"));
    assert.equal(copies.length, 3);
    assert.deepEqual(Object.keys(before).filter((rel) => !(rel in after)).sort(), [...taken, ...copies].sort());
    for (const [rel, text] of Object.entries(after)) assert.equal(before[rel], text, rel);
    // Nothing in Dropbox, in Downloads or in the toolchain moved.
    assert.deepEqual([treeOf(w.episode), treeOf(w.downloads), treeOf(join(w.home, "BRIMM Video Work", ".toolchain"))], around);
  });
  it("leaves a file that only looks like one it names, the text files, brimm/ and .hyperframes/ of a project, the clip's project whole, and a folder the record does not list", async (c) => {
    const w = world(c);
    const before = treeOf(w.work);
    await w.run();
    const after = treeOf(w.work);
    for (const name of [MAIN, KEPT, REEL]) {
      for (const stays of ["media/recording.mp4.bak", "media/other.mp4", "renders-old/old.mp4", "renders.txt", "index.html", "meta.json", "transcript.json", "brimm/facts.json", "brimm/cut-suggestions.json", ".hyperframes/app-history.jsonl", ".hyperframes/transcripts/t.json", "compositions/title.html", "assets/fonts/Allison-Regular.ttf", "vendor/gsap.min.js", ".claude/settings.json", "CLAUDE.md", "AGENTS.md", "node_modules/.bin/hyperframes"]) {
        assert.ok(`${name}/${stays}` in after, `${name}/${stays}`);
        assert.equal(after[`${name}/${stays}`], before[`${name}/${stays}`], `${name}/${stays}`);
      }
    }
    for (const name of [CLIP, UNLISTED]) {
      assert.deepEqual(under(after, name), under(before, name), name);
      assert.equal(after[`${name}/media/recording.mp4`], "v".repeat(2000));
      assert.equal(after[`${name}/renders/draft.mp4`], "r".repeat(300));
    }
    for (const other of ["working copy 2/decoy.mp4", "workcopy.result.json", "pushed/main.v1.fcpxml"]) assert.equal(after[other], before[other], other);
  });
  it("is given each path to remove by name, the videos first, then the renders, then the folder of copies, all inside the work folder's real path", async (c) => {
    const w = world(c);
    const real = realpathSync(join(w.home, "BRIMM Video Work"));
    await w.run();
    const at = (path) => join(real, FOLDER, path);
    assert.deepEqual(w.removed, [
      ...[KEPT, MAIN, REEL].map((name) => at(`${name}/media/recording.mp4`)),
      ...[KEPT, MAIN, REEL].map((name) => at(`${name}/renders`)),
      at("working copy")
    ]);
    for (const path of w.removed) assert.ok(path.startsWith(`${real}${sep}`), path);
  });
  it("skips what is not there: the video of a project already without one, the renders of one without renders, a project whose folder is gone; a second run takes nothing", async (c) => {
    const w = world(c);
    rmSync(join(w.work, MAIN, "media", "recording.mp4"));
    rmSync(join(w.work, KEPT, "renders"), { recursive: true });
    rmSync(join(w.work, REEL), { recursive: true });
    assert.equal(await w.run(), 0, w.said.join("\n"));
    const first = treeOf(w.work);
    w.said.length = 0;
    assert.equal(await w.run(), 0);
    assert.deepEqual(w.said, [NOTHING]);
    assert.deepEqual(treeOf(w.work), first);
  });
  it("says there is nothing to take away for an episode with no work folder at all, and for one whose projects are a session clip's alone", async (c) => {
    const w = world(c);
    rmSync(w.work, { recursive: true });
    assert.equal(await w.run(), 0);
    assert.deepEqual(w.said, [NOTHING]);
    const clips = world(c, { names: [CLIP], listed: [CLIP], copies: false });
    const before = treeOf(clips.work);
    assert.equal(await clips.run(), 0);
    assert.deepEqual(clips.said, [NOTHING]);
    assert.deepEqual(treeOf(clips.work), before);
  });
  it("takes the folder of copies of an episode that has no project, whether or not its Mac is set up for the app", async (c) => {
    const w = world(c);
    assert.equal(await w.run({}, { ...w.record, app: undefined }), 0);
    assert.equal(existsSync(join(w.work, "working copy")), false);
    assert.equal(existsSync(join(w.work, MAIN, "media", "recording.mp4")), true);
    assert.deepEqual(w.said, ["Took away the video made for HyperFrames for Pricing talk. That gave back 1.5 KB on this Mac."]);
  });
});

describe("free: the room it gives back, in words", () => {
  it("says how much it gave back, what it took, that the projects stay, and how the video is made again", async (c) => {
    const w = world(c);
    const before = treeOf(w.work);
    await w.run();
    const after = treeOf(w.work);
    const gone = Object.entries(before).filter(([rel, text]) => !(rel in after) && text !== "dir");
    const bytes = gone.reduce((sum, [, text]) => sum + Buffer.byteLength(text), 0);
    assert.equal(bytes, 3 * (2000 + 300 + Buffer.byteLength(META) + 50) + 1500 + 2);
    assert.deepEqual(w.said, [
      `Took away the video made for HyperFrames and what HyperFrames rendered for Pricing talk. That gave back ${sizeText(bytes)} on this Mac.`,
      "Its HyperFrames projects, and everything done in them, stay.",
      'Say "open Pricing talk in HyperFrames" when you want it again: the video is made again then.'
    ]);
  });
  it("names only what it took, and says the project stays in the singular for one project", async (c) => {
    const renders = world(c, { names: [MAIN], listed: [MAIN], copies: false });
    rmSync(join(renders.work, MAIN, "media", "recording.mp4"));
    rmSync(join(renders.work, MAIN, "renders"), { recursive: true });
    put(join(renders.work, MAIN, "renders", "draft.mp4"), "r".repeat(2048));
    assert.equal(await renders.run(), 0);
    assert.deepEqual(renders.said, ["Took away what HyperFrames rendered for Pricing talk. That gave back 2.0 KB on this Mac.", "Its HyperFrames project, and everything done in it, stays."]);
    const video = world(c, { names: [MAIN], listed: [MAIN], copies: false });
    rmSync(join(video.work, MAIN, "renders"), { recursive: true });
    put(join(video.work, MAIN, "media", "recording.mp4"), "v".repeat(3 * 1024 * 1024));
    assert.equal(await video.run(), 0);
    assert.deepEqual(video.said, ["Took away the video made for HyperFrames for Pricing talk. That gave back 3.0 MB on this Mac.", "Its HyperFrames project, and everything done in it, stays.", 'Say "open Pricing talk in HyperFrames" when you want it again: the video is made again then.']);
  });
  it("does not count a link, or what a link leads to, in the room it gave back", async (c) => {
    const w = world(c, { names: [MAIN], listed: [MAIN], copies: false });
    rmSync(join(w.work, MAIN, "media", "recording.mp4"));
    rmSync(join(w.work, MAIN, "renders"), { recursive: true });
    put(join(w.work, MAIN, "renders", "draft.mp4"), "r".repeat(1024));
    put(join(w.dir, "big.mp4"), "b".repeat(5 * 1024 * 1024));
    symlinkSync(join(w.dir, "big.mp4"), join(w.work, MAIN, "renders", "big.mp4"));
    assert.equal(await w.run(), 0);
    assert.equal(w.said[0], "Took away what HyperFrames rendered for Pricing talk. That gave back 1.0 KB on this Mac.");
    assert.equal(existsSync(join(w.dir, "big.mp4")), true);
  });
  it("says nothing that holds a path, a flag or the name of a command, whichever way it ends", async (c) => {
    const lines = [];
    const w = world(c);
    await w.run();
    lines.push(...w.said);
    for (const over of [{ running: async () => true }, { running: async () => { throw new Error("pgrep"); } }]) {
      const m = world(c);
      await m.run(over);
      lines.push(...m.said);
    }
    const held = world(c);
    await held.run({}, { ...held.record, editing: { by: "Sallie's laptop", since: "2026-10-28T09:00:00-04:00" } });
    lines.push(...held.said);
    const gone = world(c);
    rmSync(gone.raw);
    await gone.run();
    lines.push(...gone.said);
    assert.ok(lines.length >= 7, lines.join("\n"));
    for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
  });
});

describe("free: only in this Mac's work folder", () => {
  const NOT_AS_MADE = "The folder for Pricing talk on this Mac is not as it was made, so nothing was taken away. Ask Jason.";
  /** A folder outside the work folder with a project's shape in it: a video and renders of its own, which the links lead to. */
  function outside(w) {
    const at = join(w.dir, "outside");
    put(join(at, "project", "media", "recording.mp4"), "someone else's video");
    put(join(at, "project", "renders", "keep.mp4"), "someone else's render");
    put(join(at, "renders", "keep.mp4"), "someone else's render");
    put(join(at, "copies", "keep.mp4"), "someone else's copy");
    put(join(at, "media", "recording.mp4"), "someone else's video");
    put(join(at, "video.mp4"), "someone else's file");
    return at;
  }
  /** What must not have moved when it refuses: the work folder, the episode in Dropbox, Downloads, and the folder the links lead to. */
  const around = (w, out) => [treeOf(w.work), treeOf(w.episode), treeOf(w.downloads), treeOf(out), treeOf(join(w.root, ".."))];
  const cases = {
    "the work folder is a link to a folder in Dropbox": (w) => moveAndLink(join(w.home, "BRIMM Video Work"), join(w.root, "Somewhere")),
    "the work folder is a link into a drop folder, which the launch agent watches": (w) => moveAndLink(join(w.home, "BRIMM Video Work"), join(w.root, "Unedited Video", "Mac Studio", "BRIMM Video Work")),
    "the work folder is a link to a folder anywhere else": (w) => moveAndLink(join(w.home, "BRIMM Video Work"), join(w.dir, "elsewhere")),
    "the work folder is a link to Downloads": (w) => moveAndLink(join(w.home, "BRIMM Video Work"), join(w.downloads, "BRIMM Video Work")),
    "the episode's own work folder is a link": (w, out) => moveAndLink(w.work, join(out, "episode")),
    "a project's folder is a link to a folder with a project's shape": (w, out) => {
      rmSync(join(w.work, MAIN), { recursive: true });
      symlinkSync(join(out, "project"), join(w.work, MAIN));
    },
    "a project's media folder is a link": (w, out) => {
      rmSync(join(w.work, MAIN, "media"), { recursive: true });
      symlinkSync(join(out, "media"), join(w.work, MAIN, "media"));
    },
    "a project's renders folder is a link": (w, out) => {
      rmSync(join(w.work, MAIN, "renders"), { recursive: true });
      symlinkSync(join(out, "renders"), join(w.work, MAIN, "renders"));
    },
    "a project's video is a link": (w, out) => {
      rmSync(join(w.work, MAIN, "media", "recording.mp4"));
      symlinkSync(join(out, "video.mp4"), join(w.work, MAIN, "media", "recording.mp4"));
    },
    "the folder of copies is a link": (w, out) => {
      rmSync(join(w.work, "working copy"), { recursive: true });
      symlinkSync(join(out, "copies"), join(w.work, "working copy"));
    },
    "a project's renders is a file, not a folder": (w) => {
      rmSync(join(w.work, MAIN, "renders"), { recursive: true });
      put(join(w.work, MAIN, "renders"), "a file");
    },
    "a project's video is a folder, not a file": (w) => {
      rmSync(join(w.work, MAIN, "media", "recording.mp4"));
      mkdirSync(join(w.work, MAIN, "media", "recording.mp4"));
    }
  };
  for (const [what, make] of Object.entries(cases)) {
    it(`refuses, takes nothing, and leaves Downloads, Dropbox and the folder a link leads to as they were, when ${what}`, async (c) => {
      const w = world(c);
      const out = outside(w);
      make(w, out);
      const before = around(w, out);
      assert.equal(await w.run(), 1, w.said.join("\n"));
      assert.deepEqual(w.said, [NOT_AS_MADE]);
      assert.deepEqual(w.removed, [], "no path was given to rm");
      assert.deepEqual(around(w, out), before);
    });
  }
  it("refuses when the work folder is inside the BRIMM Video root, though it is where it should be in the home", async (c) => {
    const w = world(c);
    const before = [treeOf(w.work), treeOf(w.episode)];
    w.ctx.root = w.dir;
    assert.equal(await w.run(), 1, w.said.join("\n"));
    assert.deepEqual([w.said, w.removed, treeOf(w.work), treeOf(w.episode)], [[NOT_AS_MADE], [], ...before]);
  });
  it("does not follow a link inside renders: the folder goes with the link in it, and what the link led to stays", async (c) => {
    const w = world(c);
    const out = outside(w);
    const export_ = join(w.downloads, "Pricing talk main 3fa9c1_2026-10-28_11-00.mp4");
    symlinkSync(out, join(w.work, MAIN, "renders", "latest"));
    symlinkSync(export_, join(w.work, MAIN, "renders", "export.mp4"));
    const kept = [treeOf(out), treeOf(w.downloads)];
    assert.equal(await w.run(), 0, w.said.join("\n"));
    assert.equal(existsSync(join(w.work, MAIN, "renders")), false);
    assert.deepEqual([treeOf(out), treeOf(w.downloads)], kept);
  });
  it("never joins a project's name to the work folder when it leads anywhere else: Downloads, the folders above and a folder in Dropbox stay", async (c) => {
    const w = world(c, { names: [], listed: [], copies: false });
    // Where each hostile name would lead, with what free takes from a project put there.
    const places = [join(w.home, "BRIMM Video Work"), w.work, join(w.work, "a", "b"), w.home, w.downloads, w.episode];
    for (const at of places) {
      put(join(at, "media", "recording.mp4"), `must stay: ${at}`);
      put(join(at, "renders", "must-stay.mp4"), `must stay: ${at}`);
    }
    const names = ["..", ".", "", "a/b", "../..", relative(w.work, w.downloads), relative(w.work, w.episode)];
    const hostile = names.map((name, i) => entry(i % 2 ? "main" : "reel 2", name, w.made));
    const before = [treeOf(w.home), treeOf(w.root)];
    assert.equal(await w.run({}, { ...w.record, app: { toolchain: "0.8.208", projects: hostile } }), 0, w.said.join("\n"));
    assert.deepEqual(w.removed, []);
    assert.deepEqual([treeOf(w.home), treeOf(w.root)], before);
    assert.deepEqual(w.said, [NOTHING]);
  });
  it("is given a real path each time, so that a link in the way cannot lead rm elsewhere", async (c) => {
    const w = world(c);
    await w.run();
    assert.ok(w.removed.length > 0);
    for (const path of w.removed) assert.equal(path, join(realpathSync(dirname(path)), basename(path)), path);
  });
  it("goes on when the home is itself reached by a link, as a temporary folder is on a Mac: the work folder's real path is what counts", async (c) => {
    const w = world(c);
    const linked = join(w.dir, "home-link");
    symlinkSync(w.home, linked);
    const via = { ...w.ctx, home: linked };
    assert.equal(await freeEpisode(via, { found: w.found, record: w.record }, w.deps), 0, w.said.join("\n"));
    assert.equal(existsSync(join(w.work, "working copy")), false);
  });
});

describe("free: what makes it refuse, before it takes anything", () => {
  const HELD = "Sallie's laptop has Pricing talk open. Open it here first (say \"take it over\" if they are done with it). Nothing was changed.";
  const QUIT = "Quit HyperFrames first, then ask again. Nothing was taken away.";
  it("refuses while the other Mac has the episode, in the words every command that changes an episode uses", async (c) => {
    const w = world(c);
    const before = treeOf(w.work);
    assert.equal(await w.run({}, { ...w.record, editing: { by: "Sallie's laptop", since: "2026-10-28T09:00:00-04:00" } }), 1);
    assert.deepEqual([w.said, w.removed, treeOf(w.work)], [[HELD], [], before]);
  });
  it("goes on when this Mac is the one that has the episode", async (c) => {
    const w = world(c);
    assert.equal(await w.run({}, { ...w.record, editing: { by: "Mac Studio", since: "2026-10-28T09:00:00-04:00" } }), 0, w.said.join("\n"));
  });
  it("refuses while HyperFrames is running, asking after that program alone, and when it cannot tell", async (c) => {
    const asked = [];
    const w = world(c);
    const before = treeOf(w.work);
    assert.equal(await w.run({ running: async (name) => (asked.push(name), true) }), 1);
    assert.deepEqual([w.said, asked, w.removed, treeOf(w.work)], [[QUIT], ["HyperFrames"], [], before]);
    const cannot = world(c);
    assert.equal(await cannot.run({ running: async () => { throw new Error("no answer"); } }), 1);
    assert.deepEqual([cannot.said, cannot.removed], [[QUIT], []]);
    const plain = world(c);
    assert.equal(await plain.run({ running: () => true }), 1, "an answer that is not a promise counts too");
  });
  it("refuses while the working copy is being made, and while any other run is at work on the episode", async (c) => {
    const COPY = 'The video for HyperFrames is being made for Pricing talk. Say "how far is it?", and ask again when it is done. Nothing was taken away.';
    const OTHER = 'Something is still at work on Pricing talk. Say "how far is it?", and ask again when it is done. Nothing was taken away.';
    for (const [lock, command, words] of [[workCopyLockOf, "workcopy", COPY], [lockOf, "read", OTHER], [lockOf, "finish", OTHER], [lockOf, "bring", OTHER]]) {
      const w = world(c);
      assert.equal(takeEpisodeLock(lock(w.home, FOLDER), command, () => true).taken, true);
      w.ctx.alive = (pid) => pid === process.pid;
      const before = treeOf(w.work);
      assert.equal(await w.run(), 1, command);
      assert.deepEqual([w.said, w.removed], [[words], []], command);
      assert.deepEqual(treeOf(w.work), before, command);
    }
  });
  it("counts a lock left by a run that died as none", async (c) => {
    const w = world(c);
    assert.equal(takeEpisodeLock(lockOf(w.home, FOLDER), "read", () => true).taken, true);
    w.ctx.alive = () => false;
    assert.equal(await w.run(), 0, w.said.join("\n"));
  });
  it("refuses when the recording is not in the episode: the video could not be made again", async (c) => {
    const WORDS = "The recording of Pricing talk is not in its folder, so the video made from it could not be made again. Nothing was taken away.";
    const w = world(c);
    rmSync(w.raw);
    const before = treeOf(w.work);
    assert.equal(await w.run(), 1);
    assert.deepEqual([w.said, w.removed, treeOf(w.work)], [[WORDS], [], before]);
    const folder = world(c);
    rmSync(folder.raw);
    mkdirSync(folder.raw);
    assert.equal(await folder.run(), 1, "a folder at the recording's name is not the recording");
    assert.deepEqual(folder.said, [WORDS]);
  });
  it("refuses to take the folder of copies of an episode whose recording is not in it, though no project is made from it", async (c) => {
    const w = world(c);
    rmSync(w.raw);
    const before = treeOf(w.work);
    assert.equal(await w.run({}, { ...w.record, app: undefined }), 1);
    assert.deepEqual([w.removed, treeOf(w.work)], [[], before]);
  });
  it("refuses when the recording has changed since a project was made: the video that project was made from could not be made again", async (c) => {
    const WORDS = "The recording of Pricing talk has changed since its HyperFrames project was made, so the video made from it could not be made again as it was. Nothing was taken away.";
    const older = new Date("2026-10-27T08:00:00-04:00");
    for (const change of [(w) => utimesSync(w.raw, older, older), (w) => writeFileSync(w.raw, "the raw video, longer")]) {
      const w = world(c);
      change(w);
      const before = treeOf(w.work);
      assert.equal(await w.run(), 1);
      assert.deepEqual([w.said, w.removed, treeOf(w.work)], [[WORDS], [], before]);
    }
  });
  it("does not ask for the recording when only renders are to go: a project already without its video can give its renders back", async (c) => {
    const w = world(c, { copies: false });
    for (const name of [MAIN, KEPT, REEL]) rmSync(join(w.work, name, "media", "recording.mp4"));
    rmSync(w.raw);
    assert.equal(await w.run(), 0, w.said.join("\n"));
    assert.deepEqual(w.removed.map((path) => basename(path)), ["renders", "renders", "renders"]);
    assert.equal(existsSync(join(w.work, MAIN, "renders")), false);
    assert.match(w.said[0], /^Took away what HyperFrames rendered for Pricing talk\. That gave back /);
  });
  it("looks at everything before it takes anything: a path that is not as it was made, found last, leaves every file", async (c) => {
    const w = world(c);
    moveAndLink(join(w.work, "working copy"), join(w.dir, "moved-copies"));
    const before = treeOf(w.work);
    assert.equal(await w.run(), 1);
    assert.deepEqual([w.removed, treeOf(w.work)], [[], before]);
  });
});

describe("free: whether HyperFrames is running, when nothing says", () => {
  it("asks pgrep for the program by its exact name, and counts it as running unless pgrep says there is none", () => {
    const asked = [];
    const answers = (status) => (cmd, args, options) => (asked.push([cmd, args, options]), { status });
    assert.equal(hyperFramesRunning(answers(0)), true);
    assert.equal(hyperFramesRunning(answers(1)), false);
    for (const status of [null, 2, 3, 127]) assert.equal(hyperFramesRunning(answers(status)), true, String(status));
    assert.deepEqual(asked[0], ["/usr/bin/pgrep", ["-x", "HyperFrames"], { stdio: "ignore" }]);
  });
});

describe("free: when one path cannot be taken", () => {
  it("stops there, says how much it took and ends with 1; the paths after it, and everything that stays, are still there", async (c) => {
    const w = world(c);
    let calls = 0;
    const failing = (path, options) => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      return rmSync(path, options);
    };
    const before = treeOf(w.work);
    assert.equal(await w.run({ rm: failing }), 1);
    assert.equal(calls, 2, "it stopped at the first failure");
    assert.deepEqual(w.said, ["Took away 2.0 KB, but part of it could not be taken away. Ask Jason."]);
    const after = treeOf(w.work);
    assert.equal(`${KEPT}/media/recording.mp4` in after, false);
    assert.equal(after[`${MAIN}/media/recording.mp4`], before[`${MAIN}/media/recording.mp4`]);
    assert.equal(after[`${REEL}/media/recording.mp4`], before[`${REEL}/media/recording.mp4`]);
    assert.ok("working copy" in after);
    assert.equal(after[`${MAIN}/index.html`], before[`${MAIN}/index.html`]);
  });
  it("says only that part could not be taken when the first path fails", async (c) => {
    const w = world(c);
    const before = treeOf(w.work);
    assert.equal(await w.run({ rm: () => { throw Object.assign(new Error("EACCES"), { code: "EACCES" }); } }), 1);
    assert.deepEqual([w.said, treeOf(w.work)], [["Part of it could not be taken away. Ask Jason."], before]);
  });
});
