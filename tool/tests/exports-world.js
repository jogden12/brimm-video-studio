// The made-up world the tests of `finish` from HyperFrames' exports share (edit-finish-app.test.js, finish-app.test.js,
// edit-finish-clip.test.js): the made-up recording of phase4.js, answered as a test says, with a HyperFrames project on disk for the
// main video and for Reel 2, a Downloads folder in the test's own home, and the app's records of the exports a test makes. Stand-ins
// answer for ffprobe, ffmpeg and the transcriber (episodes.js), so that no test runs a program, and nothing here touches the real
// Downloads folder, Dropbox or BRIMM Video Work: the home is a temporary folder.
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedZone } from "../exports.js";
import { PIN } from "../hyperframes.js";
import { projectName } from "../project.js";
import { downloadsFolder, episodeWork, writeSettings } from "../settings.js";
import { FOLDER, ID, NAME, SRT, episodeFor, partOf, setup, toldOf } from "./episodes.js";
import { probed } from "./fixtures.js";
import { reelsFile } from "../reels.js";
import { EPISODE, episode, rawProbe } from "./phase4.js";

/** The zone the made-up records are in (UTC-5), so that no test depends on the Mac it runs on. */
export const ZONE = fixedZone(-300);
/** A moment on 2026-10-20 in that zone. The made-up Mac's clock starts at 15:00 that day, so every export is in the past. */
export const ms = (hours, minutes, seconds = 0) => ZONE.ms(2026, 10, 20, hours, minutes, seconds);
/** The names of the made-up episode's projects, as project.js gives them (and as `app` and `app … reel 2` record them). */
export const namesFor = (name) => ({ main: projectName({ name, part: "main", id: ID }), "reel 1": projectName({ name, part: { reel: 1 }, id: ID }), "reel 2": projectName({ name, part: { reel: 2 }, id: ID }) });
export const PROJECT_OF = namesFor(NAME);
export const { main: MAIN, "reel 1": REEL1, "reel 2": REEL2 } = PROJECT_OF;
/** An export's name as the app makes it: the project's name, the day, the time its export began to the minute, and the ending. */
export const named = (project, when, ending = "mp4") => `${project} 2026-10-20 ${when}.${ending}`;
export const AT = "2026-10-20T15:00:00-05:00";
export const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };

/** One project of the record (architecture 7.1), opened and not yet exported. */
export const entry = (key, over = {}, names = PROJECT_OF) => ({
  key, name: names[key], madeAt: AT, on: "Mac Studio", from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
  workingCopy: { bytes: 16, seconds: 23.423, fps: 30 }, opened: ["2026-10-20T13:00:00-05:00"], handover: false, fromSuggestion: key === "main" ? null : Number(key.slice(5)), state: "opened", ...over
});

/** What the stand-in for ffprobe says of an export: the main video is wide and 11.878 seconds long, Reel 1 upright and 7.7 seconds, Reel 2
    upright and 75 seconds (long enough for Story parts), with sound and standard colour. `over` changes a file's facts by its name. */
export const probeFor = (over = () => ({})) => (args) => {
  const file = args[args.length - 1];
  const reel = /reel[ -]\d/.test(file);
  const seconds = /reel[ -]2/.test(file) ? "75.000000" : reel ? "7.700000" : "11.878000";
  const facts = { picture: reel ? { width: 1080, height: 1920, color_primaries: "bt709", color_transfer: "bt709" } : { width: 1280, height: 720, color_primaries: "bt709", color_transfer: "bt709" }, sound: { sample_rate: "48000", channels: 2 }, duration: seconds, ...over(file) };
  writeFileSync(args[args.indexOf("-o") + 1], probed(facts));
  return { code: 0, stderr: "" };
};

const setTime = (path, at) => utimesSync(path, new Date(at), new Date(at));

// --- The words on a project's picture (plan PR 8): made-up files in the shape of the ones A0 and A0b left ---

const onScreenFixture = (rel) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/on-screen/${rel}`, import.meta.url), "utf8");
/** The made-up main project's files: its video, and a lower third (a composition a host names, from 0:03): "Alex Rivera" over "Head of Pricing". */
export const LOWER_THIRD = {
  "index.html": '<div id="root" data-composition-id="main" data-start="0" data-duration="180" data-width="1920" data-height="1080">\n  <video id="a-roll" class="clip" src="media/recording.mp4" playsinline data-start="0" data-duration="180" data-track-index="0" data-has-audio="true"></video>\n  <div id="lower-third" data-composition-id="lower-third" data-composition-src="compositions/lower-third.html" data-start="3" data-duration="6" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>\n</div>\n',
  "compositions/lower-third.html": onScreenFixture("compositions/lower-third.html")
};
/** The fixtures' whole main project: the lower third, a title card whose host sets its words, a note, an end card and the captions. */
export const FIXTURE_MAIN = {
  "index.html": onScreenFixture("index.html"),
  ...Object.fromEntries(["lower-third", "title-card", "title", "captions", "end-card"].map((name) => [`compositions/${name}.html`, onScreenFixture(`compositions/${name}.html`)]))
};
/** A Reel's project in the fixtures: a title, "Mistake one", from 0:00, and the captions beside it. */
export const REEL_FILES = { ...FIXTURE_MAIN, "index.html": onScreenFixture("reel-index.html") };
/** The words of the lower third, and what finish says of them: shown with a question, and said again as taken once she has said yes. */
export const MAIN_WORDS = ["Alex Rivera", "Head of Pricing"];
export const FOUND = 'On screen in the main video I found "Alex Rivera" at 0:03 and "Head of Pricing" at 0:03. Right?';
export const TAKEN = 'On screen in the main video: "Alex Rivera" at 0:03 and "Head of Pricing" at 0:03.';
/** Files written into the project of `key`, each with the time its index.html has (13:40), so that the project's last change stays where
    the exports' tests have it. Every file of the project is replaced by `files` when `only` is true. */
export function screen(w, key, files, { only = false } = {}) {
  const dir = w.dirOf(key);
  if (only) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "renders"), { recursive: true });
  }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), text);
    setTime(join(dir, rel), ms(13, 40));
  }
}

/** The made-up recording (phase4.js), answered as `kind` says, with a project on disk for each of `projects` ("main" and "reel 2"), this
    Mac set up for the app (`set`), its hand-off in version 2 (`handoffVersion`), and the app's index.html of each project last changed
    at 13:40. `projects: null` gives a record with no `app` at all. `over` changes the record, `programs` the stand-ins. `name` is another
    name for the episode, whose projects are named for it (namesFor), as one with an accent and a quote in it. */
export function world({ kind = "raw", projects = ["main", "reel 2"], over = {}, programs = {}, set = true, handoffVersion = 2, name = null, candidates = null, shown = true } = {}) {
  const names = name ? namesFor(name) : PROJECT_OF;
  const record = { version: projects ? 4 : 3, kind, answer: ANSWERED, ...(name ? { name: { text: name, placeholder: false } } : {}), ...(projects ? { app: { toolchain: PIN.version, projects: projects.map((key) => entry(key, {}, names)) } } : {}), ...over };
  // `candidates` are the Reel suggestions of the episode's reels.json in place of the made-up two: a reading's, with an opening and a closing, a reason and a point.
  const made = candidates ? { ...EPISODE, files: { ...EPISODE.files, "reels.json": JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "read", made: AT, candidates }), null, 2) + "\n" } } : EPISODE;
  const { t, found } = episode(record, { FFPROBE: probeFor(), ...programs }, made);
  const patch = { ...(set ? { app: "hyperframes" } : {}), handoffVersion };
  writeSettings(t.home, patch);
  t.ctx.settings = { ...t.ctx.settings, ...patch };
  t.ctx.deps.zone = ZONE;
  const downloads = downloadsFolder(t.home);
  mkdirSync(downloads, { recursive: true });
  const work = episodeWork(t.home, FOLDER);
  const dirOf = (key) => join(work, names[key]);
  const w = { t, found, work, downloads, dirOf, names, asked: () => JSON.parse(readFileSync(join(work, "finish.asked.json"), "utf8")) };
  for (const key of projects || []) {
    mkdirSync(join(dirOf(key), "renders"), { recursive: true });
    // The main video's picture holds a lower third (plan PR 8); a Reel's holds nothing unless a test says so.
    screen(w, key, key === "main" ? LOWER_THIRD : { "index.html": "<html></html>" });
  }
  // Unless `shown` is false, finish has already shown her the lower third and asked if it is right, as the tests that go on to a yes
  // need (review I1): a yes is to the words she was shown. The tests of what is shown, and of the yes that follows it, leave it out.
  if (shown && (projects || []).includes("main")) {
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, "finish.shown.json"), JSON.stringify({ version: 1, at: AT, lines: MAIN_WORDS }));
  }
  return w;
}

/** An export of `key`'s project that began at `start` ([hours, minutes, seconds]), saved in Downloads under the name the app gives
    it, ending two minutes later, with the record the app leaves in the project's renders/ (A0's fixture, with the names filled in).
    `ending`, `text`, `name` and `record: false` change the file and its record. Gives { path, name, began }. */
export function exportOf(w, key, { start = key === "main" ? [13, 56, 40] : key === "reel 1" ? [14, 0, 30] : [14, 3, 12], ending = "mp4", text = `the export of ${key}`, name, record = true, folder = w.downloads } = {}) {
  const [hours, minutes, seconds] = start;
  const two = (n) => String(n).padStart(2, "0");
  const fileName = name ?? named(w.names[key], `${two(hours)}.${two(minutes)}`, ending);
  const path = join(folder, fileName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path, text);
  const began = ms(hours, minutes, seconds);
  setTime(path, began + 120000);
  if (record) {
    const fixture = readFileSync(new URL(`./fixtures/hyperframes-0.8.208/exports/${key === "main" ? "main" : "reel"}.meta.json`, import.meta.url), "utf8");
    const told = JSON.parse(fixture.replace("<DOWNLOADS>", w.downloads));
    told.exportedTo = path;
    writeFileSync(join(w.dirOf(key), "renders", `${w.names[key]}_2026-10-20_${two(hours)}-${two(minutes)}-${two(seconds)}.meta.json`), JSON.stringify(told));
  }
  return { path, name: fileName, began };
}

/** The captions the transcriber stand-in writes of each part: Reel 2 starts with the words the suggestion it was made from starts with. */
export const CAPTIONS = { main: SRT.main, "reel 1": SRT["reel 1"], "reel 2": SRT["reel 1"] };
/** The stand-in for the transcriber: the captions above of the part whose sound it is given (or `over` them), and their word times. */
export const whisper = (over = {}) => (args) => {
  const base = args[args.indexOf("-of") + 1];
  const part = partOf(args[args.indexOf("-f") + 1]);
  const srt = over[part] ?? CAPTIONS[part] ?? CAPTIONS.main;
  writeFileSync(base + ".srt", srt);
  if (args.includes("-ojf")) writeFileSync(base + ".json", JSON.stringify(toldOf(srt)));
  return { code: 0, stderr: "" };
};
/** The made-up world with that stand-in (or `captions` over its parts, or `programs`). */
export const fw = ({ captions = {}, programs = {}, ...rest } = {}) => world({ ...rest, programs: { WHISPER: whisper(captions), ...programs } });

/** Reel suggestions as a reading makes them: a stretch of the recording each, with its opening and closing, why and the point. 1 and 3 are
    said in the made-up main video; 2 is picked in the made-up record (and is Reel 2); 4 is the retake the recording starts with, which the
    main video does not say. */
export const suggestion = (n, ranges, over) => ({ n, start: ranges[0].start, end: ranges.at(-1).end, ranges, seconds: ranges.reduce((sum, r) => sum + r.end - r.start, 0), title: "", preview: null, ...over });
export const ONE = suggestion(1, [{ start: 5.872, end: 9.843 }], { reason: "It says what the talk is about.", point: "Pricing is the subject.", first: "Welcome to the show", last: "talk about pricing" });
export const TWO = suggestion(2, [{ start: 13.38, end: 16.516 }, { start: 19.219, end: 21.287 }], { reason: "It makes one point and stands alone.", point: "Know your costs.", first: "So the first thing you need", last: "Thank you so much, Sallie" });
export const THREE = suggestion(3, [{ start: 16.2, end: 21.287 }], { reason: "It says why costs matter.", point: "Costs are what to know first.", first: "It is very, very important", last: "Thank you so much, Sallie" });
export const FOUR = suggestion(4, [{ start: 0, end: 4.76 }], { reason: "It is the first take.", point: "It starts the talk.", first: "Welcome to the show", last: "Let me do that again" });
export const CANDIDATES = [ONE, TWO, THREE, FOUR];

// --- An iPhone clip she answered (plan PR 7, group F): read by Claude, in a made-up episode of its own, with no project ---

export const VIDEO = "Pricing talk.mp4";
export const IMPORT_SRT = "1\n00:00:06,070 --> 00:00:07,040\n Welcome to the show.\n\n2\n00:00:19,414 --> 00:00:21,097\n Thank you so much, Sallie Ogdin.\n\n3\n00:00:21,200 --> 00:00:23,000\n Pricing is the subject, and pricing needs costs.\n\n";
export const CLIP_FILES = { [VIDEO]: "the clip", "Pricing talk.srt": IMPORT_SRT, "Pricing talk.transcript.txt": "the transcript" };
export const SPELLINGS = [
  { heard: "Ogdin", spelled: "Ogden", why: "It is her surname." },
  { heard: "pricing", spelled: "Pricing", why: "It is the subject." }
];
export const CLIP_ANSWER = { state: "answered", guess: "short video", seen: "upright, 0:23", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
export const READING = { kind: "short video", model: "m", at: AT, on: "Mac Studio", account: "", outcome: "read" };

/** An iPhone clip she answered, read by Claude: its record holds the offers (`answered` too, when `answer` lists the offers she applied,
    by the words heard). This Mac hands off `version` of the hand-off, and its settings turn the app on when `app` is true (they do not,
    unless a test says so, so the words that offer HyperFrames are left out). */
export function clipWorld({ version = 2, answer = null, over = {}, files = CLIP_FILES, app = false } = {}) {
  const t = setup({ programs: { FFPROBE: rawProbe } });
  if (version || app) {
    const patch = { ...(version ? { handoffVersion: version } : {}), ...(app ? { app: "hyperframes" } : {}) };
    writeSettings(t.home, patch);
    t.ctx.settings = { ...t.ctx.settings, ...patch };
  }
  const offers = { spellings: SPELLINGS, ...(answer ? { answered: { reading: READING.at, at: AT, on: "Mac Studio", applied: answer, left: SPELLINGS.map((s) => s.heard).filter((h) => !answer.includes(h)) } } : {}) };
  const spellings = answer ? answer.map((heard) => [heard, SPELLINGS.find((s) => s.heard === heard).spelled]) : [];
  const found = episodeFor(t, { record: { version: 3, kind: "short video", answer: CLIP_ANSWER, label: "Video of 14 Oct, 09:12 (Mac Studio)", editing: { by: "Mac Studio", since: AT }, offers, reading: READING, spellings, ...over }, files });
  return { t, found };
}

/** The project's last change in the app, made at `at` ([hours, minutes, seconds]). */
export function changeAt(w, key, at) {
  setTime(join(w.dirOf(key), "index.html"), ms(...at));
}
