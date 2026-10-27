// A made-up episode for the tests of phase 2's commands (edit.js, reel.js, finish.js): a root as `The BRIMM DB/BRIMM Video`
// is, a home with BRIMM Video Work and its From Final Cut folder, one episode written by phase 1a's own functions, and a
// ctx whose programs are stand-ins. Nothing here touches the real home, Dropbox, Final Cut or a program. The made-up
// recording is fixtures.js's, finished: its main video, and Reels whose captions are the hand-off fixture's.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { layoutOf, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { contextFor } from "../edit.js";
import { episodesFolder, fromFinalCutFolder, writeSettings } from "../settings.js";
import { captionsOf } from "../lib.js";
import { noProgress } from "../progress.js";
import { probed, told } from "./fixtures.js";

export const ID = "e-20261014-3fa9c1";
export const NAME = "Pricing: what to charge?";
export const FOLDER = "2026-10-14 Pricing talk (Mac Studio)";
const HANDOFF = JSON.parse(readFileSync(new URL("./fixtures/handoff-v1.json", import.meta.url), "utf8"));
/** The captions the stand-in transcriber writes of each finished video, by its part. */
export const SRT = { main: HANDOFF.main.srt, "reel 1": HANDOFF.reels[0].srt, "reel 2": HANDOFF.reels[1].srt };
/** What the transcriber writes with -ojf of captions: each caption a segment, its words said evenly over it. */
export const toldOf = (srt) => told(captionsOf(srt).map((c) => {
  const words = c.text.split(/\s+/);
  const each = (c.end - c.start) / words.length;
  return [Math.round(c.start * 1000), Math.round(c.end * 1000), words.map((w, i) => [` ${w}`, Math.round((c.start + each * (i + 1)) * 100)])];
}));
/** The project names of the made-up episode's pushes. */
export const PROJECT = { main: "Pricing- what to charge- main v5 3fa9c1", "reel 1": "Pricing- what to charge- reel 1 v1 3fa9c1", "reel 2": "Pricing- what to charge- reel 2 v1 3fa9c1" };
/** The facts ffprobe gives of each finished video: the main is wide, the Reels upright, and Reel 2 runs over a minute. */
export const SHAPE = { main: { width: 1280, height: 720, seconds: 11.878 }, "reel 1": { width: 1080, height: 1920, seconds: 7.7 }, "reel 2": { width: 1080, height: 1920, seconds: 75 } };
/** The part a file is of: by the project name in its name, its run folder's name, or the import's name for a clip. */
export const partOf = (path) => Object.keys(PROJECT).find((key) => path.includes(PROJECT[key]) || path.includes(`/${key.replace(" ", "-")}/`) || path.includes(`.${key.replace(" ", "-")}.`)) || "";

/** A folder for one test, and a ctx as phase 1a's contextFor gives one, with stand-ins: `programs` answers for ffprobe,
    ffmpeg and the transcriber by default as the real ones would of the made-up episode's finished videos; a test may give
    its own for any of them. The clock moves only when the work waits. */
export function setup({ machine = "Mac Studio", programs = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-phase-2-"));
  const root = join(dir, "BRIMM Video");
  const home = join(dir, "home");
  const work = join(dir, "work");
  for (const d of [episodesFolder(root), fromFinalCutFolder(home), work]) mkdirSync(d, { recursive: true });
  const said = [];
  const opened = [];
  const started = [];
  const clones = [];
  const calls = [];
  const waits = [];
  let clock = Date.parse("2026-10-20T15:00:00-05:00");
  // A clone never writes over a file: the rule deletes one first (replaceIn). This stand-in refuses, so a test fails if
  // anything is ever written in place. And it keeps the file's times, as cp -c (clonefile) does.
  const clone = (from, to) => {
    if (existsSync(to)) throw new Error(`${to} is there already, and a clone never writes over a file.`);
    clones.push([from, to]);
    copyFileSync(from, to);
    const times = statSync(from);
    utimesSync(to, times.atime, times.mtime);
  };
  const stand = {
    FFPROBE: (args) => {
      const file = args[args.length - 1];
      const shape = SHAPE[partOf(file)] || SHAPE.main;
      writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: { width: shape.width, height: shape.height }, sound: { sample_rate: "48000", channels: 2 }, duration: shape.seconds.toFixed(6) }));
      return { code: 0, stderr: "" };
    },
    FFMPEG: (args) => {
      const out = args[args.length - 1];
      if (out === "-") return { code: 0, stderr: "" };
      writeFileSync(out, args.includes("pcm_s16le") ? "RIFF" : "a part of a Story");
      return { code: 0, stderr: "" };
    },
    WHISPER: (args) => {
      const base = args[args.indexOf("-of") + 1];
      const srt = SRT[partOf(args[args.indexOf("-f") + 1])] || SRT.main;
      writeFileSync(base + ".srt", srt);
      if (args.includes("-ojf")) writeFileSync(base + ".json", JSON.stringify(toldOf(srt)));
      return { code: 0, stderr: "" };
    },
    ...programs
  };
  const run = async (cmd, args, asked = {}) => {
    calls.push({ cmd, args });
    return stand[cmd] ? stand[cmd](args, asked) : { code: 0, stderr: "" };
  };
  writeSettings(home, { machine, root, checkout: "/checkout" });
  const ctx = contextFor({
    home, say: (line) => said.push(line), now: () => clock,
    openApp: (app, file) => opened.push([app, file]), start: (cmd, args) => started.push([cmd, args]),
    alive: () => false, isWhole: () => true, clone, sameDisk: () => true, commit: "c709b57", keepAwake: () => {},
    // No test asks launchctl whether this Mac's launch agent is at work: it is not, unless a test says it is.
    agentRunning: () => false,
    run, tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE", whisper: "WHISPER", model: "MODEL" }, running: async () => false, progress: noProgress,
    // No test looks anything up on the network: this Mac is online unless a test says otherwise.
    online: async () => true,
    // No test reads this computer's own Claude settings: `behind` looks at the environment, the managed settings folder and the
    // managed preferences (loosened.js lockLoosened), and here they are empty and in the test's own folder. Its session runs in her
    // folder for Claude, as her sessions do, whether or not a test has written that folder.
    env: {}, managedDir: join(dir, "managed"), managedPrefs: join(dir, "managed-preferences"), user: "sallie", cwd: join(home, "BRIMM Video Studio"),
    wait: async (ms) => {
      waits.push(ms);
      clock += ms;
    }
  });
  return {
    dir, root, home, work, ctx, opened, started, clones, calls, waits,
    said: () => said.join("\n"),
    now: () => clock,
    /** A file Final Cut wrote into From Final Cut, `ms` after the clock's start. An export is a bundle, a folder with its
        Info.fcpxml in it, both of that time: an export is as new as the later of the two. */
    shared: (name, ms = 0, text = "a finished video") => {
      const at = join(fromFinalCutFolder(home), name);
      const when = new Date(Date.parse("2026-10-20T14:00:00-05:00") + ms);
      if (name.endsWith(".fcpxmld")) {
        mkdirSync(at, { recursive: true });
        writeFileSync(join(at, "Info.fcpxml"), `<fcpxml version="1.11"><resources><asset id="r1"><media-rep src="file://${encodeURI(join(root, "Episodes", FOLDER, "Pricing talk.mp4"))}"/></asset></resources></fcpxml>\n`);
        utimesSync(join(at, "Info.fcpxml"), when, when);
      } else writeFileSync(at, text);
      utimesSync(at, when, when);
      return at;
    },
    grow: (path, bytes) => appendFileSync(path, "x".repeat(bytes)),
    inFinal: (found) => listAll(join(found.folder, "final")),
    done: () => rmSync(dir, { recursive: true, force: true })
  };
}

/** Every file under a folder, as paths from it, sorted. */
export function listAll(dir, from = dir) {
  let out = [];
  let names = [];
  try {
    names = readdirSync(dir);
  } catch (e) {
    return [];
  }
  for (const name of names) {
    const at = join(dir, name);
    if (statSync(at).isDirectory()) out = out.concat(listAll(at, from));
    else out.push(at.slice(from.length + 1));
  }
  return out.sort();
}

const push = (v, project, at = "2026-10-20T10:00:00-05:00") => ({ v, at, on: "Mac Studio", file: `edit/x.v${v}.mac-studio.fcpxml`, project });
/** The made-up episode as it stands at the end of an edit: named, its title approved, main pushed to v5, Reels 1 and 2
    picked and pushed once, Reel 3 a candidate. */
export const EDITED = {
  name: { text: NAME, placeholder: false },
  title: { text: "Price like you mean it", from: "person", approved: true },
  main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: [push(4, "Pricing- what to charge- main v4 3fa9c1"), push(5, PROJECT.main)] },
  reels: [
    { n: 1, status: "picked", from: 13.38, to: 21.287, title: "Know your costs", why: "", files: ["Pricing talk.reel-1.mp4", "Pricing talk.reel-1.srt"], pushed: [push(1, PROJECT["reel 1"])] },
    { n: 2, status: "picked", from: 5.872, to: 9.843, title: "Say it again, better", why: "", files: ["Pricing talk.reel-2.mp4", "Pricing talk.reel-2.srt"], pushed: [push(1, PROJECT["reel 2"])] },
    { n: 3, status: "candidate", from: 0, to: 4, title: "The opening", why: "", files: [], pushed: [] }
  ]
};

/** What the Final Cut finish refuses for now, in either version of the hand-off: a client or group session, whose own finish
    comes with its teachings, and a video not yet answered, which has no kind to finish as. Each as [what it is, the record's
    own fields, the refusal as a function of how the video is named, how the video is named as a function of its label]. A
    session's name is its session label, as `kind` writes it in the same write as its mark (edit.js answerKind), and each
    refusal names the video as edit.js names it (episode.js shownName): a session by that name, a video not yet answered by its
    label, else by its short id. */
const SESSION_NAME = "Session, 2026-10-14";
export const NOT_YET = [
  ["a client or group session", { kind: "session", name: { text: SESSION_NAME, placeholder: false } }, (who) => `${who} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`, () => SESSION_NAME],
  ["a video not yet answered", { kind: null, answer: { state: "needs your answer", guess: "finished", seen: "wide, 42:10", came: "camera" } }, (who) => `${who} is not answered yet: say what it is first. Nothing was written.`, (label) => label || `a video not yet answered (${ID.slice(-6)})`]
];

/** The files the import put in the episode folder: the raw video, its cut plan, and the two clips it cut. */
const IMPORTED = {
  "Pricing talk.mp4": "the raw video",
  "Pricing talk.cut-plan.json": JSON.stringify({ version: 1, video: "Pricing talk.mp4", facts: { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 }, phrases: [{ id: "p4", start: 5.872, end: 6.9, keep: true, text: "Welcome to the show." }, { id: "p7", start: 13.38, end: 16.3, keep: true, text: "So the first thing you need to do is know your costs." }], ranges: [], kept: 11.882, cut: 11.541, by: "rules" }),
  "Pricing talk.reel-1.mp4": "clip one",
  "Pricing talk.reel-1.srt": "1\n00:00:00,000 --> 00:00:02,600\n So the first thing you need to do is know your\n\n",
  "Pricing talk.reel-2.mp4": "clip two",
  "Pricing talk.reel-2.srt": "1\n00:00:00,000 --> 00:00:04,780\n Welcome to the show. Today we are... Let me do that again.\n\n"
};

/** One episode, as phase 1a's import leaves one: the import's files in its folder, and its first record, with `record` laid
    over it. Returns `found`, as the commands are given it. */
export function episodeFor(t, { record = {}, files = IMPORTED } = {}) {
  const folder = join(t.root, "Episodes", FOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, name)), { recursive: true });
    writeFileSync(join(folder, name), text);
    sizes[name] = Buffer.byteLength(text);
  }
  const first = newEpisode({ id: ID, machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: "Pricing talk.mp4", bytes: sizes["Pricing talk.mp4"] || 1, seconds: 23.423, created: "2026-10-14T09:00:00-05:00" }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" }, files: sizes });
  writeFileSync(recordFile(folder, 1), recordText({ ...first, rev: 1, ...record }));
  return { folder, name: FOLDER, record: readEpisode(folder).record };
}

/** Another episode in the made-up root, with its own folder and id: the import's first record with `record` laid over it, at
    the layout it then holds. Returns `found`, as the commands are given it. */
export function episodeAs(t, { id, name, record = {} }) {
  const folder = join(t.root, "Episodes", name);
  mkdirSync(join(folder, "record"), { recursive: true });
  const made = newEpisode({ id, machine: "Mac Studio", at: "2026-10-22T09:12:00-05:00", video: { file: "Talk.mp4", bytes: 1, seconds: 10, created: "2026-10-22T09:00:00-05:00" }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" } });
  const next = { ...made, rev: 1, ...record };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next) }));
  return { folder, name, record: readEpisode(folder).record };
}

/** The episode's newest record, read again. */
export const reread = (found) => readEpisode(found.folder).record;

/** The same root seen from another Mac: its own home, and settings naming it, as contextFor takes them. The ctx shares the
    first Mac's stand-ins (clone, clock, wait), so both Macs' writes go through the same rule and the same clock. */
export function otherMac(t, machine = "Sallie's laptop") {
  const home = join(t.dir, `home-${machine.replace(/\W+/g, "-")}`);
  mkdirSync(fromFinalCutFolder(home), { recursive: true });
  return contextFor({ ...t.ctx.deps, home, settings: { version: 1, machine, root: t.root, checkout: "/checkout" } });
}
