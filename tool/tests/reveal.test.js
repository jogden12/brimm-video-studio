// Copies named by id, and Finder reveals of copies, on an open-lock Mac (design 2026-10-26, section 1, "What brimm-video opens and
// shows"; R12). Every app that opens a file, and Finder for every folder it shows, keeps the path in a recent list or its
// preferences, which a sandboxed command can read, and an episode's folder is named from the dropped file, which for a session may
// name a client. So on an open-lock Mac `show` and `which` open copies from ~/BRIMM Video Work/shown/<id>/, and every Finder reveal
// shows a copy there, never a path in an episode's folder. A strict Mac does as it always did. Each test is a made-up Mac of its
// own (episodes.js), with stand-ins for every program; Finder and QuickTime Player are never opened.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { finishFinished } from "../finish.js";
import { SHOWN_MARKER, cantOpen, freeShownName, revealed, shownByIdFolder } from "../reveal.js";
import { readEpisode, shownName } from "../episode.js";
import { episodeWork, workFolder, writeSettings } from "../settings.js";
import { fileSafe } from "../names.js";
import { writeGuideNotes } from "../guide-note.js";
import { setup, episodeFor, episodeAs, FOLDER, ID } from "./episodes.js";
import { MINIMUM } from "./open-world.js";

/** Run a command of edit.js by its deps: { code, said }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
const AT = "2026-10-20T15:00:00-05:00";
const WAITING = { version: 3, kind: null, label: LABEL, answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null } };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: "2026-10-20T08:00:00-05:00", private: "no" };
const READ = (kind) => ({ kind, model: "m", at: "2026-10-20T08:05:00-05:00", on: "Mac Studio", account: "a", outcome: "read" });
const OFFERS = { spellings: [], answered: { reading: "2026-10-20T08:05:00-05:00", at: "2026-10-20T08:06:00-05:00", on: "Mac Studio", applied: [], left: [] } };
/** The files of the made-up episode with a transcript `show` can copy. */
const FILES = { "Pricing talk.mp4": "the raw video", "Pricing talk.transcript.txt": "THE VIDEO'S WORDS" };

/** This Mac's settings with `over` laid on them, as deps. */
const withSettings = (t, over, more = {}) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, ...over }, ...more });
/** This Mac's deps with the lock in effect open: its settings say open, and its Claude Code is named. */
const open = (t, over = {}, more = {}) => withSettings(t, { lock: "open", ...over }, { minimum: MINIMUM, ...more });
/** The Mac on the light import, with version 2 hand-offs, for `guide`; open or strict. */
const light = (t, lock, more = {}) => withSettings(t, { import: "light", drop: "Drop", handoffVersion: 2, ...(lock === "open" ? { lock: "open" } : {}) }, lock === "open" ? { minimum: MINIMUM, ...more } : more);
/** The folder of copies by id of the episode whose id is `id`. */
const byId = (t, id = ID) => join(workFolder(t.home), "shown", id);
/** What Finder was asked to show. */
const revealedIn = (t) => t.calls.filter((c) => c.cmd === "/usr/bin/open").map((c) => c.args);

/** A finished video handed off: its record, and its hand-off (version 2) in final/ (as edit-guide.test.js makes one). */
function handedOff(t, { id = "e-20261020-a1a1a1", name = "2026-10-20 Launch talk (Mac Studio)", text = "Launch talk" } = {}) {
  const handoff = `final/${text}.brimm-ops.json`;
  const found = episodeAs(t, { id, name, record: { kind: "finished", answer: ANSWERED, reading: READ("finished"), offers: OFFERS, name: { text, placeholder: false }, finished: { revision: 1, at: "2026-10-20T13:00:00-05:00", on: "Mac Studio", handoff, parts: {} }, imported: { on: "Mac Studio", at: "2026-10-20T12:30:00-05:00" } } });
  mkdirSync(join(found.folder, "final"), { recursive: true });
  writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id, kind: "finished", name: text }, main: { file: `${text}.mov` } }));
  return found;
}

describe("show and which, by id", () => {
  it("opens show's and which's copies from a folder named by the video's id on an open-lock Mac, and from the episode's own on a strict one", async () => {
    for (const lock of ["open", "strict"]) {
      const t = setup();
      episodeFor(t, { record: WAITING, files: FILES });
      const deps = lock === "open" ? open(t) : t.ctx.deps;
      const dir = lock === "open" ? byId(t) : join(episodeWork(t.home, FOLDER), "shown");
      const shown = await on(deps, "show", LABEL, "transcript");
      assert.equal(shown.code, 0, shown.said.join("\n"));
      const which = await on(deps, "which", LABEL);
      assert.equal(which.code, 0, which.said.join("\n"));
      assert.deepEqual(t.opened, [["TextEdit", join(dir, `${fileSafe(LABEL)} transcript.txt`)], ["QuickTime Player", join(dir, `${fileSafe(LABEL)}.mp4`)]], lock);
      assert.equal(readFileSync(join(dir, `${fileSafe(LABEL)} transcript.txt`), "utf8"), "THE VIDEO'S WORDS");
      assert.deepEqual(JSON.parse(readFileSync(join(dir, SHOWN_MARKER), "utf8")).files.sort(), [`${fileSafe(LABEL)} transcript.txt`, `${fileSafe(LABEL)}.mp4`]);
      // Nothing is copied into the other place.
      assert.equal(existsSync(lock === "open" ? join(episodeWork(t.home, FOLDER), "shown") : join(workFolder(t.home), "shown")), false, lock);
      t.done();
    }
  });

  it("refuses which for a gated video it cannot copy, opening nothing, and opens an answered ordinary one's original as before", async () => {
    // A video waiting for her answer that is not whole here, or whose clone cannot be made.
    for (const [what, more] of [["not whole here", { isWhole: () => false }], ["on another disk", { sameDisk: () => false }]]) {
      const t = setup();
      episodeFor(t, { record: WAITING, files: FILES });
      const r = await on(open(t, {}, more), "which", LABEL);
      assert.deepEqual([r.code, r.said, t.opened], [1, [cantOpen(LABEL)], []], what);
      assert.equal(cantOpen(LABEL), `${LABEL} can't be opened on this Mac without showing its file's name: ask Jason.`);
      t.done();
    }
    // An answered ordinary video: its own file, as always, and she is told its name shows.
    const t = setup();
    const found = episodeFor(t, { record: { version: 3, kind: "finished", label: LABEL, answer: ANSWERED, name: { text: "Pricing talk", placeholder: false } }, files: FILES });
    const r = await on(open(t, {}, { isWhole: () => false }), "which", "Pricing talk");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(t.opened, [["QuickTime Player", join(found.folder, "Pricing talk.mp4")]]);
    assert.match(r.said[0], /^Opened Pricing talk in QuickTime Player on this Mac\. Its copy could not be made/);
    t.done();
  });

  it("leaves the copies Finder showed when which opens the video on an open-lock Mac", async () => {
    const t = setup();
    const h = handedOff(t);
    assert.equal((await on(light(t, "open"), "guide", "Launch talk", "show")).code, 0);
    const copy = join(byId(t, h.record.id), "Launch talk.brimm-ops.json");
    writeFileSync(join(h.folder, "Talk.mp4"), "the video");
    const r = await on(light(t, "open"), "which", "Launch talk");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(existsSync(copy), true);
    t.done();
  });

  it("has behind clear the copies in both places", async () => {
    const t = setup();
    episodeFor(t, { record: WAITING, files: FILES });
    assert.equal((await on(open(t), "which", LABEL)).code, 0);
    assert.equal((await on(t.ctx.deps, "show", LABEL, "transcript")).code, 0);
    const old = join(episodeWork(t.home, FOLDER), "shown");
    assert.ok(existsSync(byId(t)) && existsSync(old));
    // Something brimm-video did not put there stays.
    mkdirSync(join(workFolder(t.home), "shown", "e-20261001-aaaaaa"), { recursive: true });
    writeFileSync(join(workFolder(t.home), "shown", "e-20261001-aaaaaa", "hers.txt"), "hers");
    const run = async () => ({ code: 0, stderr: "", stdout: "0\n" });
    await on({ ...t.ctx.deps, run }, "behind");
    assert.equal(existsSync(byId(t)), false);
    assert.equal(existsSync(old), false);
    assert.equal(readFileSync(join(workFolder(t.home), "shown", "e-20261001-aaaaaa", "hers.txt"), "utf8"), "hers");
    t.done();
  });
});

describe("Finder reveals, by id", () => {
  it("reveals a copy of the hand-off, named by its label, never a path in the episode's folder, for guide show, a session after all's withdrawal and finish", async () => {
    // guide "<video>" show, at the hand-off's step.
    {
      const t = setup();
      const h = handedOff(t);
      const r = await on(light(t, "open"), "guide", "Launch talk", "show");
      assert.deepEqual(r, { code: 0, said: ["Shown in Finder: the hand-off of Launch talk (a1a1a1)."] });
      const copy = join(byId(t, h.record.id), "Launch talk.brimm-ops.json");
      assert.deepEqual(revealedIn(t), [["-R", copy]]);
      assert.equal(readFileSync(copy, "utf8"), readFileSync(join(h.folder, "final", "Launch talk.brimm-ops.json"), "utf8"));
      assert.equal(statSync(copy).mode & 0o777, 0o444);
      t.done();
    }
    // A session after all: the empty session revision it is withdrawn by.
    {
      const t = setup();
      const H2 = JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID } });
      const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }, files: { "Pricing talk.mp4": "the raw video", "final/Pricing talk.brimm-ops.json": H2 } });
      const r = await on(open(t, { handoffVersion: 2 }), "kind", "Pricing talk", "session", "--private", "yes", "--again");
      assert.equal(r.code, 0, r.said.join("\n"));
      const record = readEpisode(found.folder).record;
      const copy = join(byId(t), `${fileSafe(shownName(record))}.brimm-ops.json`);
      assert.deepEqual(revealedIn(t), [["-R", copy]]);
      assert.equal(readFileSync(copy, "utf8"), readFileSync(join(found.folder, record.finished.handoff), "utf8"));
      for (const [, path] of revealedIn(t)) assert.ok(!path.startsWith(t.root), path);
      t.done();
    }
    // finish, of a finished video whose spellings are answered.
    {
      const t = setup();
      writeSettings(t.home, { handoffVersion: 2 });
      const captions = "1\n00:00:01,000 --> 00:00:04,000\n Welcome to the show.\n\n";
      const found = episodeAs(t, { id: ID, name: "2026-10-22 Talk (Mac Studio)", record: { kind: "finished", label: LABEL, answer: ANSWERED, files: { "Talk.srt": Buffer.byteLength(captions) } } });
      writeFileSync(join(found.folder, "Talk.srt"), captions);
      const ctx = { ...t.ctx, settings: { ...t.ctx.settings, handoffVersion: 2, lock: "open" }, deps: { ...t.ctx.deps, minimum: MINIMUM } };
      const done = await finishFinished(ctx, found);
      assert.equal(done.ok, true, JSON.stringify(done));
      const copy = join(byId(t), `${fileSafe(shownName(readEpisode(found.folder).record))}.brimm-ops.json`);
      assert.deepEqual(revealedIn(t), [["-R", copy]]);
      assert.equal(readFileSync(copy, "utf8"), readFileSync(join(found.folder, done.handoff), "utf8"));
      t.done();
    }
  });

  it("says no line that it was shown in Finder when the copy could not be made", async () => {
    const t = setup();
    const H2 = JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID } });
    episodeFor(t, { record: { version: 3, kind: "finished", answer: ANSWERED, label: LABEL, editing: null, finished: { revision: 1, at: AT, on: "Mac Studio", handoff: "final/Pricing talk.brimm-ops.json", parts: {} } }, files: { "Pricing talk.mp4": "the raw video", "final/Pricing talk.brimm-ops.json": H2 } });
    // Its folder by id is a link elsewhere: no copy is made there.
    mkdirSync(join(workFolder(t.home), "shown"), { recursive: true });
    mkdirSync(join(t.dir, "elsewhere"));
    symlinkSync(join(t.dir, "elsewhere"), byId(t));
    const r = await on(open(t, { handoffVersion: 2 }), "kind", "Pricing talk", "session", "--private", "yes", "--again");
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(revealedIn(t), []);
    assert.ok(!r.said.some((line) => /shown in Finder/i.test(line)), r.said.join("\n"));
    const label = r.said[0].slice(0, r.said[0].indexOf(":"));
    assert.ok(r.said.includes(cantOpen(label)), r.said.join("\n"));
    assert.ok(r.said.some((line) => line.startsWith(`The empty session revision of ${label} is written as revision 2.`)), r.said.join("\n"));
    assert.deepEqual(readdirSync(join(t.dir, "elsewhere")), []);
    t.done();
  });

  it("has Dropbox bring the video to post when it is not whole on an open-lock Mac, and shows nothing until it is", async () => {
    const t = setup();
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    writeFileSync(join(h.folder, "Talk.mp4"), "online-only");
    const r = await on(light(t, "open", { isWhole: (path) => !path.endsWith("Talk.mp4") }), "guide", "Launch talk", "show");
    assert.deepEqual([r.code, r.said, revealedIn(t)], [1, ["Dropbox is still bringing it over; say it again when it is done."], []]);
    assert.deepEqual(t.started.map(([, args]) => args.slice(-4)), [["bring", "--now", h.name, "Talk.mp4"]]);
    t.done();
  });

  it("reveals a copy of the video to post too", async () => {
    const t = setup();
    const h = handedOff(t);
    writeGuideNotes(t.home, { version: 1, handoffs: { [h.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    writeFileSync(join(h.folder, "Talk.mp4"), "the video she dropped");
    const r = await on(light(t, "open"), "guide", "Launch talk", "show");
    assert.deepEqual(r, { code: 0, said: ["Shown in Finder: the video of Launch talk (a1a1a1), to post."] });
    const copy = join(byId(t, h.record.id), "Launch talk.mp4");
    assert.deepEqual(revealedIn(t), [["-R", copy]]);
    assert.equal(readFileSync(copy, "utf8"), "the video she dropped");
    // A copy that cannot be made is not revealed, and she is told to ask Jason.
    const t2 = setup();
    const h2 = handedOff(t2);
    writeGuideNotes(t2.home, { version: 1, handoffs: { [h2.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
    writeFileSync(join(h2.folder, "Talk.mp4"), "the video she dropped");
    const refused = await on(light(t2, "open", { sameDisk: () => false }), "guide", "Launch talk", "show");
    assert.deepEqual([refused.code, refused.said, revealedIn(t2)], [1, [cantOpen("Launch talk")], []]);
    t.done();
    t2.done();
  });

  it("names a revealed copy safely whatever the label holds, and never over an earlier copy", async () => {
    const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-reveal-")));
    const home = join(dir, "home");
    const handoff = join(dir, "Coaching call Jane Doe.brimm-ops.json");
    writeFileSync(handoff, "{\"version\":2}");
    const calls = [];
    const run = async (cmd, args) => calls.push([cmd, ...args]);
    const settings = { lock: "open" };
    const record = { id: "e-20261018-0d0d0d" };
    for (const label of ["Video of 18 Oct, 09:30 (Mac Studio)", "Q&A / part 2"]) {
      for (const n of [1, 2]) {
        assert.equal(await revealed({ home, settings, minimum: MINIMUM, run, record, label, path: handoff }), true);
        const name = `${fileSafe(label)}${n > 1 ? " 2" : ""}.brimm-ops.json`;
        const copy = join(shownByIdFolder(home, record.id), name);
        assert.deepEqual(calls.at(-1), ["/usr/bin/open", "-R", copy]);
        assert.equal(readFileSync(copy, "utf8"), "{\"version\":2}");
      }
    }
    // Directly in shown/<id>/, each listed by the folder's marker; no folder of a label's slash.
    const folder = shownByIdFolder(home, record.id);
    assert.equal(folder, join(home, "BRIMM Video Work", "shown", "e-20261018-0d0d0d"));
    assert.deepEqual(readdirSync(folder).sort(), [SHOWN_MARKER, "Q&A - part 2 2.brimm-ops.json", "Q&A - part 2.brimm-ops.json", "Video of 18 Oct, 09-30 (Mac Studio) 2.brimm-ops.json", "Video of 18 Oct, 09-30 (Mac Studio).brimm-ops.json"]);
    assert.equal(JSON.parse(readFileSync(join(folder, SHOWN_MARKER), "utf8")).files.length, 4);
    // A video is copied by the clone it is given, and named by its own ending.
    const video = join(dir, "Coaching call Jane Doe.mov");
    writeFileSync(video, "a video");
    const clones = [];
    assert.equal(await revealed({ home, settings, minimum: MINIMUM, run, record, label: "Talk", path: video, clone: (from, to) => { clones.push([from, to]); writeFileSync(to, readFileSync(from)); } }), true);
    assert.deepEqual(clones, [[video, join(folder, "Talk.mov")]]);
    // A strict Mac reveals the file itself, as always, and copies nothing.
    const before = calls.length;
    for (const [s, minimum] of [[{}, MINIMUM], [{ lock: "open" }, null], [{ lock: "strict" }, MINIMUM]]) {
      assert.equal(await revealed({ home: join(dir, "strict"), settings: s, minimum, run, record, label: "Talk", path: handoff }), true);
      assert.deepEqual(calls.at(-1), ["/usr/bin/open", "-R", handoff]);
    }
    assert.equal(calls.length, before + 3);
    assert.equal(existsSync(join(dir, "strict")), false);
    // What cannot be copied is not revealed: a file not there, an id that is no plain name, a folder by id that is a link elsewhere.
    const elsewhere = join(dir, "elsewhere");
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, shownByIdFolder(home, "e-20261019-1b1b1b"));
    for (const [what, given] of [
      ["no file", { record, path: join(dir, "gone.brimm-ops.json") }],
      ["an id with a slash", { record: { id: "../../Episodes" }, path: handoff }],
      ["an id that is a dot", { record: { id: "." }, path: handoff }],
      ["no id", { record: {}, path: handoff }],
      ["a link", { record: { id: "e-20261019-1b1b1b" }, path: handoff }]]) {
      const at = calls.length;
      assert.equal(await revealed({ home, settings, minimum: MINIMUM, run, label: "Talk", ...given }), false, what);
      assert.equal(calls.length, at, what);
    }
    assert.deepEqual(readdirSync(elsewhere), []);
    assert.equal(existsSync(join(home, "BRIMM Video Work", "Episodes")), false);
    // A label that starts with a dot gives a copy Finder shows all the same.
    assert.equal(await revealed({ home, settings, minimum: MINIMUM, run, record, label: "..hidden", path: handoff }), true);
    assert.deepEqual(calls.at(-1), ["/usr/bin/open", "-R", join(folder, "hidden.brimm-ops.json")]);
    // No folder is made through a link at shown/ itself.
    const other = join(dir, "other home");
    const away = join(dir, "away");
    mkdirSync(join(other, "BRIMM Video Work"), { recursive: true });
    mkdirSync(away);
    symlinkSync(away, join(other, "BRIMM Video Work", "shown"));
    assert.equal(await revealed({ home: other, settings, minimum: MINIMUM, run, record, label: "Talk", path: handoff }), false);
    assert.deepEqual(readdirSync(away), []);
    // freeShownName is reveal.js's now, as show and which use it.
    assert.equal(freeShownName(folder, "Talk", ".mov"), "Talk 2.mov");
    rmSync(dir, { recursive: true, force: true });
  });

  it("reveals through reveal.js alone: no Finder reveal in edit.js or finish.js names a path itself", () => {
    for (const file of ["edit.js", "finish.js"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      assert.ok(!/["']-R["']/.test(source), `${file} runs open -R itself`);
      assert.ok(source.includes("revealed("), file);
    }
  });
});
