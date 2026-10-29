// `release` for an episode edited in HyperFrames (plan PR 11; architecture 2026-10-27, sections 4.7, 7.3 and F12): it hands over a snapshot of
// each project of the record that is on this Mac, and the newest export of each, by the rule for writing into Dropbox. The Final Cut half
// of `release` is edit-two-macs.test.js's and edit-claim.test.js's, and does not change. edit.js is only the wiring: hand-over.js does the
// work and snapshot.js (snapshot.test.js) says what a snapshot holds. These tests run all of it through editMain, with a Mac Studio whose
// projects are in a temporary home, and no program: HyperFrames is a stand-in that is running or not.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { PIN } from "../hyperframes.js";
import { NAME } from "./episodes.js";
import { reasonOf } from "../hand-over.js";
import { LEFT_OUT_NOTE, MARKER, markerAsItIs, readMarker } from "../snapshot.js";
import { FOLDER, HELD, HERS, MAIN, REEL2, T1, entry, exportOf, fillProject, filesBelow, listAll, ms, releaseWorld, reread, snapshotListing, textOf } from "./snapshot-world.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|workcopy|\brelease\b/;
/** `release` as Claude runs it, and a check that every line it said, whichever way it ended, is plain. */
async function release(deps, ...words) {
  const r = await on(deps, "release", ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}
const KEEP = "Keep this Mac open and online until Dropbox shows the folder is up to date.";
const SAID = (what) => `${NAME} is handed over. Copied for the other Mac: ${what}. ${KEEP}`;
const BOTH = "its HyperFrames projects (the main video and Reel 2)";
const HELD_RELS = Object.keys(HELD).sort();

/** Every file under the projects of a made-up Mac, with its text and its time: what a release must leave as it was. */
function disk(w) {
  const out = {};
  for (const key of ["main", "reel 2"]) {
    for (const rel of filesBelow(w.dirOf(key))) {
      const at = join(w.dirOf(key), rel);
      out[`${key}/${rel}`] = [lstatSync(at).isSymbolicLink() ? "a link" : textOf(at), lstatSync(at).mtimeMs];
    }
  }
  return out;
}

describe("release: the projects of an episode edited in HyperFrames (group C)", () => {
  it("puts a snapshot of each project into the episode, by the rule, byte for byte and with the times the files have, and lists it in the record", async () => {
    const w = releaseWorld();
    const { t, found } = w;
    const before = disk(w);
    const r = await release(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(BOTH)]]);
    for (const project of [MAIN, REEL2]) {
      assert.deepEqual(snapshotListing(w, T1, project), HELD_RELS, project);
      for (const rel of HELD_RELS) {
        const at = join(found.folder, "app-snapshot", T1, project, rel);
        assert.equal(textOf(at), HELD[rel], `${project}/${rel}`);
        assert.equal(statSync(at).mtimeMs, ms(13, 40), `${project}/${rel}: it keeps its time`);
      }
    }
    // The record lists each file at its size, and what the other Mac waits for is that list.
    const record = reread(found);
    for (const project of [MAIN, REEL2]) for (const rel of HELD_RELS) assert.equal(record.files[`app-snapshot/${T1}/${project}/${rel}`], Buffer.byteLength(HELD[rel]), rel);
    assert.deepEqual(record.released.files, record.files);
    assert.deepEqual([record.rev, record.editing, record.released.by], [2, null, "Mac Studio"]);
    // Each project names the snapshot it was handed over as, and this Mac as its maker (snapshot.js MARKER); the rest is as it was.
    const after = disk(w);
    for (const key of ["main", "reel 2"]) {
      assert.deepEqual(readMarker(w.dirOf(key)), { snapshot: T1, by: "Mac Studio" }, key);
      delete after[`${key}/${MARKER}`];
    }
    assert.deepEqual(after, before, "the projects on this Mac's disk are as they were");
    t.done();
  });
  it("makes every file by a clone from the project (made outside, never over a file) and writes the record after all of them", async () => {
    const w = releaseWorld();
    const { t, found } = w;
    await release(t.ctx.deps, FOLDER);
    const snapshot = t.clones.filter(([, to]) => to.includes("app-snapshot"));
    assert.equal(snapshot.length, 2 * HELD_RELS.length);
    for (const [from, to] of snapshot) {
      assert.ok(from.startsWith(w.work), `${from} is made outside Dropbox`);
      assert.ok(to.startsWith(join(found.folder, "app-snapshot", T1)), to);
    }
    const last = t.clones.at(-1)[1];
    assert.equal(last, join(found.folder, "record", "0002.json"));
    assert.ok(t.clones.slice(0, -1).every(([, to]) => !to.includes("/record/")), "no record before the last clone");
    t.done();
  });
  it("writes only into the episode's folder: no drop folder, nothing in Downloads, no project in Dropbox", async () => {
    const w = releaseWorld();
    const { t, found, downloads } = w;
    exportOf(w, "main");
    const before = listAll(downloads);
    await release(t.ctx.deps, FOLDER);
    assert.ok(t.clones.every(([, to]) => to.startsWith(`${found.folder}/`)), "every clone is in the episode's folder");
    assert.deepEqual(readdirSync(t.root), ["Episodes"], "nothing beside the episodes: no drop folder is made or written into");
    assert.deepEqual(listAll(downloads), before);
    const under = listAll(join(found.folder, "app-snapshot"));
    for (const path of under) {
      const names = path.split("/").slice(2);
      assert.ok(!["media", "node_modules", "renders", "snapshots"].includes(names[0]) && !names.some((n) => n.startsWith(".")), path);
    }
    t.done();
  });
  it("says one project in the singular, and a Reel alone by its number", async () => {
    const one = releaseWorld({ projects: ["main"] });
    assert.deepEqual((await release(one.t.ctx.deps, FOLDER)).said, [SAID("its HyperFrames project (the main video)")]);
    one.t.done();
    const reel = releaseWorld({ projects: ["reel 2"] });
    assert.deepEqual((await release(reel.t.ctx.deps, FOLDER)).said, [SAID("its HyperFrames project (Reel 2)")]);
    reel.t.done();
  });
  it("hands over a Reel she dropped as well, since opening it again picks it again", async () => {
    const w = releaseWorld({ over: { reels: [{ n: 2, status: "dropped", from: 5.872, to: 9.843, title: "Say it again, better", why: "", files: [], pushed: [] }] } });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(BOTH)]]);
    assert.deepEqual(snapshotListing(w, T1, REEL2), HELD_RELS);
    w.t.done();
  });
  it("hands over none of a session clip's project, a project kept for an earlier kind, a name that leads elsewhere, or a folder that is a link", async () => {
    const projects = [
      entry("main"), entry("clip 1", { name: "Session clip 1 3fa9c1" }), entry("main", { name: "Pricing main kept", state: "kept for an earlier kind" }),
      entry("reel 3", { name: ".." }), entry("reel 4", { name: "a/b" }), entry("reel 5", { name: "Pricing reel 5 3fa9c1" })
    ];
    const w = releaseWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
    const { t, found } = w;
    for (const name of ["Session clip 1 3fa9c1", "Pricing main kept"]) fillProject(join(w.work, name));
    mkdirSync(join(t.dir, "elsewhere"), { recursive: true });
    writeFileSync(join(t.dir, "elsewhere", "index.html"), "not a project");
    symlinkSync(join(t.dir, "elsewhere"), join(w.work, "Pricing reel 5 3fa9c1"));
    const r = await release(t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID("its HyperFrames project (the main video)")]]);
    assert.deepEqual(readdirSync(join(found.folder, "app-snapshot", T1)), [MAIN]);
    t.done();
  });
  it("is today's release for an episode with no project of the record on this Mac: nothing in app-snapshot, and HyperFrames is not asked about", async () => {
    for (const w of [releaseWorld({ projects: null }), releaseWorld({ projects: ["main"], fill: false })]) {
      if (w.found && reread(w.found).app) rmSync(w.dirOf("main"), { recursive: true });
      let asked = 0;
      w.t.ctx.deps.running = async () => (asked++, false);
      const r = await release(w.t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [0, [`${NAME} is handed over. Copied for the other Mac: nothing. ${KEEP}`]]);
      assert.deepEqual([asked, existsSync(join(w.found.folder, "app-snapshot")), existsSync(join(w.found.folder, "edit", "from-hyperframes"))], [0, false, false]);
      w.t.done();
    }
  });
  it("hands an episode over that nobody has open when this Mac has a project of it, as it does one this Mac pushed last; the other Mac's claim still refuses it", async () => {
    const w = releaseWorld({ over: { editing: null } });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(BOTH)]]);
    w.t.done();
    const theirs = releaseWorld({ over: { editing: HERS } });
    const refused = await release(theirs.t.ctx.deps, FOLDER);
    assert.deepEqual([refused.code, refused.said], [1, [`Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`]]);
    assert.equal(existsSync(join(theirs.found.folder, "app-snapshot")), false);
    theirs.t.done();
  });
  it("hands over a Reel project once however often the record lists it, and one main project in use alone, as `app` opens one", async () => {
    const projects = [entry("main"), entry("reel 2"), entry("reel 2"), entry("main", { name: "Pricing- what to charge- main 2 3fa9c1" })];
    const w = releaseWorld({ projects: ["main", "reel 2"], over: { app: { toolchain: PIN.version, projects } } });
    fillProject(join(w.work, "Pricing- what to charge- main 2 3fa9c1"));
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(BOTH)]]);
    assert.deepEqual(readdirSync(join(w.found.folder, "app-snapshot", T1)).sort(), [MAIN, REEL2].sort());
    w.t.done();
  });
  it("hands over no later main project when the first one's folder is gone: `app` opens the first, so it is the one that counts (the review of PR 11, M7)", async () => {
    const later = "Pricing- what to charge- main 2 3fa9c1";
    const projects = [entry("main"), entry("main", { name: later })];
    const w = releaseWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
    fillProject(join(w.work, later));
    rmSync(w.dirOf("main"), { recursive: true });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`${NAME} is handed over. Copied for the other Mac: nothing. ${KEEP}`]]);
    assert.equal(existsSync(join(w.found.folder, "app-snapshot")), false, "nothing of the later main project is in the episode");
    w.t.done();
  });
  it("hands over none of a Reel project kept for an earlier kind", async () => {
    const projects = [entry("main"), entry("reel 3", { name: "Pricing reel 3 kept", state: "kept for an earlier kind" })];
    const w = releaseWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
    fillProject(join(w.work, "Pricing reel 3 kept"));
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID("its HyperFrames project (the main video)")]]);
    assert.deepEqual(readdirSync(join(w.found.folder, "app-snapshot", T1)), [MAIN]);
    w.t.done();
  });
  it("hands over nothing of a client or group session, whose mark is not cleared, even if the record lists a project for it", async () => {
    const mark = { marked: "2026-10-20T15:00:00-05:00", on: "Mac Studio", teachings: null, cleared: null };
    const w = releaseWorld({ kind: "session", over: { label: "Session, 2026-10-20", name: { text: "Session, 2026-10-20", placeholder: false }, session: mark } });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, ["Session, 2026-10-20 is handed over. Copied for the other Mac: nothing. Keep this Mac open and online until Dropbox shows the folder is up to date."]]);
    assert.equal(existsSync(join(w.found.folder, "app-snapshot")), false);
    w.t.done();
  });
  it("replaces a copy of an export that is there at the same size but that the record does not list, since nothing says it is the same file", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    mkdirSync(join(w.found.folder, "edit", "from-hyperframes"), { recursive: true });
    writeFileSync(join(w.found.folder, "edit", "from-hyperframes", main.name), "the export of mxxx");
    assert.equal(Buffer.byteLength("the export of mxxx"), Buffer.byteLength(textOf(main.path)));
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(`its HyperFrames project (the main video) and ${main.name}`)]]);
    assert.equal(textOf(join(w.found.folder, "edit", "from-hyperframes", main.name)), textOf(main.path));
    assert.equal(`edit/from-hyperframes/${main.name}` in reread(w.found).files, true);
    w.t.done();
  });
  it("says there is nothing to hand over when nobody has it open and this Mac has no project of it", async () => {
    const w = releaseWorld({ projects: ["main"], over: { editing: null }, fill: false });
    rmSync(w.dirOf("main"), { recursive: true });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`This Mac does not have ${NAME} open, so there is nothing to hand over.`]]);
    w.t.done();
  });
});

/** What this Mac's temporary folder does with names: whether it takes two spellings of a name for one folder, as the Mac's own volume does
    with case, and with an accent written composed or as a letter and a mark. A test about a folder named two ways runs only where that is
    so (free.test.js has the same probe). */
const volume = (() => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-release-volume-"));
  try {
    writeFileSync(join(dir, "aBc"), "");
    writeFileSync(join(dir, "café"), "");
    return { case: existsSync(join(dir, "ABC")), composition: existsSync(join(dir, "café")) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

describe("release: a session clip's folder is never handed over, however the record spells it (the review of PR 11, I4; PR 15's rule)", () => {
  const CLIP = "Session clip 1 3fa9c1";
  const ONE = "its HyperFrames project (the main video)";
  /** A world whose record lists the clip's folder as the clip's, and again as Reel 2's, under the spelling `alias`. */
  function aliased(alias, clip = CLIP) {
    const projects = [entry("main"), entry("clip 1", { name: clip }), entry("reel 2", { name: alias })];
    const w = releaseWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
    fillProject(join(w.work, clip));
    return w;
  }
  const handed = async (w) => {
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(ONE)]], r.text);
    assert.deepEqual(readdirSync(join(w.found.folder, "app-snapshot", T1)), [MAIN], "the clip's project is not in Dropbox");
    assert.equal(Object.keys(reread(w.found).files).some((rel) => rel.toLowerCase().includes("session clip")), false);
  };
  it("hands over nothing of a Reel whose project the record names as the clip's folder is named", async () => {
    const w = aliased(CLIP);
    await handed(w);
    w.t.done();
  });
  it("hands over nothing of a Reel whose project the record names in other case", { skip: volume.case ? false : "this volume tells names apart by case, so there is no second spelling of one folder" }, async () => {
    const alias = "SESSION CLIP 1 3FA9C1";
    const w = aliased(alias);
    assert.equal(existsSync(join(w.work, alias)), true, "this volume takes the other spelling for the clip's folder");
    await handed(w);
    w.t.done();
  });
  it("hands over nothing of a Reel whose name writes an accent as a letter and a mark", { skip: volume.composition ? false : "this volume tells composed and decomposed accents apart" }, async () => {
    const w = aliased("Session clip é 3fa9c1", "Session clip é 3fa9c1");
    await handed(w);
    w.t.done();
  });
  it("hands over nothing at all when a folder it has to tell from a session clip's cannot be looked at: it cannot be told what that folder is", async () => {
    // A name too long for the volume is a name no folder can have, so looking at it fails without anything being wrong with the disk.
    for (const key of ["clip 2", "main", "reel 3"]) {
      const projects = key === "main" ? [entry("main", { name: "x".repeat(300) })] : [entry("main"), entry("clip 1", { name: CLIP }), entry(key, { name: "x".repeat(300) })];
      const w = releaseWorld({ projects: ["main"], over: { app: { toolchain: PIN.version, projects } } });
      fillProject(join(w.work, CLIP));
      const before = [reread(w.found).rev, listAll(w.found.folder)];
      const r = await release(w.t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [`The folder for ${NAME} on this Mac is not as it was made, so nothing was handed over. Ask Jason.`]], key);
      assert.deepEqual([reread(w.found).rev, listAll(w.found.folder)], before, key);
      w.t.done();
    }
  });
});

describe("release: what it refuses before it writes anything (group E)", () => {
  /** What a refusal leaves as it was: the record, the episode's folder, the claim and the projects on this Mac's disk. */
  const state = (w) => ({ rev: reread(w.found).rev, editing: reread(w.found).editing, folder: listAll(w.found.folder), disk: disk(w), clones: w.t.clones.length });
  it("refuses while HyperFrames is open, and says to quit it", async () => {
    const w = releaseWorld();
    w.t.ctx.deps.running = async (name) => name === "HyperFrames";
    const before = state(w);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, ["Quit HyperFrames first, so that everything you did is saved, then say it again. Nothing was handed over."]]);
    assert.deepEqual(state(w), before);
    w.t.done();
  });
  it("refuses when nothing says whether HyperFrames is open: the check throws, or answers neither yes nor no", async () => {
    for (const running of [async () => { throw new Error("no pgrep"); }, async () => null, async () => undefined, () => "maybe"]) {
      const w = releaseWorld();
      w.t.ctx.deps.running = running;
      const before = state(w);
      const r = await release(w.t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, ["I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was handed over."]]);
      assert.deepEqual(state(w), before);
      w.t.done();
    }
  });
  it("refuses a project over the most it can hand over, in words that name its part and its size, and one over the most refuses them all", async () => {
    const w = releaseWorld();
    // 120 MB of files, not stored: the file is sparse.
    writeFileSync(join(w.dirOf("reel 2"), "compositions", "huge.html"), "x");
    truncateSync(join(w.dirOf("reel 2"), "compositions", "huge.html"), 120 * 1024 * 1024);
    const before = state(w);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for Reel 2 of ${NAME} is too big to hand over: 120 MB of files, and the most is 100 MB. Nothing was handed over. Ask Jason.`]]);
    assert.deepEqual(state(w), before, "the main project's snapshot is not made either");
    w.t.done();
    const main = releaseWorld({ projects: ["main"] });
    truncateSync(join(main.dirOf("main"), "index.html"), 150 * 1024 * 1024);
    assert.deepEqual((await release(main.t.ctx.deps, FOLDER)).said, [`The HyperFrames project for ${NAME} is too big to hand over: 150 MB of files, and the most is 100 MB. Nothing was handed over. Ask Jason.`]);
    main.t.done();
  });
  it("hands over a project of exactly the most", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const have = Object.values(HELD).reduce((sum, text) => sum + Buffer.byteLength(text), 0);
    writeFileSync(join(w.dirOf("main"), "compositions", "big.html"), "x");
    truncateSync(join(w.dirOf("main"), "compositions", "big.html"), 100 * 1024 * 1024 - have);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    w.t.done();
  });
  it("refuses a project that cannot be read, naming it", async () => {
    const w = releaseWorld({ projects: ["main"] });
    if (process.getuid && process.getuid() === 0) return w.t.done();
    chmodSync(join(w.dirOf("main"), "compositions"), 0o000);
    const before = state(w);
    const r = await release(w.t.ctx.deps, FOLDER);
    chmodSync(join(w.dirOf("main"), "compositions"), 0o755);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for ${NAME} on this Mac can't be read, so nothing was handed over. Ask Jason.`]]);
    assert.equal(before.rev, reread(w.found).rev);
    w.t.done();
  });
  it("keeps today's refusals first, in their own words: the other Mac's claim, a finish running, a file not whole in Dropbox", async () => {
    const theirs = releaseWorld({ over: { editing: HERS } });
    theirs.t.ctx.deps.running = async () => true;
    assert.deepEqual((await release(theirs.t.ctx.deps, FOLDER)).said, [`Sallie's laptop has ${NAME} open. Open it here first (say "take it over" if they are done with it). Nothing was changed.`]);
    theirs.t.done();
    const lacking = releaseWorld();
    lacking.t.ctx.deps.running = async () => true;
    rmSync(join(lacking.found.folder, "Pricing talk.srt"));
    const r = await release(lacking.t.ctx.deps, FOLDER);
    assert.equal(r.code, 1);
    assert.match(r.said[0], /is not whole in Dropbox: Pricing talk\.srt is missing\. Nothing was handed over\.$/);
    lacking.t.done();
  });
});

describe("release: assets that are too big (group F)", () => {
  it("leaves a project's assets out when they weigh over 50 MB, hands over the rest, and says so", async () => {
    const w = releaseWorld({ projects: ["main"] });
    writeFileSync(join(w.dirOf("main"), "assets", "interview.mov"), "x");
    truncateSync(join(w.dirOf("main"), "assets", "interview.mov"), 50 * 1024 * 1024 + 1);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`${NAME} is handed over. Copied for the other Mac: its HyperFrames project (the main video). The assets of the main video (their pictures, music and video) are too big to hand over, so they stay on this Mac. ${KEEP}`]]);
    // Studio's own fonts and logos go all the same, and a note says that the rest was left out (the review of PR 11, M4).
    assert.deepEqual(snapshotListing(w, T1, MAIN), [...HELD_RELS.filter((rel) => !rel.startsWith("assets/") || rel.startsWith("assets/fonts/") || rel.startsWith("assets/logos/")), LEFT_OUT_NOTE].sort());
    assert.match(textOf(join(w.found.folder, "app-snapshot", T1, MAIN, LEFT_OUT_NOTE)), /too big to hand over/);
    assert.equal(reread(w.found).files[`app-snapshot/${T1}/${MAIN}/${LEFT_OUT_NOTE}`], statSync(join(w.found.folder, "app-snapshot", T1, MAIN, LEFT_OUT_NOTE)).size);
    assert.equal(existsSync(join(w.dirOf("main"), LEFT_OUT_NOTE)), false, "the project on this Mac is as it was");
    w.t.done();
  });
  it("names the parts, two of them, in one sentence", async () => {
    const w = releaseWorld();
    for (const key of ["main", "reel 2"]) {
      writeFileSync(join(w.dirOf(key), "assets", "interview.mov"), "x");
      truncateSync(join(w.dirOf(key), "assets", "interview.mov"), 60 * 1024 * 1024);
    }
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.said[0], `${NAME} is handed over. Copied for the other Mac: ${BOTH}. The assets of the main video and Reel 2 (their pictures, music and video) are too big to hand over, so they stay on this Mac. ${KEEP}`);
    w.t.done();
  });
});

describe("release: the newest exports go with it (group D)", () => {
  const FROM = "edit/from-hyperframes";
  const carried = (w) => (existsSync(join(w.found.folder, "edit", "from-hyperframes")) ? readdirSync(join(w.found.folder, "edit", "from-hyperframes")).sort() : []);
  it("puts the newest export of each project into the folder of what the other Mac is handed, cloned from where it is, with its time, and lists it", async () => {
    const w = releaseWorld();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(`${BOTH}, ${main.name} and ${reel.name}`)]]);
    assert.deepEqual(carried(w), [main.name, reel.name].sort());
    for (const file of [main, reel]) {
      const copy = join(w.found.folder, "edit", "from-hyperframes", file.name);
      assert.equal(textOf(copy), textOf(file.path));
      assert.equal(statSync(copy).mtimeMs, statSync(file.path).mtimeMs, "it keeps the export's time");
      assert.equal(reread(w.found).files[`${FROM}/${file.name}`], statSync(file.path).size);
      assert.ok(w.t.clones.some(([from, to]) => from === file.path && to === copy), "cloned from where the export is");
    }
    assert.deepEqual(readdirSync(w.downloads).sort(), [main.name, reel.name].sort(), "Downloads is as it was: the originals stay");
    w.t.done();
  });
  it("carries the newest of a project's exports and not its older ones, and both when two began in one minute", async () => {
    const w = releaseWorld({ projects: ["main"] });
    exportOf(w, "main", { start: [13, 30, 0] });
    const newest = exportOf(w, "main", { start: [13, 56, 40] });
    const same = exportOf(w, "main", { start: [13, 56, 50], ending: "mov", record: false });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(carried(w), [newest.name, same.name].sort());
    w.t.done();
  });
  it("carries no WebM, no empty file, no other project's export, and none of a Reel she dropped; it carries one in another folder that the app's record names", async () => {
    const dropped = { n: 2, status: "dropped", from: 5.872, to: 9.843, title: "Say it again, better", why: "", files: [], pushed: [] };
    const w = releaseWorld({ over: { reels: [dropped] } });
    exportOf(w, "main", { start: [13, 20, 0], ending: "webm" });
    exportOf(w, "main", { start: [13, 21, 0], text: "" });
    exportOf(w, "main", { name: "Another episode main 3fa9c1 2026-10-20 13.56.mp4", record: false });
    exportOf(w, "reel 2");
    const elsewhere = exportOf(w, "main", { start: [13, 40, 0], folder: join(w.t.dir, "elsewhere") });
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(`${BOTH} and ${elsewhere.name}`)]]);
    assert.deepEqual(carried(w), [elsewhere.name]);
    w.t.done();
  });
  it("never copies another video of this Mac into Dropbox because a record in a project names it: only an export in Downloads, in the project, or named as an export of that project (the review of PR 11, M3)", async () => {
    const w = releaseWorld({ projects: ["main"] });
    // A record the app's agent wrote (or anything else) names videos all over this Mac.
    exportOf(w, "main", { start: [13, 10, 0], name: "Private holiday.mov", folder: join(w.t.dir, "Movies") });
    const out = join(w.dirOf("main"), "out");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(w.t.dir, "secret.mp4"), "a video of nobody's business");
    symlinkSync(join(w.t.dir, "secret.mp4"), join(out, "pretty.mp4"));
    exportOf(w, "main", { start: [13, 11, 0], name: "pretty.mp4", folder: out, text: "" });
    // (exportOf wrote the file over the link's place; put the link back, since it is the case that matters.)
    rmSync(join(out, "pretty.mp4"));
    symlinkSync(join(w.t.dir, "secret.mp4"), join(out, "pretty.mp4"));
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID("its HyperFrames project (the main video)")]]);
    assert.deepEqual(carried(w), []);
    w.t.done();
  });
  it("copies an export that the record names in Downloads or in the project, under any name", async () => {
    for (const where of ["downloads", "project"]) {
      const w = releaseWorld({ projects: ["main"] });
      const folder = where === "downloads" ? w.downloads : join(w.dirOf("main"), "out");
      const made = exportOf(w, "main", { start: [13, 10, 0], name: "my final cut.mp4", folder });
      const r = await release(w.t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [0, [SAID(`its HyperFrames project (the main video) and ${made.name}`)]], where);
      assert.deepEqual(carried(w), [made.name], where);
      w.t.done();
    }
  });
  it("keeps a copy that is there already at the size the record lists, and replaces one of another size", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    const before = w.t.clones.length;
    const again = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [SAID("its HyperFrames project (the main video)")]]);
    assert.deepEqual(w.t.clones.slice(before).filter(([, to]) => to.includes("from-hyperframes")), [], "nothing was copied again");
    // The export is made again under the same name, and is another size: the old copy is deleted, and the new one cloned.
    writeFileSync(main.path, "the export of main, longer now");
    const changed = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([changed.code, changed.said], [0, [SAID(`its HyperFrames project (the main video) and ${main.name}`)]]);
    assert.equal(textOf(join(w.found.folder, "edit", "from-hyperframes", main.name)), "the export of main, longer now");
    assert.equal(reread(w.found).files[`${FROM}/${main.name}`], Buffer.byteLength("the export of main, longer now"));
    w.t.done();
  });
  it("leaves an export that is not whole and names it, handing over the rest", async () => {
    const w = releaseWorld();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    w.t.ctx.deps.isWhole = (path) => !path.endsWith(main.name);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [`${NAME} is handed over. Copied for the other Mac: ${BOTH} and ${reel.name}. Not copied yet, still being written: ${main.name}. ${KEEP}`]]);
    assert.deepEqual(carried(w), [reel.name]);
    assert.equal(`${FROM}/${main.name}` in reread(w.found).files, false);
    w.t.done();
  });
  it("hands over what it can when this Mac will not let Downloads be read: the exports the app's record names, not the ones it would find by name", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const recorded = exportOf(w, "main");
    exportOf(w, "main", { start: [13, 58, 0], record: false });
    w.t.ctx.deps.readdir = (dir) => {
      if (dir === w.downloads) throw Object.assign(new Error("not permitted"), { code: "EPERM" });
      return readdirSync(dir);
    };
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SAID(`its HyperFrames project (the main video) and ${recorded.name}`)]]);
    w.t.done();
  });
});

describe("release: the two newest snapshots are kept (group G)", () => {
  const later = (w, ms = 60000) => w.t.ctx.deps.wait(ms);
  const folders = (w) => (existsSync(join(w.found.folder, "app-snapshot")) ? readdirSync(join(w.found.folder, "app-snapshot")).sort() : []);
  const listedTimes = (w) => [...new Set(Object.keys(reread(w.found).files).filter((rel) => rel.startsWith("app-snapshot/")).map((rel) => rel.split("/")[1]))].sort();
  it("keeps the second and third of three, lists no file of the first and removes its folder after the record is written", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const asked = [];
    w.t.ctx.deps.rm = (path, options) => {
      asked.push([path.replace(w.found.folder, ""), Object.keys(reread(w.found).files).some((rel) => rel.startsWith("app-snapshot/2026-10-20 20.00.00Z/"))]);
      return rmSync(path, options);
    };
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.deepEqual([folders(w), asked], [[T1], []], "the first release removes nothing");
    await later(w);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.deepEqual(folders(w), [T1, "2026-10-20 20.01.00Z"]);
    await later(w);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.deepEqual(folders(w), ["2026-10-20 20.01.00Z", "2026-10-20 20.02.00Z"]);
    assert.deepEqual(listedTimes(w), ["2026-10-20 20.01.00Z", "2026-10-20 20.02.00Z"]);
    // Each file the record listed of it is removed by its own name, once the record no longer lists it (the review of PR 11, M6).
    assert.deepEqual(asked.map(([path]) => path).sort(), HELD_RELS.map((rel) => `/app-snapshot/${T1}/${MAIN}/${rel}`).sort());
    assert.equal(asked.every(([, listed]) => listed === false), true, "the record no longer listed it when it was removed");
    w.t.done();
  });
  it("removes a dropped snapshot by the names the record listed and no other: a file of its own that it never named stays, and so does the folder it is in (the review of PR 11, M6)", async () => {
    const w = releaseWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    const stray = join(w.found.folder, "app-snapshot", T1, MAIN, "compositions", "a conflicted copy.html");
    writeFileSync(stray, "not listed");
    for (let i = 0; i < 2; i++) {
      await later(w);
      assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    }
    assert.deepEqual(listedTimes(w), ["2026-10-20 20.01.00Z", "2026-10-20 20.02.00Z"]);
    assert.equal(textOf(stray), "not listed");
    assert.deepEqual(filesBelow(join(w.found.folder, "app-snapshot", T1)), [`${MAIN}/compositions/a conflicted copy.html`], "every file it named is gone, and no other");
    w.t.done();
  });
  it("follows no link when it removes a dropped snapshot: with a link in the way, nothing beyond it is touched", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const elsewhere = join(w.t.dir, "elsewhere");
    mkdirSync(elsewhere, { recursive: true });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    await later(w);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    // The snapshots' folder is moved away and a link left in its place, as a Dropbox folder reached some other way might be.
    renameSync(join(w.found.folder, "app-snapshot"), join(elsewhere, "app-snapshot"));
    symlinkSync(join(elsewhere, "app-snapshot"), join(w.found.folder, "app-snapshot"));
    const before = filesBelow(join(elsewhere, "app-snapshot", T1));
    await later(w);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(filesBelow(join(elsewhere, "app-snapshot", T1)), before, "what the link leads to is not removed from");
    w.t.done();
  });
  it("looks again at each path just before it goes: a folder swapped for a link meanwhile is not followed", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const decoy = join(w.t.dir, "decoy");
    mkdirSync(join(decoy), { recursive: true });
    writeFileSync(join(decoy, "title-card.html"), "someone else's");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    for (let i = 0; i < 2; i++) {
      await later(w);
      if (i === 1) {
        let swapped = false;
        w.t.ctx.deps.rm = (path, options) => {
          if (!swapped) {
            swapped = true;
            rmSync(join(w.found.folder, "app-snapshot", T1, MAIN, "compositions"), { recursive: true, force: true });
            symlinkSync(decoy, join(w.found.folder, "app-snapshot", T1, MAIN, "compositions"));
          }
          return rmSync(path, options);
        };
      }
      assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    }
    assert.equal(textOf(join(decoy, "title-card.html")), "someone else's");
    w.t.done();
  });
  it("names a snapshot made in the second of another by the next free second", async () => {
    const w = releaseWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.deepEqual(folders(w), [T1, "2026-10-20 20.00.01Z"]);
    w.t.done();
  });
  it("does not keep a snapshot that is not whole among the two newest: the one before it takes its place", async () => {
    const w = releaseWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    await later(w);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    rmSync(join(w.found.folder, "app-snapshot", "2026-10-20 20.01.00Z", MAIN, "index.html"));
    await later(w);
    const third = await release(w.t.ctx.deps, FOLDER);
    assert.equal(third.code, 0, third.text);
    assert.deepEqual(folders(w), [T1, "2026-10-20 20.02.00Z"]);
    assert.deepEqual(listedTimes(w), [T1, "2026-10-20 20.02.00Z"]);
    w.t.done();
  });
  it("is not stopped by a copy Dropbox took away: it is listed no more, as a Final Cut copy is", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    rmSync(join(w.found.folder, "edit", "from-hyperframes", main.name));
    rmSync(join(w.found.folder, "app-snapshot", T1, MAIN, "brimm", "facts.json"));
    await later(w);
    const again = await release(w.t.ctx.deps, FOLDER);
    assert.equal(again.code, 0, again.text);
    const files = reread(w.found).files;
    assert.equal(`edit/from-hyperframes/${main.name}` in files, true, "this release carries the export again");
    assert.equal(`app-snapshot/${T1}/${MAIN}/brimm/facts.json` in files, false);
    assert.deepEqual(listedTimes(w), ["2026-10-20 20.01.00Z"], "the snapshot that lost a file is not kept");
    w.t.done();
  });
  it("lists an export's copy no more when Dropbox took it away and this release does not carry it again", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    assert.equal(`edit/from-hyperframes/${main.name}` in reread(w.found).files, true);
    rmSync(join(w.found.folder, "edit", "from-hyperframes", main.name));
    rmSync(main.path);
    const again = await release(w.t.ctx.deps, FOLDER);
    assert.equal(again.code, 0, again.text);
    assert.equal(`edit/from-hyperframes/${main.name}` in reread(w.found).files, false, "the other Mac would wait for it for ever");
    w.t.done();
  });
  it("is done when a snapshot cannot be removed: the record is right and the folder is left", async () => {
    const w = releaseWorld({ projects: ["main"] });
    for (let i = 0; i < 2; i++) {
      assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
      await later(w);
    }
    w.t.ctx.deps.rm = () => {
      throw new Error("not allowed");
    };
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(listedTimes(w), ["2026-10-20 20.01.00Z", "2026-10-20 20.02.00Z"]);
    assert.ok(folders(w).includes(T1), "the folder stays");
    w.t.done();
  });
});

describe("release: a failure leaves nothing half there (group H)", () => {
  /** A clone that fails on the `n`th file it is asked for whose destination holds `part`. */
  const failing = (w, part, n = 1) => {
    const clone = w.t.ctx.deps.clone;
    let seen = 0;
    w.t.ctx.deps.clone = (from, to) => {
      if (to.includes(part) && ++seen === n) throw new Error("no room left on the disk");
      clone(from, to);
    };
    return () => {
      w.t.ctx.deps.clone = clone;
    };
  };
  it("removes the new snapshot when a file of it cannot be put in, writes no record, keeps the claim and says in words that hold no path that nothing was handed over", async () => {
    const w = releaseWorld();
    const mend = failing(w, "app-snapshot", 3);
    const before = [reread(w.found).rev, listAll(w.found.folder)];
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: no room left on the disk. Nothing was handed over: say hand it over again.`]]);
    assert.deepEqual([reread(w.found).rev, listAll(w.found.folder)], before);
    assert.equal(reread(w.found).editing.by, "Mac Studio");
    assert.equal(existsSync(join(w.found.folder, "app-snapshot", T1)), false);
    mend();
    const again = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [SAID(BOTH)]]);
    w.t.done();
  });
  it("says why a copy failed in plain words whatever the error looks like: no path, no quote, no name of a call (the review of PR 11, M1)", async () => {
    const shapes = [
      ["ENOSPC: no space left on device, copyfile '/Users/sallie/BRIMM Video Work/x/AGENTS.md' -> '/Dropbox/x/AGENTS.md'", "no space left on device"],
      ["cp: /Users/sallie/BRIMM Video Work/x/AGENTS.md: No space left on device", "No space left on device"],
      ["EACCES: permission denied, open '/Users/sallie/x/index.html'", "permission denied"]
    ];
    for (const [message, why] of shapes) {
      const w = releaseWorld({ projects: ["main"] });
      w.t.ctx.deps.clone = () => {
        throw new Error(message);
      };
      const r = await release(w.t.ctx.deps, FOLDER);
      assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: ${why}. Nothing was handed over: say hand it over again.`]], message);
      w.t.done();
    }
    // A clone can only be made on one disk, which cloneIn says in its own words.
    const w = releaseWorld({ projects: ["main"] });
    w.t.ctx.deps.sameDisk = () => false;
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was handed over: say hand it over again.`]]);
    w.t.done();
  });
  it("gives a reason that holds a path, or none, as a file that could not be copied", () => {
    assert.equal(reasonOf(new Error("AGENTS.md is in /Dropbox/x/app-snapshot already, and a file there is never written over.")), "a file could not be copied");
    assert.equal(reasonOf(new Error("")), "a file could not be copied");
    assert.equal(reasonOf(undefined), "a file could not be copied");
    assert.equal(reasonOf("no room left on the disk"), "a file could not be copied", "only an error's own message is told");
    assert.equal(reasonOf(new Error("x could not be put into /y: no room left on the disk. Nothing was copied.")), "no room left on the disk");
  });
  it("leaves the earlier snapshots as they were", async () => {
    const w = releaseWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    await w.t.ctx.deps.wait(60000);
    const kept = listAll(join(w.found.folder, "app-snapshot"));
    failing(w, "app-snapshot", 2);
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 1);
    assert.deepEqual(listAll(join(w.found.folder, "app-snapshot")), kept);
    w.t.done();
  });
  it("removes the exports it copied, and the snapshot, when an export cannot be put in", async () => {
    const w = releaseWorld();
    const main = exportOf(w, "main");
    exportOf(w, "reel 2");
    failing(w, "from-hyperframes", 2);
    const before = [reread(w.found).rev, listAll(w.found.folder)];
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: no room left on the disk. Nothing was handed over: say hand it over again.`]]);
    assert.deepEqual([reread(w.found).rev, listAll(w.found.folder)], before);
    assert.equal(existsSync(join(w.found.folder, "edit", "from-hyperframes", main.name)), false);
    w.t.done();
  });
  it("lists a copy no more when it deleted it to replace it and could not make the new one, and hands nothing over", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    writeFileSync(main.path, "the export of main, longer now");
    failing(w, "from-hyperframes");
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: no room left on the disk. Nothing was handed over: say hand it over again.`]]);
    assert.equal(`edit/from-hyperframes/${main.name}` in reread(w.found).files, false, "the record does not list what is gone");
    w.t.done();
  });
  it("puts a project's marker back as it was when a copy cannot be made or the record cannot be written, so that it never names a snapshot that is not there (the review of PR 11, I1)", async () => {
    const w = releaseWorld({ projects: ["main"] });
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    const marked = markerAsItIs(w.dirOf("main"));
    assert.deepEqual(readMarker(w.dirOf("main")), { snapshot: T1, by: "Mac Studio" });
    await w.t.ctx.deps.wait(60000);
    // The record cannot be written: the other Mac wrote while the files were copied.
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("index.html")) writeFileSync(join(w.found.folder, "record", "0003.json"), "{}");
    };
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 1);
    assert.equal(markerAsItIs(w.dirOf("main")), marked, "as it was");
    // A copy cannot be made: the marker is never written.
    w.t.ctx.deps.clone = () => {
      throw new Error("no room left on the disk");
    };
    rmSync(join(w.found.folder, "record", "0003.json"));
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 1);
    assert.equal(markerAsItIs(w.dirOf("main")), marked, "as it was");
    // And a project that had none is left with none.
    rmSync(join(w.dirOf("main"), MARKER));
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 1);
    assert.equal(markerAsItIs(w.dirOf("main")), null);
    w.t.done();
  });
  it("lists each export it replaced at the size it has now when a later one cannot be put in, and lists the one it lost no more (the review of PR 11, M9)", async () => {
    const w = releaseWorld();
    const main = exportOf(w, "main");
    const reel = exportOf(w, "reel 2");
    assert.equal((await release(w.t.ctx.deps, FOLDER)).code, 0);
    writeFileSync(main.path, "the export of main, longer now");
    writeFileSync(reel.path, "the export of reel 2, longer now, too");
    const mend = failing(w, "from-hyperframes", 2);
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`${NAME} could not be handed over: no room left on the disk. Nothing was handed over: say hand it over again.`]]);
    const files = reread(w.found).files;
    assert.equal(files[`edit/from-hyperframes/${main.name}`], Buffer.byteLength("the export of main, longer now"), "the copy that was replaced is listed at its real size");
    assert.equal(`edit/from-hyperframes/${reel.name}` in files, false, "the copy that was lost is listed no more");
    assert.equal(statSync(join(w.found.folder, "edit", "from-hyperframes", main.name)).size, files[`edit/from-hyperframes/${main.name}`]);
    mend();
    const again = await release(w.t.ctx.deps, FOLDER);
    assert.equal(again.code, 0, again.text);
    w.t.done();
  });
  it("removes what it put in when the record cannot be written because the other Mac wrote meanwhile", async () => {
    const w = releaseWorld({ projects: ["main"] });
    const main = exportOf(w, "main");
    const clone = w.t.ctx.deps.clone;
    w.t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(main.name)) writeFileSync(join(w.found.folder, "record", "0002.json"), "{}");
    };
    const r = await release(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 1);
    assert.equal(r.said.at(-1), "Nothing was written: this episode changed on the other Mac: open it again.");
    assert.equal(existsSync(join(w.found.folder, "app-snapshot", T1)), false);
    assert.equal(existsSync(join(w.found.folder, "edit", "from-hyperframes", main.name)), false);
    w.t.done();
  });
});
