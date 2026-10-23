// edit.js, the command line for episodes, which a Claude Code session on the Mac runs: listing the episodes and what waits,
// opening one, showing its timeline in Final Cut, what is running, and importing a video again. Each test has a folder of its
// own that stands for BRIMM Video in Dropbox, and a home folder of its own; the clone, the clock, Final Cut and the starting
// of a detached run are stand-ins. Nothing here touches Dropbox, opens Final Cut or starts a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { editMain, findEpisode, contextFor, openApp, readPlist } from "../edit.js";
import { RECORD_VERSION, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { fcpxml, fileUrl, relativeUrl } from "../fcpxml.js";
import { writeSettings, libraryFor } from "../settings.js";
import { writePending } from "../filing.js";

const NOW = Date.parse("2026-10-14T12:00:00");
/** The attributes of every tag of one name in a Final Cut file, in the order they come, as the file writes them. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))]
  .map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));

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
    // No test looks anything up on the network: this Mac is online unless a test says otherwise.
    online: async () => true,
    statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 }),
    // No test asks launchctl about this Mac's own launch agent: it is idle unless a test says otherwise.
    agentRunning: () => false
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
  it("prints the words of the setup guide's lock-down check as they came, in the line the guide quotes, and writes nothing", async () => {
    // Step 9 of the setup guide asks her folder's Claude to open an episode called Charge $99 `now` \ok. Claude's answer may put
    // that in its own words, or show the backticks as formatting, so Jason reads the command Claude ran and what edit.js printed
    // under it. The guide quotes both, and they must be what edit.js is given and what it prints. No episode fits, so nothing is
    // claimed, brought over or written.
    const t = setup();
    const { path } = t.episode("2026-10-13 Talk (Mac Studio)");
    const words = "Charge $99 `now` \\ok";
    const line = `No episode fits "${words}".`;
    const r = await t.run("open", words);
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, [`${line} The episodes are: 2026-10-13 Talk (Mac Studio).`]);
    assert.deepEqual(readdirSync(join(path, "record")), ["0001.json"]);
    assert.deepEqual([t.started, t.opened, t.clones], [[], [], []]);
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const step = guide.split("\n").find((l) => l.startsWith("9. **Check that her Claude folder only runs BRIMM Video:**"));
    assert.ok(step, "the guide's lock-down check, step 9");
    for (const quoted of [`\`\`open '${words}'\`\``, `\`\`${line}\`\``]) assert.ok(step.includes(quoted), `${quoted}\n---\n${step}`);
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
      "  Pricing with confidence: a short video of 2:00, in 2026-10-14 Pricing talk (Mac Studio), id 000002",
      "    Shown in Final Cut: v2, on Mac Studio",
      "  Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio), id 000001"
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
    assert.ok(r.text.includes("  Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio), id 000001\n    Not right: Talk.cut-plan.txt is missing"), r.text);
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
    // How long is from when each came into its folder (its ctime), which a test cannot set: so the clock is set from it.
    const came = Math.max(statSync(join(laptop, "Budget.mov")).ctimeMs, statSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov")).ctimeMs);
    t.deps.now = () => came + 2 * 3600000;
    const r = await t.run("episodes");
    assert.ok(r.text.includes([
      "Waiting in the drop folders:",
      "  Talk.mov, in Mac Studio's, for 2 hours: already imported as 2026-10-13 Talk (Mac Studio). It stays in the drop folder until its late check passes, or for a person to delete.",
      "  Budget.mov, in Sallie's laptop's, for 2 hours"
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

describe("node edit.js open", () => {
  const NOTES = Array.from({ length: 15 }, (_, i) => `Note line ${i + 1}.`).join("\n") + "\n";
  /** An episode as the import leaves it, with Claude's notes and one Reel candidate. */
  const imported = (t) => t.episode("2026-10-13 Talk (Mac Studio)", { reels: [{ n: 1, status: "candidate", from: 61.2, to: 103.3, title: "Price like you mean it", why: "It stands alone.", files: ["Talk.reel-1.mp4"], pushed: [] }] }, { "Talk.mov": 5, "Talk.edit-notes.txt": NOTES.length, "edit/main.v0.fcpxml": 0 });
  it("shows the name, the placeholder line, the title, the notes, the Reel candidates and the next step", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(join(path, "Talk.edit-notes.txt"), NOTES);
    const r = await t.run("open", "talk");
    assert.equal(r.code, 0, r.text);
    const lines = r.said.filter((line) => !line.startsWith("So that Dropbox keeps this episode"));
    assert.deepEqual(lines, [
      "Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio)",
      "The name is a placeholder: say what to call it.",
      "No title yet.",
      "Claude's notes, the first lines:",
      ...Array.from({ length: 12 }, (_, i) => `  Note line ${i + 1}.`),
      "Reel candidates:",
      '  1. "Price like you mean it", 0:42. It stands alone.',
      "Not shown in Final Cut yet.",
      'Say "show it in Final Cut" to see the main video there.'
    ]);
    t.done();
  });
  it("refuses an episode with a conflicted copy of its record or a timeline, naming it", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(join(path, "edit", "main.v0 (Jason Ogden's conflicted copy 2026-10-14).fcpxml"), "x");
    const r = await t.run("open", "talk");
    assert.equal(r.code, 1);
    assert.match(r.text, /^2026-10-13 Talk \(Mac Studio\): Dropbox has kept a conflicted copy in this episode: edit\/main\.v0 \(Jason Ogden's conflicted copy 2026-10-14\)\.fcpxml\./);
    t.done();
  });
  it("refuses an episode with a file missing or short, naming it", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(join(path, "Talk.mov"), "x");
    const r = await t.run("open", "talk");
    assert.deepEqual([r.code, r.said], [1, ["2026-10-13 Talk (Mac Studio) is not whole in Dropbox:", "  Talk.mov is short: 1 bytes of 5", "It is not opened. Say \"what's waiting?\" to see the episodes."]]);
    t.done();
  });
  it("says first that Dropbox undid this Mac's last change, when the newest record is older than the one it wrote", async () => {
    const t = setup();
    const { record } = imported(t);
    mkdirSync(join(t.home, "Library", "Application Support", "BRIMM Video"), { recursive: true });
    writeFileSync(join(t.home, "Library", "Application Support", "BRIMM Video", "written.json"), JSON.stringify({ [record.id]: 2 }));
    const r = await t.run("open", "talk");
    assert.equal(r.said[0], "Dropbox undid this Mac's last change to Talk. Say it again.");
    t.done();
  });
  it("starts a detached run to bring over the files that are not whole yet, and returns at once", async () => {
    const t = setup();
    imported(t);
    t.deps.isWhole = (path) => !path.endsWith("Talk.mov");
    const r = await t.run("open", "talk");
    assert.equal(r.code, 0);
    assert.deepEqual(r.said, ['Dropbox is bringing 1 file of Talk over to this Mac. Say "open Talk" again when it is done; "how far is it?" shows how far it has got.']);
    assert.deepEqual(t.started, [[process.execPath, "/checkout/tool/edit.js", "bring", "--now", "2026-10-13 Talk (Mac Studio)"]]);
    t.done();
  });
  it("says at the first open on this Mac how to keep the episode offline, and not after", async () => {
    const t = setup();
    const { path } = imported(t);
    const first = await t.run("open", "talk");
    assert.ok(first.said.includes(`So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${path}`), first.text);
    const again = await t.run("open", "talk");
    assert.ok(!again.text.includes("Make available offline"), again.text);
    t.done();
  });
  it("does not open a record of a newer layout, since opening writes the claim, and says this Mac needs updating", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: "e-20261013-000001", rev: 2 }));
    const r = await t.run("open", "talk");
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, ["That is an episode a newer brimm-video wrote (000001). Jason has a newer brimm-video. Ask him to update this Mac."]);
    t.done();
  });
  it("names the episodes when it cannot tell which is meant, and how it is used when none is named", async () => {
    const t = setup();
    imported(t);
    t.episode("2026-10-14 Pricing talk (Mac Studio)");
    assert.deepEqual(await t.run("open", "talk"), { code: 1, said: ['More than one episode fits "talk": 2026-10-14 Pricing talk (Mac Studio) and 2026-10-13 Talk (Mac Studio). Say which.'], text: 'More than one episode fits "talk": 2026-10-14 Pricing talk (Mac Studio) and 2026-10-13 Talk (Mac Studio). Say which.' });
    assert.equal((await t.run("open")).code, 2);
    t.done();
  });
});

describe("node edit.js push", () => {
  /** An episode as the import leaves it, of the video `video`, with its timeline edit/main.v0.fcpxml as the import writes it. */
  const imported = (t, video = "Talk.mov", folder = "2026-10-13 Talk (Mac Studio)") => {
    const v0 = fcpxml({ video: join(t.episodes, folder, video), facts: { duration: 120, frameRate: "30000/1001", width: 1280, height: 720, hasAudio: true }, ranges: [{ start: 0, end: 10 }], src: relativeUrl(`../${video}`) });
    const made = t.episode(folder, { video: { file: video, bytes: 5, seconds: 120, recorded: "2026-10-13", recordedFrom: "import" }, name: { text: video.replace(/\.[^.]+$/, ""), placeholder: true } }, { [video]: 5, "edit/main.v0.fcpxml": Buffer.byteLength(v0) });
    writeFileSync(join(made.path, "edit", "main.v0.fcpxml"), v0);
    return made;
  };
  const record = (t, folder = "2026-10-13 Talk (Mac Studio)") => readEpisode(join(t.episodes, folder)).record;
  it("pushes v1: the timeline kept in edit/ by the rule, the local copy with this Mac's paths and library, and Final Cut asked to open it", async () => {
    const t = setup();
    const { path } = imported(t);
    const r = await t.run("push", "talk", "main");
    assert.equal(r.code, 0, r.text);
    const kept = readFileSync(join(path, "edit", "main.v1.mac-studio.fcpxml"), "utf8");
    assert.ok(t.clones.includes(join(path, "edit", "main.v1.mac-studio.fcpxml")));
    assert.deepEqual(tags(kept, "media-rep").map((m) => m.src), ["../Talk.mov"]);
    assert.doesNotMatch(kept, /import-options/);
    assert.deepEqual([tags(kept, "project")[0].name, tags(kept, "event")[0].name], ["Talk main v1 000001", "2026-10-13 Talk (Mac Studio)"]);
    const local = join(t.home, "BRIMM Video Work", "2026-10-13 Talk (Mac Studio)", "pushed", "main.v1.mac-studio.fcpxml");
    const copy = readFileSync(local, "utf8");
    assert.deepEqual(tags(copy, "media-rep").map((m) => m.src), [fileUrl(join(path, "Talk.mov"))]);
    assert.deepEqual(tags(copy, "option"), [
      { key: "library location", value: fileUrl(libraryFor(t.home, "2026-10-13 Talk (Mac Studio)")) },
      { key: "copy assets", value: "0" },
      { key: "suppress warnings", value: "1" }
    ]);
    assert.deepEqual(t.opened, [["Final Cut Pro", local]]);
    assert.ok(r.said.includes('Shown in Final Cut as "Talk main v1 000001", in the library 2026-10-13 Talk (Mac Studio).fcpbundle in BRIMM Video Work.'), r.text);
    t.done();
  });
  it("records the push with its project's name, and lists the kept timeline with its size", async () => {
    const t = setup();
    const { path } = imported(t);
    await t.run("push", "talk");
    const r = record(t);
    assert.equal(r.rev, 2);
    assert.deepEqual(r.main.pushed.map(({ at, asked, ...p }) => p), [{ v: 1, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: "Talk main v1 000001" }]);
    // And what the session had asked for, as a digest a finish compares (phase 4).
    assert.match(r.main.pushed[0].asked, /^[0-9a-f]{12}$/);
    assert.equal(r.files["edit/main.v1.mac-studio.fcpxml"], statSync(join(path, "edit", "main.v1.mac-studio.fcpxml")).size);
    assert.deepEqual(r.libraries, { "Mac Studio": "2026-10-13 Talk (Mac Studio).fcpbundle" });
    t.done();
  });
  it("refuses a second push with no answer, and asks whether the timeline was changed in Final Cut", async () => {
    const t = setup();
    imported(t);
    await t.run("push", "talk");
    t.opened.length = 0;
    const r = await t.run("push", "talk");
    assert.deepEqual([r.code, r.said, t.opened, record(t).rev], [1, ['Did you change v1 of Talk in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.'], [], 2]);
    t.done();
  });
  it("stops at a yes, and says how to work until brimm-video can build on hand edits; nothing is written and Final Cut is not asked", async () => {
    const t = setup();
    const { path } = imported(t);
    await t.run("push", "talk");
    t.opened.length = 0;
    const r = await t.run("push", "talk", "--hand-edits");
    assert.deepEqual([r.code, r.said], [1, ["Your changes stay in v1 in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v1."]]);
    assert.deepEqual([t.opened, record(t).rev, readdirSync(join(path, "edit")).sort()], [[], 2, ["main.v0.fcpxml", "main.v1.mac-studio.fcpxml"]]);
    t.done();
  });
  it("pushes v2 with --no-hand-edits, and records the answer", async () => {
    const t = setup();
    imported(t);
    await t.run("push", "talk");
    const r = await t.run("push", "talk", "main", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(record(t).main.pushed.map((p) => [p.v, p.project, p.answer]), [[1, "Talk main v1 000001", undefined], [2, "Talk main v2 000001", "no hand edits since v1"]]);
    t.done();
  });
  it("refuses when a record was written after the one it read, and does not open Final Cut", async () => {
    const t = setup();
    const { path } = imported(t);
    const clone = t.deps.clone;
    // The other Mac writes record 2 while this push is putting its timeline into Dropbox.
    t.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".fcpxml")) writeFileSync(recordFile(path, 2), "{");
    };
    const r = await t.run("push", "talk");
    assert.deepEqual([r.code, r.said, t.opened], [1, ["This episode changed on the other Mac: open it again."], []]);
    t.done();
  });
  it("pushes again after a refusal that left its timeline in edit/ unlisted, putting a new one in its place", async () => {
    const t = setup();
    const { path } = imported(t);
    const clone = t.deps.clone;
    t.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith(".fcpxml")) writeFileSync(recordFile(path, 2), "{");
    };
    await t.run("push", "talk");
    rmSync(recordFile(path, 2));
    t.deps.clone = clone;
    const r = await t.run("push", "talk");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(record(t).main.pushed.map((p) => p.v), [1]);
    t.done();
  });
  it("refuses an episode with a conflicted copy", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(join(path, "record", "0001 (Sallie Ogden's conflicted copy 2026-10-14).json"), "{}");
    const r = await t.run("push", "talk");
    assert.equal(r.code, 1);
    assert.match(r.text, /^2026-10-13 Talk \(Mac Studio\): Dropbox has kept a conflicted copy in this episode/);
    t.done();
  });
  it("refuses when the video is not whole on this Mac yet", async () => {
    const t = setup();
    imported(t);
    t.deps.isWhole = (path) => !path.endsWith("Talk.mov");
    const r = await t.run("push", "talk");
    assert.deepEqual([r.code, r.said, t.opened], [1, ['Dropbox is still bringing Talk.mov over to this Mac. Say "open Talk" first.'], []]);
    t.done();
  });
  it("refuses media outside the episode's folder, naming it", async () => {
    const t = setup();
    const { path } = imported(t);
    const v0 = readFileSync(join(path, "edit", "main.v0.fcpxml"), "utf8").replace('src="../Talk.mov"', 'src="file:///Users/sallie/Movies/b-roll.mov"');
    writeFileSync(join(path, "edit", "main.v0.fcpxml"), v0);
    const { record: r } = readEpisode(path);
    writeFileSync(recordFile(path, 2), recordText({ ...r, rev: 2, files: { ...r.files, "edit/main.v0.fcpxml": Buffer.byteLength(v0) } }));
    const out = await t.run("push", "talk");
    assert.deepEqual([out.code, out.said, t.opened], [1, ["/Users/sallie/Movies/b-roll.mov is outside the episode's folder. Copy it into its media folder first."], []]);
    t.done();
  });
  it("names a video with an apostrophe, #, & and % rightly in the kept timeline, the local copy and the project", async () => {
    const t = setup();
    const video = "Sallie's talk #1 & 100%.mov";
    const folder = "2026-10-13 Sallie's talk #1 & 100% (Mac Studio)";
    const { path } = imported(t, video, folder);
    const r = await t.run("push", "Sallie's talk");
    assert.equal(r.code, 0, r.text);
    const kept = readFileSync(join(path, "edit", "main.v1.mac-studio.fcpxml"), "utf8");
    assert.deepEqual(tags(kept, "media-rep").map((m) => m.src), ["../Sallie's%20talk%20%231%20%26%20100%25.mov"]);
    const copy = readFileSync(join(t.home, "BRIMM Video Work", folder, "pushed", "main.v1.mac-studio.fcpxml"), "utf8");
    assert.deepEqual(tags(copy, "media-rep").map((m) => decodeURIComponent(m.src.replace("file://", ""))), [join(path, video)]);
    // The name as the file writes it, with & written out.
    assert.equal(tags(copy, "project")[0].name, "Sallie's talk #1 &amp; 100% main v1 000001");
    t.done();
  });
  it("never hands Final Cut a project name twice, even after Final Cut could not be asked to open one", async () => {
    // Phase 0, 2026-10-14: Final Cut 12.4 asks before it replaces a project of the same name, and Keep Both renames the new
    // one "<name> 1", whose Share then no longer has the name the push recorded. So each push's version is used up when its
    // record is written, before Final Cut is asked.
    const t = setup();
    imported(t);
    t.deps.openApp = () => {
      throw new Error("Final Cut Pro could not be opened");
    };
    const failed = await t.run("push", "talk");
    assert.equal(failed.code, 1);
    t.deps.openApp = (app, file) => t.opened.push([app, file]);
    const second = await t.run("push", "talk", "--no-hand-edits");
    assert.equal(second.code, 0, second.text);
    const third = await t.run("push", "talk", "--no-hand-edits");
    assert.equal(third.code, 0, third.text);
    const projects = record(t).main.pushed.map((p) => p.project);
    assert.deepEqual(projects, ["Talk main v1 000001", "Talk main v2 000001", "Talk main v3 000001"]);
    const handed = t.opened.map(([, file]) => tags(readFileSync(file, "utf8"), "project")[0].name);
    assert.deepEqual(handed, ["Talk main v2 000001", "Talk main v3 000001"]);
    t.done();
  });
  it("hands \"push … reel <n>\" to the push of a Reel, which refuses a Reel the episode does not have", async () => {
    const t = setup();
    imported(t);
    assert.deepEqual(await t.run("push", "talk", "reel", "1"), { code: 1, said: ["There is no Reel 1."], text: "There is no Reel 1." });
    t.done();
  });
});

describe("node edit.js bring, status and retry", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const drop = (t) => join(t.root, "Unedited Video", "Mac Studio");
  /** A status file, as an import would leave it, written `minutesAgo`. */
  const status = (t, video, more = {}, minutesAgo = 1) => {
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${video} (Mac Studio) 1.json`), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, video, bytes: 5, seconds: 120, step: "Making the rough cut", at: new Date(NOW - minutesAgo * 60000).toISOString(), ...more }));
  };
  it("bring reads the files that were not whole to their end, and says which are whole now, in its result", async () => {
    const t = setup();
    t.episode(FOLDER);
    let reads = 0;
    t.deps.isWhole = (path) => !path.endsWith("Talk.mov") || reads > 0;
    t.deps.readAll = async (path) => {
      reads += 1;
      return path;
    };
    t.deps.keepAwake = () => {};
    const r = await t.run("bring", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    const result = JSON.parse(readFileSync(join(t.home, "BRIMM Video Work", FOLDER, "bring.result.json"), "utf8"));
    assert.deepEqual([result.ok, result.made, result.failed, result.next], [true, ["Talk.mov"], [], 'Every file of Talk is here. Say "open Talk".']);
    t.done();
  });
  it("status shows an import's step, a detached run at work on an episode, and the last result of one", async () => {
    const t = setup();
    t.episode(FOLDER);
    const progress = join(t.home, "Library", "Application Support", "BRIMM Video", "progress");
    mkdirSync(progress, { recursive: true });
    writeFileSync(join(progress, "4242.json"), JSON.stringify({ version: 1, pid: 4242, video: "Budget.mov", detail: "Making the rough cut (step 5 of 8), 40%" }));
    writeFileSync(join(progress, "4343.json"), JSON.stringify({ version: 1, pid: 4343, video: "Old.mov", detail: "Reading the sound (step 1 of 8)" }));
    const work = join(t.home, "BRIMM Video Work", FOLDER);
    mkdirSync(work, { recursive: true });
    // A run of another command is at work on the episode now; the result of bring is from before. A result of the command
    // that is running again is not shown: the run will leave a new one.
    writeFileSync(join(work, "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    writeFileSync(join(work, "finish.result.json"), JSON.stringify({ version: 1, command: "finish", started: NOW - 3600000, ended: NOW - 3500000, ok: true, made: [], failed: [], next: "" }));
    writeFileSync(join(work, "bring.result.json"), JSON.stringify({ version: 1, command: "bring", started: NOW - 120000, ended: NOW - 60000, ok: false, made: ["Talk.mov"], failed: ["Talk.srt is still not whole"], next: "Say open again." }));
    status(t, "Budget.mov");
    t.deps.alive = (pid) => pid === 4242;
    const r = await t.run("status");
    assert.deepEqual(r.said, [
      "Running on this Mac:",
      "  Budget.mov: Making the rough cut (step 5 of 8), 40%",
      "Imports:",
      "  Budget.mov: being imported on Mac Studio, at Making the rough cut",
      `${FOLDER}: finish is running.`,
      `${FOLDER}: bring ended 1 minute ago. Made: Talk.mov. Not done: Talk.srt is still not whole. Say open again.`
    ]);
    const one = await t.run("status", "budget");
    assert.ok(!one.text.includes(FOLDER), one.text);
    t.done();
  });
  it("status says nothing is running when nothing is", async () => {
    const t = setup();
    assert.deepEqual((await t.run("status")).said, ["Nothing is running, and nothing is waiting."]);
    t.done();
  });
  it("retry takes away a failed import's status and asks the launch agent to look again", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    status(t, "Talk.mov", { failed: "the transcriber stopped" }, 30);
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [0, ["Talk.mov is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."]]);
    assert.deepEqual([readdirSync(join(t.episodes, ".importing")), kicked, t.started], [[], 1, []]);
    t.done();
  });
  it("retry refuses while the import is running", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    status(t, "Talk.mov");
    const r = await t.run("retry", "Talk.mov");
    assert.deepEqual([r.code, r.said, t.started], [1, ["Talk.mov is being imported now, at Making the rough cut. The panel shows how far it is."], []]);
    t.done();
  });
  // A Zoom download in a light drop folder is held, until phase Z: its status says why (importing.js, held).
  const ZOOM = "GMT20261013-142933_Recording_gvo_1280x720.mp4";
  const HELD = "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer.";
  it("episodes says why a held video waits in the drop folder, and neither it nor status lists it as an import", async () => {
    const t = setup();
    writeFileSync(join(drop(t), ZOOM), "video");
    status(t, ZOOM, { held: HELD, step: "Held", seconds: null }, 600);
    // How long it has waited is from when it came into the folder, which a test cannot set: so the clock is set from it.
    t.deps.now = () => statSync(join(drop(t), ZOOM)).ctimeMs + 2 * 3600000;
    const r = await t.run("episodes");
    assert.ok(r.text.includes(`Waiting in the drop folders:\n  ${ZOOM}, in Mac Studio's, for 2 hours: ${HELD}`), r.text);
    assert.ok(!r.text.includes("Imports:") && !r.text.includes("being imported") && !r.text.includes("stopped on"), r.text);
    const s = await t.run("status");
    assert.ok(!s.text.includes(ZOOM) && !s.text.includes("being imported"), s.text);
    t.done();
  });
  it("retry says a held video is held, and why, and does nothing: trying again would hold it again", async () => {
    const t = setup();
    writeFileSync(join(drop(t), ZOOM), "video");
    status(t, ZOOM, { held: HELD, step: "Held", seconds: null, bytes: 5 }, 600);
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", ZOOM);
    assert.deepEqual([r.code, r.said, kicked, t.started], [1, [`${ZOOM} is held: ${HELD}`], 0, []]);
    assert.equal(readdirSync(join(t.episodes, ".importing")).length, 1);
    t.done();
  });
  it("retry takes away the status of a held video that is another file now, and asks the launch agent to look", async () => {
    const t = setup();
    writeFileSync(join(drop(t), ZOOM), "another recording");
    status(t, ZOOM, { held: HELD, step: "Held", seconds: null, bytes: 5 }, 600);
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", ZOOM);
    assert.deepEqual([r.code, kicked, readdirSync(join(t.episodes, ".importing"))], [0, 1, []]);
    t.done();
  });
  it("retry names the videos in the drop folder when it cannot find the one said", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    writeFileSync(join(drop(t), "Budget.mov"), "video");
    const r = await t.run("retry", "pricing");
    assert.deepEqual([r.code, r.said], [1, [`No video in this Mac's drop folder fits "pricing". It holds: Budget.mov and Talk.mov.`]]);
    t.done();
  });
});

describe("what the final review found in edit.js", () => {
  const imported = (t) => {
    const folder = "2026-10-13 Talk (Mac Studio)";
    const v0 = fcpxml({ video: join(t.episodes, folder, "Talk.mov"), facts: { duration: 120, frameRate: "30000/1001", width: 1280, height: 720, hasAudio: true }, ranges: [{ start: 0, end: 10 }], src: relativeUrl("../Talk.mov") });
    const made = t.episode(folder, {}, { "Talk.mov": 5, "edit/main.v0.fcpxml": Buffer.byteLength(v0) });
    writeFileSync(join(made.path, "edit", "main.v0.fcpxml"), v0);
    return made;
  };
  const projects = (t) => t.opened.map(([, file]) => tags(readFileSync(file, "utf8"), "project")[0].name);
  it("stops a push given both a yes and a no to the guard: a yes always stops it", async () => {
    const t = setup();
    imported(t);
    await t.run("push", "talk");
    const r = await t.run("push", "talk", "--no-hand-edits", "--hand-edits");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Your changes stay in v1 in Final Cut\./);
    assert.equal(t.opened.length, 1);
    t.done();
  });
  it("pushes again after saying once that Dropbox undid a push, and never hands Final Cut a project name twice", async () => {
    const t = setup();
    const { path } = imported(t);
    await t.run("push", "talk");
    rmSync(recordFile(path, 2));
    const said = await t.run("push", "talk", "--no-hand-edits");
    assert.deepEqual([said.code, said.said], [1, ["Dropbox undid this Mac's last change to Talk. Say it again."]]);
    const again = await t.run("push", "talk", "--no-hand-edits");
    assert.equal(again.code, 0, again.text);
    assert.deepEqual(projects(t), ["Talk main v1 000001", "Talk main v2 000001"]);
    t.done();
  });
  it("says Final Cut Pro could not be opened when open fails, and not that it was shown", () => {
    assert.throws(() => openApp("Final Cut Pro", "/x.fcpxml", () => ({ status: 1, stderr: "Unable to find application named 'Final Cut Pro'\n" })), { message: "Final Cut Pro could not be opened (Unable to find application named 'Final Cut Pro')" });
    assert.doesNotThrow(() => openApp("Final Cut Pro", "/x.fcpxml", () => ({ status: 0, stderr: "" })));
  });
  it("retry has the late check made that this Mac still owes an imported video, whose import stopped (PR 19's re-review, N19)", async () => {
    const t = setup();
    const folder = "2026-10-13 Talk (Mac Studio)";
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    const { path, record } = t.episode(folder);
    writeFileSync(join(drop, "Talk.mov"), "x".repeat(5));
    mkdirSync(join(t.episodes, ".importing"), { recursive: true });
    writeFileSync(join(t.episodes, ".importing", "Talk.mov (Mac Studio) 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, video: "Talk.mov", bytes: 5, seconds: 120, step: "Waiting for its late check", at: new Date(NOW - 30 * 60000).toISOString() }));
    writePending(t.home, { version: 1, id: record.id, name: folder, folder: path, video: "Talk.mov", bytes: 5, seconds: 120, drop: join(drop, "Talk.mov"), work: "/nowhere", entries: [], lastCopy: NOW - 30 * 60000, root: t.root, machine: "Mac Studio", planTxt: "Talk.cut-plan.txt" });
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [0, [`Talk.mov is imported, as ${folder}, and its late check is still to be made on this Mac: the Mac's import of its drop folder is asked to make it now. The panel shows how far it is.`]]);
    assert.equal(kicked, 1);
    t.done();
  });
  /** An imported Talk.mov whose late check this Mac owes, kept with `more`, and the times the agent was asked to look. */
  const owing = (more = {}) => {
    const t = setup();
    const folder = "2026-10-13 Talk (Mac Studio)";
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    const { path, record } = t.episode(folder);
    writeFileSync(join(drop, "Talk.mov"), "x".repeat(5));
    writePending(t.home, { version: 1, id: record.id, name: folder, folder: path, video: "Talk.mov", bytes: 5, seconds: 120, drop: join(drop, "Talk.mov"), work: "/nowhere", entries: [], lastCopy: NOW - 30 * 60000, root: t.root, machine: "Mac Studio", planTxt: "Talk.cut-plan.txt", ...more });
    t.kicked = 0;
    t.deps.kickstart = () => (t.kicked += 1);
    return t;
  };
  const clock = (ms) => `${String(new Date(ms).getHours()).padStart(2, "0")}:${String(new Date(ms).getMinutes()).padStart(2, "0")}`;
  it("retry says plainly, while the import at work has found a problem at the late check, that it does not make it again (PR 19's check of dfe3aab, D7, M2)", async () => {
    const t = owing({ problem: "reel-2.mp4 could not be put into the episode." });
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [1, ['Talk.mov is imported, as 2026-10-13 Talk (Mac Studio), and its late check found a problem: reel-2.mp4 could not be put into the episode. The import at work now does not make it again: once the problem is put right and the panel shows that import has ended, say "try it again" again.'], 0]);
    t.done();
  });
  it("retry has a late check that found a problem made again when no import is at work", async () => {
    const t = owing({ problem: "reel-2.mp4 could not be put into the episode." });
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, ["Talk.mov is imported, as 2026-10-13 Talk (Mac Studio), and its late check found a problem before (reel-2.mp4 could not be put into the episode): the Mac's import of its drop folder is asked to make it again now. The panel shows how far it is."], 1]);
    t.done();
  });
  it("retry says the import at work makes a due late check once it has finished any video it is importing (PR 19's check of 2d4c8af, F7)", async () => {
    const t = owing();
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, ["Talk.mov is imported, as 2026-10-13 Talk (Mac Studio), and its late check is still to be made on this Mac: the import at work now makes it once it has finished any video it is importing. The panel shows how far it is."], 0]);
    t.done();
  });
  it("retry says when the import at work makes a late check that is not due yet (D8, D12)", async () => {
    const t = owing({ lastCopy: NOW - 5 * 60000 });
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, [`Talk.mov is imported, as 2026-10-13 Talk (Mac Studio), and its late check is still to be made on this Mac: the import at work now makes it when it is due, at ${clock(NOW + 10 * 60000)}, once it has finished any video it is importing. The panel shows how far it is.`], 0]);
    t.done();
  });
  it("retry says the import it starts makes a late check that is not due yet when it is due (E15)", async () => {
    const t = owing({ lastCopy: NOW - 5 * 60000 });
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, [`Talk.mov is imported, as 2026-10-13 Talk (Mac Studio), and its late check is still to be made on this Mac: the Mac's import of its drop folder is asked to make it when it is due, at ${clock(NOW + 10 * 60000)}. The panel shows how far it is.`], 1]);
    t.done();
  });
  it("retry takes away a stopped status of this Mac's own for an imported video when it owes no late check of it", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "x".repeat(5));
    mkdirSync(join(t.episodes, ".importing"), { recursive: true });
    writeFileSync(join(t.episodes, ".importing", "Talk.mov (Mac Studio) 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, video: "Talk.mov", bytes: 5, seconds: 120, step: "Waiting for its late check", at: new Date(NOW - 30 * 60000).toISOString() }));
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [0, ["Talk.mov is imported, as 2026-10-13 Talk (Mac Studio). Its import stopped on this Mac, and has no late check left to make here, so the status that held the episode is taken away."]]);
    assert.deepEqual([readdirSync(join(t.episodes, ".importing")), kicked], [[], 0]);
    t.done();
  });
  it("retry still refuses an imported video whose late check this Mac does not owe", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "x".repeat(5));
    let kicked = 0;
    t.deps.kickstart = () => (kicked += 1);
    const r = await t.run("retry", "talk");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Talk\.mov is already imported as /);
    assert.equal(kicked, 0);
    t.done();
  });
  it("retry asks the launch agent to look again, and starts no run of its own", async () => {
    const t = setup();
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "video");
    const kicked = [];
    t.deps.kickstart = () => kicked.push("com.thebrimm.unedited");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, kicked, t.started], [0, ["Talk.mov is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."], ["com.thebrimm.unedited"], []]);
    t.done();
  });
  it("retry says so when the launch agent is not there to ask", async () => {
    const t = setup();
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "video");
    t.deps.kickstart = () => {
      throw new Error("Could not find service");
    };
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [1, ["The launch agent com.thebrimm.unedited could not be asked to look (Could not find service). Jason runs install.sh --machine on this Mac."]]);
    t.done();
  });
  it("retry says a video an episode already holds is imported, and does nothing", async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "video");
    t.deps.kickstart = () => assert.fail("nothing is asked");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [1, ["Talk.mov is already imported as 2026-10-13 Talk (Mac Studio). It stays in the drop folder until its late check passes, or for a person to delete."]]);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in edit.js", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const imported = (t) => {
    const v0 = fcpxml({ video: join(t.episodes, FOLDER, "Talk.mov"), facts: { duration: 120, frameRate: "30000/1001", width: 1280, height: 720, hasAudio: true }, ranges: [{ start: 0, end: 10 }], src: relativeUrl("../Talk.mov") });
    const made = t.episode(FOLDER, {}, { "Talk.mov": 5, "edit/main.v0.fcpxml": Buffer.byteLength(v0) });
    writeFileSync(join(made.path, "edit", "main.v0.fcpxml"), v0);
    return made;
  };
  const OFFLINE = (t, path) => `So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${path}`;
  it("1. lists a library Final Cut has made, with its .fcpcache link to itself, counting its own files once and no linked media", async () => {
    const t = setup();
    const library = libraryFor(t.home, FOLDER);
    mkdirSync(join(library, "Event", "Original Media"), { recursive: true });
    writeFileSync(join(library, "Event", "render"), "x".repeat(2 * 2 ** 20));
    symlinkSync(".", join(library, ".fcpcache"));
    writeFileSync(join(t.dir, "outside.mov"), "x".repeat(5 * 2 ** 20));
    symlinkSync(join(t.dir, "outside.mov"), join(library, "Event", "Original Media", "Talk.mov"));
    const r = await t.run("episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes(`  ${FOLDER}.fcpbundle: 2.0 MB`), r.text);
    t.done();
  });
  it("5. lists an episode written by a newer brimm-video by its short id alone, without reading its fields", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: "e-20261013-000001", rev: 2 }));
    const r = await t.run("episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes("Episodes, newest first:\n  An episode a newer brimm-video wrote (000001): Jason updates this Mac before it is changed here.\n"), r.text);
    t.done();
  });
  it("6. says the offline step at the first open that completes, even when a bring came first, and only once", async () => {
    const t = setup();
    const { path } = imported(t);
    t.deps.isWhole = () => false;
    const bringing = await t.run("open", "talk");
    assert.ok(!bringing.said.includes(OFFLINE(t, path)), bringing.text);
    // The detached run that brings the files over makes this Mac's folder for the episode, as runDetached does.
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER), { recursive: true });
    delete t.deps.isWhole;
    const first = await t.run("open", "talk");
    assert.ok(first.said.includes(OFFLINE(t, path)), first.text);
    const again = await t.run("open", "talk");
    assert.ok(!again.said.includes(OFFLINE(t, path)), again.text);
    t.done();
  });
  it("6. says the offline step at a push that comes before any open on this Mac", async () => {
    const t = setup();
    const { path } = imported(t);
    const pushed = await t.run("push", "talk");
    assert.ok(pushed.said.includes(OFFLINE(t, path)), pushed.text);
    const opened = await t.run("open", "talk");
    assert.ok(!opened.said.includes(OFFLINE(t, path)), opened.text);
    t.done();
  });
  it("11. writes a push's record into Dropbox by the rule, as a clone", async () => {
    const t = setup();
    const { path } = imported(t);
    await t.run("push", "talk");
    assert.ok(t.clones.includes(recordFile(path, 2)), t.clones.join("\n"));
    t.done();
  });
  it("12. still asks about v1 after saying Dropbox undid a push, when the push says nothing of hand edits", async () => {
    const t = setup();
    const { path } = imported(t);
    await t.run("push", "talk");
    rmSync(recordFile(path, 2));
    await t.run("push", "talk");
    const r = await t.run("push", "talk");
    assert.deepEqual([r.code, r.said], [1, ['Did you change v1 of Talk in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.']]);
    assert.equal(t.opened.length, 1);
    t.done();
  });
  it("19. finds a folder by its exact name however its accents are written, and episodes shows each one's short id", async () => {
    const t = setup();
    t.episode("2026-10-13 Café talk (Mac Studio)", { name: { text: "Café talk", placeholder: true } });
    const ctx = contextFor({ ...t.deps, say: () => {} });
    assert.equal(findEpisode(ctx, "2026-10-13 Café talk (Mac Studio)").name, "2026-10-13 Café talk (Mac Studio)");
    const r = await t.run("episodes");
    assert.ok(r.text.includes("Café talk (a placeholder name): an episode of 2:00, in 2026-10-13 Café talk (Mac Studio), id 000001"), r.text);
    t.done();
  });
  it("20. leaves an import that has not finished out of what a person's words find", async () => {
    const t = setup();
    imported(t);
    mkdirSync(join(t.episodes, "2026-10-14 Talk (Mac Studio)"), { recursive: true });
    const ctx = contextFor({ ...t.deps, say: () => {} });
    assert.equal(findEpisode(ctx, "talk").name, FOLDER);
    t.done();
  });
  it("21. ends a push of an episode written by a newer brimm-video with 1", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: "e-20261013-000001", rev: 2 }));
    assert.equal((await t.run("push", "talk")).code, 1);
    t.done();
  });
});

describe("retry, with the launch agent idle or at work", () => {
  const drop = (t) => join(t.root, "Unedited Video", "Mac Studio");
  const failedStatus = (t) => {
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "Talk.mov (Mac Studio) k3 1.json"), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, import: "k3", video: "Talk.mov", bytes: 5, seconds: 120, step: "Writing the transcript", at: new Date(NOW - 30 * 60000).toISOString(), failed: "the transcriber stopped" }));
  };
  it("asks an idle launch agent to start", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    failedStatus(t);
    const kicked = [];
    t.deps.agentRunning = () => false;
    t.deps.kickstart = () => kicked.push(1);
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, kicked.length], [0, ["Talk.mov is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."], 1]);
    t.done();
  });
  it("says truthfully when the launch agent's run is at work: that run takes it when it next looks", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    failedStatus(t);
    t.deps.agentRunning = () => true;
    t.deps.kickstart = () => assert.fail("a run is at work, and none is started");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [0, ["Talk.mov is imported again by the import at work now, when it next looks in the drop folder: within a minute while it waits for a late check, or once it has finished the video it is on. The panel shows how far it is."]]);
    assert.deepEqual(readdirSync(join(t.episodes, ".importing")), []);
    t.done();
  });
});

describe("the lead's re-check of PR 11, in edit.js", () => {
  const drop = (t) => join(t.root, "Unedited Video", "Mac Studio");
  const status = (t, id, more) => {
    const folder = join(t.episodes, ".importing");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `Talk.mov (Mac Studio) ${id} 1.json`), JSON.stringify({ version: 1, machine: "Mac Studio", pid: 4242, import: id, video: "Talk.mov", bytes: 5, seconds: 120, step: "Making the rough cut", at: new Date(NOW - 60000).toISOString(), ...more }));
  };
  it("4. retries the failed import of a name, and leaves a running one of that name alone", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    status(t, "aaa", {});
    status(t, "bbb", { failed: "the transcriber stopped", at: new Date(NOW - 30 * 60000).toISOString() });
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(readdirSync(join(t.episodes, ".importing")), ["Talk.mov (Mac Studio) aaa 1.json"]);
    t.done();
  });
  it("4. says which failed imports it takes again when more than one of a name failed", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    status(t, "aaa", { failed: "ffmpeg stopped" });
    status(t, "bbb", { failed: "the transcriber stopped" });
    t.deps.agentRunning = () => false;
    t.deps.kickstart = () => {};
    const r = await t.run("retry", "talk");
    assert.equal(r.code, 0, r.text);
    assert.match(r.said[0], /^Talk\.mov is imported again \(its imports aaa, which failed: ffmpeg stopped, and bbb, which failed: the transcriber stopped\)/);
    assert.deepEqual(readdirSync(join(t.episodes, ".importing")), []);
    t.done();
  });
});

describe("the lead's last check of PR 11, in edit.js", () => {
  const drop = (t) => join(t.root, "Unedited Video", "Mac Studio");
  const seen = (t, entries) => {
    const file = join(t.home, "Library", "Application Support", "BRIMM Video", "seen.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(entries));
  };
  it("3. says how long a video has waited from when this Mac first saw it, which a tag set after it came does not change", async () => {
    const t = setup();
    const video = join(drop(t), "Talk.mov");
    writeFileSync(video, "video");
    const { ino } = statSync(video);
    seen(t, { [`Talk.mov:${ino}:5`]: { path: video, at: NOW - 20 * 60000 } });
    // A tag set a minute ago changed its ctime; its own date is a month old.
    t.deps.stat = () => ({ ino, size: 5, birthtimeMs: NOW - 30 * 86400000, ctimeMs: NOW - 60000, mtimeMs: NOW - 30 * 86400000 });
    const r = await t.run("episodes");
    assert.ok(r.text.includes("  Talk.mov, in Mac Studio's, for 20 minutes"), r.text);
    t.done();
  });
  it("22. says how long a video has waited from when it came into the drop folder, not from its own date, when this Mac has not seen it yet", async () => {
    const t = setup();
    const video = join(drop(t), "Old.mov");
    writeFileSync(video, "video");
    utimesSync(video, new Date(NOW - 30 * 86400000), new Date(NOW - 30 * 86400000));
    const came = statSync(video).ctimeMs;
    t.deps.now = () => came + 5 * 60000;
    const r = await t.run("episodes");
    assert.ok(r.text.includes("  Old.mov, in Mac Studio's, for 5 minutes"), r.text);
    t.done();
  });
  it("4. says another run is taking over the lock when a guard a crashed run left stands in the way", { timeout: 20000 }, async () => {
    const t = setup();
    t.episode("2026-10-13 Talk (Mac Studio)");
    const work = join(t.home, "BRIMM Video Work", "2026-10-13 Talk (Mac Studio)");
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    writeFileSync(join(work, "episode.lock.takeover"), JSON.stringify({ pid: 4343, command: "bring" }));
    t.deps.keepAwake = () => {};
    const r = await t.run("bring", "--now", "2026-10-13 Talk (Mac Studio)");
    assert.deepEqual([r.code, r.said], [1, ["Another run is taking over the lock of 2026-10-13 Talk (Mac Studio); try again in a few seconds."]]);
    t.done();
  });
});

describe("what phase 0 settled about pushing to Final Cut", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const imported = (t, more = {}) => {
    const v0 = fcpxml({ video: join(t.episodes, FOLDER, "Talk.mov"), facts: { duration: 120, frameRate: "30000/1001", width: 1280, height: 720, hasAudio: true }, ranges: [{ start: 0, end: 10 }], src: relativeUrl("../Talk.mov") });
    const made = t.episode(FOLDER, more, { "Talk.mov": 5, "edit/main.v0.fcpxml": Buffer.byteLength(v0) });
    writeFileSync(join(made.path, "edit", "main.v0.fcpxml"), v0);
    return made;
  };
  const events = (t) => t.opened.map(([, file]) => tags(readFileSync(file, "utf8"), "event")[0].name);
  /** A library as Final Cut makes it when it opens a push, with its Settings.plist as `settings` says, read by a stand-in. */
  const library = (t, settings) => {
    mkdirSync(libraryFor(t.home, FOLDER), { recursive: true });
    t.deps.readPlist = (file) => (file === join(libraryFor(t.home, FOLDER), "Settings.plist") ? settings : null);
  };
  it("puts every push of an episode in one event, named for the episode folder (A4)", async () => {
    const t = setup();
    imported(t);
    await t.run("push", "talk");
    await t.run("push", "talk", "--no-hand-edits");
    assert.deepEqual(events(t), [FOLDER, FOLDER]);
    t.done();
  });
  it("takes a version above any this Mac has handed Final Cut: a record at v2 and a copy of v3 give v4 (A4c)", async () => {
    const t = setup();
    const pushes = [1, 2].map((v) => ({ v, at: "2026-10-13T10:00:00-05:00", on: "Mac Studio", file: `edit/main.v${v}.mac-studio.fcpxml`, project: `Talk main v${v} 000001` }));
    imported(t, { main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: pushes, base: null } });
    mkdirSync(join(t.home, "BRIMM Video Work", FOLDER, "pushed"), { recursive: true });
    writeFileSync(join(t.home, "BRIMM Video Work", FOLDER, "pushed", "main.v3.mac-studio.fcpxml"), "<fcpxml/>");
    const r = await t.run("push", "talk", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(t.opened.map(([, file]) => tags(readFileSync(file, "utf8"), "project")[0].name), ["Talk main v4 000001"]);
    t.done();
  });
  it("says nothing about backups at a push or an open of a library left on Final Cut's default, which is where its backups go (B4)", async () => {
    const t = setup();
    imported(t);
    t.deps.readPlist = () => null;
    const first = await t.run("push", "talk");
    library(t, { backupsEnabled: true });
    const pushed = await t.run("push", "talk", "--no-hand-edits");
    const opened = await t.run("open", "talk");
    for (const r of [first, pushed, opened]) assert.ok(!/backup/i.test(r.text), r.text);
    t.done();
  });
  it("says nothing of backups once the library names where they go, and nothing at an open before there is a library", async () => {
    const t = setup();
    imported(t);
    const before = await t.run("open", "talk");
    assert.ok(!before.text.includes("Backups"), before.text);
    library(t, { backupLocation: "Ym9va21hcms=", backupsEnabled: true });
    const pushed = await t.run("push", "talk");
    const opened = await t.run("open", "talk");
    assert.ok(!pushed.text.includes("Backups") && !opened.text.includes("Backups"), pushed.text + opened.text);
    t.done();
  });
});

describe("reading a library's Settings.plist", () => {
  it("lists its keys, bookmark data and all, which plutil cannot turn into JSON, and is null with no file", { skip: process.platform !== "darwin" ? "plutil is on a Mac only" : false }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-plist-"));
    const file = join(dir, "Settings.plist");
    writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>backupLocation</key><data>Ym9va21hcms=</data><key>backupsEnabled</key><true/><key>libraryID</key><string>X</string></dict></plist>
`);
    assert.deepEqual(readPlist(file), { backupLocation: true, backupsEnabled: true, libraryID: true });
    assert.equal(readPlist(join(dir, "none.plist")), null);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("an episode a newer brimm-video wrote, named by its short id alone (Part L's review)", () => {
  // A newer brimm-video may have written a session or a video not yet answered, whose folder's name is a client's: this one
  // cannot read its label, so it names the episode by its short id, and never by its folder.
  const JANE = "2026-10-20 Coaching call Jane Doe (Mac Studio)";
  const NEWER = "an episode a newer brimm-video wrote (000002)";
  /** An episode of today's, and one whose newest record a newer brimm-video wrote, in a folder named for a client. */
  const both = () => {
    const t = setup();
    t.episode("2026-10-14 Sales call (Mac Studio)");
    const { path } = t.episode(JANE);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: RECORD_VERSION + 1, id: "e-20261013-000002", rev: 2 }));
    return t;
  };
  it("is listed by episodes by its short id", async () => {
    const t = both();
    const r = await t.run("episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.startsWith(`Episodes, newest first:\n  An episode a newer brimm-video wrote (000002): Jason updates this Mac before it is changed here.\n  Talk (a placeholder name): an episode of 2:00, in 2026-10-14 Sales call (Mac Studio), id 000001\n`), r.text);
    assert.ok(!r.text.includes("Jane"), r.text);
    t.done();
  });
  it("is refused by open by its short id, found by its id or by words", async () => {
    const t = both();
    for (const said of ["000002", "coaching"]) {
      const r = await t.run("open", said);
      assert.deepEqual([r.code, r.said], [1, ["That is an episode a newer brimm-video wrote (000002). Jason has a newer brimm-video. Ask him to update this Mac."]], said);
    }
    t.done();
  });
  it("is named by its short id in the list of the episodes when none fits, and when more than one does", async () => {
    const t = both();
    const none = await t.run("open", "budget");
    assert.deepEqual([none.code, none.said], [1, [`No episode fits "budget". The episodes are: ${NEWER} and 2026-10-14 Sales call (Mac Studio).`]]);
    const two = await t.run("open", "call");
    assert.deepEqual([two.code, two.said], [1, [`More than one episode fits "call": ${NEWER} and 2026-10-14 Sales call (Mac Studio). Say which.`]]);
    t.done();
  });
});
