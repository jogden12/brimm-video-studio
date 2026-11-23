// A Reel Kit project in an episode (reel-kit-project.js; spec 2026-11-23 Reel Kit in Studio; plan Task 9, Decisions 2, 3, 8, 9, 11).
// Every test builds a temp home with the made-up episode of phase4.js (tests/episodes.js setup): no test touches the real Dropbox, BRIMM
// Video Work or ~/reel-kit. ffprobe and ffmpeg are stand-ins (the copy of 4K is made by workcopy.js makeWorkCopy, as it is for a Mac), and
// Reel Kit's Python is the stand-in tests/stand-ins/reel-kit.mjs, run as PY is, from the Python the test puts where Reel Kit's would be.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEPT } from "../app.js";
import { HELD, NOT_FOR_SESSION } from "../gate.js";
import { kitDir, reelKitHome, venvPython } from "../reel-kit.js";
import { enqueue } from "../reel-kit-worker.js";
import {
  MODES, entryOf, linkProject, modeLeans, modeOf, projectFolderOf, readState, scaffold, slugOf, startWhy, stateFile, titleWhy, versionFor, writeState
} from "../reel-kit-project.js";
import { ensureHerPack, herPack } from "../reel-kit-style.js";
import { dropFolderOf, episodeWork, workFolder } from "../settings.js";
import { freeEpisode } from "../free.js";
import { makeWorkCopy, workCopyDir } from "../workcopy.js";
import { FOLDER, ID, listAll } from "./episodes.js";
import { probed } from "./fixtures.js";
import { EPISODE, episode } from "./phase4.js";
import { ANSWERED, CLEARED, LEFT, RAW, SESSION, UNANSWERED } from "./workcopy-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/reel-kit.mjs", import.meta.url));
const ASK = "Hi-fi, lo-fi or showcase?";
const WIDE = "Reel Kit makes upright videos only: choose a Reel of it.";
/** The rate of the made-up recording and of what is made of it: 30 pictures a second. */
const RATE = { r_frame_rate: "30/1", avg_frame_rate: "30/1" };
/** startWhy as her chat asks it: not held as a session, and the main video titled, unless a test says otherwise. */
const ask = (asked) => startWhy({ held: false, title: "Pricing", home: "/nowhere", folder: FOLDER, ...asked });
const quote = (text) => `'${String(text).replace(/'/g, "'\\''")}'`;

/** Reel 2 of the made-up episode, as its record lists it: its own times in seconds of the recording. */
const REELS = EPISODE.record.reels;
const REEL2 = REELS.find((r) => r.n === 2);

const done = [];
after(() => {
  for (const t of done) t.done();
});

/** The made-up episode, answered as `record` says, and a Mac with Reel Kit's kit and its Python in place: the Python is a small script
    that runs the stand-in with the log's path baked in. ffprobe answers for the recording (4K, wide, or what `raw` says) and for what is
    made of it; ffmpeg, under the watchdog, writes a few words into the file it is asked for. Gives what the scaffold needs and what a
    test reads back. */
function world({ record = {}, raw = { width: 3840, height: 2160 } } = {}) {
  const { t, found } = episode({ ...RAW, answer: { ...ANSWERED, seen: "wide, 0:23, no retakes" }, ...record });
  done.push(t);
  const log = join(t.dir, "reel-kit.log");
  mkdirSync(join(kitDir(t.home), "pipeline"), { recursive: true });
  writeFileSync(join(kitDir(t.home), "pipeline", "new.py"), "# the stand-in reads only this file's name\n");
  mkdirSync(join(venvPython(t.home), ".."), { recursive: true });
  writeFileSync(venvPython(t.home), `#!/bin/sh\nREEL_KIT_STANDIN_LOG=${quote(log)} exec ${quote(process.execPath)} ${quote(STAND_IN)} "$@"\n`);
  chmodSync(venvPython(t.home), 0o755);
  const video = join(found.folder, "Pricing talk.mp4");
  const guarded = [];
  const after = (args, flag) => args[args.indexOf(flag) + 1];
  const copy = {
    tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE" },
    freeBytes: () => 500e9,
    probe: async (file) => {
      if (file === video) return probed({ picture: { ...raw, ...RATE }, sound: { sample_rate: "48000", channels: 2 } });
      const last = guarded.at(-1)?.args ?? [];
      const seconds = last.includes("-t") ? after(last, "-t") : "23.423";
      const scale = /scale=(\d+):(\d+)/.exec(after(last, "-vf") ?? "") ?? [null, raw.width, raw.height];
      return probed({ picture: { width: Number(scale[1]), height: Number(scale[2]), ...RATE }, sound: { sample_rate: "48000", channels: 2 }, duration: seconds });
    },
    runGuarded: async (cmd, args, limits) => {
      guarded.push({ cmd, args, limits });
      writeFileSync(args.at(-1), "THE 4K COPY");
      return { code: 0, signal: null, stderr: "", overMemory: false, outOfTime: false, peak: 0, stopped: "" };
    }
  };
  const runs = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
  const make = (asked, more = {}) => scaffold(t.ctx, { found, record: found.record, ...asked }, { copy, ...more });
  return { t, found, video, guarded, runs, make, after, copy };
}

/** A part of a planned video (footage.js): no kind, the answer "part", and what it is footage for. */
const partOf = (client, consent = []) => ({
  record: {
    version: 5, kind: null, label: "Video of 4 Nov, 10:00 (Mac Studio)",
    answer: { state: "part", guess: null, seen: "upright, 0:20", came: "phone", by: "Mac Studio", on: "Mac Studio", at: "2026-11-04T10:00:00-06:00", private: "no" },
    partOf: { id: "e-20261104-ccccc1", as: "b-roll", shot: 2, client }
  },
  planned: { consent }
});

describe("the mode of a Reel Kit edit", () => {
  it("asks Hi-fi, lo-fi or showcase? when no mode is given, and never guesses", async () => {
    assert.deepEqual(MODES, ["hifi", "lofi", "showcase"]);
    const words = { hifi: ["hifi", "Hi-Fi", " high ", "PRODUCED"], lofi: ["lofi", "lo-fi", "Low", "selfie"], showcase: ["showcase", "Show-off", "show off", "show  off", "FLEX"] };
    for (const [mode, said] of Object.entries(words)) for (const word of said) assert.equal(modeOf(word), mode, word);
    for (const word of ["", "  ", "medium", "hi fi", "showcases", null, undefined, 3]) assert.equal(modeOf(word), null, String(word));

    // An iPhone clip leans lo-fi and a sit-down take hi-fi: said, never chosen. The question is asked all the same.
    const clip = { ...RAW, kind: "short video", answer: { ...ANSWERED, seen: "upright, 0:40", came: "phone" } };
    assert.equal(modeLeans(clip), "lofi");
    assert.equal(modeLeans({ ...RAW, answer: { ...ANSWERED, seen: "wide, 12:00" } }), "hifi");
    assert.equal(modeLeans({ ...RAW, kind: "finished" }), "");
    for (const mode of [undefined, null, "", "medium", "Hi-fi"]) {
      assert.equal(ask({ record: clip, key: "main", mode, home: "/nowhere", folder: FOLDER }), ASK, String(mode));
      assert.equal(ask({ record: { ...RAW, reels: REELS }, key: "reel 2", mode, home: "/nowhere", folder: FOLDER }), ASK, String(mode));
    }
    assert.equal(ask({ record: clip, key: "main", mode: "lofi", home: "/nowhere", folder: FOLDER }), "");

    // The scaffold asks too: nothing is copied and Reel Kit is not run.
    const w = world();
    assert.deepEqual(await w.make({ key: "reel 2", title: "Know your costs" }), { why: ASK });
    assert.deepEqual([w.guarded, w.runs()], [[], []]);
  });
});

describe("what Reel Kit refuses", () => {
  it("refuses a session, an unanswered video and a client's part without agreement", () => {
    const why = (record, more = {}) => ask({ record, key: "main", mode: "lofi", home: "/nowhere", folder: FOLDER, ...more });
    assert.equal(why(UNANSWERED), "This video is waiting for its answer: say what it is first.");
    assert.equal(why(LEFT), "You said to leave this video: it is not for BRIMM Video Studio. To have it read, say what it is.");
    assert.equal(why(SESSION), NOT_FOR_SESSION);
    // Any session, whether its mark is cleared or not (Decision 9): session clips are not built yet.
    assert.equal(why({ ...SESSION, session: { ...SESSION.session, cleared: CLEARED } }), NOT_FOR_SESSION);
    // Whether it is held as a session must be said: left out, it can't let one through.
    for (const held of [undefined, null, "no", 0]) assert.throws(() => startWhy({ record: RAW, key: "main", mode: "lofi", title: "Pricing", home: "/nowhere", folder: FOLDER, held }), /held/, String(held));
    // A video held as a session: one of its other versions is a session not cleared.
    assert.equal(why({ ...RAW, answer: { ...ANSWERED, seen: "upright, 0:40" } }, { held: true }), HELD);
    // A part that shows a client goes into no edit until her plan holds their agreement; a part is never edited on its own either.
    const waiting = partOf(true);
    assert.equal(why(waiting.record, { planned: waiting.planned }), "This footage shows a client, and waits for their agreement: it goes into no edit until then.");
    for (const part of [partOf(true, [{ id: "e-20261104-aaaaa1", at: "2026-11-04" }]), partOf(false)]) {
      const line = why({ ...part.record, id: "e-20261104-aaaaa1" }, { planned: part.planned });
      assert.equal(line, "This is footage for a planned video: Reel Kit edits the video it goes into, not its footage.");
    }
    // A Reel the record does not list.
    assert.equal(ask({ record: { ...RAW, reels: REELS }, key: "reel 9", mode: "lofi", home: "/nowhere", folder: FOLDER }), `There is no Reel 9. The Reels are ${REELS.map((r) => r.n).join(", ")}.`);
  });

  it("refuses the main video of a wide recording", () => {
    const wide = { ...RAW, reels: REELS, answer: { ...ANSWERED, seen: "wide, 0:23, no retakes" } };
    assert.equal(ask({ record: wide, key: "main", mode: "hifi", home: "/nowhere", folder: FOLDER }), WIDE);
    // A Reel of it is cropped upright by Reel Kit.
    assert.equal(ask({ record: wide, key: "reel 2", mode: "hifi", home: "/nowhere", folder: FOLDER }), "");
    // An upright recording's main video is made; one whose shape the record does not say is refused, as a gate errs.
    assert.equal(ask({ record: { ...RAW, answer: { ...ANSWERED, seen: "upright, 0:40" } }, key: "main", mode: "hifi", home: "/nowhere", folder: FOLDER }), "");
    assert.equal(ask({ record: RAW, key: "main", mode: "hifi", home: "/nowhere", folder: FOLDER }), WIDE);
  });

  it("refuses a part that has a HyperFrames project", () => {
    const w = world();
    const project = { key: "reel 2", name: "Pricing- what to charge- reel 2 3fa9c1", madeAt: "2026-10-20T15:00:00-05:00", on: "Mac Studio", opened: [], handover: false, fromSuggestion: 2, state: "made" };
    const base = { ...w.found.record, app: { toolchain: "0.8.208", projects: [project] } };
    const why = (record, more = {}) => ask({ record, key: "reel 2", mode: "showcase", home: w.t.home, folder: FOLDER, ...more });
    assert.equal(why(base), "Reel 2 has a HyperFrames project already, so it is edited there.");
    // One kept for an earlier kind is not in use.
    assert.equal(why({ ...base, app: { ...base.app, projects: [{ ...project, state: KEPT }] } }), "");

    // An earlier Reel Kit edit: a new version is made while it waits for her or is done, never while it is queued or at work.
    const name = "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v1";
    const rk = entryOf({ key: "reel 2", name, mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 2 });
    const record = { ...base, app: { ...base.app, projects: [rk] } };
    const dir = projectFolderOf(w.t.home, FOLDER, name);
    mkdirSync(dir, { recursive: true });
    for (const [state, more, line] of [
      ["storyboard", {}, ""],
      ["queued", { pid: 4242 }, "Reel 2 has a Reel Kit edit waiting or being made already."],
      ["working", { pid: 4242 }, "Reel 2 has a Reel Kit edit waiting or being made already."]
    ]) {
      writeState(dir, { slug: slugOf(record, "reel 2", 1), state, ...more });
      assert.equal(why(record, { alive: () => true }), line, state);
    }
    // A worker that died is not at work, nor is a queued job whose run died (the worker's statusOf: it reads stopped), with a pid or
    // none. An edit whose folder can't be named counts as at work, as a gate errs.
    assert.equal(why(record, { alive: () => false }), "");
    for (const pid of [4242, undefined]) {
      writeState(dir, { slug: slugOf(record, "reel 2", 1), state: "queued", pid });
      assert.equal(why(record, { alive: () => false }), "", String(pid));
    }
    // A job in the queue record whose project is not made yet, by the record's id and the part, while its run is alive.
    enqueue(w.t.home, { id: "q1", episode: record.id, key: "reel 2", version: null, mode: "lofi", job: "edit", at: "now", pid: 4242 }, () => true);
    assert.equal(why(record, { alive: (pid) => pid === 4242 }), "Reel 2 has a Reel Kit edit waiting or being made already.");
    assert.equal(why(record, { alive: () => false }), "", "its run died");
    assert.equal(ask({ record, key: "main", mode: "showcase", home: w.t.home, folder: FOLDER, alive: (pid) => pid === 4242, title: "Pricing" }) === "Reel 2 has a Reel Kit edit waiting or being made already.", false, "another part's queue entry is no refusal");
    assert.equal(why(record, { alive: () => false, folder: undefined }), "Reel 2 has a Reel Kit edit waiting or being made already.");
    assert.equal(versionFor(record, "reel 2"), 2);
    assert.equal(versionFor(record, "main"), 1);
    assert.equal(versionFor(record, "reel 2", [4]), 5);
  });
});

describe("the Reel Kit project", () => {
  it("puts the project in the episode's work folder and links it into REEL_KIT_HOME/projects", async () => {
    const w = world();
    const made = await w.make({ key: "reel 2", mode: "lofi", title: "Know your costs" });
    assert.equal(made.why, undefined, made.why);
    const name = "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v1";
    assert.deepEqual([made.dir, made.slug, made.name, made.version], [join(episodeWork(w.t.home, FOLDER), name), "3fa9c1-reel-2-v1", name, 1]);
    assert.equal(made.dir, projectFolderOf(w.t.home, FOLDER, name));
    // Reel Kit's own place for it is a link to the folder, which new.py made its folders through.
    const link = join(reelKitHome(w.t.home), "projects", made.slug);
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.equal(readlinkSync(link), made.dir);
    assert.ok(lstatSync(made.dir).isDirectory() && !lstatSync(made.dir).isSymbolicLink());
    for (const d of ["assets", "audio", "cards", "fx", "public/cards", "public/media", "renders", "storyboard", "work", "style"]) assert.ok(existsSync(join(made.dir, d)), d);
    assert.match(readFileSync(join(made.dir, "edit.py"), "utf8"), /^STYLE = "lofi"$/m);
    // Its source is the copy of 4K itself, moved in from the working copies with its facts: none of it is left there.
    const clip = join(made.dir, "source", "clip.mp4");
    assert.ok(lstatSync(clip).isFile());
    assert.equal(JSON.parse(readFileSync(join(made.dir, "source", "clip.json"), "utf8")).width, 3840);
    assert.deepEqual(readdirSync(workCopyDir(w.t.home, FOLDER)).filter((f) => f.startsWith("reel-2-")), []);
    assert.equal(readFileSync(clip, "utf8"), "THE 4K COPY");
    assert.match(readFileSync(join(made.dir, "edit.py"), "utf8"), new RegExp(`^SRC = "${clip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"$`, "m"));
    // studio.json is Studio's, written whole, and says which edit it is.
    assert.deepEqual(readState(made.dir), { slug: made.slug, key: "reel 2", mode: "lofi", version: 1, title: "Know your costs", name, madeAt: readState(made.dir).madeAt });
    // What the record keeps of it, in the shape of a HyperFrames project's entry, with its working copy and what it was made from.
    assert.deepEqual(Object.keys(entryOf({ key: "reel 2", name, mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 2 })), ["key", "name", "maker", "mode", "version", "madeAt", "on", "opened", "handover", "state", "fromSuggestion"]);
    assert.deepEqual(made.workingCopy, { bytes: Buffer.byteLength("THE 4K COPY"), seconds: Math.round((REEL2.to - REEL2.from) * 1000) / 1000, fps: 30 });
    assert.equal(made.from.file, "Pricing talk.mp4");

    // A second edit of the same Reel is version 2, in a folder of its own; the first stays as it is.
    const first = listAll(made.dir);
    const record = { ...w.found.record, app: { toolchain: "0.8.208", projects: [entryOf({ key: "reel 2", name, mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 2 })] } };
    const second = await w.make({ record, key: "reel 2", mode: "hifi", title: "Know your costs" });
    assert.deepEqual([second.why, second.slug, second.name], [undefined, "3fa9c1-reel-2-v2", "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v2"]);
    assert.deepEqual(listAll(made.dir), first);
    assert.match(readFileSync(join(second.dir, "edit.py"), "utf8"), /^STYLE = "hifi"$/m);
  });

  it("makes the link of Decision 2 only where nothing else is, and keeps its own", () => {
    const w = world();
    const dir = projectFolderOf(w.t.home, FOLDER, "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v1");
    mkdirSync(dir, { recursive: true });
    assert.equal(linkProject(w.t.home, "3fa9c1-reel-2-v1", dir), "");
    assert.equal(linkProject(w.t.home, "3fa9c1-reel-2-v1", dir), "");
    const taken = "Reel Kit's place for this edit on this Mac holds something else, so nothing was changed: ask Jason.";
    const projects = join(reelKitHome(w.t.home), "projects");
    mkdirSync(join(projects, "3fa9c1-reel-3-v1"));
    writeFileSync(join(projects, "3fa9c1-main-v1"), "a file");
    symlinkSync(join(w.t.dir, "elsewhere"), join(projects, "3fa9c1-reel-4-v1"));
    for (const slug of ["3fa9c1-reel-3-v1", "3fa9c1-main-v1", "3fa9c1-reel-4-v1"]) assert.equal(linkProject(w.t.home, slug, dir), taken, slug);
    assert.ok(lstatSync(join(projects, "3fa9c1-reel-3-v1")).isDirectory());
    assert.equal(readlinkSync(join(projects, "3fa9c1-reel-4-v1")), join(w.t.dir, "elsewhere"));
    // Reel Kit's projects folder that is a file, or a link (dangling or not), is no place of Studio's: nothing is made in it.
    for (const odd of [(at) => writeFileSync(at, "a file"), (at) => symlinkSync(join(w.t.dir, "gone"), at), (at) => symlinkSync(w.t.dir, at)]) {
      const v = world();
      const at = join(reelKitHome(v.t.home), "projects");
      mkdirSync(reelKitHome(v.t.home), { recursive: true });
      odd(at);
      assert.equal(linkProject(v.t.home, "3fa9c1-reel-2-v1", dir), taken);
    }
    for (const slug of ["../x", "3fa9c1-reel-2", "3fa9c1-reel-0-v1", "3fa9c1-main-v0", ""]) assert.throws(() => linkProject(w.t.home, slug, dir), /slug/, slug);
    assert.deepEqual([slugOf({ id: ID }, "main", 3), slugOf({ id: ID }, "reel 12", 1)], ["3fa9c1-main-v3", "3fa9c1-reel-12-v1"]);
    for (const [key, version] of [["reel 0", 1], ["clip 1", 1], ["main", 0], ["main", 1.5]]) assert.throws(() => slugOf({ id: ID }, key, version), JSON.stringify([key, version]));
  });

  it("keeps the source in the project when a later copy of 1080 is made and free takes the working copies away", async () => {
    const w = world({ record: { answer: { ...ANSWERED, seen: "upright, 0:23" } }, raw: { width: 2160, height: 3840 } });
    const made = await w.make({ key: "main", mode: "lofi", title: "Pricing" });
    assert.equal(made.why, undefined, made.why);
    const clip = join(made.dir, "source", "clip.mp4");
    // HyperFrames' copy of 1080 of the main video replaces every main copy of another key in the working copy folder: not this one.
    const later = await makeWorkCopy({ home: w.t.home, folder: FOLDER, video: w.video, name: "Pricing talk" }, w.copy);
    assert.equal(later.ok, true, later.words);
    assert.ok(existsSync(later.paths.video));
    assert.equal(readFileSync(clip, "utf8"), "THE 4K COPY");
    // `free` takes the working copy folder away: the edit's source stays.
    const said = [];
    assert.equal(await freeEpisode({ ...w.t.ctx, say: (line) => said.push(line) }, { found: w.found, record: w.found.record }, { running: () => false }), 0, said.join("\n"));
    assert.ok(!existsSync(later.paths.video), said.join("\n"));
    assert.ok(lstatSync(clip).isFile());
    assert.equal(readFileSync(clip, "utf8"), "THE 4K COPY");
    // A later run of the same edit keeps the copy it moved in, and makes no other.
    const ffmpeg = w.guarded.length;
    const again = await w.make({ key: "main", mode: "lofi", title: "Pricing", version: 1 });
    assert.equal(again.why, "Reel Kit could not start this edit: ask Jason.");
    assert.equal(w.guarded.length, ffmpeg);
    assert.equal(readFileSync(clip, "utf8"), "THE 4K COPY");
  });

  it("claims Reel Kit's place for the edit before its folder is made, and makes nothing when it is taken", async () => {
    const w = world();
    const projects = join(reelKitHome(w.t.home), "projects");
    mkdirSync(join(projects, "3fa9c1-reel-2-v1"), { recursive: true });
    const refused = await w.make({ key: "reel 2", mode: "lofi", title: "Know your costs" });
    assert.equal(refused.why, "Reel Kit's place for this edit on this Mac holds something else, so nothing was changed: ask Jason.");
    assert.deepEqual([w.guarded, w.runs()], [[], []]);
    assert.ok(!existsSync(projectFolderOf(w.t.home, FOLDER, "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v1")));
  });

  it("reads studio.json only as a plain file of its size, and writes it whole", () => {
    const w = world();
    const dir = projectFolderOf(w.t.home, FOLDER, "Pricing- what to charge- main 3fa9c1 Reel Kit v1");
    mkdirSync(dir, { recursive: true });
    assert.equal(stateFile(dir), join(dir, "studio.json"));
    assert.equal(readState(dir), null);
    writeState(dir, { state: "queued", step: "" });
    assert.deepEqual(readState(dir), { state: "queued", step: "" });
    assert.deepEqual(readdirSync(dir), ["studio.json"]);
    // What is not a whole record of Studio's own is none: not JSON, too large, not an object.
    for (const text of ["", "{ not json", JSON.stringify({ state: "x".repeat(2 << 20) }), "[1, 2]", "null"]) {
      writeFileSync(stateFile(dir), text);
      assert.equal(readState(dir), null, text.slice(0, 20));
    }
    // A link where the file should be is not followed.
    writeFileSync(join(w.t.dir, "other.json"), JSON.stringify({ state: "ready" }));
    const linked = projectFolderOf(w.t.home, FOLDER, "Pricing- what to charge- reel 3 3fa9c1 Reel Kit v1");
    mkdirSync(linked, { recursive: true });
    symlinkSync(join(w.t.dir, "other.json"), stateFile(linked));
    assert.equal(readState(linked), null);
    // Nor is a pipe waited on.
    const piped = projectFolderOf(w.t.home, FOLDER, "Pricing- what to charge- reel 1 3fa9c1 Reel Kit v1");
    mkdirSync(piped, { recursive: true });
    execFileSync("mkfifo", [stateFile(piped)]);
    assert.equal(readState(piped), null);
    assert.throws(() => projectFolderOf(w.t.home, FOLDER, "../out"));
    assert.throws(() => projectFolderOf(w.t.home, "a/b", "x"));
  });

  it("cuts a Reel's source to its own times at 4K, and never in the drop folder", async () => {
    const w = world();
    const drop = dropFolderOf(w.t.ctx.settings, w.t.home);
    const episodeBefore = listAll(w.found.folder);
    const made = await w.make({ key: "reel 2", mode: "showcase", title: "Know your costs" });
    assert.equal(made.why, undefined, made.why);
    assert.equal(w.guarded.length, 1);
    const { args, limits } = w.guarded[0];
    assert.equal(w.after(args, "-ss"), String(REEL2.from));
    assert.equal(Number(w.after(args, "-t")), Math.round((REEL2.to - REEL2.from) * 1000) / 1000);
    assert.equal(args[args.indexOf("-i") + 1], w.video);
    assert.match(w.after(args, "-vf"), /,scale=3840:2160,/);
    assert.equal(limits.most, 8 * 1024 ** 3);
    // Made in BRIMM Video Work alone: nothing in the drop folder, nothing new in the episode's folder in Dropbox.
    assert.ok(args.at(-1).startsWith(`${workFolder(w.t.home)}/`), args.at(-1));
    assert.ok(made.dir.startsWith(`${workFolder(w.t.home)}/`) && lstatSync(join(made.dir, "source", "clip.mp4")).isFile());
    assert.ok(!existsSync(drop) || readdirSync(drop).length === 0);
    assert.deepEqual(listAll(w.found.folder), episodeBefore);

    // The main video of an upright recording is the whole recording, at 4K.
    const upright = world({ record: { answer: { ...ANSWERED, seen: "upright, 0:23" } }, raw: { width: 2160, height: 3840 } });
    const main = await upright.make({ key: "main", mode: "lofi", title: "Pricing" });
    assert.equal(main.why, undefined, main.why);
    assert.ok(!upright.guarded[0].args.includes("-ss"));
    assert.match(upright.after(upright.guarded[0].args, "-vf"), /,scale=2160:3840,/);
    assert.equal(main.slug, "3fa9c1-main-v1");
  });

  it("runs new.py with the Reel's title word for word", async () => {
    const w = world();
    const title = "Know your costs — it’s the first thing, isn't it? (50% of the work)";
    const made = await w.make({ key: "reel 2", mode: "lofi", title });
    assert.equal(made.why, undefined, made.why);
    const [ran] = w.runs();
    assert.deepEqual([ran.folder, ran.script], ["pipeline", "new.py"]);
    assert.deepEqual(ran.args, [made.slug, join(made.dir, "source", "clip.mp4"), title, "--mode", "lofi"]);
    assert.equal(ran.env.REEL_KIT_HOME, reelKitHome(w.t.home));
    assert.deepEqual([ran.env.HF_HUB_OFFLINE, ran.env.PIP_NO_INDEX, ran.env.UV_OFFLINE], ["1", "1", "1"]);
    assert.ok(readFileSync(join(made.dir, "edit.py"), "utf8").includes(`TITLE = "${title}"\n`));

    // A title Reel Kit's edit.py can't hold is refused before anything is queued (startWhy: the main video's as scaffold is given it, a
    // Reel's from the record), and before anything is made (scaffold).
    const BAD = "The Reel's title can't hold a double quote, a backslash or a new line for Reel Kit: say it again without them.";
    assert.deepEqual([titleWhy(title), titleWhy('Say "no"'), titleWhy("")], ["", BAD, "The Reel needs a title for Reel Kit."]);
    const upright = { ...RAW, reels: REELS, answer: { ...ANSWERED, seen: "upright, 0:40" } };
    assert.equal(ask({ record: upright, key: "main", mode: "lofi", title: 'Say "no"' }), BAD);
    assert.equal(ask({ record: upright, key: "main", mode: "lofi", title }), "");
    const quoted = { ...upright, reels: REELS.map((r) => (r.n === 2 ? { ...r, title: 'Know your "costs"' } : r)) };
    assert.equal(ask({ record: quoted, key: "reel 2", mode: "lofi" }), BAD);
    assert.equal(ask({ record: { ...upright, reels: REELS.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) }, key: "reel 2", mode: "lofi" }), "The Reel needs a title for Reel Kit.");
    assert.equal(ask({ record: upright, key: "reel 2", mode: "lofi" }), "");
    for (const bad of ['Say "no" to discounts', "Back\\slash", "Two\nlines", "", "   "]) {
      const v = world();
      const refused = await v.make({ key: "reel 2", mode: "lofi", title: bad });
      assert.ok(typeof refused.why === "string" && refused.why !== "", JSON.stringify(bad));
      assert.deepEqual([v.guarded, v.runs()], [[], []], JSON.stringify(bad));
    }
    // Reel Kit's own refusal is said in plain words, and logged.
    const lines = [];
    const again = await w.make({ key: "reel 2", mode: "lofi", title, version: 1 }, { log: (line) => lines.push(line) });
    assert.equal(again.why, "Reel Kit could not start this edit: ask Jason.");
    assert.ok(lines.some((line) => line.includes("edit.py already exists")), lines.join("\n"));
  });

  it("copies her pack in before new.py runs", async () => {
    const w = world();
    const settings = w.t.ctx.settings;
    assert.deepEqual(ensureHerPack({ settings, home: w.t.home, build: { mode: "dev" } }), { made: true, why: "" });
    const hers = join(herPack(settings), "STYLE.md");
    writeFileSync(hers, `${readFileSync(hers, "utf8")}\nHer own line, added in Dropbox.\n`);
    const made = await w.make({ key: "reel 2", mode: "hifi", title: "Know your costs" });
    assert.equal(made.why, undefined, made.why);
    assert.equal(readFileSync(join(made.dir, "style", "STYLE.md"), "utf8"), readFileSync(hers, "utf8"));

    // A pack that can't be used stops the edit before anything is made, in its own words.
    const v = world();
    ensureHerPack({ settings: v.t.ctx.settings, home: v.t.home, build: { mode: "dev" } });
    writeFileSync(join(herPack(v.t.ctx.settings), "style.json"), "{ half synced");
    const refused = await v.make({ key: "reel 2", mode: "hifi", title: "Know your costs" });
    assert.match(refused.why, /style\.json/);
    assert.deepEqual([v.guarded, v.runs()], [[], []]);
    assert.ok(!existsSync(join(reelKitHome(v.t.home), "projects")));
    assert.equal(basename(herPack(v.t.ctx.settings)), "Reel Kit style");
  });
});
