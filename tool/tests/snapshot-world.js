// The made-up world the tests of release's snapshot and the take-over share (edit-release-app.test.js, edit-take-over-app.test.js; plan
// PR 11): the made-up episode of exports-world.js (Mac Studio, with its main project and Reel 2 on disk, a Downloads folder, the app's
// records of the exports), the projects filled with what `app` and the app put in a project, and a second Mac sharing the root. Nothing
// here touches the real home, Dropbox, Downloads or BRIMM Video Work: every folder is a temporary one, and no program is run.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reelStretch } from "../app-reel.js";
import { cliPath } from "../hyperframes.js";
import { episodeWork } from "../settings.js";
import { reelCopyKey, reelCopyPaths, workCopyKey, workCopyPaths } from "../workcopy.js";
import { FOLDER, listAll, otherMac, reread } from "./episodes.js";
import { MAIN, REEL1, REEL2, entry, exportOf, ms, named, world as exportsWorld } from "./exports-world.js";

export { FOLDER, MAIN, REEL1, REEL2, entry, exportOf, ms, named, reread };
export { listAll };

/** The claim Mac Studio holds on the made-up episode. */
export const MINE = { by: "Mac Studio", since: "2026-10-20T14:00:00-05:00" };
/** The claim Sallie's laptop holds. */
export const HERS = { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" };
/** The first snapshot's folder, when the made-up clock has not moved: 15:00 on 2026-10-20 in UTC-5. */
export const T1 = "2026-10-20 20.00.00Z";

/** What a project `app` made holds that a snapshot takes, with what the app and its assistant added, each file with its text. */
export const HELD = {
  "index.html": "<html>the timeline</html>", "meta.json": '{"id":"p"}', "hyperframes.json": "{}", "package.json": '{"name":"p"}', "transcript.json": "[]",
  "CLAUDE.md": "the rules", "AGENTS.md": "the rules", "vendor/gsap.min.js": "gsap", "assets/fonts/Allison-Regular.ttf": "a font", "assets/brand-kit/mark.png": "a picture",
  "brimm/facts.json": '{"seconds":23.423,"width":1280,"height":720}', "brimm/brand.md": "the brand", "brimm/spellings.json": "{}", "compositions/title-card.html": "<div>Pricing</div>"
};
/** What a project holds that a snapshot leaves out. */
export const NOT_HELD = {
  "media/recording.mp4": "the working copy", ".claude/settings.json": "{}", ".hyperframes/app-history.jsonl": "{}", ".hyperframes/history-id": "an id", "renders/old.mp4": "a render",
  "snapshots/frame.png": "a frame", ".thumbnails/t.jpg": "a thumbnail", ".DS_Store": "", "Icon\r": "a folder's icon", "assets/Icon\r": "a folder's icon"
};

const setTime = (path, at) => utimesSync(path, new Date(at), new Date(at));

/** Fill a project's folder with `held` and `notHeld`, every file last changed at `at`, and the link into the toolchain that `app` makes
    (to a place that is not there: nothing follows it). Returns the paths of `held`, sorted. */
export function fillProject(dir, { held = HELD, notHeld = NOT_HELD, at = ms(13, 40) } = {}) {
  for (const [rel, text] of Object.entries({ ...held, ...notHeld })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
    setTime(join(dir, rel), at);
  }
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  symlinkSync("/nowhere/hyperframes.mjs", join(dir, "node_modules", ".bin", "hyperframes"));
  return Object.keys(held).sort();
}

/** The made-up episode that Mac Studio has open, with its projects on its disk filled (fillProject) and HyperFrames not running.
    `projects` are the keys of the record's projects ("main" and "reel 2"); `over` changes the record; `fill: false` leaves the folders
    as exports-world.js makes them. */
export function releaseWorld({ projects = ["main", "reel 2"], over = {}, fill = true, ...rest } = {}) {
  const w = exportsWorld({ projects, over: { editing: MINE, ...over }, ...rest });
  if (fill) for (const key of projects || []) fillProject(w.dirOf(key));
  w.t.ctx.deps.running = async () => false;
  return w;
}

/** Every file and link under a folder, as paths from it, sorted: a link is not followed (a project's link into the toolchain leads
    nowhere here), and a folder is not listed. [] when there is no such folder. */
export function filesBelow(dir) {
  let names = [];
  try {
    names = readdirSync(dir, { recursive: true });
  } catch (e) {
    return [];
  }
  return names.filter((rel) => !lstatSync(join(dir, rel)).isDirectory()).sort();
}

/** The files of an episode's snapshot of a project, as paths from the project's folder in it, sorted. */
export const snapshotListing = (w, time, project) => filesBelow(join(w.found.folder, "app-snapshot", time, project));

/** A second Mac, Sallie's laptop, sharing the root of `w`: its own home, set up for the app, with the stand-ins of `w`. */
export function laptop(w) {
  const mac = otherMac(w.t);
  mac.deps.settings = { ...mac.deps.settings, app: "hyperframes", handoffVersion: 2 };
  mac.deps.zone = w.t.ctx.deps.zone;
  mac.deps.running = async () => false;
  return { home: mac.home, deps: mac.deps, work: episodeWork(mac.home, FOLDER) };
}

/** What a file holds, as text. */
export const textOf = (path) => readFileSync(path, "utf8");

// --- The take-over: the same episode on two Macs ---

export const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
export const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
/** What ffmpeg's stand-in leaves as a working copy, and as a Reel's. */
export const COPY_TEXT = "the working copy's bytes";
export const REEL_COPY_TEXT = "the Reel's bytes";

/** The Mac Studio's projects, as `release` hands them over, and Sallie's laptop beside it, set up for the app with its own toolchain (a link
    to the stand-in for the pinned command line) and its own home. The raw video is as the projects were made from it (its size and its
    time, as the entries of the record say), so that nothing is said of a recording that changed. Reel 2's facts hold the stretch of the
    recording the suggestion has and the size it is made at. `options` are releaseWorld's. */
export function takeOverWorld(options = {}) {
  const w = releaseWorld(options);
  const made = Date.parse("2026-10-14T09:00:00-05:00") / 1000;
  utimesSync(join(w.found.folder, "Pricing talk.mp4"), made, made);
  w.t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
  writeFileSync(join(w.t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  if (existsSync(w.dirOf("reel 2"))) {
    const { stretch } = reelStretch(w.found.folder, 2);
    const facts = join(w.dirOf("reel 2"), "brimm", "facts.json");
    writeFileSync(facts, JSON.stringify({ seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, width: 1280, height: 720, reel: { n: 2, offset: stretch.start } }));
    setTime(facts, ms(13, 40));
  }
  const b = laptop(w);
  mkdirSync(dirname(cliPath(b.home)), { recursive: true });
  symlinkSync(STAND_IN, cliPath(b.home));
  b.deps.app = { node: process.execPath, guidance: GUIDANCE };
  writeFileSync(join(b.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
  return { ...w, b };
}

/** The working copy of the made-up recording, as the `workcopy` run leaves it on `mac` (home and work folder): its video and its facts. */
export function madeCopy(mac, found, over = {}) {
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const paths = workCopyPaths(mac.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, COPY_TEXT);
  writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: COPY_TEXT.length, ...over }));
  return paths;
}

/** Reel `n`'s video, as `workcopy --reel` leaves it on `mac`: the stretch the suggestion has (reels.json), cut as the project was made. */
export function madeReelCopy(mac, found, n = 2, over = {}) {
  const raw = statSync(join(found.folder, "Pricing talk.mp4"));
  const { stretch } = reelStretch(found.folder, n);
  const paths = reelCopyPaths(mac.home, FOLDER, n, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, stretch));
  mkdirSync(dirname(paths.video), { recursive: true });
  writeFileSync(paths.video, REEL_COPY_TEXT);
  writeFileSync(paths.facts, JSON.stringify({ seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, fps: 30, width: 1280, height: 720, bytes: REEL_COPY_TEXT.length, stretch, ...over }));
  return paths;
}
