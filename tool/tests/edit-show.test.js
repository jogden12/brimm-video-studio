// `show` and `behind` (phase 1b): her session reads an episode's transcript, Claude's notes and the cut plan only through
// edit.js, and asks whether this Mac has the newest brimm-video. git is a stand-in here: no test runs it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { writeStudio } from "../studio.js";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { setup, episodeFor, FOLDER } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, text }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
const TEXTS = {
  transcript: ["Pricing talk.transcript.txt", "[00:00] Welcome to the show.\n[00:05] So the first thing you need to do is know your costs.\n"],
  notes: ["Pricing talk.edit-notes.txt", "Notes for the editor\n\nCut the false start at 0:04.\n"],
  plan: ["Pricing talk.cut-plan.txt", "Cut plan for Pricing talk.mp4\n\nKeeps 0:11 of 0:23.\n"]
};

describe("show", () => {
  it("prints the transcript, Claude's notes or the cut plan, whole", async () => {
    const t = setup();
    const found = episodeFor(t);
    for (const [kind, [file, text]] of Object.entries(TEXTS)) {
      writeFileSync(join(found.folder, file), text);
      const r = await on(t.ctx.deps, "show", FOLDER, kind);
      assert.deepEqual([r.code, r.text], [0, text.replace(/\n$/, "")], kind);
    }
    t.done();
  });
  it("says when the episode has none yet", async () => {
    const t = setup();
    episodeFor(t);
    for (const [kind, what] of [["transcript", "transcript"], ["notes", "notes from Claude"], ["plan", "cut plan"]]) {
      const r = await on(t.ctx.deps, "show", FOLDER, kind);
      assert.deepEqual([r.code, r.text], [1, `Pricing talk has no ${what} yet.`], kind);
    }
    t.done();
  });
  it("has Dropbox bring a file over that is not whole on this Mac yet, and says so", async () => {
    const t = setup();
    const found = episodeFor(t);
    writeFileSync(join(found.folder, TEXTS.notes[0]), TEXTS.notes[1]);
    t.ctx.deps.isWhole = (path) => !path.endsWith(TEXTS.notes[0]);
    const r = await on(t.ctx.deps, "show", FOLDER, "notes");
    assert.deepEqual([r.code, r.text], [1, "Dropbox is still bringing it over; say it again when it is done."]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, TEXTS.notes[0]]]);
    t.done();
  });
  it("shows nothing but those three, and takes no path", async () => {
    const t = setup();
    episodeFor(t);
    for (const argv of [["show", FOLDER], ["show", FOLDER, "../../etc/hosts"], ["show", FOLDER, "/etc/hosts"], ["show", FOLDER, "transcript", "more"], ["show", FOLDER, "record"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.equal(r.code, 2, argv.join(" "));
      assert.match(r.text, /^The command line for episodes on this Mac/, argv.join(" "));
    }
    t.done();
  });
});

describe("behind", () => {
  /** A stand-in for git: each call's arguments and options, and the answers given in turn. */
  const git = (...answers) => {
    const calls = [];
    const run = async (cmd, args, asked = {}) => {
      calls.push({ cmd, args, asked });
      return answers[calls.length - 1] || { code: 0, stderr: "", stdout: "" };
    };
    return { calls, run };
  };
  it("says how many changes Jason has that this Mac has not, asking git with a time limit", async () => {
    const t = setup();
    const g = git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "3\n" });
    const r = await on({ ...t.ctx.deps, run: g.run }, "behind");
    assert.deepEqual([r.code, r.text], [0, "Jason has a newer brimm-video (3 changes). Ask him to update this Mac when it suits."]);
    assert.deepEqual(g.calls.map((c) => c.args), [["-C", "/checkout", "fetch", "-q", "origin", "main"], ["-C", "/checkout", "rev-list", "--count", "HEAD..origin/main"]]);
    for (const c of g.calls) {
      assert.equal(c.asked.limit, 20000);
      assert.ok(c.asked.out > 0);
    }
    t.done();
  });
  it("says one change, and the newest when there are none", async () => {
    const t = setup();
    assert.equal((await on({ ...t.ctx.deps, run: git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "1\n" }).run }, "behind")).text, "Jason has a newer brimm-video (1 change). Ask him to update this Mac when it suits.");
    assert.equal((await on({ ...t.ctx.deps, run: git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "0\n" }).run }, "behind")).text, "This Mac has the newest brimm-video.");
    t.done();
  });
  it("says her folder for Claude is out of date when this checkout would write it otherwise, and the one command that rewrites it (PR 19, the architect's 1.1)", async () => {
    const t = setup();
    const newest = () => git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "0\n" }).run;
    // On a Mac with no folder for Claude, nothing is said of it. (install.sh --machine writes one on each Mac, the Mac Studio's
    // too, when its Claude Code is new enough.)
    assert.equal((await on({ ...t.ctx.deps, run: newest() }, "behind")).text, "This Mac has the newest brimm-video.");
    const folder = writeStudio(t.home, { checkout: "/checkout", node: "/opt/homebrew/bin/node" });
    assert.equal((await on({ ...t.ctx.deps, run: newest() }, "behind")).text, "This Mac has the newest brimm-video.");
    // A git pull brought a newer skill, and the folder still has the one written before.
    const skill = join(folder, ".claude", "skills", "brimm-edit", "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(/\| "Show me the Reels".*\n/, ""));
    const r = await on({ ...t.ctx.deps, run: newest() }, "behind");
    const stale = "Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node /opt/homebrew/bin/node, then start a new session in her Claude folder)";
    assert.deepEqual([r.code, r.text], [0, `This Mac has the newest brimm-video.\n${stale}`]);
    // It needs no network: when git cannot fetch, the folder is still looked at (behind-studio-1).
    const offline = await on({ ...t.ctx.deps, run: git({ code: 128, stderr: "fatal: Could not read from remote repository." }).run }, "behind");
    assert.deepEqual([offline.code, offline.text], [0, `Could not check for a newer brimm-video. Is this Mac offline?\n${stale}`]);
    t.done();
  });
  it("says it could not check when git cannot fetch, runs out of time, or answers something else, and still ends with 0", async () => {
    const t = setup();
    for (const answers of [[{ code: 128, stderr: "fatal: Could not read from remote repository." }], [{ code: 1, stderr: "", outOfTime: true }], [{ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "not a number\n" }]]) {
      const g = git(...answers);
      const r = await on({ ...t.ctx.deps, run: g.run }, "behind");
      assert.deepEqual([r.code, r.text], [0, "Could not check for a newer brimm-video. Is this Mac offline?"]);
    }
    t.done();
  });
});
