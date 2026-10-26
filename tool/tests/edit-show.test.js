// `show` and `behind` (phase 1b): her session reads an episode's transcript, Claude's notes and the cut plan only through
// edit.js, and asks whether this Mac has the newest brimm-video. And `behind` notices when the lock on her folder has been
// loosened on this Mac (spec 2026-10-22, section 7). git is a stand-in here: no test runs it, and each test has a home of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { writeStudio } from "../studio.js";
import { dirname, join } from "node:path";
import { SHOWN_MARKER, editMain } from "../edit.js";
import { episodeWork, workFolder } from "../settings.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";

const notAMac = process.platform !== "darwin" ? "managed preferences are a Mac's, and plutil, which reads them, is a Mac's" : false;

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
        const names = readdirSync(shownDir(t)).filter((n) => n !== SHOWN_MARKER);
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
    assert.equal(readdirSync(shownDir(t)).filter((n) => n !== SHOWN_MARKER).length, 1);
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
      // Listed by the folder's marker, as show lists each copy it makes (final fix 16).
      writeFileSync(join(dir, SHOWN_MARKER), JSON.stringify({ files: ["a copy.txt"] }));
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
    async function behindOn(t, more = {}) {
      const g = git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "0\n" });
      return { ...(await on({ ...t.ctx.deps, run: g.run, ...more }, "behind")), g };
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
    const INSIDE_WHY = "(Jason: this session runs in a folder inside her folder for Claude, not in the folder itself, and Claude Code reads the folder's lock only in the folder itself. Start her sessions on ~/BRIMM Video Studio itself.)";
    const ELSEWHERE_WHY = "(Jason: this session runs in a folder other than her folder for Claude, and Claude Code reads the folder's lock only in the folder itself. Start her sessions on ~/BRIMM Video Studio itself.)";
    /** The managed preferences' file for Claude Code, and a property list of `entries` (true, false or words) as a person writes one. */
    const PREFS_FILE = "com.anthropic.claudecode.plist";
    const plist = (entries) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${Object.entries(entries).map(([key, value]) => `  <key>${key}</key>${value === true ? "<true/>" : value === false ? "<false/>" : `<string>${value}</string>`}\n`).join("")}</dict>\n</plist>\n`;
    /** The server-managed settings, as `behind` names the copy Claude Code keeps of them. */
    const REMOTE = "the server-managed ones Claude Code keeps in ~/.claude/remote-settings.json";

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
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [1, `${LOCK}\n${LOCAL_WHY}`]);
      t.done();
    });
    it("goes on when this Mac's settings are not a JSON object with disableAllHooks true: Claude Code ignores such a file, and only true turns hooks off", async () => {
      const BOM = "\ufeff";
      for (const text of ["{ not json", "", "[]", '"hooks"', "null", `${BOM}{"disableAllHooks": true}`, '{\n  // hooks off\n  "disableAllHooks": true\n}', '{"disableAllHooks": true,}',
        '{"disableAllHooks": "true"}', '{"disableAllHooks": 1}', '{"disableAllHooks": null}', '{"disableAllHooks": "false"}', '{"disableAllHooks": []}']) {
        const { t } = mac();
        userSettings(t, text);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [0, "This Mac has the newest brimm-video.", 2], JSON.stringify(text));
        t.done();
      }
      // A settings file that is not a file is no file.
      const { t } = mac();
      mkdirSync(join(t.home, ".claude", "settings.json"), { recursive: true });
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."]);
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
      const off = await behindOn(t);
      assert.deepEqual([off.code, off.text], [1, `${LOCK}\n${HOOKS_WHY}`]);
      userSettings(t, { disableAllHooks: false });
      const on_ = await behindOn(t);
      assert.deepEqual([on_.code, on_.text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });
    // --- Her folder's own .claude/settings.json: the lock is what it says (fix round 1, item 1) ---
    const FOLDER_UNREAD_WHY = "(Jason: her folder's .claude/settings.json is not there, or could not be read as a JSON object, so it is not known that the guard is on. Its contents are not shown here.)";
    const FOLDER_HOOKS_WHY = "(Jason: her folder's .claude/settings.json turns hooks off (disableAllHooks), and the lock rests on them. Its contents are not shown here.)";
    const FOLDER_GUARD_WHY = "(Jason: her folder's .claude/settings.json no longer has the guard hook this brimm-video writes for it. Its contents are not shown here.)";
    const BYPASS = "does not disable Bypass mode (disableBypassPermissionsMode)";
    const AUTO = "does not disable Auto mode (disableAutoMode)";
    const modesWhy = (...parts) => `(Jason: her folder's .claude/settings.json ${parts.join(" and ")}. Its contents are not shown here.)`;
    /** Her folder's settings, changed by `change` (which is given them, and may return nothing), and written back. */
    function editSettings(folder, change) {
      const file = join(folder, ".claude", "settings.json");
      const settings = JSON.parse(readFileSync(file, "utf8"));
      change(settings);
      writeFileSync(file, JSON.stringify(settings, null, 2));
    }
    const guardOf = (settings) => settings.hooks.PreToolUse[0].hooks[0];
    it("goes on, as before, when her folder's settings are as the installer writes them", async () => {
      const { t, folder } = mac();
      assert.equal(guardOf(JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"))).onFailure, "block");
      const r = await behindOn(t);
      assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });
    it("refuses when her folder's own settings.json no longer holds the lock, saying which part and nothing of what it holds", async () => {
      const OTHER = { hooks: [{ type: "command", command: "/bin/sh", args: ["/checkout/tool/studio/guard.sh", NODE, "/elsewhere"], onFailure: "block" }] };
      const cases = [
        ["hooks turned off", (s) => { s.disableAllHooks = true; }, [FOLDER_HOOKS_WHY]],
        ["the hooks taken out and Bash(*) allowed", (s) => { delete s.hooks; s.permissions.allow = ["Bash(*)"]; }, [FOLDER_GUARD_WHY]],
        ["no PreToolUse", (s) => { s.hooks = {}; }, [FOLDER_GUARD_WHY]],
        ["PreToolUse empty", (s) => { s.hooks.PreToolUse = []; }, [FOLDER_GUARD_WHY]],
        ["PreToolUse not a list", (s) => { s.hooks.PreToolUse = { matcher: "*" }; }, [FOLDER_GUARD_WHY]],
        ["the guard's matcher narrowed", (s) => { s.hooks.PreToolUse[0].matcher = "Bash"; }, [FOLDER_GUARD_WHY]],
        ["the guard's matcher empty", (s) => { delete s.hooks.PreToolUse[0].matcher; }, [FOLDER_GUARD_WHY]],
        ["another command for the hook", (s) => { guardOf(s).command = "/bin/bash"; }, [FOLDER_GUARD_WHY]],
        ["another type of hook", (s) => { guardOf(s).type = "prompt"; }, [FOLDER_GUARD_WHY]],
        ["another script for the guard", (s) => { guardOf(s).args[0] = "/checkout/tool/studio/other.sh"; }, [FOLDER_GUARD_WHY]],
        ["another checkout's guard", (s) => { guardOf(s).args[0] = "/elsewhere/tool/studio/guard.sh"; }, [FOLDER_GUARD_WHY]],
        ["another folder given to the guard", (s) => { guardOf(s).args[2] = "/elsewhere"; }, [FOLDER_GUARD_WHY]],
        ["the guard given no folder", (s) => { guardOf(s).args.length = 2; }, [FOLDER_GUARD_WHY]],
        ["the guard with no args", (s) => { delete guardOf(s).args; }, [FOLDER_GUARD_WHY]],
        ["a hook that lets a call through when it cannot run", (s) => { guardOf(s).onFailure = "allow"; }, [FOLDER_GUARD_WHY]],
        ["a hook with no word on failure", (s) => { delete guardOf(s).onFailure; }, [FOLDER_GUARD_WHY]],
        ["no hook in the entry", (s) => { s.hooks.PreToolUse[0].hooks = []; }, [FOLDER_GUARD_WHY]],
        ["the guard for another folder only", (s) => { s.hooks.PreToolUse = [{ matcher: "*", ...OTHER }]; }, [FOLDER_GUARD_WHY]],
        ["Bypass mode not disabled", (s) => { delete s.permissions.disableBypassPermissionsMode; }, [modesWhy(BYPASS)]],
        ["Bypass mode enabled", (s) => { s.permissions.disableBypassPermissionsMode = "enable"; }, [modesWhy(BYPASS)]],
        ["Auto mode not disabled", (s) => { delete s.permissions.disableAutoMode; }, [modesWhy(AUTO)]],
        ["Auto mode enabled", (s) => { s.permissions.disableAutoMode = "enable"; }, [modesWhy(AUTO)]],
        ["both modes not disabled", (s) => { s.permissions.disableAutoMode = false; s.permissions.disableBypassPermissionsMode = false; }, [modesWhy(BYPASS, AUTO)]],
        ["no permissions", (s) => { delete s.permissions; }, [modesWhy(BYPASS, AUTO)]],
        ["hooks off, no guard, modes enabled: each said, hooks first", (s) => { s.disableAllHooks = true; delete s.hooks; s.permissions = {}; }, [FOLDER_HOOKS_WHY, FOLDER_GUARD_WHY, modesWhy(BYPASS, AUTO)]]
      ];
      for (const [what, change, lines] of cases) {
        const { t, folder } = mac();
        editSettings(folder, (s) => { s.env = { TOKEN: SECRET }; change(s); });
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, [LOCK, ...lines].join("\n"), 0], what);
        assert.ok(!r.text.includes(SECRET), what);
        t.done();
      }
    });
    it("refuses when her folder's settings.json is not there, is not JSON, or is not an object, or .claude is a file", async () => {
      const cases = [
        ["deleted", (folder) => rmSync(join(folder, ".claude", "settings.json"))],
        ["not JSON", (folder) => writeFileSync(join(folder, ".claude", "settings.json"), `{ "env": "${SECRET}" `)],
        ["empty", (folder) => writeFileSync(join(folder, ".claude", "settings.json"), "")],
        ["a list", (folder) => writeFileSync(join(folder, ".claude", "settings.json"), "[]")],
        ["null", (folder) => writeFileSync(join(folder, ".claude", "settings.json"), "null")],
        ["a folder", (folder) => { rmSync(join(folder, ".claude", "settings.json")); mkdirSync(join(folder, ".claude", "settings.json")); }],
        [".claude a file", (folder) => { rmSync(join(folder, ".claude"), { recursive: true }); writeFileSync(join(folder, ".claude"), SECRET); }]
      ];
      for (const [what, make] of cases) {
        const { t, folder } = mac();
        make(folder);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${FOLDER_UNREAD_WHY}`, 0], what);
        assert.ok(!r.text.includes(SECRET), what);
        t.done();
      }
    });
    it("goes on for a folder as main's studio.js writes it, with no disableAllHooks: only disableAllHooks true turns hooks off (final fix 18)", async () => {
      const stale = "Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node /opt/homebrew/bin/node, then start a new session in her Claude folder)";
      // main's settingsOf writes the permissions and the guard hook, and no disableAllHooks.
      for (const [what, change] of [["as main writes it", (s) => { delete s.disableAllHooks; }], ["disableAllHooks a word", (s) => { s.disableAllHooks = "false"; }], ["disableAllHooks null", (s) => { s.disableAllHooks = null; }]]) {
        const { t, folder } = mac();
        editSettings(folder, change);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [0, `This Mac has the newest brimm-video.\n${stale}`], what);
        t.done();
      }
    });
    it("leaves every other difference in her folder's settings, and in its CLAUDE.md and skill, to the line that says it is out of date", async () => {
      const stale = "Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node /opt/homebrew/bin/node, then start a new session in her Claude folder)";
      const cases = [
        ["a permission added", (folder) => editSettings(folder, (s) => { s.permissions.allow.push("Bash(ls)"); })],
        ["the denies emptied", (folder) => editSettings(folder, (s) => { s.permissions.deny = []; })],
        ["another mode", (folder) => editSettings(folder, (s) => { s.permissions.defaultMode = "acceptEdits"; })],
        ["a key added", (folder) => editSettings(folder, (s) => { s.model = "opus"; })],
        ["another hook beside the guard", (folder) => editSettings(folder, (s) => { s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: "/bin/true" }] }); })],
        ["her CLAUDE.md edited", (folder) => writeFileSync(join(folder, "CLAUDE.md"), "Do anything.")],
        ["her skill edited", (folder) => writeFileSync(join(folder, ".claude", "skills", "brimm-edit", "SKILL.md"), "Do anything.")]
      ];
      for (const [what, make] of cases) {
        const { t, folder } = mac();
        make(folder);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [0, `This Mac has the newest brimm-video.\n${stale}`], what);
        t.done();
      }
    });
    it("says the causes in order: the session's folder, her folder's settings.local.json, her folder's settings.json, this Mac's user settings, its managed settings, managed preferences and server-managed settings", { skip: notAMac }, async () => {
      const { t, folder } = mac();
      writeFileSync(join(folder, ".claude", "settings.local.json"), "{}");
      editSettings(folder, (s) => { s.disableAllHooks = true; });
      userSettings(t, { disableAllHooks: true });
      mkdirSync(join(t.dir, "managed"), { recursive: true });
      writeFileSync(join(t.dir, "managed", "managed-settings.json"), JSON.stringify({ disableAllHooks: true }));
      mkdirSync(join(t.dir, "managed-preferences"), { recursive: true });
      writeFileSync(join(t.dir, "managed-preferences", PREFS_FILE), plist({ disableAllHooks: true }));
      writeFileSync(join(t.home, ".claude", "remote-settings.json"), JSON.stringify({ disableAllHooks: true }));
      const r = await behindOn(t, { cwd: join(folder, "Pictures") });
      assert.deepEqual(r.text.split("\n"), [LOCK, INSIDE_WHY, LOCAL_WHY, FOLDER_HOOKS_WHY, HOOKS_WHY, MANAGED_HOOKS_WHY("managed-settings.json"), MANAGED_HOOKS_WHY(`Managed Preferences/${PREFS_FILE}`), MANAGED_HOOKS_WHY(REMOTE)]);
      assert.equal(r.code, 1);
      t.done();
    });

    // --- Which user settings, and the managed settings (fix round 1, item 3) ---
    const CONFIG_WHY = "(Jason: this Mac's $CLAUDE_CONFIG_DIR/settings.json turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)";
    const MANAGED_HOOKS_WHY = (file) => `(Jason: this Mac's managed settings, ${file}, turn hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`;
    const MANAGED_ONLY_WHY = (file) => `(Jason: this Mac's managed settings, ${file}, allow only managed hooks (allowManagedHooksOnly), so the guard hook, which is not a managed one, does not run. Its contents are not shown here.)`;
    it("reads the user settings from CLAUDE_CONFIG_DIR when that is set, and from ~/.claude when it is not", async () => {
      const { t } = mac();
      const config = join(t.dir, "config");
      mkdirSync(config, { recursive: true });
      // The hook is off in ~/.claude only: with the configuration home elsewhere, that file is not the user settings.
      userSettings(t, { disableAllHooks: true });
      const elsewhere = await behindOn(t, { env: { CLAUDE_CONFIG_DIR: config } });
      assert.deepEqual([elsewhere.code, elsewhere.text], [0, "This Mac has the newest brimm-video."]);
      // ...and off in the configuration home is.
      writeFileSync(join(config, "settings.json"), JSON.stringify({ disableAllHooks: true, env: { TOKEN: SECRET } }));
      const named = await behindOn(t, { env: { CLAUDE_CONFIG_DIR: config } });
      assert.deepEqual([named.code, named.text, named.g.calls.length], [1, `${LOCK}\n${CONFIG_WHY}`, 0]);
      assert.ok(!named.text.includes(SECRET));
      // Without the variable, or with it empty, it is ~/.claude's.
      for (const env of [{}, { CLAUDE_CONFIG_DIR: "" }]) {
        const home = await behindOn(t, { env });
        assert.deepEqual([home.code, home.text], [1, `${LOCK}\n${HOOKS_WHY}`], JSON.stringify(env));
      }
      t.done();
    });
    it("refuses when this Mac's managed settings, or one of their drop-ins, turn hooks off or allow only managed hooks, and says which file", async () => {
      const managed = (t) => join(t.dir, "managed");
      const put = (t, name, text) => {
        mkdirSync(dirname(join(managed(t), name)), { recursive: true });
        writeFileSync(join(managed(t), name), typeof text === "string" ? text : JSON.stringify(text));
      };
      const cases = [
        ["hooks off", [["managed-settings.json", { disableAllHooks: true, env: { TOKEN: SECRET } }]], [MANAGED_HOOKS_WHY("managed-settings.json")]],
        ["only managed hooks", [["managed-settings.json", { allowManagedHooksOnly: true }]], [MANAGED_ONLY_WHY("managed-settings.json")]],
        ["both in one file", [["managed-settings.json", { disableAllHooks: true, allowManagedHooksOnly: true }]], [MANAGED_HOOKS_WHY("managed-settings.json"), MANAGED_ONLY_WHY("managed-settings.json")]],
        ["a drop-in", [["managed-settings.d/50-hooks.json", { disableAllHooks: true }]], [MANAGED_HOOKS_WHY("managed-settings.d/50-hooks.json")]],
        ["two drop-ins, in the order Claude Code reads them", [["managed-settings.d/60-b.json", { allowManagedHooksOnly: true }], ["managed-settings.d/10-a.json", { disableAllHooks: true }]], [MANAGED_HOOKS_WHY("managed-settings.d/10-a.json"), MANAGED_ONLY_WHY("managed-settings.d/60-b.json")]],
        ["the file and a drop-in", [["managed-settings.d/10-a.json", { disableAllHooks: true }], ["managed-settings.json", { disableAllHooks: true }]], [MANAGED_HOOKS_WHY("managed-settings.json"), MANAGED_HOOKS_WHY("managed-settings.d/10-a.json")]],
        ["a drop-in that is a link", [["managed-settings.d/20-link.json", null]], [MANAGED_HOOKS_WHY("managed-settings.d/20-link.json")]]
      ];
      for (const [what, files, lines] of cases) {
        const { t } = mac();
        for (const [name, text] of files) {
          if (text !== null) put(t, name, text);
          else {
            put(t, "other/target.json", { disableAllHooks: true });
            mkdirSync(dirname(join(managed(t), name)), { recursive: true });
            symlinkSync(join(managed(t), "other", "target.json"), join(managed(t), name));
          }
        }
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, [LOCK, ...lines].join("\n"), 0], what);
        assert.ok(!r.text.includes(SECRET), what);
        t.done();
      }
    });
    it("goes on when the managed settings say neither, or are files Claude Code would not read", async () => {
      const BOM = "\ufeff";
      const cases = [
        ["managed-settings.json", { disableAllHooks: false, allowManagedHooksOnly: false }],
        ["managed-settings.json", { env: { A: "b" }, allowManagedPluginsOnly: true }],
        ["managed-settings.json", { disableAllHooks: "true", allowManagedHooksOnly: 1 }],
        ["managed-settings.json", "{ not json"],
        ["managed-settings.json", ""],
        ["managed-settings.json", "[]"],
        ["managed-settings.json", `${BOM}{"disableAllHooks": true}`],
        ["managed-settings.d/10-a.json", '{"disableAllHooks": true,}'],
        ["managed-settings.d/.hidden.json", { disableAllHooks: true }],
        ["managed-settings.d/notes.txt", { disableAllHooks: true }],
        ["managed-settings.d/sub/20-b.json", { disableAllHooks: true }],
        ["managed-settings.d/x.json/y.json", { disableAllHooks: true }],
        ["managed-settings.json.bak", { disableAllHooks: true }],
        ["other-settings.json", { disableAllHooks: true }]
      ];
      for (const [name, text] of cases) {
        const { t } = mac();
        mkdirSync(dirname(join(t.dir, "managed", name)), { recursive: true });
        writeFileSync(join(t.dir, "managed", name), typeof text === "string" ? text : JSON.stringify(text));
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."], `${name}: ${JSON.stringify(text)}`);
        t.done();
      }
      // A managed settings folder that is not there is the usual case on a Mac nobody manages.
      const { t } = mac();
      assert.ok(!existsSync(join(t.dir, "managed")));
      assert.equal((await behindOn(t)).code, 0);
      t.done();
    });
    it("reads the managed settings from the folder Claude Code uses on a Mac unless it is told another", () => {
      // The folder is injectable for the tests above; on a Mac it is this one (and Claude Code's drop-ins are in managed-settings.d).
      assert.match(readFileSync(new URL("../edit.js", import.meta.url), "utf8"), /const MANAGED_DIR = "\/Library\/Application Support\/ClaudeCode";/);
    });

    // --- When brimm-video has no settings on this Mac (fix round 1, item 4) ---
    describe("on a Mac with no settings for episodes", () => {
      const THIS_CHECKOUT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
      /** A home with no settings for brimm-video, the managed folders and the environment of the test, and what `behind` says there,
          run in the folder `cwd` gives for the home (her folder for Claude unless a test says otherwise), or, when it is null, in the
          folder this test runs in. */
      async function bare(prepare = () => {}, cwd = (home) => join(home, "BRIMM Video Studio")) {
        const dir = mkdtempSync(join(tmpdir(), "brimm-lock-"));
        const home = join(dir, "home");
        mkdirSync(home, { recursive: true });
        prepare(home);
        const said = [];
        const code = await editMain(["behind"], { home, say: (line) => said.push(line), env: {}, managedDir: join(dir, "managed"), managedPrefs: join(dir, "managed-preferences"), user: "sallie", ...(cwd && { cwd: cwd(home) }), run: async () => assert.fail("git is not run") });
        rmSync(dir, { recursive: true, force: true });
        return { code, text: said.join("\n") };
      }
      const NOT_SET_UP = "This Mac is not set up for episodes yet. Jason runs install.sh --machine on it.";
      it("is as it was when the lock holds, or there is no folder", async () => {
        assert.deepEqual(await bare(), { code: 2, text: NOT_SET_UP });
        assert.deepEqual(await bare((home) => writeStudio(home, { checkout: THIS_CHECKOUT, node: NODE })), { code: 2, text: NOT_SET_UP });
      });
      it("still refuses when the lock is loosened: her folder's settings.local.json or settings, or the user settings", async () => {
        const local = await bare((home) => writeFileSync(join(writeStudio(home, { checkout: THIS_CHECKOUT, node: NODE }), ".claude", "settings.local.json"), "{}"));
        assert.deepEqual(local, { code: 1, text: `${LOCK}\n${LOCAL_WHY}` });
        const hooks = await bare((home) => {
          mkdirSync(join(home, ".claude"), { recursive: true });
          writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify({ disableAllHooks: true }));
        });
        assert.deepEqual(hooks, { code: 1, text: `${LOCK}\n${HOOKS_WHY}` });
        const folder = await bare((home) => editSettings(writeStudio(home, { checkout: THIS_CHECKOUT, node: NODE }), (s) => { s.disableAllHooks = true; }));
        assert.deepEqual(folder, { code: 1, text: `${LOCK}\n${FOLDER_HOOKS_WHY}` });
      });
      it("takes the checkout this edit.js runs from for the guard her folder's settings should name", async () => {
        const other = await bare((home) => writeStudio(home, { checkout: "/elsewhere", node: NODE }));
        assert.deepEqual(other, { code: 1, text: `${LOCK}\n${FOLDER_GUARD_WHY}` });
      });
      it("still refuses when the session is not in her folder, and takes the folder edit.js runs in for the session's when it is given none", async () => {
        const write = (home) => writeStudio(home, { checkout: THIS_CHECKOUT, node: NODE });
        assert.deepEqual(await bare(write, (home) => join(home, "BRIMM Video Studio", "Pictures")), { code: 1, text: `${LOCK}\n${INSIDE_WHY}` });
        assert.deepEqual(await bare(write, (home) => home), { code: 1, text: `${LOCK}\n${ELSEWHERE_WHY}` });
        // This test runs in no folder for Claude, and edit.js, as Claude Code runs it, in the session's.
        assert.notEqual(realpathSync(process.cwd()).split("/").pop(), "BRIMM Video Studio");
        assert.deepEqual(await bare(write, null), { code: 1, text: `${LOCK}\n${ELSEWHERE_WHY}` });
      });
    });
    it("writes nothing when it refuses, and still clears the copies show made", async () => {
      const { t, folder } = mac();
      writeFileSync(join(folder, ".claude", "settings.local.json"), `{"x":"${SECRET}"}`);
      userSettings(t, { disableAllHooks: true });
      const shown = join(workFolder(t.home), FOLDER, "shown");
      mkdirSync(shown, { recursive: true });
      writeFileSync(join(shown, "a copy.txt"), "words");
      writeFileSync(join(shown, SHOWN_MARKER), JSON.stringify({ files: ["a copy.txt"] }));
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
      const put = await behindOn(t);
      assert.deepEqual([put.code, put.text], [0, "This Mac has the newest brimm-video."]);
      t.done();
    });

    // --- The session's own folder (2026-10-25). Claude Code 2.1.308 reads .claude/settings.json only from the folder a session runs
    // in, but her CLAUDE.md and her skill from the folders above it too. So a session in Pictures, or in a folder above hers, looks
    // like hers and has no guard, no deny list and no Auto and Bypass off. Her skill runs `behind` first, as Claude Code runs every
    // command, in the session's folder, which a locked session cannot change: the guard lets only edit.js run. ---
    it("refuses when the session runs in a folder inside hers, Pictures among them, saying nothing of which; git is not asked", async () => {
      const { t, folder } = mac();
      mkdirSync(join(folder, `Client ${SECRET}`), { recursive: true });
      for (const cwd of [join(folder, "Pictures"), join(folder, ".claude"), join(folder, `Client ${SECRET}`)]) {
        const r = await behindOn(t, { cwd });
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${INSIDE_WHY}`, 0], cwd);
      }
      t.done();
    });
    it("refuses when the session runs in a folder above hers, beside it, anywhere else, or in one that is not there any more", async () => {
      const { t } = mac();
      mkdirSync(join(t.home, "BRIMM Video Studio copy"), { recursive: true });
      for (const cwd of [t.home, dirname(t.home), "/", join(t.home, "BRIMM Video Studio copy"), join(t.home, "gone")]) {
        const r = await behindOn(t, { cwd });
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${ELSEWHERE_WHY}`, 0], cwd);
      }
      t.done();
    });
    it("goes on when the session runs in her folder itself, by any path that leads there: a link, .. or another case", async () => {
      const { t, folder } = mac();
      symlinkSync(folder, join(t.home, "Studio link"));
      const paths = [folder, join(t.home, "BRIMM Video Studio"), join(t.home, "Studio link"), join(folder, "Pictures", "..")];
      // A Mac's disk does not mind case, unless it was made to.
      if (existsSync(join(t.home, "brimm video studio"))) paths.push(join(t.home, "brimm video studio"));
      for (const cwd of paths) {
        const r = await behindOn(t, { cwd });
        assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."], cwd);
      }
      t.done();
    });
    it("says nothing of the session's folder on a Mac with no folder for Claude: no session there looks like hers", async () => {
      const t = setup();
      for (const cwd of [t.home, "/"]) assert.deepEqual((await behindOn(t, { cwd })).code, 0, cwd);
      t.done();
    });
    it("takes the folder edit.js runs in for the session's unless a test gives another", () => {
      assert.match(readFileSync(new URL("../edit.js", import.meta.url), "utf8"), /\(deps\.cwd \|\| process\.cwd\(\)\)/);
    });

    // --- This Mac's managed preferences, and its server-managed settings (2026-10-25). Claude Code 2.1.308's own binary reads managed
    // settings from these too: the managed preferences of the user, /Library/Managed Preferences/<user>/com.anthropic.claudecode.plist,
    // then the Mac's, /Library/Managed Preferences/com.anthropic.claudecode.plist, each made JSON by /usr/bin/plutil; and the settings
    // a server sends for her account, which it keeps in remote-settings.json beside the user settings. ---
    const prefs = (t) => join(t.dir, "managed-preferences");
    /** A managed preferences file at `name` in the test's folder for them: a property list of `entries`, or the words given. */
    function putPrefs(t, name, entries) {
      mkdirSync(dirname(join(prefs(t), name)), { recursive: true });
      writeFileSync(join(prefs(t), name), typeof entries === "string" ? entries : plist(entries));
      return join(prefs(t), name);
    }
    it("refuses when this Mac's managed preferences, the user's or the Mac's, turn hooks off or allow only managed hooks, and says which file", { skip: notAMac }, async () => {
      const MAC = `Managed Preferences/${PREFS_FILE}`;
      const USER = `Managed Preferences/sallie/${PREFS_FILE}`;
      const cases = [
        ["the Mac's, hooks off", [[PREFS_FILE, { disableAllHooks: true, Token: SECRET }]], [MANAGED_HOOKS_WHY(MAC)]],
        ["the Mac's, only managed hooks", [[PREFS_FILE, { allowManagedHooksOnly: true }]], [MANAGED_ONLY_WHY(MAC)]],
        ["the user's, both", [[`sallie/${PREFS_FILE}`, { disableAllHooks: true, allowManagedHooksOnly: true }]], [MANAGED_HOOKS_WHY(USER), MANAGED_ONLY_WHY(USER)]],
        ["both files, the user's first, as Claude Code reads them", [[PREFS_FILE, { disableAllHooks: true }], [`sallie/${PREFS_FILE}`, { allowManagedHooksOnly: true }]], [MANAGED_ONLY_WHY(USER), MANAGED_HOOKS_WHY(MAC)]],
        ["a binary property list", [[PREFS_FILE, null]], [MANAGED_HOOKS_WHY(MAC)]]
      ];
      for (const [what, files, lines] of cases) {
        const { t } = mac();
        for (const [name, entries] of files) {
          if (entries !== null) putPrefs(t, name, entries);
          else assert.equal(spawnSync("/usr/bin/plutil", ["-convert", "binary1", putPrefs(t, name, { disableAllHooks: true })]).status, 0);
        }
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, [LOCK, ...lines].join("\n"), 0], what);
        assert.ok(!r.text.includes(SECRET), what);
        t.done();
      }
    });
    it("goes on when the managed preferences say neither, are another user's or another program's, or are files Claude Code would not read", { skip: notAMac }, async () => {
      const cases = [
        [PREFS_FILE, { disableAllHooks: false, allowManagedHooksOnly: false }],
        [PREFS_FILE, { disableAllHooks: "true", allowManagedHooksOnly: "1" }],
        [PREFS_FILE, { env: "x", allowManagedPluginsOnly: true }],
        [`jason/${PREFS_FILE}`, { disableAllHooks: true }],
        ["com.anthropic.claude.plist", { disableAllHooks: true }],
        [`${PREFS_FILE}.bak`, { disableAllHooks: true }],
        [PREFS_FILE, "{ not a property list"],
        [PREFS_FILE, ""],
        // A list, not a dictionary, and one that holds a date, which plutil cannot make JSON: Claude Code takes none of either.
        [PREFS_FILE, plist({}).replace("<dict>\n</dict>", "<array><true/></array>")],
        [PREFS_FILE, plist({ disableAllHooks: true }).replace("</dict>", "  <key>When</key><date>2026-10-25T12:00:00Z</date>\n</dict>")]
      ];
      for (const [name, entries] of cases) {
        const { t } = mac();
        putPrefs(t, name, entries);
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [0, "This Mac has the newest brimm-video."], `${name}: ${JSON.stringify(entries)}`);
        t.done();
      }
      // A Mac nobody manages has no managed preferences folder.
      const { t } = mac();
      assert.ok(!existsSync(prefs(t)));
      assert.equal((await behindOn(t)).code, 0);
      t.done();
    });
    it("reads the managed preferences from the folder Claude Code reads them from, for the user this Mac says, unless it is told others", () => {
      const text = readFileSync(new URL("../edit.js", import.meta.url), "utf8");
      assert.match(text, /const MANAGED_PREFS = "\/Library\/Managed Preferences";/);
      assert.match(text, /deps\.user \|\| userInfo\(\)\.username/);
    });
    it("refuses when the server-managed settings Claude Code keeps beside the user settings turn hooks off or allow only managed hooks", async () => {
      const remote = (t, set, dir = join(t.home, ".claude")) => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "remote-settings.json"), JSON.stringify(set));
      };
      const CONFIG_REMOTE = "the server-managed ones Claude Code keeps in $CLAUDE_CONFIG_DIR/remote-settings.json";
      {
        const { t } = mac();
        remote(t, { disableAllHooks: true, env: { TOKEN: SECRET } });
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text, r.g.calls.length], [1, `${LOCK}\n${MANAGED_HOOKS_WHY(REMOTE)}`, 0]);
        assert.ok(!r.text.includes(SECRET));
        t.done();
      }
      {
        const { t } = mac();
        remote(t, { allowManagedHooksOnly: true });
        const r = await behindOn(t);
        assert.deepEqual([r.code, r.text], [1, `${LOCK}\n${MANAGED_ONLY_WHY(REMOTE)}`]);
        // With the configuration home elsewhere, the copy kept there is the one.
        const config = join(t.dir, "config");
        assert.equal((await behindOn(t, { env: { CLAUDE_CONFIG_DIR: config } })).code, 0);
        remote(t, { disableAllHooks: true }, config);
        const named = await behindOn(t, { env: { CLAUDE_CONFIG_DIR: config } });
        assert.deepEqual([named.code, named.text], [1, `${LOCK}\n${MANAGED_HOOKS_WHY(CONFIG_REMOTE)}`]);
        t.done();
      }
      for (const set of [{}, { disableAllHooks: false }, { disableAllHooks: "true" }, []]) {
        const { t } = mac();
        remote(t, set);
        assert.equal((await behindOn(t)).code, 0, JSON.stringify(set));
        t.done();
      }
    });
  });
  it("names the node that rewrites her folder only when her folder's settings give a real one: an absolute path ending in /node that is there; otherwise Homebrew's", async () => {
    // The folder's settings are a file she can change, and Jason is told to run what this line prints.
    const HOMEBREW = "/opt/homebrew/bin/node";
    const said = (node) => `Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${node}, then start a new session in her Claude folder)`;
    const t = setup();
    const bin = join(t.home, "bin");
    mkdirSync(join(bin, "newline\n--evil"), { recursive: true });
    for (const file of [join(bin, "node"), join(bin, "sh"), join(bin, "newline\n--evil", "node")]) writeFileSync(file, "");
    const cases = [
      [join(bin, "node"), join(bin, "node")],
      [join(t.home, "nowhere", "node"), HOMEBREW],
      [join(bin, "sh"), HOMEBREW],
      [join(bin, "newline\n--evil", "node"), HOMEBREW],
      ["node", HOMEBREW],
      ["../bin/node", HOMEBREW],
      [`${join(bin, "node")}; echo hi`, HOMEBREW],
      ["", HOMEBREW],
      [42, HOMEBREW],
      [["x"], HOMEBREW],
      [{ a: 1 }, HOMEBREW]
    ];
    for (const [node, printed] of cases) {
      const folder = writeStudio(t.home, { checkout: "/checkout", node: HOMEBREW });
      const file = join(folder, ".claude", "settings.json");
      const settings = JSON.parse(readFileSync(file, "utf8"));
      settings.hooks.PreToolUse[0].hooks[0].args[1] = node;
      writeFileSync(file, JSON.stringify(settings, null, 2));
      const g = git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "0\n" });
      const r = await on({ ...t.ctx.deps, run: g.run }, "behind");
      assert.deepEqual([r.code, r.text], [0, `This Mac has the newest brimm-video.\n${said(printed)}`], JSON.stringify(node));
    }
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
