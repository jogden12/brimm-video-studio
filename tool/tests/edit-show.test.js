// `show` and `behind` (phase 1b): her session reads an episode's transcript, Claude's notes and the cut plan only through
// edit.js, and asks whether this Mac has the newest brimm-video. And `behind` notices when the lock on her folder has been
// loosened on this Mac (spec 2026-10-22, section 7). git is a stand-in here: no test runs it, and each test has a home of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
  describe("her folder's lock (spec 2026-10-22, section 7)", () => {
    const LOCK = "This folder's lock is changed on this Mac: ask Jason before going on.";
    const NODE = "/opt/homebrew/bin/node";
    /** Words that must never be said: what the two files hold. */
    const SECRET = "SECRET-WORDS-OF-A-FILE";
    /** A Mac with her folder written as the installer writes it. */
    function mac() {
      const t = setup();
      return { t, folder: writeStudio(t.home, { checkout: "/checkout", node: NODE }) };
    }
    /** This Mac's user settings for Claude, ~/.claude/settings.json: the text given, or an object as JSON. */
    function userSettings(t, text) {
      mkdirSync(join(t.home, ".claude"), { recursive: true });
      writeFileSync(join(t.home, ".claude", "settings.json"), typeof text === "string" ? text : JSON.stringify(text));
    }
    /** `behind` on that Mac with git finding it up to date, and the git stand-in, to see whether git was asked at all. */
    async function behindOn(t) {
      const g = git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "0\n" });
      return { ...(await on({ ...t.ctx.deps, run: g.run }, "behind")), g };
    }
    /** Every file under `dir` by its path, with what it holds ("<link to …>" for a link, "<folder>" for a folder). */
    function treeOf(dir, found = new Map(), at = dir) {
      for (const name of readdirSync(at).sort()) {
        const path = join(at, name);
        const kind = lstatSync(path);
        found.set(path.slice(dir.length), kind.isSymbolicLink() ? `<link to ${readlinkSync(path)}>` : kind.isDirectory() ? "<folder>" : readFileSync(path, "utf8"));
        if (kind.isDirectory()) treeOf(dir, found, path);
      }
      return found;
    }
    const LOCAL_WHY = "(Jason: her folder has a .claude/settings.local.json of its own, which can loosen the lock. Its contents are not shown here.)";
    const HOOKS_WHY = "(Jason: this Mac's ~/.claude/settings.json turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)";
    const UNREAD_WHY = "(Jason: this Mac's ~/.claude/settings.json could not be read, so it is not known that hooks are on. Its contents are not shown here.)";

    it("goes on as it always did when her folder is as the installer writes it and this Mac's settings leave hooks on", async () => {
      for (const settings of [undefined, {}, { disableAllHooks: false }, { disableAllHooks: false, env: { A: "b" }, hooks: { Stop: [] }, permissions: { allow: ["Bash(ls)"] } }, { permissions: { disableBypassPermissionsMode: "disable" } }]) {
        const { t } = mac();
        if (settings) userSettings(t, settings);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [0, "This Mac has the newest brimm-video.", 2], JSON.stringify(settings));
        t.done();
      }
    });
    it("goes on when a settings.local.json is anywhere but in her folder's .claude", async () => {
      const { t, folder } = mac();
      userSettings(t, {});
      for (const dir of [join(t.home, ".claude"), join(t.home, "Other"), join(t.home, "Other", ".claude"), folder, join(folder, "Pictures")]) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "settings.local.json"), `{"x":"${SECRET}"}`);
      }
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });
    it("refuses, saying her folder has a settings.local.json and nothing of what it holds, when it has one; git is not asked", async () => {
      const { t, folder } = mac();
      writeFileSync(join(folder, ".claude", "settings.local.json"), JSON.stringify({ permissions: { allow: [`Bash(rm -rf ${SECRET})`] }, disableAllHooks: true }));
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${LOCAL_WHY}`, 0]);
      assert.ok(!r.text.includes(SECRET) && !/rm -rf/.test(r.text), r.text);
      t.done();
    });
    it("refuses, saying this Mac's settings turn hooks off and nothing of what they hold, when disableAllHooks is true there", async () => {
      const { t } = mac();
      userSettings(t, { env: { TOKEN: SECRET }, disableAllHooks: true });
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${HOOKS_WHY}`, 0]);
      assert.ok(!r.text.includes(SECRET), r.text);
      t.done();
    });
    it("says both when both are so, her folder's first", async () => {
      const { t, folder } = mac();
      writeFileSync(join(folder, ".claude", "settings.local.json"), "{}");
      userSettings(t, { disableAllHooks: true });
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [1, `${LOCK}\n${LOCAL_WHY}\n${HOOKS_WHY}`]);
      t.done();
    });
    it("takes whatever is called settings.local.json in her folder's .claude for one: an empty file, a folder, a link to nowhere", async () => {
      for (const make of [(file) => writeFileSync(file, ""), (file) => mkdirSync(file), (file) => symlinkSync(join(file, "..", "nowhere"), file)]) {
        const { t, folder } = mac();
        make(join(folder, ".claude", "settings.local.json"));
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [1, `${LOCK}\n${LOCAL_WHY}`], make.toString());
        t.done();
      }
    });
    it("finds her folder when ~/BRIMM Video Studio is a link to it", async () => {
      const t = setup();
      mkdirSync(join(t.home, "elsewhere"), { recursive: true });
      symlinkSync(join(t.home, "elsewhere"), join(t.home, "BRIMM Video Studio"));
      const folder = writeStudio(t.home, { checkout: "/checkout", node: NODE });
      assert.equal(folder, realpathSync(join(t.home, "elsewhere")));
      assert.equal((await behindOn(t)).code, 0);
      writeFileSync(join(folder, ".claude", "settings.local.json"), "{}");
      assert.deepEqual([(await behindOn(t)).code, (await behindOn(t)).text], [1, `${LOCK}\n${LOCAL_WHY}`]);
      t.done();
    });
    it("cannot tell, and so refuses, when this Mac's settings cannot be read as the JSON object they should be, or disableAllHooks is anything but false", async () => {
      for (const text of ["{ not json", "", "[]", '"hooks"', "null", '{"disableAllHooks": "true"}', '{"disableAllHooks": 1}', '{"disableAllHooks": null}', '{"disableAllHooks": "false"}']) {
        const { t } = mac();
        userSettings(t, text);
        const r = await behindOn(t);
        assert.equal(r.code, 1, JSON.stringify(text));
        assert.equal(r.text.split("\n")[0], LOCK, JSON.stringify(text));
        assert.ok([HOOKS_WHY, UNREAD_WHY].includes(r.text.split("\n")[1]) && r.text.split("\n").length === 2, `${JSON.stringify(text)}: ${r.text}`);
        assert.equal(r.g.calls.length, 0);
        t.done();
      }
      // A settings file that is not a file cannot be read either.
      const { t } = mac();
      mkdirSync(join(t.home, ".claude", "settings.json"), { recursive: true });
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [1, `${LOCK}\n${UNREAD_WHY}`]);
      t.done();
    });
    it("cannot tell, and so refuses, when it is not allowed to look for a settings.local.json in her folder", async (c) => {
      if (process.getuid && process.getuid() === 0) return c.skip("root can look anywhere");
      const { t, folder } = mac();
      const dir = join(folder, ".claude");
      chmodSync(dir, 0o000);
      try {
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text.split("\n")[0], r.text.split("\n")[1]], [1, LOCK, "(Jason: her folder's .claude/settings.local.json could not be looked for, so it is not known that there is none.)"]);
      } finally {
        chmodSync(dir, 0o755);
      }
      t.done();
    });
    it("looks at this Mac's settings when it has no folder for Claude, which hooks off would defeat the lock of too; and goes on when they are not", async () => {
      const t = setup();
      userSettings(t, { disableAllHooks: true });
      assert.deepEqual([(await behindOn(t)).code, (await behindOn(t)).text], [1, `${LOCK}\n${HOOKS_WHY}`]);
      userSettings(t, { disableAllHooks: false });
      assert.deepEqual([(await behindOn(t)).code, (await behindOn(t)).text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });
    it("writes nothing when it refuses, and still clears the copies show made", async () => {
      const { t, folder } = mac();
      writeFileSync(join(folder, ".claude", "settings.local.json"), `{"x":"${SECRET}"}`);
      userSettings(t, { disableAllHooks: true });
      const shown = join(workFolder(t.home), FOLDER, "shown");
      mkdirSync(shown, { recursive: true });
      writeFileSync(join(shown, "a copy.txt"), "words");
      const before = [treeOf(folder), treeOf(join(t.home, ".claude"))];
      const r = await behindOn(t);
      assert.equal(r.code, 1);
      assert.deepEqual([treeOf(folder), treeOf(join(t.home, ".claude"))], before);
      assert.ok(!existsSync(shown));
      t.done();
    });
    it("refuses at every session start while the lock is loosened, and no more once it is put right", async () => {
      const { t, folder } = mac();
      const local = join(folder, ".claude", "settings.local.json");
      writeFileSync(local, "{}");
      assert.equal((await behindOn(t)).code, 1);
      assert.equal((await behindOn(t)).code, 1);
      rmSync(local);
      assert.deepEqual([(await behindOn(t)).code, (await behindOn(t)).text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });
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
