// edit.js, the command line for episodes, which a Claude Code session on the Mac runs: listing the episodes and what waits,
// opening one, showing its timeline in Final Cut, what is running, and importing a video again. Each test has a folder of its
// own that stands for BRIMM Video in Dropbox, and a home folder of its own; the clone, the clock, Final Cut and the starting
// of a detached run are stand-ins. Nothing here touches Dropbox, opens Final Cut or starts a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { editMain, findEpisode, contextFor, openApp } from "../edit.js";
import { NEWEST_VERSION, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { writeSettings } from "../settings.js";
import { writePending } from "../filing.js";
import { OWN_COMMIT, WITHOUT_COMMIT } from "./own-checkout.js";

const NOW = Date.parse("2026-10-14T12:00:00");
/** The edit.js of the checkout this code is in, worked out from this file's place: tool/tests/ is beside tool/edit.js. The settings
    of these tests name another checkout, "/checkout", which a detached run is never started from. */
const OWN_EDIT_JS = fileURLToPath(new URL("../edit.js", import.meta.url));
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
    agentRunning: () => false,
    // The chat's environment is never the runner's (often a Claude Code session's): not under Claude Code, so nothing is marked
    // and no words file is touched.
    env: {}
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
    t.episode("2026-10-14 Pricing talk (Mac Studio)", { name: { text: "Pricing with confidence", placeholder: false }, kind: "short video" }, { "Talk.mov": 5 });
    t.episode("2026-10-12 Old (Mac Studio)", { archived: { at: "2026-10-13T10:00:00-05:00" } }, { "Talk.mov": 5 });
    const r = await t.run("episodes");
    assert.equal(r.code, 0);
    assert.ok(r.text.startsWith([
      "Episodes, newest first:",
      "  Pricing with confidence: a short video of 2:00, in 2026-10-14 Pricing talk (Mac Studio), id 000002",
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
    assert.ok(r.text.includes("  Talk (a placeholder name): an episode of 2:00, in 2026-10-13 Talk (Mac Studio), id 000001\n    A file of this video is missing: Talk.cut-plan.txt. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason."), r.text);
    assert.ok(r.text.includes("  2026-10-14 Pricing talk (Mac Studio)\n    Dropbox has kept a conflicted copy in this episode: Talk (Jason Ogden's conflicted copy 2026-10-14).mov."), r.text);
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
      "  A video of 5 bytes, in the Mac Studio's drop folder, for 2 hours: already imported as 2026-10-13 the video (Mac Studio). It stays in the drop folder until Dropbox's check of its copies passes, or for a person to delete.",
      "  A video of 6 bytes, in Sallie's laptop's drop folder, for 2 hours"
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
      "  A video of 5 bytes: being imported on Mac Studio, at Making the rough cut",
      "  A video of 5 bytes: stopped on Sallie's laptop at Making the rough cut, 30 minutes ago",
      "  A video of 5 bytes: its import failed on Mac Studio: the transcriber stopped",
      "  A video of 5 bytes: copied in on Mac Studio. Dropbox found a problem with a copy of it: Talk.rough-cut.mp4 is short"
    ].join("\n")), r.text);
    t.done();
  });
  it("shows the free space on the disk, and lists no library", async () => {
    const t = setup();
    const r = await t.run("episodes");
    assert.ok(r.text.endsWith(["On this Mac:", "  Free on the disk: 300 GB"].join("\n")), r.text);
    assert.doesNotMatch(r.text, /fcpbundle|library/i);
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
  it("shows the name, the placeholder line, the title, the notes and the Reel candidates, and says nothing of Final Cut", async () => {
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
      '  1. "Price like you mean it", 0:42. It stands alone.'
    ]);
    // The one line about keeping the episode on this Mac is Finder's, and is the last it says.
    assert.match(r.said[r.said.length - 1], /^So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: /);
    assert.ok(!/Final Cut/.test(r.text), r.text);
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
    assert.deepEqual(t.started, [[process.execPath, OWN_EDIT_JS, "bring", "--now", "2026-10-13 Talk (Mac Studio)"]]);
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
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: "e-20261013-000001", rev: 2 }));
    const r = await t.run("open", "talk");
    assert.equal(r.code, 1);
    assert.deepEqual(r.said, ["That is an episode a newer BRIMM Video Studio wrote (000001). Jason has a newer BRIMM Video Studio. Ask him to update this Mac."]);
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
      "  A video of 5 bytes: being imported on Mac Studio, at Making the rough cut",
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
    assert.deepEqual([r.code, r.said], [0, ["A video of 5 bytes in this Mac's drop folder is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."]]);
    assert.deepEqual([readdirSync(join(t.episodes, ".importing")), kicked, t.started], [[], 1, []]);
    t.done();
  });
  it("retry refuses while the import is running", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    status(t, "Talk.mov");
    const r = await t.run("retry", "Talk.mov");
    assert.deepEqual([r.code, r.said, t.started], [1, ["A video of 5 bytes in this Mac's drop folder is being imported now, at Making the rough cut. The panel shows how far it is."], []]);
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
    assert.ok(r.text.includes(`Waiting in the drop folders:\n  A Zoom download of 5 bytes, in the Mac Studio's drop folder, for 2 hours: ${HELD}`), r.text);
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
    assert.deepEqual([r.code, r.said, kicked, t.started], [1, [`A Zoom download of 5 bytes in this Mac's drop folder is held: ${HELD}`], 0, []]);
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
    assert.deepEqual([r.code, r.said], [1, [`No video in this Mac's drop folder fits "pricing". It holds: a video of 5 bytes and a video of 5 bytes.`]]);
    t.done();
  });
});

describe("what the final review found in edit.js", () => {
  const imported = (t) => t.episode("2026-10-13 Talk (Mac Studio)");
  it("says an app could not be opened when open fails", () => {
    assert.throws(() => openApp("QuickTime Player", "/x.mp4", () => ({ status: 1, stderr: "Unable to find application named 'QuickTime Player'\n" })), { message: "QuickTime Player could not be opened (Unable to find application named 'QuickTime Player')" });
    assert.doesNotThrow(() => openApp("QuickTime Player", "/x.mp4", () => ({ status: 0, stderr: "" })));
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
    assert.deepEqual([r.code, r.said], [0, [`A video of 5 bytes in this Mac's drop folder is imported, as ${folder}. Dropbox's check of its copies is still to be made on this Mac: the Mac's import of its drop folder is asked to make it now. The panel shows how far it is.`]]);
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
    assert.deepEqual([r.code, r.said, t.kicked], [1, ['A video of 5 bytes in this Mac\'s drop folder is imported, as 2026-10-13 Talk (Mac Studio). Dropbox found a problem with a copy of it: reel-2.mp4 could not be put into the episode. The import at work now does not check it again: once the problem is put right and the panel shows that import has ended, say "try it again" again.'], 0]);
    t.done();
  });
  it("retry has a late check that found a problem made again when no import is at work", async () => {
    const t = owing({ problem: "reel-2.mp4 could not be put into the episode." });
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, ["A video of 5 bytes in this Mac's drop folder is imported, as 2026-10-13 Talk (Mac Studio). Dropbox found a problem with a copy of it before (reel-2.mp4 could not be put into the episode): the Mac's import of its drop folder is asked to make it again now. The panel shows how far it is."], 1]);
    t.done();
  });
  it("retry says the import at work makes a due late check once it has finished any video it is importing (PR 19's check of 2d4c8af, F7)", async () => {
    const t = owing();
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, ["A video of 5 bytes in this Mac's drop folder is imported, as 2026-10-13 Talk (Mac Studio). Dropbox's check of its copies is still to be made on this Mac: the import at work now makes it once it has finished any video it is importing. The panel shows how far it is."], 0]);
    t.done();
  });
  it("retry says when the import at work makes a late check that is not due yet (D8, D12)", async () => {
    const t = owing({ lastCopy: NOW - 5 * 60000 });
    t.deps.agentRunning = () => true;
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, [`A video of 5 bytes in this Mac's drop folder is imported, as 2026-10-13 Talk (Mac Studio). Dropbox's check of its copies is still to be made on this Mac: the import at work now makes it when it is due, at ${clock(NOW + 10 * 60000)}, once it has finished any video it is importing. The panel shows how far it is.`], 0]);
    t.done();
  });
  it("retry says the import it starts makes a late check that is not due yet when it is due (E15)", async () => {
    const t = owing({ lastCopy: NOW - 5 * 60000 });
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, t.kicked], [0, [`A video of 5 bytes in this Mac's drop folder is imported, as 2026-10-13 Talk (Mac Studio). Dropbox's check of its copies is still to be made on this Mac: the Mac's import of its drop folder is asked to make it when it is due, at ${clock(NOW + 10 * 60000)}. The panel shows how far it is.`], 1]);
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
    assert.deepEqual([r.code, r.said], [0, ["A video of 5 bytes in this Mac's drop folder is imported, as 2026-10-13 Talk (Mac Studio). Its import stopped on this Mac, and has no check of its copies left to make here, so the status that held the episode is taken away."]]);
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
    assert.match(r.text, /^A video of 5 bytes in this Mac's drop folder is already imported as /);
    assert.equal(kicked, 0);
    t.done();
  });
  it("retry asks the launch agent to look again, and starts no run of its own", async () => {
    const t = setup();
    writeFileSync(join(t.root, "Unedited Video", "Mac Studio", "Talk.mov"), "video");
    const kicked = [];
    t.deps.kickstart = () => kicked.push("com.thebrimm.unedited");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, kicked, t.started], [0, ["A video of 5 bytes in this Mac's drop folder is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."], ["com.thebrimm.unedited"], []]);
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
    assert.deepEqual([r.code, r.said], [1, ["A video of 5 bytes in this Mac's drop folder is already imported as 2026-10-13 the video (Mac Studio). It stays in the drop folder until Dropbox's check of its copies passes, or for a person to delete."]]);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in edit.js", () => {
  const FOLDER = "2026-10-13 Talk (Mac Studio)";
  const imported = (t) => t.episode(FOLDER);
  const OFFLINE = (t, path) => `So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${path}`;
  it("5. lists an episode written by a newer BRIMM Video Studio by its short id alone, without reading its fields", async () => {
    const t = setup();
    const { path } = imported(t);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: "e-20261013-000001", rev: 2 }));
    const r = await t.run("episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.includes("Episodes, newest first:\n  An episode a newer BRIMM Video Studio wrote (000001): Jason updates this Mac before it is changed here.\n"), r.text);
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
    assert.deepEqual([r.code, r.said, kicked.length], [0, ["A video of 5 bytes in this Mac's drop folder is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."], 1]);
    t.done();
  });
  it("says truthfully when the launch agent's run is at work: that run takes it when it next looks", async () => {
    const t = setup();
    writeFileSync(join(drop(t), "Talk.mov"), "video");
    failedStatus(t);
    t.deps.agentRunning = () => true;
    t.deps.kickstart = () => assert.fail("a run is at work, and none is started");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said], [0, ["A video of 5 bytes in this Mac's drop folder is imported again by the import at work now, when it next looks in the drop folder: within a minute while it waits to check the copies, or once it has finished the video it is on. The panel shows how far it is."]]);
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
    assert.match(r.said[0], /^A video of 5 bytes in this Mac's drop folder is imported again \(its imports aaa, which failed: ffmpeg stopped, and bbb, which failed: the transcriber stopped\)/);
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
    assert.ok(r.text.includes("  A video of 5 bytes, in the Mac Studio's drop folder, for 20 minutes"), r.text);
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
    assert.ok(r.text.includes("  A video of 5 bytes, in the Mac Studio's drop folder, for 5 minutes"), r.text);
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

describe("an episode a newer BRIMM Video Studio wrote, named by its short id alone (Part L's review)", () => {
  // A newer brimm-video may have written a session or a video not yet answered, whose folder's name is a client's: this one
  // cannot read its label, so it names the episode by its short id, and never by its folder.
  const JANE = "2026-10-20 Coaching call Jane Doe (Mac Studio)";
  const NEWER = "an episode a newer BRIMM Video Studio wrote (000002)";
  /** An episode of today's, and one whose newest record a newer brimm-video wrote, in a folder named for a client. */
  const both = () => {
    const t = setup();
    t.episode("2026-10-14 Sales call (Mac Studio)");
    const { path } = t.episode(JANE);
    writeFileSync(recordFile(path, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: "e-20261013-000002", rev: 2 }));
    return t;
  };
  it("is listed by episodes by its short id", async () => {
    const t = both();
    const r = await t.run("episodes");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.startsWith(`Episodes, newest first:\n  An episode a newer BRIMM Video Studio wrote (000002): Jason updates this Mac before it is changed here.\n  Talk (a placeholder name): an episode of 2:00, in 2026-10-14 Sales call (Mac Studio), id 000001\n`), r.text);
    assert.ok(!r.text.includes("Jane"), r.text);
    t.done();
  });
  it("is refused by open by its short id, found by its id or by words", async () => {
    const t = both();
    for (const said of ["000002", "coaching"]) {
      const r = await t.run("open", said);
      assert.deepEqual([r.code, r.said], [1, ["That is an episode a newer BRIMM Video Studio wrote (000002). Jason has a newer BRIMM Video Studio. Ask him to update this Mac."]], said);
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

describe("the drop folders the settings name (the switch to Drop)", () => {
  /** A Mac whose settings name `drop` for its drop folder, with its own folder made there. Another Mac's folders are made by
      `other(parent, mac, marked)`: in BRIMM Video/<parent>/<mac>, with a marker naming the Mac when `marked`, as the installer
      writes it. Videos are put into a folder by `put(folder, name)`. */
  function dropping(drop) {
    const t = setup();
    if (drop) writeSettings(t.home, { drop });
    const place = (parent, mac) => join(t.root, parent, mac);
    const own = place(drop || "Unedited Video", "Mac Studio");
    mkdirSync(own, { recursive: true });
    const other = (parent, mac, marked) => {
      mkdirSync(place(parent, mac), { recursive: true });
      if (marked) writeFileSync(join(place(parent, mac), ".brimm-watched-by"), `${mac}\n`);
      return place(parent, mac);
    };
    const put = (folder, name) => writeFileSync(join(folder, name), "x".repeat(5));
    return { ...t, own, other, put, place };
  }
  const WAITING = (r) => r.said.slice(r.said.indexOf("Waiting in the drop folders:") + 1).filter((line) => /^ {2}\S.*, in .*'s drop folder, for /.test(line)).map((line) => line.replace(/, for .*$/, ""));
  it("episodes lists this Mac's videos in Drop/<this Mac> and the other Mac's in Drop/<other Mac>, this Mac's first, with no marker read", async () => {
    const t = dropping("Drop");
    t.put(t.own, "Talk.mov");
    // The other Mac's folder is listed, marked or not: another Mac's settings are on that Mac, and no marker is looked for.
    t.put(t.other("Drop", "Sallie's laptop", false), "Budget.mov");
    const r = await t.run("episodes");
    assert.ok(r.said.includes("Waiting in the drop folders:"), r.text);
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in the Mac Studio's drop folder", "  A video of 5 bytes, in Sallie's laptop's drop folder"]);
    t.done();
  });
  it("episodes lists a video in either of the other Mac's folders, Drop/<other Mac> and Unedited Video/<other Mac>: none is ever hidden", async () => {
    const t = dropping("Drop");
    t.put(t.other("Drop", "Sallie's laptop", true), "Budget.mov");
    t.put(t.other("Unedited Video", "Sallie's laptop", true), "Stray.mov");
    const r = await t.run("episodes");
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in Sallie's laptop's drop folder", "  A video of 5 bytes, in Sallie's laptop's drop folder"]);
    t.done();
  });
  it("episodes lists the other Mac's videos in its old folder after it was switched back, though its marker is still in Drop/<other Mac>", async () => {
    // A marker outlives a switch back (--drop "Unedited Video"), and a run refused after it made the marker leaves one too.
    const t = dropping("Drop");
    t.other("Drop", "Sallie's laptop", true);
    t.put(t.other("Unedited Video", "Sallie's laptop", true), "Budget.mov");
    const r = await t.run("episodes");
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in Sallie's laptop's drop folder"]);
    t.done();
  });
  it("episodes lists a video in the other Mac's Drop folder whatever marker it holds, even another Mac's", async () => {
    const t = dropping("Drop");
    t.put(t.other("Drop", "Third Mac", false), "Third.mov");
    writeFileSync(join(t.place("Drop", "Third Mac"), ".brimm-watched-by"), "Sallie's laptop\n");
    const r = await t.run("episodes");
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in the Third Mac's drop folder"]);
    t.done();
  });
  it("episodes does not list this Mac's old Unedited Video folder, which is no longer watched, once its settings say Drop", async () => {
    const t = dropping("Drop");
    t.put(t.own, "Talk.mov");
    t.put(t.place("Unedited Video", "Mac Studio"), "Old.mov");
    const r = await t.run("episodes");
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in the Mac Studio's drop folder"]);
    t.done();
  });
  it("episodes lists as it did when the settings name no drop folder: this Mac's Unedited Video folder first and the other Mac's after it", async () => {
    const t = dropping(undefined);
    t.put(t.own, "Talk.mov");
    t.put(t.other("Unedited Video", "Sallie's laptop", true), "Budget.mov");
    const r = await t.run("episodes");
    assert.deepEqual(WAITING(r), ["  A video of 5 bytes, in the Mac Studio's drop folder", "  A video of 5 bytes, in Sallie's laptop's drop folder"]);
    // This Mac's own Drop folder, which its settings do not name, is not watched by it, and its videos are not listed as waiting.
    t.put(t.other("Drop", "Mac Studio", false), "Stray.mov");
    assert.deepEqual(WAITING(await t.run("episodes")), ["  A video of 5 bytes, in the Mac Studio's drop folder", "  A video of 5 bytes, in Sallie's laptop's drop folder"]);
    t.done();
  });
  it("retry finds a video in Drop/<this Mac> when the settings say Drop, and not one left in the old folder", async () => {
    const t = dropping("Drop");
    t.put(t.own, "Talk.mov");
    t.put(t.place("Unedited Video", "Mac Studio"), "Old.mov");
    const kicked = [];
    t.deps.kickstart = () => kicked.push("com.thebrimm.unedited");
    const r = await t.run("retry", "talk");
    assert.deepEqual([r.code, r.said, kicked], [0, ["A video of 5 bytes in this Mac's drop folder is imported again: the Mac's import of its drop folder is asked to look. The panel shows how far it is."], ["com.thebrimm.unedited"]]);
    const old = await t.run("retry", "old");
    assert.deepEqual([old.code, old.said], [1, ['No video in this Mac\'s drop folder fits "old". It holds: a video of 5 bytes.']]);
    t.done();
  });
});
