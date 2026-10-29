// An older project folder is set aside, and the project rebuilt from the newer snapshot (plan PR 18; architecture 2026-10-27, sections 4.7, 5.6
// and 7.3; Jason, 2026-10-29: "have Studio move the older folder aside itself, deleting nothing, and rebuild from the newer snapshot").
// When a project comes back to the Mac that first handed it over, that Mac's folder is older than the newest snapshot: its marker names an
// older snapshot. `app "<episode>"` and `app "<episode>" reel <n>` then ask whether HyperFrames is open (before the claim, and again where the
// folder is moved), claim the episode as they did, build the new project beside its place, move the older folder, whole, into a folder of its
// own in the episode's work folder, put the new project where it was, keep the old project's video when it passes the check every working copy
// does, and open the app. Two Macs share one root here, Mac Studio (whose folder is older) and Sallie's laptop. No test runs HyperFrames, the app,
// HeyGen or `claude`: the pinned command line is the stand-in of tests/stand-ins/hyperframes.mjs, and nothing touches the real home, Downloads,
// Dropbox or BRIMM Video Work.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { reelStretch } from "../app-reel.js";
import { settingsText } from "../project.js";
import { ASIDE_DIR, MARKER, readMarker, timeOf, writeMarker } from "../snapshot.js";
import { FOLDER, NAME } from "./episodes.js";
import { ZONE } from "./exports-world.js";
import { depsOf, guideWorld } from "./guide-world.js";
import { COPY_TEXT, HELD, MAIN, REEL2, STAND_IN, fillProject, listAll, madeCopy, madeReelCopy, ms, reread, takeOverWorld } from "./snapshot-world.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|workcopy|reels\.json/;
/** `app` as Claude runs it, and a check that every line it said, whichever way it ended, is plain. */
async function app(deps, ...words) {
  const r = await on(deps, "app", ...words);
  for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
  return r;
}
const release = (deps) => on(deps, "release", FOLDER);
/** What the stand-in wrote down of each run of the pinned command line on a Mac. */
function runsOf(mac) {
  const log = join(mac.home, "hyperframes-stand-in.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

/** Every file, folder and link under `dir`, as { <path from it>: "dir" | "file:<its text>" | "link:<where it leads>" }: two folders are the same
    byte for byte when these are. A link is not followed. */
function treeOf(dir) {
  const out = {};
  for (const rel of readdirSync(dir, { recursive: true }).sort()) {
    const here = lstatSync(join(dir, rel));
    out[rel] = here.isSymbolicLink() ? `link:${readlinkSync(join(dir, rel))}` : here.isDirectory() ? "dir" : `file:${readFileSync(join(dir, rel), "utf8")}`;
  }
  return out;
}
const without = (tree, rel) => Object.fromEntries(Object.entries(tree).filter(([path]) => path !== rel));

const OPEN = "It's open in HyperFrames.";
const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
const SET_ASIDE = (of = "") => `The older HyperFrames project for ${of}${NAME} was set aside on this Mac, and nothing was deleted.`;
const REBUILT = (when, of = "", by = "Sallie's laptop") => `The HyperFrames project for ${of}${NAME} is rebuilt on this Mac from what ${by} handed over at ${when}. What HyperFrames kept of its history stays on ${by}.`;
const KEPT = (of = "") => `The video for ${of}${NAME} was kept from the older project, and it is in the project.`;
const MAKING = `The video for HyperFrames is being made. Say "open ${NAME} in HyperFrames" again when it is done; "how far is it?" shows how far it has got.`;
const AGAIN_REEL = `open Reel 2 of ${NAME} in HyperFrames`;
const MAKING_REEL = `The video for Reel 2 is being made. Say "${AGAIN_REEL}" again when it is done; "how far is it?" shows how far it has got.`;
const BACK = `The video for ${NAME} was made again, and it is in the project.`;
const QUIT = "Quit HyperFrames first, so that the older project can be set aside, then say it again. Nothing was changed.";
const CANT_TELL = "I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was changed.";
const OLDER = (of = "") => `The HyperFrames project for ${of}${NAME} on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.`;
const COULD_NOT = (of = "") => `The HyperFrames project for ${of}${NAME} could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.`;
const NOT_WHOLE = (of = "") => `The snapshot of the HyperFrames project for ${of}${NAME} is not whole on this Mac, so the older project was left where it was. Ask Jason.`;

/** What the older Mac's video is: the text fillProject puts in a project's `media/recording.mp4`, and the size of it. */
const OLD_VIDEO = "the working copy";
const CHANGED = "<div>Pricing, in a new way</div>";
const SECOND = "<div>A second card</div>";

/** Mac Studio hands the episode over (T1); Sallie's laptop takes it over, rebuilds the project, makes its video, changes a composition, adds a second
    one and hands it over (T2). Mac Studio's folder is then older than the newest snapshot, by its marker, which names T1. For a Reel (`reel`) it is
    Reel 2's project. Mac Studio's working copy was moved into its project when the project was made, and what stays beside the others is its
    facts, which are put there as they stand on a Mac that made the project (`facts: false` leaves them out; `facts` may also be the facts' own
    changes). Gives the world and: `key` and `words` (the project's and the arguments that name it), `project` its folder's name and `dirOf` its
    folder on Mac Studio, `T2` the laptop's snapshot's name, and `when` its moment as she is told it. */
async function comeBack({ reel = false, facts = true, ...options } = {}) {
  const w = takeOverWorld({ projects: reel ? ["main", "reel 2"] : ["main"], ...options });
  assert.equal((await release(w.t.ctx.deps)).code, 0);
  const words = reel ? ["reel", "2"] : [];
  const project = w.names[reel ? "reel 2" : "main"];
  await app(w.b.deps, FOLDER, ...words);
  (reel ? madeReelCopy : madeCopy)(w.b, w.found);
  const opened = await app(w.b.deps, FOLDER, ...words);
  assert.equal(opened.code, 0, opened.text);
  for (const [rel, text] of [["compositions/title-card.html", CHANGED], ["compositions/second-card.html", SECOND]]) {
    writeFileSync(join(w.b.work, project, rel), text);
    utimesSync(join(w.b.work, project, rel), new Date(ms(16, 0)), new Date(ms(16, 0)));
  }
  await w.t.ctx.deps.wait(60000);
  const handed = await release(w.b.deps);
  assert.equal(handed.code, 0, handed.text);
  if (facts) {
    const over = { bytes: OLD_VIDEO.length, ...(typeof facts === "function" ? facts(w) : facts === true ? {} : facts) };
    const copy = reel ? madeReelCopy({ home: w.t.home }, w.found, 2, over) : madeCopy({ home: w.t.home }, w.found, over);
    rmSync(copy.video);
  }
  // What the world started so far, the laptop's asks for its video, is not what the test is about.
  w.t.started.splice(0);
  const T2 = readdirSync(join(w.found.folder, "app-snapshot")).sort().at(-1);
  return { ...w, words, project, key: reel ? "reel 2" : "main", dir: w.dirOf(reel ? "reel 2" : "main"), T2, when: ZONE.text(timeOf(T2)), of: reel ? "Reel 2 of " : "" };
}
/** The older folder as it is before `app`: its tree, its folder's number on the volume and its video's. */
const olderOf = (w) => ({ tree: treeOf(w.dir), ino: lstatSync(w.dir).ino, video: existsSync(join(w.dir, "media", "recording.mp4")) ? lstatSync(join(w.dir, "media", "recording.mp4")).ino : null });
/** The folders set aside on Mac Studio, as paths, each named by the project and a moment. */
function asidesOf(w, project = w.project) {
  const names = existsSync(join(w.work, ASIDE_DIR)) ? readdirSync(join(w.work, ASIDE_DIR)).sort() : [];
  for (const name of names) assert.match(name, new RegExp(`^${project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d{4}-\\d{2}-\\d{2} \\d{2}\\.\\d{2}\\.\\d{2}Z$`), name);
  return names.map((name) => join(w.work, ASIDE_DIR, name));
}
/** Everything a refusal leaves as it was: the record, what is in the episode's folder in Dropbox, both Macs' work folders, what was started and waited for. */
const stateOf = (w) => ({
  rev: reread(w.found).rev, editing: reread(w.found).editing, episode: listAll(w.found.folder), studio: treeOf(w.work), laptop: treeOf(w.b.work),
  started: [...w.t.started], waits: [...w.t.waits], runs: [runsOf({ home: w.t.home }), runsOf(w.b)]
});
/** The files of the episode in Dropbox but for the record's revisions, which every claim and open adds to. */
const outsideRecord = (w) => listAll(w.found.folder).filter((rel) => !rel.startsWith("record/"));

describe("app: an older project is set aside and rebuilt from the newest snapshot (plan PR 18, group C)", () => {
  it("claims the episode, builds the new project, moves the older folder whole into a folder of its own, puts the new project where it was, keeps the video and opens the app, saying so in this order", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    assert.deepEqual(readMarker(w.dir), { snapshot: "2026-10-20 20.00.00Z", by: "Mac Studio" }, "the older folder's marker names the first snapshot");
    const outside = outsideRecord(w);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SET_ASIDE(), REBUILT(w.when), KEPT(), OPEN, BUTTONS]]);
    // The older folder: set aside, whole, as it was but for the video, which moved into the new project.
    const [aside, ...more] = asidesOf(w);
    assert.deepEqual(more, [], "one folder is set aside");
    assert.equal(lstatSync(aside).ino, was.ino, "the very folder, moved and not copied");
    assert.deepEqual(treeOf(aside), without(was.tree, "media/recording.mp4"));
    assert.equal(existsSync(join(aside, "media", "recording.mp4")), false);
    // The new project: the newest snapshot's files with the times they had, the settings, the marker of that snapshot and the link into this Mac's toolchain.
    assert.deepEqual(Object.keys(treeOf(w.dir)).filter((rel) => !lstatSync(join(w.dir, rel)).isDirectory()).sort(), [...Object.keys(HELD), "compositions/second-card.html", ".claude/settings.json", MARKER, "media/recording.mp4", "node_modules/.bin/hyperframes"].sort());
    assert.equal(readFileSync(join(w.dir, "compositions", "title-card.html"), "utf8"), CHANGED);
    assert.equal(readFileSync(join(w.dir, "compositions", "second-card.html"), "utf8"), SECOND);
    assert.equal(readFileSync(join(w.dir, ".claude", "settings.json"), "utf8"), settingsText("main"));
    assert.equal(readlinkSync(join(w.dir, "node_modules", ".bin", "hyperframes")), STAND_IN);
    assert.deepEqual(readMarker(w.dir), { snapshot: w.T2, by: "Sallie's laptop" });
    assert.equal(statSync(join(w.dir, "index.html")).mtimeMs, ms(13, 40), "a file keeps the time it had");
    assert.equal(existsSync(join(w.dir, ".hyperframes")), false, "the app's history stays behind, in the set-aside folder");
    assert.equal(existsSync(join(aside, ".hyperframes", "app-history.jsonl")), true);
    // The video: the very file, moved; no copy was asked for.
    assert.equal(lstatSync(join(w.dir, "media", "recording.mp4")).ino, was.video);
    assert.equal(readFileSync(join(w.dir, "media", "recording.mp4"), "utf8"), OLD_VIDEO);
    assert.deepEqual(w.t.started, [], "no working copy was asked for");
    // The record and Dropbox: the claim is this Mac's, the project keeps where it was made and gets the time it was opened and the copy's size.
    const record = reread(w.found);
    assert.equal(record.editing.by, "Mac Studio");
    assert.deepEqual(record.app.projects.map((p) => [p.key, p.on, p.opened.length, p.state, p.workingCopy]), [["main", "Mac Studio", 3, "opened", { bytes: OLD_VIDEO.length, seconds: 23.423, fps: 30 }]]);
    assert.deepEqual(outsideRecord(w), outside, "nothing was put into the episode's folder in Dropbox but the claim's record");
    assert.deepEqual(runsOf({ home: w.t.home }).map((run) => run.args), [["open", w.dir, "--json"]], "the app is asked once, for the project in its place");
    w.t.done();
  });
  it("opens the next ask as it opens any project, hands the rebuilt project over as it hands any over, and starts its history afresh", async () => {
    const w = await comeBack();
    assert.equal((await app(w.t.ctx.deps, FOLDER)).code, 0);
    const again = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    assert.equal(asidesOf(w).length, 1, "nothing more is set aside");
    const history = await app(w.t.ctx.deps, FOLDER, "what-happened");
    assert.deepEqual(history.said, [`Nothing has been done in HyperFrames on ${NAME} yet.`]);
    await w.t.ctx.deps.wait(60000);
    const handed = await release(w.t.ctx.deps);
    assert.equal(handed.code, 0, handed.text);
    const newest = readdirSync(join(w.found.folder, "app-snapshot")).sort().at(-1);
    assert.deepEqual(readMarker(w.dir), { snapshot: newest, by: "Mac Studio" });
    assert.equal(readFileSync(join(w.found.folder, "app-snapshot", newest, MAIN, "compositions", "second-card.html"), "utf8"), SECOND, "what the laptop did is in the snapshot Mac Studio hands over");
    w.t.done();
  });
  it("sets another folder aside, under another name, at each return, and every one stays whole: the project goes back and forth between the Macs", async () => {
    const w = await comeBack();
    const first = olderOf(w);
    assert.equal((await app(w.t.ctx.deps, FOLDER)).code, 0);
    // Mac Studio changes it and hands it over; the laptop is older now and sets its own folder aside, changes the project and hands it over.
    writeFileSync(join(w.dir, "compositions", "title-card.html"), "<div>Mac Studio's turn</div>");
    utimesSync(join(w.dir, "compositions", "title-card.html"), new Date(ms(17, 0)), new Date(ms(17, 0)));
    await w.t.ctx.deps.wait(60000);
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    const laptop = await app(w.b.deps, FOLDER);
    assert.equal(laptop.code, 0, laptop.text);
    assert.equal(laptop.said[0], SET_ASIDE(), "the laptop is the older one now");
    assert.equal(readFileSync(join(w.b.work, MAIN, "compositions", "title-card.html"), "utf8"), "<div>Mac Studio's turn</div>");
    writeFileSync(join(w.b.work, MAIN, "compositions", "title-card.html"), "<div>The laptop's turn</div>");
    utimesSync(join(w.b.work, MAIN, "compositions", "title-card.html"), new Date(ms(18, 0)), new Date(ms(18, 0)));
    await w.t.ctx.deps.wait(60000);
    assert.equal((await release(w.b.deps)).code, 0);
    // Mac Studio is older again: a second folder goes aside under another name, and the first is still there as it was.
    const second = await app(w.t.ctx.deps, FOLDER);
    assert.equal(second.code, 0, second.text);
    assert.equal(second.said[0], SET_ASIDE());
    const asides = asidesOf(w);
    assert.equal(asides.length, 2);
    assert.equal(lstatSync(asides[0]).ino, first.ino);
    assert.deepEqual(treeOf(asides[0]), without(first.tree, "media/recording.mp4"));
    assert.equal(readFileSync(join(asides[1], "compositions", "title-card.html"), "utf8"), "<div>Mac Studio's turn</div>");
    assert.equal(readFileSync(join(w.dir, "compositions", "title-card.html"), "utf8"), "<div>The laptop's turn</div>");
    w.t.done();
  });
  it("sets the older folder aside too when its marker names a snapshot the record lists no more: the other Mac handed over twice while this Mac was away, and the record keeps the two newest", async () => {
    const w = await comeBack();
    const first = readdirSync(join(w.found.folder, "app-snapshot")).sort()[0];
    assert.equal(first, "2026-10-20 20.00.00Z");
    writeFileSync(join(w.b.work, MAIN, "compositions", "second-card.html"), "<div>A third thing</div>");
    await w.t.ctx.deps.wait(60000);
    assert.equal((await release(w.b.deps)).code, 0);
    const listed = [...new Set(Object.keys(reread(w.found).files).filter((rel) => rel.startsWith("app-snapshot/")).map((rel) => rel.split("/")[1]))];
    assert.equal(listed.includes(first), false, "the first snapshot is no longer listed");
    assert.deepEqual(readMarker(w.dir), { snapshot: first, by: "Mac Studio" });
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said.slice(0, 1), [SET_ASIDE()]);
    assert.equal(readFileSync(join(w.dir, "compositions", "second-card.html"), "utf8"), "<div>A third thing</div>");
    assert.equal(asidesOf(w).length, 1);
    w.t.done();
  });
  it("does the same for Reel 2, with the Reel's words, its project and its video: moved in when it fits, and the Reel stays picked", async () => {
    const w = await comeBack({ reel: true });
    const was = olderOf(w);
    const r = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [SET_ASIDE("Reel 2 of "), REBUILT(w.when, "Reel 2 of "), KEPT("Reel 2 of "), OPEN, BUTTONS]]);
    const [aside] = asidesOf(w);
    assert.equal(lstatSync(aside).ino, was.ino);
    assert.deepEqual(treeOf(aside), without(was.tree, "media/recording.mp4"));
    assert.equal(readFileSync(join(w.dir, "compositions", "second-card.html"), "utf8"), SECOND);
    assert.deepEqual(readMarker(w.dir), { snapshot: w.T2, by: "Sallie's laptop" });
    assert.equal(lstatSync(join(w.dir, "media", "recording.mp4")).ino, was.video);
    assert.deepEqual(w.t.started, []);
    const record = reread(w.found);
    const project = record.app.projects.find((p) => p.key === "reel 2");
    assert.deepEqual([project.on, project.opened.length, project.state, project.fromSuggestion], ["Mac Studio", 3, "opened", 2]);
    assert.equal(record.reels.find((reel) => reel.n === 2).status, "picked");
    assert.equal(existsSync(join(w.work, MAIN, "index.html")), true, "the main project of this Mac is not touched");
    assert.deepEqual(runsOf({ home: w.t.home }).map((run) => run.args), [["open", w.dir, "--json"]]);
    w.t.done();
  });
  it("is the next ask's an ordinary open of the Reel too, and the main project of this Mac, which the other Mac never had, is not older than any snapshot: it is opened as it was", async () => {
    const w = await comeBack({ reel: true });
    assert.equal((await app(w.t.ctx.deps, FOLDER, "reel", "2")).code, 0);
    const again = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([again.code, again.said], [0, [OPEN, BUTTONS]]);
    assert.equal(asidesOf(w).length, 1);
    const main = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([main.code, main.said], [0, [OPEN, BUTTONS]]);
    assert.equal(asidesOf(w).length, 1, "and nothing of it is set aside");
    w.t.done();
  });
});

describe("app: HyperFrames must be quit before an older project is set aside (plan PR 18, group D)", () => {
  /** What `running` answers, and the words it earns. */
  const ANSWERS = [
    ["is open", async () => true, QUIT],
    ["cannot be told (null)", async () => null, CANT_TELL],
    ["cannot be told (a throw)", async () => { throw new Error("pgrep is not here"); }, CANT_TELL],
    ["answers with something else", () => "maybe", CANT_TELL]
  ];
  for (const reel of [false, true]) {
    for (const [what, running, words] of ANSWERS) {
      it(`refuses ${reel ? "Reel 2" : "the main video"} before anything is claimed, brought, asked for or changed when it ${what}: ${words.slice(0, 40)}…`, async () => {
        const w = await comeBack({ reel });
        w.t.ctx.deps.running = running;
        const was = olderOf(w);
        const before = stateOf(w);
        const r = await app(w.t.ctx.deps, FOLDER, ...w.words);
        assert.deepEqual([r.code, r.said], [1, [words]]);
        assert.deepEqual(stateOf(w), before);
        assert.equal(lstatSync(w.dir).ino, was.ino);
        assert.deepEqual(treeOf(w.dir), was.tree);
        assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
        // And once it is quit, the same words go through.
        w.t.ctx.deps.running = async () => false;
        const again = await app(w.t.ctx.deps, FOLDER, ...w.words);
        assert.equal(again.code, 0, again.text);
        assert.equal(again.said[0], SET_ASIDE(w.of));
        w.t.done();
      });
    }
  }
  for (const reel of [false, true]) {
    it(`is asked again where ${reel ? "Reel 2's" : "the main video's"} folder is moved, after the claim, which waits and may bring a record that lists a newer snapshot: open then, it refuses in the same words and moves nothing`, async () => {
      const w = await comeBack({ reel });
      const was = olderOf(w);
      let asked = 0;
      w.t.ctx.deps.running = async (name) => {
        assert.equal(name, "HyperFrames");
        return ++asked > 1;
      };
      const r = await app(w.t.ctx.deps, FOLDER, ...w.words);
      assert.deepEqual([r.code, r.said], [1, [QUIT]]);
      assert.equal(asked, 2, "before the claim and where the folder would move");
      assert.equal(reread(w.found).editing.by, "Mac Studio", "the claim was made, as it is for any app that stops after it");
      assert.equal(lstatSync(w.dir).ino, was.ino);
      assert.deepEqual(treeOf(w.dir), was.tree);
      assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
      assert.deepEqual(runsOf({ home: w.t.home }), []);
      w.t.done();
    });
  }
  it("is asked of no project that is not older: a current project, a project never handed over and a project with no marker are opened or refused as before, and HyperFrames is not asked about", async () => {
    // A project this Mac handed over itself is current.
    const current = takeOverWorld({ projects: ["main"], over: { editing: null } });
    assert.equal((await release(current.t.ctx.deps)).code, 0);
    let asked = 0;
    current.t.ctx.deps.running = async () => (asked++, true);
    assert.deepEqual((await app(current.t.ctx.deps, FOLDER)).said, [OPEN, BUTTONS]);
    // A project never handed over has no snapshot.
    const never = takeOverWorld({ projects: ["main"], over: { editing: null } });
    never.t.ctx.deps.running = async () => (asked++, true);
    assert.deepEqual((await app(never.t.ctx.deps, FOLDER)).said, [OPEN, BUTTONS]);
    // A project with no marker is refused by the times of its files, as it was.
    const bare = await comeBack({ facts: false });
    rmSync(join(bare.dir, MARKER));
    bare.t.ctx.deps.running = async () => (asked++, true);
    assert.deepEqual((await app(bare.t.ctx.deps, FOLDER)).said, [OLDER()]);
    assert.equal(asked, 0);
    for (const w of [current, never, bare]) w.t.done();
  });
});

describe("app: a project with no marker is still refused, not set aside (plan PR 18, group E)", () => {
  it("refuses it by the times of its files in the words it always had, before the claim, and moves, asks for and changes nothing", async () => {
    const w = await comeBack({ facts: false });
    rmSync(join(w.dir, MARKER));
    const was = olderOf(w);
    const before = stateOf(w);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [OLDER()]]);
    assert.deepEqual(stateOf(w), before);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
    w.t.done();
  });
  it("refuses a Reel project with no marker the same way, naming the Reel", async () => {
    const w = await comeBack({ reel: true, facts: false });
    rmSync(join(w.dir, MARKER));
    const before = stateOf(w);
    const r = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [OLDER("Reel 2 of ")]]);
    assert.deepEqual(stateOf(w), before);
    w.t.done();
  });
  for (const reel of [false, true]) {
    it(`refuses ${reel ? "a Reel project" : "it"} after the claim when the snapshot was not whole at the first look and its file arrives with the claim, as openInApp judged it, and sets nothing aside`, async () => {
      const w = await comeBack({ facts: false, reel });
      rmSync(join(w.dir, MARKER));
      const there = join(w.found.folder, "app-snapshot", w.T2, w.project, "compositions", "second-card.html");
      const text = readFileSync(there);
      const at = statSync(there).mtime;
      rmSync(there);
      // Dropbox brings the file while the claim looks for what is still arriving: the first look at the snapshot, before the claim, found it short.
      w.t.ctx.deps.stat = (path) => {
        if (path === there && !existsSync(there)) {
          writeFileSync(there, text);
          utimesSync(there, at, at);
        }
        return statSync(path, { throwIfNoEntry: false });
      };
      const was = olderOf(w);
      const r = await app(w.t.ctx.deps, FOLDER, ...w.words);
      assert.deepEqual([r.code, r.said], [1, [OLDER(w.of)]]);
      assert.equal(reread(w.found).editing.by, "Mac Studio", "it was judged once the files were here, which is after the claim");
      assert.deepEqual(treeOf(w.dir), was.tree);
      assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
      assert.deepEqual(w.t.started, [], "no video was asked for");
      w.t.done();
    });
  }
  it("refuses a project whose marker names a snapshot the record never listed and that was named after the newest, as it was: that may be newer work, as when Dropbox undid the record of this Mac's own hand-over, and it is not set aside", async () => {
    const w = await comeBack({ facts: false });
    writeMarker(w.dir, "2026-10-21 08.00.00Z", "Mac Studio");
    let asked = 0;
    w.t.ctx.deps.running = async () => (asked++, true);
    const was = olderOf(w);
    const before = stateOf(w);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [OLDER()]]);
    assert.deepEqual(stateOf(w), before);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
    assert.equal(asked, 0, "HyperFrames is not asked about");
    w.t.done();
  });
  it("opens a project with no marker that is as new as the snapshot or newer, as it did, without asking about HyperFrames", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    assert.equal((await release(w.t.ctx.deps)).code, 0);
    rmSync(join(w.dirOf("main"), MARKER));
    let asked = 0;
    w.t.ctx.deps.running = async () => (asked++, true);
    assert.deepEqual((await app(w.t.ctx.deps, FOLDER)).said, [OPEN, BUTTONS]);
    assert.equal(asked, 0);
    w.t.done();
  });
});

describe("release: an older folder is still refused, in its words, and nothing is moved (plan PR 18, ruling 3)", () => {
  it("is not handed over again, and is not set aside by a hand-over: only `app` sets it aside", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    const folders = readdirSync(join(w.found.folder, "app-snapshot"));
    const rev = reread(w.found).rev;
    const r = await release(w.t.ctx.deps);
    assert.deepEqual([r.code, r.said], [1, [`The HyperFrames project for ${NAME} on this Mac is older than the one the other Mac handed over, so it isn't handed over again. Nothing was handed over. Ask Jason.`]]);
    assert.deepEqual([readdirSync(join(w.found.folder, "app-snapshot")), reread(w.found).rev], [folders, rev]);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
    w.t.done();
  });
});

describe("app: the older project's video (plan PR 18, group F)", () => {
  /** What is said when the video is not kept: the rebuild's own lines and the call for the video. */
  const MADE_AGAIN = (w) => [SET_ASIDE(w.of), REBUILT(w.when, w.of), w.of ? MAKING_REEL : MAKING];
  /** The older folder's video is left in the set-aside folder, the video is asked for once, nothing is opened and the new project has none. */
  async function leftBehind(w, started = 1) {
    const was = olderOf(w);
    const r = await app(w.t.ctx.deps, FOLDER, ...w.words);
    assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
    const [aside] = asidesOf(w);
    assert.equal(lstatSync(join(aside, "media", "recording.mp4")).ino, was.video, "the video stays in the set-aside folder");
    assert.deepEqual(treeOf(aside), was.tree, "which is whole as it was");
    assert.equal(existsSync(join(w.dir, "media")), false);
    assert.equal(w.t.started.length, started);
    assert.deepEqual(runsOf({ home: w.t.home }), [], "the app is not asked yet");
    return r;
  }
  it("is left where it is, and the video asked for as for any rebuilt project, when the facts of the copy are gone from beside the others", async () => {
    const w = await comeBack({ facts: false });
    await leftBehind(w);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER]]);
    w.t.done();
  });
  for (const [what, facts] of [["another size", { bytes: OLD_VIDEO.length + 1 }], ["another picture", { width: 1920, height: 1080 }], ["another length", { seconds: 30 }], ["no length", { seconds: 0 }], ["no frame rate", { fps: 0 }]]) {
    it(`is left where it is when the facts of the copy give ${what}`, async () => {
      const w = await comeBack({ facts });
      await leftBehind(w);
      w.t.done();
    });
  }
  it("is left where it is when it is a link, whatever it leads to: a link moves as a link, and not the video", async () => {
    const w = await comeBack();
    const elsewhere = join(w.t.dir, "elsewhere.mp4");
    writeFileSync(elsewhere, OLD_VIDEO);
    rmSync(join(w.dir, "media", "recording.mp4"));
    symlinkSync(elsewhere, join(w.dir, "media", "recording.mp4"));
    const before = treeOf(w.dir);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
    const [aside] = asidesOf(w);
    assert.deepEqual(treeOf(aside), before);
    assert.equal(readFileSync(elsewhere, "utf8"), OLD_VIDEO);
    assert.equal(existsSync(join(w.dir, "media")), false);
    w.t.done();
  });
  it("is left where it is when it is a link whose own size is the size the copy's facts give: only a plain file is a video, whatever size a link has", async () => {
    const w = await comeBack();
    rmSync(join(w.dir, "media", "recording.mp4"));
    // A link's size is the length of the path it holds; this one holds as many characters as the video has bytes.
    symlinkSync("x".repeat(OLD_VIDEO.length), join(w.dir, "media", "recording.mp4"));
    assert.equal(lstatSync(join(w.dir, "media", "recording.mp4")).size, OLD_VIDEO.length);
    const before = treeOf(w.dir);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
    const [aside] = asidesOf(w);
    assert.deepEqual(treeOf(aside), before);
    assert.equal(existsSync(join(w.dir, "media")), false);
    w.t.done();
  });
  it("is asked for when the older folder has none", async () => {
    const w = await comeBack();
    rmSync(join(w.dir, "media", "recording.mp4"));
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
    w.t.done();
  });
  it("is not kept while a working copy is being made: the run is waited for, as for any rebuilt project", async () => {
    const w = await comeBack();
    mkdirSync(w.work, { recursive: true });
    writeFileSync(join(w.work, "workcopy.lock"), JSON.stringify({ pid: 4242, command: "workcopy" }));
    w.t.ctx.deps.alive = (pid) => pid === 4242;
    const was = olderOf(w);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
    const [aside] = asidesOf(w);
    assert.equal(lstatSync(join(aside, "media", "recording.mp4")).ino, was.video);
    assert.deepEqual(w.t.started, [], "none is asked for while one is at work");
    w.t.done();
  });
  for (const reel of [false, true]) {
    it(`is left where it is, and ${reel ? "the Reel's" : "the"} video asked for, when it cannot be moved in`, async () => {
      const w = await comeBack({ reel });
      const was = olderOf(w);
      w.t.ctx.deps.app = { ...w.t.ctx.deps.app, rename: () => { throw new Error("EXDEV: cross-device link not permitted"); } };
      const r = await app(w.t.ctx.deps, FOLDER, ...w.words);
      assert.deepEqual([r.code, r.said], [0, MADE_AGAIN(w)]);
      const [aside] = asidesOf(w);
      assert.equal(lstatSync(join(aside, "media", "recording.mp4")).ino, was.video);
      assert.equal(existsSync(join(w.dir, "media", "recording.mp4")), false);
      w.t.done();
    });
  }
  it("is not what is put in when a working copy is made already: that copy is, in the words of any video put back, and the older video stays", async () => {
    const w = await comeBack({ facts: false });
    const was = olderOf(w);
    const copy = madeCopy({ home: w.t.home }, w.found);
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [0, [SET_ASIDE(), REBUILT(w.when), BACK, OPEN, BUTTONS]]);
    assert.equal(readFileSync(join(w.dir, "media", "recording.mp4"), "utf8"), COPY_TEXT);
    assert.equal(existsSync(copy.video), false, "the copy is moved in, not copied");
    const [aside] = asidesOf(w);
    assert.equal(lstatSync(join(aside, "media", "recording.mp4")).ino, was.video);
    w.t.done();
  });
  it("is asked for again at the next ask once it was left behind, and the project is not older then: nothing more is set aside", async () => {
    const w = await comeBack({ facts: false });
    await leftBehind(w);
    madeCopy({ home: w.t.home }, w.found);
    const again = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [BACK, OPEN, BUTTONS]]);
    assert.equal(asidesOf(w).length, 1);
    w.t.done();
  });
  it("is the Reel's own check when it is a Reel's: kept when the Reel in the copy's facts starts within half a second of where the project says it does, left where it is when it starts further off", async () => {
    const nudged = (by) => (w) => ({ stretch: { ...reelStretch(w.found.folder, 2).stretch, start: reelStretch(w.found.folder, 2).stretch.start + by } });
    const near = await comeBack({ reel: true, facts: nudged(0.4) });
    const kept = await app(near.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([kept.code, kept.said], [0, [SET_ASIDE("Reel 2 of "), REBUILT(near.when, "Reel 2 of "), KEPT("Reel 2 of "), OPEN, BUTTONS]]);
    near.t.done();
    const far = await comeBack({ reel: true, facts: nudged(0.6) });
    await leftBehind(far);
    assert.deepEqual(far.t.started.map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER, "--reel", "2"]]);
    far.t.done();
  });
  it("is the Reel's video left where it is, and asked for, when its facts are gone, as the main video's is", async () => {
    const w = await comeBack({ reel: true, facts: false });
    await leftBehind(w);
    w.t.done();
  });
});

describe("app: an older project that cannot be set aside is left where it was (plan PR 18, group G)", () => {
  it("says so, and leaves it exactly as it was with nothing of its own beside it, when a write fails; the claim is kept, and the next ask sets it aside", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    const names = readdirSync(w.work).sort();
    let copies = 0;
    const real = w.t.ctx.deps.app;
    w.t.ctx.deps.app = { ...real, fs: { ...nodeFs, copyFileSync: (...args) => (++copies === 4 ? (() => { throw new Error("the disk is full"); })() : nodeFs.copyFileSync(...args)) } };
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [COULD_NOT()]]);
    assert.equal(lstatSync(w.dir).ino, was.ino);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.deepEqual(readdirSync(w.work).sort(), names, "nothing of its own is left beside it");
    assert.equal(reread(w.found).editing.by, "Mac Studio");
    w.t.ctx.deps.app = real;
    const again = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([again.code, again.said], [0, [SET_ASIDE(), REBUILT(w.when), KEPT(), OPEN, BUTTONS]]);
    w.t.done();
  });
  it("says so, and puts the older folder back as it was, when the new project cannot take its place", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    const real = w.t.ctx.deps.app;
    w.t.ctx.deps.app = { ...real, fs: { ...nodeFs, renameSync: (from, to) => (to === w.dir && from.endsWith(".new") ? (() => { throw new Error("EACCES: permission denied"); })() : nodeFs.renameSync(from, to)) } };
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [COULD_NOT()]]);
    assert.equal(lstatSync(w.dir).ino, was.ino);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.deepEqual(asidesOf(w), []);
    assert.equal(readdirSync(w.work).some((name) => name.endsWith(".new") || name.endsWith(".part")), false, "the project it built is gone");
    assert.deepEqual(w.t.started, [], "no video was asked for");
    assert.deepEqual(runsOf({ home: w.t.home }), []);
    w.t.done();
  });
  it("says that the older project was set aside, and nothing deleted, when even putting it back fails, and keeps it whole", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    const real = w.t.ctx.deps.app;
    w.t.ctx.deps.app = { ...real, fs: { ...nodeFs, renameSync: (from, to) => (to === w.dir ? (() => { throw new Error("EACCES: permission denied"); })() : nodeFs.renameSync(from, to)) } };
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [`The older HyperFrames project for ${NAME} was set aside on this Mac and nothing was deleted, but the rebuilt one could not be put in its place. Ask Jason.`]]);
    const [aside] = asidesOf(w);
    assert.equal(lstatSync(aside).ino, was.ino);
    assert.deepEqual(treeOf(aside), was.tree);
    w.t.done();
  });
  it("says the snapshot is not whole, and moves nothing, when a file of it goes between the claim and the rebuild", async () => {
    const w = await comeBack();
    const was = olderOf(w);
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (millis) => {
      rmSync(join(w.found.folder, "app-snapshot", w.T2, MAIN, "index.html"));
      return wait(millis);
    };
    const r = await app(w.t.ctx.deps, FOLDER);
    assert.deepEqual([r.code, r.said], [1, [NOT_WHOLE()]]);
    assert.equal(lstatSync(w.dir).ino, was.ino);
    assert.deepEqual(treeOf(w.dir), was.tree);
    assert.equal(existsSync(join(w.work, ASIDE_DIR)), false);
    w.t.done();
  });
  it("says the same of a Reel, naming it", async () => {
    const w = await comeBack({ reel: true });
    const was = olderOf(w);
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (millis) => {
      rmSync(join(w.found.folder, "app-snapshot", w.T2, REEL2, "index.html"));
      return wait(millis);
    };
    const r = await app(w.t.ctx.deps, FOLDER, "reel", "2");
    assert.deepEqual([r.code, r.said], [1, [NOT_WHOLE("Reel 2 of ")]]);
    assert.deepEqual(treeOf(w.dir), was.tree);
    w.t.done();
  });
});

describe("a set-aside folder is no project to anything that finds projects (plan PR 18, group H)", () => {
  /** An older project as the app and its agent leave one, with its history, its renders and an export's record in them, set aside in `w`'s work folder. */
  function decoy(w, { turn = "2026-10-20T14:50:00-05:00" } = {}) {
    const dir = join(w.work, ASIDE_DIR, `${MAIN} 2026-10-20 20.30.00Z`);
    fillProject(dir);
    writeFileSync(join(dir, ".hyperframes", "app-history.jsonl"), `${JSON.stringify({ at: turn, engine: "claude", asked: "A request in the older project", did: "Done.", files: [] })}\n`);
    writeFileSync(join(dir, "renders", "Pricing_2026-10-20_14-40-00.meta.json"), JSON.stringify({ exportedTo: join(w.downloads, "Pricing.mp4") }));
    writeFileSync(join(dir, "renders", "draft.mp4"), "a render that may be the only copy");
    return dir;
  }
  /** The real project's history, so that there is something for the guide and `what-happened` to say. */
  function history(w, ...turns) {
    mkdirSync(join(w.dirOf("main"), ".hyperframes"), { recursive: true });
    writeFileSync(join(w.dirOf("main"), ".hyperframes", "app-history.jsonl"), turns.map((at, i) => JSON.stringify({ at, engine: "claude", asked: `Request ${i + 1}`, did: "Done.", files: [] })).join("\n") + "\n");
  }
  it("is not read by the guide: what it says of the video is the real project's, whatever the older project's history and renders say", async () => {
    const w = guideWorld();
    history(w, "2026-10-20T14:10:00-05:00");
    const guide = async () => {
      const r = await on(depsOf(w), "guide", "3fa9c1");
      assert.equal(r.code, 0, r.text);
      return r.said;
    };
    const overview = async () => (await on(depsOf(w), "guide")).said;
    const before = [await guide(), await overview()];
    assert.match(before[0].join(" "), /Your last request there was today at 2:10 pm\./);
    decoy(w);
    assert.deepEqual([await guide(), await overview()], before);
    w.t.done();
  });
  it("is not read by what-happened, which says what the real project's history says", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    history(w, "2026-10-20T14:10:00-05:00");
    const before = await app(w.t.ctx.deps, FOLDER, "what-happened");
    assert.match(before.text, /Request 1/);
    decoy(w);
    assert.deepEqual((await app(w.t.ctx.deps, FOLDER, "what-happened")).said, before.said);
    assert.doesNotMatch(before.text, /older project/);
    w.t.done();
  });
  it("is not listed by episodes or status, which say what they said", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    const asked = async () => [(await on(w.t.ctx.deps, "episodes")).said, (await on(w.t.ctx.deps, "status")).said];
    const before = await asked();
    decoy(w);
    assert.deepEqual(await asked(), before);
    w.t.done();
  });
  it("is left whole by free, which takes the real project's paths and names none in it, though its renders hold a video that free would keep an episode for", async () => {
    const w = takeOverWorld({ projects: ["main"], over: { editing: null } });
    rmSync(join(w.dirOf("main"), "renders", "old.mp4"));
    const dir = decoy(w);
    const before = treeOf(dir);
    const ino = lstatSync(dir).ino;
    const r = await on(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.said[0], /^Took away the video made for HyperFrames/);
    assert.equal(existsSync(join(w.dirOf("main"), "media", "recording.mp4")), false, "the real project's video went");
    assert.deepEqual(treeOf(dir), before);
    assert.equal(lstatSync(dir).ino, ino);
    assert.equal(existsSync(join(dir, "renders", "draft.mp4")), true);
    w.t.done();
  });
  it("is left whole by free after a set-aside, though it holds the older project's renders and its video", async () => {
    const w = await comeBack({ facts: false });
    const was = olderOf(w);
    assert.equal((await app(w.t.ctx.deps, FOLDER)).code, 0);
    madeCopy({ home: w.t.home }, w.found);
    const [aside] = asidesOf(w);
    const before = treeOf(aside);
    const r = await on(w.t.ctx.deps, "free", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(treeOf(aside), before);
    assert.deepEqual(before, was.tree);
    w.t.done();
  });
});

describe("every line of an older project's return is plain, for an episode named with an accent and a quote (plan PR 18, group I)", () => {
  it("holds no path, flag or command's name in the lines of the whole return, the refusals and the failures", async () => {
    const name = 'Café: "pricing" talk';
    const lines = [];
    const run = async (deps, ...argv) => lines.push(...(await app(deps, ...argv)).said);
    for (const reel of [false, true]) {
      const w = await comeBack({ reel, name });
      await run(w.t.ctx.deps, FOLDER, ...w.words);
      w.t.done();
      const open = await comeBack({ reel, name });
      open.t.ctx.deps.running = async () => true;
      await run(open.t.ctx.deps, FOLDER, ...open.words);
      open.t.done();
      const lost = await comeBack({ reel, name, facts: false });
      await run(lost.t.ctx.deps, FOLDER, ...lost.words);
      lost.t.done();
    }
    assert.ok(lines.some((line) => line.includes(name)), "the name is said");
    assert.ok(lines.some((line) => line.startsWith("The older HyperFrames project for ")));
    assert.ok(lines.some((line) => line.startsWith("Quit HyperFrames first")));
    for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
  });
});
