// The episode import's own steps. When this Mac has settings and the folder the import watches is this Mac's drop folder,
// in BRIMM Video in Dropbox, each video is made into an episode: everything is made as for any video, held in the run's own
// folder, and then filed into a folder of its own in Episodes. The raw video is cloned in from the drop folder, each file
// made of it is cloned in from the run's folder, the Final Cut file goes into edit/ as main.v0.fcpxml, naming its video by a
// path from itself and naming no library, and the episode's first record, record/0001.json, comes last: it is the sign that
// the import finished. Nothing in Dropbox is renamed, moved or written into (dropbox.js). The raw video stays in the drop
// folder, and the run's folder stays, until the late check.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { localDay } from "./shared/text.js";
import { createdOf } from "./cuts.js";
import { cloneIn, replaceIn, textWriter } from "./dropbox.js";
import { RECORD_DIR, newEpisode, newId, localStamp, readEpisode, writeEpisode } from "./episode.js";
import { episodeFolderName, fileSafe, timelineFile } from "./names.js";
import { dropFolder, episodesFolder } from "./settings.js";

/** How long a recording must be to be an episode, in seconds. One that is shorter is a short video. */
const SHORT_UNDER = 90;

/** Whether the import of the watched folder `dir` makes episodes: when this Mac has `settings` and `dir` is its own drop
    folder. Otherwise the import does what it did before episodes, filing each video into a folder for the day. */
export const episodeMode = (dir, settings) => Boolean(settings) && resolve(dir) === resolve(dropFolder(settings.root, settings.machine));

/** What kind of episode a video makes, by its facts: a short video when its picture is upright or square, or it is shorter
    than 90 seconds, and an episode otherwise. A short video gets no upright version and no Reels. A recording of sound alone
    is an episode. */
export function episodeKind(facts) {
  if (!facts.height) return "episode";
  return facts.width <= facts.height || facts.duration < SHORT_UNDER ? "short video" : "episode";
}

/** The folders in Episodes that this Mac would have named for a video: any day, the video's name, this Mac's, and a number
    or none. */
function namedFor(name, stem, machine) {
  const tail = ` ${fileSafe(stem)} (${machine})`;
  const i = name.indexOf(tail);
  return /^\d{4}-\d{2}-\d{2}$/.test(name.slice(0, i)) && /^(-\d+)?$/.test(name.slice(i + tail.length));
}

/** The size of a file, or -1 when it is not there. */
const sizeOf = (file) => {
  const found = statSync(file, { throwIfNoEntry: false });
  return found ? found.size : -1;
};

/** The folder in `episodes` the video `video`, of `bytes` bytes, goes into on `machine`, on the day `day`: { name, reused }.
    An import of this video by this Mac that stopped before it wrote a whole record left a folder, which is used again: its
    name is one this Mac would give the video, it has no whole record, and it holds the video at its size, or no video yet.
    Otherwise a new name, by episodeFolderName. */
export function findFolder(episodes, { video, bytes, machine, day }) {
  const stem = basename(video, extname(video));
  let names = [];
  try {
    names = readdirSync(episodes);
  } catch (e) {
    // There is no Episodes yet, and nothing in it to use again.
  }
  const stopped = names.filter((name) => namedFor(name, stem, machine)).sort().find((name) => {
    const folder = join(episodes, name);
    if (readEpisode(folder).code !== "NONE") return false;
    const size = sizeOf(join(folder, video));
    return size === -1 || size === bytes;
  });
  return stopped ? { name: stopped, reused: true } : { name: episodeFolderName(names, day, stem, machine), reused: false };
}

/** Which brimm-video is at work: the short commit the checkout `checkout` is at, as git says it, or "unknown". It goes into
    each record's writer, for information only. */
export function commitOf(checkout) {
  const ran = spawnSync("git", ["-C", checkout, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const commit = ran.status === 0 ? String(ran.stdout).trim() : "";
  return /^[0-9a-f]{7,}$/.test(commit) ? commit : "unknown";
}

/** File a video that has been worked on into its episode, in Episodes under BRIMM Video. `file` is the raw video in the drop
    folder; `made` are the files made of it, each where it belongs, and `at(to)` where its whole copy is in the run's own
    folder `work`; `fcpxml` is which of them is the Final Cut file, which goes into edit/main.v0.fcpxml; `facts` and
    `printed` are what ffprobe said; `kind` is the episode's kind; `read` is Claude's reply as it was read, or null; `cut` is
    the clips as they were cut. `deps` gives `episode` ({ root, machine, checkout, home }), and `clone`, `sameDisk`, `log`,
    `today`, `now`, `commit` and `rand` when a test gives others.
    The folder is made, or the one a stopped import left is used again; the raw video is cloned in from the drop folder; each
    file is cloned in from the run's folder; and the first record is written last, by the rule, its work copy kept. Gives
    back { name, path, record, entries }, where `entries` are the late check's: { from, to, bytes } for every file put in,
    the record's among them. Throws, saying why, when a file cannot be put in: then no record is written, and the next run
    uses the folder again. */
export function fileEpisode({ file, made, at, fcpxml, facts, printed, kind, read, cut, work }, deps) {
  const { episode, log = () => {} } = deps;
  const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}), log };
  const video = basename(file);
  const bytes = statSync(file).size;
  const day = deps.today ? deps.today() : localDay();
  const episodes = episodesFolder(episode.root);
  mkdirSync(episodes, { recursive: true });
  const found = findFolder(episodes, { video, bytes, machine: episode.machine, day });
  const path = join(episodes, found.name);
  mkdirSync(join(path, "edit"), { recursive: true });
  // A stopped import may have left a record that is not whole. It is no one's record, and the first one is written anew.
  if (found.reused) rmSync(join(path, RECORD_DIR), { recursive: true, force: true });
  const entries = [];
  const files = {};
  const put = (from, rel) => {
    const to = join(path, rel);
    (found.reused ? replaceIn : cloneIn)(from, to, opts);
    entries.push({ from, to, bytes: statSync(from).size });
    files[rel] = statSync(from).size;
  };
  put(file, video);
  for (const to of made) put(at(to), to === fcpxml ? timelineFile({ part: "main", v: 0 }) : basename(to));
  const writer = { commit: deps.commit || commitOf(episode.checkout), on: episode.machine };
  const write = textWriter({ work: join(work, "record"), keep: true, ...opts });
  const title = read && typeof read.title === "string" && read.title.trim() ? { text: read.title.trim(), from: "claude", approved: false } : null;
  const reels = kind === "episode" ? cut.filter((c) => c.files.length).map((c) => ({ n: c.clip.n, status: "candidate", from: c.clip.start, to: c.clip.end, title: c.clip.hook || "", why: c.clip.why || "", files: c.files.map((f) => basename(f)), pushed: [] })) : [];
  const first = newEpisode({
    id: newId(day, deps.rand),
    machine: episode.machine,
    at: localStamp(deps.now ? deps.now() : new Date()),
    video: { file: video, bytes, seconds: facts.duration, created: createdOf(printed) },
    kind,
    writer,
    files,
    title,
    reels
  });
  const record = writeEpisode(path, first, { expectRev: 0, writeText: (to, text) => entries.push(write(to, text)), writer, home: episode.home });
  log(`${video}: filed into Episodes as "${found.name}"${found.reused ? ", in the folder an import that stopped had made" : ""}.`);
  return { name: found.name, path, record, entries };
}
