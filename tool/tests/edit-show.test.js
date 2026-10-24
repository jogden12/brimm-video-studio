// `show` and `behind` (phase 1b): her session reads an episode's transcript, Claude's notes and the cut plan only through
// edit.js, and asks whether this Mac has the newest brimm-video. git is a stand-in here: no test runs it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { writeStudio } from "../studio.js";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { episodeWork, workFolder } from "../settings.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";

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

describe("show, for a video not yet answered, left alone or a session: a read-only copy on this Mac, in TextEdit", () => {
  const AT = "2026-10-20T15:00:00-05:00";
  const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
  const SESSION_NAME = "Session, 2026-10-14";
  const ASKED = { state: "needs your answer", guess: "raw", seen: "wide, 0:23", came: "camera", match: null };
  const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "yes" };
  /** Each record the gate holds, and how it is named. */
  const HELD = [
    ["a video not yet answered", { version: 3, kind: null, answer: ASKED, label: LABEL }, LABEL],
    ["a video left alone", { version: 3, kind: null, answer: { ...ASKED, state: "not for brimm-video" }, label: LABEL }, LABEL],
    ["a session", { version: 3, kind: "session", answer: ANSWERED, label: LABEL, name: { text: SESSION_NAME, placeholder: false }, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } }, SESSION_NAME]
  ];
  const WHAT = { transcript: "transcript", notes: "notes from Claude", plan: "cut plan" };
  /** The episode's folder on this Mac, where the copies are made. */
  const shownDir = (t) => join(episodeWork(t.home, FOLDER), "shown");
  /** The made-up episode with `record` laid on it, and its three files, each with words of a client's. */
  function held(record) {
    const t = setup();
    const found = episodeFor(t, { record });
    for (const [file, text] of Object.values(TEXTS)) writeFileSync(join(found.folder, file), `Jane Doe of Acme. ${text}`);
    return { t, found };
  }
  for (const [what, record, name] of HELD) {
    it(`copies the file of ${what} into BRIMM Video Work, read-only, opens the copy in TextEdit and prints only that it did`, async () => {
      const { t, found } = held(record);
      for (const [kind, [file]] of Object.entries(TEXTS)) {
        const r = await on(t.ctx.deps, "show", name, kind);
        assert.deepEqual([r.code, r.text], [0, `Opened ${name}'s ${WHAT[kind]} in TextEdit on this Mac.`], kind);
        // One copy, of this file alone: the earlier ones are taken away first.
        const names = readdirSync(shownDir(t));
        assert.equal(names.length, 1, names.join(", "));
        const copy = join(shownDir(t), names[0]);
        assert.equal(readFileSync(copy, "utf8"), readFileSync(join(found.folder, file), "utf8"), kind);
        assert.equal(statSync(copy).mode & 0o777, 0o444, kind);
        // Named by how the video is named, never by its file.
        assert.equal(names[0], `${name.replace(/:/g, "-")} ${WHAT[kind]}.txt`);
        assert.deepEqual(t.opened[t.opened.length - 1], ["TextEdit", copy]);
      }
      // Nothing was brought, started or written into the episode.
      assert.deepEqual([t.started, reread(found).rev], [[], 1]);
      t.done();
    });
  }
  it("copies a file Dropbox has not brought whole yet all the same, since reading it brings it, and starts no bring", async () => {
    const [, record, name] = HELD[0];
    const { t } = held(record);
    const r = await on({ ...t.ctx.deps, isWhole: () => false }, "show", name, "transcript");
    assert.deepEqual([r.code, r.text, t.started], [0, `Opened ${name}'s transcript in TextEdit on this Mac.`, []]);
    assert.equal(readdirSync(shownDir(t)).length, 1);
    t.done();
  });
  it("says when there is no such file, by the video's name, and opens nothing", async () => {
    for (const [, record, name] of HELD) {
      const t = setup();
      episodeFor(t, { record });
      const r = await on(t.ctx.deps, "show", name, "notes");
      assert.deepEqual([r.code, r.text, t.opened], [1, `${name} has no notes from Claude yet.`, []]);
      t.done();
    }
  });
  it("says so, naming no file, when TextEdit cannot be opened", async () => {
    const [, record, name] = HELD[0];
    const { t } = held(record);
    const r = await on({ ...t.ctx.deps, openApp: () => { throw new Error("TextEdit could not be opened (no such app)"); } }, "show", name, "plan");
    assert.deepEqual([r.code, r.text], [1, `${name}: TextEdit could not be opened (no such app).`]);
    t.done();
  });
});

describe("show, for a video she has answered", () => {
  const AT = "2026-10-20T15:00:00-05:00";
  const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
  const ROUGH = "[00:00] Welcome to the show.\n";
  it("prints a raw video's rough cut transcript as its transcript, and a finished video's or a clip's own, as before", async () => {
    for (const [kind, expected] of [["raw", ROUGH], ["finished", TEXTS.transcript[1]], ["short video", TEXTS.transcript[1]], ["episode", TEXTS.transcript[1]]]) {
      const t = setup();
      const record = kind === "episode" ? {} : { version: 3, kind, answer: ANSWERED, name: { text: "Pricing talk", placeholder: false } };
      const found = episodeFor(t, { record });
      writeFileSync(join(found.folder, TEXTS.transcript[0]), TEXTS.transcript[1]);
      writeFileSync(join(found.folder, "Pricing talk.rough-cut.transcript.txt"), ROUGH);
      const r = await on(t.ctx.deps, "show", FOLDER, "transcript");
      assert.deepEqual([r.code, r.text], [0, expected.replace(/\n$/, "")], kind);
      t.done();
    }
  });
});

describe("behind", () => {
  it("clears the copies show made of every episode, at the session's start", async () => {
    const t = setup();
    const made = [];
    for (const folder of [FOLDER, "2026-10-15 Another (Mac Studio)"]) {
      const dir = join(workFolder(t.home), folder, "shown");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "a copy.txt"), "words");
      made.push(dir);
    }
    writeFileSync(join(workFolder(t.home), FOLDER, "kept.txt"), "stays");
    const r = await on({ ...t.ctx.deps, run: async () => ({ code: 0, stderr: "", stdout: "0\n" }) }, "behind");
    assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."]);
    for (const dir of made) assert.ok(!existsSync(dir), dir);
    assert.ok(existsSync(join(workFolder(t.home), FOLDER, "kept.txt")));
    t.done();
  });

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
