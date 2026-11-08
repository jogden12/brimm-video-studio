// The ties between the Move to Studio app (tool/move-app/move.zsh) and Studio's own code, and the keys thrown away on a real terminal.
// Every other test of the app uses stand-ins; these use Studio's real settings.js and install.sh (with --print only), so that a
// rewording of a line the app reads, or a change to folderWords, cloudFolder or needsFilesAccess, fails here.
//   Tie 1: settings.js `plan`'s refusals, read by the app's refused_pick.
//   Tie 2: install.sh --print in a made-up home, read by refused_pick, cloud_warning and show_folders.
//   Tie 3: words_for, finder_sentence and privacy_notes, which rest on Studio's three functions.
//   Then the keys typed while the chooser is open, on a pseudo-terminal (/usr/bin/script).
// Nothing is written outside a folder made for the test; no real window, app, claude or installer run is made.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { settingsMain } from "../settings.js";
import { HERE, askWith, box, transcriptAgent } from "./move-app-ties-helpers.js";

const MOVE = fileURLToPath(new URL("../move-app/move.zsh", import.meta.url));
const STUDIO = dirname(HERE);
const SETTINGS_JS = join(HERE, "settings.js");
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") ? "the move script is for a Mac: it needs zsh and plutil" : false;
const noScript = existsSync("/usr/bin/script") ? false : "there is no /usr/bin/script here, which gives the test a real terminal";
const NODE_DIR = dirname(process.execPath);

/** A made-up world for one run of the readers: a folder of its own with a home, BRIMM Video and the folders the checks look at. */
function world({ settings, transcribe, transcribeOff } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-ties-")));
  const home = join(dir, "home");
  const root = join(dir, "The BRIMM DB", "BRIMM Video");
  for (const d of [root, join(home, "Downloads"), join(home, "Desktop"), join(home, "Documents", "Zoom"), join(home, "BRIMM Video Work"), join(root, "Episodes", ".importing")]) mkdirSync(d, { recursive: true });
  const put = (file, text) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  if (settings) put(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, machine: "Mac Studio", root, checkout: STUDIO, import: "light", ...settings }));
  if (transcribe) put(join(home, "Library", "LaunchAgents", "com.thebrimm.transcribe.plist"), transcriptAgent(transcribe));
  if (transcribeOff) put(join(home, "Library", "LaunchAgents", "com.thebrimm.transcribe.plist.off"), transcriptAgent(transcribeOff));
  return { dir, home, root, put, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Studio's `plan`, awaited: { code, said }. A run that says nothing is a failed test, never "nothing wrong". */
async function plan(w, ...args) {
  const said = [];
  const code = await settingsMain(["plan", "--machine", "Mac Studio", "--root", w.root, "--checkout", STUDIO, "--import", "light", ...args], { home: w.home, say: (line) => said.push(line) });
  assert.ok(said.length > 0, "settings.js plan said nothing");
  return { code, said };
}

/** The script sourced in a made-up home, with stand-in open and launchctl first on its PATH. `script` runs after `source`. */
function zsh(script, { home, dir, env = {} }) {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of ["open", "launchctl"]) {
    writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${join(dir, "ran")}"\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const r = spawnSync("/bin/zsh", ["-c", `source "$1"\n${script}`, "move", MOVE], {
    encoding: "utf8",
    env: { HOME: home, TMPDIR: dir, PATH: `${bin}:/usr/bin:/bin:${NODE_DIR}`, ...env }
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return r.stdout;
}

/** What refused_pick reads in the text `told`: { refused, kind, words, reason }. */
function reading(w, told) {
  const out = zsh('refused_pick "$TOLD"\nprint -r -- "$REFUSED"\nprint -r -- "$FAULT_KIND"\nprint -r -- "$FAULT_WORDS"\nprint -r -- "$FAULT_REASON"', { home: w.home, dir: w.dir, env: { TOLD: told } });
  const [refused, kind, words, reason] = out.split("\n");
  return { refused, kind, words, reason };
}
/** What cloud_warning reads in `told`. */
function warningIn(w, told) {
  return zsh('cloud_warning "$TOLD"', { home: w.home, dir: w.dir, env: { TOLD: told } }).replace(/\n$/, "");
}

const NOT_WRITTEN = (why) => `Not written: ${why}.`;
const cannot = (what) => `the exports folder cannot be ${what}, or inside it`;
const NESTED = "the drop folder cannot be the exports folder, or inside it, or hold it";
const marked = (mac, at) => `the exports folder cannot be a drop folder, and ${mac} has marked ${at} as its own (its marker, .brimm-watched-by, stays there when that Mac moves to another drop folder)`;
const markedAbove = (mac, at) => `the exports folder cannot be inside a drop folder, and ${mac} has marked ${at}, which holds it, as its own (its marker, .brimm-watched-by, stays there when that Mac moves to another drop folder)`;
const SYNCING = (name) => `Warning: this drop folder is in ${name}. ${name === "iCloud Drive, if it keeps Desktop & Documents" ? "If it does, every video dropped there goes up to it" : "Every video dropped there goes up to that cloud"}, a client or group session's recording too. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.`;
const lines = (text) => text.split("\n");

describe("tie 1: settings.js plan's refusals, read by the app's refused_pick", { skip: notAMac }, () => {
  it("reads each of the drop folder's refusals as a refused pick of the drop question, and Studio's nesting one as nested", async () => {
    const w = world();
    const rows = [
      [w.root, "the drop folder cannot be BRIMM Video, or inside it, or hold it"],
      [join(w.root, "Drop", "Mac Studio"), "the drop folder cannot be Drop in BRIMM Video, or inside it, or hold it"],
      [join(w.root, "Episodes", "x"), "the drop folder cannot be Episodes in BRIMM Video, or inside it, or hold it"],
      [join(w.root, "Assets"), "the drop folder cannot be BRIMM Video, or inside it, or hold it"],
      [join(w.root, "Assets", "In"), "the drop folder cannot be BRIMM Video, or inside it, or hold it"],
      [join(w.root, "Inbox"), "the drop folder cannot be BRIMM Video, or inside it, or hold it"],
      [join(w.home, "Downloads"), "the drop folder cannot be Downloads, or inside it, or hold it"],
      [join(w.home, "BRIMM Video Work"), "the drop folder cannot be BRIMM Video Work, or inside it but for Drop, or hold it"],
      [join(w.home, "BRIMM Video Studio", "Drop"), "the drop folder cannot be BRIMM Video Studio, or inside it, or hold it"],
      ["Desktop/Drop", "the drop folder must be a whole path"],
      [join(w.home, "Nowhere", "Drop"), "the folder that is to hold the drop folder is not there"]
    ];
    for (const [pick, why] of rows) {
      const { code, said } = await plan(w, "--drop-folder", pick);
      assert.deepEqual([code, said[0]], [1, NOT_WRITTEN(why)], why);
      assert.deepEqual(reading(w, said[0]), { refused: "drop", kind: "installer", words: NOT_WRITTEN(why), reason: why }, why);
    }
    const { code, said } = await plan(w, "--drop-folder", join(w.home, "Desktop", "Drop"), "--exports-folder", join(w.home, "Desktop"));
    assert.deepEqual([code, said[0]], [1, NOT_WRITTEN(NESTED)]);
    assert.deepEqual(reading(w, said[0]), { refused: "nested", kind: "installer", words: NOT_WRITTEN(NESTED), reason: NESTED });
    w.done();
  });

  it("reads a pick holding one video or two as not-empty, one that cannot be read as cannot-look, a file as a refused pick, and a video still arriving as a video", async () => {
    const w = world();
    const one = join(w.home, "One");
    const two = join(w.home, "Two");
    const arriving = join(w.home, "Arriving");
    const noRead = join(w.home, "No read");
    const aFile = join(w.home, "A file");
    w.put(join(one, "Family birthday.mov"), "video");
    w.put(join(one, "notes.txt"), "notes");
    w.put(join(two, "A.mov"), "video");
    w.put(join(two, "B.mp4"), "video");
    w.put(join(arriving, "Clip.mov.download"), "video");
    mkdirSync(noRead);
    w.put(aFile, "not a folder");
    chmodSync(noRead, 0o000);
    try {
      const A_VIDEO = "which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the video out first";
      const rows = [
        [one, "not-empty", `the drop folder holds a video already, ${A_VIDEO}`],
        [two, "not-empty", "the drop folder holds 2 videos already, which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the videos out first"],
        [arriving, "not-empty", `the drop folder holds a video already, ${A_VIDEO}`]
      ];
      for (const [pick, kind, why] of rows) {
        const { code, said } = await plan(w, "--drop-folder", pick);
        assert.deepEqual([code, said[0]], [1, NOT_WRITTEN(why)], pick);
        assert.deepEqual(reading(w, said[0]), { refused: "drop", kind, words: NOT_WRITTEN(why), reason: why }, pick);
      }
      {
        const { code, said } = await plan(w, "--drop-folder", noRead);
        assert.equal(code, 1, noRead);
        assert.match(said[0], /^Not written: the drop folder could not be read \(E[A-Z]+\), so what it holds is not known\. /);
        const read = reading(w, said[0]);
        assert.deepEqual([read.refused, read.kind, read.words], ["drop", "cannot-look", said[0]]);
        assert.equal(read.reason, said[0].slice("Not written: ".length, -1));
      }
      // A pick that is a file is Studio's own refusal, read as any other of the drop folder's.
      const file = await plan(w, "--drop-folder", aFile);
      assert.deepEqual([file.code, file.said[0]], [1, NOT_WRITTEN("the drop folder is not a folder")]);
      assert.deepEqual(reading(w, file.said[0]), { refused: "drop", kind: "installer", words: NOT_WRITTEN("the drop folder is not a folder"), reason: "the drop folder is not a folder" });
    } finally {
      chmodSync(noRead, 0o755);
      w.done();
    }
  });

  it("reads BRIMM VIDEO Transfer, Zoom Video Transfer in it and BRIMM VIDEO MacBook as the drop folder, as refused picks of the drop question (a folder the transcript tool lists, or another Mac marked, is install.sh's refusal: tie 2)", async () => {
    const transfer = (w) => join(dirname(w.root), "BRIMM VIDEO Transfer");
    const macbook = (w) => join(dirname(w.root), "BRIMM VIDEO MacBook");
    const w = world();
    mkdirSync(join(transfer(w), "Zoom Video Transfer"), { recursive: true });
    mkdirSync(macbook(w));
    for (const [pick, what] of [[transfer(w), "BRIMM VIDEO Transfer"], [join(transfer(w), "Zoom Video Transfer"), "BRIMM VIDEO Transfer"], [macbook(w), "BRIMM VIDEO MacBook"]]) {
      const why = `the drop folder cannot be ${what}, or inside it, or hold it`;
      const { code, said } = await plan(w, "--drop-folder", pick);
      assert.deepEqual([code, said[0]], [1, NOT_WRITTEN(why)], pick);
      assert.deepEqual(reading(w, said[0]), { refused: "drop", kind: "installer", words: NOT_WRITTEN(why), reason: why }, pick);
    }
    w.done();
  });

  it("reads each of the exports folder's refusals as a refused pick of the exports question", async () => {
    const w = world({ transcribeOff: [] });
    const drop = join(w.home, "Desktop", "Drop");
    const jasons = join(w.dir, "Shared", "In");
    w.put(join(jasons, ".brimm-watched-by"), "Jason's MacBook\n");
    const laptopDrop = join(w.root, "Drop", "Sallie's laptop");
    w.put(join(laptopDrop, ".brimm-watched-by"), "Sallie's laptop\n");
    const macbook = join(dirname(w.root), "BRIMM VIDEO MacBook");
    const transfer = join(dirname(w.root), "BRIMM VIDEO Transfer");
    mkdirSync(macbook);
    mkdirSync(join(transfer, "Zoom Video Transfer"), { recursive: true });
    const listed = join(w.dir, "Other", "BRIMM Transcripts");
    w.put(join(w.home, "Library", "LaunchAgents", "com.thebrimm.transcribe.plist.off"), transcriptAgent([listed]));
    const rows = [
      [laptopDrop, cannot("Drop in BRIMM Video")],
      [join(w.root, "Episodes"), cannot("Episodes in BRIMM Video")],
      [join(w.root, "References"), cannot("References in BRIMM Video")],
      [join(w.root, "Unedited Video", "Mac Studio"), cannot("Unedited Video in BRIMM Video")],
      [join(w.home, "BRIMM Video Work", "Drop"), cannot("Drop in BRIMM Video Work")],
      [join(w.home, "BRIMM Video Work"), cannot("BRIMM Video Work")],
      [join(w.home, "Library", "Application Support", "BRIMM Video", "Exports"), cannot("Studio's settings folder")],
      [join(transfer, "Zoom Video Transfer"), cannot("BRIMM VIDEO Transfer")],
      [macbook, cannot("BRIMM VIDEO MacBook")],
      [join(listed, "HF"), cannot("a folder the transcript tool watches")],
      [join(w.home, "BRIMM Video Studio"), cannot("BRIMM Video Studio")],
      [join(w.home, "BRIMM Video Workshop"), cannot("BRIMM Video Workshop")],
      [join(w.home, "Documents", "Zoom"), cannot("Zoom's recordings")],
      [jasons, marked("Jason's MacBook", jasons)],
      [join(jasons, "HF"), markedAbove("Jason's MacBook", jasons)]
    ];
    for (const [pick, why] of rows) {
      const { code, said } = await plan(w, "--drop-folder", drop, "--exports-folder", pick);
      assert.deepEqual([code, said[0]], [1, NOT_WRITTEN(why)], why);
      assert.equal(said.length, 1, `a run that names the exports folder says one line: ${said.join(" | ")}`);
      assert.deepEqual(reading(w, said[0]), { refused: "exports", kind: "installer", words: NOT_WRITTEN(why), reason: why }, why);
    }
    w.done();
  });

  it("says only the first line of an exports refusal on a run that names no exports folder: the second line, for a person at Terminal, is Studio's and never the app's", async () => {
    const kept = world({ settings: {} });
    const dir = join(kept.dir, "Shared");
    kept.put(join(dir, ".brimm-watched-by"), "Jason's MacBook\n");
    kept.put(join(kept.home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, machine: "Mac Studio", root: kept.root, checkout: STUDIO, import: "light", drop: "Drop", handoffVersion: 2, exportsPath: dir }));
    const { code, said } = await plan(kept, "--drop-folder", join(kept.home, "BRIMM Video Work", "Drop"));
    assert.equal(code, 1);
    assert.equal(said[0], NOT_WRITTEN(marked("Jason's MacBook", dir)));
    assert.equal(said[1], `The exports folder is ${dir}, kept from before: name another with --exports-folder.`);
    assert.match(said[1], /^The exports folder is /);
    const read = reading(kept, said.join("\n"));
    assert.deepEqual([read.refused, read.kind, read.words], ["exports", "installer", said[0]]);
    // The second line alone is never taken for a refusal.
    assert.equal(reading(kept, said[1]).refused, "");
    kept.done();
  });

  it("gives nothing, a stop, for a plan made while the old folder holds a video and the pick is empty", async () => {
    const w = world({ settings: { drop: "Unedited Video" } });
    const old = join(w.root, "Unedited Video", "Mac Studio");
    w.put(join(old, "Talk.mov"), "video");
    const { code, said } = await plan(w, "--drop-folder", join(w.home, "BRIMM Video Work", "Drop"));
    assert.equal(code, 1, said.join("\n"));
    assert.ok(said[0].startsWith("Not written: the drop folder would change from "), said[0]);
    assert.deepEqual(reading(w, said[0]), { refused: "", kind: "", words: "", reason: "" });
    assert.deepEqual(reading(w, said.join("\n")), { refused: "", kind: "", words: "", reason: "" });
    w.done();
  });
});

describe("tie 2: Studio's real install.sh --print, read by the app", { skip: notAMac }, () => {
  const BASE = ["--print", "--machine", "Mac Studio", "--import", "light", "--handoff", "2"];
  const count = (text, part) => text.split(part).length - 1;
  const lineOf = (out, line) => out.includes(`\n${line}\n`);
  /** A world for the readers, for a print made elsewhere. */
  const reader = () => world();

  it("gives a drop folder in Dropbox the Warning with Dropbox, once, and one under Desktop L1c's form for Desktop & Documents; neither is a refused pick", () => {
    const d = box();
    const w = reader();
    for (const [folder, name] of [["Library/CloudStorage/Dropbox-X", "Dropbox"], ["Desktop", "iCloud Drive, if it keeps Desktop & Documents"]]) {
      const r = askWith({ files: [`${folder}/.keep`] }, ...BASE, "--drop-folder", (home) => `${home}/${folder}/In`, d.root);
      assert.equal(r.status, 0, r.err + r.out);
      assert.equal(count(r.out, "Warning: this drop folder is in "), 1, r.out);
      assert.equal(warningIn(w, r.out), SYNCING(name));
      assert.ok(warningIn(w, r.out).includes(name === "Dropbox" ? "in Dropbox." : "in iCloud Drive, if it keeps Desktop & Documents. If it does,"));
      assert.deepEqual(reading(w, r.out), { refused: "", kind: "", words: "", reason: "" });
    }
    d.done();
    w.done();
  });

  it("gives a drop folder on this Mac no Warning", () => {
    const d = box();
    const w = reader();
    const r = askWith({ files: ["Videos/.keep"] }, ...BASE, "--drop-folder", (home) => `${home}/Videos/In`, d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.equal(warningIn(w, r.out), "");
    d.done();
    w.done();
  });

  it("gives Downloads as the drop folder a refused pick of the drop question", () => {
    const d = box();
    const w = reader();
    const r = askWith({ files: ["Downloads/.keep"] }, ...BASE, "--drop-folder", (home) => `${home}/Downloads`, d.root);
    const why = "the drop folder cannot be Downloads, or inside it, or hold it";
    assert.deepEqual([r.status, r.out.split("\n")[0]], [2, NOT_WRITTEN(why)], r.out);
    assert.deepEqual(reading(w, r.out), { refused: "drop", kind: "installer", words: NOT_WRITTEN(why), reason: why });
    d.done();
    w.done();
  });

  it("gives an empty pick while the old drop folder holds a video a stop: not 0, and a first line the app does not send back to a question", () => {
    const d = box();
    const w = reader();
    const old = join(d.root, "Unedited Video", "Mac Studio");
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, "Talk.mov"), "video");
    const r = askWith({ files: ["BRIMM Video Work/.keep"], settings: d.mine({ import: "light", drop: "Unedited Video", handoffVersion: 2 }) }, ...BASE, "--drop-folder", (home) => `${home}/BRIMM Video Work/Drop`, d.root);
    assert.notEqual(r.status, 0, r.out);
    assert.ok(r.out.startsWith("Not written: the drop folder would change from "), r.out);
    assert.deepEqual(reading(w, r.out), { refused: "", kind: "", words: "", reason: "" });
    d.done();
    w.done();
  });

  it("gives a pick holding another Mac's marker, and a pick a made-up transcribe plist watches, refused picks", () => {
    const d = box();
    const w = reader();
    const jasons = join(d.dir, "Jason drop");
    mkdirSync(jasons);
    writeFileSync(join(jasons, ".brimm-watched-by"), "Jason's MacBook\n");
    const m = askWith({ files: ["Desktop/.keep"] }, ...BASE, "--drop-folder", jasons, d.root);
    const MARKED = `The folder ${jasons} is watched by Jason's MacBook already. A drop folder is watched by one Mac only.`;
    assert.deepEqual([m.status, m.out.split("\n")[0]], [2, MARKED], m.out);
    assert.deepEqual(reading(w, m.out), { refused: "drop", kind: "installer", words: MARKED, reason: MARKED.slice(0, -1) });
    const watched = join(d.dir, "Other", "BRIMM Transcripts");
    mkdirSync(watched, { recursive: true });
    const t = askWith({ installed: { "com.thebrimm.transcribe": transcriptAgent([watched]) } }, ...BASE, "--drop-folder", watched, d.root);
    const WATCHED = `A folder is for transcripts or for unedited video, and not for both: ${watched} is watched for transcripts already, by com.thebrimm.transcribe. Take it off the transcript tool's list first, or name another folder.`;
    assert.deepEqual([t.status, t.out.split("\n")[0]], [2, WATCHED], t.out);
    assert.deepEqual(reading(w, t.out), { refused: "drop", kind: "installer", words: WATCHED, reason: WATCHED.slice(0, -1) });
    d.done();
    w.done();
  });

  it("passes a name with an apostrophe, an accent and an emoji whole, in the print's Its drop folder line", () => {
    const d = box();
    const w = reader();
    const name = "It’s café 🎬 x";
    const r = askWith({ files: ["Videos/.keep"] }, ...BASE, "--drop-folder", (home) => `${home}/Videos/${name}`, d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.ok(lineOf(r.out, `  Its drop folder, on this Mac:  ${r.home}/Videos/${name}`), r.out);
    assert.deepEqual(reading(w, r.out), { refused: "", kind: "", words: "", reason: "" });
    d.done();
    w.done();
  });

  it("reads Studio's real settings.js show, with dropPath and exportsPath, through show_folders", () => {
    const w = world({ settings: { dropPath: "/placeholder", exportsPath: "/placeholder" } });
    const drop = join(w.home, "Videos to Drop", "It’s café 🎬");
    const exports = join(w.dir, "Exports out");
    mkdirSync(drop, { recursive: true });
    mkdirSync(exports);
    w.put(join(w.home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, machine: "Mac Studio", root: w.root, checkout: STUDIO, import: "light", handoffVersion: 2, dropPath: drop, exportsPath: exports }));
    const shown = spawnSync(process.execPath, [SETTINGS_JS, "show"], { encoding: "utf8", env: { HOME: w.home, PATH: `/usr/bin:/bin:${NODE_DIR}` } });
    assert.equal(shown.status, 0, shown.stderr + shown.stdout);
    assert.ok(lineOf(`\n${shown.stdout}`, `  Its drop folder:  ${drop}`), shown.stdout);
    assert.ok(lineOf(`\n${shown.stdout}`, `  Exports from HyperFrames, looked for in:  ${exports}`), shown.stdout);
    const out = zsh(`STUDIO=${JSON.stringify(STUDIO)} NODE=${JSON.stringify(process.execPath)} CHECKOUT_NOW=${JSON.stringify(STUDIO)} INSTALL_STARTED=yes\nSETTINGS="$HOME/Library/Application Support/BRIMM Video/settings.json"\nshow_folders`, { home: w.home, dir: w.dir });
    assert.deepEqual(lines(out), [drop, exports, ""]);
    // With no exportsPath the exports line is Downloads, not nothing.
    w.put(join(w.home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, machine: "Mac Studio", root: w.root, checkout: STUDIO, import: "light", handoffVersion: 2, dropPath: drop }));
    const plain = zsh(`STUDIO=${JSON.stringify(STUDIO)} NODE=${JSON.stringify(process.execPath)} CHECKOUT_NOW=${JSON.stringify(STUDIO)} INSTALL_STARTED=yes\nSETTINGS="$HOME/Library/Application Support/BRIMM Video/settings.json"\nshow_folders`, { home: w.home, dir: w.dir });
    assert.deepEqual(lines(plain), [drop, join(w.home, "Downloads"), ""]);
    w.done();
  });
});

describe("tie 3: the app's words and decisions rest on Studio's folderWords, cloudFolder and needsFilesAccess", { skip: notAMac }, () => {
  it("says words_for, the Finder step's sentence and the privacy lines as Studio's own answers say them", async () => {
    const studio = await import(pathToFileURL(SETTINGS_JS).href);
    const w = world();
    const paths = [
      join(w.home, "Library", "CloudStorage", "Dropbox-X", "In"),
      join(w.home, "Desktop", "In"),
      join(w.home, "Library", "Mobile Documents", "com~apple~CloudDocs", "In"),
      "/Volumes/X/In",
      join(w.home, "BRIMM Video Work", "Drop")
    ];
    const setup = `STUDIO=${JSON.stringify(STUDIO)} NODE=${JSON.stringify(process.execPath)}\n`;
    const downloads = join(w.home, "Downloads");
    const DOWNLOADS_LINE = "Studio looks in Downloads for exports, whatever is picked. macOS may ask once whether Claude Code may access files in your Downloads folder, the first time the chat on this Mac hands off a video and looks for its export. About 15 minutes after each hand-off, once the export's copies in Dropbox are checked, Studio's background job deletes the export from Downloads, and macOS may ask once whether node may. Choose Allow each time. If node was refused, allow it in System Settings › Privacy & Security › Files and Folders. Until then, exports stay in Downloads, to be deleted by hand.";
    // Pinned apart from the functions, so that a change to what a folder is called is seen here too.
    const PINNED = ["Dropbox › In", "Desktop › In, in your home folder", "iCloud Drive › In", "X › In", "BRIMM Video Work › Drop, in your home folder"];
    for (const [i, folder] of paths.entries()) {
      const words = studio.folderWords(folder, w.home);
      const cloud = studio.cloudFolder(folder, w.home);
      const asks = studio.needsFilesAccess(folder, w.home);
      assert.equal(words, PINNED[i], folder);
      assert.deepEqual(lines(zsh(`${setup}words_for ${JSON.stringify(folder)}`, { home: w.home, dir: w.dir })), [words, ""], folder);
      for (const fresh of ["", "yes"]) {
        const sentence = lines(zsh(`${setup}SET_UP_FRESH=${fresh}\nfinder_sentence ${JSON.stringify(folder)}`, { home: w.home, dir: w.dir }));
        const wanted = cloud === "Dropbox"
          ? `The drop folder is shown in Finder: ${words}. In Finder, Control-click it, choose Make available offline${fresh ? ", and click Allow if macOS asks whether node may read the Dropbox folder" : ""}.`
          : `This is the drop folder from now on: ${words}. Drag it into Finder's sidebar now, under Favorites, so it is one click away. To bring in a video that is in Dropbox, hold Option as you drag it, so that Dropbox keeps its copy. Never export into the drop folder.`;
        assert.deepEqual(sentence, [wanted, ""], `${folder} fresh=${fresh}`);
        // The drop folder's privacy line: a Dropbox folder asks only on a Mac set up fresh, any other cloud folder always, and else as needsFilesAccess says.
        const notes = lines(zsh(`${setup}SET_UP_FRESH=${fresh}\nDROP_FOLDER=${JSON.stringify(folder)} EXPORTS_FOLDER=${JSON.stringify(downloads)} EXPORTS_PASSED_OVER=\nprivacy_notes`, { home: w.home, dir: w.dir }));
        const mayAsk = cloud === "Dropbox" ? Boolean(fresh) : Boolean(cloud) || asks;
        assert.equal(notes[0], DOWNLOADS_LINE);
        if (mayAsk) {
          assert.equal(notes.length, 3, `${folder} fresh=${fresh}: ${notes.join("\n")}`);
          assert.ok(notes[1].startsWith(`macOS may also ask whether node may read ${words}, at the first import, and whether Claude Code may,`), notes[1]);
        } else {
          assert.deepEqual(notes, [DOWNLOADS_LINE, ""], `${folder} fresh=${fresh}`);
        }
        // The exports folder's: the same decision for the folder as the exports folder.
        const out = lines(zsh(`${setup}SET_UP_FRESH=${fresh}\nDROP_FOLDER=${JSON.stringify(join(w.home, "BRIMM Video Work", "Drop"))} EXPORTS_FOLDER=${JSON.stringify(folder)} EXPORTS_PASSED_OVER=\nprivacy_notes`, { home: w.home, dir: w.dir }));
        if (mayAsk) assert.equal(out[1], `macOS may ask whether Claude Code may look in ${words}, at the first hand-off. Choose Allow.`, `${folder} fresh=${fresh}`);
        else assert.deepEqual(out, [DOWNLOADS_LINE, ""], `${folder} fresh=${fresh}`);
      }
    }
    w.done();
  });
});

// ---- Keys typed while the chooser is open, on a real terminal --------------------------------------------------------------------

const quote = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;
const LIMIT = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits (10 s at most) until `ready()` gives something; fails the test with `label` when it does not. */
async function waitFor(label, ready) {
  const until = Date.now() + LIMIT;
  for (;;) {
    const got = ready();
    if (got) return got;
    if (Date.now() > until) throw new Error(`waited ${LIMIT / 1000} s for ${label}`);
    await sleep(25);
  }
}

/** The stand-in `open` and the stand-in chooser, on a pseudo-terminal's PATH. The stand-in open is like open -W: it starts the helper
    (a node program outside its process group, as the real helper app is) and waits for it in the job's own process group, where
    Control-C ends it. The helper writes its result when the release file appears, notes when the script's process (the process id it is
    given) ends, and gives up on its own after about 15 s. */
function terminalWorld() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-terminal-")));
  const bin = join(dir, "bin");
  const home = join(dir, "home");
  const app = join(dir, "Applications", "Choose a Folder.app");
  const program = join(app, "Contents", "MacOS", "Choose a Folder");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(dirname(program), { recursive: true });
  writeFileSync(program, "#!/bin/sh\nexit 2\n");
  chmodSync(program, 0o755);
  const files = { release: join(dir, "release"), started: join(dir, "started"), seen: join(dir, "seen"), pid: join(dir, "pid"), helperPid: join(dir, "helper-pid"), ran: join(dir, "ran"), pick: join(home, "Picked") };
  mkdirSync(files.pick);
  writeFileSync(join(dir, "stand-in.js"), `import { spawn } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
const [mode, ...args] = process.argv.slice(2);
const files = ${JSON.stringify(files)};
if (mode === "wait") {
  // like open -n -W APP --args MESSAGE START RESULT PID: the helper is outside this process group, and this waits for it
  const [message, start, result, pid] = args;
  const helper = spawn(process.execPath, [process.argv[1], "helper", result, pid, ${JSON.stringify(program)}], { detached: true, stdio: "ignore" });
  writeFileSync(files.helperPid, String(helper.pid));
  writeFileSync(files.started, "yes");
  helper.on("exit", () => process.exit(0));
} else {
  const [result, pid] = args;
  const stop = Date.now() + 15000;
  const alive = () => { try { process.kill(Number(pid), 0); return true; } catch { return false; } };
  const timer = setInterval(() => {
    if (existsSync(files.release)) {
      writeFileSync(result + ".part", "path\\n" + files.pick + "\\n");
      renameSync(result + ".part", result);
      writeFileSync(files.seen, "released");
      process.exit(0);
    }
    if (!alive()) { writeFileSync(files.seen, "ended"); process.exit(0); }
    if (Date.now() > stop) { writeFileSync(files.seen, "gave up"); process.exit(0); }
  }, 50);
}
`);
  writeFileSync(join(bin, "open"), `#!/bin/sh
echo "open $*" >> ${quote(files.ran)}
case "$1" in
  -a) exit 0 ;;
  -n) exec ${quote(process.execPath)} ${quote(join(dir, "stand-in.js"))} wait "$5" "$6" "$7" "$8" ;;
esac
exit 0
`);
  chmodSync(join(bin, "open"), 0o755);
  // Control-C and kill are caught as main() does, then the two questions run.
  writeFileSync(join(dir, "run.zsh"), `source ${quote(MOVE)}
print -r -- $$ > ${quote(files.pid)}
trap on_int INT
trap on_term TERM
THROWN=0
choose_folder "Move to Studio: choose a folder." "$HOME"
print -r -- "CHOSE=$CHOSEN"
ask_y_or_c "A question for the test." "Go on? (y/c) "
print -r -- "ANSWER=$ANSWER"
`);
  return { dir, bin, home, app, files, run: join(dir, "run.zsh") };
}

/** Runs the two questions on a real terminal, behind a pipe (`script` refuses a socket). Detached, so that the whole group can be
    killed. Gives { type(text), out(), exited() , finish() }. */
function onTerminal(t) {
  const child = spawn("/bin/sh", ["-c", 'cat | /usr/bin/script -q /dev/null /bin/zsh "$1"', "sh", t.run], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { HOME: t.home, TMPDIR: t.dir, PATH: `${t.bin}:/usr/bin:/bin:${NODE_DIR}`, BRIMM_CHOOSER_APP: t.app, TERM: "xterm" }
  });
  let out = "";
  let exit = null;
  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (out += d.toString()));
  child.on("exit", (code, signal) => (exit = { code, signal }));
  child.stdin.on("error", () => {});
  const finish = () => {
    // The release file first (the stand-in ends), then cat's input, then the whole process group; the shell and the helper by their ids too.
    try { writeFileSync(t.files.release, "done"); } catch { /* the folder may be gone */ }
    try { child.stdin.end(); } catch { /* already closed */ }
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
    for (const file of [t.files.pid, t.files.helperPid]) {
      try { process.kill(Number(readFileSync(file, "utf8")), "SIGKILL"); } catch { /* not started, or gone */ }
    }
  };
  return { child, type: (text) => child.stdin.write(text), out: () => out, exited: () => exit, finish };
}

describe("keys typed while the chooser is open, on a real terminal", { skip: notAMac || noScript }, () => {
  it("throws away a y typed with no Return while the window is open, says so, and stops on the next question's lone Return", async () => {
    const t = terminalWorld();
    const run = onTerminal(t);
    try {
      await waitFor("the stand-in chooser to start", () => existsSync(t.files.started));
      await waitFor("the chooser's line in the output", () => run.out().includes("A window to choose the folder is opening."));
      const mark = run.out().length;
      run.type("y");
      await waitFor("the echoed y", () => run.out().slice(mark).includes("y"));
      writeFileSync(t.files.release, "done");
      await waitFor("the next question's prompt", () => run.out().includes("Go on? (y/c) "));
      assert.ok(run.out().includes("CHOSE="), run.out());
      run.type("\r");
      await waitFor("the stop summary", () => run.out().includes("Double-click Move to Studio again to go on from here."));
      const out = run.out();
      assert.ok(out.includes("Keys typed while the window was open were not taken as answers."), out);
      assert.ok(out.indexOf("Keys typed while the window was open were not taken as answers.") < out.indexOf("Go on? (y/c) "), out);
      assert.ok(out.includes("Stopped. This run changed nothing."), out);
      assert.ok(!out.includes("ANSWER="), `the lone Return was not an answer:\n${out}`);
      const ran = readFileSync(t.files.ran, "utf8");
      assert.ok(ran.includes("open -a Terminal"), ran);
    } finally {
      run.finish();
      rmSync(t.dir, { recursive: true, force: true });
    }
  });

  it("ends the run with the stop summary on Control-C while the chooser waits, and the stand-in outside the job's group sees the script's process end", async () => {
    const t = terminalWorld();
    const run = onTerminal(t);
    try {
      await waitFor("the stand-in chooser to start", () => existsSync(t.files.started));
      await waitFor("the chooser's line in the output", () => run.out().includes("A window to choose the folder is opening."));
      run.type("\x03");
      await waitFor("the stop summary", () => run.out().includes("Double-click Move to Studio again to go on from here."));
      const out = run.out();
      assert.ok(out.includes("Stopped. This run changed nothing."), out);
      assert.ok(out.includes("Double-click Move to Studio again to go on from here."), out);
      assert.ok(!out.includes("Go on? (y/c) "), `the questions were not reached:\n${out}`);
      const seen = await waitFor("the stand-in helper to see the script end", () => existsSync(t.files.seen) && readFileSync(t.files.seen, "utf8"));
      assert.equal(seen, "ended");
    } finally {
      run.finish();
      rmSync(t.dir, { recursive: true, force: true });
    }
  });
});
