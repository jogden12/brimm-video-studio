// The made-up world the tests of release's snapshot and the take-over share (edit-release-app.test.js, edit-take-over-app.test.js; plan
// PR 11): the made-up episode of exports-world.js (Mac Studio, with its main project and Reel 2 on disk, a Downloads folder, the app's
// records of the exports), the projects filled with what `app` and the app put in a project, and a second Mac sharing the root. Nothing
// here touches the real home, Dropbox, Downloads or BRIMM Video Work: every folder is a temporary one, and no program is run.
import { lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { episodeWork } from "../settings.js";
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
  "brimm/facts.json": '{"seconds":23.423}', "brimm/brand.md": "the brand", "brimm/spellings.json": "{}", "compositions/title-card.html": "<div>Pricing</div>"
};
/** What a project holds that a snapshot leaves out. */
export const NOT_HELD = {
  "media/recording.mp4": "the working copy", ".claude/settings.json": "{}", ".hyperframes/app-history.jsonl": "{}", ".hyperframes/history-id": "an id", "renders/old.mp4": "a render",
  "snapshots/frame.png": "a frame", ".thumbnails/t.jpg": "a thumbnail", ".DS_Store": ""
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
