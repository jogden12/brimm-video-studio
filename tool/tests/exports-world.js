// The made-up world the tests of `finish` from HyperFrames' exports share (edit-finish-app.test.js, finish-app.test.js,
// edit-finish-clip.test.js): the made-up recording of phase4.js, answered as a test says, with a HyperFrames project on disk for the
// main video and for Reel 2, a Downloads folder in the test's own home, and the app's records of the exports a test makes. Stand-ins
// answer for ffprobe, ffmpeg and the transcriber (episodes.js), so that no test runs a program, and nothing here touches the real
// Downloads folder, Dropbox or BRIMM Video Work: the home is a temporary folder.
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedZone } from "../exports.js";
import { PIN } from "../hyperframes.js";
import { projectName } from "../project.js";
import { downloadsFolder, episodeWork, writeSettings } from "../settings.js";
import { FOLDER, ID, NAME, SRT, episodeFor, partOf, setup, toldOf } from "./episodes.js";
import { probed } from "./fixtures.js";
import { EPISODE, episode, rawProbe } from "./phase4.js";

/** The zone the made-up records are in (UTC-5), so that no test depends on the Mac it runs on. */
export const ZONE = fixedZone(-300);
/** A moment on 2026-10-20 in that zone. The made-up Mac's clock starts at 15:00 that day, so every export is in the past. */
export const ms = (hours, minutes, seconds = 0) => ZONE.ms(2026, 10, 20, hours, minutes, seconds);
/** The names of the made-up episode's projects, as project.js gives them (and as `app` and `app … reel 2` record them). */
export const namesFor = (name) => ({ main: projectName({ name, part: "main", id: ID }), "reel 1": projectName({ name, part: { reel: 1 }, id: ID }), "reel 2": projectName({ name, part: { reel: 2 }, id: ID }), "reel 3": projectName({ name, part: { reel: 3 }, id: ID }) });
export const PROJECT_OF = namesFor(NAME);
export const { main: MAIN, "reel 1": REEL1, "reel 2": REEL2, "reel 3": REEL3 } = PROJECT_OF;
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

/** The made-up recording (phase4.js), answered as `kind` says, with a project on disk for each of `projects` ("main" and "reel 2"), this
    Mac set up for the app (`set`), its hand-off in version 2 (`handoffVersion`), and the app's index.html of each project last changed
    at 13:40. `projects: null` gives a record with no `app` at all. `over` changes the record, `programs` the stand-ins. `name` is another
    name for the episode, whose projects are named for it (namesFor), as one with an accent and a quote in it. `made` is the episode's
    files and record (phase4.js): the made-up recording's, unless a test gives others (reels-world.js gives a finished video's). */
export function world({ kind = "raw", projects = ["main", "reel 2"], over = {}, programs = {}, set = true, handoffVersion = 2, name = null, made = EPISODE } = {}) {
  const names = name ? namesFor(name) : PROJECT_OF;
  const record = { version: projects ? 4 : 3, kind, answer: ANSWERED, ...(name ? { name: { text: name, placeholder: false } } : {}), ...(projects ? { app: { toolchain: PIN.version, projects: projects.map((key) => entry(key, {}, names)) } } : {}), ...over };
  const { t, found } = episode(record, { FFPROBE: probeFor(), ...programs }, made);
  const patch = { ...(set ? { app: "hyperframes" } : {}), handoffVersion };
  writeSettings(t.home, patch);
  t.ctx.settings = { ...t.ctx.settings, ...patch };
  t.ctx.deps.zone = ZONE;
  const downloads = downloadsFolder(t.home);
  mkdirSync(downloads, { recursive: true });
  const work = episodeWork(t.home, FOLDER);
  const dirOf = (key) => join(work, names[key]);
  for (const key of projects || []) {
    mkdirSync(join(dirOf(key), "renders"), { recursive: true });
    writeFileSync(join(dirOf(key), "index.html"), "<html></html>");
    setTime(join(dirOf(key), "index.html"), ms(13, 40));
  }
  return { t, found, work, downloads, dirOf, names, asked: () => JSON.parse(readFileSync(join(work, "finish.asked.json"), "utf8")) };
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
